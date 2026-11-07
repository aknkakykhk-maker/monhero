// ===== 助手ライフの道具(2人に贈る)・好み(段階A・2026-11-08 社長 docs/progress/assistant-peer/GIFT-PLAN.md) =====
// 道具は10種類(今の 🧺 peer_gift・🤝 peer_token は id・数・上がる量そのまま)。データは assistants.js の ASSISTANT_LIFE_GIFTS・ASSISTANT_LIFE_GIFT_LIKES
// 好き ×1.5・ふつう ×1・苦手 ×0.5(仲良し度は1人ずつ・友情Lv は2人の平均)。同じ道具は1日1回・合わせて1日3回(朝4時に戻る)
// 好みは最初「?」。贈ると分かる。仲良し度の段が上がるたびに、まだ分かっていない好きなものを1つ教えてくれる
// 公開の印 assistantLife の後ろ(偽のときは今までどおり 🧺🤝 の2つだけ・それぞれ1日1回)
// 保存は新しいキーで足すだけ(CLAUDE.md ⑦)。どれも壊れていたら空として読む
//   mh_assistant_life_gift_day_v1  { day, used: { [kind]: ペア } }        その日に贈った道具(🧺🤝 は今までどおり mh_assistant_peer_gift_v1 にも書く)
//   mh_assistant_life_likes_v1     { known: { [助手]: { [key]: 'gift'|'told' } }, told: [{ who, key, day }] }  分かった好み・教えてくれた知らせ(見るまで残す)
//   mh_assistant_life_cheki_v1     { [ペア]: ['YYYY-MM-DD', ...] }        思い出チェキを撮った日(思い出アルバムに出す・ペアごとに60枚まで)
const ASSISTANT_LIFE_GIFT_DAY_KEY = 'mh_assistant_life_gift_day_v1';
const ASSISTANT_LIFE_GIFT_LIKES_KEY = 'mh_assistant_life_likes_v1';
const ASSISTANT_LIFE_GIFT_CHEKI_KEY = 'mh_assistant_life_cheki_v1';
const ASSISTANT_LIFE_GIFT_CHEKI_MAX = 60;
// 狭い枠で名前を折り返すときの区切り(言葉の途中で折らない)。名前が変わって合わなくなったら、名前をそのまま1つで出す
const ASSISTANT_LIFE_GIFT_WRAP = Object.freeze({ basket: ['おやつ', 'バスケット'], misanga: ['おそろいの', 'ミサンガ'], cake: ['はんぶんこ', 'ケーキ'], onigiri: ['ほかほか', 'おにぎり'],
  tea: ['午後の', 'ティーセット'], earphone: ['かたみみ', 'イヤホン'], puzzle: ['ふたりで解く', 'パズル'], sleeve: ['おそろい', 'スリーブ'], cheki: ['思い出', 'チェキ'], flower: ['ちいさな', '花束'] });
const assistantLifeGiftWrapName = (g) => { const w = g && ASSISTANT_LIFE_GIFT_WRAP[g.key]; return w && w.join('') === g.name ? w : [g ? g.name : '']; };
const ASSISTANT_LIFE_GIFT_LABEL = Object.freeze({ like: '💗 好き', mid: 'ふつう', bad: '💧 苦手', unknown: '?' });

const assistantLifeGiftDefs = () => (typeof ASSISTANT_LIFE_GIFTS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_GIFTS) ? ASSISTANT_LIFE_GIFTS : []);
// 印が真なら10種類、偽なら今までの2つ(🧺🤝)
const assistantLifeGiftKinds = () => {
  const all = assistantLifeGiftDefs();
  return (typeof assistantLifeEnabled === 'function' && assistantLifeEnabled()) ? all : all.filter(g => g.kind === 'gift' || g.kind === 'token');
};
// kind か key から1つ。名前・絵・値段は持ち物と交換所から読む
const assistantLifeGiftOf = (kindOrKey) => {
  const g = assistantLifeGiftDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey);
  if (!g) return null;
  const item = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : []).find(x => x && x.id === g.itemId) || {};
  const offer = (typeof RHYTHM_EVENT_POINT_SHOP_OFFERS !== 'undefined' ? RHYTHM_EVENT_POINT_SHOP_OFFERS : []).find(x => x.itemId === g.itemId) || {};
  return { ...g, name: item.name || offer.name || '', emoji: item.emoji || offer.emoji || '🎁', cost: Number.isFinite(offer.cost) ? offer.cost : null };
};
// 持っている数(60-app の ownedItems から)。{ [kind]: 数 }
const assistantLifeGiftCounts = (ownedItems) => {
  const o = {};
  for (const g of assistantLifeGiftDefs()) {
    const n = ownedItems && typeof ownedItems === 'object' ? Number(ownedItems[g.itemId]) : 0;
    o[g.kind] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return o;
};
// その助手のその道具の好み('like' | 'mid' | 'bad')
const assistantLifeGiftLike = (who, kindOrKey) => {
  const g = assistantLifeGiftDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey);
  const t = typeof ASSISTANT_LIFE_GIFT_LIKES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LIKES[who] : null;
  if (!g || !t) return 'mid';
  if ((t.like || []).includes(g.key)) return 'like';
  if ((t.bad || []).includes(g.key)) return 'bad';
  return 'mid';
};
const assistantLifeGiftMult = (like) => {
  const m = typeof ASSISTANT_LIFE_GIFT_MULT !== 'undefined' ? ASSISTANT_LIFE_GIFT_MULT[like] : null;
  return Number.isFinite(m) ? m : 1;
};
// 2人に贈ったときに上がる量。好みは本当の値で計算する(画面に出すときは、分かっていなければ幅で見せる)
const assistantLifeGiftAmounts = (kindOrKey, pair) => {
  const g = assistantLifeGiftOf(kindOrKey);
  if (!g || !Array.isArray(pair) || pair.length !== 2) return null;
  const likes = pair.map(id => assistantLifeGiftLike(id, g.key));
  const mults = likes.map(assistantLifeGiftMult);
  return {
    likes, peer: Math.round(g.peer * (mults[0] + mults[1]) / 2),
    player: mults.map(m => Math.round(g.player * m)),
    range: { player: [Math.round(g.player * assistantLifeGiftMult('bad')), Math.round(g.player * assistantLifeGiftMult('like'))],
      peer: [Math.round(g.peer * assistantLifeGiftMult('bad')), Math.round(g.peer * assistantLifeGiftMult('like'))] },
  };
};

// ---------- 保存(3つのキー) ----------
const normalizeAssistantLifeGiftDay = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const used = {};
  if (r.used && typeof r.used === 'object' && !Array.isArray(r.used)) for (const [k, v] of Object.entries(r.used)) if (typeof v === 'string' && v) used[k] = v;
  return { day: typeof r.day === 'string' ? r.day : null, used };
};
const normalizeAssistantLifeGiftLikes = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const known = {};
  if (r.known && typeof r.known === 'object' && !Array.isArray(r.known)) {
    for (const [who, m] of Object.entries(r.known)) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) continue;
      const o = {};
      for (const [k, v] of Object.entries(m)) if (v === 'gift' || v === 'told') o[k] = v;
      known[who] = o;
    }
  }
  const told = Array.isArray(r.told) ? r.told.filter(x => x && typeof x.who === 'string' && typeof x.key === 'string').slice(-8) : [];
  return { known, told };
};
const normalizeAssistantLifeGiftCheki = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const o = {};
  for (const [k, v] of Object.entries(r)) if (Array.isArray(v)) o[k] = v.filter(d => typeof d === 'string').slice(-ASSISTANT_LIFE_GIFT_CHEKI_MAX);
  return o;
};
const ASSISTANT_LIFE_GIFT_STORE = {
  state: { day: normalizeAssistantLifeGiftDay(null), likes: normalizeAssistantLifeGiftLikes(null), cheki: {} },
  loaded: false, loading: null, listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    if (!this.loading) this.loading = (async () => {
      try {
        const [d, l, c] = await Promise.all([storeGet(ASSISTANT_LIFE_GIFT_DAY_KEY, null, false), storeGet(ASSISTANT_LIFE_GIFT_LIKES_KEY, null, false), storeGet(ASSISTANT_LIFE_GIFT_CHEKI_KEY, null, false)]);
        this.state = { day: normalizeAssistantLifeGiftDay(d), likes: normalizeAssistantLifeGiftLikes(l), cheki: normalizeAssistantLifeGiftCheki(c) };
      } catch {}
      this.loaded = true; this.emit(); return this.state;
    })();
    return this.loading;
  },
};
const useAssistantLifeGiftState = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_GIFT_STORE.state);
  React.useEffect(() => {
    const fn = (s) => setSt(s);
    ASSISTANT_LIFE_GIFT_STORE.listeners.add(fn);
    void ASSISTANT_LIFE_GIFT_STORE.load().then(() => setSt(ASSISTANT_LIFE_GIFT_STORE.state));
    return () => { ASSISTANT_LIFE_GIFT_STORE.listeners.delete(fn); };
  }, []);
  return st;
};
const assistantLifeGiftToday = () => (typeof assistantPeerDayKey === 'function' ? assistantPeerDayKey() : (typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : ''));
// その日に贈った道具({ [kind]: ペア })。🧺🤝 は前のキー(mh_assistant_peer_gift_v1)に書いたぶんも数える
const assistantLifeGiftUsedMap = (peerSt, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const day = assistantLifeGiftToday();
  const used = st.day && st.day.day === day ? { ...st.day.used } : {};
  const g = peerSt && peerSt.gift;
  if (g && g.day === day) { if (g.gift && !used.gift) used.gift = g.gift; if (g.token && !used.token) used.token = g.token; }
  return used;
};
const assistantLifeGiftLeft = (peerSt, st) => {
  const max = typeof ASSISTANT_LIFE_GIFT_DAILY_MAX !== 'undefined' && Number.isFinite(ASSISTANT_LIFE_GIFT_DAILY_MAX) ? ASSISTANT_LIFE_GIFT_DAILY_MAX : 3;
  return Math.max(0, max - Object.keys(assistantLifeGiftUsedMap(peerSt, st)).length);
};
// 贈れない理由(贈れるなら '')。印が偽なら今までどおり(🧺🤝 それぞれ1日1回)
const assistantLifeGiftReason = (kind, peerSt, have = 1, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  if (!assistantLifeGiftKinds().some(g => g.kind === kind)) return 'この道具はまだ贈れません';
  const lifeOn = typeof assistantLifeEnabled === 'function' && assistantLifeEnabled();
  const usedOld = typeof assistantPeerItemUsedToday === 'function' && peerSt && (kind === 'gift' || kind === 'token') && assistantPeerItemUsedToday(peerSt, kind);
  if (!lifeOn) return usedOld ? '今日はもう使いました(朝4時に戻ります)' : have <= 0 ? '持っていません(ビートP交換所で手に入ります)' : '';
  const used = assistantLifeGiftUsedMap(peerSt, st);
  if (used[kind] || usedOld) return '今日はもうこの道具を贈りました(朝4時に戻ります)';
  if (assistantLifeGiftLeft(peerSt, st) <= 0) return '今日はもう3回贈りました(朝4時に戻ります)';
  if (have <= 0) return '持っていません(ビートP交換所で手に入ります)';
  return '';
};
const assistantLifeGiftKnown = (who, kindOrKey, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const g = assistantLifeGiftDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey);
  return !!(g && st.likes.known[who] && st.likes.known[who][g.key]);
};
// 画面に出す好み(分かっていなければ 'unknown')
const assistantLifeGiftShownLike = (who, kindOrKey, st = ASSISTANT_LIFE_GIFT_STORE.state) => (assistantLifeGiftKnown(who, kindOrKey, st) ? assistantLifeGiftLike(who, kindOrKey) : 'unknown');

// 贈った記録(持ち物はもう減らしてある)。その日の数・分かった好み・チェキを残す
const assistantLifeGiftRecord = async (kind, pair) => {
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const g = assistantLifeGiftOf(kind);
  if (!g) return;
  const day = assistantLifeGiftToday();
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  const pk = typeof assistantPeerPairKey === 'function' ? assistantPeerPairKey(pair[0], pair[1]) : [...pair].sort().join('-');
  const nextDay = { day, used: { ...(st.day.day === day ? st.day.used : {}), [kind]: pk } };
  const known = { ...st.likes.known };
  for (const id of pair) known[id] = { ...(known[id] || {}), [g.key]: 'gift' };
  const likes = { ...st.likes, known };
  const patch = { day: nextDay, likes };
  if (g.key === 'cheki') patch.cheki = { ...st.cheki, [pk]: [...(st.cheki[pk] || []), day].slice(-ASSISTANT_LIFE_GIFT_CHEKI_MAX) };
  ASSISTANT_LIFE_GIFT_STORE.set(patch);
  try { storeSet(ASSISTANT_LIFE_GIFT_DAY_KEY, nextDay, false); } catch {}
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
  if (patch.cheki) { try { storeSet(ASSISTANT_LIFE_GIFT_CHEKI_KEY, patch.cheki, false); } catch {} }
};
// 2人のひとこと(掛け合いの形)。コトバ・ツムギの台詞(ASSISTANT_LIFE_GIFT_LINES)があればそれ、無ければ仮の1行
const assistantLifeGiftLine = (who, g, like, rand = Math.random) => {
  const real = typeof ASSISTANT_LIFE_GIFT_LINES !== 'undefined' && ASSISTANT_LIFE_GIFT_LINES[who] && ASSISTANT_LIFE_GIFT_LINES[who][g.key];
  const list = Array.isArray(real) ? real.filter(x => x && x.t) : [];
  const temp = typeof ASSISTANT_LIFE_GIFT_TEMP_LINES !== 'undefined' && ASSISTANT_LIFE_GIFT_TEMP_LINES[who] ? ASSISTANT_LIFE_GIFT_TEMP_LINES[who][like] : null;
  const pick = list.length ? list[Math.floor(rand() * list.length) % list.length] : temp;
  return pick ? { who, e: pick.e || 'happy', t: String(pick.t).split('{item}').join(g.name) } : null;
};
const assistantLifeGiftTalk = (kind, pair, rand = Math.random) => {
  const g = assistantLifeGiftOf(kind);
  if (!g || !Array.isArray(pair) || pair.length !== 2) return null;
  const lines = pair.map(id => assistantLifeGiftLine(id, g, assistantLifeGiftLike(id, g.key), rand)).filter(Boolean);
  const pk = typeof assistantPeerPairKey === 'function' ? assistantPeerPairKey(pair[0], pair[1]) : [...pair].sort().join('-');
  return lines.length === 2 ? { id: `gift-${g.key}-${pk}`, pair: [...pair], lv: 1, scene: 'any', reaction: kind, gift: g.key, likes: pair.map(id => assistantLifeGiftLike(id, g.key)), lines } : null;
};

// 仲良し度の段が上がった(60-app の addAssistantBondFor から)。まだ分かっていない好きな道具を1つ教えてくれる。知らせは部屋のシートで見るまで残す
const assistantLifeGiftOnBondLevel = async (who, level, rand = Math.random) => {
  if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled()) return null;
  const t = typeof ASSISTANT_LIFE_GIFT_LIKES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LIKES[who] : null;
  if (!t) return null;
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  const left = (t.like || []).filter(k => !(st.likes.known[who] && st.likes.known[who][k]));
  if (!left.length) return null;
  const key = left[Math.floor(rand() * left.length) % left.length];
  const known = { ...st.likes.known, [who]: { ...(st.likes.known[who] || {}), [key]: 'told' } };
  const likes = { known, told: [...st.likes.told, { who, key, day: assistantLifeGiftToday(), lv: Number(level) || null }].slice(-8) };
  ASSISTANT_LIFE_GIFT_STORE.set({ likes });
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
  const g = assistantLifeGiftOf(key);
  if (g && typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${typeof assistantLifeName === 'function' ? assistantLifeName(who) : who}が好きなものを教えてくれた(${g.emoji} ${g.name})`, [who], { kind: 'gift' });
  return key;
};
// 教えてくれた知らせを見た(部屋のシートで出したら消す)
const assistantLifeGiftToldSeen = (who) => {
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  if (!st.likes.told.some(x => x.who === who)) return;
  const likes = { ...st.likes, told: st.likes.told.filter(x => x.who !== who) };
  ASSISTANT_LIFE_GIFT_STORE.set({ likes });
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
};
const assistantLifeGiftHintLine = (who, key) => {
  const g = assistantLifeGiftOf(key);
  const real = typeof ASSISTANT_LIFE_GIFT_HINT_LINES !== 'undefined' && ASSISTANT_LIFE_GIFT_HINT_LINES[who] && ASSISTANT_LIFE_GIFT_HINT_LINES[who][key];
  const temp = typeof ASSISTANT_LIFE_GIFT_HINT_TEMP !== 'undefined' ? ASSISTANT_LIFE_GIFT_HINT_TEMP[who] : null;
  const pick = real && real.t ? real : temp;
  if (!g || !pick) return null;
  const t = String(pick.t).split('{item}').join(g.name);
  const call = typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(who) : 'あなた';
  return { e: pick.e || 'happy', t: t.split('{name}').join(call) };
};

// 部屋のシートの「🎁 好きなもの」の行(10種類の印。分かっていないものは ?)。教えてくれた知らせがあれば吹き出しで出す
// compact … 横の狭い部屋のシート。1行(分かった好きな物と数)にまとめ、押すと全部の印を開く
function AssistantLifeGiftLikesRow({ id, compact = false }) {
  const st = useAssistantLifeGiftState();
  const [open, setOpen] = React.useState(false);
  if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled()) return null;
  const gifts = assistantLifeGiftKinds().map(g => assistantLifeGiftOf(g.kind)).filter(Boolean);
  const known = gifts.filter(g => assistantLifeGiftKnown(id, g.key, st)).length;
  const liked = gifts.filter(g => assistantLifeGiftShownLike(id, g.key, st) === 'like');
  const told = st.likes.told.filter(x => x.who === id).slice(-1)[0] || null;
  const hint = told ? assistantLifeGiftHintLine(id, told.key) : null;
  const cls = { like: 'border-pink-300 bg-pink-500/30 text-white', mid: 'border-slate-500 bg-slate-700/60 text-slate-100', bad: 'border-cyan-300 bg-cyan-700/40 text-white', unknown: 'border-white/15 bg-slate-800/70 text-slate-400' };
  const showAll = !compact || open;
  return (
    <div className={compact ? 'py-1' : 'py-1.5'} data-assistant-life-gift-likes={id}>
      <button type="button" className="flex w-full items-center gap-1 text-left text-[10.5px] font-black text-slate-300" onClick={() => compact && setOpen(v => !v)} aria-expanded={showAll}>
        <span className="shrink-0">🎁 好きなもの</span>
        {compact && <span className="min-w-0 truncate text-[11px]">{liked.length ? liked.map(g => g.emoji).join('') : ''}</span>}
        <span className="ml-auto shrink-0 text-[10px] font-bold text-slate-400">分かった {known}/{gifts.length}{compact ? (showAll ? ' ▲' : ' ▼') : ''}</span>
      </button>
      {hint && (
        <button type="button" data-assistant-life-gift-told={told.key} onClick={() => assistantLifeGiftToldSeen(id)}
          className={`mt-1 block w-full rounded-xl bg-white px-2 py-1 text-left text-[11px] font-black leading-snug text-slate-800 ${compact ? 'truncate' : ''}`}>
          <span className={`${compact ? 'mr-1 inline' : 'block'} text-[9.5px] text-pink-600`}>💡{compact ? '' : ' 教えてくれた(タップで閉じる)'}</span>{hint.t}</button>)}
      <div className={`mt-1 flex flex-wrap gap-1 ${showAll ? '' : 'hidden'}`}>
        {gifts.map(g => { const s = assistantLifeGiftShownLike(id, g.key, st); return (
          <span key={g.key} data-assistant-life-gift-like={`${g.key}:${s}`} title={`${g.name} ${ASSISTANT_LIFE_GIFT_LABEL[s]}`}
            className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-lg border px-1 text-[10px] font-black leading-[18px] ${cls[s]}`}>
            <span aria-hidden="true">{g.emoji}</span>{s === 'like' ? '💗' : s === 'bad' ? '💧' : s === 'unknown' ? '?' : ''}</span>); })}
      </div>
    </div>);
}

// 2人に贈るシート(道具10種類・2人の好み・上がる量)。56-assistant-life.jsx・56-assistant-life-house.jsx の両方から開く
function AssistantLifeGiftSheet({ give, setGive, life, peerSt, haveOf, nameOf, onGive }) {
  const st = useAssistantLifeGiftState();
  const gifts = assistantLifeGiftKinds().map(g => assistantLifeGiftOf(g.kind)).filter(Boolean);
  const info = gifts.find(x => x.kind === give.kind) || gifts[0];
  if (!info) return null;
  const pair = give.pair || [];
  const hint = pair.length === 2 && typeof assistantLifePairHint === 'function' ? assistantLifePairHint(peerSt, life, pair[0], pair[1]) : null;
  const left = hint && hint.next ? hint.next.min - hint.pts : null;
  const have = haveOf(info.kind);
  const reason = assistantLifeGiftReason(info.kind, peerSt, have, st);
  const lifeOn = typeof assistantLifeEnabled === 'function' && assistantLifeEnabled();
  const leftToday = lifeOn ? assistantLifeGiftLeft(peerSt, st) : null;
  const pairs = [];
  for (let i = 0; i < give.ids.length; i++) for (let j = i + 1; j < give.ids.length; j++) pairs.push([give.ids[i], give.ids[j]]);
  const samePair = (p) => pair.length === 2 && p.every(id => pair.includes(id));
  const amt = pair.length === 2 ? assistantLifeGiftAmounts(info.kind, pair) : null;
  const shown = pair.map(id => (lifeOn ? assistantLifeGiftShownLike(id, info.key, st) : 'mid'));
  const tagCls = { like: 'bg-pink-600 text-white', mid: 'bg-slate-600 text-white', bad: 'bg-cyan-700 text-white', unknown: 'bg-slate-700 text-slate-200' };
  const playerText = (i) => (!amt ? '' : shown[i] === 'unknown' ? `+${amt.range.player[0]}〜${amt.range.player[1]}` : `+${amt.player[i]}`);
  const peerText = !amt ? '' : shown.includes('unknown') ? `+${Math.round((amt.range.peer[0] + info.peer) / 2)}〜${Math.round((amt.range.peer[1] + info.peer) / 2)}` : `+${amt.peer}`;
  const mark = (s) => (s === 'like' ? '💗' : s === 'bad' ? '💧' : s === 'unknown' ? '?' : '');
  return (
    <div data-assistant-life-give-sheet={info.kind} className="absolute inset-0 flex items-end justify-center bg-black/70" style={{ zIndex: 30 }} onClick={() => setGive(null)}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-t-3xl border-t-2 border-amber-300/60 bg-slate-900 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[14px] font-black text-white">🎁 2人に贈る</p>
          {leftToday != null && <span data-assistant-life-give-left={leftToday} className="shrink-0 rounded-full bg-slate-800 px-2 text-[10.5px] font-black leading-[22px] text-amber-200">今日あと {leftToday}回</span>}
          <AssistantLifeFaces ids={pair} size={30}/>
        </div>
        {pairs.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {pairs.map(p => (
              <button key={p.join('-')} type="button" data-assistant-life-give-pair={p.join('-')} aria-pressed={samePair(p)} onClick={() => setGive({ ...give, pair: p })}
                className={`min-h-[34px] rounded-full border px-2.5 text-[11px] font-black active:scale-95 ${samePair(p) ? 'border-amber-300 bg-amber-400/25 text-white' : 'border-white/15 text-slate-300'}`}>{p.map(nameOf).join('と')}</button>))}
          </div>)}
        <div className="mt-2 grid grid-cols-5 gap-1" role="tablist">
          {gifts.map(x => {
            const on = x.kind === info.kind;
            const n = haveOf(x.kind);
            const ls = pair.map(id => (lifeOn ? assistantLifeGiftShownLike(id, x.key, st) : 'mid'));
            return (
              <button key={x.kind} type="button" role="tab" aria-selected={on} data-assistant-life-give-kind={x.kind} onClick={() => setGive({ ...give, kind: x.kind })}
                className={`relative min-h-[54px] rounded-xl border px-0.5 pb-0.5 pt-1 text-center active:scale-[.97] ${on ? 'border-amber-300 bg-amber-400/20' : 'border-white/10 bg-slate-800/60'} ${n <= 0 ? 'opacity-50' : ''}`}>
                <span className="block text-[20px] leading-none" aria-hidden="true">{x.emoji}</span>
                <span className="mt-0.5 block text-[8.5px] font-black leading-[1.15] text-white" style={{ wordBreak: 'keep-all', minHeight: '2.3em' }} data-assistant-life-give-kind-name>{assistantLifeGiftWrapName(x).map((w, i) => <React.Fragment key={i}>{i > 0 && <wbr/>}{w}</React.Fragment>)}</span>
                <span className="block text-[9px] font-black leading-tight text-slate-300">{lifeOn && pair.length === 2 ? ls.map(mark).map(m => m || '・').join(' ') : ''}</span>
                <em className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/90 px-1 text-[8.5px] font-black not-italic text-slate-200">×{n}</em>
              </button>); })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-[28px] [[data-assistant-life-land='1']_&]:hidden" aria-hidden="true">{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-white" data-assistant-life-give-name>{info.name}</p>
            <p className="text-[10.5px] leading-snug text-slate-300 [[data-assistant-life-land='1']_&]:hidden">{info.what}</p>
          </div>
        </div>
        <div className="mt-1.5 space-y-1 text-[11px]">
          {pair.map((id, i) => (
            <div key={id} className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-2 py-1" data-assistant-life-give-person={`${id}:${shown[i]}`}>
              <span className="w-[4.5rem] shrink-0 truncate font-black text-white">{nameOf(id)}</span>
              {lifeOn && <span className={`shrink-0 rounded-full px-1.5 text-[10px] font-black ${tagCls[shown[i]]}`}>{shown[i] === 'unknown' ? '好み ?' : ASSISTANT_LIFE_GIFT_LABEL[shown[i]]}</span>}
              <span className="ml-auto whitespace-nowrap font-black text-pink-200">💗 仲良し度 {playerText(i)}</span>
            </div>))}
          <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-2 py-1">
            <span className="shrink-0 font-black text-white">2人</span>
            <span className="ml-auto whitespace-nowrap font-black text-orange-300">🤝 友情Lv {peerText}{hint && left != null ? `(あと${left}で Lv${hint.lv + 1})` : ''}</span>
          </div>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-slate-400 [[data-assistant-life-land='1']_&]:hidden">{lifeOn ? '💗好き=多め・💧苦手=少なめ(それでも必ず上がる)・?=贈ると分かる。同じ道具は1日1回・合わせて1日3回(朝4時に戻る)' : '1日1回(朝4時に戻る)'}・持っている {have}個{info.cost != null ? `・ビートP交換所 ${info.cost}P` : ''}</p>
        {reason && <p data-assistant-life-give-reason className="mt-1.5 rounded-xl bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-300">{reason}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" data-assistant-life-give-cancel onClick={() => setGive(null)} className="min-h-[44px] flex-1 rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">やめる</button>
          <button type="button" data-assistant-life-give-go disabled={!!reason || pair.length !== 2} onClick={onGive}
            className="min-h-[44px] flex-[2] rounded-xl border border-amber-300/70 bg-amber-400/20 text-[14px] font-black text-amber-100 active:scale-[.98] disabled:opacity-40">{info.emoji} 贈る</button>
        </div>
      </div>
    </div>);
}

// 思い出アルバムの「📸 チェキ」(撮った日ごと。新しい順に6枚まで並べ、ほかは数だけ)
function AssistantLifeChekiRow({ pair }) {
  const st = useAssistantLifeGiftState();
  if (!Array.isArray(pair) || pair.length !== 2) return null;
  const pk = typeof assistantPeerPairKey === 'function' ? assistantPeerPairKey(pair[0], pair[1]) : [...pair].sort().join('-');
  const days = (st.cheki && st.cheki[pk]) || [];
  if (!days.length) return null;
  const show = days.slice(-6).reverse();
  return (
    <div className="mt-2" data-assistant-life-cheki={pk}>
      <p className="text-[11px] font-black text-amber-200">📸 チェキ {days.length}枚</p>
      <div className="mt-1 grid grid-cols-3 gap-1.5">
        {show.map((d, i) => (
          <div key={`${d}-${i}`} className="rounded-md bg-white p-1 pb-0.5 shadow" style={{ transform: `rotate(${i % 2 ? 2 : -2}deg)` }}>
            <div className="flex aspect-square items-center justify-center rounded-sm bg-gradient-to-br from-pink-200 to-sky-200"><AssistantLifeFaces ids={pair} size={28}/></div>
            <p className="text-center text-[9px] font-black text-slate-700">{String(d).slice(5).replace('-', '/')}</p>
          </div>))}
      </div>
    </div>);
}
