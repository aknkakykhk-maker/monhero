// ==================== 時間帯で変わる雰囲気・いまの時刻(2026-11-07 社長) ====================
// 社長「ホーム画像とかゲーム内の雰囲気をリアルタイムによってかえるとかってできる？夜なら暗くとか」→「ゲーム全体で作る」
// 社長「それにともなってゲーム内にリアルタイム時間の表示も欲しいね。全ページはじゃまになるかもだから置けそうなとこに」
// 演出担当ハナビ。案と止め絵: docs/progress/time-of-day/PLAN.md
// ★見た目だけ。色は CSS の層だけで重ねる(混ぜ方・ぼかしは使わない。古い端末でも軽い)。
//   ・絵の背景(HOME・タイトル)は絵に色を重ねる。塗りだけの画面(メニュー・マーケット・神殿・モードえらび)は塗りをほんの少し寄せる
//   ・お話・モンヒロビートの演奏中・リザルト・バトル中・カードの場は変えない。ボタン・文字・カード・ノーツには乗らない
//   ・色の層は背景の要素の中にあるので、「🔄 横」で回しても絵と一緒に回る
// ★時刻はいつも日本時間(端末の時間帯の設定に関係なく UTC+9 で数える)。1日の区切り(4:00)とは別に、朝は 5:00 から
// 保存: キー mh_time_of_day_v1 に { mood:'on'|'off', clock:'on'|'off', format:'24h'|'12h' }(無い・壊れているときは従来どおり入・24時間)

const TIME_OF_DAY_STORAGE_KEY = 'mh_time_of_day_v1';
// 区切り(日本時間の時)。[始まりの時, 名前, 印, 表示名]。助手ライフの家も同じ表を使う
const TIME_OF_DAY_SLOTS = Object.freeze([
  Object.freeze({ id: 'morning', from: 5,  icon: '🌅', label: '朝' }),
  Object.freeze({ id: 'day',     from: 10, icon: '☀️', label: '昼' }),
  Object.freeze({ id: 'evening', from: 16, icon: '🌇', label: '夕' }),
  Object.freeze({ id: 'night',   from: 19, icon: '🌙', label: '夜' }),
]);
const TIME_OF_DAY_JST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 日本時間の時・分
const timeOfDayJstParts = (now = Date.now()) => {
  const d = new Date((Number.isFinite(Number(now)) ? Number(now) : Date.now()) + TIME_OF_DAY_JST_OFFSET_MS);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
};
// いまの時間帯(朝 5:00〜 / 昼 10:00〜 / 夕 16:00〜 / 夜 19:00〜4:59)
const timeOfDayAt = (now = Date.now()) => {
  const { h } = timeOfDayJstParts(now);
  let slot = TIME_OF_DAY_SLOTS[TIME_OF_DAY_SLOTS.length - 1];
  for (const s of TIME_OF_DAY_SLOTS) if (h >= s.from) slot = s;
  return slot;
};
const timeOfDayClockText = (now = Date.now(), format = '24h') => {
  const { h, m } = timeOfDayJstParts(now);
  const mm = String(m).padStart(2, '0');
  if (format === '12h') return `${h < 12 ? 'AM' : 'PM'} ${h % 12 || 12}:${mm}`;
  return `${h}:${mm}`;
};
const normalizeTimeOfDaySettings = (value) => {
  const v = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { mood: v.mood === 'off' ? 'off' : 'on', clock: v.clock === 'off' ? 'off' : 'on', format: v.format === '12h' ? '12h' : '24h' };
};

// ---------- 設定と「いま」を持つ場所(どこからでも読めるように画面の外に置く) ----------
const TIME_OF_DAY_STORE = {
  settings: normalizeTimeOfDaySettings(null), loaded: false, slot: timeOfDayAt(), minute: timeOfDayClockText(), listeners: new Set(), timer: null,
};
const timeOfDayEmit = () => { TIME_OF_DAY_STORE.listeners.forEach(fn => { try { fn(); } catch {} }); };
const timeOfDayLoad = async () => {
  if (TIME_OF_DAY_STORE.loaded) return;
  TIME_OF_DAY_STORE.loaded = true;
  try {
    TIME_OF_DAY_STORE.settings = normalizeTimeOfDaySettings(await storeGet(TIME_OF_DAY_STORAGE_KEY, null));
    TIME_OF_DAY_STORE.minute = timeOfDayClockText(Date.now(), TIME_OF_DAY_STORE.settings.format);
  } catch {}
  timeOfDayEmit();
};
const timeOfDaySetSettings = (patch) => {
  TIME_OF_DAY_STORE.settings = normalizeTimeOfDaySettings({ ...TIME_OF_DAY_STORE.settings, ...(patch || {}) });
  TIME_OF_DAY_STORE.minute = timeOfDayClockText(Date.now(), TIME_OF_DAY_STORE.settings.format);
  try { storeSet(TIME_OF_DAY_STORAGE_KEY, TIME_OF_DAY_STORE.settings, false); } catch {}
  timeOfDayEmit();
};
// 20秒ごとに見直す(分が変わったら時刻を、時間帯が変わったら雰囲気を書き換える)。見るたびに今の時刻で決める
const timeOfDayTick = () => {
  const slot = timeOfDayAt(), minute = timeOfDayClockText(Date.now(), TIME_OF_DAY_STORE.settings.format);
  if (slot.id === TIME_OF_DAY_STORE.slot.id && minute === TIME_OF_DAY_STORE.minute) return;
  TIME_OF_DAY_STORE.slot = slot; TIME_OF_DAY_STORE.minute = minute;
  timeOfDayEmit();
};
const useTimeOfDay = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    void timeOfDayLoad();
    const off = (() => { const fn = () => setTick(t => t + 1); TIME_OF_DAY_STORE.listeners.add(fn); return () => TIME_OF_DAY_STORE.listeners.delete(fn); })();
    timeOfDayTick();
    return off;
  }, []);
  return TIME_OF_DAY_STORE;
};

// ---------- 見た目 ----------
// 色の層: 絵の背景は ::after(色)と ::before(夜の星と灯り)。塗りだけの画面は内側の影(背景の上・中身の下に描かれる)で寄せる
// ★1つの決まりは1行に書く(tools/home-layout-check.js が `.mh-home-` を含む行だけを抜き出して HOME を組むため。複数行にまたがると後ろを巻き込む)
const TIME_OF_DAY_CSS = `
.mh-home-background::after,.mh-home-background::before{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 2.4s ease}
.mh-home-background::after{z-index:3}.mh-home-background::before{z-index:4}
html[data-mh-tod="morning"] .mh-home-background::after{opacity:1;background:linear-gradient(180deg,rgba(186,214,255,.30) 0%,rgba(214,236,255,.16) 50%,rgba(255,236,214,.10) 100%)}
html[data-mh-tod="evening"] .mh-home-background::after{opacity:1;background:linear-gradient(180deg,rgba(255,128,48,.34) 0%,rgba(255,110,64,.24) 45%,rgba(120,40,30,.34) 100%)}
html[data-mh-tod="night"] .mh-home-background::after{opacity:1;background:linear-gradient(180deg,rgba(5,8,34,.84) 0%,rgba(10,16,52,.70) 50%,rgba(6,10,34,.76) 100%)}
html[data-mh-tod="night"] .mh-home-background::before{opacity:1;background: radial-gradient(2.2px 2.2px at 12% 8%,#fff 60%,transparent),radial-gradient(1.6px 1.6px at 24% 15%,#fff 60%,transparent),radial-gradient(2.2px 2.2px at 41% 6%,#fff 60%,transparent), radial-gradient(1.6px 1.6px at 57% 12%,#fff 60%,transparent),radial-gradient(2.2px 2.2px at 69% 4%,#fff 60%,transparent),radial-gradient(1.6px 1.6px at 83% 14%,#fff 60%,transparent), radial-gradient(1.6px 1.6px at 92% 7%,#fff 60%,transparent),radial-gradient(1.6px 1.6px at 33% 20%,#fffbe8 60%,transparent),radial-gradient(2.2px 2.2px at 76% 21%,#fffbe8 60%,transparent), radial-gradient(40% 18% at 50% 100%,rgba(255,190,100,.38),transparent 70%), radial-gradient(14% 8% at 20% 62%,rgba(255,196,110,.50),transparent 70%),radial-gradient(14% 8% at 80% 58%,rgba(255,196,110,.50),transparent 70%), radial-gradient(10% 6% at 50% 46%,rgba(140,200,255,.42),transparent 70%)}
.mh-title-gate img.mh-title-visual,.mh-title-gate img.mh-title-backdrop{transition:filter 2.4s ease}
html[data-mh-tod="morning"] .mh-title-gate img.mh-title-visual{filter:brightness(1.04) saturate(.92) hue-rotate(-6deg)}
html[data-mh-tod="evening"] .mh-title-gate img.mh-title-visual{filter:sepia(.32) saturate(1.2) brightness(.92)}
html[data-mh-tod="night"] .mh-title-gate img.mh-title-visual{filter:brightness(.62) saturate(.85)}
[data-mh-theme-category="menu"] .mh-screen-shell,[data-mh-theme-category="market"] .mh-screen-shell,[data-mh-theme-category="temple"] .mh-screen-shell,.mhms-stage{transition:box-shadow 2.4s ease}
html[data-mh-tod="morning"] :is([data-mh-theme-category="menu"],[data-mh-theme-category="market"],[data-mh-theme-category="temple"]) .mh-screen-shell,html[data-mh-tod="morning"] .mhms-stage{box-shadow:inset 0 0 0 100vmax rgba(190,215,255,.05)}
html[data-mh-tod="evening"] :is([data-mh-theme-category="menu"],[data-mh-theme-category="market"],[data-mh-theme-category="temple"]) .mh-screen-shell,html[data-mh-tod="evening"] .mhms-stage{box-shadow:inset 0 0 0 100vmax rgba(255,120,48,.07)}
html[data-mh-tod="night"] :is([data-mh-theme-category="menu"],[data-mh-theme-category="market"],[data-mh-theme-category="temple"]) .mh-screen-shell,html[data-mh-tod="night"] .mhms-stage{box-shadow:inset 0 0 0 100vmax rgba(6,10,40,.24)}
.mh-tod-tint{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 2.4s ease;border-radius:inherit}
html[data-mh-tod="morning"] .mh-tod-tint{opacity:var(--tod-k,1);background:linear-gradient(180deg,rgba(186,214,255,.30) 0%,rgba(214,236,255,.16) 50%,rgba(255,236,214,.10) 100%)}
html[data-mh-tod="evening"] .mh-tod-tint{opacity:var(--tod-k,1);background:linear-gradient(180deg,rgba(255,128,48,.34) 0%,rgba(255,110,64,.24) 45%,rgba(120,40,30,.34) 100%)}
html[data-mh-tod="night"] .mh-tod-tint{opacity:var(--tod-k,1);background:linear-gradient(180deg,rgba(5,8,34,.84) 0%,rgba(10,16,52,.70) 50%,rgba(6,10,34,.76) 100%)}
@media (prefers-reduced-motion:reduce){.mh-tod-tint{transition:none!important}}
@media (prefers-reduced-motion:reduce){.mh-home-background::after,.mh-home-background::before,.mh-title-gate img,.mh-screen-shell,.mhms-stage{transition:none!important}}
.mh-tod-clock{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border:1px solid #eed99566;border-radius:999px;background:#0f1d2ad9;color:#f9eac2;font-family:inherit;font-size:11px;font-weight:900;line-height:1.2;font-variant-numeric:tabular-nums;white-space:nowrap;box-shadow:0 2px 6px #0007;pointer-events:none}
.mh-home-scene button.mh-tod-clock{pointer-events:auto;cursor:pointer}
.mh-tod-clock i{font-style:normal;font-size:12px}
.mh-home-scene .mh-tod-clock{position:absolute;z-index:5;right:9px;top:calc(107px + env(safe-area-inset-top))}
@media (orientation:landscape) and (max-height:600px){.mh-home-scene .mh-tod-clock{top:calc(69px + env(safe-area-inset-top));right:calc(9px + var(--mh-tod-upd,0px))}}
[data-mh-view-rotation="true"] .mh-home-scene .mh-tod-clock{top:calc(69px + env(safe-area-inset-top));right:calc(9px + var(--mh-tod-upd,0px))}
`;
let timeOfDayCssDone = false;
const ensureTimeOfDayCss = () => {
  if (timeOfDayCssDone || typeof document === 'undefined') return;
  timeOfDayCssDone = true;
  const el = document.createElement('style');
  el.setAttribute('data-time-of-day-css', '');
  el.textContent = TIME_OF_DAY_CSS;
  document.head.appendChild(el);
};

// 60-app.jsx に1つ。<html data-mh-tod="…"> を付け替えるだけ(画面・状態は触らない)。雰囲気が切のときは印を外す
const TimeOfDayRoot = () => {
  const st = useTimeOfDay();
  useEffect(() => {
    ensureTimeOfDayCss();
    const t = setInterval(timeOfDayTick, 20000);
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') timeOfDayTick(); };
    try { document.addEventListener('visibilitychange', onVis); } catch {}
    return () => { clearInterval(t); try { document.removeEventListener('visibilitychange', onVis); } catch {} };
  }, []);
  const tod = st.settings.mood === 'on' ? st.slot.id : null;
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;
    if (tod) html.setAttribute('data-mh-tod', tod); else html.removeAttribute('data-mh-tod');
  }, [tod]);
  return null;
};

// いまの時刻の札。HOME だけ押すと表示形式(24時間 / AM・PM)を変えられる。ほかの画面は従来どおり表示だけ
const TimeOfDayClock = ({ home = false }) => {
  const st = useTimeOfDay();
  const ref = useRef(null);
  const [formatOpen, setFormatOpen] = useState(false);
  useEffect(() => {
    ensureTimeOfDayCss();
    if (!home || typeof window === 'undefined') return undefined;
    const measure = () => {
      const el = ref.current, upd = el && el.parentElement && el.parentElement.querySelector('.mh-home-update');
      if (el) el.style.setProperty('--mh-tod-upd', upd ? `${Math.round(upd.getBoundingClientRect().width + 6)}px` : '0px');
    };
    measure();
    const t = setTimeout(measure, 600);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [home]);
  if (st.settings.clock !== 'on') return null;
  const label = `いまの時刻 ${st.minute}(${st.slot.label})`;
  const inside = <><i aria-hidden="true">{st.slot.icon}</i>{st.minute}</>;
  if (!home) return <span ref={ref} className="mh-tod-clock" data-time-of-day-clock={st.slot.id} aria-label={label}>{inside}</span>;
  return <>
    <button type="button" ref={ref} className="mh-tod-clock" data-time-of-day-clock={st.slot.id} aria-label={`${label}。表示形式を変更`} onClick={() => setFormatOpen(true)}>{inside}</button>
    {formatOpen && <div data-time-of-day-format-sheet role="dialog" aria-modal="true" aria-label="時刻表示" onClick={() => setFormatOpen(false)}
      style={{ position:'absolute', inset:0, zIndex:80, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px', background:'#020617bb' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width:'min(300px, 92%)', borderRadius:'18px', border:'1px solid #fcd34d88', background:'#0f172af2', color:'#f8fafc', padding:'14px', boxShadow:'0 12px 36px #000b' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
          <div><b style={{ display:'block', fontSize:'14px' }}>🕐 時刻表示</b><span style={{ display:'block', marginTop:'2px', color:'#cbd5e1', fontSize:'10px', fontWeight:700 }}>日本時間で表示します</span></div>
          <button type="button" data-time-of-day-format-close onClick={() => setFormatOpen(false)}
            style={{ minWidth:'42px', minHeight:'36px', borderRadius:'12px', border:'1px solid #64748b', background:'#1e293b', color:'#e2e8f0', fontSize:'11px', fontWeight:900 }}>閉じる</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginTop:'12px' }}>
          {[['24h', '24時間', '18:32'], ['12h', 'AM・PM', 'PM 6:32']].map(([value, title, sample]) => {
            const selected = st.settings.format === value;
            return <button key={value} type="button" data-time-of-day-format={value} aria-pressed={selected} onClick={() => timeOfDaySetSettings({ format: value })}
              style={{ minHeight:'62px', borderRadius:'14px', border:`2px solid ${selected ? '#fcd34d' : '#475569'}`, background:selected ? '#fcd34d' : '#1e293b', color:selected ? '#0f172a' : '#e2e8f0', padding:'8px', fontWeight:900 }}>
              <span style={{ display:'block', fontSize:'12px' }}>{title}</span><span style={{ display:'block', marginTop:'3px', fontSize:'11px', opacity:.82, fontVariantNumeric:'tabular-nums' }}>{sample}</span>
            </button>;
          })}
        </div>
      </div>
    </div>}
  </>;
};

// 時刻の文字だけ(札の枠なし)。ほかの札の中に時刻を並べたいとき用(例: 助手ライフの家の「🌙 夜」の札に「21:34」を足す)。
//   設定の「いまの時刻を出す」が切なら何も出さない。見出しに別の札を足すと題が切れる(2026-11-07 家の見出しで「助手ライ」まで切れた)ので、同じ所に時間帯の札があるときはこちらを使う
const TimeOfDayClockText = ({ prefix = ' ' }) => {
  const st = useTimeOfDay();
  if (st.settings.clock !== 'on') return null;
  return <span data-time-of-day-clock-text={st.slot.id} style={{ fontVariantNumeric: 'tabular-nums' }}>{prefix}{st.minute}</span>;
};

// 背景の絵の上に、HOME と同じ時間帯の色を重ねる層(2026-11-07 ミハリの指摘 L7③ 地図が夜も昼の明るさ・L14 夜の場面が昼の絵)。
//   置き方: 背景の絵の「すぐ後ろ」(ボタン・文字・顔より前)に <TimeOfDayTint/> を置く。親は position:relative などで位置を持つこと。
//   strength … 濃さ(0〜1。既定1 = HOME と同じ)。設定の「時間帯で雰囲気を変える」が切なら何も重ならない(印が外れるため)
const TimeOfDayTint = ({ strength = 1, className = '' }) => {
  useEffect(() => { ensureTimeOfDayCss(); }, []);
  const k = Math.max(0, Math.min(1, Number(strength)));
  return <span aria-hidden="true" data-time-of-day-tint className={`mh-tod-tint ${className}`} style={{ '--tod-k': Number.isFinite(k) ? k : 1 }}/>;
};
// いまの時間帯の名前(朝・昼・夕・夜)。画面に時間帯の言葉を出すときはここから取る(L8: 同じ17:30に「夕方」と「午後」が並んだ)
const timeOfDayLabelAt = (now = Date.now()) => timeOfDayAt(now).label;

// 設定の欄(設定画面の「画面テーマ」の下)
const TimeOfDaySettingsPanel = () => {
  const st = useTimeOfDay();
  const row = (key, title, desc) => (
    <div className="flex items-center gap-3 mt-2">
      <div className="min-w-0 flex-1"><b className="block text-[12px] font-black text-slate-200">{title}</b><p className="text-[10px] font-bold leading-relaxed text-slate-400">{desc}</p></div>
      <div className="flex shrink-0 gap-1">
        {['on', 'off'].map(v => (
          <button key={v} type="button" data-time-of-day-setting={`${key}-${v}`} aria-pressed={st.settings[key] === v} onClick={() => timeOfDaySetSettings({ [key]: v })}
            className={`min-h-[36px] min-w-[44px] rounded-xl border px-2 text-[11px] font-black ${st.settings[key] === v ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>{v === 'on' ? '入' : '切'}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div data-time-of-day-settings className={`${SCREEN_PANEL_CLASS} w-full text-left`}>
      <b className="block text-[13px] font-black text-slate-200">{st.slot.icon} 時間帯</b>
      {row('mood', '時間帯で雰囲気を変える', '日本時間に合わせて、朝・昼・夕・夜で背景の色が変わります。')}
      {row('clock', 'いまの時刻を出す', 'ホームとプロフィールに、いまの時刻(日本時間)を小さく出します。')}
    </div>
  );
};
