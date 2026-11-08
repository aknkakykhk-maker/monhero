// ===== MFバトルカード: 助手の推し・好き・素顔のデッキ(2026-11-08 社長の決定。前の型3つ attack/guard/normal を作り直した) =====
// 助手ごとにデッキを3つ持つ。
//   推し(oshi) … その助手の推しの種が主役
//   好き(suki) … 好きなモンスター(助手ライフ)のもう1体が主役(カードに無い種は、同じ系統か近い種)
//   素顔(sugao) … 仲良し度で変わる。低い=よそいき(yoso・無難な今の組み方) / 高い=本音(honne・ほんとはやってみたい組み方)
//   3つは主役のまわりの種を別々の組から選ぶ(系統を3つの組へ振り分ける)。主役3体は2体以上ちがい、カードの重なりは4割まで(組み直すたびに検査が見る)
// 時期が来たら3つのうち「いちばん古い1つ」だけを組み直す。組み直すときは中継役(card-assistant-talk の deckPlan)に方針と名前を聞く。
//   使えない(切・上限・失敗・遅れ)ときは、小さな揺らぎで組み直す(画面に違いは出さない)。名前が決まりに合わなければ既定の名前
//   対戦で出すデッキは、助手ライフの今の気分・仲良し度に合う1つを6割・ほかの2つを2割ずつ(合う物が無ければ均等)
// ★全部、公開の印 RELEASE_FLAGS.cardGrowStyle(84 の cardGrowStyleOn)で止める。偽のあいだは何も読まない・書かない・呼ばない
// ★保存は新しいキー mh_card_ai_recipe_v2 だけに書く。前の mh_card_ai_recipe_v1 は読むだけ(会った印・10戦の数を引きつぐ。消さない・書きかえない)
// ★画面は持たない(node の検査で読めるように JSX を書かない)。材料(推し・好き・仲良し度・気分)は助手部の口 assistantLifeCardMaterial を typeof で読む
// ★82 の口(cardAiBuildDeck の opts.face・opts.style・opts.plan、cardAiPlanClean・cardAiPlanCandidates・cardAiPlanHabitRange)の上に作る
// 進捗メモ: docs/progress/card-ai-faces/README.md
const CARD_AI_RECIPE_KEY = CARD_SAVE_KEYS.aiRecipe;   // mh_card_ai_recipe_v1(読むだけ)
const CARD_AI_RECIPE2_KEY = CARD_SAVE_KEYS.aiRecipe2; // mh_card_ai_recipe_v2
const CARD_AI_DECK_KEY = CARD_SAVE_KEYS.aiDeck;       // mh_card_ai_deck_v1
const CARD_AI_DECK_GAMES = 10;      // その助手と何戦ごとに組み直すか
const CARD_AI_DECK_SLOTS = 3;       // 1日に何回(朝4時区切りの1日を8時間ずつに分け、その中の時刻は端末と日付の種で決める)
const CARD_AI_DECK_WAIT_MS = 16000; // 中継役を待つ長さ(中継役の側は15秒)
const CARD_AI_DECK_MAIN = 0.6;      // 今の気分・仲良し度に合うデッキを出す割合(残りはほかの2つで半分ずつ)
const CARD_AI_DECK_JITTER = 0.25;   // 揺らぎ: くせを幅の何割まで動かすか
const CARD_AI_DECK_NAME_MAX = 12;
const CARD_AI_DECK_LINE_MAX = 60;
const CARD_AI_FACE_SHARE_MAX = 0.4; // 2つのデッキで同じカードは4割まで(社長 Q3 A)
const CARD_AI_FACE_TRIO_DIFF = 2;   // 主役3体は2体以上ちがう(社長 Q3 A)

// ---- 顔(推し・好き・素顔) ----
const CARD_AI_FACE_IDS = Object.freeze(['oshi', 'suki', 'sugao']);
// 保存するのは4つ(素顔は よそいき・本音 の2つを持ち、仲良し度で出すほうを決める)
const CARD_AI_FACE_SLOTS = Object.freeze(['oshi', 'suki', 'yoso', 'honne']);
const CARD_AI_FACE_LABEL = Object.freeze({ oshi: '推し', suki: '好き', sugao: '素顔' });
const cardAiFaceOf = (s) => (typeof s === 'string' && CARD_AI_FACE_IDS.includes(s) ? s : null);
// 助手ごとの表。lead … 主役の種(カードの species。null は組の中でいちばん強い種) / nick … 主役の愛称(名前の見張りで使う)
//   style … くせの倍率(82 の CARD_AI_STYLE_TUNE。'normal' は今と同じ) / name … 既定の名前(2026-11-08 部長の案・社長の「この文で」待ち)
//   よそいき(yoso)の名前は今の8つの名前(82 の CARD_AI_STYLE_NAMES)。好きの種は、カードに無い種を部長の判断で近い種にした(みゅあ: イブちゃん=ジョーカー・きき: ライガー)
const CARD_AI_FACES = Object.freeze({
  mua: { oshi: { lead: 'mocchi', nick: 'もち隊長', style: 'normal', name: 'もち隊長の一番乗り' }, suki: { lead: 'joker', nick: 'イブちゃん', style: 'normal', name: 'イブちゃんとちょい悪ナイト' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ノリだけで全力突破' } },
  kiki: { oshi: { lead: 'golem', nick: 'ごろべえ', style: 'normal', name: 'ごろべえの一撃' }, suki: { lead: 'tiger', nick: null, words: ['はやわざ', 'ざんざん', 'エイキ'], style: 'normal', name: 'はやわざ桜吹雪' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ぜんぶ必殺技でつ' } },
  momosuke: { oshi: { lead: 'metalner', nick: null, style: 'normal', name: 'メタルナーの銀ピカライブ' }, suki: { lead: 'mew', nick: 'ゆめっち', style: 'normal', name: 'ゆめっちとおやすみソング' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ぜんぶ見せ場♡' } },
  dra: { oshi: { lead: 'zilla', nick: null, style: 'normal', name: 'グジラとどっしり行進' }, suki: { lead: 'suezo', nick: 'メダマ焼き', style: 'normal', name: 'メダマ焼きのギャグ劇場' }, yoso: { lead: null, style: 'normal' }, honne: { lead: 'golem', nick: 'ゴロ助', style: 'attack', name: 'ゴロ助とおでの大ぶり勝負' } },
  atsu: { oshi: { lead: 'dragon', nick: null, style: 'normal', name: 'ドラゴンで正面突破' }, suki: { lead: 'mocchi', nick: '師匠', style: 'normal', name: '師匠に続け' }, yoso: { lead: null, style: 'normal' }, honne: { lead: 'ghost', nick: 'スプ', style: 'normal', name: 'スプとこっそり奇襲' } },
  kyuko: { oshi: { lead: 'mew', nick: null, style: 'normal', name: 'ニャーの気まぐれ一手' }, suki: { lead: 'pixie', nick: 'ぴぃ', style: 'normal', name: 'ぴぃのわがまま作戦' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: '直感だけで全部いく' } },
  sorashido: { oshi: { lead: 'hare', nick: null, style: 'normal', name: 'ハムで大混乱' }, suki: { lead: 'kyubi', nick: 'コン太', style: 'normal', name: 'コン太とヒメの推し活' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ソロバン抜きの一発勝負' } },
  erubin: { oshi: { lead: 'durahan', nick: null, style: 'guard', name: 'デュラハンの盾の陣' }, suki: { lead: 'pixie', nick: 'つばさ', style: 'normal', name: 'つばさの応援団' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'たまには剣だけで' } },
});
// 素顔が本音になる仲良し度(助手部の口の friendLv がこれ以上。口が無ければ よそいき のまま)。キズナ4とすり合わせ中
const CARD_AI_HONNE_LV = 3;
// 気分 → 6割で出す顔(助手部の口の mood。face を直接返すならそれを先に使う)。キズナ4とすり合わせ中なので、知らない気分は均等
const CARD_AI_MOOD_FACE = Object.freeze({});

// ---- 保存の形 ----
const cardAiDeckIsObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
// 画面に出す短い文: 文字列だけ・制御文字を除く・長さで切る。空なら null
const cardAiDeckText = (v, max) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return t || null;
};
// 1つのデッキ { plan, name, line, at, ai }。plan は 82 の見張り(cardAiPlanClean)を通し、番号のまま持つ
const cardAiDeckEntryOf = (raw, db) => {
  if (!cardAiDeckIsObj(raw)) return null;
  const at = Number.isFinite(raw.at) && raw.at > 0 ? Math.floor(raw.at) : 0;
  let plan = null;
  if (db && cardAiDeckIsObj(raw.plan)) {
    const c = cardAiPlanClean(db, raw.plan);
    // 見張りは名前で返すので、番号に戻して持つ(同じ名前の別番号は、元の番号のうち最初の物)
    if (c) {
      const nos = (Array.isArray(raw.plan.prefer) ? raw.plan.prefer : []).filter((no) => typeof no === 'string' && db.cards[no] && c.prefer.includes(db.cards[no].name));
      const seen = new Set();
      plan = { prefer: nos.filter((no) => !seen.has(db.cards[no].name) && seen.add(db.cards[no].name)), field: c.field.slice(), habit: { ...c.habit } };
    }
  }
  return { plan, name: cardAiDeckText(raw.name, CARD_AI_DECK_NAME_MAX), line: cardAiDeckText(raw.line, CARD_AI_DECK_LINE_MAX), at, ai: raw.ai === true };
};
const cardAiDeckCount = (x, max) => (Number.isInteger(x) && x >= 0 ? Math.min(max, x) : 0);
// 前の保存(v1・型ごと)の読み方。読むだけ(v2 が無いとき、会った印・10戦の数・その日の枠の数を引きつぐ)
const cardNormalizeAiRecipe = (raw, today, db = (typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null)) => {
  const v = cardAiDeckIsObj(raw) ? raw : {};
  const sameDay = typeof v.day === 'string' && v.day === today;
  const perWho = {};
  const src = cardAiDeckIsObj(v.perWho) ? v.perWho : {};
  for (const who of Object.keys(src)) {
    if (!CARD_AI_DECKS[who] || !cardAiDeckIsObj(src[who])) continue;
    const w = src[who];
    const decks = {};
    const ds = cardAiDeckIsObj(w.decks) ? w.decks : {};
    for (const st of CARD_AI_STYLE_IDS) { const e = cardAiDeckEntryOf(ds[st], db); if (e) decks[st] = e; }
    perWho[who] = { met: w.met === true, gamesSince: cardAiDeckCount(w.gamesSince, 9999), slotsDone: sameDay ? cardAiDeckCount(w.slotsDone, CARD_AI_DECK_SLOTS) : 0, decks };
  }
  return { v: 1, day: typeof today === 'string' ? today : '', perWho };
};
// 今の保存(v2・顔ごと)。無い・壊れているときは空。日付が変われば、枠の数(slotsDone)だけ0に戻す(デッキと10戦の数はそのまま)
//   v2 が無い(null)ときだけ、v1 から会った印・10戦の数・その日の枠の数を引きつぐ(デッキは型ごとなので引きつがない)
const cardNormalizeAiRecipe2 = (raw, today, v1raw = null, db = (typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null)) => {
  if (!cardAiDeckIsObj(raw)) {
    const old = cardNormalizeAiRecipe(v1raw, today, db);
    const perWho = {};
    for (const [who, w] of Object.entries(old.perWho)) perWho[who] = { met: w.met, gamesSince: w.gamesSince, slotsDone: w.slotsDone, decks: {} };
    return { v: 2, day: typeof today === 'string' ? today : '', perWho };
  }
  const sameDay = typeof raw.day === 'string' && raw.day === today;
  const perWho = {};
  const src = cardAiDeckIsObj(raw.perWho) ? raw.perWho : {};
  for (const who of Object.keys(src)) {
    if (!CARD_AI_DECKS[who] || !cardAiDeckIsObj(src[who])) continue;
    const w = src[who];
    const decks = {};
    const ds = cardAiDeckIsObj(w.decks) ? w.decks : {};
    for (const slot of CARD_AI_FACE_SLOTS) { const e = cardAiDeckEntryOf(ds[slot], db); if (e) decks[slot] = e; }
    perWho[who] = { met: w.met === true, gamesSince: cardAiDeckCount(w.gamesSince, 9999), slotsDone: sameDay ? cardAiDeckCount(w.slotsDone, CARD_AI_DECK_SLOTS) : 0, decks };
  }
  return { v: 2, day: typeof today === 'string' ? today : '', perWho };
};
const cardNormalizeAiDeck = (v) => ({ on: !(cardAiDeckIsObj(v) && v.on === false) });

// ---- 時期 ----
// その日の3つの時刻(ミリ秒)。day は朝4時区切りの日付(84 の cardTodayJst)。種は端末の id と日付
const cardAiDeckSlotTimes = (day, seedKey = '') => {
  const start = Date.parse(`${day}T04:00:00+09:00`);
  if (!Number.isFinite(start)) return [];
  const rnd = cardAiSeededRand(`aideck:${seedKey}:${day}`);
  const span = 8 * 3600 * 1000;
  return [...Array(CARD_AI_DECK_SLOTS).keys()].map((i) => start + i * span + Math.floor(rnd() * span));
};
const cardAiDeckSlotsPassed = (times, now) => times.filter((t) => t <= now).length;
// その助手を組み直す時期か('slot' 時刻の枠を過ぎた / 'games' 10戦した / null まだ)。会った助手だけ
const cardAiDeckDue = (w, passed) => {
  if (!w || !w.met) return null;
  if (w.gamesSince >= CARD_AI_DECK_GAMES) return 'games';
  if (w.slotsDone < passed) return 'slot';
  return null;
};
// 今見えている3つ(推し・好き・素顔の今の側)のうち、いちばん古い物の保存の枠(まだ無い物がいちばん古い。同じなら 推し → 好き → 素顔)
const cardAiDeckOldest = (w, sugao = 'yoso') => {
  const decks = (w && w.decks) || {};
  const slots = ['oshi', 'suki', sugao === 'honne' ? 'honne' : 'yoso'];
  return slots.slice().sort((a, b) => ((decks[a] && decks[a].at) || 0) - ((decks[b] && decks[b].at) || 0))[0];
};

// ---- 揺らぎ(AI なしの組み直し) ----
// 前の方針(無ければ幅の真ん中・候補の上から)を、幅の中で少し動かす。prefer は候補から1〜2枚入れかえる。field はときどき入れかえる
const cardAiDeckJitter = (prev, { cands, fields, range, rnd }) => {
  const R = CARD_AI_PLAN_RANGE;
  const habit = {};
  for (const [k, [lo, hi]] of Object.entries(range || {})) {
    const base = prev && prev.habit && Number.isFinite(prev.habit[k]) ? prev.habit[k] : (lo + hi) / 2;
    const v = base + (rnd() * 2 - 1) * CARD_AI_DECK_JITTER * (hi - lo);
    habit[k] = Math.round(Math.min(hi, Math.max(lo, v)) * 100) / 100;
  }
  const pool = (cands || []).map((c) => c.no);
  let prefer = (prev && Array.isArray(prev.prefer) ? prev.prefer : []).filter((no) => pool.includes(no));
  if (!prefer.length) prefer = pool.slice(0, Math.min(R.prefer[1], 6));
  const swaps = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < swaps; i++) {
    const out = pool.filter((no) => !prefer.includes(no));
    if (!out.length || !prefer.length) break;
    prefer[Math.floor(rnd() * prefer.length)] = out[Math.floor(rnd() * out.length)];
  }
  prefer = [...new Set(prefer)].slice(0, R.prefer[1]);
  const fs = fields || [];
  let field = prev && Array.isArray(prev.field) ? prev.field.filter((n) => fs.includes(n)).slice(0, R.field[1]) : [];
  if (fs.length && (!field.length || rnd() < 0.3)) field = [fs[Math.floor(rnd() * fs.length)]];
  return { prefer, field, habit };
};

// ---- 材料(助手部の口。無ければ代わり) ----
// assistantLifeCardMaterial(id) → { core, likes, friendLv, mood, face? }。読むだけ。無い・壊れているときは代わり(仲良し度・気分なし)
const cardAiFaceMaterial = (who) => {
  let m = null;
  try { m = typeof assistantLifeCardMaterial === 'function' ? assistantLifeCardMaterial(who) : null; } catch (_) { m = null; }
  const ok = cardAiDeckIsObj(m);
  return {
    friendLv: ok && Number.isFinite(m.friendLv) ? m.friendLv : null,
    mood: ok && typeof m.mood === 'string' ? m.mood : null,
    face: ok ? cardAiFaceOf(m.face) : null,
  };
};
// 素顔は今どちらか('honne' | 'yoso')
const cardAiFaceSugaoSide = (mat) => (mat && Number.isFinite(mat.friendLv) && mat.friendLv >= CARD_AI_HONNE_LV ? 'honne' : 'yoso');
// 6割で出す顔(face を直接返せばそれ・気分の表・無ければ null=均等)
const cardAiFaceMain = (mat) => (mat ? (mat.face || cardAiFaceOf(CARD_AI_MOOD_FACE[mat.mood]) || null) : null);
// 顔 → 保存の枠
const cardAiFaceSlotOf = (face, side = 'yoso') => (face === 'sugao' ? (side === 'honne' ? 'honne' : 'yoso') : cardAiFaceOf(face));

// ---- 種の振り分け(3つのデッキのまわりの種を別々にする) ----
// 系統(混血はメインの系統)。カードの species
const cardAiFaceLineOf = (m) => (String(m.wave) === 'hybrid' ? m.main : m.species);
// 助手ごとに、系統を3つの組(推し・好き・素顔)へ振り分ける。主役の種はその組に置き、残りは強さ(MASTER の点数)の順に蛇行で配る
//   order … 蛇行の始まり(6通り)。返り値 { oshi: [系統…], suki: [...], sugao: [...] }(組の中は強い順)
const CARD_AI_FACE_ORDERS = Object.freeze([['sugao', 'oshi', 'suki'], ['oshi', 'suki', 'sugao'], ['sugao', 'suki', 'oshi'], ['suki', 'oshi', 'sugao'], ['oshi', 'sugao', 'suki'], ['suki', 'sugao', 'oshi']]);
const cardAiFaceGroupsBy = (db, who, order) => {
  const t = CARD_AI_FACES[who] || CARD_AI_FACES.mua;
  const mons = Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && !m.variant && String(m.wave) !== 'hybrid');
  const lines = [...new Set(mons.map((m) => m.species))];
  const fixed = { oshi: [t.oshi.lead], suki: [t.suki.lead], sugao: [t.yoso.lead, t.honne.lead].filter(Boolean) };
  const groups = { oshi: [], suki: [], sugao: [] };
  const placed = new Set();
  for (const g of CARD_AI_FACE_IDS) for (const sp of fixed[g]) if (sp && lines.includes(sp) && !placed.has(sp)) { groups[g].push(sp); placed.add(sp); }
  const v = Object.fromEntries(lines.map((sp) => [sp, Math.max(...mons.filter((m) => m.species === sp).map((m) => cardAiMonScore(db, who, m, 99, 'master')))]));
  const rest = lines.filter((sp) => !placed.has(sp)).sort((a, b) => v[b] - v[a] || (a < b ? -1 : 1));
  const snake = [...order, ...order.slice().reverse()];
  rest.forEach((sp, i) => { groups[snake[i % snake.length]].push(sp); });
  // 組の中は強い順(主役を決めていない顔は、組の先頭を主役にする)
  for (const g of CARD_AI_FACE_IDS) groups[g].sort((a, b) => v[b] - v[a] || (a < b ? -1 : 1));
  return groups;
};
// その顔で組むときの主役と使わない系統(82 の cardAiBuildDeck の opts.face)・くせの型
//   lead が null の顔(よそいき・本音の一部)は、組の中でいちばん強い系統。groups・free を渡さなければ、決めた振り分け(cardAiFaceLayout)
const cardAiFaceSpec = (db, who, slot, freeIn = null, groupsIn = null) => {
  const t = CARD_AI_FACES[who] || CARD_AI_FACES.mua;
  const row = t[slot] || t.oshi;
  const face = slot === 'yoso' || slot === 'honne' ? 'sugao' : slot;
  const lay = groupsIn ? null : cardAiFaceLayout(db, who);
  const groups = groupsIn || lay.groups;
  const mine = groups[face] || [];
  const lead = row.lead && mine.includes(row.lead) ? row.lead : mine[0] || null;
  const avoid = CARD_AI_FACE_IDS.filter((g) => g !== face).flatMap((g) => groups[g]);
  // ほかの2つの顔の主役(素顔は よそいき・本音 の両方)。仲間の1体目はこれだけを避ける
  const keep = CARD_AI_FACE_IDS.filter((g) => g !== face).flatMap((g) => (g === 'sugao' ? [t.yoso.lead || groups.sugao[0], t.honne.lead || groups.sugao[0]] : [t[g].lead])).filter(Boolean);
  const free = Number.isInteger(freeIn) ? freeIn : ((lay && lay.free[slot]) || 0);
  return { face, slot, lead, avoid, keep: [...new Set(keep)], free, style: cardAiStyleOf(row.style) || 'normal', nick: row.nick || null };
};
// 振り分けを決める(助手ごと)。蛇行の始まり6通りを順に試し、それぞれで「仲間の1体目を組の外からも選ぶか(顔ごと 1/0)」を決める。
//   選べると強くなるが、ほかの顔と重なりやすい。MASTER で組んでみて、見える組み合わせ(推し・好き・素顔の今の側)が
//   「カード4割まで・主役2体以上ちがう」を破れば、大事な順の低い側を 0 にする(推し → よそいき → 好き → 本音)。全部守れた最初の振り分けを使う
//   返り値 { groups, free, order, ok }。同じ db・同じ助手ならいつも同じ(保存しない)
const CARD_AI_FACE_RANK = Object.freeze(['oshi', 'yoso', 'suki', 'honne']);
const CARD_AI_FACE_PAIRS = Object.freeze([['oshi', 'suki'], ['oshi', 'yoso'], ['suki', 'yoso'], ['oshi', 'honne'], ['suki', 'honne']]);
const cardAiFaceLayoutMemo = {};
const cardAiFaceLayout = (db, who) => {
  const key = `${who}:${Object.keys(db.monsters).length}`;
  if (cardAiFaceLayoutMemo[key]) return cardAiFaceLayoutMemo[key];
  let last = null;
  for (let oi = 0; oi < CARD_AI_FACE_ORDERS.length; oi++) {
    const groups = cardAiFaceGroupsBy(db, who, CARD_AI_FACE_ORDERS[oi]);
    const free = { oshi: 1, suki: 1, yoso: 1, honne: 1 };
    const deckOf = (slot) => cardAiFaceBuildWith(db, who, cardAiFaceSpec(db, who, slot, free[slot], groups), 'master', cardAiSeededRand(`face:${who}:${slot}:master`), {}, null);
    let ok = false;
    for (let round = 0; round < 8; round++) {
      const d = Object.fromEntries(CARD_AI_FACE_SLOTS.map((sl) => [sl, deckOf(sl)]));
      const bad = CARD_AI_FACE_PAIRS.find(([a, b]) => cardAiFaceShare(d[a], d[b]) > CARD_AI_FACE_SHARE_MAX || cardAiFaceTrioDiff(d[a], d[b]) < CARD_AI_FACE_TRIO_DIFF);
      if (!bad) { ok = true; break; }
      const loser = [...bad].sort((x, y) => CARD_AI_FACE_RANK.indexOf(y) - CARD_AI_FACE_RANK.indexOf(x)).find((sl) => free[sl]);
      if (!loser) break;
      free[loser] = 0;
    }
    last = { groups, free, order: oi, ok };
    if (ok) break;
  }
  cardAiFaceLayoutMemo[key] = last;
  return last;
};
const cardAiFaceGroups = (db, who) => cardAiFaceLayout(db, who).groups;
const cardAiFaceFreeMap = (db, who) => cardAiFaceLayout(db, who).free;

// ---- 名前 ----
// 既定の名前(AI が名前を付けられない・見張りに落ちたとき)。よそいきは今の8つの名前
const cardAiFaceDefaultName = (who, slot) => {
  const t = CARD_AI_FACES[who];
  if (!t) return null;
  if (slot === 'yoso') return CARD_AI_STYLE_NAMES[who] || null;
  return (t[slot] && t[slot].name) || null;
};
// 2つの名前に同じことばがあるか(ひらがなだけの2文字までは「の」「と」などのつなぎとみなす。かな以外を含む2文字以上・ひらがな3文字以上が同じなら同じことば)
const cardAiFaceShareWord = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  for (let i = 0; i < a.length; i++) {
    for (let n = 2; i + n <= a.length; n++) {
      const w = a.slice(i, i + n);
      if (/^[ぁ-ゟ]+$/.test(w) && w.length < 3) continue;
      if (/^[\s・!！?？♪♡〜ー]+$/.test(w)) continue;
      if (b.includes(w)) return true;
    }
  }
  return false;
};
// AI が付けた名前が決まりに合うか(社長 Q2 A): 型のことば(攻め・守り・ふつう)と「・〇〇」を付けない/ほかの3つ(素顔は よそいき・本音 の両方)と同じことばを使わない/
//   推し・好きは主役(愛称か種の名前。表の words は遊び方のことば)が入る。合わなければ既定の名前
//   「・〇〇」は今の8つの名前に添える形(「キラキラ速攻・攻め」など)のこと。今の名前の「ステージ・オン」は使ってよい
const cardAiFaceNameOk = (db, who, slot, name, others = []) => {
  if (typeof name !== 'string' || !name) return false;
  const base = CARD_AI_STYLE_NAMES[who];
  if (/攻め|守り|ふつう/.test(name) || (base && name.startsWith(`${base}・`))) return false;
  if (others.some((o) => cardAiFaceShareWord(name, o))) return false;
  if (slot === 'oshi' || slot === 'suki') {
    const spec = cardAiFaceSpec(db, who, slot);
    const mon = Object.values(db.monsters).find((m) => m.species === spec.lead && !m.variant);
    const row = (CARD_AI_FACES[who] || {})[slot] || {};
    const words = [spec.nick, mon && mon.name, ...(Array.isArray(row.words) ? row.words : [])].filter(Boolean);
    if (!words.some((w) => name.includes(w))) return false;
  }
  return true;
};
// 今の名前(保存した名前か既定)。others を作るのに使う
const cardAiFaceNameOf = (w, who, slot) => (w && w.decks && w.decks[slot] && w.decks[slot].name) || cardAiFaceDefaultName(who, slot);
const cardAiFaceOtherNames = (w, who, slot) => CARD_AI_FACE_SLOTS.filter((s) => s !== slot && !((slot === 'yoso' && s === 'honne') || (slot === 'honne' && s === 'yoso'))).map((s) => cardAiFaceNameOf(w, who, s)).filter(Boolean);

// ---- 対戦で出す顔 ----
// main(今の気分・仲良し度に合う顔)を6割・ほかの2つを2割ずつ。main が無ければ3つ均等
const cardAiDeckPickFace = (main, rnd) => {
  const r = rnd();
  const m = cardAiFaceOf(main);
  if (!m) return CARD_AI_FACE_IDS[Math.min(CARD_AI_FACE_IDS.length - 1, Math.floor(r * CARD_AI_FACE_IDS.length))];
  if (r < CARD_AI_DECK_MAIN) return m;
  const others = CARD_AI_FACE_IDS.filter((s) => s !== m);
  return others[(r - CARD_AI_DECK_MAIN) < (1 - CARD_AI_DECK_MAIN) / 2 ? 0 : 1];
};

// ---- 組む(読むだけ) ----
// その枠のデッキを組む。plan は保存した方針(無ければ型だけ)。level は 82 の強さ
//   弾の少ない強さ(EASY〜HARD)では組の中に使える種が足りず、3体そろわないことがある。そのときは、ほかの2つの主役だけを避けて組み直す
const cardAiFaceBuild = (db, who, slot, level, rnd, extra = {}, plan = null) => cardAiFaceBuildWith(db, who, cardAiFaceSpec(db, who, slot), level, rnd, extra, plan);
const cardAiFaceBuildWith = (db, who, spec, level, rnd, extra = {}, plan = null) => {
  const lv = CARD_AI_BUILD[level] ? level : 'normal';
  const opts = (avoid) => ({ ...extra, style: spec.style, face: { lead: spec.lead, avoid, keep: spec.keep, free: spec.free }, ...(plan ? { plan } : {}) });
  const deck = cardAiBuildDeck(db, who, lv, rnd, opts(spec.avoid));
  if (deck.monsters.length >= 3) return deck;
  return cardAiBuildDeck(db, who, lv, rnd, opts(spec.keep));
};
// 見せる・くらべるためのデッキ(毎回同じ並び。MASTER の種で組む)
const cardAiFacePreviewDeck = (db, who, slot, plan = null, level = 'master') => cardAiFaceBuild(db, who, slot, level, cardAiSeededRand(`face:${who}:${slot}:${level}`), {}, plan);
// 2つのデッキの同じカードの割合(枚数の重なり / 50)と、主役3体のちがう数
const cardAiFaceShare = (a, b) => {
  const cnt = (cards) => cards.reduce((m, no) => { m[no] = (m[no] || 0) + 1; return m; }, {});
  const ca = cnt(a.cards), cb = cnt(b.cards);
  const same = Object.keys(ca).reduce((s, no) => s + Math.min(ca[no], cb[no] || 0), 0);
  return same / Math.max(1, Math.max(a.cards.length, b.cards.length));
};
const cardAiFaceTrioDiff = (a, b) => a.monsters.filter((no) => !b.monsters.includes(no)).length;

// ---- 中継役へ送る材料(数字と名前だけ) ----
// 候補はその顔の3体(プレビューと同じ種)で組んだときの上位の札。場のカードは全部。主役・方針・話し方の手がかりも送る
const CARD_AI_FACE_POLICY = Object.freeze({
  oshi: '推しのモンスターが主役。推しが活躍できるカードを優先する',
  suki: '好きなモンスターが主役。そのモンスターらしさが出るカードを優先する',
  yoso: 'よそいきの組み方。ふだんどおりの、無難で強い組み方',
  honne: '本音の組み方。ふだんはやらないけれど、ほんとはやってみたい組み方',
});
const cardAiDeckFacts = (db, who, slot) => {
  const spec = cardAiFaceSpec(db, who, slot);
  const trio = cardAiFacePreviewDeck(db, who, slot).monsters;
  const cands = cardAiPlanCandidates(db, who, 'master', trio);
  const fields = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld').map((c) => c.name);
  const leadMon = trio.map((no) => db.monsters[no]).find((m) => m && cardAiFaceLineOf(m) === spec.lead);
  return {
    trio, cands, fields, spec,
    range: cardAiPlanHabitRange(who, 'master', spec.style),
    facts: {
      style: spec.style,
      face: spec.face, side: slot === 'yoso' || slot === 'honne' ? slot : null,
      lead: spec.nick || (leadMon && leadMon.name) || null,
      policy: CARD_AI_FACE_POLICY[slot] || null,
      favorites: trio.map((no) => (db.monsters[no] || {}).name).filter(Boolean).slice(0, 5),
      cards: cands.map((c) => ({ no: c.no, name: c.name, kind: c.kind, guts: c.guts, damage: Number.isFinite(c.damage) ? c.damage : null, user: c.user, area: !!cardHasEff(c, 'area') })),
      fields,
      habit: cardAiPlanHabitRange(who, 'master', spec.style),
      prefer: CARD_AI_PLAN_RANGE.prefer.slice(),
    },
  };
};

// ---- 動かす側(ブラウザ) ----
// 使ってよいか: 公開の印(84 の cardGrowStyleOn・カードより後で決まるので呼ぶ時に確かめる)
const cardAiDeckFlagOn = () => { try { return typeof cardGrowStyleOn === 'function' && cardGrowStyleOn() === true; } catch (_) { return false; } };
// いまの保存(トップの画面などが読み込んだらここへ置く)と入/切
let cardAiRecipeState = null;
let cardAiDeckSetting = { on: true };
const cardAiDeckToday = () => (typeof cardTodayJst === 'function' ? cardTodayJst() : new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10));
// 保存を読む(v2。無ければ v1 を読むだけで引きつぐ)
const cardAiRecipeRead = async () => {
  const raw = await storeGet(CARD_AI_RECIPE2_KEY, null).catch(() => null);
  const v1 = cardAiDeckIsObj(raw) ? null : await storeGet(CARD_AI_RECIPE_KEY, null).catch(() => null);
  return cardNormalizeAiRecipe2(raw, cardAiDeckToday(), v1);
};
const cardLoadAiRecipe = async () => {
  try { cardAiRecipeState = await cardAiRecipeRead(); } catch (_) { cardAiRecipeState = cardNormalizeAiRecipe2(null, cardAiDeckToday()); }
  try { cardAiDeckSetting = cardNormalizeAiDeck(await storeGet(CARD_AI_DECK_KEY, null)); } catch (_) { cardAiDeckSetting = { on: true }; }
  return cardAiRecipeState;
};
const cardSaveAiRecipe = async (next) => {
  cardAiRecipeState = next;
  try { return await storeSet(CARD_AI_RECIPE2_KEY, next); } catch (_) { return false; }
};
const cardSaveAiDeck = async (on) => {
  cardAiDeckSetting = { on: !!on };
  try { await storeSet(CARD_AI_DECK_KEY, cardAiDeckSetting); } catch (_) { /* 入/切が保存できなくても遊べる */ }
  return cardAiDeckSetting;
};
// AI に聞いてよいか(印・入/切・おしゃべりの AI を呼べる端末か)。だめなら揺らぎで組む
const cardAiDeckAskOn = () => cardAiDeckFlagOn() && cardAiDeckSetting.on !== false && typeof cardTalkOpen === 'function' && cardTalkOpen();
// 中継役に方針を聞く。届かなければ null(上限 tired・遅れ sorry・失敗も null)
const cardAiDeckFetch = async (who, facts) => {
  if (!cardAiDeckAskOn() || typeof fetch === 'undefined') return null;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ac) ac.abort(); }, CARD_AI_DECK_WAIT_MS);
  try {
    const breederId = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
    const samples = typeof cardTalkSamples === 'function' ? cardTalkSamples(who, 'challenge') : [];
    const r = await fetch(CARD_TALK_URL, {
      method: 'POST', headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'deckPlan', breederId: breederId || 'unknown', assistantId: who, samples, facts }), signal: ac ? ac.signal : undefined,
    });
    const res = r.ok ? await r.json() : null;
    if (!res || res.ok !== true || res.kind !== 'plan') return null;
    return { plan: { prefer: Array.isArray(res.prefer) ? res.prefer : [], field: Array.isArray(res.field) ? res.field : [], habit: cardAiDeckIsObj(res.habit) ? res.habit : {} },
      name: cardAiDeckText(res.name, CARD_AI_DECK_NAME_MAX), line: cardAiDeckText(res.line, CARD_AI_DECK_LINE_MAX) };
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
// 組み直した方針が、ほかの2つと重なりすぎないか(カード4割まで・主役3体は2体以上ちがう)。だめなら前の方針(無ければ型だけ)へ戻す
const cardAiFaceDiverseOk = (db, who, slot, plan, w, side) => {
  const mine = cardAiFacePreviewDeck(db, who, slot, plan);
  const others = ['oshi', 'suki', side === 'honne' ? 'honne' : 'yoso'].filter((s) => s !== slot && !((slot === 'yoso' || slot === 'honne') && (s === 'yoso' || s === 'honne')));
  return others.every((s) => {
    const e = w && w.decks && w.decks[s];
    const d = cardAiFacePreviewDeck(db, who, s, e && e.plan);
    return cardAiFaceShare(mine, d) <= CARD_AI_FACE_SHARE_MAX && cardAiFaceTrioDiff(mine, d) >= CARD_AI_FACE_TRIO_DIFF;
  });
};
// 1人の助手の、いちばん古い顔を組み直す(AI か揺らぎ)。reason: 'slot'(時刻の枠)/'games'(10戦)
const cardAiDeckBusy = new Set();
const cardAiDeckRebuild = async (who, reason, opts = {}) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || !CARD_AI_FACES[who] || cardAiDeckBusy.has(who) || typeof CARD_BATTLE_DATA === 'undefined') return null;
  cardAiDeckBusy.add(who);
  try {
    const db = CARD_BATTLE_DATA;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const side = cardAiFaceSugaoSide(cardAiFaceMaterial(who));
    // いちばん古い顔は、保存を読み直してから選ぶ(手元の控えが古いことがある)
    const before = await cardAiRecipeRead();
    const slot = cardAiDeckOldest(before.perWho[who] || null, side);
    const f = cardAiDeckFacts(db, who, slot);
    const got = await cardAiDeckFetch(who, f.facts);
    // 読み直してから書く(待っているあいだにほかの所が書いたぶんを消さない)
    const cur = await cardAiRecipeRead();
    const w = cur.perWho[who] || { met: true, gamesSince: 0, slotsDone: 0, decks: {} };
    const prev = w.decks[slot] || null;
    const jitter = () => cardAiDeckJitter(prev && prev.plan, { cands: f.cands, fields: f.fields, range: f.range, rnd: cardAiSeededRand(`jitter:${who}:${slot}:${now}`) });
    let plan = got && cardAiPlanClean(db, got.plan) ? got.plan : jitter();
    // 重なりの見張り(社長 Q3 A)。AI の方針が重なりすぎたら揺らぎ、それもだめなら前の方針(無ければ方針なし=型だけ)
    if (!cardAiFaceDiverseOk(db, who, slot, plan, w, side)) {
      const j = jitter();
      plan = cardAiFaceDiverseOk(db, who, slot, j, w, side) ? j : (prev && prev.plan) || null;
    }
    const others = cardAiFaceOtherNames(w, who, slot);
    const name = got && cardAiFaceNameOk(db, who, slot, got.name, others) ? got.name : (prev && prev.name && cardAiFaceNameOk(db, who, slot, prev.name, others) ? prev.name : null);
    const entry = cardAiDeckEntryOf({ plan, name, line: got ? got.line : (prev && prev.line), at: now, ai: !!got }, db);
    const passed = Number.isFinite(opts.passed) ? opts.passed : w.slotsDone;
    const nextW = { ...w, met: true, decks: { ...w.decks, [slot]: entry }, gamesSince: reason === 'games' ? 0 : w.gamesSince, slotsDone: reason === 'slot' ? Math.max(w.slotsDone, passed) : w.slotsDone };
    await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: nextW } });
    return { who, slot, ai: !!got };
  } catch (_) { return null; } finally { cardAiDeckBusy.delete(who); }
};
// 時期が来た助手を、裏で1人ずつ組み直す(カードのトップを開いたとき。対戦の前・待たせない所)
const cardAiDeckRunDue = async (opts = {}) => {
  if (!cardAiDeckFlagOn()) return [];
  await cardLoadAiRecipe();
  const now = Number.isFinite(opts.now) ? opts.now : Date.now();
  let seedKey = '';
  try { seedKey = typeof ensureBreederId === 'function' ? String(await ensureBreederId()) : ''; } catch (_) { seedKey = ''; }
  const passed = cardAiDeckSlotsPassed(cardAiDeckSlotTimes(cardAiRecipeState.day, seedKey), now);
  const done = [];
  for (const who of Object.keys(cardAiRecipeState.perWho)) {
    const w = cardAiRecipeState.perWho[who];
    const why = cardAiDeckDue(w, passed) || (w.met && !Object.keys(w.decks).length ? 'first' : null);
    if (!why) continue;
    const r = await cardAiDeckRebuild(who, why === 'first' ? 'slot' : why, { now, passed });
    if (r) done.push(r);
  }
  return done;
};
// 会った印(相手えらびで選んだ・部屋を開いた)。印が偽なら何もしない。まだデッキが無ければ裏で1つ組む
const cardAiDeckMarkMet = async (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who]) return false;
  const cur = await cardAiRecipeRead();
  const w = cur.perWho[who];
  if (w && w.met && Object.keys(w.decks).length) { cardAiRecipeState = cur; return true; }
  await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: { gamesSince: 0, slotsDone: 0, decks: {}, ...(w || {}), met: true } } });
  void cardAiDeckRebuild(who, 'slot');
  return true;
};
// その助手と1戦し終えた(助手と対戦の結果を書いたあと)。10戦で裏で組み直す
const cardAiDeckAfterMatch = async (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who]) return null;
  const cur = await cardAiRecipeRead();
  const w = cur.perWho[who] || { met: true, gamesSince: 0, slotsDone: 0, decks: {} };
  const nextW = { ...w, met: true, gamesSince: w.gamesSince + 1 };
  await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: nextW } });
  if (nextW.gamesSince >= CARD_AI_DECK_GAMES) void cardAiDeckRebuild(who, 'games');
  return nextW.gamesSince;
};
// 今日のデッキ(助手と対戦で次に出す顔)。相手えらびで見せた顔と、対戦で出す顔をそろえるため、先に決めて持っておく(1戦し終えたら決め直す)
//   ブラウザを閉じれば決め直し(保存しない)。印が偽なら null。名前は前と同じ cardAiDeckNextStyle(84 が呼ぶ)
const cardAiDeckNextMemo = {};
const cardAiDeckNextStyle = (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || !CARD_AI_FACES[who]) return null;
  if (!cardAiDeckNextMemo[who]) cardAiDeckNextMemo[who] = cardAiDeckPickFace(cardAiFaceMain(cardAiFaceMaterial(who)), Math.random);
  return cardAiDeckNextMemo[who];
};
// 今の気分・仲良し度に合う顔(6割で出す顔。部屋のタブの「よく使う」)。分からなければ null。印が偽なら null
const cardAiDeckMainFace = (who) => (cardAiDeckFlagOn() && CARD_AI_FACES[who] ? cardAiFaceMain(cardAiFaceMaterial(who)) : null);
// 顔の今の名前(保存した名前、無ければ既定)。素顔は今の側(よそいき・本音)
const cardAiFaceName = (who, face) => {
  const slot = cardAiFaceSlotOf(face, cardAiFaceSugaoSide(cardAiFaceMaterial(who)));
  if (!slot) return null;
  return cardAiFaceNameOf(cardAiRecipeState && cardAiRecipeState.perWho[who], who, slot);
};
// 今日のデッキの名前(相手えらびの札用)
const cardAiDeckNextName = (who) => {
  const face = cardAiDeckNextStyle(who);
  return face ? cardAiFaceName(who, face) : null;
};
// 1戦し終えた(または対戦を始めた)ら、次の対戦の顔を決め直す
const cardAiDeckNextDone = (who) => { delete cardAiDeckNextMemo[who]; };
// 対戦で出すデッキ(読むだけ。助手と対戦の 84 と、助手どうしの対戦(助手ライフ)が使う)。印が偽なら null(呼ぶ側は今の組み方)
//   返り値 { styleId: 顔('oshi'|'suki'|'sugao'), slot: 保存の枠, name, line, plan, deck }。deck は cardAiBuildDeck の物(level は既定 'normal')
//   faceIn を渡せばその顔(84 は相手えらびで見せた今日のデッキ cardAiDeckNextStyle を渡す)。渡さなければ今の気分に合う顔6割・ほか2割ずつ
const cardAssistantDeckPick = (who, rand = Math.random, level = 'normal', extra = {}, faceIn = null) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || !CARD_AI_FACES[who] || typeof CARD_BATTLE_DATA === 'undefined') return null;
  const rnd = typeof rand === 'function' ? rand : Math.random;
  const mat = cardAiFaceMaterial(who);
  const face = cardAiFaceOf(faceIn) || cardAiDeckPickFace(cardAiFaceMain(mat), rnd);
  const slot = cardAiFaceSlotOf(face, cardAiFaceSugaoSide(mat));
  const w = cardAiRecipeState && cardAiRecipeState.perWho[who];
  const e = (w && w.decks[slot]) || null;
  const plan = e && e.plan ? e.plan : null;
  const deck = cardAiFaceBuild(CARD_BATTLE_DATA, who, slot, level, rnd, extra, plan);
  return { styleId: face, slot, name: cardAiFaceNameOf(w, who, slot), line: (e && e.line) || null, plan, deck };
};
// 保存してある顔のデッキ(読むだけ)。印が偽なら null
const cardAiRecipeOf = (who, face) => {
  if (!cardAiDeckFlagOn() || !cardAiRecipeState) return null;
  const slot = cardAiFaceSlotOf(face, cardAiFaceSugaoSide(cardAiFaceMaterial(who)));
  const e = slot && cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[slot];
  return e ? { plan: e.plan, name: e.name, line: e.line, at: e.at } : null;
};
// 顔のデッキの中身(見せる用。87 のデッキの欄・56 の部屋のタブ)。返り値 { monsters, cards, styleId: 顔, slot, side, name, line, at }。助手でない・印が偽なら null
const cardAssistantFacePreview = (who, face, level = 'normal') => {
  if (!cardAiDeckFlagOn() || !CARD_AI_FACES[who] || typeof CARD_BATTLE_DATA === 'undefined') return null;
  const f = cardAiFaceOf(face) || 'oshi';
  const side = cardAiFaceSugaoSide(cardAiFaceMaterial(who));
  const slot = cardAiFaceSlotOf(f, side);
  const e = cardAiRecipeState && cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[slot];
  const deck = cardAiFacePreviewDeck(CARD_BATTLE_DATA, who, slot, e && e.plan, CARD_AI_BUILD[level] ? level : 'normal');
  return { monsters: deck.monsters.slice(), cards: deck.cards.slice(), styleId: f, slot, side: f === 'sugao' ? side : null,
    name: cardAiFaceNameOf(cardAiRecipeState && cardAiRecipeState.perWho[who], who, slot), line: (e && e.line) || null, at: (e && e.at) || 0 };
};
// VS の画面で助手が言うひとこと。AI の line があればそれ、無ければ助手ごとの既定({name} にデッキの名前)
//   既定の言い方は、各助手の話し方に合わせた部長の案(社長の「この文で」待ち)。表情は happy
const CARD_AI_DECK_VS_LINES = Object.freeze({
  mua: '今日は『{name}』でいくよ♪ まぢ全力だからね！',
  kiki: '今日は『{name}』でお相手しまつ( ˘ω˘)',
  momosuke: '今日のももは『{name}』だよ♡ 勝てるかな〜？w',
  kyuko: 'ほい、今日は『{name}』でいくよぉ笑',
  dra: 'おでは今日『{name}』でいくぞ。えへへ、手加減しないからな',
  atsu: '今日は『{name}』でいくわ笑 全力な！',
  sorashido: '今日は『{name}』でいくぜ・・・！ 計算済み笑',
  erubin: '今日は『{name}』でいこうかな🤔 よろしくね笑',
});
const cardAiDeckVsLine = (who, pick) => {
  if (!pick) return null;
  if (pick.line) return { t: pick.line, e: 'happy' };
  const tpl = CARD_AI_DECK_VS_LINES[who];
  return tpl && pick.name ? { t: tpl.replace('{name}', pick.name), e: 'happy' } : null;
};
