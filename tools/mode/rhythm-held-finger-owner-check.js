#!/usr/bin/env node
// 押さえている指(ホールド・スライド)と、叩く/払う別の指の判定を混ぜないことを見張る(2026-10-15 社長「スライド判定の件は一刻も早く直したい」)。
//
//   node tools/mode/rhythm-held-finger-owner-check.js
//
// 【再現した形】(実ブラウザの2本指タッチで確かめた。再現の道具は tools/playbot/rhythm-two-finger-sky-repro.js と rhythm-two-finger-flick-repro.js)
//   1) Sheriruth HELL 36.1〜38.7秒: 空中スライドを押さえたまま、真下の地上 TAP(6つ)を右寄り(空中の帯の真下・TAP の受付の中)で叩くと、
//      地上の指が「空中スライドの持ち替えの2本目(控え)」と見なされ、地上の TAP が6つとも MISS になっていた。
//      控えの判断(heldBandNote)と浮いた帯の拾いが横の位置だけを見ていて、指の高さ(地上か空中か)を見ていなかった
//   2) Crazy Party Night フル MASTER の最後: 地上スライドの終わりと同じ時刻・同じ場所の右フリックを、指を上げずに払うと、
//      指が終わりの窓のあいだスライドに結ばれたままで、フリックに一度も触れずに MISS になっていた
//   3) 空中スライドだけ、終わりの100msでも指の外れで切っていた(ホールドには免除があった)
//   4) 地上の帯と空中の帯が上下で交わる所で、横の位置だけで指を結び直し、両方の帯が「外れ」(暗くなる)になり得た
// 1) は本番の照合関数(rhythmMatchInputBatch)を Node で動かして確かめる。2)〜4) と「何も押さえていない指を滑らせて取る今の動き」は、作りの形で見る。
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');

const stub = () => ({ style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {},
  getAttribute: () => null, appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {},
  classList: { add() {}, remove() {} }, dataset: {}, querySelector: () => null, querySelectorAll: () => [],
  textContent: '', isConnected: false, children: [], childNodes: [], closest: () => null,
  getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }) });
const ctx = { console, navigator: {}, performance: { now: () => 0 }, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  setTimeout, clearTimeout, MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  document: { createElement: stub, createElementNS: stub, head: stub(), body: stub(), documentElement: stub(),
    addEventListener() {}, removeEventListener() {}, querySelector: () => null, querySelectorAll: () => [] } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src + '\nglobalThis.__x={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,RHYTHM_SKY_INPUT,RHYTHM_JUDGMENT_LINE_Y,rhythmSkyAcceptLimit,RHYTHM_FLOATING_NOTES,rhythmRecentTapClaimsClear};', ctx);
const X = ctx.__x, match = X.rhythmMatchInputBatch;

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 押さえている空中スライド(サブレーン3〜5・高さ1)と、その左に接する地上 TAP(サブレーン0〜3)
const skySlide = () => ({ index: 0, type: 'HOLD', _rhythmOriginalType: 'SLIDE', timeMs: 0, endTimeMs: 3000, lane: 1.5, endLane: 1.5, subLaneWidth: 2,
  slidePoints: [{ timeMs: 0, lane: 1.5, sky: 1, subLaneWidth: 2 }, { timeMs: 3000, lane: 1.5, sky: 1, subLaneWidth: 2 }],
  done: false, activePointerId: 'touch:1' });
const groundTap = () => ({ index: 1, type: 'TAP', timeMs: 1500, lane: 0, subLane: 0, subLaneWidth: 3, done: false, activePointerId: null });
const finger = (key, sub, skyRatio) => ({ inputKey: key, lane: Math.floor(sub / 2), subLaneCoordinate: sub, sky: skyRatio });

X.RHYTHM_SKY_INPUT.active = true;
const line = X.RHYTHM_JUDGMENT_LINE_Y.ratio;
const groundRatio = line, skyRatio = X.rhythmSkyAcceptLimit() - .08;
for (const sub of [3.3, 3.5]) {
  X.RHYTHM_GESTURE_RUNTIME.clear();
  const held = skySlide(), tap = groundTap();
  const r = match([held, tap], [finger('touch:2', sub, groundRatio)], 1500, 0)[0];
  check(`空中スライドを押さえたまま、真下の地上 TAP をサブレーン${sub}(TAP の受付の中・空中の帯の真下)で叩くと TAP が取れる`,
    r.target === tap && !r.standby, r.standby ? '空中スライドの控えにされた' : r.target ? `取ったのは ${r.target.index}` : '何も取れない');
}
{
  // 持ち替えの2本目(空中の帯の上へ、空中の高さで置いた指)は、これまでどおり控えになる
  X.RHYTHM_GESTURE_RUNTIME.clear();
  const held = skySlide();
  const r = match([held], [finger('touch:2', 4, skyRatio)], 1500, 0)[0];
  check('空中スライドの上へ空中の高さで置いた2本目の指は、これまでどおり持ち替えの控えになる', r.standby === held, r.standby ? '' : '控えにならなかった');
}
{
  // 空中の段が無い曲(既存の全曲)は今までどおり: 高さの値が無い指でも、帯の内側なら控え
  X.RHYTHM_SKY_INPUT.active = false;
  X.RHYTHM_GESTURE_RUNTIME.clear();
  const held = { index: 0, type: 'HOLD', timeMs: 0, endTimeMs: 3000, lane: 1, subLane: 2, subLaneWidth: 4, done: false, activePointerId: 'touch:1' };
  const r = match([held], [finger('touch:2', 4, null)], 1500, 0)[0];
  check('空中の段が無い曲では、地上のホールドの上へ置いた2本目の指はこれまでどおり控えになる', r.standby === held);
  X.RHYTHM_SKY_INPUT.active = true;
}

// ---- 半レーンずれの両手押し(2026-10-15 社長「両手の連打でミス判定になってたのも…」) ----
// 同じ時刻に半レーン(サブレーン1〜2)ずれて並んだ2つの TAP を、左右の指が「それぞれ自分のノーツの見た目の中」で押したら、両方取れること。
// 直す前は、左の指が重なりの所(右のノーツの中心に近い側)を押すと右のノーツを取ってしまい、右の指(右のノーツの右寄り)に行き先が無く片方が MISS だった
{
  X.RHYTHM_SKY_INPUT.active = false;
  let total = 0; const bad = [];
  for (const w of [2, 3, 4]) for (const shift of [1, 2]) for (const dt of [0, 20, -20]) for (let ea = -0.9; ea <= 0.91; ea += 0.15) for (let eb = -0.9; eb <= 0.91; eb += 0.15) {
    const A = { index: 0, type: 'TAP', timeMs: 1000, lane: 1, subLane: 2, subLaneWidth: w, done: false, activePointerId: null };
    const B = { index: 1, type: 'TAP', timeMs: 1000, lane: 1, subLane: 2 + shift, subLaneWidth: w, done: false, activePointerId: null };
    const ca = 2 + w / 2 + ea, cb = 2 + shift + w / 2 + eb;
    if (ca < 2 || ca > 2 + w || cb < 2 + shift || cb > 2 + shift + w || ca >= cb) continue;
    total++; X.RHYTHM_GESTURE_RUNTIME.clear(); X.rhythmRecentTapClaimsClear();
    const fa = finger('touch:1', ca, null), fb = finger('touch:2', cb, null), got = new Set();
    const run = (inputs, t) => { for (const r of match([A, B], inputs, t, 0)) if (r.target) { r.target.done = true; got.add(r.target.index); } };
    if (dt === 0) run([fa, fb], 1000); else if (dt > 0) { run([fa], 1000); run([fb], 1000 + dt); } else { run([fb], 1000); run([fa], 1000 - dt); }
    if (got.size < 2) bad.push(`幅${w} ずれ${shift} 時間差${dt} 左${ca.toFixed(2)} 右${cb.toFixed(2)}`);
  }
  check(`半レーンずれの2つの TAP を左右の指でそれぞれの見た目の中を押すと、両方取れる(${total}通り)`, bad.length === 0, bad.slice(0, 3).join(' / '));
  X.RHYTHM_SKY_INPUT.active = true;
}

// ---- 作りの形 ----
check('控えの判断と浮いた帯の拾いで、指の高さと帯の高さの食い違いを見る(heightMismatch)',
  /const heightMismatch=note=>\{/.test(src)
  && /if\(note\.activePointerId===key\)continue;[^\n]*\n\s*if\(heightMismatch\(note\)\)continue;/.test(src)
  && /if\(tapOnly\)continue;[^\n]*\n\s*if\(heightMismatch\(note\)\)continue;/.test(src));
// 2026-10-16: 空中スライドも地上と同じく、外れても途中で切らない(チェックポイントで判定を下げる)。終わりの100msに限らず、SLIDE は切る処理へ進まない
check('空中スライドも、指の外れで切らない(地上と同じくチェックポイントで判定する)',
  /if\(session\.kind==='SLIDE'(\|\|session\.note\?\._rhythmTickRules===true)?\)return;/.test(src)&&!/RHYTHM_SKY_SLIDE_CUT_GRACE_MS:/.test(src));
check('上下クロス(地上の帯と空中の帯)では、指の高さが相手の帯の高さと合わない結び直しをしない',
  /const slideSwapLayerMismatch=\(note,pos,chartNow\)=>\{/.test(src)
  && /if\(slideSwapLayerMismatch\(other\.note,myPos,otherNow\)\|\|slideSwapLayerMismatch\(session\.note,otherPos,myNow\)\)continue;/.test(src));
const moves = (play.match(/const inputMoves=\(inputKey,subLaneCoordinate\)=>\{[^\n]+?\};/) || [''])[0];
const take = (play.match(/const takeHeldFlick=\(inputKey,subLane,subLaneCoordinate\)=>\{[\s\S]*?\n  \};/) || [''])[0];
check('何も押さえていない指を滑らせて取る今の動き(inputMoves の empty の取り直し)は変えていない',
  /if\(state\.empty\)inputStarts\(\[\{lane:Math\.floor\(subLane\/2\),subLaneCoordinate,inputKey,rejudge:true\}\]\);else if\(typeof takeHeldFlick==='function'\)takeHeldFlick\(inputKey,subLane,subLaneCoordinate\);\};$/.test(moves)
  && /empty:!target\|\|target\.type==='TAP'\}/.test(play));
check('ロングの終わりの窓で、結ばれた指が同じころのフリックの上へ動いたら、離したことにしてフリックだけを取り直す',
  /songNow<Number\(held\.endTimeMs\)\+offset-RHYTHM_RELEASE_MAX_MS/.test(take)
  && /n\.type==='FLICK'&&n\.activePointerId===null/.test(take)
  && /inputEnds\(\[\{inputKey\}\]\);/.test(take)
  && /rejudge:true,flickOnly:true\}\]\);/.test(take)
  && /input\?\.flickOnly===true&&note\.type!=='FLICK'/.test(src));

// 5) iPhone は別の指の合図の中で、押さえている指を指の一覧から一瞬落とすことがある。直す前は、そのたびに押さえている帯が「離した扱い(浮いた帯)」になって暗くなっていた
//    (実ブラウザの再現: tools/playbot/rhythm-two-finger-sky-repro.js の OMIT=1 OMITGAP=90 で、Sheriruth HELL の空中スライドが地上の6回のタップのたびに浮いていた)
check('ロングを押さえている指が自分の離しの合図なしに指の一覧から消えたら、すぐ離した扱いにせず少し待つ',
  /const ownEnd=\(e\.type==='touchend'\|\|e\.type==='touchcancel'\)&&Array\.from\(e\.changedTouches/.test(play)
  && /if\(!ownEnd&&heldNote&&!heldNote\.done&&heldNote\.type==='HOLD'\)/.test(play)
  && /RHYTHM_MISSING_TOUCH_CONFIRM_MS\);\}return;\}/.test(play)
  && /const RHYTHM_MISSING_TOUCH_CONFIRM_MS=120;/.test(src));
check('端末に取り消された指(touchcancel)は、押さえているロングをその場で MISS にせず、ふつうに離したのと同じに扱う',
  /const cancelTouches=event=>\{Array\.from\(event\.changedTouches\|\|\[\]\)\.forEach\(touch=>release\(inputKey\('touch',touch\.identifier\),false\)\);\};/.test(src));

// 6) 終わり際か途中で離したかは、ノーツの離しの的で決める。見回り側が終わり近くで終わりの時刻を延ばすため、延ばした時刻で決めると、
//    見回り側の時計が少し遅れた回だけ、離しの的ぴったりで離したスライドが浮いて MISS になっていた(grievous_lady MASTER を通したときだけ・2026-10-15)
check('離しの処理と浮いた帯の見回りは、延ばされた終わりの時刻ではなく離しの的で終わり際を決める',
  (play.match(/const holdEndMs=Math\.min\(Number\(note\.endTimeMs\),rhythmReleaseTargetMs\(note\)\)\+settings\.judgmentTimingOffsetMs;/g) || []).length === 2
  && !/const holdEndMs=note\.endTimeMs\+settings\.judgmentTimingOffsetMs;/.test(play));

console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
