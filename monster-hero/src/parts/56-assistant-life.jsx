// ===== 助手たちの今(2026-11-07 社長「もっと個々に意思を持たせて、決まりがないほうがいい」) =====
// 設計: docs/progress/assistant-peer/LIFE-PLAN.md。様子を決める仕組み・にぎわい(段階1)と、画面「助手たちの今」・HOME の帯(段階2)
// ★公開の印 RELEASE_FLAGS.assistantLife の後ろ。偽のあいだは にぎわいも数えず、仲良くなり方も今のまま
// ★保存は新しいキーだけ(CLAUDE.md ⑦)。どれも壊れていたら空として読む
//   mh_assistant_life_v1       { salt, abs, slot, moods, groups, solo, recent, nudges, watched(いまの時間に見守った組) }  いまの時間の様子と、最近のできごと・ブリーダーの声かけ
//   mh_assistant_life_play_v1  { day, points, counts(watch … その日に見守った数), lastDay, streak }  その日のにぎわい(遊んだ量)と、続けて遊んだ日数
// 助手どうしの点(mh_assistant_peer_bond_v1)はそのまま使う。ここは読むだけ

const ASSISTANT_LIFE_STORE_KEY = 'mh_assistant_life_v1';
const ASSISTANT_LIFE_PLAY_KEY = 'mh_assistant_life_play_v1';

// 1日の6つの時間(日本時間)。i は並び(深夜が 0)。同じ時間の中では様子は変わらない
const ASSISTANT_LIFE_SLOTS = Object.freeze([
  { id: 'late',      from: 0,  to: 5,  label: '深夜' },
  { id: 'morning',   from: 5,  to: 10, label: '朝' },
  { id: 'noon',      from: 10, to: 14, label: '昼' },
  { id: 'afternoon', from: 14, to: 18, label: '午後' },
  { id: 'evening',   from: 18, to: 21, label: '夕方' },
  { id: 'night',     from: 21, to: 24, label: '夜' },
]);
// 気分。急には変わらない(前の時間の気分が残りやすい)
const ASSISTANT_LIFE_MOODS = Object.freeze({
  happy: 'ごきげん', lonely: 'さみしい', restless: 'そわそわ', sulky: 'すねてる', sleepy: 'ねむい', eager: 'やる気',
});
// していること。label … 台本の {doing}(名詞)/ te … {doing_te}(「〜して」の形)。group … 2人以上でもする(2人の掛け合いの「していること」5つ・コトバと決めた 2026-11-07)
const ASSISTANT_LIFE_DOINGS = Object.freeze({
  snack:    { label: 'おやつ',     te: 'おやつを食べて', group: true,  places: ['cafe', 'plaza', 'home'] },
  practice: { label: '練習',       te: '練習して',       group: true,  places: ['studio'] },
  training: { label: '育成',       te: '育成して',       group: true,  places: ['ranch'] },
  cards:    { label: 'カード研究', te: 'カードを研究して', group: true,  places: ['cardroom', 'library'] },
  walk:     { label: '散歩',       te: '散歩して',       group: true,  places: ['plaza', 'garden', 'hill'] },
  idle:     { label: 'ぼーっと',   te: 'ぼーっとして',   group: false, places: ['home', 'hill', 'garden'] },
  sleep:    { label: 'おやすみ',     te: '寝て',           group: false, places: ['home'] },
  read:     { label: '読書',       te: '本を読んで',     group: false, places: ['library'] },
});
// 場所。台本の {place} に入る言葉(穴の言葉の一覧は docs/progress/assistant-peer/LIFE-WORDS.md)
const ASSISTANT_LIFE_PLACES = Object.freeze({
  home: '家', plaza: '広場', cafe: 'おやつ屋さん', studio: '練習スタジオ', ranch: '育成場',
  cardroom: 'カード部屋', library: '図書室', market: 'マーケット', hill: 'ひなたの丘', garden: '中庭',
});
// 1人ずつの好み(したいことの好みの表。コトバの気持ちの紙・3人組の案もこの表を元にする)
//   social … だれかといたい気持ちの強さ(0〜1)/ fav … 好きな場所(ひとりごとの場所の型「好きな場所」)
//   w … したいことの重み / slot … 時間ごとに重みへ掛ける数 / solo … ひとりが好きな時間 / caring … さみしそうな助手のそばへ行きやすい
//   clingy … ごろごろ・昼寝をしていても、だれかに来てほしい(来ないとさみしくなる)
const ASSISTANT_LIFE_PREFS = Object.freeze({
  mua:       { social: 0.85, fav: 'plaza',   w: { snack: 4, practice: 2, training: 2, cards: 1, walk: 3, idle: 1, sleep: 1, read: 0 },
               slot: { noon: { snack: 1.5 }, evening: { walk: 1.5 } }, note: 'にぎやかなのが好き。人が集まる広場。おやつと散歩、マーケットをのぞくのも好き' },
  kiki:      { social: 0.65, fav: 'library',     w: { snack: 3, practice: 1, training: 3, cards: 1, walk: 2, idle: 2, sleep: 1, read: 1 },
               slot: { morning: { walk: 1.5 }, afternoon: { snack: 1.5 } }, note: '静かな図書室が好き。朝の散歩とおやつ。ゴーレムの育成はしっかり' },
  momosuke:  { social: 0.8,  fav: 'studio',   w: { snack: 2, practice: 4, training: 2, cards: 1, walk: 2, idle: 1, sleep: 1, read: 0 },
               slot: { evening: { practice: 2 }, night: { practice: 1.3 } }, note: '夕方から夜は練習スタジオでレッスン。見てほしいのでだれかと' },
  dra:       { social: 0.6,  fav: 'home',     w: { snack: 3, practice: 1, training: 1, cards: 1, walk: 1, idle: 2, sleep: 4, read: 0 },
               slot: { noon: { sleep: 2 }, afternoon: { sleep: 2 } }, clingy: true, note: '昼寝が好き。だれか来てほしいのに家でごろごろしがち(さみしくなりやすい)' },
  atsu:      { social: 0.6,  fav: 'studio',    w: { snack: 1, practice: 3, training: 4, cards: 2, walk: 1, idle: 1, sleep: 1, read: 0 },
               slot: { morning: { training: 1.5 }, afternoon: { practice: 1.3 } }, note: 'ビートの練習(HELL)とドラゴンの育成。カードも強い' },
  kyuko:     { social: 0.5,  fav: 'library',  w: { snack: 2, practice: 1, training: 2, cards: 3, walk: 1, idle: 1, sleep: 1, read: 3 },
               slot: { afternoon: { read: 3, cards: 1.5 } }, solo: ['afternoon'], note: '午後は図書室でひとりの時間。カードの研究も好き' },
  sorashido: { social: 0.8,  fav: 'cardroom', w: { snack: 1, practice: 3, training: 1, cards: 4, walk: 1, idle: 1, sleep: 1, read: 1 },
               slot: { night: { cards: 2 }, evening: { cards: 1.3 } }, note: '夜はカード部屋で研究と計算。だれかを巻きこみたい' },
  erubin:    { social: 0.7,  fav: 'cardroom',   w: { snack: 2, practice: 1, training: 2, cards: 3, walk: 3, idle: 1, sleep: 1, read: 1 },
               slot: { morning: { walk: 1.3 }, evening: { cards: 1.3 } }, caring: true, note: 'カード部屋(デュラハン)と広場の散歩。さみしそうな助手のそばへ行く' },
});
// 時間ごとにみんなの重みへ掛ける数
const ASSISTANT_LIFE_SLOT_MOD = Object.freeze({
  late:      { sleep: 8, idle: 1.5, snack: 0.3, practice: 0.2, training: 0.2, walk: 0.2 },
  morning:   { walk: 2, sleep: 1.2, snack: 0.8 },
  noon:      { snack: 2 },
  afternoon: { practice: 1.5, training: 1.5 },
  evening:   { snack: 1.3, cards: 1.3 },
  night:     { cards: 1.5, idle: 1.5, sleep: 2, walk: 0.5 },
});
// 気分ごとにしたいことへ掛ける数・だれかといたい気持ちへ掛ける数
const ASSISTANT_LIFE_MOOD_MOD = Object.freeze({
  happy:    { social: 1.1, w: {} },
  lonely:   { social: 1.5, w: { snack: 1.5, walk: 1.5, idle: 1.3 } },
  restless: { social: 1.0, w: { walk: 2, practice: 1.3 } },
  sulky:    { social: 0.4, w: { idle: 2 } },
  sleepy:   { social: 0.5, w: { sleep: 3, idle: 2 } },
  eager:    { social: 1.0, w: { practice: 2, training: 2, cards: 1.3 } },
});

// にぎわい(その日に遊んだ量)。4つの段(2026-11-07 社長: 静か×1・ふつう×1.25・にぎやか×1.5・お祭り×2、1日の上限 20/30/45/60)
//   moves … その日の助手どうしの動きの数(帯・ミニイベント・誘い合い。画面の段階で使う)
const ASSISTANT_LIFE_TIERS = Object.freeze([
  { id: 'quiet',    label: '静か',     min: 0,   mult: 1,    cap: 20, moves: 6 },
  { id: 'normal',   label: 'ふつう',   min: 20,  mult: 1.25, cap: 30, moves: 10 },
  { id: 'lively',   label: 'にぎやか', min: 60,  mult: 1.5,  cap: 45, moves: 16 },
  { id: 'festival', label: 'お祭り',   min: 120, mult: 2,    cap: 60, moves: 24 },
]);
// 遊んだら増えるにぎわい。dailyMax … その遊びで1日に増える上限(null は上限なし。遊び自体が時間を使うもの)
const ASSISTANT_LIFE_PLAY_POINTS = Object.freeze({
  rhythm: { amount: 2, dailyMax: null, label: 'モンヒロビートを1曲' },
  battle: { amount: 2, dailyMax: null, label: 'バトルを1回' },
  card:   { amount: 3, dailyMax: null, label: 'MFバトルカードを1戦' },
  chat:   { amount: 1, dailyMax: 20,   label: '助手とおしゃべり1往復' },
  peer:   { amount: 2, dailyMax: 30,   label: '助手どうしを見守る・誘う・差し入れ' },
});
// 続けて遊んだ日数の上乗せ(その日の始まりのにぎわい)
const ASSISTANT_LIFE_STREAK_BONUS = Object.freeze([{ days: 7, points: 10 }, { days: 3, points: 5 }]);
// 最近のできごとを覚えておく時間の数(6つで1日)
const ASSISTANT_LIFE_RECENT_SLOTS = 12;

const assistantLifeEnabled = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLife === true;
const assistantLifePairKey = (a, b) => [String(a), String(b)].sort().join('-');
const assistantLifeDayKey = (now = Date.now()) => (typeof jstDayKey4 === 'function') ? jstDayKey4(now) : new Date(Number(now) + 5 * 3600000).toISOString().slice(0, 10);

// ---------- 時間 ----------
// abs … 通しの番号(日本時間の暦の日 × 6 + 時間の並び)。1つ進むと次の時間
const assistantLifeSlotAt = (now = Date.now()) => {
  const t = Number(now) + 9 * 3600000;
  const day = Math.floor(t / 86400000);
  const h = new Date(t).getUTCHours();
  const i = Math.max(0, ASSISTANT_LIFE_SLOTS.findIndex(s => h >= s.from && h < s.to));
  return { abs: day * 6 + i, i, id: ASSISTANT_LIFE_SLOTS[i].id, label: ASSISTANT_LIFE_SLOTS[i].label };
};
const assistantLifeSlotOfAbs = (abs) => {
  const i = ((Math.floor(Number(abs) || 0) % 6) + 6) % 6;
  return { abs: Math.floor(Number(abs) || 0), i, id: ASSISTANT_LIFE_SLOTS[i].id, label: ASSISTANT_LIFE_SLOTS[i].label };
};

// ---------- 決まった乱数(同じ時間・同じ端末なら同じ結果) ----------
const assistantLifeHash = (str) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
};
const assistantLifeRng = (seed) => {
  let a = assistantLifeHash(String(seed));
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
const assistantLifePickWeighted = (weights, rand) => {
  const entries = Object.entries(weights).filter(([, v]) => Number.isFinite(v) && v > 0);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!entries.length || total <= 0) return null;
  let r = rand() * total;
  for (const [k, v] of entries) { r -= v; if (r < 0) return k; }
  return entries[entries.length - 1][0];
};

// ---------- 段 ----------
const assistantLifeTierOf = (points) => {
  const p = Math.max(0, Number(points) || 0);
  let tier = ASSISTANT_LIFE_TIERS[0];
  for (const t of ASSISTANT_LIFE_TIERS) if (p >= t.min) tier = t;
  return tier;
};
const assistantLifeTierIndex = (tier) => Math.max(0, ASSISTANT_LIFE_TIERS.findIndex(t => t.id === (tier && tier.id)));

// ---------- 様子を決める(保存しない・検査からも呼ぶ) ----------
// members … 会った助手 / bond … { ペア: 点 } / prev … 前に決めた様子(無くてもよい) / recent・nudges … 最近のできごと・ブリーダーの声かけ
// tier … その日のにぎわいの段 / salt … 端末ごとの種
const assistantLifeDecide = ({ abs, members, bond = {}, prev = null, recent = [], nudges = {}, tier = ASSISTANT_LIFE_TIERS[0], salt = '' }) => {
  const slot = assistantLifeSlotOfAbs(abs);
  const ids = [...new Set((members || []).filter(id => ASSISTANT_LIFE_PREFS[id]))].sort();
  const rand = assistantLifeRng(`${salt}|${slot.abs}|${ids.join(',')}`);
  const gap = prev && Number.isFinite(prev.abs) ? slot.abs - prev.abs : Infinity;
  const inertia = gap === 1 ? 3 : (gap >= 2 && gap <= 6 ? 1.5 : 0);
  const tierI = assistantLifeTierIndex(tier);
  const near = (r, n) => Number.isFinite(r.abs) && slot.abs - r.abs >= 0 && slot.abs - r.abs <= n;
  const recentOf = (kind, pred, n = ASSISTANT_LIFE_RECENT_SLOTS) => (recent || []).some(r => r && r.kind === kind && near(r, n) && pred(r));
  const hasPair = (r, a, b) => r.pair === assistantLifePairKey(a, b);
  // 言い合いのあと3つの時間は距離をおく(そのあと仲直りしていれば終わり)
  const quarrelNow = (a, b) => {
    const qs = (recent || []).filter(r => r && r.kind === 'quarrel' && hasPair(r, a, b) && near(r, 3));
    if (!qs.length) return false;
    const last = Math.max(...qs.map(r => r.abs));
    return !(recent || []).some(r => r && r.kind === 'makeup' && hasPair(r, a, b) && r.abs >= last);
  };
  const invited = new Set((nudges.invite || []).filter(n => n && n.abs === slot.abs).map(n => n.id));
  const introduced = (nudges.introduce || []).filter(n => n && n.abs === slot.abs).map(n => n.pair);
  const prevPairs = new Set(gap === 1 && prev && Array.isArray(prev.groups) ? prev.groups.flatMap(g => { const o = []; for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) o.push(assistantLifePairKey(g.ids[i], g.ids[j])); return o; }) : []);
  const wasLonely = new Set(prev && Array.isArray(prev.lonely) && gap >= 1 && gap <= 2 ? prev.lonely : []);

  // 1. 気分
  const moods = {};
  for (const id of ids) {
    const w = { happy: 3, lonely: 1, restless: 1, sulky: 0.2, sleepy: 1, eager: 2 };
    if (slot.id === 'late' || slot.id === 'night') w.sleepy *= 4;
    if (slot.id === 'morning') w.sleepy *= 2;
    const pm = prev && prev.moods && prev.moods[id];
    if (pm && w[pm] != null && inertia > 0) w[pm] *= inertia;
    if (wasLonely.has(id)) w.lonely *= 4;
    if (ids.some(o => o !== id && quarrelNow(id, o))) w.sulky *= 12;
    if (recentOf('gift', r => (r.ids || []).includes(id), 4) || recentOf('play', r => (r.ids || []).includes(id), 4)) w.happy *= 3;
    if (invited.has(id)) { w.happy *= 4; w.lonely *= 0.2; }
    w.eager *= 1 + 0.3 * tierI; w.happy *= 1 + 0.2 * tierI;
    moods[id] = assistantLifePickWeighted(w, rand) || 'happy';
  }
  // 2. したいこと
  const wantW = {};
  const doing = {};
  for (const id of ids) {
    const p = ASSISTANT_LIFE_PREFS[id];
    const w = {};
    for (const [d, v] of Object.entries(p.w)) {
      let x = v * ((ASSISTANT_LIFE_SLOT_MOD[slot.id] || {})[d] || 1) * (((p.slot || {})[slot.id] || {})[d] || 1);
      x *= (ASSISTANT_LIFE_MOOD_MOD[moods[id]].w[d] || 1);
      w[d] = x;
    }
    wantW[id] = w;
    doing[id] = assistantLifePickWeighted(w, rand) || 'idle';
  }
  // 3. だれかといたいか
  const wants = {};
  for (const id of ids) {
    const p = ASSISTANT_LIFE_PREFS[id];
    let x = p.social * ASSISTANT_LIFE_MOOD_MOD[moods[id]].social;
    if ((p.solo || []).includes(slot.id)) x *= 0.3;
    if (slot.id === 'late') x *= 0.3;
    if (!ASSISTANT_LIFE_DOINGS[doing[id]].group && !p.clingy) x *= 0.4;
    x *= 1 + 0.08 * tierI; // にぎわうほど集まりやすい
    // 誘われた・引き合わせられた助手は、だれかといたい
    wants[id] = invited.has(id) || introduced.some(k => k.split('-').includes(id)) || rand() < Math.min(0.95, x);
  }
  // 4. 相手ごとの点(a から見た b)
  const lvOf = (a, b) => (typeof assistantPeerBondLevel === 'function') ? assistantPeerBondLevel(bond[assistantLifePairKey(a, b)] || 0) : 1;
  const score = (a, b) => {
    if (quarrelNow(a, b)) return -10;
    // 友情Lv は効きすぎないように(同じ2人ばかりにならない)。前の時間も一緒だった2人は、ほかの相手とも過ごしたくなる
    let s = 1 + lvOf(a, b) * 0.25;
    if (prevPairs.has(assistantLifePairKey(a, b))) s -= 1;
    if (doing[a] === doing[b] && ASSISTANT_LIFE_DOINGS[doing[a]].group) s += 1.5;
    if (recentOf('gift', r => hasPair(r, a, b), 6) || recentOf('play', r => hasPair(r, a, b), 6) || recentOf('makeup', r => hasPair(r, a, b), 6)) s += 1.5;
    if (introduced.includes(assistantLifePairKey(a, b))) s += 6;
    if (invited.has(a) || invited.has(b)) s += 3; // 誘われた助手は張り切って、だれかのところへ行く
    if (ASSISTANT_LIFE_PREFS[a].caring && (wasLonely.has(b) || moods[b] === 'lonely')) s += 2;
    // ごろごろ・昼寝・読書をしている相手のところへは行きにくい(来てほしいのに、だれも来ないことがある)
    if (!ASSISTANT_LIFE_DOINGS[doing[b]].group && !ASSISTANT_LIFE_PREFS[a].caring) s -= 1.5;
    return s + rand() * 1.5;
  };
  const mutual = {};
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) mutual[assistantLifePairKey(ids[i], ids[j])] = score(ids[i], ids[j]) + score(ids[j], ids[i]);
  const mu = (a, b) => mutual[assistantLifePairKey(a, b)] ?? -Infinity;
  // 組を作る: おたがいの点が高い2人から
  const free = new Set(ids.filter(id => wants[id]));
  const groups = [];
  const cand = Object.entries(mutual).filter(([k]) => { const [a, b] = k.split('-'); return free.has(a) && free.has(b); }).sort((x, y) => y[1] - x[1]);
  for (const [k, v] of cand) {
    if (v <= 2) break;
    const [a, b] = k.split('-');
    if (!free.has(a) || !free.has(b)) continue;
    free.delete(a); free.delete(b);
    groups.push([a, b]);
  }
  // あぶれた人が、合う組に入る(3人・4人まで)
  const rest = [...free].sort();
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  for (const id of rest) {
    let best = null; let bestS = 2.5;
    for (const g of groups) {
      if (g.length >= 4) continue;
      const avg = g.reduce((s, m) => s + mu(id, m), 0) / g.length;
      if (g.some(m => mu(id, m) < 0)) continue;
      if (avg > bestS) { best = g; bestS = avg; }
    }
    if (best && rand() < (best.length === 2 ? 0.55 : 0.3)) { best.push(id); free.delete(id); }
  }
  // 組の していること・場所。2人きりで「家」「寝る」は作らない(家は ひとり か 3人以上)
  const outGroups = groups.map(g => {
    const sum = {};
    for (const d of Object.keys(ASSISTANT_LIFE_DOINGS)) if (ASSISTANT_LIFE_DOINGS[d].group) sum[d] = g.reduce((s, m) => s + (wantW[m][d] || 0), 0);
    for (const m of g) if (ASSISTANT_LIFE_DOINGS[doing[m]].group) sum[doing[m]] = (sum[doing[m]] || 0) * 1.6;
    const d = assistantLifePickWeighted(sum, rand) || 'walk';
    const places = ASSISTANT_LIFE_DOINGS[d].places.filter(pl => pl !== 'home' || g.length >= 3);
    const place = places[Math.floor(rand() * places.length)] || 'plaza';
    return { ids: [...g].sort(), doing: d, place };
  });
  // ひとりの助手と、その理由(さみしい/マイペース/距離をおいている)
  const solo = {};
  const lonely = [];
  const inGroup = new Set(outGroups.flatMap(g => g.ids));
  for (const id of ids) {
    if (inGroup.has(id)) { if (moods[id] === 'lonely') moods[id] = 'happy'; continue; }
    const p = ASSISTANT_LIFE_PREFS[id];
    const quarrel = ids.some(o => o !== id && quarrelNow(id, o));
    const reason = quarrel ? 'distance' : (wants[id] ? 'lonely' : 'mypace');
    if (reason === 'lonely') { moods[id] = 'lonely'; lonely.push(id); }
    const d = doing[id];
    const places = ASSISTANT_LIFE_DOINGS[d].places;
    // ひとりのときは好きな場所にいやすい(ぼーっと・散歩は、どこの好きな場所でもできる)
    const favOk = places.includes(p.fav) || ((d === 'idle' || d === 'walk') && rand() < 0.6);
    let place = favOk ? p.fav : places[Math.floor(rand() * places.length)];
    if (reason === 'lonely' && (d === 'idle' || d === 'sleep')) place = 'home';
    solo[id] = { doing: d, place, reason };
  }
  return { abs: slot.abs, slot: slot.id, moods, groups: outGroups, solo, lonely };
};

// 様子の1行(画面の段階で使う。ここでは検査と見積もりのため)
const assistantLifeDescribe = (life, nameOf = (id) => id) => {
  const out = [];
  for (const g of (life && life.groups) || []) out.push(`${g.ids.map(nameOf).join('・')}が${ASSISTANT_LIFE_PLACES[g.place]}で${ASSISTANT_LIFE_DOINGS[g.doing].label}`);
  for (const [id, s] of Object.entries((life && life.solo) || {})) {
    const tail = s.reason === 'lonely' ? '(さみしそう)' : s.reason === 'distance' ? '(距離をおいている)' : '';
    out.push(`${nameOf(id)}は${ASSISTANT_LIFE_PLACES[s.place]}で${ASSISTANT_LIFE_DOINGS[s.doing].label}${tail}`);
  }
  return out;
};

// ---------- にぎわい(保存しない・検査からも呼ぶ) ----------
const assistantLifeDayBefore = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
const assistantLifeStreakBonus = (streak) => { for (const b of ASSISTANT_LIFE_STREAK_BONUS) if (streak >= b.days) return b.points; return 0; };
// その日のにぎわいへそろえる(日付が変わったら数え直し、続けた日数を進める)
const assistantLifePlayForDay = (play, day) => {
  const p = play && typeof play === 'object' ? play : {};
  if (p.day === day) return p;
  const streak = p.day && p.day === assistantLifeDayBefore(day) ? (Number(p.streak) || 1) + 1 : 1;
  return { day, points: assistantLifeStreakBonus(streak), counts: {}, lastDay: p.day || null, streak };
};
const assistantLifeAddPlayState = (play, kind, day) => {
  const def = ASSISTANT_LIFE_PLAY_POINTS[kind];
  const p = assistantLifePlayForDay(play, day);
  if (!def) return { play: p, gained: 0 };
  const used = (p.counts && p.counts[kind]) || 0;
  const gain = def.dailyMax == null ? def.amount : Math.max(0, Math.min(def.amount, def.dailyMax - used));
  if (gain <= 0) return { play: p, gained: 0 };
  const before = assistantLifeTierOf(p.points);
  const next = { ...p, points: (p.points || 0) + gain, counts: { ...(p.counts || {}), [kind]: used + gain } };
  const after = assistantLifeTierOf(next.points);
  return { play: next, gained: gain, tierUp: after.id !== before.id ? after : null };
};
// 助手どうしの仲良くなり方。段の倍率と1日の上限(56-assistant-peer.jsx の assistantPeerGainState が使う)
const assistantLifeGainOpts = (play, day) => {
  const tier = assistantLifeTierOf(assistantLifePlayForDay(play, day).points);
  return { mult: tier.mult, cap: tier.cap, tier: tier.id };
};

// ---------- 読み直し ----------
const normalizeAssistantLifePlay = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.day !== 'string') return { day: null, points: 0, counts: {}, lastDay: null, streak: 0 };
  const counts = {};
  if (v.counts && typeof v.counts === 'object' && !Array.isArray(v.counts)) for (const [k, n] of Object.entries(v.counts)) if ((ASSISTANT_LIFE_PLAY_POINTS[k] || k === 'watch') && Number.isFinite(n) && n >= 0) counts[k] = Math.floor(n);
  return { day: v.day, points: Number.isFinite(v.points) && v.points >= 0 ? Math.floor(v.points) : 0, counts,
    lastDay: typeof v.lastDay === 'string' ? v.lastDay : null, streak: Number.isFinite(v.streak) && v.streak >= 0 ? Math.floor(v.streak) : 0 };
};
const normalizeAssistantLife = (v) => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const ok = (id) => typeof id === 'string' && !!ASSISTANT_LIFE_PREFS[id];
  const moods = {};
  if (o.moods && typeof o.moods === 'object') for (const [id, m] of Object.entries(o.moods)) if (ok(id) && ASSISTANT_LIFE_MOODS[m]) moods[id] = m;
  const groups = Array.isArray(o.groups) ? o.groups.filter(g => g && Array.isArray(g.ids) && g.ids.length >= 2 && g.ids.every(ok) && ASSISTANT_LIFE_DOINGS[g.doing] && ASSISTANT_LIFE_PLACES[g.place])
    .map(g => ({ ids: [...g.ids], doing: g.doing, place: g.place })) : [];
  const solo = {};
  if (o.solo && typeof o.solo === 'object') for (const [id, s] of Object.entries(o.solo)) if (ok(id) && s && ASSISTANT_LIFE_DOINGS[s.doing] && ASSISTANT_LIFE_PLACES[s.place]) solo[id] = { doing: s.doing, place: s.place, reason: ['lonely', 'mypace', 'distance'].includes(s.reason) ? s.reason : 'mypace' };
  const recent = Array.isArray(o.recent) ? o.recent.filter(r => r && typeof r.kind === 'string' && Number.isFinite(r.abs)).slice(-40) : [];
  const nudgeList = (x) => Array.isArray(x) ? x.filter(n => n && Number.isFinite(n.abs)).slice(-20) : [];
  const nudges = { invite: nudgeList(o.nudges && o.nudges.invite).filter(n => ok(n.id)), introduce: nudgeList(o.nudges && o.nudges.introduce).filter(n => typeof n.pair === 'string') };
  return { salt: typeof o.salt === 'string' && o.salt ? o.salt : '', abs: Number.isFinite(o.abs) ? o.abs : null, slot: typeof o.slot === 'string' ? o.slot : null,
    moods, groups, solo, lonely: Array.isArray(o.lonely) ? o.lonely.filter(ok) : [], recent, nudges,
    watched: Array.isArray(o.watched) ? o.watched.filter(k => typeof k === 'string').slice(-10) : [] };
};

// ---------- 入れ物 ----------
const ASSISTANT_LIFE_STORE = {
  state: { loaded: false, open: false, life: normalizeAssistantLife(null), play: normalizeAssistantLifePlay(null) },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [life, play] = await Promise.all([storeGet(ASSISTANT_LIFE_STORE_KEY, null, false), storeGet(ASSISTANT_LIFE_PLAY_KEY, null, false)].map(p => Promise.resolve(p).catch(() => null)));
      const l = normalizeAssistantLife(life);
      if (!l.salt) l.salt = Math.random().toString(36).slice(2, 10);
      this.set({ loaded: true, life: l, play: normalizeAssistantLifePlay(play) });
      return this.state;
    })();
    return this.loading;
  },
};
const assistantLifeSaveLife = () => { try { storeSet(ASSISTANT_LIFE_STORE_KEY, ASSISTANT_LIFE_STORE.state.life, false); } catch {} };
const assistantLifeSavePlay = () => { try { storeSet(ASSISTANT_LIFE_PLAY_KEY, ASSISTANT_LIFE_STORE.state.play, false); } catch {} };

// いまの時間の様子。時間が変わっていたら、前の様子から次を決めて保存する
const assistantLifeNow = async ({ members, now = Date.now() } = {}) => {
  if (!assistantLifeEnabled()) return null;
  await ASSISTANT_LIFE_STORE.load();
  const slot = assistantLifeSlotAt(now);
  const cur = ASSISTANT_LIFE_STORE.state.life;
  const ids = [...new Set((members || []).filter(id => ASSISTANT_LIFE_PREFS[id]))].sort();
  const sameMembers = ids.join(',') === [...new Set([...cur.groups.flatMap(g => g.ids), ...Object.keys(cur.solo)])].sort().join(',');
  if (cur.abs === slot.abs && sameMembers) return cur;
  if (typeof ASSISTANT_PEER_STORE !== 'undefined') { try { await ASSISTANT_PEER_STORE.load(); } catch {} }
  const bond = (typeof ASSISTANT_PEER_STORE !== 'undefined' && ASSISTANT_PEER_STORE.state && ASSISTANT_PEER_STORE.state.bond) || {};
  const day = assistantLifeDayKey(now);
  const tier = assistantLifeTierOf(assistantLifePlayForDay(ASSISTANT_LIFE_STORE.state.play, day).points);
  const prev = cur.abs != null && cur.abs < slot.abs ? cur : null;
  const decided = assistantLifeDecide({ abs: slot.abs, members: ids, bond, prev, recent: cur.recent, nudges: cur.nudges, tier, salt: cur.salt });
  const keep = (n) => n.abs >= slot.abs;
  const life = { ...cur, ...decided, watched: [], recent: cur.recent.filter(r => slot.abs - r.abs <= ASSISTANT_LIFE_RECENT_SLOTS),
    nudges: { invite: cur.nudges.invite.filter(keep), introduce: cur.nudges.introduce.filter(keep) } };
  ASSISTANT_LIFE_STORE.set({ life });
  assistantLifeSaveLife();
  return life;
};
// 最近のできごとを覚える(kind: gift・play・quarrel・makeup。pair か ids)
const assistantLifeNote = async (kind, { pair = null, ids = null, now = Date.now() } = {}) => {
  if (!assistantLifeEnabled()) return;
  await ASSISTANT_LIFE_STORE.load();
  const life = ASSISTANT_LIFE_STORE.state.life;
  const abs = assistantLifeSlotAt(now).abs;
  const ids2 = ids || (pair ? String(pair).split('-') : []);
  const rec = { kind, abs, pair: pair || (ids2.length === 2 ? assistantLifePairKey(ids2[0], ids2[1]) : null), ids: ids2 };
  ASSISTANT_LIFE_STORE.set({ life: { ...life, recent: [...life.recent, rec].slice(-40) } });
  assistantLifeSaveLife();
};
// ブリーダーの声かけ。次の時間に効く(誘う … その助手がどこかの組に入る/引き合わせる … 2人が一緒に過ごしやすい)
const assistantLifeNudge = async (kind, value, now = Date.now()) => {
  if (!assistantLifeEnabled()) return false;
  await ASSISTANT_LIFE_STORE.load();
  const life = ASSISTANT_LIFE_STORE.state.life;
  const abs = assistantLifeSlotAt(now).abs + 1;
  const nudges = { ...life.nudges };
  if (kind === 'invite' && ASSISTANT_LIFE_PREFS[value]) nudges.invite = [...nudges.invite.filter(n => !(n.id === value && n.abs === abs)), { id: value, abs }];
  else if (kind === 'introduce' && Array.isArray(value) && value.length === 2) { const pair = assistantLifePairKey(value[0], value[1]); nudges.introduce = [...nudges.introduce.filter(n => !(n.pair === pair && n.abs === abs)), { pair, abs }]; }
  else return false;
  ASSISTANT_LIFE_STORE.set({ life: { ...life, nudges } });
  assistantLifeSaveLife();
  void assistantLifeAddPlay('peer');
  return true;
};
// 遊んだとき(ビート・バトル・カード・おしゃべり・助手どうし)。段が上がったら tierUp を返す
const assistantLifeAddPlay = async (kind, now = Date.now()) => {
  if (!assistantLifeEnabled()) return { gained: 0 };
  await ASSISTANT_LIFE_STORE.load();
  const r = assistantLifeAddPlayState(ASSISTANT_LIFE_STORE.state.play, kind, assistantLifeDayKey(now));
  if (r.gained > 0) { ASSISTANT_LIFE_STORE.set({ play: r.play }); assistantLifeSavePlay(); }
  return r;
};
// 助手どうしの仲良くなり方(印が偽なら null = 今のまま)
const assistantLifeGainOptsNow = (now = Date.now()) => {
  if (!assistantLifeEnabled() || !ASSISTANT_LIFE_STORE.state.loaded) return null;
  return assistantLifeGainOpts(ASSISTANT_LIFE_STORE.state.play, assistantLifeDayKey(now));
};
const useAssistantLifeState = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_STORE.state);
  React.useEffect(() => {
    ASSISTANT_LIFE_STORE.listeners.add(setSt);
    ASSISTANT_LIFE_STORE.load().then(s => setSt(s)).catch(() => {});
    return () => { ASSISTANT_LIFE_STORE.listeners.delete(setSt); };
  }, []);
  return st;
};

// ---------- 見守る(段階2) ----------
// その日に見守れる数は、にぎわいの段の moves(静か6・ふつう10・にぎやか16・お祭り24)。やりこむほど動きが増える(2026-11-07 社長)
const assistantLifeWatchLeft = (play, day) => {
  const p = assistantLifePlayForDay(play, day);
  const tier = assistantLifeTierOf(p.points);
  return Math.max(0, tier.moves - ((p.counts && p.counts.watch) || 0));
};
// その組の掛け合いを1本選ぶ(いまある台本から。組の中の2人か3人だけが話すもの・友情Lv の足りるもの・最近見ていないもの)
const assistantLifePickWatchTalk = (group, peerSt) => {
  if (!group || typeof assistantPeerAllTalks !== 'function') return null;
  const ids = group.ids;
  const lvOf = (a, b) => (typeof assistantPeerLevel === 'function') ? assistantPeerLevel(peerSt, a, b) : 1;
  const pool = assistantPeerAllTalks().filter(t => {
    if (t.special || t.kind === 'quarrel' || t.kind === 'makeup' || t.when || t.gen) return false;
    const m = assistantPeerMembers(t);
    if (!m.length || !m.every(id => ids.includes(id))) return false;
    if (t.scene && t.scene !== 'any' && t.scene !== 'home') return false;
    const pairs = assistantPeerPairsOf(t);
    return pairs.every(([a, b]) => lvOf(a, b) >= (t.lv || 1));
  });
  if (!pool.length) return null;
  const recent = ((peerSt && peerSt.log) || []).map(x => x.id);
  const fresh = pool.filter(t => !recent.includes(t.id));
  const list = fresh.length ? fresh : pool;
  return list[Math.floor(Math.random() * list.length)];
};
const assistantLifeGroupKey = (g) => (g && g.ids ? g.ids.join('+') : '');
// 見守った。組のペアそれぞれの友情Lv(掛け合いと同じ)・プレイヤーとの仲良し度・にぎわいが上がる。流す台本を返す
const assistantLifeWatch = async (group, now = Date.now()) => {
  if (!assistantLifeEnabled() || !group) return null;
  await ASSISTANT_LIFE_STORE.load();
  if (typeof ASSISTANT_PEER_STORE !== 'undefined') await ASSISTANT_PEER_STORE.load();
  const day = assistantLifeDayKey(now);
  const life = ASSISTANT_LIFE_STORE.state.life;
  const key = assistantLifeGroupKey(group);
  if ((life.watched || []).includes(key) || assistantLifeWatchLeft(ASSISTANT_LIFE_STORE.state.play, day) <= 0) return null;
  const talk = assistantLifePickWatchTalk(group, ASSISTANT_PEER_STORE.state);
  if (!talk) return null;
  const p = assistantLifePlayForDay(ASSISTANT_LIFE_STORE.state.play, day);
  ASSISTANT_LIFE_STORE.set({ life: { ...life, watched: [...(life.watched || []), key] }, play: { ...p, counts: { ...(p.counts || {}), watch: ((p.counts && p.counts.watch) || 0) + 1 } } });
  assistantLifeSaveLife(); assistantLifeSavePlay();
  // 見た記録(最近見たもの・アルバム)と上がり方は、ふだんの掛け合いと同じ(1日の数には入れない)
  try { assistantPeerMarkShown(talk, { scene: 'life', special: false, now }); } catch {}
  try { assistantPeerAlbumAdd(talk); } catch {}
  for (const [a, b] of assistantPeerPairsOf(talk)) await assistantPeerGain(a, b, 'talk');
  assistantPeerAddPlayerBond(assistantPeerMembers(talk), talk.kind === 'trio' ? 'peerTrio' : 'peerTalk');
  return talk;
};

// ---------- 画面「助手たちの今」・HOME の帯(段階2) ----------
const assistantLifeOpenScreen = () => { if (assistantLifeEnabled()) ASSISTANT_LIFE_STORE.set({ open: true }); };
const assistantLifeCloseScreen = () => ASSISTANT_LIFE_STORE.set({ open: false });
// 段ごとのひとこと(上の帯)
const ASSISTANT_LIFE_TIER_NOTES = Object.freeze({
  quiet: 'のんびりした一日。遊ぶほど、みんなの動きが増えます',
  normal: 'いつもどおりの一日。みんな、それぞれ過ごしています',
  lively: 'よく遊んでくれたから、みんな元気！',
  festival: 'お祭りみたいににぎやか！ 友情Lv がぐんぐん上がります',
});
const ASSISTANT_LIFE_REASON_LABEL = Object.freeze({ lonely: 'さみしそう', mypace: 'マイペース', distance: '距離をおいている' });
const assistantLifeSlotRange = (id) => { const s = ASSISTANT_LIFE_SLOTS.find(x => x.id === id); return s ? `${s.label}(${s.from}〜${s.to}時)` : ''; };

// 様子を、いまの時間に合わせて読む(画面と帯で使う)
const useAssistantLifeNow = (metIds) => {
  const st = useAssistantLifeState();
  const key = (metIds || []).join(',');
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!assistantLifeEnabled()) return;
    void assistantLifeNow({ members: metIds });
    // 時間が変わったら決め直す(1分ごとに見る)
    const t = setInterval(() => { setTick(n => n + 1); void assistantLifeNow({ members: metIds }); }, 60000);
    return () => clearInterval(t);
  }, [key]);
  return st;
};

function AssistantLifeFaces({ ids, size = 32 }) {
  return (
    <span className="flex shrink-0 -space-x-2">
      {ids.map(id => { const who = assistantById(id); return who ? <span key={id} className="rounded-full ring-2 ring-slate-950"><AssistantFace who={who} size={size} accent={who.accent}/></span> : null; })}
    </span>);
}

function AssistantLifeBand({ metIds }) {
  const st = useAssistantLifeNow(metIds);
  const peer = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
  const [hidden, setHidden] = React.useState(false);
  if (!assistantLifeEnabled() || !st.loaded || hidden || st.open || (peer && peer.talking)) return null;
  const life = st.life;
  if (!life || (!life.groups.length && !Object.keys(life.solo).length)) return null;
  const nameOf = (id) => (assistantById(id) || {}).name || id;
  const g = life.groups[0];
  const lonely = Object.entries(life.solo).find(([, s]) => s.reason === 'lonely');
  const text = g ? `${g.ids.map(nameOf).join('・')}が${ASSISTANT_LIFE_PLACES[g.place]}で${ASSISTANT_LIFE_DOINGS[g.doing].label}` : '';
  const sub = lonely ? `${nameOf(lonely[0])}は${ASSISTANT_LIFE_PLACES[lonely[1].place]}でさみしそう` : (life.groups.length > 1 ? `ほかに${life.groups.length - 1}組` : '');
  const tier = assistantLifeTierOf(assistantLifePlayForDay(st.play, assistantLifeDayKey()).points);
  return (
    <div data-assistant-life-band className="fixed inset-x-0 flex justify-center px-2 pointer-events-none" style={{ zIndex: 8400, bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-pink-300/40 bg-slate-950/90 px-2 py-1.5 shadow-xl">
        <button type="button" data-assistant-life-open onClick={assistantLifeOpenScreen} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left active:scale-[.98]">
          {g ? <AssistantLifeFaces ids={g.ids} size={28}/> : (lonely ? <AssistantLifeFaces ids={[lonely[0]]} size={28}/> : null)}
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-black leading-tight text-white">{text || sub}</span>
            {text && sub ? <span className="block text-[10px] font-bold leading-tight text-slate-300">{sub}</span> : null}
            <span className="block text-[9px] font-bold leading-tight text-pink-200">にぎわい「{tier.label}」・みんなの様子 ▸</span>
          </span>
        </button>
        <button type="button" data-assistant-life-band-close onClick={() => setHidden(true)} aria-label="閉じる" className="h-8 w-8 shrink-0 rounded-full border border-slate-600 text-[13px] font-black text-slate-300 active:scale-95">×</button>
      </div>
    </div>);
}

// 閉じているあいだは何も読まない・書かない(演奏中・マルチ中に様子を決め直さない)
function AssistantLifeScreen(props) {
  const st = useAssistantLifeState();
  if (!assistantLifeEnabled() || !st.open) return null;
  return <AssistantLifeScreenBody {...props}/>;
}
function AssistantLifeScreenBody({ metIds, onReplay, peerItems = null, onUseItem = null }) {
  const st = useAssistantLifeNow(metIds);
  const [tab, setTab] = React.useState('now');
  const [pick, setPick] = React.useState([]);
  const [note, setNote] = React.useState('');
  if (!assistantLifeEnabled() || !st.loaded || !st.open) return null;
  const life = st.life || {};
  const day = assistantLifeDayKey();
  const play = assistantLifePlayForDay(st.play, day);
  const tier = assistantLifeTierOf(play.points);
  const next = ASSISTANT_LIFE_TIERS[assistantLifeTierIndex(tier) + 1] || null;
  const watchLeft = assistantLifeWatchLeft(st.play, day);
  const slot = assistantLifeSlotAt();
  const nameOf = (id) => (assistantById(id) || {}).name || id;
  const invitedNext = new Set(((life.nudges && life.nudges.invite) || []).filter(n => n.abs === slot.abs + 1).map(n => n.id));
  const introNext = ((life.nudges && life.nudges.introduce) || []).find(n => n.abs === slot.abs + 1);
  const ids = (metIds || []).filter(id => ASSISTANT_LIFE_PREFS[id]);
  const watch = async (g) => {
    const talk = await assistantLifeWatch(g);
    if (!talk) { setNote('この組の掛け合いは、いまは見られません'); return; }
    assistantLifeCloseScreen();
    if (onReplay) onReplay(talk);
  };
  const invite = async (id) => { if (await assistantLifeNudge('invite', id)) setNote(`${nameOf(id)}を誘いました。次の時間に、だれかのところへ行きます`); };
  const introduce = async () => { if (pick.length === 2 && await assistantLifeNudge('introduce', pick)) { setNote(`${nameOf(pick[0])}と${nameOf(pick[1])}が、次の時間に一緒に過ごしやすくなりました`); setPick([]); } };
  const mood = (id) => ASSISTANT_LIFE_MOODS[(life.moods || {})[id]] || '';
  return (
    <div data-assistant-life-screen className="fixed inset-0 flex justify-center bg-black/80" style={{ zIndex: 9000 }}>
      <div className="flex h-full w-full max-w-md flex-col bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <p className="min-w-0 flex-1 text-[15px] font-black text-pink-200">助手たちの今</p>
          <span className="whitespace-nowrap text-[10px] font-bold text-slate-400">いまは{assistantLifeSlotRange(slot.id)}</span>
          <button type="button" data-assistant-life-close onClick={assistantLifeCloseScreen} aria-label="閉じる" className="h-9 w-9 rounded-full border border-slate-600 text-[15px] font-black text-slate-300 active:scale-95">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto mh-scroll px-3 pb-6 pt-2">
          {/* にぎわい(その日に遊んだ量) */}
          <div data-assistant-life-tier={tier.id} className="rounded-2xl border border-pink-300/40 bg-pink-400/10 p-2.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[12px] font-black text-pink-100">今日のにぎわい「{tier.label}」</p>
              <p className="ml-auto whitespace-nowrap text-[10px] font-bold text-pink-200">{next ? `あと${next.min - play.points}で「${next.label}」` : 'いちばん上の段'}</p>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full bg-pink-400" style={{ width: `${next ? Math.min(100, Math.round(100 * (play.points - tier.min) / (next.min - tier.min))) : 100}%` }}/>
            </div>
            <p className="mt-1 text-[11px] font-bold text-white">{ASSISTANT_LIFE_TIER_NOTES[tier.id]}</p>
            <p className="text-[10px] text-slate-300">友情Lv の上がり方 ×{tier.mult}・1組の1日の上限 {tier.cap}・今日見守れるのは あと{watchLeft}回</p>
            <p className="text-[9px] text-slate-400">モンヒロビート・バトル・MFバトルカード・おしゃべりで遊ぶと、にぎわいがたまります(朝4時に新しくなります)</p>
          </div>
          <div className="mt-2 flex gap-1" role="tablist">
            {[['now', 'いまの様子'], ['map', '関係とアルバム']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} data-assistant-life-tab={k} onClick={() => setTab(k)}
                className={`min-h-[40px] flex-1 rounded-xl border text-[12px] font-black active:scale-[.98] ${tab === k ? 'border-pink-300 bg-pink-400/20 text-pink-100' : 'border-white/10 text-slate-400'}`}>{label}</button>))}
          </div>
          {note && <p data-assistant-life-note className="mt-2 rounded-xl bg-sky-400/10 px-2 py-1.5 text-[11px] font-bold text-sky-100">{note}</p>}
          {tab === 'now' && (<>
            <div className="mt-2 space-y-2">
              {(life.groups || []).map(g => { const key = assistantLifeGroupKey(g); const done = (life.watched || []).includes(key); return (
                <div key={key} data-assistant-life-group={key} className="rounded-2xl border border-white/10 bg-slate-900/80 p-2">
                  <div className="flex items-center gap-2">
                    <AssistantLifeFaces ids={g.ids} size={36}/>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black leading-tight text-white">{g.ids.map(nameOf).join('・')}</p>
                      <p className="text-[11px] font-bold leading-tight text-pink-200">{ASSISTANT_LIFE_PLACES[g.place]}で{ASSISTANT_LIFE_DOINGS[g.doing].label}</p>
                    </div>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">{g.ids.map(id => `${nameOf(id)}: ${mood(id)}`).join(' / ')}</p>
                  <button type="button" data-assistant-life-watch={key} disabled={done || watchLeft <= 0} onClick={() => watch(g)}
                    className="mt-1.5 min-h-[44px] w-full rounded-xl border border-pink-300/50 bg-pink-400/10 px-2 text-[12px] font-black text-pink-100 active:scale-[.98] disabled:opacity-40">
                    {done ? '見守りました' : watchLeft <= 0 ? '今日はもう見守れません' : '👀 見守る(友情Lv・仲良し度が上がる)'}
                  </button>
                </div>); })}
              {Object.entries(life.solo || {}).map(([id, s]) => (
                <div key={id} data-assistant-life-solo={id} data-assistant-life-reason={s.reason} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-2">
                  <AssistantLifeFaces ids={[id]} size={36}/>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black leading-tight text-white">{nameOf(id)}<span className={`ml-1 text-[10px] ${s.reason === 'lonely' ? 'text-amber-200' : 'text-slate-400'}`}>{ASSISTANT_LIFE_REASON_LABEL[s.reason]}</span></p>
                    <p className="text-[11px] font-bold leading-tight text-slate-300">{ASSISTANT_LIFE_PLACES[s.place]}で{ASSISTANT_LIFE_DOINGS[s.doing].label}・{mood(id)}</p>
                  </div>
                  {s.reason !== 'distance' && (
                    <button type="button" data-assistant-life-invite={id} disabled={invitedNext.has(id)} onClick={() => invite(id)}
                      className="min-h-[44px] shrink-0 rounded-xl border border-amber-300/50 bg-amber-400/10 px-2 text-[11px] font-black text-amber-100 active:scale-[.98] disabled:opacity-40">
                      {invitedNext.has(id) ? '誘った' : '誘う'}
                    </button>)}
                </div>))}
            </div>
            {ids.length >= 2 && (
              <div data-assistant-life-introduce className="mt-3 rounded-2xl border border-sky-300/30 bg-sky-400/5 p-2">
                <p className="text-[12px] font-black text-sky-100">引き合わせる</p>
                <p className="mb-1.5 text-[10px] text-slate-400">2人を選ぶと、次の時間に一緒に過ごしやすくなります。言い合いのあとなら、仲直りのきっかけに。</p>
                <div className="flex flex-wrap gap-1.5">
                  {ids.map(id => { const on = pick.includes(id); return (
                    <button key={id} type="button" data-assistant-life-pick={id} aria-pressed={on} onClick={() => setPick(p => on ? p.filter(x => x !== id) : [...p, id].slice(-2))}
                      className={`min-h-[40px] rounded-full border px-2.5 text-[11px] font-black active:scale-95 ${on ? 'border-sky-300 bg-sky-400/25 text-white' : 'border-white/15 text-slate-300'}`}>{nameOf(id)}</button>); })}
                </div>
                <button type="button" data-assistant-life-introduce-go disabled={pick.length !== 2 || !!introNext} onClick={introduce}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-sky-300/50 bg-sky-400/10 text-[12px] font-black text-sky-100 active:scale-[.98] disabled:opacity-40">
                  {introNext ? `次の時間は ${introNext.pair.split('-').map(nameOf).join('と')} を引き合わせます` : '次の時間に一緒に過ごしてもらう'}
                </button>
              </div>)}
            <p className="mt-3 text-[9px] leading-snug text-slate-500">みんな、時間(朝5・昼10・午後14・夕方18・夜21・深夜0時)が変わるたびに、自分で過ごし方を決めます。</p>
          </>)}
          {tab === 'map' && typeof AssistantPeerMap === 'function' && (
            <div className="mt-2"><AssistantPeerMap metIds={metIds} onReplay={(t) => { assistantLifeCloseScreen(); if (onReplay) onReplay(t); }} peerItems={peerItems} onUseItem={onUseItem}/></div>)}
        </div>
      </div>
    </div>);
}
