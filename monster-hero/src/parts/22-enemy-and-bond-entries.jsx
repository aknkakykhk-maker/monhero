// 難易度の色をそのまま反映するためのinline style。選択中は背景色、未選択は文字色だけを難易度の色にする
const difficultyStyle = (setting, selected) => (selected
  ? { backgroundColor: setting.bg, color: setting.darkText ? '#0f172a' : '#ffffff' }
  : { backgroundColor: 'rgba(15,23,42,0.9)', color: setting.text });

// 透明余白を含む画像キャンバスではなく、画面ごとの見た目を基準に調整する。
// contextを必須にすることで、SCANの調整が全WAVE詳細へ波及しないようにする。
const ENEMY_ART_LAYOUT = {
  default: { scanScale:1, waveDetailScale:1, objectPosition:'center' },
  Moo: { scanScale:2.75, waveDetailScale:2, objectPosition:'center 48%' },
  // ★タクティクスバトルの敵。絵は長辺160pxにそろえてあるが、鎌・斧・翼のように
  //   細長いものが付いていると長辺をそこに取られ、本体が小さく見える。
  //   どれくらい小さく見えるかは node tools/image/enemy-art-size-report.js で測れる
  //   (56pxの枠に色が乗る面積。配信中の敵は13%〜68%・まんなか31%)。
  //   2026-09-21にユーザーが10体とも絵を出し直した。面積は コイノボリ63% / ドクドク48% /
  //   ニャルラトホテプ46% / カワズモー42% / スプラッター33% / メタルナー32% / 覚醒ムー30% /
  //   イナリ30% / ラミア29% / デルピエロ28% で、**10体ともその幅のまんなか寄り**に入ったので、
  //   覚醒ムー以外は倍率を入れない。古い絵に合わせた倍率(メタルナー1.1 / デルピエロ1.4 /
  //   スプラッター1.2)をそのまま残すと、今度は大きすぎる
  // ★覚醒ムーはクラシックのムーと同じ扱い。ボスだけは絵を高い解像度のまま置き(1024x598)、
  //   表示のときに大きく拡大する。拡大率もムーとそろえてある
  AwakenedMoo: { scanScale:2.75, waveDetailScale:2,    objectPosition:'center 48%' },
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
// ===== 新モード(id: tactics)の敵行動 =====
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
// ★上の ENEMY_ACTION_DEFINITIONS は書き換えない。別の表として持ち、
//   state.definitions で渡す。既存モードの呼び出しは何も変わらない。
// ★「様子を見ている(WAIT)」は入れない。5回に1回、敵が何もしないターンを作らないため。
// ★どの行動にも「こちらの対抗手段」を1つ用意する。読めば受けられる、が成り立たないと
//   ただ強いだけの難易度と変わらなくなる。
//     間合い攻撃 → 距離撃で敵をずらす / 連撃 → ガード(1ヒットぶんだけ効く)＋回復 /
//     貫通撃 → 回避・反射・スタン / 咆哮・再生 → スタンで潰す・削り切る /
//     単体狙い → 狙われた子を守る・回復する / 全体攻撃 → 全員のライフを見て回復を回す
// ★type は既存の ATTACK / SPECIAL をそのまま使い、違いは variant で持つ。
//   getIncomingDamageBeforeTurnReduction は type でダメージの有無を判断しているので、
//   ここを新しい type にするとダメージ計算・演出・予告の経路を全部書き足すことになる。
// ★倍率は2026-09-20にユーザーが1つずつ決め直した。それまでは受けるダメージが重く、
//   とくに「人数が増えるほど全体攻撃だけが強い」「同じ×1.8なのに連撃が貫通撃を
//   絶対に上回れない」という歪みがあった。攻める側(敵)を全体に下げて、
//   そのぶん敵を落としにくく(再生を厚く)し、休めるターン(行動なし)を戻してある。
const TACTICS_SWEEP_MULT = 1.2;       // 予告した間合いに敵がいるとき
const TACTICS_SWEEP_MISS_MULT = 0.4;  // 距離撃などでずらしたとき
const TACTICS_RUSH_MULT = 1.2;        // 0.4×3ヒット。ガードは1ヒットぶんしか効かない
const TACTICS_RUSH_HITS = 3;          // 威力をこの数で割ってヒットに分ける。ガードは1枚につき1ヒットを受け止める
const TACTICS_PIERCE_MULT = 0.8;      // ガードを無視する。効かないぶん倍率で加減する
const TACTICS_ROAR_ATK_RATE = 1.5;    // 次のターンから敵の攻撃が上がる
const TACTICS_ROAR_MAX_STACKS = 2;    // 重ねがけの上限
const TACTICS_REGEN_RATE = 0.5;       // 最大ライフに対する回復量。★与ダメを下げたぶん敵を落としにくくする
const TACTICS_REGEN_HP_THRESHOLD = 0.9; // ライフがこの割合を下回ったときだけ使う
// 全体攻撃(2026-09-19・設計 5.3)。
// ★1体あたりの威力は通常攻撃より必ず低くする。同じか上にすると人数が増えるほど
//   「全員を殴るほうが得」になり、狙いを読む意味も、供モンを連れる意味も消える。
//   もとは0.9で、4体そろうと合計×3.6と最も重い技になっていた(2026-09-20 に0.4へ)
// ★単体狙い(focus)は廃止した。必殺技(ためる→×2.5)と役割がかぶるため
//   (2026-09-20 ユーザー指示)。通常攻撃も連撃も貫通撃も「狙った1体」へ当たるので、
//   誰が狙われるかを読む遊びはそのまま残る
const TACTICS_ALLOUT_MULT = 0.4;  // 全員へ。1体あたりは通常攻撃より低い
// スエゾーの「眼力」。タクティクスバトルでは**その子が攻撃したターン**に引く(2026-09-20 ユーザー指示)。
// 既存5モードは今までどおり編成から決まる確率で、敵のターンの頭に引く
const TACTICS_INTIMIDATE_RATE = 0.4;
const TACTICS_ACTION_DEFINITIONS = [
  {id:'normal',type:'ATTACK',category:'通常攻撃',weight:30,multiplier:1,hits:1,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'charge',type:'CHARGE',category:'ためる',weight:12,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'special',type:'SPECIAL',category:'必殺技',weight:0,multiplier:2.5,hits:1,range:'全間合い',condition:'ためた次のターンに必ず発動',cooldown:0,useLimit:null},
  {id:'wait',type:'WAIT',category:'特殊行動',weight:10,multiplier:0,hits:0,range:'全間合い',condition:'常時',cooldown:0,useLimit:null},
  {id:'move',type:'MOVE',category:'移動',weight:10,multiplier:0,hits:0,range:'現在以外の3間合い',condition:'移動先がある・移動した次のターンは選ばない',cooldown:0,useLimit:null},
  {id:'sweep',type:'ATTACK',variant:'sweep',category:'間合い攻撃',weight:14,multiplier:TACTICS_SWEEP_MULT,missMultiplier:TACTICS_SWEEP_MISS_MULT,hits:1,range:'予告した1間合い',condition:'予告した間合いに敵がいると大ダメージ。距離撃でずらせる',cooldown:0,useLimit:null},
  {id:'rush',type:'ATTACK',variant:'rush',category:'連撃',weight:14,multiplier:TACTICS_RUSH_MULT,hits:TACTICS_RUSH_HITS,range:'全間合い',condition:`${TACTICS_RUSH_HITS}ヒットに分かれる。ガードは1枚につき1ヒットを受け止める`,cooldown:0,useLimit:null},
  // ★貫通撃は「ためる → 必殺技」と同じ形にしてある(2026-09-21 ユーザー指示
  //   「貫通は必殺級の技だからこれもためると同じように1ターン経由したほうがいい」)。
  //   ガードが効かない＝受け方が無い技なので、来ると分かってから距離や回避で備えられるようにする。
  //   抽選に出るのは構えのほうで、貫通撃そのものは構えた次のターンに必ず出る(weight 0)
  {id:'pierceCharge',type:'PIERCE_CHARGE',category:'貫通の構え',weight:12,multiplier:0,hits:0,range:'全間合い',condition:'常時',effectText:'次のターンに貫通撃が確定で出る',cooldown:0,useLimit:null},
  {id:'pierce',type:'ATTACK',variant:'pierce',category:'貫通撃',weight:0,multiplier:TACTICS_PIERCE_MULT,hits:1,range:'全間合い',condition:'構えた次のターンに必ず発動。ガードが効かない',cooldown:0,useLimit:null},
  {id:'roar',type:'ROAR',category:'攻撃力アップ',weight:10,multiplier:0,hits:0,range:'全間合い',condition:`重ねがけは${TACTICS_ROAR_MAX_STACKS}回まで`,effectText:`次のターンから敵の攻撃 ×${TACTICS_ROAR_ATK_RATE}（このWAVEのあいだ続く。${TACTICS_ROAR_MAX_STACKS}回重ねると最大 ×${(TACTICS_ROAR_ATK_RATE**TACTICS_ROAR_MAX_STACKS).toFixed(2)}）`,cooldown:0,useLimit:TACTICS_ROAR_MAX_STACKS},
  {id:'regen',type:'REGEN',category:'再生',weight:10,multiplier:0,hits:0,range:'全間合い',condition:'ライフが減っているときだけ',effectText:`敵が自分の最大ライフの${Math.round(TACTICS_REGEN_RATE*100)}%を回復する`,cooldown:0,useLimit:null},
  {id:'allout',type:'ATTACK',variant:'allout',targetsAll:true,category:'全体攻撃',weight:10,multiplier:TACTICS_ALLOUT_MULT,hits:1,range:'全員',condition:'立っている全員へ同時に当たる。狙いをかわせない',cooldown:0,useLimit:null},
];
// どの敵も通常攻撃・ためる・必殺技・移動は持つ。ここへ足すのは「その敵だけの技」。
// WAVEが進むほど読むことが増える並びにしてある(敵の順は TACTICS_ENEMY_SEQUENCE)。
// ★ここのキーは「タクティクス専用の敵」のid。クラシックの敵idを書くと、
//   タクティクスの敵が追加6技を1つも持たない状態になる(2026-09-21にそれで丸ごと出ていなかった)。
const TACTICS_BASE_ACTION_IDS = Object.freeze(['normal','charge','special','wait','move']);
const TACTICS_ENEMY_ACTION_IDS = Object.freeze({
  Kawazumo:Object.freeze(['rush']),
  Metalner:Object.freeze(['sweep']),
  Inari:Object.freeze(['rush','roar']),
  Koinobori:Object.freeze(['sweep','regen']),
  Delpiero:Object.freeze(['pierce','sweep']),
  Dokudoku:Object.freeze(['roar','rush','allout']),
  Lamia:Object.freeze(['sweep','pierce']),
  Nyarlathotep:Object.freeze(['regen','pierce','allout']),
  Splatter:Object.freeze(['rush','roar','pierce','allout']),
  AwakenedMoo:Object.freeze(['sweep','rush','pierce','roar','regen','allout']),
});
// 難易度が上がると、基本構成に無い技も順に使えるようになる(2026-09-21 ユーザー指示
// 「難易度が上がるにつれて使える技も増やそうか」)。足す順はこれ。
// ★allout(全体攻撃)は最後。低いWAVEの敵が早くから全員攻撃を撒くと、受け方を1つずつ覚えられない。
//   pierce(貫通撃)はその手前。構えを挟むぶん読めるとはいえ、ガードが効かない技なので後ろに置く
const TACTICS_EXTRA_ACTION_ORDER = Object.freeze(['rush','sweep','roar','regen','pierce','allout']);
// 基本構成(Normal)を0として、難易度ごとに何本増減するか。
// ★最低1本は残す。0にすると通常攻撃とためるだけになり、このモードの読み合いが消える
const TACTICS_DIFFICULTY_ACTION_DELTA = Object.freeze({
  Beginner:-2, Easy:-1, Normal:0, Hard:0, Expert:1, Master:1,
  GrandMaster:2, Hell:2, Legend:3,
  EXTREME:4, NIGHTMARE:4, CHAOS:5, ULTIMATE:6, INFINITY:6, GOD:6,
});
// 減らすときに先に落とす技。殴ってこないものから外す。
// ★前から順に切ると、ニャルラトホテプが再生だけ・ドクドクが咆哮だけになり、
//   易しい難易度ほど「敵が何もしてこない」ように見えてしまう
const TACTICS_SUPPORT_ACTION_IDS = Object.freeze(['roar','regen']);
// その敵がその難易度で使う技のid。難易度を渡さなければ基本構成のまま(既存の呼び出しはそのまま動く)
const tacticsEnemyActionIds = (enemyId, difficulty) => {
  const base = TACTICS_ENEMY_ACTION_IDS[enemyId] || [];
  const delta = Number.isFinite(TACTICS_DIFFICULTY_ACTION_DELTA[difficulty]) ? TACTICS_DIFFICULTY_ACTION_DELTA[difficulty] : 0;
  const want = Math.max(1, base.length + delta);
  if (want === base.length) return base;
  if (want < base.length) {
    // 落とすのは「補助をうしろから → それでも足りなければうしろから」。残ったものは base の並びを保つ
    const drop = base.length - want, dropped = new Set();
    for (let i = base.length - 1; i >= 0 && dropped.size < drop; i -= 1) {
      if (TACTICS_SUPPORT_ACTION_IDS.includes(base[i])) dropped.add(i);
    }
    for (let i = base.length - 1; i >= 0 && dropped.size < drop; i -= 1) dropped.add(i);
    return base.filter((_, i) => !dropped.has(i));
  }
  const extra = TACTICS_EXTRA_ACTION_ORDER.filter(id => !base.includes(id));
  return [...base, ...extra.slice(0, want - base.length)];
};
const tacticsActionDefinitions = (enemyId, difficulty) => {
  const own = tacticsEnemyActionIds(enemyId, difficulty);
  // 貫通撃は構えとセットで持たせる。構えが無いと、貫通撃は一生出てこない(weight 0 のため)
  const ids = [...TACTICS_BASE_ACTION_IDS, ...own, ...(own.includes('pierce') ? ['pierceCharge'] : [])];
  return TACTICS_ACTION_DEFINITIONS.filter(def => ids.includes(def.id));
};
// そのモード・その敵が使う行動表。新モード以外は今までどおりの1つの表を返す
const enemyActionDefinitionsFor = (mode, enemyId, difficulty) => (typeof isTacticsMode === 'function' && isTacticsMode(mode))
  ? tacticsActionDefinitions(enemyId, difficulty) : ENEMY_ACTION_DEFINITIONS;
// 直前の行動から、次に選べる行動を決めるための状態を作る
const enemyActionStateFrom = (lastIntent) => ({
  charging: lastIntent?.type === 'CHARGE',
  piercing: lastIntent?.type === 'PIERCE_CHARGE',
  movedLast: lastIntent?.type === 'MOVE',
});
const evaluateEnemyActions = (ent,currentDist,state={}) => {
  const charging=!!state.charging, piercing=!!state.piercing, movedLast=!!state.movedLast;
  // 行動表はモードごとに違う(新モードだけ別の表)。渡されなければ今までどおりの1つの表を使う
  const definitions=Array.isArray(state.definitions)&&state.definitions.length?state.definitions:ENEMY_ACTION_DEFINITIONS;
  return definitions.map(def => {
    let available=!!ent, reason=ent?'':'敵情報がありません';
    if (available) {
      if (charging) {
        // ためた次のターンは必殺技で確定。ほかの行動では上書きしない
        available = def.type==='SPECIAL';
        if (!available) reason='ためているため、次は必殺技で確定しています';
      } else if (piercing) {
        // 構えた次のターンは貫通撃で確定。ためる→必殺技とまったく同じ形
        available = def.id==='pierce';
        if (!available) reason='構えているため、次は貫通撃で確定しています';
      } else if (def.type==='SPECIAL') {
        available=false; reason='ためた次のターンにだけ発動します';
      } else if (def.id==='pierce') {
        available=false; reason='構えた次のターンにだけ発動します';
      } else if (def.type==='REGEN') {
        // 満タンに近いあいだは使わない。回復するものが無いターンを作らないため
        const maxHp=Math.max(0,Number(ent.maxHp)||0), hp=Math.max(0,Number(ent.hp)||0);
        if (!(maxHp>0 && hp<maxHp*TACTICS_REGEN_HP_THRESHOLD)) { available=false; reason='ライフが十分あるあいだは使いません'; }
      } else if (def.type==='ROAR') {
        // 重ねがけの上限。すでに上限まで吼えていたら選ばない
        if (Math.max(0,Number(state.roarStacks)||0)>=TACTICS_ROAR_MAX_STACKS) { available=false; reason=`重ねがけは${TACTICS_ROAR_MAX_STACKS}回までです`; }
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
    const weight = charging ? (def.type==='SPECIAL'?1:0)
      : piercing ? (def.id==='pierce'?1:0)
      : def.weight;
    return {...def,weight,available,unavailableReason:available?'':reason};
  });
};
const enemyActionProbabilities = (ent,currentDist,state={}) => {
  const actions=evaluateEnemyActions(ent,currentDist,state),total=actions.reduce((sum,a)=>sum+(a.available?a.weight:0),0);
  return actions.map(a=>({...a,probability:a.available&&total>0?a.weight/total:0}));
};
// 行動の見出しとアイコン。抽選と台本(練習モード)の両方から使う
const enemyActionLabel = (ent,type) => type==='ATTACK' ? (ent?.normal||'通常攻撃')
  : type==='CHARGE' ? '必殺技の準備をしている'
  : type==='PIERCE_CHARGE' ? '貫通撃の構えをとっている'
  : type==='SPECIAL' ? (ent?.special||'必殺技！')
  : type==='ROAR' ? '攻撃力を上げている'
  : type==='REGEN' ? '傷を癒している'
  : '様子を見ている';
// その敵のその行動を、画面へ出すときの名前。タクティクスの敵は追加6技の名前を actions に持つ
// (TACTICS_ENEMY_DATA)。名前を持たない敵は1文字も変わらず、今までどおりの見出しへ落ちる。
const enemyActionDisplayName = (ent,def) => {
  if(!def) return '';
  const named = ent && ent.actions && typeof ent.actions[def.id]==='string' ? ent.actions[def.id].trim() : '';
  if(named) return named;
  // 貫通の構えは、その敵の貫通撃の名前から作る(「◯◯の構え」)。何が来るかを名前で分かるようにする
  if(def.id==='pierceCharge'){
    const pierceName = ent && ent.actions && typeof ent.actions.pierce==='string' ? ent.actions.pierce.trim() : '';
    if(pierceName) return `${pierceName}の構え`;
  }
  return def.type==='MOVE' ? '間合い移動' : def.variant ? def.category : enemyActionLabel(ent,def.type);
};
const ENEMY_ACTION_ICONS = {ATTACK:'👊',CHARGE:'✨',SPECIAL:'🔥',WAIT:'⏳',MOVE:'🏃',ROAR:'📢',REGEN:'💚',PIERCE_CHARGE:'⚔️'};
// 新モードの攻撃は type が ATTACK のままなので、見分けは variant で付ける
const TACTICS_VARIANT_ICONS = {sweep:'🌪️',rush:'💥',pierce:'🗡️',allout:'🌊'};
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
  // 間合い攻撃は「いまいる間合い」を狙うと予告する。実行までに距離撃でずらせば威力が落ちるので、
  // 予告を見てからガッツを距離撃へ回すかどうかの判断になる。
  // 予告と実際に薙ぐ間合いが食い違わないよう、ここで決めた値だけを実行時に見る
  if(selected.variant==='sweep'){
    return {type:selected.type,variant:selected.variant,sweepDist:currentDist,
      value:Math.floor(ent.atk*selected.multiplier),missValue:Math.floor(ent.atk*(selected.missMultiplier??1)),
      label:`${enemyActionDisplayName(ent,selected)}: ${RANGE_LABELS[currentDist]}`,icon:TACTICS_VARIANT_ICONS.sweep,actionId:selected.id};
  }
  if(selected.variant){
    // 全体攻撃だけは狙いを決めない。予告の時点で「立っている全員」と決まっているので、
    // targetsAll を intent へ持ち歩き、当たる相手は tacticsIntentTargets が数え直す
    return {type:selected.type,variant:selected.variant,hits:Math.max(1,Math.floor(Number(selected.hits)||1)),
      ...(selected.targetsAll?{targetsAll:true}:{}),
      value:Math.floor(ent.atk*selected.multiplier),label:enemyActionDisplayName(ent,selected),
      icon:TACTICS_VARIANT_ICONS[selected.variant]||ENEMY_ACTION_ICONS[selected.type]||'⏳',actionId:selected.id};
  }
  return {type:selected.type,value:Math.floor(ent.atk*selected.multiplier),label:enemyActionDisplayName(ent,selected),icon:ENEMY_ACTION_ICONS[selected.type]||'⏳',actionId:selected.id};
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
// ★タクティクスバトルは敵の並びが別(TACTICS_ENEMY_SEQUENCE)。
//   options.mode にそのランのモードを渡すと、そちらの10体が出る。
//   クラシック・クイックの並び(ENEMY_SEQUENCE)は1つも変えない——あちらを差し替えると、
//   いま遊んでいる人のチャレンジ・プロの手ごたえが同時に変わってしまう。
//   forcedEnemyKey(デバッグの敵指定)は、どちらの表からでも引けるようにしておく。
const createBattleEnemy = (wave, difficulty, forcedEnemyKey=null, powerOverride=null, enemyTurnMultiplier=1, options={}) => {
  const tacticsEnemies = typeof isTacticsMode === 'function' && isTacticsMode(options && options.mode)
    && typeof TACTICS_ENEMY_SEQUENCE !== 'undefined';
  const sequence = tacticsEnemies ? TACTICS_ENEMY_SEQUENCE : ENEMY_SEQUENCE;
  const enemyKey = forcedEnemyKey || sequence[wave - 1];
  const base = (tacticsEnemies ? TACTICS_ENEMY_DATA[enemyKey] : null) || ENEMY_DATA[enemyKey]
    || (typeof TACTICS_ENEMY_DATA !== 'undefined' ? TACTICS_ENEMY_DATA[enemyKey] : null);
  const safeDifficulty = normalizeBattleDifficulty(difficulty);
  const hasPowerOverride = powerOverride !== null && powerOverride !== undefined && Number.isFinite(Number(powerOverride));
  const mod = hasPowerOverride ? Number(powerOverride) : QUICK_DIFFICULTY_SETTINGS[safeDifficulty].power;
  const baseHp = Number.isFinite(Number(base?.baseHp)) ? Math.max(1, Number(base.baseHp)) : 1;
  const baseAtk = Number.isFinite(Number(base?.baseAtk)) ? Math.max(0, Number(base.baseAtk)) : 0;
  return {
    ...(base || {}),
    id:enemyKey || `missing-wave-${wave}`,
    // ★難易度を敵そのものに持たせる。タクティクスは難易度で使える技の本数が変わるので、
    //   行動表を引くたびに「いまの難易度」を別経路で探すと、実戦とSCANでずれる
    difficulty:safeDifficulty,
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
      const entry={userName,breederId:record.breederId??null,icon:record.icon,profileFrame:record.profileFrame??null,monName,bondLevel,imgUrl:ALL_PLAYER_MONSTERS[monsterId]?.iconUrl||member.imgUrl||null,emoji:member.emoji||ALL_PLAYER_MONSTERS[monsterId]?.emoji||null,masuId:member.masuId??null,monsterId,detail:member.detail??null,colors:Array.isArray(member.colors)?member.colors:[]};
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

// 絆Lvランキングの一覧(1人 × 1個体)を、総合力の高い順へ並べ直す。
// 取り出す一覧・重複のまとめ方は絆Lvとまったく同じで、並べる数字だけが替わる。
//
// 総合力は育成スナップショット(detail.power)にだけ入っている「その記録を出したときの値」。
//   ・いまのデータで計算し直さない … 種のバランスを変えると過去の順位まで動いてしまう
//   ・残っていない古い記録は載せない … 参考値を本物の順位へ混ぜない(「情報なし」の行も作らない)
const collectPowerRankingEntries = (bondEntries) => (Array.isArray(bondEntries) ? bondEntries : [])
  .map(entry => {
    const power = Number(entry?.detail?.power);
    return (entry && Number.isFinite(power) && power > 0) ? { ...entry, power: Math.round(power) } : null;
  })
  .filter(Boolean)
  .sort((a, b) => b.power - a.power || String(a.userName||'').localeCompare(String(b.userName||''), 'ja'));

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
// 1つのスロットへ何枚重ねられるか(60-app.jsx の slotMaxUses)も、この一覧を通す。
// 勇者モンにした本人のカードだけ複数枚まとめて使える(ただし固有技は山札に1枚しか無い)
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
const buildAttackHits = ({ d, card, attackerId, heroId, comboDmgBonus = 0, critDmgBonus = 0, guaranteedCrit = false, rollCrit = () => false, globalComboRate = 0, mainCanCrit = true, kenshiExtraCombos = 0, comboFinalMultiplier = 1 }) => {
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
    const beforeSoulFinal = crit ? Math.floor(base * critMult) : base;
    const safeComboFinalMultiplier = Math.max(0, Number(comboFinalMultiplier) || 0);
    hits.push({ kind: 'combo', crit, dmg: Math.floor(beforeSoulFinal * safeComboFinalMultiplier), skillName, noAnim });
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
const attackAtonementDmg = (card, mainDmg, comboFinalMultiplier = 1) => {
  if (!(card.type === 'unique' && (card.monId === 'Ark' || card.monId === 'Iblis'))) return 0;
  const base = Math.floor(mainDmg * ATTACK_COMBO_RULES.atonement);
  return Math.floor(base * Math.max(0, Number(comboFinalMultiplier) || 0));
};


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
