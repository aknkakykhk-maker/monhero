// MFバトルカード: 助手のデッキを AI で組む(3つのデッキ・83-card-ai-deck.jsx・2026-11-08 社長の決定)。ブラウザなしで見る。中継役は偽物の返事
//
//   node tools/card/card-ai-deck-check.js [--verbose]
//
// 見るもの
//   A. 保存の形(cardNormalizeAiRecipe): 無い・壊れているときは空・知らない助手は捨てる・方針は見張りを通す・名前12字/ひとこと60字・日付が変わると枠の数だけ0
//   B. 時期: 1日を8時間ずつ3つに分けた中の時刻(端末と日付で決まる・毎回同じ)・過ぎた枠の数
//   C. 組み直す時期か(会った助手だけ・10戦・枠)と、いちばん古い型
//   D. 揺らぎ(AI なし): くせは幅の中・prefer は候補の中で1〜2枚入れかわる・8枚まで・場のカードは候補の中
//   E. 対戦で出す型: 今の型6割・ほかの2つ2割ずつ・型が無ければ均等
//   F. 印(cardGrowStyle)が偽: 何も読まない・書かない・呼ばない(cardAssistantDeckPick も null=今の組み方)
//   G. 印が真: AI の返事で組む(名前・ひとことを残す)/遅れ(sorry)・上限(tired)・失敗・入切が切は揺らぎで組む(画面に違いは出さない)
//   H. 時期の組み直し: 会った助手だけ・1回で枠を追いつく・10戦で組み直して数を0に・いちばん古い型だけ
//   I. 対戦で出すデッキ: 保存した方針で組む・名前が無ければ既定の名前・VS のひとことは AI の line か既定の言い方
//   K. 今日のデッキ: 相手えらびで見せた型と対戦の型がそろう・1戦し終えたら決め直す・印が偽なら無い
//   J. 中継役へ送る材料: 候補24枚まで・場のカード・くせの幅・prefer [5,8]・型
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);

// 1つの箱で 82・戦術・83 を読む。保存・中継役・印・助手ライフの口は箱の外から差し替える
const makeBox = ({ flag = true, talkOpen = true, lifeStyle = null, fetchImpl = null } = {}) => {
  const store = new Map();
  const calls = [];
  const box = {
    console, Math, JSON, Object, Array, Number, String, Set, Map, Date, Promise, setTimeout, clearTimeout,
    store, calls,
    storeGet: async (k, d) => (store.has(k) ? JSON.parse(store.get(k)) : d),
    storeSet: async (k, v) => { store.set(k, JSON.stringify(v)); return true; },
    cardGrowStyleOn: () => flag,
    cardTalkOpen: () => talkOpen,
    cardTodayJst: () => '2026-11-08',
    ensureBreederId: async () => 'test-breeder',
    CARD_TALK_URL: 'https://example.invalid/functions/v1/card-assistant-talk',
    cardTalkSamples: () => ['見本'],
    fetch: fetchImpl ? async (url, init) => { calls.push(JSON.parse(init.body)); return fetchImpl(JSON.parse(init.body)); } : undefined,
    ...(lifeStyle ? { assistantLifeCardStyle: lifeStyle } : {}),
  };
  const ctx = vm.createContext(box);
  vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/83-card-ai-deck.jsx')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, CARD_SAVE_KEYS, CARD_AI_STYLE_IDS, CARD_AI_STYLE_NAMES, CARD_AI_PLAN_RANGE, CARD_AI_DECK_SLOTS, CARD_AI_DECK_GAMES, CARD_AI_DECK_VS_LINES, cardAiBuildDeck, cardAiSeededRand, cardAiPlanCandidates, cardAiPlanHabitRange,'
    + ' cardNormalizeAiRecipe, cardNormalizeAiDeck, cardAiDeckSlotTimes, cardAiDeckSlotsPassed, cardAiDeckDue, cardAiDeckOldest, cardAiDeckJitter, cardAiDeckPickStyle, cardAiDeckFacts,'
    + ' cardLoadAiRecipe, cardSaveAiDeck, cardAiDeckRebuild, cardAiDeckRunDue, cardAiDeckMarkMet, cardAiDeckAfterMatch, cardAssistantDeckPick, cardAiRecipeOf, cardAiDeckVsLine, cardAiDeckDefaultName, cardAiDeckNextStyle, cardAiDeckNextName, cardAiDeckNextDone };', ctx);
  return { E: ctx.E, store, calls };
};
const ok200 = (body) => ({ ok: true, json: async () => body });

(async () => {
  const { E } = makeBox();
  const db = E.CARD_BATTLE_DATA;
  const KEY = E.CARD_SAVE_KEYS.aiRecipe;
  check('保存のキーは mh_card_ai_recipe_v1・mh_card_ai_deck_v1', KEY === 'mh_card_ai_recipe_v1' && E.CARD_SAVE_KEYS.aiDeck === 'mh_card_ai_deck_v1');
  // ---- A ----
  {
    const empty = E.cardNormalizeAiRecipe(null, '2026-11-08');
    check('A 無いときは空', J(empty) === J({ v: 1, day: '2026-11-08', perWho: {} }));
    check('A 壊れた値も空', ['x', 3, [], { perWho: 'x' }].every((v) => J(E.cardNormalizeAiRecipe(v, '2026-11-08').perWho) === '{}'));
    const cand = E.cardAiPlanCandidates(db, 'kiki', 'master', E.cardAiBuildDeck(db, 'kiki', 'master', E.cardAiSeededRand('t')).monsters);
    const raw = { day: '2026-11-07', perWho: {
      kiki: { met: true, gamesSince: 7, slotsDone: 2, decks: { attack: { plan: { prefer: [cand[0].no, 'zzz', cand[1].no], field: ['灼熱の地', 'ないカード'], habit: { big: 9 } }, name: 'あ'.repeat(30), line: ' こんにちは\u0007 ', at: 123, ai: true }, mega: { at: 1 } } },
      nobody: { met: true }, mua: 'x' } };
    const n = E.cardNormalizeAiRecipe(raw, '2026-11-08');
    const k = n.perWho.kiki;
    check('A 知らない助手・壊れた助手は捨てる', J(Object.keys(n.perWho)) === J(['kiki']));
    check('A 日付が変わると枠の数だけ0(10戦の数と会った印・デッキは残す)', k.slotsDone === 0 && k.gamesSince === 7 && k.met === true && !!k.decks.attack);
    check('A 同じ日なら枠の数は残る', E.cardNormalizeAiRecipe({ ...raw, day: '2026-11-08' }, '2026-11-08').perWho.kiki.slotsDone === 2);
    check('A 知らない型は捨てる', J(Object.keys(k.decks)) === J(['attack']));
    check('A 方針は見張りを通す(候補外の番号・場のカードでない名前は捨てる・番号で持つ)', J(k.decks.attack.plan.prefer) === J([cand[0].no, cand[1].no]) && J(k.decks.attack.plan.field) === J(['灼熱の地']), J(k.decks.attack.plan));
    check('A 名前は12字・ひとことは制御文字を除いて60字まで', k.decks.attack.name.length === 12 && k.decks.attack.line === 'こんにちは', J([k.decks.attack.name, k.decks.attack.line]));
    check('A 入/切は無い・壊れているとき入', E.cardNormalizeAiDeck(null).on === true && E.cardNormalizeAiDeck({ on: false }).on === false && E.cardNormalizeAiDeck({ on: 'x' }).on === true);
  }
  // ---- B ----
  {
    const t = E.cardAiDeckSlotTimes('2026-11-08', 'abc');
    const start = Date.parse('2026-11-08T04:00:00+09:00');
    const H8 = 8 * 3600 * 1000;
    check('B 1日に3つ・それぞれ8時間の枠の中', t.length === E.CARD_AI_DECK_SLOTS && t.every((x, i) => x >= start + i * H8 && x < start + (i + 1) * H8));
    check('B 同じ端末・同じ日なら同じ時刻', J(t) === J(E.cardAiDeckSlotTimes('2026-11-08', 'abc')));
    check('B 端末か日が違えば時刻も違う', J(t) !== J(E.cardAiDeckSlotTimes('2026-11-08', 'xyz')) && J(t) !== J(E.cardAiDeckSlotTimes('2026-11-09', 'abc')));
    check('B 過ぎた枠の数', E.cardAiDeckSlotsPassed(t, start - 1) === 0 && E.cardAiDeckSlotsPassed(t, t[1]) === 2 && E.cardAiDeckSlotsPassed(t, start + 3 * H8) === 3);
  }
  // ---- C ----
  {
    check('C 会っていない助手は組み直さない', E.cardAiDeckDue({ met: false, gamesSince: 99, slotsDone: 0 }, 3) === null);
    check('C 10戦で組み直す', E.cardAiDeckDue({ met: true, gamesSince: 10, slotsDone: 3 }, 3) === 'games');
    check('C 過ぎた枠より少なければ組み直す', E.cardAiDeckDue({ met: true, gamesSince: 0, slotsDone: 1 }, 2) === 'slot' && E.cardAiDeckDue({ met: true, gamesSince: 9, slotsDone: 2 }, 2) === null);
    check('C いちばん古い型(無い型がいちばん古い)', E.cardAiDeckOldest({ decks: { attack: { at: 5 }, guard: { at: 3 } } }) === 'normal' && E.cardAiDeckOldest({ decks: { attack: { at: 5 }, guard: { at: 3 }, normal: { at: 9 } } }) === 'guard' && E.cardAiDeckOldest(null) === 'attack');
  }
  // ---- D ----
  {
    const trio = E.cardAiBuildDeck(db, 'mua', 'master', E.cardAiSeededRand('d')).monsters;
    const cands = E.cardAiPlanCandidates(db, 'mua', 'master', trio);
    const fields = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld').map((c) => c.name);
    const range = E.cardAiPlanHabitRange('mua', 'master', 'attack');
    const pool = cands.map((c) => c.no);
    let bad = 0, swapsOk = 0;
    let prev = null;
    for (let i = 0; i < 200; i++) {
      const p = E.cardAiDeckJitter(prev, { cands, fields, range, rnd: E.cardAiSeededRand(`j${i}`) });
      const inRange = Object.entries(range).every(([k, [lo, hi]]) => p.habit[k] >= lo && p.habit[k] <= hi);
      if (!inRange || !p.prefer.every((no) => pool.includes(no)) || p.prefer.length > 8 || new Set(p.prefer).size !== p.prefer.length || !p.field.every((f) => fields.includes(f)) || p.field.length > 2) bad++;
      if (prev) { const changed = p.prefer.filter((no) => !prev.prefer.includes(no)).length; if (changed >= 1 && changed <= 2) swapsOk++; }
      prev = p;
    }
    check('D 揺らぎは幅の中・候補の中・8枚まで・重なりなし・場のカードは2枚まで', bad === 0, `${bad}`);
    check('D 揺らぎで prefer が1〜2枚入れかわる(ほとんどの回)', swapsOk >= 180, `${swapsOk}/199`);
  }
  // ---- E ----
  {
    const count = (main) => { const c = { attack: 0, guard: 0, normal: 0 }; const r = E.cardAiSeededRand(`e:${main}`); for (let i = 0; i < 30000; i++) c[E.cardAiDeckPickStyle(main, r)]++; return c; };
    const g = count('guard');
    check('E 今の型が6割・ほか2割ずつ', Math.abs(g.guard / 30000 - 0.6) < 0.02 && Math.abs(g.attack / 30000 - 0.2) < 0.02 && Math.abs(g.normal / 30000 - 0.2) < 0.02, J(g));
    const n = count(null);
    check('E 型が無ければ3つ均等', Object.values(n).every((x) => Math.abs(x / 30000 - 1 / 3) < 0.02), J(n));
    const z = count('mega');
    check('E 知らない型も均等', Object.values(z).every((x) => Math.abs(x / 30000 - 1 / 3) < 0.02));
  }
  // ---- F ----
  {
    const off = makeBox({ flag: false, fetchImpl: () => ok200({ ok: true, kind: 'plan' }) });
    off.store.set(KEY, JSON.stringify({ day: '2026-11-08', perWho: { kiki: { met: true, gamesSince: 20, slotsDone: 0, decks: {} } } }));
    const before = J([...off.store]);
    const r1 = await off.E.cardAiDeckRunDue({ now: Date.parse('2026-11-08T23:00:00+09:00') });
    const r2 = await off.E.cardAiDeckMarkMet('mua');
    const r3 = await off.E.cardAiDeckAfterMatch('kiki');
    const r4 = await off.E.cardAiDeckRebuild('kiki', 'slot');
    check('F 印が偽: 組み直さない・印を付けない・数えない', J(r1) === '[]' && r2 === false && r3 === null && r4 === null);
    check('F 印が偽: 保存を書かず、中継役も呼ばない', J([...off.store]) === before && off.calls.length === 0);
    check('F 印が偽: 対戦で出すデッキの口は null(今の組み方)・保存の口も null', off.E.cardAssistantDeckPick('kiki') === null && off.E.cardAiRecipeOf('kiki', 'attack') === null);
  }
  // ---- G ----
  const aiReply = (body) => {
    const cands = body.facts.cards.map((c) => c.no);
    return ok200({ ok: true, kind: 'plan', name: 'ためしの名前', line: 'ためしのひとこと', prefer: cands.slice(0, 6), field: [body.facts.fields[0]], habit: { big: body.facts.habit.big[1], saveGuts: body.facts.habit.saveGuts[0], keepGuard: 99 }, remainingToday: 10 });
  };
  {
    const on = makeBox({ fetchImpl: aiReply });
    await on.E.cardLoadAiRecipe();
    const r = await on.E.cardAiDeckRebuild('kiki', 'slot', { now: 1000 });
    const saved = JSON.parse(on.store.get(KEY));
    const e = saved.perWho.kiki.decks[r.style];
    const body = on.calls[0];
    check('G AI の返事で組む: 名前・ひとこと・方針を残し、AI の印', r && r.ai === true && e.name === 'ためしの名前' && e.line === 'ためしのひとこと' && e.ai === true && e.plan.prefer.length === 6 && e.at === 1000, J(e));
    const range = on.E.cardAiPlanHabitRange('kiki', 'master', r.style);
    check('G 中継役へは deckPlan・型・候補・幅を送る', body.kind === 'deckPlan' && body.assistantId === 'kiki' && body.facts.style === r.style && body.facts.cards.length > 0 && body.facts.cards.length <= 24 && J(body.facts.habit) === J(range) && J(body.facts.prefer) === J([5, 8]));
    check('G 返ってきたくせが幅の外でも、組むときに幅へ丸める(デッキの決まりを守る)', on.E.cardAssistantDeckPick('kiki', on.E.cardAiSeededRand('g')).deck.cards.length === 50);
    for (const [label, impl] of [['遅れ(sorry)', () => ok200({ ok: true, kind: 'sorry', text: null })], ['上限(tired)', () => ok200({ ok: true, kind: 'tired', limited: 'total' })], ['失敗(500)', () => ({ ok: false, json: async () => null })], ['通らない', () => { throw new Error('net'); }]]) {
      const b = makeBox({ fetchImpl: impl });
      await b.E.cardLoadAiRecipe();
      const rr = await b.E.cardAiDeckRebuild('mua', 'slot', { now: 2000 });
      const s = JSON.parse(b.store.get(KEY)).perWho.mua.decks[rr.style];
      check(`G ${label}: 揺らぎで組む(AI の印なし・名前は無いまま=既定の名前を使う)`, rr.ai === false && s.ai === false && s.plan && s.plan.prefer.length > 0 && s.name === null, J(s));
    }
    const cut = makeBox({ fetchImpl: aiReply });
    await cut.E.cardLoadAiRecipe();
    await cut.E.cardSaveAiDeck(false);
    const rc = await cut.E.cardAiDeckRebuild('mua', 'slot');
    check('G 入/切が切: 中継役を呼ばず揺らぎで組む', rc.ai === false && cut.calls.length === 0);
    const noTalk = makeBox({ talkOpen: false, fetchImpl: aiReply });
    await noTalk.E.cardLoadAiRecipe();
    const rn = await noTalk.E.cardAiDeckRebuild('mua', 'slot');
    check('G AI を呼べない端末: 中継役を呼ばず揺らぎで組む', rn.ai === false && noTalk.calls.length === 0);
  }
  // ---- H ----
  {
    const h = makeBox({ fetchImpl: aiReply });
    const start = Date.parse('2026-11-08T04:00:00+09:00');
    h.store.set(KEY, JSON.stringify({ day: '2026-11-08', perWho: {
      kiki: { met: true, gamesSince: 0, slotsDone: 0, decks: { attack: { at: 50 }, guard: { at: 10 }, normal: { at: 30 } } },
      dra: { met: false, gamesSince: 0, slotsDone: 0, decks: {} } } }));
    const done = await h.E.cardAiDeckRunDue({ now: start + 24 * 3600 * 1000 - 1 });
    const saved = JSON.parse(h.store.get(KEY));
    check('H 会った助手だけ・1回で枠を追いつく(3つ過ぎても1回)・いちばん古い型だけ', J(done.map((x) => [x.who, x.style])) === J([['kiki', 'guard']]) && saved.perWho.kiki.slotsDone === 3 && saved.perWho.kiki.decks.attack.at === 50, J(done));
    const again = await h.E.cardAiDeckRunDue({ now: start + 24 * 3600 * 1000 - 1 });
    check('H 同じ枠では2回組み直さない', again.length === 0);
    for (let i = 0; i < 9; i++) await h.E.cardAiDeckAfterMatch('kiki');
    const before = h.calls.length;
    const n10 = await h.E.cardAiDeckAfterMatch('kiki');
    await new Promise((r) => setTimeout(r, 20));
    const s10 = JSON.parse(h.store.get(KEY)).perWho.kiki;
    check('H 10戦で裏で組み直し、数を0に戻す', n10 === 10 && h.calls.length === before + 1 && s10.gamesSince === 0, J({ n10, calls: h.calls.length - before, g: s10.gamesSince }));
    const met = await h.E.cardAiDeckMarkMet('dra');
    await new Promise((r) => setTimeout(r, 20));
    const sd = JSON.parse(h.store.get(KEY)).perWho.dra;
    check('H 会った印を付けると、まだ無いデッキを1つ組む', met === true && sd.met === true && Object.keys(sd.decks).length === 1);
  }
  // ---- I ----
  {
    const life = makeBox({ lifeStyle: () => 'guard', fetchImpl: aiReply });
    await life.E.cardLoadAiRecipe();
    await life.E.cardAiDeckRebuild('dra', 'slot', { now: 5 }); // attack(いちばん古い)を組む
    await life.E.cardLoadAiRecipe();
    const rnd = life.E.cardAiSeededRand('i');
    const picks = [...Array(300)].map(() => life.E.cardAssistantDeckPick('dra', rnd, 'master'));
    const att = picks.find((p) => p.styleId === 'attack');
    const saved = life.E.cardAiRecipeOf('dra', 'attack');
    const same = att && J(att.deck.cards.length) === '50' && att.name === 'ためしの名前' && att.line === 'ためしのひとこと' && J(att.plan) === J(saved.plan);
    check('I 保存した方針・名前・ひとことで組む', !!same, J(att && { name: att.name, line: att.line }));
    const gd = picks.find((p) => p.styleId === 'guard');
    check('I まだ組んでいない型は、今の組み方+既定の名前「◯◯・守り」(AI なしでも名前が出る)', !!gd && gd.plan === null && gd.name === `${life.E.CARD_AI_STYLE_NAMES.dra}・守り`, gd && gd.name);
    check('I 助手ライフの型(guard)がいちばん多く出る', picks.filter((p) => p.styleId === 'guard').length > 140);
    const v1 = life.E.cardAiDeckVsLine('dra', { name: 'のんびり長期戦', line: null });
    const v2 = life.E.cardAiDeckVsLine('dra', { name: 'x', line: 'AIのことば' });
    check('I VS のひとこと: AI の line が無ければ助手ごとの既定の言い方に名前を入れる', v1.t === life.E.CARD_AI_DECK_VS_LINES.dra.replace('{name}', 'のんびり長期戦') && v2.t === 'AIのことば' && v1.e === 'happy');
    check('I 8人とも既定の言い方がある', Object.keys(life.E.CARD_AI_STYLE_NAMES).every((w) => typeof life.E.CARD_AI_DECK_VS_LINES[w] === 'string' && life.E.CARD_AI_DECK_VS_LINES[w].includes('{name}')));
  }
  // ---- K ----
  {
    const k = makeBox({ lifeStyle: () => 'attack' });
    await k.E.cardLoadAiRecipe();
    const a1 = k.E.cardAiDeckNextStyle('mua');
    const same = [...Array(20)].every(() => k.E.cardAiDeckNextStyle('mua') === a1);
    const p = k.E.cardAssistantDeckPick('mua', k.E.cardAiSeededRand('k'), 'normal', {}, a1);
    check('K 今日のデッキ: 相手えらびで見せた型は、決め直すまで同じ・その型で対戦する', same && !!p && p.styleId === a1 && k.E.cardAiDeckNextName('mua') === p.name, J({ a1, p: p && p.styleId }));
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) { k.E.cardAiDeckNextDone('mua'); if (k.E.cardAiDeckNextStyle('mua') !== a1) changed = true; }
    check('K 1戦し終えたら決め直す(ほかの型も出る)', changed);
    const off = makeBox({ flag: false });
    check('K 印が偽: 今日のデッキは無い(null)', off.E.cardAiDeckNextStyle('mua') === null && off.E.cardAiDeckNextName('mua') === null);
  }
  // ---- J ----
  {
    const f = E.cardAiDeckFacts(db, 'sorashido', 'normal');
    check('J 材料: 型・好きなモンスター・候補24枚まで・場のカード・幅・prefer', f.facts.style === 'normal' && f.facts.favorites.length >= 1 && f.facts.cards.length > 0 && f.facts.cards.length <= 24
      && f.facts.cards.every((c) => typeof c.no === 'string' && typeof c.name === 'string' && typeof c.area === 'boolean') && f.facts.fields.length >= 10 && J(f.facts.prefer) === J([5, 8]) && Object.keys(f.facts.habit).length === 3);
    check('J 自由な文は送らない(材料は数字と名前だけ)', !/text|message|prompt/i.test(Object.keys(f.facts).join(',')));
  }

  if (fails.length) {
    console.error(`助手のデッキを AI で組む: NG ${fails.length}件(OK ${passed}件)`);
    fails.forEach((x) => console.error(`  NG: ${x}`));
    process.exit(1);
  }
  console.log(`助手のデッキを AI で組む: OK ${passed}件`);
})().catch((e) => { console.error(e); process.exit(1); });
