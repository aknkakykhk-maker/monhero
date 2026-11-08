// MFバトルカード: 助手の推し・好き・素顔のデッキ(83-card-ai-deck.jsx・2026-11-08 社長の決定で3つの型から作り直し)。ブラウザなしで見る。中継役は偽物の返事
//
//   node tools/card/card-ai-deck-check.js [--verbose]
//
// 見るもの
//   A. 保存: 新しいキー mh_card_ai_recipe_v2 に書く・前の v1 は読むだけ(v2 が無いとき会った印・10戦の数・その日の枠の数だけ引きつぐ。v1 を書きかえない)・
//      無い・壊れているときは空・知らない助手と知らない枠は捨てる・方針は見張りを通す・名前12字/ひとこと60字・日付が変わると枠の数だけ0
//   B. 時期: 1日を8時間ずつ3つに分けた中の時刻(端末と日付で決まる)・過ぎた枠の数
//   C. 組み直す時期(会った助手だけ・10戦・枠)と、いちばん古い顔(今見えている 推し・好き・素顔の今の側 の中で)
//   D. 揺らぎ(AI なし): くせは幅の中・prefer は候補の中で1〜2枚入れかわる・8枚まで・場のカードは候補の中
//   E. 対戦で出す顔: 今の気分に合う顔6割・ほかの2つ2割ずつ・分からなければ均等
//   F. 印(cardGrowStyle)が偽: 何も読まない・書かない・呼ばない(cardAssistantDeckPick も null=今の組み方)
//   G. 印が真: AI の返事で組む(名前・ひとことを残す)/遅れ・上限・失敗・入切が切は揺らぎで組む/決まりに合わない名前は既定の名前
//   H. 組み直し: 会った助手だけ・1回で枠を追いつく・10戦で組み直して数を0に・いちばん古い顔だけ
//   I. 対戦で出すデッキ: 保存した方針で組む・名前が無ければ既定・VS のひとことは AI の line か既定の言い方・今日のデッキがそろう
//   J. 中継役へ送る材料: 候補24枚まで・場のカード・くせの幅・型・顔・主役・方針
//   L. 顔ごとの中身(社長 Q1・Q3 A): 8人 × 4つ(推し・好き・よそいき・本音)が、どの強さでも3体そろう・主役の系統が先頭・
//      見える組み合わせのどれも、カードの重なり4割まで・主役3体は2体以上ちがう(MASTER で組んだ並び)
//   M. 名前(社長 Q2 A): 既定の名前32がそろう・3つ(素顔は よそいき・本音 の両方)で同じことばを使わない・見張りを通る/
//      見張りは「攻め・守り・ふつう」「◯◯・攻め」の形・ほかと同じことば・推しと好きで主役の無い名前を落とす
//   N. 材料の口(assistantLifeCardMaterial): 無ければ よそいき・均等/仲良し度で本音・face で6割の顔/壊れた値は無視
//   O. 82 は face を渡さなければ今と同じ(大会・サーバーと同じ組み方。同じ種なら同じデッキ)
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
const SLOTS = ['oshi', 'suki', 'yoso', 'honne'];
const PAIRS = [['oshi', 'suki'], ['oshi', 'yoso'], ['suki', 'yoso'], ['oshi', 'honne'], ['suki', 'honne']];

// 1つの箱で 82・戦術・83 を読む。保存・中継役・印・助手ライフの口は箱の外から差し替える
const makeBox = ({ flag = true, talkOpen = true, material = null, fetchImpl = null, store: init = null } = {}) => {
  const store = new Map(init || []);
  const calls = [];
  const writes = [];
  const box = {
    console, Math, JSON, Object, Array, Number, String, Set, Map, Date, Promise, setTimeout, clearTimeout,
    store, calls,
    storeGet: async (k, d) => (store.has(k) ? JSON.parse(store.get(k)) : d),
    storeSet: async (k, v) => { writes.push(k); store.set(k, JSON.stringify(v)); return true; },
    cardGrowStyleOn: () => flag,
    cardTalkOpen: () => talkOpen,
    cardTodayJst: () => '2026-11-08',
    ensureBreederId: async () => 'test-breeder',
    CARD_TALK_URL: 'https://example.invalid/functions/v1/card-assistant-talk',
    cardTalkSamples: () => ['見本'],
    fetch: fetchImpl ? async (url, init2) => { calls.push(JSON.parse(init2.body)); return fetchImpl(JSON.parse(init2.body)); } : undefined,
    ...(material ? { assistantLifeCardMaterial: material } : {}),
  };
  const ctx = vm.createContext(box);
  vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/83-card-ai-deck.jsx')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, CARD_SAVE_KEYS, CARD_AI_STYLE_NAMES, CARD_AI_PLAN_RANGE, CARD_AI_DECK_SLOTS, CARD_AI_DECK_GAMES, CARD_AI_DECK_VS_LINES, CARD_AI_FACES, CARD_AI_FACE_SHARE_MAX, CARD_AI_FACE_TRIO_DIFF, CARD_AI_HONNE_LV, CARD_AI_BUILD,'
    + ' cardAiBuildDeck, cardAiSeededRand, cardAiPlanCandidates, cardAiPlanHabitRange,'
    + ' cardNormalizeAiRecipe, cardNormalizeAiRecipe2, cardNormalizeAiDeck, cardAiDeckSlotTimes, cardAiDeckSlotsPassed, cardAiDeckDue, cardAiDeckOldest, cardAiDeckJitter, cardAiDeckPickFace, cardAiDeckFacts,'
    + ' cardLoadAiRecipe, cardSaveAiDeck, cardAiDeckRebuild, cardAiDeckRunDue, cardAiDeckMarkMet, cardAiDeckAfterMatch, cardAssistantDeckPick, cardAiRecipeOf, cardAiDeckVsLine, cardAiDeckNextStyle, cardAiDeckNextName, cardAiDeckNextDone,'
    + ' cardAiFaceGroups, cardAiFaceSpec, cardAiFaceBuild, cardAiFacePreviewDeck, cardAiFaceShare, cardAiFaceTrioDiff, cardAiFaceDefaultName, cardAiFaceNameOk, cardAiFaceShareWord, cardAiFaceOtherNames, cardAiFaceLineOf, cardAiFaceLayout,'
    + ' cardAiFaceMaterial, cardAiFaceSugaoSide, cardAiFaceMain, cardAiDeckMainFace, cardAssistantFacePreview, cardAiFaceName };', ctx);
  return { E: ctx.E, store, calls, writes };
};
const ok200 = (body) => ({ ok: true, json: async () => body });

(async () => {
  const { E } = makeBox();
  const db = E.CARD_BATTLE_DATA;
  const KEY1 = E.CARD_SAVE_KEYS.aiRecipe;
  const KEY2 = E.CARD_SAVE_KEYS.aiRecipe2;
  const WHO = Object.keys(E.CARD_AI_FACES);
  check('保存のキーは mh_card_ai_recipe_v2(前の v1・入/切のキーは残す)', KEY2 === 'mh_card_ai_recipe_v2' && KEY1 === 'mh_card_ai_recipe_v1' && E.CARD_SAVE_KEYS.aiDeck === 'mh_card_ai_deck_v1');
  check('顔の表は8人', WHO.length === 8 && ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].every((w) => WHO.includes(w)), J(WHO));
  // ---- A ----
  {
    const empty = E.cardNormalizeAiRecipe2(null, '2026-11-08');
    check('A 無いときは空', J(empty) === J({ v: 2, day: '2026-11-08', perWho: {} }));
    check('A 壊れた値も空', ['x', 3, [], { perWho: 'x' }].every((v) => J(E.cardNormalizeAiRecipe2(v, '2026-11-08').perWho) === '{}'));
    const trio = E.cardAiFacePreviewDeck(db, 'kiki', 'oshi').monsters;
    const cand = E.cardAiPlanCandidates(db, 'kiki', 'master', trio);
    const raw = { v: 2, day: '2026-11-07', perWho: {
      kiki: { met: true, gamesSince: 7, slotsDone: 2, decks: { oshi: { plan: { prefer: [cand[0].no, 'zzz', cand[1].no], field: ['灼熱の地', 'ないカード'], habit: { big: 9 } }, name: 'あ'.repeat(30), line: ' こんにちは\u0007 ', at: 123, ai: true }, attack: { at: 1 }, honne: { at: 4 } } },
      nobody: { met: true }, mua: 'x' } };
    const n = E.cardNormalizeAiRecipe2(raw, '2026-11-08');
    const k = n.perWho.kiki;
    check('A 知らない助手・壊れた助手は捨てる', J(Object.keys(n.perWho)) === J(['kiki']));
    check('A 日付が変わると枠の数だけ0(10戦の数と会った印・デッキは残す)', k.slotsDone === 0 && k.gamesSince === 7 && k.met === true && !!k.decks.oshi);
    check('A 同じ日なら枠の数は残る', E.cardNormalizeAiRecipe2({ ...raw, day: '2026-11-08' }, '2026-11-08').perWho.kiki.slotsDone === 2);
    check('A 知らない枠(前の型 attack など)は捨てる', J(Object.keys(k.decks).sort()) === J(['honne', 'oshi']), J(Object.keys(k.decks)));
    check('A 方針は見張りを通す(候補外の番号・場のカードでない名前は捨てる・番号で持つ)', J(k.decks.oshi.plan.prefer) === J([cand[0].no, cand[1].no]) && J(k.decks.oshi.plan.field) === J(['灼熱の地']), J(k.decks.oshi.plan));
    check('A 名前は12字・ひとことは制御文字を除いて60字まで', k.decks.oshi.name.length === 12 && k.decks.oshi.line === 'こんにちは', J([k.decks.oshi.name, k.decks.oshi.line]));
    const v1 = { day: '2026-11-08', perWho: { kiki: { met: true, gamesSince: 4, slotsDone: 1, decks: { attack: { at: 5, name: 'まえの名前' } } } } };
    const from1 = E.cardNormalizeAiRecipe2(null, '2026-11-08', v1);
    check('A v2 が無いときは v1 から会った印・10戦の数・その日の枠の数だけ引きつぐ(型のデッキは持ってこない)', J(from1.perWho.kiki) === J({ met: true, gamesSince: 4, slotsDone: 1, decks: {} }), J(from1.perWho));
    check('A v2 があれば v1 は見ない', J(E.cardNormalizeAiRecipe2({ v: 2, day: '2026-11-08', perWho: {} }, '2026-11-08', v1).perWho) === '{}');
    check('A 入/切は無い・壊れているとき入', E.cardNormalizeAiDeck(null).on === true && E.cardNormalizeAiDeck({ on: false }).on === false && E.cardNormalizeAiDeck({ on: 'x' }).on === true);
    // 本物の読み書き: v1 だけある端末で会う → v2 に書き、v1 はそのまま
    const v1text = JSON.stringify(v1);
    const b = makeBox({ store: [[KEY1, v1text]] });
    await b.E.cardAiDeckAfterMatch('kiki');
    check('A v1 だけの端末: 1戦すると v2 に書き(10戦の数 4→5)、v1 は書きかえない', b.store.get(KEY1) === v1text && JSON.parse(b.store.get(KEY2)).perWho.kiki.gamesSince === 5 && !b.writes.includes(KEY1), J(b.writes));
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
    check('C いちばん古い顔(無い顔がいちばん古い・素顔は今の側)', E.cardAiDeckOldest({ decks: { oshi: { at: 5 }, suki: { at: 3 } } }) === 'yoso'
      && E.cardAiDeckOldest({ decks: { oshi: { at: 5 }, suki: { at: 3 }, yoso: { at: 9 } } }) === 'suki'
      && E.cardAiDeckOldest({ decks: { oshi: { at: 5 }, suki: { at: 6 }, yoso: { at: 1 } } }, 'honne') === 'honne'
      && E.cardAiDeckOldest({ decks: { oshi: { at: 5 }, suki: { at: 6 }, yoso: { at: 1 }, honne: { at: 9 } } }, 'honne') === 'oshi');
  }
  // ---- D ----
  {
    const trio = E.cardAiFacePreviewDeck(db, 'mua', 'oshi').monsters;
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
    const count = (main) => { const c = { oshi: 0, suki: 0, sugao: 0 }; const r = E.cardAiSeededRand(`e:${main}`); for (let i = 0; i < 30000; i++) c[E.cardAiDeckPickFace(main, r)]++; return c; };
    const g = count('suki');
    check('E 今の気分に合う顔が6割・ほか2割ずつ', Math.abs(g.suki / 30000 - 0.6) < 0.02 && Math.abs(g.oshi / 30000 - 0.2) < 0.02 && Math.abs(g.sugao / 30000 - 0.2) < 0.02, J(g));
    const u = count(null);
    check('E 分からなければ3つ均等', Object.values(u).every((x) => Math.abs(x / 30000 - 1 / 3) < 0.02), J(u));
    const x = count('attack');
    check('E 知らない値(前の型など)も均等', Object.values(x).every((v) => Math.abs(v / 30000 - 1 / 3) < 0.02), J(x));
  }
  // ---- F ----
  {
    const b = makeBox({ flag: false, fetchImpl: () => ok200({ ok: true, kind: 'plan' }) });
    await b.E.cardLoadAiRecipe();
    const met = await b.E.cardAiDeckMarkMet('kiki');
    const after = await b.E.cardAiDeckAfterMatch('kiki');
    const due = await b.E.cardAiDeckRunDue();
    check('F 印が偽: 会った印・1戦・時期の組み直しは何もしない', met === false && after === null && J(due) === '[]');
    check('F 印が偽: 保存を書かない・中継役を呼ばない', b.store.size === 0 && b.calls.length === 0);
    check('F 印が偽: 対戦で出すデッキ・見せるデッキ・今日のデッキは null(今の組み方)', b.E.cardAssistantDeckPick('kiki') === null && b.E.cardAiRecipeOf('kiki', 'oshi') === null && b.E.cardAssistantFacePreview('kiki', 'oshi') === null && b.E.cardAiDeckNextStyle('kiki') === null && b.E.cardAiDeckMainFace('kiki') === null);
  }
  // ---- G ----
  {
    const reply = (body) => { const no = body.facts.cards.map((c) => c.no); return ok200({ ok: true, kind: 'plan', name: 'ごろべえ大暴れ', line: '組んでみまちた( ˘ω˘)', prefer: no.slice(0, 6), field: [body.facts.fields[0]], habit: { big: body.facts.habit.big[1] } }); };
    const b = makeBox({ fetchImpl: reply });
    await b.E.cardLoadAiRecipe();
    await b.E.cardAiDeckMarkMet('kiki');
    await new Promise((r) => setTimeout(r, 30));
    const s = JSON.parse(b.store.get(KEY2));
    const e = s.perWho.kiki.decks.oshi;
    check('G 会った助手は裏で推しから1つ組む(AI の返事)', !!e && e.ai === true && e.name === 'ごろべえ大暴れ' && e.line === '組んでみまちた( ˘ω˘)' && e.plan && e.plan.prefer.length > 0, J(e));
    check('G 中継役へは deckPlan で聞く(顔・主役つき)', b.calls.length === 1 && b.calls[0].kind === 'deckPlan' && b.calls[0].assistantId === 'kiki' && b.calls[0].facts.face === 'oshi' && b.calls[0].facts.lead === 'ごろべえ', J(b.calls[0] && b.calls[0].facts && { face: b.calls[0].facts.face, lead: b.calls[0].facts.lead }));
    // 決まりに合わない名前 → 既定の名前(保存は null・見せるのは既定)
    const badName = (name) => (body) => { const no = body.facts.cards.map((c) => c.no); return ok200({ ok: true, kind: 'plan', name, line: 'ひとこと', prefer: no.slice(0, 6), field: [], habit: {} }); };
    for (const [nm, why] of [['ずっしり火力・攻め', '「◯◯・攻め」の形'], ['攻めのごろべえ', '型のことば'], ['ごろべえの一撃パンチ', 'ほかのデッキと同じことば(一撃)'], ['大きい岩のチーム', '主役が無い']]) {
      const c = makeBox({ fetchImpl: badName(nm) });
      await c.E.cardLoadAiRecipe();
      await c.E.cardAiDeckMarkMet('kiki');
      await new Promise((r) => setTimeout(r, 30));
      const ee = JSON.parse(c.store.get(KEY2)).perWho.kiki.decks.oshi;
      // 「ごろべえの一撃パンチ」は推しの既定と同じことばだが、推し自身は自分の既定とくらべない。くらべるのは好き・よそいき・本音
      const want = nm === 'ごろべえの一撃パンチ' ? 'ok' : null;
      check(`G 名前の見張り: ${why}は既定の名前にする`, want === 'ok' ? ee.name === nm : ee.name === null && ee.ai === true, J(ee.name));
    }
    {
      const c = makeBox({ fetchImpl: badName('ずっしり一撃ごろべえ') });
      await c.E.cardLoadAiRecipe();
      await c.E.cardAiDeckMarkMet('kiki');
      await new Promise((r) => setTimeout(r, 30));
      const ee = JSON.parse(c.store.get(KEY2)).perWho.kiki.decks.oshi;
      check('G 名前の見張り: よそいきと同じことば(ずっしり)は既定の名前にする', ee.name === null, J(ee.name));
    }
    for (const [label, impl, talk] of [['遅れ(sorry)', () => ok200({ ok: true, kind: 'sorry', text: null }), true], ['上限(tired)', () => ok200({ ok: true, kind: 'tired', text: null }), true], ['失敗', () => { throw new Error('x'); }, true], ['AI を呼べない端末', () => ok200({}), false]]) {
      const c = makeBox({ fetchImpl: impl, talkOpen: talk });
      await c.E.cardLoadAiRecipe();
      await c.E.cardAiDeckMarkMet('kiki');
      await new Promise((r) => setTimeout(r, 30));
      const ee = JSON.parse(c.store.get(KEY2)).perWho.kiki.decks.oshi;
      check(`G ${label}: 揺らぎで組む(名前は既定)`, !!ee && ee.ai === false && ee.name === null && ee.plan && ee.plan.prefer.length > 0, J(ee));
    }
    const off = makeBox({ fetchImpl: reply });
    await off.E.cardLoadAiRecipe();
    await off.E.cardSaveAiDeck(false);
    await off.E.cardAiDeckMarkMet('kiki');
    await new Promise((r) => setTimeout(r, 30));
    check('G 入切が切: 中継役を呼ばず揺らぎで組む', off.calls.length === 0 && JSON.parse(off.store.get(KEY2)).perWho.kiki.decks.oshi.ai === false);
  }
  // ---- H ----
  {
    const b = makeBox({ fetchImpl: () => ok200({ ok: true, kind: 'sorry' }) });
    const at = (n) => ({ at: n, plan: null, name: null, line: null, ai: false });
    b.store.set(KEY2, JSON.stringify({ v: 2, day: '2026-11-08', perWho: { kiki: { met: true, gamesSince: 0, slotsDone: 0, decks: { oshi: at(5), suki: at(3), yoso: at(9) } }, mua: { met: false, gamesSince: 0, slotsDone: 0, decks: {} } } }));
    const done = await b.E.cardAiDeckRunDue({ now: Date.parse('2026-11-09T03:59:00+09:00') });
    const s = JSON.parse(b.store.get(KEY2));
    check('H 会った助手だけ・いちばん古い顔(好き)だけ組み直す', done.length === 1 && done[0].who === 'kiki' && done[0].slot === 'suki' && s.perWho.kiki.decks.suki.at > 9 && s.perWho.kiki.decks.oshi.at === 5 && !s.perWho.mua.decks.suki, J(done));
    check('H 1回で過ぎた枠に追いつく(3つ)', s.perWho.kiki.slotsDone === 3, s.perWho.kiki.slotsDone);
    const again = await b.E.cardAiDeckRunDue({ now: Date.parse('2026-11-09T03:59:00+09:00') });
    check('H 追いついたら組み直さない', J(again) === '[]');
    for (let i = 0; i < 9; i++) await b.E.cardAiDeckAfterMatch('kiki');
    check('H 9戦では組み直さない', JSON.parse(b.store.get(KEY2)).perWho.kiki.gamesSince === 9);
    await b.E.cardAiDeckAfterMatch('kiki');
    await new Promise((r) => setTimeout(r, 30));
    check('H 10戦で組み直して数を0に', JSON.parse(b.store.get(KEY2)).perWho.kiki.gamesSince === 0);
  }
  // ---- I ----
  {
    const b = makeBox();
    const trio = E.cardAiFacePreviewDeck(db, 'atsu', 'suki').monsters;
    const cand = E.cardAiPlanCandidates(db, 'atsu', 'master', trio);
    b.store.set(KEY2, JSON.stringify({ v: 2, day: '2026-11-08', perWho: { atsu: { met: true, gamesSince: 0, slotsDone: 0, decks: { suki: { plan: { prefer: [cand[0].no], field: [], habit: {} }, name: '師匠と朝練', line: '今日は師匠と朝練笑', at: 5, ai: true } } } } }));
    await b.E.cardLoadAiRecipe();
    const p = b.E.cardAssistantDeckPick('atsu', E.cardAiSeededRand('i'), 'master', {}, 'suki');
    check('I 保存した方針・名前・ひとことで組む', p && p.styleId === 'suki' && p.slot === 'suki' && p.name === '師匠と朝練' && p.line === '今日は師匠と朝練笑' && p.deck.cards.includes(cand[0].no), J(p && { styleId: p.styleId, name: p.name }));
    check('I 好きのデッキは主役(師匠=モッチー)が先頭', p && E.cardAiFaceLineOf(db.monsters[p.deck.monsters[0]]) === 'mocchi', p && p.deck.monsters[0]);
    const q = b.E.cardAssistantDeckPick('atsu', E.cardAiSeededRand('i2'), 'master', {}, 'oshi');
    check('I 名前が無ければ既定の名前', q && q.name === 'ドラゴンで正面突破' && q.line === null, q && q.name);
    check('I VS のひとことは AI の line、無ければ既定の言い方', J(b.E.cardAiDeckVsLine('atsu', p)) === J({ t: '今日は師匠と朝練笑', e: 'happy' }) && J(b.E.cardAiDeckVsLine('atsu', q)) === J({ t: '今日は『ドラゴンで正面突破』でいくわ笑 全力な！', e: 'happy' }));
    check('I VS の既定の言い方は8人ぶん', Object.keys(E.CARD_AI_DECK_VS_LINES).length === 8);
    const n1 = b.E.cardAiDeckNextStyle('atsu');
    check('I 今日のデッキは決めたら同じ(相手えらびと対戦がそろう)', ['oshi', 'suki', 'sugao'].includes(n1) && b.E.cardAiDeckNextStyle('atsu') === n1 && b.E.cardAiDeckNextName('atsu') === b.E.cardAiFaceName('atsu', n1));
    b.E.cardAiDeckNextDone('atsu');
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) { b.E.cardAiDeckNextDone('atsu'); changed = b.E.cardAiDeckNextStyle('atsu') !== n1; }
    check('I 1戦し終えたら決め直す', changed);
    const v = b.E.cardAssistantFacePreview('atsu', 'sugao');
    check('I 見せるデッキ: 素顔は今の側(口が無ければ よそいき)・50枚・3体', v && v.styleId === 'sugao' && v.slot === 'yoso' && v.side === 'yoso' && v.cards.length === 50 && v.monsters.length === 3 && v.name === '真っ向勝負', J(v && { slot: v.slot, name: v.name }));
  }
  // ---- J ----
  {
    const f = E.cardAiDeckFacts(db, 'erubin', 'honne');
    check('J 候補は24枚まで・番号と名前', f.facts.cards.length > 0 && f.facts.cards.length <= 24 && f.facts.cards.every((c) => c.no && c.name));
    check('J 場のカード・くせの幅・prefer [5,8]・型', f.facts.fields.length > 0 && Object.keys(f.facts.habit).length === 3 && J(f.facts.prefer) === J(E.CARD_AI_PLAN_RANGE.prefer) && f.facts.style === 'attack');
    check('J 顔・素顔の側・方針を送る', f.facts.face === 'sugao' && f.facts.side === 'honne' && typeof f.facts.policy === 'string' && /本音/.test(f.facts.policy));
    const g = E.cardAiDeckFacts(db, 'mua', 'suki');
    check('J 主役は愛称で送る(みゅあの好き=イブちゃん)', g.facts.lead === 'イブちゃん' && g.facts.face === 'suki' && g.facts.side === null);
  }
  // ---- L ----
  {
    const levels = Object.keys(E.CARD_AI_BUILD);
    let short = [], leadBad = [];
    for (const w of WHO) for (const sl of SLOTS) for (const lv of levels) for (let i = 0; i < 4; i++) {
      const d = E.cardAiFaceBuild(db, w, sl, lv, E.cardAiSeededRand(`l:${w}:${sl}:${lv}:${i}`));
      if (d.monsters.length !== 3 || d.cards.length !== 50) short.push(`${w}/${sl}/${lv}`);
      const spec = E.cardAiFaceSpec(db, w, sl);
      if (E.cardAiFaceLineOf(db.monsters[d.monsters[0]]) !== spec.lead) leadBad.push(`${w}/${sl}/${lv}:${d.monsters[0]}`);
    }
    check('L 8人×4つ×どの強さでも、3体・50枚そろう', short.length === 0, [...new Set(short)].slice(0, 6).join(' '));
    check('L 主役の系統が先頭(推し・好きは表の種・素顔は組の中でいちばん強い種)', leadBad.length === 0, [...new Set(leadBad)].slice(0, 6).join(' '));
    for (const w of WHO) {
      const sp = Object.fromEntries(SLOTS.map((sl) => [sl, E.cardAiFaceSpec(db, w, sl)]));
      const t = E.CARD_AI_FACES[w];
      check(`L ${w}: 推し・好きの主役は表どおり`, sp.oshi.lead === t.oshi.lead && sp.suki.lead === t.suki.lead && (!t.honne.lead || sp.honne.lead === t.honne.lead), J({ oshi: sp.oshi.lead, suki: sp.suki.lead, honne: sp.honne.lead }));
      const d = Object.fromEntries(SLOTS.map((sl) => [sl, E.cardAiFacePreviewDeck(db, w, sl)]));
      const bad = PAIRS.filter(([a, b]) => E.cardAiFaceShare(d[a], d[b]) > E.CARD_AI_FACE_SHARE_MAX || E.cardAiFaceTrioDiff(d[a], d[b]) < E.CARD_AI_FACE_TRIO_DIFF);
      check(`L ${w}: 見える組み合わせのどれも、カードの重なり4割まで・主役3体は2体以上ちがう`, bad.length === 0,
        bad.map(([a, b]) => `${a}-${b} ${Math.round(E.cardAiFaceShare(d[a], d[b]) * 100)}% ちがい${E.cardAiFaceTrioDiff(d[a], d[b])}`).join(' / '));
      check(`L ${w}: 決まりを守る振り分けが見つかる(蛇行の始まり6通りのどれか)`, E.cardAiFaceLayout(db, w).ok === true, J(E.cardAiFaceLayout(db, w).free));
      const g = E.cardAiFaceGroups(db, w);
      const all = [...g.oshi, ...g.suki, ...g.sugao];
      check(`L ${w}: 系統は3つの組に1回ずつ`, new Set(all).size === all.length, J(g));
    }
  }
  // ---- M ----
  {
    let missing = [], shared = [], guard = [];
    for (const w of WHO) {
      const names = Object.fromEntries(SLOTS.map((sl) => [sl, E.cardAiFaceDefaultName(w, sl)]));
      SLOTS.forEach((sl) => { if (!names[sl]) missing.push(`${w}/${sl}`); });
      PAIRS.forEach(([a, b]) => { if (E.cardAiFaceShareWord(names[a], names[b]) || E.cardAiFaceShareWord(names[b], names[a])) shared.push(`${w}: ${names[a]} / ${names[b]}`); });
      SLOTS.forEach((sl) => { if (!E.cardAiFaceNameOk(db, w, sl, names[sl], E.cardAiFaceOtherNames({ decks: {} }, w, sl))) guard.push(`${w}/${sl}:${names[sl]}`); });
      check(`M ${w}: よそいきの名前は今の8つの名前`, names.yoso === E.CARD_AI_STYLE_NAMES[w]);
    }
    check('M 既定の名前32がそろう', missing.length === 0, missing.join(' '));
    check('M 3つ(素顔は よそいき・本音 の両方)で同じことばを使わない', shared.length === 0, shared.join(' | '));
    check('M 既定の名前は全部、見張りを通る', guard.length === 0, guard.join(' '));
    check('M 名前に型のことば・「・攻め」が無い', WHO.every((w) => SLOTS.every((sl) => !/攻め|守り|ふつう/.test(E.cardAiFaceDefaultName(w, sl)))));
    check('M 「の」「と」など、ひらがな2文字までは同じことばに数えない', !E.cardAiFaceShareWord('もちの一番', 'ゴロ助の勝負') && E.cardAiFaceShareWord('ぜんぶ必殺', 'ぜんぶ見せ場') && E.cardAiFaceShareWord('大混乱', '大混乱だ'));
    check('M 名前の見張り: 「ステージ・オン」の形(今の名前の中の ・)は通す・「ステージ・オン・攻め」は落とす',
      E.cardAiFaceNameOk(db, 'momosuke', 'yoso', 'ステージ・オン', []) && !E.cardAiFaceNameOk(db, 'momosuke', 'yoso', 'ステージ・オン・攻め', []));
    check('M 名前の見張り: 推しは主役の愛称か種の名前・好きは表の遊び方のことばも通す',
      E.cardAiFaceNameOk(db, 'kiki', 'oshi', 'ゴーレム大行進', []) && E.cardAiFaceNameOk(db, 'kiki', 'suki', 'はやわざ乱れ打ち', []) && !E.cardAiFaceNameOk(db, 'kiki', 'suki', '桜と氷のチーム', []));
  }
  // ---- N ----
  {
    const m1 = makeBox({ material: (id) => (id === 'kiki' ? { friendLv: E.CARD_AI_HONNE_LV, mood: 'happy', face: 'suki' } : 'こわれた') });
    check('N 仲良し度が高いと本音・face で6割の顔', m1.E.cardAiFaceSugaoSide(m1.E.cardAiFaceMaterial('kiki')) === 'honne' && m1.E.cardAiFaceMain(m1.E.cardAiFaceMaterial('kiki')) === 'suki' && m1.E.cardAiDeckMainFace('kiki') === 'suki');
    check('N 壊れた材料は無視(よそいき・均等)', m1.E.cardAiFaceSugaoSide(m1.E.cardAiFaceMaterial('mua')) === 'yoso' && m1.E.cardAiFaceMain(m1.E.cardAiFaceMaterial('mua')) === null);
    const m2 = makeBox({ material: () => { throw new Error('x'); } });
    check('N 口が投げても よそいき・均等', m2.E.cardAiFaceSugaoSide(m2.E.cardAiFaceMaterial('kiki')) === 'yoso' && m2.E.cardAiFaceMain(m2.E.cardAiFaceMaterial('kiki')) === null);
    check('N 口が無ければ よそいき・均等', E.cardAiFaceSugaoSide(E.cardAiFaceMaterial('kiki')) === 'yoso' && E.cardAiFaceMain(E.cardAiFaceMaterial('kiki')) === null);
    check('N 仲良し度が足りなければ よそいき', E.cardAiFaceSugaoSide({ friendLv: E.CARD_AI_HONNE_LV - 1 }) === 'yoso');
    await m1.E.cardLoadAiRecipe();
    const p = m1.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('n'), 'master', {}, 'sugao');
    check('N 本音のときは本音の枠で組み、名前も本音', p && p.slot === 'honne' && p.name === 'ぜんぶ必殺技でつ', J(p && { slot: p.slot, name: p.name }));
  }
  // ---- O ----
  {
    const same = Object.keys(E.CARD_AI_FACES).every((w) => ['easy', 'normal', 'master'].every((lv) => J(E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`o:${w}:${lv}`))) === J(E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`o:${w}:${lv}`), { face: null }))));
    check('O 82: face を渡さなければ今と同じ(face: null も同じ)', same);
    const s82 = src('src/parts/82-card-battle-core.jsx');
    check('O 82: face は cardAiPickTrio に渡すだけ(大会・サーバーは渡さない)', /cardAiPickTrio\(db, who, levelId, rnd, opts && opts\.playerDeck, opts && opts\.face\)/.test(s82));
  }

  if (fails.length) {
    console.error(`助手の推し・好き・素顔のデッキ: NG ${fails.length}件(OK ${passed}件)`);
    fails.forEach((f) => console.error(`  NG: ${f}`));
    process.exit(1);
  }
  console.log(`助手の推し・好き・素顔のデッキ: OK ${passed}件`);
})();
