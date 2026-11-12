// ===== モンヒロサクセス: 育成の画面の本体(メイン・訓練を選ぶ・結果・叱る/褒める・イッサ博士・ターンが進む・中断と再開) =====
// 見本: docs/progress/player-raise/mock/png/v3-M・T・K・I.png。大会・修行・引退・合体の中身は回3(ボタンは置いて「準備中」)
// 1ターンの流れ(芯の決まった順): act → (訓練なら)react → (来ていれば)issa → endTurn → (大会なら)settle
// ★1つ進むたびに mh_monsuc_run_v1 へ保存する(phase も持つので、どこで閉じても同じ所から続く)
const MSX_POLICY_SCALE = Object.freeze(['超溺愛', '溺愛', '甘い', '普通', '厳しい', 'スパルタ', '超スパルタ']);
const MSX_RES = Object.freeze({
  great: { word: '大成功', cls: '', bg: 'forest_morning', icon: '🌟' },
  ok: { word: '成功', cls: 'ok', bg: 'forest_morning', icon: '⭕' },
  fail: { word: '失敗…', cls: 'ng', bg: 'forest_evening', icon: '❌' },
  sab: { word: 'サボった', cls: 'zz', bg: 'monhero_plaza', icon: '💤' },
});
const MSX_COND = Object.freeze({ injury: 'けが', ill: '病気', away: '家出' });
const MSX_ISSA_KEYS = Object.freeze([
  { key: 'stat', icon: '💪', name: 'ステータスアップ', ok: '全能力 +50', ng: '全能力 −10・サボりグセ', line: 'stat' },
  { key: 'hpmax', icon: '🔋', name: '体力上限アップ', ok: '体力の上限 +20', ng: '体力 −20', line: 'cap' },
  { key: 'hp', icon: '❤️', name: '体力回復', ok: '体力を8割回復', ng: '体力 −30・うつ病', line: 'heal' },
  { key: 'loyal', icon: '🤝', name: '忠誠度アップ', ok: '忠誠度 +15', ng: '忠誠度 −5', line: 'loy' },
  { key: 'pop', icon: '⭐', name: '人気アップ', ok: '人気 +15', ng: '人気 −5', line: 'pop' },
]);
const MSX_LOT = Object.freeze({ self: 'drill', rest: 'rest', talk: 'chat', tip: 'tip', friend: 'friend' });

const msxLayout = () => {
  if (typeof window === 'undefined') return '';
  const w = window.innerWidth; const h = window.innerHeight;
  if (w > h && h < 520) return 'land';
  return w <= 340 ? 's320' : '';
};
// 訓練の札(芯が6枚の札にしたら 'train:<能力>'、いまは 'light:<能力>')
const msxCardOf = (v, stat) => (v && v.cards ? (v.cards[`train:${stat}`] || v.cards[`light:${stat}`] || null) : null);
const msxMemberName = (m) => (!m ? '' : m.kind === 'base' || !m.name || m.name === m.species ? msxMonName(m.species) : m.name);

function MsxBand({ s, v, ev, use = 0, stAdd = 0 }) {
  const cal = msxCalendar(s.turn);
  const max = Math.max(1, s.hpMax); const hp = Math.max(0, Math.min(max, s.hp));
  const after = Math.max(0, hp - use);
  const P = (msxSuc && msxSuc.core.PERIODS) || [];
  const now = v.period.index;
  return (
    <div className="v-band">
      <div className="v-b1">
        <div className="v-turn"><span className="ph">{v.period.name}<small>{cal.year}年目 {cal.month}月</small></span>
          <div className="n">残り<b>{v.period.left}</b>ターン<small>最後まで あと <em>{v.toEnd}</em></small></div></div>
        <div className="v-pow"><div><small>総合力</small><b>{msxFmt(ev.power)}</b></div><i className={`${msxRankCls(ev.rank)} big`}>{ev.rank}</i></div>
      </div>
      <div className="v-b2">
        <div className={`v-ga hp${after < max * 0.3 ? ' low' : ''}`}><span>❤️ 体力</span>
          <div className="tr"><i style={{ width: `${after / max * 100}%` }}/>{use ? <u style={{ left: `${after / max * 100}%`, width: `${Math.min(hp, use) / max * 100}%` }}/> : null}{max > 100 ? <s style={{ left: `${100 / max * 100}%` }}/> : null}</div>
          {use ? <em>−{use}</em> : null}<b>{hp}<small className={max > 100 ? 'cap' : ''}>/{max}{max > 100 ? '▲' : ''}</small></b></div>
        <div className="v-ga st"><span>💢 ストレス</span>
          <div className="tr"><i style={{ width: `${s.stress}%` }}/>{stAdd ? <u className="add" style={{ left: `${s.stress}%`, width: `${Math.min(100 - s.stress, stAdd)}%` }}/> : null}</div>
          {stAdd ? <em className="pl">+{stAdd}</em> : null}<b>{s.stress}<small>/100</small></b></div>
      </div>
      <div className="v-track">{P.map((p, i) => <span key={p.key} style={{ flex: p.len }} className={i === now ? 'now' : ''}><i style={{ width: `${i < now ? 100 : i === now ? (v.period.at - 1) / p.len * 100 : 0}%` }}/></span>)}</div>
    </div>
  );
}
function MsxStRow({ stats, ups, main }) {
  return (
    <div className="v-st">
      {MSX_STATS.map((k) => {
        const u = ups ? (ups[k] || 0) : 0;
        return (<div key={k} className={`${u > 0 ? 'up' : u < 0 ? 'dn' : ''}${k === main ? ' main' : ''}`}>
          <small>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</small><b>{stats[k]}</b><u><i style={{ width: `${stats[k] / 9.99}%` }}/></u>
          {ups ? <em>{u > 0 ? `+${u}` : u < 0 ? `−${-u}` : ''}</em> : null}</div>);
      })}
    </div>
  );
}
function MsxPf({ m, bond, tagAt, cls = '', aid }) {
  const tag = bond >= tagAt;
  if (aid) return <span className={`v-pf as${tag ? ' tag' : ''} ${cls}`}><img src={msxFace(aid, 'happy')} alt=""/><i className="af"><b style={{ width: `${bond}%` }}/></i></span>;
  const r = m.kind === 'base' ? 'G' : m.rank;
  return <span className={`v-pf r${r}${m.kind === 'base' ? ' base' : ''}${tag ? ' tag' : ''} ${cls}`}><img src={msxMonThumb(m.species)} alt=""/><i className="af"><b style={{ width: `${bond}%` }}/></i></span>;
}
function MsxMonArt({ run, className, style }) {
  const sp = run.s.species;
  if (run.colors && run.colors.some(Boolean) && typeof DyedMonsterImage === 'function') {
    return <span className={className} style={style}><DyedMonsterImage baseId={sp} src={msxMonImg(sp)} masuColors={run.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>;
  }
  return <img className={className} style={style} src={msxMonImg(sp)} alt=""/>;
}
function MsxSay({ aid, ex = 'happy', text }) {
  return <div className="v-sayrow"><img className="fc" src={msxFace(aid, ex)} alt=""/><div className="bub">{text}</div></div>;
}

// ---- 本体 ----
function MonheroSuccessScreen({ onClose, callNameOf, bondLvOf, debug = false }) {
  const [view, setView] = useState('loading');
  const [data, setData] = useState(null);
  const [run, setRunState] = useState(null);
  const [layout, setLayout] = useState(msxLayout);
  const [ask, setAsk] = useState(null); // 確かめの小窓 { text, yes, onYes }
  useEffect(() => {
    const on = () => setLayout(msxLayout());
    window.addEventListener('resize', on); window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  useEffect(() => {
    let alive = true;
    msxLoad().then(async (L) => {
      if (!alive) return;
      if (!L) { setView('fail'); return; }
      const d = await msxReadAll(L.SUC);
      if (!alive) return;
      setData(d); setRunState(d.run); setView('home');
    });
    return () => { alive = false; };
  }, []);
  const setRun = (r) => { setRunState(r); if (r) msxSaveRun(r); };
  const setMeta = (meta) => { setData((d) => ({ ...d, meta })); msxSaveMeta(meta); };

  const startRun = (cfg) => {
    const { SUC } = msxSuc;
    const id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    // 持ちこみ: はじめる前に効く物は carry、育成中に使う物は bag(芯の入口・合わせて2つまで)
    const known = (k) => !!(SUC.ITEMS && SUC.ITEMS[k]);
    const carry = cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'before');
    const bag = {}; cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'both').forEach((k) => { bag[k] = 1; });
    const s = SUC.newRun({ id, species: cfg.species, aid: cfg.aid, team: cfg.team, aidBondLv: cfg.aidBondLv, carry, bag, wonBefore: Array.isArray(data.meta.wonCups) ? data.meta.wonCups : [] });
    const r = { v: 1, id, s, nick: cfg.nick, colors: cfg.colors, from: cfg.from, items: cfg.items, used: 0, phase: 'main', out: null, log: [], startAt: Date.now() };
    const meta = { ...data.meta, team: cfg.teamSlots.map((t) => (t.box ? { box: t.box } : { base: t.base })), runs: (data.meta.runs || 0) + 1, picked: { ...(data.meta.picked || {}), [cfg.species]: ((data.meta.picked || {})[cfg.species] || 0) + 1 } };
    // 持ちこんだ物は1つずつ減らす。芯がまだ知らない物(効き目が無い物)は減らさない
    if (cfg.items.some(known)) { const it = { ...meta.items }; cfg.items.filter(known).forEach((k) => { it[k] = Math.max(0, (it[k] || 0) - 1); if (!it[k]) delete it[k]; }); meta.items = it; }
    setMeta(meta); setRun(r); setView('play');
  };
  const quit = () => setAsk({ text: 'この育成をやめますか? 育てた中身はなくなります(保存枠には入りません)', yes: 'やめる', onYes: async () => { await storeSet(MSX_KEYS.run, null); setRunState(null); setView('home'); } });

  let content = null;
  if (view === 'loading') content = <div className="v-body" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}><div className="msx-note">読み込んでいます…</div></div>;
  else if (view === 'fail') content = (<><MsxHd back="とじる" onBack={onClose}/><div className="v-body"><div className="v-card">読み込めませんでした。通信のよいところで、もう一度開いてください</div></div></>);
  else if (view === 'home') content = <MsxHome data={data} run={run} debug={debug} onClose={onClose} onContinue={() => setView('play')} onNew={() => (run && !run.s.over ? setAsk({ text: '途中の育成があります。新しく始めると、いまの育成はなくなります', yes: '新しく始める', onYes: () => setView('start') }) : setView('start'))} setMeta={setMeta} onWipe={quit}/>;
  else if (view === 'start') content = <MsxStart data={data} SUC={msxSuc.SUC} onCancel={() => setView('home')} onStart={startRun} bondLvOf={bondLvOf} callNameOf={callNameOf}/>;
  else if (view === 'play' && run) content = <MsxPlay run={run} setRun={setRun} onPause={() => setView('home')} onQuit={quit} callNameOf={callNameOf} bondLvOf={bondLvOf} debug={debug}/>;

  const node = (
    <div className="msx-wrap" data-monhero-success role="dialog" aria-label="モンヒロサクセス">
      <style>{MSX_CSS}</style>
      <div className={`msx v3 ${layout}`} data-msx-view={view}>
        {content}
        {ask && <div className="msx-ov msx-fade"><div className="msx-sheet"><div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{ask.text}</div>
          <button type="button" className="msx-btn go" onClick={() => { const f = ask.onYes; setAsk(null); f(); }}>{ask.yes}</button>
          <button type="button" className="msx-btn sub" onClick={() => setAsk(null)}>やめておく</button></div></div>}
      </div>
    </div>
  );
  return typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && typeof document !== 'undefined' ? ReactDOM.createPortal(node, document.body) : node;
}

// ---- はじめの画面(続きから・新しく始める・デバッグの道具) ----
function MsxHome({ data, run, debug, onClose, onContinue, onNew, setMeta, onWipe }) {
  const SUC = msxSuc.SUC;
  const s = run && run.s;
  const v = s ? SUC.peek(s) : null;
  return (
    <>
      <MsxHd back="とじる" onBack={onClose} right={`保存枠 ${data.box.mons.length}/${data.box.cap}`}/>
      <div className="v-body">
        <div className="v-scene" style={{ flex: '1 1 0' }}>
          <img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/>
          {s ? <><div className="gr"/><MsxMonArt run={run} className="mon"/><span className="v-nm">{run.nick}<small>{msxMonName(s.species)}</small></span></> : null}
          <div className="v-ev-h"><small>育成</small>🌱 モンヒロサクセス</div>
        </div>
        {s ? (
          <div className="v-card pk">
            <div className="h2">{s.over ? 'この育成は終わりました' : '途中の育成があります'}</div>
            <div className="sub">{run.nick}({msxMonName(s.species)})・{msxAidName(s.aid)}編・{s.over ? '引退の画面は準備中です' : `${v.period.name} 残り${v.period.left}ターン(最後まで あと${v.toEnd})`}</div>
            <button type="button" className="msx-btn go" onClick={onContinue}>{s.over ? '結果を見る' : '▶ 続きから'}</button>
          </div>
        ) : <div className="v-card"><div className="h2">育てる子を選んで、46ターンの育成をはじめよう</div><div className="sub">編成の6体が集まった訓練ほど、よく伸びる</div></div>}
        <button type="button" className="v-big" onClick={onNew}>🌱 新しく育成をはじめる</button>
        {debug && (
          <div className="v-card" style={{ borderColor: '#a3e63566' }}>
            <div className="msx-dbg">デバッグ(公開の印が偽のあいだだけ・通常のプレイには出ない)</div>
            <button type="button" className="msx-btn sub" onClick={() => { const it = { ...data.meta.items }; MSX_ITEMS.forEach((t) => { it[t.id] = Math.min(999, (it[t.id] || 0) + 3); }); setMeta({ ...data.meta, items: it }); }}>持ちこみの物を3つずつ足す</button>
            {s && <button type="button" className="msx-btn sub" onClick={onWipe}>途中の育成を消す</button>}
          </div>
        )}
      </div>
    </>
  );
}

// ---- 育成の1ターン ----
function MsxPlay({ run, setRun, onPause, onQuit, callNameOf, bondLvOf, debug }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const v = useMemo(() => SUC.peek(s), [s]);
  const ev = useMemo(() => SUC.evaluate(s), [s]);
  const [sub, setSub] = useState('main');
  const [sel, setSel] = useState(null);
  const [sheet, setSheet] = useState(null); // 'log' | 'menu' | { soon: 名前 }
  const tagAt = (SUC.BOND && SUC.BOND.tag) || 80;
  const bondLv = bondLvOf ? Number(bondLvOf(s.aid)) || 1 : 1;
  const ctx = { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick, species: s.species, callName: callNameOf ? callNameOf(s.aid) : '' };
  const line = (scene, fallback, extra = {}) => { const l = msxPickLine({ ...ctx, ...extra }, scene, { bondLv }); return l || { t: fallback, e: 'normal' }; };
  const pushLog = (r, text) => ({ ...r, log: [...(r.log || []), { turn: s.turn, t: text }].slice(-20) });

  // 次の段へ
  const endTurnFlow = (r0) => {
    const r = SUC.endTurn(r0.s);
    if (!r.out.ok) { setRun({ ...r0, phase: 'main', out: null }); return; }
    const st = r.state;
    if (st.battle) setRun({ ...r0, s: st, phase: 'battle', out: null });
    else if (st.over) setRun({ ...r0, s: st, phase: 'over', out: null });
    else setRun({ ...r0, s: st, phase: 'turn', out: { from: r0.s.turn } });
  };
  const afterAct = (r0) => { const p = SUC.peek(r0.s); if (p.issa) setRun({ ...r0, phase: 'issa', out: null }); else endTurnFlow(r0); };
  const doAct = (a) => {
    const r = SUC.act(s, a);
    if (!r.out.ok) return;
    setSub('main'); setSel(null);
    let next = { ...run, s: r.state, out: { ...r.out, kind: a.kind } };
    if (a.kind === 'retry') { endTurnFlow(next); return; }
    const text = r.out.result ? `${MSX_STAT_NAME[a.stat] || ''}の訓練: ${MSX_RES[r.out.result].word}` : a.kind === 'rest' ? '休んだ' : a.kind === 'play' ? '遊んだ' : a.kind === 'clinic' ? '通院した' : '休み';
    next = pushLog(next, text);
    setRun({ ...next, phase: 'result' });
  };

  const phase = run.phase;
  let body = null; let foot = null;
  // 回3(大会・修行・引退・ゲームオーバー・保存枠)の画面 MsxR3 が入っていれば、そちらへ渡す(回3の担当と決めた口)。
  //   MsxR3 はヘッダ・帯・v-body・v-ft まで自分で出す。修行・大会の受付は act のあと onActed(next) でこちらの流れ(叱る/褒める・博士・ターンを閉じる)へ戻す
  const r3 = typeof MsxR3 === 'function' ? ((phase === 'battle' && s.battle) ? 'battle' : (phase === 'over' || s.over) ? 'over' : sub === 'cup' ? 'cup' : sub === 'shugyo' ? 'shugyo' : null) : null;
  if (r3) return <MsxR3 kind={r3} run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} debug={debug}
    onBack={() => setSub('main')} onPause={onPause} onQuit={onQuit}
    onActed={(next) => { setSub('main'); afterAct(next); }}/>;
  const bandProps = {};

  // ---- 結果 ----
  if (phase === 'result' && run.out) {
    const o = run.out; const isTrain = !!o.result;
    const R = isTrain ? MSX_RES[o.result] : null;
    const gains = o.gain || {};
    const members = o.card && Array.isArray(o.card.members) ? o.card.members.map((i) => s.team[i]).filter(Boolean) : [];
    const restName = o.rest && SUC.REST ? (SUC.REST.find((x) => x.key === o.rest) || {}).name : null;
    const say = isTrain ? line(o.result === 'sab' ? 'turn.result.slack' : `turn.result.${o.result}`, '') : o.kind === 'rest' ? line(`turn.rest.${o.rest === 'poor' ? 'little' : o.rest === 'great' ? 'deep' : 'normal'}`, '') : o.kind === 'play' ? line('turn.play', '') : o.kind === 'clinic' ? line((o.cured || []).length ? 'turn.clinic.cured' : 'turn.clinic.again', '') : { t: '' };
    const evMember = o.event && Number.isInteger(o.event.who) ? s.team[o.event.who] : null;
    const evLine = o.event ? (o.event.story ? msxPickLine({ ...ctx, cheer: msxMemberName(evMember) }, `cheer.base.ep${o.event.story}`, { who: 'narr' }) : msxPickLine({ ...ctx, cheer: msxMemberName(evMember) }, `cheer.lot.${MSX_LOT[o.event.lottery] || 'friend'}`, { who: '*' })) : null;
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={`images/story-bg/${isTrain ? R.bg : 'monhero_plaza'}.jpg`} alt=""/><div className="sh"/>
        {isTrain && o.result === 'great' ? <div className="v-burst"/> : isTrain && o.result === 'ok' ? <div className="v-burst b2"/> : null}
        <div className="gr" style={{ left: '62%', bottom: 'calc(14% - 5px)' }}/>
        <MsxMonArt run={run} className="mon" style={{ left: '62%', bottom: '14%', height: '46%', transform: o.result === 'sab' ? 'translateX(-50%) rotate(84deg)' : o.result === 'fail' ? 'translateX(-50%) rotate(-12deg)' : 'translateX(-50%) rotate(6deg)', filter: o.result === 'fail' ? 'grayscale(.5) drop-shadow(0 8px 5px #0009)' : undefined }}/>
        <div className={`v-stamp msx-pop ${isTrain ? R.cls : 'ok'}`}>{isTrain ? R.word : o.kind === 'rest' ? (restName || '休んだ') : o.kind === 'play' ? '遊んだ!' : o.kind === 'clinic' ? '通院' : '休み'}
          {isTrain && o.card && o.card.tags && o.card.tags.length ? <small>🤝 友情タッグ ×{o.card.tags.length}{o.result === 'great' ? '・伸び ×1.5' : ''}</small> : null}</div>
        {members.length ? <div className="v-chips" style={{ top: 'auto', bottom: 8 }}>{members.map((m, i) => <span key={i} className="v-chip">{msxMemberName(m)} 親密度 +{(SUC.BOND && SUC.BOND.train) || 8}</span>)}</div> : null}
      </div>
      {isTrain ? <MsxStRow stats={s.stats} ups={gains} main={o.card && o.card.stat}/> : null}
      <div className="v-log">
        {isTrain && o.lvUp ? <div className="v-lvup">⬆ 訓練Lvアップ! {MSX_STAT_ICON[o.card.stat]} {MSX_STAT_NAME[o.card.stat]} <b>Lv.{o.trainLv - 1} → Lv.{o.trainLv}</b><small>次から、{MSX_STAT_NAME[o.card.stat]}の訓練の基本の伸びが上がる</small></div> : null}
        {isTrain ? <><span className="hd2">{MSX_STAT_ICON[o.card.stat]} {MSX_STAT_NAME[o.card.stat]}の訓練</span><br/>
          {Object.keys(gains).length ? <>{Object.entries(gains).map(([k, g], i) => <span key={k}>{i ? '・' : ''}{MSX_STAT_NAME[k]} <b className="gu">{g > 0 ? `+${g}` : g}</b></span>)}</> : '能力は上がらなかった'}</>
          : o.kind === 'rest' || o.kind === 'play' ? <><span className="hd2">{o.kind === 'rest' ? '🛌 休む' : '🎈 遊ぶ'}</span><br/>体力が回復した{(o.cured || []).includes('utsu') ? '。ようす「うつ病」が治った' : ''}</>
          : o.kind === 'clinic' ? <><span className="hd2">🏥 通院</span><br/>{(o.cured || []).length ? 'ようすが治った' : '今回は治らなかった。もう1回来れば治る'}</>
          : <><span className="hd2">🛌 休み</span><br/>{MSX_COND[o.cond] || '体調'}のため、このターンは休んだ</>}
        {o.event ? <><br/><b className="ga">{msxMemberName(evMember)}</b>{o.event.story ? `との出来事 第${o.event.story}話` : 'との小さな出来事'}{evLine ? `: ${evLine.t}` : ''}</> : null}
        {o.cond && isTrain ? <><br/><b style={{ color: '#fca5a5' }}>{MSX_COND[o.cond]}</b>をしてしまった…しばらく休み</> : null}
      </div>
      {say && say.t ? <MsxSay aid={s.aid} ex={say.e || 'normal'} text={say.t}/> : null}
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => (isTrain ? afterAct({ ...run, phase: 'main' }) : afterAct(run))}>⏩ とばす</button><button type="button" className="go" onClick={() => (isTrain ? setRun({ ...run, phase: 'react' }) : afterAct(run))}>つぎへ ▶</button></div>;
  }
  // ---- 叱る/褒める ----
  else if (phase === 'react') {
    const good = s.last && (s.last.res === 'great' || s.last.res === 'ok');
    const loy = SUC.loyalOf(s);
    const pol = Math.max(-3, Math.min(3, s.pol || 0));
    const choose = (how) => { const r = SUC.react(s, how); afterAct({ ...run, s: r.state, phase: 'main' }); };
    const ask = line(good ? 'turn.praise.fit' : 'turn.scold.fit', good ? 'ほめてあげる?' : 'どうする?');
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene dk" style={{ flex: '1 1 0' }}>
        <img className="bg" src={`images/story-bg/${(MSX_RES[s.last && s.last.res] || MSX_RES.ok).bg}.jpg`} alt=""/><div className="sh"/>
        <div className="v-strip"/><img className="v-body2" src={msxBody(s.aid, good ? 'happy' : 'troubled')} alt=""/>
        <div className="v-chips"><span className="v-chip ylw">{(MSX_RES[s.last && s.last.res] || MSX_RES.ok).icon} {(MSX_RES[s.last && s.last.res] || MSX_RES.ok).word}のあと</span></div>
        <div className="v-q"><div className="ask">{msxAidName(s.aid)}「{good ? `${run.nick}、ほめてあげる?` : `${run.nick}、どうする?`}」</div>
          <div className="bt">
            <button type="button" className="v-ch" onClick={() => choose('praise')}>👏 褒める<small>甘え度 +・方針が甘いほうへ</small></button>
            <button type="button" className="v-ch b" onClick={() => choose('scold')}>📣 叱る<small>恐れ度 +・方針が厳しいほうへ</small></button>
            <button type="button" className="v-ch n" onClick={() => choose(null)}>なにもしない(方針はそのまま)</button>
          </div></div>
      </div>
      <div className="v-pol"><div className="l"><span>超溺愛</span><span>甘い</span><span style={{ color: '#fde047' }}>いまの方針: {MSX_POLICY_SCALE[pol + 3]}</span><span>厳しい</span><span>超スパルタ</span></div>
        <div className="m">{MSX_POLICY_SCALE.map((n, i) => <i key={n} className={i === pol + 3 ? 'on' : ''}/>)}</div>
        <div className="two">
          <div className="v-ga"><span>🥰 甘え度</span><div className="tr"><i style={{ width: `${s.ama * 2}%`, background: 'linear-gradient(180deg,#f9a8d4,#f472b6)' }}/></div><b>{s.ama}</b></div>
          <div className="v-ga"><span>😨 恐れ度</span><div className="tr"><i style={{ width: `${s.fear * 2}%`, background: 'linear-gradient(180deg,#7dd3fc,#3b82f6)' }}/></div><b>{s.fear}</b></div></div>
        <div style={{ fontSize: 9.5, color: '#cbd5e1', fontWeight: 700, marginTop: 4 }}>忠誠度 {loy} = 甘え度 {s.ama} + 恐れ度 {s.fear}。甘すぎるとサボりやすく、厳しすぎるとストレスがたまりやすい</div>
        {ask && ask.t && ask.t !== 'ほめてあげる?' && ask.t !== 'どうする?' ? <div className="msx-note" style={{ marginTop: 4 }}>{msxAidName(s.aid)}「{ask.t}」</div> : null}</div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => choose(null)}>⏩ とばす</button><button type="button" className="on" disabled>えらんでね</button></div>;
  }
  // ---- イッサ博士 ----
  else if (phase === 'issa') {
    body = <MsxIssa run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} onDone={(r) => endTurnFlow({ ...r, phase: 'main', out: null })}/>;
  }
  // ---- ターンが進む ----
  else if (phase === 'turn') {
    const cal = msxCalendar(s.turn); const prev = msxCalendar(Math.max(1, s.turn - 1));
    const P = msxSuc.core.PERIODS;
    const seasonChanged = cal.season !== prev.season;
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene msx-fade" style={{ flex: '1 1 0' }}><div className="v-clock">
        <div className="v-cal msx-pop"><div className="y">{v.period.name}・{cal.year}年目</div><div className="mth">{cal.month}<small>月</small></div><div className="old">{prev.month}月 おつかれさま</div></div>
        <div className="v-next">この期の残り <b>{v.period.left}</b> ターン</div>
        {v.period.key !== 'final' ? <div className="v-chip hot" style={{ position: 'static' }}>🏆 期末の大会まで あと{v.period.left}ターン</div> : <div className="v-chip hot" style={{ position: 'static' }}>🏆 頂への道</div>}
        {seasonChanged ? <div className="v-chip" style={{ position: 'static' }}>{MSX_SEASON[cal.season]}になった</div> : null}
        <div className="v-phs">{P.map((p, i) => <span key={p.key} style={{ flex: p.len }} className={i === v.period.index ? 'now' : ''}><i style={{ width: `${i < v.period.index ? 100 : i === v.period.index ? (v.period.at - 1) / p.len * 100 : 0}%` }}/><b>{p.name.replace('期', '').replace('最後の', '最後')}</b></span>)}</div>
      </div></div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← 中断</button><button type="button" className="go" onClick={() => setRun({ ...run, phase: 'main', out: null })}>つぎへ ▶</button></div>;
  }
  // ---- 大会(中身は回3) ----
  else if (phase === 'battle' && s.battle) {
    const b = s.battle;
    const opp = SUC.opponents(s);
    const name = b.kind === 'summit' ? (SUC.SUMMIT[b.round] || {}).name : b.kind === 'debut' ? 'デビュー戦' : (SUC.FORCED[b.kind] || {}).name;
    const settle = (win) => {
      const r = SUC.settle(s, win ? opp.map(() => true) : [false]);
      const next = pushLog({ ...run, s: r.state }, `${name}: ${r.out.won ? '優勝' : '負け'}`);
      if (r.state.battle) setRun({ ...next, phase: 'battle' });
      else if (r.state.over) setRun({ ...next, phase: 'over' });
      else setRun({ ...next, phase: 'turn', out: { from: s.turn } });
    };
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src="images/story-bg/monhero_town.jpg" alt=""/><div className="sh"/>
        <div className="v-ev-h"><small>大会</small>🏆 {name}{b.retry ? `(再挑戦 ${b.retry}回目)` : ''}</div>
        <div className="gr"/><MsxMonArt run={run} className="mon"/></div>
      <div className="v-card pk"><div className="h2">{name}<span className="msx-soon">準備中</span></div>
        <div className="sub">試合({opp.length}戦)と観戦の画面は、次の回で入ります。</div></div>
    </>);
    foot = debug ? <div className="v-ft"><button type="button" onClick={() => settle(false)}>負けたことにする</button><button type="button" className="go" onClick={() => settle(true)}>勝ったことにする(デバッグ)</button></div>
      : <div className="v-ft"><button type="button" onClick={onPause}>← 中断</button></div>;
  }
  // ---- 終わり(引退は回3) ----
  else if (phase === 'over' || s.over) {
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/><div className="v-burst b2"/><div className="gr"/><MsxMonArt run={run} className="mon"/>
        <div className="v-stamp ok msx-pop">{s.over === 'gameover' ? 'ここまで…' : s.over === 'lost' ? 'おつかれさま' : '育成おわり!'}<small>総合力 {msxFmt(ev.power)}・ランク {ev.rank}</small></div></div>
      <MsxStRow stats={s.stats}/>
      <div className="v-card"><div className="h2">引退<span className="msx-soon">準備中</span></div><div className="sub">振り返り・育成ランク・保存枠へ入れる画面は次の回で入ります。この育成はこのまま残しておきます</div></div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← もどる</button><button type="button" onClick={onQuit}>この育成を消す</button></div>;
  }
  // ---- 訓練を選ぶ ----
  else if (sub === 'train') {
    const pull = (k) => { const c = msxCardOf(v, k); return c ? c.tags.length * 10 + c.members.length + (c.aid ? 1 : 0) : 0; };
    const stat = sel || MSX_STATS.slice().sort((a, b) => pull(b) - pull(a))[0];
    const card = msxCardOf(v, stat);
    const pv = card && typeof SUC.preview === 'function' ? SUC.preview(s, { kind: card.kind, stat }) : null;
    const lvOf = (c) => (!c ? null : Number.isFinite(c.lv) ? c.lv : typeof SUC.trainLvOf === 'function' && s.trainXp ? SUC.trainLvOf(s.trainXp[`${c.kind}:${c.stat}`]) : null);
    const tags = card ? card.tags : [];
    const members = card ? card.members : [];
    const trainLv = lvOf(card);
    if (pv) { bandProps.use = Math.round(pv.hp || 0); bandProps.stAdd = Math.round(pv.stress || 0); }
    body = (<>
      <MsxBand s={s} v={v} ev={ev} {...bandProps}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '30%', bottom: 'calc(34% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '34%', height: '40%' }}/>
        <div className="v-chips" style={{ right: 'auto', left: 7 }}><span className="v-chip ylw">{MSX_STAT_ICON[stat]} {MSX_STAT_NAME[stat]}の訓練{trainLv ? ` Lv${trainLv}` : ''}</span></div>
        <div className="v-come">
          {members.map((i) => { const m = s.team[i]; const tag = s.bond[i] >= tagAt; const eff = SUC.memberEffect(m, stat, SUC.loyalOf(s)); return (
            <div key={i} className={`v-cm${tag ? ' tag' : ''}`}><MsxPf m={m} bond={s.bond[i]} tagAt={999}/>
              <div className="tx"><b>{msxMemberName(m)}</b><small>{tag ? `🤝 タッグ +${m.tag}%` : `編成の効き +${Math.round(eff)}%`}</small><div className="afl">親密度<i><b style={{ width: `${s.bond[i]}%` }}/></i>{s.bond[i]}</div></div></div>); })}
          {card && card.aid ? <div className={`v-cm${s.aidBond >= tagAt ? ' tag' : ''}`}><MsxPf aid={s.aid} bond={s.aidBond} tagAt={999}/><div className="tx"><b>{msxAidName(s.aid)}</b><small>{s.aidBond >= tagAt ? '🤝 タッグ' : '助手も来ている'}</small><div className="afl">親密度<i><b style={{ width: `${s.aidBond}%` }}/></i>{s.aidBond}</div></div></div> : null}
        </div>
        {card && <div className={`v-fx${tags.length ? '' : ' plain'}`}>
          <div className="t">{tags.length ? <span className="big">🤝 友情タッグ ×{tags.length}</span> : <span>タッグなし</span>}<span>効果 ×{card.mult}</span><span className="fl">失敗 <b>{Math.round(card.fail * 100)}%</b></span></div>
          <div className="ch"><span>基本</span><i>▶</i><span>編成 +{Math.round(card.add * 100)}%</span>{tags.length ? <><i>▶</i><span className="tgx">🤝×{tags.length} +{Math.round(card.tag * 100)}%</span></> : null}{pv && pv.gain ? <><i>▶</i><span className="res">{MSX_STAT_NAME[stat]} +{pv.gain[stat] || 0}</span></> : null}</div>
          {trainLv ? <div className="v-lvx"><b>訓練Lv.{trainLv}</b><i><u style={{ width: `${card.next ? Math.max(0, 100 - card.next * 20) : 100}%` }}/></i><span>{trainLv >= 5 ? 'Lv が いちばん上' : card.next ? `あと${card.next}回で Lvアップ` : ''}</span></div> : null}
        </div>}
      </div>
      <MsxStRow stats={s.stats} ups={pv ? pv.gain : null} main={stat}/>
      <div className="v-trs">
        {MSX_STATS.map((k) => { const c = msxCardOf(v, k); const lv = lvOf(c); return (
          <button type="button" key={k} className={`v-tr${c && c.tags.length ? ' tag' : ''}${k === stat ? ' sel' : ''}`} onClick={() => setSel(k)}>
            <div className="o">{MSX_STAT_ICON[k]}</div><b className="nm">{MSX_STAT_NAME[k]}</b>{lv ? <i className="lv">Lv.{lv}</i> : null}</button>); })}
      </div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => { setSub('main'); setSel(null); }}>← もどる</button><button type="button" className="go" disabled={!card} onClick={() => doAct({ kind: card.kind, stat })}>{MSX_STAT_ICON[stat]} {MSX_STAT_NAME[stat]}の訓練をする</button></div>;
  }
  // ---- メイン ----
  else {
    const can = v.can || [];
    const anyTag = MSX_STATS.some((k) => { const c = msxCardOf(v, k); return c && c.tags.length; });
    const yosu = s.yosu && (s.yosu.sabori || s.yosu.utsu);
    const sayL = yosu ? line(s.yosu.sabori ? 'turn.mood.sabori' : 'turn.mood.utsu', 'ようすが気になるね…') : s.cond ? line(`turn.cond.${s.cond.kind === 'away' ? 'runaway' : s.cond.kind === 'ill' ? 'sick' : 'injury'}.in`, '今日は休ませてあげよ') : line(msxStartScene(s), '今月はどうする?');
    const cal = msxCalendar(s.turn); const scn = msxSceneBg();
    const low = s.hp < s.hpMax * 0.3;
    const bag = Object.keys(s.bag || {}).filter((k) => s.bag[k] > 0);
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <MsxSay aid={s.aid} ex={yosu || low ? 'troubled' : (sayL.e || 'happy')} text={sayL.t}/>
      <div className="v-scene home">
        <img className="bg" src={scn.bg} alt=""/><div className="sh"/>
        <div className="gr"/><MsxMonArt run={run} className={`mon${low ? ' low' : ''}`}/>
        <div className="v-party"><small>編成</small>{s.team.map((m, i) => <MsxPf key={i} m={m} bond={s.bond[i]} tagAt={tagAt}/>)}<MsxPf aid={s.aid} bond={s.aidBond} tagAt={tagAt}/></div>
        <div className="v-chips"><span className="v-chip">{MSX_SEASON[cal.season]}・{scn.time}</span>
          {v.period.key !== 'final' ? <span className="v-chip hot">🏆 期末の大会まで {v.period.left}ターン</span> : <span className="v-chip hot">🏆 頂への道</span>}
          {s.yosu && s.yosu.sabori ? <span className="v-chip bad">😪 ようす: サボりグセ</span> : null}
          {s.yosu && s.yosu.utsu ? <span className="v-chip bad">😢 ようす: うつ病</span> : null}
          {s.cond ? <span className="v-chip bad">🤕 {MSX_COND[s.cond.kind]}(あと{s.cond.left})</span> : null}</div>
        <span className="v-nm">{run.nick}<small>方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}</small></span>
        <div className="v-side"><span className="v-mini">🤝 忠誠 <b>{SUC.loyalOf(s)}</b></span><span className="v-mini">⭐ 人気 <b>{s.pop}</b></span></div>
        <button type="button" className="v-bagb" onClick={() => setSub('bag')}>🎒<small>持ち物</small>{bag.length ? <i>{bag.length}</i> : null}</button>
        <button type="button" className="v-bagb r" onClick={() => setSub('stats')}>🔍<small>くわしく</small></button>
      </div>
      <MsxStRow stats={s.stats}/>
      {can.includes('retry') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'retry' })}>🏆 デビュー戦に再挑戦<small>勝つまで訓練はできない(負けるたび相手が少し弱くなる)</small></button></div>
      ) : can.includes('cond') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'cond' })}>🛌 休む<small>{MSX_COND[s.cond && s.cond.kind] || '体調'}のため、このターンは休み</small></button></div>
      ) : (<>
        <div className="v-act" style={{ gridTemplateColumns: '1fr 2.3fr 1fr' }}>
          <button type="button" className="v-p" onClick={() => doAct({ kind: 'rest' })}><div className="e">🛌</div>休む<small>体力を回復</small></button>
          <button type="button" className="v-p main" onClick={() => setSub('train')}>💪 訓練<small>{anyTag ? '🤝 友情タッグのチャンスあり' : '6つの訓練から選ぶ'}</small></button>
          <button type="button" className="v-p" onClick={() => setSub('stats')}><div className="e">📊</div>能力<small>技・型・編成</small>{s.pts ? <span className="bd">能力P {s.pts}</span> : null}</button>
        </div>
        <div className="v-act" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <button type="button" className={`v-p ${yosu ? 'hosp' : 'off'}`} disabled={!can.includes('clinic')} onClick={() => doAct({ kind: 'clinic' })}><div className="e">🏥</div>通院<small>{yosu ? 'ようすを治す' : 'ようすなし'}</small>{yosu ? <span className="bd r">!</span> : null}</button>
          <button type="button" className="v-p" onClick={() => doAct({ kind: 'play' })}><div className="e">🎈</div>遊ぶ<small>体力+・甘え+</small></button>
          <button type="button" className="v-p" onClick={() => (typeof MsxR3 === 'function' ? setSub('shugyo') : setSheet({ soon: '⚔ 修行', text: '技を覚える修行は、次の回で入ります' }))}><div className="e">⚔</div>修行<small>技を覚える</small><span className="bd">準備中</span></button>
          <button type="button" className="v-p" onClick={() => (typeof MsxR3 === 'function' ? setSub('cup') : setSheet({ soon: '🏆 大会', text: '毎月の大会は、次の回で入ります(期末の大会は自動で始まります)' }))}><div className="e">🏆</div>大会<small>今月の大会</small><span className="bd">準備中</span></button>
        </div>
      </>)}
    </>);
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← 中断</button><button type="button" onClick={() => setSheet('log')}>📖 きろく</button><button type="button" onClick={() => setSheet('menu')}>☰ メニュー</button></div>;
    if (sub === 'bag') body = <MsxBag run={run} setRun={setRun} v={v} ev={ev} onClose={() => setSub('main')}/>;
    if (sub === 'stats') body = <MsxStats run={run} setRun={setRun} v={v} ev={ev} onClose={() => setSub('main')}/>;
    if (sub === 'bag' || sub === 'stats') foot = <div className="v-ft"><button type="button" onClick={() => setSub('main')}>← もどる</button></div>;
  }

  return (
    <>
      <MsxHd back="中断" onBack={onPause} sub={`${msxAidName(s.aid)}編`} right={`${s.turn} / ${msxSuc.core.TOTAL_TURNS}ターン`}/>
      <div className="v-body">{body}</div>
      {foot}
      {sheet && (
        <div className="msx-ov msx-fade" onClick={() => setSheet(null)}>
          <div className="msx-sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === 'log' ? <><h3>📖 きろく</h3>{(run.log || []).length ? run.log.slice().reverse().map((l, i) => <div key={i} className="msx-note">{l.turn}ターン目: {l.t}</div>) : <div className="msx-note">まだありません</div>}</>
              : sheet === 'menu' ? <><h3>☰ メニュー</h3>
                <div className="msx-note">育成方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}(褒めると甘く・叱ると厳しくなる)</div>
                <div className="msx-note">成長の型: {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div>
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onPause(); }}>中断する(続きから遊べる)</button>
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onQuit(); }}>この育成をやめる</button></>
              : <><h3>{sheet.soon}<span className="msx-soon">準備中</span></h3><div className="msx-note">{sheet.text}</div></>}
            <button type="button" className="msx-btn" onClick={() => setSheet(null)}>とじる</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---- 持ち物(1ターンに1個まで・ターンは進まない)。中身は芯の s.bag(育成中に使う物の数)と s.carry(はじめる前に効いている物) ----
const MSX_EXTRA_ITEM = Object.freeze({ oil: { e: '🫙', desc: '体力を少し回復する' }, herb: { e: '🌱', desc: 'ストレスを下げる' } });
const msxItemView = (k) => {
  const base = MSX_ITEM_BY_ID[k]; const core = msxSuc && msxSuc.SUC.ITEMS ? msxSuc.SUC.ITEMS[k] : null; const ex = MSX_EXTRA_ITEM[k];
  return { id: k, name: (base && base.name) || (core && core.name) || k, desc: (base && base.desc) || (ex && ex.desc) || '', e: (base && base.e) || (ex && ex.e) || '🎁', during: core ? core.use === 'during' : !!(base && base.when === 'both') };
};
function MsxBag({ run, setRun, v, ev, onClose }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const bagList = Object.keys(s.bag || {}).filter((k) => s.bag[k] > 0).map((k) => ({ ...msxItemView(k), n: s.bag[k] }));
  const carryList = (Array.isArray(s.carry) ? s.carry : []).map((k) => ({ ...msxItemView(k), n: 0, carry: true }));
  const sand = s.items ? (s.items.sand || 0) : 0; const rainbow = s.items ? (s.items.rainbow || 0) : 0;
  const [pick, setPick] = useState(bagList.length ? bagList[0].id : null);
  const usedNow = s.itemTurn === s.turn;
  const t = pick ? bagList.find((x) => x.id === pick) || carryList.find((x) => x.id === pick) : null;
  const use = () => {
    if (!t || t.carry || usedNow || typeof SUC.useItem !== 'function') return;
    const r = SUC.useItem(s, t.id);
    if (!r || !r.out || !r.out.ok) return;
    setRun({ ...run, s: r.state, log: [...(run.log || []), { turn: s.turn, t: `${t.name}を使った` }].slice(-20) });
  };
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene home dk" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg().bg} alt=""/><div className="sh"/>
      <div className="v-bagw">
        <div className="t">🎒 持ち物<small>使えるのは 1ターンに1個まで・使ってもターンは進まない</small><button type="button" onClick={onClose}><i>✕</i></button></div>
        {t ? <div className="v-bsel"><span className="e" style={{ fontSize: 26 }}>{t.e}</span><div><b>{t.name}{t.n ? <span className="yel"> ×{t.n}</span> : null}</b><small>{t.desc}</small><small className="lim">{t.carry ? 'はじめる前から効いている' : 'いつ使える: 自分のターン'}</small></div></div> : null}
        <div className="v-bgrid">
          {bagList.map((x) => <button type="button" key={x.id} className={pick === x.id ? 'sel' : ''} onClick={() => setPick(x.id)}><span className="e" style={{ fontSize: 22 }}>{x.e}</span><i>×{x.n}</i><small>{x.name}</small></button>)}
          {carryList.map((x) => <button type="button" key={`c-${x.id}`} className={`no${pick === x.id ? ' sel' : ''}`} onClick={() => setPick(x.id)}><span className="e" style={{ fontSize: 22 }}>{x.e}</span><small>{x.name}</small></button>)}
          <div className="no"><span className="e">⏳</span><i>×{sand}</i><small>時渡りの砂時計</small></div><div className="no"><span className="e">🌈</span><i>×{rainbow}</i><small>虹の時渡りの砂時計</small></div>
        </div>
        {!bagList.length && !carryList.length ? <div className="msx-note">持ちこんだ物はありません</div> : null}
        <div className="v-bnote">⏳ 時渡りの砂時計: バトルに敗北したときにやり直せる<br/>🌈 虹の時渡りの砂時計: 敗北したとき相手を変えてやり直せる<br/><span className="dim2">(うすい物はここでは使わない。砂時計は大会で負けたときに使う・大会は次の回で入ります)</span></div>
        <button type="button" className="v-big" style={{ fontSize: 14, padding: 9, marginTop: 0, color: '#fff' }} disabled={!t || t.carry || usedNow} onClick={use}>
          {usedNow ? 'このターンはもう使った' : t && !t.carry ? `${t.e} ${t.name}を使う` : '使う'}</button>
      </div>
    </div>
    <MsxStRow stats={s.stats}/>
  </>);
}

// ---- 能力(能力ポイントを振る・忠誠と方針・編成の親密度) ----
function MsxStats({ run, setRun, v, ev, onClose }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const tagAt = (SUC.BOND && SUC.BOND.tag) || 80;
  const spend = (k) => { const r = SUC.spendPts(s, k, 1); if (r.out.ok) setRun({ ...run, s: r.state }); };
  const auto = () => { const r = SUC.autoPts(s); setRun({ ...run, s: r.state }); };
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="msx-scroll">
      <div className="v-card pk"><div className="msx-row" style={{ justifyContent: 'space-between' }}><b className="h2">📊 能力ポイント {s.pts}</b>{s.pts ? <button type="button" className="chip on" onClick={auto}>おまかせで振る</button> : null}</div>
        <div className="msx-note">大会でもらえる。好きな能力へ 1点で +1(期の目安を超えると 2点で +1)</div>
        {MSX_STATS.map((k) => (
          <div key={k} className="msx-row" style={{ marginTop: 5 }}>
            <span style={{ width: 84, fontSize: 12, fontWeight: 900 }}>{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span>
            <span className="bar" style={{ flex: 1 }}><i style={{ width: `${s.stats[k] / 9.99}%` }}/></span>
            <b style={{ width: 34, textAlign: 'right' }}>{s.stats[k]}</b>
            <button type="button" className="chip on" style={{ minWidth: 52 }} disabled={!s.pts || s.pts < SUC.ptsCost(s, k)} onClick={() => spend(k)}>+1<small style={{ fontSize: 8 }}>({SUC.ptsCost(s, k)}点)</small></button>
          </div>
        ))}
      </div>
      <div className="v-card"><div className="h2">🤝 忠誠度 {SUC.loyalOf(s)}<span className="sub">(甘え度 {s.ama}+恐れ度 {s.fear})</span></div>
        <div className="sub">方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}・人気 {s.pop}・Lv {s.lv}・成長の型: {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div></div>
      <div className="v-card"><div className="h2">編成の親密度<span className="sub">(80で友情タッグ)</span></div>
        {s.team.map((m, i) => (
          <div key={i} className="msx-row" style={{ marginTop: 4 }}><MsxPf m={m} bond={s.bond[i]} tagAt={tagAt} cls="sm"/><span style={{ flex: 1, fontSize: 11, fontWeight: 900 }}>{msxMemberName(m)}<small className="sub">{m.kind === 'base' ? ' ベースモン' : ` ${m.rank}`}・得意 {m.top.map((k) => MSX_STAT_NAME[k]).join('・')}</small></span><b>{s.bond[i]}</b></div>
        ))}
        <div className="msx-row" style={{ marginTop: 4 }}><MsxPf aid={s.aid} bond={s.aidBond} tagAt={tagAt} cls="sm"/><span style={{ flex: 1, fontSize: 11, fontWeight: 900 }}>{msxAidName(s.aid)}<small className="sub"> 助手</small></span><b>{s.aidBond}</b></div>
      </div>
      <div className="v-card"><div className="h2">技<span className="msx-soon">準備中</span></div><div className="sub">技と修行は次の回で入ります</div></div>
    </div>
  </>);
}

// ---- イッサ博士(6つから1つ・結果) ----
function MsxIssa({ run, setRun, v, ev, ctx, bondLv, onDone }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const [pick, setPick] = useState('hp');
  const res = run.out && run.out.issa ? run.out.issa : null;
  const metScene = s.issaMet > 0 ? 'issa.meet.again' : 'issa.meet.first';
  const meet = msxPickLine(ctx, metScene, { who: 'issa' });
  const choose = () => {
    const r = SUC.issa(s, pick);
    if (!r.out.ok) { onDone(run); return; }
    setRun({ ...run, s: r.state, out: { issa: r.out, before: s.stats }, log: [...(run.log || []), { turn: s.turn, t: `イッサ博士: ${pick === 'none' ? 'ことわった' : r.out.win ? '成功' : '失敗'}` }].slice(-20) });
  };
  if (res) {
    const k = MSX_ISSA_KEYS.find((x) => x.key === res.choice);
    const said = k ? msxPickLine(ctx, `issa.${res.win ? 'ok' : 'ng'}.${k.line}`, { who: 'issa' }) : msxPickLine(ctx, 'issa.bye', { who: 'issa' });
    const ups = {}; if (run.out.before) MSX_STATS.forEach((x) => { const d = s.stats[x] - run.out.before[x]; if (d) ups[x] = d; });
    return (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src="images/story-bg/monhero_night.jpg" alt=""/><div className="sh" style={{ background: '#0f0d2466' }}/>
        {res.win ? <div className="v-burst"/> : null}
        <img className="v-issa" src={MSX_ISSA_ART} alt="イッサ博士" style={res.win ? undefined : { filter: 'grayscale(.4) brightness(.85)' }}/>
        <MsxMonArt run={run} className="mon" style={{ left: '70%', bottom: '12%', height: '44%' }}/>
        {k ? <div className={`v-stamp msx-pop ${res.win ? '' : 'ng'}`} style={{ top: '3%', fontSize: 40 }}>{res.win ? '大成功!' : '失敗…'}<small>{res.win ? '装置がぴかーっと光った' : '装置から煙が…'}</small></div> : null}
        {said ? <div className="v-ibub" style={{ top: 'auto', bottom: 8, left: 8, right: '44%' }}>「{said.t}」</div> : null}
      </div>
      <MsxStRow stats={s.stats} ups={ups}/>
      <div className="v-log"><span className="hd2">{k ? `${k.icon} ${k.name}` : '🙅 何もしない'}</span><br/>{k ? (res.win ? `⭕ ${k.ok}` : `❌ ${k.ng}`) : 'ことわった'}</div>
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => onDone({ ...run, out: null })}>つぎへ ▶</button></div>
    </>);
  }
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src="images/story-bg/monhero_night.jpg" alt=""/><div className="sh" style={{ background: '#0f0d2466' }}/>
      <img className="v-issa" src={MSX_ISSA_ART} alt="イッサ博士"/>
      <div className="v-machine">⚙️💡<small>のびのび装置</small><MsxMonArt run={run} style={{ height: '46%', aspectRatio: '1', objectFit: 'contain' }}/></div>
      <div className="v-ev-h" style={{ top: 'auto', bottom: 8, borderRadius: '0 99px 99px 0' }}><small>大きな賭け</small>イッサ博士があらわれた!</div>
      <div className="v-ibub">「{meet ? meet.t : 'やっほー! ちょっと強くなってみない?'}」</div>
    </div>
    <div className="v-six">
      {MSX_ISSA_KEYS.map((x) => { const p = SUC.issaRate(s, x.key); const dots = Math.max(1, Math.min(4, Math.round(p * 4))); return (
        <button type="button" key={x.key} className={`v-ix${pick === x.key ? ' sel' : ''}`} onClick={() => setPick(x.key)}>{x.icon} {x.name}
          <span className="pr">成功{[0, 1, 2, 3].map((i) => <i key={i} className={i < dots ? 'on' : ''}/>)}</span><span className="ok">⭕ {x.ok}</span><span className="ng">❌ {x.ng}</span></button>); })}
      <button type="button" className={`v-ix no${pick === 'none' ? ' sel' : ''}`} onClick={() => setPick('none')}>🙅 何もしない<span className="ok" style={{ color: '#cbd5e1' }}>ことわる。損はない</span><span className="ng" style={{ color: '#94a3b8' }}>「えー、ノリ悪いなぁ」</span></button>
    </div>
    <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={choose}>{pick === 'none' ? 'ことわる' : `${(MSX_ISSA_KEYS.find((x) => x.key === pick) || {}).icon} ${(MSX_ISSA_KEYS.find((x) => x.key === pick) || {}).name}を受ける`}</button></div>
  </>);
}
