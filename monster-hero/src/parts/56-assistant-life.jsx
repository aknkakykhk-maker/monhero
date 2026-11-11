// ===== 助手たちの今(2026-11-07 社長「もっと個々に意思を持たせて、決まりがないほうがいい」) =====
// 設計: docs/progress/assistant-peer/LIFE-PLAN.md。様子を決める仕組み・にぎわい(段階1)と、画面「助手たちの今」・HOME の帯(段階2)・様子に合う台本(段階3)
// ★公開の印 RELEASE_FLAGS.assistantLife の後ろ。偽のあいだは にぎわいも数えず、仲良くなり方も今のまま
// ★保存は新しいキーだけ(CLAUDE.md ⑦)。どれも壊れていたら空として読む
//   mh_assistant_life_v1       { salt, abs, slot, moods, groups, solo, recent, nudges, watched(いまの時間に見守った組) }  いまの時間の様子と、最近のできごと・ブリーダーの声かけ
//   mh_assistant_life_play_v1  { day, points, counts(watch … その日に見守った数), lastDay, streak }  その日のにぎわい(遊んだ量)と、続けて遊んだ日数
//   mh_assistant_peer_seen14_v1 { [台本の id]: 見た日 }  見た台本は14日出さない(段階3。14日より前は読むときに捨てる)
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
  snack:    { label: 'おやつ',     te: 'おやつを食べて', group: true,  places: ['cafe', 'home'] }, // 広場ではしない(2026-11-07 社長「広場でおやつ、は分かりにくい」)
  practice: { label: '練習',       te: '練習して',       group: true,  places: ['studio'] },
  training: { label: '育成',       te: '育成して',       group: true,  places: ['ranch'] },
  cards:    { label: 'カード研究', te: 'カードを研究して', group: true,  places: ['cardroom', 'library'] },
  walk:     { label: '散歩',       te: '散歩して',       group: true,  places: ['plaza', 'garden', 'hill'] },
  idle:     { label: 'ぼーっと',   te: 'ぼーっとして',   group: false, places: ['home', 'hill', 'garden'] },
  sleep:    { label: 'おやすみ',     te: '寝て',           group: false, places: ['home'] },
  read:     { label: '読書',       te: '本を読んで',     group: false, places: ['library'] },
  battle:   { label: 'バトル',     te: 'バトルして',     group: true,  places: ['battle'] }, // モンヒロバトル(2026-11-11 社長「MB管理とモンバトは別」。助手のマスモンの修行はここで行う)
});
// 場所。台本の {place} に入る言葉(穴の言葉の一覧は docs/progress/assistant-peer/LIFE-WORDS.md)
const ASSISTANT_LIFE_PLACES = Object.freeze({
  home: '家', plaza: '広場', cafe: 'おやつ屋さん', studio: '練習スタジオ', ranch: '育成場',
  cardroom: 'カード部屋', library: '図書室', market: 'マーケット', hill: 'ひなたの丘', garden: '中庭', battle: 'モンヒロバトル',
});
// 1人ずつの好み(したいことの好みの表。コトバの気持ちの紙・3人組の案もこの表を元にする)
//   social … だれかといたい気持ちの強さ(0〜1)/ fav … 好きな場所(ひとりごとの場所の型「好きな場所」)
//   w … したいことの重み / slot … 時間ごとに重みへ掛ける数 / solo … ひとりが好きな時間 / caring … さみしそうな助手のそばへ行きやすい
//   clingy … ごろごろ・昼寝をしていても、だれかに来てほしい(来ないとさみしくなる)
const ASSISTANT_LIFE_PREFS = Object.freeze({
  mua:       { social: 0.85, fav: 'plaza',   w: { snack: 4, practice: 2, training: 2, cards: 1, walk: 3, idle: 1, sleep: 1, read: 0, battle: 3 },
               slot: { noon: { snack: 1.5 }, evening: { walk: 1.5 } }, note: 'にぎやかなのが好き。人が集まる広場。おやつと散歩、マーケットをのぞくのも好き' },
  kiki:      { social: 0.65, fav: 'library',     w: { snack: 3, practice: 1, training: 3, cards: 1, walk: 2, idle: 2, sleep: 1, read: 1, battle: 4.5 },
               slot: { morning: { walk: 1.5 }, afternoon: { snack: 1.5 } }, note: '静かな図書室が好き。朝の散歩とおやつ。ゴーレムの育成はしっかり' },
  momosuke:  { social: 0.8,  fav: 'studio',   w: { snack: 2, practice: 4, training: 2, cards: 1, walk: 2, idle: 1, sleep: 1, read: 0, battle: 4.5 },
               slot: { evening: { practice: 2 }, night: { practice: 1.3 } }, note: '夕方から夜は練習スタジオでレッスン。見てほしいのでだれかと' },
  dra:       { social: 0.6,  fav: 'home',     w: { snack: 3, practice: 1, training: 1, cards: 1, walk: 1, idle: 2, sleep: 4, read: 0, battle: 1.5 },
               slot: { noon: { sleep: 2 }, afternoon: { sleep: 2 } }, clingy: true, note: '昼寝が好き。だれか来てほしいのに家でごろごろしがち(さみしくなりやすい)' },
  atsu:      { social: 0.6,  fav: 'studio',    w: { snack: 1, practice: 3, training: 4, cards: 2, walk: 1, idle: 1, sleep: 1, read: 0, battle: 9 },
               slot: { morning: { training: 1.5 }, afternoon: { practice: 1.3 } }, note: 'ビートの練習(HELL)とドラゴンの育成。カードも強い' },
  kyuko:     { social: 0.5,  fav: 'library',  w: { snack: 2, practice: 1, training: 2, cards: 3, walk: 1, idle: 1, sleep: 1, read: 3, battle: 3 },
               slot: { afternoon: { read: 3, cards: 1.5 } }, solo: ['afternoon'], note: '午後は図書室でひとりの時間。カードの研究も好き' },
  sorashido: { social: 0.8,  fav: 'cardroom', w: { snack: 1, practice: 3, training: 1, cards: 4, walk: 1, idle: 1, sleep: 1, read: 1, battle: 6 },
               slot: { night: { cards: 2, battle: 0.5 }, evening: { cards: 1.3 } }, note: '夜はカード部屋で研究と計算。だれかを巻きこみたい' },
  erubin:    { social: 0.7,  fav: 'cardroom',   w: { snack: 2, practice: 1, training: 2, cards: 3, walk: 3, idle: 1, sleep: 1, read: 1, battle: 9 },
               slot: { morning: { walk: 1.3 }, evening: { cards: 1.3 } }, caring: true, note: 'カード部屋(デュラハン)と広場の散歩。さみしそうな助手のそばへ行く' },
});
// 1人ずつの生活のリズム(2026-11-07 社長「夜は家に帰る人が増えたり夜ふかしとか性格によって変えてもいい」)。
//   時間ごとに、したいことの重みへ掛ける数。夜ふかしの助手は深夜もモンヒロビートで練習したり部屋で起きていたりする。表は docs/progress/assistant-peer/LIFE-HOUSE-PLAN.md の 11
const ASSISTANT_LIFE_RHYTHM = Object.freeze({
  mua:       { label: '夜ふかし気味', bed: 1, wake: 9,  slot: { late: { sleep: 2 }, morning: { sleep: 4, idle: 2, walk: 0.4 }, night: { sleep: 0.4, snack: 1.5, walk: 1.5 } } },
  kiki:      { label: '早寝早起き',   bed: 22, wake: 5, slot: { night: { sleep: 6, idle: 2, walk: 0.2, snack: 0.3, practice: 0.2, training: 0.2, cards: 0.3 }, morning: { walk: 2, sleep: 0.2 } } },
  momosuke:  { label: '夜ふかし(夜の練習)', bed: 3, wake: 10, slot: { late: { practice: 10, sleep: 0.4 }, morning: { sleep: 5 } } },
  dra:       { label: 'よく寝る・昼寝', bed: 21, wake: 10, slot: { night: { sleep: 3 }, morning: { sleep: 5 } } },
  atsu:      { label: '朝型(朝の育成)', bed: 23, wake: 6, slot: { night: { sleep: 3, idle: 2, practice: 0.5 }, morning: { training: 2, sleep: 0.2 } } },
  kyuko:     { label: '夜ふかし(夜の読書)', bed: 2, wake: 9, slot: { late: { idle: 4, sleep: 0.5 }, night: { idle: 2 }, morning: { sleep: 4 } } },
  sorashido: { label: '夜ふかし(夜のカード研究)', bed: 3, wake: 10, slot: { late: { cards: 10, sleep: 0.4 }, morning: { sleep: 4 } } },
  erubin:    { label: '規則正しい',   bed: 23, wake: 6, slot: { night: { sleep: 3, idle: 2 } } },
});
// 生活のリズムの変わり方(2026-11-07 社長「夜誘いまくって遊んだ助手は生活リズムが変わってくとかもできる？」・幅は控えめ)
//   shift … -1(朝型)〜+1(夜型)。夜(19〜4時)に誘って遊ぶと +0.08、朝(5〜9時)なら -0.08(1日 ±0.2 まで)。
//   誘わなかった日は 0 へ 15% ずつ戻る。元の性格の幅は超えない(早寝の助手は夜型へ +0.5 まで・夜ふかしの助手は朝型へ -0.5 まで)
//   保存は新しいキー mh_assistant_life_rhythm_v1 = { [助手id]: { shift, day, dayGain } }
const ASSISTANT_LIFE_RHYTHM_KEY = 'mh_assistant_life_rhythm_v1';
const ASSISTANT_LIFE_RHYTHM_STEP = 0.08, ASSISTANT_LIFE_RHYTHM_DAY_MAX = 0.2, ASSISTANT_LIFE_RHYTHM_DECAY = 0.85;
const ASSISTANT_LIFE_RHYTHM_RANGE = Object.freeze({ mua: [-0.5, 1], kiki: [-1, 0.5], momosuke: [-0.5, 1], dra: [-1, 0.5], atsu: [-1, 0.5], kyuko: [-0.5, 1], sorashido: [-0.5, 1], erubin: [-1, 0.5] });
const normalizeAssistantLifeRhythm = (v) => {
  const o = {};
  if (v && typeof v === 'object') for (const [id, x] of Object.entries(v)) {
    if (!ASSISTANT_LIFE_RHYTHM_RANGE[id] || !x || typeof x !== 'object') continue;
    const sh = Number(x.shift);
    o[id] = { shift: Number.isFinite(sh) ? Math.max(-1, Math.min(1, sh)) : 0, day: typeof x.day === 'string' ? x.day : null, dayGain: Number.isFinite(Number(x.dayGain)) ? Number(x.dayGain) : 0 };
  }
  return o;
};
const assistantLifeRhythmDayDiff = (a, b) => (a && b ? Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000) : 0);
// その日の値(誘わなかった日のぶん、元へ戻す)
const assistantLifeRhythmShiftOn = (rec, day) => {
  if (!rec) return 0;
  const gap = Math.max(0, assistantLifeRhythmDayDiff(rec.day, day) - 0);
  return rec.shift * Math.pow(ASSISTANT_LIFE_RHYTHM_DECAY, gap);
};
// 誘って遊んだ。hour … 日本時間の時。夜(19〜4時)なら夜型へ、朝(5〜9時)なら朝型へ
const assistantLifeRhythmPlayState = (state, id, hour, day) => {
  const rng = ASSISTANT_LIFE_RHYTHM_RANGE[id];
  if (!rng) return state;
  const dir = (hour >= 19 || hour < 5) ? 1 : (hour >= 5 && hour < 10) ? -1 : 0;
  if (!dir) return state;
  const rec = state[id] || { shift: 0, day, dayGain: 0 };
  const base = assistantLifeRhythmShiftOn(rec, day);
  const dayGain = rec.day === day ? rec.dayGain : 0;
  const step = Math.max(0, Math.min(ASSISTANT_LIFE_RHYTHM_STEP, ASSISTANT_LIFE_RHYTHM_DAY_MAX - Math.abs(dayGain)));
  if (step <= 0) return state;
  const shift = Math.max(rng[0], Math.min(rng[1], base + dir * step));
  return { ...state, [id]: { shift: Math.round(shift * 1000) / 1000, day, dayGain: dayGain + dir * step } };
};
// いまの生活のリズムの印(部屋を押したとき)
const assistantLifeRhythmLabel = (shift) => (shift >= 0.3 ? '🌙 夜型ぎみ' : shift <= -0.3 ? '☀ 朝型ぎみ' : 'いつもどおり');
// 重みへ掛ける数(夜型: 夜・深夜に寝にくく・朝に寝やすい / 朝型: その逆)。変わる幅は控えめ
const assistantLifeRhythmMod = (shift, slotId, d) => {
  if (!shift) return 1;
  const s = Math.abs(shift);
  if (shift > 0) {
    if ((slotId === 'night' || slotId === 'late') && d === 'sleep') return 1 - 0.5 * s;
    if ((slotId === 'night' || slotId === 'late') && (d === 'idle' || d === 'practice' || d === 'cards' || d === 'snack')) return 1 + 0.6 * s;
    if (slotId === 'morning' && d === 'sleep') return 1 + s;
  } else {
    if (slotId === 'night' && d === 'sleep') return 1 + 0.8 * s;
    if (slotId === 'morning' && d === 'sleep') return 1 - 0.5 * s;
    if (slotId === 'morning' && (d === 'walk' || d === 'training')) return 1 + 0.5 * s;
  }
  return 1;
};
// 時間ごとにみんなの重みへ掛ける数(夜は家に帰る助手が増える)
const ASSISTANT_LIFE_SLOT_MOD = Object.freeze({
  late:      { sleep: 8, idle: 1.5, snack: 0.3, practice: 0.2, training: 0.2, walk: 0.2 },
  morning:   { walk: 2, sleep: 1.2, snack: 0.8 },
  noon:      { snack: 2 },
  afternoon: { practice: 1.5, training: 1.5 },
  evening:   { snack: 1.3, cards: 1.3 },
  night:     { cards: 1.5, idle: 1.5, sleep: 2, walk: 0.5, practice: 0.6, training: 0.5, snack: 0.7 },
});
// 気分ごとにしたいことへ掛ける数・だれかといたい気持ちへ掛ける数
const ASSISTANT_LIFE_MOOD_MOD = Object.freeze({
  happy:    { social: 1.1, w: {} },
  lonely:   { social: 1.5, w: { snack: 1.5, walk: 1.5, idle: 1.3 } },
  restless: { social: 1.0, w: { walk: 2, practice: 1.3 } },
  sulky:    { social: 0.4, w: { idle: 2 } },
  sleepy:   { social: 0.5, w: { sleep: 3, idle: 2 } },
  eager:    { social: 1.0, w: { practice: 2, training: 2, cards: 1.3, battle: 1.5 } },
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
  peer:   { amount: 2, dailyMax: 30,   label: '助手どうしを見守る・誘う・道具を贈る' },
});
// 続けて遊んだ日数の上乗せ(その日の始まりのにぎわい)
const ASSISTANT_LIFE_STREAK_BONUS = Object.freeze([{ days: 7, points: 10 }, { days: 3, points: 5 }]);
// 最近のできごとを覚えておく時間の数(12区切りで1日。前は6つで1日・12=2日ぶんだった)
const ASSISTANT_LIFE_RECENT_SLOTS = 24;

// 移動が1日6回→12回になったぶん、時間帯ごとに戻る得の1回ぶんを約75%にする(台帳 #5304・#5328。1日に取れる量はいまの約1.5倍)
//   四捨五入し、1より小さくはしない(1・2 の小さい点はそのまま残る)。数でないときは null(呼ぶ側は今までどおりの量)
const ASSISTANT_LIFE_SLOT_GAIN_RATE = 0.75;
const assistantLifeSlotGainOf = (amount) => (Number.isFinite(amount) && amount > 0 ? Math.max(1, Math.round(amount * ASSISTANT_LIFE_SLOT_GAIN_RATE)) : null);

const assistantLifeEnabled = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLife === true;
const assistantLifePairKey = (a, b) => [String(a), String(b)].sort().join('-');
const assistantLifeDayKey = (now = Date.now()) => (typeof jstDayKey4 === 'function') ? jstDayKey4(now) : new Date(Number(now) + 5 * 3600000).toISOString().slice(0, 10);

// ---------- 時間 ----------
// abs … 通しの番号(日本時間の暦の日 × 6 + 時間の並び)。1つ進むと次の時間
// 12区切り(2026-11-11 社長: 移動を1日6回→12回。2時間ずつ均等)。傾向を引く名前(id・label・i)は、区切りの真ん中の時刻が入る6つ(上の ASSISTANT_LIFE_SLOTS)のまま。
//   abs … 通しの番号(日本時間の暦の日 × 12 + j)。j は 0〜11(0 は 0〜2時)。1つ進むと2時間あと
//   absV1 … 前の数え方(日 × 6 + 6つの並び)。前の版の保存(abs)を読み替えるときと、6を前提にした他の部との橋渡し用
//   from・to … この区切りの時刻(2時間)。i・id・label … 傾向の名前(深夜・朝・昼・午後・夕方・夜)
const ASSISTANT_LIFE_PER_DAY = 12;
const assistantLifeSixIndexOfHour = (h) => Math.max(0, ASSISTANT_LIFE_SLOTS.findIndex(s => h >= s.from && h < s.to));
const assistantLifeSlotBuild = (day, j, hourForV1) => {
  const i = assistantLifeSixIndexOfHour(j * 2 + 1); // 区切りの真ん中(1時・3時・5時…)がどの6つに入るか
  const six = ASSISTANT_LIFE_SLOTS[i];
  return { abs: day * ASSISTANT_LIFE_PER_DAY + j, j, i, id: six.id, label: six.label, from: j * 2, to: j * 2 + 2, absV1: day * 6 + assistantLifeSixIndexOfHour(hourForV1) };
};
const assistantLifeSlotAt = (now = Date.now()) => {
  const t = Number(now) + 9 * 3600000;
  const day = Math.floor(t / 86400000);
  const h = new Date(t).getUTCHours();
  return assistantLifeSlotBuild(day, Math.floor(h / 2), h);
};
const assistantLifeSlotOfAbs = (abs) => {
  const a = Math.floor(Number(abs) || 0);
  const j = ((a % ASSISTANT_LIFE_PER_DAY) + ASSISTANT_LIFE_PER_DAY) % ASSISTANT_LIFE_PER_DAY;
  return assistantLifeSlotBuild(Math.floor((a - j) / ASSISTANT_LIFE_PER_DAY), j, j * 2);
};
// 前の数え方の abs(日 × 6 + i)→ 12区切りの abs。その区切りの始まりの時刻が入る 2時間の区切りへ(例: 朝 5〜10時 → 4〜6時の区切り)。二重に変換しないよう、保存側が印(v:2)を持つ
const assistantLifeAbsV1ToV2 = (abs) => {
  const a = Math.floor(Number(abs));
  if (!Number.isFinite(a)) return null;
  const i = ((a % 6) + 6) % 6;
  return Math.floor((a - i) / 6) * ASSISTANT_LIFE_PER_DAY + Math.floor(ASSISTANT_LIFE_SLOTS[i].from / 2);
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
const assistantLifeDecide = ({ abs, members, bond = {}, prev = null, recent = [], nudges = {}, tier = ASSISTANT_LIFE_TIERS[0], salt = '', rhythmShift = {} }) => {
  const slot = assistantLifeSlotOfAbs(abs);
  const ids = [...new Set((members || []).filter(id => ASSISTANT_LIFE_PREFS[id]))].sort();
  const rand = assistantLifeRng(`${salt}|${slot.abs}|${ids.join(',')}`);
  const gap = prev && Number.isFinite(prev.abs) ? slot.abs - prev.abs : Infinity;
  const inertia = gap === 1 ? 3 : (gap >= 2 && gap <= 12 ? 1.5 : 0); // 12区切り: 前の幅(2〜6回)を2倍に
  const tierI = assistantLifeTierIndex(tier);
  const near = (r, n) => Number.isFinite(r.abs) && slot.abs - r.abs >= 0 && slot.abs - r.abs <= n;
  const recentOf = (kind, pred, n = ASSISTANT_LIFE_RECENT_SLOTS) => (recent || []).some(r => r && r.kind === kind && near(r, n) && pred(r));
  const hasPair = (r, a, b) => r.pair === assistantLifePairKey(a, b);
  // 言い合いのあと3つの時間は距離をおく(そのあと仲直りしていれば終わり)
  const quarrelNow = (a, b) => {
    const qs = (recent || []).filter(r => r && r.kind === 'quarrel' && hasPair(r, a, b) && near(r, 6)); // 言い合いのあと6つの区切り(前は3つの時間)
    if (!qs.length) return false;
    const last = Math.max(...qs.map(r => r.abs));
    return !(recent || []).some(r => r && r.kind === 'makeup' && hasPair(r, a, b) && r.abs >= last);
  };
  const invited = new Set((nudges.invite || []).filter(n => n && n.abs === slot.abs).map(n => n.id));
  const introduced = (nudges.introduce || []).filter(n => n && n.abs === slot.abs).map(n => n.pair);
  const prevPairs = new Set(gap === 1 && prev && Array.isArray(prev.groups) ? prev.groups.flatMap(g => { const o = []; for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) o.push(assistantLifePairKey(g.ids[i], g.ids[j])); return o; }) : []);
  const wasLonely = new Set(prev && Array.isArray(prev.lonely) && gap >= 1 && gap <= 4 ? prev.lonely : []); // 12区切り: 前は1〜2回

  // 1. 気分
  const moods = {};
  for (const id of ids) {
    const w = { happy: 3, lonely: 1, restless: 1, sulky: 0.2, sleepy: 1, eager: 2 };
    if (slot.id === 'late' || slot.id === 'night') w.sleepy *= 4;
    if (slot.id === 'morning') w.sleepy *= 2;
    const pm = prev && prev.moods && prev.moods[id];
    if (pm && w[pm] != null && inertia > 0) w[pm] *= inertia;
    if (wasLonely.has(id)) w.lonely *= 4;
    if (ids.some(o => o !== id && quarrelNow(id, o) && !introduced.includes(assistantLifePairKey(id, o)))) w.sulky *= 12;
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
      const rh = ASSISTANT_LIFE_RHYTHM[id];
      x *= (((rh && rh.slot[slot.id]) || {})[d] || 1); // 生活のリズム(夜ふかし・早寝 など)
      x *= assistantLifeRhythmMod(Number(rhythmShift[id]) || 0, slot.id, d); // 誘って遊んだぶん、少しずつ変わる
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
    // 言い合いのあとは距離をおく。引き合わせた2人は、仲直りのきっかけとして会う
    if (quarrelNow(a, b) && !introduced.includes(assistantLifePairKey(a, b))) return -10;
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
    const quarrel = ids.some(o => o !== id && quarrelNow(id, o) && !introduced.includes(assistantLifePairKey(id, o)));
    // 寝ている助手は「さみしそう」にしない・気分は「ねむい」(2026-11-07 ミハリ L2・L12)。
    // だれかに来てほしい助手は、寝ずに家でごろごろしている(ドラの「昼寝していても来てほしい」はこの形)
    const d = doing[id] === 'sleep' && wants[id] && !quarrel ? 'idle' : doing[id];
    const reason = quarrel ? 'distance' : (wants[id] && d !== 'sleep' ? 'lonely' : 'mypace');
    if (reason === 'lonely') { moods[id] = 'lonely'; lonely.push(id); }
    if (d === 'sleep') moods[id] = 'sleepy';
    const places = ASSISTANT_LIFE_DOINGS[d].places;
    // ひとりのときは好きな場所にいやすい。ただし、そのしていることができる場所だけ(カード部屋で散歩、にしない。ミハリ L9)
    const favOk = places.includes(p.fav);
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
  // 前の版で保存した様子の整え(寝ているのに「さみしそう」・できない場所でしていること。2026-11-07 ミハリ L2・L9・L12)
  for (const [id, s] of Object.entries(solo)) {
    if (s.doing === 'sleep') { if (s.reason === 'lonely') s.reason = 'mypace'; moods[id] = 'sleepy'; }
    if (!ASSISTANT_LIFE_DOINGS[s.doing].places.includes(s.place)) s.place = ASSISTANT_LIFE_DOINGS[s.doing].places[0];
  }
  // 前の数え方(印 v が 2 でない)の保存は、abs を12区切りへ読み替える(一度だけ。返す値には v:2 を付ける)。前の声かけ(次の1回ぶんだけ)は捨てる
  const old = o.v !== 2;
  const absOf = (x) => (old ? assistantLifeAbsV1ToV2(x) : Math.floor(x));
  const recent = Array.isArray(o.recent) ? o.recent.filter(r => r && typeof r.kind === 'string' && Number.isFinite(r.abs)).map(r => ({ ...r, abs: absOf(r.abs) })).slice(-80) : [];
  const nudgeList = (x) => (old ? [] : Array.isArray(x) ? x.filter(n => n && Number.isFinite(n.abs)).slice(-20) : []);
  const nudges = { invite: nudgeList(o.nudges && o.nudges.invite).filter(n => ok(n.id)), introduce: nudgeList(o.nudges && o.nudges.introduce).filter(n => typeof n.pair === 'string') };
  return { v: 2, salt: typeof o.salt === 'string' && o.salt ? o.salt : '', abs: Number.isFinite(o.abs) ? absOf(o.abs) : null, slot: typeof o.slot === 'string' ? o.slot : null,
    moods, groups, solo, lonely: Array.isArray(o.lonely) ? o.lonely.filter(id => ok(id) && !(solo[id] && solo[id].doing === 'sleep')) : [], recent, nudges,
    watched: Array.isArray(o.watched) ? o.watched.filter(k => typeof k === 'string').slice(-30) : [] };
};

// ---------- 入れ物 ----------
const ASSISTANT_LIFE_STORE = {
  state: { loaded: false, open: false, life: normalizeAssistantLife(null), play: normalizeAssistantLifePlay(null), seen: {}, rhythm: {} },
  loading: null,
  listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(patch) { this.state = { ...this.state, ...patch }; this.emit(); },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const [life, play, seen, rhythm] = await Promise.all([storeGet(ASSISTANT_LIFE_STORE_KEY, null, false), storeGet(ASSISTANT_LIFE_PLAY_KEY, null, false), storeGet('mh_assistant_peer_seen14_v1', null, false), storeGet(ASSISTANT_LIFE_RHYTHM_KEY, null, false)].map(p => Promise.resolve(p).catch(() => null)));
      const l = normalizeAssistantLife(life);
      if (!l.salt) l.salt = Math.random().toString(36).slice(2, 10);
      this.set({ loaded: true, life: l, play: normalizeAssistantLifePlay(play), seen: normalizeAssistantLifeSeen(seen), rhythm: normalizeAssistantLifeRhythm(rhythm) });
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
  const rhythmShift = {}; for (const id of ids) rhythmShift[id] = assistantLifeRhythmShiftOn((ASSISTANT_LIFE_STORE.state.rhythm || {})[id], day);
  const decided0 = assistantLifeDecide({ abs: slot.abs, members: ids, bond, prev, recent: cur.recent, nudges: cur.nudges, tier, salt: cur.salt, rhythmShift });
  // 行き先の予定(📅 今日の予定表・56-assistant-life-plan.jsx。印 assistantLifePlan が偽・予定なしなら そのまま)
  if (typeof ASSISTANT_LIFE_PLAN_STORE !== 'undefined' && typeof assistantLifePlanOn === 'function' && assistantLifePlanOn()) { try { await ASSISTANT_LIFE_PLAN_STORE.load(); } catch {} }
  const decided = typeof assistantLifePlanOnDecide === 'function' ? assistantLifePlanOnDecide(decided0, cur.salt) : decided0;
  const keep = (n) => n.abs >= slot.abs;
  const life = { ...cur, ...decided, watched: [], recent: cur.recent.filter(r => slot.abs - r.abs <= ASSISTANT_LIFE_RECENT_SLOTS),
    nudges: { invite: cur.nudges.invite.filter(keep), introduce: cur.nudges.introduce.filter(keep) } };
  ASSISTANT_LIFE_STORE.set({ life });
  assistantLifeSaveLife();
  // 今日あったこと(家の掲示板)へ、この時間の過ごし方を書く(56-assistant-life-house.jsx)
  if (typeof assistantLifeDiaryOnSlot === 'function') { try { assistantLifeDiaryOnSlot(life, slot, now); } catch {} }
  // その時間モンヒロバトルにいた助手のマスモンが修行する(シュギョウ。印 assistantMasmonTrain が偽なら何もしない・2026-11-11)
  if (typeof amgtOnLifeSlot === 'function') { try { amgtOnLifeSlot(life, slot, now); } catch {} }
  // フレンドの家との行き来(控えを送る・ときどき助手が自分で遊びに行く。56-assistant-life-friend.jsx。印が偽なら何もしない)
  if (typeof assistantLifeFriendOnSlot === 'function') { try { void assistantLifeFriendOnSlot(life, slot, now); } catch {} }
  if (typeof assistantLifeRelTick === 'function') { try { void assistantLifeRelTick(now); } catch {} } // 前の日からのけんかは朝4時までに仲直り(rel.jsx)
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
  ASSISTANT_LIFE_STORE.set({ life: { ...life, recent: [...life.recent, rec].slice(-80) } }); // 12区切りで覚える幅が2倍になったので、読む側(80)とそろえる
  assistantLifeSaveLife();
};
// 誘って遊んだ(家からの誘い・セッション・会いに行く)。生活のリズムが少しずつ変わる
const assistantLifeRhythmPlay = (id, now = Date.now()) => {
  if (!assistantLifeEnabled() || !ASSISTANT_LIFE_STORE.state.loaded) return;
  const hour = new Date(Number(now) + 9 * 3600000).getUTCHours();
  const next = assistantLifeRhythmPlayState(ASSISTANT_LIFE_STORE.state.rhythm || {}, id, hour, assistantLifeDayKey(now));
  if (next === ASSISTANT_LIFE_STORE.state.rhythm) return;
  ASSISTANT_LIFE_STORE.set({ rhythm: next });
  try { storeSet(ASSISTANT_LIFE_RHYTHM_KEY, next, false); } catch {}
};
// ブリーダーの声かけ。次の時間に効く(誘う … その助手がどこかの組に入る/引き合わせる … 2人が一緒に過ごしやすい)
const assistantLifeNudge = async (kind, value, now = Date.now()) => {
  if (!assistantLifeEnabled()) return false;
  await ASSISTANT_LIFE_STORE.load();
  const life = ASSISTANT_LIFE_STORE.state.life;
  const abs = assistantLifeSlotAt(now).abs + 1;
  const nudges = { ...life.nudges };
  if (kind === 'invite' && ASSISTANT_LIFE_PREFS[value]) nudges.invite = [...nudges.invite.filter(n => !(n.id === value && n.abs === abs)), { id: value, abs }];
  if (kind === 'invite' && ASSISTANT_LIFE_PREFS[value]) assistantLifeRhythmPlay(value, now);
  else if (kind === 'introduce' && Array.isArray(value) && value.length === 2) { const pair = assistantLifePairKey(value[0], value[1]); nudges.introduce = [...nudges.introduce.filter(n => !(n.pair === pair && n.abs === abs)), { pair, abs }]; }
  else return false;
  ASSISTANT_LIFE_STORE.set({ life: { ...life, nudges } });
  assistantLifeSaveLife();
  void assistantLifeAddPlay('peer');
  return true;
};
// 遊んだとき(ビート・バトル・カード・おしゃべり・助手どうし)。段が上がったら tierUp を返す
const assistantLifeAddPlay = async (kind, now = Date.now()) => {
  // ミッションの「助手とふれあう」(2026-11-08)。おしゃべり・助手どうしを見守る・誘う・道具を贈る(ビート・バトル・カードは数えない)
  if ((kind === 'chat' || kind === 'peer') && typeof missionNotify === 'function') missionNotify('assistantTouch');
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

// ---------- 様子に合う台本を引く(段階3) ----------
// 台本は ASSISTANT_LIFE_TALKS(コトバ・ツムギ)と、今の台本(書き直しの表の doing・lv の鍵つき)。鍵は当てはまるものだけ書いてあり、ゆるく当てる:
//   まず全部の鍵が合うものから。無ければ ゆるめてよい鍵(していること → 友情Lv の段 など)を順に外す。場所の型(家/好きな場所/それ以外)と空気(言い合いのあと)は外さない
//   見た台本は14日出さない(mh_assistant_peer_seen14_v1)。全部見ていたら、いちばん前に見たものから
const ASSISTANT_LIFE_SEEN_KEY = 'mh_assistant_peer_seen14_v1';
const ASSISTANT_LIFE_SEEN_DAYS = 14;
const ASSISTANT_LIFE_SEEN_MAX = 4000;
const assistantLifeLvBand = (lv) => (lv >= 7 ? '7-10' : lv >= 4 ? '4-6' : '1-3');
const ASSISTANT_LIFE_BAND_RANK = Object.freeze({ '1-3': 0, '4-6': 1, '7-10': 2 });
const assistantLifePlaceType = (who, place) => (place === 'home' ? 'home' : (ASSISTANT_LIFE_PREFS[who] && ASSISTANT_LIFE_PREFS[who].fav === place ? 'fav' : 'other'));
// 見た日の記録。14日より前は捨てる(日付は朝4時区切りの日)
const normalizeAssistantLifeSeen = (v, today = assistantLifeDayKey()) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  const limit = Date.parse(`${today}T00:00:00Z`) - ASSISTANT_LIFE_SEEN_DAYS * 86400000;
  const rows = Object.entries(v).filter(([id, d]) => typeof id === 'string' && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && Date.parse(`${d}T00:00:00Z`) > limit);
  rows.sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  for (const [id, d] of rows.slice(-ASSISTANT_LIFE_SEEN_MAX)) out[id] = d;
  return out;
};
// 流した台本を「見た」にする(ひとりごとはつないだ2本とも)
const assistantLifeMarkSeen = (talk, now = Date.now()) => {
  if (!assistantLifeEnabled() || !talk || !talk.id || talk.gen) return;
  const day = assistantLifeDayKey(now);
  const seen = { ...(ASSISTANT_LIFE_STORE.state.seen || {}) };
  for (const id of (Array.isArray(talk.parts) && talk.parts.length ? talk.parts : [talk.id])) seen[id] = day;
  const next = normalizeAssistantLifeSeen(seen, day);
  ASSISTANT_LIFE_STORE.set({ seen: next });
  try { storeSet(ASSISTANT_LIFE_SEEN_KEY, next, false); } catch {}
};
// ASSISTANT_LIFE_TALKS を掛け合いの形にそろえる(一度作ったら使い回す)
//   2人 … pair(kind なし=ふだんの掛け合い)/決まった3人 … kind 'trio'/どの3人でも … pair の2人が話す(anyTrio)/
//   ひとりごと … kind 'life-solo'/声かけ … kind 'life-invite'(pair は [誘う人, 誘われる人])/ブリーダーへ … kind 'life-breeder'/
//   言い合い … kind 'quarrel' と 'makeup'(今の仲直りの流れにそのまま乗る)・distance(距離をおく)
let assistantLifeTalkCache = null;
// 台本が「どこで言う台詞か」(2026-11-07 ミハリ L 残り④: 練習スタジオのソラシドが「広場、だれもいないな笑」)。
//   鍵の place があればそれ。無ければ台詞に出てくる場所の名前(家は「家に帰ろ」のように出先でも言うので見ない)。どこでも言えるなら null
const ASSISTANT_LIFE_TALK_PLACE_WORDS = Object.freeze([['練習スタジオ', 'studio'], ['おやつ屋', 'cafe'], ['カード部屋', 'cardroom'], ['育成場', 'ranch'], ['図書室', 'library'], ['マーケット', 'market'], ['ひなたの丘', 'hill'], ['中庭', 'garden'], ['広場', 'plaza']]);
const assistantLifeTalkAt = (t, keys = (t && t.keys) || {}) => {
  if (keys.place && ASSISTANT_LIFE_PLACES[keys.place]) return keys.place;
  const txt = ((t && t.lines) || []).map(l => (l && l.t) || '').join('\n');
  for (const [w, place] of ASSISTANT_LIFE_TALK_PLACE_WORDS) if (txt.includes(w)) return place;
  return null;
};
// 台本を言える時間帯(2026-11-08 ミハリ: 夕方に「朝の散歩で、きれいな花を見つけました」)。台詞の言葉から決める。どの時間帯でも言えるなら null
//   時間帯は家の見出しと同じ朝・昼・夕・夜(assistantLifeTimeLook。56-assistant-life-house.jsx)
const ASSISTANT_LIFE_TALK_TOD_RULES = Object.freeze([
  [/朝の/, ['morning']],
  [/寝る前/, ['night']],
  [/夕方にな/, ['morning', 'noon']],
  [/昼寝/, ['morning', 'noon', 'evening']],
]);
const assistantLifeTalkTods = (t) => {
  const txt = ((t && t.lines) || []).map(l => (l && l.t) || '').join('\n');
  let ok = null;
  for (const [re, tods] of ASSISTANT_LIFE_TALK_TOD_RULES) if (re.test(txt)) ok = ok ? ok.filter(x => tods.includes(x)) : [...tods];
  return ok;
};
const assistantLifeLookNow = () => { try { return typeof assistantLifeTimeLook === 'function' ? assistantLifeTimeLook() : null; } catch (_) { return null; } };
// 画面の一覧に出す場所の名前。遊び場は施設の名前(家の部品 56-assistant-life-house.jsx の assistantLifePlaceShow。地図・札とそろえる)
const assistantLifePlaceLabel = (p) => (typeof assistantLifePlaceShow === 'function' ? assistantLifePlaceShow(p) : ASSISTANT_LIFE_PLACES[p]);
const assistantLifeTalkSet = () => {
  if (assistantLifeTalkCache) return assistantLifeTalkCache;
  const raw = (typeof ASSISTANT_LIFE_TALKS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_TALKS)) ? ASSISTANT_LIFE_TALKS : [];
  const out = { solo: [], breeder: [], invite: [], pair: [], trio: [], anyTrio: [], quarrel: [] };
  const okLines = (a) => Array.isArray(a) && a.length > 0 && a.every(l => l && typeof l.who === 'string' && typeof l.t === 'string');
  for (const t of raw) {
    if (!t || typeof t.id !== 'string' || !okLines(t.lines)) continue;
    const keys = t.keys && typeof t.keys === 'object' ? t.keys : {};
    const base = { id: t.id, keys, lines: t.lines, lv: 1, scene: 'any', life: true, at: assistantLifeTalkAt(t, keys), tods: assistantLifeTalkTods(t) };
    if (t.kind === 'solo') out.solo.push({ ...base, kind: 'life-solo', who: t.who, pair: [t.who], line: t.line === 'feel' ? 'feel' : 'scene' });
    else if (t.kind === 'breeder') out.breeder.push({ ...base, kind: 'life-breeder', who: t.who, pair: [t.who] });
    else if (t.kind === 'invite' && t.from) out.invite.push({ ...base, kind: 'life-invite', who: t.who, from: t.from, pair: [t.from, t.who] });
    else if (t.kind === 'pair' && Array.isArray(t.pair)) out.pair.push({ ...base, pair: [...t.pair].sort() });
    else if (t.kind === 'trio' && t.any && Array.isArray(t.pair)) out.anyTrio.push({ ...base, pair: [...t.pair].sort(), anyTrio: true });
    else if (t.kind === 'trio' && Array.isArray(t.trio)) out.trio.push({ ...base, kind: 'trio', trio: [...t.trio].sort() });
    else if (t.kind === 'quarrel' && Array.isArray(t.pair)) {
      const pair = [...t.pair].sort();
      out.quarrel.push({ ...base, pair, kind: 'quarrel', lv: 2, scene: 'home', makeupId: `${t.id}m`, distance: okLines(t.distance) ? t.distance : [] });
      if (okLines(t.makeup)) out.quarrel.push({ ...base, id: `${t.id}m`, pair, kind: 'makeup', lv: 2, scene: 'home', quarrelId: t.id, lines: t.makeup });
    }
  }
  assistantLifeTalkCache = out;
  return out;
};
const assistantLifeQuarrelTalks = () => [...assistantLifeTalkSet().quarrel, ...(typeof assistantLifeRelQuarrelTalks === 'function' ? assistantLifeRelQuarrelTalks() : [])]; // 原因つきのけんか(rel.jsx)も
// 思い出アルバムに入るもの(2人・3人)
const assistantLifeAlbumTalks = () => { const x = assistantLifeTalkSet(); return [...x.pair, ...x.anyTrio, ...x.trio, ...(typeof assistantLifeDailyAlbumTalks === 'function' ? assistantLifeDailyAlbumTalks() : []), ...(typeof assistantLifeFurnAlbumTalks === 'function' ? assistantLifeFurnAlbumTalks() : []), ...(typeof assistantLifeRelAlbumTalks === 'function' ? assistantLifeRelAlbumTalks() : [])]; };
// 台本の穴 {place}・{doing}・{doing_te}。いまの様子(talk.ctx)→ 台本の鍵 → していることの場所 の順で決める
const assistantLifeFillHoles = (text, talk) => {
  const c = (talk && talk.ctx) || {};
  const k = (talk && talk.keys) || {};
  const doing = ASSISTANT_LIFE_DOINGS[c.doing] ? c.doing : (ASSISTANT_LIFE_DOINGS[k.doing] ? k.doing : (ASSISTANT_LIFE_DOINGS[talk && talk.lifeDoing] ? talk.lifeDoing : 'walk'));
  const place = ASSISTANT_LIFE_PLACES[c.place] ? c.place : (ASSISTANT_LIFE_PLACES[k.place] ? k.place : ASSISTANT_LIFE_DOINGS[doing].places[0]);
  return String(text).replace(/\{place\}/g, ASSISTANT_LIFE_PLACES[place]).replace(/\{doing_te\}/g, ASSISTANT_LIFE_DOINGS[doing].te).replace(/\{doing\}/g, ASSISTANT_LIFE_DOINGS[doing].label);
};
// 候補から1本選ぶ。cands … [{ talk, keys }]・want … いまの様子の鍵・relax … ゆるめてよい鍵(先に外すものから)
//   当てはまる鍵が多いほど出やすい(空気が合うものは4倍、ほかは2倍ずつ)
const assistantLifeChoose = (cands, want, relax, seen, rand = Math.random) => {
  const fit = (keys, skip) => Object.entries(want).every(([k, v]) => skip.has(k) || v == null || keys[k] == null || keys[k] === v);
  const weight = (keys) => Object.entries(want).reduce((w, [k, v]) => (v != null && keys[k] === v ? w * (k === 'air' ? 4 : 2) : w), 1);
  let firstPool = null;
  for (let n = 0; n <= relax.length; n++) {
    const skip = new Set(relax.slice(0, n));
    const pool = cands.filter(c => fit(c.keys || {}, skip));
    if (!pool.length) continue;
    if (!firstPool) firstPool = pool;
    const fresh = pool.filter(c => !(seen && seen[c.talk.id]));
    if (!fresh.length) continue;
    const sum = fresh.reduce((x, c) => x + weight(c.keys || {}), 0);
    let r = rand() * sum;
    for (const c of fresh) { r -= weight(c.keys || {}); if (r <= 0) return c.talk; }
    return fresh[fresh.length - 1].talk;
  }
  if (!firstPool) return null;
  return [...firstPool].sort((x, y) => String((seen || {})[x.talk.id] || '').localeCompare(String((seen || {})[y.talk.id] || '')))[0].talk;
};
const assistantLifeWithCtx = (talk, ctx) => (talk ? { ...talk, ctx: { ...(talk.ctx || {}), ...ctx } } : null);
// その2人の空気: 言い合いのあと(まだ仲直りしていない)… after/仲直りしたて … makeup/ふだん … normal
const assistantLifeAirOf = (life, a, b) => {
  const key = assistantLifePairKey(a, b);
  const now = (life && Number.isFinite(life.abs)) ? life.abs : 0;
  const rs = ((life && life.recent) || []).filter(r => r && r.pair === key && Number.isFinite(r.abs) && now - r.abs >= 0 && now - r.abs <= ASSISTANT_LIFE_RECENT_SLOTS);
  const lastQ = Math.max(-Infinity, ...rs.filter(r => r.kind === 'quarrel').map(r => r.abs));
  const lastM = Math.max(-Infinity, ...rs.filter(r => r.kind === 'makeup').map(r => r.abs));
  if (lastM >= lastQ && lastM > -Infinity && now - lastM <= 12) return 'makeup'; // 12区切り: 前は6回
  if (lastQ > -Infinity && lastQ > lastM) return 'after';
  return 'normal';
};
const assistantLifeLevelOf = (peerSt, a, b) => (typeof assistantPeerLevel === 'function' ? assistantPeerLevel(peerSt, a, b) : 1);
// 今の台本(書き直しの表の鍵つき)を、助手たちの今の候補の形にする。特別なお話・その日の出来事・AI 版・言い合い・similar は入れない
const assistantLifeOldPairCands = (pair, lv) => {
  if (typeof assistantPeerTalkList !== 'function') return [];
  const ev = (typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks().events : []);
  return [...assistantPeerTalkList(), ...ev].filter(t => t && Array.isArray(t.pair) && !t.special && !t.when && !t.gen && !t.similar && t.kind !== 'quarrel' && t.kind !== 'makeup'
    && assistantLifePairKey(t.pair[0], t.pair[1]) === assistantLifePairKey(pair[0], pair[1]) && lv >= (t.lv || 1))
    .map(t => ({ talk: t, keys: { doing: t.lifeDoing || null, lv: t.lifeLv || null } }));
};
// 2人の組の台本。言い合い中の2人がまた一緒なら仲直り/気分がすぐれない2人はたまに言い合い/ふだんは 2人の掛け合い
const assistantLifePickPairTalk = (pair, group, peerSt, life, seen, rand = Math.random) => {
  const [a, b] = [...pair].sort();
  const key = assistantLifePairKey(a, b);
  const lv = assistantLifeLevelOf(peerSt, a, b);
  const ctx = { place: group.place, doing: group.doing };
  const quarrels = typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks().quarrels : assistantLifeQuarrelTalks();
  const q = (peerSt && peerSt.quarrel) || { pending: null, done: [] };
  if (q.pending && q.pending.pair === key) {
    // 仲直りの形を選ぶ(謝る・間に入る。56-assistant-life-rel.jsx)。無ければけんか自身の仲直り
    const rm = typeof assistantLifeRelPickMend === 'function' ? assistantLifeRelPickMend({ ...q.pending, ids: [a, b] }, group, peerSt, seen, rand) : null;
    if (rm) return assistantLifeWithCtx(rm, ctx);
    const mk = quarrels.find(t => t.kind === 'makeup' && t.quarrelId === q.pending.id);
    if (mk) return assistantLifeWithCtx(mk, ctx);
  }
  const moods = (life && life.moods) || {};
  const grumpy = [a, b].some(id => moods[id] === 'sulky' || moods[id] === 'restless');
  const cooling = typeof assistantLifeRelCooling === 'function' && assistantLifeRelCooling(key); // 仲直りから2日はけんかしない(rel.jsx)
  if (!q.pending && !cooling && lv >= 2 && rand() < (grumpy ? 0.3 : 0.05)) {
    const qs = quarrels.filter(t => t.kind === 'quarrel' && assistantLifePairKey(t.pair[0], t.pair[1]) === key && !(seen && seen[t.id]));
    if (qs.length) return assistantLifeWithCtx(qs[Math.floor(rand() * qs.length)], ctx);
  }
  // 人間らしい出来事(からかう・ライバル・相談・ないしょ話・久しぶりの気まずさ。rel.jsx)
  const rp = typeof assistantLifeRelPickPair === 'function' ? assistantLifeRelPickPair([a, b], group, peerSt, life, seen, rand) : null;
  if (rp) return assistantLifeWithCtx(rp, ctx);
  const band = assistantLifeLvBand(lv);
  const air = assistantLifeAirOf(life, a, b);
  const okBand = (x) => x == null || (ASSISTANT_LIFE_BAND_RANK[x] ?? 0) <= ASSISTANT_LIFE_BAND_RANK[band];
  const okAir = (x) => x == null || x === 'normal' || x === air;
  const cands = [
    ...assistantLifeTalkSet().pair.filter(t => assistantLifePairKey(t.pair[0], t.pair[1]) === key).map(t => ({ talk: t, keys: { doing: t.keys.doing || null, lv: t.keys.lv || null, air: t.keys.air || null } })),
    ...assistantLifeOldPairCands([a, b], lv),
  ].filter(c => okBand(c.keys.lv) && okAir(c.keys.air));
  return assistantLifeWithCtx(assistantLifeChoose(cands, { air: air === 'normal' ? null : air, doing: group.doing, lv: band }, ['doing', 'lv'], seen, rand), ctx);
};
// 組の台本(2人 → 2人の掛け合い/3人以上 → 決まった3人 → どの3人でも → 組の中の2人)
const assistantLifePickGroupTalk = (group, peerSt, life = ASSISTANT_LIFE_STORE.state.life, rand = Math.random) => {
  if (!group || !Array.isArray(group.ids) || group.ids.length < 2) return null;
  const seen = ASSISTANT_LIFE_STORE.state.seen || {};
  const ids = group.ids;
  const ctx = { place: group.place, doing: group.doing };
  if (ids.length === 2) return assistantLifePickPairTalk(ids, group, peerSt, life, seen, rand);
  // 待っている仲直り(間に入る)・やきもち(rel.jsx)
  const rg = typeof assistantLifeRelPickGroup === 'function' ? assistantLifeRelPickGroup(group, peerSt, life, seen, rand) : null;
  if (rg) return assistantLifeWithCtx(rg.trio ? rg : { ...rg, trio: [...ids] }, ctx);
  const trioLv = typeof ASSISTANT_PEER_TRIO_LV !== 'undefined' ? ASSISTANT_PEER_TRIO_LV : 2;
  const pairsOk = (m) => { for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) if (assistantLifeLevelOf(peerSt, m[i], m[j]) < trioLv) return false; return true; };
  const oldTrios = typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks().trios : [];
  // 4人の組では「3人」と言う台本は使わない(2026-11-07 社長「3人でも4人でも同時に遊んでるならそう書く」)
  const fitsSize = (t) => ids.length <= 3 || !(t.lines || []).some(l => /3人|三人/.test(l.t || ''));
  const fixed = [...assistantLifeTalkSet().trio, ...oldTrios.filter(t => !t.similar)].filter(t => Array.isArray(t.trio) && t.trio.every(id => ids.includes(id)) && pairsOk(t.trio) && fitsSize(t))
    .map(t => ({ talk: t, keys: { doing: (t.keys && t.keys.doing) || t.lifeDoing || null } }));
  const freshFixed = fixed.filter(c => !seen[c.talk.id]);
  if (freshFixed.length) return assistantLifeWithCtx(assistantLifeChoose(freshFixed, { doing: group.doing }, ['doing'], seen, rand), ctx);
  const any = assistantLifeTalkSet().anyTrio.filter(t => t.pair.every(id => ids.includes(id)) && fitsSize(t)).map(t => ({ talk: t, keys: { doing: t.keys.doing || null } }));
  const freshAny = any.filter(c => !seen[c.talk.id]);
  // どの3人でも: 話すのは pair の2人。顔は組の全員を並べる(3人の掛け合いとして見る・上がり方も3人の掛け合いと同じ)
  if (freshAny.length) return assistantLifeWithCtx({ ...assistantLifeChoose(freshAny, { doing: group.doing }, ['doing'], seen, rand), kind: 'trio', trio: [...ids] }, ctx);
  // 3人の台本を見つくしたら、組の中の2人(友情Lv の高い2人ほど出やすい)
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  const w = pairs.map(p => 1 + assistantLifeLevelOf(peerSt, p[0], p[1]));
  let r = rand() * w.reduce((x, y) => x + y, 0);
  let pick = pairs[pairs.length - 1];
  for (let i = 0; i < pairs.length; i++) { r -= w[i]; if (r <= 0) { pick = pairs[i]; break; } }
  return assistantLifePickPairTalk(pick, group, peerSt, life, seen, rand) || (fixed.length ? assistantLifeWithCtx(assistantLifeChoose(fixed, { doing: group.doing }, ['doing'], seen, rand), ctx) : null);
};
// HOME の掛け合い(56-assistant-peer.jsx の assistantPeerPickTalk から)。いまの助手のいる組を先に
const assistantLifePickHomeTalk = (peerSt, { selectedId, metIds, rand = Math.random } = {}) => {
  if (!assistantLifeEnabled() || !ASSISTANT_LIFE_STORE.state.loaded) return null;
  const met = new Set(metIds || []);
  const groups = ((ASSISTANT_LIFE_STORE.state.life && ASSISTANT_LIFE_STORE.state.life.groups) || []).filter(g => g.ids.every(id => met.has(id)));
  if (!groups.length) return null;
  const w = groups.map(g => (g.ids.includes(selectedId) ? 3 : 1));
  let r = rand() * w.reduce((x, y) => x + y, 0);
  let g = groups[groups.length - 1];
  for (let i = 0; i < groups.length; i++) { r -= w[i]; if (r <= 0) { g = groups[i]; break; } }
  return assistantLifePickGroupTalk(g, peerSt, ASSISTANT_LIFE_STORE.state.life, rand);
};
// ひとりの助手の様子を見る: 言い合いのあとなら「距離をおく」/たまにブリーダーへのひとこと/ふだんは ひとりごと(様子の1行 → 気持ちの1行)
const assistantLifePickSoloTalk = (id, life = ASSISTANT_LIFE_STORE.state.life, peerSt = (typeof ASSISTANT_PEER_STORE !== 'undefined' ? ASSISTANT_PEER_STORE.state : null), rand = Math.random) => {
  const s = life && life.solo && life.solo[id];
  if (!s) return null;
  const seen = ASSISTANT_LIFE_STORE.state.seen || {};
  const ctx = { place: s.place, doing: s.doing };
  const mood = (life.moods || {})[id] || null;
  const q = (peerSt && peerSt.quarrel) || {};
  if (s.reason === 'distance' && q.pending && String(q.pending.pair).split('-').includes(id) && typeof assistantPeerExtraTalks === 'function') {
    const qt = assistantPeerExtraTalks().quarrels.find(t => t.id === q.pending.id && t.kind === 'quarrel');
    if (qt && Array.isArray(qt.distance) && qt.distance.length) return assistantLifeWithCtx({ id: `${qt.id}-distance`, kind: 'life-distance', pair: qt.pair, lines: qt.distance, lv: 1, scene: 'any' }, ctx);
  }
  const keysOf = (t) => ({ pt: t.keys.place ? assistantLifePlaceType(id, t.keys.place) : null, mood: t.keys.mood || null, why: t.keys.why || null, doing: t.keys.doing || null });
  const want = { pt: assistantLifePlaceType(id, s.place), mood, why: s.reason === 'distance' ? null : s.reason, doing: s.doing };
  const T = assistantLifeTalkSet();
  const look = assistantLifeLookNow();
  const here = (t) => (t.at == null || t.at === s.place) && (!t.tods || !look || t.tods.includes(look)); // 台詞の場所・時間帯をいまに合わせる
  const br = T.breeder.filter(t => t.who === id && here(t)).map(t => ({ talk: t, keys: keysOf(t) }));
  if (br.length && rand() < 0.3) { const t = assistantLifeChoose(br, want, ['doing', 'why', 'mood', 'pt'], seen, rand); if (t && !seen[t.id]) return assistantLifeWithCtx(t, ctx); }
  const mine = T.solo.filter(t => t.who === id && here(t));
  const ok = (c) => c.keys.pt == null || c.keys.pt === want.pt;
  const scene = assistantLifeChoose(mine.filter(t => t.line === 'scene').map(t => ({ talk: t, keys: keysOf(t) })).filter(ok), want, ['doing', 'why', 'mood'], seen, rand);
  const feel = assistantLifeChoose(mine.filter(t => t.line === 'feel').map(t => ({ talk: t, keys: keysOf(t) })).filter(ok), want, ['doing', 'why', 'mood'], seen, rand);
  const parts = [scene, feel].filter(Boolean);
  if (!parts.length) return null;
  return assistantLifeWithCtx({ id: parts.map(t => t.id).join('+'), kind: 'life-solo', pair: [id], parts: parts.map(t => t.id), lines: parts.flatMap(t => t.lines), keys: parts[0].keys, lv: 1, scene: 'any' }, ctx);
};
// 声をかけたとき(2026-11-07 社長「声をかけにいったら俺とじゃなくて別の助手と喋ってる」): その助手が {name} に話す台本だけ(ほかの助手は出ない)。
//   台本は「ブリーダーへのひとこと」(kind:'breeder'・8人×12本)。いまの場所の型・気分・していることに近いものから。見つくしたら前に見たものから
const assistantLifePickCallTalk = (id, life = ASSISTANT_LIFE_STORE.state.life, rand = Math.random) => {
  const seen = ASSISTANT_LIFE_STORE.state.seen || {};
  const g = life && (life.groups || []).find(x => x.ids.includes(id));
  const s = (life && life.solo && life.solo[id]) || (g ? { place: g.place, doing: g.doing } : { place: 'home', doing: 'idle' });
  const ctx = { place: s.place, doing: s.doing };
  const keysOf = (t) => ({ pt: t.keys && t.keys.place ? assistantLifePlaceType(id, t.keys.place) : null, mood: (t.keys && t.keys.mood) || null, why: (t.keys && t.keys.why) || null, doing: (t.keys && t.keys.doing) || null });
  const want = { pt: assistantLifePlaceType(id, s.place), mood: ((life && life.moods) || {})[id] || null, why: s.reason && s.reason !== 'distance' ? s.reason : null, doing: s.doing };
  const look = assistantLifeLookNow();
  const cands = assistantLifeTalkSet().breeder.filter(t => t.who === id && (t.at == null || t.at === s.place) && (!t.tods || !look || t.tods.includes(look)) && (t.lines || []).every(l => l.who === id)).map(t => ({ talk: t, keys: keysOf(t) }));
  if (!cands.length) return null;
  const t = assistantLifeChoose(cands, want, ['doing', 'why', 'mood', 'pt'], seen, rand);
  return t ? assistantLifeWithCtx({ ...t, pair: Array.isArray(t.pair) && t.pair.length ? t.pair : [id] }, ctx) : null;
};
// 誘ったとき: 近くの助手が声をかけに行く(声をかける → こたえる)。答えは気分と理由から(さみしい → 喜ぶ/マイペース → 断る(あとで行く)/すねてる → 照れる)
const assistantLifePickInviteTalk = (id, life = ASSISTANT_LIFE_STORE.state.life, peerSt = (typeof ASSISTANT_PEER_STORE !== 'undefined' ? ASSISTANT_PEER_STORE.state : null), rand = Math.random) => {
  const s = life && life.solo && life.solo[id];
  if (!s) return null;
  const seen = ASSISTANT_LIFE_STORE.state.seen || {};
  const mood = (life.moods || {})[id];
  const answer = mood === 'sulky' ? 'shy' : s.reason === 'mypace' ? (rand() < 0.6 ? 'decline' : 'glad') : (rand() < 0.8 ? 'glad' : 'shy');
  const others = [...(life.groups || []).flatMap(g => g.ids), ...Object.keys(life.solo || {})].filter(x => x !== id);
  const cands = assistantLifeTalkSet().invite.filter(t => t.who === id && others.includes(t.from))
    .map(t => ({ talk: t, keys: { answer: t.keys.answer || null, from: t.from } }));
  // 仲のいい相手ほど声をかけに行きやすい
  const best = [...new Set(cands.map(c => c.talk.from))].sort((x, y) => assistantLifeLevelOf(peerSt, y, id) - assistantLifeLevelOf(peerSt, x, id))[0] || null;
  const t = assistantLifeChoose(cands, { answer, from: best }, ['from', 'answer'], seen, rand);
  if (!t) return null;
  const g = (life.groups || []).find(x => x.ids.includes(t.from));
  return assistantLifeWithCtx(t, g ? { place: g.place, doing: g.doing } : { place: s.place, doing: s.doing });
};


// ---------- 2人にあげる道具(差し入れ・友情のしるし)を分かりやすく(2026-11-07 社長「この見本で作る」 ux/items-mock.png) ----------
// 名前・絵・値段・上がる量は書き込まず、持ち物(ITEMS)・交換所(RHYTHM_EVENT_POINT_SHOP_OFFERS)・上がり方の表から読む(あとで名前や種類が変わってもずれない)
// 誘う・引き合わせる … 無料。次の時間の過ごし方が変わる/道具 … 今すぐ2人の友情Lv とあなたとの仲良し度が上がる
// 道具の種類は assistants.js の ASSISTANT_LIFE_GIFTS(10種類・2026-11-08)。印 assistantLife が偽のときは今までの2つ(🧺🤝)だけ(56-assistant-life-gifts.jsx)
const ASSISTANT_LIFE_ITEM_KINDS = Object.freeze((typeof ASSISTANT_LIFE_GIFTS !== 'undefined' && Array.isArray(ASSISTANT_LIFE_GIFTS) ? ASSISTANT_LIFE_GIFTS : [])
  .map(g => Object.freeze({ kind: g.kind, itemId: g.itemId, what: g.what })));
const ASSISTANT_LIFE_ITEM_INTRO_KEY = 'mh_assistant_life_item_intro_v1';
const assistantLifeItemInfo = (kind) => {
  const g = typeof assistantLifeGiftOf === 'function' ? assistantLifeGiftOf(kind) : null;
  if (!g) return null;
  // 上がる量は「ふつう」のとき(好きなら多め・苦手なら少なめ)。今の2つ(🧺🤝)は今と同じ数
  return { kind: g.kind, itemId: g.itemId, what: g.what, name: g.name, emoji: g.emoji, cost: g.cost, peerAmt: g.peer, playerAmt: g.player };
};
const assistantLifeItemInfos = () => (typeof assistantLifeGiftKinds === 'function' ? assistantLifeGiftKinds() : []).map(g => assistantLifeItemInfo(g.kind)).filter(Boolean);
// 持ち物・交換所の説明(印が真のときだけ「何が起きるか」中心の文。偽なら今の desc)
const assistantLifeItemDesc = (item) => {
  if (!item) return '';
  if (!assistantLifeEnabled()) return item.desc || '';
  const k = ASSISTANT_LIFE_ITEM_KINDS.find(x => x.itemId === item.id);
  if (!k) return item.desc || '';
  const info = assistantLifeItemInfo(k.kind);
  return `${k.what}。助手2人に贈ると、2人の友情Lv +${info.peerAmt}・2人それぞれとあなたの仲良し度 +${info.playerAmt}(好きな物なら多め・苦手な物なら少なめ)・2人のひとこと。HOME の「🏡 助手ライフ」で、一緒にいる2人に贈る。同じ道具は1日1回・合わせて1日3回まで(朝4時に戻る)。ビートP交換所で手に入る。`;
};
// 道具を渡すとよさそうな2人の印(もうすぐ友情Lv が上がる/言い合いのあと)
const assistantLifePairHint = (peerSt, life, a, b) => {
  const pts = (peerSt && peerSt.bond && peerSt.bond[assistantLifePairKey(a, b)]) || 0;
  const levels = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : [];
  const lv = typeof assistantPeerBondLevel === 'function' ? assistantPeerBondLevel(pts) : 1;
  const cur = levels.find(x => x.level === lv);
  const next = levels.find(x => x.level === lv + 1);
  const q = peerSt && peerSt.quarrel && peerSt.quarrel.pending;
  const after = (q && q.pair === assistantLifePairKey(a, b)) || assistantLifeAirOf(life, a, b) === 'after';
  const near = next && next.min - pts <= 30 ? { level: next.level, left: next.min - pts, ratio: cur ? (pts - cur.min) / (next.min - cur.min) : 0 } : null;
  return { lv, pts, near, after, next };
};

// ---------- 見守る(段階2) ----------
// 見守るの1日の上限はなくした(2026-11-08 社長「上限高くても回数縛りがあるなら意味なくない？」→「1日の上限をなくす」)。
//   決まりは「同じ組はその時間帯に1回」(life.watched)だけ。見守った数(counts.watch)は記録として数え続ける(消さない)。
//   前はにぎわいの段の moves(静か6・ふつう10・にぎやか16・お祭り24)が1日の上限だった。呼ぶ側のため名前は残し、上限なし(Infinity)を返す
const assistantLifeWatchLeft = () => Infinity;
// いま見守れる組の数(この時間帯にまだ見守っていない組)
const assistantLifeWatchableNow = (life) => ((life && life.groups) || []).filter(g => !((life && life.watched) || []).includes(assistantLifeGroupKey(g))).length;
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
  // 様子に合う台本(段階3)。無ければ今までの選び方
  // 段階C ❷A: 部屋で遊びに来た助手と家具の掛け合いがあれば、それを先に流す(見守る1回に数える・アルバムと今日あったことに残る)
  const furnVisit = group.place === 'home' && typeof assistantLifeFurnVisitOf === 'function' && typeof assistantLifeHostOf === 'function' ? assistantLifeFurnVisitOf(assistantLifeHostOf(group.ids), group.ids) : null;
  const talk = furnVisit || assistantLifePickGroupTalk(group, ASSISTANT_PEER_STORE.state, life) || assistantLifePickWatchTalk(group, ASSISTANT_PEER_STORE.state);
  if (!talk) return null;
  const p = assistantLifePlayForDay(ASSISTANT_LIFE_STORE.state.play, day);
  ASSISTANT_LIFE_STORE.set({ life: { ...life, watched: [...(life.watched || []), key] }, play: { ...p, counts: { ...(p.counts || {}), watch: ((p.counts && p.counts.watch) || 0) + 1 } } });
  assistantLifeSaveLife(); assistantLifeSavePlay();
  // 見た記録(最近見たもの・アルバム)と上がり方は、ふだんの掛け合いと同じ(1日の数には入れない)
  try { assistantPeerMarkShown(talk, { scene: 'life', special: false, now }); } catch {}
  // 言い合いは何も増やさない(2人はしばらく距離をおく。また一緒になったときの仲直りで増える)
  if (talk.kind === 'quarrel') return talk;
  // 移動が1日12回になったので、見守る1回ぶんの友情・仲良し度は約75%(台帳 #5304・#5328。1日の上限はそのまま)
  const pg = (act) => assistantLifeSlotGainOf(typeof ASSISTANT_PEER_BOND_ACTIONS !== 'undefined' && ASSISTANT_PEER_BOND_ACTIONS[act] ? ASSISTANT_PEER_BOND_ACTIONS[act].amount : null);
  const bg = (act) => assistantLifeSlotGainOf(typeof ASSISTANT_BOND_ACTIONS !== 'undefined' && ASSISTANT_BOND_ACTIONS[act] ? ASSISTANT_BOND_ACTIONS[act].amount : null);
  if (talk.kind === 'makeup') {
    if (assistantPeerMakeupDone(talk)) { await assistantPeerGain(talk.pair[0], talk.pair[1], 'makeup', pg('makeup')); assistantPeerAddPlayerBond(talk.pair, 'peerMakeup', bg('peerMakeup')); }
    try { assistantPeerAlbumAdd(talk); } catch {}
    return talk;
  }
  try { assistantPeerAlbumAdd(talk); } catch {}
  if (talk.kind === 'event') { await assistantPeerGain(talk.pair[0], talk.pair[1], 'event', pg('event')); assistantPeerAddPlayerBond(talk.pair, 'peerEvent', bg('peerEvent')); return talk; }
  for (const [a, b] of assistantPeerPairsOf(talk)) await assistantPeerGain(a, b, 'talk', pg('talk'));
  const bk = talk.kind === 'trio' ? 'peerTrio' : 'peerTalk';
  assistantPeerAddPlayerBond(assistantPeerMembers(talk), bk, bg(bk));
  return talk;
};

// ---------- 画面「助手たちの今」・HOME の帯(段階2) ----------
const assistantLifeOpenScreen = () => { if (assistantLifeEnabled()) ASSISTANT_LIFE_STORE.set({ open: true }); };
const assistantLifeCloseScreen = () => ASSISTANT_LIFE_STORE.set({ open: false });
// 段ごとのひとこと(上の帯)
const ASSISTANT_LIFE_TIER_NOTES = Object.freeze({
  quiet: 'のんびりした一日。遊ぶほど、友情Lv が上がりやすくなります', // 前は「みんなの動きが増えます」(見守れる回数)。1日の上限をなくしたので言いかえた(2026-11-08)
  normal: 'いつもどおりの一日。みんな、それぞれ過ごしています',
  lively: 'よく遊んでくれたから、みんな元気！',
  festival: 'お祭りみたいににぎやか！ 友情Lv がぐんぐん上がります',
});
const ASSISTANT_LIFE_REASON_LABEL = Object.freeze({ lonely: 'さみしそう', mypace: 'マイペース', distance: '距離をおいている' });
// 次の時間まで(「あと1時間12分で 夜」)。時間が変わるとみんなが過ごし方を決め直す
const assistantLifeNextSlotText = (now = Date.now()) => {
  const cur = assistantLifeSlotAt(now);
  const h = new Date(Number(now) + 9 * 3600000);
  const slot = cur; // 12区切り: 次の移動は2時間ごと(cur.to)
  const mins = Math.max(1, (slot.to * 60) - (h.getUTCHours() * 60 + h.getUTCMinutes()));
  const t = mins >= 60 ? `${Math.floor(mins / 60)}時間${mins % 60 ? `${mins % 60}分` : ''}` : `${mins}分`;
  // 次の区切りの名前(夕方・深夜など)は出さない。見出しの朝・昼・夕・夜とずれる(2026-11-07 ミハリ L8)
  return `あと${t}でみんなが動きます`;
};
const assistantLifeSlotRange = (id) => { const s = id && typeof id === 'object' ? id : ASSISTANT_LIFE_SLOTS.find(x => x.id === id); return s ? `${s.from}〜${s.to % 24}時` : ''; }; // 区切りの名前(午後・深夜など)は出さない。見出しの朝・昼・夕・夜とずれる(2026-11-07 ミハリ L8)

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
            <span className="block text-[10px] font-bold leading-tight text-pink-200">にぎわい「{tier.label}」・みんなの様子 ▸</span>
          </span>
        </button>
        <button type="button" data-assistant-life-band-close onClick={() => setHidden(true)} aria-label="閉じる" className="h-8 w-8 shrink-0 rounded-full border border-slate-600 text-[13px] font-black text-slate-300 active:scale-95">×</button>
      </div>
    </div>);
}

// 閉じているあいだは何も読まない・書かない(演奏中・マルチ中に様子を決め直さない)
// 2026-11-07 段階1: 中身は「助手たちの家」(56-assistant-life-house.jsx)。今の一覧は家の「📋 居場所」の中で embedded として使う
function AssistantLifeScreen(props) {
  const st = useAssistantLifeState();
  if (!assistantLifeEnabled() || !st.open) return null;
  if (typeof AssistantLifeHouse === 'function') return <AssistantLifeHouse {...props}/>;
  return <AssistantLifeScreenBody {...props}/>;
}
//   embedded … 家の「📋 居場所」の中に入れる(外枠・見出し・にぎわい・タブ・道具の欄を出さない。掛け合いは家を閉じずに場面で流す)
function AssistantLifeScreenBody({ metIds, onReplay, peerItems = null, onUseItem = null, embedded = false }) {
  const st = useAssistantLifeNow(metIds);
  const [tab, setTab] = React.useState('now');
  const [pick, setPick] = React.useState([]);
  const [note, setNote] = React.useState('');
  const [give, setGive] = React.useState(null); // { ids(組), pair, kind }  渡す前の確かめ
  const peerSt = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
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
  // 掛け合いを流す。家の中(embedded)なら閉じずに場面で流す(ctx … だれが・どこで)
  const playTalk = (talk, ctx) => { if (!embedded) assistantLifeCloseScreen(); if (onReplay) onReplay(talk, ctx); };
  const watch = async (g) => {
    const talk = await assistantLifeWatch(g);
    if (!talk) { setNote('この組の掛け合いは、いまは見られません'); return; }
    playTalk(talk, { ids: g.ids, place: g.place });
  };
  // 誘う: 次の時間にだれかのところへ行く。声をかけに行く台本があれば、その場で流す
  // 誘う(声をかける): その助手が {name} に話す台本だけ。次の時間に、だれかのところへ行く(2026-11-07 社長の指摘で、ほかの助手が出る台本はやめた)
  const sleepingOf = (id) => { const x = (life.solo || {})[id]; return !!(x && x.doing === 'sleep'); };
  const invite = async (id) => {
    const talk = sleepingOf(id) && typeof assistantLifePickSleepTalk === 'function' ? assistantLifePickSleepTalk(id, { wake: true, place: 'home' }) : assistantLifePickCallTalk(id, life);
    if (!(await assistantLifeNudge('invite', id))) return;
    setNote(`${nameOf(id)}に声をかけました。次の時間に、だれかのところへ行きます`);
    if (talk) { if (!sleepingOf(id)) assistantLifeMarkSeen(talk); playTalk(talk, { ids: [id], place: ((life.solo || {})[id] || {}).place, sleep: sleepingOf(id) }); }
  };
  // ようすを見る(ひとりの助手): ひとりごと・距離をおく・ブリーダーへのひとこと。同じ時間に同じ助手は1回。何も増えない
  const peek = (id) => {
    const key = `solo:${id}`;
    if ((life.watched || []).includes(key)) return;
    // 寝ているなら寝言。起きていれば、その助手だけが話す台本(いない相手の行は外す)
    const talk = sleepingOf(id) && typeof assistantLifePickSleepTalk === 'function' ? assistantLifePickSleepTalk(id, { wake: false, place: 'home' })
      : (typeof assistantLifeOnlyPresent === 'function' ? assistantLifeOnlyPresent(assistantLifePickSoloTalk(id, life), [id]) : assistantLifePickSoloTalk(id, life));
    if (!talk) { setNote(`${nameOf(id)}は、いまは静かに過ごしています`); return; }
    ASSISTANT_LIFE_STORE.set({ life: { ...life, watched: [...(life.watched || []), key] } });
    assistantLifeSaveLife();
    if (!sleepingOf(id)) assistantLifeMarkSeen(talk);
    playTalk(talk, { ids: [id], place: ((life.solo || {})[id] || {}).place, sleep: sleepingOf(id) });
  };
  const introduce = async () => { if (pick.length === 2 && await assistantLifeNudge('introduce', pick)) { setNote(`${nameOf(pick[0])}と${nameOf(pick[1])}が、次の時間に一緒に過ごしやすくなりました`); setPick([]); } };
  const mood = (id) => ASSISTANT_LIFE_MOODS[(life.moods || {})[id]] || '';
  // 2人にあげる道具
  const canGive = !!(peerItems && onUseItem);
  const itemInfos = assistantLifeItemInfos();
  const haveOf = (kind) => (peerItems && Number(peerItems[kind])) || 0;
  const usedOf = (kind) => !!(typeof assistantLifeGiftReason === 'function' && assistantLifeGiftReason(kind, peerSt, 1));
  const pairsOf = (gids) => { const o = []; for (let i = 0; i < gids.length; i++) for (let j = i + 1; j < gids.length; j++) o.push([gids[i], gids[j]]); return o; };
  const openGive = (g) => {
    const kind = itemInfos.find(x => haveOf(x.kind) > 0 && !usedOf(x.kind))?.kind || 'gift';
    // 3人以上の組は、渡すとよさそうな2人(もうすぐ Lv が上がる → 言い合いのあと)を先に選んでおく
    const ps = pairsOf(g.ids);
    const best = ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).near) || ps.find(([a, b]) => assistantLifePairHint(peerSt, life, a, b).after) || ps[0];
    setGive({ ids: g.ids, pair: g.ids.length === 2 ? [...g.ids] : best, kind });
  };
  const doGive = async (opts = null) => {
    if (!give || !give.pair) return;
    const talk = await onUseItem(give.kind, give.pair);
    const info = assistantLifeItemInfo(give.kind);
    if (!talk) { setNote(`${info.name}は、いまは贈れません(同じ道具は1日1回・合わせて1日3回・持っている数を見てください)${opts && opts.bought ? `。買った${info.name}は持ち物に残っています` : ''}`); setGive(null); return; }
    const g = (life.groups || []).find(x => give.pair.every(id => x.ids.includes(id)));
    setGive(null);
    playTalk(talk, { ids: give.pair, place: g ? g.place : null });
  };
  return (
    <div {...(embedded ? { 'data-assistant-life-list': '' } : { 'data-assistant-life-screen': '' })} className={embedded ? 'relative' : 'fixed inset-0 flex justify-center bg-black/80'} style={embedded ? undefined : { zIndex: 9000 }}>
      <div className={embedded ? 'w-full' : 'flex h-full w-full max-w-md flex-col bg-slate-950'} style={embedded ? undefined : { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {!embedded && <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <p className="min-w-0 flex-1 text-[15px] font-black text-pink-200">助手ライフ</p>
          <span className="text-right text-[10px] font-bold leading-tight text-slate-400">いまは{assistantLifeSlotRange(slot)}の過ごし方<br/><span data-assistant-life-next-slot className="text-slate-300">{assistantLifeNextSlotText()}</span></span>
          <button type="button" data-assistant-life-close onClick={assistantLifeCloseScreen} aria-label="閉じる" className="h-9 w-9 rounded-full border border-slate-600 text-[15px] font-black text-slate-300 active:scale-95">×</button>
        </div>}
        <div className={embedded ? 'pb-2' : 'min-h-0 flex-1 overflow-y-auto mh-scroll px-3 pb-6 pt-2'}>
          {/* にぎわい(その日に遊んだ量)。家の中では上の帯に出す */}
          {!embedded && <>
          <div data-assistant-life-tier={tier.id} className="rounded-2xl border border-pink-300/40 bg-pink-400/10 p-2.5">
            <div className="flex items-baseline gap-2">
              <p className="text-[12px] font-black text-pink-100">今日のにぎわい「{tier.label}」</p>
              <p className="ml-auto whitespace-nowrap text-[10px] font-bold text-pink-200">{next ? `あと${next.min - play.points}で「${next.label}」` : 'いちばん上の段'}</p>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full bg-pink-400" style={{ width: `${next ? Math.min(100, Math.round(100 * (play.points - tier.min) / (next.min - tier.min))) : 100}%` }}/>
            </div>
            <p className="mt-1 text-[11px] font-bold text-white">{ASSISTANT_LIFE_TIER_NOTES[tier.id]}</p>
            <p className="mt-0.5 text-[11px] text-slate-200"><span className="text-orange-300">🤝 友情Lv の上がり方 ×{tier.mult}</span>(1組1日 {tier.cap} まで)・👀 いま見守れる組 <b className="text-white">{assistantLifeWatchableNow(life)}</b>(同じ組は時間帯ごとに1回)</p>
            <p className="text-[10px] text-slate-400">モンヒロビート・バトル・MFバトルカード・おしゃべりで遊ぶと、にぎわいがたまります(朝4時に新しくなります)</p>
          </div>
          <div className="mt-2 flex gap-1" role="tablist">
            {[['now', 'いまの様子'], ['map', '関係とアルバム']].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} data-assistant-life-tab={k} onClick={() => setTab(k)}
                className={`min-h-[40px] flex-1 rounded-xl border text-[12px] font-black active:scale-[.98] ${tab === k ? 'border-pink-300 bg-pink-400/20 text-pink-100' : 'border-white/10 text-slate-400'}`}>{label}</button>))}
          </div>
          </>}
          {/* お知らせの帯は家の画面と同じ濃い下地(薄い下地だと朝・夕の明るい空の上で字が沈む・2026-11-08 ミハリ) */}
          {note && <p data-assistant-life-note className="mt-2 rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 text-[11px] font-bold text-sky-100">{note}</p>}
          {tab === 'now' && (<>
            {canGive && !embedded && (
              <div data-assistant-life-items className="mt-2 rounded-2xl border border-amber-300/40 bg-slate-950/90 p-2">
                <p className="text-[12px] font-black text-amber-200">🎁 2人に贈る道具(今日あと {typeof assistantLifeGiftLeft === 'function' ? assistantLifeGiftLeft(peerSt) : 0}回・同じ道具は1日1回)</p>
                {typeof AssistantLifeGiftExplain === 'function' && <div className="mt-1"><AssistantLifeGiftExplain compact/></div>}
                {itemInfos.map(x => (
                  <div key={x.kind} data-assistant-life-item={x.kind} className="mt-1.5 flex items-center gap-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-[24px]" aria-hidden="true">{x.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-white">{x.name} <span className="text-[10px] text-slate-400">持っている {haveOf(x.kind)}個{usedOf(x.kind) && haveOf(x.kind) > 0 ? ' ・ 今日は贈れない' : ''}</span></p>
                      <p className="text-[10px] leading-snug text-slate-300">{x.what.split('。')[0]}。<span className="whitespace-nowrap text-orange-300">🤝 友情Lv {assistantLifeItemRange(x).peer}</span>・<span className="whitespace-nowrap text-pink-200">💗 仲良し度 {assistantLifeItemRange(x).player}</span>(好みで変わる)・2人のひとこと</p>
                    </div>
                  </div>))}
                <p className="mt-1.5 text-[10px] leading-snug text-slate-400">手に入れる:モンヒロビートの「ビートP交換所」({itemInfos.map(x => `${x.emoji}${x.cost != null ? `${x.cost}P` : ''}`).join('・')})/贈る:下の組の「🎁 贈る」。誘う・引き合わせるは無料で、次の時間の過ごし方が変わります</p>
                {typeof AssistantLifeShopButton === 'function' && <div className="mt-1.5"><AssistantLifeShopButton tab="item"/></div>}
              </div>)}
            <div className="mt-2 space-y-2">
              {(life.groups || []).map(g => { const key = assistantLifeGroupKey(g); const done = (life.watched || []).includes(key); return (
                <div key={key} data-assistant-life-group={key} className="rounded-2xl border border-white/15 bg-slate-950/90 p-2">
                  <div className="flex items-center gap-2">
                    <AssistantLifeFaces ids={g.ids} size={36}/>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black leading-tight text-white">{g.ids.map(nameOf).join('・')}</p>
                      <p className="text-[11px] font-bold leading-tight text-pink-200">{assistantLifePlaceLabel(g.place)}で{ASSISTANT_LIFE_DOINGS[g.doing].label}</p>
                    </div>
                  </div>
                  {g.ids.some(id => mood(id)) && <p className="mt-1 text-[11px] text-slate-300">{g.ids.filter(id => mood(id)).map(id => `${nameOf(id)}: ${mood(id)}`).join(' / ')}</p>}
                  {(() => {
                    // 渡すとよさそうな印(もうすぐ友情Lv が上がる/言い合いのあと)
                    const hints = pairsOf(g.ids).map(([a, b]) => ({ a, b, ...assistantLifePairHint(peerSt, life, a, b) }));
                    const near = hints.filter(h => h.near).sort((x, y) => x.near.left - y.near.left)[0];
                    const after = hints.find(h => h.after);
                    const who2 = (h) => (g.ids.length > 2 ? `${nameOf(h.a)}と${nameOf(h.b)}、` : '');
                    return (<>
                      {near && <p data-assistant-life-hint="near" className="mt-1 w-fit rounded-full bg-orange-400/20 px-2 py-0.5 text-[10px] font-black text-orange-200">🤝 {who2(near)}もうすぐ友情Lv{near.near.level}(あと{near.near.left})</p>}
                      {near && g.ids.length === 2 && <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-800" aria-hidden="true"><div className="h-full bg-orange-400" style={{ width: `${Math.round(100 * Math.min(1, Math.max(0, near.near.ratio)))}%` }}/></div>}
                      {after && <p data-assistant-life-hint="after" className="mt-1 w-fit rounded-full bg-sky-400/20 px-2 py-0.5 text-[10px] font-black text-sky-200">💦 {who2(after)}言い合いのあと(渡すと仲直りのきっかけに)</p>}
                    </>);
                  })()}
                  <div className="mt-1.5 flex gap-1.5">
                    <button type="button" data-assistant-life-watch={key} disabled={done || watchLeft <= 0} onClick={() => watch(g)}
                      className="min-h-[44px] flex-1 rounded-xl border border-pink-300/60 bg-pink-500/25 px-2 text-[12px] font-black text-pink-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
                      {done ? '✓ 見守りました' : '👀 見守る'}
                    </button>
                    {canGive && (
                      <button type="button" data-assistant-life-give={key} onClick={() => openGive(g)}
                        className="min-h-[44px] flex-1 rounded-xl border border-amber-300/70 bg-amber-500/25 px-2 text-[12px] font-black text-amber-50 active:scale-[.98]">
                        🎁 {g.ids.length === 2 ? '贈る' : 'だれに贈る？'}
                      </button>)}
                  </div>
                </div>); })}
              {Object.entries(life.solo || {}).map(([id, s]) => (
                <div key={id} data-assistant-life-solo={id} data-assistant-life-reason={s.reason} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/90 p-2">
                  <AssistantLifeFaces ids={[id]} size={36}/>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-black leading-tight text-white">{nameOf(id)}<span className={`ml-1 text-[10px] ${s.reason === 'lonely' ? 'text-amber-200' : 'text-slate-400'}`}>{ASSISTANT_LIFE_REASON_LABEL[s.reason]}</span></p>
                    <p className="text-[11px] font-bold leading-tight text-slate-300">{assistantLifePlaceLabel(s.place)}で{ASSISTANT_LIFE_DOINGS[s.doing].label}・{mood(id)}</p>
                  </div>
                  <button type="button" data-assistant-life-peek={id} disabled={(life.watched || []).includes(`solo:${id}`)} onClick={() => peek(id)}
                    className="min-h-[44px] shrink-0 rounded-xl border border-pink-300/60 bg-pink-500/25 px-2 text-[11px] font-black text-pink-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
                    {(life.watched || []).includes(`solo:${id}`) ? '✓ 見た' : 'ようすを見る'}
                  </button>
                  {s.reason !== 'distance' && (
                    <button type="button" data-assistant-life-invite={id} disabled={invitedNext.has(id)} onClick={() => invite(id)}
                      className="min-h-[44px] shrink-0 rounded-xl border border-amber-300/70 bg-amber-500/25 px-2 text-[11px] font-black text-amber-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
                      {invitedNext.has(id) ? '✓ 誘った' : '誘う'}
                    </button>)}
                </div>))}
            </div>
            {ids.length >= 2 && (
              <div data-assistant-life-introduce className="mt-3 rounded-2xl border border-sky-300/50 bg-slate-950/90 p-2">
                <p className="text-[12px] font-black text-sky-100">引き合わせる</p>
                <p className="mb-1.5 text-[10px] text-slate-300">2人を選ぶと、次の時間に一緒に過ごしやすくなります。言い合いのあとなら、仲直りのきっかけに。</p>
                <div className="flex flex-wrap gap-1.5">
                  {ids.map(id => { const on = pick.includes(id); return (
                    <button key={id} type="button" data-assistant-life-pick={id} aria-pressed={on} onClick={() => setPick(p => on ? p.filter(x => x !== id) : [...p, id].slice(-2))}
                      className={`min-h-[40px] rounded-full border px-2.5 text-[11px] font-black active:scale-95 ${on ? 'border-sky-300 bg-sky-500/40 text-white' : 'border-white/25 bg-slate-800 text-slate-100'}`}>{nameOf(id)}</button>); })}
                </div>
                <button type="button" data-assistant-life-introduce-go disabled={pick.length !== 2 || !!introNext} onClick={introduce}
                  className="mt-2 min-h-[44px] w-full rounded-xl border border-sky-300/60 bg-sky-500/25 text-[12px] font-black text-sky-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
                  {introNext ? `次の時間は ${introNext.pair.split('-').map(nameOf).join('と')} を引き合わせます` : '次の時間に一緒に過ごしてもらう'}
                </button>
              </div>)}
            <p data-assistant-life-foot className="mt-3 rounded-xl bg-slate-950/85 px-2 py-1.5 text-[10.5px] leading-snug text-slate-300">みんな、5時・10時・14時・18時・21時・0時に、自分で過ごし方を決め直します。</p>
          </>)}
          {tab === 'map' && typeof AssistantPeerMap === 'function' && (
            <div className="mt-2"><AssistantPeerMap metIds={metIds} onReplay={(t) => { assistantLifeCloseScreen(); if (onReplay) onReplay(t); }} peerItems={peerItems} onUseItem={onUseItem}/></div>)}
        </div>
      </div>
      {give && <AssistantLifeGiftSheet give={give} setGive={setGive} life={life} peerSt={peerSt} haveOf={haveOf} nameOf={nameOf} onGive={doGive}/>}
    </div>);
}
// 渡す前の確かめ(道具10種類・2人の好み・上がる量)は 56-assistant-life-gifts.jsx の AssistantLifeGiftSheet
// はじめて道具を手に入れたときの案内(HOME で1回だけ。mh_assistant_life_item_intro_v1)
function AssistantLifeItemIntro({ peerItems }) {
  const [state, setState] = React.useState('loading'); // loading | show | done
  const have = ASSISTANT_LIFE_ITEM_KINDS.find(k => peerItems && Number(peerItems[k.kind]) > 0);
  // 掛け合いが流れているあいだは待つ(重ねない)
  const peer = (typeof useAssistantPeerState === 'function') ? useAssistantPeerState() : null;
  React.useEffect(() => {
    if (!assistantLifeEnabled() || !have || state !== 'loading') return;
    let alive = true;
    Promise.resolve(storeGet(ASSISTANT_LIFE_ITEM_INTRO_KEY, false, false)).catch(() => false).then(v => { if (alive) setState(v === true ? 'done' : 'show'); });
    return () => { alive = false; };
  }, [!!have]);
  if (!assistantLifeEnabled() || !have || state !== 'show' || (peer && peer.talking)) return null;
  const info = assistantLifeItemInfo(have.kind);
  const close = (open) => { setState('done'); try { storeSet(ASSISTANT_LIFE_ITEM_INTRO_KEY, true, false); } catch {} if (open) assistantLifeOpenScreen(); };
  const guide = (typeof assistantById === 'function') ? assistantById('mua') : null;
  return (
    <div data-assistant-life-item-intro className="fixed inset-0 flex items-center justify-center bg-black/60 px-4" style={{ zIndex: 8800 }}>
      <div className="w-full max-w-sm rounded-2xl border-2 border-amber-300 bg-[#1c1405] p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          {guide && <AssistantFace who={guide} size={44} accent={guide.accent} expression="wink"/>}
          <p className="text-[14px] font-black text-amber-200">はじめての {info.emoji} {info.name}！</p>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-white">① 「🏡 助手ライフ」で、一緒にいる2人に贈れるよ<br/>② 2人の<span className="whitespace-nowrap">友情Lv と</span>、あなたとの仲良し度が上がる<br/>③ 好きな物だと多めに上がるよ。好みは<span className="whitespace-nowrap">贈ると分かる！</span><br/>④ 同じ道具は1日1回・<span className="whitespace-nowrap">合わせて1日3回まで</span></p>
        <div className="mt-2 flex gap-2">
          <button type="button" data-assistant-life-item-intro-close onClick={() => close(false)} className="min-h-[44px] flex-1 rounded-xl border border-slate-600 text-[12px] font-black text-slate-300 active:scale-[.98]">あとで</button>
          <button type="button" data-assistant-life-item-intro-open onClick={() => close(true)} className="min-h-[44px] flex-[2] rounded-xl border border-amber-300/70 bg-amber-400/20 text-[12px] font-black text-amber-100 active:scale-[.98]">「助手ライフ」を開く</button>
        </div>
      </div>
    </div>);
}
