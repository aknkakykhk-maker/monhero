const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// HOLD / SLIDE を押さえている途中で、指を入れ替えられるかを見る。
//
//   node tools/mode/rhythm-hold-handover-check.js
//
// 【なぜ要るか】
// 長いHOLD/SLIDEを別の指へ持ち替えるとき、離してから置き直すまでにどうしても間があく。
// 離した瞬間にMISSにしていたころは、持ち替えがまったくできなかった
// (2026-09-05・ユーザー要望「スライドやホールド時での指の置き換えをできるようにしたい」)。
//
// 【2026-09-05・2回目の指摘「指置き換えも機能してない。してるとしたら時間が短すぎる？」】
// 猶予の長さの問題ではなかった。持ち替えは**2か所で塞がれていて**、一度も成立していなかった。
//
//   ① 入力とノーツの突き合わせ(rhythmMatchInputBatch)は、「いまの時刻の前後240ms以内に
//      **始まる**ノーツ」しか候補にしない。3秒のHOLDを2秒押さえてから持ち替えると、
//      そのノーツの開始時刻はとっくに窓の外なので、置き直した指がどこにも当たらない。
//   ② 指を離した瞬間に RHYTHM_GESTURE_RUNTIME.release() が終端判定を作り、
//      note.endTimeMs を「いまより前」へ書き換えていた。そのため inputEnds は必ず
//      「終わり際まで来ている」分岐へ入り、猶予を見る分岐へ一度も行かなかった。
//
// 前の版のこの検査は「①が起きていない」と思い込んでいて(rhythm-mode.js が releasedAtMs を
// 見ていないことを**わざわざ確かめて**いた)、そのせいで壊れていることに気づけなかった。
// いまは本番の突き合わせを実際に動かして、持ち替えが成立することを目で見て確かめる。
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

// ---- 本番の突き合わせをそのまま動かす ----
// 画面もAudioContextも無いので、触られる最低限だけを作った偽のブラウザで読む。
const makeRuntime = () => {
  const noop = () => {};
  const element = () => ({ style:{ setProperty:noop }, dataset:{}, setAttribute:noop,
    addEventListener:noop, appendChild:noop, prepend:noop, remove:noop,
    querySelector:() => null, querySelectorAll:() => [] });
  const documentStub = { addEventListener:noop, removeEventListener:noop,
    querySelector:() => null, querySelectorAll:() => [], createElement:element,
    body:{ appendChild:noop, addEventListener:noop }, head:{ appendChild:noop },
    documentElement:{ dataset:{}, style:{ setProperty:noop } } };
  const context = { console, document:documentStub,
    window:{ addEventListener:noop, removeEventListener:noop, __mhAudioEnabled:false,
      matchMedia:() => ({ matches:false, addEventListener:noop, removeEventListener:noop }) },
    performance:{ now:() => Date.now() }, requestAnimationFrame:() => 0, cancelAnimationFrame:noop,
    setTimeout, clearTimeout };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(`${rhythm}\nglobalThis.__x={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,`
    + `rhythmFloatingNoteAdd,rhythmFloatingNoteRemove,rhythmFloatingNotesClear,`
    + `RHYTHM_HOLD_HANDOVER_GRACE_MS,RHYTHM_HOLD_RELEASE_GRACE_MS,RHYTHM_INPUT_MATCH_WINDOW_MS};`, context);
  return context.__x;
};
const rt = makeRuntime();

// ---- 猶予の長さ ----
check('持ち替えの猶予がデータ側の定数になっている',
  /const RHYTHM_HOLD_HANDOVER_GRACE_MS=\d+;/.test(rhythm), `${rt.RHYTHM_HOLD_HANDOVER_GRACE_MS}ms`);
check('猶予は指を入れ替えるのに要るぶん(60〜260ms)',
  rt.RHYTHM_HOLD_HANDOVER_GRACE_MS >= 60 && rt.RHYTHM_HOLD_HANDOVER_GRACE_MS <= 260,
  `${rt.RHYTHM_HOLD_HANDOVER_GRACE_MS}ms`);
// 終わり際の猶予とは別物。混ぜると「終わりに離す」と「途中で持ち替える」が同じ扱いになる
check('終わり際の猶予とは別の定数',
  /const RHYTHM_HOLD_RELEASE_GRACE_MS=\d+;/.test(rhythm)
  && rt.RHYTHM_HOLD_HANDOVER_GRACE_MS !== rt.RHYTHM_HOLD_RELEASE_GRACE_MS);
// 定義は1か所だけ。2か所に書くと必ず片方が古くなる
check('猶予の定義が game-system.jsx に重複していない',
  !/const RHYTHM_HOLD_HANDOVER_GRACE_MS=/.test(game) && !/const RHYTHM_HOLD_RELEASE_GRACE_MS=/.test(game));

// ---- 実際に持ち替えられるか ----
const HOLD_START = 1000, HOLD_END = 4000, SUB_LANE = 4, WIDTH = 2;
const newNote = extra => ({ type:'HOLD', timeMs:HOLD_START, endTimeMs:HOLD_END, lane:Math.floor(SUB_LANE/2),
  subLane:SUB_LANE, subLaneWidth:WIDTH, index:0, done:false, activePointerId:null,
  holdJudgment:null, holdDeltaMs:0, releasedAtMs:null, ...extra });
const match = (notes, timeMs, key, subCoordinate) => rt.rhythmMatchInputBatch(notes,
  [{ lane:Math.floor(subCoordinate/2), subLaneCoordinate:subCoordinate, inputKey:key }], timeMs, 0)[0];

{
  rt.rhythmFloatingNotesClear();
  const notes = [newNote()];
  const first = match(notes, HOLD_START, 'pointer:1', SUB_LANE + 1);
  check('始点で押さえられる', first.target === notes[0], `deltaMs=${first.deltaMs}`);
  notes[0].activePointerId = 'pointer:1';

  // 途中で指を離す(game-system.jsx の inputEnds がやること)
  const RELEASED_AT = 2500;
  notes[0].activePointerId = null;
  notes[0].releasedAtMs = RELEASED_AT;
  rt.rhythmFloatingNoteAdd(notes[0]);

  // 離した場所は開始から1500ms後。突き合わせの窓(240ms)のはるか外にある
  check('離した時点は開始の受付窓より外にある',
    RELEASED_AT - HOLD_START > rt.RHYTHM_INPUT_MATCH_WINDOW_MS,
    `${RELEASED_AT - HOLD_START}ms > ${rt.RHYTHM_INPUT_MATCH_WINDOW_MS}ms`);
  const again = match(notes, RELEASED_AT + 100, 'pointer:2', SUB_LANE + 1);
  check('別の指で置き直すと同じノーツを引き継げる', again.target === notes[0]);
}
{
  // 帯から外れた場所へ置いても引き継がない(どこを押しても拾う作りになっていないこと)
  rt.rhythmFloatingNotesClear();
  const notes = [newNote({ releasedAtMs:2500 })];
  rt.rhythmFloatingNoteAdd(notes[0]);
  check('帯から離れた場所では引き継がない', match(notes, 2600, 'pointer:3', 0).target === null);
}
{
  // 浮いていないノーツは、これまでどおり開始の窓の中でしか拾わない
  rt.rhythmFloatingNotesClear();
  const notes = [newNote()];
  check('浮いていないノーツを途中から拾ったりしない',
    match(notes, 2600, 'pointer:4', SUB_LANE + 1).target === null);
}
{
  // 判定が確定したノーツの控えが残っていても引き継がない
  rt.rhythmFloatingNotesClear();
  const notes = [newNote({ releasedAtMs:2500, done:true })];
  rt.rhythmFloatingNoteAdd(notes[0]);
  check('判定が終わったノーツは引き継がない', match(notes, 2600, 'pointer:5', SUB_LANE + 1).target === null);
}
{
  // 押さえたままのノーツを、別の指が横取りしない
  rt.rhythmFloatingNotesClear();
  const notes = [newNote({ releasedAtMs:2500, activePointerId:'pointer:1' })];
  rt.rhythmFloatingNoteAdd(notes[0]);
  check('押さえ中のノーツを別の指が横取りしない', match(notes, 2600, 'pointer:6', SUB_LANE + 1).target === null);
}

// ---- 離したときに判定を確定させないこと ----
// ここが前回の見落とし。release() が終端判定を作って endTimeMs を書き換えていたため、
// 猶予を見る分岐へ一度も入らなかった
check('終わりよりずっと手前で離したら、その場で判定を確定させない',
  /if\(!cancelled&&!session\.failed&&releaseDelta<-RHYTHM_HOLD_RELEASE_GRACE_MS\)\{/.test(rhythm)
  && /session\.note\.releasedAtMs=songNow-session\.offsetMs;\s*rhythmFloatingNoteAdd\(session\.note\);/.test(rhythm));
check('途中で外れて失敗が確定したときは、これまでどおり確定させる',
  /if\(!cancelled&&!session\.failed&&/.test(rhythm));
check('終わり際に離したときは、これまでどおり終端判定を作る',
  /session\.note\.endTimeMs=songNow-session\.offsetMs-101;/.test(rhythm));
check('引き継いだSLIDEがHOLDに化けない(元の種類でbindし直す)',
  /const originalType=picked\._rhythmOriginalType\|\|picked\.type;/.test(rhythm));

// ---- game-system.jsx 側 ----
check('途中で離しても、その場でMISSにしない',
  /else\{note\.releasedAtMs=now;rhythmFloatingNoteAdd\(note\);\}/.test(game));
check('終わり際まで来ていれば、離しても成立させる',
  /if\(now>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS\)\{applyJudgment\(note,note\.holdJudgment\|\|'MISS',note\.holdDeltaMs\|\|0\);\}/.test(game));
check('浮いているノーツかどうかを見ている', /const handover=target\.releasedAtMs!=null;/.test(game));
check('引き継いだら「浮いている」を解除する', /if\(handover\)\{target\.releasedAtMs=null;rhythmFloatingNoteRemove\(target\);\}/.test(game));
check('引き継ぎでは始点の判定を書き換えない(持ち替えで得も損もしない)',
  /if\(handover\)\{target\.releasedAtMs=null;rhythmFloatingNoteRemove\(target\);\}\s*else\{target\.holdJudgment=judgment;target\.holdDeltaMs=deltaMs;\}/.test(game));
check('猶予を過ぎたら失敗にする',
  /songTimeMs-note\.releasedAtMs>=RHYTHM_HOLD_HANDOVER_GRACE_MS/.test(game));
check('浮いているあいだに終わりまで来たら成立させる',
  /if\(songTimeMs>=holdEndMs-RHYTHM_HOLD_RELEASE_GRACE_MS\)\{note\.releasedAtMs=null;rhythmFloatingNoteRemove\(note\);applyJudgment\(note,note\.holdJudgment/.test(game));
check('失敗にするときは、離した時刻でずれを測る(戻ってこなかった時点ではない)',
  /const releasedAt=note\.releasedAtMs;note\.releasedAtMs=null;rhythmFloatingNoteRemove\(note\);applyJudgment\(note,'MISS',releasedAt-holdEndMs\)/.test(game));
check('曲を始める・終えるときに浮いている控えを空にする',
  /rhythmFloatingNotesClear\(\);runRef\.current=\{audio/.test(game)
  && /RHYTHM_GESTURE_RUNTIME\.clear\(\);rhythmFloatingNotesClear\(\);/.test(game));

// ---- 状態の後始末 ----
const applyFrom = game.indexOf('const applyJudgment');
const applyBody = applyFrom >= 0 ? game.slice(applyFrom, applyFrom + 3000) : '';
check('判定が確定したら「浮いている」印と控えを消す',
  /note\.releasedAtMs=null;rhythmFloatingNoteRemove\(note\);note\.done=true;/.test(applyBody),
  '確定後に残ると次の指が引き継いでしまう');

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
