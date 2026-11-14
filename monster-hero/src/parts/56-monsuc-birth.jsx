// ===== モンヒロサクセスの育成のはじまり: 円盤石からサクセスモンが生まれる演出(2026-11-13 社長 r1113-008) =====
// 「育成の始まりは、ベースモンでも合体円盤石でも、円盤石から生まれる演出にする」。参考の実物は無い(REF-MAP「確認」の行: 参考なし)ので、
// 覚醒の演出(56-monsuc-awake.jsx)と同じ作り: 段が進む → 早送り・短縮 → 最後に「つぎへ」。
//   0 円盤石が浮かぶ → 1 光があふれて震える → 2 閃光 → 3 サクセスモンが現れる(名前の札)
// 絵は円盤石の土台 DISC_STONE_BASE(data/breeder.js・全モンスター共通)。何も保存しない・公開の印は持たない(モンサクの画面の中からだけ呼ぶ)。
// 「動きを減らす」設定(msxFxCalm)と prefers-reduced-motion では、はじめから 3 の静かな形にする。

const MSX_BIRTH_STEPS = Object.freeze([1300, 2500, 3100]); // 0→1・1→2・2→3 に替わる時刻(ミリ秒)
const msxBirthStone = () => (typeof DISC_STONE_BASE === 'string' ? DISC_STONE_BASE : 'images/disc-icons/disc-stone-base.PNG');
const msxBirthCalm = () => {
  if (typeof msxFxCalm === 'function' && msxFxCalm()) return true;
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

function MsxBirth({ run, v, ev, onDone }) {
  msxBirthEnsureCss();
  const calm = msxBirthCalm();
  const [st, setSt] = React.useState(calm ? 3 : 0);
  React.useEffect(() => {
    if (calm || st >= 3) return undefined;
    const id = setTimeout(() => setSt((n) => Math.min(3, n + 1)), MSX_BIRTH_STEPS[st] - (st ? MSX_BIRTH_STEPS[st - 1] : 0));
    return () => clearTimeout(id);
  }, [st]);
  // 段ごとの音(覚醒の演出と同じ音を使う)
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(st === 1 ? [['awQi', 0]] : st === 2 ? [['awFlash', 0]] : st === 3 && !calm ? [['awKira', 0]] : [], [st]);
  const s = run.s;
  const fused = Boolean(run.from && typeof run.from.box === 'string');
  const name = run.nick || (typeof msxMonName === 'function' ? msxMonName(s.species) : '');
  return (<>
    {typeof MsxBand === 'function' ? <MsxBand s={s} v={v} ev={ev}/> : null}
    <div className={`v-scene msx-birth st${st}${calm ? ' calm' : ''}`} style={{ flex: '1 1 0' }} data-msx-birth={st}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <span className="msx-birth-dim" aria-hidden="true"/>
      {st < 3 ? <span className="msx-birth-stone" aria-hidden="true"><img src={msxBirthStone()} alt=""/>{st >= 1 ? <i className="glow"/> : null}</span> : null}
      {st === 1 || st === 2 ? <span className="msx-birth-rays" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <i key={i} style={{ '--i': i }}/>)}</span> : null}
      {st === 2 ? <span className="msx-birth-flash" aria-hidden="true"/> : null}
      {st >= 3 ? <><div className="gr" style={{ bottom: 'calc(14% - 5px)' }}/>
        <MsxMonArt run={run} className="mon msx-birth-mon" style={{ bottom: '14%', height: '46%' }} live noPeak/></> : null}
      <div className="msx-birth-head"><small>{fused ? '合体円盤石' : 'ベースモンの円盤石'}</small>{st >= 3 ? `${name}が生まれた!` : '円盤石が光りはじめた…'}</div>
      {st < 3 && !calm ? <div className="msx-aw-ctl"><button type="button" onClick={() => setSt((n) => Math.min(3, n + 1))} data-msx-birth-ff>早送り ⏩</button><button type="button" onClick={() => setSt(3)} data-msx-birth-skip>短縮 ⏭</button></div> : null}
    </div>
    <div className="v-log">{st >= 3 ? <>円盤石から、<b>{name}</b>が生まれた! ここから育成がはじまる。</> : <>円盤石が、あたたかい光につつまれていく…</>}</div>
    <div className="v-ft"><button type="button" className="go" disabled={st < 3} onClick={onDone} data-msx-birth-next>育成をはじめる ▶</button></div>
  </>);
}

const MSX_BIRTH_CSS = `
.msx-birth-dim{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(255,255,255,0),rgba(15,23,42,.55));pointer-events:none;transition:opacity .6s}
.msx-birth.st3 .msx-birth-dim{opacity:.35}
.msx-birth-stone{position:absolute;left:50%;bottom:26%;width:46%;max-width:220px;aspect-ratio:1/1;transform:translateX(-50%);animation:msxBirthFloat 2.4s ease-in-out infinite}
.msx-birth-stone img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45))}
.msx-birth-stone .glow{position:absolute;inset:-18%;border-radius:50%;background:radial-gradient(circle,rgba(255,250,220,.95),rgba(253,224,71,.55) 40%,rgba(253,224,71,0) 70%);animation:msxBirthGlow .9s ease-in-out infinite alternate}
.msx-birth.st1 .msx-birth-stone,.msx-birth.st2 .msx-birth-stone{animation:msxBirthShake .18s linear infinite}
.msx-birth-rays{position:absolute;left:50%;bottom:calc(26% + 23%);width:0;height:0;pointer-events:none}
.msx-birth-rays i{position:absolute;left:-3px;bottom:0;width:6px;height:46vmin;max-height:300px;transform-origin:50% 100%;transform:rotate(calc(var(--i) * 45deg));background:linear-gradient(to top,rgba(255,251,235,.95),rgba(253,224,71,0));border-radius:3px;animation:msxBirthRay 1.2s ease-out infinite;animation-delay:calc(var(--i) * .07s)}
.msx-birth-flash{position:absolute;inset:0;background:#fff;animation:msxBirthFlash .6s ease-out forwards;pointer-events:none}
.msx-birth-mon{animation:msxBirthPop .7s cubic-bezier(.2,1.4,.4,1) both}
.msx-birth-head{position:absolute;left:50%;top:7%;transform:translateX(-50%);padding:6px 16px;border-radius:12px;background:rgba(15,23,42,.72);color:#fff;font-weight:900;font-size:17px;text-align:center;white-space:nowrap;box-shadow:0 0 0 2px rgba(253,224,71,.8)}
.msx-birth-head small{display:block;font-size:11px;color:#fde68a;font-weight:800}
.msx-birth.calm .msx-birth-stone,.msx-birth.calm .msx-birth-mon{animation:none}
@keyframes msxBirthFloat{0%,100%{transform:translateX(-50%) translateY(0)}50%{transform:translateX(-50%) translateY(-8px)}}
@keyframes msxBirthShake{0%{transform:translateX(-50%) rotate(0)}25%{transform:translateX(calc(-50% - 3px)) rotate(-2deg)}75%{transform:translateX(calc(-50% + 3px)) rotate(2deg)}100%{transform:translateX(-50%) rotate(0)}}
@keyframes msxBirthGlow{from{opacity:.55;transform:scale(.92)}to{opacity:1;transform:scale(1.08)}}
@keyframes msxBirthRay{from{opacity:.95;transform:rotate(calc(var(--i) * 45deg)) scaleY(.3)}to{opacity:0;transform:rotate(calc(var(--i) * 45deg)) scaleY(1)}}
@keyframes msxBirthFlash{from{opacity:1}to{opacity:0}}
@keyframes msxBirthPop{from{opacity:0;transform:translateX(-50%) scale(.3)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@media (prefers-reduced-motion: reduce){.msx-birth-stone,.msx-birth-rays i,.msx-birth-mon,.msx-birth-stone .glow{animation:none}}
`;
let msxBirthCssDone = false;
const msxBirthEnsureCss = () => {
  if (msxBirthCssDone || typeof document === 'undefined') return;
  msxBirthCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-birth-css', '1'); el.textContent = MSX_BIRTH_CSS; document.head.appendChild(el);
};
