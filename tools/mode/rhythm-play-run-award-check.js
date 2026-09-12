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

  // ---- 出す条件 ----
  check(`${rel}: 裏で∞周回しているクイックのときだけ`,
    compact.includes('if(!runStageRef.current||!autoRepeatRef.current||!isQuickMode(runMode))return0;'));
  check(`${rel}: 過去にその難易度をクリアしていることを条件にする`,
    compact.includes('if(!rhythmPlayRunLoopsAllowed(difficulty,quickClearCounts))return0;'));
  check(`${rel}: 周回数は曲の長さと倍率から決める`,
    compact.includes('returnrhythmPlayRunLoops(rhythmPlaySongDurationMs(song,rhythmDifficulty),rhythmPlayRunLoopScaleFor(song));'));
  // 倍率(ふだん×2・イベント対象曲×3)は、見るたびに引き直す。
  // 読み込み時に1回だけ決めると、開いたままの端末で開催・終了をまたいだときに古い値が残る
  // (CLAUDE.md ⑥-4。初開催で実際に踏んだ失敗)
  check(`${rel}: 倍率は呼ばれるたびにイベントを引き直す`,
    compact.includes('constrhythmPlayRunLoopEventNow=()=>')
    && compact.includes('rhythmLimitedEventAt(Date.now()):null;')
    && /rhythmPlayRunLoopScaleFor=\(?song\)?=>rhythmPlayRunLoopScale\(song\?song\.songId:null,rhythmPlayRunLoopEventNow\(\)\)/.test(compact));
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
    /awardRhythmPlayRunLoops\(loops\s*,\s*loopScale[^)]*\)[\s\S]{0,900}?startRunFromRepeatTemplate\(repeat\)/.test(src));
  // ---- クリアか失敗かで入る周回数が変わる(2026-09-12・ユーザー指示
  //      「終了後にクリアか失敗かもわかるようにして / それによって経験値も変わるから」) ----
  // 失敗(ライフ0のまま完走)は半分。判定そのものは演奏側(result.cleared)が決める。
  check(`${rel}: 失敗したぶんは周回数を決め直してから配る`,
    compact.includes('constcleared=result?.cleared!==false;')
    && compact.includes('constloops=rhythmPlayRunLoopsForResult(baseLoops,cleared);'));
  check(`${rel}: 曲リザルトで結果を言えるよう、クリアかどうかを持って返す`,
    compact.includes('cleared:cleared!==false,'));
  // 失敗したときは1周も配らないが、裏で周回していた人には「入らなかった」ことを伝える。
  // ★受け取る側(演奏画面)は readAppSource に入らないので、そのファイルを直接見る
  check(`${rel}: 失敗したときは配らず、入らなかったことだけリザルトへ渡す`,
    compact.includes('if(!cleared&&baseLoops>0)setRhythmPlayRunAward({loops:0,baseLoops,cleared:false,')
    && fs.readFileSync(path.join(root, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8')
        .includes('data-rhythm-result-quick-run-failed'));
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
  // ★見るのは「実際に周回が入ったか(loops>0)」。失敗は0周なので、途中でやめたときと同じく
  //   止まっていたぶんを取り戻す側へ進む(2026-09-12・ユーザー指示で失敗を0周にしたときの決め)。
  check(`${rel}: 周回が入ったときだけ追いつきを使わない(失敗は取り戻す側へ回す)`,
    compact.includes('if(Number(rhythmPlayRunAwardRef.current?.loops)>0){stopCatchUp();return;}'));
  check(`${rel}: 演奏に入るとき前回の表示を消す`,
    compact.includes('setRhythmPlayRunAward(null);'));
  // ★帯へ出していたころは、時間で消す仕掛け(RHYTHM_PLAY_RUN_AWARD_SHOW_MS)が要った。
  //   出しっぱなしだといま何WAVE・何周目かが読めず、詳細を開いていると止まるようにしたら
  //   開いたままの人には戻らなかった。曲リザルトへ移したので、この仕掛けごと不要になった。
  check(`${rel}: 時間で消す仕掛けを残していない`,
    !compact.includes('setTimeout(()=>setRhythmPlayRunAward(null)') && !compact.includes('if(quickRunDetailOpen)return;'));
  // 周回を数え直すときは落とす。1周目なのに前の演奏ぶんが残らないように
  check(`${rel}: 周回を数え直すときも消す`,
    /beginQuickRunProgress=\(\)=>\{[\s\S]{0,200}?setRhythmPlayRunAward\(null\);[\s\S]{0,120}?writeQuickRunProgress\(\{loops:1/.test(compact));

  // ---- 見せ方(渡すところ) ----
  // ★2026-09-07・ユーザー提案「曲リザルトの画面でいくつ分入ったかとか、何周分から
  //   プラスでいくつ入って何周分になったとかを出すほうがいい。そうしたら帯にわざわざ
  //   何周分追加とか表示する必要もない」。
  //   帯は「WAVE ◯/10 ・ ◯周目」を出す唯一の場所なので、知らせを重ねない。
  check(`${rel}: 足す前と後を控えている`,
    compact.includes('constfromLoop=quickRunProgressRef.current?quickRunProgressRef.current.loops:0;')
    && compact.includes('consttoLoop=quickRunProgressRef.current?quickRunProgressRef.current.loops:fromLoop;'));
  check(`${rel}: リザルトへ渡している`, compact.includes('quickRunAward={rhythmPlayRunAward}') || compact.includes('quickRunAward:rhythmPlayRunAward'));
  check(`${rel}: 帯には演奏ぶんの知らせを重ねない`, !src.includes('data-quick-run-play-award'));

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

// ---- 見せ方(出すところ) ----
// リザルトの画面は音ゲー本体(30-rhythm-play.jsx)の中にある
for (const file of [
  path.join(root, 'monster-hero/src/parts/30-rhythm-play.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
]) {
  const rel = path.relative(root, file);
  const src = fs.readFileSync(file, 'utf8');
  const compact = src.replace(/\s+/g, '');
  check(`${rel}: 曲リザルトへ何周ぶん入ったかを出す`,
    compact.includes('quickRunAward&&quickRunAward.loops>0&&') && src.includes('data-rhythm-result-quick-run'));
  // 生成物では日本語が \u… へ逃がされることがあるので、変数の並びだけでも通るようにする
  check(`${rel}: 何周目から何周目になったかを出す`,
    (compact.includes('{quickRunAward.fromLoop}周目') && compact.includes('{quickRunAward.toLoop}周目'))
    || (compact.includes('quickRunAward.fromLoop,') && compact.includes('quickRunAward.toLoop,')));
  check(`${rel}: 経験値・ダイヤ・絆・プシュケーの内訳も出す`,
    compact.includes('quickRunAward.xp||0') && compact.includes('quickRunAward.gold||0')
    && compact.includes('quickRunAward.bond>0&&') && compact.includes('quickRunAward.psyche>0&&'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
