// ===== モンヒロサクセス 回3: 引退(E0 最終の評価 → E3 能力ポイント → E1 振り返り → E2 アシスト能力 → 保存枠へ)・ゲームオーバー(G1)・保存枠 =====
// 見本: docs/progress/player-raise/mock/png/v3-E.png・v3-G.png(v3-phone-E0〜E3・G1)
// ・評価は芯の evaluate(総合力・ランク・アシストポイント)。評価の札は C〜S(RANKING.md §7 の区切り)
// ・能力ポイントは芯の spendPts / autoPts。決めたら run に書く(中断しても使った分は残る)
// ・アシスト効果は ASSIST-V3.md(第3版 2026-11-14): 1体8種類まで・目盛り(1目盛りずつ ＋/−)・あまりはなくなる。決めたら変えられない(2回押す)
// ・保存枠へ入れたら(msxR3Retire)途中の育成のキーを消す。保存枠がいっぱいなら入れずに知らせる(自動では消さない・PLAN §3)
// ・ゲームオーバーは保存枠に入れない。持ちこみ・使ったアイテム・チケットは戻さない(社長 2026-11-12)
// ・入口 MsxR3(kind = 'battle' | 'over' | 'cup' | 'shugyo')は回2の MsxPlay から呼ばれる。保存枠の一覧 MsxR3Box は回2のホームから
const MSX_R3_ASSIST_TEXT = Object.freeze({
  sokoji: (v) => `いっしょのトレーニングの伸び +${v.join('/')}%`, kizuna: (v) => `忠誠が高いほど伸びる +${v.join('/')}%`, kaketsuke: (v) => `得意なトレーニングに来る率 +${v.join('/')}点`,
  hirameki: (v) => `大成功の率 +${v.join('/')}点`, hitonatsu: (v) => `親密度の上がり ×${v.join('/')}`, atooshi: (v) => `1位の能力の伸び +${v.join('/')}%`,
  ochitsuki: (v) => `失敗の率 −${v.join('/')}%`, itawari: (v) => `減る体力 −${v.join('/')}%`, shugyo: (v) => `修行の伸び +${v.join('/')}%`,
});
const MSX_R3_ASSIST_ICON = Object.freeze({ sokoji: '🔥', kizuna: '💞', kaketsuke: '📯', hirameki: '✨', hitonatsu: '🤝', atooshi: '🎯', ochitsuki: '🧘', itawari: '🩹', shugyo: '⚔' });
const MSX_R3_AUTO_ORDER = Object.freeze(['sokoji', 'hirameki', 'hitonatsu', 'atooshi', 'kaketsuke', 'kizuna', 'ochitsuki', 'itawari', 'shugyo']);

function MsxR3Over({ run, setRun, ctx, bondLv, onPause, debug }) {
  const { SUC } = msxSuc;
  const s = run.s;
  // ヒーローズファイナルの最後の試合のあとの掛け合い → エンディング・お祝い・特別演出(56-monhero-success-arc.jsx)→ 引退
  if (s.over !== 'gameover' && (run.arcAfter || (s.ending && !s.ending.seen))) {
    const v = SUC.peek(s); const ev = SUC.evaluate(s); const c = ctx || { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick, species: s.species };
    if (run.arcAfter) return <MsxArcAfter run={run} v={v} ev={ev} onPause={onPause} ctx={c} bondLv={bondLv || 1} after={run.arcAfter} onDone={() => setRun({ ...run, arcAfter: undefined })}/>;
    return <MsxArcEnding run={run} setRun={setRun} v={v} ev={ev} onPause={onPause} ctx={c} bondLv={bondLv || 1}/>;
  }
  if (s.over === 'gameover') return <MsxR3GameOver run={run} setRun={setRun} onPause={onPause}/>;
  return <MsxR3Retire run={run} setRun={setRun} onPause={onPause} debug={debug} SUC={SUC}/>;
}

// ---- ゲームオーバー(G1) ----
function MsxR3GameOver({ run, setRun, onPause }) {
  const { SUC } = msxSuc;
  const s = run.s; const v = SUC.peek(s); const ev = SUC.evaluate(s);
  const [log, setLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fxDone, setFxDone] = useState(false);
  useSuccessScene('gameOver');
  const again = async () => {
    if (busy) return; setBusy(true);
    try { await msxR3GameOver(s); await msxR3ClearRun(run.id); } catch (e) {}
    setRun(null); onPause();
  };
  // 終わった育成なので、上の帯(残りのターン・体力・ストレス)は出さない(2026-11-20 r1119-033 育-14)。負けは題の下の1か所だけ(育-12)
  void v; void ev;
  const body = (<>
    <div className="v-scene dk" style={{ flex: '1 1 0', minHeight: 220 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
      <div className="gr" style={{ bottom: 'calc(36% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '36%', height: '30%', filter: 'grayscale(.6) drop-shadow(0 8px 5px #0009)', transform: 'translateX(-50%) rotate(-8deg)' }}/>
      <div className="v-stamp ng msx-pop" data-msx-r3-over-ttl style={{ top: '5%', fontSize: 36, letterSpacing: 0, color: '#fee2e2', WebkitTextStroke: '3px #450a0a', paintOrder: 'stroke fill', textShadow: '0 3px 0 #450a0a, 0 0 12px #000' }}>育成は ここまで…<small>デビュー戦に 3回 負けた</small></div></div>
    <div className="v-card">
      {/* 「砂時計 残り 3/3」は、もう使えない物の数で迷わせたのでやめた(育-13) */}
      <div className="v-kv"><b>記録</b><span>{s.turn}ターン・トレーニング {(s.log && s.log.train) || 0}回</span></div>
      <div className="v-kv msx-kp"><b>もちかえり</b><span>持ちこみ・使ったアイテム・修行チケットは戻らない。マスモンボックスには入らない</span></div></div>
    <MsxSay aid={s.aid} ex="troubled" text={`「…つぎは もっとトレーニングしてから挑もう。わたしも 手伝うから! ${run.nick || 'このモンスター'}も、がんばったよ」`}/>
    {!fxDone && typeof MsxFxMoment === 'function' ? <MsxFxMoment kind="over" title="育成は ここまで…" sub="デビュー戦に 3回 負けた" species={s.species} colors={run.colors} onDone={() => setFxDone(true)}/> : null}
    {log ? <div className="v-card">{(run.log || []).length ? run.log.slice().reverse().map((l, i) => <div key={i} className="msx-note">{l.turn}ターン目: {l.t}</div>) : <div className="msx-note">まだありません</div>}</div> : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={() => setLog(!log)}>📖 記録を見る</button><button type="button" className="go" disabled={busy} onClick={again} data-msx-r3-again>育成を終えて 初めの画面へ ▶</button></div>;
  // 終わりの画面のボタンは行き先が分かる言葉にする(2026-11-19 r1119-025・U-22。前は「← 閉じる」で、どこへ行くか分からなかった)
  // 上は「中断」(この画面のまま閉じる)・下は「育成を終えて 初めの画面へ」(終わらせる)で、行き先の違いを言葉で分ける(育-133)
  return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
}

// ---- 引退 ----
function MsxR3Retire({ run, setRun, onPause, debug, SUC }) {
  const s = run.s;
  const [step, setStep] = useState(() => (run.s.pts > 0 ? 'e3' : 'e0')); // 能力ポイントが残っていれば先に使う → 最終の評価
  // 能力ポイント(E3)は、育成中の振り分けと同じく「押した能力の並び」を持ち、毎回 s から振り直す。
  // 「−」はその能力を最後に押した1つだけを抜くので、あとから振った別の能力は残る。まとめて振った分も並びに積むので、そのあと個別に戻せる(r1115-172)
  const capOfPt = (w, k) => (String(k).startsWith('m:') ? Infinity : typeof SUC.statCapOf === 'function' ? SUC.statCapOf(w, k) : 999); // 'm:' は技の熟練(上限は芯が見る)
  const replayPts = (list) => { let w = s; for (const k of list) { if (w.stats[k] >= capOfPt(w, k)) continue; const r = SUC.spendPts(w, k, 1); if (r.out.ok) w = r.state; } return w; };
  const [ptList, setPtList] = useState([]);
  const ptListRef = useRef(ptList); ptListRef.current = ptList; // 長押しで続けて振るとき、描き直しを待たず最新を読む
  const setPtListNow = (list) => { ptListRef.current = list; setPtList(list); };
  const ws = useMemo(() => replayPts(ptList), [s, ptList]); // 能力ポイントを使っている途中の写し
  const [ptTab, setPtTab] = useState('stat'); // 「能力」「技の熟練」(r1115-198)
  const [ptUnitM, setPtUnitM] = useMsxPtUnit(true);
  const [ptUnit, setPtUnit] = useMsxPtUnit();            // 1・5・10・100・MAX(r1115-092)
  const [ptWarn, setPtWarn] = useState(''); // 刻み(使うポイントの合計)では足りないときの知らせ(Issue #6807 UI-1。育成中の能力画面と同じ)
  const [pick, setPick] = useState({}); // アシスト能力 { id: 段 }
  const [atab, setAtab] = useState(null); // アシストの場面のタブ(第2版・7つ)
  const [fxDone, setFxDone] = useState(false);
  useSuccessScene('retire');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState(null);
  const [res, setRes] = useState(null);
  const [rankFix, setRankFix] = useState(null); // 引退の結果の画面で送り直せたときのランキング登録の結果 { ok, placeAll }
  const [showBox, setShowBox] = useState(false);
  const [, setTablesReady] = useState(0);
  useMsxR3Lines(s.aid);
  useEffect(() => { let alive = true; msxR3ReadBox().then((b) => { if (alive) setBox(b); }); return () => { alive = false; }; }, [res]);
  useEffect(() => { let alive = true; msxR3LoadTables().then(() => { if (alive) setTablesReady((n) => n + 1); }); return () => { alive = false; }; }, []);
  // 引退の結果の画面: 登録待ちが残っていたら送り直し、送れたら自分の順位を出し直す(待たない・落ちない)
  // ★フックは早期リターンより前に置く(後ろに置くと step が進んだときにフックの数が変わって画面が落ちる)
  useEffect(() => {
    if (step !== 'done' && step !== 'best3') return undefined;
    const base = res && res.rank;
    if (!base || base.ok || !base.pending || rankFix) return undefined;
    let alive = true;
    (async () => {
      try {
        if (typeof monsucRankFlush === 'function') await monsucRankFlush();
        if (!alive) return;
        const st = typeof monsucRankStatusOf === 'function' ? await monsucRankStatusOf(run.id) : null;
        if (!alive || st !== 'sent') return; // 送れたのが別の保留だった・まだ送れていないときは「登録待ち」のまま
        let place = null;
        if (typeof monsucRankRead === 'function') { const d = await monsucRankRead({ beta: s.rankBeta === 2 ? 2 : 1 }); if (d && d.mine) place = d.mine.place; }
        if (alive) setRankFix({ ok: true, placeAll: place });
      } catch (_) {}
    })();
    return () => { alive = false; };
  }, [step, res, rankFix]);
  const ev = SUC.evaluate(ws); const ev0 = SUC.evaluate(s);
  const right = `${Math.min(s.turn, msxSuc.core.TOTAL_TURNS)} / ${msxSuc.core.TOTAL_TURNS}ターン`;
  const grade = msxR3Grade(ev.power);
  const RK = msxR3Ranks(); const ri = Math.max(0, RK.findIndex(([k]) => k === grade.rank));
  const near = RK.slice(Math.max(0, Math.min(ri - 1, RK.length - 4)), Math.max(0, Math.min(ri - 1, RK.length - 4)) + 4); // 1つ下・いま・上2つの4枚
  const nextR = RK[ri + 1] || null;

  if (showBox) return <MsxR3Box onClose={() => { setShowBox(false); setRes(null); }}/>;

  // ---- E0 最終の評価(育成グレード) ----
  // 参考 v4 180〜186秒の形: モンスターを場面いっぱいに → 大きなグレードの印 → 総合力を真ん中に・次のグレードまでの棒(docs/spec/MONSUC_UI.md)
  // 能力ポイントが残っていれば先に E3 で使い切ってから、この画面で決まったグレードを見せる
  if (step === 'e0') {
    const plain = grade.label === `${grade.rank}${grade.step}`;
    const toNext = Number.isFinite(grade.toNext) ? grade.toNext : 0;
    const nextMin = ev.power + toNext; const curMin = nextMin - (SUC.GRADE_STEP || 500);
    const nextLabel = !plain ? null : nextR && nextMin >= nextR[1] ? `${nextR[0]}1` : `${grade.rank}${grade.step + 1}`;
    const pct = Math.max(0, Math.min(100, Math.round(((ev.power - curMin) / Math.max(1, nextMin - curMin)) * 100)));
    const body = (<>
      <div className="v-scene r3-grade" style={{ flex: '1 1 0' }} data-msx-r3-grade>
        <img className="bg" src={msxSceneBg(Math.min(s.turn, msxSuc.core.TOTAL_TURNS)).bg} alt=""/><div className="sh"/>
        <span className="r3-gaura" aria-hidden="true"/>
        <div className="gr" style={{ bottom: 'calc(24% - 5px)', width: '46%' }}/>
        <MsxMonArt run={run} className="mon" style={{ bottom: '24%', height: '64%' }} live/>
        <div className="r3-gttl">育成グレード</div>
        <div className="r3-medal msx-pop"><b>{plain ? grade.rank : grade.label}{plain ? <sup>{grade.step}</sup> : null}</b><span>GRADE</span></div>
        <div className="r3-gcard">
          <div className="v-num"><small>総合力</small><b>{msxFmt(ev.power)}</b></div>
          {nextLabel ? <div className="r3-gbar"><span className="g"><b>{grade.label}</b><small>{msxFmt(curMin)}</small></span><u><i style={{ width: `${pct}%` }}/></u><span className="g nx"><b>{nextLabel}</b><small>{msxFmt(nextMin)}</small></span></div> : null}
          {nextLabel ? <div className="r3-gnx">{nextLabel} まで あと <b>{msxFmt(toNext)}</b></div> : null}
        </div>
      </div>
      <MsxStRow who={ws} stats={ws.stats}/>
      <MsxSay aid={s.aid} ex="excited" text={`「${grade.label} だよ! ${run.nick || 'このモンスター'}、よくがんばったね!」`}/>
    </>);
    return <MsxR3Frame run={run} back={s.pts > 0 ? '戻る' : '初めの画面へ'} onBack={s.pts > 0 ? () => setStep('e3') : onPause} right={right} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep('e1')} data-msx-r3-e0>次へ ▶</button></div>}/>;
  }

  // ---- E3 能力ポイントをまとめて使う ----
  if (step === 'e3') {
    const capOf = capOfPt;
    // 刻みは「使うポイントの合計」(Issue #6807 UI-1: 10P = 合計10点ぶん。1点で+1の所と2点で+1の所をまたいでも合計で数える。
    //   技の熟練は10点で+1なので今までどおり段数で数える)。1つずつ並びに積むので、「−」も同じ刻み(戻るポイントの合計)で戻せる
    const spend = (k) => {
      const list = ptListRef.current.slice(); let w = replayPts(list);
      if (String(k).startsWith('m:')) { const lim = msxPtLimitM(ptUnitM, (SUC.PTS && SUC.PTS.mastery) || 10); let n = 0; while (n < lim) { const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; list.push(k); n += 1; } if (n) { setPtWarn(''); setPtListNow(list); } return; }
      const budget = msxPtLimit(ptUnit); let n = 0; let spent = 0;
      while (true) { if (w.stats[k] >= capOf(w, k)) break; const c = SUC.ptsCost(w, k); if (spent + c > budget) break; const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; list.push(k); spent += c; n += 1; }
      if (n) { setPtWarn(''); setPtListNow(list); }
      else if (budget !== Infinity && w.pts >= SUC.ptsCost(w, k) && w.stats[k] < capOf(w, k)) setPtWarn(`「${ptUnit}P」では足りないよ(この能力はいま ${SUC.ptsCost(w, k)}点で +1)`);
    };
    const undoK = (k) => {
      const list = ptListRef.current.slice();
      if (String(k).startsWith('m:')) { const lim = msxPtLimitM(ptUnitM, (SUC.PTS && SUC.PTS.mastery) || 10); let n = 0; while (n < lim) { const i = list.lastIndexOf(k); if (i < 0) break; list.splice(i, 1); n += 1; } if (n) { setPtWarn(''); setPtListNow(list); } return; }
      const budget = msxPtLimit(ptUnit);
      // 段ごとの値段は、振った順に はじめの状態から数え直す(2点で+1の段は2点ぶん戻る)
      const costs = []; let val = s.stats[k];
      for (const x of list) { if (x !== k) continue; costs.push(SUC.ptsCost({ ...s, stats: { ...s.stats, [k]: val } }, k)); val += 1; }
      let n = 0; let back = 0;
      while (costs.length) { const c = costs[costs.length - 1]; if (back + c > budget) break; const i = list.lastIndexOf(k); if (i < 0) break; list.splice(i, 1); costs.pop(); back += c; n += 1; }
      if (n) { setPtWarn(''); setPtListNow(list); }
      else if (budget !== Infinity && costs.length) setPtWarn(`「${ptUnit}P」では戻せないよ(最後の +1 は ${costs[costs.length - 1]}点ぶん)`);
    };
    // まとめて振る: いままでの振り分けを消して、1ポイントずつ並びに積み直す(結果は前と同じ。並びに残るので、あとから「−」で個別に戻せる)
    const preset = (kind) => {
      let w = s; const list = [];
      const one = (k) => { if (w.stats[k] >= capOf(w, k)) return false; const r = SUC.spendPts(w, k, 1); if (!r.out.ok) return false; w = r.state; list.push(k); return true; };
      if (kind === 'top') { const k = ev0.top && ev0.top[0] ? ev0.top[0] : 'pow'; while (w.pts > 0 && one(k)) { /* 1つの能力に全部 */ } }
      else if (kind === 'low') { while (w.pts > 0) { const k = MSX_STATS.slice().sort((x, y) => w.stats[x] - w.stats[y])[0]; if (!one(k)) break; } }
      else if (kind === 'bal') { let moved = true; while (moved && w.pts > 0) { moved = false; for (const k of MSX_STATS) { if (one(k)) moved = true; } } }
      setPtListNow(list);
    };
    // 使った点は上の「残り / 持っている点」で分かるので、別の行には出さない(r1119-033 観点8)
    const ownT = typeof SUC.techsOf === 'function' ? SUC.techsOf(s.species) : [];
    const mTechs = (Array.isArray(s.techs) ? s.techs : []).map((id) => ownT.find((t) => t && t.id === id)).filter(Boolean);
    const body = (<>
      <div className="v-pt"><div className="n">能力ポイント<b>{ws.pts}<small style={{ fontSize: 11, color: '#cbd5e1' }}> / {s.pts}</small></b></div>
        <div className="r">総合力 {msxFmt(ev0.power)} → <span className="yel">{msxFmt(ev.power)}</span> <i className={msxRankCls(ev.rank)}>{ev.rank}</i>
        {/* 注意書きはここに1行(一覧の下だと下のボタンの帯に隠れていた・2026-11-20 r1119-033 育-84) */}
        <span data-msx-pt-cap style={{ display: 'block', fontSize: 10.5, color: '#fbbf24' }}>上限はふつう999・その期の目安を超えた能力は2ポイントで+1</span></div></div>
      <div className="v-scene r3-mscene" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg(Math.min(s.turn, msxSuc.core.TOTAL_TURNS)).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ bottom: 'calc(6% - 5px)', width: '40%' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '6%', height: '74%' }} live/>
        <div className="r3-mtag">育成完了の前に</div></div>
      <MsxPtTabs tab={ptTab} setTab={setPtTab}/>
      <MsxPtUnits unit={ptTab === 'mastery' ? ptUnitM : ptUnit} setUnit={(x) => { if (ptTab === 'mastery') setPtUnitM(x); else setPtUnit(x); setPtWarn(''); }} mastery={ptTab === 'mastery'}/>
      {ptWarn ? <div className="msx-note" style={{ color: '#fbbf24' }} data-msx-pt-warn>{ptWarn}</div> : null}
      {ptTab === 'mastery' ? <MsxMasteryRows SUC={SUC} s={s} ws={ws} techs={mTechs} addOf={(k) => ptList.filter((x) => x === k).length} plus={spend} minus={undoK}/> : <>
      <div className="r3-bar"><span style={{ fontSize: 10, color: '#cbd5e1', alignSelf: 'center' }}>まとめて</span>
        <button type="button" className="chip" onClick={() => preset('top')}>全部 {MSX_STAT_NAME[(ev0.top || [])[0]] || 'ちから'}</button>
        <button type="button" className="chip" onClick={() => preset('low')}>おまかせで振る</button>
        <button type="button" className="chip" onClick={() => preset('bal')} data-msx-r3-bal>バランス</button></div>
      <div className="v-pa">{MSX_STATS.map((k) => {
        const add = ws.stats[k] - s.stats[k];
        return (<div key={k}><span className="nm">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span><span className="v0">{s.stats[k]}</span><span className="ad">{add ? `+${add}` : ''}</span>
          <span className="st"><MsxPtBtn className="chip sym minus pt44" aria-label={`${MSX_STAT_NAME[k]}を戻す`} disabled={!add} onPress={() => undoK(k)} data-msx-r3-ptminus={k}/>{/* 上げた量は値の横の「+6」の1か所だけ(育-82) */}<b aria-hidden="true"/><MsxPtBtn disabled={ws.pts < SUC.ptsCost(ws, k) || ws.stats[k] >= capOf(ws, k)} onPress={() => spend(k)} data-msx-r3-plus={k} className="chip on sym plus pt44" aria-label={`${MSX_STAT_NAME[k]}を上げる`}/></span></div>);
      })}</div>
      </>}
      <div aria-hidden="true" style={{ height: 56, flex: 'none' }}/>
      <MsxSay aid={s.aid} ex="excited" text={ws.pts > 0 ? '「能力ポイントが残ってるよ! 使い切ってから、最後の評価を見よう!」' : '「使い切ったね! それじゃあ、最後の評価を見よう!」'}/>
    </>);
    const foot = <div className="v-ft"><button type="button" onClick={() => setPtListNow([])}>振り直す</button><button type="button" className="go" onClick={() => { setRun({ ...run, s: ws }); setPtListNow([]); setStep('e0'); }} data-msx-r3-e3>決定 ▶</button></div>;
    return <MsxR3Frame run={run} back="初めの画面へ" onBack={onPause} right={right} body={body} foot={foot}/>;
  }

  // ---- E1 振り返り ----
  const mem = typeof SUC.memberOf === 'function' ? SUC.memberOf({ kind: 'raised', species: ws.species, stats: ws.stats, loy: ev.loyal, pop: ws.pop, lv: ws.lv, masteries: (ws.techs || []).map((t) => (ws.mastery && ws.mastery[t]) || 0), techs: ws.techs, aptUp: ws.aptUp, aptBase: ws.aptBase, aptAwake: ws.aptAwake }) : null;
  if (step === 'e1') {
    const cupWins = (ws.log && ws.log.wins) || 0; const cupLoss = (ws.log && ws.log.losses) || 0;
    const body = (<>
      <div className="v-h">🎓 引退 ── {run.nick || msxMonName(ws.species)}の育成が終わった<small>{msxAidName(ws.aid)}編・{ws.over === 'lost' ? 'ヒーローズファイナルで負けた' : '最後まで走り切った'}</small></div>
      <div className="v-scene r3-mscene" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg(Math.min(s.turn, msxSuc.core.TOTAL_TURNS)).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '32%', bottom: 'calc(6% - 5px)', width: '40%' }}/><MsxMonArt run={run} className="mon" style={{ left: '32%', bottom: '6%', height: '88%' }} live/>
        <div className="r3-msum"><span className="gd">{grade.label}</span><div className="v-num"><small>総合力</small><b>{msxFmt(ev.power)}</b></div></div></div>
      <MsxStRow who={ws} stats={ws.stats}/>
      <div className="v-rec">
        <div><small>🏆 大会</small>{cupWins + cupLoss}戦 {cupWins}勝{(ws.crowns || 0) ? `・👑 ${ws.crowns}回` : ''}</div>
        <div><small>🤝 忠誠 / ⭐ 人気</small>{ev.loyal} / {ws.pop}</div>
        <div><small>📯 集まりやすいトレーニング(上位3つ)</small>{(ev.top || []).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]}`).join('・')}</div>
        {mem ? <div><small>💥 編成での補正</small>{(mem.top || []).map((k, i) => <React.Fragment key={k}>{i ? '・' : ''}<span className="nw">{`${MSX_STAT_NAME[k]} ${Math.round(mem.bonus[k] || 0)}%`}</span></React.Fragment>)}</div> : null}
        {mem ? <div><small>🧩 アシストの基本値</small><span className="nw">親密度 {mem.bond0}</span>・<span className="nw">タッグ +{mem.tag}%</span>・<span className="nw">得意率 {Math.round((mem.fav || 0) * 100)}%</span></div> : null}
        {mem && mem.startAdd ? <div><small>📈 初めの能力</small>{MSX_STAT_NAME[mem.startAdd.stat]} +{mem.startAdd.v}</div> : null}
      </div>
      {(() => { const band = msxR3Band(grade.rank); const l = msxR3Line(`turn.retire.r${band}`, run, {}, `「${run.nick || 'このモンスター'}、まぢでがんばったね! 次の育成の編成に入ったら、${MSX_STAT_NAME[(ev.top || [])[0]] || 'ちから'}のトレーニングがすっごい伸びるよ!」`); return <MsxSay aid={ws.aid} ex={l.e || 'excited'} text={l.t}/>; })()}
      <div className="v-card"><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>🏅 この育成で手に入れたもの</div>
        <div className="v-kv"><b>賞金</b><span>合計 {msxFmt(ws.fameTotal || 0)}G</span></div>
        <div className="v-kv"><b>称号</b><span>{(ws.titles || []).length ? ws.titles.slice(0, 6).map((t) => `「${msxR3TitleName(t)}」`).join('') : 'なし'}</span></div>
        <div className="v-kv"><b style={{ width: 'auto', whiteSpace: 'nowrap' }}>マスモンボックス</b><span>{box ? `${box.mons.length + 1} / ${box.cap}体 に入る。次の育成の編成・対戦・合体に使える` : '…'}</span></div></div>
    </>);
    return <MsxR3Frame run={run} back="戻る" onBack={() => setStep('e0')} right={right} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep('e2')} data-msx-r3-e1>✨ アシスト効果を取る({msxR3T().assist ? msxR3T().assist.pointsOf(ev.power) : ev.points}ポイント) ▶</button></div>}/>;
  }

  // ---- E2 アシスト能力 ----
  // アシストの札: 表(data/monhero-success-assist.js)があれば、その候補・説明・値段・おまかせ。無ければ芯の ASSISTS
  const AT = msxR3T().assist;
  const A = {};
  const LVN = AT && AT.LV_MAX ? AT.LV_MAX : 3; // 第2版は段1〜5
  // 第3版(2026-11-14): 段の代わりに目盛り(pick の値 = 目盛り)。1行に −/＋ とゲージ・いまの効き目
  const V3 = !!(AT && AT.VERSION === 3);
  if (V3) AT.candidates(ws.hints).forEach((a) => { A[a.id] = { name: a.name, icon: a.icon, cost: a.cost.slice(), scene: a.scene || null, type: a.type, ref: a.ref, max: a.max, pt: a.pt, ex: Array.from({ length: a.max }, (_, i) => AT.describe(a.id, i + 1)) }; });
  else if (AT) AT.candidates(ws.hints).forEach((a) => { A[a.id] = { name: a.name, icon: a.icon, cost: a.cost.slice(0, LVN), scene: a.scene || null, type: a.type, ex: Array.from({ length: LVN }, (_, i) => AT.describe(a.id, i + 1)) }; });
  else Object.entries(SUC.ASSISTS || {}).forEach(([id, a]) => { A[id] = { name: a.name, icon: MSX_R3_ASSIST_ICON[id] || '✨', cost: a.cost, ex: [(MSX_R3_ASSIST_TEXT[id] || (() => ''))(a.v)] }; });
  const maxKinds = AT ? AT.MAX_KINDS : 4;
  const points = AT ? AT.pointsOf(ev.power) : ev.points;
  const cost = Object.entries(pick).reduce((a, [id, lv]) => a + ((A[id] && A[id].cost[lv - 1]) || 0), 0);
  const left = points - cost;
  const kinds = Object.keys(pick).length;
  const tap = (id, lv) => {
    const now = { ...pick };
    if (V3) { if (lv <= 0) delete now[id]; else { if (!now[id] && kinds >= maxKinds) return; now[id] = Math.min(A[id].max, lv); } }
    else if (now[id] === lv) delete now[id]; else { if (!now[id] && kinds >= maxKinds) return; now[id] = lv; }
    const c = Object.entries(now).reduce((a, [k, l]) => a + A[k].cost[l - 1], 0);
    if (c > points) return;
    setPick(now); setSure(false);
  };
  const auto = () => {
    if (AT) { const r = AT.autoPick(points, ws.hints); const now = {}; r.picks.forEach((x) => { now[x.id] = V3 ? x.n : x.lv; }); setPick(now); setSure(false); return; }
    const now = {}; let rest = points;
    // まず段1を上から4種類まで → 余りで段を上げる(ポイントを使い切りやすい)
    for (const id of MSX_R3_AUTO_ORDER) { if (!A[id] || Object.keys(now).length >= maxKinds) continue; if (A[id].cost[0] <= rest) { now[id] = 1; rest -= A[id].cost[0]; } }
    let up = true;
    while (up) { up = false; for (const id of Object.keys(now)) { const lv = now[id]; if (lv < 3) { const add = A[id].cost[lv] - A[id].cost[lv - 1]; if (add <= rest) { now[id] = lv + 1; rest -= add; up = true; } } } }
    setPick(now); setSure(false);
  };
  const decide = async () => {
    if (!sure) { setSure(true); return; }
    if (busy) return; setBusy(true);
    let assists = Object.entries(pick).map(([id, lv]) => (V3 ? { id, n: lv } : { id, lv }));
    if (AT) assists = AT.normPicks(assists, points).picks;
    // ★r1115-200 2: 空き確認 → 保存枠・成績・記録帳(msxR3Retire)→ 育成が終わったときのビートP → 途中の育成を消す の順。
    //   どこかで書けなければ完了にしない(育成は残す)。もう一度押すと、同じ育成IDで まだの分だけ補う(子・成績・記録帳は already で二重にならない・
    //   ビートPは途中の育成の beatSent と比べて差だけ足す)。満杯なら何も書かない(ビートPも付けない)
    let r = null;
    try { r = await msxR3Retire({ ...run, s: ws }, ws, ev, assists, debug); } catch (e) { r = { ok: false }; }
    if (!r || !r.ok) { setRes(r || { ok: false }); setBusy(false); setSure(false); return; }
    // 育成が終わったときのビートP(総合力のランク・1回だけ)。途中の育成に足して保存 → 本編の財布へ(デバッグの育成は足さない・msxSaveRun)
    //   前の押しで画面にだけ beatEnd が付いていても、保存を確かめるためにもう一度保存する(足すのは差だけ)
    const end = !run.beatEnd && SUC && typeof SUC.beatOfEnd === 'function'
      ? { ...run, s: { ...run.s, beatEarned: (Number(run.s.beatEarned) || 0) + SUC.beatOfEnd((SUC.evaluate(ws) || {}).rank) }, beatEnd: true } : run;
    let paid = false; try { paid = await setRun(end); } catch (e) { paid = false; }
    if (paid === 'stale') { setBusy(false); setSure(false); return; } // ほかの画面が先に進めていた(読み直しの窓が出る)
    if (paid !== true) { setRes({ ok: false, why: 'beat' }); setBusy(false); setSure(false); return; }
    let cl = false; try { cl = await msxR3ClearRun(run.id); } catch (e) { cl = false; }
    if (cl === false) { setRes({ ok: false, why: 'clear' }); setBusy(false); setSure(false); return; }
    setRes({ ok: true, mon: r.mon, best3: r.best3 || null, rank: r.rank || null }); setStep(r.best3 && typeof MsxBest3 === 'function' ? 'best3' : 'done');
    setBusy(false); setSure(false);
  };
  // ---- 自分だけのベスト3(56-monsuc-best3.jsx・r1113-057②)。入ったらせり上がる演出 → いつもの完了の段へ ----
  if (step === 'best3' && res && res.best3 && typeof MsxBest3 === 'function') {
    return <MsxR3Frame run={run} back="" onBack={() => setStep('done')} right={right} body={<MsxBest3 b={res.best3} run={run}/>} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep('done')} data-msx-best3-next>次へ ▶</button></div>}/>;
  }
  if (step === 'done') {
    const rankRes = rankFix || (res && res.rank) || null;
    const body = (<>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 260 }}><img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/><div className="v-burst"/>
        <div className="gr"/><MsxMonArt run={run} className="mon"/>
        <div className="v-stamp msx-pop" style={{ top: '6%', fontSize: 30 }}>育成完了!<small>{run.nick || msxMonName(ws.species)}・評価 {grade.label}・総合力 {msxFmt(ev.power)}</small></div></div>
      <MsxSay aid={ws.aid} ex="happy" text="「おつかれさま! 次の育成で、編成に入れてあげてね」"/>
      {!fxDone && typeof MsxFxMoment === 'function' ? <MsxFxMoment kind="retire" title="育成完了!" sub={`${run.nick || msxMonName(ws.species)}・評価 ${grade.label}`} species={ws.species} colors={run.colors} onDone={() => setFxDone(true)}/> : null}
      <div className="v-card"><div className="v-kv"><b style={{ width: 'auto', whiteSpace: 'nowrap' }}>マスモンボックス</b><span>{box ? `${box.mons.length} / ${box.cap}体` : '…'}</span></div></div>
      {rankRes && rankRes.ok ? <div className="v-card"><div className="sub">🏆 ランキングに登録しました{rankRes.placeAll ? `(全体 ${rankRes.placeAll}位)` : ''}</div></div> : null}
      {rankRes && !rankRes.ok && rankRes.pending ? <div className="v-card"><div className="sub">⏳ ランキングの登録待ちです。つながったら自動で送ります</div></div> : null}
      {rankRes && !rankRes.ok && !rankRes.pending && !['off', 'skip'].includes(rankRes.reason) ? <div className="v-card"><div className="sub">この記録はランキングに載せられませんでした</div></div> : null}
    </>);
    return <MsxR3Frame run={run} back="" onBack={() => { setRun(null); onPause(); }} right={right} body={body} foot={<div className="v-ft"><button type="button" onClick={() => setShowBox(true)}>🐾 マスモンボックスを見る</button><button type="button" className="go" onClick={() => { setRun(null); onPause(); }} data-msx-r3-home>モンサクルームへ ▶</button></div>}/>;
  }
  const body = (<>
    <div className="v-pt"><div className="n">アシストポイント<b>{left}<small style={{ fontSize: 11, color: '#cbd5e1' }}> / {points}</small></b></div>
      <div className="r">総合力 {msxFmt(ev.power)} から {points}ポイント<br/>あまりは なくなる<div className="bar p"><i style={{ width: `${Math.min(100, cost / Math.max(1, points) * 100)}%` }}/></div></div></div>
    {AT && Array.isArray(AT.SCENES) ? (
      <div className={`r3-bar${V3 ? ' sc' : ''}`} data-msx-r3-scenes>{AT.SCENES.filter((sc) => Object.values(A).some((a) => a.scene === sc.key)).map((sc) => {
        const n = Object.keys(pick).filter((id) => A[id] && A[id].scene === sc.key).length;
        return <button type="button" key={sc.key} ref={(el) => { if (el && V3 && atab === sc.key && el.parentElement && typeof centerCarouselChild === 'function') { try { centerCarouselChild(el.parentElement, [...el.parentElement.children].indexOf(el)); } catch (e) {} } }} className={`r3-chip ${(atab || AT.SCENES[0].key) === sc.key ? 'on' : ''}`} onClick={() => setAtab(sc.key)} data-msx-r3-scene={sc.key}>{sc.name}{n ? ` ●${n}` : ''}</button>;
      })}</div>) : null}
    <div className={V3 ? 'v-as3' : 'v-as'}>{Object.keys(A).filter((id) => !AT || !A[id].scene || A[id].scene === (atab || (AT.SCENES && AT.SCENES[0] ? AT.SCENES[0].key : A[id].scene))).map((id, i, arr) => {
      const a = A[id]; const got = pick[id] || 0; const dim = !got && kinds >= maxKinds;
      if (V3) { // 1行: 名前・参考/オリジナルの札・いまの効き目(右)/説明/− ゲージ ＋ と使ったポイント
        const nextCost = got < a.max ? a.pt : 0; const canUp = got < a.max && left >= nextCost && !dim;
        return (<div key={id} className={`v-a3${got ? ' got' : ''}${dim ? ' dim' : ''}`} data-msx-r3-assist={id}>
          <div className="h">{cardIconNode(a.icon, 16)}<span className="nm">{a.name}</span><span className={`rf${a.ref ? '' : ' o'}`}>{a.ref ? '参考' : 'オリジナル'}</span>{/* 効き目の数は下の説明の文の1か所だけ(右上の「+5%」と二重・取っていない札の「—」が押せる物に見えた・育-81・育-198) */}</div>
          <div className="ex"><b>{a.ex[Math.max(0, (got || 1) - 1)]}</b><span className="exd">{a.max > 1 ? `1目盛り ${AT.valueText(id, 1)}・最大 ${AT.valueText(id, a.max)}` : ''}</span></div>
          <div className="ctl"><button type="button" disabled={!got} onClick={() => tap(id, got - 1)} data-msx-r3-minus={id} className="chip sym minus" aria-label="へらす"/>
            <div className="gauge" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const n = Math.max(1, Math.round((e.clientX - r.left) / Math.max(1, r.width) * a.max)); tap(id, n); }}>
              <i style={{ width: `${got / a.max * 100}%` }}/>{a.max <= 25 ? Array.from({ length: a.max - 1 }, (_, j) => <s key={j} style={{ left: `${(j + 1) / a.max * 100}%` }}/>) : null}</div>
            <button type="button" disabled={!canUp} onClick={() => tap(id, got + 1)} data-msx-r3-plus={id} className="chip on sym plus" aria-label="ふやす"/><span className="c">{got ? `使った ${a.cost[got - 1]}pt` : `1目盛り ${a.pt}pt`}</span></div></div>);
      }
      return (<div key={id} className={`v-a${got ? ' got' : ''}${dim ? ' dim' : ''}${i === arr.length - 1 && arr.length % 2 ? ' wide' : ''}`} data-msx-r3-assist={id}>
        <div className="nm">{cardIconNode(a.icon, 16)} {a.name}{AT && AT.TYPE_NAME && AT.TYPE_NAME[a.type] ? <small style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{AT.TYPE_NAME[a.type]}</small> : null}</div><div className="ex">{a.ex[Math.max(0, Math.min(a.ex.length - 1, (got || 1) - 1))]}</div>
        <div className="lv" style={{ display: 'grid', gridTemplateColumns: `repeat(${a.cost.length},1fr)`, gap: 3 }}>{a.cost.map((p, j) => <span key={j} className={got === j + 1 ? 'on' : ''} onClick={() => tap(id, j + 1)}>段{j + 1}<b>{p}</b></span>)}</div></div>);
    })}</div>
    <div className="v-pick">取るもの({kinds} / {maxKinds}種類): {kinds ? Object.entries(pick).map(([id, lv], i) => <React.Fragment key={id}>{i ? '・' : ''}<b>{A[id] ? `${A[id].icon} ${A[id].name}` : id}{V3 ? '' : ` 段${lv}`}</b></React.Fragment>) : 'まだ選んでいない'}<br/>⚠ 決めたあとは変えられない</div>
    {res && res.full ? <div className="v-card" style={{ borderColor: '#f87171' }}><div className="sub"><b style={{ color: '#fca5a5' }}>マスモンボックスがいっぱい</b>({res.box ? `${res.box.mons.length} / ${res.box.cap}体` : ''})。お別れで1体あけてから、もう一度「これで決める」を押してください。育成はこのまま残しておきます</div>
      <button type="button" className="msx-btn sub" onClick={() => setShowBox(true)}>🐾 マスモンボックスを見る</button></div> : null}
    {res && !res.ok && !res.full ? <div className="msx-note">保存できませんでした。もう一度押してください{res.why === 'beat' || res.why === 'clear' ? '(マスモンボックスへの保存は済んでいます。二重には入りません)' : ''}</div> : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={auto} data-msx-r3-auto>🎲 おまかせ</button><button type="button" onClick={() => { setPick({}); setSure(false); }}>やり直す</button>
    <button type="button" className="go" disabled={busy} onClick={decide} data-msx-r3-decide>{sure ? '本当に決める(変えられない)▶' : 'これで決める ▶'}</button></div>;
  return <MsxR3Frame run={run} back="戻る" onBack={() => setStep('e1')} right="" body={body} foot={foot}/>;
}

// ---- 保存枠(引退した子・合体の子の一覧)。お別れは2回押す・「思い出」に名前とランクだけ残る ----
// 保存枠の一覧 MsxR3Box は、マスモン一覧(モンサク)の画面として 56-monhero-success-mm.jsx へ移した(2026-11-14 社長「マスモンの画面は画像参照」)

// ---- 回2の MsxPlay から呼ぶ入口 ----
// kind: 'battle'(期末・ヒーローズファイナル・月の大会の1戦。run.phase === 'battle')/'over'(引退・ゲームオーバー)/'cup'(受付)/'shugyo'(修行)
function MsxR3({ kind, run, setRun, v, ev, ctx, bondLv, debug, onBack, onPause, onActed }) {
  if (!msxSuc || !run || !run.s) return null;
  if (kind === 'battle') return <MsxR3Battle run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} onPause={onPause} debug={debug}/>;
  if (kind === 'over') return <MsxR3Over run={run} setRun={setRun} ctx={ctx} bondLv={bondLv} onPause={onPause} debug={debug}/>;
  if (kind === 'cup') return <MsxR3Cup run={run} setRun={setRun} v={v} ev={ev} onBack={onBack} onActed={onActed}/>;
  if (kind === 'shugyo') return <MsxR3Shugyo run={run} setRun={setRun} v={v} ev={ev} onBack={onBack} onPause={onPause}/>;
  return null;
}
