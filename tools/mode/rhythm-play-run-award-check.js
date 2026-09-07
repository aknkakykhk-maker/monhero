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
  // ★実際に1周クリアしたときと同じものを入れる。
  //   経験値とダイヤだけにしていたころは、演奏より裏で回したほうが得だった
  //   (2026-09-07・ユーザー指摘)
  check(`${rel}: 1周ぶんの値は報酬を配るのと同じ関数を通す`,
    compact.includes('applyQuickXpPolicy(xpForWavesClearedInMode(10,xpMult,runMode),runMode,policy)')
    && compact.includes('applyQuickDiamondPolicy(goldForWavesClearedInMode(10,goldMult,runMode),runMode,policy)'));
  check(`${rel}: マスモンの絆経験値も同じ関数で配る`,
    compact.includes('applyQuickXpPolicy(bondXpForWavesClearedInMode(10,xpMult,runMode),runMode,policy)')
    && compact.includes('buildRunBondAwards({') && compact.includes("storeSet('mh_masu_mons',next,false)"));
  check(`${rel}: 虹のプシュケーも同じ個数の決め方で配る`,
    compact.includes('applyQuickPsychePolicy(clearPsycheReward(difficulty),runMode,policy)')
    && compact.includes("storeSet('mh_owned_items',nextItems,false)"));
  check(`${rel}: クリア回数・ミッション・助手の絆も周回ぶん進める`,
    compact.includes('storeSet(clearCountKey(BATTLE_MODE_QUICK,difficulty),nextQuick,false)')
    && compact.includes("saveMissionProgress('quickClear');addAssistantBond('quickClear');"));
  check(`${rel}: 限界突破も通常の周回と同じように走らせる`,
    compact.includes('executeAutoRepeatBreakthroughs(autoRepeatBondAwardMasuIdsRef.current)'));
  // 記録(最高スコア・最高WAVE)は触らない。演奏にはスコアが無いため
  check(`${rel}: 記録(最高スコア・最高WAVE)は触らない`,
    !/awardRhythmPlayRunLoops[\s\S]{0,3000}?(bestScoreKey|bestWaveKey|setQuickHighScores|setQuickHighestWaves)/.test(src));
  check(`${rel}: 周回数ぶんを掛ける`,
    compact.includes('constxpGain=Math.floor(oneXp*count);') && compact.includes('constgoldGain=Math.floor(oneGold*count);')
    && compact.includes('constbondGain=Math.floor(oneBond*count);') && compact.includes('constpsycheGain=Math.max(0,Math.floor(onePsyche*count));'));
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
    /awardRhythmPlayRunLoops\(loops\)[\s\S]{0,900}?startRunFromRepeatTemplate\(repeat\)/.test(src));
  // ★startRunFromRepeatTemplate は中で stopAutoBattle() を通る。
  //   そのあとAUTOを入れ直さないと、報酬だけ入って周回が止まる
  //   (2026-09-07・ユーザー報告「演奏後周回が止まってる」。
  //    通常の次周開始では入れ直していたのに、演奏ぶんの側で漏らしていた)
  check(`${rel}: 次の周を始めたらAUTOを入れ直す`,
    compact.includes('startRunFromRepeatTemplate(repeat);if(started.ok){autoRepeatStartingRef.current=false;autoBattleRef.current=true;setAutoBattle(true);setAutoTurnCycle(n=>n+1);}'));
  check(`${rel}: 始められなかったときは理由つきで止める`,
    /startRunFromRepeatTemplate\(repeat\)[\s\S]{0,300}?stopAllAuto\('error'\)/.test(src));
  // 生成物は `from !== 'tutorial'` のように空白が入るので、空白を潰してから見る
  check(`${rel}: 練習(あそびかた)では何も配らない`,
    compact.includes("rhythmPlay.from!=='tutorial'"));

  // ---- 追いつきとの関係 ----
  // 演奏ぶんが入ったときは追いつかない(二重取りにならない)
  check(`${rel}: 演奏ぶんが入ったときは追いつきを使わない`,
    compact.includes('if(rhythmPlayRunAwardRef.current){stopCatchUp();return;}'));
  check(`${rel}: 演奏に入るとき前回の表示を消す`,
    compact.includes('setRhythmPlayRunAward(null);'));
  // ★2026-09-07・ユーザー指摘「演奏後の表示が戻らない / 時間で戻すようにして」。
  //   次の演奏に入るまで消えず、3周目のまま「2周ぶん入りました」が居座っていた。
  check(`${rel}: 時間が経ったらふつうの進捗表示へ戻す`,
    compact.includes('setTimeout(()=>setRhythmPlayRunAward(null),RHYTHM_PLAY_RUN_AWARD_SHOW_MS)'));
  // ★詳細(内訳)を開いているあいだは止める作りにしたが、開いたままの人には戻らなかった。
  //   この帯はいま何WAVEかを出す唯一の場所なので、開いていても必ず戻す
  //   (2026-09-07・ユーザー指摘「この間だといま何ウェーブかもわからない」)
  check(`${rel}: 詳細を開いていても戻す`, !compact.includes('if(quickRunDetailOpen)return;'));
  // 周回を数え直すときも落とす。1周目なのに「2周ぶん入りました」が残っていた
  check(`${rel}: 周回を数え直すときも消す`,
    /beginQuickRunProgress=\(\)=>\{[\s\S]{0,200}?setRhythmPlayRunAward\(null\);[\s\S]{0,120}?writeQuickRunProgress\(\{loops:1/.test(compact));

  // ---- 見せ方 ----
  check(`${rel}: 帯に何周ぶん入ったかを出す`,
    compact.includes('rhythmPlayRunAward.loops}周ぶん入りました') || compact.includes('rhythmPlayRunAward.loops,'));
  check(`${rel}: 詳細にも内訳を出す`, src.includes('data-quick-run-play-award'));

  // ---- 文言が仕様に追いついているか ----
  // ★2026-09-07・ユーザー指摘「演奏中の文言ってこれであってる？仕様変わったよね？」。
  //   追いつき方式のころの説明(「そのぶんは曲のあとに速く進んで取り戻すので、損にはなりません」)が
  //   帯に残っていた。仕組みを変えたら、それを説明している文も必ず一緒に直す。
  check(`${rel}: 帯の説明が「曲の長さぶんの周回が入る」になっている`,
    compact.includes('曲を最後まで演奏すると、その曲の長さぶんの周回がクリア扱いで入ります'));
  check(`${rel}: 追いつき方式のころの説明が残っていない`,
    !compact.includes('そのぶんは曲のあとに速く進んで取り戻すので、損にはなりません'));
  // まだその難易度をクリアしていない人には入らないので、そこも言い分ける
  check(`${rel}: 入らない人には別の説明を出す`,
    compact.includes('rhythmPlayRunLoopsAllowed(difficulty,quickClearCounts)?')
    && compact.includes('この難易度をクイックで一度クリアすると'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
