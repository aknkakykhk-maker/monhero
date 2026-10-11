#!/usr/bin/env node
// 空中の受け付けの境目を、その人の構えに合わせて下げる試作(RHYTHM_SKY_REACH_ADAPT・2026-10-12 社長「HELL の操作性」)を見張る。
// 親指で地上の線より下を押す人は、空中へ指を上げきれずに空中が断られていた(人の指のくせのボット・高さを半分しか上げ下げしないと
// Sheriruth HELL の MISS 2→13)。地上を取れた押下の深さの中央値ぶん、空中の境目を下げる。
//   ・既定は切(デバッグの mh_sky_reach_adapt_proto が '1' のときだけ入)
//   ・切のときの境目は今までと同じ(地上の線の少し上)
//   ・空中の段の無い譜面(地上の5難易度・公開曲)では覚えない・効かない
//   ・覚えるのは地上のノーツを取れたときだけ。下げる量には上限がある
//
//   node tools/mode/rhythm-sky-reach-adapt-check.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const load = (store = {}) => {
  const localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const ctx = { console, performance: { now: () => 0 }, localStorage };
  vm.runInNewContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8')}
this.G={RHYTHM_SKY_REACH_ADAPT,RHYTHM_SKY_REACH_ADAPT_MAX,rhythmSkyAcceptLimit,rhythmSkyAccepts,RHYTHM_SKY_INPUT,RHYTHM_JUDGMENT_LINE_Y,RHYTHM_SKY_ACCEPT_BELOW,rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME};`, ctx);
  return ctx.G;
};
const sky = { type: 'TAP', timeMs: 1000, lane: 2, subLane: 4, subLaneWidth: 2, skyHeight: 1, done: false, activePointerId: null, index: 0 };
const ground = (t, i) => ({ type: 'TAP', timeMs: t, lane: 2, subLane: 4, subLaneWidth: 2, done: false, activePointerId: null, index: i });
const tap = (G, notes, t, ratio) => G.rhythmMatchInputBatch(notes, [{ inputKey: 'touch:' + t, lane: 2, subLaneCoordinate: 5, subLaneCoordinateAtLine: null, sky: ratio }], t, 0)[0];

{ // 既定は切・境目は今までと同じ
  const G = load();
  const base = G.RHYTHM_JUDGMENT_LINE_Y.ratio - G.RHYTHM_SKY_ACCEPT_BELOW;
  check('既定は切', G.RHYTHM_SKY_REACH_ADAPT.on === false);
  G.RHYTHM_SKY_INPUT.active = true;
  const notes = [0, 1, 2, 3, 4, 5].map(k => ground(100 + k * 300, k));
  notes.forEach(n => tap(G, notes, n.timeMs, G.RHYTHM_JUDGMENT_LINE_Y.ratio + .15));
  check('切のときは地上を深く押しても覚えない', G.RHYTHM_SKY_REACH_ADAPT.depths.length === 0);
  check('切のときの境目は今までと同じ(地上の線の少し上)', Math.abs(G.rhythmSkyAcceptLimit() - base) < 1e-12, base.toFixed(3));
}
{ // 入: 地上を深く押す人ほど境目が下がる(上限つき)
  const G = load({ mh_sky_reach_adapt_proto: '1' });
  const line = G.RHYTHM_JUDGMENT_LINE_Y.ratio, base = line - G.RHYTHM_SKY_ACCEPT_BELOW;
  check('mh_sky_reach_adapt_proto=1 で入', G.RHYTHM_SKY_REACH_ADAPT.on === true);
  G.RHYTHM_SKY_INPUT.active = false;
  const n0 = [0, 1, 2, 3, 4, 5].map(k => ground(100 + k * 300, k));
  n0.forEach(n => tap(G, n0, n.timeMs, line + .1));
  check('空中の段の無い譜面では覚えない(地上の5難易度・公開曲は変わらない)', G.RHYTHM_SKY_REACH_ADAPT.depths.length === 0);
  G.RHYTHM_SKY_INPUT.active = true;
  check('覚えた数が少ないうちは下げない', Math.abs(G.rhythmSkyAcceptLimit() - base) < 1e-12);
  const notes = [0, 1, 2, 3, 4, 5].map(k => ground(100 + k * 300, k));
  notes.forEach(n => tap(G, notes, n.timeMs, line + .1));
  check('地上を取れた押下の深さを覚える', G.RHYTHM_SKY_REACH_ADAPT.depths.length === 6, `${G.RHYTHM_SKY_REACH_ADAPT.depths.length}回`);
  check('境目が地上の深さのぶん下がる', Math.abs(G.rhythmSkyAcceptLimit() - (base + .1)) < 1e-9, G.rhythmSkyAcceptLimit().toFixed(3));
  // 線の少し上で押した空中のタップ: 切なら断られ、入なら取れる
  const at = line + .02;
  check('入: 地上の線の近くで押した空中のタップを受ける', G.rhythmSkyAccepts(sky, at) === true);
  const G2 = load(); G2.RHYTHM_SKY_INPUT.active = true;
  check('切: 同じ押下の空中のタップは今までどおり断る', G2.rhythmSkyAccepts(sky, at) === false);
  // 空中を取れても覚えない
  const before = G.RHYTHM_SKY_REACH_ADAPT.depths.length;
  const s = [{ ...sky, timeMs: 3000, index: 9 }];
  const got = tap(G, s, 3000, line - .3);
  check('空中のノーツを取れたときは覚えない', got && got.target === s[0] && G.RHYTHM_SKY_REACH_ADAPT.depths.length === before);
  // 上限
  for (let k = 0; k < 16; k++) G.RHYTHM_SKY_REACH_ADAPT.note(line + .5);
  check('下げる量には上限がある', Math.abs(G.rhythmSkyAcceptLimit() - (base + G.RHYTHM_SKY_REACH_ADAPT_MAX)) < 1e-9, `上限 ${G.RHYTHM_SKY_REACH_ADAPT_MAX}`);
  G.RHYTHM_SKY_REACH_ADAPT.reset();
  check('演奏が変われば覚え直す(reset)', G.RHYTHM_SKY_REACH_ADAPT.depths.length === 0);
}
{ // 演奏画面: 譜面が変わるたびに覚えた深さを消す・切り替えはデバッグの画面だけ
  const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
  check('演奏を始めるときに覚えた深さを消す', /RHYTHM_SKY_INPUT\.active=skyChart;RHYTHM_SKY_REACH_ADAPT\.reset\(\)/.test(play));
  const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  const i = app.indexOf('<RhythmSkyReachAdaptSwitch/>'), j = app.indexOf('<RhythmSkyLiftSwitch/>');
  check('切り替えはデバッグの空中の試作の並びにだけある', i > 0 && j > 0 && Math.abs(i - j) < 200 && app.split('<RhythmSkyReachAdaptSwitch/>').length === 2);
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
