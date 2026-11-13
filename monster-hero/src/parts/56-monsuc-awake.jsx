// ===== モンヒロサクセスの覚醒・超覚醒(2026-11-13 社長「この形で作る」) =====
// 計算は芯 MONHERO_SUCCESS の awakeOpen(くじ・前触れ・起きる中身)。ここは見せる部分だけ。何も保存しない・公開の印は持たない(モンサクの印の後ろ)。
//   msxKiraOf(awake) … 印 0/1/2 → null / 'kira'(覚醒)/ 'rare'(超覚醒)
//   MsxKira          … バトルカードのキラ(84 の CardKiraAura・ふちの光)で絵を包む。fill = 箱いっぱい(場面のモンスター)/ small = 小さい札(ふちの光と印だけ)
//   MsxOmenFx        … 前触れ: 体がうっすら光る(覚醒は白・超覚醒は虹色)・ときどき震える(震えは包む側の CSS)
//   MsxAwakeShow     … 起きたときの演出(覚醒 4〜5秒・超覚醒 5〜6秒)。光に包まれる → 助手が驚く → 閃光と札・全能力と適性 → キラをまとった姿
//   「動きを減らす」設定(msxFxCalm)と prefers-reduced-motion では、動く光を出さず静かな形にする

const MSX_AW_DIST = Object.freeze(['零', '近', '中', '遠']);
const MSX_AW_NAME = Object.freeze({ 1: '覚醒', 2: '超覚醒' });
// 演出の段の切り替え(ミリ秒): 0 光に包まれる → 1 助手が驚く → 2 閃光と札 → 3 キラをまとった姿
const MSX_AW_STEPS = Object.freeze({ 1: Object.freeze([1300, 2500, 4000]), 2: Object.freeze([1600, 3000, 4700]) });
const msxKiraOf = (awake) => (Number(awake) >= 2 ? 'rare' : Number(awake) >= 1 ? 'kira' : null);
const msxAwCalm = () => (typeof msxFxCalm === 'function' ? Boolean(msxFxCalm()) : false);

function MsxKira({ kind, src = '', fill = false, small = false, className = '', style = null, children }) {
  msxAwEnsureCss();
  const box = `msx-kira${fill ? ' fill' : ''}${className ? ` ${className}` : ''}`;
  if (!kind) return fill || className ? <span className={box} style={style || undefined}><span className="msx-kira-in">{children}</span></span> : children;
  const rim = kind === 'rare' ? 'mh-rare-rim' : 'mh-kira-rim';
  const aura = !small && !msxAwCalm() && typeof CardKiraAura === 'function';
  return (
    <span className={box} style={style || undefined} data-msx-kira={kind}>
      {aura ? <CardKiraAura kind={kind} src={src} layer="back" style={{ inset: 0 }}/> : null}
      <span className={`msx-kira-in ${rim}`} data-card-kira={kind}>{children}</span>
      {aura ? <CardKiraAura kind={kind} src={src} layer="front" style={{ inset: 0 }}/> : null}
      {small ? <i className={`msx-kira-badge ${kind}`} aria-hidden="true">{kind === 'rare' ? '🌈' : '✨'}</i> : null}
    </span>
  );
}

function MsxOmenFx({ k }) {
  if (k !== 1 && k !== 2) return null;
  msxAwEnsureCss();
  return (
    <span className={`msx-omen k${k}${msxAwCalm() ? ' calm' : ''}`} aria-hidden="true" data-msx-omen={k}>
      <i className="g"/>{[0, 1, 2, 3].map((i) => <i key={i} className="p" style={{ '--i': i }}/>)}
    </span>
  );
}

// fire = 芯の awakeOpen の out.fire { kind, add, ups, apt:[{ dist, from, to }] }。run.s はもう起きたあと(能力・印)
function MsxAwakeShow({ run, fire, v, ev, line }) {
  msxAwEnsureCss();
  const k = fire && fire.kind === 2 ? 2 : 1;
  const calm = msxAwCalm();
  const [st, setSt] = React.useState(calm ? 3 : 0);
  React.useEffect(() => {
    if (calm) return undefined;
    const ids = MSX_AW_STEPS[k].map((ms, i) => setTimeout(() => setSt((n) => Math.max(n, i + 1)), ms));
    return () => ids.forEach(clearTimeout);
  }, []);
  const s = run.s;
  const shown = { ...run, s: { ...s, awake: st >= 3 ? k : k - 1, omen: null } };
  const say = line(k === 2 ? 'turn.awake.fire2' : 'turn.awake.fire', k === 2 ? 'うそ…まだ光が強くなっていく！' : 'えっ…この光、なに！？');
  const apt = Array.isArray(fire && fire.apt) ? fire.apt : [];
  return (<>
    {typeof MsxBand === 'function' ? <MsxBand s={s} v={v} ev={ev}/> : null}
    <div className={`v-scene msx-aw k${k} st${st}`} style={{ flex: '1 1 0' }} onClick={() => setSt(3)} data-msx-awake={k} data-msx-awake-step={st}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      {st < 3 ? <><span className="msx-aw-ray" aria-hidden="true"/><span className="msx-aw-wrap" aria-hidden="true"/></> : <span className="msx-aw-after" aria-hidden="true"/>}
      <div className="gr" style={{ bottom: 'calc(16% - 5px)' }}/>
      <MsxMonArt run={shown} className="mon" style={{ bottom: '16%', height: '40%' }} live={st >= 3}/>
      {st === 2 ? <span className="msx-aw-flash" aria-hidden="true"/> : null}
      {st >= 2 ? <div className={`msx-aw-stamp k${k} msx-pop`}>{k === 2 ? '超覚醒!!' : '覚醒!'}<small>全能力 +{fire.add}</small></div> : null}
    </div>
    {st >= 2 ? <MsxStRow stats={s.stats} ups={fire.ups}/> : null}
    <div className="v-log">
      {st < 2 ? <>{run.nick}の体が、{k === 2 ? '虹色の' : 'まぶしい'}光に包まれていく…</> : <>
        <span className="hd2">{k === 2 ? '🌈 超覚醒' : '✨ 覚醒'}</span><br/>
        全能力 <b className="gu">+{fire.add}</b>
        {apt.map((a) => <span key={a.dist}><br/>📏 「{MSX_AW_DIST[a.dist]}」の間合い適性が {a.from} → <b className="ga">{a.to}</b> に上がった!</span>)}
        {st >= 3 ? <><br/>{run.nick}は{k === 2 ? 'レアキラ' : 'キラ'}の光をまとった!</> : null}</>}
    </div>
    {st >= 1 && say && say.t ? <MsxSay aid={s.aid} ex={say.e || 'surprise'} text={say.t}/> : null}
  </>);
}

const MSX_AW_CSS = `
.msx-kira{position:relative;display:inline-flex;align-items:flex-end;justify-content:center;isolation:isolate}
.msx-kira.fill{display:block;width:100%;height:100%}
.msx-kira-in{display:inline-flex;align-items:flex-end;justify-content:center}
.msx-kira.fill>.msx-kira-in{display:block;width:100%;height:100%}
.msx-kira.fill>.msx-kira-in>img{width:100%;height:100%;object-fit:contain}
.msx-kira-badge{position:absolute;right:-5px;top:-5px;font-style:normal;font-size:11px;line-height:1;z-index:3;filter:drop-shadow(0 1px 1px #0009)}
.msx-omen{position:absolute;inset:-14% -14% -4%;pointer-events:none;z-index:3}
.msx-omen>i{position:absolute;font-style:normal}
.msx-omen .g{inset:6% 6% 0;border-radius:50%;mix-blend-mode:screen;animation:msxOmenPulse 2.6s ease-in-out infinite;background:radial-gradient(ellipse 50% 52% at 50% 58%,rgba(255,255,255,.62),rgba(255,255,255,.22) 48%,rgba(255,255,255,0) 72%)}
.msx-omen.k2 .g{background:conic-gradient(from 0deg,rgba(255,110,210,.55),rgba(110,210,255,.55),rgba(255,235,110,.55),rgba(150,255,170,.5),rgba(255,110,210,.55));-webkit-mask:radial-gradient(ellipse 50% 52% at 50% 58%,#000 30%,transparent 72%);mask:radial-gradient(ellipse 50% 52% at 50% 58%,#000 30%,transparent 72%);animation:msxOmenPulse 2.6s ease-in-out infinite,msxOmenSpin 8s linear infinite}
.msx-omen .p{width:6px;height:6px;border-radius:50%;bottom:16%;left:calc(26% + var(--i) * 16%);background:#fff;box-shadow:0 0 6px 2px rgba(255,255,255,.9);opacity:0;animation:msxOmenMote 3s linear infinite;animation-delay:calc(var(--i) * .75s)}
.msx-omen.k2 .p:nth-child(2){background:#ffd6f4;box-shadow:0 0 6px 2px rgba(255,120,220,.9)}
.msx-omen.k2 .p:nth-child(3){background:#d6f4ff;box-shadow:0 0 6px 2px rgba(120,210,255,.9)}
.msx-omen.k2 .p:nth-child(4){background:#fff6c8;box-shadow:0 0 6px 2px rgba(255,214,102,.95)}
.msx-omen.k2 .p:nth-child(5){background:#d9ffe0;box-shadow:0 0 6px 2px rgba(130,255,160,.9)}
.msx-omen-on>.msx-kira{animation:msxOmenShake 4.6s ease-in-out infinite}
.msx-omen-on.k1>.msx-kira>.msx-kira-in{filter:drop-shadow(0 0 4px rgba(255,255,255,.9)) drop-shadow(0 0 10px rgba(255,255,255,.55))}
@keyframes msxOmenPulse{0%,100%{opacity:.45}50%{opacity:.95}}
@keyframes msxOmenSpin{to{transform:rotate(360deg)}}
@keyframes msxOmenMote{0%{opacity:0;transform:translateY(0)}15%{opacity:1}100%{opacity:0;transform:translateY(-120px)}}
@keyframes msxOmenShake{0%,82%,100%{transform:none}84%{transform:translateX(-2px) rotate(-2deg)}86%{transform:translateX(2px) rotate(2deg)}88%{transform:translateX(-2px) rotate(-1.5deg)}90%{transform:translateX(1px) rotate(1deg)}92%{transform:none}}
.msx-omen.calm .g,.msx-omen.calm .p{animation:none}.msx-omen.calm .g{opacity:.7}.msx-omen.calm .p{display:none}
.msx-aw .msx-aw-ray{position:absolute;left:50%;top:-5%;bottom:12%;width:46%;transform:translateX(-50%);pointer-events:none;z-index:3;mix-blend-mode:screen;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.55) 40%,rgba(255,250,215,.85));-webkit-mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);mask:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);animation:msxAwRay 1.3s ease-out both}
.msx-aw.k2 .msx-aw-ray{background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,160,230,.5) 30%,rgba(150,220,255,.6) 60%,rgba(255,240,150,.85))}
.msx-aw.st1 .msx-aw-ray,.msx-aw.st2 .msx-aw-ray{animation:msxAwHold2 .8s ease-in-out infinite alternate}
.msx-aw .msx-aw-wrap{position:absolute;left:50%;bottom:8%;width:92%;aspect-ratio:1;transform:translateX(-50%);border-radius:50%;pointer-events:none;z-index:3;mix-blend-mode:screen;animation:msxAwWrap 1.3s ease-out both;background:radial-gradient(circle at 50% 58%,rgba(255,255,255,.95),rgba(255,250,220,.6) 30%,rgba(255,255,255,0) 66%)}
.msx-aw.k2 .msx-aw-wrap{animation-duration:1.6s;z-index:1;mix-blend-mode:normal;background:conic-gradient(rgba(255,80,200,.62),rgba(80,190,255,.62),rgba(255,225,70,.62),rgba(110,240,140,.58),rgba(170,110,255,.62),rgba(255,80,200,.62));-webkit-mask:radial-gradient(circle,transparent 14%,#000 26%,#000 44%,transparent 68%);mask:radial-gradient(circle,transparent 14%,#000 26%,#000 44%,transparent 68%)}
.msx-aw.st1 .msx-aw-wrap,.msx-aw.st2 .msx-aw-wrap{animation:msxAwHold 1s ease-in-out infinite alternate}
.msx-aw.k2.st1 .msx-aw-wrap,.msx-aw.k2.st2 .msx-aw-wrap{animation:msxAwHold 1s ease-in-out infinite alternate,msxOmenSpin 3s linear infinite}
.msx-aw.st0 .mon,.msx-aw.st1 .mon,.msx-aw.st2 .mon{filter:brightness(1.5) drop-shadow(0 0 10px #fff) drop-shadow(0 0 24px rgba(255,255,255,.9))}
.msx-aw.k2.st0 .mon,.msx-aw.k2.st1 .mon,.msx-aw.k2.st2 .mon{filter:brightness(1.12) drop-shadow(0 0 6px #ff7ad9) drop-shadow(0 0 14px rgba(110,200,255,.95)) drop-shadow(0 0 26px rgba(255,220,90,.85))}
.msx-aw .msx-aw-after{position:absolute;inset:0;pointer-events:none;z-index:1;background:radial-gradient(circle at 50% 62%,rgba(255,240,200,.35),transparent 60%)}
.msx-aw.k2 .msx-aw-after{background:radial-gradient(circle at 50% 62%,rgba(255,180,240,.32),rgba(150,220,255,.18) 40%,transparent 64%)}
.msx-aw-flash{position:absolute;inset:0;z-index:4;pointer-events:none;background:#fff;animation:msxAwFlash .9s ease-out both}
.msx-aw.k2 .msx-aw-flash{background:linear-gradient(120deg,#ffd1f2,#fff 30%,#d1f1ff 55%,#fff7c2 80%,#d9ffe0)}
.msx-aw-stamp{position:absolute;left:0;right:0;top:9%;z-index:5;text-align:center;white-space:nowrap;font-size:34px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:3px #b45309;paint-order:stroke fill;text-shadow:0 0 14px #fff,0 4px 0 #78350f}
.msx-aw-stamp.k2{font-size:36px;-webkit-text-stroke:3px #9d174d;text-shadow:0 0 14px #fff,0 0 26px rgba(255,120,220,.9),0 4px 0 #581c87}
.msx-aw-stamp small{display:table;margin:2px auto 0;font-size:15px;font-style:normal;-webkit-text-stroke:0;color:#7c2d12;background:#fff;border-radius:999px;padding:1px 12px;text-shadow:none}
@keyframes msxAwWrap{0%{opacity:0;transform:translateX(-50%) scale(.4)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes msxAwHold{from{opacity:.75;transform:translateX(-50%) scale(.96)}to{opacity:1;transform:translateX(-50%) scale(1.06)}}
@keyframes msxAwRay{0%{opacity:0;transform:translateX(-50%) scaleX(.2)}100%{opacity:1;transform:translateX(-50%) scaleX(1)}}
@keyframes msxAwHold2{from{opacity:.7}to{opacity:1}}
@keyframes msxAwFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){
  .msx-omen .g,.msx-omen .p,.msx-omen-on>.msx-kira,.msx-aw .msx-aw-wrap,.msx-aw-flash{animation:none}
  .msx-omen .p,.msx-aw-flash{display:none}
  .msx-aw .msx-aw-ray{animation:none}
}
`;
let msxAwCssDone = false;
const msxAwEnsureCss = () => {
  if (msxAwCssDone || typeof document === 'undefined') return;
  msxAwCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-awake-css', '1'); el.textContent = MSX_AW_CSS; document.head.appendChild(el);
};
