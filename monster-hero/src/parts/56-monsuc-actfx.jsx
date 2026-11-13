// ===== モンヒロサクセスの訓練・修行の演出(2026-11-13 社長「トレーニングも修行も演出が入っていない」・参考動画の流れだけを取り入れる) =====
// 何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。押すと飛ばせる。「動きを減らす」設定では出さない(すぐ結果)
//   MsxTrainAct({ run, o, style, onDone }) … 訓練の結果の字の前に、訓練している場面(約1.3秒)。style: 'a' その場で動く / 'b' 集中線のカットイン
//   MsxShugyoStages({ run, o, line, onDone }) … 修行の結果の前に、助手の一言 →「STAGE 1 ◯◯&◯◯」→「STAGE 2 ◯◯&◯◯」(段ごとに景色が替わる・いっしょに修行した編成のモンスターの顔)

const MSX_ACT_STYLE = 'a';
const MSX_ACT_MS = 1300;
// 修行の段ごとの景色(背景の絵 + 色のかぶせ)
const MSX_QSTAGE_BG = Object.freeze({
  fire: [['forest_evening', 'rgba(255,90,20,.35)'], ['desert_oilfield', 'rgba(255,40,0,.38)']],
  ice: [['forest_morning', 'rgba(120,200,255,.35)'], ['forest_night', 'rgba(150,220,255,.4)']],
  wind: [['forest_deep', 'rgba(120,255,170,.25)'], ['desert_hall', 'rgba(200,255,220,.25)']],
  star: [['monhero_night', 'rgba(150,120,255,.3)'], ['dark_void', 'rgba(200,170,255,.3)']],
});
const msxActCalm = () => typeof msxFxCalm === 'function' && msxFxCalm();

function MsxTrainAct({ run, o, style: style0, onDone }) {
  const style = style0 || (typeof window !== 'undefined' && (window.__msxActStyle === 'b' || window.__msxActStyle === 'a') ? window.__msxActStyle : MSX_ACT_STYLE);
  msxActEnsureCss();
  const k = o && o.card ? o.card.stat : null;
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => { if (msxActCalm()) { finish(); return undefined; } const id = setTimeout(finish, MSX_ACT_MS); return () => clearTimeout(id); }, []);
  if (msxActCalm()) return null;
  const name = k && typeof MSX_STAT_NAME !== 'undefined' ? MSX_STAT_NAME[k] : '';
  const icon = k && typeof MSX_STAT_ICON !== 'undefined' ? MSX_STAT_ICON[k] : '💪';
  return (
    <div className={`msx-act s-${style}`} onClick={finish} data-msx-act={style}>
      {style === 'b' ? <span className="lines" aria-hidden="true"/> : null}
      <div className="ban">{icon} {name}の訓練!</div>
      <div className="me"><MsxMonArt run={run} className="mon" live react={{ kind: 'great', id: `act-${run.s.turn}` }}/></div>
      {[0, 1, 2].map((i) => <i key={i} className="hit" style={{ '--i': i }}>{icon}</i>)}
      <i className="sw" aria-hidden="true">💦</i>
    </div>
  );
}

function MsxShugyoStages({ run, o, line, onDone }) {
  msxActEnsureCss();
  const SH = msxSuc && msxSuc.SUC ? msxSuc.SUC.SHUGYO : null;
  const course = SH && SH.courses ? SH.courses[o.course] : null;
  const stages = course && Array.isArray(course.stages) ? course.stages : [];
  const bgs = MSX_QSTAGE_BG[o.course] || MSX_QSTAGE_BG.fire;
  const [st, setSt] = React.useState(0); // 0 助手の一言 / 1 STAGE 1 / 2 STAGE 2
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => {
    if (msxActCalm()) { finish(); return undefined; }
    const ids = [setTimeout(() => setSt(1), 1000), setTimeout(() => setSt(2), 2300), setTimeout(finish, 3600)];
    return () => ids.forEach(clearTimeout);
  }, []);
  if (msxActCalm()) return null;
  const s = run.s;
  const say = line ? line('turn.drill.start', 'よし、集中していこう！') : { t: 'よし、集中していこう！' };
  const helpers = Array.isArray(o.stages) && o.stages[st - 1] ? o.stages[st - 1] : [];
  const pair = stages[st - 1] || [];
  const [bg, tint] = bgs[Math.max(0, st - 1)] || bgs[0];
  return (
    <div className={`msx-qst st${st}`} onClick={finish} data-msx-qstage={st}>
      <img key={`bg${st}`} className="bg" src={`images/story-bg/${bg}.jpg`} alt=""/>
      <span className="tint" style={{ background: st ? tint : 'rgba(15,13,36,.55)' }}/>
      {st === 0 ? (<div className="say">
        {typeof msxFace === 'function' ? <img className="fc" src={msxFace(s.aid, 'excited')} alt=""/> : null}
        <div className="bub"><b>{course ? `${course.name}の修行` : '修行'}</b>{say && say.t}</div></div>) : (<>
        <div key={`ban${st}`} className="ban"><small>STAGE {st}</small>{pair.map((x) => `${MSX_STAT_ICON[x]} ${MSX_STAT_NAME[x]}`).join(' & ')}</div>
        <div key={`me${st}`} className="me"><MsxMonArt run={run} className="mon" live react={{ kind: 'great', id: `qs-${st}` }}/></div>
        {helpers.length ? <div className="faces">{helpers.map((i) => s.team[i]).filter(Boolean).map((m, j) => <img key={j} src={msxMonThumb(m.species)} alt=""/>)}<small>いっしょに修行</small></div> : null}
      </>)}
      <div className="skip">タップでとばす</div>
    </div>
  );
}

const MSX_ACT_CSS = `
.msx .msx-act{position:absolute;inset:0;z-index:8;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 60%,rgba(15,13,36,.15),rgba(15,13,36,.55))}
.msx .msx-act .ban{position:absolute;left:0;right:0;top:9%;text-align:center;font-size:24px;font-weight:900;color:#fff;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 3px 0 #7c2d12;animation:msxActBan .4s cubic-bezier(.2,1.4,.4,1) both}
.msx .msx-act .me{position:absolute;inset:0}
.msx .msx-act .ban{z-index:2}
.msx .msx-act .me .mon{left:50%;bottom:14%;height:48%}
.msx .msx-act .hit{position:absolute;font-style:normal;font-size:30px;left:calc(30% + var(--i) * 18%);top:calc(36% + var(--i) * 6%);opacity:0;animation:msxActHit .5s ease-out both;animation-delay:calc(.35s + var(--i) * .25s)}
.msx .msx-act .sw{position:absolute;font-style:normal;font-size:22px;left:64%;top:36%;animation:msxActSw .9s ease-out .4s both}
.msx .msx-act.s-b{background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.05),rgba(10,8,30,.75))}
.msx .msx-act.s-b .lines{position:absolute;inset:-20%;background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(255,255,255,.55) 0 1.2deg,transparent 1.2deg 9deg);-webkit-mask:radial-gradient(circle at 50% 55%,transparent 24%,#000 46%);mask:radial-gradient(circle at 50% 55%,transparent 24%,#000 46%);animation:msxActLines .35s linear infinite}
.msx .msx-act.s-b .me .mon{height:62%;bottom:6%;animation:msxActZoom .5s cubic-bezier(.2,1.2,.3,1) both}
.msx .msx-act.s-b .ban{top:auto;bottom:6%;font-size:28px;font-style:italic;background:linear-gradient(90deg,transparent,#7c2d12cc 20%,#7c2d12cc 80%,transparent);padding:4px 0}
@keyframes msxActBan{from{opacity:0;transform:translateY(-14px) scale(.8)}to{opacity:1;transform:none}}
@keyframes msxActHit{0%{opacity:0;transform:scale(.3)}40%{opacity:1;transform:scale(1.3)}100%{opacity:0;transform:scale(1) translateY(-14px)}}
@keyframes msxActSw{0%{opacity:0;transform:translateY(0)}20%{opacity:1}100%{opacity:0;transform:translateY(16px)}}
@keyframes msxActLines{to{transform:rotate(9deg)}}
@keyframes msxActZoom{from{transform:translateX(-50%) scale(.7)}to{transform:translateX(-50%) scale(1)}}
.msx .msx-qst{position:absolute;inset:0;z-index:9;overflow:hidden;cursor:pointer;background:#0f0d24}
.msx .msx-qst .bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:msxQbg .5s ease-out both}
.msx .msx-qst .tint{position:absolute;inset:0;mix-blend-mode:multiply}
.msx .msx-qst.st0 .tint{mix-blend-mode:normal}
.msx .msx-qst .say{position:absolute;left:12px;right:12px;bottom:18%;display:flex;gap:8px;align-items:flex-end;animation:msxActBan .4s ease-out both}
.msx .msx-qst .say .fc{width:64px;height:64px;border-radius:50%;border:3px solid #fff;object-fit:cover;background:#fff}
.msx .msx-qst .say .bub{flex:1;background:#fffdf5;color:#1e1b4b;border:2px solid #fb923c;border-radius:14px;padding:8px 12px;font-size:13px;font-weight:800;line-height:1.5;text-align:left}
.msx .msx-qst .say .bub b{display:block;color:#c2410c;font-size:12px}
.msx .msx-qst .ban{position:absolute;left:0;right:0;top:10%;text-align:center;font-size:20px;font-weight:900;color:#fff;-webkit-text-stroke:2px #1e1b4b;paint-order:stroke fill;text-shadow:0 3px 0 #1e1b4b;background:linear-gradient(90deg,transparent,#0f0d24cc 15%,#0f0d24cc 85%,transparent);padding:6px 0;animation:msxQban .45s cubic-bezier(.2,1.2,.3,1) both}
.msx .msx-qst .ban small{display:block;font-size:30px;font-style:italic;letter-spacing:.12em;color:#fde047;-webkit-text-stroke:2px #92400e}
.msx .msx-qst .me{position:absolute;inset:0}
.msx .msx-qst .me .mon{left:50%;bottom:18%;height:40%}
.msx .msx-qst .faces{position:absolute;left:0;right:0;bottom:6%;display:flex;justify-content:center;align-items:center;gap:6px}
.msx .msx-qst .faces img{width:40px;height:40px;border-radius:50%;background:#fff;border:2px solid #fde047;object-fit:contain;animation:msxActBan .4s ease-out both}
.msx .msx-qst .faces small{font-size:11px;font-weight:900;color:#fff;text-shadow:0 1px 2px #000}
.msx .msx-qst .skip{position:absolute;right:10px;top:8px;font-size:10px;font-weight:800;color:#e2e8f0aa}
@keyframes msxQbg{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}
@keyframes msxQban{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.msx .msx-act,.msx .msx-qst{display:none}}
`;
let msxActCssDone = false;
const msxActEnsureCss = () => {
  if (msxActCssDone || typeof document === 'undefined') return;
  msxActCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-act-css', '1'); el.textContent = MSX_ACT_CSS; document.head.appendChild(el);
};
