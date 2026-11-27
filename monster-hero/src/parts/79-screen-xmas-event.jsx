// ===== クリスマスイベント「聖夜の名探偵」のイベントページ(台帳 r1126-006・社長 2026-11-26「この形で作る」) =====
// 上: 題・戻る・横長のポスター・開催期間の帯 / タブ: 物語・レイド・ボーナス
//  ・物語: 登場人物パネル(はじめてだれかがいなくなった話を読んでから)と話の一覧。話は選んで読む(自動では流さない)
//  ・レイド: クリスマスのレイド画面(79-screen-raid-jack.jsx の RaidJackScreen)をそのまま入れる。上の題・ポスター・タブは head で渡す
//  ・ボーナス: 期間中のボーナスの一覧(絵文字は使わずアイコン)
// 入口は App の openRaidXmas(HOME のイベントの札・デバッグ)。開始時刻まで(RELEASE_FLAGS.raidXmas が偽)は出さない。
// gameState はレイドと同じ 'RAID_JACK'(バトル・ビート・カードから戻るときに setGameState('RAID_JACK') でここへ帰る)。

// ポスター(告知用の2枚で確定・台帳 r1126-057。本番用の別の絵は使わない)。横長 1000×500
const XMAS_EVENT_POSTER_IMG = 'images/events/xmas-2026-event-wide.jpg';
// 開催中に出す絵。予告の絵には「開催予告」の文字とボスの影が入っているので開催中は出さない(2026-11-26 窓口)。
//   本番用の絵が届くまでは null にしておき、ペンションの雪景色(事件簿の背景)に題字を重ねた帯で出す
const XMAS_EVENT_POSTER_OPEN_IMG = null;
const XMAS_EVENT_TITLE_BAND_BG = 'images/story-bg/xmas_mountain_road.jpg';

const XMAS_EVENT_TABS = Object.freeze([
  { id: 'story', label: '物語', color: '#b4232c' },
  { id: 'raid', label: 'レイド', color: '#15803d' },
  { id: 'bonus', label: 'ボーナス', color: '#a16207' },
]);

// 日時を「12/1(火) 4:00」の形で(日本時間)
const XMAS_EVENT_WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const xmasEventDateLabel = (iso, withYear = false) => {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + 9 * 3600000);
  const y = withYear ? `${d.getUTCFullYear()}/` : '';
  return `${y}${d.getUTCMonth() + 1}/${d.getUTCDate()}(${XMAS_EVENT_WEEK[d.getUTCDay()]}) ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
// 終わりは 4:00 ちょうどなので、画面には1分前の 3:59 と出す(ポスター・告知と同じ)
const xmasEventPeriodText = () => `${xmasEventDateLabel(RAID_XMAS_EVENT.startAt, true)} 〜 ${xmasEventDateLabel(new Date(Date.parse(RAID_XMAS_EVENT.endAt) - 60000).toISOString())}`;

// ボーナスのアイコン(10-core.jsx の _icon に無い形だけ、ここで描く)
const XMAS_EVENT_ICON_PATHS = {
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  shirt: '<path d="M20.4 3.5 16 2a4 4 0 0 1-8 0L3.6 3.5a2 2 0 0 0-1.3 2.2l.6 3.5a1 1 0 0 0 1 .8H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.2a1 1 0 0 0 1-.8l.6-3.5a2 2 0 0 0-1.4-2.2z"/>',
  picture: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
};
const XmasEventIcon = ({ name, size = 22 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: XMAS_EVENT_ICON_PATHS[name] || '' }} />
);

const XMAS_EVENT_BONUSES = Object.freeze([
  { id: 'rhythm', icon: () => <XmasEventIcon name="music" />, tone: 'border-fuchsia-300/50 bg-fuchsia-950/40 text-fuchsia-100',
    title: 'モンヒロビート', big: '5倍', body: '11/30(月) 0:00 から、もらえるビートPと、クイックの∞周回を回しながら遊ぶと入る周回数が5倍になります' },
  { id: 'card', icon: () => <Layers size={22} />, tone: 'border-sky-300/50 bg-sky-950/40 text-sky-100',
    title: 'MFバトルカード', big: '1.5倍', body: '対戦のごほうび(ビートP・カードランクの経験値・クイック周回)が1.5倍になります' },
  { id: 'battle', icon: () => <Sword size={22} />, tone: 'border-orange-300/50 bg-orange-950/40 text-orange-100',
    title: 'モンヒロバトル', big: '1.5倍', body: 'バトルでもらえる経験値とダイヤが1.5倍になります' },
  { id: 'costume', icon: () => <XmasEventIcon name="shirt" />, tone: 'border-rose-300/50 bg-rose-950/40 text-rose-100',
    title: '助手のクリスマスきせかえ', big: '', body: '助手8人のクリスマスのきせかえが、ビートP交換所の「着替え」に並びます(ソラシドとあつは探偵の衣装です)' },
  { id: 'art', icon: () => <XmasEventIcon name="picture" />, tone: 'border-emerald-300/50 bg-emerald-950/40 text-emerald-100',
    title: 'ホーム・タイトルのクリスマスの絵', big: '', body: 'ホームとタイトルがクリスマスの絵になります(設定の「ホーム画面アレンジ」で選べます)' },
]);

// ---- 見た目(クリスマスの飾り・台帳 r1126-006 社長「作りをもっと丁寧に」) ----
//  雪(背景の粒・ゆっくり落ちる)・柊・金の縁・リボンの帯。ハロウィンのレイド画面と同じ画面の骨組み(SCREEN_SHELL_CLASS・ScreenHead・ScreenTabs)の上に飾りだけ足す。
//  動きは prefers-reduced-motion で止める。CSS は <head> に1回だけ入れる(画面の DOM に <style> を混ぜない)
const XMAS_EVENT_CSS = `
.mh-xmas-shell { position: relative; isolation: isolate; background: radial-gradient(120% 60% at 50% 0%, #17305f 0%, #0b1733 45%, #060b1c 100%); }
.mh-xmas-shell::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .55;
  background-image: radial-gradient(1.6px 1.6px at 12% 18%, #fff 50%, transparent 51%), radial-gradient(1.2px 1.2px at 32% 62%, #fff 50%, transparent 51%),
    radial-gradient(2px 2px at 58% 28%, #fff 50%, transparent 51%), radial-gradient(1.3px 1.3px at 78% 74%, #fff 50%, transparent 51%),
    radial-gradient(1.7px 1.7px at 90% 12%, #fff 50%, transparent 51%), radial-gradient(1.1px 1.1px at 45% 90%, #fff 50%, transparent 51%);
  background-size: 220px 260px; animation: mh-xmas-snow 26s linear infinite; }
@keyframes mh-xmas-snow { from { background-position: 0 0; } to { background-position: 40px 260px; } }
.mh-xmas-title { background: linear-gradient(180deg, #fff6d6 0%, #f3cf72 55%, #c8923a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; letter-spacing: .04em; }
.mh-xmas-frame { border: 2px solid #e6c068; box-shadow: 0 0 0 2px #5c1414, 0 0 0 3px #e6c06866, 0 6px 16px #0008; }
.mh-xmas-ribbon { position: relative; background: linear-gradient(180deg, #b3202a 0%, #7d1018 100%); border-top: 1.5px solid #f0c96c; border-bottom: 1.5px solid #f0c96c;
  clip-path: polygon(0 0, 100% 0, calc(100% - 10px) 50%, 100% 100%, 0 100%, 10px 50%); }
.mh-xmas-card { background: linear-gradient(180deg, #13213f 0%, #0c162d 100%); border: 1px solid #e6c06855; }
.mh-xmas-card[data-status="locked"], .mh-xmas-card[data-status="waiting"] { background: #0a1124; border-color: #ffffff12; }
.mh-xmas-medal { background: radial-gradient(circle at 35% 30%, #fff3c4 0%, #e6c068 45%, #a87424 100%); color: #3a1d05; box-shadow: 0 0 0 2px #5c1414, 0 2px 4px #0008; }
.mh-xmas-medal[data-dim] { background: #1c2742; color: #64748b; box-shadow: 0 0 0 1px #ffffff1a; }
.mh-xmas-new { background: linear-gradient(180deg, #e11d48, #9f1239); box-shadow: 0 0 0 1px #f0c96c; }
@media (prefers-reduced-motion: reduce) { .mh-xmas-shell::before { animation: none; } }
@keyframes mh-xmas-cast-fade { from { filter: none; } to { filter: grayscale(1) brightness(.7); } }
@keyframes mh-xmas-cast-stamp { 0% { opacity: 0; transform: rotate(-14deg) scale(2.2); } 60% { opacity: 1; transform: rotate(-14deg) scale(.92); } 100% { opacity: 1; transform: rotate(-14deg) scale(1); } }
[data-xmas-cast-face][data-away] img { filter: grayscale(1) brightness(.7); }
[data-xmas-cast-face][data-away][data-newly] img { animation: mh-xmas-cast-fade 1.2s ease-out both; }
[data-xmas-cast-stamp] { transform: rotate(-14deg); }
[data-xmas-cast-face][data-newly] [data-xmas-cast-stamp] { animation: mh-xmas-cast-stamp .5s 1.1s ease-out both; }
@media (prefers-reduced-motion: reduce) { [data-xmas-cast-face] img, [data-xmas-cast-stamp] { animation: none !important; } }
`;
const useXmasEventCss = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-xmas-event-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-xmas-event-css'; tag.textContent = XMAS_EVENT_CSS; document.head.appendChild(tag);
  }, []);
};
// 柊(葉2枚と実3つ)。飾りなので読み上げない
const XmasHolly = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
    <path d="M15 17 C11 9 5 9 2 12 C5 13 5 16 3 18 C7 17 9 20 9 22 C11 19 14 19 15 17Z" fill="#15803d" stroke="#0b4d24" strokeWidth="1" />
    <path d="M17 17 C21 9 27 9 30 12 C27 13 27 16 29 18 C25 17 23 20 23 22 C21 19 18 19 17 17Z" fill="#16a34a" stroke="#0b4d24" strokeWidth="1" />
    <circle cx="13.5" cy="18.5" r="3" fill="#dc2626" stroke="#7f1d1d" strokeWidth=".8" />
    <circle cx="18.5" cy="18.5" r="3" fill="#ef4444" stroke="#7f1d1d" strokeWidth=".8" />
    <circle cx="16" cy="14.5" r="3" fill="#dc2626" stroke="#7f1d1d" strokeWidth=".8" />
    <circle cx="15" cy="13.6" r=".9" fill="#fff" opacity=".7" />
  </svg>
);
// 小見出し(柊+金の字)。物語・ボーナスの区切りに使う
const XmasSectionTitle = ({ children, right = null }) => (
  <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
    <XmasHolly size={18} />
    <span className="mh-xmas-title text-[13px] font-black">{children}</span>
    <span className="h-px flex-1 bg-gradient-to-r from-amber-300/50 to-transparent" aria-hidden="true" />
    {right}
  </div>
);

// ---- 登場人物パネル(推理ドラマの登場人物パネル風・台帳 r1125-063) ----
//  no: 読み終えた話の番号。はじめてだれかがいなくなる話より前は何も出さない(社長 2026-11-26)
//  いなくなった人は白黒+「行方不明」のはんこ。帯に「のこった人 ◯人 / 空になった箱 ◯つ」(10人みんなを数える)
//  animate: その話でいなくなった人だけ、色が抜けてはんこが押される動き(お話の終わりで使う。一覧では動かさない)
const XmasCastPanel = ({ no, animate = false, compact = false }) => {
  useXmasEventCss();
  const at = xmasStoryCastAt(no);
  if (!at.shown) return null;
  return (
    <section data-xmas-cast-panel={no} aria-label="登場人物" className="mh-xmas-frame rounded-2xl bg-[#0a1430]/95 px-2 pb-2 pt-1.5">
      <XmasSectionTitle>登場人物</XmasSectionTitle>
      <div className="grid grid-cols-5 gap-x-1.5 gap-y-1">
        {XMAS_STORY_CAST.map((c) => {
          const away = at.missing.includes(c.id);
          const newly = animate && at.newly.includes(c.id);
          return (
            <div key={c.id} data-xmas-cast-face={c.id} data-away={away ? '' : undefined} data-newly={newly ? '' : undefined} className="min-w-0 text-center">
              <div className={`relative mx-auto aspect-square w-full overflow-hidden rounded-md border-2 ${away ? 'border-slate-600 bg-slate-800' : 'border-[#f3e3b3] bg-[#2a3a62]'} ${compact ? 'max-w-[48px]' : 'max-w-[66px]'}`}>
                <img src={xmasCastFaceOf(c)} alt="" className="h-full w-full object-cover object-top" />
                {away && (
                  <span data-xmas-cast-stamp aria-label="行方不明" className="absolute inset-0 m-auto flex h-max w-max flex-col items-center rounded border-2 border-rose-500 bg-white/85 px-0.5 text-[10px] font-black leading-none text-rose-600"><span className="py-px">行方</span><span className="py-px">不明</span></span>
                )}
              </div>
              <div className={`mt-0.5 truncate text-[10px] font-black ${away ? 'text-slate-500' : 'text-amber-50'}`}>{c.name}</div>
            </div>
          );
        })}
      </div>
      <div data-xmas-cast-band className="mh-xmas-ribbon mt-1.5 py-1 text-center text-[11px] font-black text-amber-50">
        のこった人 <b className="text-[13px] text-white">{at.left}</b>人 ／ 空になった箱 <b className="text-[13px] text-white">{at.emptyBoxes}</b>つ
      </div>
    </section>
  );
};

// ---- 物語タブ ----
const xmasStoryHasScript = (chapter) => typeof EVENT_REPLAYS !== 'undefined' && Array.isArray(EVENT_REPLAYS)
  && EVENT_REPLAYS.some((e) => e && e.id === chapter.scriptId);
const XMAS_STORY_WAY_LABELS = Object.freeze({ battle: 'モンヒロバトル', rhythm: 'モンヒロビート', card: 'MFバトルカード' });
const XmasTypeTag = ({ type, dim = false }) => (
  <span className={`inline-flex min-h-[22px] shrink-0 items-center gap-0.5 rounded-full px-2 text-[10px] font-black ${type === 'fight' ? 'bg-orange-700 text-orange-50' : 'bg-indigo-700 text-indigo-50'} ${dim ? 'opacity-40' : ''}`}>
    {type === 'fight' ? <Sword size={11} /> : <BookOpen size={11} />}{type === 'fight' ? '戦う' : '読む'}
  </span>
);

const XmasStoryTab = ({ version = 0, allOpen = false, fightWays = [], onRead, onFight }) => {
  const [progress, setProgress] = useState(null);
  const [sel, setSel] = useState(null);
  const nowMs = Date.now();
  useEffect(() => {
    let alive = true;
    xmasStoryLoad().then((p) => { if (alive) setProgress(p); });
    return () => { alive = false; };
  }, [version]);
  if (!progress) return <div className="py-6 text-center text-[11px] text-slate-300">読み込み中…</div>;
  const reached = xmasStoryReachedNo(progress);
  const chapter = sel ? XMAS_STORY_CHAPTERS.find((c) => c.id === sel) : null;
  // 本編の開幕(11/28 10:00)より前は序章だけを見せる(台帳 r1126-022・本編はひとつのコンテンツで 11/28 に出る・r1126-063 で 11/30 から前倒し。毎日1話ずつ開く形はやめた)
  const preMain = !allOpen && !(nowMs >= Date.parse(RAID_XMAS_EVENT.startAt));
  // 本編はミステリーノベル『モンヒロ事件簿』(79-screen-xmas-novel.jsx の openXmasNovel)。ここに並べるのは序章だけ(台帳 r1126-022)
  const shownChapters = XMAS_STORY_CHAPTERS.filter((c) => c.prologue);
  const storyNote = preMain
    ? `${xmasEventDateLabel(XMAS_STORY_PROLOGUE_OPEN_AT)} から序章が読めます。本編は ${xmasEventDateLabel(RAID_XMAS_EVENT.startAt)} から始まります`
    : '序章は、期間中いつでも読み返せます';
  // 本編の入口: 開幕から期間の終わりまで(デバッグの強制表示では、期間の外でも開く)
  const novelOpen = typeof openXmasNovel === 'function' && (allOpen || (typeof xmasNovelPlayableAt === 'function' && xmasNovelPlayableAt(nowMs)));
  const novelEnded = !allOpen && typeof XMAS_NOVEL_CLOSE_AT !== 'undefined' && nowMs >= Date.parse(XMAS_NOVEL_CLOSE_AT);
  const select = (c) => {
    setSel(c.id);
    // 開いた印(NEW を消す)。押した話だけ
    void xmasStoryMarkSeen(c.id).then((p) => setProgress(p));
  };
  return (
    <div data-xmas-story className="space-y-3">
      {!preMain && (
        <section data-xmas-novel-entry>
          <button type="button" data-xmas-novel-open disabled={!novelOpen} onClick={() => { if (novelOpen) openXmasNovel({ force: allOpen }); }}
            className="mh-xmas-frame relative flex w-full min-h-[92px] flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#0d0d16] to-[#050508] px-4 py-3 text-center active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100">
            <span className="text-[10px] font-black tracking-[0.3em] text-slate-400">{typeof XMAS_NOVEL_GAME !== 'undefined' ? `${XMAS_NOVEL_GAME.series} ―${XMAS_NOVEL_GAME.title}―` : ''}</span>
            <span className="mh-xmas-title mt-0.5 text-[24px] font-black leading-tight" style={{ fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif" }}>事件簿を開く</span>
            <span className="mt-0.5 text-[11px] font-bold text-amber-100/90">{novelEnded ? '遊べる期間は終わりました(記録は残っています)' : typeof XMAS_NOVEL_GAME !== 'undefined' ? `副題「${XMAS_NOVEL_GAME.sub}」` : ''}</span>
          </button>
        </section>
      )}
      <XmasCastPanel no={reached} compact />
      <section>
        <XmasSectionTitle>{preMain ? 'ひとりで進める物語' : '序章を読み返す'}</XmasSectionTitle>
        <p className="mb-2 px-0.5 text-[10px] font-bold leading-relaxed text-slate-300" style={JA_LABEL_STYLE}>{jaWrap(storyNote)}</p>
        <ol data-xmas-story-list className="space-y-1.5">
          {shownChapters.map((c) => {
            const st = xmasStoryStatusOf(c, progress, nowMs, allOpen);
            const locked = st === 'locked';
            const can = !locked && st !== 'waiting';
            const prev = xmasStoryPrevOf(c);
            return (
              <li key={c.id}>
                <button type="button" data-xmas-story-chapter={c.id} data-status={st} disabled={!can} onClick={() => select(c)}
                  className="mh-xmas-card flex w-full min-h-[56px] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left active:scale-[0.99] disabled:active:scale-100">
                  <span className="mh-xmas-medal flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full leading-none" data-dim={can ? undefined : ''}>
                    {c.prologue ? <b className="text-[12px] font-black">序章</b> : <><small className="text-[10px] font-black">第</small><b className="text-[14px] font-black">{c.no}</b></>}
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* まだ開いていない話は、題も「読む/戦う」も出さない(ネタバレになるため・社長 2026-11-26) */}
                    <span className={`block truncate text-[14px] font-black ${can ? 'text-white' : 'text-slate-500'}`}>{locked ? `${c.prologue ? '序章' : `第${c.no}話`} 〜？？？〜` : c.title}</span>
                    {locked && <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-400"><Lock size={11} />{xmasEventDateLabel(c.openAt)} に開きます</span>}
                    {st === 'waiting' && <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-slate-400"><Lock size={11} />前の話を{prev && prev.type === 'fight' ? '進める' : '読む'}と選べます</span>}
                    {can && <span className="mt-1 flex items-center gap-1.5"><XmasTypeTag type={c.type} /></span>}
                  </span>
                  {!locked && st === 'waiting' && <XmasTypeTag type={c.type} dim />}
                  <span className="flex w-12 shrink-0 justify-center text-[10px] font-black">
                    {st === 'cleared' ? <span data-xmas-story-done className="flex flex-col items-center text-emerald-300"><Check size={16} />{c.type === 'fight' ? 'クリア' : '読んだ'}</span>
                      : st === 'new' ? <span className="mh-xmas-new rounded px-1.5 py-0.5 text-white">NEW</span>
                      : can ? <ChevronRight size={18} className="text-amber-200/80" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
      {chapter && (
        <div data-xmas-story-sheet={chapter.id} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 sm:items-center" onClick={() => setSel(null)}>
          <div role="dialog" aria-label={chapter.prologue ? chapter.title : `第${chapter.no}話 ${chapter.title}`} className="mh-xmas-frame w-full max-w-md rounded-2xl bg-gradient-to-b from-[#16264a] to-[#0b1530] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <span className="mh-xmas-medal flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full leading-none">{chapter.prologue ? <b className="text-[13px] font-black">序章</b> : <><small className="text-[10px] font-black">第</small><b className="text-[17px] font-black">{chapter.no}</b></>}</span>
              <div className="min-w-0">
                <div className="mb-0.5"><XmasTypeTag type={chapter.type} /></div>
                <div className="mh-xmas-title text-[18px] font-black leading-tight" style={JA_LABEL_STYLE}>{jaWrap(chapter.title)}</div>
              </div>
              <XmasHolly size={28} className="ml-auto shrink-0" />
            </div>
            {xmasStoryHasScript(chapter) ? (
              <button type="button" data-xmas-story-read onClick={() => { setSel(null); onRead && onRead(chapter); }}
                className="mb-2 flex w-full min-h-[50px] items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-200/70 bg-indigo-700 text-[14px] font-black text-white active:scale-95">
                <BookOpen size={18} />お話を読む
              </button>
            ) : (
              <div data-xmas-story-pending className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3 text-center text-[11px] font-bold text-slate-300">この話のお話は準備中です</div>
            )}
            {chapter.type === 'fight' && (
              <div data-xmas-story-ways className="mb-2 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-100" style={JA_LABEL_STYLE}>{jaWrap('好きな遊びを選んで、勝つと次の話へ進めます')}</div>
                {['battle', 'rhythm', 'card'].map((way) => {
                  const ready = fightWays.includes(way);
                  return (
                    <button type="button" key={way} data-xmas-story-way={way} disabled={!ready} onClick={() => { setSel(null); onFight && onFight(chapter, way); }}
                      className="flex w-full min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-orange-200/70 bg-orange-700 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
                      <Sword size={15} />{XMAS_STORY_WAY_LABELS[way]}で戦う{ready ? '' : '(準備中)'}
                    </button>
                  );
                })}
              </div>
            )}
            <button type="button" data-xmas-story-sheet-close onClick={() => setSel(null)}
              className="w-full min-h-[44px] rounded-xl border border-white/15 bg-slate-800 text-[12px] font-black text-slate-200 active:scale-95">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---- ボーナスタブ ----
const XmasBonusTab = () => (
  <div data-xmas-bonus className="space-y-2">
    <XmasSectionTitle>期間中のボーナス</XmasSectionTitle>
    <p className="px-0.5 text-[10px] font-bold leading-relaxed text-slate-300" style={JA_LABEL_STYLE}>{jaWrap('イベントの期間中は、どれも自動でかかります。モンヒロビートの5倍だけは 11/30(月) 0:00 からです')}</p>
    {XMAS_EVENT_BONUSES.map((b) => (
      <div key={b.id} data-xmas-bonus-item={b.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 shadow-lg shadow-black/30 ${b.tone}`}>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-200/40 bg-black/35">{b.icon()}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-black text-white" style={JA_LABEL_STYLE}>{jaWrap(b.title)}</span>
            {b.big && <b className="mh-xmas-title shrink-0 text-[20px] font-black">{b.big}</b>}
          </div>
          <p className="mt-0.5 text-[11px] font-bold leading-snug" style={JA_LABEL_STYLE}>{jaWrap(b.body)}</p>
        </div>
      </div>
    ))}
  </div>
);

// ---- ページ ----
//  tab / onTab … いまのタブ(App が持つ。バトルなどから戻ったときも同じタブに帰る)
//  raid        … RaidJackScreen へそのまま渡す物(ev・ways・onChallenge など)
//  storyVersion… 読んだ印が変わったら App が増やす(物語タブが読み直す)
//  preOpen     … 開幕(11/28 10:00)より前。序章だけ読める。レイド・ボーナスのタブは「11/28 10:00 から」と出す(台帳 r1126-014)
// バトルカードで挑めるか(スターターを受け取ったか)。カードの保存を読むだけ(書かない)。読めないときは挑ませる(カードの画面が確かめ直す)
const xmasCardStarterReady = async () => {
  if (typeof CARD_SAVE_KEYS === 'undefined' || typeof cardNormalizeStarter !== 'function') return true;
  try { return !!cardNormalizeStarter(await storeGet(CARD_SAVE_KEYS.starter, null)); } catch (e) { return true; }
};
const XmasEventScreen = ({ tab = 'story', onTab, onBack, forced = false, preOpen = false, raid = null, storyVersion = 0, fightWays = [], onReadChapter, onFightChapter }) => {
  useXmasEventCss();
  // レイドの中身を出しているか(開幕の前は「11/28 10:00 から」の札だけ)
  const raidShown = tab === 'raid' && !!raid && !preOpen;
  // 開催中(またはデバッグの強制表示)は、予告の絵の代わりに題字の帯を出す
  const posterOpen = !preOpen;
  // バトルカードで挑む前に、スターターを受け取ったかを確かめる。無い人はカードの画面が開いてすぐ閉じ、押しても何も起きないように見えていた(2026-11-26 動線の点検)
  const [notice, setNotice] = useState('');
  const cardCheckingRef = useRef(false);
  const onChallenge = (kind, tierIndex, way) => {
    if (!raid || typeof raid.onChallenge !== 'function') return;
    if (way !== 'card') { raid.onChallenge(kind, tierIndex, way); return; }
    if (cardCheckingRef.current) return;
    cardCheckingRef.current = true;
    void xmasCardStarterReady().then((ok) => {
      cardCheckingRef.current = false;
      if (ok) raid.onChallenge(kind, tierIndex, way);
      // スターターが無い人: 案内から MFバトルカードのスターター選びへ行ける(受け取ったらそのままボスに挑み、終わるとレイドへ戻る。2026-11-27 開幕前の点検 r1126-061)
      else setNotice({ text: 'バトルカードで挑むには、MFバトルカードのスターターが要ります。「MFバトルカードへ」からスターターを受け取ると、そのままボスに挑めます', go: () => raid.onChallenge(kind, tierIndex, way) });
    });
  };
  const noticeSheet = notice ? (
    <div data-xmas-event-notice className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" onClick={() => setNotice('')}>
      <div role="dialog" aria-label="お知らせ" className="mh-xmas-frame w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#16264a] to-[#0b1530] p-4 text-center" onClick={(e) => e.stopPropagation()}>
        <XmasHolly size={32} className="mx-auto mb-1" />
        <p className="mb-3 text-[13px] font-bold leading-relaxed text-amber-50" style={JA_LABEL_STYLE}>{jaWrap(typeof notice === 'string' ? notice : notice.text)}</p>
        {typeof notice === 'object' && typeof notice.go === 'function' && <button type="button" data-xmas-event-notice-go onClick={() => { const go = notice.go; setNotice(''); go(); }}
          className="mb-2 w-full min-h-[44px] rounded-xl border border-sky-300/70 bg-sky-800 text-[13px] font-black text-white active:scale-95">MFバトルカードへ</button>}
        <button type="button" data-xmas-event-notice-close onClick={() => setNotice('')}
          className="w-full min-h-[44px] rounded-xl border border-white/15 bg-slate-800 text-[13px] font-black text-slate-100 active:scale-95">閉じる</button>
      </div>
    </div>
  ) : null;
  const head = (
    <div data-xmas-event-head className={`mx-auto w-full shrink-0 ${raidShown ? '' : 'max-w-2xl'}`}>
      <ScreenHead title={<span className="flex items-center gap-1"><XmasHolly size={24} /><span className="mh-xmas-title whitespace-nowrap">聖夜の名探偵</span></span>}
        onBack={onBack} compact note={forced ? '(デバッグ表示・開始前でも見えます)' : ''} />
      {/* レイドの中身を出すときは小さく。背の低い横画面では、レイドの一覧が見えるように出さない(題と期間とタブだけ) */}
      <div data-xmas-event-poster className={`mh-xmas-frame mx-auto mb-2 w-fit max-w-full overflow-hidden rounded-xl bg-slate-950 ${raidShown ? '[@media(orientation:landscape)_and_(max-height:520px)]:hidden' : ''}`}>
        {posterOpen ? (
          // 開催中: 「開催予告」の文字とボスの影が入った予告の絵は出さず、ペンションの雪景色に題字を重ねた帯にする(本番用の絵が届いたら XMAS_EVENT_POSTER_OPEN_IMG に差し替える)
          <div data-xmas-event-title-band className="relative overflow-hidden" style={{ width: raidShown ? 'min(100vw - 32px, 26vh)' : 'min(100vw - 32px, 48vh)', aspectRatio: '2 / 1' }}>
            <img src={XMAS_EVENT_POSTER_OPEN_IMG || XMAS_EVENT_TITLE_BAND_BG} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 40%' }} />
            {!XMAS_EVENT_POSTER_OPEN_IMG && (
              <span className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: 'radial-gradient(80% 70% at 50% 55%, #0b1733cc 0%, #0b173388 55%, transparent 100%)' }}>
                <span className={`font-black text-amber-100 ${raidShown ? 'text-[8px]' : 'text-[11px]'}`} style={{ letterSpacing: '.2em', textShadow: '0 1px 3px #000' }}>クリスマスイベント</span>
                <b className={`mh-xmas-title whitespace-nowrap leading-tight ${raidShown ? 'text-[20px]' : 'text-[38px]'}`} style={{ fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif", filter: 'drop-shadow(0 2px 2px #000) drop-shadow(0 0 6px #000a)' }}>聖夜の名探偵</b>
                <span className={`font-bold text-amber-50 ${raidShown ? 'text-[7px]' : 'text-[11px]'}`} style={{ textShadow: '0 1px 3px #000' }}>～十三番目の鐘が鳴る夜～</span>
              </span>
            )}
          </div>
        ) : <img src={XMAS_EVENT_POSTER_IMG} alt="クリスマスイベント 聖夜の名探偵" className={`block h-auto w-auto max-w-full ${raidShown ? 'max-h-[13vh]' : 'max-h-[24vh]'}`} />}
      </div>
      <div data-xmas-event-period className="mh-xmas-ribbon mx-auto mb-2 max-w-md px-5 py-1 text-center text-[11px] font-black text-amber-50">
        開催期間 {xmasEventPeriodText()}
      </div>
      <ScreenTabs items={XMAS_EVENT_TABS} value={tab} onChange={(id) => onTab && onTab(id)} />
    </div>
  );
  if (raidShown) return <><RaidJackScreen key="raid-xmas" {...raid} onChallenge={onChallenge} head={head} shellClass="mh-xmas-shell" />{noticeSheet}</>;
  return (
    <div className={`${SCREEN_SHELL_CLASS} mh-xmas-shell overflow-hidden [@media(orientation:landscape)_and_(max-height:520px)]:overflow-y-auto mh-scroll`} data-xmas-event={tab}>
      {head}
      <div className={`${SCREEN_LIST_CLASS} [@media(orientation:landscape)_and_(max-height:520px)]:flex-none [@media(orientation:landscape)_and_(max-height:520px)]:overflow-visible`}>
        <div className="mx-auto w-full max-w-2xl pb-2">
          {preOpen && tab !== 'story' ? (
            <div data-xmas-event-preopen={tab} className="mh-xmas-frame mt-2 rounded-2xl bg-[#0a1430]/95 px-4 py-6 text-center">
              <XmasHolly size={40} className="mx-auto mb-2" />
              <div className="mh-xmas-title text-[18px] font-black">{xmasEventDateLabel(RAID_XMAS_EVENT.startAt)} から</div>
              <p className="mt-2 text-[12px] font-bold leading-relaxed text-slate-200" style={JA_LABEL_STYLE}>{jaWrap(tab === 'raid' ? 'レイドはイベントの開幕と同時に始まります。いまは「物語」の序章が読めます' : '期間中のボーナスは、イベントの開幕と同時にかかります(モンヒロビートの5倍は 11/30(月) 0:00 から)')}</p>
            </div>
          ) : tab === 'bonus' ? <XmasBonusTab />
            : <XmasStoryTab version={storyVersion} allOpen={forced} fightWays={fightWays} onRead={onReadChapter} onFight={onFightChapter} />}
        </div>
      </div>
    </div>
  );
};

// ---- HOME の入口(台帳 r1126-014・社長「目立つように作ったほうがいい」) ----
//  ひと目でクリスマスのイベントと分かる札。ポスターの絵を切り抜き、金の縁・柊・ゆっくり光るきらめきを付ける。
//  形は「上の大きな帯」(社長の選択 2026-11-26・案A)。細バナーの場所に置き、右の丸ボタンの列にはかからない幅にする。
//  背の低い横画面では、ボスの頭にかからないよう、右の丸ボタンの列の左の空きへ小さく置く
//  出すのは 11/28 10:00(序章が開く)から 12/31 4:00 まで。11/28 10:00 までは「序章公開中」と出す
// イベントページを開けるか: 序章が開く時刻から、イベントの終わりまで
const xmasEventPageOpenAt = (nowMs) => {
  const at = Date.parse(XMAS_STORY_PROLOGUE_OPEN_AT);
  return Number.isFinite(nowMs) && nowMs >= at && raidXmasWindowAt(nowMs) !== 'after';
};
const XMAS_HOME_ENTRY_CSS = `
.mh-xmas-entry { position: relative; display: block; overflow: hidden; padding: 0; border: 2px solid #f0c96c; border-radius: 12px; background: #0b1733;
  box-shadow: 0 0 0 2px #6b1218, 0 0 14px #f0c96c66, 0 4px 10px #000a; color: #fff; text-align: left; touch-action: manipulation; transition: transform .1s, filter .1s; }
.mh-xmas-entry:active { transform: scale(.96); filter: brightness(1.2); }
.mh-xmas-entry img.mh-xmas-entry-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.mh-xmas-entry::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(105deg, transparent 35%, #fff6 48%, transparent 60%);
  transform: translateX(-120%); animation: mh-xmas-entry-shine 4.5s ease-in-out 1s infinite; }
@keyframes mh-xmas-entry-shine { 0%, 70% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
.mh-xmas-entry-spark { position: absolute; width: 8px; height: 8px; pointer-events: none; background: radial-gradient(circle, #fff 0 18%, #fde68a 30%, transparent 62%);
  clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); animation: mh-xmas-entry-twinkle 2.4s ease-in-out infinite; }
@keyframes mh-xmas-entry-twinkle { 0%, 100% { opacity: .15; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.15); } }
.mh-xmas-entry-title { font-weight: 900; letter-spacing: .04em; background: linear-gradient(180deg, #fff8dc 0%, #f6d37a 55%, #d39a3e 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 1px 0 #5c1414) drop-shadow(0 0 4px #000c); }
.mh-xmas-entry-sub { display: inline-block; border-radius: 999px; background: #a51c24; border: 1px solid #f0c96c; color: #fff7d6; font-weight: 900; white-space: nowrap; }
@media (prefers-reduced-motion: reduce) { .mh-xmas-entry::after, .mh-xmas-entry-spark { animation: none; } }
/* 背の低い横画面: 帯は右の丸ボタンの列の左の空きへ小さく置く(ボスの頭・みゅあの吹き出し・施設の札にかけない) */
@media (orientation: landscape) and (max-height: 520px) {
  [data-home-xmas-entry-strip] { position: absolute !important; left: auto !important; right: 112px; top: calc(62px + env(safe-area-inset-top)); width: 176px !important; margin: 0 !important; }
  .mh-xmas-entry[data-home-xmas-entry="banner"] { height: 54px !important; }
  .mh-xmas-entry[data-home-xmas-entry="banner"] [data-xmas-entry-kicker] { display: none; }
  .mh-xmas-entry[data-home-xmas-entry="banner"] .mh-xmas-entry-title { font-size: 16px; }
  .mh-xmas-entry[data-home-xmas-entry="banner"] .mh-xmas-entry-sub { font-size: 9px; padding: 0 6px; }
  /* ほかのイベントの細い帯(11/29 までのハナウタ・ノートなど)が上に並ぶときは、その帯の下へずらす(題が帯に隠れて切れていた・2026-11-26 動線の点検) */
  [data-home-xmas-entry-strip]:has(~ [data-home-event-strip]) { top: calc(102px + env(safe-area-inset-top)); }
}
`;
const HomeXmasEventEntry = ({ onOpen, preOpen = false }) => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-xmas-home-entry-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-xmas-home-entry-css'; tag.textContent = XMAS_HOME_ENTRY_CSS; document.head.appendChild(tag);
  }, []);
  const sub = preOpen ? `序章公開中・${xmasEventDateLabel(RAID_XMAS_EVENT.startAt).replace(/\(.\)/, '')} 開幕` : '開催中 〜12/31 3:59';
  const sparks = [[8, 18, 0], [62, 12, .8], [88, 64, 1.6], [30, 78, 1.2]];
  const label = `クリスマスイベント 聖夜の名探偵 ${sub}`;
  return (
    <button type="button" data-home-xmas-entry="banner" className="mh-xmas-entry w-full" onClick={onOpen} aria-label={label} style={{ height: 80 }}>
      {/* 告知用ポスター(台帳 r1126-057)の題字は上にあるので、題字の下(時計・人物・黒いサンタの影)を切り抜く。入口の文字と題字が重ならないように */}
      <img className="mh-xmas-entry-art" src={XMAS_EVENT_POSTER_IMG} alt="" style={{ objectPosition: '70% 50%' }} />
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #0b1733f2 0%, #0b1733cc 42%, transparent 72%)' }} />
      <XmasHolly size={24} className="absolute -left-1 -top-1" />
      {sparks.map(([x, y, d], i) => <span key={i} aria-hidden="true" className="mh-xmas-entry-spark" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}
      <span style={{ position: 'absolute', left: 14, top: 6, right: 8, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span data-xmas-entry-kicker className="block text-[10px] font-black text-amber-100" style={{ textShadow: '0 1px 2px #000' }}>クリスマスイベント</span>
        <b className="mh-xmas-entry-title block whitespace-nowrap text-[22px] leading-none">聖夜の名探偵</b>
        {/* 日付と時刻のあいだの空白は小さい字だと潰れて「12/313:59」と読めた(#7857 点検の3)。改行されない空白に字の幅の間を足す */}
        <span className="mh-xmas-entry-sub px-2 py-px text-[10px]">{preOpen ? sub : <>開催中 〜12/31<span style={{ marginLeft: '.3em' }}>{'\u00a0'}</span>3:59</>}</span>
      </span>
    </button>
  );
};
