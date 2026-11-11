// ==================== 助手の解放(アシストカードを使った回数で助手になる) ====================
// 2026-11-11 社長「これから始める人はアシカの助手を使った回数で解放されるようにしようか。最初は好きな助手を選べて
//   あとは解放条件を満たしたら助手として使えるようになる。これなら存在はするからイベント的にも違和感がないはず」
// 決め(台帳 2026-11-11・設計 docs/progress/assistant-unlock/DESIGN.md):
//   ・40回(オート・クイックも数える・AIコピーとデバッグ戦は数えない)
//   ・すでに遊んでいる人は今のまま全員が助手(一度きりの判定。mode:'all' を書いたら二度と判定し直さない)
//   ・これから始める人は最初に1人選び(mode:'earn')、ほかはカードを40回使うと助手になる(解放は戻さない)
//   ・まだ助手でない助手は「町の人」: 町・お話・掛け合いには出るが、話す・贈る・部屋・きずな・マスモンは押せない
// ★公開前の助手を隠す決まり(assistantReleased・unreleased-assistant-hidden)とは混ぜない。そちらが先に止める。
// ★お話で出会う助手(あつ等)の「お話を見たか」(assistantUnlockedBy)も今のまま。これはその上に重ねる段。
// 保存は新しいキー2つだけ(既存の mh_* の意味は変えない)。ここは純粋な計算だけ(保存・画面は呼ぶ側)。

const ASSISTANT_PARTNER_KEY = 'mh_assistant_partner_v1';
const ASSISTANT_CARD_USES_KEY = 'mh_assistant_card_uses_v1';
// 助手になるまでに使う回数(社長 2026-11-11「40回」)。変えるのはここだけ
const ASSISTANT_PARTNER_NEED = 40;

const assistantPartnerIdOk = (id) => typeof id === 'string' && id.length > 0 && id.length <= 40;
const assistantPartnerIdList = (value) => {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const id of value) if (assistantPartnerIdOk(id) && !out.includes(id)) out.push(id);
  return out;
};
// 保存値 → いつも同じ形。壊れた値・無い値は「まだ判定していない」(mode:null)
const normalizeAssistantPartner = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const mode = src.mode === 'all' || src.mode === 'earn' ? src.mode : null;
  const first = assistantPartnerIdOk(src.first) ? src.first : null;
  const unlocked = assistantPartnerIdList(src.unlocked);
  if (mode === 'earn' && first && !unlocked.includes(first)) unlocked.unshift(first);
  return { v: 1, mode, first, unlocked, noticed: assistantPartnerIdList(src.noticed) };
};
// 使った回数 { 助手id: 回数 }。数でない・負・無限は落とす
const normalizeAssistantCardUses = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  for (const [id, n] of Object.entries(src)) {
    const v = Number(n);
    if (assistantPartnerIdOk(id) && Number.isFinite(v) && v > 0) out[id] = Math.min(Math.floor(v), 1e9);
  }
  return out;
};

// すでに遊んでいる人の一度きりの判定。まだ判定していなくて、プロフィールを決め終えた・助手を選んだことがある人は 'all'。
// 返り値 changed が真のときだけ保存する(判定ずみなら何もしない=二重に判定しない)
const assistantPartnerJudgeExisting = (state, { wasOnboarded = false, hasAssistant = false } = {}) => {
  const s = normalizeAssistantPartner(state);
  if (s.mode) return { state: s, changed: false };
  if (!wasOnboarded && !hasAssistant) return { state: s, changed: false };
  return { state: { ...s, mode: 'all' }, changed: true };
};
// はじめての人が最初の助手を決めたとき。判定ずみなら何もしない
const assistantPartnerStartEarn = (state, firstId) => {
  const s = normalizeAssistantPartner(state);
  if (s.mode || !assistantPartnerIdOk(firstId)) return { state: s, changed: false };
  return { state: { ...s, mode: 'earn', first: firstId, unlocked: [firstId] }, changed: true };
};
// この段だけで見た「助手として関われるか」。'earn' の人は解放した助手だけ。まだ判定していない人(助手えらびの前)は全員
const assistantPartnerAllowed = (state, id) => {
  const s = normalizeAssistantPartner(state);
  return s.mode !== 'earn' || s.unlocked.includes(id);
};
// カードを1回使った。回数を足し、'earn' の人で40回に届いたら解放する(足すだけ・消さない)
const assistantPartnerCountUse = (uses, state, id) => {
  const u = normalizeAssistantCardUses(uses);
  const s = normalizeAssistantPartner(state);
  if (!assistantPartnerIdOk(id)) return { uses: u, state: s, unlockedId: null, stateChanged: false };
  const nextUses = { ...u, [id]: (u[id] || 0) + 1 };
  if (s.mode === 'earn' && !s.unlocked.includes(id) && nextUses[id] >= ASSISTANT_PARTNER_NEED) {
    return { uses: nextUses, state: { ...s, unlocked: [...s.unlocked, id] }, unlockedId: id, stateChanged: true };
  }
  return { uses: nextUses, state: s, unlockedId: null, stateChanged: false };
};
// まだ見せていない解放の演出(最初に選んだ助手は出さない)。isOk で「いま本当に助手か」(お話の条件も)を確かめる
const assistantPartnerPendingNotice = (state, isOk = () => true) => {
  const s = normalizeAssistantPartner(state);
  if (s.mode !== 'earn') return null;
  return s.unlocked.find(id => id !== s.first && !s.noticed.includes(id) && isOk(id)) || null;
};
const assistantPartnerMarkNoticed = (state, id) => {
  const s = normalizeAssistantPartner(state);
  if (!assistantPartnerIdOk(id) || s.noticed.includes(id)) return { state: s, changed: false };
  return { state: { ...s, noticed: [...s.noticed, id] }, changed: true };
};
// はじめての人のあつの加入のお話は、あつの挑発を40回で流れる(社長 2026-11-11 C)
const assistantPartnerAtsuJoinReady = (state, uses) => {
  const s = normalizeAssistantPartner(state);
  return s.mode === 'earn' && (normalizeAssistantCardUses(uses).atsu || 0) >= ASSISTANT_PARTNER_NEED;
};

// ---- いまの値(画面の部品から読む入口) ----
// 本体(60-app.jsx)が読み込み・変化のたびに assistantPartnerSetNow で知らせる。ほかの部(助手ライフ・贈る・マスモン・おしゃべり)は
//   assistantPartnerOkNow(id) / assistantPartnerProgressNow(id) / assistantPartnerIdsNow() だけを使う(保存は読まない)
let assistantPartnerNowState = normalizeAssistantPartner(null);
let assistantPartnerNowUses = {};
let assistantPartnerNowSeen = [];
let assistantPartnerNowOwned = [];
const assistantPartnerSetNow = ({ state, uses, seenStoryIds, ownedCards } = {}) => {
  if (state !== undefined) assistantPartnerNowState = normalizeAssistantPartner(state);
  if (uses !== undefined) assistantPartnerNowUses = normalizeAssistantCardUses(uses);
  if (seenStoryIds !== undefined) assistantPartnerNowSeen = Array.isArray(seenStoryIds) ? seenStoryIds : [];
  if (ownedCards !== undefined) assistantPartnerNowOwned = Array.isArray(ownedCards) ? ownedCards : [];
};
// 「助手か」= 公開ずみ・お話の条件(今のまま)・この段(解放したか)のすべて
const assistantPartnerOkWith = (state, seenStoryIds, id) => {
  if (typeof assistantUnlockedBy === 'function' && !assistantUnlockedBy(id, seenStoryIds)) return false;
  return assistantPartnerAllowed(state, id);
};
const assistantPartnerOkNow = (id) => assistantPartnerOkWith(assistantPartnerNowState, assistantPartnerNowSeen, id);
// 町の人として出すか(会っているが、まだ助手でない)。今の人・判定前の人は常に偽
const assistantPartnerLockedNow = (id) => assistantPartnerNowState.mode === 'earn' && !assistantPartnerAllowed(assistantPartnerNowState, id);
const assistantPartnerEarnNow = () => assistantPartnerNowState.mode === 'earn';
const assistantPartnerCardName = (id) => {
  const list = typeof TEACHING_CARDS !== 'undefined' && Array.isArray(TEACHING_CARDS) ? TEACHING_CARDS : [];
  const card = list.find(c => c && c.id === id);
  return card ? card.baseName : '';
};
// 「あと何回」の案内用。cardOwned … そのカードを持っているか(持っていなければ「ショップで手に入る」と案内する)
const assistantPartnerProgressNow = (id) => ({
  count: Math.min(assistantPartnerNowUses[id] || 0, ASSISTANT_PARTNER_NEED),
  need: ASSISTANT_PARTNER_NEED,
  cardName: assistantPartnerCardName(id),
  cardOwned: assistantPartnerNowOwned.includes(id),
  unlocked: assistantPartnerAllowed(assistantPartnerNowState, id),
});
const assistantPartnerIdsNow = () => {
  const list = typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS) ? ASSISTANTS : [];
  return list.map(a => a && a.id).filter(id => assistantPartnerIdOk(id) && assistantPartnerOkNow(id));
};

// 解放の演出の一言(仮。社長の「この文で」のあと差し替える)
const ASSISTANT_PARTNER_UNLOCK_LINES = Object.freeze({
  mua: 'えっ、みゅあのカードいっぱい使ってくれてたの！？ まぢうれしい(｡ ˘_˘)ｳﾝｳﾝ これからは隣でいっしょにいこ！',
  kiki: 'ききのカード、たくさん使ってくれてたんでつね (´ー`*)ウンウン 今日からは助手として、いっしょに火力で押していきましょ',
  momosuke: 'ずっとももすけのカード使ってくれてたの、知ってたよ♡ これからは、もっと近くで応援させて！',
  dra: 'おでのカード、何回も使ってくれたな。今度は、おでが隣で手伝う番だ',
  atsu: 'あつの挑発、めっちゃ使ってくれてたじゃん笑 そこまでされたら、助手やるしかないでしょ！',
  kyuko: 'きゅうこのカード、こんなに使ってくれてたんだねぇ😭 うれしい…今日から、ちゃんと隣にいるからね',
  sorashido: 'ソラシドの自動化、かなり回してもらってましたね笑 なるほど了解です、ここからは助手として手伝います！',
  erubin: '俺のカード、ずっと使ってくれてたんだね。ありがとう。これからは、隣でゆっくり見守るよ',
});
const assistantPartnerUnlockLine = (id) => ASSISTANT_PARTNER_UNLOCK_LINES[id] || 'これからは、助手としてよろしくね';
// 解放されてできるようになること(演出の4コマ目)
const ASSISTANT_PARTNER_UNLOCK_EFFECTS = Object.freeze([
  '助手として選べる',
  '助手ライフで話す・贈る・部屋に入れる',
  '仲良し度が貯まる(ごほうびも届く)',
  '助手のマスモンを迎えられる',
]);
