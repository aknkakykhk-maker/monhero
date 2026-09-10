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
    @keyframes attackFly {
      0% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 6px rgba(250,204,21,0.5));
      }
      45% {
        transform: translateY(-180px) scale(1.35);
        filter: drop-shadow(0 0 20px rgba(250,204,21,0.9));
      }
      60% {
        transform: translateY(-180px) scale(1.35);
        filter: drop-shadow(0 0 25px rgba(220,38,38,1));
      }
      100% {
        transform: translateY(0) scale(1);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
    }
    /* パンドラ専用: 同じ本体画像2枚へ分かれ、両方から雷撃して再び中央へ戻る。 */
    .pandora-dual-thunder { position:relative; display:block; width:64px; height:64px; z-index:70; overflow:visible; pointer-events:none; }
    .pandora-dual-thunder img, .pandora-dual-thunder canvas { width:100%!important; height:100%!important; object-fit:contain; }
    .pandora-dual-center, .pandora-dual-clone { position:absolute; inset:0; display:block; }
    .pandora-dual-center { animation:pandoraDualCenter 900ms ease-in-out forwards; }
    .pandora-dual-clone { opacity:0; animation-duration:900ms; animation-timing-function:ease-in-out; animation-fill-mode:forwards; }
    .pandora-dual-clone--left { animation-name:pandoraDualLeft; }
    .pandora-dual-clone--right { animation-name:pandoraDualRight; }
    .pandora-dual-bolt { position:absolute; left:50%; top:4px; width:7px; height:142px; opacity:0; transform-origin:50% 100%; background:linear-gradient(to top,#c084fc,#fff 42%,#ddd6fe 72%,transparent); clip-path:polygon(45% 100%,0 69%,42% 70%,12% 42%,55% 47%,32% 0,100% 54%,59% 52%,91% 78%,55% 77%); filter:drop-shadow(0 0 5px #a855f7) drop-shadow(0 0 9px #fff); animation:pandoraDualBolt 900ms ease-out forwards; }
    .pandora-dual-clone--left .pandora-dual-bolt { transform:translate(-50%,-100%) rotate(8deg); }
    .pandora-dual-clone--right .pandora-dual-bolt { transform:translate(-50%,-100%) rotate(-8deg); }
    @keyframes pandoraDualCenter { 0%,18%{opacity:1;transform:scale(1)} 28%,78%{opacity:0;transform:scale(.9)} 90%,100%{opacity:1;transform:scale(1)} }
    @keyframes pandoraDualLeft { 0%,18%{opacity:0;transform:translateX(0) scale(1)} 27%{opacity:1} 38%,66%{opacity:1;transform:translateX(-42px) scale(.9)} 84%{opacity:1;transform:translateX(0) scale(.96)} 91%,100%{opacity:0;transform:translateX(0) scale(1)} }
    @keyframes pandoraDualRight { 0%,18%{opacity:0;transform:translateX(0) scale(1)} 27%{opacity:1} 38%,66%{opacity:1;transform:translateX(42px) scale(.9)} 84%{opacity:1;transform:translateX(0) scale(.96)} 91%,100%{opacity:0;transform:translateX(0) scale(1)} }
    @keyframes pandoraDualBolt { 0%,43%{opacity:0} 48%{opacity:1} 54%{opacity:.35} 59%{opacity:1} 67%,100%{opacity:0} }
    .pandora-dual-thunder--compact { width:38px; height:38px; }
    .pandora-dual-thunder--compact .pandora-dual-clone--left { --pandora-compact:1; }
    .pandora-dual-thunder--compact .pandora-dual-bolt { height:82px; width:5px; }
    .pandora-dual-thunder--compact .pandora-dual-clone--left { animation-name:pandoraDualLeftCompact; }
    .pandora-dual-thunder--compact .pandora-dual-clone--right { animation-name:pandoraDualRightCompact; }
    @keyframes pandoraDualLeftCompact { 0%,18%{opacity:0;transform:translateX(0) scale(1)} 27%{opacity:1} 38%,66%{opacity:1;transform:translateX(-25px) scale(.9)} 84%{opacity:1;transform:translateX(0) scale(.96)} 91%,100%{opacity:0} }
    @keyframes pandoraDualRightCompact { 0%,18%{opacity:0;transform:translateX(0) scale(1)} 27%{opacity:1} 38%,66%{opacity:1;transform:translateX(25px) scale(.9)} 84%{opacity:1;transform:translateX(0) scale(.96)} 91%,100%{opacity:0} }
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
    @keyframes waterBurstAttack {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(103,232,249,.5)); }
      10% { transform:translate3d(0,8px,0) scale(.95,.88) rotate(-2deg); filter:drop-shadow(0 0 15px rgba(34,211,238,.9)); }
      25% { transform:translate3d(-44px,-2px,0) scale(1.07) rotate(-7deg); filter:drop-shadow(24px 5px 0 rgba(125,211,252,.42)) drop-shadow(48px 8px 0 rgba(37,99,235,.18)) drop-shadow(0 0 22px rgba(103,232,249,.98)); }
      48% { transform:translate3d(46px,-8px,0) scale(1.10) rotate(7deg); filter:drop-shadow(-28px 4px 0 rgba(125,211,252,.42)) drop-shadow(-56px 8px 0 rgba(37,99,235,.18)) drop-shadow(0 0 27px rgba(255,255,255,.98)); }
      69% { transform:translate3d(-32px,-10px,0) scale(1.08) rotate(-5deg); filter:drop-shadow(24px 4px 0 rgba(103,232,249,.34)) drop-shadow(48px 7px 0 rgba(37,99,235,.15)) drop-shadow(0 0 23px rgba(34,211,238,.94)); }
      84% { transform:translate3d(20px,-4px,0) scale(1.04) rotate(3deg); filter:drop-shadow(-18px 3px 0 rgba(125,211,252,.28)) drop-shadow(0 0 17px rgba(103,232,249,.82)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    @keyframes waterBurstLunge {
      0% { transform:translate3d(0,16px,0) scale(.88,.80) rotate(0deg); filter:drop-shadow(0 0 28px rgba(34,211,238,.95)); }
      18% { transform:translate3d(-52px,-4px,0) scale(1.11) rotate(-9deg); filter:drop-shadow(28px 5px 0 rgba(125,211,252,.5)) drop-shadow(58px 9px 0 rgba(37,99,235,.22)) drop-shadow(0 0 28px rgba(255,255,255,.98)); }
      43% { transform:translate3d(52px,-13px,0) scale(1.16) rotate(9deg); filter:drop-shadow(-32px 4px 0 rgba(125,211,252,.5)) drop-shadow(-64px 9px 0 rgba(37,99,235,.22)) drop-shadow(0 0 34px rgba(255,255,255,1)); }
      67% { transform:translate3d(-38px,-12px,0) scale(1.11) rotate(-6deg); filter:drop-shadow(28px 4px 0 rgba(103,232,249,.42)) drop-shadow(0 0 29px rgba(34,211,238,.98)); }
      84% { transform:translate3d(24px,-5px,0) scale(1.06) rotate(4deg); filter:drop-shadow(-20px 3px 0 rgba(125,211,252,.34)) drop-shadow(0 0 21px rgba(103,232,249,.9)); }
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
    @keyframes waterBurstShot {
      0% { opacity:0; transform:translate3d(-50%,18px,0) rotate(var(--water-shot-angle)) scale(.45,.72); }
      14% { opacity:1; }
      72% { opacity:1; transform:translate3d(calc(-50% + var(--water-shot-x)),var(--water-shot-y),0) rotate(var(--water-shot-angle)) scale(1.12,1.28); }
      100% { opacity:0; transform:translate3d(calc(-50% + var(--water-shot-x)),calc(var(--water-shot-y) - 16px),0) rotate(var(--water-shot-angle)) scale(.72,1.5); }
    }
    .water-burst-motion__impact {
      position:absolute; left:50%; top:-92px; width:30px; height:30px; margin:-15px 0 0 -15px;
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
      0%,63% { opacity:0; transform:scale(.18); }
      66% { opacity:1; transform:scale(.62); }
      74% { opacity:1; transform:scale(1.25); }
      84% { opacity:.78; transform:scale(1.85); }
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
    /* 歌う本体。少し前(上)へ出て、上下と左右で拍を取ってから元位置へ戻る */
    @keyframes miaSongSing {
      0% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 5px rgba(244,114,182,.5)); }
      12% { transform:translate3d(0,-9px,0) scale(1.05) rotate(0deg); filter:drop-shadow(0 0 16px rgba(244,114,182,.92)); }
      28% { transform:translate3d(-7px,-3px,0) scale(1.03) rotate(-4deg); filter:drop-shadow(0 0 20px rgba(236,72,153,.95)); }
      44% { transform:translate3d(7px,-13px,0) scale(1.07) rotate(4deg); filter:drop-shadow(0 0 24px rgba(255,255,255,.96)); }
      60% { transform:translate3d(-6px,-4px,0) scale(1.03) rotate(-3deg); filter:drop-shadow(0 0 20px rgba(192,132,252,.94)); }
      76% { transform:translate3d(6px,-11px,0) scale(1.06) rotate(3deg); filter:drop-shadow(0 0 22px rgba(244,114,182,.9)); }
      90% { transform:translate3d(0,-4px,0) scale(1.02) rotate(0deg); filter:drop-shadow(0 0 12px rgba(244,114,182,.6)); }
      100% { transform:translate3d(0,0,0) scale(1) rotate(0deg); filter:drop-shadow(0 0 0 rgba(0,0,0,0)); }
    }
    /* 固有技のタメ明け。沈んだ位置から立ち上がり、通常より大きく歌う */
    @keyframes miaSongSingLunge {
      0% { transform:translate3d(0,16px,0) scale(.88,.80) rotate(0deg); filter:drop-shadow(0 0 28px rgba(236,72,153,.95)); }
      14% { transform:translate3d(0,-14px,0) scale(1.12) rotate(0deg); filter:drop-shadow(0 0 30px rgba(255,255,255,.98)); }
      30% { transform:translate3d(-10px,-5px,0) scale(1.08) rotate(-6deg); filter:drop-shadow(0 0 26px rgba(236,72,153,.98)); }
      46% { transform:translate3d(10px,-18px,0) scale(1.13) rotate(6deg); filter:drop-shadow(0 0 32px rgba(255,255,255,1)); }
      62% { transform:translate3d(-8px,-6px,0) scale(1.08) rotate(-5deg); filter:drop-shadow(0 0 27px rgba(192,132,252,.98)); }
      78% { transform:translate3d(8px,-15px,0) scale(1.1) rotate(4deg); filter:drop-shadow(0 0 25px rgba(244,114,182,.94)); }
      92% { transform:translate3d(0,-5px,0) scale(1.03) rotate(0deg); filter:drop-shadow(0 0 13px rgba(244,114,182,.62)); }
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
      position:absolute; left:11%; bottom:2%; width:21%; height:56%; z-index:6;
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
    .mia-song-notes__mic-head {
      position:absolute; left:50%; top:0; width:100%; height:34%; margin-left:-50%;
      border-radius:50% 50% 46% 46%;
      background:radial-gradient(circle at 34% 28%,#fff 0 14%,#e2e8f0 32%,#94a3b8 62%,#475569 100%);
      border:1px solid rgba(255,255,255,.9);
      box-shadow:0 0 9px rgba(244,114,182,.95),0 0 18px rgba(236,72,153,.7);
    }
    .mia-song-notes__mic-pole {
      position:absolute; left:50%; top:30%; width:14%; height:64%; margin-left:-7%;
      border-radius:999px;
      background:linear-gradient(90deg,#64748b,#f1f5f9 42%,#cbd5e1 62%,#475569);
      box-shadow:0 0 7px rgba(226,232,240,.75);
    }
    .mia-song-notes__mic-base {
      position:absolute; left:50%; bottom:0; width:150%; height:11%; margin-left:-75%;
      border-radius:50%;
      background:linear-gradient(180deg,#e2e8f0,#475569);
      box-shadow:0 0 10px rgba(236,72,153,.8);
    }
    /* 敵へ飛ぶ音符。4つを時間差・別々の高さと大きさで流す */
    .mia-song-notes__notes { position:absolute; inset:0; overflow:visible; z-index:7; }
    .mia-song-notes__note {
      position:absolute; top:38%; opacity:0; font-style:normal; font-weight:900; line-height:1;
      text-shadow:0 0 6px #fff,0 0 14px rgba(236,72,153,.95),0 0 26px rgba(168,85,247,.75);
      will-change:transform,opacity; animation:miaSongNoteFly 460ms cubic-bezier(.14,.72,.22,1) forwards;
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
      15% { opacity:1; transform:translate3d(-50%,0,0) rotate(calc(var(--mia-note-spin) * .3)) scale(1.05); }
      70% { opacity:1; transform:translate3d(calc(-50% + var(--mia-note-x)),calc(var(--mia-note-y) * .78),0) rotate(var(--mia-note-spin)) scale(1.18); }
      100% { opacity:0; transform:translate3d(calc(-50% + var(--mia-note-x)),var(--mia-note-y),0) rotate(var(--mia-note-spin)) scale(.82); }
    }
    /* 敵側の着弾。音の輪を2度ひろげ、光とキラキラで当たったことを分かるようにする */
    .mia-song-notes__impact {
      position:absolute; left:50%; top:-92px; width:30px; height:30px; margin:-15px 0 0 -15px; z-index:8;
    }
    .mia-song-notes__impact-core {
      position:absolute; inset:-52px; border-radius:50%; opacity:0;
      background:radial-gradient(circle,rgba(255,255,255,1) 0 8%,rgba(251,207,232,.98) 18%,rgba(236,72,153,.66) 36%,rgba(168,85,247,.34) 54%,rgba(168,85,247,0) 76%);
      filter:blur(.4px); animation:miaSongImpactCore 760ms ease-out forwards;
    }
    @keyframes miaSongImpactCore {
      0%,40% { opacity:0; transform:scale(.2); }
      46% { opacity:1; transform:scale(.7); }
      62% { opacity:1; transform:scale(1.25); }
      82% { opacity:.72; transform:scale(1.75); }
      100% { opacity:0; transform:scale(2.2); }
    }
    .mia-song-notes__impact-ring {
      position:absolute; inset:-22px; border:4px solid rgba(253,242,248,.96); border-radius:50%; opacity:0;
      box-shadow:0 0 12px #fff,0 0 24px rgba(236,72,153,.95),0 0 40px rgba(168,85,247,.7);
      animation:miaSongImpactRing 340ms ease-out forwards; animation-delay:400ms;
    }
    .mia-song-notes__impact-ring--late { animation-delay:600ms; border-color:rgba(233,213,255,.94); }
    @keyframes miaSongImpactRing {
      0% { opacity:0; transform:scale(.3); }
      24% { opacity:1; transform:scale(.9); }
      100% { opacity:0; transform:scale(2.15); }
    }
    .mia-song-notes__spark {
      position:absolute; left:50%; top:50%; margin:-3px 0 0 -3px; opacity:0; border-radius:50%;
      background:radial-gradient(circle,#fff 0 34%,rgba(244,114,182,.95) 62%,rgba(168,85,247,0) 100%);
      box-shadow:0 0 8px rgba(255,255,255,.95);
      animation:miaSongSpark 300ms ease-out forwards; animation-delay:calc(455ms + var(--mia-spark-delay));
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
      .mia-song-notes__stage i, .mia-song-notes__spark { display:none; }
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
       その場で小さく振る旧演出ではなく、いったん沈んでから敵位置まで高速で斬り込み、
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
        transform: translate3d(68px,-116px,0) scale(1.11) rotate(-13deg) skewX(-8deg);
        filter:
          drop-shadow(-28px 42px 0 rgba(139,92,246,.34))
          drop-shadow(-54px 78px 0 rgba(139,92,246,.16))
          drop-shadow(0 0 22px rgba(196,181,253,.98));
      }
      36% {
        transform: translate3d(-86px,-188px,0) scale(1.17) rotate(17deg) skewX(10deg);
        filter:
          drop-shadow(38px 8px 0 rgba(139,92,246,.38))
          drop-shadow(82px 24px 0 rgba(139,92,246,.16))
          drop-shadow(0 0 28px rgba(255,255,255,.98));
      }
      47% {
        transform: translate3d(-92px,-178px,0) scale(.98) rotate(10deg) skewX(0deg);
        filter: drop-shadow(0 0 16px rgba(139,92,246,.72));
      }
      59% {
        transform: translate3d(-58px,-126px,0) scale(1.08) rotate(12deg) skewX(7deg);
        filter:
          drop-shadow(30px 38px 0 rgba(34,211,238,.32))
          drop-shadow(58px 72px 0 rgba(34,211,238,.14))
          drop-shadow(0 0 22px rgba(103,232,249,.95));
      }
      72% {
        transform: translate3d(90px,-188px,0) scale(1.17) rotate(-18deg) skewX(-10deg);
        filter:
          drop-shadow(-40px 8px 0 rgba(34,211,238,.4))
          drop-shadow(-84px 24px 0 rgba(34,211,238,.17))
          drop-shadow(0 0 30px rgba(255,255,255,1));
      }
      78%, 86% {
        transform: translate3d(0,-170px,0) scale(1.12) rotate(0deg) skewX(0deg);
        filter: drop-shadow(0 0 30px rgba(255,255,255,1)) drop-shadow(0 0 42px rgba(103,232,249,.75));
      }
      93% {
        transform: translate3d(0,-54px,0) scale(1.04) rotate(0deg);
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
    @keyframes zanComboDash {
      0% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 4px rgba(34,211,238,0.4));
      }
      18% {
        transform: translate(-100px,-14px) scale(1.08) skewX(18deg);
        filter: drop-shadow(48px 6px 0 rgba(34,211,238,0.35)) drop-shadow(84px 10px 0 rgba(34,211,238,0.16)) drop-shadow(0 0 14px rgba(34,211,238,0.9));
      }
      40% {
        transform: translate(150px,-8px) scale(1.15) skewX(-22deg);
        filter: drop-shadow(-70px -4px 0 rgba(34,211,238,0.32)) drop-shadow(-130px -8px 0 rgba(34,211,238,0.15)) drop-shadow(0 0 24px rgba(255,255,255,0.95));
      }
      58% {
        transform: translate(-70px,-4px) scale(1.1) skewX(14deg);
        filter: drop-shadow(36px 3px 0 rgba(34,211,238,0.28)) drop-shadow(0 0 20px rgba(34,211,238,0.9));
      }
      78% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 24px rgba(255,255,255,0.9));
      }
      100% {
        transform: translate(0,0) scale(1) skewX(0deg);
        filter: drop-shadow(0 0 0 rgba(0,0,0,0));
      }
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
    @keyframes specialLunge {
      0% { transform: translateY(44px) scale(0.78) rotate(-4deg); filter: drop-shadow(0 0 26px rgba(217,70,239,1)); }
      35% { transform: translateY(-220px) scale(1.5) rotate(4deg); filter: drop-shadow(0 0 34px rgba(217,70,239,1)); }
      55% { transform: translateY(-220px) scale(1.5); filter: drop-shadow(0 0 40px rgba(255,255,255,1)); }
      100% { transform: translateY(0) scale(1) rotate(0deg); filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
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
    @keyframes specialThrob {
      0%,100% { transform: scale(1); filter: drop-shadow(0 0 12px rgba(251,191,36,0.9)); }
      50% { transform: scale(1.25); filter: drop-shadow(0 0 22px rgba(239,68,68,1)); }
    }
    @keyframes idleExclaim {
      0%,100% { transform: scale(0.95) translateY(0) rotate(-4deg); opacity: 0.85; }
      50% { transform: scale(1.18) translateY(-3px) rotate(4deg); opacity: 1; }
    }
    @keyframes idleAuraPulse {
      0%,100% { transform: scale(0.92); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.85; }
    }
    @keyframes idleSpark {
      0%,100% { opacity: 0.15; }
      50% { opacity: 0.9; }
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
    .mh-home-scene{position:relative;isolation:isolate;flex:1;min-height:0;overflow:hidden;background:#263f35;color:#fff}.mh-home-background{position:absolute;z-index:-2;inset:0;display:block;opacity:0;transition:opacity .45s ease;background:#263f35;pointer-events:none}.mh-home-background.is-ready{opacity:1}.mh-home-background img{display:block;width:100%;height:100%;object-fit:contain;object-position:50% 50%}.mh-home-masumon-layer{position:absolute;z-index:0;left:18%;right:18%;top:34%;bottom:29%;pointer-events:none}.mh-home-masumon{position:absolute;width:clamp(48px,14vw,72px);aspect-ratio:1;transform:translate(-50%,-72%);transition-property:left,top;transition-timing-function:linear;will-change:left,top}.mh-home-masumon-bob{position:relative;width:100%;height:100%;transform-origin:center bottom}.mh-home-masumon-bob>div:first-child,.mh-home-masumon-bob>img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 5px 4px #0008)}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:mhHomeMasumonWalk .42s ease-in-out infinite}.mh-home-masumon-stars{position:absolute;left:0;right:0;bottom:1px;color:#fde68a;text-shadow:0 1px 3px #000}.mh-home-status{position:relative;z-index:5;display:flex;gap:7px;justify-content:space-between;padding:calc(8px + env(safe-area-inset-top)) 9px 0;pointer-events:none}.mh-home-player,.mh-home-wallet{border:1px solid #f7df9a88;background:#102522e8;box-shadow:0 4px 14px #071613cc,inset 0 1px #fff3;backdrop-filter:blur(3px);pointer-events:auto}.mh-home-player{display:flex;align-items:center;gap:6px;min-width:0;flex:1;padding:5px;border-radius:14px;text-align:left;color:#fff;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-player:active{transform:scale(.97);filter:brightness(1.2);box-shadow:0 0 18px #f5d879aa}.mh-home-profile-arrow{flex:0 0 auto;color:#f8dc8d}.mh-home-avatar{flex:0 0 40px;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#ffe18c;background:#142728;border:2px solid #eaca72}.mh-home-avatar>span{width:100%;height:100%}.mh-home-player-copy{min-width:0;flex:1}.mh-home-player-copy strong{display:block;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.mh-home-player-copy span{display:block;color:#f8dc8d;font-size:7px;font-weight:900}.mh-home-player-copy small{display:block;text-align:right;color:#d7e3dc;font:6px monospace}.mh-home-xp{height:4px;margin-top:2px;overflow:hidden;border-radius:9px;background:#071b1c}.mh-home-xp i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#5dd79c,#f5e16d)}.mh-home-wallet{display:grid;grid-template-columns:auto 43px;grid-template-rows:1fr 1fr;width:139px;padding:4px;border-radius:14px}.mh-home-wallet>div{display:grid;grid-template-columns:14px 1fr auto;align-items:center;gap:2px;padding:1px 3px;color:#ffe08a}.mh-home-wallet>div b{font-size:8px;text-align:right}.mh-home-wallet>div small{font-size:6px;color:#f4e7c3}.mh-home-wallet>button{grid-column:2;grid-row:1/3;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #fff2;color:#fce6ab;font-size:7px;font-weight:900;min-width:42px}.mh-home-facilities{position:absolute;z-index:3;inset:0;pointer-events:none}.mh-home-facility{position:absolute;pointer-events:auto;border:0;background:transparent;color:#fff;touch-action:manipulation}.mh-home-facility>span{position:absolute;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 13px;border:2px solid #ffe6a7a8;border-radius:14px;background:#10211df2;box-shadow:0 3px 12px #0009,inset 0 0 12px #ffe09822;text-shadow:0 2px 4px #000;font-size:11px;font-weight:1000;white-space:nowrap;transition:transform .1s,filter .1s,box-shadow .1s}.mh-home-facility:active>span{transform:scale(.92);filter:brightness(1.4);box-shadow:0 0 22px #ffe7a8}.mh-home-facility.management{left:0;top:14%;width:42%;height:34%}.mh-home-facility.management>span{left:6%;top:37%;border-color:#67e8f9dd;background:linear-gradient(135deg,#082f49f2,#123b3cf2);box-shadow:0 3px 12px #0009,0 0 15px #22d3ee66,inset 0 0 12px #38bdf833}.mh-home-facility.temple{right:0;top:14%;width:42%;height:34%}.mh-home-facility.temple>span{right:7%;top:35%;border-color:#d8b4fedd;background:linear-gradient(135deg,#2e1065f2,#44301cf2);box-shadow:0 3px 12px #0009,0 0 15px #c084fc66,inset 0 0 12px #fbbf2433}.mh-home-facility.market{right:0;top:45%;width:39%;height:30%}.mh-home-facility.market>span{right:5%;top:40%;border-color:#86efacdd;background:linear-gradient(135deg,#052e24f2,#3b3518f2);box-shadow:0 3px 12px #0009,0 0 15px #4ade8066,inset 0 0 12px #facc1533}.mh-home-facility.battle{left:16%;right:16%;bottom:0;height:31%}.mh-home-facility.battle>span{left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);min-width:156px;padding:10px 17px;border:2px solid #ffe3a8;border-radius:18px;background:linear-gradient(135deg,#4c1d95e8,#8b301ae8);box-shadow:0 0 23px #c084fcbb,inset 0 0 20px #ffcb6255;font-size:20px;letter-spacing:.08em;animation:mhHomeBattlePulse 2.3s ease-in-out infinite}.mh-home-facility.battle>span small{font-size:7px;letter-spacing:0;color:#ffe4b2}.mh-home-facility.battle:active>span{transform:translateX(-50%) scale(.94)}.mh-home-gift{position:absolute;z-index:5;right:5%;top:73%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #67e8f9aa;border-radius:13px;background:#083344e8;color:#cffafe;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-gift em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-gift:active{transform:scale(.94);filter:brightness(1.25)}.mh-home-update{position:absolute;z-index:5;right:9px;top:calc(69px + env(safe-area-inset-top));display:flex;align-items:center;gap:4px;min-height:32px;padding:6px 11px;border:1px solid #eed995aa;border-radius:13px;background:#102c29e8;color:#f9eac2;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-update:active{transform:scale(.94);filter:brightness(1.25)}.mh-management-link{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;min-height:64px;padding:16px;border:1px solid #818cf877;border-radius:16px;background:#172554aa;color:#fff;font-weight:900;box-shadow:0 5px 16px #0005}.mh-management-link:active{transform:scale(.98);filter:brightness(1.2)}.mh-temple-link{border-color:#a78bfa99;background:#2e1065aa}.mh-rebirth-stars{display:flex;justify-content:center;align-items:center;gap:0;font-size:8px;line-height:1;font-weight:1000;pointer-events:none}.mh-rainbow-breakthrough-star{display:block;width:1em;height:1em;object-fit:contain;transform:scale(1.07) translateY(-.06em)}.mh-rebirth-stars-overlay{position:absolute;left:0;right:0;bottom:1px}/* 転生した回数を示す「+N」バッジ。もとは合体の回数に使っていた見た目をそのまま移した */
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
       魂格Ⅴも常時アニメーションは付けず、静的な虹グラデーションだけにする。 */
    .mh-soul-rank-badge{position:absolute;right:-7px;top:-7px;z-index:7;display:flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 7px #fff5,0 1px 4px #020617;pointer-events:none}
    .mh-soul-rank-badge>b{display:block;color:#fff;font-size:9px;font-weight:1000;line-height:1;text-shadow:0 1px 2px #020617,0 0 3px #020617}
    .mh-soul-rank-badge.is-small{width:15px;height:15px;right:-8px;top:-8px;border-width:1px}.mh-soul-rank-badge.is-small>b{font-size:7px}
    .mh-soul-rank-badge.is-stage-1{background:linear-gradient(135deg,#1d4ed8,#60a5fa)}
    .mh-soul-rank-badge.is-stage-2{background:linear-gradient(135deg,#ca8a04,#fde047);color:#3f2a00}
    .mh-soul-rank-badge.is-stage-2>b{color:#3f2a00;text-shadow:0 1px 0 #fff8}
    .mh-soul-rank-badge.is-stage-3{background:linear-gradient(135deg,#15803d,#4ade80)}
    .mh-soul-rank-badge.is-stage-4{background:linear-gradient(135deg,#b91c1c,#fb7185)}
    .mh-soul-rank-badge.is-stage-5{background:conic-gradient(from 210deg,#f87171,#facc15,#4ade80,#60a5fa,#a78bfa,#f472b6,#f87171)}
    .mh-transcend-link{border-color:#fcd34daa;background:linear-gradient(135deg,#4c1d95aa,#78350faa)}
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

    .mh-reincarnation-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 48%,#172554 0,#0f172a 34%,#020617 70%);pointer-events:auto;touch-action:none}.mh-reincarnation-light{position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 48%,#fff 0,#fff8 24%,transparent 62%);opacity:0;pointer-events:none;animation:mhReincarnationLight 4s ease-out forwards}.mh-reincarnation-mon{position:relative;z-index:1;width:140px;height:140px;animation:mhReincarnationMon 4s ease-out forwards}.mh-reincarnate-aura.is-ceremony{inset:-48%;opacity:0;animation:mhReincarnationAura 4s cubic-bezier(.2,.75,.25,1) forwards}.mh-reincarnate-aura.is-ceremony .is-main{animation-duration:1.45s}.mh-reincarnate-aura.is-ceremony .is-back{animation-duration:1.8s}.mh-reincarnate-aura.is-ceremony .is-foot{animation-duration:1.1s}.mh-reincarnate-aura.is-ceremony img{filter:brightness(1.1) drop-shadow(0 0 8px #fff8)}.mh-reincarnation-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));z-index:4;display:flex;flex-direction:column;align-items:center;color:#e0f2fe;font-size:11px;font-weight:900;animation:mhReincarnationCopy 4s ease-out forwards}.mh-reincarnation-copy b{font-size:25px;color:#fff;text-shadow:0 0 12px #818cf8}.mh-reincarnation-copy span{margin-top:2px}@keyframes mhReincarnationLight{0%,43%{opacity:0}48%{opacity:.36}56%,100%{opacity:0}}@keyframes mhReincarnationMon{0%{opacity:1;transform:translateY(8px) scale(.96)}18%{transform:none}42%{transform:scale(1.02)}55%,100%{opacity:1;transform:none}}@keyframes mhReincarnationAura{0%,16%{opacity:0;transform:scale(.88)}30%{opacity:.86;transform:scale(1)}47%{opacity:1;transform:scale(1.13);filter:brightness(1.45)}64%{opacity:.9;transform:scale(1);filter:brightness(1)}100%{opacity:1;transform:scale(1);filter:brightness(1)}}@keyframes mhReincarnationCopy{0%,55%{opacity:0;transform:translateY(12px)}68%,88%{opacity:1;transform:none}100%{opacity:0}}@media(max-height:620px){.mh-reincarnation-copy{bottom:calc(4% + env(safe-area-inset-bottom))}}@media(prefers-reduced-motion:reduce){.mh-reincarnate-flame,.mh-reincarnate-sparks,.mh-reincarnate-sparks::before,.mh-reincarnate-sparks::after{animation:none}.mh-reincarnation-animation *{animation-duration:.01ms!important}}
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
    .mh-extreme-enemy-aura-shell{position:relative;display:inline-flex;align-items:center;justify-content:center;isolation:isolate;overflow:visible}.mh-extreme-enemy-aura-shell::before{content:"";position:absolute;z-index:0;inset:-38% -48% -22%;border-radius:44% 56% 48% 52%;pointer-events:none;background:radial-gradient(ellipse at 50% 62%,#050008ee 0 25%,#240034e8 38%,#581c87bb 52%,#a21caf88 64%,transparent 78%);filter:blur(7px);animation:mhExtremeEnemyMist 3.7s ease-in-out infinite;will-change:transform,opacity}.mh-extreme-enemy-aura-shell::after{content:"";position:absolute;z-index:2;left:-35%;right:-35%;bottom:-15%;height:35%;border-radius:50%;pointer-events:none;background:radial-gradient(ellipse,#140018ee 0 24%,#701a75cc 48%,#be185d88 62%,transparent 76%);filter:blur(5px);animation:mhExtremeEnemyFloor 3.1s ease-in-out infinite;will-change:transform,opacity}.mh-extreme-enemy-image{filter:drop-shadow(0 0 4px #030006) drop-shadow(0 0 9px #3b0764) drop-shadow(-7px -3px 13px #6b21a8ee) drop-shadow(8px 2px 15px #a21cafdd) drop-shadow(1px -7px 18px #be123caa);animation:mhExtremeEnemyAura 2.8s ease-in-out infinite;will-change:filter}
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
    .mh-rebirth-animation{position:fixed;inset:0;z-index:51000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle,#7c3aed88,#020617 62%);pointer-events:auto;touch-action:none}.mh-rebirth-circle{position:absolute;width:240px;height:240px;border:3px solid #c4b5fd;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fde68a;font-size:150px;animation:mhRebirthCircle 4s ease-in-out forwards}.mh-rebirth-glow{position:absolute;width:100%;height:42%;background:linear-gradient(90deg,transparent,#fff8,transparent);filter:blur(14px);animation:mhRebirthGlow 4s ease-in-out forwards}.mh-rebirth-mon{position:relative;width:145px;height:145px;animation:mhRebirthFloat 4s ease-in-out forwards}.mh-rebirth-copy{position:absolute;bottom:calc(8% + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;color:#fff;font-size:11px;font-weight:900;animation:mhRebirthCopy 4s ease-out forwards}.mh-rebirth-copy b{font-size:20px;color:#fde68a}.mh-rebirth-copy span{margin-top:2px}@keyframes mhRebirthCircle{0%{opacity:0;transform:scale(.3) rotate(0)}25%{opacity:1}100%{opacity:.25;transform:scale(1.5) rotate(180deg)}}@keyframes mhRebirthGlow{0%,20%{opacity:0}40%,70%{opacity:1}100%{opacity:0}}@keyframes mhRebirthFloat{0%{transform:translateY(30px);filter:brightness(1)}45%{transform:translateY(-25px);filter:brightness(2)}60%{filter:brightness(0)}78%{filter:brightness(3)}100%{transform:translateY(0);filter:brightness(1)}}@keyframes mhRebirthCopy{0%,55%{opacity:0;transform:translateY(20px)}68%,100%{opacity:1;transform:none}}.mh-donation-animation{position:fixed;inset:0;z-index:33000;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at center,#7c3aed55 0,#020617 58%);pointer-events:auto;touch-action:none}.mh-donation-beam{position:absolute;width:150px;height:110%;background:linear-gradient(90deg,transparent,#fff9c477,transparent);filter:blur(8px);animation:mhDonationBeam 1.5s ease-in-out forwards}.mh-donation-monster{position:absolute;width:96px;height:96px;filter:drop-shadow(0 0 22px #fff);animation:mhDonationRise 1.25s ease-in forwards}.mh-donation-gem{position:absolute;color:#fde68a;opacity:0;filter:drop-shadow(0 0 18px #fbbf24);animation:mhDonationGem .55s 1s ease-out forwards}.mh-donation-particles i{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;background:#fde68a;box-shadow:0 0 8px #fff;opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-20px);animation:mhDonationParticle .55s 1s ease-out forwards}.mh-donation-copy{position:absolute;bottom:calc(15% + env(safe-area-inset-bottom));font-size:14px;font-weight:1000;color:#f5d0fe;text-shadow:0 0 12px #a855f7}@keyframes mhDonationRise{0%{transform:translateY(25px) scale(1);opacity:1}55%{transform:translateY(-28px) scale(1.08);opacity:1}100%{transform:translateY(-55px) scale(.05);opacity:0;filter:drop-shadow(0 0 50px #fff)}}@keyframes mhDonationBeam{0%{opacity:0;transform:scaleX(.2)}35%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(.1)}}@keyframes mhDonationGem{to{opacity:1;transform:scale(1.2)}}@keyframes mhDonationParticle{0%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i)*45deg)) translateY(-95px) scale(.2)}}@keyframes mhHomeMasumonWalk{0%,100%{translate:0 0}50%{translate:0 -5px}}@keyframes mhHomeBattlePulse{50%{filter:brightness(1.16);box-shadow:0 0 34px #d8b4fddd,inset 0 0 26px #ffdc8366}}@media(max-width:350px){.mh-home-player-copy strong{max-width:80px}.mh-home-wallet{width:124px}.mh-home-facility>span{font-size:9px;padding:6px 8px}.mh-home-facility.battle>span{min-width:140px;font-size:18px}}@media(max-height:620px){.mh-home-facility.management,.mh-home-facility.temple{top:13%;height:32%}/* 背の低い端末では、みゅあの吹き出しがM/B管理の看板にかからないよう少し下げる */.mh-home-facility.management>span,.mh-home-facility.temple>span{top:45%}.mh-home-facility.market{top:43%}.mh-home-facility.battle{height:30%}}@media(prefers-reduced-motion:reduce){.mh-home-background,.mh-home-player,.mh-home-facility>span{transition:none}.mh-home-facility.battle>span{animation:none}.mh-home-masumon.is-walking .mh-home-masumon-bob{animation:none}}
    .mh-home-mission{position:absolute;z-index:5;right:5%;top:65%;display:flex;align-items:center;justify-content:center;gap:4px;width:112px;min-height:44px;padding:7px 8px;border:1px solid #fbbf24aa;border-radius:13px;background:#422006e8;color:#fef3c7;font-size:9px;font-weight:900;box-shadow:0 3px 8px #0007}.mh-home-mission em{display:flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 4px;border-radius:999px;background:#ef4444;color:#fff;font-style:normal;font-size:9px}.mh-home-mission:active{transform:scale(.94);filter:brightness(1.25)}/* はじめての案内で説明中の場所だけを明るく浮かび上がらせる。暗幕(z-index:90000)より前に出す。
   施設だけでなく、ミッション/ギフトの本体・みゅあの吹き出しも対象にする(そこも案内するため) */.is-tutorial-spot{z-index:90001}.mh-home-facility.is-tutorial-spot>span,.mh-home-mission.is-tutorial-spot,.mh-home-gift.is-tutorial-spot,.mh-home-assistant.is-tutorial-spot,.mh-home-settings.is-tutorial-spot{border-color:#fce7f3;filter:brightness(1.5) saturate(1.15);box-shadow:0 0 0 4px #f472b6,0 0 0 10px #f472b655,0 0 46px 12px #f472b6cc;animation:mhTutorialSpot 1.35s ease-in-out infinite}.mh-home-assistant.is-tutorial-spot{border-radius:18px}.mh-home-settings.is-tutorial-spot{position:relative;border-radius:11px}/* どこを指しているかが一目で分かるように、光る枠の上に矢印を出す */.mh-home-facility.is-tutorial-spot>span::before,.mh-home-mission.is-tutorial-spot::before,.mh-home-gift.is-tutorial-spot::before,.mh-home-assistant.is-tutorial-spot::before,.mh-home-settings.is-tutorial-spot::before{content:'▼';position:absolute;left:50%;bottom:100%;margin-bottom:5px;transform:translateX(-50%);color:#fbcfe8;font-size:19px;line-height:1;text-shadow:0 0 12px #f472b6,0 2px 4px #000;animation:mhTutorialArrow .9s ease-in-out infinite;pointer-events:none}/* 設定は画面のいちばん上にあるので、矢印は下側から上を指す */.mh-home-settings.is-tutorial-spot::before{content:'▲';top:100%;bottom:auto;margin:5px 0 0}@keyframes mhTutorialSpot{50%{box-shadow:0 0 0 6px #fbcfe8,0 0 0 15px #f472b644,0 0 62px 18px #f472b6}}@keyframes mhTutorialArrow{50%{transform:translateX(-50%) translateY(-7px)}}/* バトルチュートリアルで「ここを操作して」と示す枠。ふだんの画面の上に重ねるので、   暗幕は張らず、光る枠だけで示す(押せる場所はそのまま押せる) */.is-battle-tutorial-spot{border-radius:18px;outline:3px solid #f472b6;outline-offset:3px;box-shadow:0 0 0 7px #f472b644,0 0 34px 6px #f472b6aa;animation:mhBattleSpot 1.3s ease-in-out infinite}@keyframes mhBattleSpot{50%{outline-color:#fbcfe8;box-shadow:0 0 0 10px #f472b633,0 0 46px 10px #f472b6}}@media(prefers-reduced-motion:reduce){.is-battle-tutorial-spot{animation:none}}@media(prefers-reduced-motion:reduce){.is-tutorial-spot,.is-tutorial-spot>span,.is-tutorial-spot::before,.is-tutorial-spot>span::before{animation:none}}.mh-home-assistant{position:absolute;z-index:5;left:3%;width:70%;top:calc(72px + env(safe-area-inset-top));pointer-events:auto}@media(max-width:350px){.mh-home-assistant{width:62%}}
    .mh-gift-list{display:flex;flex-direction:column;gap:5px}.mh-gift-card{display:flex;flex-direction:column;min-height:80px;padding:5px 8px}.mh-gift-heading{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;height:18px}.mh-gift-heading h3{display:flex;align-items:center;gap:4px;min-width:0;font-size:12px;line-height:18px;color:#fff}.mh-gift-heading h3 span{flex:none;padding:1px 4px;border-radius:5px;background:#78350f;color:#fde68a;font-size:8px;line-height:14px}.mh-gift-heading h3 b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mh-gift-heading>em{flex:none;padding:1px 6px;border-radius:999px;font-size:8px;line-height:15px;font-style:normal;font-weight:900}.mh-gift-main{display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:37px}.mh-gift-rewards{display:flex;flex:1;flex-wrap:wrap;align-items:center;gap:2px 7px;min-width:0;color:#fde68a;font-size:11px;line-height:15px;font-weight:900}.mh-gift-rewards span{overflow-wrap:anywhere}.mh-gift-main>button{flex:none;min-width:76px;height:36px;padding:0 10px;border-radius:10px;background:#0891b2;color:#fff;font-size:12px;font-weight:900;white-space:nowrap}.mh-gift-main>button:disabled{background:#334155;color:#64748b}.mh-gift-deadline{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:8px;line-height:12px}
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
    .mh-title-modal{position:fixed;z-index:100;inset:0;display:flex;align-items:center;justify-content:center;padding:calc(20px + env(safe-area-inset-top)) 16px calc(20px + env(safe-area-inset-bottom));background:#03020eef}.mh-title-dialog{display:flex;flex-direction:column;gap:12px;width:min(100%,380px);max-height:86vh;padding:18px;border:1px solid #a78bfa77;border-radius:22px;background:#0f172a;color:#fff;overflow:auto}.mh-dialog-head{display:flex;align-items:center;justify-content:space-between}.mh-dialog-head h3{font-weight:900}.mh-dialog-head button{padding:8px}.mh-dialog-choice{display:flex;justify-content:space-between;align-items:center;padding:14px;border:1px solid #ffffff22;border-radius:14px;background:#ffffff0c;font-weight:800}.mh-changelog-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mh-changelog-tabs button{position:relative;padding:9px;border-radius:10px;background:#1e293b;font-size:11px;font-weight:800}.mh-changelog-tabs button.active{background:#b45309}.mh-unread-badge{position:absolute;right:-5px;top:-6px;display:flex;align-items:center;justify-content:center;width:17px;height:17px;border:2px solid #fff;border-radius:50%;background:#dc2626;color:#fff;font:900 11px/1 sans-serif;font-style:normal;box-shadow:0 2px 5px #0008;pointer-events:none}.mh-changelog-list{overflow:auto}.mh-changelog-list article{padding:11px;margin-bottom:8px;border:1px solid #ffffff18;border-radius:13px;background:#0005}.mh-changelog-list time,.mh-changelog-list b{display:block}.mh-changelog-list time{font:9px monospace;color:#94a3b8}.mh-changelog-list b{font-size:12px;margin:4px 0}.mh-changelog-kind{display:inline-block;margin-top:5px;padding:2px 7px;border-radius:999px;border:1px solid currentColor;font:900 9px/1.5 sans-serif}.mh-changelog-kind[data-kind="fix"]{color:#fca5a5;background:#7f1d1d55}.mh-changelog-kind[data-kind="feature"]{color:#86efac;background:#14532d55}.mh-changelog-kind[data-kind="update"]{color:#93c5fd;background:#1e3a8a55}.mh-changelog-kind[data-kind="market"]{color:#fcd34d;background:#78350f55}.mh-changelog-kind[data-kind="issue"]{color:#d8b4fe;background:#4c1d9555}.mh-changelog-list p{font-size:10px;color:#cbd5e1}.mh-changelog-head{display:flex;align-items:center;gap:8px;width:100%;min-height:36px;padding:0;border:0;background:transparent;color:inherit;text-align:left}.mh-changelog-head b{flex:1;min-width:0;margin:4px 0}.mh-changelog-head small{flex:none;font-size:8px;font-weight:900;color:#94a3b8;white-space:nowrap}.mh-changelog-detail{margin-top:2px;padding-top:6px;border-top:1px solid #ffffff14}.mh-changelog-empty{padding:18px 12px;text-align:center;line-height:1.7;color:#fbbf24}.mh-title-dialog textarea{min-height:90px;padding:8px;border-radius:10px;background:#0008;font:9px monospace}
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
