// ===== モンヒロサクセス: 育成の画面の本体(メイン・トレーニングを選ぶ・結果・叱る/褒める・イッサ博士・ターンが進む・中断と再開) =====
// 見本: docs/progress/player-raise/mock/png/v3-M・T・K・I.png。大会・修行・引退・合体の中身は回3(MsxR3)
// 1ターンの流れ(芯の決まった順): act → (トレーニングなら)react → (来ていれば)issa → endTurn → (大会なら)settle
// ★1つ進むたびに mh_monsuc_run_v1 へ保存する(phase も持つので、どこで閉じても同じ所から続く)
const MSX_POL_SEEN = {}; // 育成の id → 最後に見た育成方針と、変わったときの知らせ(画面の中だけ・保存しない)
const MSX_POLICY_SCALE = Object.freeze(['超溺愛', '溺愛', '甘い', '普通', '厳しい', 'スパルタ', '超スパルタ']);
const MSX_RES = Object.freeze({
  great: { word: '大成功', cls: '', bg: 'forest_morning', icon: '🌟' },
  ok: { word: '成功', cls: 'ok', bg: 'forest_morning', icon: '⭕' },
  fail: { word: '失敗…', cls: 'ng', bg: 'forest_evening', icon: '❌' },
  sab: { word: 'サボった', cls: 'zz', bg: 'monhero_plaza', icon: '💤' },
});
// 叱る・褒めるの場面ごとの選択肢(2026-11-14 社長)。how は芯の数字の向き(praise=甘え寄り・scold=恐れ寄り)。order は札の並び
const MSX_REACT = Object.freeze({
  great: { ask: '大成功! {mon}に、どう声をかける?', order: ['praise', 'scold'], praise: { t: '🎉 思いきりほめる', after: '{mon}は、うれしそうに胸を張った!' }, scold: { t: '🫡 気を引きしめさせる', after: '{mon}は、きりっと表情を引きしめた。' } },
  fail: { ask: 'うまくいかなかった…。{mon}に、どう声をかける?', order: ['praise', 'scold'], praise: { t: '🤗 なぐさめる', after: '{mon}は、少し元気を取り戻したようだ。' }, scold: { t: '🔥 しかって奮い立たせる', after: '{mon}の目に、くやしさの火がともった。' } },
  sab: { ask: '{mon}がサボってしまった。どうする?', order: ['scold', 'praise'], scold: { t: '📣 しかる', after: '{mon}は、しゅんとして反省している。' }, praise: { t: '👀 見のがす', after: '{mon}は、ほっとしたように甘えてきた。' } },
  shugyo: { ask: '修行から帰ってきた{mon}に、どう声をかける?', order: ['praise', 'scold'], praise: { t: '🍵 ねぎらう', after: '{mon}は、満足そうにひと息ついた。' }, scold: { t: '💪 気合いを入れる', after: '{mon}は、もう次の修行を見すえている。' } },
});
// 叱る・褒めるのあとに変わった物の札 [{ k, name, val, good }]
const msxReactChips = (d, polFrom, polTo) => {
  if (!d || typeof d !== 'object') return [];
  const out = []; const sg = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  [['ama', '🥰 甘え度'], ['fear', '😨 恐れ度'], ['loy', '忠誠度']].forEach(([k, name]) => { const n = Math.round(Number(d[k])); if (Number.isFinite(n) && n) out.push({ k, name, val: sg(n), good: n > 0 }); });
  const a = Math.max(-3, Math.min(3, Number(polFrom) || 0)); const b = Math.max(-3, Math.min(3, Number(polTo) || 0));
  if (a !== b && typeof MSX_POLICY_SCALE !== 'undefined') out.push({ k: 'pol', name: `方針 ${MSX_POLICY_SCALE[a + 3]} → ${MSX_POLICY_SCALE[b + 3]}`, val: '', good: true });
  return out;
};
// 選ぶ前の小さい字: 芯の react を複製して試し、実際に動く数を出す(甘え度 +4・方針の点)
const msxReactPreview = (s, how) => {
  try {
    const r = msxSuc.SUC.react(s, how);
    if (!r || !r.out || !r.out.ok) return null;
    const d = r.out.d || {}; const parts = [];
    if (Math.round(d.ama)) parts.push(`甘え度 +${Math.round(d.ama)}`);
    if (Math.round(d.fear)) parts.push(`恐れ度 +${Math.round(d.fear)}`);
    const st = 10; const pp = r.state.pp || 0; const lim = Math.abs(r.state.pol) === 3 && Math.abs(pp) >= st - 1;
    const side = how === 'praise' ? '甘い' : '厳しい';
    const moved = r.state.pol !== s.pol;
    // 「1点」「次の段」が何か分からなかったので、次の方針の名前と、あと何回で変わるかで書く(2026-11-20 r1119-033 育-35・育-36・育-72・育-73)
    const nextName = MSX_POLICY_SCALE[Math.max(0, Math.min(6, (r.state.pol || 0) + 3 + (how === 'praise' ? -1 : 1)))];
    const per = Math.max(1, Math.abs((r.state.pp || 0) - (s.pp || 0)) || 1); const times = Math.max(1, Math.ceil((st - Math.abs(pp)) / per));
    parts.push(lim ? `方針はこれ以上 ${side}側へ動かない` : moved ? `方針が「${MSX_POLICY_SCALE[(r.state.pol || 0) + 3]}」に変わる` : `あと${times}回で 方針「${nextName}」`);
    return parts.join('・');
  } catch (e) { return null; }
};
// 選んだあとのひとこと(吹き出し)。同じターンなら同じ言葉
const MSX_REACT_BUB = Object.freeze({ praise: ['やったー!', 'えへへ…', 'もっとほめて!'], scold: ['…ごめんなさい', '分かった…!', '次は がんばる!'] });
// 選んだあと: 甘え度・恐れ度・忠誠度のゲージが前から後へ動く。変わった数は札で出す
const MsxReactGauges = ({ from, to }) => {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 450); return () => clearTimeout(t); }, []);
  const rows = [
    { k: 'ama', name: '🥰 甘え度', a: from.ama, b: to.ama, w: 2, bg: 'linear-gradient(180deg,#f9a8d4,#f472b6)' },
    { k: 'fear', name: '😨 恐れ度', a: from.fear, b: to.fear, w: 2, bg: 'linear-gradient(180deg,#7dd3fc,#3b82f6)' },
    { k: 'loy', name: '💖 忠誠度', a: from.loy, b: to.loy, w: 1, bg: 'linear-gradient(180deg,#fde68a,#f59e0b)' },
  ];
  return <>{rows.map((r) => { const dd = r.b - r.a; return <div key={r.k} className="v-ga" data-msx-react-gauge={r.k}><span>{r.name}</span><div className="tr"><i style={{ width: `${(on ? r.b : r.a) * r.w}%`, background: r.bg, transition: 'width .9s ease-out' }}/></div><b>{on ? r.b : r.a}{dd ? <small> ({dd > 0 ? `+${dd}` : dd})</small> : null}</b></div>; })}</>;
};
const MSX_COND = Object.freeze({ injury: 'けが', ill: '病気', away: '家出' });
const MSX_ISSA_KEYS = Object.freeze([
  { key: 'stat', icon: '💪', name: 'ステータスアップ', ok: '全能力 +50', ng: '全能力 −10・サボりグセ', line: 'stat' },
  { key: 'hpmax', icon: '🔋', name: '体力上限アップ', ok: '体力の上限 +20', ng: '体力 −20', line: 'cap' },
  { key: 'hp', icon: '❤️', name: '体力回復', ok: '体力を8割回復', ng: '体力 −30・どんより', line: 'heal' },
  { key: 'loyal', icon: '🤝', name: '忠誠度アップ', ok: '忠誠度 +15', ng: '変化なし', line: 'loy' },
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

// 結果の画面の「動いた数字の札」(56-monsuc-gaugefx.jsx)に渡す値(r1115-047・054)。選ぶ前の値を控え(gfxSnap)、選んだあとの値と並べる
const msxLoyalOf = (s) => { const S = msxSuc && msxSuc.SUC; return S && typeof S.loyalOf === 'function' ? Math.round(Number(S.loyalOf(s)) || 0) : 0; };
const gfxSnap = (s) => ({ pop0: Math.round(Number(s.pop) || 0), loy0: msxLoyalOf(s), ama0: Math.round(Number(s.ama) || 0), fear0: Math.round(Number(s.fear) || 0) });
const msxGfxItemsOf = (p, s) => {
  if (!p) return [];
  const o = [];
  const add = (k, e, name, from, to, max, extra = {}) => { if (Number.isFinite(from) && Number.isFinite(to)) o.push({ k, e, name, from, to, max, ...extra }); };
  add('hp', '❤️', '体力', p.hp0, s.hp, Math.max(1, s.hpMax), { cls: 'hp' });
  add('stress', '💢', 'ストレス', p.st0, s.stress, 100, { cls: 'st', good: Number.isFinite(p.st0) ? s.stress < p.st0 : true });
  add('loyal', '🤝', '忠誠度', p.loy0, msxLoyalOf(s), 100);
  add('ama', '🍬', '甘え度', p.ama0, Math.round(Number(s.ama) || 0), 50);
  add('fear', '⚡', '恐れ度', p.fear0, Math.round(Number(s.fear) || 0), 50);
  add('pop', '⭐', '人気', p.pop0, Math.round(Number(s.pop) || 0), 100);
  return o;
};
// トレーニングに来た編成の子の札。押すとアシスト詳細(r1119-011「アシモンを押すとアシスト能力」)。詳細は .msx の上に重ねる(場面の中に閉じ込めない)
function MsxCmTap({ m, className, attrs, children }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  const root = open && ref.current ? ref.current.closest('.msx') : null;
  return (<>
    <button type="button" ref={ref} className={`${className} msx-cm-tap`} onClick={() => setOpen(true)} aria-label={`${msxMemberName(m)}のアシスト効果を見る`} {...(attrs || {})}>{children}</button>
    {open && root && typeof MsxAssistDetail === 'function' && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal
      ? ReactDOM.createPortal(<MsxAssistDetail mem={m} kind={m.kind === 'base' ? 'base' : 'team'} name={msxMemberName(m)} sub={m.kind === 'base' ? 'ベースモン' : `Lv.${m.lv || 1}・${msxMonName(m.species)}`} onClose={() => setOpen(false)}/>, root) : null}
  </>);
}

// 甘え度・恐れ度が何で動いたか(芯の s.lw・r1119-019)。短い字は上の帯の右、長い字は能力のページの一覧
const MSX_LW_WHY = Object.freeze({
  turnHp: ['体力に余裕', '体力を半分以上残してターンを終えた'], turnLow: ['体力が少ない', '体力が半分より少ないままターンを終えた'],
  praise: ['ほめた', 'ほめた'], scold: ['しかった', 'しかった'], idle: ['ほうっておいた', 'しばらく、ほめも しかりもしなかった'],
  play: ['遊んだ', 'いっしょに遊んだ'], meal: ['ごはん', 'ごはんを食べた'], mealSkip: ['ごはん抜き', 'ごはんを抜いた'],
  story: ['お話', 'お話の出来事'], item: ['アイテム', 'アイテムを使った'], win: ['勝った', '試合に勝った'], away: ['家出', '家出から戻った'], event: ['出来事', '出来事があった'],
});
const msxLwWhy = (w, long) => { const r = MSX_LW_WHY[w]; return r ? r[long ? 1 : 0] : '出来事'; };
const msxLwAmt = (x) => [x.a ? `🍬甘え+${x.a}` : '', x.f ? `⚡恐れ+${x.f}` : ''].filter(Boolean).join(' ');
const msxLwList = (s) => (s && Array.isArray(s.lw) ? s.lw.filter((x) => x && typeof x === 'object' && (Number(x.a) > 0 || Number(x.f) > 0)) : []);
// いちばん新しいターン(前のターンの終わりと今のターン)に動いた分
const msxLwNow = (s) => { const l = msxLwList(s); const t = Number(s && s.turn) || 0; return l.filter((x) => Number(x.t) >= t - 1); };

// 上の帯の忠誠・人気が変わったときの「+4」は、帯がどの画面で描き直されても続くよう、育成ごとに前の値を覚えておく(2026-11-14 社長「忠誠度と人気を上部に」)
const msxBandMem = { id: null, loy: 0, pop: 0, dl: 0, dp: 0, tl: 0, tp: 0 };
const MSX_BAND_DELTA_MS = 2600;
// hpFrom / stFrom … 休む・遊ぶ・通院の結果で、体力・ストレスの棒を前の値から伸び縮みさせる(2026-11-14 社長「休んだときのゲージの変動がない」)
function MsxBand({ s, v, ev, use = 0, stAdd = 0, hpFrom = null, stFrom = null, gainTag = true }) {
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
  // 「ピーク中」の表示は場面右のチップ(data-msx-peak-chip)に一本化した(周回点検 第2回 低-1: 上部中央のピルと二重表示だった)
  return (
    <div className="v-band" data-msx-turn={s.turn}>
      <div className="v-b1">
        {/* 最後の期は参考(taikai-entry 175)どおり「HF進出」の札と、ヒーローズファイナルの日なら「当日」・その前は「あと◯ターン」(3ターン目から1戦ずつ) */}
        {v.period.key === 'final' ? (
          <div className="v-turn hf" data-msx-hfband={v.period.at >= 3 ? 'day' : 3 - v.period.at}><span className="ph hf">HF進出<small>{cal.year}年目 {cal.month}月</small></span>
            <div className="n">{v.period.at >= 3 && s.over ? <b className="hfday">終了</b> : v.period.at >= 3 ? <b className="hfday" data-msx-hfround>大会の日</b> : <>あと<b>{3 - v.period.at}</b>ターン</>}</div></div>
        ) : (
          <div className="v-turn"><span className="ph">{v.period.name}<small>{cal.year}年目 {cal.month}月</small></span>
            <div className="n">残り<b>{v.period.left}</b>ターン</div></div>
        )}
        <div className="v-pow"><div><small>総合力</small><b>{msxFmt(ev.power)}</b></div><i className={`${msxRankCls(ev.rank)} big`}>{ev.rank}</i></div>
      </div>
      <div className="v-b2">
        <div className={`v-ga hp${after < max * 0.3 ? ' low' : ''}`}><span>❤️ 体力</span>
          <div className="tr"><i style={{ width: `${after / max * 100}%`, ...(grow(Number.isFinite(hpFrom) ? hpFrom / max * 100 : NaN, after / max * 100) || {}) }}/>{use ? <u style={{ left: `${after / max * 100}%`, width: `${Math.min(hp, use) / max * 100}%` }}/> : null}{max > 100 ? <s style={{ left: `${100 / max * 100}%` }}/> : null}</div>
          {use ? <em>−{use}</em> : hpGain && gainTag ? <em className={hpGain > 0 ? 'hl' : ''} data-msx-band-hp-gain>{hpGain > 0 ? `+${hpGain}` : hpGain}</em> : null}<b>{hp}<small className={max > 100 ? 'cap' : ''}>/{max}{max > 100 ? '▲' : ''}</small></b></div>
        <div className="v-ga st"><span>💢 ストレス</span>
          <div className="tr"><i style={{ width: `${s.stress}%`, ...(grow(stFrom, s.stress) || {}) }}/>{stAdd ? <u className="add" style={{ left: `${s.stress}%`, width: `${Math.min(100 - s.stress, stAdd)}%` }}/> : null}</div>
          {stAdd ? <em className="pl">+{stAdd}</em> : stGain && gainTag ? <em className={stGain < 0 ? 'hl' : 'pl'}>{stGain > 0 ? `+${stGain}` : stGain}</em> : null}<b>{s.stress}<small>/100</small></b></div>
      </div>
      <div className="v-b3" data-msx-band-loy><span>🤝 忠誠 <b>{loy}</b><small>/100</small>{dTag(M.dl, M.tl)}</span><span>⭐ 人気 <b>{pop}</b>{dTag(M.dp, M.tp)}</span><span>方針 <b>{MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}</b></span>
        {(() => { const l = msxLwNow(s); if (!l.length) return null; const x = l[l.length - 1]; return <span className="v-lw" data-msx-band-lw title={l.map((y) => `${msxLwWhy(y.w, true)}: ${msxLwAmt(y)}`).join(' / ')}>{msxLwAmt(x)}<small>{(Number(x.t) || 0) < (Number(s.turn) || 0) && (x.w === 'turnHp' || x.w === 'turnLow') ? '前のターン ' : ''}{msxLwWhy(x.w)}{l.length > 1 ? ` ほか${l.length - 1}` : ''}</small></span>; })()}</div>
    </div>
  );
}
// ups … 上がった(下がった)分。stats は変わったあとの値。preview … トレーニングを選ぶ画面の見込み(まだ上がっていない)
//   結果の画面では、上がる前の長さからゲージが伸び、伸びた分が光る(下がるときは縮み、減った分が赤く消える。2026-11-13 社長)。
//   「動きを減らす」設定では、はじめから変わったあとの長さで出す
// 通院の結果のひとこと: 治った物・治らなかった物を名前で書く(「ようすが治った」で済ませない。docs/spec/MONSUC_UI.md の 3)
const MSX_YOSU_NAME = { sabori: 'サボりグセ', utsu: 'どんより' };
function msxClinicText(cured, yosu) {
  const nm = (ks) => ks.map((k) => `「${MSX_YOSU_NAME[k] || k}」`).join('と');
  const c = (Array.isArray(cured) ? cured : []).filter((k) => MSX_YOSU_NAME[k]);
  const left = Object.keys(yosu || {}).filter((k) => MSX_YOSU_NAME[k] && yosu[k]);
  const parts = [];
  if (c.length) parts.push(`${nm(c)}が治った!`);
  if (left.length) parts.push(`${nm(left)}は今回は治らなかった。もう1回来れば必ず治る。`);
  return parts.join(' ');
}
// 能力の列を押すと、数の下のゲージ ⇄ 素質(A〜E)を切り替える(2026-11-14 社長「ステータスを押したら素質表示に切り替えて」)。
// どちらの表示かは、その育成のあいだ覚える(育成の id ごと・画面をまたいで同じ。保存はしない)
let msxStAptView = { id: null, on: false };
const msxStAptSubs = new Set();
const msxStAptFlip = (id) => { msxStAptView = { id, on: !(msxStAptView.on && msxStAptView.id === id) }; msxStAptSubs.forEach((f) => { try { f((n) => n + 1); } catch (e) { /* 消えた画面 */ } }); };
// 押せない選択肢の理由(必要な物の表。いまは賞金だけ)
const msxChNeedText = (need) => Object.entries(need || {}).map(([k, n]) => (k === 'fame' ? `賞金 ${msxFmt(n)}G が要る` : `${k} ${n} が要る`)).join('・');
function MsxStRow({ stats, ups, main, preview = false, who = null }) {
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
  // 2026-11-18 社長「5桁・6桁の数字は何？」: 目盛りの両はしの数字をゲージ(幅 約17px)の下に出すと、2つの数字がくっついて
  //   「80140」のような1つの大きな数に読めた。当初は離して出す直しを入れたが、社長「その数値っているの？」→「外す」で確定し、
  //   目盛りの両はしの数字そのものを出さない形にした(拡大した目盛りで棒を描く動きはそのまま)
  const zoomA = grow && !calm && !zout; // 札が持ち上がっている
  const zoomS = grow && !calm;          // 棒は拡大した目盛りで描く
  // 素質の表示(who = 育成の状態。種と id があるときだけ押せる)
  const [, setAptTick] = useState(0);
  useEffect(() => { msxStAptSubs.add(setAptTick); return () => { msxStAptSubs.delete(setAptTick); }; }, []);
  const tgId = who && who.species && who.id ? who.id : null;
  const aptOn = !!(tgId && msxStAptView.on && msxStAptView.id === tgId);
  const aptL = tgId && typeof msxAptOf === 'function' ? msxAptOf(who.species) : null;
  const tgProps = tgId ? { role: 'button', tabIndex: 0, 'aria-label': aptOn ? '能力の数の表示に戻す' : '能力の素質を見る', 'data-msx-st-toggle': aptOn ? 'apt' : 'num', onClick: () => msxStAptFlip(tgId), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); msxStAptFlip(tgId); } } } : {};
  return (
    <div {...tgProps} className={`v-st${tgId ? ' tg' : ''}${aptOn ? ' apton' : ''}${grow ? ' grow' : ''}${grow && on ? ' on' : ''}${grow && !calm ? ' gs-a' : ''}${zoomA ? ' zin' : ''}${zoomS ? ' zs' : ''}${zoomA && MSX_STATS.filter((k) => ups[k]).length > 3 ? ' many' : ''}`} data-msx-st-grow={grow ? (on ? 'on' : 'pre') : undefined}>
      {tgId ? <span className="v-sttg" aria-hidden="true">⇄ {aptOn ? '数' : '素質'}</span> : null}
      {MSX_STATS.map((k) => {
        const u = ups ? (ups[k] || 0) : 0;
        const after = stats[k]; const before = Math.max(0, after - (grow ? u : 0));
        // 案A: 上がる前の値の近くから、拡大した目盛り(1目盛り=10)で伸ばす
        const span = Math.max(60, Math.ceil(Math.abs(u) * 2.6 / 10) * 10);
        const top = Math.max(999, Math.ceil(Math.max(after, before) / 10) * 10 + 10); // 能力の上限アップ(r1115-103): 999 を超えた子は目盛りの上を広げる
        const lo = Math.max(0, Math.min(top - span, Math.floor((Math.max(after, before) - span * 0.82) / 10) * 10));
        const zp = (n) => (zoomS && u ? `${Math.max(0, Math.min(100, (n - lo) / span * 100))}%` : pct(n));
        const tick = zoomS && u ? { backgroundSize: `${1000 / span}% 100%` } : undefined;
        // 棒も数字と同じ値(数え上げの途中の値)から描く。数字と長さがいつも合う
        const cur = grow && u ? before + (after - before) * ease(t) : after;
        // 能力の上限(育成開始時に決まる s.cap)。算出元は芯の statCapOf(成長のクランプ・詳細モーダルと同源)にそろえ、
        // 詳細モーダルの capK と同じく、いまの値より小さい上限は出さない(上限だけ 999 に落ちて値が超えて見える矛盾の防止。2026-11-18 実機報告)
        const capEff = (typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC && typeof msxSuc.SUC.statCapOf === 'function') ? msxSuc.SUC.statCapOf(who, k) : (who && who.cap && Number.isFinite(who.cap[k]) ? Math.max(999, who.cap[k]) : 999);
        const cap = Math.max(capEff, after);
        return (<div key={k} className={`${u > 0 ? 'up' : u < 0 ? 'dn' : ''}${k === main ? ' main' : ''}`}>
          <small>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</small><span className="vl">{typeof msxStatRankOf === 'function' ? <i className={msxStatRankCls(after)} data-msx-stat-rank={k}>{msxStatRankOf(after)}</i> : null}<b>{grow && u ? Math.round(before + (after - before) * ease(t)) : stats[k]}</b></span>
          <span className="br">{aptOn && aptL ? <span className={`ap a${aptL[MSX_STATS.indexOf(k)]}`}>素質 {aptL[MSX_STATS.indexOf(k)]}</span> : grow && u ? <u className="g" style={tick}><i style={{ width: zp(u > 0 ? cur : after) }}/>{u > 0 ? <s className="gu" style={{ left: zp(before), width: `calc(${zp(cur)} - ${zp(before)})` }}/> : <s className="gd" style={{ left: zp(after), width: `calc(${zp(before)} - ${zp(after)})` }}/>}</u>
            : <u className={after > 999 ? 'ov' : undefined}><i style={{ width: pct(after) }}/>{after > 999 ? <b className="ov" data-msx-stat-over={after - 999} style={{ width: pct(after - 999) }}/> : null}</u>}{aptOn ? null : <small className="cap">/{cap}</small>}</span>
          {ups ? <em>{u > 0 ? `+${u}` : u < 0 ? `−${-u}` : ''}</em> : null}</div>);
      })}
    </div>
  );
}
function MsxPf({ m, bond, tagAt, cls = '', aid }) {
  const tag = bond >= tagAt;
  if (aid) return <span className={`v-pf as${tag ? ' tag' : ''} ${cls}`}><img src={msxFace(aid, 'happy')} alt=""/><i className="af"><b style={{ width: `${bond}%` }}/></i></span>;
  const r = m.kind === 'base' ? 'G' : m.rank;
  return <span className={`v-pf r${r}${m.kind === 'base' ? ' base' : ''}${tag ? ' tag' : ''} ${cls}`}><MsxMonFace species={m.species} colors={m.colors}/><i className="af"><b style={{ width: `${bond}%` }}/></i></span>;
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
// startView='box' … 本編の M/B管理 から開いたとき。読み込んだらマスモンボックスを出し、閉じたら画面ごと閉じる(2026-11-14 社長)
function MonheroSuccessScreen({ onClose, callNameOf, bondLvOf, debug = false, startView = null }) {
  const [view, setView] = useState('loading');
  const [data, setData] = useState(null);
  const [run, setRunState] = useState(null);
  const [layout, setLayout] = useState(msxLayout);
  const [ask, setAsk] = useState(null); // 確かめの小窓 { text, yes, onYes }
  const [carryShop, setCarryShop] = useState(false); // 持ちこみの段から開くビートP交換所(56-monsuc-shop.jsx の MonsucCarryShop・id48)
  const lendRef = useRef({}); // フレンドから借りた結果(保存に失敗して押し直したとき用・r1115-200)
  const [playSub, setPlaySub] = useState('main'); // 育成中の小画面(MsxPlay の sub。β版の説明を出す場面を決める)
  // 育成の外(ホーム・ボックス・ランキング・図鑑・始めるまでの準備)の曲(ビート部の表 data/success-sounds.js の menu)。
  // 育成中は MsxPlay が場面の曲を鳴らすので、ここは何もしない(画面を閉じると入る前の曲へ戻る)
  // 後片付け(閉じたら入る前の曲へ)はここの1か所だけ。育成中(play)は MsxPlay が場面の曲を切り替える
  msxUseSound(view === 'play' || view === 'loading' || view === 'fail' ? null : 'menu');
  const [tutTurn, setTutTurn] = useState(null); // メインで説明の窓を1つ見たターン(1ターンに1つまで。保存しない)
  useEffect(() => {
    const on = () => setLayout(msxLayout());
    window.addEventListener('resize', on); window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);
  // 開いたときに、ランキングの登録待ちがあれば1件送り直す(待たない・落ちない)
  useEffect(() => { if (typeof monsucRankFlush === 'function') { try { monsucRankFlush(); } catch (_) {} } }, []);
  const [loadTry, setLoadTry] = useState(0); // 読み込みのやり直し(タイトルの「もう一度読み込む」)
  useEffect(() => {
    let alive = true;
    msxLoad().then(async (L) => {
      if (!alive) return;
      if (!L) { setView('fail'); return; }
      const d = await msxReadAll(L.SUC);
      if (!alive) return;
      setData(d); setRunLoaded(d.run); setView(startView === 'box' ? 'box' : 'home');
    });
    return () => { alive = false; };
  }, [loadTry]);
  // 保存の版番号(r1115-200 3b): この画面が最後に読んだ/書いた版。保存のたびに +1 して、ほかの画面が先に進めていたら書かずに読み直す
  const revRef = useRef(0);
  const setRunLoaded = (r) => { revRef.current = r && Number.isFinite(Number(r.rev)) ? Number(r.rev) : 0; setRunState(r); };
  // 保存の結果を返す(true 書けた・false 書けなかった・'stale' ほかの画面が先に進めていたので書かなかった)
  const setRun = (r0) => {
    let r = r0 && typeof msxBeatMark === 'function' ? msxBeatMark(r0) : r0; // ビートPを渡した量も持つ(56-monhero-success-store)。デバッグの育成は財布に足さない
    if (r) { revRef.current += 1; r = { ...r, rev: revRef.current }; }
    setRunState(r);
    if (!r) return Promise.resolve(true);
    const p = msxSaveRun(r, !!debug);
    Promise.resolve(p).then((res) => { if (res === 'stale') setAsk({ text: 'ほかの画面で、この育成が先に進んでいます。保存されている続きを読み直します', yes: '読み直す', onYes: toHome }); }).catch(() => {});
    return p;
  };
  const setMeta = (meta) => { setData((d) => ({ ...d, meta })); msxSaveMeta(meta); };
  // 交換所で買ったあと、持ちこみの数を含む meta だけを保存から読み直す(ほかの項目はそのまま)。
  //   読み直さないと、育成をはじめるときに古い持ちこみの数で保存し直して、買った分が消える
  const refreshMeta = async () => { try { const raw = await storeGet(MSX_KEYS.meta, null); const m = msxNormMeta(raw); setData((d) => (d ? { ...d, meta: m } : d)); } catch (e) {} };
  // ホームへ戻るときは保存を読み直す(回3の引退で保存枠・meta が書き足されたあと、古い中身で上書きしないように)
  //   ★先に並べた保存が終わってから読む(r1115-171 c)
  const toHome = () => { (typeof msxSaveWait === 'function' ? msxSaveWait() : Promise.resolve()).then(() => msxReadAll(msxSuc.SUC)).then((d) => { setData(d); setRunLoaded(d.run); }).catch(() => {}); setView('home'); };

  const startingRef = useRef(false); // 保存を待つ間の二度押しで、アイテムを2回減らさない(r1115-200)
  const startRun = async (cfg) => {
    if (startingRef.current) return false;
    startingRef.current = true;
    try { return await startRunNow(cfg); } finally { startingRef.current = false; }
  };
  const startRunNow = async (cfg) => {
    const { SUC } = msxSuc;
    // フレンドから借りた子は、はじめるときに1回だけ知らせる。断られた(続けて借りすぎ streak・通信の失敗など)ら、借りずにその枠をベースモンで始める
    if (cfg.friendId && typeof monsucLendUse === 'function') {
      // 保存に失敗してもう一度押したときは、前の結果を使う(r1115-200: 借りたことを二重に知らせない)
      let r = lendRef.current[cfg.friendId] || null;
      if (!r) { try { r = await monsucLendUse(cfg.friendId); } catch (e) { r = { ok: false, reason: 'network' }; } if (r && r.ok) lendRef.current[cfg.friendId] = r; }
      if (!r || !r.ok) cfg = { ...cfg, team: cfg.team.map((m) => (m && m.friend ? { kind: 'base', species: cfg.baseFill || cfg.species } : m)) };
    }
    const id = `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
    // 持ちこみ: はじめる前に効く物は carry、育成中に使う物は bag(芯の入口・合わせて2つまで)
    const known = (k) => !!(SUC.ITEMS && SUC.ITEMS[k]);
    const carry = cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'before');
    const bag = {}; cfg.items.filter((k) => MSX_ITEM_BY_ID[k] && MSX_ITEM_BY_ID[k].when === 'both').forEach((k) => { bag[k] = 1; });
    const fromMon = cfg.from && typeof cfg.from.box === 'string' ? data.box.mons.find((m) => m.id === cfg.from.box && !m.raised) || null : null; // 未育成の子だけ(育て終えた能力から始まる道を本体でも塞ぐ) // 合体円盤石(未育成)から始めるなら、継いだ間合い適性の段数を写す
    let rivals = []; try { rivals = typeof msxRivalsBuild === 'function' ? await msxRivalsBuild(SUC, cfg.aid) : []; } catch (_) { rivals = []; } // この育成のライバル(r1115-202)
    const s = SUC.newRun({ id, rivals, species: cfg.species, ...(cfg.techPick && typeof cfg.techPick === 'object' ? { techPick: cfg.techPick } : {}), aid: cfg.aid, team: cfg.team, aidBondLv: cfg.aidBondLv, carry, bag, ...(fromMon && Array.isArray(fromMon.aptBase) ? { aptBase: fromMon.aptBase } : {}), ...(fromMon && Number.isInteger(fromMon.gt) ? { type: fromMon.gt } : {}), ...(fromMon && fromMon.st && typeof fromMon.st === 'object' ? { startSt: fromMon.st } : {}), wonBefore: Array.isArray(data.meta.wonCups) ? data.meta.wonCups : [] });
    const r = { v: 1, id, s, scn: typeof msxScenarioId === 'function' ? msxScenarioId(cfg.scn) : 'hero', nick: cfg.nick, colors: cfg.colors, from: cfg.from, items: cfg.items, used: 0, phase: typeof MsxBirth === 'function' ? 'birth' : 'begin', out: null, log: [], startAt: Date.now() };
    const meta = { ...data.meta, team: cfg.teamSlots.map((t) => (t.box ? { box: t.box } : t.assist ? { assist: t.assist } : { base: t.base })), runs: (data.meta.runs || 0) + 1, picked: { ...(data.meta.picked || {}), [cfg.species]: ((data.meta.picked || {})[cfg.species] || 0) + 1 } };
    // 持ちこんだ物は1つずつ減らす。芯がまだ知らない物(効き目が無い物)は減らさない
    if (cfg.items.some(known)) { const it = { ...meta.items }; cfg.items.filter(known).forEach((k) => { it[k] = Math.max(0, (it[k] || 0) - 1); if (!it[k]) delete it[k]; }); meta.items = it; }
    // r1115-200 1: 消費(meta)と途中の育成を一緒に書き、両方書けたときだけ育成へ進む。書けなければ両方元のまま(アイテムも前の育成も残る)→ もう一度押せる
    const r1 = typeof msxBeatMark === 'function' ? { ...msxBeatMark(r), rev: 1 } : { ...r, rev: 1 };
    let saved = false;
    try { saved = await (typeof msxStartRunSave === 'function' ? msxStartRunSave(r1, meta) : Promise.all([msxSaveMeta(meta), msxSaveRun(r1, !!debug)]).then((a) => a.every((x) => x === true))); } catch (e) { saved = false; }
    if (saved !== true) { setAsk({ text: '保存できませんでした。アイテムと前の育成はそのままです。もう一度「育成を始める」を押してください', yes: 'OK', onYes: () => {} }); return false; }
    lendRef.current = {};
    setData((d) => ({ ...d, meta })); revRef.current = 1; setRunState(r1); setView('play');
    return true;
  };
  // やめる(r1115-200 3a・3c): 画面の育成の id が保存と同じときだけ消す。別の育成なら消さずに読み直す・書けなければもう一度
  const quit = () => setAsk({ text: 'この育成をやめますか? 育てた中身はなくなります(マスモンボックスには入りません)', yes: '育成をやめる', onYes: async () => {
    let res = false; try { res = await (typeof msxClearRun === 'function' ? msxClearRun(run && run.id) : storeSet(MSX_KEYS.run, null)); } catch (e) { res = false; }
    if (res === false) { setAsk({ text: '保存できませんでした。育成は消えていません。もう一度「育成をやめる」を押してください', yes: 'OK', onYes: () => {} }); return; }
    if (res === 'other') { toHome(); return; } // ほかの画面で新しい育成が始まっていた → 消さずに読み直す
    setRunLoaded(null); setView('home');
  } });

  let content = null;
  // タイトル(2026-11-16 UI改修): 入口を押したら、まずロゴと背景のあるタイトルを見せ、その同じ画面で育成データを読み込む。
  //   準備中も「閉じる」で閉じられ、失敗したらその場で「もう一度読み込む」ができる
  if (view === 'loading' || view === 'fail') content = (<>
    <MsxHd back="HOMEへ戻る" onBack={onClose}/>
    <div className="v-body v-hm">
      <div className="v-scene hm">
        <img className="bg" src={msxSceneBg(1).bg} alt=""/><div className="sh"/>
        <div className="v-hm-logo"><img src={MSX_LOGO_ART} alt="モンヒロサクセス"/>{typeof MsxBetaMark === 'function' ? <MsxBetaMark/> : null}</div>
      </div>
      {view === 'loading' ? <div className="msx-note" style={{ textAlign: 'center' }}>読み込んでいます…</div>
        : <div className="v-card" style={{ textAlign: 'center' }}>読み込めませんでした。通信のよいところで、もう一度読み込んでください
          <button type="button" className="msx-btn go" style={{ marginTop: 10 }} onClick={() => { setView('loading'); setLoadTry((t) => t + 1); }}>もう一度読み込む</button></div>}
    </div>
  </>);
  else if (view === 'home') content = <MsxHome data={data} run={run} debug={debug} onClose={onClose} onBase={typeof MsxBaseMons === 'function' ? () => setView('basemon') : null} onBox={typeof MsxR3Box === 'function' ? () => setView('box') : null} onContinue={() => setView('play')} onNew={() => (run && !run.s.over ? setAsk({ text: '途中の育成があります。新しく始めると、いまの育成はなくなります', yes: '新しく始める', onYes: () => setView('start') }) : setView('start'))} setMeta={setMeta} onWipe={quit} onRank={() => setView('rank')}/>;
  else if (view === 'start') content = <MsxStart data={data} SUC={msxSuc.SUC} onCancel={() => setView('home')} onStart={startRun} bondLvOf={bondLvOf} callNameOf={callNameOf} onOpenShop={() => setCarryShop(true)}/>;
  else if (view === 'basemon' && typeof MsxBaseMons === 'function') content = <MsxBaseMons data={data} onClose={() => setView('home')}/>;
  else if (view === 'box' && typeof MsxR3Box === 'function') content = <MsxR3Box onClose={startView === 'box' ? onClose : toHome}/>;
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
      {/* 持ちこみの段から開くビートP交換所(Tailwind で組まれているので、ランキングと同じく .msx の外に重ねる) */}
      {carryShop && typeof MonsucCarryShop === 'function' ? <MonsucCarryShop onClose={(bought) => { setCarryShop(false); if (bought) refreshMeta(); }}/> : null}
      <div className={`msx v3 ${layout}`} data-msx-view={view}>
        {content}
        {betaKeys && !ask && typeof MsxBetaTalk === 'function' ? <MsxBetaTalk keys={betaKeys.keys} ctx={betaKeys.ctx} onDone={betaKeys.onDone}/> : null}
        {ask && <div className="msx-ov msx-fade"><div className="msx-sheet"><div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{ask.text}</div>
          <button type="button" className="msx-btn go" onClick={() => { const f = ask.onYes; setAsk(null); f(); }}>{ask.yes}</button>
          <button type="button" className="msx-btn sub" onClick={() => setAsk(null)}>キャンセル</button></div></div>}
      </div>
      {/* スマホを横にしたときの案内(2026-11-20 r1119-026 社長: モンサクは縦向きで遊ぶ)。出し入れは CSS だけで決める(.msx-portrait-only)。
          画面の進み具合はそのまま(案内を上に重ねるだけ)なので、試合中や育成中に回しても、縦に戻せば続きから遊べる。保存には触らない */}
      <div className="msx-portrait-only" data-msx-portrait-only role="alert" aria-live="polite">
        <div className="in">
          <div className="ph" aria-hidden="true"><span>📱</span></div>
          <b>スマホを縦向きにしてね</b>
          <p>モンヒロサクセスは縦向きで遊べます。<br/>縦に戻すと、そのまま続きから遊べます。</p>
        </div>
      </div>
    </div>
  );
  return typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && typeof document !== 'undefined' ? ReactDOM.createPortal(node, document.body) : node;
}

// 育成中でないときの広場のにぎやかし(2026-11-18 あっくん「育ててるモンスターがいないとき画面が寂しい」)。
//   マスモンボックスのモンスター(育てたものを優先に最大2体。1体もいなければ看板モンのモッチーとスエゾー)と、助手のみゅあを広場に出す。
//   飾りだけの部品: 押せない(pointer-events:none)・保存や進行には一切触らない。育成中の表示(.mon)とは出す条件が重ならない
//   みゅあの絵(2026-11-18 実機で「切れたまま」の再報告を受けて差し替え): 今までの立ち絵(stand-normal・
//   296×336)は全身画から太ももまでで切り出した絵で、下端がまっすぐ断ち切れて見えていた(左端の幾何は
//   高さ 30%・中心 25% で余白 17px 以上を実測済みで、残っていた「切れ」はこの下端)。全身画
//   (fullbody・288×589・幅は高さの 0.489 倍)を使い、足元をモンの1体目と同じ地面(bottom 11%)に合わせる。
//   置き場は高さ 34%・中心 23%: 場面の縦横比が 1.6 までなら呼吸(scale 1.025)込みで左端に約 9% の余白が
//   残り、右端もモンの1体目(中心 57%)に届かない。全身画が無い服のときだけ今までの立ち絵+置き場に戻す
function MsxHomeDeco({ data }) {
  const box = (data && data.box && Array.isArray(data.box.mons) ? data.box.mons : []).filter((m) => m && m.species && msxMon(m.species));
  const own = [...box.filter((m) => m.raised), ...box.filter((m) => !m.raised)].slice(0, 2);
  const mons = own.length ? own.map((m) => ({ sp: m.species, colors: m.colors })) : [{ sp: 'Mocchi' }, { sp: 'Suezo' }];
  const spots = [
    { left: '57%', bottom: '11%', height: '28%' },
    { left: '82%', bottom: '10%', height: '21%' },
  ];
  const muaWho = typeof msxWho === 'function' ? msxWho('mua') : null;
  const muaFull = muaWho && typeof assistantFullBodyImage === 'function' ? assistantFullBodyImage(muaWho, 'happy') : null;
  const muaSpot = muaFull ? { left: '23%', bottom: '11%', height: '34%' } : { left: '25%', bottom: '12%', height: '30%' };
  return (
    <div className="v-hm-deco" aria-hidden="true">
      <span className="v-hm-deco-a" style={muaSpot}><i className="gs"/><img src={muaFull || msxBody('mua', 'happy')} alt="" draggable={false}/></span>
      {mons.map((m, i) => (
        <span key={`${m.sp}-${i}`} className="v-hm-deco-m" style={{ ...spots[i], animationDelay: `${i * 0.7}s` }}><i className="gs"/>{m.colors && m.colors.some(Boolean) && typeof DyedMonsterImage === 'function'
          ? <DyedMonsterImage baseId={m.sp} src={msxMonImg(m.sp)} masuColors={m.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
          : <img src={msxMonImg(m.sp)} alt="" draggable={false}/>}</span>
      ))}
    </div>
  );
}

// ---- はじめの画面(題字ロゴ・続きから・新しく始める・保存枠/ランキング/図鑑の札・デバッグの道具) ----
// 途中の育成があるときは「▶ 続きから」をいちばん大きく、無いときは「新しく育成をはじめる」をいちばん大きく(2026-11-14 社長の選んだ案)
function MsxHome({ data, run, debug, onClose, onContinue, onNew, setMeta, onWipe, onRank, onBox, onBase }) {
  const SUC = msxSuc.SUC;
  const s = run && run.s;
  const v = s && !s.over ? SUC.peek(s) : null;
  const [dex, setDex] = useState(false);
  const tiles = [
    onBase ? { key: 'bm', e: '🌱', name: 'ベースモン', sub: `${(data.unlocked || []).length}体`, on: onBase, attr: { 'data-msx-home-basemon': true } } : null,
    onBox ? { key: 'box', e: '📦', name: 'マスモンボックス', sub: `${data.box.mons.length}/${data.box.cap}`, on: onBox, attr: { 'data-msx-r3-openbox': true } } : null,
    typeof MonsucRankScreen === 'function' ? { key: 'rank', e: '🏆', name: 'ランキング', on: onRank, attr: {} } : null,
    typeof MsxDex === 'function' ? { key: 'dex', e: '📖', name: 'イベント図鑑', on: () => setDex(true), attr: { 'data-msx-dex-home': true } } : null,
  ].filter(Boolean);
  return (
    <>
      {dex && typeof MsxDex === 'function' ? <MsxDex aid={s ? s.aid : 'mua'} nick={run ? run.nick : ''} onClose={() => setDex(false)}/> : null}
      {/* モンサクの最初の画面の名前は「モンサクルーム」(ゲーム全体の HOME と言い分ける。r1119-049 窓-33) */}
      <MsxHd back="HOMEへ戻る" onBack={onClose} sub="モンサクルーム"/>
      <div className="v-body v-hm">
        <div className="v-scene hm">
          <img className="bg" src={msxSceneBg(s ? s.turn : 1).bg} alt=""/><div className="sh"/>
          {s ? <><div className="gr"/><MsxMonArt run={run} className="mon"/><span className="v-nm">{run.nick}<small>{msxMonName(s.species)}</small></span></> : <MsxHomeDeco data={data}/>}
          <div className="v-hm-logo"><img src={MSX_LOGO_ART} alt="モンヒロサクセス"/>{typeof MsxBetaMark === 'function' ? <MsxBetaMark/> : null}</div>
        </div>
        {s ? (
          <button type="button" className="v-hm-cont" onClick={onContinue} data-msx-home-cont>
            <span className="t">{s.over ? '▶ 結果を見る' : '▶ 続きから'}</span>
            <span className="d">{run.nick}({msxMonName(s.species)})・{msxAidName(s.aid)}編</span>
            <span className="d2">{s.over ? 'この育成は終わりました(引退の続きから)' : `${v.period.name}・残り${v.period.left}ターン`}</span>
          </button>
        ) : <div className="v-hm-lead">育てるモンスターを選んで、46ターンの育成を始めよう<small>編成の6体が集まったトレーニングほど、よく伸びる</small></div>}
        <button type="button" className={s ? 'v-hm-new' : 'v-big v-hm-new'} onClick={onNew} data-msx-home-new>🌱 新しく育成を始める</button>
        {tiles.length ? (
          <div className={`v-hm-tiles${tiles.length > 3 ? ' t4' : ''}`}>
            {tiles.map((t) => <button key={t.key} type="button" className="v-hm-tile" onClick={t.on} {...t.attr}><span className="e">{t.e}</span><b>{t.name === 'マスモンボックス' ? <>マスモン<wbr/>ボックス</> : t.name}</b>{t.sub ? <small>{t.sub}</small> : null}</button>)}
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
  const [tevAt, setTevAt] = useState({ k: '', i: 0 }); // 編成の子のイベントの拍の位置(56-monsuc-tevent.jsx・6つの拍。-1 = 飛ばして結果だけ)。保存しない
  const [askLeave, setAskLeave] = useState(false); // 能力の画面で、決定していない振り分けがあるまま戻るとき(r1115-202 L8)
  const [sel, setSel] = useState(null);
  // トレーニングを選ぶ画面: 場面か丸いボタンの列を左右にスライドすると、となりのトレーニングに替わる(2026-11-14 社長「スライドでも動くようにして」)。
  //   左へスライドで次・右へで前。端で止める。横に 48px 以上、しかも縦の動きより大きいときだけ替える(縦のスクロールやタップの邪魔をしない)
  const swipeRef = useRef(null);
  const [swipe, setSwipe] = useState({ n: 0, dir: 0 });
  // 下のトレーニングの札の列: 指を置いたまま左右になぞると、指の下の札がその場で浮き上がって選ばれる(2026-11-15 r1115-002 社長が参考の録画を見せて)。
  //   通った跡に白い細い線を少し残す。離した所の札が選ばれたまま。替わるたびにタップ音(既存の効果音 tap・SE の音量に従う)
  const scrubRef = useRef(null);
  const [trail, setTrail] = useState(null); // { pts: [{x,y}], live, w, h }
  useEffect(() => () => { if (onSub) onSub('main'); }, []);
  // 期の区切りの演出(56-monsuc-kifx.jsx)を見終えたターン(保存しない。読み直したときはもう一度出る)
  const [kiAt, setKiAt] = useState(null);
  // トレーニングしている場面(56-monsuc-actfx.jsx)をまだ見せていないターン。押した直後だけ立てる(読み直したときは出さない・保存しない)
  const [actAt, setActAt] = useState(null);
  // 押す前の育成(演出のあいだ、上の帯に結果を先に見せない。Fable の点検 ①-11。保存しない)
  const [actFrom, setActFrom] = useState(null);
  const [sheet, setSheet] = useState(null); // 'log' | 'menu' | 'dex'
  const [detail, setDetail] = useState(false); // 場面の「くわしく」= モンスターの詳細(見るだけ)。「能力」とは別の画面(2026-11-14 社長「役割で分ける」)
  const [detailTech, setDetailTech] = useState(null); // 能力画面の技名から詳細を開いたとき、最初に見せる技(Issue #6807 UI-4)
  const [careSel, setCareSel] = useState('rest'); // 休む・遊ぶ・通院を選ぶ画面で選んでいる行動(Issue #6807 UI-2)
  // 期末の大会・最後の大会の当日(2026-11-14 社長「参考資料どおりに」・参考 te-30〜34): 芯が battle を立てても、すぐ組み合わせ表へは行かない。
  //   ① 当日のメイン(ボタンは「能力」と「大会(本番)」だけ)→ ② 受付に1つだけ → ③ 参加の確認 →「はい」で ④ 紋章の入り → ⑤ 表(MsxR3Battle)
  //   「はい」を押した大会だけ preAt に持つ(保存しない。読み直したら当日のメインからもう一度)。やり直し・デビュー戦の再挑戦・勝ち負けのあとは挟まない
  const [preAt, setPreAt] = useState(null);
  const [preDesk, setPreDesk] = useState(false);
  const preB = run.phase === 'battle' && s.battle && s.battle.kind !== 'cup' ? s.battle : null;
  const preKey = preB ? `${s.turn}|${preB.kind}|${preB.round || 0}` : null;
  const preOn = !!(preB && typeof MsxR3PreDesk === 'function' && !preB.retry && !preB.again && !(run.out && run.out.r3) && !run.showPend && !run.r3skip && preAt !== preKey);
  const [, setScriptTick] = useState(0);
  // 台本(共通 + 助手の分)を読む。読み終わったら描き直して台詞を出す
  useEffect(() => { let alive = true; msxScriptLoad(s.aid).then(() => { if (alive) setScriptTick((n) => n + 1); }); return () => { alive = false; }; }, [s.aid]);
  // 演出のあいだは演出の場面の音(2026-11-14 社長「演出に音を」)。トレーニングの結果の音は、演出が終わって結果の字が出たときに鳴らす
  const actOn = run.phase === 'result' && actAt === s.turn && typeof MsxTrainAct === 'function';
  const kiOn = run.phase === 'turn' && typeof MsxKiShow === 'function' && v.period && v.period.at === 1 && v.period.index > 0 && kiAt !== s.turn;
  // 大会(試合)・修行・決着・引退は、その画面(56-monhero-success-r3-*.jsx)が自分で場面の音を鳴らす。ここで main を鳴らすと後から上書きするので何もしない
  const childSound = typeof MsxR3 === 'function' && ((run.phase === 'battle' && !preOn) || run.phase === 'over' || !!s.over || sub === 'cup' || sub === 'shugyo');
  // トレーニングを選ぶ画面は育成中の曲のまま。「◯◯をする」を押して動きが始まってからトレーニングの曲(2026-11-14 社長)。結果の場面は曲を替えないので、メインへ戻るまで続く
  const soundId = childSound ? null : actOn ? 'training' : kiOn ? 'kiShow' : run.phase === 'awake' && run.out && run.out.fire && typeof MsxAwakeShow === 'function' ? 'awakeShow' : run.phase === 'awake' && run.out && run.out.fire ? (run.out.fire.kind === 2 ? 'trainGreat' : 'trainLvUp') : run.phase === 'result' && run.out && MSX_REST_SOUND[run.out.kind] ? MSX_REST_SOUND[run.out.kind] : run.phase === 'result' && run.out && run.out.result ? ((typeof msxTfxResSound === 'function' && msxTfxResSound(run.out)) || MSX_RES_SOUND[run.out.result]) : run.phase === 'issa' ? 'issa' : s.over === 'gameover' ? 'gameOver' : 'main';
  msxUseScene(soundId, { season: msxCalendar(s.turn).season });
  // 演出のあいだは「fx」と知らせて、説明の窓を出さない(結果が出てから出す)
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
  // 育成方針が変わったら、そのターンのあいだ助手が一言知らせる(甘え度と恐れ度の差で決まる・r1115-059)。育成ごとに前に見た方針を覚えておく
  const polNow = Math.max(-3, Math.min(3, Number(s.pol) || 0));
  const polRec = (MSX_POL_SEEN[run.id] = MSX_POL_SEEN[run.id] || { pol: polNow, note: null });
  if (polRec.pol !== polNow) { polRec.note = { turn: s.turn, from: polRec.pol, to: polNow }; polRec.pol = polNow; }
  const polSay = polRec.note && polRec.note.turn === s.turn ? polRec.note : null;
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
  // 叱る・褒めるの段へ。場面が無い(ふつうの成功など)ときは段を出さず、「なにもしない」として進める(2026-11-14 社長)
  const toReact = (r) => {
    if (typeof SUC.reactOf === 'function' && !SUC.reactOf(r.s)) { const x = SUC.react(r.s, null); afterAct({ ...r, s: x.out && x.out.ok ? x.state : r.s, phase: 'main' }); return; }
    setRun({ ...r, phase: 'react' });
  };
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
  let body = null; let foot = null; let subPanel = false;
  // はじめたばかりの育成は、1ターン目のはじめの出来事を立ててからメインへ(描いている途中で保存を書き換えないよう、あとで1回だけ)
  // 期のはじめの控え run.ki(期の区切りの演出で、期のあいだに増えた賞金と総合力を出す)もここで1回だけ取る
  // 育成の始まり: シナリオの始まりの場面(56-monsuc-intro.jsx)→ 1ターン目。部品が無いときはすぐ1ターン目へ
  useEffect(() => { if (run.phase === 'begin') { const r0 = { ...run, out: null, ki: run.ki || { p: 0, fame: Number.isFinite(run.s.fameTotal) ? run.s.fameTotal : 0, power: SUC.evaluate(run.s).power } }; if (typeof MsxRunIntro === 'function') setRun({ ...r0, phase: 'intro' }); else toMain(r0); } }, [run.phase]);
  if (phase === 'begin') return <><MsxHd back="中断" onBack={onPause}/><div className="v-body"/></>;
  // 育成のはじまり: 円盤石から生まれる演出(56-monsuc-birth.jsx・2026-11-13 社長 r1113-008)。終わったら 'begin' → 最初のターンへ
  if (phase === 'birth' && typeof MsxBirth === 'function') return <MsxBirth run={run} v={v} ev={ev} onDone={() => setRun({ ...run, phase: 'begin' })}/>;
  if (phase === 'intro' && typeof MsxRunIntro === 'function') return <><MsxHd back="中断" onBack={onPause} sub={`${msxAidName(s.aid)}編`}/><span hidden data-msx-turn={s.turn}/><MsxRunIntro key={`intro-${s.id}`} run={run} ctx={ctx} onDone={() => toMain({ ...run, out: null })}/></>;
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
    const bandS = acting && actFrom ? actFrom : null; // 演出のあいだは押す前の値
    const hpUp = !isTrain && Number.isFinite(o.hpFrom) && Number.isFinite(s.hp) ? Math.round(s.hp - o.hpFrom) : 0;
    const stDown = !isTrain && Number.isFinite(o.stFrom) ? Math.round(o.stFrom - s.stress) : 0;
    body = (<>
      {bandS ? <MsxBand s={bandS} v={SUC.peek(bandS)} ev={SUC.evaluate(bandS)} {...(isTrain ? {} : { hpFrom: o.hpFrom, stFrom: o.stFrom, gainTag: typeof MsxGaugeFx !== 'function' })}/> : <MsxBand s={s} v={v} ev={ev} {...(isTrain ? {} : { hpFrom: o.hpFrom, stFrom: o.stFrom, gainTag: typeof MsxGaugeFx !== 'function' })}/>}
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={`images/story-bg/${isTrain ? R.bg : 'monhero_plaza'}.jpg`} alt=""/><div className="sh"/>
        {acting ? <MsxTrainAct key={`act-${s.turn}`} run={run} o={o} onDone={() => { setActAt(null); setActFrom(null); }}/> : null}
        {acting ? null : isTrain && o.result === 'great' ? <div className="v-burst"/> : isTrain && o.result === 'ok' ? <div className="v-burst b2"/> : null}
        {!acting && isTrain && typeof MsxTrainResFx === 'function' ? <MsxTrainResFx run={run} o={o} layer="back"/> : null}
        <div className="gr" style={{ left: '62%', bottom: 'calc(14% - 5px)' }}/>
        {acting ? null : <MsxMonArt run={run} className="mon" live={typeof MsxLiveMon === 'function'} react={isTrain ? { kind: o.result, id: s.turn } : null} style={{ left: '62%', bottom: '14%', height: '46%', transform: o.result === 'sab' ? 'translateX(-50%) rotate(84deg)' : o.result === 'fail' ? 'translateX(-50%) rotate(-12deg)' : 'translateX(-50%) rotate(6deg)', filter: o.result === 'fail' ? 'grayscale(.5) drop-shadow(0 8px 5px #0009)' : undefined }}/>}
        {acting ? null : <div className={`v-stamp msx-pop ${isTrain ? R.cls : 'ok'}${isTrain && typeof msxTfxKind === 'function' && (msxTfxKind(o) === 'great' || msxTfxKind(o) === 'both') ? ` tfx-gold${msxTfxKind(o) === 'both' ? ' tfx-both' : ''}${typeof msxTfxOpt === 'function' && msxTfxOpt().calm ? ' calm' : ''}` : ''}`} style={(() => { const w = isTrain ? R.word : o.kind === 'rest' ? (restName || '休んだ') : ''; return w && w.length > 6 ? { fontSize: Math.max(24, Math.floor(330 / (w.length * 1.08))) } : undefined; })()}>{isTrain ? R.word : o.kind === 'rest' ? (restName || '休んだ') : o.kind === 'play' ? '遊んだ!' : o.kind === 'clinic' ? '通院' : '休み'}
          {isTrain && o.card && o.card.tags && o.card.tags.length && typeof MsxTrainResFx !== 'function' ? <small>🤝 友情タッグ ×{o.card.tags.length}{o.result === 'great' ? '・伸び ×1.5' : ''}</small> : null}</div>}
        {!acting && isTrain && typeof MsxTrainResFx === 'function' ? <MsxTrainResFx run={run} o={o} layer="top"/> : null}
        {!acting && typeof MsxBondChips === 'function' ? <MsxBondChips s={s} card={o.card} add={(SUC.BOND && SUC.BOND.train) || 8}/> : !acting && members.length ? <div className="v-chips" style={{ top: 'auto', bottom: 8 }}>{members.map((m, i) => <span key={i} className="v-chip">{msxMemberName(m)} 親密度 +{(SUC.BOND && SUC.BOND.train) || 8}</span>)}</div> : null}
      </div>
      {isTrain ? <MsxStRow who={s} stats={(!acting && typeof MsxTrainEvent === 'function' && o.event && o.event.d && o.event.d.stat && Number.isFinite(o.event.d.up) && o.event.d.up > 0) ? { ...s.stats, [o.event.d.stat]: s.stats[o.event.d.stat] - o.event.d.up } : s.stats} ups={acting ? null : gains} main={o.card && o.card.stat}/> : null}
      {acting ? <div className="v-log" style={{ visibility: 'hidden' }} aria-hidden="true" data-msx-acting-log><span className="hd2">{msxTrainIcon(o.card.stat, tlv)} {msxTrainName(o.card.stat, tlv)}をしている…</span></div> : <div className="v-log">
        {isTrain && o.lvUp ? <div className="v-lvup">⬆ トレーニングLvアップ! {MSX_STAT_ICON[o.card.stat]} {MSX_STAT_NAME[o.card.stat]} <b>Lv.{o.trainLv - 1} → Lv.{o.trainLv}</b><small>次から、{MSX_STAT_NAME[o.card.stat]}のトレーニングの基本の伸びが上がる</small></div> : null}
        {isTrain ? <><span className="hd2">{msxTrainIcon(o.card.stat, tlv)} {msxTrainName(o.card.stat, tlv)}({MSX_STAT_NAME[o.card.stat]}のトレーニング)</span><br/>
          {Object.keys(gains).length ? <>{Object.entries(gains).map(([k, g], i) => <span key={k}>{i ? '・' : ''}{MSX_STAT_NAME[k]} <b className="gu">{g > 0 ? `+${g}` : g}</b></span>)}</> : '能力は上がらなかった'}{hpLost ? <><br/><span data-msx-hp-lost>体力が <b style={{ color: '#dc2626' }}>{hpLost}</b> 下がった</span></> : null}</>
          : o.kind === 'rest' || o.kind === 'play' ? <><span className="hd2">{o.kind === 'rest' ? '🛌 休む' : '🎈 遊ぶ'}</span><br/>{typeof MsxGaugeFx === 'function' ? (hpUp > 0 || stDown > 0 ? '体力とストレスが動いた' : '体力が回復した') : <>{hpUp > 0 ? <>体力 <b className="gu" data-msx-rest-hp>+{hpUp}</b></> : '体力が回復した'}{stDown > 0 ? <>・ストレス <b className="gu">−{stDown}</b></> : null}</>}{(o.cured || []).includes('utsu') ? '。「どんより」が治った' : ''}</>
          : o.kind === 'clinic' ? <><span className="hd2">🏥 通院</span><br/>{msxClinicText(o.cured, s.yosu)}{typeof MsxGaugeFx === 'function' ? null : <><br/>{hpUp > 0 ? <>体力 <b className="gu">+{hpUp}</b></> : '体力も少し回復した'}{stDown > 0 ? <>・ストレス <b className="gu">−{stDown}</b></> : null}</>}</>
          : <><span className="hd2">🛌 休み</span><br/>{MSX_COND[o.cond] || '体調'}のため、このターンは休んだ</>}
        {o.event && typeof MsxTrainEvent !== 'function' ? <><br/><b className="ga">{msxMemberName(evMember)}</b>{o.event.story ? `との出来事 第${o.event.story}話` : 'との小さな出来事'}{evLine ? `: ${evLine.t}` : ''}</> : null}
        {o.cond && isTrain ? <><br/><b style={{ color: '#fca5a5' }}>{MSX_COND[o.cond]}</b>をしてしまった…しばらく休み</> : null}
      </div>}
      {!acting && !isTrain && (o.kind === 'rest' || o.kind === 'play' || o.kind === 'clinic') && typeof MsxGaugeFx === 'function' && (hpUp > 0 || stDown > 0)
        ? <MsxGaugeFx key={`gfx-act-${s.turn}-${o.kind}`} items={msxGfxItemsOf({ hp0: s.hp - hpUp, st0: s.stress + stDown }, s)}/> : null}
      {!acting && say && say.t ? <MsxSay aid={s.aid} ex={say.e || 'normal'} text={say.t}/> : null}
    </>);
    // 編成のモンスターとの出来事があれば、結果のあとに場面を1枚挟む(56-monsuc-tevent.jsx。とばすと飛ぶ)
    const tev = isTrain && o.event && typeof MsxTrainEvent === 'function';
    foot = <div className="v-ft"><button type="button" onClick={() => (isTrain ? afterAct({ ...run, phase: 'main' }) : afterAct(run))}>スキップ ⏭</button><button type="button" className="go" onClick={() => (tev ? setRun({ ...run, phase: 'tevent' }) : isTrain ? toReact(run) : afterAct(run))}>次へ ▶</button></div>;
  }
  // ---- トレーニングのあとの出来事の場面(56-monsuc-tevent.jsx) ----
  else if (phase === 'tevent' && run.out && run.out.event && typeof MsxTrainEvent === 'function') {
    // 出来事の間は上の帯を畳む(期・月・体力だけの細い帯)。拍は6つ(入り→場面→見せ場→台詞→結果→つづく)で、押すたびに進む
    const tk = `${s.turn}-${run.out.event.who}`; const tAt = tevAt.k === tk ? tevAt.i : 0; const tGo = (n) => setTevAt({ k: tk, i: n });
    const tSteps = typeof msxTevSteps === 'function' ? msxTevSteps(run, run.out, ctx) : [];
    const tLast = tAt < 0 || tAt >= tSteps.length - 1;
    body = <>{typeof MsxTevMini === 'function' ? <MsxTevMini s={s} v={v}/> : <MsxBand s={s} v={v} ev={ev}/>}<MsxTrainEvent key={`${s.turn}-tev`} run={run} o={run.out} ctx={ctx} at={tAt} go={tGo} onNext={() => toReact(run)}/></>;
    foot = tAt < 0
      ? <div className="v-ft"><button type="button" onClick={() => tGo(0)} data-msx-tev-replay>もう一度見る</button><button type="button" className="go" onClick={() => afterAct({ ...run, phase: 'main' })} data-msx-tev-next>次へ ▶</button></div>
      : <div className="v-ft"><button type="button" onClick={() => tGo(-1)} data-msx-tev-skip>スキップ ⏭</button><button type="button" className="go" onClick={() => (tLast ? toReact(run) : tGo(tAt + 1))} data-msx-tev-next>次へ ▶</button></div>;
  }
  // ---- 覚醒・超覚醒(56-monsuc-awake.jsx の演出)。終わったら、ターンのはじめならメインへ・ターンの終わりなら閉じる ----
  else if (phase === 'awake' && run.out && run.out.fire && typeof MsxAwakeShow === 'function') {
    const f = run.out.fire; const then = run.out.then;
    const done = () => { if (typeof msxSeenMark === 'function') msxSeenMark(f.kind === 2 ? 'aw.super' : 'aw.awake'); const next = pushLog({ ...run, out: null }, f.kind === 2 ? '超覚醒した!' : '覚醒した!'); const rest = Array.isArray(run.out.rest) ? run.out.rest : []; if (rest.length) setRun({ ...next, phase: 'awake', out: { fire: rest[0], rest: rest.slice(1), then } }); else if (then === 'item') setRun({ ...next, phase: 'main' }); else if (then === 'end') endTurnFlow({ ...next, phase: 'main' }); else toMain(next); };
    // 超覚醒の実で 覚醒 → 超覚醒 と続くとき、1つ目の演出の数字はあとの分を引いて見せる(能力はもう両方ぶん上がっている)
    const later = Array.isArray(run.out.rest) ? run.out.rest : [];
    const showRun = later.length ? { ...run, s: { ...s, stats: Object.fromEntries(Object.entries(s.stats).map(([k, x]) => [k, x - later.reduce((a, r) => a + ((r.ups && r.ups[k]) || 0), 0)])) } } : run;
    body = <MsxAwakeShow key={`${s.turn}-${f.kind}`} run={showRun} fire={f} v={v} ev={ev} line={line}/>;
    foot = <div className="v-ft"><button type="button" className="go" onClick={done} data-msx-awake-next>次へ ▶</button></div>;
  }
  // ---- 出来事(ランダムイベント・助手の連続イベント) ----
  else if ((phase === 'event' && run.out && run.out.ev) || (phase === 'story' && run.out && run.out.ep != null)) {
    body = <MsxEvent run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv}
      onDone={(r) => { const slot = run.phase === 'event' ? run.out.slot : 'story'; const next = { ...r, out: null }; if (slot === 'after') afterIssa(next); else if (slot === 'story') toMain(next, true); else setRun({ ...next, phase: 'main' }); }}/>;
  }
  // ---- 叱る/褒める ----
  else if (phase === 'react') {
    // 2026-11-14 社長: 場面(大成功・失敗・サボり・修行)ごとに選択肢を変え、選んだあとは変わった物を札で見せる
    const sc = typeof SUC.reactOf === 'function' ? SUC.reactOf(s) : (s.last && s.last.kind === 'shugyo' ? 'shugyo' : s.last && s.last.res);
    const RC = MSX_REACT[sc] || null;
    const done = run.out && run.out.reacted; // 選んだあと(結果の札)
    const loy = SUC.loyalOf(s);
    const pol = Math.max(-3, Math.min(3, s.pol || 0));
    const choose = (how) => {
      const r = SUC.react(s, how);
      if (!how || !r.out || !r.out.ok) { afterAct({ ...run, s: r.out && r.out.ok ? r.state : s, phase: 'main' }); return; }
      setRun({ ...run, s: r.state, out: { ...(run.out || {}), reacted: { how, d: r.out.d, polFrom: r.out.polFrom, scene: r.out.scene, from: { ama: s.ama, fear: s.fear, loy: loy } } } });
    };
    const resIcon = sc === 'shugyo' ? '⛰️' : (MSX_RES[sc] || MSX_RES.ok).icon;
    const resWord = sc === 'shugyo' ? '修行' : (MSX_RES[sc] || MSX_RES.ok).word;
    const chips = done ? msxReactChips(done.d, done.polFrom, s.pol) : [];
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene dk" style={{ flex: '1 1 0' }}>
        <img className="bg" src={`images/story-bg/${sc === 'shugyo' ? 'forest_evening' : (MSX_RES[sc] || MSX_RES.ok).bg}.jpg`} alt=""/><div className="sh"/>
        <div className="v-strip"/><img className={`v-body2${done ? (done.how === 'praise' ? ' rx-hop' : ' rx-sag') : ''}`} src={msxBody(s.aid, done ? (done.how === 'praise' ? 'happy' : 'normal') : sc === 'great' || sc === 'shugyo' ? 'happy' : 'troubled')} alt=""/>{done && MSX_REACT_BUB[done.how] ? <div className="rx-bub" data-msx-react-bub>{MSX_REACT_BUB[done.how][s.turn % 3]}</div> : null}
        <div className="v-chips"><span className="v-chip ylw">{resIcon} {resWord}のあと</span></div>
        <div className="v-q" data-msx-react={sc || 'none'}>
          {done ? <div className="ask" data-msx-react-done={done.how}>{(RC && RC[done.how] ? RC[done.how].after : '').replace('{mon}', run.nick)}</div>
            : <div className="ask">{RC ? RC.ask.replace('{mon}', run.nick) : `${run.nick}のようすを見守った。`}</div>}
          {!done && RC ? <div className="bt">
            {RC.order.map((how) => <button key={how} type="button" className={`v-ch${how === 'scold' ? ' b' : ''}`} onClick={() => choose(how)} data-msx-react-how={how}><span style={JA_LABEL_STYLE}>{jaWrap(RC[how].t)}</span><small style={JA_LABEL_STYLE} data-msx-react-pv={how}>{jaWrap(msxReactPreview(s, how) || (how === 'praise' ? '方針が甘い側へ' : '方針が厳しい側へ'))}</small></button>)}
            <button type="button" className="v-ch n" onClick={() => choose(null)}>なにもしない(方針はそのまま)</button>
          </div> : null}
        </div>
      </div>
      {/* 変わった数は下のゲージ(前から後へ動く)の1か所だけ。白い結果の箱は、何も変わらなかったときだけ(2026-11-20 r1119-033 育-33) */}
      {done && !chips.length ? <div className="v-log" data-msx-react-res={0}><span className="hd2">📋 結果</span><br/>変わったことはなかった</div> : <span hidden data-msx-react-res={done ? chips.length : undefined}/>}
      <div className="v-pol"><div className="l"><span>超溺愛</span><span>甘い</span><span>普通</span><span>厳しい</span><span>超スパルタ</span></div>
        <div className="m">{MSX_POLICY_SCALE.map((n, i) => <i key={n} className={i === pol + 3 ? 'on' : ''}/>)}</div>
        <div className="two">{done && done.from
          ? <MsxReactGauges from={done.from} to={{ ama: s.ama, fear: s.fear, loy }}/>
          : <><div className="v-ga"><span>🥰 甘え度</span><div className="tr"><i style={{ width: `${s.ama * 2}%`, background: 'linear-gradient(180deg,#f9a8d4,#f472b6)' }}/></div><b>{s.ama}</b></div>
          <div className="v-ga"><span>😨 恐れ度</span><div className="tr"><i style={{ width: `${s.fear * 2}%`, background: 'linear-gradient(180deg,#7dd3fc,#3b82f6)' }}/></div><b>{s.fear}</b></div></>}</div>
        <div style={{ fontSize: 10.5, color: '#cbd5e1', fontWeight: 700, marginTop: 4, ...JA_LABEL_STYLE }}>{jaWrap(`忠誠度は 甘え度と恐れ度の合計。甘すぎるとサボりやすく、厳しすぎるとストレスがたまりやすい`)}</div></div>
    </>);
    foot = done || !RC || s.reacted
      ? <div className="v-ft"><button type="button" className="go" onClick={() => afterAct({ ...run, out: run.out ? { ...run.out, reacted: undefined } : run.out, phase: 'main' })} data-msx-react-next>次へ ▶</button></div>
      : null; // 押せない「選んでね」と、上の「なにもしない」と同じ動きの「飛ばす」は外す(選ぶのは場面の3つだけ。r1119-033 窓-35)
  }
  // ---- イッサ博士 ----
  else if (phase === 'issa') {
    body = <MsxIssa run={run} setRun={setRun} v={v} ev={ev} ctx={ctx} bondLv={bondLv} onDone={(r) => endTurnFlow({ ...r, phase: 'main', out: null })}/>;
  }
  // ---- ターンが進む ----
  else if (phase === 'turn' && typeof MsxKiShow === 'function' && v.period.at === 1 && v.period.index > 0 && kiAt !== s.turn) {
    const doneKi = () => { setKiAt(s.turn); setRun({ ...run, ki: { p: v.period.index, fame: Number.isFinite(s.fameTotal) ? s.fameTotal : 0, power: ev.power } }); };
    body = <><MsxBand s={s} v={v} ev={ev}/><MsxKiShow key={`ki-${s.turn}`} run={run} v={v} ev={ev} ki={run.ki} onDone={doneKi}/></>;
    foot = <div className="v-ft">{/* 中断は左上の1つ(2026-11-19 r1119-013 ⑥ Q-4-5・M-7。下の帯にも同じ中断があった) */}<button type="button" className="go" onClick={doneKi} data-msx-ki-skip>スキップ ⏭</button></div>;
  }
  else if (phase === 'turn') {
    const cal = msxCalendar(s.turn); const prev = msxCalendar(Math.max(1, s.turn - 1));
    const P = msxSuc.core.PERIODS;
    const seasonChanged = cal.season !== prev.season;
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene msx-fade" style={{ flex: '1 1 0' }} data-msx-turn-scene><img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/><div className="gr" style={{ bottom: 'calc(8% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '8%', height: '34%' }} noPeak/><div className="v-clock">
        {/* 期と年は上の帯に出ているので、暦は月だけ(育-26) */}
        <div className="v-cal msx-pop"><div className="mth">{cal.month}<small>月</small></div><div className="old">{prev.month}月 おつかれさま</div></div>
        {/* 残りのターンは上の帯の1か所だけ(2026-11-20 r1119-033 育-19・育-26・育-95: 帯・暦の下・大会の札に同じ数が3回出ていた) */}
        {v.period.key === 'final' ? <div className="v-chip hot" style={{ position: 'static' }}>🏆 ヒーローズファイナル</div> : v.period.left <= 1 ? <div className="v-chip hot" style={{ position: 'static' }}>🏆 このあと期末の大会</div> : null}
        {seasonChanged ? <div className="v-chip" style={{ position: 'static' }}>{MSX_SEASON[cal.season]}になった</div> : null}
        <div className="v-phs">{P.map((p, i) => <span key={p.key} style={{ flex: p.len }} className={i === v.period.index ? 'now' : ''}><i style={{ width: `${i < v.period.index ? 100 : i === v.period.index ? (v.period.at - 1) / p.len * 100 : 0}%` }}/><b>{p.name.replace('期', '').replace('最後の', '最後')}</b></span>)}</div>
      </div></div>
    </>);
    // 月替わりは見せ場が無いので 1.5秒で自動で次へ(押せばすぐ進む・2026-11-20 r1119-033 育-20・育-96)。止め絵を撮る道具(webdriver)では止めておく
    foot = <div className="v-ft">{/* 中断は左上の1つ(2026-11-19 r1119-013 ⑥ Q-4-5・M-7。下の帯にも同じ中断があった) */}<MsxAutoNext key={`an-${s.turn}`} ms={1500} onGo={() => toMain({ ...run, out: null })}/><button type="button" className="go" onClick={() => toMain({ ...run, out: null })}>次へ ▶</button></div>;
  }
  // ---- 大会(中身は回3) ----
  // 大会の1戦(phase 'battle'。当日の準備 preOn のときを除く)と終わり(phase 'over')は、上の MsxR3 が受け持つ(回3)。ここへは来ない
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
    const scrubIdx = (e) => { const r = e.currentTarget.getBoundingClientRect(); return Math.max(0, Math.min(MSX_STATS.length - 1, Math.floor((e.clientX - r.left) / Math.max(1, r.width) * MSX_STATS.length))); };
    const scrubPt = (e) => { const r = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
    const scrubOn = {
      style: { touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' },
      onPointerDown: (e) => { scrubRef.current = { x: e.clientX, moved: false, last: MSX_STATS.indexOf(stat), id: e.pointerId }; },
      onPointerMove: (e) => {
        const st = scrubRef.current; if (!st) return;
        if (!st.moved) {
          if (Math.abs(e.clientX - st.x) < 6) return;
          st.moved = true; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
        }
        const i = scrubIdx(e); const p = scrubPt(e);
        setTrail((t) => ({ pts: [...(t && t.live ? t.pts : []), { x: p.x, y: p.y }].slice(-28), live: true, w: p.w, h: p.h }));
        if (i !== st.last) { st.last = i; setSel(MSX_STATS[i]); if (typeof SuccessSound !== 'undefined') SuccessSound.sfx('select'); }
      },
      onPointerUp: () => { const st = scrubRef.current; if (st && st.moved) { setTrail((t) => (t ? { ...t, live: false } : t)); setTimeout(() => setTrail(null), 600); } else { scrubRef.current = null; } },
      onPointerCancel: () => { scrubRef.current = null; setTrail(null); },
      onClickCapture: (e) => { const st = scrubRef.current; scrubRef.current = null; if (st && st.moved) { e.stopPropagation(); e.preventDefault(); } },
    };
    body = (<>
      <MsxBand s={s} v={v} ev={ev} {...bandProps}/>
      <div className={`v-scene${swipe.n ? (swipe.dir > 0 ? ' msx-swl' : ' msx-swr') : ''}`} key={`trsw${swipe.n}`} data-msx-train-swipe {...swipeOn} style={{ ...swipeOn.style, flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ left: '30%', bottom: 'calc(30% - 5px)', width: '22%' }}/><MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '30%', height: '30%' }} live/>
        {/* トレーニングの名前は下の丸と「◯◯をする」ボタンにあるので、場面の札は出さない(2026-11-20 r1119-033 観点8: 名前が3か所に出ていた) */}
        <div className="v-chips" style={{ right: 'auto', left: 7, alignItems: 'flex-start' }}>{typeof MsxBuffChips === 'function' ? <MsxBuffChips s={s}/> : null}</div>
        <div className="v-come">
          {members.map((i) => { const m = s.team[i]; const tag = s.bond[i] >= tagAt; const eff = SUC.memberEffect(m, stat, SUC.loyalOf(s)); return (
            <MsxCmTap key={i} m={m} className={`v-cm${tag ? ' tag' : ''}`} attrs={{ 'data-msx-cm': i }}><MsxPf m={m} bond={s.bond[i]} tagAt={999}/>
              <div className="tx"><div className="r1"><b>{msxMemberName(m)}</b></div><div className="afl"><small>{tag ? `🤝 タッグ +${m.tag}%` : `上がる量 +${Math.round(eff)}%`}</small>親密度<i><b style={{ width: `${s.bond[i]}%` }}/></i>{s.bond[i]}</div></div></MsxCmTap>); })}
          {card && card.aid ? <div className={`v-cm${s.aidBond >= tagAt ? ' tag' : ''}`}><MsxPf aid={s.aid} bond={s.aidBond} tagAt={999}/><div className="tx"><div className="r1"><b>{msxAidName(s.aid)}</b></div><div className="afl"><small>{s.aidBond >= tagAt ? '🤝 タッグ' : '助手'}</small>親密度<i><b style={{ width: `${s.aidBond}%` }}/></i>{s.aidBond}</div></div></div> : null}
        </div>
        {card && <div className={`v-fx${tags.length ? '' : ' plain'}`}>
          {/* 計算の途中(基本▶編成▶タッグ)は見せず、「上がる量が何倍か」と内訳を1行で(2026-11-20 r1119-033 育-22・育-105) */}
          <div className="t">{tags.length ? <span className="big">🤝 友情タッグ ×{tags.length}</span> : <span>タッグなし</span>}<span data-msx-train-mult>上がる量 <b className="mx">×{card.mult}</b></span></div>
          {/* Lv は下の丸に出ているので、ここは次の Lv までだけ(観点8) */}
          {trainLv ? <div className="v-lvx"><b>{trainLv >= 5 ? 'トレーニングLv が 一番上' : card.next ? `あと${card.next}回で Lv.${trainLv + 1}` : ''}</b><i><u style={{ width: `${card.next ? Math.max(0, 100 - card.next * 20) : 100}%` }}/></i></div> : null}
        </div>}
      </div>
      <MsxStRow who={s} stats={s.stats} ups={pv ? pv.gain : null} main={stat} preview/>
      <div className="v-trs" data-msx-train-swipe-row data-msx-train-scrub {...scrubOn}>
        {trail && trail.pts.length > 1 ? <svg className={`v-trail${trail.live ? '' : ' out'}`} width={trail.w} height={trail.h} viewBox={`0 0 ${trail.w} ${trail.h}`} aria-hidden="true"><polyline points={trail.pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
        {MSX_STATS.map((k) => { const c = msxCardOf(v, k); const lv = lvOf(c); return (
          <button type="button" key={k} className={`v-tr${c && c.tags.length ? ' tag' : ''}${k === stat ? ' sel' : ''}`} onClick={() => setSel(k)}>
            {k === stat && c ? <span className="fb" data-msx-train-fail>失敗率 {Math.round(c.fail * 100)}%</span> : null}
            <div className="o">{MSX_STAT_ICON[k]}{lv ? <i className="lv">Lv.{lv}</i> : null}</div><b className="nm">{MSX_STAT_NAME[k]}</b><small className="tn one">{msxTrainName(k, lv)}</small></button>); })}
      </div>
      {/* 下の「上がる能力・失敗率・体力」の行はやめた(2026-11-20 社長: 能力の欄の +・丸の上の失敗率・上の帯の体力に同じ物が出ている)。空いた分は場面が伸びて埋める */}
    </>);
    foot = <div className="v-ft">{/* 選び直すのは左上の「← 戻る」(下にも同じ矢印の戻るがあった) */}<button type="button" className="go" disabled={!card} onClick={() => doAct({ kind: card.kind, stat })}>{msxTrainIcon(stat, trainLv)} {msxTrainName(stat, trainLv)}をする</button></div>;
  }
  // ---- 休む・遊ぶ・通院を選ぶ(Issue #6807 UI-2: 入口の1タップで即確定せず、選ぶ前に見込みを出し、共通位置の実行ボタンで確定。トレーニングと同じ形) ----
  else if (sub === 'care') {
    const canC = v.can || [];
    const careKinds = [
      { kind: 'rest', e: '🛌', nm: '休む', tn: '体力を回復', ok: true },
      { kind: 'play', e: '🎈', nm: '遊ぶ', tn: '体力+・甘え+', ok: true },
      { kind: 'clinic', e: '🏥', nm: '通院', tn: 'ようすを治す', ok: canC.includes('clinic') },
    ];
    const selCare = careKinds.find((c) => c.kind === careSel && c.ok) || careKinds[0];
    const cp = typeof SUC.carePreview === 'function' ? SUC.carePreview(s, selCare.kind) : null;
    const sgn = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
    const yosuName = { sabori: 'サボりグセ', utsu: 'どんより' };
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <div className="v-scene" style={{ flex: '1 1 0' }}>
        <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
        <div className="gr" style={{ bottom: 'calc(8% - 5px)' }}/><MsxMonArt run={run} className="mon" style={{ bottom: '8%', height: '34%', opacity: .9 }} live/>
      </div>
      <div className="v-trs" data-msx-care-row style={{ display: 'flex', gap: 6 }}>
        {careKinds.map((c) => (
          <button type="button" key={c.kind} className={`v-tr${c.kind === selCare.kind ? ' sel' : ''}`} style={{ flex: 1 }} disabled={!c.ok} onClick={() => setCareSel(c.kind)} data-msx-care={c.kind}>
            <div className="o">{c.e}</div><b className="nm">{c.nm}</b><small className="tn one">{c.tn}</small>{c.kind === selCare.kind ? <span className="ke" data-msx-care-ok>選択中</span> : null}</button>))}
      </div>
      <div className="v-trsum" data-msx-care-sum style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
        {selCare.kind === 'rest' && cp ? <>
          <span>体力の回復は抽選です</span>
          {cp.list.map((r) => <span key={r.key}>{r.name}: 体力 <b>+{r.hp}</b>(<b>{Math.round(r.p * 100)}%</b>)</span>)}
          <span>ストレス <b>{sgn(cp.stress)}</b></span>
        </> : selCare.kind === 'play' && cp ? <>
          <span>体力 <b>+{cp.hp}</b>・ストレス <b>{sgn(cp.stress)}</b>・甘え度 <b>{sgn(cp.ama)}</b></span>
          {cp.curesUtsu ? <span>どんよりが治ります</span> : null}
        </> : selCare.kind === 'clinic' && cp ? <>
          {cp.list.map((r) => <span key={r.key}>{yosuName[r.key]}が治る見込み <b>{Math.round(r.p * 100)}%</b>{r.again ? '(前回治らなかったので、今回は必ず治ります)' : '(治らなくても、次は必ず治ります)'}</span>)}
          <span>体力 <b>+{cp.hp}</b></span>
        </> : <span>{selCare.nm}の見込みは出せません</span>}
      </div>
    </>);
    foot = <div className="v-ft">{/* 選び直すのは左上の「← 戻る」 */}<button type="button" className="go" disabled={!selCare.ok || (selCare.kind === 'clinic' && !cp)} onClick={() => doAct({ kind: selCare.kind })} data-msx-care-go>{selCare.e} {selCare.nm}{selCare.kind === 'clinic' ? 'する' : ''}</button></div>;
  }
  // ---- メイン ----
  else {
    const can = v.can || [];
    const anyTag = MSX_STATS.some((k) => { const c = msxCardOf(v, k); return c && c.tags.length; });
    const yosu = s.yosu && (s.yosu.sabori || s.yosu.utsu);
    const omenK = s.omen && (s.omen.k === 1 || s.omen.k === 2) ? s.omen.k : 0; // 覚醒の前触れ(助手が気づく)
    const pkI = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : { state: null }; // 成長のピーク(予告は2〜3ターン前)
    const preName = preOn && typeof msxR3BattleName === 'function' ? msxR3BattleName(SUC, preB) : '';
    const polTxt = polSay ? `育成方針が「${MSX_POLICY_SCALE[polSay.to + 3]}」に変わったよ` + (polSay.to === 0 ? '' : polSay.to < 0 ? '(甘え度が恐れ度より多いと甘くなる)' : '(恐れ度が甘え度より多いと厳しくなる)') : '';
    const sayL = polTxt ? { t: polTxt, e: 'normal' } : preOn ? line('turn.cup.before', `ついに今日は ${preName}だね! 準備ができたら「大会」へ行こう`, { cup: preName }) : omenK ? line(omenK === 2 ? 'turn.awake.omen2' : 'turn.awake.omen', omenK === 2 ? 'あれ…また体が光ってる？ 虹色だ…' : 'あれ？ 体がうっすら光ってない…？')
      : pkI.state === 'soon' && pkI.in >= 2 && !yosu && !s.cond ? line('turn.peak.soon', 'もうすぐ伸びどきが来そうだよ！') : yosu ? line(s.yosu.sabori ? 'turn.mood.sabori' : 'turn.mood.utsu', 'ようすが気になるね…') : s.cond ? line(`turn.cond.${s.cond.kind === 'away' ? 'runaway' : s.cond.kind === 'ill' ? 'sick' : 'injury'}.in`, '今日は休ませてあげよ') : line(msxStartScene(s), '今月はどうする?');
    const cal = msxCalendar(s.turn); const scn = msxSceneBg(s.turn);
    const low = s.hp < s.hpMax * 0.3;
    const bag = Object.keys(s.bag || {}).filter((k) => s.bag[k] > 0);
    body = (<>
      <MsxBand s={s} v={v} ev={ev}/>
      <MsxSay aid={s.aid} ex={omenK ? (sayL.e || 'surprise') : yosu || low ? 'troubled' : (sayL.e || 'happy')} text={sayL.t}/>
      <div className="v-scene home">
        <img className="bg" src={scn.bg} alt=""/><div className="sh"/>
        <div className="msx-roam" data-msx-roam><div className="msx-roam-h"><div className="msx-roam-f"><div className="gr"/><MsxMonArt run={run} className={`mon${low ? ' low' : ''}`} live/></div></div></div>
        <div className="v-chips"><span className="v-chip">{MSX_SEASON[cal.season]}・{scn.time}</span>
          {/* ヒーローズファイナルの間・期末の大会の当日は、上の帯と大会のボタン・吹き出しに出るので、場面の札は出さない(r1119-033 育-49・再点検 バ-01) */}
          {v.period.key === 'final' || preOn ? null : v.period.left <= 1 ? <span className="v-chip hot" data-msx-cup-soon>🏆 このあと期末の大会</span> : null}
          {/* ピークが何に効くかを札の中に書く(2026-11-20 r1119-033 育-108) */}
          {pkI.state === 'in' ? <span className="v-chip hot" data-msx-peak-chip>🔥 ピーク中 あと{pkI.left}ターン<small className="v-chip-sub">トレーニングの伸びが一番大きい</small></span> : pkI.state === 'soon' ? <span className="v-chip ylw" data-msx-peak-chip>🔥 もうすぐ伸びどき<small className="v-chip-sub">あと{pkI.in}ターンで ピーク</small></span> : null}
          <MsxYosuChips s={s}/>
          {s.cond ? <span className="v-chip bad">🤕 {MSX_COND[s.cond.kind]}(あと{s.cond.left})</span> : null}
          {typeof MsxBuffChips === 'function' ? <MsxBuffChips s={s}/> : null}</div>
        <span className="v-nm">{run.nick}</span>
      </div>
      {/* 編成・持ち物・詳細は風景の下にまとめる(2026-11-16 UI改修: 風景に重ねず、下の帯でいつも同じ場所に) */}
      <div className="v-under">
        <div className="v-party row"><small>編成</small>{s.team.map((m, i) => <MsxPf key={i} m={m} bond={s.bond[i]} tagAt={tagAt}/>)}<MsxPf aid={s.aid} bond={s.aidBond} tagAt={tagAt}/></div>
        <button type="button" className="v-bagb st" onClick={() => setSub('bag')}>🎒<small>持ち物</small>{bag.length ? <i>{bag.length}</i> : null}</button>
        <button type="button" className="v-bagb st" data-msx-detail-open onClick={() => { setDetailTech(null); setDetail(true); }}>🔍<small>詳しく</small></button>
      </div>
      <MsxStRow who={s} stats={s.stats}/>
      {preOn ? (
        <div className="v-act v-act-pre" style={{ gridTemplateColumns: '1fr 1.5fr' }} data-msx-pre-main>
          <button type="button" className="v-p" onClick={() => setSub('stats')}><div className="e">📊</div>能力{s.pts ? <small className="pt" data-msx-pts>能力P <b>{s.pts}</b></small> : <small>技・型・編成</small>}</button>
          <button type="button" className="v-p main hb" onClick={() => setPreDesk(true)} data-msx-r3-precup><span className="hbt">本番</span>🏆 大会<small>{preName}</small></button>
        </div>
      ) : can.includes('retry') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'retry' })}>🏆 デビュー戦に再挑戦<small>勝つまでトレーニングはできない(負けるたび相手が少し弱くなる)</small></button></div>
      ) : can.includes('cond') ? (
        <div className="v-act" style={{ gridTemplateColumns: '1fr' }}><button type="button" className="v-p main" onClick={() => doAct({ kind: 'cond' })}>🛌 休む<small>{MSX_COND[s.cond && s.cond.kind] || '体調'}のため、このターンは休み</small></button></div>
      ) : (<>
        {/* 上の段は 1:2:1 にして、下の段の4つと縦の線をそろえる(2026-11-20 r1119-033 育-205・育-227) */}
        <div className="v-act" style={{ gridTemplateColumns: '1fr 2fr 1fr' }}>
          <button type="button" className="v-p" onClick={() => { setCareSel('rest'); setSub('care'); }}><div className="e">🛌</div>休む<small>体力を回復</small></button>
          <button type="button" className="v-p main" onClick={() => setSub('train')}>💪 トレーニング<small>{anyTag ? '🤝 友情タッグのチャンスあり' : '6つのトレーニングから選ぶ'}</small></button>
          <button type="button" className="v-p" onClick={() => setSub('stats')}><div className="e">📊</div>能力{s.pts ? <small className="pt" data-msx-pts>能力P <b>{s.pts}</b></small> : <small>技・型・編成</small>}</button>
        </div>
        <div className="v-act" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <button type="button" className={`v-p ${yosu ? 'hosp' : 'off'}`} disabled={!can.includes('clinic')} onClick={() => { setCareSel('clinic'); setSub('care'); }}><div className="e">🏥</div>通院<small>{yosu ? 'ようすを治す' : 'いまは不要'}</small>{yosu ? <span className="bd r">!</span> : null}</button>
          <button type="button" className="v-p" onClick={() => { setCareSel('play'); setSub('care'); }}><div className="e">🎈</div>遊ぶ<small>体力+・甘え+</small></button>
          {/* 体力が足りないと行けない(r1115-062)。押せない見た目にして足りない数を出す*/}
          {(() => { const sh = (v.shugyo && v.shugyo.short) || 0; return <button type="button" className={`v-p${sh ? ' off' : ''}`} disabled={sh > 0} onClick={() => setSub('shugyo')} data-msx-shugyo-hp={sh || undefined}><div className="e">⚔</div>修行{sh ? <small className="hpng">体力があと<b>{sh}</b><br/>足りない</small> : <small>技を覚える</small>}</button>; })()}
          <button type="button" className={`v-p${Array.isArray(v.cups) && !v.cups.length ? ' off' : ''}`} disabled={Array.isArray(v.cups) && !v.cups.length} onClick={() => setSub('cup')}><div className="e">🏆</div>大会<small>{Array.isArray(v.cups) && !v.cups.length ? (v.period.key === 'final' && v.period.at >= 3 ? 'HFは このあと' : '今月はなし') : '今月の大会'}</small></button>
        </div>
      </>)}
    </>);
    foot = <div className="v-ft">{/* 中断は左上の1つ(2026-11-19 r1119-013 ⑥ Q-4-5・M-7。下の帯にも同じ中断があった) */}<button type="button" onClick={() => setSheet('log')}>📖 記録</button><button type="button" onClick={() => setSheet('menu')}>☰ メニュー</button></div>;
    if (sub === 'bag') body = <MsxBag run={run} setRun={setRun} v={v} ev={ev} onClose={() => setSub('main')}/>;
    if (sub === 'stats') body = <MsxStats run={run} setRun={setRun} v={v} ev={ev} onClose={() => setSub('main')} onOpenTech={(id) => { setDetailTech(id); setDetail(true); }}/>;
    // 持ち物・能力を開いている間は、左上が「← 戻る」(パネルを閉じる)。下の帯は出さず、中身を下まで使う(2026-11-19 r1119-013 ⑥ M-2・M-3・M-7)。
    //   前は左上の「← 中断」が押せるままで、パネルを閉じるつもりで押すと確認なしに育成から出た。下にも「← 戻る」があり出口が2つだった
    if (sub === 'bag' || sub === 'stats') { foot = null; subPanel = true; }
  }

  return (
    <>
      {/* 詳しく・記録・メニューの窓を開いている間も、左上は「← 戻る」(その窓を閉じる)。中断は確認なしに抜けるので、窓の上からは押させない(M-2) */}
      {(detail || sheet) && !subPanel ? <MsxHd back="戻る" onBack={() => (detail ? setDetail(false) : setSheet(null))} sub={`${msxAidName(s.aid)}編`}/>
        : (sub === 'train' || sub === 'care') && phase === 'main' && !run.out ? <MsxHd back="戻る" onBack={() => { setSub('main'); setSel(null); }} sub={sub === 'train' ? 'トレーニング' : '休む・遊ぶ'}/>
        : subPanel ? <MsxHd back="戻る" onBack={() => (sub === 'stats' && msxPtDraftN > 0 ? setAskLeave(true) : setSub('main'))} sub={sub === 'bag' ? '持ち物' : '能力'}/>
        : <MsxHd back="中断" onBack={onPause} sub={`${msxAidName(s.aid)}編`}/>}
      <div className="v-body">{body}</div>
      {foot}
      {askLeave ? <div className="msx-ov msx-fade" data-msx-leave-ask><div className="msx-sheet">
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>決定していない振り分けがあります。戻ると、その分は消えます(能力ポイントは減りません)</div>
        <button type="button" className="msx-btn go" onClick={() => { setAskLeave(false); msxPtDraftN = 0; setSub('main'); }} data-msx-leave-yes>戻る(振り分けを消す)</button>
        <button type="button" className="msx-btn sub" onClick={() => setAskLeave(false)}>続けて振る</button></div></div> : null}
      {detail && typeof MsxMonDetail === 'function' ? (() => {
        const pk = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : null;
        const peak = pk && Number.isInteger(pk.from) ? (() => { const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name; return a === b ? a : `${a}〜${b}`; })() : '';
        return <MsxMonDetail species={s.species} name={run.nick} sub={msxMonName(s.species)} art={<MsxMonArt run={run} noPeak/>} st={s.stats} cap={s.cap} apt={msxAptOf(s.species)} type={s.type} peak={peak}
          grades={typeof SUC.aptGradesOf === 'function' ? SUC.aptGradesOf(s) : null} known={Array.isArray(s.techs) ? s.techs : []} mastery={s.mastery && typeof s.mastery === 'object' ? s.mastery : {}} power={ev.power} rank={ev.rank} SUC={SUC} initialTech={detailTech} pick={typeof SUC.setTechPick === 'function' && s.techPick ? { sel: s.techPick, locked: (c) => SUC.techPickLocked(s, c), onPick: (c, id) => { const n = JSON.parse(JSON.stringify(s)); if (SUC.setTechPick(n, c, id)) setRun({ ...run, s: n }); } } : null} onClose={() => { setDetail(false); setDetailTech(null); }}/>;
      })() : null}
      {sheet === 'dex' && typeof MsxDex === 'function' ? <MsxDex aid={s.aid} nick={run.nick} onClose={() => setSheet(null)}/> : null}
      {sheet && sheet !== 'dex' && (
        <div className="msx-ov msx-fade" onClick={() => setSheet(null)}>
          <div className="msx-sheet" onClick={(e) => e.stopPropagation()}>
            {sheet === 'log' ? <><h3>📖 記録</h3>{(run.log || []).length ? run.log.slice().reverse().map((l, i) => <div key={i} className="msx-note">{l.turn}ターン目: {l.t}</div>) : <div className="msx-note">まだありません</div>}</>
              : sheet === 'menu' ? <><h3>☰ メニュー</h3>
                <div className="msx-note">育成方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}(甘え度と恐れ度の差で決まる。甘え度が多いと甘く・恐れ度が多いと厳しくなる)</div>
                <div className="msx-note">成長の型: {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div>
                {typeof MsxDex === 'function' ? <button type="button" className="msx-btn sub" onClick={() => setSheet('dex')} data-msx-dex-open>📖 イベント図鑑</button> : null}
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onPause(); }}>中断する(続きから遊べる)</button>
                <button type="button" className="msx-btn sub" onClick={() => { setSheet(null); onQuit(); }}>この育成をやめる</button></>
              : null}
            <button type="button" className="msx-btn" onClick={() => setSheet(null)}>閉じる</button>
          </div>
        </div>
      )}
    </>
  );
}

// ---- 持ち物(1ターンに1個まで・ターンは進まない)。中身は芯の s.bag(育成中に使う物の数)と s.carry(はじめる前に効いている物) ----
const MSX_EXTRA_ITEM = Object.freeze({ oil: { e: '🫙', desc: '体力を上限の20%回復' }, oilyoil: { e: '🛢️', desc: '体力を上限の40%回復' }, herb: { e: '🌱', desc: 'ストレスを20下げる' },
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
  stamina: { e: '🍑', desc: '体力の最大値 +15(体力も15回復)' },
  prune: { e: '⭐', desc: '使ったターンだけ、人気の上がり ×1.5' } });
// 持ち物の絵(2026-11-15 r1115-055)。絵がある物は絵、無い物は絵文字。距離の汁は汁ごとに色を分けた小瓶(tools/success/item-icons.js)
const MSX_ITEM_IMG = Object.freeze({ elixir0: 'images/success/items/elixir-red.png', elixir1: 'images/success/items/elixir-orange.png', elixir2: 'images/success/items/elixir-green.png', elixir3: 'images/success/items/elixir-blue.png' });
// x … { e, img }。size … 絵の大きさ(px)。既定は字の1.45倍(絵の周りの余白の分だけ絵文字より大きく)
const msxItemIco = (x, size = '1.45em') => (x && x.img
  ? <img src={x.img} alt="" draggable={false} data-msx-item-img style={{ width: size, height: size, objectFit: 'contain', verticalAlign: 'middle', display: 'inline-block' }}/>
  : ((x && x.e) || '🎁'));
const msxItemView = (k) => {
  const base = MSX_ITEM_BY_ID[k]; const core = msxSuc && msxSuc.SUC.ITEMS ? msxSuc.SUC.ITEMS[k] : null; const ex = MSX_EXTRA_ITEM[k];
  return { id: k, name: (base && base.name) || (core && core.name) || k, desc: typeof msxItemFx === 'function' && msxItemFx(k) ? (base && typeof msxItemDesc === 'function' ? msxItemDesc(k) : msxItemFx(k)) : (base && base.desc) || (ex && ex.desc) || '', /* 効き目だけ(2026-11-14 社長) */ e: (base && base.e) || (ex && ex.e) || '🎁', img: MSX_ITEM_IMG[k] || null, during: core ? core.use === 'during' : !!(base && base.when === 'both') };
};
function MsxBag({ run, setRun, v, ev, onClose }) {
  const { SUC } = msxSuc;
  const s = run.s;
  const bagList = Object.keys(s.bag || {}).filter((k) => s.bag[k] > 0).map((k) => ({ ...msxItemView(k), n: s.bag[k] }));
  const carryList = (Array.isArray(s.carry) ? s.carry : []).map((k) => ({ ...msxItemView(k), n: 0, carry: true }));
  const sand = s.items ? (s.items.sand || 0) : 0; const rainbow = s.items ? (s.items.rainbow || 0) : 0;
  const [pick, setPick] = useState(bagList.length ? bagList[0].id : null);
  const usedNow = s.itemTurn === s.turn;
  // 使ったときの演出(56-monsuc-itemfx.jsx・r1115-079)。使う前と後の状態を持ち、上の帯のゲージを前の値から動かす
  const [ifx, setIfx] = useState(null);
  const t = pick ? bagList.find((x) => x.id === pick) || carryList.find((x) => x.id === pick) : null;
  const use = () => {
    if (!t || t.carry || usedNow || typeof SUC.useItem !== 'function') return;
    const r = SUC.useItem(s, t.id);
    if (!r || !r.out || !r.out.ok) return;
    const log = [...(run.log || []), { turn: s.turn, t: `${t.name}を使った` }].slice(-20);
    // 覚醒の実・超覚醒の実: その場で覚醒の演出(超覚醒の実で覚醒前なら 覚醒 → 超覚醒 の2つを続けて)。終わったらメインへ
    if (Array.isArray(r.out.fires) && r.out.fires.length && typeof MsxAwakeShow === 'function') { setRun({ ...run, s: r.state, log, phase: 'awake', out: { fire: r.out.fires[0], rest: r.out.fires.slice(1), then: 'item' } }); onClose(); return; }
    if (typeof MsxItemUseFx === 'function') setIfx({ key: t.id, e: t.e, img: t.img, name: t.name, s0: s, s1: r.state, id: `${s.turn}-${t.id}` });
    setRun({ ...run, s: r.state, log });
  };
  const blocked = t && !t.carry && typeof SUC.itemUsable === 'function' && !SUC.itemUsable(s, t.id); // 覚醒の実の期の条件・覚醒ずみ
  const ifxOn = ifx && typeof MsxItemUseFx === 'function';
  return (<>
    {ifxOn ? <MsxBand key={`ifx-${ifx.id}`} s={s} v={v} ev={ev} hpFrom={ifx.s0.hp} stFrom={ifx.s0.stress}/> : <MsxBand s={s} v={v} ev={ev}/>}
    <div className="v-scene home dk" style={{ flex: '1 1 0' }}><img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      {ifxOn ? <MsxItemUseFx key={ifx.id} run={run} fx={ifx} onDone={() => setIfx(null)}/> : null}
      <div className="v-bagw">
        {/* 見出しの「持ち物」は上の帯(戻るの横)にあるので、ここは決まりの1行だけ(育-109)。選んだ物の個数は下の札の ×N だけ */}
        <div className="t"><small>使えるのは 1ターンに1個まで・使ってもターンは進まない</small></div>{/* 閉じるは左上の「← 戻る」1つ(M-7) */}
        {t ? <div className="v-bsel"><span className="e" style={{ fontSize: 26 }}>{msxItemIco(t)}</span><div><b>{t.name}</b><small>{t.desc}</small><small className="lim">{t.carry ? '始める前から効いている' : '育成中、いつでも使える'}</small></div></div> : null}
        <div className="v-bgrid">
          {bagList.map((x) => <button type="button" key={x.id} className={pick === x.id ? 'sel' : ''} onClick={() => setPick(x.id)}><span className="e" style={{ fontSize: 22 }}>{msxItemIco(x)}</span><i>×{x.n}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode(x.name.replace('ガロエ印の', ''))}</small></button>)}
          {carryList.map((x) => <button type="button" key={`c-${x.id}`} className={`no${pick === x.id ? ' sel' : ''}`} onClick={() => setPick(x.id)}><span className="e" style={{ fontSize: 22 }}>{msxItemIco(x)}</span><small style={JA_LABEL_STYLE}>{msxItemNameNode(x.name.replace('ガロエ印の', ''))}</small></button>)}
          <div className="no"><span className="e">⏳</span><i>×{sand}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode('時渡りの砂時計')}</small></div><div className="no"><span className="e">🌈</span><i>×{rainbow}</i><small style={JA_LABEL_STYLE}>{msxItemNameNode('虹の時渡りの砂時計')}</small></div>
        </div>
        {!bagList.length && !carryList.length ? <div className="msx-note">持ちこんだ物はありません</div> : null}
        <div className="v-bnote">⏳ 時渡りの砂時計: バトルに敗北したときにやり直せる<br/>🌈 虹の時渡りの砂時計: 敗北したとき相手を変えてやり直せる<br/><span className="dim2" style={JA_WRAP_STYLE}>{jaWrap('色のうすい物は、ここでは使えません(始める前から効く物・大会で負けたときの砂時計)')}</span></div>
        <button type="button" className="v-big" style={{ fontSize: 14, padding: 9, marginTop: 0, color: '#fff' }} disabled={!t || t.carry || usedNow || blocked} onClick={use}>
          {usedNow ? 'このターンはもう使った' : blocked ? (SUC.ITEMS && SUC.ITEMS[t.id] && SUC.ITEMS[t.id].fruit ? 'この日はトレーニングできないので使えない' : 'いまは使えない') : t && !t.carry ? <>{msxItemIco(t)} {t.name}を使う</> : '使う'}</button>
      </div>
    </div>
    <MsxStRow who={s} stats={s.stats}/>
  </>);
}

// ---- 能力ポイントの刻み(1・5・10・100・MAX)と、＋/−の長押し(r1115-092。マスモン強化の bulkEnhanceUnit と同じ刻み) ----
//   育成中の振り分け(MsxStats)と、育成完了の前の振り分け(56-monhero-success-r3-retire.jsx の E3)で同じ物を使う。刻みは保存しない(開いている間だけ覚える)
const MSX_PT_UNITS = Object.freeze([1, 5, 10, 100, 'MAX']);
// 技の熟練のタブは10点で +1 なので、刻みも使う点(10P=+1・50P=+5・100P=+10)で並べる(r1115-202 M5)。使う点は刻みのとおりになる
const MSX_PT_UNITS_M = Object.freeze([10, 50, 100, 500, 'MAX']);
let msxPtUnitMem = 1;
let msxPtUnitMemM = 10;
const msxPtLimit = (u) => (u === 'MAX' ? Infinity : Math.max(1, Number(u) || 1));
const msxPtLimitM = (u, cost) => (u === 'MAX' ? Infinity : Math.max(1, Math.floor((Number(u) || 0) / (cost || 10))));
function useMsxPtUnit(mastery = false) {
  const list = mastery ? MSX_PT_UNITS_M : MSX_PT_UNITS;
  const [u, setU] = useState(() => { const m = mastery ? msxPtUnitMemM : msxPtUnitMem; return list.includes(m) ? m : list[0]; });
  return [u, (x) => { if (mastery) msxPtUnitMemM = x; else msxPtUnitMem = x; setU(x); }];
}
function MsxPtUnits({ unit, setUnit, mastery = false }) {
  return (
    <div className="msx-ptunit" role="group" aria-label="振り分けの単位" data-msx-pt-units>
      {(mastery ? MSX_PT_UNITS_M : MSX_PT_UNITS).map((x) => <button type="button" key={x} aria-pressed={unit === x} className={`chip${unit === x ? ' on' : ''}`} onClick={() => setUnit(x)} data-msx-pt-unit={x}>{x === 'MAX' ? 'MAX' : `${x}P`}</button>)}
    </div>
  );
}
// 押し続けると続けて動く(PressRepeatButton)。押したときの手は最新の物を呼ぶ(長押しの間に画面が描き直されても古い値を使わない)
function MsxPtBtn({ onPress, ...rest }) {
  const ref = useRef(onPress); ref.current = onPress;
  const fire = useCallback(() => ref.current(), []);
  return <PressRepeatButton onPress={fire} {...rest}/>;
}

// ---- 能力ポイントの振り分けの「能力」「技の熟練」タブと、技の熟練の行(r1115-198。能力ポイント10点で熟練 +1・0〜100) ----
//   技の熟練は、振り分けの並び(draft)に 'm:' + 技のID を積む。芯の spendPts が 'm:…' を熟練として扱う(保存は s.mastery に足すだけ)
function MsxPtTabs({ tab, setTab }) {
  return (
    <div className="msx-ptunit" role="tablist" aria-label="振り分け先" data-msx-pt-tabs>
      {[['stat', '能力'], ['mastery', '技の熟練']].map(([k, nm]) => <button type="button" role="tab" key={k} aria-selected={tab === k} className={`chip${tab === k ? ' on' : ''}`} onClick={() => setTab(k)} data-msx-pt-tab={k}>{nm}</button>)}
    </div>
  );
}
function MsxMasteryRows({ SUC, s, ws, techs, addOf, plus, minus }) {
  const M = SUC.MASTERY || { max: 100, boost: { pow: 0.10, hit: 0.05 } }; const cost = (SUC.PTS && SUC.PTS.mastery) || 10;
  const pc = (m, k) => `${(m / M.max * M.boost[k] * 100).toFixed(1)}%`;
  return (<>
    <div className="msx-note">{cost}点で熟練 +1(0〜{M.max})。熟練が {M.max} で、技の威力 +{M.boost.pow * 100}%・命中 +{M.boost.hit * 100}%。仮に振って「決定」で確定する</div>
    {techs.length ? techs.map((t) => { const k = `m:${t.id}`; const n = addOf(k); const m0 = Math.round(Number((s.mastery || {})[t.id]) || 0); const m1 = Math.round(Number((ws.mastery || {})[t.id]) || 0); return (
      <div key={t.id} className="msx-ab-row" data-msx-pts-mrow={t.id}><span className="n">{t.kind === 'wise' ? '📖' : '🏋️'} {t.name}<small className="sub" style={{ display: 'block', fontSize: 10, color: '#94a3b8' }}>威力 +{pc(m1, 'pow')}・命中 +{pc(m1, 'hit')}{n ? `(いまは +${pc(m0, 'pow')}・+${pc(m0, 'hit')})` : ''}</small></span>
        <span style={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{n ? <>{m0} → <b style={{ width: 'auto', color: '#fde047' }}>{m1}</b> <small style={{ color: '#fde047', fontSize: 11 }}>(+{n})</small></> : <b style={{ width: 'auto' }}>{m0}</b>}</span>
        <MsxPtBtn className="chip sym minus pt44" disabled={!n} onPress={() => minus(k)} aria-label={`${t.name}の熟練を戻す`}/>
        <MsxPtBtn className="chip on sym plus pt44" disabled={ws.pts < cost || m1 >= M.max} onPress={() => plus(k)} aria-label={`${t.name}の熟練を上げる`}/>
      </div>); }) : <div className="sub">まだ覚えている技がない</div>}
  </>);
}

// ---- 能力(能力ポイントを振る・忠誠と方針・編成の親密度) ----
let msxPtDraftN = 0; // 能力の画面の、決定していない振り分けの数(戻るときに聞くため。画面の外から見る)
function MsxStats({ run, setRun, v, ev, onClose, onOpenTech = null }) {
  // 育成中の「能力」: いじる物・育成中だけの物(能力ポイント・技・型・忠誠度と方針・編成の親密度)。能力の棒や図鑑は「くわしく」へ(2026-11-14 社長「役割で分ける」)
  const { SUC } = msxSuc;
  const s = run.s;
  const tagAt = (SUC.BOND && SUC.BOND.tag) || 80;
  // 仮振り: 画面の中だけ(draft=振った能力の順)。「決定」で初めて芯の spendPts を通して確定。画面を離れれば捨てる
  const [draft, setDraft] = useState([]);
  const replay = (list) => { let w = s; for (const k of list) { const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; } return w; };
  const ws = replay(draft);
  const addOf = (k) => draft.filter((x) => x === k).length;
  const capK = (k) => (typeof SUC.statCapOf === 'function' ? SUC.statCapOf(s, k) : 999); // 能力の上限アップ(r1115-103)
  const [unit, setUnit] = useMsxPtUnit();
  const [unitM, setUnitM] = useMsxPtUnit(true); // 技の熟練のタブ(10点で +1)
  const mCost = (SUC.PTS && SUC.PTS.mastery) || 10;
  const [ptTab, setPtTab] = useState('stat'); // 「能力」「技の熟練」(r1115-198)
  const draftRef = useRef(draft); draftRef.current = draft;
  msxPtDraftN = draft.length; useEffect(() => () => { msxPtDraftN = 0; }, []);
  const setDraftNow = (list) => { draftRef.current = list; setDraft(list); };
  const [ptWarn, setPtWarn] = useState(''); // 刻み(使うポイントの合計)では足りないときの知らせ(Issue #6807 UI-1)
  // 刻みは「使うポイントの合計」(UI-1: 10P = 合計10点ぶん。1点で+1の所と2点で+1の所をまたいでも合計で数える。技の熟練は10点で+1なので今までどおり段数で数える)
  const plus = (k) => {
    const list = draftRef.current.slice(); let w = replay(list);
    if (String(k).startsWith('m:')) { const lim = msxPtLimitM(unitM, mCost); let n = 0; while (n < lim) { const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; list.push(k); n += 1; } if (n) { setPtWarn(''); setDraftNow(list); } return; }
    const budget = msxPtLimit(unit); let n = 0; let spent = 0;
    while (true) { if (w.stats[k] >= capK(k)) break; const c = SUC.ptsCost(w, k); if (spent + c > budget) break; const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; list.push(k); spent += c; n += 1; }
    if (n) { setPtWarn(''); setDraftNow(list); }
    else if (budget !== Infinity && w.pts >= SUC.ptsCost(w, k) && w.stats[k] < capK(k)) setPtWarn(`「${unit}P」では足りないよ(この能力はいま ${SUC.ptsCost(w, k)}点で +1)`);
  };
  const minus = (k) => {
    const list = draftRef.current.slice();
    if (String(k).startsWith('m:')) { const lim = msxPtLimitM(unitM, mCost); let n = 0; while (n < lim) { const i = list.lastIndexOf(k); if (i < 0) break; list.splice(i, 1); n += 1; } if (n) { setPtWarn(''); setDraftNow(list); } return; }
    const budget = msxPtLimit(unit);
    // 戻す分も同じ刻み(使ったポイントの合計)で数える。段ごとの値段は、振った順に はじめの状態から数え直す(2点で+1の段は2点ぶん戻る)
    const costs = []; let val = s.stats[k];
    for (const x of list) { if (x !== k) continue; costs.push(SUC.ptsCost({ ...s, stats: { ...s.stats, [k]: val } }, k)); val += 1; }
    let n = 0; let back = 0;
    while (costs.length) { const c = costs[costs.length - 1]; if (back + c > budget) break; const i = list.lastIndexOf(k); if (i < 0) break; list.splice(i, 1); costs.pop(); back += c; n += 1; }
    if (n) { setPtWarn(''); setDraftNow(list); }
    else if (budget !== Infinity && costs.length) setPtWarn(`「${unit}P」では戻せないよ(最後の +1 は ${costs[costs.length - 1]}点ぶん)`);
  };
  const auto = () => { let w = replay(draft); const list = draft.slice(); while (w.pts > 0) { const k = MSX_STATS.slice().sort((x, y) => w.stats[x] - w.stats[y])[0]; const r = SUC.spendPts(w, k, 1); if (!r.out.ok) break; w = r.state; list.push(k); } setDraft(list); };
  // まとめて振りのプリセットは引退前の能力ポイント(E3)と共通(周回点検 第2回 中-5): 全部=1位の能力へ全部 / おまかせ=弱いところ順 / バランス=順ぐり
  const autoTop = () => { const k0 = (ev.top && ev.top[0]) || 'pow'; let w = replay(draft); const list = draft.slice(); while (w.pts > 0) { const r = SUC.spendPts(w, k0, 1); if (!r.out.ok) break; w = r.state; list.push(k0); } setDraft(list); };
  const autoBal = () => { let w = replay(draft); const list = draft.slice(); let moved = true; while (moved && w.pts > 0) { moved = false; for (const k of MSX_STATS) { const r = SUC.spendPts(w, k, 1); if (r.out.ok) { w = r.state; list.push(k); moved = true; } } } setDraft(list); };
  const commit = () => { if (!draft.length) return; setRun({ ...run, s: ws }); setDraft([]); };
  const used = s.pts - ws.pts;
  const lineOf = SUC.PTS && SUC.PTS.line ? SUC.PTS.line[SUC.periodOf(s.turn).key] : null;
  const own = typeof SUC.techsOf === 'function' ? SUC.techsOf(s.species) : [];
  const techs = (Array.isArray(s.techs) ? s.techs : []).map((id) => own.find((t) => t && t.id === id)).filter(Boolean);
  const pk = typeof SUC.peakInfo === 'function' ? SUC.peakInfo(s) : { state: null };
  const peakSpan = Number.isInteger(pk.from) ? (() => { const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name; return a === b ? a : `${a}〜${b}`; })() : '';
  return (<>
    <MsxBand s={s} v={v} ev={ev}/>
    <div className="msx-scroll" data-msx-ability>
      <div className="v-card pk" data-msx-pts>
        <div className="msx-row" style={{ justifyContent: 'space-between' }}><b className="h2">📊 能力ポイント</b></div>
        <div className="msx-row" style={{ justifyContent: 'space-around', margin: '6px 0' }}>
          <div className="v-num"><small>使う点</small><b style={{ color: used ? '#fde047' : undefined }}>{used}</b></div>
          <div className="v-num"><small>残りの点</small><b>{ws.pts}</b></div>
        </div>
        <MsxPtTabs tab={ptTab} setTab={setPtTab}/>
        <MsxPtUnits unit={ptTab === 'mastery' ? unitM : unit} setUnit={(x) => { if (ptTab === 'mastery') setUnitM(x); else setUnit(x); setPtWarn(''); }} mastery={ptTab === 'mastery'}/>
        {ptWarn ? <div className="msx-note" style={{ color: '#fbbf24' }} data-msx-pt-warn>{ptWarn}</div> : null}
        {ptTab === 'mastery' ? <MsxMasteryRows SUC={SUC} s={s} ws={ws} techs={techs} addOf={addOf} plus={plus} minus={minus}/> : <>
        <div className="msx-row msx-pt-bulk" style={{ gap: 6, marginBottom: 6 }}><span style={{ fontSize: 10, color: '#cbd5e1', alignSelf: 'center' }}>まとめて</span><button type="button" className="chip" disabled={!ws.pts} onClick={autoTop}>全部 {MSX_STAT_NAME[(ev.top || [])[0]] || 'ちから'}</button><button type="button" className="chip" disabled={!ws.pts} onClick={auto}>おまかせで振る</button><button type="button" className="chip" disabled={!ws.pts} onClick={autoBal}>バランス</button></div>
        {/* 説明は短く1か所に。行ごとの「1点で +1」は2点のときだけ出す(2026-11-20 r1119-033 育-114・育-116: 同じ説明が7回・2行に詰め込まれていた) */}
        <div className="msx-note msx-kp">1点で能力 +1{lineOf ? `(${lineOf}を超えた能力は 2点で +1)` : ''}。＋で仮に振って、「決定」で確定する</div>
        {MSX_STATS.map((k) => { const n = addOf(k); const cost = SUC.ptsCost(ws, k); const over = lineOf != null && ws.stats[k] >= lineOf; return (
          <div key={k} className="msx-ab-row" data-msx-pts-row={k}><span className="n">{MSX_STAT_ICON[k]} {MSX_STAT_NAME[k]}{over ? <small className="sub" style={{ display: 'block', fontSize: 10, color: '#fbbf24' }}>2点で +1</small> : null}</span>
            {/* 上限はメインの能力の札と同じ「/999」の形で出す(育-246) */}
            <span style={{ fontSize: 12, fontWeight: 900, whiteSpace: 'nowrap' }}>{n ? <>{s.stats[k]} → <b style={{ width: 'auto', color: '#fde047' }}>{ws.stats[k]}</b> <small style={{ color: '#fde047', fontSize: 11 }}>(+{n})</small></> : <b style={{ width: 'auto' }}>{s.stats[k]}</b>}<small data-msx-cap={k} style={{ fontSize: 10, color: capK(k) > 999 ? '#f0abfc' : '#94a3b8', marginLeft: 1 }}>/{capK(k).toLocaleString()}</small></span>
            <MsxPtBtn className="chip sym minus pt44" disabled={!n} onPress={() => minus(k)} aria-label={`${MSX_STAT_NAME[k]}を戻す`}/>
            <MsxPtBtn className="chip on sym plus pt44" disabled={ws.pts < cost} onPress={() => plus(k)} aria-label={`${MSX_STAT_NAME[k]}を上げる`}/>
          </div>); })}
        </>}
        <div className="msx-row" style={{ marginTop: 8, gap: 6 }}>
          <button type="button" className="chip" style={{ flex: 1, minHeight: 44 }} disabled={!draft.length} onClick={() => setDraft([])}>元に戻す</button>
          <button type="button" className="chip on" style={{ flex: 2, minHeight: 44 }} disabled={!draft.length} onClick={commit}>決定</button>
        </div>
      </div>
      <div className="v-card" data-msx-ability-techs><div className="h2">⚔ 覚えている技 {techs.length}</div>
        {techs.length ? <div>{techs.map((t) => onOpenTech
          ? <button type="button" key={t.id} className="msx-ab-tech" style={{ font: 'inherit', color: 'inherit', cursor: 'pointer' }} onClick={() => onOpenTech(t.id)} data-msx-ab-tech={t.id}>{t.kind === 'wise' ? '📖' : '🏋️'}{t.name}</button>
          : <span key={t.id} className="msx-ab-tech">{t.kind === 'wise' ? '📖' : '🏋️'}{t.name}</span>)}</div> : <div className="sub">まだない</div>}
        <div className="sub" style={{ marginTop: 4 }}>新しい技は修行で覚える。技の名前を押すと、その技の性能が見られる</div></div>
      <div className="v-card"><div className="h2">🌱 成長の型 {typeof MASMON_CALC !== 'undefined' ? MASMON_CALC.typeOf(s.type).name : '—'}</div>
        <div className="sub">{pk.state === 'in' ? `ピーク中(あと${pk.left}ターン)。トレーニングがよく伸びる` : pk.state === 'soon' ? `あと${pk.in}ターンでピーク(伸びどき)が始まる` : peakSpan ? `伸びどき: ${peakSpan}` : ''}</div></div>
      <div className="v-card"><div className="h2">🤝 忠誠度 {SUC.loyalOf(s)}<span className="sub">(甘え度 {s.ama}+恐れ度 {s.fear})</span></div>
        <div className="sub">方針: {MSX_POLICY_SCALE[Math.max(-3, Math.min(3, s.pol || 0)) + 3]}・人気 {s.pop}・Lv {s.lv}</div>
        {msxLwList(s).length ? <div className="v-lwl" data-msx-ability-lw><div className="sub" style={{ marginTop: 4 }}>最近 甘え度・恐れ度が上がったわけ</div>
          {msxLwList(s).slice().reverse().map((x, i) => <div key={i} className="r"><i>{x.t}ターン</i><span>{msxLwWhy(x.w, true)}</span><b>{msxLwAmt(x)}</b></div>)}</div> : null}</div>
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
  // 拾い物・おすそわけ(ev.daily.find / ev.team.kin・r1113-037): もらう物の名前を台本の {item} へ。もらったかは芯の印 gift_<種類> がこのターンか
  const giftItem = view && view.item ? msxItemView(view.item) : null;
  const gotGift = giftItem && s.ev && s.ev.flags && s.ev.flags[`gift_${view.id === 'ev.team.kin' ? 'kin' : 'find'}`] === s.turn;
  const c2 = { ...ctx, bond: bondLv, cheer: view && view.cheerName, cheer2: view && view.cheer2Name, train: view && view.train ? MSX_STAT_NAME[view.train] : undefined, item: giftItem ? giftItem.name : undefined };
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
      setRun({ ...run, s: r.state, out: { ...o, picked: { scenes: [tail], before: s.stats, delta: r.out.delta || null, branch: !!r.out.branch, hp0: s.hp, st0: s.stress, ...gfxSnap(s) } } }); // r1115-056: 動いた数・結末の分かれ道も出す
      return;
    }
    const r = SUC.events.pick(s, c); if (!r.out || !r.out.ok) return;
    setRun({ ...run, s: r.state, out: { ...o, picked: { scenes: [r.out.next || (view && view.id ? `${view.id}.res` : null), r.out.scene].filter(Boolean), before: s.stats, hp0: s.hp, st0: s.stress, ...gfxSnap(s), res: r.out.res, delta: r.out.delta || null, apt: r.out.delta && r.out.delta.apt ? r.out.delta.apt : null } } });
  };
  const ups = {}; if (picked && picked.before) MSX_STATS.forEach((k) => { const d = s.stats[k] - picked.before[k]; if (d) ups[k] = d; });
  const afterLines = picked ? picked.scenes.flatMap((sc) => (evOf(sc) || { lines: [] }).lines.concat((evOf(sc) || { after: [] }).after)) : [];
  const shown = (picked && (afterLines.length || !(view && view.watch)) ? afterLines : main.lines).slice(0, 4); // 見るだけの出来事(拾い物など)は、結果のあとも台詞を残す
  const head = isStory ? `${msxAidName(s.aid)}のお話 ${o.ep === 'special' ? '特別な1話' : `第${o.ep}話`}` : isUniq ? `${msxAidName(s.aid)}の${view.title ? `「${view.title}」` : 'お話'}` : view && view.id === 'ev.self.anniv' ? '初めての育成記念日' : (view && view.head) || main.label || '育成イベント';
  const cheerIdx = view && Number.isInteger(view.cheer) ? view.cheer : null;
  const who = (l) => (l.who === 'narr' ? null : l.who === 'issa' ? 'イッサ博士' : l.who === 'mon' ? run.nick : msxAidName(l.who));
  return (<>
    {picked && Number.isFinite(picked.hp0) ? <MsxBand s={s} v={v} ev={ev} hpFrom={picked.hp0} stFrom={picked.st0} gainTag={typeof MsxGaugeFx !== 'function'}/> : <MsxBand s={s} v={v} ev={ev}/>}
    <div className="v-scene" style={{ flex: '1 1 0' }}>
      <img className="bg" src={msxSceneBg(s.turn).bg} alt=""/><div className="sh"/>
      <div className="gr" style={{ left: '30%', bottom: 'calc(30% - 5px)' }}/>
      <MsxMonArt run={run} className="mon" style={{ left: '30%', bottom: '30%', height: '17%' }} live/>
      {cheerIdx != null && s.team[cheerIdx] ? (Array.isArray(s.team[cheerIdx].colors) && s.team[cheerIdx].colors.some(Boolean) && typeof DyedMonsterImage === 'function' ? <DyedMonsterImage baseId={s.team[cheerIdx].species} src={msxMonImg(s.team[cheerIdx].species)} masuColors={s.team[cheerIdx].colors} alt="" draggable={false} className="mon" style={{ left: '70%', bottom: '30%', height: '36%' }}/> : <img className="mon" src={msxMonImg(s.team[cheerIdx].species)} alt="" style={{ left: '70%', bottom: '30%', height: '36%' }}/>)
        : isStory || isUniq || (view && view.id === 'ev.self.anniv') ? <img src={msxBody(s.aid, 'happy')} alt="" style={{ position: 'absolute', right: '-3%', bottom: '17%', height: '88%', width: '56%', objectFit: 'contain', objectPosition: 'right bottom' }}/> : null}
      {isStory && !picked ? <div className="msx-ev-tc" aria-hidden="true" data-msx-ev-title><small>{msxAidName(s.aid)}のお話</small><b>{o.ep === 'special' ? '特別な1話' : `第${o.ep}話`}</b></div> : null}
      {view && view.id === 'ev.self.peakin' && !picked ? <div className="msx-peak-card msx-pop" data-msx-peak-start>🔥 ピークが始まった!</div> : null}
      {(() => { // 見出しの共通の型(段2): 種類の帯の色と番号・題
        const an = msxAidName(s.aid);
        if (isStory) return <MsxEvHead kind="story" label={`メインストーリー ${o.ep === 'special' ? '特別な1話' : `第${o.ep}話`}`} title={`${an}のお話`}/>;
        if (isUniq) { const arc = globalThis.MONHERO_SUCCESS_ARC && globalThis.MONHERO_SUCCESS_ARC.ARC && globalThis.MONHERO_SUCCESS_ARC.ARC[s.aid]; const n = arc && Array.isArray(arc.uniq) ? arc.uniq.findIndex((u) => u.id === view.id) + 1 : 0;
          return <MsxEvHead kind="days" label={`${an}の日々${n > 0 ? ` その${n}` : ''}`} title={view.title ? `「${view.title}」` : 'お話'}/>; }
        const k = view && view.kind === 'team' ? 'team' : view && view.kind === 'cup' ? 'cup' : 'ikusei';
        return <MsxEvHead kind={k} title={head}/>;
      })()}
      <div className="v-talk">{shown.length ? shown.map((l, i) => <div key={i}>{who(l) ? <span className="who">{who(l)}</span> : null}{who(l) ? `「${l.t}」` : l.t}</div>) : <div>{picked ? '…' : 'なにか起きそうだ…'}</div>}</div>
    </div>
    {picked ? (<>
      {Object.keys(ups).length ? <MsxStRow who={s} stats={s.stats} ups={ups}/> : null}
      {typeof MsxGaugeFx === 'function' ? <MsxGaugeFx key={`gfx-${s.turn}-${picked.scenes.join('|')}`} items={msxGfxItemsOf(picked, s)}/> : null}
      {typeof MsxEvResult === 'function' && (!isStory || picked.delta) ? <MsxEvResult delta={picked.delta} hasStats={Object.keys(ups).length > 0} skip={typeof MsxGaugeFx === 'function' ? msxGfxItemsOf(picked, s).filter((x) => Math.round(x.from) !== Math.round(x.to)).map((x) => x.k) : null}/> : null}
      {isStory && Number.isInteger(o.ep) && o.ep < 4 && SUC.ASTORY && SUC.ASTORY.eps[o.ep] ? <MsxEvNext text={`第${o.ep + 1}話は ${Math.max(SUC.ASTORY.eps[o.ep].turn, s.turn + 1)}ターン目`}/> : null}
      {isStory && picked.branch ? <div className="v-log" data-msx-story-branch>🔀 この選び方で、<b className="ga">最後のお話(第4話)の結末</b>が変わる</div> : null}
      {gotGift ? <div className="v-log" data-msx-ev-gift>{msxItemIco(giftItem)} <b className="gu">{giftItem.name}</b> を手に入れた!(🎒持ち物に入った)<br/><small>{giftItem.desc}</small></div> : null}
      {picked.apt ? <div className="v-log" data-msx-ev-apt>📏 「{['零', '近', '中', '遠'][picked.apt.dist]}」の間合い適性が <b className="ga">{picked.apt.from} → {picked.apt.grade}</b> に上がった!</div> : null}
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => onDone(run)}>次へ ▶</button></div>
    </>) : choices.length ? (
      <div className="v-opts">{choices.map((ch) => (typeof MsxChoiceInfo === 'function' && seenId ? <React.Fragment key={ch.c}>
        <div className="msx-optrow"><button type="button" className="v-opt" disabled={ch.ok === false} onClick={() => choose(ch.c)}><span style={JA_LABEL_STYLE}>{jaWrap(ch.t)}</span>{ch.ok === false && ch.need ? <small data-msx-ch-need>{msxChNeedText(ch.need)}</small> : MSX_LOOK[ch.look] ? <small>{MSX_LOOK[ch.look]}</small> : null}</button>
          <button type="button" className={`msx-info sym info${info === ch.c ? ' on' : ''}`} aria-label="詳細" onClick={() => setInfo(info === ch.c ? null : ch.c)} data-msx-info={ch.c}/></div>
        <MsxChoiceInfo evId={seenId} c={ch.c} open={info === ch.c}/></React.Fragment>
        : <button type="button" key={ch.c} className="v-opt" disabled={ch.ok === false} onClick={() => choose(ch.c)}><span style={JA_LABEL_STYLE}>{jaWrap(ch.t)}</span>{ch.ok === false && ch.need ? <small data-msx-ch-need>{msxChNeedText(ch.need)}</small> : MSX_LOOK[ch.look] ? <small>{MSX_LOOK[ch.look]}</small> : null}</button>))}</div>
    ) : (
      <div className="v-ft" style={{ marginTop: 6 }}><button type="button" className="go" onClick={() => (isStory ? choose('a') : choose(null))}>次へ ▶</button></div>
    )}
  </>);
}
