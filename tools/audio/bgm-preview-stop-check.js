// BGMアレンジの試聴が、押した順どおりに止まることを確認する。
//
//   node tools/audio/bgm-preview-stop-check.js
//
// 【背景】
// 試聴は「曲を読み込む → 鳴らす」の2段階で、読み込みは非同期。読み込みを待っている
// あいだに止めたり別の曲を押したりできるため、古い呼び出しがあとから鳴り始めないよう
// 見張る必要がある。ところが以前は曲名(previewKey)しか見ておらず、
//
//   ① 曲Aを押す(読み込み中) → ② 止める → ③ もう一度Aを押す
//
// とすると、①と③の両方が「今の曲はAだ」という条件を通ってしまい、音源が2つ鳴る。
// previewSource は最後の1つしか覚えていないので、①のぶんは誰も止められなくなる。
// 「止めても鳴り続ける」「アレンジを閉じても鳴り続ける」という不具合になっていた。
// 追加したBGMが5〜9MBと大きく読み込みに時間がかかるため、踏みやすくなっていた。
//
// 通常BGM(playBGM)には同じ用途の番号(bgmRequest)が最初からあり、試聴側にだけ無かった。
// ここでは実際の previewBGM / stopPreview を動かして、鳴らした音源が必ず止まることを見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- 実装の形 ---
check('試聴にも呼び出しごとの番号がある', /previewRequest/.test(source));
check('止めるたびに番号を進める(読み込み中の古い試聴を無効にする)',
  /const stopPreview = \(resume = true\) => \{ \+\+previewRequest;/.test(source));
check('読み込み後に自分の番号が最新かを見る',
  /if \(request !== previewRequest \|\| previewKey !== track\.id/.test(source));
check('曲名だけで見張っていない',
  !/const buffer = await loadBuffer\(track\.src\); if \(previewKey !== track\.id/.test(source));

// --- 実際に動かす ---
// Audio_ の中身をそのまま取り出し、読み込みが遅い状況を作って押し順を再現する
const body = (() => {
  const at = source.indexOf('const Audio_ = (() => {');
  const end = source.indexOf('\n})();', at);
  return at >= 0 && end > at ? source.slice(at, end + 6) : null;
})();
check('Audio_の実装を取り出せる', !!body);

if (body) {
  const started = [], stopped = [];
  let nextId = 0;
  const audioCtx = {
    state: 'running', currentTime: 0, destination: {},
    createBufferSource() {
      const id = nextId++;
      return { _id: id, buffer: null, loop: false, onended: null,
        connect() {}, disconnect() {}, start() { started.push(id); }, stop() { stopped.push(id); } };
    },
    createGain() { return { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {}, disconnect() {} }; },
    resume() { return Promise.resolve(); },
    decodeAudioData(_data, ok) { const buf = {}; if (typeof ok === 'function') { ok(buf); return undefined; } return Promise.resolve(buf); },
  };
  const LOAD_MS = 60; // 読み込みに時間がかかる状況(大きいMP3)を作る
  const sandbox = {
    console, Promise, setTimeout, clearTimeout, setInterval, clearInterval, Math, Number, Object, Array, JSON, String, Boolean, Error, Date,
    ArrayBuffer, Uint8Array,
    // 読み込み結果は曲ごとに覚えられる(2回目以降は即座に鳴る)。
    // 「読み込み中に押す」状況を作りたい場面ごとに、まだ一度も読んでいない曲を割り当てる
    BGM_TRACK_BY_ID: {
      S: { id: 'S', name: 'S', src: 'audio/s.mp3', gain: 1, loop: true }, // 疎通確認用
      A: { id: 'A', name: 'A', src: 'audio/a.mp3', gain: 1, loop: true }, // 同じ曲を押し直す用
      B: { id: 'B', name: 'B', src: 'audio/b.mp3', gain: 1, loop: true }, // 押し分け用
      C: { id: 'C', name: 'C', src: 'audio/c.mp3', gain: 1, loop: true }, // 押し分け用
    },
    BGM_TRACK_BY_KEY: {},
    _bgmGain: () => 1,
    fetch: () => new Promise(r => setTimeout(() => r({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }), LOAD_MS)),
    window: { AudioContext: function () { return audioCtx; }, webkitAudioContext: function () { return audioCtx; }, addEventListener() {}, removeEventListener() {} },
    document: { hidden: false, addEventListener() {}, removeEventListener() {},
      head: { appendChild(el) { setTimeout(() => { if (el && typeof el.onload === 'function') el.onload(); }, 1); } },
      createElement() { return { set src(_v) {}, onload: null, onerror: null }; } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  let Audio_ = null;
  try { vm.runInContext(`${body}\nglobalThis.OUT = Audio_;`, sandbox); Audio_ = sandbox.OUT; } catch (e) { check('Audio_を動かせる', false, e.message); }
  check('Audio_を動かせる', !!(Audio_ && typeof Audio_.previewBGM === 'function'));

  if (Audio_) {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    (async () => {
      try { await Audio_.setEnabled(true); } catch (e) { console.log('   setEnabled:', e.message); }
      Audio_.setBgmVolume(80);
      { // 仕込みが実際に音を鳴らせる状態かを先に確かめる。ここが動かないと以降が空振りになる
        const ok = await Audio_.previewBGM('S');
        await wait(LOAD_MS * 3);
        check('仕込みで実際に音源が始まる(検査が空振りしていない)', started.length > 0, `start=${started.length} / previewBGMの戻り=${ok}`);
        Audio_.stopPreview(false);
        await wait(20);
      }

      // ① 押す(読み込み中) → ② 止める → ③ もう一度おなじ曲を押す
      const p1 = Audio_.previewBGM('A');
      await wait(LOAD_MS / 3);
      Audio_.stopPreview(false);
      const p2 = Audio_.previewBGM('A');
      await Promise.all([p1, p2]);
      await wait(LOAD_MS * 2);
      const playingAfterRetap = started.filter(id => !stopped.includes(id));
      check('同じ曲を押し直しても、鳴る音源はひとつだけ', playingAfterRetap.length <= 1,
        `start=${started.length} / いま鳴っている=${playingAfterRetap.length}`);

      // ④ 止めたら本当に止まる
      Audio_.stopPreview(false);
      await wait(20);
      check('止めたら鳴っている音源が残らない', started.filter(id => !stopped.includes(id)).length === 0,
        `残り=${started.filter(id => !stopped.includes(id)).join(',') || 'なし'}`);

      // ⑤ 別の曲を素早く押し分けても、増えない
      const before = started.length;
      const q1 = Audio_.previewBGM('B');
      await wait(LOAD_MS / 3);
      const q2 = Audio_.previewBGM('C');
      await wait(LOAD_MS / 3);
      const q3 = Audio_.previewBGM('B');
      await Promise.all([q1, q2, q3]);
      await wait(LOAD_MS * 2);
      const playingAfterSwitch = started.filter(id => !stopped.includes(id));
      check('曲を素早く押し分けても、鳴る音源はひとつだけ', playingAfterSwitch.length <= 1,
        `この間に start=${started.length - before} / いま鳴っている=${playingAfterSwitch.length}`);

      // ⑥ アレンジを閉じる(stopPreview)と何も鳴っていない
      Audio_.stopPreview(false);
      await wait(20);
      check('画面を離れたら鳴っている音源が残らない', started.filter(id => !stopped.includes(id)).length === 0,
        `残り=${started.filter(id => !stopped.includes(id)).join(',') || 'なし'}`);

      console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
      process.exit(failed ? 1 : 0);
    })().catch(e => { console.error(e); process.exit(1); });
  } else {
    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    process.exit(failed ? 1 : 0);
  }
} else {
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
}
