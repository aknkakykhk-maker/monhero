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
//   P. 組み直しの名前(社長 2026-11-08): 1つ目は既定・中身が変われば新しい名前(AI → 種+遊び方の言葉。一覧の名前は使わない)・前のデッキを「これまで」に10個まで・マスモンの愛称を使わない
//   Q. 選び方(これまでのデッキがあれば 5:1.5:1.5 + 2割を新しい順に)・遊ぶ人の選び口(昔のデッキとも戦える)・記録に deckId・deckFrom
//   W. 遊ぶ人の提案(assistantLifeDeckWish): 口が無ければ今のまま・次の組み直しで提案の顔を1回だけ・名前は見張りを通す(種族名+の+名前)・型だけ寄せる・使った印
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
const makeBox = ({ flag = true, talkOpen = true, material = null, fetchImpl = null, store: init = null, masmon = MASMON, wish = null } = {}) => {
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
    ...(masmon ? { ASSISTANT_MASMON_PLAN: masmon } : {}),
    ...(wish ? { assistantLifeDeckWish: wish } : {}),
  };
  const ctx = vm.createContext(box);
  vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/83-card-ai-deck.jsx')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, CARD_SAVE_KEYS, CARD_AI_STYLE_NAMES, CARD_AI_PLAN_RANGE, CARD_AI_DECK_SLOTS, CARD_AI_DECK_GAMES, CARD_AI_DECK_VS_LINES, CARD_AI_FACES, CARD_AI_FACE_SHARE_MAX, CARD_AI_FACE_TRIO_DIFF, CARD_AI_HONNE_LV, CARD_AI_BUILD,'
    + ' cardAiBuildDeck, cardAiSeededRand, cardAiPlanCandidates, cardAiPlanHabitRange,'
    + ' cardNormalizeAiRecipe, cardNormalizeAiRecipe2, cardNormalizeAiDeck, cardAiDeckSlotTimes, cardAiDeckSlotsPassed, cardAiDeckDue, cardAiDeckOldest, cardAiDeckJitter, cardAiDeckPickFace, cardAiDeckFacts,'
    + ' cardLoadAiRecipe, cardSaveAiDeck, cardAiDeckRebuild, cardAiDeckRunDue, cardAiDeckMarkMet, cardAiDeckAfterMatch, cardAssistantDeckPick, cardAiRecipeOf, cardAiDeckVsLine, cardAiDeckNextStyle, cardAiDeckNextName, cardAiDeckNextDone,'
    + ' cardAiFaceGroups, cardAiFaceSpec, cardAiFaceBuild, cardAiFacePreviewDeck, cardAiFaceShare, cardAiFaceTrioDiff, cardAiFaceDefaultName, cardAiFaceNameOk, cardAiFaceShareWord, cardAiFaceOtherNames, cardAiFaceLineOf, cardAiFaceLayout,'
    + ' cardAiFaceMaterial, cardAiFaceSugaoSide, cardAiFaceMain, cardAiDeckMainFace, cardAssistantFacePreview, cardAiFaceName,'
    + ' CARD_AI_HISTORY_MAX, CARD_AI_PLAY_WORDS, cardAiFaceNicks, cardNormalizeAiHistory, cardAiHistoryRead, cardAiDeckPickId, cardAiDeckNextId, cardAiDeckChoose, cardAiDeckChosen, cardAiDeckChoices, cardAiDeckPeriodText, cardAiFaceMakeName, cardAiDeckIdFace, cardAiWishOf, cardAiWishName, cardNormalizeAiWish, cardAiWishPlanOk, CARD_AI_WISH_PLAN_OK, cardAiDeckWishFought, CARD_AI_DECK_WISH_LINES };', ctx);
  return { E: ctx.E, store, calls, writes };
};
const ok200 = (body) => ({ ok: true, json: async () => body });
// 助手部のマスモンの表(56 の ASSISTANT_MASMON_PLAN)から、愛称だけを持った写し(名前の見張りで使う)
const MASMON = (() => {
  const m = src('src/parts/56-assistant-life-masmon.jsx').match(/const ASSISTANT_MASMON_PLAN = (\[[\s\S]*?\n\]);/);
  try { return m ? vm.runInNewContext(`(${m[1]})`) : null; } catch (_) { return null; }
})();

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
    const reply = (body) => { const no = body.facts.cards.map((c) => c.no); return ok200({ ok: true, kind: 'plan', name: 'ゴーレム大暴れ', line: '組んでみまちた( ˘ω˘)', prefer: no.slice(0, 6), field: [body.facts.fields[0]], habit: { big: body.facts.habit.big[1] } }); };
    const b = makeBox({ fetchImpl: reply });
    await b.E.cardLoadAiRecipe();
    await b.E.cardAiDeckMarkMet('kiki');
    await new Promise((r) => setTimeout(r, 30));
    const s = JSON.parse(b.store.get(KEY2));
    const e = s.perWho.kiki.decks.oshi;
    check('G 会った助手は裏で推しから1つ組む(AI の返事の方針・ひとこと。1つ目の名前は既定=保存は null)', !!e && e.ai === true && e.name === null && e.line === '組んでみまちた( ˘ω˘)' && e.plan && e.plan.prefer.length > 0, J(e));
    check('G 中継役へは deckPlan で聞く(顔・主役つき)', b.calls.length === 1 && b.calls[0].kind === 'deckPlan' && b.calls[0].assistantId === 'kiki' && b.calls[0].facts.face === 'oshi' && b.calls[0].facts.lead === 'ゴーレム', J(b.calls[0] && b.calls[0].facts && { face: b.calls[0].facts.face, lead: b.calls[0].facts.lead }));
    // 名前の見張り(AI の名前・自動で作る名前にかける)
    const others = E.cardAiFaceOtherNames({ decks: {} }, 'kiki', 'oshi');
    for (const [nm, why, want] of [['ずっしり火力・攻め', '「◯◯・攻め」の形', false], ['攻めのゴーレム', '型のことば', false], ['ゴーレムの一撃パンチ', '自分の既定と同じことば(一撃)は通す', true],
      ['大きい岩のチーム', '主役が無い', false], ['ごろべえの大行進', 'マスモンの愛称', false], ['ずっしりゴーレム', 'よそいきと同じことば(ずっしり)', false], ['ゴーレム大暴れ', '主役の種の名前', true]]) {
      check(`G 名前の見張り: ${why}`, E.cardAiFaceNameOk(db, 'kiki', 'oshi', nm, others) === want, nm);
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
    check('J 主役は種の名前で送る・マスモンの愛称は送らない(みゅあの好き=ジョーカー)', g.facts.lead === 'ジョーカー' && !JSON.stringify(g.facts).includes('イブちゃん') && !JSON.stringify(g.facts).includes('もち隊長') && g.facts.face === 'suki' && g.facts.side === null);
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
    const { E: E0 } = makeBox({ masmon: null });
    let missing = [], shared = [], guard = [];
    for (const w of WHO) {
      const names = Object.fromEntries(SLOTS.map((sl) => [sl, E.cardAiFaceDefaultName(w, sl)]));
      SLOTS.forEach((sl) => { if (!names[sl]) missing.push(`${w}/${sl}`); });
      PAIRS.forEach(([a, b]) => { if (E.cardAiFaceShareWord(names[a], names[b]) || E.cardAiFaceShareWord(names[b], names[a])) shared.push(`${w}: ${names[a]} / ${names[b]}`); });
      // 既定の名前は社長が決めた名前。愛称の見張り(AI・自動の名前にかける)は除いてくらべる(愛称の表の無い箱で見る)
      SLOTS.forEach((sl) => { if (!E0.cardAiFaceNameOk(db, w, sl, names[sl], E0.cardAiFaceOtherNames({ decks: {} }, w, sl))) guard.push(`${w}/${sl}:${names[sl]}`); });
      check(`M ${w}: よそいきの名前は今の8つの名前`, names.yoso === E.CARD_AI_STYLE_NAMES[w]);
    }
    check('M 既定の名前32がそろう', missing.length === 0, missing.join(' '));
    check('M 3つ(素顔は よそいき・本音 の両方)で同じことばを使わない', shared.length === 0, shared.join(' | '));
    check('M 既定の名前は全部、見張りを通る', guard.length === 0, guard.join(' '));
    check('M 名前に型のことば・「・攻め」が無い', WHO.every((w) => SLOTS.every((sl) => !/攻め|守り|ふつう/.test(E.cardAiFaceDefaultName(w, sl)))));
    check('M 「の」「と」など、ひらがな2文字までは同じことばに数えない', !E.cardAiFaceShareWord('もちの一番', 'ゴロ助の勝負') && E.cardAiFaceShareWord('ぜんぶ必殺', 'ぜんぶ見せ場') && E.cardAiFaceShareWord('大混乱', '大混乱だ'));
    check('M 名前の見張り: 「ステージ・オン」の形(今の名前の中の ・)は通す・「ステージ・オン・攻め」は落とす',
      E.cardAiFaceNameOk(db, 'momosuke', 'yoso', 'ステージ・オン', []) && !E.cardAiFaceNameOk(db, 'momosuke', 'yoso', 'ステージ・オン・攻め', []));
    check('M 名前の見張り: 推し・好きは主役の種の名前(みゅあの好きは表のことば「イブリス」も)',
      E.cardAiFaceNameOk(db, 'kiki', 'oshi', 'ゴーレム大行進', []) && E.cardAiFaceNameOk(db, 'kiki', 'suki', 'ライガー乱れ打ち', []) && !E.cardAiFaceNameOk(db, 'kiki', 'suki', '桜と氷のチーム', []) && E.cardAiFaceNameOk(db, 'mua', 'suki', 'イブリスの夜遊び', []));
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
  // ---- P: 組み直しの名前と、これまでのデッキ(社長 2026-11-08) ----
  {
    check('P マスモンの愛称を読める(助手部の表)・名前の見張りで落とす', MASMON && E.cardAiFaceNicks('kiki').includes('ごろべえ') && !E.cardAiFaceNameOk(db, 'kiki', 'oshi', 'ごろべえのゴーレム', []), J(E.cardAiFaceNicks('kiki')));
    check('P 遊び方の言葉にマスモンの愛称が入らない', WHO.every((w) => { const nicks = E.cardAiFaceNicks(w); return (E.CARD_AI_PLAY_WORDS[w] || []).every((n) => !nicks.some((k) => n.includes(k))); }));
    check('P 同じことばの見分け: まとまりの切れ目をまたがない(ハムの/ゴーレムの・ライガー/ライブは別)・漢字2字・カタカナのまとまり・ひらがな3字は同じ',
      !E.cardAiFaceShareWord('ハムの力くらべ', 'ゴーレムの一撃') && !E.cardAiFaceShareWord('ライガーの大歓声', 'メタルナーの銀ピカライブ') && E.cardAiFaceShareWord('ジョーカーの全力ダッシュ', 'ノリだけで全力突破') && E.cardAiFaceShareWord('キラキラ隊', 'キラキラ速攻') && E.cardAiFaceShareWord('ずっしりゴーレム', 'ずっしり火力'));
    check('P 遊び方の言葉は頭が「ど」でない(「〇〇のど…」が「のど」と読める。部長 2026-11-08)', WHO.every((w) => (E.CARD_AI_PLAY_WORDS[w] || []).every((x) => !/^ど/.test(x))), WHO.map((w) => (E.CARD_AI_PLAY_WORDS[w] || []).filter((x) => /^ど/.test(x)).join(',')).join(' '));
    {
      // チームの自動の名前のしめ(83-card-battle-vs.jsx の CARD_DECK_NAME_TAILS)と同じことばを使わない(VS で並んでまぎらわしい。部長 2026-11-08)
      const m = src('src/parts/83-card-battle-vs.jsx').match(/const CARD_DECK_NAME_TAILS = Object\.freeze\((\{[\s\S]*?\})\);/);
      const tails = m ? vm.runInNewContext(`(${m[1]})`) : null;
      const clash = tails ? WHO.flatMap((w) => (E.CARD_AI_PLAY_WORDS[w] || []).filter((x) => (tails[w] || []).some((t) => E.cardAiFaceShareWord(x, t))).map((x) => `${w}:${x}`)) : ['表が読めない'];
      check('P 遊び方の言葉は、チームの自動の名前のしめと同じことばを使わない', clash.length === 0, clash.join(' '));
    }
    check('P 遊び方の言葉は8人 × 5〜6個', WHO.every((w) => (E.CARD_AI_PLAY_WORDS[w] || []).length >= 5 && E.CARD_AI_PLAY_WORDS[w].length <= 6));
    // 名前づくり(AI なし): 種の名前+の+言葉。決まりに合い、使った名前は使わない
    const used = [];
    let made = 0, badMade = [];
    for (const w of WHO) for (const sl of SLOTS) {
      const others = E.cardAiFaceOtherNames({ decks: {} }, w, sl);
      const n = E.cardAiFaceMakeName(db, w, sl, others, used, E.cardAiSeededRand(`mk:${w}:${sl}`));
      if (!n) { badMade.push(`${w}/${sl}`); continue; }
      made++;
      if (!E.cardAiFaceNameOk(db, w, sl, n, others) || n.length > 12) badMade.push(`${w}/${sl}:${n}`);
    }
    check('P AI なしの新しい名前は、どの顔でも作れて決まりに合う(12字まで)', badMade.length === 0 && made === 32, badMade.slice(0, 4).join(' '));
    const hraw = { perWho: { kiki: [...Array(13).keys()].map((i) => ({ id: `oshi-${i + 1}`, slot: 'oshi', name: `名前${i}`, spec: { lead: 'golem', avoid: ['dragon'], keep: [], free: 1, style: 'normal' }, monsters: ['C-003'], top: ['zz', '100'], from: i * 10 + 1, to: i * 10 + 5 })), nobody: [], mua: 'x' } };
    const h = E.cardNormalizeAiHistory(hraw);
    check('P これまでのデッキは助手ごとに新しい順で10個まで・壊れたものは捨てる', h.perWho.kiki.length === E.CARD_AI_HISTORY_MAX && h.perWho.kiki[0].id === 'oshi-13' && !h.perWho.mua && !h.perWho.nobody && J(h.perWho.kiki[0].top) === J(['100']), J(h.perWho.kiki.map((e) => e.id).slice(0, 3)));
    check('P これまでのデッキの壊れた1つ(名前・主役が無い・知らない枠)は捨てる', E.cardNormalizeAiHistory({ perWho: { kiki: [{ id: 'a', slot: 'oshi', spec: { lead: 'golem' } }, { id: 'b', slot: 'zzz', name: 'x', spec: { lead: 'golem' } }, { id: 'c', slot: 'oshi', name: 'x', spec: {} }] } }).perWho.kiki === undefined);
    // 本物の組み直し: 1つ目は既定の名前 → 中身が変わったら新しい名前・前のデッキを残す
    const reply = (name) => (body) => { const no = body.facts.cards.map((c) => c.no); return ok200({ ok: true, kind: 'plan', name, line: 'ひとこと', prefer: no.slice(0, 6), field: [body.facts.fields[0]], habit: { big: body.facts.habit.big[1] } }); };
    const b = makeBox({ fetchImpl: reply('ゴーレム大暴れ') });
    await b.E.cardLoadAiRecipe();
    await b.E.cardAiDeckMarkMet('kiki');
    await new Promise((r) => setTimeout(r, 30));
    let s2 = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks.oshi;
    check('P 1つ目(まだ前が無い)は AI の名前を使わず既定の名前', s2.name === null && b.E.cardAiFaceName('kiki', 'oshi') === 'ゴーレムの一撃', J(s2.name));
    // 推しの前の方針を、今と大きく違うものに置きかえてから組み直す(札が2割以上入れかわる)
    const st = JSON.parse(b.store.get(KEY2));
    st.perWho.kiki.decks = { oshi: { ...st.perWho.kiki.decks.oshi, plan: { prefer: [], field: [], habit: { big: 0.8, saveGuts: 0.8, keepGuard: 1.1 } }, at: 1, since: 1 }, suki: { at: 50, since: 50, plan: null, name: null, line: null, ai: false }, yoso: { at: 60, since: 60, plan: null, name: null, line: null, ai: false } };
    b.store.set(KEY2, JSON.stringify(st));
    await b.E.cardAiDeckRebuild('kiki', 'games', { now: 1000 });
    s2 = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks.oshi;
    const hist = JSON.parse(b.store.get(E.CARD_SAVE_KEYS.aiDeckHistory) || 'null');
    const h0 = hist && hist.perWho.kiki && hist.perWho.kiki[0];
    check('P 中身が変わった組み直しは新しい名前(AI の名前)・前のデッキは「これまで」に名前と時期つきで残る', s2.name === 'ゴーレム大暴れ' && s2.since === 1000 && !!h0 && h0.name === 'ゴーレムの一撃' && h0.slot === 'oshi' && h0.from === 1 && h0.to === 1000 && h0.monsters.length === 3 && h0.spec.lead === 'golem', J({ name: s2.name, h0 }));
    // 同じ名前は使わない: もう一度変わったとき、AI が同じ名前を返したら 種+遊び方の言葉
    const st2 = JSON.parse(b.store.get(KEY2));
    st2.perWho.kiki.decks.oshi = { ...st2.perWho.kiki.decks.oshi, plan: { prefer: [], field: [], habit: { big: 1.25, saveGuts: 1.25, keepGuard: 0.8 } }, at: 2 };
    b.store.set(KEY2, JSON.stringify(st2));
    await b.E.cardAiDeckRebuild('kiki', 'games', { now: 2000 });
    const s3 = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks.oshi;
    const hist2 = (JSON.parse(b.store.get(E.CARD_SAVE_KEYS.aiDeckHistory) || 'null') || { perWho: {} }).perWho.kiki || [];
    check('P 一覧にある名前(今・これまで)は使わず、種+遊び方の言葉で新しい名前', s3.name !== 'ゴーレム大暴れ' && /^ゴーレムの/.test(s3.name || '') && E.CARD_AI_PLAY_WORDS.kiki.some((w) => s3.name === `ゴーレムの${w}`) && hist2.length === 2 && hist2[0].name === 'ゴーレム大暴れ', J({ name: s3.name, hist: hist2.map((e) => e.name) }));
    // 中身がほとんど変わらない組み直しは名前のまま・残さない
    const before = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks.oshi;
    const st3 = JSON.parse(b.store.get(KEY2)); st3.perWho.kiki.decks.suki.at = 99999; st3.perWho.kiki.decks.yoso.at = 99999; b.store.set(KEY2, JSON.stringify(st3));
    const c = makeBox({ fetchImpl: (body) => ok200({ ok: true, kind: 'plan', name: 'ゴーレム別名', line: 'x', prefer: before.plan.prefer, field: before.plan.field, habit: before.plan.habit }), store: [...b.store.entries()] });
    await c.E.cardLoadAiRecipe();
    await c.E.cardAiDeckRebuild('kiki', 'games', { now: 3000 });
    const s4 = JSON.parse(c.store.get(KEY2)).perWho.kiki.decks.oshi;
    check('P 中身が同じ組み直しは名前のまま・これまでのデッキに足さない', s4.name === before.name && s4.since === before.since && ((JSON.parse(c.store.get(E.CARD_SAVE_KEYS.aiDeckHistory) || 'null') || { perWho: {} }).perWho.kiki || []).length === 2, J({ name: s4.name, since: s4.since }));
  }
  // ---- Q: 選び方と、遊ぶ人の選び口(社長 Q1・Q2) ----
  {
    const hist = [{ id: 'oshi-1' }, { id: 'suki-2' }, { id: 'yoso-3' }];
    const count = (main, h) => { const c = {}; const r = E.cardAiSeededRand(`q:${main}:${h.length}`); for (let i = 0; i < 40000; i++) { const k = E.cardAiDeckPickId(main, h, r); c[k] = (c[k] || 0) + 1; } return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v / 40000])); };
    const a = count('suki', hist);
    const pastAll = (a['h:oshi-1'] || 0) + (a['h:suki-2'] || 0) + (a['h:yoso-3'] || 0);
    check('Q これまでのデッキがあれば 今の合う顔5割・ほか1.5割ずつ・これまで2割', Math.abs(a.suki - 0.5) < 0.015 && Math.abs(a.oshi - 0.15) < 0.015 && Math.abs(a.sugao - 0.15) < 0.015 && Math.abs(pastAll - 0.2) < 0.015, J(a));
    check('Q これまでのデッキは新しいものほど重い(10:9:8)', Math.abs(a['h:oshi-1'] / pastAll - 10 / 27) < 0.03 && Math.abs(a['h:yoso-3'] / pastAll - 8 / 27) < 0.03, J(a));
    const z = count('suki', []);
    check('Q これまでのデッキが無ければ今までどおり 6:2:2', Math.abs(z.suki - 0.6) < 0.015 && Math.abs(z.oshi - 0.2) < 0.015, J(z));
    check('Q デッキの id から顔', E.cardAiDeckIdFace('oshi') === 'oshi' && E.cardAiDeckIdFace('h:yoso-3') === 'sugao' && E.cardAiDeckIdFace('h:suki-2') === 'suki' && E.cardAiDeckIdFace('x') === null);
    check('Q 使っていた時期の書き方', E.cardAiDeckPeriodText(Date.parse('2026-11-08T10:00:00+09:00'), Date.parse('2026-11-09T10:00:00+09:00')).length > 0 && /〜/.test(E.cardAiDeckPeriodText(Date.parse('2026-11-08T10:00:00+09:00'), Date.parse('2026-11-10T10:00:00+09:00'))) && E.cardAiDeckPeriodText(0, 0) === '');
    // 選び口: 今の3つと、これまでのデッキ。選んだら使い続ける(1戦しても)・おまかせで戻す
    const hEntry = { id: 'oshi-5', slot: 'oshi', name: 'ゴーレム大暴れ', plan: null, spec: { lead: 'golem', avoid: E.cardAiFaceSpec(db, 'kiki', 'oshi').avoid, keep: E.cardAiFaceSpec(db, 'kiki', 'oshi').keep, free: 1, style: 'normal' }, monsters: [], top: [], from: 5, to: 9 };
    const b = makeBox({ store: [[E.CARD_SAVE_KEYS.aiDeckHistory, JSON.stringify({ v: 1, perWho: { kiki: [hEntry] } })]] });
    await b.E.cardLoadAiRecipe();
    const ch = b.E.cardAiDeckChoices('kiki');
    check('Q 選び口の一覧は 今の3つ+これまでのデッキ(名前・時期)', ch.length === 4 && J(ch.slice(0, 3).map((c) => c.id)) === J(['oshi', 'suki', 'sugao']) && ch[3].id === 'h:oshi-5' && ch[3].past === true && ch[3].name === 'ゴーレム大暴れ' && ch[3].face === 'oshi', J(ch));
    check('Q はじめは おまかせ', b.E.cardAiDeckChosen('kiki') === null);
    b.E.cardAiDeckChoose('kiki', 'h:oshi-5');
    check('Q 昔のデッキを選ぶと、今日のデッキの名前・顔もそれになる', b.E.cardAiDeckChosen('kiki') === 'h:oshi-5' && b.E.cardAiDeckNextId('kiki') === 'h:oshi-5' && b.E.cardAiDeckNextName('kiki') === 'ゴーレム大暴れ' && b.E.cardAiDeckNextStyle('kiki') === 'oshi');
    const p = b.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('qq'), 'master', {}, b.E.cardAiDeckNextId('kiki'));
    check('Q 昔のデッキと戦える(同じ組み方で3体・50枚・記録に deckId と past)', p && p.deckId === 'h:oshi-5' && p.deckFrom === 'past' && p.name === 'ゴーレム大暴れ' && p.styleId === 'oshi' && p.deck.monsters.length === 3 && p.deck.cards.length === 50 && E.cardAiFaceLineOf(db.monsters[p.deck.monsters[0]]) === 'golem', J(p && { id: p.deckId, from: p.deckFrom, n: p.deck.cards.length }));
    b.E.cardAiDeckNextDone('kiki');
    check('Q 選んだデッキは1戦しても使い続ける', b.E.cardAiDeckNextId('kiki') === 'h:oshi-5');
    b.E.cardAiDeckChoose('kiki', 'nanika');
    check('Q 一覧に無い id は選べない', b.E.cardAiDeckChosen('kiki') === 'h:oshi-5');
    b.E.cardAiDeckChoose('kiki', null);
    check('Q おまかせに戻すと選び直す', b.E.cardAiDeckChosen('kiki') === null && !!b.E.cardAiDeckNextId('kiki'));
    const q = b.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('qn'), 'master', {}, 'suki');
    check('Q 今のデッキは deckFrom now', q && q.deckId === 'suki' && q.deckFrom === 'now');
    const s93 = src('src/parts/93-card-replay.jsx');
    const s84 = src('src/parts/84-screen-card-battle.jsx');
    check('Q 記録: リプレイの相手に deckId・deckFrom を残す(84 が game.aiDeck から渡す・93 が見張って持つ)',
      /deckId: aiPick\.deckId \|\| aiPick\.styleId, deckFrom: aiPick\.deckFrom === 'past' \? 'past' : 'now'/.test(s84) && /deckId: game\.aiDeck\.deckId, deckFrom: game\.aiDeck\.deckFrom/.test(s84) && /const cardReplayFoeDeckOf = /.test(s93));
    check('Q 84: 対戦は相手えらびで見せたデッキ(cardAiDeckNextId)で始める', /typeof cardAiDeckNextId === 'function' \? cardAiDeckNextId\(pick\.who\)/.test(s84));
  }
  // ---- W: 遊ぶ人の提案(助手部の口 assistantLifeDeckWish・2026-11-08) ----
  {
    const WK = 'mh_card_ai_deck_wish_v1';
    const day = '2026-11-08';
    const at = (n) => ({ at: n, since: n, plan: null, name: null, line: null, ai: false });
    const seed = () => [[KEY2, JSON.stringify({ v: 2, day, perWho: { kiki: { met: true, gamesSince: 0, slotsDone: 0, decks: { oshi: at(5), suki: at(50), yoso: at(9) } } } })]];
    const sorry = () => ok200({ ok: true, kind: 'sorry' });
    // 口が無い: 今のまま(いちばん古い推しを組み直す・印を書かない)
    {
      const b = makeBox({ fetchImpl: sorry, store: seed() });
      await b.E.cardLoadAiRecipe();
      const r = await b.E.cardAiDeckRebuild('kiki', 'games', { now: 1000 });
      check('W 口が無ければ今のまま(いちばん古い顔・印を書かない)', r && r.slot === 'oshi' && !r.wish && !b.store.has(WK), J(r));
    }
    // 壊れた値は使わない
    {
      const bad = [null, 'x', { face: 'ura', day }, { face: 'oshi', day: '11/8' }, { face: 'oshi' }];
      const ok = bad.every((v) => { const b = makeBox({ wish: () => v }); return b.E.cardAiWishOf('kiki') === null; });
      const th = makeBox({ wish: () => { throw new Error('x'); } });
      check('W 壊れた提案・投げる口は使わない(null)', ok && th.E.cardAiWishOf('kiki') === null);
      const g = makeBox({ wish: () => ({ face: 'like', name: 'まったり作戦', plan: 'guard', day }) }).E.cardAiWishOf('kiki');
      check('W 提案の読み方: like は好き・印は「顔:日」', g && g.face === 'suki' && g.plan === 'guard' && g.name === 'まったり作戦' && g.mark === `suki:${day}`, J(g));
    }
    // 名前の形
    {
      const o = E.cardAiFaceOtherNames({ decks: {} }, 'kiki', 'suki');
      check('W 提案の名前: 種族名が無ければ「種族名+の+名前」', E.cardAiWishName(db, 'kiki', 'suki', 'まったり作戦', o, []) === 'ライガーのまったり作戦');
      check('W 提案の名前: 種族名があればそのまま', E.cardAiWishName(db, 'kiki', 'suki', 'ライガー大暴れ', o, []) === 'ライガー大暴れ');
      check('W 提案の名前: 見張りに落ちる名前・長すぎる名前・使った名前は使わない',
        E.cardAiWishName(db, 'kiki', 'suki', '攻めまくり', o, []) === null && E.cardAiWishName(db, 'kiki', 'suki', 'ごろべえ大好き', o, []) === null
        && E.cardAiWishName(db, 'kiki', 'suki', 'のんびりまったり作戦', o, []) === null && E.cardAiWishName(db, 'kiki', 'suki', 'まったり作戦', o, ['ライガーのまったり作戦']) === null);
    }
    // 本物の組み直し: 提案の顔(好き)を1回だけ・名前・寄せた型・印・前のデッキは「これまで」へ
    {
      const b = makeBox({ fetchImpl: sorry, store: seed(), wish: () => ({ face: 'like', name: 'まったり作戦', plan: 'guard', day }) });
      await b.E.cardLoadAiRecipe();
      const r1 = await b.E.cardAiDeckRebuild('kiki', 'games', { now: 2000 });
      const st = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks;
      const used = JSON.parse(b.store.get(WK) || 'null');
      const hist = JSON.parse(b.store.get(E.CARD_SAVE_KEYS.aiDeckHistory) || 'null');
      check('W 提案があれば、いちばん古い顔ではなく提案の顔(好き)を組み直す', r1 && r1.slot === 'suki' && r1.wish === `suki:${day}` && r1.wishName === true, J(r1));
      const okG = E.cardAiWishPlanOk('kiki', 'suki', 'guard');
      check('W 提案の名前を持ち、型は表で寄せてよいときだけ寄せる(主役は変えない)', st.suki.name === 'ライガーのまったり作戦' && (okG ? st.suki.style === 'guard' : st.suki.style === undefined) && st.suki.since === 2000 && r1.wishStyle === okG, J({ suki: st.suki, okG }));
      check('W 使った印を新しいキーに「顔:日」で持つ', used && JSON.stringify(used.used.kiki) === JSON.stringify([`suki:${day}`]), J(used));
      check('W 前のデッキ(既定の名前)は「これまでのデッキ」に残る', hist && hist.perWho.kiki[0].slot === 'suki' && hist.perWho.kiki[0].name === 'ライガーの桜吹雪', J(hist && hist.perWho.kiki[0]));
      const p = b.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('w'), 'master', {}, 'suki');
      check('W 対戦でも提案の名前で出て、主役は表のまま(ライガー)', p && p.name === 'ライガーのまったり作戦' && E.cardAiFaceLineOf(db.monsters[p.deck.monsters[0]]) === 'tiger', J(p && { name: p.name, lead: p.deck.monsters[0] }));
      // 初めて戦うときの台詞(社長「やる」): 提案のデッキで1回だけ・AI のひとことより先・2回目は今の台詞・提案でないデッキでは出ない
      check('W 提案のデッキには印(wish)が付く', st.suki.wish === true && !st.oshi.wish, J({ suki: st.suki.wish, oshi: st.oshi.wish }));
      check('W 初めてのとき: 対戦で出すデッキに wishFirst・VS は提案の台詞', p.wishFirst === true && J(b.E.cardAiDeckVsLine('kiki', p)) === J({ t: '考えてくれた『ライガーのまったり作戦』でお相手しまつ( ˘ω˘)', e: 'happy' }), J(p && p.wishFirst));
      check('W 初めてのとき: AI のひとことがあっても提案の台詞が先', J(b.E.cardAiDeckVsLine('kiki', { ...p, line: 'AI のひとこと' })) === J({ t: '考えてくれた『ライガーのまったり作戦』でお相手しまつ( ˘ω˘)', e: 'happy' }));
      const po = b.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('w2'), 'master', {}, 'oshi');
      check('W 提案でないデッキでは出ない', po && !po.wishFirst && J(b.E.cardAiDeckVsLine('kiki', po)) === J({ t: `今日は『${po.name}』でお相手しまつ( ˘ω˘)`, e: 'happy' }), J(po && { name: po.name, wishFirst: po.wishFirst }));
      await b.E.cardAiDeckWishFought('kiki', p.name);
      const p2 = b.E.cardAssistantDeckPick('kiki', E.cardAiSeededRand('w3'), 'master', {}, 'suki');
      const ws = JSON.parse(b.store.get(WK));
      check('W 2回目は今の台詞(初めて戦った印を同じキーの fought に足す・used はそのまま)', p2 && !p2.wishFirst && J(b.E.cardAiDeckVsLine('kiki', p2)) === J({ t: '今日は『ライガーのまったり作戦』でお相手しまつ( ˘ω˘)', e: 'happy' })
        && J(ws.used.kiki) === J([`suki:${day}`]) && J(ws.fought.kiki) === J(['ライガーのまったり作戦']), J(ws));
      check('W 初めて戦うときの台詞は8人ぶん・{name} を1つ持つ', WHO.every((w) => typeof E.CARD_AI_DECK_WISH_LINES[w] === 'string' && E.CARD_AI_DECK_WISH_LINES[w].split('{name}').length === 2));
      const r2 = await b.E.cardAiDeckRebuild('kiki', 'games', { now: 3000 });
      check('W 同じ提案は2回使わない(次はいちばん古い顔=推し)', r2 && r2.slot === 'oshi' && !r2.wish, J(r2));
      // 寄せた型で組み方が変わる(守り → 守りの札が増える)
      const g0 = E.cardAiFaceBuild(db, 'kiki', 'suki', 'master', E.cardAiSeededRand('wg'), {}, null);
      const g1 = E.cardAiFaceBuild(db, 'kiki', 'suki', 'master', E.cardAiSeededRand('wg'), {}, null, 'guard');
      const guards = (d) => d.cards.filter((no) => ['blk', 'dge'].includes((db.cards[no] || {}).kind)).length;
      check('W 提案の型「守り」で組むと、守りの札が増える(主役・3体の決め方は同じ)', guards(g1) > guards(g0) && E.cardAiFaceLineOf(db.monsters[g1.monsters[0]]) === 'tiger', `${guards(g0)} → ${guards(g1)}`);
    }
    // 名前が通らない提案: 型だけ寄せて、名前はいつもの付け方
    {
      const b = makeBox({ fetchImpl: sorry, store: seed(), wish: () => ({ face: 'oshi', name: '攻めまくり', plan: 'attack', day }) });
      await b.E.cardLoadAiRecipe();
      const r = await b.E.cardAiDeckRebuild('kiki', 'games', { now: 4000 });
      const st = JSON.parse(b.store.get(KEY2)).perWho.kiki.decks.oshi;
      const okA = E.cardAiWishPlanOk('kiki', 'oshi', 'attack');
      check('W 名前が見張りに落ちる提案は、名前を使わない(型は表で寄せてよいときだけ)', r && r.slot === 'oshi' && r.wishName === false && (okA ? st.style === 'attack' : st.style === undefined) && st.name !== '攻めまくり' && !/攻め/.test(st.name || ''), J(st));
    }
    // 寄せてよい型の表(部長「A」: 強さの目安 ±10点に入る組み合わせだけ)
    {
      const T = E.CARD_AI_WISH_PLAN_OK;
      const missing = WHO.flatMap((w) => SLOTS.filter((sl) => !(T[w] && Array.isArray(T[w][sl]))).map((sl) => `${w}/${sl}`));
      check('W 寄せてよい型の表が、8人×4つの顔ぶんそろっている(助手や顔が増えたら tools/card/card-ai-wish-plan-table.js --write で作り直す)', missing.length === 0, missing.slice(0, 6).join(' '));
      const badVal = WHO.flatMap((w) => SLOTS.flatMap((sl) => ((T[w] || {})[sl] || []).filter((p) => !['attack', 'guard', 'normal'].includes(p)).map((p) => `${w}/${sl}:${p}`)));
      check('W 表の中身は攻め・守り・ふつうだけ', badVal.length === 0, badVal.join(' '));
      check('W 表に無い組み合わせ(知らない助手・知らない顔・知らない型)は寄せない', !E.cardAiWishPlanOk('nobody', 'oshi', 'attack') && !E.cardAiWishPlanOk('kiki', 'zzz', 'attack') && !E.cardAiWishPlanOk('kiki', 'oshi', 'ura') && !E.cardAiWishPlanOk('kiki', 'oshi', ''));
      const src83 = src('src/parts/83-card-ai-deck.jsx');
      check('W 83: 組み直しは提案の型を表で確かめてから寄せる', /const wishStyle = wish && wish\.plan && cardAiWishPlanOk\(who, slot, wish\.plan\) \? wish\.plan : null;/.test(src83));
      // 表の元の数(道具が残す)と合っているか: 寄せてよい=両方の強さで ±10点
      let rates = null;
      try { rates = JSON.parse(fs.readFileSync(path.resolve(GAME, '..', 'docs/progress/card-ai-faces/wish-plan-rates.json'), 'utf8')); } catch (_) { rates = null; }
      const mismatch = rates ? rates.flatMap((m) => SLOTS.flatMap((sl) => ['attack', 'guard', 'normal'].filter((p) => {
        const ok = ['expert', 'master'].every((lv) => Math.abs(m.rates[`${sl}:${p}:${lv}`] - m.base[lv]) <= 10 + 1e-9);
        return ok !== ((T[m.who] || {})[sl] || []).includes(p);
      }).map((p) => `${m.who}/${sl}:${p}`))) : ['数の表が読めない'];
      check('W 表は測った数(wish-plan-rates.json)のとおり(両方の強さで ±10点に入る型だけ)', mismatch.length === 0, mismatch.slice(0, 6).join(' '));
    }
    // 保存の読み方
    {
      const n = E.cardNormalizeAiWish({ used: { kiki: ['suki:2026-11-08', 'zz', 'suki:2026-11-08', 'oshi:2026-11-09'], nobody: ['oshi:2026-11-08'], mua: 'x' } });
      check('W 印の読み方: 壊れた値・知らない助手・重なりは捨てる', JSON.stringify(n) === JSON.stringify({ v: 1, used: { kiki: ['suki:2026-11-08', 'oshi:2026-11-09'] } }), J(n));
      const n2 = E.cardNormalizeAiWish({ v: 1, used: { kiki: ['suki:2026-11-08'] }, fought: { kiki: ['ライガーのまったり作戦', 3, 'ライガーのまったり作戦', 'あ'.repeat(20)], nobody: ['x'] } });
      check('W 初めて戦った印(fought)の読み方: 壊れた値・長すぎる名前・知らない助手は捨てる・used は前の形のまま', JSON.stringify(n2) === JSON.stringify({ v: 1, used: { kiki: ['suki:2026-11-08'] }, fought: { kiki: ['ライガーのまったり作戦'] } }), J(n2));
      check('W 84: 提案のデッキで始めたら、初めて戦った印を残す', /if \(aiPick && aiPick\.wishFirst && typeof cardAiDeckWishFought === 'function'\) void Promise\.resolve\(cardAiDeckWishFought\(pick\.who, aiPick\.name\)\)/.test(src('src/parts/84-screen-card-battle.jsx')));
      check('W 印のキーを保存キーの表に載せる', /`mh_card_ai_deck_wish_v1`/.test(fs.readFileSync(path.resolve(GAME, '..', 'docs/spec/SAVE_DATA.md'), 'utf8')));
    }
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
