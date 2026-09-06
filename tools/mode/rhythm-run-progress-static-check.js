// モンビーの周回進捗(docs/spec/QUICK_RHYTHM_LINK.md PR6)の作りを静的に見張る。
//
//   node tools/mode/rhythm-run-progress-static-check.js
//
// 実ブラウザ検査(rhythm-run-progress-check.js)では時間の都合で確かめにくい
// 「周回が終わったときの見せ方」と「保存していないこと」をここで押さえる。
//
// いちばん大事なのは**進捗を保存しないこと**(設計書 §6「新しい保存キーを作らない」)。
// 進捗はリロードで消えてよい値で、周回の記録は今までどおり既存の mh_quick_* が正本。
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

  // ---- 保存しない ----
  check(`${rel}: 進捗に新しい保存キーを作っていない`,
    !/mh_quick_run_progress|mh_rhythm_progress|mh_quick_loops/.test(src));
  check(`${rel}: 進捗の書き込みは storeSet を通らない`,
    !/writeQuickRunProgress[\s\S]{0,200}?storeSet/.test(src));

  // ---- 数える場所 ----
  check(`${rel}: ∞にしたときに数えはじめる`, compact.includes('if(next)beginQuickRunProgress();'));
  check(`${rel}: 実際に配った報酬をそのまま足す`,
    compact.includes('if(autoRepeatRef.current)addQuickRunProgressRewards(breederXpGain,goldGain);'));
  check(`${rel}: 次の周に入ったら周回数を1つ進める`,
    /setAutoTurnCycle\(n\s*=>\s*n\s*\+\s*1\);\s*countQuickRunLoop\(\);/.test(src));
  check(`${rel}: 周回が止まったら「終わった」印を付ける（消さない）`,
    /stopAutoBattle\(\);[\s\S]{0,200}?finishQuickRunProgress\(\);/.test(src));
  check(`${rel}: HOMEへ戻ったら片付ける`,
    /clearRunStage\(\);[\s\S]{0,120}?clearQuickRunProgress\(\);/.test(src));

  // ---- 見せ方 ----
  check(`${rel}: 終わったときは帯の文言が変わる`,
    src.includes('周回が終わりました（タップで結果へ）'));
  // 生成物は `{` が外れて `&&/*#__PURE__*/React.createElement(` になるので、条件式までを見る
  check(`${rel}: 全画面の敗北・リタイア画面はモンビー中に出さない`,
    compact.includes('hp<=0&&!debugBattle&&!rhythmScreenOpen&&') && compact.includes('gaveUp&&!debugBattle&&!rhythmScreenOpen&&'));
  check(`${rel}: 詳細からバトルへ戻れる`, src.includes('data-quick-run-progress-back'));

  // ---- 次の周へ入れること ----
  // ★CHAMPIONの報酬演出の完了(championPresentationComplete)は、その画面を描いたときだけ立つ。
  //   モンヒロビートを開いていると画面を描かないので、待つと永久に次の周へ入れない
  //   (2026-09-07・ユーザー報告「1周目が終わったあと2周目に入らない」「戻るとオートが切れる」)。
  check(`${rel}: 画面を描いていないときは演出の完了を待たない`,
    compact.includes("if(gameState==='CHAMPION'?!championPresentationComplete:resultProcessing)return;"));
  check(`${rel}: その判定に必要なものを依存に入れている`,
    /championPresentationComplete,\s*resultProcessing,\s*gameState/.test(compact.replace(/\s+/g, ' ')) || compact.includes('championPresentationComplete,resultProcessing,gameState'));

  // ---- 報酬の見込み ----
  // 報酬はランの終わりにまとめて配られるので、途中は0のままだった
  check(`${rel}: 今の周のぶんを見込みとして出す`, src.includes('const quickRunPendingRewards ='));
  check(`${rel}: 見込みも報酬を配るときと同じ倍率を通す`,
    /quickRunPendingRewards[\s\S]{0,600}?runRewardMultipliers\(\)/.test(src));
  check(`${rel}: 倍率の式は1か所にまとまっている`,
    (src.match(/const scoreMult = extreme \?/g) || []).length === 1);

  // ---- モンビーから始める ----
  check(`${rel}: 始める入口は共通のテンプレート選びを通る`,
    /startQuickRunFromRhythm[\s\S]{0,400}?repeatTemplateForNewRun\(\)/.test(src));
  check(`${rel}: すでにランが走っているときは始めない`,
    /startQuickRunFromRhythm[\s\S]{0,200}?if\s*\(runStageRef\.current\)\s*return false;/.test(src));
  check(`${rel}: 始められないときは案内文を出す`, src.includes('data-quick-run-start-hint'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
