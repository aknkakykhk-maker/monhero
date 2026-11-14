// ===== モンヒロサクセスのイッサ博士「大きな賭け」の場面(2026-11-14 社長「イッサ博士の演出が弱い。もっと作り込んだほうがいい」) =====
// 計算は芯 MONHERO_SUCCESS の issa / issaRate / issaComes。ここは見せる部分だけ。保存するのは今までどおり run.out(結果)だけ。
//   MsxIssa       … 入口(56-monhero-success-main.jsx の phase === 'issa' から呼ぶ)。結果が無ければ「登場と選ぶ段」、あれば「結果の段」
//   MsxIssaMeet   … 博士が飛びこんでくる → 「大きな賭け」の帯 → 吹き出し → 賭けの札が下から並ぶ(段ごとに少しずつ間を置く)
//   MsxIssaResult … 0 溜め(のびのび装置が震えて光る・ドキドキの音)→ 1 閃光/煙 → 2 結果(大成功=光の筋と紙吹雪と専用の音/失敗=煙と灰色/ことわった=手をふる)
//   MsxIssaGains  … 能力以外に動いた数字の札(.v-gains。docs/spec/MONSUC_UI.md「3. 結果の出し方」)
//   「動きを減らす」設定(msxFxCalm)と prefers-reduced-motion では、溜めを飛ばして静かな形で結果を出す

const MSX_IS_STEPS = Object.freeze([1800, 420]); // 0 溜め → 1 閃光/煙 → 2 結果(ミリ秒)
const MSX_IS_YOSU = Object.freeze({ sabori: '😪 サボりグセ', utsu: '😞 うつ病', kega: '🤕 けが', himan: '🍖 肥満', kaze: '🤧 かぜ' });
const msxIsCalm = () => (typeof msxFxCalm === 'function' ? Boolean(msxFxCalm()) : false);
// 吹き出しは言葉の切れ目で折る(2026-11-14 社長の指摘「イッサ博／士」「どうなるか／な〜」。41-screen-ui の jaWrap)
const msxIsJw = (t) => (typeof jaWrap === 'function' ? jaWrap(t) : t);
const MSX_IS_WRAP = typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : { wordBreak: 'keep-all', overflowWrap: 'anywhere' };

// 動いた数字(能力以外)を札にする。before … 選ぶ前に覚えた値
function msxIssaGainList(before, s, SUC) {
  if (!before || !s) return [];
  const out = [];
  const d = (label, a, b) => { const x = Math.round((Number(b) || 0) - (Number(a) || 0)); if (x) out.push({ label, v: x }); };
  d('🔋 体力の上限', before.hpMax, s.hpMax);
  d('❤️ 体力', before.hp, s.hp);
  if (SUC && typeof SUC.loyalOf === 'function') d('🤝 忠誠度', before.loyal, SUC.loyalOf(s));
  d('⭐ 人気', before.pop, s.pop);
  const had = Array.isArray(before.yosu) ? before.yosu : [];
  Object.keys(s.yosu || {}).filter((k) => !had.includes(k)).forEach((k) => out.push({ label: '🔎 ようす', text: (MSX_IS_YOSU[k] || '').replace(/^\S+\s/, '') || 'ようすが変わった', bad: true }));
  return out;
}

function MsxIssaGains({ items }) {
  if (!items || !items.length) return null;
  return (
    <div className="v-gains" data-msx-issa-gains>
      {items.map((x, i) => (
        <span key={i} className={x.bad || x.v < 0 ? 'dn' : 'up'} style={{ '--i': i }}>
          <small>{x.label}</small><b>{x.text ? x.text : x.v > 0 ? `+${x.v}` : `−${-x.v}`}</b>
        </span>))}
    </div>
  );
}

function MsxIssa({ run, setRun, v, ev, ctx, bondLv, onDone }) {
  msxIsEnsureCss();
  const { SUC } = msxSuc;
  useEffect(() => { if (typeof msxSeenMark === 'function') msxSeenMark('issa'); }, []);
  const s = run.s;
  const res = run.out && run.out.issa ? run.out.issa : null;
  const choose = (pick) => {
    if (typeof msxSeenMark === 'function') msxSeenMark('issa', pick);
    const r = SUC.issa(s, pick);
    if (!r.out.ok) { onDone(run); return; }
    // 選ぶ前の値を覚えておく(結果の札で「何がいくつ動いたか」を出すため。保存の形は run.out の中だけ)
    const prev = { hp: s.hp, hpMax: s.hpMax, pop: s.pop, loyal: typeof SUC.loyalOf === 'function' ? SUC.loyalOf(s) : 0, yosu: Object.keys(s.yosu || {}) };
    setRun({ ...run, s: r.state, out: { issa: r.out, before: s.stats, prev }, log: [...(run.log || []), { turn: s.turn, t: `イッサ博士: ${pick === 'none' ? 'ことわった' : r.out.win ? '成功' : '失敗'}` }].slice(-20) });
  };
  if (res) return <MsxIssaResult key={`is-${s.turn}`} run={run} res={res} v={v} ev={ev} ctx={ctx} onNext={() => onDone({ ...run, out: null })}/>;
  return <MsxIssaMeet run={run} v={v} ev={ev} ctx={ctx} onChoose={choose}/>;
}

function MsxIssaMeet({ run, v, ev, ctx, onChoose }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const calm = msxIsCalm();
  const [pick, setPick] = useState('hp');
  const meet = msxPickLine(ctx, s.issaMet > 0 ? 'issa.meet.again' : 'issa.meet.first', { who: 'issa' });
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(calm ? [] : [['issaIn', 120]], []);
  const sel = MSX_ISSA_KEYS.find((x) => x.key === pick);
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className={`v-scene msx-is meet${calm ? ' calm' : ''}`} style={{ flex: '1 1 0' }} data-msx-issa="meet">
      <img className="bg" src="images/story-bg/monhero_night.jpg" alt=""/><div className="sh" style={{ background: '#0f0d2466' }}/>
      <span className="msx-is-ring" aria-hidden="true"/>
      <span className="msx-is-spark" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ '--i': i }}/>)}</span>
      <img className="v-issa msx-is-in" src={MSX_ISSA_ART} alt="イッサ博士"/>
      <div className="v-machine msx-is-mc">⚙️💡<small>のびのび装置</small><MsxMonArt run={run} style={{ height: '46%', aspectRatio: '1', objectFit: 'contain' }}/></div>
      <div className="v-ev-h msx-is-band" style={{ top: 'auto', bottom: 8, borderRadius: '0 99px 99px 0' }}><small>大きな賭け</small>イッサ博士があらわれた!</div>
      <div className="v-ibub msx-is-bub" style={MSX_IS_WRAP}>{msxIsJw(`「${meet ? meet.t : 'やっほー! ちょっと強くなってみない?'}」`)}</div>
    </div>
    <div className="v-six msx-is-six">
      {MSX_ISSA_KEYS.map((x, i) => { const p = SUC.issaRate(s, x.key); const dots = Math.max(1, Math.min(4, Math.round(p * 4))); return (
        <button type="button" key={x.key} className={`v-ix${pick === x.key ? ' sel' : ''}`} style={{ '--i': i }} onClick={() => setPick(x.key)}>{cardIconNode(x.icon, 16)} {x.name}
          <span className="pr">成功{[0, 1, 2, 3].map((j) => <i key={j} className={j < dots ? 'on' : ''}/>)}</span><span className="ok">⭕ {x.ok}</span><span className="ng">❌ {x.ng}</span></button>); })}
      <button type="button" className={`v-ix no${pick === 'none' ? ' sel' : ''}`} style={{ '--i': MSX_ISSA_KEYS.length }} onClick={() => setPick('none')}>🙅 何もしない<span className="ok" style={{ color: '#cbd5e1' }}>ことわる。損はない</span><span className="ng" style={{ color: '#94a3b8' }}>「えー、ノリ悪いなぁ」</span></button>
    </div>
    <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => onChoose(pick)} data-msx-issa-go>{pick === 'none' ? 'ことわる' : `${sel ? sel.icon : ''} ${sel ? sel.name : ''}に賭ける ▶`}</button></div>
  </>);
}

function MsxIssaResult({ run, res, v, ev, ctx, onNext }) {
  const s = run.s;
  const calm = msxIsCalm();
  const k = MSX_ISSA_KEYS.find((x) => x.key === res.choice);
  const none = !k;
  const win = Boolean(k && res.win);
  const [st, setSt] = useState(none || calm ? 2 : 0);
  useEffect(() => {
    if (st >= 2) return undefined;
    const id = setTimeout(() => setSt((n) => Math.min(2, n + 1)), MSX_IS_STEPS[st]);
    return () => clearTimeout(id);
  }, [st]);
  // 溜めはだんだん速くなる「ドキドキ」の音 → 閃光(大成功)/煙(失敗)→ 結果の音
  const drum = [0, 380, 700, 960, 1170, 1340, 1480, 1590, 1680].map((ms) => ['issaDrum', ms]);
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(st === 0 ? drum : st === 1 ? [[win ? 'issaZap' : 'issaPuff', 0]] : st === 2 && !none ? (win ? [['issaWin', 0], ['issaWin2', 260]] : [['issaLose', 0]]) : [], [st]);
  const said = k ? msxPickLine(ctx, `issa.${win ? 'ok' : 'ng'}.${k.line}`, { who: 'issa' }) : msxPickLine(ctx, 'issa.bye', { who: 'issa' });
  const ups = {}; if (run.out.before) MSX_STATS.forEach((x) => { const d = s.stats[x] - run.out.before[x]; if (d) ups[x] = d; });
  const hasUps = Object.keys(ups).length > 0;
  const gains = msxIssaGainList(run.out.prev, s, msxSuc.SUC);
  const tone = none ? 'none' : win ? 'win' : 'lose';
  const done = st >= 2;
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className={`v-scene msx-is res st${st} ${tone}${calm ? ' calm' : ''}`} style={{ flex: '1 1 0' }} data-msx-issa={done ? tone : 'drum'}>
      <img className="bg" src="images/story-bg/monhero_night.jpg" alt=""/><div className="sh" style={{ background: '#0f0d2466' }}/>
      {done && win ? <><span className="v-burst msx-is-rays" aria-hidden="true"/><span className="msx-is-conf" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => <i key={i} style={{ '--i': i }}/>)}</span></> : null}
      {st < 2 ? <span className="msx-is-dim" aria-hidden="true"/> : null}
      <img className={`v-issa${done && !win && !none ? ' sad' : ''}${st === 0 ? ' back' : ''}`} src={MSX_ISSA_ART} alt="イッサ博士"/>
      {st < 2 ? (
        <div className="v-machine msx-is-go">⚙️💡<small>のびのび装置</small><MsxMonArt run={run} style={{ height: '46%', aspectRatio: '1', objectFit: 'contain' }}/>
          <span className="msx-is-lamp" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} style={{ '--i': i }}/>)}</span></div>
      ) : <MsxMonArt run={run} className={`mon msx-is-mon ${tone}`} style={{ left: '70%', bottom: '12%', height: '44%' }} live={win}/>}
      {st === 0 ? <div className="msx-is-chip">{k ? `${k.icon} ${k.name}に賭けた!` : ''}<small>装置が うなりを上げている…</small></div> : null}
      {st === 1 ? <span className={`msx-is-flash ${win ? 'w' : 'g'}`} aria-hidden="true"/> : null}
      {st === 1 && !win ? <span className="msx-is-smoke" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ '--i': i }}/>)}</span> : null}
      {done && !win && !none ? <span className="msx-is-smoke after" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} style={{ '--i': i }}/>)}</span> : null}
      {done && k ? <div className={`v-stamp msx-pop ${win ? 'msx-is-win' : 'ng'}`} style={{ top: '3%', fontSize: win ? 46 : 40 }}>{win ? '大成功!' : '失敗…'}<small>{win ? '装置がぴかーっと光った' : '装置から煙が…'}</small></div> : null}
      {st === 0 ? <div className="v-ibub" style={{ top: 'auto', bottom: 8, left: 8, right: '44%', ...MSX_IS_WRAP }}>{msxIsJw('「スイッチ、オン! …どうなるかな〜?」')}</div> : null}
      {done && said ? <div className="v-ibub msx-is-bub2" style={{ top: 'auto', bottom: 8, left: 8, right: '44%', ...MSX_IS_WRAP }}>{msxIsJw(`「${said.t}」`)}</div> : null}
      {st < 2 && !calm ? <div className="msx-is-ctl"><button type="button" onClick={() => setSt(2)} data-msx-issa-skip>短縮 ⏭</button></div> : null}
    </div>
    {done ? (<>
      {hasUps ? <MsxStRow who={s} stats={s.stats} ups={ups}/> : null}
      <MsxIssaGains items={gains}/>
      <div className="v-log"><span className="hd2">{k ? `${k.icon} ${k.name}` : '🙅 何もしない'}</span><br/>{k ? (win ? `⭕ ${k.ok}` : `❌ ${k.ng}`) : 'ことわった。何も変わらない'}{!none && !hasUps && !gains.length ? '(変化なし)' : ''}</div>
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={onNext} data-msx-issa-next>つぎへ ▶</button></div>
    </>) : (<>
      <div className="v-log" style={MSX_IS_WRAP}>{msxIsJw(`${k ? `${k.icon} ${k.name}に賭けた。` : ''}のびのび装置が、ガタガタと震えている…`)}</div>
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" disabled>…</button></div>
    </>)}
  </>);
}

const MSX_IS_CSS = `
.msx .msx-is .v-issa{transition:filter .4s,transform .4s}
.msx .msx-is .v-issa.back{transform:translateX(-14%) scale(.92);filter:brightness(.8) drop-shadow(0 6px 6px #000a)}
.msx .msx-is .v-issa.sad{filter:grayscale(.45) brightness(.82) drop-shadow(0 6px 6px #000a)}
.msx .msx-is.meet .msx-is-in{animation:msxIsIn .62s cubic-bezier(.2,1.25,.4,1) both}
.msx .msx-is.meet .msx-is-mc{animation:msxIsUp .45s ease-out .35s both}
.msx .msx-is.meet .msx-is-band{animation:msxIsBand .4s cubic-bezier(.2,1.3,.4,1) .45s both}
.msx .msx-is.meet .msx-is-bub{animation:msxIsPop .35s cubic-bezier(.2,1.4,.4,1) .8s both;transform-origin:0 100%}
.msx .msx-is-six .v-ix{animation:msxIsUp .3s ease-out both;animation-delay:calc(1s + var(--i) * 60ms)}
.msx .msx-is-ring{position:absolute;left:30%;top:46%;width:10px;height:10px;margin:-5px;border-radius:50%;border:3px solid #fde047;opacity:0;animation:msxIsRing .7s ease-out .05s both;pointer-events:none}
.msx .msx-is-spark i{position:absolute;left:30%;top:42%;width:8px;height:8px;border-radius:2px;background:#fde68a;box-shadow:0 0 8px #fde047;opacity:0;transform:rotate(calc(var(--i) * 60deg)) translateY(0);animation:msxIsSpark .7s ease-out .1s both;pointer-events:none}
.msx .msx-is-dim{position:absolute;inset:0;background:radial-gradient(circle at 70% 55%,#0000 0 22%,#000a 60%);pointer-events:none}
.msx .msx-is .v-machine.msx-is-go{left:50%;right:auto;bottom:16%;width:46%;margin:0;transform:translateX(-50%);animation:msxIsShake .14s linear infinite;box-shadow:0 0 40px #22d3eecc,inset 0 0 18px #22d3ee88;z-index:2}
.msx .msx-is.st0 .v-machine.msx-is-go{animation:msxIsShake .14s linear infinite,msxIsGlow .5s ease-in-out infinite alternate}
.msx .msx-is-lamp{position:absolute;top:6px;right:8px;display:flex;gap:4px}
.msx .msx-is-lamp i{width:8px;height:8px;border-radius:50%;background:#f87171;box-shadow:0 0 6px #f87171;animation:msxIsLamp .36s steps(1) infinite;animation-delay:calc(var(--i) * .12s)}
.msx .msx-is-chip{position:absolute;left:0;right:0;margin:0 auto;width:max-content;max-width:92%;top:5%;background:#1e1a36ee;border:1.5px solid #fde047;border-radius:14px;padding:6px 14px;color:#fde047;font-weight:900;font-size:15px;text-align:center;white-space:nowrap;z-index:3;animation:msxIsPop .3s cubic-bezier(.2,1.4,.4,1) both}
.msx .msx-is-chip small{display:block;font-size:11px;color:#e2e8f0;font-weight:800;animation:msxIsBlink .8s ease-in-out infinite alternate}
.msx .msx-is-flash{position:absolute;inset:0;z-index:4;pointer-events:none;animation:msxIsFlash .42s ease-out both}
.msx .msx-is-flash.w{background:radial-gradient(circle at 50% 55%,#fff 0 30%,#fef9c3 60%,#fde04700)}
.msx .msx-is-flash.g{background:radial-gradient(circle at 50% 60%,#94a3b8cc 0 30%,#33415500 75%)}
.msx .msx-is-smoke{position:absolute;left:30%;right:10%;bottom:20%;height:50%;pointer-events:none;z-index:3}
.msx .msx-is-smoke i{position:absolute;left:calc(var(--i) * 18%);bottom:0;width:38%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,#cbd5e1 0 40%,#64748b00 70%);opacity:0;animation:msxIsSmoke 1.4s ease-out both;animation-delay:calc(var(--i) * 70ms)}
.msx .msx-is-smoke.after i{animation:msxIsSmoke 2.4s ease-out infinite;animation-delay:calc(var(--i) * .7s)}
.msx .msx-is-rays{animation:msxIsSpin 9s linear infinite;transform-origin:50% 42%;inset:-30%}
.msx .msx-is-conf i{position:absolute;top:-6%;left:calc(4% + var(--i) * 8%);width:7px;height:12px;border-radius:2px;background:hsl(calc(var(--i) * 37deg),90%,62%);animation:msxIsConf 2.2s linear both;animation-delay:calc(var(--i) * 90ms);pointer-events:none;z-index:2}
.msx .msx-is-win{animation:msxIsWin .55s cubic-bezier(.2,1.5,.35,1) both!important;text-shadow:0 4px 0 #9a3412,0 0 30px #fde047,0 0 60px #fb923c}
.msx .msx-is-mon.win{animation:msxIsHop .5s ease-out .15s 2}
.msx .msx-is-mon.lose{filter:grayscale(.3) brightness(.9)}
.msx .msx-is-bub2{animation:msxIsPop .35s cubic-bezier(.2,1.4,.4,1) .35s both;transform-origin:0 100%}
.msx .msx-is-ctl{position:absolute;right:8px;bottom:8px;z-index:5}
.msx .msx-is-ctl button{min-height:44px;min-width:76px;padding:0 12px;border-radius:99px;background:#0f0d24cc;border:1.5px solid #94a3b8;color:#e2e8f0;font-weight:900;font-size:12px}
.msx .v-gains{display:flex;flex-wrap:wrap;justify-content:center;gap:5px;margin-top:6px}
.msx .v-gains span{display:flex;flex-direction:column;align-items:center;min-width:76px;padding:4px 10px;border-radius:12px;background:#1e1a36;border:1px solid #3b3566;text-align:center;animation:msxIsUp .3s ease-out both;animation-delay:calc(.15s + var(--i) * 80ms)}
.msx .v-gains small{font-size:10.5px;font-weight:800;color:#cbd5e1;white-space:nowrap}
.msx .v-gains b{font-size:16px;font-weight:900;line-height:1.2;white-space:nowrap}
.msx .v-gains .up{border-color:#fde04788}.msx .v-gains .up b{color:#fde047}
.msx .v-gains .dn{border-color:#f8717188}.msx .v-gains .dn b{color:#f87171}
.msx .msx-is.calm *,.msx .msx-is-six.calm *{animation:none!important}
@media (prefers-reduced-motion:reduce){.msx .msx-is *,.msx .msx-is-six .v-ix,.msx .v-gains span{animation:none!important}}
@keyframes msxIsIn{0%{transform:translateX(70%) rotate(8deg);opacity:0}70%{opacity:1}100%{transform:none;opacity:1}}
@keyframes msxIsUp{0%{transform:translateY(14px);opacity:0}100%{transform:none;opacity:1}}
@keyframes msxIsBand{0%{transform:translateX(-100%)}100%{transform:none}}
@keyframes msxIsPop{0%{transform:scale(.4);opacity:0}100%{transform:none;opacity:1}}
@keyframes msxIsRing{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(26)}}
@keyframes msxIsSpark{0%{opacity:1}100%{opacity:0;transform:rotate(calc(var(--i) * 60deg)) translateY(-120px)}}
@keyframes msxIsShake{0%{transform:translateX(-50%) rotate(0)}25%{transform:translateX(calc(-50% - 2px)) rotate(-1.2deg)}75%{transform:translateX(calc(-50% + 2px)) rotate(1.2deg)}100%{transform:translateX(-50%) rotate(0)}}
@keyframes msxIsGlow{0%{filter:brightness(1)}100%{filter:brightness(1.35)}}
@keyframes msxIsLamp{0%{opacity:1}50%{opacity:.25}}
@keyframes msxIsBlink{0%{opacity:.55}100%{opacity:1}}
@keyframes msxIsFlash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes msxIsSmoke{0%{opacity:0;transform:translateY(0) scale(.5)}25%{opacity:.85}100%{opacity:0;transform:translateY(-90%) scale(1.4)}}
@keyframes msxIsSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@keyframes msxIsConf{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(560%) rotate(540deg);opacity:0}}
@keyframes msxIsWin{0%{transform:scale(2.6) rotate(-8deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes msxIsHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-12%)}}
`;
let msxIsCssDone = false;
const msxIsEnsureCss = () => {
  if (msxIsCssDone || typeof document === 'undefined') return;
  msxIsCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-issa-css', '1'); el.textContent = MSX_IS_CSS; document.head.appendChild(el);
};
