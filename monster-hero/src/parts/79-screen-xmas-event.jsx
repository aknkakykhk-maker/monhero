// ===== クリスマスイベント「聖夜の名探偵」のイベントページ(台帳 r1126-006・社長 2026-11-26「この形で作る」) =====
// 上: 題・戻る・横長のポスター・開催期間の帯 / タブ: 物語・レイド・ボーナス
//  ・物語: 登場人物パネル(はじめてだれかがいなくなった話を読んでから)と話の一覧。話は選んで読む(自動では流さない)
//  ・レイド: クリスマスのレイド画面(79-screen-raid-jack.jsx の RaidJackScreen)をそのまま入れる。上の題・ポスター・タブは head で渡す
//  ・ボーナス: 期間中のボーナスの一覧(絵文字は使わずアイコン)
// 入口は App の openRaidXmas(HOME のイベントの札・デバッグ)。開始時刻まで(RELEASE_FLAGS.raidXmas が偽)は出さない。
// gameState はレイドと同じ 'RAID_JACK'(バトル・ビート・カードから戻るときに setGameState('RAID_JACK') でここへ帰る)。

// ポスター(いまは「開催予告」の絵の仮。帯の無い本番用の絵が来たら、この1行のファイルだけ差し替える)
const XMAS_EVENT_POSTER_IMG = 'images/events/xmas-2026-event-wide.jpg';

const XMAS_EVENT_TABS = Object.freeze([
  { id: 'story', label: '物語', color: '#b91c1c' },
  { id: 'raid', label: 'レイド', color: '#1d4ed8' },
  { id: 'bonus', label: 'ボーナス', color: '#047857' },
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
    title: 'モンヒロビート', big: '5倍', body: 'もらえるビートPと、クイックの∞周回を回しながら遊ぶと入る周回数が5倍になります' },
  { id: 'card', icon: () => <Layers size={22} />, tone: 'border-sky-300/50 bg-sky-950/40 text-sky-100',
    title: 'MFバトルカード', big: '1.5倍', body: '対戦のごほうび(ビートP・カードランクの経験値・クイック周回)が1.5倍になります' },
  { id: 'battle', icon: () => <Sword size={22} />, tone: 'border-orange-300/50 bg-orange-950/40 text-orange-100',
    title: 'モンヒロバトル', big: '1.5倍', body: 'バトルでもらえる経験値とダイヤが1.5倍になります' },
  { id: 'costume', icon: () => <XmasEventIcon name="shirt" />, tone: 'border-rose-300/50 bg-rose-950/40 text-rose-100',
    title: '助手のクリスマスきせかえ', big: '', body: '助手のサンタ姿のきせかえが登場します' },
  { id: 'art', icon: () => <XmasEventIcon name="picture" />, tone: 'border-emerald-300/50 bg-emerald-950/40 text-emerald-100',
    title: 'ホーム・タイトルのクリスマスの絵', big: '', body: 'ホームとタイトルがクリスマスの絵になります(設定の「ホーム画面アレンジ」で選べます)' },
]);

// ---- 登場人物パネル(推理ドラマの登場人物パネル風・台帳 r1125-063) ----
//  no: 読み終えた話の番号。はじめてだれかがいなくなる話より前は何も出さない(社長 2026-11-26)
//  いなくなった人は白黒+「ゆくえ不明」のはんこ。帯に「のこった人 ◯人 / 空になった箱 ◯つ」(10人みんなを数える)
//  animate: その話でいなくなった人だけ、色が抜けてはんこが押される動き(お話の終わりで使う。一覧では動かさない)
const XMAS_CAST_CSS = `
@keyframes mh-xmas-cast-fade { from { filter: none; } to { filter: grayscale(1) brightness(.7); } }
@keyframes mh-xmas-cast-stamp { 0% { opacity: 0; transform: rotate(-14deg) scale(2.2); } 60% { opacity: 1; transform: rotate(-14deg) scale(.92); } 100% { opacity: 1; transform: rotate(-14deg) scale(1); } }
[data-xmas-cast-face][data-away] img { filter: grayscale(1) brightness(.7); }
[data-xmas-cast-face][data-away][data-newly] img { animation: mh-xmas-cast-fade 1.2s ease-out both; }
[data-xmas-cast-stamp] { transform: rotate(-14deg); }
[data-xmas-cast-face][data-newly] [data-xmas-cast-stamp] { animation: mh-xmas-cast-stamp .5s 1.1s ease-out both; }
@media (prefers-reduced-motion: reduce) { [data-xmas-cast-face] img, [data-xmas-cast-stamp] { animation: none !important; } }
`;
const XmasCastPanel = ({ no, animate = false, compact = false }) => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-xmas-cast-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-xmas-cast-css'; tag.textContent = XMAS_CAST_CSS; document.head.appendChild(tag);
  }, []);
  const at = xmasStoryCastAt(no);
  if (!at.shown) return null;
  return (
    <section data-xmas-cast-panel={no} aria-label="登場人物" className="rounded-2xl border border-amber-200/30 bg-slate-950/80 p-2">
      <div className="grid grid-cols-5 gap-1.5">
        {XMAS_STORY_CAST.map((c) => {
          const away = at.missing.includes(c.id);
          const newly = animate && at.newly.includes(c.id);
          return (
            <div key={c.id} data-xmas-cast-face={c.id} data-away={away ? '' : undefined} data-newly={newly ? '' : undefined} className="min-w-0 text-center">
              <div className={`relative mx-auto aspect-square w-full overflow-hidden rounded-md border ${away ? 'border-slate-600 bg-slate-800' : 'border-amber-200/50 bg-slate-700'} ${compact ? 'max-w-[46px]' : 'max-w-[64px]'}`}>
                <img src={c.face} alt="" className="h-full w-full object-cover object-top" />
                {away && (
                  <span data-xmas-cast-stamp aria-label="ゆくえ不明" className="absolute inset-0 m-auto flex h-max w-max flex-col items-center rounded border-2 border-rose-500 bg-white/80 px-0.5 text-[10px] font-black leading-none text-rose-600"><span className="py-px">ゆくえ</span><span className="py-px">不明</span></span>
                )}
              </div>
              <div className={`mt-0.5 truncate text-[10px] font-black ${away ? 'text-slate-500' : 'text-slate-100'}`}>{c.name}</div>
            </div>
          );
        })}
      </div>
      <div data-xmas-cast-band className="mt-1.5 rounded-lg bg-black/50 py-1 text-center text-[11px] font-black text-amber-100">
        のこった人 <b className="text-white">{at.left}</b>人 / 空になった箱 <b className="text-white">{at.emptyBoxes}</b>つ
      </div>
    </section>
  );
};

// ---- 物語タブ ----
const xmasStoryHasScript = (chapter) => typeof EVENT_REPLAYS !== 'undefined' && Array.isArray(EVENT_REPLAYS)
  && EVENT_REPLAYS.some((e) => e && e.id === chapter.scriptId);
const XMAS_STORY_WAY_LABELS = Object.freeze({ battle: 'モンヒロバトル', rhythm: 'モンヒロビート', card: 'MFバトルカード' });

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
  const select = (c) => {
    setSel(c.id);
    // 開いた印(NEW を消す)。押した話だけ
    void xmasStoryMarkSeen(c.id).then((p) => setProgress(p));
  };
  return (
    <div data-xmas-story className="space-y-2">
      <XmasCastPanel no={reached} compact />
      <ol data-xmas-story-list className="space-y-1.5">
        {XMAS_STORY_CHAPTERS.map((c) => {
          const st = xmasStoryStatusOf(c, progress, nowMs, allOpen);
          const can = st !== 'locked' && st !== 'waiting';
          return (
            <li key={c.id}>
              <button type="button" data-xmas-story-chapter={c.id} data-status={st} disabled={!can} onClick={() => select(c)}
                className={`flex w-full min-h-[52px] items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left active:scale-[0.99] disabled:active:scale-100 ${can ? 'border-amber-200/30 bg-slate-900/80' : 'border-white/5 bg-slate-950/60'}`}>
                <span className={`w-12 shrink-0 text-[11px] font-black ${can ? 'text-amber-200' : 'text-slate-500'}`}>第{c.no}話</span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13px] font-black ${can ? 'text-white' : 'text-slate-500'}`}>{st === 'locked' ? '？？？' : c.title}</span>
                  {st === 'locked' && <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Lock size={11} />{xmasEventDateLabel(c.openAt)} に開きます</span>}
                  {st === 'waiting' && <span className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Lock size={11} />前の話を{XMAS_STORY_CHAPTERS[c.no - 2] && XMAS_STORY_CHAPTERS[c.no - 2].type === 'fight' ? '進める' : '読む'}と選べます</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${c.type === 'fight' ? 'bg-orange-700 text-white' : 'bg-indigo-700 text-white'} ${can ? '' : 'opacity-40'}`}>{c.type === 'fight' ? '戦う' : '読む'}</span>
                <span className="w-11 shrink-0 text-center text-[10px] font-black">
                  {st === 'cleared' ? <span className="text-emerald-300">{c.type === 'fight' ? 'クリア' : '読んだ'}</span>
                    : st === 'new' ? <span className="rounded bg-rose-600 px-1 py-0.5 text-white">NEW</span> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {chapter && (
        <div data-xmas-story-sheet={chapter.id} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setSel(null)}>
          <div role="dialog" aria-label={`第${chapter.no}話 ${chapter.title}`} className="w-full max-w-md rounded-2xl border-2 border-amber-200/40 bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-black text-amber-200">第{chapter.no}話・{chapter.type === 'fight' ? '戦う' : '読む'}</div>
            <div className="mb-3 text-[17px] font-black text-white">{chapter.title}</div>
            {xmasStoryHasScript(chapter) ? (
              <button type="button" data-xmas-story-read onClick={() => { setSel(null); onRead && onRead(chapter); }}
                className="mb-2 flex w-full min-h-[48px] items-center justify-center gap-1.5 rounded-xl border-2 border-indigo-300/60 bg-indigo-700 text-[14px] font-black text-white active:scale-95">
                <BookOpen size={18} />お話を読む
              </button>
            ) : (
              <div data-xmas-story-pending className="mb-2 rounded-xl border border-white/10 bg-black/30 p-3 text-center text-[11px] font-bold text-slate-300">この話のお話は準備中です</div>
            )}
            {chapter.type === 'fight' && (
              <div data-xmas-story-ways className="mb-2 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-300">好きな遊びを選んで、勝つと次の話へ進めます</div>
                {['battle', 'rhythm', 'card'].map((way) => {
                  const ready = fightWays.includes(way);
                  return (
                    <button type="button" key={way} data-xmas-story-way={way} disabled={!ready} onClick={() => { setSel(null); onFight && onFight(chapter, way); }}
                      className="flex w-full min-h-[44px] items-center justify-center rounded-xl border-2 border-orange-300/60 bg-orange-700 text-[13px] font-black text-white active:scale-95 disabled:border-white/10 disabled:bg-slate-800 disabled:text-slate-400">
                      {XMAS_STORY_WAY_LABELS[way]}で戦う{ready ? '' : '(準備中)'}
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
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-bold leading-relaxed text-slate-200">イベントの期間中は、どれも自動でかかります</div>
    {XMAS_EVENT_BONUSES.map((b) => (
      <div key={b.id} data-xmas-bonus-item={b.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${b.tone}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/30">{b.icon()}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-black text-white" style={JA_LABEL_STYLE}>{jaWrap(b.title)}</span>
            {b.big && <b className="shrink-0 text-[18px] font-black text-amber-200">{b.big}</b>}
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
const XmasEventScreen = ({ tab = 'story', onTab, onBack, forced = false, raid = null, storyVersion = 0, fightWays = [], onReadChapter, onFightChapter }) => {
  const head = (
    <div data-xmas-event-head className="shrink-0">
      <ScreenHead title="聖夜の名探偵" accent="text-amber-100" onBack={onBack} compact note={forced ? '(デバッグ表示・開始前でも見えます)' : ''} />
      <div data-xmas-event-poster className="mx-auto mb-1.5 w-fit max-w-full overflow-hidden rounded-2xl border border-amber-300/40 bg-slate-950">
        <img src={XMAS_EVENT_POSTER_IMG} alt="クリスマスイベント 聖夜の名探偵" className={`block h-auto w-auto max-w-full ${tab === 'raid' ? 'max-h-[13vh]' : 'max-h-[24vh]'}`} />
      </div>
      <div data-xmas-event-period className="mb-2 rounded-lg border border-amber-300/40 bg-red-950/70 px-2 py-1 text-center text-[11px] font-black text-amber-100">
        開催期間 {xmasEventPeriodText()}
      </div>
      <ScreenTabs items={XMAS_EVENT_TABS} value={tab} onChange={(id) => onTab && onTab(id)} />
    </div>
  );
  if (tab === 'raid' && raid) return <RaidJackScreen key="raid-xmas" {...raid} head={head} />;
  return (
    <div className={`${SCREEN_SHELL_CLASS} overflow-hidden [@media(orientation:landscape)_and_(max-height:520px)]:overflow-y-auto mh-scroll`} data-xmas-event={tab}>
      {head}
      <div className={`${SCREEN_LIST_CLASS} [@media(orientation:landscape)_and_(max-height:520px)]:flex-none [@media(orientation:landscape)_and_(max-height:520px)]:overflow-visible`}>
        {tab === 'bonus' ? <XmasBonusTab />
          : <XmasStoryTab version={storyVersion} allOpen={forced} fightWays={fightWays} onRead={onReadChapter} onFight={onFightChapter} />}
      </div>
    </div>
  );
};
