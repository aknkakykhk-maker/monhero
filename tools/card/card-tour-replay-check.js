// MFバトルカード大会の見返し(93-card-replay.jsx の cardReplayFromTour)を確かめる(2026-10-30 大会 PR4・カード部リプレイくん)。ブラウザなしで動かす。
//
//   node tools/card/card-tour-replay-check.js
//
// 見るもの
//   A. サーバと同じ部品(82-card-tournament-core の cardTourPlay)で回した試合を、表の1行の形(JSON を通す)にして開くと、
//      最後の手まで当たり直し、同じ勝ち負けで終わる(人どうし・助手の席・先攻後攻の両方)
//   B. 下の人・上の人の名前はその試合のブリーダー。まだ会っていない助手は「助手」とだけ出す(会った助手は「名前(助手)」)
//   C. 実況・解説・会場の見出し・勝った人の名前が、見返しに渡る。ルールの版がちがえば知らせの印が立つ
//   D. 壊れた行(デッキ・種・先攻・手がおかしい)は開かない(null)。端末の保存の形(cardReplayNormalizeOne)には入らない
//   E. 登録デッキが戦われた試合(2026-10-31): 戦った人の端末で作る記録(cardReplayFromCpu)→ 送る形 → サーバの card_deck_replay_get の1行の形 → 見返し が
//      最後の手まで通る。上は「あなたのデッキ」・印は「登録デッキ」・勝ち負けは登録デッキから見た値
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (p) => fs.readFileSync(path.join(GAME, p), 'utf8');
const multi = read('src/parts/91-card-battle-multi.jsx').split('// ---- 部屋と通信')[0];
const replay = read('src/parts/93-card-replay.jsx').split('// ---- 保存(端末の中だけ)')[0];
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${read('data/card-battle-cards.js')}\n;\n${read('src/parts/82-card-battle-core.jsx')}\n;\n${read('src/parts/82-card-tactics-core.jsx')}\n;\n`
  + `${read('src/parts/82-card-share-core.jsx')}\n;\n${read('src/parts/82-card-tournament-core.jsx')}\n;\n`
  + 'const rhythmMultiText = (v, max) => String(v == null ? "" : v).replace(/[\\u0000-\\u001f]/g, "").slice(0, max);\n'
  // 99 の助手の見分け(会っていない助手は名前と顔を出さない)と同じ形
  + 'const ASSISTANTS = [{ id: "kiki", name: "きき" }, { id: "dra", name: "ドラ" }];\n'
  + 'const cardTourAssistOf = (id, known) => { const a = ASSISTANTS.find((x) => x.id === id); if (!a || !(known && known.has(id))) return { name: "助手", face: null }; return { name: a.name, face: `face-${id}` }; };\n'
  + `${multi}\n;\n${replay}\n;\nthis.E = { CARD_BATTLE_DATA, cardTourPlay, cardAiBuildDeck, cardAiSeededRand, cardReplayFromTour, cardReplayBuild, cardReplayNormalizeOne, cardReplayFromCpu, CARD_REPLAY_RULES, CARD_REPLAY_ACTS_MAX };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const deckOf = (who, k) => E.cardAiBuildDeck(db, who, 'normal', E.cardAiSeededRand(`tr|${who}|${k}`));
const tacs = [
  { habit: 'kyuko', f: { b: ['tBalance', 'tFinish', null], r: [], m: [[['incomingKo', 'guard', 1]], [], []] } },
  { habit: 'dra' },
  { habit: 'mua' },
];
// サーバ(supabase/functions/card-tournament-run/core.js の playDue)と同じ回し方で1試合 → card_tournament_match が返す1行の形
const serverRow = (id, sideA, sideB, seed, first, entA, entB) => {
  const res = E.cardTourPlay(db, sideA, sideB, { seed, first, key: `cup|group|0|${id}` });
  const row = {
    id, tournament_id: 'cup1', stage: 'group', day: 0, seed, first, winner: res.winner, kos: res.kos, rules: res.rules, acts: res.acts,
    live: { who: 'kiki', play: '序盤から攻めた!', review: '守りの判断が勝負を分けました', ai: true },
    a: { ...entA, deck: sideA.assist ? res.decks[0] : sideA.deck },
    b: { ...entB, deck: sideB.assist ? res.decks[1] : sideB.deck },
  };
  return { res, row: JSON.parse(JSON.stringify(row)) }; // 表(jsonb)を通した形
};
const person = (name) => ({ name, icon: '🐣', is_assist: false, assist_id: null });
const assist = (id) => ({ name: id, icon: null, is_assist: true, assist_id: id });

// ---- A ----
let bad = [], longest = 0;
for (let i = 0; i < 16; i++) {
  const useAssist = i % 4 === 3;
  const A = { deck: deckOf(['mua', 'kiki', 'momosuke'][i % 3], i), tactics: tacs[i % 3] };
  const B = useAssist ? { assist: ['kiki', 'dra', 'atsu'][i % 3] } : { deck: deckOf(['dra', 'kyuko', 'atsu'][i % 3], i + 50), tactics: tacs[(i + 1) % 3] };
  const { res, row } = serverRow(100 + i, A, B, 1000 + i * 7919, i % 2, person(`A${i}`), useAssist ? assist(B.assist) : person(`B${i}`));
  const rec = E.cardReplayFromTour(db, row, { known: new Set(['kiki']), title: '第1回 公式杯 第1試合' });
  const built = rec && E.cardReplayBuild(db, rec);
  const last = built && built.states[built.states.length - 1];
  longest = Math.max(longest, res.acts.length);
  if (!rec || built.stop !== null || built.states.length !== res.acts.length + 1 || (res.decided !== 'limit' && last.winner !== res.winner)) {
    bad.push(`${i}: ${!rec ? '開けない' : `止まった手 ${built.stop}/${res.acts.length} 勝ち ${last && last.winner}/${res.winner}`}`);
  }
}
check('A サーバで回した16試合(助手の席・先攻後攻を含む)が、最後の手まで当たり直して同じ勝ち負けで終わる', bad.length === 0, bad.slice(0, 3).join(' / ') || `いちばん長い試合 ${longest}手`);

// ---- L 個人杯のリアルタイム杯: 試合の b 側の端末で戦った試合(2026-10-31 ④) ----
//   端末は「自分が0番」で組むので、b 側の端末の手の並びは b・a の順。{ order: 'ba', acts } で残し、見返しは b を上・先攻を入れかえて組み直す。
//   杯の勝ち負け(a・b)はそのまま。a 側で戦ったときと同じく、勝った人の名前と最後の手まで当たり直せるか
{
  const badL = [];
  for (let i = 0; i < 8; i++) {
    const A = { deck: deckOf(['mua', 'kiki', 'momosuke'][i % 3], 200 + i), tactics: tacs[i % 3] };
    const B = { deck: deckOf(['dra', 'kyuko', 'atsu'][i % 3], 300 + i), tactics: tacs[(i + 1) % 3] };
    const seed = 5000 + i * 7919, first = i % 2;
    for (const side of [0, 1]) {
      // その側の端末の試合(自分が0番)。先攻は、杯の first(0 = a)を自分から見た向きに直す
      const res = side === 0 ? E.cardTourPlay(db, A, B, { seed, first, key: `cup|${i}` }) : E.cardTourPlay(db, B, A, { seed, first: 1 - first, key: `cup|${i}` });
      const cupWinner = side === 0 ? res.winner : 1 - res.winner;
      const row = JSON.parse(JSON.stringify({ id: 900 + i, seed, first, winner: cupWinner, kos: res.kos, rules: res.rules,
        acts: side === 0 ? res.acts : { order: 'ba', acts: res.acts }, live: null, a: { ...person(`杯A${i}`), deck: A.deck }, b: { ...person(`杯B${i}`), deck: B.deck } }));
      const rec = E.cardReplayFromTour(db, row, { known: new Set(), title: '個人杯' });
      const built = rec && E.cardReplayBuild(db, rec);
      const last = built && built.states[built.states.length - 1];
      const wantName = cupWinner === 0 ? `杯A${i}` : `杯B${i}`;
      if (!rec || built.stop !== null || built.states.length !== res.acts.length + 1 || (res.decided !== 'limit' && last.winner !== res.winner) || rec.tour.winner !== wantName) {
        badL.push(`${i}/${side ? 'b' : 'a'}: ${!rec ? '開けない' : `止まった手 ${built.stop} 勝ち ${last && last.winner}/${res.winner} 名前 ${rec.tour.winner}/${wantName}`}`);
      }
    }
  }
  check('L 個人杯: b 側の端末で戦った試合(order ba)も、a 側と同じく最後の手まで当たり直し、勝った人の名前が杯の勝ち負けと合う', badL.length === 0, badL.slice(0, 3).join(' / '));
}

// ---- B・C ----
{
  const A = { deck: deckOf('mua', 1), tactics: tacs[0] };
  const { row } = serverRow(7, A, { assist: 'dra' }, 4242, 0, person('ほのか'), assist('dra'));
  const unknown = E.cardReplayFromTour(db, row, { known: new Set(), title: '第1回 公式杯 第2試合' });
  const knownDra = E.cardReplayFromTour(db, row, { known: new Set(['dra', 'kiki']), title: '第1回 公式杯 第2試合' });
  check('B 下の人はその試合のブリーダー(見ている人ではない)', unknown.names[0] === 'ほのか' && unknown.tour.me.name === 'ほのか' && unknown.tour.me.icon === '🐣');
  check('B まだ会っていない助手は「助手」とだけ出す', unknown.foe.name === '助手' && unknown.names[1] === '助手' && unknown.tour.caster.name === '助手' && unknown.tour.caster.face === null);
  check('B 会った助手は「名前(助手)」・実況の助手の顔が出る', knownDra.foe.name === 'ドラ(助手)' && knownDra.tour.caster.name === 'きき' && knownDra.tour.caster.face === 'face-kiki');
  check('C 実況・解説・会場の見出し・勝った人が渡る', knownDra.tour.live.play === '序盤から攻めた!' && knownDra.tour.live.review === '守りの判断が勝負を分けました'
    && knownDra.tour.title === '第1回 公式杯 第2試合' && knownDra.tour.winner === knownDra.names[row.winner] && knownDra.kind === 'tour' && knownDra.id === 'tour-7');
  check('C ルールの版が同じなら知らせない', knownDra.tour.rulesOld === false);
  const old = E.cardReplayFromTour(db, { ...row, rules: E.CARD_REPLAY_RULES - 1 }, {});
  check('C ルールの版がちがえば、知らせの印が立つ(開くことはできる)', !!old && old.tour.rulesOld === true);
  const noLive = E.cardReplayFromTour(db, { ...row, live: null }, {});
  check('C 実況が無い試合も開ける(実況の枠は会場の見出しだけ)', !!noLive && noLive.tour.live === null && noLive.tour.caster === null);
  // ---- D ----
  const broken = [
    ['デッキが無い', { ...row, a: { ...row.a, deck: null } }],
    ['モンスターが2体', { ...row, b: { ...row.b, deck: { monsters: row.b.deck.monsters.slice(0, 2), cards: row.b.deck.cards } } }],
    ['種が文字', { ...row, seed: 'x' }],
    ['先攻が2', { ...row, first: 2 }],
    ['手が無い', { ...row, acts: [] }],
    ['打った人が2', { ...row, acts: [[2, row.acts[0][1]], ...row.acts.slice(1)] }],
    ['知らない手', { ...row, acts: [[row.acts[0][0], { type: 'hack' }], ...row.acts.slice(1)] }],
    ['行が null', null],
  ];
  const opened = broken.filter(([, r]) => E.cardReplayFromTour(db, r, {}) !== null).map(([n]) => n);
  check('D 壊れた行は開かない', opened.length === 0, opened.join('・'));
  check('D 大会の記録は端末の保存の形に入らない(過去の対戦の枠を食わない)', E.cardReplayNormalizeOne(knownDra) === null);
}

// ---- E ----
{
  let badE = [];
  for (let i = 0; i < 8; i++) {
    const fighter = deckOf(['mua', 'kiki', 'momosuke', 'dra'][i % 4], 200 + i);
    const owner = { deck: deckOf(['kyuko', 'atsu', 'dra', 'mua'][i % 4], 300 + i), tactics: tacs[i % 3] };
    const seed = 5000 + i * 104729, first = i % 2;
    // 戦った人の端末の対戦と同じ: 下が戦った人、上が登録デッキ。手は 84 の cpuLogAct と同じ { by, act }
    const res = E.cardTourPlay(db, { deck: fighter, tactics: tacs[(i + 1) % 3] }, owner, { seed, first, key: `deck|${i}` });
    const outcome = res.winner === 0 ? 'win' : 'lose';
    const rec = E.cardReplayFromCpu(db, { id: `s${seed}`, at: 1, myDeck: fighter, cpuDeck: owner.deck, seed, first, history: res.acts.map(([by, act]) => ({ by, act })), foe: { name: '登録した人' }, outcome, reason: '' });
    if (!rec) { badE.push(`${i}: 記録を作れない`); continue; }
    // 送る形(95 の cardShareReplayPut)→ 表 → card_deck_replay_get の形(登録デッキはサーバが登録から写す)
    const put = { p_user_deck: { monsters: rec.decks[0].monsters, cards: rec.decks[0].cards }, p_seed: rec.seeds[0] >>> 0, p_first: rec.first, p_rules: rec.rules, p_acts: rec.acts, p_deck_won: outcome !== 'win' };
    const row = JSON.parse(JSON.stringify({ id: i, kind: 'deck', seed: put.p_seed, first: put.p_first, rules: put.p_rules, acts: put.p_acts, winner: put.p_deck_won ? 1 : 0,
      a: { name: `たたかう人${i}`, icon: '🦊', is_assist: false, deck: put.p_user_deck }, b: { name: '登録した本人', icon: '🐣', is_assist: false, deck: owner.deck } }));
    const back = E.cardReplayFromTour(db, row, { title: 'フリー対戦 10/31 09:00' });
    const built = back && E.cardReplayBuild(db, back);
    const last = built && built.states[built.states.length - 1];
    if (!back || built.stop !== null || (res.decided !== 'limit' && last.winner !== res.winner)) badE.push(`${i}: ${!back ? '開けない' : `止まった手 ${built.stop}/${rec.acts.length}`}`);
    else if (i === 0) {
      check('E 上は「あなたのデッキ」・下は戦った人・印は「登録デッキ」', back.kind === 'deck' && back.names[1] === 'あなたのデッキ' && back.names[0] === 'たたかう人0' && back.tour.badge === '登録デッキ' && back.tour.deck === true && back.tour.me.name === 'たたかう人0');
      check('E 勝った人は登録デッキから見た勝ち負けどおり', back.tour.winner === (put.p_deck_won ? 'あなたのデッキ' : 'たたかう人0') && back.tour.live === null && back.id === 'deck-0');
      check('E 送る手の並びは表の上限(30KB・4,000手)に収まる', JSON.stringify(put.p_acts).length <= 30000 && put.p_acts.length <= 4000, `${JSON.stringify(put.p_acts).length}字`);
    }
  }
  check('E 戦った人の端末で作った記録を、表の形にして開くと最後の手まで通る(8試合)', badE.length === 0, badE.slice(0, 3).join(' / '));
}

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
