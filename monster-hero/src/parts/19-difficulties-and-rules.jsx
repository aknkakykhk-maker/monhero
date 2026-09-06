// 難易度。keyはランキングの記録やハイスコアの保存にも使うので、既存のものは変更しない。
// bg=選んだときの背景色 / text=選んでいないときの文字色(難易度の雰囲気に合わせた色)。
// Tailwindの動的なクラス生成は稀に失敗して色が出ないことがあるため、実際の色はinline styleで指定する
// data/breeder.js が古いキャッシュのまま読み込まれると、後から足した定義が未定義になり
// 画面全体が真っ暗になってしまう。参照側で必ず既定値に落として、機能が出ないだけで済むようにする。
// (キャッシュキー自体は tools/stamp-version.js が data/*.js の中身のハッシュへ揃えている)
const SKIP_TICKETS = (typeof SKIP_TICKET_BY_DIFFICULTY !== 'undefined' && SKIP_TICKET_BY_DIFFICULTY) || {};
// ヘルプの中身(data/help.js)も同じ理由で必ず既定値に落とす。
// 読めなかった場合はヘルプが空になるだけで、ゲーム自体は動く
// 公開前の機能を説明する項目(releaseFlag つき)は、その機能が本番へ出るまで一覧に出さない。
// 本文と HELP_SCREEN_COVERAGE は先に書き上げておき、公開フラグ1つで同時に出るようにしてある
// 隠す単位はカテゴリ・項目・本文のかたまり(blocks)の3つ。
// 既存の項目へ「公開後だけ出したい1段落」を足せるよう、blocksも同じ名札で絞り込む
const releasedHelpTopic = (topic) => (Array.isArray(topic.blocks) && topic.blocks.some(block => !releasedForPlayers(block)))
  ? { ...topic, blocks: topic.blocks.filter(releasedForPlayers) }
  : topic;
const HELP_GUIDE = ((typeof HELP_CATEGORIES !== 'undefined' && Array.isArray(HELP_CATEGORIES)) ? HELP_CATEGORIES : [])
  .filter(releasedForPlayers)
  .map(category => (Array.isArray(category.topics)
    ? { ...category, topics: category.topics.filter(releasedForPlayers).map(releasedHelpTopic) }
    : category))
  .filter(category => !Array.isArray(category.topics) || category.topics.length > 0);
const HELP_GUIDE_INTRO = (typeof HELP_INTRO !== 'undefined' && HELP_INTRO) || '';
const helpCategoryById = (id) => HELP_GUIDE.find(c => c.id === id) || null;
const helpTopicById = (categoryId, topicId) => ((helpCategoryById(categoryId) || {}).topics || []).find(t => t.id === topicId) || null;
const DIFFICULTY_SETTINGS = {
  Beginner:    { label: "Beginner",     power: 0.25, score: 0.25, gold: 0.25, bg: '#0891b2', text: '#67e8f9', color: "bg-cyan-600", shadow: "shadow-cyan-600/50" },
  Easy:        { label: "Easy",         power: 0.5,  score: 0.5,  gold: 0.5,  bg: '#059669', text: '#6ee7b7', color: "bg-emerald-600", shadow: "shadow-emerald-600/50" },
  Normal:      { label: "Normal",       power: 1.0,  score: 1.0,  gold: 1.0,  bg: '#4f46e5', text: '#a5b4fc', color: "bg-indigo-600", shadow: "shadow-indigo-600/50" },
  Hard:        { label: "Hard",         power: 1.5,  score: 2.0,  gold: 1.2,  bg: '#dc2626', text: '#fca5a5', color: "bg-red-600", shadow: "shadow-red-600/50" },
  Expert:      { label: "Expert",       power: 3.0,  score: 3.0,  gold: 1.5,  bg: '#9333ea', text: '#d8b4fe', color: "bg-purple-600", shadow: "shadow-purple-600/50" },
  Master:      { label: "Master",       power: 5.0,  score: 5.0,  gold: 2.0,  bg: '#e2e8f0', text: '#cbd5e1', color: "bg-slate-200 text-black", shadow: "shadow-white/50", darkText: true },
  GrandMaster: { label: "Grand Master", power: 6.5,  score: 8.0,  gold: 2.5,  bg: '#d97706', text: '#fcd34d', color: "bg-amber-600", shadow: "shadow-amber-500/50" },
  Hell:        { label: "Hell",         power: 8.0,  score: 12.0, gold: 3.0,  bg: '#7f1d1d', text: '#f87171', color: "bg-red-900", shadow: "shadow-red-900/60" },
  Legend:      { label: "Legend",       power: 10.0, score: 18.0, gold: 4.0,  bg: '#be185d', text: '#f9a8d4', color: "bg-pink-700", shadow: "shadow-pink-600/60" },
};
// 極限チャレンジ。チャレンジモードの上位高難易度版で、DIFFICULTY_SETTINGS(通常の難易度)とは
// 別の表にしてある。通常の難易度・全国ランキング・既存の保存キーへは混ぜない。
// INFINITYまで正式に実戦可能。難易度を足すときは、ここへ1行足して specialRules を書けば
// バトル側は「そのルールを持っているか」で判定するので、難易度名の分岐を増やさなくてよい。
const EXTREME_DIFFICULTIES = Object.freeze([
  { id:'EXTREME', label:'EXTREME', japanese:'エクストリーム', available:true, power:13, score:20, xp:25, gold:7.5, psyche:30, description:'通常チャレンジを超える敵に、育てたモンスターで限界まで挑む最高難易度。', specialRules:Object.freeze({ assistCardEffect:0.5 }) },
  { id:'NIGHTMARE', label:'NIGHTMARE', japanese:'ナイトメア', available:true, power:15, score:20, xp:30, gold:10, psyche:40, description:'有利な補正は弱まり、不利な補正は重くなる。距離適性とWAVEごとの立ち回りが重要な高難易度。', specialRules:Object.freeze({ waveEnhancement:0.5, positiveModifier:0.5, negativeModifier:2.0 }) },
  { id:'CHAOS', label:'CHAOS', japanese:'カオス', available:true, power:20, score:20, xp:35, gold:15, psyche:50, unlockRequirement:'NIGHTMARE', description:'力と報酬がさらに跳ね上がり、与えるダメージと供モン加入ボーナスが半減し、消費ガッツが増加する極限難易度。', specialRules:Object.freeze({ damageDealt:0.5, allyJoinBonus:0.5, gutsCost:1.5 }) },
  { id:'ULTIMATE', label:'ULTIMATE', available:true, power:35, score:20, xp:40, gold:20, psyche:60, unlockRequirement:'CHAOS', description:'累計ターンで敵が強化され、供モン加入ボーナス・トレーニング・与ダメージが低下し、35ターンごとに3距離のBREAKレベルが上がる最高難易度。', cardDescription:'累計ターンで敵が強化され、味方側の各効果が低下。35TごとにDISTANCE BREAKが進行する最高難度。', specialRules:Object.freeze({ enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, damageTurnRate:0.0075, minimumDamageDealt:0.25, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:35, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) },
  // INFINITYは既存4難易度の特徴を統合した10WAVEの最終難易度。ただし役割が重なるルールは
  // 重ねない(CHAOSの与ダメ50%・加入B50%はULTIMATE系のターン低下と重複するため入れない。
  // NIGHTMAREのwaveEnhancementも、トレーニングまで50%になってターン低下と重なるため入れず、
  // 距離強化だけを下げる distanceEnhancement を使う)。
  { id:'INFINITY', label:'INFINITY', japanese:'インフィニティ', available:true, power:50, score:20, xp:45, gold:30, psyche:80, unlockRequirement:'ULTIMATE', description:'これまでの極限ルールを統合し、ターン経過による圧力がさらに強化された10WAVE最終難易度。', cardDescription:'極限ルールを統合。与ダメ低下とDISTANCE BREAKがさらに苛烈になる最上位10WAVE。', specialRules:Object.freeze({ assistCardEffect:0.5, positiveModifier:0.5, negativeModifier:2.0, distanceEnhancement:0.5, gutsCost:1.5, enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, minimumAllyJoinBonus:0.10, damageTurnRate:0.01, minimumDamageDealt:0.30, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:25, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) },
]);
// 種族チャレンジは既存の通常・極限難易度定義を複製せず、IDの順序だけを参照する。
const SPECIES_CHALLENGE_DIFFICULTY_IDS = Object.freeze([
  ...Object.keys(DIFFICULTY_SETTINGS),
  ...EXTREME_DIFFICULTIES.map(setting=>setting.id),
]);
const SPECIES_CHALLENGE_PROGRESS_KEY = 'mh_species_challenge_progress_v1';
const emptySpeciesChallengeProgress = () => ({ version:1, species:{}, pendingRewards:{} });
const validSpeciesChallengeId = (speciesId) => typeof speciesId === 'string' && speciesId.length > 0;
const normalizeSpeciesChallengeDifficultyFlags = (value) => Object.fromEntries(
  SPECIES_CHALLENGE_DIFFICULTY_IDS
    .filter(difficultyId=>value && typeof value === 'object' && value[difficultyId] === true)
    .map(difficultyId=>[difficultyId,true])
);
// 自己記録は「種族 × 難易度」ごとに独立させる。既存の progress キーへ足すだけなので、
// records を持たない既存セーブは空の記録として読める(新しい mh_* キーは作らない)。
const emptySpeciesChallengeRecord = () => ({ bestScore:0, bestTurns:null, clears:0 });
const normalizeSpeciesChallengeRecord = (value) => {
  const record=emptySpeciesChallengeRecord();
  if(!value || typeof value!=='object' || Array.isArray(value))return record;
  const bestScore=Math.floor(Number(value.bestScore));
  if(Number.isFinite(bestScore) && bestScore>0)record.bestScore=bestScore;
  const bestTurns=Math.floor(Number(value.bestTurns));
  if(Number.isFinite(bestTurns) && bestTurns>0)record.bestTurns=bestTurns;
  const clears=Math.floor(Number(value.clears));
  if(Number.isFinite(clears) && clears>0)record.clears=clears;
  return record;
};
const normalizeSpeciesChallengeRecords = (value) => Object.fromEntries(
  SPECIES_CHALLENGE_DIFFICULTY_IDS
    .filter(difficultyId=>value && typeof value === 'object' && !Array.isArray(value) && value[difficultyId])
    .map(difficultyId=>[difficultyId,normalizeSpeciesChallengeRecord(value[difficultyId])])
    .filter(([,record])=>record.bestScore>0 || record.bestTurns!==null || record.clears>0)
);
const normalizeSpeciesChallengeProgress = (value) => {
  const normalized=emptySpeciesChallengeProgress();
  const savedSpecies=value && typeof value === 'object' && !Array.isArray(value)
    && value.species && typeof value.species === 'object' && !Array.isArray(value.species)
    ? value.species : {};
  for(const [speciesId,saved] of Object.entries(savedSpecies)){
    if(!validSpeciesChallengeId(speciesId))continue;
    const entry=saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    normalized.species[speciesId]={
      cleared:normalizeSpeciesChallengeDifficultyFlags(entry.cleared),
      firstRewardClaimed:normalizeSpeciesChallengeDifficultyFlags(entry.firstRewardClaimed),
      records:normalizeSpeciesChallengeRecords(entry.records),
    };
  }
  const savedPending=value && typeof value === 'object' && !Array.isArray(value)
    && value.pendingRewards && typeof value.pendingRewards === 'object' && !Array.isArray(value.pendingRewards)
    ? value.pendingRewards : {};
  for(const [key,pending] of Object.entries(savedPending)){
    if(!pending || typeof pending!=='object' || Array.isArray(pending))continue;
    const speciesId=typeof pending.speciesId==='string'?pending.speciesId:'';
    const difficultyId=pending.difficultyId;
    const itemId=speciesTranscendFruitItemId(speciesId);
    const rewardAmount=Math.floor(Number(pending.rewardAmount));
    const targetCount=Math.floor(Number(pending.targetCount));
    if(key!==`${speciesId}:${difficultyId}` || !itemId || pending.itemId!==itemId
      || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
      || !Number.isFinite(rewardAmount) || rewardAmount<=0
      || !Number.isFinite(targetCount) || targetCount<rewardAmount)continue;
    normalized.pendingRewards[key]={ speciesId,difficultyId,itemId,rewardAmount,targetCount };
  }
  return normalized;
};
const isSpeciesChallengeCleared = (progress,speciesId,difficultyId) =>
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    && normalizeSpeciesChallengeProgress(progress).species[speciesId]?.cleared[difficultyId] === true;
const isSpeciesChallengeFirstRewardClaimed = (progress,speciesId,difficultyId) =>
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    && normalizeSpeciesChallengeProgress(progress).species[speciesId]?.firstRewardClaimed[difficultyId] === true;
const speciesChallengeClearedDifficultyIds = (progress,speciesId) => validSpeciesChallengeId(speciesId)
  ? SPECIES_CHALLENGE_DIFFICULTY_IDS.filter(difficultyId=>isSpeciesChallengeCleared(progress,speciesId,difficultyId))
  : [];
const emptySpeciesChallengeSpeciesEntry = () => ({ cleared:{}, firstRewardClaimed:{}, records:{} });
const updateSpeciesChallengeProgressFlag = (progress,speciesId,difficultyId,field) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  if(!validSpeciesChallengeId(speciesId) || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId))return normalized;
  const current=normalized.species[speciesId] || emptySpeciesChallengeSpeciesEntry();
  normalized.species[speciesId]={ ...current, [field]:{ ...current[field], [difficultyId]:true } };
  return normalized;
};
// 画面へ出す種族の呼び名。種族は主血統なので「モッチー種」のように出す
const speciesChallengeSpeciesName = (speciesId) => (validSpeciesChallengeId(speciesId) ? `${lineageById(speciesId).name}種` : '種族');
// 種族×難易度の自己記録を読む。記録が無い組み合わせでも既定値へ落ちる
const speciesChallengeRecord = (progress,speciesId,difficultyId) => normalizeSpeciesChallengeRecord(
  validSpeciesChallengeId(speciesId) && SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId)
    ? normalizeSpeciesChallengeProgress(progress).species[speciesId]?.records?.[difficultyId]
    : null
);
// クリアしたときだけ呼ぶ。スコアとターン数は「良くなったときだけ」更新し、クリア回数は必ず1増やす
const updateSpeciesChallengeRecord = (progress,speciesId,difficultyId,{ score=0,turns=null }={}) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  if(!validSpeciesChallengeId(speciesId) || !SPECIES_CHALLENGE_DIFFICULTY_IDS.includes(difficultyId))return normalized;
  const current=normalized.species[speciesId] || emptySpeciesChallengeSpeciesEntry();
  const before=normalizeSpeciesChallengeRecord(current.records?.[difficultyId]);
  const nextScore=Math.floor(Number(score));
  const nextTurns=Math.floor(Number(turns));
  const record={
    bestScore:Number.isFinite(nextScore)&&nextScore>before.bestScore?nextScore:before.bestScore,
    bestTurns:Number.isFinite(nextTurns)&&nextTurns>0&&(before.bestTurns===null||nextTurns<before.bestTurns)?nextTurns:before.bestTurns,
    clears:before.clears+1,
  };
  normalized.species[speciesId]={ ...current, records:{ ...current.records, [difficultyId]:record } };
  return normalized;
};
// モードカードへ出す「いくつクリアしたか」。種族をまたいだ合計だけを数える
const speciesChallengeTotalClearedCount = (progress) => Object.values(normalizeSpeciesChallengeProgress(progress).species)
  .reduce((total,entry)=>total+SPECIES_CHALLENGE_DIFFICULTY_IDS.filter(id=>entry.cleared[id]===true).length,0);
// プロフィールでは154組を直接並べず、正本の主血統順×難易度順を1回ずつ走査して要約する。
// 同点は先に現れた組を維持するため、表示が再描画のたびに変わらない。
const speciesChallengeProfileSummary = (progress) => {
  const normalized=normalizeSpeciesChallengeProgress(progress);
  const lineages=speciesChallengeLineages();
  let bestScore=0,bestSpeciesId=null,bestDifficultyId=null,clearedCount=0;
  for(const lineage of lineages){
    const entry=normalized.species[lineage.id];
    for(const difficultyId of SPECIES_CHALLENGE_DIFFICULTY_IDS){
      if(entry?.cleared?.[difficultyId]===true)clearedCount+=1;
      const score=normalizeSpeciesChallengeRecord(entry?.records?.[difficultyId]).bestScore;
      if(score>bestScore){bestScore=score;bestSpeciesId=lineage.id;bestDifficultyId=difficultyId;}
    }
  }
  return {
    bestScore,bestSpeciesId,bestDifficultyId,clearedCount,
    totalCount:lineages.length*SPECIES_CHALLENGE_DIFFICULTY_IDS.length,
  };
};
const markSpeciesChallengeCleared = (progress,speciesId,difficultyId) =>
  updateSpeciesChallengeProgressFlag(progress,speciesId,difficultyId,'cleared');
const markSpeciesChallengeFirstRewardClaimed = (progress,speciesId,difficultyId) =>
  updateSpeciesChallengeProgressFlag(progress,speciesId,difficultyId,'firstRewardClaimed');
// 種族チャレンジの供モン選択と加入状況は、バトルへ接続するまで保存しない一時ラン状態として扱う。
// entryId は既存編成と同じく、ベースモンなら baseId、マスモンなら "masu:<個体ID>" を使う。
const speciesChallengeEntryBaseId = (entryId,masuMons=[]) => {
  if(typeof entryId!=='string' || !entryId)return null;
  if(!entryId.startsWith('masu:'))return entryId;
  const masuId=entryId.slice(5);
  if(!masuId)return null;
  const masu=(Array.isArray(masuMons)?masuMons:[]).find(mon=>mon && String(mon.id)===masuId);
  return typeof masu?.baseId==='string' && masu.baseId ? masu.baseId : null;
};
// 「種族」は主血統。ピクシー種ならピクシー・ミーア・パンドラがまとめて候補になる。
// 血統はモンスターの種(baseId)から引くので、個体側には何も保存しない
const speciesChallengeEntryLineageId = (entryId,masuMons=[]) => {
  const baseId=speciesChallengeEntryBaseId(entryId,masuMons);
  return baseId ? monsterLineageOf(baseId).main.id : null;
};
const speciesChallengeAvailableAllyIds = (speciesId,unlockedBaseIds=[],masuMons=[]) => [
  ...(Array.isArray(unlockedBaseIds)?unlockedBaseIds:[]).filter(id=>monsterLineageOf(id).main.id===speciesId),
  ...(Array.isArray(masuMons)?masuMons:[])
    .filter(mon=>mon && mon.id!==null && mon.id!==undefined && monsterLineageOf(mon.baseId).main.id===speciesId)
    .map(mon=>`masu:${String(mon.id)}`),
];
const validateSpeciesChallengeAllySelection = ({speciesId,heroId,allyIds,unlockedBaseIds=[],masuMons=[]}={}) => {
  if(!Array.isArray(allyIds))return { valid:false,reason:'invalid-selection' };
  if(allyIds.length>3)return { valid:false,reason:'too-many-allies' };
  const heroLineageId=speciesChallengeEntryLineageId(heroId,masuMons);
  if(!speciesId || heroLineageId!==speciesId)return { valid:false,reason:'invalid-hero' };
  const available=new Set(speciesChallengeAvailableAllyIds(speciesId,unlockedBaseIds,masuMons));
  const usedEntryIds=new Set([heroId]);
  // 同じモンスター(baseId)は勇者と供モンを通して1体まで。既存の編成画面と同じ決まりで、
  // ベースモンのモッチーを勇者にしたらマスモンのモッチーは連れていけない
  // (ミタラシのように同じ種族でも別のモンスターなら一緒に出せる)
  const usedBaseIds=new Set([speciesChallengeEntryBaseId(heroId,masuMons)].filter(Boolean));
  for(const entryId of allyIds){
    if(!available.has(entryId))return { valid:false,reason:'unavailable-ally',entryId };
    if(usedEntryIds.has(entryId))return { valid:false,reason:entryId===heroId?'same-entry-as-hero':'duplicate-ally',entryId };
    if(speciesChallengeEntryLineageId(entryId,masuMons)!==speciesId)return { valid:false,reason:'different-species',entryId };
    const baseId=speciesChallengeEntryBaseId(entryId,masuMons);
    if(baseId && usedBaseIds.has(baseId))return { valid:false,reason:'same-monster',entryId };
    usedEntryIds.add(entryId);
    if(baseId)usedBaseIds.add(baseId);
  }
  return { valid:true,reason:null };
};
const createSpeciesChallengeRunState = ({speciesId,difficultyId,heroId,allyIds,unlockedBaseIds=[],masuMons=[]}={}) => {
  const validation=validateSpeciesChallengeAllySelection({speciesId,heroId,allyIds,unlockedBaseIds,masuMons});
  if(!validation.valid)return null;
  const run={ speciesId,difficultyId,heroId,allyIds:[...allyIds],joinedAllyIds:[] };
  return run;
};
const speciesChallengeSelectedAllies = (runState) => Array.isArray(runState?.allyIds) ? [...runState.allyIds] : [];
const speciesChallengeUnjoinedAllies = (runState) => {
  const joined=new Set(Array.isArray(runState?.joinedAllyIds)?runState.joinedAllyIds:[]);
  return speciesChallengeSelectedAllies(runState).filter(entryId=>!joined.has(entryId));
};
const joinSpeciesChallengeAlly = (runState,entryId) => {
  const remaining=speciesChallengeUnjoinedAllies(runState);
  if(!remaining.includes(entryId))return { state:runState,joinedAllyId:null };
  return {
    state:{ ...runState,allyIds:speciesChallengeSelectedAllies(runState),joinedAllyIds:[...(runState.joinedAllyIds||[]),entryId] },
    joinedAllyId:entryId,
  };
};
// WAVEクリア時の回復対象判定は供モン加入の成否から独立させる。
// STEP2Cでは実バトルへ接続せず、この結果をデバッグ画面にだけ表示する。
const simulateSpeciesChallengeJoinWave = (runState,entryId=null) => {
  const remaining=speciesChallengeUnjoinedAllies(runState);
  const result=entryId===null
    ? { state:runState,joinedAllyId:null }
    : joinSpeciesChallengeAlly(runState,entryId);
  return { ...result,hadJoinCandidates:remaining.length>0,gutsRecoveryRequired:true };
};
const SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT = 5;
const isSpeciesChallengeDifficultyUnlocked = (difficultyId, clearedDifficultyIds=[]) => {
  const index=SPECIES_CHALLENGE_DIFFICULTY_IDS.indexOf(difficultyId);
  if(index<0)return false;
  if(index<SPECIES_CHALLENGE_INITIAL_UNLOCK_COUNT)return true;
  const cleared=new Set(Array.isArray(clearedDifficultyIds)?clearedDifficultyIds:[]);
  return cleared.has(SPECIES_CHALLENGE_DIFFICULTY_IDS[index-1]);
};
const SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS = Object.freeze({
  Beginner:1, Easy:2, Normal:3, Hard:4, Expert:5, Master:6, GrandMaster:8,
  Hell:10, Legend:12, EXTREME:15, NIGHTMARE:20, CHAOS:25, ULTIMATE:30, INFINITY:40,
});
const speciesChallengeFirstClearReward = (difficultyId) =>
  Object.prototype.hasOwnProperty.call(SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS,difficultyId)
    ? SPECIES_CHALLENGE_FIRST_CLEAR_REWARDS[difficultyId]
    : 0;
const speciesChallengeRewardPendingKey = (speciesId,difficultyId) => `${speciesId}:${difficultyId}`;
// クリアと初回報酬の最終形を作る純粋処理。pendingのtargetCountは「加算値」ではなく
// 絶対所持数なので、保存途中から何度やり直しても同じ所持数へ収束する。
const finalizeSpeciesChallengeClearReward = ({ progress,ownedItems,speciesId,difficultyId }={}) => {
  const currentProgress=normalizeSpeciesChallengeProgress(progress);
  const currentItems=ownedItems && typeof ownedItems==='object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const rewardAmount=speciesChallengeFirstClearReward(difficultyId);
  const itemId=speciesTranscendFruitItemId(speciesId);
  if(!itemId || rewardAmount<=0){
    // 報酬が無い組み合わせでも「クリアした」ことは必ず残す(次の難易度の解放に使うため)
    return { nextProgress:markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId),nextOwnedItems:currentItems,rewardGranted:false,rewardAmount:0 };
  }
  const clearedProgress=markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId);
  const pendingKey=speciesChallengeRewardPendingKey(speciesId,difficultyId);
  if(isSpeciesChallengeFirstRewardClaimed(clearedProgress,speciesId,difficultyId)){
    delete clearedProgress.pendingRewards[pendingKey];
    return { nextProgress:clearedProgress,nextOwnedItems:currentItems,rewardGranted:false,rewardAmount:0 };
  }
  const savedPending=clearedProgress.pendingRewards[pendingKey];
  const pending=savedPending && savedPending.itemId===itemId && savedPending.rewardAmount===rewardAmount
    ? savedPending
    : { speciesId,difficultyId,itemId,rewardAmount,targetCount:ownedItemCount(currentItems,itemId)+rewardAmount };
  const nextOwnedItems={ ...currentItems,[itemId]:Math.max(ownedItemCount(currentItems,itemId),pending.targetCount) };
  const nextProgress=markSpeciesChallengeFirstRewardClaimed(clearedProgress,speciesId,difficultyId);
  delete nextProgress.pendingRewards[pendingKey];
  return { nextProgress,nextOwnedItems,rewardGranted:true,rewardAmount };
};
// 2キーを一括保存できないlocal storageでも安全にする4段階確定。
// pendingを先に残し、実はtargetCountまで、claimed後にpendingを消す。
const persistSpeciesChallengeClearRewardTransaction = async ({ progress,ownedItems,speciesId,difficultyId,storeSet,storeGet,record=null }={}) => {
  const savedProgress=await storeGet(SPECIES_CHALLENGE_PROGRESS_KEY,progress,false);
  const savedItems=await storeGet('mh_owned_items',ownedItems,false);
  let currentProgress=normalizeSpeciesChallengeProgress(savedProgress);
  const currentItems=savedItems && typeof savedItems==='object' && !Array.isArray(savedItems) ? savedItems : {};
  // 自己記録(種族×難易度)は初回かどうかに関係なくクリアのたびに更新する。
  // 報酬の確定より先へ置き、報酬が無い難易度でも記録だけは必ず残す。
  // clears を二重に増やさないよう、呼び出し側は1ランにつき1回だけ呼ぶこと。
  if(record){
    currentProgress=updateSpeciesChallengeRecord(currentProgress,speciesId,difficultyId,record);
    await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,currentProgress,false);
  }
  const rewardAmount=speciesChallengeFirstClearReward(difficultyId);
  const itemId=speciesTranscendFruitItemId(speciesId);
  if(!itemId || rewardAmount<=0){
    // 報酬が無くてもクリア済みは保存する。ここを保存し忘れると次の難易度が解放されない
    const result=finalizeSpeciesChallengeClearReward({progress:currentProgress,ownedItems:currentItems,speciesId,difficultyId});
    await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,result.nextProgress,false);
    return result;
  }
  const pendingKey=speciesChallengeRewardPendingKey(speciesId,difficultyId);
  if(isSpeciesChallengeFirstRewardClaimed(currentProgress,speciesId,difficultyId)){
    const result=finalizeSpeciesChallengeClearReward({progress:currentProgress,ownedItems:currentItems,speciesId,difficultyId});
    if(currentProgress.pendingRewards[pendingKey])await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,result.nextProgress,false);
    return result;
  }
  const savedPending=currentProgress.pendingRewards[pendingKey];
  const pending=savedPending && savedPending.itemId===itemId && savedPending.rewardAmount===rewardAmount
    ? savedPending
    : { speciesId,difficultyId,itemId,rewardAmount,targetCount:ownedItemCount(currentItems,itemId)+rewardAmount };
  const pendingProgress=markSpeciesChallengeCleared(currentProgress,speciesId,difficultyId);
  pendingProgress.pendingRewards[pendingKey]=pending;
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,pendingProgress,false);
  const latestItems=await storeGet('mh_owned_items',currentItems,false);
  const safeLatestItems=latestItems && typeof latestItems==='object' && !Array.isArray(latestItems)?latestItems:currentItems;
  const nextOwnedItems={ ...safeLatestItems,[itemId]:Math.max(ownedItemCount(safeLatestItems,itemId),pending.targetCount) };
  await storeSet('mh_owned_items',nextOwnedItems,false);
  const claimedProgress=markSpeciesChallengeFirstRewardClaimed(pendingProgress,speciesId,difficultyId);
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,claimedProgress,false);
  const nextProgress=normalizeSpeciesChallengeProgress(claimedProgress);
  delete nextProgress.pendingRewards[pendingKey];
  await storeSet(SPECIES_CHALLENGE_PROGRESS_KEY,nextProgress,false);
  return { nextProgress,nextOwnedItems,rewardGranted:true,rewardAmount };
};
// 同一タブ内の別クリアが同時に走ってprogressを上書きし合わないよう、保存処理は直列化する。
// 1件が保存エラーになっても後続の復旧処理を止めない。
let speciesChallengeRewardPersistenceQueue=Promise.resolve();
const persistSpeciesChallengeClearReward = (args={}) => {
  const task=speciesChallengeRewardPersistenceQueue.then(()=>persistSpeciesChallengeClearRewardTransaction(args));
  speciesChallengeRewardPersistenceQueue=task.catch(()=>{});
  return task;
};
const EXTREME_SETTING = EXTREME_DIFFICULTIES[0];
const NIGHTMARE_SETTING = EXTREME_DIFFICULTIES[1];
const CHAOS_SETTING = EXTREME_DIFFICULTIES[2];
// 正式プレイとデバッグ戦で同じ定義を参照し、数値と特殊ルールを二重管理しない。
const ULTIMATE_SETTING = EXTREME_DIFFICULTIES[3];
const INFINITY_SETTING = EXTREME_DIFFICULTIES[4];
// GODは極限チャレンジの正式な最上位難易度。バトルデバッグも同じ定義を参照する。
const GOD_SETTING = Object.freeze({ id:'GOD', label:'GOD', japanese:'ゴッド', available:true, debugAvailable:true, power:100, score:20, xp:60, gold:40, psyche:100, waveCount:10, unlockRequirement:'INFINITY', rankingId:'ExtremeGOD', recordId:'GOD', description:'神威が2WAVEごとに上昇し、既存の極限統合ルールが段階的に苛烈になる最上位難易度。', cardDescription:'2WAVEごとに神威が上昇。累計ターン圧と20TごとのDISTANCE BREAKを受ける。', specialRules:Object.freeze({ assistCardEffect:0.5, positiveModifier:0.5, negativeModifier:2.0, distanceEnhancement:0.5, gutsCost:1.5, enemyTurnRate:0.0075, allyJoinPenaltyRate:0.0075, minimumAllyJoinBonus:0.10, damageTurnRate:0.0125, minimumDamageDealt:0.25, awakeningPenaltyRate:0.0075, awakeningZeroTurns:20, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:20, damageDealtPerLevel:0.5, safeDistanceCount:1, persistsForRun:true }) }) });
// RAGNAROKはGODの次の極限難易度。黄昏が2WAVEごとに深まり、W5とW10のボスは倒しても起き上がる。
// 「不死(revival)」は数値ではなく形のあるルールなので、他の倍率と同じく specialRules へ持たせ、
// バトル側は難易度名ではなく「そのルールを持っているか」だけを見る(難易度を足しても分岐が増えない)。
const RAGNAROK_SETTING = Object.freeze({ id:'RAGNAROK', label:'RAGNAROK', japanese:'ラグナロク', available:true, debugAvailable:true, power:200, score:20, xp:80, gold:60, psyche:130, waveCount:10, unlockRequirement:'GOD', rankingId:'ExtremeRAGNAROK', recordId:'RAGNAROK', description:'黄昏が2WAVEごとに深まり、WAVE5とWAVE10のボスは倒しても起き上がる、極限チャレンジの最終難易度。', cardDescription:'2WAVEごとに黄昏が深まる。ボスは死者の再起で蘇り、15TごとのDISTANCE BREAKに安全距離はない。', specialRules:Object.freeze({ assistCardEffect:0.35, positiveModifier:0.35, negativeModifier:2.5, distanceEnhancement:0.35, gutsCost:1.75, enemyTurnRate:0.01, allyJoinPenaltyRate:0.01, minimumAllyJoinBonus:0.05, damageTurnRate:0.015, minimumDamageDealt:0.20, awakeningPenaltyRate:0.0075, awakeningZeroTurns:15, awakeningPenaltyExcludes:Object.freeze(['distance']), distanceBreak:Object.freeze({ interval:15, damageDealtPerLevel:0.5, safeDistanceCount:0, persistsForRun:true }), revival:Object.freeze({ waves:Object.freeze({ 5:1, 10:2 }), hpRate:0.5, atkBoostPerRevival:0.5 }) }) });
const ALL_EXTREME_DIFFICULTIES = Object.freeze([...EXTREME_DIFFICULTIES,GOD_SETTING,RAGNAROK_SETTING]);
// 極限チャレンジの難易度カラー。カード構造は共通のまま、上位ほど発光を少しずつ強める。
// 常時アニメーションは使わず、iPhone縦画面でも視認性と軽さを優先する。
const EXTREME_DIFFICULTY_THEMES = Object.freeze({
  EXTREME:Object.freeze({accent:'#f0abfc',rgb:'232,121,249',background:'linear-gradient(180deg,#34133f,#160d2b)',action:'linear-gradient(135deg,#a21caf,#d946ef)',actionText:'#ffffff',glow:0.26,titleGlow:0.40,actionGlow:0.24,shadowBlur:28}),
  NIGHTMARE:Object.freeze({accent:'#c4b5fd',rgb:'139,92,246',background:'linear-gradient(180deg,#25143f,#110b26)',action:'linear-gradient(135deg,#6d28d9,#8b5cf6)',actionText:'#ffffff',glow:0.30,titleGlow:0.44,actionGlow:0.28,shadowBlur:30}),
  CHAOS:Object.freeze({accent:'#fda4af',rgb:'244,63,94',background:'linear-gradient(180deg,#3d111f,#1d0a13)',action:'linear-gradient(135deg,#be123c,#f43f5e)',actionText:'#ffffff',glow:0.34,titleGlow:0.48,actionGlow:0.32,shadowBlur:32}),
  ULTIMATE:Object.freeze({accent:'#fdba74',rgb:'249,115,22',background:'linear-gradient(180deg,#3b1a0a,#1e0d08)',action:'linear-gradient(135deg,#c2410c,#f97316)',actionText:'#ffffff',glow:0.38,titleGlow:0.52,actionGlow:0.36,shadowBlur:34}),
  INFINITY:Object.freeze({accent:'#93c5fd',rgb:'59,130,246',background:'linear-gradient(180deg,#11224d,#09112c)',action:'linear-gradient(135deg,#1d4ed8,#3b82f6)',actionText:'#ffffff',glow:0.42,titleGlow:0.56,actionGlow:0.40,shadowBlur:36}),
  GOD:Object.freeze({accent:'#fde68a',rgb:'245,158,11',background:'linear-gradient(180deg,#3b2b08,#181106)',action:'linear-gradient(135deg,#a16207,#f59e0b)',actionText:'#1c1917',glow:0.48,titleGlow:0.66,actionGlow:0.48,shadowBlur:40}),
  // 金(GOD)の上は色を足すのではなく抜く。白銀に蒼い縁を残した「黄昏」の色にして、最上位だと一目で分かるようにする
  RAGNAROK:Object.freeze({accent:'#e2e8f0',rgb:'148,163,184',background:'linear-gradient(180deg,#1c2333,#080b12)',action:'linear-gradient(135deg,#475569,#cbd5e1)',actionText:'#0f172a',glow:0.54,titleGlow:0.74,actionGlow:0.54,shadowBlur:44}),
});
const extremeDifficultyTheme = (difficultyId) => EXTREME_DIFFICULTY_THEMES[difficultyId] || EXTREME_DIFFICULTY_THEMES.EXTREME;
const PUBLIC_EXTREME_DIFFICULTIES = Object.freeze(ALL_EXTREME_DIFFICULTIES.filter(setting=>setting.available));
// 2WAVEごとに1段上がる段階(Lv1〜5)。GODの「神威」もRAGNAROKの「黄昏」も刻み方は同じで、
// 段ごとに何を締めるかだけが違う。刻み方をここへ1つだけ置き、難易度側は中身の表だけを持つ。
const extremeWaveStageLevel = (waveNumber) => Math.max(1,Math.min(5,Math.floor((Math.max(1,Number(waveNumber)||1)-1)/2)+1));
const godDivinityLevel = (waveNumber) => extremeWaveStageLevel(waveNumber);
const godDivinityRules = (waveNumber) => {
  const level=godDivinityLevel(waveNumber);
  return Object.freeze({
    level,
    enemyMultiplier:1+level*0.15,
    gutsCost:level>=2?1.75:1.5,
    distanceEnhancement:level>=3?0.35:0.5,
    positiveModifier:level>=4?0.35:0.5,
    negativeModifier:level>=4?2.5:2.0,
    damageTurnRate:level>=5?0.015:0.0125,
    minimumDamageDealt:level>=5?0.20:0.25,
    safeDistanceCount:level>=5?0:1,
  });
};
// RAGNAROKの黄昏。GODの神威と同じ2WAVE刻みで、開始時点の値も各段の締め方も一段きつくする。
// 安全距離はLv1から0（GODはLv5でようやく0になる）。
const ragnarokTwilightLevel = (waveNumber) => extremeWaveStageLevel(waveNumber);
const ragnarokTwilightRules = (waveNumber) => {
  const level=ragnarokTwilightLevel(waveNumber);
  return Object.freeze({
    level,
    enemyMultiplier:1+level*0.20,
    gutsCost:level>=3?2.0:1.75,
    distanceEnhancement:level>=2?0.25:0.35,
    positiveModifier:level>=4?0.25:0.35,
    negativeModifier:level>=4?3.0:2.5,
    damageTurnRate:level>=5?0.0175:0.015,
    minimumDamageDealt:level>=5?0.15:0.20,
    safeDistanceCount:0,
  });
};
// 「WAVEで段階が動く難易度」の一覧。ここに1行足せば、実効倍率・与ダメ・BREAK・表示まで
// すべて同じ経路を通るので、難易度名の分岐を各所へ書き足さなくてよい。
const EXTREME_WAVE_STAGES = Object.freeze({
  GOD:Object.freeze({ label:'神威', rules:godDivinityRules }),
  RAGNAROK:Object.freeze({ label:'黄昏', rules:ragnarokTwilightRules }),
});
const extremeWaveStage = (difficultyId) => EXTREME_WAVE_STAGES[difficultyId] || null;
const extremeWaveStageRules = (difficultyId,waveNumber=1) => extremeWaveStage(difficultyId)?.rules(waveNumber) || null;
const extremeWaveStageLabel = (difficultyId) => extremeWaveStage(difficultyId)?.label || '';
// 段階ぶんの敵倍率。段階を持たない難易度では1倍(既存の挙動のまま)。
const extremeWaveEnemyMultiplier = (difficultyId,waveNumber=1) => extremeWaveStageRules(difficultyId,waveNumber)?.enemyMultiplier ?? 1;
const extremeRuleSetting = (difficultyId) => ALL_EXTREME_DIFFICULTIES.find(setting=>setting.id===difficultyId)||null;
// クイックの極限難易度は極限チャレンジ本体の報酬を変更せず、依頼された基準倍率だけを
// クイック用に持つ。敵強度と表示色は既存の難易度定義を再利用する。
const QUICK_ULTIMATE_SETTING = Object.freeze({
  label:'ULTIMATE', power:ULTIMATE_SETTING.power, xp:35, gold:12, psyche:60, bg:'#3f0d5e', text:'#f5d0fe',
});
const QUICK_EXTREME_SETTINGS = Object.freeze({
  EXTREME: { label:'EXTREME', power:EXTREME_SETTING.power, xp:20, gold:4.5, psyche:30, bg:'#a21caf', text:'#f0abfc' },
  NIGHTMARE: { label:'NIGHTMARE', power:NIGHTMARE_SETTING.power, xp:25, gold:6, psyche:40, bg:'#6b21a8', text:'#e9d5ff' },
  CHAOS: { label:'CHAOS', power:CHAOS_SETTING.power, xp:30, gold:9, psyche:50, bg:'#581c87', text:'#f5d0fe' },
  ULTIMATE: QUICK_ULTIMATE_SETTING,
});
const QUICK_DIFFICULTY_SETTINGS = Object.freeze({
  ...DIFFICULTY_SETTINGS,
  ...QUICK_EXTREME_SETTINGS,
});
const quickDifficultySetting = (difficultyId) => difficultyId===ULTIMATE_SETTING.id
  ? QUICK_ULTIMATE_SETTING : QUICK_DIFFICULTY_SETTINGS[difficultyId];
const extremeDifficultySetting = (difficultyId) => extremeRuleSetting(difficultyId);
const extremeSpecialRule = (difficultyId, rule) =>
  extremeDifficultySetting(difficultyId)?.specialRules?.[rule] ?? 1;
const effectiveExtremeSpecialRule = (difficultyId, rule, waveNumber=1) => {
  const staged=extremeWaveStageRules(difficultyId,waveNumber);
  if(staged && Object.prototype.hasOwnProperty.call(staged,rule))return staged[rule];
  return extremeSpecialRule(difficultyId,rule);
};
const hasExtremeSpecialRules = (difficultyId) => {
  const rules=extremeDifficultySetting(difficultyId)?.specialRules;
  return !!rules && Object.keys(rules).length > 0;
};
// 「その難易度がそのルールを持っているか」で効かせるための取り出し口。
// 難易度名でハードコードすると、難易度を足すたびに同じ判定を書き足すことになるため、
// ターン系ルール(敵強化・加入B低下・与ダメ低下・トレーニング低下・DISTANCE BREAK)は
// すべてここを通す。持っていない難易度では null が返り、既存の挙動は変わらない。
const extremeRuleNumber = (difficultyId, rule) => {
  const value=extremeDifficultySetting(difficultyId)?.specialRules?.[rule];
  return Number.isFinite(value) ? value : null;
};
const extremeDistanceBreakRule = (difficultyId) => {
  const rule=extremeDifficultySetting(difficultyId)?.specialRules?.distanceBreak;
  return rule && Number.isFinite(rule.interval) && rule.interval>0 ? rule : null;
};
const effectiveExtremeDistanceBreakRule = (difficultyId,waveNumber=1) => {
  const rule=extremeDistanceBreakRule(difficultyId);
  const staged=extremeWaveStageRules(difficultyId,waveNumber);
  return rule&&staged&&Number.isFinite(staged.safeDistanceCount)?{...rule,safeDistanceCount:staged.safeDistanceCount}:rule;
};
// 不死(死者の再起)。倒したWAVEごとに何回まで起き上がるかを持つ難易度だけが対象で、
// 持たない難易度ではnullが返り、撃破処理はこれまでどおり一度で確定する。
const extremeRevivalRule = (difficultyId) => {
  const rule=extremeDifficultySetting(difficultyId)?.specialRules?.revival;
  return rule && rule.waves && typeof rule.waves === 'object' ? rule : null;
};
const extremeRevivalCount = (difficultyId,waveNumber) => {
  const count=Math.floor(Number(extremeRevivalRule(difficultyId)?.waves?.[Math.floor(Number(waveNumber)||0)]));
  return Number.isFinite(count) && count>0 ? count : 0;
};
// 起き上がったあとのライフと攻撃力。maxHpは変えず、いま何回目の復活かで攻撃力だけを積む。
// 呼び出し側が渡した usedCount(これまでに使った復活回数)が上限に達していればnull。
const extremeRevivedEnemyStats = (enemy,difficultyId,waveNumber,usedCount=0) => {
  const rule=extremeRevivalRule(difficultyId);
  const used=Math.max(0,Math.floor(Number(usedCount)||0));
  if(!enemy||!rule||used>=extremeRevivalCount(difficultyId,waveNumber))return null;
  const maxHp=Math.max(1,Math.floor(Number(enemy.maxHp)||0));
  const rawHpRate=Number(rule.hpRate);
  const hpRate=Number.isFinite(rawHpRate)?Math.max(0,Math.min(1,rawHpRate)):0.5;
  const rawBoost=Number(rule.atkBoostPerRevival);
  const boost=Number.isFinite(rawBoost)?Math.max(0,rawBoost):0;
  return {
    hp:Math.max(1,Math.floor(maxHp*hpRate)),
    atk:Math.floor(Math.max(0,Number(enemy.atk)||0)*(1+boost)),
    revivalNumber:used+1,
    remaining:extremeRevivalCount(difficultyId,waveNumber)-(used+1),
  };
};
// 極限本体だけでなく、同名のクイック極限難易度も同じspecialRulesを参照する。
// これにより今後の難易度もEXTREME_DIFFICULTIESへ定義を足すだけでクイックへ引き継がれる。
const specialRuleDifficultyForRun = (runMode, difficultyId, extremeRun=false, extremeDifficultyId=null) => {
  const candidate=extremeRun ? extremeDifficultyId : (isQuickMode(runMode) ? difficultyId : null);
  return hasExtremeSpecialRules(candidate) ? candidate : null;
};
// クイックULTIMATEだけ、通常10%から同じWAVEのターン数に応じたULTIMATE覚醒低下率を引く。
// 低下率はULTIMATE本体のspecialRulesを参照し、クイック側には数値を重複定義しない。
const quickGrowthRateForRun = (runMode, difficultyId, waveTurnCount) => {
  const specialDifficulty=specialRuleDifficultyForRun(runMode,difficultyId);
  const penaltyRate=extremeRuleNumber(specialDifficulty,'awakeningPenaltyRate');
  if(penaltyRate==null) return QUICK_GROWTH_MULT-1;
  return Math.max(0,(QUICK_GROWTH_MULT-1)-Math.max(0,Number(waveTurnCount)||0)*penaltyRate);
};
const specialRulePercent = (value) => `${Math.round((Number(value)||0)*100)}%`;
const compactPercent = (value) => `${Number(((Number(value)||0)*100).toFixed(1))}%`;
const precisePercent = (value) => `${Number(((Number(value)||0)*100).toFixed(2))}%`;
// バトル中の細い帯に並べる短い1行表記。静的な倍率だけを持つ難易度で使う。
// ターンで動く難易度(ULTIMATE / INFINITY)はこの帯を使わず、現在値を出す専用表示と
// 「ルール詳細」(extremeRuleDetailGroups)を使うので、ここに数値を書き写さない。
const extremeSpecialRuleLines = (difficultyId) => {
  if (difficultyId===NIGHTMARE_SETTING.id) return [
    ['強化',specialRulePercent(extremeSpecialRule(difficultyId,'waveEnhancement'))],
    ['＋補正',specialRulePercent(extremeSpecialRule(difficultyId,'positiveModifier'))],
    ['－補正',specialRulePercent(extremeSpecialRule(difficultyId,'negativeModifier'))],
  ];
  if (difficultyId===CHAOS_SETTING.id) return [
    ['与ダメ',specialRulePercent(extremeSpecialRule(difficultyId,'damageDealt'))],
    ['消費ガッツ',specialRulePercent(extremeSpecialRule(difficultyId,'gutsCost'))],
    ['加入B',specialRulePercent(extremeSpecialRule(difficultyId,'allyJoinBonus'))],
  ];
  const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};
  const lines=[];
  if (rules.assistCardEffect != null) lines.push(['アシストカード効果',specialRulePercent(rules.assistCardEffect)]);
  if (rules.waveEnhancement != null) lines.push(['WAVE後強化',specialRulePercent(rules.waveEnhancement)]);
  if (rules.positiveModifier != null || rules.negativeModifier != null) {
    const signed=`＋${specialRulePercent(rules.positiveModifier ?? 1)} / −${specialRulePercent(rules.negativeModifier ?? 1)}`;
    lines.push(['自動回復補正',signed],['距離適性補正',signed]);
  }
  if (rules.damageDealt != null) lines.push(['与ダメージ',specialRulePercent(rules.damageDealt)]);
  if (rules.allyJoinBonus != null) lines.push(['供モン加入ボーナス',specialRulePercent(rules.allyJoinBonus)]);
  if (rules.gutsCost != null) lines.push(['消費ガッツ',specialRulePercent(rules.gutsCost)]);
  const known=new Set(['assistCardEffect','waveEnhancement','positiveModifier','negativeModifier','damageDealt','allyJoinBonus','gutsCost']);
  // 倍率以外(ターン率・DISTANCE BREAKの設定など)はこの1行表記では表せないので、ここへ混ぜない
  Object.entries(rules).filter(([rule,value])=>!known.has(rule)&&Number.isFinite(value))
    .forEach(([rule,value])=>lines.push([rule,specialRulePercent(value)]));
  return lines;
};
// 「1Tごと-0.75pt」のような表記。0.0075→0.75pt、0.01→1.0pt。
const turnPointText = (rate) => {
  const point=Number(((Number(rate)||0)*100).toFixed(2));
  return `${Number.isInteger(point)?point.toFixed(1):point}pt`;
};
// ルール詳細・バトル開始案内・ヘルプが同じ本文を使うための正本。
// 難易度カードは「特殊ルールがある」ことだけを出し、中身はここから作った詳細で読ませる。
// 値はすべて specialRules から組み立てるので、数値を別の場所へ書き写さない。
const extremeRuleDetailGroups = (difficultyId, quick=false) => {
  const rules=extremeDifficultySetting(difficultyId)?.specialRules || {};
  const groups=[];
  const push=(title,lines)=>{const kept=lines.filter(Boolean);if(kept.length)groups.push({title,lines:kept});};
  if(difficultyId===GOD_SETTING.id)push('神威',[
    ['進行','2WAVEごとにLv上昇（W1-2:Lv1 ～ W9-10:Lv5）'],
    ['敵HP/攻撃','神威Lvごと +15% / +30% / +45% / +60% / +75%'],
    ['Lv5','与ダメ低下 -1.5pt/T・最低20%、次のBREAKから安全距離なし'],
  ]);
  if(difficultyId===RAGNAROK_SETTING.id)push('黄昏',[
    ['進行','2WAVEごとにLv上昇（W1-2:Lv1 ～ W9-10:Lv5）'],
    ['敵HP/攻撃','黄昏Lvごと +20% / +40% / +60% / +80% / +100%'],
    ['Lv2','距離強化 35%→25%'],
    ['Lv3','消費ガッツ 175%→200%'],
    ['Lv4','＋補正 35%→25%・−補正 250%→300%'],
    ['Lv5','与ダメ低下 -1.75pt/T・最低15%'],
  ]);
  push('カード',[
    rules.assistCardEffect!=null&&['アシストカード効果',specialRulePercent(rules.assistCardEffect)],
  ]);
  push('補正',[
    rules.waveEnhancement!=null&&['WAVE後強化',specialRulePercent(rules.waveEnhancement)],
    rules.positiveModifier!=null&&['＋補正',specialRulePercent(rules.positiveModifier)],
    rules.negativeModifier!=null&&['－補正',specialRulePercent(rules.negativeModifier)],
    rules.distanceEnhancement!=null&&['距離強化',specialRulePercent(rules.distanceEnhancement)],
  ]);
  push('ダメージ・ガッツ',[
    rules.damageDealt!=null&&['与ダメージ',specialRulePercent(rules.damageDealt)],
    rules.allyJoinBonus!=null&&['供モン加入ボーナス',specialRulePercent(rules.allyJoinBonus)],
    rules.gutsCost!=null&&['消費ガッツ',specialRulePercent(rules.gutsCost)],
  ]);
  push('累計ターン',[
    rules.enemyTurnRate!=null&&['敵HP/攻撃',`累計Tごと+${precisePercent(rules.enemyTurnRate)}`],
    rules.allyJoinPenaltyRate!=null&&['加入B倍率',`累計Tごと-${turnPointText(rules.allyJoinPenaltyRate)}${rules.minimumAllyJoinBonus!=null?`（最低${specialRulePercent(rules.minimumAllyJoinBonus)}）`:''}`],
    rules.damageTurnRate!=null&&['与ダメ倍率',`経過Tごと-${turnPointText(rules.damageTurnRate)}（${specialRulePercent(rules.minimumDamageDealt??0)}で停止）`],
  ]);
  push('WAVEターン',[
    // クイックの自動成長は成長率そのものから引く(10%→…)ので「pt」、
    // トレーニングは増える量へ掛かるので「%」。掛かり方が違うので言い方も分ける
    quick
      ? (rules.awakeningPenaltyRate!=null&&['自動成長',`WAVE Tごと-${turnPointText(rules.awakeningPenaltyRate)}`])
      : (rules.awakeningZeroTurns>0&&['トレーニング',`強化量が WAVE Tごと-${precisePercent(1/rules.awakeningZeroTurns)}（${rules.awakeningZeroTurns}Tで0%）`]),
    (quick?rules.awakeningPenaltyRate!=null:rules.awakeningZeroTurns>0)&&Array.isArray(rules.awakeningPenaltyExcludes)&&rules.awakeningPenaltyExcludes.includes('distance')&&['対象外','距離強化は下がらない'],
  ]);
  const breakRule=extremeDistanceBreakRule(difficultyId);
  if(breakRule)push('DISTANCE BREAK',[
    ['進行',`累計${breakRule.interval}Tごと1距離の弱体Lv上昇`],
    ['弱体倍率',`Lv1 ${specialRulePercent(breakRule.damageDealtPerLevel)} / Lv2 ${specialRulePercent(breakRule.damageDealtPerLevel**2)} / Lv3 ${compactPercent(breakRule.damageDealtPerLevel**3)}（以降も半減）`],
    ['安全距離',breakRule.safeDistanceCount>0?`${breakRule.safeDistanceCount}距離は最後まで弱体化しない`:'なし（4距離すべて弱体化する）'],
  ]);
  const revivalRule=extremeRevivalRule(difficultyId);
  if(revivalRule)push('不死（死者の再起）',[
    ['対象',Object.entries(revivalRule.waves).map(([waveNumber,count])=>`WAVE${waveNumber}（${count}回）`).join(' / ')],
    ['復活時',`ライフ${specialRulePercent(revivalRule.hpRate)}で起き上がる（最大ライフは変わらない）`],
    ['起き上がるたび',`敵の攻撃力 +${specialRulePercent(revivalRule.atkBoostPerRevival)}`],
  ]);
  return groups;
};
// カードには中身を並べず、特殊ルールがあることだけを出す(INFINITYは種類が多いので複合と書く)
const extremeRuleSummaryText = (difficultyId) =>
  extremeRuleDetailGroups(difficultyId).length>=4 ? '複合特殊ルールあり' : '特殊ルールあり';
// 特殊倍率は、既存式が出した最終的な獲得量・補正値へだけ掛ける。
const applyNightmareSignedModifier = (value, specialDifficulty=null, waveNumber=1) => value * (specialDifficulty
  ? effectiveExtremeSpecialRule(specialDifficulty, value >= 0 ? 'positiveModifier' : 'negativeModifier',waveNumber) : 1);
const applyNightmareWaveEnhancement = (value, specialDifficulty=null) => value * (specialDifficulty
  ? extremeSpecialRule(specialDifficulty, 'waveEnhancement') : 1);
const applyNightmareStatGain = (before, normalAfter, specialDifficulty=null) => before
  + Math.floor(applyNightmareWaveEnhancement(normalAfter - before, specialDifficulty));
// WAVE後に増える「距離強化」だけへ掛ける倍率。
// NIGHTMAREは waveEnhancement でWAVE後強化そのものが50%になるのでそれをそのまま使う。
// INFINITYは距離強化だけを50%にし、通常トレーニングへは重ねないので専用ルールを持つ
// (ここで分けておかないと、ULTIMATE由来のトレーニング低下と50%が二重に掛かってしまう)。
const applyDistanceEnhancement = (value, specialDifficulty=null, waveNumber=1) => {
  const distanceRate=extremeWaveStage(specialDifficulty)?effectiveExtremeSpecialRule(specialDifficulty,'distanceEnhancement',waveNumber):extremeRuleNumber(specialDifficulty,'distanceEnhancement');
  return distanceRate!=null ? value*distanceRate : applyNightmareWaveEnhancement(value,specialDifficulty);
};
const ultimateEnemyTurnMultiplier = (turns, specialDifficulty=ULTIMATE_SETTING.id) => {
  const rate=extremeRuleNumber(specialDifficulty,'enemyTurnRate');
  return rate==null ? 1 : 1 + Math.max(0,Number(turns)||0)*rate;
};
const pendingUltimateDistanceBreak = (totalTurns, breakLevels, waveNumber, specialDifficulty=null) => {
  const breakRule=extremeDistanceBreakRule(specialDifficulty);
  if(!breakRule||Number(waveNumber)>=10)return null;
  const appliedCount=Array.isArray(breakLevels)?breakLevels.reduce((sum,level)=>sum+(Number(level)||0),0):0;
  const threshold=(appliedCount+1)*breakRule.interval;
  return (Number(totalTurns)||0)>=threshold?threshold:null;
};
const drawUltimateDistanceBreak = (breakLevels, random=Math.random, safeDistanceCount=1) => {
  const levels=RANGE_LABELS.map((_,index)=>Math.max(0,Number(breakLevels?.[index])||0));
  const activeCount=levels.filter(level=>level>0).length;
  const minimumActiveLevel=activeCount?Math.min(...levels.filter(level=>level>0)):0;
  const maxActive=Math.max(0,RANGE_LABELS.length-Math.max(0,Number(safeDistanceCount)||0));
  const candidates=RANGE_LABELS.map((_,index)=>index).filter(index=>activeCount<maxActive?levels[index]===0:levels[index]===minimumActiveLevel);
  if(!candidates.length)return null;
  const roll=Math.max(0,Math.min(0.999999999999,Number(random())||0));
  return candidates[Math.floor(roll*candidates.length)];
};
const applyUltimateDistanceBreak = (damage, slotIndex, breakLevels, specialDifficulty=null, cardType=null) => {
  const breakRule=extremeDistanceBreakRule(specialDifficulty);
  const isMonsterAttack=['atk','range_atk','unique'].includes(cardType);
  const level=Math.max(0,Number(breakLevels?.[slotIndex])||0);
  return breakRule&&isMonsterAttack&&level>0
    ? Math.floor((Number(damage)||0)*(breakRule.damageDealtPerLevel**level)) : damage;
};
// 与ダメ低下・加入B低下はどちらも「1 - 経過T×率」で、下限だけ難易度ごとに違う。
// 下限を書いていない難易度(ULTIMATE の加入B)は0止まりで、これまでどおりの挙動になる。
const ultimateDamageTurnMultiplier = (turns, specialDifficulty=null) => {
  const rate=extremeRuleNumber(specialDifficulty,'damageTurnRate');
  if(rate==null)return 1;
  return Math.max(extremeRuleNumber(specialDifficulty,'minimumDamageDealt')??0,1-Math.max(0,Number(turns)||0)*rate);
};
// 段階を持つ難易度は、その難易度・そのWAVEの段階が持つ低下率と下限を使う。
const extremeStagedDamageTurnMultiplier = (turns,difficultyId,waveNumber) => {
  const staged=extremeWaveStageRules(difficultyId,waveNumber);
  if(!staged)return 1;
  return Math.max(staged.minimumDamageDealt,1-Math.max(0,Number(turns)||0)*staged.damageTurnRate);
};
const godDamageTurnMultiplier = (turns,waveNumber) => extremeStagedDamageTurnMultiplier(turns,GOD_SETTING.id,waveNumber);
const extremeDamageTurnMultiplier = (turns,specialDifficulty=null,waveNumber=1) => extremeWaveStage(specialDifficulty)
  ? extremeStagedDamageTurnMultiplier(turns,specialDifficulty,waveNumber) : ultimateDamageTurnMultiplier(turns,specialDifficulty);
const extremeSpecialDamageMultiplier = (turns,slotIndex,breakLevels,specialDifficulty=null,waveNumber=1,cardType=null) => {
  const turnMultiplier=extremeDamageTurnMultiplier(turns,specialDifficulty,waveNumber);
  const breakRule=effectiveExtremeDistanceBreakRule(specialDifficulty,waveNumber);
  const level=Math.max(0,Number(breakLevels?.[slotIndex])||0);
  const isMonsterAttack=['atk','range_atk','unique'].includes(cardType);
  const breakMultiplier=breakRule&&isMonsterAttack&&level>0?breakRule.damageDealtPerLevel**level:1;
  return turnMultiplier*breakMultiplier;
};
// 段階を持つ難易度の与ダメージ。倍率をすべて掛け合わせてから1回だけ切り捨てる
// (途中でfloorすると、段階とBREAKが重なったときに丸め落ちが二重に効いてしまう)。
const applyExtremeStagedDamage = (damage,turns,slotIndex,breakLevels,difficultyId,waveNumber,cardType=null) =>
  Math.floor((Number(damage)||0)*extremeSpecialDamageMultiplier(turns,slotIndex,breakLevels,difficultyId,waveNumber,cardType));
const applyGodSpecialDamage = (damage,turns,slotIndex,breakLevels,waveNumber,cardType=null) =>
  applyExtremeStagedDamage(damage,turns,slotIndex,breakLevels,GOD_SETTING.id,waveNumber,cardType);
const ultimateAllyJoinMultiplier = (turns, specialDifficulty=ULTIMATE_SETTING.id) => {
  const rate=extremeRuleNumber(specialDifficulty,'allyJoinPenaltyRate');
  if(rate==null)return 1;
  return Math.max(extremeRuleNumber(specialDifficulty,'minimumAllyJoinBonus')??0,1-Math.max(0,Number(turns)||0)*rate);
};
// トレーニングで「上がる量」へ掛かる倍率。awakeningZeroTurns ターンでちょうど0になる
// (ULTIMATE / INFINITYは20T)。1ターンあたりの下がり幅は 1 / awakeningZeroTurns。
// **率から引くのではなく、増加量へ掛ける。** 率から引くと、ちから+5%・ガッツ+5%のように
// 元の率が小さい項目だけが先に増加0になり、ライフ・丈夫さ(+20%)との差が開きすぎる。
// クイックの自動成長は成長率そのものから引く別の計算(awakeningPenaltyRate)なので、
// ここと同じ数字を使い回さない。
const trainingGainRate = (turns, specialDifficulty=null) => {
  const zeroTurns=extremeRuleNumber(specialDifficulty,'awakeningZeroTurns');
  if(zeroTurns==null||zeroTurns<=0)return 1;
  return Math.max(0,1-Math.max(0,Number(turns)||0)/zeroTurns);
};
// ===== トレーニング(WAVEクリアごとの強化。旧「能力覚醒」) =====
// 4種類から2回選ぶ。同じ項目を2回選んでもよく、その場合は1回目を適用した結果へ
// 2回目をかける(2回分をまとめて足す別計算にはしない)。
// クイックモードはこの画面を通らず自動成長するため、ここは影響しない。
const TRAINING_PICK_COUNT = 2;
const TRAINING_OPTIONS = Object.freeze([
  Object.freeze({ id:'hp',   name:'走り込み',   stat:'hp',   flat:0, rate:0.20, statLabel:'ライフ',  effect:'ライフ +20%' }),
  Object.freeze({ id:'atk',  name:'ドミノ倒し', stat:'atk',  flat:0, rate:0.05, statLabel:'ちから',  effect:'ちから +5%' }),
  Object.freeze({ id:'def',  name:'丸太うけ',   stat:'def',  flat:0, rate:0.20, statLabel:'丈夫さ',  effect:'丈夫さ +20%' }),
  Object.freeze({ id:'guts', name:'猛勉強',     stat:'guts', flat:5, rate:0.05, statLabel:'ガッツ',  effect:'ガッツ +5 ＆ +5%' }),
]);
const chooseAutoTrainingPicks = (strategy, rng=Math.random) => {
  const fixed={offense:['atk','guts'],defense:['hp','def'],guts:['guts','guts']}[strategy];
  if(fixed)return [...fixed];
  return Array.from({length:TRAINING_PICK_COUNT},()=>{
    const roll=Math.max(0,Math.min(0.999999999999,Number(rng())||0));
    return TRAINING_OPTIONS[Math.floor(roll*TRAINING_OPTIONS.length)].id;
  });
};

// 手動画面へ実際に提示された合法候補だけから選ぶ。ラン開始時は全候補、
// WAVE後は所持済みかつLv2未満の候補を優先し、同条件内はランダムにする。
const chooseAutoTeachingCard = (candidates, owned, isInitial, rng=Math.random) => {
  if (!Array.isArray(candidates) || candidates.length===0) return null;
  const preferred=isInitial?[]:candidates.filter(card=>owned.some(item=>item.id===card.id&&item.evoLevel<2));
  const choices=preferred.length>0?preferred:candidates;
  return choices[Math.floor(rng()*choices.length)]||choices[0]||null;
};
// AUTO∞の周回で、ラン開始時の最初のアシストカードをそろえるための解決。
// 1周目で実際に確定したカードのID(手動でもAUTOでもよい)を repeatRunTemplate が覚えており、
// 2周目以降の最初の PICK_TEACHING でそのカードを選び直す。
// 覚えたIDが今の候補から見つからないときは null を返し、呼び出し側は
// これまでどおり chooseAutoTeachingCard のランダム選択へ落とす(AUTOを止めない)。
const resolveRepeatInitialTeaching = (candidates, teachingId) => {
  if (!Array.isArray(candidates) || !teachingId) return null;
  return candidates.find(card => card && card.id === teachingId) || null;
};
const trainingOptionOf = (id) => TRAINING_OPTIONS.find(option=>option.id===id) || null;
// トレーニング1回ぶんを適用する。掛かり方は次の順:
//   ・まず通常どおりの増加後の値を出す(固定値を足してから割合を掛け、Math.floor)
//   ・ULTIMATE / INFINITYは、その増加量へ trainingGainRate を掛ける
//     (率から引かない。4種すべてが同じ割合で目減りする)
//   ・NIGHTMAREは増えたぶんだけをapplyNightmareStatGainで調整する
const resolveTrainingStep = (stats, optionId, turns, specialDifficulty=null) => {
  const before={atk:Number(stats?.atk)||0,def:Number(stats?.def)||0,hp:Number(stats?.hp)||0,guts:Number(stats?.guts)||0};
  const option=trainingOptionOf(optionId);
  if(!option)return before;
  const base=before[option.stat];
  // 通常の増加量を先に出してから、低下ぶんを「増加量へ掛ける」。
  // 以前は率から引いていた(max(0, 効果率 - T×0.75%))ため、ちから+5%・ガッツ+5%のように
  // 元の率が小さい項目だけが7ターンで増加0になり、ライフ・丈夫さ(+20%)との差が開きすぎていた。
  const normalAfter=Math.floor((base+option.flat)*(1+option.rate));
  const after=base+Math.floor((normalAfter-base)*trainingGainRate(turns,specialDifficulty));
  return {...before,[option.stat]:applyNightmareStatGain(base,after,specialDifficulty)};
};
// 選んだ順に1回ずつ重ねてかける。同じ項目を2回選んだときも、この積み重ねで自然に複利になる
const resolveTrainingStats = (stats, picks, turns, specialDifficulty=null) =>
  (Array.isArray(picks)?picks:[]).reduce((acc,id)=>resolveTrainingStep(acc,id,turns,specialDifficulty),
    {atk:Number(stats?.atk)||0,def:Number(stats?.def)||0,hp:Number(stats?.hp)||0,guts:Number(stats?.guts)||0});
// 整数で扱うバトル値の特殊ルール倍率はここでだけ丸める。対象ルールがない難易度は
// extremeSpecialRule が1を返すため、EXTREME / NIGHTMAREを含む既存値は変化しない。
const applyExtremeIntegerRule = (value, specialDifficulty=null, rule) => Math.floor(
  (Number(value)||0) * (specialDifficulty ? extremeSpecialRule(specialDifficulty,rule) : 1));
// 供モン加入時のステータス加算だけを難易度別に丸める。ULTIMATEは加入直前の
// WAVE結果に確定済みの累計ターンを使い、CHAOSの固定50%とは重ねない。
const applyAllyJoinBonus = (value, specialDifficulty=null, totalTurns=0) => {
  if(extremeRuleNumber(specialDifficulty,'allyJoinPenaltyRate')!=null){
    return Math.floor((Number(value)||0)*ultimateAllyJoinMultiplier(totalTurns,specialDifficulty));
  }
  return applyExtremeIntegerRule(value,specialDifficulty,'allyJoinBonus');
};
// 極限チャレンジの説明にはモード全体に共通する特徴を十分に載せる。EXTREME固有の倍率や
// アシストカード50%は、ここではなく難易度カード側で案内する
const EXTREME_MODE = Object.freeze({
  id:'extreme', label:'極限チャレンジ', short:'極限', emoji:'🔥', color:'#e879f9',
  tagline:'育てたモンスターで限界へ挑む、上級者向け高難度モード',
  highlights:[['⚔️','通常チャレンジを超える高難易度'],['🔥','EXTREMEから始まる、さらなる強敵への挑戦'],['✨','高難易度に見合った高い報酬']],
  points:[
    ['⚔️','モード概要','通常チャレンジのさらに上に位置する、上級者向けの高難易度モードです。育てたモンスターで限界に挑みます。'],
    ['🔥','難易度','EXTREMEから始まり、さらに上位の難易度が並びます。難易度が上がるほど、より強力な敵との戦いになります。'],
    ['✨','報酬','強敵を乗り越えた先で、高難易度に見合った高い報酬を狙えます。'],
    ['🎯','こんな人におすすめ','通常チャレンジを攻略し、育成したモンスターの実力をさらに試したい人におすすめです。'],
  ],
});
// 解放条件。チャレンジモードで Grand Master / Hell / Legend のどれかを1回以上クリアしていること。
// 判定には既存の mh_clears_<難易度> をそのまま読む(新しい解放フラグは作らない)ので、
// 旧セーブのプレイヤーもログインした時点で解放済みとして扱われる
const EXTREME_UNLOCK_DIFFICULTIES = Object.freeze(['GrandMaster', 'Hell', 'Legend']);
const EXTREME_UNLOCK_TEXT = 'チャレンジ Grand Master以上クリアで解放';
const isExtremeUnlocked = (clearCounts) => EXTREME_UNLOCK_DIFFICULTIES
  .some(key => (Number(clearCounts?.[key]) || 0) > 0);
// 極限チャレンジの記録。チャレンジ・クイック・プロと同じく専用の接頭辞へ分けて保存し、
// 既存の mh_hs_* / mh_clears_* は一切書き換えない(全国ランキングへも送らない)
const extremeBestScoreKey = (id) => `mh_extreme_hs_${id}`;
const extremeClearCountKey = (id) => `mh_extreme_clears_${id}`;
const EXTREME_BEST_SCORE_KEY = extremeBestScoreKey('EXTREME');
const EXTREME_CLEAR_COUNT_KEY = extremeClearCountKey('EXTREME');
const NIGHTMARE_BEST_SCORE_KEY = extremeBestScoreKey('NIGHTMARE');
const NIGHTMARE_CLEAR_COUNT_KEY = extremeClearCountKey('NIGHTMARE');
const CHAOS_BEST_SCORE_KEY = extremeBestScoreKey('CHAOS');
const CHAOS_CLEAR_COUNT_KEY = extremeClearCountKey('CHAOS');
const ULTIMATE_BEST_SCORE_KEY = extremeBestScoreKey('ULTIMATE');
const ULTIMATE_CLEAR_COUNT_KEY = extremeClearCountKey('ULTIMATE');
// INFINITYも同じ動的キー方式(mh_extreme_hs_INFINITY / mh_extreme_clears_INFINITY)。
// 旧セーブにこのキーは無いが、読み込みは既定値0を通すので移行処理はいらない。
const INFINITY_BEST_SCORE_KEY = extremeBestScoreKey('INFINITY');
const INFINITY_CLEAR_COUNT_KEY = extremeClearCountKey('INFINITY');
const normalizeExtremeRecordValue = (value) => Math.max(0, Math.floor(Number(value) || 0));
// NIGHTMAREの解放には既存のEXTREMEクリア回数を再利用する。
const isNightmareUnlocked = (extremeClearCount) => (Number(extremeClearCount) || 0) > 0;
const isChaosUnlocked = (nightmareClearCount) => (Number(nightmareClearCount) || 0) > 0;
const isUltimateUnlocked = (chaosClearCount) => (Number(chaosClearCount) || 0) > 0;
const isInfinityUnlocked = (ultimateClearCount) => (Number(ultimateClearCount) || 0) > 0;
const isGodUnlocked = (infinityClearCount) => (Number(infinityClearCount) || 0) > 0;
const isRagnarokUnlocked = (godClearCount) => (Number(godClearCount) || 0) > 0;
const normalizeBattleDifficulty = (value) => quickDifficultySetting(value) ? value : 'Normal';
// 難易度選択を開いたときの既定位置。前に遊んだ難易度を引きずらず、いつでもノーマルから始める
const BATTLE_DEFAULT_DIFFICULTY = 'Normal';
// クリアするともらえる虹のプシュケー。難易度が高いほど多い。
// 難易度のキーは DIFFICULTY_SETTINGS が正本なので、増減したらここも合わせる
// (ずれていないかは tools/breakthrough-item-check.js が見る)。
// もらえるのは「クリアしたとき」だけ。敗北・リタイア・スキップチケットでは配らない
const CLEAR_PSYCHE_REWARD = Object.freeze({
  Beginner: 1, Easy: 2, Normal: 3, Hard: 5, Expert: 7,
  Master: 10, GrandMaster: 15, Hell: 20, Legend: 25,
  EXTREME: 30, NIGHTMARE: 40, CHAOS: 50,
  ULTIMATE: QUICK_ULTIMATE_SETTING.psyche,
});
const clearPsycheReward = (difficulty) => Math.max(0, Math.floor(Number(CLEAR_PSYCHE_REWARD[normalizeBattleDifficulty(difficulty)]) || 0));
// ヘルプの中に出す「実データから作る表」。data/help.js の { t:'data', id } がこれを呼ぶ。
// 難易度の倍率やアイテムの値段をヘルプへ手で書き写すと、値を変えたときに片方だけ古くなる。
// (実際「難易度が3つしか載っていない」状態になっていた)。ここを通せば取りこぼしが起きない。
// 表を1つ足したいときは、ここに case を足して data/help.js から呼ぶ。
// ダイヤで買う商品のうち、いちばん安いものの値段。助手が「ダイヤが心もとない」と
// 声をかけるかどうかの判定にだけ使う(購入の可否は各商品ごとに別途見ている)。
// マーケットの画面から参照するので、必ず一番外側に置くこと
const CHEAPEST_GOLD_ITEM_COST = ((typeof BREEDER_MARKET_ITEMS !== 'undefined' && BREEDER_MARKET_ITEMS) || [])
  .filter(i => i.type === 'disc' || i.type === 'assist' || i.type === 'item')
  .reduce((min, i) => Math.min(min, Number(i.cost) || Infinity), Infinity);
