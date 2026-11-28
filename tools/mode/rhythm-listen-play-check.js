#!/usr/bin/env node
// 曲鑑賞(オートプレイ・r1119-112)を本物のブラウザで1曲流し、ミスが0か・叩いた音が遊ぶ時と同じだけ鳴るかを確かめる(2026-11-23 r1119-145)。
//   社長「もんびーの鑑賞でダブルフリックだけ音が出てない気がする」「鑑賞なのにみすってるときがある。とくにヘルで」
// 曲選び → ジャケットの拡大 → 「🎧 この譜面を鑑賞する」で始め、曲の終わりまで待って、ノーツごとの判定(__mhTestHooks.rhythmNoteResults)と、
// 鳴らした音(RHYTHM_NOTE_SE_RUNTIME の playFlick・playClear・playSky・playMonster)を数える。曲の長さぶん時間がかかる。
//   node tools/mode/rhythm-listen-play-check.js --song monster_hero --diff HELL [--from <ms> --to <ms>] [--list]
//   --from/--to … 曲の途中から(鑑賞の「+10秒」と同じ移り方で跳んで)その区間だけ見る
// 全曲・全難易度を速く見るのは tools/mode/rhythm-listen-hands-scan.js(ブラウザを使わない)。
// 本物の Supabase へは1件も送らない(偽の Supabase)。
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, fb = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb; };
const SONG = arg('song', 'monster_hero'), DIFF = arg('diff', 'EXPERT'), LIST = argv.includes('--list');
const FROM = Number(arg('from', 0)), TO = Number(arg('to', 1e12));
// --shot <ms> --out <png> … その時刻になった瞬間の画面を撮って終わる(止めると一時停止の窓が出るので止めない)(見た目を見比べるとき用)。--portrait で縦持ち(390×844)
const SHOT = arg('shot') != null ? Number(arg('shot')) : null, OUT = arg('out'), PORTRAIT = argv.includes('--portrait');
// --gpu … ソフトの GPU(swiftshader)を使えるようにして、ノーツを WebGL で描かせる(2D と GPU の見た目を見比べるとき用)
const GPU = argv.includes('--gpu');
// --click-hud … 鑑賞が始まったら「判定」の入/切を1回押す(r1119-151 追記・r1119-162 で判定とコンボを分けた。押す前と後の状態を出す)
const CLICK_HUD = argv.includes('--click-hud');
// --stall <間隔ms>,<止めるms> … 鑑賞のあいだ、決まった間隔でメインスレッドをわざと止める(かくつきの再現・2026-11-28 r1126-100 追記1
//   社長「ワルキューレのヘルの鑑賞でかくついたときにコンボが切れた」)。コンボの数が途中で減ったら(切れたら)NG にする
const STALL = (() => { const v = arg('stall'); if (!v) return null; const [every, ms] = String(v).split(',').map(Number); return every > 0 && ms > 0 ? { every, ms } : null; })();
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
  put('mh_rhythm_owned_songs_v1', [${JSON.stringify(songId)}, ${JSON.stringify(songId.replace(/_short$/, ''))}]);   // 有料の曲も鑑賞できるように
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', ...(GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  const context = await browser.newContext({ viewport: PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 }, deviceScaleFactor: SHOT != null ? 2 : 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) return sb.handle(route);
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed(SONG));
  if (GPU) await context.addInitScript(() => { try { localStorage.setItem('mh_rhythm_canvas_v1', 'webgl'); } catch (_) {} });
  await context.addInitScript(eventStorySeed());
  const page = await context.newPage();
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
  await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
  await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
  await page.evaluate((id) => {
    const head = typeof rhythmSongVersionHead === 'function' ? rhythmSongVersionHead(id) : id;
    (document.querySelector(`[data-rhythm-song-row="${id}"]`) || document.querySelector(`[data-rhythm-song-row="${head}"]`))?.click();
  }, SONG); await page.waitForTimeout(1200);
  await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-version="${id}"]`); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }, SONG); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click()); await page.waitForTimeout(1000);
  const picked = await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-listen-diff="${d}"]`); if (!b) return false; b.click(); return true; }, DIFF);
  if (!picked) { const have = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map(b => b.getAttribute('data-rhythm-listen-diff')).join(',') + ' / ' + (document.querySelector('[data-rhythm-listen-panel]')?.parentElement?.innerText || '').slice(0, 80)); throw new Error(`鑑賞の難易度 ${DIFF} を選べない(選べるのは ${have})`); }
  await page.waitForTimeout(400);
  // 鳴らした音を数える(音そのものは変えない。呼ばれた回数を数えるだけ)
  await page.evaluate(() => {
    const se = RHYTHM_NOTE_SE_RUNTIME, log = window.__listenSe = [];
    for (const k of ['playFlick', 'playClear', 'playSky', 'playMonster', 'playEmpty']) { const f = se[k]; if (typeof f !== 'function') continue;
      se[k] = function (...a) { try { const ms = window.__mhTestHooks?.rhythmSongMs?.(); log.push([k, ms, a[0]]); } catch (_) {} return f.apply(this, a); }; }
    // --trace: 入力の記録(RHYTHM_INPUT_REC.event)と、自動の手が送った指の合図を控える(原因を調べるとき用)
    const tr = window.__listenTrace = [], ev = RHYTHM_INPUT_REC.event;
    RHYTHM_INPUT_REC.event = function (k, d) { try { tr.push([window.__mhTestHooks?.rhythmSongMs?.(), 'rec:' + k, JSON.stringify(d)]); } catch (_) {} return ev.apply(this, arguments); };
    for (const t of ['pointerdown', 'pointermove', 'pointerup']) document.addEventListener(t, e => { if (e.pointerId >= 900) tr.push([window.__mhTestHooks?.rhythmSongMs?.(), t, e.pointerId + ' ' + Math.round(e.clientX) + ',' + Math.round(e.clientY)]); }, true);
  });
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
  if (STALL) await page.evaluate(({ every, ms }) => {
    // コンボが減った回数を見張る(鑑賞の「-10秒」で戻したときは数えない。この検査では戻さない)
    window.__comboBreaks = []; let last = 0;
    const watch = () => { const h = typeof RHYTHM_PLAY_WATCH !== 'undefined' && RHYTHM_PLAY_WATCH.hud ? RHYTHM_PLAY_WATCH.hud.get() : null;
      if (h) { const c = Number(h.combo) || 0; if (c < last) window.__comboBreaks.push([Math.round(window.__mhTestHooks?.rhythmSongMs?.() ?? -1), last, c]); last = c; } requestAnimationFrame(watch); };
    requestAnimationFrame(watch);
    window.__stalls = 0; setInterval(() => { if ((window.__mhTestHooks?.rhythmSongMs?.() ?? -1) <= 0) return; const t = performance.now(); while (performance.now() - t < ms) {} window.__stalls++; }, every);
  }, STALL);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  const info = await page.evaluate(() => { const n = window.__mhTestHooks.rhythmNotes() || []; return { types: n.map(x => x.type), count: n.length, last: n.reduce((m, x) => Math.max(m, Number(x.endTimeMs) || 0, Number(x.timeMs) || 0), 0) }; });
  const end = Math.min(info.last, TO);
  console.log(`鑑賞: ${SONG} ${DIFF} ノーツ ${info.count} / 最後 ${(info.last / 1000).toFixed(1)}秒`);
  if (CLICK_HUD) {
    await page.waitForSelector('[data-rhythm-listen-toggle="judge"]', { timeout: 30000 });
    const before = await page.evaluate(() => document.querySelector('[data-rhythm-listen-toggle="judge"]').getAttribute('data-state'));
    await page.evaluate(() => document.querySelector('[data-rhythm-listen-toggle="judge"]').click()); await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ btn: document.querySelector('[data-rhythm-listen-toggle="judge"]').getAttribute('data-state'), saved: localStorage.getItem('mh_rhythm_listen_judge_v1'), opt: JSON.parse(localStorage.getItem('mh_rhythm_settings_v1') || '{}') }));
    console.log(`  判定: ${before} → ${after.btn}(覚えた値 ${after.saved}・オプションの判定文字表示 ${after.opt.judgmentTextDisplay}・コンボ数 ${after.opt.comboDisplay})`);
  }
  // 曲が流れ始めるのを待ち、--from があればそこまで「+10秒」で跳ぶ
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 0, null, { timeout: 30000, polling: 100 });
  while (FROM > 0) { const ms = await page.evaluate(() => window.__mhTestHooks.rhythmSongMs()); if (ms >= FROM - 10500) break;
    const ok = await page.evaluate(() => { const b = document.querySelector('button[aria-label="10秒送る"]'); if (b) b.click(); return !!b; }); if (!ok) break; await page.waitForTimeout(500); }
  if (SHOT != null) {
    await page.waitForFunction((t) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= t, SHOT, { timeout: 600000, polling: 5 });
    await page.screenshot({ path: OUT || 'listen-shot.png' });
    const backend = await page.evaluate(() => { try { return RHYTHM_CANVAS_RENDERER.backend; } catch (_) { return '?'; } });
    console.log(`  撮った: ${OUT || 'listen-shot.png'}(${SHOT}ms・描き方 ${backend})`);
    await context.close(); await browser.close(); return;
  }
  // 曲が終わると演奏の読み取り口が消えるので、1秒ごとに控えておく
  let res = null;
  for (;;) {
    const snap = await page.evaluate(() => { const h = window.__mhTestHooks; if (!h?.rhythmNotes || !h?.rhythmNoteResults) return null;
      return { ms: h.rhythmSongMs?.() ?? null, notes: h.rhythmNotes(), results: h.rhythmNoteResults() || [] }; }).catch(() => null);
    if (!snap) break; res = snap; if (snap.ms != null && snap.ms > end + 1500) break; await page.waitForTimeout(1000);
  }
  if (!res) throw new Error('演奏の結果を読めなかった');
  res.breaks = await page.evaluate(() => window.__comboBreaks || []).catch(() => []);
  res.stalls = await page.evaluate(() => window.__stalls || 0).catch(() => 0);
  res.se = await page.evaluate(() => window.__listenSe || []);
  res.trace = await page.evaluate(() => window.__listenTrace || []);
  await context.close(); await browser.close();
  const byIdx = new Map(res.results.map(r => [r.index, r]));
  // 曲の終わりの1秒ほどは、読み取り口が消える前に控えきれないので、判定の記録(rec:hit・rec:miss)から足す
  for (const [, k, d] of res.trace) { if (k !== 'rec:hit' && k !== 'rec:miss') continue; let o = null; try { o = JSON.parse(d); } catch (_) {} if (!o || !Number.isFinite(o.note)) continue;
    const r = byIdx.get(o.note) || { index: o.note }; if (!r.judgment) { r.judgment = o.j; byIdx.set(o.note, r); } }
  const seen = res.notes.filter(n => n.timeMs >= FROM && n.timeMs <= TO);
  const bad = [];
  for (const n of seen) { const r = byIdx.get(n.index) || {}; const j = r.judgment; if (!j || j === 'MISS' || j === 'BAD' || (!STALL && (r.holdJudgment === 'MISS' || r.releaseJudgment === 'MISS'))) bad.push({ n, r }); }
  // --stall のときは、最後の判定(画面に出る判定・コンボを決める物)だけで数える。わざと止めると自動の手の押し始め・離しは遅れるが、
  // 鑑賞では遅れても取った扱いにする(30-rhythm-play.jsx の applyJudgment)ので、内側の押し始め・離しの記録は MISS のまま残ることがある
  const se = {}; for (const [k] of res.se) se[k] = (se[k] || 0) + 1;
  // 演奏中はフリックの種類が HOLD に書き換わるので、始めの時点の種類で数える(終点フリックは控えに無いので数えない)
  const flicks = seen.filter(n => info.types[n.index] === 'FLICK').length;
  console.log(`  区間のノーツ ${seen.length} / ミス・BAD・判定なし ${bad.length} / フリック ${flicks}(終点フリックは別) に対しフリック音 ${se.playFlick || 0} / 音: ${JSON.stringify(se)}`);
  if (LIST || bad.length <= 30) for (const { n, r } of bad) console.log(`   ${(n.timeMs / 1000).toFixed(2)}秒 #${n.index} ${n.type}${n.skyHeight > 0 ? '(空中)' : ''} lane${n.lane}${n.subLane != null ? ' sub' + n.subLane + '/' + n.subLaneWidth : ''} → ${r.judgment || '判定なし'}${r.holdJudgment ? ' 押し' + r.holdJudgment : ''}${r.releaseJudgment ? ' 離し' + r.releaseJudgment : ''}`);
  if (argv.includes('--trace')) for (const [ms, k, d] of res.trace) if (ms >= FROM && ms <= Math.min(TO, FROM + 20000)) console.log(`   ${Math.round(ms)} ${k} ${d}`);
  if (errors.length) console.log('  ページのエラー:', errors.slice(0, 3).join(' / '));
  if (STALL) { console.log(`  わざと止めた回数 ${res.stalls}(${STALL.every}msおきに${STALL.ms}ms) / コンボが切れた回数 ${res.breaks.length}${res.breaks.length ? ' ' + res.breaks.slice(0, 5).map(([t, a, b]) => `${(t / 1000).toFixed(1)}秒 ${a}→${b}`).join(' / ') : ''}`); }
  process.exitCode = bad.length || (STALL && (res.breaks.length || !res.stalls)) ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });
