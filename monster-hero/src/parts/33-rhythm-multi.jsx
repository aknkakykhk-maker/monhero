// ===== モンヒロビート マルチ(みんなで対戦: 協力スコア) =====
// プロセカの「みんなでライブ」を参考にした、最大5人の協力プレイ。
//  ・部屋は3種類。フリールーム(だれでも)・ベテランルーム(ブリーダーLv.30以上)・プライベートルーム(部屋コード)。
//    フリー/ベテランは、ほかの部屋を探して自動で集まる。プライベートも「ルーム解放」で知らない人を呼べる。
//  ・選曲は、全員が「希望の曲」か「おまかせ」を出して、抽選で1曲に決める。難易度は各自がえらぶ。
//  ・結果は、全員の平均スコアで「チームのランク」を決める。個人スコアの1位は MVP。
//  ・演奏のやり直し(リスタート)はできない。途中でやめると、公開ルームには3分間入れない。
// 通信は Supabase Realtime の「Broadcast」だけを使う。テーブルもSQLも要らず、ランキング(rankings)・
// 自己ベスト・ビートP・周回報酬には一切触れない。演奏は各自の端末で完結するので、通信の遅れは判定に影響しない。
//
// 作り:
//  ・部屋の持ち主(サーバー役)はいない。全員が2秒ごとに自分の状態を知らせ(hb)、7秒聞こえない人は抜けた扱い。
//    「部屋主」は、いる人の中でいちばん早く入った人(同時なら id の小さい人)。全員が同じ並びを計算できる。
//  ・フリー/ベテランの「さがす」は、種類ごとの受付用の通信路(mhb-lobby-◯◯)で行う。
//    空きのある部屋の部屋主が2秒ごとに「ここにいるよ」と知らせ、探す人はそれを3.5秒聞いて入る。
//    探す人どうしが同時に部屋を作っても、1人きりの部屋は「コードの小さい部屋」へ引っ越して1つにまとまる。
//  ・画面を行き来しても部屋が切れないよう、状態は React の外(このファイルの RHYTHM_MULTI)に置く。
const RHYTHM_MULTI_ROOM_MAX = 5;
const RHYTHM_MULTI_VETERAN_MIN_LEVEL = 30;
const RHYTHM_MULTI_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RHYTHM_MULTI_CODE_LENGTH = 4;
const RHYTHM_MULTI_HEARTBEAT_MS = 2000;
const RHYTHM_MULTI_ALIVE_MS = 7000;
const RHYTHM_MULTI_START_COUNTDOWN_SEC = 3;
const RHYTHM_MULTI_CHAT_MAX_LENGTH = 40;
const RHYTHM_MULTI_CHAT_KEEP = 50;
const RHYTHM_MULTI_CHAT_INTERVAL_MS = 800;
const RHYTHM_MULTI_CHAT_STAMPS = Object.freeze(['よろしく!', 'ナイス!', '準備OK!', 'もう一回!', 'ありがとう!']);
const RHYTHM_MULTI_ROOM_TOPIC = 'realtime:mhb-room-';
const RHYTHM_MULTI_LOBBY_TOPIC = 'realtime:mhb-lobby-';
const RHYTHM_MULTI_LOBBY_ANNOUNCE_MS = 2000;
const RHYTHM_MULTI_LOBBY_LISTEN_MS = 3500;
const RHYTHM_MULTI_LOBBY_FRESH_MS = 6000;
// 途中でやめた人が公開ルームへ入れない時間。新しい保存キー(既存のキーは触らない)
const RHYTHM_MULTI_PENALTY_KEY = 'mh_rhythm_multi_penalty_v1';
const RHYTHM_MULTI_PENALTY_MS = 3 * 60 * 1000;
const RHYTHM_MULTI_MODES = Object.freeze(['private', 'free', 'veteran']);
const RHYTHM_MULTI_MODE_LABELS = Object.freeze({ private: 'プライベート', free: 'フリー', veteran: 'ベテラン' });

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
const rhythmMultiMakeId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
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
// 1回の演奏ぶん。参加した人(演奏中か、結果を出した人)の平均スコアでチームのランクを決める。
// やめた人・失敗した人は0点として平均に入れる。MVP は、最後まで演奏した人の最高スコア(同点は先に入った人)
const rhythmMultiTeamResult = (members, startId) => {
  const rows = members.map((m) => ({ m, res: m.res && m.res.startId === startId ? m.res : null }))
    .filter((r) => r.res || r.m.playing);
  const waiting = rows.some((r) => !r.res);
  const scores = rows.map((r) => (r.res && !r.res.quit ? r.res.score : 0));
  const average = scores.length ? Math.floor(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  let mvpId = null;
  let best = 0;
  rows.forEach((r) => { if (r.res && !r.res.quit && r.res.score > best) { best = r.res.score; mvpId = r.m.id; } });
  return { rows, waiting, average, total: scores.reduce((a, b) => a + b, 0), mvpId, rank: scores.length ? rhythmRankForScore(average) : null };
};

// 受け取った知らせを、安全な形へ作り直す。知らない形・壊れた値は捨てる
const rhythmMultiCleanMessage = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const id = rhythmMultiText(raw.id, 40);
  if (!id) return null;
  const out = { t: raw.t, id };
  if (raw.t === 'hb') {
    out.name = rhythmMultiText(raw.name, 12) || '名無しのブリーダー';
    out.level = rhythmMultiInt(raw.level, 9999);
    out.joinedAt = rhythmMultiInt(raw.joinedAt, 9e15);
    out.ready = raw.ready === true;
    out.playing = raw.playing === true;
    out.wish = rhythmMultiText(raw.wish, 60);
    out.diff = rhythmMultiText(raw.diff, 20);
    out.open = raw.open === true;
    out.mode = RHYTHM_MULTI_MODES.includes(raw.mode) ? raw.mode : 'private';
    if (raw.res && typeof raw.res === 'object') out.res = rhythmMultiCleanResult(raw.res);
    return out;
  }
  if (raw.t === 'start') {
    out.startId = rhythmMultiText(raw.startId, 40);
    out.songId = rhythmMultiText(raw.songId, 60);
    return out.startId && out.songId ? out : null;
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
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (_) { /* 画面側の失敗で通信を止めない */ } }); };
  const alive = () => (s ? Object.values(s.members).filter((m) => Date.now() - m.seen <= RHYTHM_MULTI_ALIVE_MS || m.id === s.selfId) : []);
  const selfMember = () => (s ? s.members[s.selfId] : null);
  const sendHb = () => {
    const me = selfMember();
    if (!s || !socket || !me) return;
    socket.send({ t: 'hb', id: s.selfId, name: me.name, level: me.level, joinedAt: me.joinedAt, ready: me.ready, playing: me.playing, wish: me.wish, diff: me.diff, open: me.open, mode: s.mode, res: me.res || undefined });
  };
  const stopTimers = () => {
    if (hbTimer) clearInterval(hbTimer);
    if (sweepTimer) clearInterval(sweepTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    hbTimer = sweepTimer = reconnectTimer = null;
  };
  const closeLobby = () => { if (lobby) { try { lobby.socket.close(); } catch (_) { /* 無視 */ } lobby = null; } };
  // 空きのある公開(または解放した)部屋の部屋主だけが、受付へ「ここにいるよ」と知らせる。
  // 自分1人だけの部屋は、受付で聞こえたコードの小さい部屋へ引っ越して、バラバラの部屋を1つにまとめる
  const syncLobby = () => {
    if (!s) { closeLobby(); return; }
    const order = rhythmMultiSortMembers(alive());
    const me = selfMember();
    const isHost = order.length > 0 && order[0].id === s.selfId;
    const want = isHost && !!me && me.open && order.length < RHYTHM_MULTI_ROOM_MAX && !order.some((m) => m.playing) && s.status === 'open';
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
    if (order.length === 1 && s.mode !== 'private' && Date.now() - s.createdAt > RHYTHM_MULTI_LOBBY_LISTEN_MS) {
      const other = rhythmMultiBestRoom(lobby.rooms, s.code);
      if (other && other < s.code) {
        const profile = { name: me.name, level: me.level, wish: me.wish, diff: me.diff };
        const mode = s.mode;
        api.join(other, profile, mode);
      }
    }
  };
  const onMessage = (raw) => {
    if (!s) return;
    const msg = rhythmMultiCleanMessage(raw);
    if (!msg) return;
    if (msg.t === 'bye') { delete s.members[msg.id]; emit(); return; }
    if (msg.t === 'chat') {
      // 同じ発言(cid)は2度出さない。覚えておくのは直近だけ(保存はしない)
      if (!s.chat.some((c) => c.cid === msg.cid)) {
        s.chat.push({ cid: msg.cid, id: msg.id, name: msg.name, text: msg.text });
        if (s.chat.length > RHYTHM_MULTI_CHAT_KEEP) s.chat.splice(0, s.chat.length - RHYTHM_MULTI_CHAT_KEEP);
      }
      emit();
      return;
    }
    const prev = s.members[msg.id] || { id: msg.id, name: '', level: 0, joinedAt: 0, ready: false, playing: false, wish: '', diff: '', open: false, res: null };
    if (msg.t === 'hb') {
      // 自分の状態は自分が持っているものが正しいので、自分の知らせでは上書きしない
      if (msg.id !== s.selfId) s.members[msg.id] = { ...prev, name: msg.name, level: msg.level, joinedAt: msg.joinedAt, ready: msg.ready, playing: msg.playing, wish: msg.wish, diff: msg.diff, open: msg.open, res: msg.res || prev.res, seen: Date.now() };
      else prev.seen = Date.now();
    } else if (msg.t === 'res') {
      s.members[msg.id] = { ...prev, res: msg.res, playing: false, seen: Date.now() };
    } else if (msg.t === 'start') {
      // 始めの合図は、部屋主から出たものだけ受ける。同じ合図(startId)は2度受けない
      const order = rhythmMultiSortMembers(alive());
      if (order.length && order[0].id === msg.id && s.start?.startId !== msg.startId) {
        s.start = { startId: msg.startId, songId: msg.songId, receivedAt: Date.now() };
        const me = selfMember();
        // 準備のできていない人は、合図が来ても演奏へ入らない(その回は見るだけ)
        if (me && me.ready) { me.playing = true; me.res = null; startListeners.forEach((fn) => { try { fn(s.start); } catch (_) { /* 無視 */ } }); }
        sendHb();
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
    // 画面へ見せる形に直して返す。毎回新しい値を返すので、呼ぶ側は emit のたびに作り直してよい
    view() {
      if (!s) return null;
      const order = rhythmMultiSortMembers(alive());
      const selfIndex = order.findIndex((m) => m.id === s.selfId);
      return {
        code: s.code, mode: s.mode, status: s.status, selfId: s.selfId,
        members: order.slice(0, RHYTHM_MULTI_ROOM_MAX),
        hostId: order.length ? order[0].id : s.selfId,
        full: selfIndex >= RHYTHM_MULTI_ROOM_MAX,
        start: s.start,
        chat: s.chat.slice(),
      };
    },
    join(code, profile, mode) {
      this.leave();
      const now = Date.now();
      const id = rhythmMultiMakeId();
      const roomMode = RHYTHM_MULTI_MODES.includes(mode) ? mode : 'private';
      s = { code, mode: roomMode, status: 'connecting', selfId: id, start: null, members: {}, chat: [], lastChatAt: 0, createdAt: now };
      s.members[id] = {
        id, name: rhythmMultiText(profile && profile.name, 12) || '名無しのブリーダー', level: rhythmMultiInt(profile && profile.level, 9999),
        joinedAt: now, ready: false, playing: false,
        wish: rhythmMultiText(profile && profile.wish, 60), diff: rhythmMultiText(profile && profile.diff, 20),
        // フリー/ベテランの部屋は、はじめから公開(空きがあるあいだ受付へ知らせる)。プライベートは「ルーム解放」を押したときだけ
        open: roomMode !== 'private', res: null, seen: now,
      };
      connect();
      // 演奏中は、演奏の判定と描画に余計な仕事を割り込ませないよう、裏の通信を減らす。
      // 状態の知らせは4秒ごと(抜けた扱いになるのは7秒なので足りる)、1秒ごとの点検と画面更新は止める
      let playTick = 0;
      hbTimer = setInterval(() => {
        const me = selfMember();
        if (me && me.playing) { playTick += 1; if (playTick % 2 === 1) return; }
        sendHb();
      }, RHYTHM_MULTI_HEARTBEAT_MS);
      sweepTimer = setInterval(() => {
        const me = selfMember();
        if (me && me.playing) return;
        syncLobby(); emit();
      }, 1000);
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
    setWish(songId) {
      const me = selfMember();
      if (!me) return;
      me.wish = rhythmMultiText(songId, 60);
      sendHb(); emit();
    },
    setDiff(difficultyId) {
      const me = selfMember();
      if (!me) return;
      me.diff = rhythmMultiText(difficultyId, 20);
      sendHb(); emit();
    },
    // 「ルーム解放」。プライベートの部屋を、知らない人にも開く
    setOpen(open) {
      const me = selfMember();
      if (!me) return;
      me.open = open === true;
      sendHb(); syncLobby(); emit();
    },
    setReady(ready) {
      const me = selfMember();
      if (!me) return;
      me.ready = ready === true;
      sendHb(); emit();
    },
    // 部屋主だけが呼べる。2人以上いて、部屋主以外の全員が準備できているときだけ始まる。
    // 曲は、全員の希望(「おまかせ」は数えない)から抽選。希望が1つも無ければ全曲から抽選する
    hostStart(allSongIds) {
      const v = this.view();
      if (!v || !socket || v.hostId !== v.selfId) return false;
      const me = selfMember();
      const all = Array.isArray(allSongIds) ? allSongIds : [];
      if (!me || v.members.length < 2 || !v.members.every((m) => m.id === v.selfId || m.ready)) return false;
      const wished = v.members.map((m) => m.wish).filter((id) => id && all.includes(id));
      const pool = wished.length ? wished : all;
      if (!pool.length) return false;
      me.ready = true;
      socket.send({ t: 'start', id: v.selfId, startId: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, songId: pool[Math.floor(Math.random() * pool.length)] });
      return true;
    },
    // 曲が終わった(または途中でやめた)ときに、自分のスコアを部屋へ知らせる。同じ回の2度目は無視する。
    // 途中でやめたことが公開ルームで起きたら、しばらく公開ルームへ入れなくする(opts.noPenalty で外せる)
    reportResult(startId, result, quit, opts) {
      const me = selfMember();
      if (!me || !startId) return;
      if (me.res && me.res.startId === startId) return;
      me.res = rhythmMultiCleanResult({ startId, score: result && result.score, maxCombo: result && result.maxCombo, cleared: result ? result.cleared !== false : false, quit: quit === true, diffId: opts && opts.diffId });
      me.playing = false;
      me.ready = false;
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
    hasReported(startId) { const me = selfMember(); return !!(me && me.res && me.res.startId === startId); },
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
// 流れ(プロセカの「みんなでライブ」を参考):
//   ①ルーム選択(フリー / ベテラン / プライベート) → ②マッチング画面(メンバーが集まるのを待つ)
//   → ③曲えらび(ソロと同じ画面に、いっしょに遊ぶ人の帯と、準備OK・スタートが付く)
//   → 演奏(3・2・1) → チームの結果(ランクとMVP)
// 部屋の中の状態は React の外(RHYTHM_MULTI)にあるので、画面を行き来しても部屋は切れない。
const rhythmMultiStatusLabel = (m, hostId) => (m.playing ? '演奏中' : m.id === hostId ? '部屋主' : m.ready ? '準備OK' : '待機中');
const rhythmMultiStatusClass = (m, hostId) => (m.playing ? 'bg-amber-500/80 text-slate-950' : m.ready || m.id === hostId ? 'bg-emerald-500/80 text-slate-950' : 'bg-slate-700 text-slate-300');

function RhythmMultiChatPanel({ view }) {
  const [chatText, setChatText] = React.useState('');
  const listRef = React.useRef(null);
  const count = view && view.chat ? view.chat.length : 0;
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  const submit = () => { if (RHYTHM_MULTI.sendChat(chatText)) setChatText(''); };
  return (
    <section data-rhythm-multi-chat className="rounded-2xl border border-white/15 bg-slate-900/95 p-3">
      <h3 className="text-xs font-black text-slate-300">チャット</h3>
      <ul ref={listRef} data-rhythm-multi-chat-list className="mt-1 max-h-40 min-h-[3rem] space-y-1 overflow-y-auto rounded-lg bg-slate-950/60 p-2 text-sm font-bold">
        {count === 0 && <li className="text-[11px] text-slate-500">まだ発言はありません</li>}
        {view.chat.map((c) => (
          <li key={c.cid} data-rhythm-multi-chat-line className="break-words leading-snug">
            <b className={c.id === view.selfId ? 'text-cyan-300' : 'text-amber-200'}>{c.name}</b>
            <span className="text-slate-400">: </span>{c.text}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {RHYTHM_MULTI_CHAT_STAMPS.map((stamp) => (
          <button key={stamp} data-rhythm-multi-chat-stamp type="button" onClick={() => RHYTHM_MULTI.sendChat(stamp)}
            className="min-h-[36px] rounded-full bg-slate-700 px-3 text-xs font-black">{stamp}</button>
        ))}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <input data-rhythm-multi-chat-input value={chatText} maxLength={RHYTHM_MULTI_CHAT_MAX_LENGTH} autoComplete="off" enterKeyHint="send"
          onChange={(e) => setChatText(e.target.value)} placeholder={`ひとこと(${RHYTHM_MULTI_CHAT_MAX_LENGTH}文字まで)`}
          className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-base font-bold text-white" />
        <button data-rhythm-multi-chat-send type="submit" disabled={!chatText.trim()} className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-4 text-sm font-black disabled:opacity-40">送信</button>
      </form>
    </section>
  );
}

function RhythmMultiResultCard({ view, team, song }) {
  return (
    <section data-rhythm-multi-results className="rounded-2xl border border-white/15 bg-slate-900/95 p-3">
      <h3 className="text-xs font-black text-slate-300">チームの結果{song ? `(${rhythmSongFullName(song)})` : ''}</h3>
      <div className="mt-1 flex items-center gap-3 rounded-xl bg-slate-950/60 px-3 py-2">
        <b data-rhythm-multi-team-rank className="text-4xl font-black text-amber-300">{team.waiting ? '…' : team.rank}</b>
        <div className="min-w-0 flex-1">
          <small className="block text-[10px] font-black text-slate-400">{team.waiting ? '全員の演奏が終わるのを待っています' : 'チームのランク(平均スコアで決まります)'}</small>
          <span className="block truncate text-sm font-black tabular-nums">平均 {team.average.toLocaleString()}</span>
        </div>
      </div>
      <ol className="mt-2 space-y-1">
        {team.rows.slice().sort((a, b) => (b.res && !b.res.quit ? b.res.score : -1) - (a.res && !a.res.quit ? a.res.score : -1)).map((r, i) => (
          <li key={r.m.id} data-rhythm-multi-result-row className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5 text-sm font-black">
            <span className="w-6 shrink-0 text-center text-amber-300">{r.res && !r.res.quit ? i + 1 : '-'}</span>
            <span className="min-w-0 flex-1 truncate">{r.m.id === team.mvpId ? <b data-rhythm-multi-mvp className="mr-1 rounded bg-amber-400 px-1 text-[10px] text-slate-950">MVP</b> : null}{r.m.name}{r.m.id === view.selfId ? '(あなた)' : ''}{r.res && r.res.diffId ? <small className="ml-1 text-[10px] text-slate-400">{r.res.diffId}</small> : null}</span>
            <span className="shrink-0 tabular-nums">{r.res ? (r.res.quit ? 'リタイア' : `${r.res.score.toLocaleString()}${r.res.cleared ? '' : '(失敗)'}`) : '演奏中…'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// songs / difficultiesOf / difficultyList は曲えらびと同じ一覧(rhythmDemoSongs など)。
// onStartPlay は演奏画面へ入る処理を親が持つ。bestRecords は難易度の鍵(解放)の判定に使う
function RhythmMultiScreen({ profile, songs, difficultiesOf, difficultyList, bestRecords, onBack, onStartPlay }) {
  const view = useRhythmMultiView();
  const difficultyIds = difficultyList.map((d) => d.id);
  const [codeInput, setCodeInput] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [searching, setSearching] = React.useState(null);
  const [countdown, setCountdown] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [dismissedResult, setDismissedResult] = React.useState('');
  // 演奏から戻ってきたとき(画面が作り直されたとき)も、部屋に出してある希望をそのまま引き継ぐ
  const mine = view ? view.members.find((m) => m.id === view.selfId) : null;
  const [omakase, setOmakase] = React.useState(!(mine && mine.wish));
  const [selSongId, setSelSongId] = React.useState(mine && mine.wish ? mine.wish : '');
  const [selDiffId, setSelDiffId] = React.useState(mine && mine.diff ? mine.diff : '');
  const [selectView, setSelectView] = React.useState(null);
  const songById = (songId) => songs.find((song) => song.songId === songId) || null;
  const defaultDiff = difficultyIds.includes('NORMAL') ? 'NORMAL' : difficultyIds[0] || '';
  const me = view ? view.members.find((m) => m.id === view.selfId) : null;
  const isHost = !!view && view.hostId === view.selfId;
  const start = view ? view.start : null;
  const team = start && view ? rhythmMultiTeamResult(view.members, start.startId) : null;
  // 結果の欄は、だれかが演奏を終えてから出す(始まったばかりの「演奏中…」だけの欄は出さない)
  const resultVisible = !!team && team.rows.some((r) => r.res) && !!start && dismissedResult !== start.startId;
  const everyoneReady = !!view && view.members.length >= 2 && view.members.every((m) => m.id === view.selfId || m.ready);
  const canStart = isHost && everyoneReady && !countdown;
  const songIds = songs.map((song) => song.songId);

  // ---- フレンド(公開前はすべて動かない) ----
  // 招待は Supabase の friend_invites へ書く。受ける側は、部屋に入っていないあいだだけ数秒ごとに読む。
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

  // 合図が来たら 3・2・1 を数えて演奏へ入る。数えるのは受け取った時刻から(端末の時計のずれに左右されない)
  React.useEffect(() => RHYTHM_MULTI.onStart((info) => {
    setCountdown({ info, left: RHYTHM_MULTI_START_COUNTDOWN_SEC });
    setChatOpen(false);
  }), []);
  React.useEffect(() => {
    if (!countdown) return undefined;
    if (countdown.left <= 0) {
      const song = songById(countdown.info.songId);
      const diff = song ? rhythmMultiPickDifficulty(difficultiesOf(song), RHYTHM_MULTI.myDiff() || defaultDiff, difficultyIds) : null;
      setCountdown(null);
      if (song && diff) onStartPlay(song, diff, countdown.info.startId);
      else RHYTHM_MULTI.reportResult(countdown.info.startId, null, true, { noPenalty: true });
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ? { ...c, left: c.left - 1 } : c)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const myProfile = () => ({ name: profile.name, level: profile.level, diff: defaultDiff });
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
  // フリー/ベテラン: 空きのある部屋を探して入る。無ければ自分で部屋を作って、人が来るのを待つ
  const searchRoom = async (kind) => {
    setMessage('');
    if (kind === 'veteran' && profile.level < RHYTHM_MULTI_VETERAN_MIN_LEVEL) { setMessage(`ベテランルームはブリーダーLv.${RHYTHM_MULTI_VETERAN_MIN_LEVEL}以上で入れます`); return; }
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
  const shareCode = async () => {
    if (!view) return;
    const text = `モンヒロビートで協力プレイしよう! 部屋コード: ${view.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* 共有をやめたときは何もしない */ }
  };

  const card = 'rounded-2xl border border-white/15 bg-slate-900/85 p-3';
  const btn = 'min-h-[48px] rounded-xl px-3 font-black disabled:opacity-40';
  const header = (title, onBackClick, extra) => (
    <header className="z-10 flex shrink-0 items-center gap-2 border-b border-cyan-400/15 bg-slate-950/95 px-2 py-1" style={{ paddingTop: 'calc(0.25rem + var(--mh-sa-top))' }}>
      <button data-rhythm-multi-back type="button" aria-label="戻る" className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-lg font-black text-slate-300" onClick={onBackClick}>←</button>
      <h2 className="min-w-0 flex-1 truncate text-sm font-black tracking-widest text-cyan-200">{title}</h2>
      {extra}
    </header>
  );
  const shell = 'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white';
  const countdownLayer = countdown && (
    <div data-rhythm-multi-countdown className="absolute inset-0 z-[90000] flex flex-col items-center justify-center bg-slate-950/90">
      <small className="text-[11px] font-black text-slate-400">抽選の結果</small>
      <p className="px-4 text-center text-base font-black text-cyan-200">{songById(countdown.info.songId) ? rhythmSongFullName(songById(countdown.info.songId)) : ''}</p>
      <b className="text-8xl font-black text-white">{Math.max(1, countdown.left)}</b>
    </div>
  );

  // ①ルーム選択
  if (!view && !searching) {
    return (
      <main data-rhythm-multi data-rhythm-multi-step="rooms" className={shell}>
        {header('🎮 みんなで対戦 / ルームえらび', onBack)}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <section className={card}>
            <p className="text-sm font-black text-cyan-100">みんなで同じ曲を演奏して、チームのランクを目指します</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">最大{RHYTHM_MULTI_ROOM_MAX}人。曲は全員の希望から抽選で決まり、結果は全員の平均スコアでチームのランクが決まります。個人スコア1位はMVPです。対戦の記録は、自己ベストにも全国ランキングにも残りません。</p>
          </section>
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
          <section className={`${card} space-y-2`}>
            <h3 className="text-xs font-black text-slate-300">知らない人と遊ぶ</h3>
            <button data-rhythm-multi-free type="button" className={`${btn} w-full bg-fuchsia-700`} onClick={() => searchRoom('free')}>フリールーム<small className="block text-[10px] font-bold text-fuchsia-100/80">だれでも入れます</small></button>
            <button data-rhythm-multi-veteran type="button" className={`${btn} w-full ${profile.level >= RHYTHM_MULTI_VETERAN_MIN_LEVEL ? 'bg-amber-700' : 'bg-slate-700'}`} onClick={() => searchRoom('veteran')}>ベテランルーム<small className="block text-[10px] font-bold text-amber-100/80">ブリーダーLv.{RHYTHM_MULTI_VETERAN_MIN_LEVEL}以上{profile.level >= RHYTHM_MULTI_VETERAN_MIN_LEVEL ? '' : '(まだ入れません)'}</small></button>
          </section>
          <section className={`${card} space-y-2`}>
            <h3 className="text-xs font-black text-slate-300">友だちと遊ぶ(プライベートルーム)</h3>
            <button data-rhythm-multi-create type="button" className={`${btn} w-full bg-indigo-700`} onClick={createPrivate}>部屋をつくる</button>
            <label className="block text-[11px] font-black text-slate-300" htmlFor="rhythm-multi-code">友だちの部屋コードで入る</label>
            <div className="flex gap-2">
              <input id="rhythm-multi-code" data-rhythm-multi-code-input value={codeInput} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-center text-xl font-black tracking-[0.4em] text-white" placeholder="ABCD" />
              <button data-rhythm-multi-join type="button" className={`${btn} bg-indigo-700`} onClick={joinPrivate}>入る</button>
            </div>
          </section>
          {message && <p data-rhythm-multi-message className="text-[12px] font-black text-rose-300">{message}</p>}
        </div>
      </main>
    );
  }

  // ②マッチング画面(部屋を探している間・部屋に入って人を待っている間)
  const slots = view ? view.members : [];
  const waitingForMatch = !view || (view.members.length < 2 && !resultVisible && !countdown);
  if (!view || (view.full) || waitingForMatch) {
    return (
      <main data-rhythm-multi data-rhythm-multi-step="matching" className={shell}>
        {header(`🎮 マッチング${view ? ` / ${RHYTHM_MULTI_MODE_LABELS[view.mode]}ルーム` : ''}`, () => { leaveRoom(); if (!view) onBack(); })}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {view && view.full
            ? <section data-rhythm-multi-full className={card}>
              <p className="text-sm font-black text-rose-300">この部屋はいっぱいです(最大{RHYTHM_MULTI_ROOM_MAX}人)</p>
              <button type="button" className={`${btn} mt-2 w-full bg-slate-700`} onClick={leaveRoom}>ルームえらびへ戻る</button>
            </section>
            : <>
              <section data-rhythm-multi-matching className={`${card} text-center`}>
                <p className="animate-pulse text-base font-black text-amber-200">{!view ? `${RHYTHM_MULTI_MODE_LABELS[searching]}ルームをさがしています…` : 'メンバーをさがしています…'}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">2人そろうと、曲えらびへ進みます</p>
                <ul className="mt-3 flex justify-center gap-2">
                  {Array.from({ length: RHYTHM_MULTI_ROOM_MAX }).map((_, i) => {
                    const m = slots[i];
                    return (
                      <li key={i} data-rhythm-multi-slot className={`flex h-16 w-14 flex-col items-center justify-center rounded-xl border px-1 text-[10px] font-black ${m ? 'border-cyan-300/60 bg-cyan-950/50 text-cyan-100' : 'border-white/10 bg-slate-950/50 text-slate-600'}`}>
                        <span aria-hidden="true" className="text-xl">{m ? (m.id === view.hostId ? '👑' : '🎵') : '…'}</span>
                        <span className="w-full truncate text-center">{m ? m.name : ''}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
              {view && <section className={`${card} flex items-center gap-3`}>
                <div className="min-w-0 flex-1">
                  <small className="block text-[10px] font-black text-slate-400">{RHYTHM_MULTI_MODE_LABELS[view.mode]}ルームの部屋コード</small>
                  <b data-rhythm-multi-room-code className="block text-3xl font-black tracking-[0.35em] text-cyan-200">{view.code}</b>
                  {view.status !== 'open' && <small className="block text-[10px] font-black text-amber-300">{view.status === 'connecting' ? '部屋へつないでいます…' : 'つなぎ直しています…'}</small>}
                </div>
                <button data-rhythm-multi-share type="button" className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-3 text-xs font-black" onClick={shareCode}>{copied ? 'コピーした!' : '友だちに送る'}</button>
              </section>}
              {view && isHost && view.mode === 'private' && me && (
                <button data-rhythm-multi-open type="button" onClick={() => RHYTHM_MULTI.setOpen(!me.open)}
                  className={`min-h-[48px] w-full rounded-xl px-3 text-sm font-black ${me.open ? 'bg-amber-600' : 'bg-slate-700'}`}>
                  {me.open ? 'ルーム解放中(タップでやめる)' : 'ルーム解放(知らない人も呼ぶ)'}
                </button>
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
              {view && <RhythmMultiChatPanel view={view} />}
              <button data-rhythm-multi-leave type="button" className={`${btn} w-full bg-slate-700`} onClick={leaveRoom}>{view ? '部屋を出る' : 'やめる'}</button>
            </>}
          {message && <p className="text-[12px] font-black text-rose-300">{message}</p>}
        </div>
      </main>
    );
  }

  // ③曲えらび(ソロと同じ画面。上に、いっしょに遊ぶ人の帯)
  const myDiffId = me && me.diff ? me.diff : defaultDiff;
  const drawnSong = start ? songById(start.songId) : null;
  const onSongId = (id) => { setSelSongId(id); setOmakase(false); RHYTHM_MULTI.setWish(id); };
  const onDifficultyId = (id) => { setSelDiffId(id); RHYTHM_MULTI.setDiff(id); };
  const onPlay = (song, difficulty) => {
    // 決定を押した時点の曲・難易度を、希望として確定させてから準備OK/スタートへ進む
    RHYTHM_MULTI.setWish(omakase ? '' : song.songId);
    RHYTHM_MULTI.setDiff(difficulty.id);
    if (isHost) RHYTHM_MULTI.hostStart(songIds);
    else RHYTHM_MULTI.setReady(!(me && me.ready));
  };
  const playLabel = isHost ? (everyoneReady ? 'スタート!(曲を抽選)' : 'みんなの準備待ち') : (me && me.ready ? '準備OK(取消)' : '準備OK!');
  return (
    <main data-rhythm-multi data-rhythm-multi-step="select" className={shell}>
      {header(`🎮 ${RHYTHM_MULTI_MODE_LABELS[view.mode]}ルーム ${view.code}`, leaveRoom,
        <>
          {team && team.rows.some((r) => r.res) && <button data-rhythm-multi-results-open type="button" aria-label="チームの結果" onClick={() => setDismissedResult('')} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-amber-400/50 bg-amber-950/40 text-lg">🏆</button>}
          <button data-rhythm-multi-chat-open type="button" aria-label="チャット" onClick={() => setChatOpen((v) => !v)} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-950/40 text-lg">💬</button>
        </>)}
      <ul data-rhythm-multi-strip className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-white/10 bg-slate-900/60 px-2 py-1.5">
        {view.members.map((m) => {
          const wished = songById(m.wish);
          return (
            <li key={m.id} data-rhythm-multi-member className="min-w-[108px] max-w-[150px] shrink-0 rounded-lg bg-slate-950/70 px-2 py-1 text-[11px] font-black leading-tight">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate">{m.id === view.hostId ? '👑' : ''}{m.name}{m.id === view.selfId ? '(あなた)' : ''}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <small className={`shrink-0 rounded-full px-1.5 py-px text-[9px] ${rhythmMultiStatusClass(m, view.hostId)}`}>{rhythmMultiStatusLabel(m, view.hostId)}</small>
                <small data-rhythm-multi-member-wish className="min-w-0 flex-1 truncate text-[9px] text-slate-400">{wished ? rhythmSongFullName(wished) : 'おまかせ'}</small>
              </div>
            </li>
          );
        })}
      </ul>
      <RhythmSongSelect
        songs={songs}
        difficulties={difficultyList}
        bestRecords={bestRecords}
        songId={selSongId}
        difficultyId={selDiffId || myDiffId}
        onSongId={onSongId}
        onDifficultyId={onDifficultyId}
        view={selectView}
        onView={setSelectView}
        onPlay={onPlay}
        playLabel={playLabel}
        playDisabled={isHost ? !canStart : !!countdown}
        hideRandom
        notice={<p className="rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-bold leading-snug text-slate-300">曲は全員の希望から抽選で決まります。難易度はそれぞれえらべます。</p>}
        footer={() => (
          <div className="grid grid-cols-2 gap-1.5">
            <button data-rhythm-multi-omakase type="button" aria-pressed={omakase}
              onClick={() => { const next = !omakase; setOmakase(next); RHYTHM_MULTI.setWish(next ? '' : selSongId); }}
              className={`flex min-h-[44px] items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-black leading-tight ${omakase ? 'border-amber-300 bg-amber-600/80 text-white' : 'border-white/15 bg-slate-900/80 text-slate-300'}`}>🎲 おまかせ{omakase ? ' ON' : ''}</button>
            <button data-rhythm-multi-leave type="button" onClick={leaveRoom}
              className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-slate-900/80 px-1 text-[11px] font-black text-slate-300">部屋を出る</button>
          </div>
        )} />
      {chatOpen && (
        <div data-rhythm-multi-chat-sheet className="absolute inset-x-0 bottom-0 z-[80000] max-h-[70%] overflow-y-auto border-t border-cyan-400/30 bg-slate-950/98 p-2" style={{ paddingBottom: 'calc(.5rem + var(--mh-sa-bottom))' }}>
          <RhythmMultiChatPanel view={view} />
          <button type="button" className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 font-black" onClick={() => setChatOpen(false)}>閉じる</button>
        </div>
      )}
      {resultVisible && (
        <div data-rhythm-multi-result-sheet className="absolute inset-0 z-[85000] overflow-y-auto bg-slate-950/95 p-3" style={{ paddingTop: 'calc(.75rem + var(--mh-sa-top))' }}>
          <RhythmMultiResultCard view={view} team={team} song={drawnSong} />
          <button type="button" className="mt-3 min-h-[48px] w-full rounded-xl bg-indigo-700 font-black" onClick={() => setDismissedResult(start.startId)}>曲えらびへ戻る</button>
        </div>
      )}
      {countdownLayer}
    </main>
  );
}
