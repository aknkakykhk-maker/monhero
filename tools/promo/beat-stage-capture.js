#!/usr/bin/env node
// モンヒロビートの紹介動画「HELL の見どころ(ステージ)」の演奏の素材を撮る(2026-11-24 r1119-159・社長作の見本 monhero-beat-stage.mov の第2版から)。
//
//   node tools/promo/beat-stage-capture.js --song rebellion --diff HELL --from 60000 --to 92000 --out <フォルダ>
//
// 何をするか:
//   ふつうの演奏の画面(ソロライブ → 曲 → 難易度 → 決定)を横 844×390・deviceScaleFactor 3(2532×1170)で開き、
//   オプションの「▶ 見てみる」・曲鑑賞と同じ自動の手(rhythmPreviewHandsStart)に叩かせる。
//   曲鑑賞(オートプレイ)そのものはスコア・ライフ・モンスターの飾りを出さないので、見本と同じ見た目にするため、ふつうの演奏の画面へ同じ手を付けている。
//   --from〜--to(曲の時刻 ms)のあいだだけ、ブラウザの画面配信(CDP の Page.startScreencast)でコマを集め、
//   <フォルダ>/f000000.jpg … と frames.json([{ file, songMs }])に書く。音は撮らない(組み立てで曲の音源をその時刻で切って重ねる)。
//   Playwright の recordVideo は1倍でしか描かないので使わない(docs/promo/VIDEOS.md)。
//
// 守ること:
//   ・偽のデータで撮る(ブリーダー名は「モンヒロ太郎」)。本物の Supabase へは1件も送らない(偽の Supabase)。保存は撮影用のブラウザの中だけ
//   ・デバッグの画面・合言葉は使わない(公開の曲えらびから入る)
//
// 遅回し(既定): 3倍の細かさで描くと、この箱では1秒14コマほどしか描けない(1.5倍でも重い所は1秒48コマ)。
//   そこで撮影用のブラウザの中の時計(performance.now・Date.now・requestAnimationFrame の時刻・setTimeout/setInterval・
//   音の再生時刻 AudioContext.currentTime と曲の再生の速さ・CSS のアニメ)を、そろって --slow 倍(既定 0.15)の速さで回す。
//   ゲームから見ると、ふつうの速さで1秒60コマ以上描いているのと同じになる。コマには曲の時刻(songMs)を付けるので、組み立てで元の速さに戻る。
//   演奏の画面が出るまでは等倍、曲が始まる前に --pre 倍(既定 0.5)、区間の1.5秒前から --slow 倍に落とす。
//   --slow 1 で遅回しをやめる(そのときは --dpr 1.5 にしないとコマが足りない)
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, fb = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb; };
const SONG = arg('song'), DIFF = arg('diff', 'HELL');
const FROM = Number(arg('from', 0)), TO = Number(arg('to', 30000));
const OUT = path.resolve(arg('out', path.join(ROOT, 'tmp-promo', SONG || 'song')));
const SPEED = Number(arg('speed', 9.5));   // ノーツの速さ(見本は 9.5)
const W = Number(arg('w', 844)), H = Number(arg('h', 390)), DPR = Number(arg('dpr', 3));
const SLOW = Number(arg('slow', 0.15)), PRE = Number(arg('pre', 0.5));
if (!SONG) { console.error('--song <songId> が要る'); process.exit(2); }
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[path.extname(f)] || 'application/octet-stream';
// 撮影用のセーブ(新しいブラウザの中だけ)。MASTER をクリアした記録を入れて HELL を開ける。モンスターは見本と同じ飾り(スエゾー・ゴーレム・タイガー ほか)
const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'モンヒロ太郎'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  // 演奏の画面の左右に立つ飾り(育てたマスモンをモンヒロビートの枠に入れると出る)。見本と同じ4体
  put('mh_masu_mons', [['promo-mocchi', 'Mocchi', 'モッチー'], ['promo-golem', 'Golem', 'ゴーレム'], ['promo-suezo', 'Suezo', 'スエゾー'], ['promo-tiger', 'Tiger', 'タイガー']].map(([id, baseId, name]) => ({ id, baseId, name, createdAt: 1767225600000 })));
  put('mh_rhythm_monsters_v1', ['promo-mocchi', 'promo-suezo', 'promo-golem', 'promo-tiger']);
  // 演奏の設定はノーツの速さだけ決める(ほかは既定のまま)
  put('mh_rhythm_settings_v1', { noteSpeed: ${SPEED} });
  put('mh_rhythm_owned_songs_v1', [${JSON.stringify(songId)}]);
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;

// 撮影用のブラウザの中の時計をそろって遅く回す(上の「遅回し」)。window.__promoSetRate(k) で速さを替える(替えた瞬間の時刻から続ける)
const slowClock = () => {
  const realPerf = performance.now.bind(performance), realDate = Date.now.bind(Date);
  window.__promoRealNow = realDate;
  let rate = 1, aReal = realPerf(), aVirt = aReal;
  const virt = (r) => aVirt + (r - aReal) * rate;
  const dateOff = realDate() - realPerf();
  performance.now = () => virt(realPerf());
  Date.now = () => Math.round(dateOff + virt(realPerf()));
  const rAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => rAF((ts) => cb(virt(ts)));
  const sT = window.setTimeout.bind(window), sI = window.setInterval.bind(window);
  window.setTimeout = (fn, ms, ...a) => sT(fn, (Number(ms) || 0) / rate, ...a);
  window.setInterval = (fn, ms, ...a) => sI(fn, Math.max(1, (Number(ms) || 0) / rate), ...a);
  // 音: 文脈ごとに「本物の時刻 ↔ ゲームから見える時刻」をそろえ、鳴らす音は playbackRate を rate 倍にする(曲の終わりがゲームの時刻とずれないように)
  const BAC = window.BaseAudioContext || window.AudioContext;
  const ctDesc = BAC && Object.getOwnPropertyDescriptor(BAC.prototype, 'currentTime');
  const ctxs = new Map(), live = new Set();
  const realCt = (c) => ctDesc.get.call(c);
  const ctxA = (c) => { let a = ctxs.get(c); if (!a) { const r = realCt(c); a = { r, v: r }; ctxs.set(c, a); } return a; };
  const vCt = (c) => { const a = ctxA(c); return a.v + (realCt(c) - a.r) * rate; };
  const toRealCt = (c, w) => { const a = ctxA(c); return a.r + (w - a.v) / rate; };
  if (ctDesc) Object.defineProperty(BAC.prototype, 'currentTime', { configurable: true, get() { return vCt(this); } });
  // 曲の音(AudioBufferSourceNode)は start を自前で持つので、そちらも差し替える(親の AudioScheduledSourceNode だけでは効かない)
  for (const P of [window.AudioScheduledSourceNode, window.AudioBufferSourceNode].filter(Boolean).map(C => C.prototype)) {
    for (const name of ['start', 'stop']) {
      if (!Object.prototype.hasOwnProperty.call(P, name)) continue;
      const orig = P[name];
      P[name] = name === 'start'
        ? function (when = 0, ...rest) {
          if (this.playbackRate && !this.__promoRated) { this.__promoRated = true; this.__baseRate = this.playbackRate.value; this.playbackRate.value = this.__baseRate * rate; live.add(this); this.addEventListener('ended', () => live.delete(this)); }
          return orig.call(this, when > 0 ? Math.max(0, toRealCt(this.context, when)) : 0, ...rest);
        }
        : function (when = 0) { return orig.call(this, when > 0 ? Math.max(0, toRealCt(this.context, when)) : 0); };
    }
  }
  if (window.AudioContext && AudioContext.prototype.getOutputTimestamp) {
    const got = AudioContext.prototype.getOutputTimestamp;
    AudioContext.prototype.getOutputTimestamp = function () { const t = got.call(this); return { contextTime: vCt(this), performanceTime: virt(t.performanceTime) }; };
  }
  window.__promoSetRate = (k) => {
    const r = realPerf(); aVirt = virt(r); aReal = r;
    for (const [c, a] of ctxs) { const rc = realCt(c); a.v = a.v + (rc - a.r) * rate; a.r = rc; }
    rate = k;
    for (const n of live) { try { n.playbackRate.value = (n.__baseRate || 1) * k; } catch (_) {} }
  };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', `--force-device-scale-factor=${DPR}`] });  // 画面配信は deviceScaleFactor だけだと1倍で来るので、起動の設定でも細かさを決める
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, hasTouch: true });
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
  if (SLOW < 1) await context.addInitScript(slowClock);
  await context.addInitScript(seed(SONG));
  await context.addInitScript(eventStorySeed());
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
  await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
  await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
  await page.evaluate((id) => {
    const head = typeof rhythmSongVersionHead === 'function' ? rhythmSongVersionHead(id) : id;
    (document.querySelector(`[data-rhythm-song-row="${id}"]`) || document.querySelector(`[data-rhythm-song-row="${head}"]`))?.click();
  }, SONG); await page.waitForTimeout(1200);
  await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-version="${id}"]`); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }, SONG); await page.waitForTimeout(800);
  await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-difficulty="${d}"]`) || [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(d)); b?.click(); }, DIFF); await page.waitForTimeout(800);
  const started = await clickText('^(▶\\s*)?決定$');
  if (!started) throw new Error(`曲を始められなかった(${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  const setRate = async (k) => { if (SLOW >= 1) return; await page.evaluate((x) => window.__promoSetRate(x), k); await cdp.send('Animation.enable').catch(() => {}); await cdp.send('Animation.setPlaybackRate', { playbackRate: k }).catch(() => {}); };
  await setRate(PRE);
  const head = await page.evaluate(() => (document.querySelector('[data-rhythm-play-area]')?.closest('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80));
  console.log(`演奏: ${SONG} ${DIFF} / ${head}`);
  // 自動の手(曲鑑賞と同じ)。曲の時刻と壁の時計の対応を毎コマ控える(コマに曲の時刻を付けるため)
  // 手に渡すのは曲の譜面そのもの(演奏中の控え rhythmNotes は種類が書き換わるので、渡すとスライドを取りこぼす。鑑賞と同じ渡し方)
  await page.evaluate(([id, d]) => {
    const area = document.querySelector('[data-rhythm-play-area]');
    const song = RHYTHM_SONGS.find(s => s.songId === id);
    const chart = song && song.difficulties && song.difficulties[d];
    const notes = chart && Array.isArray(chart.notes) ? chart.notes : window.__mhTestHooks.rhythmNotes();
    window.__promoStop = rhythmPreviewHandsStart(area, { notes });
    const log = window.__promoClock = [];
    const tick = () => { const ms = window.__mhTestHooks?.rhythmSongMs?.(); if (ms != null && !window.__promoEnded) { if (log.length && ms < log[log.length - 1][1] - 50) window.__promoEnded = true; else log.push([(window.__promoRealNow || Date.now)(), ms]); } if (log.length < 200000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [SONG, DIFF]);
  // 区間の1.5秒前まで待つ(曲の時刻を30秒ごとに出す。止まったら知らせて終わる)
  for (let lastMs = -1, lastAt = Date.now(), shown = 0; ;) {
    const ms = await page.evaluate(() => window.__mhTestHooks?.rhythmSongMs?.() ?? null).catch(() => null);
    if (ms != null && ms >= FROM - 1500) break;
    if (ms != null && ms > lastMs + 1) { lastMs = ms; lastAt = Date.now(); }
    if (Date.now() - lastAt > 60000) {
      if (process.env.PROMO_DEBUG) { await page.screenshot({ path: path.join(OUT, 'stalled.png') }).catch(() => {}); console.log((await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => '')) ); }
      throw new Error(`曲の時刻が1分進まない(${lastMs}ms)`);
    }
    if (Date.now() - shown > 30000) { shown = Date.now(); if (process.env.PROMO_DEBUG) console.log(`  …曲 ${ms == null ? '-' : (ms / 1000).toFixed(1)}秒`); }
    await new Promise(r => setTimeout(r, 500));
  }
  await setRate(SLOW);
  const RATE = SLOW < 1 ? SLOW : 1;
  const frames = []; let n = 0, writing = Promise.resolve();
  cdp.on('Page.screencastFrame', (ev) => {
    const file = `f${String(n++).padStart(6, '0')}.jpg`;
    frames.push({ file, wall: ev.metadata.timestamp * 1000 });
    writing = writing.then(() => fs.promises.writeFile(path.join(OUT, file), Buffer.from(ev.data, 'base64')));
    cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: Number(arg('q', 94)), maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
  // 区間の終わり(+0.6秒)か、曲が終わる(演奏の読み取り口が消える)まで。判定は消える前に控えておく
  const judge = () => page.evaluate(() => { const h = window.__mhTestHooks || {}; if (!h.rhythmNoteResults) return null; const r = h.rhythmNoteResults() || []; const notes = h.rhythmNotes?.() || [];
    const bad = r.filter(x => x.judgment === 'MISS' || x.holdJudgment === 'MISS' || x.releaseJudgment === 'MISS');
    return { ms: window.__promoEnded ? null : (h.rhythmSongMs?.() ?? null), miss: bad.length, done: r.filter(x => x.judgment).length, where: bad.slice(0, 8).map(x => { const n = notes.find(m => m.index === x.index) || {}; return `${((n.timeMs || 0) / 1000).toFixed(2)}s ${n.type || '?'}`; }).join(', ') }; }).catch(() => null);
  let res = {};
  // 曲が終わったあと(全部の判定が済んで「ALL MARVELOUS」などが出る所)も、区間の終わりまでは壁の時計で撮り続ける
  let endWall = null;
  for (;;) {
    const j = await judge();
    if (j && j.ms != null && !endWall) { res = j; if (j.ms >= TO + 600) break; }
    else { if (!endWall) { const last = await page.evaluate(() => { const l = window.__promoClock; return l[l.length - 1]; }); endWall = last[0] + (TO + 600 - last[1]) / RATE; }
      if (Date.now() >= endWall) break; }
    await page.waitForTimeout(100);
  }
  await cdp.send('Page.stopScreencast');
  await writing;
  const clock = await page.evaluate(() => window.__promoClock);
  await context.close(); await browser.close();
  // 壁の時計 → 曲の時刻(前後の控えで直線に補う)
  const songAt = (wall) => {
    let lo = 0, hi = clock.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (clock[mid][0] <= wall) lo = mid; else hi = mid; }
    if (wall >= clock[clock.length - 1][0]) { const [wl, ml] = clock[clock.length - 1]; return ml + (wall - wl) * RATE; }   // 曲が終わったあとのコマ(区間の外になる)
    const [w0, m0] = clock[lo], [w1, m1] = clock[hi];
    return w1 === w0 ? m0 : m0 + (m1 - m0) * (wall - w0) / (w1 - w0);
  };
  const list = frames.map(f => ({ file: f.file, songMs: Math.round(songAt(f.wall) * 10) / 10 }));
  fs.writeFileSync(path.join(OUT, 'frames.json'), JSON.stringify({ song: SONG, diff: DIFF, from: FROM, to: TO, size: [W * DPR, H * DPR], frames: list }));
  const inWin = list.filter(f => f.songMs >= FROM && f.songMs <= TO).length;
  console.log(`  遅回し ${RATE}倍・${W * DPR}×${H * DPR} / コマ ${list.length}(区間の中 ${inWin}・1秒あたり ${(inWin / ((TO - FROM) / 1000)).toFixed(1)})/ ミス ${res.miss ?? '?'}(判定済み ${res.done ?? '?'}${res.where ? '・' + res.where : ''})→ ${path.relative(ROOT, OUT)}`);
  if (errors.length) console.log('  ページのエラー:', errors.slice(0, 3).join(' / '));
})().catch(e => { console.error(e); process.exit(2); });
