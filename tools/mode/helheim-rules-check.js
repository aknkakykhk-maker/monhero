#!/usr/bin/env node
// HELHEIMの正式設定・冥府・不死(W3/5/7/9/10)・敵のライフ10倍とデュラハン・距離強化の毎WAVE減衰・
// 味方の最大ライフ削りを、本体helperを切り出して検査する。ragnarok-rules-check.js と同じ作り。
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
  + "const isTacticsMode=()=>false,isSpeciesChallengeMode=(m)=>m===BATTLE_MODE_SPECIES_CHALLENGE;",
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

check('基本設定',h.id==='HELHEIM'&&h.available&&h.debugAvailable&&h.power===300&&h.score===20&&h.xp===100&&h.gold===80&&h.psyche===160
  &&h.waveCount===10&&h.unlockRequirement==='RAGNAROK');
check('IDと動的キー',h.recordId==='HELHEIM'&&h.rankingId==='ExtremeHELHEIM'
  &&G('extremeBestScoreKey')('HELHEIM')==='mh_extreme_hs_HELHEIM'&&G('extremeClearCountKey')('HELHEIM')==='mh_extreme_clears_HELHEIM'
  &&G('rankingDifficultyForMode')('extreme','HELHEIM')==='ExtremeHELHEIM');
check('RAGNAROKクリアで解放',!G('isHelheimUnlocked')(0)&&G('isHelheimUnlocked')(1)&&!G('isHelheimUnlocked')(undefined));
check('ランキングキーへ追加され既存キーを崩さない',(()=>{const keys=G('RANKING_DIFFICULTY_KEYS');
  return keys.includes('ExtremeHELHEIM')&&keys.includes('ExtremeRAGNAROK')&&keys.includes('ExtremeGOD')&&new Set(keys).size===keys.length;})());
check('難易度一覧の末尾に並ぶ',G('ALL_EXTREME_DIFFICULTIES').map(x=>x.id).slice(-3).join()==='GOD,RAGNAROK,HELHEIM');

// 冥府
check('冥府Lv',[[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4],[8,4],[9,5],[10,5]].every(([w,l])=>under(w).level===l));
const expected={1:[1.3,2.0,.30,3.0,.0175,.15,0,.95],2:[1.6,2.0,.30,3.0,.0175,.15,0,.90],3:[1.9,2.25,.30,3.0,.0175,.15,0,.85],
  4:[2.2,2.25,.20,3.5,.0175,.15,0,.80],5:[2.5,2.25,.20,3.5,.02,.10,0,.75]};
check('冥府の実効倍率',Object.entries(expected).every(([lv,want])=>{const r=under(Number(lv)*2-1);
  return [r.enemyMultiplier,r.gutsCost,r.positiveModifier,r.negativeModifier,r.damageTurnRate,r.minimumDamageDealt,r.safeDistanceCount,r.allyMaxHpRate]
    .every((v,i)=>near(v,want[i]));}));
check('敵倍率は段階ぶんだけ上乗せする',near(waveEnemy('HELHEIM',1),1.3)&&near(waveEnemy('HELHEIM',9),2.5)&&near(waveEnemy('RAGNAROK',9),2.0)&&waveEnemy('INFINITY',9)===1);

// 距離強化はWAVEごとに薄れる(W1=0.10 → W10=0.01、毎WAVE0.01ずつ)
check('距離強化はW1=0.10・W10=0.01で毎WAVE0.01ずつ下がる',[1,2,3,4,5,6,7,8,9,10].every(w=>near(under(w).distanceEnhancement,0.10-(w-1)*0.01)),
  [1,2,3,4,5,6,7,8,9,10].map(w=>under(w).distanceEnhancement).join(','));
check('距離強化は一度も上がらない',[2,3,4,5,6,7,8,9,10].every(w=>under(w).distanceEnhancement<under(w-1).distanceEnhancement));
check('距離強化の効きは段階の値を通る',near(G('applyDistanceEnhancement')(1,'HELHEIM',1),0.10)&&near(G('applyDistanceEnhancement')(1,'HELHEIM',10),0.01)
  &&near(G('applyDistanceEnhancement')(1,'RAGNAROK',10),0.25)&&near(G('applyDistanceEnhancement')(1,'GOD',1),0.5));
check('WAVE範囲外でも壊れない',near(under(0).distanceEnhancement,0.10)&&near(under(99).distanceEnhancement,0.01)&&near(under(undefined).distanceEnhancement,0.10));

// 味方の最大ライフ削り
check('最大ライフは冥府Lvごとに5%ずつ削れる',[[1,.95],[3,.90],[5,.85],[7,.80],[9,.75]].every(([w,r])=>near(allyRate('HELHEIM',w),r)));
check('段階を持たない難易度・通常では削らない',allyRate('RAGNAROK',9)===1&&allyRate('GOD',9)===1&&allyRate(null,5)===1&&allyRate('INFINITY',9)===1);
check('削った最大ライフは整数で1以上',applyRate(1000,.75)===750&&applyRate(1,.75)===1&&applyRate(0,1)===0&&applyRate(777,1)===777);

// 敵のライフ10倍・デュラハン
check('すべての敵のライフが10倍、攻撃力は変えない',adjust('HELHEIM','Dino').lifeRate===10&&adjust('HELHEIM','Dino').atkRate===1&&adjust('HELHEIM','Moo').lifeRate===10);
check('デュラハンはライフ・攻撃力が さらに1.3倍',near(adjust('HELHEIM','Durahan').lifeRate,13)&&near(adjust('HELHEIM','Durahan').atkRate,1.3));
check('ほかの難易度・難易度なしは何も変えない',['RAGNAROK','GOD','INFINITY',null].every(d=>{const a=adjust(d,'Durahan');return a.lifeRate===1&&a.atkRate===1;})
  &&adjust('HELHEIM',null).lifeRate===10);

// 不死
check('不死はW3/5/7/9/10だけ',[[3,1],[5,2],[7,2],[9,1],[10,4],[1,0],[2,0],[4,0],[6,0],[8,0]].every(([w,c])=>revivalCount('HELHEIM',w)===c));
check('起き上がりはライフ半分・攻撃+60%',(()=>{const r=revive({maxHp:1000,atk:100},'HELHEIM',10,0);return r&&r.hp===500&&r.atk===160&&r.revivalNumber===1&&r.remaining===3;})());
check('W10は4回目まで起き上がり5回目は起き上がらない',revive({maxHp:1000,atk:100},'HELHEIM',10,3)?.remaining===0&&revive({maxHp:1000,atk:100},'HELHEIM',10,4)===null);
check('W9のデュラハンは1回だけ起き上がる',revive({maxHp:1000,atk:100},'HELHEIM',9,0)?.remaining===0&&revive({maxHp:1000,atk:100},'HELHEIM',9,1)===null);
check('RAGNAROKの不死は変わらない',revivalCount('RAGNAROK',5)===1&&revivalCount('RAGNAROK',10)===2&&revivalCount('RAGNAROK',3)===0&&revivalCount('RAGNAROK',9)===0);

// DISTANCE BREAK・与ダメ
check('BREAK 12Tごと・安全距離なし',[12,24,36].every((t,i)=>G('pendingUltimateDistanceBreak')(t,[i,0,0,0],1,'HELHEIM')===t)
  &&G('pendingUltimateDistanceBreak')(11,[0,0,0,0],1,'HELHEIM')===null&&G('effectiveExtremeDistanceBreakRule')('HELHEIM',1).safeDistanceCount===0);
check('与ダメW1-8は1Tごと-1.75ptで下限15%',[[0,1],[20,.65],[40,.30],[48,.16],[49,.15],[200,.15]].every(([t,w])=>near(damage(t,'HELHEIM',1),w)));
check('与ダメW9-10は1Tごと-2.0ptで下限10%',[[0,1],[20,.60],[40,.20],[45,.10],[200,.10]].every(([t,w])=>near(damage(t,'HELHEIM',9),w)));

// ルール詳細・解放文言
const groups=G('extremeRuleDetailGroups')('HELHEIM');
const titles=groups.map(g=>g.title);
check('ルール詳細に冥府・敵の強さ・距離強化・不死が並ぶ',['冥府','敵の強さ','距離強化','不死（死者の再起）','DISTANCE BREAK'].every(t=>titles.includes(t)),titles.join(' / '));
check('不死の対象WAVEと回数を実データから書く',JSON.stringify(groups.find(g=>g.title==='不死（死者の再起）')?.lines||[]).includes('WAVE3（1回） / WAVE5（2回） / WAVE7（2回） / WAVE9（1回） / WAVE10（4回）'));
check('複合特殊ルールありと出す',G('extremeRuleSummaryText')('HELHEIM')==='複合特殊ルールあり');

// 本体側の接続
check('敵生成のあとで上乗せを1か所で掛ける',source.includes('const enemyAdjust=extremeEnemyStatAdjust(specialRuleDifficulty,newEnemy.id);')
  &&source.includes('newEnemy.maxHp=Math.floor(newEnemy.maxHp*enemyAdjust.lifeRate);')
  &&(source.match(/createBattleEnemy\(w,difficulty,forcedEnemyKey/g)||[]).length===1);
check('実効最大ライフへ冥府の率を掛ける(表示用・ターン中の両方)',source.includes('const allyMaxHpRate = extremeAllyMaxHpRate(specialRuleDifficultyForRun(runMode,difficulty,extremeRun,extremeDifficulty), wave);')
  &&source.includes("applyAllyMaxHpRate(resolveEffectiveMaxStat(maxHp, getPermaBuff('muaHpPct')), allyMaxHpRate)")
  &&source.includes("applyAllyMaxHpRate(resolveEffectiveMaxStat(maxHpRef.current, livePermaBuff('muaHpPct')), allyMaxHpRateRef.current)"));
check('通常UIへ公開しRAGNAROKクリアで解放',source.includes("setting.id==='HELHEIM'?helheimUnlocked:false")&&source.includes("'RAGNAROKクリアで解放'")
  &&source.includes('const helheimUnlocked = useMemo(() => isHelheimUnlocked(ragnarokClearCount), [ragnarokClearCount]);'));
check('クイックにHELHEIMを入れない',G('QUICK_EXTREME_SETTINGS').HELHEIM===undefined);
check('既存難易度の値を動かしていない',G('RAGNAROK_SETTING').power===200&&G('GOD_SETTING').power===100
  &&near(G('ragnarokTwilightRules')(9).enemyMultiplier,2.0)&&G('ragnarokTwilightRules')(1).distanceEnhancement===0.35);
check('勇者の証はHELHEIMで3個',/extreme:Object\.freeze\(\{ GOD:1, RAGNAROK:2, HELHEIM:3 \}\)/.test(source));
check('ヘルプにHELHEIMの案内がある',help.includes('HELHEIM専用ルール「冥府」')&&help.includes('HELHEIMの記録と報酬'));
check('更新履歴にHELHEIM追加が載っている',changelog.includes("update_notice_helheim_v1"));
process.exit(failed?1:0);
