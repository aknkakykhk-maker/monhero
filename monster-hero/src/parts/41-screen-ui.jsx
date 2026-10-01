// ==================== 画面の共通ガワ(管理系の画面はすべてこれを使う) ====================
//
// 管理系の画面(設定・ミッション・ギフト・アイテム・マーケット・プロフィール・図鑑・
// マスモン一覧・神殿・強化・合体・M/B管理)は「必要になったら1つずつ足す」で増えてきたため、
// **同じ役目のものが画面ごとに違う値で書かれていた**(2026-09-18・ユーザー依頼
// 「レイアウト、UIを見直して もっと見た目が良くて使いやすくしたい」)。
//
// 実際に数えたときの散らかり方:
//   ・画面の名前(h2)が 30通り以上(text-sm / text-base / text-lg / text-xl / text-2xl、
//     italic の有無、uppercase tracking-widest の有無、色)
//   ・戻る矢印が 3系統(p-3 active:scale-90 / active:scale-90 なし / min-h-[44px] px-2)、
//     アイコンの大きさも 18 と 20 が混在、aria-label はあったり無かったり
//   ・角丸がプロフィール1画面の中だけで 5種類(lg / xl / 2xl / 3xl / full)
//   ・0件のときの表示が「無い」「素の1行」「絵文字つき」の3通り。しかも .empty-state と
//     .big はCSSがどこにも無く(index.html・tailwind.css とも0件)、効いていたのは
//     インラインstyleだけだった
//   ・7px・8px の字が合体の確認画面だけで 20か所。実機では読めない
//
// デバッグ画面は同じ指摘(2026-09-17「その場しのぎの作りになってる」)を受けて
// 31-debug-ui.jsx で頭をそろえてある。本編の画面にも同じものを用意する。
//
// 【置き場所】
// 40(画面ライフサイクル)と 50(エラー境界)のあいだ。51 以降のすべての画面部品と
// 60-app.jsx の両方から見える。
//
// 【safe-area を画面側で足さないこと】
// index.html:134 の body が padding-top/bottom: env(safe-area-inset-*) を持っている。
// 画面の根でさらに calc(1rem + env(safe-area-inset-top)) を足すと切り欠きぶんを二重に取り、
// ノッチ端末だけ上下の余白が大きくなる(しかも足している画面と足していない画面があり、
// 画面を移るたびに中身の始まる位置が動いていた)。根は SCREEN_SHELL_CLASS だけを使う。
//
// 【横画面(2カラム)を壊さないこと】
// index.html:158 の横画面レイアウトは [data-mh-screen]:has(> .mh-scroll) を見て
// 「根の直下の子」を左右へ振り分ける。だから ScreenHead は **根の直下に置かれる1つの要素**
// を返す(ここをラッパーで包むと、見出しも一覧も左カラムへ入って一覧が潰れる)。

// 画面の根。管理系の画面はすべてこれを使う。
//   <div data-mh-screen className={SCREEN_SHELL_CLASS}>
// data-mh-screen は横画面の組み替えの目印なので、一覧を持つ画面では必ず付ける。
const SCREEN_SHELL_CLASS = 'mh-screen-shell flex-1 flex flex-col h-full min-h-0 p-4';

// 画面の中に置くパネル(囲み)の型。角丸・枠線・背景はここだけで決める。
//   SCREEN_PANEL_CLASS      … ふつうの囲み
//   SCREEN_PANEL_FLAT_CLASS … 中に並べるもの用(背景を一段落とす)
const SCREEN_PANEL_CLASS = 'mh-panel rounded-2xl border border-white/10 bg-slate-900/70 p-3';
const SCREEN_PANEL_FLAT_CLASS = 'mh-panel-flat rounded-xl border border-white/10 bg-black/30 px-3 py-2';

// 一覧(スクロールする場所)の型。flex-1 min-h-0 が無いと、flex の子は中身なりに伸びて
// スクロールが起きず、下が切れる(神殿の4つの一覧で実際に起きていた)。
const SCREEN_LIST_CLASS = 'flex-1 min-h-0 overflow-y-auto mh-scroll';

// 画面のいちばん下に置く決定ボタンの帯。一覧の内側へ sticky で入れると、
// その下にある中身をスクロール中ずっと覆ってしまう(強化画面で起きていた)。
const SCREEN_FOOTER_CLASS = 'mh-screen-footer shrink-0 mt-2 border-t border-white/10 pt-2';

// 画面の頭。「← / 画面の名前 / (補足) / 右の付け足し」の順で、どの画面も同じ形にする。
//   title    … 画面の名前(日本語)
//   icon     … 名前の前に置く絵(省略可)
//   accent   … 名前の色のクラス(画面ごとの識別色。既定は白)
//   note     … 名前の下の小さな補足(省略可)
//   onBack   … 戻るときにすること(画面は自分の戻り先を知らない)
//   backLabel… 読み上げ用のラベル。どこへ戻るのかを書く
//   right    … 右端へ置くもの(件数・所持数など。省略可)
//   accentStyle … 名前の色を style で渡すとき(モードごとの色など、クラスで書けない色)
//   compact  … 中身が詰まっている画面(バトルの入口など)用。下の余白を詰める
// ★戻るは 44×44px(p-3 + 20px)を確保し、押した手応え(active:scale-90)を必ず付ける。
//   「反応する戻る」と「反応しない戻る」が混ざっていると、押せていないように見える。
const ScreenHead = ({ title, icon = null, accent = 'text-white', accentStyle = null, note = '', onBack = null, backLabel = '戻る', right = null, disabled = false, compact = false }) => (
  <header className={`mh-screen-head ${compact ? 'mb-1 pb-1' : 'mb-3 pb-2'} flex shrink-0 items-center gap-1.5 border-b border-white/10`}>
    {onBack && (
      <button type="button" aria-label={backLabel} onClick={onBack} disabled={disabled}
        className="mh-button mh-button-secondary -ml-1 shrink-0 p-3 text-slate-400 active:scale-90 disabled:opacity-30">
        <ArrowLeft size={20}/>
      </button>
    )}
    <div className="min-w-0 flex-1">
      <h2 className={`flex items-center gap-1.5 truncate text-xl font-black italic leading-tight ${accent}`} style={accentStyle || undefined}>{icon}{title}</h2>
      {note && <p className="mh-screen-note mt-0.5 text-[10px] font-bold leading-snug text-slate-400">{note}</p>}
    </div>
    {right && <div className="shrink-0">{right}</div>}
  </header>
);

// 画面の説明文(見出しの下に1〜2行)。各画面が同じ指定を手で書き写していたのでまとめる。
// 補足は 10px より小さくしない(8px は実機では模様にしか見えない)。
const ScreenLead = ({ children }) => (
  <p className="mh-screen-note mb-2 shrink-0 px-0.5 text-[10px] font-bold leading-relaxed text-slate-400">{children}</p>
);

// 0件のときの表示。「無い」「素の1行」「絵文字つき」の3通りあったのを1つにする。
//   emoji … 40px で出す絵文字
//   lines … 1行目は濃く(なぜ空なのか)、2行目以降は薄く(どうすれば埋まるのか)
//   action… 下に置くボタン(省略可)
// ★「まだ無い」で終わらせず、**次にどうすればよいか**を必ず2行目に書く。
const ScreenEmpty = ({ emoji = '📭', lines = [], action = null }) => (
  <div className="mx-auto flex w-full max-w-xs flex-col items-center justify-center gap-1.5 px-4 py-12 text-center">
    <span aria-hidden="true" className="leading-none" style={{fontSize:'40px'}}>{emoji}</span>
    {(Array.isArray(lines) ? lines : [lines]).filter(Boolean).map((line, index) => (
      <p key={index} className={index === 0
        ? 'text-[12px] font-black leading-relaxed text-slate-300'
        : 'text-[10px] font-bold leading-relaxed text-slate-500'}>{line}</p>
    ))}
    {action && <div className="mt-2 w-full">{action}</div>}
  </div>
);

// タブの並び。数・文字の大きさ・すき間・押した手応えが画面ごとに違っていたのでまとめる。
//   items  … [{ id, label, color, badge }]。color は識別色。省略時は共通の金色と濃い文字。
//   value  … いま選ばれている id
//   onChange … 押されたら呼ぶ
// ★列の数は style で渡す。`grid-cols-${n}` のような組み立てたクラス名は
//   静的CSS(tailwind.css)に入らないので効かない(UIルール「動的クラスだけに依存しない」)。
// ★選ばれている側の背景も style で直に持たせる。同じ理由。
const SCREEN_TAB_ACTIVE_FALLBACK = 'var(--mh-gold, #e8bc62)';
const ScreenTabs = ({ items = [], value, onChange, className = '' }) => (
  <div role="tablist" className={`mb-2 grid shrink-0 gap-2 ${className}`}
    style={{gridTemplateColumns:`repeat(${Math.max(1, items.length)},minmax(0,1fr))`}}>
    {items.map(tab => {
      const on = tab.id === value;
      return (
        <button key={tab.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(tab.id)}
          className={`mh-tab relative min-h-[44px] rounded-xl px-1 text-[11px] font-black leading-tight active:scale-95 ${on ? 'text-white' : 'border border-white/10 bg-slate-900 text-slate-400'}`}
          style={on ? {background: tab.color || SCREEN_TAB_ACTIVE_FALLBACK, color: tab.color ? undefined : 'var(--mh-on-gold, #211a0c)'} : undefined}>
          {tab.label}
          {tab.badge > 0 && typeof tabCountBadge === 'function' ? tabCountBadge(tab.badge) : null}
        </button>
      );
    })}
  </div>
);

// 画面の中の小見出し(節の名前)。60-app.jsx の renderDetailSectionLabel と同じ形を、
// 画面部品からも使えるようにしたもの。
const ScreenSectionLabel = ({ children, note = '' }) => (
  <div className="flex items-baseline gap-2 px-0.5 pt-1">
    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{children}</span>
    {note && <span className="truncate text-[9px] font-bold text-slate-500">{note}</span>}
  </div>
);

// ==================== 窓(モーダル)の共通部品 ====================
// 2026-10-01 ユーザー指示「各画面で同じような作りだけどそうじゃないとか統一性とか管理上の問題とかないか調べて改良して」。
// 窓は画面ごとに手書きされていて、閉じるボタンが「閉じる/とじる/やめる/戻る」、数の選び方が6通り、
// 確認はブラウザ標準の確認ダイアログ(window.confirm)と専用の窓が混ざっていた。
// マーケットで作った形(2026-09-28)をここへ移し、どの画面からも同じ部品で出す。
//   ModalFrame       … 窓の枠。safe-area を取り、外側を押すと閉じる(保存中など閉じてよくないときは onClose を渡さない)
//   ModalCloseButton … 閉じる/キャンセルのボタン。文言は「閉じる」「キャンセル」の2つだけにそろえる
//   QuantityStepper  … 数を選ぶ -10/-1/数/+1/+10 と MAX
//   ConfirmSheet     … 「本当に〜しますか」の確認。本体の askConfirm から出す
// ★窓の重なり順(z-index)は MODAL_Z の段から選ぶ。値をその場で書かない
const MODAL_Z = Object.freeze({ dialog:42000, confirm:43000 });
const ModalFrame = ({ label, border='border-amber-400/70', onClose, children, narrow=false, zIndex=MODAL_Z.dialog }) => (
  <div onClick={onClose||undefined} className="fixed inset-0 flex items-center justify-center overflow-y-auto px-4" style={{position:'fixed',inset:0,paddingTop:'max(16px, env(safe-area-inset-top))',paddingBottom:'max(16px, env(safe-area-inset-bottom))',backgroundColor:'rgba(2,6,23,0.94)',zIndex}} role="dialog" aria-modal="true" aria-label={label}>
    <div onClick={e=>e.stopPropagation()} className={`w-full ${narrow?'max-w-[280px]':'max-w-sm'} rounded-3xl border-2 ${border} bg-slate-950 p-4 shadow-2xl`}>{children}</div>
  </div>
);
const ModalCloseButton = ({ onClick, label='閉じる', disabled=false }) => (
  <button type="button" disabled={disabled} onClick={onClick} className="mh-button mh-button-secondary w-full min-h-[48px] rounded-2xl border border-white/20 bg-slate-900 font-black active:scale-[.98] disabled:opacity-40">{label}</button>
);
// value は 1〜max に収めてから onChange へ渡す。max が 0 のときは何も増やせない(MAX も押せない)
const QuantityStepper = ({ value, max, onChange, unit='個', maxClass='' }) => {
  const safeMax=Math.max(0, Math.floor(Number(max)||0));
  const count=Math.min(Math.max(1, Math.floor(Number(value)||1)), Math.max(1, safeMax));
  const setCount=(next)=>onChange&&onChange(Math.min(Math.max(1, next), Math.max(1, safeMax)));
  const stepClass='mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 font-black active:scale-95 disabled:opacity-30';
  return <>
    <div className="mt-2 grid grid-cols-5 items-center gap-1.5">
      <button type="button" disabled={count<=1} onClick={()=>setCount(count-10)} className={stepClass}>-10</button>
      <button type="button" disabled={count<=1} onClick={()=>setCount(count-1)} className={stepClass}>-1</button>
      <strong className="text-center text-xl font-black font-mono">{count}</strong>
      <button type="button" disabled={count>=safeMax} onClick={()=>setCount(count+1)} className={stepClass}>+1</button>
      <button type="button" disabled={count>=safeMax} onClick={()=>setCount(count+10)} className={stepClass}>+10</button>
    </div>
    <button type="button" disabled={safeMax<=0} onClick={()=>setCount(safeMax)} className={`mh-button mh-button-secondary mt-2 min-h-[44px] w-full rounded-xl font-black active:scale-95 disabled:opacity-30 ${maxClass}`}>MAX（{safeMax.toLocaleString()}{unit}）</button>
  </>;
};
// 確認の窓。title は問いかけ、message は何が起きるか(取り消せるかどうかも書く)。
// danger のときは決定ボタンを危険な操作の型(mh-button-danger)にする(削除など、元に戻せない操作)
const ConfirmSheet = ({ title, message='', confirmLabel='OK', danger=false, onConfirm, onCancel }) => (
  <ModalFrame label={title} border={danger?'border-red-400/70':'border-amber-400/70'} onClose={onCancel} zIndex={MODAL_Z.confirm}>
    <h3 data-confirm-sheet className={`text-center text-base font-black leading-snug ${danger?'text-red-200':'text-amber-200'}`}>{title}</h3>
    {message&&<p className="mt-3 whitespace-pre-line text-[12px] font-bold leading-relaxed text-slate-200">{message}</p>}
    <div className="mt-4 grid grid-cols-1 gap-2">
      <button type="button" onClick={onConfirm} className={`mh-button ${danger?'mh-button-danger':'mh-button-primary'} min-h-[52px] rounded-2xl font-black active:scale-[.98]`}>{confirmLabel}</button>
      <ModalCloseButton onClick={onCancel} label="キャンセル"/>
    </div>
  </ModalFrame>
);

// ==================== 強化フェーズ(WAVEクリア後の画面)の共通部品 ====================
// WAVEをクリアしてから次のバトルが始まるまでに、トレーニング・供モン・配置・固有技・
// アシストカードの画面が WAVE によって 1〜5 枚続く。どこまで進んで、あと何枚あるのかが
// 分からなかったので、各画面の上に同じ形の並びを出す(並びは postWavePhasePlan が組む)。
// 画面ごとの識別色もここで決める(背景の光・並びの「いまここ」の色)。
const PHASE_STEP_LABELS = Object.freeze({
  training:'トレーニング', growth:'自動成長', ally:'供モン', slot:'配置', skill:'固有技', teaching:'アシストカード', hero:'えらぶ',
});
const PHASE_ACCENT_RGB = Object.freeze({
  training:'251,191,36', growth:'45,212,191', ally:'129,140,248', slot:'129,140,248', skill:'245,158,11', teaching:'192,132,252', hero:'129,140,248',
});
const phaseAccentRgb = (id) => PHASE_ACCENT_RGB[id] || '148,163,184';
// 手順の並び。plan に current が無いとき(ラン開始時の配置・アシストカードなど)は何も出さない。
//   plan     … ['training','ally',…](postWavePhasePlan の戻り値)
//   current  … いまの画面の id
//   nextWave … 並びの最後に「⚔ WAVE n」と出す(省略可。段が4つ以上のときは幅が足りないので出さない)
// ★iPhone SE の幅(375px)でも1行に収める。済んだ段は名前を出さず ✓ の丸だけにする
//   (名前は読み上げ用の aria-label と title に残す)。5段+WAVE を全部名前で並べると2行に折れていた
// ==== トレーニング完了の演出(強化フェーズ) ====
// 決定を押したあとに出る。1体ずつ「いくつから いくつになったか」を、数字が駆け上がる動きで見せる。
//   entries … [{ key, name, imgUrl, baseId, colors, emoji, rows:[{ key, label, before, after }] }]
//   ms      … この画面を出している時間(バトル速度で縮む)。数字の駆け上がる時間もこれに合わせる
// 動きはすべて1回きり(動き続けるものは置かない)。prefers-reduced-motion のときは最後の値をそのまま出す。
const TRAINING_FX_STATS = {
  hp:   { tint:'text-pink-300',    bar:'bg-pink-400',    glow:'244,114,182', Icon:'Heart' },
  atk:  { tint:'text-red-300',     bar:'bg-red-400',     glow:'248,113,113', Icon:'Sword' },
  def:  { tint:'text-emerald-300', bar:'bg-emerald-400', glow:'52,211,153',  Icon:'ShieldCheck' },
  guts: { tint:'text-amber-300',   bar:'bg-amber-400',   glow:'251,191,36',  Icon:'Sparkles' },
};
const TrainingCountUp = ({ from, to, delay = 0, duration = 900, format = null }) => {
  const [value, setValue] = React.useState(from);
  React.useEffect(() => {
    let reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    if (reduce || from === to) { setValue(to); return undefined; }
    setValue(from);
    let raf = 0;
    let startAt = 0;
    const timer = setTimeout(() => {
      const tick = (now) => {
        if (!startAt) startAt = now;
        const t = Math.min(1, (now - startAt) / Math.max(1, duration));
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(from + (to - from) * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, Math.max(0, delay));
    return () => { clearTimeout(timer); if (raf) cancelAnimationFrame(raf); };
  }, [from, to, delay, duration]);
  return <>{format ? format(value) : value}</>;
};
// 「いくつから いくつへ」の1項目。元の値を小さく、新しい値を大きく(増えたぶんは駆け上がる)、増えた量を「+○○」で出す。
const PhaseGrowthCell = ({ row, d = 0, countMs = 900, compact = false }) => {
  const st = TRAINING_FX_STATS[row.key] || TRAINING_FX_STATS.hp;
  const Icon = { Heart, Sword, ShieldCheck, Sparkles }[st.Icon];
  const diff = row.after - row.before;
  return (
    <div className="mh-ph-cell rounded-lg px-1 py-1 text-center font-mono">
      <span className="flex items-center justify-center gap-0.5 text-[8px] font-black text-slate-400 leading-none"><span className={st.tint}><Icon size={9}/></span>{row.label}</span>
      <span className="block text-[9px] font-black text-slate-500 leading-tight mt-0.5">{row.before}<span className="text-slate-600"> →</span></span>
      <span className={`${diff > 0 ? 'mh-train-num ' : ''}block font-black leading-tight ${compact ? 'text-[15px]' : 'text-[22px]'} ${diff > 0 ? st.tint : 'text-slate-300'}`} style={diff > 0 ? {'--d': `${d + countMs}ms`, '--glow': st.glow} : undefined}>
        {diff > 0 ? <TrainingCountUp from={row.before} to={row.after} delay={d} duration={countMs}/> : row.after}
      </span>
      {diff > 0
        ? <span className={`mh-train-gain mt-0.5 mx-auto block w-fit rounded-full border border-white/20 bg-black/50 px-2 py-px text-[11px] font-black leading-tight ${st.tint}`} style={{'--d': `${d}ms`}}>+{diff}</span>
        : <span className="block text-[9px] font-black text-slate-600 leading-none mt-0.5">±0</span>}
    </div>
  );
};
const TrainingResultFx = ({ effect }) => {
  const entries = Array.isArray(effect?.entries) ? effect.entries : [];
  const total = Math.max(600, Number(effect?.ms) || 2600);
  const countMs = Math.max(250, Math.min(1100, Math.round(total * 0.4)));
  const compact = entries.length >= 3;
  const gained = entries.reduce((sum, entry) => sum + entry.rows.filter(row => row.after > row.before).length, 0);
  return (
    <div data-training-result-fx className="mh-phase mh-ph-bg absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 overflow-hidden" style={{'--ph':'251,191,36'}}>
      <div className="shrink-0 flex flex-col items-center gap-1">
        {effect.wave > 0 && <span className="mh-ph-plate">WAVE {effect.wave} CLEAR</span>}
        <div className="mh-ph-heading">
          <h2 className="mh-ph-title mh-train-title text-2xl font-black italic uppercase tracking-tighter leading-none">TRAINING COMPLETE</h2>
        </div>
        <div className="mh-train-sub text-[10px] font-black text-[#f3d27a]">{gained > 0 ? 'ステータスが成長しました！' : 'トレーニング完了'}</div>
      </div>
      <div className={`w-full max-w-sm min-h-0 flex flex-col ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        {entries.map((entry, ei) => {
          const base = 350 + ei * 260;
          return (
            <div key={entry.key} className="mh-train-card mh-ph-panel relative overflow-hidden rounded-2xl px-2.5 py-2" style={{'--d': `${ei * 260}ms`}}>
              <span aria-hidden="true" className="mh-train-sweep" style={{'--d': `${base + 150}ms`}}/>
              <div className="relative flex items-center gap-2 mb-1.5">
                <span className={`${compact ? 'h-8 w-8' : 'h-14 w-14'} shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/40 flex items-center justify-center`}>
                  {entry.imgUrl ? <DyedMonsterImage baseId={entry.baseId} src={entry.imgUrl} alt="" masuColors={entry.colors} className="h-full w-full object-contain"/> : <span className="text-xl">{entry.emoji}</span>}
                </span>
                <b className={`min-w-0 truncate font-black text-white ${compact ? 'text-[12px]' : 'text-[16px]'}`}>{entry.name}</b>
              </div>
              <div className="relative grid grid-cols-4 gap-1.5">
                {entry.rows.map((row, ri) => (
                  <PhaseGrowthCell key={row.key} row={row} d={base + ri * 110} countMs={countMs} compact={compact}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {effect.guard && <div className="mh-train-guard shrink-0 w-full max-w-sm rounded-2xl border border-sky-300/50 bg-sky-950/70 px-3 py-1.5 text-center" style={{'--d': `${350 + entries.length * 260 + 300}ms`}}>
        <div className="text-[13px] font-black text-sky-200">🛡️ {effect.guard.title}</div>
        <div className="text-[9px] font-bold text-sky-100/80 leading-snug whitespace-pre-line">{effect.guard.text}</div>
      </div>}
    </div>
  );
};

// ==== 供モン合流の演出 ====
//   effect … { name, imgUrl, baseId, colors, emoji, rows:[{key,label,before,after}], apt, wave, ms }
const AllyJoinFx = ({ effect }) => {
  const total = Math.max(600, Number(effect?.ms) || 2600);
  const countMs = Math.max(250, Math.min(1100, Math.round(total * 0.4)));
  const rows = Array.isArray(effect?.rows) ? effect.rows : [];
  return (
    <div data-ally-join-fx className="mh-phase mh-ph-bg absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 overflow-hidden" style={{'--ph':'129,140,248'}}>
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="mh-ph-plate">{effect.wave > 0 ? `WAVE ${effect.wave} CLEAR ・ ` : ''}新しい仲間が合流</span>
        <div className="mh-ph-heading"><h2 className="mh-ph-title mh-train-title text-3xl font-black italic uppercase tracking-tighter leading-none">JOIN!</h2></div>
      </div>
      <div className="relative shrink-0 flex items-center justify-center" style={{'--ph':'243,210,122'}}>
        <span aria-hidden="true" className="mh-ph-rune"/>
        <span aria-hidden="true" className="mh-ph-floor"/>
        <div className="mh-phase-pop relative z-10 h-32 w-32 flex items-center justify-center" style={{animationDelay:'.15s'}}>
          {effect.imgUrl ? <DyedMonsterImage baseId={effect.baseId} src={effect.imgUrl} alt="" masuColors={effect.colors} className="h-full w-full object-contain drop-shadow-[0_0_24px_rgba(129,140,248,0.75)]"/> : <span className="text-7xl">{effect.emoji}</span>}
        </div>
      </div>
      <div className="mh-train-sub shrink-0 text-xl font-black text-white">{effect.name}<span className="text-slate-300 text-sm">が仲間になった！</span></div>
      <div className="mh-train-card mh-ph-panel relative w-full max-w-sm overflow-hidden rounded-2xl px-2.5 py-2" style={{'--d': '350ms'}}>
        <span aria-hidden="true" className="mh-train-sweep" style={{'--d': '500ms'}}/>
        <div className="relative mb-1 text-left text-[9px] font-black text-[#f3d27a]">パーティのステータス</div>
        <div className="relative grid grid-cols-4 gap-1.5">
          {rows.map((row, ri) => <PhaseGrowthCell key={row.key} row={row} d={450 + ri * 110} countMs={countMs}/>)}
        </div>
        {effect.apt && <div className="mh-train-gain relative mt-1.5 text-center text-[10px] font-black text-cyan-300" style={{'--d': '1000ms'}}>間合い適性 {effect.apt}</div>}
      </div>
    </div>
  );
};

// ==== アシストカードを覚えた・強化したときの演出 ====
//   effect … { name, icon, id, fromLevel(-1=新規), toLevel, maxLevel, desc, ms }
const TeachingResultFx = ({ effect }) => {
  const isUpgrade = effect.fromLevel >= 0;
  return (
    <div data-teaching-result-fx className="mh-phase mh-ph-bg absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 overflow-hidden" style={{'--ph':'192,132,252'}}>
      <span className="mh-ph-plate">ASSIST CARD</span>
      <div className="mh-ph-heading"><h2 className="mh-ph-title mh-train-title text-3xl font-black italic uppercase tracking-tighter leading-none">{isUpgrade ? 'POWER UP!' : 'NEW CARD!'}</h2></div>
      <div className="relative shrink-0 flex items-center justify-center" style={{'--ph':'243,210,122'}}>
        <span aria-hidden="true" className="mh-ph-rune"/>
        <span className="mh-phase-pop mh-ph-medal relative z-10 rounded-3xl p-2 leading-none" style={{animationDelay:'.15s'}}>{cardIconNode(effect.icon, 84, effect.id)}</span>
      </div>
      <div className="mh-train-sub text-lg font-black text-white">{effect.name}</div>
      <div className="flex items-center gap-2" aria-hidden="true">
        {Array.from({ length: (effect.maxLevel || 2) + 1 }).map((_, i) => (
          <i key={i} className={`mh-ph-pip${i === effect.toLevel ? ' mh-train-gain' : ''}`} data-on={i <= effect.toLevel ? '' : undefined} style={i === effect.toLevel ? {'--d': '450ms'} : undefined}/>
        ))}
      </div>
      <div className="mh-train-gain text-[12px] font-black text-purple-200" style={{'--d': '450ms'}}>{isUpgrade ? `Lv.${effect.fromLevel} → Lv.${effect.toLevel} に強化！` : '新しく習得しました！'}</div>
      {effect.desc && <div className="mh-train-card mh-ph-panel w-full max-w-sm rounded-2xl px-3 py-2 text-[11px] font-bold leading-snug text-slate-100" style={{'--d': '300ms'}}>{effect.desc}</div>}
    </div>
  );
};

// ==== 強化フェーズの切り替わりの帯 ====
// 次の画面へ移るたびに、画面の真ん中を金の帯が横切って「いまから何の画面か」を一瞬だけ見せる。
// 操作は止めない(pointer-events: none)。見せるのは約0.9秒で、動き続けるものは無い。
const PHASE_BANNER_TITLES = Object.freeze({
  training:'TRAINING', growth:'AUTO GROWTH', ally:'NEW ALLY', slot:'FORMATION', skill:'UNIQUE SKILL', teaching:'ASSIST CARD', hero:'SELECT HERO',
});
const PhaseBanner = ({ phase, enabled }) => {
  const [shown, setShown] = React.useState(null);
  const lastRef = React.useRef(null);
  React.useEffect(() => {
    if (!phase || !enabled) { lastRef.current = phase || null; return undefined; }
    if (lastRef.current === phase) return undefined;
    lastRef.current = phase;
    setShown({ phase, key: Date.now() });
    const timer = setTimeout(() => setShown(null), 950);
    return () => clearTimeout(timer);
  }, [phase, enabled]);
  if (!shown) return null;
  return (
    <div key={shown.key} data-phase-banner={shown.phase} aria-hidden="true" className="mh-banner" style={{'--ph': phaseAccentRgb(shown.phase)}}>
      <div className="mh-banner-band">
        <span className="mh-banner-sub">{PHASE_STEP_LABELS[shown.phase] || ''}</span>
        <b className="mh-banner-title">{PHASE_BANNER_TITLES[shown.phase] || ''}</b>
      </div>
    </div>
  );
};

// ==== WAVEのはじまりの演出 ====
// 敵が出てバトルが始まるたびに、画面の真ん中へ「WAVE ○」を一瞬だけ出す。最後のWAVE(10)はボス戦として赤く出す。
// 操作は止めない(pointer-events: none)。約1.5秒で、動き続けるものは無い。
const WaveIntro = ({ enabled, wave, enemyName }) => {
  const [shown, setShown] = React.useState(null);
  const lastRef = React.useRef(null);
  React.useEffect(() => {
    if (!enabled || !(wave > 0)) { lastRef.current = null; return undefined; }
    const key = `${wave}:${enemyName || ''}`;
    if (lastRef.current === key) return undefined;
    lastRef.current = key;
    setShown({ wave, name: enemyName || '', key: Date.now() });
    const timer = setTimeout(() => setShown(null), 1500);
    return () => clearTimeout(timer);
  }, [enabled, wave, enemyName]);
  if (!shown) return null;
  const boss = shown.wave >= 10;
  return (
    <div key={shown.key} data-wave-intro={shown.wave} aria-hidden="true" className={`mh-waveintro${boss ? ' mh-waveintro-boss' : ''}`}>
      <div className="mh-waveintro-line"/>
      <div className="mh-waveintro-body">
        <span className="mh-waveintro-sub">{boss ? 'FINAL BOSS' : 'BATTLE START'}</span>
        <b className="mh-waveintro-title">WAVE {shown.wave}</b>
        {shown.name && <span className="mh-waveintro-name">VS {shown.name}</span>}
      </div>
      <div className="mh-waveintro-line"/>
    </div>
  );
};

// ==== ラン終了(CHAMPION)の紙ふぶき ====
// 位置・色・遅れは番号から決める(描くたびに変わらないように)。1回だけ降って、あとは何も動かない。
const EndConfetti = ({ count = 22 }) => (
  <div aria-hidden="true" className="mh-confetti">
    {Array.from({ length: count }).map((_, i) => (
      <i key={i} style={{'--x': `${(i * 37) % 100}%`, '--d': `${(i % 7) * 140}ms`, '--r': `${(i % 5) * 140 - 280}deg`, '--c': ['#fde68a', '#f9a8d4', '#a5f3fc', '#fff', '#fdba74'][i % 5]}}/>
    ))}
  </div>
);

// ==== クイックの成長・合流の1行(元の値 → 新しい値が駆け上がり、増えた量を出す) ====
const QuickGrowthRow = ({ st, index }) => {
  const diff = st.after - st.before;
  const d = 250 + index * 130;
  return (
    <div className={`flex items-center gap-2 px-4 py-2 ${index > 0 ? 'border-t border-white/5' : ''}`}>
      <span className="w-14 shrink-0 text-left text-[11px] font-black text-slate-400">{st.label}</span>
      <span className="flex-1 text-right font-mono text-[13px] text-slate-300">{st.before.toLocaleString()}</span>
      <span className="shrink-0 text-[11px]" style={{color:'#2dd4bf'}}>→</span>
      <span className={`${diff > 0 ? 'mh-train-num ' : ''}flex-1 text-left font-mono text-[15px] font-black text-white`} style={diff > 0 ? {'--d': `${d + 800}ms`, '--glow': '45,212,191'} : undefined}>
        {diff > 0 ? <TrainingCountUp from={st.before} to={st.after} delay={d} duration={800} format={v => v.toLocaleString()}/> : st.after.toLocaleString()}
      </span>
      <span className={`${diff > 0 ? 'mh-train-gain ' : ''}w-16 shrink-0 text-right font-mono text-[11px] font-black`} style={{color: diff > 0 ? '#5eead4' : '#64748b', ...(diff > 0 ? {'--d': `${d}ms`} : {})}}>{diff > 0 ? `+${diff.toLocaleString()}` : '±0'}</span>
    </div>
  );
};

const PhaseSteps = ({ plan, current, nextWave = null, className = '' }) => {
  if (!Array.isArray(plan) || !plan.includes(current)) return null;
  const at = plan.indexOf(current);
  const showNext = Number(nextWave) > 0 && plan.length <= 3;
  // 見た目は 70-bootstrap.jsx の mh-ph-step-*(いま=識別色の光る札 / 済み=緑の菱形の宝石 / まだ=夜色の札)
  const line = (on, key) => <span key={key} aria-hidden="true" className={`block h-px w-1.5 shrink-0${on ? ' mh-ph-step-line' : ''}`} style={on ? undefined : {background:'rgba(243,210,122,.16)'}}/>;
  return (
    <nav aria-label={`強化フェーズ ${at + 1}/${plan.length}：${PHASE_STEP_LABELS[current] || current}`}
      data-phase-steps={`${current}:${at + 1}/${plan.length}`}
      className={`flex flex-wrap items-center justify-center gap-x-1 gap-y-1 ${className}`}
      style={{'--ph': phaseAccentRgb(current)}}>
      {plan.map((id, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return (
          <React.Fragment key={id}>
            {i > 0 && line(i <= at, `line-${id}`)}
            {state === 'done'
              ? <span title={PHASE_STEP_LABELS[id] || id} aria-label={`${PHASE_STEP_LABELS[id] || id}（済み）`}
                  className="mh-ph-step-done mx-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[8px] font-black">
                  <span>✓</span>
                </span>
              : <span aria-current={state === 'now' ? 'step' : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black leading-tight ${state === 'now' ? 'mh-ph-step-now' : 'mh-ph-step-todo'}`}>
                  {PHASE_STEP_LABELS[id] || id}
                </span>}
          </React.Fragment>
        );
      })}
      {showNext && <>
        {line(false, 'line-next')}
        <span className="shrink-0 whitespace-nowrap text-[9px] font-black text-[#c9ae6a]">⚔ WAVE {nextWave}</span>
      </>}
    </nav>
  );
};
// ==== 強化フェーズの共通部品ここまで ====
