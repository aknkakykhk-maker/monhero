// Storage helpers — window.storage は元々の別プラットフォーム向けAPIで、
// GitHub Pages上には存在しない。実ブラウザのlocalStorageを使い、
// それも使えない場合のみメモリ内フォールバック(リロードで消える)にする。
// 本番バトルとDEBUGで共用するパンドラの分身描画。中央像と左右2枚は同じ画像要素を
// 複製し、雷も各分身体の内側に置くことで発射位置が中央1点にならないようにする。
// バトルの記録(ログ)の色分け。何が起きた行なのかを、読む前に色で見分けられるようにする。
// 分け方はRPGテストのメッセージ欄(会心・かわした・戦闘不能…)と同じ考え方にそろえてある。
const BATTLE_LOG_TONE_STYLE = Object.freeze({
  turn:    'border-indigo-400/40 bg-indigo-950/60 text-indigo-200 text-center tracking-[0.18em]',
  card:    'border-violet-400/30 bg-violet-950/40 text-violet-100',
  enemy:   'border-red-500/30 bg-red-950/40 text-red-200',
  crit:    'border-amber-300/40 bg-amber-950/40 text-amber-200',
  damage:  'border-white/10 bg-slate-900/70 text-slate-100',
  miss:    'border-cyan-400/30 bg-cyan-950/40 text-cyan-200',
  guard:   'border-emerald-400/30 bg-emerald-950/40 text-emerald-200',
  heal:    'border-emerald-400/30 bg-emerald-950/40 text-emerald-200',
  down:    'border-rose-500/40 bg-rose-950/50 text-rose-200',
  default: 'border-white/10 bg-slate-900/70 text-slate-300',
});

// ==== 攻撃を「敵の位置」へ向ける(2026-09-24 ユーザー指示「モンスターの位置から上に向かって
// アクションしているのを、敵に位置を合わせて何かをする感じにしたい」)。
// 攻撃する子の絵の中心から敵の丸枠の中心までの差(px)を測り、CSS変数で各モーションへ渡す。
//   --atk-dx / --atk-dy : 敵までの横・縦のずれ(上が負)
//   --atk-len / --atk-rot : 敵までの距離と向き(真上を0degとして時計回り)
//   --pd-l-* / --pd-r-* : パンドラの左右の分身から敵までの雷の長さと向き(分身の位置は下の比率で決まる)
// 変数が無いとき(図鑑・画像デバッグ・RPG)は :root の既定値(真上へ少し)で、今までに近い見え方になる。
// ★計算・保存・ターン進行には一切触れない。見た目だけ。
const PANDORA_CLONE_REACH = .5;   // 分身が敵へ向かって出る割合(0=その場・1=敵の位置)
const PANDORA_CLONE_LIFT = 6;     // 撃っているあいだの分身の浮き(px)。keyframes の -6px と同じ値
const attackAimVars = (dx, dy, {spread = 56} = {}) => {
  const aimOf = (vx, vy) => ({ len: Math.max(24, Math.hypot(vx, vy)), rot: Math.atan2(vx, -vy) * 180 / Math.PI });
  const main = aimOf(dx, dy);
  const cloneY = dy * PANDORA_CLONE_REACH - PANDORA_CLONE_LIFT;
  const left = aimOf(dx - (dx * PANDORA_CLONE_REACH - spread), dy - cloneY);
  const right = aimOf(dx - (dx * PANDORA_CLONE_REACH + spread), dy - cloneY);
  const px = (v) => `${Math.round(v)}px`;
  const deg = (v) => `${Math.round(v * 10) / 10}deg`;
  return {
    '--atk-dx': px(dx), '--atk-dy': px(dy), '--atk-len': px(main.len), '--atk-rot': deg(main.rot),
    // 敵が右にいれば1・左なら-1・ほぼ真上なら0(水攻撃の左右の滑りを敵の側へ寄せるのに使う)
    '--atk-side': String(dx > 12 ? 1 : (dx < -12 ? -1 : 0)),
    '--pd-l-x': px(dx * PANDORA_CLONE_REACH - spread), '--pd-r-x': px(dx * PANDORA_CLONE_REACH + spread),
    '--pd-y': px(dy * PANDORA_CLONE_REACH),
    // 分身は撃つあいだ .95 倍に縮むので、雷はそのぶん長くして敵まで届かせる
    '--pd-l-len': px(left.len / .95), '--pd-l-rot': deg(left.rot),
    '--pd-r-len': px(right.len / .95), '--pd-r-rot': deg(right.rot),
  };
};
// 要素の中心を測る。★自分に掛かっている transform(攻撃中の移動・タメの沈み込み)は含めない。
// getBoundingClientRect は動いている最中の位置を返すので、タメ→本技の2段目で狙いがずれる。
// offsetLeft/offsetTop は transform を含まないので、動かない親の位置に足して中心を出す。
const attackAimCenter = (el) => {
  const parent = el.offsetParent;
  if (!parent) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  const pr = parent.getBoundingClientRect();
  return {
    x: pr.left + parent.clientLeft - parent.scrollLeft + el.offsetLeft + el.offsetWidth / 2,
    y: pr.top + parent.clientTop - parent.scrollTop + el.offsetTop + el.offsetHeight / 2,
  };
};
// バトル画面で、その枠の子から敵(data-attack-target)までのずれを返す。測れなければ null(既定値で動く)。
// 新しい盤面は絵だけが動く(data-tactics-attack-image)ので絵の中心から、古い盤面は枠ごと動くので枠の中心から測る。
const measureAttackAim = (slotIndex) => {
  if (typeof document === 'undefined' || slotIndex == null) return null;
  const slot = document.querySelector(`[data-slot-index="${slotIndex}"]`);
  const enemy = document.querySelector('[data-attack-target]');
  if (!slot || !enemy) return null;
  const from = attackAimCenter(slot.querySelector('[data-tactics-attack-image]') || slot);
  const to = attackAimCenter(enemy);
  const dx = Math.round(to.x - from.x);
  const dy = Math.round(to.y - from.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.hypot(dx, dy) < 24) return null;
  return { slotIndex, dx, dy };
};
// 敵の側に出す着弾。枠ごと飛んでいく動き(通常の体当たり・固有技の突進・ザン・エイキ)は
// 絵の中に着弾を置くと一緒に動いてしまうので、敵の丸枠の中へ重ねる。
// 水・歌・雷・聖光は自分の演出の中で敵の位置へ着弾を描くので、ここでは何も出さない。
// 時間は各モーションの「当たった瞬間」に合わせてあり、どれも攻撃の尺の中で消える。
const ATTACK_TARGET_OWN_IMPACT = Object.freeze(['waterBurst', 'miaSongNotes', 'pandoraDualThunder', 'arkHolyRain']);
const ATTACK_TARGET_SLASHES = Object.freeze({
  zan:  [{ angle:'-32deg', delay:'80ms'  }, { angle:'24deg', delay:'124ms' }, { angle:'-6deg', delay:'168ms' }],
  eiki: [{ angle:'28deg',  delay:'110ms' }, { angle:'-4deg', delay:'158ms' }, { angle:'-38deg', delay:'206ms' }, { angle:'64deg', delay:'254ms' }],
});
const AttackTargetFx = ({anim}) => {
  if (!anim || anim.charge === true || anim.twinBlade) return null;
  if (anim.zanCombo) {
    const kind = anim.sakura ? 'eiki' : 'zan';
    return (
      <span className={`atk-target-fx atk-target-fx--${kind}`} aria-hidden="true">
        {ATTACK_TARGET_SLASHES[kind].map((slash, index) => (
          <i key={index} className="atk-target-fx__slash" style={{ '--atk-slash-angle':slash.angle, animationDelay:slash.delay }}/>
        ))}
        <i className="atk-target-fx__bloom"/>
      </span>
    );
  }
  if (ATTACK_TARGET_OWN_IMPACT.includes(anim.motion)) return null;
  return (
    <span className={`atk-target-fx atk-target-fx--hit${anim.charge === false ? ' atk-target-fx--special' : ''}`} aria-hidden="true">
      <i className="atk-target-fx__core"/>
      <i className="atk-target-fx__ring"/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <i key={deg} className="atk-target-fx__ray" style={{ '--atk-ray-angle':`${deg}deg` }}/>
      ))}
    </span>
  );
};
// エイキの攻撃中だけ重ねる桜の花びら。
// 常時アニメーションにはせず、攻撃モーションが出ているあいだ(isAnimating)だけ描く。
// スマホの負荷を増やしすぎないよう、要素は固定12枚・CSSアニメーション1本だけにして、
// 画像は使わずCSSの小片を transform / opacity だけで流す。枠の高速斬撃はザンと同じ
// zanComboDash が担当し、花びらだけ斬撃方向へ遅れて散らして短い余韻を作る。
const EIKI_SAKURA_PETALS = Object.freeze([
  { left:'2%',  top:'66%', delay:'0ms',  flowX:'68px', flowY:'-38px', burstX:'86px',  burstY:'-54px', trailX:'112px', trailY:'-68px', spin:'310deg',  size:'7px'  },
  { left:'8%',  top:'54%', delay:'18ms', flowX:'62px', flowY:'-24px', burstX:'76px',  burstY:'-42px', trailX:'104px', trailY:'-52px', spin:'-280deg', size:'9px'  },
  { left:'14%', top:'74%', delay:'36ms', flowX:'74px', flowY:'-44px', burstX:'96px',  burstY:'-30px', trailX:'122px', trailY:'-42px', spin:'360deg',  size:'6px'  },
  { left:'22%', top:'42%', delay:'8ms',  flowX:'70px', flowY:'-18px', burstX:'92px',  burstY:'-34px', trailX:'118px', trailY:'-48px', spin:'-330deg', size:'8px'  },
  { left:'30%', top:'64%', delay:'54ms', flowX:'64px', flowY:'-34px', burstX:'82px',  burstY:'-60px', trailX:'108px', trailY:'-76px', spin:'390deg',  size:'10px' },
  { left:'38%', top:'36%', delay:'26ms', flowX:'72px', flowY:'-20px', burstX:'98px',  burstY:'-10px', trailX:'124px', trailY:'-24px', spin:'-300deg', size:'7px'  },
  { left:'46%', top:'70%', delay:'70ms', flowX:'66px', flowY:'-42px', burstX:'88px',  burstY:'-66px', trailX:'116px', trailY:'-80px', spin:'340deg',  size:'8px'  },
  { left:'54%', top:'48%', delay:'12ms', flowX:'58px', flowY:'-26px', burstX:'80px',  burstY:'-12px', trailX:'106px', trailY:'-28px', spin:'-370deg', size:'9px'  },
  { left:'62%', top:'62%', delay:'44ms', flowX:'70px', flowY:'-36px', burstX:'94px',  burstY:'-48px', trailX:'120px', trailY:'-62px', spin:'320deg',  size:'6px'  },
  { left:'70%', top:'34%', delay:'62ms', flowX:'60px', flowY:'-16px', burstX:'78px',  burstY:'-38px', trailX:'102px', trailY:'-50px', spin:'-350deg', size:'8px'  },
  { left:'78%', top:'72%', delay:'22ms', flowX:'66px', flowY:'-40px', burstX:'92px',  burstY:'-22px', trailX:'116px', trailY:'-38px', spin:'380deg',  size:'9px'  },
  { left:'86%', top:'50%', delay:'48ms', flowX:'56px', flowY:'-28px', burstX:'74px',  burstY:'-50px', trailX:'98px',  trailY:'-64px', spin:'-320deg', size:'7px'  },
]);
const EikiSakuraPetals = () => (
  <span className="eiki-sakura" aria-hidden="true">
    {EIKI_SAKURA_PETALS.map((petal, index) => (
      <span key={index} className="eiki-sakura__petal"
        style={{ left:petal.left, top:petal.top, width:petal.size, height:`${parseFloat(petal.size)*1.45}px`, animationDelay:petal.delay,
          '--eiki-petal-flow-x':petal.flowX, '--eiki-petal-flow-y':petal.flowY,
          '--eiki-petal-burst-x':petal.burstX, '--eiki-petal-burst-y':petal.burstY,
          '--eiki-petal-trail-x':petal.trailX, '--eiki-petal-trail-y':petal.trailY,
          '--eiki-petal-spin-mid':`${parseFloat(petal.spin)*.55}deg`,
          '--eiki-petal-spin-burst':`${parseFloat(petal.spin)*.8}deg`,
          '--eiki-petal-spin':petal.spin }}/>
    ))}
  </span>
);
// 剣士モッチーの二刀流演出。
// 本体は kenshiTwinBladeSlash で敵まで高速移動し、ここでは斬撃・速度線・X字の決め演出だけを重ねる。
// 常時DOMは増やさず、攻撃中だけ描画する。永久追加連撃が何本に増えても、この演出自体は1攻撃1セット。
const KENSHI_TWIN_SLASHES = Object.freeze([
  { angle:'-38deg', delay:'135ms', color:'rgba(139,92,246,.98)', origin:'90% 50%', sweepX:'-18px' }, // 1撃目 ＼
  { angle:'38deg',  delay:'315ms', color:'rgba(34,211,238,.98)', origin:'10% 50%', sweepX:'18px' },  // 2撃目 ／
]);
const KENSHI_TWIN_SPEED_LINES = Object.freeze([
  { left:'8%',  top:'72%', delay:'35ms',  angle:'-20deg', travelX:'-38px', travelY:'-118px', width:'74px' },
  { left:'26%', top:'82%', delay:'70ms',  angle:'-14deg', travelX:'20px',  travelY:'-138px', width:'92px' },
  { left:'68%', top:'78%', delay:'238ms', angle:'18deg',  travelX:'-18px', travelY:'-132px', width:'88px' },
  { left:'82%', top:'66%', delay:'270ms', angle:'24deg',  travelX:'34px',  travelY:'-116px', width:'68px' },
]);
const KENSHI_TWIN_SHARDS = Object.freeze([
  { x:'-76px', y:'-42px', angle:'-34deg', delay:'0ms' },
  { x:'-54px', y:'38px',  angle:'24deg',  delay:'12ms' },
  { x:'-18px', y:'-70px', angle:'-8deg',  delay:'22ms' },
  { x:'28px',  y:'-62px', angle:'18deg',  delay:'8ms' },
  { x:'60px',  y:'-28px', angle:'36deg',  delay:'18ms' },
  { x:'72px',  y:'34px',  angle:'52deg',  delay:'28ms' },
]);
const KenshiTwinSlash = () => (
  <span className="kenshi-twin-slash" aria-hidden="true">
    {KENSHI_TWIN_SLASHES.map((blade, index) => (
      <span key={`blade-${index}`} className="kenshi-twin-slash__blade"
        style={{
          '--kenshi-slash-angle':blade.angle,
          '--kenshi-slash-delay':blade.delay,
          '--kenshi-slash-color':blade.color,
          '--kenshi-slash-origin':blade.origin,
          '--kenshi-slash-sweep-x':blade.sweepX,
        }}/>
    ))}
    {KENSHI_TWIN_SPEED_LINES.map((line, index) => (
      <span key={`speed-${index}`} className="kenshi-twin-slash__speed"
        style={{
          left:line.left, top:line.top, width:line.width,
          '--kenshi-speed-delay':line.delay,
          '--kenshi-speed-angle':line.angle,
          '--kenshi-speed-x':line.travelX,
          '--kenshi-speed-y':line.travelY,
        }}/>
    ))}
    <span className="kenshi-twin-slash__impact">
      <span className="kenshi-twin-slash__impact-core"/>
      <span className="kenshi-twin-slash__impact-ring"/>
    </span>
    {KENSHI_TWIN_SHARDS.map((shard, index) => (
      <span key={`shard-${index}`} className="kenshi-twin-slash__shard"
        style={{
          '--kenshi-shard-x':shard.x,
          '--kenshi-shard-y':shard.y,
          '--kenshi-shard-angle':shard.angle,
          '--kenshi-shard-delay':shard.delay,
        }}/>
    ))}
  </span>
);
// アーク専用の聖光攻撃演出。
// 距離枠は動かさず、本体だけがふわりと浮遊し、敵位置の上空から5本の聖光を時間差で降らせる。
// 追加画像は使わず、攻撃中だけDOMへ出る固定数のCSS要素で光輪・光柱・着弾・光粒を描く。
const ARK_HOLY_RAYS = Object.freeze([
  { left:'18%', delay:'180ms', tilt:'-5deg', scale:'.88' },
  { left:'34%', delay:'255ms', tilt:'3deg',  scale:'1.00' },
  { left:'50%', delay:'330ms', tilt:'-2deg', scale:'1.18' },
  { left:'66%', delay:'405ms', tilt:'4deg',  scale:'1.00' },
  { left:'82%', delay:'480ms', tilt:'-4deg', scale:'.88' },
]);
const ARK_HOLY_SPARKLES = Object.freeze([
  { x:'-78px', y:'-38px', delay:'500ms', size:'7px' },
  { x:'-58px', y:'-72px', delay:'530ms', size:'5px' },
  { x:'-30px', y:'-88px', delay:'555ms', size:'8px' },
  { x:'10px',  y:'-92px', delay:'520ms', size:'6px' },
  { x:'44px',  y:'-76px', delay:'570ms', size:'8px' },
  { x:'76px',  y:'-42px', delay:'545ms', size:'5px' },
  { x:'-62px', y:'18px',  delay:'590ms', size:'6px' },
  { x:'64px',  y:'20px',  delay:'605ms', size:'7px' },
]);
const ArkHolyRainMotion = ({image, charging=false, empowered=false, compact=false}) => (
  <span className={`ark-holy-rain${charging?' ark-holy-rain--charging':''}${empowered?' ark-holy-rain--empowered':''}${compact?' ark-holy-rain--compact':''}`}>
    <span className="ark-holy-rain__sky" aria-hidden="true"><i/><i/></span>
    <span className="ark-holy-rain__monster">{image}</span>
    <span className="ark-holy-rain__rays" aria-hidden="true">
      {ARK_HOLY_RAYS.map((ray,index)=>(
        <i key={`ray-${index}`} className="ark-holy-rain__ray" style={{
          left:ray.left, animationDelay:ray.delay,
          '--ark-ray-tilt':ray.tilt, '--ark-ray-scale':ray.scale,
        }}/>
      ))}
    </span>
    <span className="ark-holy-rain__impact" aria-hidden="true">
      <i className="ark-holy-rain__impact-core"/>
      <i className="ark-holy-rain__impact-ring"/>
    </span>
    <span className="ark-holy-rain__sparkles" aria-hidden="true">
      {ARK_HOLY_SPARKLES.map((spark,index)=>(
        <i key={`spark-${index}`} className="ark-holy-rain__spark" style={{
          width:spark.size, height:spark.size, animationDelay:spark.delay,
          '--ark-spark-x':spark.x, '--ark-spark-y':spark.y,
        }}/>
      ))}
    </span>
  </span>
);
// ウンディーネ種（スネグーラチカ・ウンディーネ・ヤオビクニ）共通の水攻撃演出。
// 距離枠そのものは動かさず、本体だけを左右へ大きく滑らせながら水弾を3発撃つ。
// 水弾は敵の向き(--atk-rot)へ傾けて敵の位置(--atk-dx/dy)まで飛ばし、着弾の飛沫も敵の上に出す。
// x は3発が敵の中心へ寄るための横のずれ、y は当たる場所のばらけ。
// 水弾・水面の引き波・着弾飛沫は攻撃中だけDOMへ出し、常時アニメーションにはしない。
const WATER_BURST_SHOTS = Object.freeze([
  { left:'17%', delay:'120ms', x:'24px',  y:'-8px', angle:'-10deg' },
  { left:'50%', delay:'240ms', x:'0px',   y:'6px',  angle:'2deg'   },
  { left:'83%', delay:'360ms', x:'-24px', y:'-4px', angle:'10deg'  },
]);
const WATER_BURST_SPLASH_DROPS = Object.freeze([
  { x:'-74px', y:'-34px', angle:'-28deg', delay:'0ms'  },
  { x:'-54px', y:'-66px', angle:'-48deg', delay:'18ms' },
  { x:'-24px', y:'-78px', angle:'-72deg', delay:'8ms'  },
  { x:'16px',  y:'-82px', angle:'72deg',  delay:'22ms' },
  { x:'50px',  y:'-62px', angle:'48deg',  delay:'10ms' },
  { x:'76px',  y:'-30px', angle:'26deg',  delay:'28ms' },
  { x:'-60px', y:'18px',  angle:'14deg',  delay:'34ms' },
  { x:'62px',  y:'20px',  angle:'-14deg', delay:'38ms' },
]);
const WaterBurstMotion = ({image, lunge=false, charging=false, compact=false}) => (
  <span className={`water-burst-motion${lunge?' water-burst-motion--lunge':''}${charging?' water-burst-motion--charging':''}${compact?' water-burst-motion--compact':''}`}>
    <span className="water-burst-motion__wake" aria-hidden="true"><i/><i/><i/></span>
    <span className="water-burst-motion__monster">{image}</span>
    <span className="water-burst-motion__shots" aria-hidden="true">
      {WATER_BURST_SHOTS.map((shot,index)=>(
        <i key={`shot-${index}`} className="water-burst-motion__shot" style={{
          left:shot.left, animationDelay:shot.delay,
          '--water-shot-x':shot.x, '--water-shot-y':shot.y, '--water-shot-angle':shot.angle,
        }}/>
      ))}
    </span>
    <span className="water-burst-motion__impact" aria-hidden="true">
      <i className="water-burst-motion__impact-core"/>
      <i className="water-burst-motion__impact-ring"/>
      {WATER_BURST_SPLASH_DROPS.map((drop,index)=>(
        <i key={`drop-${index}`} className="water-burst-motion__drop" style={{
          '--water-drop-x':drop.x, '--water-drop-y':drop.y,
          '--water-drop-angle':drop.angle, '--water-drop-delay':drop.delay,
        }}/>
      ))}
    </span>
  </span>
);
// ミーア専用の歌攻撃演出。
// 距離枠は動かさず、本体だけが跳ねて体をひねり、敵のほうへ身を乗り出し、マイクスタンドの前で歌う。
// 音符は5つ、左右に揺れながら敵の位置(--atk-dx/dy)まで飛び、敵の向きへ音の波を3つ走らせる。
// x は飛ぶ途中の左右の揺れ、y は途中でふくらむ高さ。追加画像・追加音源は使わず、攻撃中だけDOMへ出る
// 固定数のCSS要素で描く(常時アニメーションにはしない)。
// スマホの縦画面でも「歌って攻撃している」と一目で分かるよう、マイクは本体の手前・
// やや左に置いて本体を隠さず、音符は大きさと高さをばらして4つ流す。
const MIA_SONG_NOTES = Object.freeze([
  { glyph:'♪', left:'40%', delay:'70ms',  x:'-26px', y:'-34px', size:'26px', spin:'-18deg', color:'#f9a8d4' },
  { glyph:'♬', left:'56%', delay:'140ms', x:'24px',  y:'-48px', size:'33px', spin:'14deg',  color:'#c4b5fd' },
  { glyph:'♫', left:'46%', delay:'210ms', x:'-18px', y:'-40px', size:'24px', spin:'-12deg', color:'#fda4af' },
  { glyph:'♩', left:'60%', delay:'280ms', x:'30px',  y:'-56px', size:'29px', spin:'20deg',  color:'#a5f3fc' },
  { glyph:'♪', left:'50%', delay:'340ms', x:'-10px', y:'-30px', size:'22px', spin:'10deg',  color:'#fde68a' },
]);
const MIA_SONG_SPARKLES = Object.freeze([
  { x:'-70px', y:'-30px', delay:'0ms',  size:'8px' },
  { x:'-46px', y:'-64px', delay:'22ms', size:'6px' },
  { x:'-14px', y:'-78px', delay:'12ms', size:'9px' },
  { x:'26px',  y:'-72px', delay:'30ms', size:'7px' },
  { x:'58px',  y:'-44px', delay:'18ms', size:'9px' },
  { x:'72px',  y:'6px',   delay:'36ms', size:'6px' },
  { x:'-62px', y:'14px',  delay:'28ms', size:'7px' },
  { x:'4px',   y:'22px',  delay:'42ms', size:'6px' },
]);
const MiaSongNotesMotion = ({image, lunge=false, charging=false, compact=false}) => (
  <span className={`mia-song-notes${lunge?' mia-song-notes--lunge':''}${charging?' mia-song-notes--charging':''}${compact?' mia-song-notes--compact':''}`}>
    <span className="mia-song-notes__stage" aria-hidden="true"><i/><i/></span>
    <span className="mia-song-notes__monster">{image}</span>
    <span className="mia-song-notes__mic" aria-hidden="true">
      <i className="mia-song-notes__mic-body"/>
      <i className="mia-song-notes__mic-clip"/>
      <i className="mia-song-notes__mic-pole mia-song-notes__mic-pole--upper"/>
      <i className="mia-song-notes__mic-pole"/>
      <i className="mia-song-notes__mic-joint"/>
      <i className="mia-song-notes__mic-base"/>
    </span>
    <span className="mia-song-notes__waves" aria-hidden="true"><i/><i/><i/></span>
    <span className="mia-song-notes__notes" aria-hidden="true">
      {MIA_SONG_NOTES.map((note,index)=>(
        <i key={`note-${index}`} className="mia-song-notes__note" style={{
          left:note.left, animationDelay:note.delay, fontSize:note.size, color:note.color,
          '--mia-note-x':note.x, '--mia-note-y':note.y, '--mia-note-spin':note.spin,
        }}>{note.glyph}</i>
      ))}
    </span>
    <span className="mia-song-notes__impact" aria-hidden="true">
      <i className="mia-song-notes__impact-core"/>
      <i className="mia-song-notes__impact-ring"/>
      <i className="mia-song-notes__impact-ring mia-song-notes__impact-ring--late"/>
      {MIA_SONG_SPARKLES.map((spark,index)=>(
        <i key={`spark-${index}`} className="mia-song-notes__spark" style={{
          width:spark.size, height:spark.size,
          '--mia-spark-x':spark.x, '--mia-spark-y':spark.y, '--mia-spark-delay':spark.delay,
        }}/>
      ))}
    </span>
  </span>
);
// パンドラの分身雷撃。本体が光って2体に分かれ、敵をはさむ位置(--pd-l-x / --pd-r-x)まで跳び、
// それぞれの分身から敵へ向けて雷を撃つ(長さと向きは attackAimVars が決める)。
// 同時に敵の真上から大きな落雷を落とし、着弾の閃光と輪を敵の位置に出してから本体へ戻る。
const PandoraDualThunder = ({image, compact=false}) => (
  <span className={`pandora-dual-thunder${compact?' pandora-dual-thunder--compact':''}`} aria-hidden="true">
    <span className="pandora-dual-center">{React.cloneElement(image,{alt:''})}</span>
    {['left','right'].map(side=><span key={side} className={`pandora-dual-clone pandora-dual-clone--${side}`}>
      {React.cloneElement(image,{alt:''})}
      <i className="pandora-dual-orb"/>
      <i className="pandora-dual-bolt"/>
    </span>)}
    <span className="pandora-dual-strike">
      <i className="pandora-dual-strike__bolt"/>
      <i className="pandora-dual-strike__flash"/>
      <i className="pandora-dual-strike__ring"/>
    </span>
  </span>
);
// 図鑑などから本番と同じ攻撃モーション描画を使うための共通ステージ。
// image は用途ごとの実画像要素を受け取り、モーション専用の画像コピーは作らない。
// 敵が居ないので、真上の少し先を「敵の位置」として変数を渡す(本番と同じ keyframes がそのまま動く)。
const BattleAttackMotionPreview = ({image, anim, compact=false}) => {
  const aimVars = compact ? attackAimVars(0, -70, {spread:30}) : attackAimVars(0, -120);
  if(anim?.motion==='arkHolyRain') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <ArkHolyRainMotion image={image} charging={anim?.charge===true} empowered={anim?.charge===false} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='waterBurst') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <WaterBurstMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='miaSongNotes') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...aimVars}}>
        <MiaSongNotesMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='pandoraDualThunder') {
    // 大きく見せる版は2.15倍に拡大するので、敵までの距離もそのぶん縮めて渡す
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate',...attackAimVars(0, -56, {spread:26})}}>
        <span style={compact?undefined:{display:'block',transform:'scale(2.15)',transformOrigin:'center'}}>
          <PandoraDualThunder image={image} compact={compact}/>
        </span>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full" style={{isolation:'isolate',...aimVars}}>
      <div className="relative h-full w-full" style={{animation:attackMotionAnimation(anim)}}>
        {image}
        {anim?.sakura&&<EikiSakuraPetals/>}
        {anim?.twinBlade&&<KenshiTwinSlash/>}
      </div>
      {/* 敵の側の着弾。本番は敵の丸枠に重ねるが、ここでは「敵の位置」へずらして重ねる */}
      <span className="atk-target-fx-anchor" aria-hidden="true"><AttackTargetFx anim={anim}/></span>
    </div>
  );
};

