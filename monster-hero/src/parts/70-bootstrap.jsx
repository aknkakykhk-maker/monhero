const createAnimationStyle = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById('mh-anim-style')) return;
  const style = document.createElement('style');
  style.id = 'mh-anim-style';
  style.textContent = `
    /* 日本語の行の折り返し(禁則処理)。既定のままだと Chromium も Safari も禁則がゆるく、
       長音「ー」や小書き仮名「っ」が行頭へ出てしまう
       (2026-09-08・ユーザー指摘「図鑑説明の文字の並びが悪い / ほとんどのモンスターが悪い」。
        実機では「恐ろしいモンスタ / ー。」「通常攻撃のダメ / ージが」のように折り返していた)。
       line-break:strict で JIS X 4051 の厳しい禁則になる。実測では、幅240〜400pxで
       起きていた59通りの禁則違反が全部直った(tools/text/japanese-linebreak-check.js)。
       日本語以外の折り返しには影響しない(英単語の分割は word-break/overflow-wrap が担当)。 */
    body { line-break: strict; }
    /* 味方の攻撃を「敵の位置」へ向けるための変数(24-battle-fx.jsx の attackAimVars が枠ごとに上書きする)。
       ここは測れなかったとき・図鑑などの既定値で、真上へ少し(今までの見え方に近い)。 */
    :root {
      --atk-dx: 0px; --atk-dy: -120px; --atk-len: 120px; --atk-rot: 0deg; --atk-side: 0;
      --pd-l-x: -56px; --pd-r-x: 56px; --pd-y: -60px;
      --pd-l-len: 97px; --pd-l-rot: 35.4deg; --pd-r-len: 97px; --pd-r-rot: -35.4deg;
    }
    /* 通常の体当たり(モッチーほか)。一度しゃがんでから敵の位置まで飛び込み、当たった瞬間に
       ぐしゃっとつぶれて赤く光り、跳ね返って戻る。着弾の光は敵の丸枠の側(AttackTargetFx)が出す。 */
    @keyframes attackFly {
      0% {
        transform: translate3d(0,0,0) scale(1) rotate(0deg);
        filter: drop-shadow(0 0 6px rgba(250,204,21,0.5));
      }
      14% {
        transform: translate3d(calc(var(--atk-dx) * -.06), 12px, 0) scale(1.12,.82) rotate(calc(var(--atk-rot) * -.15));
        filter: drop-shadow(0 0 12px rgba(250,204,21,0.8));
      }
      38% {
        transform: translate3d(calc(var(--atk-dx) * .86), calc(var(--atk-dy) * .86), 0) scale(1.28) rotate(calc(var(--atk-rot) * .3));
        filter: drop-shadow(calc(var(--atk-dx) * -.12) calc(var(--atk-dy) * -.12) 0 rgba(250,204,21,0.35)) drop-shadow(0 0 20px rgba(250,204,21,0.95));
      }
      46% {
        transform: translate3d(calc(var(--atk-dx) * .94), calc(var(--atk-dy) * .94), 0) scale(1.46,1.1) rotate(calc(var(--atk-rot) * .3));
        filter: drop-shadow(0 0 28px rgba(220,38,38,1)) brightness(1.35);
      }
      62% {
        transform: translate3d(calc(var(--atk-dx) * .7), calc(var(--atk-dy) * .7 - 22px), 0) scale(1.18) rotate(calc(var(--atk-rot) * -.2));
        filter: drop-shadow(0 0 18px rgba(250,204,21,0.8));
      }
      100% {
        transform: translate3d(0,0,0) scale(1) rotate(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    /* パンドラ専用: 本体が光って2体に分かれ、敵をはさむ位置まで跳んで、両方から敵へ雷撃する。
       同時に敵の真上へ大きな落雷を落とし、閃光と輪を敵の位置に出して本体へ戻る。
       分身の位置・雷の長さと向きは attackAimVars の --pd-* が決める(敵の位置に合わせて毎回変わる)。 */
    .pandora-dual-thunder { position:relative; display:block; width:64px; height:64px; z-index:70; overflow:visible; pointer-events:none; }
    .pandora-dual-thunder img, .pandora-dual-thunder canvas { width:100%!important; height:100%!important; object-fit:contain; }
    .pandora-dual-center, .pandora-dual-clone { position:absolute; inset:0; display:block; }
    .pandora-dual-center { animation:pandoraDualCenter 900ms ease-in-out forwards; }
    .pandora-dual-clone { opacity:0; z-index:2; animation-duration:900ms; animation-timing-function:cubic-bezier(.2,.8,.2,1); animation-fill-mode:forwards; }
    .pandora-dual-clone--left { animation-name:pandoraDualLeft; }
    .pandora-dual-clone--right { animation-name:pandoraDualRight; }
    @keyframes pandoraDualCenter {
      0% { opacity:1; transform:scale(1); filter:none; }
      12% { opacity:1; transform:translateY(6px) scale(1.1,.88); filter:drop-shadow(0 0 10px #a855f7); }
      22% { opacity:1; transform:scale(1.16); filter:drop-shadow(0 0 18px #c084fc) brightness(1.7); }
      28%,80% { opacity:0; transform:scale(.8); filter:none; }
      90%,100% { opacity:1; transform:scale(1); filter:none; }
    }
    @keyframes pandoraDualLeft {
      0%,20% { opacity:0; transform:translate3d(0,0,0) scale(1) rotate(0deg); }
      26% { opacity:1; transform:translate3d(-12px,-4px,0) scale(1.06) rotate(-6deg); filter:drop-shadow(0 0 14px #c084fc); }
      40% { opacity:1; transform:translate3d(var(--pd-l-x),var(--pd-y),0) scale(.92) rotate(-10deg); filter:drop-shadow(18px 16px 0 rgba(168,85,247,.35)) drop-shadow(0 0 16px #a855f7); }
      48%,68% { opacity:1; transform:translate3d(var(--pd-l-x),calc(var(--pd-y) - 6px),0) scale(.95) rotate(0deg); filter:drop-shadow(0 0 20px #e9d5ff) drop-shadow(0 0 30px #a855f7); }
      82% { opacity:1; transform:translate3d(0,0,0) scale(.96) rotate(0deg); filter:drop-shadow(0 0 10px #a855f7); }
      90%,100% { opacity:0; transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    @keyframes pandoraDualRight {
      0%,20% { opacity:0; transform:translate3d(0,0,0) scale(1) rotate(0deg); }
      26% { opacity:1; transform:translate3d(12px,-4px,0) scale(1.06) rotate(6deg); filter:drop-shadow(0 0 14px #c084fc); }
      40% { opacity:1; transform:translate3d(var(--pd-r-x),var(--pd-y),0) scale(.92) rotate(10deg); filter:drop-shadow(-18px 16px 0 rgba(168,85,247,.35)) drop-shadow(0 0 16px #a855f7); }
      48%,68% { opacity:1; transform:translate3d(var(--pd-r-x),calc(var(--pd-y) - 6px),0) scale(.95) rotate(0deg); filter:drop-shadow(0 0 20px #e9d5ff) drop-shadow(0 0 30px #a855f7); }
      82% { opacity:1; transform:translate3d(0,0,0) scale(.96) rotate(0deg); filter:drop-shadow(0 0 10px #a855f7); }
      90%,100% { opacity:0; transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    /* 分身の手元にためる雷の玉 */
    .pandora-dual-orb {
      position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; opacity:0; border-radius:50%;
      background:radial-gradient(circle,#fff 0 22%,#e9d5ff 40%,rgba(168,85,247,.7) 62%,transparent 74%);
      box-shadow:0 0 12px #c084fc; animation:pandoraDualOrb 900ms ease-out forwards;
    }
    @keyframes pandoraDualOrb { 0%,38%{opacity:0;transform:scale(.2)} 46%{opacity:1;transform:scale(1.3)} 52%{opacity:.8;transform:scale(.9)} 60%{opacity:1;transform:scale(1.2)} 70%,100%{opacity:0;transform:scale(.4)} }
    /* 分身から敵へ向かう雷。付け根を分身の中心に置き、敵の向きへ回して敵までの長さに伸ばす */
    .pandora-dual-bolt {
      position:absolute; left:50%; top:50%; width:14px; height:var(--pd-l-len); opacity:0; transform-origin:50% 100%;
      transform:translate(-50%,-100%) rotate(var(--pd-l-rot));
      background:linear-gradient(to top,#c084fc,#fff 42%,#ddd6fe 72%,#fff);
      clip-path:polygon(45% 100%,0 69%,42% 70%,12% 42%,55% 47%,32% 0,100% 54%,59% 52%,91% 78%,55% 77%);
      filter:drop-shadow(0 0 5px #a855f7) drop-shadow(0 0 9px #fff); animation:pandoraDualBolt 900ms ease-out forwards;
    }
    .pandora-dual-clone--right .pandora-dual-bolt { height:var(--pd-r-len); transform:translate(-50%,-100%) rotate(var(--pd-r-rot)); }
    @keyframes pandoraDualBolt { 0%,46%{opacity:0} 50%{opacity:1} 55%{opacity:.3} 60%{opacity:1} 64%{opacity:.4} 68%{opacity:1} 74%,100%{opacity:0} }
    /* 敵の真上からの落雷と、敵の位置での閃光・輪 */
    .pandora-dual-strike { position:absolute; left:50%; top:50%; width:0; height:0; z-index:3; translate:var(--atk-dx) var(--atk-dy); }
    .pandora-dual-strike__bolt {
      position:absolute; left:-10px; bottom:0; width:20px; height:170px; opacity:0; transform-origin:50% 100%;
      background:linear-gradient(to top,#fff,#f5f3ff 30%,#c084fc 70%,rgba(168,85,247,0));
      clip-path:polygon(45% 100%,0 69%,42% 70%,12% 42%,55% 47%,32% 0,100% 54%,59% 52%,91% 78%,55% 77%);
      filter:drop-shadow(0 0 7px #a855f7) drop-shadow(0 0 14px #fff); animation:pandoraStrikeBolt 900ms ease-out forwards;
    }
    @keyframes pandoraStrikeBolt { 0%,52%{opacity:0;transform:scaleY(.15)} 56%{opacity:1;transform:scaleY(1)} 60%{opacity:.35} 63%{opacity:1} 72%,100%{opacity:0;transform:scaleY(1)} }
    .pandora-dual-strike__flash {
      position:absolute; left:-54px; top:-54px; width:108px; height:108px; opacity:0; border-radius:50%;
      background:radial-gradient(circle,#fff 0 10%,rgba(233,213,255,.95) 22%,rgba(168,85,247,.6) 44%,rgba(88,28,135,0) 72%);
      animation:pandoraStrikeFlash 900ms ease-out forwards;
    }
    @keyframes pandoraStrikeFlash { 0%,54%{opacity:0;transform:scale(.3)} 58%{opacity:1;transform:scale(1)} 70%{opacity:.7;transform:scale(1.5)} 84%,100%{opacity:0;transform:scale(2)} }
    .pandora-dual-strike__ring {
      position:absolute; left:-26px; top:-26px; width:52px; height:52px; opacity:0; border-radius:50%;
      border:4px solid rgba(245,243,255,.95); box-shadow:0 0 12px #fff,0 0 24px #a855f7;
      animation:pandoraStrikeRing 900ms ease-out forwards;
    }
    @keyframes pandoraStrikeRing { 0%,56%{opacity:0;transform:scale(.3)} 60%{opacity:1;transform:scale(.9)} 80%,100%{opacity:0;transform:scale(2.6)} }
    .pandora-dual-thunder--compact { width:38px; height:38px; }
    .pandora-dual-thunder--compact .pandora-dual-bolt { width:6px; }
    .pandora-dual-thunder--compact .pandora-dual-orb { width:14px; height:14px; margin:-7px 0 0 -7px; }
    .pandora-dual-thunder--compact .pandora-dual-strike__bolt { left:-6px; width:12px; height:90px; }
    .pandora-dual-thunder--compact .pandora-dual-strike__flash { left:-32px; top:-32px; width:64px; height:64px; }
    .pandora-dual-thunder--compact .pandora-dual-strike__ring { left:-16px; top:-16px; width:32px; height:32px; border-width:3px; }
    @media (prefers-reduced-motion: reduce) {
      .pandora-dual-clone--left, .pandora-dual-clone--right, .pandora-dual-strike__bolt, .pandora-dual-orb { animation:none; opacity:0; }
      .pandora-dual-center { animation:none; filter:drop-shadow(0 0 14px #a855f7); }
    }
    /* アーク専用の聖光攻撃。
       距離枠は固定したまま本体がふわりと浮遊し、敵上空の光輪から5本の聖光が時間差で降る。
       白・金・淡い青で神聖さを出し、着弾では大きな閃光と輪、光粒を残す。 */
    .ark-holy-rain { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:27; isolation:isolate; }
    .ark-holy-rain__monster {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:5;
      transform-origin:50% 70%; will-change:transform,filter;
      animation:arkHolyFloat 900ms cubic-bezier(.2,.72,.18,1) forwards;
    }
    .ark-holy-rain--empowered .ark-holy-rain__monster { animation-name:arkHolyFloatEmpowered; }
    .ark-holy-rain--charging .ark-holy-rain__monster { animation:arkHolyCharge 650ms cubic-bezier(.2,.72,.2,1) forwards; }
    .ark-holy-rain--charging .ark-holy-rain__rays,
    .ark-holy-rain--charging .ark-holy-rain__impact,
    .ark-holy-rain--charging .ark-holy-rain__sparkles { display:none; }
    @keyframes arkHolyCharge {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(255,255,255,.45)); }
      42% { transform:translate3d(-5px,-13px,0) scale(1.03) rotate(-2deg); filter:drop-shadow(0 0 15px rgba(253,230,138,.86)) drop-shadow(0 0 25px rgba(186,230,253,.64)); }
      72% { transform:translate3d(6px,-22px,0) scale(1.07) rotate(2deg); filter:drop-shadow(0 0 23px rgba(255,255,255,.98)) drop-shadow(0 0 34px rgba(250,204,21,.72)); }
      100% { transform:translate3d(0,-28px,0) scale(1.10) rotate(0deg); filter:drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 45px rgba(125,211,252,.78)) drop-shadow(0 0 58px rgba(250,204,21,.58)); }
    }
    @keyframes arkHolyFloat {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(255,255,255,.38)); }
      16% { transform:translate3d(-7px,-18px,0) scale(1.04) rotate(-2deg); filter:drop-shadow(0 0 14px rgba(254,240,138,.78)); }
      36% { transform:translate3d(8px,-31px,0) scale(1.07) rotate(3deg); filter:drop-shadow(0 0 24px rgba(255,255,255,.98)) drop-shadow(0 0 34px rgba(186,230,253,.72)); }
      56% { transform:translate3d(-6px,-35px,0) scale(1.08) rotate(-2deg); filter:drop-shadow(0 0 27px rgba(255,255,255,1)) drop-shadow(0 0 39px rgba(250,204,21,.68)); }
      74% { transform:translate3d(6px,-27px,0) scale(1.06) rotate(2deg); filter:drop-shadow(0 0 22px rgba(224,242,254,.92)); }
      88% { transform:translate3d(-3px,-12px,0) scale(1.03) rotate(-1deg); filter:drop-shadow(0 0 13px rgba(253,230,138,.72)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
    }
    @keyframes arkHolyFloatEmpowered {
      0% { transform:translate3d(0,-28px,0) scale(1.10) rotate(0deg); filter:drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 45px rgba(250,204,21,.7)); }
      18% { transform:translate3d(-9px,-34px,0) scale(1.12) rotate(-3deg); }
      38% { transform:translate3d(10px,-41px,0) scale(1.15) rotate(3deg); filter:drop-shadow(0 0 35px rgba(255,255,255,1)) drop-shadow(0 0 52px rgba(186,230,253,.92)); }
      58% { transform:translate3d(-8px,-43px,0) scale(1.16) rotate(-2deg); filter:drop-shadow(0 0 38px rgba(255,255,255,1)) drop-shadow(0 0 58px rgba(250,204,21,.88)); }
      76% { transform:translate3d(7px,-31px,0) scale(1.10) rotate(2deg); }
      90% { transform:translate3d(-3px,-13px,0) scale(1.04) rotate(-1deg); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
    }
    .ark-holy-rain__sky {
      position:absolute; left:50%; top:-184px; width:112px; height:34px; margin-left:-56px; z-index:3;
      opacity:0; transform-origin:center; will-change:transform,opacity;
      animation:arkHolySky 900ms ease-out forwards;
    }
    .ark-holy-rain--charging .ark-holy-rain__sky { animation:arkHolySkyCharge 650ms ease-out forwards; }
    .ark-holy-rain__sky i {
      position:absolute; inset:0; border:3px solid rgba(255,255,255,.95); border-radius:50%;
      box-shadow:0 0 8px rgba(255,255,255,1),0 0 18px rgba(250,204,21,.9),0 0 30px rgba(125,211,252,.72),inset 0 0 12px rgba(255,255,255,.72);
    }
    .ark-holy-rain__sky i:nth-child(2) { inset:7px 18px; border-width:2px; opacity:.9; }
    @keyframes arkHolySky {
      0%,8% { opacity:0; transform:scale(.35) rotate(-12deg); }
      24% { opacity:.96; transform:scale(1.05) rotate(4deg); }
      54% { opacity:1; transform:scale(1) rotate(-3deg); }
      76% { opacity:.82; transform:scale(1.10) rotate(5deg); }
      100% { opacity:0; transform:scale(1.28) rotate(9deg); }
    }
    @keyframes arkHolySkyCharge {
      0% { opacity:0; transform:scale(.3) rotate(-10deg); }
      48% { opacity:.68; transform:scale(.72) rotate(3deg); }
      100% { opacity:1; transform:scale(1) rotate(8deg); }
    }
    /* 光輪・光柱・着弾・光粒は「敵が -82px にいる」前提で組んである。敵の実際の位置までずらす */
    .ark-holy-rain__sky, .ark-holy-rain__rays, .ark-holy-rain__impact, .ark-holy-rain__sparkles { translate:var(--atk-dx) calc(var(--atk-dy) + 82px); }
    .ark-holy-rain__rays { position:absolute; inset:0; overflow:visible; z-index:4; }
    .ark-holy-rain__ray {
      position:absolute; top:-188px; width:18px; height:122px; margin-left:-9px; opacity:0;
      transform-origin:50% 0; border-radius:999px;
      background:linear-gradient(90deg,rgba(255,255,255,0),rgba(254,240,138,.78) 22%,#fff 48%,rgba(186,230,253,.94) 72%,rgba(255,255,255,0));
      box-shadow:0 0 9px rgba(255,255,255,1),0 0 20px rgba(250,204,21,.92),0 0 34px rgba(125,211,252,.74);
      filter:blur(.15px); will-change:transform,opacity;
      animation:arkHolyRay 300ms cubic-bezier(.12,.76,.22,1) forwards;
    }
    .ark-holy-rain__ray::before {
      content:''; position:absolute; left:50%; top:-12px; width:44px; height:28px; transform:translateX(-50%);
      border-radius:50%; background:radial-gradient(ellipse,rgba(255,255,255,.96),rgba(253,230,138,.58) 38%,transparent 72%);
      filter:blur(2px);
    }
    .ark-holy-rain--empowered .ark-holy-rain__ray { width:22px; margin-left:-11px; box-shadow:0 0 12px #fff,0 0 27px rgba(250,204,21,1),0 0 44px rgba(125,211,252,.9); }
    @keyframes arkHolyRay {
      0% { opacity:0; transform:rotate(var(--ark-ray-tilt)) scaleX(.4) scaleY(.12); }
      18% { opacity:1; }
      48% { opacity:1; transform:rotate(var(--ark-ray-tilt)) scaleX(var(--ark-ray-scale)) scaleY(1.08); }
      72% { opacity:.92; transform:rotate(var(--ark-ray-tilt)) scaleX(var(--ark-ray-scale)) scaleY(1.16); }
      100% { opacity:0; transform:rotate(var(--ark-ray-tilt)) scaleX(.72) scaleY(1.28); }
    }
    .ark-holy-rain__impact {
      position:absolute; left:50%; top:-82px; width:28px; height:28px; margin:-14px 0 0 -14px; z-index:7;
      opacity:0; will-change:transform,opacity; animation:arkHolyImpact 900ms ease-out forwards;
    }
    .ark-holy-rain__impact-core {
      position:absolute; inset:-48px; border-radius:50%;
      background:radial-gradient(circle,#fff 0 7%,rgba(254,240,138,.98) 14%,rgba(186,230,253,.76) 31%,rgba(250,204,21,.35) 52%,transparent 73%);
      filter:blur(.3px);
    }
    .ark-holy-rain__impact-ring {
      position:absolute; inset:-25px; border:3px solid rgba(255,255,255,.95); border-radius:50%;
      box-shadow:0 0 12px #fff,0 0 25px rgba(250,204,21,.92),0 0 40px rgba(125,211,252,.76);
    }
    .ark-holy-rain--empowered .ark-holy-rain__impact-core { inset:-60px; }
    .ark-holy-rain--empowered .ark-holy-rain__impact-ring { inset:-31px; border-width:4px; }
    @keyframes arkHolyImpact {
      0%,53% { opacity:0; transform:scale(.28); }
      58% { opacity:1; transform:scale(.66); }
      65% { opacity:1; transform:scale(1.18); }
      76% { opacity:.78; transform:scale(1.78); }
      88%,100% { opacity:0; transform:scale(2.45); }
    }
    .ark-holy-rain__sparkles { position:absolute; inset:0; overflow:visible; z-index:8; }
    .ark-holy-rain__spark {
      position:absolute; left:50%; top:-82px; margin:-3px 0 0 -3px; opacity:0;
      background:#fff; transform:rotate(45deg); border-radius:1px;
      box-shadow:0 0 7px #fff,0 0 13px rgba(250,204,21,.95),0 0 20px rgba(125,211,252,.72);
      will-change:transform,opacity; animation:arkHolySpark 300ms ease-out forwards;
    }
    .ark-holy-rain__spark::after { content:''; position:absolute; left:50%; top:-70%; width:1px; height:240%; background:rgba(255,255,255,.9); transform:translateX(-50%); }
    @keyframes arkHolySpark {
      0% { opacity:0; transform:translate3d(0,0,0) rotate(45deg) scale(.2); }
      24% { opacity:1; }
      68% { opacity:.92; transform:translate3d(var(--ark-spark-x),var(--ark-spark-y),0) rotate(135deg) scale(1.15); }
      100% { opacity:0; transform:translate3d(var(--ark-spark-x),var(--ark-spark-y),0) rotate(225deg) scale(.45); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ark-holy-rain__monster { animation:arkHolyFloatReduced 900ms ease-out forwards; }
      .ark-holy-rain--charging .ark-holy-rain__monster { animation:arkHolyChargeReduced 650ms ease-out forwards; }
      .ark-holy-rain__ray { animation:arkHolyRayReduced 300ms ease-out forwards; }
      .ark-holy-rain__sparkles { display:none; }
      @keyframes arkHolyFloatReduced { 0%{filter:none} 45%{filter:drop-shadow(0 0 22px rgba(255,255,255,.95))} 100%{filter:none} }
      @keyframes arkHolyChargeReduced { 0%{filter:none} 100%{filter:drop-shadow(0 0 28px rgba(255,255,255,.98))} }
      @keyframes arkHolyRayReduced { 0%{opacity:0} 35%{opacity:1} 100%{opacity:0} }
    }
    /* ウンディーネ種共通の水攻撃。
       距離枠は固定したまま本体だけを左右へ大きく滑らせ、水弾3発→大きな着弾飛沫までを680msで見せる。
       追加画像は使わず、攻撃中だけ出るCSS要素で水の尾・引き波・飛沫を描く。 */
    .water-burst-motion { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:26; isolation:isolate; }
    .water-burst-motion__monster {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:4;
      transform-origin:50% 70%; will-change:transform,filter;
      animation:waterBurstAttack 680ms cubic-bezier(.16,.78,.16,1) forwards;
    }
    .water-burst-motion--lunge .water-burst-motion__monster { animation-name:waterBurstLunge; }
    .water-burst-motion--charging .water-burst-motion__monster { animation:waterBurstCharge 650ms cubic-bezier(.2,.72,.2,1) forwards; }
    .water-burst-motion--charging .water-burst-motion__shots,
    .water-burst-motion--charging .water-burst-motion__impact { display:none; }
    @keyframes waterBurstCharge {
      0% { transform:translate3d(0,0,0) scale(1); filter:drop-shadow(0 0 5px rgba(103,232,249,.45)); }
      55% { transform:translate3d(0,12px,0) scale(.91,.84); filter:drop-shadow(0 0 18px rgba(34,211,238,.92)) drop-shadow(0 10px 20px rgba(37,99,235,.62)); }
      100% { transform:translate3d(0,16px,0) scale(.88,.80); filter:drop-shadow(0 0 28px rgba(255,255,255,.94)) drop-shadow(0 12px 28px rgba(14,165,233,.82)); }
    }
    /* 左右の滑りは --atk-side(敵が右なら1・左なら-1)ぶん敵の側へ寄せる。
       端の枠の子が外側へ滑ると画面の外へ半分出て、消えたように見えていた(2026-09-24 ユーザー指摘) */
    @keyframes waterBurstAttack {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(103,232,249,.5)); }
      10% { transform:translate3d(0,8px,0) scale(.95,.88) rotate(-2deg); filter:drop-shadow(0 0 15px rgba(34,211,238,.9)); }
      25% { transform:translate3d(calc(-44px + var(--atk-side) * 30px),-2px,0) scale(1.07) rotate(-7deg); filter:drop-shadow(24px 5px 0 rgba(125,211,252,.42)) drop-shadow(48px 8px 0 rgba(37,99,235,.18)) drop-shadow(0 0 22px rgba(103,232,249,.98)); }
      48% { transform:translate3d(calc(46px + var(--atk-side) * 30px),-8px,0) scale(1.10) rotate(7deg); filter:drop-shadow(-28px 4px 0 rgba(125,211,252,.42)) drop-shadow(-56px 8px 0 rgba(37,99,235,.18)) drop-shadow(0 0 27px rgba(255,255,255,.98)); }
      69% { transform:translate3d(calc(-32px + var(--atk-side) * 30px),-10px,0) scale(1.08) rotate(-5deg); filter:drop-shadow(24px 4px 0 rgba(103,232,249,.34)) drop-shadow(48px 7px 0 rgba(37,99,235,.15)) drop-shadow(0 0 23px rgba(34,211,238,.94)); }
      84% { transform:translate3d(calc(20px + var(--atk-side) * 30px),-4px,0) scale(1.04) rotate(3deg); filter:drop-shadow(-18px 3px 0 rgba(125,211,252,.28)) drop-shadow(0 0 17px rgba(103,232,249,.82)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes waterBurstLunge {
      0% { transform:translate3d(0,16px,0) scale(.88,.80) rotate(0deg); filter:drop-shadow(0 0 28px rgba(34,211,238,.95)); }
      18% { transform:translate3d(calc(-52px + var(--atk-side) * 30px),-4px,0) scale(1.11) rotate(-9deg); filter:drop-shadow(28px 5px 0 rgba(125,211,252,.5)) drop-shadow(58px 9px 0 rgba(37,99,235,.22)) drop-shadow(0 0 28px rgba(255,255,255,.98)); }
      43% { transform:translate3d(calc(52px + var(--atk-side) * 30px),-13px,0) scale(1.16) rotate(9deg); filter:drop-shadow(-32px 4px 0 rgba(125,211,252,.5)) drop-shadow(-64px 9px 0 rgba(37,99,235,.22)) drop-shadow(0 0 34px rgba(255,255,255,1)); }
      67% { transform:translate3d(calc(-38px + var(--atk-side) * 30px),-12px,0) scale(1.11) rotate(-6deg); filter:drop-shadow(28px 4px 0 rgba(103,232,249,.42)) drop-shadow(0 0 29px rgba(34,211,238,.98)); }
      84% { transform:translate3d(calc(24px + var(--atk-side) * 30px),-5px,0) scale(1.06) rotate(4deg); filter:drop-shadow(-20px 3px 0 rgba(125,211,252,.34)) drop-shadow(0 0 21px rgba(103,232,249,.9)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
    }
    .water-burst-motion__wake { position:absolute; inset:0; z-index:2; overflow:visible; }
    .water-burst-motion__wake i {
      position:absolute; left:50%; top:72%; width:38px; height:11px; margin:-5px 0 0 -19px; opacity:0;
      border:3px solid rgba(165,243,252,.9); border-radius:50%;
      box-shadow:0 0 9px rgba(34,211,238,.9), inset 0 0 7px rgba(255,255,255,.72);
      will-change:transform,opacity; animation:waterBurstWake 300ms ease-out forwards;
    }
    .water-burst-motion__wake i:nth-child(1) { --water-wake-x:-34px; animation-delay:70ms; }
    .water-burst-motion__wake i:nth-child(2) { --water-wake-x:36px; animation-delay:245ms; }
    .water-burst-motion__wake i:nth-child(3) { --water-wake-x:-24px; animation-delay:420ms; }
    @keyframes waterBurstWake {
      0% { opacity:0; transform:translate3d(var(--water-wake-x),0,0) scale(.35); }
      24% { opacity:1; }
      100% { opacity:0; transform:translate3d(var(--water-wake-x),5px,0) scale(1.85,.9); }
    }
    .water-burst-motion__shots { position:absolute; inset:0; overflow:visible; z-index:6; }
    .water-burst-motion__shot {
      position:absolute; top:42%; width:20px; height:28px; margin:-14px 0 0 -10px; opacity:0;
      border-radius:52% 48% 58% 42%;
      background:radial-gradient(circle at 35% 26%,#fff 0 12%,#bae6fd 20%,#22d3ee 54%,#2563eb 100%);
      border:1px solid rgba(255,255,255,.95);
      box-shadow:0 0 8px rgba(255,255,255,.98),0 0 18px rgba(34,211,238,.95),0 0 28px rgba(37,99,235,.72);
      will-change:transform,opacity; animation:waterBurstShot 300ms cubic-bezier(.12,.72,.2,1) forwards;
    }
    .water-burst-motion__shot::before {
      content:''; position:absolute; left:50%; top:72%; width:9px; height:58px; transform:translateX(-50%);
      border-radius:999px;
      background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(34,211,238,.72) 30%,rgba(37,99,235,.22) 72%,transparent);
      filter:blur(1px); box-shadow:0 0 7px rgba(103,232,249,.7); z-index:-1;
    }
    .water-burst-motion__shot::after {
      content:''; position:absolute; left:3px; top:3px; width:7px; height:9px; border-radius:50%;
      background:rgba(255,255,255,.95); filter:blur(.3px);
    }
    /* 水弾は敵の向き(--atk-rot)へ傾けて、敵の位置(--atk-dx/dy)まで一直線に飛び、当たって平たくつぶれる */
    @keyframes waterBurstShot {
      0% { opacity:0; transform:translate3d(-50%,18px,0) rotate(calc(var(--atk-rot) + var(--water-shot-angle))) scale(.45,.72); }
      14% { opacity:1; transform:translate3d(calc(-50% + var(--atk-dx) * .08),calc(var(--atk-dy) * .08),0) rotate(var(--atk-rot)) scale(1,1.2); }
      72% { opacity:1; transform:translate3d(calc(-50% + var(--atk-dx) + var(--water-shot-x)),calc(var(--atk-dy) + var(--water-shot-y)),0) rotate(var(--atk-rot)) scale(1.12,1.36); }
      100% { opacity:0; transform:translate3d(calc(-50% + var(--atk-dx) + var(--water-shot-x)),calc(var(--atk-dy) + var(--water-shot-y)),0) rotate(var(--atk-rot)) scale(1.9,.45); }
    }
    .water-burst-motion__impact {
      position:absolute; left:50%; top:50%; width:30px; height:30px; margin:-15px 0 0 -15px; translate:var(--atk-dx) var(--atk-dy);
      z-index:7; opacity:0; animation:waterBurstImpact 680ms ease-out forwards;
    }
    .water-burst-motion__impact-core {
      position:absolute; inset:-52px; border-radius:50%;
      background:radial-gradient(circle,rgba(255,255,255,1) 0 8%,rgba(186,230,253,.98) 16%,rgba(34,211,238,.72) 34%,rgba(37,99,235,.38) 52%,rgba(37,99,235,0) 74%);
      filter:blur(.4px);
    }
    .water-burst-motion__impact-ring {
      position:absolute; inset:-22px; border:4px solid rgba(224,242,254,.96); border-radius:50%;
      box-shadow:0 0 12px #fff,0 0 25px rgba(34,211,238,.95),0 0 42px rgba(37,99,235,.72);
    }
    @keyframes waterBurstImpact {
      0%,46% { opacity:0; transform:scale(.18); }
      50% { opacity:.9; transform:scale(.62); }
      60% { opacity:.8; transform:scale(1.05); }
      70% { opacity:.55; transform:scale(.9); }
      82% { opacity:1; transform:scale(1.55); }
      92% { opacity:.7; transform:scale(2.05); }
      100% { opacity:0; transform:scale(2.4); }
    }
    .water-burst-motion__drop {
      position:absolute; left:50%; top:50%; width:18px; height:7px; margin:-3.5px 0 0 -9px; opacity:0;
      border-radius:999px 65% 65% 999px;
      background:linear-gradient(90deg,#fff,#67e8f9 38%,#3b82f6 76%,transparent);
      box-shadow:0 0 7px rgba(125,211,252,.9);
      animation:waterBurstDrop 230ms ease-out forwards; animation-delay:calc(430ms + var(--water-drop-delay));
    }
    @keyframes waterBurstDrop {
      0% { opacity:0; transform:translate3d(0,0,0) rotate(var(--water-drop-angle)) scaleX(.35); }
      18% { opacity:1; }
      100% { opacity:0; transform:translate3d(var(--water-drop-x),var(--water-drop-y),0) rotate(var(--water-drop-angle)) scaleX(1.2); }
    }
    @media (prefers-reduced-motion: reduce) {
      .water-burst-motion__monster,
      .water-burst-motion--lunge .water-burst-motion__monster,
      .water-burst-motion--charging .water-burst-motion__monster { animation:waterBurstReduced 680ms ease-out forwards; }
      .water-burst-motion__shot { animation:waterBurstShotReduced 300ms ease-out forwards; }
      .water-burst-motion__wake i, .water-burst-motion__drop { display:none; }
      .water-burst-motion__impact { animation:waterBurstImpactReduced 680ms ease-out forwards; }
      @keyframes waterBurstReduced {
        0% { filter:drop-shadow(0 0 4px rgba(103,232,249,.35)); }
        45% { filter:drop-shadow(0 0 24px rgba(34,211,238,.95)); }
        100% { filter:none; }
      }
      @keyframes waterBurstShotReduced {
        0% { opacity:0; transform:translate3d(-50%,4px,0) scale(.6); }
        35% { opacity:1; }
        100% { opacity:0; transform:translate3d(-50%,-24px,0) scale(1); }
      }
      @keyframes waterBurstImpactReduced {
        0%,62% { opacity:0; transform:scale(.5); }
        72% { opacity:.9; transform:scale(1); }
        100% { opacity:0; transform:scale(1.35); }
      }
    }
    /* ミーアの歌攻撃(miaSongNotes)。
       距離枠は動かさず、本体だけが少し前へ出てリズムを取り、手前にマイクスタンドを出して
       音符を4つ時間差で敵へ飛ばす。追加画像は使わず、攻撃中だけ出るCSS要素で
       マイク・音符・着弾の音の輪を描く(終わるとDOMごと消える)。
       大きさは枠に対する%で決めてあるので、バトル(64px)・図鑑・デバッグのどの枠でも同じ見え方になる。 */
    .mia-song-notes { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:26; isolation:isolate; }
    .mia-song-notes__monster {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:4;
      transform-origin:50% 78%; will-change:transform,filter;
      animation:miaSongSing 760ms cubic-bezier(.22,.72,.24,1) forwards;
    }
    .mia-song-notes--lunge .mia-song-notes__monster { animation-name:miaSongSingLunge; }
    .mia-song-notes--charging .mia-song-notes__monster { animation:miaSongCharge 650ms cubic-bezier(.2,.72,.2,1) forwards; }
    /* タメ(固有技の共通の下沈み)のあいだは歌わない。マイクも音符も着弾も出さない */
    .mia-song-notes--charging .mia-song-notes__mic,
    .mia-song-notes--charging .mia-song-notes__notes,
    .mia-song-notes--charging .mia-song-notes__stage,
    .mia-song-notes--charging .mia-song-notes__impact { display:none; }
    @keyframes miaSongCharge {
      0% { transform:translate3d(0,0,0) scale(1); filter:drop-shadow(0 0 5px rgba(244,114,182,.45)); }
      55% { transform:translate3d(0,12px,0) scale(.91,.84); filter:drop-shadow(0 0 18px rgba(236,72,153,.92)) drop-shadow(0 10px 20px rgba(168,85,247,.6)); }
      100% { transform:translate3d(0,16px,0) scale(.88,.80); filter:drop-shadow(0 0 28px rgba(255,255,255,.94)) drop-shadow(0 12px 28px rgba(217,70,239,.82)); }
    }
    /* 歌う本体。敵へは向かわず、その場で歌う(2026-09-24 ユーザー指摘「音符を飛ばすときにミーアも一緒に
       アタック気味になっている。意図と違う」)。攻撃するのは音符と音の波だけで、本人は動かない。
       しゃがんで小さく跳ね、左右へ体を揺らして拍を取り、元の位置へ戻る。
       (左右反転で回すと幅が0を通って一瞬消えて見えるので使わない) */
    @keyframes miaSongSing {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(244,114,182,.5)); }
      9% { transform:translate3d(0,5px,0) scale(1.06,.9) rotate(0deg); filter:drop-shadow(0 0 12px rgba(244,114,182,.8)); }
      20% { transform:translate3d(0,-10px,0) scale(1.05) rotate(-7deg); filter:drop-shadow(0 0 20px rgba(255,255,255,.95)); }
      34% { transform:translate3d(-4px,-3px,0) scale(1.04) rotate(-5deg); filter:drop-shadow(0 0 22px rgba(236,72,153,.95)); }
      48% { transform:translate3d(4px,-8px,0) scale(1.06) rotate(5deg); filter:drop-shadow(0 0 26px rgba(255,255,255,.98)); }
      62% { transform:translate3d(-4px,-3px,0) scale(1.04) rotate(-5deg); filter:drop-shadow(0 0 22px rgba(192,132,252,.95)); }
      76% { transform:translate3d(4px,-7px,0) scale(1.05) rotate(4deg); filter:drop-shadow(0 0 24px rgba(244,114,182,.92)); }
      90% { transform:translate3d(0,-3px,0) scale(1.02) rotate(0deg); filter:drop-shadow(0 0 12px rgba(244,114,182,.6)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    /* 固有技のタメ明け。沈んだ位置からその場で高く跳ね、通常より大きく体を揺らして歌う(敵へは向かわない) */
    @keyframes miaSongSingLunge {
      0% { transform:translate3d(0,16px,0) scale(.88,.80) rotate(0deg); filter:drop-shadow(0 0 28px rgba(236,72,153,.95)); }
      18% { transform:translate3d(0,-16px,0) scale(1.1) rotate(-9deg); filter:drop-shadow(0 0 32px rgba(255,255,255,1)); }
      32% { transform:translate3d(-6px,-4px,0) scale(1.08) rotate(-7deg); filter:drop-shadow(0 0 28px rgba(236,72,153,.98)); }
      46% { transform:translate3d(6px,-12px,0) scale(1.1) rotate(7deg); filter:drop-shadow(0 0 34px rgba(255,255,255,1)); }
      62% { transform:translate3d(-6px,-4px,0) scale(1.08) rotate(-6deg); filter:drop-shadow(0 0 28px rgba(192,132,252,.98)); }
      78% { transform:translate3d(6px,-10px,0) scale(1.09) rotate(5deg); filter:drop-shadow(0 0 26px rgba(244,114,182,.94)); }
      92% { transform:translate3d(0,-4px,0) scale(1.03) rotate(0deg); filter:drop-shadow(0 0 13px rgba(244,114,182,.62)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
    }
    /* 足元のステージ光。床に置いた光の輪を2つ、拍に合わせて広げる */
    .mia-song-notes__stage { position:absolute; inset:0; z-index:2; overflow:visible; }
    .mia-song-notes__stage i {
      position:absolute; left:50%; top:76%; width:46%; height:14%; margin-left:-23%; opacity:0;
      border:2px solid rgba(249,168,212,.9); border-radius:50%;
      box-shadow:0 0 10px rgba(236,72,153,.9), inset 0 0 8px rgba(255,255,255,.7);
      will-change:transform,opacity; animation:miaSongStage 380ms ease-out forwards;
    }
    .mia-song-notes__stage i:nth-child(1) { animation-delay:60ms; }
    .mia-song-notes__stage i:nth-child(2) { animation-delay:340ms; }
    @keyframes miaSongStage {
      0% { opacity:0; transform:scale(.4); }
      26% { opacity:1; }
      100% { opacity:0; transform:scale(1.9,1.15); }
    }
    /* マイクスタンド。ミーアの手前・やや左に立て、本体は隠さない */
    .mia-song-notes__mic {
      position:absolute; left:9%; bottom:2%; width:25%; height:60%; z-index:6;
      opacity:0; transform-origin:50% 100%; will-change:transform,opacity;
      animation:miaSongMicPop 760ms cubic-bezier(.2,1.4,.36,1) forwards;
    }
    @keyframes miaSongMicPop {
      0% { opacity:0; transform:translate3d(0,10px,0) scale(.35); }
      9% { opacity:1; transform:translate3d(0,0,0) scale(1.16); }
      16% { transform:translate3d(0,0,0) scale(.96); }
      24%,84% { opacity:1; transform:translate3d(0,0,0) scale(1); }
      100% { opacity:0; transform:translate3d(0,6px,0) scale(.82); }
    }
    /* マイク本体。ホルダーに斜めに留まった形にすると、小さくてもマイクスタンドだと分かる。
       上が網目のグリル、下が黒いハンドル、その境目に銀のリング。 */
    .mia-song-notes__mic-body {
      position:absolute; left:50%; top:0; width:41%; height:37%; margin-left:-20.5%;
      transform:rotate(-19deg); transform-origin:50% 100%;
      border-radius:50% 50% 40% 40% / 34% 34% 22% 22%;
      background:
        repeating-linear-gradient(180deg,rgba(15,23,42,.5) 0 1px,rgba(255,255,255,.34) 1px 2px) top/100% 48% no-repeat,
        linear-gradient(180deg,#e2e8f0 0 48%,#111827 48%,#020617 100%);
      border:1px solid rgba(255,255,255,.7);
      box-shadow:0 0 8px rgba(244,114,182,.9),0 0 16px rgba(236,72,153,.6),inset -1px 0 2px rgba(0,0,0,.5);
    }
    /* グリルの丸みと光沢 */
    .mia-song-notes__mic-body::before {
      content:''; position:absolute; left:14%; top:6%; width:30%; height:26%;
      border-radius:50%; background:rgba(255,255,255,.85); filter:blur(1px);
    }
    /* グリルとハンドルの境目にある銀のリング */
    .mia-song-notes__mic-body::after {
      content:''; position:absolute; left:50%; top:45%; width:106%; height:7%; margin-left:-53%;
      border-radius:999px; background:linear-gradient(180deg,#f8fafc,#64748b);
    }
    /* マイクの下部を抱えるホルダー */
    .mia-song-notes__mic-clip {
      position:absolute; left:50%; top:30%; width:34%; height:12%; margin-left:-17%;
      transform:rotate(-19deg);
      border-radius:999px 999px 3px 3px;
      background:linear-gradient(180deg,#cbd5e1,#1e293b);
      box-shadow:0 0 5px rgba(226,232,240,.65);
    }
    /* 支柱。ジョイントより上を細くして、伸縮するスタンドらしくする */
    .mia-song-notes__mic-pole {
      position:absolute; left:50%; top:56%; width:13%; height:40%; margin-left:-6.5%;
      border-radius:2px;
      background:linear-gradient(90deg,#475569,#f1f5f9 40%,#cbd5e1 60%,#334155);
      box-shadow:0 0 7px rgba(226,232,240,.7);
    }
    .mia-song-notes__mic-pole--upper {
      top:33%; height:24%; width:8%; margin-left:-4%; box-shadow:none;
    }
    /* 高さ調整のジョイント。ここがあると「スタンド」に見える */
    .mia-song-notes__mic-joint {
      position:absolute; left:50%; top:53%; width:23%; height:6%; margin-left:-11.5%;
      border-radius:999px; background:linear-gradient(180deg,#f8fafc,#334155);
    }
    /* 重い円形の台座。上面の楕円と、その下の暗い縁で厚みを出す */
    .mia-song-notes__mic-base {
      position:absolute; left:50%; bottom:3%; width:104%; height:9%; margin-left:-52%;
      border-radius:50%;
      background:linear-gradient(180deg,#f1f5f9,#64748b);
      box-shadow:0 0 10px rgba(236,72,153,.8),inset 0 1px 2px rgba(255,255,255,.7);
    }
    .mia-song-notes__mic-base::after {
      content:''; position:absolute; left:2%; top:38%; width:96%; height:100%;
      border-radius:50%; background:linear-gradient(180deg,#334155,#020617); z-index:-1;
    }
    /* 敵へ飛ぶ音符。4つを時間差・別々の高さと大きさで流す */
    .mia-song-notes__notes { position:absolute; inset:0; overflow:visible; z-index:7; }
    .mia-song-notes__note {
      position:absolute; top:38%; opacity:0; font-style:normal; font-weight:900; line-height:1;
      text-shadow:0 0 6px #fff,0 0 14px rgba(236,72,153,.95),0 0 26px rgba(168,85,247,.75);
      will-change:transform,opacity; animation:miaSongNoteFly 400ms cubic-bezier(.3,.6,.4,1) forwards;
    }
    /* 音符のうしろに残る短い光の尾 */
    .mia-song-notes__note::after {
      content:''; position:absolute; left:50%; top:58%; width:.22em; height:1.1em; transform:translateX(-50%);
      border-radius:999px;
      background:linear-gradient(180deg,rgba(255,255,255,.8),rgba(244,114,182,.55) 40%,transparent);
      filter:blur(.6px); z-index:-1;
    }
    @keyframes miaSongNoteFly {
      0% { opacity:0; transform:translate3d(-50%,14px,0) rotate(0deg) scale(.45); }
      14% { opacity:1; transform:translate3d(calc(-50% + var(--mia-note-x) * .5),-6px,0) rotate(calc(var(--mia-note-spin) * .3)) scale(1.1); }
      42% { opacity:1; transform:translate3d(calc(-50% + var(--atk-dx) * .38 + var(--mia-note-x)),calc(var(--atk-dy) * .38 + var(--mia-note-y)),0) rotate(var(--mia-note-spin)) scale(1.26); }
      72% { opacity:1; transform:translate3d(calc(-50% + var(--atk-dx) * .76 - var(--mia-note-x) * .6),calc(var(--atk-dy) * .76 + var(--mia-note-y) * .5),0) rotate(calc(var(--mia-note-spin) * -1)) scale(1.2); }
      100% { opacity:0; transform:translate3d(calc(-50% + var(--atk-dx)),var(--atk-dy),0) rotate(0deg) scale(.7); }
    }
    /* 敵の向きへ走る音の波。入れ物を敵の向き(--atk-rot)へ回し、波はその中をまっすぐ敵の距離(--atk-len)まで進む */
    .mia-song-notes__waves { position:absolute; left:50%; top:42%; width:0; height:0; z-index:5; rotate:var(--atk-rot); }
    .mia-song-notes__waves i {
      position:absolute; left:-22px; top:-12px; width:44px; height:24px; opacity:0;
      border-top:4px solid rgba(251,207,232,.95); border-radius:50% 50% 0 0 / 100% 100% 0 0;
      filter:drop-shadow(0 0 5px rgba(236,72,153,.95)) drop-shadow(0 0 10px rgba(168,85,247,.7));
      will-change:transform,opacity; animation:miaSongWave 400ms ease-out forwards;
    }
    .mia-song-notes__waves i:nth-child(1) { animation-delay:120ms; }
    .mia-song-notes__waves i:nth-child(2) { animation-delay:235ms; }
    .mia-song-notes__waves i:nth-child(3) { animation-delay:350ms; }
    @keyframes miaSongWave {
      0% { opacity:0; transform:translate3d(0,0,0) scale(.4); }
      20% { opacity:1; }
      85% { opacity:.85; }
      100% { opacity:0; transform:translate3d(0,calc(var(--atk-len) * -1),0) scale(2.3,1.7); }
    }
    .mia-song-notes--charging .mia-song-notes__waves { display:none; }
    /* 敵側の着弾。音の輪を2度ひろげ、光とキラキラで当たったことを分かるようにする */
    .mia-song-notes__impact {
      position:absolute; left:50%; top:50%; width:30px; height:30px; margin:-15px 0 0 -15px; z-index:8;
      translate:var(--atk-dx) var(--atk-dy);
    }
    .mia-song-notes__impact-core {
      position:absolute; inset:-52px; border-radius:50%; opacity:0;
      background:radial-gradient(circle,rgba(255,255,255,1) 0 8%,rgba(251,207,232,.98) 18%,rgba(236,72,153,.66) 36%,rgba(168,85,247,.34) 54%,rgba(168,85,247,0) 76%);
      filter:blur(.4px); animation:miaSongImpactCore 760ms ease-out forwards;
    }
    @keyframes miaSongImpactCore {
      0%,58% { opacity:0; transform:scale(.2); }
      63% { opacity:1; transform:scale(.7); }
      76% { opacity:1; transform:scale(1.3); }
      90% { opacity:.72; transform:scale(1.8); }
      100% { opacity:0; transform:scale(2.2); }
    }
    .mia-song-notes__impact-ring {
      position:absolute; inset:-22px; border:4px solid rgba(253,242,248,.96); border-radius:50%; opacity:0;
      box-shadow:0 0 12px #fff,0 0 24px rgba(236,72,153,.95),0 0 40px rgba(168,85,247,.7);
      animation:miaSongImpactRing 220ms ease-out forwards; animation-delay:450ms;
    }
    .mia-song-notes__impact-ring--late { animation-delay:540ms; border-color:rgba(233,213,255,.94); }
    @keyframes miaSongImpactRing {
      0% { opacity:0; transform:scale(.3); }
      24% { opacity:1; transform:scale(.9); }
      100% { opacity:0; transform:scale(2.15); }
    }
    .mia-song-notes__spark {
      position:absolute; left:50%; top:50%; margin:-3px 0 0 -3px; opacity:0; border-radius:50%;
      background:radial-gradient(circle,#fff 0 34%,rgba(244,114,182,.95) 62%,rgba(168,85,247,0) 100%);
      box-shadow:0 0 8px rgba(255,255,255,.95);
      animation:miaSongSpark 260ms ease-out forwards; animation-delay:calc(460ms + var(--mia-spark-delay));
    }
    @keyframes miaSongSpark {
      0% { opacity:0; transform:translate3d(0,0,0) scale(.4); }
      22% { opacity:1; transform:translate3d(calc(var(--mia-spark-x) * .4),calc(var(--mia-spark-y) * .4),0) scale(1.1); }
      100% { opacity:0; transform:translate3d(var(--mia-spark-x),var(--mia-spark-y),0) scale(.5); }
    }
    /* 動きを減らす設定のときは、移動を抑えて光と音符の淡い上昇だけにする */
    @media (prefers-reduced-motion: reduce) {
      .mia-song-notes__monster,
      .mia-song-notes--lunge .mia-song-notes__monster,
      .mia-song-notes--charging .mia-song-notes__monster { animation:miaSongReduced 760ms ease-out forwards; }
      .mia-song-notes__mic { animation:miaSongMicReduced 760ms ease-out forwards; }
      .mia-song-notes__note { animation:miaSongNoteReduced 460ms ease-out forwards; }
      .mia-song-notes__stage i, .mia-song-notes__spark, .mia-song-notes__waves { display:none; }
      .mia-song-notes__impact-ring { animation:miaSongImpactRingReduced 340ms ease-out forwards; }
      @keyframes miaSongReduced {
        0% { filter:drop-shadow(0 0 4px rgba(244,114,182,.35)); }
        45% { filter:drop-shadow(0 0 24px rgba(236,72,153,.95)); }
        100% { filter:none; }
      }
      @keyframes miaSongMicReduced {
        0% { opacity:0; } 12%,84% { opacity:1; } 100% { opacity:0; }
      }
      @keyframes miaSongNoteReduced {
        0% { opacity:0; transform:translate3d(-50%,4px,0) scale(.7); }
        35% { opacity:1; }
        100% { opacity:0; transform:translate3d(-50%,-28px,0) scale(1); }
      }
      @keyframes miaSongImpactRingReduced {
        0% { opacity:0; transform:scale(.6); }
        30% { opacity:.9; transform:scale(1); }
        100% { opacity:0; transform:scale(1.4); }
      }
    }
    /* 味方モンスターの待機アニメ(24-battle-fx.jsx の MonsterIdleArt)。
       同じ絵を「体」と「部分(翼・しっぽ・耳・花…)」に切り抜いて重ね、部分を付け根(transform-origin)を軸に動かす。
       全体の動きは種ごとに1つ(mon-idle--hover など)。動かすのは transform だけなので、レイアウトを作り直さない。
       部分ごとの大きさ(--idle-amp)・周期・ずらしは MONSTER_IDLE_RIGS から style で渡る */
    .mon-idle { position:relative; display:block; will-change:transform; transform-origin:50% 96%; }
    .mon-idle--rig { filter:drop-shadow(0 4px 3px rgb(0 0 0 / .07)) drop-shadow(0 2px 2px rgb(0 0 0 / .06)); }
    .mon-idle__body { position:relative; display:block; z-index:1; }
    .mon-idle__part { position:absolute; inset:0; display:block; z-index:0; will-change:transform;
      animation-timing-function:ease-in-out; animation-iteration-count:infinite; }
    .mon-idle__part--front { z-index:2; }
    /* 図鑑の立ち絵は大きさを持たない(w-full h-full)ので、入れ物いっぱいに広げる */
    .mon-idle--fill, .mon-idle--fill > .mon-idle__body { width:100%; height:100%; }
    .mon-idle__part--flapL, .mon-idle__part--flapR { animation-name:monIdleFlap; animation-timing-function:cubic-bezier(.45,0,.35,1); }
    .mon-idle__part--flapR { --idle-flip:-1; }
    .mon-idle__part--swing { animation-name:monIdleSwing; }
    .mon-idle__part--wag { animation-name:monIdleWag; }
    .mon-idle__part--twitch { animation-name:monIdleTwitch; }
    .mon-idle__part--bob { animation-name:monIdleBob; }
    /* 羽ばたき。すばやく振り上げてゆっくり下ろす。振り上げたときは奥へ倒れるぶん少し細くする。
       右の翼は --idle-flip で向きを逆にする(同じ keyframes を左右で使う) */
    @keyframes monIdleFlap {
      0%,100% { transform:rotate(calc(var(--idle-amp) * -.2 * var(--idle-flip, 1))) scaleX(1); }
      38% { transform:rotate(calc(var(--idle-amp) * var(--idle-flip, 1))) scaleX(.9); }
    }
    /* ゆったり揺れる(花・ヒレ・腕の刃)。amp の符号で揺れ始めの向きが変わる */
    @keyframes monIdleSwing {
      0%,100% { transform:rotate(calc(var(--idle-amp) * -.4)); }
      50% { transform:rotate(var(--idle-amp)); }
    }
    /* しっぽ振り。左右へ同じだけ */
    @keyframes monIdleWag {
      0%,100% { transform:rotate(calc(var(--idle-amp) * -1)); }
      50% { transform:rotate(var(--idle-amp)); }
    }
    /* ときどきピクッと動く(耳)。ほとんどの時間は止まっている */
    @keyframes monIdleTwitch {
      0%,78%,100% { transform:rotate(0deg); }
      82% { transform:rotate(var(--idle-amp)); }
      86% { transform:rotate(0deg); }
      90% { transform:rotate(calc(var(--idle-amp) * .6)); }
      94% { transform:rotate(0deg); }
    }
    /* 上下にふわふわ(浮いている玉など)。--idle-bob は枠に対する % */
    @keyframes monIdleBob {
      0%,100% { transform:translate3d(0,0,0); }
      50% { transform:translate3d(0,var(--idle-bob),0); }
    }
    /* 全体の動き */
    .mon-idle--hover { animation:monIdleHover 2600ms ease-in-out infinite; }
    .mon-idle--bounce { animation:monIdleBounce 1800ms ease-in-out infinite; }
    .mon-idle--breathe { animation:monIdleBreathe 3200ms ease-in-out infinite; }
    .mon-idle--sway { animation:monIdleSway 3000ms ease-in-out infinite; }
    .mon-idle--swim { animation:monIdleSwim 2800ms ease-in-out infinite; }
    .mon-idle--jelly { animation:monIdleJelly 2000ms ease-in-out infinite; }
    .mon-idle--hop { animation:monIdleHop 2800ms ease-in-out infinite; }
    .mon-idle--heavy { animation:monIdleHeavy 3600ms ease-in-out infinite; }
    .mon-idle--glide { animation:monIdleGlide 3200ms ease-in-out infinite; }
    .mon-idle--drift { animation:monIdleDrift 4200ms ease-in-out infinite; transform-origin:50% 50%; }
    /* 宙に浮いている子。ゆっくり上下してわずかに伸び縮みする */
    @keyframes monIdleHover {
      0%,100% { transform:translate3d(0,0,0) scale(1,1); }
      50% { transform:translate3d(0,-4%,0) scale(.99,1.015); }
    }
    /* 地面に立っている丸い子。足元を軸に、つぶれて・伸びて・小さく弾む */
    @keyframes monIdleBounce {
      0%,100% { transform:translate3d(0,0,0) scale(1,1); }
      20% { transform:translate3d(0,0,0) scale(1.04,.95); }
      45% { transform:translate3d(0,-3%,0) scale(.97,1.04); }
      65% { transform:translate3d(0,0,0) scale(1.02,.98); }
    }
    /* どっしり立っている子。胸がふくらむように、縦へわずかに伸び縮みする */
    @keyframes monIdleBreathe {
      0%,100% { transform:translate3d(0,0,0) scale(1,1); }
      50% { transform:translate3d(0,-1%,0) scale(1.015,1.04); }
    }
    /* ↓ 待機が地味だった子の動き(2026-09-25 ユーザー指示「待機中の動きが地味なモンスターがいるからもう少し改良したい」)。
       どれも足元(transform-origin 50% 96%)を軸にするので、地面から離れて見えない */
    /* ぷるぷるの子(モッチー・剣士モッチー)。つぶれて、ぴょんと伸びて、ぷるんと揺れて止まる */
    @keyframes monIdleJelly {
      0%,100% { transform:translate3d(0,0,0) scale(1,1); }
      14% { transform:translate3d(0,0,0) scale(1.07,.92); }
      32% { transform:translate3d(0,-3.5%,0) scale(.95,1.06); }
      48% { transform:translate3d(0,0,0) scale(1.05,.95); }
      58% { transform:translate3d(0,0,0) scale(.98,1.03); }
      68% { transform:translate3d(0,0,0) scale(1.01,.99); }
    }
    /* 跳ねる子(スエゾー)。しっぽでぴょんと跳び、左右を見回すように交互に傾く */
    @keyframes monIdleHop {
      0%,50%,100% { transform:translate3d(0,0,0) rotate(0) scale(1,1); }
      8%,58% { transform:translate3d(0,0,0) rotate(0) scale(1.08,.9); }
      20% { transform:translate3d(0,-10%,0) rotate(-6deg) scale(.95,1.06); }
      70% { transform:translate3d(0,-10%,0) rotate(6deg) scale(.95,1.06); }
      32%,82% { transform:translate3d(0,0,0) rotate(0) scale(1.06,.93); }
      40%,90% { transform:translate3d(0,0,0) rotate(0) scale(.98,1.02); }
    }
    /* 重たい子(ゴーレム)。左右へ体重を移し、真ん中で胸をふくらませる */
    @keyframes monIdleHeavy {
      0%,100% { transform:translate3d(0,0,0) rotate(0) scale(1,1); }
      25% { transform:translate3d(-1.2%,0,0) rotate(-2deg) scale(1,1); }
      50% { transform:translate3d(0,-1.2%,0) rotate(0) scale(1.02,1.035); }
      75% { transform:translate3d(1.2%,0,0) rotate(2deg) scale(1,1); }
    }
    /* 翼で滑るように浮く子(アーク・エイキ)。大きく浮き沈みしながら、ゆったり傾く */
    @keyframes monIdleGlide {
      0%,100% { transform:translate3d(0,0,0) rotate(-2deg) scale(1,1); }
      50% { transform:translate3d(0,-6%,0) rotate(2deg) scale(.99,1.02); }
    }
    /* 宙を漂う子(モノリス)。ゆっくり大きく浮き沈みし、ふらりと回る */
    @keyframes monIdleDrift {
      0%,100% { transform:translate3d(0,0,0) rotate(-4deg); }
      50% { transform:translate3d(0,-8%,0) rotate(4deg); }
    }
    /* 植物の子。足元を軸に、左右へゆっくり傾く */
    @keyframes monIdleSway {
      0%,100% { transform:rotate(-2deg); }
      50% { transform:rotate(2deg); }
    }
    /* 人魚の子。水の中にいるように、上下しながら少し傾く */
    @keyframes monIdleSwim {
      0%,100% { transform:translate3d(0,0,0) rotate(-1.5deg); }
      50% { transform:translate3d(0,-3%,0) rotate(1.5deg); }
    }
    /* 軽量な見た目(タクティクスの calm)と「動きを減らす」設定では止める(絵はそのまま見える) */
    /* data-idle-own(図鑑)は自分のページのボタンで止めるので、ここでは止めない */
    [data-tactics-look="calm"] .mon-idle:not([data-idle-own]), [data-tactics-look="calm"] .mon-idle:not([data-idle-own]) .mon-idle__part { animation:none; }
    /* 画面全体の calm(軽量表示・「待機中の動き：止める」) */
    [data-phase-look="calm"] .mon-idle:not([data-idle-own]), [data-phase-look="calm"] .mon-idle:not([data-idle-own]) .mon-idle__part { animation:none; }
    @media (prefers-reduced-motion: reduce) {
      .mon-idle:not([data-idle-own]), .mon-idle:not([data-idle-own]) .mon-idle__part { animation:none; }
    }
    /* エイキの桜。攻撃モーションが出ているあいだだけ描画され、終わるとDOMごと消える。
       常時アニメーションを増やさないため、@keyframes は1本・要素は12枚に固定してある。
       transform と opacity だけを動かすので、低性能端末でもレイアウトを作り直さない。 */
    .eiki-sakura {
      position: absolute;
      inset: 0;
      /* 実戦の全身枠は約64pxしかない。斬撃方向へ流れる花びらをここで切ると、
         zanComboDash の移動と重なった瞬間にほぼ見えなくなるため、枠外にも描く。 */
      overflow: visible;
      pointer-events: none;
      z-index: 20;
    }
    .eiki-sakura__petal {
      position: absolute;
      opacity: 0;
      border-radius: 75% 15% 70% 20%;
      background: linear-gradient(145deg, #fff7fb 0%, #f9a8d4 42%, #ec4899 100%);
      box-shadow: 0 0 2px rgba(255, 255, 255, .95), 0 0 5px rgba(236, 72, 153, .9);
      transform-origin: 70% 70%;
      will-change: transform, opacity;
      animation: eikiSakuraFall 430ms cubic-bezier(.2,.72,.28,1) forwards;
    }
    @keyframes eikiSakuraFall {
      0%   { opacity: 0; transform: translate3d(-22px, 16px, 0) rotate(0deg) scale(.45); }
      18%  { opacity: .95; }
      52%  { opacity: 1; transform: translate3d(var(--eiki-petal-flow-x), var(--eiki-petal-flow-y), 0) rotate(var(--eiki-petal-spin-mid)) scale(.9); }
      68%  { opacity: 1; transform: translate3d(var(--eiki-petal-burst-x), var(--eiki-petal-burst-y), 0) rotate(var(--eiki-petal-spin-burst)) scale(1.25); }
      100% { opacity: 0; transform: translate3d(var(--eiki-petal-trail-x), var(--eiki-petal-trail-y), 0) rotate(var(--eiki-petal-spin)) scale(.65); }
    }
    /* 動きを減らす設定の端末では、花びらを流さず淡く出して消えるだけにする */
    @media (prefers-reduced-motion: reduce) {
      .eiki-sakura__petal { animation: eikiSakuraFade 430ms ease-out forwards; }
      @keyframes eikiSakuraFade {
        0% { opacity: 0; } 30% { opacity: .9; } 100% { opacity: 0; }
      }
    }
    /* 剣士モッチーの二刀流。
       その場で小さく振る旧演出ではなく、いったん沈んでから敵位置(--atk-dx/dy)まで高速で斬り込み、
       ＼で通り抜け→反転→／で切り返し→敵位置で巨大X字を光らせて帰還する。
       本体の残像は画像複製ではなく drop-shadow で軽く作り、追加DOMは攻撃中の固定要素だけ。
       永久追加連撃が増えても本体フルモーションは1攻撃1セットなので戦闘時間は増えない。 */
    @keyframes kenshiTwinBladeSlash {
      0% {
        transform: translate3d(0,0,0) scale(1) rotate(0deg);
        filter: drop-shadow(0 0 4px rgba(148,163,184,.45));
      }
      9% {
        transform: translate3d(0,10px,0) scale(.95) rotate(-3deg);
        filter: drop-shadow(0 0 13px rgba(139,92,246,.9)) drop-shadow(0 0 18px rgba(34,211,238,.72));
      }
      23% {
        transform: translate3d(calc(var(--atk-dx) + 68px),calc(var(--atk-dy) + 54px),0) scale(1.11) rotate(-13deg) skewX(-8deg);
        filter:
          drop-shadow(-28px 42px 0 rgba(139,92,246,.34))
          drop-shadow(-54px 78px 0 rgba(139,92,246,.16))
          drop-shadow(0 0 22px rgba(196,181,253,.98));
      }
      36% {
        transform: translate3d(calc(var(--atk-dx) - 86px),calc(var(--atk-dy) - 18px),0) scale(1.17) rotate(17deg) skewX(10deg);
        filter:
          drop-shadow(38px 8px 0 rgba(139,92,246,.38))
          drop-shadow(82px 24px 0 rgba(139,92,246,.16))
          drop-shadow(0 0 28px rgba(255,255,255,.98));
      }
      47% {
        transform: translate3d(calc(var(--atk-dx) - 92px),calc(var(--atk-dy) - 8px),0) scale(.98) rotate(10deg) skewX(0deg);
        filter: drop-shadow(0 0 16px rgba(139,92,246,.72));
      }
      59% {
        transform: translate3d(calc(var(--atk-dx) - 58px),calc(var(--atk-dy) + 44px),0) scale(1.08) rotate(12deg) skewX(7deg);
        filter:
          drop-shadow(30px 38px 0 rgba(34,211,238,.32))
          drop-shadow(58px 72px 0 rgba(34,211,238,.14))
          drop-shadow(0 0 22px rgba(103,232,249,.95));
      }
      72% {
        transform: translate3d(calc(var(--atk-dx) + 90px),calc(var(--atk-dy) - 18px),0) scale(1.17) rotate(-18deg) skewX(-10deg);
        filter:
          drop-shadow(-40px 8px 0 rgba(34,211,238,.4))
          drop-shadow(-84px 24px 0 rgba(34,211,238,.17))
          drop-shadow(0 0 30px rgba(255,255,255,1));
      }
      78%, 86% {
        transform: translate3d(var(--atk-dx),var(--atk-dy),0) scale(1.12) rotate(0deg) skewX(0deg);
        filter: drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 42px rgba(103,232,249,.75));
      }
      93% {
        transform: translate3d(calc(var(--atk-dx) * .3),calc(var(--atk-dy) * .3),0) scale(1.04) rotate(0deg);
        filter: drop-shadow(0 24px 0 rgba(255,255,255,.16)) drop-shadow(0 0 18px rgba(196,181,253,.75));
      }
      100% {
        transform: translate3d(0,0,0) scale(1) rotate(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }

    .kenshi-twin-slash {
      position:absolute;
      inset:0;
      overflow:visible;
      pointer-events:none;
      z-index:24;
      isolation:isolate;
    }
    .kenshi-twin-slash__blade {
      position:absolute;
      left:50%;
      top:50%;
      width:190px;
      height:16px;
      margin:-8px 0 0 -95px;
      opacity:0;
      border-radius:999px;
      clip-path:polygon(0 50%,10% 22%,78% 0,100% 50%,78% 100%,10% 78%);
      transform-origin:var(--kenshi-slash-origin);
      background:linear-gradient(90deg,
        rgba(255,255,255,0) 0%,
        var(--kenshi-slash-color) 20%,
        rgba(255,255,255,1) 49%,
        var(--kenshi-slash-color) 76%,
        rgba(255,255,255,0) 100%);
      box-shadow:
        0 0 5px rgba(255,255,255,.98),
        0 0 15px var(--kenshi-slash-color),
        0 0 30px var(--kenshi-slash-color);
      will-change:transform,opacity;
      animation:kenshiTwinSlashSweep 210ms cubic-bezier(.08,.82,.18,1) forwards;
      animation-delay:var(--kenshi-slash-delay);
    }
    .kenshi-twin-slash__blade::before {
      content:'';
      position:absolute;
      left:6%;
      right:6%;
      top:50%;
      height:4px;
      transform:translateY(-50%);
      border-radius:999px;
      background:linear-gradient(90deg,transparent,#fff 18%,#fff 82%,transparent);
      box-shadow:0 0 7px #fff;
    }
    .kenshi-twin-slash__blade::after {
      content:'';
      position:absolute;
      inset:-9px -4px;
      border-radius:999px;
      background:linear-gradient(90deg,transparent,var(--kenshi-slash-color),transparent);
      opacity:.48;
      filter:blur(8px);
      z-index:-1;
    }
    @keyframes kenshiTwinSlashSweep {
      0% {
        opacity:0;
        transform:translate3d(0,-16px,0) rotate(var(--kenshi-slash-angle)) scaleX(.06) scaleY(.55);
      }
      18% { opacity:1; }
      46% {
        opacity:1;
        transform:translate3d(0,0,0) rotate(var(--kenshi-slash-angle)) scaleX(1.04) scaleY(1.08);
      }
      72% {
        opacity:.92;
        transform:translate3d(var(--kenshi-slash-sweep-x),8px,0) rotate(var(--kenshi-slash-angle)) scaleX(1.18) scaleY(.94);
      }
      100% {
        opacity:0;
        transform:translate3d(var(--kenshi-slash-sweep-x),14px,0) rotate(var(--kenshi-slash-angle)) scaleX(1.28) scaleY(.55);
      }
    }

    .kenshi-twin-slash__speed {
      position:absolute;
      height:2px;
      opacity:0;
      border-radius:999px;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.92),rgba(103,232,249,.8),transparent);
      box-shadow:0 0 7px rgba(103,232,249,.72);
      transform-origin:0 50%;
      will-change:transform,opacity;
      animation:kenshiTwinSpeedLine 250ms ease-out forwards;
      animation-delay:var(--kenshi-speed-delay);
    }
    @keyframes kenshiTwinSpeedLine {
      0% { opacity:0; transform:rotate(var(--kenshi-speed-angle)) translate3d(0,0,0) scaleX(.25); }
      24% { opacity:.9; }
      72% { opacity:.72; transform:rotate(var(--kenshi-speed-angle)) translate3d(var(--kenshi-speed-x),var(--kenshi-speed-y),0) scaleX(1.15); }
      100% { opacity:0; transform:rotate(var(--kenshi-speed-angle)) translate3d(var(--kenshi-speed-x),var(--kenshi-speed-y),0) scaleX(1.35); }
    }

    .kenshi-twin-slash__impact {
      position:absolute;
      left:50%;
      top:50%;
      width:34px;
      height:34px;
      margin:-17px 0 0 -17px;
      opacity:0;
      z-index:5;
      animation:kenshiTwinImpact 560ms ease-out forwards;
    }
    .kenshi-twin-slash__impact-core {
      position:absolute;
      inset:-48px;
      border-radius:50%;
      background:radial-gradient(circle,
        rgba(255,255,255,1) 0%,
        rgba(255,255,255,.95) 8%,
        rgba(103,232,249,.72) 24%,
        rgba(139,92,246,.42) 46%,
        rgba(139,92,246,0) 72%);
      filter:blur(.4px);
    }
    .kenshi-twin-slash__impact-ring {
      position:absolute;
      inset:-22px;
      border:3px solid rgba(255,255,255,.92);
      border-radius:50%;
      box-shadow:0 0 12px rgba(255,255,255,.95),0 0 24px rgba(103,232,249,.82),0 0 34px rgba(139,92,246,.62);
    }
    @keyframes kenshiTwinImpact {
      0%,74% { opacity:0; transform:scale(.25); }
      77% { opacity:1; transform:scale(.62); }
      81% { opacity:1; transform:scale(1.22); }
      86% { opacity:.72; transform:scale(2.05); }
      88%,100% { opacity:0; transform:scale(2.55); }
    }

    .kenshi-twin-slash__shard {
      position:absolute;
      left:50%;
      top:50%;
      width:22px;
      height:3px;
      margin:-1.5px 0 0 -11px;
      opacity:0;
      border-radius:999px;
      background:linear-gradient(90deg,#fff,rgba(103,232,249,.95),rgba(139,92,246,.65),transparent);
      box-shadow:0 0 7px rgba(255,255,255,.85);
      animation:kenshiTwinShard 150ms ease-out forwards;
      animation-delay:calc(430ms + var(--kenshi-shard-delay));
    }
    @keyframes kenshiTwinShard {
      0% { opacity:0; transform:translate3d(0,0,0) rotate(var(--kenshi-shard-angle)) scaleX(.35); }
      20% { opacity:1; }
      100% { opacity:0; transform:translate3d(var(--kenshi-shard-x),var(--kenshi-shard-y),0) rotate(var(--kenshi-shard-angle)) scaleX(1.15); }
    }

    @media (prefers-reduced-motion: reduce) {
      @keyframes kenshiTwinBladeSlash {
        0% { filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
        45% { filter:drop-shadow(0 0 20px rgba(196,181,253,.95)); }
        100% { filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
      }
      .kenshi-twin-slash__blade { animation:kenshiTwinSlashFade 180ms ease-out forwards; }
      .kenshi-twin-slash__speed, .kenshi-twin-slash__shard { display:none; }
      .kenshi-twin-slash__impact { animation:kenshiTwinImpactReduced 560ms ease-out forwards; }
      @keyframes kenshiTwinSlashFade {
        0% { opacity:0; } 35% { opacity:.95; } 100% { opacity:0; }
      }
      @keyframes kenshiTwinImpactReduced {
        0%,70% { opacity:0; } 80% { opacity:.9; transform:scale(1); } 100% { opacity:0; transform:scale(1.7); }
      }
    }
    /* ザンの連撃。敵の位置(--atk-dx/dy)まで一瞬で詰め、敵の左右を3回斬り抜けてから戻る。
       残像は drop-shadow で描き、斬撃の光は敵の丸枠の側(AttackTargetFx)が出す。尺は今までと同じ320ms。 */
    @keyframes zanComboDash {
      0% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 4px rgba(34,211,238,0.4));
      }
      10% {
        transform: translate(calc(var(--atk-dx) * .45 - 30px), calc(var(--atk-dy) * .45)) scale(1.06) skewX(14deg);
        filter: drop-shadow(calc(var(--atk-dx) * -.2) calc(var(--atk-dy) * -.2) 0 rgba(34,211,238,0.3)) drop-shadow(0 0 12px rgba(34,211,238,0.85));
      }
      24% {
        transform: translate(calc(var(--atk-dx) - 72px), calc(var(--atk-dy) + 18px)) scale(1.12) skewX(18deg);
        filter: drop-shadow(48px 6px 0 rgba(34,211,238,0.35)) drop-shadow(84px 10px 0 rgba(34,211,238,0.16)) drop-shadow(0 0 14px rgba(34,211,238,0.9));
      }
      38% {
        transform: translate(calc(var(--atk-dx) + 84px), calc(var(--atk-dy) - 12px)) scale(1.2) skewX(-24deg);
        filter: drop-shadow(-70px -4px 0 rgba(34,211,238,0.32)) drop-shadow(-130px -8px 0 rgba(34,211,238,0.15)) drop-shadow(0 0 24px rgba(255,255,255,0.95));
      }
      52% {
        transform: translate(calc(var(--atk-dx) - 66px), calc(var(--atk-dy) - 6px)) scale(1.15) skewX(18deg);
        filter: drop-shadow(60px 3px 0 rgba(34,211,238,0.3)) drop-shadow(110px 6px 0 rgba(34,211,238,0.14)) drop-shadow(0 0 20px rgba(34,211,238,0.9));
      }
      64% {
        transform: translate(calc(var(--atk-dx) + 26px), calc(var(--atk-dy) + 8px)) scale(1.1) skewX(-10deg);
        filter: drop-shadow(-36px 3px 0 rgba(34,211,238,0.28)) drop-shadow(0 0 22px rgba(255,255,255,0.9));
      }
      82% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 16px rgba(34,211,238,0.8));
      }
      100% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    /* エイキの桜花連舞。ザンと同じ残像ダッシュで敵まで詰め、敵のまわりを4回斬り抜けたあと、
       敵の真上で宙返り(1回転)して決め、花びらを散らして戻る。尺は本番の待ち500msに収まる480ms。 */
    @keyframes eikiSakuraDash {
      0% {
        transform: translate(0,0) scale(1) rotate(0deg) skewX(0deg);
        filter: drop-shadow(0 0 4px rgba(244,114,182,0.45));
      }
      10% {
        transform: translate(-6px,10px) scale(.94) rotate(-6deg) skewX(0deg);
        filter: drop-shadow(0 0 12px rgba(244,114,182,0.85));
      }
      22% {
        transform: translate(calc(var(--atk-dx) - 70px), calc(var(--atk-dy) + 30px)) scale(1.12) rotate(0deg) skewX(16deg);
        filter: drop-shadow(calc(var(--atk-dx) * -.2) calc(var(--atk-dy) * -.2) 0 rgba(244,114,182,0.32)) drop-shadow(0 0 16px rgba(244,114,182,0.95));
      }
      32% {
        transform: translate(calc(var(--atk-dx) + 76px), calc(var(--atk-dy) - 26px)) scale(1.18) rotate(0deg) skewX(-20deg);
        filter: drop-shadow(-66px 24px 0 rgba(244,114,182,0.34)) drop-shadow(-120px 44px 0 rgba(244,114,182,0.15)) drop-shadow(0 0 22px rgba(255,255,255,0.95));
      }
      42% {
        transform: translate(calc(var(--atk-dx) - 64px), calc(var(--atk-dy) - 30px)) scale(1.16) rotate(0deg) skewX(18deg);
        filter: drop-shadow(62px 2px 0 rgba(244,114,182,0.32)) drop-shadow(116px 4px 0 rgba(244,114,182,0.14)) drop-shadow(0 0 20px rgba(244,114,182,0.95));
      }
      52% {
        transform: translate(calc(var(--atk-dx) + 60px), calc(var(--atk-dy) + 34px)) scale(1.18) rotate(0deg) skewX(-16deg);
        filter: drop-shadow(-58px -30px 0 rgba(244,114,182,0.32)) drop-shadow(-108px -58px 0 rgba(244,114,182,0.14)) drop-shadow(0 0 22px rgba(255,255,255,0.95));
      }
      60% {
        transform: translate(calc(var(--atk-dx)), calc(var(--atk-dy) - 38px)) scale(1.18) rotate(0deg) skewX(0deg);
        filter: drop-shadow(0 0 22px rgba(244,114,182,0.95));
      }
      72% {
        transform: translate(calc(var(--atk-dx)), calc(var(--atk-dy) - 50px)) scale(1.26) rotate(360deg) skewX(0deg);
        filter: drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 42px rgba(244,114,182,0.9));
      }
      86% {
        transform: translate(calc(var(--atk-dx) * .2), calc(var(--atk-dy) * .2)) scale(1.05) rotate(360deg) skewX(0deg);
        filter: drop-shadow(0 0 16px rgba(244,114,182,0.7));
      }
      100% {
        transform: translate(0,0) scale(1) rotate(360deg) skewX(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    /* ==== 体当たりだった初期モンスターの攻撃(24-battle-fx.jsx の ThemedAttackMotion) ====
       距離枠は動かさず、本体(.thm-atk__monster)と飛ぶもの・着弾だけを動かす。敵の位置は --atk-dx/dy。
       尺はふだん体当たりと同じ450ms(固有技は本体だけ500ms)。長い型は --thm-ms(23-rpg-debug.jsx の THEMED_ATTACK_MS)。
       どの小片もその尺の中で消える。 */
    .thm-atk { position:absolute; inset:0; overflow:visible; pointer-events:none; z-index:26; isolation:isolate;
      --c1:#fff7d6; --c2:#fb923c; --c3:rgba(234,88,12,0); }
    .thm-atk__monster { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:4;
      transform-origin:50% 80%; will-change:transform,filter; animation-duration:var(--thm-ms,450ms); animation-fill-mode:forwards; animation-timing-function:ease-in-out; }
    .thm-atk--lunge .thm-atk__monster { animation-duration:var(--thm-ms,500ms); filter:drop-shadow(0 0 14px rgba(217,70,239,.9)); }
    .thm-atk__hit--2 { --hit-at:var(--hit-at2,600ms); }
    .thm-atk__hit { position:absolute; left:50%; top:50%; width:0; height:0; z-index:8; translate:var(--atk-dx) var(--atk-dy); }
    .thm-atk__core { position:absolute; left:-42px; top:-42px; width:84px; height:84px; border-radius:50%; opacity:0;
      background:radial-gradient(circle,#fff 0 10%,var(--c1) 24%,var(--c2) 46%,var(--c3) 72%);
      animation:thmHitCore 180ms ease-out forwards; animation-delay:var(--hit-at,260ms); }
    .thm-atk__ring { position:absolute; left:-22px; top:-22px; width:44px; height:44px; border-radius:50%; opacity:0;
      border:4px solid var(--c1); box-shadow:0 0 10px #fff,0 0 20px var(--c2);
      animation:thmHitRing 190ms ease-out forwards; animation-delay:var(--hit-at,260ms); }
    .thm-atk--lunge .thm-atk__core { left:-58px; top:-58px; width:116px; height:116px; }
    @keyframes thmHitCore { 0% { opacity:0; transform:scale(.3); } 30% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.6); } }
    @keyframes thmHitRing { 0% { opacity:0; transform:scale(.3); } 30% { opacity:1; } 100% { opacity:0; transform:scale(2.6); } }
    .thm-atk__bit { position:absolute; left:-4px; top:-4px; width:8px; height:8px; border-radius:50%; opacity:0; background:var(--c1);
      box-shadow:0 0 6px var(--c2); scale:var(--bs,1); animation:thmBit 190ms ease-out forwards; animation-delay:var(--hit-at,260ms); }
    @keyframes thmBit { 0% { opacity:0; transform:translate3d(0,0,0) scale(.4); } 25% { opacity:1; } 100% { opacity:0; transform:translate3d(var(--bx),var(--by),0) scale(1); } }
    .thm-atk__flys { position:absolute; inset:0; z-index:6; }
    .thm-atk__fly { position:absolute; left:50%; top:40%; width:14px; height:14px; margin:-7px 0 0 -7px; border-radius:50%; opacity:0;
      animation-duration:200ms; animation-fill-mode:forwards; animation-timing-function:ease-in; }
    .thm-atk__line { position:absolute; left:50%; top:40%; width:0; height:0; z-index:5; rotate:var(--atk-rot); }
    .thm-atk__line i { position:absolute; left:-6px; bottom:0; width:12px; height:var(--atk-len); opacity:0; transform-origin:50% 100%;
      animation-duration:var(--thm-ms,450ms); animation-fill-mode:forwards; }

    /* モッチー: 高く跳んで敵を押しつぶし、跳ね返って元の場所へ戻ってから、口からモッチ砲(ビーム)を撃つ(900ms) */
    .thm-atk--stomp { --c1:#ffe4ef; --c2:#f472b6; --c3:rgba(236,72,153,0); --hit-at:300ms; --hit-at2:680ms; }
    .thm-atk--stomp .thm-atk__monster { animation-name:thmStomp; }
    .thm-atk--stomp .thm-atk__hit--2 .thm-atk__core { left:-50px; top:-50px; width:100px; height:100px; }
    @keyframes thmStomp {
      0% { transform:translate3d(0,0,0) scale(1); filter:none; }
      6% { transform:translate3d(0,6px,0) scale(1.18,.78); }
      22% { transform:translate3d(calc(var(--atk-dx) * .6),calc(var(--atk-dy) * .6 - 120px),0) scale(.9,1.14) rotate(-10deg); }
      30% { transform:translate3d(var(--atk-dx),calc(var(--atk-dy) - 80px),0) scale(1.05,1.08) rotate(0deg); }
      34% { transform:translate3d(var(--atk-dx),calc(var(--atk-dy) + 4px),0) scale(1.5,.6); }
      40% { transform:translate3d(calc(var(--atk-dx) * .97),calc(var(--atk-dy) * .97 - 8px),0) scale(1.15,.88); }
      50% { transform:translate3d(calc(var(--atk-dx) * .5),calc(var(--atk-dy) * .5 - 70px),0) scale(.95,1.08) rotate(12deg); }
      59% { transform:translate3d(0,6px,0) scale(1.18,.82) rotate(0deg); }
      64% { transform:translate3d(0,0,0) scale(1); filter:none; }
      72% { transform:translate3d(calc(var(--atk-dx) * -.03),calc(var(--atk-dy) * -.03 + 3px),0) scale(1.12,1.04); filter:drop-shadow(0 0 16px #f9a8d4) drop-shadow(0 0 6px #fff); }
      76% { transform:translate3d(calc(var(--atk-dx) * -.07),calc(var(--atk-dy) * -.07),0) scale(1.08,.94); filter:drop-shadow(0 0 20px #f472b6); }
      82% { transform:translate3d(calc(var(--atk-dx) * -.06 + 2px),calc(var(--atk-dy) * -.06),0) scale(1.08,.94); }
      88% { transform:translate3d(calc(var(--atk-dx) * -.06 - 2px),calc(var(--atk-dy) * -.06),0) scale(1.06,.96); filter:drop-shadow(0 0 12px #f472b6); }
      100% { transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    .thm-atk--stomp .thm-atk__line { top:46%; }
    .thm-atk--stomp .thm-atk__line i { width:22px; left:-11px; border-radius:999px;
      background:linear-gradient(90deg,rgba(244,114,182,0),#f9a8d4 18%,#fff 42%,#fff 58%,#f9a8d4 82%,rgba(244,114,182,0));
      box-shadow:0 0 14px #f472b6,0 0 30px rgba(244,114,182,.85); animation-name:thmMocchiCannon; }
    @keyframes thmMocchiCannon {
      0%,72% { opacity:0; transform:scaleY(0) scaleX(.4); }
      76% { opacity:1; transform:scaleY(1) scaleX(1.7); }
      80% { opacity:1; transform:scaleY(1) scaleX(.9); }
      84% { opacity:1; transform:scaleY(1) scaleX(1.35); }
      88% { opacity:1; transform:scaleY(1) scaleX(1); }
      95%,100% { opacity:0; transform:scaleY(1) scaleX(.1); }
    }

    /* スエゾー: 大きな目に光をためて、敵へまっすぐ光線を撃つ(本体は反動で小さく震える) */
    .thm-atk--beam { --c1:#fef9c3; --c2:#facc15; --c3:rgba(250,204,21,0); --hit-at:140ms; }
    .thm-atk--beam .thm-atk__monster { animation-name:thmBeamBody; }
    .thm-atk--beam .thm-atk__line { top:38%; }
    .thm-atk--beam .thm-atk__line i { width:14px; left:-7px; border-radius:999px;
      background:linear-gradient(90deg,rgba(250,204,21,0),#fde047 22%,#fff 50%,#fde047 78%,rgba(250,204,21,0));
      box-shadow:0 0 12px #fde047,0 0 24px rgba(250,204,21,.8); animation-name:thmBeam; }
    .thm-atk--beam .thm-atk__core, .thm-atk--beam .thm-atk__ring { animation-duration:300ms; }
    @keyframes thmBeamBody {
      0% { transform:translate3d(0,0,0) scale(1); filter:none; }
      18% { transform:translate3d(0,4px,0) scale(1.1,.92); filter:drop-shadow(0 0 14px #fde047); }
      30% { transform:translate3d(calc(var(--atk-dx) * -.04),calc(var(--atk-dy) * -.04),0) scale(1.08); filter:drop-shadow(0 0 20px #fff); }
      42% { transform:translate3d(calc(var(--atk-dx) * -.03 + 2px),calc(var(--atk-dy) * -.03),0) scale(1.08); }
      54% { transform:translate3d(calc(var(--atk-dx) * -.04 - 2px),calc(var(--atk-dy) * -.04),0) scale(1.08); }
      70% { transform:translate3d(0,0,0) scale(1.02); filter:drop-shadow(0 0 10px #fde047); }
      100% { transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    @keyframes thmBeam {
      0%,22% { opacity:0; transform:scaleY(0) scaleX(.4); }
      30% { opacity:1; transform:scaleY(1) scaleX(1.5); }
      40% { opacity:1; transform:scaleY(1) scaleX(.8); }
      50% { opacity:1; transform:scaleY(1) scaleX(1.3); }
      62% { opacity:1; transform:scaleY(1) scaleX(1); }
      74%,100% { opacity:0; transform:scaleY(1) scaleX(.1); }
    }

    /* ゴーレム: 腕を振りかぶって敵へのしのしと詰め、直接殴る。当たった所から岩のかけらが飛び散る(520ms) */
    .thm-atk--rocks { --c1:#f5e6d0; --c2:#a8865f; --c3:rgba(120,90,60,0); --hit-at:240ms; }
    .thm-atk--rocks .thm-atk__monster { animation-name:thmRocksBody; }
    .thm-atk--rocks .thm-atk__core { left:-56px; top:-56px; width:112px; height:112px; animation-duration:220ms; }
    .thm-atk--rocks .thm-atk__ring { border-color:#e7d7c1; animation-duration:240ms; }
    .thm-atk--rocks .thm-atk__bit { left:-8px; top:-8px; width:16px; height:15px; border-radius:25%; rotate:var(--ba);
      clip-path:polygon(20% 0,80% 8%,100% 55%,72% 100%,18% 92%,0 40%); box-shadow:none;
      background:linear-gradient(135deg,#efe2cf,#a8865f 55%,#5c4330); animation-name:thmRockBurst; animation-duration:270ms; animation-timing-function:linear; }
    @keyframes thmRockBurst {
      0% { opacity:0; transform:translate3d(0,0,0) rotate(0deg) scale(.4); }
      12% { opacity:1; }
      55% { opacity:1; transform:translate3d(calc(var(--bx) * .75),calc(var(--by) * .75),0) rotate(220deg) scale(1); }
      100% { opacity:0; transform:translate3d(var(--bx),calc(var(--by) + 46px),0) rotate(400deg) scale(.8); }
    }
    @keyframes thmRocksBody {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); }
      14% { transform:translate3d(calc(var(--atk-dx) * -.08),calc(var(--atk-dy) * -.08 - 6px),0) scale(1.08,1.12) rotate(-7deg); }
      26% { transform:translate3d(calc(var(--atk-dx) * .3),calc(var(--atk-dy) * .3 + 4px),0) scale(1.1,.95) rotate(-4deg); }
      38% { transform:translate3d(calc(var(--atk-dx) * .66),calc(var(--atk-dy) * .66 - 4px),0) scale(1.12,1.04) rotate(-6deg); }
      46% { transform:translate3d(calc(var(--atk-dx) * .86),calc(var(--atk-dy) * .86),0) scale(1.3,1.08) rotate(6deg); }
      52% { transform:translate3d(calc(var(--atk-dx) * .84 + 4px),calc(var(--atk-dy) * .84),0) scale(1.26,1.06) rotate(5deg); }
      58% { transform:translate3d(calc(var(--atk-dx) * .85 - 4px),calc(var(--atk-dy) * .85),0) scale(1.24,1.06) rotate(5deg); }
      66% { transform:translate3d(calc(var(--atk-dx) * .78),calc(var(--atk-dy) * .78),0) scale(1.12) rotate(0deg); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); }
    }

    /* ライガー: コマ落としのようにカクカクと左右へ跳びながら高速で詰め、爪で3回ひっかく。
       同じようにカクカクと元の場所へ戻り、角に雷をためて、敵へ雷撃を落とす(900ms)。
       steps(1,end) で各コマの間をつながずに瞬間移動させ、残像(.thm-atk__ghost)が少し遅れて追いかける */
    .thm-atk--claw { --c1:#fee2e2; --c2:#ef4444; --c3:rgba(239,68,68,0); --hit-at:235ms; --hit-at2:665ms; }
    .thm-atk--claw .thm-atk__monster { animation-name:thmClawBody; animation-timing-function:steps(1,end); }
    .thm-atk__ghost { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:3; opacity:0;
      transform-origin:50% 80%; pointer-events:none; filter:sepia(1) saturate(4) hue-rotate(-30deg) brightness(1.2);
      animation:thmClawBody var(--thm-ms,450ms) steps(1,end) forwards, thmClawGhost var(--thm-ms,450ms) linear forwards; }
    .thm-atk__ghost--1 { animation-delay:35ms,0ms; --ghost-a:.5; }
    .thm-atk__ghost--2 { animation-delay:70ms,0ms; --ghost-a:.28; }
    @keyframes thmClawGhost { 0%,5% { opacity:0; } 9%,55% { opacity:var(--ghost-a,.4); } 61%,100% { opacity:0; } }
    .thm-atk--claw .thm-atk__core { width:70px; height:70px; left:-35px; top:-35px; animation-duration:260ms; }
    .thm-atk--claw .thm-atk__hit:not(.thm-atk__hit--2) .thm-atk__bit { left:-3px; top:-36px; width:6px; height:72px; border-radius:999px; rotate:var(--ba); translate:var(--bx) 0;
      background:linear-gradient(180deg,rgba(255,255,255,0),#fff 30%,#fecaca 60%,rgba(239,68,68,0)); box-shadow:0 0 8px #ef4444;
      animation-name:thmClaw; animation-duration:140ms; }
    @keyframes thmClaw { 0% { opacity:0; transform:scaleY(.1); } 35% { opacity:1; transform:scaleY(1); } 100% { opacity:0; transform:scaleY(1.1) scaleX(.4); } }
    /* 雷撃の着弾は黄色 */
    .thm-atk--claw .thm-atk__hit--2 { --c1:#fef9c3; --c2:#facc15; --c3:rgba(250,204,21,0); }
    .thm-atk--claw .thm-atk__hit--2 .thm-atk__core { width:104px; height:104px; left:-52px; top:-52px; animation-duration:300ms; }
    .thm-atk--claw .thm-atk__hit--2 .thm-atk__bit { width:10px; height:3px; border-radius:2px; background:#fef08a; box-shadow:0 0 6px #facc15; animation-duration:220ms; }
    @keyframes thmClawBody {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
      4% { transform:translate3d(0,6px,0) scale(1.1,.86); }
      10% { transform:translate3d(calc(var(--atk-dx) * .28 - 34px),calc(var(--atk-dy) * .28),0) scale(1.08) rotate(-8deg); }
      15% { transform:translate3d(calc(var(--atk-dx) * .52 + 34px),calc(var(--atk-dy) * .52),0) scale(1.1) rotate(8deg); }
      21% { transform:translate3d(calc(var(--atk-dx) * .74 - 26px),calc(var(--atk-dy) * .74),0) scale(1.14) rotate(-8deg); }
      26% { transform:translate3d(calc(var(--atk-dx) * .92),calc(var(--atk-dy) * .92),0) scale(1.26) rotate(-14deg); }
      32% { transform:translate3d(calc(var(--atk-dx) + 26px),calc(var(--atk-dy) * .95 - 10px),0) scale(1.24) rotate(14deg); }
      39% { transform:translate3d(calc(var(--atk-dx) - 26px),calc(var(--atk-dy) * .95 + 6px),0) scale(1.26) rotate(-12deg); }
      45% { transform:translate3d(calc(var(--atk-dx) * .6 + 30px),calc(var(--atk-dy) * .6),0) scale(1.1) rotate(8deg); }
      51% { transform:translate3d(calc(var(--atk-dx) * .3 - 26px),calc(var(--atk-dy) * .3),0) scale(1.05) rotate(-6deg); }
      57% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
      /* 元の場所で身を低くして、角に雷をためる */
      63% { transform:translate3d(0,5px,0) scale(1.08,.9) rotate(0deg); filter:drop-shadow(0 0 10px #fde047); }
      68% { transform:translate3d(0,3px,0) scale(1.1,.9) rotate(0deg); filter:drop-shadow(0 0 16px #facc15) drop-shadow(0 0 4px #fff); }
      /* 頭を振り上げて雷撃。反動で小刻みに震える */
      72% { transform:translate3d(calc(var(--atk-dx) * -.05),calc(var(--atk-dy) * -.05 - 4px),0) scale(1.12,1.04) rotate(-5deg); filter:drop-shadow(0 0 18px #fef08a); }
      77% { transform:translate3d(calc(var(--atk-dx) * -.05 + 3px),calc(var(--atk-dy) * -.05 - 4px),0) scale(1.12,1.04) rotate(-3deg); }
      82% { transform:translate3d(calc(var(--atk-dx) * -.05 - 3px),calc(var(--atk-dy) * -.05 - 4px),0) scale(1.12,1.04) rotate(-5deg); filter:drop-shadow(0 0 12px #facc15); }
      88% { transform:translate3d(calc(var(--atk-dx) * -.03),calc(var(--atk-dy) * -.03),0) scale(1.05) rotate(-2deg); }
      94%,100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:none; }
    }
    /* 角から敵までの雷。ジグザグの形(clip-path)で切り抜き、光は親(.thm-atk__line)の影で付ける(子に付けると形で切れる) */
    .thm-atk--claw .thm-atk__line { top:24%; filter:drop-shadow(0 0 6px #facc15) drop-shadow(0 0 14px rgba(250,204,21,.8)); }
    .thm-atk--claw .thm-atk__line i { width:40px; left:-20px;
      clip-path:polygon(42% 100%, 12% 86%, 70% 72%, 16% 58%, 66% 44%, 20% 30%, 62% 16%, 42% 0%, 58% 0%, 78% 16%, 36% 30%, 82% 44%, 32% 58%, 86% 72%, 28% 86%, 58% 100%);
      background:linear-gradient(90deg,#fde047,#fff 50%,#fde047); animation-name:thmClawBolt; }
    @keyframes thmClawBolt {
      0%,70% { opacity:0; transform:scaleY(0); }
      73% { opacity:1; transform:scaleY(1) scaleX(1.2); }
      76% { opacity:.35; transform:scaleY(1) scaleX(-1); }
      79% { opacity:1; transform:scaleY(1) scaleX(1.1); }
      83% { opacity:.5; transform:scaleY(1) scaleX(-1.2); }
      86% { opacity:1; transform:scaleY(1) scaleX(1); }
      92%,100% { opacity:0; transform:scaleY(1) scaleX(.2); }
    }

    /* ハム: 敵へ駆け寄って、左のジャブ(小)→ 体をひねって右ストレート(大)のワンツー(580ms) */
    .thm-atk--punch { --c1:#fff7ed; --c2:#f59e0b; --c3:rgba(245,158,11,0); --hit-at:314ms; }
    .thm-atk--punch .thm-atk__monster { animation-name:thmPunchBody; }
    .thm-atk--punch .thm-atk__core { left:-54px; top:-54px; width:108px; height:108px; animation-duration:240ms; }
    .thm-atk--punch .thm-atk__ring { animation-duration:240ms; }
    .thm-atk--punch .thm-atk__bit { left:-11px; top:-11px; width:22px; height:22px; border-radius:0; translate:var(--bx) var(--by); box-shadow:none;
      clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
      background:radial-gradient(circle,#fff 0 30%,#fde68a 60%,#f59e0b); animation-name:thmStar; animation-duration:150ms; }
    @keyframes thmStar { 0% { opacity:0; transform:scale(.3) rotate(0deg); } 40% { opacity:1; transform:scale(1.2) rotate(20deg); } 100% { opacity:0; transform:scale(1.5) rotate(40deg); } }
    @keyframes thmPunchBody {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); }
      8% { transform:translate3d(0,6px,0) scale(1.08,.9); }
      26% { transform:translate3d(calc(var(--atk-dx) * .74),calc(var(--atk-dy) * .74),0) scale(1.08) rotate(0deg); }
      32% { transform:translate3d(calc(var(--atk-dx) * .86),calc(var(--atk-dy) * .86),0) scale(1.14,1.04) rotate(-10deg); }
      38% { transform:translate3d(calc(var(--atk-dx) * .76),calc(var(--atk-dy) * .76),0) scale(1.04,1.08) rotate(-3deg); }
      46% { transform:translate3d(calc(var(--atk-dx) * .7),calc(var(--atk-dy) * .7 + 3px),0) scale(1.06,1.02) rotate(9deg); }
      54% { transform:translate3d(calc(var(--atk-dx) * .95),calc(var(--atk-dy) * .95),0) scale(1.32,1.08) rotate(-14deg); }
      64% { transform:translate3d(calc(var(--atk-dx) * .92),calc(var(--atk-dy) * .92),0) scale(1.24,1.06) rotate(-10deg); }
      78% { transform:translate3d(calc(var(--atk-dx) * .5),calc(var(--atk-dy) * .5 - 12px),0) scale(1.04) rotate(0deg); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); }
    }

    /* ピクシー: 少し浮いて魔法陣を広げ、魔法の弾を3発、ゆらしながら敵へ飛ばす */
    .thm-atk--magic { --c1:#fae8ff; --c2:#d946ef; --c3:rgba(217,70,239,0); --hit-at:300ms; }
    .thm-atk--magic .thm-atk__monster { animation-name:thmMagicBody; }
    .thm-atk--magic .thm-atk__core, .thm-atk--magic .thm-atk__ring, .thm-atk--magic .thm-atk__bit { animation-duration:150ms; }
    .thm-atk__circle { position:absolute; left:50%; top:50%; width:74px; height:74px; margin:-37px 0 0 -37px; z-index:2; opacity:0;
      animation:thmCircle 420ms ease-out forwards; }
    .thm-atk__circle i { position:absolute; inset:0; border:2px solid rgba(240,171,252,.95); border-radius:50%; box-shadow:0 0 10px #d946ef, inset 0 0 8px #f0abfc; }
    .thm-atk__circle i:nth-child(2) { inset:10px; border-style:dashed; }
    @keyframes thmCircle { 0% { opacity:0; transform:scale(.3) rotate(0deg); } 20% { opacity:1; transform:scale(1) rotate(80deg); } 75% { opacity:.9; transform:scale(1.05) rotate(260deg); } 100% { opacity:0; transform:scale(1.3) rotate(320deg); } }
    @keyframes thmMagicBody {
      0% { transform:translate3d(0,0,0) scale(1); filter:none; }
      20% { transform:translate3d(0,-10px,0) scale(1.06); filter:drop-shadow(0 0 14px #f0abfc); }
      60% { transform:translate3d(0,-12px,0) scale(1.06); filter:drop-shadow(0 0 18px #d946ef); }
      100% { transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    .thm-atk--magic .thm-atk__fly { top:42%; background:radial-gradient(circle,#fff 0 25%,#f0abfc 50%,#d946ef 75%,rgba(217,70,239,0));
      box-shadow:0 0 10px #d946ef,0 0 18px #f0abfc; animation-name:thmOrb; }
    @keyframes thmOrb {
      0% { opacity:0; transform:translate3d(0,0,0) scale(.4); }
      15% { opacity:1; }
      50% { opacity:1; transform:translate3d(calc(var(--atk-dx) * .5 + var(--fx)),calc(var(--atk-dy) * .5 + var(--fy) * .3),0) scale(1.1); }
      100% { opacity:.2; transform:translate3d(var(--atk-dx),var(--atk-dy),0) scale(.9); }
    }

    /* モノリス: 敵の真上まで浮かび上がり、まっすぐ落ちて押しつぶす */
    .thm-atk--crush { --c1:#ede9fe; --c2:#6d28d9; --c3:rgba(76,29,149,0); --hit-at:265ms; }
    .thm-atk--crush .thm-atk__monster { animation-name:thmCrush; }
    .thm-atk--crush .thm-atk__bit { left:-2px; top:-2px; width:4px; height:34px; border-radius:2px; transform-origin:50% 0; rotate:var(--ba);
      background:linear-gradient(180deg,#ede9fe,#6d28d9); animation-name:thmCrack; }
    @keyframes thmCrack { 0% { opacity:0; transform:scaleY(0); } 30% { opacity:1; transform:scaleY(1); } 100% { opacity:0; transform:scaleY(1.2); } }
    @keyframes thmCrush {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); }
      12% { transform:translate3d(0,6px,0) scale(1.05,.92); }
      38% { transform:translate3d(var(--atk-dx),calc(var(--atk-dy) - 95px),0) scale(1.1) rotate(-4deg); }
      50% { transform:translate3d(calc(var(--atk-dx) + 3px),calc(var(--atk-dy) - 100px),0) scale(1.1) rotate(4deg); }
      60% { transform:translate3d(var(--atk-dx),calc(var(--atk-dy) - 8px),0) scale(1.18,.86) rotate(0deg); }
      72% { transform:translate3d(calc(var(--atk-dx) * .95),calc(var(--atk-dy) * .95 - 26px),0) scale(1); }
      100% { transform:translate3d(0,0,0) scale(1); }
    }

    /* オボロゲソウ: 体を揺らして、青い花びらを7枚、うずを巻くように敵へ吹きつける */
    .thm-atk--petals { --c1:#dbeafe; --c2:#3b82f6; --c3:rgba(59,130,246,0); --hit-at:260ms; }
    .thm-atk--petals .thm-atk__monster { animation-name:thmPetalsBody; }
    @keyframes thmPetalsBody {
      0% { transform:rotate(0deg) scale(1); }
      20% { transform:rotate(-8deg) scale(1.05); }
      45% { transform:rotate(8deg) scale(1.06); }
      70% { transform:rotate(-5deg) scale(1.03); }
      100% { transform:rotate(0deg) scale(1); }
    }
    .thm-atk--petals .thm-atk__fly { top:34%; width:20px; height:13px; margin:-6px 0 0 -10px; border-radius:80% 10% 80% 10%;
      background:linear-gradient(135deg,#eff6ff,#60a5fa 60%,#1d4ed8); box-shadow:0 0 8px #93c5fd; animation-name:thmPetal; animation-duration:200ms; }
    @keyframes thmPetal {
      0% { opacity:0; transform:translate3d(0,0,0) rotate(0deg) scale(.5); }
      15% { opacity:1; }
      55% { opacity:1; transform:translate3d(calc(var(--atk-dx) * .5 + var(--fx)),calc(var(--atk-dy) * .5 + var(--fy) * .4),0) rotate(260deg) scale(1.2); }
      100% { opacity:0; transform:translate3d(calc(var(--atk-dx) + var(--fx) * .3),calc(var(--atk-dy) + var(--fy) * .2),0) rotate(520deg) scale(.8); }
    }

    /* プラント: 茎からつるを敵まで伸ばして、ぴしっとはたく */
    .thm-atk--vine { --c1:#dcfce7; --c2:#22c55e; --c3:rgba(34,197,94,0); --hit-at:180ms; }
    .thm-atk--vine .thm-atk__monster { animation-name:thmVineBody; }
    .thm-atk--vine .thm-atk__line { top:46%; }
    .thm-atk--vine .thm-atk__line i { width:8px; left:-4px; border-radius:999px;
      background:linear-gradient(90deg,#14532d,#22c55e 40%,#86efac 55%,#16a34a); box-shadow:0 0 6px rgba(34,197,94,.8); animation-name:thmVine; }
    .thm-atk--vine .thm-atk__bit { left:-6px; top:-4px; width:12px; height:8px; border-radius:80% 10% 80% 10%; background:linear-gradient(135deg,#bbf7d0,#16a34a); }
    @keyframes thmVineBody {
      0% { transform:translate3d(0,0,0) scale(1); }
      15% { transform:translate3d(0,4px,0) scale(1.05,.94); }
      38% { transform:translate3d(0,0,0) scale(1.08) rotate(calc(var(--atk-rot) * .1)); }
      62% { transform:translate3d(0,0,0) scale(1.04) rotate(0deg); }
      100% { transform:translate3d(0,0,0) scale(1); }
    }
    @keyframes thmVine {
      0%,10% { opacity:0; transform:scaleY(0) rotate(0deg); }
      14% { opacity:1; }
      38% { opacity:1; transform:scaleY(1.02) rotate(0deg); }
      46% { transform:scaleY(1) rotate(-7deg); }
      54% { transform:scaleY(1) rotate(6deg); }
      62% { opacity:1; transform:scaleY(1) rotate(0deg); }
      82% { opacity:1; transform:scaleY(0) rotate(0deg); }
      100% { opacity:0; transform:scaleY(0); }
    }

    /* ミタラシ: 息を吸い込んで、口から敵まで炎のビームを吐き続ける。炎はビームの中を流れ、敵の上で燃え上がる(560ms) */
    .thm-atk--fire { --c1:#fef3c7; --c2:#f97316; --c3:rgba(220,38,38,0); --hit-at:200ms; }
    .thm-atk--fire .thm-atk__monster { animation-name:thmFireBody; }
    .thm-atk--fire .thm-atk__core { width:110px; height:110px; left:-55px; top:-55px; animation-duration:320ms; }
    .thm-atk--fire .thm-atk__ring { border-color:#fde047; animation-duration:260ms; }
    .thm-atk--fire .thm-atk__bit { left:-7px; top:-7px; width:14px; height:14px; box-shadow:0 0 8px #f97316;
      background:radial-gradient(circle,#fff 0 20%,#fde047 45%,#f97316 70%,rgba(220,38,38,0)); animation-name:thmEmber; animation-duration:200ms; }
    @keyframes thmEmber { 0% { opacity:0; transform:translate3d(0,0,0) scale(.5); } 25% { opacity:1; } 100% { opacity:0; transform:translate3d(var(--bx),calc(var(--by) - 20px),0) scale(1.3); } }
    @keyframes thmFireBody {
      0% { transform:translate3d(0,0,0) scale(1); filter:none; }
      16% { transform:translate3d(calc(var(--atk-dx) * -.05),calc(var(--atk-dy) * -.05 + 3px),0) scale(1.06,1.12); filter:drop-shadow(0 0 10px #fb923c); }
      24% { transform:translate3d(calc(var(--atk-dx) * .05),calc(var(--atk-dy) * .05),0) scale(1.12,.94); filter:drop-shadow(0 0 16px #f97316); }
      36% { transform:translate3d(calc(var(--atk-dx) * .04 + 2px),calc(var(--atk-dy) * .04),0) scale(1.1,.95); }
      48% { transform:translate3d(calc(var(--atk-dx) * .05 - 2px),calc(var(--atk-dy) * .05),0) scale(1.1,.95); }
      60% { transform:translate3d(calc(var(--atk-dx) * .04 + 2px),calc(var(--atk-dy) * .04),0) scale(1.1,.95); }
      72% { transform:translate3d(calc(var(--atk-dx) * .05 - 1px),calc(var(--atk-dy) * .05),0) scale(1.08,.96); filter:drop-shadow(0 0 12px #f97316); }
      100% { transform:translate3d(0,0,0) scale(1); filter:none; }
    }
    /* ビーム本体: 口の側が細く、敵の側へ行くほど広がる炎の帯。縞の模様を流して、炎が敵へ押し寄せて見えるようにする */
    .thm-atk--fire .thm-atk__line { top:40%; }
    .thm-atk--fire .thm-atk__line i { width:34px; left:-17px;
      clip-path:polygon(0 0,100% 0,64% 100%,36% 100%);
      background:
        linear-gradient(90deg,rgba(220,38,38,0),rgba(249,115,22,.9) 20%,rgba(254,240,138,.95) 42%,#fff 50%,rgba(254,240,138,.95) 58%,rgba(249,115,22,.9) 80%,rgba(220,38,38,0)),
        repeating-linear-gradient(0deg,rgba(255,255,255,.0) 0 10px,rgba(255,255,255,.35) 10px 16px);
      background-blend-mode:screen; background-size:100% 100%,100% 26px;
      filter:drop-shadow(0 0 8px #f97316) drop-shadow(0 0 16px rgba(239,68,68,.8));
      animation:thmFireBeam var(--thm-ms,450ms) ease-out forwards, thmFireFlow 140ms linear infinite; }
    @keyframes thmFireBeam {
      0%,18% { opacity:0; transform:scaleY(0) scaleX(.3); }
      26% { opacity:1; transform:scaleY(1) scaleX(1.3); }
      34% { opacity:1; transform:scaleY(1) scaleX(.9); }
      42% { opacity:1; transform:scaleY(1) scaleX(1.2); }
      50% { opacity:1; transform:scaleY(1) scaleX(.95); }
      58% { opacity:1; transform:scaleY(1) scaleX(1.25); }
      66% { opacity:1; transform:scaleY(1) scaleX(1); }
      74% { opacity:.9; transform:scaleY(1) scaleX(1.1); }
      86%,100% { opacity:0; transform:scaleY(1) scaleX(.1); }
    }
    @keyframes thmFireFlow { from { background-position:0 0,0 0; } to { background-position:0 0,0 -26px; } }
    .thm-atk--fire .thm-atk__fly { top:40%; width:26px; height:26px; margin:-13px 0 0 -13px; border-radius:50%;
      background:radial-gradient(circle,#fff 0 18%,#fde047 38%,#f97316 62%,rgba(220,38,38,0)); animation-name:thmFlame; animation-duration:190ms; }
    @keyframes thmFlame {
      0% { opacity:0; transform:translate3d(0,0,0) scale(.4); }
      15% { opacity:1; }
      100% { opacity:0; transform:translate3d(calc(var(--atk-dx) + var(--fx)),calc(var(--atk-dy) + var(--fy)),0) scale(2); }
    }

    /* 動きを減らす設定: 本体は光るだけ、飛ぶもの・線は出さず、着弾の光だけ */
    @media (prefers-reduced-motion: reduce) {
      .thm-atk__monster { animation:thmReduced var(--thm-ms,450ms) ease-out forwards !important; }
      .thm-atk__flys, .thm-atk__line, .thm-atk__circle, .thm-atk__ghost, .thm-atk__bit { display:none; }
      @keyframes thmReduced { 0% { filter:none; } 45% { filter:drop-shadow(0 0 18px var(--c2)); } 100% { filter:none; } }
    }
    /* ==== タクティクスのEXスキルを使った瞬間のカットイン(24-battle-fx.jsx の TacticsExCutin・1600ms) ====
       暗転 → 斜めの帯が左から入る(立ち絵・EX SKILL・名前)→ 効果ごとの模様 → 帯が右へ抜ける。色は --ex-c1(明)/--ex-c2(濃)。
       押せる場所は塞がない(pointer-events:none)。 */
    .ex-cutin { position:fixed; inset:0; z-index:9600; pointer-events:none; overflow:hidden; }
    .ex-cutin > * { position:absolute; pointer-events:none; }
    .ex-cutin__shade { inset:0; opacity:0; background:radial-gradient(ellipse at 50% 50%, rgba(8,6,20,.55), rgba(2,2,8,.82));
      animation:exShade 1600ms ease-out forwards; }
    @keyframes exShade { 0% { opacity:0; } 8%,80% { opacity:1; } 100% { opacity:0; } }
    .ex-cutin__rays { left:50%; top:50%; width:160vmax; height:160vmax; margin:-80vmax 0 0 -80vmax; opacity:0;
      background:repeating-conic-gradient(from 0deg, color-mix(in srgb, var(--ex-c2) 45%, transparent) 0 6deg, transparent 6deg 18deg);
      -webkit-mask-image:radial-gradient(circle, #000 0 18%, transparent 55%); mask-image:radial-gradient(circle, #000 0 18%, transparent 55%);
      animation:exRays 1600ms ease-out forwards; }
    @keyframes exRays { 0% { opacity:0; transform:rotate(0deg) scale(.6); } 12% { opacity:.9; } 78% { opacity:.7; } 100% { opacity:0; transform:rotate(40deg) scale(1.1); } }
    .ex-cutin__band { left:-12%; right:-12%; top:50%; height:148px; margin-top:-74px; overflow:visible;
      background:linear-gradient(90deg, rgba(6,8,18,.35), rgba(8,10,24,.94) 18%, rgba(8,10,24,.94) 82%, rgba(6,8,18,.35));
      border-top:3px solid var(--ex-c1); border-bottom:3px solid var(--ex-c1);
      box-shadow:0 0 18px var(--ex-c2), 0 0 42px color-mix(in srgb, var(--ex-c2) 60%, transparent), inset 0 0 30px color-mix(in srgb, var(--ex-c2) 45%, transparent);
      transform:translateX(-120%) skewY(-7deg); animation:exBand 1600ms cubic-bezier(.2,.8,.2,1) forwards; }
    @keyframes exBand {
      0% { transform:translateX(-120%) skewY(-7deg); }
      13% { transform:translateX(0) skewY(-7deg); }
      80% { transform:translateX(2%) skewY(-7deg); opacity:1; }
      100% { transform:translateX(125%) skewY(-7deg); opacity:.6; }
    }
    .ex-cutin__lines { position:absolute; inset:0; opacity:.9;
      background:repeating-linear-gradient(90deg, transparent 0 46px, color-mix(in srgb, var(--ex-c1) 22%, transparent) 46px 48px);
      animation:exLines 260ms linear infinite; }
    @keyframes exLines { from { background-position:0 0; } to { background-position:-48px 0; } }
    .ex-cutin__art { position:absolute; left:calc(12% + 2px); bottom:-12px; width:156px; height:156px; transform:skewY(7deg);
      filter:drop-shadow(0 0 10px var(--ex-c2)) drop-shadow(0 6px 10px rgba(0,0,0,.7)); animation:exArt 1600ms cubic-bezier(.2,.8,.2,1) forwards; }
    @keyframes exArt { 0%,6% { opacity:0; translate:-70px 0; scale:.85; } 20% { opacity:1; translate:0 0; scale:1.08; } 30%,82% { opacity:1; translate:6px 0; scale:1; } 100% { opacity:0; translate:60px 0; scale:1; } }
    .ex-cutin__text { position:absolute; left:calc(12% + 162px); right:calc(12% + 8px); top:50%; transform:translateY(-50%) skewY(7deg); min-width:0; }
    .ex-cutin__tag { font:900 12px/1 system-ui, sans-serif; letter-spacing:.32em; color:var(--ex-c1);
      text-shadow:0 0 8px var(--ex-c2); opacity:0; animation:exTag 1600ms ease-out forwards; }
    @keyframes exTag { 0%,10% { opacity:0; translate:30px 0; } 20%,84% { opacity:1; translate:0 0; } 100% { opacity:0; } }
    .ex-cutin__name { margin-top:6px; font:italic 900 26px/1.15 system-ui, sans-serif; color:#fff; white-space:nowrap;
      text-shadow:0 0 2px var(--ex-c2), 2px 2px 0 var(--ex-c2), -1px -1px 0 color-mix(in srgb, var(--ex-c2) 70%, #000), 0 0 16px var(--ex-c2);
      opacity:0; animation:exName 1600ms cubic-bezier(.2,.8,.2,1) forwards; }
    @keyframes exName { 0%,12% { opacity:0; translate:46px 0; scale:1.35; } 24% { opacity:1; translate:0 0; scale:.96; } 30%,84% { opacity:1; scale:1; } 100% { opacity:0; translate:-20px 0; } }
    .ex-cutin__sub { margin-top:6px; font:800 11px/1.2 system-ui, sans-serif; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      opacity:0; animation:exTag 1600ms ease-out 60ms forwards; }
    .ex-cutin__flash { inset:0; background:#fff; opacity:0; animation:exFlash 1600ms linear forwards; }
    @keyframes exFlash { 0% { opacity:0; } 5% { opacity:.7; } 15% { opacity:0; } 84% { opacity:0; } 90% { opacity:.3; } 100% { opacity:0; } }
    .ex-cutin__motif { inset:0; }
    .ex-cutin__motif i { position:absolute; opacity:0; }
    /* 盾(みんなをかばう): 画面の中心から六角形の輪が広がる */
    .ex-cutin__motif--shield i { left:50%; top:50%; width:120px; height:120px; margin:-60px 0 0 -60px;
      clip-path:polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%);
      background:radial-gradient(circle, transparent 0 56%, var(--ex-c1) 60% 66%, color-mix(in srgb, var(--ex-c2) 70%, transparent) 70%, transparent 74%);
      animation:exShield 900ms ease-out forwards; animation-delay:calc(180ms + var(--i) * 110ms); }
    @keyframes exShield { 0% { opacity:0; transform:scale(.3); } 20% { opacity:1; } 100% { opacity:0; transform:scale(4.2); } }
    /* 炎(捨て身): 下から炎の舌が立ちのぼる */
    .ex-cutin__motif--flame i { bottom:-60px; left:calc(var(--i) * 17% - 4%); width:34%; height:62vh; border-radius:50% 50% 40% 40%;
      background:radial-gradient(ellipse at 50% 85%, #fff7 0 8%, var(--ex-c1) 18%, var(--ex-c2) 45%, transparent 70%); filter:blur(2px);
      animation:exFlame 1100ms ease-out forwards; animation-delay:calc(140ms + var(--i) * 60ms); }
    @keyframes exFlame { 0% { opacity:0; transform:translateY(40%) scaleY(.4); } 25% { opacity:.95; } 60% { opacity:.8; transform:translateY(0) scaleY(1.05) scaleX(.9); } 100% { opacity:0; transform:translateY(-18%) scaleY(1.2) scaleX(.7); } }
    /* 光(ガッツ全開っちー): 金の光の柱と粒が下から上へ */
    .ex-cutin__motif--rise i { bottom:0; left:calc(8% + var(--i) * 16%); width:10px; height:70vh; border-radius:999px;
      background:linear-gradient(0deg, transparent, var(--ex-c2) 30%, var(--ex-c1) 70%, #fff); box-shadow:0 0 14px var(--ex-c2);
      animation:exRise 1000ms ease-out forwards; animation-delay:calc(160ms + var(--i) * 70ms); }
    @keyframes exRise { 0% { opacity:0; transform:translateY(80%) scaleX(.5); } 30% { opacity:.95; } 100% { opacity:0; transform:translateY(-40%) scaleX(1.4); } }
    /* 斬撃(ソード・コンバージョン): 画面を斜めに横切る青い光の筋 */
    .ex-cutin__motif--blade i { left:-20%; top:calc(20% + var(--i) * 12%); width:140%; height:4px; border-radius:999px; transform-origin:0 50%;
      background:linear-gradient(90deg, transparent, var(--ex-c1) 30%, #fff 50%, var(--ex-c1) 70%, transparent); box-shadow:0 0 10px var(--ex-c2), 0 0 22px var(--ex-c2);
      rotate:calc(-24deg + (var(--i) - 2.5) * 6deg); animation:exBlade 520ms ease-out forwards; animation-delay:calc(200ms + var(--i) * 80ms); }
    @keyframes exBlade { 0% { opacity:0; transform:scaleX(0); } 30% { opacity:1; transform:scaleX(1); } 100% { opacity:0; transform:scaleX(1) translateY(6px); } }
    /* 使った子の距離枠の光 */
    .ex-aura { position:absolute; inset:-2px; z-index:57; pointer-events:none; border-radius:18px; opacity:0;
      border:2px solid var(--ex-c1); box-shadow:0 0 14px var(--ex-c2), inset 0 0 22px color-mix(in srgb, var(--ex-c2) 70%, transparent);
      animation:exAura 1600ms ease-out forwards; }
    @keyframes exAura { 0% { opacity:0; } 10% { opacity:1; } 30% { opacity:.55; } 45% { opacity:1; } 60% { opacity:.55; } 75% { opacity:1; } 100% { opacity:0; } }
    .ex-aura i { position:absolute; left:50%; top:50%; width:60px; height:60px; margin:-30px 0 0 -30px; border-radius:50%;
      border:3px solid var(--ex-c1); box-shadow:0 0 12px var(--ex-c2); animation:exAuraRing 800ms ease-out forwards; }
    .ex-aura i + i { animation-delay:260ms; }
    @keyframes exAuraRing { 0% { opacity:0; transform:scale(.3); } 25% { opacity:1; } 100% { opacity:0; transform:scale(2.6); } }
    @media (prefers-reduced-motion: reduce) {
      .ex-cutin__rays, .ex-cutin__motif, .ex-cutin__lines, .ex-aura i { display:none; }
      .ex-cutin__band { animation:exShade 1600ms ease-out forwards; transform:skewY(-7deg); }
    }
    /* 敵の側に出す着弾(24-battle-fx.jsx の AttackTargetFx)。敵の丸枠の中心に重ね、攻撃の尺の中で消える。 */
    .atk-target-fx { position:absolute; left:50%; top:50%; width:0; height:0; z-index:9500; pointer-events:none; overflow:visible; }
    /* 図鑑などのプレビューでは敵が居ないので、「敵の位置」(--atk-dx/dy)へずらして重ねる */
    .atk-target-fx-anchor { position:absolute; inset:0; pointer-events:none; overflow:visible; translate:var(--atk-dx) var(--atk-dy); }
    .atk-target-fx__core {
      position:absolute; left:-46px; top:-46px; width:92px; height:92px; border-radius:50%; opacity:0;
      background:radial-gradient(circle,#fff 0 10%,rgba(254,240,138,.95) 22%,rgba(249,115,22,.62) 42%,rgba(220,38,38,0) 70%);
      animation:atkTargetCore 270ms ease-out forwards; animation-delay:180ms;
    }
    .atk-target-fx__ring {
      position:absolute; left:-24px; top:-24px; width:48px; height:48px; border-radius:50%; opacity:0;
      border:4px solid rgba(255,251,235,.95); box-shadow:0 0 10px #fff,0 0 22px rgba(251,146,60,.9);
      animation:atkTargetRing 250ms ease-out forwards; animation-delay:190ms;
    }
    .atk-target-fx__ray {
      position:absolute; left:-3px; top:-34px; width:6px; height:26px; border-radius:999px; opacity:0;
      transform-origin:50% 34px; rotate:var(--atk-ray-angle);
      background:linear-gradient(to top,rgba(255,255,255,0),#fff 40%,rgba(253,224,71,.95));
      box-shadow:0 0 6px rgba(253,224,71,.9);
      animation:atkTargetRay 230ms ease-out forwards; animation-delay:190ms;
    }
    /* 固有技の突進は一回り大きく、少し早く当たる(specialLunge の当たる瞬間に合わせる) */
    .atk-target-fx--special .atk-target-fx__core { left:-64px; top:-64px; width:128px; height:128px; animation-delay:160ms;
      background:radial-gradient(circle,#fff 0 10%,rgba(245,208,254,.95) 22%,rgba(217,70,239,.62) 42%,rgba(126,34,206,0) 70%); }
    .atk-target-fx--special .atk-target-fx__ring { animation-delay:170ms; border-width:5px; box-shadow:0 0 12px #fff,0 0 26px rgba(217,70,239,.95); }
    .atk-target-fx--special .atk-target-fx__ray { animation-delay:170ms; height:34px; top:-44px; transform-origin:50% 44px; }
    @keyframes atkTargetCore { 0% { opacity:0; transform:scale(.3); } 25% { opacity:1; transform:scale(1); } 100% { opacity:0; transform:scale(1.7); } }
    @keyframes atkTargetRing { 0% { opacity:0; transform:scale(.3); } 25% { opacity:1; } 100% { opacity:0; transform:scale(2.6); } }
    @keyframes atkTargetRay { 0% { opacity:0; transform:translateY(8px) scaleY(.4); } 30% { opacity:1; } 100% { opacity:0; transform:translateY(-22px) scaleY(1.1); } }
    /* ザン・エイキの斬撃。敵を横切る光の筋を、斬り抜ける瞬間ごとに1本ずつ走らせる */
    .atk-target-fx__slash {
      position:absolute; left:-80px; top:-5px; width:160px; height:10px; opacity:0; border-radius:999px;
      rotate:var(--atk-slash-angle);
      clip-path:polygon(0 50%,12% 20%,80% 0,100% 50%,80% 100%,12% 80%);
      background:linear-gradient(90deg,rgba(255,255,255,0),rgba(103,232,249,.95) 22%,#fff 50%,rgba(103,232,249,.95) 78%,rgba(255,255,255,0));
      box-shadow:0 0 8px #fff,0 0 18px rgba(34,211,238,.9);
      animation:atkTargetSlash 140ms ease-out forwards;
    }
    .atk-target-fx--eiki .atk-target-fx__slash {
      background:linear-gradient(90deg,rgba(255,255,255,0),rgba(249,168,212,.95) 22%,#fff 50%,rgba(249,168,212,.95) 78%,rgba(255,255,255,0));
      box-shadow:0 0 8px #fff,0 0 18px rgba(236,72,153,.9);
    }
    @keyframes atkTargetSlash { 0% { opacity:0; transform:scaleX(.1); } 35% { opacity:1; transform:scaleX(1); } 100% { opacity:0; transform:scaleX(1.25) scaleY(.4); } }
    .atk-target-fx__bloom {
      position:absolute; left:-40px; top:-40px; width:80px; height:80px; border-radius:50%; opacity:0;
      background:radial-gradient(circle,#fff 0 12%,rgba(165,243,252,.85) 30%,rgba(34,211,238,.4) 50%,rgba(34,211,238,0) 70%);
      animation:atkTargetCore 120ms ease-out forwards; animation-delay:190ms;
    }
    .atk-target-fx--eiki .atk-target-fx__bloom {
      left:-56px; top:-56px; width:112px; height:112px;
      background:radial-gradient(circle,#fff 0 12%,rgba(251,207,232,.95) 28%,rgba(236,72,153,.5) 48%,rgba(236,72,153,0) 70%);
      animation-duration:140ms; animation-delay:330ms;
    }
    @media (prefers-reduced-motion: reduce) {
      @keyframes eikiSakuraDash {
        0% { filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
        50% { filter:drop-shadow(0 0 20px rgba(244,114,182,.95)); }
        100% { filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
      }
      .atk-target-fx__ray, .atk-target-fx__slash { display:none; }
    }
    @keyframes specialCharge {
      0% { transform: translateY(0) scale(1); filter: drop-shadow(0 0 6px rgba(168,85,247,0.5)); }
      40% { transform: translateY(34px) scale(0.82) rotate(-3deg); filter: drop-shadow(0 0 16px rgba(168,85,247,0.9)); }
      100% { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
    }
    @keyframes skillNamePop {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    /* ==== タクティクス新盤面の飾り(2026-09-24 ユーザー指示「モンスター枠やカードの絵をもっと高級感というか
       いいかんじに」「動きを付ける・枠の中に景色や模様・カードを本格的なカードゲーム風に」「距離ごとの色は取り入れて」)。
       ★効くのは data-tactics-look を持つバトル画面(新しい盤面のタクティクス)だけ。クラシックの手札は変えない。
       ★軽量表示(calm)と「動きを減らす」設定の端末では動きを止め、見た目だけ残す。
       ★枠の box-shadow は触らない。置ける枠の黄色い輪・選んだ枠の輪は Tailwind の ring(box-shadow)で出ているため。
         BREAK 中の枠(data-distance-broken)も、赤黒の警告を消さないよう飾りを外す ==== */
    @property --mh-ang { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    @keyframes mhAng { to { --mh-ang: 360deg; } }
    @keyframes mhShine { 0%, 72% { transform: translateX(-160%) skewX(-18deg); } 100% { transform: translateX(330%) skewX(-18deg); } }
    @keyframes mhCircle { to { transform: translate(-50%, -50%) rotateX(66deg) rotate(360deg); } }
    @keyframes mhGem { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
    @keyframes mhTwinkle { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    [data-tactics-look] [data-slot-index="0"] { --mh-rc: 239,68,68; --mh-rc2: 255,210,190;
      --mh-pat: radial-gradient(120% 60% at 50% 115%, rgba(255,120,40,.5), rgba(200,30,20,.22) 45%, transparent 70%) padding-box,
        repeating-linear-gradient(115deg, rgba(255,90,40,.10) 0 3px, transparent 3px 14px) padding-box; }
    [data-tactics-look] [data-slot-index="1"] { --mh-rc: 245,158,11; --mh-rc2: 255,240,160;
      --mh-pat: repeating-conic-gradient(from 0deg at 20% 62%, rgba(255,210,80,.15) 0 6deg, transparent 6deg 18deg) padding-box,
        radial-gradient(60% 60% at 20% 62%, rgba(255,200,60,.32), transparent 70%) padding-box; }
    /* 中距離は「翡翠の菱格子と丘の稜線」。零の熱と一方向の斜線・近の光線・遠の波紋(同心円)と形が重ならないように、
       2方向に交わる細い線(菱形の格子)を全体に敷き、下に丘の稜線を1本だけ光らせる。
       (2026-09-24 ユーザー指摘「遠と同じはおかしい」→草の縦縞にしたが「ださい」と言われ作り直した) */
    [data-tactics-look] [data-slot-index="2"] { --mh-rc: 16,185,129; --mh-rc2: 190,255,220;
      --mh-pat: radial-gradient(95% 30% at 30% 106%, rgba(16,185,129,.20) 0 96%, rgba(110,231,183,.6) 98%, transparent 100%) padding-box,
        repeating-linear-gradient(60deg, rgba(52,211,153,.19) 0 1px, transparent 1px 11px) padding-box,
        repeating-linear-gradient(120deg, rgba(52,211,153,.19) 0 1px, transparent 1px 11px) padding-box,
        radial-gradient(70% 60% at 20% 62%, rgba(40,200,130,.30), transparent 70%) padding-box; }
    [data-tactics-look] [data-slot-index="3"] { --mh-rc: 59,130,246; --mh-rc2: 200,225,255;
      --mh-pat: repeating-radial-gradient(circle at 20% 140%, rgba(90,160,255,.17) 0 3px, transparent 3px 11px) padding-box,
        radial-gradient(70% 60% at 20% 62%, rgba(80,150,255,.32), transparent 70%) padding-box; }
    [data-tactics-look] [data-slot-index]:not([data-distance-broken]) {
      border-width: 2px !important; border-color: transparent !important; border-radius: 16px !important;
      background: var(--mh-pat),
        linear-gradient(170deg, rgba(16,18,34,.95), rgba(5,6,14,.98)) padding-box,
        conic-gradient(from var(--mh-ang), rgba(var(--mh-rc),1), rgba(var(--mh-rc2),1) 10%, rgba(var(--mh-rc),1) 22%, rgba(30,12,12,.9) 45%,
          rgba(var(--mh-rc),1) 70%, #fff 76%, rgba(var(--mh-rc),1) 82%) border-box !important; }
    /* ★縁の光は回さず、明るい弧のある縁で止める。角度(--mh-ang)を変えると枠の中身ごと描き直しになり、
         1秒20回に落としても4枠で本体の負担が 13% → 41% に上がった(2026-09-24 計測)。
         動きは、縁の上を時々横切る光の筋(data-slot-ring の中の ::before。transform だけなので描き直しが要らない)で出す */
    [data-tactics-look] [data-slot-index]:not([data-distance-broken]) { --mh-ang: 35deg; }
    /* 縁を回る光(2026-09-24 ユーザー指摘「バトル画面にかくつきを感じる」で作り直した)。
       ★もとは conic-gradient の角度(--mh-ang)を毎コマ変えていた。これは縁の塗りを毎コマ描き直すので、
         枠4つ＋手札5枚でスマホ相当の速さだと 60コマ→27コマまで落ちていた。
         いまは縁の形に切り抜いた箱(mask)の中で、大きな光の輪を transform で回すだけ(描き直しが要らない) */
    @keyframes mhSpin { to { transform: rotate(360deg); } }
    /* ==== 発熱対策(2026-09-24 ユーザー指摘「発熱がすごい」「熱くなるとカクついて動かなくなる」) ====
       ① 何も起きていない間(data-fx-rest)は、バトル画面の動きをすべて一時停止する。止めるだけなので、触れば同じ場所から動き出す。
       ② 動き続ける層に付いた影(filter)を外す。iPhone では、動く層の影は毎コマ GPU でぼかし直しになる。
          外すのは見た目にほとんど効いていないもの(味方の影は濃さ 7%)と、足元の影・光の輪で代わりが出ているものだけ */
    [data-tactics-look][data-fx-rest] *, [data-tactics-look][data-fx-rest] *::before, [data-tactics-look][data-fx-rest] *::after { animation-play-state: paused !important; }
    /* ==== 画面の軽さ(バトル設定。data-fx-level)(2026-09-24 ユーザー指示「バトル設定で軽い画面でも出来るの作って 4種類ぐらい」) ====
       標準: 枠・カード・輪の飾りの動き(光の筋・またたき・回転・ライフの帯の光)を止める。見た目は止まった形で残る。
             モンスターの待機の動き・攻撃の演出はそのまま
       軽め: data-tactics-look が calm になり、待機の動きも止まる(ここではすりガラスも外す)
       最軽量: 60-app が軽量表示(liteBattleView)にする */
    [data-tactics-look][data-fx-level="STANDARD"] :is([data-slot-ring], [data-card-shine], [data-enemy-ring])::before,
    [data-tactics-look][data-fx-level="STANDARD"] :is([data-slot-index], [data-card-gem], [data-enemy-hpbar])::after,
    [data-tactics-look][data-fx-level="STANDARD"] [data-slot-circle] { animation: none !important; }
    [data-tactics-look]:is([data-fx-level="LIGHT"], [data-fx-level="MINIMAL"]) * { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
    /* 最軽量は、次の行動の札・狙われている枠の点滅(animate-pulse)も止め、何も動き続けない画面にする */
    [data-tactics-look][data-fx-level="MINIMAL"] .animate-pulse { animation: none !important; }
    /* WAVEのあとの画面(強化フェーズ)も、標準では飾りの動きだけを止める(軽め・最軽量は data-phase-look が calm になる) */
    /* ★:is() の中に ::before などを書くと規則ごと無効になるので、擬似要素は外に出す */
    [data-fx-level="STANDARD"] :is(.mh-ph-sparkle, .mh-ph-rune, .mh-ph-floor, .mh-ph-pip[data-next]),
    [data-fx-level="STANDARD"] :is(.mh-ph-shine, .mh-ph-btn-gold)::before, [data-fx-level="STANDARD"] :is(.mh-ph-gem, .mh-ph-btn-gold)::after { animation: none !important; }
    [data-tactics-look] .mon-idle--rig { filter: none !important; }
    /* 味方の絵の影(drop-shadow-md。濃さ 6〜7%)も外す。待機の動きで揺れているので、4体ぶん毎コマ影を描き直していた */
    [data-tactics-look] .mon-idle img { filter: none !important; }
    /* 手のひらは技のあいだだけ見せる */
    [data-tactics-look] [data-enemy-skill] > [data-kz-palm], [data-tactics-look] [data-enemy-attack] > [data-kz-palm] { visibility: visible; }
    [data-tactics-look] [data-enemy-motion] > span > img { filter: none !important; }
    [data-tactics-look] [data-enemy-ring]::before, [data-tactics-look] [data-slot-circle] { filter: none !important; }
    /* 覚醒ムー戦の重なり順(2026-09-24 ユーザー指摘「ムー戦だけボタンとか色々裏に回ってる」)。
       覚醒ムーの大きな絵(z-30)は、端を切り抜きでぼかして下のボタンや枠を透かしていた。iPhone で切り抜きが外れると
       ログ・解析・ステータスのボタン(z-20)と味方の枠の段(z-10)が絵の裏に隠れた。
       攻撃していないあいだ(data-moo-front)は、ボタンと枠の段を絵より前へ出す。攻撃の瞬間は絵を前に出したまま */
    [data-tactics-look][data-moo-front] :is([data-battle-log-button], button[aria-label="敵を解析する"], button[aria-label="勇者モンのステータス"]) { z-index: 45 !important; }
    [data-tactics-look][data-moo-front] [data-tactics-board-band] { z-index: 45 !important; }
    /* 覚醒ムーの紫の光(もとは絵に drop-shadow 55px)は、絵の後ろに置いた動かない光で出す */
    [data-tactics-look] [data-moo-body] > img { filter: none !important; }
    [data-tactics-look] [data-moo-body]::before { content: ''; position: absolute; inset: 4%; border-radius: 50%; pointer-events: none; z-index: 0;
      background: radial-gradient(closest-side, rgba(168,85,247,.55), rgba(168,85,247,.25) 55%, rgba(168,85,247,0) 80%); }
    /* ★すりガラス(backdrop-filter)を外す(2026-09-24 ユーザー指摘「バトル画面にかくつきを感じる」)。
       枠・見出し・ライフの札の下地はもともと 72〜98% の濃さで、ぼかしはほとんど見えていなかった。
       それでいて枠の中は入れ子で9か所ぼかしていて、ライフの札は跳ねている味方の絵の真上にあるため、
       絵が動くたびに毎コマぼかし直しになっていた(iPhone でいちばん重い処理のひとつ) */
    [data-tactics-look] [data-slot-index], [data-tactics-look] [data-slot-head], [data-tactics-look] [data-tactics-party-slot] {
      -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
    /* ★回る光は出さない(2026-09-24 ユーザー報告「こんな画面になってフリーズする」)。
       縁の形に切り抜いた箱の中で大きな光の輪(縁の約3倍の板)を回していたが、iPhone で板が9枚ぶん重なると
       切り抜きが外れて板がそのまま見え(カードの中身が隠れる)、固まることがあった。
       縁は上の conic-gradient(border-box)で、光ったまま止まった見た目にする */
    [data-tactics-look] [data-slot-ring] { position: absolute; inset: -2px; border-radius: 16px; overflow: hidden; pointer-events: none; z-index: 1; }
    [data-tactics-look] [data-slot-ring]::before { content: ''; position: absolute; top: -20%; bottom: -20%; left: 0; width: 26%;
      background: linear-gradient(90deg, transparent, rgba(var(--mh-rc2),.22), rgba(255,255,255,.45), rgba(var(--mh-rc2),.22), transparent);
      transform: translateX(-160%) skewX(-18deg); }
    [data-tactics-look="rich"] [data-slot-ring]::before { animation: mhShine 5.2s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-slot-index="1"] > [data-slot-ring]::before { animation-delay: 1.3s; }
    [data-tactics-look="rich"] [data-slot-index="2"] > [data-slot-ring]::before { animation-delay: 2.6s; }
    [data-tactics-look="rich"] [data-slot-index="3"] > [data-slot-ring]::before { animation-delay: 3.9s; }
    [data-tactics-look] [data-distance-broken] > [data-slot-ring] { display: none; }
    /* 外へにじむ距離色の光(box-shadow を使わずに足す) */
    [data-tactics-look] [data-slot-index]:not([data-distance-broken])::before { content: ''; position: absolute; inset: -2px; border-radius: 16px;
      pointer-events: none; box-shadow: 0 0 14px rgba(var(--mh-rc),.5), inset 0 0 18px rgba(var(--mh-rc),.2); }
    /* 光の粒 */
    [data-tactics-look] [data-slot-index]:not([data-distance-broken])::after { content: ''; position: absolute; inset: 3px; border-radius: 13px; pointer-events: none;
      background: radial-gradient(1.5px 1.5px at 14% 30%, rgba(var(--mh-rc2),.95), transparent 70%), radial-gradient(1.5px 1.5px at 52% 70%, rgba(var(--mh-rc2),.85), transparent 70%),
        radial-gradient(1px 1px at 78% 40%, #fff, transparent 70%), radial-gradient(1px 1px at 36% 18%, #fff, transparent 70%); }
    [data-tactics-look="rich"] [data-slot-index]:not([data-distance-broken])::after { animation: mhTwinkle 2.6s ease-in-out infinite; }
    [data-tactics-look] [data-slot-head] { background: linear-gradient(90deg, rgba(var(--mh-rc),.7), rgba(var(--mh-rc),.16) 65%, transparent) !important;
      border-bottom-color: rgba(var(--mh-rc2),.5) !important; }
    [data-tactics-look] [data-slot-head] span { text-shadow: 0 1px 3px rgba(0,0,0,.9); }
    /* 足元の魔法陣 */
    [data-tactics-look] [data-slot-circle] { position: absolute; left: 50%; top: calc(50% + 26px); width: 58px; height: 58px; z-index: 0; pointer-events: none;
      transform: translate(-50%, -50%) rotateX(66deg);
      /* ★切り抜き(mask)を使わず、もとの模様(内と外の輪・あいだの目盛り)を SVG で描く(外れると四角い光の板が出たため) */
      background: center / 100% 100% no-repeat; }
    [data-tactics-look] [data-slot-index="0"] [data-slot-circle] { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='43.3' fill='none' stroke='rgba(255,210,190,.8)' stroke-width='14' stroke-dasharray='3.02 19.65'/><circle cx='50' cy='50' r='38.2' fill='none' stroke='rgba(255,210,190,.95)' stroke-width='2.8'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(239,68,68,.9)' stroke-width='2.6'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(239,68,68,.3)' stroke-width='5'/></svg>"); }
    [data-tactics-look] [data-slot-index="1"] [data-slot-circle] { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='43.3' fill='none' stroke='rgba(255,240,160,.8)' stroke-width='14' stroke-dasharray='3.02 19.65'/><circle cx='50' cy='50' r='38.2' fill='none' stroke='rgba(255,240,160,.95)' stroke-width='2.8'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(245,158,11,.9)' stroke-width='2.6'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(245,158,11,.3)' stroke-width='5'/></svg>"); }
    [data-tactics-look] [data-slot-index="2"] [data-slot-circle] { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='43.3' fill='none' stroke='rgba(190,255,220,.8)' stroke-width='14' stroke-dasharray='3.02 19.65'/><circle cx='50' cy='50' r='38.2' fill='none' stroke='rgba(190,255,220,.95)' stroke-width='2.8'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(16,185,129,.9)' stroke-width='2.6'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(16,185,129,.3)' stroke-width='5'/></svg>"); }
    [data-tactics-look] [data-slot-index="3"] [data-slot-circle] { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='43.3' fill='none' stroke='rgba(200,225,255,.8)' stroke-width='14' stroke-dasharray='3.02 19.65'/><circle cx='50' cy='50' r='38.2' fill='none' stroke='rgba(200,225,255,.95)' stroke-width='2.8'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(59,130,246,.9)' stroke-width='2.6'/><circle cx='50' cy='50' r='48.4' fill='none' stroke='rgba(59,130,246,.3)' stroke-width='5'/></svg>"); }
    [data-tactics-look="rich"] [data-slot-circle] { animation: mhCircle 6s linear infinite; }
    /* 手札: 金の縁・模様・光の筋・宝石 */
    /* isolation で手札1枚ぶんの重なりの世界を作り、模様(z-index:-1)を「カードの地の上・中身の下」に置く */
    [data-tactics-look] [data-hand-card] { border-color: transparent !important; isolation: isolate; }
    [data-tactics-look] [data-card-frame] { position: absolute; inset: -1px; border-radius: 12px; padding: 2px; pointer-events: none; z-index: 6;
      /* ★切り抜き(mask)を使わず、もとの金のグラデーションの縁を SVG の枠線で描く(外れるとカードが金色の板で埋まったため) */
      padding: 0; background: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 74 135' preserveAspectRatio='none'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%238a6220'/><stop offset='.1' stop-color='%23fff3c4'/><stop offset='.25' stop-color='%23c8962e'/><stop offset='.5' stop-color='%23fff0b0'/><stop offset='.7' stop-color='%238a6220'/><stop offset='.85' stop-color='%23f4d57c'/><stop offset='1' stop-color='%238a6220'/></linearGradient></defs><rect x='1' y='1' width='72' height='133' rx='11' fill='none' stroke='url(%23g)' stroke-width='2' vector-effect='non-scaling-stroke'/></svg>") center / 100% 100% no-repeat; }
    /* 金の縁は回さない(上の data-slot-ring と同じ理由。回る光の輪で固まることがあった) */
    [data-tactics-look] [data-card-pattern] { position: absolute; inset: 0; border-radius: 11px; pointer-events: none; z-index: -1;
      background: radial-gradient(80% 50% at 50% 28%, rgba(255,255,255,.2), transparent 70%); }
    [data-tactics-look] [data-card-pattern="攻撃"] { background: repeating-linear-gradient(135deg, rgba(0,0,0,.18) 0 2px, transparent 2px 8px), radial-gradient(80% 50% at 50% 28%, rgba(255,255,255,.2), transparent 70%); }
    [data-tactics-look] [data-card-pattern="守り"] { background: radial-gradient(circle, rgba(255,255,255,.16) 1.5px, transparent 2px) 0 0 / 8px 8px, radial-gradient(80% 50% at 50% 28%, rgba(255,255,255,.2), transparent 70%); }
    [data-tactics-look] [data-card-pattern="支援"], [data-tactics-look] [data-card-pattern="回復"] {
      background: repeating-conic-gradient(from 0deg at 50% 30%, rgba(255,255,255,.13) 0 10deg, transparent 10deg 30deg), radial-gradient(80% 50% at 50% 28%, rgba(255,255,255,.2), transparent 70%); }
    [data-tactics-look] [data-card-shine] { position: absolute; inset: 0; border-radius: 11px; overflow: hidden; pointer-events: none; z-index: 5; }
    [data-tactics-look] [data-card-shine]::before { content: ''; position: absolute; top: -10%; bottom: -10%; left: 0; width: 40%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.5), transparent); transform: translateX(-160%) skewX(-18deg); }
    [data-tactics-look="rich"] [data-card-shine]::before { animation: mhShine 3.4s ease-in-out infinite; }
    [data-tactics-look] [data-card-gem] { position: absolute; left: 1px; top: 1px; width: 22px; height: 22px; z-index: 7; pointer-events: none;
      display: flex; align-items: center; justify-content: center; padding-top: 2px; font: 900 10px/1 system-ui, sans-serif; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.9);
      background: radial-gradient(circle at 35% 30%, #fff 0 8%, #7fd8ff 18%, #1f6fd1 55%, #0b2e6b 100%);
      clip-path: polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%); }
    /* 宝石のまたたき。明るさ(filter)を変えると描き直しになるので、上に重ねた光の濃さ(opacity)だけを変える */
    [data-tactics-look] [data-card-gem]::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.75), rgba(255,255,255,0) 60%); }
    [data-tactics-look="rich"] [data-card-gem]::after { animation: mhGemGlow 2.2s ease-in-out infinite; }
    @keyframes mhGemGlow { 0%, 100% { opacity: 0; } 50% { opacity: .55; } }
    [data-tactics-look] [data-hand-card] [data-decoration] { border-radius: 8px !important; border: 2px solid #f3d27a !important;
      background: radial-gradient(circle at 50% 35%, rgba(255,255,255,.25), rgba(0,0,0,.35)) !important;
      box-shadow: 0 0 0 2px rgba(60,40,10,.9), 0 0 12px rgba(255,210,120,.55), inset 0 0 10px rgba(0,0,0,.5) !important; }
    [data-tactics-look] [data-card-name] { text-shadow: 0 1px 0 rgba(0,0,0,.85), 0 0 4px rgba(0,0,0,.6); }
    /* 固有技(金色のカード)は字の色が黒(TYPE_INLINE_STYLE)で、上の黒い影と地の模様に埋もれて読みにくかった
       (2026-09-24 ユーザー指摘「固有技の濃い字の黒が見にくい」)。新しい盤面の手札だけ、白い字に濃い茶色の縁取りにする */
    [data-tactics-look] [data-hand-card][data-card-type="unique"] [data-card-name] { color: #fff;
      text-shadow: 1px 1px 0 #4a2e00, -1px -1px 0 #4a2e00, 1px -1px 0 #4a2e00, -1px 1px 0 #4a2e00, 0 1px 3px rgba(40,24,0,.95), 0 0 6px rgba(80,50,0,.8); }
    /* ==== 敵のまわりも同じ飾りにそろえる(2026-09-24 ユーザー指示「同じように敵領域にあるボタンや表示関係も見た目よくして」)。
       金の細い縁取り・ガラスの照り・距離の色の光、を枠やカードと共通の言葉で使う。
       ★ボタンの役割の色(青=勇者・赤=敵・琥珀=記録)は残す。縁取りと照りを重ねるだけ ==== */
    @keyframes mhBarShine { 0%, 65% { transform: translateX(-120%); } 100% { transform: translateX(420%); } }
    @keyframes mhRuneSpin { to { transform: rotate(360deg); } }
    [data-tactics-look] [data-battle-header] { background: linear-gradient(180deg, #161c38, #0a0e1f) !important; border-bottom: 1px solid rgba(243,210,122,.5) !important;
      box-shadow: 0 2px 12px rgba(0,0,0,.6), inset 0 -1px 0 rgba(255,230,160,.12); }
    [data-tactics-look] [data-enemy-bar] { background: linear-gradient(180deg, rgba(30,10,16,.96), rgba(10,6,12,.97)) !important; border-bottom: 1px solid rgba(243,210,122,.35) !important; }
    [data-tactics-look] [data-enemy-hpbar] { border-color: #d4af5a !important; height: 16px !important;
      box-shadow: 0 0 0 1px rgba(40,26,6,.9), 0 0 10px rgba(239,68,68,.35), inset 0 2px 6px rgba(0,0,0,.85) !important; }
    [data-tactics-look] [data-enemy-hpbar]::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 22%; pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); transform: translateX(-120%); }
    [data-tactics-look="rich"] [data-enemy-hpbar]::after { animation: mhBarShine 4s ease-in-out infinite; }
    /* 舞台の四隅のボタンと、手札の上の操作ボタン */
    [data-tactics-look] [data-battle-log-button], [data-tactics-look] button[aria-label="敵を解析する"], [data-tactics-look] button[aria-label="勇者モンのステータス"],
    [data-tactics-look] [data-battle-view-button], [data-tactics-look] button[aria-label="緊急回復"], [data-tactics-look] button[aria-label^="AUTO"] {
      border-color: rgba(243,210,122,.55) !important;
      background-image: linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 45%, rgba(0,0,0,.25)) !important;
      box-shadow: 0 0 0 1px rgba(20,12,4,.85), 0 4px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,240,200,.35), 0 0 8px rgba(243,210,122,.18) !important; }
    [data-tactics-look] [data-battle-menu-button] { border: 1px solid rgba(243,210,122,.55) !important; box-shadow: inset 0 1px 0 rgba(255,240,200,.3); }
    /* ACTION(押せるとき)は金の縁と照り */
    [data-tactics-look] [data-battle-action]:not(:disabled) { box-shadow: 0 0 0 2px #d4af5a, 0 0 0 3px rgba(40,26,6,.9), 0 0 16px rgba(255,210,120,.55), inset 0 2px 0 rgba(255,255,255,.6) !important; }
    /* 敵の行動の札と、強化の札の帯 */
    [data-tactics-look] [data-enemy-intent] { box-shadow: 0 0 0 1px rgba(243,210,122,.6), 0 0 0 2px rgba(30,10,10,.9), 0 6px 16px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,240,200,.25) !important; }
    [data-tactics-look] [data-battle-buffs] { border-top: 1px solid rgba(243,210,122,.3); border-bottom: 1px solid rgba(243,210,122,.3);
      background: linear-gradient(180deg, rgba(14,18,36,.96), rgba(6,8,18,.96)) !important; }
    /* 敵の絵の右上の技の札(3連撃！など)。色と光(box-shadow)は技の種類のまま残し、金の縁は outline で重ねる */
    [data-tactics-look] [data-enemy-notice] { outline: 1.5px solid rgba(243,210,122,.9); outline-offset: 1px;
      background-image: linear-gradient(180deg, rgba(255,255,255,.28), rgba(255,255,255,0) 50%) !important; }
    /* 敵の攻撃・ためるは絵だけを動かす(丸枠とルーンの輪はその場に残す)。> span は敵の絵を包む要素 */
    [data-tactics-look] [data-enemy-ring][data-enemy-attack="fly"] > span { display: block; position: relative; z-index: 9999; animation: enemyAttackFly 450ms ease-in forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-attack="charge"] > span { display: block; position: relative; animation: enemyChargeShake 1100ms ease-in-out forwards; }
    /* ==== 敵ごとの動き(2026-09-24 ユーザー指示「待機時間も動いてる感じに」「実際に動いてるように」「まずはカワズモー」)。
       絵は1枚のまま。支点は足元(transform-origin 50% 92%)にして、伸び縮み・傾き・重心移動で「生きている」ように見せる。
       待機は絵(img)、攻撃・ためる・やられは絵を包む要素(span)へ掛ける。足元の影も同じ拍子で伸び縮みさせる ==== */
    /* カワズモー(力士のカエル): 待機は左右に重心を移しながらお腹で呼吸 / 攻撃は のけぞって溜め→踏み込んで張り手→戻る /
       ためるは 片足を上げて四股を踏む / やられは のけぞって震える */
    /* 2026-09-24 ユーザー指摘「思ってたより地味。もっと頑張って動き作れない？」で動きを大きく作り直した。
       待機は6秒で1巡: 大きく揺れて呼吸(0〜50%) → 片足を上げて四股・土ぼこり(52〜76%) → 小さく跳ねて着地(80〜96%)。
       ★左右の反転(横を向く)は入れない(2026-09-24 ユーザー指摘「反転はださいだけ」) */
    @keyframes kzIdle {
      0%, 100% { transform: translateX(0) rotate(0) scale(1, 1); }
      8% { transform: translateX(-8px) rotate(-6deg) scale(1.07, .94); }
      16% { transform: translateX(0) rotate(0) scale(.96, 1.05); }
      24% { transform: translateX(8px) rotate(6deg) scale(1.07, .94); }
      32% { transform: translateX(0) rotate(0) scale(.96, 1.05); }
      40% { transform: translateX(-8px) rotate(-6deg) scale(1.07, .94); }
      48% { transform: translateX(0) rotate(0) scale(1, 1); }
      54% { transform: translate(-6px, -4px) rotate(-12deg) scale(.95, 1.07); }
      60% { transform: translate(-8px, -16px) rotate(-17deg) scale(.94, 1.09); }
      63% { transform: translate(-7px, -15px) rotate(-16deg) scale(.94, 1.09); }
      66% { transform: translate(0, 4px) rotate(0) scale(1.24, .8); }
      69% { transform: translate(0, -3px) rotate(0) scale(.95, 1.07); }
      73% { transform: translate(0, 0) rotate(0) scale(1.04, .97); }
      80% { transform: translateY(2px) scale(1.08, .92); }
      84% { transform: translateY(-10px) scale(.94, 1.08); }
      88% { transform: translateY(2px) scale(1.1, .9); }
      92% { transform: translateY(-4px) scale(.97, 1.04); }
      96% { transform: translateY(0) scale(1.02, .98); }
    }
    @keyframes kzShadow {
      0%, 16%, 32%, 48%, 78%, 100% { transform: translateX(-50%) scaleX(1); opacity: 1; }
      8%, 40% { transform: translateX(calc(-50% - 8px)) scaleX(1.12); }
      24% { transform: translateX(calc(-50% + 8px)) scaleX(1.12); }
      60%, 63% { transform: translateX(calc(-50% - 6px)) scaleX(.8); opacity: .7; }
      66% { transform: translateX(-50%) scaleX(1.35); opacity: 1; }
      84% { transform: translateX(-50%) scaleX(.82); opacity: .75; }
      88% { transform: translateX(-50%) scaleX(1.18); opacity: 1; }
    }
    /* 四股の土ぼこり(影の左右から吹き出して消える)。待機の66%と、ためるの踏み込みに合わせる */
    @keyframes kzDustIdle {
      0%, 65%, 100% { opacity: 0; transform: translateX(0) scale(.3); }
      67% { opacity: .95; transform: translateX(0) scale(.6); }
      76% { opacity: 0; transform: translateX(var(--kz-dx)) scale(1.4); }
    }
    @keyframes kzDust {
      0%, 55% { opacity: 0; transform: translateX(0) scale(.3); }
      60% { opacity: .95; transform: translateX(0) scale(.7); }
      90%, 100% { opacity: 0; transform: translateX(var(--kz-dx)) scale(1.6); }
    }
    /* 張り手: 腰を落として右肩を引く → 左へひねりながら前へ押し出す(1発目) → 右へひねり返して押し込む(2発目) → 戻る */
    @keyframes kzSlap {
      0% { transform: none; }
      18% { transform: translate(6px, 4px) rotate(14deg) scale(1.1, .9); }
      36% { transform: translate(-10px, 46px) rotate(-16deg) scale(1.16, .9); }
      52% { transform: translate(10px, 70px) rotate(15deg) scale(1.2, .88); }
      66% { transform: translate(0, 60px) rotate(0) scale(1.12, .92); }
      100% { transform: none; }
    }
    /* 手のひら: 体の横から画面の手前へ大きく突き出る。左右で半拍ずらす。緑がかった色はカエルの手に寄せるため */
    @keyframes kzPalmL {
      0%, 22% { opacity: 0; transform: translate(-30px, -10px) rotate(-30deg) scale(.4); }
      34% { opacity: 1; transform: translate(-18px, 40px) rotate(-8deg) scale(1.5); }
      44% { opacity: .9; transform: translate(-14px, 70px) rotate(-4deg) scale(2.1); }
      54%, 100% { opacity: 0; transform: translate(-12px, 84px) rotate(0) scale(2.4); }
    }
    @keyframes kzPalmR {
      0%, 38% { opacity: 0; transform: translate(30px, -6px) rotate(30deg) scale(.4) scaleX(-1); }
      50% { opacity: 1; transform: translate(18px, 50px) rotate(8deg) scale(1.6) scaleX(-1); }
      60% { opacity: .9; transform: translate(14px, 80px) rotate(4deg) scale(2.2) scaleX(-1); }
      70%, 100% { opacity: 0; transform: translate(12px, 92px) rotate(0) scale(2.5) scaleX(-1); }
    }
    @keyframes kzImpact {
      0%, 48% { opacity: 0; transform: translateX(-50%) scale(.2); }
      56% { opacity: 1; transform: translateX(-50%) scale(1); }
      100% { opacity: 0; transform: translateX(-50%) scale(1.8); }
    }
    @keyframes kzStomp {
      0% { transform: none; }
      14% { transform: translateY(4px) scale(1.12, .88); }
      32% { transform: translate(-8px, -18px) rotate(-20deg) scale(.93, 1.1); }
      38% { transform: translate(-6px, -18px) rotate(-19deg) scale(.93, 1.1); }
      44% { transform: translate(-9px, -19px) rotate(-21deg) scale(.93, 1.1); }
      50% { transform: translate(-7px, -18px) rotate(-20deg) scale(.93, 1.1); }
      58% { transform: translateY(5px) rotate(0) scale(1.28, .76); }
      64% { transform: translate(-4px, 3px) scale(1.2, .82); }
      70% { transform: translate(4px, 3px) scale(1.2, .82); }
      78% { transform: translate(0, -4px) scale(.95, 1.07); }
      100% { transform: none; }
    }
    @keyframes kzHurt {
      0% { transform: none; }
      16% { transform: translate(12px, -8px) rotate(16deg) scale(.88, 1.1); }
      36% { transform: translate(-8px, 0) rotate(-8deg) scale(1.08, .94); }
      54% { transform: translate(5px, 0) rotate(4deg); }
      72% { transform: translate(-3px, 0) rotate(-2deg); }
      100% { transform: none; }
    }
    [data-tactics-look] [data-enemy-motion] > span { display: block; position: relative; transform-origin: 50% 92%; }
    [data-tactics-look] [data-enemy-motion] > span > img { transform-origin: 50% 92%; }
    [data-tactics-look="rich"] [data-enemy-motion="kawazumo"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation: kzIdle 6s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-enemy-motion="kawazumo"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > [data-enemy-shadow] { animation: kzShadow 6s ease-in-out infinite; }
    /* 土ぼこり: 影の左右に1つずつ */
    [data-tactics-look] [data-enemy-motion="kawazumo"] > [data-enemy-shadow]::before, [data-tactics-look] [data-enemy-motion="kawazumo"] > [data-enemy-shadow]::after {
      content: ''; position: absolute; bottom: 10%; width: 46%; height: 150%; border-radius: 50%; opacity: 0; pointer-events: none;
      background: radial-gradient(closest-side, rgba(214,196,160,.85), rgba(160,140,110,.45) 55%, transparent); }
    [data-tactics-look] [data-enemy-motion="kawazumo"] > [data-enemy-shadow]::before { left: -18%; --kz-dx: -26px; }
    [data-tactics-look] [data-enemy-motion="kawazumo"] > [data-enemy-shadow]::after { right: -18%; --kz-dx: 26px; }
    [data-tactics-look="rich"] [data-enemy-motion="kawazumo"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > [data-enemy-shadow]::before,
    [data-tactics-look="rich"] [data-enemy-motion="kawazumo"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > [data-enemy-shadow]::after { animation: kzDustIdle 6s ease-out infinite; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-attack="charge"] > [data-enemy-shadow]::before,
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-attack="charge"] > [data-enemy-shadow]::after { animation: kzDust var(--em-dur, 1100ms) ease-out forwards; }
    /* 張り手の衝撃: 丸枠の下に赤い輪が広がる */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"]::after { content: ''; position: absolute; left: 50%; bottom: -14%; width: 70%; height: 30%; border-radius: 50%;
      pointer-events: none; opacity: 0; z-index: 2;
      background: radial-gradient(closest-side, rgba(255,255,255,.95), rgba(248,113,113,.8) 35%, rgba(239,68,68,.35) 65%, transparent); }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-attack="fly"]::after { animation: kzImpact var(--em-dur, 450ms) ease-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-attack="fly"] > span { z-index: 9999; animation: kzSlap var(--em-dur, 450ms) ease-in forwards; }
    [data-tactics-look] [data-kz-palm] { font-style: normal; position: absolute; top: 42%; left: 50%; margin-left: -18px; width: 36px; text-align: center; font-size: 30px; line-height: 1;
      opacity: 0; visibility: hidden; pointer-events: none; z-index: 10000;
      filter: hue-rotate(20deg) saturate(.95) brightness(.95) drop-shadow(0 0 8px rgba(239,68,68,.85)) drop-shadow(0 4px 6px rgba(0,0,0,.6)); }
    /* 勢いの線(手のひらの後ろに伸びる白い筋) */
    [data-tactics-look] [data-kz-palm]::after { content: ''; position: absolute; left: 50%; top: -60%; width: 60%; height: 90%; margin-left: -30%; pointer-events: none;
      background: repeating-linear-gradient(90deg, rgba(255,255,255,.55) 0 2px, transparent 2px 6px); }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-attack="fly"] > [data-kz-palm="l"] { animation: kzPalmL var(--em-dur, 450ms) ease-out forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-attack="fly"] > [data-kz-palm="r"] { animation: kzPalmR var(--em-dur, 450ms) ease-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-attack="charge"] > span { animation: kzStomp var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-hurt] > span { animation: kzHurt 520ms ease-out forwards; }
    /* ---- カワズモーの技ごとの動き(2026-09-24 ユーザー指示「他の技も特徴付けたい」) ----
       data-enemy-skill に技の名前が入る(60-app の setEnemyAttackFx の skill)。長さは TACTICS_ENEMY_SKILL_MS とそろえる。
         normal はり手 … 上の kzSlap(左右の張り手2発)
         sweep かわずつき 450ms … 低く沈んで横から飛び込む。弧の斬り跡
         rush 連続はり手 750ms … 左右にひねりながら張り手を6発
         pierce 上手投げ 900ms … 手を伸ばしてつかむ → 後ろへ持ち上げる → 前へ投げ落とす。赤い一直線
         special 大回転落とし 1100ms … 跳んで2回転 → 真下へ落ちる。金の渦と大きな衝撃
         allout 大投げたまや 1000ms … 担いで振りかぶり、投げ放つ。頭上に花火
         charge 必殺技準備 … 深く構えて震え、金色に光が溜まる / pierceCharge … 両手を広げて差し手を狙う / roar しこ踏み … kzStomp
         regen かえるのうた 1000ms … 揺れながら歌う。音符が昇る */
    @keyframes kzLunge {
      0% { transform: none; }
      28% { transform: translate(-26px, 10px) rotate(-12deg) scale(1.2, .8); }
      58% { transform: translate(30px, 74px) rotate(14deg) scale(1.26, .86); }
      72% { transform: translate(22px, 66px) rotate(8deg) scale(1.18, .9); }
      100% { transform: none; }
    }
    @keyframes kzSweepArc {
      0%, 30% { opacity: 0; transform: translateX(-50%) rotate(-38deg) scaleX(.5); }
      50% { opacity: 1; transform: translateX(-50%) rotate(-6deg) scaleX(1); }
      72% { opacity: .9; transform: translateX(-50%) rotate(22deg) scaleX(1.1); }
      100% { opacity: 0; transform: translateX(-50%) rotate(34deg) scaleX(1.15); }
    }
    @keyframes kzRush {
      0% { transform: none; }
      10% { transform: translate(6px, 4px) rotate(12deg) scale(1.08, .92); }
      22% { transform: translate(-9px, 40px) rotate(-15deg) scale(1.14, .9); }
      34% { transform: translate(9px, 50px) rotate(15deg) scale(1.16, .9); }
      46% { transform: translate(-9px, 58px) rotate(-15deg) scale(1.16, .9); }
      58% { transform: translate(9px, 64px) rotate(15deg) scale(1.18, .88); }
      70% { transform: translate(-7px, 68px) rotate(-11deg) scale(1.2, .88); }
      84% { transform: translate(0, 40px) rotate(0) scale(1.08, .94); }
      100% { transform: none; }
    }
    @keyframes kzPalmJabL {
      0% { opacity: 0; transform: translate(-34px, 0) rotate(-26deg) scale(.5); }
      35% { opacity: 1; transform: translate(-24px, 48px) rotate(-8deg) scale(1.6); }
      65% { opacity: .9; transform: translate(-20px, 72px) rotate(-4deg) scale(2.1); }
      100% { opacity: 0; transform: translate(-18px, 84px) rotate(0) scale(2.3); }
    }
    @keyframes kzPalmJabR {
      0% { opacity: 0; transform: translate(34px, 0) rotate(26deg) scale(.5) scaleX(-1); }
      35% { opacity: 1; transform: translate(24px, 52px) rotate(8deg) scale(1.6) scaleX(-1); }
      65% { opacity: .9; transform: translate(20px, 76px) rotate(4deg) scale(2.1) scaleX(-1); }
      100% { opacity: 0; transform: translate(18px, 88px) rotate(0) scale(2.3) scaleX(-1); }
    }
    @keyframes kzThrow {
      0% { transform: none; }
      16% { transform: translate(0, 24px) scale(1.12, .9); }
      26% { transform: translate(0, 28px) scale(1.14, .88); }
      44% { transform: translate(-14px, -26px) rotate(-22deg) scale(.94, 1.1); }
      56% { transform: translate(-16px, -34px) rotate(-27deg) scale(.92, 1.12); }
      68% { transform: translate(10px, 66px) rotate(24deg) scale(1.28, .84); }
      78% { transform: translate(6px, 58px) rotate(16deg) scale(1.2, .88); }
      100% { transform: none; }
    }
    @keyframes kzGrab {
      0%, 6% { opacity: 0; transform: translate(26px, 0) rotate(30deg) scale(.5) scaleX(-1); }
      16% { opacity: 1; transform: translate(20px, 44px) rotate(10deg) scale(1.6) scaleX(-1); }
      28% { opacity: 1; transform: translate(18px, 48px) rotate(0) scale(1.2) scaleX(-1); }
      50% { opacity: 1; transform: translate(-14px, -44px) rotate(-50deg) scale(1.4) scaleX(-1); }
      66% { opacity: .95; transform: translate(12px, 76px) rotate(40deg) scale(2.1) scaleX(-1); }
      76%, 100% { opacity: 0; transform: translate(14px, 88px) rotate(46deg) scale(2.3) scaleX(-1); }
    }
    @keyframes kzPierceBeam {
      0%, 62% { opacity: 0; transform: translateX(-50%) scaleY(0); }
      68% { opacity: 1; transform: translateX(-50%) scaleY(1); }
      84% { opacity: .85; transform: translateX(-50%) scaleY(1.05) scaleX(.8); }
      100% { opacity: 0; transform: translateX(-50%) scaleY(1.1) scaleX(.2); }
    }
    @keyframes kzSpinDrop {
      0% { transform: none; }
      12% { transform: translateY(8px) scale(1.2, .8); }
      24% { transform: translateY(-56px) rotate(0) scale(.9, 1.12); }
      34% { transform: translateY(-74px) rotate(180deg) scale(.96); }
      44% { transform: translateY(-80px) rotate(360deg) scale(.96); }
      54% { transform: translateY(-80px) rotate(540deg) scale(.96); }
      64% { transform: translateY(-66px) rotate(720deg) scale(.94, 1.08); }
      74% { transform: translateY(72px) rotate(720deg) scale(1.36, .76); }
      80% { transform: translate(-5px, 64px) rotate(720deg) scale(1.28, .8); }
      86% { transform: translate(5px, 64px) rotate(720deg) scale(1.26, .82); }
      100% { transform: rotate(720deg); }
    }
    @keyframes kzWhirl {
      0%, 16% { opacity: 0; transform: translateY(0) rotate(0) scale(.6); }
      28% { opacity: 1; transform: translateY(-60px) rotate(360deg) scale(1); }
      60% { opacity: 1; transform: translateY(-74px) rotate(1080deg) scale(1.05); }
      72%, 100% { opacity: 0; transform: translateY(50px) rotate(1300deg) scale(1.3, .5); }
    }
    @keyframes kzBigImpact {
      0% { opacity: 0; transform: translateX(-50%) scale(.2); }
      12% { opacity: 1; transform: translateX(-50%) scale(1); }
      100% { opacity: 0; transform: translateX(-50%) scale(2.4); }
    }
    @keyframes kzShadowJump {
      0%, 12%, 74%, 100% { transform: translateX(-50%) scaleX(1); opacity: 1; }
      44%, 54% { transform: translateX(-50%) scaleX(.45); opacity: .35; }
      78% { transform: translateX(-50%) scaleX(1.5); opacity: 1; }
    }
    @keyframes kzHeave {
      0% { transform: none; }
      12% { transform: translateY(10px) scale(1.18, .82); }
      26% { transform: translateY(-12px) scale(.9, 1.16); }
      38% { transform: translate(-16px, -24px) rotate(-20deg) scale(.9, 1.16); }
      46% { transform: translate(-18px, -26px) rotate(-23deg) scale(.9, 1.16); }
      58% { transform: translate(18px, 26px) rotate(24deg) scale(1.24, .86); }
      68% { transform: translate(10px, 32px) rotate(14deg) scale(1.16, .9); }
      82% { transform: translateY(-8px) rotate(0) scale(.95, 1.06); }
      100% { transform: none; }
    }
    @keyframes kzFirework {
      0%, 54% { opacity: 0; transform: translateX(-50%) scale(.1); }
      62% { opacity: 1; transform: translateX(-50%) scale(.6); }
      86% { opacity: 1; transform: translateX(-50%) scale(1.25); }
      100% { opacity: 0; transform: translateX(-50%) translateY(14px) scale(1.45); }
    }
    @keyframes kzPowerUp {
      0% { transform: none; }
      14% { transform: translateY(8px) scale(1.16, .84); }
      22%, 38%, 54%, 70% { transform: translate(-3px, 8px) scale(1.16, .84); }
      30%, 46%, 62% { transform: translate(3px, 8px) scale(1.16, .84); }
      22% { }
      54% { }
      80% { transform: translateY(-10px) scale(.93, 1.12); }
      100% { transform: none; }
    }
    @keyframes kzStance {
      0% { transform: none; }
      18% { transform: translateY(6px) scale(1.18, .86); }
      34% { transform: translate(-10px, 6px) rotate(-8deg) scale(1.18, .86); }
      50% { transform: translate(10px, 6px) rotate(8deg) scale(1.18, .86); }
      66% { transform: translate(-10px, 6px) rotate(-8deg) scale(1.18, .86); }
      82% { transform: translateY(4px) scale(1.22, .82); }
      100% { transform: none; }
    }
    @keyframes kzPalmReadyL {
      0%, 12% { opacity: 0; transform: translate(-20px, 0) rotate(-10deg) scale(.5); }
      26%, 74% { opacity: 1; transform: translate(-52px, 4px) rotate(-24deg) scale(1.4); }
      50% { opacity: 1; transform: translate(-56px, 0) rotate(-12deg) scale(1.55); }
      90%, 100% { opacity: 0; transform: translate(-44px, 8px) rotate(-24deg) scale(1.2); }
    }
    @keyframes kzPalmReadyR {
      0%, 12% { opacity: 0; transform: translate(20px, 0) rotate(10deg) scale(.5) scaleX(-1); }
      26%, 74% { opacity: 1; transform: translate(52px, 4px) rotate(24deg) scale(1.4) scaleX(-1); }
      50% { opacity: 1; transform: translate(56px, 0) rotate(12deg) scale(1.55) scaleX(-1); }
      90%, 100% { opacity: 0; transform: translate(44px, 8px) rotate(24deg) scale(1.2) scaleX(-1); }
    }
    @keyframes kzSing {
      0% { transform: none; }
      15% { transform: translate(-6px, -6px) rotate(-9deg) scale(.96, 1.06); }
      35% { transform: translate(6px, 0) rotate(9deg) scale(1.05, .96); }
      55% { transform: translate(-6px, -6px) rotate(-9deg) scale(.96, 1.06); }
      75% { transform: translate(6px, 0) rotate(9deg) scale(1.05, .96); }
      100% { transform: none; }
    }
    @keyframes kzNote {
      0% { opacity: 0; transform: translate(0, 0) rotate(0) scale(.5); }
      20% { opacity: 1; transform: translate(calc(var(--kz-nx) * .3), -14px) rotate(calc(var(--kz-nr) * .3)) scale(1); }
      60% { opacity: 1; transform: translate(calc(var(--kz-nx) * -.2), -44px) rotate(calc(var(--kz-nr) * -.3)) scale(1.1); }
      100% { opacity: 0; transform: translate(var(--kz-nx), -78px) rotate(var(--kz-nr)) scale(1.2); }
    }
    [data-tactics-look] [data-kz-fx] { font-style: normal; position: absolute; inset: 0; pointer-events: none; z-index: 10000; }
    [data-tactics-look] [data-kz-fx]::before, [data-tactics-look] [data-kz-fx]::after { content: ''; position: absolute; opacity: 0; pointer-events: none; }
    /* はり手以外は、はり手の動き(kzSlap・手のひら・赤い輪)を止めて技ごとのものに差し替える */
    /* ★:where で包んで詳しさ(specificity)を上げない。上げると下の技ごとの指定より強くなり、手や輪が出なくなる */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-attack]:where([data-enemy-skill]:not([data-enemy-skill="normal"])) > [data-kz-palm] { animation: none; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-attack]:where([data-enemy-skill]:not([data-enemy-skill="normal"]))::after { animation: none; }
    /* かわずつき */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="sweep"] > span { z-index: 9999; animation: kzLunge var(--em-dur, 450ms) ease-in forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="sweep"] > [data-kz-fx]::before { left: 50%; bottom: -30%; width: 170%; height: 70%; border-radius: 50%;
      border-bottom: 6px solid rgba(236,253,245,.95); box-shadow: 0 10px 18px -6px rgba(52,211,153,.9);
      transform-origin: 50% 0; animation: kzSweepArc var(--em-dur, 450ms) ease-out forwards; }
    /* 連続はり手 */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="rush"] > span { z-index: 9999; animation: kzRush var(--em-dur, 750ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="rush"] > [data-kz-palm="l"] { animation: kzPalmJabL calc(var(--em-dur, 750ms) * .29) ease-out calc(var(--em-dur, 750ms) * .12) 3; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="rush"] > [data-kz-palm="r"] { animation: kzPalmJabR calc(var(--em-dur, 750ms) * .29) ease-out calc(var(--em-dur, 750ms) * .27) 3; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="rush"]::after { animation: kzImpact calc(var(--em-dur, 750ms) * .29) ease-out calc(var(--em-dur, 750ms) * .15) 3; }
    /* 上手投げ */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierce"] > span { z-index: 9999; animation: kzThrow var(--em-dur, 900ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierce"] > [data-kz-palm="r"] { animation: kzGrab var(--em-dur, 900ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierce"]::after { animation: kzImpact calc(var(--em-dur, 900ms) * .55) ease-out calc(var(--em-dur, 900ms) * .44) forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="pierce"] > [data-kz-fx]::before { left: 50%; top: 40%; width: 16px; height: 170%; border-radius: 8px; transform-origin: 50% 0;
      background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(251,113,133,.9) 40%, rgba(225,29,72,.6) 80%, transparent);
      box-shadow: 0 0 18px 6px rgba(244,63,94,.75); animation: kzPierceBeam var(--em-dur, 900ms) ease-out forwards; }
    /* 大回転落とし */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="special"] > span { z-index: 9999; transform-origin: 50% 55%; animation: kzSpinDrop var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="special"] > [data-enemy-shadow] { animation: kzShadowJump var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="special"] > [data-enemy-shadow]::before,
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="special"] > [data-enemy-shadow]::after { animation: kzDust calc(var(--em-dur, 1100ms) * .55) ease-out calc(var(--em-dur, 1100ms) * .41) forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="special"] > [data-kz-fx]::before { inset: -14%; border-radius: 50%;
      /* 渦は切り抜かずに、色違いの太い円の縁で描く */
      border: 7px solid transparent; border-top-color: rgba(253,224,71,.95); border-right-color: rgba(255,255,255,.75); border-bottom-color: rgba(251,191,36,.95);
      animation: kzWhirl var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="special"] > [data-kz-fx]::after { left: 50%; bottom: -24%; width: 120%; height: 40%; border-radius: 50%;
      background: radial-gradient(closest-side, rgba(255,255,255,.95), rgba(253,224,71,.85) 35%, rgba(245,158,11,.4) 65%, transparent);
      animation: kzBigImpact calc(var(--em-dur, 1100ms) * .38) ease-out calc(var(--em-dur, 1100ms) * .73) forwards; }
    /* 大投げたまや */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="allout"] > span { z-index: 9999; animation: kzHeave var(--em-dur, 1000ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="allout"]::after { animation: kzImpact calc(var(--em-dur, 1000ms) * .5) ease-out calc(var(--em-dur, 1000ms) * .45) forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="allout"] > [data-kz-fx]::before,
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="allout"] > [data-kz-fx]::after { left: 50%; top: -58%; width: 150%; aspect-ratio: 1; transform-origin: 50% 50%; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="allout"] > [data-kz-fx]::before {
      background: radial-gradient(9px 9px at 90% 50%, #fde047, transparent 75%), radial-gradient(9px 9px at 78% 78%, #fb7185, transparent 75%),
        radial-gradient(9px 9px at 50% 90%, #fde047, transparent 75%), radial-gradient(9px 9px at 22% 78%, #67e8f9, transparent 75%),
        radial-gradient(9px 9px at 10% 50%, #fde047, transparent 75%), radial-gradient(9px 9px at 22% 22%, #fb7185, transparent 75%),
        radial-gradient(9px 9px at 50% 10%, #fde047, transparent 75%), radial-gradient(9px 9px at 78% 22%, #67e8f9, transparent 75%),
        radial-gradient(7px 7px at 72% 50%, #fff, transparent 75%), radial-gradient(7px 7px at 50% 72%, #fff, transparent 75%),
        radial-gradient(7px 7px at 28% 50%, #fff, transparent 75%), radial-gradient(7px 7px at 50% 28%, #fff, transparent 75%),
        radial-gradient(closest-side, rgba(253,224,71,.35), transparent 40%);
      filter: drop-shadow(0 0 6px rgba(253,224,71,.9)); animation: kzFirework var(--em-dur, 1000ms) ease-out forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="allout"] > [data-kz-fx]::after { top: -40%; margin-left: -34%; width: 110%;
      background: radial-gradient(7px 7px at 90% 50%, #f0abfc, transparent 75%), radial-gradient(7px 7px at 78% 78%, #86efac, transparent 75%),
        radial-gradient(7px 7px at 50% 90%, #f0abfc, transparent 75%), radial-gradient(7px 7px at 22% 78%, #fdba74, transparent 75%),
        radial-gradient(7px 7px at 10% 50%, #f0abfc, transparent 75%), radial-gradient(7px 7px at 22% 22%, #86efac, transparent 75%),
        radial-gradient(7px 7px at 50% 10%, #f0abfc, transparent 75%), radial-gradient(7px 7px at 78% 22%, #fdba74, transparent 75%);
      filter: drop-shadow(0 0 5px rgba(240,171,252,.9)); animation: kzFirework var(--em-dur, 1000ms) ease-out calc(var(--em-dur, 1000ms) * .12) forwards; }
    /* 必殺技準備 / 貫通技準備(しこ踏みは上の kzStomp のまま) */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="charge"] > span { animation: kzPowerUp var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierceCharge"] > span { animation: kzStance var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="charge"] > [data-enemy-shadow]::before,
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="charge"] > [data-enemy-shadow]::after,
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierceCharge"] > [data-enemy-shadow]::before,
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierceCharge"] > [data-enemy-shadow]::after { animation: none; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierceCharge"] > [data-kz-palm="l"] { animation: kzPalmReadyL var(--em-dur, 1100ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="pierceCharge"] > [data-kz-palm="r"] { animation: kzPalmReadyR var(--em-dur, 1100ms) ease-in-out forwards; }
    /* かえるのうた */
    [data-tactics-look] [data-enemy-ring][data-enemy-motion="kawazumo"][data-enemy-skill="regen"] > span { animation: kzSing var(--em-dur, 1000ms) ease-in-out forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="regen"] > [data-kz-fx]::before,
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="regen"] > [data-kz-fx]::after { font-size: 34px; font-weight: 900; line-height: 1; color: #a7f3d0;
      text-shadow: 0 0 8px rgba(52,211,153,1), 0 2px 4px rgba(0,0,0,.7); }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="regen"] > [data-kz-fx]::before { content: '♪'; left: 8%; top: 22%; --kz-nx: -18px; --kz-nr: -20deg;
      animation: kzNote calc(var(--em-dur, 1000ms) * .9) ease-out forwards; }
    [data-tactics-look] [data-enemy-motion="kawazumo"][data-enemy-skill="regen"] > [data-kz-fx]::after { content: '♫'; right: 6%; top: 10%; --kz-nx: 18px; --kz-nr: 20deg; color: #fff;
      animation: kzNote calc(var(--em-dur, 1000ms) * .8) ease-out calc(var(--em-dur, 1000ms) * .2) forwards; }
    /* ---- カワズモー以外の敵の動き(2026-09-24 ユーザー指示「次はタクティクスの全モンスターも実装して」) ----
       体の動き・飾りの形・絵文字の出し方を部品にして、敵ごとの組み合わせは 71-screen-battle の
       TACTICS_ENEMY_MOTION_SETS が決める。ここでは部品と、敵ごとの色(--em-c)だけを持つ。
       長さは技で決まる(--em-dur)。60-app の待ち時間(TACTICS_ENEMY_SKILL_MS_DEFAULT)とそろえる。
       ★丸枠の中の絵は「> span」、覚醒ムーの枠の外の絵は「> img」。どちらにも同じ部品が効くように :is(span, img) で書く */
    /* ★色は body 直下の全画面の演出(data-enemy-stage-fx)でも使うので、[data-tactics-look] の中に限らない */
    [data-enemy-motion="kawazumo"] { --em-c: 74,222,128; }
    [data-enemy-motion="metalner"] { --em-c: 96,165,250; }
    [data-enemy-motion="inari"] { --em-c: 251,146,60; }
    [data-enemy-motion="koinobori"] { --em-c: 248,113,113; }
    [data-enemy-motion="delpiero"] { --em-c: 232,121,249; }
    [data-enemy-motion="dokudoku"] { --em-c: 192,132,252; }
    [data-enemy-motion="lamia"] { --em-c: 129,140,248; }
    [data-enemy-motion="nyarlathotep"] { --em-c: 250,204,21; }
    [data-enemy-motion="splatter"] { --em-c: 220,38,38; }
    [data-enemy-motion="awakenedMoo"] { --em-c: 250,204,21; }
    [data-tactics-look] [data-enemy-skill] { --em-dur: 450ms; }
    [data-tactics-look] [data-enemy-skill="rush"] { --em-dur: 750ms; }
    [data-tactics-look] [data-enemy-skill="pierce"] { --em-dur: 900ms; }
    [data-tactics-look] [data-enemy-skill="allout"], [data-tactics-look] [data-enemy-skill="regen"] { --em-dur: 1000ms; }
    [data-tactics-look] [data-enemy-skill="special"] { --em-dur: 1500ms; }
    [data-tactics-look] [data-enemy-skill="roar"],
    [data-tactics-look] [data-enemy-skill="charge"], [data-tactics-look] [data-enemy-skill="pierceCharge"] { --em-dur: 1100ms; }
    /* ★実際の長さは画面が style で渡す(--em-dur。戦闘の速さ・覚醒ムーの技ごとの長さを掛けたもの)。ここは渡されなかったときの目安 */

    /* 待機(ずっと繰り返す) */
    @keyframes emIdleHover {
      0%, 100% { transform: translateY(0) rotate(0); }
      25% { transform: translateY(-10px) rotate(-3deg); }
      50% { transform: translateY(-4px) rotate(0); }
      75% { transform: translateY(-12px) rotate(3deg); }
    }
    @keyframes emShadowHover {
      0%, 50%, 100% { transform: translateX(-50%) scaleX(.92); opacity: .8; }
      25%, 75% { transform: translateX(-50%) scaleX(.74); opacity: .55; }
    }
    @keyframes emIdleHop {
      0%, 100% { transform: none; }
      12% { transform: rotate(-5deg) scale(1.02, .98); }
      26% { transform: rotate(5deg) scale(1.02, .98); }
      40% { transform: rotate(-4deg); }
      52% { transform: none; }
      60% { transform: translateY(2px) scale(1.08, .92); }
      66% { transform: translateY(-16px) scale(.94, 1.08); }
      72% { transform: translateY(2px) scale(1.08, .92); }
      78% { transform: translateY(-12px) scale(.95, 1.06); }
      84% { transform: translateY(1px) scale(1.05, .95); }
      90% { transform: none; }
    }
    @keyframes emIdleSwim {
      0%, 100% { transform: translateX(0) rotate(0) skewX(0); }
      25% { transform: translateX(-7px) rotate(-4deg) skewX(4deg); }
      50% { transform: translateX(0) translateY(-5px) rotate(0) skewX(0); }
      75% { transform: translateX(7px) rotate(4deg) skewX(-4deg); }
    }
    @keyframes emIdlePrance {
      0%, 50%, 100% { transform: translateY(0) rotate(0); }
      10% { transform: translateY(-7px) rotate(-3deg); }
      20% { transform: translateY(1px) rotate(-1deg) scale(1.02, .98); }
      30% { transform: translateY(-7px) rotate(3deg); }
      40% { transform: translateY(1px) rotate(1deg) scale(1.02, .98); }
      70% { transform: translateX(-4px) rotate(-2deg); }
      85% { transform: translateX(3px) rotate(1deg); }
    }
    @keyframes emIdlePulse {
      0%, 34%, 100% { transform: scale(1, 1); }
      8% { transform: scale(1.1, .92); }
      14% { transform: scale(.97, 1.04); }
      20% { transform: scale(1.12, .9); }
      28% { transform: scale(.98, 1.03); }
      60% { transform: translateX(-4px) rotate(-2deg); }
      80% { transform: translateX(4px) rotate(2deg); }
    }
    @keyframes emIdleSerpent {
      0%, 100% { transform: translateX(0) rotate(0) skewX(0); }
      25% { transform: translateX(-8px) rotate(-3deg) skewX(5deg); }
      50% { transform: translateX(0) translateY(-4px) rotate(0) skewX(0) scale(.98, 1.03); }
      75% { transform: translateX(8px) rotate(3deg) skewX(-5deg); }
    }
    @keyframes emIdleWrithe {
      0%, 100% { transform: none; }
      20% { transform: skewY(-3deg) scale(1.03, .98); }
      40% { transform: skewY(2deg) rotate(-2deg) scale(.98, 1.03); }
      60% { transform: skewY(3deg) scale(1.04, .97); }
      80% { transform: skewY(-2deg) rotate(2deg) scale(.98, 1.03); }
    }
    @keyframes emIdleMenace {
      0%, 100% { transform: none; }
      30% { transform: scale(1.03, .98); }
      50% { transform: translateY(3px) rotate(4deg) scale(1.02, .99); }
      62% { transform: translateY(3px) rotate(4deg) scale(1.02, .99); }
      80% { transform: scale(.99, 1.02); }
    }
    /* 体の動き(技) */
    @keyframes emJab {
      0% { transform: none; }
      25% { transform: translateY(-9px) rotate(-6deg) scale(.94, 1.06); }
      40% { transform: translateY(-14px) rotate(-9deg) scale(.91, 1.09); }
      50% { transform: translateY(87px) rotate(4deg) scale(1.2, .9); }
      66% { transform: translateY(72px) rotate(2deg) scale(1.12, .92); }
      100% { transform: none; }
    }
    @keyframes emLunge {
      0% { transform: none; }
      22% { transform: translateY(-15px) scale(.92, 1.08); }
      42% { transform: translateY(-20px) scale(.89, 1.11); }
      55% { transform: translateY(108px) scale(1.26, .86); }
      70% { transform: translateY(93px) scale(1.2, .88); }
      100% { transform: none; }
    }
    @keyframes emDash {
      0% { transform: none; }
      28% { transform: translate(-45px, 9px) rotate(-10deg) scale(1.1, .9); }
      58% { transform: translate(51px, 96px) rotate(12deg) scale(1.22, .88); }
      72% { transform: translate(36px, 84px) rotate(8deg) scale(1.16, .9); }
      100% { transform: none; }
    }
    @keyframes emFlurry {
      0% { transform: none; }
      10% { transform: translate(9px, 6px) rotate(10deg) scale(1.06, .94); }
      22% { transform: translate(-14px, 60px) rotate(-12deg) scale(1.14, .9); }
      34% { transform: translate(14px, 75px) rotate(12deg) scale(1.16, .9); }
      46% { transform: translate(-14px, 87px) rotate(-12deg) scale(1.16, .9); }
      58% { transform: translate(14px, 96px) rotate(12deg) scale(1.18, .88); }
      70% { transform: translate(-10px, 102px) rotate(-9deg) scale(1.2, .88); }
      84% { transform: translate(0, 40px) rotate(0) scale(1.08, .94); }
      100% { transform: none; }
    }
    @keyframes emSpin {
      0% { transform: none; }
      14% { transform: scale(1.1, .9); }
      50% { transform: translateY(60px) rotate(360deg) scale(1.08); }
      80% { transform: translateY(87px) rotate(720deg) scale(1.18); }
      100% { transform: rotate(720deg); }
    }
    @keyframes emWindup {
      0% { transform: none; }
      30% { transform: translateY(-30px) rotate(-14deg) scale(.92, 1.1); }
      56% { transform: translate(-6px, -39px) rotate(-18deg) scale(.9, 1.12); }
      68% { transform: translateY(108px) rotate(6deg) scale(1.28, .84); }
      78% { transform: translateY(93px) rotate(4deg) scale(1.2, .88); }
      100% { transform: none; }
    }
    @keyframes emSwing {
      0% { transform: none; }
      30% { transform: translate(-27px, -15px) rotate(-24deg) scale(.95, 1.06); }
      46% { transform: translate(-32px, -20px) rotate(-30deg) scale(.93, 1.08); }
      58% { transform: translate(30px, 78px) rotate(22deg) scale(1.2, .9); }
      72% { transform: translate(18px, 66px) rotate(12deg) scale(1.14, .92); }
      100% { transform: none; }
    }
    @keyframes emLeap {
      0% { transform: none; }
      12% { transform: translateY(12px) scale(1.18, .82); }
      30% { transform: translateY(-105px) scale(.9, 1.12); }
      56% { transform: translateY(-123px) scale(.95, 1.06); }
      70% { transform: translateY(108px) scale(1.34, .76); }
      78% { transform: translate(-8px, 96px) scale(1.28, .8); }
      86% { transform: translate(8px, 96px) scale(1.26, .82); }
      100% { transform: none; }
    }
    @keyframes emPress {
      0% { transform: none; }
      12% { transform: translateY(12px) scale(1.16, .84); }
      34% { transform: translateY(-90px) rotate(-8deg) scale(.95, 1.08); }
      52% { transform: translateY(-105px) rotate(8deg) scale(1.02); }
      70% { transform: translateY(114px) scale(1.42, .7); }
      82% { transform: translateY(96px) scale(1.3, .76); }
      100% { transform: none; }
    }
    @keyframes emRise {
      0% { transform: none; }
      20% { transform: translateY(12px) scale(1.12, .88); }
      48% { transform: translateY(-36px) scale(1.1, 1.18); }
      60% { transform: translateY(-42px) scale(1.14, 1.2); }
      74% { transform: translateY(51px) scale(1.24, .86); }
      100% { transform: none; }
    }
    @keyframes emRoar {
      0% { transform: none; }
      18% { transform: translateY(6px) scale(1.1, .9); }
      34% { transform: translateY(-14px) rotate(-4deg) scale(1.08, 1.12); }
      42%, 58% { transform: translate(-4px, -14px) scale(1.12, 1.14); }
      50%, 66% { transform: translate(4px, -14px) scale(1.14, 1.12); }
      80% { transform: translateY(-4px) scale(1.04); }
      100% { transform: none; }
    }
    @keyframes emPower {
      0% { transform: none; }
      14% { transform: translateY(8px) scale(1.14, .86); }
      22%, 38%, 54%, 70% { transform: translate(-3px, 8px) scale(1.14, .86); }
      30%, 46%, 62% { transform: translate(3px, 8px) scale(1.14, .86); }
      80% { transform: translateY(-10px) scale(.93, 1.12); }
      100% { transform: none; }
    }
    @keyframes emStance {
      0% { transform: none; }
      18% { transform: translateY(6px) scale(1.16, .88); }
      34% { transform: translate(-10px, 6px) rotate(-7deg) scale(1.16, .88); }
      50% { transform: translate(10px, 6px) rotate(7deg) scale(1.16, .88); }
      66% { transform: translate(-10px, 6px) rotate(-7deg) scale(1.16, .88); }
      82% { transform: translateY(4px) scale(1.2, .84); }
      100% { transform: none; }
    }
    @keyframes emHeal {
      0% { transform: none; }
      25% { transform: translateY(-12px) scale(1.04); }
      50% { transform: translateY(-18px) scale(1.06); }
      75% { transform: translateY(-10px) scale(1.03); }
      100% { transform: none; }
    }
    @keyframes emSway {
      0% { transform: none; }
      15% { transform: translate(-6px, -6px) rotate(-9deg) scale(.96, 1.06); }
      35% { transform: translate(6px, 0) rotate(9deg) scale(1.05, .96); }
      55% { transform: translate(-6px, -6px) rotate(-9deg) scale(.96, 1.06); }
      75% { transform: translate(6px, 0) rotate(9deg) scale(1.05, .96); }
      100% { transform: none; }
    }
    /* 飾りの形(::before) */
    @keyframes emArc {
      0%, 30% { opacity: 0; transform: translateX(-50%) rotate(-38deg) scaleX(.5); }
      50% { opacity: 1; transform: translateX(-50%) rotate(-6deg) scaleX(1); }
      72% { opacity: .9; transform: translateX(-50%) rotate(22deg) scaleX(1.1); }
      100% { opacity: 0; transform: translateX(-50%) rotate(34deg) scaleX(1.15); }
    }
    @keyframes emSlash {
      0%, 40% { opacity: 0; transform: scale(.3) rotate(-20deg); }
      56% { opacity: 1; transform: scale(1) rotate(0); }
      100% { opacity: 0; transform: scale(1.3) rotate(8deg); }
    }
    @keyframes emBeam {
      0%, 60% { opacity: 0; transform: translateX(-50%) scaleY(0); }
      68% { opacity: 1; transform: translateX(-50%) scaleY(1); }
      84% { opacity: .85; transform: translateX(-50%) scaleY(1.05) scaleX(.8); }
      100% { opacity: 0; transform: translateX(-50%) scaleY(1.1) scaleX(.2); }
    }
    @keyframes emBurst {
      0%, 42% { opacity: 0; transform: scale(.3) rotate(0); }
      58% { opacity: 1; transform: scale(1) rotate(8deg); }
      100% { opacity: 0; transform: scale(1.5) rotate(24deg); }
    }
    @keyframes emRingOut {
      0%, 52% { opacity: 0; transform: translateX(-50%) scale(.2); }
      64% { opacity: 1; transform: translateX(-50%) scale(1); }
      100% { opacity: 0; transform: translateX(-50%) scale(2.2); }
    }
    @keyframes emAura {
      0% { opacity: 0; transform: scaleY(.3); }
      35% { opacity: .9; transform: scaleY(1); }
      80% { opacity: .8; transform: scaleY(1.05); }
      100% { opacity: 0; transform: scaleY(1.2); }
    }
    @keyframes emLock {
      0% { opacity: 0; transform: scale(2.2) rotate(0); }
      30% { opacity: .9; transform: scale(1.3) rotate(45deg); }
      55% { opacity: 1; transform: scale(1) rotate(90deg); }
      70%, 85% { opacity: 1; transform: scale(.92) rotate(90deg); }
      100% { opacity: 0; transform: scale(.8) rotate(90deg); }
    }
    @keyframes emSparkle {
      0% { opacity: 0; transform: translateY(20px); }
      25% { opacity: 1; }
      100% { opacity: 0; transform: translateY(-70px); }
    }
    /* 絵文字の出し方(::after) */
    @keyframes emEmoRise {
      0% { opacity: 0; transform: translateY(10px) scale(.5); }
      25% { opacity: 1; transform: translateY(-10px) scale(1); }
      100% { opacity: 0; transform: translateY(-80px) scale(1.2); }
    }
    @keyframes emEmoShoot {
      0%, 30% { opacity: 0; transform: translate(-50%, 0) scale(.4) rotate(-20deg); }
      45% { opacity: 1; transform: translate(-50%, 30px) scale(1.2) rotate(0); }
      75% { opacity: 1; transform: translate(-50%, 110px) scale(2.3) rotate(15deg); }
      100% { opacity: 0; transform: translate(-50%, 140px) scale(2.6) rotate(20deg); }
    }
    @keyframes emEmoRain {
      0%, 30% { opacity: 0; transform: translateY(-40px); }
      45% { opacity: 1; }
      85% { opacity: 1; transform: translateY(110px); }
      100% { opacity: 0; transform: translateY(130px); }
    }
    [data-tactics-look="rich"] [data-em-idle]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation: 4s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-em-idle="hover"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleHover; }
    [data-tactics-look="rich"] [data-em-idle="hover"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > [data-enemy-shadow] { animation: emShadowHover 4s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-em-idle="hop"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleHop; animation-duration: 3.4s; }
    [data-tactics-look="rich"] [data-em-idle="swim"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleSwim; }
    [data-tactics-look="rich"] [data-em-idle="prance"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdlePrance; animation-duration: 3.2s; }
    [data-tactics-look="rich"] [data-em-idle="pulse"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdlePulse; animation-duration: 2.6s; }
    [data-tactics-look="rich"] [data-em-idle="serpent"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleSerpent; }
    [data-tactics-look="rich"] [data-em-idle="writhe"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleWrithe; animation-duration: 5s; }
    [data-tactics-look="rich"] [data-em-idle="menace"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > img { animation-name: emIdleMenace; animation-duration: 5s; }
    /* 体の動き。丸枠の生の攻撃の動き([data-enemy-attack] > span)より強くするため [data-enemy-skill] も付ける */
    [data-tactics-look] [data-enemy-skill][data-em-body] > :is(span, [data-moo-body]) { z-index: 9999; animation-duration: var(--em-dur); animation-timing-function: ease-in-out; animation-fill-mode: forwards; }
    [data-tactics-look] [data-enemy-skill][data-em-body="jab"] > :is(span, [data-moo-body]) { animation-name: emJab; }
    [data-tactics-look] [data-enemy-skill][data-em-body="lunge"] > :is(span, [data-moo-body]) { animation-name: emLunge; }
    [data-tactics-look] [data-enemy-skill][data-em-body="dash"] > :is(span, [data-moo-body]) { animation-name: emDash; }
    [data-tactics-look] [data-enemy-skill][data-em-body="flurry"] > :is(span, [data-moo-body]) { animation-name: emFlurry; }
    [data-tactics-look] [data-enemy-skill][data-em-body="spin"] > :is(span, [data-moo-body]) { animation-name: emSpin; transform-origin: 50% 55%; }
    [data-tactics-look] [data-enemy-skill][data-em-body="windup"] > :is(span, [data-moo-body]) { animation-name: emWindup; }
    [data-tactics-look] [data-enemy-skill][data-em-body="swing"] > :is(span, [data-moo-body]) { animation-name: emSwing; }
    [data-tactics-look] [data-enemy-skill][data-em-body="leap"] > :is(span, [data-moo-body]) { animation-name: emLeap; }
    [data-tactics-look] [data-enemy-skill][data-em-body="press"] > :is(span, [data-moo-body]) { animation-name: emPress; }
    [data-tactics-look] [data-enemy-skill][data-em-body="rise"] > :is(span, [data-moo-body]) { animation-name: emRise; }
    [data-tactics-look] [data-enemy-skill][data-em-body="roar"] > :is(span, [data-moo-body]) { animation-name: emRoar; }
    [data-tactics-look] [data-enemy-skill][data-em-body="power"] > :is(span, [data-moo-body]) { animation-name: emPower; }
    [data-tactics-look] [data-enemy-skill][data-em-body="stance"] > :is(span, [data-moo-body]) { animation-name: emStance; }
    [data-tactics-look] [data-enemy-skill][data-em-body="heal"] > :is(span, [data-moo-body]) { animation-name: emHeal; }
    [data-tactics-look] [data-enemy-skill][data-em-body="sway"] > :is(span, [data-moo-body]) { animation-name: emSway; }
    [data-tactics-look] [data-moo-stage] > [data-moo-body] { transform-origin: 50% 60%; }
    /* やられ(カワズモーと同じのけぞり) */
    [data-tactics-look] [data-enemy-ring][data-em-idle][data-enemy-hurt] > span, [data-tactics-look] [data-moo-stage][data-enemy-hurt] > [data-moo-body] { animation: kzHurt 520ms ease-out forwards; }
    /* 技の光(2026-09-24 ユーザー指摘「バトル画面にかくつき」で作り直した)。
       ★もとは体の動きの中で filter(drop-shadow / brightness)を変えていた。大きな絵を毎コマぼかし直すので、攻撃のたびにかくついた。
         いまは絵の後ろに置いた光の輪(data-enemy-glow。絵と一緒に動く)の濃さ(opacity)だけを変える */
    [data-tactics-look] [data-enemy-glow] { position: absolute; inset: -14%; border-radius: 50%; pointer-events: none; z-index: 0; opacity: 0;
      background: radial-gradient(closest-side, rgba(var(--em-glow, var(--em-c, 255,255,255)),.95), rgba(var(--em-glow, var(--em-c, 255,255,255)),.4) 55%, rgba(var(--em-glow, var(--em-c, 255,255,255)),0) 78%); }
    @keyframes emGlowHit { 0%, 30% { opacity: 0; } 55% { opacity: .9; } 70% { opacity: .75; } 100% { opacity: 0; } }
    @keyframes emGlowCharge { 0% { opacity: 0; } 50% { opacity: .55; } 80% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes emGlowSoft { 0% { opacity: 0; } 50% { opacity: .8; } 100% { opacity: 0; } }
    @keyframes emGlowHurt { 0% { opacity: 0; } 12% { opacity: .95; } 100% { opacity: 0; } }
    [data-tactics-look] :is([data-enemy-ring][data-enemy-skill] > span, [data-moo-stage][data-enemy-skill] > [data-moo-body]) > [data-enemy-glow] { animation: emGlowHit var(--em-dur, 450ms) ease-out forwards; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage]):is([data-enemy-skill="charge"], [data-enemy-skill="pierceCharge"], [data-enemy-skill="roar"]) > :is(span, [data-moo-body]) > [data-enemy-glow] { animation-name: emGlowCharge; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage])[data-enemy-skill="regen"] > :is(span, [data-moo-body]) > [data-enemy-glow] { --em-glow: 52,211,153; animation-name: emGlowSoft; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage])[data-enemy-hurt] > :is(span, [data-moo-body]) > [data-enemy-glow] { --em-glow: 255,255,255; animation: emGlowHurt 520ms ease-out forwards; }
    /* ★同じ絵を明るくした複製(光るあいだだけ置く)。切り抜き(mask)も重ね方(mix-blend-mode)も使わない。
         iPhone で切り抜きが外れると四角い板が出るため(2026-09-24)。複製なので、明るさ(filter)は動かさず固定のまま */
    [data-tactics-look] [data-enemy-flash] { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; z-index: 2; pointer-events: none; opacity: 0;
      filter: brightness(1.45) saturate(1.1);}
    @keyframes emFlashHit { 0%, 35% { opacity: 0; } 55% { opacity: 1; } 72% { opacity: .55; } 100% { opacity: 0; } }
    @keyframes emFlashCharge { 0% { opacity: 0; } 55% { opacity: .45; } 80% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes emFlashSoft { 0% { opacity: 0; } 50% { opacity: .7; } 100% { opacity: 0; } }
    @keyframes emFlashHurt { 0% { opacity: 0; } 16% { opacity: 1; } 36% { opacity: .35; } 100% { opacity: 0; } }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage])[data-enemy-skill] > :is(span, [data-moo-body]) > [data-enemy-flash] { animation: emFlashHit var(--em-dur, 450ms) ease-out forwards; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage]):is([data-enemy-skill="charge"], [data-enemy-skill="pierceCharge"], [data-enemy-skill="roar"]) > :is(span, [data-moo-body]) > [data-enemy-flash] { animation-name: emFlashCharge; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage])[data-enemy-skill="regen"] > :is(span, [data-moo-body]) > [data-enemy-flash] { --em-glow: 52,211,153; animation-name: emFlashSoft; }
    [data-tactics-look] :is([data-enemy-ring], [data-moo-stage])[data-enemy-hurt] > :is(span, [data-moo-body]) > [data-enemy-flash] { filter: brightness(2.3) saturate(.4); animation: emFlashHurt 520ms ease-out forwards; }
    /* 待機中の光(もとは待機の動きの中の filter)。ドクドクの脈・ニャルラトホテプのうごめき・覚醒ムーの吠える瞬間に合わせて灯す */
    @keyframes emGlowIdlePulse { 0%, 34%, 100% { opacity: 0; } 20% { opacity: .6; } }
    @keyframes emGlowIdleWrithe { 0%, 20%, 60%, 100% { opacity: 0; } 40% { opacity: .45; } 80% { opacity: .6; } }
    @keyframes mooGlowIdle { 0%, 60%, 86%, 100% { opacity: 0; } 68%, 76% { opacity: .9; } }
    @keyframes mooFlashIdle { 0%, 60%, 86%, 100% { opacity: 0; } 68%, 76% { opacity: .8; } }
    [data-tactics-look="rich"] [data-em-idle="pulse"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > [data-enemy-glow] { animation: emGlowIdlePulse 2.6s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-em-idle="writhe"]:not([data-enemy-attack]):not([data-enemy-hurt]):not([data-enemy-skill]) > span > [data-enemy-glow] { animation: emGlowIdleWrithe 5s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-moo-stage]:not([data-enemy-skill]):not([data-enemy-hurt]) > [data-moo-body] > [data-enemy-glow] { --em-glow: 220,38,38; animation: mooGlowIdle 4.2s ease-in-out infinite; }
    /* カワズモーは技ごとに光の色を変える(はり手・連続はり手=赤 / かわずつき=緑 / 上手投げ・構え=紅 / 大回転落とし・準備・大投げたまや=金) */
    [data-enemy-motion="kawazumo"]:is([data-enemy-skill="normal"], [data-enemy-skill="rush"]) { --em-glow: 239,68,68; }
    [data-enemy-motion="kawazumo"]:is([data-enemy-skill="pierce"], [data-enemy-skill="pierceCharge"]) { --em-glow: 244,63,94; }
    [data-enemy-motion="kawazumo"]:is([data-enemy-skill="special"], [data-enemy-skill="charge"], [data-enemy-skill="allout"], [data-enemy-skill="roar"]) { --em-glow: 251,191,36; }
    /* 飾り */
    [data-tactics-look] [data-em-fx-el] { font-style: normal; position: absolute; inset: 0; pointer-events: none; z-index: 10000; }
    [data-tactics-look] [data-em-fx-el]::before, [data-tactics-look] [data-em-fx-el]::after { content: ''; position: absolute; opacity: 0; pointer-events: none; }
    [data-tactics-look] [data-em-fx="arc"] > [data-em-fx-el]::before { left: 50%; bottom: -30%; width: 170%; height: 70%; border-radius: 50%;
      border-bottom: 6px solid rgba(255,255,255,.95); box-shadow: 0 10px 18px -6px rgba(var(--em-c),1); transform-origin: 50% 0; animation: emArc var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="slash"] > [data-em-fx-el]::before { inset: -8%;
      background: linear-gradient(45deg, transparent 47%, rgba(255,255,255,.95) 49.2%, rgba(var(--em-c),.95) 50.8%, transparent 53%),
        linear-gradient(-45deg, transparent 47%, rgba(255,255,255,.95) 49.2%, rgba(var(--em-c),.95) 50.8%, transparent 53%);
      filter: drop-shadow(0 0 10px rgba(var(--em-c),1)); animation: emSlash var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="beam"] > [data-em-fx-el]::before { left: 50%; top: 40%; width: 16px; height: 170%; border-radius: 8px; transform-origin: 50% 0;
      background: linear-gradient(180deg, rgba(255,255,255,.95), rgba(var(--em-c),.9) 40%, rgba(var(--em-c),.5) 80%, transparent);
      box-shadow: 0 0 18px 6px rgba(var(--em-c),.75); animation: emBeam var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="widebeam"] > [data-em-fx-el]::before { left: 50%; top: 35%; width: 62%; height: 220%; border-radius: 40px; transform-origin: 50% 0;
      background: linear-gradient(90deg, transparent, rgba(var(--em-c),.7) 20%, rgba(255,255,255,.95) 45% 55%, rgba(var(--em-c),.7) 80%, transparent);
      box-shadow: 0 0 30px 10px rgba(var(--em-c),.6); animation: emBeam var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="burst"] > [data-em-fx-el]::before { inset: -22%; border-radius: 50%;
      background: repeating-conic-gradient(rgba(255,255,255,.9) 0 4deg, rgba(var(--em-c),.7) 4deg 9deg, transparent 9deg 30deg);
      animation: emBurst var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="ring"] > [data-em-fx-el]::before { left: 50%; bottom: -18%; width: 110%; height: 40%; border-radius: 50%;
      border: 4px solid rgba(255,255,255,.9); box-shadow: 0 0 18px 4px rgba(var(--em-c),.9), inset 0 0 14px rgba(var(--em-c),.8);
      animation: emRingOut var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="aura"] > [data-em-fx-el]::before { left: -12%; right: -12%; top: -30%; bottom: 0; border-radius: 50% 50% 40% 40%; transform-origin: 50% 100%;
      background: radial-gradient(60% 80% at 50% 100%, rgba(var(--em-c),.55), rgba(var(--em-c),.22) 55%, transparent 100%);
      animation: emAura var(--em-dur) ease-in-out forwards; }
    [data-tactics-look] [data-em-fx="lock"] > [data-em-fx-el]::before { inset: 4%; border-radius: 50%;
      border: 3px dashed rgba(var(--em-c),.95); box-shadow: 0 0 14px rgba(var(--em-c),.9), inset 0 0 14px rgba(var(--em-c),.6);
      background: linear-gradient(rgba(var(--em-c),.9), rgba(var(--em-c),.9)) 50% 0 / 3px 18% no-repeat, linear-gradient(rgba(var(--em-c),.9), rgba(var(--em-c),.9)) 50% 100% / 3px 18% no-repeat,
        linear-gradient(rgba(var(--em-c),.9), rgba(var(--em-c),.9)) 0 50% / 18% 3px no-repeat, linear-gradient(rgba(var(--em-c),.9), rgba(var(--em-c),.9)) 100% 50% / 18% 3px no-repeat;
      animation: emLock var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-fx="sparkle"] > [data-em-fx-el]::before { inset: 0;
      background: radial-gradient(4px 4px at 20% 70%, #fff, transparent 75%), radial-gradient(5px 5px at 36% 50%, rgba(167,243,208,1), transparent 75%),
        radial-gradient(4px 4px at 55% 78%, #fff, transparent 75%), radial-gradient(5px 5px at 70% 45%, rgba(167,243,208,1), transparent 75%),
        radial-gradient(4px 4px at 84% 66%, #fff, transparent 75%), radial-gradient(5px 5px at 48% 30%, rgba(167,243,208,1), transparent 75%);
      filter: drop-shadow(0 0 6px rgba(52,211,153,1)); animation: emSparkle var(--em-dur) ease-out forwards; }
    [data-tactics-look] [data-em-emo] > [data-em-fx-el]::after { content: var(--em-e, ''); line-height: 1; text-align: center; white-space: nowrap;
      filter: drop-shadow(0 0 8px rgba(var(--em-c),1)) drop-shadow(0 2px 4px rgba(0,0,0,.7)); }
    [data-tactics-look] [data-em-emo="rise"] > [data-em-fx-el]::after { left: 0; right: 0; top: 18%; font-size: 30px; word-spacing: 34px;
      content: var(--em-e, '') ' ' var(--em-e, '') ' ' var(--em-e, ''); animation: emEmoRise var(--em-dur) ease-out forwards; }
    /* shoot(こちらへ飛ぶ)の絵文字は、丸枠の中ではなく全画面の演出が味方の枠まで飛ばす(data-strike) */
    [data-tactics-look] [data-em-emo="rain"] > [data-em-fx-el]::after { left: -20%; right: -20%; top: -10%; font-size: 34px; word-spacing: 26px;
      content: var(--em-e, '') ' ' var(--em-e, '') ' ' var(--em-e, '') ' ' var(--em-e, ''); animation: emEmoRain var(--em-dur) ease-in forwards; }
    /* ---- 敵の技の全画面の演出(TacticsEnemyStageFx。body の直下なので [data-tactics-look] の外にある) ----
       2026-09-24 ユーザー指示「攻撃が味方に届く」「技ごとの飾りを個性的に」「必殺技だけ特別扱い」「ムーはかなり派手な演出が必要」 */
    [data-enemy-stage-fx] > * { position: absolute; pointer-events: none; font-style: normal; }
    [data-stage-dim] { inset: 0; opacity: 0; animation: emStageDim var(--em-dur) ease-in-out forwards; }
    [data-stage-moo] [data-stage-dim] { background-color: rgba(60,0,20,.25); }
    @keyframes emStageDim { 0% { opacity: 0; } 15%, 80% { opacity: 1; } 100% { opacity: 0; } }
    /* 飛ばすもの。敵の丸枠の真ん中から、狙われた枠の真ん中まで */
    [data-strike] { width: 0; height: 0; opacity: 0; animation-timing-function: cubic-bezier(.5,0,.9,.6); animation-fill-mode: both; }
    [data-strike="orb"] { width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; line-height: 1;
      background: radial-gradient(circle, #fff 0 22%, rgba(var(--em-c),.95) 45%, rgba(var(--em-c),0) 72%); box-shadow: 0 0 22px 8px rgba(var(--em-c),.7); animation-name: emStrikeOrb; }
    [data-strike="orb"]:not(:empty) { background: none; box-shadow: none; filter: drop-shadow(0 0 10px rgba(var(--em-c),1)); font-size: 34px; }
    [data-strike="orb"][data-big] { width: 48px; height: 48px; margin: -24px 0 0 -24px; font-size: 48px; }
    [data-stage-moo] [data-strike="orb"]:not(:empty) { font-size: 110px; width: 110px; height: 110px; margin: -55px 0 0 -55px; }
    @keyframes emStrikeOrb {
      0% { opacity: 0; transform: scale(.3); }
      18% { opacity: 1; transform: scale(1); }
      88% { opacity: 1; transform: translate(var(--dx), var(--dy)) scale(1.5); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1.8); }
    }
    [data-strike="beam"], [data-strike="laser"] { height: 18px; width: var(--len); margin-top: -9px; transform-origin: 0 50%; border-radius: 9px;
      background: linear-gradient(180deg, transparent, rgba(var(--em-c),.9) 25%, #fff 45% 55%, rgba(var(--em-c),.9) 75%, transparent);
      box-shadow: 0 0 24px 6px rgba(var(--em-c),.7); animation-name: emStrikeBeam; animation-timing-function: ease-out; }
    [data-strike="laser"] { height: 6px; margin-top: -3px; box-shadow: 0 0 12px 3px rgba(var(--em-c),.9); }
    [data-strike="beam"][data-big] { height: 40px; margin-top: -20px; border-radius: 20px; }
    [data-stage-moo] [data-strike="beam"] { height: 110px; margin-top: -55px; border-radius: 55px; box-shadow: 0 0 60px 20px rgba(var(--em-c),.8); }
    @keyframes emStrikeBeam {
      0% { opacity: 0; transform: rotate(var(--ang)) scaleX(0); }
      45% { opacity: 1; transform: rotate(var(--ang)) scaleX(1); }
      75% { opacity: 1; transform: rotate(var(--ang)) scaleX(1) scaleY(1.2); }
      100% { opacity: 0; transform: rotate(var(--ang)) scaleX(1) scaleY(.2); }
    }
    [data-strike="wave"] { width: 110px; height: 50px; margin: -25px 0 0 -55px; border-radius: 50%; border-bottom: 6px solid rgba(255,255,255,.95);
      box-shadow: 0 12px 18px -8px rgba(var(--em-c),1); filter: drop-shadow(0 0 8px rgba(var(--em-c),1)); animation-name: emStrikeWave; }
    [data-strike="wave"][data-big] { width: 170px; height: 70px; margin: -35px 0 0 -85px; }
    @keyframes emStrikeWave {
      0% { opacity: 0; transform: rotate(calc(var(--ang) - 90deg)) scale(.4); }
      18% { opacity: 1; }
      88% { opacity: 1; transform: translate(var(--dx), var(--dy)) rotate(calc(var(--ang) - 90deg)) scale(1.4); }
      100% { opacity: 0; transform: translate(var(--dx), var(--dy)) rotate(calc(var(--ang) - 90deg)) scale(1.7); }
    }
    /* 当たりの形。狙われた枠の真ん中に出る。--w は枠の大きさ */
    [data-impact] { width: var(--w); height: var(--w); margin: calc(var(--w) / -2) 0 0 calc(var(--w) / -2); opacity: 0;
      display: flex; align-items: center; justify-content: center; font-size: calc(var(--w) * .42); line-height: 1;
      animation: emImpact 400ms ease-out both; filter: drop-shadow(0 0 10px rgba(var(--em-c),1)); }
    [data-impact][data-big] { --s: 1.35; }
    [data-impact]::before, [data-impact]::after { content: ''; position: absolute; inset: 0; border-radius: 50%; z-index: -1; }
    @keyframes emImpact {
      0% { opacity: 0; transform: scale(calc(.3 * var(--s, 1))); }
      18% { opacity: 1; transform: scale(calc(1.05 * var(--s, 1))); }
      60% { opacity: 1; transform: scale(calc(1.15 * var(--s, 1))); }
      100% { opacity: 0; transform: scale(calc(1.45 * var(--s, 1))); }
    }
    [data-impact="burst"]::before, [data-impact="nova"]::before {
      background: repeating-conic-gradient(rgba(255,255,255,.95) 0 4deg, rgba(var(--em-c),.8) 4deg 9deg, transparent 9deg 30deg);; }
    [data-impact="burst"]::after, [data-impact="nova"]::after { inset: 25%; background: radial-gradient(circle, #fff, rgba(var(--em-c),.8) 50%, transparent 72%); }
    [data-impact="nova"] { --s: 1.6; }
    /* カワズモー: 手のひらの跡を押す */
    [data-impact="stamp"]::after { inset: 10%; background: radial-gradient(circle, rgba(255,255,255,.9), rgba(var(--em-c),.6) 45%, transparent 70%); }
    /* メタルナー: 六角形の光の輪 */
    [data-impact="hex"]::before { inset: 8%; border-radius: 0; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%);
      background: radial-gradient(circle, transparent 50%, rgba(255,255,255,.95) 56%, rgba(var(--em-c),.9) 62%, transparent 70%); }
    [data-impact="hex"]::after { inset: 30%; border-radius: 0; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%); background: rgba(var(--em-c),.55); }
    /* イナリ: 肉球と花びら */
    [data-impact="paw"]::after { background: radial-gradient(6px 6px at 20% 30%, #fbcfe8, transparent 75%), radial-gradient(6px 6px at 80% 25%, #fde68a, transparent 75%),
      radial-gradient(6px 6px at 75% 80%, #fbcfe8, transparent 75%), radial-gradient(6px 6px at 22% 75%, #fde68a, transparent 75%), radial-gradient(circle, rgba(var(--em-c),.45), transparent 65%); }
    /* コイノボリ: 水しぶき */
    [data-impact="splash"]::before { background: radial-gradient(7px 10px at 50% 5%, #e0f2fe, transparent 75%), radial-gradient(7px 10px at 90% 40%, #7dd3fc, transparent 75%),
      radial-gradient(7px 10px at 75% 90%, #e0f2fe, transparent 75%), radial-gradient(7px 10px at 20% 88%, #7dd3fc, transparent 75%), radial-gradient(7px 10px at 8% 38%, #e0f2fe, transparent 75%); }
    [data-impact="splash"]::after { inset: 15%; border: 4px solid rgba(186,230,253,.9); box-shadow: 0 0 16px rgba(56,189,248,.9); }
    /* デルピエロ: X の斬り跡 */
    [data-impact="xslash"]::before { border-radius: 0;
      background: linear-gradient(45deg, transparent 46%, #fff 49%, rgba(var(--em-c),.95) 51%, transparent 54%), linear-gradient(-45deg, transparent 46%, #fff 49%, rgba(var(--em-c),.95) 51%, transparent 54%); }
    /* ドクドク: べちゃっと広がる粘液 */
    [data-impact="goo"]::before { inset: 6%; border-radius: 46% 54% 38% 62% / 55% 40% 60% 45%;
      background: radial-gradient(circle at 40% 40%, rgba(233,213,255,.95), rgba(147,51,234,.85) 45%, rgba(88,28,135,.6) 70%, transparent 72%); }
    /* ラミア: 炎の柱 */
    [data-impact="flame"]::before { inset: -10% 10% 0; border-radius: 50% 50% 40% 40%;
      background: radial-gradient(60% 80% at 50% 90%, #fff7ed, #fb923c 35%, #dc2626 65%, transparent 72%); }
    /* ニャルラトホテプ: 渦巻く闇 */
    [data-impact="void"]::before { background: conic-gradient(from 0deg, #000, rgba(var(--em-c),.9), #1e0336, #000, rgba(168,85,247,.9), #000);; animation: emVoidSpin 600ms linear infinite; }
    @keyframes emVoidSpin { to { transform: rotate(360deg); } }
    /* スプラッター: 3本の爪あと */
    [data-impact="claw"]::before { border-radius: 0; transform: rotate(-30deg);
      background: linear-gradient(90deg, transparent 18%, #fff 20%, #dc2626 22.5%, transparent 25%, transparent 46%, #fff 48%, #dc2626 50.5%, transparent 53%, transparent 74%, #fff 76%, #dc2626 78.5%, transparent 81%); }
    /* ---- 覚醒ムー ---- */
    [data-moo-cutin] { left: 0; right: 0; top: 50%; height: 0; }
    [data-moo-cutin-band] { position: absolute; left: -10%; right: -10%; top: -44px; height: 88px; transform: skewY(-7deg);
      background: linear-gradient(90deg, rgba(20,0,10,.95), rgba(88,10,30,.96) 30%, rgba(40,0,15,.96) 70%, rgba(20,0,10,.95));
      border-top: 3px solid #facc15; border-bottom: 3px solid #facc15; box-shadow: 0 0 40px rgba(250,204,21,.6), 0 0 90px rgba(220,38,38,.5);
      display: flex; align-items: center; justify-content: center; overflow: hidden; animation: mooCutinBand var(--em-dur) cubic-bezier(.2,.8,.2,1) both; }
    [data-moo-cutin-band]::before { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(100deg, transparent 0 40px, rgba(250,204,21,.08) 40px 44px); animation: mooCutinStreak 400ms linear infinite; }
    [data-moo-cutin-band] > span { position: relative; font-weight: 900; font-size: clamp(30px, 10vw, 48px); letter-spacing: .12em; color: #fff; white-space: nowrap;
      text-shadow: 0 0 10px #facc15, 0 0 24px #dc2626, 0 3px 0 #7f1d1d; -webkit-text-stroke: 1px #facc15; animation: mooCutinText var(--em-dur) cubic-bezier(.2,.8,.2,1) both; }
    @keyframes mooCutinBand { 0% { opacity: 0; transform: skewY(-7deg) scaleY(0); } 6% { opacity: 1; transform: skewY(-7deg) scaleY(1.15); } 10%, 38% { opacity: 1; transform: skewY(-7deg) scaleY(1); } 46%, 100% { opacity: 0; transform: skewY(-7deg) scaleY(0); } }
    @keyframes mooCutinText { 0% { transform: translateX(120vw); } 10% { transform: translateX(-4vw); } 14%, 34% { transform: translateX(0); } 44%, 100% { transform: translateX(-130vw); } }
    @keyframes mooCutinStreak { to { background-position: -88px 0; } }
    [data-moo-flash] { inset: 0; opacity: 0; background: radial-gradient(circle at 50% 55%, #fff, rgba(255,240,200,.9) 40%, rgba(250,204,21,.4) 75%); animation: mooFlash 420ms ease-out both; }
    @keyframes mooFlash { 0% { opacity: 0; } 10% { opacity: .7; } 100% { opacity: 0; } }
    [data-moo-crack] { left: 0; top: 0; opacity: 0; overflow: visible; animation: mooCrack 900ms ease-out both; }
    [data-moo-crack] path { fill: none; stroke: #fff; stroke-width: 3; stroke-linejoin: round; filter: drop-shadow(0 0 4px #facc15) drop-shadow(0 0 10px rgba(220,38,38,.9)); }
    @keyframes mooCrack { 0% { opacity: 0; } 8%, 70% { opacity: 1; } 100% { opacity: 0; } }
    [data-moo-claw] { left: -20%; width: 140%; height: 12px; margin-top: -6px; transform: rotate(-32deg) scaleX(0); transform-origin: 0 50%; border-radius: 6px; opacity: 0;
      background: linear-gradient(180deg, transparent, #dc2626 25%, #fff 45% 55%, #facc15 75%, transparent); box-shadow: 0 0 26px 8px rgba(220,38,38,.8); animation: mooClaw 520ms ease-out both; }
    @keyframes mooClaw { 0% { opacity: 1; transform: rotate(-32deg) scaleX(0); } 40% { opacity: 1; transform: rotate(-32deg) scaleX(1); } 100% { opacity: 0; transform: rotate(-32deg) scaleX(1) scaleY(.2); } }
    [data-moo-meteor] { top: -12%; font-size: 64px; opacity: 0; filter: drop-shadow(0 0 16px rgba(251,146,60,1)); animation: mooMeteor 700ms cubic-bezier(.4,0,1,1) both; }
    @keyframes mooMeteor { 0% { opacity: 0; transform: translate(40vw, 0) rotate(-20deg) scale(.6); } 15% { opacity: 1; } 90% { opacity: 1; transform: translate(-30vw, 80vh) rotate(-20deg) scale(1.3); } 100% { opacity: 0; transform: translate(-34vw, 86vh) scale(1.8); } }
    [data-moo-tornado] { left: 0; font-size: 110px; margin-top: -55px; opacity: 0; filter: drop-shadow(0 0 20px rgba(250,204,21,.8)); animation: mooTornado 900ms ease-in-out both; }
    @keyframes mooTornado { 0% { opacity: 0; transform: translateX(-40vw) scaleX(.8); } 15% { opacity: 1; } 50% { transform: translateX(40vw) scaleX(1.1) rotate(-6deg); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateX(110vw) scaleX(.9) rotate(6deg); } }
    [data-moo-bolt] { font-size: 90px; opacity: 0; filter: drop-shadow(0 0 20px #fde047) drop-shadow(0 0 40px #fff); animation: mooBolt 360ms steps(2, jump-none) both; }
    @keyframes mooBolt { 0% { opacity: 0; transform: scale(.6); } 20% { opacity: 1; transform: scale(1.2); } 40% { opacity: .2; } 60% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0; transform: scale(1.3); } }
    [data-moo-heaven] { left: calc(var(--sx) - 110px); top: 0; width: 220px; height: calc(var(--sy) + 120px); opacity: 0;
      background: linear-gradient(90deg, transparent, rgba(255,251,235,.75) 30% 70%, transparent); filter: blur(4px); animation: mooHeaven var(--em-dur) ease-in-out both; }
    @keyframes mooHeaven { 0% { opacity: 0; transform: scaleX(.2); } 25%, 75% { opacity: 1; transform: scaleX(1); } 100% { opacity: 0; transform: scaleX(1.3); } }
    [data-moo-feather] { top: -6%; font-size: 30px; opacity: 0; filter: drop-shadow(0 0 8px #fff); animation: mooFeather 900ms ease-in both; }
    @keyframes mooFeather { 0% { opacity: 0; transform: translateY(0) rotate(0); } 20% { opacity: 1; } 100% { opacity: 0; transform: translateY(45vh) rotate(160deg); } }
    [data-moo-gather] { left: var(--sx); top: var(--sy); width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; opacity: 0;
      background: radial-gradient(circle, #fff, rgba(250,204,21,.9) 50%, transparent 72%); box-shadow: 0 0 14px 4px rgba(250,204,21,.8); animation: mooGather 600ms ease-in both; }
    @keyframes mooGather { 0% { opacity: 0; transform: translate(var(--gx), var(--gy)) scale(1.4); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(0, 0) scale(.3); } }
    [data-moo-reticle] { width: 90px; height: 90px; margin: -45px 0 0 -45px; border-radius: 50%; opacity: 0; border: 3px dashed rgba(250,204,21,.95);
      box-shadow: 0 0 16px rgba(220,38,38,.9), inset 0 0 16px rgba(220,38,38,.6); animation: emLock 800ms ease-out both; }
    /* ---- ボスの必殺技ムービー(71-screen-battle の BossMovieLayer)。画面を切り替えて、上に技名・まんなかにムービー ----
       ★ムービーは横長(768×488)。縦のスマホでは幅いっぱいより少し大きく(116vw)して左右を少しだけ切り、上下のふちはぼかして背景へなじませる。
       ★技名の札(z 65000)・敵の技の演出(z 64000)より上に出す */
    [data-boss-movie] { position: fixed; inset: 0; z-index: 66000; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); -webkit-tap-highlight-color: transparent; user-select: none;
      background: radial-gradient(ellipse at 50% 50%, #34104f, #0c0218 62%, #000); animation: bossMovieIn 260ms ease-out both; }
    /* ★背景は不透明にする。半透明だと、うしろの戦闘画面(敵の絵・枠)が透けて見える */
    @keyframes bossMovieIn { from { opacity: 0; } to { opacity: 1; } }
    [data-boss-movie-stage] { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 14px; }
    [data-boss-movie-frame] { position: relative; flex-shrink: 0; width: min(116vw, calc(66vh * 768 / 488)); aspect-ratio: 768 / 488; overflow: hidden;
      -webkit-mask-image: linear-gradient(180deg, transparent, #000 7%, #000 93%, transparent); mask-image: linear-gradient(180deg, transparent, #000 7%, #000 93%, transparent); }
    [data-boss-movie-frame] > video { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    [data-boss-movie-title] { text-align: center; line-height: 1.15; animation: bossMovieTitle 900ms cubic-bezier(.2,.8,.2,1) both; }
    [data-boss-movie-title] small { display: block; font-size: 12px; font-weight: 900; letter-spacing: .3em; color: #e9d5ff; opacity: .85; }
    [data-boss-movie-title] b { display: block; font-weight: 900; font-size: clamp(30px, 10vw, 52px); letter-spacing: .14em; color: #fff; white-space: nowrap;
      text-shadow: 0 0 10px #c084fc, 0 0 26px #7e22ce, 0 3px 0 #3b0764; -webkit-text-stroke: 1px #facc15; }
    @keyframes bossMovieTitle { 0% { opacity: 0; transform: scale(1.6); } 100% { opacity: 1; transform: scale(1); } }
    [data-boss-movie-skip] { position: absolute; right: 14px; bottom: calc(14px + env(safe-area-inset-bottom)); padding: 6px 12px; border-radius: 999px; pointer-events: none;
      font-size: 11px; font-weight: 900; color: rgba(255,255,255,.75); border: 1px solid rgba(255,255,255,.25); background: rgba(0,0,0,.45); transition: opacity 300ms; }
    /* 光線・爆発の瞬間の揺れ。a と b は同じ動き(属性を切り替えて、動きを頭からかけ直すため2つある) */
    [data-boss-movie-shake="a"] { animation: bossMovieShakeA 420ms ease-out both; }
    [data-boss-movie-shake="b"] { animation: bossMovieShakeB 420ms ease-out both; }
    @keyframes bossMovieShakeA { 0%, 100% { transform: translate(0, 0); } 15% { transform: translate(-9px, 6px); } 30% { transform: translate(8px, -7px); } 45% { transform: translate(-6px, 4px); } 60% { transform: translate(5px, -3px); } 80% { transform: translate(-2px, 1px); } }
    @keyframes bossMovieShakeB { 0%, 100% { transform: translate(0, 0); } 15% { transform: translate(-9px, 6px); } 30% { transform: translate(8px, -7px); } 45% { transform: translate(-6px, 4px); } 60% { transform: translate(5px, -3px); } 80% { transform: translate(-2px, 1px); } }
    /* 覚醒ムーの待機: 翼を広げるように左右へ張り、ときどき身をかがめて吠える。黒い気が立ちのぼり、目が赤く光る */
    @keyframes mooIdleMenace {
      0%, 100% { transform: translateY(0) scale(1, 1); }
      12% { transform: translateY(-10px) scale(1.06, .98); }
      24% { transform: translateY(0) scale(.97, 1.02); }
      36% { transform: translateY(-12px) scale(1.07, .98); }
      48% { transform: translateY(0) scale(1, 1); }
      60% { transform: translateY(6px) scale(1.03, .96); }
      68% { transform: translateY(-6px) scale(1.1, 1.04); }
      72% { transform: translate(-3px, -6px) scale(1.1, 1.04); }
      76% { transform: translate(3px, -6px) scale(1.1, 1.04); }
      86% { transform: translateY(-4px) scale(1.02); }
    }
    @keyframes mooIdleSmoke { 0% { opacity: 0; transform: translateY(20%) scale(.9); } 30% { opacity: .85; } 100% { opacity: 0; transform: translateY(-18%) scale(1.15); } }
    @keyframes mooIdleEye { 0%, 55%, 100% { opacity: .35; transform: scale(.8); } 68%, 80% { opacity: 1; transform: scale(1.3); } }
    [data-tactics-look="rich"] [data-moo-stage]:not([data-enemy-skill]):not([data-enemy-hurt]) > [data-moo-body] { animation: mooIdleMenace 4.2s ease-in-out infinite; }
    [data-tactics-look="rich"] [data-moo-stage]::before { content: ''; position: absolute; inset: 8% 14% 10%; border-radius: 50%; pointer-events: none; z-index: 0; opacity: 0;
      background: radial-gradient(18% 26% at 30% 70%, rgba(40,0,60,.8), transparent 70%), radial-gradient(20% 30% at 70% 65%, rgba(60,0,40,.8), transparent 70%),
        radial-gradient(30% 34% at 50% 40%, rgba(88,28,135,.6), transparent 70%); animation: mooIdleSmoke 3.2s ease-out infinite; }
    [data-tactics-look="rich"] [data-moo-stage]::after { content: ''; position: absolute; left: 50%; top: 31%; width: 22%; height: 7%; margin-left: -11%; pointer-events: none; z-index: 2;
      background: radial-gradient(closest-side at 32% 50%, rgba(255,60,60,.95), transparent), radial-gradient(closest-side at 68% 50%, rgba(255,60,60,.95), transparent);
      animation: mooIdleEye 4.2s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      [data-tactics-look] [data-moo-stage] > [data-moo-body], [data-tactics-look] [data-moo-stage] > [data-moo-body] > *, [data-tactics-look] [data-moo-stage]::before, [data-tactics-look] [data-moo-stage]::after { animation: none !important; }
    }
    /* 敵の丸枠: 距離の色のまま、外に回るルーンの輪と金の細い輪を足す */
    [data-tactics-look] [data-enemy-ring="0"] { --mh-rc: 239,68,68; } [data-tactics-look] [data-enemy-ring="1"] { --mh-rc: 245,158,11; }
    [data-tactics-look] [data-enemy-ring="2"] { --mh-rc: 16,185,129; } [data-tactics-look] [data-enemy-ring="3"] { --mh-rc: 59,130,246; }
    [data-tactics-look] [data-enemy-ring] { background: radial-gradient(closest-side, rgba(var(--mh-rc),.22), rgba(0,0,0,.4) 70%) !important;
      box-shadow: 0 0 0 3px rgba(243,210,122,.55), 0 0 0 5px rgba(20,12,4,.85), 0 0 16px rgba(var(--mh-rc),.85), 0 0 40px rgba(var(--mh-rc),.55), inset 0 0 30px rgba(var(--mh-rc),.35) !important; }
    /* ★丸枠の filter(距離の色の drop-shadow)は外す(2026-09-24 ユーザー指摘「バトル画面にかくつき」)。
       丸枠の中では敵の絵と魔法陣がずっと動いているので、丸枠ごとぼかした影を毎コマ描き直していた。
       同じ色の光は上の box-shadow(縁にぴったりの 16px と、広がる 40px)で出す */
    [data-tactics-look] [data-enemy-ring] { filter: none !important; }
    [data-tactics-look] [data-enemy-ring]::before { content: ''; position: absolute; inset: -16px; border-radius: 50%; pointer-events: none; z-index: 0;
      /* ★切り抜き(mask)を使わず、もとの模様(30°ごとに距離色と金の目盛り)を SVG の破線の円で描く。
           回すのは transform だけなので描き直しも要らない(iPhone で切り抜きが外れると丸い光の板が出たため 2026-09-24) */
      background: center / 100% 100% no-repeat; }
    [data-tactics-look] [data-enemy-ring="0"]::before { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(239,68,68,.28)' stroke-width='5'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(239,68,68,.95)' stroke-width='2.8' stroke-dasharray='2.48 22.34'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(255,240,200,.85)' stroke-width='2.8' stroke-dasharray='0.83 23.99' stroke-dashoffset='-9.93'/></svg>"); }
    [data-tactics-look] [data-enemy-ring="1"]::before { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(245,158,11,.28)' stroke-width='5'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(245,158,11,.95)' stroke-width='2.8' stroke-dasharray='2.48 22.34'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(255,240,200,.85)' stroke-width='2.8' stroke-dasharray='0.83 23.99' stroke-dashoffset='-9.93'/></svg>"); }
    [data-tactics-look] [data-enemy-ring="2"]::before { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(16,185,129,.28)' stroke-width='5'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(16,185,129,.95)' stroke-width='2.8' stroke-dasharray='2.48 22.34'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(255,240,200,.85)' stroke-width='2.8' stroke-dasharray='0.83 23.99' stroke-dashoffset='-9.93'/></svg>"); }
    [data-tactics-look] [data-enemy-ring="3"]::before { background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(59,130,246,.28)' stroke-width='5'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(59,130,246,.95)' stroke-width='2.8' stroke-dasharray='2.48 22.34'/><circle cx='50' cy='50' r='47.4' fill='none' stroke='rgba(255,240,200,.85)' stroke-width='2.8' stroke-dasharray='0.83 23.99' stroke-dashoffset='-9.93'/></svg>"); }
    [data-tactics-look="rich"] [data-enemy-ring]::before { animation: mhRuneSpin 14s linear infinite; }
    /* ==== 枠に出す効果の光(2026-09-24 ユーザー指示「支援系のアクションももう少しそれっぽく」)。
       回復=緑の光の粒が昇る / 攻撃=赤い光が下から吹き上がる / 守り=青い盾の輪が広がる / ガッツ=黄色の稲妻 / そのほか=金のきらめき。
       1回きり(forwards)で消える。軽量表示では動きの代わりに短い色の点灯だけにする ==== */
    @keyframes mhAuraGlow { 0% { opacity: 0; } 18% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes mhAuraRise { 0% { transform: translateY(40%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateY(-60%); opacity: 0; } }
    @keyframes mhAuraRing { 0% { transform: translate(-50%,-50%) scale(.3); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; } }
    @keyframes mhAuraFlash { 0%, 100% { opacity: 0; } 10%, 30% { opacity: 1; } 20%, 40% { opacity: .3; } }
    [data-tactics-look] [data-slot-aura] { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; pointer-events: none; z-index: 66;
      animation: mhAuraGlow 1.3s ease-out forwards; }
    [data-tactics-look] [data-slot-aura]::before, [data-tactics-look] [data-slot-aura]::after { content: ''; position: absolute; pointer-events: none; }
    [data-tactics-look] [data-slot-aura="heal"] { background: radial-gradient(70% 80% at 30% 70%, rgba(52,211,153,.45), transparent 70%); box-shadow: inset 0 0 18px rgba(52,211,153,.8); }
    [data-tactics-look] [data-slot-aura="heal"]::before { left: 0; right: 0; top: 0; bottom: 0; animation: mhAuraRise 1.3s ease-out forwards;
      background: radial-gradient(3px 3px at 18% 80%, #a7f3d0, transparent 70%), radial-gradient(2px 2px at 32% 60%, #fff, transparent 70%),
        radial-gradient(3px 3px at 48% 90%, #6ee7b7, transparent 70%), radial-gradient(2px 2px at 64% 70%, #d1fae5, transparent 70%),
        radial-gradient(3px 3px at 80% 85%, #a7f3d0, transparent 70%), radial-gradient(2px 2px at 26% 100%, #fff, transparent 70%); }
    [data-tactics-look] [data-slot-aura="power"] { box-shadow: inset 0 0 20px rgba(248,113,113,.85); }
    [data-tactics-look] [data-slot-aura="power"]::before { left: 0; right: 0; bottom: 0; height: 100%; animation: mhAuraRise 1.1s ease-out forwards;
      background: linear-gradient(0deg, rgba(239,68,68,0) 0%, rgba(239,68,68,0) 100%), repeating-linear-gradient(90deg, transparent 0 10px, rgba(252,165,165,.35) 10px 12px, transparent 12px 22px),
        linear-gradient(0deg, rgba(239,68,68,.55), transparent 80%); }
    [data-tactics-look] [data-slot-aura="shield"] { box-shadow: inset 0 0 18px rgba(96,165,250,.85); }
    [data-tactics-look] [data-slot-aura="shield"]::before { left: 30%; top: 58%; width: 90px; height: 90px; border-radius: 50%; animation: mhAuraRing 1.2s ease-out forwards;
      border: 3px solid rgba(147,197,253,.95); box-shadow: 0 0 14px rgba(96,165,250,.9), inset 0 0 14px rgba(96,165,250,.6); }
    [data-tactics-look] [data-slot-aura="guts"] { box-shadow: inset 0 0 18px rgba(251,191,36,.85); background: radial-gradient(60% 70% at 30% 60%, rgba(251,191,36,.35), transparent 70%); }
    [data-tactics-look] [data-slot-aura="guts"]::before { inset: 0; animation: mhAuraFlash .9s linear forwards;
      background: linear-gradient(115deg, transparent 38%, rgba(254,240,138,.95) 40%, transparent 42%), linear-gradient(115deg, transparent 58%, rgba(254,240,138,.8) 59%, transparent 61%); }
    [data-tactics-look] [data-slot-aura="buff"] { box-shadow: inset 0 0 16px rgba(243,210,122,.8); }
    [data-tactics-look] [data-slot-aura="buff"]::before { inset: 0; animation: mhAuraRise 1.2s ease-out forwards;
      background: radial-gradient(2px 2px at 20% 80%, #fff3c4, transparent 70%), radial-gradient(3px 3px at 45% 90%, #f3d27a, transparent 70%), radial-gradient(2px 2px at 70% 75%, #fff, transparent 70%); }
    [data-tactics-look="calm"] [data-slot-aura]::before { display: none; }
    @media (prefers-reduced-motion: reduce) {
      [data-tactics-look] [data-slot-index], [data-tactics-look] [data-slot-index]::after, [data-tactics-look] [data-slot-circle],
      [data-tactics-look] [data-card-frame], [data-tactics-look] [data-card-shine]::before, [data-tactics-look] [data-card-gem],
      [data-tactics-look] [data-enemy-hpbar]::after, [data-tactics-look] [data-enemy-ring]::before,
      [data-tactics-look] [data-enemy-motion] > span > img, [data-tactics-look] [data-enemy-motion] > [data-enemy-shadow],
      [data-tactics-look] [data-enemy-motion] > [data-enemy-shadow]::before, [data-tactics-look] [data-enemy-motion] > [data-enemy-shadow]::after,
      [data-tactics-look] [data-em-idle]:not([data-enemy-skill]):not([data-enemy-hurt]) > span > img { animation: none !important; }
    }
    /* タクティクスの枠の中・盤面の上に出す吹き出し。下から少し浮かせて出す */
    @keyframes tacticsPopupRise {
      0% { opacity: 0; transform: translateY(6px) scale(0.92); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes dragGrab {
      0% { transform: translate(-50%,-100%) scale(0.6); opacity: 0.4; }
      60% { transform: translate(-50%,-100%) scale(1.12); opacity: 1; }
      100% { transform: translate(-50%,-100%) scale(1); opacity: 1; }
    }
    @keyframes cardSnap {
      0% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
      100% { transform: translate(calc(-50% + var(--snapDX)), calc(-50% + var(--snapDY))) scale(0.35); opacity: 0; }
    }
    @keyframes slotSettle {
      0% { transform: scale(1); }
      35% { transform: scale(1.12); }
      65% { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
    @keyframes setRing {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(2.4); opacity: 0; }
    }
    /* マスモン登録の誘導。見落とされやすいので枠がゆっくり光る */
    @keyframes masuCallout {
      0%, 100% { box-shadow: 0 0 0 0 rgba(236,72,153,0.55), 0 0 14px rgba(236,72,153,0.25); }
      50% { box-shadow: 0 0 0 6px rgba(236,72,153,0), 0 0 22px rgba(236,72,153,0.65); }
    }
    @keyframes masuBadge {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.12); }
    }
    @keyframes setPop {
      0% { transform: scale(0); opacity: 0; }
      55% { transform: scale(1.25); opacity: 1; }
      80% { transform: scale(1); opacity: 1; }
      100% { transform: scale(1); opacity: 0; }
    }
    @keyframes guardShine {
      0% { transform: scale(0.4); opacity: 0; }
      30% { transform: scale(1.25); opacity: 1; }
      70% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes guardSpark {
      0% { transform: translateY(0) scale(0.3); opacity: 0; }
      40% { opacity: 1; }
      100% { transform: translateY(-140px) scale(1); opacity: 0; }
    }
    @keyframes guardFlash {
      0% { opacity: 0; }
      25% { opacity: 1; }
      100% { opacity: 0; }
    }
    /* 固有技の突進。タメで沈んだ位置から敵の位置へ一直線に飛び込み、大きくつぶれて光ってから戻る */
    @keyframes specialLunge {
      0% { transform: translate3d(0,44px,0) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
      30% { transform: translate3d(calc(var(--atk-dx) * .9),calc(var(--atk-dy) * .9),0) scale(1.5) rotate(calc(var(--atk-rot) * .3)); filter: drop-shadow(calc(var(--atk-dx) * -.14) calc(var(--atk-dy) * -.14) 0 rgba(217,70,239,.4)) drop-shadow(0 0 34px rgba(217,70,239,1)); }
      40% { transform: translate3d(calc(var(--atk-dx) * .97),calc(var(--atk-dy) * .97),0) scale(1.72,1.3) rotate(calc(var(--atk-rot) * .3)); filter: drop-shadow(0 0 44px rgba(255,255,255,1)) brightness(1.4); }
      58% { transform: translate3d(calc(var(--atk-dx) * .75),calc(var(--atk-dy) * .75 - 26px),0) scale(1.4) rotate(calc(var(--atk-rot) * -.2)); filter: drop-shadow(0 0 34px rgba(217,70,239,1)); }
      100% { transform: translate3d(0,0,0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    /* アーク/イブリース専用モーション: ゆっくり宙に浮かび上がって漂い、最後に光が鋭く突き刺さる */
    @keyframes floatStabAttack {
      0%   { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 4px rgba(255,255,255,0.3)); }
      55%  { transform: translateY(-100px) scale(1.05) rotate(-3deg); filter: drop-shadow(0 0 14px rgba(255,255,255,0.7)); }
      70%  { transform: translateY(-104px) scale(1.05) rotate(3deg); filter: drop-shadow(0 0 18px rgba(255,255,255,0.85)); }
      85%  { transform: translateY(10px) scale(1.4) rotate(0deg); filter: drop-shadow(0 40px 10px rgba(253,224,71,1)) drop-shadow(0 0 40px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes floatStabLunge {
      0%   { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
      50%  { transform: translateY(-140px) scale(1.1) rotate(-2deg); filter: drop-shadow(0 0 24px rgba(255,255,255,0.8)); }
      65%  { transform: translateY(-146px) scale(1.1) rotate(2deg); filter: drop-shadow(0 0 30px rgba(255,255,255,0.9)); }
      85%  { transform: translateY(20px) scale(1.55) rotate(0deg); filter: drop-shadow(0 50px 12px rgba(253,224,71,1)) drop-shadow(0 0 60px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes enemyAttackFly {
      0% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 6px rgba(239,68,68,0.5));
      }
      45% {
        transform: translateY(90px) scale(1.18);
        filter: drop-shadow(0 0 20px rgba(239,68,68,0.9));
      }
      60% {
        transform: translateY(90px) scale(1.18);
        filter: drop-shadow(0 0 28px rgba(220,38,38,1));
      }
      100% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    @keyframes enemyMoveSlide {
      0% { transform: translateX(0) scale(1); }
      30% { transform: translateX(-70px) scale(0.95); }
      70% { transform: translateX(70px) scale(0.95); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes enemyMoveSlideMoo {
      0% { transform: translate(0, 24px) scale(1); }
      30% { transform: translate(-90px, 24px) scale(0.97); }
      70% { transform: translate(90px, 24px) scale(0.97); }
      100% { transform: translate(0, 24px) scale(1); }
    }
    @keyframes exclaimPop {
      0% { transform: scale(0) translateY(8px) rotate(-12deg); opacity: 0; }
      55% { transform: scale(1.5) translateY(-4px) rotate(8deg); opacity: 1; }
      100% { transform: scale(1.15) translateY(0) rotate(0deg); opacity: 1; }
    }
    @keyframes shockRing {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(1.55); opacity: 0; }
    }
    @keyframes enemyExclaim {
      0%,100% { opacity: 1; }
    }
    /* ムーの必殺技の準備。巨体なので沈み込みを浅く、ゆらぎを大きめにする。
       攻撃の突進(mooAttackLunge)を流用すると、準備なのに殴りかかって見えてしまう */
    @keyframes mooChargeGather {
      0% { transform: scale(1) translateY(0); }
      20% { transform: scale(0.97) translateY(6px); }
      40% { transform: scale(0.98) translate(-5px, 4px); }
      60% { transform: scale(1.01) translate(5px, 0); }
      80% { transform: scale(1.05) translate(-4px, -5px); }
      100% { transform: scale(1) translateY(0); }
    }
    /* 必殺技の準備。その場で踏ん張って力を溜める(前に出る突進とは別の動き) */
    @keyframes enemyChargeShake {
      0% { transform: scale(1); }
      15% { transform: scale(0.94) translateY(2px); }
      30% { transform: scale(0.96) translate(-2px, 1px); }
      45% { transform: scale(0.98) translate(2px, 1px); }
      60% { transform: scale(1.02) translate(-2px, -1px); }
      80% { transform: scale(1.06) translate(2px, -2px); }
      100% { transform: scale(1); }
    }
    /* ためている最中に、周りからオーラが敵へ吸い込まれていく */
    @keyframes chargeGather {
      0% { transform: rotate(var(--deg,0deg)) translateY(-70px) scale(0.6); opacity: 0; }
      35% { opacity: 1; }
      100% { transform: rotate(var(--deg,0deg)) translateY(0) scale(1.15); opacity: 0; }
    }
    /* 次のターンに間合いを変える、という敵のつぶやき。
       文字だけだと背景に埋もれるので、しっぽ付きの吹き出しにして敵の右上に出す */
    /* 次のターンに間合いを変える、という敵のつぶやき。
       大きくすると敵の絵を隠してしまうので、画面下の行動予告バッジと同じ大きさにして
       右へ寄せる。読み取れるように行き先は文章で書く */
    .mh-enemy-move-hint {
      position: relative; display: flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 999px;
      border: 1px solid #22d3ee99; background: #083344f2; color: #cffafe;
      /* font のまとめ書きは font-family に inherit を書けず、指定ごと無効になる。
         大きさが効かず敵の絵を隠してしまったので、個別に書く */
      font-size: 9px; font-weight: 1000; line-height: 1.4;
      letter-spacing: -.01em; white-space: nowrap;
      text-shadow: 0 1px 3px #000;
      box-shadow: 0 2px 8px #000a;
      animation: moveHintBob 1200ms ease-in-out infinite;
    }
    .mh-enemy-move-hint span:first-child { font-size: 10px; }
    .mh-enemy-move-hint::after {
      content: ''; position: absolute; right: 16px; bottom: -6px;
      border: 5px solid transparent; border-top-color: #22d3ee99;
    }
    @keyframes moveHintBob {
      0%,100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }
    @keyframes auraPulse {
      0% { transform: scale(0.85); opacity: 0.55; }
      50% { transform: scale(1.12); opacity: 0.95; }
      100% { transform: scale(0.85); opacity: 0.55; }
    }
    @keyframes auraRing {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    @keyframes sparkFlicker {
      0%,100% { opacity: 0.2; transform: scale(0.8) rotate(var(--r,0deg)) translateY(clamp(-92px, -12dvh, -58px)); }
      50% { opacity: 1; }
    }
    /* ★光(drop-shadow)は要素の固定の指定に任せ、動かすのは大きさだけ(filter を毎コマ変えると描き直しになる) */
    @keyframes specialThrob {
      0%,100% { transform: scale(1); }
      50% { transform: scale(1.25); }
    }
    @keyframes idleExclaim {
      0%,100% { transform: scale(0.95) translateY(0) rotate(-4deg); opacity: 0.85; }
      50% { transform: scale(1.18) translateY(-3px) rotate(4deg); opacity: 1; }
    }
    /* 誰が攻撃を食らったのかを、枠そのもので見せる(2026-09-22 ユーザー指示
       「攻撃されたときに誰が攻撃されたかが分かりづらい 食らったモンスターに
        エフェクトなどがつくようにしたい」)。浮かぶ数字だけでは、全体攻撃のときに
       どこを見ればよいのか目が追いつかない。枠が揺れて光れば一目で分かる */
    @keyframes tacticsHitShake {
      0%,100% { transform: translate(0,0); }
      15% { transform: translate(-4px,2px); }
      30% { transform: translate(4px,-2px); }
      45% { transform: translate(-3px,-2px); }
      60% { transform: translate(3px,2px); }
      80% { transform: translate(-2px,1px); }
    }
    @keyframes tacticsHitFlash {
      0% { opacity: 0; }
      18% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes tacticsHitRing {
      0% { transform: scale(0.45); opacity: 0.95; }
      100% { transform: scale(1.9); opacity: 0; }
    }
    @keyframes tacticsHitEdge {
      0%,100% { opacity: 0; }
      20% { opacity: 1; }
      55% { opacity: 0.5; }
      75% { opacity: 1; }
    }
    /* 敵の右上に出す「何をする技か」の札。効果ごとに動きを変えて、
       色と文字を読む前に「攻めてくるのか・回復するのか」が分かるようにする
       (2026-09-22 ユーザー指示「吹き出しを効果によって変えると見た目がいい」) */
    @keyframes noticeHit {
      0%,100% { transform: scale(1) rotate(-2deg); }
      45% { transform: scale(1.1) rotate(2deg); }
      60% { transform: scale(1.04) rotate(-1deg); }
    }
    /* ★明るさ(filter)は変えない。札を毎コマ描き直すことになる(2026-09-24 かくつきの見直し) */
    @keyframes noticeCharge {
      0%,100% { transform: scale(0.96); opacity: .92; }
      50% { transform: scale(1.12); opacity: 1; }
    }
    @keyframes noticeHeal {
      0%,100% { transform: translateY(2px) scale(1); }
      50% { transform: translateY(-4px) scale(1.05); }
    }
    @keyframes noticeShout {
      0%,100% { transform: translateX(-3px) scale(1.02); }
      50% { transform: translateX(3px) scale(1.08); }
    }
    @keyframes noticeCalm {
      0%,100% { opacity: 0.75; transform: scale(0.98); }
      50% { opacity: 1; transform: scale(1.03); }
    }
    @keyframes idleAuraPulse {
      0%,100% { transform: scale(0.92); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.85; }
    }
    @keyframes idleSpark {
      0%,100% { opacity: 0.15; }
      50% { opacity: 0.9; }
    }
    /* 強化フェーズ(WAVEクリア後のトレーニング・供モン・配置・固有技・アシストカード)の画面。
       根に .mh-phase を付けると、その器の高さで中身を組み替えられる(@container)。
       横持ちのバトルは縦長のコラムのまま真ん中に置かれ(index.html の data-mh-portrait-layout)、
       器は 390×390 ほどになる。そこへ縦持ち用の並びを積むとカードが潰れて重なっていたので、
       背の低い器では .mh-phase-tall(助手の吹き出し・説明・合計の欄など、無くても選べるもの)を畳む。
       自前で画面を回しているとき(data-mh-view-rotation)も、器の高さで判定するので同じく効く。 */
    .mh-phase { container-type: size; }
    /* .mh-phase-card は min-h-[112px] と一緒に付ける。背の低い器ではその下限だけを外す */
    .mh-phase-gain { font-size: clamp(20px, 7vw, 30px); }
    /* .mh-phase-mid … SE(667px)くらいから畳むもの(補足の説明文)。絵も一回り小さくする */
    @container (max-height: 720px) {
      .mh-phase-mid { display: none !important; }
      .mh-phase-hero { width: 64px !important; height: 64px !important; margin-bottom: 4px !important; font-size: 44px; }
    }
    @container (max-height: 560px) {
      .mh-phase-tall { display: none !important; }
      .mh-phase-card { min-height: 0 !important; }
      .mh-phase-gain { font-size: 18px; }
      .mh-phase-hero { width: 44px !important; height: 44px !important; font-size: 32px; }
      /* トレーニングの4枚は横1列に並べ替える(2列2行だと1枚の高さが60px台になり名前しか見えなかった) */
      .mh-phase-cards { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; grid-template-rows: minmax(0, 1fr) !important; }
      .mh-phase-card-icon, .mh-phase-stat-label, .mh-phase-bar { display: none !important; }
      /* 1枚の幅が90px前後になるので、名前・数字・×1 の札を一回り小さくして重ならないようにする */
      .mh-phase-card-name { font-size: 12px !important; }
      .mh-phase-card-nums { font-size: 9px !important; }
      /* ×1 の宝石は名前にかぶらないよう、伸び幅の横(下の数字の欄の上)へ移す */
      .mh-phase-count { top: auto !important; bottom: 30px !important; right: 3px !important; width: 22px !important; height: 20px !important; padding: 2px 0 0 !important; font-size: 8px !important; }
    }
    /* 並んだカードが順に出てくる動き。--i に並び順を入れる。
       fill-mode は backwards にする(both / forwards だと終わったあとも transform を握り続け、
       押したときの active:scale-95 が効かなくなる) */
    .mh-phase-enter { animation: mhPhaseEnter .38s cubic-bezier(.2,.8,.3,1) backwards; animation-delay: calc(var(--i, 0) * 45ms); }
    @keyframes mhPhaseEnter { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
    /* 選んだ瞬間の弾み(×1 の札・伸びる量など)。key を変えて付け直すと毎回鳴る */
    .mh-phase-pop { animation: mhPhasePop .34s cubic-bezier(.2,1.6,.4,1) backwards; }
    @keyframes mhPhasePop { 0% { transform: scale(.55); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    /* 決定できるようになったボタンの呼吸 */
    .mh-phase-ready { animation: mhPhaseReady 1.6s ease-in-out infinite; }
    @keyframes mhPhaseReady { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.12); } }
    @media (prefers-reduced-motion: reduce) {
      .mh-phase-enter, .mh-phase-pop, .mh-phase-ready { animation: none; }
    }
    /* ==== 強化フェーズの画面の見た目(2026-09-24 ユーザー指示「やすっぽい見た目も改善して」
       「タクティクスバトルを参考に見た目を強くしてほしい」)。
       タクティクス新盤面の飾り(濃紺の地・金の細い縁・回る光の縁・距離や種類ごとの模様・宝石・魔法陣・光の筋)を
       同じ言葉で使う。@keyframes mhAng / mhShine / mhTwinkle / mhRuneSpin / mhGem はタクティクスの節で定義済み。
       ★動き(回る縁・きらめき・光の筋・魔法陣・宝石の明滅)は data-phase-look="rich" のときだけ。
         省エネ(lite / 超省エネ∞)では calm になり、「動きを減らす」設定でも止める。見た目は残す。
       ★色は変数で渡す。--ph … 画面の識別色 / --mh-rc・--mh-rc2 … 枠1つぶんの色(濃い・明るい) ==== */
    .mh-ph-bg {
      background:
        radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,.55), transparent 60%),
        radial-gradient(1px 1px at 78% 12%, rgba(255,255,255,.45), transparent 60%),
        radial-gradient(1.5px 1.5px at 64% 34%, rgba(var(--ph,148,163,184),.8), transparent 60%),
        radial-gradient(1px 1px at 28% 58%, rgba(255,255,255,.3), transparent 60%),
        radial-gradient(1px 1px at 90% 66%, rgba(255,255,255,.3), transparent 60%),
        radial-gradient(1.5px 1.5px at 8% 84%, rgba(var(--ph,148,163,184),.6), transparent 60%),
        radial-gradient(ellipse 95% 40% at 50% -6%, rgba(var(--ph,148,163,184),.30), transparent 72%),
        radial-gradient(ellipse 130% 55% at 50% 112%, rgba(var(--ph,148,163,184),.12), transparent 70%),
        repeating-linear-gradient(135deg, rgba(255,255,255,.02) 0 1px, transparent 1px 9px),
        linear-gradient(180deg, #0c1126 0%, #060916 55%, #03040b 100%) !important;
    }
    /* 見出しの金の文字と、左右の飾り線(◆) */
    .mh-ph-title { background: linear-gradient(180deg, #fffbe8 0%, #f6d98a 46%, #c8962e 100%); -webkit-background-clip: text; background-clip: text;
      color: transparent !important; padding-right: .18em; filter: drop-shadow(0 2px 0 rgba(0,0,0,.65)) drop-shadow(0 0 10px rgba(var(--ph,243,210,122),.45)); }
    .mh-ph-heading { display: flex; align-items: center; justify-content: center; gap: 6px; }
    .mh-ph-heading::before, .mh-ph-heading::after { content: '◆'; flex: none; font-size: 7px; line-height: 1; color: #f3d27a; text-shadow: 0 0 6px rgba(243,210,122,.8); }
    .mh-ph-heading::before { padding-left: 26px; background: linear-gradient(90deg, transparent, rgba(243,210,122,.85)) left center / 24px 1px no-repeat; }
    .mh-ph-heading::after { padding-right: 26px; background: linear-gradient(270deg, transparent, rgba(243,210,122,.85)) right center / 24px 1px no-repeat; }
    /* 金の縁の札(WAVE CLEAR など) */
    .mh-ph-plate { display: inline-block; border: 1px solid transparent; border-radius: 999px; padding: 2px 12px; font-size: 9px; font-weight: 900; letter-spacing: .22em; color: #fde9b0;
      background: linear-gradient(180deg, #1c2446, #0b0f22) padding-box, linear-gradient(90deg, #6b4a14, #fff0b0 30%, #c8962e 60%, #6b4a14) border-box;
      box-shadow: 0 0 0 1px rgba(20,12,4,.85), 0 2px 8px rgba(0,0,0,.5), 0 0 14px rgba(var(--ph,243,210,122),.28); text-shadow: 0 1px 2px rgba(0,0,0,.9); }
    /* 金の細い縁のパネル(ステータスの欄・所持カードなど) */
    .mh-ph-panel { border: 1px solid transparent !important; border-radius: 16px;
      background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0) 38%) padding-box,
        linear-gradient(170deg, rgba(18,22,46,.95), rgba(6,8,18,.97)) padding-box,
        linear-gradient(160deg, rgba(243,210,122,.6), rgba(243,210,122,.12) 38%, rgba(243,210,122,.08) 62%, rgba(243,210,122,.5)) border-box !important;
      box-shadow: 0 6px 18px rgba(0,0,0,.45), 0 0 0 1px rgba(10,6,2,.6); }
    .mh-ph-panel-label { color: #d9bf7a !important; letter-spacing: .18em; }
    /* パネルの中の升目 */
    .mh-ph-cell { background: linear-gradient(180deg, rgba(0,0,0,.5), rgba(0,0,0,.28)) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), inset 0 0 0 1px rgba(243,210,122,.08); }
    /* 選ぶ枠: 地の模様 + 濃紺 + 枠の色の縁(タクティクスのモンスター枠と同じ作り)。選んでいない枠は落ち着いた縁、
       data-ph-on の枠は明るい縁が回り、外へ光がにじむ */
    .mh-ph-frame { border: 2px solid transparent !important;
      background: var(--mh-pat, linear-gradient(transparent, transparent)) padding-box,
        linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,0) 30%) padding-box,
        linear-gradient(170deg, rgba(16,18,36,.95), rgba(5,6,14,.98)) padding-box,
        linear-gradient(160deg, rgba(var(--mh-rc),.75), rgba(var(--mh-rc),.22) 40%, rgba(243,210,122,.18) 60%, rgba(var(--mh-rc),.6)) border-box !important; }
    .mh-ph-frame[data-ph-on] {
      background: var(--mh-pat, linear-gradient(transparent, transparent)) padding-box,
        radial-gradient(90% 60% at 50% 0%, rgba(var(--mh-rc),.28), transparent 70%) padding-box,
        linear-gradient(170deg, rgba(16,18,36,.95), rgba(5,6,14,.98)) padding-box,
        conic-gradient(from var(--mh-ang), rgba(var(--mh-rc),1), rgba(var(--mh-rc2),1) 10%, rgba(var(--mh-rc),1) 22%, rgba(30,12,12,.9) 45%,
          rgba(var(--mh-rc),1) 70%, #fff 76%, rgba(var(--mh-rc),1) 82%) border-box !important;
      box-shadow: 0 0 18px rgba(var(--mh-rc),.5), inset 0 0 18px rgba(var(--mh-rc),.18) !important; }
    /* 縁の光は回さず、明るい弧のある縁で止める(バトルの枠と同じ理由) */
    .mh-ph-frame[data-ph-on] { --mh-ang: 35deg; }
    /* 縁を回る光(2026-09-24 ユーザー指摘「かくつき」「まだ手が回ってないところも」)。
       バトルの枠(data-slot-ring)と同じく、縁の角度(--mh-ang)を毎コマ変えるのをやめ、
       縁の形に切り抜いた箱(.mh-ph-ring)の中で光の輪を transform で回す */
    /* ★回る光は出さない(バトルの data-slot-ring と同じ理由。iPhone で切り抜きが外れて固まることがあった)。
       縁は上の conic-gradient(border-box)で、光ったまま止まった見た目にする */
    .mh-ph-ring { display: none !important; }
    /* 枠の中の光の粒 */
    .mh-ph-sparkle { position: absolute; inset: 3px; border-radius: inherit; pointer-events: none;
      background: radial-gradient(1.5px 1.5px at 14% 30%, rgba(var(--mh-rc2),.95), transparent 70%), radial-gradient(1.5px 1.5px at 52% 72%, rgba(var(--mh-rc2),.85), transparent 70%),
        radial-gradient(1px 1px at 80% 42%, #fff, transparent 70%), radial-gradient(1px 1px at 36% 16%, #fff, transparent 70%), radial-gradient(1px 1px at 88% 86%, rgba(var(--mh-rc2),.8), transparent 70%); }
    [data-phase-look="rich"] .mh-ph-sparkle { animation: mhTwinkle 2.6s ease-in-out infinite; }
    /* 枠を横切る光の筋 */
    .mh-ph-shine { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
    .mh-ph-shine::before { content: ''; position: absolute; top: -10%; bottom: -10%; left: 0; width: 40%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.4), transparent); transform: translateX(-160%) skewX(-18deg); }
    [data-phase-look="rich"] .mh-ph-shine::before { animation: mhShine 3.6s ease-in-out infinite; }
    /* 種類ごとの地の模様(タクティクスの手札・枠と同じ模様の言葉) */
    [data-ph-kind="hp"] { --mh-rc: 236,72,153; --mh-rc2: 255,200,230;
      --mh-pat: radial-gradient(circle at 80% 18%, rgba(255,140,200,.22), transparent 45%), repeating-radial-gradient(circle at 80% 18%, rgba(255,160,210,.10) 0 2px, transparent 2px 10px); }
    [data-ph-kind="atk"] { --mh-rc: 239,68,68; --mh-rc2: 255,210,190;
      --mh-pat: radial-gradient(120% 60% at 50% 115%, rgba(255,120,40,.32), transparent 70%), repeating-linear-gradient(135deg, rgba(255,90,40,.10) 0 2px, transparent 2px 9px); }
    [data-ph-kind="def"] { --mh-rc: 16,185,129; --mh-rc2: 190,255,220;
      --mh-pat: radial-gradient(circle, rgba(167,243,208,.16) 1.5px, transparent 2px) 0 0 / 9px 9px, radial-gradient(80% 50% at 50% 20%, rgba(52,211,153,.18), transparent 70%); }
    [data-ph-kind="guts"] { --mh-rc: 245,158,11; --mh-rc2: 255,240,160;
      --mh-pat: repeating-conic-gradient(from 0deg at 50% 30%, rgba(255,210,80,.06) 0 8deg, transparent 8deg 24deg), radial-gradient(60% 50% at 50% 30%, rgba(255,200,60,.2), transparent 70%); }
    [data-ph-kind="new"] { --mh-rc: 16,185,129; --mh-rc2: 190,255,220;
      --mh-pat: repeating-conic-gradient(from 0deg at 50% 34%, rgba(167,243,208,.05) 0 10deg, transparent 10deg 30deg); }
    [data-ph-kind="up"] { --mh-rc: 168,85,247; --mh-rc2: 233,213,255;
      --mh-pat: repeating-conic-gradient(from 0deg at 50% 34%, rgba(216,180,254,.07) 0 10deg, transparent 10deg 30deg), radial-gradient(70% 50% at 50% 30%, rgba(168,85,247,.22), transparent 70%); }
    [data-ph-kind="max"] { --mh-rc: 234,179,8; --mh-rc2: 255,243,196;
      --mh-pat: repeating-conic-gradient(from 0deg at 50% 34%, rgba(255,230,150,.08) 0 10deg, transparent 10deg 30deg), radial-gradient(70% 50% at 50% 30%, rgba(234,179,8,.22), transparent 70%); }
    [data-ph-kind="own"] { --mh-rc: 245,158,11; --mh-rc2: 255,240,160; }
    [data-ph-kind="inherit"] { --mh-rc: 6,182,212; --mh-rc2: 207,250,254; }
    [data-ph-kind="ally"] { --mh-rc: 129,140,248; --mh-rc2: 224,231,255; }
    [data-ph-kind="revive"] { --mh-rc: 16,185,129; --mh-rc2: 190,255,220; }
    /* 距離ごと(配置)。タクティクスの零=赤・近=黄・中=緑・遠=青 と模様をそのまま使う */
    [data-ph-range="0"] { --mh-rc: 239,68,68; --mh-rc2: 255,210,190;
      --mh-pat: radial-gradient(120% 60% at 50% 115%, rgba(255,120,40,.5), rgba(200,30,20,.22) 45%, transparent 70%), repeating-linear-gradient(115deg, rgba(255,90,40,.10) 0 3px, transparent 3px 14px); }
    [data-ph-range="1"] { --mh-rc: 245,158,11; --mh-rc2: 255,240,160;
      --mh-pat: repeating-conic-gradient(from 0deg at 20% 62%, rgba(255,210,80,.15) 0 6deg, transparent 6deg 18deg), radial-gradient(60% 60% at 20% 62%, rgba(255,200,60,.32), transparent 70%); }
    [data-ph-range="2"] { --mh-rc: 16,185,129; --mh-rc2: 190,255,220;
      --mh-pat: repeating-linear-gradient(98deg, rgba(52,211,153,.30) 0 1.5px, transparent 1.5px 6px) bottom / 100% 34% no-repeat, radial-gradient(70% 60% at 20% 62%, rgba(40,200,130,.26), transparent 70%); }
    [data-ph-range="3"] { --mh-rc: 59,130,246; --mh-rc2: 200,225,255;
      --mh-pat: repeating-radial-gradient(circle at 20% 140%, rgba(90,160,255,.17) 0 3px, transparent 3px 11px), radial-gradient(70% 60% at 20% 62%, rgba(80,150,255,.32), transparent 70%); }
    /* 宝石(×1 の数・残りポイントなど)。タクティクスの手札の消費ガッツと同じ形 */
    .mh-ph-gem { display: inline-flex; align-items: center; justify-content: center; padding-top: 2px; font-weight: 900; line-height: 1; color: #fff;
      text-shadow: 0 1px 2px rgba(0,0,0,.9); clip-path: polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%);
      background: radial-gradient(circle at 35% 30%, #fff 0 8%, rgba(var(--mh-rc2,200,225,255),1) 18%, rgba(var(--mh-rc,31,111,209),1) 55%, rgba(8,10,30,1) 100%); }
    /* 宝石のまたたきは、明るさ(filter)ではなく重ねた光の濃さ(opacity)で出す(バトルの宝石と同じ) */
    .mh-ph-gem { position: relative; }
    .mh-ph-gem::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0;
      background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.75), rgba(255,255,255,0) 60%); }
    [data-phase-look="rich"] .mh-ph-gem::after { animation: mhGemGlow 2.2s ease-in-out infinite; }
    /* 絵を収める金の額(アシストカードの顔・固有技の絵) */
    .mh-ph-medal { border: 2px solid #f3d27a !important; background: radial-gradient(circle at 50% 35%, rgba(255,255,255,.22), rgba(0,0,0,.4)) !important;
      box-shadow: 0 0 0 2px rgba(60,40,10,.9), 0 0 12px rgba(255,210,120,.5), inset 0 0 10px rgba(0,0,0,.5) !important; }
    /* 絵の後ろで回るルーンの輪 */
    .mh-ph-rune { position: absolute; left: 50%; top: 50%; width: 150%; height: 150%; margin: -75% 0 0 -75%; border-radius: 50%; pointer-events: none; z-index: 0;
      background: repeating-conic-gradient(rgba(243,210,122,.85) 0 3deg, transparent 3deg 15deg), radial-gradient(circle, rgba(var(--ph,243,210,122),.25), transparent 70%);
      -webkit-mask: radial-gradient(circle, transparent 58%, #000 59%, #000 63%, transparent 64%, transparent 70%, #000 71%, #000 72.5%, transparent 73.5%);
      mask: radial-gradient(circle, transparent 58%, #000 59%, #000 63%, transparent 64%, transparent 70%, #000 71%, #000 72.5%, transparent 73.5%);
      filter: drop-shadow(0 0 5px rgba(var(--ph,243,210,122),.9)); }
    [data-phase-look="rich"] .mh-ph-rune { animation: mhRuneSpin 16s linear infinite; }
    /* 足元の魔法陣(タクティクスの枠の足元と同じ) */
    .mh-ph-floor { position: absolute; left: 50%; bottom: -14px; width: 96px; height: 96px; margin-left: -48px; pointer-events: none; z-index: 0;
      transform: rotateX(68deg);
      background: radial-gradient(circle, transparent 52%, rgba(255,240,200,.95) 53%, rgba(255,240,200,.95) 55%, transparent 56%, transparent 66%, rgba(var(--ph,243,210,122),.9) 67%, rgba(var(--ph,243,210,122),.9) 70%, transparent 71%),
        repeating-conic-gradient(rgba(255,240,200,.8) 0 4deg, transparent 4deg 30deg);
      -webkit-mask: radial-gradient(circle, transparent 50%, #000 51%, #000 72%, transparent 73%); mask: radial-gradient(circle, transparent 50%, #000 51%, #000 72%, transparent 73%);
      filter: drop-shadow(0 0 5px rgba(var(--ph,243,210,122),1)); }
    [data-phase-look="rich"] .mh-ph-floor { animation: mhPhFloor 7s linear infinite; }
    @keyframes mhPhFloor { to { transform: rotateX(68deg) rotate(360deg); } }
    /* ボタン。金 = 決めるボタン(押せるとき)、夜 = そのほか。ボタンの意味の色は変えず、縁と照りを重ねる */
    .mh-ph-btn-gold { position: relative; overflow: hidden; color: #2a1a04 !important; text-shadow: 0 1px 0 rgba(255,255,255,.5);
      background: linear-gradient(180deg, #fff6d0 0%, #f4d57c 24%, #d8a640 62%, #9a6d22 100%) !important;
      box-shadow: 0 0 0 1px rgba(40,26,6,.9), 0 0 0 3px rgba(243,210,122,.3), 0 6px 18px rgba(0,0,0,.5), 0 0 22px rgba(255,210,120,.45),
        inset 0 2px 0 rgba(255,255,255,.75), inset 0 -2px 0 rgba(90,60,10,.55) !important; }
    .mh-ph-btn-gold::after { content: ''; position: absolute; top: -20%; bottom: -20%; left: 0; width: 30%; pointer-events: none;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent); transform: translateX(-160%) skewX(-18deg); }
    [data-phase-look="rich"] .mh-ph-btn-gold::after { animation: mhShine 3s ease-in-out infinite; }
    .mh-ph-btn { color: #e2e8f0 !important; border: 1px solid rgba(243,210,122,.45) !important;
      background: linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,0) 45%, rgba(0,0,0,.25)), linear-gradient(180deg, #1c2446, #0b0f22) !important;
      box-shadow: 0 0 0 1px rgba(20,12,4,.85), 0 4px 12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,240,200,.3) !important; }
    .mh-ph-btn:disabled { opacity: .45; }
    .mh-ph-btn-off { color: #64748b !important; border: 1px solid rgba(243,210,122,.18) !important;
      background: linear-gradient(180deg, #151a33, #0a0d1d) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.04) !important; }
    /* 強化フェーズの並び(PhaseSteps) */
    .mh-ph-step-now { color: #1a1204 !important; border: 1px solid rgba(255,240,200,.9);
      background: linear-gradient(180deg, #fff, rgb(var(--ph,243,210,122)) 55%, rgba(var(--ph,243,210,122),.75)) !important;
      box-shadow: 0 0 0 1px rgba(20,12,4,.8), 0 0 12px rgba(var(--ph,243,210,122),.7), inset 0 1px 0 rgba(255,255,255,.8) !important; }
    .mh-ph-step-todo { color: #8b93a8 !important; border: 1px solid rgba(243,210,122,.22) !important; background: linear-gradient(180deg, #151a33, #0a0d1d) !important; }
    .mh-ph-step-done { color: #ecfdf5 !important; border: 1px solid rgba(167,243,208,.9) !important; transform: rotate(45deg); border-radius: 3px !important;
      background: radial-gradient(circle at 35% 30%, #fff 0 10%, #6ee7b7 30%, #059669 70%, #064e3b 100%) !important; box-shadow: 0 0 8px rgba(52,211,153,.7); }
    .mh-ph-step-done > span { display: block; transform: rotate(-45deg); }
    .mh-ph-step-line { height: 1px; background: linear-gradient(90deg, rgba(243,210,122,.2), rgba(243,210,122,.7), rgba(243,210,122,.2)) !important; }
    /* 菱形の段(アシストカードのレベル) */
    .mh-ph-pip { display: block; width: 8px; height: 8px; transform: rotate(45deg); border-radius: 1.5px; border: 1px solid rgba(243,210,122,.35); background: #11152b; }
    .mh-ph-pip[data-on] { border-color: rgba(255,240,200,.9); background: radial-gradient(circle at 35% 30%, #fff 0 12%, rgba(var(--mh-rc2),1) 35%, rgba(var(--mh-rc),1) 80%); box-shadow: 0 0 6px rgba(var(--mh-rc),.8); }
    .mh-ph-pip[data-next] { border-color: #f3d27a; background: rgba(243,210,122,.35); box-shadow: 0 0 6px rgba(243,210,122,.7); }
    [data-phase-look="rich"] .mh-ph-pip[data-next] { animation: mhTwinkle 1.6s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .mh-ph-sparkle, .mh-ph-shine::before, .mh-ph-gem::after, .mh-ph-rune, .mh-ph-floor, .mh-ph-btn-gold::after, .mh-ph-pip[data-next] { animation: none !important; }
    }
    @keyframes specialShockwave {
      0% { transform: scale(0.4); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes specialDangerPulse {
      0%,100% { opacity: 0.25; }
      50% { opacity: 0.7; }
    }
    @keyframes specialWarnFlash {
      0%,100% { opacity: 0.55; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.06); }
    }
    @keyframes mhRipple {
      0% { transform: scale(0.3); opacity: 0.55; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    @keyframes moveDash {
      0% { transform: translateX(-40px) scale(0.7); opacity: 0; }
      40% { opacity: 1; }
      100% { transform: translateX(40px) scale(1.1); opacity: 0; }
    }
    /* 全画面演出(effect)の火花。明滅だけを受け持ち、置き場所は呼び出し側の transform に任せる。
       共通の sparkFlicker はキーフレーム側が transform を丸ごと持っているため、
       呼び出し側で書いた角度と半径が効かず、火花が全部1か所へ重なってしまう */
    @keyframes mhEffectSpark { 0%,100% { opacity: .15; } 50% { opacity: 1; } }
    @keyframes mhTranscendFxRays { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }
    @keyframes mhTranscendFxFlash { 0% { opacity: 0; } 10% { opacity: .75; } 34%,100% { opacity: 0; } }
    @keyframes mhTranscendFxThrob {
      0%,100% { transform: scale(1); filter: drop-shadow(0 0 16px rgba(253,230,138,.95)); }
      50% { transform: scale(1.22); filter: drop-shadow(0 0 30px rgba(244,114,182,1)) drop-shadow(0 0 46px rgba(56,189,248,.8)); }
    }
    @keyframes specialFlash {
      0%,100% { opacity: 0; }
      50% { opacity: 1; }
    }
    @keyframes mooFloat {
      0%,100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-12px) scale(1.03); }
    }
    @keyframes mooAttackLunge {
      0% { transform: translateY(0) scale(1); }
      18% { transform: translateY(-40px) scale(1.18) rotate(-3deg); }
      42% { transform: translateY(70px) scale(1.55) rotate(3deg); }
      58% { transform: translateY(45px) scale(1.42) rotate(-1deg); }
      78% { transform: translateY(20px) scale(1.2); }
      100% { transform: translateY(0) scale(1); }
    }
    @keyframes mooMoveSlide {
      0% { transform: translateX(0) scale(1); }
      25% { transform: translateX(-110px) scale(0.95) rotate(-2deg); }
      50% { transform: translateX(0) scale(0.92); }
      75% { transform: translateX(110px) scale(0.95) rotate(2deg); }
      100% { transform: translateX(0) scale(1); }
    }
    @keyframes screenShake {
      0%,100% { transform: translate(0,0); }
      10% { transform: translate(-6px,-4px); }
      20% { transform: translate(7px,3px); }
      30% { transform: translate(-8px,5px); }
      40% { transform: translate(6px,-6px); }
      50% { transform: translate(-5px,4px); }
      60% { transform: translate(7px,2px); }
      70% { transform: translate(-4px,-5px); }
      80% { transform: translate(5px,3px); }
      90% { transform: translate(-3px,2px); }
    }
    @keyframes mooQuake {
      0%,100% { transform: translate(0,0) scale(1); }
      8% { transform: translate(-16px,-10px) scale(1.015); }
      18% { transform: translate(18px,9px) scale(1.02); }
      28% { transform: translate(-20px,13px) scale(1.025); }
      38% { transform: translate(16px,-15px) scale(1.02); }
      48% { transform: translate(-14px,11px) scale(1.015); }
      58% { transform: translate(17px,7px) scale(1.01); }
      68% { transform: translate(-11px,-12px) scale(1.008); }
      80% { transform: translate(9px,6px) scale(1.004); }
      90% { transform: translate(-6px,4px) scale(1.002); }
    }
    @keyframes fusionSlideInLeft {
      0% { transform: translateX(-160%) scale(0.8); opacity: 0; }
      55% { transform: translateX(6%) scale(1.06); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes fusionSlideInRight {
      0% { transform: translateX(160%) scale(0.8); opacity: 0; }
      55% { transform: translateX(-6%) scale(1.06); opacity: 1; }
      100% { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes fusionMergeShake {
      0%,100% { transform: translate(0,0) scale(1); }
      20% { transform: translate(-7px,4px) scale(1.03); }
      40% { transform: translate(7px,-4px) scale(1.06); }
      60% { transform: translate(-5px,3px) scale(1.04); }
      80% { transform: translate(4px,-3px) scale(1.02); }
    }
    @keyframes fusionFlashBurst {
      0% { transform: scale(0); opacity: 0; }
      35% { transform: scale(1.5); opacity: 1; }
      100% { transform: scale(3.2); opacity: 0; }
    }
    @keyframes fusionFlashFade {
      0%,55% { background-color: rgba(255,255,255,0); }
      70% { background-color: rgba(255,255,255,0.9); }
      100% { background-color: rgba(255,255,255,0); }
    }
    .mh-scroll::-webkit-scrollbar { width: 6px; }
    /* モンスターノーツの染色画像は、共通画像コンポーネントがdivを返す場合も
       アイコン枠に見える矩形を一切持たせない。画像端の1pxだけを透明余白内で隠し、
       iOSで合成レイヤーの境界線が出てもモンスター本体と黄色ノーツだけが見えるようにする。 */
    [data-rhythm-monster-face],[data-rhythm-monster-face]>*{border:0!important;outline:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
    [data-rhythm-monster-face]>*{clip-path:inset(1px);-webkit-clip-path:inset(1px)}
    .mh-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 9999px; }
    .mh-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 9999px; }
    .mh-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) rgba(255,255,255,0.05); }
    .mh-game-over-screen{padding:calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom))}.mh-game-over-head{width:100%}.mh-game-over-actions{padding-bottom:0}
    @media(max-height:620px){.mh-game-over-screen{padding-top:calc(14px + env(safe-area-inset-top));padding-bottom:calc(12px + env(safe-area-inset-bottom))}.mh-game-over-head>svg{width:38px;height:38px;margin-bottom:6px}.mh-game-over-head h2{font-size:20px}.mh-game-over-head>div{padding:10px;margin-top:7px;margin-bottom:7px}.mh-game-over-actions{gap:7px;margin-top:5px}.mh-game-over-actions button:first-child{padding-top:10px;padding-bottom:10px}.mh-game-over-actions button:last-child{padding-top:8px;padding-bottom:8px}}
    .mh-regeneration-animation{position:fixed;inset:0;z-index:52000;display:flex;align-items:center;justify-content:center;padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));background:radial-gradient(circle,#4c1d95,#020617 65%)}.mh-regeneration-disc{position:absolute;width:170px;height:170px;object-fit:contain;animation:mhRegenerationDisc 1.5s ease-in forwards}.mh-regeneration-born{position:relative;width:min(330px,100%);padding:20px;border:2px solid #fbbf24;border-radius:24px;background:#0f172a;text-align:center;opacity:0;animation:mhRegenerationBorn .6s 1.4s ease-out forwards}.mh-regeneration-born h3{font-size:20px;font-weight:1000;color:#fde68a}.mh-regeneration-born b{float:right;color:#f9a8d4}@keyframes mhRegenerationDisc{0%{transform:rotate(0) scale(.7);opacity:1}85%{transform:rotate(1080deg) scale(1.15);opacity:1}100%{transform:rotate(1260deg) scale(.1);opacity:0}}@keyframes mhRegenerationBorn{to{opacity:1;transform:none}}
    .mh-home-scene{position:relative;isolation:isolate;flex:1;min-height:0;overflow:hidden;background:#263f35;color:#fff}.mh-home-background{position:absolute;z-index:-2;inset:0;display:block;opacity:0;transition:opacity .45s ease;background:#263f35;pointer-events:none}.mh-home-background.is-ready{opacity:1}.mh-home-background img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 50%}.mh-home-masumon-layer{position:absolute;z-index:0;left:18%;right:18%;top:34%;bottom:29%;pointer-events:none}.mh-home-masumon{position:absolute;width:clamp(48px,14vw,72px);aspect-ratio:1;transform:translate(-50%,-72%);transition-property:left,top;transition-timing-function:linear;will-change:left,top}.mh-home-masumon-bob{position:relative;width:100%;height:100%;transform-origin:center bottom}.mh-home-masumon-bob>div:first-child,.mh-home-masumon-bob>img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 4px #0008)}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:mhHomeMasumonWalk .42s ease-in-out infinite}.mh-home-masumon-stars{position:absolute;left:0;right:0;bottom:1px;color:#fde68a;text-shadow:0 1px 3px #000}.mh-home-status{position:relative;z-index:5;display:flex;gap:7px;justify-content:space-between;padding:calc(8px + env(safe-area-inset-top)) 9px 0;pointer-events:none}.mh-home-player,.mh-home-wallet{border:1px solid #f7df9a88;background:#102522e8;box-shadow:0 4px 14px #071613cc,inset 0 1px #fff3;backdrop-filter:blur(3px);pointer-events:auto}.mh-home-player{display:flex;align-items:center;gap:6px;min-width:0;flex:1;padding:5px;border-radius:14px;text-align:left;color:#fff;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-player:active{transform:scale(.97);filter:brightness(1.2);box-shadow:0 0 18px #f5d879aa}.mh-home-profile-arrow{flex:0 0 auto;color:#f8dc8d}.mh-home-avatar{flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:visible;color:#ffe18c;background:#142728;border:2px solid #eaca72}.mh-home-avatar.is-framed{border-color:transparent}.mh-home-avatar>span{width:100%;height:100%}.mh-home-player-copy{min-width:0;flex:1}.mh-home-player-copy strong{display:block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.mh-home-player-copy span{display:block;color:#f8dc8d;font-size:7px;font-weight:900}.mh-home-player-copy small{display:block;text-align:right;color:#d7e3dc;font:6px monospace}.mh-home-xp{height:4px;margin-top:2px;overflow:hidden;border-radius:9px;background:#071b1c}.mh-home-xp i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5dd79c,#f5e16d)}.mh-home-wallet{display:grid;grid-template-columns:auto 43px;grid-template-rows:1fr 1fr;width:139px;padding:4px;border-radius:14px}.mh-home-wallet>div{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:2px;padding:1px 3px;color:#ffe08a}.mh-home-wallet>div b{font-size:8px;text-align:right}.mh-home-wallet>div small{font-size:6px;color:#f4e7c3}.mh-home-wallet>button{grid-column:2;grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #fff2;color:#fce6ab;font-size:7px;font-weight:900;min-width:42px}.mh-home-facilities{position:absolute;z-index:3;inset:0;pointer-events:none}.mh-home-facility{position:absolute;pointer-events:auto;border:0;background:transparent;color:#fff;touch-action:manipulation}.mh-home-facility>span{position:absolute;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 13px;border:2px solid #ffe6a7a8;border-radius:14px;background:#10211df2;box-shadow:0 3px 12px #0009,inset 0 0 12px #ffe09822;text-shadow:0 2px 4px #000;font-size:11px;font-weight:1000;white-space:nowrap;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-facility:active>span{transform:scale(.92);filter:brightness(1.4);box-shadow:0 0 22px #ffe7a8}.mh-home-facility.management{left:0;top:14%;width:42%;height:34%}.mh-home-facility.management>span{left:6%;top:37%;border-color:#67e8f9dd;background:linear-gradient(135deg,#082f49f2,#123b3cf2);box-shadow:0 3px 12px #0009,0 0 15px #22d3ee66,inset 0 0 12px #38bdf833}.mh-home-facility.temple{right:0;top:14%;width:42%;height:34%}.mh-home-facility.temple>span{right:7%;top:35%;border-color:#d8b4fedd;background:linear-gradient(135deg,#2e1065f2,#44301cf2);box-shadow:0 3px 12px #0009,0 0 15px #c084fc66,inset 0 0 12px #fbbf2433}.mh-home-facility.market{right:0;top:45%;width:39%;height:30%}.mh-home-facility.market>span{right:5%;top:40%;border-color:#86efacdd;background:linear-gradient(135deg,#052e24f2,#3b3518f2);box-shadow:0 3px 12px #0009,0 0 15px #4ade8066,inset 0 0 12px #facc1533}.mh-home-facility.battle{left:16%;right:16%;bottom:0;height:31%}.mh-home-facility.battle>span{left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);min-width:156px;padding:10px 17px;border:2px solid #ffe3a8;border-radius:18px;background:linear-gradient(135deg,#4c1d95e8,#8b301ae8);box-shadow:0 0 23px #c084fcbb,inset 0 0 20px #ffcb6255;font-size:20px;letter-spacing:.08em;animation:mhHomeBattlePulse 2.3s ease-in-out infinite}.mh-home-facility.battle>span small{font-size:7px;letter-spacing:0;color:#ffe4b2}.mh-home-facility.battle:active>span{transform:translateX(-50%) scale(.94)}.mh-home-gift{position:absolute;z-index:5;right:5%;top:73%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #67e8f9aa;border-radius:13px;background:#083344e8;color:#cffafe;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-gift em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-gift:active{transform:scale(.94);filter:brightness(1.25)}.mh-home-update{position:absolute;z-index:5;right:9px;top:calc(69px + env(safe-area-inset-top));display:flex;align-items:center;gap:4px;min-height:32px;padding:6px 11px;border:1px solid #eed995aa;border-radius:13px;background:#102c29e8;color:#f9eac2;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-update:active{transform:scale(.94);filter:brightness(1.25)}.mh-management-link{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:64px;padding:16px;border:1px solid #818cf877;border-radius:16px;background:#172554aa;color:#fff;font-weight:900;box-shadow:0 5px 16px #0005}.mh-management-link:active{transform:scale(.98);filter:brightness(1.2)}.mh-temple-link{border-color:#a78bfa99;background:#2e1065aa}.mh-temple-menu-card{position:relative;border:1px solid #a78bfa80;background:linear-gradient(135deg,#2e1065d9 0%,#1e1b4bcc 58%,#312e81b3 100%);box-shadow:inset 0 1px 0 #ddd6fe18,0 5px 16px #0006,0 0 18px #7c3aed12}.mh-temple-menu-card:active{filter:brightness(1.16);transform:scale(.98)}.mh-temple-menu-icon{display:flex;width:30px;height:30px;align-items:center;justify-content:center;border:1px solid #c4b5fd38;border-radius:10px;background:#4c1d9566;box-shadow:inset 0 1px 0 #ede9fe18}.mh-rebirth-stars{display:flex;justify-content:center;align-items:center;gap:0;font-size:8px;line-height:1;font-weight:1000;pointer-events:none}.mh-rainbow-breakthrough-star{display:block;width:1em;height:1em;object-fit:contain;transform:scale(1.07) translateY(-.06em)}.mh-rebirth-stars-overlay{position:absolute;left:0;right:0;bottom:1px}/* 転生した回数を示す「+N」バッジ。もとは合体の回数に使っていた見た目をそのまま移した */
    /* ==================== プロフィールフレーム(2026-09-15) ====================
       ブリーダーアイコンの外側へ重ねる飾り枠。アイコン画像そのものには触らない。
       ★太さを px で書かない。inset と mask を割合で書いてあるので、ランキングの 32px でも
         プロフィールの 80px でも同じ見え方になる(小さいアイコンでもズレない)。
       ★2026-09-15にユーザー指摘「太すぎてかっこ悪い」。輪の太さをアイコン幅の 13.7% から
         7.5% へ細くし、アイコンへかぶさる量もほとんど無くした(内側 86.5% でくり抜く)。
         32px で約2.4px・80px で約6px。細くしたぶん、輪郭の影を少し濃くして小さくても見えるようにした。
       ★枠は円の外へはみ出すので、外側の .mh-profile-avatar は overflow:visible のままにする。
       ★pointer-events:none。枠がボタンのタップを食べない。 */
    .mh-profile-avatar{position:relative;display:flex;align-items:center;justify-content:center;overflow:visible}
    .mh-profile-frame{position:absolute;inset:-5.5%;z-index:1;border-radius:50%;pointer-events:none}
    /* 輪の内側をくり抜く。内側 76% は透明、そこから外が枠。割合なので大きさに比例する */
    .mh-profile-frame-ring{-webkit-mask:radial-gradient(closest-side,#0000 0 86.5%,#000 87%);mask:radial-gradient(closest-side,#0000 0 86.5%,#000 87%);filter:drop-shadow(0 0 1px #000c)}
    .mh-profile-frame-silver{background:conic-gradient(from 210deg,#f8fafc,#94a3b8,#e2e8f0,#64748b,#f1f5f9,#94a3b8,#f8fafc)}
    .mh-profile-frame-gold{background:conic-gradient(from 210deg,#fef3c7,#b45309,#fde68a,#92400e,#fffbeb,#d97706,#fef3c7)}
    .mh-profile-frame-white{background:conic-gradient(from 210deg,#ffffff,#cbd5e1,#f8fafc,#94a3b8,#ffffff,#cbd5e1,#ffffff)}
    .mh-profile-frame-black{background:conic-gradient(from 210deg,#64748b,#0f172a,#475569,#020617,#94a3b8,#1e293b,#64748b)}
    .mh-profile-frame-red{background:conic-gradient(from 210deg,#fee2e2,#991b1b,#fca5a5,#7f1d1d,#fff1f2,#dc2626,#fee2e2)}
    .mh-profile-frame-orange{background:conic-gradient(from 210deg,#ffedd5,#c2410c,#fdba74,#9a3412,#fff7ed,#ea580c,#ffedd5)}
    .mh-profile-frame-green{background:conic-gradient(from 210deg,#dcfce7,#15803d,#86efac,#14532d,#f0fdf4,#16a34a,#dcfce7)}
    .mh-profile-frame-aqua{background:conic-gradient(from 210deg,#cffafe,#0e7490,#67e8f9,#155e75,#ecfeff,#06b6d4,#cffafe)}
    .mh-profile-frame-blue{background:conic-gradient(from 210deg,#e0f2fe,#0369a1,#7dd3fc,#075985,#f0f9ff,#0284c7,#e0f2fe)}
    .mh-profile-frame-purple{background:conic-gradient(from 210deg,#f3e8ff,#6b21a8,#d8b4fe,#581c87,#faf5ff,#9333ea,#f3e8ff)}
    .mh-profile-frame-pink{background:conic-gradient(from 210deg,#fce7f3,#be185d,#f9a8d4,#9d174d,#fff1f2,#db2777,#fce7f3)}
    .mh-profile-frame-rainbow{background:conic-gradient(from 210deg,#ef4444,#f59e0b,#fde047,#22c55e,#06b6d4,#3b82f6,#a855f7,#ec4899,#ef4444)}
    /* 画像フレーム(豪華フレーム用)。透過PNGを縦横比そのままで重ねる。
       大きさと位置は絵ごとに profileFrameImageStyle が出す(穴の大きさが絵ごとに違うため)。
       ここでは object-fit だけを決める(width/height を auto のままにすると広がらない) */
    .mh-profile-frame-image{display:block;object-fit:contain}
    /* 転生オーラ画像。同じPNGの主炎・残光・足元炎を別周期で動かし、本体とUIには発光を掛けない。 */
    .mh-reincarnate-stack{isolation:isolate}.mh-reincarnate-aura{position:absolute;z-index:-1;inset:-34%;display:block;pointer-events:none;overflow:visible;contain:layout style}.mh-monster-card-name{position:relative;z-index:2}
    .mh-reincarnate-flame{position:absolute;inset:0;display:block;transform-origin:center bottom;will-change:transform,opacity}
    .mh-reincarnate-flame>img{display:block;width:100%;height:100%;object-fit:contain;transform-origin:center bottom;filter:drop-shadow(0 0 5px #60a5faaa)}
    .mh-reincarnate-flame.is-main{animation:mhReincarnateMain 2.55s ease-in-out infinite}.mh-reincarnate-flame.is-back{opacity:.32;animation:mhReincarnateBack 3.4s ease-in-out -1.1s infinite}.mh-reincarnate-flame.is-foot{inset:24% -5% -5%;opacity:.46;clip-path:inset(48% 5% 0);animation:mhReincarnateFoot 1.85s ease-in-out -.6s infinite}
    .mh-reincarnate-aura.is-blue img{transform:translateY(-2%) scale(1.22)}.mh-reincarnate-aura.is-yellow img{transform:translateY(-2%) scale(1.22);filter:brightness(1.03) drop-shadow(0 0 5px #fde047aa)}.mh-reincarnate-aura.is-red img{transform:translateY(1%) scale(.96);filter:brightness(1.06) drop-shadow(0 0 5px #f87171aa)}.mh-reincarnate-aura.is-green img{transform:translateY(-1%) scale(1.12);filter:brightness(1.04) drop-shadow(0 0 5px #4ade80aa)}.mh-reincarnate-aura.is-rainbow img{transform:translateY(-1%) scale(1.08);filter:brightness(1.08) drop-shadow(0 0 6px #f472b6aa)}
    .mh-reincarnate-sparks,.mh-reincarnate-sparks::before,.mh-reincarnate-sparks::after{position:absolute;width:3px;height:9px;border-radius:60% 60% 45% 45%;background:currentColor;box-shadow:0 0 5px currentColor;opacity:0}.mh-reincarnate-sparks{left:24%;bottom:21%;color:#bfdbfe;animation:mhReincarnateSpark 2.7s ease-out -.4s infinite}.mh-reincarnate-sparks::before,.mh-reincarnate-sparks::after{content:"";display:block}.mh-reincarnate-sparks::before{left:300%;top:180%;animation:mhReincarnateSpark 3.1s ease-out -1.7s infinite}.mh-reincarnate-sparks::after{left:1450%;top:320%;animation:mhReincarnateSpark 2.9s ease-out -2.2s infinite}.mh-reincarnate-aura.is-yellow .mh-reincarnate-sparks{color:#fde68a}.mh-reincarnate-aura.is-red .mh-reincarnate-sparks{color:#fca5a5}.mh-reincarnate-aura.is-green .mh-reincarnate-sparks{color:#86efac}.mh-reincarnate-aura.is-rainbow .mh-reincarnate-sparks{color:#f9a8d4}
    @keyframes mhReincarnateMain{0%,100%{opacity:.76;transform:translateY(1%) scale(.98);filter:brightness(.96)}24%{opacity:.91;transform:translateY(-2%) scale(1.025);filter:brightness(1.08)}53%{opacity:.81;transform:translateY(0) scale(1.005);filter:brightness(1)}76%{opacity:.94;transform:translateY(-3.5%) scale(1.045);filter:brightness(1.12)}}
    @keyframes mhReincarnateBack{0%,100%{transform:translateY(-1%) scale(1.04);filter:brightness(.9) blur(.25px)}38%{opacity:.5;transform:translateY(-4%) scale(1.09);filter:brightness(1.16) blur(.55px)}68%{opacity:.26;transform:translateY(1%) scale(1.02);filter:brightness(.96) blur(.2px)}}
    @keyframes mhReincarnateFoot{0%,100%{opacity:.38;transform:translateY(2%) scale(.96);filter:brightness(1.05)}45%{opacity:.7;transform:translateY(-5%) scale(1.08);filter:brightness(1.3)}72%{opacity:.47;transform:translateY(-1%) scale(1.01);filter:brightness(1.12)}}
    @keyframes mhReincarnateSpark{0%,30%{opacity:0;transform:translate(0,0) scale(.5)}42%{opacity:.8}78%,100%{opacity:0;transform:translate(8px,-28px) scale(.15)}}
    .mh-reincarnate-badge{position:absolute;left:50%;bottom:-11px;transform:translateX(-50%);min-width:max-content;border:1px solid #bae6fd;border-radius:9999px;padding:2px 6px;background:linear-gradient(90deg,#5b21b6,#1d4ed8);color:#fff;font-size:7px;font-weight:1000;line-height:1;white-space:nowrap;z-index:6;box-shadow:0 1px 5px #020617,0 0 6px #818cf8}.mh-reincarnate-badge.is-small{bottom:-8px;padding:1px 4px;font-size:6px}
    /* 一覧カード用。絵のすぐ下は名前の行なので、そこへ重ねると名前が読めなくなる
       (2026-09-07・ユーザー指摘「3枚目 名前表示がおかしい」)。
       行の中にふつうに並べる形にして、重なりそのものを起こさない */
    .mh-reincarnate-badge.is-inline{position:static;transform:none;left:auto;bottom:auto;padding:1px 5px;font-size:7px}.mh-reincarnate-aura.is-home{inset:-25%}.mh-reincarnate-aura.is-home .mh-reincarnate-flame.is-back{opacity:.24}.mh-reincarnate-aura.is-home .mh-reincarnate-sparks{transform:scale(.7)}
    /* 超越マーク。虹★(画像の下)・転生バッジ(画像の下)と重ならないよう画像の上側へ置く。
       画像は使わず、虹と金のグラデーションと「超」の1文字だけで最終育成らしさを出す。
       親の overflow:hidden で切れないよう、置く側は overflow-visible にしておくこと。 */
    .mh-transcend-badge{position:absolute;right:-7px;top:-7px;z-index:7;display:flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;border:1.5px solid #fff7d6;background:conic-gradient(from 210deg,#fde68a,#f472b6,#60a5fa,#34d399,#fde68a);box-shadow:0 0 7px #fde68acc,0 0 14px #f472b666,0 1px 4px #020617;pointer-events:none}
    .mh-transcend-badge>b{display:block;color:#3b1d05;font-size:10px;font-weight:1000;line-height:1;text-shadow:0 1px 0 #fff9}
    .mh-transcend-badge.is-small{width:15px;height:15px;right:-8px;top:-8px;border-width:1px}.mh-transcend-badge.is-small>b{font-size:8px}
    /* 魂格バッジ。超越マークと同じ位置・サイズを再利用し、魂格Ⅰ以上では「超」を置換する。
       魂格Ⅴも常時アニメーションは付けず、静的な虹グラデーションだけにする。
       2026-09-13・ユーザー指摘「魂格のマークがしょぼい / 超越より上なのに表示ださい」。
       単色のべた塗りに白い細枠だけで、お知らせの点のように見えていた。しかも超越マークは
       虹グラデーションなので、格下のはずの超越のほうが上等に見えていた。
       色を変えるだけでは超越の虹に勝てないので、形そのものを変えている。
         ・王冠(::before)を載せる。段位に関係なく「格上」が形で分かる
         ・宝石の質感(上からの映り込み・下の陰)と、段位ごとの色つきの光
         ・「魂」の字(::after)と段位の数字を横に並べ、称号として読ませる
       ★大きさと位置(19/15px・right/top)は変えていない。広げるとモンスターの絵に重なる
         (68pxの枠では隙間が1pxしかない)。王冠は上へ伸ばすので絵から離れる向き。
         tools/masu/transcend-badge-position-check.js が魂格バッジと王冠も測って見張る。
       ★常時アニメーションは付けない(一覧に何個も並ぶため)。soul-rank-step6a-check が見張る。 */
    .mh-soul-rank-badge{position:absolute;right:-7px;top:-7px;z-index:7;display:flex;align-items:center;justify-content:center;gap:.5px;width:19px;height:19px;border-radius:50%;border:1.5px solid #ffe9a8;pointer-events:none}
    .mh-soul-rank-badge::before{content:'';position:absolute;left:50%;top:-7px;width:17px;height:9px;transform:translateX(-50%);background:linear-gradient(180deg,#fff6d5,#f5b429 58%,#a86a12);clip-path:polygon(0 100%,0 20%,21% 62%,50% 0,79% 62%,100% 20%,100% 100%);filter:drop-shadow(0 1px 1px #000a)}
    .mh-soul-rank-badge::after{content:'魂';order:0;font-size:8.5px;font-weight:900;line-height:1;color:#fff;text-shadow:0 1px 1px #000e,0 0 2px #000c}
    .mh-soul-rank-badge>b{display:block;order:1;align-self:flex-end;margin-bottom:2px;color:#fff;font-size:6.5px;font-weight:1000;line-height:1;text-shadow:0 1px 1px #000d,0 0 2px #000b}
    .mh-soul-rank-badge.is-small{width:15px;height:15px;right:-8px;top:-8px;border-width:1px;gap:0}
    .mh-soul-rank-badge.is-small::before{top:-5.5px;width:13px;height:7px}
    .mh-soul-rank-badge.is-small::after{font-size:7px}
    .mh-soul-rank-badge.is-small>b{font-size:5px;margin-bottom:1.5px}
    .mh-soul-rank-badge.is-stage-1{background:radial-gradient(circle at 33% 25%,#ffffffdd,#ffffff33 20%,transparent 46%),linear-gradient(150deg,#7dd3fc,#1d4ed8 58%,#0a2260);box-shadow:inset 0 1px 1px #ffffffb3,inset 0 -2px 3px #00000066,0 0 8px #60a5facc,0 0 15px #3b82f677,0 1px 4px #020617}
    .mh-soul-rank-badge.is-stage-2{background:radial-gradient(circle at 33% 25%,#ffffffee,#ffffff3d 20%,transparent 46%),linear-gradient(150deg,#fef08a,#ca8a04 58%,#7c4a02);box-shadow:inset 0 1px 1px #ffffffcc,inset 0 -2px 3px #00000066,0 0 8px #fde047cc,0 0 15px #eab30877,0 1px 4px #020617}
    .mh-soul-rank-badge.is-stage-2::after{color:#2b1c00;text-shadow:0 1px 0 #ffffffb3,0 0 3px #ffffff80}
    .mh-soul-rank-badge.is-stage-2>b{color:#2b1c00;text-shadow:0 1px 0 #ffffffb3}
    .mh-soul-rank-badge.is-stage-3{background:radial-gradient(circle at 33% 25%,#ffffffdd,#ffffff33 20%,transparent 46%),linear-gradient(150deg,#86efac,#15803d 58%,#052e16);box-shadow:inset 0 1px 1px #ffffffb3,inset 0 -2px 3px #00000066,0 0 8px #4ade80cc,0 0 16px #fbbf2488,0 1px 4px #020617}
    .mh-soul-rank-badge.is-stage-4{background:radial-gradient(circle at 33% 25%,#ffffffdd,#ffffff33 20%,transparent 46%),linear-gradient(150deg,#fda4af,#b91c1c 58%,#4c0519);box-shadow:inset 0 1px 1px #ffffffb3,inset 0 -2px 3px #00000066,0 0 9px #fb7185cc,0 0 17px #fcd34d99,0 1px 4px #020617}
    .mh-soul-rank-badge.is-stage-5{border-color:#fff;background:radial-gradient(circle at 34% 24%,#ffffffa6,#ffffff1a 15%,transparent 36%),conic-gradient(from 205deg,#ff5f6d,#ffc857,#5ef38c,#3ddcf7,#8b7bff,#ff6fd8,#ff5f6d);box-shadow:inset 0 1px 2px #ffffffcc,inset 0 -2px 3px #00000059,0 0 0 1.2px #7c3aed,0 0 11px #ff6fd8dd,0 0 20px #3ddcf7bb,0 1px 4px #020617}
    .mh-soul-rank-badge.is-stage-5::before{background:linear-gradient(180deg,#ffffff,#ffd7f5 34%,#8b7bff 68%,#3b2a8a);filter:drop-shadow(0 1px 2px #000a) drop-shadow(0 0 3px #ff6fd8)}
    /* 超越の演出。3〜5秒で一度だけ流す。終わったら要素ごと消えるので常時アニメは残らない */
    .mh-transcend-animation{position:fixed;inset:0;z-index:51500;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 46%,#3b0764 0,#0b0518 42%,#020617 76%);pointer-events:auto;touch-action:none;padding:calc(env(safe-area-inset-top) + 12px) 12px calc(env(safe-area-inset-bottom) + 12px)}
    .mh-transcend-converge{position:absolute;inset:0;z-index:1;pointer-events:none}
    .mh-transcend-converge i{position:absolute;left:50%;top:48%;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#fffbe8,#fde68a 45%,#f472b6);box-shadow:0 0 12px #fde68a;opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-58vmin);animation:mhTranscendConverge 1.5s cubic-bezier(.4,0,.2,1) forwards}
    .mh-transcend-halo{position:absolute;z-index:2;width:210px;height:210px;border-radius:50%;border:3px solid #fde68a;box-shadow:0 0 26px #fde68aaa,inset 0 0 26px #f472b688;opacity:0;animation:mhTranscendHalo 2.2s ease-out forwards}
    .mh-transcend-halo.is-second{width:290px;height:290px;border-color:#a5b4fc;animation-delay:.22s;box-shadow:0 0 26px #a5b4fcaa,inset 0 0 26px #60a5fa66}
    .mh-transcend-rays{position:absolute;z-index:1;width:150vmax;height:150vmax;opacity:0;background:conic-gradient(from 0deg,#fde68a33 0 6deg,transparent 6deg 24deg);animation:mhTranscendRays 2.6s ease-out forwards}
    .mh-transcend-mon{position:relative;z-index:3;width:150px;height:150px;animation:mhTranscendMon 3s ease-out forwards}
    .mh-transcend-flash{position:absolute;inset:0;z-index:5;background:#fff;opacity:0;pointer-events:none;animation:mhTranscendFlash 3s ease-out forwards}
    .mh-transcend-shock{position:absolute;z-index:4;width:40px;height:40px;border-radius:50%;border:4px solid #fffbe8;opacity:0;pointer-events:none;animation:mhTranscendShock 3s ease-out forwards}
    .mh-transcend-title{position:absolute;z-index:6;font-size:clamp(38px,15vw,66px);font-weight:1000;letter-spacing:.12em;color:#fffbe8;opacity:0;text-shadow:0 0 18px #fde68a,0 0 42px #f472b6;animation:mhTranscendTitle 3.4s ease-out forwards}
    .mh-transcend-mark{position:absolute;z-index:6;top:calc(env(safe-area-inset-top) + 16%);opacity:0;transform:scale(.4);animation:mhTranscendMark 3.6s ease-out forwards}
    .mh-transcend-mark .mh-transcend-badge{position:relative;right:auto;left:auto;top:auto;transform:none;width:52px;height:52px;border-width:3px}
    .mh-transcend-mark .mh-transcend-badge>b{font-size:26px}
    .mh-transcend-copy{position:absolute;z-index:6;bottom:calc(9% + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:1px;padding:0 14px;text-align:center;color:#fde68a;font-size:11px;font-weight:900;opacity:0;animation:mhTranscendCopy 4.2s ease-out forwards}
    .mh-transcend-copy b{font-size:23px;color:#fff;text-shadow:0 0 14px #fde68a}
    @keyframes mhTranscendConverge{0%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-58vmin) scale(.6)}25%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-6vmin) scale(1.5)}}
    @keyframes mhTranscendHalo{0%{opacity:0;transform:scale(.35)}40%{opacity:.95;transform:scale(1)}100%{opacity:0;transform:scale(1.45)}}
    @keyframes mhTranscendRays{0%{opacity:0;transform:rotate(0)}45%{opacity:.55}100%{opacity:0;transform:rotate(42deg)}}
    @keyframes mhTranscendMon{0%{transform:scale(.94);filter:brightness(1)}42%{transform:scale(1.06);filter:brightness(1.9)}52%{filter:brightness(4.5)}62%{filter:brightness(1.2)}100%{transform:scale(1);filter:brightness(1)}}
    @keyframes mhTranscendFlash{0%,46%{opacity:0}52%{opacity:1}70%,100%{opacity:0}}
    @keyframes mhTranscendShock{0%,50%{opacity:0;transform:scale(.2)}56%{opacity:.95}100%{opacity:0;transform:scale(26)}}
    @keyframes mhTranscendTitle{0%,55%{opacity:0;transform:scale(1.7)}66%{opacity:1;transform:scale(1)}84%{opacity:1}100%{opacity:0;transform:scale(.94)}}
    @keyframes mhTranscendMark{0%,68%{opacity:0;transform:scale(.4)}80%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(1)}}
    @keyframes mhTranscendCopy{0%,72%{opacity:0;transform:translateY(14px)}86%,100%{opacity:1;transform:none}}
    @media(max-height:620px){.mh-transcend-copy{bottom:calc(5% + env(safe-area-inset-bottom))}.mh-transcend-mon{width:120px;height:120px}}
    @media(prefers-reduced-motion:reduce){.mh-transcend-animation *{animation-duration:.01ms!important;animation-iteration-count:1!important}.mh-transcend-copy,.mh-transcend-mark,.mh-transcend-title{opacity:1;transform:none}.mh-transcend-flash,.mh-transcend-shock,.mh-transcend-rays,.mh-transcend-converge{display:none}}
    .mh-rebirth-stars-overlay,.mh-home-masumon-stars{z-index:4}.mh-home-masumon-bob>div:first-child,.mh-reincarnation-mon>div:first-child{position:relative;z-index:1}

    /* 転生の演出。「一度ほどけて、生まれ直す」を4秒で見せる。
       魂格オーラ(SoulRankAura)は魂格を持つ個体にしか出ないため、以前はオーラの無い個体だと
       全面光と文字だけになり、限界突破・超越の演出と比べて明らかに地味だった
       (2026-09-11・ユーザー指摘「転生のオーラをなくしたから転生したときの演出が地味になった」)。
       そこで、オーラの有無に関係なく必ず出る層をCSSだけで足してある(画像は増やさない)。
         ① 魂がほどける  … 本体から光の粒が上へ昇る
         ② 収束          … 外から中央へ光が集まり、繭の輪が閉じる
         ③ 閃光          … 白フラッシュ。本体がいったん白へ飛ぶ
         ④ 生まれ直し    … 衝撃波の輪2枚・回転する放射光・本体が弾んで戻る
         ⑤ 名乗り        … 「転　生」の大文字 →「転生 ×N」のバッジ → 結果のコピー
       色は 藍→紫→シアン。金/桃の超越、琥珀の限界突破と取り違えないため。 */
    .mh-reincarnation-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,#172554 0,#0f172a 34%,#020617 70%);pointer-events:auto;touch-action:none}
    /* 全面光。既存の穏やかな広がり(本体より背面)はそのまま残す */
    .mh-reincarnation-light{position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 48%,#fff 0,#fff8 24%,transparent 62%);opacity:0;pointer-events:none;animation:mhReincarnationLight 4s ease-out forwards}
    /* ④ 回転する放射光。生まれ直した瞬間に開いて、ゆっくり閉じる */
    /* 中心は transform では決めない(回転と拭き合うため)。left/top と負のマージンで据える */
    .mh-reincarnation-rays{position:absolute;z-index:0;left:50%;top:48%;width:180vmax;height:180vmax;margin:-90vmax 0 0 -90vmax;opacity:0;pointer-events:none;background:repeating-conic-gradient(from 0deg,#a5b4fc55 0 4deg,transparent 4deg 16deg);animation:mhReincarnationRays 4s ease-out forwards}
    .mh-reincarnation-mon{position:relative;z-index:1;width:140px;height:140px;animation:mhReincarnationMon 4s cubic-bezier(.2,.8,.3,1) forwards}
    /* ① ほどけた魂。本体の足元から8粒が上へ昇り続ける */
    /* 本体より縦に長い枠にして、足元から出た光が頭の上まで抜けていくようにする */
    .mh-reincarnation-souls{position:absolute;z-index:2;width:190px;height:300px;pointer-events:none}
    .mh-reincarnation-souls i{position:absolute;left:50%;bottom:8%;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:radial-gradient(circle,#fff,#bae6fd 42%,#818cf8);box-shadow:0 0 12px #a5b4fc,0 0 22px #38bdf877;opacity:0;animation:mhReincarnationSoul 2.3s ease-out infinite;animation-delay:calc(var(--i)*.13s)}
    /* ② 収束。外周8方向から中央へ吸い込まれ、繭が閉じる */
    .mh-reincarnation-converge{position:absolute;inset:0;z-index:2;pointer-events:none}
    .mh-reincarnation-converge i{position:absolute;left:50%;top:48%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:radial-gradient(circle,#fff,#c7d2fe 45%,#6366f1);box-shadow:0 0 14px #a5b4fc,0 0 30px #6366f199;opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-62vmin);animation:mhReincarnationConverge 1.15s cubic-bezier(.35,0,.2,1) .18s forwards}
    /* ④ 衝撃波の輪。繭が割れて広がる */
    .mh-reincarnation-halo{position:absolute;z-index:3;width:170px;height:170px;border-radius:50%;border:3px solid #c7d2fe;box-shadow:0 0 24px #818cf8aa,inset 0 0 22px #38bdf866;opacity:0;pointer-events:none;animation:mhReincarnationHalo 4s cubic-bezier(.15,.75,.3,1) forwards}
    .mh-reincarnation-halo.is-second{width:230px;height:230px;border-color:#67e8f9;border-width:2px;box-shadow:0 0 22px #22d3eeaa,inset 0 0 20px #818cf866;animation-delay:.16s}
    /* ③ 閃光 */
    .mh-reincarnation-flash{position:absolute;inset:0;z-index:5;background:#fff;opacity:0;pointer-events:none;animation:mhReincarnationFlash 4s ease-out forwards}
    /* ⑤ 名乗り */
    .mh-reincarnation-title{position:absolute;z-index:6;top:calc(env(safe-area-inset-top) + 21%);font-size:clamp(36px,14vw,62px);font-weight:1000;letter-spacing:.14em;color:#f5f3ff;opacity:0;pointer-events:none;text-shadow:0 0 18px #818cf8,0 0 44px #38bdf8;animation:mhReincarnationTitle 4s ease-out forwards}
    .mh-reincarnation-mark{position:absolute;z-index:6;top:62%;opacity:0;transform:scale(.4);pointer-events:none;animation:mhReincarnationMark 4s ease-out forwards}
    .mh-reincarnation-mark .mh-reincarnate-badge{position:relative;left:auto;bottom:auto;transform:none;padding:7px 16px;border-width:2px;font-size:17px;box-shadow:0 2px 12px #020617,0 0 20px #818cf8}
    .mh-reincarnate-aura.is-ceremony{inset:-48%;opacity:0;animation:mhReincarnationAura 4s cubic-bezier(.2,.75,.25,1) forwards}.mh-reincarnate-aura.is-ceremony .is-main{animation-duration:1.45s}.mh-reincarnate-aura.is-ceremony .is-back{animation-duration:1.8s}.mh-reincarnate-aura.is-ceremony .is-foot{animation-duration:1.1s}.mh-reincarnate-aura.is-ceremony img{filter:brightness(1.1) drop-shadow(0 0 8px #fff8)}
    .mh-reincarnation-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));z-index:6;display:flex;flex-direction:column;align-items:center;padding:0 14px;text-align:center;color:#e0f2fe;font-size:11px;font-weight:900;animation:mhReincarnationCopy 4s ease-out forwards}.mh-reincarnation-copy b{font-size:25px;color:#fff;text-shadow:0 0 12px #818cf8}.mh-reincarnation-copy span{margin-top:2px}
    @keyframes mhReincarnationLight{0%,43%{opacity:0}48%{opacity:.36}56%,100%{opacity:0}}
    /* 本体: 沈む → 白へ飛ぶ(閃光) → 小さく生まれ直して弾む → 等倍 */
    @keyframes mhReincarnationMon{0%{opacity:1;transform:translateY(10px) scale(.96);filter:none}20%{transform:translateY(2px) scale(.99);filter:brightness(1.15)}28%{transform:translateY(0) scale(.9);filter:brightness(2.6) saturate(.25)}32%{opacity:.9;transform:scale(.62);filter:brightness(4) saturate(0)}35%{opacity:.25;transform:scale(.34);filter:brightness(5) saturate(0)}40%{opacity:1;transform:scale(.5);filter:brightness(2.2) saturate(.5)}48%{transform:scale(1.14);filter:none}54%{transform:scale(.97)}60%,100%{opacity:1;transform:none;filter:none}}
    @keyframes mhReincarnationSoul{0%{opacity:0;transform:translate(calc(var(--x)*1px),0) scale(.45)}14%{opacity:1;transform:translate(calc(var(--x)*1.3px),-30px) scale(1)}100%{opacity:0;transform:translate(calc(var(--x)*2.4px),-215px) scale(.25)}}
    @keyframes mhReincarnationConverge{0%{opacity:0}22%{opacity:1}88%{opacity:1;transform:rotate(calc(var(--i)*45deg)) translateY(-7vmin) scale(.7)}100%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(0) scale(.2)}}
    @keyframes mhReincarnationFlash{0%,30%{opacity:0}34%{opacity:.92}46%,100%{opacity:0}}
    @keyframes mhReincarnationHalo{0%,31%{opacity:0;transform:scale(.18)}37%{opacity:1;transform:scale(.55)}62%{opacity:.35;transform:scale(1.75)}80%,100%{opacity:0;transform:scale(2.3)}}
    @keyframes mhReincarnationRays{0%,31%{opacity:0;transform:rotate(0) scale(.7)}40%{opacity:.8;transform:rotate(12deg) scale(1)}66%{opacity:.28;transform:rotate(30deg) scale(1.06)}100%{opacity:0;transform:rotate(44deg) scale(1.1)}}
    @keyframes mhReincarnationTitle{0%,31%{opacity:0;transform:scale(1.85);letter-spacing:.5em}39%{opacity:1;transform:scale(1);letter-spacing:.14em}50%{opacity:1}60%,100%{opacity:0;transform:scale(.94)}}
    @keyframes mhReincarnationMark{0%,50%{opacity:0;transform:scale(.4)}57%{opacity:1;transform:scale(1.18)}62%{transform:scale(1)}100%{opacity:1;transform:scale(1)}}
    @keyframes mhReincarnationAura{0%,16%{opacity:0;transform:scale(.88)}30%{opacity:.86;transform:scale(1)}47%{opacity:1;transform:scale(1.13);filter:brightness(1.45)}64%{opacity:.9;transform:scale(1);filter:brightness(1)}100%{opacity:1;transform:scale(1);filter:brightness(1)}}
    @keyframes mhReincarnationCopy{0%,55%{opacity:0;transform:translateY(12px)}64%,97%{opacity:1;transform:none}100%{opacity:0}}
    @media(max-height:620px){.mh-reincarnation-copy{bottom:calc(4% + env(safe-area-inset-bottom))}.mh-reincarnation-mon{width:118px;height:118px}.mh-reincarnation-souls{width:160px;height:250px}.mh-reincarnation-title{top:calc(env(safe-area-inset-top) + 13%);font-size:clamp(30px,11vw,50px)}.mh-reincarnation-mark{top:64%}.mh-reincarnation-mark .mh-reincarnate-badge{padding:5px 12px;font-size:14px}}
    @media(prefers-reduced-motion:reduce){.mh-reincarnate-flame,.mh-reincarnate-sparks,.mh-reincarnate-sparks::before,.mh-reincarnate-sparks::after{animation:none}.mh-reincarnation-animation *{animation-duration:.01ms!important}.mh-reincarnation-souls,.mh-reincarnation-converge,.mh-reincarnation-rays,.mh-reincarnation-halo,.mh-reincarnation-flash,.mh-reincarnation-title{display:none}.mh-reincarnation-copy,.mh-reincarnation-mark{opacity:1;transform:none}}
    /* 限界突破の演出。転生とは別物として、上へ突き抜ける光と、最後に増える星で見せる */
    .mh-breakthrough-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle,#f59e0b55,#020617 64%);pointer-events:auto;touch-action:none}
    .mh-breakthrough-ring{position:absolute;width:210px;height:210px;border:4px solid #fcd34d;border-radius:50%;animation:mhBreakRing 3.6s cubic-bezier(.2,.7,.3,1) forwards}
    .mh-breakthrough-ring::after{content:"";position:absolute;inset:-18px;border:2px solid #fde68a88;border-radius:50%;animation:mhBreakRing 3.6s .25s cubic-bezier(.2,.7,.3,1) forwards}
    .mh-breakthrough-beam{position:absolute;width:120px;height:130%;background:linear-gradient(0deg,transparent,#fde68acc 35%,#fff 55%,transparent);filter:blur(10px);animation:mhBreakBeam 3.6s ease-in forwards}
    .mh-breakthrough-mon{position:relative;width:145px;height:145px;animation:mhBreakMon 3.6s cubic-bezier(.3,.9,.4,1) forwards}
    .mh-breakthrough-cap{position:absolute;top:calc(16% + env(safe-area-inset-top));color:#fde68a;font-weight:900;font-size:13px;letter-spacing:.1em;animation:mhBreakCap 3.6s ease-out forwards}
    .mh-breakthrough-cap b{display:block;font-size:30px;color:#fff;text-shadow:0 0 16px #f59e0b}
    /* 最後に星が1つ増える。増えたぶんだけ大きく光ってから元の大きさに落ち着く */
    /* EXTREMEは透過画像の輪郭へdrop-shadowを重ね、敵枠ではなくモンスター本体から邪気を漏らす。 */
    .mh-extreme-enemy-aura-shell{position:relative;display:inline-flex;align-items:center;justify-content:center;isolation:isolate;overflow:visible}.mh-extreme-enemy-aura-shell::before{content:"";position:absolute;z-index:0;inset:-38% -48% -22%;border-radius:44% 56% 48% 52%;pointer-events:none;background:radial-gradient(ellipse at 50% 62%,#050008ee 0 25%,#240034e8 38%,#581c87bb 52%,#a21caf88 64%,transparent 78%);filter:blur(7px);animation:mhExtremeEnemyMist 3.7s ease-in-out infinite;will-change:transform,opacity}.mh-extreme-enemy-aura-shell::after{content:"";position:absolute;z-index:2;left:-35%;right:-35%;bottom:-15%;height:35%;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse,#140018ee 0 24%,#701a75cc 48%,#be185d88 62%,transparent 76%);filter:blur(5px);animation:mhExtremeEnemyFloor 3.1s ease-in-out infinite;will-change:transform,opacity}.mh-extreme-enemy-image{filter:drop-shadow(0 0 4px #030006) drop-shadow(0 0 9px #3b0764) drop-shadow(-7px -3px 13px #6b21a8ee) drop-shadow(8px 2px 15px #a21cafdd) drop-shadow(1px -7px 18px #be123caa);}
    @keyframes mhExtremeEnemyAura{0%,100%{filter:drop-shadow(0 0 4px #030006) drop-shadow(0 0 9px #3b0764) drop-shadow(-7px -3px 13px #6b21a8ee) drop-shadow(8px 2px 15px #a21cafdd) drop-shadow(1px -7px 18px #be123c99)}47%{filter:drop-shadow(0 0 6px #08000d) drop-shadow(0 0 13px #4c1d95) drop-shadow(-10px 3px 17px #7e22ceff) drop-shadow(10px -4px 19px #c026d3ee) drop-shadow(-3px -9px 22px #e11d48bb)}}@keyframes mhExtremeEnemyMist{0%,100%{opacity:.76;transform:scale(.94,1.01) translate(-2px,3px) rotate(-2deg)}41%{opacity:1;transform:scale(1.09,1.14) translate(4px,-7px) rotate(2deg)}73%{opacity:.84;transform:scale(1.02,1.08) translate(-3px,-2px) rotate(-1deg)}}@keyframes mhExtremeEnemyFloor{0%,100%{opacity:.68;transform:scaleX(.9)}55%{opacity:1;transform:scaleX(1.12)}}
    /* NIGHTMAREは暗い青の霊気と霧で、赤紫のEXTREMEから区別する。 */
    .mh-nightmare-enemy-aura-shell{position:relative;display:inline-flex;align-items:center;justify-content:center;isolation:isolate;overflow:visible}.mh-nightmare-enemy-aura-shell::before{content:"";position:absolute;z-index:0;inset:-42% -55% -28%;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse at 50% 52%,#020617ee 0 23%,#172554cc 42%,#312e81a8 58%,#bfdbfe55 69%,transparent 80%);filter:blur(8px);animation:mhNightmareMist 4.8s ease-in-out infinite}.mh-nightmare-enemy-aura-shell::after{content:"";position:absolute;z-index:2;inset:-30% -45% 4%;border-radius:46%;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 38%,#60a5fa44 58%,#0f172a99 71%,transparent 82%);filter:blur(6px);animation:mhNightmarePulse 3.9s ease-in-out infinite}.mh-nightmare-enemy-image{filter:drop-shadow(0 0 5px #020617) drop-shadow(0 0 11px #1e3a8a) drop-shadow(0 0 18px #818cf899) drop-shadow(0 -5px 20px #dbeafe77);animation:mhNightmarePulse 3.9s ease-in-out infinite}
    @keyframes mhNightmareMist{0%,100%{opacity:.58;transform:translate(-4px,5px) scale(.94,1.02)}50%{opacity:.9;transform:translate(5px,-6px) scale(1.08,1.14)}}@keyframes mhNightmarePulse{0%,100%{opacity:.72;transform:scale(.98)}52%{opacity:1;transform:scale(1.035)}}
    @keyframes mhExtremeRuleIn{from{opacity:0;transform:scale(.82)}60%{transform:scale(1.03)}}
    @media(prefers-reduced-motion:reduce){.mh-extreme-enemy-image,.mh-extreme-enemy-aura-shell::before,.mh-extreme-enemy-aura-shell::after,.mh-nightmare-enemy-image,.mh-nightmare-enemy-aura-shell::before,.mh-nightmare-enemy-aura-shell::after{animation:none;will-change:auto}}
    .mh-breakthrough-stars{position:absolute;top:calc(46% + 0px);display:flex;gap:4px;font-size:22px;color:#fde047;text-shadow:0 0 8px #ca8a04}
    .mh-breakthrough-stars>*{opacity:.35;font-style:normal}
    .mh-breakthrough-stars>.is-new{animation:mhBreakStar 3.6s ease-out forwards}
    .mh-breakthrough-stars>.is-old{animation:mhBreakOldStar 3.6s ease-out forwards}
    .mh-breakthrough-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;color:#fff;font-size:11px;font-weight:900;animation:mhRebirthCopy 3.6s ease-out forwards}
    .mh-breakthrough-copy b{font-size:20px;color:#fcd34d}
    .mh-breakthrough-copy span{margin-top:2px}
    @keyframes mhBreakRing{0%{opacity:0;transform:scale(.2)}18%{opacity:1}70%{opacity:.7;transform:scale(1.15)}100%{opacity:0;transform:scale(2.1)}}
    @keyframes mhBreakBeam{0%,10%{opacity:0;transform:translateY(40%) scaleY(.2)}45%{opacity:1;transform:translateY(0) scaleY(1)}100%{opacity:0;transform:translateY(-40%) scaleY(1.2)}}
    @keyframes mhBreakMon{0%{transform:translateY(24px) scale(.9);filter:brightness(1)}40%{transform:translateY(-14px) scale(1.06);filter:brightness(1.8)}60%{filter:brightness(1)}100%{transform:translateY(0) scale(1)}}
    @keyframes mhBreakCap{0%,25%{opacity:0;transform:translateY(10px)}45%{opacity:1;transform:translateY(0)}100%{opacity:1}}
    @keyframes mhBreakStar{0%,55%{opacity:0;transform:scale(0) rotate(-90deg)}70%{opacity:1;transform:scale(2.1) rotate(20deg)}85%{transform:scale(.9) rotate(0)}100%{opacity:1;transform:scale(1.25)}}
    @keyframes mhBreakOldStar{0%,55%{opacity:.35}100%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.mh-breakthrough-ring,.mh-breakthrough-ring::after,.mh-breakthrough-beam,.mh-breakthrough-mon,.mh-breakthrough-cap,.mh-breakthrough-stars>*,.mh-breakthrough-copy{animation:none}.mh-breakthrough-stars>*{opacity:1}}
    .mh-rebirth-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle,#7c3aed88,#020617 62%);pointer-events:auto;touch-action:none}.mh-rebirth-circle{position:absolute;width:240px;height:240px;border:3px solid #c4b5fd;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fde68a;font-size:150px;animation:mhRebirthCircle 4s ease-in-out forwards}.mh-rebirth-glow{position:absolute;width:100%;height:42%;background:linear-gradient(90deg,transparent,#fff8,transparent);filter:blur(14px);animation:mhRebirthGlow 4s ease-in-out forwards}.mh-rebirth-mon{position:relative;width:145px;height:145px;animation:mhRebirthFloat 4s ease-in-out forwards}.mh-rebirth-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;color:#fff;font-size:11px;font-weight:900;animation:mhRebirthCopy 4s ease-out forwards}.mh-rebirth-copy b{font-size:20px;color:#fde68a}.mh-rebirth-copy span{margin-top:2px}@keyframes mhRebirthCircle{0%{opacity:0;transform:scale(.3) rotate(0)}25%{opacity:1}100%{opacity:.25;transform:scale(1.5) rotate(180deg)}}@keyframes mhRebirthGlow{0%,20%{opacity:0}40%,70%{opacity:1}100%{opacity:0}}@keyframes mhRebirthFloat{0%{transform:translateY(30px);filter:brightness(1)}45%{transform:translateY(-25px);filter:brightness(2)}60%{filter:brightness(0)}78%{filter:brightness(3)}100%{transform:translateY(0);filter:brightness(1)}}@keyframes mhRebirthCopy{0%,55%{opacity:0;transform:translateY(20px)}68%,100%{opacity:1;transform:none}}.mh-donation-animation{position:fixed;inset:0;z-index:33000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at center,#7c3aed55 0,#020617 58%);pointer-events:auto;touch-action:none}.mh-donation-beam{position:absolute;width:150px;height:110%;background:linear-gradient(90deg,transparent,#fff9c477,transparent);filter:blur(8px);animation:mhDonationBeam 1.5s ease-in-out forwards}.mh-donation-monster{position:absolute;width:96px;height:96px;filter:drop-shadow(0 0 22px #fff);animation:mhDonationRise 1.25s ease-in forwards}.mh-donation-gem{position:absolute;color:#fde68a;opacity:0;filter:drop-shadow(0 0 18px #fbbf24);animation:mhDonationGem .55s 1s ease-out forwards}.mh-donation-particles i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#fde68a;box-shadow:0 0 8px #fff;opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-20px);animation:mhDonationParticle .55s 1s ease-out forwards}.mh-donation-copy{position:absolute;bottom:calc(15% + env(safe-area-inset-bottom));font-size:14px;font-weight:1000;color:#f5d0fe;text-shadow:0 0 12px #a855f7}@keyframes mhDonationRise{0%{transform:translateY(25px) scale(1);opacity:1}55%{transform:translateY(-28px) scale(1.08);opacity:1}100%{transform:translateY(-55px) scale(.05);opacity:0;filter:drop-shadow(0 0 50px #fff)}}@keyframes mhDonationBeam{0%{opacity:0;transform:scaleX(.2)}35%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(.1)}}@keyframes mhDonationGem{to{opacity:1;transform:scale(1.2)}}@keyframes mhDonationParticle{0%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-95px) scale(.2)}}@keyframes mhHomeMasumonWalk{0%,100%{translate:0 0}50%{translate:0 -5px}}@keyframes mhHomeBattlePulse{50%{filter:brightness(1.16);box-shadow:0 0 34px #d8b4fddd,inset 0 0 26px #ffdc8366}}@media(max-width:350px){.mh-home-player-copy strong{max-width:80px}.mh-home-wallet{width:124px}.mh-home-facility>span{font-size:9px;padding:6px 8px}.mh-home-facility.battle>span{min-width:140px;font-size:18px}
    }@media(max-height:620px){.mh-home-facility.management,.mh-home-facility.temple{top:13%;height:32%}/* 背の低い端末では、みゅあの吹き出しがM/B管理の看板にかからないよう少し下げる */.mh-home-facility.management>span,.mh-home-facility.temple>span{top:45%}.mh-home-facility.market{top:43%}.mh-home-facility.battle{height:30%}}@media(prefers-reduced-motion:reduce){.mh-home-background,.mh-home-player,.mh-home-facility>span{transition:none}.mh-home-facility.battle>span{animation:none}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:none}}
    .mh-home-mission{position:absolute;z-index:5;right:5%;top:65%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #fbbf24aa;border-radius:13px;background:#422006e8;color:#fef3c7;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-mission em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-mission:active{transform:scale(.94);filter:brightness(1.25)}/* はじめての案内で説明中の場所だけを明るく浮かび上がらせる。暗幕(z-index:90000)より前に出す。
   施設だけでなく、ミッション/ギフトの本体・みゅあの吹き出しも対象にする(そこも案内するため) */.is-tutorial-spot{z-index:90001}.mh-home-facility.is-tutorial-spot>span,.mh-home-mission.is-tutorial-spot,.mh-home-gift.is-tutorial-spot,.mh-home-assistant.is-tutorial-spot,.mh-home-settings.is-tutorial-spot{border-color:#fce7f3;filter:brightness(1.5) saturate(1.15);box-shadow:0 0 0 4px #f472b6,0 0 0 10px #f472b655,0 0 46px 12px #f472b6cc;animation:mhTutorialSpot 1.35s ease-in-out infinite}.mh-home-assistant.is-tutorial-spot{border-radius:18px}.mh-home-settings.is-tutorial-spot{position:relative;border-radius:11px}/* どこを指しているかが一目で分かるように、光る枠の上に矢印を出す */.mh-home-facility.is-tutorial-spot>span::before,.mh-home-mission.is-tutorial-spot::before,.mh-home-gift.is-tutorial-spot::before,.mh-home-assistant.is-tutorial-spot::before,.mh-home-settings.is-tutorial-spot::before{content:'▼';position:absolute;left:50%;bottom:100%;margin-bottom:5px;transform:translateX(-50%);color:#fbcfe8;font-size:19px;line-height:1;text-shadow:0 0 12px #f472b6,0 2px 4px #000;animation:mhTutorialArrow .9s ease-in-out infinite;pointer-events:none}/* 設定は画面のいちばん上にあるので、矢印は下側から上を指す */.mh-home-settings.is-tutorial-spot::before{content:'▲';top:100%;bottom:auto;margin:5px 0 0}@keyframes mhTutorialSpot{50%{box-shadow:0 0 0 6px #fbcfe8,0 0 0 15px #f472b644,0 0 62px 18px #f472b6}}@keyframes mhTutorialArrow{50%{transform:translateX(-50%) translateY(-7px)}}/* バトルチュートリアルで「ここを操作して」と示す枠。ふだんの画面の上に重ねるので、   暗幕は張らず、光る枠だけで示す(押せる場所はそのまま押せる) */.is-battle-tutorial-spot{border-radius:18px;outline:3px solid #f472b6;outline-offset:3px;box-shadow:0 0 0 7px #f472b644,0 0 34px 6px #f472b6aa;animation:mhBattleSpot 1.3s ease-in-out infinite}@keyframes mhBattleSpot{50%{outline-color:#fbcfe8;box-shadow:0 0 0 10px #f472b633,0 0 46px 10px #f472b6}}@media(prefers-reduced-motion:reduce){.is-battle-tutorial-spot{animation:none}}@media(prefers-reduced-motion:reduce){.is-tutorial-spot,.is-tutorial-spot>span,.is-tutorial-spot::before,.is-tutorial-spot>span::before{animation:none}}.mh-home-assistant{position:absolute;z-index:5;left:3%;width:70%;top:calc(72px + env(safe-area-inset-top));pointer-events:auto}@media(max-width:350px){.mh-home-assistant{width:62%}}
    .mh-gift-list{display:flex;flex-direction:column;gap:8px}.mh-gift-card{display:flex;flex:none;flex-direction:column;gap:4px;min-height:88px;padding:10px 12px}.mh-gift-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;min-width:0;min-height:20px}.mh-gift-heading h3{display:flex;align-items:flex-start;gap:4px;min-width:0;font-size:14px;line-height:19px;color:#fff}.mh-gift-heading h3 span{flex:none;margin-top:1px;padding:1px 6px;border-radius:6px;background:#78350f;color:#fde68a;font-size:10px;line-height:16px}.mh-gift-heading h3 b{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;min-width:0;white-space:normal;overflow-wrap:anywhere}.mh-gift-heading>em{flex:none;padding:2px 8px;border-radius:999px;font-size:10px;line-height:16px;font-style:normal;font-weight:900}.mh-gift-main{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px}.mh-gift-rewards{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:2px 7px;min-width:0;color:#fde68a;font-size:11px;line-height:15px;font-weight:900}.mh-gift-rewards span{overflow-wrap:anywhere}.mh-gift-main>button{flex:none;min-width:84px;height:44px;padding:0 12px;border-radius:12px;background:#0891b2;color:#fff;font-size:12px;font-weight:900;white-space:nowrap;transition:transform .12s ease-out}.mh-gift-main>button:active{transform:scale(.95)}.mh-gift-main>button:disabled{opacity:.4;transform:none}.mh-gift-deadline{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:10px;line-height:14px}
    @media(max-height:620px){.mh-home-mission{top:64%}.mh-home-gift{top:73%}}
    /* 横画面(#146・2026-09-05)。コラムが画面いっぱいになるので、左右の余白へ施設を振り分ける。左＝吹き出し・M/B管理・モンヒロビート、右＝更新履歴・神殿・マーケット、右下＝ミッションとギフトを横並び、下中央＝バトル。上の max-height:620px は横画面のスマホにも当たるので、この行はそれより後ろに置いて上書きする */
    @media(orientation:landscape) and (max-height:600px){.mh-home-assistant{left:2%;width:36%;top:calc(70px + env(safe-area-inset-top))}.mh-home-facility>span{padding:6px 12px}.mh-home-facility.management{left:0;top:calc(70px + env(safe-area-inset-top));width:30%;height:calc(50% - 70px - env(safe-area-inset-top))}.mh-home-facility.management>span{left:8%;top:76px}.mh-home-facility.rhythm{left:0;top:58%;width:30%;height:34%}.mh-home-facility.rhythm>span{left:8%;top:20%}.mh-home-facility.temple{right:0;top:30%;width:30%;height:24%}.mh-home-facility.temple>span{right:8%;top:24%}.mh-home-facility.market{right:0;top:54%;width:30%;height:24%}.mh-home-facility.market>span{right:8%;top:24%}.mh-home-mission{right:calc(5% + 120px);top:78%}.mh-home-gift{top:78%}.mh-home-facility.battle{left:30%;right:30%;height:34%}.mh-home-facility.battle>span{padding:8px 16px;font-size:18px;animation:none}.mh-home-masumon-layer{left:30%;right:30%;top:30%;bottom:34%}}
    .mh-boot-screen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;padding:calc(12px + env(safe-area-inset-top)) 24px calc(16px + env(safe-area-inset-bottom));color:#fff;text-align:center;background:radial-gradient(circle at 50% 35%,#34205c 0,#100c29 38%,#040511 76%);isolation:isolate}
    .mh-boot-stars{position:absolute;inset:0;background-image:radial-gradient(circle,#e9d5ff 0 1px,transparent 1.5px);background-size:39px 41px;opacity:.28}
    .mh-mocchi-wrap{position:relative;z-index:2;width:min(42vw,180px);height:min(42vw,180px);display:flex;align-items:flex-end;justify-content:center;margin-bottom:clamp(8px,3vh,24px)}
    .mh-mocchi-wrap img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 14px #000);transform-origin:50% 88%;animation:mhMocchiHop 1.2s ease-in-out infinite}.mh-mocchi-wrap span{position:absolute;bottom:-5px;width:60%;height:13px;border-radius:50%;background:#0008;filter:blur(3px);animation:mhShadow 1.2s ease-in-out infinite}.mh-mocchi-wrap i{display:none;position:absolute;color:#ffeaa7;font-style:normal;font-size:22px;filter:drop-shadow(0 0 8px #fff)}
    .mh-boot-copy{position:relative;z-index:2;width:min(100%,340px)}.mh-boot-copy h1{font-size:clamp(20px,6vw,30px);font-weight:1000;letter-spacing:.22em;color:#fff;text-shadow:0 0 18px #c084fc;margin:0 0 8px}.mh-boot-copy h2{font-size:12px;color:#ddd6fe;letter-spacing:.12em;margin:0 0 18px}.mh-boot-copy p{min-height:18px;font-size:10px;color:#c4b5fd;margin-top:10px}.mh-progress{height:10px;border:1px solid #c4b5fd88;border-radius:99px;background:#080617;overflow:hidden}.mh-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3aed,#d8b4fe,#fbbf24);box-shadow:0 0 14px #c084fc;transition:width .25s}.mh-boot-copy strong{display:block;margin-top:7px;font:800 11px monospace}.mh-boot-copy button{width:100%;min-height:56px;border:1px solid #f8d477;border-radius:18px;background:linear-gradient(135deg,#4c1d95dd,#7e22cedd);box-shadow:0 0 25px #a855f766;color:#fff;font-size:clamp(15px,5vw,20px);font-weight:1000;letter-spacing:.12em;touch-action:manipulation}.mh-boot-screen footer{position:absolute;z-index:2;bottom:calc(8px + env(safe-area-inset-bottom));font:8px monospace;color:#7773a0;letter-spacing:.15em}
    .mh-boot-screen.is-ready .mh-mocchi-wrap img{animation:mhReadyHop .75s ease-out 1,mhMocchiHop 1.8s ease-in-out .75s infinite}.mh-boot-screen.is-ready .mh-boot-copy{animation:titleReveal .55s ease-out both}.mh-boot-screen.is-ready .mh-mocchi-wrap i{display:block;animation:mhSparkle 1.5s infinite}.mh-boot-screen.is-ready .mh-mocchi-wrap i:nth-of-type(1){top:10%;left:4%}.mh-boot-screen.is-ready .mh-mocchi-wrap i:nth-of-type(2){top:24%;right:0;animation-delay:.55s}.mh-boot-screen.is-entering .mh-mocchi-wrap img{animation:mhBigHop .75s ease-in-out both}.mh-entry-flash{position:absolute;z-index:9;inset:0;pointer-events:none;background:radial-gradient(circle,#fff 0,#d8b4fe 18%,transparent 58%);opacity:0}.mh-boot-screen.is-entering .mh-entry-flash{animation:mhEntryFlash .76s ease-in both}
    .mh-title-gate,.mh-entering{position:fixed;inset:0;overflow:hidden;color:#fff;background:#05020e;isolation:isolate}.mh-title-gate{animation:titleReveal .65s ease-out both}.mh-title-visual,.mh-entering>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%}
    .mh-title-header{position:absolute;z-index:22;top:0;left:0;right:0;padding:calc(11px + env(safe-area-inset-top)) 12px 0;display:flex;justify-content:space-between;align-items:flex-start;text-shadow:0 2px 5px #000;pointer-events:none}.mh-title-build{display:grid;padding:6px 8px;text-align:left;font-family:monospace;line-height:1.15;border:1px solid #ffffff30;border-radius:10px;background:#160d2588;backdrop-filter:blur(3px)}.mh-title-build b{font-size:7px;letter-spacing:.18em;color:#eadcff}.mh-title-build span{font-size:8px;margin-bottom:5px;color:#fff;max-width:130px;overflow:hidden;text-overflow:ellipsis}.mh-title-actions{display:flex;gap:7px;pointer-events:auto}.mh-title-actions button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;width:50px;height:50px;border-radius:50%;background:#26152ecc;border:1px solid #ffd87a;color:#fff;font-size:8px;font-weight:800;box-shadow:0 2px 8px #000}.mh-title-actions em{position:absolute;right:-3px;top:-6px;background:#e33;padding:2px 4px;border-radius:8px;font-size:6px;font-style:normal}.mh-title-start{position:absolute;z-index:21;inset:0;width:100%;height:100%;border:0;background:transparent;touch-action:manipulation}.mh-title-start:disabled{pointer-events:none}
    .mh-title-modal{position:fixed;z-index:100;inset:0;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));background:#03020eef}.mh-title-dialog{display:flex;flex-direction:column;gap:12px;width:min(100%,380px);max-height:86vh;padding:18px;border:1px solid #a78bfa77;border-radius:22px;background:#0f172a;color:#fff;overflow:auto}.mh-dialog-head{display:flex;align-items:center;justify-content:space-between}.mh-dialog-head h3{font-weight:900}.mh-dialog-head button{padding:8px}.mh-dialog-choice{display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid #ffffff22;border-radius:14px;background:#ffffff0c;font-weight:800}.mh-changelog-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mh-changelog-tabs button{position:relative;padding:9px;border-radius:10px;background:#1e293b;font-size:11px;font-weight:800}.mh-changelog-tabs button.active{background:#b45309}.mh-unread-badge{position:absolute;right:-5px;top:-6px;display:flex;align-items:center;justify-content:center;width:17px;height:17px;border:2px solid #fff;border-radius:50%;background:#dc2626;color:#fff;font:900 11px/1 sans-serif;font-style:normal;box-shadow:0 2px 5px #0008;pointer-events:none}.mh-changelog-list{overflow:auto}.mh-changelog-list article{padding:11px;margin-bottom:8px;border:1px solid #ffffff18;border-radius:13px;background:#0005}.mh-changelog-list time,.mh-changelog-list b{display:block}.mh-changelog-list time{font:9px monospace;color:#94a3b8}.mh-changelog-list b{font-size:12px;margin:4px 0}.mh-changelog-kind{display:inline-block;margin-top:5px;padding:2px 7px;border-radius:999px;border:1px solid currentColor;font:900 9px/1.5 sans-serif}.mh-changelog-kind[data-kind="fix"]{color:#fca5a5;background:#7f1d1d55}.mh-changelog-kind[data-kind="feature"]{color:#86efac;background:#14532d55}.mh-changelog-kind[data-kind="update"]{color:#93c5fd;background:#1e3a8a55}.mh-changelog-kind[data-kind="market"]{color:#fcd34d;background:#78350f55}.mh-changelog-kind[data-kind="issue"]{color:#d8b4fe;background:#4c1d9555}.mh-changelog-kind[data-kind="mode"]{color:#67e8f9;background:#164e6355}.mh-changelog-kind[data-kind="content"]{color:#f9a8d4;background:#83184355}.mh-changelog-kind[data-kind="event"]{color:#fdba74;background:#7c2d1255}.mh-changelog-list p{font-size:10px;color:#cbd5e1}.mh-changelog-head{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:0;border:0;background:transparent;color:inherit;text-align:left}.mh-changelog-head b{flex:1;min-width:0;margin:4px 0}.mh-changelog-head small{flex:none;font-size:8px;font-weight:900;color:#94a3b8;white-space:nowrap}.mh-changelog-detail{margin-top:2px;padding-top:6px;border-top:1px solid #ffffff14}.mh-changelog-empty{padding:18px 12px;text-align:center;line-height:1.7;color:#fbbf24}.mh-changelog-day{position:sticky;top:0;z-index:1;margin:10px 0 6px;padding:3px 0;background:#0f172a;color:#a5b4fc;font:900 10px/1.4 monospace;letter-spacing:.04em}.mh-changelog-day:first-child{margin-top:0}.mh-changelog-group-emoji{flex:none;font-size:13px;line-height:1}.mh-changelog-count{flex:none;position:relative;padding:2px 7px;border-radius:999px;background:#ffffff14;color:#cbd5e1;font:900 9px/1.5 sans-serif;white-space:nowrap}.mh-changelog-count em{margin-left:5px;padding:1px 4px;border-radius:5px;background:#dc2626;color:#fff;font:900 7px sans-serif;font-style:normal}.mh-changelog-peek{margin-top:4px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;font-size:9px;line-height:1.5;color:#94a3b8}.mh-changelog-kinds{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.mh-changelog-kinds .mh-changelog-kind{margin-top:0}.mh-changelog-kind i{margin-left:3px;font-style:normal;opacity:.85}.mh-changelog-item{padding:9px 0;border-top:1px solid #ffffff14}.mh-changelog-item:first-child{padding-top:2px;border-top:0}.mh-changelog-item time{display:inline-block;margin-right:6px;font:9px monospace;color:#94a3b8}.mh-changelog-item time em{margin-left:4px;padding:1px 4px;border-radius:5px;background:#dc2626;color:#fff;font:900 7px sans-serif;font-style:normal}.mh-changelog-item b{display:block;margin:4px 0;font-size:11px;line-height:1.5}.mh-changelog-item .mh-changelog-kind{margin-top:0}[data-changelog-link]{display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:8px 13px;border:1px solid #7dd3fc55;border-radius:11px;background:#0ea5e922;color:#7dd3fc;font:900 10px/1.4 sans-serif;text-decoration:none}.mh-title-dialog textarea{min-height:90px;padding:8px;border-radius:10px;background:#0008;font:9px monospace}
    .mh-tile-viewport{touch-action:none;overscroll-behavior:contain;cursor:grab}.mh-tile-viewport:active{cursor:grabbing}.mh-tile-viewport.overview{overflow:auto}.mh-tile-viewport.overview .mh-tile-board{transform:none}.mh-training-tile{transform:scale(var(--map-scale,1))}.mh-training-tile.current{transform:scale(calc(var(--map-scale,1)*1.08))}.mh-tile-board>i.route{height:17px;border-color:#fef08a;background:#facc15;box-shadow:0 0 14px #fde047;animation:trainingRoutePulse .7s infinite alternate}.mh-training-tile.route-preview{border-color:#fde047;box-shadow:0 0 16px #fde047,0 5px 0 #713f12}.mh-training-tile.stop-preview{z-index:7;border-color:#fff;box-shadow:0 0 0 5px #f97316,0 0 25px #fb923c}.mh-board-buttons{display:flex;align-items:center;gap:4px}.mh-board-buttons button{min-height:34px;padding:0 8px;border-radius:9px;background:#164e63;font-size:8px;font-weight:900}.mh-board-buttons span{padding:3px 5px;border-radius:7px;background:#020617;color:#bae6fd;font:8px monospace}.mh-changelog-list article.unread{border-color:#f59e0b88}.mh-changelog-list time em{float:right;padding:2px 5px;border-radius:6px;background:#dc2626;color:#fff;font:900 7px sans-serif;font-style:normal}.mh-training-effect{position:fixed;z-index:45000;left:50%;top:43%;width:min(78vw,300px);min-height:150px;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:3px solid #fff;border-radius:28px;background:radial-gradient(circle,#0ea5e9dd,#020617ee 72%);box-shadow:0 0 55px #38bdf8;pointer-events:none;animation:trainingEffectPop 1.25s ease-out both}.mh-training-effect>span{font-size:58px;filter:drop-shadow(0 0 15px #fff)}.mh-training-effect>b{z-index:2;max-width:90%;text-align:center;color:#fff;font-size:16px;text-shadow:0 2px 5px #000}.mh-training-effect.xp,.mh-training-effect.effect,.mh-training-effect.turn{background:radial-gradient(circle,#22c55edd,#052e16ee 72%);box-shadow:0 0 55px #4ade80}.mh-training-effect.diamond{background:radial-gradient(circle,#38bdf8ee,#172554ee 72%)}.mh-training-effect.item,.mh-training-effect.tool,.mh-training-effect.goal{background:radial-gradient(circle,#fbbf24ee,#581c87ee 72%);box-shadow:0 0 70px #fde047}.mh-training-effect.move,.mh-training-effect.happening{background:radial-gradient(circle,#ef4444dd,#450a0aee 72%);box-shadow:0 0 55px #fb7185}.mh-training-effect i{position:absolute;width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 12px #fff;animation:trainingParticle 1s ease-out both}.mh-training-effect i:nth-of-type(1){--a:0deg}.mh-training-effect i:nth-of-type(2){--a:60deg}.mh-training-effect i:nth-of-type(3){--a:120deg}.mh-training-effect i:nth-of-type(4){--a:180deg}.mh-training-effect i:nth-of-type(5){--a:240deg}.mh-training-effect i:nth-of-type(6){--a:300deg}@keyframes trainingEffectPop{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-58%) scale(.96)}}@keyframes trainingParticle{from{transform:rotate(var(--a)) translateX(18px);opacity:1}to{transform:rotate(var(--a)) translateX(115px) scale(.2);opacity:0}}@keyframes trainingRoutePulse{to{filter:brightness(1.6)}}
    .mh-entering>img{animation:mhGateZoom 1.15s ease-in both}.mh-gate-core{position:absolute;z-index:3;left:50%;top:44%;width:12vmin;height:12vmin;border-radius:50%;background:#fff;box-shadow:0 0 25px 12px #d8b4fe,0 0 90px 40px #7e22ce;transform:translate(-50%,-50%);animation:mhCoreGrow 1.15s ease-in both}.mh-gate-particles{position:absolute;z-index:2;inset:-30%;background:repeating-conic-gradient(from 0deg,transparent 0 8deg,#fbbf2444 9deg,#a855f766 10deg,transparent 11deg 19deg);animation:mhParticles 1.1s ease-in both}.mh-gate-flash{position:absolute;z-index:4;inset:0;background:#f5f0ff;animation:mhGateFlash 1.15s ease-in both}.mh-entering p{position:absolute;z-index:6;left:0;right:0;bottom:calc(9% + env(safe-area-inset-bottom));text-align:center;font-size:11px;font-weight:800;text-shadow:0 2px 6px #000}
    @keyframes mhMocchiHop{0%,100%{transform:translateY(0) scale(1.05,.95)}45%{transform:translateY(-14px) rotate(-2deg) scale(.98,1.02)}70%{transform:translateY(0) scale(1.08,.9)}}@keyframes mhReadyHop{45%{transform:translateY(-25px) scale(1.1)}100%{transform:translateY(0)}}@keyframes mhShadow{0%,100%{transform:scaleX(1);opacity:.6}45%{transform:scaleX(.65);opacity:.3}}@keyframes mhSparkle{50%{transform:scale(1.5) rotate(90deg);opacity:.35}}@keyframes mhBigHop{45%{transform:translateY(-34px) scale(.95,1.08)}100%{transform:translateY(5px) scale(1.12,.88)}}@keyframes mhEntryFlash{45%{opacity:0}80%{opacity:1}100%{opacity:0}}@keyframes titleReveal{from{opacity:0;filter:brightness(2)}to{opacity:1;filter:none}}@keyframes mhGateZoom{to{transform:scale(1.16);filter:blur(2px) brightness(1.5)}}@keyframes mhCoreGrow{0%{transform:translate(-50%,-50%) scale(.15);opacity:0}70%{opacity:1}100%{transform:translate(-50%,-50%) scale(18)}}@keyframes mhParticles{to{transform:rotate(35deg) scale(.2);opacity:0}}@keyframes mhGateFlash{0%,68%{opacity:0}85%{opacity:.95}100%{opacity:1}}
    @media(max-width:350px){.mh-title-actions button{width:46px;height:46px}.mh-mocchi-wrap{width:130px;height:130px}.mh-title-header{padding-left:9px;padding-right:9px}}
    @media(max-height:620px){.mh-mocchi-wrap{width:105px;height:105px;margin-bottom:5px}.mh-boot-copy h2{margin-bottom:10px}.mh-boot-copy p{margin-top:5px}}
    @media(prefers-reduced-motion:reduce){.mh-mocchi-wrap img,.mh-mocchi-wrap span,.mh-mocchi-wrap i{animation:none!important}.mh-entering>img{animation:mhReducedFade .85s ease both}.mh-gate-core,.mh-gate-particles{display:none}.mh-gate-flash{animation:mhReducedFlash .85s ease both}}@keyframes mhReducedFade{to{opacity:.4}}@keyframes mhReducedFlash{0%,55%{opacity:0}100%{opacity:1}}
    .mh-home-facility.rhythm{left:0;top:46%;width:38%;height:25%}.mh-home-facility.rhythm>span{left:5%;top:37%;border-color:#67e8f9dd;background:linear-gradient(135deg,#0e7490ee,#4c1d95ee);box-shadow:0 3px 12px #0009,0 0 15px #22d3ee66}
    .mh-debug-banner{flex:none;text-align:center;background:#be123c;color:white;padding:5px;font-size:9px;font-weight:1000;letter-spacing:.04em}.mh-home-facility.rhythm small{display:block;font-size:7px;color:#fde68a}.mh-rule-button{width:100%;margin-top:18px;padding:13px;border-radius:14px;background:#4338ca;font-weight:900}.mh-node-map{position:relative;flex:1;min-height:250px;overflow:hidden;border:1px solid #ffffff33;border-radius:15px;background:radial-gradient(circle,#164e63,#020617);transition:.4s}.mh-node-map>i{position:absolute;height:3px;background:#94a3b8;transform-origin:0 50%;z-index:0}.mh-node-map>button{position:absolute;z-index:2;width:52px;height:52px;margin:-26px;border:3px solid #ffffff88;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;transition:.25s}.mh-node-map>button span{font-size:17px}.mh-node-map>button small{font-size:6px;font-weight:900}.mh-node-map>button.current{border-color:#fff700;box-shadow:0 0 18px #fff700}.mh-node-map>button.destination{animation:trainingGlow .7s infinite alternate;pointer-events:auto}.mh-node-map>button:not(.destination){pointer-events:auto}.mh-node-map img,.mh-node-map>button>div{position:absolute;width:48px;height:48px;object-fit:contain;z-index:3}.mh-board-buttons{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:5px}.mh-board-buttons button{min-height:34px;border-radius:8px;background:#334155;font-size:8px;font-weight:900}@keyframes trainingGlow{to{transform:scale(1.2);border-color:#fff;box-shadow:0 0 24px #fde047}}.mh-training-debug{position:absolute;right:8px;bottom:82px;z-index:30;width:min(270px,82vw);max-height:55vh;overflow:auto;padding:10px;border:2px solid #e879f9;border-radius:14px;background:#0f172ff5;font-size:8px}.mh-training-debug button,.mh-training-debug select{margin:3px;padding:6px;border-radius:6px;background:#334155}.mh-training-debug button.active{background:#db2777}.mh-training-debug pre{max-height:110px;overflow:auto;white-space:pre-wrap;background:#000;padding:5px}.mh-training-modal{position:fixed;z-index:50000;inset:0;display:flex;align-items:center;padding:16px;background:#020617e8}.mh-training-modal>div{width:100%;max-height:85vh;overflow:auto;padding:18px;border:1px solid #a78bfa;border-radius:20px;background:#111827}.mh-training-modal h3{margin:8px 0;font-size:17px;font-weight:1000}.mh-training-modal p{margin:7px 0;color:#cbd5e1;font-size:10px}.mh-rules-list p{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid #ffffff22;padding:7px}.mh-rules-list b{font-size:10px}.mh-rules-list span{font-size:8px;text-align:right}.mh-route-choice,.mh-modal-close{display:block;width:100%;margin-top:8px;padding:12px;border-radius:10px;background:#4338ca;font-size:10px;font-weight:900}.mh-modal-close{background:#475569}.mh-training-result>div>button+button{margin-top:7px;background:#334155;color:white}
    .mh-training-screen{height:100%;display:flex;flex-direction:column;overflow:hidden;padding:calc(10px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom));background:radial-gradient(circle at top,#312e81,#07101f 60%)}.mh-training-head{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;flex:none}.mh-training-head>button{min-height:44px;display:flex;align-items:center;justify-content:center}.mh-training-head div{text-align:center}.mh-training-head small{display:block;color:#f9a8d4;font:900 8px monospace;letter-spacing:.25em}.mh-training-head h2{font-size:18px;font-weight:1000}.mh-training-selected{display:flex;align-items:center;gap:10px;margin:9px 0;padding:10px;border:1px solid #f9a8d477;border-radius:18px;background:#3b076455}.mh-training-selected>img,.mh-training-selected>div:first-child{width:56px;height:56px;object-fit:contain;flex:none}.mh-training-selected>div{display:flex;flex:1;min-width:0;flex-direction:column}.mh-training-selected b{font-size:14px}.mh-training-selected span{color:#fbcfe8;font-size:9px}.mh-training-selected button{padding:9px;border-radius:10px;background:#7e22ce;font-size:9px;font-weight:900}.mh-training-note{font-size:9px;color:#cbd5e1;padding:2px 3px 8px}.mh-training-mon-list{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;overflow-y:auto;padding:2px 1px 90px}.mh-training-mon-list>button{position:relative;min-width:0;padding:7px 4px;border:2px solid #334155;border-radius:16px;background:#0f172acc}.mh-training-mon-list>button.active{border-color:#f472b6;background:#83184377;box-shadow:0 0 13px #ec489966}.mh-training-mon-list img,.mh-training-mon-list>button>div:first-child{width:54px;height:54px;object-fit:contain;margin:auto}.mh-training-mon-list b,.mh-training-mon-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mh-training-mon-list b{font-size:10px}.mh-training-mon-list small{font-size:7px;color:#94a3b8}.mh-training-mon-list span{position:absolute;right:5px;top:4px;color:#fde68a;font-size:8px}.mh-training-empty{grid-column:1/-1;text-align:center;margin-top:50px;color:#64748b}.mh-training-footer{position:absolute;z-index:6;left:12px;right:12px;bottom:calc(10px + env(safe-area-inset-bottom));padding-top:20px;background:linear-gradient(transparent,#07101f 24%)}.mh-training-footer button{width:100%;min-height:52px;border-radius:18px;background:linear-gradient(90deg,#db2777,#7c3aed);font-weight:1000;box-shadow:0 6px 20px #0008}.mh-training-footer button:disabled{background:#334155;color:#64748b}.mh-training-difficulties{overflow:auto;padding:10px 1px 95px}.mh-training-difficulties>button{display:block;width:100%;margin-bottom:10px;padding:14px;text-align:left;border:2px solid #334155;border-radius:20px;background:#0f172acc}.mh-training-difficulties>button.active{border-color:#f472b6}.mh-training-difficulties>button.soon{opacity:.72}.mh-training-difficulties>button>div{display:flex;justify-content:space-between}.mh-training-difficulties b{font-size:18px}.mh-training-difficulties em{padding:4px 8px;border-radius:999px;background:#475569;font-size:8px;font-style:normal}.mh-training-difficulties p{margin:8px 0;color:#cbd5e1;font-size:10px}.mh-training-difficulties dl{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.mh-training-difficulties dl span{padding:5px;border-radius:7px;background:#02061788;text-align:center;font-size:8px}.mh-training-confirm{overflow:auto;padding:12px 2px 100px}.mh-training-confirm h3{margin:10px 0 2px;color:#f9a8d4;font-size:26px;font-weight:1000}.mh-training-confirm h4{margin-top:16px;color:#c4b5fd;font-size:11px;font-weight:1000}.mh-training-confirm p{color:#cbd5e1;font-size:10px}.mh-training-ticket{display:flex;flex-wrap:wrap;justify-content:space-between;margin-top:16px;padding:14px;border:1px solid #fbbf24aa;border-radius:16px;background:#78350f55}.mh-training-ticket b{color:#fde68a}.mh-training-ticket small{width:100%;margin-top:5px;color:#fef3c7;font-size:8px}
    .mh-training-board{height:100%;display:flex;flex-direction:column;padding:calc(8px + env(safe-area-inset-top)) 9px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(#0c4a6e,#082f49 44%,#052e16)}.mh-training-board>header{display:flex;align-items:center;justify-content:space-between}.mh-training-board>header div{display:flex;flex-direction:column}.mh-training-board>header b{font-size:14px}.mh-training-board>header span{font-size:8px;color:#bae6fd}.mh-training-board>header button{min-height:40px;padding:0 10px;border-radius:10px;background:#7f1d1d;font-size:9px;font-weight:900}.mh-training-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:7px 0}.mh-training-hud span{padding:6px 2px;border-radius:8px;background:#020617aa;text-align:center;font-size:8px;font-weight:900}.mh-training-map{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;flex:1;min-height:0;padding:7px;overflow:auto;border:1px solid #ffffff22;border-radius:16px;background:#0005}.mh-training-map>div{position:relative;aspect-ratio:1;border:2px solid #64748b;border-radius:10px;background:#334155;display:flex;align-items:center;justify-content:center}.mh-training-map>div.passed{opacity:.52}.mh-training-map>div.current{border-color:#fde047;background:#854d0e;box-shadow:0 0 14px #fde047}.mh-training-map span{font-size:17px}.mh-training-map small{position:absolute;left:3px;top:1px;font-size:6px}.mh-training-map img,.mh-training-map>div.current>div{position:absolute;width:45px;height:45px;object-fit:contain;filter:drop-shadow(0 3px 3px #000);z-index:2}.mh-training-message{min-height:28px;padding:7px;text-align:center;font-size:10px;font-weight:900}.mh-training-tools{display:flex;min-height:54px;gap:5px}.mh-training-tools button{flex:1;display:flex;align-items:center;justify-content:center;gap:3px;padding:4px;border:1px solid #a78bfa;border-radius:10px;background:#312e81}.mh-training-tools button span{font-size:17px}.mh-training-tools button small{font-size:7px}.mh-training-tools p{margin:auto;color:#94a3b8;font-size:8px}.mh-training-board>footer{margin-top:7px}.mh-roll-button{width:100%;min-height:58px;border-radius:19px;background:linear-gradient(#fbbf24,#d97706);color:#451a03;font-size:17px;font-weight:1000}.mh-roll-button small{display:block;font-size:7px}.mh-fixed-dice{display:grid;grid-template-columns:1fr repeat(3,58px);gap:5px;align-items:center}.mh-fixed-dice button{height:54px;border-radius:14px;background:#fbbf24;color:#422006;font-size:20px;font-weight:1000}.mh-training-branch{position:fixed;z-index:40000;inset:0;display:flex;align-items:center;padding:20px;background:#020617dd}.mh-training-branch>div{width:100%;padding:18px;border:1px solid #c4b5fd;border-radius:22px;background:#111827}.mh-training-branch h3{text-align:center;font-size:18px;font-weight:1000}.mh-training-branch button{display:flex;justify-content:space-between;width:100%;margin-top:8px;padding:14px;border-radius:12px;background:#312e81}.mh-training-branch span{font-size:9px;color:#cbd5e1}.mh-training-board{position:relative;background:linear-gradient(160deg,#082f49,#0f172a 52%,#14532d)}.mh-training-board>header{gap:8px}.mh-training-board>header b small{margin-left:5px;color:#facc15;font-size:7px}.mh-debug-toggle{background:#be185d!important;letter-spacing:.08em}.mh-training-hud{grid-template-columns:repeat(3,1fr)}.mh-training-hud span{display:flex;flex-direction:column;gap:2px}.mh-training-hud b{color:white;font-size:11px}.mh-tile-viewport{position:relative;flex:1;min-height:250px;overflow:auto;scroll-behavior:smooth;border:2px solid #67e8f966;border-radius:18px;background:linear-gradient(#0c4a6e99,#052e1699),repeating-linear-gradient(45deg,#ffffff08 0 8px,transparent 8px 16px);box-shadow:inset 0 0 30px #020617}.mh-tile-board{position:relative;width:720px;height:520px;transform-origin:center;transition:transform .3s}.mh-tile-viewport.overview{overflow:hidden}.mh-tile-viewport.overview .mh-tile-board{transform:scale(.46) translate(-58%,-58%)}.mh-tile-board>i{position:absolute;height:13px;border:2px solid #dbeafe99;background:#64748b;box-shadow:0 2px 0 #0f172a;transform-origin:0 50%;z-index:0}.mh-training-tile{position:absolute;z-index:2;width:68px;height:68px;margin:-34px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:4px solid #e2e8f0;border-radius:12px;color:white;background:var(--tile-color);box-shadow:0 5px 0 #0f172a,0 8px 14px #0008;transition:left .25s,top .25s,transform .2s}.mh-training-tile>span{font-size:23px;line-height:1}.mh-training-tile>small{max-width:62px;font-size:7px;font-weight:1000;text-shadow:0 1px 2px #000}.mh-training-tile.branch:after{content:'分岐';position:absolute;right:-9px;top:-10px;padding:2px 4px;border-radius:6px;background:#f97316;font-size:6px;font-weight:1000}.mh-training-tile.start{border-color:#86efac}.mh-training-tile.goal{border-color:#fde047;box-shadow:0 0 22px #facc15,0 5px 0 #713f12}.mh-training-tile.current{z-index:8;border-color:#fff;box-shadow:0 0 0 4px #facc15,0 8px 18px #000;transform:scale(1.05)}.mh-training-tile.branch-choice{z-index:9;animation:trainingGlow .55s infinite alternate;pointer-events:auto}.mh-training-piece{position:absolute;left:50%;bottom:34px;width:62px;height:73px;transform:translateX(-50%);pointer-events:none;filter:drop-shadow(0 5px 3px #000)}.mh-training-piece img,.mh-training-piece>div{width:58px!important;height:58px!important;object-fit:contain}.mh-training-piece b{position:absolute;bottom:0;left:50%;max-width:75px;transform:translateX(-50%);padding:2px 5px;border-radius:8px;background:#020617e8;white-space:nowrap;font-size:7px}.mh-training-message{color:#fef3c7}.mh-training-tools{align-items:stretch}.mh-training-tools>strong{display:flex;align-items:center;font-size:8px}.mh-training-tools button{min-width:0}.mh-training-tools button small{line-height:1.25}.mh-training-debug{right:8px;top:calc(52px + env(safe-area-inset-top));bottom:auto;box-shadow:0 14px 30px #000}.mh-debug-close{float:right;background:#be123c!important}.mh-training-board>footer{flex:none}.mh-roll-button:disabled{filter:grayscale(.7);opacity:.65}.mh-training-tools button.waiting{border-color:#fde047;box-shadow:inset 0 0 12px #facc1544}.mh-roll-decision{display:grid;grid-template-columns:1fr 2fr;gap:7px;align-items:center;min-height:58px;padding:6px 8px;border:2px solid #fbbf24;border-radius:19px;background:#451a03}.mh-roll-decision b{text-align:center;color:#fde68a}.mh-roll-decision button{height:44px;border-radius:13px;background:#fbbf24;color:#451a03;font-weight:1000}.mh-tool-unavailable{padding:9px;border:1px solid #f8717177;border-radius:10px;background:#450a0a;color:#fecaca!important}@media(max-width:380px){.mh-training-piece{transform:translateX(-50%) scale(.85)}.mh-training-tools{min-height:48px}.mh-training-message{min-height:24px;padding:4px}.mh-tile-viewport{min-height:220px}}
.mh-dice-overlay{position:absolute;z-index:200;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:#020617c9;pointer-events:none}.mh-dice-overlay b{font-size:24px;color:#fef3c7;text-shadow:0 3px 8px #000}.mh-dice-cube{display:grid;place-items:center;width:112px;height:112px;border:7px solid #f8fafc;border-radius:25px;background:linear-gradient(145deg,#fff,#cbd5e1);color:#172554;font-size:62px;font-weight:1000;box-shadow:0 18px 35px #000b,inset -8px -8px 12px #64748b55}.mh-dice-overlay.rolling .mh-dice-cube{animation:trainingDiceRoll .22s linear infinite}.mh-dice-overlay.result .mh-dice-cube{animation:trainingDiceResult .5s cubic-bezier(.2,1.7,.4,1)}@keyframes trainingDiceRoll{25%{transform:translate(-18px,-8px) rotate(-18deg) scale(.92)}50%{transform:translate(12px,-22px) rotate(22deg) scale(1.08)}75%{transform:translate(20px,4px) rotate(8deg)}}@keyframes trainingDiceResult{0%{transform:scale(.35) rotate(-90deg)}70%{transform:scale(1.18) rotate(8deg)}100%{transform:scale(1)}}.mh-training-message{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap}.mh-training-message strong{padding:3px 7px;border-radius:7px;background:#fbbf24;color:#451a03;font-size:11px}.mh-training-message small{color:#94a3b8;font-size:7px}.mh-space-detail div{padding:8px 0;border-bottom:1px solid #ffffff1f}.mh-space-detail dt{color:#a5b4fc;font-size:8px;font-weight:1000}.mh-space-detail dd{margin-top:2px;color:#e2e8f0;font-size:10px}
.mh-tile-viewport{background:radial-gradient(circle at 55% 45%,#365314aa,#0f2940 55%,#061521),repeating-linear-gradient(135deg,#fff4 0 2px,transparent 2px 14px)}.mh-tile-board>i{height:18px;border:3px solid #f8fafccc;background:linear-gradient(#94a3b8,#475569);box-shadow:0 4px 0 #020617,0 0 8px #000;transition:.2s}.mh-tile-board>i.route{z-index:1;border-color:#fef9c3;background:#facc15;box-shadow:0 0 14px #fde047,0 4px 0 #713f12}.mh-training-tile{width:64px;height:64px;margin:-32px;border-radius:9px}.mh-training-tile.route-preview{box-shadow:0 0 0 4px #fef08a99,0 0 20px #fde047,0 5px 0 #0f172a}.mh-training-tile.stop-preview{z-index:7;border-color:#fff;box-shadow:0 0 0 6px #fb923c,0 0 28px #f97316,0 5px 0 #7c2d12;animation:trainingStop  .65s infinite alternate}.mh-branch-arrow{position:absolute;z-index:12;top:-27px;left:50%;transform:translateX(-50%);min-width:52px;padding:4px 6px;border-radius:999px;background:#f97316;color:#fff;font-size:8px;font-style:normal;font-weight:1000;white-space:nowrap;box-shadow:0 0 14px #fb923c}.mh-map-legend{position:sticky;z-index:20;left:7px;top:7px;display:flex;width:max-content;gap:4px;padding:5px;border:1px solid #ffffff55;border-radius:9px;background:#020617df;pointer-events:none}.mh-map-legend b{padding:2px 4px;border-radius:5px;background:#ffffff12;font-size:6px}.mh-goal-guide{position:sticky;z-index:20;float:right;right:7px;top:7px;padding:5px 8px;border-radius:8px;background:#713f12e8;color:#fef08a;font-size:8px;font-weight:1000;pointer-events:none}.mh-goal-guide span{display:inline-block;animation:goalPoint .7s infinite alternate}.mh-tile-viewport.overview .mh-map-legend{position:absolute;left:6px;top:6px}.mh-tile-viewport.overview .mh-goal-guide{display:none}@keyframes trainingStop{to{transform:scale(1.1)}}@keyframes goalPoint{to{transform:translateX(4px)}}
.mh-training-result{height:100%;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));text-align:center;background:radial-gradient(circle,#14532d,#020617 65%)}.mh-training-result.failure{background:radial-gradient(circle,#3f3f46,#020617 65%)}.mh-training-result>div{width:100%;max-width:360px}.mh-result-mark{display:block;font-size:64px}.mh-training-result small{color:#f9a8d4;font:900 9px monospace;letter-spacing:.22em}.mh-training-result h2{font-size:28px;font-weight:1000}.mh-training-result>div>p{margin:7px;color:#cbd5e1;font-size:10px}.mh-training-result section{margin:18px 0;padding:13px;border:1px solid #ffffff22;border-radius:18px;background:#0007}.mh-training-result section div{display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #ffffff12}.mh-training-result section div:last-child{border:0}.mh-training-result section span{font-size:11px}.mh-training-result section b{color:#fde68a}.mh-training-result .mh-result-note{font-size:8px}.mh-training-result>div>button{width:100%;min-height:52px;margin-top:10px;border-radius:18px;background:#fff;color:#172554;font-weight:1000}
.mh-rpg-screen,.mh-rpg-battle{height:100%;display:flex;flex-direction:column;overflow:hidden;background:radial-gradient(circle at top,#064e3b,#04121b 62%)}.mh-rpg-screen{padding:0 0 calc(6px + env(safe-area-inset-bottom));padding-top:env(safe-area-inset-top)}.mh-rpg-head{display:grid;grid-template-columns:46px 1fr 46px;align-items:center;flex:none;padding:2px 8px}.mh-rpg-head>button{min-height:44px;display:flex;align-items:center;justify-content:center;background:transparent;color:#94a3b8}.mh-rpg-head div{text-align:center;min-width:0}.mh-rpg-head small{display:block;color:#6ee7b7;font:900 8px monospace;letter-spacing:.22em}.mh-rpg-head h2{font-size:16px;font-weight:1000}.mh-rpg-scroll{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 10px 12px}.mh-rpg-section{margin-bottom:14px}.mh-rpg-section h3{margin:6px 0;color:#6ee7b7;font-size:11px;font-weight:1000;letter-spacing:.08em}.mh-rpg-count{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}.mh-rpg-count button{min-height:44px;border:2px solid #334155;border-radius:12px;background:#0f172acc;font-size:11px;font-weight:900;color:#cbd5e1}.mh-rpg-count button.active{border-color:#34d399;background:#065f4655;color:#a7f3d0}.mh-rpg-card{margin-bottom:9px;padding:9px;border:2px solid #334155;border-radius:16px;background:#0f172ad9}.mh-rpg-card-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.mh-rpg-card-head img{width:44px;height:44px;object-fit:contain;flex:none}.mh-rpg-card-head select{flex:1;min-width:0;min-height:44px;padding:0 8px;border:1px solid #ffffff22;border-radius:10px;background:#020617;color:#e2e8f0;font-size:12px;font-weight:900}.mh-rpg-types{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:6px}.mh-rpg-types button{min-height:40px;padding:0 2px;border:2px solid #334155;border-radius:10px;background:#020617;color:#94a3b8;font-size:9px;font-weight:900}.mh-rpg-types button.active{background:#1e293b}.mh-rpg-level{display:flex;align-items:center;gap:8px;margin-bottom:6px}.mh-rpg-level b{flex:none;width:52px;color:#fde68a;font-size:12px}.mh-rpg-level input{flex:1;min-width:0;height:32px;accent-color:#34d399}.mh-rpg-points{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:10px;color:#cbd5e1;font-weight:900}.mh-rpg-points button{min-height:36px;padding:0 10px;border-radius:10px;background:#334155;color:#e2e8f0;font-size:9px;font-weight:900}.mh-rpg-stat{display:grid;grid-template-columns:44px 34px 12px 40px 44px 22px 44px;align-items:center;gap:2px;padding:2px 0;font-size:10px}.mh-rpg-stat-name{color:#94a3b8;font-weight:900}.mh-rpg-stat-base{color:#64748b;text-align:right}.mh-rpg-stat-arrow{color:#475569;text-align:center}.mh-rpg-stat-final{color:#f8fafc;font-weight:1000;text-align:right}.mh-rpg-stat button{min-height:40px;border-radius:9px;background:#1e293b;color:#e2e8f0;font-size:15px;font-weight:900}.mh-rpg-stat button:disabled{opacity:.28}.mh-rpg-stat em{color:#fbbf24;font-style:normal;font-weight:900;text-align:center}.mh-rpg-enemy-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.mh-rpg-enemy-stats span{padding:5px 2px;border-radius:8px;background:#02061788;text-align:center}.mh-rpg-enemy-stats small{display:block;color:#94a3b8;font-size:7px;font-weight:900}.mh-rpg-enemy-stats b{font-size:12px}.mh-rpg-skill{margin-top:6px;color:#a5b4fc;font-size:8px;font-weight:900}.mh-rpg-toggle{width:100%;min-height:56px;padding:8px 12px;border:2px solid #334155;border-radius:14px;background:#0f172acc;color:#cbd5e1;font-size:12px;font-weight:1000;text-align:left}.mh-rpg-toggle.active{border-color:#fbbf24;color:#fde68a}.mh-rpg-toggle small{display:block;margin-top:3px;color:#94a3b8;font-size:8px;font-weight:700}.mh-rpg-footer{flex:none;padding:8px 10px calc(4px + env(safe-area-inset-bottom));background:linear-gradient(transparent,#04121b 30%)}.mh-rpg-footer button{display:block;width:100%;min-height:50px;margin-top:6px;border-radius:16px;background:linear-gradient(90deg,#059669,#0284c7);font-size:13px;font-weight:1000}.mh-rpg-footer button.sub{min-height:44px;background:#1e293b;color:#cbd5e1;font-size:11px}.mh-rpg-bar{height:5px;margin:2px 0 1px;border-radius:999px;background:#020617;overflow:hidden}.mh-rpg-bar i{display:block;height:100%;border-radius:999px}.mh-rpg-bar.hp i{background:linear-gradient(90deg,#f43f5e,#fb7185)}.mh-rpg-bar.guts i{background:linear-gradient(90deg,#d97706,#fde047)}.mh-rpg-result-turn{margin:6px 0;color:#fde68a;font-size:12px;font-weight:1000;text-align:center}.mh-rpg-result-table{border:1px solid #ffffff1a;border-radius:12px;overflow:hidden}.mh-rpg-result-row{display:grid;grid-template-columns:1.45fr 1.15fr 1fr 1fr .62fr .62fr .8fr .62fr .62fr;gap:1px;padding:6px 3px;font-size:8px;border-top:1px solid #ffffff12}.mh-rpg-result-row:first-child{border-top:0}.mh-rpg-result-row.head{background:#02061799;color:#6ee7b7;font-weight:1000;font-size:7px}.mh-rpg-result-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mh-rpg-battle{position:relative;padding-top:env(safe-area-inset-top);background:radial-gradient(circle at 50% 24%,#3b2b6b 0,#131033 42%,#04060f 82%)}.mh-rpg-hud{flex:none;display:flex;align-items:center;gap:6px;min-height:34px;padding:3px 6px;background:#0f172a;border-bottom:1px solid #ffffff0d}.mh-rpg-hud-tag{padding:2px 6px;border:1px solid #a78bfa88;border-radius:6px;background:#4c1d9522;color:#c4b5fd;font:1000 8px monospace;letter-spacing:.12em;white-space:nowrap}.mh-rpg-hud-turn{color:#60a5fa;font:1000 10px monospace;letter-spacing:.12em;white-space:nowrap}.mh-rpg-hud-step{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;color:#fbbf24;font:900 9px monospace}.mh-rpg-hud>button{flex:none;width:30px;height:30px;border-radius:8px;background:#1e293b;color:#94a3b8;font-size:13px;font-weight:900}.mh-rpg-order{flex:none;display:flex;align-items:center;gap:6px;padding:4px 8px}.mh-rpg-order>b{flex:none;white-space:nowrap;color:#94a3b8;font-size:8px;font-weight:900;letter-spacing:.06em}.mh-rpg-order-list{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:3px}.mh-rpg-order-chip{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:1px;border:2px solid #38bdf8;border-radius:50%;background:#0c4a6e88;overflow:hidden}.mh-rpg-order-chip.enemy{border-color:#f87171;border-radius:7px;background:#450a0a99}.mh-rpg-order-chip.done{opacity:.3}.mh-rpg-order-chip.current{box-shadow:0 0 0 2px #fbbf24,0 0 10px #fbbf24aa;transform:scale(1.14)}.mh-rpg-order-chip img{width:100%;height:100%;object-fit:cover;border-radius:50%}.mh-rpg-order-chip.enemy img{border-radius:4px}.mh-rpg-field{flex:1;min-height:0;display:grid;align-content:safe center;justify-items:center;gap:6px;padding:2px 8px;overflow-y:auto;-webkit-overflow-scrolling:touch}.mh-rpg-field[data-count="1"]{grid-template-columns:1fr}.mh-rpg-field[data-count="2"]{grid-template-columns:repeat(2,1fr)}.mh-rpg-field[data-count="3"]{grid-template-columns:repeat(3,1fr)}.mh-rpg-field[data-count="4"]{grid-template-columns:repeat(4,1fr)}.mh-rpg-foe{position:relative;width:100%;min-width:0;padding:0;background:transparent;text-align:center}.mh-rpg-foe.down{opacity:.34;filter:grayscale(.7)}.mh-rpg-foe-ring{position:relative;display:flex;align-items:center;justify-content:center;margin:0 auto;border:4px solid var(--rpg-foe-ring,#ef4444);border-radius:50%;background:radial-gradient(circle at 50% 35%,#00000055,#020617ee);box-shadow:0 0 26px var(--rpg-foe-ring,#ef4444),inset 0 0 20px #000000aa}.mh-rpg-foe-ring img{object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,.8))}.mh-rpg-field[data-count="1"] .mh-rpg-foe-ring{width:clamp(140px,34vw,210px);height:clamp(140px,34vw,210px)}.mh-rpg-field[data-count="1"] .mh-rpg-foe-ring img{width:80%;height:80%}.mh-rpg-field[data-count="2"] .mh-rpg-foe-ring{width:min(42vw,180px);height:min(42vw,180px)}.mh-rpg-field[data-count="2"] .mh-rpg-foe-ring img{width:80%;height:80%}.mh-rpg-field[data-count="3"] .mh-rpg-foe-ring{width:min(28vw,138px);height:min(28vw,138px)}.mh-rpg-field[data-count="3"] .mh-rpg-foe-ring img{width:82%;height:82%}.mh-rpg-field[data-count="4"] .mh-rpg-foe-ring{width:min(21.5vw,112px);height:min(21.5vw,112px)}.mh-rpg-field[data-count="4"] .mh-rpg-foe-ring img{width:82%;height:82%}.mh-rpg-foe.auto .mh-rpg-foe-ring,.mh-rpg-foe.aimed .mh-rpg-foe-ring{border-color:#fbbf24;box-shadow:0 0 22px #fbbf24cc,inset 0 0 18px #00000099}.mh-rpg-foe.aimed .mh-rpg-foe-ring{animation:rpgTargetPulse 900ms ease-in-out infinite}.mh-rpg-aim-mark{position:absolute;left:-2px;bottom:-2px;font-size:15px;filter:drop-shadow(0 1px 3px #000)}.mh-rpg-aim{display:flex;align-items:center;gap:5px;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#94a3b8;font-size:9px;font-weight:900}.mh-rpg-aim b{color:#fde68a;font-size:11px;font-weight:1000}.mh-rpg-aim small{color:#64748b;font-size:8px;font-weight:700}.mh-rpg-aim.fixed b{color:#fbbf24}.mh-rpg-foe b{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:1000;text-shadow:0 1px 4px #000}.mh-rpg-field[data-count="4"] .mh-rpg-foe b{font-size:8px}.mh-rpg-field[data-count="4"] .mh-rpg-foe-hp{font-size:7px}.mh-rpg-foe-hp{display:block;color:#fca5a5;font:900 8px ui-monospace,monospace}.mh-rpg-foe .mh-rpg-bar{margin:2px 4px 1px}.mh-rpg-foe-fx{position:absolute;left:50%;top:12%;transform:translateX(-50%);z-index:6;pointer-events:none;white-space:nowrap}.mh-rpg-member-fx{position:absolute;right:4px;bottom:calc(100% + 6px);z-index:6;pointer-events:none;white-space:nowrap}.mh-rpg-hit{display:inline-block;padding:2px 9px;border:1px solid #ffffff33;border-radius:10px;background:#020617ee;color:#fb7185;font-size:19px;font-weight:1000;text-shadow:0 0 3px #000,0 2px 7px #000;animation:rpgHitPop 900ms ease-out forwards}.mh-rpg-hit i{display:block;margin-bottom:-3px;font-style:normal;font-size:9px;font-weight:1000;letter-spacing:.12em;color:#fbbf24;text-align:center}.mh-rpg-hit.crit{color:#fde047;font-size:23px;border-color:#fde04788;text-shadow:0 0 4px #000,0 0 12px #f59e0bcc}.mh-rpg-hit.miss{color:#7dd3fc;font-size:16px}.mh-rpg-hit.down{border-color:#d8b4fe;box-shadow:0 0 14px #a855f7aa}.mh-rpg-field[data-count="4"] .mh-rpg-hit{font-size:16px;padding:1px 6px}.mh-rpg-field[data-count="4"] .mh-rpg-hit.crit{font-size:19px}.mh-rpg-field[data-count="4"] .mh-rpg-hit.miss{font-size:14px}.mh-rpg-down-mark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#f87171;font-size:34px;font-weight:1000;text-shadow:0 2px 6px #000}.mh-rpg-guard-mark{position:absolute;right:-2px;bottom:-2px;font-size:15px;filter:drop-shadow(0 1px 3px #000)}@keyframes rpgHitPop{0%{transform:translateY(12px) scale(.55);opacity:0}12%{transform:translateY(-3px) scale(1.3);opacity:1}22%{transform:translateY(-6px) scale(1);opacity:1}70%{transform:translateY(-9px) scale(1);opacity:1}100%{transform:translateY(-26px) scale(.94);opacity:0}}@keyframes rpgTargetPulse{0%,100%{box-shadow:0 0 16px #fbbf2488,inset 0 0 18px #00000099}50%{box-shadow:0 0 30px #fbbf24ee,inset 0 0 18px #00000099}}.mh-rpg-message{position:relative;flex:none;min-height:44px;margin:2px 8px;padding:5px 9px;border:1px solid #ffffff1a;border-radius:12px;background:#020617cc;font-size:10px;line-height:1.5}.mh-rpg-message p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b}.mh-rpg-message p.now{color:#f1f5f9;font-weight:900}.mh-rpg-message p.damage.now{color:#fda4af}.mh-rpg-message p.crit.now{color:#fde047}.mh-rpg-message p.miss.now{color:#7dd3fc}.mh-rpg-message p.down.now{color:#d8b4fe}.mh-rpg-message p.guard.now{color:#93c5fd}.mh-rpg-party{flex:none;display:grid;gap:4px;padding:2px 8px 4px}.mh-rpg-party[data-count="1"]{grid-template-columns:1fr}.mh-rpg-party[data-count="2"],.mh-rpg-party[data-count="3"],.mh-rpg-party[data-count="4"]{grid-template-columns:repeat(2,1fr)}.mh-rpg-member{position:relative;display:flex;align-items:center;gap:5px;width:100%;min-width:0;padding:4px;border:2px solid #1e293b;border-radius:12px;background:#0f172acc;color:inherit;font:inherit;text-align:left}.mh-rpg-member.undoable{border-color:#38bdf888;box-shadow:0 0 0 1px #0ea5e933}.mh-rpg-member.ready{border-color:#0ea5e955}.mh-rpg-member.active{border-color:#34d399;background:#065f4655;box-shadow:0 0 14px #34d39955}.mh-rpg-member.down{opacity:.34;filter:grayscale(.7)}.mh-rpg-member-face{position:relative;flex:none;width:38px;height:38px;border:2px solid #38bdf888;border-radius:50%;overflow:hidden;background:#020617}.mh-rpg-member.active .mh-rpg-member-face{border-color:#34d399}.mh-rpg-member-face img{width:100%;height:100%;object-fit:cover}.mh-rpg-member-body{flex:1;min-width:0}.mh-rpg-member-body b{display:flex;align-items:center;gap:4px;overflow:hidden;font-size:9px;font-weight:1000}.mh-rpg-member-body b em{flex:none;display:inline-flex;align-items:center;gap:2px;padding:1px 4px;border-radius:5px;background:#059669;color:#ecfdf5;font:1000 6px monospace;font-style:normal;letter-spacing:.08em}.mh-rpg-member-body b em.done{background:#0369a1;color:#e0f2fe;font-size:7px}.mh-rpg-member-body b em i{font-style:normal;font-size:8px}.mh-rpg-member-body small{display:block;color:#94a3b8;font-size:7px;font-weight:900}.mh-rpg-commands{position:relative;flex:none;min-height:98px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));background:#020617e6;border-top:1px solid #ffffff12}.mh-rpg-actor{display:flex;align-items:baseline;gap:6px;margin-bottom:4px;color:#a7f3d0;font-size:10px;font-weight:1000;overflow:hidden;white-space:nowrap}.mh-rpg-actor>span{min-width:0;overflow:hidden;text-overflow:ellipsis}.mh-rpg-actor>small{flex:none;margin-left:auto;color:#7dd3fc;font-size:8px;font-weight:900}.mh-rpg-wait{padding:14px 0;text-align:center;color:#fde68a;font-size:12px;font-weight:1000}.mh-rpg-command-row{display:flex;flex-wrap:wrap;gap:6px}.mh-rpg-command-row button{flex:1 1 28%;min-width:88px;min-height:58px;padding:2px;border-radius:14px;background:linear-gradient(#1e293b,#0f172a);border:2px solid #475569;font-size:12px;font-weight:1000;color:#f1f5f9;box-shadow:0 2px 0 #00000066}.mh-rpg-command-row button:disabled{opacity:.3}.mh-rpg-command-row small{display:block;margin-top:2px;color:#94a3b8;font-size:7px;font-weight:900}.mh-rpg-skill-panel{position:absolute;left:8px;right:8px;bottom:100%;margin-bottom:6px;max-height:44vh;overflow:hidden;display:flex;flex-direction:column;padding:8px;border:2px solid #6366f188;border-radius:14px;background:#020617f2;box-shadow:0 -6px 20px #000000aa}.mh-rpg-skill-list{flex:1;min-height:0;display:grid;align-content:start;gap:5px;overflow-y:auto;-webkit-overflow-scrolling:touch}.mh-rpg-skill{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:48px;padding:6px 10px;border:2px solid #6366f1;border-radius:12px;background:linear-gradient(#312e81,#1e1b4b);text-align:left}.mh-rpg-skill:disabled{opacity:.35}.mh-rpg-skill b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:1000}.mh-rpg-skill span{flex:none;color:#c7d2fe;font-size:8px;font-weight:900}.mh-rpg-cancel{width:100%;min-height:44px;border-radius:12px;background:#334155;font-size:11px;font-weight:900}.mh-rpg-counts .mh-rpg-vs{display:grid;grid-template-columns:38px 1fr;align-items:center;gap:5px}.mh-rpg-counts .mh-rpg-vs>b{color:#cbd5e1;font-size:10px;font-weight:1000;text-align:center}.mh-rpg-counts .mh-rpg-count{margin:0}@keyframes rpgAllyAttack{0%{transform:translateY(0) scale(1)}45%{transform:translateY(-26px) scale(1.16);filter:drop-shadow(0 0 8px rgba(250,204,21,.9))}60%{transform:translateY(-26px) scale(1.16)}100%{transform:translateY(0) scale(1)}}@keyframes rpgAllySpecial{0%{transform:translateY(7px) scale(.86)}30%{transform:translateY(7px) scale(.86);filter:drop-shadow(0 0 10px rgba(217,70,239,1))}62%{transform:translateY(-34px) scale(1.28);filter:drop-shadow(0 0 14px rgba(255,255,255,1))}100%{transform:translateY(0) scale(1)}}@keyframes rpgAllyFloat{0%{transform:translateY(0) scale(1)}50%{transform:translateY(-18px) scale(1.05) rotate(-4deg);filter:drop-shadow(0 0 8px rgba(255,255,255,.8))}78%{transform:translateY(4px) scale(1.22) rotate(2deg);filter:drop-shadow(0 8px 5px rgba(253,224,71,1))}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes rpgAllyWater{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-12px) scale(1.06);filter:drop-shadow(0 -8px 2px rgba(34,211,238,.8))}70%{transform:translateY(-26px) scale(1.12);filter:drop-shadow(0 12px 3px rgba(125,211,252,.85))}100%{transform:translateY(0) scale(1)}}@keyframes rpgAllyDash{0%{transform:translate(0,0) skewX(0)}22%{transform:translate(-14px,-4px) scale(1.08) skewX(16deg);filter:drop-shadow(10px 2px 0 rgba(34,211,238,.4))}48%{transform:translate(18px,-4px) scale(1.12) skewX(-18deg);filter:drop-shadow(-12px -2px 0 rgba(34,211,238,.4))}72%{transform:translate(-8px,-2px) scale(1.06) skewX(10deg)}100%{transform:translate(0,0) scale(1) skewX(0)}}@keyframes rpgFoeAttack{0%{transform:translateY(0) scale(1)}45%{transform:translateY(22px) scale(1.12);filter:drop-shadow(0 0 10px rgba(239,68,68,.9))}60%{transform:translateY(22px) scale(1.12)}100%{transform:translateY(0) scale(1)}}@keyframes rpgFoeSpecial{0%{transform:translateY(-8px) scale(.9)}30%{transform:translateY(-8px) scale(.9);filter:drop-shadow(0 0 12px rgba(217,70,239,1))}62%{transform:translateY(30px) scale(1.22);filter:drop-shadow(0 0 16px rgba(255,255,255,1))}100%{transform:translateY(0) scale(1)}}@keyframes rpgFoeFloat{0%{transform:translateY(0) scale(1)}50%{transform:translateY(16px) scale(1.05) rotate(4deg);filter:drop-shadow(0 0 8px rgba(255,255,255,.8))}78%{transform:translateY(-4px) scale(1.18) rotate(-2deg);filter:drop-shadow(0 -8px 5px rgba(253,224,71,1))}100%{transform:translateY(0) scale(1) rotate(0)}}@keyframes rpgFoeWater{0%{transform:translateY(0) scale(1)}40%{transform:translateY(10px) scale(1.05);filter:drop-shadow(0 8px 2px rgba(34,211,238,.8))}70%{transform:translateY(24px) scale(1.1);filter:drop-shadow(0 -10px 3px rgba(125,211,252,.85))}100%{transform:translateY(0) scale(1)}}@keyframes rpgFoeDash{0%{transform:translate(0,0) skewX(0)}22%{transform:translate(14px,4px) scale(1.06) skewX(-16deg);filter:drop-shadow(-10px -2px 0 rgba(34,211,238,.4))}48%{transform:translate(-16px,4px) scale(1.1) skewX(18deg);filter:drop-shadow(12px 2px 0 rgba(34,211,238,.4))}72%{transform:translate(8px,2px) scale(1.04) skewX(-10deg)}100%{transform:translate(0,0) scale(1) skewX(0)}}.mh-rpg-special{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:hidden}.mh-rpg-special-flash{position:absolute;inset:0;background:radial-gradient(circle at 50% 34%,#ffffffcc,#a855f766 34%,transparent 64%);animation:rpgSpecialFlash 520ms ease-out forwards}.mh-rpg-special.foe .mh-rpg-special-flash{background:radial-gradient(circle at 50% 66%,#ffffffcc,#ef444466 34%,transparent 64%)}.mh-rpg-special-band{position:absolute;left:0;right:0;bottom:calc(100% + 3px);z-index:20;padding:5px 12px;background:linear-gradient(90deg,transparent,#020617f2 14%,#020617f2 86%,transparent);border-top:2px solid #c084fc;border-bottom:2px solid #c084fc;text-align:center;animation:rpgSpecialBand 940ms cubic-bezier(.16,.9,.24,1) forwards}.mh-rpg-special-band.foe{border-color:#f87171}.mh-rpg-special-band b{display:block;overflow-wrap:anywhere;line-height:1.15;color:#fff;font-size:min(21px,6vw);font-weight:1000;letter-spacing:.04em;text-shadow:0 0 10px #c084fc,0 2px 8px #000}.mh-rpg-special-band.foe b{text-shadow:0 0 10px #f87171,0 2px 8px #000}.mh-rpg-special-band small{display:block;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#e9d5ff;font-size:10px;font-weight:900;letter-spacing:.1em}.mh-rpg-special-band.foe small{color:#fecaca}.mh-rpg-special-ring{position:absolute;inset:-8%;border:3px solid #c084fc;border-radius:50%;pointer-events:none;box-shadow:0 0 18px #a855f7cc;animation:rpgSpecialRing 620ms ease-out forwards}.mh-rpg-member.struck{animation:rpgSpecialStruck 620ms ease-out}.mh-rpg-field.shake,.mh-rpg-party.shake{animation:rpgSpecialShake 940ms ease-in-out}@keyframes rpgSpecialFlash{0%{opacity:0}16%{opacity:1}100%{opacity:0}}@keyframes rpgSpecialBand{0%{opacity:0;transform:scaleX(.12) scaleY(.5)}12%{opacity:1;transform:scaleX(1) scaleY(1.14)}20%{transform:scaleX(1) scaleY(1)}74%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-14px)}}@keyframes rpgSpecialRing{0%{transform:scale(.5);opacity:.95}100%{transform:scale(1.95);opacity:0}}@keyframes rpgSpecialStruck{0%,100%{box-shadow:none}20%{box-shadow:0 0 0 2px #f87171,0 0 18px #ef4444cc}60%{box-shadow:0 0 0 2px #f8717188,0 0 12px #ef444488}}@keyframes rpgSpecialShake{0%,100%{transform:translateX(0)}8%{transform:translateX(-4px)}18%{transform:translateX(4px)}28%{transform:translateX(-3px)}38%{transform:translateX(3px)}48%{transform:translateX(-2px)}58%{transform:translateX(1px)}}.mh-rpg-foe-ring,.mh-rpg-member-face{will-change:transform}
    `;
  document.head.appendChild(style);
};
createAnimationStyle();


// ==== GitHub Pages 用: グローバルからReact/フックを取得してレンダリング ====
const rootEl = document.getElementById('root');
const _root = ReactDOM.createRoot(rootEl);
// ルート直下にもエラー境界を置く(MonsterHeroGame 自体の描画で落ちたときは戻る先が無いので、読み込み直しだけを出す)
_root.render(React.createElement(MhErrorBoundary, { screen: 'root' }, React.createElement(MonsterHeroGame)));

// ==== 起動時: HTMLのローディング表示を消す ====
// 事前ロードの進捗表示はReact側の起動画面(bootPhase)が受け持つので、
// ここではHTMLに置いてある簡易ローディングを消すだけにする
try {
  const l=document.getElementById('loading'); if(l) l.style.display='none';
  const b=document.getElementById('ver-banner'); if(b) b.style.display='none';
} catch(e){ window.__mhErr && window.__mhErr('render tail: '+e.message); }
