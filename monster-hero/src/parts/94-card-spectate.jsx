// ===== MFバトルカード: マルチ対戦の観戦 =====
// 2026-10-27 社長「ほかにはマルチの観戦機能とか」→ 観戦は「全部だれでも見られる」・見る人に手札は届かない(台帳)。担当はカード部ナガメくん。
// 案: docs/progress/card-multi-plus/README.md の「3. 観戦」(ツナグくん)
//
// 作り
//   ・対戦の部屋(realtime:mhc-room-<合言葉>)とは別の通り道 realtime:mhc-watch-<試合の番号> を使う。見る人は合言葉を知らないので、対戦の部屋へ手を送り込めない
//   ・流すのは対戦の「ホスト」(91 の isHost)だけ。ホストの見え方は、そのまま観戦の見え方(ホスト=0・相手=1)。相手は何も増えない(古い版でもよい)
//   ・流す物は「みんなに見えている物」だけ: 手(使った札の番号=reveal)・捨て札の並び。手札・山札・ガッツの中身・封(山札の切り方)は流さない
//     ホストの端末の場(st)そのものは送らない(場の記録の文に、引いた札の名前などが入ることがあるため)
//   ・見る人の端末では、両方の手札と山札を「仮の札」(CARD_PVP_HIDDEN)にした場を作り、届いた手を最初から当ててなぞる。だから手札は仕組みの上で届かない
//   ・途中から見る人は、はじめからの手をまとめてもらってなぞり、いまの場面から見始める
//   ・いま対戦している試合の一覧は、ホストが10秒おきに realtime:mhc-live へ知らせる(表は要らない)
//   ・見る人は4秒おきに「見ています」を送る。ホストは数えて、2人の画面に「👀 3」と出す(相手へは部屋の hb の w で渡す)。見る人からは、ほかに何も送れない
//   ・保存は何もしない

const CARD_WATCH_TOPIC = 'realtime:mhc-watch-';
const CARD_WATCH_LIVE_TOPIC = 'realtime:mhc-live';
const CARD_WATCH_MAX = 30;                // 1試合を見られる人数の上限(対戦の2人を重くしない)
const CARD_WATCH_EYE_MS = 4000;           // 見る人が「見ています」を送る間
const CARD_WATCH_EYE_FRESH_MS = 12000;    // これより古い「見ています」は数えない
const CARD_WATCH_LIVE_MS = 10000;         // ホストが「対戦中」を知らせる間
const CARD_WATCH_LIVE_FRESH_MS = 25000;   // これより古い「対戦中」は一覧から消す
const CARD_WATCH_LOG_MAX = 1500;          // 1試合の手の数の上限(これを超えたら流さない)
const CARD_WATCH_LOG_CHUNK = 150;         // 途中から見る人へ、1回に渡す手の数
const CARD_WATCH_QUIET_MS = 20000;        // ホストからこれだけ何も届かなければ「届かなくなりました」

// ---- 純粋な計算(ここから下の UI と通信を使わない。tools/card/card-pvp-watch-check.js が node で確かめる) ----

// 見る人の場の始まり。両方とも、モンスターだけが表で、技カードは全部「仮の札」
// meta … { p:[{ name, mons, count }, …], first }(観戦の見え方)
const cardWatchNewGame = (db, meta) => cardCreateGame(db, {
  decks: meta.p.map((x) => ({ monsters: x.mons, cards: Array.from({ length: x.count || CARD_BATTLE_DECK_SIZE }, () => CARD_PVP_HIDDEN) })),
  names: meta.p.map((x, i) => x.name || (i === 0 ? 'ホスト' : 'あいて')), seed: 1, first: meta.first,
});
// どちら側から見るか(side = 1 なら、ホストの相手を下にする)。手と捨て札と meta を入れ替える
const cardWatchSideEntry = (e, side) => (side === 1 ? { ...e, by: 1 - e.by, act: cardPvpFlip(e.act), d: Array.isArray(e.d) ? [e.d[1], e.d[0]] : e.d } : e);
const cardWatchSideMeta = (meta, side) => (side === 1 ? { ...meta, p: [meta.p[1], meta.p[0]], first: 1 - meta.first } : meta);
const cardWatchSideWinner = (w, side) => (w === 0 || w === 1 ? (side === 1 ? 1 - w : w) : null);
// 捨て札の仮の札を、届いた並びで本物にする(数が合わない・食い違うときは、その人のぶんはそのまま)
const cardWatchPatchOne = (db, pl, list) => {
  if (!Array.isArray(list) || list.length !== pl.discard.length) return false;
  if (list.some((no, i) => (no !== CARD_PVP_HIDDEN && !cardOf(db, no)) || (pl.discard[i] !== CARD_PVP_HIDDEN && no !== CARD_PVP_HIDDEN && pl.discard[i] !== no))) return false;
  pl.discard = pl.discard.map((no, i) => (no === CARD_PVP_HIDDEN ? list[i] : no));
  return true;
};
const cardWatchPatchDiscards = (db, st, d) => {
  if (!st || !Array.isArray(d)) return st;
  const s = cardClone(st);
  [0, 1].forEach((p) => cardWatchPatchOne(db, s.players[p], d[p]));
  return s;
};
// 1手を当てる(どちらの人の手でも。91 の cardPvpApplyRemote を、両方とも見えない場にしたもの)。
// e … { by(観戦の見え方の番号), act(観戦の見え方), reveal:{ 手札の番号: カードの番号 }, d:[0の捨て札, 1の捨て札](ホストに分かっている並び。仮の札が混じることがある) }
// 当てられなければ null
const cardWatchApply = (db, st, e) => {
  if (!st || !e || !e.act || (e.by !== 0 && e.by !== 1) || st.winner !== null || cardPvpDecider(st) !== e.by) return null;
  const s = cardClone(st);
  const pl = s.players[e.by];
  // 手を打つ人の手札は、いつも仮の札に戻してから当てる(相手の手札から選ぶ段は、見せてもらった札を残す。91 と同じ)
  if (!(s.pendingChoice && s.pendingChoice.src === 'oppHand')) pl.hand = pl.hand.map(() => CARD_PVP_HIDDEN);
  // 捨て札の仮の札は、届いた並びで先に本物へ(捨て札の中身で効き目が変わる札があるため)
  if (Array.isArray(e.d)) [0, 1].forEach((p) => { const list = e.d[p]; if (Array.isArray(list)) s.players[p].discard.forEach((no, i) => { if (no === CARD_PVP_HIDDEN && cardOf(db, list[i])) s.players[p].discard[i] = list[i]; }); });
  const reveal = e.reveal && typeof e.reveal === 'object' ? e.reveal : {};
  for (const [k, no] of Object.entries(reveal)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= pl.hand.length || pl.hand[i] !== CARD_PVP_HIDDEN || !cardOf(db, no)) return null;
    pl.hand[i] = no;
  }
  const next = cardApplyAction(db, s, e.act);
  if (!next) return null;
  if (Array.isArray(e.d)) {
    // 手を打った人の捨て札は、ホストに全部分かっている(数が合わなければだめ)。もう1人のぶんは、分かっている所だけ
    if (Array.isArray(e.d[e.by]) && !e.d[e.by].includes(CARD_PVP_HIDDEN) && e.d[e.by].length !== next.players[e.by].discard.length) return null;
    [0, 1].forEach((p) => cardWatchPatchOne(db, next.players[p], e.d[p]));
  }
  // 山札は両方とも仮の札のまま(山札へ戻した札も)
  next.players.forEach((x) => { x.deck = x.deck.map(() => CARD_PVP_HIDDEN); });
  return next;
};

// 受け取った知らせを作り直す(知らない形は捨てる・数は上限で切る)
const cardWatchCleanEntry = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const by = cardPvpInt(raw.by, 1);
  const act = cardPvpCleanAct(raw.act);
  if (by === null || !act) return null;
  const reveal = {};
  if (raw.reveal && typeof raw.reveal === 'object') for (const [k, v] of Object.entries(raw.reveal).slice(0, 20)) { const i = Number(k); if (Number.isInteger(i) && i >= 0 && i < 20 && cardPvpCardId(v)) reveal[i] = v; }
  return { by, act, reveal, d: cardWatchCleanDiscards(raw.d) };
};
// 捨て札の並び(仮の札は -1 のまま通す)
const cardWatchCleanDiscards = (raw) => {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const one = (list) => (Array.isArray(list) ? list.slice(0, 60).map((v) => (v === CARD_PVP_HIDDEN ? CARD_PVP_HIDDEN : cardPvpCardId(v))) : null);
  const out = raw.map(one);
  return out.some((l) => !l || l.includes(null)) ? null : out;
};
const cardWatchCleanPerson = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const mons = cardPvpCleanCards(raw.mons, 3);
  return { name: rhythmMultiText(raw.name, CARD_PVP_NAME_MAX) || 'ブリーダー', icon: rhythmMultiText(raw.icon, CARD_PVP_ICON_MAX), fr: typeof raw.fr === 'string' ? raw.fr.slice(0, 40) : null,
    bid: typeof raw.bid === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(raw.bid) ? raw.bid : null, dn: typeof raw.dn === 'string' ? (rhythmMultiText(raw.dn, 30) || null) : null,
    mons: mons && mons.length === 3 && !mons.includes(null) ? mons : null, count: cardPvpInt(raw.count, 60) };
};
const cardWatchCleanMeta = (raw) => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.p) || raw.p.length !== 2) return null;
  const p = raw.p.map(cardWatchCleanPerson);
  const first = cardPvpInt(raw.first, 1);
  if (p.some((x) => !x || !x.mons) || first === null) return null;
  return { p, first, mode: raw.mode === 'free' ? 'free' : 'private' };
};
const cardWatchCleanMessage = (raw) => {
  if (!raw || typeof raw !== 'object' || typeof raw.t !== 'string' || typeof raw.from !== 'string') return null;
  const from = raw.from.slice(0, 40);
  const match = typeof raw.match === 'string' ? raw.match.slice(0, 40) : '';
  if (raw.t === 'w-eye') return { t: 'w-eye', from, match, need: cardPvpInt(raw.need, CARD_WATCH_LOG_MAX) };
  if (raw.t === 'w-act') { const n = cardPvpInt(raw.n, CARD_WATCH_LOG_MAX); const e = cardWatchCleanEntry(raw.e); return n && e ? { t: 'w-act', from, match, n, e } : null; }
  if (raw.t === 'w-log') {
    const start = cardPvpInt(raw.start, CARD_WATCH_LOG_MAX);
    if (start === null || !Array.isArray(raw.list)) return null;
    const list = raw.list.slice(0, CARD_WATCH_LOG_CHUNK).map(cardWatchCleanEntry);
    return list.includes(null) ? null : { t: 'w-log', from, match, start, list };
  }
  if (raw.t === 'w-hb') {
    const end = raw.end && typeof raw.end === 'object' ? { winner: cardPvpInt(raw.end.winner, 1), reason: rhythmMultiText(raw.end.reason, 20) } : null;
    return { t: 'w-hb', from, match, n: cardPvpInt(raw.n, CARD_WATCH_LOG_MAX) || 0, eyes: cardPvpInt(raw.eyes, 999) || 0, meta: cardWatchCleanMeta(raw.meta), d: cardWatchCleanDiscards(raw.d), end };
  }
  if (raw.t === 'live') {
    const p = Array.isArray(raw.p) && raw.p.length === 2 ? raw.p.map(cardWatchCleanPerson) : null;
    if (!match || !p || p.includes(null)) return null;
    return { t: 'live', from, match, p, at: Number.isFinite(raw.at) ? raw.at : 0, turn: cardPvpInt(raw.turn, 999) || 0, eyes: cardPvpInt(raw.eyes, 999) || 0, mode: raw.mode === 'free' ? 'free' : 'private' };
  }
  return null;
};
// 「対戦中」の一覧(新しい知らせだけ・フレンドの試合を先に・見ている人の多い順)。friends … フレンドのブリーダーid の集まり
const cardWatchLiveList = (seen, now, friends = new Set()) => Object.values(seen || {})
  .filter((x) => x && now - x.seen <= CARD_WATCH_LIVE_FRESH_MS)
  .map((x) => ({ ...x, friend: x.p.findIndex((y) => y.bid && friends.has(y.bid)) }))
  .sort((a, b) => (b.friend >= 0) - (a.friend >= 0) || b.eyes - a.eyes || b.at - a.at);

// ---- 対戦する側(ホスト)の受け持ち。91 の CARD_PVP から呼ぶ ----
// start(meta) … 試合が始まったとき(ホストだけ)/ push(e) … 手を1つ当てたとき(自分の手も相手の手も。観戦の見え方)/ discard(p, list) … 捨て札の並びが分かったとき
// tick() … 2秒おき / end(winner, reason) … 決着 / stop() … 部屋を出たとき / eyes() … いま見ている人の数
const CARD_WATCH_HOST = (() => {
  let h = null;
  const send = (sock, alive, payload) => { if (sock && alive()) sock.send({ ...payload, from: h.id, match: h.match }); };
  const sendWatch = (payload) => { if (h) send(h.ws, () => h.wsAlive, payload); };
  const sendLive = (payload) => { if (h) send(h.live, () => h.liveAlive, payload); };
  const eyes = () => { if (!h) return 0; const now = Date.now(); let n = 0; h.eyes.forEach((at, id) => { if (now - at > CARD_WATCH_EYE_FRESH_MS) h.eyes.delete(id); else n++; }); return n; };
  const hbMsg = () => ({ t: 'w-hb', n: h.log.length, eyes: eyes(), meta: h.meta, d: h.d, end: h.end });
  // 途中から見る人へ: いちばん遅れている人の場所から、まとめて渡す(1秒に1回まで。足りなければ、見る人がまた頼む)
  const reply = () => {
    if (!h || h.need === null) return;
    const start = h.need; h.need = null; h.replyAt = Date.now();
    sendWatch({ t: 'w-log', start, list: h.log.slice(start, start + CARD_WATCH_LOG_CHUNK) });
  };
  const onWatch = (raw) => {
    const msg = cardWatchCleanMessage(raw);
    if (!h || !msg || msg.t !== 'w-eye' || msg.match !== h.match || msg.from === h.id) return;
    // 上限を超えた人は数えない(その人には「満員」と出る)
    if (h.eyes.has(msg.from) || eyes() < CARD_WATCH_MAX) h.eyes.set(msg.from, Date.now()); else return;
    if (msg.need !== null && msg.need < h.log.length) {
      h.need = h.need === null ? msg.need : Math.min(h.need, msg.need);
      if (Date.now() - h.replyAt >= 1000) reply(); else if (!h.replyTimer) h.replyTimer = setTimeout(() => { if (h) { h.replyTimer = null; reply(); } }, 1000);
    }
  };
  const openWs = (topic, onMsg, key) => {
    const me = rhythmMultiOpenSocket({
      topic,
      onOpen: () => { if (h && h[key] === me) { h[`${key}Alive`] = true; if (key === 'ws') sendWatch(hbMsg()); } },
      onMessage: (raw) => { if (h && h[key] === me && onMsg) onMsg(raw); },
      onClose: () => { if (!h || h[key] !== me) return; h[`${key}Alive`] = false; h[`${key}Retry`] = setTimeout(() => { if (h && h[key] === me) h[key] = openWs(topic, onMsg, key); }, CARD_PVP_RECONNECT_MS); },
    });
    return me;
  };
  const closeAll = () => {
    if (!h) return;
    ['ws', 'live'].forEach((k) => { if (h[`${k}Retry`]) clearTimeout(h[`${k}Retry`]); const x = h[k]; h[k] = null; if (x) { try { x.close(); } catch (_) { /* 閉じている */ } } });
    if (h.replyTimer) clearTimeout(h.replyTimer);
  };
  return {
    start: (meta, match) => {
      if (h) closeAll();
      if (typeof rhythmMultiOpenSocket !== 'function' || !meta || !match) { h = null; return; }
      h = { id: rhythmMultiMakeId('w'), match, meta, log: [], d: [[], []], end: null, eyes: new Map(), need: null, replyAt: 0, replyTimer: null, liveAt: 0, ws: null, live: null, wsAlive: false, liveAlive: false };
      h.ws = openWs(`${CARD_WATCH_TOPIC}${match}`, onWatch, 'ws');
      h.live = openWs(CARD_WATCH_LIVE_TOPIC, null, 'live');
    },
    push: (e) => {
      if (!h || h.end || h.log.length >= CARD_WATCH_LOG_MAX) return;
      if (Number.isInteger(e.turn)) h.turn = e.turn;
      const entry = { by: e.by, act: e.act, reveal: e.reveal || {}, d: e.d || h.d };
      if (Array.isArray(e.d)) h.d = e.d.map((l) => l.slice());
      h.log.push(entry);
      sendWatch({ t: 'w-act', n: h.log.length, e: entry });
    },
    discard: (p, list) => { if (h && Array.isArray(list)) { h.d = h.d.map((l, i) => (i === p ? list.slice() : l)); } },
    tick: () => {
      if (!h) return;
      sendWatch(hbMsg());
      // 決着したら「対戦中」の知らせはやめる
      if (!h.end && Date.now() - h.liveAt >= CARD_WATCH_LIVE_MS) {
        h.liveAt = Date.now();
        sendLive({ t: 'live', p: h.meta.p.map(({ name, icon, fr, bid }) => ({ name, icon, fr, bid })), at: Date.now(), turn: h.turn || 0, eyes: eyes(), mode: h.meta.mode });
      }
    },
    end: (winner, reason) => { if (h && !h.end) { h.end = { winner: winner === 0 || winner === 1 ? winner : null, reason: String(reason || '').slice(0, 20) }; sendWatch(hbMsg()); } },
    stop: () => { closeAll(); h = null; },
    eyes,
  };
})();

// ---- 見る側。部屋の状態は React の外に置く(91 の CARD_PVP と同じ) ----
const CARD_WATCH = (() => {
  const listeners = new Set();
  let s = null;
  let socket = null;
  let alive = false;
  let tick = null;
  let retry = null;
  const blank = () => ({ phase: 'idle', match: '', side: 0, id: '', meta: null, st: null, n: 0, buf: {}, hostN: 0, eyes: 0, end: null, d: null, last: null, lastAt: 0, needAt: 0, error: '', seenAt: 0, counted: false });
  const emit = () => listeners.forEach((fn) => { try { fn(s); } catch (_) { /* 画面の都合で落ちても続ける */ } });
  const set = (patch) => { s = { ...s, ...patch }; emit(); };
  const send = (payload) => { if (socket && alive) socket.send({ ...payload, from: s.id, match: s.match }); };
  const stop = () => {
    if (tick) clearInterval(tick); tick = null;
    if (retry) clearTimeout(retry); retry = null;
    alive = false;
    if (socket) { try { socket.close(); } catch (_) { /* 閉じている */ } } socket = null;
  };
  // 届いている手を、順に当てる(抜けがあれば待つ)。当てられない手が来たら、そこで止める
  const drain = () => {
    if (!s.st) return;
    let { st, n, buf } = s;
    let last = s.last;
    buf = { ...buf };
    while (buf[n + 1]) {
      const e = cardWatchSideEntry(buf[n + 1], s.side);
      delete buf[n + 1];
      const next = cardWatchApply(CARD_BATTLE_DATA, st, e);
      if (!next) { set({ buf, st, n, phase: 'broken', error: 'この試合は、ここから先を見られませんでした' }); return; }
      st = next; n += 1;
      // まんなかに出す「いま使った札」(使った・守ったカード)
      const used = (next.events || []).filter((x) => x.t === 'use' || x.t === 'guard').map((x) => ({ p: x.p, cards: x.t === 'use' ? x.cards : [x.card] })).filter((x) => x.cards.every((no) => cardOf(CARD_BATTLE_DATA, no)));
      if (used.length) last = { key: `${n}`, p: used[used.length - 1].p, cards: used[used.length - 1].cards };
    }
    if (s.d) st = cardWatchPatchDiscards(CARD_BATTLE_DATA, st, s.side === 1 ? [s.d[1], s.d[0]] : s.d);
    s = { ...s, st, n, buf, last, lastAt: last !== s.last ? Date.now() : s.lastAt };
    if (s.end && n >= s.hostN && s.phase === 'watching') s = { ...s, phase: 'over' };
    emit();
  };
  const onMessage = (raw) => {
    const msg = cardWatchCleanMessage(raw);
    if (!s || !msg || msg.match !== s.match || msg.from === s.id || msg.t === 'w-eye' || msg.t === 'live') return;
    s = { ...s, seenAt: Date.now() };
    if (msg.t === 'w-hb') {
      // 上限: はじめての知らせで、もう上限まで見ていて、自分がまだ数えられていなければ「満員」
      if (!s.counted && s.phase === 'connecting' && msg.eyes >= CARD_WATCH_MAX) { stop(); set({ phase: 'full' }); return; }
      const meta = s.meta || msg.meta;
      const patch = { hostN: msg.n, eyes: msg.eyes, end: msg.end, d: msg.d || s.d, meta, counted: true };
      if (!s.st && meta) { patch.st = cardWatchNewGame(CARD_BATTLE_DATA, cardWatchSideMeta(meta, s.side)); patch.phase = 'watching'; }
      s = { ...s, ...patch };
      if (s.n < s.hostN && !s.buf[s.n + 1] && Date.now() - s.needAt > 2500) { s = { ...s, needAt: Date.now() }; send({ t: 'w-eye', need: s.n }); }
      drain();
      return;
    }
    if (msg.t === 'w-act') { if (msg.n > s.n) { s = { ...s, buf: { ...s.buf, [msg.n]: msg.e }, hostN: Math.max(s.hostN, msg.n) }; drain(); } return; }
    if (msg.t === 'w-log') {
      const buf = { ...s.buf };
      msg.list.forEach((e, i) => { const k = msg.start + i + 1; if (k > s.n) buf[k] = e; });
      s = { ...s, buf, needAt: 0 };
      drain();
    }
  };
  const connect = () => {
    if (retry) clearTimeout(retry); retry = null;
    if (socket) { try { socket.close(); } catch (_) { /* 閉じている */ } }
    alive = false;
    const me = socket = rhythmMultiOpenSocket({
      topic: `${CARD_WATCH_TOPIC}${s.match}`,
      onOpen: () => { if (socket !== me) return; alive = true; send({ t: 'w-eye', need: s.n }); },
      onMessage: (raw) => { if (socket === me) onMessage(raw); },
      onClose: () => {
        if (socket !== me || !s) return;
        alive = false;
        if (s.phase === 'idle' || s.phase === 'full') return;
        retry = setTimeout(connect, CARD_PVP_RECONNECT_MS);
      },
    });
  };
  return {
    get: () => s || blank(),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    // 見始める。live … 一覧の1行(cardWatchLiveList)/ side … 下に出す人(フレンドを下にする)
    watch: (live, side = 0) => {
      stop();
      if (!live || !live.match) return;
      s = { ...blank(), phase: 'connecting', match: live.match, side: side === 1 ? 1 : 0, id: rhythmMultiMakeId('v'), seenAt: Date.now() };
      emit();
      connect();
      tick = setInterval(() => {
        if (!s || !socket) return;
        const behind = s.n < s.hostN && !s.buf[s.n + 1];
        send({ t: 'w-eye', need: behind ? s.n : null });
        if (s.phase !== 'over' && s.phase !== 'broken' && Date.now() - s.seenAt > CARD_WATCH_QUIET_MS && !s.end) set({ error: '対戦の知らせが届かなくなりました(対戦が終わったか、電波が途切れています)' });
        else if (s.error && s.phase === 'watching') set({ error: '' });
      }, CARD_WATCH_EYE_MS);
    },
    leave: () => { stop(); s = blank(); emit(); },
  };
})();

// 「対戦中」の一覧を聞く(開いているあいだだけ realtime:mhc-live につなぐ)
const useCardWatchLive = (enabled) => {
  const [seen, setSeen] = useState({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || typeof rhythmMultiOpenSocket !== 'function') return undefined;
    let sock = null; let closed = false; let retry = null;
    const open = () => {
      const me = sock = rhythmMultiOpenSocket({
        topic: CARD_WATCH_LIVE_TOPIC,
        onOpen: () => {},
        onMessage: (raw) => { if (sock !== me) return; const msg = cardWatchCleanMessage(raw); if (msg && msg.t === 'live') setSeen((cur) => ({ ...cur, [msg.match]: { ...msg, seen: Date.now() } })); },
        onClose: () => { if (!closed && sock === me) retry = setTimeout(open, CARD_PVP_RECONNECT_MS); },
      });
    };
    open();
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => { closed = true; clearInterval(t); if (retry) clearTimeout(retry); if (sock) { try { sock.close(); } catch (_) { /* 閉じている */ } } };
  }, [enabled]);
  return { seen, now };
};

// ---- 画面: 観戦する試合を選ぶ(マルチ対戦の入口から) ----
// roster … 承認済みのフレンド [{ otherId, userName }](91 の入口が読んだもの)。だれの対戦でも出す(2026-10-27 社長「だれの対戦でも見られる」)。
// フレンドの対戦を先に並べて「フレンド」の札を付ける。出すのは名前・アイコン・番の数・見ている人数だけ(ほかの情報は出さない・社長)
const CardPvpWatchList = ({ roster = [] }) => {
  const { seen, now } = useCardWatchLive(true);
  const friends = useMemo(() => new Set((roster || []).map((f) => f.otherId)), [roster]);
  const list = cardWatchLiveList(seen, now, friends);
  return (
    <div data-card-watch-list className="rounded-2xl border border-violet-300/40 bg-violet-500/5 p-2">
      {list.length === 0
        ? <p data-card-watch-none className="p-2 text-[13px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap('いまマルチ対戦をしている人はいません。少し待つと出てきます')}</p>
        : <ul className="max-h-[44vh] space-y-1 overflow-y-auto">
          {list.slice(0, 20).map((x) => (
            <li key={x.match} data-card-watch-row={x.match} className="flex items-center gap-2 rounded-xl bg-black/30 px-2 py-1.5">
              <div className="flex shrink-0 items-center gap-1">
                <CardPvpAvatar icon={x.p[0].icon} frame={x.p[0].fr} className="h-7 w-7"/>
                <span className="text-[11px] font-black text-slate-400">vs</span>
                <CardPvpAvatar icon={x.p[1].icon} frame={x.p[1].fr} className="h-7 w-7"/>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1">
                  {x.friend >= 0 && <span data-card-watch-friend className="shrink-0 rounded bg-emerald-500/25 px-1 text-[10px] font-black text-emerald-100">フレンド</span>}
                  <span className="truncate text-[13px] font-bold text-white">{x.p[0].name} vs {x.p[1].name}</span>
                </div>
                <div className="text-[11px] font-bold text-slate-400 tabular-nums">{x.turn > 0 ? `ターン${x.turn}` : 'はじまったところ'}{x.eyes > 0 ? `・👀 ${x.eyes}` : ''}</div>
              </div>
              <button type="button" data-card-watch-go={x.match} disabled={x.eyes >= CARD_WATCH_MAX} className="mh-button mh-button-primary min-h-[40px] shrink-0 rounded-lg px-3 text-[12px] font-black disabled:opacity-50"
                onClick={() => { Audio_.fgSe.tap(); CARD_WATCH.watch(x, x.friend === 1 ? 1 : 0); }}>{x.eyes >= CARD_WATCH_MAX ? '満員' : '見る'}</button>
            </li>
          ))}
        </ul>}
      <p className="mt-1 px-1 text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('見るだけで、操作やスタンプはできません。手札は見えません')}</p>
    </div>
  );
};

// ---- 画面: 観戦(両方の場を横から見る。手札は両方とも裏の札で、枚数だけ) ----
const CardWatchSide = ({ db, st, p, person, top = false }) => {
  const pl = st.players[p];
  const active = st.winner === null && cardPvpDecider(st) === p;
  const row = (
    <div className="flex items-center gap-2 px-1">
      <span className="block h-[34px] w-[34px] shrink-0"><CardPvpAvatar icon={person && person.icon} frame={person && person.fr} className="h-full w-full"/></span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-[13px] font-black ${active ? 'text-amber-200' : 'text-white'}`}>{(person && person.name) || pl.name}{active ? ' の番' : ''}</div>
        <div data-card-watch-counts={p} className="flex flex-wrap gap-x-2 text-[11px] font-bold text-slate-300 tabular-nums">
          <span>手札 {pl.hand.length}</span><span>ガッツ {pl.guts.length}</span><span>山札 {pl.deck.length}</span><span>捨て札 {pl.discard.length}</span>
        </div>
      </div>
      <div data-card-watch-hand={p} className="flex shrink-0 -space-x-3" aria-label={`手札${pl.hand.length}枚`}>
        {pl.hand.slice(0, 7).map((_, i) => <img key={i} src={CARD_BACK_IMG()} alt="" className="h-[30px] w-[21px] rounded-[2px] shadow"/>)}
      </div>
    </div>
  );
  const mons = <div className="flex justify-between">{pl.mons.map((_, m) => <CardMonSlot key={m} db={db} st={st} p={p} m={m} compact/>)}</div>;
  return <div data-card-watch-side={p} className={`rounded-2xl border p-1.5 ${active ? 'border-amber-300/60 bg-amber-500/5' : 'border-white/10 bg-slate-900/60'}`}>{top ? <>{row}{mons}</> : <>{mons}{row}</>}</div>;
};
const CardPvpWatchScreen = ({ onBack }) => {
  const [w, setW] = useState(() => CARD_WATCH.get());
  useEffect(() => CARD_WATCH.subscribe(setW), []);
  const [logOpen, setLogOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const db = CARD_BATTLE_DATA;
  const meta = w.meta ? cardWatchSideMeta(w.meta, w.side) : null;
  const back = () => { CARD_WATCH.leave(); if (onBack) onBack(); };
  const st = w.st;
  const winner = w.end ? cardWatchSideWinner(w.end.winner, w.side) : st && st.winner !== null ? st.winner : null;
  const nameOf = (p) => (meta && meta.p[p] ? meta.p[p].name : p === 0 ? 'ブリーダー' : 'あいて');
  const lines = st ? st.log.slice(-3).map((l) => l.text) : [];
  return (
    <div data-mh-screen data-card-watch={w.phase} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="観戦" accent="text-violet-200" onBack={back} note={meta ? `${nameOf(0)} vs ${nameOf(1)}` : 'つないでいます…'}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-3`}>
        {w.phase === 'full' && <p data-card-watch-full className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(`この対戦は、見ている人が${CARD_WATCH_MAX}人に達しています。少しあとでお試しください`)}</p>}
        {w.phase === 'connecting' && <p className="rounded-xl bg-white/5 p-3 text-center text-[13px] font-bold text-slate-200">対戦につないでいます…</p>}
        {w.error && <p data-card-watch-error className="rounded-xl border border-rose-300/40 bg-rose-500/10 p-2 text-[12px] font-bold text-rose-100" style={JA_WRAP_STYLE}>{jaWrap(w.error)}</p>}
        {st && meta && (<>
          <div className="flex items-center justify-between px-1 text-[12px] font-bold text-slate-300">
            <span data-card-watch-turn={st.turn} className="tabular-nums">{st.turn > 0 ? `ターン${st.turn}` : 'はじめのガッツ'}</span>
            <span data-card-watch-eyes={w.eyes} className="tabular-nums">👀 {w.eyes}人が見ています</span>
          </div>
          <CardWatchSide db={db} st={st} p={1} person={meta.p[1]} top/>
          {/* まんなか: いま使われた札と、場の記録の新しい3行 */}
          <div data-card-watch-center className="flex min-h-[100px] items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
            {w.last
              ? <div key={w.last.key} data-card-watch-last={w.last.cards.join(',')} className="flex shrink-0 gap-1">
                {w.last.cards.slice(0, 3).map((no, i) => { const c = cardOf(db, no); return c ? <button key={i} type="button" onClick={() => setDetail(no)} className="block"><img src={CARD_IMG(c.img)} alt={c.name} className="h-[88px] w-[63px] rounded-md object-cover shadow-lg"/></button> : null; })}
              </div>
              : <div className="h-[88px] w-[63px] shrink-0 rounded-md border border-dashed border-white/15"/>}
            <div className="min-w-0 flex-1 space-y-0.5">
              {w.last && <div className="text-[11px] font-black text-violet-200">{nameOf(w.last.p)}が使った札</div>}
              {lines.map((t, i) => <div key={i} className="text-[12px] font-bold leading-snug text-white" style={JA_WRAP_STYLE}>{jaWrap(t)}</div>)}
            </div>
          </div>
          <CardWatchSide db={db} st={st} p={0} person={meta.p[0]}/>
          {(w.phase === 'over' || winner !== null) && (
            <div data-card-watch-over={winner === null ? 'none' : winner} className="rounded-2xl border border-amber-300/50 bg-amber-500/10 p-3 text-center">
              <div className="text-[16px] font-black text-amber-100">{winner === null ? '対戦が終わりました' : `${nameOf(winner)}さんの勝ち！`}</div>
              {w.end && w.end.reason && !['勝ち', '負け'].includes(w.end.reason) && <div className="mt-0.5 text-[12px] font-bold text-slate-300">({w.end.reason})</div>}
            </div>
          )}
        </>)}
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <div className="flex gap-2">
          {st && <button type="button" data-card-watch-log className="mh-button min-h-[48px] flex-1 rounded-2xl border border-white/15 bg-slate-900 font-black text-slate-100" onClick={() => { Audio_.fgSe.tap(); setLogOpen(true); }}>ターンの記録</button>}
          <button type="button" data-card-watch-leave className="mh-button mh-button-primary min-h-[48px] flex-1 rounded-2xl font-black" onClick={() => { Audio_.fgSe.tap(); back(); }}>観戦をやめる</button>
        </div>
      </div>
      {logOpen && st && <CardTurnLogSheet st={st} meName={nameOf(0)} foeName={nameOf(1)} onClose={() => setLogOpen(false)}/>}
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
    </div>
  );
};
