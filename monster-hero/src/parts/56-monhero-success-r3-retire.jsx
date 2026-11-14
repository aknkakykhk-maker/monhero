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
  // 頂への道の最後の試合のあとの掛け合い → エンディング・お祝い・特別演出(56-monhero-success-arc.jsx)→ 引退
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
    try { await msxR3GameOver(s); await msxR3ClearRun(); } catch (e) {}
    setRun(null); onPause();
  };
  const left = (SUC.REMATCH ? SUC.REMATCH.max : 3) - (s.rematchUsed || 0);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene dk" style={{ flex: '1 1 0', minHeight: 220 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
      <div className="gr" style={{ bottom: 'calc(36% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '36%', height: '30%', filter: 'grayscale(.6) drop-shadow(0 8px 5px #0009)', transform: 'translateX(-50%) rotate(-8deg)' }}/>
      <div className="v-stamp ng msx-pop" style={{ top: '5%', fontSize: 36 }}>育成は ここまで…<small>デビュー戦に 3回 負けた</small></div>
      <div className="v-lives"><i/><i/><i/><span>デビュー戦 0 / 3 のこり</span></div></div>
    <div className="v-card">
      <div className="v-kv"><b>やり直し</b><span>砂時計 のこり <b>{Math.max(0, left)} / 3</b></span></div>
      <div className="v-kv"><b>記録</b><span>{s.turn}ターン・トレーニング {(s.log && s.log.train) || 0}回・デビュー戦 0勝{s.debutLoss || 3}敗</span></div>
      <div className="v-kv"><b>もちかえり</b><span>持ちこみ・使ったアイテム・修行チケットは戻らない。マスモンボックスには入らない</span></div></div>
    <MsxSay aid={s.aid} ex="troubled" text={`「…つぎは もっとトレーニングしてから挑もう。わたしも 手伝うから! ${run.nick || 'このモンスター'}も、がんばったよ」`}/>
    {!fxDone && typeof MsxFxMoment === 'function' ? <MsxFxMoment kind="over" title="育成は ここまで…" sub="デビュー戦に 3回 負けた" species={s.species} colors={run.colors} onDone={() => setFxDone(true)}/> : null}
    {log ? <div className="v-card">{(run.log || []).length ? run.log.slice().reverse().map((l, i) => <div key={i} className="msx-note">{l.turn}ターン目: {l.t}</div>) : <div className="msx-note">まだありません</div>}</div> : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={() => setLog(!log)}>📖 きろくを見る</button><button type="button" className="go" disabled={busy} onClick={again} data-msx-r3-again>もう1回 はじめから ▶</button></div>;
  return <MsxR3Frame run={run} back="とじる" onBack={onPause} body={body} foot={foot}/>;
}

// ---- 引退 ----
function MsxR3Retire({ run, setRun, onPause, debug, SUC }) {
  const s = run.s;
  const [step, setStep] = useState('e0');
  const [ws, setWs] = useState(s);      // 能力ポイントを使っている途中の写し
  const [hist, setHist] = useState([]); // 「−」で戻す用
  const [pick, setPick] = useState({}); // アシスト能力 { id: 段 }
  const [atab, setAtab] = useState(null); // アシストの場面のタブ(第2版・7つ)
  const [fxDone, setFxDone] = useState(false);
  useSuccessScene('retire');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [box, setBox] = useState(null);
  const [res, setRes] = useState(null);
  const [showBox, setShowBox] = useState(false);
  const [, setTablesReady] = useState(0);
  useMsxR3Lines(s.aid);
  useEffect(() => { let alive = true; msxR3ReadBox().then((b) => { if (alive) setBox(b); }); return () => { alive = false; }; }, [res]);
  useEffect(() => { let alive = true; msxR3LoadTables().then(() => { if (alive) setTablesReady((n) => n + 1); }); return () => { alive = false; }; }, []);
  const ev = SUC.evaluate(ws); const ev0 = SUC.evaluate(s);
  const right = `${Math.min(s.turn, msxSuc.core.TOTAL_TURNS)} / ${msxSuc.core.TOTAL_TURNS}ターン`;
  const grade = msxR3Grade(ev.power);
  const RK = msxR3Ranks(); const ri = Math.max(0, RK.findIndex(([k]) => k === grade.rank));
  const near = RK.slice(Math.max(0, Math.min(ri - 1, RK.length - 4)), Math.max(0, Math.min(ri - 1, RK.length - 4)) + 4); // 1つ下・いま・上2つの4枚
  const nextR = RK[ri + 1] || null;

  if (showBox) return <MsxR3Box onClose={() => { setShowBox(false); setRes(null); }}/>;

  // ---- E0 最終の評価 ----
  if (step === 'e0') {
    const body = (<>
      <div className="v-h">🎓 最終の評価<small>育成のおわりに、総合力で G 〜 M が決まる(500ごとに番号)</small></div>
      <div className="v-rank"><MsxMonArt run={run} className="mon2"/><div className="tx"><small>最終の評価</small><div className="L">{grade.rank}<small style={{ fontSize: '40%', display: 'inline' }}>{grade.step}</small></div></div>
        <div className="tx"><small>総合力</small><b>{msxFmt(ev.power)}</b><small style={{ color: '#cbd5e1', marginTop: 3 }}>{`${grade.label} → ${grade.rank}${grade.step + 1} まで あと ${msxFmt(grade.toNext)}`}{nextR ? `・${nextR[0]} まで あと ${msxFmt(nextR[1] - ev.power)}` : ''}</small></div></div>
      <div className="v-gl">{near.map(([k, min]) => <div key={k} className={k === grade.rank ? 'now' : min < grade.min ? 'ok' : ''}><b>{k}</b><small>{msxFmt(min)} 〜</small></div>)}</div>
      <MsxStRow stats={ws.stats}/>
      <MsxSay aid={s.aid} ex="excited" text={ws.pts > 0 ? `「${grade.label} だよ! 能力ポイントが残ってるから、使い切ってからおわろ!」` : `「${grade.label} だよ! ${run.nick || 'このモンスター'}、よくがんばったね!」`}/>
      <div className="v-card"><div className="v-kv"><b>残りポイント</b><span><b className="yel">{ws.pts}</b>(使うと総合力が上がる)</span></div><div className="v-kv"><b>そのあと</b><span>アシスト効果をポイントで取る → マスモンボックスへ</span></div></div>
      <div style={{ flex: 1 }}/>
    </>);
    return <MsxR3Frame run={run} back="とじる" onBack={onPause} right={right} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep(ws.pts > 0 ? 'e3' : 'e1')} data-msx-r3-e0>{ws.pts > 0 ? `🔷 能力ポイントを使う(${ws.pts})` : 'つぎへ ▶'}</button></div>}/>;
  }

  // ---- E3 能力ポイントをまとめて使う ----
  if (step === 'e3') {
    const spend = (k) => { const r = SUC.spendPts(ws, k, 1); if (r.out.ok) { setHist([...hist, ws]); setWs(r.state); } };
    const undoK = (k) => { for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].stats[k] < ws.stats[k]) { setWs(hist[i]); setHist(hist.slice(0, i)); return; } } };
    const preset = (kind) => {
      let w = s; setHist([]);
      if (kind === 'top') { const k = ev0.top && ev0.top[0] ? ev0.top[0] : 'pow'; w = SUC.spendPts(w, k, 9999).state; }
      else if (kind === 'low') w = SUC.autoPts(w).state;
      else if (kind === 'bal') { let moved = true; while (moved && w.pts > 0) { moved = false; for (const k of MSX_STATS) { const r = SUC.spendPts(w, k, 1); if (r.out.ok) { w = r.state; moved = true; } } } }
      setWs(w);
    };
    const used = s.pts - ws.pts;
    const body = (<>
      <div className="v-pt"><div className="n">能力ポイント<b>{ws.pts}<small style={{ fontSize: 11, color: '#cbd5e1' }}> / {s.pts}</small></b></div>
        <div className="r">使った <span className="yel">{used}</span>・残り {ws.pts}<br/>総合力 {msxFmt(ev0.power)} → <span className="yel">{msxFmt(ev.power)}</span> <i className={msxRankCls(ev.rank)}>{ev.rank}</i></div></div>
      <div className="r3-bar"><span style={{ fontSize: 10, color: '#cbd5e1', alignSelf: 'center' }}>まとめて</span>
        <button type="button" className="r3-chip" onClick={() => preset('top')}>全部 {MSX_STAT_NAME[(ev0.top || [])[0]] || 'ちから'}</button>
        <button type="button" className="r3-chip" onClick={() => preset('low')}>弱いところ</button>
        <button type="button" className="r3-chip" onClick={() => preset('bal')} data-msx-r3-bal>バランス</button>
        <button type="button" className="r3-chip" onClick={() => { setWs(s); setHist([]); }}>もどす</button></div>
      <div className="v-pa">{MSX_STATS.map((k) => {
        const add = ws.stats[k] - s.stats[k];
        return (<div key={k}><span className="nm">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span><span className="v0">{s.stats[k]}</span><span className="ad">{add ? `+${add}` : ''}</span>
          <span className="st"><button type="button" disabled={!add} onClick={() => undoK(k)}>−</button><b>{add}</b><button type="button" disabled={ws.pts < SUC.ptsCost(ws, k) || ws.stats[k] >= 999} onClick={() => spend(k)} data-msx-r3-plus={k}>＋</button></span></div>);
      })}</div>
      <div className="v-card"><div className="v-kv"><b>伸びすぎ注意</b><span>能力は 999 まで。その期の目安を超えた能力は、2ポイントで +1</span></div></div>
      <div style={{ flex: 1 }}/>
    </>);
    const foot = <div className="v-ft"><button type="button" onClick={() => { setWs(s); setHist([]); }}>やり直す</button><button type="button" className="go" onClick={() => { setRun({ ...run, s: ws }); setStep('e1'); }} data-msx-r3-e3>これで決める ▶</button></div>;
    return <MsxR3Frame run={run} back="もどる" onBack={() => setStep('e0')} right={right} body={body} foot={foot}/>;
  }

  // ---- E1 振り返り ----
  const mem = typeof SUC.memberOf === 'function' ? SUC.memberOf({ kind: 'raised', species: ws.species, stats: ws.stats, loy: ev.loyal, pop: ws.pop, lv: ws.lv, masteries: (ws.techs || []).map((t) => (ws.mastery && ws.mastery[t]) || 0), techs: ws.techs, aptUp: ws.aptUp, aptBase: ws.aptBase, aptAwake: ws.aptAwake }) : null;
  if (step === 'e1') {
    const cupWins = (ws.log && ws.log.wins) || 0; const cupLoss = (ws.log && ws.log.losses) || 0;
    const sc = (typeof MSX_SCENARIOS !== 'undefined' ? MSX_SCENARIOS : []).find((x) => x.aid === ws.aid);
    const body = (<>
      <div className="v-h">🎓 引退 ── {run.nick || msxMonName(ws.species)}の育成がおわった<small>{msxAidName(ws.aid)}編{sc ? `「${sc.title}」` : ''}・{ws.over === 'lost' ? '頂への道で負けた' : '最後まで走り切った'}</small></div>
      <div className="v-rank"><MsxMonArt run={run} className="mon2"/><div className="tx"><small>育成ランク</small><div className="L">{grade.rank}<small style={{ fontSize: '40%', display: 'inline' }}>{grade.step}</small></div></div>
        <div className="tx"><small>総合力</small><b>{msxFmt(ev.power)}</b><small style={{ color: '#cbd5e1', marginTop: 3 }}>評価 {grade.label}</small></div></div>
      <MsxStRow stats={ws.stats}/>
      <div className="v-rec">
        <div><small>🏆 大会</small>{cupWins + cupLoss}戦 {cupWins}勝{(ws.crowns || 0) ? `・👑 ${ws.crowns}回` : ''}</div>
        <div><small>🤝 忠誠 / ⭐ 人気</small>{ev.loyal} / {ws.pop}</div>
        <div><small>📯 集まりやすいトレーニング(上位3つ)</small>{(ev.top || []).map((k) => `${MSX_STAT_ICON[k]}${MSX_STAT_NAME[k]}`).join('・')}</div>
        {mem ? <div><small>💥 編成での補正</small>{(mem.top || []).map((k) => `${MSX_STAT_NAME[k]} ${Math.round(mem.bonus[k] || 0)}%`).join('・')}</div> : null}
        {mem ? <div><small>🧩 アシストの基本値</small>親密度 {mem.bond0}・タッグ +{mem.tag}%・得意率 {Math.round((mem.fav || 0) * 100)}%</div> : null}
        {mem && mem.startAdd ? <div><small>📈 はじめの能力</small>{MSX_STAT_NAME[mem.startAdd.stat]} +{mem.startAdd.v}</div> : null}
      </div>
      {(() => { const band = msxR3Band(grade.rank); const l = msxR3Line(`turn.retire.r${band}`, run, {}, `「${run.nick || 'このモンスター'}、まぢでがんばったね! 次の育成の編成に入ったら、${MSX_STAT_NAME[(ev.top || [])[0]] || 'ちから'}のトレーニングがすっごい伸びるよ!」`); return <MsxSay aid={ws.aid} ex={l.e || 'excited'} text={l.t}/>; })()}
      <div className="v-card"><div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>🏅 この育成で手に入れたもの</div>
        <div className="v-kv"><b>賞金</b><span>合計 {msxFmt(ws.fameTotal || 0)}G</span></div>
        <div className="v-kv"><b>称号</b><span>{(ws.titles || []).length ? ws.titles.slice(0, 6).map((t) => `「${msxR3TitleName(t)}」`).join('') : 'なし'}</span></div>
        <div className="v-kv"><b style={{ width: 'auto', whiteSpace: 'nowrap' }}>マスモンボックス</b><span>{box ? `${box.mons.length + 1} / ${box.cap}体 に入る。次の育成の編成・対戦・合体に使える` : '…'}</span></div></div>
      <div style={{ flex: 1 }}/>
    </>);
    return <MsxR3Frame run={run} back="もどる" onBack={() => setStep(s.pts > 0 ? 'e3' : 'e0')} right={right} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep('e2')} data-msx-r3-e1>✨ アシスト効果を取る({msxR3T().assist ? msxR3T().assist.pointsOf(ev.power) : ev.points}ポイント)</button></div>}/>;
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
    let r = null;
    try { r = await msxR3Retire({ ...run, s: ws }, ws, ev, assists, debug); } catch (e) { r = { ok: false }; }
    if (r && r.ok) { try { await msxR3ClearRun(); } catch (e) {} setRes({ ok: true, mon: r.mon }); setStep('done'); }
    else setRes(r || { ok: false });
    setBusy(false); setSure(false);
  };
  if (step === 'done') {
    const body = (<>
      <div className="v-scene" style={{ flex: '1 1 0', minHeight: 260 }}><img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/><div className="v-burst"/>
        <div className="gr"/><MsxMonArt run={run} className="mon"/>
        <div className="v-stamp msx-pop" style={{ top: '6%', fontSize: 30 }}>育成完了!<small>{run.nick || msxMonName(ws.species)}・評価 {grade.label}・総合力 {msxFmt(ev.power)}</small></div></div>
      <MsxSay aid={ws.aid} ex="happy" text="「おつかれさま! 次の育成で、編成に入れてあげてね」"/>
      {!fxDone && typeof MsxFxMoment === 'function' ? <MsxFxMoment kind="retire" title="育成完了!" sub={`${run.nick || msxMonName(ws.species)}・評価 ${grade.label}`} species={ws.species} colors={run.colors} onDone={() => setFxDone(true)}/> : null}
      <div className="v-card"><div className="v-kv"><b style={{ width: 'auto', whiteSpace: 'nowrap' }}>マスモンボックス</b><span>{box ? `${box.mons.length} / ${box.cap}体` : '…'}</span></div></div>
    </>);
    return <MsxR3Frame run={run} back="とじる" onBack={() => { setRun(null); onPause(); }} right={right} body={body} foot={<div className="v-ft"><button type="button" onClick={() => setShowBox(true)}>🐾 マスモンボックスを見る</button><button type="button" className="go" onClick={() => { setRun(null); onPause(); }} data-msx-r3-home>ホームへ ▶</button></div>}/>;
  }
  const body = (<>
    <div className="v-pt"><div className="n">アシストポイント<b>{left}<small style={{ fontSize: 11, color: '#cbd5e1' }}> / {points}</small></b></div>
      <div className="r">総合力 {msxFmt(ev.power)} から {points}ポイント<br/><span className="yel">使った {cost}</span>・残り {left}(あまりは なくなる)<div className="bar p"><i style={{ width: `${Math.min(100, cost / Math.max(1, points) * 100)}%` }}/></div></div></div>
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
          <div className="h">{cardIconNode(a.icon, 16)}<span className="nm">{a.name}</span><span className={`rf${a.ref ? '' : ' o'}`}>{a.ref ? '参考' : 'オリジナル'}</span><b className="val">{got ? AT.valueText(id, got) : '—'}</b></div>
          <div className="ex">{a.ex[Math.max(0, (got || 1) - 1)]}{a.max > 1 ? `(1目盛り ${AT.valueText(id, 1)}・${a.pt}pt/最大 ${AT.valueText(id, a.max)})` : `(${a.pt}pt)`}</div>
          <div className="ctl"><button type="button" disabled={!got} onClick={() => tap(id, got - 1)} data-msx-r3-minus={id}>−</button>
            <div className="gauge" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const n = Math.max(1, Math.round((e.clientX - r.left) / Math.max(1, r.width) * a.max)); tap(id, n); }}>
              <i style={{ width: `${got / a.max * 100}%` }}/>{a.max <= 25 ? Array.from({ length: a.max - 1 }, (_, j) => <s key={j} style={{ left: `${(j + 1) / a.max * 100}%` }}/>) : null}</div>
            <button type="button" disabled={!canUp} onClick={() => tap(id, got + 1)} data-msx-r3-plus={id}>＋</button><span className="c">{got ? `${a.cost[got - 1]}pt` : `${a.pt}pt`}</span></div></div>);
      }
      return (<div key={id} className={`v-a${got ? ' got' : ''}${dim ? ' dim' : ''}${i === arr.length - 1 && arr.length % 2 ? ' wide' : ''}`} data-msx-r3-assist={id}>
        <div className="nm">{cardIconNode(a.icon, 16)} {a.name}{AT && AT.TYPE_NAME && AT.TYPE_NAME[a.type] ? <small style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{AT.TYPE_NAME[a.type]}</small> : null}</div><div className="ex">{a.ex[Math.max(0, Math.min(a.ex.length - 1, (got || 1) - 1))]}</div>
        <div className="lv" style={{ display: 'grid', gridTemplateColumns: `repeat(${a.cost.length},1fr)`, gap: 3 }}>{a.cost.map((p, j) => <span key={j} className={got === j + 1 ? 'on' : ''} onClick={() => tap(id, j + 1)}>段{j + 1}<b>{p}</b></span>)}</div></div>);
    })}</div>
    <div className="v-pick">取るもの({kinds} / {maxKinds}種類): {kinds ? Object.entries(pick).map(([id, lv], i) => <React.Fragment key={id}>{i ? '・' : ''}<b>{A[id] ? `${A[id].icon} ${A[id].name}` : id} {V3 ? AT.valueText(id, lv) : `段${lv}`}</b></React.Fragment>) : 'まだ選んでいない'}<br/>⚠ 決めたあとは変えられない</div>
    {res && res.full ? <div className="v-card" style={{ borderColor: '#f87171' }}><div className="sub"><b style={{ color: '#fca5a5' }}>マスモンボックスがいっぱい</b>({res.box ? `${res.box.mons.length} / ${res.box.cap}体` : ''})。お別れで1体あけてから、もう一度「これで決める」を押してください。育成はこのまま残しておきます</div>
      <button type="button" className="msx-btn sub" onClick={() => setShowBox(true)}>🐾 マスモンボックスを見る</button></div> : null}
    {res && !res.ok && !res.full ? <div className="msx-note">保存できませんでした。もう一度押してください</div> : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={auto} data-msx-r3-auto>🎲 おまかせ</button><button type="button" onClick={() => { setPick({}); setSure(false); }}>やり直す</button>
    <button type="button" className="go" disabled={busy} onClick={decide} data-msx-r3-decide>{sure ? '本当に決める(変えられない)▶' : 'これで決める ▶'}</button></div>;
  return <MsxR3Frame run={run} back="もどる" onBack={() => setStep('e1')} right={`1体${maxKinds}種類まで`} body={body} foot={foot}/>;
}

// ---- 保存枠(引退した子・合体の子の一覧)。お別れは2回押す・「思い出」に名前とランクだけ残る ----
// 保存枠の一覧 MsxR3Box は、マスモン一覧(モンサク)の画面として 56-monhero-success-mm.jsx へ移した(2026-11-14 社長「マスモンの画面は画像参照」)

// ---- 回2の MsxPlay から呼ぶ入口 ----
// kind: 'battle'(期末・頂への道・月の大会の1戦。run.phase === 'battle')/'over'(引退・ゲームオーバー)/'cup'(受付)/'shugyo'(修行)
function MsxR3({ kind, run, setRun, v, ev, ctx, bondLv, debug, onBack, onPause, onActed }) {
  if (!msxSuc || !run || !run.s) return null;
  if (kind === 'battle') return <MsxR3Battle run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} onPause={onPause} debug={debug}/>;
  if (kind === 'over') return <MsxR3Over run={run} setRun={setRun} ctx={ctx} bondLv={bondLv} onPause={onPause} debug={debug}/>;
  if (kind === 'cup') return <MsxR3Cup run={run} setRun={setRun} v={v} ev={ev} onBack={onBack} onActed={onActed}/>;
  if (kind === 'shugyo') return <MsxR3Shugyo run={run} setRun={setRun} v={v} ev={ev} onBack={onBack} onPause={onPause}/>;
  return null;
}
