// ===== モンヒロサクセスのトレーニングの演出に、いっしょにいた編成の子と助手を出す(2026-11-14 社長「トレーニングの演出で、いっしょにいたモンスターとか助手も絵でも出してほしい」) =====
// MsxTrainAct(56-monsuc-actfx.jsx)の場面の中に重ねる。動きは CSS だけ。何も保存しない・公開の印は持たない。
//   MsxActCrew({ run, o }) … o.card.members(集まった編成の子の番号)・o.card.tags(友情タッグの番号と 'aid')・o.card.aid(助手が来た)
//   ・編成の子は手前の左右の端に並び、跳ねて応援する。友情タッグの子は大きく・金色に光り「🤝」の札
//   ・助手は右の手前に全身の絵で立ち、ひとこと「がんばれ〜!」(タッグなら金色)
//   友情タッグが起きたとき(o.card.tags が1つ以上): タッグの子は育てる子のすぐ横に大きく並んでいっしょに跳び、
//   上に金色の帯のカットイン(育てる子とタッグの子の顔・助手の顔・「友情タッグ!」)・金色の光と星・専用の音 friendTag(場面 actTag)。押すと飛ばせる(MsxTrainAct ごと)
//   MsxBondChips({ s, card, add }) … トレーニングの結果の右下の「◯◯ 親密度 +8」の札。名前の左に顔(編成の欄と同じ絵)、助手が来ていれば助手の札も。
//   友情タッグの子は金色の縁と「🤝」。名前が長くても札の幅で切る(… で省く)ので、場面の外へはみ出さない(2026-11-14 社長「名前の横にアイコンがほしい」)
// 置き場所(育てる子は真ん中を大きく使うので、手前の左右の端に縦に並べる)。助手が来たときは右下を助手が使う
const MSX_CREW_SPOT = Object.freeze([
  { left: '10%', bottom: '14%' }, { left: '90%', bottom: '14%' }, { left: '10%', bottom: '31%' }, { left: '90%', bottom: '31%' }, { left: '10%', bottom: '48%' }, { left: '90%', bottom: '48%' },
]);
const MSX_CREW_SPOT_AID = Object.freeze([
  { left: '10%', bottom: '14%' }, { left: '10%', bottom: '31%' }, { left: '10%', bottom: '48%' }, { left: '90%', bottom: '62%' }, { left: '10%', bottom: '65%' }, { left: '72%', bottom: '70%' },
]);
// タッグの子の置き場所(育てる子のすぐ横・手前)。3体目からは少し奥
const MSX_CREW_SPOT_TAG = Object.freeze([{ left: '22%', bottom: '12%' }, { left: '78%', bottom: '12%' }, { left: '12%', bottom: '34%' }, { left: '88%', bottom: '34%' }]);
// 助手が来たときは右下を助手が使うので、タッグの子は左と右の奥へ
const MSX_CREW_SPOT_TAG_AID = Object.freeze([{ left: '20%', bottom: '10%' }, { left: '10%', bottom: '33%' }, { left: '84%', bottom: '58%' }, { left: '14%', bottom: '56%' }]);
const MSX_CREW_CSS = `
.msx .msx-act .crew .cm.duo{height:27%;animation:msxCrewIn .3s cubic-bezier(.2,1.4,.4,1) both}
.msx .msx-act .crew .cm.duo img{animation:msxCrewJump .7s cubic-bezier(.3,0,.4,1) .35s 2 both}
.msx .msx-act.tagx .me .mon{animation:msxCrewJumpMe .7s cubic-bezier(.3,0,.4,1) .35s 2 both}
.msx .msx-act .tagglow{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at 50% 60%,#fde04755,#f59e0b22 45%,transparent 70%);animation:msxTagGlow .9s ease-in-out .1s 2 alternate both}
.msx .msx-act .tagstar{position:absolute;z-index:5;pointer-events:none;font-style:normal;font-size:20px;left:calc(8% + var(--i) * 12%);top:calc(30% + (var(--i) * 37 % 40) * 1%);animation:msxTagStar .9s ease-out both;animation-delay:calc(.5s + var(--i) * .06s);filter:drop-shadow(0 0 6px #fde047)}
.msx .msx-act .tagcut{position:absolute;left:-4%;right:-4%;top:9%;z-index:7;pointer-events:none;height:76px;transform:rotate(-4deg);background:linear-gradient(90deg,#78350fee,#f59e0bf2 30%,#fde047f5 50%,#f59e0bf2 70%,#78350fee);border-top:3px solid #fff7c2;border-bottom:3px solid #fff7c2;box-shadow:0 0 24px #fde047aa;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 6%;animation:msxTagCut 1.25s cubic-bezier(.2,.9,.3,1) .05s both}
.msx .msx-act .tagcut .fc{width:min(44px,11vw);height:min(44px,11vw);flex:none;border-radius:50%;background:#fff;border:3px solid #fff7c2;box-shadow:0 0 0 2px #b45309,0 3px 0 #0006;overflow:hidden;display:flex;align-items:center;justify-content:center}
.msx .msx-act .tagcut .fc img{width:100%;height:100%;object-fit:cover}
.msx .msx-act .tagcut .x{font-size:15px;font-weight:900;color:#7c2d12}
.msx .msx-act .tagcut b{margin-left:4px;font-size:min(26px,6.6vw);font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #7c2d12;paint-order:stroke fill;text-shadow:0 3px 0 #7c2d12;white-space:nowrap}
.msx .msx-act .tagcut b small{display:block;font-size:12px;-webkit-text-stroke:0;text-shadow:none;color:#7c2d12;font-style:normal}
@keyframes msxCrewJump{0%,100%{transform:translateY(0)}40%{transform:translateY(-34%) scale(1.05)}70%{transform:translateY(0) scaleY(.92)}}
@keyframes msxCrewJumpMe{0%,100%{translate:0 0}40%{translate:0 -18%}70%{translate:0 0}}
@keyframes msxTagGlow{from{opacity:.2}to{opacity:1}}
@keyframes msxTagStar{0%{opacity:0;transform:scale(.3) rotate(0)}40%{opacity:1;transform:scale(1.2) rotate(90deg)}100%{opacity:0;transform:scale(.6) translateY(-30px) rotate(180deg)}}
@keyframes msxTagCut{0%{opacity:0;transform:rotate(-4deg) translateX(-110%)}18%{opacity:1;transform:rotate(-4deg) translateX(0)}80%{opacity:1;transform:rotate(-4deg) translateX(0) scale(1)}100%{opacity:0;transform:rotate(-4deg) translateX(30%) scale(.96)}}
.msx .v-bchips{position:absolute;right:7px;bottom:8px;display:flex;flex-direction:column;align-items:flex-end;gap:3px;max-width:calc(100% - 14px);z-index:3}
.msx .v-bchip{display:flex;align-items:center;gap:4px;max-width:100%;background:#0f0d24d0;border:1px solid #ffffff33;border-radius:99px;padding:1px 8px 1px 2px;font-size:10.5px;font-weight:900;white-space:nowrap}
.msx .v-bchip img{width:20px;height:20px;flex:none;border-radius:50%;object-fit:cover;background:#ffffff22;border:1.5px solid #ffffff66}
.msx .v-bchip .bc-nm{overflow:hidden;text-overflow:ellipsis;min-width:0;max-width:9em}
.msx .v-bchip .bc-up{flex:none}
.msx .v-bchip.tag{border-color:#fbbf24;background:linear-gradient(90deg,#78350fd8,#0f0d24d0 70%);box-shadow:0 0 6px #f59e0b88}
.msx .v-bchip.tag img{border-color:#fde047;box-shadow:0 0 5px #fde047}
.msx .v-bchip .bc-tg{flex:none;font-size:11px}
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
  const tagMs = ms.filter((i) => tags.includes(i)).slice(0, MSX_CREW_SPOT_TAG.length);
  const restMs = ms.filter((i) => !tagMs.includes(i));
  const tagged = tagMs.length > 0 || tags.includes('aid');
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(tagged ? [['actTag', 60]] : [], []);
  const thumb = (sp) => (typeof msxMonThumb === 'function' ? msxMonThumb(sp) : typeof msxMonImg === 'function' ? msxMonImg(sp) : '');
  if (!ms.length && !aidImg) return null;
  const meSp = run && run.s ? run.s.species : '';
  return (
    <div className="crew" aria-hidden="true" data-msx-crew={ms.length} data-msx-crew-tag={tagMs.length} data-msx-crew-aid={aidImg ? 1 : 0} data-msx-tag-scene={tagged ? 1 : 0}>
      {tagged ? <span className="tagglow"/> : null}
      {tagged ? Array.from({ length: 8 }, (_, i) => <i key={`st${i}`} className="tagstar" style={{ '--i': i }}>✨</i>) : null}
      {tagMs.map((i, n) => { const img = typeof msxMonImg === 'function' ? msxMonImg(team[i].species) : ''; return img ? (
        <div key={`t${i}`} className="cm tag duo" style={{ ...(aidImg ? MSX_CREW_SPOT_TAG_AID : MSX_CREW_SPOT_TAG)[n], '--i': n }}><img src={img} alt=""/><b className="tg">🤝 タッグ</b></div>) : null; })}
      {restMs.map((i, n) => { const img = typeof msxMonImg === 'function' ? msxMonImg(team[i].species) : ''; return img ? (
        <div key={i} className="cm" style={{ ...SPOT[Math.min(SPOT.length - 1, n + (aidImg ? tagMs.length : 0))], '--i': n }}><img src={img} alt=""/><i className="ch">📣</i></div>) : null; })}
      {aidImg ? <div className={`aid${tags.includes('aid') ? ' tag' : ''}`}><img src={aidImg} alt=""/><b className="say">{tags.includes('aid') ? '🤝 いっしょに!' : 'がんばれ〜!'}</b></div> : null}
      {tagged ? (
        <div className="tagcut" data-msx-tag-cutin={tagMs.length + (tags.includes('aid') ? 1 : 0)}>
          <span className="fc"><img src={thumb(meSp)} alt=""/></span>
          {tagMs.slice(0, 3).map((i) => <React.Fragment key={i}><span className="x">×</span><span className="fc"><img src={thumb(team[i].species)} alt=""/></span></React.Fragment>)}
          {tags.includes('aid') && typeof msxFace === 'function' ? <><span className="x">×</span><span className="fc"><img src={msxFace(s.aid, 'excited') || msxFace(s.aid, 'happy')} alt=""/></span></> : null}
          <b>友情タッグ!<small>いっしょに 力を合わせる</small></b>
        </div>) : null}
    </div>
  );
}
function MsxBondChips({ s, card, add }) {
  msxCrewEnsureCss();
  if (!s || !card) return null;
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const team = Array.isArray(s.team) ? s.team : [];
  const ms = (Array.isArray(card.members) ? card.members : []).filter((i) => Number.isInteger(i) && team[i]);
  const aid = Boolean(card.aid) && s.aid;
  if (!ms.length && !aid) return null;
  const thumb = (m) => (typeof msxMonThumb === 'function' ? msxMonThumb(m.species) : typeof msxMonImg === 'function' ? msxMonImg(m.species) : '');
  const nameOf = (m) => (typeof msxMemberName === 'function' ? msxMemberName(m) : m.species);
  return (
    <div className="v-bchips" data-msx-bond-chips={ms.length + (aid ? 1 : 0)}>
      {ms.map((i) => { const tag = tags.includes(i); return (
        <span key={i} className={`v-bchip${tag ? ' tag' : ''}`} data-msx-bond-chip={tag ? 'tag' : 'm'}><img src={thumb(team[i])} alt=""/>{tag ? <i className="bc-tg">🤝</i> : null}<span className="bc-nm">{nameOf(team[i])}</span><span className="bc-up">親密度 +{add}</span></span>); })}
      {aid ? <span className={`v-bchip${tags.includes('aid') ? ' tag' : ''}`} data-msx-bond-chip="aid"><img src={typeof msxFace === 'function' ? msxFace(s.aid, 'happy') : ''} alt=""/>{tags.includes('aid') ? <i className="bc-tg">🤝</i> : null}<span className="bc-nm">{typeof msxAidName === 'function' ? msxAidName(s.aid) : ''}</span><span className="bc-up">親密度 +{add}</span></span> : null}
    </div>
  );
}
