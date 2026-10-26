// ===== MFバトルカード: 過去の対戦を見る(リプレイ) =====
// 2026-10-27 社長「あとは過去の対戦をみれるとか」→ マルチの3つの新機能を同時に作る(台帳)。担当はカード部ミカエシくん
// 案: docs/progress/card-multi-plus/README.md の「2. リプレイ」
//
// 作り
//   ・ルールの本体(82)が乱数を使うのは山札を切る所だけ。だから「種・両方のデッキ・先攻・手の一覧」があれば、はじめから同じ試合を作り直せる
//   ・マルチは、試合のあとに両方の封が開いて、なぞり直し(91 の cardPvpVerify)が通った試合だけを取っておく(材料は全部そろっている)
//   ・終わったあとなので、両方の手札を見せる(社長「過去の対戦では、終わったあとは相手の手札も見られる」)
//   ・ルールを直したあとに昔の試合をなぞり直すと、途中で合わなくなることがある。記録には、ルールの版と「1手ごとの場の短い指紋」を一緒に書き、
//     なぞり直して手が当たらない・指紋が合わなくなったら、そこで止めて「ここまでしか見られません」と出す(勝手に別の試合にしない)
//
// 保存: 新しいキー mh_card_replays_v1(端末の中だけ)。新しい50試合まで・お気に入りは10まで(消さない)・合わせて約750KBまで
//   (2026-10-27 社長「過去の対戦は記録にも残してそこからみれるようにはできないの？」→ 10試合・お気に入り3 から増やした。記録の画面の「過去の対戦」)

const CARD_REPLAY_KEY = 'mh_card_replays_v1';
// ルールの版。82 のルール(cardApplyAction の結果)を変えたら上げる。上げ忘れても、指紋が合わなくなった所で止まる
const CARD_REPLAY_RULES = 2;
// 上げ方(2026-10-27 カード部で決めた): ルールの結果が変わる PR は、マージ直前に main の値を見て、自分の値が main 以下なら main+1 にする
//   (同じ値に上げた PR どうしは取り込みでぶつからないので、ぶつかるのを待たない)。助手の打ち方だけの変更は上げない
//   1 → 2: 混血は攻撃・特殊=メイン、防御・回避=サブだけ(#3865)・集中(274)を「そのとき払うガッツ」で数える(#3869)
const CARD_REPLAY_MAX = 50;               // 取っておく試合の数(お気に入りを含む)
const CARD_REPLAY_FAV_MAX = 10;           // お気に入りの数
const CARD_REPLAY_BYTES_MAX = 750000;     // 合わせた大きさの上限(文字数)。超えたら古い試合(お気に入りでない物)から消す
const CARD_REPLAY_ACTS_MAX = 2000;        // 1試合の手の数の上限(壊れた記録で固まらないように)
const CARD_REPLAY_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

// ---- 純粋な計算(画面と保存を使わない。tools/card/card-replay-check.js が node で確かめる) ----

// 場の短い指紋。番・段・勝ち負けと、両方の手札・山札・捨て札・ガッツの枚数・モンスターのライフだけを見る(ログの言葉は見ない)
const cardReplayPrint = (st) => {
  if (!st || !Array.isArray(st.players)) return '';
  const parts = [st.turn, st.active, st.phase, st.winner === null ? '-' : st.winner, st.pending ? 'g' : '', st.pendingDiscard ? 'd' : '', st.pendingChoice ? 'c' : ''];
  st.players.forEach((p) => {
    parts.push(p.hand.join('.'), p.deck.length, p.discard.length, p.guts.length, p.mons.map((m) => `${m.life}${m.ko ? 'x' : ''}`).join('.'));
  });
  // FNV-1a(32ビット)を36進の4文字に。ぶつかることはあるが、ずれは数手のうちに必ず出る
  let h = 0x811c9dc5;
  const text = parts.join('|');
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h >>> 0).toString(36).padStart(4, '0').slice(-4);
};

const cardReplayDeckOf = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const mons = Array.isArray(raw.monsters) ? raw.monsters.filter((v) => typeof v === 'string' && /^[0-9A-Z-]{1,10}$/.test(v)) : [];
  const cards = Array.isArray(raw.cards) ? raw.cards.filter((v) => typeof v === 'string' && /^[0-9A-Z-]{1,10}$/.test(v)) : [];
  if (mons.length !== 3 || mons.length !== raw.monsters.length || cards.length !== raw.cards.length || cards.length < 1 || cards.length > 60) return null;
  return { monsters: mons, cards };
};
const cardReplayText = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');

// 1試合の記録を作り直す(知らない項目は捨てる・型が違えば null)
//   { v:1, id, kind:'pvp'|'cpu', at, rules, first, names:[自分, 相手], foe:{ name, icon, frame, deckName, who }, outcome, reason,
//     decks:[自分, 相手], seeds:[自分, 相手], acts:[[by, act], …], prints:'4文字ずつ', fav }
const cardReplayNormalizeOne = (raw) => {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (typeof raw.id !== 'string' || !CARD_REPLAY_ID_RE.test(raw.id)) return null;
  if (raw.kind !== 'pvp' && raw.kind !== 'cpu') return null;
  const decks = Array.isArray(raw.decks) && raw.decks.length === 2 ? raw.decks.map(cardReplayDeckOf) : null;
  if (!decks || decks.includes(null)) return null;
  const seeds = Array.isArray(raw.seeds) && raw.seeds.length === 2 && raw.seeds.every((n) => Number.isInteger(n) && n >= 0 && n <= 0xFFFFFFFF) ? raw.seeds.slice() : null;
  if (!seeds) return null;
  if (raw.first !== 0 && raw.first !== 1) return null;
  if (!Array.isArray(raw.acts) || raw.acts.length > CARD_REPLAY_ACTS_MAX) return null;
  const acts = [];
  for (const a of raw.acts) {
    if (!Array.isArray(a) || (a[0] !== 0 && a[0] !== 1)) return null;
    const act = typeof cardPvpCleanAct === 'function' ? cardPvpCleanAct(a[1]) : (a[1] && typeof a[1] === 'object' ? a[1] : null);
    if (!act) return null;
    acts.push([a[0], act]);
  }
  const foe = raw.foe && typeof raw.foe === 'object' ? raw.foe : {};
  const outcomes = ['win', 'lose', 'surrender', 'foeSurrender', 'timeout', 'foeTimeout', 'foeLeft', 'left', 'draw'];
  return {
    v: 1, id: raw.id, kind: raw.kind,
    at: Number.isFinite(raw.at) && raw.at > 0 ? raw.at : 0,
    rules: Number.isInteger(raw.rules) && raw.rules > 0 ? raw.rules : 0,
    first: raw.first,
    names: [cardReplayText(Array.isArray(raw.names) ? raw.names[0] : '', 16) || 'あなた', cardReplayText(Array.isArray(raw.names) ? raw.names[1] : '', 16) || 'あいて'],
    foe: { name: cardReplayText(foe.name, 16) || 'あいて', icon: cardReplayText(foe.icon, 64), frame: typeof foe.frame === 'string' ? foe.frame.slice(0, 40) : null,
      deckName: typeof foe.deckName === 'string' ? (foe.deckName.slice(0, 30) || null) : null, who: typeof foe.who === 'string' ? foe.who.slice(0, 20) : null },
    outcome: outcomes.includes(raw.outcome) ? raw.outcome : null,
    reason: cardReplayText(raw.reason, 40),
    decks, seeds, acts,
    prints: typeof raw.prints === 'string' && /^[0-9a-z]*$/.test(raw.prints) && raw.prints.length === acts.length * 4 ? raw.prints : '',
    fav: raw.fav === true,
    // 最後の番(一覧の「◯番まで」。2026-10-27 に足した項目。前の記録には無いので null)
    turn: Number.isInteger(raw.turn) && raw.turn >= 0 && raw.turn < 10000 ? raw.turn : null,
  };
};
// 保存の全体 { v:1, list:[記録…](新しい順) }。壊れていたら空・壊れた1件は捨てる・同じ id は前の1件だけ
const cardReplayNormalize = (raw) => {
  const out = { v: 1, list: [] };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.list)) return out;
  const seen = new Set();
  for (const r of raw.list) {
    const one = cardReplayNormalizeOne(r);
    if (!one || seen.has(one.id)) continue;
    seen.add(one.id);
    out.list.push(one);
  }
  out.list.sort((a, b) => b.at - a.at);
  let favs = 0;
  out.list.forEach((r) => { if (r.fav) { favs += 1; if (favs > CARD_REPLAY_FAV_MAX) r.fav = false; } });
  return out;
};
// 新しい記録を足す(同じ id があれば足さない)。数・大きさを超えたら、お気に入りでない古い物から消す
const cardReplayAdd = (saved, rec) => {
  const box = cardReplayNormalize(saved);
  const one = cardReplayNormalizeOne(rec);
  if (!one || box.list.some((r) => r.id === one.id)) return box;
  box.list.unshift({ ...one, fav: false });
  box.list.sort((a, b) => b.at - a.at);
  const size = () => JSON.stringify(box).length;
  while (box.list.length > CARD_REPLAY_MAX || (box.list.length > 1 && size() > CARD_REPLAY_BYTES_MAX)) {
    let drop = -1;
    for (let i = box.list.length - 1; i >= 0; i--) { if (!box.list[i].fav && box.list[i].id !== one.id) { drop = i; break; } }
    if (drop < 0) break;
    box.list.splice(drop, 1);
  }
  return box;
};
// お気に入りの付け外し。3つを超えるときは付けない(ok:false)
const cardReplaySetFav = (saved, id, on) => {
  const box = cardReplayNormalize(saved);
  const r = box.list.find((x) => x.id === id);
  if (!r) return { box, ok: false };
  if (on && !r.fav && box.list.filter((x) => x.fav).length >= CARD_REPLAY_FAV_MAX) return { box, ok: false };
  r.fav = !!on;
  return { box, ok: true };
};

// はじめの場(自分 = 0 の見え方で、両方の山札が本物)
const cardReplayStart = (db, rec) => {
  const names = [rec.names[0], rec.foe.name || rec.names[1]];
  if (rec.kind === 'pvp') {
    const st = cardCreateGame(db, { decks: [rec.decks[0], rec.decks[1]], names, seed: rec.seeds[0] >>> 0, first: rec.first });
    const theirs = cardCreateGame(db, { decks: [rec.decks[1], rec.decks[0]], seed: rec.seeds[1] >>> 0, first: 1 - rec.first });
    st.players[1] = { ...theirs.players[0], name: st.players[1].name };
    return st;
  }
  return cardCreateGame(db, { decks: [rec.decks[0], rec.decks[1]], names, seed: rec.seeds[0] >>> 0, first: rec.first });
};
// なぞり直して、1手ごとの場を全部作る。返り値 { states:[はじめ, 1手目のあと, …], stop: 止まった手の番号(全部見られるなら null) }
const cardReplayBuild = (db, rec) => {
  const states = [];
  let st;
  try { st = cardReplayStart(db, rec); } catch (_) { return { states, stop: 0 }; }
  states.push(st);
  for (let n = 0; n < rec.acts.length; n++) {
    const [by, act] = rec.acts[n];
    let next = null;
    // 番でない人の手は当てない(91 の cardPvpVerify と同じ確かめ)
    try { next = cardPvpDecider(st) === by ? cardApplyAction(db, st, act) : null; } catch (_) { next = null; }
    if (!next) return { states, stop: n };
    if (rec.prints && rec.prints.slice(n * 4, n * 4 + 4) !== cardReplayPrint(next)) return { states, stop: n };
    states.push(next);
    st = next;
  }
  return { states, stop: null };
};
// 1手ずつの場から「番」の区切りを作る(番の始まりの手の番号の一覧)。番ごとに進む・戻るに使う
const cardReplayTurnStarts = (states) => {
  const out = [0];
  for (let i = 1; i < states.length; i++) {
    if (states[i].turn !== states[i - 1].turn || states[i].active !== states[i - 1].active) out.push(i);
  }
  return out;
};
// いまの場の一言(その手で足されたログ)。無ければ、番の名前
const cardReplayCaption = (states, i) => {
  const st = states[i];
  if (!st || !st.log.length) return '';
  const prev = states[i - 1];
  let lines;
  if (!prev) lines = st.log.slice(-1);
  else if (st.log.length > prev.log.length) lines = st.log.slice(prev.log.length);
  else {
    // ログが上限で古い方から消えているときは、前の場の最後の行より後ろを取る
    const tail = prev.log[prev.log.length - 1];
    let k = -1;
    if (tail) for (let j = st.log.length - 1; j >= 0; j--) { if (st.log[j].text === tail.text && st.log[j].turn === tail.turn) { k = j; break; } }
    lines = k >= 0 ? st.log.slice(k + 1) : st.log.slice(-1);
  }
  return lines.filter((l) => l.kind !== 'turn').map((l) => l.text).filter(Boolean).slice(-2).join(' / ');
};

// 記録を作る。指紋は、いまのルールでなぞり直して作る(途中で当たらなければ、記録しない)
// history … [{ by, act(自分の見え方) }]。seeds … マルチは [自分, 相手]、助手と対戦は [種, 0]
const cardReplayMake = (db, { kind, match, at, decks, seeds, first, history, foe, outcome, reason }) => {
  const rec = {
    v: 1, id: String(match || ''), kind, at: at || Date.now(), rules: CARD_REPLAY_RULES, first,
    names: ['あなた', (foe && foe.name) || 'あいて'],
    foe: { name: (foe && foe.name) || 'あいて', icon: (foe && foe.icon) || '', frame: (foe && foe.frame) || null, deckName: (foe && foe.deckName) || null, who: (foe && foe.who) || null },
    outcome, reason: reason || '',
    decks: decks.map((d) => ({ monsters: d.monsters.slice(), cards: d.cards.slice() })),
    seeds: seeds.map((n) => n >>> 0),
    acts: (history || []).map((e) => [e.by, e.act]),
    prints: '', fav: false,
  };
  const one = cardReplayNormalizeOne(rec);
  if (!one) return null;
  const built = cardReplayBuild(db, one);
  if (built.stop !== null) return null;
  one.prints = built.states.slice(1).map(cardReplayPrint).join('');
  one.turn = built.states[built.states.length - 1].turn;
  return one;
};
// マルチの試合から(91 の tryVerify で、なぞり直しが通ったときだけ)
const cardReplayFromPvp = (db, { match, at, myDeck, mySeed, foeDeck, foeSeed, first, history, foe, outcome, reason }) => cardReplayMake(db, {
  kind: 'pvp', match, at, decks: [myDeck, foeDeck], seeds: [mySeed, foeSeed], first, history, foe, outcome, reason });
// 助手と対戦から(84 の CardBattleScreen で、結果を書いたあと)。foe.who … 助手の id
const cardReplayFromCpu = (db, { id, at, myDeck, cpuDeck, seed, first, history, foe, outcome, reason }) => cardReplayMake(db, {
  kind: 'cpu', match: id, at, decks: [myDeck, cpuDeck], seeds: [seed, 0], first, history, foe, outcome, reason });

// ---- 保存(端末の中だけ) ----
// 取ってある試合の番号の控え(履歴の画面の行ごとに、すぐ答えるため)。読み込み・書き込みのたびに作り直す
let _cardReplayIds = new Set();
const cardReplayNoteIds = (box) => { _cardReplayIds = new Set(box.list.map((r) => r.id)); return box; };
const cardReplayLoad = async () => cardReplayNoteIds(cardReplayNormalize(await storeGet(CARD_REPLAY_KEY, null)));
// 書く。localStorage へは直に書き、いっぱいでも、ゲーム全体の「保存できない」の数に入れない(ほかのセーブの見張りを巻き込まない)
const CARD_REPLAY_PROBE_KEY = '__mh_card_replay_probe__'; // mh_ で始めない(バックアップに混ぜない)
const CARD_REPLAY_ROOM = 131072;                          // 書いたあとに残す空き(ほかのセーブが書けるように)
const cardReplayWrite = async (box) => {
  if (typeof isStorageWriteBlocked === 'function' && isStorageWriteBlocked()) return true; // はじめてのプレビュー中は書かない(storeSet と同じ)
  if (typeof hasWinStorage === 'function' && hasWinStorage()) return storeSet(CARD_REPLAY_KEY, box);
  try { window.localStorage.setItem(CARD_REPLAY_KEY, JSON.stringify(box)); return true; } catch (_) { return false; }
};
// 書いたあとも空きが残っているか(試しに書いてすぐ消す)
const cardReplayRoomLeft = () => {
  if (typeof hasWinStorage === 'function' && hasWinStorage()) return true;
  try { window.localStorage.setItem(CARD_REPLAY_PROBE_KEY, 'x'.repeat(CARD_REPLAY_ROOM)); return true; } catch (_) { return false; } finally { try { window.localStorage.removeItem(CARD_REPLAY_PROBE_KEY); } catch (_) { /* 消せなくても続ける */ } }
};
// いっぱいのときは、古い試合(お気に入りでない物)から消して書き直す。それでも入らなければ、この試合はあきらめる(ゲームは止めない)
const cardReplayStore = async (box, keepId = null) => {
  const b = { v: 1, list: box.list.slice() };
  for (let n = 0; n <= CARD_REPLAY_MAX + 1; n++) {
    const ok = await cardReplayWrite(b);
    if (ok && cardReplayRoomLeft()) return b;
    let drop = -1;
    for (let i = b.list.length - 1; i >= 0; i--) { if (!b.list[i].fav && b.list[i].id !== keepId) { drop = i; break; } }
    if (drop < 0) {
      // 消せる古い試合が無い: 新しい試合を外して、もう一度だけ書く
      const rest = keepId ? b.list.filter((r) => r.id !== keepId) : b.list;
      if (rest.length === b.list.length) return ok ? b : null;
      const back = { v: 1, list: rest };
      return (await cardReplayWrite(back)) ? back : null;
    }
    b.list.splice(drop, 1);
  }
  return null;
};
// 書く直前に読み直して足す(同じ端末でゲームを2つ開いていても、片方の記録を消さない)
const cardReplaySave = async (rec) => {
  if (!rec) return false;
  try {
    const box = cardReplayAdd(await storeGet(CARD_REPLAY_KEY, null), rec);
    if (!box.list.some((r) => r.id === rec.id)) return false;
    const done = await cardReplayStore(box, rec.id);
    if (!done) return false;
    cardReplayNoteIds(done);
    return done.list.some((r) => r.id === rec.id);
  } catch (_) { return false; }
};
const cardReplayFav = async (id, on) => {
  try {
    const { box, ok } = cardReplaySetFav(await storeGet(CARD_REPLAY_KEY, null), id, on);
    if (!ok) return false;
    const done = await cardReplayStore(box);
    if (done) cardReplayNoteIds(done);
    return !!done;
  } catch (_) { return false; }
};
// 履歴の画面から「この試合を見られるか」をすぐ引く(試合の番号。控えは読み込みのときに作る)
const cardReplayHas = (id) => typeof id === 'string' && _cardReplayIds.has(id);
const cardReplayGet = async (id) => { try { return (await cardReplayLoad()).list.find((r) => r.id === id) || null; } catch (_) { return null; } };
// 起動したときに1回、控えを作る(読めなくても遊びは止めない)
if (typeof window !== 'undefined') { try { void cardReplayLoad().catch(() => {}); } catch (_) { /* 読めなければ空のまま */ } }

// 対戦の盤面(84 の CardBattleBoard)へ渡す形。replay … { states, stop, rec }
const cardReplayGameOf = (db, rec) => {
  if (!rec) return null;
  const built = cardReplayBuild(db, rec);
  if (!built.states.length) return null;
  return {
    key: `replay-${rec.id}-${Date.now()}`, st: built.states[0], who: rec.kind === 'cpu' && rec.foe.who ? rec.foe.who : 'pvp', level: 'normal',
    replay: { id: rec.id, kind: rec.kind, states: built.states, stop: built.stop, total: rec.acts.length, turns: cardReplayTurnStarts(built.states),
      foe: { name: rec.foe.name, icon: rec.foe.icon || '🙂', frame: rec.foe.frame, deckName: rec.foe.deckName } },
  };
};

// ---- 再生の帯(84 の盤面のいちばん下に出す) ----
// at … いまの手の番号(0 = はじめ)。onSeek(n) で場を差し替える
const CARD_REPLAY_SPEEDS = Object.freeze([{ id: 1, label: '×1', ms: 1400 }, { id: 2, label: '×2', ms: 650 }]);
// とじるのは上の帯の「とじる」だけ(2つ並んでいた。2026-10-27 言葉の見直し7)
const CardReplayBar = ({ replay, at, onSeek }) => {
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = replay.states.length - 1;
  const turns = replay.turns;
  const turnIdx = (() => { let k = 0; turns.forEach((t, j) => { if (t <= at) k = j; }); return k; })();
  useEffect(() => {
    if (!auto) return undefined;
    if (at >= last) { setAuto(false); return undefined; }
    const sp = CARD_REPLAY_SPEEDS.find((x) => x.id === speed) || CARD_REPLAY_SPEEDS[0];
    const t = setTimeout(() => onSeek(at + 1), sp.ms);
    return () => clearTimeout(t);
  }, [auto, at, speed]);
  const st = replay.states[at];
  const caption = cardReplayCaption(replay.states, at);
  const btn = 'mh-button mh-button-secondary min-h-[40px] flex-1 rounded-lg border border-white/20 bg-slate-800 px-1 text-[12px] font-black text-white disabled:opacity-40';
  const go = (n) => { Audio_.fgSe.tap(); onSeek(Math.max(0, Math.min(last, n))); };
  return (
    <div data-card-replay-bar className="pointer-events-auto w-full rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 shadow-lg">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-sky-100">
        <span data-card-replay-turn>{st && st.turn >= 1 ? `${st.turn}番目の番・${st.active === 0 ? 'あなた' : replay.foe.name}` : 'はじまり'}</span>
        <span data-card-replay-step className="text-slate-300">{at}/{replay.total}手</span>
      </div>
      <div data-card-replay-caption className="mt-0.5 min-h-[16px] break-words text-[11px] font-bold leading-snug text-white">{caption || ' '}</div>
      {replay.stop !== null && at >= last && (
        <div data-card-replay-stop className="mt-0.5 text-[11px] font-black text-amber-300">ルールが変わる前の試合なので、ここまでしか見られません</div>
      )}
      <div className="mt-1 flex gap-1">
        <button type="button" data-card-replay-first className={btn} disabled={at <= 0} onClick={() => { setAuto(false); go(0); }}>⏮</button>
        <button type="button" data-card-replay-prev-turn className={btn} disabled={at <= 0} onClick={() => { setAuto(false); go(turns[at > turns[turnIdx] ? turnIdx : Math.max(0, turnIdx - 1)]); }}>番◀</button>
        <button type="button" data-card-replay-prev className={btn} disabled={at <= 0} onClick={() => { setAuto(false); go(at - 1); }}>◀</button>
        <button type="button" data-card-replay-auto className={`${btn} ${auto ? '!bg-sky-600' : ''}`} disabled={at >= last && !auto} onClick={() => { Audio_.fgSe.tap(); setAuto((v) => !v); }}>{auto ? '⏸' : '▶▶'}</button>
        <button type="button" data-card-replay-next className={btn} disabled={at >= last} onClick={() => { setAuto(false); go(at + 1); }}>▶</button>
        <button type="button" data-card-replay-next-turn className={btn} disabled={at >= last} onClick={() => { setAuto(false); go(turnIdx + 1 < turns.length ? turns[turnIdx + 1] : last); }}>▶番</button>
        <button type="button" data-card-replay-speed className={btn} onClick={() => { Audio_.fgSe.tap(); setSpeed((v) => (v === 1 ? 2 : 1)); }}>{(CARD_REPLAY_SPEEDS.find((x) => x.id === speed) || CARD_REPLAY_SPEEDS[0]).label}</button>
      </div>
    </div>
  );
};

// ---- 過去の対戦の一覧(記録の画面の「過去の対戦」。2026-10-27 社長) ----
// 一覧は見出し(日時・相手・種類・勝ち負け・何番まで)だけを出し、なぞり直しは押して開いたときだけ(50試合でも重くしない)
const CARD_REPLAY_OUTCOME = Object.freeze({ win: '勝ち', lose: '負け', surrender: '投了', foeSurrender: '勝ち', timeout: '負け', foeTimeout: '勝ち', foeLeft: '勝ち', left: '負け', draw: '引き分け' });
const cardReplayWhen = (at) => {
  if (!Number.isFinite(at) || at <= 0) return '';
  const d = new Date(at + 9 * 3600 * 1000); // JST
  const p2 = (n) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
};
const CardReplayList = ({ onOpen, onBack }) => {
  const [box, setBox] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => { let live = true; void cardReplayLoad().then((b) => { if (live) setBox(b); }).catch(() => { if (live) setBox({ v: 1, list: [] }); }); return () => { live = false; }; }, []);
  const favs = box ? box.list.filter((r) => r.fav).length : 0;
  const toggleFav = async (r) => {
    Audio_.fgSe.tap();
    if (!r.fav && favs >= CARD_REPLAY_FAV_MAX) { setNote(`★は${CARD_REPLAY_FAV_MAX}試合までです。ほかの★を外してから付けてください`); return; }
    const ok = await cardReplayFav(r.id, !r.fav);
    if (!ok) { setNote('★を保存できませんでした'); return; }
    setNote('');
    setBox(await cardReplayLoad());
  };
  const assistants = typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : [];
  return (
    <div data-mh-screen data-card-replay-list className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="過去の対戦" accent="text-sky-200" onBack={onBack} note={`新しい${CARD_REPLAY_MAX}試合まで残ります。★を付けた試合は消えません(${CARD_REPLAY_FAV_MAX}試合まで)`}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-1.5 pb-4`}>
        {note && <p data-card-replay-note className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-2 py-1.5 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{note}</p>}
        {!box && <div className="py-6 text-center text-[13px] font-bold text-slate-400">読み込み中…</div>}
        {box && !box.list.length && <div data-card-replay-empty className="py-6 text-center text-[13px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('まだありません。助手と対戦かマルチ対戦を遊ぶと、ここに残ります')}</div>}
        {box && box.list.map((r) => {
          const a = r.kind === 'cpu' && r.foe.who ? assistants.find((x) => x.id === r.foe.who) : null;
          const res = CARD_REPLAY_OUTCOME[r.outcome] || '';
          const win = res === '勝ち';
          return (
            <div key={r.id} data-card-replay-row={r.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-2 py-1.5">
              <button type="button" data-card-replay-open={r.id} onClick={() => { Audio_.fgSe.tap(); onOpen(r.id); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <span className="block h-[38px] w-[38px] shrink-0 overflow-hidden rounded-xl bg-black/40">
                  {a ? <img src={assistantFaceImage(a, 'normal')} alt="" className="h-full w-full object-cover object-top"/>
                    : typeof CardPvpAvatar === 'function' ? <CardPvpAvatar icon={r.foe.icon || '🙂'} frame={r.foe.frame} className="h-full w-full"/> : <span className="text-[20px]">🙂</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <b className="truncate text-[13px] font-black text-white">{r.foe.name}</b>
                    <small className={`shrink-0 rounded-md px-1 text-[10px] font-black ${r.kind === 'pvp' ? 'bg-sky-500/25 text-sky-100' : 'bg-amber-500/20 text-amber-100'}`}>{r.kind === 'pvp' ? 'マルチ' : '助手と対戦'}</small>
                  </span>
                  <span className="block text-[11px] font-bold text-slate-400">{cardReplayWhen(r.at)}{r.turn !== null ? `・${r.turn}番まで` : `・${r.acts.length}手`}</span>
                </span>
                <span data-card-replay-result={r.outcome || ''} className={`shrink-0 text-[13px] font-black ${win ? 'text-amber-200' : 'text-slate-300'}`}>{res}</span>
              </button>
              <button type="button" data-card-replay-fav={r.id} aria-pressed={r.fav} aria-label={r.fav ? '★を外す' : '★を付ける'} onClick={() => { void toggleFav(r); }}
                className={`min-h-[40px] min-w-[40px] shrink-0 rounded-lg text-[20px] ${r.fav ? 'text-amber-300' : 'text-slate-600'}`}>★</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
