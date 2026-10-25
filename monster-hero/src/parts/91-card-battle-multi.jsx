// ===== MFバトルカード: マルチ対戦(人どうしの対戦) =====
// 2026-10-24 社長「この案で作る」(台帳 #126)。担当はバトル部。案: docs/spec/card-battle/MULTI_PLAN.md
// ★公開まではデバッグ設定からだけ入れる。ルールの本体(82-card-battle-core.jsx)には手を入れない
//
// 作り
//   ・通信はモンヒロビートの「みんなで対戦」と同じ Supabase Realtime の Broadcast だけ(部品 rhythmMultiOpenSocket・77)。部屋は realtime:mhc-room-<合言葉>
//   ・2台はそれぞれ「自分 = 0・相手 = 1」の見え方で場を持つ。届いた手は、狙う先の人の番号(target.p)を入れ替えてから当てる
//   ・相手の手札と山札は、番号の無い「仮の札」(CARD_PVP_HIDDEN)。使われた瞬間に、その札の番号だけが届く(reveal)。
//     捨て札は表なので、手を送るたびに自分の捨て札の並びも送り、相手の場の「仮の札」を本物に置き換える
//   ・山札の順は、試合の前に「封」(指紋)だけを見せ合い、終わってから中身を見せ合う。相手の端末で試合を最初からなぞり直し、
//     引いた・使ったカードと勝ち負けが合っていなければ、その試合は無効(cardPvpVerify)
//
// 区切り1(いま): 合言葉の部屋で、2人が1戦を最後まで遊べる。時間切れ・切断・報酬・だれとでも・強さの点数は、このあとの区切り

// 公開の印: MFバトルカードの公開(RELEASE_FLAGS.cardBattle)と同じ日に開ける(2026-10-25 社長 案A)。見るたびに引く(読み込み時に後ろの部品の const を触らない)。
// 印が偽のあいだは、デバッグ設定から入ったときだけ入れる
const cardPvpOpen = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.cardBattle === true;
const CARD_PVP_HIDDEN = -1;               // 相手の見えない札
const CARD_PVP_ROOM_TOPIC = 'realtime:mhc-room-';
const CARD_PVP_HEARTBEAT_MS = 2000;
const CARD_PVP_RESEND_MS = 1500;          // 「受け取った」が来ない手を送り直す間
const CARD_PVP_ALIVE_MS = 60000;          // これだけ何も届かなければ抜けた扱い(社長: iPhone でアプリを切り替えて戻る分)
const CARD_PVP_NAME_MAX = 16;
// 区切り2: 持ち時間(ルールの本文 CARD_BATTLE.md 1-3)。自分の番60秒・守り15秒。3回続けて使い切ったら負け
const CARD_PVP_TURN_MS = 60000;
const CARD_PVP_GUARD_MS = 15000;
const CARD_PVP_TIMEOUT_LOSE = 3;
const CARD_PVP_STALL_GRACE_MS = 20000;    // 相手の持ち時間が過ぎても手が来ないとき、これだけ待ってから相手の負けにする(電波の遅れの分)
const CARD_PVP_QUIET_MS = 6000;           // これだけ相手から何も届かなければ「電波が途切れています」を出す
const CARD_PVP_RECONNECT_MS = 3000;       // こちらの電波が切れたら、これおきにつなぎ直す
const CARD_PVP_VERIFY_WAIT_MS = 15000;    // 相手の封がこれだけ届かなければ、確かめずに終える(相手が抜けたなど)
// 抜けた人は、少しのあいだ部屋に入れない(新しい保存キー。モンヒロビートの mh_rhythm_multi_penalty_v1 と同じ考え方)
const CARD_PVP_PENALTY_KEY = 'mh_card_pvp_penalty_v1';
const CARD_PVP_PENALTY_MS = 3 * 60 * 1000;
const cardPvpNormalizePenalty = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
// 定型のチャット(打たない。1.5秒に1回まで)
const CARD_PVP_STAMPS = Object.freeze(['よろしく！', 'ナイス！', 'うまい！', '考え中…', 'ありがとう！', 'もう1回やろ！']);
const CARD_PVP_CHAT_GAP_MS = 1500;
// 区切り3: だれとでも(受付)。待っている人どうしが自分の部屋の合言葉を知らせ合い、あとから来た人が、先に待っている人の部屋へ入る
const CARD_PVP_LOBBY_TOPIC = 'realtime:mhc-lobby-free';
const CARD_PVP_LOBBY_FRESH_MS = 6000;     // これより古い知らせの人は、もう待っていない
const CARD_PVP_LOBBY_JOIN_MS = 8000;      // 入った部屋で、これだけ始まらなければ、自分の部屋へ戻ってさがし直す
const CARD_PVP_LOBBY_LIMIT_MS = 90000;    // これだけだれも来なければ「助手と対戦へ」の案内(カゲあつくん)
// 強さの点数(勝つと上がる・はじめ1500)。表と関数は docs/sql/card-battle-pvp/CARD_BATTLE_PVP_APPLY.sql(窓口が流す)
const CARD_PVP_RATING_TABLE = 'card_battle_pvp_ratings';
const CARD_PVP_RATING_START = 1500;

// ---- 純粋な計算(ここから下の UI と通信を使わない。tools/card/card-pvp-check.js が node で確かめる) ----

// 相手から見た手を、自分から見た手にする(狙う先の人の番号だけが入れ替わる)
const cardPvpFlip = (act) => {
  if (!act || typeof act !== 'object') return act;
  const out = JSON.parse(JSON.stringify(act));
  if (out.target && (out.target.p === 0 || out.target.p === 1)) out.target.p = 1 - out.target.p;
  return out;
};
// その手で表になる自分の手札(手札の番号 → カードの番号)。ガッツへ伏せる手は見せない
const cardPvpRevealOf = (st, act, p = 0) => {
  if (!st || !act) return {};
  const hand = st.players[p].hand;
  const idxs = act.type === 'guard' ? [act.hand] : (act.type === 'attack' || act.type === 'breeder' || act.type === 'discard') ? (act.hand || []) : [];
  const out = {};
  idxs.forEach((i) => { if (Number.isInteger(i) && i >= 0 && i < hand.length) out[i] = hand[i]; });
  return out;
};
// 試合の始まり(自分の見え方)。相手のデッキはモンスターだけが表で、技カードは全部「仮の札」
// first … 先攻の人(自分から見た番号)
const cardPvpNewGame = (db, { myDeck, mySeed, foeMonsters, foeCount = CARD_BATTLE_DECK_SIZE, first, names }) => cardCreateGame(db, {
  decks: [{ monsters: myDeck.monsters, cards: myDeck.cards }, { monsters: foeMonsters, cards: Array.from({ length: foeCount }, () => CARD_PVP_HIDDEN) }],
  names, seed: mySeed >>> 0, first,
});
// いま決める人(自分から見た番号)。始める前のガッツは後攻、捨てさせられたときは捨てる人(84 の cardDeciderOf と同じ)
const cardPvpDecider = (st) => (st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : cardDecider(st));
// 届いた相手の手を、自分の場に当てる。★ルールの本体は「だれの番か」を見ないので、相手の番でない手はここではねる。だめな手(持っていない札・ガッツが足りない・捨て札の数が合わない)は null
// msg … { act(相手の見え方), reveal:{ 手札の番号: カードの番号 }, discard:[相手の捨て札の並び] }
const cardPvpApplyRemote = (db, st, msg) => {
  if (!st || !msg || !msg.act || st.winner !== null || cardPvpDecider(st) !== 1) return null;
  const s = cardClone(st);
  const foe = s.players[1];
  const reveal = msg.reveal && typeof msg.reveal === 'object' ? msg.reveal : {};
  for (const [k, no] of Object.entries(reveal)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= foe.hand.length || foe.hand[i] !== CARD_PVP_HIDDEN || !cardOf(db, no)) return null;
    foe.hand[i] = no;
  }
  const next = cardApplyAction(db, s, cardPvpFlip(msg.act));
  if (!next) return null;
  if (Array.isArray(msg.discard)) {
    if (msg.discard.length !== next.players[1].discard.length) return null;
    // 表の捨て札は本物に置き換える(こちらで分かっている札と食い違ったらだめ)
    for (let i = 0; i < msg.discard.length; i++) {
      const have = next.players[1].discard[i];
      if (!cardOf(db, msg.discard[i]) || (have !== CARD_PVP_HIDDEN && have !== msg.discard[i])) return null;
    }
    next.players[1].discard = msg.discard.slice();
  }
  return next;
};
// 相手の捨て札の並びだけが届いたとき(こちらの手で相手のガッツが捨て札へ行ったあとなど)。数が合わなければそのまま
const cardPvpPatchDiscard = (db, st, list) => {
  if (!st || !Array.isArray(list) || list.length !== st.players[1].discard.length) return st;
  if (list.some((no, i) => !cardOf(db, no) || (st.players[1].discard[i] !== CARD_PVP_HIDDEN && st.players[1].discard[i] !== no))) return st;
  const s = cardClone(st);
  s.players[1].discard = list.slice();
  return s;
};

// 持ち時間の区切り。決める人・番・守りの回が変わったら、時計をはじめから(攻撃と、そのあとのガッツは同じ60秒)
const cardPvpLimitMs = (st) => (st.pending || st.pendingDiscard ? CARD_PVP_GUARD_MS : CARD_PVP_TURN_MS);
const cardPvpClockKey = (st) => `${cardPvpDecider(st)}-${st.turn}-${st.pending ? `g${st.log.length}` : st.pendingDiscard ? `d${st.log.length}` : st.phase === 'setup' ? 's' : 'm'}`;
// 持ち時間を使い切ったときの手(その番を終える・守らない)。攻撃の番は「攻撃おわり」のあと、ガッツへ回さずにターン終了
const cardPvpTimeoutAct = (st) => (st.pendingDiscard ? { type: 'discard', hand: Array.from({ length: st.pendingDiscard.n }, (_, i) => i) }
  : st.phase === 'setup' ? { type: 'setupGuts', hand: [] } : st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] });
// 1戦でもらえる数(台帳 #119 の対人戦: 勝ち24周・200/負け12周・50/抜けた0。1日の上限は無し・同じ相手の制限も無し(社長の決め直し))
// 負けの周回は、自分の番の数が10回で満額(助手と対戦と同じ)。投了は倒した数で決める。自分の番が3回より前に終わった試合は0
const cardPvpReward = (outcome, facts) => {
  const f = facts || { ownTurns: 0, kos: 0 };
  if (f.ownTurns < CARD_MIN_OWN_TURNS || outcome === 'left') return { point: 0, loops: 0, short: f.ownTurns < CARD_MIN_OWN_TURNS };
  const W = CARD_PVP_REWARD.win, L = CARD_PVP_REWARD.lose;
  if (outcome === 'win') return { point: W.point, loops: W.loops, short: false };
  if (outcome === 'surrender') return { point: Math.min(L.point, f.kos * CARD_SURRENDER_POINT_PER_KO), loops: Math.min(L.loops, Math.round((f.kos * L.loops) / 3)), short: false };
  return { point: L.point, loops: Math.floor(L.loops * Math.min(1, f.ownTurns / CARD_LOSE_FULL_TURNS)), short: false };
};

// 封(山札の切り方とデッキ)。終わるまで中身は見せず、指紋だけを先に渡す
const cardPvpSealText = ({ seed, salt, deck }) => JSON.stringify({ s: seed >>> 0, k: String(salt), m: deck.monsters, c: deck.cards });
const cardPvpSha256 = async (text) => {
  const c = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto : null;
  if (!c) return '';
  const buf = await c.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
};
// 両方の封を開けた本当の始まり(自分の見え方)。相手の山札は、相手が自分の端末で切ったのと同じ順になる
const cardPvpTruthGame = (db, { myDeck, mySeed, foeDeck, foeSeed, first, names }) => {
  const st = cardCreateGame(db, { decks: [myDeck, foeDeck], names, seed: mySeed >>> 0, first });
  const theirs = cardCreateGame(db, { decks: [foeDeck, myDeck], seed: foeSeed >>> 0, first: 1 - first });
  st.players[1] = { ...theirs.players[0], name: st.players[1].name };
  return st;
};
// 試合をなぞり直す。history … [{ by: 0|1, act(自分の見え方), reveal }] を、起きた順に
// 返り値 { ok, why, winner } … ok が false なら無効。winner はなぞり直した結果(投了・抜けたで終わったときは null のまま)
const cardPvpVerify = (db, { myDeck, mySeed, foeDeck, foeSeed, first, names, history, winner }) => {
  if (!foeDeck || !Array.isArray(foeDeck.cards) || !Array.isArray(foeDeck.monsters)) return { ok: false, why: '相手のデッキが読めない' };
  const problems = cardDeckProblems(db, foeDeck);
  if (problems.length) return { ok: false, why: `相手のデッキが決まりに合わない(${problems[0]})` };
  let st = cardPvpTruthGame(db, { myDeck, mySeed, foeDeck, foeSeed, first, names });
  for (let n = 0; n < history.length; n++) {
    const e = history[n];
    if (cardPvpDecider(st) !== e.by) return { ok: false, why: `${n + 1}手目: 番でない人の手` };
    if (e.by === 1) {
      for (const [k, no] of Object.entries(e.reveal || {})) {
        if (st.players[1].hand[Number(k)] !== no) return { ok: false, why: `${n + 1}手目: 相手の手札に無い札を使った` };
      }
    }
    const next = cardApplyAction(db, st, e.act);
    if (!next) return { ok: false, why: `${n + 1}手目: ルールに合わない手` };
    st = next;
  }
  if (winner !== undefined && winner !== null && st.winner !== winner) return { ok: false, why: '勝ち負けが合わない' };
  return { ok: true, why: '', winner: st.winner };
};

// 受け取った知らせを作り直す(知らない形は捨てる・数は上限で切る)。モンヒロビートの rhythmMultiCleanMessage と同じ考え方
const cardPvpInt = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const cardPvpCleanAct = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const types = ['setupGuts', 'guts', 'attack', 'breeder', 'guard', 'pass', 'endAttacks', 'discard'];
  if (!types.includes(raw.type)) return null;
  const act = { type: raw.type };
  if (raw.type === 'guard') { act.hand = cardPvpInt(raw.hand, 20); act.mon = cardPvpInt(raw.mon, 2); if (act.hand === null || act.mon === null) return null; return act; }
  if (Array.isArray(raw.hand)) { act.hand = raw.hand.slice(0, 20).map((i) => cardPvpInt(i, 20)); if (act.hand.some((i) => i === null)) return null; }
  if (raw.mon !== undefined) { act.mon = cardPvpInt(raw.mon, 2); if (act.mon === null) return null; }
  if (raw.target !== undefined) {
    if (raw.target === null) act.target = null;
    else { const p = cardPvpInt(raw.target && raw.target.p, 1); const m = cardPvpInt(raw.target && raw.target.m, 2); if (p === null || m === null) return null; act.target = { p, m }; }
  }
  return act;
};
// カードの番号は「061」「C-001」のような短い文字(data/card-battle-cards.js)
const cardPvpCardId = (v) => (typeof v === 'string' && /^[0-9A-Z-]{1,10}$/.test(v) ? v : null);
const cardPvpCleanCards = (list, max) => (Array.isArray(list) ? list.slice(0, max).map(cardPvpCardId) : null);
const cardPvpCleanMessage = (raw) => {
  if (!raw || typeof raw !== 'object' || typeof raw.t !== 'string' || typeof raw.from !== 'string') return null;
  const from = raw.from.slice(0, 40);
  if (raw.t === 'hb') {
    const mons = cardPvpCleanCards(raw.mons, 3);
    return { t: 'hb', from, name: rhythmMultiText(raw.name, CARD_PVP_NAME_MAX), icon: rhythmMultiText(raw.icon, 8), at: Number.isFinite(raw.at) ? raw.at : 0,
      mons: mons && mons.length === 3 && !mons.includes(null) ? mons : null, count: cardPvpInt(raw.count, 60),
      seal: typeof raw.seal === 'string' && /^[0-9a-f]{64}$/.test(raw.seal) ? raw.seal : null, match: typeof raw.match === 'string' ? raw.match.slice(0, 40) : null,
      bid: typeof raw.bid === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.bid) ? raw.bid : null };
  }
  if (raw.t === 'start') return { t: 'start', from, match: typeof raw.match === 'string' ? raw.match.slice(0, 40) : '', hostFirst: raw.hostFirst === true, guest: typeof raw.guest === 'string' ? raw.guest.slice(0, 40) : '' };
  if (raw.t === 'act') {
    const act = cardPvpCleanAct(raw.act);
    const seq = cardPvpInt(raw.seq, 100000);
    const discard = cardPvpCleanCards(raw.discard, 60);
    if (!act || !seq || (discard && discard.includes(null))) return null;
    const reveal = {};
    if (raw.reveal && typeof raw.reveal === 'object') for (const [k, v] of Object.entries(raw.reveal).slice(0, 5)) { const i = Number(k); if (Number.isInteger(i) && i >= 0 && i < 20 && cardPvpCardId(v)) reveal[i] = v; }
    return { t: 'act', from, match: typeof raw.match === 'string' ? raw.match.slice(0, 40) : '', seq, act, reveal, discard };
  }
  if (raw.t === 'ack') {
    const discard = cardPvpCleanCards(raw.discard, 60);
    return { t: 'ack', from, seq: cardPvpInt(raw.seq, 100000) || 0, discard: discard && !discard.includes(null) ? discard : null };
  }
  if (raw.t === 'open') {
    const cards = cardPvpCleanCards(raw.cards, 60);
    const mons = cardPvpCleanCards(raw.mons, 3);
    if (!cards || cards.includes(null) || !mons || mons.includes(null)) return null;
    return { t: 'open', from, seed: Number.isInteger(raw.seed) ? raw.seed >>> 0 : 0, salt: typeof raw.salt === 'string' ? raw.salt.slice(0, 40) : '', deck: { monsters: mons, cards } };
  }
  if (raw.t === 'seek') { const code = rhythmMultiNormalizeCode(raw.code); return code && Number.isFinite(raw.at) ? { t: 'seek', from, code, at: raw.at } : null; }
  if (raw.t === 'chat') { const i = cardPvpInt(raw.i, CARD_PVP_STAMPS.length - 1); return i === null ? null : { t: 'chat', from, i }; }
  if (raw.t === 'surrender' || raw.t === 'bye' || raw.t === 'timeout') return { t: raw.t, from };
  return null;
};

// マルチ対戦の結果で、立ち絵の自分の助手が言う台詞(2026-10-24 社長「このまま入れる」・控え docs/progress/card-battle/multi/result-lines.md)。
// 場面ごとに3本から1本。[台詞, 表情]。ほかの助手の名前は出さない(まだ会っていない子がいるため)。left … 相手が抜けた
const CARD_PVP_RESULT_LINES = Object.freeze({
  mua: {
    win: [['やったー！ 勝っちゃったね♪ あたしまでﾄﾞｷﾄﾞｷしたｗ', 'happy'], ['まぢすごいぢゃん！ 最後の一手、かっこよすぎたよ！', 'excited'], ['勝ち！ この調子で、どんどん強くなっちゃお٩(`･ω･´)و', 'wink']],
    lose: [['くやしー！ でも、いい勝負だったよ！ 次いこ！', 'troubled'], ['ドンマイ！ あたし、ちゃんと見てたよ(｡ ˘-˘)ｳﾝｳﾝ', 'happy'], ['負けちゃったかー…でも、もう1回やったら勝てるって！', 'crying']],
    left: [['えっ、相手いなくなっちゃった？ 勝ちは勝ちだね♪', 'surprise'], ['また会えたら、ちゃんと決着つけよ！', 'normal'], ['あれれ、行っちゃった…次の相手、さがしにいこ！', 'wink']],
  },
  kiki: {
    win: [['お見事でつ。最後まで押し切りましたね( ˘ω˘)9グッ!', 'happy'], ['勝ちましたね♪♪ ためたガッツの使いどころ、ばっちりでした', 'excited'], ['いい勝負でした。火力で押し切るの、気持ちいいでつね', 'wink']],
    lose: [['あれま…惜しかったでつ。次はもっとためて挑みましょう', 'troubled'], ['負けちゃいましたね。でも、ちゃんと食らいついてましたよ(´ー`*)ウンウン', 'normal'], ['そなのか…お相手も強かったでつね。また挑戦しまつか？', 'crying']],
    left: [['あれま、お相手が抜けちゃいましたね。ためたガッツ、使いそびれちゃいました', 'surprise'], ['電波の調子が悪かったのかもしれませんね。次の方をさがしまつか？', 'normal'], ['お相手、行ってしまいました…。またどこかで会えるといいでつね', 'troubled']],
  },
  momosuke: {
    win: [['え、勝った！！ やるじゃん♡ ちょっとだけ見直したw', 'excited'], ['すご！！ 今の、ももでもマネできないかも♡', 'happy'], ['勝ち〜♡ ほらね、やればできるじゃん！！', 'wink']],
    lose: [['あー負けた！！ でもいい勝負だったよ、えらいえらい♡', 'happy'], ['むかつく〜！！ 次はリベンジしよ、もも応援するから！！', 'angry'], ['ドンマイ！ 相手が強すぎただけだよ♡ たぶんw', 'wink']],
    left: [['え、逃げた！？ もも、ちゃんと見てたからね〜♡', 'surprise'], ['まって、相手いなくなったんだけど！！ 勝ち逃げならぬ負け逃げ？w', 'excited'], ['行っちゃった〜。ももの応援が強すぎたかな♡', 'wink']],
  },
  dra: {
    win: [['ふむ、勝ったな。守りの使いどころが良かったぞ', 'happy'], ['おめでとさん。いい勝ち方だったよ、えへへ', 'wink'], ['やるな。カードの組み合わせ、ちゃんと分かってきたな', 'excited']],
    lose: [['わぁ、負けたか。でも惜しかったぞ。山札の残りを見てれば、もう少しいけたな', 'troubled'], ['ドンマイだ。負けた試合のほうが、学ぶことは多いからな', 'normal'], ['ふむ、今日は相手が一枚上だったな。次は守りを厚くしてみるか', 'surprise']],
    left: [['おや、相手が抜けちまったか。最後までやりたかったんだがなぁ', 'surprise'], ['ふむ、急な用事でもできたのかもな。気にせず次いこうな', 'normal'], ['たしかに、決着はつけたかったな。次の相手に期待だ', 'troubled']],
  },
  atsu: {
    win: [['いいね、勝ち！ 最後の詰め、完璧だった笑', 'happy'], ['まじで強くなってるじゃん！ 次は連勝いこ笑', 'excited'], ['ナイス！ その勝ち方、見てて気持ちよかった！', 'wink']],
    lose: [['しゃあない！ デッキいじったら次いけるよ！', 'normal'], ['惜しかったー笑 てか、相手もガチだったな！', 'troubled'], ['負けても胸張っていいよ！ ちゃんと戦えてた笑', 'happy']],
    left: [['あれ、相手抜けた？ 勝ちは勝ちだけど、決着つけたかったな笑', 'surprise'], ['電波かな？ 次の相手さがそ！', 'normal'], ['途中で抜けるのはナシだよな笑 まぁ〜気にせずいこ！', 'wink']],
  },
  kyuko: {
    win: [['ほい、勝ち！ 組み方がはまってたねぇ笑', 'happy'], ['おけ〜、計算どおりって顔してるよぉw', 'wink'], ['いい勝ち方だったねぇ。ガッツの使い方、上手くなってる🫂', 'excited']],
    lose: [['ぐぬぬぬ…惜しかったねぇ。組み方、いっしょに見直そっかぁ', 'angry'], ['まあ、なんとかなるっしょ笑 次は勝てるよぉ', 'normal'], ['負けたけど、見立ては悪くなかったよ。あと一手だったねぇw', 'troubled']],
    left: [['あら、相手いなくなっちゃったぁ。不戦勝はノーカンにしとこ笑', 'surprise'], ['まあ、こういう日もあるっしょ。次いこw', 'normal'], ['ほい、ちょっと物足りないかぁ。次はちゃんと最後までやりたいねぇ', 'wink']],
  },
});
const cardPvpResultLine = (who, scene, seed = 0) => {
  const list = ((CARD_PVP_RESULT_LINES[who] || CARD_PVP_RESULT_LINES.mua)[scene]) || [];
  if (!list.length) return null;
  const [text, face] = list[Math.abs(seed) % list.length];
  return { text, face };
};
const cardPvpSeedOf = (text) => String(text || '').split('').reduce((a, ch) => ((a * 31) + ch.charCodeAt(0)) >>> 0, 7);

// ---- 部屋と通信(ここから下は画面と通信。区切り1)
// ---- 強さの点数(表 card_battle_pvp_ratings・関数 card_battle_pvp_report)。表がまだ無い環境でも壊れない(無いと分かったら以後アクセスしない) ----
let _cardPvpRatingsUnavailable = false;
const sbCardPvpReport = async ({ match, me, foe, winner, reason, turns, name, icon, frame }) => {
  if (_cardPvpRatingsUnavailable || typeof SUPABASE_URL === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/card_battle_pvp_report`, {
      method: 'POST', headers: SB_HEADERS, signal: controller.signal,
      body: JSON.stringify({ p_match_id: match, p_me: me, p_foe: foe, p_winner: winner, p_reason: String(reason || '').slice(0, 20), p_turns: Number.isFinite(turns) ? turns : 0, p_name: String(name || '').slice(0, 40), p_icon: icon || null, p_frame: frame || null }),
    });
    const body = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, body) || res.status === 404) _cardPvpRatingsUnavailable = true; return null; }
    try { return JSON.parse(body); } catch (_) { return body; }
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const cardPvpRatingFromRow = (row) => {
  if (!row || typeof row !== 'object' || typeof row.breeder_id !== 'string') return null;
  const n = (v) => (Number.isFinite(v) ? v : 0);
  return { breederId: row.breeder_id, userName: typeof row.user_name === 'string' ? row.user_name : '', icon: typeof row.icon === 'string' ? row.icon : '', profileFrame: typeof row.profile_frame === 'string' ? row.profile_frame : '',
    rating: Number.isFinite(row.rating) ? row.rating : CARD_PVP_RATING_START, wins: n(row.wins), loses: n(row.loses) };
};
const sbFetchCardPvpRatings = async () => {
  if (_cardPvpRatingsUnavailable || typeof SUPABASE_URL === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CARD_PVP_RATING_TABLE}?select=breeder_id,user_name,icon,profile_frame,rating,wins,loses&wins=gte.0&order=rating.desc,updated_at.asc&limit=50`, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
    const body = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, body)) { _cardPvpRatingsUnavailable = true; return null; } throw new Error(`${CARD_PVP_RATING_TABLE} ${res.status}`); }
    const rows = JSON.parse(body || '[]');
    return (Array.isArray(rows) ? rows : []).map(cardPvpRatingFromRow).filter((e) => e && e.wins + e.loses > 0);
  } finally { clearTimeout(timer); }
};

// ---- フレンドから招待(区切り4・表 card_battle_invites)。モンヒロビートの friend_invites と同じ形の、カード用の新しい表 ----
// ★表が無い環境でも、フレンドの機能は止めない(friendsRequest を使わず、ここで別に数える)
const CARD_PVP_INVITE_TTL_MS = 3 * 60 * 1000;   // これより古い招待は出さない
const CARD_PVP_INVITE_POLL_MS = 8000;           // 部屋に入っていないあいだ、これおきに読む
const CARD_PVP_INVITE_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;
let _cardPvpInvitesUnavailable = false;
const cardPvpInviteRequest = async (path, { method = 'GET', body = null, prefer = null } = {}) => {
  if (_cardPvpInvitesUnavailable || typeof SUPABASE_URL === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: prefer ? { ...SB_HEADERS, Prefer: prefer } : SB_HEADERS, cache: 'no-store', signal: controller.signal, body: body === null ? undefined : JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text)) _cardPvpInvitesUnavailable = true; return null; }
    return text ? JSON.parse(text) : [];
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const sbSendCardInvite = async (selfId, targetId, code) => {
  const room = rhythmMultiNormalizeCode(code);
  if (!CARD_PVP_INVITE_ID_RE.test(String(selfId)) || !CARD_PVP_INVITE_ID_RE.test(String(targetId)) || selfId === targetId || !room) return false;
  const r = await cardPvpInviteRequest('card_battle_invites?on_conflict=sender_id,target_id', { method: 'POST', body: [{ sender_id: selfId, target_id: targetId, room_code: room }], prefer: 'resolution=merge-duplicates,return=minimal' });
  return r !== null;
};
// 自分に届いている3分以内の招待 [{ senderId, roomCode, createdAt }](新しい順)
const sbFetchCardInvites = async (selfId, nowMs) => {
  if (!CARD_PVP_INVITE_ID_RE.test(String(selfId))) return [];
  const since = new Date(nowMs - CARD_PVP_INVITE_TTL_MS).toISOString();
  const rows = await cardPvpInviteRequest(`card_battle_invites?select=sender_id,room_code,created_at&target_id=eq.${selfId}&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20`);
  return (Array.isArray(rows) ? rows : []).map((row) => ({ senderId: typeof row.sender_id === 'string' ? row.sender_id : '', roomCode: rhythmMultiNormalizeCode(row.room_code), createdAt: Date.parse(row.created_at) || 0 }))
    .filter((x) => CARD_PVP_INVITE_ID_RE.test(x.senderId) && x.roomCode && nowMs - x.createdAt <= CARD_PVP_INVITE_TTL_MS);
};
// 招待の相手(承認済みのフレンドだけ)。フレンドの表が無い環境では空。検査のときは window.__mhCardPvpRosterTest を使う
const cardPvpRoster = async (selfId) => {
  if (typeof window !== 'undefined' && Array.isArray(window.__mhCardPvpRosterTest)) return window.__mhCardPvpRosterTest;
  if (typeof sbFetchFriendRoster !== 'function') return [];
  try { return await sbFetchFriendRoster(selfId); } catch (_) { return []; }
};

// 部屋の状態は React の外に置く(対戦の画面へ行って戻っても、部屋は切れない。モンヒロビートの RHYTHM_MULTI と同じ)
const CARD_PVP = (() => {
  const listeners = new Set();
  let s = null;
  let socket = null;
  let alive = false;                // いまつながっているか
  let tick = null;
  let retry = null;                 // つなぎ直しの予約
  let lobby = null;                 // だれとでもの受付(部屋とは別のつながり)
  let lobbyAlive = false;
  let board = null;                 // 対戦の画面の受け口 { onAct(msg) → 次の場|null, onDiscard(list), onForceEnd(outcome), onChat(text) }
  const blank = () => ({ phase: 'idle', code: '', me: null, foe: null, deck: null, seed: 0, salt: '', seal: '', match: '', hostFirst: false, first: 0,
    game: null, startMsg: null, foeInMatch: false, mySeq: 0, outbox: [], theirSeq: 0, inbox: {}, history: [], result: null, foeOpen: null, error: '', broken: '',
    offline: false, timeouts: 0, autoActing: false, chatAt: 0, mode: 'private', seekAt: 0, seekers: {}, lobbyCount: 0, joining: '', joinAt: 0, ownCode: '', reported: '' });
  const emit = () => listeners.forEach((fn) => { try { fn(s); } catch (_) { /* 画面の都合で落ちても部屋は続ける */ } });
  const set = (patch) => { s = { ...s, ...patch }; emit(); };
  const send = (payload) => { if (socket && alive) socket.send({ ...payload, from: s.me.id }); };
  const isHost = () => !!(s.foe && (s.me.at < s.foe.at || (s.me.at === s.foe.at && s.me.id < s.foe.id)));
  const hb = () => send({ t: 'hb', name: s.me.name, icon: s.me.icon, at: s.me.at, mons: s.deck.monsters, count: s.deck.cards.length, seal: s.seal, match: s.match || null, bid: s.me.bid || null });
  const closeLobby = () => { lobbyAlive = false; if (lobby) { try { lobby.close(); } catch (_) { /* 閉じている */ } } lobby = null; };
  const sendOpen = () => send({ t: 'open', seed: s.seed, salt: s.salt, mons: s.deck.monsters, cards: s.deck.cards });
  const inGame = () => !!s && (s.phase === 'playing' || s.phase === 'over');
  const stop = () => {
    if (tick) clearInterval(tick); tick = null;
    if (retry) clearTimeout(retry); retry = null;
    alive = false;
    if (socket) { try { socket.close(); } catch (_) { /* 閉じている */ } } socket = null;
    closeLobby();
  };
  // 抜けた人は、少しのあいだ部屋に入れない(試合の途中で部屋を出た・アプリを閉じたとき)
  const penalize = () => { try { void storeSet(CARD_PVP_PENALTY_KEY, Date.now() + CARD_PVP_PENALTY_MS, false); } catch (_) { /* 保存できなくても続ける */ } };
  // 始まり(ホストのくじが届いたとき)
  const begin = (msg) => {
    if (s.match || !s.foe) return;
    const iHost = isHost();
    const first = (iHost === msg.hostFirst) ? 0 : 1;
    const st = cardPvpNewGame(CARD_BATTLE_DATA, { myDeck: s.deck, mySeed: s.seed, foeMonsters: s.foe.mons, foeCount: s.foe.count || CARD_BATTLE_DECK_SIZE, first, names: ['あなた', s.foe.name || 'あいて'] });
    closeLobby();
    set({ phase: 'playing', match: msg.match, hostFirst: msg.hostFirst, first, game: { key: `pvp-${msg.match}`, st, who: 'pvp', level: 'normal', pvp: { name: s.foe.name || 'あいて', icon: s.foe.icon || '🙂' } } });
  };
  const deliver = () => {
    // 届いた順にそろえて、つぎの番号のものから当てる(抜けがあれば待つ)
    while (board && s.inbox[s.theirSeq + 1]) {
      const msg = s.inbox[s.theirSeq + 1];
      const inbox = { ...s.inbox }; delete inbox[s.theirSeq + 1];
      const next = board.onAct(msg);
      if (!next) { set({ inbox, broken: '相手の手がルールに合いませんでした。この試合は続けられません' }); return; }
      s = { ...s, inbox, theirSeq: msg.seq, history: [...s.history, { by: 1, act: cardPvpFlip(msg.act), reveal: msg.reveal }] };
      send({ t: 'ack', seq: msg.seq, discard: next.players[0].discard });
      emit();
    }
  };
  const forceEnd = (outcome) => { if (s && s.phase === 'playing' && board) board.onForceEnd(outcome); };
  // 終わったあと: 両方の封がそろったら、なぞり直す
  const tryVerify = async () => {
    if (!s.result || !s.foeOpen || s.result.verify !== 'wait') return;
    const o = s.foeOpen;
    const seal = await cardPvpSha256(cardPvpSealText({ seed: o.seed, salt: o.salt, deck: o.deck }));
    if (!s.result || s.result.verify !== 'wait') return;
    if (!seal || seal !== (s.foe && s.foe.seal)) { set({ result: { ...s.result, verify: 'ng', why: '相手の山札の封が合いませんでした' } }); return; }
    const winner = s.result.reward === 'win' && !s.result.forced ? 0 : s.result.reward === 'lose' && !s.result.forced ? 1 : null;
    const v = cardPvpVerify(CARD_BATTLE_DATA, { myDeck: s.deck, mySeed: s.seed, foeDeck: o.deck, foeSeed: o.seed, first: s.first, names: ['あなた', 'あいて'], history: s.history, winner });
    set({ result: { ...s.result, verify: v.ok ? 'ok' : 'ng', why: v.why } });
  };
  const onMessage = (raw) => {
    const msg = cardPvpCleanMessage(raw);
    if (!s || !msg) return;
    if (msg.from === s.me.id) { if (msg.t === 'start' && isHost()) begin(msg); return; } // 自分の送ったもの(Broadcast は自分にも返る)
    if (s.foe && s.foe.id !== msg.from) return; // 3人目は相手にしない(1対1)
    const now = Date.now();
    if (msg.t === 'hb') {
      if (!s.foe && s.phase !== 'waiting') return;
      const foe = { id: msg.from, name: msg.name || 'あいて', icon: msg.icon || '🙂', at: msg.at, mons: msg.mons, count: msg.count, seal: msg.seal, bid: msg.bid, seen: now };
      if (s.foe && s.foe.seal && msg.seal && s.foe.seal !== msg.seal && s.phase !== 'waiting') return; // 始まったあとに封を変えさせない
      s = { ...s, foe: { ...(s.foe || {}), ...foe } };
      // ホストが、2人そろったら先攻・後攻のくじを引く
      // ★くじの知らせは、相手がまだこちらを知らない間に届くと捨てられる。相手の hb にその試合の印が載るまで、毎回送り直す(tick)
      if (s.phase === 'waiting' && !s.match && !s.startMsg && isHost() && s.foe.mons && s.foe.seal) {
        s = { ...s, startMsg: { t: 'start', match: rhythmMultiMakeId('m'), hostFirst: Math.random() < 0.5, guest: s.foe.id } };
        send(s.startMsg);
      }
      if (s.match && msg.match === s.match) s = { ...s, foeInMatch: true };
      emit();
      return;
    }
    if (s.foe) s = { ...s, foe: { ...s.foe, seen: now } };
    if (msg.t === 'start') { if (!isHost() && msg.guest === s.me.id) begin(msg); return; }
    if (msg.t === 'act') {
      if (msg.match !== s.match) return;
      if (msg.seq <= s.theirSeq) { send({ t: 'ack', seq: s.theirSeq }); return; }
      s = { ...s, inbox: { ...s.inbox, [msg.seq]: msg } };
      deliver();
      return;
    }
    if (msg.t === 'ack') {
      s = { ...s, outbox: s.outbox.filter((m) => m.seq > msg.seq) };
      if (msg.discard && board) board.onDiscard(msg.discard);
      emit();
      return;
    }
    if (msg.t === 'open') { if (!s.foeOpen) { set({ foeOpen: msg }); void tryVerify(); } return; }
    if (msg.t === 'chat') { if (s.phase === 'playing' && board && board.onChat) board.onChat(CARD_PVP_STAMPS[msg.i]); return; }
    if (msg.t === 'surrender' || msg.t === 'bye' || msg.t === 'timeout') {
      if (s.phase === 'playing') forceEnd(msg.t === 'surrender' ? 'foeSurrender' : msg.t === 'timeout' ? 'foeTimeout' : 'foeLeft');
      else if (s.phase === 'waiting') set({ foe: null });
    }
  };
  // つなぐ(電波が切れたら、同じ部屋へつなぎ直す。届いていない手は送り直しで追いつく)
  const connect = () => {
    if (retry) clearTimeout(retry); retry = null;
    if (socket) { try { socket.close(); } catch (_) { /* 閉じている */ } }
    alive = false;
    const me = socket = rhythmMultiOpenSocket({
      topic: `${CARD_PVP_ROOM_TOPIC}${s.code}`,
      onOpen: () => { if (socket !== me) return; alive = true; set({ offline: false, phase: s.phase === 'connecting' ? 'waiting' : s.phase }); hb(); },
      onMessage: (raw) => { if (socket === me) onMessage(raw); },
      onClose: () => {
        if (socket !== me || !s) return;
        alive = false;
        if (s.phase === 'connecting') { set({ phase: 'error', error: 'つながりませんでした。電波のよい所で、もう一度お試しください' }); return; }
        if (s.phase === 'idle' || s.phase === 'error') return;
        set({ offline: true });
        retry = setTimeout(connect, CARD_PVP_RECONNECT_MS);
      },
    });
  };
  // ---- だれとでも(受付) ----
  const lobbySend = (payload) => { if (lobby && lobbyAlive) lobby.send({ ...payload, from: s.me.id }); };
  const onLobby = (raw) => {
    const msg = cardPvpCleanMessage(raw);
    if (!s || !msg || msg.t !== 'seek' || msg.from === s.me.id) return;
    s = { ...s, seekers: { ...s.seekers, [msg.from]: { code: msg.code, at: msg.at, seen: Date.now() } } };
  };
  const openLobby = () => {
    closeLobby();
    const me = lobby = rhythmMultiOpenSocket({
      topic: CARD_PVP_LOBBY_TOPIC,
      onOpen: () => { if (lobby === me) lobbyAlive = true; },
      onMessage: (raw) => { if (lobby === me) onLobby(raw); },
      onClose: () => { if (lobby !== me) return; lobbyAlive = false; if (s && s.mode === 'free' && s.phase === 'waiting') setTimeout(() => { if (lobby === me && s && s.phase === 'waiting') openLobby(); }, CARD_PVP_RECONNECT_MS); },
    });
  };
  // 2秒ごと: 自分の部屋を知らせ、先に待っている人がいれば、その部屋へ移る(同じ時刻なら id の小さい人が待つ側)
  const seekTick = () => {
    const now = Date.now();
    const fresh = Object.entries(s.seekers).filter(([, x]) => now - x.seen <= CARD_PVP_LOBBY_FRESH_MS);
    s = { ...s, seekers: Object.fromEntries(fresh), lobbyCount: fresh.length + 1 };
    if (s.foe) { emit(); return; }
    if (s.joining) {
      // 入った部屋で始まらない(もう相手が決まっていた など)ときは、自分の部屋へ戻ってさがし直す
      if (now - s.joinAt > CARD_PVP_LOBBY_JOIN_MS) { const code = rhythmMultiMakeCode(); s = { ...s, joining: '', code, ownCode: code, seekAt: now }; connect(); }
      emit();
      return;
    }
    const older = fresh.filter(([id, x]) => x.at < s.seekAt || (x.at === s.seekAt && id < s.me.id)).sort((a, b) => a[1].at - b[1].at)[0];
    if (older) { s = { ...s, joining: older[1].code, joinAt: now, code: older[1].code }; connect(); emit(); return; }
    lobbySend({ t: 'seek', code: s.code, at: s.seekAt });
    emit();
  };
  const open = async (code, profile, deck, mode = 'private') => {
    stop();
    const bid = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0;
    const salt = rhythmMultiMakeId('k');
    const seal = await cardPvpSha256(cardPvpSealText({ seed, salt, deck }));
    s = { ...blank(), phase: 'connecting', code, ownCode: code, mode, seekAt: Date.now(), deck: { monsters: deck.monsters.slice(), cards: deck.cards.slice() }, seed, salt, seal,
      me: { id: rhythmMultiMakeId('c'), name: rhythmMultiText(profile.name || 'ブリーダー', CARD_PVP_NAME_MAX), icon: rhythmMultiText(profile.icon || '🙂', 8), at: Date.now(), bid: typeof bid === 'string' ? bid : null } };
    emit();
    if (!seal) { set({ phase: 'error', error: 'この端末では、マルチ対戦の封を作れませんでした' }); return; }
    connect();
    if (mode === 'free') openLobby();
    tick = setInterval(() => {
      if (!s || !socket) return;
      hb();
      if (s.mode === 'free' && s.phase === 'waiting') seekTick();
      if (s.startMsg && !s.foeInMatch && isHost()) send(s.startMsg);
      s.outbox.forEach((m) => send(m)); // 「受け取った」が来ていない手は送り直す
      if (s.phase === 'over') sendOpen();
      // 相手から何も届かないまま CARD_PVP_ALIVE_MS が過ぎたら、抜けた扱い(こちらの電波が切れているあいだは数えない)
      if (s.phase === 'playing' && s.foe && alive && Date.now() - s.foe.seen > CARD_PVP_ALIVE_MS) forceEnd('foeLeft');
    }, CARD_PVP_HEARTBEAT_MS);
  };
  // iPhone でアプリを切り替えて戻ってきたら、すぐにつなぎ直す / タブを閉じるときは「抜けます」を送る
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && inGame() && !alive) connect(); });
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => { if (s && s.phase === 'playing') { send({ t: 'bye' }); penalize(); } });
  }
  return {
    get: () => s || blank(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    create: (profile, deck) => open(rhythmMultiMakeCode(), profile, deck),
    // だれとでも: 自分の部屋を作って受付で待つ。先に待っている人がいれば、その部屋へ入る
    free: (profile, deck) => open(rhythmMultiMakeCode(), profile, deck, 'free'),
    // さがし直す(90秒だれも来なかったあと)
    seekAgain: () => { if (s && s.mode === 'free' && s.phase === 'waiting') { s = { ...s, seekAt: Date.now(), joining: '' }; emit(); } },
    join: (code, profile, deck) => { const c = rhythmMultiNormalizeCode(code); if (!c) return false; void open(c, profile, deck); return true; },
    leave: () => { if (s && s.phase === 'playing') penalize(); if (s && socket) send({ t: 'bye' }); stop(); board = null; s = blank(); emit(); },
    // 対戦の画面がつなぐ。届いていた手があれば、ここで当てる
    attach: (h) => { board = h; deliver(); return () => { if (board === h) board = null; }; },
    // 自分の手を進めたとき(対戦の画面から)。自分で打った手なら、時間切れの続きの数を0に戻す
    local: (prev, act, next) => {
      if (!s || s.phase !== 'playing') return;
      const msg = { t: 'act', match: s.match, seq: s.mySeq + 1, act, reveal: cardPvpRevealOf(prev, act), discard: next.players[0].discard };
      s = { ...s, mySeq: msg.seq, outbox: [...s.outbox, msg], history: [...s.history, { by: 0, act, reveal: {} }], timeouts: s.autoActing ? s.timeouts : 0 };
      send(msg);
      emit();
    },
    // 持ち時間(useCardPvpClock から)。使い切った回を数え、3回続けたら負け
    timedOut: () => { if (!s || s.phase !== 'playing') return 0; s = { ...s, timeouts: s.timeouts + 1 }; emit(); return s.timeouts; },
    timeoutLose: () => { if (!s || s.phase !== 'playing') return; send({ t: 'timeout' }); forceEnd('timeout'); },
    foeStalled: () => forceEnd('foeTimeout'),
    auto: (fn) => { if (!s) return fn(); s.autoActing = true; try { return fn(); } finally { s.autoActing = false; } },
    chat: (i) => {
      if (!s || s.phase !== 'playing' || !CARD_PVP_STAMPS[i] || Date.now() - s.chatAt < CARD_PVP_CHAT_GAP_MS) return false;
      s = { ...s, chatAt: Date.now() }; send({ t: 'chat', i }); return true;
    },
    alive: () => alive,
    surrender: () => { if (s && s.phase === 'playing') send({ t: 'surrender' }); },
    // 決着したとき(対戦の画面から)。封を開けて、相手の封を待つ。相手が抜けたときは確かめない(相手の封は届かない)
    finish: (outcome, st) => {
      if (!s || s.phase !== 'playing') return;
      const label = { win: '勝ち', lose: '負け', surrender: '投了', foeSurrender: '相手の投了', foeLeft: '相手が抜けた', timeout: '時間切れ', foeTimeout: '相手の時間切れ' }[outcome] || '';
      const reward = ['win', 'foeSurrender', 'foeLeft', 'foeTimeout'].includes(outcome) ? 'win' : outcome === 'surrender' ? 'surrender' : 'lose';
      const forced = !['win', 'lose'].includes(outcome); // 投了・抜けた・時間切れで終わった(なぞり直しで勝ち負けまでは比べない)
      set({ phase: 'over', result: { outcome: reward === 'win' ? 'win' : 'lose', reward, forced, reason: label, facts: cardResultFacts(st, CARD_ME), verify: outcome === 'foeLeft' ? 'skip' : 'wait', why: '', rewarded: false } });
      sendOpen();
      void tryVerify();
      setTimeout(() => { if (s && s.result && s.result.verify === 'wait') set({ result: { ...s.result, verify: 'skip' } }); }, CARD_PVP_VERIFY_WAIT_MS);
    },
    markRewarded: (got) => { if (s && s.result) set({ result: { ...s.result, rewarded: true, got } }); },
    // 強さの点数へ届ける(確かめが済んだ試合だけ・1試合1回)。2人の届けが合ったときだけ、データベースの関数が点数を動かす
    report: async ({ frame = null } = {}) => {
      if (!s || !s.result || s.reported === s.match || !s.match || !s.me.bid || !s.foe || !s.foe.bid) return null;
      if (s.result.verify !== 'ok' && s.result.verify !== 'skip') return null;
      s = { ...s, reported: s.match };
      const winner = s.result.outcome === 'win' ? s.me.bid : s.foe.bid;
      return sbCardPvpReport({ match: s.match, me: s.me.bid, foe: s.foe.bid, winner, reason: s.result.reason, turns: (s.result.facts && s.result.facts.ownTurns) || 0, name: s.me.name, icon: s.me.icon, frame });
    },
  };
})();

// 台詞を、句読点・「！」「？」・「…」・空白の区切りごとの折れないかたまりにする(「かっこよ／すぎたよ」のような言葉の途中の折れを防ぐ。窓口・カゲあつくん)。
// 顔文字と、うしろに続くカナ・数字・「!」(「(｡ ˘-˘)ｳﾝｳﾝ」「( ˘ω˘)9グッ!」)も1つのかたまり。かたまりが吹き出しの幅より長いときだけ、中で折れる
const CARD_PVP_FACE_RE = /(\([^()\s]*(?:\s[^()\s]*)*\)[0-9\u30A0-\u30FF\uFF65-\uFF9F!！]*|[\u0660-\u06FF٩][^\s、。！？]*[و])/;
// 長いかたまり(吹き出しの1行 = およそ11字より長い)は、言葉の区切り(Intl.Segmenter)で、次の所でだけ、さらに区切る
//   ① 助詞のうしろ(助詞が2つ続くときと、ききの「〜でつ・〜です」の「で」は除く)
//   ② ひらがなの言葉 → 漢字で始まる言葉 / ③ 2字以上の漢字の言葉 → 助詞でないひらがなの言葉 / ④「だけど」「けど」「かも」「だから」の手前
//   区切ったかたまりが2字より短くなるときは区切らない
// ★文末の「よ」「な」「ね」と「って」は入れない(「かっこよすぎ」「強くなってる」の途中で折れた)
const CARD_PVP_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'も', 'と', 'の', 'へ', 'まで', 'から', 'けど', 'ので', '、']);
const cardPvpSplitWords = (piece) => {
  if (piece.length <= 11 || typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return [piece];
  const words = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(piece)].map((x) => x.segment);
  const P = CARD_PVP_PARTICLES;
  const out = [''];
  words.forEach((w, i) => {
    out[out.length - 1] += w;
    const next = words[i + 1];
    if (!next || /^[ぁぃぅぇぉっゃゅょゎー〜…！？!?wｗ笑。、]/.test(next)) return;
    if (out[out.length - 1].length < 2 || (P.has(w) && P.has(words[i - 1])) || (w === 'で' && /^[つす]/.test(next))) return;
    if ((P.has(w) && !P.has(next)) || (/^[ぁ-ん]+$/.test(w) && /^[\u4E00-\u9FFF]/.test(next)) || (/^[\u4E00-\u9FFF]{2,}$/.test(w) && /^[ぁ-ん]/.test(next) && !P.has(next)) || ['だけど', 'けど', 'かも', 'だから'].includes(next)) out.push('');
  });
  return out.filter((x) => x !== '');
};
const cardPvpLinePieces = (text) => {
  const out = [];
  String(text).split(CARD_PVP_FACE_RE).filter((x) => x !== '').forEach((part) => {
    if (CARD_PVP_FACE_RE.test(part) && /^[(٩]/.test(part)) { out.push(part); return; }
    // 「、」「。」「！」「？」「…」「ｗ」のあと、空白のところで区切る(区切りの字はまえのかたまりに付ける)
    part.split(/(?<=[、。！？!?…ｗw♪♡])(?![、。！？!?…ｗw♪♡])|(?<=\s)/).filter((x) => x !== '').forEach((x) => cardPvpSplitWords(x).forEach((y) => out.push(y)));
  });
  return out;
};
// 吹き出しより長いかたまりの中だけは、言葉の区切り(jaWrap)で折れる
const cardPvpLineNode = (text) => cardPvpLinePieces(text).map((x, i) => <span key={i} data-pvp-phrase className="inline-block">{/^[(٩]/.test(x) ? x : jaWrap(x)}</span>);
// 文を読点で区切り、区切りごとに折れないようにする(「見せ／合って」のような言葉の途中の折れを防ぐ。カゲあつくん)
const cardPvpPhrases = (text) => String(text).split(/(?<=、)/).map((x, i) => <span key={i} className="inline-block">{x}</span>);

// ---- 画面: マルチ対戦の部屋(合言葉) ----
// onStart(game) … 試合が始まったら対戦の画面へ。onBack … 対戦の選び方へ戻る(部屋も出る)
// onReward(result) … 確かめが済んだら1回だけ呼ぶ(84 が保存して { point, loops, quick, saved } を返す)。確かめで無効になった試合は呼ばない
// assistant … 結果の画面に立ち絵を出す自分の助手(84 の topAssistant)/ point … いまのカードポイント
// onAssistant … 「助手と対戦へ」(だれとでもで、だれも来なかったとき)/ rankSend … 強さの点数へ届けてよいか(公開後のふつうの入口だけ。84→60-app の rank.send)
const CardPvpLobby = ({ deck, deckIssues = [], onStart, onBack, onReward, assistant = null, point = null, onAssistant = null, rankSend = false }) => {
  const [room, setRoom] = useState(() => CARD_PVP.get());
  const [code, setCode] = useState('');
  const [profile, setProfile] = useState({ name: 'ブリーダー', icon: '🙂' });
  useEffect(() => CARD_PVP.subscribe(setRoom), []);
  // 試合の途中で抜けた人は、少しのあいだ入れない(mh_card_pvp_penalty_v1。無い・壊れた値は 0 = 入れる)
  const [penaltyUntil, setPenaltyUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { storeGet(CARD_PVP_PENALTY_KEY, 0, false).then((v) => setPenaltyUntil(cardPvpNormalizePenalty(v))).catch(() => {}); }, [room.phase]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const penaltyMin = penaltyUntil > now ? Math.ceil((penaltyUntil - now) / 60000) : 0;
  // フレンドから招待: 自分のブリーダーid・名簿(承認済みのフレンド)・届いている招待
  const [selfBid, setSelfBid] = useState('');
  const [roster, setRoster] = useState(null);
  const [invites, setInvites] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invited, setInvited] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      if (!alive || typeof id !== 'string') return;
      setSelfBid(id);
      const list = await cardPvpRoster(id);
      if (alive) setRoster(Array.isArray(list) ? list : []);
    })();
    return () => { alive = false; };
  }, []);
  // 部屋に入っていないあいだだけ、8秒おきに招待を読む(承認済みのフレンドからの3分以内だけ)
  useEffect(() => {
    if (room.phase !== 'idle' || !selfBid || !roster || !roster.length) { setInvites([]); return undefined; }
    let alive = true;
    const ids = new Map(roster.map((f) => [f.otherId, f.userName]));
    const load = async () => { const list = await sbFetchCardInvites(selfBid, Date.now()); if (alive) setInvites(list.filter((x) => ids.has(x.senderId)).map((x) => ({ ...x, name: ids.get(x.senderId) }))); };
    void load();
    const t = setInterval(load, CARD_PVP_INVITE_POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [room.phase, selfBid, roster]);
  // 報酬: 確かめが「合っている」か「確かめられない(相手が抜けた・封が届かない)」になったら、1回だけ渡す
  const rewardRef = useRef(onReward);
  rewardRef.current = onReward;
  useEffect(() => {
    const r = room.result;
    if (room.phase !== 'over' || !r || r.rewarded) return;
    if (r.verify === 'ng') { CARD_PVP.markRewarded(null); return; }
    if (r.verify !== 'ok' && r.verify !== 'skip') return;
    CARD_PVP.markRewarded({ pending: true });
    Promise.resolve(rewardRef.current ? rewardRef.current(r) : null).then((got) => CARD_PVP.markRewarded(got)).catch(() => CARD_PVP.markRewarded(null));
    // 強さの点数へ届ける(公開後のふつうの入口から遊んだときだけ。検査は window.__mhCardPvpRankTest で通す)
    if (rankSend || (typeof window !== 'undefined' && window.__mhCardPvpRankTest === true)) void CARD_PVP.report();
  }, [room.phase, room.result && room.result.verify]);
  useEffect(() => {
    let alive = true;
    Promise.all([storeGet('mh_breeder_name', 'ブリーダー', false), storeGet('mh_breeder_icon', '🙂', false)])
      .then(([name, icon]) => { if (alive) setProfile({ name: typeof name === 'string' && name ? name : 'ブリーダー', icon: typeof icon === 'string' && icon ? icon : '🙂' }); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  // 始まったら対戦の画面へ(1回だけ)
  const started = useRef('');
  useEffect(() => { if (room.phase === 'playing' && room.game && started.current !== room.match) { started.current = room.match; onStart(room.game); } }, [room.phase, room.match]);
  const btn = 'mh-button min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40';
  const ready = !!deck && deckIssues.length === 0 && penaltyMin === 0;
  const back = () => { CARD_PVP.leave(); onBack(); };
  const r = room.result;
  // ---- 結果(助手と対戦の結果の画面と同じ形: 立ち絵・もらったカードポイント・クイック周回・いまのカードポイント) ----
  // ★立ち絵の横は、助手の台詞ではなく結果の文(マルチ対戦の結果の台詞は、まだ作っていない。台詞は社長が先に読む決まり)
  if (room.phase === 'over' && r) {
    const win = r.outcome === 'win';
    const a = assistant && typeof ASSISTANTS !== 'undefined' ? ASSISTANTS.find((x) => x.id === assistant.id) || null : null;
    const got = r.got && !r.got.pending ? r.got : null;
    const foeName = room.foe ? room.foe.name : 'あいて';
    const scene = r.reason === '相手が抜けた' ? 'left' : win ? 'win' : 'lose';
    // 検査のときだけ、写真に出す台詞を選べる(window.__mhCardPvpLineSeed)
    const lineSeed = typeof window !== 'undefined' && Number.isInteger(window.__mhCardPvpLineSeed) ? window.__mhCardPvpLineSeed : cardPvpSeedOf(room.match);
    const line = a ? cardPvpResultLine(a.id, scene, lineSeed) : null;
    const verifyText = r.verify === 'ok' ? 'おたがいの山札を見せ合って、正しく終わったことを確かめました' : r.verify === 'ng' ? `この試合は無効です(${r.why})`
      : r.verify === 'skip' ? '相手の山札は届きませんでした(相手が抜けたため)' : 'おたがいの山札を見せ合って、確かめています…';
    return (
      <div data-mh-screen data-card-pvp="over" data-card-pvp-result={r.outcome} className={SCREEN_SHELL_CLASS}>
        <ScreenHead title={win ? '勝ち！' : r.reward === 'surrender' ? '投了' : '負け…'} accent={win ? 'text-amber-200' : 'text-slate-300'} onBack={back}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {/* 立ち絵と吹き出し(助手と対戦の結果と同じ形)。台詞は CARD_PVP_RESULT_LINES(相手が抜けたときは left) */}
          {a && line && (
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <CardAssistantArt src={assistantFullImage(a, line.face)} alt={a.name} className="h-[220px] w-[46%]"/>
              <div data-card-pvp-line={scene} className="mb-2 min-w-0 flex-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: a.accent, ...JA_WRAP_STYLE }}>{cardPvpLineNode(line.text)}</div>
            </div>
          )}
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[14px] font-black text-white" style={JA_WRAP_STYLE}>{jaWrap(`${foeName}さんとのマルチ対戦`)}</div>
            <div className="text-[12px] font-bold text-slate-300">{win ? '勝ち' : r.reward === 'surrender' ? '投了' : '負け'}{r.reason && !['勝ち', '負け', '投了'].includes(r.reason) ? `(${r.reason})` : ''}</div>
            <p data-card-pvp-verify={r.verify} className={`mt-1 rounded-xl px-2 py-1.5 text-[12px] font-bold ${r.verify === 'ok' ? 'bg-emerald-500/15 text-emerald-100' : r.verify === 'ng' ? 'bg-rose-500/15 text-rose-100' : 'bg-white/5 text-slate-200'}`} style={JA_WRAP_STYLE}>{cardPvpPhrases(verifyText)}</p>
          </div>
          <div className={SCREEN_PANEL_CLASS}>
            {!got && r.verify !== 'ng' && <div className="text-[12px] font-bold text-slate-300">ごほうびを確かめています…</div>}
            {r.verify === 'ng' && <div className="text-[12px] font-bold text-slate-300">無効の試合なので、カードポイントとクイック周回は入りません</div>}
            {got && (<>
              <div data-card-pvp-reward className="text-[13px] font-black text-amber-200">もらったカードポイント: {got.point}</div>
              {got.short && <div className="mt-1 text-[12px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('自分の番を3回やる前に終わったので、カードポイントとクイック周回は入りません')}</div>}
              {!got.short && got.loops > 0 && (
                <div data-card-quick-loops={got.quick ? got.loops : 0} className="mt-2 rounded-xl border border-sky-300/40 bg-sky-500/10 px-2 py-1.5">
                  {got.quick
                    ? <>
                      <div className="text-[13px] font-black text-sky-200">クイック周回 {got.loops}周ぶん</div>
                      <div className="mt-0.5 text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>裏のクイック周回({(got.quick.quickDifficulty && quickDifficultySetting(got.quick.quickDifficulty)?.label) || 'AUTO設定'})が{got.loops}周ぶん進みました</div>
                    </>
                    : <div className="text-[12px] font-bold text-slate-300" style={JA_LABEL_STYLE}>{jaWrap('クイック周回をしていないときは入りません')}</div>}
                </div>
              )}
              {point !== null && <div className="mt-1 text-[12px] font-bold text-slate-300">いまのカードポイント: {point}</div>}
              {got.saved === false && <div className="mt-1 text-[12px] font-bold text-rose-300" style={JA_LABEL_STYLE}>{jaWrap('保存できませんでした(カードポイントは増えていません)')}</div>}
            </>)}
          </div>
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" data-card-pvp-leave className={`${btn} mh-button-primary`} onClick={() => { Audio_.fgSe.tap(); CARD_PVP.leave(); }}>部屋を出る</button>
        </div>
      </div>
    );
  }
  return (
    <div data-mh-screen data-card-pvp={room.phase} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="マルチ対戦" accent="text-sky-200" onBack={back} note={cardPvpOpen() ? 'ほかのブリーダーと1対1で戦えます' : 'ほかのブリーダーと1対1で戦えます(デバッグ専用・つくっている途中)'}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-3 pb-4`}>
        {room.phase === 'idle' && (<>
          {penaltyMin > 0 && <p data-card-pvp-penalty className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-2 text-[13px] font-bold text-rose-100">試合の途中で抜けたので、あと{penaltyMin}分は部屋に入れません</p>}
          {penaltyMin === 0 && !ready && <p className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-[13px] font-bold text-amber-100">{deckIssues.join('・') || 'デッキがありません'}</p>}
          <button type="button" data-card-pvp-free disabled={!ready} className={`${btn} mh-button-primary`} onClick={() => { Audio_.fgSe.tap(); void CARD_PVP.free(profile, deck); }}>だれとでも</button>
          <button type="button" data-card-pvp-create disabled={!ready} className={`${btn} border border-sky-300/40 bg-slate-900 text-sky-100`} onClick={() => { Audio_.fgSe.tap(); void CARD_PVP.create(profile, deck); }}>合言葉で部屋を作る</button>
          {invites.length > 0 && (
            <div data-card-pvp-invites className="space-y-2 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-3">
              {invites.slice(0, 3).map((x) => (
                <div key={`${x.senderId}-${x.roomCode}`} className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 text-[13px] font-bold text-emerald-50" style={JA_WRAP_STYLE}>{jaWrap(`${x.name || 'フレンド'}さんから、マルチ対戦の招待が届いています`)}</p>
                  <button type="button" data-card-pvp-accept={x.roomCode} disabled={!ready} className="mh-button mh-button-primary min-h-[44px] shrink-0 rounded-xl px-3 text-[13px] font-black disabled:opacity-40"
                    onClick={() => { Audio_.fgSe.tap(); CARD_PVP.join(x.roomCode, profile, deck); }}>参加する</button>
                </div>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-3">
            <p className="mb-2 text-[13px] font-bold text-slate-300">フレンドの合言葉で入る</p>
            <div className="flex gap-2">
              <input data-card-pvp-code value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))} maxLength={4} inputMode="text" autoCapitalize="characters" placeholder="ABCD"
                className="min-h-[48px] w-0 flex-1 rounded-xl border border-white/20 bg-black/40 px-3 text-center text-[22px] font-black tracking-[.3em] text-white"/>
              <button type="button" data-card-pvp-join disabled={!ready || !rhythmMultiNormalizeCode(code)} className="mh-button mh-button-primary min-h-[48px] rounded-xl px-4 font-black disabled:opacity-40"
                onClick={() => { Audio_.fgSe.tap(); CARD_PVP.join(code, profile, deck); }}>入る</button>
            </div>
          </div>
        </>)}
        {(room.phase === 'connecting' || room.phase === 'waiting') && room.mode === 'free' && (
          <div data-card-pvp-seek className="rounded-2xl border border-sky-300/40 bg-sky-500/10 p-4 text-center">
            <p className="text-[15px] font-black text-white">{room.foe ? `${room.foe.name}さんが見つかりました。始めます…` : '相手をさがしています…'}</p>
            {/* 自分は数えない(「1人」が自分のことか分からない。カゲあつくん) */}
            <p data-card-pvp-waiting={Math.max(0, room.lobbyCount - 1)} className="mt-1 text-[13px] font-bold text-sky-100">{room.lobbyCount > 1 ? `あなたのほかに ${room.lobbyCount - 1}人が待っています` : 'いまは、ほかに待っている人はいません'}</p>
            {!room.foe && now - room.seekAt <= CARD_PVP_LOBBY_LIMIT_MS && <p className="mt-1 text-[12px] font-bold text-slate-300 tabular-nums">あと{Math.max(0, Math.ceil((CARD_PVP_LOBBY_LIMIT_MS - (now - room.seekAt)) / 1000))}秒</p>}
            {!room.foe && now - room.seekAt > CARD_PVP_LOBBY_LIMIT_MS && (
              <div data-card-pvp-nobody className="mt-3 space-y-2">
                <p className="text-[13px] font-bold text-amber-100">いまは、だれも来ませんでした</p>
                <button type="button" data-card-pvp-seek-again className={`${btn} border border-white/15 bg-slate-900 text-slate-100`} onClick={() => { Audio_.fgSe.tap(); CARD_PVP.seekAgain(); }}>もう一度さがす</button>
                {onAssistant && <button type="button" data-card-pvp-to-assistant className={`${btn} mh-button-primary`} onClick={() => { Audio_.fgSe.tap(); CARD_PVP.leave(); onAssistant(); }}>助手と対戦へ</button>}
              </div>
            )}
          </div>
        )}
        {(room.phase === 'connecting' || room.phase === 'waiting') && room.mode !== 'free' && (
          <div className="rounded-2xl border border-sky-300/40 bg-sky-500/10 p-4 text-center">
            <p className="text-[13px] font-bold text-sky-100">合言葉</p>
            <p data-card-pvp-room className="my-1 text-[40px] font-black tracking-[.3em] text-white">{room.code}</p>
            <p className="text-[13px] font-bold text-slate-200">{room.phase === 'connecting' ? 'つないでいます…' : room.foe ? `${room.foe.name}さんが来ました。始めます…` : 'この合言葉をフレンドに伝えて、待っています…'}</p>
            {/* フレンドから招待(区切り4): 承認済みのフレンドの名簿から選ぶ。フレンドがいない・表が無いときは出さない */}
            {room.phase === 'waiting' && !room.foe && roster && roster.length > 0 && (
              <div className="mt-3 text-left">
                <button type="button" data-card-pvp-invite className={`${btn} border border-emerald-300/40 bg-slate-900 text-emerald-100`} onClick={() => { Audio_.fgSe.tap(); setInviteOpen((v) => !v); }}>フレンドを招待する</button>
                {inviteOpen && (
                  <ul data-card-pvp-roster className="mt-2 max-h-[40vh] space-y-1 overflow-y-auto">
                    {roster.slice(0, 30).map((f) => (
                      <li key={f.otherId} className="flex items-center gap-2 rounded-xl bg-black/30 px-2 py-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{f.userName}</span>
                        <button type="button" data-card-pvp-invite-to={f.otherId} disabled={invited[f.otherId] === 'sent'} className="mh-button mh-button-primary min-h-[36px] rounded-lg px-3 text-[12px] font-black disabled:opacity-50"
                          onClick={async () => { Audio_.fgSe.tap(); const ok = await sbSendCardInvite(selfBid, f.otherId, room.code); setInvited((cur) => ({ ...cur, [f.otherId]: ok ? 'sent' : 'ng' })); }}>
                          {invited[f.otherId] === 'sent' ? '招待しました' : invited[f.otherId] === 'ng' ? '送れませんでした' : '招待する'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {room.phase === 'error' && <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-[13px] font-bold text-rose-100">{room.error}</p>}
        {room.broken && <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-3 text-[13px] font-bold text-rose-100">{room.broken}</p>}
      </div>
      {room.phase !== 'idle' && (
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" data-card-pvp-leave className={`${btn} border border-white/15 bg-slate-900 text-slate-100`} onClick={() => { Audio_.fgSe.tap(); CARD_PVP.leave(); }}>部屋を出る</button>
        </div>
      )}
    </div>
  );
};

// 検査のときだけ: 自分の番を、コンピューターの考え方で自動で打つ(window.__mhCardPvpAuto が真のときだけ。ふだんは何もしない)。
// 2台のブラウザを最後まで戦わせる検査 tools/card/card-pvp-browser-check.js が使う。対戦の画面(84)の CardBattleBoard から呼ぶ
const useCardPvpAuto = (db, pvp, st, step, paused) => useEffect(() => {
  if (!pvp || paused || typeof window === 'undefined' || !window.__mhCardPvpAuto || st.winner !== null || cardPvpDecider(st) !== 0) return undefined;
  const t = setTimeout(() => {
    const act = cardAiChooseAction(db, st, cardAiPolicy('kyuko', 'easy'));
    if (act && step(act)) return;
    step(st.pendingDiscard ? { type: 'discard', hand: [0] } : st.phase === 'setup' ? { type: 'setupGuts', hand: [] } : st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] });
  }, Number(window.__mhCardPvpAutoMs) || 150);
  return () => clearTimeout(t);
}, [st, paused]);

// ---- 持ち時間(区切り2) ----
// 自分の番60秒・守り15秒。使い切ったら、その番を終える(攻撃の番は、ガッツへ回さずにターン終了)・守らない。3回続けて使い切ったら負け。
// 相手の持ち時間が過ぎても手が来ない(電波はつながっている)ときは、CARD_PVP_STALL_GRACE_MS 待って相手の負け。
// 時計は、決める人・番・守りの回が変わったところから、それぞれの端末で数える
const useCardPvpClock = (pvp, st, step) => {
  const [now, setNow] = useState(() => Date.now());
  const keyRef = useRef('');
  const startRef = useRef(Date.now());
  const firedRef = useRef('');
  const gutsRef = useRef(-1);
  const key = pvp ? cardPvpClockKey(st) : '';
  if (key !== keyRef.current) { keyRef.current = key; startRef.current = Date.now(); }
  useEffect(() => { if (!pvp) return undefined; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const decider = pvp ? cardPvpDecider(st) : -1;
  const left = pvp ? cardPvpLimitMs(st) - (now - startRef.current) : 0;
  useEffect(() => {
    if (!pvp || st.winner !== null) return;
    if (decider === 0 && st.phase === 'guts' && !st.pending && gutsRef.current === st.turn) { gutsRef.current = -1; CARD_PVP.auto(() => step({ type: 'guts', hand: [] })); return; }
    if (decider === 0 && left <= 0 && firedRef.current !== key) {
      firedRef.current = key;
      if (CARD_PVP.timedOut() >= CARD_PVP_TIMEOUT_LOSE) { CARD_PVP.timeoutLose(); return; }
      if (st.phase === 'main' && !st.pending) gutsRef.current = st.turn;
      CARD_PVP.auto(() => step(cardPvpTimeoutAct(st)));
      return;
    }
    if (decider === 1 && left <= -CARD_PVP_STALL_GRACE_MS && CARD_PVP.alive() && firedRef.current !== key) { firedRef.current = key; CARD_PVP.foeStalled(); }
  }, [now, key]);
  const room = CARD_PVP.get();
  const quiet = pvp && room.foe ? now - room.foe.seen : 0;
  // 時計を数え直した瞬間は now が少し古く、61秒と出ていた。持ち時間を超えて出さない
  return { left: Math.max(0, Math.min(Math.ceil(left / 1000), pvp ? cardPvpLimitMs(st) / 1000 : 0)), mine: decider === 0, timeouts: room.timeouts, offline: room.offline,
    foeQuietSec: quiet > CARD_PVP_QUIET_MS ? Math.max(0, Math.ceil((CARD_PVP_ALIVE_MS - quiet) / 1000)) : 0 };
};
// 上の帯のまんなか: 持ち時間
const CardPvpStatus = ({ clock }) => (
  <>
    <span data-card-pvp-clock={clock.mine ? 'mine' : 'foe'} className={`rounded-full px-2 py-0.5 text-[13px] font-black tabular-nums ${clock.mine ? (clock.left <= 10 ? 'bg-rose-500/30 text-rose-100' : 'bg-amber-400/20 text-amber-100') : 'bg-white/10 text-slate-200'}`}>
      {clock.mine ? `残り ${clock.left}秒` : `相手 ${clock.left}秒`}{clock.mine && clock.timeouts > 0 ? `(時間切れ ${clock.timeouts}/${CARD_PVP_TIMEOUT_LOSE})` : ''}
    </span>
  </>
);
// 電波が途切れたときの知らせ。上の帯のすぐ下に1行で出し、場を少し下げる(重ねると、相手の帯や記録の文字を隠す。カゲあつくん)
const CardPvpSignal = ({ clock }) => ((clock.offline || clock.foeQuietSec > 0) ? (
  <div data-card-pvp-signal className="shrink-0 border-y border-amber-300/40 bg-amber-500/15 px-2 py-1 text-center text-[12px] font-bold text-amber-100">
    {clock.offline ? '電波が途切れています。つなぎ直しています…' : `相手の電波が途切れています(あと${clock.foeQuietSec}秒で相手の負け)`}
  </div>
) : null);
// 定型のチャット(上の帯の「投了」の横の 💬)。相手の言葉は、助手と対戦のひとことと同じ吹き出しに出る
const CardPvpChat = () => {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState('');
  useEffect(() => { if (!sent) return undefined; const t = setTimeout(() => setSent(''), 1600); return () => clearTimeout(t); }, [sent]);
  return (
    <div className="relative">
      <button type="button" data-card-pvp-chat aria-label="定型文を送る" onClick={() => { Audio_.fgSe.tap(); setOpen((v) => !v); }} className="grid h-[28px] w-[30px] place-items-center rounded-lg border border-white/20 bg-white/10 text-[14px]">💬</button>
      {sent && <span className="pointer-events-none absolute left-0 top-[32px] z-[40] whitespace-nowrap rounded-full bg-sky-500/80 px-2 py-0.5 text-[11px] font-black text-white">「{sent}」</span>}
      {open && (
        <div data-card-pvp-stamps className="absolute left-0 top-[34px] z-[40] grid w-[200px] grid-cols-2 gap-1 rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-xl">
          {CARD_PVP_STAMPS.map((t, i) => (
            <button key={t} type="button" data-card-pvp-stamp={i} className="min-h-[36px] rounded-lg bg-white/10 px-1 text-[12px] font-bold text-white active:scale-[.97]"
              onClick={() => { if (CARD_PVP.chat(i)) setSent(t); setOpen(false); }}>{t}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ---- ランキングの「マルチ」の札(90-card-rank.jsx の CardRankingBoard から出す) ----
// 勝つと上がる強さの点数(はじめ1500)の順。表がまだ無いときは「準備中」のまま
const CardPvpRankingList = ({ renderBreederIcon = null, selfId = '' }) => {
  const [state, setState] = useState({ status: 'loading', entries: [] });
  useEffect(() => {
    let alive = true;
    sbFetchCardPvpRatings().then((entries) => { if (alive) setState(entries == null ? { status: 'missing', entries: [] } : { status: 'ready', entries }); })
      .catch(() => { if (alive) setState({ status: 'error', entries: [] }); });
    return () => { alive = false; };
  }, []);
  if (state.status === 'loading') return <p className="py-4 text-center text-[13px] font-bold text-slate-400">読み込み中…</p>;
  if (state.status === 'missing') return <p data-card-pvp-rank="missing" className="py-3 text-center text-[12px] font-bold text-slate-400">強さの点数の表は、まだ準備中です</p>;
  if (state.status === 'error') return <p className="py-3 text-center text-[12px] font-bold text-rose-200">読み込めませんでした</p>;
  if (!state.entries.length) return <p data-card-pvp-rank="empty" className="py-3 text-center text-[12px] font-bold text-slate-400">まだ記録がありません</p>;
  return (
    <ol data-card-pvp-rank="ready" className="mt-2 space-y-1 text-left">
      {state.entries.map((e, i) => (
        <li key={e.breederId} className={`flex items-center gap-2 rounded-xl px-2 py-1.5 ${e.breederId === selfId ? 'bg-amber-500/15' : 'bg-black/25'}`}>
          <b className="w-7 text-right text-[13px] font-black text-amber-200">{i + 1}</b>
          {renderBreederIcon ? renderBreederIcon({ userName: e.userName, icon: e.icon, profileFrame: e.profileFrame, breederId: e.breederId }) : <span aria-hidden="true">{cardIconNode(e.icon || '🙂', 22)}</span>}
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{e.userName || 'ブリーダー'}</span>
          <span className="text-[11px] font-bold text-slate-300">{e.wins}勝{e.loses}敗</span>
          <b className="w-12 text-right text-[15px] font-black text-sky-200">{e.rating}</b>
        </li>
      ))}
    </ol>
  );
};
