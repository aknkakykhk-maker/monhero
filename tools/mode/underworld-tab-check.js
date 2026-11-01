#!/usr/bin/env node
// 冥界チャレンジ(INFERNO・COCYTUS を難易度選びの「冥界」タブへ移す)の一覧・解放・印を検査する。
// 保存キー・ランキングの枠は難易度の名前のまま変えないことも見る。cocytus-rules-check.js と同じ作り。
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'monster-hero/src/game-system.jsx'),'utf8');
const help=fs.readFileSync(path.join(root,'monster-hero/data/help.js'),'utf8');
const changelog=fs.readFileSync(path.join(root,'monster-hero/data/changelog.js'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);if(a<0||b<=a)throw new Error(`section not found: ${from}`);return source.slice(a,b);};
const sandbox={DIFFICULTY_SETTINGS:{},RANGE_LABELS:['零','近','中','遠'],QUICK_GROWTH_MULT:1.1,isQuickMode:()=>false,isProMode:()=>false,PRO_RANKING_PREFIX:'Pro',EXTREME_MODE:{id:'extreme'},console};
vm.createContext(sandbox);
vm.runInContext([
  "const BATTLE_MODE_CHALLENGE='challenge',BATTLE_MODE_QUICK='quick',BATTLE_MODE_PRO='pro',BATTLE_MODE_SPECIES_CHALLENGE='speciesChallenge',"
  + "BATTLE_MODE_TACTICS='tactics',BATTLE_MODE_TACTICS_SPECIES='tacticsSpecies',BATTLE_MODE_TACTICS_PRO='tacticsPro';"
  + "const isTacticsMode=()=>false,isSpeciesChallengeMode=(m)=>m===BATTLE_MODE_SPECIES_CHALLENGE,isRaidJackMode=()=>false;",
  slice('const EXTREME_DIFFICULTIES = Object.freeze([','// ===== トレーニング'),
  slice('const TRAINING_PICK_COUNT','// 極限チャレンジの説明には'),
  slice('const EXTREME_RANKING_PREFIX','// ランキングの難易度キーから'),
  slice('const extremeBestScoreKey','const normalizeExtremeRecordValue'),
  slice('const isNightmareUnlocked','const normalizeBattleDifficulty'),
].join('\n'),sandbox);
const G=name=>vm.runInContext(name,sandbox);
const h=G('HELHEIM_SETTING'),under=G('helheimUnderworldRules');
const near=(a,b)=>Math.abs(a-b)<1e-9;
const revivalCount=G('extremeRevivalCount'),revive=G('extremeRevivedEnemyStats');
const adjust=G('extremeEnemyStatAdjust'),allyRate=G('extremeAllyMaxHpRate'),applyRate=G('applyAllyMaxHpRate');
const waveEnemy=G('extremeWaveEnemyMultiplier'),damage=G('extremeDamageTurnMultiplier');

const ids=list=>G(list).map(x=>x.id).join();
check('冥界の印はINFERNO・COCYTUSだけ',G('isUnderworldDifficultyId')('INFERNO')&&G('isUnderworldDifficultyId')('COCYTUS')&&!G('isUnderworldDifficultyId')('ETERNAL')&&!G('isUnderworldDifficultyId')('EXTREME')&&!G('isUnderworldDifficultyId')('Normal'));
check('極限タブはETERNALまでの9つ・冥界タブは2つ',ids('PUBLIC_EXTREME_TAB_DIFFICULTIES')==='EXTREME,NIGHTMARE,CHAOS,ULTIMATE,INFINITY,GOD,RAGNAROK,HELHEIM,ETERNAL'&&ids('PUBLIC_UNDERWORLD_DIFFICULTIES')==='INFERNO,COCYTUS');
check('極限の一覧の並びは変えない(保存・ランキング・種族チャレンジが使う)',ids('ALL_EXTREME_DIFFICULTIES').endsWith('ETERNAL,INFERNO,COCYTUS')&&G('SPECIES_CHALLENGE_DIFFICULTY_IDS').slice(-3).join()==='ETERNAL,INFERNO,COCYTUS');
check('保存キーとランキングの枠は難易度の名前のまま',G('extremeBestScoreKey')('INFERNO')==='mh_extreme_hs_INFERNO'&&G('extremeClearCountKey')('INFERNO')==='mh_extreme_clears_INFERNO'
  &&G('rankingDifficultyForMode')('extreme','INFERNO')==='ExtremeINFERNO'&&G('rankingDifficultyForMode')('extreme','COCYTUS')==='ExtremeCOCYTUS');
check('冥界のタブはETERNALクリアで開く',!G('isUnderworldUnlocked')(0)&&G('isUnderworldUnlocked')(1));
check('カードのシールドの枚数の幅',G('underworldShieldLayerRange')('INFERNO')==='3〜5'&&G('underworldShieldLayerRange')('COCYTUS')==='4〜5'&&G('underworldShieldLayerRange')('ETERNAL')==='');
check('冥界の難易度はルール詳細の先頭がシールドの欄',G('extremeRuleDetailGroups')('INFERNO')[0].title==='ボスの層のシールド'&&G('extremeRuleDetailGroups')('COCYTUS')[0].title==='層のシールド'&&G('extremeRuleDetailGroups')('ETERNAL')[0].title!=='層のシールド');
check('COCYTUSのルール詳細に「最大ライフは変わらない」の起き上がりの欄を出さない',!G('extremeRuleDetailGroups')('COCYTUS').some(g=>g.title==='不死（死者の再起）')&&G('extremeRuleDetailGroups')('ETERNAL').some(g=>g.title==='不死（死者の再起）'));
check('本体: 難易度選びのタブは通常・極限・冥界の3つ',source.includes("[[DIFFICULTY_TAB_NORMAL,'通常'],[DIFFICULTY_TAB_EXTREME,'極限'],[UNDERWORLD_TAB_ID,'冥界']]")
  &&source.includes("...(challengeExtremeTab?[[UNDERWORLD_TAB_ID,'冥界']]:[])"));
check('本体: 冥界の画面の見出しと目印',source.includes("title={underworldTab?'冥界チャレンジ':'極限チャレンジ'}")&&source.includes("data-underworld={underworldTab?'1':undefined}")
  &&source.includes('data-underworld-card={underworldTab?setting.id:undefined}')&&source.includes("const UNDERWORLD_TAB_SEEN_KEY = 'mh_underworld_tab_seen_v1';"));
check('本体: 極限のカードの記録はETERNALまでの9つから・助手は「冥界」でINFERNO・COCYTUS',source.includes('highestModeScore(extremeBestScores,PUBLIC_EXTREME_TAB_DIFFICULTIES.map(setting=>setting.id))')
  &&source.includes('ids = tabs.filter(isExtremeId).filter(id => (c.underworld ? isUw(id) : !isUw(id)));'));
process.exit(failed?1:0);
