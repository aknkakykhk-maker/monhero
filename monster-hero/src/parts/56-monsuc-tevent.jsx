// ===== モンヒロサクセスの「トレーニングのあとの出来事」を1枚の場面で見せる(2026-11-13 社長「ターン後のイベントが下部にぽつんとで地味」) =====
// トレーニングの結果のあと、編成のモンスターとの出来事(芯の trainEvent: out.event = { who, story } か { who, lottery })があったときだけ挟む。
// 中身は芯がもう足し終えている(ここは見せるだけ・何も保存しない)。入り方は MSX_TEV_STYLE(社長の決めで 'b' カットイン。'a' 暗転 / 'c' 「EVENT」の帯 は案のときの形)
//   画面 MsxTrainEvent({ run, o, ctx, style }) … o = トレーニングの結果(run.out)。台詞は台本の cheer.base.ep<N>(お話)/ cheer.lot.<種類>(小さな出来事)

const MSX_TEV_STYLE = 'b'; // 社長の決め(2026-11-13): B カットイン(2体の顔と「◯◯との出来事!」の斜めの帯)
const MSX_TEV_LOT = Object.freeze({ self: 'drill', rest: 'rest', talk: 'chat', tip: 'tip', pal: 'friend', friend: 'friend' });
const MSX_TEV_LOT_NAME = Object.freeze({ self: 'いっしょに自主練', rest: 'ひと休み', talk: 'おしゃべり', tip: 'コツを教わる', pal: 'なかよし', friend: 'なかよし' });

// 変わったこと(芯の trainEvent と同じ中身を文にする)
const msxTevChanges = (s, o) => {
  const e = o && o.event; if (!e) return [];
  const SUC = msxSuc && msxSuc.SUC; const m = s.team[e.who]; const fk = m && Array.isArray(m.top) ? m.top[0] : null;
  const stat = fk && typeof MSX_STAT_NAME !== 'undefined' ? MSX_STAT_NAME[fk] : '能力';
  const out = [];
  if (e.story) {
    const st = SUC && SUC.STORY ? SUC.STORY[e.story - 1] : null;
    out.push(`🤝 親密度 +${st ? st.bond : 10}`);
    if (e.story === 1) out.push(`${stat} 小アップ`);
    else if (e.story === 2) { out.push(`${stat} 中アップ`); out.push('❤️ 体力 −10'); }
    else { out.push(`${stat} 中アップ`); out.push(o.taught ? `⚔ 技「${(SUC.techsOf(s.species).find((t) => t.id === o.taught) || {}).name || '新しい技'}」を覚えた!` : '⚔ 技の熟練 +10'); }
  } else {
    const k = e.lottery;
    if (k === 'self') { out.push(`${stat} 小アップ`); out.push('🤝 親密度 +5'); }
    else if (k === 'rest') out.push('❤️ 体力 +10');
    else if (k === 'talk') { out.push('💢 ストレス −10'); out.push('🤝 親密度 +5'); }
    else if (k === 'tip') out.push('✨ ひらめき(次の修行で技を覚えやすい)');
    else out.push('🤝 親密度 +10');
  }
  return out;
};

function MsxTrainEvent({ run, o, ctx, style = MSX_TEV_STYLE }) {
  msxTevEnsureCss();
  const s = run.s; const e = o.event; const m = s.team[e.who];
  const name = typeof msxMemberName === 'function' ? msxMemberName(m) : '編成のモンスター';
  const line = e.story ? msxPickLine({ ...ctx, cheer: name }, `cheer.base.ep${e.story}`, { who: 'narr' }) : msxPickLine({ ...ctx, cheer: name }, `cheer.lot.${MSX_TEV_LOT[e.lottery] || 'friend'}`, { who: '*' });
  const title = e.story ? `${name}との出来事 第${e.story}話` : `${name}と${MSX_TEV_LOT_NAME[e.lottery] || '小さな出来事'}`;
  const ch = msxTevChanges(s, o);
  const calm = typeof msxFxCalm === 'function' && msxFxCalm();
  const bondNow = s.bond[e.who];
  return (<>
    <div className={`v-scene msx-tev s-${style}${calm ? ' calm' : ''}`} style={{ flex: '1 1 0' }} data-msx-tev={style}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <div className="gr" style={{ left: '29%', bottom: 'calc(40% - 5px)' }}/>
      <MsxMonArt run={run} className="mon" style={{ left: '29%', bottom: '40%', height: '22%' }} live/>
      <div className="gr" style={{ left: '71%', bottom: 'calc(40% - 5px)' }}/>
      {m ? <img className="mon tev-pal" src={msxMonImg(m.species)} alt="" style={{ left: '71%', bottom: '40%', height: '25%' }}/> : null}
      <div className="v-talk tev-talk">{line && line.t ? (line.who && line.who !== 'narr' ? <div><span className="who">{line.who === 'mon' ? run.nick : msxAidName(line.who)}</span>「{line.t}」</div> : <div>{line.t}</div>) : <div>{name}と、すこし特別な時間をすごした。</div>}</div>
      <div className="v-ev-h"><small>編成のモンスターのイベント</small>{title}</div>
      <div className="tev-bond"><span>🤝 {name}との親密度</span><i><b style={{ width: `${Math.max(0, Math.min(100, bondNow))}%` }}/></i><em>{bondNow}</em></div>
      {/* 入り方 */}
      {style === 'a' ? <span className="tev-in-a" aria-hidden="true"/> : null}
      {style === 'b' ? <div className="tev-in-b" aria-hidden="true"><div className="band"><img src={msxMonThumb(s.species)} alt=""/><b>{name}との出来事!</b><img src={m ? msxMonThumb(m.species) : ''} alt=""/></div></div> : null}
      {style === 'c' ? <div className="tev-in-c" aria-hidden="true"><span className="fl"/><div className="rb">EVENT</div></div> : null}
    </div>
    <div className="v-log tev-ch">{ch.map((t, i) => <span key={i} className="v-chip ylw" style={{ position: 'static', animationDelay: `${0.9 + i * 0.15}s` }}>{t}</span>)}</div>
  </>);
}

const MSX_TEV_CSS = `
.msx .msx-tev .tev-pal{transform:translateX(-50%) scaleX(-1)}
.msx .msx-tev .tev-bond{position:absolute;left:8px;right:8px;top:48px;display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:900;color:#fbcfe8;background:#0f0d24cc;border-radius:999px;padding:3px 10px;z-index:3}
.msx .msx-tev .tev-bond i{flex:1;height:6px;border-radius:6px;background:#334155;overflow:hidden}
.msx .msx-tev .tev-bond i b{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fb7185)}
.msx .msx-tev .tev-bond em{font-style:normal;color:#fff}
.msx .msx-tev .tev-talk{bottom:8px;z-index:4}
.msx .tev-ch{display:flex;flex-wrap:wrap;gap:4px}
.msx .tev-ch .v-chip{animation:msx-popin .35s cubic-bezier(.2,1.4,.4,1) both}
.msx .tev-in-a{position:absolute;inset:0;z-index:6;background:#000;pointer-events:none;animation:tevA 1.1s ease-out both}
@keyframes tevA{0%{opacity:1}35%{opacity:1}100%{opacity:0}}
.msx .msx-tev.s-a .v-ev-h{animation:tevTitle .5s .6s ease-out both}
@keyframes tevTitle{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.msx .tev-in-b{position:absolute;inset:0;z-index:6;pointer-events:none;display:flex;align-items:center;animation:tevBfade 1.4s ease-in both}
.msx .tev-in-b .band{width:120%;margin-left:-10%;transform:skewY(-6deg);display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 0;background:linear-gradient(90deg,#db2777,#f472b6 30%,#fbcfe8 50%,#f472b6 70%,#db2777);box-shadow:0 0 0 3px #fff,0 0 30px #f472b6;animation:tevBand 1.4s cubic-bezier(.2,.9,.3,1) both}
.msx .tev-in-b .band img{width:54px;height:54px;border-radius:50%;background:#fff;border:3px solid #fff;object-fit:contain}
.msx .tev-in-b .band b{font-size:20px;font-weight:900;font-style:italic;color:#fff;-webkit-text-stroke:2px #9d174d;paint-order:stroke fill;white-space:nowrap}
@keyframes tevBand{0%{transform:skewY(-6deg) translateX(110%)}25%,75%{transform:skewY(-6deg) translateX(0)}100%{transform:skewY(-6deg) translateX(-110%)}}
@keyframes tevBfade{0%,80%{opacity:1}100%{opacity:0}}
.msx .tev-in-c{position:absolute;inset:0;z-index:6;pointer-events:none}
.msx .tev-in-c .fl{position:absolute;inset:0;background:#fff;animation:tevCfl .7s ease-out both}
.msx .tev-in-c .rb{position:absolute;left:0;right:0;top:36%;text-align:center;font-size:44px;font-weight:900;font-style:italic;letter-spacing:.2em;color:#fff7cc;-webkit-text-stroke:3px #b45309;paint-order:stroke fill;text-shadow:0 0 18px #fde047,0 4px 0 #78350f;background:linear-gradient(90deg,transparent,#0f0d24dd 15%,#0f0d24dd 85%,transparent);padding:6px 0;animation:tevCrb 1.5s ease-out both}
@keyframes tevCfl{0%{opacity:.95}100%{opacity:0}}
@keyframes tevCrb{0%{opacity:0;transform:scaleX(.2)}18%{opacity:1;transform:scaleX(1.05)}26%{transform:scaleX(1)}75%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
.msx .msx-tev.s-c .bg{animation:tevZoom 1.6s ease-out both}
@keyframes tevZoom{from{transform:scale(1.12)}to{transform:scale(1)}}
.msx .msx-tev.calm .tev-in-a,.msx .msx-tev.calm .tev-in-b,.msx .msx-tev.calm .tev-in-c{display:none}
@media (prefers-reduced-motion: reduce){.msx .tev-in-a,.msx .tev-in-b,.msx .tev-in-c{display:none}.msx .msx-tev .bg,.msx .msx-tev .v-ev-h{animation:none}}
`;
let msxTevCssDone = false;
const msxTevEnsureCss = () => {
  if (msxTevCssDone || typeof document === 'undefined') return;
  msxTevCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-tev-css', '1'); el.textContent = MSX_TEV_CSS; document.head.appendChild(el);
};
