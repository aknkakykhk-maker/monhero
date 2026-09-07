// モンヒロビートの帯から、バトルへ行かずに周回を止める・再開する・始め直せるかを見張る。
//
//   node tools/mode/rhythm-run-stop-check.js
//
// 2026-09-07・ユーザー指示
//   「バトルにいかなくてもクイック周回を止められるようにしたい」
//   「これもバトルへ行かなくても再開できるようにして」
//   「色々小出しに出しちゃってるから一旦整理して実装修正して」
//
// ★整理した結果、帯の操作は次の3つの状態しかない。
//   ① 回っている           … バトルへ戻る ／ ここで周回をやめる
//   ② 止まった・ランは残る … 周回を再開する ／ バトルへ戻る
//   ③ 止まった・ランも終了 … 新しく周回を始める ／ バトルへ戻って結果を見る
//   どの状態でも「バトルへ戻る」は必ず出す(行き先を失わないため)。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  path.join(root, 'monster-hero/src/parts/60-app.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const file of files) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const compact = src.replace(/\s+/g, '');

  check(`${rel}: 帯に「やめる」入口がある`, src.includes('data-quick-run-stop'));
  // ★時間をかけて積み上げるものなので、1タップでは止まらない。
  //   生成物は属性とハンドラが離れて並ぶので、空白を潰したうえで
  //   「その関数を呼ぶ形があるか」で見る
  check(`${rel}: いきなり止まらず確認をはさむ`,
    compact.includes('setQuickRunStopConfirm(true)') && src.includes('data-quick-run-stop-confirm'));
  check(`${rel}: 「続ける」で元へ戻れる`, compact.includes('setQuickRunStopConfirm(false)'));
  // やめ方は「あきらめる」と同じ。報酬もそこを通るので、値が別経路にならない
  check(`${rel}: やめ方は「あきらめる」と同じ処理を通る`,
    compact.includes('setQuickRunStopConfirm(false);voidhandleGiveUp();') && src.includes('data-quick-run-stop-yes'));
  check(`${rel}: 「あきらめる」は理由つきで止める`, compact.includes("stopAllAuto('retire');"));
  // 周回中(まだ終わっていない・ランがある)ときだけ出す
  check(`${rel}: 周回しているときだけ出す`,
    compact.includes('!quickRunProgress.finished&&runStage!==null&&(quickRunStopConfirm'));
  // 「バトルへ戻る」はどの状態でも出す(やめずに戻りたい人のため)
  check(`${rel}: 「バトルへ戻る」も残っている`, src.includes('data-quick-run-progress-back'));

  // ---- ② 止まった・ランは残っている ----
  check(`${rel}: ランが残っていれば「再開する」を出す`,
    src.includes('data-quick-run-resume')
    && compact.includes('quickRunProgress.finished&&runStage!==null&&'));
  check(`${rel}: 再開はランが残っているときだけ通す`,
    compact.includes('constresumeQuickRunFromRhythm=()=>{if(!runStageRef.current)returnfalse;'));
  check(`${rel}: 再開しても周回数と報酬は続ける`,
    compact.includes("writeQuickRunProgress({...current,finished:false,reason:''});"));

  // ---- ③ 止まった・ランも終わった ----
  check(`${rel}: ランが無いときは「新しく始める」を出す`,
    src.includes('data-quick-run-restart')
    && compact.includes('quickRunProgress.finished&&runStage===null&&repeatTemplateForNewRun()&&'));
  check(`${rel}: ランが無いときの「バトルへ戻る」は結果を見に行く言い方`,
    compact.includes("quickRunProgress.finished&&runStage===null?'⚔バトルへ戻って結果を見る':'⚔バトルへ戻る'"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
