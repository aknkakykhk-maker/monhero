import sys,re
P=sys.argv[1]+'/monster-hero/src/parts/56-monsuc-awake.jsx'
s=open(P,encoding='utf-8').read()
a=s.index('// fire = 芯の awakeOpen の out.fire')
b=s.index('const MSX_AW_CSS = `')
new='''// fire = 芯の awakeOpen の out.fire { kind, add, ups, apt:[{ dist, from, to }] }。run.s はもう起きたあと(能力・印)
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
    {st >= 2 ? <MsxStRow stats={s.stats} ups={fire.ups}/> : null}
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

'''
s=s[:a]+new+s[b:]
css='''.msx .msx-aw .msx-aw-dim{position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(circle at 50% 55%,rgba(15,13,36,0) 30%,rgba(15,13,36,.55))}
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
'''
s=s.replace('@keyframes msxAwWrap{',css+'@keyframes msxAwWrap{',1)
s=s.replace("const MSX_AW_STEPS = Object.freeze({ 1: Object.freeze([1300, 2500, 4000]), 2: Object.freeze([1600, 3000, 4700]) });",
"const MSX_AW_STEPS = Object.freeze({ 1: Object.freeze([1400, 2800, 4200]), 2: Object.freeze([1700, 3500, 5000]) }); // 0 溜め → 1 気が噴き出す → 2 閃光と札 → 3 キラ")
s=s.replace("@media (prefers-reduced-motion: reduce){\n  .msx-peakfx","@media (prefers-reduced-motion: reduce){\n  .msx .msx-aw-qi,.msx .msx-aw-slash{display:none}.msx .msx-aw .mon.aw-big{animation:none}\n  .msx-peakfx")
open(P,'w',encoding='utf-8').write(s)
print('ok', 'MSX_AW_STEPS' in s, s.count('msxAwQi'))
