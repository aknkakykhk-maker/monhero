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
// ★戻るは 44×44px(p-3 + 20px)を確保し、押した手応え(active:scale-90)を必ず付ける。
//   「反応する戻る」と「反応しない戻る」が混ざっていると、押せていないように見える。
const ScreenHead = ({ title, icon = null, accent = 'text-white', note = '', onBack = null, backLabel = '戻る', right = null, disabled = false }) => (
  <header className="mh-screen-head mb-3 flex shrink-0 items-center gap-1.5 border-b border-white/10 pb-2">
    {onBack && (
      <button type="button" aria-label={backLabel} onClick={onBack} disabled={disabled}
        className="mh-button mh-button-secondary -ml-1 shrink-0 p-3 text-slate-400 active:scale-90 disabled:opacity-30">
        <ArrowLeft size={20}/>
      </button>
    )}
    <div className="min-w-0 flex-1">
      <h2 className={`flex items-center gap-1.5 truncate text-xl font-black italic leading-tight ${accent}`}>{icon}{title}</h2>
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

// ==================== 強化フェーズ(WAVEクリア後の画面)の共通部品 ====================
// WAVEをクリアしてから次のバトルが始まるまでに、トレーニング・供モン・配置・固有技・
// アシストカードの画面が WAVE によって 1〜5 枚続く。どこまで進んで、あと何枚あるのかが
// 分からなかったので、各画面の上に同じ形の並びを出す(並びは postWavePhasePlan が組む)。
// 画面ごとの識別色もここで決める(背景の光・並びの「いまここ」の色)。
const PHASE_STEP_LABELS = Object.freeze({
  training:'トレーニング', growth:'自動成長', ally:'供モン', slot:'配置', skill:'固有技', teaching:'アシストカード',
});
const PHASE_ACCENT_RGB = Object.freeze({
  training:'251,191,36', growth:'45,212,191', ally:'129,140,248', slot:'129,140,248', skill:'245,158,11', teaching:'192,132,252',
});
const phaseAccentRgb = (id) => PHASE_ACCENT_RGB[id] || '148,163,184';
// 画面の根の背景。上から識別色の光を差す
const phaseBackdropStyle = (id) => ({
  backgroundColor:'#020617',
  backgroundImage:`radial-gradient(ellipse 90% 45% at 50% 0%, rgba(${phaseAccentRgb(id)},.16), transparent 70%)`,
});
// 手順の並び。plan に current が無いとき(ラン開始時の配置・アシストカードなど)は何も出さない。
//   plan     … ['training','ally',…](postWavePhasePlan の戻り値)
//   current  … いまの画面の id
//   nextWave … 並びの最後に「⚔ WAVE n」と出す(省略可。段が4つ以上のときは幅が足りないので出さない)
// ★iPhone SE の幅(375px)でも1行に収める。済んだ段は名前を出さず ✓ の丸だけにする
//   (名前は読み上げ用の aria-label と title に残す)。5段+WAVE を全部名前で並べると2行に折れていた
const PhaseSteps = ({ plan, current, nextWave = null, className = '' }) => {
  if (!Array.isArray(plan) || !plan.includes(current)) return null;
  const at = plan.indexOf(current);
  const showNext = Number(nextWave) > 0 && plan.length <= 3;
  const accent = phaseAccentRgb(current);
  const line = (on, key) => <span key={key} aria-hidden="true" className="block h-px w-1.5 shrink-0" style={{background:on?'rgba(255,255,255,.45)':'rgba(255,255,255,.14)'}}/>;
  return (
    <nav aria-label={`強化フェーズ ${at + 1}/${plan.length}：${PHASE_STEP_LABELS[current] || current}`}
      data-phase-steps={`${current}:${at + 1}/${plan.length}`}
      className={`flex flex-wrap items-center justify-center gap-x-1 gap-y-1 ${className}`}>
      {plan.map((id, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'todo';
        return (
          <React.Fragment key={id}>
            {i > 0 && line(i <= at, `line-${id}`)}
            {state === 'done'
              ? <span title={PHASE_STEP_LABELS[id] || id} aria-label={`${PHASE_STEP_LABELS[id] || id}（済み）`}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black text-emerald-300"
                  style={{background:'rgba(52,211,153,.14)', border:'1px solid rgba(52,211,153,.4)'}}>✓</span>
              : <span aria-current={state === 'now' ? 'step' : undefined}
                  className={`shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-black leading-tight ${state === 'now' ? 'text-slate-950' : 'text-slate-500'}`}
                  style={state === 'now' ? {background:`rgb(${accent})`, boxShadow:`0 0 10px rgba(${accent},.55)`}
                    : {border:'1px solid rgba(255,255,255,.14)'}}>
                  {PHASE_STEP_LABELS[id] || id}
                </span>}
          </React.Fragment>
        );
      })}
      {showNext && <>
        {line(false, 'line-next')}
        <span className="shrink-0 whitespace-nowrap text-[9px] font-black text-slate-500">⚔ WAVE {nextWave}</span>
      </>}
    </nav>
  );
};
// 見出しの上の小さな札(「WAVE 2 CLEAR」「ASSIST CARD」など)。識別色で縁取る
const PhaseEyebrow = ({ id, children }) => {
  const accent = phaseAccentRgb(id);
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black tracking-[.2em]"
      style={{border:`1px solid rgba(${accent},.45)`, background:`rgba(${accent},.1)`, color:`rgb(${accent})`}}>{children}</span>
  );
};
