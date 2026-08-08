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

const root = path.resolve(__dirname, '..');
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
  grab(source, 'const normalizeBattleDifficulty = (value)', '// クリアするともらえる虹のプシュケー'),
  grab(source, 'const PRO_RANKING_PREFIX =', '// 通信、state、リクエスト管理、画面参照で共有する唯一のランキング内部キー'),
  'globalThis.__m={BATTLE_MODES,PUBLIC_BATTLE_MODES,battleModeInfo,normalizeBattleMode,isQuickMode,isProMode,QUICK_REWARD_MULT,QUICK_GROWTH_MULT,'
  + 'PRO_BOND_XP_MULT,PRO_BREEDER_XP_MULT,PRO_ALLY_POOL_SIZE,PRO_ALLY_OFFER_SIZE,'
  + 'modeBreederXpMult,modeBondXpMult,modeGoldMult,applyModeReward,modeHasRanking,modeBondAction,modeKeyPrefix,'
  + 'waveXpGain,waveGoldGain,xpForWavesCleared,goldForWavesCleared,xpForWavesClearedInMode,goldForWavesClearedInMode,'
  + 'bondXpForWavesClearedInMode,waveBondXpGainInMode,'
  + 'waveXpGainInMode,waveGoldGainInMode,bestScoreKey,bestWaveKey,clearCountKey,DIFFICULTY_SETTINGS,BATTLE_MODE_QUICK,BATTLE_MODE_CHALLENGE,BATTLE_MODE_PRO,'
  + 'PRO_RANKING_PREFIX,RANKING_DIFFICULTY_KEYS,rankingDifficultyForMode,rankingDifficultyBase,normalizeRankingDifficulty,'
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
// 「全部3倍」ではないことを、倍率そのものの形で固定する
check('プロは絆だけ3倍。ブリーダーは1.5倍でダイヤは等倍',
  m.modeBondXpMult('pro') === 3 && m.modeBreederXpMult('pro') === 1.5 && m.modeGoldMult('pro') === 1);
check('チャレンジはどの倍率も等倍',
  m.modeBondXpMult('challenge') === 1 && m.modeBreederXpMult('challenge') === 1 && m.modeGoldMult('challenge') === 1);
check('クイックは3つとも1.5倍のまま',
  m.modeBondXpMult('quick') === 1.5 && m.modeBreederXpMult('quick') === 1.5 && m.modeGoldMult('quick') === 1.5);
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
const scoreBlock = grab(source, 'const finalRoundScore', 'setWaveHistory(prev =>');
check('スコアの計算はモードを見ない', scoreBlock.length > 0 && !scoreBlock.includes('runMode') && !/QUICK_REWARD_MULT/.test(scoreBlock));
check('実処理が経験値・ダイヤ・絆経験値にモード倍率を使う',
  has('const breederXpGain = xpForWavesClearedInMode(wavesCleared, scoreMult, runMode);')
    && has('const goldGain = goldForWavesClearedInMode(wavesCleared, goldMult, runMode);')
    && has('const gain = bondXpForWavesClearedInMode(wavesCleared, scoreMult, runMode);'));
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
check('クイックはランキングへ送信しない', /if \(isQuickMode\(runMode\)\) \{[\s\S]*?return;\s*\}/.test(submitBlock) && submitBlock.indexOf('isQuickMode(runMode)') < submitBlock.indexOf('submitLocalScore'));
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
check('難易度キーの一覧に重複が無い', new Set(m.RANKING_DIFFICULTY_KEYS).size === m.RANKING_DIFFICULTY_KEYS.length
  && m.RANKING_DIFFICULTY_KEYS.length === Object.keys(m.DIFFICULTY_SETTINGS).length * 2);
// 既存のランキングデータは1行も書き換えない(移行・変換・削除をしない)
check('既存のランキング行を書き換える処理を足していない',
  !/rankingDifficultyForMode\([^)]*\)\s*=>/.test(source) && !has('PATCH') && !has('DELETE FROM') && !has('migrateRanking'));

// --- ③ WAVEごとの自動成長 ---
check('成長倍率は10%', m.QUICK_GROWTH_MULT === 1.10);
check('クイックだけ強化フェーズを飛ばす', has('} else if (isQuickMode(runMode)) {') && has('beginQuickGrowth();'));
const growthBlock = grab(source, 'const beginQuickGrowth = () => {', 'const finishQuickGrowth');
check('味方の全ステータスを10%上げる',
  growthBlock.includes('const after = resolveQuickGrowthStats(before);'));
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
// プロの売りは「マスモンの経験値」ではなく「ベースモンだけで挑む難しさ」
check('プロの売りはベースモンだけで挑む難しさ',
  highlightText('pro').includes('ベースモン') && highlightText('pro').includes('最高難度')
    && !m.battleModeInfo('pro').highlights[0][1].includes('経験値'));
check('プロの説明に編成の制限と難しさが書いてある',
  pointOf('pro', '編成').includes('マスモンは1体も連れていけません')
    && pointOf('pro', '難しさ').includes('いちばん難しい')
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
  has("const rateCells=(setting)=>quick") && has("? [['敵強度',`×${setting.power}`,false],['経験値',bonusLabel(setting.score),true],['ダイヤ',bonusLabel(setting.gold),true]]")
    && has("{ label:'自己ベストスコア', value:`${(highScores[key]||0).toLocaleString()} pt`"));
check('クイックでも最高到達WAVEは出す', has("{ label:'最高到達WAVE', value:`WAVE ${waveOf(key)}`"));
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
    && has('style={{borderColor:`${mode.color}55`,color:mode.color}}>{noteText}</div>')
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
check('バトル中にモード名と難易度を出す', has('{battleModeInfo(runMode).short} / {DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}'));
check('ヘルプにバトルモードの説明がある', helpSrc.includes("id: 'battle-modes'") && helpSrc.includes('QUICK_GROWTH:') && helpSrc.includes('QUICK_JOIN:'));

// --- ⑥ BGM ---
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  const flat = code.replace(/\s+/g, '');
  check(`${label}: 通常戦の曲をモードで切り替える`, flat.includes('returnquick?bgmArrangement.quickBattle:bgmArrangement.battle'));
  check(`${label}: デュラハン戦の曲もモードで切り替える`, flat.includes("enemyId==='Durahan')returnquick?bgmArrangement.quickDullahan:bgmArrangement.dullahan"));
}
check('モード別BGMの既定値がある',
  has("quickBattle:'ichika_battle'") && has("dullahan:'original_dullahan'") && has("quickDullahan:'original_dullahan'"));
check('新しいBGM項目は既存設定が無くても既定値で補われる', has('const normalizeBgmArrangement = value => Object.fromEntries(Object.entries(DEFAULT_BGM_ARRANGEMENT)'));
check('BGMアレンジ画面に4項目そろっている',
  has("['battle','チャレンジモード BGM']") && has("['quickBattle','クイックモード BGM']")
    && has("['dullahan','チャレンジ デュラハン戦 BGM']") && has("['quickDullahan','クイック デュラハン戦 BGM']"));
// プロは専用曲を新設せず、チャレンジと同じ曲へ落とす。BGM設定の項目も増やさないので、
// 既存の保存値(mh_bgm_arrangement)はそのまま読める
const bgmBlock = grab(source, "if (state === 'BATTLE') {", "if (RUN_PHASE_STATES.includes(state))");
check('プロ専用のBGM項目を増やしていない',
  !has('proBattle') && !has('proDullahan') && !bgmBlock.includes('isProMode'));
check('プロはチャレンジと同じ曲になる', bgmBlock.includes('const quick = isQuickMode(runMode);'));

// --- ⑦ プロ基盤 ---
// 第1段階では、本番のバトル画面にプロのタブを出さない(新しい入口とセットで公開する)
check('本番のモードのタブはチャレンジとクイックだけ',
  m.PUBLIC_BATTLE_MODES.map(x => x.id).join(',') === 'challenge,quick');
check('プロは定義には入っているがタブには出ない',
  m.BATTLE_MODES.some(x => x.id === 'pro') && !m.PUBLIC_BATTLE_MODES.some(x => x.id === 'pro'));
// 助手のセリフはJSXへ直書きせず、data/assistants.js へ場面として足す
check('プロの助手コメントが場面として用意されている', assistantsSrc.includes('battlePro: {'));
check('プロの助手コメントが5件以上ある',
  (assistantsSrc.match(/battlePro: \[|battlePro: \{/g) || []).length >= 2);
check('プロの親密度行動があり、既存の獲得量は変わっていない',
  assistantsSrc.includes("pro:       { amount:2, dailyMax:10, label:'プロモード' },")
    && assistantsSrc.includes("challenge: { amount:2, dailyMax:10, label:'チャレンジモード' },")
    && assistantsSrc.includes("quick:     { amount:1, dailyMax:6,  label:'クイックモード' },")
    && assistantsSrc.includes('const ASSISTANT_BOND_DAILY_MAX = 30;'));
check('遊んだモードに応じて親密度の行動を切り替える',
  m.modeBondAction('challenge') === 'challenge' && m.modeBondAction('quick') === 'quick' && m.modeBondAction('pro') === 'pro'
    && has("addAssistantBond('battle'); addAssistantBond(modeBondAction(runMode));"));

// --- ⑧ 新しいバトルの入口(第2段階) ---
// 「バトル → バトルモード選択 → 難易度選択」の3画面。まだデバッグからだけ開ける
check('新しい3画面がある',
  has("gameState==='BATTLE_MODE_SELECT'") && has("gameState==='BATTLE_DIFFICULTY_SELECT'") && has("gameState==='BATTLE_SCORE_RANKING'"));
check('新しい入口はデバッグ設定からだけ開ける',
  has("setGameState('BATTLE_MODE_SELECT');}} className=\"col-span-2 min-h-[46px] rounded-xl bg-fuchsia-800/70")
    && count("setGameState('BATTLE_MODE_SELECT')") === 2, `モード選択へ移る場所 ${count("setGameState('BATTLE_MODE_SELECT')")}か所`);
check('ふだんの「バトル」は今までどおり BATTLE_MENU へ入る',
  has("onClick={()=>{setBattleMenuTab('difficulty');setGameState('BATTLE_MENU');}} aria-label=\"バトル\""));
check('モード選択は3モードすべてを横スライドで並べる',
  has('const modes=BATTLE_MODES,current=battleModeInfo(battleMode);') && has('aria-label="前のモード"') && has('aria-label="次のモード"')
    && has('snap-center shrink-0 w-[82%] rounded-[24px] border-2 px-3 py-2.5'));
check('上のタブはモード選択・ブリーダーLv・絆Lvの3つ',
  has("{[['mode','モード選択'],['breeder','ブリーダーLv'],['bond','絆Lv']].map(([key,label])=>("));
// スコアランキングはモードごとに分かれるので、上のタブには置かない
check('上のタブにスコアランキングを混ぜない',
  !/\[\['mode','モード選択'\],\['score'/.test(source) && !has("['score','スコア'],['breeder'"));
check('スコアランキングはモードのカードと難易度のカードから開く',
  count("openModeScoreRanking(") === 2, `openModeScoreRanking ${count('openModeScoreRanking(')}か所`);
check('ランキングが無いモードには導線も高さ合わせの空枠も出さない',
  has('{ranked&&<button onClick={()=>openModeScoreRanking(m.id,safeDifficulty,')
    && has('{ranked&&<button onClick={()=>openModeScoreRanking(battleMode,key,')
    && has('ranked=modeHasRanking(battleMode);') && has('ranked=modeHasRanking(m.id);'));
check('難易度カードから開いたときは、その難易度のタブを最初に選ぶ',
  has('setRankingViewDiff(diff);') && has('loadRankings(rankingDifficultyForMode(mode, diff));')
    && has("openModeScoreRanking(battleMode,key,'BATTLE_DIFFICULTY_SELECT')"));
// ランキングの一覧は共通の描画を呼ぶだけにして、画面ごとに作り直さない
check('ランキングの一覧を複製していない',
  count('const renderScoreRankingBody = ') === 1 && count('const renderBreederRankingBody = ') === 1 && count('const renderBondRankingBody = ') === 1
    && count('renderScoreRankingBody(') === 2 && count('renderBreederRankingBody()') === 2 && count('renderBondRankingBody()') === 2);
check('既存のバトル画面のランキングも同じ描画を使う',
  has("{rankingKind==='score'&&renderScoreRankingBody(BATTLE_MODE_CHALLENGE)}")
    && has("{rankingKind==='breeder'&&renderBreederRankingBody()}") && has("{rankingKind==='bond'&&renderBondRankingBody()}"));
check('新しい画面から実際に始められる',
  has("<button disabled={pro&&!proReady} onClick={()=>{battleEntryStateRef.current='BATTLE_DIFFICULTY_SELECT';")
    && !has('プロモードは準備中です'));
check('助手のセリフは場面キーで出し分ける(JSXへ直書きしない)',
  m.BATTLE_MODES.every(x => ['battleChallenge','battleQuick','battlePro'].includes(
    x.id === 'quick' ? 'battleQuick' : x.id === 'pro' ? 'battlePro' : 'battleChallenge'))
    && has('scene={battleModeAssistantScene(current.id)}') && has('scene={battleModeAssistantScene(battleMode)}'));
check('スキップや勇者モン選択の戻りは、来た入口の画面へ返す',
  has("const battleEntryStateRef = useRef('BATTLE_MENU');") && count('battleEntryStateRef.current)') === 3
    && has("battleEntryStateRef.current='BATTLE_MENU';setDifficulty(key);setRunMode(battleMode);"));
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
  has('const index=BATTLE_MODES.length+Math.max(0,BATTLE_MODES.findIndex(m=>m.id===normalizeBattleMode(battleMode)));'));
// 難易度選択はいつでもノーマルから。前に遊んだ難易度を引きずらない
check('難易度選択の既定はノーマル', has("const BATTLE_DEFAULT_DIFFICULTY = 'Normal';"));
check('難易度選択を開くたびに既定へ戻す',
  has("if(gameState!=='BATTLE_DIFFICULTY_SELECT')return;\n    setDifficulty(BATTLE_DEFAULT_DIFFICULTY);")
    && has('const index=Object.keys(DIFFICULTY_SETTINGS).indexOf(BATTLE_DEFAULT_DIFFICULTY);'));
check('既存のバトル画面の難易度は今までどおり引き継ぐ',
  has("if(gameState!=='BATTLE_MENU'||battleMenuTab!=='difficulty')return;") && !/BATTLE_MENU'\|\|battleMenuTab!=='difficulty'\)return;\s*setDifficulty/.test(source));
check('実際に開いて押せることを確かめる道具がある',
  fs.existsSync(path.join(root, 'tools/battle-mode-select-check.js')));

// --- ⑨ プロモードの中身(第3段階) ---
// 編成はベースモンだけ。育てたマスモンは勇者モンにも供モンにも出さない
check('プロの勇者モン選択はベースモンだけ',
  has("setMonSelection(pro?getUnlockedBaseMonsterList():getActiveMonsterList());setHeroPickTab(pro?'base':'roster');")
    && has("{gameState==='PICK_HERO'&&(heroPickTab==='base'||isProMode(runMode))?getUnlockedBaseMonsterList():monSelection}".replace('{', '(').replace('}', ')'))
    && has('{!isProMode(runMode)&&<div className="flex gap-1.5">'));
check('プロの勇者モン選択に編成タブを出さない',
  has("isProMode(runMode)?'プロモードはベースモンだけで挑みます。育てたマスモンは連れていけません'"));
// 供モンの候補は「始める前に選んだ5体」からしか出さない
check('ラン中の加入候補はモードで切り替える',
  has('const joinCandidatePool = () => isProMode(runMode) ? proAllyPool : getActiveMonsterList();')
    && has('const joinOfferSize = () => isProMode(runMode) ? PRO_ALLY_OFFER_SIZE : 4;'));
check('加入の抽選は2か所とも共通の入口を通る',
  count('joinCandidatePool().filter(') === 2 && count('joinOfferSize()') === 2
    && !/getActiveMonsterList\(\)\.filter\(m\s*=>\s*!activeIds/.test(source));
check('プロは5体から3体だけを候補に出す',
  m.PRO_ALLY_POOL_SIZE === 5 && m.PRO_ALLY_OFFER_SIZE === 3
    && has('setMonSelection(avail.sort(()=>Math.random()-0.5).slice(0,joinOfferSize())); setGameState(\'PICK_ALLY\');'));
// 勇者モンを決めたあと、プロだけ供モン候補を選ぶ画面へ寄り道する
check('プロだけ供モン候補の画面をはさむ',
  has("if (isProMode(runMode)) { setProAllyPool([]); setGameState('PICK_PRO_ALLIES'); return; }")
    && has("{gameState==='PICK_PRO_ALLIES'&&(()=>{"));
check('候補が5体そろうまで始められない',
  has('const ready=proAllyPool.length===need;') && has('<button disabled={!ready}')
    && has("setTeachingPool([...getActiveTeachingCards()]);setGameState('PICK_TEACHING');"));
check('勇者モンにした種は候補から外す',
  has('const candidates=getUnlockedBaseMonsterList().filter(m=>m.id!==mainHero?.id);'));
check('ベースモンが足りないときはプロを始められない',
  has('const proReady=getUnlockedBaseMonsterList().length>=PRO_ALLY_POOL_SIZE+1;')
    && has('disabled={pro&&!proReady}') && has('`ベースモンが${PRO_ALLY_POOL_SIZE+1}種必要です`'));
// マスモン登録・リザルトは既存のしくみをそのまま使う(プロ専用の分岐を作らない)
check('マスモン登録は既存のしくみを使い回す',
  !has('proMasuRegister') && !has('registerProMasu')
    && has("gameState==='PICK_HERO'?'勇者モンとして選び、ラン終了時に登録すると「マスモン」として絆レベル・ステータスを強化できます'"));
check('新しい画面もBGMとヘルプに載っている',
  has("'PICK_TEACHING','PICK_PRO_ALLIES'") && helpSrc.includes("PICK_PRO_ALLIES:  'basics/battle-modes'"));
check('プロ用の助手コメントが場面として用意されている',
  assistantsSrc.includes('pickProAllies: {') && has('scene="pickProAllies"'));
check('プロモードを実際に遊んで確かめる道具がある',
  fs.existsSync(path.join(root, 'tools/pro-mode-check.js')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
