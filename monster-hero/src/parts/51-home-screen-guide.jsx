// ==== 「ホーム画面に追加」の案内(2026-11-11 社長の選択 B・窓口経由・アプリカ) ====
// 社長「ブラウザだからかたまに画面の挙動がおかしい。ホームに追加しても、それでもブラウザのような挙動がある気がする」
// → ホーム画面のアプリでは左端スワイプの戻るを出さなくした(#5455)。Safari で遊んでいる人には、ホーム画面に追加する案内を出す。
// 決まり(窓口):
//   ・iPhone の Safari で遊んでいる人だけに出す(ホーム画面のアプリ・Android・パソコン・LINE などのアプリ内ブラウザには出さない)
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
function HomeScreenGuideSheet({ onClose, onNever = null, onOpenBackup }) {
  const step = (no, title, body) => (
    <li data-home-screen-guide-step={no} className="flex gap-2.5 rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-left">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-[12px] font-black text-slate-950">{no}</span>
      <div className="min-w-0">
        <div className="text-[12px] font-black leading-snug text-white">{title}</div>
        <div className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">{body}</div>
      </div>
    </li>
  );
  return (
    <div data-home-screen-guide role="dialog" aria-modal="true" aria-label="ホーム画面に追加"
      className="fixed inset-0 flex items-center justify-center p-4" style={{ position: 'fixed', inset: 0, zIndex: 85000, backgroundColor: 'rgba(0,0,0,0.82)' }}>
      <div className="w-full max-w-sm max-h-full overflow-y-auto mh-scroll rounded-3xl border border-amber-300/60 bg-slate-900 p-4 shadow-2xl">
        <div className="mh-dialog-head flex items-start justify-between gap-2">
          <h3 className="text-[16px] font-black leading-snug text-white">📲 ホーム画面に追加して遊ぼう</h3>
          <button type="button" aria-label="閉じる" onClick={onClose} className="min-h-[44px] min-w-[44px] shrink-0 rounded-full text-[18px] font-black text-slate-300 active:scale-95">✕</button>
        </div>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">アプリのように画面が広くなり、ブラウザの操作(画面の左端をなぞると戻る、など)が出なくなります。</p>
        <div data-home-screen-guide-warning className="mt-3 rounded-2xl border border-red-300/70 bg-red-950/60 p-3 text-left">
          <div className="text-[12px] font-black text-red-200">⚠ 追加する前に、必ずバックアップを作ってください</div>
          <div className="mt-1 text-[11px] font-bold leading-relaxed text-red-100/90">iPhone では、ホーム画面のアプリと Safari で保存データが別々です。そのまま追加すると、アプリのほうは はじめからになります。</div>
        </div>
        <ol className="mt-3 space-y-2">
          {step(1, 'いまの Safari でバックアップを作る', <>「データ引き継ぎ」の「バックアップファイルを保存(.mhsave)」を押し、「ファイルに保存」を選びます。<br/>(「バックアップコードを作成」→「コードをコピー」でも作れます)<button type="button" data-home-screen-guide-backup onClick={onOpenBackup} className="mt-2 block min-h-[44px] w-full rounded-xl bg-indigo-600 px-3 text-[12px] font-black text-white active:scale-95">💾 データ引き継ぎを開く</button></>)}
          {step(2, 'ホーム画面に追加する', 'Safari の下にある共有ボタン(四角から上向きの矢印)を押し、「ホーム画面に追加」→ 右上の「追加」。')}
          {step(3, '追加したアイコンから開いて、データを戻す', 'ホーム画面のアイコンから開き、「設定」→「データ引き継ぎ」→「復元」で、保存したファイル(またはコピーしたコード)を読み込みます。')}
        </ol>
        <p className="mt-3 text-[10px] font-bold leading-relaxed text-slate-400">戻したあとは、ホーム画面のアイコンから遊んでください。Safari とアプリの両方で遊ぶと、進み方が別々になります。</p>
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
    if (!mhIsIphoneSafariBrowser()) return undefined;
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
