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

// マスモンごとの、直近に言ったセリフ(保存しない。部屋を出ても覚えているのは、このページを開いている間だけ)
const rhythmBuddyTalkRecent = new Map();
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
  // 部屋のチャットで話す一言(2026-10-07)。性格・その日の調子で変わる。kind='result' のときは、MVP・出来で場面を決める。
  // 直近に言ったものは避ける(マスモンごとに8つ覚える)
  talk({ masuId, kind, songId = '', score = 0, diffId = '', mvp = false }) {
    const mon = RHYTHM_BUDDY_STORE.get().mons[masuId];
    const norm = rhythmBuddyNormalizeMon(mon);
    const mood = rhythmBuddyMood(masuId, rhythmBuddyDayKey(Date.now()), mon);
    let scene = kind;
    if (kind === 'result') {
      const diffDef = (typeof RHYTHM_DIFFICULTIES !== 'undefined' ? RHYTHM_DIFFICULTIES : []).find((d) => d.id === diffId);
      const ratio = Number(score) / ((diffDef && diffDef.maxScore) || 1000000);
      scene = mvp ? 'mvp' : ratio >= 0.9 ? 'high' : ratio >= 0.7 ? 'mid' : 'low';
    }
    const song = songId ? (songs || []).find((x) => x.songId === songId) : null;
    const key = String(masuId);
    const recent = rhythmBuddyTalkRecent.get(key) || [];
    const text = rhythmBuddyTalkPick({
      kind: scene, trait: norm.trait, moodId: mood && mood.id ? mood.id : 'normal',
      vars: { song: song ? rhythmSongFullName(song) : '' }, recent, rand: Math.random,
    });
    if (text) rhythmBuddyTalkRecent.set(key, [text, ...recent].slice(0, 8));
    return text;
  },
  // 得意な曲(上位3曲)から選ぶ。遊べる曲の中に無ければおまかせ('')
  pick(catalog, masuId) {
    const top = rhythmBuddyTopSongs(RHYTHM_BUDDY_STORE.get().mons[masuId], 3).filter((x) => (catalog || []).includes(x.songId));
    return top.length ? top[Math.floor(Math.random() * top.length)].songId : '';
  },
});

// ---- 小さな部品 ----
// 染色は全身の絵(imgUrl)に合わせて作ってあるので、顔アイコンではなく全身の絵を丸い枠に収める
// (2026-10-07 ユーザー指摘「顔アイコンを使うと染色で絶対におかしくなる」)
function RhythmBuddyFace({ masu, sizeClass = 'h-10 w-10' }) {
  const base = masu && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  const src = masuDisplayImageUrl(base);
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full border-2 border-lime-300/70 bg-slate-800 ${sizeClass}`}>
      {src ? <DyedMonsterImage baseId={masu.baseId} src={src} alt="" masuColors={getMasuColors(masu)} draggable={false} className="h-full w-full object-contain p-0.5" />
        : <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-lg">🎵</span>}
    </span>
  );
}
// その日の調子の顔(2026-10-07 ユーザー指示「機嫌の画像はこれを参考に」)。
// 参考にもらった画像は他社の素材なので使わず、「色付きの丸い玉にシンプルな顔」の雰囲気だけを借りてここで描く。
//   超ご機嫌=ピンク・大きく口を開けて笑う / ご機嫌=赤・にっこり / 普通=黄・口がまっすぐ / 不機嫌=青・への字 / 超不機嫌=紫・口を開けて落ちこむ
const RHYTHM_BUDDY_MOOD_FACE_COLORS = Object.freeze({
  great: ['#fbcfe8', '#ec4899'], good: ['#fca5a5', '#dc2626'], normal: ['#fde68a', '#f59e0b'], bad: ['#bae6fd', '#3b82f6'], awful: ['#ddd6fe', '#7c3aed'],
});
function RhythmBuddyMoodFace({ moodId, size = 24 }) {
  const [light, dark] = RHYTHM_BUDDY_MOOD_FACE_COLORS[moodId] || RHYTHM_BUDDY_MOOD_FACE_COLORS.normal;
  const gid = `mh-mood-${moodId}`;
  const ink = '#1f2937';
  const sad = moodId === 'bad' || moodId === 'awful';
  return (
    <svg data-rhythm-buddy-mood-face={moodId} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="inline-block shrink-0 align-middle">
      <defs>
        <radialGradient id={gid} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={light} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="18.5" fill={`url(#${gid})`} />
      <ellipse cx="14" cy="11" rx="6" ry="3.2" fill="#ffffff" opacity="0.35" />
      {sad
        ? <><path d="M10 15 L16 13" stroke={ink} strokeWidth="2.2" strokeLinecap="round" /><path d="M30 15 L24 13" stroke={ink} strokeWidth="2.2" strokeLinecap="round" /></>
        : <><rect x="13" y="11" width="2.6" height="7" rx="1.3" fill={ink} /><rect x="24.4" y="11" width="2.6" height="7" rx="1.3" fill={ink} /></>}
      {moodId === 'great' && <><path d="M11 22 Q20 36 29 22 Z" fill={ink} /><rect x="16" y="22.5" width="8" height="2.6" rx="1" fill="#ffffff" /><rect x="18.8" y="27" width="2.4" height="4" rx="1.2" fill="#f97316" /></>}
      {moodId === 'good' && <path d="M11 23 Q20 32 29 23" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
      {moodId === 'normal' && <path d="M13 26 L27 26" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
      {moodId === 'bad' && <path d="M13 29 Q20 22 27 29" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />}
      {moodId === 'awful' && <ellipse cx="20" cy="28" rx="5" ry="4" fill={ink} />}
    </svg>
  );
}
function RhythmBuddyStars({ stars }) {
  return <span aria-label={`得意度${stars}`} className="shrink-0 text-[11px] leading-none tracking-tight text-amber-300">{'★'.repeat(stars)}<span className="text-slate-600">{'★'.repeat(Math.max(0, 5 - stars))}</span></span>;
}
// 今日の残り回数とセッション券
function RhythmBuddyAllowance({ freeLeft, tickets, className = '', compact = false }) {
  return (
    <p data-rhythm-buddy-allowance className={`font-black ${compact ? 'text-[10px] leading-none' : 'text-[11px] leading-snug'} ${className}`}>
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
          <p data-rhythm-buddy-mood={mood.id} className="flex items-center gap-1 text-sm font-black"><RhythmBuddyMoodFace moodId={mood.id} size={22} />{mood.label}</p>
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

// ---- 一覧の並べ替え・種族・しぼりこみ(2026-10-07 ユーザー指示「バトル用みたいに絞り込みやソートをつけて」) ----
// 選んだ設定は新しい保存キーに覚える(既存のキーは触らない)。読むときは必ず正規化する
const RHYTHM_BUDDY_LIST_KEY = 'mh_masu_beat_list_v1';
const RHYTHM_BUDDY_SORTS = Object.freeze([
  Object.freeze({ key: 'level', label: 'ビートLv', firstDir: 'desc' }),
  Object.freeze({ key: 'lives', label: '遊んだ回数', firstDir: 'desc' }),
  Object.freeze({ key: 'mood', label: '今日の調子', firstDir: 'desc' }),
  Object.freeze({ key: 'recent', label: '最近遊んだ順', firstDir: 'desc' }),
  Object.freeze({ key: 'name', label: '名前', firstDir: 'asc' }),
  Object.freeze({ key: 'created', label: '登録した順', firstDir: 'asc' }),
]);
const RHYTHM_BUDDY_MOOD_RANK = Object.freeze({ great: 5, good: 4, normal: 3, bad: 2, awful: 1 });
// view … 'list'(1体1行) / 'card'(3列のカード。バトル側と同じ形)
const rhythmBuddyListDefaults = () => ({ sort: 'level', dir: 'desc', lineage: 'all', played: 'all', traits: [], moods: [], view: 'list' });
const rhythmBuddyNormalizeListSettings = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = rhythmBuddyListDefaults();
  const traitIds = [...RHYTHM_BUDDY_TRAIT_IDS, 'none'];
  return {
    sort: RHYTHM_BUDDY_SORTS.some((x) => x.key === o.sort) ? o.sort : d.sort,
    dir: o.dir === 'asc' || o.dir === 'desc' ? o.dir : d.dir,
    lineage: typeof o.lineage === 'string' && o.lineage ? o.lineage.slice(0, 40) : 'all',
    played: ['all', 'yes', 'no'].includes(o.played) ? o.played : 'all',
    traits: Array.isArray(o.traits) ? o.traits.filter((t) => traitIds.includes(t)) : [],
    moods: Array.isArray(o.moods) ? o.moods.filter((m) => RHYTHM_BUDDY_MOOD_RANK[m]) : [],
    view: o.view === 'card' ? 'card' : 'list',
  };
};
const useRhythmBuddyListSettings = () => {
  const [settings, setSettings] = React.useState(rhythmBuddyListDefaults);
  React.useEffect(() => {
    let alive = true;
    (async () => { try { const v = await storeGet(RHYTHM_BUDDY_LIST_KEY, null); if (alive) setSettings(rhythmBuddyNormalizeListSettings(v)); } catch (_) { /* 既定のまま */ } })();
    return () => { alive = false; };
  }, []);
  const update = (patch) => setSettings((prev) => {
    const next = rhythmBuddyNormalizeListSettings({ ...prev, ...patch });
    void storeSet(RHYTHM_BUDDY_LIST_KEY, next).catch(() => {});
    return next;
  });
  return [settings, update];
};
const rhythmBuddyLineageId = (baseId) => {
  try { return typeof monsterLineageOf === 'function' ? monsterLineageOf(baseId).main.id : ''; } catch (_) { return ''; }
};
// 一覧の行を作って、しぼりこみ・並べ替えをかける
const rhythmBuddyListRows = (masuMons, state, dayKey, settings) => {
  const st = settings || rhythmBuddyListDefaults();
  const rows = (Array.isArray(masuMons) ? masuMons : []).filter((x) => x && x.id && x.baseId).map((masu, index) => {
    const mon = state.mons[masu.id] || null;
    const m = rhythmBuddyNormalizeMon(mon);
    return {
      masu, mon, index, played: !!mon && m.lives > 0, exp: mon ? m.exp : -1, lives: m.lives,
      mood: rhythmBuddyMood(masu.id, dayKey, mon), trait: mon ? m.trait : '',
      recent: m.recent.length ? m.recent[0].at : 0, name: rhythmBuddyMasuName(masu), created: Number(masu.createdAt) || index,
    };
  }).filter((r) => (st.lineage === 'all' || rhythmBuddyLineageId(r.masu.baseId) === st.lineage)
    && (st.played === 'all' || (st.played === 'yes') === r.played)
    && (!st.traits.length || st.traits.includes(r.trait || 'none'))
    && (!st.moods.length || st.moods.includes(r.mood.id)));
  const val = (r) => (st.sort === 'level' ? r.exp : st.sort === 'lives' ? r.lives : st.sort === 'mood' ? RHYTHM_BUDDY_MOOD_RANK[r.mood.id] || 0
    : st.sort === 'recent' ? r.recent : st.sort === 'created' ? r.created : 0);
  const sign = st.dir === 'asc' ? 1 : -1;
  return rows.sort((a, b) => (st.sort === 'name' ? a.name.localeCompare(b.name, 'ja') * sign : (val(a) - val(b)) * sign) || (a.index - b.index));
};
// 一覧の上の3つのボタン(並べ替え・種族・しぼりこみ)。押すと設定の画面を開く
function RhythmBuddyListBar({ settings, onOpen, onChange }) {
  const sortOpt = RHYTHM_BUDDY_SORTS.find((x) => x.key === settings.sort) || RHYTHM_BUDDY_SORTS[0];
  const filterCount = (settings.played !== 'all' ? 1 : 0) + settings.traits.length + settings.moods.length;
  const lineage = settings.lineage !== 'all' && typeof lineageById === 'function' ? lineageById(settings.lineage) : null;
  const btn = 'min-h-[44px] flex items-center gap-1.5 rounded-xl border px-3 py-2 active:scale-95';
  return (
    <div data-rhythm-buddy-list-bar className="flex gap-2">
      <button type="button" onClick={() => onOpen('sort')} className={`${btn} min-w-0 flex-1 justify-between border-white/10 bg-slate-900`}>
        <span className="truncate text-[11px] font-black text-white">並べ替え: {sortOpt.label}{settings.dir === 'asc' ? '▲' : '▼'}</span>
        <span aria-hidden="true" className="shrink-0 text-slate-400">›</span>
      </button>
      <button type="button" onClick={() => onOpen('lineage')} className={`${btn} shrink-0 ${lineage ? 'border-indigo-400 bg-indigo-900' : 'border-white/10 bg-slate-900'}`}>
        <span className="truncate text-[11px] font-black text-white">{lineage ? `${lineage.name}種` : '種族'}</span>
      </button>
      <button type="button" onClick={() => onOpen('filter')} className={`${btn} shrink-0 ${filterCount ? 'border-lime-400 bg-lime-950' : 'border-white/10 bg-slate-900'}`}>
        <span className="text-[11px] font-black text-white">しぼりこみ</span>
        {filterCount > 0 && <span className="text-[10px] font-black text-lime-300">{filterCount}</span>}
      </button>
      <button data-rhythm-buddy-view-toggle={settings.view} type="button" onClick={() => onChange({ view: settings.view === 'card' ? 'list' : 'card' })}
        aria-label={settings.view === 'card' ? '1行の表示にする' : 'カードの表示にする'} className={`${btn} shrink-0 justify-center border-white/10 bg-slate-900`}>
        <span aria-hidden="true" className="text-sm font-black text-white">{settings.view === 'card' ? '☰' : '▦'}</span>
      </button>
    </div>
  );
}
// 並べ替え・種族・しぼりこみの設定の画面(バトル側と同じく、画面いっぱいに重ねる)
function RhythmBuddyListSheet({ tab, settings, onChange, onTab, onClose }) {
  const chip = (on) => `min-h-[48px] rounded-2xl text-sm font-black flex items-center justify-center gap-1 active:scale-95 ${on ? 'bg-lime-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`;
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const lineages = typeof dexMainLineages === 'function' ? dexMainLineages() : [];
  return (
    <div data-rhythm-buddy-list-sheet className="fixed inset-0 z-[87000] flex flex-col" style={{ backgroundColor: 'rgba(2,6,23,0.98)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 p-4">
        <h3 className="flex-1 text-base font-black text-white">並べ替え・しぼりこみ</h3>
        <button type="button" aria-label="閉じる" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-full bg-white/5 text-lg font-black">✕</button>
      </div>
      <div className="flex shrink-0 gap-2 px-4 pt-3">
        {[{ key: 'sort', label: '並べ替え' }, { key: 'lineage', label: '種族' }, { key: 'filter', label: 'しぼりこみ' }].map((t) => (
          <button key={t.key} type="button" onClick={() => onTab(t.key)} className={`min-h-[44px] flex-1 rounded-xl text-xs font-black active:scale-95 ${tab === t.key ? 'bg-lime-500 text-slate-950' : 'border border-slate-800 bg-slate-900 text-slate-400'}`}>{t.label}</button>
        ))}
      </div>
      <div className="mh-scroll min-h-0 flex-1 overflow-y-auto p-4" style={{ paddingBottom: 'calc(1rem + var(--mh-sa-bottom))' }}>
        {tab === 'sort' && (
          <div className="grid grid-cols-2 gap-2.5">
            {RHYTHM_BUDDY_SORTS.map((opt) => {
              const active = settings.sort === opt.key;
              return (
                <button key={opt.key} type="button" onClick={() => onChange(active ? { dir: settings.dir === 'asc' ? 'desc' : 'asc' } : { sort: opt.key, dir: opt.firstDir })} className={chip(active)}>
                  {opt.label}{active && <span>{settings.dir === 'asc' ? '▲' : '▼'}</span>}
                </button>
              );
            })}
          </div>
        )}
        {tab === 'lineage' && (
          <div>
            <p className="mb-2.5 text-[10px] leading-relaxed text-slate-400">選んだ種族だけを表示します。並べ替え・しぼりこみはそのまま効きます。</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[{ id: 'all', label: 'すべて' }, ...lineages.map((l) => ({ id: l.id, label: `${l.name}種` }))].map((opt) => (
                <button key={opt.id} type="button" onClick={() => onChange({ lineage: opt.id })} className={chip(settings.lineage === opt.id)}>{opt.label}</button>
              ))}
            </div>
          </div>
        )}
        {tab === 'filter' && (
          <div className="space-y-4">
            <section>
              <h4 className="mb-1.5 text-[11px] font-black text-slate-300">一緒に遊んだか</h4>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: 'all', label: 'すべて' }, { id: 'yes', label: '遊んだ子' }, { id: 'no', label: 'まだの子' }].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => onChange({ played: opt.id })} className={chip(settings.played === opt.id)}>{opt.label}</button>
                ))}
              </div>
            </section>
            <section>
              <h4 className="mb-1.5 text-[11px] font-black text-slate-300">性格<small className="ml-1 font-bold text-slate-500">(何も選ばなければすべて)</small></h4>
              <div className="grid grid-cols-2 gap-2">
                {[...RHYTHM_BUDDY_TRAITS.map((t) => ({ id: t.id, label: t.label })), { id: 'none', label: 'まだ見えない' }].map((opt) => (
                  <button key={opt.id} type="button" onClick={() => onChange({ traits: toggle(settings.traits, opt.id) })} className={chip(settings.traits.includes(opt.id))}>{opt.label}</button>
                ))}
              </div>
            </section>
            <section>
              <h4 className="mb-1.5 text-[11px] font-black text-slate-300">今日の調子<small className="ml-1 font-bold text-slate-500">(何も選ばなければすべて)</small></h4>
              <div className="grid grid-cols-2 gap-2">
                {RHYTHM_BUDDY_MOODS.map((mood) => (
                  <button key={mood.id} type="button" onClick={() => onChange({ moods: toggle(settings.moods, mood.id) })} className={chip(settings.moods.includes(mood.id))}>
                    <RhythmBuddyMoodFace moodId={mood.id} size={20} />{mood.label}
                  </button>
                ))}
              </div>
            </section>
            <button type="button" onClick={() => onChange({ lineage: 'all', played: 'all', traits: [], moods: [] })} className="min-h-[44px] w-full rounded-xl bg-slate-700 text-sm font-black">しぼりこみをすべて外す</button>
          </div>
        )}
      </div>
    </div>
  );
}
// 一覧に、並べ替え・しぼりこみのバーと設定の画面をまとめて付ける
const useRhythmBuddyListControls = () => {
  const [settings, update] = useRhythmBuddyListSettings();
  const [tab, setTab] = React.useState('');
  const bar = <RhythmBuddyListBar settings={settings} onOpen={setTab} onChange={update} />;
  const sheet = tab ? <RhythmBuddyListSheet tab={tab} settings={settings} onChange={update} onTab={setTab} onClose={() => setTab('')} /> : null;
  return { settings, bar, sheet };
};

// マスモンの一覧(1行ずつ)。onPick を渡すと「呼ぶ」ボタンが付く
function RhythmBuddyList({ masuMons, state, dayKey, onOpen, onPick = null, busy = false, canPay = true, calledIds = [], settings = null }) {
  const list = rhythmBuddyListRows(masuMons, state, dayKey, settings);
  if (list.length === 0) return <p className="py-6 text-center text-[12px] font-bold text-slate-400">{(masuMons || []).length ? 'しぼりこみに当てはまるマスモンがいません' : 'マスモンがまだいません'}</p>;
  if (settings && settings.view === 'card') {
    // バトル側と同じ3列のカード。絵・名前・ビートLv・調子の顔。呼ぶボタンは下に付ける(「マスモンを呼ぶ」のとき)
    return (
      <div data-rhythm-buddy-cards className="grid grid-cols-3 gap-2.5 pb-4">
        {list.map(({ masu, mon }) => {
          const mood = rhythmBuddyMood(masu.id, dayKey, mon);
          const level = mon ? rhythmBuddyLevelInfo(mon.exp).level : 0;
          const called = calledIds.includes(masu.id);
          return (
            <div key={masu.id} data-rhythm-buddy-card className="flex flex-col gap-1">
              <button type="button" onClick={() => onOpen(masu.id)} style={{ minHeight: '112px' }}
                className="relative flex w-full select-none flex-col items-center gap-1 rounded-2xl border-2 border-white/10 bg-slate-900 p-2 active:scale-95">
                <span className="absolute right-1.5 top-1.5" aria-label={`今日の調子 ${mood.label}`}><RhythmBuddyMoodFace moodId={mood.id} size={18} /></span>
                <RhythmBuddyFace masu={masu} sizeClass="h-12 w-12" />
                <b className="w-full truncate text-center text-[11px] font-black">{rhythmBuddyMasuName(masu)}</b>
                <small className="text-[10px] font-black text-lime-200">{mon ? `ビートLv.${level}` : '未プレイ'}</small>
              </button>
              {onPick && (called
                ? <span data-rhythm-buddy-called className="rounded-xl border border-lime-300/50 py-2 text-center text-[10px] font-black text-lime-200">呼んでいる</span>
                : <button data-rhythm-buddy-call type="button" disabled={busy || !canPay} onClick={() => onPick(masu)}
                  className="min-h-[40px] rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 text-xs font-black text-slate-950 disabled:opacity-40">呼ぶ</button>)}
            </div>
          );
        })}
      </div>
    );
  }
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
              <span aria-label={`今日の調子 ${mood.label}`} className="shrink-0 text-center"><span className="flex justify-center"><RhythmBuddyMoodFace moodId={mood.id} size={24} /></span><small className="block text-[8px] font-black text-slate-400">{mood.label}</small></span>
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
function RhythmBuddySheet({ masuMons = [], masuPicker = null, songName, tickets = 0, pick, onClose, calledIds = [] }) {
  const state = useRhythmBuddyState();
  const dayKey = useRhythmBuddyDayKey();
  const [detailId, setDetailId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const freeLeft = rhythmBuddyFreeLeft(state, dayKey);
  const detail = detailId ? (masuMons || []).find((x) => x && x.id === detailId) : null;
  const canPay = freeLeft > 0 || tickets > 0;
  const listControls = useRhythmBuddyListControls();
  // M/B管理の「マスモン一覧(バトル)」と同じ並べ替え・カードで選ぶ(2026-10-07・ユーザー指示「マスモン呼び出しも管理画面と同じものに」)
  const [selId, setSelId] = React.useState('');
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
            : masuPicker
              ? <div data-rhythm-buddy-picker>
                {masuPicker.renderSortFilterBar({ singleType: true })}
                {masuPicker.entries.length === 0
                  ? <p className="py-6 text-center text-[12px] font-bold text-slate-400">{(masuMons || []).length ? '表示設定に当てはまるマスモンがいません' : 'マスモンがまだいません'}</p>
                  : <div className="grid grid-cols-3 gap-2.5 pb-4">
                    {masuPicker.entries.map((e) => (
                      <button key={e.key} type="button" data-rhythm-buddy-card onClick={() => setSelId(e.masu.id)} style={masuPicker.cardStyle}
                        className={`${masuPicker.cardClass} ${selId === e.masu.id ? 'border-lime-300 bg-slate-800' : 'border-white/10 bg-slate-900'}`}>
                        {masuPicker.renderCardBody({
                          masu: e.masu, base: e.base, nameBand: true,
                          status: calledIds.includes(e.masu.id) ? <span className="rounded-full bg-lime-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">呼んでいる</span> : null,
                        })}
                      </button>
                    ))}
                  </div>}
              </div>
              : <div className="space-y-2">{listControls.bar}<RhythmBuddyList masuMons={masuMons} state={state} dayKey={dayKey} onOpen={setDetailId} onPick={choose} busy={busy} canPay={canPay} calledIds={calledIds} settings={listControls.settings} /></div>}
        </div>
        {masuPicker && !detail && (() => {
          const masu = selId ? (masuMons || []).find((x) => x && x.id === selId) : null;
          if (!masu) return <p className="mt-2 text-center text-[11px] font-bold text-slate-400">呼びたいマスモンをタップしてください</p>;
          const mon = state.mons[masu.id];
          const mood = rhythmBuddyMood(masu.id, dayKey, mon);
          const called = calledIds.includes(masu.id);
          return (
            <div data-rhythm-buddy-confirm className="mt-2 flex shrink-0 items-center gap-2 rounded-2xl border border-lime-300/40 bg-slate-950/80 p-2">
              <RhythmBuddyFace masu={masu} sizeClass="h-11 w-11" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13px] font-black">{rhythmBuddyMasuName(masu)}</b>
                <small className="flex items-center gap-1 text-[10px] font-bold text-slate-300"><RhythmBuddyMoodFace moodId={mood.id} size={16} />{mon ? `ビートLv.${rhythmBuddyLevelInfo(mon.exp).level}` : 'まだ一緒に遊んでいない'}</small>
              </span>
              <button type="button" onClick={() => setDetailId(masu.id)} className="min-h-[44px] shrink-0 rounded-xl bg-slate-700 px-2 text-[11px] font-black">くわしく</button>
              {called
                ? <span data-rhythm-buddy-called className="shrink-0 rounded-xl border border-lime-300/50 px-2 py-3 text-[10px] font-black text-lime-200">呼んでいる</span>
                : <button data-rhythm-buddy-call type="button" disabled={busy || !canPay} onClick={() => choose(masu)}
                  className="min-h-[44px] shrink-0 rounded-xl bg-gradient-to-b from-lime-400 to-emerald-600 px-4 text-sm font-black text-slate-950 disabled:opacity-40">呼ぶ</button>}
            </div>
          );
        })()}
        {listControls.sheet}
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
  const listControls = useRhythmBuddyListControls();
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
          : <>{listControls.bar}<RhythmBuddyList masuMons={masuMons} state={state} dayKey={dayKey} onOpen={setDetailId} settings={listControls.settings} /></>}
      </div>
      {listControls.sheet}
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
    <p data-rhythm-buddy-growth className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 rounded-xl border border-lime-300/40 bg-lime-950/60 px-2 py-0.5 text-[10px] font-black leading-tight text-lime-100">
      <span className="max-w-full truncate">🎵 {rhythmBuddyMasuName(masu)}</span>
      <span className="text-lime-300">経験値+{shown.gain}</span>
      {shown.levelUp > 0 && <span data-rhythm-buddy-levelup className="rounded bg-amber-300 px-1 text-slate-950">ビートLv.UP! Lv.{level}</span>}
      {shown.familiarUp && <span className="text-amber-200">この曲の得意度+1</span>}
      {trait && <span className="text-pink-200">性格が「{trait.label}」になった!</span>}
    </p>
  );
}

// ==================== マスモンランキング(モンヒロビート・2026-10-07) ====================
// マスモン1体ごとの「ビートLv」と「難易度ごとの最高スコア」の順位。血統は関係なく、そのマスモンの名前と見た目(染色つき)で並べる。
// 中身は rhythm_buddy_ranks(39-rhythm-buddy-rank-api.jsx)。テーブルがまだ無いときは「準備中」と出す。
const RHYTHM_BUDDY_RANK_CACHE_MS = 20000;
const rhythmBuddyRankCache = new Map();
function RhythmBuddyRankingBoard({ renderBreederIcon = null, selfName = '', onClose = null }) {
  const [kind, setKind] = React.useState('level');
  const [diffId, setDiffId] = React.useState('MASTER');
  const [state, setState] = React.useState({ status: 'loading', entries: [] });
  const [selfId, setSelfId] = React.useState('');
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => { let alive = true; ensureBreederId().then((id) => { if (alive && typeof id === 'string') setSelfId(id); }).catch(() => {}); return () => { alive = false; }; }, []);
  const cacheKey = kind === 'score' ? `score:${diffId}` : 'level';
  React.useEffect(() => {
    let alive = true;
    const hit = rhythmBuddyRankCache.get(cacheKey);
    if (hit) setState({ status: 'ready', entries: hit.entries });
    else setState({ status: 'loading', entries: [] });
    if (hit && Date.now() - hit.at < RHYTHM_BUDDY_RANK_CACHE_MS) return () => { alive = false; };
    sbFetchRhythmBuddyRanks(kind, diffId).then((entries) => {
      if (!alive) return;
      if (entries == null) { setState({ status: 'missing', entries: [] }); return; }
      rhythmBuddyRankCache.set(cacheKey, { at: Date.now(), entries });
      setState({ status: 'ready', entries });
    }).catch(() => { if (alive && !hit) setState({ status: 'error', entries: [] }); });
    return () => { alive = false; };
  }, [cacheKey, retry]);
  const songName = (id) => { const song = (typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : []).find((x) => x.songId === id); return song ? rhythmSongFullName(song) : ''; };
  const chip = (on) => `min-h-[36px] shrink-0 rounded-full border px-3 text-[11px] font-black ${on ? 'border-lime-300 bg-lime-500/25 text-lime-100' : 'border-white/10 bg-slate-900 text-slate-400'}`;
  const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1));
  return (
    <div data-rhythm-buddy-ranking className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        {onClose && <button data-rhythm-buddy-ranking-back type="button" aria-label="戻る" onClick={onClose} className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-lg font-black text-slate-300">←</button>}
        <div className="min-w-0 flex-1 leading-tight">
          <b className="block truncate text-base font-black text-lime-100">🎶 マスモンランキング</b>
          <small className="block text-[10px] font-bold text-slate-400">モンヒロビートで育てたマスモンの順位です</small>
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto">
        <button type="button" data-rhythm-buddy-ranking-tab="level" onClick={() => setKind('level')} className={chip(kind === 'level')}>ビートLv</button>
        <button type="button" data-rhythm-buddy-ranking-tab="score" onClick={() => setKind('score')} className={chip(kind === 'score')}>最高スコア</button>
      </div>
      {kind === 'score' && (
        <div data-rhythm-buddy-ranking-diffs className="flex gap-1.5 overflow-x-auto">
          {RHYTHM_BUDDY_DIFF_IDS.map((id) => <button key={id} type="button" onClick={() => setDiffId(id)} className={chip(diffId === id)}>{rhythmBuddyDiffShort[id]}</button>)}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {state.status === 'loading' && <p className="py-8 text-center text-sm font-bold text-slate-400">読み込み中…</p>}
        {state.status === 'missing' && <p data-rhythm-buddy-ranking-missing className="py-8 text-center text-sm font-bold text-amber-200">マスモンランキングは準備中です</p>}
        {state.status === 'error' && (
          <div className="py-8 text-center">
            <p className="text-sm font-bold text-amber-200">ランキングを読み込めませんでした</p>
            <button type="button" onClick={() => { rhythmBuddyRankCache.delete(cacheKey); setRetry((n) => n + 1); }} className="mt-2 min-h-[44px] rounded-xl bg-slate-800 px-4 text-sm font-black">もう一度読み込む</button>
          </div>
        )}
        {state.status === 'ready' && state.entries.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">まだ記録がありません。マルチの部屋でマスモンを呼んで、育ててみましょう</p>}
        {state.status === 'ready' && state.entries.map((e, i) => {
          const base = ALL_PLAYER_MONSTERS[e.monsterId];
          const mine = (selfId && e.breederId === selfId) || (!e.breederId && !!selfName && e.userName === selfName);
          const score = e.scores[diffId] || 0;
          const sub = kind === 'score' ? (songName(e.songs[diffId]) || '') : `${e.lives}ライブ`;
          return (
            <article key={`${e.breederId || e.userName}-${e.individualId}`} data-rhythm-buddy-ranking-row={i + 1} data-mine={mine ? '1' : undefined}
              className={`grid grid-cols-[28px_32px_44px_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border p-2 ${mine ? 'border-lime-300/70 bg-lime-500/10' : i === 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/5 bg-slate-900'}`}>
              <b className="text-center text-sm font-black text-slate-200">{medal(i)}</b>
              {renderBreederIcon ? renderBreederIcon({ userName: e.userName, icon: e.icon, profileFrame: e.profileFrame, breederId: e.breederId }) : <span aria-hidden="true" className="text-lg">👤</span>}
              <span className="relative block h-11 w-11 overflow-hidden rounded-lg bg-slate-800">
                <DyedMonsterImage baseId={e.monsterId} src={masuDisplayImageUrl(base)} alt="" masuColors={e.colors} draggable={false} className="h-full w-full object-contain" />
              </span>
              <span className="min-w-0 leading-tight">
                <b className="block truncate text-[13px] font-black text-white">{e.monName}</b>
                <small className="block truncate text-[10px] font-bold text-slate-400">{e.userName}{mine ? '(あなた)' : ''}</small>
                {sub && <small className="block truncate text-[10px] font-bold text-slate-500">{sub}</small>}
              </span>
              <b className="text-right text-base font-black leading-tight text-lime-200">
                {kind === 'score' ? <>{score.toLocaleString()}<small className="block text-[9px] font-bold text-slate-400">点</small></> : <>Lv.{e.beatLevel}<small className="block text-[9px] font-bold text-slate-400">{e.beatExp.toLocaleString()}EXP</small></>}
              </b>
            </article>
          );
        })}
      </div>
    </div>
  );
}
