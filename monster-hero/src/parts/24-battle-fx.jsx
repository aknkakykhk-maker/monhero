// Storage helpers — window.storage は元々の別プラットフォーム向けAPIで、
// GitHub Pages上には存在しない。実ブラウザのlocalStorageを使い、
// それも使えない場合のみメモリ内フォールバック(リロードで消える)にする。
// 本番バトルとDEBUGで共用するパンドラの分身描画。中央像と左右2枚は同じ画像要素を
// 複製し、雷も各分身体の内側に置くことで発射位置が中央1点にならないようにする。
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
// 水弾・水面の引き波・着弾飛沫は攻撃中だけDOMへ出し、常時アニメーションにはしない。
const WATER_BURST_SHOTS = Object.freeze([
  { left:'17%', delay:'120ms', x:'24px',  y:'-132px', angle:'-8deg' },
  { left:'50%', delay:'240ms', x:'0px',   y:'-138px', angle:'2deg'  },
  { left:'83%', delay:'360ms', x:'-24px', y:'-132px', angle:'9deg'  },
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
// 距離枠は動かさず、本体だけが少し前へ出てリズムを取り、前へマイクスタンドを出して
// 音符を4つ時間差で敵へ飛ばす。追加画像・追加音源は使わず、攻撃中だけDOMへ出る
// 固定数のCSS要素で描く(常時アニメーションにはしない)。
// スマホの縦画面でも「歌って攻撃している」と一目で分かるよう、マイクは本体の手前・
// やや左に置いて本体を隠さず、音符は大きさと高さをばらして4つ流す。
const MIA_SONG_NOTES = Object.freeze([
  { glyph:'♪', left:'36%', delay:'90ms',  x:'20px',  y:'-126px', size:'26px', spin:'-18deg', color:'#f9a8d4' },
  { glyph:'♬', left:'52%', delay:'185ms', x:'-4px',  y:'-142px', size:'33px', spin:'14deg',  color:'#c4b5fd' },
  { glyph:'♫', left:'66%', delay:'275ms', x:'-24px', y:'-120px', size:'24px', spin:'-12deg', color:'#fda4af' },
  { glyph:'♩', left:'45%', delay:'365ms', x:'10px',  y:'-136px', size:'29px', spin:'20deg',  color:'#a5f3fc' },
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
      <i className="mia-song-notes__mic-head"/>
      <i className="mia-song-notes__mic-pole"/>
      <i className="mia-song-notes__mic-base"/>
    </span>
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
const PandoraDualThunder = ({image, compact=false}) => (
  <span className={`pandora-dual-thunder${compact?' pandora-dual-thunder--compact':''}`} aria-hidden="true">
    <span className="pandora-dual-center">{React.cloneElement(image,{alt:''})}</span>
    {['left','right'].map(side=><span key={side} className={`pandora-dual-clone pandora-dual-clone--${side}`}>
      {React.cloneElement(image,{alt:''})}
      <i className="pandora-dual-bolt"/>
    </span>)}
  </span>
);
// 図鑑などから本番と同じ攻撃モーション描画を使うための共通ステージ。
// image は用途ごとの実画像要素を受け取り、モーション専用の画像コピーは作らない。
const BattleAttackMotionPreview = ({image, anim, compact=false}) => {
  if(anim?.motion==='arkHolyRain') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate'}}>
        <ArkHolyRainMotion image={image} charging={anim?.charge===true} empowered={anim?.charge===false} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='waterBurst') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate'}}>
        <WaterBurstMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='miaSongNotes') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate'}}>
        <MiaSongNotesMotion image={image} lunge={anim?.charge===false} charging={anim?.charge===true} compact={compact}/>
      </div>
    );
  }
  if(anim?.motion==='pandoraDualThunder') {
    return (
      <div className="relative h-full w-full flex items-center justify-center" style={{isolation:'isolate'}}>
        <span style={compact?undefined:{display:'block',transform:'scale(2.15)',transformOrigin:'center'}}>
          <PandoraDualThunder image={image} compact={compact}/>
        </span>
      </div>
    );
  }
  return (
    <div className="relative h-full w-full" style={{isolation:'isolate',animation:attackMotionAnimation(anim)}}>
      {image}
      {anim?.sakura&&<EikiSakuraPetals/>}
      {anim?.twinBlade&&<KenshiTwinSlash/>}
    </div>
  );
};

