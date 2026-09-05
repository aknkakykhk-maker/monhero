const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// HOLD / SLIDE を押さえている途中で、指を入れ替えられるかを見る。
//
//   node tools/mode/rhythm-hold-handover-check.js
//
// 【なぜ要るか】
// 長いHOLD/SLIDEを別の指へ持ち替えるとき、離してから置き直すまでにどうしても間があく。
// これまでは離した瞬間にMISSにしていたので、持ち替えがまったくできなかった
// (2026-09-05・ユーザー要望「スライドやホールド時での指の置き換えをできるようにしたい」)。
//
// いまは離しても、猶予のあいだは「浮いている」だけとして取っておき、
// 同じノーツの帯へ指が置かれたら続きへ戻す。この検査は、
//   ・離してすぐMISSにしていないか
//   ・浮いているノーツを次の指が引き継げるか
//   ・引き継ぎで判定が良くも悪くもならないか
//   ・戻ってこなければ、ちゃんと失敗になるか
// を見張る。猶予を長くしすぎると「一瞬離しても平気」になってしまうので、上限も見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const rhythm = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 猶予の長さ ----
const graceMatch = game.match(/const RHYTHM_HOLD_HANDOVER_GRACE_MS=(\d+);/);
check('持ち替えの猶予が定数になっている', !!graceMatch, graceMatch ? `${graceMatch[1]}ms` : '');
const grace = graceMatch ? Number(graceMatch[1]) : 0;
check('猶予は指を入れ替えるのに要るぶん(60〜200ms)', grace >= 60 && grace <= 200, `${grace}ms`);
// 終わり際の猶予とは別物。混ぜると「終わりに離す」と「途中で持ち替える」が同じ扱いになる
check('終わり際の猶予とは別の定数', /const RHYTHM_HOLD_RELEASE_GRACE_MS=\d+;/.test(game)
  && !/RHYTHM_HOLD_HANDOVER_GRACE_MS=RHYTHM_HOLD_RELEASE_GRACE_MS/.test(game));

// ---- 離したときの扱い ----
check('途中で離しても、その場でMISSにしない',
  /else\{note\.releasedAtMs=now;\}/.test(game));
check('終わり際まで来ていれば、離しても成立させる',
  /if\(now>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS\)\{applyJudgment\(note,note\.holdJudgment\|\|'MISS',note\.holdDeltaMs\|\|0\);\}/.test(game));

// ---- 引き継ぎ ----
check('浮いているノーツかどうかを見ている', /const handover=target\.releasedAtMs!=null;/.test(game));
check('引き継いだら「浮いている」を解除する', /if\(handover\)target\.releasedAtMs=null;/.test(game));
check('引き継ぎでは始点の判定を書き換えない(持ち替えで得も損もしない)',
  /if\(handover\)target\.releasedAtMs=null;\s*else\{target\.holdJudgment=judgment;target\.holdDeltaMs=deltaMs;\}/.test(game));

// ---- 戻ってこなかったとき ----
check('猶予を過ぎたら失敗にする',
  /songTimeMs-note\.releasedAtMs>=RHYTHM_HOLD_HANDOVER_GRACE_MS/.test(game));
check('浮いているあいだに終わりまで来たら成立させる',
  /if\(songTimeMs>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS\)\{note\.releasedAtMs=null;applyJudgment\(note,note\.holdJudgment/.test(game));
check('失敗にするときは、離した時刻でずれを測る(戻ってこなかった時点ではない)',
  /const releasedAt=note\.releasedAtMs;note\.releasedAtMs=null;applyJudgment\(note,'MISS',releasedAt-holdEndMs\)/.test(game));

// ---- 入力の受け付け ----
// 浮いているノーツ(activePointerId===null)は、ふつうのノーツと同じように候補へ入る。
// ここが「押さえ中は候補から外す」だけになっていることを確かめる
// (浮いているものまで外すと、置き直した指がどこにも当たらない)
check('押さえ中のノーツだけを候補から外している(浮いているぶんは受け付ける)',
  /note\.activePointerId!==null\|\|/.test(rhythm) && !/note\.releasedAtMs/.test(rhythm));

// ---- 状態の後始末 ----
// 判定が確定したノーツに「浮いている」印が残っていると、次の指がそれを引き継いでしまう
const applyFrom = game.indexOf('const applyJudgment');
const applyBody = applyFrom >= 0 ? game.slice(applyFrom, applyFrom + 3000) : '';
check('判定が確定したら「浮いている」印を消す',
  /releasedAtMs=null/.test(applyBody) || /note\.done=true/.test(applyBody),
  '確定後に印が残ると次の指が引き継いでしまう');

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
