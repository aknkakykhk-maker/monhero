// 長く遊んだときに、メモリが増え続けていないかを測る(2026-10-10・iPhone の Safari で「やっている最中に最初の画面へ戻る」問い合わせの調査用)。
//
//   node tools/memory-soak.js --mode quick  --cycles 8        クイックの周回(AUTO)を8回続ける
//   node tools/memory-soak.js --mode auto  --minutes 10      クイックを AUTO で回し続ける(WAVEが進み、場面のBGMが次々に変わる。負けたら新しい周回へ)
//   node tools/memory-soak.js --mode auto  --minutes 15 --repeat   クイックを AUTO∞ で回し続ける(勝ったらそのまま次の周へ。プレイヤーの「オート無限」と同じ。
//                                                             2026-10-14「クイックでオート無限やってたら気付いたらホームに戻ってた」の調べ。HOMEへ戻っていないかも記録する)
//   node tools/memory-soak.js --mode rhythm --songs 6         モンヒロビートを6曲続けて演奏する
//   node tools/memory-soak.js --mode idle   --minutes 10      HOMEで放っておく(ゲームが勝手に増やしていないか)
//   … --infra-every <回> で Chromium の中の内訳(memory-infra・プロセスごとの部品の大きさ)を取る間隔(既定 20 回ごと・はじめと終わりは必ず)
//   … --snapshot-at 10,40 --snapshot-dir <フォルダ> で、その分を過ぎたときのページのメモリの写しを書き出す(比べるのは tools/heap-snapshot-diff.js)
//   … --bgm-light を足すと、場面のBGMを軽く持つ(デバッグ設定 mh_bgm_light_v1)を入れて測る(2026-10-16)
//
// 合格・不合格の検査ではなく、数字を出す道具。1回ごとに強制的にガベージコレクションをしてから測るので、
// 「あとで片付く一時的なごみ」ではなく「持ち続けているもの」だけが数字に出る。
//   heap … 使っているJSのメモリ(MB) / 全体 … ブラウザ全体の使用メモリ(MB。画像・音・描画の面を含む。ブラウザは1つだけ動かす) / nodes … DOMの数 / listeners … イベントの付け外しが残っている数 / docs … ドキュメントの数
// 先頭の値からの増え方も出す。同じ操作を繰り返しているのに増え続けていたら、どこかで持ち続けている。
// 配信は別の窓で `python3 tools/serve.py 8899` を起動しておく(SMOKE_URL / PORT で変えられる)。
// 音ゲーの演奏・クイックの操作と、遊び慣れた人の下準備は、プレイボット(tools/playbot)の道具をそのまま使う。
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const MODE = argOf('--mode', 'quick');
const CYCLES = Math.max(1, Number(argOf('--cycles', '6')) || 6);
const SONGS = Math.max(1, Number(argOf('--songs', '4')) || 4);
const MINUTES = Math.max(1, Number(argOf('--minutes', '5')) || 5);
const REPEAT = args.includes('--repeat');
const PORT = Number(process.env.PORT || 8899);
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;

let playwright;
try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので動かせません'); process.exit(0); }
const { openSession } = require('./playbot/lib/session');
const { battleScenario, enterQuickBattle } = require('./playbot/scenarios/battle');
const { rhythmScenario } = require('./playbot/scenarios/rhythm');
const { prepareVeteran } = require('./playbot/lib/seeds');

const makeRand = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; };

(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-soak-'));
  const report = { headed: false, shotNo: 0, issues: [], steps: [], screens: new Map(), issueKeys: new Set(), phases: [] };
  const s = await openSession({ playwright, pageUrl: PAGE_URL, port: PORT, out, rand: makeRand(20261010), persona: 'メモリ計測', report });
  // 音の「解いたあとの大きさ」を数える(計測用の見張りで、ゲームには何も足さない)。
  // decodeAudioData が返した AudioBuffer の 長さ×チャンネル×4バイト を足し、曲ごとの大きさも控える
  // --bgm-light: 場面のBGMを軽く持つ(デバッグ設定 mh_bgm_light_v1・2026-10-16)を入れて測る
  if (args.includes('--bgm-light')) await s.context.addInitScript(() => { try { localStorage.setItem('mh_bgm_light_v1', 'on'); } catch (e) {} });
  await s.context.addInitScript(() => {
    // 作られたままになっているものを数える見張り(計測用。ゲームの動きは変えない):
    //   canvas … document.createElement('canvas') で作られた数 / blob … createObjectURL した数 − revokeObjectURL した数 /
    //   timers … setInterval で動き続けているタイマーの数 / sources … createBufferSource した数(音の部品)
    window.__leak = { canvases: 0, blobsMade: 0, blobsRevoked: 0, timers: new Set(), sources: 0, images: 0, ctxs: 0 };
    try {
      const ce = Document.prototype.createElement;
      Document.prototype.createElement = function (tag, ...rest) { if (String(tag).toLowerCase() === 'canvas') window.__leak.canvases += 1; return ce.call(this, tag, ...rest); };
      const cu = URL.createObjectURL.bind(URL), ru = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = (o) => { window.__leak.blobsMade += 1; return cu(o); };
      URL.revokeObjectURL = (u) => { window.__leak.blobsRevoked += 1; return ru(u); };
      const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window);
      window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); window.__leak.timers.add(id); return id; };
      window.clearInterval = (id) => { window.__leak.timers.delete(id); return ci(id); };
      // 描画の面の見張り(2026-10-16 社長「1時間で増える +580MB の正体」): WebGL の文脈・ImageBitmap(作った数と閉じた数)・OffscreenCanvas
      window.__leak.webgl = 0; window.__leak.ctx2d = 0; window.__leak.bitmaps = 0; window.__leak.bitmapsClosed = 0; window.__leak.offscreen = 0;
      const gc = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...a) { const had = this.__mhCtx; const c = gc.call(this, type, ...a); if (c && !had) { this.__mhCtx = true; if (/webgl/i.test(type)) window.__leak.webgl += 1; else if (type === '2d') window.__leak.ctx2d += 1; } return c; };
      if (window.createImageBitmap) { const cib = window.createImageBitmap.bind(window); window.createImageBitmap = (...a) => cib(...a).then((b) => { window.__leak.bitmaps += 1; return b; }); }
      if (window.ImageBitmap && ImageBitmap.prototype.close) { const cl = ImageBitmap.prototype.close; ImageBitmap.prototype.close = function () { window.__leak.bitmapsClosed += 1; return cl.call(this); }; }
      if (window.OffscreenCanvas) { const OC = window.OffscreenCanvas; window.OffscreenCanvas = function (...a) { window.__leak.offscreen += 1; return new OC(...a); }; window.OffscreenCanvas.prototype = OC.prototype; }
      const OrigImage = window.Image;
      window.Image = function (...a) { window.__leak.images += 1; return new OrigImage(...a); };
      window.Image.prototype = OrigImage.prototype;
      for (const Name of ['AudioContext', 'webkitAudioContext']) {
        const Ctx = window[Name]; if (!Ctx) continue;
        const cbs = Ctx.prototype.createBufferSource;
        Ctx.prototype.createBufferSource = function (...a) { window.__leak.sources += 1; return cbs.apply(this, a); };
      }
    } catch (e) {}
    window.__decoded = { count: 0, bytes: 0, list: [] };
    // どの音を何回取りに行ったか(同じ音を取り直していないか)。fetch の宛先のうち .mp3 だけ数える
    window.__audioFetch = {};
    try {
      const of = window.fetch.bind(window);
      window.fetch = (input, init) => { try { const u = String(typeof input === 'string' ? input : input.url).split('?')[0]; if (/\.mp3$/i.test(u)) window.__audioFetch[u] = (window.__audioFetch[u] || 0) + 1; } catch (e) {} return of(input, init); };
    } catch (e) {}
    const wrap = (Proto) => {
      if (!Proto || !Proto.prototype || !Proto.prototype.decodeAudioData) return;
      const orig = Proto.prototype.decodeAudioData;
      Proto.prototype.decodeAudioData = function (data, ok, ng) {
        const note = (buffer) => { try { const bytes = buffer.length * buffer.numberOfChannels * 4; window.__decoded.count += 1; window.__decoded.bytes += bytes; window.__decoded.list.push(Math.round(bytes / 1048576)); } catch (e) {} return buffer; };
        const p = orig.call(this, data, ok ? (b) => ok(note(b)) : undefined, ng);
        return p && p.then ? p.then(note) : p;
      };
    };
    wrap(window.AudioContext); wrap(window.webkitAudioContext); wrap(window.BaseAudioContext);
  });
  const cdp = await s.context.newCDPSession(s.page);
  await cdp.send('Performance.enable');
  const t0 = Date.now();
  const rows = [];
  // ブラウザ全体の使用メモリ(MB)。JSのヒープに出ない、画像・音の展開済みデータ・描画の面も入る。
  // 計測用のブラウザは1つだけ動かす前提で、playwright の chromium の全プロセスを足す
  const rssMB = () => {
    try {
      const lines = execSync('ps -eo rss,args', { encoding: 'utf8' }).split('\n').filter((l) => /\/opt\/pw-browsers\/.*chrom/i.test(l));
      return Math.round(lines.reduce((sum, l) => sum + (Number(l.trim().split(/\s+/)[0]) || 0), 0) / 1024);
    } catch { return -1; }
  };
  // プロセスの種類ごとの使用メモリ(MB)。browser / renderer(ページ) / gpu-process(描画) / utility(音・通信など)
  const rssByType = () => {
    const out = {};
    try {
      execSync('ps -eo rss,args', { encoding: 'utf8' }).split('\n').filter((l) => /\/opt\/pw-browsers\/.*chrom/i.test(l)).forEach((l) => {
        const kb = Number(l.trim().split(/\s+/)[0]) || 0;
        const type = (l.match(/--type=([a-z-]+)/) || [, 'browser'])[1];
        const sub = (l.match(/--utility-sub-type=([a-zA-Z.]+)/) || [, ''])[1].split('.').pop();
        const key = type === 'utility' && sub ? `utility:${sub}` : type;
        out[key] = (out[key] || 0) + kb / 1024;
      });
    } catch (e) {}
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round(v)]));
  };
  // Chromium の中の内訳(memory-infra)。プロセスごとに、どの部品(v8・blink の部品・画像の展開・描画の面・GPU など)がいくら使っているか
  const INFRA_EVERY = Math.max(1, Number(argOf('--infra-every', '20')) || 20);   // 何回測るごとに内訳を取るか(既定 20 回 = AUTO は 10分ごと)
  const infraRows = [];
  let browserCdp = null;
  const infraDump = async (label) => {
    try {
      if (!browserCdp) browserCdp = await s.context.browser().newBrowserCDPSession();
      const events = [];
      const onData = (e) => { for (const ev of e.value || []) events.push(ev); };
      browserCdp.on('Tracing.dataCollected', onData);
      const done = new Promise((r) => browserCdp.once('Tracing.tracingComplete', r));
      await browserCdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } } });
      await browserCdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' }).catch(() => browserCdp.send('Tracing.requestMemoryDump'));
      await browserCdp.send('Tracing.end');
      await done;
      browserCdp.off('Tracing.dataCollected', onData);
      const names = {};
      for (const ev of events) if (ev.ph === 'M' && (ev.name === 'process_name' || ev.name === 'process_labels') && ev.args) names[ev.pid] = names[ev.pid] || ev.args.name || ev.args.labels;
      const per = {};
      const hex = (v) => (typeof v === 'string' ? parseInt(v, 16) : Number(v)) || 0;
      for (const ev of events) {
        const al = ev.ph === 'v' && ev.args && ev.args.dumps && ev.args.dumps.allocators;
        if (!al) continue;
        const pname = String(names[ev.pid] || ev.pid).replace(/\s+/g, '');
        const bucket = per[pname] = per[pname] || {};
        // blink_gc(画面の部品の置き場)は、使っている分(allocated_objects_size)と確保している分(committed_size)、
        // 置き場所(Space)ごとの使っている分も出す。差は「捨てた跡地を返していない分」
        for (const [name, a] of Object.entries(al)) {
          const m = name.match(/^blink_gc\/main\/heap(?:\/([A-Za-z0-9]+))?$/);
          if (!m || !a || !a.attrs) continue;
          const used = a.attrs.allocated_objects_size ? hex(a.attrs.allocated_objects_size.value) : 0;
          const committed = a.attrs.committed_size ? hex(a.attrs.committed_size.value) : 0;
          if (!m[1]) { if (used) bucket['blink_gc 使用中'] = (bucket['blink_gc 使用中'] || 0) + used; if (committed) bucket['blink_gc 確保'] = (bucket['blink_gc 確保'] || 0) + committed; }
          else if (used) bucket[`blink_gc:${m[1]}`] = (bucket[`blink_gc:${m[1]}`] || 0) + used;
        }
        for (const [name, a] of Object.entries(al)) {
          if (name.includes('/')) continue;   // いちばん上の部品だけ(下の内訳は二重に数えない)
          const size = a && a.attrs && a.attrs.size ? hex(a.attrs.size.value) : 0;
          if (size > 0) bucket[name] = (bucket[name] || 0) + size;

        }
        const totals = ev.args.dumps.process_totals;
        if (totals && totals.resident_set_bytes) bucket['(rss)'] = hex(totals.resident_set_bytes);
      }
      const row = { label, sec: Math.round((Date.now() - t0) / 1000), per: Object.fromEntries(Object.entries(per).map(([p, b]) => [p, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, Math.round(v / 1048576)]))])) };
      infraRows.push(row);
      const first = infraRows[0];
      const lines = [];
      for (const [p, b] of Object.entries(row.per)) {
        const base = first.per[p] || {};
        const parts = Object.entries(b).filter(([k, v]) => v >= 5 || Math.abs(v - (base[k] || 0)) >= 5).sort((x, y) => y[1] - x[1])
          .map(([k, v]) => `${k} ${v}MB${first !== row ? `(${v - (base[k] || 0) >= 0 ? '+' : ''}${v - (base[k] || 0)})` : ''}`);
        if (parts.length) lines.push(`    [${p}] ${parts.join(' / ')}`);
      }
      console.log(`  内訳(memory-infra・${label}・${row.sec}秒):\n${lines.join('\n')}`);
    } catch (e) { console.log(`  内訳を取れませんでした: ${String(e && e.message || e).slice(0, 120)}`); }
  };
  // --snapshot-at 10,40 --snapshot-dir <フォルダ>: その分を過ぎた最初の測りで、ページのメモリの写し(heap snapshot)を書き出す。
  // 比べるのは tools/heap-snapshot-diff.js(増えた部品の種類と、それをつかんでいるもの)
  const SNAP_AT = String(argOf('--snapshot-at', '')).split(',').map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  const SNAP_DIR = argOf('--snapshot-dir', out);
  const takeSnapshot = async (name) => {
    const file = path.join(SNAP_DIR, `${name}.heapsnapshot`);
    fs.mkdirSync(SNAP_DIR, { recursive: true });
    const fd = fs.openSync(file, 'w');
    const onChunk = (e) => fs.writeSync(fd, e.chunk);
    cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
    try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false }); }
    finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk); fs.closeSync(fd); }
    console.log(`  写し: ${file}(${Math.round(fs.statSync(file).size / 1048576)}MB)`);
  };
  let sampleNo = 0;
  const sample = async (label) => {
    // 強制的にごみを片付けてから測る(持ち続けているものだけが数字に出る)
    await cdp.send('HeapProfiler.enable').catch(() => {});
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const extra = await s.page.evaluate(() => { let diag = null; try { diag = Audio_.diagnose(); } catch (e) {} const d = window.__decoded || { count: 0, bytes: 0 }; const l = window.__leak || {}; return { canvases: document.querySelectorAll('canvas').length, imgs: document.querySelectorAll('img').length, kept: diag ? diag.bufferCount : -1, songKept: diag ? diag.songBufferCount : -1, songNames: diag && diag.songBufferNames ? diag.songBufferNames.join(',') : '', rebuilds: diag ? diag.rebuilds : -1, rate: diag ? diag.sampleRate : 0, decoded: d.count, decodedMB: Math.round(d.bytes / 1048576), made: l.canvases || 0, blobs: (l.blobsMade || 0) - (l.blobsRevoked || 0), timers: l.timers ? l.timers.size : -1, sources: l.sources || 0, newImages: l.images || 0, webgl: l.webgl || 0, ctx2d: l.ctx2d || 0, bitmapsAlive: (l.bitmaps || 0) - (l.bitmapsClosed || 0), offscreen: l.offscreen || 0, canvasMB: Math.round([...document.querySelectorAll('canvas')].reduce((sum, c) => sum + (c.width * c.height * 4), 0) / 1048576), imgMB: Math.round([...document.querySelectorAll('img')].reduce((sum, im) => sum + ((im.naturalWidth || 0) * (im.naturalHeight || 0) * 4), 0) / 1048576), imgSrcs: new Set([...document.querySelectorAll('img')].map((im) => im.currentSrc || im.src)).size, cssBg: [...document.querySelectorAll('[style*="background-image"]')].length }; }).catch(() => ({ canvases: -1, imgs: -1, kept: -1, rate: 0, decoded: 0, decodedMB: 0 }));
    const row = { label, sec: Math.round((Date.now() - t0) / 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), rss: rssMB(), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, canvases: extra.canvases, imgs: extra.imgs, kept: extra.kept, rate: extra.rate, songKept: extra.songKept, songNames: extra.songNames, rebuilds: extra.rebuilds, decoded: extra.decoded, decodedMB: extra.decodedMB, made: extra.made, blobs: extra.blobs, timers: extra.timers, sources: extra.sources, newImages: extra.newImages, webgl: extra.webgl, ctx2d: extra.ctx2d, bitmapsAlive: extra.bitmapsAlive, offscreen: extra.offscreen, canvasMB: extra.canvasMB, imgMB: extra.imgMB, imgSrcs: extra.imgSrcs, cssBg: extra.cssBg, procs: rssByType() };
    rows.push(row);
    const first = rows[0];
    sampleNo += 1;
    console.log(`${String(row.label).padEnd(16)} ${String(row.sec).padStart(5)}秒  heap ${String(row.heapMB).padStart(6)}MB (${row.heapMB - first.heapMB >= 0 ? '+' : ''}${(row.heapMB - first.heapMB).toFixed(1)})  全体 ${String(row.rss).padStart(5)}MB (${row.rss - first.rss >= 0 ? '+' : ''}${row.rss - first.rss})  nodes ${String(row.nodes).padStart(6)} (${row.nodes - first.nodes >= 0 ? '+' : ''}${row.nodes - first.nodes})  listeners ${String(row.listeners).padStart(5)} (${row.listeners - first.listeners >= 0 ? '+' : ''}${row.listeners - first.listeners})  docs ${row.docs}  canvas ${row.canvases} img ${row.imgs}  音: 解いた${row.decoded}本(${row.decodedMB}MB)・持っている${row.kept}本(うち曲 ${row.songKept}本・作り直し ${row.rebuilds}回: ${row.songNames})  作ったcanvas ${row.made} blob残り ${row.blobs} Image ${row.newImages} タイマー ${row.timers} 音の部品 ${row.sources}`);
    console.log(`    描画の面: canvas ${row.canvasMB}MB(2d ${row.ctx2d}・WebGL ${row.webgl}・Offscreen ${row.offscreen})・ImageBitmap 残り ${row.bitmapsAlive} / 画像: img ${row.imgMB}MB(${row.imgSrcs}種類)・背景画像の要素 ${row.cssBg} / プロセス: ${Object.entries(row.procs || {}).map(([k, v]) => `${k} ${v}MB(${v - ((first.procs || {})[k] || 0) >= 0 ? '+' : ''}${v - ((first.procs || {})[k] || 0)})`).join('・')}`);
    if (sampleNo === 1 || sampleNo % INFRA_EVERY === 0) await infraDump(label);
    while (SNAP_AT.length && row.sec >= SNAP_AT[0] * 60) { const m = SNAP_AT.shift(); await takeSnapshot(`soak-${m}min`); }
  };
  try {
    // 遊び慣れた人の保存(はじめての設定・案内を済ませてある)で始める。バトル係・音ゲー係と同じ下準備
    await prepareVeteran(s, { quiet: true });
    await s.boot();
    await sample('起動直後');
    if (MODE === 'quick') {
      for (let i = 1; i <= CYCLES; i++) {
        const r = await battleScenario(s, { manualTurns: 0, autoMs: 90000 });
        await sample(`クイック ${i}周`);
        if (!r.ok) console.log(`  (周回が進めなかった: ${r.note || ''})`);
      }
    } else if (MODE === 'auto') {
      const end = Date.now() + MINUTES * 60000;
      let n = 0, runs = 0;
      const inBattle = () => s.page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
      const startAuto = async () => {
        const r = await enterQuickBattle(s, { system: 'systemQuick' });
        if (!r.inBattle) return false;
        await s.page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
        // AUTO のボタンは押すたびに AUTO → AUTO∞ → 切 と変わる。--repeat は2回押して AUTO∞ にする
        if (REPEAT) { await s.wait(400); await s.page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click()); }
        runs += 1;
        return true;
      };
      let on = await startAuto();
      while (Date.now() < end) {
        await s.wait(30000); n += 1;
        if (REPEAT) {
          // AUTO∞ は勝てば自分で次の周へ入る。ボットは何もせず、HOMEへ戻っていないか・読み込み直されていないかだけを見る
          const where = await s.page.evaluate(() => ({ home: !!document.querySelector('.mh-home-scene'), title: /TAP TO START/.test(document.body.innerText), loops: (document.body.innerText.match(/(\d+)\s*周/) || [])[1] || '' })).catch(() => ({ home: false, title: false, loops: '' }));
          if (process.env.SOAK_SHOT_DIR) await s.page.screenshot({ path: path.join(process.env.SOAK_SHOT_DIR, `repeat-${n}.png`) }).catch(() => {});
          await sample(`AUTO∞ ${n * 30}秒${where.loops ? `(${where.loops}周)` : ''}${where.home ? ' ★HOME' : ''}${where.title ? ' ★タイトル' : ''}`);
          if (where.home || where.title) { console.log('  (HOMEかタイトルへ戻った)'); break; }
          continue;
        }
        await sample(`AUTO ${n * 30}秒(${runs}周目)`);
        if (!(await inBattle())) {
          // 決着した。結果画面を閉じて、新しい周回へ
          await s.dismissOverlays(10); await s.dismissOverlays(10);
          await s.backHome().catch(() => {});
          on = await startAuto();
          if (!on) { console.log('  (新しい周回を始められなかった)'); break; }
        }
      }
    } else if (MODE === 'rhythm') {
      for (let i = 1; i <= SONGS; i++) {
        const r = await rhythmScenario(s, { maxSongMs: 240000 });
        await sample(`音ゲー ${i}曲`);
        if (!r.ok) console.log('  (演奏が進めなかった)');
        // 次の曲のために HOME へ戻る
        await s.boot().catch(() => {});
      }
    } else {
      const end = Date.now() + MINUTES * 60000;
      let n = 0;
      while (Date.now() < end) { await s.wait(30000); n += 1; await sample(`放置 ${n * 30}秒`); }
    }
    try {
      const af = await s.page.evaluate(() => window.__audioFetch || {});
      const lines = Object.entries(af).sort((a, b) => b[1] - a[1]).map(([u, n]) => `${n}回 ${u.split('/').pop()}`);
      console.log(`\n音の取りに行った回数(多い順。2回以上は取り直し): ${lines.join(' / ')}`);
    } catch (e) {}
    await infraDump('終わり');
    const first = rows[0], last = rows[rows.length - 1];
    console.log(`\nまとめ: ${last.sec}秒で heap ${first.heapMB}→${last.heapMB}MB / ブラウザ全体 ${first.rss}→${last.rss}MB / nodes ${first.nodes}→${last.nodes} / listeners ${first.listeners}→${last.listeners} / docs ${first.docs}→${last.docs}`);
    const errs = report.issues.filter((x) => x.level === '不具合候補');
    if (errs.length) console.log(`ボットが見つけた不具合候補: ${errs.length}件(${errs.map((x) => x.kind).join(', ')})`);
  } catch (e) {
    console.log('NG: 計測中に止まった —', String(e && e.message || e).split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await s.close().catch(() => {});
  }
})();
