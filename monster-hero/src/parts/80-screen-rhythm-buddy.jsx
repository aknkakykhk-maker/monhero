// ===== マスモンのモンヒロビート側(マルチに呼ぶ・ビートLvで育つ)の保存と画面 =====
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md。計算は 33-rhythm-buddy.jsx(純粋)、部屋の中の動きは 77-screen-rhythm-multi.jsx。
// 画面に出す名前は「マスモン一覧(モンヒロビート)」「マスモンを呼ぶ」「ビートLv」「セッション券」(2026-10-07・ユーザー指示。
// 「相棒」という呼び名は使わない)。コードの名前(rhythmBuddy…)は作りはじめのまま。
// 保存は新しいキー RHYTHM_BUDDY_KEY だけ。マスモン本体の保存には触れない。セッション券の枚数は本体(60-app)が持ち、props で受け取る

// 保存の窓口。読み書きは1本の列に並べ、同時に書いて片方が消えることを防ぐ。読むときは必ず正規化する
const RHYTHM_BUDDY_STORE = (() => {
  let state = rhythmBuddyNormalize(null);
  let loaded = false;
  let chain = Promise.resolve();
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (_) { /* 画面側の失敗で保存を止めない */ } });
  const api = {
    get: () => state,
    load() {
      chain = chain.then(async () => {
        try { state = rhythmBuddyNormalize(await storeGet(RHYTHM_BUDDY_KEY, null)); } catch (_) { /* 読めなければ既定値のまま */ }
        loaded = true;
        emit();
      });
      return chain;
    },
    // fn(いまの状態) → 次の状態。null を返したら何もしない。戻り値の Promise は保存まで待つ(結果は fn の戻り値)
    update(fn) {
      let out = null;
      chain = chain.then(async () => {
        if (!loaded) {
          try { state = rhythmBuddyNormalize(await storeGet(RHYTHM_BUDDY_KEY, null)); } catch (_) { /* 既定値のまま */ }
          loaded = true;
        }
        const next = fn(state);
        if (!next) return;
        out = rhythmBuddyNormalize(next);
        state = out;
        try { await storeSet(RHYTHM_BUDDY_KEY, state); } catch (_) { /* 保存できなくても遊びは続ける */ }
        emit();
      });
      return chain.then(() => out);
    },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  return api;
})();

const useRhythmBuddyState = () => {
  const [state, setState] = React.useState(() => RHYTHM_BUDDY_STORE.get());
  React.useEffect(() => {
    const off = RHYTHM_BUDDY_STORE.subscribe(setState);
    void RHYTHM_BUDDY_STORE.load();
    return off;
  }, []);
  return state;
};
// 日付が変わったら(朝5:00)画面の数字を出し直すため、1分ごとに日付キーを見る
const useRhythmBuddyDayKey = () => {
  const [day, setDay] = React.useState(() => rhythmBuddyDayKey(Date.now()));
  React.useEffect(() => {
    const timer = setInterval(() => setDay(rhythmBuddyDayKey(Date.now())), 60000);
    return () => clearInterval(timer);
  }, []);
  return day;
};

// 種類の基本の能力値の一覧(なりやすい性格を決める)
const rhythmBuddyLeanOf = (baseId) => {
  const all = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? Object.values(ALL_PLAYER_MONSTERS) : [];
  const base = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[baseId] : null;
  return rhythmBuddySpeciesLean(base, all);
};
const rhythmBuddyMasuName = (masu) => {
  const base = masu && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  return String((masu && masu.name) || (base && base.name) || 'マスモン').slice(0, 12);
};

// 部屋の中で相棒が演奏と選曲をするための「頭」。RHYTHM_MULTI.setCpuBrain へ渡す
const rhythmBuddyMakeBrain = (songs) => ({
  play({ songId, diffId, masuId, humans = 1 }) {
    const song = (songs || []).find((x) => x.songId === songId);
    const chart = song && song.difficulties ? song.difficulties[diffId] : null;
    const totalNotes = chart ? (Number(chart.totalNotes) > 0 ? Number(chart.totalNotes) : Array.isArray(chart.notes) ? chart.notes.length : 300) : 300;
    const diffDef = (typeof RHYTHM_DIFFICULTIES !== 'undefined' ? RHYTHM_DIFFICULTIES : []).find((d) => d.id === diffId);
    const mon = RHYTHM_BUDDY_STORE.get().mons[masuId];
    const mood = rhythmBuddyMood(masuId, rhythmBuddyDayKey(Date.now()), mon);
    return rhythmBuddyPlay({
      mon, songId, diffId, totalNotes, maxScore: diffDef ? diffDef.maxScore : 1000000,
      durationMs: (chart && Number(chart.durationMs)) || (song ? Number(song.playDurationMs) || 0 : 0), mood, rand: Math.random,
      chartLevel: chart ? Number(chart.level) || 0 : 0, humans,
    });
  },
  // 得意な曲(上位3曲)から選ぶ。遊べる曲の中に無ければおまかせ('')
  pick(catalog, masuId) {
    const top = rhythmBuddyTopSongs(RHYTHM_BUDDY_STORE.get().mons[masuId], 3).filter((x) => (catalog || []).includes(x.songId));
    return top.length ? top[Math.floor(Math.random() * top.length)].songId : '';
  },
});

// ---- 小さな部品 ----
function RhythmBuddyFace({ masu, sizeClass = 'h-10 w-10' }) {
  const base = masu && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  const src = base ? (base.faceIconUrl || base.iconUrl || base.imgUrl) : '';
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-lime-300/70 bg-slate-800 ${sizeClass}`}>
      {src ? <DyedMonsterImage baseId={masu.baseId} src={src} alt="" masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-cover" />
        : <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-lg">🎵</span>}
    </span>
  );
}
function RhythmBuddyStars({ stars }) {
  return <span aria-label={`得意度${stars}`} className="shrink-0 text-[11px] leading-none tracking-tight text-amber-300">{'★'.repeat(stars)}<span className="text-slate-600">{'★'.repeat(Math.max(0, 5 - stars))}</span></span>;
}
// 今日の残り回数とセッション券
function RhythmBuddyAllowance({ freeLeft, tickets, className = '' }) {
  return (
    <p data-rhythm-buddy-allowance className={`text-[11px] font-black leading-snug ${className}`}>
      今日の無料 <b className={freeLeft > 0 ? 'text-lime-300' : 'text-slate-400'}>あと{freeLeft}回</b>
      <span className="mx-1 text-slate-500">/</span>セッション券 <b className="text-amber-200">{tickets}枚</b>
    </p>
  );
}
const rhythmBuddyDiffShort = Object.freeze({ EASY: 'EASY', NORMAL: 'NORMAL', HARD: 'HARD', EXPERT: 'EXPERT', MASTER: 'MASTER' });

// スコアの伸び(最近30回)。横は古い→新しい、縦は「その難易度の満点の何%か」(難易度ごとに満点が違うため)。
// 1本の線なので凡例は付けない。点を押すと、その回の曲・難易度・スコアを下に出す。数字の一覧も開ける
function RhythmBuddyScoreChart({ recent, songName }) {
  const list = (Array.isArray(recent) ? recent : []).slice().reverse(); // 古い順
  const [sel, setSel] = React.useState(-1);
  const [table, setTable] = React.useState(false);
  if (list.length === 0) return <p className="text-[11px] font-bold text-slate-500">まだ記録がありません。一緒にライブをすると、ここにスコアが並びます</p>;
  const pct = (x) => Math.round(x.score / x.max * 1000) / 10;
  const vals = list.map(pct);
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 5) / 10) * 10);
  const W = 300; const H = 120; const L = 30; const R = 8; const T = 8; const B = 18;
  const xAt = (i) => (list.length === 1 ? L + (W - L - R) / 2 : L + (W - L - R) * i / (list.length - 1));
  const yAt = (v) => T + (H - T - B) * (1 - (v - lo) / Math.max(1, 100 - lo));
  const grid = [];
  for (let v = lo; v <= 100; v += lo >= 60 ? 10 : 20) grid.push(v);
  const pts = list.map((x, i) => `${xAt(i).toFixed(1)},${yAt(vals[i]).toFixed(1)}`).join(' ');
  const picked = sel >= 0 && sel < list.length ? list[sel] : list[list.length - 1];
  const pickedIndex = sel >= 0 && sel < list.length ? sel : list.length - 1;
  return (
    <div data-rhythm-buddy-chart>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`最近${list.length}回のスコア。いちばん新しい回は満点の${vals[vals.length - 1]}%`}>
        {grid.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yAt(v)} y2={yAt(v)} stroke="rgba(148,163,184,.18)" strokeWidth="1" />
            <text x={L - 4} y={yAt(v) + 3} textAnchor="end" fontSize="9" fontWeight="700" fill="rgb(148,163,184)">{v}%</text>
          </g>
        ))}
        <text x={L} y={H - 4} fontSize="9" fontWeight="700" fill="rgb(148,163,184)">古い</text>
        <text x={W - R} y={H - 4} textAnchor="end" fontSize="9" fontWeight="700" fill="rgb(148,163,184)">新しい</text>
        {list.length > 1 && <polyline points={pts} fill="none" stroke="rgb(163,230,53)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        {list.map((x, i) => (
          <g key={i} onClick={() => setSel(i)} style={{ cursor: 'pointer' }}>
            <circle cx={xAt(i)} cy={yAt(vals[i])} r="11" fill="transparent" />
            <circle cx={xAt(i)} cy={yAt(vals[i])} r={i === pickedIndex ? 5 : 4} fill={i === pickedIndex ? 'rgb(253,224,71)' : 'rgb(163,230,53)'} stroke="rgb(15,23,42)" strokeWidth="2" />
          </g>
        ))}
      </svg>
      <p data-rhythm-buddy-chart-pick className="mt-1 text-[11px] font-black leading-snug text-slate-200">
        <span className="text-slate-400">{list.length - pickedIndex === 1 ? 'いちばん新しい回' : `${list.length - pickedIndex}回前`}: </span>
        {songName(picked.songId)} {picked.diffId ? rhythmBuddyDiffShort[picked.diffId] : ''} <b className="text-lime-200">{picked.score.toLocaleString()}点</b>
        <span className="text-slate-400">(満点の{pct(picked)}%)</span>
      </p>
      <button type="button" onClick={() => setTable((v) => !v)} className="mt-1 min-h-[36px] rounded-lg bg-slate-800 px-2 text-[10px] font-black text-slate-200">{table ? '数字の一覧をとじる' : '数字の一覧で見る'}</button>
      {table && (
        <ol data-rhythm-buddy-chart-table className="mt-1 space-y-0.5">
          {list.slice().reverse().map((x, i) => (
            <li key={i} className="flex items-center gap-2 text-[10px] font-bold">
              <span className="w-12 shrink-0 text-slate-500">{i === 0 ? '最新' : `${i + 1}回前`}</span>
              <span className="min-w-0 flex-1 truncate">{songName(x.songId)}</span>
              <span className="shrink-0 text-slate-400">{x.diffId}</span>
              <span className="w-[4.8rem] shrink-0 text-right tabular-nums">{x.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// 1体の詳しい画面
function RhythmBuddyDetail({ masu, mon, dayKey, songName, onBack }) {
  const m = rhythmBuddyNormalizeMon(mon);
  const info = rhythmBuddyLevelInfo(m.exp);
  const mood = rhythmBuddyMood(masu.id, dayKey, m);
  const trait = rhythmBuddyTraitOf(m.trait);
  const lean = rhythmBuddyTraitOf(rhythmBuddyLeanOf(masu.baseId));
  const comfort = rhythmBuddyComfortLevelOf(m);
  const [allSongs, setAllSongs] = React.useState(false);
  const [traitsOpen, setTraitsOpen] = React.useState(false);
  const songs = rhythmBuddyTopSongs(m, allSongs ? RHYTHM_BUDDY_SONG_KEEP : 5);
  const songCount = Object.keys(m.songs).length;
  return (
    <div data-rhythm-buddy-detail className="space-y-2">
      <div className="flex items-center gap-3 rounded-2xl border border-lime-300/30 bg-slate-950/70 p-3">
        <RhythmBuddyFace masu={masu} sizeClass="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <b className="block truncate text-base font-black">{rhythmBuddyMasuName(masu)}</b>
          <small className="block text-[12px] font-black text-lime-200">ビートLv.{info.level}{info.level >= RHYTHM_BUDDY_LEVEL_MAX ? '(最大)' : ''}</small>
          {info.need > 0 && (
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-700"><span className="block h-full rounded-full bg-lime-400" style={{ width: `${Math.round(info.into / info.need * 100)}%` }} /></span>
          )}
          <small className="mt-0.5 block text-[10px] font-bold text-slate-400">一緒に遊んだライブ {m.lives}回</small>
        </div>
      </div>
      <section data-rhythm-buddy-comfort className="rounded-xl border border-cyan-300/30 bg-slate-950/60 p-2">
        <h4 className="text-[10px] font-black text-slate-400">叩ける譜面の目安</h4>
        <p className="text-sm font-black text-cyan-100">譜面Lv.{comfort}まで 無理なく叩けます</p>
        <small className="block text-[9px] font-bold leading-snug text-slate-400">よく一緒に遊んだ曲は、Lv.{comfort + 5}くらいまで届きます。それより上の譜面ほど、スコアが落ちます</small>
      </section>
      <div className="grid grid-cols-2 gap-2">
        <section className="rounded-xl bg-slate-950/60 p-2">
          <h4 className="text-[10px] font-black text-slate-400">今日の調子</h4>
          <p data-rhythm-buddy-mood={mood.id} className="text-sm font-black">{mood.icon} {mood.label}</p>
          <small className="block text-[9px] font-bold leading-snug text-slate-500">朝5:00に変わります</small>
        </section>
        <section className="rounded-xl bg-slate-950/60 p-2">
          <h4 className="text-[10px] font-black text-slate-400">性格</h4>
          {trait
            ? <><p data-rhythm-buddy-trait={trait.id} className="text-sm font-black text-amber-200">{trait.label}</p><small className="block text-[9px] font-bold leading-snug text-slate-400">{trait.note}</small></>
            : <><p className="text-sm font-black text-slate-400">まだ見えない</p><small className="block text-[9px] font-bold leading-snug text-slate-500">ビートLv.{RHYTHM_BUDDY_TRAIT_LEVEL}で決まります。{lean ? `${lean.label}になりやすい種類です` : ''}</small></>}
        </section>
      </div>
      <button data-rhythm-buddy-traits-toggle type="button" onClick={() => setTraitsOpen((v) => !v)} className="min-h-[36px] w-full rounded-lg bg-slate-800 text-[11px] font-black text-slate-200">
        {traitsOpen ? '性格の一覧をとじる' : '性格の一覧を見る(9つ)'}
      </button>
      {traitsOpen && (
        <ul data-rhythm-buddy-traits className="space-y-1 rounded-xl bg-slate-950/60 p-2">
          {RHYTHM_BUDDY_TRAITS.map((t) => (
            <li key={t.id} className={`rounded-lg px-2 py-1 ${trait && trait.id === t.id ? 'bg-amber-900/40 ring-1 ring-amber-300/60' : ''}`}>
              <b className="text-[12px] font-black text-amber-200">{t.label}</b>
              <small className="block text-[10px] font-bold leading-snug text-slate-300">{t.note}</small>
              <small className="block text-[9px] font-bold leading-snug text-slate-500">なりやすい育て方: {t.how}</small>
            </li>
          ))}
        </ul>
      )}
      <section className="rounded-xl bg-slate-950/60 p-2">
        <h4 className="mb-1 text-[10px] font-black text-slate-400">スコアの伸び(最近{RHYTHM_BUDDY_RECENT_KEEP}回)</h4>
        <RhythmBuddyScoreChart recent={m.recent} songName={songName} />
      </section>
      <section className="rounded-xl bg-slate-950/60 p-2">
        <h4 className="mb-1 text-[10px] font-black text-slate-400">難易度の慣れ</h4>
        {RHYTHM_BUDDY_DIFF_IDS.map((id) => {
          const v = rhythmBuddyMastery(m.diffs[id]);
          return (
            <div key={id} className="flex items-center gap-2 py-0.5">
              <span className="w-16 shrink-0 text-[10px] font-black">{id}</span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-700"><span className="block h-full rounded-full bg-cyan-400" style={{ width: `${Math.round(v * 100)}%` }} /></span>
              <small className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-400">{m.diffs[id]}回</small>
            </div>
          );
        })}
      </section>
      <section data-rhythm-buddy-songs className="rounded-xl bg-slate-950/60 p-2">
        <h4 className="mb-1 text-[10px] font-black text-slate-400">得意な曲{allSongs ? `(${songCount}曲)` : ''}</h4>
        {songs.length === 0 && <p className="text-[11px] font-bold text-slate-500">まだありません。一緒に遊んだ曲ほど得意になります</p>}
        {songs.map((x) => (
          <div key={x.songId} className="flex items-center gap-2 py-0.5">
            <span className="min-w-0 flex-1 truncate text-[11px] font-black">{songName(x.songId)}</span>
            {allSongs && <small className="shrink-0 text-[10px] font-bold tabular-nums text-slate-400">{x.plays}回</small>}
            <RhythmBuddyStars stars={x.stars} />
          </div>
        ))}
        {songCount > 5 && (
          <button data-rhythm-buddy-songs-all type="button" onClick={() => setAllSongs((v) => !v)} className="mt-1 min-h-[36px] w-full rounded-lg bg-slate-800 text-[11px] font-black text-slate-200">
            {allSongs ? '上位5曲だけにする' : `遊んだ曲をすべて見る(${songCount}曲)`}
          </button>
        )}
      </section>
      {onBack && <button type="button" onClick={onBack} className="min-h-[44px] w-full rounded-xl bg-slate-700 text-sm font-black">一覧へもどる</button>}
    </div>
  );
}

// マスモンの一覧(1行ずつ)。onPick を渡すと「呼ぶ」ボタンが付く
function RhythmBuddyList({ masuMons, state, dayKey, onOpen, onPick = null, busy = false, canPay = true, calledIds = [] }) {
  // 育てた子(経験値の多い順)を上へ。まだ一緒に遊んでいない子はそのあと
  const list = (Array.isArray(masuMons) ? masuMons : []).filter((x) => x && x.id && x.baseId).map((masu) => {
    const mon = state.mons[masu.id];
    return { masu, mon, exp: mon ? mon.exp : -1 };
  }).sort((a, b) => (b.exp - a.exp));
  if (list.length === 0) return <p className="py-6 text-center text-[12px] font-bold text-slate-400">マスモンがまだいません</p>;
  return (
    <ul className="space-y-1.5">
      {list.map(({ masu, mon }) => {
        const mood = rhythmBuddyMood(masu.id, dayKey, mon);
        const trait = mon ? rhythmBuddyTraitOf(mon.trait) : null;
        const level = mon ? rhythmBuddyLevelInfo(mon.exp).level : 1;
        return (
          <li key={masu.id} data-rhythm-buddy-row className="flex items-center gap-2 rounded-xl bg-slate-950/60 p-1.5">
            <button type="button" onClick={() => onOpen(masu.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              <RhythmBuddyFace masu={masu} sizeClass="h-11 w-11" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-black">{rhythmBuddyMasuName(masu)}</b>
                <small className="block truncate text-[10px] font-bold text-slate-400">
                  {mon ? `ビートLv.${level}` : 'まだ一緒に遊んでいない'}{trait ? ` ・ ${trait.label}` : ''}
                </small>
                <small className="block truncate text-[9px] font-bold text-cyan-200/80">譜面Lv.{rhythmBuddyComfortLevelOf(mon)}まで</small>
              </span>
              <span aria-label={`今日の調子 ${mood.label}`} className="shrink-0 text-center"><span className="block text-lg leading-none">{mood.icon}</span><small className="block text-[8px] font-black text-slate-400">{mood.label}</small></span>
            </button>
            {onPick && (calledIds.includes(masu.id)
              ? <span data-rhythm-buddy-called className="min-h-[44px] shrink-0 rounded-xl border border-lime-300/50 px-2 py-3 text-[10px] font-black text-lime-200">呼んでいる</span>
              : <button data-rhythm-buddy-call type="button" disabled={busy || !canPay} onClick={() => onPick(masu)}
                className="min-h-[44px] shrink-0 rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 px-3 text-xs font-black text-slate-950 disabled:opacity-40">呼ぶ</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// 部屋の中の「マスモンを呼ぶ」(下から出る選択の画面)
function RhythmBuddySheet({ masuMons = [], songName, tickets = 0, pick, onClose, calledIds = [] }) {
  const state = useRhythmBuddyState();
  const dayKey = useRhythmBuddyDayKey();
  const [detailId, setDetailId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const freeLeft = rhythmBuddyFreeLeft(state, dayKey);
  const detail = detailId ? (masuMons || []).find((x) => x && x.id === detailId) : null;
  const canPay = freeLeft > 0 || tickets > 0;
  const choose = async (masu) => {
    if (busy || !canPay) return;
    setBusy(true);
    try { await pick(masu); } finally { setBusy(false); }
  };
  return (
    <div className="absolute inset-0 z-[86000] flex items-end justify-center landscape:items-center">
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-slate-950/75" onClick={onClose} />
      <section data-rhythm-buddy-sheet className="relative flex max-h-[88%] w-full max-w-md flex-col rounded-t-3xl border border-lime-300/30 bg-slate-900 p-3 shadow-2xl landscape:rounded-3xl" style={{ paddingBottom: 'calc(.75rem + var(--mh-sa-bottom))' }}>
        <header className="mb-2 flex items-center gap-2">
          <h3 className="min-w-0 flex-1 text-base font-black text-lime-200">🎵 マスモンを呼ぶ</h3>
          <button type="button" aria-label="閉じる" onClick={onClose} className="min-h-[40px] min-w-[40px] rounded-full bg-slate-800 text-lg font-black">✕</button>
        </header>
        <RhythmBuddyAllowance freeLeft={freeLeft} tickets={tickets} className="mb-1 text-slate-200" />
        <p className="mb-2 text-[10px] font-bold leading-relaxed text-slate-400">
          マスモンをえらんで、CPUとしてこの部屋に呼べます。部屋に空きがあるだけ、何体でも呼べます(1体につき1回)。部屋にいるあいだは何曲でも一緒に遊びます。1日{RHYTHM_BUDDY_FREE_PER_DAY}回までは無料、そのあとはセッション券を1枚使います。
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {detail
            ? <RhythmBuddyDetail masu={detail} mon={state.mons[detail.id]} dayKey={dayKey} songName={songName} onBack={() => setDetailId('')} />
            : <RhythmBuddyList masuMons={masuMons} state={state} dayKey={dayKey} onOpen={setDetailId} onPick={choose} busy={busy} canPay={canPay} calledIds={calledIds} />}
        </div>
        {!canPay && <p data-rhythm-buddy-empty className="mt-2 text-[11px] font-black text-rose-300">今日の無料ぶんを使い切りました。セッション券があれば呼べます</p>}
      </section>
    </div>
  );
}

// 画面: マスモン一覧(モンヒロビート)。M/B管理と、モンヒロビートのモードえらびから開く
function MasuBeatScreen({ masuMons = [], songs = [], tickets = 0, onBack, backLabel = 'M/B管理へ戻る' }) {
  const state = useRhythmBuddyState();
  const dayKey = useRhythmBuddyDayKey();
  const [detailId, setDetailId] = React.useState('');
  const freeLeft = rhythmBuddyFreeLeft(state, dayKey);
  const detail = detailId ? (masuMons || []).find((x) => x && x.id === detailId) : null;
  const songName = (id) => { const song = (songs || []).find((x) => x.songId === id); return song ? rhythmSongFullName(song) : '(曲)'; };
  return (
    <div data-mh-screen data-masu-beat className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="マスモン一覧(モンヒロビート)" accent="text-lime-300" onBack={detail ? () => setDetailId('') : onBack} backLabel={detail ? '一覧へ戻る' : backLabel} />
      <div className={`mx-auto w-full max-w-md space-y-2 ${SCREEN_LIST_CLASS}`}>
        <section className="rounded-2xl border border-lime-300/30 bg-slate-900/80 p-2.5">
          <RhythmBuddyAllowance freeLeft={freeLeft} tickets={tickets} className="text-slate-200" />
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">
            モンヒロビートのマルチで、部屋の「マスモンを呼ぶ」から呼んだマスモンが、一緒に遊ぶほどビートLvが上がって上手になります。バトルの絆や能力とは別に育ちます。
          </p>
        </section>
        {detail
          ? <RhythmBuddyDetail masu={detail} mon={state.mons[detail.id]} dayKey={dayKey} songName={songName} onBack={() => setDetailId('')} />
          : <RhythmBuddyList masuMons={masuMons} state={state} dayKey={dayKey} onOpen={setDetailId} />}
      </div>
    </div>
  );
}

// 結果画面で、呼んだマスモンを育てる(1ライブ1回。同じ回は2度数えない)。育ったことを短く見せる
function RhythmBuddyGrowth({ masu, round, songId, diffId, durationMs, teamRank, score = 0, maxScore = 0, chartLevel = 0, humans = 1 }) {
  const [shown, setShown] = React.useState(null);
  React.useEffect(() => {
    if (!masu || !round) return undefined;
    let alive = true;
    let outcome = null;
    const dayKey = rhythmBuddyDayKey(Date.now());
    RHYTHM_BUDDY_STORE.update((st) => {
      const moodId = rhythmBuddyMood(masu.id, dayKey, st.mons[masu.id]).id;
      const r = rhythmBuddyApplyLive(st.mons[masu.id], { round, songId, diffId, durationMs, teamRank, dayKey, lean: rhythmBuddyLeanOf(masu.baseId), nowMs: Date.now(), score, maxScore, chartLevel, humans, moodId });
      if (!r.gain) return null;
      outcome = r;
      return { ...st, mons: { ...st.mons, [masu.id]: r.mon } };
    }).then(() => { if (alive && outcome) setShown(outcome); });
    return () => { alive = false; };
  }, [masu && masu.id, round]);
  if (!shown || !masu) return null;
  const level = rhythmBuddyLevelInfo(shown.mon.exp).level;
  const trait = shown.traitNew ? rhythmBuddyTraitOf(shown.traitNew) : null;
  return (
    <p data-rhythm-buddy-growth className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-xl border border-lime-300/40 bg-lime-950/60 px-2 py-1 text-[11px] font-black text-lime-100">
      <span>🎵 {rhythmBuddyMasuName(masu)}</span>
      <span className="text-lime-300">経験値+{shown.gain}</span>
      {shown.levelUp > 0 && <span data-rhythm-buddy-levelup className="rounded bg-amber-300 px-1 text-slate-950">ビートLv.UP! Lv.{level}</span>}
      {shown.familiarUp && <span className="text-amber-200">この曲の得意度+1</span>}
      {trait && <span className="text-pink-200">性格が「{trait.label}」になった!</span>}
    </p>
  );
}
