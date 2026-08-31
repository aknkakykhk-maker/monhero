#!/usr/bin/env node
// GODの内部設定・神威・複合与ダメ・デバッグ限定公開を、本体helperを切り出して検査する。
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const slice=(from,to)=>{const a=source.indexOf(from),b=source.indexOf(to,a);if(a<0||b<=a)throw new Error(`section not found: ${from}`);return source.slice(a,b);};
const sandbox={DIFFICULTY_SETTINGS:{},RANGE_LABELS:['零','近','中','遠'],QUICK_GROWTH_MULT:1.1,isQuickMode:()=>false,isProMode:()=>false,PRO_RANKING_PREFIX:'Pro',EXTREME_MODE:{id:'extreme'},console};
vm.createContext(sandbox);
vm.runInContext([
  "const BATTLE_MODE_CHALLENGE='challenge',BATTLE_MODE_QUICK='quick',BATTLE_MODE_PRO='pro',BATTLE_MODE_SPECIES_CHALLENGE='speciesChallenge';",
  slice('const EXTREME_DIFFICULTIES = Object.freeze([','// ===== トレーニング'),
  slice('const TRAINING_PICK_COUNT','// 極限チャレンジの説明には'),
  slice('const EXTREME_RANKING_PREFIX','// ランキングの難易度キーから'),
  slice('const extremeBestScoreKey','const normalizeExtremeRecordValue'),
  slice('const isNightmareUnlocked','const normalizeBattleDifficulty'),
].join('\n'),sandbox);
const G=name=>vm.runInContext(name,sandbox);
const god=G('GOD_SETTING'),divinity=G('godDivinityRules'),damage=G('extremeDamageTurnMultiplier');
const combined=G('extremeSpecialDamageMultiplier'),applyGod=G('applyGodSpecialDamage');
const pending=G('pendingUltimateDistanceBreak'),draw=G('drawUltimateDistanceBreak');
const enemy=G('ultimateEnemyTurnMultiplier'),near=(a,b)=>Math.abs(a-b)<1e-9;

check('基本設定',god.id==='GOD'&&!god.available&&god.debugAvailable&&god.power===100&&god.score===20&&god.xp===60&&god.gold===40&&god.psyche===100&&god.waveCount===10&&god.unlockRequirement==='INFINITY');
check('将来用IDと動的キー',god.recordId==='GOD'&&god.rankingId==='ExtremeGOD'&&G('extremeBestScoreKey')('GOD')==='mh_extreme_hs_GOD'&&G('extremeClearCountKey')('GOD')==='mh_extreme_clears_GOD'&&G('rankingDifficultyForMode')('extreme','GOD')==='ExtremeGOD');
check('INFINITYクリアで将来解放',!G('isGodUnlocked')(0)&&G('isGodUnlocked')(1));
check('神威Lv',[[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4],[8,4],[9,5],[10,5]].every(([w,l])=>divinity(w).level===l));
const expected={1:[1.15,1.5,.5,.5,2,.0125,.25,1],2:[1.3,1.75,.5,.5,2,.0125,.25,1],3:[1.45,1.75,.35,.5,2,.0125,.25,1],4:[1.6,1.75,.35,.35,2.5,.0125,.25,1],5:[1.75,1.75,.35,.35,2.5,.015,.2,0]};
check('神威実効倍率',Object.entries(expected).every(([lv,want])=>{const r=divinity(Number(lv)*2-1);return [r.enemyMultiplier,r.gutsCost,r.distanceEnhancement,r.positiveModifier,r.negativeModifier,r.damageTurnRate,r.minimumDamageDealt,r.safeDistanceCount].every((v,i)=>near(v,want[i]));}));
check('与ダメW1-8',[[0,1],[20,.75],[40,.5],[60,.25],[80,.25]].every(([t,w])=>near(damage(t,'GOD',1),w)));
check('与ダメW9-10は累計Tを使用',[[0,1],[20,.7],[40,.4],[60,.2],[170,.2]].every(([t,w])=>near(damage(t,'GOD',9),w)));
check('BREAK 20T・最大8イベント',[20,40,60,80,100,120,140,160].every((t,i)=>pending(t,[i,0,0,0],1,'GOD')===t)&&pending(19,[0,0,0,0],1,'GOD')===null);
check('BREAK倍率は上限なし',[[1,.5],[2,.25],[3,.125],[4,.0625],[8,.00390625]].every(([lv,w])=>near(combined(0,0,[lv,0,0,0],'GOD',1,'atk'),w)));
check('安全距離1→神威Lv5で0',(()=>{const a=[0,0,0,0];for(let i=0;i<3;i++)a[draw(a,()=>0,1)]++;const before=a.filter(Boolean).length===3;const count=a.reduce((s,v)=>s+v,0);a[draw(a,()=>.99,0)]++;return before&&a.filter(Boolean).length===4&&a.reduce((s,v)=>s+v,0)===count+1;})());
check('W9突入だけではBREAK増加なし',pending(59,[1,1,0,0],8,'GOD')===null&&pending(59,[1,1,0,0],9,'GOD')===null);
check('複合与ダメは倍率合成後に1回だけfloor',near(combined(20,0,[1,0,0,0],'GOD',1,'atk'),.375)&&applyGod(101,20,0,[1,0,0,0],1,'atk')===37);
check('最低1ダメージ保証なし',applyGod(1,170,0,[8,0,0,0],9,'atk')===0&&!slice('const applyGodSpecialDamage','const ultimateAllyJoinMultiplier').includes('Math.max(1'));
check('170Tでも有限・非負', [1,9].every(w=>[20,40,60,80,100,120,140,160,170].every(t=>{const vals=[damage(t,'GOD',w),combined(t,0,[8,0,0,0],'GOD',w,'atk'),enemy(t,'GOD')*divinity(w).enemyMultiplier];return vals.every(v=>Number.isFinite(v)&&v>=0);}))); 
check('通常UIからGODを除外しデバッグだけ表示',source.includes('ALL_EXTREME_DIFFICULTIES.filter(setting=>setting.available||(debugBattle&&setting.debugAvailable))')&&source.includes('const previewable=(setting.available||(debugBattle&&setting.debugAvailable))&&unlocked'));
check('Quick GODなし',G('QUICK_EXTREME_SETTINGS').GOD===undefined);
check('デバッグ保存禁止経路を維持',source.includes('if (debugBattleRef.current) return;')&&source.includes('if (debugBattleRef.current) {')&&source.includes('debugBattleRef.current=true;debugMonsterPreviewRef.current=true'));
check('既存難易度値を維持',G('INFINITY_SETTING').power===50&&G('ULTIMATE_SETTING').specialRules.distanceBreak.interval===35&&G('CHAOS_SETTING').specialRules.damageDealt===.5);
if(failed){console.error(`\n${failed}件のGOD検査に失敗しました。`);process.exit(1);}console.log('\nGOD rules check passed.');
