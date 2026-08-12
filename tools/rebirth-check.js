// Lv上限移行・限界突破・転生・表示・保存経路を本番ソースから検証する。
//
// 2026年8月に仕組みを2つに分けた。
//   限界突破(旧「転生」) … 上限に届いたら、レベルはそのままで上限だけ+5。強化ポイントは初回5・以降1。
//   転生(新)            … 絆Lv100以上で使える。レベルを99ぶん返す代わりに強化を全部振り直す(+10P)。
// どちらも保存データ(mh_masu_mons)を書き換えるため、「レベルが勝手に戻る」
// 「もらえるポイントが消える」といった取り返しのつかない壊れ方をしうる。
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
// 本体を丸ごと動かしてから関数を取り出す(データ定義より後ろにある関数も使えるようにするため)
const {totalBondXpForLevel,bondLevelInfo,masuBondLevelInfo,migrateMasuLevelCaps,buildMasuBreakthrough,buildMasuReincarnation,reconcileMasuPoints,totalBreakthroughPoints,totalReincarnatePoints,cappedBondXp,uniqueSkillAtLevel,MAX_MASU_LEVEL_CAP,REINCARNATE_MIN_LEVEL,REINCARNATE_LEVEL_DROP,REINCARNATE_POINTS,BREAKTHROUGH_FIRST_POINTS,BREAKTHROUGH_POINTS,BREAKTHROUGH_LEVEL_CAP_GAIN}=require('./harness').loadDyeModule();
let failed=0; const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- Lv30上限の移行(以前の補償。二重に走らないこと) ---
const capXp=totalBondXpForLevel(30), excess=777;
const old={id:'old',baseId:'Mocchi',name:'旧',bondXp:capXp+excess,distAptPoints:50};
const migrated=migrateMasuLevelCaps([old],100);
check('Lv30超過XPを同数のダイヤへ補償',migrated.compensation===excess&&migrated.nextGold===100+excess&&migrated.nextMasuMons[0].bondXp===capXp&&bondLevelInfo(capXp).level===30);
const second=migrateMasuLevelCaps(migrated.nextMasuMons,migrated.nextGold);
check('移行済みデータは二重補償されない',second.compensation===0&&second.nextGold===migrated.nextGold);

// --- 限界突破: レベル・強化はそのまま、上限とポイントだけ増える ---
const ready={...migrated.nextMasuMons[0],rebirthCount:0,levelCap:30,distAptPoints:9,distApt:['S','A','B','C'],statPoints:{hp:30,atk:9,def:6,guts:3},colors:['red'],inheritedUniques:[{monId:'Suezo',name:'熱視線'}],fusionHistory:[{subName:'副'}],uniqueSkillLevels:{own:0,'inh:0':2}};
const bt=buildMasuBreakthrough({masu:ready,skillKey:'own',gold:4000,psycheOwned:999999});
check('限界突破はレベル・絆経験値・強化を戻さない',
  bt.ok&&bt.nextMasu.bondXp===ready.bondXp&&JSON.stringify(bt.nextMasu.distApt)===JSON.stringify(ready.distApt)&&JSON.stringify(bt.nextMasu.statPoints)===JSON.stringify(ready.statPoints),
  bt.ok?`Lv${masuBondLevelInfo(bt.nextMasu).level}`:bt.reason);
check('限界突破で上限が+5され、回数と費用が合う',bt.nextMasu.levelCap===30+BREAKTHROUGH_LEVEL_CAP_GAIN&&bt.nextMasu.rebirthCount===1&&bt.cost===1500&&bt.nextGold===2500);
check('限界突破の初回は強化ポイント+5',bt.gainedPoints===BREAKTHROUGH_FIRST_POINTS&&bt.nextMasu.distAptPoints===9+BREAKTHROUGH_FIRST_POINTS);
const bt2=buildMasuBreakthrough({masu:{...bt.nextMasu,bondXp:totalBondXpForLevel(35)},skillKey:'own',gold:99999,psycheOwned:999999});
check('限界突破の2回目からは強化ポイント+1',bt2.ok&&bt2.gainedPoints===BREAKTHROUGH_POINTS&&bt2.nextMasu.distAptPoints===bt.nextMasu.distAptPoints+BREAKTHROUGH_POINTS,bt2.ok?'':bt2.reason);
check('限界突破は固有技・継承技・名前・染色・合体履歴を維持',bt.nextMasu.uniqueSkillLevels.own===1&&bt.nextMasu.uniqueSkillLevels['inh:0']===2&&bt.nextMasu.inheritedUniques.length===1&&bt.nextMasu.name===ready.name&&JSON.stringify(bt.nextMasu.colors)===JSON.stringify(['red'])&&bt.nextMasu.fusionHistory.length===1);
check('上限到達後はXPを取得しない',cappedBondXp(ready,9999)===capXp);
check('ダイヤ不足・未到達は限界突破できない',!buildMasuBreakthrough({masu:ready,skillKey:'own',gold:1499,psycheOwned:999999}).ok&&!buildMasuBreakthrough({masu:{...ready,bondXp:0},skillKey:'own',gold:9999,psycheOwned:999999}).ok);
// 固有技が最大まで育っていても限界突破そのものは止めない。上げなかったぶんは固有技ポイントとして残る
// (以前はここで止めていたため、全部の技が最大の個体は限界突破できなくなっていた)
const btMaxSkill=buildMasuBreakthrough({masu:{...ready,uniqueSkillLevels:{own:8}},skillKey:'own',gold:9999,psycheOwned:999999});
check('固有技が最大でも限界突破でき、ポイントとして残る',btMaxSkill.ok&&btMaxSkill.raisesSkill===false&&btMaxSkill.nextMasu.uniqueSkillPoints===1,btMaxSkill.ok?'':btMaxSkill.reason);
const atMax={...ready,levelCap:MAX_MASU_LEVEL_CAP,bondXp:totalBondXpForLevel(MAX_MASU_LEVEL_CAP)};
check(`上限Lv.${MAX_MASU_LEVEL_CAP}に届いたらそれ以上は上げられない`,!buildMasuBreakthrough({masu:atMax,skillKey:'own',gold:999999,psycheOwned:999999}).ok);

// --- 転生: レベルを99返して強化を振り直す ---
const hundred={...ready,levelCap:120,rebirthCount:14,bondXp:totalBondXpForLevel(103),distAptPoints:0,reincarnateCount:0};
const re=buildMasuReincarnation({masu:hundred,skillKey:'own',gold:999999});
check(`絆Lv.${REINCARNATE_MIN_LEVEL}未満では転生できない`,!buildMasuReincarnation({masu:{...hundred,bondXp:totalBondXpForLevel(99)},skillKey:'own',gold:999999}).ok);
check('転生でレベルが99下がる',re.ok&&re.fromLevel===103&&re.nextLevel===103-REINCARNATE_LEVEL_DROP&&masuBondLevelInfo(re.nextMasu).level===4,re.ok?'':re.reason);
check('転生でレベル上限は据え置き',re.nextMasu.levelCap===120);
check('転生で強化とステータスが白紙に戻る',JSON.stringify(re.nextMasu.statPoints)==='{"hp":0,"atk":0,"def":0,"guts":0}'&&JSON.stringify(re.nextMasu.distApt)===JSON.stringify(['C','C','C','C']));
const wantPoints=(4-1)+totalBreakthroughPoints(14)+REINCARNATE_POINTS;
check('転生で振り直せるポイントは「新レベル分＋限界突破分＋10」',re.nextMasu.distAptPoints===wantPoints&&re.nextPoints===wantPoints,`${re.nextMasu.distAptPoints} / 期待 ${wantPoints}`);
check('転生の回数が増え、固有技も1つ上がる',re.nextMasu.reincarnateCount===1&&re.nextMasu.uniqueSkillLevels.own===1);
check('転生は名前・染色・継承技・限界突破の回数を維持',re.nextMasu.name===ready.name&&JSON.stringify(re.nextMasu.colors)===JSON.stringify(['red'])&&re.nextMasu.inheritedUniques.length===1&&re.nextMasu.rebirthCount===14);

// --- 強化ポイントの辻褄 ---
// 限界突破のぶんを「得たはずの総数」に含めていないと、直後のレベルアップで相殺されて消える
const afterBt=reconcileMasuPoints({...bt.nextMasu,baseId:'Mocchi'});
check('限界突破でもらったポイントがレベルアップで消えない',afterBt.distAptPoints>=bt.nextMasu.distAptPoints,`${afterBt.distAptPoints} >= ${bt.nextMasu.distAptPoints}`);
check('限界突破ぶんのポイント計算',totalBreakthroughPoints(0)===0&&totalBreakthroughPoints(1)===BREAKTHROUGH_FIRST_POINTS&&totalBreakthroughPoints(3)===BREAKTHROUGH_FIRST_POINTS+BREAKTHROUGH_POINTS*2);
check('転生ぶんのポイント計算',totalReincarnatePoints(0)===0&&totalReincarnatePoints(2)===REINCARNATE_POINTS*2);
// 旧仕様で転生してレベルが1に戻っている個体も、新しい数え方で不足分が補われる
const legacyReborn=reconcileMasuPoints({...ready,baseId:'Mocchi',rebirthCount:3,levelCap:45,bondXp:0,distAptPoints:0,distApt:['C','C','C','C'],statPoints:{hp:0,atk:0,def:0,guts:0}});
check('以前の転生でレベルが戻った個体も新しい数え方で補われる',legacyReborn.distAptPoints===totalBreakthroughPoints(3),`${legacyReborn.distAptPoints} / 期待 ${totalBreakthroughPoints(3)}`);
// 二度読み込んでも増え続けないこと(補填は「不足分だけ」)
check('読み込みを繰り返してもポイントが増え続けない',reconcileMasuPoints(legacyReborn).distAptPoints===legacyReborn.distAptPoints);

// --- 保存経路・画面 ---
check('専用移行フラグとマスモン・ダイヤ保存がある',source.includes("mh_masu_level_cap_migrated_v1")&&source.includes("mh_masu_level_cap_migration_pending_v1")&&/storeSet\('mh_masu_mons', savedMasuMons/.test(source)&&/storeSet\('mh_gold'/.test(source));
const fusionSource=source.slice(source.indexOf('const executeMasuFusion'),source.indexOf('const resetFusionFlow'));
// 上がったレベルぶんの強化ポイントは applyBondXpGain がまとめて配る。
// 合体もそこを通しているので、経路と付与の両方を見る
check('レベルが上がったぶんの強化ポイントを配る',source.includes('distAptPoints: (masu.distAptPoints || 0) + gainedLevels'));
check('合体もその経路を通る',fusionSource.includes('applyBondXpGain(prepared, gainedXp)'));
// 「転生したらLv1へ戻す」時代の移行を今さら走らせると、育てたレベルを消してしまう
check('旧仕様のLv1リセット移行はもう走らせない',!/savedMasuMons = migrateRebornMasuToFullReset/.test(source));
const golemUnique={name:'合掌',names:['合掌','フライングプレス','竜巻アタック'],baseMult:3.2,baseGuts:68,effectDesc:'闘志'};
const evolved=uniqueSkillAtLevel(golemUnique,2);
check('固有技Lv2で技名・威力・会心率・消費Gを現在技へ切替',evolved.name==='竜巻アタック'&&evolved.mult===4.2&&evolved.crit===0.2&&evolved.guts===89&&evolved.effectDesc==='闘志');
check('限界突破の固有技候補名は強化後Lvのレベル別名称を使う',source.includes('name:uniqueSkillAtLevel(choice.unique,Math.min(MAX_UNIQUE_SKILL_LEVEL,level+1))?.name||choice.name'));
check('限界突破済みソート・表示設定と旧設定の補完を追加',source.includes("key: 'reborn', label: '限界突破済み'")&&source.includes("monsterSortKey === 'reborn'")&&source.includes('DEFAULT_MONSTER_LIST_SETTINGS.display[key]'));
check('同一固有技の継承を禁止',source.includes('duplicateUnique')&&source.includes('同じ固有技はすでに所持しているため引き継げません'));
check('現在技・解放済み・未解放を固有技詳細に表示',source.includes("current?'現在の技':locked?'未解放':'解放済み'"));
// ★は 青→黄色→ピンク→紫→赤→金 の6段階。5凸で1段階が完成し、次の段階は1個ずつ置き換わる。
// 31凸(最終限界突破)だけ虹★5。細かい凸数ごとの並びは breakthrough-star-check.js で見る
check('星は6段階＋虹で、常に5個まで',
  source.includes("{ key:'blue',")&&source.includes("{ key:'gold',")
  &&source.includes('const BREAKTHROUGH_STARS_PER_TIER = 5;')
  &&source.includes('const RAINBOW_STAR_COLORS')
  &&source.includes('const breakthroughStars = (count)')
  &&!source.includes("['#fde047','#f472b6','#ef4444','#ffffff']"));
check('最終限界突破でLv.200・虹★になる',
  source.includes('const FINAL_BREAKTHROUGH_COUNT = BREAKTHROUGH_MAX_COUNT + 1;')
  &&source.includes('const isFinal = normalized.levelCap >= BREAKTHROUGH_FINAL_LEVEL_CAP;')
  &&source.includes('finalBreakthrough:isFinal'));
// 増えた★は先頭に来るので、光らせるのは先頭(最終突破では5個とも虹なので全部)
check('限界突破は専用の演出を使い、増えた星が光る',source.includes('mh-breakthrough-animation')&&source.includes('mh-breakthrough-stars')&&source.includes("(finalBreak||i===0)?'is-new':'is-old'")&&source.includes('@keyframes mhBreakStar'));
check('転生演出は通常表示と同じ霊炎オーラを使う',source.includes('reincarnateAnimation&&<div className="mh-reincarnation-animation"')&&source.includes('<ReincarnateAura count={reincarnateAnimation.masu.reincarnateCount}/>'));
check('転生霊炎は1回青・2回黄・3回以上赤を共通表示から選ぶ',source.includes("value >= 3 ? 'is-red' : value === 2 ? 'is-yellow' : 'is-blue'")&&source.includes('.mh-reincarnate-aura.is-yellow')&&source.includes('.mh-reincarnate-aura.is-red'));
check('転生霊炎は本体の背面に置き、限界突破★を前面に保つ',source.includes('.mh-reincarnate-aura{--flame-hot:')&&source.includes('position:absolute;z-index:0;')&&source.includes('.mh-rebirth-stars-overlay,.mh-home-masumon-stars{z-index:4}'));
check('HOMEの転生表示は文字なしの霊炎で、限界突破★を変えない',source.includes('mhReincarnateFlameA')&&source.includes('<ReincarnateAura count={masu.reincarnateCount} className="is-home"/>')&&source.includes('<RebirthStars count={masu.rebirthCount} className="mh-home-masumon-stars"/>')&&!/mh-reincarnate-aura[^}]*ReincarnateBadge/.test(source));
check('神殿BGMを限界突破・転生の画面でも継続',/MASU_REBIRTH:\s*'temple'/.test(source)&&/MASU_REINCARNATE:\s*'temple'/.test(source));
check('神殿から限界突破と転生の両方へ入れる',source.includes(">限界突破</button>")&&source.includes("setGameState('MASU_REINCARNATE')"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
