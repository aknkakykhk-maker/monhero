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
const CARD_AI_HISTORY_KEY = CARD_SAVE_KEYS.aiDeckHistory; // mh_card_ai_deck_history_v1
const CARD_AI_HISTORY_MAX = 10;     // 「これまでのデッキ」は助手ごとに10個まで(11個目で一番古いものが消える。社長 2026-11-08 Q1)
const CARD_AI_RENAME_SHARE = 0.8;   // 組み直しの印: 主役の3体のうち1体以上が変わるか、札が2割以上入れかわったら新しい名前(社長 Q3 A)
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
// 助手ごとの表。lead … 主役の種(カードの species。null は組の中でいちばん強い種)
//   style … くせの倍率(82 の CARD_AI_STYLE_TUNE。'normal' は今と同じ) / name … 既定の名前(2026-11-08 社長「この名前で作る」)
//   ★名前にマスモンの愛称を使わない(社長「既定の名前は愛称を使わない名前に」。愛称は人ごとに違い、引き直しもある)。主役は種の名前で書く
//   よそいき(yoso)の名前は今の8つの名前(82 の CARD_AI_STYLE_NAMES)。好きの種は、カードに無い種を部長の判断で近い種にした(みゅあ: イブリス→ジョーカー・きき: ザン→ライガー)
const CARD_AI_FACES = Object.freeze({
  mua: { oshi: { lead: 'mocchi', style: 'normal', name: '剣士モッチーの一番乗り' }, suki: { lead: 'joker', words: ['イブリス'], style: 'normal', name: 'イブリスとちょい悪ナイト' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ノリだけで全力突破' } },
  kiki: { oshi: { lead: 'golem', style: 'normal', name: 'ゴーレムの一撃' }, suki: { lead: 'tiger', style: 'normal', name: 'ライガーの桜吹雪' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ぜんぶ必殺技でつ' } },
  momosuke: { oshi: { lead: 'metalner', style: 'normal', name: 'メタルナーの銀ピカライブ' }, suki: { lead: 'mew', style: 'normal', name: 'ニャーとおやすみソング' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'ぜんぶ見せ場♡' } },
  dra: { oshi: { lead: 'zilla', style: 'normal', name: 'グジラとどっしり行進' }, suki: { lead: 'suezo', style: 'normal', name: 'スエゾーのギャグ劇場' }, yoso: { lead: null, style: 'normal' }, honne: { lead: 'golem', style: 'attack', name: 'おでの大ぶり勝負' } },
  atsu: { oshi: { lead: 'dragon', style: 'normal', name: 'ドラゴンで正面突破' }, suki: { lead: 'mocchi', style: 'normal', name: 'モッチーに続け' }, yoso: { lead: null, style: 'normal' }, honne: { lead: 'ghost', style: 'normal', name: 'こっそり奇襲作戦' } },
  kyuko: { oshi: { lead: 'mew', style: 'normal', name: 'ニャーの気まぐれ一手' }, suki: { lead: 'pixie', style: 'normal', name: 'ピクシーのわがまま作戦' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: '直感だけで全部いく' } },
  // ソラシドの本音は 2026-11-08 社長の答えで「ソロバン抜きの一発勝負」から差し替え(マスモンの愛称「ソロバン」と同じことばだった)
  sorashido: { oshi: { lead: 'hare', style: 'normal', name: 'ハムで大混乱' }, suki: { lead: 'kyubi', style: 'normal', name: 'キュービの推し活' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: '表なしの一発勝負' } },
  erubin: { oshi: { lead: 'durahan', style: 'guard', name: 'デュラハンの盾の陣' }, suki: { lead: 'pixie', style: 'normal', name: 'ピクシーの応援団' }, yoso: { lead: null, style: 'normal' }, honne: { lead: null, style: 'attack', name: 'たまには剣だけで' } },
});
// 素顔が本音になる仲良し度(助手部の口の friendLv。アプリの仲良し度の段 1〜。4 は「相棒」)。口が無ければ よそいき のまま
const CARD_AI_HONNE_LV = 4;
// 気分(助手ライフの ASSISTANT_LIFE_MOODS)→ 6割で出す顔。ねむい・知らない気分は均等(部長の確認待ちの案)
const CARD_AI_MOOD_FACE = Object.freeze({ eager: 'oshi', happy: 'suki', lonely: 'suki', restless: 'sugao', sulky: 'sugao' });

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
  const since = Number.isFinite(raw.since) && raw.since > 0 ? Math.floor(raw.since) : at;
  // style … 遊ぶ人の提案(助手部の口 assistantLifeDeckWish の plan)で寄せた組み方。無ければ顔の表のまま(項目を持たない)
  const style = cardAiStyleOf(raw.style);
  // wish … 遊ぶ人の提案の名前で付いたデッキ(初めて戦うときの台詞に使う)
  return { plan, name: cardAiDeckText(raw.name, CARD_AI_DECK_NAME_MAX), line: cardAiDeckText(raw.line, CARD_AI_DECK_LINE_MAX), at, since, ai: raw.ai === true, ...(style ? { style } : {}), ...(raw.wish === true ? { wish: true } : {}) };
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
  return { face, slot, lead, avoid, keep: [...new Set(keep)], free, style: cardAiStyleOf(row.style) || 'normal' };
};
// 振り分けを決める(助手ごと)。蛇行の始まり6通りを順に試し、それぞれで「仲間の1体目を組の外からも選ぶか(顔ごと 1/0)」を決める。
//   選べると強くなるが、ほかの顔と重なりやすい。MASTER で組んでみて、見える組み合わせ(推し・好き・素顔の今の側)が
//   「カード4割まで・主役2体以上ちがう」を破れば、大事な順の低い側を 0 にする(推し → よそいき → 好き → 本音)。全部守れた最初の振り分けを使う
//   返り値 { groups, free, order, ok }。同じ db・同じ助手ならいつも同じ(保存しない)
// 強さのそろえ(社長の案B・最後の手)。振り分けで ±10点に入らなかった顔だけ、組み方の雑さ(82 の noise)を足す。{ 助手: { 枠: { 強さ: 足す数 } } }。
//   足すと弱くなる。0.05 は MASTER の雑さと同じくらい。表は docs/progress/card-ai-faces/README.md
const CARD_AI_FACE_NOISE = Object.freeze({
  sorashido: { yoso: { master: 0.3 } }, // よそいきの MASTER 70% → 54%(今の組み方 48%。1組300戦)
});
// 決めた振り分け(2026-11-08 自動で探した結果。EXPERT・MASTER で、どの顔もその助手の今の勝率に近い物。docs/progress/card-ai-faces/README.md の強さの表)
//   探し方: 蛇行6通り+混ぜた割り当てから始め、2つの組の種を1つずつ入れかえて、いちばんずれの小さい物を残した(作業場所の道具。1組60戦)
//   使う前に、決まり(重なり4割まで・主役2体以上ちがう)と、カードの種と合っているかを確かめる。合わなければ、下の手順で探し直す
const CARD_AI_FACE_LAYOUTS = Object.freeze({
  mua: { oshi: ['mocchi', 'metalner', 'golem', 'hare', 'centaur', 'worm', 'mew', 'arrowhead', 'zilla'], suki: ['joker', 'henger', 'dino', 'dragon', 'kyubi', 'ghost', 'gali', 'colorpandora', 'plant'], sugao: ['tiger', 'durahan', 'naga', 'phoenix', 'pixie', 'jell', 'monol', 'suezo'], free: { oshi: 0, suki: 0, yoso: 0, honne: 1 } },
  kiki: { oshi: ['golem', 'durahan', 'gali', 'phoenix', 'mew', 'metalner', 'suezo', 'monol', 'ghost'], suki: ['dragon', 'worm', 'henger', 'tiger', 'zilla', 'centaur', 'mocchi', 'pixie', 'joker'], sugao: ['hare', 'dino', 'naga', 'kyubi', 'jell', 'arrowhead', 'colorpandora', 'plant'], free: { oshi: 1, suki: 0, yoso: 0, honne: 0 } },
  momosuke: { oshi: ['durahan', 'metalner', 'ghost', 'dino', 'mocchi', 'dragon', 'naga', 'monol', 'joker'], suki: ['tiger', 'centaur', 'kyubi', 'phoenix', 'colorpandora', 'mew', 'worm', 'jell', 'gali'], sugao: ['henger', 'hare', 'golem', 'plant', 'suezo', 'pixie', 'arrowhead', 'zilla'], free: { oshi: 0, suki: 0, yoso: 1, honne: 1 } },
  dra: { oshi: ['tiger', 'phoenix', 'hare', 'worm', 'mew', 'jell', 'plant', 'zilla', 'monol'], suki: ['dragon', 'durahan', 'dino', 'kyubi', 'centaur', 'arrowhead', 'suezo', 'ghost', 'colorpandora'], sugao: ['henger', 'golem', 'metalner', 'mocchi', 'pixie', 'gali', 'naga', 'joker'], free: { oshi: 1, suki: 1, yoso: 1, honne: 1 } },
  atsu: { oshi: ['dragon', 'golem', 'henger', 'worm', 'centaur', 'suezo', 'naga', 'colorpandora', 'monol'], suki: ['tiger', 'hare', 'dino', 'mew', 'gali', 'mocchi', 'pixie', 'zilla'], sugao: ['durahan', 'metalner', 'phoenix', 'kyubi', 'jell', 'arrowhead', 'ghost', 'plant', 'joker'], free: { oshi: 0, suki: 0, yoso: 0, honne: 0 } },
  kyuko: { oshi: ['durahan', 'henger', 'hare', 'dino', 'centaur', 'mew', 'mocchi', 'naga', 'monol'], suki: ['dragon', 'golem', 'phoenix', 'worm', 'jell', 'suezo', 'pixie', 'plant', 'colorpandora'], sugao: ['tiger', 'metalner', 'kyubi', 'gali', 'arrowhead', 'ghost', 'zilla', 'joker'], free: { oshi: 1, suki: 1, yoso: 1, honne: 1 } },
  sorashido: { oshi: ['henger', 'mew', 'joker', 'metalner', 'hare', 'phoenix', 'mocchi', 'gali', 'naga'], suki: ['tiger', 'durahan', 'dragon', 'plant', 'centaur', 'kyubi', 'worm', 'arrowhead', 'monol'], sugao: ['jell', 'suezo', 'golem', 'dino', 'ghost', 'zilla', 'pixie', 'colorpandora'], free: { oshi: 1, suki: 0, yoso: 0, honne: 1 } },
  erubin: { oshi: ['durahan', 'dragon', 'golem', 'hare', 'metalner', 'gali', 'naga', 'mocchi', 'plant'], suki: ['monol', 'phoenix', 'dino', 'mew', 'centaur', 'suezo', 'pixie', 'zilla', 'joker'], sugao: ['tiger', 'henger', 'worm', 'kyubi', 'jell', 'arrowhead', 'colorpandora', 'ghost'], free: { oshi: 1, suki: 0, yoso: 0, honne: 0 } },
});
const CARD_AI_FACE_RANK = Object.freeze(['oshi', 'yoso', 'suki', 'honne']);
const CARD_AI_FACE_PAIRS = Object.freeze([['oshi', 'suki'], ['oshi', 'yoso'], ['suki', 'yoso'], ['oshi', 'honne'], ['suki', 'honne']]);
const cardAiFaceLayoutMemo = {};
const cardAiFaceLayout = (db, who) => {
  const key = `${who}:${Object.keys(db.monsters).length}`;
  if (cardAiFaceLayoutMemo[key]) return cardAiFaceLayoutMemo[key];
  const fixedLay = cardAiFaceFixedLayout(db, who);
  if (fixedLay) { cardAiFaceLayoutMemo[key] = fixedLay; return fixedLay; }
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
// 決めた振り分けを使えるか(カードの種とぴったり合う・主役の種が自分の組にある・決まりを守る)。使えなければ null
const cardAiFaceFixedLayout = (db, who) => {
  const L = CARD_AI_FACE_LAYOUTS[who];
  const t = CARD_AI_FACES[who];
  if (!L || !t) return null;
  const lines = [...new Set(Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && !m.variant && String(m.wave) !== 'hybrid').map((m) => m.species))].sort();
  const all = [...L.oshi, ...L.suki, ...L.sugao];
  if (JSON.stringify(all.slice().sort()) !== JSON.stringify(lines)) return null;
  if (!L.oshi.includes(t.oshi.lead) || !L.suki.includes(t.suki.lead) || [t.yoso.lead, t.honne.lead].some((x) => x && !L.sugao.includes(x))) return null;
  const v = Object.fromEntries(lines.map((sp) => [sp, Math.max(...Object.values(db.monsters).filter((m) => m.species === sp && !m.variant && String(m.wave) !== 'hybrid').map((m) => cardAiMonScore(db, who, m, 99, 'master')))]));
  const groups = Object.fromEntries(CARD_AI_FACE_IDS.map((g) => [g, L[g].slice().sort((a, b) => v[b] - v[a] || (a < b ? -1 : 1))]));
  const free = { ...L.free };
  const deckOf = (slot) => cardAiFaceBuildWith(db, who, cardAiFaceSpec(db, who, slot, free[slot], groups), 'master', cardAiSeededRand(`face:${who}:${slot}:master`), {}, null);
  const d = Object.fromEntries(CARD_AI_FACE_SLOTS.map((sl) => [sl, deckOf(sl)]));
  const ok = !CARD_AI_FACE_PAIRS.some(([a, b]) => cardAiFaceShare(d[a], d[b]) > CARD_AI_FACE_SHARE_MAX || cardAiFaceTrioDiff(d[a], d[b]) < CARD_AI_FACE_TRIO_DIFF);
  return ok ? { groups, free, order: 'fixed', ok: true } : null;
};
const cardAiFaceGroups = (db, who) => cardAiFaceLayout(db, who).groups;
const cardAiFaceFreeMap = (db, who) => cardAiFaceLayout(db, who).free;

// ---- これまでのデッキ(組み直す前のデッキ) ----
// 1つ { id, slot, name, plan, spec: { lead, avoid, keep, free, style }, monsters: [3体], top: [札8枚まで], from, to }。spec と plan があれば、昔のデッキとも同じ組み方で戦える
const cardAiHistoryEntryOf = (raw, db) => {
  if (!cardAiDeckIsObj(raw) || !CARD_AI_FACE_SLOTS.includes(raw.slot)) return null;
  const name = cardAiDeckText(raw.name, CARD_AI_DECK_NAME_MAX);
  const id = typeof raw.id === 'string' && /^[a-z0-9:_-]{1,40}$/i.test(raw.id) ? raw.id : null;
  const sp = cardAiDeckIsObj(raw.spec) ? raw.spec : null;
  const strs = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length <= 40).slice(0, n) : []);
  if (!name || !id || !sp || typeof sp.lead !== 'string') return null;
  const spec = { lead: sp.lead, avoid: strs(sp.avoid, 60), keep: strs(sp.keep, 10), free: sp.free === 1 ? 1 : 0, style: cardAiStyleOf(sp.style) || 'normal' };
  const plan = db && cardAiDeckIsObj(raw.plan) && cardAiPlanClean(db, raw.plan) ? cardAiDeckEntryOf({ plan: raw.plan }, db).plan : null;
  const okNo = (no) => typeof no === 'string' && (!db || (db.cards[no] || db.monsters[no]));
  const from = Number.isFinite(raw.from) && raw.from > 0 ? Math.floor(raw.from) : 0;
  const to = Number.isFinite(raw.to) && raw.to >= from ? Math.floor(raw.to) : from;
  return { id, slot: raw.slot, name, plan, spec, monsters: strs(raw.monsters, 3).filter(okNo), top: strs(raw.top, 8).filter(okNo), from, to };
};
const cardNormalizeAiHistory = (raw, db = (typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null)) => {
  const perWho = {};
  const src = cardAiDeckIsObj(raw) && cardAiDeckIsObj(raw.perWho) ? raw.perWho : {};
  for (const who of Object.keys(src)) {
    if (!CARD_AI_FACES[who] || !Array.isArray(src[who])) continue;
    const seen = new Set();
    const list = src[who].map((e) => cardAiHistoryEntryOf(e, db)).filter((e) => e && !seen.has(e.id) && seen.add(e.id)).sort((a, b) => b.to - a.to).slice(0, CARD_AI_HISTORY_MAX);
    if (list.length) perWho[who] = list;
  }
  return { v: 1, perWho };
};
// ★頭が「ど」の言葉は入れない(「〇〇のど根性」が「のど」と読める。2026-11-08 部長)。チームの自動の名前(83-card-battle-vs.jsx の CARD_DECK_NAME_TAILS)と同じことばも避ける
// 助手ごとの遊び方の言葉(AI が使えないとき、2つ目からの名前「主役の種の名前+の+言葉」に使う。部長・社長の確認待ちの案)
const CARD_AI_PLAY_WORDS = Object.freeze({
  mua: ['はしゃぎ組', 'ぴかぴか組', 'るんるん隊', 'ときめき作戦', 'わくわく隊', 'きゅんきゅん隊'],
  kiki: ['ぶちかまし', '力くらべ', 'ねばり腰', 'ひと押し', 'ぽかぽか隊', '根性勝負'],
  momosuke: ['センター', 'きらめき舞台', 'アンコール', '大歓声', 'ラストサビ', 'ファンサ'],
  dra: ['ゆるっと隊', 'ひなたぼっこ', 'じっくり作戦', 'まったり組', 'おひるね隊', 'ぽてぽて歩き'],
  atsu: ['全力投球', '再戦上等', '熱血組', '一直線', '真剣一本', '燃える魂'],
  kyuko: ['夜ふかし', '大逆転', '月あかり', 'ひらめき', 'ないしょ話', 'ねこの目'],
  sorashido: ['必勝の表', '勝ち筋', 'データ戦', '方程式', '答え合わせ', '分析班'],
  erubin: ['仲間の輪', '支え合い', 'ほっこり組', 'ぬくもり隊', 'あったか隊', 'ひだまり組'],
});
// 2つ目からの名前(AI が使えない・決まりに合わないとき)。主役の種の名前+の+遊び方の言葉で、決まりに合い、その助手の一覧(今・これまで)に無いもの。作れなければ null
const cardAiFaceMakeName = (db, who, slot, others, used, rnd = Math.random) => {
  const spec = cardAiFaceSpec(db, who, slot);
  const mon = Object.values(db.monsters).find((m) => m.species === spec.lead && !m.variant && String(m.wave) !== 'hybrid');
  if (!mon) return null;
  const words = (CARD_AI_PLAY_WORDS[who] || []).slice();
  for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
  for (const w of words) {
    const n = `${mon.name}の${w}`;
    if (n.length <= CARD_AI_DECK_NAME_MAX && !used.includes(n) && cardAiFaceNameOk(db, who, slot, n, others)) return n;
  }
  return null;
};

// ---- 名前 ----
// 既定の名前(AI が名前を付けられない・見張りに落ちたとき)。よそいきは今の8つの名前
const cardAiFaceDefaultName = (who, slot) => {
  const t = CARD_AI_FACES[who];
  if (!t) return null;
  if (slot === 'yoso') return CARD_AI_STYLE_NAMES[who] || null;
  return (t[slot] && t[slot].name) || null;
};
// 2つの名前に同じことばがあるか。名前をカタカナ・漢字・ひらがなのまとまりに分けてくらべる(「の」「と」のつなぎや、まとまりの切れ目をまたぐ部分は数えない)
//   カタカナ … 同じまとまり(2字以上)か、3字以上のまとまりがもう一方に含まれる(キラキラ・ノリ / ライガー と ライブ は別)
//   漢字 … 2字以上が同じ(一撃・全力・火力)  ひらがな … 3字以上が同じ(ずっしり・ぜんぶ)
const cardAiFaceRuns = (t) => (typeof t === 'string' ? t.match(/[゠-ヿー]+|[一-鿿々]+|[ぁ-ゟ]+/g) || [] : []);
const cardAiFaceShareWord = (a, b) => {
  const ra = cardAiFaceRuns(a), rb = cardAiFaceRuns(b);
  const kind = (r) => (/^[゠-ヿー]+$/.test(r) ? 'kata' : /^[一-鿿々]+$/.test(r) ? 'kan' : 'hira');
  const sub = (x, y, n) => { for (let i = 0; i + n <= x.length; i++) if (y.includes(x.slice(i, i + n))) return true; return false; };
  for (const x of ra) for (const y of rb) {
    const k = kind(x);
    if (k !== kind(y)) continue;
    if (k === 'kata' && ((x === y && x.length >= 2) || (x.length >= 3 && y.includes(x)) || (y.length >= 3 && x.includes(y)))) return true;
    if (k === 'kan' && x.length >= 2 && y.length >= 2 && sub(x, y, 2)) return true;
    if (k === 'hira' && x.length >= 3 && y.length >= 3 && sub(x, y, 3)) return true;
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
  if (cardAiFaceNicks(who).some((n) => name.includes(n))) return false;
  if (slot === 'oshi' || slot === 'suki') {
    const spec = cardAiFaceSpec(db, who, slot);
    const mon = Object.values(db.monsters).find((m) => m.species === spec.lead && !m.variant);
    const row = (CARD_AI_FACES[who] || {})[slot] || {};
    const words = [mon && mon.name, ...(Array.isArray(row.words) ? row.words : [])].filter(Boolean);
    if (!words.some((w) => name.includes(w))) return false;
  }
  return true;
};
// その助手のマスモンの愛称(助手部の表 ASSISTANT_MASMON_PLAN と、この端末で引いたマスモン assistantLifeMasmonTeamOf)。名前に入っていたら使わない
//   2文字以上の愛称だけ(1文字は普通のことばと区別できない)。口が無い・壊れているときは空
const cardAiFaceNicks = (who) => {
  const out = new Set();
  const add = (rows) => { (Array.isArray(rows) ? rows : []).forEach((t) => { if (t && typeof t.nick === 'string' && t.nick.trim().length >= 2) out.add(t.nick.trim()); }); };
  try {
    if (typeof ASSISTANT_MASMON_PLAN !== 'undefined' && Array.isArray(ASSISTANT_MASMON_PLAN)) {
      const p = ASSISTANT_MASMON_PLAN.find((x) => x && x.id === who);
      if (p) { add(p.team); add(p.bench); add(p.more); }
    }
  } catch (_) { /* 表が無ければ見ない */ }
  try { if (typeof assistantLifeMasmonTeamOf === 'function') add(assistantLifeMasmonTeamOf(who)); } catch (_) { /* 口が無ければ見ない */ }
  return [...out];
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
//   style … 提案で寄せた組み方(保存の style)。渡せば顔の表の型の代わりに使う(主役・振り分けは変えない)
const cardAiFaceBuild = (db, who, slot, level, rnd, extra = {}, plan = null, style = null) => {
  const spec = cardAiFaceSpec(db, who, slot);
  return cardAiFaceBuildWith(db, who, cardAiStyleOf(style) ? { ...spec, style: cardAiStyleOf(style) } : spec, level, rnd, extra, plan);
};
const cardAiFaceBuildWith = (db, who, spec, level, rnd, extra = {}, plan = null) => {
  const lv = CARD_AI_BUILD[level] ? level : 'normal';
  const nz = (((CARD_AI_FACE_NOISE[who] || {})[spec.slot] || {})[lv]) || 0;
  const opts = (avoid) => ({ ...extra, style: spec.style, face: { lead: spec.lead, avoid, keep: spec.keep, free: spec.free, ...(nz ? { noise: nz } : {}) }, ...(plan ? { plan } : {}) });
  const deck = cardAiBuildDeck(db, who, lv, rnd, opts(spec.avoid));
  if (deck.monsters.length >= 3) return deck;
  return cardAiBuildDeck(db, who, lv, rnd, opts(spec.keep));
};
// 見せる・くらべるためのデッキ(毎回同じ並び。MASTER の種で組む)
const cardAiFacePreviewDeck = (db, who, slot, plan = null, level = 'master', style = null) => cardAiFaceBuild(db, who, slot, level, cardAiSeededRand(`face:${who}:${slot}:${level}`), {}, plan, style);
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
const cardAiDeckFacts = (db, who, slot, styleIn = null) => {
  const spec0 = cardAiFaceSpec(db, who, slot);
  const spec = cardAiStyleOf(styleIn) ? { ...spec0, style: cardAiStyleOf(styleIn) } : spec0;
  const trio = cardAiFacePreviewDeck(db, who, slot, null, 'master', spec.style).monsters;
  const cands = cardAiPlanCandidates(db, who, 'master', trio);
  const fields = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld').map((c) => c.name);
  const leadMon = trio.map((no) => db.monsters[no]).find((m) => m && cardAiFaceLineOf(m) === spec.lead);
  return {
    trio, cands, fields, spec,
    range: cardAiPlanHabitRange(who, 'master', spec.style),
    facts: {
      style: spec.style,
      face: spec.face, side: slot === 'yoso' || slot === 'honne' ? slot : null,
      // 主役は種の名前だけ(マスモンの愛称は渡さない。社長 2026-11-08)
      lead: (leadMon && leadMon.name) || null,
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
  await cardAiHistoryRead();
  await cardAiWishRead();
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
// これまでのデッキ(読む・足す)。足すのは組み直しで名前が変わったときだけ。新しい順で10個まで(古いものから消える)
let cardAiHistoryState = { v: 1, perWho: {} };
const cardAiHistoryRead = async () => { try { cardAiHistoryState = cardNormalizeAiHistory(await storeGet(CARD_AI_HISTORY_KEY, null)); } catch (_) { cardAiHistoryState = { v: 1, perWho: {} }; } return cardAiHistoryState; };
const cardAiHistoryPush = async (who, entry) => {
  const cur = await cardAiHistoryRead();
  const list = [entry, ...(cur.perWho[who] || []).filter((e) => e.id !== entry.id)];
  const next = cardNormalizeAiHistory({ v: 1, perWho: { ...cur.perWho, [who]: list } });
  cardAiHistoryState = next;
  try { await storeSet(CARD_AI_HISTORY_KEY, next); } catch (_) { /* 残せなくても遊べる */ }
  return next;
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
const cardAiFaceDiverseOk = (db, who, slot, plan, w, side, style = null) => {
  const mine = cardAiFacePreviewDeck(db, who, slot, plan, 'master', style);
  const others = ['oshi', 'suki', side === 'honne' ? 'honne' : 'yoso'].filter((s) => s !== slot && !((slot === 'yoso' || slot === 'honne') && (s === 'yoso' || s === 'honne')));
  return others.every((s) => {
    const e = w && w.decks && w.decks[s];
    const d = cardAiFacePreviewDeck(db, who, s, e && e.plan, 'master', e && e.style);
    return cardAiFaceShare(mine, d) <= CARD_AI_FACE_SHARE_MAX && cardAiFaceTrioDiff(mine, d) >= CARD_AI_FACE_TRIO_DIFF;
  });
};
// ---- 遊ぶ人の提案(助手部キズナ4の「助手にデッキを提案する」。2026-11-08) ----
// 読むだけの口 assistantLifeDeckWish(id) → { face: 'oshi'|'like'|'sugao', name: 2〜12字か空, plan: 'attack'|'guard'|'normal'|'', day: 'YYYY-MM-DD' } か null。
//   すぐには組み直さない。次に組み直すとき、その顔を1回だけ組み直して使う(使った印は新しいキー mh_card_ai_deck_wish_v1 に助手ごと「顔:日」で持つ)
//   name は名前の見張りを全部通す(主役の種族名が無ければ「種族名+の+name」)。通らなければ使わない(いつもの付け方)
//   plan は見出しに出さず、その顔の組み方(型)を寄せるだけ。主役の種・振り分け・ほかの組み方は変えない
const CARD_AI_WISH_KEY = 'mh_card_ai_deck_wish_v1';
// 提案の型を寄せてよい組み合わせ(2026-11-08 部長「A」: 社長の強さの目安 ±10点を守る)。{ 助手: { 枠: [寄せてよい型] } }。
//   EXPERT・MASTER の両方で、その型で組んだ勝率が今の組み方の ±10点に入るものだけ(1組100〜300戦。docs/progress/card-ai-faces/wish-plan-rates.json)。
//   表に無い組み合わせ(助手や顔が増えたときも)は寄せない(名前だけ使う)。作り直し: node tools/card/card-ai-wish-plan-table.js --write
// <<< CARD_AI_WISH_PLAN_OK(道具が書く。手で直さない)
const CARD_AI_WISH_PLAN_OK = Object.freeze({
  mua: { oshi: ['attack'], suki: ['guard'], yoso: ['attack', 'guard', 'normal'], honne: ['attack', 'guard', 'normal'] },
  kiki: { oshi: ['attack', 'guard', 'normal'], suki: [], yoso: ['attack', 'normal'], honne: ['attack', 'normal'] },
  momosuke: { oshi: ['guard'], suki: ['attack', 'guard', 'normal'], yoso: ['attack', 'guard', 'normal'], honne: ['attack', 'guard', 'normal'] },
  dra: { oshi: ['attack', 'guard', 'normal'], suki: ['attack', 'normal'], yoso: ['attack', 'guard', 'normal'], honne: ['attack', 'guard', 'normal'] },
  atsu: { oshi: ['guard', 'normal'], suki: ['attack', 'guard', 'normal'], yoso: ['attack', 'guard'], honne: [] },
  kyuko: { oshi: [], suki: ['guard', 'normal'], yoso: ['attack', 'guard', 'normal'], honne: ['attack', 'guard', 'normal'] },
  sorashido: { oshi: ['attack', 'normal'], suki: ['attack', 'guard', 'normal'], yoso: [], honne: [] },
  erubin: { oshi: ['attack', 'guard', 'normal'], suki: [], yoso: ['guard', 'normal'], honne: ['guard', 'normal'] },
});
// >>> CARD_AI_WISH_PLAN_OK
const cardAiWishPlanOk = (who, slot, plan) => {
  const row = CARD_AI_WISH_PLAN_OK[who];
  const list = row && Array.isArray(row[slot]) ? row[slot] : [];
  return !!cardAiStyleOf(plan) && list.includes(plan);
};
const CARD_AI_WISH_KEEP = 20; // 助手ごとに残す印の数(古いものから消す)
const cardAiWishOf = (who) => {
  let w = null;
  try { w = typeof assistantLifeDeckWish === 'function' ? assistantLifeDeckWish(who) : null; } catch (_) { w = null; }
  if (!cardAiDeckIsObj(w)) return null;
  const face = w.face === 'like' ? 'suki' : cardAiFaceOf(w.face);
  const day = typeof w.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.day) ? w.day : null;
  if (!face || !day) return null;
  const nm = cardAiDeckText(w.name, CARD_AI_DECK_NAME_MAX);
  return { face, name: nm && nm.length >= 2 ? nm : null, plan: cardAiStyleOf(w.plan), day, mark: `${face}:${day}` };
};
//   fought … 提案の名前のデッキと初めて戦った印(助手ごとにデッキの名前。2026-11-08 社長「やる」。前からある used の形はそのまま)
const cardNormalizeAiWish = (raw) => {
  const pick = (key, ok) => {
    const out = {};
    const src = cardAiDeckIsObj(raw) && cardAiDeckIsObj(raw[key]) ? raw[key] : {};
    for (const who of Object.keys(src)) {
      if (!CARD_AI_FACES[who] || !Array.isArray(src[who])) continue;
      const list = [...new Set(src[who].filter(ok))].slice(-CARD_AI_WISH_KEEP);
      if (list.length) out[who] = list;
    }
    return out;
  };
  const used = pick('used', (x) => typeof x === 'string' && /^(oshi|suki|sugao):\d{4}-\d{2}-\d{2}$/.test(x));
  const fought = pick('fought', (x) => typeof x === 'string' && x.length > 0 && x.length <= CARD_AI_DECK_NAME_MAX);
  return { v: 1, used, ...(Object.keys(fought).length ? { fought } : {}) };
};
let cardAiWishState = { v: 1, used: {} };
const cardAiWishRead = async () => { try { cardAiWishState = cardNormalizeAiWish(await storeGet(CARD_AI_WISH_KEY, null)); } catch (_) { cardAiWishState = { v: 1, used: {} }; } return cardAiWishState; };
// まだ使っていない提案(あれば)。印が偽なら null
const cardAiWishPending = async (who) => {
  if (!cardAiDeckFlagOn()) return null;
  const wish = cardAiWishOf(who);
  if (!wish) return null;
  const st = await cardAiWishRead();
  return (st.used[who] || []).includes(wish.mark) ? null : wish;
};
const cardAiWishMarkUsed = async (who, wish) => {
  const st = await cardAiWishRead();
  const next = cardNormalizeAiWish({ ...st, used: { ...st.used, [who]: [...(st.used[who] || []), wish.mark] } });
  cardAiWishState = next;
  try { await storeSet(CARD_AI_WISH_KEY, next); } catch (_) { /* 残せなくても遊べる(次の組み直しでもう一度使うだけ) */ }
  return next;
};
// 提案の名前のデッキと初めて戦った(84 が対戦を始めたときに呼ぶ)。印が偽・名前が無ければ何もしない
const cardAiDeckWishFought = async (who, name) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_FACES[who] || typeof name !== 'string' || !name) return null;
  const st = await cardAiWishRead();
  if (((st.fought || {})[who] || []).includes(name)) return st;
  const next = cardNormalizeAiWish({ ...st, fought: { ...(st.fought || {}), [who]: [...((st.fought || {})[who] || []), name] } });
  cardAiWishState = next;
  try { await storeSet(CARD_AI_WISH_KEY, next); } catch (_) { /* 残せなくても遊べる(もう一度だけ台詞が出る) */ }
  return next;
};
const cardAiDeckWishFirst = (who, name) => !!name && !(((cardAiWishState && cardAiWishState.fought) || {})[who] || []).includes(name);
// 提案の名前を、決まりに合う形にする(主役の種族名が無ければ「種族名+の+名前」)。合わなければ null
const cardAiWishName = (db, who, slot, name, others, used) => {
  if (!name) return null;
  const spec = cardAiFaceSpec(db, who, slot);
  const mon = Object.values(db.monsters).find((m) => m.species === spec.lead && !m.variant && String(m.wave) !== 'hybrid');
  const full = mon && !name.includes(mon.name) ? `${mon.name}の${name}` : name;
  if (full.length > CARD_AI_DECK_NAME_MAX || used.includes(full)) return null;
  return cardAiFaceNameOk(db, who, slot, full, others) ? full : null;
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
    // 遊ぶ人の提案があれば、いちばん古い顔の代わりに、その顔を組み直す(1回だけ)
    const wish = await cardAiWishPending(who);
    const slot = wish ? cardAiFaceSlotOf(wish.face, side) : cardAiDeckOldest(before.perWho[who] || null, side);
    const prev0 = (before.perWho[who] && before.perWho[who].decks[slot]) || null;
    // 提案の型は、表で寄せてよい組み合わせのときだけ(入らなければ名前だけ使う)
    const wishStyle = wish && wish.plan && cardAiWishPlanOk(who, slot, wish.plan) ? wish.plan : null;
    const style = wish ? wishStyle : (prev0 && prev0.style) || null;
    const f = cardAiDeckFacts(db, who, slot, style);
    const got = await cardAiDeckFetch(who, f.facts);
    // 読み直してから書く(待っているあいだにほかの所が書いたぶんを消さない)
    const cur = await cardAiRecipeRead();
    const w = cur.perWho[who] || { met: true, gamesSince: 0, slotsDone: 0, decks: {} };
    const prev = w.decks[slot] || null;
    const jitter = () => cardAiDeckJitter(prev && prev.plan, { cands: f.cands, fields: f.fields, range: f.range, rnd: cardAiSeededRand(`jitter:${who}:${slot}:${now}`) });
    let plan = got && cardAiPlanClean(db, got.plan) ? got.plan : jitter();
    // 重なりの見張り(社長 Q3 A)。AI の方針が重なりすぎたら揺らぎ、それもだめなら前の方針(無ければ方針なし=型だけ)
    if (!cardAiFaceDiverseOk(db, who, slot, plan, w, side, style)) {
      const j = jitter();
      plan = cardAiFaceDiverseOk(db, who, slot, j, w, side, style) ? j : (prev && prev.plan) || null;
    }
    // 名前(社長 2026-11-08「デッキはかわってくたびに名前をかえて」)。1つ目は既定の名前。
    //   組み直しの印(主役の3体のうち1体以上・札の2割以上が入れかわった)が立てば新しい名前: AI の名前 → だめなら 種の名前+遊び方の言葉。
    //   その助手の一覧(今の4つ・これまでのデッキ)にある名前は使わない。新しい名前が作れなければ前の名前のまま(これまでのデッキにも残さない)
    const others = cardAiFaceOtherNames(w, who, slot);
    let name = null, since = now, past = null;
    // 提案の名前(決まりに合うときだけ)。あれば中身の変わり方にかかわらず、その名前にする(前のデッキは「これまで」へ)
    const histNow = await cardAiHistoryRead();
    const usedNames = [...CARD_AI_FACE_SLOTS.map((sl) => cardAiFaceNameOf(w, who, sl)), ...(histNow.perWho[who] || []).map((e) => e.name)].filter(Boolean);
    const wishName = wish ? cardAiWishName(db, who, slot, wish.name, others, usedNames) : null;
    if (!prev && wishName) name = wishName;
    if (prev) {
      const a0 = cardAiFacePreviewDeck(db, who, slot, prev.plan, 'master', prev.style), a1 = cardAiFacePreviewDeck(db, who, slot, plan, 'master', style);
      const changed = cardAiFaceTrioDiff(a0, a1) >= 1 || cardAiFaceShare(a0, a1) <= CARD_AI_RENAME_SHARE; // 札が2割以上入れかわった=重なり8割以下
      name = prev.name; since = prev.since || prev.at || now;
      if (changed || wishName) {
        const used = usedNames;
        const fresh = wishName || (got && got.name && !used.includes(got.name) && cardAiFaceNameOk(db, who, slot, got.name, others) ? got.name
          : cardAiFaceMakeName(db, who, slot, others, used, cardAiSeededRand(`name:${who}:${slot}:${now}`)));
        if (fresh) {
          const spec = cardAiFaceSpec(db, who, slot);
          past = { id: `${slot}-${since}`, slot, name: cardAiFaceNameOf(w, who, slot), plan: prev.plan, spec: { lead: spec.lead, avoid: spec.avoid, keep: spec.keep, free: spec.free, style: cardAiStyleOf(prev.style) || spec.style },
            monsters: a0.monsters.slice(0, 3), top: [...new Set(a0.cards)].slice(0, 8), from: since, to: now };
          name = fresh; since = now;
        }
      }
    }
    const isWish = !!wishName && name === wishName;
    const entry = cardAiDeckEntryOf({ plan, name, line: got ? got.line : (prev && prev.line), at: now, since, ai: !!got, style, wish: isWish || (!!(prev && prev.wish) && name === (prev && prev.name)) }, db);
    if (past) await cardAiHistoryPush(who, past);
    const passed = Number.isFinite(opts.passed) ? opts.passed : w.slotsDone;
    const nextW = { ...w, met: true, decks: { ...w.decks, [slot]: entry }, gamesSince: reason === 'games' ? 0 : w.gamesSince, slotsDone: reason === 'slot' ? Math.max(w.slotsDone, passed) : w.slotsDone };
    await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: nextW } });
    if (wish) await cardAiWishMarkUsed(who, wish);
    return { who, slot, ai: !!got, ...(wish ? { wish: wish.mark, wishName: !!wishName, wishStyle: !!wishStyle } : {}) };
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
// ---- 今日のデッキ(今の3つ+これまでのデッキから選ぶ) ----
// デッキの id: 今の3つは顔('oshi'|'suki'|'sugao')、これまでのデッキは 'h:' + その id
const CARD_AI_PICK_NOW = 0.8;   // これまでのデッキがあるとき、今の3つで8割(合う顔 5割・ほか 1.5割ずつ)・これまでのデッキ全体で2割(社長 2026-11-08 Q1・部長の案)
const cardAiHistoryOf = (who) => (cardAiHistoryState && cardAiHistoryState.perWho[who]) || [];
const cardAiDeckIdFace = (id) => {
  if (cardAiFaceOf(id)) return id;
  if (typeof id === 'string' && id.startsWith('h:')) {
    const sl = id.slice(2).split('-')[0];
    return sl === 'yoso' || sl === 'honne' ? 'sugao' : cardAiFaceOf(sl);
  }
  return null;
};
// 選ぶ: これまでのデッキが無ければ今までどおり(合う顔6割・ほか2割ずつ/分からなければ均等)。
//   あれば 今の3つで8割(合う顔は 5割、ほか 1.5割ずつ。合う顔が分からなければ8割を3つ均等)・これまでのデッキで2割(新しいものほど重く 10:9:…:1)
const cardAiDeckPickId = (main, hist, rnd) => {
  if (!Array.isArray(hist) || !hist.length) return cardAiDeckPickFace(main, rnd);
  const r = rnd();
  if (r < CARD_AI_PICK_NOW) {
    const m = cardAiFaceOf(main);
    if (!m) return CARD_AI_FACE_IDS[Math.min(2, Math.floor((r / CARD_AI_PICK_NOW) * 3))];
    if (r < 0.5) return m;
    const others = CARD_AI_FACE_IDS.filter((f) => f !== m);
    return others[r < 0.5 + (CARD_AI_PICK_NOW - 0.5) / 2 ? 0 : 1];
  }
  const w = hist.map((_, i) => CARD_AI_HISTORY_MAX - i);
  let x = ((r - CARD_AI_PICK_NOW) / (1 - CARD_AI_PICK_NOW)) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < hist.length; i++) { x -= w[i]; if (x < 0) return `h:${hist[i].id}`; }
  return `h:${hist[hist.length - 1].id}`;
};
// 次の対戦のデッキ。相手えらびで見せたデッキと、対戦で出すデッキをそろえるため、先に決めて持っておく(1戦し終えたら決め直す)
//   遊ぶ人が相手えらびで選んだら(cardAiDeckChoose)、それを使い続ける(おまかせに戻すまで)。ブラウザを閉じれば決め直し(保存しない)。印が偽なら null
const cardAiDeckNextMemo = {};
const cardAiDeckChosenMemo = {};
const cardAiDeckNextId = (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || !CARD_AI_FACES[who]) return null;
  const hist = cardAiHistoryOf(who);
  const cur = cardAiDeckNextMemo[who];
  const valid = cardAiFaceOf(cur) || (typeof cur === 'string' && cur.startsWith('h:') && hist.some((e) => `h:${e.id}` === cur));
  if (!valid) { cardAiDeckNextMemo[who] = cardAiDeckPickId(cardAiFaceMain(cardAiFaceMaterial(who)), hist, Math.random); delete cardAiDeckChosenMemo[who]; }
  return cardAiDeckNextMemo[who];
};
// 次の対戦のデッキの顔(相手えらび・VS の札の印)。名前は前と同じ cardAiDeckNextStyle(84 が呼ぶ)
const cardAiDeckNextStyle = (who) => cardAiDeckIdFace(cardAiDeckNextId(who));
// 遊ぶ人が選ぶ(相手えらびの「デッキ」の選び口)。id … 'oshi'|'suki'|'sugao'|'h:…'。null で おまかせ(選び直す)
const cardAiDeckChoose = (who, id) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_FACES[who]) return null;
  if (id == null) { delete cardAiDeckNextMemo[who]; delete cardAiDeckChosenMemo[who]; return cardAiDeckNextId(who); }
  if (!cardAiDeckChoices(who).some((c) => c.id === id)) return cardAiDeckNextId(who);
  cardAiDeckNextMemo[who] = id; cardAiDeckChosenMemo[who] = true;
  return id;
};
const cardAiDeckChosen = (who) => (cardAiDeckChosenMemo[who] ? cardAiDeckNextMemo[who] || null : null);
// 選び口に出す一覧: 今の3つ(推し・好き・素顔の今の側)と、これまでのデッキ(新しい順)。{ id, face, name, past, from, to }
const cardAiDeckChoices = (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_FACES[who]) return [];
  const now = CARD_AI_FACE_IDS.map((f) => ({ id: f, face: f, name: cardAiFaceName(who, f), past: false, from: 0, to: 0 }));
  const past = cardAiHistoryOf(who).map((e) => ({ id: `h:${e.id}`, face: cardAiDeckIdFace(`h:${e.id}`), name: e.name, past: true, from: e.from, to: e.to }));
  return [...now, ...past];
};
// 使っていた時期の書き方(11/8〜11/9。同じ日なら 11/8)。読めなければ空
const cardAiDeckPeriodText = (from, to) => {
  const d = (t) => { const x = new Date(t); return Number.isNaN(x.getTime()) || !(t > 0) ? '' : `${x.getMonth() + 1}/${x.getDate()}`; };
  const a = d(from), b = d(to);
  return a && b && a !== b ? `${a}〜${b}` : (a || b);
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
  const id = cardAiDeckNextId(who);
  if (!id) return null;
  if (cardAiFaceOf(id)) return cardAiFaceName(who, id);
  const e = cardAiHistoryOf(who).find((x) => `h:${x.id}` === id);
  return e ? e.name : null;
};
// 1戦し終えた(または対戦を始めた)ら、次の対戦のデッキを決め直す(遊ぶ人が選んだデッキはそのまま)
const cardAiDeckNextDone = (who) => { if (!cardAiDeckChosenMemo[who]) delete cardAiDeckNextMemo[who]; };
// 対戦で出すデッキ(読むだけ。助手と対戦の 84 と、助手どうしの対戦(助手ライフ)が使う)。印が偽なら null(呼ぶ側は今の組み方)
//   返り値 { styleId: 顔, slot, deckId, deckFrom: 'now'|'past', name, line, plan, deck }。deck は cardAiBuildDeck の物(level は既定 'normal')
//   idIn を渡せばそのデッキ(84 は相手えらびで見せた今日のデッキ cardAiDeckNextId を渡す)。渡さなければ cardAiDeckPickId で選ぶ
const cardAssistantDeckPick = (who, rand = Math.random, level = 'normal', extra = {}, idIn = null) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || !CARD_AI_FACES[who] || typeof CARD_BATTLE_DATA === 'undefined') return null;
  const rnd = typeof rand === 'function' ? rand : Math.random;
  const mat = cardAiFaceMaterial(who);
  const hist = cardAiHistoryOf(who);
  let id = typeof idIn === 'string' && (cardAiFaceOf(idIn) || hist.some((e) => `h:${e.id}` === idIn)) ? idIn : cardAiDeckPickId(cardAiFaceMain(mat), hist, rnd);
  const past = id.startsWith('h:') ? hist.find((e) => `h:${e.id}` === id) : null;
  if (past) {
    const deck = cardAiFaceBuildWith(CARD_BATTLE_DATA, who, { ...past.spec, slot: past.slot }, level, rnd, extra, past.plan);
    return { styleId: cardAiDeckIdFace(id), slot: past.slot, deckId: id, deckFrom: 'past', name: past.name, line: null, plan: past.plan, deck };
  }
  if (!cardAiFaceOf(id)) id = 'oshi';
  const slot = cardAiFaceSlotOf(id, cardAiFaceSugaoSide(mat));
  const w = cardAiRecipeState && cardAiRecipeState.perWho[who];
  const e = (w && w.decks[slot]) || null;
  const plan = e && e.plan ? e.plan : null;
  const deck = cardAiFaceBuild(CARD_BATTLE_DATA, who, slot, level, rnd, extra, plan, e && e.style);
  const nm = cardAiFaceNameOf(w, who, slot);
  // 提案の名前のデッキと初めて戦うとき(VS で助手がひとこと添える。2026-11-08 社長「やる」)
  const wishFirst = !!(e && e.wish) && cardAiDeckWishFirst(who, nm);
  return { styleId: id, slot, deckId: id, deckFrom: 'now', name: nm, line: (e && e.line) || null, plan, deck, ...(wishFirst ? { wishFirst: true } : {}) };
};
// 保存してある顔のデッキ(読むだけ)。印が偽なら null
const cardAiRecipeOf = (who, face) => {
  if (!cardAiDeckFlagOn() || !cardAiRecipeState) return null;
  const slot = cardAiFaceSlotOf(face, cardAiFaceSugaoSide(cardAiFaceMaterial(who)));
  const e = slot && cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[slot];
  return e ? { plan: e.plan, name: e.name, line: e.line, at: e.at } : null;
};
// 顔のデッキの中身(見せる用。87 のデッキの欄・56 の部屋のタブ)。返り値 { monsters, cards, styleId: 顔, slot, side, name, line, at }。助手でない・印が偽なら null
//   これまでのデッキの id('h:…')を渡せば、そのデッキ(past・from・to つき)
const cardAssistantFacePreview = (who, face, level = 'normal') => {
  if (!cardAiDeckFlagOn() || !CARD_AI_FACES[who] || typeof CARD_BATTLE_DATA === 'undefined') return null;
  if (typeof face === 'string' && face.startsWith('h:')) {
    const e = cardAiHistoryOf(who).find((x) => `h:${x.id}` === face);
    if (!e) return null;
    const lv = CARD_AI_BUILD[level] ? level : 'normal';
    const d = cardAiFaceBuildWith(CARD_BATTLE_DATA, who, { ...e.spec, slot: e.slot }, lv, cardAiSeededRand(`face:${who}:${face}:${lv}`), {}, e.plan);
    return { monsters: d.monsters.slice(), cards: d.cards.slice(), styleId: cardAiDeckIdFace(face), slot: e.slot, side: null, name: e.name, line: null, at: 0, past: true, from: e.from, to: e.to };
  }
  const f = cardAiFaceOf(face) || 'oshi';
  const side = cardAiFaceSugaoSide(cardAiFaceMaterial(who));
  const slot = cardAiFaceSlotOf(f, side);
  const e = cardAiRecipeState && cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[slot];
  const deck = cardAiFacePreviewDeck(CARD_BATTLE_DATA, who, slot, e && e.plan, CARD_AI_BUILD[level] ? level : 'normal', e && e.style);
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
// 提案のデッキで初めて戦うとき(1回だけ・AI のひとことより先)。2026-11-08 部長の案・社長「やる」
const CARD_AI_DECK_WISH_LINES = Object.freeze({
  mua: '考えてくれた『{name}』でいくよ♪ まぢ嬉しい！全力だからね！',
  kiki: '考えてくれた『{name}』でお相手しまつ( ˘ω˘)',
  momosuke: '考えてくれた『{name}』、ももが使いこなしちゃうよ♡ 勝てるかな〜？w',
  kyuko: 'ほい、考えてくれた『{name}』でいくよぉ笑 ありがとね',
  dra: 'おで、考えてくれた『{name}』でいくぞ。えへへ、うれしいな。手加減しないからな',
  atsu: '考えてくれた『{name}』でいくわ笑 全力な！',
  sorashido: '考えてくれた『{name}』でいくぜ・・・！ これも計算済み笑',
  erubin: '考えてくれた『{name}』でいこうかな🤔 ありがとね笑',
});
const cardAiDeckVsLine = (who, pick) => {
  if (!pick) return null;
  if (pick.wishFirst && CARD_AI_DECK_WISH_LINES[who] && pick.name) return { t: CARD_AI_DECK_WISH_LINES[who].replace('{name}', pick.name), e: 'happy' };
  if (pick.line) return { t: pick.line, e: 'happy' };
  const tpl = CARD_AI_DECK_VS_LINES[who];
  return tpl && pick.name ? { t: tpl.replace('{name}', pick.name), e: 'happy' } : null;
};
