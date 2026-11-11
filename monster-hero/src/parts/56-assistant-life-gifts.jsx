// ===== 助手ライフの道具(2人に贈る)・好み(段階A・2026-11-08 社長 docs/progress/assistant-peer/GIFT-PLAN.md) =====
// 道具は10種類(今の 🧺 peer_gift・🤝 peer_token は id・数・上がる量そのまま)。データは assistants.js の ASSISTANT_LIFE_GIFTS・ASSISTANT_LIFE_GIFT_LIKES
// 好き ×1.5・ふつう ×1・苦手 ×0.5(仲良し度は1人ずつ・友情Lv は2人の平均)。同じ道具は1日1回・合わせて1日3回(朝4時に戻る)
// 好みは最初「?」。贈ると分かる。仲良し度の段が上がるたびに、まだ分かっていない好きなものを1つ教えてくれる
// 公開の印 assistantLife の後ろ(偽のときは今までどおり 🧺🤝 の2つだけ・それぞれ1日1回)
// 保存は新しいキーで足すだけ(CLAUDE.md ⑦)。どれも壊れていたら空として読む
//   mh_assistant_life_gift_day_v1  { day, used: { [kind]: ペア } }        その日に贈った道具(🧺🤝 は今までどおり mh_assistant_peer_gift_v1 にも書く)
//   mh_assistant_life_likes_v1     { known: { [助手]: { [key]: 'gift'|'told' } }, told: [{ who, key, day }] }  分かった好み・教えてくれた知らせ(見るまで残す)
//   mh_assistant_life_cheki_v1     { [ペア]: ['YYYY-MM-DD', ...] }        思い出チェキを撮った日(思い出アルバムに出す・ペアごとに60枚まで)
//   mh_assistant_life_room_v1      部屋の家具(段階B・下の「家具」の所)
//   mh_assistant_life_solo_gift_v1 { day, used: { [kind]: 助手 } }        助手1人に贈った道具(2026-11-08 社長 SOLO-GIFT-PLAN.md。2人に贈る回数とは別に1日3回 ❶B)
//   チェキを1人に贈ったとき(❸A)は mh_assistant_life_cheki_v1 の { [助手]: [日…] } に足す(2人のときのキーは「a-b」なので重ならない)
const ASSISTANT_LIFE_GIFT_DAY_KEY = 'mh_assistant_life_gift_day_v1';
const ASSISTANT_LIFE_GIFT_LIKES_KEY = 'mh_assistant_life_likes_v1';
const ASSISTANT_LIFE_GIFT_CHEKI_KEY = 'mh_assistant_life_cheki_v1';
const ASSISTANT_LIFE_GIFT_CHEKI_MAX = 60;
const ASSISTANT_LIFE_SOLO_GIFT_KEY = 'mh_assistant_life_solo_gift_v1';
// 狭い枠で名前を折り返すときの区切り(言葉の途中で折らない)。名前が変わって合わなくなったら、名前をそのまま1つで出す
const ASSISTANT_LIFE_GIFT_WRAP = Object.freeze({ basket: ['おやつ', 'バスケット'], misanga: ['おそろいの', 'ミサンガ'], cake: ['はんぶんこ', 'ケーキ'], onigiri: ['ほかほか', 'おにぎり'],
  tea: ['午後の', 'ティーセット'], earphone: ['かたみみ', 'イヤホン'], puzzle: ['ふたりで解く', 'パズル'], sleeve: ['おそろい', 'スリーブ'], cheki: ['思い出', 'チェキ'], flower: ['ちいさな', '花束'],
  letter: ['手書きの', '手紙'], candy: ['ひとつぶ', 'キャンディ'], omamori: ['小さな', 'おまもり'] });
const assistantLifeGiftWrapName = (g) => { const w = g && ASSISTANT_LIFE_GIFT_WRAP[g.key]; return w && w.join('') === g.name ? w : [g ? g.name : '']; };
const ASSISTANT_LIFE_GIFT_LABEL = Object.freeze({ like: '💗 好き', mid: 'ふつう', bad: '💧 苦手', unknown: '?' });

const assistantLifeGiftDefs = () => (typeof ASSISTANT_LIFE_GIFTS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_GIFTS) ? ASSISTANT_LIFE_GIFTS : []);
// 助手1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md)。公開の印 assistantLifeSolo の後ろ
const assistantLifeSoloDefs = () => (typeof ASSISTANT_LIFE_SOLO_GIFTS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_SOLO_GIFTS) ? ASSISTANT_LIFE_SOLO_GIFTS : []);
const assistantLifeSoloOn = () => typeof assistantLifeEnabled === 'function' && assistantLifeEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeSolo === true;
const assistantLifeAnyGiftDef = (kindOrKey) => assistantLifeGiftDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey) || assistantLifeSoloDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey) || null;
const assistantLifeIsSoloOnly = (kindOrKey) => !!assistantLifeSoloDefs().find(x => x.kind === kindOrKey || x.key === kindOrKey);
// 1人に贈れる道具(印が真なら 10種類+1人用4種類)
const assistantLifeSoloKinds = () => (assistantLifeSoloOn() ? [...assistantLifeGiftDefs(), ...assistantLifeSoloDefs()] : []);
// 印が真なら10種類、偽なら今までの2つ(🧺🤝)
const assistantLifeGiftKinds = () => {
  const all = assistantLifeGiftDefs();
  return (typeof assistantLifeEnabled === 'function' && assistantLifeEnabled()) ? all : all.filter(g => g.kind === 'gift' || g.kind === 'token');
};
// kind か key から1つ。名前・絵・値段は持ち物と交換所から読む
const assistantLifeGiftOf = (kindOrKey) => {
  const g = assistantLifeAnyGiftDef(kindOrKey);
  if (!g) return null;
  const item = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : []).find(x => x && x.id === g.itemId) || {};
  const offer = (typeof RHYTHM_EVENT_POINT_SHOP_OFFERS !== 'undefined' ? RHYTHM_EVENT_POINT_SHOP_OFFERS : []).find(x => x.itemId === g.itemId) || {};
  return { ...g, solo: assistantLifeIsSoloOnly(g.key), name: item.name || offer.name || '', emoji: item.emoji || offer.emoji || '🎁', cost: Number.isFinite(offer.cost) ? offer.cost : null };
};
// 持っている数(60-app の ownedItems から)。{ [kind]: 数 }
const assistantLifeGiftCounts = (ownedItems) => {
  const o = {};
  for (const g of [...assistantLifeGiftDefs(), ...assistantLifeSoloDefs()]) {
    const n = ownedItems && typeof ownedItems === 'object' ? Number(ownedItems[g.itemId]) : 0;
    o[g.kind] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return o;
};
// その助手のその道具の好み('like' | 'mid' | 'bad')
const assistantLifeGiftLike = (who, kindOrKey) => {
  const g = assistantLifeAnyGiftDef(kindOrKey);
  const solo = g && assistantLifeIsSoloOnly(g.key);
  const t = solo ? (typeof ASSISTANT_LIFE_SOLO_LIKES !== 'undefined' ? ASSISTANT_LIFE_SOLO_LIKES[who] : null) : (typeof ASSISTANT_LIFE_GIFT_LIKES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LIKES[who] : null);
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
// 画面に出す友情Lv の量。分かっている人はその倍率、分からない人は苦手〜好きの幅で、2人の平均の いちばん少ない〜多い
//   (2026-11-11 社長 案3 A: 幅「+8〜23」はやめ、分からない人は「ふつう」で数えた1つの数で出す。好みは数から分からないまま。opts.range で前の幅)
const assistantLifeGiftPeerShown = (g, shownLikes, o = null) => {
  const opts = shownLikes.map(s => (s === 'unknown' ? (o && o.range ? ['bad', 'like'] : ['mid']) : [s]).map(assistantLifeGiftMult));
  const lo = Math.round(g.peer * (Math.min(...opts[0]) + Math.min(...opts[1])) / 2), hi = Math.round(g.peer * (Math.max(...opts[0]) + Math.max(...opts[1])) / 2);
  return lo === hi ? `+${lo}` : `+${lo}〜${hi}`;
};
// 道具の欄に出す量(だれに贈るか決まる前なので「ふつう」の量を1つ。2026-11-11 社長 案3 A。好きなら多め・苦手なら少なめ、は横の字で言う)
const assistantLifeItemRange = (info) => {
  const g = info && assistantLifeGiftOf(info.kind);
  if (!g) return { peer: '', player: '' };
  return { peer: `+${g.peer}`, player: `+${g.player}` };
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
  state: { day: normalizeAssistantLifeGiftDay(null), solo: normalizeAssistantLifeGiftDay(null), likes: normalizeAssistantLifeGiftLikes(null), cheki: {}, room: {} },
  loaded: false, loading: null, listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    if (!this.loading) this.loading = (async () => {
      try {
        const [d, l, c, r, so] = await Promise.all([storeGet(ASSISTANT_LIFE_GIFT_DAY_KEY, null, false), storeGet(ASSISTANT_LIFE_GIFT_LIKES_KEY, null, false), storeGet(ASSISTANT_LIFE_GIFT_CHEKI_KEY, null, false), storeGet('mh_assistant_life_room_v1', null, false), storeGet(ASSISTANT_LIFE_SOLO_GIFT_KEY, null, false)]);
        this.state = { day: normalizeAssistantLifeGiftDay(d), solo: normalizeAssistantLifeGiftDay(so), likes: normalizeAssistantLifeGiftLikes(l), cheki: normalizeAssistantLifeGiftCheki(c), room: normalizeAssistantLifeRoom(r) };
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
  // 1人に贈った道具も、その日は2人に贈れない(同じ道具は1日1回・2026-11-08 社長 ❶B)
  const usedSolo = st.solo && st.solo.day === assistantLifeGiftToday() && st.solo.used && st.solo.used[kind];
  if (used[kind] || usedOld || usedSolo) return '今日はもうこの道具を贈りました(朝4時に戻ります)';
  if (assistantLifeGiftLeft(peerSt, st) <= 0) return '今日はもう3回贈りました(朝4時に戻ります)';
  if (have <= 0) return '持っていません(ビートP交換所で手に入ります)';
  return '';
};
// 道具の kind・key か、家具の key(段階B)
const assistantLifeGiftKeyOf = (kindOrKey) => {
  const g = assistantLifeAnyGiftDef(kindOrKey);
  if (g) return { key: g.key, furniture: false };
  const f = (typeof ASSISTANT_LIFE_FURNITURE !== 'undefined' && Array.isArray(ASSISTANT_LIFE_FURNITURE) ? ASSISTANT_LIFE_FURNITURE : []).find(x => x.key === kindOrKey);
  return f ? { key: f.key, furniture: true } : null;
};
const assistantLifeGiftKnown = (who, kindOrKey, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const k = assistantLifeGiftKeyOf(kindOrKey);
  return !!(k && st.likes.known[who] && st.likes.known[who][k.key]);
};
// 画面に出す好み(分かっていなければ 'unknown')。家具の好みも同じ形で出す
const assistantLifeGiftShownLike = (who, kindOrKey, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  if (!assistantLifeGiftKnown(who, kindOrKey, st)) return 'unknown';
  const k = assistantLifeGiftKeyOf(kindOrKey);
  return k.furniture ? assistantLifeFurnLike(who, k.key) : assistantLifeGiftLike(who, kindOrKey);
};

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

// ---------- 助手1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md ❶B ❷A ❸A) ----------
// 1人に贈った道具({ [kind]: 助手 })。2人に贈った分とは別の数(1日3回)。同じ道具は、2人にでも1人にでも1日1回
const assistantLifeSoloUsedMap = (st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const day = assistantLifeGiftToday();
  return st.solo && st.solo.day === day ? { ...st.solo.used } : {};
};
const assistantLifeSoloLeft = (st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const max = typeof ASSISTANT_LIFE_SOLO_DAILY_MAX !== 'undefined' && Number.isFinite(ASSISTANT_LIFE_SOLO_DAILY_MAX) ? ASSISTANT_LIFE_SOLO_DAILY_MAX : 3;
  return Math.max(0, max - Object.keys(assistantLifeSoloUsedMap(st)).length);
};
// 1人に贈れない理由(贈れるなら '')
const assistantLifeSoloReason = (kind, peerSt, have = 1, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  if (!assistantLifeSoloOn() || !assistantLifeSoloKinds().some(g => g.kind === kind)) return 'この道具はまだ贈れません';
  if (assistantLifeSoloUsedMap(st)[kind] || assistantLifeGiftUsedMap(peerSt, st)[kind]) return '今日はもうこの道具を贈りました(朝4時に戻ります)';
  if (assistantLifeSoloLeft(st) <= 0) return '今日はもう1人に3回贈りました(朝4時に戻ります)';
  if (have <= 0) return '持っていません(ビートP交換所で手に入ります)';
  return '';
};
// 1人に贈ったときに上がる量(❷A: 2人に贈ったときの1人ぶんと同じ。1人用はその道具の量)
const assistantLifeSoloAmount = (who, kindOrKey) => {
  const g = assistantLifeAnyGiftDef(kindOrKey);
  return g ? Math.round(g.player * assistantLifeGiftMult(assistantLifeGiftLike(who, g.key))) : 0;
};
const assistantLifeSoloLine = (who, g, like, rand = Math.random) => {
  const real = typeof ASSISTANT_LIFE_SOLO_LINES !== 'undefined' && ASSISTANT_LIFE_SOLO_LINES[who] && ASSISTANT_LIFE_SOLO_LINES[who][g.key];
  const list = Array.isArray(real) ? real.filter(x => x && x.t) : [];
  const temp = typeof ASSISTANT_LIFE_SOLO_TEMP_LINES !== 'undefined' && ASSISTANT_LIFE_SOLO_TEMP_LINES[who] ? ASSISTANT_LIFE_SOLO_TEMP_LINES[who][like] : null;
  const pick = list.length ? list[Math.floor(rand() * list.length) % list.length] : temp;
  return pick ? { who, e: pick.e || 'happy', t: String(pick.t).split('{item}').join(g.name) } : null;
};
// 1人に贈る・家具を贈るときの仲良し度(2026-11-08 社長「物をあげたときの親密度の変動アクションがなかった」)
//   60-app の addAssistantBondFor は、道具・家具のぶん(lifeGift・lifeFurn)では小さな札を出さない(2人に贈るときは growthFxPeerItem が2人ぶんの量を出すため)。
//   1人に贈る・家具を贈るにはその演出が無いので、ここで上がる前と後の点を読んで、ほかの場面と同じ仲良し度の札を出す(演出の部品と置き場所は触らない)
const assistantLifeAddBondWithFx = (who, actionKey, amount) => {
  if (typeof assistantPeerPlayerBondAdder === 'undefined' || !assistantPeerPlayerBondAdder) return;
  const before = assistantLifeBondPointsOf(who);
  try { assistantPeerPlayerBondAdder(who, actionKey, amount); } catch { return; }
  const after = assistantLifeBondPointsOf(who);
  if (Number.isFinite(before) && Number.isFinite(after) && after > before && typeof growthFxAssistantBond === 'function') { try { growthFxAssistantBond(who, before, after); } catch {} }
};
// 1人に贈った(持ち物はもう減らしてある)。その日の数・分かった好み・チェキ(その助手ひとりの1枚)・仲良し度・今日あったこと。ひとことの形を返す
const assistantLifeSoloGive = async (who, kind, rand = Math.random) => {
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const g = assistantLifeGiftOf(kind);
  if (!g || !who) return null;
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  const day = assistantLifeGiftToday();
  const solo = { day, used: { ...assistantLifeSoloUsedMap(st), [kind]: String(who) } };
  const known = { ...st.likes.known, [who]: { ...(st.likes.known[who] || {}), [g.key]: 'gift' } };
  const likes = { ...st.likes, known };
  const patch = { solo, likes };
  if (g.key === 'cheki') patch.cheki = { ...st.cheki, [who]: [...(st.cheki[who] || []), day].slice(-ASSISTANT_LIFE_GIFT_CHEKI_MAX) };
  ASSISTANT_LIFE_GIFT_STORE.set(patch);
  try { storeSet(ASSISTANT_LIFE_SOLO_GIFT_KEY, solo, false); } catch {}
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
  if (patch.cheki) { try { storeSet(ASSISTANT_LIFE_GIFT_CHEKI_KEY, patch.cheki, false); } catch {} }
  const like = assistantLifeGiftLike(who, g.key);
  const amount = assistantLifeSoloAmount(who, g.key);
  assistantLifeAddBondWithFx(who, 'lifeGift', amount);
  if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${typeof assistantLifeName === 'function' ? assistantLifeName(who) : who}に${g.name}を贈った`, [who], { kind: 'give' });
  const line = assistantLifeSoloLine(who, g, like, rand);
  const call = typeof assistantPeerPlayerCall === 'function' ? assistantPeerPlayerCall(who) : 'あなた';
  return line ? { id: `solo-${g.key}-${who}`, pair: [who], lv: 1, scene: 'any', reaction: kind, gift: g.key, solo: true, like, amount,
    lines: [{ ...line, t: line.t.split('{name}').join(call) }] } : null;
};

// 仲良し度の段が上がった(60-app の addAssistantBondFor から)。まだ分かっていない好きな道具を1つ教えてくれる。知らせは部屋のシートで見るまで残す
const assistantLifeGiftOnBondLevel = async (who, level, rand = Math.random) => {
  if (typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled()) return null;
  const t = typeof ASSISTANT_LIFE_GIFT_LIKES !== 'undefined' ? ASSISTANT_LIFE_GIFT_LIKES[who] : null;
  if (!t) return null;
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  // 家具(段階B)が開いていれば、好きな家具も教えてくれる
  const ft = assistantLifeFurnEnabled() && typeof ASSISTANT_LIFE_FURN_LIKES !== 'undefined' ? ASSISTANT_LIFE_FURN_LIKES[who] : null;
  const so = assistantLifeSoloOn() && typeof ASSISTANT_LIFE_SOLO_LIKES !== 'undefined' ? ASSISTANT_LIFE_SOLO_LIKES[who] : null;
  const left = [...(t.like || []), ...((so && so.like) || []), ...((ft && ft.like) || [])].filter(k => !(st.likes.known[who] && st.likes.known[who][k]));
  if (!left.length) return null;
  const key = left[Math.floor(rand() * left.length) % left.length];
  const known = { ...st.likes.known, [who]: { ...(st.likes.known[who] || {}), [key]: 'told' } };
  const likes = { known, told: [...st.likes.told, { who, key, day: assistantLifeGiftToday(), lv: Number(level) || null }].slice(-8) };
  ASSISTANT_LIFE_GIFT_STORE.set({ likes });
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
  const g = assistantLifeGiftOf(key) || assistantLifeFurnOf(key);
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
  const g = assistantLifeGiftOf(key) || assistantLifeFurnOf(key);
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
  // ❹A: 1人に贈る道具が開いていれば、1人用の4種類も並べて「分かった ◯/14」
  const gifts = [...assistantLifeGiftKinds(), ...(assistantLifeSoloOn() ? assistantLifeSoloDefs() : [])].map(g => assistantLifeGiftOf(g.kind)).filter(Boolean);
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
          className="mt-1 block w-full rounded-xl bg-white px-2 py-1 text-left text-[11px] font-black leading-snug text-slate-800">
          <span className={`${compact ? 'mr-1 inline' : 'block'} text-[9.5px] text-pink-600`}>💡{compact ? '' : ' 教えてくれた(タップで閉じる)'}</span>{hint.t}</button>)}
      <div className={`mt-1 flex flex-wrap gap-1 ${showAll ? '' : 'hidden'}`}>
        {gifts.map(g => { const s = assistantLifeGiftShownLike(id, g.key, st); return (
          <span key={g.key} data-assistant-life-gift-like={`${g.key}:${s}`} title={`${g.name} ${ASSISTANT_LIFE_GIFT_LABEL[s]}`}
            className={`inline-flex items-center gap-0.5 whitespace-nowrap rounded-lg border px-1 text-[10px] font-black leading-[18px] ${cls[s]}`}>
            <span aria-hidden="true">{g.emoji}</span>{s === 'like' ? '💗' : s === 'bad' ? '💧' : s === 'unknown' ? '?' : ''}</span>); })}
      </div>
    </div>);
}

// ---------- 数字の重み(2026-11-08 社長「友情Lvってなに？」「その数値がどのぐらいの影響力かがわからない」) ----------
// 友情Lv=贈った2人の助手どうしの仲(ASSISTANT_PEER_BOND_LEVELS の min)/仲良し度=プレイヤーとその助手の仲(ASSISTANT_BOND_LEVELS の need)
// プレイヤーとの仲良し度の点は 60-app.jsx が読み口を渡す(渡っていないときは null で、重みの段は出さない)
let assistantLifeBondPointsReader = null;
const assistantLifeSetBondPointsReader = (fn) => { assistantLifeBondPointsReader = typeof fn === 'function' ? fn : null; };
const assistantLifeBondPointsOf = (id) => {
  try { const p = assistantLifeBondPointsReader ? assistantLifeBondPointsReader(id) : null; return Number.isFinite(p) ? p : null; } catch { return null; }
};
// 友情Lv の段ごとに起きること(今の作りどおり。ヘルプの「助手どうしの友情Lv」と同じ)
const ASSISTANT_LIFE_PEER_LV_GAIN = Object.freeze({ 2: '2人のおしゃべりが増える', 3: '関係図で線が結ばれ、ミニイベントが起きる', 4: '息の合ったおしゃべりが加わる', 5: '2人の特別なお話が流れる',
  6: 'ミニイベントが起きやすくなる', 7: '3人のおしゃべりに出やすくなる', 8: 'おしゃべりがさらに増える', 9: 'おしゃべりがさらに増える', 10: '特別なお話の続きが流れる' });
// 仲良し度の段で起きること(呼び方・話し方・ごほうび。Lv3 呼び捨て/Lv6 呼び方を選べる)
const assistantLifeBondLvGain = (lv) => (lv === 3 ? '呼び方が変わり、ごほうびが届く' : lv === 6 ? '呼び方を選べるようになり、ごほうびが届く' : '話し方が近くなり、ごほうびが届く');
// pts … いまの点/lo・hi … この道具で上がる量(好みが分からないときは幅)/levels … 段の表/key … 'min' か 'need'
const assistantLifeWeightOf = (pts, lo, hi, levels, key) => {
  if (!Number.isFinite(pts) || !Array.isArray(levels) || !levels.length) return null;
  let cur = levels[0];
  for (const s of levels) if (pts >= s[key]) cur = s;
  const next = levels.find(s => s.level === cur.level + 1);
  if (!next) return { lv: cur.level, max: true };
  const span = Math.max(1, next[key] - cur[key]), left = Math.max(0, next[key] - pts);
  const pct = (v) => Math.max(1, Math.round(Math.min(v, span) / span * 100));
  return { lv: cur.level, next: next.level, left, now: Math.max(0, Math.min(1, (pts - cur[key]) / span)), add: Math.min(lo, left) / span,
    reach: lo >= left, maybe: hi >= left && lo < left, pct: pct(lo) === pct(hi) ? `${pct(lo)}%` : `${pct(lo)}〜${pct(hi)}%` };
};
// 1行の重み: 段の中のいま(色)+この道具のぶん(明るい色)の棒と、次の段まで・何割進むか・上がると起きること
function AssistantLifeGiftWeight({ w, tone, gainText, kind }) {
  if (!w) return null;
  const col = tone === 'peer' ? ['bg-orange-400', 'bg-orange-200'] : ['bg-pink-500', 'bg-pink-200'];
  if (w.max) return <p data-assistant-life-give-weight={`${kind}:max`} className="mt-0.5 text-[10px] font-bold leading-snug text-slate-300">Lv{w.lv}(いちばん上の段)</p>;
  return (
    <div data-assistant-life-give-weight={`${kind}:${w.lv}`} className="mt-0.5">
      <div className="flex h-[6px] overflow-hidden rounded-full bg-slate-950/80" aria-hidden="true">
        <span className={col[0]} style={{ width: `${w.now * 100}%` }}/>
        <span className={`${col[1]} animate-pulse`} style={{ width: `${Math.min(1 - w.now, w.add) * 100}%` }}/>
      </div>
      {/* 2026-11-11 社長「贈るやつも見た目とか分かりにくい」: 「段の25〜75%」は棒の明るい所が同じことを言うので字から外し、「あと◯で LvN → 起きること」の1行に */}
      <p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-200" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
        {w.reach ? <b className="text-amber-200">この1回で Lv{w.next} に！</b> : <span className="inline-block">あと{w.left}で Lv{w.next}{w.maybe ? <b className="text-amber-200">(好きなら この1回で届く)</b> : ''}</span>}
        {gainText ? <>{' '}<span className="inline-block text-slate-400">→ {gainText}</span></> : null}
      </p>
    </div>);
}
// ---------- 交換所へ飛ぶ入口(2026-11-08 遊ぶ人の提案「こっからショップに飛べたら楽ちん」) ----------
// 60-app.jsx が「ビートP交換所の棚を開く」口を渡す。tab: 'item'(道具の棚)| 'furniture'(家具の棚)
// 助手ライフを閉じて交換所を開き、交換所から戻ると助手ライフの道具タブ(家具ならその助手の部屋)へ戻る
let assistantLifeShopOpener = null;
const assistantLifeSetShopOpener = (fn) => { assistantLifeShopOpener = typeof fn === 'function' ? fn : null; };
const assistantLifeCanOpenShop = () => !!assistantLifeShopOpener;
const assistantLifeOpenShop = (tab = 'item', who = null) => {
  if (!assistantLifeShopOpener) return;
  const back = tab === 'furniture' && who ? { tab: 'house', room: who, furn: true } : { tab: 'items' };
  if (typeof ASSISTANT_LIFE_STORE !== 'undefined') ASSISTANT_LIFE_STORE.set({ open: false, shopBack: back });
  assistantLifeShopOpener(tab === 'furniture' ? 'furniture' : 'item');
};
// 交換所から戻ったとき(60-app.jsx の交換所の「戻る」から)。助手ライフを開き直す
const assistantLifeBackFromShop = () => {
  if (typeof ASSISTANT_LIFE_STORE === 'undefined' || !ASSISTANT_LIFE_STORE.state.shopBack) return false;
  ASSISTANT_LIFE_STORE.set({ open: true });
  return true;
};
function AssistantLifeShopButton({ tab = 'item', who = null, label = '🛒 交換所で手に入れる', small = false }) {
  if (!assistantLifeCanOpenShop()) return null;
  return (
    <button type="button" data-assistant-life-shop={tab} onClick={(ev) => { ev.stopPropagation(); assistantLifeOpenShop(tab, who); }}
      className={`${small ? 'min-h-[32px] px-2 text-[10.5px]' : 'min-h-[40px] w-full px-3 text-[12px]'} shrink-0 whitespace-nowrap rounded-xl border border-violet-300/70 bg-[#2e1065] font-black text-violet-100 shadow-md active:scale-[.97]`}>{label}</button>);
}

// ---------- 買って贈るを1回で(2026-11-08 社長 止め絵 docs/progress/assistant-peer/gifts/buygive/。確かめの窓は毎回出す) ----------
// 60-app.jsx が「交換所と同じ処理で1つ買う」口を渡す(exchangeRhythmEventPoints(offer, 1)。ビートPを引くのはそこだけ・二重に引かない)
// 流れ: 贈れるかを先に確かめる → 確かめの窓 → 買う → 贈る。贈れなかったら、買った品は持ち物に残る
let assistantLifeBuyer = null;
const assistantLifeSetBuyer = (fn) => { assistantLifeBuyer = typeof fn === 'function' ? fn : null; };
const assistantLifeCanBuy = (item) => !!(assistantLifeBuyer && item && item.itemId && Number.isFinite(item.cost) && item.cost > 0);
// 所持ビートP(読むだけ。買ったら読み直す)
const ASSISTANT_LIFE_BEATP = {
  n: null, listeners: new Set(),
  async refresh() {
    try { const v = typeof loadRhythmEventPoints === 'function' ? await loadRhythmEventPoints() : null; this.n = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null; } catch { this.n = null; }
    for (const fn of this.listeners) { try { fn(this.n); } catch {} }
    return this.n;
  },
};
const useAssistantLifeBeatPoints = () => {
  const [n, setN] = React.useState(ASSISTANT_LIFE_BEATP.n);
  React.useEffect(() => {
    const fn = (v) => setN(v);
    ASSISTANT_LIFE_BEATP.listeners.add(fn);
    void ASSISTANT_LIFE_BEATP.refresh();
    return () => { ASSISTANT_LIFE_BEATP.listeners.delete(fn); };
  }, []);
  return n;
};
const assistantLifeBuyOne = async (itemId) => {
  if (!assistantLifeBuyer) return { ok: false, reason: 'none' };
  let r = null;
  try { r = await assistantLifeBuyer(itemId); } catch { r = null; }
  void ASSISTANT_LIFE_BEATP.refresh();
  return r && r.ok ? { ok: true } : { ok: false, reason: (r && r.reason) || 'save' };
};
// 2人に贈るときの「上がる量」の行(確かめの窓に出す。好みが分からない人は幅で)
const assistantLifeGiftGainsFor = (kind, pair, nameOf, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const g = assistantLifeGiftOf(kind), amt = g && assistantLifeGiftAmounts(kind, pair);
  if (!amt) return [];
  const shown = pair.map(id => assistantLifeGiftShownLike(id, g.key, st));
  return [...pair.map((id, i) => ({ text: `💗 ${nameOf(id)}との仲良し度 ${shown[i] === 'unknown' ? `+${g.player}(好みで変わる)` : `+${amt.player[i]}`}` })),
    { text: `🤝 2人の友情Lv ${assistantLifeGiftPeerShown(g, shown)}`, cls: 'text-orange-300' }];
};
const assistantLifeBuyLabel = (item) => `🛒 ${item.cost}P で買って贈る`;
// 確かめの窓。item … { itemId, name, emoji, cost } / to … 贈る相手の言い方 / gains … [{ text, cls }] 上がる量
// check() … 買う直前にもう一度、贈れるか(贈れるなら '') / give() … 買えたあとに贈る(持ち物の1つを使う)
function AssistantLifeBuyConfirm({ item, to, gains = [], check, give, onClose }) {
  const points = useAssistantLifeBeatPoints();
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  if (!item) return null;
  const known = Number.isFinite(points);
  const short = known ? Math.max(0, item.cost - points) : 0;
  const reason = typeof check === 'function' ? check() : '';
  const go = async () => {
    if (busy) return;
    const r0 = typeof check === 'function' ? check() : '';
    if (r0) { setErr(r0); return; }
    setBusy(true); setErr('');
    const r = await assistantLifeBuyOne(item.itemId);
    if (!r.ok) { setBusy(false); setErr(r.reason === 'points' ? 'ビートPが足りません' : r.reason === 'busy' ? 'ほかの交換を待っています。少ししてからもう一度押してください' : '買えませんでした。ビートPと持ち物はそのままです'); return; }
    try { if (typeof give === 'function') await give(); } finally { setBusy(false); if (typeof onClose === 'function') onClose(); }
  };
  return (
    <div data-assistant-life-buy-confirm={item.itemId} className="absolute inset-0 flex items-center justify-center bg-black/70 px-4" style={{ zIndex: 45 }} onClick={(ev) => { ev.stopPropagation(); if (!busy) onClose(); }}>
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-violet-300/70 bg-slate-900 p-3" onClick={ev => ev.stopPropagation()}>
        <p className="text-[13px] font-black text-violet-200">🛒 買って贈る</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-[30px]" aria-hidden="true">{item.emoji}</span>
          <p className="min-w-0 flex-1 text-[15px] font-black leading-snug text-white" data-assistant-life-buy-name>{item.name}</p>
        </div>
        <p className="mt-2 text-[12px] font-black leading-snug text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }} data-assistant-life-buy-text>ビートP {item.cost} で買って、<wbr/>そのまま {to} に贈ります</p>
        <p className="mt-1.5 rounded-xl bg-slate-800 px-2 py-1 text-[11.5px] font-black text-slate-200" data-assistant-life-buy-points={known ? `${points}-${points - item.cost}` : ''}>所持ビートP {known ? <>{points.toLocaleString()} → <span className={short > 0 ? 'text-rose-300' : 'text-amber-200'}>{short > 0 ? '−' : (points - item.cost).toLocaleString()}</span></> : '…'}</p>
        {gains.length > 0 && <div className="mt-1.5 space-y-0.5" data-assistant-life-buy-gains>
          {gains.map((x, i) => <p key={i} className={`text-[11px] font-black leading-snug ${x.cls || 'text-pink-200'}`}>{x.text}</p>)}
        </div>}
        {short > 0 && <p data-assistant-life-buy-short={short} className="mt-1.5 rounded-xl bg-rose-500/15 px-2 py-1 text-[11.5px] font-black text-rose-200">ビートPが足りません(あと{short.toLocaleString()}P)</p>}
        {(err || reason) && <p data-assistant-life-buy-err className="mt-1.5 rounded-xl bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-300">{err || reason}</p>}
        <div className="mt-2.5 flex gap-2">
          <button type="button" data-assistant-life-buy-cancel disabled={busy} onClick={onClose} className="min-h-[44px] flex-1 rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98] disabled:opacity-40">やめる</button>
          <button type="button" data-assistant-life-buy-go disabled={busy || !known || short > 0 || !!reason} onClick={go}
            className="min-h-[44px] flex-[2] rounded-xl border border-violet-300/80 bg-violet-600 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{busy ? '…' : '🛒 買って贈る'}</button>
        </div>
      </div>
    </div>);
}

// 友情Lv・仲良し度の短い説明(道具の一覧の上と贈るシート)
function AssistantLifeGiftExplain({ compact = false }) {
  return (
    <div data-assistant-life-gift-explain className={`rounded-xl bg-slate-950/85 px-2 py-1 leading-snug ${compact ? 'text-[11px]' : 'text-[10.5px]'}`} style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      <p><b className="text-orange-300">🤝 友情Lv</b><span className="text-slate-200">=贈った2人の助手どうしの仲。<wbr/>上がると2人の掛け合いや特別なお話が増える</span></p>
      <p><b className="text-pink-200">💗 仲良し度</b><span className="text-slate-200">=あなたとその助手の仲。<wbr/>上がると呼び方や会話が変わり、ごほうびが届く</span></p>
    </div>);
}
// 贈るのきまり(「？」で開く。2026-11-11 社長「贈るやつも見た目とか分かりにくい仕様」: 窓の上と下に散っていた説明を1か所に畳む。きまりそのものは変えていない)
function AssistantLifeGiftRules({ solo = false }) {
  const like = assistantLifeGiftMult('like'), bad = assistantLifeGiftMult('bad');
  const rows = [
    ['🤝 2人に贈る', '2人の友情Lv と、2人それぞれの仲良し度が上がる'],
    ...(solo ? [['💗 1人に贈る', 'その助手の仲良し度だけが上がる(量は2人に贈ったときの1人ぶんと同じ)']] : []),
    ['回数', solo ? '2人に1⁠日3回・1人に1⁠日3回(別々に数える)' : '合わせて1⁠日3回'],
    ['同じ道具', solo ? '1⁠日1回(2人に贈っても1人に贈っても、その日はおしまい)' : '1⁠日1回'],
    ['好み', `💗好きな物は ×${like}・💧苦手な物は ×${bad}(それでも必ず上がる)。好みは贈ると分かる`],
    ['戻る時刻', '回数は朝4時に戻る'],
  ];
  return (
    <div data-assistant-life-gift-rules className="mt-1 rounded-xl bg-slate-950/85 px-2 py-1 text-[11px] leading-snug text-slate-200" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      {rows.map(([k, v]) => <p key={k} className="flex gap-1.5"><b className="w-[5.2rem] shrink-0 text-amber-200">{k}</b><span className="min-w-0 flex-1">{v}</span></p>)}
    </div>);
}

// 道具の一覧の1行(2026-11-11 社長「贈るやつも見た目とか分かりにくい」・案7: 1つの道具に4行あった説明を「名前・持っている数/上がる物」の2行に)
// x … assistantLifeItemInfo の形 / solo … 1人用の道具 / have … 持っている数 / used … 今日はもう贈った / action … 右のボタン
function AssistantLifeItemRow({ x, solo = false, have = 0, used = false, action = null }) {
  const g = assistantLifeGiftOf(x.kind);
  if (!g) return null;
  return (
    <div data-assistant-life-item={x.kind} className={`mt-1.5 flex items-center gap-2 rounded-2xl border bg-slate-900/85 px-2 py-1.5 ${solo ? 'border-pink-300/30' : 'border-amber-300/30'}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-[24px]" aria-hidden="true">{x.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-black leading-snug text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{x.name} <span className={`whitespace-nowrap text-[11px] ${used ? 'text-slate-400' : have > 0 ? 'text-amber-200' : 'text-slate-400'}`}>{used && have > 0 ? '今日は済み' : `持ち ${have}`}</span></p>
        <p className="text-[11px] font-bold leading-snug">{!solo && <><span className="whitespace-nowrap text-orange-300">🤝 友情Lv +{g.peer}</span><span className="text-slate-500">・</span></>}<span className="whitespace-nowrap text-pink-200" data-assistant-life-item-solo-amt={solo ? '' : undefined}>💗 仲良し度 +{g.player}</span></p>
      </div>
      {action}
    </div>);
}
// 道具の一覧の下の説明(畳む)。押すと 友情Lv・仲良し度の説明と、回数・同じ道具・好みのきまり
function AssistantLifeItemsHelp({ solo = false }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-1.5" data-assistant-life-items-help>
      <p className="rounded-xl bg-slate-950/85 px-2 py-1 text-[11px] font-bold leading-snug text-slate-200" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>数は「ふつう」のときの量。<wbr/>💗好きな物は多め・<wbr/>💧苦手な物は少なめ(好みは贈ると分かる)</p>
      <button type="button" data-assistant-life-items-help-toggle aria-expanded={open} onClick={() => setOpen(v => !v)} className="mt-1.5 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-white/20 bg-slate-950/70 px-3 text-left text-[12px] font-black text-slate-100 active:scale-[.98]"><span>？ 友情Lv・仲良し度と、贈るきまり</span><span>{open ? '▲' : '▼'}</span></button>
      {open && <div className="mt-1"><AssistantLifeGiftExplain compact/><AssistantLifeGiftRules solo={solo}/></div>}
    </div>);
}

// 2人に贈るシート(道具10種類・2人の好み・上がる量)。56-assistant-life.jsx・56-assistant-life-house.jsx の両方から開く
// give … { ids(一緒にいる助手), pair(2人に贈るとき), solo(1人に贈るときの助手), kind }。1人に贈る(2026-11-08 社長 SOLO-GIFT-PLAN.md)は印 assistantLifeSolo の後ろ
function AssistantLifeGiftSheet({ give, setGive, life, peerSt, haveOf, nameOf, onGive }) {
  const st = useAssistantLifeGiftState();
  const beatP = useAssistantLifeBeatPoints();
  const [buying, setBuying] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const soloOn = assistantLifeSoloOn();
  const soloWho = soloOn && give.solo ? give.solo : null;
  const gifts = (soloWho ? assistantLifeSoloKinds() : assistantLifeGiftKinds()).map(g => assistantLifeGiftOf(g.kind)).filter(Boolean);
  const info = gifts.find(x => x.kind === give.kind) || gifts[0];
  if (!info) return null;
  const pair = soloWho ? [] : (give.pair || []);
  const people = soloWho ? [soloWho] : pair;
  const hint = pair.length === 2 && typeof assistantLifePairHint === 'function' ? assistantLifePairHint(peerSt, life, pair[0], pair[1]) : null;
  const left = hint && hint.next ? hint.next.min - hint.pts : null;
  const have = haveOf(info.kind);
  const reason = soloWho ? assistantLifeSoloReason(info.kind, peerSt, have, st) : assistantLifeGiftReason(info.kind, peerSt, have, st);
  const lifeOn = typeof assistantLifeEnabled === 'function' && assistantLifeEnabled();
  // 買って贈る: 持っていないだけで、ほかは贈れるとき(1日の回数・同じ道具は1日1回を先に確かめる)
  const reasonOf = () => { const s2 = ASSISTANT_LIFE_GIFT_STORE.state; return soloWho ? assistantLifeSoloReason(info.kind, peerSt, 1, s2) : assistantLifeGiftReason(info.kind, peerSt, 1, s2); };
  const buyable = lifeOn && have <= 0 && !reasonOf() && assistantLifeCanBuy(info) && (!!soloWho || pair.length === 2);
  const leftToday = lifeOn ? (soloWho ? assistantLifeSoloLeft(st) : assistantLifeGiftLeft(peerSt, st)) : null;
  const pairs = [];
  for (let i = 0; i < give.ids.length; i++) for (let j = i + 1; j < give.ids.length; j++) pairs.push([give.ids[i], give.ids[j]]);
  const samePair = (p) => !soloWho && pair.length === 2 && p.every(id => pair.includes(id));
  // 2人に贈る⇔1人に贈るの切りかえ。1人用の道具を選んだまま2人に切りかえたら、2人に贈れる道具へ戻す
  const toPair = (p) => setGive({ ...give, pair: p, solo: null, kind: assistantLifeIsSoloOnly(give.kind) ? (assistantLifeGiftKinds()[0] || {}).kind : give.kind });
  const toSolo = (id) => setGive({ ...give, solo: id });
  const amt = pair.length === 2 ? assistantLifeGiftAmounts(info.kind, pair) : null;
  const shown = people.map(id => (lifeOn ? assistantLifeGiftShownLike(id, info.key, st) : 'mid'));
  const soloRange = [Math.round(info.player * assistantLifeGiftMult('bad')), Math.round(info.player * assistantLifeGiftMult('like'))];
  const tagCls = { like: 'bg-pink-600 text-white', mid: 'bg-slate-600 text-white', bad: 'bg-cyan-700 text-white', unknown: 'bg-slate-700 text-slate-200' };
  // 好みが分からない人は「ふつう」の量を1つ出し、横に(好みで変わる)(2026-11-11 社長 案3 A)
  const playerText = (i) => (soloWho ? (shown[i] === 'unknown' ? `+${info.player}` : `+${assistantLifeSoloAmount(soloWho, info.key)}`)
    : !amt ? '' : shown[i] === 'unknown' ? `+${info.player}` : `+${amt.player[i]}`);
  const vary = (i) => (lifeOn && shown[i] === 'unknown' ? '(好みで変わる)' : '');
  const peerText = !amt ? '' : lifeOn ? assistantLifeGiftPeerShown(info, shown) : `+${amt.peer}`;
  // 数字の重み(好みが分からない人は幅のまま。隠れた好みが数字から分からないようにする)
  const bondLv = typeof ASSISTANT_BOND_LEVELS !== 'undefined' ? ASSISTANT_BOND_LEVELS : [];
  const peerLv = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : [];
  const playerW = (i) => {
    if (soloWho) { const n = assistantLifeSoloAmount(soloWho, info.key); const [lo, hi] = shown[i] === 'unknown' ? soloRange : [n, n]; return assistantLifeWeightOf(assistantLifeBondPointsOf(soloWho), lo, hi, bondLv, 'need'); }
    if (!amt) return null; const [lo, hi] = shown[i] === 'unknown' ? amt.range.player : [amt.player[i], amt.player[i]];
    return assistantLifeWeightOf(assistantLifeBondPointsOf(pair[i]), lo, hi, bondLv, 'need'); };
  const peerNums = String(amt && lifeOn ? assistantLifeGiftPeerShown(info, shown, { range: true }) : peerText).replace(/\+/g, '').split('〜').map(Number).filter(Number.isFinite);
  const peerW = amt && hint && peerNums.length ? assistantLifeWeightOf(hint.pts, peerNums[0], peerNums[peerNums.length - 1], peerLv, 'min') : null;
  // ---- 見せ方(2026-11-11 社長「贈るやつも見た目とか分かりにくい仕様だから、全体的にそのへんも見直して」。きまり・量・保存は変えていない) ----
  // 回数は「2人に」「1人に」の2本を並べて出す/説明ときまりは「？」に畳む/道具の札に 持っている数・値段・今日は済み を出す
  const pairLeft = lifeOn ? assistantLifeGiftLeft(peerSt, st) : null;
  const soloLeft = lifeOn && soloOn ? assistantLifeSoloLeft(st) : null;
  const usedToday = lifeOn ? { ...assistantLifeGiftUsedMap(peerSt, st), ...(soloOn ? assistantLifeSoloUsedMap(st) : {}) } : {};
  const anyUnknown = lifeOn && shown.includes('unknown');
  const short = buyable && Number.isFinite(beatP) && info.cost > beatP ? info.cost - beatP : 0;
  const leftPill = (on, n, text, attr) => (
    <span {...attr} className={`shrink-0 whitespace-nowrap rounded-full px-2 text-[11px] font-black leading-[24px] ${on ? (n > 0 ? 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/70' : 'bg-rose-500/20 text-rose-200 ring-1 ring-rose-300/60') : 'bg-slate-800 text-slate-400'}`}>{text} {n > 0 ? `あと${n}回` : '今日はおしまい'}</span>);
  return (
    <div data-assistant-life-give-sheet={info.kind} className="absolute inset-0 flex items-end justify-center bg-black/70" style={{ zIndex: 30 }} onClick={() => setGive(null)}>
      <div className="max-h-full w-full max-w-md overflow-y-auto rounded-t-3xl border-t-2 border-amber-300/60 bg-slate-900 p-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }} onClick={ev => ev.stopPropagation()}>
        <div className="flex items-center gap-2">
          <AssistantLifeFaces ids={people} size={30}/>
          <p className="min-w-0 flex-1 text-[15px] font-black leading-tight text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }} data-assistant-life-give-title>🎁 {soloWho ? `${nameOf(soloWho)}に贈る` : pair.length === 2 ? <>{nameOf(pair[0])}と<wbr/>{nameOf(pair[1])}に贈る</> : '2人に贈る'}</p>
          {lifeOn && <button type="button" data-assistant-life-give-help aria-expanded={help} onClick={() => setHelp(v => !v)}
            className={`min-h-[44px] shrink-0 rounded-full border px-3 text-[12px] font-black active:scale-95 ${help ? 'border-amber-300 bg-amber-400/25 text-white' : 'border-white/25 text-slate-200'}`}>？ きまり</button>}
        </div>
        {lifeOn && <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-assistant-life-give-lefts>
          {leftPill(!soloWho, pairLeft, '🤝 2人に', soloWho ? { 'data-assistant-life-give-left-other': pairLeft } : { 'data-assistant-life-give-left': pairLeft })}
          {soloLeft != null && leftPill(!!soloWho, soloLeft, '💗 1人に', soloWho ? { 'data-assistant-life-give-left': soloLeft } : { 'data-assistant-life-give-left-other': soloLeft })}
          <span className="text-[11px] font-bold text-slate-400">同じ道具は1⁠日1回・朝4時に戻る</span>
        </div>}
        {!lifeOn && leftToday != null && <span data-assistant-life-give-left={leftToday} className="mt-1 inline-block rounded-full bg-slate-800 px-2 text-[11px] font-black leading-[22px] text-amber-200">今日あと {leftToday}回</span>}
        {lifeOn && help && <div className="mt-1.5" data-assistant-life-give-help-body><AssistantLifeGiftExplain compact/><AssistantLifeGiftRules solo={soloOn}/></div>}
        {(pairs.length > 1 || (soloOn && give.ids.length >= 1 && (pairs.length || give.ids.length > 1))) && (
          <div className="mt-2" data-assistant-life-give-who>
            <p className="text-[11px] font-black text-slate-300">だれに贈る？</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {pairs.map(p => (
                <button key={p.join('-')} type="button" data-assistant-life-give-pair={p.join('-')} aria-pressed={samePair(p)} onClick={() => toPair(p)}
                  className={`min-h-[44px] rounded-full border px-3 text-[12px] font-black active:scale-95 ${samePair(p) ? 'border-amber-300 bg-amber-400/25 text-white' : 'border-white/15 text-slate-300'}`}>🤝 {p.map(nameOf).join('と')}に</button>))}
              {soloOn && give.ids.map(id => (
                <button key={id} type="button" data-assistant-life-give-solo={id} aria-pressed={soloWho === id} onClick={() => toSolo(id)}
                  className={`min-h-[44px] rounded-full border px-3 text-[12px] font-black active:scale-95 ${soloWho === id ? 'border-pink-300 bg-pink-400/25 text-white' : 'border-white/15 text-slate-300'}`}>💗 {nameOf(id)}だけに</button>))}
            </div>
          </div>)}
        <p className="mt-2 text-[11px] font-black text-slate-300">どれを贈る？</p>
        <div className="mt-1 grid grid-cols-5 gap-1" role="tablist">
          {gifts.map(x => {
            const on = x.kind === info.kind;
            const n = haveOf(x.kind);
            const done = !!usedToday[x.kind];
            const ls = people.map(id => (lifeOn ? assistantLifeGiftShownLike(id, x.key, st) : 'mid'));
            // 好みの印は、分かっている 好き・苦手 だけ(分からない「?」を全部の札に並べない。分からないことは下の行の「好み ？」で言う)
            const marks = ls.some(l => l === 'like' || l === 'bad') ? ls.map(l => (l === 'like' ? '💗' : l === 'bad' ? '💧' : '・')).join('') : '';
            return (
              <button key={x.kind} type="button" role="tab" aria-selected={on} data-assistant-life-give-kind={x.kind} data-assistant-life-give-kind-state={done ? 'done' : n > 0 ? 'have' : 'none'} onClick={() => setGive({ ...give, kind: x.kind })}
                className={`relative min-h-[64px] rounded-xl border px-0.5 pb-0.5 pt-1 text-center active:scale-[.97] ${on ? 'border-amber-300 bg-amber-400/20' : 'border-white/10 bg-slate-800/60'}`}>
                <span className={`block text-[20px] leading-none ${done || n <= 0 ? 'opacity-50' : ''}`} aria-hidden="true">{x.emoji}</span>
                <span className={`mt-0.5 block text-[10px] font-black leading-[1.15] ${done || n <= 0 ? 'text-slate-400' : 'text-white'}`} style={{ wordBreak: 'keep-all', minHeight: '2.3em' }} data-assistant-life-give-kind-name>{assistantLifeGiftWrapName(x).map((w, i) => <React.Fragment key={i}>{i > 0 && <wbr/>}{w}</React.Fragment>)}</span>
                <span className={`block whitespace-nowrap text-[10px] font-black leading-tight ${done ? 'text-slate-400' : n > 0 ? 'text-amber-200' : 'text-violet-300'}`}>{done ? '今日は済み' : n > 0 ? `持ち ${n}` : lifeOn && x.cost != null ? `🛒${x.cost}P` : '持ち 0'}</span>
                {marks && <em className="absolute right-0.5 top-0.5 rounded-full bg-slate-950/90 px-1 text-[10px] font-black not-italic leading-[14px]">{marks}</em>}
              </button>); })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-[28px] [[data-assistant-life-land='1']_&]:hidden" aria-hidden="true">{info.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-white"><span data-assistant-life-give-name>{info.name}</span> <span className={`whitespace-nowrap text-[11px] ${have > 0 ? 'text-amber-200' : 'text-violet-300'}`} data-assistant-life-give-have={have}>{have > 0 ? `持っている ${have}個` : '持っていない'}</span>{info.cost != null && <span className="whitespace-nowrap text-[11px] font-bold text-slate-400"> ビートP交換所 {info.cost}P</span>}</p>
            <p className="text-[11px] leading-snug text-slate-300 [[data-assistant-life-land='1']_&]:hidden">{info.what}</p>
          </div>
        </div>
        <div className="mt-1.5 space-y-1 text-[12px]">
          {people.map((id, i) => (
            <div key={id} className="rounded-lg bg-slate-800/80 px-2 py-1" data-assistant-life-give-person={`${id}:${shown[i]}`}>
              <div className="flex items-center gap-2">
                <span className="min-w-0 shrink truncate font-black text-white">{nameOf(id)}</span>
                {lifeOn && <span className={`shrink-0 rounded-full px-1.5 text-[11px] font-black ${tagCls[shown[i]]}`}>{shown[i] === 'unknown' ? '好み ？' : ASSISTANT_LIFE_GIFT_LABEL[shown[i]]}</span>}
                <span className="ml-auto whitespace-nowrap font-black text-pink-200">💗 あなたとの仲良し度 <b className="text-[14px] text-white">{playerText(i)}</b>{vary(i) && <span className="text-[10.5px] font-bold text-slate-300">{vary(i)}</span>}</span>
              </div>
              {lifeOn && <AssistantLifeGiftWeight w={playerW(i)} tone="player" kind={`player-${id}`} gainText={(() => { const w = playerW(i); return w && !w.max ? assistantLifeBondLvGain(w.next) : ''; })()}/>}
            </div>))}
          {!soloWho && <div className="rounded-lg bg-slate-800/80 px-2 py-1" data-assistant-life-give-peer>
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate font-black text-white">{pair.length === 2 ? pair.map(nameOf).join('と') : '2人'}</span>
              <span className="ml-auto whitespace-nowrap font-black text-orange-300">🤝 2人の友情Lv <b className="text-[14px] text-white">{peerText}</b>{anyUnknown && <span className="text-[10.5px] font-bold text-slate-300">(好みで変わる)</span>}{!lifeOn && hint && left != null ? `(あと${left}で Lv${hint.lv + 1})` : ''}</span>
            </div>
            {lifeOn && <AssistantLifeGiftWeight w={peerW} tone="peer" kind="peer" gainText={peerW && !peerW.max ? ASSISTANT_LIFE_PEER_LV_GAIN[peerW.next] || '' : ''}/>}
          </div>}
        </div>
        {anyUnknown && <p data-assistant-life-give-unknown className="mt-1 text-[11px] font-bold leading-snug text-slate-300 [[data-assistant-life-land='1']_&]:hidden">「好み ？」の助手は、贈ると好みが分かります(💗好きなら多め・💧苦手なら少なめ)</p>}
        {soloWho && <p className="mt-1 text-[11px] font-bold leading-snug text-slate-400 [[data-assistant-life-land='1']_&]:hidden">1人に贈ると、上がるのは仲良し度だけです(友情Lv は2人に贈ると上がります)</p>}
        {!lifeOn && <p className="mt-1 text-[10px] leading-snug text-slate-400">1⁠日1回(朝4時に戻る)・持っている {have}個</p>}
        {buyable && (short > 0
          ? <p data-assistant-life-give-buy-hint data-assistant-life-give-buy-short={short} className="mt-1.5 rounded-xl bg-rose-500/15 px-2 py-1 text-[11.5px] font-black leading-snug text-rose-200">ビートPが足りません(所持 {beatP.toLocaleString()}P・あと{short.toLocaleString()}P)。ビートPはモンヒロビートやバトルカードで貯まります</p>
          : <p data-assistant-life-give-buy-hint className="mt-1.5 rounded-xl bg-violet-500/15 px-2 py-1 text-[11.5px] font-black leading-snug text-violet-100">持っていない道具も、ここで買ってそのまま贈れます(所持ビートP {Number.isFinite(beatP) ? beatP.toLocaleString() : '…'})</p>)}
        {reason && !buyable && <p data-assistant-life-give-reason className="mt-1.5 rounded-xl bg-slate-800 px-2 py-1 text-[11px] font-bold text-slate-300">{reason}</p>}
        {lifeOn && have <= 0 && !buyable && <div className="mt-1.5"><AssistantLifeShopButton tab="item"/></div>}
        {/* やめる・贈るは、シートを下へ送らなくても押せるように下に貼り付ける(横で説明と重みが増えても隠れない) */}
        <div className="sticky -mx-3 mt-2 flex gap-2 bg-slate-900 px-3 pb-3 pt-1.5" data-assistant-life-give-actions style={{ bottom: 'calc(-0.75rem - env(safe-area-inset-bottom))', marginBottom: 'calc(-0.75rem - env(safe-area-inset-bottom))', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <button type="button" data-assistant-life-give-cancel data-mhl-sheet-close onClick={() => setGive(null)} className="min-h-[44px] flex-1 rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">やめる</button>
          {buyable ? <button type="button" data-assistant-life-give-buy={info.kind} disabled={short > 0} onClick={() => setBuying(true)}
            className="min-h-[44px] flex-[2] rounded-xl border border-violet-300/80 bg-violet-600 text-[14px] font-black text-white active:scale-[.98] disabled:opacity-40">{assistantLifeBuyLabel(info)}</button>
          : <button type="button" data-assistant-life-give-go disabled={!!reason || (!soloWho && pair.length !== 2)} onClick={() => onGive()}
            className="min-h-[44px] flex-[2] rounded-xl border border-amber-300/70 bg-amber-400/20 text-[14px] font-black text-amber-100 active:scale-[.98] disabled:opacity-40">{info.emoji} 贈る</button>}
        </div>
      </div>
      {buying && <AssistantLifeBuyConfirm item={info} to={soloWho ? nameOf(soloWho) : pair.map(nameOf).join('と')} onClose={() => setBuying(false)}
        gains={[...people.map((id, i) => ({ text: `💗 ${nameOf(id)}との仲良し度 ${playerText(i)}${vary(i)}` })), ...(!soloWho ? [{ text: `🤝 2人の友情Lv ${peerText}${anyUnknown ? '(好みで変わる)' : ''}`, cls: 'text-orange-300' }] : [])]}
        check={reasonOf} give={() => onGive({ bought: info })}/>}
    </div>);
}

// 思い出アルバムの「📸 チェキ」(撮った日ごと。新しい順に6枚まで並べ、ほかは数だけ)
// pair が1人([id])のときは、その助手ひとりのチェキ(1人に贈ったとき ❸A。部屋のシートに出す)
function AssistantLifeChekiRow({ pair }) {
  const st = useAssistantLifeGiftState();
  if (!Array.isArray(pair) || (pair.length !== 2 && pair.length !== 1)) return null;
  const pk = pair.length === 1 ? String(pair[0]) : typeof assistantPeerPairKey === 'function' ? assistantPeerPairKey(pair[0], pair[1]) : [...pair].sort().join('-');
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

// ===== 家具(1人に贈る・部屋に置く。段階B 2026-11-08 社長 GIFT-PLAN.md の3) =====
// 家具は12種類。部屋に置けるのは天井・壁・床に1つずつ(顔・吹き出し・出かけ札の所は空けておく)。ほかは「しまう」で押し入れへ(入れかえは自由)
// 仲良し度はその家具をその助手に初めて贈ったときだけ(ふつう +80・好き +120・苦手 +40)。同じ家具は1人に1つ(贈った家具はほかの助手へ移せない)
// 公開の印 assistantLifeFurniture の後ろ。保存は新しいキー mh_assistant_life_room_v1 だけ
//   { [助手]: { put: { ceil, wall, floor }(家具の key か null), kept: [key…](押し入れ), got: { [key]: 'YYYY-MM-DD' }(贈った日) } }
// 置き場所は部屋の箱に対する割合(HOUSE-ART-ORDER.md の部屋の箱と同じ)。描き下ろしの家の絵が来ても同じ所に出る
const ASSISTANT_LIFE_ROOM_KEY = 'mh_assistant_life_room_v1';
const ASSISTANT_LIFE_FURN_SLOTS = Object.freeze({
  ceil: Object.freeze({ label: '天井', x: 0.36, y: 0, w: 0.2, h: 0.2 }),
  wall: Object.freeze({ label: '壁', x: 0.02, y: 0.28, w: 0.2, h: 0.26 }),
  floor: Object.freeze({ label: '床', x: 0.42, y: 0.56, w: 0.2, h: 0.32 }),
});
const assistantLifeFurnEnabled = () => typeof assistantLifeEnabled === 'function' && assistantLifeEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeFurniture === true;
const assistantLifeFurnDefs = () => (typeof ASSISTANT_LIFE_FURNITURE !== 'undefined' && Array.isArray(ASSISTANT_LIFE_FURNITURE) ? ASSISTANT_LIFE_FURNITURE : []);
const assistantLifeFurnOf = (key) => {
  const f = assistantLifeFurnDefs().find(x => x.key === key || x.itemId === key);
  if (!f) return null;
  const item = (typeof BREEDER_MARKET_ITEMS !== 'undefined' && Array.isArray(BREEDER_MARKET_ITEMS) ? BREEDER_MARKET_ITEMS : []).find(x => x && x.id === f.itemId) || {};
  const offer = (typeof RHYTHM_EVENT_POINT_SHOP_OFFERS !== 'undefined' ? RHYTHM_EVENT_POINT_SHOP_OFFERS : []).find(x => x.itemId === f.itemId) || {};
  return { ...f, furniture: true, name: item.name || offer.name || '', emoji: item.emoji || offer.emoji || '🪑', cost: Number.isFinite(offer.cost) ? offer.cost : null };
};
const assistantLifeFurnCounts = (ownedItems) => {
  const o = {};
  for (const f of assistantLifeFurnDefs()) { const n = ownedItems && typeof ownedItems === 'object' ? Number(ownedItems[f.itemId]) : 0; o[f.key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }
  return o;
};
const assistantLifeFurnLike = (who, key) => {
  const t = typeof ASSISTANT_LIFE_FURN_LIKES !== 'undefined' ? ASSISTANT_LIFE_FURN_LIKES[who] : null;
  if (!t) return 'mid';
  return (t.like || []).includes(key) ? 'like' : (t.bad || []).includes(key) ? 'bad' : 'mid';
};
const assistantLifeFurnAmount = (who, key) => Math.round((typeof ASSISTANT_LIFE_FURN_PLAYER !== 'undefined' ? ASSISTANT_LIFE_FURN_PLAYER : 80) * assistantLifeGiftMult(assistantLifeFurnLike(who, key)));
const normalizeAssistantLifeRoomOne = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const keys = new Set(assistantLifeFurnDefs().map(f => f.key));
  const slotOf = (k) => (assistantLifeFurnDefs().find(f => f.key === k) || {}).slot;
  const put = { ceil: null, wall: null, floor: null };
  if (r.put && typeof r.put === 'object') for (const s of Object.keys(put)) { const k = r.put[s]; if (typeof k === 'string' && keys.has(k) && slotOf(k) === s) put[s] = k; }
  const got = {};
  if (r.got && typeof r.got === 'object' && !Array.isArray(r.got)) for (const [k, d] of Object.entries(r.got)) if (keys.has(k) && typeof d === 'string') got[k] = d;
  const placed = new Set(Object.values(put).filter(Boolean));
  const kept = [...new Set((Array.isArray(r.kept) ? r.kept : []).filter(k => typeof k === 'string' && keys.has(k) && !placed.has(k)))];
  return { put, kept, got };
};
const normalizeAssistantLifeRoom = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const o = {};
  for (const [who, v] of Object.entries(r)) if (/^[a-z]+$/.test(who)) o[who] = normalizeAssistantLifeRoomOne(v);
  return o;
};
const assistantLifeRoomOf = (who, st = ASSISTANT_LIFE_GIFT_STORE.state) => normalizeAssistantLifeRoomOne((st.room || {})[who]);
// 贈った(持ち物はもう減らしてある)。部屋に置ける場所が空いていれば置き、空いていなければ押し入れへ。同じ家具を二度は贈れない
const assistantLifeFurnGiveState = (roomSt, who, key, day) => {
  const f = assistantLifeFurnDefs().find(x => x.key === key);
  const cur = normalizeAssistantLifeRoomOne((roomSt || {})[who]);
  if (!f || cur.got[key]) return null;
  const put = { ...cur.put }, kept = [...cur.kept];
  const placed = !put[f.slot];
  if (placed) put[f.slot] = key; else kept.push(key);
  return { room: { ...(roomSt || {}), [who]: { put, kept, got: { ...cur.got, [key]: day } } }, placed };
};
// 置く/しまう(飾り付け)。置くときは、その場所にあった家具を押し入れへ戻す
const assistantLifeFurnMoveState = (roomSt, who, key, toPut) => {
  const f = assistantLifeFurnDefs().find(x => x.key === key);
  const cur = normalizeAssistantLifeRoomOne((roomSt || {})[who]);
  if (!f || !cur.got[key]) return null;
  const put = { ...cur.put };
  let kept = cur.kept.filter(k => k !== key);
  if (toPut) { if (put[f.slot] && put[f.slot] !== key) kept.push(put[f.slot]); put[f.slot] = key; }
  else { if (put[f.slot] === key) put[f.slot] = null; kept.push(key); }
  return { ...(roomSt || {}), [who]: { put, kept: [...new Set(kept)], got: cur.got } };
};
const assistantLifeRoomSave = (room) => {
  ASSISTANT_LIFE_GIFT_STORE.set({ room });
  try { storeSet(ASSISTANT_LIFE_ROOM_KEY, room, false); } catch {}
};
// 家具を贈ったときのひとこと(コトバ・ツムギの furn。1〜2行)。無ければ道具の仮の1行の形で
const assistantLifeFurnTalk = (who, key, rand = Math.random) => {
  const f = assistantLifeFurnOf(key);
  if (!f) return null;
  const like = assistantLifeFurnLike(who, key);
  const real = typeof ASSISTANT_LIFE_FURN_LINES !== 'undefined' && ASSISTANT_LIFE_FURN_LINES[who] && ASSISTANT_LIFE_FURN_LINES[who][key];
  const list = Array.isArray(real) ? real.filter(x => x && Array.isArray(x.lines) && x.lines.length) : [];
  const pick = list.length ? list[Math.floor(rand() * list.length) % list.length].lines : null;
  const temp = typeof ASSISTANT_LIFE_GIFT_TEMP_LINES !== 'undefined' && ASSISTANT_LIFE_GIFT_TEMP_LINES[who] ? ASSISTANT_LIFE_GIFT_TEMP_LINES[who][like] : null;
  const lines = (pick || (temp ? [{ e: temp.e, t: String(temp.t).split('{item}').join(f.name).replace(/\{c\}[、とに]?/g, '') }] : [])).map(x => ({ who, e: x.e || 'happy', t: x.t }));
  return lines.length ? { id: `furn-${key}-${who}`, pair: [who], lv: 1, scene: 'any', furniture: key, like, lines } : null;
};
// 家具を贈った(60-app が持ち物を1つ減らしてから呼ぶ)。部屋に置き、好みが分かり、仲良し度が上がる。返すのはひとことの台本(贈れなければ null)
const assistantLifeFurnGive = async (who, key) => {
  if (!assistantLifeFurnEnabled()) return null;
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const st = ASSISTANT_LIFE_GIFT_STORE.state;
  const r = assistantLifeFurnGiveState(st.room, who, key, assistantLifeGiftToday());
  if (!r) return null;
  assistantLifeRoomSave(r.room);
  // ミッションの「助手とふれあう」(2026-11-08)
  if (typeof missionNotify === 'function') missionNotify('assistantTouch');
  const known = { ...st.likes.known, [who]: { ...(st.likes.known[who] || {}), [key]: 'gift' } };
  const likes = { ...st.likes, known };
  ASSISTANT_LIFE_GIFT_STORE.set({ likes });
  try { storeSet(ASSISTANT_LIFE_GIFT_LIKES_KEY, likes, false); } catch {}
  const amount = assistantLifeFurnAmount(who, key);
  assistantLifeAddBondWithFx(who, 'lifeFurn', amount);
  const f = assistantLifeFurnOf(key);
  if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`${typeof assistantLifeName === 'function' ? assistantLifeName(who) : who}の部屋に${f.name}を贈った`, [who], { kind: 'give' });
  const talk = assistantLifeFurnTalk(who, key);
  return talk ? { ...talk, amount, placed: r.placed } : null;
};
const assistantLifeFurnMove = async (who, key, toPut) => {
  await ASSISTANT_LIFE_GIFT_STORE.load();
  const next = assistantLifeFurnMoveState(ASSISTANT_LIFE_GIFT_STORE.state.room, who, key, toPut);
  if (next) assistantLifeRoomSave(next);
  return !!next;
};

// ---------- 段階C: 好きな家具を使う吹き出し・遊びに来た助手が家具に触れる(2026-11-08 社長 ❶A ❷A・docs/progress/assistant-peer/gifts/STAGE-C-PLAN.md) ----------
// 台詞はツムギ(assistants.js の ASSISTANT_LIFE_FURNUSE_LINES・ASSISTANT_LIFE_VISITFURN_LINES)。保存は増やさない(部屋に置いてある家具を見るだけ)
const ASSISTANT_LIFE_FURN_SHORT = Object.freeze({ sofa: 'ソファ', bear: 'くま', plant: '植物', record: 'レコード', nyacushion: 'クッション', starpic: '星空の絵',
  trophy: 'トロフィー', bookshelf: '本棚', heartmirror: '鏡', lantern: 'ランタン', mirrorball: 'ミラーボール', windbell: '風鈴' });
const assistantLifeFurnPlaced = (who, st = ASSISTANT_LIFE_GIFT_STORE.state) => Object.values(assistantLifeRoomOf(who, st).put).filter(Boolean);
// 吹き出しは2行に分ける(言葉の区切り「で・を・に・の・が・と・、」のうち、真ん中にいちばん近い所で)
const assistantLifeBubSplit = (text) => {
  const t = String(text || '');
  if (t.length <= 8) return [t];
  let best = -1;
  for (let i = 2; i < t.length - 1; i++) if ('でをにのがと、'.includes(t[i - 1]) && (best < 0 || Math.abs(i - t.length / 2) < Math.abs(best - t.length / 2))) best = i;
  const at = best > 0 ? best : Math.ceil(t.length / 2);
  return [t.slice(0, at), t.slice(at)];
};
// ❶A: 好きな家具が部屋に置いてあれば、ひとりで部屋にいるあいだはいつもこの吹き出し(家具の絵文字+ひとこと)。無ければ null
const assistantLifeFurnUseBub = (who, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  if (!assistantLifeFurnEnabled()) return null;
  const lines = typeof ASSISTANT_LIFE_FURNUSE_LINES !== 'undefined' ? ASSISTANT_LIFE_FURNUSE_LINES[who] : null;
  if (!lines) return null;
  const key = assistantLifeFurnPlaced(who, st).find(k => lines[k] && assistantLifeFurnLike(who, k) === 'like');
  if (!key) return null;
  const f = assistantLifeFurnOf(key);
  const [a, b] = assistantLifeBubSplit(lines[key]);
  return { key, bub: [`${f ? f.emoji : ''} ${a}`, ...(b ? [b] : [])] };
};
// ❷A: 部屋の主(host)の部屋に、台詞のある相手(guest)がいて、その家具が置いてあるときの掛け合い。ids … 部屋にいる助手
const assistantLifeFurnVisitOf = (host, ids, st = ASSISTANT_LIFE_GIFT_STORE.state) => {
  if (!assistantLifeFurnEnabled() || !Array.isArray(ids) || ids.length < 2) return null;
  const all = typeof ASSISTANT_LIFE_VISITFURN_LINES !== 'undefined' && Array.isArray(ASSISTANT_LIFE_VISITFURN_LINES) ? ASSISTANT_LIFE_VISITFURN_LINES : [];
  const placed = assistantLifeFurnPlaced(host, st);
  const v = all.find(x => x.host === host && x.guest !== host && ids.includes(x.guest) && placed.includes(x.item));
  return v ? assistantLifeFurnVisitTalk(v) : null;
};
const assistantLifeFurnVisitTalk = (v) => ({ id: `visitfurn-${v.guest}-${v.host}-${v.item}`, pair: [v.guest, v.host], lv: 1, scene: 'any', furnVisit: v.item,
  lines: v.lines.map(x => ({ who: x.who, e: x.e || 'happy', t: x.t })) });
const assistantLifeFurnVisitBub = (talk) => {
  const k = talk && talk.furnVisit, f = k && assistantLifeFurnOf(k);
  return f ? [`${f.emoji} ${ASSISTANT_LIFE_FURN_SHORT[k] || f.name}の話を`, 'してる'] : null;
};
// 思い出アルバムに並べる掛け合い(家具が開いているときだけ。見たものはアルバムの記録に入る)
const assistantLifeFurnAlbumTalks = () => (assistantLifeFurnEnabled() && typeof ASSISTANT_LIFE_VISITFURN_LINES !== 'undefined' && Array.isArray(ASSISTANT_LIFE_VISITFURN_LINES) ? ASSISTANT_LIFE_VISITFURN_LINES.map(assistantLifeFurnVisitTalk) : []);

// 部屋の絵に置いた家具を出す(印が偽なら何も出さない)。z-index は 2(灯りを消した膜・キズナの扉・顔・吹き出しより後ろ)
// faces … いま部屋にいる顔の数 / baseCount … もとからある家具(左下の絵文字)の数。床の家具は、もとの家具と顔のあいだに入れる。
//   狭い部屋で入らないときは、部屋の上の真ん中へ寄せる(顔に重ねない・2026-11-08 検査で見つけた 横 844 の重なり)
// put … よその家(フレンドの家の控え)の置き方 { ceil, wall, floor }。渡されたら自分の部屋の家具ではなくそれを描く(56-assistant-life-friend.jsx)
function AssistantLifeRoomFurn({ id, w, h, faces = 0, baseCount = 2, put = null }) {
  const st = useAssistantLifeGiftState();
  const marker = React.useRef(null);
  const [moved, setMoved] = React.useState({});
  const on = assistantLifeFurnEnabled();
  // put … フレンドの家ではその人の家具の置き方(main の作り)。無ければ自分の保存から
  const room = put ? { put: { ceil: put.ceil || null, wall: put.wall || null, floor: put.floor || null } } : assistantLifeRoomOf(id, st);
  // 絵が届くまでは絵文字。読み取れる大きさにする(2026-11-08 窓口「小さく窮屈」)
  const size = Math.round(Math.max(16, Math.min(26, h * 0.26, w * 0.17)));
  const faceSize = Math.round(Math.min(40, h * 0.44));
  const faceLeft = faces > 0 ? w * 0.9 - faceSize - (faces - 1) * (faceSize - 10) : w * 0.9;
  const baseRight = 5 + baseCount * 21 + 2;
  // 置き方(2026-11-08 撮って決めた): 部屋の空いている所は「上の真ん中(名札と窓のあいだ)」「名札の下・もとの家具の上」「床の真ん中(もとの家具と顔のあいだ)」
  //   広い部屋: 天井=上の真ん中の左・壁=上の真ん中の右・床=床の真ん中
  //   狭い部屋(床の真ん中に入らない): 壁=名札の下・天井=上の真ん中の左・床=上の真ん中の右
  const g = Math.round(size * 1.25); // 絵文字の実際の大きさ(字の大きさより少し大きい)
  const wide = faceLeft - baseRight >= g + 4;
  const pos = (slot) => {
    if (wide) {
      if (slot === 'ceil') return { left: Math.round(w * 0.3), top: 3 };
      if (slot === 'wall') return { left: Math.round(w * 0.52), top: Math.round(h * 0.1) };
      return { left: Math.round((baseRight + faceLeft) / 2 - g / 2), top: Math.round(h - 13 - g) };
    }
    if (slot === 'wall') return { left: 6, top: Math.max(24, Math.round(h - 38 - g)) };
    if (slot === 'ceil') return { left: Math.round(w * 0.31), top: 3 };
    return { left: Math.round(w * 0.31) + g + 2, top: Math.round(h * 0.13) };
  };
  // 描いたあとに測って、吹き出し・名札・Lv・顔・もとの家具・出かけた札・ほかの家具に重なる家具だけ、元の場所にいちばん近い空いた所へずらす
  //   (2026-11-08 ミハリ「縦 390 のあつの部屋で、考えごとの吹き出しがトロフィーの下半分を隠す」「横 844 で床の家具が吹き出しの後ろに半分隠れる」。
  //    吹き出しは文の長さで高さが変わるので、決め打ちの位置では避けきれない)
  const measure = React.useRef(null);
  measure.current = () => {
    if (!on) return;
    const roomEl = marker.current && marker.current.parentElement;
    if (!roomEl) return;
    const rr = roomEl.getBoundingClientRect();
    if (!rr.width) return;
    const rel = (el) => { const r = el.getBoundingClientRect(); return { l: r.left - rr.left, t: r.top - rr.top, r: r.right - rr.left, b: r.bottom - rr.top }; };
    const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const pick = (sel) => [...roomEl.querySelectorAll(sel)].filter(el => el.getClientRects().length).map(rel);
    // 出かけた札(.tag)は部屋の真ん中を大きく使う。まず札も避けて探し、無ければ札の後ろはよいことにする(札は前に出て、部屋は暗くしてある)
    const must = pick('.pl, .lv, .pp > span, .fu, [data-assistant-life-room-bub]'), soft = pick('.tag');
    const next = {}, taken = [];
    for (const el of roomEl.querySelectorAll('[data-assistant-life-room-furn]')) {
      const slot = el.dataset.assistantLifeRoomFurn.split(':')[1];
      const base = pos(slot);
      // 絵文字の実際の大きさ(箱の左上からのずれも含めて)で測る。いま小さくしているぶんは戻して考える
      const cs = (moved[slot] && moved[slot].scale) || 1;
      const er = el.getBoundingClientRect(), gr = (el.lastElementChild || el).getBoundingClientRect();
      const dx0 = (gr.left - er.left) / cs, dy0 = (gr.top - er.top) / cs, gw0 = Math.max(g, gr.width / cs), gh0 = Math.max(g, gr.height / cs);
      let best = null, scale = 1, bestBox = null;
      // 空きが無い狭い部屋では、少し小さくして探し直す(8割・6.5割)
      for (const sc of [1, 0.8, 0.65]) {
        const dx = dx0 * sc, dy = dy0 * sc, gw = gw0 * sc + 2, gh = gh0 * sc + 2;
        const box = (q) => ({ l: q.left + dx - 1, t: q.top + dy - 1, r: q.left + dx + gw, b: q.top + dy + gh });
        const freeOf = (blocks) => (q) => { const bx = box(q); return bx.l >= 1 && bx.t >= 1 && bx.r <= w - 1 && bx.b <= h - 8 && !blocks.some(b => hit(bx, b)) && !taken.some(b => hit(bx, b)); };
        const strict = freeOf([...must, ...soft]), loose = freeOf(must);
        let found = strict(base) ? base : null;
        if (!found) {
          const step = Math.max(2, Math.round(g * sc / 4)), cands = [];
          for (let y = 1; y <= h; y += step) for (let x = 1; x <= w; x += step) cands.push({ left: x, top: y });
          cands.sort((a, b) => Math.hypot(a.left - base.left, a.top - base.top) - Math.hypot(b.left - base.left, b.top - base.top));
          found = cands.find(strict) || (loose(base) ? base : cands.find(loose)) || null;
        }
        if (found) { best = found; scale = sc; bestBox = box(found); break; }
        // それでも無い(出かけた札が部屋を覆う狭い部屋)ときは、せめて家具どうしは重ならない所へ
        // 人がいる部屋でどう置いても吹き出し・名札・顔・もとの家具に隠れるときは、その大きさの画面では描かない(家具のシートには並ぶ)
        if (sc === 0.65 && !soft.length) { best = base; scale = 0; bestBox = { l: 0, t: 0, r: 0, b: 0 }; break; }
        if (sc === 0.65) { const only = freeOf([]); const cands = []; for (let y = 1; y <= h; y += 2) for (let x = 1; x <= w; x += 2) cands.push({ left: x, top: y });
          cands.sort((a, b) => Math.hypot(a.left - base.left, a.top - base.top) - Math.hypot(b.left - base.left, b.top - base.top));
          best = cands.find(only) || base; scale = sc; bestBox = box(best); }
      }
      taken.push(bestBox);
      if (best !== base || scale !== 1) next[slot] = { left: Math.round(best.left), top: Math.round(best.top), scale };
    }
    setMoved(prev => (JSON.stringify(next) === JSON.stringify(prev) ? prev : next));
  };
  React.useLayoutEffect(() => { if (measure.current) measure.current(); });
  // 吹き出しの字があとから読み込まれて大きさが変わることがあるので、しばらく測り直す
  //   部屋の中身(吹き出し・顔・札)が変わったときは、次のコマですぐ測り直し、そこからまたしばらく測り直す
  //   (2026-11-11 カルク: もとは 0.7秒ごとにずっと測っていた。部屋の数だけ回り、止まっている画面でも配置を読み直し続けて重かった。
  //    中身が変わった・部屋や吹き出しの大きさが変わった・字が読み込まれたときだけにする。動きが落ち着いたあとは測らない)
  React.useEffect(() => {
    if (!on) return undefined;
    const run = () => { if (measure.current) measure.current(); };
    let t = 0, left = 0;
    const settle = () => { left = 6; if (!t) t = setInterval(() => { run(); if (--left <= 0) { clearInterval(t); t = 0; } }, 700); };
    settle();
    const roomEl = marker.current && marker.current.parentElement;
    let raf = 0;
    const soon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); settle(); };
    // 部屋を歩くマスモン(.mhm-pet)の書き換えは家具の避け先に関係しないので数えない(歩くたびに測り直し続けないように)
    const notPet = (m) => { const el = m.target && (m.target.nodeType === 1 ? m.target : m.target.parentElement); return !(el && el.closest && el.closest('.mhm-pet')); };
    const mo = roomEl && typeof MutationObserver !== 'undefined' ? new MutationObserver((list) => { if (list.some(notPet)) soon(); }) : null;
    if (mo) mo.observe(roomEl, { childList: true, subtree: true, characterData: true });
    const ro = roomEl && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(soon) : null;
    if (ro) { ro.observe(roomEl); for (const el of roomEl.querySelectorAll('[data-assistant-life-room-bub]')) ro.observe(el); }
    const fonts = typeof document !== 'undefined' && document.fonts && document.fonts.addEventListener ? document.fonts : null;
    if (fonts) fonts.addEventListener('loadingdone', soon);
    window.addEventListener('resize', soon);
    return () => { if (t) clearInterval(t); cancelAnimationFrame(raf); if (mo) mo.disconnect(); if (ro) ro.disconnect(); if (fonts) fonts.removeEventListener('loadingdone', soon); window.removeEventListener('resize', soon); };
  }, [on]);
  if (!on) return null;
  return (<><span ref={marker} hidden/>{Object.entries(room.put).filter(([, k]) => k).map(([slot, k]) => {
    const f = assistantLifeFurnOf(k);
    if (!f || !ASSISTANT_LIFE_FURN_SLOTS[slot]) return null;
    const p = moved[slot] || pos(slot);
    const sc = moved[slot] && Number.isFinite(moved[slot].scale) ? moved[slot].scale : 1;
    const sz = Math.max(1, Math.round(size * (sc || 1)));
    return (
      <span key={slot} data-assistant-life-room-furn={`${id}:${slot}:${k}`} data-assistant-life-room-furn-moved={moved[slot] ? '1' : '0'} data-assistant-life-room-furn-hidden={sc === 0 ? '1' : '0'} aria-hidden="true"
        style={{ display: sc === 0 ? 'none' : undefined, position: 'absolute', left: p.left, top: p.top, width: sz, height: sz, zIndex: 2, fontSize: sz, lineHeight: 1, pointerEvents: 'none', filter: 'drop-shadow(0 2px 2px #0006)' }}>
        {slot === 'ceil' && p.top <= 6 && <span style={{ position: 'absolute', bottom: '100%', left: '50%', width: 1, height: Math.round(sz * 0.3), background: '#7c5a3a' }}/>}
        <span>{f.emoji}</span>
      </span>); })}</>);
}

// 部屋のシートの「🪑 家具」(贈る・置く・しまう)。furnItems … 持っている家具の数 { key: 数 } / onGiveFurn(who, key) … 60-app が持ち物を減らして assistantLifeFurnGive を呼ぶ
function AssistantLifeFurnSheet({ id, furnItems, onGiveFurn, onClose, onTalk, land = false }) {
  const st = useAssistantLifeGiftState();
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [buyKey, setBuyKey] = React.useState(null); // 買って贈る(2026-11-08)
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  if (!assistantLifeFurnEnabled() || !who) return null;
  const room = assistantLifeRoomOf(id, st);
  const all = assistantLifeFurnDefs().map(f => assistantLifeFurnOf(f.key)).filter(Boolean);
  const mine = all.filter(f => room.got[f.key]);
  const canGive = all.filter(f => !room.got[f.key] && (Number(furnItems && furnItems[f.key]) || 0) > 0);
  // まだ持っていない家具(買ってそのまま贈れる。同じ家具は1人に1つなので、贈った家具は出さない)
  const toBuy = all.filter(f => !room.got[f.key] && !((Number(furnItems && furnItems[f.key]) || 0) > 0) && assistantLifeCanBuy(f));
  const furnGainText = (k) => { const s = shown(k); if (s !== 'unknown') return `+${assistantLifeFurnAmount(id, k)}`;
    const base = typeof ASSISTANT_LIFE_FURN_PLAYER !== 'undefined' ? ASSISTANT_LIFE_FURN_PLAYER : 80; return `+${base}(好みで変わる)`; };
  const shown = (k) => assistantLifeGiftShownLike(id, k, st);
  const give = async (k, bought = false) => {
    if (busy) return; setBusy(true);
    const talk = typeof onGiveFurn === 'function' ? await onGiveFurn(id, k) : null;
    setBusy(false);
    const f = assistantLifeFurnOf(k);
    if (!talk) { setMsg(`いまは贈れません(持っている数を見てください)${bought && f ? `。買った${f.name}は持ち物に残っています` : ''}`); return; }
    const likeText = talk.like === 'like' ? '💗 好きな家具！' : talk.like === 'bad' ? '💧 ちょっと苦手…' : '';
    const text = `${who.name}に${f.emoji} ${f.name}を贈った。💗 仲良し度 +${talk.amount}${likeText ? ` ・ ${likeText}` : ''}${talk.placed ? '' : `(${ASSISTANT_LIFE_FURN_SLOTS[f.slot].label}はふさがっているので押し入れへ)`}`;
    setMsg(text);
    if (typeof onTalk === 'function') onTalk(talk, text);
  };
  // 行: 名前/置く場所・(まだ贈っていない家具は)上がる量と好み。「?」だけの印はやめて字で言う(2026-11-11 社長「贈るやつも見た目とか分かりにくい」)
  const tagCls = { like: 'bg-pink-600 text-white', mid: 'bg-slate-600 text-white', bad: 'bg-cyan-700 text-white', unknown: 'bg-slate-700 text-slate-200' };
  const row = (f, act, gain = false) => { const s = shown(f.key); return (
    <div key={f.key} className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-2 py-1" data-assistant-life-furn-row={f.key}>
      <span className="text-[24px] leading-none" aria-hidden="true">{f.emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-black leading-snug text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{f.name}</p>
        <p className="text-[11px] font-bold leading-snug text-slate-300"><span className="whitespace-nowrap">{ASSISTANT_LIFE_FURN_SLOTS[f.slot].label}に置く</span>{gain && <>・<span className="whitespace-nowrap text-pink-200">💗 {furnGainText(f.key)}</span></>} <span className={`whitespace-nowrap rounded-full px-1.5 text-[10.5px] font-black ${tagCls[s]}`}>{s === 'unknown' ? '好み ？' : ASSISTANT_LIFE_GIFT_LABEL[s]}</span></p>
      </div>
      {act}
    </div>); };
  const btn = (label, onClick, cls, data) => <button type="button" {...data} disabled={busy} onClick={onClick} className={`min-h-[44px] min-w-[56px] shrink-0 rounded-xl border px-2 text-[11.5px] font-black active:scale-95 disabled:opacity-40 ${cls}`}>{label}</button>;
  return (
    <div className="absolute inset-0" style={{ zIndex: 32 }} data-assistant-life-furn-sheet={id}>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/60" onClick={onClose}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '46%', top: 0, maxHeight: '100%', borderRadius: '22px 0 0 22px', borderTop: 0, borderLeft: '2px solid #fbbf24', paddingTop: 10 } : { borderTopColor: '#fbbf24' }}>
        <p className="mhl-en">FURNITURE · {String(id).toUpperCase()}</p>
        <p className="text-[18px] font-black text-white">🪑 {who.name}の部屋の家具</p>
        <p className="text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>家具を贈ると、<wbr/>その家具の初めての1回だけ <b className="text-pink-200">💗 仲良し度</b>が上がります<wbr/>(好きな家具は多め)。<wbr/>置けるのは 天井・壁・床に1つずつ。<wbr/>ほかは押し入れにしまえます</p>
        {/* 道具(1日の回数あり)との違いを一目で(2026-11-11 社長: 家具は「同じ家具を同じ助手には一度だけ・1日の上限なし」のまま) */}
        <p data-assistant-life-furn-rule className="mt-1 flex flex-wrap gap-1 text-[11px] font-black"><span className="whitespace-nowrap rounded-full bg-amber-400/20 px-2 leading-[22px] text-amber-100">🪑 家具は1⁠日に何個でも贈れる</span><span className="whitespace-nowrap rounded-full bg-slate-800 px-2 leading-[22px] text-slate-200">同じ家具は1人に1つ</span></p>
        {msg && <p data-assistant-life-furn-msg className="mt-1.5 rounded-xl bg-amber-300/15 px-2 py-1 text-[11px] font-black leading-snug text-amber-100">{msg}</p>}
        <p className="mt-2 text-[11px] font-black text-amber-200">🎁 贈れる家具</p>
        <div className="mt-1 space-y-1">
          {canGive.length ? canGive.map(f => row(f, <>{<span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-amber-200">持ち {furnItems[f.key]}</span>}{btn('贈る', () => give(f.key), 'border-amber-300/70 bg-amber-400/20 text-amber-100', { 'data-assistant-life-furn-give': f.key })}</>, true))
            : <p className="rounded-xl bg-slate-800/80 px-2 py-1 text-[11px] font-bold text-slate-300">{toBuy.length ? '持っている家具はありません。下の「まだ持っていない家具」から、買ってそのまま贈れます' : '贈れる家具がありません。モンヒロビートの「ビートP交換所」の「家具」で手に入ります'}</p>}
        </div>
        {toBuy.length > 0 && (<>
          <p className="mt-2 text-[11px] font-black text-violet-200">🛒 まだ持っていない家具 <span className="text-slate-300">(買ってそのまま贈れます)</span></p>
          <div className="mt-1 space-y-1" data-assistant-life-furn-tobuy>
            {toBuy.map(f => row(f, btn(<>🛒 {f.cost}P<br/>で買って贈る</>, () => setBuyKey(f.key), 'border-violet-300/80 bg-violet-600 leading-tight text-white', { 'data-assistant-life-furn-buy': f.key, 'aria-label': `${f.name}を${f.cost}Pで買って贈る` }), true))}
          </div>
        </>)}
        <div className="mt-1"><AssistantLifeShopButton tab="furniture" who={id} label="🛒 交換所の家具の棚へ"/></div>
        {/* 部屋に置いてある家具と押し入れの家具を、見出しで分ける(2026-11-08 ミハリ「どちらが置いてあるか字で分からない」) */}
        <p className="mt-2 text-[11px] font-black text-amber-200">🏠 部屋に置いてある家具 <span className="text-slate-300">({mine.length}/{all.length}持っている)</span></p>
        <div className="mt-1 space-y-1" data-assistant-life-furn-placed>
          {mine.filter(f => room.put[f.slot] === f.key).length ? mine.filter(f => room.put[f.slot] === f.key).map(f => row(f, btn('しまう', () => assistantLifeFurnMove(id, f.key, false), 'border-slate-500 text-slate-200', { 'data-assistant-life-furn-keep': f.key })))
            : <p className="rounded-xl bg-slate-800/80 px-2 py-1 text-[11px] font-bold text-slate-300">まだありません</p>}
        </div>
        {mine.some(f => room.put[f.slot] !== f.key) && (<>
          <p className="mt-2 text-[11px] font-black text-amber-200">📦 押し入れ</p>
          <div className="mt-1 space-y-1" data-assistant-life-furn-kept>
            {mine.filter(f => room.put[f.slot] !== f.key).map(f => row(f, btn(room.put[f.slot] ? '入れかえる' : '置く', () => assistantLifeFurnMove(id, f.key, true), 'border-pink-300/70 bg-pink-400/15 text-pink-100', { 'data-assistant-life-furn-put': f.key })))}
          </div>
        </>)}
        <button type="button" data-assistant-life-furn-close data-mhl-sheet-close onClick={onClose} className="mt-2 min-h-[44px] w-full rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">閉じる</button>
      </div>
      {buyKey && (() => { const f = assistantLifeFurnOf(buyKey); return f ? (
        <AssistantLifeBuyConfirm item={f} to={who.name} onClose={() => setBuyKey(null)}
          gains={[{ text: `💗 ${who.name}との仲良し度 ${furnGainText(f.key)}(1つの家具は1回)` }]}
          check={() => (assistantLifeRoomOf(id).got[f.key] ? 'この家具はもう贈りました' : '')} give={() => give(f.key, true)}/>) : null; })()}
    </div>);
}
