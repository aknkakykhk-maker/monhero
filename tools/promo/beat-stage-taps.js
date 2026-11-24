#!/usr/bin/env node
// 紹介動画「HELL の見どころ(ステージ)」のタップ音を、撮影で控えた呼び出しから書き出す(2026-11-24 r1119-159 追記2・第3版)。
//
//   node tools/promo/beat-stage-taps.js <撮影のフォルダ>/se.json --from 179000 --dur 30 --out taps.wav
//
// 何をするか:
//   撮影(beat-stage-capture.js)は、演奏中にゲームのタップ音の仕組み(RHYTHM_NOTE_SE_RUNTIME)が呼ばれるたびに、
//   曲の時刻・関数の名前・引数を se.json に控える(叩いた音・フリック・ロングの終わり・必殺ノーツ・空中・押さえている間の音・空打ち)。
//   ここでは同じゲームのページを開き、その仕組みの音の出口を OfflineAudioContext に差し替え、控えた呼び出しを順に、
//   「その時刻に鳴った」ことにして(音の時計 currentTime を呼び出しごとに曲の時刻へ合わせて)呼び直し、1本の WAV に焼く。
//   音の作り・判定での鳴らし分け・音量の設定はゲームのものをそのまま通るので、実際に演奏で鳴った音と同じになる(後から別の音を貼らない)。
//   撮影は遅回しなので、そのとき鳴った音そのものは録れない。そのかわりに、判定の瞬間(曲の時刻)で鳴らし直している
//
// 書き出す WAV は 48kHz・2ch。--from(曲の ms)から --dur 秒ぶん。曲の音源と同じ位置で重ねれば、判定と同期する
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const PRE_MS = 3000;   // 区間の前から鳴らしておく(押さえている間の音などが区間の頭で途切れないように)

const renderTaps = async ({ seFile, fromMs, durSec, out, settings }) => {
  const se = JSON.parse(fs.readFileSync(seFile, 'utf8'));
  const startMs = fromMs - PRE_MS, endMs = fromMs + durSec * 1000 + 500;
  const calls = (se.calls || []).filter(c => Number.isFinite(c[0]) && c[0] >= startMs && c[0] <= endMs);
  const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 } });
    const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json' })[path.extname(f)] || 'application/octet-stream';
    await context.route('**/*', async (route) => {
      const m = route.request().url().match(/^https:\/\/sky\.test\/(.*)$/);
      if (!m) return route.abort();   // 外へは出ない(Supabase にも送らない)
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f) } });
    });
    // 撮影と同じ演奏の設定(タップ音の種類・音量など)を、このブラウザの中だけに入れる
    await context.addInitScript((s) => { window.__mhSupabaseStubbed = true; try { localStorage.setItem('mh_rhythm_settings_v1', JSON.stringify(s)); } catch (_) {} }, settings || se.settings || {});
    const page = await context.newPage();
    await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof RHYTHM_NOTE_SE_RUNTIME !== 'undefined', null, { timeout: 60000 });
    const b64 = await page.evaluate(async ({ calls, startMs, endMs }) => {
      const RATE = 48000, len = Math.ceil((endMs - startMs) / 1000 * RATE) + RATE;
      const off = new OfflineAudioContext(2, len, RATE);
      let T = 0;
      Object.defineProperty(off, 'currentTime', { configurable: true, get: () => T });
      const RealAC = window.AudioContext;
      window.AudioContext = function () { return off; };
      window.webkitAudioContext = window.AudioContext;
      const R = RHYTHM_NOTE_SE_RUNTIME;
      await R.prepare();   // 作り置きの音(判定3段 × 叩く・フリック・終わり)を先に作る(ゲームが演奏の前にするのと同じ)
      await new Promise(r => setTimeout(r, 400));   // 押さえている間の音・モンスターノーツの下ごしらえ(prepare が少しあとで呼ぶ)
      let n = 0;
      for (const [ms, name, args] of calls) {
        if (typeof R[name] !== 'function') continue;
        T = Math.max(0, (ms - startMs) / 1000);
        try { R[name](...(args || [])); n++; } catch (e) { /* 1つ鳴らせなくても続ける */ }
      }
      T = (endMs - startMs) / 1000; try { R.holdStopAll(.05); } catch (_) {}
      window.AudioContext = RealAC;
      const buf = await off.startRendering();
      // 16bit の WAV にする
      const ch = [buf.getChannelData(0), buf.getChannelData(1)], frames = buf.length;
      const ab = new ArrayBuffer(44 + frames * 4), v = new DataView(ab);
      const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + frames * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
      v.setUint32(24, RATE, true); v.setUint32(28, RATE * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, frames * 4, true);
      let o = 44, peak = 0;
      for (let i = 0; i < frames; i++) for (let c = 0; c < 2; c++) { const x = Math.max(-1, Math.min(1, ch[c][i])); peak = Math.max(peak, Math.abs(x)); v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2; }
      const bytes = new Uint8Array(ab); let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return { wav: btoa(s), n, peak };
    }, { calls, startMs, endMs });
    const tmp = out + '.full.wav';
    fs.writeFileSync(tmp, Buffer.from(b64.wav, 'base64'));
    // 区間の頭(--from)から dur 秒に切る
    const { spawnSync } = require('child_process');
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(PRE_MS / 1000), '-t', String(durSec), '-i', tmp, '-af', `apad,atrim=0:${durSec}`, '-ar', '48000', '-ac', '2', out]);
    if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).slice(-500));
    fs.unlinkSync(tmp);
    const inWin = calls.filter(c => c[0] >= fromMs && c[0] < fromMs + durSec * 1000);
    const count = (name) => inWin.filter(c => c[1] === name).length;
    return { called: b64.n, peak: b64.peak, tap: count('play'), flick: count('playFlick'), clear: count('playClear'), accent: count('playAccent'), sky: count('playSky'), monster: count('playMonster'),
      flickAt: inWin.filter(c => c[1] === 'playFlick').map(c => c[0]) };
  } finally { await browser.close(); }
};
module.exports = { renderTaps };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (n, fb = null) => { const i = argv.indexOf(`--${n}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb; };
  const seFile = argv.find(a => a.endsWith('.json'));
  if (!seFile) { console.error('使い方: node tools/promo/beat-stage-taps.js <se.json> --from <曲のms> --dur <秒> --out <wav>'); process.exit(2); }
  renderTaps({ seFile, fromMs: Number(arg('from', 0)), durSec: Number(arg('dur', 30)), out: path.resolve(arg('out', 'taps.wav')) })
    .then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
}
