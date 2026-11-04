#!/usr/bin/env node
// MALEBOLGE(仮の名前・INFERNO と COCYTUS のあいだの段・2026-11-04 社長の決定)の正式設定・層のシールド・攻撃の上がり方・蘇り・
// ごほうび・解放の順(INFERNO → MALEBOLGE → COCYTUS)を、本体helperを切り出して検査する。cocytus-rules-check.js と同じ作り。
//   決めごと: 固さは INFERNO の約6倍。強度450・敵ライフ15倍。層の枚数は COCYTUS と同じ(W1・2 4枚 / W3〜10 5枚)。
//   1枚目は最大ライフの1.8倍(W9 2.6倍・W10 3.0倍)。割るたびの攻撃はふつう+20%・ボス+30%。蘇りはムーだけ1回(×1.5)。
//   ごほうび 経験値×150・ダイヤ×130・虹235・勇者の証5・種族チャレンジ初回150
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


const M=G('MALEBOLGE_SETTING'),rules=G('malebolgeStageRules'),plan=G('extremeShieldLayerPlan'),afterHit=G('enemyAfterHit');
const rush=G('extremeLayerRushHits');
check('基本設定(強度450・スコア×20・経験値×150・ダイヤ×130・虹235・INFERNOクリアで解放・冥界タブ)',M.available&&M.debugAvailable&&M.power===450
  &&M.score===20&&M.xp===150&&M.gold===130&&M.psyche===235&&M.unlockRequirement==='INFERNO'&&M.tab==='underworld');
check('IDと動的キー(新しいキーで足す)',M.recordId===M.id&&M.rankingId===`Extreme${M.id}`
  &&G('extremeBestScoreKey')(M.id)===`mh_extreme_hs_${M.id}`&&G('extremeClearCountKey')(M.id)===`mh_extreme_clears_${M.id}`
  &&G('rankingDifficultyForMode')('extreme',M.id)===`Extreme${M.id}`);
check('極限の一覧と種族チャレンジの並びは INFERNO と COCYTUS のあいだ(21段)',(()=>{const ids=G('ALL_EXTREME_DIFFICULTIES').map(x=>x.id);const sp=G('SPECIES_CHALLENGE_DIFFICULTY_IDS');
  return ids.indexOf(M.id)===ids.indexOf('INFERNO')+1&&ids.indexOf('COCYTUS')===ids.indexOf(M.id)+1&&sp.indexOf(M.id)===sp.indexOf('INFERNO')+1&&sp[sp.length-1]==='COCYTUS';})()
  // 通常9+極限5+GOD〜COCYTUS 7 = 21段(この検査では通常の表を空にしているので、本体の並びの文で見る)
  &&/'GOD','RAGNAROK','HELHEIM','ETERNAL','INFERNO','MALEBOLGE','COCYTUS',/.test(source));
check('INFERNOクリアで解放',!G('isMalebolgeUnlocked')(0)&&G('isMalebolgeUnlocked')(1)&&!G('isMalebolgeUnlocked')(undefined));
check('種族チャレンジ: 初回クリア報酬150・INFERNOのあとに開く',G('speciesChallengeFirstClearReward')(M.id)===150
  &&(()=>{const f=G('isSpeciesChallengeDifficultyUnlocked');return !f(M.id,['ETERNAL'])&&f(M.id,['INFERNO']);})());
check('クイックに入れない',G('QUICK_EXTREME_SETTINGS')[M.id]===undefined);
check('ETERNALのルール(冥府・貫き)を引き継ぎ、敵のライフは15倍(デュラハンはさらに1.3倍)',[1,3,9,10].every(w=>{const a=rules(w),b=G('eternalStageRules')(w);return a.level===b.level&&a.enemyMultiplier===b.enemyMultiplier&&a.pierceRate===b.pierceRate;})
  &&G('extremeEnemyStatAdjust')(M.id,'Dino').lifeRate===15&&near(G('extremeEnemyStatAdjust')(M.id,'Durahan').lifeRate,19.5));
check('層の数は COCYTUS と同じ(W1・2 4枚・W3〜10 5枚)',[[1,4],[2,4],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]].every(([w,n])=>rules(w).shieldLayers===n));
check('1枚目=最大ライフ×1.8(W9 2.6・W10 3.0)、+30%ずつ、ボスだけ本体に倍率',(()=>{const b=plan(M.id,10,1000,450);const d=plan(M.id,9,1000,450);const n=plan(M.id,4,1000,450);const e=plan(M.id,1,1000,450);
  return b.layers.join()==='3000,3900,4800,5700,6600'&&near(b.bodyRate,2.5)&&b.boss===true&&d.layers[0]===2600&&d.layers.length===5
    &&n.layers.join()==='1800,2340,2880,3420,3960'&&n.bodyRate===1&&n.boss===false&&e.layers.length===4;})());
check('割るたびの攻撃: ふつうの敵+20%・ボス+30%',[1,2,4,6,8].every(w=>near(plan(M.id,w,1000,450).atkGain,0.2))&&[3,5,7,9,10].every(w=>near(plan(M.id,w,1000,450).atkGain,0.3)));
const foe=(gain)=>({hp:1000,maxHp:1000,atk:100,shell:1800,maxShell:1800,shellLayers:[2340,2880,3420],shellLayerMaxes:[1800,2340,2880,3420],shellLayerTotal:4,shellBroken:0,shellBreakSeq:0,layerAtkBase:100,layerAtkGain:gain,shellBoss:false});
check('1枚割るごとに攻撃が足し算で上がる(ボス+30%なら4枚で+120%)',(()=>{const b=afterHit(foe(0.3),1800+2340+2880+3420);return b.atk===220&&b.shellBroken===4&&b.hp===1000;})());
check('連撃は INFERNO・COCYTUS と同じ',rush(M.id,9,3)===1&&rush(M.id,9,4)===2&&rush(M.id,10,4)===2&&rush(M.id,10,5)===3&&rush(M.id,3,5)===1);
check('蘇りはムーだけ1回(デュラハン・ほかのボスは蘇らない)',G('extremeRevivalCount')(M.id,10)===1&&[3,5,7,9].every(w=>G('extremeRevivalCount')(M.id,w)===0));
const boss=(over)=>({hp:0,maxHp:1000,atk:200,layerAtkBase:100,layerAtkGain:0.3,shellBroken:5,shellLayerTotal:5,...over});
check('ムーの蘇り: 全回復・最大ライフ1.5倍、攻撃は層1枚ぶん(+30%)を足す・1回きり',(()=>{const a=revive(boss(),M.id,10,0);
  return a&&a.maxHp===1500&&a.hp===1500&&a.atk===280&&a.revivalNumber===1&&a.remaining===0&&a.reveal&&a.reveal.stage==='moo1'&&revive(boss(),M.id,10,1)===null;})());
check('勇者の証は5個(極限・種族チャレンジ)',/extreme:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3, ETERNAL:4, INFERNO:5, MALEBOLGE:5, COCYTUS:6 \}\)/.test(source)
  &&/speciesChallenge:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3, ETERNAL:4, INFERNO:5, MALEBOLGE:5, COCYTUS:6 \}\)/.test(source));
check('ルール詳細: 先頭は層のシールドの欄',(()=>{const g=G('extremeRuleDetailGroups')(M.id);return g.length>0&&g[0].title==='層のシールド';})());
check('本体: 解放の連鎖(INFERNO → MALEBOLGE → COCYTUS)',source.includes("setting.id==='MALEBOLGE'?malebolgeUnlocked:setting.id==='COCYTUS'?cocytusUnlocked:false")
  &&source.includes("setting.id==='MALEBOLGE'&&!malebolgeUnlocked?'INFERNOクリアで解放'")&&source.includes('isMalebolgeUnlocked(infernoClearCount)'));
check('助手のランキングの上限は21(本体とサーバ)',/const ASSISTANT_CHAT_RANKING_MAX = 21;/.test(source)
  &&/export const RANKING_PLAN_MAX = 21;/.test(fs.readFileSync(path.join(root,'supabase/functions/assistant-chat/ranking.js'),'utf8')));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
