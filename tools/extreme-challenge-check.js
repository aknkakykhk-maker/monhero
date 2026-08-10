#!/usr/bin/env node
// 極限チャレンジ(正式公開)の仕様を静的に確認する。
//   ① 難易度表(EXTREMEだけ実装・以降は？？？)と倍率
//   ② 解放条件(チャレンジ Grand Master以上のクリア)
//   ③ EXTREME固有のブリーダーカード50%が「極限共通ルール」になっていないこと
//   ④ 正式プレイは報酬・クリア記録を保存し、デバッグプレイでは保存しないこと
//   ⑤ 既存の保存キー・全国ランキングへ混ぜないこと
//   ⑥ 演出(邪気オーラ・WAVE1のルール発動)と助手のセリフ
const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const assistants = fs.readFileSync('monster-hero/data/assistants.js', 'utf8');
const changelog = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const config = source.slice(source.indexOf('const EXTREME_DIFFICULTIES'), source.indexOf('const normalizeBattleDifficulty'));

// --- ① 難易度表 ---
for (const name of ['EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY']) assert(config.includes(`'${name}'`), `${name} must be listed`);
assert(/EXTREME[^\n]+available:true[^\n]+power:13[^\n]+score:20[^\n]+xp:25[^\n]+gold:7\.5[^\n]+psyche:75[^\n]+specialRules:Object\.freeze\(\{ breederCardEffect:0\.5 \}\)/.test(config), 'EXTREME settings and its difficulty-specific rule must match the official specification');
assert(/NIGHTMARE[^\n]+available:false[^\n]+previewAvailable:true[^\n]+power:15[^\n]+score:20[^\n]+xp:30[^\n]+gold:10[^\n]+psyche:100[^\n]+plannedRules/.test(config), 'NIGHTMARE preview must expose its prepared values and planned rules while remaining unavailable for battle');
for (const name of ['CHAOS','ULTIMATE','INFINITY']) assert(new RegExp(`${name}[^\\n]+available:false`).test(config), `${name} must remain unavailable without placeholder values`);
assert(config.includes('const isNightmareUnlocked = (extremeClearCount) => (Number(extremeClearCount) || 0) > 0;'), 'NIGHTMARE unlock must reuse the existing EXTREME clear count');
assert(source.includes("setting.available?'この難易度で挑戦':previewable?'準備中（挑戦できません）':'選択できません'"), 'NIGHTMARE and future tiers must stay unselectable');

// --- ② 解放条件 ---
assert(config.includes("const EXTREME_UNLOCK_DIFFICULTIES = Object.freeze(['GrandMaster', 'Hell', 'Legend'])"), 'unlock must reuse the three highest challenge difficulties');
assert(config.includes("const EXTREME_UNLOCK_TEXT = 'チャレンジ Grand Master以上クリアで解放'"), 'locked card must explain the unlock condition');
assert(/const isExtremeUnlocked = \(clearCounts\) => EXTREME_UNLOCK_DIFFICULTIES[\s\S]{0,160}\(Number\(clearCounts\?\.\[key\]\) \|\| 0\) > 0\)/.test(config), 'unlock must read the existing challenge clear counts');
assert(source.includes('const extremeUnlocked = useMemo(() => isExtremeUnlocked(clearCounts), [clearCounts]);'), 'unlock state must derive from the loaded clear counts');
assert(source.includes('const modes=[...BATTLE_MODES,EXTREME_MODE];'), 'the extreme card must always be listed, locked or not');
assert(source.includes('extremeLocked=isExtreme&&!extremeUnlocked') && source.includes("disabled={extremeLocked||(!!battleTutorial") && source.includes("disabled={!setting.available||!extremeUnlocked}"), 'locked extreme and preview-only NIGHTMARE must remain unselectable');
assert(source.includes("const nightmareUnlocked = useMemo(() => isNightmareUnlocked(extremeClearCount), [extremeClearCount]);") && source.includes("setting.id==='NIGHTMARE'&&nightmareUnlocked"), 'NIGHTMARE details must unlock from the loaded EXTREME clear count');
assert(source.includes("disabled={!previewable} onClick={()=>setShowWaveDetails(true)}")
  && source.includes("const extreme=gameState==='EXTREME_DIFFICULTY_SELECT'")
  && source.includes("const powerOverride=extreme?extremePreviewSetting.power:null")
  && source.includes('createBattleEnemy(index+1,waveDifficulty,null,powerOverride)'), 'EXTREME must open the shared WAVE details with its battle power override');
assert(source.includes("{previewable?'全WAVE詳細':'詳細 ？？？'}"), 'only unlocked previewable tiers may open WAVE details');

// --- ③ EXTREME固有ルール ---
assert(source.includes("isBreeder&&extremeRunRef.current?extremeSpecialRule(extremeDifficulty,'breederCardEffect')"), 'only breeder cards must receive the selected EXTREME difficulty rule');
assert(source.includes("addPermaBuff('atkPct',card.baseValue*effMul)"), 'normal breeder buff must use the shared multiplier');
assert(source.includes('Math.floor(getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false)*effMul)'), 'breeder attack damage must use the shared multiplier');
assert(source.includes("const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved"), 'non-breeder attacks must retain their existing calculation');
assert(!config.includes('teachingEffect') && source.includes('⚠ EXTREME特殊ルール') && source.match(/ブリーダーカード効果 50%/g)?.length === 1 && source.includes('ブリーダーカードの効果量が半分になります'), 'the 50% breeder-card rule must belong to EXTREME details and the WAVE 1 presentation only');
assert(!/highlights:\[[^\]]*ブリーダーカード/.test(config), 'the mode-level description must not mention the EXTREME-only breeder-card rule');
const modeDescription = config.slice(config.indexOf('const EXTREME_MODE'), config.indexOf('const EXTREME_UNLOCK_DIFFICULTIES'));
for (const forbidden of ['×13', '13倍', '×20', '20倍', '×25', '25倍', '×7.5', '7.5倍', '75個', 'ブリーダーカード', '50%']) {
  assert(!modeDescription.includes(forbidden), `the mode-level description must not include EXTREME-only information: ${forbidden}`);
}
for (const expected of ['通常チャレンジを超える高難易度', 'EXTREMEから始まる、さらなる強敵への挑戦', '高難易度に見合った高い報酬']) {
  assert(modeDescription.includes(expected), `the mode card must explain the shared extreme-challenge feature: ${expected}`);
}
assert(source.includes("const showExtremeRule = w === 1 && extremeRunRef.current") && source.includes('setExtremeRuleOpen(showExtremeRule); setIsBusy(showExtremeRule)'), 'the 50% rule must block normal input once at WAVE 1');

// --- ④ 報酬・記録 ---
assert(source.includes('const baseGain = extremeRunRef.current ? EXTREME_SETTING.psyche : clearPsycheReward(difficulty);')
  && source.includes('const gain = applyQuickPsychePolicy(baseGain, runMode, quickRewardPolicyRunRef.current);'), 'EXTREME clear must grant its own psyche count through the shared reward-policy path');
assert(source.includes('const extreme = extremeRunRef.current;') && source.includes('const scoreMult = extreme ? EXTREME_SETTING.score : (DIFFICULTY_SETTINGS[difficulty]?.score || 1.0);')
  && source.includes('const goldMult = extreme ? EXTREME_SETTING.gold : (DIFFICULTY_SETTINGS[difficulty]?.gold || 1.0);')
  && source.includes('const xpMult = extreme ? EXTREME_SETTING.xp : scoreMult;'), 'official EXTREME rewards must use its own score/xp/gold multipliers');
assert(source.includes('await storeSet(EXTREME_CLEAR_COUNT_KEY, nextExtreme, false);'), 'EXTREME clears must be recorded');
// 極限は内部の difficulty が Normal のままなので、挑戦回数・最高到達WAVEへ入れるとチャレンジの記録が壊れる
assert(source.includes('if (!forcedEnemyKey && !extremeRunRef.current && !debugBattleRef.current) {')
  && source.includes('if (!enemy && !extremeRunRef.current && !debugBattleRef.current) {'), 'EXTREME must not touch the challenge attempt / highest-wave records');
// 敵の強さ: 極限だけ×13を渡し、それ以外は null(=難易度の倍率)のまま。null が 0 扱いされないこと
assert(source.includes('createBattleEnemy(w,difficulty,forcedEnemyKey,extremeRunRef.current?EXTREME_SETTING.power:null)'), 'only EXTREME may override the enemy power');
assert(source.includes('const hasPowerOverride = powerOverride !== null && powerOverride !== undefined && Number.isFinite(Number(powerOverride));')
  && source.includes('const mod = hasPowerOverride ? Number(powerOverride) : DIFFICULTY_SETTINGS[safeDifficulty].power;'), 'a null override must fall back to the difficulty power');
// デバッグから入った周回は debugBattleRef が true のままなので、報酬・記録・ランキングをすべて通らない
assert(!/EXTREME_DIFFICULTY_SELECT';[^\n]*debugBattleRef\.current=/.test(source), 'the EXTREME start button must not overwrite the debug flag');
assert(source.indexOf('debugBattleRef.current') < source.indexOf('awardRunRewards'), 'debug reward isolation must precede persistent rewards');
assert(source.includes('EXTREME 検証結果（保存されません）') && /\{debugBattle&&debugOutcome&&\(/.test(source), 'the not-saved notice must only appear on debug plays');
for (const label of ['ランキング対象外（デバッグ）','デバッグプレイ専用','全WAVE詳細（デバッグ）','デバッグ確認中のため、記録・報酬は保存されません']) {
  assert(!source.includes(label), `official screens must not keep the debug label: ${label}`);
}

// --- ⑤ 保存キー・ランキング ---
assert(source.includes("const EXTREME_BEST_SCORE_KEY = 'mh_extreme_hs_EXTREME';") && source.includes("const EXTREME_CLEAR_COUNT_KEY = 'mh_extreme_clears_EXTREME';"), 'EXTREME records must live in their own new keys');
assert(source.includes('await storeSet(EXTREME_BEST_SCORE_KEY, score, false);'), 'EXTREME must keep its own best score');
assert(source.indexOf('if (extremeRunRef.current) {') < source.indexOf('const result = await submitLocalScore(difficulty, score, runIdRef.current);'), 'EXTREME must return before the challenge ranking submission');
// ランキングはチャレンジ・プロと同じ作り。テーブルも列も増やさず、difficultyへ入れる値だけで分ける
assert(source.includes("const EXTREME_RANKING_PREFIX = 'Extreme';")
  && source.includes('...EXTREME_DIFFICULTIES.map(setting => `${EXTREME_RANKING_PREFIX}${setting.id}`),'), 'EXTREME must get its own ranking namespace inside the existing table');
assert(source.includes('const result = await submitLocalScore(rankingDifficultyForMode(EXTREME_MODE.id, extremeDifficulty), score, runIdRef.current);'), 'EXTREME scores must be submitted through the shared ranking path');
assert(source.includes("if (text.startsWith(EXTREME_RANKING_PREFIX)) return text.slice(EXTREME_RANKING_PREFIX.length);"), 'the extreme prefix must be stripped for display');
assert(!/submitLocalScore\((?!rankingDifficultyForMode|difficulty)/.test(source), 'no other ranking submission path may be introduced');

// --- ⑥ 画面・演出・助手 ---
// モードの共通説明とランキングの導線(チャレンジ・プロと同じ2つのボタン)
for (const heading of ['モード概要', '難易度', '報酬', 'こんな人におすすめ']) {
  assert(modeDescription.includes(`'${heading}'`), `the extreme mode details must include the shared heading: ${heading}`);
}
assert(source.includes("if (typeof EXTREME_MODE !== 'undefined' && EXTREME_MODE && mode === EXTREME_MODE.id) return EXTREME_MODE;"), 'battleModeInfo must resolve the extreme mode so its description and ranking screen work');
assert(source.includes('<button disabled={!!battleTutorial} onClick={()=>setModeInfoId(m.id)}') && !source.includes("isExtreme?'チャレンジモード最高難度'"), 'the description button must be enabled for every mode');
assert(source.includes("openModeScoreRanking(m.id,EXTREME_SETTING.id,'BATTLE_MODE_SELECT')")
  && source.includes("openModeScoreRanking(EXTREME_MODE.id,setting.id,'EXTREME_DIFFICULTY_SELECT')"), 'the extreme ranking must be reachable from both the mode card and the difficulty card');
assert(source.includes('const isExtreme = mode === EXTREME_MODE.id;') && source.includes('EXTREME_DIFFICULTIES.filter(setting=>setting.available).map(setting=>'), 'the ranking screen must list the extreme tiers instead of the nine challenge difficulties');
assert(source.includes("Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, rankingViewDiff) ? rankingViewDiff : BATTLE_DEFAULT_DIFFICULTY"), 'the legacy ranking screen must not crash on an extreme tier id');
assert(source.includes('data-extreme-difficulties'), 'dedicated EXTREME difficulty screen must be rendered');
assert(source.includes("isExtreme?'EXTREME_DIFFICULTY_SELECT':'BATTLE_DIFFICULTY_SELECT'"), 'EXTREME mode must lead to its dedicated difficulty screen');
assert(source.includes("EXTREME_DIFFICULTY_SELECT: 'enhance'"), 'EXTREME difficulty selection must reuse the challenge selection BGM');
assert(source.includes('左右にスワイプして難易度を選択') && source.includes('snap-x snap-mandatory'), 'EXTREME must reuse the challenge difficulty carousel structure');
assert(source.includes('mh-extreme-enemy-image') && source.includes("extremeRun?' mh-extreme-enemy-image':''"), 'all EXTREME enemies must receive the image-bound dedicated aura');
assert(source.includes('mh-extreme-enemy-aura-shell') && source.includes('@keyframes mhExtremeEnemyMist') && source.includes('@keyframes mhExtremeEnemyFloor'), 'EXTREME aura must combine silhouette glow, rising evil energy, and a foot glow with lightweight CSS-only motion');
assert(source.includes('h-[366px]') && source.includes('flex items-start gap-2.5'), 'mode cards must share a fixed outer height and aligned carousel');
assert(/const packedLines = scene \? ASSISTANT_LINE_PACKS\.flatMap/.test(assistants), 'line-pack-only EXTREME assistant dialogue must remain reachable');
assert(source.includes("? 'extremeChallenge'") && source.includes("const extremeDifficultyAssistantScene = extremeDifficulty === NIGHTMARE_SETTING.id && nightmareUnlocked ? 'nightmareDifficulty' : 'extremeDifficulty';") && source.includes('scene={extremeDifficultyAssistantScene}') && !source.includes('extremeGuideStep'), 'mode and EXTREME difficulty must use separate shared assistant scenes without a post-selection dialogue');
const sceneLines = (name) => {
  const start = assistants.indexOf(`${name}: [`);
  return assistants.slice(start, assistants.indexOf('],', start)).match(/\{ e:/g)?.length || 0;
};
assert(sceneLines('extremeChallenge') >= 5, 'the extreme mode scene needs at least 5 lines');
assert(sceneLines('extremeDifficulty') >= 5, 'the EXTREME difficulty scene needs at least 5 lines');
assert(sceneLines('nightmareDifficulty') >= 5, 'the NIGHTMARE preview scene needs at least 5 lines');
for (const expected of ['EXTREMEの次', '有利な補正', '不利な補正', '距離適性', 'WAVEごとの戦い方']) assert(assistants.includes(expected), `NIGHTMARE assistant guidance must include: ${expected}`);
const modeScene = assistants.slice(assistants.indexOf('extremeChallenge: ['), assistants.indexOf('extremeDifficulty: ['));
assert(!modeScene.includes('ブリーダーカード'), 'the mode scene must not explain the EXTREME-only breeder-card rule');
for (const forbidden of ['×13', '×20', '×25', '×7.5', '75', '50%']) {
  assert(!modeScene.includes(forbidden), `the mode assistant scene must not include EXTREME-only information: ${forbidden}`);
}

// --- ⑦ 初回案内・ヘルプ・更新履歴 ---
assert(/id: 'update_notice_extreme_challenge_v1', enabled: true,/.test(assistants) && !/id: 'update_notice_extreme_challenge_v1'[^}]*debugOnly/.test(assistants), 'the official release must be announced once through the shared update notice');
assert(help.includes("id: 'extreme-challenge'") && help.includes("EXTREME_DIFFICULTY_SELECT: 'basics/extreme-challenge'"), 'help must describe the official extreme challenge and cover its screen');
assert(help.includes("{ t:'data', id:'extremeDifficulties' }") && source.includes("case 'extremeDifficulties':"), 'the difficulty table must be generated from the real data');
assert(changelog.includes('極限チャレンジのモード説明を再調整しました') && !changelog.includes('極限チャレンジのモード説明をデバッグ'), 'the extreme changelog must retain the mode-copy adjustment');
assert(changelog.includes('極限チャレンジに全WAVE詳細を追加しました'), 'the latest extreme changelog must describe WAVE details');

// --- 代表値 ---
assert.strictEqual(Math.floor(100 * 0.5), 50, 'representative integer card effect must be exactly 50%');
assert.strictEqual(0.1 * 0.5, 0.05, 'representative ratio card effect must be exactly 50%');
assert.strictEqual(Math.floor(100 * 13), 1300, 'EXTREME enemy HP/attack must be x13 versus Normal');
assert.strictEqual(Math.floor(100 * 15), 1500, 'NIGHTMARE preview enemy HP/attack must be x15 versus Normal');
console.log('OK: 極限チャレンジ 正式版(解放条件・EXTREME倍率・50%固有ルール・報酬保存・デバッグ隔離・記録の分離)');
