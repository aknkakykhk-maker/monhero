// モンヒロビートにいるまま、バトルへ行かずに周回を止められるかを見張る。
//
//   node tools/mode/rhythm-run-stop-check.js
//
// 2026-09-07・ユーザー指示
//   「バトルにいかなくてもクイック周回を止められるようにしたい」
//   やめ方は「その周も終わらせて報酬を受け取る」(ユーザー選択)。
//
// これまでは帯に「⚔ バトルへ戻る」しか無く、止めるにはいったんバトルへ戻って
// AUTOを切る必要があった。
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
  // 「バトルへ戻る」は残す(やめずに戻りたい人のため)
  check(`${rel}: 「バトルへ戻る」も残っている`, src.includes('data-quick-run-progress-back'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
