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
const rhythmAssistSessionName = (assistantId) => { const who = rhythmAssistSessionWho(assistantId); return String((who && who.name) || '助手').slice(0, 12); };

// 部屋で話すひとこと(段階1は最小限。段階3でコトバ・ナカヨシと場面を増やす。口調の基準は docs/progress/assistant-peer/VOICE.md)
const RHYTHM_ASSIST_SESSION_LINES = Object.freeze({
  mua: { join: 'やっほ〜！あたしも一緒に叩くね♪', love: 'この曲あたし大好きなの♪', mvp: 'MVPとっちゃった！？あたしすごくない？♪', high: 'まぢいい感じぢゃん！楽しかったぁ♪', low: '次はもっと合わせよ！あたしもがんばる♪' },
  kiki: { join: 'ブリーダーさん、よろしくお願いしまつ♪', love: 'この曲、私とても好きなんです♪', mvp: '私がMVPですか？ちょっと照れちゃいまつ♪', high: 'とってもいい演奏でした♪', low: '次はきっと、もっと合わせられますよ♪' },
  momosuke: { join: 'ももが来たからには盛り上げるよ！！', love: 'この曲ももの推し曲！！', mvp: 'MVPはもも！！当然でしょw', high: 'ももと合わせたらこんなもんでしょw さすが♡', low: 'ドンマイ！次はもも、もっと見ててあげる♡' },
  dra: { join: 'おでも混ぜてくれよな、えへへ', love: 'この曲、おで好きなんだな', mvp: 'おでがMVPか、えへへ、照れくさいな', high: 'いい演奏だったくさ。おで楽しかったな', low: 'どんまいだな、次でとりかえすからな' },
  atsu: { join: 'とりあえず一曲いくか笑', love: 'これ俺の好きなやつだな笑', mvp: 'MVPもらっといた笑', high: 'てか今の、普通にうまかったな笑', low: 'まあ次だな、切り替えていこう！' },
  kyuko: { join: 'ほい！俺も入るね〜', love: 'この曲は構成がきれいなんだよね〜', mvp: 'MVPいただきました〜笑', high: 'いい流れだったね〜、ありがとん笑', low: 'ぐぬぬぬ、次はサビ前を意識してみよ〜' },
  sorashido: { join: 'うぉぉぉ！俺も参戦するぜ・・・！', love: 'この曲は全ノーツ計算済みだぜ・・・！', mvp: 'MVPは計算済みだったぜ・・・！', high: '計算どおりの名演だぜ・・・！', low: '次は全ノーツ計算して挑むぜ笑' },
  erubin: { join: '俺も一緒にいいかな？よろしくね', love: 'この曲、好きなんだよね', mvp: '俺がMVP？ありがとね', high: 'いい演奏だったね、おつかれさま', low: '大丈夫、次はきっと合うよ' },
});
const rhythmAssistSessionTalk = ({ assistantId, kind, songId = '', score = 0, diffId = '', mvp = false }) => {
  const lines = RHYTHM_ASSIST_SESSION_LINES[assistantId];
  if (!lines) return '';
  if (kind === 'join') return lines.join;
  if ((kind === 'pick' || kind === 'song') && songId && rhythmAssistSessionTaste(assistantId, songId) === 'like') return lines.love;
  if (kind === 'result') {
    if (mvp) return lines.mvp;
    const diffDef = (typeof RHYTHM_PLAY_DIFFICULTIES !== 'undefined' ? RHYTHM_PLAY_DIFFICULTIES : []).find((d) => d.id === diffId);
    const ratio = Number(score) / ((diffDef && diffDef.maxScore) || 1000000);
    return ratio >= 0.85 ? lines.high : ratio < 0.7 ? lines.low : '';
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

// 結果画面で、呼んだ助手を育てる(1ライブ1回。同じ回は2度数えない)。マスモンの RhythmBuddyGrowth と同じ作り
function RhythmAssistSessionGrowth({ assistantId, round, songId, diffId, durationMs, teamRank, score = 0, maxScore = 0, chartLevel = 0, humans = 1 }) {
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
    }).then(() => { if (alive && outcome) setShown(outcome); });
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
    </p>
  );
}
