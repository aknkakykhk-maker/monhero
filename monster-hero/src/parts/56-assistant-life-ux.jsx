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
  let opens = [];
  if (next && typeof assistantBondRewardRows === 'function') {
    try {
      const row = (assistantBondRewardRows(id) || []).find(r => r.level === next.level);
      if (row) {
        if (row.title) opens.push(`「${row.title}」の話し方`);
        if (row.callStyle) opens.push('呼び方の相談');
        if (row.frames && row.frames.length) opens.push('飾り枠');
        opens = opens.concat((row.rewards || []).slice(0, 2));
      }
    } catch (_) { opens = []; }
  }
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

// 「いま行くと得なこと」の行を作る。{ k, icon, text, go } の並び(得の大きい順)。go … 押したときに施設へ行く(無ければ押せない)
const assistantLifePerkRows = (life, ids, nameOf) => {
  const rows = [];
  if (!life) return rows;
  const nm = (list) => list.map(nameOf).join('・');
  const L = typeof ASSISTANT_LIFE_LINKS !== 'undefined' ? ASSISTANT_LIFE_LINKS : {};
  const go = L.goPlace || {};
  try {
    const beat = typeof rhythmAssistSessionVisitFree === 'function' ? assistantLifeAtPlace(life, ids, 'studio').filter(id => { try { return rhythmAssistSessionVisitFree(id) === true; } catch (_) { return false; } }) : [];
    if (beat.length) rows.push({ k: 'beat', icon: '🎵', text: `${nm(beat)}がビートにいます。券なしで一緒に遊べる`, go: typeof L.beatInvite === 'function' ? () => L.beatInvite(beat[0]) : null });
  } catch (_) {}
  try {
    const card = typeof assistantLifeHouseCardIds === 'function' ? assistantLifeAtPlace(life, ids, 'cardroom').filter(id => assistantLifeHouseCardIds().includes(id) && !assistantLifeCardSpent(id)) : [];
    if (card.length) rows.push({ k: 'card', icon: '🃏', text: `${nm(card)}とカードで対戦すると、ごほうび1.5倍`, go: typeof L.cardInvite === 'function' ? () => L.cardInvite(card[0]) : null });
  } catch (_) {}
  const temple = assistantLifeAtPlace(life, ids, 'temple');
  if (temple.length && !assistantLifeTempleDone()) rows.push({ k: 'temple', icon: '✨', text: `${nm(temple)}が神殿にいます。合体や転生をすると仲良し度アップ(1日1回)`, go: typeof go.temple === 'function' ? go.temple : null });
  const ranch = typeof L.masmonTrainBoost === 'function' ? assistantLifeAtPlace(life, ids, 'ranch') : [];
  if (ranch.length) rows.push({ k: 'ranch', icon: '🥚', text: `${nm(ranch)}がM/B管理にいます。トレーニングすると、その助手のマスモンも育つ`, go: typeof go.ranch === 'function' ? go.ranch : null });
  return rows;
};

// 家のいちばん上の帯。3行まで+「ほか◯件」。行を押すとその施設へ(onGo で画面を閉じてから呼ぶ)
function AssistantLifeNowPerks({ life, ids, nameOf, onGo, land = false }) {
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
