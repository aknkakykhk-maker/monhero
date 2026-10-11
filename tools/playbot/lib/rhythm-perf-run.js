// モンヒロビートの演奏画面を、ボットに1曲演奏させて重さを測る(1回ぶん)。tools/playbot/rhythm-perf-bench.js から使う(2026-10-11)。
// rhythm-frame-perf.js(区間の関数ごとの時間を見る道具)と同じ開き方・同じボットで、次を測る:
//   ・1コマの時間(requestAnimationFrame の間隔): 平均・50/95/99%・最長・16.7ms 超・33.3ms 超・50ms 超の数
//   ・メインスレッドの仕事(CDP Performance.getMetrics): 1コマあたりの ms(全部・JS・スタイル・レイアウト)
//   ・押してから: 判定の処理が終わるまで(処理)と、次のコマが始まるまで(画面に出るまで)。最初のタップは別に出す
//   ・関数ごとの「含む時間」(CDP プロファイラ): ゲームの1コマ(tick)・ノーツを描く(paintCanvasNote)・ボットの分(getBoundingClientRect)
// 本物の Supabase へは1件も送らない(偽の Supabase。プレイの記録・タッチの診断は「断られた」扱い)。保存も新しいセーブの中だけ。
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../../..');
const { chromium } = require(path.join(ROOT_DEFAULT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT_DEFAULT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));

// 描き方: canvas(今の 2D)・webgl(WebGL の描き込み先。帯は CPU で刻む)・gpu(WebGL+帯と区切りの線を GPU に置く)・auto(ゲームの自動)
const DRAW_MODES = { canvas: { canvas: 'canvas', band: '' }, webgl: { canvas: 'webgl', band: '' }, gpu: { canvas: 'webgl', band: 'gpu' }, auto: { canvas: '', band: '' } };

const seed = (songId, mode) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  ${mode.canvas ? `localStorage.setItem('mh_rhythm_canvas_v1', ${JSON.stringify(mode.canvas)});` : `localStorage.removeItem('mh_rhythm_canvas_v1');`}
  ${mode.band ? `localStorage.setItem('mh_rhythm_gpu_band_v1', ${JSON.stringify(mode.band)});` : `localStorage.removeItem('mh_rhythm_gpu_band_v1');`}
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;
// 押してからの時間を測る(演奏エリアの pointerdown だけ)。最初に呼ばれる捕まえ口で始まりを、最後に呼ばれる window の泡の口で終わりを取り、
// そのあと最初のコマの始まり(requestAnimationFrame)までを「画面に出るまで」とする
const tapProbe = () => {
  window.__mhTaps = [];
  const inArea = (e) => { const t = e.target; return !!(t && t.closest && t.closest('[data-rhythm-play-area]')); };
  window.addEventListener('pointerdown', (e) => { if (inArea(e)) e.__mhStart = performance.now(); }, true);
  window.addEventListener('pointerdown', (e) => {
    if (e.__mhStart == null) return;
    const rec = { at: e.timeStamp, start: e.__mhStart, end: performance.now(), frame: null, songMs: window.__mhTestHooks?.rhythmSongMs?.() ?? null };
    window.__mhTaps.push(rec);
    requestAnimationFrame((t) => { rec.frame = t; });
  }, false);
};
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// o: { root, song, diff, entry('select'|'debug'|'proto'), draw('canvas'|'webgl'|'gpu'|'auto'), cpu, landscape, from, to(null=曲の終わりまで), gpuArgs(true=GPU を使う設定で開く),
//      breakdown(true=内訳も返す: 関数の自分の時間の上位・funcs に並べた関数の含む時間・メインスレッドの仕事の種類), funcs }
async function runOnce(o) {
  const ROOT = path.resolve(o.root || ROOT_DEFAULT);
  const mode = DRAW_MODES[o.draw || 'auto'];
  if (!mode) throw new Error(`描き方 ${o.draw} は無い(canvas / webgl / gpu / auto)`);
  const W = o.landscape === false ? 390 : 844, H = o.landscape === false ? 844 : 390;
  // GPU を使う設定: 本物の GPU があれば使い、無ければ Chromium が SwiftShader(CPU で GPU を真似る)にする。どちらだったかは結果の renderer に出す
  const args = ['--autoplay-policy=no-user-gesture-required'];
  if (o.gpuArgs !== false) args.push('--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-webgl');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args });
  try {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: o.dpr || 1, hasTouch: true });
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
    await context.addInitScript(seed(o.song, mode));
    await context.addInitScript(tapProbe);
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
    const renderer = await page.evaluate(() => { try { const c = document.createElement('canvas'), gl = c.getContext('webgl'); if (!gl) return 'WebGL なし'; const i = gl.getExtension('WEBGL_debug_renderer_info'); return String(i ? gl.getParameter(i.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)); } catch (e) { return '不明'; } });
    let started = false;
    const entry = o.entry || 'select';
    if (entry === 'select') {
      await clickText('モンヒロビート$'); await page.waitForTimeout(2500); await closeDialogs(6);
      await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
      const name = await page.evaluate((id) => (RHYTHM_SONGS.find(s => s.songId === id) || {}).displayName || id, o.song);
      await clickText('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); await page.waitForTimeout(1200);
      await clickText(o.diff); await page.waitForTimeout(800);
      started = await clickText('^(▶\\s*)?決定$');
    } else {
      await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
      await clickText('^ヘルプ'); await page.waitForTimeout(900);
      await clickText('💊'); await page.waitForTimeout(1200);
      await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
      started = await page.evaluate(([song, diff, ent]) => {
        if (ent === 'proto') { const b = document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start="${diff}"]`) || document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start]`); if (b) b.click(); return !!b; }
        const sec = [...document.querySelectorAll('section')].find(x => x.querySelector('small') && x.querySelector('small').textContent.trim() === song);
        const art = sec && [...sec.querySelectorAll('article')].find(a => a.textContent.startsWith(diff + ' '));
        const b = art && art.querySelector('[data-rhythm-tap-start]'); if (b) b.click(); return !!b;
      }, [o.song, o.diff, entry]);
    }
    if (!started) throw new Error(`曲を始められなかった(${entry} ${o.song} ${o.diff})`);
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
    const info = await page.evaluate(() => {
      const notes = window.__mhTestHooks.rhythmNotes() || [];
      const end = Math.max(0, ...notes.map(n => Math.max(Number(n.timeMs) || 0, Number(n.endTimeMs) || 0)));
      return { notes: notes.length, first: Math.min(...notes.map(n => Number(n.timeMs) || 0)), end,
        backend: document.querySelector('[data-rhythm-note-backend]')?.dataset.rhythmNoteBackend || '', band: typeof RHYTHM_CANVAS_RENDERER === 'object' ? !!RHYTHM_CANVAS_RENDERER.gpuBand : false };
    });
    // ボット(空中のノーツは空中の高さで押す。rhythm-frame-perf.js と同じ)
    const target = 'const p = fingerAt(c, hab, null, now);';
    const src = installPlayer.toString();
    const player = src.includes(target) ? src.replace(target, 'const p = (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : 0; if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();') : src;
    const botArgs = { sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
    await page.evaluate(`(${player})(${JSON.stringify(botArgs)})`);
    const FROM = Number.isFinite(o.from) ? o.from : Math.max(0, info.first - 1500);
    const TO = Number.isFinite(o.to) ? o.to : info.end + 500;
    await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a - 1500, FROM, { timeout: 600000, polling: 200 });
    // 測るのは CPU を絞ってから(絞るのはメインスレッドだけ。GPU の仕事は絞られない)
    if (o.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: o.cpu });
    await page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push([window.__mhTestHooks?.rhythmSongMs?.(), t - last]); last = t; if (window.__ft.length < 60000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a, FROM, { timeout: 600000, polling: 'raf' });
    await cdp.send('Performance.enable');
    // o.atStart(page, cdp): 測り始めにページを調べる(内訳を出すときの、動いている CSS アニメーションの一覧など)
    const atStart = typeof o.atStart === 'function' ? await o.atStart(page, cdp) : null;
    const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
    // メインスレッドの「CPU を本当に使った時間」(トレースの tdur)。GPU の仕事を待っている間(SwiftShader が遅いと長い)は数えない
    // breakdown のときは、メインスレッドの仕事の種類(スタイル・レイアウト・塗り・JS など)も取る
    await browser.startTracing(page, { categories: o.breakdown ? ['toplevel', 'devtools.timeline', 'blink', 'v8'] : ['toplevel'] });
    const t0 = Date.now();
    // 終わり: 曲の時刻が TO を過ぎた、または曲が終わった(rhythmSongMs が null に戻る)
    await page.waitForFunction((b) => { const ms = window.__mhTestHooks?.rhythmSongMs?.(); return ms == null || ms >= b; }, TO, { timeout: 900000, polling: 'raf' });
    const wallSec = (Date.now() - t0) / 1000;
    const { profile } = await cdp.send('Profiler.stop');
        const trace = JSON.parse((await browser.stopTracing()).toString('utf8'));
    const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    if (o.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const raw = await page.evaluate(() => ({ ft: window.__ft, taps: window.__mhTaps, results: (window.__mhTestHooks?.rhythmNoteResults?.() || []).map(r => ({ done: r.done, j: r.judgment })) }));
    const ft = raw.ft.filter(([ms]) => ms != null && ms >= FROM && ms < TO).map(([, d]) => d).sort((x, y) => x - y);
    const taps = raw.taps.filter(t => t.songMs != null && t.songMs >= FROM && t.songMs < TO);
    const handle = taps.map(t => t.end - t.at).sort((x, y) => x - y), toFrame = taps.filter(t => t.frame != null).map(t => t.frame - t.at).sort((x, y) => x - y);
    const firstTap = raw.taps[0] ? { handle: raw.taps[0].end - raw.taps[0].at, toFrame: raw.taps[0].frame != null ? raw.taps[0].frame - raw.taps[0].at : null } : null;
    // 関数ごとの含む時間
    const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
    const cnt = new Map(); profile.samples.forEach((id, k) => cnt.set(id, (cnt.get(id) || 0) + (profile.timeDeltas[k] || 0)));
    const incl = new Map();
    for (const [id, us] of cnt) {
      let x = id; const seen = new Set();
      while (x != null) { const key = byId.get(x).callFrame.functionName || '(無名)'; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } x = parent.get(x); }
    }
    const frames = ft.length || 1, d = (k) => ((m1[k] || 0) - (m0[k] || 0)) * 1000;
        // 演奏画面のタブのメインスレッド(CrRendererMain)の、いちばん外側の仕事の tdur(CPU 時間)と dur(待ちを含む時間)を足す
        const events = trace.traceEvents || trace;
        const mainTids = new Set(events.filter(e => e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain').map(e => `${e.pid}:${e.tid}`));
        let cpuUs = 0, wallUs = 0;
        const byThread = new Map();
        for (const e of events) {
          if (e.ph !== 'X' || !mainTids.has(`${e.pid}:${e.tid}`) || !/RunTask/.test(e.name)) continue;
          const k = `${e.pid}:${e.tid}`; byThread.set(k, (byThread.get(k) || 0) + (e.dur || 0));
        }
        // いちばん忙しい CrRendererMain が演奏画面のタブ
        const busiest = [...byThread.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        for (const e of events) { if (e.ph === 'X' && `${e.pid}:${e.tid}` === busiest && /RunTask/.test(e.name)) { cpuUs += e.tdur || 0; wallUs += e.dur || 0; } }
    const judged = raw.results.filter(r => r.done);
    // 内訳(o.breakdown): 関数の「自分の時間」の上位・指定した関数の「含む時間」・メインスレッドの仕事の種類ごとの CPU 時間(1コマあたり ms)
    let breakdown = null;
    if (o.breakdown) {
      const self = new Map();
      for (const [id, us] of cnt) { const cf = byId.get(id).callFrame; const key = `${cf.functionName || '(無名)'} ${String(cf.url || '').split('/').pop()}:${cf.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + us); }
      // 仕事の種類: いちばん外側の仕事(RunTask)の中の、ひとつ下の段の出来事ごとに tdur を足す(入れ子の重なりは数えない)
      const kinds = new Map(), kinds2 = new Map();
      const mine = events.filter(e => e.ph === 'X' && `${e.pid}:${e.tid}` === busiest).sort((a, b) => a.ts - b.ts || (b.dur || 0) - (a.dur || 0));
      let task = null; const stack = [];
      for (const e of mine) {
        if (/RunTask/.test(e.name)) { task = e; stack.length = 0; continue; }
        if (!task || e.ts >= task.ts + task.dur) continue;
        while (stack.length && e.ts >= stack[stack.length - 1].ts + stack[stack.length - 1].dur) stack.pop();
        if (!stack.length) kinds.set(e.name, (kinds.get(e.name) || 0) + (e.tdur || e.dur || 0));
        // 2段目(描く準備の中の、スタイル・レイアウト・塗りなど)は「上の段 > 名前」で数える
        else if (stack.length === 1) { const k = `${stack[0].name} > ${e.name}`; kinds2.set(k, (kinds2.get(k) || 0) + (e.tdur || e.dur || 0)); }
        stack.push(e);
      }
      // スレッドごとの CPU 時間(いちばん外側の仕事の tdur)。発熱はメインスレッドだけでなく、合成・ラスタ・GPU の仕事も効く
      const names = new Map(events.filter(e => e.ph === 'M' && e.name === 'thread_name').map(e => [`${e.pid}:${e.tid}`, e.args.name]));
      const procs = new Map(events.filter(e => e.ph === 'M' && e.name === 'process_name').map(e => [e.pid, e.args.name]));
      const threads = new Map();
      for (const e of events) { if (e.ph !== 'X' || !/RunTask|ThreadControllerImpl::RunTask|ThreadPool_RunTask/.test(e.name)) continue; const k = `${procs.get(e.pid) || e.pid}/${names.get(`${e.pid}:${e.tid}`) || e.tid}`; threads.set(k, (threads.get(k) || 0) + (e.tdur || 0)); }
      // ファイルごとの JS の自分の時間(ゲーム本体・音ゲーの描き方・React・ブラウザの中など)
      const byFile = new Map();
      for (const [id, us] of cnt) { const cf = byId.get(id).callFrame; const f = String(cf.url || '').split('/').pop().replace(/\?.*$/, '') || cf.functionName || '(なし)'; byFile.set(f, (byFile.get(f) || 0) + us); }
      const per = (m, div) => [...m.entries()].map(([k, v]) => [k, v / div / frames]).sort((a, b) => b[1] - a[1]);
      // 塗り直した要素(Paint の出来事の nodeId ごとの回数と面積)。毎コマ塗り直す大きな要素が、ラスタ(絵を画素にする仕事)を増やす
      const paints = new Map();
      for (const e of events) { if (e.name !== 'Paint' || !e.args || !e.args.data) continue; const d0 = e.args.data, c = d0.clip || []; const xs = c.filter((_, i) => i % 2 === 0), ys = c.filter((_, i) => i % 2 === 1);
        const area = xs.length ? (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)) : 0; const k = d0.nodeId || 0; const p0 = paints.get(k) || { n: 0, area: 0 }; p0.n++; p0.area += area; paints.set(k, p0); }
      // メイン以外のスレッドの仕事の名前(いちばん外側の1段下)
      const other = new Map();
      { const by = new Map(); for (const e of events) { if (e.ph !== 'X') continue; const k = `${e.pid}:${e.tid}`; if (k === busiest) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
        for (const [k, list] of by) { list.sort((a, b) => a.ts - b.ts || (b.dur || 0) - (a.dur || 0)); let top = null; const tn = `${procs.get(Number(k.split(':')[0])) || ''}/${names.get(k) || ''}`;
          for (const e of list) { if (!top || e.ts >= top.ts + top.dur) { top = e; continue; } if (e.ts >= top.ts && e.ts + (e.dur || 0) <= top.ts + top.dur && e !== top) { const kk = `${tn} ${top.name} > ${e.name}`; other.set(kk, (other.get(kk) || 0) + (e.tdur || e.dur || 0)); top = { ...top, ts: e.ts + (e.dur || 0), dur: top.ts + top.dur - (e.ts + (e.dur || 0)) }; } } } }
      breakdown = { other: [...other.entries()].map(([k, v]) => [k, v / 1000 / frames]).sort((a, b) => b[1] - a[1]).slice(0, 30), paints: [...paints.entries()].sort((a, b) => b[1].area - a[1].area).slice(0, 20).map(([id, v]) => ({ id, n: v.n, areaPerFrame: v.area / frames })), self: per(self, 1000).slice(0, 150), incl: (o.funcs || []).map(k => [k, (incl.get(k) || 0) / 1000 / frames]), long: raw.ft.filter(([ms]) => ms != null && ms >= FROM && ms < TO).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([ms, d]) => [Math.round(ms), Math.round(d)]), kinds: per(kinds, 1000).slice(0, 30), files: per(byFile, 1000).slice(0, 15), kinds2: per(kinds2, 1000).slice(0, 40), threads: per(threads, 1000).slice(0, 20) };
    }
    // o.atEnd(page, cdp, breakdown): 測り終わりにページを調べる(塗り直した要素の名前を引くなど)
    const atEnd = typeof o.atEnd === 'function' ? await o.atEnd(page, cdp, breakdown) : null;
    return {
      song: o.song, diff: o.diff, draw: o.draw || 'auto', cpu: o.cpu || 1, size: `${W}x${H}`, renderer, backend: info.backend, band: info.band,
      range: [FROM, TO], wallSec, notes: info.notes, judged: judged.length, miss: judged.filter(r => r.j === 'MISS').length,
      frames: { n: ft.length, avg: mean(ft), p50: pct(ft, .5), p95: pct(ft, .95), p99: pct(ft, .99), max: ft[ft.length - 1] || 0,
        // 16.7ms(60コマ/秒)・33.3ms(30コマ/秒)を超えたコマ。タイマーの揺れ(±1ms)で数えないよう 1ms の余裕を持たせる
        over16: ft.filter(x => x > 17.7).length, over33: ft.filter(x => x > 34.3).length, over50: ft.filter(x => x > 50).length },
      // メインスレッド(1コマあたり ms)。TaskDuration は全部、ScriptDuration は JS、RecalcStyle/Layout はスタイルとレイアウト
      main: { cpu: cpuUs / 1000 / frames, wall: wallUs / 1000 / frames, task: d('TaskDuration') / frames, script: d('ScriptDuration') / frames, style: d('RecalcStyleDuration') / frames, layout: d('LayoutDuration') / frames,
        busyPct: d('TaskDuration') / (wallSec * 1000) * 100 },
      func: { tick: (incl.get('tick') || 0) / 1000 / frames, paintCanvasNote: (incl.get('paintCanvasNote') || 0) / 1000 / frames, bot: (incl.get('getBoundingClientRect') || 0) / 1000 / frames },
      taps: { n: taps.length, handleAvg: mean(handle), handleP95: pct(handle, .95), frameAvg: mean(toFrame), frameP95: pct(toFrame, .95), first: firstTap },
      errors, breakdown, atStart, atEnd,
    };
  } finally { await browser.close(); }
}
module.exports = { runOnce, DRAW_MODES };
