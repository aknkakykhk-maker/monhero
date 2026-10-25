// ===== MFバトルカード: 助手のおしゃべり(AI)(2026-10-25 社長が3つとも選んだ) =====
// 対戦後のひとこと・バトル中の山場のひとこと・デッキ相談を、外のAI(中継役 supabase/functions/card-assistant-talk)に作ってもらう。
// ★手は今のAIが決める(ここは台詞だけ)。AIが無くても遊べる: 失敗・遅れ・上限・切のときは、いまの決まった台詞(83-card-battle-lines.jsx)のまま
// ★呼べるのは公開の印(RELEASE_FLAGS.cardAssistantTalk)が立ってから。立つまではデバッグ端末だけ
// ★入/切の保存は新しいキー mh_card_ai_talk_v1 { on }(無い・壊れているときは「入」)
// ★仕様: docs/spec/CARD_ASSISTANT_TALK.md
const CARD_TALK_URL = `${typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : ''}/functions/v1/card-assistant-talk`;
const CARD_TALK_KEY = CARD_SAVE_KEYS.aiTalk; // mh_card_ai_talk_v1
// 山場として聞く場面(83 の場面の名前)と、逆転(ここで足す名前)
const CARD_TALK_MOMENTS = Object.freeze(['big', 'bigHit', 'myKo', 'theirKo', 'lastMine', 'lastTheirs', 'comeback', 'comebackTheirs']);
// 1試合で山場を聞くのは5回まで(1端末1日の上限は中継役が数える)
const CARD_TALK_MOMENT_PER_GAME = 5;
// ゲームが待つ長さ。間に合わなければ決まった台詞のまま(山場は待たせない)
const CARD_TALK_WAIT_MS = Object.freeze({ moment: 2500, after: 6000, deck: 12000 });
// デッキ相談が届かなかったときの一言(助手を選ばない言い方)
const CARD_TALK_DECK_SORRY = 'いまはうまく相談にのれないみたい…。少しあとで、もう一度聞いてね';
const CARD_TALK_FACES = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];

// 呼んでよい端末か(公開の印か、デバッグの合言葉が合った端末)
const cardTalkOpen = () => {
  try { if (typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.cardAssistantTalk === true) return true; } catch (e) {}
  try { return typeof localStorage !== 'undefined' && typeof DEBUG_UNLOCK_KEY !== 'undefined' && localStorage.getItem(DEBUG_UNLOCK_KEY) === '1'; } catch (e) { return false; }
};
const cardNormalizeAiTalk = (v) => ({ on: !(v && typeof v === 'object' && !Array.isArray(v) && v.on === false) });
// いまの入/切(トップの画面が読み込んだらここへ置く。読む前は既定の「入」)
let cardAiTalkState = { on: true };
const cardAiTalkOn = () => cardTalkOpen() && cardAiTalkState.on;
const cardLoadAiTalk = async () => {
  try { cardAiTalkState = cardNormalizeAiTalk(await storeGet(CARD_TALK_KEY, null)); } catch (e) { cardAiTalkState = { on: true }; }
  return cardAiTalkState;
};
const cardSaveAiTalk = async (on) => {
  cardAiTalkState = { on: !!on };
  try { await storeSet(CARD_TALK_KEY, cardAiTalkState); } catch (e) {}
  return cardAiTalkState;
};

// その場面の決まった台詞(見本として送る。表情は送らない)
const cardTalkSamples = (who, scene) => ((CARD_BATTLE_LINES[who] || {})[scene] || []).map((e) => (Array.isArray(e) ? e[0] : e)).slice(0, 6);

// 中継役を呼ぶ。返事が来なければ null(呼ぶ側は決まった台詞のまま)
const cardTalkFetch = async (kind, { who, facts, samples = [] }) => {
  if (!cardAiTalkOn() || typeof fetch === 'undefined') return null;
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ac) ac.abort(); }, CARD_TALK_WAIT_MS[kind] || 3000);
  try {
    const breederId = typeof ensureBreederId === 'function' ? await ensureBreederId() : null;
    const r = await fetch(CARD_TALK_URL, {
      method: 'POST', headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, breederId: breederId || 'unknown', assistantId: who, facts, samples }), signal: ac ? ac.signal : undefined,
    });
    const res = r.ok ? await r.json() : null;
    if (!res || res.ok !== true || res.kind !== 'reply' || typeof res.text !== 'string' || !res.text.trim()) return null;
    return { text: res.text.trim().slice(0, kind === 'deck' ? 200 : 80), face: CARD_TALK_FACES.includes(res.expression) ? res.expression : 'normal', picks: Array.isArray(res.picks) ? res.picks : [] };
  } catch (e) { return null; } finally { clearTimeout(timer); }
};

// ---- 材料づくり(数字と名前だけ。自由な文は送らない) ----
const cardTalkAlive = (st, p) => st.players[p].mons.filter((m) => !m.ko).length;
// 助手(cpu)から見たリード。逆転は「リードの向きが変わった」とき
const cardTalkLead = (st, cpu) => cardTalkAlive(st, cpu) - cardTalkAlive(st, 1 - cpu);
const cardTalkComebackScene = (before, after, cpu) => {
  const a = cardTalkLead(before, cpu), b = cardTalkLead(after, cpu);
  if (a < 0 && b > 0) return 'comeback';
  if (a > 0 && b < 0) return 'comebackTheirs';
  return null;
};
// プレイヤー(p)の戦い方(この試合で使ったカードから)。名前は 84 の CARD_FOE_STYLES と同じ
const cardTalkPlayerStyle = (db, st, p) => {
  const used = (st.log || []).filter((x) => (x.kind === 'use' || x.kind === 'guard') && x.p === p).flatMap((x) => x.cards || []).map((no) => cardOf(db, no)).filter(Boolean);
  if (used.length < 3) return '';
  const share = (f) => used.filter(f).length / used.length;
  if (share((c) => c.kind === 'blk' || c.kind === 'dge') >= 0.4) return '守り型';
  if (share((c) => cardHasEff(c, 'area')) >= 0.3) return '全体攻撃型';
  if (share((c) => (c.guts || 0) >= 5) >= 0.3) return '大技型';
  if (share((c) => c.kind === 'pow' || c.kind === 'int') >= 0.6) return '攻撃型';
  return 'バランス型';
};
// 山場の材料。evs の「使った」知らせからカードと使った子を取る
const cardTalkMomentFacts = (db, after, cpu, scene) => {
  const use = (after.events || []).find((e) => e.t === 'use');
  const user = use && use.mon >= 0 ? after.players[use.p].mons[use.mon] : null;
  const c = use ? cardOf(db, use.cards[0]) : null;
  return { scene, turn: after.turn, myAlive: cardTalkAlive(after, cpu), theirAlive: cardTalkAlive(after, 1 - cpu), card: c ? c.name : '', monster: user ? user.name : '' };
};
// 対戦後の材料。outcome は遊んだ人から見た勝ち負け(win/lose/surrender)。決め手は、勝った側が最後に使ったカード
// comeback … 試合のとちゅうで、勝った側がリードされていたことがあれば真(84 が1手ごとに覚えておく)
const cardTalkAfterFacts = (db, st, { cpu, outcome, level, comeback }) => {
  if (!st) return null;
  const helper = outcome === 'win' ? 'lose' : outcome === 'surrender' ? 'surrender' : 'win';
  const winner = st.winner !== null && st.winner !== undefined ? st.winner : (outcome === 'win' ? 1 - cpu : cpu);
  const last = (st.log || []).slice().reverse().find((x) => x.kind === 'use' && x.p === winner);
  const c = last ? cardOf(db, (last.cards || [])[0]) : null;
  const reason = outcome === 'surrender' ? 'surrender' : /山札/.test(st.reason || '') ? 'deck' : 'ko';
  return {
    outcome: helper, reason, turn: st.turn, myAlive: cardTalkAlive(st, cpu), theirAlive: cardTalkAlive(st, 1 - cpu),
    card: c ? c.name : '', decisiveBy: c ? (winner === cpu ? 'me' : 'you') : null, comeback: !!comeback,
    playerStyle: cardTalkPlayerStyle(db, st, 1 - cpu), level: (typeof CARD_LEVEL_LABEL !== 'undefined' && CARD_LEVEL_LABEL[level]) || '',
  };
};
// デッキ相談の材料。入れられる(持っている数とデッキの上限に余りがある)カードだけを送る。選んだモンスターが使えるもの・全モンスター・ブリーダー
const cardTalkDeckFacts = (db, deck, collection) => {
  const mons = (deck.monsters || []).map((no) => cardMonsterOf(db, no)).filter(Boolean);
  const inDeck = {}; (deck.cards || []).forEach((no) => { inDeck[no] = (inDeck[no] || 0) + 1; });
  const kinds = { pow: 'ちから', int: 'かしこさ', spe: '特殊', dge: '回避', blk: '防御' };
  const userName = (u) => (u === 'any' ? '全モンスター' : u === 'breeder' ? 'ブリーダー' : ((Object.values(db.monsters).find((m) => m.species === u && !m.main) || {}).name || u));
  const cards = Object.values(db.cards).filter((c) => c.ready && (c.user === 'any' || c.user === 'breeder' || mons.some((m) => cardUsableBy(c, m))))
    .map((c) => {
      // 入れられるか・あと何枚かは、デッキ編成と同じ決まり(82 の cardDeckAddReason・同じ名前は CARD_DECK_COPY_MAX 枚まで)
      const have = Math.floor(Number((collection || {})[c.no]) || 0);
      const sameName = (deck.cards || []).filter((x) => (cardOf(db, x) || {}).name === c.name).length;
      const room = cardDeckAddReason(db, { monsters: deck.monsters || [], cards: deck.cards || [] }, c.no, collection) ? 0
        : Math.max(0, Math.min(CARD_DECK_COPY_MAX - sameName, have - (inDeck[c.no] || 0), CARD_BATTLE_DECK_SIZE - (deck.cards || []).length));
      return { no: c.no, name: c.name, kind: kinds[c.kind] || c.kind, user: userName(c.user), guts: c.guts || 0, damage: Number.isFinite(c.damage) ? c.damage : null, text: String(c.text || '').slice(0, 90), room };
    }).filter((c) => c.room > 0).slice(0, 200);
  const count = {}; (deck.cards || []).forEach((no) => { const c = cardOf(db, no); if (c) count[kinds[c.kind] || c.kind] = (count[kinds[c.kind] || c.kind] || 0) + 1; });
  const topKinds = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => `${k}${n}枚`).join('・');
  return { monsters: mons.map((m) => m.name), deckCount: (deck.cards || []).length, deckSize: CARD_BATTLE_DECK_SIZE, cards, topKinds };
};
// 勧められたカードを、ゲームの決まりでもう一度確かめる(上限・持っている数・デッキの枚数)。合わないものは出さない
const cardTalkCheckPicks = (db, deck, collection, picks) => {
  const facts = cardTalkDeckFacts(db, deck, collection);
  const room = new Map(facts.cards.map((c) => [c.no, c]));
  const seen = new Set();
  return (Array.isArray(picks) ? picks : []).filter((p) => p && room.has(String(p.no)) && !seen.has(String(p.no)) && seen.add(String(p.no)))
    .slice(0, 6).map((p) => ({ no: String(p.no), name: room.get(String(p.no)).name, reason: String(p.reason || '').slice(0, 30) }));
};
