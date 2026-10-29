#!/usr/bin/env node
// ETERNALの正式設定・殻(WAVEのはじめに最大ライフの50%)・貫き(冥府Lvで30〜50%)・HELHEIMから引き継ぐルールを、
// 本体helperを切り出して検査する。helheim-rules-check.js と同じ作り。
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

const e=G('ETERNAL_SETTING'),rules=G('eternalStageRules');
const shellRate=G('extremeEnemyShellRate'),shellAmount=G('extremeEnemyShellAmount'),pierceRate=G('extremeEnemyPierceRate');
const split=G('splitShellDamage'),afterHit=G('enemyAfterHit'),mark=G('markShellAbsorbedHits'),pierce=G('applyEnemyPierce');

check('基本設定',e.id==='ETERNAL'&&e.japanese==='エターナル'&&e.available&&e.debugAvailable&&e.power>=200&&e.power<=220
  &&e.score===20&&e.xp===120&&e.gold===100&&e.psyche===190&&e.unlockRequirement==='HELHEIM');
check('IDと動的キー',e.recordId==='ETERNAL'&&e.rankingId==='ExtremeETERNAL'
  &&G('extremeBestScoreKey')('ETERNAL')==='mh_extreme_hs_ETERNAL'&&G('extremeClearCountKey')('ETERNAL')==='mh_extreme_clears_ETERNAL'
  &&G('rankingDifficultyForMode')('extreme','ETERNAL')==='ExtremeETERNAL');
check('HELHEIMクリアで解放',!G('isEternalUnlocked')(0)&&G('isEternalUnlocked')(1)&&!G('isEternalUnlocked')(undefined));
check('難易度一覧の最後',G('ALL_EXTREME_DIFFICULTIES').map(x=>x.id).slice(-1)[0]==='ETERNAL');
check('種族チャレンジの初回クリア報酬は120',G('speciesChallengeFirstClearReward')('ETERNAL')===120);
check('種族チャレンジはHELHEIMを先にクリアするとETERNALが開く',(()=>{const f=G('isSpeciesChallengeDifficultyUnlocked');return !f('ETERNAL',['RAGNAROK'])&&f('ETERNAL',['HELHEIM']);})());
check('クイックにETERNALを入れない',G('QUICK_EXTREME_SETTINGS').ETERNAL===undefined);
check('HELHEIMのルール(冥府・不死・ライフ10倍・与ダメ低下)を引き継ぐ',
  [1,3,5,9,10].every(w=>{const a=rules(w),b=G('helheimUnderworldRules')(w);return a.level===b.level&&a.enemyMultiplier===b.enemyMultiplier&&a.allyMaxHpRate===b.allyMaxHpRate&&a.minimumDamageDealt===b.minimumDamageDealt;})
  &&G('extremeRevivalCount')('ETERNAL',10)===4&&G('extremeEnemyStatAdjust')('ETERNAL','Dino').lifeRate===10);
check('殻は最大ライフの50%、ほかの難易度は0',near(shellRate('ETERNAL',1),0.5)&&near(shellRate('ETERNAL',10),0.5)
  &&shellRate('HELHEIM',1)===0&&shellRate('GOD',1)===0&&shellRate('Normal',1)===0&&shellAmount(1001,'ETERNAL',3)===500&&shellAmount(1000,'HELHEIM',3)===0);
check('貫きは冥府Lvで30%から5%ずつ上がり50%まで',[[1,.30],[3,.35],[5,.40],[7,.45],[9,.50],[10,.50]].every(([w,r])=>near(pierceRate('ETERNAL',w),r))
  &&pierceRate('HELHEIM',9)===0);
check('貫きは丈夫さで減らした値と素の値を率で混ぜる',near(pierce(100,1000,0.5),550)&&pierce(100,1000,0)===100&&pierce(500,100,0.5)===500);
check('殻が先に削れて残りがライフへ通る',(()=>{const s=split(300,500);return s.absorbed===300&&s.through===200&&s.shellLeft===0;})()
  &&(()=>{const x=afterHit({hp:1000,shell:300},500);return x.hp===800&&x.shell===0;})()
  &&(()=>{const x=afterHit({hp:1000,shell:300},100);return x.hp===1000&&x.shell===200;})());
check('殻の無い敵はこれまでどおり',(()=>{const x=afterHit({hp:100},150);return x.hp===0&&x.shell===undefined;})()&&afterHit(null,5)===null);
check('1ターンのヒットへ殻が受けたぶんを書き込む',(()=>{const hits=[{dmg:200},{dmg:200},{dmg:200}];const t=mark(hits,300);return t===300&&hits[0].shellAbsorbed===200&&hits[1].shellAbsorbed===100&&hits[2].shellAbsorbed===0;})()
  &&mark([{dmg:50}],undefined)===0);
check('本体: WAVEのはじめに殻をまとい、ヒットは殻から削る',source.includes('extremeEnemyShellAmount(newEnemy.maxHp,specialRuleDifficulty,w)')
  &&!source.includes('hp:Math.max(0,prev.hp-h.dmg)')&&!source.includes('hp:Math.max(0,prev.hp-hit.dmg)')&&!source.includes('hp: Math.max(0, prev.hp - h.dmg)'));
check('本体: 殻が受けたぶんは距離強化に入れない',source.includes('turnDistDmg[si]+=h.dmg-(h.shellAbsorbed||0)')&&source.includes('attackDistDamage[si]+=h.dmg-(h.shellAbsorbed||0)')
  &&source.includes('(enemy?.hp??0)-(totalDmg-shellAbsorbedTotal)'));
check('本体: 被ダメに貫きを通す',source.includes('applyEnemyPierce(Math.max(30,(atkVal-defVal*0.5)*(1-defenseRate)),atkVal,enemyPierceRate)'));
check('本体: 通常UIへ公開しHELHEIMクリアで解放',source.includes("setting.id==='ETERNAL'?eternalUnlocked:false")&&source.includes("'HELHEIMクリアで解放'"));
check('勇者の証はETERNALで4個',/speciesChallenge:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3, ETERNAL:4 \}\)/.test(source));
process.exit(failed?1:0);
