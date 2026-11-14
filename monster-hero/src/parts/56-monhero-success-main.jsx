// ===== モンヒロサクセス: 育成の画面の本体(メイン・トレーニングを選ぶ・結果・叱る/褒める・イッサ博士・ターンが進む・中断と再開) =====
// 見本: docs/progress/player-raise/mock/png/v3-M・T・K・I.png。大会・修行・引退・合体の中身は回3(ボタンは置いて「準備中」)
// 1ターンの流れ(芯の決まった順): act → (トレーニングなら)react → (来ていれば)issa → endTurn → (大会なら)settle
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

// 音(14-success-sound.jsx の useSuccessSound)。無いときは何もしない(フックの数は変わらない)
const msxUseSound = typeof useSuccessSound === 'function' ? useSuccessSound : () => {};
// 内側(育成中)は場面の曲を切り替えるだけ(後片付けは画面全体の msxUseSound の1か所)
const msxUseScene = typeof useSuccessScene === 'function' ? useSuccessScene : () => {};
// 休む・遊ぶ・通院の結果の場面の曲(表はビート部 data/success-sounds.js。表に無いうちは今の曲のまま)
const MSX_REST_SOUND = Object.freeze({ rest: 'rest', play: 'play', clinic: 'hospital' });
const MSX_RES_SOUND = Object.freeze({ great: 'trainGreat', ok: 'trainOk', fail: 'trainFail', sab: 'trainSkip' });
const msxLayout = () => {
  if (typeof window === 'undefined') return '';
  const w = window.innerWidth; const h = window.innerHeight;
  if (w > h && h < 520) return 'land';
  return w <= 340 ? 's320' : '';
};
// トレーニングの札(芯が6枚の札にしたら 'train:<能力>'、いまは 'light:<能力>')
const msxCardOf = (v, stat) => (v && v.cards ? (v.cards[`train:${stat}`] || v.cards[`light:${stat}`] || null) : null);
const msxMemberName = (m) => (!m ? '' : m.kind === 'base' || !m.name || m.name === m.species ? msxMonName(m.species) : m.name);

// 上の帯の忠誠・人気が変わったときの「+4」は、帯がどの画面で描き直されても続くよう、育成ごとに前の値を覚えておく(2026-11-14 社長「忠誠度と人気を上部に」)
const msxBandMem = { id: null, loy: 0, pop: 0, dl: 0, dp: 0, tl: 0, tp: 0 };
const MSX_BAND_DELTA_MS = 2600;
// hpFrom / stFrom … 休む・遊ぶ・通院の結果で、体力・ストレスの棒を前の値から伸び縮みさせる(2026-11-14 社長「休んだときのゲージの変動がない」)
function MsxBand({ s, v, ev, use = 0, stAdd = 0, hpFrom = null, stFrom = null }) {
  const cal = msxCalendar(s.turn);
  const max = Math.max(1, s.hpMax); const hp = Math.max(0, Math.min(max, s.hp));
  const after = Math.max(0, hp - use);
  const SUCb = msxSuc && msxSuc.SUC;
  const loy = SUCb && typeof SUCb.loyalOf === 'function' ? Math.round(Number(SUCb.loyalOf(s)) || 0) : 0;
  const pop = Math.round(Number(s.pop) || 0);
  const M = msxBandMem; const now = Date.now();
  if (M.id !== s.id) Object.assign(M, { id: s.id, loy, pop, dl: 0, dp: 0, tl: 0, tp: 0 });
  else {
    if (loy !== M.loy) { M.dl = loy - M.loy; M.tl = now; M.loy = loy; }
    if (pop !== M.pop) { M.dp = pop - M.pop; M.tp = now; M.pop = pop; }
  }
  const dTag = (d, t) => (d && now - t < MSX_BAND_DELTA_MS ? <em key={t} className={`v-dl ${d > 0 ? 'up' : 'dn'}`}>{d > 0 ? `+${d}` : d}</em> : null);
  const hpGain = Number.isFinite(hpFrom) ? Math.round(hp - Math.max(0, Math.min(max, hpFrom))) : 0;
  const stGain = Number.isFinite(stFrom) ? Math.round(s.stress - stFrom) : 0;
  const grow = (from, to) => (Number.isFinite(from) && from !== to ? { '--w0': `${Math.max(0, Math.min(100, from))}%`, animation: 'msxBarGrow .9s ease-out both' } : null);
  const pk = msxSuc && typeof msxSuc.SUC.peakInfo === 'function' && !s.over ? msxSuc.SUC.peakInfo(s) : { state: null };
  return (
    <div className="v-band" style={pk.state === 'in' ? { position: 'relative' } : undefined}>
      {pk.state === 'in' ? <span className="v-peakb" data-msx-peak-band={pk.left} style={{ position: 'absolute', left: '50%', top: -7, transform: 'translateX(-50%)', zIndex: 2, whiteSpace: 'nowrap', padding: '1px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 900, color: '#fff7cc', background: 'linear-gradient(90deg,#ea580c,#f59e0b)', boxShadow: '0 0 8px #fb923c' }}>🔥 ピーク中(あと{pk.left}ターン)</span> : null}
      <div className="v-b1">
        <div className="v-turn"><span className="ph">{v.period.name}<small>{cal.year}年目 {cal.month}月</small></span>
          <div className="n">残り<b>{v.period.left}</b>ターン<small>最後まで あと <em>{v.toEnd}</em></small></div></div>
        <div className="v-pow"><div><small>総合力</small><b>{msxFmt(ev.power)}</b></div><i className={`${msxRankCls(ev.rank)} big`}>{ev.rank}</i></div>
      </div>
      <div className="v-b2">
        <div className={`v-ga hp${after < max * 0.3 ? ' low' : ''}`}><span>❤️ 体力</span>
          <div className="tr"><i style={{ width: `${after / max * 100}%`, ...(grow(Number.isFinite(hpFrom) ? hpFrom / max * 100 : NaN, after / max * 100) || {}) }}/>{use ? <u style={{ left: `${after / max * 100}%`, width: `${Math.min(hp, use) / max * 100}%` }}/> : null}{max > 100 ? <s style={{ left: `${100 / max * 100}%` }}/> : null}</div>
          {use ? <em>−{use}</em> : hpGain ? <em className={hpGain > 0 ? 'hl' : ''} data-msx-band-hp-gain>{hpGain > 0 ? `+${hpGain}` : hpGain}</em> : null}<b>{hp}<small className={max > 100 ? 'cap' : ''}>/{max}{max > 100 ? '▲' : ''}</small></b></div>
        <div className="v-ga st"><span>💢 ストレス</span>
          <div className="tr"><i style={{ width: `${s.stress}%`, ...(grow(stFrom, s.stress) || {}) }}/>{stAdd ? <u className="add" style={{ left: `${s.stress}%`, width: `${Math.min(100 - s.stress, stAdd)}%` }}/> : null}</div>
          {stAdd ? <em className="pl">+{stAdd}</em> : stGain ? <em className={stGain < 0 ? 'hl' : 'pl'}>{stGain > 0 ? `+${stGain}` : stGain}</em> : null}<b>{s.stress}<small>/100</small></b></div>
      </div>
      <div className="v-b3" data-msx-band-loy><span>🤝 忠誠 <b>{loy}</b>{dTag(M.dl, M.tl)}</span><span>⭐ 人気 <b>{pop}</b>{dTag(M.dp, M.tp)}</span></div>
    </div>
  );
}
// ups … 上がった(下がった)分。stats は変わったあとの値。preview … トレーニングを選ぶ画面の見込み(まだ上がっていない)
//   結果の画面では、上がる前の長さからゲージが伸び、伸びた分が光る(下がるときは縮み、減った分が赤く消える。2026-11-13 社長)。
//   「動きを減らす」設定では、はじめから変わったあとの長さで出す
function MsxStRow({ stats, ups, main, preview = false }) {
  const grow = Boolean(ups) && !preview && MSX_STATS.some((k) => ups[k]);
  const calm = typeof msxFxCalm === 'function' && msxFxCalm();
  const sig = grow ? MSX_STATS.map((k) => `${stats[k]}:${ups[k] || 0}`).join('|') : '';
  const [on, setOn] = useState(!grow || calm);
  const [zout, setZout] = useState(!grow || calm);
  useEffect(() => {
    if (!grow || calm) { setOn(true); setZout(true); return undefined; }
    setOn(false); setZout(false); let a = 0; let b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setOn(true)); });
    const z = setTimeout(() => setZout(true), 2600);
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); clearTimeout(z); };
  }, [sig]);
  // 数字も上がる前から数え上げる(0.25秒待って0.9秒で)
  const [t, setT] = useState(grow && !calm ? 0 : 1);
  useEffect(() => {
    if (!grow || calm) { setT(1); return undefined; }
    setT(0); let id = 0; const t0 = performance.now() + 250;
    const step = (now) => { const x = Math.max(0, Math.min(1, (now - t0) / 900)); setT(x); if (x < 1) id = requestAnimationFrame(step); };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [sig]);
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const pct = (n) => `${Math.max(0, Math.min(100, n / 9.99))}%`;
  // 伸びる間だけ札を拡大し、上がる前の値の近くから拡大した目盛りで伸ばす(2026-11-13 社長 A 案)。約2.6秒で 0〜999 の目盛りへ戻す
  // 2026-11-14 社長「ステータスの上がるゲージの変動がへん」: 2.6秒で 0〜999 の目盛りへ戻すと、棒が一気に縮んで下がったように見えた。
  // 拡大した目盛り(両はしの数字つき)は結果のあいだずっと使い、2.6秒で戻すのは札の持ち上がりだけにする
  const zoomA = grow && !calm && !zout; // 札が持ち上がっている
  const zoomS = grow && !calm;          // 棒は拡大した目盛りで描く
  return (
    <div className={`v-st${grow ? ' grow' : ''}${grow && on ? ' on' : ''}${grow && !calm ? ' gs-a' : ''}${zoomA ? ' zin' : ''}${zoomS ? ' zs' : ''}${zoomA && MSX_STATS.filter((k) => ups[k]).length > 3 ? ' many' : ''}`} data-msx-st-grow={grow ? (on ? 'on' : 'pre') : undefined}>
      {MSX_STATS.map((k) => {
        const u = ups ? (ups[k] || 0) : 0;
        const after = stats[k]; const before = Math.max(0, after - (grow ? u : 0));
        // 案A: 上がる前の値の近くから、拡大した目盛り(1目盛り=10)で伸ばす
        const span = Math.max(60, Math.ceil(Math.abs(u) * 2.6 / 10) * 10);
        const lo = Math.max(0, Math.min(999 - span, Math.floor((Math.max(after, before) - span * 0.82) / 10) * 10));
        const zp = (n) => (zoomS && u ? `${Math.max(0, Math.min(100, (n - lo) / span * 100))}%` : pct(n));
        const tick = zoomS && u ? { backgroundSize: `${1000 / span}% 100%` } : undefined;
        // 棒も数字と同じ値(数え上げの途中の値)から描く。数字と長さがいつも合う
        const cur = grow && u ? before + (after - before) * ease(t) : after;
        return (<div key={k} className={`${u > 0 ? 'up' : u < 0 ? 'dn' : ''}${k === main ? ' main' : ''}`}>
          <small>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</small><b>{grow && u ? Math.round(before + (after - before) * ease(t)) : stats[k]}</b>
          {grow && u ? <u className="g" style={tick}><i style={{ width: zp(u > 0 ? cur : after) }}/>{u > 0 ? <s className="gu" style={{ left: zp(before), width: `calc(${zp(cur)} - ${zp(before)})` }}/> : <s className="gd" style={{ left: zp(after), width: `calc(${zp(before)} - ${zp(after)})` }}/>}{zoomS ? <q className="zl"><span>{lo}</span><span>{lo + span}</span></q> : null}</u>
            : <u><i style={{ width: pct(after) }}/></u>}
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
// 育てるモンスターの絵。live のときは演出の部品 MsxLiveMon(#5752・待機のぴょこぴょこ・気分・反応)を箱いっぱいに置く。
//   部品が無いときは絵だけ(live なら CSS で小さく弾む .msx-hop)。箱の大きさは className / style で決まる
const msxMoodOf = (s) => {
  if (!s) return 'calm';
  if (typeof msxFxMoodOf === 'function') { try { const m = msxFxMoodOf(s); if (m) return m; } catch (e) {} }
  const r = s.hpMax > 0 ? s.hp / s.hpMax : 1;
  if (s.yosu && s.yosu.utsu) return 'sad';
  if (r < 0.3) return 'tired';
  if (s.stress >= 60) return 'sulky';
  if (r >= 0.85 && s.stress < 20) return 'joy';
  return 'calm';
};
// noPeak … トレーニング・修行の演出の場面では、ピークの炎を出さない(2026-11-14 社長「トレーニング中は炎を消す」。動きが見やすいように)
function MsxMonArt({ run, className, style, live = false, react = null, noPeak = false }) {
  const sp = run.s.species;
  // 覚醒・超覚醒のキラ(56-monsuc-awake.jsx)と前触れの光。どちらも無ければ前と同じ形のまま
  const kira = typeof msxKiraOf === 'function' ? msxKiraOf(run.s.awake) : null;
  const omen = run.s.omen && typeof MsxOmenFx === 'function' ? run.s.omen.k : 0;
  // 成長のピーク中は燃え上がる(56-monsuc-awake.jsx の MsxPeakFx。キラと重なっても両方見える)
  const peak = !noPeak && typeof MsxPeakFx === 'function' && msxSuc && typeof msxSuc.SUC.peakInfo === 'function' && !run.s.over && msxSuc.SUC.peakInfo(run.s).state === 'in';
  if ((kira || omen || peak) && typeof MsxKira === 'function') {
    const scn = msxSceneBg(run.s.turn);
    const inner = live && typeof MsxLiveMon === 'function'
      ? <MsxLiveMon species={sp} colors={run.colors} mood={msxMoodOf(run.s)} season={scn.season} time={scn.time === '昼' ? 'day' : scn.time === '夕方' ? 'evening' : 'night'} react={react} seed={run.id} pyoko/>
      : run.colors && run.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
        ? <DyedMonsterImage baseId={sp} src={msxMonImg(sp)} masuColors={run.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
        : <img src={msxMonImg(sp)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>;
    return <span className={`${className || ''}${live ? ' msx-live' : ''}${omen ? ` msx-omen-on k${omen}` : ''}${peak ? ' msx-peakon' : ''}`} style={style} data-msx-mon-kira={kira || ''}>
      {peak ? <MsxPeakFx layer="back"/> : null}<MsxKira kind={kira} src={msxMonImg(sp)} fill>{inner}</MsxKira><MsxOmenFx k={omen}/>{peak ? <MsxPeakFx layer="front"/> : null}</span>;
  }
  if (live && typeof MsxLiveMon === 'function') {
    const scn = msxSceneBg(run.s.turn);
    return <span className={`${className || ''} msx-live`} style={style}><MsxLiveMon species={sp} colors={run.colors} mood={msxMoodOf(run.s)} season={scn.season} time={scn.time === '昼' ? 'day' : scn.time === '夕方' ? 'evening' : 'night'} react={react} seed={run.id} pyoko/></span>;
  }
  const cls = `${className || ''}${live ? ' msx-hop' : ''}`;
  if (run.colors && run.colors.some(Boolean) && typeof DyedMonsterImage === 'function') {
    return <span className={cls} style={style}><DyedMonsterImage baseId={sp} src={msxMonImg(sp)} masuColors={run.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/></span>;
  }
  return <img className={cls} style={style} src={msxMonImg(sp)} alt=""/>;
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
  const [playSub, setPlaySub] = useState('main'); // 育成中の小画面(MsxPlay の sub。β版の説明を出す場面を決める)
  const [tutTurn, setTutTurn] = useState(null); // メインで説明の窓を1つ見たターン(1ターンに1つまで。保存しない)
  // 育成の外(ホーム・ボックス・ランキング・図鑑・始めるまでの準備)の曲(ビート部の表 data/success-sounds.js の menu)。
  // 育成中は MsxPlay が場面の曲を鳴らすので、ここは何もしない(画面を閉じると入る前の曲へ戻る)
  // 後片付け(閉じたら入る前の曲へ)はここの1か所だけ。育成中(play)は MsxPlay が場面の曲を切り替える
  msxUseSound(view === 'play' || view === 'loading' || view === 'fail' ? null : 'menu');
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
  const setRun = (r0) => { const r = r0 && typeof msxBeatMark === 'function' ? msxBeatMark(r0) : r0; setRunState(r); if (r) msxSaveRun(r, !!debug); }; // ビートPを渡した量も持つ(56-monhero-success-store)。デバッグの育成は財布に足さない
  const setMeta = (meta) => { setData((d) => ({ ...d, meta })); msxSaveMeta(meta); };
  // ホームへ戻るときは保存を読み直す(回3の引退で保存枠・meta が書き足されたあと、古い中身で上書きしないように)
  const toHome = () => { msxReadAll(msxSuc.SUC).then((d) => { setData(d); setRunState(d.run); }).catch(() => {}); setView('home'); };

  const startRun = async (cfg) => {
    const { SUC } = msxSuc;
    // フレンドから借りた子は、はじめるときに1回だけ知らせる。断られた(続けて借りすぎ streak・通信の失敗など)ら、借りずにその枠をベースモンで始める
    if (cfg.friendId && typeof monsucLendUse === 'function') {
      let r = null; try { r = await monsucLendUse(cfg.friendId); } catch (e) { r = { ok: false, reason: 'network' }; }
      if (!r || !r.ok) cfg = { ...cfg, team: cfg.team.map((m) => (m && m.friend ? { kind: 'base', species: cfg.baseFill || cfg.species } : m)) };
    }
    const id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    // 持ちこみ: はじめる前に効く物は carry、育成中に使う物は bag(芯の入口・合わせて2つまで)
    const known = (k) => !!(SUC.ITEMS && SUC.ITEMS[k]);
    const carry = cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'before');
    const bag = {}; cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'both').forEach((k) => { bag[k] = 1; });
    const fromMon = cfg.from && typeof cfg.from.box === 'string' ? data.box.mons.find((m) => m.id === cfg.from.box && !m.raised) || null : null; // 未育成の子だけ(育て終えた能力から始まる道を本体でも塞ぐ) // 合体円盤石(未育成)から始めるなら、継いだ間合い適性の段数を写す
    const s = SUC.newRun({ id, species: cfg.species, aid: cfg.aid, team: cfg.team, aidBondLv: cfg.aidBondLv, carry, bag, ...(fromMon && Array.isArray(fromMon.aptBase) ? { aptBase: fromMon.aptBase } : {}), ...(fromMon && Number.isInteger(fromMon.gt) ? { type: fromMon.gt } : {}), ...(fromMon && fromMon.st && typeof fromMon.st === 'object' ? { startSt: fromMon.st } : {}), wonBefore: Array.isArray(data.meta.wonCups) ? data.meta.wonCups : [] });
    const r = { v: 1, id, s, scn: typeof msxScenarioId === 'function' ? msxScenarioId(cfg.scn) : 'hero', nick: cfg.nick, colors: cfg.colors, from: cfg.from, items: cfg.items, used: 0, phase: 'begin', out: null, log: [], startAt: Date.now() };
    const meta = { ...data.meta, team: cfg.teamSlots.map((t) => (t.box ? { box: t.box } : { base: t.base })), runs: (data.meta.runs || 0) + 1, picked: { ...(data.meta.picked || {}), [cfg.species]: ((data.meta.picked || {})[cfg.species] || 0) + 1 } };
    // 持ちこんだ物は1つずつ減らす。芯がまだ知らない物(効き目が無い物)は減らさない
    if (cfg.items.some(known)) { const it = { ...meta.items }; cfg.items.filter(known).forEach((k) => { it[k] = Math.max(0, (it[k] || 0) - 1); if (!it[k]) delete it[k]; }); meta.items = it; }
    setMeta(meta); setRun(r); setView('play');
  };
  const quit = () => setAsk({ text: 'この育成をやめますか? 育てた中身はなくなります(保存枠には入りません)', yes: 'やめる', onYes: async () => { await (typeof msxClearRun === 'function' ? msxClearRun() : storeSet(MSX_KEYS.run, null)); setRunState(null); setView('home'); } });

  let content = null;
  if (view === 'loading') content = <div className="v-body" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}><div className="msx-note">読み込んでいます…</div></div>;
  else if (view === 'fail') content = (<><MsxHd back="とじる" onBack={onClose}/><div className="v-body"><div className="v-card">読み込めませんでした。通信のよいところで、もう一度開いてください</div></div></>);
  else if (view === 'home') content = <MsxHome data={data} run={run} debug={debug} onClose={onClose} onBox={typeof MsxR3Box === 'function' ? () => setView('box') : null} onContinue={() => setView('play')} onNew={() => (run && !run.s.over ? setAsk({ text: '途中の育成があります。新しく始めると、いまの育成はなくなります', yes: '新しく始める', onYes: () => setView('start') }) : setView('start'))} setMeta={setMeta} onWipe={quit} onRank={() => setView('rank')}/>;
  else if (view === 'start') content = <MsxStart data={data} SUC={msxSuc.SUC} onCancel={() => setView('home')} onStart={startRun} bondLvOf={bondLvOf} callNameOf={callNameOf}/>;
  else if (view === 'box' && typeof MsxR3Box === 'function') content = <MsxR3Box onClose={toHome}/>;
  else if (view === 'play' && run) content = <MsxPlay run={run} setRun={setRun} onPause={toHome} onQuit={quit} callNameOf={callNameOf} bondLvOf={bondLvOf} debug={debug} onSub={setPlaySub}/>;
  // β版(56-monsuc-beta.jsx): はじめて開いたときの話・はじめての育成を終えたときの話・育成中の最初の1回だけのみゅあの説明
  const betaCtx = { callName: callNameOf ? callNameOf('mua') : '', bond: Math.max(1, Number(bondLvOf && bondLvOf('mua')) || 1) };
  let betaKeys = null;
  if (view === 'home' && data) {
    const raisedMons = data.box.mons.filter((m) => m && m.raised);
    const lastRaised = raisedMons[raisedMons.length - 1];
    betaKeys = { keys: ['open', raisedMons.length > 0 && !(run && run.s && !run.s.over) && 'firstend'], ctx: { ...betaCtx, mon: lastRaised ? (lastRaised.nick || msxMonName(lastRaised.species)) : undefined } };
  } else if (view === 'play' && run && run.s) {
    const s = run.s; const ph = run.phase;
    // 説明の窓は、その画面で動きが止まってから出す(Fable の点検 ①-12): 演出のあいだ(fx)は出さない/引退の説明は最後の評価の画面だけ(お話・エンディングの上やゲームオーバーでは出さない)/メインは1ターンに1つだけ・トレーニングの説明は選ぶ画面で
    const overReady = s.over !== 'gameover' && !run.arcAfter && !(s.ending && !s.ending.seen);
    const keys = playSub === 'fx' ? null : ph === 'battle' ? [run.out && run.out.r3 ? (run.out.r3.stage === 'rank' ? 'rank' : run.out.r3.stage === 'meal' ? 'meal' : null) : 'match'] /* 賞金ランク UP!・ごはんの段(2026-11-14) */ : s.over || ph === 'over' ? (overReady ? ['retire'] : null) : playSub === 'cup' ? ['cup'] : playSub === 'shugyo' ? ['shugyo'] : playSub === 'train' ? ['train']
      : ph === 'event' || ph === 'story' ? ['event'] : ph === 'awake' ? ['awake'] : ph === 'result' && run.out && run.out.result ? ['result']
        : ph === 'main' && playSub === 'main' && tutTurn !== s.turn ? ['turn', s.hpMax > 0 && s.hp < s.hpMax * 0.5 && 'rest'] : null;
    if (keys) betaKeys = { keys, ctx: { ...betaCtx, mon: run.nick }, onDone: ph === 'main' ? () => setTutTurn(s.turn) : undefined };
  }

  const node = (
    <div className="msx-wrap" data-monhero-success role="dialog" aria-label="モンヒロサクセス">
      <style>{MSX_CSS}</style>
      {typeof MSX_BETA_CSS === 'string' ? <style>{MSX_BETA_CSS}</style> : null}
      {/* ランキングの画面は Tailwind で組まれているので、.msx(ボタンの見た目を初期化している)の外に重ねる */}
      {view === 'rank' && typeof MonsucRankScreen === 'function' ? <MonsucRankScreen onBack={() => setView('home')}/> : null}
      <div className={`msx v3 ${layout}`} data-msx-view={view}>
        {content}
        {betaKeys && !ask && typeof MsxBetaTalk === 'function' ? <MsxBetaTalk keys={betaKeys.keys} ctx={betaKeys.ctx} onDone={betaKeys.onDone}/> : null}
        {ask && <div className="msx-ov msx-fade"><div className="msx-sheet"><div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{ask.text}</div>
          <button type="button" className="msx-btn go" onClick={() => { const f = ask.onYes; setAsk(null); f(); }}>{ask.yes}</button>
          <button type="button" className="msx-btn sub" onClick={() => setAsk(null)}>やめておく</button></div></div>}
      </div>
    </div>
  );
  return typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && typeof document !== 'undefined' ? ReactDOM.createPortal(node, document.body) : node;
}

// ---- はじめの画面(題字ロゴ・続きから・新しく始める・保存枠/ランキング/図鑑の札・デバッグの道具) ----
// 途中の育成があるときは「▶ 続きから」をいちばん大きく、無いときは「新しく育成をはじめる」をいちばん大きく(2026-11-14 社長の選んだ案)
function MsxHome({ data, run, debug, onClose, onContinue, onNew, setMeta, onWipe, onRank, onBox }) {
  const SUC = msxSuc.SUC;
  const s = run && run.s;
  const v = s && !s.over ? SUC.peek(s) : null;
  const [dex, setDex] = useState(false);
  const tiles = [
    onBox ? { key: 'box', e: '📦', name: '保存枠', sub: `${data.box.mons.length}/${data.box.cap}`, on: onBox, attr: { 'data-msx-r3-openbox': true } } : null,
    typeof MonsucRankScreen === 'function' ? { key: 'rank', e: '🏆', name: 'ランキング', on: onRank, attr: {} } : null,
    typeof MsxDex === 'function' ? { key: 'dex', e: '📖', name: 'イベント図鑑', on: () => setDex(true), attr: { 'data-msx-dex-home': true } } : null,
  ].filter(Boolean);
  return (
    <>
      {dex && typeof MsxDex === 'function' ? <MsxDex aid={s ? s.aid : 'mua'} nick={run ? run.nick : ''} onClose={() => setDex(false)}/> : null}
      <MsxHd back="とじる" onBack={onClose}/>
      <div className="v-body v-hm">
        <div className="v-scene hm">
          <img className="bg" src={msxSceneBg(s ? s.turn : 1).bg} alt=""/><div className="sh"/>
          {s ? <><div className="gr"/><MsxMonArt run={run} className="mon"/><span className="v-nm">{run.nick}<small>{msxMonName(s.species)}</small></span></> : null}
          <div className="v-hm-logo"><img src={MSX_LOGO_ART} alt="モンヒロサクセス"/>{typeof MsxBetaMark === 'function' ? <MsxBetaMark/> : null}</div>
        </div>
        {s ? (
          <button type="button" className="v-hm-cont" onClick={onContinue} data-msx-home-cont>
            <span className="t">{s.over ? '▶ 結果を見る' : '▶ 続きから'}</span>
            <span className="d">{run.nick}({msxMonName(s.species)})・{msxAidName(s.aid)}編</span>
            <span className="d2">{s.over ? 'この育成は終わりました(引退の続きから)' : `${v.period.name}・残り${v.period.left}ターン(最後まで あと${v.toEnd})`}</span>
          </button>
        ) : <div className="v-hm-lead">育てるモンスターを選んで、46ターンの育成をはじめよう<small>編成の6体が集まったトレーニングほど、よく伸びる</small></div>}
        <button type="button" className={s ? 'v-hm-new' : 'v-big v-hm-new'} onClick={onNew} data-msx-home-new>🌱 新しく育成をはじめる</button>
        {tiles.length ? (
          <div className="v-hm-tiles">
            {tiles.map((t) => <button key={t.key} type="button" className="v-hm-tile" onClick={t.on} {...t.attr}><span className="e">{t.e}</span><b>{t.name}</b>{t.sub ? <small>{t.sub}</small> : null}</button>)}
          </div>
        ) : null}
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
function MsxPlay({ run, setRun, onPause, onQuit, callNameOf, bondLvOf, debug, onSub }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const v = useMemo(() => SUC.peek(s), [s]);
  const ev = useMemo(() => SUC.evaluate(s), [s]);
  const [sub, setSub] = useState('main');
  const [sel, setSel] = useState(null);
  // トレーニングを選ぶ画面: 場面か丸いボタンの列を左右にスライドすると、となりのトレーニングに替わる(2026-11-14 社長「スライドでも動くようにして」)。
  //   左へスライドで次・右へで前。端で止める。横に 48px 以上、しかも縦の動きより大きいときだけ替える(縦のスクロールやタップの邪魔をしない)
  const swipeRef = useRef(null);
  const [swipe, setSwipe] = useState({ n: 0, dir: 0 });
  useEffect(() => () => { if (onSub) onSub('main'); }, []);
  // 期の区切りの演出(56-monsuc-kifx.jsx)を見終えたターン(保存しない。読み直したときはもう一度出る)
  const [kiAt, setKiAt] = useState(null);
  // トレーニングしている場面(56-monsuc-actfx.jsx)をまだ見せていないターン。押した直後だけ立てる(読み直したときは出さない・保存しない)
  const [actAt, setActAt] = useState(null);
  // 押す前の育成(演出のあいだ、上の帯に結果を先に見せない。Fable の点検 ①-11。保存しない)
  const [actFrom, setActFrom] = useState(null);
  const [sheet, setSheet] = useState(null); // 'log' | 'menu' | 'dex'
  const [detail, setDetail] = useState(false); // 場面の「くわしく」= モンスターの詳細(見るだけ)。「能力」とは別の画面(2026-11-14 社長「役割で分ける」)
  // 期末の大会・最後の大会の当日(2026-11-14 社長「参考資料どおりに」・参考 te-30〜34): 芯が battle を立てても、すぐ組み合わせ表へは行かない。
  //   ① 当日のメイン(ボタンは「能力」と「大会(本番)」だけ)→ ② 受付に1つだけ → ③ 参加の確認 →「はい」で ④ 紋章の入り → ⑤ 表(MsxR3Battle)
  //   「はい」を押した大会だけ preAt に持つ(保存しない。読み直したら当日のメインからもう一度)。やり直し・デビュー戦の再挑戦・勝ち負けのあとは挟まない
  const [preAt, setPreAt] = useState(null);
  const [preDesk, setPreDesk] = useState(false);
  const preB = run.phase === 'battle' && s.battle && s.battle.kind !== 'cup' ? s.battle : null;
  const preKey = preB ? `${s.turn}|${preB.kind}|${preB.round || 0}` : null;
  const preOn = !!(preB && typeof MsxR3PreDesk === 'function' && !preB.retry && !preB.again && !(run.out && run.out.r3) && !run.r3skip && preAt !== preKey);
  const [, setScriptTick] = useState(0);
  // 台本(共通 + 助手の分)を読む。読み終わったら描き直して台詞を出す
  useEffect(() => { let alive = true; msxScriptLoad(s.aid).then(() => { if (alive) setScriptTick((n) => n + 1); }); return () => { alive = false; }; }, [s.aid]);
  // 演出のあいだは演出の場面の音(2026-11-14 社長「演出に音を」)。トレーニングの結果の音は、演出が終わって結果の字が出たときに鳴らす
  const actOn = run.phase === 'result' && actAt === s.turn && typeof MsxTrainAct === 'function';
  const kiOn = run.phase === 'turn' && typeof MsxKiShow === 'function' && v.period && v.period.at === 1 && v.period.index > 0 && kiAt !== s.turn;
  // 大会(試合)・修行・決着・引退は、その画面(56-monhero-success-r3-*.jsx)が自分で場面の音を鳴らす。ここで main を鳴らすと後から上書きするので何もしない
  const childSound = typeof MsxR3 === 'function' && ((run.phase === 'battle' && !preOn) || run.phase === 'over' || !!s.over || sub === 'cup' || sub === 'shugyo');
  // トレーニングを選ぶ画面は育成中の曲のまま。「◯◯をする」を押して動きが始まってからトレーニングの曲(2026-11-14 社長)。結果の場面は曲を替えないので、メインへ戻るまで続く
  const soundId = childSound ? null : actOn ? 'training' : kiOn ? 'kiShow' : run.phase === 'awake' && run.out && run.out.fire && typeof MsxAwakeShow === 'function' ? 'awakeShow' : run.phase === 'awake' && run.out && run.out.fire ? (run.out.fire.kind === 2 ? 'trainGreat' : 'trainLvUp') : run.phase === 'result' && run.out && MSX_REST_SOUND[run.out.kind] ? MSX_REST_SOUND[run.out.kind] : run.phase === 'result' && run.out && run.out.result ? MSX_RES_SOUND[run.out.result] : run.phase === 'issa' ? 'issa' : s.over === 'gameover' ? 'gameOver' : 'main';
  msxUseScene(soundId, { season: msxCalendar(s.turn).season });
  // 演出のあいだは「fx」と知らせて、説明の窓を出さない(結果が出てから出す。Fable ①-12)
  useEffect(() => { if (onSub) onSub(actOn || kiOn ? 'fx' : sub); }, [sub, actOn, kiOn]);
  // トレーニングLvが上がった回は、結果の音のあとに Lv アップの音を続ける(演出が終わって結果の字が出てから)
  const lvUpSe = run.phase === 'result' && !actOn && run.out && run.out.result && run.out.lvUp;
  useEffect(() => {
    if (!lvUpSe || typeof SuccessSound === 'undefined') return undefined;
    const id = setTimeout(() => { try { SuccessSound.se('trainLvUp'); } catch (e) { /* 鳴らせなくても進む */ } }, 650);
    return () => clearTimeout(id);
  }, [lvUpSe, s.turn]);
  const tagAt = (SUC.BOND && SUC.BOND.tag) || 80;
  const bondLv = bondLvOf ? Number(bondLvOf(s.aid)) || 1 : 1;
  if (typeof msxCurBondLv !== 'undefined') msxCurBondLv = bondLv; // 受付・試合・結果の台詞も同じ親密度の段で引く(56-monhero-success-r3-store.jsx)
  const ctx = { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick, species: s.species, callName: callNameOf ? callNameOf(s.aid) : '', bond: bondLv };
  const line = (scene, fallback, extra = {}) => { const l = msxPickLine({ ...ctx, ...extra }, scene, { bondLv }); return l || { t: fallback, e: 'normal' }; };
  const pushLog = (r, text) => ({ ...r, log: [...(r.log || []), { turn: s.turn, t: text }].slice(-20) });

  // 次の段へ
  const endTurnFlow = (r0) => {
    // 最後の期に当たった覚醒の前触れは、ターンを閉じる前に起きる(芯の awakeOpen 'end')
    if (typeof SUC.awakeOpen === 'function') { const a = SUC.awakeOpen(r0.s, 'end'); if (a.out.fire) { setRun({ ...r0, s: a.state, phase: 'awake', out: { fire: a.out.fire, then: 'end' } }); return; } }
    const r = SUC.endTurn(r0.s);
    if (!r.out.ok) { setRun({ ...r0, phase: 'main', out: null }); return; }
    const st = r.state;
    if (st.battle) setRun({ ...r0, s: st, phase: 'battle', out: null });
    else if (st.over) setRun({ ...r0, s: st, phase: 'over', out: null });
    else setRun({ ...r0, s: st, phase: 'turn', out: { from: r0.s.turn } });
  };
  // トレーニングの結果のあと: 編成の出来事(ランダムイベント 'after')→ イッサ博士 → ターンを閉じる
  const afterIssa = (r0) => { const p = SUC.peek(r0.s); if (p.issa) setRun({ ...r0, phase: 'issa', out: null }); else endTurnFlow(r0); };
  const afterAct = (r0) => {
    if (SUC.events && r0.s.last && r0.s.last.kind === 'train') {
      const o = SUC.events.open(r0.s, 'after');
      if (o.out && o.out.ev) { setRun({ ...r0, s: o.state, phase: 'event', out: { ev: o.out.ev, slot: 'after' } }); return; }
      r0 = { ...r0, s: o.state };
    }
    afterIssa(r0);
  };
  // ターンのはじめ: 助手の連続イベント(芯の peek().story)→ ランダムイベント('start')→ メイン
  const toMain = (r0, skipStory = false) => {
    // 覚醒・超覚醒: 前のターンの前触れならここで起きる・このターンのくじを引く(前触れは保存に残る。芯の awakeOpen 'start')
    if (typeof SUC.awakeOpen === 'function' && !r0.s.over) {
      const a = SUC.awakeOpen(r0.s, 'start');
      if (a.out.fire) { setRun({ ...r0, s: a.state, phase: 'awake', out: { fire: a.out.fire, then: 'main' } }); return; }
      r0 = { ...r0, s: a.state };
    }
    const p = SUC.peek(r0.s);
    if (!skipStory && p.story != null && typeof SUC.storyStep === 'function') { setRun({ ...r0, phase: 'story', out: { ep: p.story } }); return; }
    if (SUC.events && !r0.s.over) {
      const o = SUC.events.open(r0.s, 'start');
      if (o.out && o.out.ev) { setRun({ ...r0, s: o.state, phase: 'event', out: { ev: o.out.ev, slot: 'start' } }); return; }
      r0 = { ...r0, s: o.state };
    }
    setRun({ ...r0, phase: 'main', out: null });
  };
  const doAct = (a) => {
    const r = SUC.act(s, a);
    if (!r.out.ok) return;
    setSub('main'); setSel(null);
    let next = { ...run, s: r.state, out: { ...r.out, kind: a.kind, hpFrom: Number.isFinite(s.hp) ? s.hp : null, stFrom: Number.isFinite(s.stress) ? s.stress : null } };
    if (a.kind === 'retry') { endTurnFlow(next); return; }
    const text = r.out.result ? `${MSX_STAT_NAME[a.stat] || ''}のトレーニング: ${MSX_RES[r.out.result].word}` : a.kind === 'rest' ? '休んだ' : a.kind === 'play' ? '遊んだ' : a.kind === 'clinic' ? '通院した' : '休み';
    next = pushLog(next, text);
    if (r.out.result && typeof MsxTrainAct === 'function') { setActAt(r.state.turn); setActFrom(s); }
    setRun({ ...next, phase: 'result' });
  };

  const phase = run.phase;
  let body = null; let foot = null;
  // はじめたばかりの育成は、1ターン目のはじめの出来事を立ててからメインへ(描いている途中で保存を書き換えないよう、あとで1回だけ)
  // 期のはじめの控え run.ki(期の区切りの演出で、期のあいだに増えた賞金と総合力を出す)もここで1回だけ取る
  useEffect(() => { if (run.phase === 'begin') toMain({ ...run, out: null, ki: run.ki || { p: 0, fame: Number.isFinite(run.s.fameTotal) ? run.s.fameTotal : 0, power: SUC.evaluate(run.s).power } }); }, [run.phase]);
  if (phase === 'begin') return <><MsxHd back="中断" onBack={onPause}/><div className="v-body"/></>;
  // 回3(大会・修行・引退・ゲームオーバー・保存枠)の画面 MsxR3 が入っていれば、そちらへ渡す(回3の担当と決めた口)。
  //   MsxR3 はヘッダ・帯・v-body・v-ft まで自分で出す。修行・大会の受付は act のあと onActed(next) でこちらの流れ(叱る/褒める・博士・ターンを閉じる)へ戻す
  const r3 = typeof MsxR3 === 'function' ? (phase === 'battle' && !preOn ? 'battle' : phase === 'battle' ? null : (phase === 'over' || s.over) ? 'over' : sub === 'cup' ? 'cup' : sub === 'shugyo' ? 'shugyo' : null) : null;
  // 期末の大会の受付と参加の確認(②③)。「はい」で表の画面(MsxR3Battle)へ
  if (preOn && preDesk) return <MsxR3PreDesk run={run} v={v} ev={ev} onBack={() => setPreDesk(false)} onGo={() => { setPreDesk(false); setPreAt(preKey); }}/>;
  if (r3) return <MsxR3 kind={r3} run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} debug={debug}
    onBack={() => setSub('main')} onPause={onPause} onQuit={onQuit}
    onActed={(next) => { setSub('main'); afterAct(next); }}/>;
  const bandProps = {};

  // ---- 結果 ----
  if (phase === 'result' && run.out) {
    const o = run.out; const isTrain = !!o.result;
    const R = isTrain ? MSX_RES[o.result] : null;
    const acting = isTrain && actAt === s.turn && typeof MsxTrainAct === 'function';
    const hpLost = isTrain && Number.isFinite(o.hpFrom) && Number.isFinite(s.hp) ? Math.max(0, Math.round(o.hpFrom - s.hp)) : 0;
    const tlv = isTrain && Number.isFinite(o.trainLv) ? o.trainLv - (o.lvUp ? 1 : 0) : 1;
    const gains = o.gain || {};
    const members = o.card && Array.isArray(o.card.members) ? o.card.members.map((i) => s.team[i]).filter(Boolean) : [];
    const restName = o.rest && SUC.REST ? (SUC.REST.find((x) => x.key === o.rest) || {}).name : null;
    const say = isTrain ? line(o.result === 'sab' ? 'turn.result.slack' : `turn.result.${o.result}`, '') : o.kind === 'rest' ? line(`turn.rest.${o.rest === 'poor' ? 'little' : o.rest === 'great' ? 'deep' : 'normal'}`, '') : o.kind === 'play' ? line('turn.play', '') : o.kind === 'clinic' ? line((o.cured || []).length ? 'turn.clinic.cured' : 'turn.clinic.again', '') : { t: '' };
    const evMember = o.event && Number.isInteger(o.event.who) ? s.team[o.event.who] : null;
    const evLine = o.event ? (o.event.story ? ((typeof msxCheerType === 'function' && msxPickLine({ ...ctx, cheer: msxMemberName(evMember) }, `cheer.${msxCheerType(evMember)}.ep${o.event.story}`, { who: 'narr' })) || msxPickLine({ ...ctx, cheer: msxMemberName(evMember) }, `cheer.base.ep${o.event.story}`, { who: 'narr' })) : msxPickLine({ ...ctx, cheer: msxMemberName(evMember) }, `cheer.lot.${MSX_LOT[o.event.lottery] || 'friend'}`, { who: '*' })) : null;
    const hpUp = !isTrain && Number.isFinite(o.hpFrom) && Number.isFinite(s.hp) ? Math.round(s.hp - o.hpFrom) : 0;
    const stDown = !isTrain && Number.isFinite(o.stFrom) ? Math.round(o.stFrom - s.stress) : 0;
    const bandS = acting && actFrom ? actFrom : null; // 演出のあいだは押す前の値
    body = (<>
      {bandS ? <MsxBand s={bandS} v={SUC.peek(bandS)} ev={SUC.evaluate(bandS)}/> : <MsxBand s={s} v={v} ev={ev} {...(isTrain ? {} : { hpFrom: o.hpFrom, stFrom: o.stFrom })}/>}
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={`images/story-bg/${isTrain ? R.bg : 'monhero_plaza'}.jpg`} alt=""/><div className="sh"/>
        {acting ? <MsxTrainAct key={`act-${s.turn}`} run={run} o={o} onDone={() => { setActAt(null); setActFrom(null); }}/> : null}
        {acting ? null : isTrain && o.result === 'great' ? <div className="v-burst"/> : isTrain && o.result === 'ok' ? <div className="v-burst b2"/> : null}
        <div className="gr" style={{ left: '62%', bottom: 'calc(14% - 5px)' }}/>
        {acting ? null : <MsxMonArt run={run} className="mon" live={typeof MsxLiveMon === 'function'} react={isTrain ? { kind: o.result, id: s.turn } : null} style={{ left: '62%', bottom: '14%', height: '46%', transform: o.result === 'sab' ? 'translateX(-50%) rotate(84deg)' : o.result === 'fail' ? 'translateX(-50%) rotate(-12deg)' : 'translateX(-50%) rotate(6deg)', filter: o.result === 'fail' ? 'grayscale(.5) drop-shadow(0 8px 5px #0009)' : undefined }}/>}
        {acting ? null : <div className={`v-stamp msx-pop ${isTrain ? R.cls : 'ok'}`}>{isTrain ? R.word : o.kind === 'rest' ? (restName || '休んだ') : o.kind === 'play' ? '遊んだ!' : o.kind === 'clinic' ? '通院' : '休み'}
          {isTrain && o.card && o.card.tags && o.card.tags.length ? <small>🤝 友情タッグ ×{o.card.tags.length}{o.result === 'great' ? '・伸び ×1.5' : ''}</small> : null}</div>}
        {!acting && members.length ? <div className="v-chips" style={{ top: 'auto', bottom: 8 }}>{members.map((m, i) => <span key={i} className="v-chip">{msxMemberName(m)} 親密度 +{(SUC.BOND && SUC.BOND.train) || 8}</span>)}</div> : null}
      </div>
      {isTrain ? <MsxStRow stats={s.stats} ups={acting ? null : gains} main={o.card && o.card.stat}/> : null}
      {acting ? <div className="v-log" style={{ opacity: .35 }}><span className="hd2">{msxTrainIcon(o.card.stat, tlv)} {msxTrainName(o.card.stat, tlv)}をしている…</span></div> : <div className="v-log">
        {isTrain && o.lvUp ? <div className="v-lvup">⬆ トレーニングLvアップ! {MSX_STAT_ICON[o.card.stat]} {MSX_STAT_NAME[o.card.stat]} <b>Lv.{o.trainLv - 1} → Lv.{o.trainLv}</b><small>次から、{MSX_STAT_NAME[o.card.stat]}のトレーニングの基本の伸びが上がる</small></div> : null}
        {isTrain ? <><span className="hd2">{msxTrainIcon(o.card.stat, tlv)} {msxTrainName(o.card.stat, tlv)}({MSX_STAT_NAME[o.card.stat]}のトレーニング)</span><br/>
          {Object.keys(gains).length ? <>{Object.entries(gains).map(([k, g], i) => <span key={k}>{i ? '・' : ''}{MSX_STAT_NAME[k]} <b className="gu">{g > 0 ? `+${g}` : g}</b></span>)}</> : '能力は上がらなかった'}{hpLost ? <><br/><span data-msx-hp-lost>体力が <b style={{ color: '#dc2626' }}>{hpLost}</b> 下がった</span></> : null}</>
          : o.kind === 'rest' || o.kind === 'play' ? <><span className="hd2">{o.kind === 'rest' ? '🛌 休む' : '🎈 遊ぶ'}</span><br/>{hpUp > 0 ? <>体力 <b className="gu" data-msx-rest-hp>+{hpUp}</b></> : '体力が回復した'}{stDown > 0 ? <>・ストレス <b className="gu">−{stDown}</b></> : null}{(o.cured || []).includes('utsu') ? '。ようす「うつ病」が治った' : ''}</>
          : o.kind === 'clinic' ? <><span className="hd2">🏥 通院</span><br/>{(o.cured || []).length ? 'ようすが治った' : '今回は治らなかった。もう1回来れば治る'}{hpUp > 0 ? <>・体力 <b className="gu">+{hpUp}</b></> : null}{stDown > 0 ? <>・ストレス <b className="gu">−{stDown}</b></> : null}</>
          : <><span className="hd2">🛌 休み</span><br/>{MSX_COND[o.cond] || '体調'}のため、このターンは休んだ</>}
        {o.event && typeof MsxTrainEvent !== 'function' ? <><br/><b className="ga">{msxMemberName(evMember)}</b>{o.event.story ? `との出来事 第${o.event.story}話` : 'との小さな出来事'}{evLine ? `: ${evLine.t}` : ''}</> : null}
        {o.cond && isTrain ? <><br/><b style={{ color: '#fca5a5' }}>{MSX_COND[o.cond]}</b>をしてしまった…しばらく休み</> : null}
      </div>}
      {!acting && say && say.t ? <MsxSay aid={s.aid} ex={say.e || 'normal'} text={say.t}/> : null}
    </>);
    // 編成のモンスターとの出来事があれば、結果のあとに場面を1枚挟む(56-monsuc-tevent.jsx。とばすと飛ぶ)
    const tev = isTrain && o.event && typeof MsxTrainEvent === 'function';
    foot = <div className="v-ft"><button type="button" onClick={() => (isTrain ? afterAct({ ...run, phase: 'main' }) : afterAct(run))}>⏩ とばす</button><button type="button" className="go" onClick={() => (tev ? setRun({ ...run, phase: 'tevent' }) : isTrain ? setRun({ ...run, phase: 'react' }) : afterAct(run))}>つぎへ ▶</button></div>;
  }
  // ---- トレーニングのあとの出来事の場面(56-monsuc-tevent.jsx) ----
  else if (phase === 'tevent' && run.out && run.out.event && typeof MsxTrainEvent === 'function') {
    body = <><MsxBand s={s} v={v} ev={ev}/><MsxTrainEvent key={`${s.turn}-tev`} run={run} o={run.out} ctx={ctx}/></>;
    foot = <div className="v-ft"><button type="button" onClick={() => afterAct({ ...run, phase: 'main' })}>⏩ とばす</button><button type="button" className="go" onClick={() => setRun({ ...run, phase: 'react' })} data-msx-tev-next>つぎへ ▶</button></div>;
  }
  // ---- 覚醒・超覚醒(56-monsuc-awake.jsx の演出)。終わったら、ターンのはじめならメインへ・ターンの終わりなら閉じる ----
  else if (phase === 'awake' && run.out && run.out.fire && typeof MsxAwakeShow === 'function') {
    const f = run.out.fire; const then = run.out.then;
    const done = () => { if (typeof msxSeenMark === 'function') msxSeenMark(f.kind === 2 ? 'aw.super' : 'aw.awake'); const next = pushLog({ ...run, out: null }, f.kind === 2 ? '超覚醒した!' : '覚醒した!'); if (then === 'end') endTurnFlow({ ...next, phase: 'main' }); else toMain(next); };
    body = <MsxAwakeShow key={`${s.turn}-${f.kind}`} run={run} fire={f} v={v} ev={ev} line={line}/>;
    foot = <div className="v-ft"><button type="button" className="go" onClick={done} data-msx-awake-next>つぎへ ▶</button></div>;
  }
  // ---- 出来事(ランダムイベント・助手の連続イベント) ----
  else if ((phase === 'event' && run.out && run.out.ev) || (phase === 'story' && run.out && run.out.ep != null)) {
    body = <MsxEvent run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv}
      onDone={(r) => { const slot = run.phase === 'event' ? run.out.slot : 'story'; const next = { ...r, out: null }; if (slot === 'after') afterIssa(next); else if (slot === 'story') toMain(next, true); else setRun({ ...next, phase: 'main' }); }}/>;
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
        <div style={{ fontSize: 10.5, color: '#cbd5e1', fontWeight: 700, marginTop: 4 }}>忠誠度 {loy} = 甘え度 {s.ama} + 恐れ度 {s.fear}。甘すぎるとサボりやすく、厳しすぎるとストレスがたまりやすい</div>
        {ask && ask.t && ask.t !== 'ほめてあげる?' && ask.t !== 'どうする?' ? <div className="msx-note" style={{ marginTop: 4 }}>{msxAidName(s.aid)}「{ask.t}」</div> : null}</div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => choose(null)}>⏩ とばす</button><button type="button" className="on" disabled>えらんでね</button></div>;
  }
  // ---- イッサ博士 ----
  else if (phase === 'issa') {
    body = <MsxIssa run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} onDone={(r) => endTurnFlow({ ...r, phase: 'main', out: null })}/>;
  }
  // ---- ターンが進む ----
  else if (phase === 'turn' && typeof MsxKiShow === 'function' && v.period.at === 1 && v.period.index > 0 && kiAt !== s.turn) {
    const doneKi = () => { setKiAt(s.turn); setRun({ ...run, ki: { p: v.period.index, fame: Number.isFinite(s.fameTotal) ? s.fameTotal : 0, power: ev.power } }); };
    body = <><MsxBand s={s} v={v} ev={ev}/><MsxKiShow key={`ki-${s.turn}`} run={run} v={v} ev={ev} ki={run.ki} onDone={doneKi}/></>;
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← 中断</button><button type="button" className="go" onClick={doneKi} data-msx-ki-skip>⏩ とばす</button></div>;
  }
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
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← 中断</button><button type="button" className="go" onClick={() => toMain({ ...run, out: null })}>つぎへ ▶</button></div>;
  }
  // ---- 大会(中身は回3) ----
  else if (phase === 'battle' && s.battle && !preOn) {
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
      <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src={msxVenueBg(b.kind === 'summit' ? 'summit' : b.kind === 'debut' ? 'debut' : b.kind === 'pro' ? 'hero' : 'cup')} alt=""/><div className="sh"/>
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
      <div className="v-scene" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/><div className="v-burst b2"/><div className="gr"/><MsxMonArt run={run} className="mon"/>
        <div className="v-stamp ok msx-pop">{s.over === 'gameover' ? 'ここまで…' : s.over === 'lost' ? 'おつかれさま' : '育成おわり!'}<small>総合力 {msxFmt(ev.power)}・ランク {ev.rank}</small></div></div>
      <MsxStRow stats={s.stats}/>
      <div className="v-card"><div className="h2">引退<span className="msx-soon">準備中</span></div><div className="sub">振り返り・育成ランク・保存枠へ入れる画面は次の回で入ります。この育成はこのまま残しておきます</div></div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={onPause}>← もどる</button><button type="button" onClick={onQuit}>この育成を消す</button></div>;
  }
  // ---- トレーニングを選ぶ ----
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
    const swipeOn = {
      style: { touchAction: 'pan-y' },
      onPointerDown: (e) => { swipeRef.current = { x: e.clientX, y: e.clientY, moved: false }; },
      onPointerUp: (e) => {
        const st = swipeRef.current; if (!st) return;
        const dx = e.clientX - st.x; const dy = e.clientY - st.y;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) { swipeRef.current = null; return; }
        st.moved = true; // このあとに来るクリック(ボタンの上で指を離したとき)は選び直しにしない
        const i = MSX_STATS.indexOf(stat); const j = i + (dx < 0 ? 1 : -1);
        if (j < 0 || j >= MSX_STATS.length) return;
        setSel(MSX_STATS[j]); setSwipe((w) => ({ n: w.n + 1, dir: dx < 0 ? 1 : -1 }));
      },
      onPointerCancel: () => { swipeRef.current = null; },
      onClickCapture: (e) => { if (swipeRef.current && swipeRef.current.moved) { e.stopPropagation(); e.preventDefault(); } swipeRef.current = null; },
    };
    body = (<>
      <MsxBand s={s} v={v} ev={ev} {...bandProps}/>
      <div className={`v-scene${swipe.n ? (swipe.dir > 0 ? ' msx-swl' : ' msx-swr') : ''}`} key={`trsw${swipe.n}`} data-msx-train-swipe {...swipeOn} style={{ ...swipeOn.style, flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '30%', bottom: 'calc(38% - 5px)', width: '14%' }}/><MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '38%', height: '16%' }} live/>
        <div className="v-chips" style={{ right: 'auto', left: 7 }}><span className="v-chip ylw" data-msx-train-chip style={{ display: 'block', width: 'max-content', maxWidth: 'calc(50vw - 24px)', whiteSpace: 'normal', lineHeight: 1.2, textAlign: 'left' }}>{msxTrainIcon(stat, trainLv)} {msxTrainName(stat, trainLv)}<small style={{ display: 'block', fontSize: 10, fontWeight: 800, opacity: .85 }}>{MSX_STAT_NAME[stat]}のトレーニング{trainLv ? ` Lv${trainLv}` : ''}</small></span></div>
        <div className="v-come">
          {members.map((i) => { const m = s.team[i]; const tag = s.bond[i] >= tagAt; const eff = SUC.memberEffect(m, stat, SUC.loyalOf(s)); return (
            <div key={i} className={`v-cm${tag ? ' tag' : ''}`}><MsxPf m={m} bond={s.bond[i]} tagAt={999}/>
              <div className="tx"><b>{msxMemberName(m)}</b><small>{tag ? `🤝 タッグ +${m.tag}%` : `編成の効き +${Math.round(eff)}%`}</small><div className="afl">親密度<i><b style={{ width: `${s.bond[i]}%` }}/></i>{s.bond[i]}</div></div></div>); })}
          {card && card.aid ? <div className={`v-cm${s.aidBond >= tagAt ? ' tag' : ''}`}><MsxPf aid={s.aid} bond={s.aidBond} tagAt={999}/><div className="tx"><b>{msxAidName(s.aid)}</b><small>{s.aidBond >= tagAt ? '🤝 タッグ' : '助手も来ている'}</small><div className="afl">親密度<i><b style={{ width: `${s.aidBond}%` }}/></i>{s.aidBond}</div></div></div> : null}
        </div>
        {card && <div className={`v-fx${tags.length ? '' : ' plain'}`}>
          <div className="t">{tags.length ? <span className="big">🤝 友情タッグ ×{tags.length}</span> : <span>タッグなし</span>}<span>効果 ×{card.mult}</span><span className="fl">失敗 <b>{Math.round(card.fail * 100)}%</b></span></div>
          <div className="ch"><span>基本</span><i>▶</i><span>編成 +{Math.round(card.add * 100)}%</span>{tags.length ? <><i>▶</i><span className="tgx">🤝×{tags.length} +{Math.round(card.tag * 100)}%</span></> : null}{pv && pv.gain ? <><i>▶</i><span className="res">{MSX_STAT_NAME[stat]} +{pv.gain[stat] || 0}</span></> : null}</div>
          {trainLv ? <div className="v-lvx"><b>トレーニングLv.{trainLv}</b><i><u style={{ width: `${card.next ? Math.max(0, 100 - card.next * 20) : 100}%` }}/></i><span>{trainLv >= 5 ? 'Lv が いちばん上' : card.next ? `あと${card.next}回で Lvアップ` : ''}</span></div> : null}
        </div>}
      </div>
      <MsxStRow stats={s.stats} ups={pv ? pv.gain : null} main={stat} preview/>
      <div className="v-trs" data-msx-train-swipe-row {...swipeOn}>
        {MSX_STATS.map((k) => { const c = msxCardOf(v, k); const lv = lvOf(c); return (
          <button type="button" key={k} className={`v-tr${c && c.tags.length ? ' tag' : ''}${k === stat ? ' sel' : ''}`} onClick={() => setSel(k)}>
            <div className="o">{MSX_STAT_ICON[k]}</div><b className="nm">{MSX_STAT_NAME[k]}</b><small className="tn">{msxTrainNameParts(k, lv).map((x, i) => <React.Fragment key={i}>{i ? <wbr/> : null}{x}</React.Fragment>)}</small>{lv ? <i className="lv">Lv.{lv}</i> : null}</button>); })}
      </div>
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => { setSub('main'); setSel(null); }}>← もどる</button><button type="button" className="go" disabled={!card} onClick={() => doAct({ kind: card.kind, stat })}>{msxTrainIcon(stat, trainLv)} {msxTrainName(stat, trainLv)}をする</button></div>;
  }
  // ---- メイン ----
  else {
    const can = v.can || [];
    const anyTag = MSX_STATS.some((k) => { const c = msxCardOf(v, k); return c && c.tags.length; });
    const yosu = s.yosu && (s.yosu.sabori || s.yosu.utsu);
    const omenK = s.omen && (s.omen.k === 1 || s.omen.k === 2) ? s.omen.k : 0; // 覚醒の前触れ(助手が気づく)
    const pkI = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : { state: null }; // 成長のピーク(予告は2〜3ターン前)
    const preName = preOn && typeof msxR3BattleName === 'function' ? msxR3BattleName(SUC, preB) : '';
    const sayL = preOn ? line('turn.cup.before', `ついに今日は ${preName}だね! 準備ができたら「大会」へ行こう`, { cup: preName }) : omenK ? line(omenK === 2 ? 'turn.awake.omen2' : 'turn.awake.omen', omenK === 2 ? 'あれ…また体が光ってる？ 虹色だ…' : 'あれ？ 体がうっすら光ってない…？')
      : pkI.state === 'soon' && pkI.in >= 2 && !yosu && !s.cond ? line('turn.peak.soon', 'もうすぐ伸びどきが来そうだよ！') : yosu ? line(s.yosu.sabori ? 'turn.mood.sabori' : 'turn.mood.utsu', 'ようすが気になるね…') : s.cond ? line(`turn.cond.${s.cond.kind === 'away' ? 'runaway' : s.cond.kind === 'ill' ? 'sick' : 'injury'}.in`, '今日は休ませてあげよ') : line(msxStartScene(s), '今月はどうする?');
    const cal = msxCalendar(s.turn); const scn = msxSceneBg(s.turn);
    const low = s.hp < s.hpMax * 0.3;
    const bag = Object.keys(s.bag || {}).filter((k) => s.bag[k] > 0);
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <MsxSay aid={s.aid} ex={omenK ? (sayL.e || 'surprise') : yosu || low ? 'troubled' : (sayL.e || 'happy')} text={sayL.t}/>
      <div className="v-scene home">
        <img className="bg" src={scn.bg} alt=""/><div className="sh"/>
        <div className="gr"/><MsxMonArt run={run} className={`mon${low ? ' low' : ''}`} live/>
        <div className="v-party"><small>編成</small>{s.team.map((m, i) => <MsxPf key={i} m={m} bond={s.bond[i]} tagAt={tagAt}/>)}<MsxPf aid={s.aid} bond={s.aidBond} tagAt={tagAt}/></div>
        <div className="v-chips"><span className="v-chip">{MSX_SEASON[cal.season]}・{scn.time}</span>
          {preOn ? <span className="v-chip hot" data-msx-pre-chip>🏆 {preName} 当日</span> : v.period.key !== 'final' ? <span className="v-chip hot">🏆 期末の大会まで {v.period.left}ターン</span> : <span className="v-chip hot">🏆 頂への道</span>}
          {pkI.state === 'in' ? <span className="v-chip hot" data-msx-peak-chip>🔥 ピーク中 あと{pkI.left}ターン</span> : pkI.state === 'soon' ? <span className="v-chip ylw" data-msx-peak-chip>🔥 もうすぐ伸びどき</span> : null}
          {s.yosu && s.yosu.sabori ? <span className="v-chip bad">😪 ようす: サボりグセ</span> : null}
          {s.yosu && s.yosu.utsu ? <span className="v-chip bad">😢 ようす: うつ病</span> : null}
          {s.cond ? <span className="v-chip bad">🤕 {MSX_COND[s.cond.kind]}(あと{s.cond.left})</span> : null}
          {SUC.events && typeof SUC.events.buffs === 'function' ? SUC.events.buffs(s).slice(0, 2).map((b) => <span key={b.k} className="v-chip ylw">{cardIconNode(b.icon, 14)} {b.name}</span>) : null}</div>
        <span className="v-nm">{run.nick}<small>方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}</small></span>
        <button type="button" className="v-bagb" onClick={() => setSub('bag')}>🎒<small>持ち物</small>{bag.length ? <i>{bag.length}</i> : null}</button>
        <button type="button" className="v-bagb r" data-msx-detail-open onClick={() => setDetail(true)}>🔍<small>くわしく</small></button>
      </div>
      <MsxStRow stats={s.stats}/>
      {preOn ? (
        <div className="v-act v-act-pre" style={{ gridTemplateColumns: '1fr 1.5fr' }} data-msx-pre-main>
          <button type="button" className="v-p" onClick={() => setSub('stats')}><div className="e">📊</div>能力<small>技・型・編成</small>{s.pts ? <span className="bd">能力P {s.pts}</span> : null}</button>
          <button type="button" className="v-p main hb" onClick={() => setPreDesk(true)} data-msx-r3-precup><span className="hbt">本番</span>🏆 大会<small>{preName}</small></button>
        </div>
      ) : can.includes('retry') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'retry' })}>🏆 デビュー戦に再挑戦<small>勝つまでトレーニングはできない(負けるたび相手が少し弱くなる)</small></button></div>
      ) : can.includes('cond') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'cond' })}>🛌 休む<small>{MSX_COND[s.cond && s.cond.kind] || '体調'}のため、このターンは休み</small></button></div>
      ) : (<>
        <div className="v-act" style={{ gridTemplateColumns: '1fr 2.3fr 1fr' }}>
          <button type="button" className="v-p" onClick={() => doAct({ kind: 'rest' })}><div className="e">🛌</div>休む<small>体力を回復</small></button>
          <button type="button" className="v-p main" onClick={() => setSub('train')}>💪 トレーニング<small>{anyTag ? '🤝 友情タッグのチャンスあり' : '6つのトレーニングから選ぶ'}</small></button>
          <button type="button" className="v-p" onClick={() => setSub('stats')}><div className="e">📊</div>能力<small>技・型・編成</small>{s.pts ? <span className="bd">能力P {s.pts}</span> : null}</button>
        </div>
        <div className="v-act" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <button type="button" className={`v-p ${yosu ? 'hosp' : 'off'}`} disabled={!can.includes('clinic')} onClick={() => doAct({ kind: 'clinic' })}><div className="e">🏥</div>通院<small>{yosu ? 'ようすを治す' : 'ようすなし'}</small>{yosu ? <span className="bd r">!</span> : null}</button>
          <button type="button" className="v-p" onClick={() => doAct({ kind: 'play' })}><div className="e">🎈</div>遊ぶ<small>体力+・甘え+</small></button>
          <button type="button" className="v-p" onClick={() => setSub('shugyo')}><div className="e">⚔</div>修行<small>技を覚える</small></button>
          <button type="button" className="v-p" onClick={() => setSub('cup')}><div className="e">🏆</div>大会<small>今月の大会</small></button>
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
      {detail && typeof MsxMonDetail === 'function' ? (() => {
        const pk = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : null;
        const peak = pk && Number.isInteger(pk.from) ? (() => { const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name; return a === b ? a : `${a}〜${b}`; })() : '';
        return <MsxMonDetail species={s.species} name={run.nick} sub={msxMonName(s.species)} art={<MsxMonArt run={run} noPeak/>} st={s.stats} apt={msxAptOf(s.species)} type={s.type} peak={peak}
          grades={typeof SUC.aptGradesOf === 'function' ? SUC.aptGradesOf(s) : null} known={Array.isArray(s.techs) ? s.techs : []} power={ev.power} rank={ev.rank} SUC={SUC} onClose={() => setDetail(false)}/>;
      })() : null}
      {sheet === 'dex' && typeof MsxDex === 'function' ? <MsxDex aid={s.aid} nick={run.nick} onClose={() => setSheet(null)}/> : null}
      {sheet && sheet !== 'dex' && (
        <div className="msx-ov msx-fade" onClick={() => setSheet(null)}>
          <div className="msx-sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === 'log' ? <><h3>📖 きろく</h3>{(run.log || []).length ? run.log.slice().reverse().map((l, i) => <div key={i} className="msx-note">{l.turn}ターン目: {l.t}</div>) : <div className="msx-note">まだありません</div>}</>
              : sheet === 'menu' ? <><h3>☰ メニュー</h3>
                <div className="msx-note">育成方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}(褒めると甘く・叱ると厳しくなる)</div>
                <div className="msx-note">成長の型: {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div>
                {typeof MsxDex === 'function' ? <button type="button" className="msx-btn sub" onClick={() => setSheet('dex')} data-msx-dex-open>📖 イベント図鑑</button> : null}
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onPause(); }}>中断する(続きから遊べる)</button>
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onQuit(); }}>この育成をやめる</button></>
              : null}
            <button type="button" className="msx-btn" onClick={() => setSheet(null)}>とじる</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---- 持ち物(1ターンに1個まで・ターンは進まない)。中身は芯の s.bag(育成中に使う物の数)と s.carry(はじめる前に効いている物) ----
const MSX_EXTRA_ITEM = Object.freeze({ oil: { e: '🫙', desc: '体力を上限の20%回復' }, oilyoil: { e: '🛢️', desc: '体力を上限の40%回復' }, herb: { e: '🌱', desc: 'ストレス −20' },
  // 大会の賞品(2026-11-13 大会の第2版)。使ったターンのあいだだけ効く
  elixir0: { e: '🧪', desc: '使ったターンの修行で、零の間合いの技を覚える率 +20' },
  elixir1: { e: '🧪', desc: '使ったターンの修行で、近の間合いの技を覚える率 +20' },
  elixir2: { e: '🧪', desc: '使ったターンの修行で、中の間合いの技を覚える率 +20' },
  elixir3: { e: '🧪', desc: '使ったターンの修行で、遠の間合いの技を覚える率 +20' },
  fruit_life: { e: '🍎', desc: '使ったターンのトレーニングで、ライフの伸び ×1.5' },
  fruit_pow: { e: '🍖', desc: '使ったターンのトレーニングで、ちからの伸び ×1.5' },
  fruit_wise: { e: '🫐', desc: '使ったターンのトレーニングで、かしこさの伸び ×1.5' },
  fruit_hit: { e: '🍊', desc: '使ったターンのトレーニングで、命中の伸び ×1.5' },
  fruit_eva: { e: '🍇', desc: '使ったターンのトレーニングで、回避の伸び ×1.5' },
  fruit_tough: { e: '🥥', desc: '使ったターンのトレーニングで、丈夫さの伸び ×1.5' },
  stamina: { e: '🍡', desc: '体力の最大値 +15(体力も15回復)' } });
const msxItemView = (k) => {
  const base = MSX_ITEM_BY_ID[k]; const core = msxSuc && msxSuc.SUC.ITEMS ? msxSuc.SUC.ITEMS[k] : null; const ex = MSX_EXTRA_ITEM[k];
  return { id: k, name: (base && base.name) || (core && core.name) || k, desc: typeof msxItemFx === 'function' && msxItemFx(k) ? `${(base && base.desc) || (ex && ex.desc) || ''}。効き目: ${msxItemFx(k)}` : (base && base.desc) || (ex && ex.desc) || '', e: (base && base.e) || (ex && ex.e) || '🎁', during: core ? core.use === 'during' : !!(base && base.when === 'both') };
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
    <div className="v-scene home dk" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
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
  // 育成中の「能力」: いじる物・育成中だけの物(能力ポイント・技・型・忠誠度と方針・編成の親密度)。能力の棒や図鑑は「くわしく」へ(2026-11-14 社長「役割で分ける」)
  const { SUC } = msxSuc;
  const s = run.s;
  const tagAt = (SUC.BOND && SUC.BOND.tag) || 80;
  const spend = (k) => { const r = SUC.spendPts(s, k, 1); if (r.out.ok) setRun({ ...run, s: r.state }); };
  const auto = () => { const r = SUC.autoPts(s); setRun({ ...run, s: r.state }); };
  const own = typeof SUC.techsOf === 'function' ? SUC.techsOf(s.species) : [];
  const techs = (Array.isArray(s.techs) ? s.techs : []).map((id) => own.find((t) => t && t.id === id)).filter(Boolean);
  const pk = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : { state: null };
  const peakSpan = Number.isInteger(pk.from) ? (() => { const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name; return a === b ? a : `${a}〜${b}`; })() : '';
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="msx-scroll" data-msx-ability>
      <div className="v-card pk"><div className="msx-row" style={{ justifyContent: 'space-between' }}><b className="h2">📊 能力ポイント {s.pts}</b>{s.pts ? <button type="button" className="chip on" onClick={auto}>おまかせで振る</button> : null}</div>
        <div className="msx-note">大会でもらえる。好きな能力へ 1点で +1(期の目安を超えると 2点で +1)</div>
        {MSX_STATS.map((k) => (
          <div key={k} className="msx-ab-row"><span className="n">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}</span><b>{s.stats[k]}</b>
            <button type="button" className="chip on" style={{ minWidth: 52 }} disabled={!s.pts || s.pts < SUC.ptsCost(s, k)} onClick={() => spend(k)}>+1<small style={{ fontSize: 10 }}>({SUC.ptsCost(s, k)}点)</small></button>
          </div>
        ))}
      </div>
      <div className="v-card" data-msx-ability-techs><div className="h2">⚔ 覚えている技 {techs.length}</div>
        {techs.length ? <div>{techs.map((t) => <span key={t.id} className="msx-ab-tech">{t.kind === 'wise' ? '🧠' : '💪'}{t.name}</span>)}</div> : <div className="sub">まだない</div>}
        <div className="sub" style={{ marginTop: 4 }}>新しい技は修行で覚える。技の性能は場面の「🔍 くわしく」で見られる</div></div>
      <div className="v-card"><div className="h2">🌱 成長の型 {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div>
        <div className="sub">{pk.state === 'in' ? `ピーク中(あと${pk.left}ターン)。トレーニングがよく伸びる` : pk.state === 'soon' ? `あと${pk.in}ターンでピーク(伸びどき)が始まる` : peakSpan ? `伸びどき: ${peakSpan}` : ''}</div></div>
      <div className="v-card"><div className="h2">🤝 忠誠度 {SUC.loyalOf(s)}<span className="sub">(甘え度 {s.ama}+恐れ度 {s.fear})</span></div>
        <div className="sub">方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}・人気 {s.pop}・Lv {s.lv}</div></div>
      {s.omen || s.awake ? <div className="v-card" data-msx-yosu><div className="h2">🔎 様子</div>
        {s.omen ? <div className="sub">様子: <b style={{ color: '#fde047' }}>なにか起きそう</b>(体がうっすら{s.omen.k === 2 ? '虹色に' : ''}光っている)</div> : null}
        {s.awake ? <div className="sub">{s.awake >= 2 ? '🌈 超覚醒している(全能力 +70・レアキラ)' : '✨ 覚醒している(全能力 +30・キラ)'}</div> : null}</div> : null}
      <div className="v-card" data-msx-ability-bond><div className="h2">編成の親密度<span className="sub">(80で友情タッグ)</span></div>
        {s.team.map((m, i) => (
          <div key={i} className="msx-row" style={{ marginTop: 4 }}><MsxPf m={m} bond={s.bond[i]} tagAt={tagAt} cls="sm"/><span style={{ flex: 1, fontSize: 11, fontWeight: 900 }}>{msxMemberName(m)}<small className="sub">{m.kind === 'base' ? ' ベースモン' : ` ${m.rank}`}・得意 {m.top.map((k) => MSX_STAT_NAME[k]).join('・')}</small></span><b>{s.bond[i]}</b></div>
        ))}
        <div className="msx-row" style={{ marginTop: 4 }}><MsxPf aid={s.aid} bond={s.aidBond} tagAt={tagAt} cls="sm"/><span style={{ flex: 1, fontSize: 11, fontWeight: 900 }}>{msxAidName(s.aid)}<small className="sub"> 助手</small></span><b>{s.aidBond}</b></div>
      </div>
    </div>
  </>);
}

// ---- イッサ博士(6つから1つ・結果) ----
// MsxIssa(イッサ博士の大きな賭けの場面)は 56-monsuc-issa.jsx へ移した(2026-11-14 作り込み)

// ---- 出来事の画面(見本 v3-K の K4 の形)。ランダムイベント(芯の SUC.events)と助手の連続イベント(芯の storyStep)の両方をここで出す ----
//   台詞は台本エンジンの event(場面)。選ぶ前に閉じても、芯が出来事を覚えている(s.ev.pend)ので同じ物がもう一度出る
const MSX_LOOK = Object.freeze({ safe: '', good: '🙂 いけそう', even: '🤔 五分五分', risky: '😰 ちょっとあぶない' });
function MsxEvent({ run, setRun, v, ev, ctx, bondLv, onDone }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const se = msxSuc.script;
  const isStory = run.phase === 'story';
  const o = run.out || {};
  const view = o.ev || null;
  // 図鑑の id(56-monsuc-dex.jsx): 助手のお話は story.<助手>.ep1〜4 / special、ほかは表の id
  const seenId = isStory ? `story.${s.aid}.${o.ep === 'special' ? 'special' : `ep${o.ep}`}` : view ? view.id : null;
  const [info, setInfo] = useState(null); // 「ℹ」で開いている選択肢
  useEffect(() => { if (seenId && typeof msxSeenMark === 'function') msxSeenMark(seenId); }, [seenId]);
  const isUniq = !isStory && !!view && view.kind === 'uniq'; // 助手の固有イベント(56-monhero-success-arc.jsx・data/monhero-success-arc.js)
  const scene = isStory ? (se && se.SCENE ? se.SCENE.story(s.aid, o.ep) : `scn.${s.aid}.ep${o.ep}`) : view && view.lines;
  const c2 = { ...ctx, bond: bondLv, cheer: view && view.cheerName, cheer2: view && view.cheer2Name, train: view && view.train ? MSX_STAT_NAME[view.train] : undefined };
  const evOf = (sc) => { try { return se && typeof se.event === 'function' && sc ? se.event(sc, c2) : null; } catch (e) { return null; } };
  const main = evOf(scene) || { lines: [], choices: [], after: [], head: null, label: '' };
  const picked = o.picked || null;
  const choices = isStory ? (main.choices.length ? main.choices : [{ c: 'a', t: 'いっしょにがんばる' }, { c: 'b', t: 'ゆっくりいこう' }])
    : (view && view.choices ? view.choices.map((ch) => ({ ...ch, t: (main.choices.find((x) => x.c === ch.c) || {}).t || ch.c })) : []);
  const choose = (c) => {
    if (seenId && c && typeof msxSeenMark === 'function') msxSeenMark(seenId, c);
    if (isStory) {
      const r = SUC.storyStep(s, c); if (!r.out || !r.out.ok) { onDone(run); return; }
      const tail = r.out.ep === 4 && r.out.end ? `${scene}.${r.out.end}` : `${scene}.${c}`;
      setRun({ ...run, s: r.state, out: { ...o, picked: { scenes: [tail], before: s.stats } } });
      return;
    }
    const r = SUC.events.pick(s, c); if (!r.out || !r.out.ok) return;
    setRun({ ...run, s: r.state, out: { ...o, picked: { scenes: [r.out.next, r.out.scene].filter(Boolean), before: s.stats, res: r.out.res, apt: r.out.delta && r.out.delta.apt ? r.out.delta.apt : null } } });
  };
  const ups = {}; if (picked && picked.before) MSX_STATS.forEach((k) => { const d = s.stats[k] - picked.before[k]; if (d) ups[k] = d; });
  const afterLines = picked ? picked.scenes.flatMap((sc) => (evOf(sc) || { lines: [] }).lines.concat((evOf(sc) || { after: [] }).after)) : [];
  const shown = (picked ? afterLines : main.lines).slice(0, 4);
  const head = isStory ? `${msxAidName(s.aid)}のお話 ${o.ep === 'special' ? '特別な1話' : `第${o.ep}話`}` : isUniq ? `${msxAidName(s.aid)}の${view.title ? `「${view.title}」` : 'お話'}` : view && view.id === 'ev.self.anniv' ? 'はじめての育成記念日' : (view && view.head) || main.label || '育成イベント';
  const cheerIdx = view && Number.isInteger(view.cheer) ? view.cheer : null;
  const who = (l) => (l.who === 'narr' ? null : l.who === 'issa' ? 'イッサ博士' : l.who === 'mon' ? run.nick : msxAidName(l.who));
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="v-scene" style={{ flex: '1 1 0' }}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <div className="gr" style={{ left: '30%', bottom: 'calc(30% - 5px)' }}/>
      <MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '30%', height: '17%' }} live/>
      {cheerIdx != null && s.team[cheerIdx] ? <img className="mon" src={msxMonImg(s.team[cheerIdx].species)} alt="" style={{ left: '70%', bottom: '30%', height: '36%' }}/>
        : isStory || isUniq || (view && view.id === 'ev.self.anniv') ? <img src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', right: '-4%', bottom: 0, height: '70%', width: '46%', objectFit: 'contain', objectPosition: 'right bottom' }}/> : null}
      {view && view.id === 'ev.self.peakin' && !picked ? <div className="msx-peak-card msx-pop" data-msx-peak-start>🔥 ピークが始まった!</div> : null}
      {(() => { const cat = isStory || isUniq ? 'メインのお話' : (view && view.kind === 'team' ? '編成のモンスターのイベント' : '育成イベント'); return <div className="v-ev-h">{head !== cat ? <small>{cat}</small> : null}{head}</div>; })()}
      <div className="v-talk">{shown.length ? shown.map((l, i) => <div key={i}>{who(l) ? <span className="who">{who(l)}</span> : null}{who(l) ? `「${l.t}」` : l.t}</div>) : <div>{picked ? 'いい時間になった。' : 'なにか起きそうだ…'}</div>}</div>
    </div>
    {picked ? (<>
      {Object.keys(ups).length ? <MsxStRow stats={s.stats} ups={ups}/> : null}
      {picked.apt ? <div className="v-log" data-msx-ev-apt>📏 「{['零', '近', '中', '遠'][picked.apt.dist]}」の間合い適性が <b className="ga">{picked.apt.from} → {picked.apt.grade}</b> に上がった!</div> : null}
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => onDone(run)}>つぎへ ▶</button></div>
    </>) : choices.length ? (
      <div className="v-opts">{choices.map((ch) => (typeof MsxChoiceInfo === 'function' && seenId ? <React.Fragment key={ch.c}>
        <div className="msx-optrow"><button type="button" className="v-opt" disabled={ch.ok === false} onClick={() => choose(ch.c)}>{ch.t}{MSX_LOOK[ch.look] ? <small>{MSX_LOOK[ch.look]}</small> : null}</button>
          <button type="button" className={`msx-info${info === ch.c ? ' on' : ''}`} aria-label="詳細" onClick={() => setInfo(info === ch.c ? null : ch.c)} data-msx-info={ch.c}>ℹ</button></div>
        <MsxChoiceInfo evId={seenId} c={ch.c} open={info === ch.c}/></React.Fragment>
        : <button type="button" key={ch.c} className="v-opt" disabled={ch.ok === false} onClick={() => choose(ch.c)}>{ch.t}{MSX_LOOK[ch.look] ? <small>{MSX_LOOK[ch.look]}</small> : null}</button>))}</div>
    ) : (
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => (isStory ? choose('a') : choose(null))}>つぎへ ▶</button></div>
    )}
  </>);
}
