#!/usr/bin/env node
// 超省エネ(クイックの∞周回)の画面を、演出なし・絵なしの最小に保っているかを見張る(2026-10-01・ユーザー指示
// 「超省エネをもっと画面情報減らしてエコに。VICTORY!とかの表示はなしでいい。ほかにも削れるところがあれば」)。
//
//   node tools/run/ultra-eco-minimal-check.js
//
//   ① 超省エネの∞周回のあいだは、バトル設定の演出(VICTORY!・WAVEのはじまり・場面の帯・結果・数字・ラン終了・揺れ・ムービー・待機の動き)をすべて切る
//      (battleFxEffective の上書き。保存した設定は書き換えない)
//   ② 演出を読む側が、保存値ではなく battleFxEffective を見ている(上書きが効く)
//   ③ 超省エネの画面(data-ultra-battle-view)に、敵の絵を出さない
// 演出を足したときは、超省エネで切れているかをここへ足す。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };

const app = read('monster-hero/src/parts/60-app.jsx');
const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const core = read('monster-hero/src/parts/10-core.jsx');

// ① 上書き
const memo = app.slice(app.indexOf('const battleFxEffective = useMemo'), app.indexOf('const battleFxLoad = battleFxEffective.load'));
check('超省エネの∞周回の条件で上書きしている', /ecoMode === 'ultra' && autoRepeat === true/.test(memo));
const offKeys = ['idleMotion', 'shake', 'specialMovie', 'phaseBanner', 'waveIntro', 'defeatFx', 'resultFx', 'countUp', 'endFx'];
for (const k of offKeys) check(`超省エネでは ${k} を切る`, new RegExp(`${k}: 'OFF'`).test(memo));
check('上書きの再計算が ecoMode と autoRepeat に従う', /\[battleFxSettings, battleFxAutoLoad, ecoMode, autoRepeat\]/.test(memo));
// 演出の項目を足したのに、ここの一覧へ入れ忘れていないか(足した項目は、設定の項目一覧から拾う)
const itemKeys = [...core.matchAll(/\{ key:'(\w+)', title:/g)].map((m) => m[1]);
const knownKept = ['load', 'autoLoad', 'restPause']; // 軽さそのものの設定。演出ではない
const missing = itemKeys.filter((k) => !offKeys.includes(k) && !knownKept.includes(k));
check('バトル設定の演出の項目は、すべて超省エネで切るか、軽さの設定として除いている', missing.length === 0, missing.join(', '));

// ② 読む側
check('VICTORY! は battleFxEffective を見る', /battleFxEffectiveRef\.current\.defeatFx/.test(app));
check('WAVEのはじまりは battleFxEffective を見る', /battleFxEffective\.waveIntro/.test(app));
check('場面の帯は battleFxEffective を見る', /battleFxEffective\.phaseBanner/.test(app));
check('結果の演出の長さは battleFxEffective を見る', /battleFxEffectiveRef\.current\.resultFx/.test(app));

// ③ 超省エネの画面
const ultra = battle.slice(battle.indexOf('data-ultra-battle-view'), battle.indexOf('累計ターンで動く倍率だけをここへ出す'));
check('超省エネの画面を取り出せた', ultra.length > 500);
check('超省エネの画面に敵の絵(<img>)を出さない', !/<img\b/.test(ultra));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
