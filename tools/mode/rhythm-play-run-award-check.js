// 演奏1曲ぶんを、クイック∞周回の周回クリアとして反映する組み込みを見張る。
//
//   node tools/mode/rhythm-play-run-award-check.js
//
// 2026-09-07・ユーザー提案
//   「演奏に入った段階でのバトルの周分をクリア時のみ少量扱いにする」
//   「5周目クリア扱いになって無限周回は6周目から始まる」
//   「過去の実績で1回でもクリアしてたらと言う条件にする」
//
// 数の決め方そのものは rhythm-play-run-loops-check.js が見る。
// こちらは「どこで・どの条件で・何を配るか」の結線を見る。
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

  // ---- 出す条件 ----
  check(`${rel}: 裏で∞周回しているクイックのときだけ`,
    compact.includes('if(!runStageRef.current||!autoRepeatRef.current||!isQuickMode(runMode))return0;'));
  check(`${rel}: 過去にその難易度をクリアしていることを条件にする`,
    compact.includes('if(!rhythmPlayRunLoopsAllowed(difficulty,quickClearCounts))return0;'));
  check(`${rel}: 周回数は曲の長さから決める`,
    compact.includes('returnrhythmPlayRunLoops(rhythmPlaySongDurationMs(song,rhythmDifficulty));'));
  // 曲の長さは、見た目の「2分25秒」と同じ求め方
  check(`${rel}: 曲の長さは曲の指定→譜面の順に見る`,
    compact.includes('constown=Number(song?.playDurationMs);')
    && compact.includes('Number(song?.difficulties?.[rhythmDifficulty?.id]?.durationMs)'));

  // ---- 配るもの ----
  check(`${rel}: 1周ぶんの値は報酬を配るのと同じ関数を通す`,
    compact.includes('applyQuickXpPolicy(xpForWavesClearedInMode(10,xpMult,runMode),runMode,quickRewardPolicyRunRef.current)')
    && compact.includes('applyQuickDiamondPolicy(goldForWavesClearedInMode(10,goldMult,runMode),runMode,quickRewardPolicyRunRef.current)'));
  check(`${rel}: 周回数ぶんを掛ける`,
    compact.includes('constxpGain=Math.floor(oneXp*count);') && compact.includes('constgoldGain=Math.floor(oneGold*count);'));
  check(`${rel}: 帯の数字も実際に配った値をそのまま足す`,
    compact.includes('addQuickRunProgressRewards(xpGain,goldGain);'));
  check(`${rel}: 周回数もそのぶん進める`,
    compact.includes('for(leti=0;i<count;i++)countQuickRunLoop();'));

  // ---- どこで呼ぶか ----
  // 最後まで演奏したとき(onComplete)だけ。途中でやめたときは通らない
  check(`${rel}: 最後まで演奏したときだけ反映する`,
    /rhythmPlay\.from!=='tutorial'[\s\S]{0,400}?rhythmPlayLoopsFor\(rhythmPlay\.song,rhythmPlay\.difficulty\)/.test(compact.replace(/\s+/g, ''))
    || /rhythmPlay\.from!=='tutorial'\)\{[\s\S]{0,400}?rhythmPlayLoopsFor/.test(src));
  check(`${rel}: その周は締めて次の周から始める`,
    /awardRhythmPlayRunLoops\(loops\)[\s\S]{0,400}?startRunFromRepeatTemplate\(repeat\)/.test(src));
  // 生成物は `from !== 'tutorial'` のように空白が入るので、空白を潰してから見る
  check(`${rel}: 練習(あそびかた)では何も配らない`,
    compact.includes("rhythmPlay.from!=='tutorial'"));

  // ---- 追いつきとの関係 ----
  // 演奏ぶんが入ったときは追いつかない(二重取りにならない)
  check(`${rel}: 演奏ぶんが入ったときは追いつきを使わない`,
    compact.includes('if(rhythmPlayRunAwardRef.current){stopCatchUp();return;}'));
  check(`${rel}: 演奏に入るとき前回の表示を消す`,
    compact.includes('setRhythmPlayRunAward(null);'));

  // ---- 見せ方 ----
  check(`${rel}: 帯に何周ぶん入ったかを出す`,
    compact.includes('rhythmPlayRunAward.loops}周ぶん入りました') || compact.includes('rhythmPlayRunAward.loops,'));
  check(`${rel}: 詳細にも内訳を出す`, src.includes('data-quick-run-play-award'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
