// ===== モンヒロサクセス 回3: 大会(受付 C1 → 組み合わせ表 B1 → バトルカード C2 → 1戦 → 勝ち B2 / 負け C4 → ごはん C3) =====
// 見本: docs/progress/player-raise/mock/png/v3-C.png・v3-B.png(v3-phone-C1〜C4・B1・B2)
// ・戦うのは1戦だけ(TOURNAMENT §15)。組み合わせ表は芯の bracketOf の演出
// ・試合は助手マスモン対戦の芯で回し、観戦は 56-assistant-masmon-battle-view.jsx の部品(AmbwPanel・ambwIsHighlight・AMBW_CSS)を使い回す
// ・スキップ(結果だけ)は、優勝したことのある大会だけ(SUC.canSkip)。中で試合は計算する
// ・負けたら砂時計(同じ相手)・虹の砂時計(相手を変える)でやり直せる(1回の育成で3回まで・settle の前に SUC.rematch)
// ・勝ち負けを付けたあと(settle)は、run.phase を 'battle' のまま run.out.r3 に「賞品とごはんの段」を持つ(中断しても同じ所から)
function MsxR3Frame({ back = 'もどる', onBack, run, right, body, foot }) {
  const s = run.s;
  return (
    <>
      <style>{MSX_R3_CSS}</style>
      <MsxHd back={back} onBack={onBack} sub={`${msxAidName(s.aid)}編`} right={right != null ? right : `💰 名声 ${msxFmt(s.fame)}`}/>
      <div className="v-body r3">{body}</div>
      {foot}
    </>
  );
}

// ---- 受付(C1): 今月の大会の札。出ると1ターン使う(芯の act({kind:'cup'})) ----
const msxR3WhyText = (e, s) => {
  if (!e || e.ok) return '';
  if (e.why === 'stat') return `能力が ${msxFmt(e.need)} 以上 要る`;
  if (e.why === 'chain') return '1つ下の星で優勝すると出られる';
  if (e.why === 'dist') return 'その間合いの適性が C 以上 要る';
  if (e.why === 'type') return 'タイプが合わない';
  if (e.why === 'techs') return `技を ${e.need}つ以上 覚えていると出られる`;
  if (e.why === 'cond') return '体調が悪いと出られない';
  if (e.why === 'loyal') return `忠誠が ${e.need} 以上 要る`;
  if (e.why === 'fame') return `名声の合計が ${msxFmt(e.need)} 以上 要る(いま ${msxFmt(s.fameTotal)})`;
  return '出られない';
};
const msxR3CupReward = (SUC, c) => {
  const R = SUC.CUP_SYS ? (SUC.CUP_SYS[c.sys] || {}) : {};
  const out = [];
  const pts = { 3: 10, 4: 20 }[c.star]; const pop = { 2: 2, 3: 4, 4: 8 }[c.star]; const up = { 2: 6, 3: 12 }[c.star];
  if (pts) out.push(`能力ポイント +${pts}`);
  if (pop) out.push(`人気 +${pop}`);
  if (R.stat && up) out.push(`${MSX_STAT_NAME[R.stat]} +${up}`);
  if (c.star >= 4) out.push('全能力 +4');
  if (c.scenario) out.push('シナリオのごほうび');
  return out.length ? out.join('・') : '賞金と修行チケット';
};
function MsxR3Cup({ run, setRun, v, ev, onBack, onActed }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const cups = Array.isArray(v.cups) ? v.cups : [];
  const [pick, setPick] = useState(() => { const c = cups.find((x) => x.entry && x.entry.ok); return c ? c.id : null; });
  const cur = cups.find((c) => c.id === pick) || null;
  const go = (skip) => {
    if (!cur || !cur.entry || !cur.entry.ok) return;
    const r = SUC.act(s, { kind: 'cup', id: cur.id });
    if (!r.out.ok) return;
    const next = { ...run, s: r.state, out: null, r3skip: skip ? true : undefined, log: [...(run.log || []), { turn: s.turn, t: `${msxR3CupName(cur.sys)}に出た` }].slice(-20) };
    onActed(next);
  };
  const P = SUC.periodOf(s.turn);
  const toForced = P.key === 'final' ? null : P.left;
  const cal = msxCalendar(s.turn);
  useMsxR3Lines(s.aid);
  const nOk = cups.filter((c) => c.entry && c.entry.ok).length;
  const openLine = msxR3Line('turn.cup.open', run, { cup: cur ? msxR3CupName(cur.sys) : '' }, nOk ? `「今月は ${nOk}つ 出られるよ! 出ると1ターン使うから、訓練とどっちにするか考えてね」` : '「今月は出られる大会がないみたい。訓練でじっくり力をつけよ!」');
  const body = (<>
    <MsxBand s={s} v={v} ev={ev} use={20}/>
    <div className="v-scene low" style={{ flex: '0 0 auto', minHeight: 150 }}><img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/><div className="sh"/>
      <img src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', left: '-2%', bottom: '-98%', height: '190%' }}/>
      <div className="v-ev-h"><small>{cal.year}年目 {cal.month}月・{v.period.name}</small>🏆 大会の受付</div>
      <div className="v-ibub" style={{ left: '38%', top: 'auto', bottom: 10 }}>{openLine.t}</div>
    </div>
    <div className="v-cups">
      {cups.length ? cups.map((c) => {
        const ok = c.entry && c.entry.ok;
        const cls = !ok ? 'ng' : c.id === pick ? 'sel' : c.rival ? 'rv' : c.done ? 'won' : '';
        return (
          <button type="button" key={c.id} className={`v-cup ${cls}`} disabled={!ok} onClick={() => setPick(c.id)} data-msx-r3-cup={c.id}>
            <div className="e">{c.scenario ? '📖' : (MSX_R3_CUP_ICON[c.sys] || '🏆')}</div>
            <div className="tx"><b>{c.scenario ? c.name : msxR3CupName(c.sys)}</b>
              <small>{!ok ? `✖ ${msxR3WhyText(c.entry, s)}` : c.rival ? `ライバル: ${c.rival.name}` : c.done ? '👑 優勝したことがある → ⏩ スキップできる' : '出られる ✔'}</small>
              <span className="rw">🎁 {msxR3CupReward(SUC, c)}</span></div>
            <div className="rt"><span className="st">{msxR3Stars(c.star)}</span><span className="g">💰 {msxFmt(c.prize)}</span><span className="kd">{c.scenario ? 'シナリオ' : (SUC.CUP_SYS[c.sys] || {}).stat ? '自慢' : (SUC.CUP_SYS[c.sys] || {}).dist !== undefined ? '間合い' : (SUC.CUP_SYS[c.sys] || {}).type ? 'タイプ' : ['spring', 'summer', 'autumn', 'winter'].includes(c.sys) ? '四季' : 'ふつう'}</span></div>
            {c.rival ? <><span className="rvi"><img src={msxMonThumb(c.rival.species)} alt=""/><b>ライバル</b></span><span className="rvb">ごほうび大</span></> : null}
          </button>);
      }) : <div className="msx-note">今月の大会はありません</div>}
    </div>
    <div className="v-card" style={{ padding: '6px 9px' }}><div className="v-kv" style={{ margin: 0 }}><b>出ると</b><span>1戦だけ・1ターン使う・勝つと賞金(名声)と修行チケット。{toForced ? <span className="yel">{` 期末の大会まで あと${toForced}ターン`}</span> : null}</span></div></div>
  </>);
  const foot = (
    <div className="v-ft">
      <button type="button" onClick={onBack}>← もどる</button>
      <button type="button" className={cur && cur.done && cur.entry.ok ? 'on' : 'off'} disabled={!(cur && cur.done && cur.entry.ok)} onClick={() => go(true)} data-msx-r3-skip>⏩ スキップ</button>
      <button type="button" className="go" disabled={!(cur && cur.entry && cur.entry.ok)} onClick={() => go(false)} data-msx-r3-enter>{cur ? `${MSX_R3_CUP_ICON[cur.sys] || '🏆'} 出る ▶` : '大会をえらぶ'}</button>
    </div>
  );
  return <MsxR3Frame run={run} onBack={onBack} body={body} foot={foot}/>;
}

// ---- 観戦(助手マスモン対戦の観戦の部品を使い回す) ----
function MsxR3Watch({ fight, onDone }) {
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState('hl');
  const log = fight.r.log; const len = log.length;
  useEffect(() => {
    if (pos >= len - 1) { const t = setTimeout(() => onDone(), 900); return () => clearTimeout(t); }
    const sp = AMBW_SPEEDS.find((x) => x.id === speed) || AMBW_SPEEDS[0];
    const msxR3Step = () => {
      let n = pos + 1;
      if (speed === 'hl') while (n < len - 1 && !ambwIsHighlight(log[n], fight.maxHp)) n++;
      setPos(n);
    };
    const t = setTimeout(msxR3Step, sp.ms);
    return () => clearTimeout(t);
  }, [pos, speed]);
  const e = log[pos] || {}; const f = fight.frames[pos] || fight.frames[0]; const foeSide = e.side === 'A' ? 'B' : 'A';
  const fighter = (side) => {
    const team = side === 'A' ? fight.teamA : fight.teamB; const m = team.members[f.act[side]] || team.members[0];
    return (
      <div key={`${side}-${pos}`} className={`ambw-f ${f.hp[side][f.act[side]] <= 0 ? 'down' : ''} ${e.side === side && e.ev === 'tech' ? `ambw-lunge${side}` : ''} ${e.ev === 'tech' && foeSide === side && e.hit ? 'ambw-hit' : ''}`}>
        <img className={side === 'A' ? 'ambw-flip' : ''} src={msxMonImg(m.species)} alt=""/><em>{m.name}</em>
        {e.ev === 'tech' && foeSide === side && (e.hit ? <div className="ambw-dmg">−{e.dmg}</div> : <div className="ambw-dmg miss">はずれ</div>)}
      </div>);
  };
  return (
    <div className="r3-watch" data-msx-r3-watch>
      <style>{AMBW_CSS}</style>
      <AmbwPanel side="B" team={fight.teamB} frame={f} maxHp={fight.maxHp} moves={fight.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false}/>
      <div className="ambw-ring">
        <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: [6, 44, 92, 146][f.d] || 44 }}/>{fighter('B')}</div>
        <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
        {e.ev === 'tech' && <div key={`c-${pos}`} className={`ambw-cut ${e.kind} ${e.side === 'B' ? 'B' : ''}`}><small>{e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}</small><b>{e.name}</b></div>}
      </div>
      <AmbwPanel side="A" team={fight.teamA} frame={f} maxHp={fight.maxHp} moves={fight.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine/>
      <div className="ambw-ctl">
        {AMBW_SPEEDS.filter((x) => x.id === 'hl' || x.id === 'x2').map((x) => <button type="button" key={x.id} className={speed === x.id ? 'ambw-btn' : 'ambw-btn2'} onClick={() => setSpeed(x.id)}>{x.label}</button>)}
        <button type="button" className="ambw-btn2" data-msx-r3-towatch-end onClick={() => onDone()}>⏭ 結果へ</button>
      </div>
    </div>
  );
}

// ---- 試合のまわり ----
const msxR3Diff = (a, b) => {
  const d = { fame: b.fame - a.fame, pts: b.pts - a.pts, tickets: b.tickets - a.tickets, pop: b.pop - a.pop, stats: {}, titles: (b.titles || []).filter((t) => !(a.titles || []).includes(t)), sand: ((b.items || {}).sand || 0) - ((a.items || {}).sand || 0) };
  MSX_STATS.forEach((k) => { const g = b.stats[k] - a.stats[k]; if (g) d.stats[k] = g; });
  return d;
};
function MsxR3Battle({ run, setRun, v, ev, onPause }) {
  const { SUC } = msxSuc;
  const s = run.s; const b = s.battle; const st3 = run.out && run.out.r3 ? run.out.r3 : null; // 勝ち負けを付けたあとの段
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [failed, setFailed] = useState(false);
  const [tables, setTables] = useState(false);
  const [step, setStep] = useState(() => (run.r3skip ? 'auto' : 'bracket'));
  const [tab, setTab] = useState('st');
  const [mealPick, setMealPick] = useState(null);
  useMsxR3Lines(s.aid);
  useEffect(() => {
    let alive = true;
    // 試合型のアシストの表を読み終えてから試合を作る(読む前と後で同じ試合の結果が変わらないように)
    Promise.all([engine ? Promise.resolve(engine) : msxR3LoadEngine(), msxR3LoadTables()]).then(([e]) => { if (!alive) return; setTables(true); if (e) setEngine(e); else setFailed(true); });
    return () => { alive = false; };
  }, []);
  const fight = useMemo(() => (engine && tables && b ? msxR3Fight(engine, SUC, run) : null), [engine, tables, b && b.kind, b && b.again, b && b.reroll, b && b.round, b && b.retry, s.turn]);
  const name = b ? msxR3BattleName(SUC, b) : st3 ? st3.name : '';
  // 勝ち負けを付ける(負けのときは、やり直さないと決めたあと)
  const settle = (won) => {
    const before = s; const r = SUC.settle(s, won);
    const d = msxR3Diff(before, r.state);
    const out = { r3: { stage: won ? 'prize' : 'meal', won, name, icon: msxR3BattleIcon(b), d, foe: fight ? fight.opp : null, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: before.turn, gameover: !!r.out.gameover } };
    setRun({ ...run, s: r.state, phase: 'battle', out, r3skip: undefined, log: [...(run.log || []), { turn: before.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20) });
    setStep('bracket');
  };
  // 次へ(ごはんのあと): 続けて強制大会 → もう一度 / 終わり → 引退 / ふつう → ターンが進む
  const finish = (s2) => {
    const fromTurn = st3 ? st3.from : s.turn;
    if (s2.battle) setRun({ ...run, s: s2, phase: 'battle', out: null });
    else if (s2.over) setRun({ ...run, s: s2, phase: 'over', out: null });
    else setRun({ ...run, s: s2, phase: 'turn', out: { from: fromTurn } });
  };
  const result = () => { if (!fight) return; if (fight.won) settle(true); else setStep('lost'); };
  useEffect(() => { if (step === 'auto' && fight) result(); }, [step, fight]);

  // ---- 勝ち負けを付けたあと: 賞品(B2)→ ごはん(C3) ----
  if (st3) { // 期末の月に大会へ出て勝つと、続けて強制大会が立つ(s.battle がある)。賞品とごはんを先に見せてから次の1戦へ
    const d = st3.d || {};
    if (st3.stage === 'prize') {
      const rows = [];
      d.titles && d.titles.forEach((t) => rows.push(['🏅', '称号', `「${t}」を手に入れた!`, 'new', 'NEW']));
      if (d.pts) rows.push(['🔷', '能力ポイント', `+${d.pts}(いま ${s.pts})`, '', '']);
      if (d.tickets) rows.push(['🎫', '修行チケット', `+${d.tickets}(${s.tickets - d.tickets}枚 → ${s.tickets}枚)`, '', '']);
      if (d.fame) rows.push(['💰', '賞金', `+${msxFmt(d.fame)}(名声 ${msxFmt(s.fame - d.fame)} → ${msxFmt(s.fame)})`, '', '']);
      if (d.pop) rows.push(['⭐', '人気', `+${d.pop}(${s.pop - d.pop} → ${s.pop})`, '', '']);
      if (d.sand) rows.push(['⏳', '時渡りの砂時計', `+${d.sand}`, '', '']);
      Object.entries(d.stats || {}).forEach(([k, g]) => rows.push([MSX_STAT_ICON[k], MSX_STAT_NAME[k], `+${g}`, '', '']));
      const body = (<>
        <MsxBand s={s} v={v} ev={ev}/>
        <div className="v-scene" style={{ flex: '1 1 0', minHeight: 150 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
          <div className="gr" style={{ bottom: 'calc(30% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '30%', height: '40%' }}/>
          <div className="v-stamp msx-pop" style={{ top: '4%', fontSize: 42 }}>優勝!<small>{st3.icon} {st3.name}{st3.foe && st3.foe.name ? `・1戦: ${st3.foe.name} に勝った` : ''}</small></div>
          {st3.rival ? <div className="v-rvw"><img src={st3.foe ? msxMonThumb(st3.foe.species) : ''} alt=""/>ライバルの {st3.rivalName} に 勝った!<b>ごほうび大</b></div> : null}
          <div className="v-trophy">🏆</div></div>
        <div className="v-prz">{rows.length ? rows.map(([e, n, t, c, nw], i) => <div key={i} className={c}><span className="e">{e}</span><b>{n}</b><span className="t">{t}</span>{nw ? <i>{nw}</i> : null}</div>) : <div><span className="e">🏆</span><b>優勝</b><span className="t">よくがんばった!</span></div>}</div>
        {(() => { const l = msxR3Line('turn.cup.win', run, { cup: st3.name, rival: st3.rivalName || '' }, st3.rival ? '「ライバルに勝ったから、ごほうびがいつもの倍! つぎは ごはんだよ!」' : '「やったね! つぎは ごはんだよ!」'); return <MsxSay aid={s.aid} ex={l.e || 'excited'} text={l.t}/>; })()}
      </>);
      const next = () => (s.mealReady && !s.over ? setRun({ ...run, out: { r3: { ...st3, stage: 'meal' } } }) : finish(s));
      return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={next} data-msx-r3-next>{s.mealReady && !s.over ? '🍽 ごはんへ ▶' : 'つぎへ ▶'}</button></div>}/>;
    }
    // ごはん(C3): 大会のあとに1回。あげなくてもよい
    const M = SUC.MEALS || {};
    const free = s.freeMeal === true;
    const keys = Object.keys(M);
    const can = (k) => s.mealReady && !s.over && (free || s.fame >= M[k].cost);
    const fx = (k) => { const m = M[k]; return m.hp ? `体力 +${Math.round(m.hp * 100)}%` : m.ama || m.fear ? `忠誠 +${(m.ama || 0) + (m.fear || 0)}` : m.all ? '全能力 少し +' : ''; };
    const give = () => { if (!mealPick || !can(mealPick)) return; const r = SUC.meal(s, mealPick); if (r.out.ok) finish(r.state); };
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className={`v-scene ${st3.won ? '' : 'dk'}`} style={{ flex: '1 1 0', minHeight: 260 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>{st3.won ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(40% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '40%', height: '34%', ...(st3.won ? {} : { filter: 'grayscale(.5) drop-shadow(0 8px 5px #0009)' }) }}/>
        <div className={`v-stamp ${st3.won ? '' : 'ng'}`} style={{ top: '4%', fontSize: st3.won ? 42 : 34 }}>{st3.won ? '優勝!' : '負けた…'}<small>{st3.icon} {st3.name}{d.fame ? `・賞金 💰${msxFmt(d.fame)}` : ''}</small></div>
        {s.mealReady && !s.over ? (
          <div className="v-meal"><div className="t">🍽 がんばったごほうびに、ごはんをあげよう<small>大会のあとだけあげられる(1回){free ? '・今回はただ' : ''}</small></div>
            <div className="ms">{keys.map((k) => (
              <button type="button" key={k} className={`v-ml ${mealPick === k ? 'sel' : ''}`} disabled={!can(k)} onClick={() => setMealPick(k)} style={{ opacity: can(k) ? 1 : 0.45 }} data-msx-r3-meal={k}>
                <div className="e">{k === 'hp' ? '🍙' : k === 'loyal' ? '🍛' : '🍖'}</div><b>{M[k].name}</b><span className="g">{free ? 'ただ' : `💰 ${M[k].cost}`}</span><small>{fx(k)}</small></button>))}</div>
            <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, st3.won ? 'excited' : 'troubled')} alt=""/><div className="bub f1">{st3.won ? '「優勝だもん、今日は ごちそう にしちゃお!」' : '「おつかれさま。おいしいもの食べて、また がんばろ!」'}</div></div></div>
        ) : null}
      </div>
    </>);
    const foot = <div className="v-ft"><button type="button" onClick={() => finish(s)} data-msx-r3-nomeal>あげない</button><button type="button" className="go" disabled={!mealPick || !can(mealPick)} onClick={give} data-msx-r3-give>{mealPick ? `${M[mealPick].name}をあげる(${free ? 'ただ' : `💰${M[mealPick].cost}`})` : 'ごはんをえらぶ'}</button></div>;
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
  }
  if (!b) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">大会の中身を読めませんでした</div>} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)}>つぎへ ▶</button></div>}/>;

  // ---- 読み込み ----
  if (failed) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">試合を読み込めませんでした。電波のよい所で、もう一度開いてください</div>} foot={<div className="v-ft"><button type="button" onClick={onPause}>← 中断</button></div>}/>;
  if (!fight) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note" data-msx-r3-loading>大会の準備をしています…</div>} foot={null}/>;
  const opp = fight.opp;
  const skip = typeof SUC.canSkip === 'function' && SUC.canSkip(s);
  const foeName = opp.name || msxMonName(opp.species);

  // ---- 負けた(C4): やり直す/あきらめる ----
  if (step === 'lost') {
    const left = (SUC.REMATCH ? SUC.REMATCH.max : 3) - (s.rematchUsed || 0);
    const has = (k) => (s.items && s.items[k]) || 0;
    const re = (item) => { const r = SUC.rematch(s, item); if (!r.out.ok) return; setRun({ ...run, s: r.state, log: [...(run.log || []), { turn: s.turn, t: `${item === 'rainbow' ? '虹の時渡りの砂時計' : '時渡りの砂時計'}でやり直した` }].slice(-20) }); setStep('card'); };
    const debutLeft = b.kind === 'debut' ? Math.max(0, 3 - (s.debutLoss || 0) - 1) : null;
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene dk" style={{ flex: '1 1 0', minHeight: 300 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
        <div className="gr" style={{ bottom: 'calc(44% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '44%', height: '30%', filter: 'grayscale(.5) drop-shadow(0 8px 5px #0009)', transform: 'translateX(-50%) rotate(-8deg)' }}/>
        <div className="v-stamp ng" style={{ top: '5%' }}>負けた…<small>{msxR3BattleIcon(b)} {name} {foeName} に負けた</small></div>
        <div className="v-meal" style={{ borderColor: '#7dd3fc', boxShadow: '0 0 18px #38bdf866' }}>
          <div className="t">時をもどして、やり直す?<small>やり直せるのは 1回の育成で3回まで・<b style={{ color: '#fde047' }}>のこり {left} / 3</b></small></div>
          <div className="v-rm3">
            <button type="button" className="re" disabled={!SUC.canRematch(s, 'sand')} style={{ opacity: SUC.canRematch(s, 'sand') ? 1 : 0.45 }} onClick={() => re('sand')} data-msx-r3-sand>
              <img src="images/success/items/hourglass.png" alt="" style={{ width: 30, height: 30 }}/><div>時渡りの砂時計で やり直す<small>同じ相手ともう一度(持っている ×{has('sand')})</small></div></button>
            <button type="button" className="nj" disabled={!SUC.canRematch(s, 'rainbow')} style={{ opacity: SUC.canRematch(s, 'rainbow') ? 1 : 0.45 }} onClick={() => re('rainbow')} data-msx-r3-rainbow>
              <img src="images/success/items/hourglass-rainbow.png" alt="" style={{ width: 30, height: 30 }}/><div>虹の砂時計で 相手を変えて やり直す<small>ちがう相手と戦える(持っている ×{has('rainbow')})</small></div></button>
            <button type="button" className="gv" onClick={() => settle(false)} data-msx-r3-giveup>あきらめる<small>{b.kind === 'debut' ? `デビュー戦の負け ${(s.debutLoss || 0) + 1} / 3${debutLeft === 0 ? '(育成はここまで)' : ''}` : b.kind === 'summit' ? '頂への道はここまで(引退へ)' : '準優勝のごほうびをもらう'}</small></button>
          </div>
          <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, 'troubled')} alt=""/><div className="bub f1">{msxR3Line('turn.cup.lose', run, { cup: name, rival: b.rival ? b.rival.name : '' }, '「おしかった! もう1回いく?」').t}</div></div>
        </div>
      </div>
    </>);
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="on" style={{ flex: 2 }}>えらんでね</button></div>}/>;
  }

  // ---- 観戦 ----
  if (step === 'watch') {
    const body = (<>
      <div className="v-ev-h" style={{ position: 'relative', marginTop: 6 }}><small>{name}</small>⚔ {run.nick} VS {foeName}</div>
      <MsxR3Watch fight={fight} onDone={result}/>
    </>);
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={null}/>;
  }

  // ---- バトルカード(C2): 能力の比べ ----
  if (step === 'card') {
    const loyA = SUC.loyalOf(s);
    const rowsSt = MSX_STATS.map((k) => [`${MSX_STAT_ICON[k]} ${MSX_STAT_NAME[k]}`, s.stats[k], opp.stats[k]]);
    const better = MSX_STATS.filter((k) => s.stats[k] >= opp.stats[k]).map((k) => MSX_STAT_NAME[k]);
    const distA = (msxMon(s.species) || {}).distAptitude || []; const distB = (msxMon(opp.species) || {}).distAptitude || [];
    const lvA = (g) => ({ S: 3, A: 3, B: 2, C: 1 }[g] || 0);
    const techA = (Array.isArray(s.techs) ? s.techs : []).map((id) => { const t = (SUC.techsOf(s.species) || []).find((x) => x.id === id); return t ? t.name : null; }).filter(Boolean);
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-bcs"><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
        <div className="ttl">{name} ・ 1戦</div>
        <img className="ml" src={msxMonImg(s.species)} alt=""/><img className="mr" src={msxMonImg(opp.species)} alt=""/><div className="vsw">VS</div>
        <div className="nb l"><b>{run.nick}</b><small><i className={msxRankCls(ev.rank)}>{ev.rank}</i> {msxFmt(ev.power)}</small></div>
        <div className="nb r"><b>{foeName}</b><small>{opp.champ ? '👑王者' : opp.rival ? 'ライバル' : msxMonName(opp.species)}</small></div></div>
      <div className="v-tabs t3">{[['st', 'ステータス'], ['tech', '技'], ['etc', '能力']].map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} style={{ textAlign: 'center', background: tab === k ? '#3b2f0b' : '#1e1a36', border: `1.5px solid ${tab === k ? '#fde047' : '#475569'}`, borderRadius: 99, padding: 4, fontSize: 12, fontWeight: 900, color: tab === k ? '#fde047' : '#cbd5e1' }}>{n}</button>)}</div>
      <div className="v-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {tab === 'st' ? <>
          {rowsSt.map(([n, a, c]) => <div key={n} className="v-vs1"><b className={a >= c ? 'w' : ''}>{a}</b><i className="l"><u style={{ width: `${a / 10}%` }}/></i><span>{n}</span><i className="r"><u style={{ width: `${c / 10}%` }}/></i><b className={c > a ? 'w' : ''}>{c}</b></div>)}
          <div className="v-vs1"><b>{s.pop}</b><i className="l p"><u style={{ width: `${s.pop}%` }}/></i><span>⭐ 人気</span><i className="r p"><u style={{ width: 0 }}/></i><b>—</b></div>
          <div className="v-vs1"><b>{loyA}</b><i className="l p"><u style={{ width: `${loyA}%` }}/></i><span>🤝 忠誠</span><i className="r p"><u style={{ width: 0 }}/></i><b>—</b></div>
          <div className="v-dist"><div>{['零', '近', '中', '遠'].map((dn, i) => <i key={dn} className={`a${lvA(distA[i])}`}>{dn}</i>)}</div><span>間合いの適性</span><div>{['零', '近', '中', '遠'].map((dn, i) => <i key={dn} className={`a${lvA(distB[i])}`}>{dn}</i>)}</div></div>
        </> : tab === 'tech' ? <>
          <div className="v-kv"><b>{run.nick}</b><span>{techA.length ? techA.join('・') : 'はじめから使える技'}</span></div>
          <div className="v-kv"><b>{foeName}</b><span>技 {opp.techs}つ・熟練 {opp.mastery}</span></div>
        </> : <>
          <div className="v-kv"><b>総合力</b><span>{msxFmt(ev.power)}(ランク {ev.rank})</span></div>
          <div className="v-kv"><b>相手の能力の合計</b><span>{msxFmt(opp.sum)}・あなた {msxFmt(MSX_STATS.reduce((a, k) => a + s.stats[k], 0))}</span></div>
          {opp.note ? <div className="v-kv"><b>うわさ</b><span>{opp.note}</span></div> : null}
        </>}
      </div>
      <div className="v-hint"><img src={msxFace(s.aid, 'excited')} alt=""/>{better.length ? <span>{better.slice(0, 2).join('と')}は勝ってる! <em>落ち着いて</em>いこう!</span> : <span>相手は強いよ… <em>ねばって</em>いこう!</span>}</div>
    </>);
    const foot = <div className="v-ft"><button type="button" className="on" style={{ flex: 1.2 }} onClick={result} data-msx-r3-result>結果だけ見る</button><button type="button" className="go" style={{ flex: 1.2 }} onClick={() => setStep('watch')} data-msx-r3-ready>準備完了</button></div>;
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
  }

  // ---- 組み合わせ表(B1)。演出。戦うのは あなたの1戦だけ ----
  const br = SUC.bracketOf(s) || { entrants: [] };
  const pops = br.entrants.map((x, i) => (x.champ ? 1 : i === 4 ? 2 : x.you ? 3 : 0));
  let nx = 4; const no = pops.map((p) => (p || nx++));
  const lines = [0, 1, 2, 3].map((q) => { const y1 = 17 + 68 * q; const y2 = y1 + 34; return `M0 ${y1}H14V${y2}H0M14 ${(y1 + y2) / 2}H30`; }).join('') + 'M30 34V102H46M30 170V238H46M46 68V204M46 136H64';
  const champ = br.entrants.find((x) => x && x.champ);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-bk1"><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="tt">{name}{b.retry ? `(再挑戦 ${b.retry}回目)` : ''}</div></div>
    <div className="v-bkc">
      <div className="rows">{br.entrants.map((x, i) => {
        const k = x.you ? 'me' : x.rival ? 'rv' : x.champ ? 'ch' : '';
        return (<div key={i} className={`v-br ${k}${i === 0 || i === 4 ? ' mine' : ''}`}><b className="no">{no[i]}</b>
          <span className="nm">{x.you ? run.nick : (x.name || msxMonName(x.species))}{x.champ ? <em className="mk ch">👑王者</em> : null}{x.rival ? <em className="mk rv">ライバル</em> : null}{x.you ? <em className="mk me">あなた</em> : null}</span>
          <i className="cn"/><span className="fc2"><img src={msxMonThumb(x.species)} alt=""/></span></div>);
      })}</div>
      <div className="rt"><svg className="v-brl" viewBox="0 0 64 272" preserveAspectRatio="none"><g fill="none" stroke="#a89a78" strokeWidth="2"><path d={lines}/></g></svg><div className="win"><span>🏆</span><b>優勝</b></div></div>
    </div>
    <div className="v-bnt"><b>あなたの1戦</b>は 赤い丸の2体のあいだ({run.nick} VS {foeName})。<span>ほかの試合の結果は、見せるだけの演出</span></div>
    <div style={{ flex: 1 }}/>
    <div className="v-ann"><div className="pic"><img src={msxFace(s.aid, 'excited')} alt=""/><span>解説</span></div>
      <div className="tx">{(() => { const l = msxR3Line('turn.cup.before', run, { cup: name, rival: opp.rival ? foeName : '' }, ''); return l.t ? l.t : null; })() || (champ && !opp.champ ? <>「<b>1番人気は 王者の {champ.name || msxMonName(champ.species)}!</b> でも、{run.nick}の相手は {opp.rival ? 'ライバルの ' : ''}{foeName} だよ。」</> : opp.champ ? <>「相手は <b>王者の {foeName}</b>! {opp.note || '強敵だよ'}。胸を借りるつもりでいこう!」</> : <>「相手は <b>{foeName}</b>。{opp.note || 'しっかり見ていこう'}!」</>)}</div></div>
  </>);
  const foot = (
    <div className="v-ft">
      {skip ? <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bskip>⏩ スキップ(結果だけ)</button> : <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bresult>⏩ 結果だけ見る</button>}
      <button type="button" className="go" onClick={() => setStep('card')} data-msx-r3-tocard>⚔ 1戦へ</button>
    </div>
  );
  return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
}
