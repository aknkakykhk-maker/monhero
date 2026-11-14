// ==== 「ホーム画面に追加」の案内(2026-11-11 社長の選択 B・窓口経由・アプリカ) ====
// 社長「ブラウザだからかたまに画面の挙動がおかしい。ホームに追加しても、それでもブラウザのような挙動がある気がする」
// → ホーム画面のアプリでは左端スワイプの戻るを出さなくした(#5455)。Safari で遊んでいる人には、ホーム画面に追加する案内を出す。
// 決まり(窓口):
//   ・iPhone の Safari で遊んでいる人だけに出す(ホーム画面のアプリ・Android・パソコンには出さない)
//   ・2026-11-12 社長の選択: X・LINE などのアプリ内ブラウザの人にも、先に「ブラウザ(Safari)で開く」案内を出す(手順の絵つき・回数の決まりは同じ)
//   ・iPhone はホーム画面のアプリと Safari で保存データが別になる。追加の手順の前に「先に Safari 側でバックアップ → 追加したアプリで戻す」を出す
//   ・しつこくしない。自動で出すのは HOME で、出したら14日は出さない・3回出したらもう自動では出さない・「もう表示しない」で二度と出さない
//     (新しいキー mh_home_screen_guide_v1 で覚える。既存のキーは触らない)。設定の「📲 ホーム画面に追加」からはいつでも開ける
//   ・ヘルプ(データ引き継ぎの次の「ホーム画面に追加」)にも同じ手順を載せる
const MH_HOME_SCREEN_GUIDE_KEY = 'mh_home_screen_guide_v1';
const MH_HOME_SCREEN_GUIDE_GAP_MS = 14 * 24 * 60 * 60 * 1000;   // 自動で出したあと、次に出すまで
const MH_HOME_SCREEN_GUIDE_MAX_AUTO = 3;                         // 自動で出すのはここまで
const MH_HOME_SCREEN_GUIDE_FIRST_WAIT_MS = 60 * 60 * 1000;       // はじめて HOME に来てから1時間は出さない(最初の30分の案内とぶつけない)

// iPhone の Safari(ホーム画面のアプリではない)か。Chrome・Firefox・Edge などの iPhone 版と、LINE・X・Instagram などのアプリ内ブラウザは除く
// (アプリ内ブラウザからはホーム画面に追加できない。ほかのブラウザは手順が違う)
function mhIsIphoneSafariBrowser(ua) {
  try {
    if (typeof window === 'undefined' || !window.navigator) return false;
    if (typeof mhIsIosHomeScreenApp === 'function' && mhIsIosHomeScreenApp()) return false;
    const text = String(ua == null ? window.navigator.userAgent || '' : ua);
    if (!/iPhone|iPod/.test(text)) return false;
    if (!/Safari\//.test(text) || !/Version\//.test(text)) return false;
    if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|YJApp|DuckDuckGo|Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK/i.test(text)) return false;
    return true;
  } catch (_) { return false; }
}

// iPhone のアプリ内ブラウザ(X・LINE・Instagram など)か(2026-11-12 社長の選択「案内とヘルプに入れる」)。
// アプリ内ブラウザからはホーム画面に追加できないので、「ブラウザ(Safari)で開く」案内を出す。
// 目印のあるアプリに加えて、Safari の目印(Safari/ と Version/)が無い iPhone の画面もアプリ内ブラウザとみなす(X は目印を付けないことがある)。
// Chrome・Firefox・Edge などの iPhone 版のブラウザは手順が違うので出さない
function mhIsIphoneInAppBrowser(ua) {
  try {
    if (typeof window === 'undefined' || !window.navigator) return false;
    if (typeof mhIsIosHomeScreenApp === 'function' && mhIsIosHomeScreenApp()) return false;
    const text = String(ua == null ? window.navigator.userAgent || '' : ua);
    if (!/iPhone|iPod/.test(text)) return false;
    if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo/i.test(text)) return false;
    if (/Line\/|FBAN|FBAV|Instagram|Twitter|MicroMessenger|KAKAOTALK|GSA\/|YJApp/i.test(text)) return true;
    return !(/Safari\//.test(text) && /Version\//.test(text));
  } catch (_) { return false; }
}
// 案内の形: 'safari'(Safari からホーム画面に追加)/ 'inapp'(先にブラウザで開く)/ null(出さない)
function mhHomeScreenGuideMode(ua) {
  if (mhIsIphoneSafariBrowser(ua)) return 'safari';
  if (mhIsIphoneInAppBrowser(ua)) return 'inapp';
  return null;
}
// 手順の絵(社長から受け取った絵を手順の枠ごとに切り分けたもの。よその会社のアイコンは消してある。元は tools/art-sources/home-screen-guide/)
const MH_HOME_SCREEN_HOWTO_STEPS_IMAGE = 'images/guide/home-screen-howto-steps.jpg';
const MH_HOME_SCREEN_HOWTO_ADD_IMAGE = 'images/guide/home-screen-howto-add.jpg';
// 戻すときの文(案内とヘルプで同じ。頭の「遊び始める前に、タイトルの設定から」は社長の選択・Fable の留意2)
const MH_HOME_SCREEN_RESTORE_TEXT = '遊び始める前に、タイトルの設定から戻します。ホーム画面のアイコンから開き、タイトル画面の「設定」→「データ引き継ぎ」→「復元」で、保存したファイル(またはコピーしたコード)を読み込みます。';

// 保存値の読み書き。壊れていても既定値で動く(CLAUDE.md ⑦)
function normalizeHomeScreenGuideState(value) {
  const src = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return {
    firstSeenAt: num(src.firstSeenAt),
    lastShownAt: num(src.lastShownAt),
    autoCount: Math.min(99, Math.floor(num(src.autoCount))),
    never: src.never === true,
  };
}
function readHomeScreenGuideState() {
  try { return normalizeHomeScreenGuideState(JSON.parse(window.localStorage.getItem(MH_HOME_SCREEN_GUIDE_KEY) || 'null')); }
  catch (_) { return normalizeHomeScreenGuideState(null); }
}
function writeHomeScreenGuideState(next) {
  try { window.localStorage.setItem(MH_HOME_SCREEN_GUIDE_KEY, JSON.stringify(normalizeHomeScreenGuideState(next))); } catch (_) { /* 書けなくても遊べる */ }
}
// いま自動で出してよいか(時刻を渡して決める。読み込み時に1回だけ決めない)
function homeScreenGuideAutoDue(state, now) {
  const s = normalizeHomeScreenGuideState(state);
  if (s.never || s.autoCount >= MH_HOME_SCREEN_GUIDE_MAX_AUTO) return false;
  if (!s.firstSeenAt || now - s.firstSeenAt < MH_HOME_SCREEN_GUIDE_FIRST_WAIT_MS) return false;
  if (s.lastShownAt && now - s.lastShownAt < MH_HOME_SCREEN_GUIDE_GAP_MS) return false;
  return true;
}

// 案内の窓。データ引き継ぎの窓(zIndex 90000)がこの上に開くので、戻ってくると手順の続きが見える
// mode: 'safari'(Safari で遊んでいる人)/ 'inapp'(X・LINE などのアプリ内ブラウザの人)。渡さなければ端末から決める
function HomeScreenGuideSheet({ onClose, onNever = null, onOpenBackup, mode = null }) {
  const kind = mode || mhHomeScreenGuideMode() || 'safari';
  const inApp = kind === 'inapp';
  // 言葉の途中で折らない(ヘルプと同じ折り方)。文字列でないもの(ボタン・絵の入った本文)はそのまま
  const w = (x) => (typeof x === 'string' && typeof jaWrap === 'function'
    ? <span style={typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : undefined}>{jaWrap(x)}</span> : x);
  const step = (no, title, body) => (
    <li data-home-screen-guide-step={no} className="flex gap-2.5 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-left">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[12px] font-black text-slate-950">{no}</span>
      <div className="min-w-0">
        <div className="text-[12px] font-black leading-snug text-white">{w(title)}</div>
        <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">{w(body)}</div>
      </div>
    </li>
  );
  // アプリ内ブラウザ(X・LINE など)はファイルを保存できない・保存先が分からないことが多いので、コードを先に書く(ミハリ4)
  const backupText = inApp
    ? ['「データ引き継ぎ」の「バックアップコードを作成」→「コードをコピー」で控え、メモなどに貼って残します。', '(「バックアップファイルを保存(.mhsave)」でも作れます)']
    : ['「データ引き継ぎ」の「バックアップファイルを保存(.mhsave)」を押し、「ファイルに保存」を選びます。', '(「バックアップコードを作成」→「コードをコピー」でも作れます)'];
  const backupBody = <>{w(backupText[0])}<br/>{w(backupText[1])}<button type="button" data-home-screen-guide-backup onClick={onOpenBackup} className="mt-2 block min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-[12px] font-black text-white active:scale-95">💾 データ引き継ぎを開く</button></>;
  const addBody = 'Safari の下にある共有ボタン(四角から上向きの矢印)を押し、「ホーム画面に追加」→ 右上の「追加」。';
  return (
    <div data-home-screen-guide={kind} role="dialog" aria-modal="true" aria-label="ホーム画面に追加"
      className="fixed inset-0 flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 85000, backgroundColor: 'rgba(0,0,0,0.82)' }}>
      <div className="w-full max-w-sm max-h-full overflow-y-auto mh-scroll rounded-3xl border border-amber-300/60 bg-slate-900 p-4 shadow-2xl">
        <div className="mh-dialog-head flex items-start justify-between gap-2">
          <h3 className="text-[16px] font-black leading-snug text-white">{w(inApp ? '📲 Safari で開いて、ホーム画面に追加しよう' : '📲 ホーム画面に追加して遊ぼう')}</h3>
          <button type="button" aria-label="閉じる" onClick={onClose} className="min-h-[44px] min-w-[44px] shrink-0 rounded-full text-[18px] font-black text-slate-300 active:scale-95">✕</button>
        </div>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">{w(inApp
          ? 'いまは X や LINE などのアプリの中で開いています。Safari で開いてホーム画面に追加すると、アプリのように画面が広くなり、ブラウザの操作が出なくなります。'
          : 'アプリのように画面が広くなり、ブラウザの操作(画面の左端をなぞると戻る、など)が出なくなります。')}</p>
        <div data-home-screen-guide-warning className="mt-3 rounded-2xl border border-red-300/70 bg-red-950/60 p-3 text-left">
          <div className="text-[12px] font-black text-red-200">{w(inApp ? '⚠ 開き直す前に、必ずバックアップを作ってください' : '⚠ 追加する前に、必ずバックアップを作ってください')}</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-red-100/90">{w(inApp
            ? 'アプリの中の画面と、Safari・ホーム画面のアプリでは、保存データが別々です。そのまま開き直すと、初めからになります。'
            : 'iPhone では、ホーム画面のアプリと Safari で保存データが別々です。そのまま追加すると、アプリのほうは 初めからになります。')}</div>
        </div>
        {inApp && <img data-home-screen-guide-image="steps" src={MH_HOME_SCREEN_HOWTO_STEPS_IMAGE} alt="ホーム画面に追加する方法(リンクを押す → ブラウザで開く → ホーム画面に追加)" loading="lazy" className="mt-3 block w-full rounded-2xl"/>}
        <ol className="mt-3 space-y-2">
          {inApp ? <>
            {step(1, 'いまの画面でバックアップを作る', backupBody)}
            {step(2, 'ブラウザ(Safari)で開く', 'アプリの画面の「⋮」や共有のボタンから「ブラウザで開く」(または「Safari で開く」)を選びます。X なら、画面の下の「github.io」の右にある「⋮」から選べます(絵の③)。')}
            {step(3, 'ホーム画面に追加する', addBody + '(絵の④)')}
            {step(4, '追加したアイコンから開いて、データを戻す', MH_HOME_SCREEN_RESTORE_TEXT)}
          </> : <>
            {step(1, 'いまの Safari でバックアップを作る', backupBody)}
            {step(2, 'ホーム画面に追加する', <>{addBody}<img data-home-screen-guide-image="add" src={MH_HOME_SCREEN_HOWTO_ADD_IMAGE} alt="共有ボタンから「ホーム画面に追加」を選ぶ" loading="lazy" className="mx-auto mt-2 block w-full max-w-[220px] rounded-xl"/></>)}
            {step(3, '追加したアイコンから開いて、データを戻す', MH_HOME_SCREEN_RESTORE_TEXT)}
          </>}
        </ol>
        <p className="mt-3 text-[10px] font-bold leading-relaxed text-slate-400">{w(inApp
          ? '戻したあとは、ホーム画面のアイコンから遊んでください。アプリの中の画面とホーム画面のアプリの両方で遊ぶと、進み方が別々になります。'
          : '戻したあとは、ホーム画面のアイコンから遊んでください。Safari とアプリの両方で遊ぶと、進み方が別々になります。')}</p>
        <div className="mt-3 flex gap-2">
          {onNever && <button type="button" data-home-screen-guide-never onClick={onNever} className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-slate-800 px-2 text-[11px] font-black text-slate-300 active:scale-95">もう表示しない</button>}
          <button type="button" data-home-screen-guide-close onClick={onClose} className="mh-button min-h-[44px] flex-1 rounded-xl bg-amber-400 px-2 text-[12px] font-black text-slate-950 active:scale-95">閉じる</button>
        </div>
      </div>
    </div>
  );
}

// HOME に置く。iPhone の Safari で、決まりの回数のうちなら、ほかの窓が出ていないときに1回だけ出す
function HomeScreenGuideAuto({ onOpenBackup }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!mhHomeScreenGuideMode()) return undefined;   // Safari・アプリ内ブラウザのどちらも(回数の決まりは同じキーで共通)
    const first = readHomeScreenGuideState();
    if (!first.firstSeenAt) writeHomeScreenGuideState({ ...first, firstSeenAt: Date.now() });
    let tries = 0, timer = null, alive = true;
    // ほかの窓(お知らせ・ログインボーナス・案内など)が出ているあいだは待つ。前に出ている物があるかだけを見る
    const busy = () => {
      try {
        return [...document.querySelectorAll('.fixed, [role="dialog"], .mh-title-modal')].some(el => {
          if (el.closest('[data-home-screen-guide]')) return false;
          const st = window.getComputedStyle(el);
          if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
          const z = Number(st.zIndex);
          const r = el.getBoundingClientRect();
          return Number.isFinite(z) && z >= 40 && r.width * r.height >= window.innerWidth * window.innerHeight * 0.3;
        });
      } catch (_) { return true; }
    };
    const tick = () => {
      if (!alive) return;
      const now = Date.now();
      if (!homeScreenGuideAutoDue(readHomeScreenGuideState(), now)) return;
      if (busy()) { if (++tries < 20) timer = setTimeout(tick, 3000); return; }
      const s = readHomeScreenGuideState();
      writeHomeScreenGuideState({ ...s, lastShownAt: now, autoCount: s.autoCount + 1 });   // 出した時点で数える(閉じずに画面を移っても、また出さない)
      setOpen(true);
    };
    timer = setTimeout(tick, 4000);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, []);
  if (!open) return null;
  return <HomeScreenGuideSheet onClose={() => setOpen(false)}
    onNever={() => { writeHomeScreenGuideState({ ...readHomeScreenGuideState(), never: true }); setOpen(false); }}
    onOpenBackup={onOpenBackup}/>;
}
