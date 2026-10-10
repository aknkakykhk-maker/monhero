#!/usr/bin/env node
// モンヒロビートの演奏中の重さを測る(2026-10-10 Sheriruth・HELL のカクつき調べで使った道具をまとめたもの)。
// ボットに演奏させ、決めた区間(曲の時刻)のあいだの
//   ・1コマの時間(requestAnimationFrame の間隔): 平均・95%・最長・50ms超の回数
//   ・処理の忙しさ(CDP プロファイラ): 1秒あたり何 ms 動いているか
//   ・関数ごとの「含む時間」(1秒あたり ms): ノーツを描く処理(paintCanvasNote)など
// を出す。本物の Supabase へは1件も送らない(偽の Supabase)。保存も新しいセーブの中だけ。
//
// 使い方(先に node tools/build.js を通しておく):
//   node tools/playbot/rhythm-frame-perf.js --song sheriruth --diff MASTER                 曲えらびから(既定)
//   node tools/playbot/rhythm-frame-perf.js --song freedom_dive --diff MASTER --from 104000 --to 112000 --cpu 3
//   node tools/playbot/rhythm-frame-perf.js --song sheriruth_hell_debug --diff HELL --entry proto   デバッグの試作の枠から
//   node tools/playbot/rhythm-frame-perf.js --song freedom_dive --diff MASTER --entry debug         音ゲーデバッグの曲の一覧から
//   --root <フォルダ>  別の作業場所(git worktree など)のゲームを測る。前後の比べは、前の版を worktree に置いて交互に測る
//   --landscape 0     縦画面(390x844)で測る。既定は横(844x390)
//   --funcs a,b,c     「含む時間」を出す関数名を足す
//   PERF_DEBUG=1      区間の終わりの様子(済んだノーツ・MISS・画面の文字)と画面の写真を出す(数字がおかしいときの確かめ用)
//
// 見かた:
//   ・getBoundingClientRect の時間は、ボットが指の位置を出すために呼ぶ分。ゲームの重さとは分けて見る
//   ・CPU を4倍以上遅くすると、手元のブラウザのほうが頭打ち(忙しさが1秒あたり 900ms 超)になり、1コマの時間は比べにならない。
//     そのときは「含む時間」(関数ごとの JS の時間)で比べる
//   ・曲えらびからのときは、ゲームを sky.test というホスト名に見せかけて開く(localhost だとプレイの記録の送信を止める作りのため。
//     送り先は偽の Supabase で、プレイの記録・タッチの診断は「断られた」扱いで返す)
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const ROOT = path.resolve(arg('root', ROOT_DEFAULT));
const SONG = arg('song', 'sheriruth'), DIFF = arg('diff', 'MASTER'), ENTRY = arg('entry', 'select');
const FROM = Number(arg('from', 104000)), TO = Number(arg('to', 112000)), CPU = Number(arg('cpu', 1));
const LAND = arg('landscape', '1') !== '0';
const W = LAND ? 844 : 390, H = LAND ? 390 : 844;
const FUNCS = ['paintCanvasNote', 'drawNote', 'drawSlide', 'drawHead', 'rhythmNoteCanvasGeometry', 'rhythmSlideSegmentQuads', 'rhythmSlideCheckpointLines', 'rhythmRestartAnimations', 'visitNote', 'tick',
  ...String(arg('funcs', '')).split(',').filter(Boolean)];
const { chromium } = require(path.join(ROOT_DEFAULT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT_DEFAULT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));

const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  // 上の難易度を開けておく(曲えらびから MASTER などを選べるように)
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) {
      if (req.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return route.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(route);
    }
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed(SONG));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  let started = false;
  if (ENTRY === 'select') {
    await clickText('モンヒロビート$'); await page.waitForTimeout(2500); await closeDialogs(6);
    await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
    // 曲の名前は曲えらびの表示名で探す(songId から表示名を引く)
    const name = await page.evaluate((id) => (RHYTHM_SONGS.find(s => s.songId === id) || {}).displayName || id, SONG);
    await clickText('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); await page.waitForTimeout(1200);
    await clickText(DIFF); await page.waitForTimeout(800);
    started = await clickText('^(▶\\s*)?決定$');
  } else {
    await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    await clickText('💊'); await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
    started = await page.evaluate(([song, diff, entry]) => {
      if (entry === 'proto') { const b = document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start="${diff}"]`) || document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start]`); if (b) b.click(); return !!b; }
      const sec = [...document.querySelectorAll('section')].find(x => x.querySelector('small') && x.querySelector('small').textContent.trim() === song);
      const art = sec && [...sec.querySelectorAll('article')].find(a => a.textContent.startsWith(diff + ' '));
      const b = art && art.querySelector('[data-rhythm-tap-start]'); if (b) b.click(); return !!b;
    }, [SONG, DIFF, ENTRY]);
  }
  if (!started) throw new Error(`曲を始められなかった(${ENTRY} ${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  const playing = await page.evaluate(() => ({ notes: (window.__mhTestHooks.rhythmNotes() || []).length, title: (document.querySelector('[data-rhythm-play-area]')?.closest('main')?.innerText || '').split('\n').slice(0, 4).join(' ') }));
  console.log(`演奏: ノーツ ${playing.notes} / ${playing.title.slice(0, 60)}`);
  // ボット(空中のノーツは空中の高さで押す)
  const target = 'const p = fingerAt(c, hab, null, now);';
  const src = installPlayer.toString();
  const player = src.includes(target) ? src.replace(target, 'const p = (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : 0; if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();') : src;
  const args = { sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
  await page.evaluate(`(${player})(${JSON.stringify(args)})`);
  await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a - 1500, FROM, { timeout: 600000, polling: 200 });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push([window.__mhTestHooks?.rhythmSongMs?.(), t - last]); last = t; if (window.__ft.length < 30000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a, FROM, { timeout: 600000, polling: 'raf' });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.waitForFunction((b) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= b, TO, { timeout: 600000, polling: 'raf' });
  const { profile } = await cdp.send('Profiler.stop');
  if (process.env.PERF_DEBUG) { console.log('区間の終わりの様子', JSON.stringify(await page.evaluate(() => { const r = window.__mhTestHooks.rhythmNoteResults?.() || []; return { 済み: r.filter(x => x.done).length, MISS: r.filter(x => x.judgment === 'MISS').length, 止め: !!document.querySelector('[data-rhythm-pause-menu]'), 文字: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }; }))); const shot = require('path').join(require('os').tmpdir(), 'rhythm-frame-perf.png'); await page.screenshot({ path: shot }); console.log('画面:', shot); }
  const ft = (await page.evaluate(() => window.__ft)).filter(([m]) => m != null && m >= FROM && m < TO).map(([, d]) => d).sort((x, y) => x - y);
  const sec = (TO - FROM) / 1000;
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const cnt = new Map(); profile.samples.forEach((id, k) => cnt.set(id, (cnt.get(id) || 0) + (profile.timeDeltas[k] || 0)));
  const incl = new Map(); let busy = 0;
  for (const [id, us] of cnt) {
    if (byId.get(id).callFrame.functionName !== '(idle)') busy += us;
    let x = id; const seen = new Set();
    while (x != null) { const key = byId.get(x).callFrame.functionName || '(無名)'; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } x = parent.get(x); }
  }
  const avg = ft.length ? ft.reduce((p, q) => p + q, 0) / ft.length : 0;
  console.log(`${SONG} ${DIFF} ${FROM / 1000}〜${TO / 1000}秒 CPU${CPU}倍 ${W}x${H}`);
  console.log(`  1コマ: ${ft.length}コマ 平均${avg.toFixed(1)}ms 95%${(ft[Math.floor(ft.length * .95)] || 0).toFixed(0)}ms 最長${(ft[ft.length - 1] || 0).toFixed(0)}ms 50ms超${ft.filter(d => d > 50).length}`);
  console.log(`  忙しさ: 1秒あたり ${(busy / 1000 / sec).toFixed(0)}ms`);
  console.log(`  含む時間(1秒あたり ms): ${FUNCS.map(k => `${k} ${((incl.get(k) || 0) / 1000 / sec).toFixed(1)}`).join(' / ')}`);
  console.log(`  (参考)getBoundingClientRect ${((incl.get('getBoundingClientRect') || 0) / 1000 / sec).toFixed(1)}ms はボットの分`);
  if (errors.length) console.log(`  ページのエラー: ${errors.join(' | ')}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
