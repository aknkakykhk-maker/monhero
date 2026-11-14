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
      <MsxHd back={back} onBack={onBack} sub={`${msxAidName(s.aid)}編`} right={right != null ? right : `💰 賞金 ${msxFmt(s.fame)}G`}/>
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
  if (e.why === 'fame') return `これまでの賞金の合計が ${msxFmt(e.need)}G 以上で出られる(いま ${msxFmt(s.fameTotal)}G)`;
  if (e.why === 'rank') return `賞金の段が ${e.needName} 以上で出られる(${msxFmt(e.needG)}G・いま ${msxFmt(s.fameTotal)}G)`;
  if (e.why === 'won') return `${e.wonName} 優勝で出られる`;
  return '出られない';
};
// 勝ったときにもらうアイテム(芯の cupItemsOf。得意の能力・間合いはいまの育成から決まる)
const msxR3CupItems = (SUC, c, s) => { try { const o = s && typeof SUC.cupItemsOf === 'function' ? SUC.cupItemsOf(s, c.sys, c.star) : {}; return Object.entries(o || {}).map(([k, n]) => `${(SUC.ITEMS[k] || {}).name || k} ×${n}`); } catch (e) { return []; } };
const msxR3CupReward = (SUC, c, s) => {
  const ex = SUC.EX_BY_SYS ? SUC.EX_BY_SYS[c.sys] : null;
  if (ex) { // 大会の第2版: その大会が持つごほうび
    const rw = ex.rw || {}; const o = [];
    if (rw.all) o.push(`全能力 +${rw.all}`);
    if (rw.stat) Object.entries(rw.stat).forEach(([k, v]) => o.push(`${MSX_STAT_NAME[k]} +${v}`));
    if (rw.hpMax) o.push(`体力の最大値 +${rw.hpMax}`);
    if (rw.loy) o.push(`忠誠度 +${rw.loy}`);
    if (rw.pts) o.push(`能力ポイント +${rw.pts}`);
    if (rw.pop) o.push(`人気 +${rw.pop}`);
    o.push(...msxR3CupItems(SUC, c, s));
    if (Number.isInteger(rw.apt)) o.push('その間合いの適性が1段上がる');
    if (ex.four) o.push('四大大会');
    return o.length ? o.join('・') : '賞金と修行チケット';
  }
  const R = SUC.CUP_SYS ? (SUC.CUP_SYS[c.sys] || {}) : {};
  const out = [];
  const pts = { 3: 10, 4: 20 }[c.star]; const pop = { 2: 2, 3: 4, 4: 8 }[c.star]; const up = ((SUC.CUP_REWARD || {}).statUp || { 1: 4, 2: 8, 3: 12 })[c.star];
  if (pts) out.push(`能力ポイント +${pts}`);
  if (pop) out.push(`人気 +${pop}`);
  if (R.stat && up) out.push(`${MSX_STAT_NAME[R.stat]} +${up}`);
  if (c.star >= 4) out.push('全能力 +4');
  out.push(...msxR3CupItems(SUC, c, s));
  if (c.scenario) out.push(c.sys === 'scerubin' ? `忠誠度 +5・次のごはんの効き目 ×${(SUC.MEAL_WATCH_MULT || 1.5)}` : 'シナリオのごほうび'); // えるびんの見守りの大会(2026-11-14 社長)
  return out.length ? out.join('・') : '賞金と修行チケット';
};
// 大会の賞品を絵つきの升目にする(確認の窓)。賞金は先頭
const msxR3Prizes = (SUC, c) => {
  const out = [{ id: 'g', e: '💰', name: `賞金 ${msxFmt(c.prize)}G`, desc: '勝つともらえる賞金。ごはんや買い物に使える(負けても ★★ 以上は一部もらえる)' }];
  const ex = SUC.EX_BY_SYS ? SUC.EX_BY_SYS[c.sys] : null;
  if (ex && ex.rw && ex.rw.bag) Object.entries(ex.rw.bag).forEach(([k, n]) => { const it = typeof msxItemView === 'function' ? msxItemView(k) : { name: k, e: '🎁', desc: '' }; out.push({ id: k, e: it.e, name: `${it.name} ×${n}`, desc: it.desc, rare: true }); });
  const wtk = (ex && ex.four) || c.star >= 3 ? 1 : 0; const rtk = c.rival ? 1 : 0; // 芯の settle と同じ(★★★以上・四大大会 +1/ライバル +1)
  out.push({ id: 'tk', e: '🎫', name: '修行チケット', desc: `${wtk + rtk ? `勝つと修行チケット +${wtk + rtk}${rtk ? '(ライバルの分 +1)' : ''}。` : ''}賞金ランクが上がると1段ごとに +1(負けても獲得賞金の合計で上がる)` });
  const rw = msxR3CupReward(SUC, c); if (rw && rw !== '賞金と修行チケット') out.push({ id: 'rw', e: ex && ex.four ? '🏆' : '✨', name: 'ごほうび', desc: rw, rare: !!(ex && (ex.four || ex.hard)) });
  return out;
};
const MSX_R3_FC_CLASS = Object.freeze({ easy: 'fc-e', good: 'fc-g', even: 'fc-v', hard: 'fc-h', none: 'fc-n' });
function MsxR3Cup({ run, setRun, v, ev, onBack, onActed }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const P = SUC.periodOf(s.turn);
  // 月の切り替え: いまの月と、同じ期のこの先の月(見るだけ。出られるのはいまの月)
  const lastTurn = Math.min(SUC.TOTAL_TURNS || 46, s.turn + (P.key === 'final' ? 0 : Math.max(0, P.left - 1)));
  const [vt, setVt] = useState(s.turn);
  const now = vt === s.turn;
  const cupsNow = Array.isArray(v.cups) ? v.cups : [];
  const cups = now ? cupsNow : (typeof SUC.cupsOf === 'function' ? SUC.cupsOf({ ...s, turn: vt }) : []);
  const [pick, setPick] = useState(() => { const c = cupsNow.find((x) => x.entry && x.entry.ok); return c ? c.id : null; });
  const [win, setWin] = useState(null); // 確認の窓の大会 id
  const [prz, setPrz] = useState(null); // 賞品の詳細
  const cur = cupsNow.find((c) => c.id === pick) || null;
  const go = (skip) => {
    if (!cur || !cur.entry || !cur.entry.ok) return;
    const r = SUC.act(s, { kind: 'cup', id: cur.id });
    if (!r.out.ok) return;
    const next = { ...run, s: r.state, out: null, r3skip: skip ? true : undefined, log: [...(run.log || []), { turn: s.turn, t: `${msxR3CupName(cur.sys)}に出た` }].slice(-20) };
    onActed(next);
  };
  const toForced = P.key === 'final' ? null : P.left;
  const cal = msxCalendar(s.turn); const calV = msxCalendar(vt);
  useMsxR3Lines(s.aid);
  // 受付(月の大会を選ぶ)のあいだは育成中の曲のまま(2026-11-14 社長)。大会の曲 cupPre は組み合わせ表に入ってから(MsxR3Battle)
  useEffect(() => { if (typeof SuccessSound !== 'undefined') SuccessSound.se('cupEntry'); }, []);
  const nOk = cupsNow.filter((c) => c.entry && c.entry.ok).length;
  const openLine = msxR3Line('turn.cup.open', run, { cup: cur ? msxR3CupName(cur.sys) : '' }, nOk ? `「今月は ${nOk}つ 出られるよ! 出ると1ターン使うから、トレーニングとどっちにするか考えてね」` : '「今月は出られる大会がないみたい。トレーニングでじっくり力をつけよ!」');
  const rankStep = typeof SUC.rankStepOf === 'function' ? SUC.rankStepOf(s) : 0; const rank = rankStep ? { name: SUC.rankNameOf(rankStep) } : null; // 賞金ランク10段(2026-11-14)
  const kindOf = (c) => (c.scenario ? 'シナリオ' : c.ex ? (MSX_R3_CUP_GRADE[c.grade] || '') : (SUC.CUP_SYS[c.sys] || {}).stat ? '自慢' : (SUC.CUP_SYS[c.sys] || {}).dist !== undefined ? '間合い' : (SUC.CUP_SYS[c.sys] || {}).type ? 'タイプ' : ['spring', 'summer', 'autumn', 'winter'].includes(c.sys) ? '四季' : 'ふつう');
  const wc = win ? cups.find((c) => c.id === win) : null;
  const wcOk = !!(wc && now && wc.entry && wc.entry.ok);
  const body = (<>
    <MsxBand s={s} v={v} ev={ev} use={20}/>
    <div className="v-scene low" style={{ flex: '0 0 auto', minHeight: 128 }}><img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/><div className="sh"/>
      <img src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', left: '-2%', bottom: '-98%', height: '190%' }}/>
      <div className="v-ev-h"><small>{cal.year}年目 {cal.month}月・{v.period.name}</small>🏆 大会の受付</div>
      <div className="v-ibub" style={{ left: '38%', top: 'auto', bottom: 8 }}>{openLine.t}</div>
    </div>
    <div className="v-cupbar" data-msx-r3-fame><span>いまの賞金</span><b>{msxFmt(s.fame)}<small>G</small></b>{rank ? <i>賞金の段 {rank.name}</i> : null}</div>
    <div className="v-cupmon">
      <button type="button" className="ar" disabled={vt <= s.turn} onClick={() => setVt((t) => Math.max(s.turn, t - 1))} aria-label="前の月">◀</button>
      <b>{calV.year}年目 {calV.month}月{now ? <small className="now">今月</small> : <small>予定</small>}</b>
      <button type="button" className="ar" disabled={vt >= lastTurn} onClick={() => setVt((t) => Math.min(lastTurn, t + 1))} aria-label="次の月" data-msx-r3-next-month>▶</button>
    </div>
    <div className="v-cups">
      {cups.length ? cups.map((c) => {
        const ok = now && c.entry && c.entry.ok;
        const fc = typeof SUC.forecastOf === 'function' ? SUC.forecastOf(s, c) : null;
        const cls = `${!(c.entry && c.entry.ok) ? 'ng' : now && c.id === pick ? 'sel' : c.rival ? 'rv' : c.done ? 'won' : ''}${c.ex ? ` ex g-${c.grade || 'gold'}` : ''}${c.hard ? ' hard' : ''}${now ? '' : ' later'}`;
        return (
          <button type="button" key={c.id} className={`v-cup v-cup2 ${cls}`} onClick={() => { if (ok) setPick(c.id); setWin(c.id); }} data-msx-r3-cup={c.id}>
            <div className="lg"><span className="e">{c.scenario ? '📖' : (MSX_R3_CUP_ICON[c.sys] || '🏆')}</span>{fc ? <span className={`fcst ${MSX_R3_FC_CLASS[fc.key] || ''}`}>{fc.label}</span> : null}</div>
            <div className="tx">
              <div className="hd"><span className="gr2">{kindOf(c)}</span><span className="cs">{msxR3Stars(c.star)}</span>{c.done ? <span className="dn">優勝済</span> : null}</div>
              <b>{c.scenario ? c.name : msxR3CupName(c.sys)}</b>
              {!(c.entry && c.entry.ok) ? <span className="why">✖ {msxR3WhyText(c.entry, s)}</span> : null}
              <span className="g">{msxFmt(c.prize)}<small>G</small></span>
            </div>
            {c.rival ? <><span className="rvi"><img src={msxMonThumb(c.rival.species)} alt=""/><b>ライバル</b></span><span className="rvb">ごほうび大</span></> : null}
          </button>);
      }) : <div className="msx-note">{now ? '今月の大会はありません' : 'この月の大会はありません'}</div>}
    </div>
    <div className="v-card" style={{ padding: '5px 9px' }}><div className="v-kv" style={{ margin: 0 }}><b>出ると</b><span>1戦だけ・1ターン使う・勝つと賞金と賞品。{toForced ? <span className="yel">{` 期末の大会まで あと${toForced}ターン`}</span> : null}</span></div></div>
    {wc ? (
      <div className="v-cupwin" onClick={() => { setWin(null); setPrz(null); }} data-msx-r3-cupwin>
        <div className="in" onClick={(e) => e.stopPropagation()}>
          <div className="h">大会参加確認</div>
          <div className={`sign g-${wc.grade || 'n'}`}><span className="e">{wc.scenario ? '📖' : (MSX_R3_CUP_ICON[wc.sys] || '🏆')}</span><b>{wc.scenario ? wc.name : msxR3CupName(wc.sys)}</b><small>{kindOf(wc)} {msxR3Stars(wc.star)}</small></div>
          <div className="sub">獲得物</div>
          <div className="pz">{msxR3Prizes(SUC, wc).map((x) => <button type="button" key={x.id} className={x.rare ? 'rare' : ''} onClick={() => setPrz(x)} data-msx-r3-prize={x.id}><span>{x.e}</span><small>{x.name}</small></button>)}</div>
          {wcOk ? <div className="q">この大会に参加しますか?</div> : <div className="q ng">{now ? `この大会には出られません(${msxR3WhyText(wc.entry, s)})` : 'この大会は、その月になると出られます'}</div>}
          <div className="bt">{wcOk ? <><button type="button" onClick={() => setWin(null)}>キャンセル</button><button type="button" className="go" onClick={() => { setPick(wc.id); setWin(null); if (cur && cur.id === wc.id) go(false); else { const r = SUC.act(s, { kind: 'cup', id: wc.id }); if (r.out.ok) onActed({ ...run, s: r.state, out: null, log: [...(run.log || []), { turn: s.turn, t: `${msxR3CupName(wc.sys)}に出た` }].slice(-20) }); } }} data-msx-r3-yes>はい</button></> : <button type="button" onClick={() => setWin(null)} data-msx-r3-close>とじる</button>}</div>
          {prz ? <div className="det" onClick={() => setPrz(null)}><div className="dbox" onClick={(e) => e.stopPropagation()}><div className="e">{prz.e}</div><b>{prz.name}</b><p>{prz.desc}</p><button type="button" onClick={() => setPrz(null)}>とじる</button></div></div> : null}
        </div>
      </div>) : null}
  </>);
  const foot = (
    <div className="v-ft">
      <button type="button" onClick={onBack}>← もどる</button>
      <button type="button" className={cur && cur.done && cur.entry.ok ? 'on' : 'off'} disabled={!(cur && cur.done && cur.entry.ok)} onClick={() => go(true)} data-msx-r3-skip>⏩ スキップ</button>
      <button type="button" className="go" disabled={!(cur && cur.entry && cur.entry.ok)} onClick={() => { setVt(s.turn); setWin(cur.id); }} data-msx-r3-enter>{cur ? '出場 ▶' : '大会をえらぶ'}</button>
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
  const d = { apt: [0, 1, 2, 3].filter((i) => ((b.aptUp || [])[i] || 0) > ((a.aptUp || [])[i] || 0)), fame: b.fame - a.fame, pts: b.pts - a.pts, tickets: b.tickets - a.tickets, pop: b.pop - a.pop, stats: {}, titles: (b.titles || []).filter((t) => !(a.titles || []).includes(t)), sand: ((b.items || {}).sand || 0) - ((a.items || {}).sand || 0) };
  MSX_STATS.forEach((k) => { const g = b.stats[k] - a.stats[k]; if (g) d.stats[k] = g; });
  d.rankFrom = Number(a.fameRank) || 0; d.rankTo = Number(b.fameRank) || 0; // 賞金ランク(2026-11-14)
  d.items = {}; Object.keys(b.bag || {}).forEach((k) => { const g = (Number((b.bag || {})[k]) || 0) - (Number((a.bag || {})[k]) || 0); if (g > 0) d.items[k] = g; }); // 大会の獲得アイテム
  return d;
};
// 賞品の行(優勝の画面・バトル部の MonsucCupWin の rows にも渡す)
const msxR3RankName = (step) => { const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; return S && typeof S.rankNameOf === 'function' ? S.rankNameOf(step) : String(step); };
// 賞金ランクのピラミッド(参考の10段)。いまの段に印、上がったら UP!・上がらなければ KEEP
function MsxR3RankPyramid({ step, up }) {
  const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; const R = S && S.FAME_RANK ? S.FAME_RANK : []; if (!R.length) return null;
  const COL = ['#bae6fd', '#86efac', '#fb923c', '#7dd3fc', '#facc15', '#c084fc', '#f43f5e', '#14b8a6', '#e879f9', '#6d28d9'];
  const cond = (x) => (x.cond === 'debut' ? 'デビュー戦に出る' : x.cond === 'win' ? '大会で1勝' : `${msxFmt(x.min)}G`);
  return (<div data-msx-r3-rank style={{ margin: '4px 10px 0', padding: '5px 6px 6px', borderRadius: 10, background: '#0f172acc' }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: '#fde68a', textAlign: 'center', marginBottom: 3 }}>賞金ランク</div>
    {R.map((x, i) => i).reverse().map((i) => { const x = R[i]; const me = i + 1 === step; const w = 46 + (R.length - 1 - i) * 5.5;
      return (<div key={i} style={{ display: 'flex', alignItems: 'center', height: 15, gap: 4 }}>
        <span style={{ width: 40, fontSize: 9, fontWeight: 900, textAlign: 'right', color: up ? '#fef08a' : '#a7f3d0' }}>{me ? (up ? 'UP!▶' : 'KEEP▶') : ''}</span>
        <span style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}><span style={{ width: `${w}%`, background: COL[i], opacity: i + 1 <= step ? 1 : 0.35, borderRadius: 3, fontSize: 10, fontWeight: 800, color: '#111827', textAlign: 'center', lineHeight: '14px', outline: me ? '2px solid #fff' : 'none' }}>{x.name}</span></span>
        <span style={{ width: 74, fontSize: 9.5, textAlign: 'right', color: '#e5e7eb' }}>{cond(x)}</span></div>); })}
  </div>);
}
const msxR3PrizeRows = (d, s) => {
  const rows = [];
  if (d.rankTo > d.rankFrom) rows.push(['🏆', '賞金ランク', `${msxR3RankName(d.rankFrom || 0)} → ${msxR3RankName(d.rankTo)}`, 'new', 'UP']);
  else if (d.rankTo > 0) rows.push(['🏆', '賞金ランク', `${msxR3RankName(d.rankTo)}(KEEP)`, '', '']);
  (d.titles || []).forEach((t) => rows.push(['🏅', '称号', `「${typeof msxR3TitleName === 'function' ? msxR3TitleName(t) : t}」を手に入れた!`, 'new', 'NEW']));
  (d.apt || []).forEach((i) => rows.push(['📏', '間合い適性', `「${['零', '近', '中', '遠'][i]}」の間合い適性が1段上がった!`, 'new', 'UP']));
  if (d.pts) rows.push(['🔷', '能力ポイント', `+${d.pts}(いま ${s.pts})`, '', '']);
  if (d.tickets) rows.push(['🎫', '修行チケット', `+${d.tickets}(${s.tickets - d.tickets}枚 → ${s.tickets}枚)`, '', '']);
  if (d.fame) rows.push(['💰', '賞金', `+${msxFmt(d.fame)}G(所持 ${msxFmt(s.fame - d.fame)}G → ${msxFmt(s.fame)}G)`, '', '']);
  if (d.pop) rows.push(['⭐', '人気', `+${d.pop}(${s.pop - d.pop} → ${s.pop})`, '', '']);
  if (d.sand) rows.push(['⏳', '時渡りの砂時計', `+${d.sand}`, '', '']);
  Object.entries(d.stats || {}).forEach(([k, g]) => rows.push([MSX_STAT_ICON[k], MSX_STAT_NAME[k], `+${g}`, '', '']));
  Object.entries(d.items || {}).forEach(([k, n]) => { const S = msxSuc && msxSuc.SUC ? msxSuc.SUC : null; const it = S && S.ITEMS ? S.ITEMS[k] : null; rows.push([(typeof MSX_EXTRA_ITEM !== 'undefined' && MSX_EXTRA_ITEM[k] && MSX_EXTRA_ITEM[k].e) || '🎁', it ? it.name : k, `×${n}(この育成の中で使える)`, 'new', 'GET']); });
  return rows;
};
function MsxR3Battle({ run, setRun, v, ev, ctx, bondLv, onPause, debug }) {
  const { SUC } = msxSuc;
  const s = run.s; const b = s.battle; const st3 = run.out && run.out.r3 ? run.out.r3 : null; // 勝ち負けを付けたあとの段
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [failed, setFailed] = useState(false);
  const [tables, setTables] = useState(false);
  const showOn = typeof MonsucCupShow === 'function' && !debug; // バトル部の「見せる」部品があれば、組み合わせ表〜優勝/負けはそちら
  const [step, setStep] = useState(() => (run.r3skip && !showOn ? 'auto' : 'bracket'));
  const pendRef = useRef(null);
  const [tab, setTab] = useState('st');
  const [mealPick, setMealPick] = useState(null);
  useMsxR3Lines(s.aid);
  // 大会の曲(2026-11-14 社長の曲・ビート部の表): 組み合わせ表と札=cupPre / 試合=cupMatch / 決着=cupWin・cupLose
  //   バトル部の見せる部品(MonsucCupShow)は段を onPhase で知らせてくる。部品が無いときは、ここの step で決める
  const [showPh, setShowPh] = useState('bracket');
  const cupSound = st3 ? (st3.won ? 'cupWin' : 'cupLose')
    : showOn ? (showPh === 'win' ? 'cupWin' : showPh === 'lose' ? 'cupLose' : showPh === 'cutin' || showPh === 'match' ? 'cupMatch' : 'cupPre')
      : step === 'lost' ? 'cupLose' : step === 'bracket' || step === 'card' ? 'cupPre' : 'cupMatch';
  useSuccessScene(cupSound, { season: msxCalendar(s.turn).season });
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
    const before = s; const r = SUC.settle(s, won, fight && fight.use);
    const d = msxR3Diff(before, r.state);
    const out = { r3: { stage: won ? 'prize' : d.rankTo > d.rankFrom ? 'rank' : 'meal', won, name, icon: msxR3BattleIcon(b), d, foe: fight ? fight.opp : null, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: before.turn, gameover: !!r.out.gameover } };
    setRun({ ...run, s: r.state, phase: 'battle', out, r3skip: undefined, arcAfter: msxArcAfterOf(SUC, s, b, won, fight && fight.opp) || undefined, log: [...(run.log || []), { turn: before.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20) });
    setStep('bracket');
  };
  // 見せる部品の流れ: settle(won) で勝ち負けを付けて賞品の行を返し、「次へ」(onNext)で保存して次の段へ
  //   (先に保存すると s が替わって見せる部品が作り直されるので、onNext まで待つ)
  const commitSettle = ({ r, d, won, before }) => {
    const s2 = r.state; const log = [...(run.log || []), { turn: before.turn, t: `${name}: ${won ? '優勝' : '負け'}` }].slice(-20);
    const arcAfter = msxArcAfterOf(SUC, before, b, won, fight && fight.opp) || undefined; // 頂への道の試合のあとの掛け合い
    const rankUp = d && d.rankTo > d.rankFrom; // 賞金ランクが上がったら、ピラミッドの段を1枚はさむ(2026-11-14)
    if (rankUp || (s2.mealReady && !s2.over)) { setRun({ ...run, s: s2, phase: 'battle', r3skip: undefined, arcAfter, log, out: { r3: { stage: rankUp ? 'rank' : 'meal', meal: !!(s2.mealReady && !s2.over), won, name, icon: msxR3BattleIcon(b), d, foe: fight ? fight.opp : null, rival: !!(b && b.rival), rivalName: b && b.rival ? b.rival.name : null, from: before.turn, gameover: !!r.out.gameover } } }); return; }
    const base = { ...run, s: s2, r3skip: undefined, arcAfter, log, out: null };
    if (s2.battle) setRun({ ...base, phase: 'battle' }); else if (s2.over) setRun({ ...base, phase: 'over' }); else setRun({ ...base, phase: 'turn', out: { from: before.turn } });
  };
  const settleShow = (won, use) => { const before = s; const r = SUC.settle(s, won, use || (fight && fight.use)); /* use: 自分で操作した試合なら、その試合の技ごとの使った回数 */ const d = msxR3Diff(before, r.state); pendRef.current = { r, d, won, before }; return { rows: msxR3PrizeRows(d, r.state).map(([i, k, vv, c]) => ({ i, k, v: vv, big: c === 'new' })), prize: d.fame, tickets: d.tickets }; };
  const nextShow = () => { const p = pendRef.current; if (!p) return; pendRef.current = null; commitSettle(p); };
  const rematchWith = (item) => { const r = SUC.rematch(s, item); if (!r.out.ok) return; setRun({ ...run, s: r.state, log: [...(run.log || []), { turn: s.turn, t: `${item === 'rainbow' ? '虹の時渡りの砂時計' : '時渡りの砂時計'}でやり直した` }].slice(-20) }); setStep('card'); };
  // 次へ(ごはんのあと): 続けて強制大会 → もう一度 / 終わり → 引退 / ふつう → ターンが進む
  const finish = (s2) => {
    const fromTurn = st3 ? st3.from : s.turn;
    if (s2.battle) setRun({ ...run, s: s2, phase: 'battle', out: null });
    else if (s2.over) setRun({ ...run, s: s2, phase: 'over', out: null });
    else setRun({ ...run, s: s2, phase: 'turn', out: { from: fromTurn } });
  };
  const result = () => { if (!fight) return; if (fight.won) settle(true); else setStep('lost'); };
  useEffect(() => { if (step === 'auto' && fight && !showOn) result(); }, [step, fight]);
  const actx = ctx || { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick, species: s.species };
  // 頂への道: 試合のあとの掛け合い(56-monhero-success-arc.jsx)。賞品・ごはんの前に出す
  if (run.arcAfter) return <MsxArcAfter run={run} v={v} ev={ev} onPause={onPause} ctx={actx} bondLv={bondLv || 1} after={run.arcAfter} onDone={() => setRun({ ...run, arcAfter: undefined })}/>;

  // ---- 勝ち負けを付けたあと: 賞品(B2)→ ごはん(C3) ----
  if (st3) { // 期末の月に大会へ出て勝つと、続けて強制大会が立つ(s.battle がある)。賞品とごはんを先に見せてから次の1戦へ
    const d = st3.d || {};
    if (st3.stage === 'rank') { // 賞金ランク UP!(参考のピラミッド)
      const body = (<>
        <MsxBand s={s} v={v} ev={ev}/>
        <div className="v-scene" style={{ flex: '1 1 0', minHeight: 120 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
          <div className="v-stamp msx-pop" style={{ top: '8%', fontSize: 34 }}>ランク UP!<small>{msxR3RankName(d.rankFrom || 0)} → {msxR3RankName(d.rankTo)}・🎫 修行チケット +{(d.rankTo || 0) - (d.rankFrom || 0)}</small></div></div>
        <MsxR3RankPyramid step={d.rankTo || 0} up/>
      </>);
      const next = () => (st3.meal ? setRun({ ...run, out: { r3: { ...st3, stage: 'meal' } } }) : finish(s));
      return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={next} data-msx-r3-next>{st3.meal ? '🍽 ごはんへ ▶' : 'つぎへ ▶'}</button></div>}/>;
    }
    if (st3.stage === 'prize') {
      const rows = msxR3PrizeRows(d, s);
      const body = (<>
        <MsxBand s={s} v={v} ev={ev}/>
        <div className="v-scene" style={{ flex: '1 1 0', minHeight: 150 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/><div className="v-burst"/>
          <div className="gr" style={{ bottom: 'calc(30% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '30%', height: '40%' }}/>
          <div className="v-stamp msx-pop" style={{ top: '4%', fontSize: 42 }}>優勝!<small>{cardIconNode(st3.icon, 16)} {st3.name}{st3.foe && st3.foe.name ? `・1戦: ${st3.foe.name} に勝った` : ''}</small></div>
          {st3.rival ? <div className="v-rvw"><img src={st3.foe ? msxMonThumb(st3.foe.species) : ''} alt=""/>ライバルの {st3.rivalName} に 勝った!<b>ごほうび大</b></div> : null}
          <div className="v-trophy">🏆</div></div>
        <MsxR3RankPyramid step={d.rankTo || 0} up={d.rankTo > d.rankFrom}/>
        <div className="v-prz">{rows.length ? rows.map(([e, n, t, c, nw], i) => <div key={i} className={c}><span className="e">{e}</span><b>{n}</b><span className="t">{t}</span>{nw ? <i>{nw}</i> : null}</div>) : <div><span className="e">🏆</span><b>優勝</b><span className="t">よくがんばった!</span></div>}</div>
        {(() => { const l = msxR3Line('turn.cup.win', run, { cup: st3.name, rival: st3.rivalName || '' }, st3.rival ? '「ライバルに勝ったから、ごほうびがいつもの倍! つぎは ごはんだよ!」' : '「やったね! つぎは ごはんだよ!」'); return <MsxSay aid={s.aid} ex={l.e || 'excited'} text={l.t}/>; })()}
      </>);
      const next = () => (s.mealReady && !s.over ? setRun({ ...run, out: { r3: { ...st3, stage: 'meal' } } }) : finish(s));
      return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={<div className="v-ft"><button type="button" className="go" onClick={next} data-msx-r3-next>{s.mealReady && !s.over ? '🍽 ごはんへ ▶' : 'つぎへ ▶'}</button></div>}/>;
    }
    // ごはん(C3): 大会のあとに1回。あげなくてもよい
    const M = SUC.MEALS || {};
    const keys = Object.keys(M);
    const can = (k) => s.mealReady && !s.over && !!M[k];
    // 効き目は芯の meal を写しで試しに呼んで、実際に増える量を出す(食いしん坊・うつ・上限まで含めて本当の数。2026-11-13 社長「ごはんの効果が全然わからない」)
    const tryMeal = (k) => { try { const r = SUC.meal(s, k); return r && r.out && r.out.ok ? r.state : null; } catch (e) { return null; } };
    const loyOf = (x) => Math.max(0, Math.min(100, (Number(x.ama) || 0) + (Number(x.fear) || 0)));
    // 札には短く、選んだごはんは下の行でくわしく(体力は「回復」。上限は上がらない)
    const effOf = (k) => {
      const m = M[k]; const t = tryMeal(k); if (!m || !t) return null;
      const hp = t.hp - s.hp; const ama = (Number(t.ama) || 0) - (Number(s.ama) || 0); const fear = (Number(t.fear) || 0) - (Number(s.fear) || 0);
      const st = m.stat ? (t.stats[m.stat] || 0) - (s.stats[m.stat] || 0) : 0; const pop = (Number(t.pop) || 0) - (Number(s.pop) || 0); const pts = (Number(t.pts) || 0) - (Number(s.pts) || 0);
      return { m, hp, ama, fear, st, pop, pts, loy0: loyOf(s), loy1: loyOf(t) };
    };
    const fx = (k) => {
      const e = effOf(k); if (!e) return '';
      const hp = e.hp > 0 ? `体力+${e.hp}` : '体力 満タン';
      if (e.m.stat) return `${MSX_STAT_NAME[e.m.stat]}+${e.st}・${hp}`;
      if (e.m.pop || e.m.pts) return `人気+${e.pop}・能力P+${e.pts}・${hp}`;
      return `${e.m.fear ? `恐れ+${e.fear}` : `甘え+${e.ama}`}・${hp}`;
    };
    const fxLong = (k) => {
      const e = effOf(k); if (!e) return '';
      const hp = e.hp > 0 ? `体力を上限の${Math.round(e.m.hp * 100)}%回復(+${e.hp}・いま ${s.hp}→${s.hp + e.hp} / ${s.hpMax})` : `体力はもう満タン(上限 ${s.hpMax})`;
      const parts = [hp];
      if (e.m.stat) parts.push(`${MSX_STAT_NAME[e.m.stat]} +${e.st}(${s.stats[e.m.stat]}→${s.stats[e.m.stat] + e.st})`);
      if (e.m.fear || e.m.ama) parts.push(`${e.m.fear ? '恐れ度' : '甘え度'} +${e.m.fear ? e.fear : e.ama}(忠誠度 ${e.loy0}→${e.loy1})`);
      if (e.m.pop) parts.push(`人気 +${e.pop}(${s.pop}→${s.pop + e.pop})`);
      if (e.m.pts) parts.push(`能力ポイント +${e.pts}`);
      return parts.join('・');
    };
    const MEAL_ICON = { vitamin: '💊', gochiso: '🍱', f_life: '🥕', f_pow: '🍖', f_wise: '🌰', f_hit: '🫐', f_eva: '🍎', f_tough: '🥔', prune: '⭐' };
    const LY = SUC.LOYAL || {}; const RT = SUC.RATE || {};
    const loyNote = `忠誠度が高いほど、トレーニングの伸びが上がる(${LY.capBoost || 60}で最大 ×${1 + (LY.capBoost || 60) / 100})。80以上で大成功が少し出やすい(+${Math.round((RT.greatLoyal80 || 0.03) * 100)}%)`;
    const give = () => { if (!mealPick || !can(mealPick)) return; const r = SUC.meal(s, mealPick); if (r.out.ok) finish(r.state); };
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className={`v-scene ${st3.won ? '' : 'dk'}`} style={{ flex: '1 1 0', minHeight: 260 }}><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>{st3.won ? <div className="v-burst"/> : null}
        <div className="gr" style={{ bottom: 'calc(40% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '40%', height: '34%', ...(st3.won ? {} : { filter: 'grayscale(.5) drop-shadow(0 8px 5px #0009)' }) }}/>
        <div className={`v-stamp ${st3.won ? '' : 'ng'}`} style={{ top: '4%', fontSize: st3.won ? 42 : 34 }}>{st3.won ? '優勝!' : '負けた…'}<small>{cardIconNode(st3.icon, 16)} {st3.name}{d.fame ? `・賞金 💰${msxFmt(d.fame)}` : ''}</small></div>
        {s.mealReady && !s.over ? (
          <div className="v-meal"><div className="t">🍽 がんばったごほうびに、ごはんをあげよう<small>優勝したときだけ あげられる(1回・ただ){s.freeMeal === true ? `・見守りで効き目 ×${SUC.MEAL_WATCH_MULT || 1.5}` : ''}</small></div>
            <div className="ms">{keys.map((k) => (
              <button type="button" key={k} className={`v-ml ${mealPick === k ? 'sel' : ''}`} disabled={!can(k)} onClick={() => setMealPick(k)} style={{ opacity: can(k) ? 1 : 0.45 }} data-msx-r3-meal={k}>
                <div className="e">{MEAL_ICON[k] || '🍙'}</div><b>{M[k].name}</b><small data-msx-r3-mealfx={k}>{fx(k)}</small></button>))}</div>
            <div className="msx-note" data-msx-r3-mealdetail style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, textAlign: 'left', color: '#fde68a' }}>{mealPick && M[mealPick] ? `${M[mealPick].name}: ${fxLong(mealPick)}` : '札を押すと、くわしい効き目が出ます'}</div>
            <div className="msx-note" data-msx-r3-loynote style={{ marginTop: 4, fontSize: 10.5, lineHeight: 1.5, textAlign: 'left' }}>💡 {loyNote}</div>
            <div className="row" style={{ marginTop: 6 }}><img className="fc" src={msxFace(s.aid, st3.won ? 'excited' : 'troubled')} alt=""/><div className="bub f1">{st3.won ? '「優勝だもん、今日は ごちそう にしちゃお!」' : '「おつかれさま。おいしいもの食べて、また がんばろ!」'}</div></div></div>
        ) : !st3.won && !s.over ? (
          // 2026-11-13 社長: 負けたらごはんはなし。画面は出さず、助手の慰めの一言だけ
          <div className="v-meal" data-msx-r3-lostnote><div className="row"><img className="fc" src={msxFace(s.aid, 'troubled')} alt=""/><div className="bub f1">{msxR3Line('turn.cup.lose', run, { cup: st3.name }, '「おつかれさま。負けちゃったけど、ここまでよくがんばったよ。次、いこ!」')}</div></div></div>
        ) : null}
      </div>
    </>);
    const foot = !(s.mealReady && !s.over) ? <div className="v-ft"><button type="button" className="go" onClick={() => finish(s)} data-msx-r3-nomeal>つぎへ ▶</button></div>
      : <div className="v-ft"><button type="button" onClick={() => finish(s)} data-msx-r3-nomeal>あげない</button><button type="button" className="go" onClick={() => (mealPick && can(mealPick) ? give() : finish(s))} data-msx-r3-give>{mealPick && can(mealPick) ? `${M[mealPick].name}をあげる` : 'あげずに つぎへ ▶'}</button></div>;
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
  }
  if (!b) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">大会の中身を読めませんでした</div>} foot={<div className="v-ft"><button type="button" className="go" onClick={() => finish(s)}>つぎへ ▶</button></div>}/>;

  // ---- 読み込み ----
  if (failed) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note">試合を読み込めませんでした。電波のよい所で、もう一度開いてください</div>} foot={<div className="v-ft"><button type="button" onClick={onPause}>← 中断</button></div>}/>;
  if (!fight) return <MsxR3Frame run={run} back="中断" onBack={onPause} body={<div className="msx-note" data-msx-r3-loading>大会の準備をしています…</div>} foot={null}/>;
  const opp = fight.opp;
  // 頂への道: 試合の前に、助手が相手を選ぶ(1戦ごとに1回。やり直しでは出さない)
  const pickKey = b.kind === 'summit' ? `${s.turn}:${b.round}` : null;
  if (pickKey && msxArcHas(SUC, s.aid) && run.arcPick !== pickKey) return <MsxArcPick run={run} v={v} ev={ev} onPause={onPause} ctx={actx} bondLv={bondLv || 1} opp={opp} round={b.round} onDone={() => setRun({ ...run, arcPick: pickKey })}/>;
  const skip = typeof SUC.canSkip === 'function' && SUC.canSkip(s);
  const foeName = opp.name || msxMonName(opp.species);

  // ---- バトル部の見せる部品(組み合わせ表・バトルカード・カットイン・観戦・優勝/負け)。試合の計算と勝ち負けの記録は回3 ----
  if (showOn) {
    return <MsxR3Frame run={run} back="中断" onBack={onPause} body={
      <MonsucCupShow suc={SUC} s={s} me={{ name: run.nick || msxMonName(s.species) }} title={b.kind === 'cup' ? msxR3CupName(b.sys) : name} opp={{ loy: opp.loy, pop: opp.pop }}
        fight={() => fight} settle={settleShow} onRematch={rematchWith} onNext={nextShow} onClose={onPause} onPhase={setShowPh}/>} foot={null}/>;
  }
  // ---- 負けた(C4): やり直す/あきらめる ----
  if (step === 'lost') {
    const left = (SUC.REMATCH ? SUC.REMATCH.max : 3) - (s.rematchUsed || 0);
    const has = (k) => (s.items && s.items[k]) || 0;
    const re = rematchWith;
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
      {typeof MsxBetaTalk === 'function' ? <MsxBetaTalk keys={['rematch']} ctx={{ ...actx, bond: bondLv || 1 }}/> : null}
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
    const distA = typeof SUC.aptGradesOf === 'function' ? SUC.aptGradesOf(s) : (msxMon(s.species) || {}).distAptitude || []; const distB = (msxMon(opp.species) || {}).distAptitude || [];
    const lvA = (g) => ({ M: 3, 'SS+': 3, SS: 3, 'S+': 3, S: 3, A: 3, B: 2, C: 1 }[g] || 0);
    const techA = (Array.isArray(s.techs) ? s.techs : []).map((id) => { const t = (SUC.techsOf(s.species) || []).find((x) => x.id === id); return t ? t.name : null; }).filter(Boolean);
    const body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-bcs"><img className="bg" src="images/story-bg/monhero_plaza_evening.jpg" alt=""/><div className="sh"/>
        <div className="ttl">{name} ・ 1戦</div>
        {s.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function' ? <MsxKira kind={msxKiraOf(s.awake)} src={msxMonImg(s.species)} className="ml"><img src={msxMonImg(s.species)} alt="" style={{ height: '100%', objectFit: 'contain' }}/></MsxKira> : <img className="ml" src={msxMonImg(s.species)} alt=""/>}<img className="mr" src={msxMonImg(opp.species)} alt=""/><div className="vsw">VS</div>
        <div className="nb l"><b>{run.nick}</b><small><i className={msxRankCls(ev.rank)}>{ev.rank}</i> {msxFmt(ev.power)}</small></div>
        <div className="nb r"><b>{foeName}</b><small>{opp.champ ? '👑王者' : opp.rival ? 'ライバル' : msxMonName(opp.species)}</small></div></div>
      <div className="v-tabs t3">{[['st', 'ステータス'], ['tech', '技'], ['etc', '能力']].map(([k, n]) => <button type="button" key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} style={{ textAlign: 'center', background: tab === k ? '#3b2f0b' : '#1e1a36', border: `1.5px solid ${tab === k ? '#fde047' : '#475569'}`, borderRadius: 99, padding: 4, fontSize: 12, fontWeight: 900, color: tab === k ? '#fde047' : '#cbd5e1' }}>{n}</button>)}</div>
      <div className="v-card" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly' }}>
        {tab === 'st' ? <>
          {rowsSt.map(([n, a, c]) => <div key={n} className="v-vs1"><b className={a >= c ? 'w' : ''}>{a}</b><i className="l"><u style={{ width: `${a / 10}%` }}/></i><span>{n}</span><i className="r"><u style={{ width: `${c / 10}%` }}/></i><b className={c > a ? 'w' : ''}>{c}</b></div>)}
          <div className="v-vs1"><b className={s.pop >= (opp.pop || 0) ? 'w' : ''}>{s.pop}</b><i className="l p"><u style={{ width: `${s.pop}%` }}/></i><span>⭐ 人気</span><i className="r p"><u style={{ width: `${opp.pop || 0}%` }}/></i><b className={(opp.pop || 0) > s.pop ? 'w' : ''}>{Number.isFinite(opp.pop) ? opp.pop : '—'}</b></div>
          <div className="v-vs1"><b className={loyA >= (opp.loy || 0) ? 'w' : ''}>{loyA}</b><i className="l p"><u style={{ width: `${loyA}%` }}/></i><span>🤝 忠誠</span><i className="r p"><u style={{ width: `${opp.loy || 0}%` }}/></i><b className={(opp.loy || 0) > loyA ? 'w' : ''}>{Number.isFinite(opp.loy) ? opp.loy : '—'}</b></div>
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
  const foot = debug ? (
    <div className="v-ft">
      <button type="button" onClick={() => settle(false)}>負けたことにする</button>
      <button type="button" className="on" onClick={() => settle(true)} data-msx-r3-dbgwin>勝ったことにする(デバッグ)</button>
      <button type="button" className="go" onClick={() => setStep('card')} data-msx-r3-tocard>⚔ 1戦へ</button>
    </div>
  ) : (
    <div className="v-ft">
      {skip ? <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bskip>⏩ スキップ(結果だけ)</button> : <button type="button" className="on" style={{ flex: 1.6 }} onClick={result} data-msx-r3-bresult>⏩ 結果だけ見る</button>}
      <button type="button" className="go" onClick={() => setStep('card')} data-msx-r3-tocard>⚔ 1戦へ</button>
    </div>
  );
  return <MsxR3Frame run={run} back="中断" onBack={onPause} body={body} foot={foot}/>;
}
