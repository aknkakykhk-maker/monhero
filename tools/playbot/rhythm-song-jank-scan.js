#!/usr/bin/env node
// モンヒロビートの1曲を「頭から終わりまで」ボットに演奏させ、どこでかくつくかを数で出す(2026-11-28・台帳 r1126-100 ワルキューレのかくつき調べ)。
// rhythm-frame-perf.js(決めた区間の関数ごとの時間を見る道具)と同じ開き方・同じボット。違いは、曲を通しで測り、
//   ・1秒ごと: コマの数・33ms超・50ms超・最長、ノーツの密度(その1秒に判定時刻があるノーツ数)、1コマで描いたノーツ数の平均
//   ・30秒ごと: JS の忙しさ・GC(ガベージコレクション)の時間・上位の関数(CDP プロファイラを30秒ずつ区切る)
//   ・ヒープ(JS のメモリ)の増え方: 1秒ごとの使用量 → 最小・最大・最後
//   ・判定のずれ(ボットは時刻ぴったりに押す。ずれは「押してから判定されるまでの遅れ」): 平均・95%・最大、MISS の数
//   ・曲の時計の進み方(RHYTHM_PERF): 進まなかったコマの割合・1コマで飛んだ最大
// を出すこと。本物の Supabase へは1件も送らない(偽の Supabase)。保存も新しいセーブの中だけ。
//
// 使い方(先に node tools/build.js):
//   node tools/playbot/rhythm-song-jank-scan.js --song walkure --diff MASTER --cpu 4
//   --out <file.json>   結果を JSON で書く(前後の表を作るとき)
//   --root <フォルダ>   別の作業場所(git worktree)のゲームを測る(直す前の版を測るとき)
//   --landscape 1       横(844x390)で測る。既定は縦(390x844・社長の iPhone の持ち方)
//   --to <ms>           途中で止める(試し用)
//   --alloc 1           どこでメモリを作っているか(CDP のヒープのサンプリング)の上位も出す。少し重くなるので前後の比べには使わない
//   --lines <関数名>    その関数の中で時間を食っている行(compiled の行番号)を出す
//   --dense <ms>        いちばんノーツの密な区間(その長さ)だけ測る(from・to を自動で決める)
//   --from <ms>         その時刻から測る(曲の頭からボットが叩き、測るのは from〜to だけ)
//   --ls '{"k":"v"}'    測る前に localStorage へ入れる(値は文字のまま)
//   見た目の計算(スタイル・配置)の時間も出す(CDP Performance.getMetrics の RecalcStyleDuration・LayoutDuration)
//   --draw webgl        ノーツを WebGL で描く(iPhone は GPU があるので自動でこちら。手元は GPU が無いので既定は 2D)
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const ROOT = path.resolve(arg('root', ROOT_DEFAULT));
const SONG = arg('song', 'walkure'), DIFF = arg('diff', 'MASTER'), CPU = Number(arg('cpu', 4));
const LINES = arg('lines', ''), DRAW = arg('draw', ''), ALLOC = arg('alloc', '0') === '1';
const LAND = arg('landscape', '0') === '1', OUT = arg('out', ''), DENSE = Number(arg('dense', 0)) || 0;
let TO = Number(arg('to', 0)) || 0, FROM = Number(arg('from', 0)) || 0;
// --ls '{"キー":"値"}' … 測る前に localStorage へ入れる(設定の前後を比べる・2026-11-28 r1128-071)
// --set '{"judgmentTextDisplay":false}' … 演奏の設定(mh_rhythm_settings_v1)の一部だけ変える(比べるとき用)
// --bot 0 … ボットに押させない(全部ミス。押したときだけ走る処理を外して比べる)
const BOT = arg('bot', '1') !== '0';
// --inval 1 … 測る区間の頭の5秒だけ、スタイルを計算し直させた書き換え(要素・属性)をブラウザの記録(トレース)から数えて上位を出す
const INVAL = arg('inval', '0') === '1';
const SET = (() => { try { const v = JSON.parse(arg('set', '{}')); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
const LS = (() => { try { const v = JSON.parse(arg('ls', '{}')); return v && typeof v === 'object' ? v : {}; } catch { return {}; } })();
const W = LAND ? 844 : 390, H = LAND ? 390 : 844;
const req = (m) => { try { return require(path.join(ROOT_DEFAULT, 'tools/node_modules', m)); } catch { return require(m); } };
const { chromium } = req('playwright');
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT_DEFAULT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));

const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_rhythm_owned_songs_v1', [${JSON.stringify(songId)}]);
  localStorage.setItem('mh_rhythm_perf_v1', '1');
  ${Object.keys(SET).length ? `try { const k = 'mh_rhythm_settings_v1'; const cur = JSON.parse(localStorage.getItem(k) || '{}') || {}; localStorage.setItem(k, JSON.stringify({ ...cur, ...${JSON.stringify(SET)} })); } catch (e) {}` : ''}
  ${Object.entries(LS).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(String(v))});`).join(' ')}
  ${DRAW ? `localStorage.setItem('mh_rhythm_canvas_v1', ${JSON.stringify(DRAW)});` : ''}
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const r = route.request(), u = r.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) {
      if (r.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return route.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(route);
    }
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  // 音を広げた(decodeAudioData)時刻を控える。長い曲(8分超)は演奏中も約20秒ごとに次の区切りを広げるので、その前後のコマを別に数える
  await context.addInitScript(() => {
    window.__dec = []; const P = (window.BaseAudioContext || window.AudioContext).prototype, orig = P.decodeAudioData;
    P.decodeAudioData = function (buf, ok, ng) { const t0 = performance.now(), bytes = buf ? buf.byteLength : 0; const p = orig.call(this, buf, ok, ng);
      const mark = () => { const s = window.__mhTestHooks?.rhythmSongMs?.(); window.__dec.push({ t0, t1: performance.now(), song: s == null ? null : Math.round(s), bytes }); };
      if (p && p.then) p.then(mark, mark); return p; };
  });
  await context.addInitScript(seed(SONG));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 120000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 120000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 60000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
  await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
  const name = await page.evaluate((id) => (RHYTHM_SONGS.find(s => s.songId === id) || {}).displayName || id, SONG);
  const picked = await page.evaluate((nm) => { const rows = [...document.querySelectorAll('[data-rhythm-song-row]')]; const r = rows.find(x => (x.querySelector('[data-rhythm-song-row-title]')?.textContent || '').trim().startsWith(nm)); if (r) { r.scrollIntoView(); r.click(); } return { rows: rows.length, ok: !!r }; }, name);
  if (!picked.ok) throw new Error(`曲の行が見つからない(${name}・行${picked.rows})`);
  await page.waitForTimeout(1200);
  await page.evaluate((id) => document.querySelector(`[data-rhythm-song-version="${id}"]`)?.click(), SONG); await page.waitForTimeout(800);
  await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-difficulty="${d}"]`) || [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith(d)); b?.click(); }, DIFF); await page.waitForTimeout(800);
  const chosen = await page.evaluate(() => ({ ver: document.querySelector('[data-rhythm-song-version][aria-pressed="true"]')?.dataset.rhythmSongVersion || '', txt: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200) }));
  if (process.env.SCAN_DEBUG) console.log('選んだ様子', chosen);
  const started = await clickText('^(▶\\s*)?決定$');
  if (!started) throw new Error(`曲を始められなかった(${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 60000, polling: 100 });
  const notes = await page.evaluate(() => window.__mhTestHooks.rhythmNotes().map(n => n.timeMs));
  if (DENSE > 0) { const t = notes.slice().sort((x, y) => x - y); let best = 0, at = 0; for (let i = 0, j = 0; i < t.length; i++) { while (t[i] - t[j] > DENSE) j++; if (i - j + 1 > best) { best = i - j + 1; at = t[j]; } } FROM = Math.max(1, Math.floor(at)); TO = FROM + DENSE; console.log(`いちばん密な${DENSE / 1000}秒: ${(FROM / 1000).toFixed(1)}〜${(TO / 1000).toFixed(1)}秒 ${best}ノーツ`); }
  const backend = await page.evaluate(() => document.querySelector('[data-rhythm-note-backend]')?.dataset.rhythmNoteBackend || '?');
  const head = await page.evaluate(() => (document.querySelector('[data-rhythm-play-area]')?.closest('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 80));
  console.log(`演奏: ${SONG} ${DIFF} ノーツ ${notes.length} / 描き方 ${backend} / ${head}`);
  // 1コマごとの記録: [曲の時刻, コマの間隔, 描いたノーツ数, 見たノーツ数, tick の ms]
  await page.evaluate(() => {
    window.__ft = []; window.__heap = []; let last = performance.now(), pend = [0, 0, 0];
    const P = RHYTHM_PERF; const n0 = P.notes.bind(P), t0 = P.tick.bind(P);
    P.notes = (s, d, h, w) => { pend[0] = d; pend[1] = s; return n0(s, d, h, w); };
    P.tick = (ms, dl) => { pend[2] = ms; return t0(ms, dl); };
    const tick = (t) => { const s = window.__mhTestHooks?.rhythmSongMs?.(); if (s != null) window.__ft.push([Math.round(s), Math.round((t - last) * 10) / 10, pend[0], pend[1], Math.round(pend[2] * 10) / 10]); last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    setInterval(() => { const s = window.__mhTestHooks?.rhythmSongMs?.(); if (s != null && performance.memory) window.__heap.push([Math.round(s), performance.memory.usedJSHeapSize]); }, 1000);
  });
  const target = 'const p = fingerAt(c, hab, null, now);';
  const src = installPlayer.toString();
  const player = src.includes(target) ? src.replace(target, 'const p = (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : 0; if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();') : src;
  if (BOT) await page.evaluate(`(${player})(${JSON.stringify({ sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource })})`);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  if (ALLOC) { await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }); }
  const segs = [], lineTicks = new Map();
  const endMs = TO || (await page.evaluate(() => { const n = window.__mhTestHooks.rhythmNotes(); return Math.max(...n.map(x => Number(x.endTimeMs) || Number(x.timeMs) || 0)) + 1500; }));
  const songMs = () => page.evaluate(() => window.__mhTestHooks?.rhythmSongMs?.() ?? -1);
  if (FROM > 0) await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a, FROM, { timeout: 900000, polling: 200 });
  await cdp.send('Performance.enable');
  const metric = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); const m = Object.fromEntries(metrics.map(x => [x.name, x.value])); return { style: m.RecalcStyleDuration || 0, layout: m.LayoutDuration || 0, script: m.ScriptDuration || 0, task: m.TaskDuration || 0, t: m.Timestamp || 0 }; };
  const m0 = await metric();
  if (INVAL) {
    const evs = []; cdp.on('Tracing.dataCollected', (e) => evs.push(...e.value));
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.invalidationTracking'] } });
    await page.waitForTimeout(5000);
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done;
    const cnt = new Map(); let recalc = 0, recalcMs = 0;
    for (const e of evs) {
      if (e.name === 'UpdateLayoutTree' && e.ph === 'X') { recalc++; recalcMs += (e.dur || 0) / 1000; }
      if (!/Invalidat/.test(e.name)) continue; const d = (e.args && e.args.data) || {};
      const k = `${e.name.replace('StyleInvalidatorInvalidationTracking', 'SI').replace('StyleRecalcInvalidationTracking', 'SR').replace('ScheduleStyleInvalidationTracking', 'SS')} ${d.nodeName || ''} ${d.changedAttribute || d.changedId || d.changedClass || d.changedPseudo || ''} ${d.reason || d.invalidationSet?.[0]?.id || ''}`.replace(/\s+/g, ' ').trim();
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
    console.log(`  スタイルの計算し直し ${recalc}回 ${Math.round(recalcMs)}ms(5秒) / 書き換えの上位:`);
    [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, n]) => console.log(`    ${n} ${k.slice(0, 160)}`));
  }
  for (;;) {
    const a = await songMs();
    await cdp.send('Profiler.start');
    let b = a;
    for (let k = 0; k < 60; k++) { await page.waitForTimeout(500); b = await songMs(); if (b < 0 || b >= endMs || b - a >= 30000) break; }
    const { profile } = await cdp.send('Profiler.stop');
    const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
    const self = new Map(); profile.samples.forEach((id, k) => self.set(id, (self.get(id) || 0) + (profile.timeDeltas[k] || 0)));
    let busy = 0, gc = 0, wall = 0; const incl = new Map();
    for (const [id, us] of self) {
      wall += us; const fn = byId.get(id).callFrame.functionName;
      if (fn === '(idle)' || fn === '(program)') continue; busy += us; if (fn === '(garbage collector)') gc += us;
      let x = id; const seen = new Set();
      while (x != null) { const key = byId.get(x).callFrame.functionName || '(無名)'; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } x = parent.get(x); }
    }
    const selfTop = [...self].map(([id, us]) => [byId.get(id).callFrame, us]).filter(([c]) => !/^\((idle|program|root)\)$/.test(c.functionName))
      .reduce((m, [c, us]) => { const k = `${c.functionName || '(無名)'}@${(c.url || '').split('/').pop().split('?')[0]}:${c.lineNumber}`; m.set(k, (m.get(k) || 0) + us); return m; }, new Map());
    if (LINES) { profile.nodes.forEach(n => { if (n.callFrame.functionName === LINES) (n.positionTicks || []).forEach(t => { lineTicks.set(t.line, (lineTicks.get(t.line) || 0) + t.ticks); }); }); }
    segs.push({ from: a, to: b, wallMs: wall / 1000, busyMs: busy / 1000, gcMs: gc / 1000,
      top: [...selfTop].sort((p, q) => q[1] - p[1]).slice(0, 8).map(([k, us]) => [k, Math.round(us / 1000)]),
      incl: Object.fromEntries(['tick', 'paintCanvasNote', 'drawNote', 'drawSlide', 'applyJudgment', 'getBoundingClientRect', 'performWorkUntilDeadline', 'commitRoot', 'renderWithHooks'].map(k => [k, Math.round((incl.get(k) || 0) / 1000)])) });
    process.stdout.write(`  ${Math.round(a / 1000)}〜${Math.round(b / 1000)}秒 忙しさ${Math.round(busy / 1000)}ms GC${Math.round(gc / 1000)}ms\n`);
    if (b < 0 || b >= endMs) break;
    if (b <= a) { const res = await page.evaluate(() => (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120)); console.log('  曲の時計が進まない:', res); break; }
  }
  const m1 = await metric();
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  if (ALLOC) {
    const { profile: hp } = await cdp.send('HeapProfiler.stopSampling');
    const m = new Map(); const walk = (n) => { const c = n.callFrame; const k = `${c.functionName || '(無名)'}@${(c.url || '').split('/').pop().split('?')[0]}:${c.lineNumber + 1}`; m.set(k, (m.get(k) || 0) + n.selfSize); (n.children || []).forEach(walk); }; walk(hp.head);
    // 作った量そのものは出ない(サンプリング)。同じ条件での比べと上位の並びだけを見る
    console.log('  メモリを作った所の上位(サンプル):', [...m].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, b]) => `${k} ${(b / 1048576).toFixed(1)}MB`).join(' / '));
  }
  const dec = await page.evaluate(() => window.__dec || []);
  const ft = await page.evaluate(() => window.__ft), heap = await page.evaluate(() => window.__heap);
  const perf = await page.evaluate(() => RHYTHM_PERF.snapshot());
  const results = await page.evaluate(() => window.__mhTestHooks?.rhythmNoteResults?.() || []);
  // 1秒ごと
  const sec = new Map();
  const S = (k) => { if (!sec.has(k)) sec.set(k, { f: 0, o33: 0, o50: 0, max: 0, drawSum: 0, tickSum: 0, dens: 0 }); return sec.get(k); };
  ft.filter(([s]) => s >= FROM && s < endMs).forEach(([s, dt, d, sc, tk]) => { const b = S(Math.floor(s / 1000)); b.f++; if (dt > 33.4) b.o33++; if (dt > 50) b.o50++; if (dt > b.max) b.max = dt; b.drawSum += d; b.tickSum += tk; });
  notes.forEach(t => { if (t >= 0 && t < endMs) S(Math.floor(t / 1000)).dens++; });
  const rows = [...sec].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ s: k, frames: v.f, o33: v.o33, o50: v.o50, max: v.max, draw: v.f ? Math.round(v.drawSum / v.f * 10) / 10 : 0, tick: v.f ? Math.round(v.tickSum / v.f * 10) / 10 : 0, dens: v.dens }));
  const dts = ft.filter(([s]) => s >= FROM && s < endMs).map(([, dt]) => dt).sort((a, b) => a - b);
  // 密度と重さの重なり: 密度の上位25%の秒と、それ以外の秒で 33ms 超の割合を比べる
  const play = rows.filter(r => r.frames > 0), byDens = play.map(r => r.dens).sort((a, b) => a - b), q75 = pct(byDens, .75);
  const rate = (rs) => { const f = rs.reduce((p, r) => p + r.frames, 0); return f ? rs.reduce((p, r) => p + r.o33, 0) / f : 0; };
  const deltas = results.filter(r => r.judgment && r.judgment !== 'MISS' && Number.isFinite(r.deltaMs)).map(r => Math.abs(r.deltaMs)).sort((a, b) => a - b);
  const heapMB = heap.map(([, b]) => b / 1048576);
  const summary = {
    song: SONG, diff: DIFF, cpu: CPU, size: `${W}x${H}`, notes: notes.length, backend,
    frames: dts.length, avgMs: dts.length ? dts.reduce((p, q) => p + q, 0) / dts.length : 0, p95: pct(dts, .95), p99: pct(dts, .99), maxMs: dts[dts.length - 1] || 0,
    o33: dts.filter(d => d > 33.4).length, o50: dts.filter(d => d > 50).length,
    denseRate33: rate(play.filter(r => r.dens >= q75)), sparseRate33: rate(play.filter(r => r.dens < q75)), denseQ75: q75,
    drawAvg: play.length ? play.reduce((p, r) => p + r.draw * r.frames, 0) / Math.max(1, play.reduce((p, r) => p + r.frames, 0)) : 0,
    drawMax: Math.max(0, ...ft.map(x => x[2])),
    busyMsPerSec: segs.reduce((p, s) => p + s.busyMs, 0) / Math.max(1, segs.reduce((p, s) => p + s.wallMs, 0)) * 1000,
    gcMsPerSec: segs.reduce((p, s) => p + s.gcMs, 0) / Math.max(1, segs.reduce((p, s) => p + s.wallMs, 0)) * 1000,
    heapMB: heapMB.length ? { min: Math.min(...heapMB), max: Math.max(...heapMB), first: heapMB[0], last: heapMB[heapMB.length - 1] } : null,
    judge: { n: deltas.length, miss: results.filter(r => r.judgment === 'MISS').length, avg: deltas.length ? deltas.reduce((p, q) => p + q, 0) / deltas.length : 0, p95: pct(deltas, .95), max: deltas[deltas.length - 1] || 0 },
    clock: { stallRate: perf.songStallRate, stepMax: perf.songStepMaxMs, judgeMsAvg: perf.judgeMsAvg, judgeMsMax: perf.judgeMsMax },
    decode: (() => { const at = dec.filter(d => d.song != null && d.song > 0).map(d => d.song); const near = (s) => at.some(a => s >= a - 100 && s < a + 1000);
      const all = ft.filter(([s]) => s >= FROM && s < endMs), inW = all.filter(([s]) => near(s)), outW = all.filter(([s]) => !near(s));
      const r = (a) => a.length ? a.filter(([, d]) => d > 33.4).length / a.length : 0;
      return { count: at.length, nearFrames: inW.length, near33: r(inW), other33: r(outW), nearMax: Math.max(0, ...inW.map(x => x[1])) }; })(),
    look: (() => { const sec = Math.max(1e-3, m1.t - m0.t); return { styleMsPerSec: (m1.style - m0.style) * 1000 / sec, layoutMsPerSec: (m1.layout - m0.layout) * 1000 / sec, scriptMsPerSec: (m1.script - m0.script) * 1000 / sec, taskMsPerSec: (m1.task - m0.task) * 1000 / sec }; })(),
    worst: [...rows].sort((a, b) => b.o33 - a.o33 || b.max - a.max).slice(0, 12),
  };
  const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
  console.log(`${SONG} ${DIFF} CPU${CPU}倍 ${W}x${H} ノーツ${notes.length} 描き方${backend}`);
  console.log(`  見た目の計算 スタイル${Math.round(summary.look.styleMsPerSec)}ms/秒・配置${Math.round(summary.look.layoutMsPerSec)}ms/秒 / JS ${Math.round(summary.look.scriptMsPerSec)}ms/秒 / メインスレッドの仕事 ${Math.round(summary.look.taskMsPerSec)}ms/秒`);
  console.log(`  1コマ: ${summary.frames}コマ 平均${f1(summary.avgMs)}ms 95%${f1(summary.p95)} 99%${f1(summary.p99)} 最長${f1(summary.maxMs)}ms 33ms超${summary.o33} 50ms超${summary.o50}`);
  console.log(`  密度上位(1秒${q75}ノーツ以上)の33ms超の割合 ${(summary.denseRate33 * 100).toFixed(1)}% / それ以外 ${(summary.sparseRate33 * 100).toFixed(1)}%`);
  console.log(`  描いたノーツ 平均${f1(summary.drawAvg)}/コマ 最大${summary.drawMax} / 忙しさ ${Math.round(summary.busyMsPerSec)}ms/秒 GC ${f1(summary.gcMsPerSec)}ms/秒`);
  if (summary.heapMB) console.log(`  ヒープ ${f1(summary.heapMB.first)}→${f1(summary.heapMB.last)}MB (最小${f1(summary.heapMB.min)} 最大${f1(summary.heapMB.max)})`);
  console.log(`  判定のずれ(絶対値) 平均${f1(summary.judge.avg)}ms 95%${f1(summary.judge.p95)} 最大${f1(summary.judge.max)} MISS${summary.judge.miss} / 時計 止まり${(summary.clock.stallRate * 100).toFixed(1)}% 最大飛び${f1(summary.clock.stepMax)}ms`);
  console.log(`  音を広げた回数(演奏中) ${summary.decode.count} / その直後1秒の33ms超 ${(summary.decode.near33 * 100).toFixed(1)}%(${summary.decode.nearFrames}コマ・最長${Math.round(summary.decode.nearMax)}ms) / それ以外 ${(summary.decode.other33 * 100).toFixed(1)}%`);
  console.log('  重い秒の上位:', summary.worst.slice(0, 8).map(r => `${r.s}s(33超${r.o33}・最長${Math.round(r.max)}・密度${r.dens}・描${r.draw})`).join(' '));
  const top = new Map(); segs.forEach(s => s.top.forEach(([k, ms]) => top.set(k, (top.get(k) || 0) + ms)));
  console.log('  自分の時間の上位:', [...top].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, ms]) => `${k} ${ms}ms`).join(' / '));
  if (LINES) console.log(`  ${LINES} の行ごと(サンプル数):`, [...lineTicks].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([l, t]) => `${l}行 ${t}`).join(' / '));
  if (errors.length) console.log(`  ページのエラー: ${errors.slice(0, 3).join(' | ')}`);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, rows, segs, heap }, null, 1));
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
