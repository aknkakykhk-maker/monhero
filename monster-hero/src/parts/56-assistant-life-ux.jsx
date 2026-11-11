// ===== 助手ライフの作り直し(2026-11-11 社長・LIFE-UX-V3-PLAN.md)。新UI(mh_assistant_life_ui_v2 が入)のときだけ使う部品 =====
//   STEP1: 部屋は「その助手とできること」を1列に並べる(縦も横も同じ並び)。行ごとに、押すと何が上がるかを出す。
//          いちばん上に、あなたとの仲良し度の道のり(次の Lv まであといくつ・そこで何が開くか)。
//   何も保存しない。数字はどれも今ある決まり(仲良し度の段階・ごほうびの表・贈り物の好み)をそのまま読むだけ

// 仲良し度の道のり。points … その助手の仲良し度の点数(無ければ Lv だけ)
function AssistantLifeBondRoad({ id, points = null, level = null, land = false }) {
  const pts = Number.isFinite(points) ? points : null;
  const lv = pts != null && typeof assistantBondLevel === 'function' ? assistantBondLevel(pts) : level;
  if (lv == null) return null;
  const next = pts != null && typeof assistantBondNext === 'function' ? assistantBondNext(pts) : null;
  const from = pts != null && typeof assistantBondStage === 'function' ? (assistantBondStage(pts).need || 0) : 0;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((pts - from) / Math.max(1, next.need - from)) * 100))) : 100;
  // 次の Lv で開くもの(プロフィールの「ごほうび一覧」と同じ表)
  const opens = next && typeof assistantLifeBondOpens === 'function' ? assistantLifeBondOpens(id, next.level) : [];
  return (
    <div className={`rounded-2xl border border-pink-300/70 bg-pink-950/60 px-3 py-2 ${land ? 'mt-1.5' : 'mt-2'}`} data-assistant-life-bond-road={lv}>
      <p className="flex items-baseline gap-2 text-[13px] font-black text-pink-50">💗 仲良し度 <b className="text-[16px]">Lv{lv}</b>
        {next && <span className="ml-auto text-[11.5px] font-bold text-pink-200" data-assistant-life-bond-road-remain={next.remain}>あと {next.remain} で Lv{next.level}</span>}
        {!next && <span className="ml-auto text-[11.5px] font-bold text-pink-200">いちばん上まで来ました</span>}
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"><i className="block h-full rounded-full bg-pink-400" style={{ width: `${pct}%` }}/></div>
      {next && opens.length > 0 && <p className="mt-1 text-[11.5px] font-bold leading-snug text-pink-100" style={{ wordBreak: 'auto-phrase' }} data-assistant-life-bond-road-opens>Lv{next.level} で: {opens.join('・')}</p>}
    </div>);
}

// 「その助手とできること」の1行。gain … 押すと上がるもの(右に出す)/why … 押せないわけ(押せないときだけ)
function AssistantLifeDoRow({ k, icon, label, sub = '', gain = '', on = null, disabled = false, why = '', tone = '' }) {
  const off = disabled || typeof on !== 'function';
  return (
    <button type="button" data-assistant-life-room-act={k} data-assistant-life-room-do={k} disabled={off} onClick={off ? undefined : on}
      className={`mt-1.5 flex w-full min-h-[48px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left active:scale-[.98] ${off ? 'border-white/10 bg-white/5 opacity-55' : `border-white/20 bg-white/10 ${tone}`}`}>
      <span className="w-7 shrink-0 text-center text-[22px] leading-none" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[14px] leading-tight text-white">{label}</b>
        {(off && why ? why : sub) && <small className="block text-[11.5px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'auto-phrase' }}>{off && why ? why : sub}</small>}
      </span>
      {gain && !off && <span className="shrink-0 text-right text-[11.5px] font-black leading-tight text-emerald-300" data-assistant-life-room-do-gain>{gain}</span>}
    </button>);
}

// ===== STEP2: 「✨ いま行くと得なこと」と施設の得(2026-11-11 社長) =====
//   どれも助手がその場所にいるあいだだけ・上限つき・ランキングに効かない。新しく保存するのは「神殿でその日もう受け取ったか」だけ
const ASSISTANT_LIFE_PERK_KEY = 'mh_assistant_life_perks_v1'; // { day: 'YYYY-MM-DD'(朝4時区切り), temple: 受け取った助手のid('' = まだ) }
const ASSISTANT_LIFE_PERK_STORE = {
  loaded: false, p: null, state: { day: '', temple: '' },
  async load() { if (this.loaded) return this.state; if (!this.p) this.p = Promise.resolve(storeGet(ASSISTANT_LIFE_PERK_KEY, null, false)).then(v => { this.state = assistantLifePerkNormalize(v); this.loaded = true; return this.state; }).catch(() => { this.loaded = true; return this.state; }); return this.p; },
};
// 保存値が無い・壊れているときは「まだ受け取っていない」
const assistantLifePerkNormalize = (v) => ({ day: v && typeof v.day === 'string' ? v.day : '', temple: v && typeof v.temple === 'string' ? v.temple : '' });
const assistantLifePerkDay = () => (typeof assistantPeerDayKey === 'function' ? assistantPeerDayKey() : '');
const assistantLifeTempleDone = () => { const s = ASSISTANT_LIFE_PERK_STORE.state; return !!s.temple && s.day === assistantLifePerkDay(); };
// 神殿・M/B管理・マーケットの得は、新UIでも旧UIでも全員に入る(2026-11-11 社長。帯「いま行くと得なこと」を見るのは新UIだけ)
const ASSISTANT_LIFE_TEMPLE_BOND = 30; // 神殿で操作を終えたときの仲良し度(assistants.js の lifeTemple。1日1回)

// その場所にいて起きている助手(出会っている人だけ)
const assistantLifeAtPlace = (life, ids, place) => (ids || []).filter(id => {
  const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, id) : null;
  return !!w && w.place === place && w.doing !== 'sleep';
});

// 神殿の得: 合体・転生などの操作を終えたとき(62-screen-masu-temple.jsx・66-screen-masu-fusion.jsx から1行で呼ぶ)、temple にいる助手の仲良し度を少し。1日1回
const assistantLifeTemplePerk = async () => {
  try {
    if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled() || typeof assistantLifeCurrent !== 'function') return null;
    await ASSISTANT_LIFE_PERK_STORE.load();
    if (assistantLifeTempleDone()) return null;
    const ids = (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : []).filter(id => typeof assistantLifeBondPointsOf === 'function' && Number.isFinite(assistantLifeBondPointsOf(id)));
    const who = assistantLifeAtPlace(assistantLifeCurrent(), ids, 'temple')[0];
    if (!who) return null;
    const next = { day: assistantLifePerkDay(), temple: who };
    ASSISTANT_LIFE_PERK_STORE.state = next; // 先に印を付ける(二重に上げない)
    try { storeSet(ASSISTANT_LIFE_PERK_KEY, next, false); } catch (_) {}
    if (typeof assistantLifeAddBondWithFx === 'function') assistantLifeAddBondWithFx(who, 'lifeTemple', ASSISTANT_LIFE_TEMPLE_BOND);
    return who;
  } catch (_) { return null; }
};

// M/B管理の得: トレーニングチケットを使ったとき(60-app.jsx の useBondXpTickets から)、ranch にいる助手のマスモンの育ちが伸びる。
//   プレイヤーの経験値は増やさない(絆ランキングに効くため)。受け口 ASSISTANT_LIFE_LINKS.masmonTrainBoost(キズナ4が assistantMasmonTrainBoost を入れる)(1日1回は向こうで数える)。無ければ何もしない。
//   返り値: 演出に足す一文('' = 何も起きなかった)
const assistantLifeRanchPerk = () => {
  try {
    const boost = typeof ASSISTANT_LIFE_LINKS !== 'undefined' && ASSISTANT_LIFE_LINKS ? ASSISTANT_LIFE_LINKS.masmonTrainBoost : null;
    if (typeof boost !== 'function' || typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled() || typeof assistantLifeCurrent !== 'function') return '';
    const ids = (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : []).filter(id => typeof assistantLifeBondPointsOf === 'function' && Number.isFinite(assistantLifeBondPointsOf(id)));
    const names = [];
    for (const id of assistantLifeAtPlace(assistantLifeCurrent(), ids, 'ranch')) {
      let ok = false; try { ok = boost(id, { source: 'ranch' }) === true; } catch (_) { ok = false; }
      if (ok) names.push(typeof assistantLifeName === 'function' ? assistantLifeName(id) : id);
    }
    return names.length ? `${names.join('・')}のマスモンも少し伸びます` : '';
  } catch (_) { return ''; }
};

// マーケットの得(開発部クラフトくんが assistantMarketPerkToday() を作る): いま market にいる起きている助手(新UIのときだけ)。いなければ null
//   マーケット側はこの関数が null のときは割引きを出さない(助手がいるあいだだけの得)
const assistantLifeMarketWho = () => {
  try {
    if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled() || typeof assistantLifeCurrent !== 'function') return null;
    const ids = (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : []).filter(id => typeof assistantLifeBondPointsOf === 'function' && Number.isFinite(assistantLifeBondPointsOf(id)));
    return assistantLifeAtPlace(assistantLifeCurrent(), ids, 'market')[0] || null;
  } catch (_) { return null; }
};

// 「いま行くと得なこと」の行を作る。{ k, icon, text, go } の並び(得の大きい順)。go … 押したときに施設へ行く(無ければ押せない)
const assistantLifePerkRows = (life, ids, nameOf) => {
  const rows = [];
  if (!life) return rows;
  const nm = (list) => list.map(nameOf).join('・');
  const L = typeof ASSISTANT_LIFE_LINKS !== 'undefined' ? ASSISTANT_LIFE_LINKS : {};
  const go = L.goPlace || {};
  try {
    const beat = typeof rhythmAssistSessionVisitFree === 'function' ? assistantLifeAtPlace(life, ids, 'studio').filter(id => { try { return rhythmAssistSessionVisitFree(id) === true; } catch (_) { return false; } }) : [];
    if (beat.length) rows.push({ k: 'beat', place: 'studio', icon: '🎵', text: `${nm(beat)}がビートにいます。券なしで一緒に遊べる`, go: typeof L.beatInvite === 'function' ? () => L.beatInvite(beat[0]) : null });
  } catch (_) {}
  try {
    const card = typeof assistantLifeHouseCardIds === 'function' ? assistantLifeAtPlace(life, ids, 'cardroom').filter(id => assistantLifeHouseCardIds().includes(id) && !assistantLifeCardSpent(id)) : [];
    if (card.length) rows.push({ k: 'card', place: 'cardroom', icon: '🃏', text: `${nm(card)}とカードで対戦すると、ごほうび1.5倍`, go: typeof L.cardInvite === 'function' ? () => L.cardInvite(card[0]) : null });
  } catch (_) {}
  const temple = assistantLifeAtPlace(life, ids, 'temple');
  if (temple.length && !assistantLifeTempleDone()) rows.push({ k: 'temple', place: 'temple', icon: '✨', text: `${nm(temple)}が神殿にいます。合体や転生をすると仲良し度アップ(1日1回)`, go: typeof go.temple === 'function' ? go.temple : null });
  // 🛍 マーケット: 助手がいるあいだ、おすすめ品1つが1割引き(1日1回)。開発部が ASSISTANT_LIFE_LINKS.marketPerkToday = assistantMarketPerkToday と入れる。それが { itemName, discountedCost, used } を返す
  try {
    const mk = assistantLifeAtPlace(life, ids, 'market');
    const pk = mk.length && typeof L.marketPerkToday === 'function' ? L.marketPerkToday() : null;
    if (pk && !pk.used && pk.itemName) rows.push({ k: 'market', place: 'market', icon: '🛍', text: `${nm(mk)}がマーケットにいます。おすすめの${pk.itemName}が1割引き(1日1回)`, go: typeof go.market === 'function' ? go.market : null });
  } catch (_) {}
  const ranch = typeof L.masmonTrainBoost === 'function' ? assistantLifeAtPlace(life, ids, 'ranch') : [];
  if (ranch.length) rows.push({ k: 'ranch', place: 'ranch', icon: '🥚', text: `${nm(ranch)}がM/B管理にいます。トレーニングすると、その助手のマスモンも育つ`, go: typeof go.ranch === 'function' ? go.ranch : null });
  return rows;
};

// 場所 id(studio・cardroom・temple・ranch・market)に「いま行くと得」があるか。帯と同じ判定(地図の札の得の印など、外から引く口)
const assistantLifePerkAt = (place, life = null, ids = null) => {
  try {
    const lf = life || (typeof assistantLifeCurrent === 'function' ? assistantLifeCurrent() : null);
    const who = ids || (typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : []).filter(id => typeof assistantLifeBondPointsOf === 'function' && Number.isFinite(assistantLifeBondPointsOf(id)));
    return assistantLifePerkRows(lf, who, x => x).some(r => r.place === place);
  } catch (_) { return false; }
};

// 家のいちばん上の帯。3行まで+「ほか◯件」。行を押すとその施設へ(onGo で画面を閉じてから呼ぶ)
function AssistantLifeNowPerks({ life, ids, nameOf, onGo, land = false }) {
  // マーケットのおすすめ品は保存を読み終えるまで出せない(開発部の assistantMarketPerkToday は読み込み中 null)。開いてから少しあと(と4秒おき)に描き直して拾う
  const [, redraw] = React.useState(0);
  React.useEffect(() => { const t = setTimeout(() => redraw(n => n + 1), 1500), i = setInterval(() => redraw(n => n + 1), 4000); return () => { clearTimeout(t); clearInterval(i); }; }, []);
  const rows = assistantLifePerkRows(life, ids, nameOf);
  const [more, setMore] = React.useState(false);
  if (!rows.length) return null;
  const shown = more ? rows : rows.slice(0, 3);
  const rest = rows.length - shown.length;
  return (
    <section className={`mx-3 ${land ? 'mb-1' : 'mb-2'} rounded-2xl border border-amber-300/60 bg-slate-950/85 p-2 text-white`} data-assistant-life-now-perks={rows.length}>
      <p className="text-[13px] font-black text-amber-200">✨ いま行くと得なこと</p>
      {shown.map(r => (
        <button key={r.k} type="button" data-assistant-life-now-perk={r.k} disabled={typeof r.go !== 'function'} onClick={() => { if (typeof r.go === 'function') onGo(r.go); }}
          className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2 py-1 text-left active:scale-[.98] disabled:opacity-60">
          <span className="w-6 shrink-0 text-center text-[20px] leading-none" aria-hidden="true">{r.icon}</span>
          <span className="min-w-0 flex-1 text-[12.5px] font-bold leading-snug" style={{ wordBreak: 'auto-phrase' }}>{r.text}</span>
          {typeof r.go === 'function' && <span className="shrink-0 text-[11px] font-black text-amber-200" aria-hidden="true">▶</span>}
        </button>))}
      {rest > 0 && <button type="button" data-assistant-life-now-perks-more className="mt-1 min-h-[36px] w-full text-right text-[11.5px] font-black text-amber-200" onClick={() => setMore(true)}>ほか {rest} 件 ▼</button>}
    </section>);
}

// ===== STEP3: タブは4つ(🏡 家・🗺 町・🤝 きずな・🏘 フレンド)。道具は「🎁 贈る」の中、引き合わせるは「きずな」へ =====
// 新UIを既定にするか。保存(mh_assistant_life_ui_v2)が true/false ならそれに従い、無い人だけこの値になる(保存は消さない・書き換えない)
const ASSISTANT_LIFE_UI_V2_DEFAULT = true; // 2026-11-11 社長: STEP3 まで出来たので新UIを既定に(旧UIは設定の「助手ライフの画面」から)
// 前に読んだ保存の値(true/false/null=無い)。画面が作り直されたときの初めの値に使う(保存には触れない)
let assistantLifeUiV2Last = null;
function assistantLifeUiV2Of(saved) { return saved === true ? true : saved === false ? false : ASSISTANT_LIFE_UI_V2_DEFAULT; }
// 新UIのタブ(下の列と、町の上の帯で同じ並び)
function assistantLifeUiV2Tabs() {
  return [['house', '🏡', '家'], ['where', '🗺', '町'], ['friends', '🤝', 'きずな'], ...(typeof alfEnabled === 'function' && alfEnabled() ? [['visit', '🏘', 'フレンド']] : [])];
}

// 引き合わせる(「きずな」の上)。2人を選ぶと、次の時間に一緒に過ごしやすくなる。決まりは今までと同じ(assistantLifeNudge('introduce'))
function AssistantLifeIntroduceCard({ ids, life }) {
  const [pick, setPick] = React.useState([]);
  const [done, setDone] = React.useState('');
  const list = (ids || []).filter(Boolean);
  if (list.length < 2) return null;
  const slot = assistantLifeSlotAt();
  const introNext = ((life && life.nudges && life.nudges.introduce) || []).find(n => n.abs === slot.abs + 1) || null;
  const nameOf = assistantLifeName;
  const go = async () => {
    if (pick.length !== 2) return;
    let ok = false; try { ok = await assistantLifeNudge('introduce', pick); } catch (_) { ok = false; }
    if (ok) { setDone(`${nameOf(pick[0])}と${nameOf(pick[1])}が、次の時間に一緒に過ごしやすくなりました`); setPick([]); }
  };
  return (
    <div data-assistant-life-introduce className="mb-2 rounded-2xl border border-sky-300/50 bg-slate-950/90 p-2.5">
      <p className="flex items-baseline gap-2 text-[14px] font-black text-sky-100">🤝 引き合わせる<span className="ml-auto text-[11px] font-bold text-emerald-300">無料</span></p>
      <p className="mb-1.5 text-[11.5px] font-bold leading-snug text-slate-200" style={{ wordBreak: 'auto-phrase' }}>2人を選ぶと、次の時間に一緒に過ごしやすくなります。言い合いのあとなら、仲直りのきっかけに。</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map(id => { const on = pick.includes(id); return (
          <button key={id} type="button" data-assistant-life-pick={id} aria-pressed={on} onClick={() => { setDone(''); setPick(p => on ? p.filter(x => x !== id) : [...p, id].slice(-2)); }}
            className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-black active:scale-95 ${on ? 'border-sky-300 bg-sky-500/40 text-white' : 'border-white/25 bg-slate-800 text-slate-100'}`}>{nameOf(id)}</button>); })}
      </div>
      <button type="button" data-assistant-life-introduce-go disabled={pick.length !== 2 || !!introNext} onClick={go}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-sky-300/60 bg-sky-500/25 px-2 text-[12.5px] font-black text-sky-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
        {introNext ? `次の時間は ${String(introNext.pair).split('-').map(nameOf).join('と')} を引き合わせます` : pick.length === 2 ? `${nameOf(pick[0])}と${nameOf(pick[1])}に、次の時間に一緒に過ごしてもらう` : '2人を選んでください'}
      </button>
      {done && <p data-assistant-life-introduce-done className="mt-1.5 rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 text-[11.5px] font-bold text-sky-100">{done}</p>}
    </div>);
}

// 「🎁 贈る」のシートの上: だれに贈るか。groups … いま一緒にいる組/soloIds … 1人に贈れる助手
function AssistantLifeGiveWho({ groups, soloIds, pairLeft = 0, soloLeft = 0, canPair = false, soloOn = false, onPair, onSolo }) {
  const nameOf = assistantLifeName;
  const gs = groups || [], ss = soloOn ? (soloIds || []) : [];
  return (
    <div data-assistant-life-give-who>
      <p className="mt-2 text-[13px] font-black text-amber-200">🤝 一緒にいる2人に贈る <span className="text-[11px] font-bold text-slate-200">今日あと {pairLeft}回</span></p>
      <p className="text-[11px] font-bold leading-snug text-slate-300">2人の友情Lv と、あなたとの仲良し度が上がります</p>
      {gs.length ? <div className="mt-1 flex flex-wrap gap-1.5">{gs.map(g => (
        <button key={g.ids.join('-')} type="button" data-assistant-life-give-who-pair={g.ids.join('-')} disabled={!canPair || pairLeft <= 0} onClick={() => onPair(g)}
          className="min-h-[44px] rounded-xl border border-amber-300/70 bg-amber-500/25 px-3 text-[12.5px] font-black text-amber-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">🎁 {g.ids.map(nameOf).join('・')} <span className="ml-1 whitespace-nowrap text-[11px] text-emerald-300">🤝💗 上がる</span></button>))}</div>
        : <p className="mt-1 rounded-xl bg-white/5 px-2 py-1.5 text-[11.5px] font-bold text-slate-300">いまは、一緒にいる組がありません(次の時間帯に)</p>}
      {soloOn && (<>
        <p className="mt-3 text-[13px] font-black text-pink-200">💗 1人に贈る <span className="text-[11px] font-bold text-slate-200">今日あと {soloLeft}回</span></p>
        <p className="text-[11px] font-bold leading-snug text-slate-300">その助手とあなたの仲良し度が上がります</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{ss.map(id => (
          <button key={id} type="button" data-assistant-life-give-who-solo={id} disabled={soloLeft <= 0} onClick={() => onSolo(id)}
            className="min-h-[44px] rounded-xl border border-pink-300/70 bg-pink-500/25 px-3 text-[12.5px] font-black text-pink-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">{nameOf(id)} <span className="ml-0.5 text-[11px] text-emerald-300">💗＋</span></button>))}</div>
      </>)}
    </div>);
}

// 「きずな」の組の行: 次の友情Lv で何が開くか(分かっているものだけ。無ければ空)
//   Lv3 … 関係図で線がつながる/特別なお話(Lv5・Lv10)/その Lv から流れる掛け合いがその2人にあるとき「新しい掛け合い」
function assistantLifePeerNextOpens(a, b, nextLv) {
  const out = [];
  try {
    const key = [a, b].sort().join('-');
    const all = [...(typeof assistantPeerTalkList === 'function' ? assistantPeerTalkList() : []), ...(typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks() : [])]
      .filter(t => t && Array.isArray(t.pair) && t.pair.length === 2 && [...t.pair].sort().join('-') === key);
    if (nextLv === 3) out.push('関係図で線がつながる');
    if (all.some(t => t.special && (t.lv || 5) === nextLv)) out.push('✦ 特別なお話');
    if (all.some(t => !t.special && t.kind !== 'quarrel' && t.kind !== 'makeup' && (t.lv || 1) === nextLv)) out.push('新しい掛け合い');
  } catch (_) { return ''; }
  return out.join('・');
}

// 設定の「助手ライフの画面」(新しい画面/前の画面)。2026-11-11 社長: 切替は助手ライフの上の帯から外して設定の中へ。
//   保存は今ある mh_assistant_life_ui_v2 だけ(true=新しい画面/false=前の画面/無い人は既定)。押したときだけ書く。置き場所は 51-screen-settings.jsx
function AssistantLifeUiSettingRow() {
  const [v2, setV2] = React.useState(() => assistantLifeUiV2Of(assistantLifeUiV2Last));
  React.useEffect(() => { let alive = true; Promise.resolve(storeGet('mh_assistant_life_ui_v2', null, false)).then(v => { assistantLifeUiV2Last = v === true || v === false ? v : null; if (alive) setV2(assistantLifeUiV2Of(v)); }).catch(() => {}); return () => { alive = false; }; }, []);
  if (typeof assistantLifeEnabled === 'function' && !assistantLifeEnabled()) return null;
  const pick = (on) => { setV2(on); assistantLifeUiV2Last = on; try { void storeSet('mh_assistant_life_ui_v2', on, false); } catch (_) {} };
  return (
    <div data-assistant-life-ui-setting className={`${SCREEN_PANEL_CLASS} w-full text-left`}>
      <b className="block text-[13px] font-black text-slate-200">助手ライフの画面</b>
      <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">助手ライフの見た目を選びます。「前の画面」は、新しい機能が入らない前の形です。助手との仲良し度やごほうびは、どちらでも同じです。</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[{ on: true, label: '新しい画面', note: 'タブ4つ・おすすめ' }, { on: false, label: '前の画面', note: '今までの形' }].map(option => (
          <button key={option.label} type="button" data-assistant-life-ui-setting-pick={option.on ? 'new' : 'old'} aria-pressed={v2 === option.on} onClick={() => pick(option.on)}
            className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl px-1 py-1.5 text-[11px] font-black leading-tight active:scale-95 ${v2 === option.on ? 'border border-cyan-400 bg-cyan-600 text-white' : 'border border-white/10 bg-slate-950 text-slate-300'}`}>
            <span className="block">{option.label}</span>
            <small className="mt-0.5 block text-[10px] font-bold opacity-80">{option.note}</small>
          </button>))}
      </div>
    </div>);
}

// ===== ❶C 毎日来る理由: 時間帯のできごと+ミッション連動+7日で道具1個(2026-11-11 社長「この形で・7日はとびとびOK」) =====
//   家の上の「得」3行の直下に1枚。時間帯(深夜/朝/昼/午後/夕方/夜)ごとに1回「聞く」と、ミッションの「助手とふれあう」に1回数える。
//   聞いた日が7日たまると 🧺 おやつバスケット(peer_gift)1個(とびとびでよい・消えない)。数字は新しく作らず、道具1個だけ
//   保存 mh_assistant_life_daily_v1 = { day, heard: [時間帯id], days: [聞いた日(最大7)], claims: 受け取った回数 }(新しいキー・足すだけ)
const ASSISTANT_LIFE_DAILY_KEY = 'mh_assistant_life_daily_v1';
const ASSISTANT_LIFE_DAILY_NEED = 7;
const ASSISTANT_LIFE_DAILY_ITEM = 'peer_gift';
const ASSISTANT_LIFE_DAILY_SCENES = Object.freeze({
  late: { icon: '🌙', text: '{n}が夜ふかしをしています', say: 'しーっ…みんなには ないしょですよ' },
  morning: { icon: '🌅', text: '{n}が朝の空気を吸っています', say: 'おはようございます。今日もいい一日になりそうですね' },
  noon: { icon: '🍙', text: '{n}がお昼ごはんを食べています', say: 'お昼はやっぱり元気が出ますね。ひとくち、どうですか' },
  afternoon: { icon: '☀️', text: '{n}がひなたでひと休みしています', say: 'ぽかぽかして、つい うとうとしてしまいますね' },
  evening: { icon: '🌇', text: '{n}が夕日を見ています', say: '夕日がきれいですね。一緒に見られて うれしいです' },
  night: { icon: '⭐', text: '{n}が星を見ています', say: '今日も一日おつかれさまでした。また明日' },
});
const assistantLifeDailySceneOf = (h) => (h < 5 ? 'late' : h < 10 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night');
const assistantLifeDailyNormalize = (v) => {
  const o = v && typeof v === 'object' ? v : {};
  const days = Array.isArray(o.days) ? o.days.filter(d => typeof d === 'string' && d).slice(-ASSISTANT_LIFE_DAILY_NEED) : [];
  return {
    day: typeof o.day === 'string' ? o.day : '',
    heard: Array.isArray(o.heard) ? o.heard.filter(s => typeof s === 'string') : [],
    days: [...new Set(days)],
    claims: Number.isFinite(o.claims) && o.claims > 0 ? Math.floor(o.claims) : 0,
  };
};
// 聞いたときの次の状態(日が変わっていれば heard を空にしてから足す)。同じ時間帯は2回数えない
const assistantLifeDailyHear = (st, slotId, day) => {
  const s = assistantLifeDailyNormalize(st);
  const heard = s.day === day ? s.heard : [];
  if (heard.includes(slotId)) return { st: { ...s, day, heard }, added: false, full: false };
  const days = s.days.includes(day) ? s.days : [...s.days, day].slice(-ASSISTANT_LIFE_DAILY_NEED);
  return { st: { ...s, day, heard: [...heard, slotId], days }, added: true, full: days.length >= ASSISTANT_LIFE_DAILY_NEED };
};
const ASSISTANT_LIFE_DAILY_STORE = {
  loaded: false, p: null, state: assistantLifeDailyNormalize(null), granter: null,
  async load() { if (this.loaded) return this.state; if (!this.p) this.p = Promise.resolve(storeGet(ASSISTANT_LIFE_DAILY_KEY, null, false)).then(v => { this.state = assistantLifeDailyNormalize(v); this.loaded = true; return this.state; }).catch(() => { this.loaded = true; return this.state; }); return this.p; },
};
// 道具を持ち物へ足す口(60-app.jsx が入れる)。足せたら true
const assistantLifeDailySetGranter = (fn) => { ASSISTANT_LIFE_DAILY_STORE.granter = typeof fn === 'function' ? fn : null; };
// 聞く。ミッションに1回数え、7日たまったら道具1個。返すのは { added, got }
const assistantLifeDailyListen = async (slotId) => {
  const S = ASSISTANT_LIFE_DAILY_STORE;
  await S.load();
  const r = assistantLifeDailyHear(S.state, slotId, assistantLifePerkDay());
  if (!r.added) return { added: false, got: false };
  let st = r.st, got = false;
  if (r.full && typeof S.granter === 'function') {
    try { got = (await S.granter(ASSISTANT_LIFE_DAILY_ITEM)) === true; } catch (_) { got = false; }
    if (got) st = { ...st, days: [], claims: st.claims + 1 };
  }
  S.state = st;
  try { await storeSet(ASSISTANT_LIFE_DAILY_KEY, st, false); } catch (_) {}
  if (typeof missionNotify === 'function') missionNotify('assistantTouch');
  return { added: true, got };
};

function AssistantLifeDailyCard({ ids, nameOf, land = false }) {
  const [st, setSt] = React.useState(() => ASSISTANT_LIFE_DAILY_STORE.state);
  const [said, setSaid] = React.useState('');
  const [got, setGot] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { let alive = true; ASSISTANT_LIFE_DAILY_STORE.load().then(s => { if (alive) setSt(s); }); return () => { alive = false; }; }, []);
  let slot = null;
  try { slot = typeof assistantLifeSlotAt === 'function' ? assistantLifeSlotAt() : null; } catch (_) { slot = null; }
  // 時間帯の数・区切りは ASSISTANT_LIFE_SLOTS から取る(6でも12でも動く)。場面は区切りの開始時刻で決める
  const slotDef = slot && Array.isArray(ASSISTANT_LIFE_SLOTS) ? ASSISTANT_LIFE_SLOTS[slot.i] : null;
  const scene = slotDef ? ASSISTANT_LIFE_DAILY_SCENES[assistantLifeDailySceneOf(slotDef.from)] : null;
  const list = Array.isArray(ids) ? ids : [];
  if (!scene || !list.length) return null;
  const day = assistantLifePerkDay();
  const done = st.day === day && st.heard.includes(slot.id);
  const who = list[slot.i % list.length];
  const leftH = (() => { const s = slotDef; const h = new Date(Date.now() + 9 * 3600000).getUTCHours(); return s ? Math.max(1, s.to - h) : 1; })();
  const n = st.days.length;
  const listen = async () => {
    if (busy || done) return;
    setBusy(true);
    const r = await assistantLifeDailyListen(slot.id);
    setSt({ ...ASSISTANT_LIFE_DAILY_STORE.state });
    setSaid(`${nameOf(who)}「${scene.say}」`);
    setGot(!!r.got);
    setBusy(false);
  };
  const T = land ? 'text-[11.5px]' : 'text-[12.5px]';
  return (
    <section className={`mx-3 ${land ? 'mb-1' : 'mb-2'} rounded-2xl border border-amber-300/60 bg-slate-950/85 p-1.5 text-white`} data-assistant-life-daily>
      <p className="flex items-center gap-2 px-1 text-[13px] font-black text-amber-200">{scene.icon} {slotDef.label}の できごと <span className="text-[10.5px] font-bold text-slate-300">あと約{leftH}時間</span></p>
      <div className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-1.5 py-1">
        <span className="w-[54px] shrink-0 text-center text-[11px] font-black leading-tight text-amber-200">{done ? '✓ 聞いた' : '🆕 いま'}</span>
        <span className={`min-w-0 flex-1 ${T} font-bold leading-snug`} style={{ wordBreak: 'auto-phrase' }}>
          {said || `${scene.text.replace('{n}', nameOf(who))}。${done ? 'この時間帯の話は聞きました' : '聞いてみると、この時間帯だけの話が聞けます'}`}
          {!done && <span className="block text-[11px] text-emerald-300">→ 聞くと 🤝 ふれあい1回(ミッション「助手とふれあう」)</span>}
          {got && <span className="block text-[11px] text-pink-200">🧺 おやつバスケットを1個もらいました！(持ち物へ)</span>}
        </span>
        {!done && <button type="button" data-assistant-life-daily-listen onClick={listen} disabled={busy} className="shrink-0 min-h-[44px] rounded-xl bg-amber-400 px-2 text-[11.5px] font-black text-slate-900 active:scale-95 disabled:opacity-60">聞く ▶</button>}
      </div>
      <div className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-1.5 py-1" data-assistant-life-daily-stamps={n}>
        <span className="w-[54px] shrink-0 text-center text-[11px] font-black leading-tight text-amber-200">🧺 7日で1個</span>
        <span className="min-w-0 flex-1">
          <span className={`block ${T} font-bold leading-snug`} style={{ wordBreak: 'auto-phrase' }}>できごとを聞いた日が7日たまると、🧺 おやつバスケット1個</span>
          <span className="mt-0.5 flex gap-1" aria-hidden="true">
            {Array.from({ length: ASSISTANT_LIFE_DAILY_NEED }, (_, i) => <i key={i} className={`grid h-5 w-5 place-items-center rounded-full text-[11px] not-italic ${i < n ? 'bg-amber-300 text-slate-900' : i === ASSISTANT_LIFE_DAILY_NEED - 1 ? 'bg-pink-400' : 'bg-slate-700'}`}>{i < n ? '✓' : i === ASSISTANT_LIFE_DAILY_NEED - 1 ? '🧺' : i + 1}</i>)}
          </span>
          <span className="block text-[11px] font-bold text-emerald-300">あと{Math.max(0, ASSISTANT_LIFE_DAILY_NEED - n)}日(とびとびでもOK・消えません)</span>
        </span>
      </div>
    </section>);
}
