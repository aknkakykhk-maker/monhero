// ===== モンヒロサクセス 回3: 引退(E0 最終の評価 → E3 能力ポイント → E1 振り返り → E2 アシスト能力 → 保存枠へ)・ゲームオーバー(G1)・保存枠 =====
// 見本: docs/progress/player-raise/mock/png/v3-E.png・v3-G.png(v3-phone-E0〜E3・G1)
// ・評価は芯の evaluate(総合力・ランク・アシストポイント)。評価の札は C〜S(RANKING.md §7 の区切り)
// ・能力ポイントは芯の spendPts / autoPts。決めたら run に書く(中断しても使った分は残る)
// ・アシスト能力は ASSIST.md §5: 1体4種類まで・段1〜3の値段・あまりはなくなる。決めたら変えられない(2回押す)
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
  useSuccessSound('gameOver');
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
      <div className="v-kv"><b>もちかえり</b><span>持ちこみ・使ったアイテム・修行チケットは戻らない。保存枠には入らない</span></div></div>
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
  useSuccessSound('retire');
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
      <div className="v-card"><div className="v-kv"><b>残りポイント</b><span><b className="yel">{ws.pts}</b>(使うと総合力が上がる)</span></div><div className="v-kv"><b>そのあと</b><span>アシスト能力をポイントで取る → 保存枠へ</span></div></div>
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
        <div className="v-kv"><b>保存枠</b><span>{box ? `${box.mons.length + 1} / ${box.cap}体 に入る。次の育成の編成・対戦・合体に使える` : '…'}</span></div></div>
      <div style={{ flex: 1 }}/>
    </>);
    return <MsxR3Frame run={run} back="もどる" onBack={() => setStep(s.pts > 0 ? 'e3' : 'e0')} right={right} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={() => setStep('e2')} data-msx-r3-e1>✨ アシスト能力を取る({msxR3T().assist ? msxR3T().assist.pointsOf(ev.power) : ev.points}ポイント)</button></div>}/>;
  }

  // ---- E2 アシスト能力 ----
  // アシストの札: 表(data/monhero-success-assist.js)があれば、その候補・説明・値段・おまかせ。無ければ芯の ASSISTS
  const AT = msxR3T().assist;
  const A = {};
  const LVN = AT && AT.LV_MAX ? AT.LV_MAX : 3; // 第2版は段1〜5
  if (AT) AT.candidates(ws.hints).forEach((a) => { A[a.id] = { name: a.name, icon: a.icon, cost: a.cost.slice(0, LVN), scene: a.scene || null, type: a.type, ex: Array.from({ length: LVN }, (_, i) => AT.describe(a.id, i + 1)) }; });
  else Object.entries(SUC.ASSISTS || {}).forEach(([id, a]) => { A[id] = { name: a.name, icon: MSX_R3_ASSIST_ICON[id] || '✨', cost: a.cost, ex: [(MSX_R3_ASSIST_TEXT[id] || (() => ''))(a.v)] }; });
  const maxKinds = AT ? AT.MAX_KINDS : 4;
  const points = AT ? AT.pointsOf(ev.power) : ev.points;
  const cost = Object.entries(pick).reduce((a, [id, lv]) => a + ((A[id] && A[id].cost[lv - 1]) || 0), 0);
  const left = points - cost;
  const kinds = Object.keys(pick).length;
  const tap = (id, lv) => {
    const now = { ...pick };
    if (now[id] === lv) delete now[id]; else { if (!now[id] && kinds >= maxKinds) return; now[id] = lv; }
    const c = Object.entries(now).reduce((a, [k, l]) => a + A[k].cost[l - 1], 0);
    if (c > points) return;
    setPick(now); setSure(false);
  };
  const auto = () => {
    if (AT) { const r = AT.autoPick(points, ws.hints); const now = {}; r.picks.forEach((x) => { now[x.id] = x.lv; }); setPick(now); setSure(false); return; }
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
    let assists = Object.entries(pick).map(([id, lv]) => ({ id, lv }));
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
        <div className="v-stamp msx-pop" style={{ top: '6%', fontSize: 30 }}>保存枠に入った!<small>{run.nick || msxMonName(ws.species)}・評価 {grade.label}・総合力 {msxFmt(ev.power)}</small></div></div>
      <MsxSay aid={ws.aid} ex="happy" text="「おつかれさま! 次の育成で、編成に入れてあげてね」"/>
      {!fxDone && typeof MsxFxMoment === 'function' ? <MsxFxMoment kind="retire" title="保存枠に入った!" sub={`${run.nick || msxMonName(ws.species)}・評価 ${grade.label}`} species={ws.species} colors={run.colors} onDone={() => setFxDone(true)}/> : null}
      <div className="v-card"><div className="v-kv"><b>保存枠</b><span>{box ? `${box.mons.length} / ${box.cap}体` : '…'}</span></div></div>
    </>);
    return <MsxR3Frame run={run} back="とじる" onBack={() => { setRun(null); onPause(); }} right={right} body={body} foot={<div className="v-ft"><button type="button" onClick={() => setShowBox(true)}>📦 保存枠を見る</button><button type="button" className="go" onClick={() => { setRun(null); onPause(); }} data-msx-r3-home>ホームへ ▶</button></div>}/>;
  }
  const body = (<>
    <div className="v-pt"><div className="n">アシストポイント<b>{left}<small style={{ fontSize: 11, color: '#cbd5e1' }}> / {points}</small></b></div>
      <div className="r">総合力 {msxFmt(ev.power)} から {points}ポイント<br/><span className="yel">使った {cost}</span>・残り {left}(あまりは なくなる)<div className="bar p"><i style={{ width: `${Math.min(100, cost / Math.max(1, points) * 100)}%` }}/></div></div></div>
    {AT && Array.isArray(AT.SCENES) ? (
      <div className="r3-bar" data-msx-r3-scenes>{AT.SCENES.filter((sc) => Object.values(A).some((a) => a.scene === sc.key)).map((sc) => {
        const n = Object.keys(pick).filter((id) => A[id] && A[id].scene === sc.key).length;
        return <button type="button" key={sc.key} className={`r3-chip ${(atab || AT.SCENES[0].key) === sc.key ? 'on' : ''}`} onClick={() => setAtab(sc.key)} data-msx-r3-scene={sc.key}>{sc.name}{n ? ` ●${n}` : ''}</button>;
      })}</div>) : null}
    <div className="v-as">{Object.keys(A).filter((id) => !AT || !A[id].scene || A[id].scene === (atab || (AT.SCENES && AT.SCENES[0] ? AT.SCENES[0].key : A[id].scene))).map((id, i, arr) => {
      const a = A[id]; const got = pick[id] || 0; const dim = !got && kinds >= maxKinds;
      return (<div key={id} className={`v-a${got ? ' got' : ''}${dim ? ' dim' : ''}${i === arr.length - 1 && arr.length % 2 ? ' wide' : ''}`} data-msx-r3-assist={id}>
        <div className="nm">{cardIconNode(a.icon, 16)} {a.name}{AT && AT.TYPE_NAME && AT.TYPE_NAME[a.type] ? <small style={{ fontSize: 9, color: '#94a3b8', marginLeft: 4 }}>{AT.TYPE_NAME[a.type]}</small> : null}</div><div className="ex">{a.ex[Math.max(0, Math.min(a.ex.length - 1, (got || 1) - 1))]}</div>
        <div className="lv" style={{ display: 'grid', gridTemplateColumns: `repeat(${a.cost.length},1fr)`, gap: 3 }}>{a.cost.map((p, j) => <span key={j} className={got === j + 1 ? 'on' : ''} onClick={() => tap(id, j + 1)}>段{j + 1}<b>{p}</b></span>)}</div></div>);
    })}</div>
    <div className="v-pick">取るもの({kinds} / {maxKinds}種類): {kinds ? Object.entries(pick).map(([id, lv], i) => <React.Fragment key={id}>{i ? '・' : ''}<b>{A[id] ? `${A[id].icon} ${A[id].name}` : id} 段{lv}</b></React.Fragment>) : 'まだ選んでいない'}<br/>⚠ 決めたあとは変えられない</div>
    {res && res.full ? <div className="v-card" style={{ borderColor: '#f87171' }}><div className="sub"><b style={{ color: '#fca5a5' }}>保存枠がいっぱい</b>({res.box ? `${res.box.mons.length} / ${res.box.cap}体` : ''})。お別れで1体あけてから、もう一度「これで決める」を押してください。育成はこのまま残しておきます</div>
      <button type="button" className="msx-btn sub" onClick={() => setShowBox(true)}>📦 保存枠を見る</button></div> : null}
    {res && !res.ok && !res.full ? <div className="msx-note">保存できませんでした。もう一度押してください</div> : null}
  </>);
  const foot = <div className="v-ft"><button type="button" onClick={auto} data-msx-r3-auto>🎲 おまかせ</button><button type="button" onClick={() => { setPick({}); setSure(false); }}>やり直す</button>
    <button type="button" className="go" disabled={busy} onClick={decide} data-msx-r3-decide>{sure ? '本当に決める(変えられない)▶' : 'これで決める ▶'}</button></div>;
  return <MsxR3Frame run={run} back="もどる" onBack={() => setStep('e1')} right="1体4種類まで" body={body} foot={foot}/>;
}

// ---- 保存枠(引退した子・合体の子の一覧)。お別れは2回押す・「思い出」に名前とランクだけ残る ----
function MsxR3Box({ onClose }) {
  const [box, setBox] = useState(null);
  const [sel, setSel] = useState(null);
  const [bye, setBye] = useState(0);
  useEffect(() => { let alive = true; msxR3ReadBox().then((b) => { if (alive) setBox(b); }); return () => { alive = false; }; }, []);
  const cur = box && sel ? box.mons.find((m) => m.id === sel) : null;
  const saveEdit = async () => {
    if (!cur || !edit) return;
    const r = await msxR3EditMon(cur.id, edit.nick, edit.colors);
    if (!r.ok) { setEdit({ ...edit, err: r.why === 'name' ? 'その名前は使えません。ほかの名前にしてね' : '保存できませんでした' }); return; }
    setBox(r.box); setEdit(null);
    // 貸し出し中の子なら、フレンドに見える姿も新しい名前と色にする
    if (meta && meta.lend === cur.id && typeof monsucLendSet === 'function') { try { await monsucLendSet(r.mon, {}); } catch (e) {} }
  };
  const [meta, setMeta] = useState(null);
  const [fuse, setFuse] = useState(false);
  const [runFrom, setRunFrom] = useState(null);
  useEffect(() => { let alive = true; storeGet(MSX_KEYS.run, null).then((r) => { if (alive && r && r.from && typeof r.from.box === 'string') setRunFrom(r.from.box); }).catch(() => {}); return () => { alive = false; }; }, []);
  const [lendMsg, setLendMsg] = useState('');
  const [edit, setEdit] = useState(null); // { nick, colors, err } 名前と染色を変えている途中
  useEffect(() => { let alive = true; msxR3ReadMeta().then((m) => { if (alive) setMeta(m); }); return () => { alive = false; }; }, []);
  const lendOn = typeof monsucLendSet === 'function';
  const lendId = meta && typeof meta.lend === 'string' ? meta.lend : null;
  const saveLend = async (id) => { const m = { ...(await msxR3ReadMeta()), lend: id }; await storeSet(MSX_KEYS.meta, m); setMeta(m); };
  // フレンドに貸し出す(フレンド部の口 monsucLendSet・monsucLendClear。貸し出しの子の id は meta.lend に書く)
  const lend = async () => {
    if (!cur || !lendOn) return;
    let r = null; try { r = await monsucLendSet(cur, {}); } catch (e) { r = { ok: false, reason: 'error' }; }
    if (r && r.ok) { await saveLend(cur.id); setLendMsg('フレンドに貸し出しました'); }
    else setLendMsg(typeof monsucLendReasonText === 'function' ? monsucLendReasonText(r && r.reason) : '貸し出せませんでした');
  };
  const unlend = async () => { try { if (typeof monsucLendClear === 'function') await monsucLendClear(); } catch (e) {} await saveLend(null); setLendMsg('貸し出しをやめました'); };
  const farewell = async () => {
    if (!cur) return; if (bye < 2) { setBye(bye + 1); return; }
    if (lendId === cur.id) await unlend();
    const b = await msxR3Farewell(cur.id); setBox(b); setSel(null); setBye(0);
  };
  // 合体(別の会話の部品 MonsucFuseSheet)。編成に入れている子・貸し出し中の子・育成中の子は選べない
  if (fuse && box && typeof MonsucFuseSheet === 'function') {
    const locked = [...((meta && Array.isArray(meta.team)) ? meta.team.filter((t) => t && typeof t.box === 'string').map((t) => t.box) : []), ...(meta && meta.lend ? [meta.lend] : []), ...(runFrom ? [runFrom] : [])];
    return (<>
      <style>{MSX_R3_CSS}</style>
      <MonsucFuseSheet box={box} locked={locked} readBox={msxR3ReadBox} onSave={(n) => storeSet(MSX_KEYS.box, n)} onDone={() => { msxR3ReadBox().then(setBox); }} onClose={() => { setFuse(false); msxR3ReadBox().then(setBox); }}/>
    </>);
  }
  const body = !box ? <div className="msx-note">読み込んでいます…</div> : (<>
    <div className="v-h">📦 保存枠<small>{box.mons.length} / {box.cap}体(引退10回ごとに +5・最大60)</small></div>
    <div className="r3-box">{box.mons.length ? box.mons.slice().reverse().map((m) => (
      <button type="button" key={m.id} className={`r3-bm ${m.id === sel ? 'on' : ''}`} onClick={() => { setSel(m.id === sel ? null : m.id); setBye(0); setEdit(null); }} data-msx-r3-boxmon={m.id}>
        {Array.isArray(m.colors) && m.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? (() => { const dy = <span style={{ width: 38, height: 38, flex: 'none' }}><DyedMonsterImage baseId={m.species} src={msxMonImg(m.species)} masuColors={m.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>; return m.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(m.awake)} small>{dy}</MsxKira> : dy; })()
          : m.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(m.awake)} small><img src={msxMonThumb(m.species)} alt=""/></MsxKira> : <img src={msxMonThumb(m.species)} alt=""/>}<div className="nm"><b>{m.nick || msxMonName(m.species)}</b><small>{m.awake ? (m.awake >= 2 ? '🌈 超覚醒・' : '✨ 覚醒・') : ''}{msxMonName(m.species)}・{m.raised === false ? '未育成' : `評価 ${m.grade || m.rank || '—'}`}{m.gen > 1 ? `・${m.gen}代目` : ''}</small></div>
        <span className="pw">{m.raised === false ? '' : msxFmt(m.score || 0)}</span></button>)) : <div className="msx-note">まだ誰もいません。育成を最後まで終えると、ここに入ります</div>}</div>
    {cur && edit ? <div className="v-card" data-msx-r3-editbox>
      <div className="sub" style={{ color: '#f9a8d4', fontWeight: 900 }}>✏ 名前と染色を変える</div>
      <div style={{ display: 'flex', justifyContent: 'center', height: 110 }}>
        {edit.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? <DyedMonsterImage baseId={cur.species} src={msxMonImg(cur.species)} masuColors={edit.colors} alt="" draggable={false} style={{ height: '100%', objectFit: 'contain' }}/>
          : <img src={msxMonImg(cur.species)} alt="" style={{ height: '100%', objectFit: 'contain' }}/>}
      </div>
      <label className="v-inp" style={{ display: 'flex' }}>
        <input type="text" value={edit.nick} maxLength={typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8} onChange={(e) => setEdit({ ...edit, nick: e.target.value.slice(0, typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8), err: '' })} data-msx-r3-nick
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#1e1b4b', font: 'inherit', fontSize: 16 }}/>
        <small>{(edit.nick || '').length} / {typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8}文字</small>
      </label>
      {edit.err ? <div className="msx-note" style={{ color: '#fca5a5' }}>{edit.err}</div> : null}
      {typeof DyeRegionColorControls === 'function'
        ? <DyeRegionColorControls baseId={cur.species} colors={edit.colors}
          onChange={(idx, colorId) => { const n = edit.colors.slice(); while (n.length <= idx) n.push(null); n[idx] = colorId; setEdit({ ...edit, colors: n }); }}
          onCustom={(idx) => { const p = typeof _parseCustomColorId === 'function' ? _parseCustomColorId(edit.colors[idx]) : null; const h = p ? (p.h + 40) % 360 : 200; if (typeof _encodeCustomColorId === 'function') { const n = edit.colors.slice(); while (n.length <= idx) n.push(null); n[idx] = _encodeCustomColorId(h, 0.7, 0.85); setEdit({ ...edit, colors: n }); } }}
          big names={typeof ASSISTANT_MASMON_DYE_PARTS !== 'undefined' && ASSISTANT_MASMON_DYE_PARTS[cur.species] ? ASSISTANT_MASMON_DYE_PARTS[cur.species].map((x) => x[0]) : null}/>
        : <div className="msx-note">染色はこの端末では使えません</div>}
      <div className="r3-bar"><button type="button" className="r3-chip" onClick={() => setEdit(null)}>やめる</button><button type="button" className="r3-chip on" onClick={saveEdit} data-msx-r3-editsave>これで決める</button></div>
    </div> : cur ? <div className="v-card">
      {cur.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <div style={{ display: 'flex', justifyContent: 'center', height: 110, margin: '4px 0 8px' }} data-msx-r3-boxkira={cur.awake}>
        <MsxKira kind={msxKiraOf(cur.awake)} src={msxMonImg(cur.species)}>{Array.isArray(cur.colors) && cur.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? <DyedMonsterImage baseId={cur.species} src={msxMonImg(cur.species)} masuColors={cur.colors} alt="" draggable={false} style={{ height: 110, objectFit: 'contain' }}/>
          : <img src={msxMonImg(cur.species)} alt="" style={{ height: 110, objectFit: 'contain' }}/>}</MsxKira></div> : null}
      {cur.awake ? <div className="v-kv"><b>覚醒</b><span>{cur.awake >= 2 ? '🌈 超覚醒(全能力 +70・レアキラ)' : '✨ 覚醒(全能力 +30・キラ)'}</span></div> : null}
      <button type="button" className="msx-btn sub" onClick={() => setEdit({ nick: cur.nick || msxMonName(cur.species), colors: Array.isArray(cur.colors) ? cur.colors.slice(0, 6) : [], err: '' })} data-msx-r3-edit>✏ 名前と染色を変える</button>
      <MsxStRow stats={MSX_STATS.reduce((o, k) => ({ ...o, [k]: Math.round((cur.st && cur.st[k]) || 0) }), {})}/>
      <div className="v-kv"><b>忠誠 / 人気</b><span>{Math.round(cur.loy || 0)} / {Math.round(cur.pop || 0)}</span></div>
      <div className="v-kv"><b>アシスト能力</b><span>{Array.isArray(cur.assists) && cur.assists.length ? cur.assists.map((a) => `${(msxSuc && msxSuc.SUC.ASSISTS[a.id] || {}).name || a.id} 段${a.lv}`).join('・') : 'なし'}</span></div>
      {Array.isArray(cur.titles) && cur.titles.length ? <div className="v-kv"><b>称号</b><span>{cur.titles.slice(0, 4).map((t) => `「${msxR3TitleName(t)}」`).join('')}</span></div> : null}
      {lendOn && cur.raised !== false ? (lendId === cur.id ? <button type="button" className="msx-btn sub" onClick={unlend}>🤝 貸し出し中 → やめる</button> : <button type="button" className="msx-btn sub" onClick={lend}>🤝 フレンドに貸し出す</button>) : null}
      {lendMsg ? <div className="msx-note">{lendMsg}</div> : null}
      <button type="button" className="msx-btn sub" onClick={farewell} data-msx-r3-bye>{bye === 0 ? 'お別れする' : bye === 1 ? '本当にお別れする?(思い出に名前とランクだけ残る)' : 'もう一度押すと、お別れ(元に戻せない)'}</button>
    </div> : null}
    {box.memory.length ? <div className="r3-ttl">思い出: {box.memory.slice(-5).reverse().map((m) => `${m.nick || msxMonName(m.species)}(${m.rank || '—'})`).join('・')}</div> : null}
  </>);
  return (<>
    <style>{MSX_R3_CSS}</style>
    <MsxHd back="もどる" onBack={onClose}/>
    <div className="v-body r3">{body}</div>
    <div className="v-ft"><button type="button" onClick={onClose}>← もどる</button>{typeof MonsucFuseSheet === 'function' ? <button type="button" className="go" onClick={() => setFuse(true)} disabled={!box || box.mons.length < 2} data-msx-r3-fuse>🧬 合体する</button> : null}</div>
  </>);
}

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
