// ===== モンヒロビート マルチ(同じ曲でスコア対決) =====
// 部屋のコードを友だちに伝えて集まり、同じ曲・同じ難易度を同時に演奏して、終わったあとにスコアを比べる。
// 通信は Supabase Realtime の「Broadcast」だけを使う。テーブルもSQLも要らず、保存データ(mh_*)・
// ランキング(rankings)には一切触れない(マルチの演奏は自己ベストにも全国ランキングにも残さない)。
// 演奏は各自の端末で完結するので、通信の遅れは判定に影響しない。流れるのは
// 「いま部屋にいる」「準備できた」「始める」「スコア」の短い知らせだけ。
//
// 作り:
//  ・部屋の持ち主(サーバー役)はいない。全員が2秒ごとに自分の状態を知らせ(hb)、7秒聞こえない人は抜けた扱い。
//    「部屋主」は、いる人の中でいちばん早く入った人(同時なら id の小さい人)。全員が同じ並びを計算できる。
//  ・画面を行き来しても部屋が切れないよう、状態は React の外(このファイルの RHYTHM_MULTI)に置く。
const RHYTHM_MULTI_ROOM_MAX = 4;
const RHYTHM_MULTI_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RHYTHM_MULTI_CODE_LENGTH = 4;
const RHYTHM_MULTI_HEARTBEAT_MS = 2000;
const RHYTHM_MULTI_ALIVE_MS = 7000;
const RHYTHM_MULTI_START_COUNTDOWN_SEC = 3;
const RHYTHM_MULTI_CHAT_MAX_LENGTH = 40;
const RHYTHM_MULTI_CHAT_KEEP = 50;
const RHYTHM_MULTI_CHAT_INTERVAL_MS = 800;
const RHYTHM_MULTI_CHAT_STAMPS = Object.freeze(['よろしく!', 'ナイス!', '準備OK!', 'もう一回!', 'ありがとう!']);
const RHYTHM_MULTI_TOPIC_PREFIX = 'realtime:mhb-room-';

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
    if (raw.sel && typeof raw.sel === 'object') {
      out.sel = { songId: rhythmMultiText(raw.sel.songId, 60), difficultyId: rhythmMultiText(raw.sel.difficultyId, 20) };
    }
    if (raw.res && typeof raw.res === 'object') out.res = rhythmMultiCleanResult(raw.res);
    return out;
  }
  if (raw.t === 'start') {
    out.startId = rhythmMultiText(raw.startId, 40);
    out.songId = rhythmMultiText(raw.songId, 60);
    out.difficultyId = rhythmMultiText(raw.difficultyId, 20);
    return out.startId && out.songId && out.difficultyId ? out : null;
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
  };
};

// ---- 通信(Supabase Realtime を Phoenix のことばで直接話す。ライブラリは足さない) ----
const rhythmMultiOpenSocket = ({ code, onOpen, onMessage, onClose }) => {
  const topic = RHYTHM_MULTI_TOPIC_PREFIX + code;
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
  let hbTimer = null;
  let sweepTimer = null;
  let reconnectTimer = null;
  const emit = () => { listeners.forEach((fn) => { try { fn(); } catch (_) { /* 画面側の失敗で通信を止めない */ } }); };
  const alive = () => (s ? Object.values(s.members).filter((m) => Date.now() - m.seen <= RHYTHM_MULTI_ALIVE_MS || m.id === s.selfId) : []);
  const selfMember = () => (s ? s.members[s.selfId] : null);
  const sendHb = () => {
    const me = selfMember();
    if (!s || !socket || !me) return;
    socket.send({ t: 'hb', id: s.selfId, name: me.name, level: me.level, joinedAt: me.joinedAt, ready: me.ready, playing: me.playing, sel: me.sel || undefined, res: me.res || undefined });
  };
  const stopTimers = () => {
    if (hbTimer) clearInterval(hbTimer);
    if (sweepTimer) clearInterval(sweepTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    hbTimer = sweepTimer = reconnectTimer = null;
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
    const prev = s.members[msg.id] || { id: msg.id, name: '', level: 0, joinedAt: 0, ready: false, playing: false, sel: null, res: null };
    if (msg.t === 'hb') {
      // 自分の状態は自分が持っているものが正しいので、自分の知らせでは上書きしない
      if (msg.id !== s.selfId) s.members[msg.id] = { ...prev, name: msg.name, level: msg.level, joinedAt: msg.joinedAt, ready: msg.ready, playing: msg.playing, sel: msg.sel || null, res: msg.res || prev.res, seen: Date.now() };
      else prev.seen = Date.now();
    } else if (msg.t === 'res') {
      s.members[msg.id] = { ...prev, res: msg.res, playing: false, seen: Date.now() };
    } else if (msg.t === 'start') {
      // 始めの合図は、部屋主から出たものだけ受ける。同じ合図(startId)は2度受けない
      const order = rhythmMultiSortMembers(alive());
      if (order.length && order[0].id === msg.id && s.start?.startId !== msg.startId) {
        s.start = { startId: msg.startId, songId: msg.songId, difficultyId: msg.difficultyId, receivedAt: Date.now() };
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
      code: s.code,
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
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onStart(fn) { startListeners.add(fn); return () => startListeners.delete(fn); },
    // 画面へ見せる形に直して返す。毎回新しい値を返すので、呼ぶ側は emit のたびに作り直してよい
    view() {
      if (!s) return null;
      const order = rhythmMultiSortMembers(alive());
      const selfIndex = order.findIndex((m) => m.id === s.selfId);
      return {
        code: s.code, status: s.status, selfId: s.selfId,
        members: order.slice(0, RHYTHM_MULTI_ROOM_MAX),
        hostId: order.length ? order[0].id : s.selfId,
        full: selfIndex >= RHYTHM_MULTI_ROOM_MAX,
        start: s.start,
        chat: s.chat.slice(),
      };
    },
    join(code, profile) {
      this.leave();
      const now = Date.now();
      const id = rhythmMultiMakeId();
      s = { code, status: 'connecting', selfId: id, start: null, members: {}, chat: [], lastChatAt: 0 };
      s.members[id] = { id, name: rhythmMultiText(profile && profile.name, 12) || '名無しのブリーダー', level: rhythmMultiInt(profile && profile.level, 9999), joinedAt: now, ready: false, playing: false, sel: null, res: null, seen: now };
      connect();
      hbTimer = setInterval(sendHb, RHYTHM_MULTI_HEARTBEAT_MS);
      sweepTimer = setInterval(emit, 1000);
      emit();
    },
    leave() {
      if (socket) { try { socket.send({ t: 'bye', id: s && s.selfId }); } catch (_) { /* 無視 */ } socket.close(); }
      socket = null;
      stopTimers();
      s = null;
      emit();
    },
    isHost() { const v = this.view(); return !!v && v.hostId === v.selfId; },
    setSelection(songId, difficultyId) {
      const me = selfMember();
      if (!me) return;
      me.sel = { songId: rhythmMultiText(songId, 60), difficultyId: rhythmMultiText(difficultyId, 20) };
      sendHb(); emit();
    },
    setReady(ready) {
      const me = selfMember();
      if (!me) return;
      me.ready = ready === true;
      sendHb(); emit();
    },
    // 部屋主だけが呼べる。曲が決まっていて、部屋主以外の全員が準備できているときだけ始まる
    hostStart() {
      const v = this.view();
      if (!v || !socket || v.hostId !== v.selfId) return false;
      const me = selfMember();
      if (!me || !me.sel || !me.sel.songId || !me.sel.difficultyId) return false;
      if (v.members.length < 2 || !v.members.every((m) => m.id === v.selfId || m.ready)) return false;
      me.ready = true;
      socket.send({ t: 'start', id: v.selfId, startId: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, songId: me.sel.songId, difficultyId: me.sel.difficultyId });
      return true;
    },
    // 曲が終わった(または途中でやめた)ときに、自分のスコアを部屋へ知らせる。同じ回の2度目は無視する
    reportResult(startId, result, quit) {
      const me = selfMember();
      if (!me || !startId) return;
      if (me.res && me.res.startId === startId) return;
      me.res = rhythmMultiCleanResult({ startId, score: result && result.score, maxCombo: result && result.maxCombo, cleared: result ? result.cleared !== false : false, quit: quit === true });
      me.playing = false;
      me.ready = false;
      if (socket) socket.send({ t: 'res', id: s.selfId, res: me.res });
      sendHb(); emit();
    },
    // 部屋へ一言送る。自分の発言も部屋からの返りで表示する(=相手にも届いたと分かる)。続けて送るのは受けない
    sendChat(text) {
      if (!s || !socket) return false;
      const clean = rhythmMultiText(text, RHYTHM_MULTI_CHAT_MAX_LENGTH).trim();
      const me = selfMember();
      if (!clean || !me || Date.now() - s.lastChatAt < RHYTHM_MULTI_CHAT_INTERVAL_MS) return false;
      s.lastChatAt = Date.now();
      return socket.send({ t: 'chat', id: s.selfId, name: me.name, text: clean, cid: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}` });
    },
    hasReported(startId) { const me = selfMember(); return !!(me && me.res && me.res.startId === startId); },
  };
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

// ---- 画面 ----
// songs / difficulties は曲えらびと同じ一覧(rhythmDemoSongs など)。onStartPlay は演奏画面へ入る処理を親が持つ
function RhythmMultiScreen({ profile, songs, difficultiesOf, onBack, onStartPlay }) {
  const view = useRhythmMultiView();
  const [codeInput, setCodeInput] = React.useState('');
  const [codeError, setCodeError] = React.useState('');
  const [countdown, setCountdown] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const [chatText, setChatText] = React.useState('');
  const chatListRef = React.useRef(null);
  const chatCount = view && view.chat ? view.chat.length : 0;
  React.useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatCount]);
  const submitChat = () => { if (RHYTHM_MULTI.sendChat(chatText)) setChatText(''); };
  const songById = (songId) => songs.find((song) => song.songId === songId) || null;
  const me = view ? view.members.find((m) => m.id === view.selfId) : null;
  const isHost = !!view && view.hostId === view.selfId;
  const host = view ? view.members.find((m) => m.id === view.hostId) : null;
  // 曲の選択は部屋主の知らせが正。部屋主自身は自分の選択
  const sel = host && host.sel && songById(host.sel.songId) ? host.sel : null;
  const selSong = sel ? songById(sel.songId) : null;
  const selDiffs = selSong ? difficultiesOf(selSong) : [];
  const selDifficulty = sel ? selDiffs.find((d) => d.id === sel.difficultyId) || null : null;
  const start = view ? view.start : null;
  const resultsOfRound = start && view ? view.members.map((m) => ({ m, res: m.res && m.res.startId === start.startId ? m.res : null })) : [];
  const roundStarted = !!start && resultsOfRound.some((r) => r.m.playing || r.res);
  const everyoneReady = !!view && view.members.length >= 2 && view.members.every((m) => m.id === view.selfId || m.ready);

  // 合図が来たら 3・2・1 を数えて演奏へ入る。数えるのは受け取った時刻から(端末の時計のずれに左右されない)
  React.useEffect(() => RHYTHM_MULTI.onStart((info) => {
    setCountdown({ info, left: RHYTHM_MULTI_START_COUNTDOWN_SEC });
  }), []);
  React.useEffect(() => {
    if (!countdown) return undefined;
    if (countdown.left <= 0) {
      const song = songById(countdown.info.songId);
      const diff = song ? difficultiesOf(song).find((d) => d.id === countdown.info.difficultyId) : null;
      setCountdown(null);
      if (song && diff) onStartPlay(song, diff, countdown.info.startId);
      else RHYTHM_MULTI.reportResult(countdown.info.startId, null, true);
      return undefined;
    }
    const timer = setTimeout(() => setCountdown((c) => (c ? { ...c, left: c.left - 1 } : c)), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const createRoom = () => { setCodeError(''); RHYTHM_MULTI.join(rhythmMultiMakeCode(), profile); };
  const joinRoom = () => {
    const code = rhythmMultiNormalizeCode(codeInput);
    if (!code) { setCodeError(`部屋コードは${RHYTHM_MULTI_CODE_LENGTH}文字です`); return; }
    setCodeError('');
    RHYTHM_MULTI.join(code, profile);
  };
  const leaveRoom = () => { RHYTHM_MULTI.leave(); setCountdown(null); };
  const shareCode = async () => {
    if (!view) return;
    const text = `モンヒロビートで対戦しよう! 部屋コード: ${view.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { /* 共有をやめたときは何もしない */ }
  };
  const statusText = !view ? '' : view.status === 'open' ? '' : view.status === 'connecting' ? '部屋へつないでいます…' : 'つなぎ直しています…';
  const canStart = isHost && !!selDifficulty && everyoneReady && !countdown;

  const card = 'rounded-2xl border border-white/15 bg-slate-900/85 p-3';
  const btn = 'min-h-[48px] rounded-xl px-3 font-black disabled:opacity-40';
  const header = (
    <header className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2" style={{ paddingTop: 'calc(.5rem + var(--mh-sa-top))' }}>
      <button data-rhythm-multi-back type="button" className="min-h-[44px] min-w-[44px] rounded-xl border border-white/20 bg-slate-800 px-3 font-black" onClick={() => { if (view) leaveRoom(); onBack(); }}>←</button>
      <h2 className="min-w-0 flex-1 truncate text-sm font-black tracking-widest text-cyan-200">🎮 みんなで対戦</h2>
    </header>
  );

  if (!view) {
    return (
      <main data-rhythm-multi className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
        {header}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          <section className={card}>
            <p className="text-sm font-black text-cyan-100">同じ曲を同時に演奏して、スコアで勝負します</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">最大{RHYTHM_MULTI_ROOM_MAX}人。部屋コードを友だちに伝えて集まりましょう。対戦の記録は、自己ベストにも全国ランキングにも残りません。</p>
          </section>
          <section className={card}>
            <button data-rhythm-multi-create type="button" className={`${btn} w-full bg-fuchsia-700`} onClick={createRoom}>部屋をつくる</button>
          </section>
          <section className={card}>
            <label className="block text-[11px] font-black text-slate-300" htmlFor="rhythm-multi-code">友だちの部屋コードで入る</label>
            <div className="mt-1 flex gap-2">
              <input id="rhythm-multi-code" data-rhythm-multi-code-input value={codeInput} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-center text-xl font-black tracking-[0.4em] text-white" placeholder="ABCD" />
              <button data-rhythm-multi-join type="button" className={`${btn} bg-indigo-700`} onClick={joinRoom}>入る</button>
            </div>
            {codeError && <p className="mt-1 text-[11px] font-black text-rose-300">{codeError}</p>}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main data-rhythm-multi className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950 text-white">
      {header}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {view.full ? (
          <section data-rhythm-multi-full className={card}>
            <p className="text-sm font-black text-rose-300">この部屋はいっぱいです(最大{RHYTHM_MULTI_ROOM_MAX}人)</p>
            <button type="button" className={`${btn} mt-2 w-full bg-slate-700`} onClick={leaveRoom}>部屋をやめる</button>
          </section>
        ) : (<>
          <section className={`${card} flex items-center gap-3`}>
            <div className="min-w-0 flex-1">
              <small className="block text-[10px] font-black text-slate-400">部屋コード</small>
              <b data-rhythm-multi-room-code className="block text-3xl font-black tracking-[0.35em] text-cyan-200">{view.code}</b>
              {statusText && <small className="block text-[10px] font-black text-amber-300">{statusText}</small>}
            </div>
            <button data-rhythm-multi-share type="button" className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-3 text-xs font-black" onClick={shareCode}>{copied ? 'コピーした!' : '友だちに送る'}</button>
          </section>

          <section className={card}>
            <h3 className="text-xs font-black text-slate-300">メンバー({view.members.length}/{RHYTHM_MULTI_ROOM_MAX})</h3>
            <ul className="mt-1 space-y-1">
              {view.members.map((m) => (
                <li key={m.id} data-rhythm-multi-member className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5 text-sm font-black">
                  <span className="min-w-0 flex-1 truncate">{m.id === view.hostId ? '👑 ' : ''}{m.name}{m.id === view.selfId ? '(あなた)' : ''}</span>
                  <small className="shrink-0 text-[10px] text-slate-400">Lv.{m.level}</small>
                  <small className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${m.playing ? 'bg-amber-500/80 text-slate-950' : m.ready || m.id === view.hostId ? 'bg-emerald-500/80 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>{m.playing ? '演奏中' : m.id === view.hostId ? '部屋主' : m.ready ? '準備OK' : '待機中'}</small>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h3 className="text-xs font-black text-slate-300">曲</h3>
            {isHost ? (
              <div className="mt-1 space-y-2">
                <select data-rhythm-multi-song aria-label="曲" className="min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-950 px-2 text-sm font-black"
                  value={sel ? sel.songId : ''}
                  onChange={(e) => { const song = songById(e.target.value); if (!song) return; const diffs = difficultiesOf(song); const keep = diffs.find((d) => sel && d.id === sel.difficultyId) || diffs[0]; RHYTHM_MULTI.setSelection(song.songId, keep ? keep.id : ''); }}>
                  <option value="">曲をえらぶ</option>
                  {songs.map((song) => <option key={song.songId} value={song.songId}>{rhythmSongFullName(song)}</option>)}
                </select>
                {selSong && <div className="flex flex-wrap gap-1.5">
                  {selDiffs.map((d) => (
                    <button key={d.id} data-rhythm-multi-difficulty={d.id} type="button" onClick={() => RHYTHM_MULTI.setSelection(selSong.songId, d.id)}
                      className={`min-h-[40px] rounded-lg px-3 text-xs font-black ${selDifficulty && selDifficulty.id === d.id ? 'bg-fuchsia-600' : 'bg-slate-700'}`}>{d.id}</button>
                  ))}
                </div>}
              </div>
            ) : (
              <p data-rhythm-multi-selection className="mt-1 text-sm font-black">{selSong ? `${rhythmSongFullName(selSong)} / ${sel.difficultyId}` : '部屋主が曲をえらんでいます…'}</p>
            )}
          </section>

          {roundStarted && (
            <section data-rhythm-multi-results className={card}>
              <h3 className="text-xs font-black text-slate-300">結果{songById(start.songId) ? `(${rhythmSongFullName(songById(start.songId))} / ${start.difficultyId})` : ''}</h3>
              <ol className="mt-1 space-y-1">
                {resultsOfRound.slice().sort((a, b) => (b.res ? b.res.score : -1) - (a.res ? a.res.score : -1)).map((r, i) => (
                  <li key={r.m.id} data-rhythm-multi-result-row className="flex items-center gap-2 rounded-lg bg-slate-950/60 px-2 py-1.5 text-sm font-black">
                    <span className="w-6 shrink-0 text-center text-amber-300">{r.res && !r.res.quit ? i + 1 : '-'}</span>
                    <span className="min-w-0 flex-1 truncate">{r.m.name}{r.m.id === view.selfId ? '(あなた)' : ''}</span>
                    <span className="shrink-0 tabular-nums">{r.res ? (r.res.quit ? 'リタイア' : `${r.res.score.toLocaleString()}${r.res.cleared ? '' : '(失敗)'}`) : r.m.playing ? '演奏中…' : '—'}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section data-rhythm-multi-chat className={card}>
            <h3 className="text-xs font-black text-slate-300">チャット</h3>
            <ul ref={chatListRef} data-rhythm-multi-chat-list className="mt-1 max-h-40 min-h-[3rem] space-y-1 overflow-y-auto rounded-lg bg-slate-950/60 p-2 text-sm font-bold">
              {view.chat.length === 0 && <li className="text-[11px] text-slate-500">まだ発言はありません</li>}
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
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); submitChat(); }}>
              <input data-rhythm-multi-chat-input value={chatText} maxLength={RHYTHM_MULTI_CHAT_MAX_LENGTH} autoComplete="off" enterKeyHint="send"
                onChange={(e) => setChatText(e.target.value)} placeholder={`ひとこと(${RHYTHM_MULTI_CHAT_MAX_LENGTH}文字まで)`}
                className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-950 px-3 text-base font-bold text-white" />
              <button data-rhythm-multi-chat-send type="submit" disabled={!chatText.trim()} className="min-h-[44px] shrink-0 rounded-xl bg-cyan-700 px-4 text-sm font-black disabled:opacity-40">送信</button>
            </form>
          </section>

          <section className="space-y-2">
            {isHost
              ? <button data-rhythm-multi-start type="button" disabled={!canStart} className={`${btn} w-full bg-fuchsia-700`} onClick={() => RHYTHM_MULTI.hostStart()}>
                {canStart ? 'スタート!' : view.members.length < 2 ? '友だちが入るのを待っています' : !selDifficulty ? '曲と難易度をえらんでください' : 'みんなの準備を待っています'}
              </button>
              : <button data-rhythm-multi-ready type="button" disabled={!selDifficulty || !!countdown} className={`${btn} w-full ${me && me.ready ? 'bg-emerald-700' : 'bg-indigo-700'}`} onClick={() => RHYTHM_MULTI.setReady(!(me && me.ready))}>
                {me && me.ready ? '準備OK(タップで取り消し)' : '準備OK!'}
              </button>}
            <button data-rhythm-multi-leave type="button" className={`${btn} w-full bg-slate-700`} onClick={leaveRoom}>部屋を出る</button>
          </section>
        </>)}
      </div>
      {countdown && (
        <div data-rhythm-multi-countdown className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90">
          <p className="text-sm font-black text-cyan-200">{songById(countdown.info.songId) ? rhythmSongFullName(songById(countdown.info.songId)) : ''}</p>
          <b className="text-8xl font-black text-white">{Math.max(1, countdown.left)}</b>
        </div>
      )}
    </main>
  );
}
