// ===== モンヒロビート「助手とのセッション」の保存と画面(呼ぶシートの助手のタブ・結果の行・部屋の中の頭の振り分け) =====
// 設計の正本: docs/progress/beat-assistant-session/PLAN.md。計算は 33-rhythm-assistant-session.jsx(純粋)。
// 部屋の中の動きはマスモンの作り(77-screen-rhythm-multi.jsx の cpus・80-screen-rhythm-buddy.jsx の頭)をそのまま使い、
// 助手は masuId を 'as:<助手id>' にして見分ける。回数・控えはマスモンと同じ mh_rhythm_buddy_v1(控えに kind・assistantId を足す)。
// ★公開の印 RELEASE_FLAGS.rhythmAssistantSession の後ろ(rhythmAssistSessionEnabled)

// 保存の窓口(マスモンの RHYTHM_BUDDY_STORE と同じ作り。読むときは必ず正規化する)
const RHYTHM_ASSIST_SESSION_STORE = (() => {
  let state = rhythmAssistSessionNormalize(null);
  let loaded = false;
  let chain = Promise.resolve();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (_) { /* 画面側の失敗で保存を止めない */ } });
  return {
    get: () => state,
    load() {
      chain = chain.then(async () => {
        try { state = rhythmAssistSessionNormalize(await storeGet(RHYTHM_ASSIST_SESSION_KEY, null)); } catch (_) { /* 既定値のまま */ }
        loaded = true;
        emit();
      });
      return chain;
    },
    update(fn) {
      let out = null;
      chain = chain.then(async () => {
        if (!loaded) {
          try { state = rhythmAssistSessionNormalize(await storeGet(RHYTHM_ASSIST_SESSION_KEY, null)); } catch (_) { /* 既定値のまま */ }
          loaded = true;
        }
        const next = fn(state);
        if (!next) return;
        out = rhythmAssistSessionNormalize(next);
        state = out;
        try { await storeSet(RHYTHM_ASSIST_SESSION_KEY, state); } catch (_) { /* 保存できなくても遊びは続ける */ }
        emit();
      });
      return chain.then(() => out);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
})();
const useRhythmAssistSessionState = () => {
  const [state, setState] = React.useState(() => RHYTHM_ASSIST_SESSION_STORE.get());
  React.useEffect(() => {
    const off = RHYTHM_ASSIST_SESSION_STORE.subscribe(setState);
    void RHYTHM_ASSIST_SESSION_STORE.load();
    return off;
  }, []);
  return state;
};
const rhythmAssistSessionWho = (assistantId) => (typeof assistantById === 'function' ? assistantById(assistantId) : null);
// 好きな曲の名前(曲の別の版は1つにまとめる。一覧に無い曲は出さない)
const rhythmAssistSessionLikedNames = (assistantId) => {
  const t = RHYTHM_ASSIST_SESSION_TASTE[assistantId];
  const songs = typeof RHYTHM_SONGS !== 'undefined' && Array.isArray(RHYTHM_SONGS) ? RHYTHM_SONGS : [];
  return t ? t.like.map((ids) => { const song = songs.find((x) => x && ids.includes(x.songId)); return song ? String(song.displayName || '') : ''; }).filter(Boolean) : [];
};
const rhythmAssistSessionName = (assistantId) => { const who = rhythmAssistSessionWho(assistantId); return String((who && who.name) || '助手').slice(0, 12); };

// 台詞は 33-rhythm-assistant-session-lines.jsx(docs/progress/beat-assistant-session/lines/*.txt から生成)。
// 助手ごとに直近に言った台詞を覚えて避ける(保存しない)。同じ曲で同じ台詞を出さないため
const RHYTHM_ASSIST_SESSION_RECENT = new Map();
const RHYTHM_ASSIST_SESSION_RECENT_KEEP = 12;
// 場面の台詞を1つ選ぶ。[表情, 台詞]。無ければ null
const rhythmAssistSessionPickLine = (assistantId, scene, rand = Math.random) => {
  const table = typeof RHYTHM_ASSIST_SESSION_SOLO_LINES !== 'undefined' ? RHYTHM_ASSIST_SESSION_SOLO_LINES[assistantId] : null;
  const list = table && Array.isArray(table[scene]) ? table[scene] : [];
  if (!list.length) return null;
  const recent = RHYTHM_ASSIST_SESSION_RECENT.get(assistantId) || [];
  const fresh = list.filter((x) => !recent.includes(x[1]));
  const pool = fresh.length ? fresh : list;
  const hit = pool[Math.floor(rand() * pool.length)];
  RHYTHM_ASSIST_SESSION_RECENT.set(assistantId, [hit[1], ...recent.filter((t) => t !== hit[1])].slice(0, RHYTHM_ASSIST_SESSION_RECENT_KEEP));
  return hit;
};
// 好きな曲・苦手な曲の結果の専用(曲の別の版も同じ曲として探す)
const rhythmAssistSessionSongScene = (assistantId, songId) => {
  const table = typeof RHYTHM_ASSIST_SESSION_SOLO_LINES !== 'undefined' ? RHYTHM_ASSIST_SESSION_SOLO_LINES[assistantId] : null;
  if (!table || !songId) return '';
  if (table[`song:${songId}`]) return `song:${songId}`;
  const t = RHYTHM_ASSIST_SESSION_TASTE[assistantId];
  const family = t ? [...t.like.find((ids) => ids.includes(songId)) || [], ...(t.dislike.includes(songId) ? t.dislike : [])] : [];
  const key = family.map((id) => `song:${id}`).find((k) => table[k]);
  return key || '';
};
const rhythmAssistSessionRatio = (score, diffId) => {
  const diffDef = (typeof RHYTHM_PLAY_DIFFICULTIES !== 'undefined' ? RHYTHM_PLAY_DIFFICULTIES : []).find((d) => d.id === diffId);
  return Number(score) / ((diffDef && diffDef.maxScore) || 1000000);
};
// 部屋のチャットで話すひとこと(cpuBrain.talk の助手の分)。kind は部屋(77)が渡す場面の名前
//   join … 部屋に来た / pick・song … 曲が決まった(はじめて・好き・苦手) / result … 自分の結果(MVP のときだけ話す)
//   reactResult … 呼んだ人の結果(フル コン・高い・ふつう・低い・好きな曲の専用・苦手を乗りこえた) / lvUp・likeUp … 育った
const rhythmAssistSessionTalk = ({ assistantId, kind, songId = '', score = 0, diffId = '', mvp = false, fc = 0, quit = false, rand = Math.random }) => {
  const say = (scene) => { const hit = rhythmAssistSessionPickLine(assistantId, scene, rand); return hit ? hit[1] : ''; };
  const roomSong = () => {
    const v = typeof RHYTHM_MULTI !== 'undefined' ? RHYTHM_MULTI.view() : null;
    return (v && v.room && v.room.songId) || '';
  };
  if (kind === 'join') return say('join');
  if (kind === 'combo' || kind === 'miss' || kind === 'climax' || kind === 'last') return say(kind);
  if (kind === 'lvUp') return say('levelup');
  if (kind === 'likeUp') return say('likeup');
  if (kind === 'pick' || kind === 'song') {
    if (!songId) return '';
    const taste = rhythmAssistSessionTaste(assistantId, songId);
    if (taste === 'like') return say('like');
    if (taste === 'dislike') return say('dislike');
    const mon = rhythmAssistSessionMon(RHYTHM_ASSIST_SESSION_STORE.get(), assistantId);
    return !(mon.songs && mon.songs[songId]) && rand() < 0.6 ? say('first') : '';
  }
  if (kind === 'result') return mvp ? say('mvp') : '';
  if (kind === 'reactResult') {
    if (quit) return '';
    const sid = songId || roomSong();
    const special = rhythmAssistSessionSongScene(assistantId, sid);
    if (special && rand() < 0.5) return say(special);
    if (rhythmAssistSessionTaste(assistantId, sid) === 'dislike' && rand() < 0.5) return say('overcome');
    if (Number(fc) > 0) return say('fc');
    const ratio = rhythmAssistSessionRatio(score, diffId);
    return say(ratio >= 0.9 ? 'high' : ratio < 0.7 ? 'low' : 'mid');
  }
  return '';
};

// 部屋の中の「頭」を助手にも効くように包む。masuId が 'as:…' のときだけ助手の計算へ回し、ほかはマスモンのまま
const rhythmAssistSessionWrapBrain = (brain, songs) => ({
  ...brain,
  play(args) {
    const aid = rhythmAssistSessionIdOf(args && args.masuId);
    if (!aid) return brain.play(args);
    const { songId, diffId, humans = 1 } = args;
    const song = (songs || []).find((x) => x.songId === songId);
    const chart = song && song.difficulties ? song.difficulties[diffId] : null;
    const totalNotes = chart ? (Number(chart.totalNotes) > 0 ? Number(chart.totalNotes) : Array.isArray(chart.notes) ? chart.notes.length : 300) : 300;
    const diffDef = (typeof RHYTHM_PLAY_DIFFICULTIES !== 'undefined' ? RHYTHM_PLAY_DIFFICULTIES : []).find((d) => d.id === diffId);
    return rhythmAssistSessionPlay({
      state: RHYTHM_ASSIST_SESSION_STORE.get(), assistantId: aid, songId, diffId, totalNotes, maxScore: diffDef ? diffDef.maxScore : 1000000,
      durationMs: (chart && Number(chart.durationMs)) || (song ? Number(song.playDurationMs) || 0 : 0), rand: Math.random,
      chartLevel: chart ? Number(chart.level) || 0 : 0, humans, nowMs: Date.now(),
    });
  },
  talk(args) {
    const aid = rhythmAssistSessionIdOf(args && args.masuId);
    if (!aid) return brain.talk(args);
    try { return rhythmAssistSessionTalk({ assistantId: aid, ...args }); } catch (_) { return ''; }
  },
  style(masuId) { return rhythmAssistSessionIdOf(masuId) ? { ask: 0, starter: [1, 1, 1] } : brain.style(masuId); },
  pair(a, b) { return rhythmAssistSessionIdOf(a) || rhythmAssistSessionIdOf(b) ? 'banter' : brain.pair(a, b); },
  pick(catalog, masuId) {
    const aid = rhythmAssistSessionIdOf(masuId);
    return aid ? rhythmAssistSessionChooseSong(RHYTHM_ASSIST_SESSION_STORE.get(), aid, catalog) : brain.pick(catalog, masuId);
  },
});

// 呼ぶシートの「助手」のタブの中身。カードを押して選び、下の帯の「呼ぶ」で呼ぶ(マスモンのタブと同じ流れ)
function RhythmAssistSessionPicker({ assistants = [], calledIds = [], canPay = true, busy = false, onPick }) {
  const state = useRhythmAssistSessionState();
  const [selId, setSelId] = React.useState('');
  const list = (assistants || []).filter((who) => who && RHYTHM_ASSIST_SESSION_IDS.includes(who.id));
  const sel = list.find((who) => who.id === selId) || null;
  const calledOf = (id) => calledIds.includes(rhythmAssistSessionKey(id));
  return (
    <div data-rhythm-assist-picker className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.length === 0
          ? <p className="py-6 text-center text-[12px] font-bold text-slate-400">まだ呼べる助手がいません</p>
          : <div className="grid grid-cols-3 gap-2.5 pb-4">
            {list.map((who) => {
              const lv = rhythmAssistSessionLevel(state, who.id);
              return (
                <button key={who.id} type="button" data-rhythm-assist-card={who.id} onClick={() => setSelId(who.id)}
                  className={`flex min-h-[112px] w-full flex-col items-center gap-1 rounded-2xl border-2 p-2 active:scale-95 ${selId === who.id ? 'border-pink-300 bg-slate-800' : 'border-white/10 bg-slate-900'}`}>
                  <AssistantFace who={who} size={48} accent={who.accent} expression={selId === who.id ? 'happy' : null} />
                  <span className="w-full truncate rounded-lg border border-white/10 bg-slate-950/70 px-1 py-0.5 text-center text-[11px] font-black">{who.name}</span>
                  <span className="whitespace-nowrap text-[10px] font-black text-pink-200">セッションLv.{lv}</span>
                  {calledOf(who.id) && <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">呼んでいる</span>}
                </button>
              );
            })}
          </div>}
      </div>
      {sel
        ? (
          <div data-rhythm-assist-confirm className="mt-2 flex shrink-0 items-center gap-2 rounded-2xl border border-pink-300/40 bg-slate-950/80 p-2">
            <AssistantFace who={sel} size={44} accent={sel.accent} expression="happy" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[13px] font-black">{sel.name}</b>
              <small className="block whitespace-nowrap text-[10px] font-bold text-pink-200">セッションLv.{rhythmAssistSessionLevel(state, sel.id)}</small>
              <small data-rhythm-assist-taste className="block truncate text-[10px] font-bold text-slate-300">{rhythmAssistSessionLevel(state, sel.id) >= RHYTHM_ASSIST_SESSION_TASTE_LEVEL
                ? `♡ ${rhythmAssistSessionLikedNames(sel.id).join('・')}`
                : `Lv.${RHYTHM_ASSIST_SESSION_TASTE_LEVEL} で好きな曲が分かります`}</small>
            </span>
            {calledOf(sel.id)
              ? <span data-rhythm-assist-called className="shrink-0 rounded-xl border border-lime-300/50 px-2 py-3 text-[10px] font-black text-lime-200">呼んでいる</span>
              : <button data-rhythm-assist-call type="button" disabled={busy || !canPay} onClick={() => onPick && onPick(sel)}
                className="min-h-[44px] shrink-0 rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 px-4 text-sm font-black text-slate-950 disabled:opacity-40">呼ぶ</button>}
          </div>
        )
        : <p className="mt-2 text-center text-[11px] font-bold text-slate-400">呼びたい助手をタップしてください</p>}
    </div>
  );
}

// セッションLv が上がったときの祝い(演出担当ハナビの 44-growth-fx.jsx の growthFxSessionLevel)。その回に上がった助手を、
// 少し待ってまとめて1回で渡す。祝いはマルチを出てから出る(ハナビの作り)。印が偽・関数が無いなら何もしない
const RHYTHM_ASSIST_SESSION_FX_QUEUE = { list: [], timer: null };
const rhythmAssistSessionQueueFx = (item) => {
  if (!rhythmAssistSessionEnabled() || typeof growthFxSessionLevel !== 'function') return;
  const q = RHYTHM_ASSIST_SESSION_FX_QUEUE;
  q.list.push(item);
  if (q.timer) return;
  q.timer = setTimeout(() => {
    const list = q.list; q.list = []; q.timer = null;
    try { growthFxSessionLevel(list); } catch (_) { /* 祝いが出せなくても続ける */ }
  }, 500);
};
// 結果画面で、呼んだ助手を育てる(1ライブ1回。同じ回は2度数えない)。マスモンの RhythmBuddyGrowth と同じ作り
function RhythmAssistSessionGrowth({ assistantId, round, songId, diffId, durationMs, teamRank, score = 0, maxScore = 0, chartLevel = 0, humans = 1, onTickets = null }) {
  const [shown, setShown] = React.useState(null);
  React.useEffect(() => {
    if (!assistantId || !round) return undefined;
    let alive = true;
    let outcome = null;
    const dayKey = rhythmBuddyDayKey(Date.now());
    RHYTHM_ASSIST_SESSION_STORE.update((st) => {
      const r = rhythmAssistSessionApplyLive(st, assistantId, { round, songId, diffId, durationMs, teamRank, dayKey, nowMs: Date.now(), score, maxScore, chartLevel, humans });
      if (!r.next) return null;
      outcome = r;
      return r.next;
    }).then(() => {
      // 節目のセッション券は、渡した印を保存したあとで渡す(画面を閉じても二重にならない)
      if (outcome && outcome.tickets > 0 && typeof onTickets === 'function') { try { onTickets(outcome.tickets); } catch (_) { /* 渡せなくても続ける */ } }
      if (outcome && outcome.levelUp > 0) {
        const after = rhythmBuddyLevelInfo((outcome.next.mons[assistantId] || {}).exp).level;
        rhythmAssistSessionQueueFx({ assistantId, levelBefore: after - outcome.levelUp, levelAfter: after, tickets: outcome.tickets || 0 });
      }
      // 部屋のチャットに、育ったひとこと(セッションLv.UP・苦手だった曲が好きになってきた)
      if (outcome && typeof RHYTHM_MULTI !== 'undefined' && RHYTHM_MULTI.noteBuddyGrowth) {
        const likeUp = outcome.likeUp > 0 && rhythmAssistSessionTaste(assistantId, songId) !== 'like' ? outcome.likeUp : 0;
        if (outcome.levelUp > 0 || likeUp > 0) RHYTHM_MULTI.noteBuddyGrowth(rhythmAssistSessionKey(assistantId), { levelUp: outcome.levelUp, likeUp });
      }
      if (alive && outcome) setShown(outcome);
    });
    return () => { alive = false; };
  }, [assistantId, round]);
  if (!shown || !assistantId) return null;
  const level = rhythmBuddyLevelInfo((shown.next.mons[assistantId] || {}).exp).level;
  return (
    <p data-rhythm-assist-growth className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 rounded-xl border border-pink-300/50 bg-pink-950/60 px-2 py-0.5 text-[10px] font-black leading-tight text-pink-100">
      <span className="max-w-full truncate">🎤 {rhythmAssistSessionName(assistantId)}</span>
      <span className="text-pink-200">経験値+{shown.gain}</span>
      {shown.levelUp > 0 && <span data-rhythm-assist-levelup className="rounded bg-amber-300 px-1 text-slate-950">セッションLv.UP! Lv.{level}</span>}
      {shown.likeUp > 0 && <span className="text-amber-200">好み度+{shown.likeUp}</span>}
      {shown.tickets > 0 && <span data-rhythm-assist-ticket className="text-lime-200">セッション券+{shown.tickets}</span>}
    </p>
  );
}

// 助手どうしの仲良し度を読む(56-assistant-peer.jsx。書かない)。公開の印 assistantPeer が偽なら、デュオは組まない
const rhythmAssistSessionPeerLevel = (a, b) => {
  if (typeof assistantPeerEnabled !== 'function' || !assistantPeerEnabled() || typeof ASSISTANT_PEER_STORE === 'undefined') return 0;
  return assistantPeerLevel(ASSISTANT_PEER_STORE.state, a, b);
};
const rhythmAssistSessionPeerSeen = (a, b) => {
  if (typeof ASSISTANT_PEER_STORE === 'undefined') return false;
  const st = ASSISTANT_PEER_STORE.state;
  return !!(st && Array.isArray(st.special) && st.special.includes(assistantPeerPairKey(a, b)));
};
const rhythmAssistSessionDuosNow = (ids) => rhythmAssistSessionDuos(ids, rhythmAssistSessionPeerLevel, rhythmAssistSessionPeerSeen);
// いま部屋に呼んでいる助手(呼んだ順)
const rhythmAssistSessionCalledIds = () => {
  const v = typeof RHYTHM_MULTI !== 'undefined' ? RHYTHM_MULTI.view() : null;
  return (v && v.myCpus ? v.myCpus : []).map((c) => rhythmAssistSessionIdOf(c.masuId)).filter(Boolean);
};
// 呼んだ助手みんなのビートP の上乗せ(セッションLv の上乗せ + 仲良し度 Lv4 以上のデュオ)。60-app の周回の報酬の倍率に掛ける
const rhythmAssistSessionRewardBonusNow = () => {
  const ids = rhythmAssistSessionCalledIds();
  return rhythmAssistSessionRewardBonus(RHYTHM_ASSIST_SESSION_STORE.get(), ids) + rhythmAssistSessionDuoBonus(rhythmAssistSessionDuosNow(ids));
};
// デュオの台詞を1本選ぶ(1曲のうちに同じものは出さない)。[[話す人, 表情, 台詞(呼び方入り)], …]
const rhythmAssistSessionPickPair = (duo, scene, used, rand = Math.random) => {
  const table = typeof RHYTHM_ASSIST_SESSION_PAIR_LINES !== 'undefined' ? RHYTHM_ASSIST_SESSION_PAIR_LINES[duo.key] : null;
  const list = table && Array.isArray(table[scene]) ? table[scene] : [];
  const fresh = list.filter((rows) => !used.has(rows));
  if (!fresh.length) return null;
  const rows = fresh[Math.floor(rand() * fresh.length)];
  used.add(rows);
  const callOf = (who, to) => (typeof assistantPeerCall === 'function' ? assistantPeerCall(who, to) : rhythmAssistSessionName(to));
  return rows.map(([who, expr, text]) => [who, expr, String(text).replace(/\{c\}/g, callOf(who, who === duo.a ? duo.b : duo.a))]);
};

// 演奏中の助手の顔とひとこと(2026-11-07 社長の止め絵の形)。演奏画面の外(60-app)から重ねる。演奏の仕組みには触れず、
// 30-rhythm-play.jsx の読むだけの窓(RHYTHM_PLAY_WATCH)から、コンボ・ミス・曲の時刻を読むだけ。
// 置き場所: 上の帯と時間の行の左側の表示のすぐ下(縦は時間の行の下・横は曲名の行の下。道の外)。
// 場面: 50/100/300コンボ・ミス3つ続き・サビ・最後の10秒。ひとことは 1.6秒で消える。同じ曲で同じ場面は1回(デュオの掛け合いは3回まで)。
// セッションLv.15 からサビで顔が光る。仲良し度 Lv3 のデュオは掛け合い、Lv5(特別なお話を見たあと)はサビで合体(顔が重なり、画面のふちに2人の色の光)
const RHYTHM_ASSIST_SESSION_BUBBLE_MS = 1600;
const RHYTHM_ASSIST_SESSION_COMBO_STEPS = Object.freeze([50, 100, 300]);
const RHYTHM_ASSIST_SESSION_LAST_MS = 10000;
const RHYTHM_ASSIST_SESSION_GATTAI_MS = 3600;
function RhythmAssistSessionPlayFace({ songId }) {
  const state = useRhythmAssistSessionState();
  const boxRef = React.useRef(null);
  const [pos, setPos] = React.useState(null);
  const [say, setSay] = React.useState(null); // { aid, text, expr }
  const [glow, setGlow] = React.useState(false);
  const [gattai, setGattai] = React.useState(null); // { a, b }
  const ids = rhythmAssistSessionCalledIds().slice(0, 4);
  const idsKey = ids.join(',');
  React.useEffect(() => {
    if (!ids.length) return undefined;
    const said = new Set();
    const usedPair = new Set();
    const duos = rhythmAssistSessionDuosNow(ids);
    const song = typeof RHYTHM_SONGS !== 'undefined' && Array.isArray(RHYTHM_SONGS) ? RHYTHM_SONGS.find((x) => x && x.songId === songId) : null;
    const endMs = song ? Number(song.playDurationMs) || 0 : 0;
    let lastCombo = 0; let missRow = 0; let lastMiss = 0; let inClimax = false; let hideAt = 0; let turn = 0; let duoTalks = 0; let gattaiDone = false; let gattaiUntil = 0;
    const queue = [];
    const showNext = () => {
      const next = queue.shift();
      if (!next) { setSay(null); hideAt = 0; return; }
      setSay(next); hideAt = Date.now() + RHYTHM_ASSIST_SESSION_BUBBLE_MS;
    };
    const enqueue = (rows) => { if (queue.length || hideAt) return false; rows.forEach(([aid, expr, text]) => queue.push({ aid, expr, text })); showNext(); return true; };
    const speakDuo = (scene) => {
      if (queue.length || hideAt) return false;
      for (const d of duos) {
        const rows = rhythmAssistSessionPickPair(d, scene, usedPair);
        if (rows && enqueue(rows)) return true;
      }
      return false;
    };
    const speak = (kind) => {
      if (queue.length || hideAt) return;
      // デュオがいれば、コンボ・サビのときは掛け合い(1曲3回まで)
      if ((kind === 'combo' || kind === 'climax') && duos.length && duoTalks < RHYTHM_ASSIST_SESSION_DUO_TALK_MAX && speakDuo('play')) { duoTalks += 1; return; }
      const order = ids.slice(turn).concat(ids.slice(0, turn));
      for (const aid of order) {
        const key = `${aid}:${kind}`;
        if (said.has(key)) continue;
        const hit = rhythmAssistSessionPickLine(aid, kind);
        if (!hit) continue;
        said.add(key); turn = (ids.indexOf(aid) + 1) % ids.length;
        enqueue([[aid, hit[0], hit[1]]]);
        return;
      }
    };
    const place = () => {
      const box = boxRef.current; const hud = document.querySelector('[data-rhythm-hud]');
      if (!box || !hud || !box.offsetParent) return;
      // 演奏画面ごと回して描く(RHYTHM_VIEW_ROTATION)ときも合うよう、画面上の位置ではなく offset の鎖で測る
      const at = (node) => { let top = 0; let left = 0; let el = node; while (el && el !== box.offsetParent) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent; } return el === box.offsetParent ? { top, left } : null; };
      const hudAt = at(hud);
      if (!hudAt) return;
      // 上の帯と時間の行のうち、左側(顔の幅ぶん)にかかる表示(点数・曲名・時間)のいちばん下の、すぐ下に置く
      let bottom = hudAt.top;
      // 時間の行(data-rhythm-song-clock)は縦画面では上の帯の外にあるので、これも測る
      document.querySelectorAll('[data-rhythm-hud] *, [data-rhythm-song-clock] *').forEach((el) => {
        if (el.children.length || !el.offsetHeight) return;
        const p = at(el);
        if (!p || p.left - hudAt.left > 150) return;
        bottom = Math.max(bottom, p.top + el.offsetHeight);
      });
      const next = { top: Math.round(bottom + 6), left: Math.round(hudAt.left + 8) };
      setPos((q) => (q && q.top === next.top && q.left === next.left ? q : next));
    };
    const tick = () => {
      place();
      const watch = typeof RHYTHM_PLAY_WATCH !== 'undefined' ? RHYTHM_PLAY_WATCH : null;
      const h = watch && watch.hud ? watch.hud.get() : null;
      if (hideAt && Date.now() >= hideAt) showNext();
      if (gattaiUntil && Date.now() >= gattaiUntil) { gattaiUntil = 0; setGattai(null); }
      if (h) {
        const combo = Number(h.combo) || 0;
        const miss = h.counts ? Number(h.counts.MISS) || 0 : 0;
        if (RHYTHM_ASSIST_SESSION_COMBO_STEPS.some((n) => lastCombo < n && combo >= n)) speak('combo');
        if (miss > lastMiss) { missRow = combo === 0 ? missRow + (miss - lastMiss) : 0; if (missRow >= 3) { speak('miss'); missRow = 0; } }
        if (combo > 0) missRow = 0;
        lastCombo = combo; lastMiss = miss;
        const now = rhythmAssistSessionInClimax(songId || watch.songId, watch.timeMs);
        if (now && !inClimax) {
          const g = !gattaiDone ? duos.find((d) => d.gattai) : null;
          if (g) {
            // 合体(1曲1回): 2人の顔が重なり、画面のふちに2人の色の光。掛け合いは gattai の台詞
            gattaiDone = true; gattaiUntil = Date.now() + RHYTHM_ASSIST_SESSION_GATTAI_MS; setGattai({ a: g.a, b: g.b });
            const rows = rhythmAssistSessionPickPair(g, 'gattai', usedPair);
            if (rows) { queue.length = 0; hideAt = 0; enqueue(rows); }
          } else speak('climax');
        }
        if (now !== inClimax) { inClimax = now; setGlow(now); }
        if (endMs > RHYTHM_ASSIST_SESSION_LAST_MS && Number(watch.timeMs) >= endMs - RHYTHM_ASSIST_SESSION_LAST_MS && Number(watch.timeMs) < endMs) speak('last');
      }
    };
    const t = setInterval(tick, 200);
    tick();
    return () => clearInterval(t);
  }, [idsKey, songId]);
  if (!ids.length) return null;
  const whoA = gattai ? rhythmAssistSessionWho(gattai.a) : null;
  const whoB = gattai ? rhythmAssistSessionWho(gattai.b) : null;
  return (
    <>
      {whoA && whoB && ['left', 'right'].map((side) => (
        <div key={side} data-rhythm-assist-gattai-light={side} aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-[59] w-3"
          style={{ [side]: 0, background: `linear-gradient(180deg, ${whoA.accent || '#f472b6'}, ${whoB.accent || '#38bdf8'}, ${whoA.accent || '#f472b6'})`, opacity: 0.75, boxShadow: `0 0 18px 6px ${side === 'left' ? (whoA.accent || '#f472b6') : (whoB.accent || '#38bdf8')}` }} />
      ))}
      <div ref={boxRef} data-rhythm-assist-play aria-hidden="true" className="pointer-events-none absolute z-[60] flex w-[140px] flex-col gap-1"
        style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}>
        {ids.map((aid) => {
          const who = rhythmAssistSessionWho(aid);
          if (!who) return null;
          // 合体中は、相方の顔を自分の顔に重ねる(2つ目の顔は1つ目の後ろへ回す)
          if (gattai && aid === gattai.b) return null;
          const partner = gattai && aid === gattai.a ? whoB : null;
          const lit = (glow && rhythmAssistSessionLevel(state, aid) >= RHYTHM_ASSIST_SESSION_GLOW_LEVEL) || !!partner;
          const talker = say && (say.aid === aid || (partner && say.aid === gattai.b)) ? say : null;
          const face = (w, expr) => <img src={assistantFaceSrc(w, expr || null)} alt="" draggable={false} className="h-full w-full object-cover" />;
          return (
            <div key={aid} data-rhythm-assist-play-face={aid} data-glow={lit ? '1' : undefined} data-gattai={partner ? '1' : undefined} className={partner ? 'flex flex-col items-start gap-1' : 'flex items-start gap-1.5'}>
              <span className={`relative block h-10 shrink-0 ${partner ? 'w-[64px]' : 'w-10'}`}>
                {partner && (
                  <span data-rhythm-assist-gattai-partner className="absolute left-6 top-0 block h-10 w-10 overflow-hidden rounded-full border-2 bg-slate-800"
                    style={{ borderColor: partner.accent || '#38bdf8', boxShadow: `0 0 14px 4px ${partner.accent || '#38bdf8'}` }}>
                    {face(partner, say && say.aid === gattai.b ? say.expr : 'excited')}
                  </span>
                )}
                <span className="relative z-10 block h-10 w-10 overflow-hidden rounded-full border-2 bg-slate-800 transition-shadow duration-300"
                  style={{ borderColor: who.accent || '#f472b6', boxShadow: lit ? `0 0 14px 4px ${who.accent || '#f472b6'}` : 'none' }}>
                  {face(who, talker && talker.aid === aid ? talker.expr : partner ? 'excited' : null)}
                </span>
              </span>
              {talker && <span data-rhythm-assist-play-bubble className="block min-w-0 rounded-xl bg-white px-1.5 py-0.5 text-[9.5px] font-black leading-snug text-slate-900" style={JA_WRAP_STYLE}>
                {partner && <b className="mr-0.5" style={{ color: (rhythmAssistSessionWho(talker.aid) || {}).accent || '#db2777' }}>{rhythmAssistSessionName(talker.aid)}:</b>}{jaWrap(talker.text)}
              </span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

// デュオの結果(仲良し度 Lv4 から2人のひとこと)と、2人で1曲終えたときの仲良し度 +3(どの2人でも。1日12まで・ペアの1日の上限の中)。
// 同じ回(round)に2度は足さない。仲良し度を足すのは assistantPeerGain(56-assistant-peer.jsx)だけ
const RHYTHM_ASSIST_SESSION_PEER_DONE = new Set();
function RhythmAssistSessionDuoResult({ ids = [], round }) {
  const [shown, setShown] = React.useState([]);
  const key = `${round}:${ids.join(',')}`;
  React.useEffect(() => {
    if (!round || ids.length < 2) return undefined;
    let alive = true;
    const duos = rhythmAssistSessionDuosNow(ids);
    const used = new Set();
    const lines = duos.filter((d) => d.result).map((d) => ({ d, rows: rhythmAssistSessionPickPair(d, 'result', used) })).filter((x) => x.rows);
    (async () => {
      const gains = {};
      for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
        const pk = `${round}:${rhythmAssistSessionPairKey(ids[i], ids[j])}`;
        if (RHYTHM_ASSIST_SESSION_PEER_DONE.has(pk) || typeof assistantPeerGain !== 'function') continue;
        RHYTHM_ASSIST_SESSION_PEER_DONE.add(pk);
        try { const r = await assistantPeerGain(ids[i], ids[j], 'session'); if (r && r.gained > 0) gains[rhythmAssistSessionPairKey(ids[i], ids[j])] = r.gained; } catch (_) { /* 足せなくても続ける */ }
      }
      if (!alive) return;
      const out = lines.map(({ d, rows }) => ({ key: d.key, d, rows, gained: gains[d.key] || 0 }));
      Object.keys(gains).filter((k) => !out.some((x) => x.key === k)).forEach((k) => { const [a, b] = k.split('-'); out.push({ key: k, d: { a, b }, rows: null, gained: gains[k] }); });
      setShown(out);
    })();
    return () => { alive = false; };
  }, [key]);
  if (!shown.length) return null;
  return (
    <>
      {shown.map(({ key: k, d, rows, gained }) => (
        <p key={k} data-rhythm-assist-duo-result={k} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 rounded-xl border border-violet-300/50 bg-violet-950/60 px-2 py-0.5 text-[10px] font-black leading-tight text-violet-100">
          <span className="shrink-0">🎤 {rhythmAssistSessionName(d.a)}・{rhythmAssistSessionName(d.b)}</span>
          {rows && rows.map(([who, , text], i) => <span key={i} className="min-w-0">{rhythmAssistSessionName(who)}「{text}」</span>)}
          {gained > 0 && <span data-rhythm-assist-peer-gain className="text-amber-200">{typeof assistantPeerLifeOn === 'function' && assistantPeerLifeOn() ? '友情' : '仲良し度'}+{gained}</span>}
        </p>
      ))}
    </>
  );
}
