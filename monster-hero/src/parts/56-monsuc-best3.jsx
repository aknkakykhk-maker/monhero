// ===== モンヒロサクセスの「自分だけのベスト3」(2026-11-13 社長 r1113-057②) =====
// 育成が終わった(引退した)あとに、種に関係なく総合力の上位3つを出す。今回が入ったら、下からせり上がって入り込み、
// 押し出された行は1段下がる。1位なら「自己ベスト更新!」、2・3位なら「ベスト3入り!」。入らなければ「ベスト3まで あと ◯」。
// 記録は芯ではなく保存枠の部品(56-monhero-success-r3-store.jsx の msxR3Retire)が mh_monsuc_meta_v1 の best3 に足す。ここは見せるだけ。
// 「動きを減らす」設定(msxFxCalm)と prefers-reduced-motion では、動かさずに並べ終わりの形を出す。

// 1行の高さ(px)。せり上がる距離もこれで数える。横長の低い画面では詰める
const msxB3Row = () => (typeof window !== 'undefined' && window.innerHeight < 520 ? 46 : 64);
const msxB3Calm = () => {
  if (typeof msxFxCalm === 'function' && msxFxCalm()) return true;
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

// b = { prev, next, place, power }(msxR3Retire の best3)
function MsxBest3({ b, run }) {
  msxB3EnsureCss();
  const calm = msxB3Calm();
  const MSX_B3_ROW = msxB3Row();
  const [go, setGo] = React.useState(calm);
  React.useEffect(() => { if (calm) return undefined; const id = setTimeout(() => setGo(true), 650); return () => clearTimeout(id); }, []);
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(go && b.place >= 0 && !calm ? [['awKira', 250]] : [], [go]);
  const next = Array.isArray(b.next) ? b.next : []; const prev = Array.isArray(b.prev) ? b.prev : [];
  const inIt = b.place >= 0;
  // 動き出す前の位置: 今回の行は「4位の場所」から、押し出された行は1つ上の場所から
  const startOf = (i, e) => {
    if (!inIt) return 0;
    if (e.id === next[b.place].id) return (3 - b.place) * MSX_B3_ROW;
    const was = prev.findIndex((x) => x.id === e.id);
    return was >= 0 ? (was - i) * MSX_B3_ROW : 0;
  };
  const third = next.length >= 3 ? next[2].power : null;
  const fmt = (n) => (typeof msxFmt === 'function' ? msxFmt(n) : Number(n).toLocaleString());
  const name = (e) => e.nick || (typeof msxMonName === 'function' ? msxMonName(e.species) : e.species);
  const thumb = (sp) => (typeof msxMonThumb === 'function' ? msxMonThumb(sp) : '');
  const stamp = !inIt ? null : b.place === 0 ? '自己ベスト更新!' : 'ベスト3入り!';
  return (<>
    {run && typeof MsxMonArt === 'function' ? <div className="v-scene" style={{ flex: '1 1 0', minHeight: 150 }} data-msx-best3-scene>
      <img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/>{inIt ? <div className="v-burst"/> : null}
      <div className="gr" style={{ bottom: 'calc(10% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '10%', height: '70%' }}/>
      <div className="v-stamp msx-pop" style={{ top: '6%', fontSize: 22 }}>{run.nick || msxMonName(run.s.species)}<small>総合力 {fmt(b.power)}</small></div>
    </div> : null}
    <div className="v-h">🏆 自分だけのベスト3<small>これまでに育てたモンスターの、総合力の上位3つ</small></div>
    <div className={`msx-b3${go ? ' go' : ''}${calm ? ' calm' : ''}`} data-msx-best3={inIt ? b.place + 1 : 0} style={{ height: MSX_B3_ROW * 3 + 16 }}>
      {[0, 1, 2].map((i) => <div key={`slot-${i}`} className="slot" style={{ top: 8 + i * MSX_B3_ROW, height: MSX_B3_ROW - 8 }}><b className={`pl p${i + 1}`}>{i + 1}</b>{next[i] ? null : <span className="none">まだない</span>}</div>)}
      {next.map((e, i) => {
        const me = inIt && i === b.place;
        return (<div key={e.id} className={`row${me ? ' me' : ''}`} data-msx-best3-row={i + 1}
          style={{ top: 8 + i * MSX_B3_ROW, height: MSX_B3_ROW - 8, transform: go ? 'translateY(0)' : `translateY(${startOf(i, e)}px)` }}>
          <b className={`pl p${i + 1}`}>{i + 1}</b>
          {thumb(e.species) ? <img src={thumb(e.species)} alt=""/> : null}
          <span className="nm">{name(e)}{me ? <small>今回</small> : null}</span>
          <span className="rk">{e.rank}</span>
          <b className="pw">{fmt(e.power)}</b>
        </div>);
      })}
    </div>
    {stamp ? <div className={`msx-b3-stamp${go ? ' on' : ''}`} data-msx-best3-stamp>{stamp}</div>
      : <div className="v-card" data-msx-best3-miss><div className="v-kv"><b>今回</b><span>総合力 <b>{fmt(b.power)}</b></span></div>{third != null ? <div className="v-kv"><b>3位まで</b><span>あと <b className="yel">{fmt(Math.max(1, third - b.power + 1))}</b></span></div> : null}</div>}
    {typeof MsxSay === 'function' && run ? <MsxSay aid={run.s.aid} ex={inIt ? 'excited' : 'happy'} text={inIt ? (b.place === 0 ? '「新記録! いちばん強いモンスターが生まれたね!」' : `「ベスト3に入ったよ! ${b.place + 1}番目!」`) : '「次はベスト3をめざそ!」'}/> : null}
  </>);
}

const MSX_B3_CSS = `
.msx-b3{position:relative;margin:4px 0 6px;overflow:hidden}
.msx-b3 .slot{position:absolute;left:0;right:0;border-radius:12px;border:1.5px dashed #47556988;display:flex;align-items:center;gap:8px;padding:0 10px}
.msx-b3 .slot .none{flex:1;text-align:center;color:#94a3b8;font-size:12px;font-weight:800}
.msx-b3 .row{position:absolute;left:0;right:0;border-radius:12px;background:#0f172a;border:1.5px solid #475569;display:flex;align-items:center;gap:8px;padding:0 10px;transition:transform .8s cubic-bezier(.2,1.2,.4,1)}
.msx-b3.calm .row{transition:none}
.msx-b3 .row.me{border-color:#fde047;background:#3b2f0b;box-shadow:0 0 12px #fde04788;z-index:2}
.msx-b3 .pl{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;background:#334155;color:#fff;flex:0 0 auto}
.msx-b3 .pl.p1{background:linear-gradient(#fde68a,#d97706);color:#422006}.msx-b3 .pl.p2{background:linear-gradient(#f1f5f9,#94a3b8);color:#1e293b}.msx-b3 .pl.p3{background:linear-gradient(#fdba74,#b45309);color:#431407}
.msx-b3 .row img{width:40px;height:min(40px,100%);object-fit:contain;flex:0 0 auto}
.msx-b3 .row .nm{flex:1;min-width:0;font-size:13px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msx-b3 .row .nm small{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;background:#fde047;color:#422006;font-size:10px}
.msx-b3 .row .rk{font-size:13px;font-weight:900;color:#a5f3fc;min-width:26px;text-align:center}
.msx-b3 .row .pw{font-size:16px;font-weight:900;color:#fde047;min-width:62px;text-align:center}
.msx-b3-stamp{align-self:center;margin:2px auto 6px;padding:6px 18px;border-radius:14px;background:linear-gradient(90deg,#f59e0b,#ec4899);color:#fff;font-size:20px;font-weight:900;text-align:center;opacity:0;transform:scale(.6);transition:opacity .4s .6s,transform .5s .6s cubic-bezier(.2,1.6,.4,1)}
.msx-b3-stamp.on{opacity:1;transform:scale(1)}
@media (prefers-reduced-motion: reduce){.msx-b3 .row,.msx-b3-stamp{transition:none}}
`;
let msxB3CssDone = false;
const msxB3EnsureCss = () => {
  if (msxB3CssDone || typeof document === 'undefined') return;
  msxB3CssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-best3-css', '1'); el.textContent = MSX_B3_CSS; document.head.appendChild(el);
};
