'use strict';
// settleLevelSwitches の単体テスト(合成ノーツ・下書き形)
const path = require('path');
const MODE = __dirname;
const HM = require(path.join(MODE, 'rhythm-hell-mix.js'));
const beat = 277.743; // 窓 = 1.5*beat-2 ≒ 414.6ms
const tap = (t, sky, hand = 'L', extra = {}) => ({ k: 't', t, sub: 2, w: 2, sky, hand, ...extra });
const slide = (t0, t1, sky, hand = 'L') => ({ k: 's', hand, endFlick: false, pts: [[t0, 1, 2, sky, 0], [t1, 1, 2, sky, 0]] });
let fails = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? '✓' : '✗'} ${name}: ${got} (期待 ${want})`); };

// 1) 地上-空タップ-地上 が窓内: 違反2件 → 空タップを下ろして0件
{
  const notes = [tap(0, 0), tap(200, 1), tap(400, 0), tap(5000, 0, 'R'), tap(5200, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case1 after', notes.levelSettle.after, 0);
  eq('case1 lowered', notes.levelSettle.lowered, 1);
  eq('case1 sky', notes[1].sky, 0);
  eq('case1 viol実測', HM.levelSwitchViolations(notes, beat).length, 0);
}
// 2) スライド起因(空で終わるスライドの直後に地上タップ): 触らず残件 slide=1
{
  const notes = [slide(1000, 2000, 1), tap(2100, 0), tap(6000, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case2 after', notes.levelSettle.after, 1);
  eq('case2 lowered', notes.levelSettle.lowered, 0);
  eq('case2 residual.slide', notes.levelSettle.residual.slide, 1);
  eq('case2 スライド不変', notes[0].pts[1][3], 1);
}
// 3) 窓の外(間が1.5拍以上): 違反なし・何もしない
{
  const notes = [tap(0, 0), tap(500, 1), tap(6000, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case3 before', notes.levelSettle.before, 0);
  eq('case3 sky不変', notes[1].sky, 1);
}
// 4) モンスターノーツ(地上)はそのまま・空タップ側だけ下ろす
{
  const notes = [tap(0, 0, 'L', { mon: 1 }), tap(200, 1), tap(6000, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case4 after', notes.levelSettle.after, 0);
  eq('case4 mon不変', notes[0].mon, 1);
}
// 5) ノーツ数は変わらない
{
  const notes = [tap(0, 0), tap(200, 1), tap(400, 0), slide(1000, 2000, 1), tap(2100, 0)];
  const n0 = notes.length;
  HM.settleLevelSwitches(notes, beat);
  eq('case5 ノーツ数', notes.length, n0);
}
// 6) 空タップの連なり(地上-空-空-地上): 貪欲では止まるが第2段階(DP)で両方下ろして0件
{
  const notes = [tap(0, 0), tap(200, 1), tap(300, 1), tap(450, 0), tap(6000, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case6 before', notes.levelSettle.before, 2);
  eq('case6 after', notes.levelSettle.after, 0);
  eq('case6 lowered', notes.levelSettle.lowered, 2);
}
// 7) スライドの段に挟まれた空タップはどうやっても1件残る(下ろしてもスライド側とぶつかる)
{
  const notes = [slide(1000, 2000, 1), tap(2100, 1), tap(2200, 0), tap(6000, 0, 'R')];
  HM.settleLevelSwitches(notes, beat);
  eq('case7 after', notes.levelSettle.after, 1);
}
console.log(fails ? `NG ${fails}件` : 'ALL OK');
process.exit(fails ? 1 : 0);
