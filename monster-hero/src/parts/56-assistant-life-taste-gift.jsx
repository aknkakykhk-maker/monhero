// ===== 🧸 モンスターのぬいぐるみ(好き・苦手の gift・color をオクリモノに付ける・r1115-035) =====
//   2026-11-15 社長「オクリモノに付ける」→ 窓口経由で案A・300P(案 docs/progress/assistant-peer/taste-change/GIFT-COLOR-PLAN.md)
//   1人に贈る道具の1つ(データは assistants.js の ASSISTANT_LIFE_SOLO_GIFTS の key 'monplush')。贈るときにモンスターとリボンの色を選ぶ
//   贈ると assistantLifeTasteBump(助手, モンスター, 'gift')。リボンがその助手の好きな色(favColors。淡い色も同じ色として数える)なら 'color' も
//   1日の回数・持ち物の数え方・仲良し度の量は、ほかの1人用の道具と同じ(56-assistant-life-gifts.jsx がそのまま扱う)
//   助手のひとことだけ、選んだモンスターがいまの好み(好き/ふつう/苦手)のどれかで変える
//   公開の印は好き嫌いの印 RELEASE_FLAGS.assistantLifeTaste(偽の間は贈る窓にも交換所にも出ない)
//   保存は新しいキーを足すだけ(CLAUDE.md ⑦): mh_assistant_life_taste_gift_v1 { v:1, last:{ [助手]: { mon, color, day } }, n:{ [助手]: 贈った回数 } }
//   (次に贈るとき、前に選んだものを先に選んでおくため。好みの点は mh_assistant_life_taste_v1 にマスモン部の入口が書く)
const ASSISTANT_TASTE_GIFT_KEY = 'mh_assistant_life_taste_gift_v1';
const ATG_ITEM_KEY = 'monplush';
const atgOn = () => { try { return typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.assistantLifeTaste === true; } catch (_) { return false; } };
const atgIsPlush = (kindOrKey) => kindOrKey === ATG_ITEM_KEY;
const atgMonOk = (m) => typeof m === 'string' && /^\w{2,40}$/.test(m) && typeof ALL_PLAYER_MONSTERS !== 'undefined' && !!ALL_PLAYER_MONSTERS[m];
const atgColorIds = () => (typeof MASU_COLOR_SWATCH !== 'undefined' && MASU_COLOR_SWATCH ? Object.keys(MASU_COLOR_SWATCH).filter(c => typeof MASU_COLOR_LABELS === 'undefined' || MASU_COLOR_LABELS[c]) : []);
const atgColorOk = (c) => typeof c === 'string' && atgColorIds().includes(c);
const atgColorName = (c) => (typeof MASU_COLOR_LABELS !== 'undefined' && MASU_COLOR_LABELS[c]) || c;
const atgBase = (c) => String(c || '').replace(/_light$/, '');
const normalizeAssistantTasteGift = (raw) => {
  const out = { v: 1, last: {}, n: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const last = raw.last && typeof raw.last === 'object' && !Array.isArray(raw.last) ? raw.last : {};
  for (const [aid, x] of Object.entries(last).slice(0, 40)) {
    if (!/^[a-z0-9_]{2,24}$/.test(aid) || !x || typeof x !== 'object') continue;
    out.last[aid] = { mon: atgMonOk(x.mon) ? x.mon : '', color: typeof x.color === 'string' && /^[a-z_]{2,20}$/.test(x.color) ? x.color : '', day: typeof x.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.day) ? x.day : '' };
  }
  const n = raw.n && typeof raw.n === 'object' && !Array.isArray(raw.n) ? raw.n : {};
  for (const [aid, v] of Object.entries(n).slice(0, 40)) if (/^[a-z0-9_]{2,24}$/.test(aid) && Number.isFinite(Number(v)) && Number(v) > 0) out.n[aid] = Math.min(99999, Math.floor(Number(v)));
  return out;
};
const ATG_STORE = typeof amgpMakeStore === 'function' ? amgpMakeStore(ASSISTANT_TASTE_GIFT_KEY, normalizeAssistantTasteGift) : null;
// 贈る窓で選んでいる途中のもの(保存しない)。{ [助手]: { mon, color } }
const ATG_PICK = { by: {}, subs: new Set() };
const atgSetPick = (aid, patch) => { ATG_PICK.by = { ...ATG_PICK.by, [aid]: { ...(ATG_PICK.by[aid] || {}), ...patch } }; ATG_PICK.subs.forEach(f => { try { f(ATG_PICK.by); } catch (_) {} }); };
// その助手の好きな色(表の favColors)
const atgFavColors = (aid) => { try { const p = (typeof ASSISTANT_MASMON_PLAN !== 'undefined' ? ASSISTANT_MASMON_PLAN : []).find(a => a && a.id === aid); return (p && Array.isArray(p.favColors) ? p.favColors : []).map(x => x && x.color).filter(c => typeof c === 'string'); } catch (_) { return []; } };
const atgIsFavColor = (aid, c) => !!c && atgFavColors(aid).some(f => atgBase(f) === atgBase(c));
// いまの好み(はじめの好み + 遊んで変わった分)での段 'like' | 'normal' | 'dislike'
const atgTier = (aid, m) => {
  try {
    const p = typeof assistantMasmonBasePlanOf === 'function' ? assistantMasmonBasePlanOf(aid) : null;
    if (!p) return 'normal';
    const lin = typeof assistantMasmonLineage === 'function' ? assistantMasmonLineage(m) : null;
    const has = (xs, f) => (Array.isArray(xs) ? xs : []).some(x => x && f(x));
    if (has(p.dislikeMon, x => x.monster === m)) return 'dislike';
    if (has(p.likeMon, x => x.monster === m)) return 'like';
    if (lin && has(p.dislikeMon, x => x.lineage === lin)) return 'dislike';
    if (lin && has(p.likeMon, x => x.lineage === lin)) return 'like';
    return 'normal';
  } catch (_) { return 'normal'; }
};
// 選べるモンスター: その助手のマスモンの種類を先に、残りは図鑑の順
const atgMonList = (aid) => {
  const all = typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS ? Object.keys(ALL_PLAYER_MONSTERS) : [];
  let mine = [];
  try { const p = typeof assistantMasmonPlanOf === 'function' ? assistantMasmonPlanOf(aid) : null; mine = [...((p && p.team) || []), ...((p && p.extra) || [])].map(x => x && x.monster).filter(m => all.includes(m)); } catch (_) { mine = []; }
  return [...new Set([...mine, ...all])];
};
const atgPickOf = (aid) => {
  const now = ATG_PICK.by[aid] || {};
  const last = ATG_STORE && ATG_STORE.loaded ? (ATG_STORE.state.last[aid] || {}) : {};
  const list = atgMonList(aid);
  const mon = atgMonOk(now.mon) ? now.mon : atgMonOk(last.mon) ? last.mon : (list[0] || '');
  const color = atgColorOk(now.color) ? now.color : atgColorOk(last.color) ? last.color : (atgColorIds()[0] || '');
  return { mon, color };
};
const atgMonName = (m) => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[m] && ALL_PLAYER_MONSTERS[m].name) || m;
const atgFace = (m) => { const x = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[m] : null; return x ? (x.faceIconUrl || x.iconUrl || '') : ''; };
// 贈る窓の道具の並びから外すか(印が偽のとき)
const assistantLifeTasteGiftHidden = (g) => !!g && atgIsPlush(g.key) && !atgOn();
// 贈ったあと(56-assistant-life-gifts.jsx の assistantLifeSoloGive から)。好みを動かし、選んだものを保存し、ひとことを選んだモンスターに合わせる
const assistantLifeTasteGiftApply = async (who, g, out) => {
  try {
    if (!g || !atgIsPlush(g.key) || !who) return out;
    const { mon, color } = atgPickOf(who);
    if (!atgMonOk(mon)) return out;
    const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '';
    try { if (typeof AMT_STORE !== 'undefined' && AMT_STORE && !AMT_STORE.loaded) await AMT_STORE.load(); } catch (_) {}
    const fav = atgIsFavColor(who, color);
    const changes = [];
    if (typeof assistantLifeTasteBump === 'function') {
      changes.push(...(assistantLifeTasteBump(who, mon, 'gift') || []));
      if (fav) changes.push(...(assistantLifeTasteBump(who, mon, 'color') || []));
    }
    if (ATG_STORE) {
      await ATG_STORE.load();
      const st = ATG_STORE.state;
      ATG_STORE.save({ ...st, last: { ...st.last, [who]: { mon, color: atgColorOk(color) ? color : '', day } }, n: { ...st.n, [who]: (st.n[who] || 0) + 1 } });
    }
    const tier = atgTier(who, mon);
    const like = tier === 'like' ? 'like' : tier === 'dislike' ? 'bad' : 'mid';
    const item = `${atgMonName(mon)}のぬいぐるみ`;
    const temp = typeof ASSISTANT_LIFE_SOLO_TEMP_LINES !== 'undefined' && ASSISTANT_LIFE_SOLO_TEMP_LINES[who] ? ASSISTANT_LIFE_SOLO_TEMP_LINES[who][like] : null;
    const call = typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(who) : 'あなた';
    const lines = temp ? [{ who, e: temp.e || 'happy', t: String(temp.t).split('{item}').join(item).split('{name}').join(call) }] : (out && out.lines) || [];
    return out ? { ...out, lines, plush: { mon, color, fav, tier }, tasteChanges: changes } : out;
  } catch (_) { return out; }
};
// 贈る窓の中の「どのモンスター・どの色」の小窓(1人に贈るで 🧸 を選んでいるときだけ)
function AssistantLifeTasteGiftPicker({ who, nameOf }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const f = () => tick(x => x + 1);
    ATG_PICK.subs.add(f);
    let off = null;
    if (ATG_STORE) { ATG_STORE.subs.add(f); off = () => ATG_STORE.subs.delete(f); void ATG_STORE.load(); }
    return () => { ATG_PICK.subs.delete(f); if (off) off(); };
  }, []);
  const [open, setOpen] = React.useState(false);
  if (!who || !atgOn()) return null;
  const { mon, color } = atgPickOf(who);
  const list = atgMonList(who);
  const cols = atgColorIds();
  const fav = atgIsFavColor(who, color);
  const sw = (c) => (typeof MASU_COLOR_SWATCH !== 'undefined' && MASU_COLOR_SWATCH[c]) || '#ccc';
  const name = nameOf ? nameOf(who) : who;
  return (
    <div className="mt-2 rounded-xl border border-pink-300/40 bg-pink-500/10 p-2" data-assistant-life-plush-picker={who}>
      <p className="text-[11px] font-black text-pink-100">🧸 どのモンスターのぬいぐるみにする？</p>
      <button type="button" data-assistant-life-plush-open aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-white/15 bg-slate-900/70 px-2 text-left active:scale-[.98]">
        {atgFace(mon) ? (typeof MonsterFaceImage === 'function' ? <MonsterFaceImage baseId={mon} src={(ALL_PLAYER_MONSTERS[mon] || {}).imgUrl || ''} faceSrc={atgFace(mon)} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white/10 object-cover"/> : <img src={atgFace(mon)} alt="" className="h-9 w-9 shrink-0 rounded-full bg-white/10 object-cover"/>) : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-[18px]" aria-hidden="true">🧸</span>}
        <span className="min-w-0 flex-1 truncate text-[13px] font-black text-white" data-assistant-life-plush-mon={mon}>{atgMonName(mon)}</span>
        <span className="shrink-0 text-[11px] font-black text-pink-200">{open ? '閉じる' : '選ぶ'}</span>
      </button>
      {open && <div className="mt-1 grid max-h-[220px] grid-cols-5 gap-1 overflow-y-auto rounded-xl bg-slate-950/60 p-1" data-assistant-life-plush-list>
        {list.map(m => (
          <button key={m} type="button" data-assistant-life-plush-pick={m} aria-pressed={m === mon} onClick={() => { atgSetPick(who, { mon: m }); setOpen(false); }}
            className={`flex min-h-[56px] flex-col items-center justify-center rounded-lg border px-0.5 active:scale-95 ${m === mon ? 'border-pink-300 bg-pink-400/25' : 'border-white/10 bg-slate-800/60'}`}>
            {atgFace(m) ? (typeof MonsterFaceImage === 'function' ? <MonsterFaceImage baseId={m} src={(ALL_PLAYER_MONSTERS[m] || {}).imgUrl || ''} faceSrc={atgFace(m)} alt="" className="h-8 w-8 rounded-full object-cover"/> : <img src={atgFace(m)} alt="" className="h-8 w-8 rounded-full object-cover"/>) : <span className="text-[18px]" aria-hidden="true">🧸</span>}
            <span className="mt-0.5 block w-full truncate text-center text-[9.5px] font-black leading-tight text-white">{atgMonName(m)}</span>
          </button>))}
      </div>}
      <p className="mt-2 text-[11px] font-black text-pink-100">🎀 リボンの色 <span className="text-white" data-assistant-life-plush-color={color}>{atgColorName(color)}</span></p>
      <div className="mt-1 flex flex-wrap gap-1" data-assistant-life-plush-colors>
        {cols.map(c => (
          <button key={c} type="button" data-assistant-life-plush-color-pick={c} aria-pressed={c === color} aria-label={`${atgColorName(c)}のリボン`} onClick={() => atgSetPick(who, { color: c })}
            className={`h-8 w-8 rounded-full border-2 active:scale-90 ${c === color ? 'border-white ring-2 ring-pink-300' : 'border-white/20'}`} style={{ background: sw(c) }}/>))}
      </div>
      <p className="mt-1.5 text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
        贈ると、{name}がこのモンスターを少し好きになります。{fav ? <b className="text-pink-200" data-assistant-life-plush-fav>好きな色のリボンなので、もう少し好きになります。</b> : '好きな色のリボンだと、もう少し好きになります。'}
      </p>
    </div>);
}
