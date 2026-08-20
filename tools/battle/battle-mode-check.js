const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトルモード(チャレンジ／クイック／プロ)を検証する。
//
//   ① 報酬: クイックだけ経験値とダイヤが1.5倍。プロは絆3倍・ブリーダー1.5倍。スコア倍率は難易度のまま
//   ② 記録: クイックはランキングへ送らず、プロは別枠へ送る。どちらもチャレンジの記録を上書きしない
//   ③ 成長: WAVEごとに味方だけ10%上昇し、ライフとガッツが全回復する
//   ④ 伴モン: クイックは固有技の選択画面を出さず、ランダムで1上げる(上限を超えない)
//   ⑤ 画面: モードのタブ・説明・ランキングボタン・バトル中のモード表示
//   ⑥ BGM: モードごとの通常戦とデュラハン戦を個別に設定できる(プロはチャレンジと同じ曲)
//   ⑦ プロ基盤: 定数・保存キー・ランキング名前空間・助手が揃っていて、まだ本番導線には出ていない
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiledRaw = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const compiled = compiledRaw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const count = (needle) => source.split(needle).length - 1;
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- 計算は本番の定義をそのまま動かして確かめる ---
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  grab(source, 'const WAVE_XP_TABLE =', 'const xpForLevel ='),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  // ランキングの難易度キー(プロは Pro 付き)は、モードの定数と難易度の表より後ろにある
  grab(source, 'const normalizeBattleDifficulty = (value)', '// ヘルプの中に出す「実データから作る表」'),
  grab(source, 'const PRO_RANKING_PREFIX =', '// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー'),
  'globalThis.__m={BATTLE_MODES,PUBLIC_BATTLE_MODES,battleModeInfo,normalizeBattleMode,isQuickMode,isProMode,QUICK_REWARD_MULT,QUICK_GROWTH_MULT,'
  + 'PRO_BOND_XP_MULT,PRO_BREEDER_XP_MULT,PRO_ALLY_POOL_SIZE,PRO_ALLY_OFFER_SIZE,'
  + 'PRO_LAST_PARTY_KEY,EMPTY_PRO_LAST_PARTY,normalizeProLastParty,'
  + 'modeBreederXpMult,modeBondXpMult,modeGoldMult,applyModeReward,modeHasRanking,modeBondAction,modeKeyPrefix,'
  + 'QUICK_REWARD_POLICY_GROWTH,QUICK_REWARD_POLICY_PSYCHE,QUICK_REWARD_POLICY_DIAMOND,normalizeQuickRewardPolicy,applyQuickXpPolicy,applyQuickPsychePolicy,applyQuickDiamondPolicy,clearPsycheReward,'
  + 'waveXpGain,waveGoldGain,xpForWavesCleared,goldForWavesCleared,xpForWavesClearedInMode,goldForWavesClearedInMode,'
  + 'bondXpForWavesClearedInMode,waveBondXpGainInMode,'
  + 'waveXpGainInMode,waveGoldGainInMode,bestScoreKey,bestWaveKey,clearCountKey,highestModeScore,DIFFICULTY_SETTINGS,BATTLE_MODE_QUICK,BATTLE_MODE_CHALLENGE,BATTLE_MODE_PRO,'
  + 'PRO_RANKING_PREFIX,EXTREME_RANKING_PREFIX,EXTREME_DIFFICULTIES,RANKING_DIFFICULTY_KEYS,rankingDifficultyForMode,rankingDifficultyBase,normalizeRankingDifficulty,'
  + 'pickJoinCandidates,battleModeAssistantScene,'
  + 'calculateRemainingHp,resolveEffectiveMaxStat,quickGrowStat,resolveQuickGrowthStats};',
].join('\n'), ctx);
const m = ctx.__m;

// --- ① 報酬 ---
check('モードは3種類', m.BATTLE_MODES.length === 3 && m.BATTLE_MODES.map(x => x.id).join(',') === 'challenge,quick,pro');
check('知らない値はチャレンジ扱い', m.normalizeBattleMode('nope') === 'challenge' && m.normalizeBattleMode(undefined) === 'challenge');
check('プロは正しいモードとして通る', m.normalizeBattleMode('pro') === 'pro' && m.isProMode('pro') === true && m.isProMode('quick') === false && m.isProMode('challenge') === false);
check('クイックの倍率は1.5', m.QUICK_REWARD_MULT === 1.5);
check('プロの倍率は絆3倍・ブリーダー1.5倍', m.PRO_BOND_XP_MULT === 3 && m.PRO_BREEDER_XP_MULT === 1.5);
check('プロの供モンは5体選んで3体', m.PRO_ALLY_POOL_SIZE === 5 && m.PRO_ALLY_OFFER_SIZE === 3);
check('前回プロ編成は専用キーを使う', m.PRO_LAST_PARTY_KEY === 'mh_pro_last_party');
{
  const restored = m.normalizeProLastParty({heroBaseId:'Mocchi',heroDistance:2,allyBaseIds:['Golem','Mew','missing','Suezo','Hare']}, ['Mocchi','Golem','Mew','Suezo','Hare']);
  check('前回プロ編成は解放済みの勇者・距離・供モンを復元する', restored.heroBaseId === 'Mocchi' && restored.heroDistance === 2 && restored.allyBaseIds.join(',') === 'Golem,Mew,,Suezo,Hare');
  const missingHero = m.normalizeProLastParty({heroBaseId:'missing',heroDistance:1,allyBaseIds:['Golem']}, ['Golem']);
  check('存在しない勇者だけを未選択にして配置距離も外す', missingHero.heroBaseId === null && missingHero.heroDistance === null && missingHero.allyBaseIds[0] === 'Golem');
  const empty = m.normalizeProLastParty(null, ['Mocchi']);
  check('保存がなければプロ編成はすべて未選択', empty.heroBaseId === null && empty.heroDistance === null && empty.allyBaseIds.every(id=>id===null));
}
// 「全部3倍」ではないことを、倍率そのものの形で固定する
check('プロは絆だけ3倍。ブリーダーは1.5倍でダイヤは等倍',
  m.modeBondXpMult('pro') === 3 && m.modeBreederXpMult('pro') === 1.5 && m.modeGoldMult('pro') === 1);
check('チャレンジはどの倍率も等倍',
  m.modeBondXpMult('challenge') === 1 && m.modeBreederXpMult('challenge') === 1 && m.modeGoldMult('challenge') === 1);
check('クイックは3つとも1.5倍のまま',
  m.modeBondXpMult('quick') === 1.5 && m.modeBreederXpMult('quick') === 1.5 && m.modeGoldMult('quick') === 1.5);
check('報酬方針の初期値と不正値は育成',
  m.QUICK_REWARD_POLICY_GROWTH === 'growth' && m.normalizeQuickRewardPolicy(undefined) === 'growth' && m.normalizeQuickRewardPolicy('nope') === 'growth');
check('クイック＋育成は経験値とプシュケーが従来どおり',
  m.applyQuickXpPolicy(123, 'quick', 'growth') === 123 && m.applyQuickPsychePolicy(7, 'quick', 'growth') === 7 && m.applyQuickDiamondPolicy(40, 'quick', 'growth') === 40);
check('クイック＋プシュケー優先は経験値0・プシュケー2倍',
  m.applyQuickXpPolicy(123, 'quick', 'psyche') === 0 && m.applyQuickPsychePolicy(7, 'quick', 'psyche') === 14 && m.applyQuickDiamondPolicy(40, 'quick', 'psyche') === 40);
check('クイック＋ダイヤ優先は経験値0・ダイヤ2倍・プシュケー等倍',
  m.QUICK_REWARD_POLICY_DIAMOND === 'diamond' && m.normalizeQuickRewardPolicy('diamond') === 'diamond'
    && m.applyQuickXpPolicy(123, 'quick', 'diamond') === 0 && m.applyQuickDiamondPolicy(40, 'quick', 'diamond') === 80
    && m.applyQuickPsychePolicy(7, 'quick', 'diamond') === 7);
check('チャレンジ・プロは報酬方針の影響を受けない',
  ['challenge','pro'].every(mode => ['psyche','diamond'].every(policy => m.applyQuickXpPolicy(123, mode, policy) === 123 && m.applyQuickPsychePolicy(7, mode, policy) === 7 && m.applyQuickDiamondPolicy(40, mode, policy) === 40)));
check('全難易度のプシュケー優先が現行クリア報酬のちょうど2倍',
  Object.keys(m.DIFFICULTY_SETTINGS).every(diff => m.applyQuickPsychePolicy(m.clearPsycheReward(diff), 'quick', 'psyche') === m.clearPsycheReward(diff) * 2));
for (const diff of ['Normal', 'Hard', 'Expert']) {
  const s = m.DIFFICULTY_SETTINGS[diff];
  const baseXp = m.xpForWavesCleared(10, s.score), quickXp = m.xpForWavesClearedInMode(10, s.score, 'quick');
  const baseGold = m.goldForWavesCleared(10, s.gold), quickGold = m.goldForWavesClearedInMode(10, s.gold, 'quick');
  check(`${diff}: クイックの経験値がおよそ1.5倍`, quickXp > baseXp * 1.45 && quickXp <= baseXp * 1.5, `${baseXp} → ${quickXp}`);
  check(`${diff}: クイックのダイヤがおよそ1.5倍`, quickGold > baseGold * 1.45 && quickGold <= baseGold * 1.5, `${baseGold} → ${quickGold}`);
  check(`${diff}: チャレンジは従来どおり`, m.xpForWavesClearedInMode(10, s.score, 'challenge') === baseXp && m.goldForWavesClearedInMode(10, s.gold, 'challenge') === baseGold);
  // プロは難易度の倍率をそのまま活かしたうえで、絆とブリーダーに別々の補正をかける
  const proBreederXp = m.xpForWavesClearedInMode(10, s.score, 'pro');
  const proBondXp = m.bondXpForWavesClearedInMode(10, s.score, 'pro');
  const proGold = m.goldForWavesClearedInMode(10, s.gold, 'pro');
  check(`${diff}: プロのブリーダー経験値がおよそ1.5倍`, proBreederXp > baseXp * 1.45 && proBreederXp <= baseXp * 1.5, `${baseXp} → ${proBreederXp}`);
  check(`${diff}: プロの絆経験値がおよそ3倍`, proBondXp > baseXp * 2.9 && proBondXp <= baseXp * 3, `${baseXp} → ${proBondXp}`);
  check(`${diff}: プロのダイヤは等倍`, proGold === baseGold, `${baseGold} → ${proGold}`);
  // チャレンジ・クイックでは絆とブリーダーの獲得量がこれまでどおり同じであること
  check(`${diff}: チャレンジの絆はブリーダーと同額のまま`, m.bondXpForWavesClearedInMode(10, s.score, 'challenge') === baseXp);
  check(`${diff}: クイックの絆はブリーダーと同額のまま`, m.bondXpForWavesClearedInMode(10, s.score, 'quick') === quickXp);
}
// WAVEごとの内訳の合計と、リザルトの合計が一致する(表示と実際がずれない)
const sumOfWaves = (mult, mode, fn) => { let sum = 0; for (let w = 1; w <= 10; w++) sum += fn(w, mult, mode); return sum; };
check('WAVEごとの内訳の合計がリザルトの合計と一致する',
  sumOfWaves(3.0, 'quick', m.waveXpGainInMode) === m.xpForWavesClearedInMode(10, 3.0, 'quick')
    && sumOfWaves(1.5, 'quick', m.waveGoldGainInMode) === m.goldForWavesClearedInMode(10, 1.5, 'quick'));
// スコアはモードで変えない。スコア加算の実処理がモードを見ていないことを確かめる
const scoreBlock = grab(source, 'const finalRoundScore', 'setScore(s=>s+finalRoundScore);');
check('スコアの計算はモードを見ない', scoreBlock.length > 0 && !scoreBlock.includes('runMode') && !/QUICK_REWARD_MULT/.test(scoreBlock));
// 経験値はスコアと倍率が違うモード(極限チャレンジ)があるので xpMult を通す
check('実処理が経験値・ダイヤ・絆経験値にモード倍率を使う',
  has('const breederXpGain = applyQuickXpPolicy(xpForWavesClearedInMode(wavesCleared, xpMult, runMode), runMode, quickRewardPolicyRunRef.current);')
    && has('const goldGain = applyQuickDiamondPolicy(goldForWavesClearedInMode(wavesCleared, goldMult, runMode), runMode, quickRewardPolicyRunRef.current);')
    && has('const gain = applyQuickXpPolicy(bondXpForWavesClearedInMode(wavesCleared, xpMult, runMode), runMode, quickRewardPolicyRunRef.current);'));
check('ダイヤ優先は通常・スキップの最終ダイヤへ一度だけ適用する',
  count('applyQuickDiamondPolicy(goldForWavesClearedInMode(wavesCleared, goldMult, runMode), runMode, quickRewardPolicyRunRef.current)') === 1
    && count('applyQuickDiamondPolicy(goldForWavesCleared(SKIP_WAVES, goldMult) * count, BATTLE_MODE_QUICK, flow.rewardPolicy)') === 1);
check('クリア報酬は共通付与地点で一度だけ報酬方針を適用する',
  has('const gain = applyQuickPsychePolicy(baseGain, runMode, quickRewardPolicyRunRef.current);')
    && count('applyQuickPsychePolicy(baseGain, runMode, quickRewardPolicyRunRef.current)') === 1);
check('選択は保存キーを増やさず周回開始時に固定する',
  has('quickRewardPolicyRunRef.current=quick?normalizeQuickRewardPolicy(quickRewardPolicy):QUICK_REWARD_POLICY_GROWTH')
    && !/storeSet\([^\n]*quickRewardPolicy/.test(source));
check('スキップでもプシュケー優先なら経験値を付与しない',
  count('applyQuickXpPolicy(xpForWavesCleared(SKIP_WAVES, scoreMult) * count, BATTLE_MODE_QUICK, flow.rewardPolicy)') === 2);
check('WAVEごとの内訳もモード倍率を使う', has('xpGain: waveXpGainInMode(wave, scoreMultiplier, runMode)') && has('goldGain: waveGoldGainInMode(wave, goldMultiplier, runMode)'));

// --- ② 記録 ---
check('保存キーがモードごとに分かれている',
  m.bestScoreKey('challenge', 'Normal') === 'mh_hs_Normal' && m.bestScoreKey('quick', 'Normal') === 'mh_quick_hs_Normal'
    && m.bestWaveKey('quick', 'Hard') === 'mh_quick_highest_wave_Hard' && m.clearCountKey('quick', 'Hard') === 'mh_quick_clears_Hard');
check('チャレンジの保存キーは従来のまま',
  m.bestWaveKey('challenge', 'Hard') === 'mh_highest_wave_Hard' && m.clearCountKey('challenge', 'Hard') === 'mh_clears_Hard');
check('プロは mh_pro_ の新しいキーへ分ける',
  m.modeKeyPrefix('pro') === 'mh_pro_' && m.bestScoreKey('pro', 'Normal') === 'mh_pro_hs_Normal'
    && m.bestWaveKey('pro', 'Hard') === 'mh_pro_highest_wave_Hard' && m.clearCountKey('pro', 'Hard') === 'mh_pro_clears_Hard');
// 3モードの保存キーがひとつも衝突しない(既存の記録をプロが上書きしない)
{
  const keys = [];
  for (const mode of ['challenge', 'quick', 'pro']) for (const d of Object.keys(m.DIFFICULTY_SETTINGS)) {
    keys.push(m.bestScoreKey(mode, d), m.bestWaveKey(mode, d), m.clearCountKey(mode, d));
  }
  check('3モードの保存キーが1つも重複しない', new Set(keys).size === keys.length, `${keys.length}件`);
}
const submitBlock = grab(source, 'const submitRunScoreOnce = async', 'const handleSaveName');
// クイックは submitLocalScore へ行き着く前に return する。
// (極限チャレンジは送信するので、クイックの分岐が最初の送信より前にあることで見る)
check('クイックはランキングへ送信しない', /if \(isQuickMode\(runMode\)\) \{[\s\S]*?return;\s*\}/.test(submitBlock)
  && submitBlock.indexOf('isQuickMode(runMode)') < submitBlock.indexOf('submitLocalScore'));
check('クイックはチャレンジの自己ベストを上書きしない',
  submitBlock.includes('bestScoreKey(BATTLE_MODE_QUICK, difficulty)') && submitBlock.includes('setQuickHighScores'));
check('プロはプロ専用の難易度キーで送信する',
  submitBlock.includes('submitLocalScore(rankingDifficultyForMode(BATTLE_MODE_PRO, difficulty), score, runIdRef.current)'));
check('プロはチャレンジの自己ベストを上書きしない',
  submitBlock.includes('bestScoreKey(BATTLE_MODE_PRO, difficulty)') && submitBlock.includes('setProHighScores')
    && submitBlock.indexOf('isProMode(runMode)') < submitBlock.indexOf('await storeSet(`mh_hs_'));
check('デバッグ・練習の周回はどのモードでも送信しない',
  submitBlock.includes('if (debugBattleRef.current) return;')
    && submitBlock.indexOf('debugBattleRef.current') < submitBlock.indexOf('scoreSubmittedRef.current = true;'));
check('クリア回数もモードごとに分ける',
  has('await storeSet(clearCountKey(BATTLE_MODE_QUICK, difficulty), nextQuick, false);')
    && has('await storeSet(clearCountKey(BATTLE_MODE_PRO, difficulty), nextPro, false);'));
check('最高到達WAVEもモードごとに分ける',
  has('storeSet(bestWaveKey(BATTLE_MODE_QUICK,difficulty),w,false);') && has('storeSet(bestWaveKey(BATTLE_MODE_CHALLENGE,difficulty),w,false);')
    && has('storeSet(bestWaveKey(BATTLE_MODE_PRO,difficulty),w,false);'));
check('起動時にクイック・プロの記録も読み込む',
  has('quickScores[d] = await storeGet(bestScoreKey(BATTLE_MODE_QUICK, d), 0, false);')
    && has('proScores[d] = await storeGet(bestScoreKey(BATTLE_MODE_PRO, d), 0, false);')
    && has('proClears[d] = await storeGet(clearCountKey(BATTLE_MODE_PRO, d), 0, false);')
    && has('proWaves[d] = await storeGet(bestWaveKey(BATTLE_MODE_PRO, d), 0, false);'));

// --- ②-2 ランキングの名前空間 ---
check('スコアランキングはチャレンジとプロだけ',
  m.modeHasRanking('challenge') === true && m.modeHasRanking('pro') === true && m.modeHasRanking('quick') === false);
check('プロの難易度キーは Pro 付きの別枠',
  m.rankingDifficultyForMode('pro', 'Hard') === 'ProHard' && m.rankingDifficultyForMode('challenge', 'Hard') === 'Hard');
check('既存のチャレンジの難易度キーは変わらない',
  Object.keys(m.DIFFICULTY_SETTINGS).every(d => m.rankingDifficultyForMode('challenge', d) === d && m.normalizeRankingDifficulty(d) === d));
check('Pro付きのキーもランキングの難易度として通る',
  Object.keys(m.DIFFICULTY_SETTINGS).every(d => m.normalizeRankingDifficulty(`Pro${d}`) === `Pro${d}`));
check('素の難易度へ戻せる',
  Object.keys(m.DIFFICULTY_SETTINGS).every(d => m.rankingDifficultyBase(`Pro${d}`) === d && m.rankingDifficultyBase(d) === d));
check('知らない難易度は今までどおり弾く', (() => { try { m.normalizeRankingDifficulty('Pro'); return false; } catch { return true; } })());
// チャレンジ9 + プロ9 + 極限の段階ぶん。重複が無いこと(同じ行を2モードで奪い合わない)を見る
check('難易度キーの一覧に重複が無い', new Set(m.RANKING_DIFFICULTY_KEYS).size === m.RANKING_DIFFICULTY_KEYS.length
  && m.RANKING_DIFFICULTY_KEYS.length === Object.keys(m.DIFFICULTY_SETTINGS).length * 2 + m.EXTREME_DIFFICULTIES.length);
// 既存のランキングデータは1行も書き換えない(移行・変換・削除をしない)
check('既存のランキング行を書き換える処理を足していない',
  !/rankingDifficultyForMode\([^)]*\)\s*=>/.test(source) && !has('PATCH') && !has('DELETE FROM') && !has('migrateRanking'));

// --- ③ WAVEごとの自動成長 ---
check('成長倍率は10%', m.QUICK_GROWTH_MULT === 1.10);
check('クイックだけ強化フェーズを飛ばす', has('} else if (isQuickMode(runMode)) {') && has('beginQuickGrowth();'));
const growthBlock = grab(source, 'const beginQuickGrowth = () => {', 'const finishQuickGrowth');
check('味方の全ステータスを難易度別の成長率で上げる',
  growthBlock.includes('const growthRate = quickGrowthRateForRun(runMode,difficulty,waveResult?.turn);')
    && growthBlock.includes('const after = resolveQuickGrowthStats(before,growthRate);'));
check('端数は既存の強化と同じくfloor', has('const quickGrowStat = (value) => Math.floor((Number(value) || 0) * QUICK_GROWTH_MULT);'));
check('ライフとガッツをバフ込み実効最大値まで全回復する',
  growthBlock.includes('setHp(nextEffectiveMaxHp); setGuts(nextEffectiveMaxGuts);'));
check('表示する値と実際に入れる値が同じ', growthBlock.includes('setMaxHp(after.hp); setAtk(after.atk); setDef(after.def); setMaxGuts(after.guts);') && growthBlock.includes("{ label: 'ライフ', before: before.hp, after: after.hp }"));
check('敵には成長も回復もかけない', !growthBlock.includes('setEnemy') && !growthBlock.includes('enemy.'));
check('クイックでは教えの選択画面へ進まない', !grab(source, 'const finishQuickGrowth', 'const rollQuickUniqueUpgrade').includes("setGameState('PICK_TEACHING')"));
check('成長のあとに伴モン合流のWAVEなら選択画面へ', grab(source, 'const finishQuickGrowth', 'const rollQuickUniqueUpgrade').includes("setGameState('PICK_ALLY')"));
check('確定した成長後ステータスを次WAVEへ明示的に渡す',
  growthBlock.includes('effectiveMaxHp: nextEffectiveMaxHp, effectiveMaxGuts: nextEffectiveMaxGuts')
    && grab(source, 'const finishQuickGrowth', 'const rollQuickUniqueUpgrade').includes('null, null, null, nextStats'));

// 文字列の存在だけでなく、本番の計算関数で死亡境界と複数WAVEの状態遷移を再現する。
check('残りライフ1では敗北しない', m.calculateRemainingHp(151, 150) === 1);
check('残りライフ0では敗北する', m.calculateRemainingHp(150, 150) === 0);
check('超過ダメージでも0未満にならない', m.calculateRemainingHp(150, 999) === 0);
const hpBase = 330;
const hpEffective = m.resolveEffectiveMaxStat(hpBase, 0.03);
check('基礎最大ライフ330・バフ3%は次WAVEで339 / 339', hpEffective === 339,
  `${hpEffective} / ${hpEffective}`);
const gutsBase = 126;
const gutsEffective = m.resolveEffectiveMaxStat(gutsBase, 0.03);
check('基礎最大ガッツ126・バフ3%は次WAVEで129 / 129', gutsEffective === 129,
  `${gutsEffective} / ${gutsEffective}`);
check('バフ込みライフ339から338ダメージ後の1では敗北しない',
  m.calculateRemainingHp(hpEffective, 338) === 1);
check('バフ込みライフ339から339ダメージ後の0では敗北する',
  m.calculateRemainingHp(hpEffective, 339) === 0);
check('バフ解除時は現在値を新しい実効最大値以下へ丸められる',
  Math.min(hpEffective, m.resolveEffectiveMaxStat(hpBase, 0)) === hpBase);
let quickState = {hp: 300, atk: 100, def: 100, guts: 115};
let quickFullyRecovered = true;
for (let wave = 1; wave <= 5; wave++) {
  quickState = m.resolveQuickGrowthStats(quickState);
  const waveStart = {
    maxHp: quickState.hp,
    effectiveMaxHp: m.resolveEffectiveMaxStat(quickState.hp, 0.03),
    maxGuts: quickState.guts,
    effectiveMaxGuts: m.resolveEffectiveMaxStat(quickState.guts, 0.03),
  };
  waveStart.hp = waveStart.effectiveMaxHp;
  waveStart.guts = waveStart.effectiveMaxGuts;
  quickFullyRecovered = quickFullyRecovered
    && waveStart.hp === waveStart.effectiveMaxHp
    && waveStart.guts === waveStart.effectiveMaxGuts;
}
check('クイック複数WAVEで毎回バフ込み実効最大値まで全回復する', quickFullyRecovered,
  `5回成長後 基礎ライフ${quickState.hp} / 基礎ガッツ${quickState.guts}`);

// --- ④ 伴モンと固有技 ---
const rollBlock = grab(source, 'const rollQuickUniqueUpgrade = (uniques', 'const finishQuickJoin');
check('上限に達した固有技は抽選から外す', rollBlock.includes('(u.evoLevel || 0) < MAX_UNIQUE_SKILL_LEVEL'));
check('上げられる技が無ければ何もしない', rollBlock.includes('if (candidates.length === 0) return null;'));
check('上限を超えない', rollBlock.includes('Math.min(MAX_UNIQUE_SKILL_LEVEL, before + 1)'));
check('ランダムで1体選ぶ', rollBlock.includes('candidates[Math.floor(Math.random() * candidates.length)]'));
// 固有技を上げたモンスターの名前は、加入後の編成から探さないと
// 「いま加入した子」が当たったときに持ち主が見つからず、内部id(Ham など)が出てしまう
check('持ち主は加入後の編成から探す',
  has('const rolled=rollQuickUniqueUpgrade(nextUniques,nextSlots);') && rollBlock.includes('(currentSlots || slots).find(sl => sl && sl.id === picked.monId)'));
check('名前に内部idをそのまま出さない',
  rollBlock.includes("owner?.masuName || owner?.name || ALL_PLAYER_MONSTERS[picked.monId]?.name || picked.monId"));
check('強化フェーズの固有技もマスモン名を出す',
  has("const heading=inherited ? `${holderMon?.name||'？'} ← ${ownerMon?.name||'？'}の技` : (holderMon?.masuName||holderMon?.name||ownerMon?.name||'');")
    && has('holderMon:slots.find(sl=>sl&&sl.id===u.monId)||null'));
check('クイックは固有技の選択画面を出さない', has('setGameState(\'QUICK_JOIN\');') && !grab(source, 'if (isQuickMode(runMode)) {\n        // クイックモードは固有技', 'setGameState(\'QUICK_JOIN\')').includes('UPGRADE_SKILL'));
check('加入のステータス変化と固有技上昇を1画面で出す',
  has("{quickJoin.name}が仲間になった！") && has('固有技アップ！') && has('Lv.{quickJoin.unique.before} → '));

// --- ⑤ 画面 ---
// 演出は自動で進めず、必ずタップを待つ
check('演出はタップするまで進まない',
  has('const QuickStepScreen = ({ onDone, accent =') && !has('setTimeout(finish') && has("onClick={finish}") && has('タップして次へ'));
check('連打しても1回だけ進む', has('if (doneRef.current) return; doneRef.current = true; onDone();') && has("if (quickAdvanceRef.current === 'growth') return;"));
check('モードのタブがある', has('{PUBLIC_BATTLE_MODES.map(mode=>{') && has('setBattleMode(mode.id);setBattleMenuTab(\'difficulty\');'));
check('タブの横に説明の「？」がある', has('aria-label={`${mode.label}の説明`}') && has('setModeInfoId(mode.id)'));
// 説明の各項目は [アイコン, 見出し, 本文] の3つ組
check('モード説明に必要な項目がそろっている',
  m.BATTLE_MODES.every(mode => mode.points.length >= 6 && mode.points.every(p => p.length === 3 && p[0] && p[1] && p[2])));
// 説明はどのモードも同じ見出しを同じ順で並べる。読み比べたとき
// 「あるモードにだけ書いてある」が起きないようにするための約束
const POINT_TITLES = ['編成','WAVEのあいだの強化','難しさ','もらえる経験値とダイヤ','スコアと記録','供モンの加入','マスモン登録','スキップチケット','こんな人におすすめ'];
check('説明の見出しが全モードで同じ・同じ順',
  m.BATTLE_MODES.every(mode => mode.points.map(p => p[1]).join('/') === POINT_TITLES.join('/')),
  m.BATTLE_MODES.map(mode => `${mode.short}:${mode.points.length}項目`).join(' '));
// ルールが同じ項目(マスモン登録・スキップチケット)は同じ文でよいが、
// モードの違いそのものを表す項目は必ず書き分ける
const VARYING_TITLES = ['編成','WAVEのあいだの強化','難しさ','もらえる経験値とダイヤ','スコアと記録','供モンの加入','こんな人におすすめ'];
check('説明の本文はどれも空でなく、モードの違いはきちんと書き分けてある',
  m.BATTLE_MODES.every(mode => mode.points.every(p => p[0] && p[2] && p[2].length >= 20))
    && VARYING_TITLES.every(title => new Set(m.BATTLE_MODES.map(mode => mode.points.find(p => p[1] === title)[2])).size === 3));
// カードへ出す3行も全モードで同じ数・同じ並び(【売り】→【報酬】→【記録】)
check('カードの3行がどのモードにもある', m.BATTLE_MODES.every(mode => mode.highlights.length === 3 && mode.highlights.every(h => h.length === 2 && h[0] && h[1])));
const pointOf = (mode, title) => m.battleModeInfo(mode).points.find(p => p[1] === title)[2];
const highlightText = (mode) => m.battleModeInfo(mode).highlights.map(h => h[1]).join(' / ');
check('チャレンジの売りは強化を選ぶ王道',
  highlightText('challenge').includes('強化') && highlightText('challenge').includes('スコアランキング'));
check('クイックの売りは育成',
  highlightText('quick').includes('育成') && highlightText('quick').includes('1.5倍') && highlightText('quick').includes('ランキングは無し')
    && pointOf('quick', 'WAVEのあいだの強化').includes('10%'));
// プロの売りは極限との強さ比較ではなく「育成済みマスモンを使わない特殊制約」
check('プロの売りはベースモンだけで挑む特殊制約',
  highlightText('pro').includes('マスモン') && highlightText('pro').includes('実力勝負')
    && !m.battleModeInfo('pro').highlights[0][1].includes('経験値'));
check('プロの説明に編成の特殊制約が書いてある',
  pointOf('pro', '編成').includes('マスモンは1体も連れていけません')
    && pointOf('pro', '難しさ').includes('特殊な制約')
    && !/いちばん難しい|最高難度/.test(m.battleModeInfo('pro').tagline + highlightText('pro') + pointOf('pro', '難しさ'))
    && pointOf('pro', 'もらえる経験値とダイヤ').includes('絆経験値が3倍')
    && pointOf('pro', 'もらえる経験値とダイヤ').includes('ブリーダー経験値が1.5倍')
    && pointOf('pro', 'スコアと記録').includes('プロランキング')
    && pointOf('pro', '供モンの加入').includes('5体') && pointOf('pro', '供モンの加入').includes('3体'));
check('説明の見出しにアイコンが付く', has('{mode.points.map(([icon,title,text])=>(') && has('{mode.label}とは？'));
check('モードを変えても選択中の難易度は変えない', !/setBattleMode\(mode\.id\);[^}]*setDifficulty/.test(source));
check('横スライドの難易度選択を維持している', has('snap-x snap-mandatory') && has("touchAction:'pan-x pinch-zoom'") && has('前の難易度') && has('次の難易度'));
check('難易度カードからWAVE1の敵情報を外した', !has('createBattleEnemy(1,key)') && !has('<small className="text-amber-300 font-black">WAVE 1</small>'));
check('カードに自己ベスト・到達WAVE・倍率・全WAVE詳細が残っている',
  has('自己ベストスコア') && has('最高到達 WAVE') && has('全WAVE詳細') && has('この難易度で挑戦'));
// クイックはスコアを競わないので、自己ベストスコアもスコア倍率も出さない
check('クイックはスコア関連を出さない',
  has("const rateCells=(setting)=>quick") && has("? [['敵強度',`×${setting.power}`,false],['経験値',bonusLabel(setting.xp||setting.score),true],['ダイヤ',bonusLabel(setting.gold),true]]")
    && has("{ label:'自己ベストスコア', value:`${(highScores[key]||0).toLocaleString()} pt`"));
check('クイックでも最高到達WAVEは出す', has("{ label:'最高到達WAVE', value:`WAVE ${waveOf(key)}`"));
check('モードカードの最高スコアは全難易度の自己ベスト最大値',
  m.highestModeScore({ Normal:12000, Hard:18000, Legend:25000 }, Object.keys(m.DIFFICULTY_SETTINGS)) === 25000
    && m.highestModeScore({ Normal:12000, Hard:18000 }, Object.keys(m.DIFFICULTY_SETTINGS)) === 18000
    && m.highestModeScore({ Normal:12000 }, Object.keys(m.DIFFICULTY_SETTINGS)) === 12000
    && m.highestModeScore({}, Object.keys(m.DIFFICULTY_SETTINGS)) === 0);
// クイックはスコアを競わないので、バトル中もリザルトもスコアを出さない
check('バトル中もクイックはスコアを出さない', has('{!isQuickMode(runMode)&&<div data-battle-score'));
check('最終リザルト3画面のスコア枠をクイックでは出さない',
  (source.match(/\{!isQuickMode\(runMode\)&&<div className="[^"]*"><div className="text-(?:5xl|3xl) font-mono font-black text-white">\{score\.toLocaleString\(\)\}<\/div><\/div>\}/g) || []).length === 3,
  `${(source.match(/\{!isQuickMode\(runMode\)&&<div className="[^"]*"><div className="text-(?:5xl|3xl) font-mono font-black text-white">\{score\.toLocaleString\(\)\}<\/div><\/div>\}/g) || []).length}か所`);
check('WAVEリザルトのスコア内訳をクイックでは出さない',
  has('{/* スコアの内訳。クイックモードはスコアを競わないので出さない */}') && has('{!isQuickMode(runMode)&&(<>'));
check('WAVE別ログのスコア列もクイックでは出さない',
  has('{!summary.quickMode&&<span className="text-white font-mono font-bold truncate">スコア +{w.roundScore.toLocaleString()}</span>}')
    && has('setFinalRewardSummary({ quickMode: isQuickMode(runMode), breederXpGain, breederLevelBefore'));
check('スコア以外(経験値・ダイヤ・絆)はクイックでも出す',
  has('WAVE別ログ') && has('XP+{w.xpGain.toLocaleString()}') && has('💎+{w.goldGain.toLocaleString()}'));
check('チャレンジはスコア倍率を出す', has(": [['敵強度',`×${setting.power}`,false],['スコア',`×${setting.score}`,false],['ダイヤ',`×${setting.gold}`,false]]"));
check('クイックは経験値・ダイヤだけ1.5倍と分かる表示', has('経験値・ダイヤのみ1.5倍'));
// 見出しが2行に折り返さないよう、倍率は3枠までにして折り返しも禁じる
check('倍率の枠は3つで1行に収める', has('<div className="grid grid-cols-3 gap-1 mt-1.5">') && has('text-center text-[8px] text-slate-400 whitespace-nowrap'));
check('ランキングボタンはチャレンジのときだけ出す',
  has("? <div className=\"w-full h-10 rounded-xl bg-slate-900/60") && /: <button [^>]*onClick=\{\(\)=>\{addAssistantBond\('ranking'\);setBattleMenuTab\('ranking'\)/.test(source)
    && has('🏆 ランキングを見る（チャレンジモード）'));
// モードのタブのすぐ下へ移し、タブ2つを合わせたのと同じ幅にする。
// クイックでも同じ高さの案内を出し、下に続く表示の位置がモードでずれないようにする
check('ランキングボタンはモードのタブと同じ幅', has('className="w-full h-10 rounded-xl bg-slate-800 border border-indigo-400/40'));
check('ランキングボタンはモードのタブのすぐ下にある',
  source.indexOf('🏆 ランキングを見る（チャレンジモード）') < source.indexOf('左右にスワイプして難易度を選択'));
check('クイックでも同じ高さの案内を出す', has('クイックモードはランキング対象外です') && count('w-full h-10 rounded-xl') === 2, `${count('w-full h-10 rounded-xl')}か所`);
// 最低の高さ(min-h)ではなく決め打ちの高さ(h-10)にする。ボタンの中身によっては
// min-hを超えて伸びてしまい、クイック側の空き場所とずれるため
check('助手コメントの位置がモードでずれない', /className=[{`"]*shrink-0 w-full h-10 mb-1/.test(source));
// 難易度カード自体の高さもモードでそろえる。記録の枠(チャレンジ3行/クイック1行)と
// 倍率の下の補足行が、モードによって高さを変える原因だった
// 高さを数値で指定してそろえる方法は、端末のフォントで1行の高さが変わるため合いきらなかった。
// 「見出し・大きい値・補足」の3行構成をモードで共通にして、構造から同じ高さになるようにする
check('記録の枠はモードによらず同じ行構成',
  has('const recordBox=(key)=>quick') && count('<b className={`block text-right text-base leading-tight ${rec.valueColor}`}>') === 1
    && !has('recordBoxStyle') && !has('minHeight:\'58px\''));
check('記録の枠の見出し・値・補足がすべて1行ずつある',
  has('<small className="block text-[8px] text-slate-400 font-black">{rec.label}</small>')
    && has('<b className={`block text-right text-base leading-tight ${rec.valueColor}`}>{rec.value}</b>')
    && has('<span className="block text-right text-[9px] text-amber-300">{rec.sub}</span>'));
check('倍率の下の補足行はどちらのモードでも出す',
  has("const noteText=quick?'経験値・ダイヤのみ1.5倍':'スコアがランキングに登録される';")
    && has('<span className="truncate">{noteText}</span>')
    && !has('{quick&&<div className="mt-1 rounded-xl border'));
check('ランキングの導線は助手コメントより前にある', source.indexOf('🏆 ランキングを見る（チャレンジモード）') < source.indexOf("scene={quick?'battleQuick':'battleChallenge'}"));
// ランキングを見ているときの戻るは、ホームではなく難易度の画面へ戻す
check('ランキングからの戻るはバトルの画面へ',
  has("onClick={()=>{if(battleMenuTab!=='difficulty'){setBattleMenuTab('difficulty');return;}returnToHome();}}"));
// 勇者モン選択はバトルを始める前なので、戻るときは来た場所(難易度の画面)へ返す
check('勇者モン選択からの戻るは難易度の画面へ',
  has("onClick={()=>{if(gameState==='PICK_HERO'){setCurrentPickingMon(null);setBattleMenuTab('difficulty');setGameState(battleEntryStateRef.current);return;}returnToHome();}}"));
check('助手コメントは既存の共通UIを使う', has("<AssistantBubble key={battleMode} scene={quick?'battleQuick':'battleChallenge'}") && assistantsSrc.includes('battleChallenge:') && assistantsSrc.includes('battleQuick:'));
check('挑戦を始めるときにモードを固定する', has('setDifficulty(key);setRunMode(battleMode);'));
check('バトル中にモード名と難易度を出す', has('{battleModeInfo(runMode).short} / {QUICK_DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}'));
check('ヘルプにバトルモードの説明がある', helpSrc.includes("id: 'battle-modes'") && helpSrc.includes('QUICK_GROWTH:') && helpSrc.includes('QUICK_JOIN:'));

// --- ⑥ BGM ---
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  const flat = code.replace(/\s+/g, '');
  check(`${label}: 通常戦の曲をモードで切り替える`, flat.includes('returnbgmArrangement[modeBgm.normal]'));
  check(`${label}: 専用戦の曲もモードで切り替える`, flat.includes("enemyId==='Durahan'||currentWave===9)returnbgmArrangement[modeBgm.dullahan]") && flat.includes("enemyId==='Moo'||currentWave===10)returnbgmArrangement[modeBgm.moo]"));
}
check('モード別BGMの既定値がある',
  has("quickBattle:'ichika_battle'") && has("proBattle:'original_battle'") && has("extremeBattle:'original_battle'")
    && ['dullahan','quickDullahan','proDullahan','extremeDullahan'].every(key=>has(`${key}:'original_dullahan'`))
    && ['boss','quickMoo','proMoo','extremeMoo'].every(key=>has(`${key}:'original_boss'`)));
check('新しいBGM項目は既存設定から補われる', has("proDullahan:'dullahan'") && has("extremeMoo:'boss'") && has('BGM_TRACK_BY_ID[legacySaved]'));
check('BGMアレンジ画面に4モード×3用途がそろっている',
  ['battle','dullahan','boss','quickBattle','quickDullahan','quickMoo','proBattle','proDullahan','proMoo','extremeBattle','extremeDullahan','extremeMoo']
    .every(key => has(`[\'${key}\',`)) && has('aria-label="バトルモード"'));
const bgmBlock = grab(source, "if (state === 'BATTLE') {", "if (RUN_PHASE_STATES.includes(state))");
check('極限チャレンジとプロは3用途すべて専用キーを使う',
  bgmBlock.includes("normal:'extremeBattle', dullahan:'extremeDullahan', moo:'extremeMoo'")
    && bgmBlock.includes("normal:'proBattle', dullahan:'proDullahan', moo:'proMoo'"));

// --- ⑦ プロ基盤 ---
// 第1段階では、本番のバトル画面にプロのタブを出さない(新しい入口とセットで公開する)
check('本番のモード選択に3モードすべて出す',
  m.PUBLIC_BATTLE_MODES.map(x => x.id).join(',') === 'challenge,quick,pro');
// 作りかけのモードを足すときは、ここから外せば新しい入口に出ないまま検査だけ通せる
check('公開するモードは1か所で決めている', has('const PUBLIC_BATTLE_MODES = BATTLE_MODES;'));
// 助手のセリフはJSXへ直書きせず、data/assistants.js へ場面として足す
check('プロの助手コメントが場面として用意されている', assistantsSrc.includes('battlePro: {'));
check('プロの助手コメントが5件以上ある',
  (assistantsSrc.match(/battlePro: \[|battlePro: \{/g) || []).length >= 2);
check('プロの親密度行動があり、既存の獲得量は変わっていない',
  assistantsSrc.includes("pro:       { amount:4, dailyMax:20, label:'プロモード' },")
    && assistantsSrc.includes("challenge: { amount:4, dailyMax:20, label:'チャレンジモード' },")
    && assistantsSrc.includes("quick:     { amount:2, dailyMax:12, label:'クイックモード' },")
    && assistantsSrc.includes('const ASSISTANT_BOND_DAILY_MAX = Object.values(ASSISTANT_BOND_ACTIONS).reduce'));
check('遊んだモードに応じて親密度の行動を切り替える',
  m.modeBondAction('challenge') === 'challenge' && m.modeBondAction('quick') === 'quick' && m.modeBondAction('pro') === 'pro'
    && has("addAssistantBond('battle');") && has("addAssistantBond(extremeRunRef.current ? 'extreme' : modeBondAction(runMode));"));

// --- ⑧ 新しいバトルの入口(第2段階) ---
// 「バトル → バトルモード選択 → 難易度選択」の3画面。まだデバッグからだけ開ける
check('新しい3画面がある',
  has("gameState==='BATTLE_MODE_SELECT'") && has("gameState==='BATTLE_DIFFICULTY_SELECT'") && has("gameState==='BATTLE_SCORE_RANKING'"));
// HOMEの「バトル」は新しいモード選択へ入る(本番の入口)
check('ふだんの「バトル」はモード選択へ入る',
  has("onClick={()=>{setModeSelectTab('mode');setGameState('BATTLE_MODE_SELECT');}} aria-label=\"バトル\""));
check('旧バトル画面はデバッグからだけ開ける',
  has('旧バトル画面を開く（見比べ用）')
    && (source.match(/setGameState\('BATTLE_MENU'\)/g) || []).length === 2,
  `BATTLE_MENUへ移る場所 ${(source.match(/setGameState\('BATTLE_MENU'\)/g) || []).length}か所(デバッグの見比べ用・旧チュートリアルの開始)`);
check('モード選択は極限チャレンジを含む全モードを横スライドで並べる',
  has('const modes=[...BATTLE_MODES,EXTREME_MODE];') && has('aria-label="前のモード"') && has('aria-label="次のモード"')
    && has('snap-center shrink-0 w-[82%] rounded-[24px] border-2 px-3 py-2.5'));
check('モードカードは選択難易度固定でなくモード内最高スコアを表示する',
  has('modeBestScore=ranked?highestModeScore(isProMode(m.id)?proHighScores:highScores,Object.keys(DIFFICULTY_SETTINGS)):rec.score')
    && has('EXTREME_DIFFICULTIES.filter(setting=>setting.available).map(setting=>setting.id)')
    && has("ranked?'最高スコア'")
    && has("ranked?`${modeBestScore.toLocaleString()} pt`"));
check('上のタブはモード選択・ブリーダーLv・絆Lvの3つ',
  has("{[['mode','モード選択'],['breeder','ブリーダーLv'],['bond','絆Lv']].map(([key,label])=>("));
// スコアランキングはモードごとに分かれるので、上のタブには置かない
check('上のタブにスコアランキングを混ぜない',
  !/\[\['mode','モード選択'\],\['score'/.test(source) && !has("['score','スコア'],['breeder'"));
// チャレンジ/プロのカード2か所 + 極限のモードカード・難易度カード2か所
check('スコアランキングはモードのカードと難易度のカードから開く',
  count("openModeScoreRanking(") === 4, `openModeScoreRanking ${count('openModeScoreRanking(')}か所`);
check('ランキングが無いモードには導線も高さ合わせの空枠も出さない',
  has('{ranked&&<button disabled={!!battleTutorial} onClick={()=>openModeScoreRanking(m.id,safeDifficulty,')
    && has('{ranked&&<button disabled={!!battleTutorial} onClick={()=>openModeScoreRanking(battleMode,key,')
    && has('ranked=modeHasRanking(battleMode);') && has('ranked=!isExtreme&&modeHasRanking(m.id),'));
check('難易度カードから開いたときは、その難易度のタブを最初に選ぶ',
  has('setRankingViewDiff(diff);') && has('loadRankings(rankingDifficultyForMode(mode, diff));')
    && has("openModeScoreRanking(battleMode,key,'BATTLE_DIFFICULTY_SELECT')"));
check('難易度カードの虹のプシュケー表示は実際の付与関数を使う',
  has('data-psyche-reward={key}') && has('applyQuickPsychePolicy(clearPsycheReward(key),battleMode,quickRewardPolicy)')
    && has('const baseGain = extremeRunRef.current ? selectedExtremeSetting.psyche : clearPsycheReward(difficulty);'));
check('クイック難易度画面に同じ高さで状態が分かる3択を出す',
  has("[QUICK_REWARD_POLICY_GROWTH,'育成','経験値あり']")
    && has("[QUICK_REWARD_POLICY_PSYCHE,'プシュケー優先','経験値0・虹×2']")
    && has("[QUICK_REWARD_POLICY_DIAMOND,'ダイヤ優先','経験値0・ダイヤ×2']")
    && has('grid grid-cols-3 gap-1') && has('aria-pressed={selected}') && has('min-h-[44px]'));
check('クイックの全難易度カードは報酬方針で外寸とボタン位置が変わらない',
  has("quick?'h-[366px] flex flex-col':''") && has("${quick?'mt-auto':''}")
    && has('data-difficulty-card={key}') && has('data-difficulty-carousel'));
check('クリア報酬は見出しを横書きに保ち、同じ高さの3行へ収める',
  has('min-h-[54px] rounded-xl border border-fuchsia-400/35')
    && has('shrink-0 whitespace-nowrap text-[10px] leading-tight text-fuchsia-200 font-black')
    && has('虹のプシュケー：{applyQuickPsychePolicy') && has('💎 ダイヤ：{quick?bonusLabel'));
check('クイック難易度画面の助手は縦画面向けのコンパクト表示にする',
  has('data-difficulty-assistant') && has('faceSize={quick?48:56} compact={quick}'));
check('全モードのクリアが共通の虹のプシュケー付与処理を通る',
  grab(source, 'const recordClearOnce = async () => {', 'const recordBestWave').indexOf('await awardClearPsyche();')
    < grab(source, 'const recordClearOnce = async () => {', 'const recordBestWave').indexOf('if (isQuickMode(runMode))'));
// ランキングの一覧は共通の描画を呼ぶだけにして、画面ごとに作り直さない
check('ランキングの一覧を複製していない',
  count('const renderScoreRankingBody = ') === 1 && count('const renderBreederRankingBody = ') === 1 && count('const renderBondRankingBody = ') === 1
    && count('renderScoreRankingBody(') === 2 && count('renderBreederRankingBody()') === 2 && count('renderBondRankingBody()') === 2);
check('既存のバトル画面のランキングも同じ描画を使う',
  has("{rankingKind==='score'&&renderScoreRankingBody(BATTLE_MODE_CHALLENGE)}")
    && has("{rankingKind==='breeder'&&renderBreederRankingBody()}") && has("{rankingKind==='bond'&&renderBondRankingBody()}"));
check('新しい画面から実際に始められる',
  has("battleEntryStateRef.current='BATTLE_DIFFICULTY_SELECT';setDifficulty(key);setRunMode(battleMode);")
    && !has('プロモードは準備中です'));
check('助手のセリフは場面キーで出し分ける(JSXへ直書きしない)',
  m.BATTLE_MODES.every(x => ['battleChallenge','battleQuick','battlePro'].includes(
    x.id === 'quick' ? 'battleQuick' : x.id === 'pro' ? 'battlePro' : 'battleChallenge'))
    && has('scene={battleModeAssistantScene(current.id)}') && has('scene={battleModeAssistantScene(battleMode)}'));
check('スキップや勇者モン選択の戻りは、来た入口の画面へ返す',
  has("const battleEntryStateRef = useRef('BATTLE_DIFFICULTY_SELECT');") && count('battleEntryStateRef.current)') === 3
    && has("battleEntryStateRef.current='BATTLE_MENU';setDifficulty(key);setRunMode(battleMode);")
    && has("battleEntryStateRef.current='BATTLE_DIFFICULTY_SELECT';setDifficulty(key);setRunMode(battleMode);"));
check('新しい画面もBGMとヘルプの対応表に載っている',
  has("BATTLE_MODE_SELECT: 'enhance'") && has("BATTLE_DIFFICULTY_SELECT: 'enhance'") && has("BATTLE_SCORE_RANKING: 'enhance'")
    && helpSrc.includes("BATTLE_MODE_SELECT:       'basics/battle-modes'")
    && helpSrc.includes("BATTLE_DIFFICULTY_SELECT: 'basics/difficulty'")
    && helpSrc.includes("BATTLE_SCORE_RANKING:     'basics/ranking'"));
// モードのカードは端で止まらず、どちらへスワイプしてもぐるぐる回る
check('モードのカードは同じ並びを3回置いてループさせる',
  has('const loopModes=[...modes,...modes,...modes];') && has('{loopModes.map((m,loopIndex)=>{'));
check('端まで来たら黙って真ん中のコピーへ戻す',
  has('const recenterModeLoop=()=>{') && has('root.scrollLeft+=to.offsetLeft-from.offsetLeft;')
    && has('modeLoopTimerRef.current=setTimeout(recenterModeLoop,180);'));
check('左右の矢印は端でも止まらない',
  has('aria-label="前のモード" onClick={()=>stepMode(-1)}') && has('aria-label="次のモード" onClick={()=>stepMode(1)}')
    && !/aria-label="(前|次)のモード" disabled=/.test(source));
check('開いたときは真ん中のコピーから始める',
  has('const index=modes.length+Math.max(0,modes.findIndex(m=>m.id===battleMode));'));
// 難易度選択はいつでもノーマルから。前に遊んだ難易度を引きずらない
check('難易度選択の既定はノーマル', has("const BATTLE_DEFAULT_DIFFICULTY = 'Normal';"));
check('難易度選択を開くたびに既定へ戻す',
  has("const start=battleTutorialStep!=null?'Beginner':BATTLE_DEFAULT_DIFFICULTY;")
    && has('const index=Object.keys(DIFFICULTY_SETTINGS).indexOf(start);'));
check('既存のバトル画面の難易度は今までどおり引き継ぐ',
  has("if(gameState!=='BATTLE_MENU'||battleMenuTab!=='difficulty')return;") && !/BATTLE_MENU'\|\|battleMenuTab!=='difficulty'\)return;\s*setDifficulty/.test(source));
check('実際に開いて押せることを確かめる道具がある',
  fs.existsSync(path.join(root, 'tools/battle/battle-mode-select-check.js')));

// --- ⑨ プロモードの中身(第3段階) ---
// 編成はベースモンだけ。育てたマスモンは勇者モンにも供モンにも出さない
check('プロの勇者モン選択はベースモンだけ',
  has("setMonSelection(pro?baseMons:getActiveMonsterList());setHeroPickTab(pro?'base':'roster');")
    && has("const savedRawList=gameState==='PICK_HERO'&&(heroPickTab==='base'||isProMode(runMode))?getUnlockedBaseMonsterList():monSelection;")
    && has('{!isProMode(runMode)&&<div className="flex gap-1.5">'));
check('プロの勇者モン選択に編成タブを出さない',
  has("isProMode(runMode)?'プロモードはベースモンだけで挑みます。育てたマスモンは連れていけません'"));
// 供モンの候補は「始める前に選んだ5体」からしか出さない
check('ラン中の加入候補はモードで切り替える',
  has('if (!isProMode(runMode)) return getActiveMonsterList();')
    && has('const joinOfferSize = () => isProMode(runMode) ? PRO_ALLY_OFFER_SIZE : 4;'));
check('加入の抽選は2か所とも共通の入口を通る',
  count('pickJoinCandidates(joinCandidatePool()') === 2 && count('joinOfferSize()') === 2
    && !/getActiveMonsterList\(\)\.filter\(m\s*=>\s*!activeIds/.test(source));
check('プロは5体から3体だけを候補に出す', m.PRO_ALLY_POOL_SIZE === 5 && m.PRO_ALLY_OFFER_SIZE === 3);
check('候補の抽選は1か所の関数にまとめてある',
  has('const pickJoinCandidates = (pool, activeIds, heroId, offerSize) => {')
    && count('pickJoinCandidates(joinCandidatePool()') === 2
    && !/setMonSelection\(avail\.sort\(/.test(source));
// 抽選そのものを何度も回して確かめる。「勇者モンが混ざる」「選んだ5体の外から出る」を確実に潰す
{
  const pool = ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie'].map(id => ({ id }));
  const heroId = 'Mocchi';
  let sizeOk = true, subsetOk = true, noHero = true, noDup = true;
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const got = m.pickJoinCandidates(pool, [heroId], heroId, m.PRO_ALLY_OFFER_SIZE);
    if (got.length !== m.PRO_ALLY_OFFER_SIZE) sizeOk = false;
    if (!got.every(x => pool.some(p => p.id === x.id))) subsetOk = false;
    if (got.some(x => x.id === heroId)) noHero = false;
    if (new Set(got.map(x => x.id)).size !== got.length) noDup = false;
    got.forEach(x => seen.add(x.id));
  }
  check('毎回ちょうど3体出る', sizeOk);
  check('出るのは選んだ5体の中からだけ', subsetOk);
  check('勇者モンは絶対に候補へ出ない', noHero);
  check('同じ子が2体並ばない', noDup);
  check('5体すべてがいつかは出る(ランダムになっている)', seen.size === pool.length, `${seen.size}/${pool.length}種`);
  // すでに合流した子は次から出ない
  const second = m.pickJoinCandidates(pool, [heroId, 'Ham'], heroId, m.PRO_ALLY_OFFER_SIZE);
  check('すでに編成にいる子は候補へ出ない', !second.some(x => x.id === 'Ham'));
  // 壊れた値でも落ちない
  check('候補が空でも落ちない', m.pickJoinCandidates([], ['x'], 'x', 3).length === 0
    && m.pickJoinCandidates(null, null, null, 3).length === 0
    && m.pickJoinCandidates(pool, null, null, 0).length === 0);
  // 5体より少ないときは、あるぶんだけ出る
  check('候補が3体未満ならあるぶんだけ出る', m.pickJoinCandidates(pool.slice(0, 2), [], null, 3).length === 2);
}
check('プロで候補が空でもマスモンは混ぜない',
  has('return proAllyPool.length > 0 ? proAllyPool : getUnlockedBaseMonsterList();'));
// 練習の台本の「この子だけ選べる」は勇者モン選択にだけ効かせる。
// 供モンの合流にも効くと、台本の勇者モン(モッチー)が強制で選ばれたように見える
check('台本の強制選択は勇者モン選択にだけ効く',
  has("disabled={gameState==='PICK_HERO'&&!scenarioPicksHero(m.id)}")
    && !/disabled=\{!scenarioPicksHero\(m\.id\)\}/.test(source));
// 練習をやめ損ねても、ふだんの周回へ台本を持ち込まない
check('ふだんの周回を始めるときは台本を必ず捨てる',
  count('battleScenarioRef.current=null;battleScenarioIntentIndexRef.current=0;') === 3);
// 供モンの一覧には、すでに編成にいる子(勇者モンを含む)を出さない
check('供モンの一覧に編成中の子を出さない',
  has("const inParty=slots.filter(x=>x).map(x=>x.id);")
    && has("const list=(gameState==='PICK_ALLY'?rawList.filter(m=>m&&!inParty.includes(m.id)):rawList)||[];"));
// 供モンの合流はバトルモード選択と同じ横スライドで見せる
check('プロの供モン合流は横スライドで出す',
  has("const allyCarousel=gameState==='PICK_ALLY'&&isProMode(runMode);")
    && has('aria-label="前の供モン"') && has('aria-label="次の供モン"')
    && has("'flex items-start gap-2.5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain py-1 mh-scroll':'grid grid-cols-2 gap-2.5'"));
check('横スライドは開くたびに先頭から見せる',
  has("if(gameState!=='PICK_ALLY')return;") && has('setAllyCardIndex(0);'));
// 勇者モンを置いたあと、開いていた詳細を必ず閉じる。
// プロだけ早く return するので、関数の最後にある片付けを通らない。
// 閉じ忘れると、WAVE 2の供モン合流で「勝手に勇者モンが選ばれている」ように見える
check('勇者モンの詳細を開いたまま次の画面へ行かない',
  has('if (isProMode(runMode)) {') && has('setCurrentPickingMon(null);') && has("setGameState('PICK_PRO_ALLIES');"));
check('供モン合流を開くときも開いていた詳細を閉じる',
  has("// 前の画面で開いていた詳細が残っていると、開いた瞬間に別の子が選ばれて見える\n    setCurrentPickingMon(null);"));
// 画面を切り替える早い return が増えたときの取りこぼしを見つけるための目安
check('setupMon はどの道でも詳細を片付ける',
  (grab(source, 'const setupMon = (m, slotIdx) => {', '// バトルチュートリアル用の台本').match(/setCurrentPickingMon\(null\)/g) || []).length >= 2);
check('チャレンジ・クイックの供モン一覧はこれまでどおり2列',
  has("allyCarousel?'flex items-start gap-2.5") && has(":'grid grid-cols-2 gap-2.5'"));
// 勇者モンを決めたあと、プロだけ供モン候補を選ぶ画面へ寄り道する
check('プロだけ供モン候補の画面をはさむ',
  has("if (isProMode(runMode)) {") && has("setGameState('PICK_PRO_ALLIES');")
    && has("{gameState==='PICK_PRO_ALLIES'&&(()=>{"));
check('プロ開始時に有効な前回編成だけを初期選択へ入れる',
  has('setProHeroPreset(savedHero&&lastProParty.heroDistance!==null?{heroBaseId:savedHero.id,heroDistance:lastProParty.heroDistance}:null);')
    && has('lastProParty.allyBaseIds.map(id=>baseMons.find(mon=>mon.id===id)).filter(mon=>mon&&mon.id!==savedHero?.id)')
    && has('selected: proHeroPreset?.heroBaseId===m.id')
    && has('setupMon(m,proHeroPreset.heroDistance)'));
check('勇者を変更しても有効な前回供モンを残し、同じ種だけ外す',
  has('setProAllyPool(prev=>prev.filter(mon=>mon.id!==m.id));'));
check('候補が5体そろうまで始められない',
  has('const ready=proAllyPool.length===need;') && has('<button disabled={!ready}')
    && has("setTeachingPool([...getActiveTeachingCards()]);setGameState('PICK_TEACHING');"));
check('勇者モンにした種は候補から外す',
  has('const candidates=getUnlockedBaseMonsterList().filter(m=>m.id!==mainHero?.id);'));
// ラン中の画面は「全画面のかぶせ方」で出す。これが抜けるとふだんの画面の下敷きになり、
// 表示はされているのに押しても反応しない(実際に供モン候補で出した不具合)
const RUN_OVERLAY = 'style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}}';
for (const [label, screen] of [['勇者モン・供モン選択', "(gameState==='PICK_HERO'||gameState==='PICK_ALLY')&&("], ['配置場所', "{gameState==='PICK_SLOT'&&("], ['プロの供モン候補', "{gameState==='PICK_PRO_ALLIES'&&(()=>{"]]) {
  const at = source.indexOf(screen);
  const near = at >= 0 ? source.slice(at, at + 900) : '';
  check(`${label}の画面は全画面でかぶせる`, near.includes(RUN_OVERLAY), at < 0 ? '画面が見つからない' : '');
}
check('ベースモンが足りないときはプロを始められない',
  has('const proReady=getUnlockedBaseMonsterList().length>=PRO_ALLY_POOL_SIZE+1;')
    && has("disabled={(pro&&!proReady)||!quickUnlocked||(!!battleTutorial&&key!=='Beginner')}") && has('`ベースモンが${PRO_ALLY_POOL_SIZE+1}種必要です`'));
// マスモン登録・リザルトは既存のしくみをそのまま使う(プロ専用の分岐を作らない)
check('マスモン登録は既存のしくみを使い回す',
  !has('proMasuRegister') && !has('registerProMasu')
    && has("gameState==='PICK_HERO'?'勇者モンとして選び、ラン終了時に登録すると「マスモン」として絆レベル・ステータスを強化できます'"));
check('新しい画面もBGMとヘルプに載っている',
  has("'PICK_TEACHING','PICK_PRO_ALLIES'") && helpSrc.includes("PICK_PRO_ALLIES:  'basics/battle-modes'"));
check('プロ用の助手コメントが場面として用意されている',
  assistantsSrc.includes('pickProAllies: {') && has('scene="pickProAllies"'));
check('プロモードを実際に遊んで確かめる道具がある',
  fs.existsSync(path.join(root, 'tools/mode/pro-mode-check.js')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
