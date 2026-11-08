// ===== MFバトルカード: 助手のデッキを AI で組む(3つのデッキ・2026-11-08 社長の決定) =====
// 助手ごとに型(attack/guard/normal)ごとのデッキを3つ持つ。時期が来たら3つのうち「いちばん古い1つ」だけを組み直す。
//   組み直すときは中継役(card-assistant-talk の deckPlan)に方針を聞く。使えない(切・上限・失敗・遅れ)ときは、型の中の小さな揺らぎで組み直す(画面に違いは出さない)
//   対戦で出すデッキは、助手ライフの今の型(assistantLifeCardStyle)を6割・ほかの2つを2割ずつ(型が無ければ均等)
// ★全部、公開の印 RELEASE_FLAGS.cardGrowStyle(84 の cardGrowStyleOn)で止める。偽のあいだは何も読まない・書かない・呼ばない
// ★保存は新しいキーだけ(CARD_SAVE_KEYS.aiRecipe・aiDeck)。画面は持たない(node の検査で読めるように JSX を書かない)
// ★82 の型・方針の口(cardAiBuildDeck の opts.style・opts.plan、cardAiPlanClean・cardAiPlanCandidates・cardAiPlanHabitRange)の上に作る
// 進捗メモ: docs/progress/card-grow-style/AI-DECK-PROGRESS.md
const CARD_AI_RECIPE_KEY = CARD_SAVE_KEYS.aiRecipe; // mh_card_ai_recipe_v1
const CARD_AI_DECK_KEY = CARD_SAVE_KEYS.aiDeck;     // mh_card_ai_deck_v1
const CARD_AI_DECK_GAMES = 10;      // その助手と何戦ごとに組み直すか
const CARD_AI_DECK_SLOTS = 3;       // 1日に何回(朝4時区切りの1日を8時間ずつに分け、その中の時刻は端末と日付の種で決める)
const CARD_AI_DECK_WAIT_MS = 16000; // 中継役を待つ長さ(中継役の側は15秒)
const CARD_AI_DECK_MAIN = 0.6;      // 助手ライフの今の型を出す割合(残りはほかの2つで半分ずつ)
const CARD_AI_DECK_JITTER = 0.25;   // 揺らぎ: くせを幅の何割まで動かすか
const CARD_AI_DECK_NAME_MAX = 12;
const CARD_AI_DECK_LINE_MAX = 60;

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
// 保存の全体。無い・壊れているときは空。日付が変われば、枠の数(slotsDone)だけ0に戻す(デッキと10戦の数はそのまま)
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
    const n = (x, max) => (Number.isInteger(x) && x >= 0 ? Math.min(max, x) : 0);
    perWho[who] = { met: w.met === true, gamesSince: n(w.gamesSince, 9999), slotsDone: sameDay ? n(w.slotsDone, CARD_AI_DECK_SLOTS) : 0, decks };
  }
  return { v: 1, day: typeof today === 'string' ? today : '', perWho };
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
// 3つのうちいちばん古い型(まだ無い型がいちばん古い。同じなら attack → guard → normal の順)
const cardAiDeckOldest = (w) => {
  const decks = (w && w.decks) || {};
  return CARD_AI_STYLE_IDS.slice().sort((a, b) => ((decks[a] && decks[a].at) || 0) - ((decks[b] && decks[b].at) || 0))[0];
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

// ---- 対戦で出す型 ----
// main(助手ライフの今の型)を6割・ほかの2つを2割ずつ。main が無ければ3つ均等
const cardAiDeckPickStyle = (main, rnd) => {
  const r = rnd();
  const m = cardAiStyleOf(main);
  if (!m) return CARD_AI_STYLE_IDS[Math.min(CARD_AI_STYLE_IDS.length - 1, Math.floor(r * CARD_AI_STYLE_IDS.length))];
  if (r < CARD_AI_DECK_MAIN) return m;
  const others = CARD_AI_STYLE_IDS.filter((s) => s !== m);
  return others[(r - CARD_AI_DECK_MAIN) < (1 - CARD_AI_DECK_MAIN) / 2 ? 0 : 1];
};
// 既定の名前(AI が名前を付けられない・見張りに落ちたとき)。社長 Q4 A: 8つの名前に型を添える(82 の cardAiStyleDefaultName)
const cardAiDeckDefaultName = (who, style) => cardAiStyleDefaultName(who, style);

// ---- 中継役へ送る材料(数字と名前だけ) ----
// 候補はその助手の「いつもの3体」(プレビューと同じ種)で組んだときの上位の札。場のカードは全部
const cardAiDeckFacts = (db, who, style) => {
  const trio = cardAiBuildDeck(db, who, 'master', cardAiSeededRand(`preview:${who}:${style}:master`), { style }).monsters;
  const cands = cardAiPlanCandidates(db, who, 'master', trio);
  const fields = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld').map((c) => c.name);
  return {
    trio, cands, fields,
    range: cardAiPlanHabitRange(who, 'master', style),
    facts: {
      style,
      favorites: trio.map((no) => (db.monsters[no] || {}).name).filter(Boolean).slice(0, 5),
      cards: cands.map((c) => ({ no: c.no, name: c.name, kind: c.kind, guts: c.guts, damage: Number.isFinite(c.damage) ? c.damage : null, user: c.user, area: !!cardHasEff(c, 'area') })),
      fields,
      habit: cardAiPlanHabitRange(who, 'master', style),
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
const cardLoadAiRecipe = async () => {
  try { cardAiRecipeState = cardNormalizeAiRecipe(await storeGet(CARD_AI_RECIPE_KEY, null), cardAiDeckToday()); } catch (_) { cardAiRecipeState = cardNormalizeAiRecipe(null, cardAiDeckToday()); }
  try { cardAiDeckSetting = cardNormalizeAiDeck(await storeGet(CARD_AI_DECK_KEY, null)); } catch (_) { cardAiDeckSetting = { on: true }; }
  return cardAiRecipeState;
};
const cardSaveAiRecipe = async (next) => {
  cardAiRecipeState = next;
  try { return await storeSet(CARD_AI_RECIPE_KEY, next); } catch (_) { return false; }
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
// 1人の助手の、いちばん古い型を組み直す(AI か揺らぎ)。reason: 'slot'(時刻の枠)/'games'(10戦)/'first'(まだ1つも無い)
const cardAiDeckBusy = new Set();
const cardAiDeckRebuild = async (who, reason, opts = {}) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || cardAiDeckBusy.has(who) || typeof CARD_BATTLE_DATA === 'undefined') return null;
  cardAiDeckBusy.add(who);
  try {
    const db = CARD_BATTLE_DATA;
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    // いちばん古い型は、保存を読み直してから選ぶ(手元の控えが古いことがある)
    const before = cardNormalizeAiRecipe(await storeGet(CARD_AI_RECIPE_KEY, null).catch(() => null), cardAiDeckToday());
    const style = cardAiDeckOldest(before.perWho[who] || null);
    const f = cardAiDeckFacts(db, who, style);
    const got = await cardAiDeckFetch(who, f.facts);
    // 読み直してから書く(待っているあいだにほかの所が書いたぶんを消さない)
    const cur = cardNormalizeAiRecipe(await storeGet(CARD_AI_RECIPE_KEY, null).catch(() => null), cardAiDeckToday());
    const w = cur.perWho[who] || { met: true, gamesSince: 0, slotsDone: 0, decks: {} };
    const prev = w.decks[style] || null;
    const plan = got && cardAiPlanClean(db, got.plan) ? got.plan : cardAiDeckJitter(prev && prev.plan, { cands: f.cands, fields: f.fields, range: f.range, rnd: cardAiSeededRand(`jitter:${who}:${style}:${now}`) });
    const entry = cardAiDeckEntryOf({ plan, name: got ? got.name : (prev && prev.name), line: got ? got.line : (prev && prev.line), at: now, ai: !!got }, db);
    const passed = Number.isFinite(opts.passed) ? opts.passed : w.slotsDone;
    const nextW = { ...w, met: true, decks: { ...w.decks, [style]: entry }, gamesSince: reason === 'games' ? 0 : w.gamesSince, slotsDone: reason === 'slot' ? Math.max(w.slotsDone, passed) : w.slotsDone };
    const next = { ...cur, perWho: { ...cur.perWho, [who]: nextW } };
    await cardSaveAiRecipe(next);
    return { who, style, ai: !!got };
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
  const cur = cardNormalizeAiRecipe(await storeGet(CARD_AI_RECIPE_KEY, null).catch(() => null), cardAiDeckToday());
  const w = cur.perWho[who];
  if (w && w.met) { cardAiRecipeState = cur; return true; }
  await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: { met: true, gamesSince: 0, slotsDone: 0, decks: {}, ...(w || {}), ...{ met: true } } } });
  void cardAiDeckRebuild(who, 'slot');
  return true;
};
// その助手と1戦し終えた(助手と対戦の結果を書いたあと)。10戦で裏で組み直す
const cardAiDeckAfterMatch = async (who) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who]) return null;
  const cur = cardNormalizeAiRecipe(await storeGet(CARD_AI_RECIPE_KEY, null).catch(() => null), cardAiDeckToday());
  const w = cur.perWho[who] || { met: true, gamesSince: 0, slotsDone: 0, decks: {} };
  const nextW = { ...w, met: true, gamesSince: w.gamesSince + 1 };
  await cardSaveAiRecipe({ ...cur, perWho: { ...cur.perWho, [who]: nextW } });
  if (nextW.gamesSince >= CARD_AI_DECK_GAMES) void cardAiDeckRebuild(who, 'games');
  return nextW.gamesSince;
};
// 助手ライフの今の型(読むだけ。無い・壊れているときは null)
const cardAiDeckLifeStyle = (who) => { try { return typeof assistantLifeCardStyle === 'function' ? cardAiStyleOf(assistantLifeCardStyle(who)) : null; } catch (_) { return null; } };
// 対戦で出すデッキ(読むだけ。助手と対戦の 84 と、助手どうしの対戦(助手ライフ・キズナ2)が使う)。印が偽なら null(呼ぶ側は今の組み方)
//   返り値 { styleId, name, line, plan, deck }。deck は cardAiBuildDeck の物(level は既定 'normal')
const cardAssistantDeckPick = (who, rand = Math.random, level = 'normal', extra = {}) => {
  if (!cardAiDeckFlagOn() || !CARD_AI_DECKS[who] || typeof CARD_BATTLE_DATA === 'undefined') return null;
  const rnd = typeof rand === 'function' ? rand : Math.random;
  const styleId = cardAiDeckPickStyle(cardAiDeckLifeStyle(who), rnd);
  const e = (cardAiRecipeState && cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[styleId]) || null;
  const plan = e && e.plan ? e.plan : null;
  const deck = cardAiBuildDeck(CARD_BATTLE_DATA, who, CARD_AI_BUILD[level] ? level : 'normal', rnd, { ...extra, style: styleId, ...(plan ? { plan } : {}) });
  return { styleId, name: (e && e.name) || cardAiDeckDefaultName(who, styleId), line: (e && e.line) || null, plan, deck };
};
// 保存してある型のデッキ(読むだけ。82 の cardAssistantDeckPreview が型ごとの plan・name・line・at を読む)。印が偽なら null
const cardAiRecipeOf = (who, styleId) => {
  if (!cardAiDeckFlagOn() || !cardAiRecipeState) return null;
  const e = cardAiRecipeState.perWho[who] && cardAiRecipeState.perWho[who].decks[styleId];
  return e ? { plan: e.plan, name: e.name, line: e.line, at: e.at } : null;
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
