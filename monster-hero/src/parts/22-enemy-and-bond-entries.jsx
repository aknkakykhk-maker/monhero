// 難易度の色をそのまま反映するためのinline style。選択中は背景色、未選択は文字色だけを難易度の色にする
const difficultyStyle = (setting, selected) => (selected
  ? { backgroundColor: setting.bg, color: setting.darkText ? '#0f172a' : '#ffffff' }
  : { backgroundColor: 'rgba(15,23,42,0.9)', color: setting.text });

// 透明余白を含む画像キャンバスではなく、画面ごとの見た目を基準に調整する。
// contextを必須にすることで、SCANの調整が全WAVE詳細へ波及しないようにする。
const ENEMY_ART_LAYOUT = {
  default: { scanScale:1, waveDetailScale:1, objectPosition:'center' },
  Moo: { scanScale:2.75, waveDetailScale:2, objectPosition:'center 48%' },
};
const enemyArtStyle = (enemyId, context='scan') => {
  const layout=ENEMY_ART_LAYOUT[enemyId]||ENEMY_ART_LAYOUT.default;
  const scale=context==='waveDetail'?layout.waveDetailScale:layout.scanScale;
  return {transform:`scale(${scale})`,transformOrigin:layout.objectPosition,objectPosition:layout.objectPosition};
};

// 実戦の抽選とSCANは同じ定義・使用可否評価を参照する。SCAN側は候補を評価するだけで乱数を使わない。
//
// 必殺技は「ためる(CHARGE)」→「発動(SPECIAL)」の2ターンに分かれている。
// CHARGE のターンはオーラを溜めるだけでダメージが無く、その次のターンは必ず SPECIAL になる
// (再抽選せず、移動などほかの行動でも上書きしない)。SPECIAL は抽選には出てこないので重みは0。
//
// 移動は「移動した次のターンには選ばない」。同じ間合いを行ったり来たりして
// 手が出せないまま終わる、という状態を避けるため。
const ENEMY_ACTION_DEFINITIONS = [
  {id:'normal',type:'ATTACK',category:'通常攻撃',weight:50,multiplier:1,hits:1,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'charge',type:'CHARGE',category:'ためる',weight:15,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'special',type:'SPECIAL',category:'必殺技',weight:0,multiplier:2.5,hits:1,range:'全間合い',condition:'ためた次のターンに必ず発動',cooldown:0,useLimit:null},
  {id:'wait',type:'WAIT',category:'特殊行動',weight:20,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'move',type:'MOVE',category:'移動',weight:15,multiplier:0,hits:0,range:'現在以外の3間合い',condition:'移動先がある・移動した次のターンは選ばない',cooldown:0,useLimit:null},
];
// 直前の行動から、次に選べる行動を決めるための状態を作る
const enemyActionStateFrom = (lastIntent) => ({
  charging: lastIntent?.type === 'CHARGE',
  movedLast: lastIntent?.type === 'MOVE',
});
const evaluateEnemyActions = (ent,currentDist,state={}) => {
  const charging=!!state.charging, movedLast=!!state.movedLast;
  return ENEMY_ACTION_DEFINITIONS.map(def => {
    let available=!!ent, reason=ent?'':'敵情報がありません';
    if (available) {
      if (charging) {
        // ためた次のターンは必殺技で確定。ほかの行動では上書きしない
        available = def.type==='SPECIAL';
        if (!available) reason='ためているため、次は必殺技で確定しています';
      } else if (def.type==='SPECIAL') {
        available=false; reason='ためた次のターンにだけ発動します';
      } else if (def.type==='MOVE') {
        // 移動は必ず前のターンに吹き出しで予告してから行う。
        // 予告を出す機会が無かったターンの直後は、そもそも移動を選ばない。
        //   ・戦闘が始まった1ターン目
        //   ・必殺技の準備をスタンで止めるなどして、予約していた行動を引き直したとき
        if (state.unannounced) { available=false; reason='移動は前のターンの吹き出しで予告してから行うため、予告を出していないこの場面では選ばれません'; }
        else if (movedLast) { available=false; reason='移動した次のターンは移動しません'; }
        else if (!RANGE_LABELS.some((_,i)=>i!==currentDist)) { available=false; reason='移動先がありません'; }
      }
    }
    return {...def,weight:charging?(def.type==='SPECIAL'?1:0):def.weight,available,unavailableReason:available?'':reason};
  });
};
const enemyActionProbabilities = (ent,currentDist,state={}) => {
  const actions=evaluateEnemyActions(ent,currentDist,state),total=actions.reduce((sum,a)=>sum+(a.available?a.weight:0),0);
  return actions.map(a=>({...a,probability:a.available&&total>0?a.weight/total:0}));
};
// 行動の見出しとアイコン。抽選と台本(練習モード)の両方から使う
const enemyActionLabel = (ent,type) => type==='ATTACK' ? (ent?.normal||'通常攻撃')
  : type==='CHARGE' ? '必殺技の準備をしている'
  : type==='SPECIAL' ? (ent?.special||'必殺技！')
  : '様子を見ている';
const ENEMY_ACTION_ICONS = {ATTACK:'👊',CHARGE:'✨',SPECIAL:'🔥',WAIT:'⏳',MOVE:'🏃'};
const chooseEnemyAction = (ent,currentDist,random=Math.random,state={}) => {
  const actions=enemyActionProbabilities(ent,currentDist,state),roll=random(),available=actions.filter(a=>a.available);
  let cursor=roll;
  const selected=available.find(a=>{cursor-=a.probability;return cursor<0;})||available[available.length-1];
  if(!selected)return null;
  if(selected.type==='MOVE'){
    const targets=RANGE_LABELS.map((_,i)=>i).filter(i=>i!==currentDist);
    const targetDist=targets[Math.min(targets.length-1,Math.floor(random()*targets.length))];
    // 予告に出した移動先をそのまま持ち歩く。実行時はこの値だけを見るので、
    // 予告と実際の移動先が食い違うことはない
    return {type:selected.type,value:0,label:`移動: ${RANGE_LABELS[targetDist]}`,targetDist,icon:ENEMY_ACTION_ICONS.MOVE,actionId:selected.id};
  }
  return {type:selected.type,value:Math.floor(ent.atk*selected.multiplier),label:enemyActionLabel(ent,selected.type),icon:ENEMY_ACTION_ICONS[selected.type]||'⏳',actionId:selected.id};
};

// 難易度選択プレビューと本番の敵生成が必ず同じ値になるための唯一の生成ヘルパー。
// 絶氷の楔(固有効果)と氷海の支配者(勇者特性)を持つ人魚たち。
// 固有効果と勇者特性は別の処理だが、対象種の一覧だけを共有する。
const ICE_LOCK_MONSTER_IDS = Object.freeze(['Snegurochka', 'Undine', 'Yaobikuni']);
const isIceLockMonster = (id) => ICE_LOCK_MONSTER_IDS.includes(id);
const applyIceRulerAutoGutsRecovery = (currentRate, heroId, iceLockActive, heroDist, enemyDist) => isIceLockMonster(heroId)
  && iceLockActive
  && heroDist===enemyDist
  ? Math.min(1, currentRate + 0.5)
  : currentRate;
const createBattleEnemy = (wave, difficulty, forcedEnemyKey=null, powerOverride=null, enemyTurnMultiplier=1) => {
  const enemyKey = forcedEnemyKey || ENEMY_SEQUENCE[wave - 1];
  const base = ENEMY_DATA[enemyKey];
  const safeDifficulty = normalizeBattleDifficulty(difficulty);
  const hasPowerOverride = powerOverride !== null && powerOverride !== undefined && Number.isFinite(Number(powerOverride));
  const mod = hasPowerOverride ? Number(powerOverride) : QUICK_DIFFICULTY_SETTINGS[safeDifficulty].power;
  const baseHp = Number.isFinite(Number(base?.baseHp)) ? Math.max(1, Number(base.baseHp)) : 1;
  const baseAtk = Number.isFinite(Number(base?.baseAtk)) ? Math.max(0, Number(base.baseAtk)) : 0;
  return {
    ...(base || {}),
    id:enemyKey || `missing-wave-${wave}`,
    name:base?.name || '敵データ未設定',
    imgUrl:base?.imgUrl || '',
    emoji:base?.emoji || '❓',
    hp:Math.floor(baseHp*mod*enemyTurnMultiplier),
    maxHp:Math.floor(baseHp*mod*enemyTurnMultiplier),
    atk:Math.floor(baseAtk*mod*enemyTurnMultiplier),
  };
};

const collectBondRankingEntries = (rankingPool) => {
  const byIndividual=new Map();
  Object.values(rankingPool||{}).forEach(rows=>(rows||[]).forEach(record=>{
    const userName=record?.userName||'名無しのブリーダー';
    (Array.isArray(record?.party)?record.party:[]).forEach(member=>{
      const bondLevel=Number(member?.bondLevel);
      if(!member||!Number.isFinite(bondLevel)||bondLevel<=0)return;
      const recordedMonsterId=member.baseId||member.monsterId||member.id||null;
      const monsterId=recordedMonsterId||Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name)||null;
      const monName=ALL_PLAYER_MONSTERS[monsterId]?.name||member.name||null;
      if(!monName)return;
      const individualId=member.masuId!=null&&String(member.masuId)!==''
        ? `masu:${String(member.masuId)}`
        : `legacy:${monsterId||monName}`;
      const key=`${userName}\u0000${individualId}`;
      // detail / colors は「詳細 ›」で1体ぶんの中身を開くために持ち回る。
      // 育て方を記録するようになる前の古い記録には入っていないので、その場合はnullのまま。
      const entry={userName,icon:record.icon,monName,bondLevel,imgUrl:ALL_PLAYER_MONSTERS[monsterId]?.iconUrl||member.imgUrl||null,emoji:member.emoji||ALL_PLAYER_MONSTERS[monsterId]?.emoji||null,masuId:member.masuId??null,monsterId,detail:member.detail??null,colors:Array.isArray(member.colors)?member.colors:[]};
      const current=byIndividual.get(key);
      if(!current)byIndividual.set(key,entry);
      else byIndividual.set(key,{...(bondLevel>current.bondLevel?entry:current),bondLevel:Math.max(current.bondLevel,bondLevel)});
    });
  }));
  // 同じ人・同じ種類で「個体ID(masuId)付きの記録」と「個体IDの無い古い記録」が両方あると、
  // 同じマスモンが2件に分かれて並んでしまう。古い記録はどの個体かを特定できないので、
  // 個体ID付きの記録がある種類では古い記録を出さない。
  // ただし古い記録の方が高い絆Lvを持っている場合は、その値だけ個体側へ引き継ぐ。
  const entries=[...byIndividual.values()];
  const speciesKey=e=>`${e.userName}\u0000${e.monsterId||e.monName}`;
  const bestMasuOfSpecies=new Map();
  entries.forEach(e=>{
    if(e.masuId==null||String(e.masuId)==='')return;
    const key=speciesKey(e);
    const current=bestMasuOfSpecies.get(key);
    if(!current||e.bondLevel>current.bondLevel)bestMasuOfSpecies.set(key,e);
  });
  const deduped=entries.filter(e=>{
    if(e.masuId!=null&&String(e.masuId)!=='')return true;
    const owner=bestMasuOfSpecies.get(speciesKey(e));
    if(!owner)return true; // 個体IDの記録が無ければ、古い記録をそのまま出す
    if(e.bondLevel>owner.bondLevel)owner.bondLevel=e.bondLevel;
    return false;
  });
  return deduped.sort((a,b)=>b.bondLevel-a.bondLevel||a.userName.localeCompare(b.userName,'ja'));
};

// ランキングに出すモンスターの絵。記録にはIDだけが入っているので、同梱の絵を引いて使う。
// 画像を埋め込んでいた頃の古い記録は、そのimgUrlをそのまま使って表示できるようにしておく。
const rankingMonsterIdOf = (member) => {
  if (!member) return null;
  const recorded = member.baseId||member.monsterId||member.id;
  if (recorded && ALL_PLAYER_MONSTERS[recorded]) return recorded;
  // 古い記録は種類のIDを持たず名前しか無いことがあるので、名前からも引く
  return Object.keys(ALL_PLAYER_MONSTERS).find(id=>ALL_PLAYER_MONSTERS[id]?.name===member.name) || null;
};
// 編成の各モンスターに、そのプレイ時点の絆Lvを添える。
// bondLevel は記録にもとから入っているので、表示するだけで通信は増えない。
// マスモンでない(絆Lvを持たない)モンスターは何も出さない。
const rankingMemberLevel = (member) => {
  const level = Number(member?.bondLevel);
  return Number.isFinite(level) && level > 0 ? level : null;
};
const rankingMemberImage = (member) => {
  if (!member) return null;
  const base = ALL_PLAYER_MONSTERS[rankingMonsterIdOf(member)];
  return base?.iconUrl || member.imgUrl || null;
};

const splitRankingParty = (entry) => {
  if (!Array.isArray(entry?.party)) return {hero:null,allies:null};
  const members = entry.party.filter(Boolean);
  const roleHeroIndex = members.findIndex(member=>member?.role==='hero');
  if (roleHeroIndex >= 0) return {hero:members[roleHeroIndex],allies:members.filter((_,i)=>i!==roleHeroIndex && members[i]?.role!=='hero')};
  // 旧記録は個体IDを優先し、無ければ表示名一致の最初の1体だけを勇者として分離する。
  let heroIndex = entry?.heroMasuId != null ? members.findIndex(m=>m?.masuId!=null&&String(m.masuId)===String(entry.heroMasuId)) : -1;
  if (heroIndex < 0) heroIndex = members.findIndex(member=>member?.name===entry?.hero);
  if (heroIndex < 0) return {hero:null,allies:null};
  return {hero:members[heroIndex],allies:members.filter((_,i)=>i!==heroIndex)};
};

// ブリーダー教えカード使用時の専用演出(色・アイコン・掛け声)
// ==================== 攻撃1枚が生むヒット列(予測表示と実処理の共通の正本) ====================
// 与ダメージは getDmg(基礎ダメージ)のあと、勇者特性や固有技の連撃・全体連撃で複数のヒットになる。
// 以前は予測表示(getAttackPredictedDmg)と実処理(processTurn)が別々に同じ分岐を書いていて、
// 片方だけ直すと「予測と実際が違う」になっていた(docs/refactor/BATTLE_DAMAGE_MAP.md)。
// ここで 1 か所にまとめ、会心の決め方(乱数か確定か)だけを呼び出し側が渡す。
// 【順序を変えないこと】メイン → ザン特性 → 連斬 → 桜花連舞 → 緋桜連華 → 禁忌解錠(通常の後半) → 禁忌解錠(固有技)
//   → 二刀流(通常の後半) → 二刀流(固有技の10%×3) → ソードスキル(20%×2) → 永久追加連撃 → 全体連撃。
// 演出(専用モーションの再生・noAnim)がこの順序と skillName に依存している。
// 勇者モンに選んだときだけ効く「同時使用可能枚数+1」を持つ種。
// ハムの「連続攻撃」と剣士モッチーの「二刀流」は名前が違うだけで効果は同じなので、
// 種ごとに処理を書かず、この一覧と cardLimit の共通ルールへ乗せる。
// (1つのスロットへ何枚重ねられるか(slotMaxUses)はハムの連続攻撃だけの話なので、こことは別)
const HERO_CARD_BONUS_MONSTER_IDS = Object.freeze(['Ham', 'KenshiMocchi']);
const heroCardBonusOf = (heroId) => (HERO_CARD_BONUS_MONSTER_IDS.includes(heroId) ? 1 : 0);
const ATTACK_COMBO_RULES = Object.freeze({
  zanHero: 0.3,                              // 勇者特性「連撃」: ザン勇者がザンで攻撃(通常・固有とも)
  zanUnique: 0.2,                            // 固有技「連斬」: 技の出自がザンなら誰が使っても(合体で引き継いだ場合も)
  eikiHero: Object.freeze([0.1, 0.1]),       // 勇者特性「桜花連舞」: エイキ勇者がエイキで攻撃(通常・固有とも)
  eikiHeroUnique: 0.3,                       // 桜花連舞: さらにエイキ自身の固有技なら追加
  eikiUnique: Object.freeze([0.15, 0.15]),   // 固有効果「緋桜連華」: 技の出自がエイキなら誰が使っても
  pandoraSplitNormal: 0.5,                   // 禁忌解錠: パンドラ勇者がパンドラで通常攻撃(atk/range_atk)すると 50%+50% に分ける
  pandoraUnique: 1.0,                        // 禁忌解錠: パンドラ自身の固有技は 100% の連撃(引き継いだ技には無い)
  kenshiSplitNormal: 0.5,                    // 二刀流: 剣士モッチー勇者が剣士モッチーで通常攻撃(atk/range_atk)すると 50%+50% に分ける
  kenshiHeroUnique: Object.freeze([0.1, 0.1, 0.1]), // 二刀流: さらに剣士モッチー自身の固有技なら 10% を3回追加
  kenshiUnique: Object.freeze([0.2, 0.2]),   // 固有効果「ソードスキル」: 技の出自が剣士モッチーなら誰が使っても
  kenshiExtraCombo: 0.1,                     // ソードスキルの連撃パワーが3充填されるたび、この率の連撃が1本ずつ永久に増える
  atonement: 0.2,                            // 贖罪(アーク・イブリースの固有技): メインの確定値の 20%。実処理では固有技の効果ブロック側で積む
});
// ソードスキルの「連撃パワー」が満タンになる数。ここに達するたびに永久10%連撃が1本増え、0へ戻る
const KENSHI_COMBO_POWER_MAX = 3;
// mainCanCrit:false は「メインヒットには会心が乗らない」種類(あつの挑発)。連撃・全体連撃の会心判定は変わらない
const buildAttackHits = ({ d, card, attackerId, heroId, comboDmgBonus = 0, critDmgBonus = 0, guaranteedCrit = false, rollCrit = () => false, globalComboRate = 0, mainCanCrit = true, kenshiExtraCombos = 0 }) => {
  const hits = [];
  const critMult = 1.5 + critDmgBonus;
  const isUniqueOf = (id) => card.type === 'unique' && card.monId === id;
  const pandoraSplitNormal = heroId === 'Pandora' && attackerId === 'Pandora' && ['atk', 'range_atk'].includes(card.type);
  // 二刀流も禁忌解錠と同じ「通常攻撃を50%+50%へ分ける」形。固有技は分割しない(メイン100%のまま)
  const kenshiHero = heroId === 'KenshiMocchi' && attackerId === 'KenshiMocchi';
  const kenshiSplitNormal = kenshiHero && ['atk', 'range_atk'].includes(card.type);
  // 分割は、分割前の d を基準に 50% ずつへ分ける(先に半減した値を追撃の基準にすると 50%+25% になる)。
  // 二刀流は「合計は元のまま」が仕様なので、d が奇数のときの余り1をメインへ寄せる
  // (両方 floor にすると d=1001 が 500+500=1000 になり、1だけ減る)。
  // 禁忌解錠は公開済みの挙動をそのまま保つため、こちらは従来どおり両方 floor のまま。
  const mainBase = pandoraSplitNormal ? Math.floor(d * 0.5)
    : kenshiSplitNormal ? d - Math.floor(d * 0.5)
    : d;
  const mainCrit = mainCanCrit && (guaranteedCrit || rollCrit());
  hits.push({ kind: 'main', crit: mainCrit, dmg: mainCrit ? Math.floor(mainBase * critMult) : mainBase, skillName: null, noAnim: false });
  // 連撃は元ダメージ d を基準にし、会心はメインとは独立に判定する(メインの会心を二重に乗せない)
  const combo = (rate, skillName = '連撃', noAnim = false) => {
    const base = Math.floor(d * rate);
    if (base <= 0) return;
    const crit = guaranteedCrit || rollCrit();
    hits.push({ kind: 'combo', crit, dmg: crit ? Math.floor(base * critMult) : base, skillName, noAnim });
  };
  if (heroId === 'Zan' && attackerId === 'Zan') combo(ATTACK_COMBO_RULES.zanHero + comboDmgBonus);
  if (isUniqueOf('Zan')) combo(ATTACK_COMBO_RULES.zanUnique + comboDmgBonus);
  if (heroId === 'Eiki' && attackerId === 'Eiki') {
    for (const rate of ATTACK_COMBO_RULES.eikiHero) combo(rate + comboDmgBonus);
    if (isUniqueOf('Eiki')) combo(ATTACK_COMBO_RULES.eikiHeroUnique + comboDmgBonus);
  }
  if (isUniqueOf('Eiki')) for (const rate of ATTACK_COMBO_RULES.eikiUnique) combo(rate + comboDmgBonus);
  if (pandoraSplitNormal) combo(ATTACK_COMBO_RULES.pandoraSplitNormal + comboDmgBonus, '連撃', true);
  if (heroId === 'Pandora' && attackerId === 'Pandora' && isUniqueOf('Pandora')) combo(ATTACK_COMBO_RULES.pandoraUnique + comboDmgBonus, '連撃', true);
  // 勇者特性「二刀流」: 通常攻撃のもう半分と、自身の固有技のときの10%×3
  if (kenshiSplitNormal) combo(ATTACK_COMBO_RULES.kenshiSplitNormal + comboDmgBonus);
  if (kenshiHero && isUniqueOf('KenshiMocchi')) for (const rate of ATTACK_COMBO_RULES.kenshiHeroUnique) combo(rate + comboDmgBonus);
  // 固有効果「ソードスキル」: 技の出自が剣士モッチーなら誰が使っても(合体で引き継いだ場合も)
  if (isUniqueOf('KenshiMocchi')) for (const rate of ATTACK_COMBO_RULES.kenshiUnique) combo(rate + comboDmgBonus);
  // ソードスキルの連撃パワーが3充填されるたびに1本ずつ増える永久連撃。
  // 本数に上限は設けない。率にも連撃ダメージ補正(comboDmgBonus)が乗る
  if (attackerId === 'KenshiMocchi') {
    for (let i = 0; i < kenshiExtraCombos; i++) combo(ATTACK_COMBO_RULES.kenshiExtraCombo + comboDmgBonus);
  }
  if (globalComboRate > 0) combo(globalComboRate, '全体連撃', true); // きき由来の全体連撃は全モンスター共通の別ヒット
  return hits;
};
// 贖罪の追撃(アーク・イブリースの固有技)。メインヒットの確定値を基準にし、会心は乗せない
const attackAtonementDmg = (card, mainDmg) => (card.type === 'unique' && (card.monId === 'Ark' || card.monId === 'Iblis')) ? Math.floor(mainDmg * ATTACK_COMBO_RULES.atonement) : 0;


const TEACHING_FX_STYLE = {
  oryo:    { icon:"🌸", label:"闘気上昇!",   text:"text-red-300",     ring:"border-red-300",     rgb:"239,68,68" },
  dra:     { icon:"🐉", label:"鉄壁化!",     text:"text-emerald-300", ring:"border-emerald-300", rgb:"16,185,129" },
  cadmium: { icon:"🧪", label:"計算完了!",   text:"text-cyan-300",    ring:"border-cyan-300",    rgb:"6,182,212" },
  mua:     { icon:"💖", label:"祝福!",       text:"text-pink-300",    ring:"border-pink-300",    rgb:"236,72,153" },
  atsu:    { icon:"🔥", label:"挑発!",       text:"text-orange-300",  ring:"border-orange-300",  rgb:"234,88,12" },
  myaru:   { icon:"🐈", label:"怪薬投与!",   text:"text-purple-300",  ring:"border-purple-300",  rgb:"168,85,247" },
  kiki:    { icon:"📣", label:"全力応援!",   text:"text-sky-300",     ring:"border-sky-300",     rgb:"56,189,248" },
  poltz:   { icon:"🍱", label:"弁当を構える!", text:"text-lime-300",    ring:"border-lime-300",    rgb:"163,230,53" },
};
