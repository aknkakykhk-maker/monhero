// ===== 助手ライフ: 人間らしい関係の出来事(けんか・仲直り・やきもちなど。助手部キズナ) =====
// 2026-11-07 社長「助手同士の関係で喧嘩とか仲直りとかそういう人間じみたのもどんどんいれてね」/2026-11-08 社長「別の担当を立てて今から」
// 案: docs/progress/assistant-peer/LIFE-HOUSE-PLAN.md の 10。台本: lines/kotoba-house.txt・tsumugi-house.txt(取り込みは tools/assistant/life-rel-talks-import.js)
// 今の「言い合い → 距離をおく → 仲直り」(56-assistant-peer.jsx の quarrel・56-assistant-life.jsx)の流れに乗せる。ここに置くもの:
//   けんか(原因つき)を言い合いの台本として足す/仲直りの形(謝る・間に入る・{name}が取り持つ・差し入れ)/やきもち・ないしょ話・相談・
//   からかう・ライバル心・久しぶりの気まずさ/家での見せ方(🚪 扉を閉める・居間で離れて座る・🤝 仲直りの札・💭 やきもち)
// 決まり: けんかで友情Lv は下げない・仲直り +5・間に入る +3・ほか +2/同じ組は仲直りから2日はけんかしない/
//   どの組も次の日の朝4時の切り替えまでに自分たちで仲直りする/悪口・いじめは書かない
// 保存は新しいキー mh_assistant_life_rel_v1 だけ({ mended: { ペア: { day, abs } } })。今のキーは変えない。
// プレイヤーのスコア・ランキング・セーブ・マスモンには何も効かない。公開の印 assistantLife の後ろ(印が偽なら何も起きない)

// 台本 ASSISTANT_LIFE_REL_TALKS は data/assistant-life-rel-talks.js(index.html が読む)。段10(2026-11-22)でここから移した。書くのは tools/assistant/life-rel-talks-import.js

const ASSISTANT_LIFE_REL_CAUSES = Object.freeze({ tidy: '片づけ', snack: 'おやつ', song: '曲の好み', win: '負けず嫌い', late: '寝坊・遅刻', promise: '約束を忘れた' });
const ASSISTANT_LIFE_REL_KEY = 'mh_assistant_life_rel_v1';
const ASSISTANT_LIFE_REL_COOL_DAYS = 2; // 仲直りした日から2日は、同じ組はけんかしない
const ASSISTANT_LIFE_REL_CHANCE = 0.3; // ふだんの掛け合いのうち、関係の出来事(からかう・ライバルなど)になる割合
const ASSISTANT_LIFE_REL_JEALOUS_CHANCE = 0.35;

// ---------- 保存(足すだけ) ----------
const assistantLifeRelDayOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const normalizeAssistantLifeRel = (v) => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const src = o.mended && typeof o.mended === 'object' && !Array.isArray(o.mended) ? o.mended : {};
  const mended = {};
  for (const [k, x] of Object.entries(src)) {
    if (!/^[a-z]+-[a-z]+$/.test(k) || !x || typeof x !== 'object' || !assistantLifeRelDayOk(x.day)) continue;
    mended[k] = { day: x.day, abs: Number.isFinite(x.abs) ? x.abs : null };
  }
  return { mended };
};
const ASSISTANT_LIFE_REL_STORE = {
  state: { loaded: false, mended: {} },
  loading: null,
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      let v = null; try { v = await storeGet(ASSISTANT_LIFE_REL_KEY, null, false); } catch {}
      this.state = { ...normalizeAssistantLifeRel(v), loaded: true };
      return this.state;
    })();
    return this.loading;
  },
  save() { try { storeSet(ASSISTANT_LIFE_REL_KEY, { mended: this.state.mended }, false); } catch {} },
};
const assistantLifeRelDayDiff = (a, b) => {
  if (!assistantLifeRelDayOk(a) || !assistantLifeRelDayOk(b)) return Infinity;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
};
// 仲直りしてから2日のあいだは、同じ組はけんかしない(読むだけ。読み込み前は止めない)
const assistantLifeRelCooling = (pairKey, now = Date.now()) => {
  const m = ASSISTANT_LIFE_REL_STORE.state.mended[pairKey];
  if (!m) return false;
  const d = assistantLifeRelDayDiff(m.day, assistantLifeDayKey(now));
  return d >= 0 && d <= ASSISTANT_LIFE_REL_COOL_DAYS;
};

// ---------- 台本を使う形にする ----------
let assistantLifeRelCache = null;
const assistantLifeRelSet = () => {
  if (assistantLifeRelCache) return assistantLifeRelCache;
  const raw = typeof ASSISTANT_LIFE_REL_TALKS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_REL_TALKS) ? ASSISTANT_LIFE_REL_TALKS : [];
  const by = {}; for (const t of raw) (by[t.kind] = by[t.kind] || []).push(t);
  const key2 = (t) => assistantLifePairKey(t.ppl[0], t.ppl[1]);
  const base = (t, extra) => ({ id: t.id, keys: t.keys || {}, lines: t.lines, lv: 1, scene: 'any', life: true, rel: t.kind, ...extra });
  const out = { quarrel: [], mend: [], mend3: [], jealous: [], pair: [], byId: {} };
  for (const t of by.fight || []) {
    const pair = [...t.ppl].sort();
    out.quarrel.push(base(t, { pair, kind: 'quarrel', lv: 2, scene: 'home', makeupId: `${t.id}m`, distance: t.distance || [], cause: t.keys.cause }));
    out.quarrel.push(base(t, { id: `${t.id}m`, pair, kind: 'makeup', lv: 2, scene: 'home', quarrelId: t.id, lines: t.makeup, cause: t.keys.cause }));
  }
  for (const t of by.mend || []) out.mend.push(base(t, { pair: [...t.ppl].sort(), pk: key2(t), how: t.keys.how }));
  // 間に入る: ppl[0] が間に入る人、ppl[1]・ppl[2] がけんかした2人
  for (const t of by.mend3 || []) out.mend3.push(base(t, { mediator: t.ppl[0], pair: [t.ppl[1], t.ppl[2]].sort(), pk: assistantLifePairKey(t.ppl[1], t.ppl[2]) }));
  // やきもち: ppl[0] が見ている人、ppl[1]・ppl[2] が仲のいい2人。3人の掛け合い(trio)として流す
  for (const t of by.jealous || []) out.jealous.push(base(t, { kind: 'trio', trio: [...t.ppl].sort(), watcher: t.ppl[0], pk: assistantLifePairKey(t.ppl[1], t.ppl[2]) }));
  for (const k of ['secret', 'consult', 'tease', 'rival', 'awkward']) for (const t of by[k] || []) out.pair.push(base(t, { pair: [...t.ppl].sort(), pk: key2(t), from: t.ppl[0], to: t.ppl[1] }));
  for (const list of [out.quarrel, out.mend, out.mend3, out.jealous, out.pair]) for (const t of list) out.byId[t.id] = t;
  assistantLifeRelCache = out;
  return out;
};
// 原因つきのけんか(言い合いの台本の3つ目の元。下の assistantLifeRelQuarrels から)
const assistantLifeRelQuarrelTalks = () => assistantLifeRelSet().quarrel;
// ---------- けんかの台本を1つの表に(段10・2026-11-22) ----------
// けんか(言い合い → 距離をおく → 仲直り)の元は3つ。ここで1つの並びにして、HOME の掛け合い・家の様子・見返し・思い出アルバムが同じ表を引く
//   ① 前からの言い合い(data の ASSISTANT_PEER_QUARRELS)。印 assistantLife が偽でも出る。印が真なら書き直しの表(assistantPeerRewrite)の文
//   ② 助手たちの今の言い合い(data の ASSISTANT_LIFE_TALKS の kind 'quarrel')
//   ③ 原因つきのけんか(data の ASSISTANT_LIFE_REL_TALKS の fight)。②③は印が真のときだけ
// どれも けんか(kind 'quarrel'・makeupId)と仲直り(kind 'makeup'・quarrelId)の2本ずつ。id・並び・中身は前と同じ
//   (思い出アルバムとけんかの保存 mh_assistant_peer_quarrel_v1 が id で覚えている)。数と中身の見張り: tools/assistant/life-script-count-check.js
let assistantLifeRelLifeQuarrelCache = null;
const assistantLifeRelLifeQuarrels = () => {
  if (assistantLifeRelLifeQuarrelCache) return assistantLifeRelLifeQuarrelCache;
  const raw = typeof ASSISTANT_LIFE_TALKS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_TALKS) ? ASSISTANT_LIFE_TALKS : [];
  const okLines = (a) => Array.isArray(a) && a.length > 0 && a.every(l => l && typeof l.who === 'string' && typeof l.t === 'string');
  const out = [];
  for (const t of raw) {
    if (!t || t.kind !== 'quarrel' || typeof t.id !== 'string' || !okLines(t.lines) || !Array.isArray(t.pair)) continue;
    const keys = t.keys && typeof t.keys === 'object' ? t.keys : {};
    const base = { id: t.id, keys, lines: t.lines, lv: 1, scene: 'any', life: true, at: assistantLifeTalkAt(t, keys), tods: assistantLifeTalkTods(t) };
    const pair = [...t.pair].sort();
    out.push({ ...base, pair, kind: 'quarrel', lv: 2, scene: 'home', makeupId: `${t.id}m`, distance: okLines(t.distance) ? t.distance : [] });
    if (okLines(t.makeup)) out.push({ ...base, id: `${t.id}m`, pair, kind: 'makeup', lv: 2, scene: 'home', quarrelId: t.id, lines: t.makeup });
  }
  assistantLifeRelLifeQuarrelCache = out;
  return out;
};
const assistantLifeRelQuarrels = (on) => {
  const out = [];
  const rewrite = typeof assistantPeerRewrite === 'function' ? assistantPeerRewrite : (t) => t;
  for (const q0 of (typeof ASSISTANT_PEER_QUARRELS !== 'undefined' && Array.isArray(ASSISTANT_PEER_QUARRELS) ? ASSISTANT_PEER_QUARRELS : [])) {
    const q = rewrite(q0);
    const pair = [...q.pair].sort();
    out.push({ id: q.id, pair, kind: 'quarrel', lv: 2, scene: 'home', makeupId: `${q.id}m`, lines: q.lines, distance: q.distance || [] });
    out.push({ id: `${q.id}m`, pair, kind: 'makeup', lv: 2, scene: 'home', quarrelId: q.id, lines: q.makeup });
  }
  if (on) out.push(...assistantLifeRelLifeQuarrels(), ...assistantLifeRelQuarrelTalks());
  return out;
};
// 思い出アルバムで見返せるもの(仲直り・間に入る・やきもち・からかうなど)
const assistantLifeRelAlbumTalks = () => {
  const x = assistantLifeRelSet();
  return [...x.mend.map(t => ({ ...t, kind: 'makeup' })), ...x.mend3.map(t => ({ ...t, kind: 'makeup' })), ...x.jealous, ...x.pair];
};
// いまのけんかの原因(原因つきでない今までの言い合いは null)
const assistantLifeRelCauseOf = (quarrelId) => {
  const t = assistantLifeRelSet().byId[quarrelId];
  return t && t.cause ? ASSISTANT_LIFE_REL_CAUSES[t.cause] || null : null;
};
// けんか・仲直りの場面を見返す(2026-11-15 社長 r1115-137「この案で作る」)。掛け合いは今の台本のまま、題だけ足す。見返しは何も増やさない(onReplay)
const ASSISTANT_LIFE_REL_FIGHT_TITLES = Object.freeze({ snack: '💢 おやつのことで言い合い', tidy: '💢 片づけのことで言い合い', song: '💢 曲の好みで言い合い', win: '💢 勝ち負けで言い合い', late: '💢 寝坊・遅刻で言い合い', promise: '💢 約束のことで言い合い' });
const ASSISTANT_LIFE_REL_FIGHT_TITLE_ANY = '💢 ちょっとした言い合い';
const assistantLifeRelMendTitle = (how) => {
  const m = String(how || '').match(/^mediator:([a-z]+)$/);
  if (m) return `🤝 ${assistantLifeName(m[1])}が間に入って仲直り`;
  return how === 'gift' ? `🤝 ${assistantLifeRelGiftName()}で仲直り` : how === 'apology' ? '🤝 ごめんねで仲直り' : how === 'player' ? '🤝 あなたが取り持って仲直り' : '🤝 自分たちで仲直り';
};
// tid … けんか(quarrel)か仲直り(makeup)の台本の id。{ talk, title, ids } か null(台本が無い・行が無いときは開かない)
const assistantLifeRelViewOf = (tid, how = null) => {
  if (typeof tid !== 'string' || !tid) return null;
  const X = assistantLifeRelSet();
  let t = X.byId[tid] || null;
  if (!t && typeof assistantPeerExtraTalks === 'function') { try { t = (assistantPeerExtraTalks().quarrels || []).find(x => x.id === tid) || null; } catch { t = null; } }
  if (!t || !Array.isArray(t.lines) || !t.lines.length) return null;
  const ids = Array.isArray(t.pair) ? [...t.pair] : [];
  if (t.kind === 'quarrel') {
    const lines = [...t.lines, ...(Array.isArray(t.distance) ? t.distance : [])];
    const title = (t.cause && ASSISTANT_LIFE_REL_FIGHT_TITLES[t.cause]) || ASSISTANT_LIFE_REL_FIGHT_TITLE_ANY;
    return { talk: { ...t, lines }, title, ids };
  }
  const h = how || (t.mediator ? `mediator:${t.mediator}` : t.how) || 'self';
  return { talk: { ...t, kind: 'makeup' }, title: assistantLifeRelMendTitle(h), ids: t.mediator ? [t.mediator, ...ids] : ids };
};
// 仲直りに使える道具の名前(道具の表から読む。改名「🧺おやつバスケット」が入れば自動でそろう・2026-11-08 社長)
const assistantLifeRelGiftName = () => { try { const x = typeof assistantLifeItemInfo === 'function' ? assistantLifeItemInfo('gift') : null; return (x && x.name) || '差し入れ'; } catch (_) { return '差し入れ'; } };
const assistantLifeRelPending = (peerSt = (typeof ASSISTANT_PEER_STORE !== 'undefined' ? ASSISTANT_PEER_STORE.state : null)) => {
  const q = peerSt && peerSt.quarrel && peerSt.quarrel.pending;
  return q && q.pair ? { ...q, ids: String(q.pair).split('-') } : null;
};
const assistantLifeRelFresh = (list, seen, rand) => {
  if (!list.length) return null;
  const fresh = list.filter(t => !(seen && seen[t.id]));
  const pool = fresh.length ? fresh : list;
  return pool[Math.floor(rand() * pool.length)];
};
// 仲直りの台本を、待っているけんかにつなぐ(kind 'makeup'・quarrelId を待っているけんかに)
const assistantLifeRelAsMakeup = (t, pending, extra = {}) => (t ? { ...t, kind: 'makeup', quarrelId: pending.id, pair: [...pending.ids].sort(), ...extra } : null);
// 待っている仲直りの、けんか自身の仲直りの台本
const assistantLifeRelOwnMakeup = (pending) => {
  const qs = typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks().quarrels : assistantLifeRelQuarrels(true);
  return qs.find(t => t.kind === 'makeup' && t.quarrelId === pending.id) || null;
};

// ---------- 仲直りの選び方 ----------
// 組の中で待っている仲直り: 3人目に間に入る台本があれば「間に入る」/なければ半分は「謝る」・半分はけんか自身の仲直り
const assistantLifeRelPickMend = (pending, group, peerSt, seen = {}, rand = Math.random) => {
  if (!pending || !assistantLifeEnabled()) return null;
  const X = assistantLifeRelSet();
  const ids = (group && group.ids) || pending.ids;
  if (!pending.ids.every(id => ids.includes(id))) return null;
  const others = ids.filter(id => !pending.ids.includes(id));
  if (others.length) {
    const m3 = X.mend3.filter(t => t.pk === pending.pair && others.includes(t.mediator));
    const t = assistantLifeRelFresh(m3, seen, rand);
    if (t) return assistantLifeRelAsMakeup(t, pending, { mediator: t.mediator, trio: [...new Set([t.mediator, ...pending.ids])].sort() });
  }
  if (rand() < 0.5) {
    const t = assistantLifeRelFresh(X.mend.filter(m => m.pk === pending.pair && m.how === 'apology'), seen, rand);
    if (t) return assistantLifeRelAsMakeup(t, pending);
  }
  return null; // けんか自身の仲直り(今の流れ)
};
// 仲直りしたあとの記録と、間に入った助手の友情Lv(+3)。56-assistant-peer.jsx の assistantPeerMakeupDone から呼ぶ
const assistantLifeRelOnMakeup = (talk, { now = Date.now() } = {}) => {
  const how = (talk && talk.how) || null;
  if (!talk || !Array.isArray(talk.pair) || !assistantLifeEnabled()) return;
  const pk = assistantLifePairKey(talk.pair[0], talk.pair[1]);
  void (async () => {
    await ASSISTANT_LIFE_REL_STORE.load();
    const abs = assistantLifeSlotAt(now).abs;
    ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, mended: { ...ASSISTANT_LIFE_REL_STORE.state.mended, [pk]: { day: assistantLifeDayKey(now), abs } } };
    ASSISTANT_LIFE_REL_STORE.save();
    try { ASSISTANT_LIFE_STORE.emit(); } catch {}
    const [a, b] = talk.pair.map(assistantLifeName);
    // 掲示板は短く(狭い横の掲示板でも切れない)。間に入った助手だけ名前を足す
    const by = talk.mediator ? `(${assistantLifeName(talk.mediator)}が間に)` : how === 'gift' ? `(${assistantLifeRelGiftName()}で)` : '';
    if (typeof assistantLifeDiaryAdd === 'function') void assistantLifeDiaryAdd(`🤝 ${a}・${b}が仲直り${by}`, [...talk.pair, ...(talk.mediator ? [talk.mediator] : [])], { kind: 'makeup', now, tid: talk.id, how: talk.mediator ? `mediator:${talk.mediator}` : (how || 'self') });
    if (talk.mediator && typeof assistantPeerGain === 'function') for (const id of talk.pair) await assistantPeerGain(talk.mediator, id, 'mediate');
  })();
};
// {name}が取り持つ(部屋のシートの「🤝 取り持つ」)。その場で仲直りの掛け合いを返す(無料・けんか1回につき1回)
const assistantLifeRelMediate = async (id, now = Date.now()) => {
  if (!assistantLifeEnabled() || typeof ASSISTANT_PEER_STORE === 'undefined') return null;
  await ASSISTANT_PEER_STORE.load();
  await ASSISTANT_LIFE_REL_STORE.load();
  const pending = assistantLifeRelPending(ASSISTANT_PEER_STORE.state);
  if (!pending || !pending.ids.includes(id)) return null;
  const seen = (ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.seen) || {};
  const pick = assistantLifeRelFresh(assistantLifeRelSet().mend.filter(m => m.pk === pending.pair && m.how === 'player'), seen, Math.random);
  const talk = pick ? assistantLifeRelAsMakeup(pick, pending, { how: 'player' }) : assistantLifeRelOwnMakeup(pending);
  if (!talk) return null;
  return assistantLifeRelFinishMakeup(talk, 'player', now);
};
// 差し入れで仲直り(56-assistant-peer.jsx の assistantPeerUseItem から。けんか中の2人に差し入れを渡したときだけ)
const assistantLifeRelOnGift = async (kind, pair, now = Date.now()) => {
  if (kind !== 'gift' || !assistantLifeEnabled() || !Array.isArray(pair) || pair.length !== 2) return null;
  const pending = assistantLifeRelPending(ASSISTANT_PEER_STORE.state);
  if (!pending || pending.pair !== assistantLifePairKey(pair[0], pair[1])) return null;
  await ASSISTANT_LIFE_REL_STORE.load();
  const seen = (ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.seen) || {};
  const pick = assistantLifeRelFresh(assistantLifeRelSet().mend.filter(m => m.pk === pending.pair && m.how === 'gift'), seen, Math.random);
  const talk = pick ? assistantLifeRelAsMakeup(pick, pending, { how: 'gift' }) : assistantLifeRelOwnMakeup(pending);
  return talk ? assistantLifeRelFinishMakeup(talk, 'gift', now) : null;
};
// 仲直りを済ませる(待っている仲直りを消す・+5・プレイヤーとの仲良し度・見た記録・アルバム)
const assistantLifeRelFinishMakeup = async (talk, how, now = Date.now()) => {
  if (!assistantPeerMakeupDone({ ...talk, how })) return null;
  await assistantPeerGain(talk.pair[0], talk.pair[1], 'makeup');
  if (how !== 'self') { try { assistantPeerAddPlayerBond(talk.pair, 'peerMakeup'); } catch {} }
  if (how !== 'self') { try { assistantPeerMarkShown(talk, { scene: 'life', special: false, now }); } catch {} }
  try { assistantPeerAlbumAdd(talk); } catch {}
  return talk;
};
// 朝4時の切り替え: 前の日からのけんかは、自分たちで仲直りする(見ていなくても +5)。時間が変わったとき・家を開いたときに呼ぶ
const assistantLifeRelTick = async (now = Date.now()) => {
  if (!assistantLifeEnabled() || typeof ASSISTANT_PEER_STORE === 'undefined') return false;
  await ASSISTANT_PEER_STORE.load();
  const pending = assistantLifeRelPending(ASSISTANT_PEER_STORE.state);
  if (!pending || !Number.isFinite(pending.at) || assistantLifeDayKey(pending.at) === assistantLifeDayKey(now)) return false;
  await ASSISTANT_LIFE_REL_STORE.load();
  const talk = assistantLifeRelOwnMakeup(pending) || { id: `${pending.id}m`, kind: 'makeup', quarrelId: pending.id, pair: [...pending.ids].sort(), lines: [] };
  return !!(await assistantLifeRelFinishMakeup(talk, 'self', now));
};

// ---------- ふだんの出来事(2人・3人) ----------
// 2人の組: ないしょ話(友情Lv5〜・夜)/相談に乗る(相談する人の気分)/からかう(Lv3〜)/ライバル(練習・カード研究のとき)/久しぶりの気まずさ
const assistantLifeRelPickPair = (pair, group, peerSt, life, seen = {}, rand = Math.random) => {
  if (!assistantLifeEnabled() || !Array.isArray(pair) || pair.length !== 2) return null;
  const [a, b] = [...pair].sort();
  const pk = assistantLifePairKey(a, b);
  if (assistantLifeAirOf(life, a, b) === 'after') return null;
  const lv = assistantLifeLevelOf(peerSt, a, b);
  const moods = (life && life.moods) || {};
  const look = assistantLifeLookNow();
  const night = look === 'night' || (life && assistantLifeSlotAt().i === 0);
  const doing = group && group.doing;
  const seenRecent = ((life && life.recent) || []).some(r => r && r.pair === pk);
  const ok = (t) => {
    if (t.pk !== pk || (seen && seen[t.id])) return false;
    if (t.rel === 'secret') return lv >= 5 && night;
    if (t.rel === 'consult') return lv >= 3 && moods[t.from] === t.keys.mood;
    if (t.rel === 'tease') return lv >= 3;
    if (t.rel === 'rival') return lv >= 2 && ((t.keys.game === 'beat' && doing === 'practice') || (t.keys.game === 'card' && doing === 'cards'));
    if (t.rel === 'awkward') return lv >= 2 && !seenRecent;
    return false;
  };
  const cands = assistantLifeRelSet().pair.filter(ok);
  if (!cands.length) return null;
  // 気分・していることに合うもの(相談・ライバル)は出やすく
  const strong = cands.filter(t => t.rel === 'consult' || t.rel === 'rival');
  if (rand() >= (strong.length ? ASSISTANT_LIFE_REL_CHANCE * 2 : ASSISTANT_LIFE_REL_CHANCE)) return null;
  const t = (strong.length ? strong : cands)[Math.floor(rand() * (strong.length || cands.length))];
  return { ...t, pair: [a, b] };
};
// 3人以上の組: 待っている仲直り(間に入る)/やきもち(仲のいい2人を、もう1人が見ている)
const assistantLifeRelPickGroup = (group, peerSt, life, seen = {}, rand = Math.random) => {
  if (!assistantLifeEnabled() || !group || !Array.isArray(group.ids) || group.ids.length < 3) return null;
  const ids = group.ids;
  const pending = assistantLifeRelPending(peerSt);
  if (pending && pending.ids.every(id => ids.includes(id))) {
    return assistantLifeRelPickMend(pending, group, peerSt, seen, rand) || assistantLifeRelOwnMakeup(pending);
  }
  if (ids.length !== 3) return null; // やきもちは3人のときだけ(4人で「3人で」と言わない)
  const band = (lv) => (lv >= 7 ? '7-10' : lv >= 4 ? '4-6' : null);
  const cands = assistantLifeRelSet().jealous.filter(t => t.trio.every(id => ids.includes(id)) && !(seen && seen[t.id])
    && (() => { const [x, y] = t.pk.split('-'); const bd = band(assistantLifeLevelOf(peerSt, x, y)); return bd && (!t.keys.lv || t.keys.lv === bd); })());
  if (!cands.length || rand() >= ASSISTANT_LIFE_REL_JEALOUS_CHANCE) return null;
  return cands[Math.floor(rand() * cands.length)];
};

// ---------- 家での見せ方 ----------
// 部屋の見え方に足す(56-assistant-life-house.jsx の assistantLifeRoomsOf の最後から)。rooms をその場で書きかえる
//   けんか中: 部屋にひとり → 🚪 扉を閉めて「そっとしておいて」/2人が家で同じ組 → 居間で離れて座る/出かけている → 札に「💢 ◯◯とけんか中」
//   仲直りしたて(同じ時間のうち) → 🤝 仲直りの札/やきもち → 💭 …いいなぁ
const assistantLifeRelDecorateRooms = (rooms, life, peerSt) => {
  if (!assistantLifeEnabled() || !rooms || !life) return rooms;
  const pending = assistantLifeRelPending(peerSt);
  const nm = assistantLifeName;
  if (pending) {
    const [a, b] = pending.ids;
    const living = assistantLifeRelLivingPair(life, peerSt);
    for (const id of pending.ids) {
      const other = id === a ? b : a;
      const r = rooms[id];
      if (!r) continue;
      const w = assistantLifeWhereOf(life, id);
      if (living) { rooms[id] = { tag: ['🛋️ みんなの居間に', `💢 ${nm(other)}と喧嘩中`, null], rel: 'living' }; continue; }
      if (r.in && w && w.place === 'home' && !w.group && w.doing !== 'sleep') rooms[id] = { ...r, after: true, door: true, bub: ['🚪 そっとして', 'おいて'], rel: 'door' };
      else if (r.in && !r.sleep) rooms[id] = { ...r, after: true, bub: [`💢 ${nm(other)}と`, '喧嘩中'], rel: 'quarrel' };
      else if (r.tag) rooms[id] = { ...r, tag: [r.tag[0], `💢 ${nm(other)}と喧嘩中`, r.tag[2] || null], rel: 'quarrel' };
    }
  }
  // 仲直りしたて
  const cur = life && Number.isFinite(life.abs) ? life.abs : assistantLifeSlotAt().abs;
  for (const [pk, m] of Object.entries(ASSISTANT_LIFE_REL_STORE.state.mended || {})) {
    if (m.abs !== cur || (pending && pending.pair === pk)) continue;
    const [a, b] = pk.split('-');
    for (const id of [a, b]) {
      const r = rooms[id];
      if (!r || r.rel) continue;
      const other = id === a ? b : a;
      if (r.in) rooms[id] = { ...r, after: false, mend: other, bub: r.sleep ? r.bub : ['🤝 仲直り！'], rel: 'mend' }; // 相手の名前は部屋のシートに出す(狭い部屋ではみ出さない)
      else if (r.tag) rooms[id] = { ...r, mend: other, tag: [r.tag[0], `🤝 ${nm(other)}と仲直り`, r.tag[2] || null], rel: 'mend' };
    }
  }
  // やきもち: 家にひとりでいる(起きている)助手が、仲のいい2人(友情Lv4〜)が一緒に出かけているのを気にしている
  const groups = (life && life.groups) || [];
  for (const t of assistantLifeRelSet().jealous) {
    const r = rooms[t.watcher];
    if (!r || !r.in || r.sleep || r.rel || r.door) continue;
    const w = assistantLifeWhereOf(life, t.watcher);
    if (!w || w.group || w.place !== 'home') continue;
    const [x, y] = t.pk.split('-');
    if (!rooms[x] || !rooms[y] || !groups.some(g => g.ids.includes(x) && g.ids.includes(y))) continue;
    if (assistantLifeLevelOf(peerSt, x, y) < 4) continue;
    rooms[t.watcher] = { ...r, lonely: false, bub: ['💭 …いいなぁ'], jealous: [x, y], rel: 'jealous' }; // 狭い部屋の「さみしいな…」に置きかえない
  }
  return rooms;
};
// やきもち中の助手に「ようすを見る」「声をかける」と、その気持ちの一言(やきもちの台本の、本人の行だけ)。2026-11-08 ミハリ
const assistantLifeRelSoloTalk = (id, roomState) => {
  if (!assistantLifeEnabled() || !roomState || !Array.isArray(roomState.jealous)) return null;
  const pk = assistantLifePairKey(roomState.jealous[0], roomState.jealous[1]);
  const t = assistantLifeRelSet().jealous.find(x => x.watcher === id && x.pk === pk);
  if (!t) return null;
  const lines = t.lines.filter(l => l.who === id).slice(0, 1);
  return lines.length ? { id: `${t.id}-solo`, kind: 'life-solo', pair: [id], trio: undefined, lines, lv: 1, scene: 'any', life: true, rel: 'jealous-solo' } : null;
};
// けんか中の2人が、家で同じ組(2人だけ)になっているとき → 居間で離れて座る
const assistantLifeRelLivingPair = (life, peerSt) => {
  const pending = assistantLifeRelPending(peerSt);
  if (!pending || !life) return null;
  const g = (life.groups || []).find(x => x.place === 'home' && x.ids.length === 2 && pending.ids.every(id => x.ids.includes(id)));
  return g && g.doing !== 'sleep' ? [...pending.ids] : null;
};
// 居間の2人(離れて座る)。家の絵の居間の中に置く
function AssistantLifeRelLiving({ life, peerSt, width, lh, land }) {
  const pair = assistantLifeRelLivingPair(life, peerSt);
  if (!pair) return null;
  const size = land ? 28 : 32;
  const boardW = Math.min(width * (land ? .42 : .52), 240);
  return (<>
    {pair.map((id, i) => { const who = assistantById(id); return who ? (
      <span key={id} className="mhl-rel-sit" data-assistant-life-rel-sit={id} style={i === 0 ? { left: boardW + 16, bottom: 5 } : { right: 8, bottom: 5 }}>
        <AssistantFace who={who} size={size} accent={who.accent}/>
        <i aria-hidden="true">{i === 0 ? '💢' : '…'}</i>
      </span>) : null; })}
  </>);
}
// 部屋の上に重ねる(扉・仲直りの札)。AssistantLifeRoom から
function AssistantLifeRelRoomLayer({ state, h }) {
  if (!state) return null;
  return (<>
    {state.door && <div className="mhl-rel-shut" data-assistant-life-rel-door style={{ height: Math.max(30, Math.min(64, h - 13 - 26)) }}/>}
    {state.mend && state.in && <span className="mhl-rel-mend" data-assistant-life-rel-mend aria-hidden="true">{[[18, 30, 0], [46, 18, .2], [70, 34, .4], [30, 60, .6], [62, 58, .3]].map(([x, y, d], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>✦</i>)}</span>}
  </>);
}
const ASSISTANT_LIFE_REL_CSS = `
.mhl-rel-shut{position:absolute;left:40%;bottom:13px;width:26%;min-width:34px;max-width:56px;z-index:4;border-radius:14px 14px 0 0;background:linear-gradient(90deg,#7a4b22,#a0703c 45%,#7a4b22);border:2px solid #3b2412;box-shadow:inset 0 0 0 3px #6b4423,0 2px 6px #0007}
.mhl-rel-shut:after{content:"";position:absolute;right:5px;top:55%;width:5px;height:5px;border-radius:50%;background:#fde68a;box-shadow:0 0 3px #fde68a}
.mhl-room:has(.mhl-rel-shut) .pp{visibility:hidden}
.mhl-rel-mend{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}
.mhl-rel-mend i{position:absolute;font-style:normal;font-size:11px;color:#fdba74;text-shadow:0 0 6px #fb923c;opacity:0;animation:mhlRelSpark 1.4s ease-out both}
@keyframes mhlRelSpark{0%{opacity:0;transform:translateY(6px) scale(.4)}30%{opacity:1;transform:translateY(-4px) scale(1.2)}100%{opacity:0;transform:translateY(-14px) scale(.8)}}
.mhl-room:has(.mhl-rel-mend) .bb{background:linear-gradient(#fff7ed,#fed7aa);color:#7c2d12;box-shadow:inset 0 0 0 1.5px #ea580c,0 0 10px #fb923c;animation:mhlRelMend .9s ease-out both}
@keyframes mhlRelMend{0%{transform:scale(.5);opacity:0}45%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}
.mhl-rel-sit{position:absolute;z-index:3;border-radius:50%;box-shadow:0 0 0 2.5px #7dd3fc,0 2px 6px #0008}
.mhl-rel-sit i{position:absolute;top:-8px;right:-8px;font-style:normal;font-size:12px;line-height:1;background:#fff;color:#334155;border-radius:8px;padding:1px 3px;box-shadow:0 1px 3px #0006;font-weight:900}
@media (prefers-reduced-motion:reduce){.mhl-rel-mend i,.mhl-room:has(.mhl-rel-mend) .bb{animation:none}.mhl-rel-mend{display:none}}
`;
function AssistantLifeRelStyle() { return <style>{ASSISTANT_LIFE_REL_CSS}</style>; }
// 部屋のシートの1行(けんか中・仲直りしたて・やきもち)と「🤝 取り持つ」
function AssistantLifeRelSheetRow({ id, state, peerSt, onMediate, onView = null }) {
  const pending = assistantLifeRelPending(peerSt);
  const nm = assistantLifeName;
  if (pending && pending.ids.includes(id)) {
    const other = pending.ids.find(x => x !== id);
    const cause = assistantLifeRelCauseOf(pending.id);
    return (
      <div className="mt-1 rounded-xl border border-sky-300/50 bg-sky-950/60 px-2.5 py-1.5" data-assistant-life-rel-row="quarrel">
        <p className="text-[11.5px] font-black text-sky-100">💢 いま {nm(other)}と喧嘩中{cause ? <span className="whitespace-nowrap">(原因: {cause})</span> : null}</p>
        <p className="text-[10px] font-bold leading-snug text-sky-200">{['朝4時までには、', '自分たちで', '仲直りします。', '取り持つか、', `2人に${assistantLifeRelGiftName()}を`, '渡すと、', 'すぐ仲直り'].map((x, i) => <React.Fragment key={i}>{i ? <wbr/> : null}<span className="whitespace-nowrap">{x}</span></React.Fragment>)}</p>
        {onView && assistantLifeRelViewOf(pending.id) && <button type="button" className="mt-1.5 min-h-[44px] w-full rounded-xl border border-sky-300/60 bg-sky-500/20 text-[13px] font-black text-sky-50 active:scale-[.98]" data-assistant-life-rel-view={pending.id} onClick={() => onView(pending.id)}>💢 喧嘩の様子を見る</button>}
        {onMediate && <button type="button" className="mhl-btn mt-1.5 w-full" data-assistant-life-room-act="mediate" style={{ background: 'linear-gradient(90deg,#fb923c,#f472b6)' }} onClick={() => onMediate(id)}>🤝 取り持つ(無料)</button>}
      </div>);
  }
  if (state && state.mend) return <p className="mt-1 text-[11px] font-black text-orange-200" data-assistant-life-rel-row="mend">🤝 {nm(state.mend)}と仲直りしたところ</p>;
  if (state && state.jealous) return <p className="mt-1 text-[11px] font-black text-amber-200" data-assistant-life-rel-row="jealous">💭 {state.jealous.map(nm).join('と')}が一緒なのが、ちょっと気になる</p>;
  return null;
}
