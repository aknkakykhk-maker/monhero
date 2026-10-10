// 長く遊んだときに、メモリが増え続けていないかを測る(2026-10-10・iPhone の Safari で「やっている最中に最初の画面へ戻る」問い合わせの調査用)。
//
//   node tools/memory-soak.js --mode quick  --cycles 8        クイックの周回(AUTO)を8回続ける
//   node tools/memory-soak.js --mode auto  --minutes 10      クイックを AUTO で回し続ける(WAVEが進み、場面のBGMが次々に変わる。負けたら新しい周回へ)
//   node tools/memory-soak.js --mode rhythm --songs 6         モンヒロビートを6曲続けて演奏する
//   node tools/memory-soak.js --mode idle   --minutes 10      HOMEで放っておく(ゲームが勝手に増やしていないか)
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
  await s.context.addInitScript(() => {
    window.__decoded = { count: 0, bytes: 0, list: [] };
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
  const sample = async (label) => {
    // 強制的にごみを片付けてから測る(持ち続けているものだけが数字に出る)
    await cdp.send('HeapProfiler.enable').catch(() => {});
    await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
    const { metrics } = await cdp.send('Performance.getMetrics');
    const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
    const extra = await s.page.evaluate(() => { let diag = null; try { diag = Audio_.diagnose(); } catch (e) {} const d = window.__decoded || { count: 0, bytes: 0 }; return { canvases: document.querySelectorAll('canvas').length, imgs: document.querySelectorAll('img').length, kept: diag ? diag.bufferCount : -1, rate: diag ? diag.sampleRate : 0, decoded: d.count, decodedMB: Math.round(d.bytes / 1048576) }; }).catch(() => ({ canvases: -1, imgs: -1, kept: -1, rate: 0, decoded: 0, decodedMB: 0 }));
    const row = { label, sec: Math.round((Date.now() - t0) / 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), rss: rssMB(), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, canvases: extra.canvases, imgs: extra.imgs, kept: extra.kept, rate: extra.rate, decoded: extra.decoded, decodedMB: extra.decodedMB };
    rows.push(row);
    const first = rows[0];
    console.log(`${String(row.label).padEnd(16)} ${String(row.sec).padStart(5)}秒  heap ${String(row.heapMB).padStart(6)}MB (${row.heapMB - first.heapMB >= 0 ? '+' : ''}${(row.heapMB - first.heapMB).toFixed(1)})  全体 ${String(row.rss).padStart(5)}MB (${row.rss - first.rss >= 0 ? '+' : ''}${row.rss - first.rss})  nodes ${String(row.nodes).padStart(6)} (${row.nodes - first.nodes >= 0 ? '+' : ''}${row.nodes - first.nodes})  listeners ${String(row.listeners).padStart(5)} (${row.listeners - first.listeners >= 0 ? '+' : ''}${row.listeners - first.listeners})  docs ${row.docs}  canvas ${row.canvases} img ${row.imgs}  音: 解いた${row.decoded}本(${row.decodedMB}MB)・持っている${row.kept}本・${row.rate}Hz`);
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
        runs += 1;
        return true;
      };
      let on = await startAuto();
      while (Date.now() < end) {
        await s.wait(30000); n += 1;
        await sample(`AUTO ${n * 30}秒(${runs}周目)`);
        if (!(await inBattle())) {
          // 決着した。結果画面を閉じて、新しい周回へ
          await s.dismissOverlays(10); await s.dismissOverlays(10);
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
