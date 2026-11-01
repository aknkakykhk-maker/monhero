#!/usr/bin/env node
// COCYTUS(極限11番目)の正式設定・層のシールド(ふつうの敵も。枚数・1枚目=最大ライフ×3〜4.4・本体の倍率はボスだけ)・蘇り・
// 攻撃+20%・連撃の回数・ボスの印を、本体helperを切り出して検査する。inferno-rules-check.js と同じ作り。
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

const C=G('COCYTUS_SETTING'),rules=G('cocytusStageRules'),plan=G('extremeShieldLayerPlan'),afterHit=G('enemyAfterHit');
const rush=G('extremeLayerRushHits'),view=G('enemyShellView');

check('基本設定',C.id==='COCYTUS'&&C.japanese==='コキュートス'&&C.available&&C.debugAvailable&&C.power===500
  &&C.score===20&&C.xp===160&&C.gold===140&&C.psyche===250&&C.unlockRequirement==='INFERNO');
check('IDと動的キー',C.recordId==='COCYTUS'&&C.rankingId==='ExtremeCOCYTUS'
  &&G('extremeBestScoreKey')('COCYTUS')==='mh_extreme_hs_COCYTUS'&&G('extremeClearCountKey')('COCYTUS')==='mh_extreme_clears_COCYTUS'
  &&G('rankingDifficultyForMode')('extreme','COCYTUS')==='ExtremeCOCYTUS');
check('INFERNOクリアで解放',!G('isCocytusUnlocked')(0)&&G('isCocytusUnlocked')(1)&&!G('isCocytusUnlocked')(undefined));
check('難易度一覧の最後',G('ALL_EXTREME_DIFFICULTIES').map(x=>x.id).slice(-1)[0]==='COCYTUS');
check('種族チャレンジの初回クリア報酬は160・INFERNOのあとに開く',G('speciesChallengeFirstClearReward')('COCYTUS')===160
  &&(()=>{const f=G('isSpeciesChallengeDifficultyUnlocked');return !f('COCYTUS',['ETERNAL'])&&f('COCYTUS',['INFERNO']);})());
check('クイックにCOCYTUSを入れない',G('QUICK_EXTREME_SETTINGS').COCYTUS===undefined);
check('デュラハンは1回・ムーは2回蘇る、ほかのWAVEは蘇らない',G('extremeRevivalCount')('COCYTUS',9)===1&&G('extremeRevivalCount')('COCYTUS',10)===2&&[3,5,7].every(w=>G('extremeRevivalCount')('COCYTUS',w)===0));
check('ETERNALのルール(冥府・貫き・ライフ10倍)を引き継ぐ',[1,3,9,10].every(w=>{const a=rules(w),b=G('eternalStageRules')(w);return a.level===b.level&&a.enemyMultiplier===b.enemyMultiplier&&a.pierceRate===b.pierceRate&&a.minimumDamageDealt===b.minimumDamageDealt;})
  &&G('extremeEnemyStatAdjust')('COCYTUS','Dino').lifeRate===10&&near(G('extremeEnemyStatAdjust')('COCYTUS','Durahan').lifeRate,13));
check('層の数はW1・2 4枚・W3〜8 5枚・W9 5枚・W10 5枚',[[1,4],[2,4],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5]].every(([w,n])=>rules(w).shieldLayers===n));
check('ボスの印はW3/5/7/9/10だけ',[3,5,7,9,10].every(w=>rules(w).bossWave===true)&&[1,2,4,6,8].every(w=>rules(w).bossWave===false));
check('1枚目=最大ライフ×3(W9 3.8・W10 4.4)、+30%ずつ、ボスだけ本体に倍率',(()=>{const b=plan('COCYTUS',10,1000,500);const d=plan('COCYTUS',9,1000,500);const n=plan('COCYTUS',4,1000,500);const e=plan('COCYTUS',1,1000,500);
  return b.layers.join()==='4400,5720,7040,8360,9680'&&near(b.bodyRate,2.5)&&b.boss===true&&near(b.atkGain,0.2)&&d.layers[0]===3800&&d.layers.length===5
    &&n.layers.join()==='3000,3900,4800,5700,6600'&&n.bodyRate===1&&n.boss===false&&e.layers.length===4&&e.bodyRate===1;})());
check('強度が変わっても1枚目は最大ライフの3倍(強度に比例して固くなる)',plan('COCYTUS',3,2000,600).layers[0]===6000);
check('INFERNOの層は今のまま(ボスだけ・ETERNALのライフ基準・本体に倍率)',(()=>{const p=plan('INFERNO',10,4000,400);return p.layers.join()==='3000,3900,4800,5700,6600'&&near(p.bodyRate,2.5)&&p.boss===true;})()
  &&plan('INFERNO',4,4000,400)===null&&near(G('infernoStageRules')(9).layerAtkGain,0.6));
const foe=()=>({hp:1000,maxHp:1000,atk:100,shell:3000,maxShell:3000,shellLayers:[3900,4800,5700],shellLayerMaxes:[3000,3900,4800,5700],shellLayerTotal:4,shellBroken:0,shellBreakSeq:0,layerAtkBase:100,layerAtkGain:0.2,shellBoss:false});
check('1枚割るごとに攻撃+20%(足し算)',(()=>{const a=afterHit(foe(),3000);const b=afterHit(foe(),3000+3900+4800+5700);return a.atk===120&&b.atk===180&&b.shellBroken===4&&b.hp===1000;})());
check('連撃はINFERNOと同じ(デュラハン4枚目で2・ムー4枚目で2・5枚目で3)、ほかは1',rush('COCYTUS',9,3)===1&&rush('COCYTUS',9,4)===2&&rush('COCYTUS',9,5)===2&&rush('COCYTUS',10,3)===1&&rush('COCYTUS',10,4)===2&&rush('COCYTUS',10,5)===3&&rush('COCYTUS',3,5)===1&&rush('COCYTUS',8,5)===1);
check('見た目が読む状態にボスの印',view({...foe(),shellBoss:true}).boss===true&&view(foe()).boss===false&&view(foe()).total===4&&view(null).boss===false);
check('本体: 層の敵にボスの印を付ける・解放の連鎖',source.includes('newEnemy.shellBoss=layerPlan.boss;')&&source.includes("setting.id==='COCYTUS'?cocytusUnlocked:false")&&source.includes("'INFERNOクリアで解放'"));
check('勇者の証はCOCYTUSで6個',/speciesChallenge:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3, ETERNAL:4, INFERNO:5, COCYTUS:6 \}\)/.test(source));

const boss=(over)=>({hp:0,maxHp:1000,atk:200,layerAtkBase:100,layerAtkGain:0.2,shellBroken:5,shellLayerTotal:5,...over});
check('蘇り: 全回復・最大ライフ1.5倍、攻撃は層1枚ぶん(+20%)を足す・文と段を渡す',(()=>{const r=revive(boss(),'COCYTUS',9,0);
  return r&&r.maxHp===1500&&r.hp===1500&&r.atk===220&&r.revivalNumber===1&&r.remaining===0&&r.reveal.stage==='durahan'&&r.reveal.name==='凍土の再起';})());
check('ムーの2回目は掛け算で元の2.25倍・攻撃は+20%をもう1つ',(()=>{const a=revive(boss(),'COCYTUS',10,0);const b=revive(boss({maxHp:a.maxHp,atk:a.atk}),'COCYTUS',10,1);
  return a.maxHp===1500&&a.reveal.stage==='moo1'&&b.maxHp===2250&&b.hp===2250&&b.atk===240&&b.reveal.stage==='moo2'&&b.remaining===0&&revive(boss(),'COCYTUS',10,2)===null;})());
check('ETERNALまでの起き上がりは今までどおり(半分で起き上がり・攻撃+60%・最大ライフは変えない)',(()=>{const r=revive({maxHp:1000,atk:100},'ETERNAL',10,0);return r.hp===500&&r.atk===160&&r.maxHp===undefined&&r.reveal===undefined;})());
check('本体: 蘇りの最大ライフ・文・段を渡す',source.includes('...(revived.maxHp?{maxHp:revived.maxHp}:{})')&&source.includes('name:revived.reveal.name,desc:revived.reveal.desc,stage:revived.reveal.stage'));
process.exit(failed?1:0);
