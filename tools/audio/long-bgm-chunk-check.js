// 長い曲を BGM として流すとき(playBGM・BGMアレンジの試聴)も区切って広げて鳴らす(14-audio.jsx の startBgmLong・2026-11-23 r1119-134)を、
// 実際のブラウザで鳴らして測る。
//
//   node tools/audio/long-bgm-chunk-check.js
//
// 【なぜ要るか】
// ワルキューレの原曲(約11分32秒)は丸ごと広げると約250MBになり、スマホのメモリで広げ切れない。
// 演奏(long-song-chunk-check.js)と同じく、BGM でも約20秒ずつ広げてつなげる。輪にする曲は、
// 終わりの時刻ちょうどに頭の区切りを予約して頭へ戻る。つなぎ目・輪の継ぎ目で音が切れる・重なる・飛ぶと聞いて分かるので、
// 出口へ流れた音を録り、丸ごと広げた音(手本・輪にしたもの)と突き合わせる。
//   ・長い曲の BGM は丸ごと広げない(解いた音の合計が小さい)。鳴っている
//   ・先読み(prepareBGM)も長い曲を丸ごと広げない
//   ・区切りのつなぎ目の前後で、手本とのずれが変わらない(0.05ms 未満)・音の大きさが手本と同じ
//   ・輪の継ぎ目(曲の終わり→頭)の前後で、手本とのずれが変わらない・すき間も重なりも無い
//   ・fadeToBGM でほかの曲へ替えられる・BGMアレンジの試聴(previewBGM)で鳴る・ショート版は今までどおり
// 実時間で鳴らすので1分ほどかかる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 9194;
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

// ページの中の道具: 出口へ流れる音を録る(録った音は途切れなく続いているので、同じ録音の中のずれの比べは正確)
const pageTools = () => {
  window.__rec = { on: false, blocks: [] };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    try {
      if (dest instanceof AudioDestinationNode && !this.__mhTapSelf) {
        const ctx = dest.context;
        if (!ctx.__tap) {
          const sp = ctx.createScriptProcessor(4096, 2, 2); sp.__mhTapSelf = true;
          sp.onaudioprocess = (e) => { if (window.__rec.on) window.__rec.blocks.push([new Float32Array(e.inputBuffer.getChannelData(0)), new Float32Array(e.inputBuffer.getChannelData(1)), e.playbackTime]); };
          orig.call(sp, dest); ctx.__tap = sp; window.__mhCtx = ctx;
        }
        orig.call(this, ctx.__tap);
      }
    } catch (e) {}
    return orig.call(this, dest, ...rest);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__recFor = async (sec) => {
    window.__rec.blocks = []; window.__rec.on = true; await sleep(sec * 1000); window.__rec.on = false;
    const bl = window.__rec.blocks, n = bl.reduce((a, b) => a + b[0].length, 0), mono = new Float32Array(n);
    let o = 0; for (const [l, r] of bl) { for (let i = 0; i < l.length; i++) mono[o + i] = (l[i] + r[i]) * 0.5; o += l.length; }
    // 録音のブロックが抜けた(ページが忙しくて録り損ねた)回数。抜けると録音の中の距離が狂うので、その回は録り直す
    const rate = window.__mhCtx.sampleRate; let dropped = 0;
    for (let i = 1; i < bl.length; i++) if (bl[i][2] - bl[i - 1][2] > 1.5 * bl[i][0].length / rate) dropped++;
    return { mono, rate, dropped };
  };
  // 手本は輪にしたもの(曲の終わりの次は頭)
  const refMono = (from, len) => { const r = window.__ref, a = r.getChannelData(0), b = r.getChannelData(1), N = r.length, out = new Float32Array(len); for (let i = 0; i < len; i++) { const k = ((from + i) % N + N) % N; out[i] = (a[k] + b[k]) * 0.5; } return out; };
  // 録った音の [i0, i0+len) が手本の何サンプル目に当たるか(guess の前後 R を探す)。整数+小数で返す
  window.__posOf = (rec, i0, len, guess, R) => {
    const B = rec.mono.subarray(i0, i0 + len), A = refMono(guess - R - 16, len + 2 * R + 32), D = 8;
    const dec = (x) => { const m = Math.floor(x.length / D), o = new Float32Array(m); for (let i = 0; i < m; i++) { let t = 0; for (let k = 0; k < D; k++) t += x[i * D + k]; o[i] = t; } return o; };
    const Ad = dec(A), Bd = dec(B); let best = -Infinity, bd = 0;
    for (let d = 0; d + Bd.length <= Ad.length; d++) { let t = 0; for (let i = 0; i < Bd.length; i++) t += Ad[i + d] * Bd[i]; if (t > best) { best = t; bd = d; } }
    const c = bd * D, sc = {}; let bi = c, bs = -Infinity;
    for (let L = Math.max(0, c - 16); L <= Math.min(A.length - len, c + 16); L++) { let t = 0; for (let i = 0; i < len; i++) t += A[i + L] * B[i]; sc[L] = t; if (t > bs) { bs = t; bi = L; } }
    let frac = 0; if (sc[bi - 1] !== undefined && sc[bi + 1] !== undefined) { const den = sc[bi - 1] - 2 * sc[bi] + sc[bi + 1]; if (den < 0) frac = 0.5 * (sc[bi - 1] - sc[bi + 1]) / den; }
    // BGM の音量が掛かっているので、大きさ(g)をそろえてから差を見る
    let sxy = 0, sxx = 0; for (let i = 0; i < len; i++) { const x = A[i + bi]; sxy += x * B[i]; sxx += x * x; }
    const g = sxx > 0 ? sxy / sxx : 0;
    let es = 0, er = 0; for (let i = 0; i < len; i++) { const x = A[i + bi] * g; es += x * x; er += (B[i] - x) * (B[i] - x); }
    return { pos: guess - R - 16 + bi + frac, resid: es > 0 ? Math.sqrt(er / es) : 0, rms: Math.sqrt(sxx / len), g };
  };
  // 録った音の i0 から len を、手本の pos0 からと決めたまま比べる。1ms ごとの大きさの比(いちばん小さい・大きい)と差の大きさ
  window.__levelAt = (rec, i0, len, pos0, g = 1) => {
    const w = Math.round(rec.rate / 1000), A = refMono(Math.round(pos0), len).map((x) => x * g); let lo = Infinity, hi = 0, es = 0, er = 0;
    for (let s = 0; s + w <= len; s += w) { let a = 0, b = 0; for (let i = 0; i < w; i++) { const x = A[s + i], y = rec.mono[i0 + s + i]; a += x * x; b += y * y; es += x * x; er += (y - x) * (y - x); } if (a / w < 1e-8) continue; const q = Math.sqrt(b / a); lo = Math.min(lo, q); hi = Math.max(hi, q); }
    return { lo: lo === Infinity ? 1 : lo, hi: hi || 1, resid: es > 0 ? Math.sqrt(er / es) : 0 };
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

    const r = await page.evaluate(async ({ LONG_ID, SHORT_ID, LONG_SRC }) => {
      const sleep = (ms) => new Promise((res) => setTimeout(res, ms)), out = {};
      const playing = () => (Audio_.diagnose().playing || []);
      const waitPlaying = async (kind, key) => { for (let i = 0; i < 100; i++) { if (playing().some((p) => p.kind === kind && p.key === key)) return true; await sleep(100); } return false; };
      Audio_.stopBGM();
      const before = Audio_.diagnose();
      // 先読みは丸ごと広げない
      out.prepared = await Audio_.prepareBGM(LONG_ID, 20000);
      out.prepDecodedMB = Audio_.diagnose().decodedMB - before.decodedMB;
      // 頭から流す
      Audio_.playBGM(LONG_ID);
      out.playing = await waitPlaying('bgm', LONG_ID);
      await sleep(800);
      out.decodedMB = Audio_.diagnose().decodedMB - before.decodedMB;
      out.bufferMB = Audio_.diagnose().bufferMB;
      Audio_.stopBGM();
      // 手本(丸ごと広げた原曲)
      window.__ref = await window.__mhCtx.decodeAudioData(await (await fetch(LONG_SRC)).arrayBuffer());
      const rate = window.__ref.sampleRate, N = window.__ref.length, dur = window.__ref.duration;
      // 録音の中の2つの窓の位置(手本の何サンプル目か)を測り、録音の中の距離と比べる。ずれ = 窓の位置の差 − 録音の中の距離
      const pairCheck = async (from, aSec, bSec, wrap) => {
        for (let t = 0; t < 3; t++) { const r = await pairOnce(from, aSec, bSec, wrap); if (!r.rec.dropped || t === 2) return r; }
      };
      const pairOnce = async (from, aSec, bSec, wrap) => {
        window.__mhTestLongBgmFromSec = from;
        Audio_.playBGM(LONG_ID); await waitPlaying('bgm', LONG_ID); await sleep(150);
        const rec = await window.__recFor(Math.max(aSec, bSec) + 0.8);
        Audio_.stopBGM(); window.__mhTestLongBgmFromSec = null;
        // 録り始めの位置を1つ目の窓で探す(幅広く)
        const len = Math.round(0.25 * rate), iA = Math.round(aSec * rate), iB = Math.round(bSec * rate);
        const guessA = Math.round((from + aSec) * rate);
        const a = window.__posOf(rec, iA, len, guessA, Math.round(0.6 * rate));
        const b = window.__posOf(rec, iB, len, Math.round(a.pos + (iB - iA)) % N, Math.round(0.2 * rate));
        let dpos = b.pos - a.pos; if (wrap) dpos += N; if (a.pos >= N) dpos -= N;
        return { a, b, jumpMs: (dpos - (iB - iA)) / rate * 1000, rec, aPos: a.pos, iA, dropped: rec.dropped };
      };
      // 区切りのつなぎ目(最初の区切り): 20秒あたりの前後
      const seam = await pairCheck(18.6, 0.2, 2.2, false);
      out.seam = { dropped: seam.dropped, jumpMs: seam.jumpMs, residA: seam.a.resid, residB: seam.b.resid, rms: seam.a.rms };
      // つなぎ目のまわり 1ms ごとの大きさ(位置は1つ目の窓から決めたまま)
      { const startPos = seam.aPos - seam.iA; const sIdx = Math.round(20.0098 * rate - startPos); out.seamLevel = window.__levelAt(seam.rec, sIdx - Math.round(0.03 * rate), Math.round(0.06 * rate), startPos + sIdx - Math.round(0.03 * rate), seam.a.g); }
      // 輪の継ぎ目: この曲は終わりの約5.5秒と頭の約2.6秒が無音なので、終わりの 8.2 秒前(音のある所)から流し、
      // 頭へ戻って 5 秒あたり(音のある所)までを録る。2つの窓の間の時刻が、曲の長さぴったり(すき間も重なりも無い)かを見る
      const loop = await pairCheck(dur - 8.2, 0.3, 8.2 + 5.0, true);
      out.loop = { dropped: loop.dropped, jumpMs: loop.jumpMs, residA: loop.a.resid, residB: loop.b.resid, rmsA: loop.a.rms, rmsB: loop.b.rms, posB: loop.b.pos / rate };
      { const startPos = loop.aPos - loop.iA; const eIdx = Math.round(N - startPos); out.loopLevel = window.__levelAt(loop.rec, eIdx - Math.round(0.03 * rate), Math.round(0.06 * rate), N - Math.round(0.03 * rate), loop.a.g); }
      // 曲の切り替え(fadeToBGM)
      Audio_.playBGM(LONG_ID); await waitPlaying('bgm', LONG_ID);
      await Audio_.fadeToBGM(SHORT_ID, 300);
      out.faded = await waitPlaying('bgm', SHORT_ID);
      Audio_.stopBGM();
      // BGMアレンジの試聴
      out.preview = await Audio_.previewBGM(LONG_ID);
      out.previewPlaying = playing().some((p) => p.kind === 'preview' && p.key === LONG_ID);
      Audio_.stopPreview(false);
      out.after = playing();
      return out;
    }, { LONG_ID, SHORT_ID, LONG_SRC });

    check('先読みは長い曲を丸ごと広げない', r.prepared === true && r.prepDecodedMB < 5, `用意 ${r.prepared}・解いた ${r.prepDecodedMB}MB`);
    check('長い曲を BGM として流せる(録った音に曲が入っている)', r.playing && r.seam.rms > 0.01, `鳴っている ${r.playing}・録った音の大きさ ${r.seam.rms}`);
    check('長い曲の BGM は丸ごと広げない(解いた音が 100MB 未満)', r.decodedMB < 100, `${r.decodedMB}MB`);
    check('区切りのつなぎ目の前後で、手本とのずれが変わらない(0.05ms 未満)', Math.abs(r.seam.jumpMs) < 0.05 && r.seam.residA < 0.01 && r.seam.residB < 0.01 && r.seam.rms > 0.01, JSON.stringify(r.seam));
    check('区切りのつなぎ目で音が切れない・重ならない(1ms ごとの大きさが手本の 0.9〜1.1 倍)', r.seamLevel.lo > 0.9 && r.seamLevel.hi < 1.1, JSON.stringify(r.seamLevel));
    check('輪の継ぎ目(終わり→頭)の前後で、手本とのずれが変わらない(0.05ms 未満)', Math.abs(r.loop.jumpMs) < 0.05 && r.loop.residA < 0.01 && r.loop.residB < 0.01 && r.loop.rmsA > 0.001 && r.loop.rmsB > 0.001, JSON.stringify(r.loop));
    check('輪の継ぎ目のまわり(無音)に、よけいな音が入っていない(差 0.01 未満)', r.loopLevel.resid < 0.01, JSON.stringify(r.loopLevel));
    check('fadeToBGM でほかの曲へ替えられる', r.faded === true);
    check('BGMアレンジの試聴で長い曲が鳴る', r.preview === true && r.previewPlaying === true);
    check('止めたあとは何も鳴っていない', Array.isArray(r.after) && r.after.length === 0, JSON.stringify(r.after));
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
