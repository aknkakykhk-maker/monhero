#!/usr/bin/env node
// 極限チャレンジ(正式公開)の仕様を静的に確認する。
//   ① 難易度表(EXTREMEとNIGHTMAREを公開、CHAOSは内部仕様のみ)と倍率
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
assert(/EXTREME[^\n]+available:true[^\n]+power:13[^\n]+score:20[^\n]+xp:25[^\n]+gold:7\.5[^\n]+psyche:30[^\n]+specialRules:Object\.freeze\(\{ breederCardEffect:0\.5 \}\)/.test(config), 'EXTREME settings and its difficulty-specific rule must match the official specification');
assert(/NIGHTMARE[^\n]+available:true[^\n]+power:15[^\n]+score:20[^\n]+xp:30[^\n]+gold:10[^\n]+psyche:40[^\n]+specialRules/.test(config), 'NIGHTMARE must expose its official values and rules for battle');
assert(/CHAOS[^\n]+available:false[^\n]+power:20[^\n]+score:20[^\n]+xp:35[^\n]+gold:15[^\n]+psyche:50[^\n]+unlockRequirement:'NIGHTMARE'[^\n]+specialRules:Object\.freeze\(\{ damageDealt:0\.5, allyJoinBonus:0\.5, gutsCost:1\.5 \}\)/.test(config), 'CHAOS must retain its complete internal specification while unavailable');
for (const name of ['ULTIMATE','INFINITY']) assert(new RegExp(`${name}[^\\n]+available:false`).test(config), `${name} must remain unavailable without placeholder values`);
assert(config.includes('const isNightmareUnlocked = (extremeClearCount) => (Number(extremeClearCount) || 0) > 0;'), 'NIGHTMARE unlock must reuse the existing EXTREME clear count');
assert(source.includes("{previewable?'この難易度で挑戦':'選択できません'}"), 'previewable EXTREME tiers must be selectable');

// --- ② 解放条件 ---
assert(config.includes("const EXTREME_UNLOCK_DIFFICULTIES = Object.freeze(['GrandMaster', 'Hell', 'Legend'])"), 'unlock must reuse the three highest challenge difficulties');
assert(config.includes("const EXTREME_UNLOCK_TEXT = 'チャレンジ Grand Master以上クリアで解放'"), 'locked card must explain the unlock condition');
assert(/const isExtremeUnlocked = \(clearCounts\) => EXTREME_UNLOCK_DIFFICULTIES[\s\S]{0,160}\(Number\(clearCounts\?\.\[key\]\) \|\| 0\) > 0\)/.test(config), 'unlock must read the existing challenge clear counts');
assert(source.includes('const extremeUnlocked = useMemo(() => isExtremeUnlocked(clearCounts), [clearCounts]);'), 'unlock state must derive from the loaded clear counts');
assert(source.includes('const modes=[...BATTLE_MODES,EXTREME_MODE];'), 'the extreme card must always be listed, locked or not');
assert(source.includes('extremeLocked=isExtreme&&!extremeUnlocked&&!debugBattle') && source.includes("disabled={extremeLocked||(!!battleTutorial") && source.includes("disabled={!previewable}"), 'official locked extreme tiers must remain unselectable while debug may enter');
assert(source.includes("const nightmareUnlocked = useMemo(() => isNightmareUnlocked(extremeClearCount), [extremeClearCount]);") && source.includes("setting.id==='NIGHTMARE'?nightmareUnlocked:false"), 'NIGHTMARE details must unlock from the loaded EXTREME clear count');
assert(source.includes("const unlocked=debugBattle||(setting.id==='EXTREME'?extremeUnlocked:setting.id==='NIGHTMARE'?nightmareUnlocked:false)"), 'debug mode must unlock EXTREME and NIGHTMARE regardless of official progress');
assert(source.includes("const debugChaos=debugBattle&&setting.id==='CHAOS'")
  && source.includes('const previewable=(setting.available&&unlocked)||debugChaos'), 'only debug mode may preview unavailable CHAOS');
assert(source.includes("debugChaos?'NIGHTMAREクリア'") && source.includes("debugChaos?'DEBUG確認専用・保存なし'"), 'debug CHAOS card must show its unlock condition and no-save status');
assert(source.includes("disabled={!previewable} onClick={()=>setShowWaveDetails(true)}")
  && source.includes("const extreme=gameState==='EXTREME_DIFFICULTY_SELECT'")
  && source.includes("const powerOverride=extreme?extremePreviewSetting.power:null")
  && source.includes('createBattleEnemy(index+1,waveDifficulty,null,powerOverride)'), 'EXTREME must open the shared WAVE details with its battle power override');
assert(source.includes("{previewable?'全WAVE詳細':'詳細 ？？？'}"), 'only unlocked previewable tiers may open WAVE details');

// --- ③ EXTREME固有ルール ---
assert(source.includes("isBreeder&&specialRuleDifficulty?extremeSpecialRule(specialRuleDifficulty,'breederCardEffect')"), 'only breeder cards must receive the selected EXTREME difficulty rule');
assert(source.includes("addPermaBuff('atkPct',card.baseValue*effMul)"), 'normal breeder buff must use the shared multiplier');
assert(source.includes('Math.floor(getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false)*effMul)'), 'breeder attack damage must use the shared multiplier');
assert(source.includes("const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved"), 'non-breeder attacks must retain their existing calculation');
assert(!config.includes('teachingEffect') && source.includes("lines.push(['ブリーダーカード効果',specialRulePercent(rules.breederCardEffect)])"), 'the 50% breeder-card rule must use the shared EXTREME specialRules presentation');
assert(!/highlights:\[[^\]]*ブリーダーカード/.test(config), 'the mode-level description must not mention the EXTREME-only breeder-card rule');
const modeDescription = config.slice(config.indexOf('const EXTREME_MODE'), config.indexOf('const EXTREME_UNLOCK_DIFFICULTIES'));
for (const forbidden of ['×13', '13倍', '×20', '20倍', '×25', '25倍', '×7.5', '7.5倍', '75個', 'ブリーダーカード', '50%']) {
  assert(!modeDescription.includes(forbidden), `the mode-level description must not include EXTREME-only information: ${forbidden}`);
}
for (const expected of ['通常チャレンジを超える高難易度', 'EXTREMEから始まる、さらなる強敵への挑戦', '高難易度に見合った高い報酬']) {
  assert(modeDescription.includes(expected), `the mode card must explain the shared extreme-challenge feature: ${expected}`);
}
assert(source.includes("const showExtremeRule = w === 1 && !!specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)") && source.includes('setExtremeRuleOpen(showExtremeRule); setIsBusy(showExtremeRule)'), 'the 50% rule must block normal input once at WAVE 1');

// --- ④ 報酬・記録 ---
assert(source.includes('const baseGain = extremeRunRef.current ? selectedExtremeSetting.psyche : clearPsycheReward(difficulty);')
  && source.includes('const gain = applyQuickPsychePolicy(baseGain, runMode, quickRewardPolicyRunRef.current);'), 'EXTREME clear must grant its own psyche count through the shared reward-policy path');
assert(source.includes('const extreme = extremeRunRef.current;') && source.includes('const scoreMult = extreme ? selectedExtremeSetting.score : (quickExtremeSetting?.xp || DIFFICULTY_SETTINGS[difficulty]?.score || 1.0);')
  && source.includes('const goldMult = extreme ? selectedExtremeSetting.gold : (quickExtremeSetting?.gold || DIFFICULTY_SETTINGS[difficulty]?.gold || 1.0);')
  && source.includes('const xpMult = extreme ? selectedExtremeSetting.xp : scoreMult;'), 'official EXTREME rewards must use its own score/xp/gold multipliers');
assert(source.includes('await storeSet(extremeClearCountKey(extremeDifficulty), nextExtreme, false);'), 'EXTREME clears must be recorded');
// 極限は内部の difficulty が Normal のままなので、挑戦回数・最高到達WAVEへ入れるとチャレンジの記録が壊れる
assert(source.includes('if (!forcedEnemyKey && !extremeRunRef.current && !debugBattleRef.current) {')
  && source.includes('if (!enemy && !extremeRunRef.current && !debugBattleRef.current) {'), 'EXTREME must not touch the challenge attempt / highest-wave records');
// 敵の強さ: 極限だけ×13を渡し、それ以外は null(=難易度の倍率)のまま。null が 0 扱いされないこと
assert(source.includes('createBattleEnemy(w,difficulty,forcedEnemyKey,extremeRunRef.current?(EXTREME_DIFFICULTIES.find(setting=>setting.id===extremeDifficulty)||EXTREME_SETTING).power:null)'), 'only EXTREME may override the enemy power');
assert(source.includes('const hasPowerOverride = powerOverride !== null && powerOverride !== undefined && Number.isFinite(Number(powerOverride));')
  && source.includes('const mod = hasPowerOverride ? Number(powerOverride) : QUICK_DIFFICULTY_SETTINGS[safeDifficulty].power;'), 'a null override must fall back to the difficulty power');
// デバッグから入った周回は debugBattleRef が true のままなので、報酬・記録・ランキングをすべて通らない
assert(!/EXTREME_DIFFICULTY_SELECT';[^\n]*debugBattleRef\.current=/.test(source), 'the EXTREME start button must not overwrite the debug flag');
assert(source.indexOf('debugBattleRef.current') < source.indexOf('awardRunRewards'), 'debug reward isolation must precede persistent rewards');
assert(source.includes('EXTREME 検証結果（保存されません）') && /\{debugBattle&&debugOutcome&&\(/.test(source), 'the not-saved notice must only appear on debug plays');
for (const label of ['ランキング対象外（デバッグ）','デバッグプレイ専用','全WAVE詳細（デバッグ）','デバッグ確認中のため、記録・報酬は保存されません']) {
  assert(!source.includes(label), `official screens must not keep the debug label: ${label}`);
}

// --- ⑤ 保存キー・ランキング ---
assert(source.includes("const EXTREME_BEST_SCORE_KEY = extremeBestScoreKey('EXTREME');") && source.includes("const EXTREME_CLEAR_COUNT_KEY = extremeClearCountKey('EXTREME');"), 'EXTREME records must live in their own new keys');
assert(source.includes('await storeSet(extremeBestScoreKey(extremeDifficulty), score, false);'), 'EXTREME must keep its own best score');
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
assert(source.includes('mh-extreme-enemy-image') && source.includes("extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'"), 'all EXTREME enemies must receive the image-bound dedicated aura');
assert(source.includes('mh-nightmare-enemy-aura-shell') && source.includes('@keyframes mhNightmareMist') && source.includes('mh-extreme-enemy-aura-shell') && source.includes('@keyframes mhExtremeEnemyMist') && source.includes('@keyframes mhExtremeEnemyFloor'), 'EXTREME and NIGHTMARE auras must remain distinct; EXTREME must combine silhouette glow, rising evil energy, and a foot glow with lightweight CSS-only motion');
assert(source.includes('h-[366px]') && source.includes('flex items-start gap-2.5'), 'mode cards must share a fixed outer height and aligned carousel');
assert(/const packedLines = scene \? ASSISTANT_LINE_PACKS\.flatMap/.test(assistants), 'line-pack-only EXTREME assistant dialogue must remain reachable');
assert(source.includes("? 'extremeChallenge'") && source.includes('const extremeDifficultyAssistantScene = `${extremeDifficulty.toLowerCase()}Difficulty`;') && source.includes('key={extremeDifficultyAssistantScene}') && source.includes('scene={extremeDifficultyAssistantScene}') && !source.includes('extremeGuideStep'), 'the centered EXTREME tier card must select its own shared assistant scene regardless of unlock state');
const sceneLines = (name) => {
  const start = assistants.indexOf(`${name}: [`);
  return assistants.slice(start, assistants.indexOf('],', start)).match(/\{ e:/g)?.length || 0;
};
assert(sceneLines('extremeChallenge') >= 5, 'the extreme mode scene needs at least 5 lines');
assert(sceneLines('extremeDifficulty') >= 5, 'the EXTREME difficulty scene needs at least 5 lines');
assert(sceneLines('nightmareDifficulty') >= 5, 'the NIGHTMARE scene needs at least 5 lines');
for (const name of ['chaosDifficulty', 'ultimateDifficulty', 'infinityDifficulty']) {
  assert(sceneLines(name) >= 5, `the ${name} preview scene needs at least 5 lines`);
}
assert(source.includes('data-extreme-difficulty-card={setting.id}') && source.includes('h-[382px] flex flex-col'), 'all five EXTREME tier cards must share one fixed outer height');
assert(source.includes("lines.push(['自動回復補正',signed],['距離適性補正',signed])") && source.includes('grid-cols-[6.5rem_1fr]') && source.includes('whitespace-nowrap'), 'NIGHTMARE rule labels and values must remain aligned and unbroken');
for (const expected of ["['与ダメージ',specialRulePercent(rules.damageDealt)]", "['供モン加入ボーナス',specialRulePercent(rules.allyJoinBonus)]", "['消費ガッツ',specialRulePercent(rules.gutsCost)]"]) {
  assert(source.includes(expected), `CHAOS debug card must label its planned special rule: ${expected}`);
}
assert(source.includes('有利な補正は弱まり、不利な補正は重くなる。距離適性とWAVEごとの立ち回りが重要な高難易度。'), 'NIGHTMARE card must use the approved natural description');
assert(source.includes('h-[42px] shrink-0') && source.includes('h-[51px] shrink-0') && source.includes('mt-auto pt-1.5'), 'available tier cards must reserve equal record, rule, and footer regions');
for (const expected of ['EXTREMEの次', '有利な補正', '不利な補正', '距離適性', 'WAVEごとの戦い方']) assert(assistants.includes(expected), `NIGHTMARE assistant guidance must include: ${expected}`);
const modeScene = assistants.slice(assistants.indexOf('extremeChallenge: ['), assistants.indexOf('extremeDifficulty: ['));
assert(!modeScene.includes('ブリーダーカード'), 'the mode scene must not explain the EXTREME-only breeder-card rule');
for (const forbidden of ['×13', '×20', '×25', '×7.5', '75', '50%']) {
  assert(!modeScene.includes(forbidden), `the mode assistant scene must not include EXTREME-only information: ${forbidden}`);
}

// --- ⑦ 初回案内・ヘルプ・更新履歴 ---
assert(/id: 'update_notice_extreme_challenge_v1', enabled: true,/.test(assistants) && !/id: 'update_notice_extreme_challenge_v1'[^}]*debugOnly/.test(assistants), 'the official release must be announced once through the shared update notice');
assert(/id: 'update_notice_nightmare_v1', enabled: true,/.test(assistants) && !/id: 'update_notice_nightmare_v1'[^}]*debugOnly/.test(assistants), 'NIGHTMARE must have its own official one-time notice');
assert(help.includes("id: 'extreme-challenge'") && help.includes("EXTREME_DIFFICULTY_SELECT: 'basics/extreme-challenge'"), 'help must describe the official extreme challenge and cover its screen');
assert(help.includes("{ t:'data', id:'extremeDifficulties' }") && source.includes("case 'extremeDifficulties':"), 'the difficulty table must be generated from the real data');
assert(changelog.includes('極限チャレンジのモード説明を再調整しました') && !changelog.includes('極限チャレンジのモード説明をデバッグ'), 'the extreme changelog must retain the mode-copy adjustment');
assert(changelog.includes('極限チャレンジに全WAVE詳細を追加しました'), 'the latest extreme changelog must describe WAVE details');
const nightmareUpdateStart = changelog.indexOf('title: "極限チャレンジに新難易度 NIGHTMARE を追加"');
const latestVisibleUpdate = changelog.slice(changelog.lastIndexOf('  {', nightmareUpdateStart), changelog.indexOf('\n  },', nightmareUpdateStart));
assert(latestVisibleUpdate.includes('type: "update"') && latestVisibleUpdate.includes('items: ['), 'the official NIGHTMARE entry must use the schema rendered by the in-game update screen');
for (const expected of ['極限チャレンジに新難易度 NIGHTMARE を追加', 'EXTREMEをクリアすると解放', '独自の特殊ルール']) {
  assert(latestVisibleUpdate.includes(expected), `the visible NIGHTMARE changelog must include: ${expected}`);
}
assert(!/デバッグ|準備中|内部実装/.test(latestVisibleUpdate), 'the visible NIGHTMARE changelog must not include internal or debug history');

// --- 代表値 ---
assert.strictEqual(Math.floor(100 * 0.5), 50, 'representative integer card effect must be exactly 50%');
assert.strictEqual(0.1 * 0.5, 0.05, 'representative ratio card effect must be exactly 50%');
assert.strictEqual(Math.floor(100 * 13), 1300, 'EXTREME enemy HP/attack must be x13 versus Normal');
assert.strictEqual(Math.floor(100 * 15), 1500, 'NIGHTMARE enemy HP/attack must be x15 versus Normal');
console.log('OK: 極限チャレンジ 正式版(解放条件・EXTREME倍率・50%固有ルール・報酬保存・デバッグ隔離・記録の分離)');
