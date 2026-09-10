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
//   ① 回っている                … バトルへ戻る ／ ここで周回をやめる
//   ② 止まった・挑戦は生きている … 周回を再開する ／ バトルへ戻る
//   ③ 止まった・勝負がついた     … 1周目から新しく始める ／ バトルへ戻って結果を見る
//   どの状態でも「バトルへ戻る」は必ず出す(行き先を失わないため)。
//
// ★②と③の分かれ目は quickRunResumable (= runStage!==null && hp>0 && !gaveUp)。
//   ランの段階(runStage)は returnToHome まで残るので、**負けても runStage!==null のまま**。
//   段階の有無で分けていたため、負けたあとに②が出て、押すと死んだランの続きから
//   動きだしていた(2026-09-07・ユーザー報告「裏周回で負けた場合にもう一度再開にすると
//   負けたときの続きからになってる。負けた場合は最初からにしないとおかしい。
//   またそれで勝った場合に進行不能バグが起きてる可能性がある」)。
const fs = require('fs');
const path = require('path');
const { readAppSource } = require(require('path').join(__dirname, '..', 'harness'));

const root = path.resolve(__dirname, '..', '..');
// 2026-09-10(STEP 6)から、画面は 60-app.jsx から 5x-screen-*.jsx へ1つずつ移っている。
// 本体だけを見ると移った画面が静かに対象から外れるので、本体と切り出した画面を
// 1つにつないだもの(readAppSource)を「編集元」として見る
const sources = [
  ['monster-hero/src/parts(本体と切り出した画面)', readAppSource()],
  ['monster-hero/game-system.compiled.js', fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8')],
];

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const [rel, src] of sources) {
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
    compact.includes('!quickRunProgress.finished&&quickRunResumable&&(quickRunStopConfirm'));
  // 「バトルへ戻る」はどの状態でも出す(やめずに戻りたい人のため)
  check(`${rel}: 「バトルへ戻る」も残っている`, src.includes('data-quick-run-progress-back'));

  // ---- 続けられるかどうかの判定 ----
  check(`${rel}: 続けられるかは勝負がついたかで決める`,
    compact.includes('construnResultFinished=hp<=0||gaveUp;')
    && compact.includes('constquickRunResumable=runStage!==null&&!runResultFinished;'));
  check(`${rel}: 段階の有無だけで再開を出さない`,
    !compact.includes('quickRunProgress.finished&&runStage!==null&&'));

  // ---- ② 止まった・挑戦は生きている ----
  check(`${rel}: 挑戦が生きていれば「再開する」を出す`,
    src.includes('data-quick-run-resume')
    && compact.includes('quickRunProgress.finished&&quickRunResumable&&'));
  // 空白を潰すと行コメントが式の間へ挟まって見えるので、あいだは正規表現で読み飛ばす
  check(`${rel}: 再開は勝負がついていないときだけ通す`,
    /constresumeQuickRunFromRhythm=\(\)=>\{if\(!runStageRef\.current\)returnfalse;[\s\S]{0,200}?if\(runResultFinishedRef\.current\)returnfalse;/.test(compact));
  check(`${rel}: 再開しても周回数と報酬は続ける`,
    compact.includes("writeQuickRunProgress({...current,finished:false,reason:''});"));

  // ---- ③ 止まった・勝負がついた ----
  check(`${rel}: 勝負がついたら「1周目から新しく始める」を出す`,
    src.includes('data-quick-run-restart')
    && compact.includes('quickRunProgress.finished&&!quickRunResumable&&repeatTemplateForNewRun()&&'));
  // 負けたあとは段階が残っていても始め直せる。数えかけも持ち越さない
  check(`${rel}: 勝負がついたランの上からでも始め直せる`,
    compact.includes('if(runStageRef.current&&!runResultFinishedRef.current)returnfalse;')
    && compact.includes('if(runStageRef.current)clearQuickRunProgress();'));
  // 結果の記録が終わるまでは押させない(周回IDが記録の途中で入れ替わらないように)
  check(`${rel}: 記録中は始め直せない`, compact.includes('disabled={resultProcessing}') || compact.includes('disabled:resultProcessing'));
  check(`${rel}: 勝負がついたときの「バトルへ戻る」は結果を見に行く言い方`,
    compact.includes("quickRunProgress.finished&&!quickRunResumable?'⚔バトルへ戻って結果を見る':'⚔バトルへ戻る'"));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
