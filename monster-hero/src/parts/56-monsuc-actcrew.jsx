// ===== モンヒロサクセスのトレーニングの演出に、いっしょにいた編成の子と助手を出す(2026-11-14 社長「トレーニングの演出で、いっしょにいたモンスターとか助手も絵でも出してほしい」) =====
// MsxTrainAct(56-monsuc-actfx.jsx)の場面の中に重ねる。動きは CSS だけ。何も保存しない・公開の印は持たない。
//   MsxActCrew({ run, o }) … o.card.members(集まった編成の子の番号)・o.card.tags(友情タッグの番号と 'aid')・o.card.aid(助手が来た)
//   ・編成の子は手前の左右の端に並び、跳ねて応援する。友情タッグの子は大きく・金色に光り「🤝」の札
//   ・助手は右の手前に全身の絵で立ち、ひとこと「がんばれ〜!」(タッグなら金色)
// 置き場所(育てる子は真ん中を大きく使うので、手前の左右の端に縦に並べる)。助手が来たときは右下を助手が使う
const MSX_CREW_SPOT = Object.freeze([
  { left: '10%', bottom: '14%' }, { left: '90%', bottom: '14%' }, { left: '10%', bottom: '31%' }, { left: '90%', bottom: '31%' }, { left: '10%', bottom: '48%' }, { left: '90%', bottom: '48%' },
]);
const MSX_CREW_SPOT_AID = Object.freeze([
  { left: '10%', bottom: '14%' }, { left: '10%', bottom: '31%' }, { left: '10%', bottom: '48%' }, { left: '90%', bottom: '62%' }, { left: '10%', bottom: '65%' }, { left: '72%', bottom: '70%' },
]);
const MSX_CREW_CSS = `
.msx .msx-act .crew{position:absolute;inset:0;z-index:4;pointer-events:none}
.msx .msx-act .crew .cm{position:absolute;transform:translateX(-50%);height:15%;aspect-ratio:1/1;display:flex;align-items:flex-end;justify-content:center;animation:msxCrewIn .35s cubic-bezier(.2,1.4,.4,1) both;animation-delay:calc(.08s + var(--i) * .07s)}
.msx .msx-act .crew .cm img{max-height:100%;max-width:100%;object-fit:contain;filter:drop-shadow(0 3px 0 #0007);animation:msxCrewHop .5s ease-in-out infinite alternate;animation-delay:calc(var(--i) * .11s)}
.msx .msx-act .crew .cm.tag{height:19%}
.msx .msx-act .crew .cm.tag img{filter:drop-shadow(0 0 6px #fde047) drop-shadow(0 0 14px #f59e0b) drop-shadow(0 3px 0 #0007)}
.msx .msx-act .crew .cm .tg{position:absolute;top:-16px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;font-weight:900;color:#7c2d12;background:linear-gradient(#fef08a,#f59e0b);border:1.5px solid #fff;border-radius:99px;padding:0 6px;box-shadow:0 2px 0 #0006}
.msx .msx-act .crew .cm .ch{position:absolute;top:-6px;right:-8px;font-size:16px;animation:msxCrewCheer .6s ease-in-out infinite alternate}
.msx .msx-act .crew .aid{position:absolute;right:-8%;bottom:10%;height:44%;width:38%;display:flex;align-items:flex-end;justify-content:flex-end;animation:msxCrewSide .4s cubic-bezier(.2,1.3,.4,1) .15s both}
.msx .msx-act .crew .aid img{height:100%;max-width:100%;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 4px 0 #0006)}
.msx .msx-act .crew .aid.tag img{filter:drop-shadow(0 0 8px #fde047) drop-shadow(0 4px 0 #0006)}
.msx .msx-act .crew .aid .say{position:absolute;right:46%;top:-4%;white-space:nowrap;font-size:13px;font-weight:900;color:#be185d;background:#fff;border:2px solid #f9a8d4;border-radius:12px;padding:2px 8px;box-shadow:0 2px 0 #0005;animation:msxCrewPop .3s cubic-bezier(.2,1.4,.4,1) .45s both}
.msx .msx-act .crew .aid.tag .say{color:#7c2d12;background:linear-gradient(#fef9c3,#fde68a);border-color:#f59e0b}
@keyframes msxCrewIn{from{opacity:0;transform:translateX(-50%) translateY(14px) scale(.6)}to{opacity:1;transform:translateX(-50%)}}
@keyframes msxCrewHop{from{transform:translateY(0)}to{transform:translateY(-12%)}}
@keyframes msxCrewCheer{from{transform:rotate(-14deg) scale(.9)}to{transform:rotate(14deg) scale(1.1)}}
@keyframes msxCrewSide{from{opacity:0;transform:translateX(30%)}to{opacity:1;transform:none}}
@keyframes msxCrewPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
`;
let msxCrewCssDone = false;
const msxCrewEnsureCss = () => {
  if (msxCrewCssDone || typeof document === 'undefined') return;
  msxCrewCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-crew-css', '1'); el.textContent = MSX_CREW_CSS; document.head.appendChild(el);
};
function MsxActCrew({ run, o }) {
  msxCrewEnsureCss();
  const s = run && run.s; const card = o && o.card;
  if (!s || !card) return null;
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const team = Array.isArray(s.team) ? s.team : [];
  const ms = (Array.isArray(card.members) ? card.members : []).filter((i) => Number.isInteger(i) && team[i] && team[i].species).slice(0, MSX_CREW_SPOT.length);
  // タッグの子を手前(はじめの場所)に
  ms.sort((a, b) => Number(tags.includes(b)) - Number(tags.includes(a)));
  const aid = Boolean(card.aid || tags.includes('aid')) && s.aid;
  const aidImg = aid && typeof msxBody === 'function' ? msxBody(s.aid, 'happy') : '';
  const SPOT = aidImg ? MSX_CREW_SPOT_AID : MSX_CREW_SPOT;
  if (!ms.length && !aidImg) return null;
  return (
    <div className="crew" aria-hidden="true" data-msx-crew={ms.length} data-msx-crew-tag={ms.filter((i) => tags.includes(i)).length} data-msx-crew-aid={aidImg ? 1 : 0}>
      {ms.map((i, n) => { const tag = tags.includes(i); const img = typeof msxMonImg === 'function' ? msxMonImg(team[i].species) : ''; return img ? (
        <div key={i} className={`cm${tag ? ' tag' : ''}`} style={{ ...SPOT[n], '--i': n }}>
          <img src={img} alt=""/>{tag ? <b className="tg">🤝 タッグ</b> : <i className="ch">📣</i>}
        </div>) : null; })}
      {aidImg ? <div className={`aid${tags.includes('aid') ? ' tag' : ''}`}><img src={aidImg} alt=""/><b className="say">{tags.includes('aid') ? '🤝 いっしょに!' : 'がんばれ〜!'}</b></div> : null}
    </div>
  );
}
