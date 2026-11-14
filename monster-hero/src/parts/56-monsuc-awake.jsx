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
const MSX_AW_STEPS = Object.freeze({ 1: Object.freeze([1400, 2800, 4200]), 2: Object.freeze([1700, 3500, 5000]) }); // 0 溜め → 1 気が噴き出す → 2 閃光と札 → 3 キラ
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

// 成長のピーク中: 足もとの炎のオーラと火の粉(キラと重なっても両方見える。キラは中・炎は外側の後ろと前)。「動きを減らす」では静かな形
function MsxPeakFx({ layer }) {
  msxAwEnsureCss();
  const calm = msxAwCalm();
  if (layer === 'back') return <span className={`msx-peakfx back${calm ? ' calm' : ''}`} aria-hidden="true" data-msx-peak="back">{[0, 1, 2, 3, 4].map((i) => <i key={i} className="fl" style={{ '--i': i }}/>)}<i className="base"/></span>;
  if (calm) return null;
  return <span className="msx-peakfx front" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} className="em" style={{ '--i': i }}/>)}</span>;
}

// fire = 芯の awakeOpen の out.fire { kind, add, ups, apt:[{ dist, from, to }] }。run.s はもう起きたあと(能力・印)
// 段(2026-11-13 社長の参考画像に寄せる): 0 見出しの帯「育成イベント/◯◯覚醒!!」と画面いっぱいの姿(溜め) → 1 体から気が噴き出し、筋が走る
//   → 2 閃光と「覚醒!」の札・全能力・ゲージが伸びる → 3 キラをまとった姿。下の「早送り」で次の段へ・「短縮」で結果へ
function MsxAwakeShow({ run, fire, v, ev, line }) {
  msxAwEnsureCss();
  const k = fire && fire.kind === 2 ? 2 : 1;
  const calm = msxAwCalm();
  const [st, setSt] = React.useState(calm ? 3 : 0);
  React.useEffect(() => {
    if (calm || st >= 3) return undefined;
    const id = setTimeout(() => setSt((n) => Math.min(3, n + 1)), MSX_AW_STEPS[k][st] - (st ? MSX_AW_STEPS[k][st - 1] : 0));
    return () => clearTimeout(id);
  }, [st]);
  // 段ごとの音(2026-11-14 社長「演出に音を」。溜めの音と曲は場面の音 awakeShow が鳴らす)
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(st === 1 ? [['awQi', 0]] : st === 2 ? [['awFlash', 0]] : st === 3 && !calm ? [['awKira', 0]] : [], [st]);
  const s = run.s;
  const shown = { ...run, s: { ...s, awake: st >= 3 ? k : k - 1, omen: null } };
  const say = line(k === 2 ? 'turn.awake.fire2' : 'turn.awake.fire', k === 2 ? 'うそ…まだ光が強くなっていく！' : 'えっ…この光、なに！？');
  const apt = Array.isArray(fire && fire.apt) ? fire.apt : [];
  const big = st < 2;
  return (<>
    {typeof MsxBand === 'function' ? <MsxBand s={s} v={v} ev={ev}/> : null}
    <div className={`v-scene msx-aw k${k} st${st}`} style={{ flex: '1 1 0' }} data-msx-awake={k} data-msx-awake-step={st}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      {st < 3 ? <span className="msx-aw-dim" aria-hidden="true"/> : <span className="msx-aw-after" aria-hidden="true"/>}
      {st === 1 || st === 2 ? <span className="msx-aw-qi" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} style={{ '--i': i }}/>)}</span> : null}
      <div className="gr" style={{ bottom: big ? 'calc(4% - 5px)' : 'calc(16% - 5px)' }}/>
      <MsxMonArt run={shown} className={`mon${big ? ' aw-big' : ''}`} style={big ? { bottom: '4%', height: '78%' } : { bottom: '16%', height: '40%' }} live={st >= 3}/>
      {st === 1 || st === 2 ? <span className="msx-aw-slash" aria-hidden="true">{(k === 2 ? [0, 1, 2] : [0, 1]).map((i) => <i key={i} style={{ '--i': i }}/>)}</span> : null}
      {st < 2 ? <div className={`msx-aw-head k${k}`}><small>育成イベント</small>{run.nick}{k === 2 ? '超覚醒!!' : '覚醒!!'}</div> : null}
      {st === 2 ? <span className="msx-aw-flash" aria-hidden="true"/> : null}
      {st >= 2 ? <div className={`msx-aw-stamp k${k} msx-pop`}>{k === 2 ? '超覚醒!!' : '覚醒!'}<small>全能力 +{fire.add}</small></div> : null}
      {st < 3 && !calm ? <div className="msx-aw-ctl"><button type="button" onClick={() => setSt((n) => Math.min(3, n + 1))} data-msx-awake-ff>早送り ⏩</button><button type="button" onClick={() => setSt(3)} data-msx-awake-skip>短縮 ⏭</button></div> : null}
    </div>
    {st >= 2 ? <MsxStRow who={s} stats={s.stats} ups={fire.ups}/> : null}
    <div className="v-log">
      {st < 2 ? <>{run.nick}の体から、{k === 2 ? '虹色の' : 'まばゆい'}気があふれ出す…</> : <>
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
.msx .msx-aw .msx-aw-dim{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(circle at 50% 55%,rgba(15,13,36,0) 30%,rgba(15,13,36,.55))}
.msx .msx-aw.k2 .msx-aw-dim{background:radial-gradient(circle at 50% 55%,rgba(40,10,60,0) 30%,rgba(40,10,60,.65))}
.msx .msx-aw .mon.aw-big{animation:msxAwTame 1.4s ease-out both;z-index:2}
.msx .msx-aw.st1 .mon.aw-big{animation:msxAwShake .12s linear infinite}
.msx .msx-aw-head{position:absolute;left:0;top:10px;z-index:6;padding:4px 18px 5px 12px;font-size:16px;font-weight:900;color:#fff;text-align:left;background:linear-gradient(90deg,#be123c,#e11d48cc 70%,transparent);clip-path:polygon(0 0,100% 0,92% 100%,0 100%);animation:msxAwHead .4s ease-out both}
.msx .msx-aw-head small{display:block;font-size:10px;color:#fecdd3}
.msx .msx-aw-head.k2{background:linear-gradient(90deg,#7c3aed,#db2777 55%,#f59e0bcc 80%,transparent)}
.msx .msx-aw-qi{position:absolute;inset:0;z-index:1;pointer-events:none}
.msx .msx-aw-qi i{position:absolute;left:50%;bottom:8%;width:34%;height:70%;margin-left:-17%;border-radius:50% 50% 40% 40%/70% 70% 30% 30%;transform-origin:50% 100%;transform:rotate(calc((var(--i) - 3.5) * 22deg));background:radial-gradient(ellipse 50% 60% at 50% 70%,rgba(255,255,255,.95),rgba(255,230,140,.75) 35%,rgba(255,170,40,.35) 60%,transparent 78%);mix-blend-mode:screen;animation:msxAwQi .55s ease-out infinite alternate;animation-delay:calc(var(--i) * -.13s)}
.msx .msx-aw.k2 .msx-aw-qi i{background:radial-gradient(ellipse 50% 60% at 50% 70%,rgba(255,255,255,.95),hsla(calc(var(--i) * 45),95%,70%,.85) 35%,hsla(calc(var(--i) * 45 + 40),95%,60%,.4) 62%,transparent 80%)}
.msx .msx-aw-slash{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}
.msx .msx-aw-slash i{position:absolute;left:-20%;width:140%;height:7px;top:calc(48% + var(--i) * 14%);border-radius:7px;transform:rotate(-14deg);background:linear-gradient(90deg,transparent,#fff 30%,#fde047 60%,transparent);box-shadow:0 0 14px #fde047;animation:msxAwSlash .5s ease-out both;animation-delay:calc(.15s + var(--i) * .22s)}
.msx .msx-aw.k2 .msx-aw-slash i{background:linear-gradient(90deg,transparent,#fff 20%,#f472b6 45%,#60a5fa 65%,#fde047 80%,transparent);box-shadow:0 0 16px #f472b6}
.msx .msx-aw-ctl{position:absolute;left:0;right:0;bottom:8px;z-index:7;display:flex;justify-content:center;gap:10px}
.msx .msx-aw-ctl button{min-width:92px;padding:5px 12px;border-radius:999px;background:#0f0d24cc;border:1.5px solid #fde047;color:#fde047;font-size:12px;font-weight:900;text-align:center}
@keyframes msxAwTame{from{transform:translateX(-50%) scale(.82)}to{transform:translateX(-50%) scale(1)}}
@keyframes msxAwShake{0%{transform:translateX(-50%) translate(0,0)}25%{transform:translateX(-50%) translate(-2px,1px)}50%{transform:translateX(-50%) translate(2px,-1px)}75%{transform:translateX(-50%) translate(-1px,-1px)}100%{transform:translateX(-50%) translate(0,0)}}
@keyframes msxAwHead{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes msxAwQi{from{opacity:.55;transform:rotate(calc((var(--i) - 3.5) * 22deg)) scaleY(.85)}to{opacity:1;transform:rotate(calc((var(--i) - 3.5) * 22deg)) scaleY(1.12)}}
@keyframes msxAwSlash{0%{opacity:0;transform:rotate(-14deg) translateX(-60%)}30%{opacity:1}100%{opacity:0;transform:rotate(-14deg) translateX(40%)}}
@keyframes msxAwWrap{0%{opacity:0;transform:translateX(-50%) scale(.4)}100%{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes msxAwHold{from{opacity:.75;transform:translateX(-50%) scale(.96)}to{opacity:1;transform:translateX(-50%) scale(1.06)}}
@keyframes msxAwRay{0%{opacity:0;transform:translateX(-50%) scaleX(.2)}100%{opacity:1;transform:translateX(-50%) scaleX(1)}}
@keyframes msxAwHold2{from{opacity:.7}to{opacity:1}}
@keyframes msxAwFlash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
.msx-peakfx{position:absolute;pointer-events:none}
.msx-peakfx.back{left:-24%;right:-24%;bottom:-6%;height:96%;z-index:0}
.msx-peakfx.front{left:-8%;right:-8%;bottom:0;height:90%;z-index:4}
.msx-peakfx>i{position:absolute;font-style:normal}
.msx-peakfx .base{left:10%;right:10%;bottom:0;height:22%;border-radius:50%;background:radial-gradient(ellipse at 50% 60%,rgba(255,220,90,.85),rgba(255,120,30,.55) 45%,rgba(255,60,0,0) 72%);animation:msxPeakBase 1.2s ease-in-out infinite alternate}
.msx-peakfx .fl{bottom:4%;left:calc(14% + var(--i) * 15%);width:22%;height:72%;border-radius:50% 50% 35% 35% / 70% 70% 30% 30%;transform-origin:50% 100%;background:radial-gradient(ellipse 50% 62% at 50% 74%,rgba(255,250,190,1),rgba(255,180,40,.95) 30%,rgba(255,90,10,.75) 55%,rgba(230,40,0,0) 80%);animation:msxPeakFlame calc(.9s + var(--i) * .13s) ease-in-out infinite alternate;animation-delay:calc(var(--i) * -.37s)}
.msx-peakfx .fl:nth-child(1),.msx-peakfx .fl:nth-child(5){height:52%}
.msx-peakfx .fl:nth-child(2),.msx-peakfx .fl:nth-child(4){height:80%}
.msx-peakfx .fl:nth-child(3){height:100%}
.msx-peakfx .em{bottom:8%;left:calc(10% + var(--i) * 15%);width:5px;height:5px;border-radius:50%;background:#ffe08a;box-shadow:0 0 6px 2px rgba(255,140,30,.95);opacity:0;animation:msxPeakEmber 2.2s linear infinite;animation-delay:calc(var(--i) * .37s)}
.msx-peakfx.calm .fl,.msx-peakfx.calm .base{animation:none}
@keyframes msxPeakFlame{0%{transform:scaleY(.82) scaleX(1.04) skewX(-3deg);opacity:.75}100%{transform:scaleY(1.08) scaleX(.94) skewX(3deg);opacity:1}}
@keyframes msxPeakBase{from{opacity:.7}to{opacity:1}}
@keyframes msxPeakEmber{0%{opacity:0;transform:translate(0,0)}15%{opacity:1}100%{opacity:0;transform:translate(calc((var(--i) - 2.5) * 6px),-150px)}}
.msx-peakon>.msx-kira{position:relative;z-index:1;filter:drop-shadow(0 0 3px rgba(255,170,40,.95)) drop-shadow(0 0 9px rgba(255,90,10,.7))}
.msx-peak-card{position:absolute;left:0;right:0;top:12%;z-index:5;text-align:center;font-size:26px;font-weight:900;font-style:italic;color:#fff7cc;-webkit-text-stroke:3px #c2410c;paint-order:stroke fill;text-shadow:0 0 14px #fb923c,0 3px 0 #7c2d12;white-space:nowrap}
@media (prefers-reduced-motion: reduce){
  .msx .msx-aw-qi,.msx .msx-aw-slash{display:none}.msx .msx-aw .mon.aw-big{animation:none}
  .msx-peakfx .fl,.msx-peakfx .base{animation:none}.msx-peakfx.front{display:none}
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
