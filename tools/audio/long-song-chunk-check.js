// 長い曲を区切って鳴らす仕組み(14-audio.jsx の openLongSong・2026-11-23 r1119-125)を、実際のブラウザで鳴らして測る。
//
//   node tools/audio/long-song-chunk-check.js
//
// 【なぜ要るか】
// ワルキューレの原曲(約11分32秒)は、丸ごと広げると約250MBになり、スマホで「音源を再生できません」になっていた。
// いまは LONG_SONG_SEC より長い曲だけ、約20秒ずつ広げて Web Audio の時刻どおりにつなげて鳴らす。
// つなぎ目で音が切れる・重なる、曲の時刻(判定・譜面の進み)がずれる、が起きると演奏が壊れるので、
// 実際に鳴っている音を録って、丸ごと広げた音(手本)と突き合わせる。
//   ・短い曲(ショート版)は、これまでどおり丸ごと広げる(区切らない)
//   ・長い曲は区切って鳴らし、持っている区切りは3つまで
//   ・曲の長さが丸ごとのときと同じ
//   ・頭・つなぎ目の前後・途中・終わりで、「曲の時刻」と「鳴っている音」の関係が、丸ごとのときと同じ(ずれ 1ms 未満)
//   ・つなぎ目の前後で、時刻が飛ばない(0.5ms 未満)
//   ・つなぎ目のまわりで、手本との差が他の所と同じくらい小さい(音切れ・二重鳴りが無い)
//   ・一時停止・再開、10秒戻す(seek)のあとも時刻がずれない。終わりまで鳴ると ended になる
// 実時間で鳴らすので1分半ほどかかる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 9193;
const LONG_ID = 'melo_walkure', SHORT_ID = 'melo_walkure_short', LONG_SRC = 'audio/bgm-walkure.mp3';
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ページの中で使う道具。録る音は2つ:
//   左 … ゲームが出口へ流している音(モノラルにまとめる)
//   右 … 手本(丸ごと広げた原曲)を、ゲームの「曲の時刻」の式どおりの位置に置いて同時に鳴らした音
// 同じ録音の中で左右を突き合わせるので、録音の時刻の揺れに左右されず、「曲の時刻」と鳴っている音のずれが出る
const pageTools = () => {
  window.__rec = { on: false, blocks: [] };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (dest instanceof AudioDestinationNode && !this.__mhTapSelf) {
        const ctx = dest.context;
        if (!ctx.__tap) {
          const merger = ctx.createChannelMerger(2), sp = ctx.createScriptProcessor(4096, 2, 2);
          const game = ctx.createGain(); game.channelCount = 1; game.channelCountMode = 'explicit';
          const ref = ctx.createGain(); ref.channelCount = 1; ref.channelCountMode = 'explicit';
          orig.call(game, merger, 0, 0); orig.call(ref, merger, 0, 1); orig.call(merger, sp);
          sp.__mhTapSelf = true; orig.call(sp, dest);
          sp.onaudioprocess = (e) => { if (!window.__rec.on) return; window.__rec.blocks.push({ L: new Float32Array(e.inputBuffer.getChannelData(0)), R: new Float32Array(e.inputBuffer.getChannelData(1)) }); };
          ctx.__tap = { game, ref }; window.__mhCtx = ctx;
        }
        // 元の出口にもつなぐ(鳴り方は変えない)
        orig.call(this, ctx.__tap.game);
      }
    } catch (e) {}
    return orig.call(this, dest, ...rest);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // h を鳴らしたまま、手本を「曲の時刻」の位置に置いて sec 秒録る
  window.__record = async (h, sec) => {
    const ctx = window.__mhCtx, lat = (Number(h.info().outLatMs) || 0) / 1000;
    const src = ctx.createBufferSource(); src.buffer = window.__ref; src.__mhTapSelf = true; src.connect(ctx.__tap.ref);
    // 耳に届く位置 = rawSongTime。出口へ送る位置はそれに lat を足した所
    const now = ctx.currentTime, at = now + 0.12, pos = h.rawSongTimeMs() / 1000 + lat + 0.12;
    src.start(at, pos);
    await sleep(130);
    window.__rec.blocks = []; window.__rec.on = true;
    await sleep(sec * 1000);
    window.__rec.on = false; try { src.stop(); src.disconnect(); } catch (e) {}
    const bl = window.__rec.blocks, n = bl.reduce((x, b) => x + b.L.length, 0), L = new Float32Array(n), R = new Float32Array(n);
    let o = 0; for (const b of bl) { L.set(b.L, o); R.set(b.R, o); o += b.L.length; }
    // 右(手本)の中身から、録った1サンプル目が曲のどこかを決める(手本の丸ごとの音と突き合わせる)
    return { L, R, rate: ctx.sampleRate, };
  };
  // 録った音の [i0, i0+len) で、左(ゲーム)が右(手本)から何 ms ずれているか(+ はゲームが遅れている)と、合わせたあとの差の大きさ
  window.__lagLR = (rec, i0, len, W = 2048) => {
    const B = rec.L, A = rec.R; let bi = 0, bs = -Infinity; const sc = {};
    const D = 8; let cd = 0, cb = -Infinity;
    for (let L = -W; L <= W; L += D) { let t = 0; for (let i = 0; i < len; i += 4) { const k = i0 + i - L; if (k >= 0 && k < A.length) t += A[k] * B[i0 + i]; } if (t > cb) { cb = t; cd = L; } }
    for (let L = cd - D; L <= cd + D; L++) { let t = 0; for (let i = 0; i < len; i++) { const k = i0 + i - L; if (k >= 0 && k < A.length) t += A[k] * B[i0 + i]; } sc[L] = t; if (t > bs) { bs = t; bi = L; } }
    let frac = 0; if (sc[bi - 1] !== undefined && sc[bi + 1] !== undefined) { const den = sc[bi - 1] - 2 * sc[bi] + sc[bi + 1]; if (den < 0) frac = 0.5 * (sc[bi - 1] - sc[bi + 1]) / den; }
    let es = 0, er = 0; for (let i = 0; i < len; i++) { const x = A[i0 + i - bi] || 0, y = B[i0 + i]; es += x * x; er += (y - x) * (y - x); }
    return { ms: (bi + frac) / rec.rate * 1000, resid: es > 0 ? Math.sqrt(er / es) : 0, rms: Math.sqrt(es / len) };
  };
  // ずれを決めたまま、手本との差の大きさと、1ms ごとの音の大きさの手本に対する比(いちばん小さい・大きい)。
  // 音切れがあると比が 0 に近づき、二重に鳴ると 2 に近づく
  window.__levelLR = (rec, i0, len, lagMs) => {
    const w = Math.round(rec.rate / 1000), sh = Math.round(lagMs / 1000 * rec.rate);
    let lo = Infinity, hi = 0, es = 0, er = 0;
    for (let s = 0; s + w <= len; s += w) { let a = 0, b = 0; for (let i = 0; i < w; i++) { const x = rec.R[i0 + s + i - sh] || 0, y = rec.L[i0 + s + i]; a += x * x; b += y * y; es += x * x; er += (y - x) * (y - x); } if (a / w < 1e-6) continue; const q = Math.sqrt(b / a); lo = Math.min(lo, q); hi = Math.max(hi, q); }
    return { lo: lo === Infinity ? 1 : lo, hi: hi || 1, resid: es > 0 ? Math.sqrt(er / es) : 0, ms: lagMs, rms: Math.sqrt(es / len) };
  };
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_update_notice_seen_v1', true);
    });
    await page.addInitScript(pageTools);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000, force: true });
    await page.waitForTimeout(1500);
    await page.evaluate(() => Audio_.stopBGM());

    // 短い曲は区切らない
    const short = await page.evaluate(async (id) => { const h = await Audio_.startRhythmTrack(id, 100, { autoStart: false }); const r = h ? { ok: true, chunked: !!h.info().chunked, sec: h.durationMs / 1000 } : { ok: false }; h && h.stop(); return r; }, SHORT_ID);
    check('ショート版は、これまでどおり丸ごと広げて鳴らす', short.ok && !short.chunked, JSON.stringify(short));

    // 手本: 丸ごと広げた原曲(同じ AudioContext で広げる)
    await page.evaluate(async (src) => { window.__ref = await window.__mhCtx.decodeAudioData(await (await fetch(src)).arrayBuffer()); }, LONG_SRC);
    const refSec = await page.evaluate(() => window.__ref.duration);

    // 1回ぶんの測り: 頭・最初のつなぎ目(続けて鳴らす)・途中のつなぎ目と一時停止・10秒戻す・終わり
    const measure = (label) => page.evaluate(async ({ id, label }) => {
      const out = { label, points: [] };
      const h = await Audio_.startRhythmTrack(id, 100, { autoStart: false });
      if (!h) return { label, fail: 'startRhythmTrack が null' };
      const info0 = h.info(); out.chunked = info0.chunked || null; out.sec = h.durationMs / 1000;
      const seam = (k) => (info0.chunked ? k * info0.chunked.chunkSec + info0.chunked.offsetMs / 1000 : k * 20.0 + 0);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // 録音の1サンプル目の曲の時刻は、録り始めの rawSongTime でおおよそ決める(窓の置き場所に使うだけ。ずれの値は左右の突き合わせで出す)
      const rec0 = async (sec) => { const t = h.rawSongTimeMs() / 1000 + 0.13; const r = await window.__record(h, sec); r.song0 = t; return r; };
      const take = (name, rec, at) => { const len = Math.round(0.3 * rec.rate), i0 = Math.round((at - rec.song0) * rec.rate); if (i0 < 2048 || i0 + len + 2048 > rec.L.length) { out.points.push({ name, at, ms: NaN, resid: NaN, rms: 0 }); return { ms: NaN }; } const m = window.__lagLR(rec, i0, len); out.points.push({ name, at, ...m }); return m; };
      const seamCheck = (name, rec, s) => {
        const before = take(name + '・前', rec, s - 0.4); take(name + '・後', rec, s + 0.1);
        const i0 = Math.round((s - 0.03 - rec.song0) * rec.rate), len = Math.round(0.06 * rec.rate);
        out.points.push({ name: name + '・ちょうど', at: s, ...window.__levelLR(rec, i0, len, before.ms) });
      };
      h.start();
      // 頭の区切りの中(曲の頭は静かなので、音のある 8 秒あたり)
      while (h.rawSongTimeMs() / 1000 < 7.5) await sleep(20);
      let rec = await rec0(1.6); take('頭の区切り', rec, 8.0);
      // 最初のつなぎ目まで続けて鳴らす
      const s1 = seam(1);
      while (h.rawSongTimeMs() / 1000 < s1 - 1.0) await sleep(20);
      rec = await rec0(2.2); seamCheck('つなぎ目1', rec, s1);
      out.held1 = h.info().chunked ? h.info().chunked.held : null;
      // 途中のつなぎ目: 手前へ移して、つなぎ目を越えるまで鳴らす
      const k = 17, sk = seam(k);
      await h.seek((sk - 1.2) * 1000); await sleep(100);
      rec = await rec0(2.2); seamCheck('つなぎ目' + k, rec, sk); out.log17 = h.info().chunked ? h.info().chunked.log.slice() : null;
      // 一時停止して再開(つなぎ目の直前で止める)
      const k2 = 18, sk2 = seam(k2);
      while (h.rawSongTimeMs() / 1000 < sk2 - 1.2) await sleep(20);
      h.pause(); await sleep(400); await h.resume(); await sleep(50);
      rec = await rec0(2.2); seamCheck('再開してつなぎ目' + k2, rec, sk2);
      // 10秒戻す(曲鑑賞の戻す)
      const back = h.rawSongTimeMs() / 1000 - 10;
      await h.seek(back * 1000); await sleep(150);
      rec = await rec0(1.4); take('10秒戻した後', rec, back + 0.6);
      out.held2 = h.info().chunked ? h.info().chunked.held : null;
      // 終わり: 最後のつなぎ目の手前へ
      const last = info0.chunked ? info0.chunked.chunks - 1 : Math.floor(out.sec / 20);
      const sl = seam(last);
      await h.seek((sl - 1.2) * 1000); await sleep(100);
      rec = await rec0(2.2); seamCheck('最後のつなぎ目', rec, sl); out.logLast = h.info().chunked ? h.info().chunked.log.slice() : null;
      await h.seek((out.sec - 8.5) * 1000); await sleep(100);
      rec = await rec0(1.6); take('終わりの8秒前', rec, out.sec - 8.0);
      while (!h.ended() && h.rawSongTimeMs() / 1000 < out.sec + 1) await sleep(100);
      await sleep(500);
      out.ended = h.ended(); out.endInfo = h.info().chunked || null;
      h.stop();
      return out;
    }, { id: LONG_ID, label });

    const chunk = await measure('区切り');
    if (chunk.fail) throw new Error(chunk.fail);
    check('原曲は区切って鳴らしている', !!chunk.chunked, chunk.chunked ? `区切り ${chunk.chunked.chunks} 個・1つ ${chunk.chunked.chunkSec.toFixed(2)} 秒・頭のずれ ${chunk.chunked.offsetMs}ms・突き合わせ ${chunk.chunked.probeCorr}` : '');
    check('曲の長さが丸ごとのときと同じ(差 30ms 未満)', Math.abs(chunk.sec - refSec) < 0.03, `${chunk.sec.toFixed(3)} 秒 / 手本 ${refSec.toFixed(3)} 秒`);
    check('持っている区切りは3つまで', chunk.held1 <= 3 && chunk.held2 <= 3, `${chunk.held1} / ${chunk.held2}`);
    check('終わりまで鳴ると ended になる', chunk.ended === true);
    check('つなぎ目の突き合わせのずれが小さい', chunk.endInfo && chunk.endInfo.seamMaxDevMs < 0.5 && chunk.endInfo.late === 0 && chunk.endInfo.failed === 0, JSON.stringify(chunk.endInfo));

    // 途中から鳴らす(マルチの観戦の atMs)・輪にする試聴(曲えらび)
    const extra = await page.evaluate(async (id) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
      let h = await Audio_.startRhythmTrack(id, 100, { atMs: 300000 });
      await sleep(600); out.atStarted = !!(h && h.started()); out.atSec = h ? h.rawSongTimeMs() / 1000 : null; h && h.stop();
      h = await Audio_.startRhythmTrack(id, 100, { loop: true });
      const dur = h.durationMs / 1000; await h.seek((dur - 1.0) * 1000); await sleep(2200);
      out.loopPlaying = h.started(); out.loopSec = h.rawSongTimeMs() / 1000; out.loopEnded = h.ended(); h.stop();
      out.diag = Audio_.diagnose(); return out;
    }, LONG_ID);
    check('途中から鳴らせる(マルチの観戦)', extra.atStarted && extra.atSec > 300 && extra.atSec < 301.5, `${extra.atSec}`);
    check('輪にする試聴は、終わりまで鳴ると頭から鳴り直す', extra.loopPlaying && !extra.loopEnded && extra.loopSec > 0.3 && extra.loopSec < 2, `${extra.loopSec}`);
    // 比べる相手: 同じ曲を丸ごと広げて鳴らしたとき(先に丸ごと読んでおくと、これまでの鳴らし方になる)
    await page.evaluate(async (id) => Audio_.prepareBGM(id, 60000), LONG_ID);
    const whole = await measure('丸ごと');
    if (whole.fail) throw new Error(whole.fail);
    check('丸ごと読んである曲は、これまでどおり丸ごと鳴らす', !whole.chunked);

    console.log('\n  位置                       区切り(ms)  丸ごと(ms)   差(ms)  手本との差(区切り/丸ごと)');
    let maxDiff = 0, maxResidRatio = 0;
    chunk.points.forEach((p, i) => {
      const w = whole.points[i]; const d = p.ms - w.ms; maxDiff = Math.max(maxDiff, Number.isFinite(d) ? Math.abs(d) : Infinity);
      if (w.rms > 0.01) maxResidRatio = Math.max(maxResidRatio, Number.isFinite(p.resid) ? p.resid - w.resid : Infinity);
      console.log(`  ${p.name.padEnd(12, '　')} ${p.ms.toFixed(3).padStart(9)} ${w.ms.toFixed(3).padStart(11)} ${d.toFixed(3).padStart(9)}   ${p.resid.toFixed(4)} / ${w.resid.toFixed(4)}${p.lo !== undefined ? `  音の大きさ ${p.lo.toFixed(2)}〜${p.hi.toFixed(2)}` : ''}`);
    });
    console.log('');
    if (process.env.LONG_LOG) console.log(JSON.stringify({ log17: chunk.log17, logLast: chunk.logLast }));
    check('どの位置も音のある所で測れた', chunk.points.every((p) => p.rms > 0.01), chunk.points.filter((p) => !(p.rms > 0.01)).map((p) => p.name).join(' / '));
    check('どの位置でも、曲の時刻と鳴っている音の関係が丸ごとのときと同じ(差 1ms 未満)', maxDiff < 1, `いちばん大きい差 ${maxDiff.toFixed(3)}ms`);
    const jumps = [];
    for (let i = 0; i + 1 < chunk.points.length; i++) {
      const a = chunk.points[i], b = chunk.points[i + 1];
      if (/・前$/.test(a.name) && /・後$/.test(b.name)) jumps.push(Math.abs(b.ms - a.ms));
    }
    check('つなぎ目の前後で時刻が飛ばない(0.5ms 未満)', jumps.length >= 4 && jumps.every((j) => j < 0.5), jumps.map((j) => j.toFixed(3)).join(' / '));
    const seamPts = chunk.points.filter((p) => p.lo !== undefined);
    check('つなぎ目で音が切れない・重ならない(1ms ごとの大きさが手本の 0.7〜1.4 倍)', seamPts.every((p) => p.lo > 0.7 && p.hi < 1.4), seamPts.map((p) => `${p.lo.toFixed(2)}〜${p.hi.toFixed(2)}`).join(' / '));
    check('つなぎ目のまわりの手本との差が、丸ごとのときと同じくらい(差 0.05 未満)', maxResidRatio < 0.05, maxResidRatio.toFixed(4));
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
