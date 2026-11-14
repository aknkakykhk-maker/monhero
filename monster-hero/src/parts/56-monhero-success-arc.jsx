// ===== モンヒロサクセス: 助手1人分のストーリーの画面(2026-11-13 開発部・設計 docs/progress/player-raise/STORY-ARC.md) =====
// ・ヒーローズファイナルの3連戦: 試合の前に「助手の相手えらび」(MsxArcPick)・試合のあとに「掛け合い」(MsxArcTalk。run.arcAfter)
// ・エンディング(MsxArcEnding): 芯の settle が付けた s.ending(bad / good / super)の話 → お祝い(1〜3回・能力は芯が足し済み)→
//   超グッドのときだけ特別演出(全身画+花吹雪+ふたりの記念写真・5〜6秒)→ 芯の endingSeen → 引退へ
// ・台詞は台本エンジン(scn.<助手>.summit.* / end.* / party.* / fx.super)。台本が無い助手は短い既定の文で進む(止まらない)
// ・保存は芯の s.ending だけ(芯の restore が直す)。run.arcPick / run.arcAfter は画面の中だけの印(保存しない・中断したらもう一度出る)
const MSX_ARC_CSS = `
.msx .r3 .arc-foe{position:absolute;right:8px;top:40px;width:44%;background:#1e1a36ee;border:2px solid #f472b6;border-radius:14px;padding:6px 8px;text-align:center;box-shadow:0 0 16px #f472b666}
.msx .r3 .arc-foe img{height:64px;width:64px;object-fit:contain;display:block;margin:0 auto}
.msx .r3 .arc-foe b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .r3 .arc-foe small{display:block;font-size:10px;color:#fbcfe8;font-weight:800}
.msx .r3 .arc-foe .why{margin-top:3px;font-size:10.5px;color:#fde047;font-weight:900}
.msx .r3 .arc-party{position:absolute;left:0;right:0;top:20%;text-align:center}
.msx .r3 .arc-party b{display:inline-block;background:linear-gradient(90deg,#f472b6,#fb923c);border-radius:99px;padding:6px 18px;font-size:20px;font-weight:900;color:#fff;box-shadow:0 0 20px #fb923c99}
.msx .r3 .arc-party small{display:block;margin-top:6px;font-size:12px;font-weight:900;color:#fde047;text-shadow:0 1px 0 #000}
.msx .r3 .arc-petal{position:absolute;top:-12%;font-size:20px;animation:arcFall linear infinite;pointer-events:none}
@keyframes arcFall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(130vh) rotate(540deg)}}
.msx .r3 .arc-photo{position:absolute;left:50%;top:6%;width:72%;transform:translateX(-50%) rotate(-3deg);background:#fff;padding:8px 8px 26px;border-radius:4px;box-shadow:0 10px 30px #000a;animation:arcPhoto 1.2s ease-out both}
.msx .r3 .arc-photo .pic{position:relative;height:170px;overflow:hidden;background:linear-gradient(#fde68a,#f9a8d4)}
.msx .r3 .arc-photo .pic img{position:absolute;bottom:0;object-fit:contain}
.msx .r3 .arc-photo .cap{position:absolute;left:0;right:0;bottom:5px;text-align:center;color:#be185d;font-size:12px;font-weight:900}
@keyframes arcPhoto{0%{opacity:0;transform:translateX(-50%) scale(1.4) rotate(6deg)}60%{opacity:1}100%{opacity:1;transform:translateX(-50%) scale(1) rotate(-3deg)}}
.msx .r3 .arc-flash{position:absolute;inset:0;background:#fff;animation:arcFlash .9s ease-out both;pointer-events:none}
@keyframes arcFlash{0%{opacity:.95}100%{opacity:0}}
.msx .r3 .arc-end{position:absolute;left:0;right:0;top:5%;text-align:center;font-size:30px;font-weight:900;letter-spacing:.08em;color:#fde047;-webkit-text-stroke:1.5px #9a3412;text-shadow:0 3px 0 #9a3412,0 0 22px #fb923c}
.msx .r3 .arc-end.bad{color:#bfdbfe;-webkit-text-stroke:1.5px #1e3a8a;text-shadow:0 3px 0 #1e3a8a,0 0 18px #60a5fa}
.msx .r3 .arc-end small{display:block;font-size:12px;letter-spacing:0;-webkit-text-stroke:0;color:#fff;text-shadow:0 1px 0 #000;margin-top:4px}
`;
const MSX_ARC_END = Object.freeze({
  bad: { name: 'バッドエンディング', sub: 'くやしさも、いっしょに', bg: 'images/story-bg/monhero_plaza_evening.jpg' },
  good: { name: 'グッドエンディング', sub: 'ヒーローズファイナル優勝', bg: 'images/success/scenes/venue-summit.png' },
  super: { name: '超グッドエンディング', sub: '最高のチーム', bg: 'images/success/scenes/venue-summit.png' },
});
const MSX_ARC_PARTY = Object.freeze({ bad: ['おつかれさま会'], good: ['祝勝会', '町のパレード', '助手からの手紙'], super: ['町じゅうのお祝い', 'ヒーローの取材', '3人の打ち上げ'] });
const MSX_ARC_PICK_WHY = Object.freeze({ pop: '人気がいちばんの相手', rival: 'この育成のライバル', strong: 'いちばん強い常連', champ: '王者', reg: '常連' });

// 台本の行(地の文と助手)。無ければ []
const msxArcLines = (scene, ctx, bondLv, extra) => {
  const se = msxSuc && msxSuc.script;
  try { const e = se && typeof se.event === 'function' ? se.event(scene, { ...ctx, bond: bondLv, ...(extra || {}) }) : null; return e && Array.isArray(e.lines) ? e.lines.concat(Array.isArray(e.after) ? e.after : []) : []; } catch (e) { return []; }
};
const msxArcHas = (SUC, aid) => Boolean(SUC && SUC.ARC && SUC.ARC[aid]);
const msxArcFullBody = (aid, ex) => { const w = msxWho(aid); const f = w && typeof assistantFullBodyImage === 'function' ? assistantFullBodyImage(w, ex) : null; return f || msxBody(aid, ex); };
// 試合のあとの掛け合い(ヒーローズファイナルのときだけ)。MsxR3Battle が settle のときに run.arcAfter へ入れる
const msxArcAfterOf = (SUC, s, b, won, foe) => (b && b.kind === 'summit' && msxArcHas(SUC, s.aid)
  ? { round: b.round, won: !!won, foe: foe ? (foe.name || msxMonName(foe.species)) : '', species: foe ? foe.species : null, turn: s.turn } : null);

// 会話の1画面(行を3つずつめくる)。lines が空なら fallback を1行だけ出す
function MsxArcTalk({ run, v, ev, onPause, aid, lines, fallback, head, bg, ex = 'happy', dark = false, top = null, onDone, doneText = 'つぎへ ▶', mon = true }) {
  const [page, setPage] = useState(0);
  const all = lines && lines.length ? lines : [{ who: aid, t: fallback || '……' }];
  const per = 3; const pages = Math.max(1, Math.ceil(all.length / per));
  const shown = all.slice(page * per, page * per + per);
  const lastFace = (shown.slice().reverse().find((l) => l.who === aid) || {}).e || ex;
  const who = (l) => (l.who === 'narr' ? null : l.who === 'mon' ? run.nick : msxAidName(l.who));
  const next = () => (page + 1 < pages ? setPage(page + 1) : onDone());
  const s = run.s;
  return (
    <MsxR3Frame run={run} back="中断" onBack={onPause} right="" body={(<>
      <style>{MSX_ARC_CSS}</style>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className={`v-scene ${dark ? 'dk' : ''}`} style={{ flex: '1 1 0', minHeight: 300 }} data-msx-arc-talk>
        <img className="bg" src={bg || msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
        {mon ? <><div className="gr" style={{ left: '30%', bottom: 'calc(34% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '34%', height: '24%' }} live/></> : null}
        <img src={msxBody(aid, lastFace)} alt="" style={{ position: 'absolute', right: '-4%', bottom: 0, height: '70%', width: '46%', objectFit: 'contain', objectPosition: 'right bottom' }}/>
        {top}
        {head ? <div className="v-ev-h"><small>メインのお話</small>{head}</div> : null}
        <div className="v-talk">{shown.map((l, i) => <div key={`${page}-${i}`}>{who(l) ? <span className="who">{who(l)}</span> : null}{who(l) ? `「${l.t}」` : l.t}</div>)}</div>
      </div>
    </>)} foot={<div className="v-ft"><button type="button" className="go" onClick={next} data-msx-arc-next>{page + 1 < pages ? 'つぎへ ▶' : doneText}</button></div>}/>
  );
}

// ヒーローズファイナル: 試合の前に助手が相手を選ぶ
function MsxArcPick({ run, v, ev, onPause, ctx, bondLv, opp, round, onDone }) {
  const s = run.s; const foe = opp ? (opp.name || msxMonName(opp.species)) : '';
  const lines = msxArcLines(`scn.${s.aid}.summit.r${round + 1}.pick`, ctx, bondLv, { rival: foe, owner: opp && opp.breeder ? opp.breeder : '' });
  const SUM = msxSuc.SUC.SUMMIT || [];
  const top = opp ? (
    <div className="arc-foe" data-msx-arc-foe>
      <img src={msxMonThumb(opp.species)} alt=""/><b>{foe}</b><small>{opp.breeder ? `育て手 ${opp.breeder}` : msxMonName(opp.species)}</small>
      <div className="why">{msxAidName(s.aid)}のえらび: {MSX_ARC_PICK_WHY[opp.pick] || '相手'}</div>
    </div>) : null;
  return <MsxArcTalk run={run} v={v} ev={ev} onPause={onPause} aid={s.aid} lines={lines} head={`${(SUM[round] || {}).name || 'ヒーローズファイナル'}の相手えらび`}
    bg="images/success/scenes/venue-summit.png" top={top} fallback={`${foe}と戦うよ。いってらっしゃい！`} doneText="⚔ 試合へ" onDone={onDone}/>;
}

// ヒーローズファイナル: 試合のあとの掛け合い
function MsxArcAfter({ run, v, ev, onPause, ctx, bondLv, after, onDone }) {
  const s = run.s;
  const lines = msxArcLines(`scn.${s.aid}.summit.r${after.round + 1}.${after.won ? 'win' : 'lose'}`, ctx, bondLv, { rival: after.foe });
  return <MsxArcTalk run={run} v={v} ev={ev} onPause={onPause} aid={s.aid} lines={lines} head={after.won ? '試合のあとで' : 'くやしい夜'} dark={!after.won}
    bg={after.won ? 'images/success/scenes/venue-summit.png' : 'images/story-bg/monhero_plaza_evening.jpg'} fallback={after.won ? '勝ったね！' : 'おつかれさま…'} onDone={onDone}/>;
}

// 特別演出(超グッド): 全身画+花吹雪+ふたりの記念写真。5〜6秒たってから「つぎへ」が出る
function MsxArcSpecial({ run, v, ev, onPause, ctx, bondLv, onDone }) {
  const s = run.s;
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 5500); return () => clearTimeout(t); }, []);
  const lines = msxArcLines(`scn.${s.aid}.fx.super`, ctx, bondLv);
  const [page, setPage] = useState(0);
  const per = 2; const pages = Math.max(1, Math.ceil(lines.length / per));
  const shown = lines.slice(page * per, page * per + per);
  const petals = useMemo(() => Array.from({ length: 16 }, (_, i) => ({ left: `${(i * 37) % 100}%`, dur: `${4 + (i % 5)}s`, delay: `${(i % 7) * 0.45}s`, ch: i % 3 === 0 ? '🌸' : i % 3 === 1 ? '💖' : '✨' })), []);
  const title = (msxSuc.SUC.ARC && msxSuc.SUC.ARC[s.aid] && msxSuc.SUC.ARC[s.aid].title) || '最高のチーム';
  const who = (l) => (l.who === 'narr' ? null : msxAidName(l.who));
  const next = () => (page + 1 < pages ? setPage(page + 1) : onDone());
  return (
    <MsxR3Frame run={run} back="中断" onBack={onPause} right="" body={(<>
      <style>{MSX_ARC_CSS}</style>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 420 }} data-msx-arc-special>
        <img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
        {petals.map((p, i) => <span key={i} className="arc-petal" style={{ left: p.left, animationDuration: p.dur, animationDelay: p.delay }}>{p.ch}</span>)}
        <div className="arc-photo">
          <div className="pic">
            <img src={msxArcFullBody(s.aid, 'excited')} alt="" style={{ right: '2%', height: '100%', width: '52%' }}/>
            <MsxMonArt run={run} className="mon" style={{ left: '32%', bottom: '4%', height: '58%' }}/>
          </div>
          <div className="cap">💖 {title} 💖</div>
        </div>
        <div className="arc-flash"/>
        <div className="v-talk">{shown.map((l, i) => <div key={`${page}-${i}`}>{who(l) ? <span className="who">{who(l)}</span> : null}{who(l) ? `「${l.t}」` : l.t}</div>)}</div>
      </div>
    </>)} foot={<div className="v-ft">{ready || page > 0 ? <button type="button" className="go" onClick={next} data-msx-arc-next>{page + 1 < pages ? 'つぎへ ▶' : '引退へ ▶'}</button> : <button type="button" className="on" style={{ flex: 2 }}>…</button>}</div>}/>
  );
}

// エンディング → お祝い → (超グッドなら)特別演出 → 見た印 → 引退
function MsxArcEnding({ run, setRun, v, ev, onPause, ctx, bondLv }) {
  const { SUC } = msxSuc;
  const s = run.s; const end = s.ending; const kind = end.kind;
  const [step, setStep] = useState(0); // 0 = エンディング / 1〜n = お祝い / n+1 = 特別演出
  useSuccessScene(kind === 'bad' ? 'cupLose' : 'cupWin', { season: msxCalendar(s.turn).season });
  const parties = Array.isArray(end.parties) ? end.parties : [];
  const finish = () => { const r = typeof SUC.endingSeen === 'function' ? SUC.endingSeen(s) : { state: { ...s, ending: { ...end, seen: true } } }; setRun({ ...run, s: r.state, arcAfter: undefined }); };
  const goNext = () => { if (step < parties.length) setStep(step + 1); else if (kind === 'super' && step === parties.length) setStep(step + 1); else finish(); };
  const E = MSX_ARC_END[kind] || MSX_ARC_END.good;
  if (step === 0) {
    const lines = msxArcLines(`scn.${s.aid}.end.${kind}`, ctx, bondLv);
    const top = <div className={`arc-end ${kind === 'bad' ? 'bad' : ''}`} data-msx-arc-end={kind}>{E.name}<small>{msxAidName(s.aid)}編・{E.sub}</small></div>;
    return <MsxArcTalk run={run} v={v} ev={ev} onPause={onPause} aid={s.aid} lines={lines} bg={E.bg} dark={kind === 'bad'} top={top} fallback="ここまで、ほんとにおつかれさま！" doneText={parties.length ? '🎉 お祝いへ ▶' : '引退へ ▶'} onDone={goNext}/>;
  }
  if (step <= parties.length) {
    const i = step - 1; const n = parties[i];
    const lines = msxArcLines(`scn.${s.aid}.party.${kind}${i + 1}`, ctx, bondLv);
    const top = <div className="arc-party" data-msx-arc-party={`${kind}${i + 1}`}><b>🎉 {(MSX_ARC_PARTY[kind] || [])[i] || 'お祝い'}</b><small>全能力 +{n}</small></div>;
    return <MsxArcTalk key={`p${step}`} run={run} v={v} ev={ev} onPause={onPause} aid={s.aid} lines={lines} bg="images/story-bg/monhero_plaza_evening.jpg" top={top}
      fallback="おめでとう！" doneText={step < parties.length ? '🎉 つぎのお祝い ▶' : kind === 'super' ? '📸 さいごに ▶' : '引退へ ▶'} onDone={goNext}/>;
  }
  return <MsxArcSpecial run={run} v={v} ev={ev} onPause={onPause} ctx={ctx} bondLv={bondLv} onDone={finish}/>;
}
