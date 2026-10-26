// ===== MFバトルカード: チュートリアル(練習試合)の台本と段の進め方 =====
// 設計: docs/spec/CARD_BATTLE.md 7-4(社長がOK・台帳 #3450)。台詞の正本: docs/spec/card-battle/TUTORIAL_LINES.md(#3464 の版を社長がOK)
// ドラが説明し、みゅあが相手。決まった手札・山札で、5つのことを1つずつ操作させて教える。
// 1つの段のあいだは、教えている操作だけを出せる(cardTutorialAllow)。みゅあの手は決まっている(cardTutorialCpu)。
// ★この部品は pure(画面・保存を触らない)。画面は 84-screen-card-battle.jsx
const CARD_TUTORIAL_LINES = Object.freeze({
  D1: 'よし、練習試合だ。相手はみゅあ、デッキはおでが貸すからな',
  M1: '手加減しないって言ったでしょ♪ よろしくね！',
  D2: 'おでが横で教えるから、光ってる所を押してくれればいいよ。5つ覚えたら一人前だ',
  D3: 'まずは引くところから。ターンのはじめに、手札が5枚になるまで山札から引くんだ。見ててな',
  D4: 'ほら、3枚から5枚になったろ？ これは押さなくても、毎ターン勝手に引かれるからな',
  D5: 'もう5枚あるときは、引くかわりに山札の上が1枚ガッツになる。これも覚えといてな',
  D6: '技を見てみな。暗いだろ？ 技を出すには「ガッツ」が要るんだよ',
  D7: '「攻撃おわり → ガッツへ」を押して、要らないカードを2枚ガッツに置こう。何枚置いてもいいんだ',
  D8: 'ふむ、上出来。ガッツは次から使えるし、何枚あるかは相手からも見えるからな',
  M2: 'じゃあ次はあたしの番ね！ いっくよー！',
  M3: 'これでどーだ！',
  D9: 'みゅあが攻めてきたぞ。相手の番でも、回避か防御のカードで守れるんだ',
  D10: '光ってる「ステップ」をタップか、狙われたピクシーまで運んでみな。守りのカードは、狙われた子のぶん(か、誰でも使えるもの)だけ使えるからな',
  M4: 'えー！ よけられた！？ うまっ！ｗ',
  D11: 'ほらな、守りは大事なんだよ。おでの膝くらい大事だ。えへへ',
  D12: '今度はこっちの番。ガッツが2つあるから「パンチ」が出せる',
  D13: '技をタップして相手をタップ。相手まで運んで離してもいいぞ。1体は1ターンに1回まで攻撃できるからな',
  M5: 'いったぁ…！ 今のはまぢ効いた…',
  D14: 'いい当たりだ。ダメージの数だけライフが減って、0になったらKOだよ',
  D15: '最後にもうひとつ。ちょっと時間を進めるぞ…',
  M6: 'あれ？ あたしの山札、なんか少なくない？',
  D16: 'みゅあの山札、もう0枚だろ？ 次の番に引けなかったら、その時点で負けなんだ',
  // D17 は2つに分けた(言うボタンと光るボタンを合わせる。2026-10-24 カゲあつくんの確認)
  D17: 'まずは光ってる「攻撃おわり → ガッツへ」を押してみな',
  D17b: '次は「ガッツにしないでターン終了」だ。みゅあの番になるぞ',
  M7: 'えっ、引けないぢゃん…！ 負けたー！🤣ｗ',
  D18: 'これが山札切れ。3体全部倒しても勝ちだけど、山札の残りも気にしような',
  D19: 'これで5つ全部だ。あとはデッキを組んで、いろんな相手と戦ってみな',
  M8: '楽しかった！ 次は本気で勝負しよ٩(`･ω･´)و',
  D20: 'ワイがいなくても大丈夫だよな？ ルールの画面から、いつでもこの練習試合をやり直せるからな',
  D21: 'まずは光ってる所だよ',
  D22: 'あわてなくていい。光ってる所からな',
});
// みゅあの台詞の表情(吹き出しの顔。2026-10-26 社長「表情別にして」)。書いていない台詞は happy
const CARD_TUTORIAL_FACE = Object.freeze({ M1: 'wink', M2: 'happy', M3: 'excited', M4: 'surprise', M5: 'troubled', M6: 'surprise', M7: 'crying', M8: 'happy' });
const CARD_TUTORIAL_WRONG = Object.freeze(['D21', 'D22']);
const CARD_TUTORIAL_POINT = 100;
// 使うカード: ステップ(ピクシーの回避)・パンチ(ディノの技)・ソバット(みゅあのハムの技)
const CARD_TUTORIAL_CARD = Object.freeze({ step: '059', punch: '061', sobat: '086' });

// 段(上から順に進む)。lines … その段で出す台詞(D はドラの説明の窓・M はみゅあの吹き出し)
//   next … 「次へ」で進む段(操作は無い)。onNext … 「次へ」で場面を変える(draw 5枚まで引く / fastForward 時間を進める / finish 終わり)
//   それ以外の段は、教えている操作をしたら(done)次の段へ
const CARD_TUTORIAL_STAGES = Object.freeze([
  { id: 'intro', lines: ['D1', 'M1', 'D2'], next: true },
  { id: 'draw', lines: ['D3'], next: true, onNext: 'draw' },
  { id: 'drawAfter', lines: ['D4', 'D5'], next: true },
  { id: 'guts', lines: ['D6', 'D7'] },
  { id: 'gutsAfter', lines: ['D8', 'M2'], next: true },
  { id: 'guard', lines: ['M3', 'D9', 'D10'] },
  { id: 'guardAfter', lines: ['M4', 'D11'], next: true },
  { id: 'attack', lines: ['D12', 'D13'] },
  { id: 'attackAfter', lines: ['M5', 'D14'], next: true },
  { id: 'deck', lines: ['D15'], next: true, onNext: 'fastForward' },
  { id: 'deckEnd', lines: ['M6', 'D16', 'D17'] },
  { id: 'deckTurn', lines: ['D17b'] },
  { id: 'finish', lines: ['M7', 'D18', 'D19', 'M8', 'D20'], next: true, onNext: 'finish' },
]);

// 練習試合の場面(決まった手札・山札)。自分はドラが貸すデッキ(ディノ・ピクシー・ゴーレム)、みゅあはスピードチーム
const cardTutorialGame = (db) => {
  // 同じ名前は3枚まで(デッキの決まり)。自分の山札は、ディノ・ピクシー・ゴーレムが使える札を3枚ずつ順に入れて作る
  //   ★最初は 064(かみつき)だけで埋めていて、手札に同じカードが4枚並んだ(2026-10-24 社長の実機・#3478)
  const myHand = ['027', CARD_TUTORIAL_CARD.step, '029']; // キック・ステップ・チョップ(練習試合だけ3枚から)
  const myTop = ['026', CARD_TUTORIAL_CARD.punch];        // 山札の上(末尾が上): ①で「パンチ」「でこぴん」を引く
  const count = {};
  const nameOf = (no) => (cardOf(db, no) || {}).name;
  [...myHand, ...myTop].forEach((no) => { count[nameOf(no)] = (count[nameOf(no)] || 0) + 1; });
  const mons = ['C-006', 'C-005', 'C-003'].map((no) => ({ ...cardMonsterOf(db, no), ko: false }));
  // 2ターン目に引く札は、ガッツ2では出せない重い技にする(④で教える「パンチ」だけが光るように)
  const pool = Object.values(db.cards).filter((c) => c.ready && c.wave === 1 && c.kind !== 'spe' && c.user !== 'breeder' && (c.user === 'any' || mons.some((m) => cardUsableBy(c, m))) && !cardHasEff(c, 'attach'))
    .sort((a, b) => (b.guts - a.guts) || (a.no < b.no ? -1 : 1));
  //   ★同じ札を3枚続けて入れると、引くたびに同じカードが手札に並ぶ(#3478 のあと「竜巻アタック」が3枚並んだ)。
  //     違う名前を1枚ずつ順に入れて1周、それを3周する(名前ごとに3枚まで)
  const rest = [];
  for (let round = 0; round < CARD_DECK_COPY_MAX && rest.length < 43; round++) {
    for (const c of pool) {
      if (rest.length >= 43) break;
      if ((count[c.name] || 0) > round) continue;
      rest.push(c.no); count[c.name] = (count[c.name] || 0) + 1;
    }
  }
  const myDeck = [...rest.reverse(), ...myTop];
  // みゅあはスピードチームの50枚をそのまま分ける(手札5枚・ガッツ2枚・残りが山札)。手札の1枚目は「ソバット」
  const kit = cardAiBuildDeck(db, 'speed').cards.slice();
  const take = (no) => { const k = kit.indexOf(no); return k >= 0 ? kit.splice(k, 1)[0] : null; };
  const muaHand = [take(CARD_TUTORIAL_CARD.sobat) || CARD_TUTORIAL_CARD.sobat];
  while (muaHand.length < CARD_BATTLE_HAND_MAX) muaHand.push(kit.pop());
  const muaGuts = [kit.pop(), kit.pop()];
  const decks = [
    { monsters: ['C-006', 'C-005', 'C-003'], cards: [...myHand, ...myDeck] },
    { monsters: ['C-006', 'C-008', 'C-009'], cards: [...muaHand, ...muaGuts, ...kit] },
  ];
  let st = cardCreateGame(db, { decks, names: ['あなた', 'みゅあ'], seed: 11, first: 0 });
  st = cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players[0].hand = myHand.slice();
  st.players[0].deck = myDeck;
  st.players[0].guts = [];
  st.players[1].hand = muaHand;
  st.players[1].guts = muaGuts;
  st.players[1].deck = kit;
  st.log = [{ turn: 1, text: '練習試合(あなたが先攻)' }];
  return st;
};
// 練習試合の自分・みゅあのカード(手札・山札・ガッツ)が、同じ名前3枚までになっているか(検査用)
const cardTutorialCopyProblems = (db, st) => {
  const out = [];
  st.players.forEach((pl, p) => {
    const n = {};
    [...pl.hand, ...pl.deck, ...pl.guts, ...pl.discard].forEach((no) => { const c = cardOf(db, no); if (c) n[c.name] = (n[c.name] || 0) + 1; });
    Object.entries(n).forEach(([name, k]) => { if (k > CARD_DECK_COPY_MAX) out.push(`${p === 0 ? '自分' : 'みゅあ'}の「${name}」が${k}枚`); });
  });
  return out;
};

// 「次へ」で場面を変える
const cardTutorialMutate = (db, st0, kind) => {
  const st = cardClone(st0);
  st.events = [];
  if (kind === 'draw') {
    const me = st.players[0];
    while (me.hand.length < CARD_BATTLE_HAND_MAX && me.deck.length) me.hand.push(me.deck.pop());
    cardLog(st, 'あなたは手札が5枚になるまで引いた');
  }
  if (kind === 'fastForward') {
    st.players[1].deck = [];
    cardLog(st, 'みゅあの山札は0枚');
  }
  return st;
};

// その段で、その操作を出してよいか
const cardTutorialAllow = (db, stageId, st, act) => {
  const me = st.players[0];
  if (stageId === 'guts') {
    if (act.type === 'endAttacks') return st.phase === 'main' && st.active === 0;
    if (act.type === 'guts') return (act.hand || []).length >= 1 && !(act.hand || []).some((i) => [CARD_TUTORIAL_CARD.step, CARD_TUTORIAL_CARD.punch].includes(me.hand[i]));
    return false;
  }
  if (stageId === 'guard') {
    if (act.type === 'guard') return me.hand[act.hand] === CARD_TUTORIAL_CARD.step;
    if (act.type === 'pass') return !!(st.pending && st.pending.evaded); // 守ったあとだけ「守らない(次へ)」で進める
    return false;
  }
  if (stageId === 'attack') return (act.type === 'attack') && me.hand[act.hand[0]] === CARD_TUTORIAL_CARD.punch;
  if (stageId === 'deckEnd') return act.type === 'endAttacks';
  if (stageId === 'deckTurn') return act.type === 'guts' && !(act.hand || []).length;
  return false;
};
// 手札のそのカードを、その段で選んでよいか(ガッツへ回すカード・守るカード・技)
const cardTutorialHandOk = (stageId, st, i) => {
  const no = st.players[0].hand[i];
  if (stageId === 'guts') return no !== CARD_TUTORIAL_CARD.step && no !== CARD_TUTORIAL_CARD.punch;
  if (stageId === 'guard') return no === CARD_TUTORIAL_CARD.step;
  if (stageId === 'attack') return no === CARD_TUTORIAL_CARD.punch;
  return false;
};

// その操作で、段が終わったか(次の段へ)
const cardTutorialDone = (stageId, before, after) => {
  const evs = after.events || [];
  if (stageId === 'guts') return after.active === 1;
  if (stageId === 'guard') return evs.some((e) => e.t === 'hit' && e.p === 0 && e.evaded);
  if (stageId === 'attack') return evs.some((e) => e.t === 'hit' && e.p === 1 && e.dmg > 0);
  if (stageId === 'deckEnd') return after.phase === 'guts' && after.active === 0;
  if (stageId === 'deckTurn') return after.winner === 0;
  return false;
};

// みゅあの決まった手(出さないときは null)
const cardTutorialCpu = (db, stageId, st) => {
  if (st.winner !== null) return null;
  if (st.pending) return st.pending.defender === 1 ? { type: 'pass' } : null; // 練習試合のみゅあは守らない
  if (st.active !== 1) return null;
  if (stageId === 'guard' && st.phase === 'main') {
    const opp = st.players[1];
    return cardAttackOptions(db, st).find((o) => opp.hand[o.hand[0]] === CARD_TUTORIAL_CARD.sobat && o.target && o.target.p === 0 && o.target.m === 1) || null;
  }
  if (stageId === 'attack' || stageId === 'guardAfter' || stageId === 'attackAfter') {
    if (st.phase === 'main') return { type: 'endAttacks' };
    if (st.phase === 'guts') return { type: 'guts', hand: [] };
  }
  return null;
};

// 保存(mh_card_tutorial_v1)。読むときは必ず通す
const cardNormalizeTutorial = (v) => {
  const r = cardIsPlainObject(v) ? v : {};
  return { done: r.done === true, skipped: r.skipped === true, rewarded: r.rewarded === true, at: Number.isFinite(Number(r.at)) ? Number(r.at) : 0 };
};
// 終わった・飛ばしたときの保存とカードポイント(はじめて最後までやったときだけ 100。1日の上限とは別)
const cardTutorialFinish = (tutorial, outcome, now) => {
  const t = cardNormalizeTutorial(tutorial);
  const done = outcome === 'done';
  const reward = done && !t.rewarded ? CARD_TUTORIAL_POINT : 0;
  return { tutorial: { done: t.done || done, skipped: t.skipped || !done, rewarded: t.rewarded || reward > 0, at: now }, reward };
};
