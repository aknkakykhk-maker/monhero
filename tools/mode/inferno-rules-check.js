#!/usr/bin/env node
// INFERNO(極限10番目)の正式設定・ボスの層のシールド(枚数・量・割れたときの持ち越しと攻撃の上がり方)・連撃の回数・
// 見た目が読む enemyShellView を、本体helperを切り出して検査する。eternal-rules-check.js と同じ作り。
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

const I=G('INFERNO_SETTING'),rules=G('infernoStageRules'),plan=G('extremeShieldLayerPlan'),afterHit=G('enemyAfterHit');
const pool=G('enemyShellPool'),rush=G('extremeLayerRushHits'),view=G('enemyShellView'),mark=G('markShellAbsorbedHits');

check('基本設定',I.id==='INFERNO'&&I.japanese==='インフェルノ'&&I.available&&I.debugAvailable&&I.power===400
  &&I.score===20&&I.xp===140&&I.gold===120&&I.psyche===220&&I.unlockRequirement==='ETERNAL');
check('IDと動的キー',I.recordId==='INFERNO'&&I.rankingId==='ExtremeINFERNO'
  &&G('extremeBestScoreKey')('INFERNO')==='mh_extreme_hs_INFERNO'&&G('extremeClearCountKey')('INFERNO')==='mh_extreme_clears_INFERNO'
  &&G('rankingDifficultyForMode')('extreme','INFERNO')==='ExtremeINFERNO');
check('ETERNALクリアで解放',!G('isInfernoUnlocked')(0)&&G('isInfernoUnlocked')(1)&&!G('isInfernoUnlocked')(undefined));
check('難易度一覧の最後',G('ALL_EXTREME_DIFFICULTIES').map(x=>x.id).slice(-1)[0]==='INFERNO');
check('種族チャレンジの初回クリア報酬は140・ETERNALのあとに開く',G('speciesChallengeFirstClearReward')('INFERNO')===140
  &&(()=>{const f=G('isSpeciesChallengeDifficultyUnlocked');return !f('INFERNO',['HELHEIM'])&&f('INFERNO',['ETERNAL']);})());
check('クイックにINFERNOを入れない',G('QUICK_EXTREME_SETTINGS').INFERNO===undefined);
check('ボスは起き上がらない',[3,5,7,9,10].every(w=>G('extremeRevivalCount')('INFERNO',w)===0)&&G('extremeRevivalCount')('ETERNAL',10)===4);
check('ETERNALのルール(冥府・ふつうのシールド・貫き・ライフ10倍)を引き継ぐ',
  [1,3,9,10].every(w=>{const a=rules(w),b=G('eternalStageRules')(w);return a.level===b.level&&a.enemyMultiplier===b.enemyMultiplier&&a.shellRate===b.shellRate&&a.pierceRate===b.pierceRate&&a.minimumDamageDealt===b.minimumDamageDealt;})
  &&G('extremeEnemyStatAdjust')('INFERNO','Dino').lifeRate===10&&near(G('extremeEnemyStatAdjust')('INFERNO','Durahan').lifeRate,13));
check('層の数はW3/5/7 3枚・W9 4枚・W10 5枚、ふつうのWAVEは0',[[3,3],[5,3],[7,3],[9,4],[10,5],[1,0],[2,0],[4,0],[6,0],[8,0]].every(([w,n])=>rules(w).shieldLayers===n));
check('1枚目=ETERNAL(強度300)のライフ、割れるたびに+30%、本体にもその倍率',(()=>{const p=plan('INFERNO',10,4000,400);
  return p&&p.layers.join()==='3000,3900,4800,5700,6600'&&near(p.bodyRate,2.5)&&near(p.atkGain,0.6);})()
  &&(()=>{const p=plan('INFERNO',3,4000,400);return p.layers.join()==='3000,3900,4800'&&near(p.bodyRate,1.9);})()
  &&plan('INFERNO',2,4000,400)===null&&plan('ETERNAL',10,4000,300)===null);
const boss=()=>({hp:1000,maxHp:1000,atk:100,shell:300,maxShell:300,shellLayers:[390,480],shellLayerMaxes:[300,390,480],shellLayerTotal:3,shellBroken:0,shellBreakSeq:0,layerAtkBase:100,layerAtkGain:0.6});
check('いまの1枚から削れ、割れた余りは次の1枚へ持ち越す',(()=>{const x=afterHit(boss(),500);return x.shell===190&&x.maxShell===390&&x.shellLayers.join()==='480'&&x.shellBroken===1&&x.shellBreakSeq===1&&x.hp===1000;})());
check('1枚割れるたびに攻撃+60%(元の攻撃力から数える)',(()=>{const x=afterHit(boss(),500);const y=afterHit(x,190+480);return x.atk===160&&y.atk===280&&y.shellBroken===3&&y.shellBreakSeq===3;})());
check('全部割れたら余りがライフへ通る',(()=>{const x=afterHit(boss(),300+390+480+100);return x.shell===0&&x.shellLayers.length===0&&x.shellBroken===3&&x.hp===900&&x.atk===280;})());
check('割れないヒットでは攻撃も合図も変わらない',(()=>{const x=afterHit(boss(),100);return x.shell===200&&x.shellBroken===0&&x.atk===100&&x.shellBreakSeq===0;})());
check('層の無い敵・ETERNALのシールドはこれまでどおり',(()=>{const a=afterHit({hp:100},150);const b=afterHit({hp:1000,shell:300},500);return a.hp===0&&b.hp===800&&b.shell===0&&b.shellBroken===undefined;})());
check('シールドの量の合計(いまの1枚+まだの層)',pool(boss())===1170&&pool({shell:50})===50&&pool(null)===0);
check('ヒットの見積もりは層の合計に当てる',(()=>{const hits=[{dmg:1000},{dmg:500}];const t=mark(hits,pool(boss()));return t===1170&&hits[0].shellAbsorbed===1000&&hits[1].shellAbsorbed===170;})());
check('連撃はデュラハン4枚目で2・ムー4枚目で2・5枚目で3、ほかは1',rush('INFERNO',9,3)===1&&rush('INFERNO',9,4)===2&&rush('INFERNO',10,3)===1&&rush('INFERNO',10,4)===2&&rush('INFERNO',10,5)===3
  &&rush('INFERNO',3,3)===1&&rush('INFERNO',7,3)===1&&rush('ETERNAL',10,5)===1);
check('見た目が読む状態',(()=>{const v=view(afterHit(boss(),500));return v.total===3&&v.broken===1&&v.left===2&&v.current===190&&v.currentMax===390&&v.breakSeq===1
  &&v.layers.map(l=>l.now).join()==='0,190,480'&&v.layers.map(l=>l.max).join()==='300,390,480';})()&&view({hp:10,shell:5,maxShell:9}).total===0&&view(null).total===0);
check('本体: ボスのWAVEは層を作る・ヒットの見積もりは層の合計',source.includes('extremeShieldLayerPlan(specialRuleDifficulty,w,newEnemy.maxHp,')
  &&source.includes('markShellAbsorbedHits(attackHits,enemyShellPool(enemy))')&&source.includes('markShellAbsorbedHits(ca.hits, enemyShellPool(enemy))'));
check('本体: 本編の必殺技の連撃はタクティクスの連撃と同じ受け方',source.includes('resolveTacticsGuardedHit(incomingBeforeTurnReduction,rushHits,guardValue,guardCards>=TACTICS_RUSH_GUARD_CARDS?rushHits:1)'));
check('本体: 通常UIへ公開しETERNALクリアで解放',source.includes("setting.id==='INFERNO'?infernoUnlocked:false")&&source.includes("'ETERNALクリアで解放'"));
check('勇者の証はINFERNOで5個',/speciesChallenge:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3, ETERNAL:4, INFERNO:5 \}\)/.test(source));
process.exit(failed?1:0);
