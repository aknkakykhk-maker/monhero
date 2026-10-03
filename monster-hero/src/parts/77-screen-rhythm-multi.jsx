// ===== モンヒロビート マルチ(みんなで対戦: 協力ライブ) =====
// 仕様の正本: docs/spec/RHYTHM_MULTI.md / 検査: node tools/mode/rhythm-multi-check.js
// プロセカの「みんなでライブ」を本家どおりの流れで真似した、最大5人の協力プレイ。
//
//   ルームえらび(フリー / ベテラン / プライベート)
//   → マッチング(5人そろう・部屋主が「メンバー確定」・公開ルームはしばらく待つと自動で確定)
//   → 選曲(30秒。全員が曲か「おまかせ」をえらぶ。全員そろうか時間切れで次へ)
//   → MUSIC SHUFFLE(全員の選曲から1曲を抽選する演出)
//   → 難易度えらび・準備完了(30秒。全員の準備完了か時間切れでライブ開始)
//   → ライブ(各自の端末で演奏。リスタート・リタイアなし)
//   → 結果(チームのランク・1人ずつのスコア・MVP)
//   → 同じメンバーのまま、次の選曲へ
//
// 通信は Supabase Realtime の「Broadcast」だけを使う。テーブルもSQLも要らず、ランキング(rankings)・
// 自己ベスト・ビートP・周回報酬には一切触れない。演奏は各自の端末で完結するので、通信の遅れは判定に影響しない。
//
// 作り:
//  ・サーバーは持たない。全員が2秒ごとに自分の状態を知らせ(hb)、7秒聞こえない人は抜けた扱い。
//    「部屋主」は、いる人の中でいちばん早く入った人(同時なら id の小さい人)。全員が同じ並びを計算できる。
//  ・部屋の進行(いまどの段か・何曲目か・残り時間)は部屋主の端末だけが決め、hb に載せて配る。
//    ほかの人はそれに従う。部屋主が抜けたら、次の部屋主が受け取っていた進行をそのまま引き継ぐ。
//    残り時間は「あと何秒」で配る(端末の時計がずれていても数え方がそろう)。
//  ・フリー/ベテランの「さがす」は、種類ごとの受付用の通信路(mhb-lobby-◯◯)で行う。
//    空きのある部屋の部屋主が2秒ごとに「ここにいるよ」と知らせ、探す人はそれを3.5秒聞いて入る。
//    探す人どうしが同時に部屋を作っても、1人きりの部屋は「コードの小さい部屋」へ引っ越して1つにまとまる。
//  ・画面を行き来しても部屋が切れないよう、状態は React の外(このファイルの RHYTHM_MULTI)に置く。
const RHYTHM_MULTI_ROOM_MAX = 5;
const RHYTHM_MULTI_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RHYTHM_MULTI_CODE_LENGTH = 4;
const RHYTHM_MULTI_HEARTBEAT_MS = 2000;
const RHYTHM_MULTI_ALIVE_MS = 7000;
const RHYTHM_MULTI_START_COUNTDOWN_SEC = 3;
const RHYTHM_MULTI_SHUFFLE_MS = 2400;
// 各段の制限時間(本家と同じく、時間切れになったら自動で次へ進む)
const RHYTHM_MULTI_SELECT_MS = 30000;
const RHYTHM_MULTI_READY_MS = 30000;
const RHYTHM_MULTI_READY_GRACE_MS = 3000;
const RHYTHM_MULTI_RESULT_MS = 45000;
// ライブが曲の長さを過ぎても終わらない人を待つ上限。
//   対戦の 3・2・1(3秒)+ 演奏画面の READY・3・2・1(0.8秒×4)= 曲が鳴りはじめるまで + 曲が終わってから10秒。
//   最後まで演奏した人は曲が終わった瞬間にスコアを送ってくるので、それ以上待っても届かない人は抜けた人
//   (2026-10-03・ユーザー指摘「演奏後30秒わからないのは不便」。以前は一律30秒だった)
const RHYTHM_MULTI_PLAY_GRACE_MS = RHYTHM_MULTI_START_COUNTDOWN_SEC * 1000 + 4 * 800 + 10000;
// 演奏中に溜めておく知らせの上限(5人・数分のライブなら届かない量。超えたら古いものから捨てる)
const RHYTHM_MULTI_QUEUE_MAX = 300;
// 公開ルームは、2人以上いて、この時間だれも出入りしなければメンバー確定
const RHYTHM_MULTI_PUBLIC_MATCH_WAIT_MS = 15000;
const RHYTHM_MULTI_CHAT_MAX_LENGTH = 40;
const RHYTHM_MULTI_CHAT_KEEP = 50;
const RHYTHM_MULTI_CHAT_INTERVAL_MS = 800;
const RHYTHM_MULTI_CHAT_STAMPS = Object.freeze(['よろしく!', 'ナイス!', '準備OK!', 'もう一回!', 'ありがとう!']);
// 画面ごとに、先頭へ出す定型文(2026-10-03・ユーザー指示「チャット機能もっと使いやすく」
// 「結果画面でもチャットできるように。もういっかいとかありがとうとか意思疎通したい」)。
// 残りは共通の定型文を後ろへ並べる(同じ文は2度並べない)
const RHYTHM_MULTI_CHAT_STAMPS_BY_PHASE = Object.freeze({
  matching: ['よろしく!', 'はじめまして!', 'ちょっと待って!'],
  select: ['この曲やりたい!', 'おまかせで!', 'なんでもOK!'],
  ready: ['準備OK!', 'ちょっと待って!', 'がんばろう!'],
  playing: ['おつかれ!', 'ナイス!', '待ってるね!'],
  result: ['もう一回!', 'ありがとう!', 'おつかれ!', 'ナイス!', 'GG!', '次いこう!', 'ドンマイ!', 'またね!'],
});
const RHYTHM_MULTI_CHAT_COMMON_STAMPS = Object.freeze(['よろしく!', 'ありがとう!', 'ナイス!', 'もう一回!', 'おつかれ!', 'すごい!', 'ドンマイ!', 'またね!']);
const rhythmMultiStampsFor = (phase) => {
  const list = [...(RHYTHM_MULTI_CHAT_STAMPS_BY_PHASE[phase] || []), ...RHYTHM_MULTI_CHAT_COMMON_STAMPS, ...RHYTHM_MULTI_CHAT_STAMPS];
  return list.filter((text, i) => text.length <= RHYTHM_MULTI_CHAT_MAX_LENGTH && list.indexOf(text) === i);
};
// 発言は、その人のカードの上へ吹き出しでしばらく出す(チャットを開いていなくても気づける)
const RHYTHM_MULTI_CHAT_BUBBLE_MS = 6000;
const RHYTHM_MULTI_ROOM_TOPIC = 'realtime:mhb-room-';
const RHYTHM_MULTI_LOBBY_TOPIC = 'realtime:mhb-lobby-';
const RHYTHM_MULTI_LOBBY_ANNOUNCE_MS = 2000;
const RHYTHM_MULTI_LOBBY_LISTEN_MS = 3500;
const RHYTHM_MULTI_LOBBY_FRESH_MS = 6000;
// 1人きりの部屋をほかの部屋へまとめるのは、最近この時間だれも見ていないときだけ(ライブ中の仲間とはぐれないため)
const RHYTHM_MULTI_MERGE_QUIET_MS = 5 * 60 * 1000;
// 途中でやめた人が公開ルームへ入れない時間。新しい保存キー(既存のキーは触らない)
const RHYTHM_MULTI_PENALTY_KEY = 'mh_rhythm_multi_penalty_v1';
const RHYTHM_MULTI_PENALTY_MS = 3 * 60 * 1000;
const RHYTHM_MULTI_MODES = Object.freeze(['private', 'free', 'veteran']);
const RHYTHM_MULTI_MODE_LABELS = Object.freeze({ private: 'プライベート', free: 'フリー', veteran: 'ベテラン' });
const RHYTHM_MULTI_PHASES = Object.freeze(['matching', 'select', 'ready', 'playing', 'result']);
// 「おまかせ」を選んだしるし(曲の id とぶつからない文字)
const RHYTHM_MULTI_OMAKASE = '*';
// 対戦のライブで重ねる見た目(オプションの見た目のおまかせ「軽さ優先」と同じ中身。保存してある設定は書き換えない)
const RHYTHM_MULTI_LIGHT_LOOK = Object.freeze({ ...((RHYTHM_LOOK_PRESETS.find((preset) => preset.id === 'LIGHT') || {}).values || {}) });
// ライブの報酬(周回・ビートP)の人数ボーナス。参加した人が1人ふえるごとに+50%(2人1.5倍〜5人3倍。2026-10-02・ユーザー指示)
const RHYTHM_MULTI_REWARD_STEP = 0.5;
const rhythmMultiRewardScale = (count) => {
  const n = Math.max(1, Math.min(RHYTHM_MULTI_ROOM_MAX, Math.floor(Number(count) || 1)));
  return 1 + RHYTHM_MULTI_REWARD_STEP * (n - 1);
};
// 「メンバーの成績」に出す判定の並び(演奏側の RHYTHM_JUDGMENT_IDS と同じ順)
const RHYTHM_MULTI_JUDGMENT_IDS = Object.freeze(['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS']);

const rhythmMultiMakeCode = () => {
  let code = '';
  for (let i = 0; i < RHYTHM_MULTI_CODE_LENGTH; i += 1) {
    code += RHYTHM_MULTI_CODE_CHARS[Math.floor(Math.random() * RHYTHM_MULTI_CODE_CHARS.length)];
  }
  return code;
};
// 入力されたコードを整える。使える文字だけを残し、4文字にそろわなければ空文字を返す
const rhythmMultiNormalizeCode = (text) => {
  const code = String(text == null ? '' : text).toUpperCase().split('')
    .filter((ch) => RHYTHM_MULTI_CODE_CHARS.includes(ch)).join('');
  return code.length === RHYTHM_MULTI_CODE_LENGTH ? code : '';
};
const rhythmMultiMakeId = (head = 'p') => `${head}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const rhythmMultiText = (value, max) => String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, '').slice(0, max);
const rhythmMultiInt = (value, max) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
};
// 部屋の並び(部屋主が先頭)。全員が同じ並びを得る
const rhythmMultiSortMembers = (members) => members.slice().sort((a, b) =>
  (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// ---- 保存(途中でやめたときの入室待ち。保存が壊れていても既定値で動く) ----
const rhythmMultiPenaltyLeftMs = async () => {
  try {
    const saved = await storeGet(RHYTHM_MULTI_PENALTY_KEY, null);
    const until = saved && typeof saved === 'object' ? Number(saved.until) : 0;
    return Number.isFinite(until) ? Math.max(0, Math.min(RHYTHM_MULTI_PENALTY_MS, until - Date.now())) : 0;
  } catch (_) { return 0; }
};
const rhythmMultiPenaltyMark = async () => {
  try { await storeSet(RHYTHM_MULTI_PENALTY_KEY, { until: Date.now() + RHYTHM_MULTI_PENALTY_MS }); } catch (_) { /* 保存できなくても対戦は続ける */ }
};

// ---- 結果の集計(協力スコア) ----
// 1曲ぶん。ライブに参加した人(participants)の平均スコアでチームのランクを決める。
// やめた人・途中で抜けた人は0点として平均に入れる。MVP は、最後まで演奏した人の最高スコア(同点は先に入った人)
const rhythmMultiTeamResult = (members, round, participants, closed = false) => {
  const ids = Array.isArray(participants) && participants.length ? participants : members.map((m) => m.id);
  const rows = ids.map((id) => {
    const m = members.find((x) => x.id === id) || { id, name: '(抜けた人)', icon: '', frame: '', gone: true };
    return { m, res: m.res && m.res.startId === round ? m.res : null };
  });
  // closed … 結果の段に入った(ホストが締めた・上限時間を過ぎた)。まだ結果の無い人は待たない
  const waiting = !closed && rows.some((r) => !r.res && !r.m.gone);
  const scores = rows.map((r) => (r.res && !r.res.quit ? r.res.score : 0));
  const average = scores.length ? Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  let mvpId = null;
  let best = 0;
  rows.forEach((r) => { if (r.res && !r.res.quit && r.res.score > best) { best = r.res.score; mvpId = r.m.id; } });
  return { rows, waiting, average, mvpId, rank: scores.length ? rhythmRankForScore(average) : null };
};

// ---- 受け取った知らせを、安全な形へ作り直す。知らない形・壊れた値は捨てる ----
const rhythmMultiCleanRoom = (raw) => {
  if (!raw || typeof raw !== 'object' || !RHYTHM_MULTI_PHASES.includes(raw.ph)) return null;
  return {
    phase: raw.ph,
    round: rhythmMultiText(raw.rd, 40),
    songId: rhythmMultiText(raw.sg, 60),
    left: rhythmMultiInt(raw.lf, 600),
    // 残り0秒と「制限時間なし」を分ける(0秒を「なし」と読むと、時間切れの扱いが動かなくなる)
    hasDeadline: raw.dl === 1,
    participants: Array.isArray(raw.pt) ? raw.pt.slice(0, RHYTHM_MULTI_ROOM_MAX).map((id) => rhythmMultiText(id, 40)).filter(Boolean) : [],
  };
};
const rhythmMultiCleanMessage = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = rhythmMultiText(raw.id, 40);
  if (!id) return null;
  const out = { t: raw.t, id };
  if (raw.t === 'hb') {
    out.name = rhythmMultiText(raw.name, 12) || '名無しのブリーダー';
    out.level = rhythmMultiInt(raw.level, 9999);
    out.joinedAt = rhythmMultiInt(raw.joinedAt, 9e15);
    out.icon = rhythmMultiText(raw.icon, 60);
    out.frame = rhythmMultiText(raw.frame, 40);
    out.pick = rhythmMultiText(raw.pick, 60);
    out.pickRound = rhythmMultiText(raw.pickRound, 40);
    out.readyRound = rhythmMultiText(raw.readyRound, 40);
    out.diff = rhythmMultiText(raw.diff, 20);
    out.playing = raw.playing === true;
    out.open = raw.open === true;
    out.mode = RHYTHM_MULTI_MODES.includes(raw.mode) ? raw.mode : 'private';
    if (raw.res && typeof raw.res === 'object') out.res = rhythmMultiCleanResult(raw.res);
    if (raw.room) out.room = rhythmMultiCleanRoom(raw.room);
    return out;
  }
  if (raw.t === 'draw' || raw.t === 'start') {
    out.round = rhythmMultiText(raw.round, 40);
    out.songId = rhythmMultiText(raw.songId, 60);
    out.participants = Array.isArray(raw.participants) ? raw.participants.slice(0, RHYTHM_MULTI_ROOM_MAX).map((x) => rhythmMultiText(x, 40)).filter(Boolean) : [];
    return out.round && out.songId ? out : null;
  }
  if (raw.t === 'res') {
    out.res = rhythmMultiCleanResult(raw.res);
    return out.res ? out : null;
  }
  if (raw.t === 'chat') {
    out.name = rhythmMultiText(raw.name, 12) || '名無しのブリーダー';
    out.text = rhythmMultiText(raw.text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
    out.cid = rhythmMultiText(raw.cid, 40);
    return out.text && out.cid ? out : null;
  }
  if (raw.t === 'bye') return out;
  return null;
};
const rhythmMultiCleanResult = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const startId = rhythmMultiText(raw.startId, 40);
  if (!startId) return null;
  return {
    startId,
    score: rhythmMultiInt(raw.score, 1e12),
    maxCombo: rhythmMultiInt(raw.maxCombo, 100000),
    cleared: raw.cleared !== false,
    quit: raw.quit === true,
    diffId: rhythmMultiText(raw.diffId, 20),
    fc: rhythmMultiInt(raw.fc, 3),
    // 判定ごとの数(メンバーの成績)と FAST / SLOW。無ければ空
    j: Array.isArray(raw.j) ? RHYTHM_MULTI_JUDGMENT_IDS.map((_, k) => rhythmMultiInt(raw.j[k], 100000)) : null,
    fs: rhythmMultiInt(raw.fs, 100000),
    sl: rhythmMultiInt(raw.sl, 100000),
  };
};
// 受付用の通信路で流れる「ここに部屋があるよ」
const rhythmMultiCleanRoomNotice = (raw) => {
  if (!raw || typeof raw !== 'object' || raw.t !== 'room') return null;
  const code = rhythmMultiNormalizeCode(raw.code);
  const n = rhythmMultiInt(raw.n, RHYTHM_MULTI_ROOM_MAX);
  return code && n >= 1 && n < RHYTHM_MULTI_ROOM_MAX ? { code, n } : null;
};
// 受付で聞いた部屋のうち、いちばん人が多い部屋(同数ならコードの小さい順)。自分の部屋は除く
const rhythmMultiBestRoom = (rooms, exceptCode) => {
  const now = Date.now();
  const list = Object.entries(rooms)
    .filter(([code, info]) => code !== exceptCode && now - info.seen <= RHYTHM_MULTI_LOBBY_FRESH_MS)
    .map(([code, info]) => ({ code, n: info.n }));
  list.sort((a, b) => (b.n - a.n) || (a.code < b.code ? -1 : 1));
  return list.length ? list[0].code : null;
};

// ---- 通信(Supabase Realtime を Phoenix のことばで直接話す。ライブラリは足さない) ----
const rhythmMultiOpenSocket = ({ topic, onOpen, onMessage, onClose }) => {
  let ws = null;
  let beatTimer = null;
  let ref = 0;
  let closed = false;
  const nextRef = () => String(++ref);
  const send = (event, payload, topicName) => {
    if (!ws || ws.readyState !== 1) return false;
    try { ws.send(JSON.stringify({ topic: topicName || topic, event, payload, ref: nextRef(), join_ref: '1' })); return true; } catch (_) { return false; }
  };
  try {
    ws = new WebSocket(`${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_KEY)}&vsn=1.0.0`);
  } catch (_) {
    setTimeout(() => { if (!closed) onClose(); }, 0);
    return { send: () => false, close: () => { closed = true; } };
  }
  ws.onopen = () => {
    // join_ref は join のときの ref('1')と同じにしておく
    try {
      ws.send(JSON.stringify({ topic, event: 'phx_join', payload: { config: { broadcast: { self: true, ack: false }, presence: { key: '' }, private: false } }, ref: '1', join_ref: '1' }));
    } catch (_) { /* 閉じたときに onClose が来る */ }
    beatTimer = setInterval(() => send('heartbeat', {}, 'phoenix'), 25000);
  };
  ws.onmessage = (event) => {
    let msg = null;
    try { msg = JSON.parse(event.data); } catch (_) { return; }
    if (!msg || msg.topic !== topic) return;
    if (msg.event === 'phx_reply' && msg.ref === '1') {
      if (msg.payload && msg.payload.status === 'ok') onOpen(); else onClose();
    } else if (msg.event === 'broadcast' && msg.payload && msg.payload.event === 'msg') {
      onMessage(msg.payload.payload);
    } else if (msg.event === 'phx_close' || msg.event === 'phx_error') {
      onClose();
    }
  };
  ws.onclose = () => { if (beatTimer) clearInterval(beatTimer); beatTimer = null; if (!closed) onClose(); };
  ws.onerror = () => { /* onclose がそのあとに来る */ };
  return {
    send: (payload) => send('broadcast', { type: 'broadcast', event: 'msg', payload }),
    close: () => {
      closed = true;
      if (beatTimer) clearInterval(beatTimer);
      beatTimer = null;
      try { ws.close(); } catch (_) { /* すでに閉じている */ }
    },
  };
};

// ---- 部屋の状態(React の外に置く) ----
const RHYTHM_MULTI = (() => {
  const listeners = new Set();
  const startListeners = new Set();
  let s = null;
  let socket = null;
  let lobby = null; // { kind, socket, rooms, lastAnnounce }
  let hbTimer = null;
  let sweepTimer = null;
  let reconnectTimer = null;
  let catalog = []; // 抽選に使う曲の id(画面から渡してもらう)
  let durations = {}; // 曲の長さ(ミリ秒)。ライブが終わらない人を待ち続けないための上限に使う
  // アプリを閉じる・別のページへ移るときに「抜けます」を送る(ほかの人がすぐ気づけるように)。
  // 送れない閉じ方(強制終了など)のときは、上の上限時間で抜けた扱いになる
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', () => { if (s && socket) socket.send({ t: 'bye', id: s.selfId }); });
  }
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (_) { /* 画面側の失敗で通信を止めない */ } }); };
  // ライブ中の人は演奏のあいだ何も送ってこないので、ライブの上限時間(曲の長さ+ゆとり)までは抜けた扱いにしない
  const alive = () => (s ? Object.values(s.members).filter((m) => Date.now() - m.seen <= RHYTHM_MULTI_ALIVE_MS || m.id === s.selfId
    || (m.playing && s.room.phase === 'playing' && Date.now() < s.playUntil)) : []);
  const ordered = () => rhythmMultiSortMembers(alive()).slice(0, RHYTHM_MULTI_ROOM_MAX);
  const selfMember = () => (s ? s.members[s.selfId] : null);
  const isHostNow = () => { const o = ordered(); return !!s && o.length > 0 && o[0].id === s.selfId; };
  const roomPayload = () => {
    const r = s.room;
    return { ph: r.phase, rd: r.round, sg: r.songId, lf: r.deadline ? Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)) : 0, dl: r.deadline ? 1 : 0, pt: r.participants };
  };
  // 演奏中は送らない(2026-10-03・ユーザー指示「演奏中の通信は止める」)。force はライブ開始の知らせだけ
  const sendHb = (force = false) => {
    const me = selfMember();
    if (!s || !socket || !me) return;
    if (me.playing && !force) return;
    socket.send({
      t: 'hb', id: s.selfId, name: me.name, level: me.level, joinedAt: me.joinedAt, icon: me.icon, frame: me.frame,
      pick: me.pick, pickRound: me.pickRound, readyRound: me.readyRound, diff: me.diff, playing: me.playing,
      open: me.open, mode: s.mode, res: me.res || undefined, room: isHostNow() ? roomPayload() : undefined,
    });
  };
  const stopTimers = () => {
    if (hbTimer) clearInterval(hbTimer);
    if (sweepTimer) clearInterval(sweepTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    hbTimer = sweepTimer = reconnectTimer = null;
  };
  const closeLobby = () => { if (lobby) { try { lobby.socket.close(); } catch (_) { /* 無視 */ } lobby = null; } };

  // ---- 部屋主だけが進める部屋の進行 ----
  const setRoom = (next) => { s.room = { ...s.room, ...next }; sendHb(); emit(); };
  const toSelect = () => setRoom({ phase: 'select', round: rhythmMultiMakeId('r'), songId: '', deadline: Date.now() + RHYTHM_MULTI_SELECT_MS, participants: [] });
  const doDraw = (members) => {
    const r = s.room;
    const picks = members.filter((m) => m.pickRound === r.round && m.pick && m.pick !== RHYTHM_MULTI_OMAKASE && catalog.includes(m.pick)).map((m) => m.pick);
    const pool = picks.length ? picks : catalog;
    if (!pool.length) return;
    const songId = pool[Math.floor(Math.random() * pool.length)];
    if (socket) socket.send({ t: 'draw', id: s.selfId, round: r.round, songId });
    setRoom({ phase: 'ready', songId, deadline: Date.now() + RHYTHM_MULTI_SHUFFLE_MS + RHYTHM_MULTI_READY_MS });
  };
  // everyone … ホストの「すぐ開始」。準備完了を押していない人も、いまえらんでいる難易度でいっしょに始める(時間切れと同じ扱い)
  const doStart = (members, everyone = false) => {
    const r = s.room;
    const participants = members.filter((m) => everyone || m.readyRound === r.round).map((m) => m.id);
    if (!participants.length) { toSelect(); return; }
    if (socket) socket.send({ t: 'start', id: s.selfId, round: r.round, songId: r.songId, participants });
    // ライブの上限時間: 曲の長さ+カウントダウンと読み込みのゆとり。過ぎても終わらない人はリタイア扱いで結果へ進む
    const songMs = Number(durations[r.songId]) > 0 ? Number(durations[r.songId]) : 240000;
    setRoom({ phase: 'playing', participants, deadline: Date.now() + songMs + RHYTHM_MULTI_PLAY_GRACE_MS });
  };
  const hostTick = () => {
    if (!s || !isHostNow() || s.status !== 'open') return;
    const members = ordered();
    const r = s.room;
    const now = Date.now();
    if (r.phase === 'matching') {
      if (members.length >= RHYTHM_MULTI_ROOM_MAX) toSelect();
      else if (s.mode !== 'private' && members.length >= 2 && now - s.lastMemberChange >= RHYTHM_MULTI_PUBLIC_MATCH_WAIT_MS) toSelect();
    } else if (r.phase === 'select') {
      if (members.length < 2) { setRoom({ phase: 'matching', deadline: 0 }); return; }
      const allPicked = members.every((m) => m.pickRound === r.round && m.pick);
      if (allPicked || now >= r.deadline) doDraw(members);
    } else if (r.phase === 'ready') {
      const allReady = members.every((m) => m.readyRound === r.round);
      if (allReady || now >= r.deadline + RHYTHM_MULTI_READY_GRACE_MS) doStart(members);
    } else if (r.phase === 'playing') {
      const aliveIds = members.map((m) => m.id);
      const done = r.participants.every((id) => !aliveIds.includes(id) || (s.members[id] && s.members[id].res && s.members[id].res.startId === r.round));
      if (done || (r.deadline && now >= r.deadline)) setRoom({ phase: 'result', deadline: now + RHYTHM_MULTI_RESULT_MS });
    } else if (r.phase === 'result') {
      if (now >= r.deadline) toSelect();
    }
  };
  // だれもが自分のぶんだけ行う、時間切れの扱い(選んでいなければおまかせ・準備していなければ準備完了)
  const selfTick = () => {
    const me = selfMember();
    if (!s || !me) return;
    const r = s.room;
    if (!r.deadline || Date.now() < r.deadline) return;
    if (r.phase === 'select' && me.pickRound !== r.round) { me.pick = RHYTHM_MULTI_OMAKASE; me.pickRound = r.round; sendHb(); }
    if (r.phase === 'ready' && me.readyRound !== r.round) { me.readyRound = r.round; sendHb(); }
  };
  // 空きのある公開(または解放した)部屋の部屋主だけが、受付へ「ここにいるよ」と知らせる。
  // 自分1人だけの部屋は、受付で聞こえたコードの小さい部屋へ引っ越して、バラバラの部屋を1つにまとめる
  const syncLobby = () => {
    if (!s) { closeLobby(); return; }
    const order = ordered();
    const me = selfMember();
    const want = isHostNow() && !!me && me.open && order.length < RHYTHM_MULTI_ROOM_MAX
      && (s.room.phase === 'matching' || s.room.phase === 'select') && s.status === 'open';
    if (!want) { closeLobby(); return; }
    const kind = s.mode === 'veteran' ? 'veteran' : 'free';
    if (lobby && lobby.kind !== kind) closeLobby();
    if (!lobby) {
      const rooms = {};
      lobby = {
        kind, rooms, lastAnnounce: 0,
        socket: rhythmMultiOpenSocket({
          topic: RHYTHM_MULTI_LOBBY_TOPIC + kind,
          onOpen: () => {},
          onMessage: (raw) => { const n = rhythmMultiCleanRoomNotice(raw); if (n) rooms[n.code] = { n: n.n, seen: Date.now() }; },
          onClose: () => {},
        }),
      };
    }
    if (Date.now() - lobby.lastAnnounce >= RHYTHM_MULTI_LOBBY_ANNOUNCE_MS) {
      lobby.lastAnnounce = Date.now();
      lobby.socket.send({ t: 'room', code: s.code, n: order.length });
    }
    // ★最近ほかの人を見ていた部屋はまとめない。ライブ中の人は何も送ってこないので、自分1人に見えても
    //   実はほかの人が演奏しているだけかもしれない(そこで引っ越すと、戻ってきた仲間とはぐれる)
    const recentlySawOthers = Object.values(s.members).some((m) => m.id !== s.selfId && Date.now() - m.seen < RHYTHM_MULTI_MERGE_QUIET_MS);
    if (order.length === 1 && s.mode !== 'private' && !recentlySawOthers && Date.now() - s.createdAt > RHYTHM_MULTI_LOBBY_LISTEN_MS) {
      const other = rhythmMultiBestRoom(lobby.rooms, s.code);
      if (other && other < s.code) {
        api.join(other, { name: me.name, level: me.level, icon: me.icon, frame: me.frame, diff: me.diff }, s.mode);
      }
    }
  };
  const sweep = () => {
    if (!s) return;
    const me = selfMember();
    // 演奏中は、演奏の判定と描画に余計な仕事を割り込ませないよう、点検と画面更新を止める
    if (me && me.playing) return;
    const sig = ordered().map((m) => m.id).join(',');
    if (sig !== s.memberSig) { s.memberSig = sig; s.lastMemberChange = Date.now(); }
    selfTick();
    hostTick();
    if (s) syncLobby();
    emit();
  };
  const onMessage = (raw) => {
    if (!s) return;
    // 演奏中は、届いた知らせを処理せずに溜めておく(演奏の判定と描画に一切割り込ませない)。
    // 演奏が終わったら reportResult がまとめて処理する。溜めすぎないよう古いものから捨てる
    const playingNow = selfMember();
    if (playingNow && playingNow.playing) {
      s.queue.push(raw);
      if (s.queue.length > RHYTHM_MULTI_QUEUE_MAX) s.queue.shift();
      return;
    }
    const msg = rhythmMultiCleanMessage(raw);
    if (!msg) return;
    if (msg.t === 'bye') { delete s.members[msg.id]; emit(); return; }
    if (msg.t === 'chat') {
      // 同じ発言(cid)は2度出さない。覚えておくのは直近だけ(保存はしない)
      if (!s.chat.some((c) => c.cid === msg.cid)) {
        s.chat.push({ cid: msg.cid, id: msg.id, name: msg.name, text: msg.text, at: Date.now() });
        if (s.chat.length > RHYTHM_MULTI_CHAT_KEEP) s.chat.splice(0, s.chat.length - RHYTHM_MULTI_CHAT_KEEP);
      }
      emit();
      return;
    }
    const fromHost = () => { const o = ordered(); return o.length > 0 && o[0].id === msg.id; };
    const prev = s.members[msg.id] || { id: msg.id, name: '', level: 0, joinedAt: 0, icon: '', frame: '', pick: '', pickRound: '', readyRound: '', diff: '', playing: false, open: false, res: null };
    if (msg.t === 'hb') {
      // 自分の状態は自分が持っているものが正しいので、自分の知らせでは上書きしない
      if (msg.id === s.selfId) { prev.seen = Date.now(); emit(); return; }
      s.members[msg.id] = {
        ...prev, name: msg.name, level: msg.level, joinedAt: msg.joinedAt, icon: msg.icon, frame: msg.frame,
        pick: msg.pick, pickRound: msg.pickRound, readyRound: msg.readyRound, diff: msg.diff, playing: msg.playing,
        open: msg.open, res: msg.res || prev.res, seen: Date.now(),
      };
      // 部屋の進行は部屋主の知らせに従う(残り時間は受け取った時刻から数える)
      if (msg.room && fromHost()) {
        const r = msg.room;
        s.room = { phase: r.phase, round: r.round, songId: r.songId, participants: r.participants, deadline: r.hasDeadline ? Date.now() + r.left * 1000 : 0 };
      }
    } else if (msg.t === 'res') {
      s.members[msg.id] = { ...prev, res: msg.res, playing: false, seen: Date.now() };
    } else if (msg.t === 'draw') {
      if (fromHost() && s.room.round === msg.round) s.room = { ...s.room, phase: 'ready', songId: msg.songId, deadline: Date.now() + RHYTHM_MULTI_SHUFFLE_MS + RHYTHM_MULTI_READY_MS };
    } else if (msg.t === 'start') {
      // ライブ開始の合図は、部屋主から出たものだけ受ける。同じ合図は2度受けない
      if (fromHost() && s.startedRound !== msg.round) {
        s.startedRound = msg.round;
        s.room = { ...s.room, phase: 'playing', round: msg.round, songId: msg.songId, participants: msg.participants, deadline: 0 };
        // ライブに入った人は、ここから演奏が終わるまで何も送ってこない。抜けた扱いにしない期限を、曲の長さから決めておく
        const songMs = Number(durations[msg.songId]) > 0 ? Number(durations[msg.songId]) : 240000;
        s.playUntil = Date.now() + songMs + RHYTHM_MULTI_PLAY_GRACE_MS;
        msg.participants.forEach((pid) => { if (s.members[pid]) s.members[pid].playing = true; });
        const me = selfMember();
        if (me && msg.participants.includes(s.selfId)) {
          me.playing = true; me.res = null;
          startListeners.forEach((fn) => { try { fn({ round: msg.round, songId: msg.songId, count: msg.participants.length }); } catch (_) { /* 無視 */ } });
        }
        // 「ライブに入った」を1回だけ知らせて、そこからは演奏が終わるまで送らない
        sendHb(true);
      }
    }
    emit();
  };
  const connect = () => {
    if (!s) return;
    s.status = 'connecting';
    emit();
    socket = rhythmMultiOpenSocket({
      topic: RHYTHM_MULTI_ROOM_TOPIC + s.code,
      onOpen: () => { if (!s) return; s.status = 'open'; sendHb(); emit(); },
      onMessage,
      onClose: () => {
        if (!s) return;
        s.status = 'reconnecting';
        emit();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => { if (s) { if (socket) socket.close(); connect(); } }, 2500);
      },
    });
  };
  const api = {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onStart(fn) { startListeners.add(fn); return () => startListeners.delete(fn); },
    setCatalog(songIds, songDurations) {
      catalog = Array.isArray(songIds) ? songIds.slice() : [];
      durations = songDurations && typeof songDurations === 'object' ? { ...songDurations } : {};
    },
    // 画面へ見せる形に直して返す。毎回新しい値を返すので、呼ぶ側は emit のたびに作り直してよい
    view() {
      if (!s) return null;
      const all = rhythmMultiSortMembers(alive());
      const selfIndex = all.findIndex((m) => m.id === s.selfId);
      const r = s.room;
      return {
        code: s.code, mode: s.mode, status: s.status, selfId: s.selfId,
        members: all.slice(0, RHYTHM_MULTI_ROOM_MAX),
        hostId: all.length ? all[0].id : s.selfId,
        full: selfIndex >= RHYTHM_MULTI_ROOM_MAX,
        room: { ...r, left: r.deadline ? Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)) : 0 },
        shuffleShown: s.shuffleShown,
        resultSeen: s.resultSeen,
        chat: s.chat.slice(),
      };
    },
    join(code, profile, mode) {
      this.leave();
      const now = Date.now();
      const id = rhythmMultiMakeId();
      const roomMode = RHYTHM_MULTI_MODES.includes(mode) ? mode : 'private';
      s = {
        code, mode: roomMode, status: 'connecting', selfId: id, members: {}, chat: [], lastChatAt: 0, createdAt: now,
        room: { phase: 'matching', round: '', songId: '', deadline: 0, participants: [] },
        memberSig: '', lastMemberChange: now, startedRound: '', shuffleShown: '', resultSeen: '', queue: [], playUntil: 0,
      };
      s.members[id] = {
        id, name: rhythmMultiText(profile && profile.name, 12) || '名無しのブリーダー', level: rhythmMultiInt(profile && profile.level, 9999),
        icon: rhythmMultiText(profile && profile.icon, 60), frame: rhythmMultiText(profile && profile.frame, 40),
        joinedAt: now, pick: '', pickRound: '', readyRound: '', diff: rhythmMultiText(profile && profile.diff, 20), playing: false,
        // フリー/ベテランの部屋は、はじめから公開(空きがあるあいだ受付へ知らせる)。プライベートは「ルーム解放」を押したときだけ
        open: roomMode !== 'private', res: null, seen: now,
      };
      connect();
      // 演奏中は sendHb が何も送らない(演奏中の通信は止める)
      hbTimer = setInterval(() => sendHb(), RHYTHM_MULTI_HEARTBEAT_MS);
      sweepTimer = setInterval(sweep, 1000);
      emit();
    },
    leave() {
      if (socket) { try { socket.send({ t: 'bye', id: s && s.selfId }); } catch (_) { /* 無視 */ } socket.close(); }
      socket = null;
      closeLobby();
      stopTimers();
      s = null;
      emit();
    },
    // フリー/ベテランの部屋さがし。空きのある部屋のコードを返す(無ければ null)。呼ぶ側が見つからなければ自分で部屋を作る
    findRoom(kind) {
      return new Promise((resolve) => {
        const rooms = {};
        const sock = rhythmMultiOpenSocket({
          topic: RHYTHM_MULTI_LOBBY_TOPIC + (kind === 'veteran' ? 'veteran' : 'free'),
          onOpen: () => {},
          onMessage: (raw) => { const n = rhythmMultiCleanRoomNotice(raw); if (n) rooms[n.code] = { n: n.n, seen: Date.now() }; },
          onClose: () => {},
        });
        setTimeout(() => { sock.close(); resolve(rhythmMultiBestRoom(rooms, '')); }, RHYTHM_MULTI_LOBBY_LISTEN_MS);
      });
    },
    // 部屋主の「メンバー確定」(プライベートルーム)。2人以上いるときだけ
    confirmMembers() {
      if (!s || !isHostNow() || s.room.phase !== 'matching' || ordered().length < 2) return false;
      toSelect();
      return true;
    },
    // 選曲。曲の id か、おまかせ(RHYTHM_MULTI_OMAKASE)。抽選が始まるまでは選び直せる
    pick(songId) {
      const me = selfMember();
      if (!me || s.room.phase !== 'select') return;
      me.pick = songId === RHYTHM_MULTI_OMAKASE ? RHYTHM_MULTI_OMAKASE : rhythmMultiText(songId, 60);
      me.pickRound = s.room.round;
      sendHb(); emit();
    },
    setDiff(difficultyId) {
      const me = selfMember();
      if (!me) return;
      me.diff = rhythmMultiText(difficultyId, 20);
      sendHb(); emit();
    },
    // 準備完了(本家と同じく取り消しはできない)
    ready() {
      const me = selfMember();
      if (!me || s.room.phase !== 'ready') return;
      me.readyRound = s.room.round;
      sendHb(); emit();
    },
    // 「ルーム解放」。プライベートの部屋を、知らない人にも開く
    setOpen(open) {
      const me = selfMember();
      if (!me) return;
      me.open = open === true;
      sendHb(); syncLobby(); emit();
    },
    markShuffleShown(round) { if (s) { s.shuffleShown = round; emit(); } },
    // 結果画面の「次へ」。ホストが押したら、まだライブ中の人がいても待たずに次の選曲へ進める
    // (途中で抜けた人がいて先へ進めなくなる、を防ぐ。2026-10-03・ユーザー報告)
    nextFromResult(round) {
      if (!s) return;
      s.resultSeen = round;
      if (isHostNow() && (s.room.phase === 'result' || s.room.phase === 'playing') && s.room.round === round) toSelect();
      emit();
    },
    // ホストの「待たずに進む」。マッチング → 選曲 → シャッフル → ライブ開始 を、時間を待たずに1段進める
    hostAdvance() {
      if (!s || !isHostNow() || s.status !== 'open') return false;
      const members = ordered();
      const ph = s.room.phase;
      if (ph === 'matching') { if (members.length < 2) return false; toSelect(); return true; }
      if (ph === 'select') { doDraw(members); return true; }
      if (ph === 'ready') {
        // 自分がまだ準備完了でなければ、いまの難易度で準備完了にしてから始める
        const me = selfMember();
        if (me && me.readyRound !== s.room.round) me.readyRound = s.room.round;
        doStart(members, true);
        return true;
      }
      return false;
    },
    // 曲が終わった(または途中でやめた)ときに、自分のスコアを部屋へ知らせる。同じ回の2度目は無視する。
    // 途中でやめたことが公開ルームで起きたら、しばらく公開ルームへ入れなくする(opts.noPenalty で外せる)
    reportResult(round, result, quit, opts) {
      const me = selfMember();
      if (!me || !round) return;
      if (me.res && me.res.startId === round) return;
      me.res = rhythmMultiCleanResult({
        startId: round, score: result && result.score, maxCombo: result && result.maxCombo,
        cleared: result ? result.cleared !== false : false, quit: quit === true, diffId: opts && opts.diffId,
        fc: result && result.cleared !== false ? (result.allMarvelous ? 3 : result.allExcellent ? 2 : result.fullCombo ? 1 : 0) : 0,
        j: result && result.judgments ? RHYTHM_MULTI_JUDGMENT_IDS.map((id) => result.judgments[id]) : null,
        fs: result && result.fast, sl: result && result.slow,
      });
      me.playing = false;
      // 演奏中に溜めておいた知らせを、ここでまとめて処理する
      const queued = s.queue;
      s.queue = [];
      queued.forEach((raw) => onMessage(raw));
      if (!s) return;
      if (quit === true && !(opts && opts.noPenalty) && s.mode !== 'private') void rhythmMultiPenaltyMark();
      if (socket) socket.send({ t: 'res', id: s.selfId, res: me.res });
      sendHb(); emit();
    },
    // 部屋のチャット。自分の発言も部屋からの返りで表示する(=相手にも届いたと分かる)。続けて送るのは受けない
    sendChat(text) {
      if (!s || !socket) return false;
      const clean = rhythmMultiText(text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
      const me = selfMember();
      if (!clean || !me || Date.now() - s.lastChatAt < RHYTHM_MULTI_CHAT_INTERVAL_MS) return false;
      s.lastChatAt = Date.now();
      return socket.send({ t: 'chat', id: s.selfId, name: me.name, text: clean, cid: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` });
    },
    hasReported(round) { const me = selfMember(); return !!(me && me.res && me.res.startId === round); },
    // 自分が選んだ難易度(演奏の結果へ添える)
    myDiff() { const me = selfMember(); return me ? me.diff : ''; },
  };
  return api;
})();

const useRhythmMultiView = () => {
  const [view, setView] = React.useState(() => RHYTHM_MULTI.view());
  React.useEffect(() => {
    const refresh = () => setView(RHYTHM_MULTI.view());
    refresh();
    return RHYTHM_MULTI.subscribe(refresh);
  }, []);
  return view;
};

// 抽選された曲に、自分の希望の難易度が無いときは、希望より易しい中でいちばん難しいものへ(無ければ最も易しいもの)
const rhythmMultiPickDifficulty = (available, wishId, orderIds) => {
  if (!available.length) return null;
  const exact = available.find((d) => d.id === wishId);
  if (exact) return exact;
  const rank = (id) => orderIds.indexOf(id);
  const want = rank(wishId);
  const lower = available.filter((d) => rank(d.id) < want).sort((a, b) => rank(b.id) - rank(a.id));
  if (lower.length) return lower[0];
  return available.slice().sort((a, b) => rank(a.id) - rank(b.id))[0];
};

// ---- 画面 ----
// 部屋の中の状態は React の外(RHYTHM_MULTI)にあるので、画面を行き来しても部屋は切れない。
function RhythmMultiChatPanel({ view, phase = '', members = [], resolveIconUrl = null }) {
  const [chatText, setChatText] = React.useState('');
  const [waitNote, setWaitNote] = React.useState(false);
  const listRef = React.useRef(null);
  const count = view && view.chat ? view.chat.length : 0;
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  // 続けて押したときは「少し待ってね」を出す(送れなかったことが分からないと、何度も押してしまう)
  const send = (text) => {
    const ok = RHYTHM_MULTI.sendChat(text);
    setWaitNote(!ok && !!String(text || '').trim());
    return ok;
  };
  const submit = () => { if (send(chatText)) setChatText(''); };
  const memberOf = (id) => members.find((m) => m.id === id) || null;
  return (
    <section data-rhythm-multi-chat className="flex min-h-0 flex-col rounded-2xl border border-white/15 bg-slate-900/95 p-3">
      <h3 className="text-xs font-black text-slate-300">チャット</h3>
      {/* LINE のように、自分の発言は右、ほかの人は左(顔アイコンつき) */}
      <ul ref={listRef} data-rhythm-multi-chat-list className="mt-1 max-h-60 min-h-[5rem] space-y-1.5 overflow-y-auto rounded-lg bg-slate-950/60 p-2 text-sm font-bold landscape:max-h-[45vh]">
        {count === 0 && <li className="text-[11px] text-slate-500">まだ発言はありません。下の定型文をタップすると、すぐに送れます</li>}
        {view.chat.map((c) => {
          const mine = c.id === view.selfId;
          const m = memberOf(c.id);
          return (
            <li key={c.cid} data-rhythm-multi-chat-line className={`flex items-end gap-1.5 ${mine ? 'justify-end' : ''}`}>
              {!mine && (m
                ? <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-7 w-7 shrink-0" />
                : <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs">🎵</span>)}
              <span className={`flex min-w-0 max-w-[80%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && <b className="max-w-full truncate text-[10px] text-amber-200">{c.name}</b>}
                <span className={`break-words rounded-2xl px-2.5 py-1 leading-snug ${mine ? 'rounded-br-sm bg-cyan-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-900'}`}>{c.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <RhythmMultiStampBar phase={phase} onSend={send} className="mt-2" />
      {waitNote && <small data-rhythm-multi-chat-wait className="mt-1 block text-[10px] font-black text-amber-300">続けて送るときは、少し待ってね</small>}
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input data-rhythm-multi-chat-input value={chatText} maxLength={RHYTHM_MULTI_CHAT_MAX_LENGTH} autoComplete="off" enterKeyHint="send"
          onChange={(e) => setChatText(e.target.value)} placeholder={`ひとこと(${RHYTHM_MULTI_CHAT_MAX_LENGTH}文字まで)`}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-base font-bold text-white" />
        <button data-rhythm-multi-chat-send type="submit" disabled={!chatText.trim()} className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-4 text-sm font-black disabled:opacity-40">送信</button>
      </form>
    </section>
  );
}

// 定型文の帯。横にすべらせて選ぶ。画面ごとに合う文を先頭へ出す(rhythmMultiStampsFor)
function RhythmMultiStampBar({ phase, onSend, className = '', limit = 0 }) {
  const stamps = rhythmMultiStampsFor(phase);
  const shown = limit > 0 ? stamps.slice(0, limit) : stamps;
  return (
    <div data-rhythm-multi-stamps className={`flex gap-1.5 overflow-x-auto pb-0.5 ${className}`} style={{ scrollbarWidth: 'none' }}>
      {shown.map((stamp) => (
        <button key={stamp} data-rhythm-multi-chat-stamp type="button" onClick={() => onSend(stamp)}
          className="min-h-[38px] shrink-0 whitespace-nowrap rounded-full border border-white/15 bg-slate-700 px-3 text-xs font-black active:scale-95">{stamp}</button>
      ))}
    </div>
  );
}

// カードの上の吹き出し(発言してから少しのあいだだけ)
function RhythmMultiChatBubble({ text }) {
  if (!text) return null;
  return (
    <span data-rhythm-multi-chat-bubble className="pointer-events-none absolute inset-x-0.5 top-3 z-20 flex justify-center">
      <span className="line-clamp-2 max-w-full break-words rounded-xl bg-white px-1.5 py-0.5 text-center text-[10px] font-black leading-tight text-slate-900 shadow-lg landscape:text-xs">{text}</span>
    </span>
  );
}

// 参加者の顔。名前の横に、ブリーダーのアイコン(プロフィールフレーム付き)を出す
function RhythmMultiAvatar({ m, resolveIconUrl, sizeClass = 'h-10 w-10' }) {
  const src = resolveIconUrl ? resolveIconUrl(m.icon) : null;
  return (
    <ProfileAvatar src={src} id={m.icon} frameId={m.frame} alt="" className={sizeClass}
      fallback={<span aria-hidden="true" className="flex h-full w-full items-center justify-center bg-slate-800 text-lg">🎵</span>} />
  );
}

// 本家の上に並ぶ5人のカード。空いている枠も点線で見せる(何人で遊んでいるかがひと目で分かる)。
// size="tall" はマッチング・準備・待機の画面で、空いている高さいっぱいに大きく出す(横画面では画面の上半分以上)。
// size="strip" は曲えらびの上の細い帯。曲の一覧を狭めないよう、横画面ではアイコンと名前を横並びにして低くする
function RhythmMultiMemberCards({ members, hostId, selfId, resolveIconUrl, badgeOf, size = 'tall', bubbleOf = null }) {
  const tall = size === 'tall';
  return (
    <ul data-rhythm-multi-cards className={tall
      ? 'grid min-h-[120px] max-h-[230px] flex-1 grid-cols-5 gap-1.5 bg-slate-900/40 px-2 pb-2 pt-3 landscape:max-h-none landscape:gap-2 landscape:px-3'
      : 'grid shrink-0 grid-cols-5 gap-1 border-b border-white/10 bg-slate-900/70 px-1.5 pb-1 pt-2 landscape:pt-1.5'}>
      {Array.from({ length: RHYTHM_MULTI_ROOM_MAX }).map((_, i) => {
        const m = members[i];
        if (!m) return <li key={i} className={`flex items-center justify-center rounded-xl border border-dashed border-white/10 text-[10px] font-black text-slate-600 ${tall ? '' : 'h-[60px] landscape:h-[38px]'}`}>募集中</li>;
        const badge = badgeOf(m);
        const self = m.id === selfId;
        return (
          <li key={m.id} data-rhythm-multi-member className={`relative flex min-h-0 min-w-0 rounded-xl ${self ? 'border border-cyan-300/70 bg-cyan-950/50' : 'border border-white/10 bg-slate-950/70'} ${tall
            ? 'flex-col items-center justify-center px-1 pb-1.5 pt-3'
            : 'h-[60px] flex-col items-center px-0.5 pt-1.5 landscape:h-[38px] landscape:flex-row landscape:gap-1 landscape:px-1 landscape:pt-0'}`}>
            <RhythmMultiChatBubble text={bubbleOf ? bubbleOf(m.id) : ''} />
            <small data-rhythm-multi-member-badge className={`absolute -top-1.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-black leading-tight ${badge.cls}`}>{badge.text}</small>
            <span className="relative shrink-0">
              <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass={tall ? 'h-12 w-12 landscape:h-16 landscape:w-16' : 'h-7 w-7'} />
              {m.id === hostId && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 text-[11px]">👑</span>}
            </span>
            <span className={`min-w-0 ${tall ? 'mt-1 w-full text-center' : 'mt-0.5 w-full text-center landscape:mt-0 landscape:flex-1 landscape:text-left'}`}>
              <span className={`block truncate font-black leading-tight ${tall ? 'text-[11px] landscape:text-sm' : 'text-[10px]'}`}>{m.name}{self ? '*' : ''}</span>
              {badge.sub && <small className={`block truncate font-bold leading-tight text-slate-400 ${tall ? 'text-[9px] landscape:text-[11px]' : 'text-[8px]'}`}>{badge.sub}</small>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const RHYTHM_MULTI_FC_LABELS = Object.freeze(['', 'FULL COMBO!', 'ALL EXCELLENT!', 'ALL MARVELOUS!']);

// songs / difficultiesOf / difficultyList は曲えらびと同じ一覧(rhythmDemoSongs など)。
// onStartPlay は演奏画面へ入る処理を親が持つ。bestRecords は難易度の鍵(解放)の判定に使う
function RhythmMultiScreen({ profile, songs, difficultiesOf, difficultyList, bestRecords, resolveIconUrl, quickRunInfo = null, onPreviewSong = null, onUserGesture = null, multiLightLook = true, onToggleLightLook = null, onBack, onStartPlay, modeSelect = null, onRoomEntered = null }) {
  const view = useRhythmMultiView();
  const difficultyIds = difficultyList.map((d) => d.id);
  const songIds = songs.map((song) => song.songId);
  React.useEffect(() => {
    const lengths = {};
    songs.forEach((song) => { const ms = Number(song.playDurationMs); if (ms > 0) lengths[song.songId] = ms; });
    RHYTHM_MULTI.setCatalog(songIds, lengths);
  }, [songIds.join(',')]);
  const [codeInput, setCodeInput] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [searching, setSearching] = React.useState(null);
  const [countdown, setCountdown] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  // 未読の数(チャットを閉じているあいだに届いた、ほかの人の発言)。開いたら既読にする
  const [chatSeenAt, setChatSeenAt] = React.useState(() => Date.now());
  const chatList = view && view.chat ? view.chat : [];
  const lastChatAt = chatList.length ? chatList[chatList.length - 1].at || 0 : 0;
  React.useEffect(() => { if (chatOpen) setChatSeenAt(Math.max(Date.now(), lastChatAt)); }, [chatOpen, lastChatAt]);
  const chatUnread = chatOpen ? 0 : chatList.filter((c) => c.id !== (view && view.selfId) && (c.at || 0) > chatSeenAt).length;
  // 吹き出しは時間が来たら消す。新しい発言が来るたびに、消す時刻で1回だけ描き直す
  const [, setBubbleTick] = React.useState(0);
  React.useEffect(() => {
    if (!lastChatAt) return undefined;
    const wait = lastChatAt + RHYTHM_MULTI_CHAT_BUBBLE_MS - Date.now();
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setBubbleTick((n) => n + 1), wait + 50);
    return () => clearTimeout(timer);
  }, [lastChatAt]);
  const chatBubbleOf = (id) => {
    const now = Date.now();
    for (let k = chatList.length - 1; k >= 0; k--) {
      const c = chatList[k];
      if (now - (c.at || 0) > RHYTHM_MULTI_CHAT_BUBBLE_MS) return '';
      if (c.id === id) return c.text;
    }
    return '';
  };
  const [statsOpen, setStatsOpen] = React.useState(false);
  const mine = view ? view.members.find((m) => m.id === view.selfId) : null;
  const [selSongId, setSelSongId] = React.useState(mine && mine.pick && mine.pick !== RHYTHM_MULTI_OMAKASE ? mine.pick : '');
  const [selectView, setSelectView] = React.useState(null);
  const songById = (songId) => songs.find((song) => song.songId === songId) || null;
  const defaultDiff = difficultyIds.includes('NORMAL') ? 'NORMAL' : difficultyIds[0] || '';
  const me = mine;
  const isHost = !!view && view.hostId === view.selfId;
  const room = view ? view.room : null;
  const myDiffId = me && me.diff ? me.diff : defaultDiff;
  // 抽選された曲で、自分が遊べる難易度(ソロと同じく、鍵の掛かった難易度は選べない)
  const drawnSong = room && room.songId ? songById(room.songId) : null;
  const drawnDiffs = drawnSong ? difficultiesOf(drawnSong) : [];
  const drawnOpenDiffs = drawnSong ? drawnDiffs.filter((d) => rhythmDifficultyUnlocked(drawnSong.songId, d.id, bestRecords)) : [];
  const pickPlayDifficulty = () => rhythmMultiPickDifficulty(drawnOpenDiffs.length ? drawnOpenDiffs : drawnDiffs, RHYTHM_MULTI.myDiff() || defaultDiff, difficultyIds);

  // ---- フレンド(公開前はすべて動かない) ----
  // 招待は Supabase の friend_invites へ書く。受ける側は、ルームに入っていないあいだだけ数秒ごとに読む。
  // 出すのは「承認済みのフレンド」からの3分以内の招待だけ。保存データ・ランキングには触れない
  const friendsOn = RELEASE_FLAGS.friends === true;
  const [friendSelfId, setFriendSelfId] = React.useState('');
  const [roster, setRoster] = React.useState(null);        // フレンド名簿(承認済みのみ)。null=まだ読んでいない
  const [friendInvites, setFriendInvites] = React.useState([]);
  const [invitePanel, setInvitePanel] = React.useState(false);
  const [invitedIds, setInvitedIds] = React.useState({});
  const [inviteMessage, setInviteMessage] = React.useState('');
  const loadRoster = React.useCallback(async (id) => {
    try { setRoster(await sbFetchFriendRoster(id)); } catch (_) { setRoster([]); }
  }, []);
  React.useEffect(() => {
    if (!friendsOn) return undefined;
    let cancelled = false;
    (async () => {
      const id = await ensureBreederId();
      if (cancelled || !id) return;
      setFriendSelfId(id);
      await loadRoster(id);
    })();
    return () => { cancelled = true; };
  }, [friendsOn]);
  const hasRoster = !!(roster && roster.length);
  React.useEffect(() => {
    if (!friendsOn || view || !friendSelfId || !hasRoster) { setFriendInvites([]); return undefined; }
    let cancelled = false;
    const ids = new Set(roster.map((friend) => friend.otherId));
    const poll = async () => {
      try {
        const list = await sbFetchRoomInvites(friendSelfId, Date.now());
        if (!cancelled) setFriendInvites(list.filter((invite) => ids.has(invite.senderId)));
      } catch (_) { /* 通信できないときは、次の確認まで何も出さない */ }
    };
    poll();
    const timer = setInterval(poll, FRIEND_INVITE_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [friendsOn, !!view, friendSelfId, roster]);
  const friendNameOf = (id) => ((roster || []).find((friend) => friend.otherId === id) || {}).userName || 'フレンド';
  const openInvitePanel = () => {
    const next = !invitePanel;
    setInvitePanel(next);
    setInviteMessage('');
    if (next && friendSelfId) loadRoster(friendSelfId);   // 直前に承認したフレンドも出せるよう、開くたびに読み直す
  };
  const inviteFriend = async (friendId) => {
    if (!view || !friendSelfId) return;
    const result = await sbSendRoomInvite(friendSelfId, friendId, view.code);
    if (result === 'invited') { setInvitedIds((prev) => ({ ...prev, [friendId]: true })); setInviteMessage(''); }
    else setInviteMessage(result === 'notready' ? 'フレンド機能はただいま準備中です' : '招待を送れませんでした。もう一度ためしてください');
  };

  // ライブ開始の合図が来たら 3・2・1 を数えて演奏へ入る。数えるのは受け取った時刻から(端末の時計のずれに左右されない)
  React.useEffect(() => RHYTHM_MULTI.onStart((info) => {
    setCountdown({ info, left: RHYTHM_MULTI_START_COUNTDOWN_SEC });
    setChatOpen(false);
  }), []);
  React.useEffect(() => {
    if (!countdown) return undefined;
    if (countdown.left <= 0) {
      const song = songById(countdown.info.songId);
      const diffs = song ? difficultiesOf(song) : [];
      const open = song ? diffs.filter((d) => rhythmDifficultyUnlocked(song.songId, d.id, bestRecords)) : [];
      const diff = song ? rhythmMultiPickDifficulty(open.length ? open : diffs, RHYTHM_MULTI.myDiff() || defaultDiff, difficultyIds) : null;
      setCountdown(null);
      if (song && diff) onStartPlay(song, diff, countdown.info.round, countdown.info.count);
      else RHYTHM_MULTI.reportResult(countdown.info.round, null, true, { noPenalty: true });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ? { ...c, left: c.left - 1 } : c)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // MUSIC SHUFFLE: 全員の選曲を早送りで回し、最後に決まった曲で止める(本家の演出を参考)
  const shuffleRound = room && room.phase === 'ready' && view.shuffleShown !== room.round ? room.round : '';
  const [shuffleIndex, setShuffleIndex] = React.useState(0);
  const [shuffleStopped, setShuffleStopped] = React.useState(false);
  React.useEffect(() => {
    if (!shuffleRound) return undefined;
    setShuffleStopped(false);
    const tick = setInterval(() => setShuffleIndex((n) => n + 1), 110);
    const stop = setTimeout(() => { clearInterval(tick); setShuffleStopped(true); }, RHYTHM_MULTI_SHUFFLE_MS - 800);
    const done = setTimeout(() => RHYTHM_MULTI.markShuffleShown(shuffleRound), RHYTHM_MULTI_SHUFFLE_MS);
    return () => { clearInterval(tick); clearTimeout(stop); clearTimeout(done); };
  }, [shuffleRound]);

  // 曲の試聴(本体が鳴らす)へ、いま鳴らしたい曲を知らせる。
  //   選曲中 … 曲えらびで見ている曲(まだ触っていなければ一覧の先頭)
  //   シャッフル・難易度選択・ライブの直前 … 決まった曲
  //   それ以外 … '' (本体はソロで選んでいた曲を鳴らし続ける)
  const previewPhase = room ? room.phase : '';
  // シャッフルの演出中は、まだ答えを鳴らさない(選曲中の曲のまま)
  const selectPreviewId = selSongId || (songs[0] ? songs[0].songId : '');
  // 曲が決まった瞬間(シャッフルの始まり)から、決まった曲を流す。ライブが始まるまで切り替えない
  // (2026-10-03・ユーザー報告「難易度設定で音が一回なくなって最初からになる」「一瞬モンスターヒーローが流れる」)
  const previewId = previewPhase === 'select' ? selectPreviewId
    : (previewPhase === 'ready' || previewPhase === 'playing') && room.songId ? room.songId : '';
  React.useEffect(() => { if (onPreviewSong) onPreviewSong(previewId); }, [previewId]);

  const myProfile = () => ({ name: profile.name, level: profile.level, icon: profile.icon, frame: profile.frame, diff: defaultDiff });
  const createPrivate = () => { setMessage(''); RHYTHM_MULTI.join(rhythmMultiMakeCode(), myProfile(), 'private'); };
  const joinFromInvite = (invite) => {
    setMessage('');
    RHYTHM_MULTI.join(invite.roomCode, myProfile(), 'private');
  };
  const joinPrivate = () => {
    const code = rhythmMultiNormalizeCode(codeInput);
    if (!code) { setMessage(`部屋コードは${RHYTHM_MULTI_CODE_LENGTH}文字です`); return; }
    setMessage('');
    RHYTHM_MULTI.join(code, myProfile(), 'private');
  };
  // フリー: 空きのある部屋を探して入る(ベテランは2026-10-03に画面から外した。部屋さがしの仕組みは残してある)。無ければ自分で部屋を作って、人が来るのを待つ
  const searchRoom = async (kind) => {
    setMessage('');
    const left = await rhythmMultiPenaltyLeftMs();
    if (left > 0) { setMessage(`途中でやめたため、あと${Math.ceil(left / 60000)}分は公開ルームに入れません`); return; }
    setSearching(kind);
  };
  React.useEffect(() => {
    if (!searching) return undefined;
    let alive = true;
    RHYTHM_MULTI.findRoom(searching).then((code) => {
      if (!alive) return;
      RHYTHM_MULTI.join(code || rhythmMultiMakeCode(), myProfile(), searching);
      setSearching(null);
    });
    return () => { alive = false; };
  }, [searching]);
  const leaveRoom = () => { RHYTHM_MULTI.leave(); setCountdown(null); setChatOpen(false); setSearching(null); };
  // モードえらび(modeSelect あり)で部屋に入れたら、対戦の画面(RHYTHM_MULTI)へ移る。
  // 対戦の画面で部屋が無くなったら(出た・満員で抜けた)、モードえらびへ戻る
  const inRoom = !!view;
  React.useEffect(() => {
    if (modeSelect) { if (inRoom && onRoomEntered) onRoomEntered(); return; }
    if (!inRoom && !searching && onBack) onBack();
  }, [inRoom, !!searching]);
  const shareCode = async () => {
    if (!view) return;
    const text = `モンヒロビートで協力ライブしよう! 部屋コード: ${view.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* 共有をやめたときは何もしない */ }
  };

  const card = 'rounded-2xl border border-white/15 bg-slate-900/85 p-3';
  const btn = 'min-h-[48px] rounded-xl px-3 font-black disabled:opacity-40';
  const shell = 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white';
  // 本家の左上の題字(MULTI LIVE)と、その下の小さな段の名前。右に残り時間とチャット
  const header = (step, onBackClick, opts = {}) => (
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-2 py-1" style={{ paddingTop: 'calc(0.25rem + var(--mh-sa-top))' }}>
      <button data-rhythm-multi-back type="button" aria-label="戻る" className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-lg font-black text-slate-300" onClick={onBackClick}>←</button>
      <div className="min-w-0 flex-1 leading-none">
        <b className="block truncate text-base font-black italic tracking-wider text-cyan-200">MULTI LIVE</b>
        <small className="mt-0.5 block truncate text-[10px] font-black text-fuchsia-200">▶ {step}{view ? ` ・ ${view.mode === 'private' ? '友だち' : RHYTHM_MULTI_MODE_LABELS[view.mode]} ${view.code}` : ''}</small>
      </div>
      {/* クイック∞周回を裏で回しているときの進み具合(曲えらびの帯と同じ中身)。対戦の待ち時間も周回は進む */}
      {quickRunInfo && <small data-rhythm-multi-quick-run className={`max-w-[38%] shrink truncate rounded-full border px-2 py-1 text-[10px] font-black ${quickRunInfo.finished ? 'border-amber-300/50 text-amber-200' : 'border-fuchsia-400/40 text-fuchsia-100'}`}>
        {quickRunInfo.finished ? quickRunInfo.reason : `🔁 WAVE ${quickRunInfo.wave}/10・${quickRunInfo.loops}周目${quickRunInfo.catchingUp ? '・追いつき中' : ''}`}
      </small>}
      {/* ホストだけの「待たずに進む」(2026-10-03・ユーザー指示「時間を待たずに先に進めるボタンもほしい」) */}
      {opts.advance && isHost && <button data-rhythm-multi-advance type="button" onClick={() => { if (opts.gesture && onUserGesture) onUserGesture(); RHYTHM_MULTI.hostAdvance(); }}
        className="min-h-[40px] shrink-0 rounded-xl bg-fuchsia-700 px-2 text-[11px] font-black">{opts.advance}</button>}
      {opts.timer != null && <b data-rhythm-multi-timer className={`shrink-0 rounded-full px-2 py-1 text-sm font-black tabular-nums ${opts.timer <= 5 ? 'bg-rose-600 text-white' : 'bg-slate-800 text-amber-200'}`}>⏱ {opts.timer}</b>}
      {/* 縦⇄横の切り替え(曲えらびと同じボタン。2026-10-03・ユーザー報告「縦横が変えられない」) */}
      <RhythmOrientationButton/>
      {view && chatButton()}
    </header>
  );
  // 💬 ボタン。閉じているあいだに届いた発言の数を赤い丸で出す
  const chatButton = (extra = '') => (
    <button data-rhythm-multi-chat-open type="button" aria-label={chatUnread ? `チャット(未読${chatUnread}件)` : 'チャット'} onClick={() => setChatOpen((v) => !v)}
      className={`relative min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-lg ${extra}`}>
      💬
      {chatUnread > 0 && <b data-rhythm-multi-chat-unread className="absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-rose-500 px-1 text-[11px] font-black leading-5 text-white">{chatUnread > 9 ? '9+' : chatUnread}</b>}
    </button>
  );
  const chatSheet = chatOpen && view && (
    <div data-rhythm-multi-chat-sheet className="absolute inset-x-0 bottom-0 z-[80000] max-h-[70%] overflow-y-auto border-t border-cyan-400/30 bg-slate-950 p-2 landscape:inset-y-0 landscape:left-auto landscape:right-0 landscape:max-h-none landscape:w-[46%] landscape:border-l landscape:border-t-0" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
      <RhythmMultiChatPanel view={view} phase={room ? room.phase : ''} members={view.members} resolveIconUrl={resolveIconUrl} />
      <button type="button" className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 font-black" onClick={() => setChatOpen(false)}>閉じる</button>
    </div>
  );
  const countdownLayer = countdown && (
    <div data-rhythm-multi-countdown className="absolute inset-0 z-[90000] flex flex-col items-center justify-center bg-slate-950/90">
      <small className="text-[11px] font-black tracking-widest text-slate-400">LIVE START</small>
      <p className="px-4 text-center text-base font-black text-cyan-200">{songById(countdown.info.songId) ? rhythmSongFullName(songById(countdown.info.songId)) : ''}</p>
      <b className="text-8xl font-black text-white">{Math.max(1, countdown.left)}</b>
    </div>
  );

  // ①モードえらび(2026-10-03・ユーザー指示「モンビーを始めたときにまずモード選択画面」「ソロモード、マルチモード、
  // マスモン選択などいれられる場所を作る」「マルチのベテランはなくしていい」。参考はプロセカの SELECT ROOM)。
  // ここは RHYTHM_MODE_SELECT の画面として描く(modeSelect を受け取ったとき)。部屋に入ったら onRoomEntered で
  // RHYTHM_MULTI へ移る。RHYTHM_MULTI で部屋を出たら(view が無くなったら)モードえらびへ戻す(下の useEffect)。
  // 横画面(推奨)では左に助手の立ち絵とひとこと、右に遊び方のボタンを並べる
  if (!view && !searching && modeSelect) {
    const ms = modeSelect;
    const tile = 'flex min-h-[48px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 leading-none';
    return (
      <main data-rhythm-mode-select data-rhythm-multi-step="rooms" className={`${shell} bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950`}>
        <header className="z-10 flex shrink-0 items-center gap-1.5 border-b border-cyan-400/15 bg-slate-950/90 px-2 py-1" style={{ paddingTop: 'calc(0.25rem + var(--mh-sa-top))' }}>
          {/* 戻るとHOMEへ。裏でクイック∞周回が回っているときは、締めてから戻る(曲えらびにあった戻るボタンの役目をここへ移した) */}
          <button data-rhythm-back data-quick-run-finishing={ms.backgroundRun ? '1' : undefined} data-quick-run-exiting={ms.exiting ? '1' : undefined} disabled={!!ms.exiting}
            type="button" aria-label={ms.exiting ? '周回を終えています' : ms.backgroundRun ? '周回を終えてホームへ戻る' : '戻る'} onClick={ms.onExit}
            className={`min-h-[44px] min-w-[44px] shrink-0 rounded-xl font-black ${ms.exiting ? 'text-amber-300/60' : ms.backgroundRun ? 'text-amber-200' : 'text-lg text-slate-300'}`}>
            {ms.backgroundRun ? <span className="text-[10px] leading-tight">⏹<br />終了</span> : '←'}
          </button>
          <div className="min-w-0 flex-1 leading-none">
            <small className="block truncate text-[8px] font-black tracking-[0.2em] text-fuchsia-300">MONBEAT ・ SELECT MODE</small>
            <b className="block truncate text-base font-black tracking-wider text-cyan-200">モードえらび</b>
            {ms.beatPointText && <small data-rhythm-beat-point-balance className="block truncate text-[9px] font-black text-violet-200/90">{ms.beatPointText}</small>}
          </div>
          {quickRunInfo && <small data-rhythm-multi-quick-run className={`max-w-[42%] shrink truncate rounded-full border px-2 py-1 text-[10px] font-black ${quickRunInfo.finished ? 'border-amber-300/50 text-amber-200' : 'border-fuchsia-400/40 text-fuchsia-100'}`}>
            {quickRunInfo.finished ? quickRunInfo.reason : `🔁 WAVE ${quickRunInfo.wave}/10・${quickRunInfo.loops}周目${quickRunInfo.catchingUp ? '・追いつき中' : ''}`}
          </small>}
          <RhythmOrientationButton/>
        </header>
        {ms.exiting && <div data-quick-run-exit-overlay className="absolute inset-0 z-[90000] flex items-center justify-center bg-slate-950/60 px-6 text-center"><b className="text-sm font-black text-amber-200">周回を終えています…</b></div>}
        {/* 縦画面: 上に助手の立ち絵(余った高さを使って大きく)、下にボタン。
            横画面: 左に立ち絵、右にボタン(2026-10-03・ユーザー指摘「サイズ感悪い」で組み直し) */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto landscape:flex-row landscape:overflow-hidden">
          {ms.assistant && (
            <div data-rhythm-mode-assistant className="relative mx-3 mt-3 min-h-[150px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-fuchsia-950/40 to-indigo-950/60 landscape:m-0 landscape:w-[32%] landscape:flex-none landscape:rounded-none landscape:border-0 landscape:bg-none">
              <img src={ms.assistant.image} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[50%_22%] landscape:object-[50%_30%]" />
              <p data-rhythm-mode-assistant-line className="absolute inset-x-2 bottom-2 rounded-2xl border-2 bg-slate-900/95 px-3 py-2 text-[13px] font-bold leading-snug text-white shadow-lg landscape:bottom-3 landscape:text-[12px]" style={{ borderColor: ms.assistant.accent }}>
                <b className="mb-0.5 block text-[10px]" style={{ color: ms.assistant.accent }}>{ms.assistant.name}</b>{ms.assistant.text}
              </p>
            </div>
          )}
          <div className="shrink-0 space-y-2.5 p-3 landscape:flex landscape:min-h-0 landscape:flex-1 landscape:shrink landscape:flex-col landscape:justify-center landscape:space-y-2.5 landscape:overflow-y-auto landscape:py-2">
            {friendsOn && friendInvites.length > 0 && (
              <section data-rhythm-multi-friend-invites className={`${card} space-y-2 border-pink-400/60`}>
                <h3 className="text-xs font-black text-pink-200">フレンドからの招待</h3>
                {friendInvites.map((invite) => (
                  <div key={invite.senderId} className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5">
                    <span className="min-w-0 flex-1 break-words text-[13px] font-black leading-snug">{friendNameOf(invite.senderId)}さんが部屋に誘っています</span>
                    <button data-rhythm-multi-friend-join type="button" className={`${btn} shrink-0 bg-pink-700 text-xs`} onClick={() => joinFromInvite(invite)}>参加する</button>
                  </div>
                ))}
              </section>
            )}
            <div className={`grid gap-2 ${ms.multi ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {/* ソロ: いつもの曲えらびへ */}
              <button data-rhythm-mode-solo type="button" onClick={ms.onSolo}
                className="flex min-h-[88px] min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border-2 border-amber-200/80 bg-gradient-to-br from-amber-300 to-yellow-400 px-3 text-left text-slate-950 shadow-lg active:scale-[.98] landscape:min-h-[72px] landscape:flex-row landscape:items-center landscape:gap-2">
                <span aria-hidden="true" className="text-2xl leading-none">🎵</span>
                <span className="min-w-0"><b className="block text-[17px] font-black leading-tight">ソロライブ</b><small className="block text-[10px] font-black leading-tight text-slate-800/80">ひとりで好きな曲を演奏</small></span>
              </button>
              {/* マルチ: フリーマッチ(だれとでも)。ベテランは無くした(2026-10-03・ユーザー指示) */}
              {ms.multi && <button data-rhythm-multi-free type="button" onClick={() => searchRoom('free')}
                className="flex min-h-[88px] min-w-0 flex-col items-start justify-center gap-1 rounded-2xl border-2 border-orange-200/80 bg-gradient-to-br from-orange-400 to-amber-500 px-3 text-left text-slate-950 shadow-lg active:scale-[.98] landscape:min-h-[72px] landscape:flex-row landscape:items-center landscape:gap-2">
                <span aria-hidden="true" className="text-2xl leading-none">🎮</span>
                <span className="min-w-0"><b className="block text-[17px] font-black leading-tight">フリーマッチ</b><small className="block text-[10px] font-black leading-tight text-slate-900/80">だれとでも最大{RHYTHM_MULTI_ROOM_MAX}人で協力</small></span>
              </button>}
            </div>
            {ms.multi && (
              <section data-rhythm-mode-private className="min-w-0 rounded-2xl border border-white/15 bg-slate-900/85 p-2.5">
                <h3 className="mb-1.5 text-[11px] font-black text-slate-300">プライベートルーム(友だちと遊ぶ)</h3>
                <div className="flex min-w-0 gap-2">
                  <button data-rhythm-multi-create type="button" className="min-h-[46px] shrink-0 rounded-xl bg-indigo-700 px-3 text-sm font-black" onClick={createPrivate}>＋ 作成</button>
                  <input id="rhythm-multi-code" data-rhythm-multi-code-input aria-label="ルームコード" value={codeInput} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                    className="min-h-[46px] w-0 min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-1 text-center text-base font-black tracking-[0.25em] text-white" placeholder="ABCD" />
                  <button data-rhythm-multi-join type="button" className="min-h-[46px] shrink-0 rounded-xl bg-indigo-700 px-3 text-sm font-black" onClick={joinPrivate}>入室</button>
                </div>
              </section>
            )}
            {message && <p data-rhythm-multi-message className="text-[12px] font-black text-rose-300">{message}</p>}
            {/* マスモン・遊びかた・オプション(曲えらびの上の帯から、マスモンと遊びかたをここへ移した) */}
            <div className="grid grid-cols-3 gap-2">
              <button data-rhythm-demo-monsters type="button" aria-label={`マスモン設定(${ms.monsterCount}/${ms.monsterMax}体)`} onClick={ms.onMonsters} className={`${tile} min-w-0 border-fuchsia-400/50 bg-fuchsia-950/50 text-fuchsia-100`}>
                <span data-rhythm-demo-monsters-faces aria-hidden="true" className="flex h-6 items-center">{ms.monsterFaces.length
                  ? ms.monsterFaces.map((face, i) => <span key={face.id} className="h-6 w-6 shrink-0 overflow-hidden rounded-full border border-fuchsia-200/70 bg-slate-950" style={i ? { marginLeft: '-7px' } : undefined}>{face.src && <img src={face.src} alt="" draggable={false} className="h-full w-full object-cover" />}</span>)
                  : <span className="text-lg leading-none">👾</span>}</span>
                <span className="text-[11px] font-black">マスモン {ms.monsterCount}/{ms.monsterMax}</span>
              </button>
              <button data-rhythm-demo-help type="button" onClick={ms.onHelp} className={`${tile} min-w-0 border-amber-400/50 bg-amber-950/40 text-amber-100`}>
                <span aria-hidden="true" className="text-lg leading-none">📖</span><span className="text-[11px] font-black">遊びかた</span>
              </button>
              <button data-rhythm-mode-options type="button" onClick={ms.onOptions} className={`${tile} min-w-0 border-cyan-400/50 bg-cyan-950/40 text-cyan-100`}>
                <span aria-hidden="true" className="text-lg leading-none">⚙️</span><span className="text-[11px] font-black">オプション</span>
              </button>
            </div>
          </div>
        </div>
        <div aria-hidden="true" className="shrink-0" style={{ height: 'var(--mh-sa-bottom)' }} />
      </main>
    );
  }
  // RHYTHM_MULTI で部屋にいない(出た・閉じられた)ときは、すぐモードえらびへ戻す(下の useEffect が戻す。そのあいだは空の画面)
  if (!view && !searching) return <main data-rhythm-multi data-rhythm-multi-step="leaving" className={shell} />;

  const members = view ? view.members : [];
  const phase = room ? room.phase : 'matching';
  const participant = !!room && room.participants.includes(view.selfId);
  const team = room && room.round && (phase === 'playing' || phase === 'result') ? rhythmMultiTeamResult(members, room.round, room.participants, phase === 'result') : null;
  // 結果を見せる: 自分が参加したライブで、だれかが終わっていて、まだ「次へ」を押していないとき
  const showResult = !!team && participant && view.resultSeen !== room.round && (phase === 'result' || (me && me.res && me.res.startId === room.round));

  // ②マッチング。上半分に5人のカード、下に部屋の情報とボタン(横画面では左右に並べる)
  if (!view || view.full || (phase === 'matching' && !countdown)) {
    const publicRoom = !!view && view.mode !== 'private';
    return (
      <main data-rhythm-multi data-rhythm-multi-step="matching" className={shell}>
        {header('マッチング', leaveRoom)}
        {view && view.full
          ? <div className="min-h-0 flex-1 overflow-y-auto p-3"><section data-rhythm-multi-full className={card}>
            <p className="text-sm font-black text-rose-300">このルームは満員です(最大{RHYTHM_MULTI_ROOM_MAX}人)</p>
            <button type="button" className={`${btn} mt-2 w-full bg-slate-700`} onClick={leaveRoom}>モードえらびへ戻る</button>
          </section></div>
          : <>
            <RhythmMultiMemberCards bubbleOf={chatBubbleOf} members={members} hostId={view ? view.hostId : ''} selfId={view ? view.selfId : ''} resolveIconUrl={resolveIconUrl} size="tall"
              badgeOf={(m) => ({ text: view && m.id === view.hostId ? 'ホスト' : '入室', cls: view && m.id === view.hostId ? 'bg-amber-400 text-slate-950' : 'bg-cyan-500 text-slate-950', sub: `Lv.${m.level}` })} />
            <div className="mt-auto max-h-[52%] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-950/90 p-2 landscape:grid landscape:max-h-[58%] landscape:grid-cols-2 landscape:gap-2" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
              <section data-rhythm-multi-matching className="rounded-2xl border border-white/15 bg-slate-900/85 p-2">
                <p className="animate-pulse text-sm font-black text-amber-200">{!view ? `${RHYTHM_MULTI_MODE_LABELS[searching]}ルームをさがしています…` : 'メンバーを待っています…'}</p>
                <p className="mt-0.5 text-[10px] font-bold leading-snug text-slate-400">
                  {!view ? '' : publicRoom ? `${RHYTHM_MULTI_ROOM_MAX}人そろうか、2人以上でしばらく待つとメンバーが確定します` : isHost ? '2人以上そろったら「メンバー確定」を押してください' : 'ホストがメンバーを確定するのを待っています'}
                </p>
                {view && <div className="mt-1 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <small className="block text-[9px] font-black text-slate-400">ルームコード</small>
                    <b data-rhythm-multi-room-code className="block text-2xl font-black leading-none tracking-[0.3em] text-cyan-200">{view.code}</b>
                    {view.status !== 'open' && <small className="block text-[9px] font-black text-amber-300">{view.status === 'connecting' ? 'ルームへつないでいます…' : 'つなぎ直しています…'}</small>}
                  </div>
                  <button data-rhythm-multi-share type="button" className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-3 text-xs font-black" onClick={shareCode}>{copied ? 'コピーした!' : '友だちに送る'}</button>
                </div>}
              </section>
              <div className="mt-2 space-y-2 landscape:mt-0">
                {view && isHost && view.mode !== 'private' && (
                  <button data-rhythm-multi-confirm type="button" disabled={members.length < 2} onClick={() => RHYTHM_MULTI.confirmMembers()}
                    className="min-h-[48px] w-full rounded-xl bg-fuchsia-700 px-2 text-sm font-black disabled:opacity-40">このメンバーで始める<small className="block text-[9px] font-bold opacity-80">待たずにメンバーを確定</small></button>
                )}
                {view && isHost && view.mode === 'private' && me && (
                  <div className="grid grid-cols-2 gap-2">
                    <button data-rhythm-multi-open type="button" onClick={() => RHYTHM_MULTI.setOpen(!me.open)}
                      className={`min-h-[48px] rounded-xl px-2 text-xs font-black ${me.open ? 'bg-amber-600' : 'bg-slate-700'}`}>
                      {me.open ? 'ルーム解放中' : 'ルーム解放'}<small className="block text-[9px] font-bold opacity-80">{me.open ? 'タップでやめる' : '知らない人も呼ぶ'}</small>
                    </button>
                    <button data-rhythm-multi-confirm type="button" disabled={members.length < 2} onClick={() => RHYTHM_MULTI.confirmMembers()}
                      className="min-h-[48px] rounded-xl bg-fuchsia-700 px-2 text-sm font-black disabled:opacity-40">メンバー確定</button>
                  </div>
                )}
              {friendsOn && view && view.mode === 'private' && (
                <section data-rhythm-multi-friend-invite className={card}>
                  <button data-rhythm-multi-friend-invite-toggle type="button" className={`${btn} w-full bg-pink-700`} onClick={openInvitePanel}>{invitePanel ? 'フレンドの招待をとじる' : 'フレンドを招待する'}</button>
                  {invitePanel && (
                    <div className="mt-2 space-y-1">
                      {roster === null && <p className="text-[11px] font-bold text-slate-400">フレンドを読み込んでいます…</p>}
                      {roster !== null && roster.length === 0 && (
                        <p className="text-[11px] font-bold leading-relaxed text-slate-400">まだフレンドがいません。プロフィールの「フレンド」から、フレンドコードで申請できます。</p>
                      )}
                      {(roster || []).map((friend) => (
                        <div key={friend.otherId} data-rhythm-multi-friend-row className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5">
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm font-black">{friend.userName}</b>
                            <small className="block truncate text-[10px] font-bold text-slate-400">{friendsLastSeenText(friend.lastSeenAt, Date.now())}</small>
                          </span>
                          <button data-rhythm-multi-friend-send type="button" disabled={!!invitedIds[friend.otherId]} onClick={() => inviteFriend(friend.otherId)}
                            className={`${btn} shrink-0 text-xs ${invitedIds[friend.otherId] ? 'bg-slate-700' : 'bg-pink-700'}`}>{invitedIds[friend.otherId] ? '招待ずみ' : '招待する'}</button>
                        </div>
                      ))}
                      {inviteMessage && <p data-rhythm-multi-friend-message className="text-[11px] font-black text-rose-300">{inviteMessage}</p>}
                      <p className="text-[10px] font-bold leading-relaxed text-slate-400">招待は3分のあいだ届きます。相手がマルチの入口をひらくと「参加する」が出ます。</p>
                    </div>
                  )}
                </section>
              )}
                <button data-rhythm-multi-leave type="button" className={`${btn} w-full bg-slate-700`} onClick={leaveRoom}>{view ? 'ルームを出る' : 'やめる'}</button>
                {message && <p className="text-[12px] font-black text-rose-300">{message}</p>}
              </div>
            </div>
          </>}
        {chatSheet}
      </main>
    );
  }

  // ⑥結果(本家の RESULT 画面: 上に曲とスコアランク、真ん中に5人の縦長カード、右下に「メンバーの成績」「次へ」)
  if (showResult) {
    const fill = Math.min(1, Math.max(0, team.average / 1000000));
    const marks = ['C', 'B', 'A', 'S', 'SS'].map((id) => ({ id, pos: (RHYTHM_RANKS.find((r) => r.id === id) || { min: 0 }).min / 1000000 }));
    const drawnLevel = (diffId) => (drawnSong && drawnSong.difficulties && drawnSong.difficulties[diffId] ? Number(drawnSong.difficulties[diffId].level) || 0 : 0);
    return (
      <main data-rhythm-multi data-rhythm-multi-step="result" className={`${shell} bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950`}>
        <b aria-hidden="true" className="pointer-events-none absolute left-2 top-0 text-6xl font-black italic tracking-widest text-white/[0.06]" style={{ top: 'var(--mh-sa-top)' }}>RESULT</b>
        <section data-rhythm-multi-results className="relative mx-2 mt-2 flex shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-slate-900/90 p-2" style={{ marginTop: 'calc(.5rem + var(--mh-sa-top))' }}>
          {drawnSong && <span className="h-12 w-12 shrink-0 landscape:h-14 landscape:w-14"><RhythmSongArt song={drawnSong} marked={false} /></span>}
          <div className="min-w-0 flex-1 landscape:max-w-[34%]">
            <b className="block truncate text-sm font-black">{drawnSong ? rhythmSongFullName(drawnSong) : ''}</b>
            <small className="block text-[10px] font-black text-slate-400">{team.waiting ? 'ほかの人のライブが終わるのを待っています…' : `チームの平均 ${team.average.toLocaleString()}`}</small>
          </div>
          <div className="hidden min-w-0 flex-1 landscape:block">
            <div data-rhythm-multi-gauge className="relative mt-3 h-3 rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-300 to-violet-400" style={{ width: `${Math.round(fill * 100)}%` }} />
              {marks.map((mk) => (
                <span key={mk.id} className="absolute top-0 h-3 w-px bg-white/70" style={{ left: `${Math.round(mk.pos * 100)}%` }}>
                  <small className="absolute -top-3.5 -translate-x-1/2 text-[9px] font-black text-slate-300">{mk.id}</small>
                </span>
              ))}
            </div>
          </div>
          <div className="flex w-16 shrink-0 flex-col items-center">
            <b data-rhythm-multi-team-rank className="text-5xl font-black leading-none text-amber-300 drop-shadow">{team.waiting ? '…' : team.rank}</b>
            <small className="text-[8px] font-black tracking-widest text-slate-400">SCORE RANK</small>
          </div>
        </section>
        {/* 縦画面ではゲージを曲の下へ1段で出す(横画面では上の帯の中) */}
        <div className="mx-3 mt-4 shrink-0 landscape:hidden">
          <div className="relative h-2.5 rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 via-emerald-300 to-violet-400" style={{ width: `${Math.round(fill * 100)}%` }} />
            {marks.map((mk) => (
              <span key={mk.id} className="absolute top-0 h-2.5 w-px bg-white/70" style={{ left: `${Math.round(mk.pos * 100)}%` }}>
                <small className="absolute -top-3.5 -translate-x-1/2 text-[9px] font-black text-slate-300">{mk.id}</small>
              </span>
            ))}
          </div>
        </div>
        <ul className="grid max-h-[260px] min-h-0 flex-1 grid-cols-5 gap-1.5 px-2 pb-1 pt-4 landscape:max-h-none landscape:gap-2 landscape:px-3">
          {Array.from({ length: RHYTHM_MULTI_ROOM_MAX }).map((_, i) => {
            const r = team.rows[i];
            if (!r) return <li key={`empty${i}`} aria-hidden="true" className="rounded-xl border border-dashed border-white/5" />;
            const isMvp = r.m.id === team.mvpId && !team.waiting;
            const lv = r.res ? drawnLevel(r.res.diffId) : 0;
            return (
              <li key={r.m.id} data-rhythm-multi-result-row className={`relative flex min-h-0 min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl px-0.5 pb-1.5 pt-3 text-center ${isMvp ? 'border-2 border-pink-400 bg-pink-950/40 shadow-[0_0_14px_rgba(244,114,182,.5)]' : 'border border-white/10 bg-slate-900/80'}`}>
                <RhythmMultiChatBubble text={chatBubbleOf(r.m.id)} />
                {isMvp && <b data-rhythm-multi-mvp className="absolute left-1/2 top-0.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-pink-500 px-1.5 py-px text-[9px] font-black text-white">★MVP★</b>}
                <RhythmMultiAvatar m={r.m} resolveIconUrl={resolveIconUrl} sizeClass="h-12 w-12 landscape:h-16 landscape:w-16" />
                <span className="mt-1 w-full truncate text-[10px] font-black landscape:text-xs">{r.m.name}{r.m.id === view.selfId ? '(あなた)' : ''}</span>
                <small className="block h-3 text-[7px] font-black italic leading-3 text-pink-300 landscape:text-[9px]">{r.res && !r.res.quit && r.res.cleared && r.res.fc > 0 ? RHYTHM_MULTI_FC_LABELS[r.res.fc].replace('!', '') : ''}</small>
                <b className="block w-full text-[10px] font-black leading-tight tracking-tighter tabular-nums landscape:text-base landscape:tracking-normal">{r.res ? (r.res.quit ? 'リタイア' : String(r.res.score).padStart(8, '0')) : r.m.gone ? '—' : 'ライブ中…'}</b>
                {r.res && !r.res.quit && <>
                  <small className="mt-1 rounded bg-slate-800 px-1 text-[8px] font-black text-slate-300 landscape:text-[10px]">{r.res.diffId || '-'}{lv ? ` Lv.${lv}` : ''}</small>
                  {!r.res.cleared && <small className="text-[8px] font-black text-rose-300">失敗</small>}
                </>}
              </li>
            );
          })}
        </ul>
        {/* 結果を見ながら、ワンタップで「もう一回!」「ありがとう!」(2026-10-03・ユーザー指示) */}
        <div data-rhythm-multi-result-chat className="flex shrink-0 items-center gap-1.5 px-2 pt-1 landscape:px-3">
          <RhythmMultiStampBar phase="result" onSend={(text) => RHYTHM_MULTI.sendChat(text)} className="min-w-0 flex-1" />
          {chatButton()}
        </div>
        <div className="mt-auto flex shrink-0 gap-2 border-t border-white/10 bg-slate-950/90 px-3 pt-2 landscape:justify-end landscape:border-t-0 landscape:bg-transparent" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          <button data-rhythm-multi-member-stats type="button" onClick={() => setStatsOpen(true)}
            className="min-h-[46px] flex-1 rounded-full border border-white/30 bg-slate-800 px-4 text-sm font-black landscape:w-48 landscape:flex-none">メンバーの成績</button>
          <button data-rhythm-multi-result-next type="button" onClick={() => RHYTHM_MULTI.nextFromResult(room.round)}
            className="min-h-[46px] flex-1 rounded-full bg-gradient-to-r from-teal-300 to-cyan-400 px-4 font-black text-slate-950 landscape:w-56 landscape:flex-none">{team.waiting ? (isHost ? '待たずに次の曲へ' : '次へ(ほかの人を待たない)') : '次へ'}</button>
        </div>
        {statsOpen && (
          <div data-rhythm-multi-stats className="absolute inset-0 z-[85000] flex flex-col bg-slate-950" style={{ paddingTop: 'var(--mh-sa-top)', paddingBottom: 'var(--mh-sa-bottom)' }}>
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
              <b className="min-w-0 flex-1 truncate text-sm font-black">メンバーの成績{drawnSong ? ` ・ ${rhythmSongFullName(drawnSong)}` : ''}</b>
              <button type="button" className="min-h-[44px] shrink-0 rounded-xl bg-slate-700 px-4 text-sm font-black" onClick={() => setStatsOpen(false)}>閉じる</button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <table className="w-full min-w-[640px] border-separate border-spacing-y-1 text-center text-[11px] font-black">
                <thead>
                  <tr className="text-[10px] text-slate-400">
                    <th className="px-1 text-left">メンバー</th><th className="px-1">難易度</th><th className="px-1">スコア</th><th className="px-1">最大コンボ</th>
                    {RHYTHM_MULTI_JUDGMENT_IDS.map((id) => <th key={id} className="px-1" style={{ color: rhythmJudgmentColor(id) }}>{id}</th>)}
                    <th className="px-1">FAST / SLOW</th>
                  </tr>
                </thead>
                <tbody>
                  {team.rows.map((r) => (
                    <tr key={r.m.id} data-rhythm-multi-stats-row className={r.m.id === team.mvpId ? 'bg-pink-950/50' : 'bg-slate-900/80'}>
                      <td className="rounded-l-lg px-1 py-1.5 text-left">
                        <span className="flex items-center gap-1.5"><RhythmMultiAvatar m={r.m} resolveIconUrl={resolveIconUrl} sizeClass="h-7 w-7" /><span className="max-w-[7rem] truncate">{r.m.name}</span>{r.m.id === team.mvpId && <small className="rounded bg-pink-500 px-1 text-[8px] text-white">MVP</small>}</span>
                      </td>
                      <td className="px-1">{r.res ? r.res.diffId || '-' : '-'}</td>
                      <td className="px-1 tabular-nums">{r.res ? (r.res.quit ? 'リタイア' : r.res.score.toLocaleString()) : '—'}</td>
                      <td className="px-1 tabular-nums">{r.res && !r.res.quit ? r.res.maxCombo : '—'}</td>
                      {RHYTHM_MULTI_JUDGMENT_IDS.map((id, k) => <td key={id} className="px-1 tabular-nums">{r.res && !r.res.quit && r.res.j ? r.res.j[k] : '—'}</td>)}
                      <td className="rounded-r-lg px-1 tabular-nums">{r.res && !r.res.quit ? `${r.res.fs} / ${r.res.sl}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {chatSheet}
      </main>
    );
  }

  // ライブ中(自分は参加していない・または結果のあと次の選曲を待っているとき)
  if (phase === 'playing' || phase === 'result') {
    return (
      <main data-rhythm-multi data-rhythm-multi-step="waiting" className={shell}>
        {header(phase === 'playing' ? 'ライブ中' : '次の選曲を待っています', leaveRoom)}
        <RhythmMultiMemberCards bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} size="tall"
          badgeOf={(m) => (m.playing ? { text: 'ライブ中', cls: 'bg-amber-400 text-slate-950' } : { text: '待機中', cls: 'bg-slate-600 text-white' })} />
        <RhythmMultiStampBar phase={phase} onSend={(text) => RHYTHM_MULTI.sendChat(text)} className="shrink-0 px-2 pt-1" />
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-950/90 p-2 landscape:flex-row landscape:items-center" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          <p className="min-w-0 flex-1 text-sm font-black text-amber-200">{phase === 'playing' ? 'いまライブ中です。次の曲から参加できます' : 'ホストが次へ進むのを待っています'}{drawnSong ? <small className="block truncate text-[11px] font-bold text-slate-300">{rhythmSongFullName(drawnSong)}</small> : null}</p>
          <button data-rhythm-multi-leave type="button" className={`${btn} bg-slate-700 landscape:w-48`} onClick={leaveRoom}>ルームを出る</button>
        </div>
        {chatSheet}
        {countdownLayer}
      </main>
    );
  }

  // ④MUSIC SHUFFLE の演出(準備の画面へ入る前に一度だけ)。横画面ではジャケットを左、全員の選曲を右に並べる
  if (shuffleRound) {
    const picked = members.map((m) => ({ m, song: m.pickRound === room.round && m.pick !== RHYTHM_MULTI_OMAKASE ? songById(m.pick) : null }));
    const pool = picked.filter((x) => x.song);
    const spinning = pool.length ? pool[shuffleIndex % pool.length] : null;
    const shown = shuffleStopped ? drawnSong : (spinning ? spinning.song : songs[shuffleIndex % Math.max(1, songs.length)]);
    return (
      <main data-rhythm-multi data-rhythm-multi-step="shuffle" className={shell}>
        {header('楽曲シャッフル', leaveRoom)}
        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-3 landscape:flex-row landscape:items-stretch landscape:justify-center">
          <div data-rhythm-multi-shuffle className={`flex w-full max-w-xs shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border p-3 landscape:w-[42%] ${shuffleStopped ? 'border-amber-300 bg-amber-950/30' : 'border-fuchsia-400/40 bg-slate-900/80'}`}>
            <b className="text-lg font-black italic tracking-widest text-fuchsia-200">MUSIC SHUFFLE</b>
            {shown && <span className="h-32 w-32 landscape:h-36 landscape:w-36"><RhythmSongArt song={shown} large marked={false} /></span>}
            <b className="w-full truncate text-center text-base font-black">{shown ? rhythmSongFullName(shown) : ''}</b>
            <small className={`text-xs font-black text-amber-200 ${shuffleStopped ? '' : 'invisible'}`}>この曲に決まりました!</small>
          </div>
          <ul className="w-full max-w-sm space-y-1 landscape:flex landscape:max-w-md landscape:flex-col landscape:justify-center">
            {picked.map(({ m, song }) => (
              <li key={m.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${shuffleStopped && song && drawnSong && song.songId === drawnSong.songId ? 'bg-amber-500/25' : 'bg-slate-900/80'}`}>
                <RhythmMultiAvatar m={m} resolveIconUrl={resolveIconUrl} sizeClass="h-8 w-8" />
                <span className="w-20 shrink-0 truncate text-[11px] font-black text-slate-300">{m.name}</span>
                {song && <img src={rhythmSongArtSrc(song)} alt="" draggable={false} className="h-8 w-8 shrink-0 rounded-md object-cover" />}
                <span className="min-w-0 flex-1 truncate text-[12px] font-black">{song ? rhythmSongFullName(song) : 'おまかせ'}</span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  // ⑤難易度えらび・準備完了(本家: 上に5人の大きなカード、下の帯に曲・難易度・「準備完了」)
  if (phase === 'ready') {
    const iAmReady = !!me && me.readyRound === room.round;
    const shownDiffId = (drawnOpenDiffs.find((d) => d.id === myDiffId) || pickPlayDifficulty() || {}).id;
    return (
      <main data-rhythm-multi data-rhythm-multi-step="ready" className={shell}>
        {header('難易度選択', leaveRoom, { timer: room.left, advance: 'すぐ開始', gesture: true })}
        <RhythmMultiMemberCards bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} size="tall"
          badgeOf={(m) => (m.readyRound === room.round ? { text: '準備完了', cls: 'bg-emerald-400 text-slate-950', sub: m.diff } : { text: '準備中', cls: 'bg-slate-600 text-white', sub: m.diff })} />
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 bg-slate-950/95 p-2 landscape:flex-row landscape:items-center landscape:gap-3" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          {drawnSong && (
            <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-900/90 p-1.5 landscape:w-[32%]">
              <span className="h-12 w-12 shrink-0"><RhythmSongArt song={drawnSong} marked={false} /></span>
              <div className="min-w-0 flex-1">
                <small className="block text-[9px] font-black text-slate-400">ライブする曲</small>
                <b data-rhythm-multi-drawn className="block truncate text-sm font-black leading-tight">{rhythmSongFullName(drawnSong)}</b>
                {onToggleLightLook && <button data-rhythm-multi-light-look type="button" aria-pressed={multiLightLook} onClick={onToggleLightLook}
                  className={`mt-0.5 rounded-full border px-1.5 text-[9px] font-black ${multiLightLook ? 'border-emerald-300/60 text-emerald-200' : 'border-white/20 text-slate-400'}`}>演出を軽く(対戦) {multiLightLook ? 'ON' : 'OFF'}</button>}
              </div>
            </div>
          )}
          <div className="grid grid-cols-5 gap-1.5 landscape:flex-1">
            {drawnDiffs.map((d) => {
              const open = drawnOpenDiffs.some((x) => x.id === d.id);
              const level = drawnSong && drawnSong.difficulties && drawnSong.difficulties[d.id] ? Number(drawnSong.difficulties[d.id].level) || 0 : 0;
              const active = shownDiffId === d.id;
              return (
                <button key={d.id} type="button" data-rhythm-multi-difficulty={d.id} disabled={!open || iAmReady} onClick={() => RHYTHM_MULTI.setDiff(d.id)}
                  className={`flex min-h-[52px] flex-col items-center justify-center rounded-full border-2 text-[9px] font-black disabled:opacity-40 ${active ? 'border-fuchsia-300 bg-fuchsia-600 text-white' : 'border-white/20 bg-slate-800 text-slate-200'}`}>
                  <span className="text-base leading-none">{level || '-'}</span>
                  <span className="leading-tight">{open ? d.id : '🔒'}</span>
                </button>
              );
            })}
          </div>
          <button data-rhythm-multi-ready type="button" disabled={iAmReady} onClick={() => { if (onUserGesture) onUserGesture(); if (shownDiffId) RHYTHM_MULTI.setDiff(shownDiffId); RHYTHM_MULTI.ready(); }}
            className="min-h-[52px] rounded-xl bg-gradient-to-r from-teal-300 to-cyan-400 px-3 text-base font-black text-slate-950 disabled:opacity-60 landscape:w-[22%]">{iAmReady ? '準備完了!' : '準備完了'}{iAmReady && <small className="block text-[9px] font-bold">ほかのメンバーを待っています</small>}</button>
        </div>
        {chatSheet}
        {countdownLayer}
      </main>
    );
  }

  // ③選曲(ソロと同じ曲えらびの画面。上に5人の細いカードで「選曲中 / 選曲済(何をえらんだか)」)
  const myPick = me && me.pickRound === room.round ? me.pick : '';
  const pickLabel = (m) => {
    if (m.pickRound !== room.round || !m.pick) return { text: '選曲中', cls: 'bg-slate-600 text-white' };
    const song = m.pick === RHYTHM_MULTI_OMAKASE ? null : songById(m.pick);
    return { text: '選曲済', cls: 'bg-fuchsia-400 text-slate-950', sub: song ? rhythmSongFullName(song) : 'おまかせ' };
  };
  return (
    <main data-rhythm-multi data-rhythm-multi-step="select" className={shell}>
      {header('楽曲シャッフル ・ 選曲', leaveRoom, { timer: room.left, advance: '締め切る' })}
      <RhythmMultiMemberCards bubbleOf={chatBubbleOf} members={members} hostId={view.hostId} selfId={view.selfId} resolveIconUrl={resolveIconUrl} badgeOf={pickLabel} size="strip" />
      <RhythmSongSelect
        songs={songs}
        difficulties={difficultyList}
        bestRecords={bestRecords}
        songId={selSongId}
        difficultyId={myDiffId}
        onSongId={(id) => setSelSongId(id)}
        onDifficultyId={(id) => RHYTHM_MULTI.setDiff(id)}
        view={selectView}
        onView={setSelectView}
        onPlay={(song, difficulty) => { RHYTHM_MULTI.setDiff(difficulty.id); RHYTHM_MULTI.pick(song.songId); }}
        playLabel={myPick ? 'この曲に変更' : 'この曲で決定'}
        hideRandom
        notice={<p className="rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-bold leading-snug text-slate-300">全員がえらぶか時間になると、全員の選曲からシャッフルで1曲が決まります。</p>}
        footer={() => (
          <div className="grid grid-cols-2 gap-1.5">
            <button data-rhythm-multi-omakase type="button" aria-pressed={myPick === RHYTHM_MULTI_OMAKASE} onClick={() => RHYTHM_MULTI.pick(RHYTHM_MULTI_OMAKASE)}
              className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-black leading-tight ${myPick === RHYTHM_MULTI_OMAKASE ? 'border-amber-300 bg-amber-600/80 text-white' : 'border-white/15 bg-slate-900/80 text-slate-300'}`}>🔀 おまかせ{myPick === RHYTHM_MULTI_OMAKASE ? '(選曲済)' : ''}</button>
            <button data-rhythm-multi-leave type="button" onClick={leaveRoom}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 px-1 text-[11px] font-black text-slate-300">ルームを出る</button>
          </div>
        )} />
      {chatSheet}
      {countdownLayer}
    </main>
  );
}
