// ===== モンヒロサクセスの訓練・修行の演出(2026-11-13 社長「トレーニングも修行も演出が入っていない」・参考動画の流れだけを取り入れる) =====
// 何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。押すと飛ばせる。「動きを減らす」設定では出さない(すぐ結果)
//   MsxTrainAct({ run, o, style, onDone }) … 訓練の結果の字の前に、訓練している場面(約1.3秒)。style: 'a' その場で動く / 'b' 集中線のカットイン
//   MsxShugyoStages({ run, o, line, onDone }) … 修行の結果の前に、助手の一言 →「STAGE 1 ◯◯&◯◯」→「STAGE 2 ◯◯&◯◯」(段ごとに景色が替わる・いっしょに修行した編成のモンスターの顔)

const MSX_ACT_MS = 1700;
// 修行の段ごとの景色(背景の絵 + 色のかぶせ)
const MSX_QSTAGE_BG = Object.freeze({
  fire: [['forest_evening', 'rgba(255,90,20,.35)'], ['desert_oilfield', 'rgba(255,40,0,.38)']],
  ice: [['forest_morning', 'rgba(120,200,255,.35)'], ['forest_night', 'rgba(150,220,255,.4)']],
  wind: [['forest_deep', 'rgba(120,255,170,.25)'], ['desert_hall', 'rgba(200,255,220,.25)']],
  star: [['monhero_night', 'rgba(150,120,255,.3)'], ['dark_void', 'rgba(200,170,255,.3)']],
});
const msxActCalm = () => typeof msxFxCalm === 'function' && msxFxCalm();
// 修行の段の背景(行き先ごとの表 MSX_QSTAGE_BG の名前から作る。どれも story-bg の絵)
const msxQstageBgUrl = (name) => 'images/story-bg/' + String(name || 'forest_evening') + '.jpg';

function MsxTrainAct({ run, o, onDone }) {
  msxActEnsureCss();
  const k = o && o.card && MSX_TRAIN_NAME[o.card.stat] ? o.card.stat : 'pow';
  const done = React.useRef(false);
  const finish = () => { if (done.current) return; done.current = true; onDone(); };
  React.useEffect(() => { if (msxActCalm()) { finish(); return undefined; } const id = setTimeout(finish, MSX_ACT_MS); return () => clearTimeout(id); }, []);
  if (msxActCalm()) return null;
  const n = (c) => Array.from({ length: c }, (_, i) => i);
  // 訓練ごとの小物(絵は使わず CSS と絵文字で描く)
  const prop = k === 'pow' ? <div className="pr logs">{n(3).map((i) => <i key={i} style={{ '--i': i }}><b/></i>)}<em className="boom">💥</em></div>
    : k === 'tough' ? <div className="pr rock"><i>🪨</i><em className="ring"/></div>
    : k === 'hit' ? <div className="pr tgt"><i/><em className="shot">⭐</em><em className="boom">💥</em></div>
    : k === 'eva' ? <div className="pr leaves">{n(8).map((i) => <i key={i} style={{ '--i': i }}>{i % 3 === 1 ? '🍃' : '🍂'}</i>)}</div>
    : k === 'wise' ? <div className="pr blocks">{n(5).map((i) => <i key={i} style={{ '--i': i }}/>)}<em className="idea">💡</em></div>
    : <div className="pr run"><span className="spd"/>{n(3).map((i) => <i key={i} style={{ '--i': i }}>💨</i>)}</div>;
  return (
    <div className={`msx-act t-${k}`} onClick={finish} data-msx-act={k}>
      <span className={k === 'life' ? 'lines h' : 'lines'} aria-hidden="true"/>
      {k === 'tough' || k === 'eva' ? null : prop}
      <div className="me"><MsxMonArt run={run} className="mon" live/></div>
      {k === 'tough' || k === 'eva' ? prop : null}
      <div className="ban"><small>{MSX_STAT_NAME[k]}の訓練</small>{MSX_TRAIN_ICON[k]} {MSX_TRAIN_NAME[k]}!</div>
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
      <img key={`bg${st}`} className="bg" src={msxQstageBgUrl(bg)} alt=""/>
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
.msx .msx-act{position:absolute;inset:0;z-index:8;overflow:hidden;cursor:pointer;background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.05),rgba(10,8,30,.72))}
.msx .msx-act .lines{position:absolute;inset:-20%;background:repeating-conic-gradient(from 0deg at 50% 55%,rgba(255,255,255,.5) 0 1.2deg,transparent 1.2deg 9deg);-webkit-mask:radial-gradient(circle at 50% 55%,transparent 26%,#000 48%);mask:radial-gradient(circle at 50% 55%,transparent 26%,#000 48%);animation:msxActLines .35s linear infinite}
.msx .msx-act .lines.h{inset:0;background:repeating-linear-gradient(180deg,transparent 0 13px,rgba(255,255,255,.45) 13px 15px,transparent 15px 31px);-webkit-mask:linear-gradient(90deg,#000,transparent 30%,transparent 70%,#000);mask:linear-gradient(90deg,#000,transparent 30%,transparent 70%,#000);animation:msxActRunL .25s linear infinite}
.msx .msx-act .me{position:absolute;inset:0;z-index:2}
.msx .msx-act .me .mon{left:50%;bottom:12%;height:56%}
.msx .msx-act .ban{position:absolute;left:0;right:0;bottom:4%;z-index:6;text-align:center;font-size:28px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 3px 0 #7c2d12;background:linear-gradient(90deg,transparent,#7c2d12cc 18%,#7c2d12cc 82%,transparent);padding:2px 0 4px;animation:msxActBan .4s cubic-bezier(.2,1.4,.4,1) both}
.msx .msx-act .ban small{display:block;font-size:12px;font-style:normal;-webkit-text-stroke:0;text-shadow:0 1px 0 #000;color:#fde68a}
.msx .msx-act .pr{position:absolute;inset:0;z-index:3;pointer-events:none}
.msx .msx-act .pr em{position:absolute;font-style:normal}
.msx .msx-act.t-pow .me{animation:msxActLunge .7s cubic-bezier(.3,1.4,.5,1) .3s both}
.msx .msx-act.t-pow .me .mon{left:70%}
.msx .msx-act .logs{left:3%;right:auto;width:33%;top:auto;bottom:16%;height:50%;display:flex;gap:4px;align-items:flex-end}
.msx .msx-act .logs i{position:relative;flex:1;height:100%;border-radius:6px;background:repeating-linear-gradient(90deg,#b45309 0 3px,#d97706 3px 9px,#c2410c 9px 11px);border:2px solid #78350f;box-shadow:inset 0 0 0 2px #f59e0b55;animation:msxActLog .6s ease-in .75s both;--dx:calc((var(--i) - 1) * 40px)}
.msx .msx-act .logs i b{position:absolute;left:10%;right:10%;top:20%;bottom:20%;opacity:0;background:linear-gradient(115deg,transparent 46%,#1c0a00 47% 50%,transparent 51%),linear-gradient(65deg,transparent 46%,#1c0a00 47% 50%,transparent 51%);animation:msxActOn .05s linear .55s both}
.msx .msx-act .logs .boom{left:70%;top:24%;font-size:56px;animation:msxActHit .5s ease-out .52s both}
.msx .msx-act.t-tough .me{animation:msxActSquash .5s ease-out .55s both}
.msx .msx-act .rock i{position:absolute;left:50%;top:6%;font-style:normal;font-size:130px;line-height:1;transform:translateX(-50%);animation:msxActDrop .55s cubic-bezier(.5,0,1,.6) .1s both;filter:drop-shadow(0 8px 6px #0008)}
.msx .msx-act .rock .ring{left:50%;top:22%;width:60%;height:14%;margin-left:-30%;border:4px solid #fde68a;border-radius:50%;opacity:0;animation:msxActRing .5s ease-out .62s both}
.msx .msx-act.t-tough .lines{animation:msxActLines .35s linear infinite,msxActShake .3s linear .62s 1}
.msx .msx-act.t-hit .me .mon{left:32%}
.msx .msx-act .tgt i{position:absolute;right:6%;top:30%;width:96px;height:96px;border-radius:50%;background:radial-gradient(circle,#dc2626 0 12%,#fff 12% 26%,#dc2626 26% 40%,#fff 40% 55%,#dc2626 55% 70%,#fff 70%);border:3px solid #7f1d1d;box-shadow:0 6px 0 #0006;animation:msxActTgt .3s ease-out .78s both}
.msx .msx-act .tgt .shot{left:36%;top:46%;font-size:34px;animation:msxActShot .4s cubic-bezier(.4,0,.8,.6) .35s both}
.msx .msx-act .tgt .boom{right:9%;top:32%;font-size:48px;animation:msxActHit .5s ease-out .74s both}
.msx .msx-act.t-eva .me{animation:msxActDodge .9s ease-in-out .2s both}
.msx .msx-act .leaves i{position:absolute;font-style:normal;font-size:30px;top:-12%;left:calc(4% + var(--i) * 12%);animation:msxActLeaf 1.1s linear both;animation-delay:calc(var(--i) * .09s)}
.msx .msx-act.t-wise .me .mon{left:64%}
.msx .msx-act .blocks i{position:absolute;left:12%;width:52px;height:40px;border-radius:6px;border:2px solid #0006;bottom:calc(14% + var(--i) * 40px);margin-left:calc((var(--i) % 2) * 10px);background:hsl(calc(var(--i) * 62 + 10),85%,60%);box-shadow:inset 0 -6px 0 #0002;animation:msxActBlock .28s cubic-bezier(.3,1.5,.6,1) both;animation-delay:calc(.15s + var(--i) * .18s)}
.msx .msx-act .blocks .idea{left:56%;top:12%;font-size:46px;animation:msxActHit .6s ease-out 1.1s both}
.msx .msx-act.t-life .me{animation:msxActBob .22s ease-in-out infinite alternate}
.msx .msx-act .run i{position:absolute;font-style:normal;font-size:34px;left:56%;bottom:12%;animation:msxActPuff .5s linear infinite;animation-delay:calc(var(--i) * .17s)}
@keyframes msxActLines{to{transform:rotate(9deg)}}
@keyframes msxActRunL{to{background-position:0 31px}}
@keyframes msxActOn{to{opacity:1}}
@keyframes msxActHit{0%{opacity:0;transform:scale(.3)}35%{opacity:1;transform:scale(1.35)}100%{opacity:0;transform:scale(1.1)}}
@keyframes msxActLunge{0%{transform:none}35%{transform:translateX(-22%)}60%{transform:translateX(-18%)}100%{transform:translateX(-6%)}}
@keyframes msxActLog{to{opacity:0;transform:translate(var(--dx),40px) rotate(calc((var(--i) - 1) * 35deg))}}
@keyframes msxActDrop{from{transform:translate(-50%,-140%)}to{transform:translate(-50%,0)}}
@keyframes msxActSquash{0%{transform:none}30%{transform:translateY(4%) scaleY(.92)}100%{transform:none}}
@keyframes msxActRing{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
@keyframes msxActShake{25%{transform:translate(-6px,3px)}50%{transform:translate(6px,-3px)}75%{transform:translate(-3px,2px)}}
@keyframes msxActShot{from{transform:none;opacity:1}to{transform:translate(170px,-24px) rotate(360deg);opacity:.9}}
@keyframes msxActTgt{0%{transform:none}40%{transform:scale(1.15)}100%{transform:none}}
@keyframes msxActDodge{0%,100%{transform:none}25%{transform:translateX(-18%)}55%{transform:translateX(16%)}80%{transform:translateX(-8%)}}
@keyframes msxActLeaf{from{transform:translate(0,0) rotate(0)}to{transform:translate(70px,620px) rotate(320deg)}}
@keyframes msxActBlock{from{opacity:0;transform:translateY(-60px)}to{opacity:1;transform:none}}
@keyframes msxActBob{from{transform:translateY(0)}to{transform:translateY(-3%)}}
@keyframes msxActPuff{0%{opacity:0;transform:translateX(0) scale(.6)}20%{opacity:1}100%{opacity:0;transform:translateX(-170px) scale(1.3)}}
@keyframes msxActBan{from{opacity:0;transform:translateY(-14px) scale(.8)}to{opacity:1;transform:none}}
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
