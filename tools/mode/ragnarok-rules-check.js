#!/usr/bin/env node
// RAGNAROKの正式設定・黄昏・不死(死者の再起)・通常/デバッグ導線を、本体helperを切り出して検査する。
// god-rules-check.js と同じ作りで、段階ルールを難易度ごとに二重管理していないことも見る。
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
  "const BATTLE_MODE_CHALLENGE='challenge',BATTLE_MODE_QUICK='quick',BATTLE_MODE_PRO='pro',BATTLE_MODE_SPECIES_CHALLENGE='speciesChallenge';",
  slice('const EXTREME_DIFFICULTIES = Object.freeze([','// ===== トレーニング'),
  slice('const TRAINING_PICK_COUNT','// 極限チャレンジの説明には'),
  slice('const EXTREME_RANKING_PREFIX','// ランキングの難易度キーから'),
  slice('const extremeBestScoreKey','const normalizeExtremeRecordValue'),
  slice('const isNightmareUnlocked','const normalizeBattleDifficulty'),
].join('\n'),sandbox);
const G=name=>vm.runInContext(name,sandbox);
const ragnarok=G('RAGNAROK_SETTING'),twilight=G('ragnarokTwilightRules'),damage=G('extremeDamageTurnMultiplier');
const combined=G('extremeSpecialDamageMultiplier'),applyStaged=G('applyExtremeStagedDamage');
const pending=G('pendingUltimateDistanceBreak'),draw=G('drawUltimateDistanceBreak');
const enemyTurn=G('ultimateEnemyTurnMultiplier'),waveEnemy=G('extremeWaveEnemyMultiplier');
const revivalCount=G('extremeRevivalCount'),revive=G('extremeRevivedEnemyStats');
const near=(a,b)=>Math.abs(a-b)<1e-9;

check('基本設定',ragnarok.id==='RAGNAROK'&&ragnarok.available&&ragnarok.debugAvailable&&ragnarok.power===200&&ragnarok.score===20
  &&ragnarok.xp===80&&ragnarok.gold===60&&ragnarok.psyche===130&&ragnarok.waveCount===10&&ragnarok.unlockRequirement==='GOD');
check('IDと動的キー',ragnarok.recordId==='RAGNAROK'&&ragnarok.rankingId==='ExtremeRAGNAROK'
  &&G('extremeBestScoreKey')('RAGNAROK')==='mh_extreme_hs_RAGNAROK'&&G('extremeClearCountKey')('RAGNAROK')==='mh_extreme_clears_RAGNAROK'
  &&G('rankingDifficultyForMode')('extreme','RAGNAROK')==='ExtremeRAGNAROK');
check('GODクリアで解放',!G('isRagnarokUnlocked')(0)&&G('isRagnarokUnlocked')(1));
// 通常難易度は切り出し先に無い(sandboxのDIFFICULTY_SETTINGSは空)ので、極限ぶんだけを見る
check('ランキングキーへ追加され既存キーを崩さない',(()=>{const keys=G('RANKING_DIFFICULTY_KEYS');
  return keys.includes('ExtremeRAGNAROK')&&keys.includes('ExtremeGOD')&&keys.includes('ExtremeEXTREME')
    &&new Set(keys).size===keys.length;})());

// 黄昏。刻み方はGODの神威と同じ2WAVEごと、中身だけが一段きつい
check('黄昏Lv',[[1,1],[2,1],[3,2],[4,2],[5,3],[6,3],[7,4],[8,4],[9,5],[10,5]].every(([w,l])=>twilight(w).level===l));
const expected={1:[1.2,1.75,.35,.35,2.5,.015,.20,0],2:[1.4,1.75,.25,.35,2.5,.015,.20,0],3:[1.6,2.0,.25,.35,2.5,.015,.20,0],4:[1.8,2.0,.25,.25,3.0,.015,.20,0],5:[2.0,2.0,.25,.25,3.0,.0175,.15,0]};
check('黄昏の実効倍率',Object.entries(expected).every(([lv,want])=>{const r=twilight(Number(lv)*2-1);
  return [r.enemyMultiplier,r.gutsCost,r.distanceEnhancement,r.positiveModifier,r.negativeModifier,r.damageTurnRate,r.minimumDamageDealt,r.safeDistanceCount]
    .every((v,i)=>near(v,want[i]));}));
check('敵倍率は段階ぶんだけ上乗せする',near(waveEnemy('RAGNAROK',1),1.2)&&near(waveEnemy('RAGNAROK',9),2.0)
  &&near(waveEnemy('GOD',1),1.15)&&waveEnemy('INFINITY',9)===1&&waveEnemy(null,3)===1);
check('与ダメW1-8',[[0,1],[20,.7],[40,.4],[53,.205],[60,.2]].every(([t,w])=>near(damage(t,'RAGNAROK',1),w)));
check('与ダメW9-10は下限15%まで下がる',[[0,1],[20,.65],[40,.3],[60,.15],[200,.15]].every(([t,w])=>near(damage(t,'RAGNAROK',9),w)));
check('段階を持たない難易度は既存の与ダメ計算のまま',near(damage(20,'INFINITY',9),.8)&&near(damage(20,'ULTIMATE',9),.85)&&damage(20,null,1)===1);

// DISTANCE BREAK。15Tごと・安全距離なし
check('BREAK 15Tごと',[15,30,45,60,75,90].every((t,i)=>pending(t,[i,0,0,0],1,'RAGNAROK')===t)&&pending(14,[0,0,0,0],1,'RAGNAROK')===null);
check('安全距離なしで4距離すべて弱体化する',(()=>{const a=[0,0,0,0];for(let i=0;i<4;i++){const picked=draw(a,()=>0,0);if(picked==null)return false;a[picked]++;}
  return a.filter(Boolean).length===4;})());
check('BREAK込みの与ダメは合成後に1回だけfloor',near(combined(20,0,[1,0,0,0],'RAGNAROK',1,'atk'),.35)
  &&applyStaged(101,20,0,[1,0,0,0],'RAGNAROK',1,'atk')===35);
check('BREAKは味方の攻撃カードにだけ掛かる',near(combined(0,0,[2,0,0,0],'RAGNAROK',1,'atk'),.25)&&near(combined(0,0,[2,0,0,0],'RAGNAROK',1,'heal'),1));

// 不死(死者の再起)
check('不死はW5とW10だけ',revivalCount('RAGNAROK',5)===1&&revivalCount('RAGNAROK',10)===2
  &&revivalCount('RAGNAROK',1)===0&&revivalCount('RAGNAROK',9)===0);
check('不死を持たない難易度では起き上がらない',revivalCount('GOD',10)===0&&revivalCount('INFINITY',5)===0
  &&revive({maxHp:1000,atk:100},'GOD',10,0)===null&&revive({maxHp:1000,atk:100},null,10,0)===null);
check('ライフ半分・攻撃+50%で起き上がる',(()=>{const r=revive({maxHp:1000,atk:100},'RAGNAROK',10,0);
  return r&&r.hp===500&&r.atk===150&&r.revivalNumber===1&&r.remaining===1;})());
check('2回目の再起は残り0になる',(()=>{const r=revive({maxHp:1000,atk:150},'RAGNAROK',10,1);
  return r&&r.hp===500&&r.atk===225&&r.revivalNumber===2&&r.remaining===0;})());
check('回数を使い切ったら起き上がらない',revive({maxHp:1000,atk:100},'RAGNAROK',10,2)===null
  &&revive({maxHp:1000,atk:100},'RAGNAROK',5,1)===null);
check('壊れた敵データでも落ちない',(()=>{const r=revive({maxHp:'x',atk:null},'RAGNAROK',5,0);
  return r&&r.hp===1&&r.atk===0&&revive(null,'RAGNAROK',5,0)===null;})());

// ルール詳細(案内・ヘルプ・ルール詳細で同じ本文を使う正本)
const groups=G('extremeRuleDetailGroups')('RAGNAROK');
const groupTitles=groups.map(g=>g.title);
check('ルール詳細に黄昏と不死が並ぶ',groupTitles.includes('黄昏')&&groupTitles.includes('不死（死者の再起）')&&groupTitles.includes('DISTANCE BREAK'),groupTitles.join(' / '));
check('安全距離なしをそのまま書く',JSON.stringify(groups.find(g=>g.title==='DISTANCE BREAK')?.lines||[]).includes('なし（4距離すべて弱体化する）'));
check('不死の対象WAVEと回数を実データから書く',JSON.stringify(groups.find(g=>g.title==='不死（死者の再起）')?.lines||[]).includes('WAVE5（1回） / WAVE10（2回）'));
check('複合特殊ルールありと出す',G('extremeRuleSummaryText')('RAGNAROK')==='複合特殊ルールあり');

// 本体側の接続。難易度名ではなく「段階/不死を持っているか」で分岐していること
check('敵生成は段階倍率を掛けて1つの経路で作る',source.includes('const stagedEnemyMultiplier=extremeWaveEnemyMultiplier(specialRuleDifficulty,w);')
  &&source.includes('createBattleEnemy(w,difficulty,forcedEnemyKey,battleSetting?.power??null,enemyTurnMultiplier*stagedEnemyMultiplier)'));
check('消費ガッツ・与ダメ・適性は段階の有無で分岐する',source.includes("if(extremeWaveStage(specialRuleDifficulty))return Math.floor(cost*effectiveExtremeSpecialRule(specialRuleDifficulty,'gutsCost',wave));")
  &&source.includes('distanceBrokenDmg=applyExtremeStagedDamage(finalDmg,elapsedTotalTurns,slotIdx,ultimateDistanceBreakLevels,specialRuleDifficulty,wave,card.type);')
  &&source.includes('if(extremeWaveStage(specialRuleDifficulty)){const effectiveApt=getMonsterAptPct(m,specialRuleDifficulty,wave);'));
check('撃破処理の前に不死を判定し撃破ロックを立てない',(()=>{const at=source.indexOf('const revived=extremeRevivedEnemyStats(enemy,revivalDifficulty,wave,enemyRevivalUsedRef.current);');
  const lock=source.indexOf('enemyDefeatResolvedRef.current = true;',at);
  return at>0&&lock>at&&source.slice(at,lock).includes('return false;');})());
check('起き上がったライフを敵の行動へ渡す',source.includes('let enemyHpAfterOurAttacks=Math.max(0,(enemy?.hp??0)-totalDmg);')
  &&source.includes('if (enemyRevivedHpRef.current!=null) enemyHpAfterOurAttacks=enemyRevivedHpRef.current;'));
check('WAVEごとに不死の回数を数え直す',source.includes('enemyRevivalUsedRef.current=0; setEnemyRevivalUsed(0); enemyRevivedHpRef.current=null; setEnemyRevivalReveal(null);'));
check('再起の演出中はAUTOを動かさない',source.includes('!!ultimateDistanceBreakReveal||!!enemyRevivalReveal||!!extremeRuleOpen||!!effect;'));
check('通常UIへ公開しGODクリアで解放',source.includes("setting.id==='RAGNAROK'?ragnarokUnlocked:false")&&source.includes("'GODクリアで解放'")
  &&source.includes('const ragnarokUnlocked = useMemo(() => isRagnarokUnlocked(godClearCount), [godClearCount]);'));
check('バトル中の帯に黄昏Lvと不死の残りを出す',source.includes('const stageLabel=extremeWaveStageLabel(statusRule);')
  &&source.includes('const revivalTotal=extremeRevivalCount(statusRule,wave);')
  &&source.includes('不死 残り{Math.max(0,revivalTotal-enemyRevivalUsed)}回'));
check('クイックにRAGNAROKを入れない',G('QUICK_EXTREME_SETTINGS').RAGNAROK===undefined);
check('既存難易度の値を動かしていない',G('GOD_SETTING').power===100&&G('INFINITY_SETTING').power===50
  &&G('ULTIMATE_SETTING').specialRules.distanceBreak.interval===35&&G('CHAOS_SETTING').specialRules.damageDealt===.5
  &&near(G('godDivinityRules')(9).minimumDamageDealt,.20)&&G('godDivinityRules')(9).safeDistanceCount===0);
check('ヘルプの難易度表は実データから作る',/\{\s*t:'data',\s*id:'extremeDifficulties'\s*\}/.test(help)||help.includes("t:'data'"));
check('ヘルプにRAGNAROKの案内がある',help.includes('RAGNAROK'));
check('更新履歴にRAGNAROK追加が載っている',changelog.includes('RAGNAROK'));

if(failed){console.error(`\n${failed}件のRAGNAROK検査に失敗しました。`);process.exit(1);}
console.log('\nRAGNAROK rules check passed.');
