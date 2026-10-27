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
//   wrapTitle… 名前が長い画面用。1行に収まらないときは切らずに折り返す(横画面の左の列は幅が狭い)
// ★戻るは 44×44px(p-3 + 20px)を確保し、押した手応え(active:scale-90)を必ず付ける。
//   「反応する戻る」と「反応しない戻る」が混ざっていると、押せていないように見える。
const ScreenHead = ({ title, icon = null, accent = 'text-white', accentStyle = null, note = '', onBack = null, backLabel = '戻る', right = null, disabled = false, compact = false, wrapTitle = false }) => (
  <header className={`mh-screen-head ${compact ? 'mb-1 pb-1' : 'mb-3 pb-2'} flex shrink-0 items-center gap-1.5 border-b border-white/10`}>
    {onBack && (
      <button type="button" aria-label={backLabel} onClick={onBack} disabled={disabled}
        className="mh-button mh-button-secondary -ml-1 shrink-0 p-3 text-slate-400 active:scale-90 disabled:opacity-30">
        <ArrowLeft size={20}/>
      </button>
    )}
    <div className="min-w-0 flex-1">
      {/* 折り返す見出しは言葉の切れ目で折る(「マスモン一覧(モンヒロ／ビート)」と名前の途中で折れていた・2026-10-26) */}
      <h2 className={`flex items-center gap-1.5 ${wrapTitle ? 'break-words' : 'truncate'} text-xl font-black italic leading-tight ${accent}`} style={accentStyle || undefined}>{icon}{wrapTitle && typeof title === 'string' ? <span className="min-w-0" style={JA_WRAP_STYLE}>{jaWrap(title)}</span> : title}</h2>
      {/* 注記は文字のときだけ言葉の切れ目で折る(2026-10-24。M/B管理「アシストカードは／ここ」と2字だけ落ちていた) */}
      {note && <p className="mh-screen-note mt-0.5 text-[10px] font-bold leading-snug text-slate-400" style={typeof note === 'string' ? JA_LABEL_STYLE : undefined}>{typeof note === 'string' ? jaWrap(note) : note}</p>}
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
// 6つ以上は2段に並べる(2026-10-04・ユーザー指摘「文字列が悪い」。7つを1段に並べると「アシス／ト」「アイコ／ン」と
// タブの文字が途中で割れていた)。4つまでは今までどおり1段、5つも1段のまま。
const tabColumnCount = (count) => (count > 5 ? Math.ceil(count / 2) : Math.max(1, count));
const ScreenTabs = ({ items = [], value, onChange, className = '' }) => (
  <div role="tablist" className={`mb-2 grid shrink-0 gap-2 ${className}`}
    style={{gridTemplateColumns:`repeat(${tabColumnCount(items.length)},minmax(0,1fr))`}}>
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

// 強化・超越強化・オート強化の切り替え(2026-10-05)。3つの画面がそれぞれ同じタブの行を手書きしていて、
// 選ばれている側の表し方(aria-current)・文字の色・枠がそろっていなかったので1つにする。
//   current … 'normal' / 'transcend' / 'auto'。いまの画面のタブは押しても何もしない
//   autoOn  … オート強化がONの個体なら、タブに小さな緑の点を付ける
// ★data-transcend-enhance-tabs は検査(masu/transcendence-check.js)が目印にしているので残す。
//   タブの文字は「通常強化」「超越強化」「オート強化」だけにする(検査が文字で押す)
const ENHANCE_MODE_TABS = Object.freeze([
  { id:'normal', label:'通常強化', color:'#f59e0b', idle:'text-amber-200' },
  { id:'transcend', label:'超越強化', color:'#0ea5e9', idle:'text-sky-200' },
  { id:'auto', label:'オート強化', color:'#84cc16', idle:'text-lime-200' },
]);
const EnhanceModeTabs = ({ current, onNormal, onTranscend, onAuto, autoOn = false }) => {
  const handlers = { normal:onNormal, transcend:onTranscend, auto:onAuto };
  return (
    <div data-transcend-enhance-tabs role="tablist" className="shrink-0 w-full max-w-md mx-auto mb-2 grid grid-cols-3 gap-2">
      {ENHANCE_MODE_TABS.map(tab => {
        const on = tab.id === current;
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={on} onClick={on ? undefined : handlers[tab.id]}
            className={`mh-tab min-h-[44px] rounded-xl px-1 text-[11px] font-black leading-tight flex items-center justify-center gap-1 ${on ? '' : `border border-white/10 bg-slate-900 active:scale-95 ${tab.idle}`}`}
            style={on ? { background:tab.color, color:'#0f172a' } : undefined}>
            {tab.label}{tab.id === 'auto' && autoOn && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-lime-400"/>}
          </button>
        );
      })}
    </div>
  );
};

// 「必要な量 / 持っている量 / 足りないときの一文」の3行(2026-10-05)。神殿の転生・超越で同じ3行が
// 手書きされ、「所持ダイヤ」「所持数」のように呼び名もそろっていなかったのでまとめる。
//   needLabel / haveLabel / shortLabel … 画面に出す言葉(「必要ダイヤ」「所持ダイヤ」「ダイヤが足りません」)
//   icon … 必要量の前に付ける絵。okClass … 足りているときの必要量の色
//   note … 必要量の下へ添える計算式など(省略可)
const CostRow = ({ needLabel, haveLabel, shortLabel, need, have, icon = null, okClass = 'text-amber-300', note = null }) => {
  const needCount = Math.max(0, Number(need) || 0), haveCount = Math.max(0, Number(have) || 0);
  return (<>
    <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">{needLabel}</span><span className={`font-black flex items-center gap-1 ${haveCount >= needCount ? okClass : 'text-red-400'}`}>{icon}{needCount.toLocaleString()}</span></div>
    {note}
    <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">{haveLabel}</span><span className="text-slate-300 font-black">{haveCount.toLocaleString()}</span></div>
    {haveCount < needCount && <div className="text-[10px] text-red-400 font-black">{shortLabel}（あと {(needCount - haveCount).toLocaleString()}）</div>}
  </>);
};

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
//   QuantityStepper  … 数を選ぶ -10/-1/数(直接打ち込める)/+1/+10 と MAX
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
// 言葉の切れ目で折る(2026-10-20 改善部の見直し M3「継/承」「攻/撃」「ガッツ上/限」「スライ/ド」)。
// 日本語は既定だとどの文字の間でも折れるので、幅ぴったりのときに言葉の途中で行が変わる。
// Intl.Segmenter で言葉の切れ目に印(U+200B)を入れ、JA_WRAP_STYLE(keep-all)で印の所だけで折る。
// 1行に入らない長い言葉だけは overflow-wrap:anywhere で折る(はみ出さない)。Segmenter の無い古い端末では今までどおり
let _jaSegmenter;
// jaWrapPoints: 折ってよい所に印(U+200B)を入れた文字。jaWrap はその印を <wbr> に変えて描く
// 吹き出しのいちばん狭い1行に入る字数。ジャックの吹き出しは字11pxで本文120px(吹き出し144px)、狭い画面は字10pxで112px(136px)。
// どちらも太字で10字入る(2026-10-24。69-screen-home.jsx の HOME_RAID_SAY_WIDTHS と、検査 tools/boot/ja-wrap-lines-check.js)
const JA_WRAP_LINE = 10;
// 文節の終わりになる言葉(このあとでは折ってよい)。助詞・句読点・閉じかっこ
// (「な」「か」「って」は「強くな|ければ」「いって|らっしゃい」のように言葉の途中にも来るので入れない)
const JA_PARTICLE_END = /(?:は|が|を|に|で|と|も|へ|や|から|まで|より|けど|ので|のに|ても|でも|には|では|とは|ね|よ|ぞ|の)$|[、。！？!?」』…‥〜～・)）》〉】〕%％\s]$/; // 記号は、ブラウザがそのあとを印が無くても折るので入れる
// 道具(Intl.Segmenter)が読み違えて途中で切る、よく使う言葉(この中では折らない。2026-10-26 社長「ストーリーやバトルカードとかでも変なとこで切れる」
//   「や/さしく」「ひと/とおり」「はね/返す」「しと/け」。検査 tools/boot/ja-wrap-word-check.js)
const JA_WORDS_KEEP = ['ひととおり', 'やさし', 'はね返', 'しとけ', 'しとく', 'ちょっと', 'いっしょ', 'やっぱ', 'おねがい', 'ありがと', 'ひとつ', 'ふたつ', 'みんな', 'ぜったい', 'いっぱい', 'もっと', 'ずっと', 'きっと', 'たくさん'];
const jaWrapPoints = (text) => {
  const s = String(text ?? '');
  if (!s) return s;
  try {
    if (_jaSegmenter === undefined) _jaSegmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
    if (!_jaSegmenter) return s;
    // 印(U+200B)は「ここで折ってよい」の意味。道具(Intl.Segmenter)の言葉の切れ目に入れ、次の所には入れない。
    // ・行の頭に来てはいけない字(「！」「、」「…」小さい字など)の前と、行の終わりに来てはいけない字(「「」「（」)の後ろ、空白の前後
    //   (印は禁則より強いので、入れると「きたわい／！」と折れる。2026-10-21)
    // ・「ご」「お」で始まる言葉の頭の1字のあと(「〜のご／ほうび」2026-10-21)
    // ・文節の途中(ひらがなで始まる区切りの手前が助詞・句読点でない所。「いけ|ませ|ん」)。1字の助詞は前の言葉につなぐ(「仲間|に」「これ|は」)
    //   ただし8字を超える文節は、中のよい所(「て・で」のあと、漢字・カタカナの前)で分ける
    // ・閉じかっこ・「？」「！」のすぐあとのひらがな(「』|って言った」「？|ってとき」。ブラウザはそこを印が無くても折るので、jaKeepWhole で包む)
    // ・顔文字(かっこの中に、かな・漢字・英数字・句読点以外の記号があるもの。(｡･ω･)ﾉﾞ・(っ`･ω･´)っﾌ など)の中。顔文字の手前では折ってよい
    // そのうえで、最後のかたまり(終わりの顔文字の手前)が1〜2字(✨・♡も)なら手前とつなぐ(「いってらっしゃ／い〜」「であるぞ／！」)。
    // 2026-10-24: 1字のひらがなを広くつなげた形(#3487)は、かたまりが長くなり狭い吹き出しでかえって崩れたのでやめた。
    //   助手とジャックの台詞を全部、幅90〜300pxで描いて数える検査は tools/boot/ja-wrap-lines-check.js(最後の行が1〜2字・言葉の途中で折れた: 0件)
    // 長さは句読点・記号も含めた見た目の字数で数える(「伝えてほしいでつ。」は字が8でも、句点を入れると9字ぶんの幅)
    const visible = (t) => [...t.replace(/\s/g, '')].length;
    const letters = (t) => (t.match(/[ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9０-９Ａ-Ｚａ-ｖｘ-ｚ]/g) || []).length; // 笑いの「ｗ」は字に数えない
    const kao = [];
    for (const m of s.matchAll(/(?:ε-|[٩«ヾ＼ｦ-ﾟ])*[(（][^()（）\n]{1,14}[)）][っو۶»ﾉﾞ✧･‼❗!！\uFE0F]*/g)) {
      if (/[^ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9０-９\s、。・！？!?()（）]/.test(m[0])) kao.push([m.index, m.index + m[0].length]);
    }
    const inKao = (pos) => kao.some(([a, b]) => pos > a && pos < b);
    const keepWords = [];
    for (const w of JA_WORDS_KEEP) for (let i = s.indexOf(w); i >= 0; i = s.indexOf(w, i + 1)) keepWords.push([i, i + w.length]);
    const inKeepWord = (pos) => keepWords.some(([a, b]) => pos > a && pos < b);
    // 道具が空白と「(」を1つの区切りにすることがあるので、空白のすぐあとから顔文字が始まる所も「始まり」とみなす
    const kaoStart = (pos) => kao.some(([a]) => pos === a || (a > pos && /^\s+$/.test(s.slice(pos, a))));
    const segs = [];
    for (const { segment } of _jaSegmenter.segment(s)) {
      // 道具は「これは|いけません」を「これ|はい|けませ」と、返事の「はい」に読むことがある。指す言葉のあとの「は〜」は「は」で分け直す
      if (/^は[ぁ-ゖ]/.test(segment) && /^(?:これ|それ|あれ|どれ|ここ|そこ|あそこ|わたし|あたし|ワシ|吾輩|余)$/.test(segs[segs.length - 1] || '')) segs.push('は', segment.slice(1));
      else segs.push(segment);
    }
    // ① 文節ごとにまとめる。かたまりは区切りの並び(parts)と、区切りごとの「固い(hard)・柔らかい(soft)」を持つ。
    //   固い: 禁則・顔文字の中・空白の前後(ここでは切らない)。柔らかい: 文節や助詞の規則でつないだ所(長すぎるときだけ切る)
    const groups = [];
    let pos = 0;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (i === 0) { groups.push({ parts: [seg], hard: [] }); pos += seg.length; continue; }
      const prev = segs[i - 1], g = groups[groups.length - 1], cur = g.parts.join('');
      const hard = inKao(pos) || inKeepWord(pos) || (!kaoStart(pos) && (
        /^[\s、。，．,.！？!?」』）)】〕〉》…‥ー〜～・：:；;ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ]/.test(seg) || /[\s「『（(【〔〈《]$/.test(prev)
        // 「お」「ご」のあとは、ひらがなでも漢字でも離さない(「〜のご／ほうび」「お／相手」2026-10-26)
        || (/^[ごお]$/.test(prev) && /^[ぁ-ゖ一-龯]/.test(seg))
        // 笑いの「笑」「w」だけを次の行の頭に落とさない(「楽しもうぜ／笑」「〜だって！／w」)
        //   (「笑っちゃう」の「笑」は言葉なので、あとが文の終わり・空白・記号・w のときだけ)
        || (/^(?:笑+|[ｗwW]+)$/.test(seg) && /^(?:$|[\s！？!?。、♪✨ｗwW〜～…)）])/.test(s.slice(pos + seg.length)))
        // くっついた言葉(「読み|合い」「組み|直した」「起き|上がる」「吹っ|飛ばす」)。漢字+送り仮名のすぐあとの漢字は離さない(「少し」は1語なので除く)。
        //   長い文節を分ける②でもここでは分けない(柔らかくつなぐと「噛み／合わない」と分けられた)
        //   道具は「噛|み|合わ」と細かく分けるので、すぐ前の区切りではなく、それまでにまとめた文節(cur)の終わりで見る
        || (/[一-龯][きしちひみりっ]$/.test(cur) && !/少し$/.test(cur) && /^[一-龯]/.test(seg))
        || (/[」』？！?!]$/.test(prev) && /^[ぁ-ゖ笑ｗwW]/.test(seg))
        // 数とそのあとの助数詞・単位は離さない(「1／曲ずつ」「5／倍」「30／%」「3回／目」。2026-10-26 クラフト)。
        //   手前の「Lv.」「×」「約」「第」と数も離さない(「Lv.／12」「約／20秒」)
        || (/[0-9０-９]$/.test(prev) && /^(?:[曲回枚人体つ個周倍秒分日週件位番本段字連万千百年月時%％]|時間|ms|px|P|Lv|コンボ|ノーツ|ビートP)/.test(seg))
        || (/[0-9０-９][回人体個枚曲周倍つ番件位本段連]$/.test(cur) && /^目/.test(seg))
        || (/(?:Lv\.?|LV\.?|×|x|約|第|全|各|計|最大|最高)$/.test(cur) && /^[0-9０-９]/.test(seg))
        // カタカナどうしの間は離さない。道具は造語を「マス|モン」「モン|ヒロ|ビート」と分ける(2026-10-26 ダメダシ「(モンヒロ／ビート)」)。
        //   合わせて7字まで(「ファームバトルカード」のように長いものまでつなぐと1行に入らず、字の途中で折れる)。
        //   かぎかっこの中は名前ごと包む決まり(jaWrapPieces)に任せる(つなぐと「「フリーマッチ」／と……」と最後の行に字が残った)
        || (/[ァ-ヶー]$/.test(prev) && /^[ァ-ヶ]/.test(seg) && !/[「『][^」』]*$/.test(cur) && (cur.match(/[ァ-ヶー]+$/) || [''])[0].length + (seg.match(/^[ァ-ヶー]+/) || [''])[0].length <= 7)));
      const soft = !hard && !kaoStart(pos) && (
        // 数の並び「2・4・6」は「・」のあとでも折らない(「WAVE2・／4・6で」と折れた。2026-10-26 見回り ヘルプ記事 320)。長い並び(「3・5・7・9・10」)は②で中を分ける
        (/[0-9０-９]・$/.test(cur) && /^[0-9０-９]/.test(seg))
        ||         (/^[ぁ-ゖ]$/.test(seg) && /[一-龯ァ-ヶー]$/.test(prev) && letters(cur) + 1 <= 6)
        || (/^[はがをにでとものへ]$/.test(seg) && /[ぁ-ゖ]$/.test(prev))
        // ひらがなで始まる区切りは、手前が助詞・句読点のときだけ折る(文節で折る)。活用の途中(「いけ|ませ|ん」「強|く|な|け|れ|ば」「聞い|てい」)では折らない
        || (/^[ぁ-ゖ]/.test(seg) && !JA_PARTICLE_END.test(prev))
        // カタカナどうしで片方が1字の区切りは、道具が1語を割ったもの(「レ|ア」)。「モンスター|ファーム|バトル」のような長い言葉の区切りは残す
        || (/^[ァ-ヶー]+$/.test(seg) && /^[ァ-ヶー]+$/.test(prev) && (seg.length === 1 || prev.length === 1))
        // お金の名前「カードポイント」「ビートポイント」「ブリーダーポイント」は1語(2026-10-24 改善部の点検 V4「カード/ポイント」と折れた)
        || (/(?:カード|ビート|ブリーダー)$/.test(prev) && /^ポイント/.test(seg))
        // 「ビートP」「ブリーダーP」も1語(2026-10-26 見回り「ビート/P」と折れた。カードの売り場の吹き出し)
        || (/(?:ビート|ブリーダー)$/.test(prev) && /^P/.test(seg))
        // カタカナのすぐあとの英字も1語(「ビート|Lv」2026-10-26)
        || (/[ァ-ヶー]$/.test(prev) && /^[A-Za-zＡ-Ｚ]/.test(seg))
        // 1字の漢字のすぐあとの1字のひらがなは、助詞ではなく送り仮名(「強|が|らなくても」「強|く|なければ」)
        || (/^[ぁ-ゖ]/.test(seg) && /^[ぁ-ゖ]$/.test(prev) && /^[一-龯]$/.test(segs[i - 2] || ''))
        // 「です・でつ・でしょ」の「で」は助詞ではない(「なんで|すか」「しないで|つよ」と折れた)
        || (/で$/.test(prev) && /^(?:す|つ|しょ)/.test(seg)));
      if (hard || soft) { g.parts.push(seg); g.hard.push(hard); } else groups.push({ parts: [seg], hard: [] });
      pos += seg.length;
    }
    // ①-2 終わりの顔文字(とそのうしろの「ﾌﾚｰｯ!」「ﾌﾞﾌｫｗ」のような、かな・漢字の無い飾り)は飛ばして、その手前の本文の最後の文節が
    //   1〜2字(✨・♡も)なら手前とつなぐ(「いってらっしゃ／い〜」「であるぞ／！」)。長くなりすぎたら②で、語尾が短く残らない所で分け直す
    {
      const gText = (g) => g.parts.join('');
      // 終わりから、顔文字と、かな・漢字の無い飾りを全部飛ばす(顔文字が2つ続く「(｡ ˘-˘)(｡ ˘_˘)ｳﾝｳﾝ」もある)
      let at = s.length, k = groups.length - 1, sawKao = false;
      while (k > 0) {
        const t = gText(groups[k]), from = at - t.length;
        if (kaoStart(from)) sawKao = true; else if (/[ぁ-ゖァ-ヶ一-龯]/.test(t)) break;
        at = from; k--;
      }
      let end = sawKao ? k : groups.length - 1;
      // 漢字で始まる最後の文節(「押す。」)は語尾ではなく言葉なので、つなぐと1行(10字)を超えるならつながない(1行に入らなくなる)
      while (end > 0 && letters(gText(groups[end])) <= 2
        && !(/^[一-龯]/.test(gText(groups[end])) && visible(gText(groups[end - 1]) + gText(groups[end])) > JA_WRAP_LINE)) {
        const t = groups[end], h = groups[end - 1];
        h.hard.push(false, ...t.hard); h.parts.push(...t.parts); groups.splice(end, 1); end--;
      }
    }
    // ② 長すぎる文節を中で分ける。吹き出しの本文はいちばん狭くて約104〜112px(10字ほど)なので、10字を超えると1行からはみ出して
    //   ブラウザに好きな所で折られる(「冷めてしまいます／ぞ」)。柔らかい区切りのうち、「て・で」のあと(冷めて|しまいますぞ)、
    //   漢字・カタカナの前、の順に選ぶ。どちらの側も3字以上残し、なるべく真ん中で。空白は元から折れるので、空白で分けた部分ごとに数える
    const runLetters = (parts) => Math.max(...parts.join('').split(/\s+/).map(visible));
    // 小さい「っ」のあとにひらがなが続く所(「終わっちゃっ|たら」「なっ|た」)は言葉の途中なので、ここでは分けない(2026-10-26 カゲあつくんの点検)
    const midSokuon = (parts, k) => /っ$/.test(parts[k - 1]) && /^[ぁ-ゖ]/.test(parts[k]);
    const chunks = [];
    const split = (g) => {
      if (runLetters(g.parts) <= JA_WRAP_LINE || g.parts.length < 2) { chunks.push(g.parts.join('')); return; }
      const total = visible(g.parts.join(''));
      let best = -1, bestScore = -1;
      for (let k = 1; k < g.parts.length; k++) {
        if (g.hard[k - 1] || midSokuon(g.parts, k)) continue;
        const left = visible(g.parts.slice(0, k).join('')), right = total - left;
        // どちらの側にも字(かな・漢字)を3字以上残す。決まった言い方(「いって|らっしゃい」)の中では分けない
        if (letters(g.parts.slice(0, k).join('')) < 3 || letters(g.parts.slice(k).join('')) < 3 || /^らっしゃ/.test(g.parts.slice(k).join(''))) continue;
        const score = (/[てで]$/.test(g.parts[k - 1]) ? 300 : /^[一-龯ァ-ヶ]/.test(g.parts[k]) ? 200 : 100) - Math.abs(left - right);
        if (score > bestScore) { bestScore = score; best = k; }
      }
      // 3字ずつ残せる所が無ければ、前だけ2字まで許す(「二度|おいしいってやつ。」)。後ろ(語尾)は3字を守る
      if (best < 0) for (let k = 1; k < g.parts.length; k++) {
        if (g.hard[k - 1] || midSokuon(g.parts, k)) continue;
        const left = visible(g.parts.slice(0, k).join('')), right = total - left;
        // 後ろは字が3字以上か、句読点も入れて4字以上(「せいいっぱい|でつ……。」)
        if (letters(g.parts.slice(0, k).join('')) < 2 || (letters(g.parts.slice(k).join('')) < 3 && right < 4) || /^らっしゃ/.test(g.parts.slice(k).join(''))) continue;
        if (100 - Math.abs(left - right) > bestScore) { bestScore = 100 - Math.abs(left - right); best = k; }
      }
      if (best < 0) { chunks.push(g.parts.join('')); return; }
      split({ parts: g.parts.slice(0, best), hard: g.hard.slice(0, best - 1) });
      split({ parts: g.parts.slice(best), hard: g.hard.slice(best) });
    };
    groups.forEach(split);
    // 道具が1語にした長いもの(「スパルタっていう」「チュートリアルって」)は、カタカナからひらがなへ変わる所で分ける
    for (let k = 0; k < chunks.length; k++) {
      const m = chunks[k].match(/^(.*[ァ-ヶー])([ぁ-ゖ].*)$/s);
      // 境目を含む部分(空白で区切った中)が7字を超えるときだけ分ける
      if (m && visible(m[1].split(/\s/).pop() + m[2].split(/\s/)[0]) > 7 && letters(m[1]) >= 2 && letters(m[2]) >= 2) chunks.splice(k, 1, m[1], m[2]);
    }
    return chunks.join('​');
  } catch { return s; }
};
// 丸ごと包むのは、吹き出しのいちばん狭い1行(本文104〜112pxで約10字)に入るものだけ(長いと字が吹き出しの外へ出る)。字の無い顔文字だけは14字まで
const jaKeepWhole = (seg) => ([...seg].length <= JA_WRAP_LINE || (!/[ぁ-ゖァ-ヶ一-龯A-Za-z0-9]/.test(seg) && seg.length <= 14))
  && (/[…‥～〜♡]/u.test(seg) || /[0-9０-９]・[0-9０-９]/.test(seg) /* 数の並び「2・4・6」。ブラウザは「・」のあとで折る */ || /\p{Extended_Pictographic}/u.test(seg) || /[」』？！?!][ぁ-ゖ笑ｗwW]/.test(seg) || /[。、][ぁぃぅぇぉっゃゅょ]/.test(seg)
  || !/[ぁ-ゖァ-ヶ一-龯A-Za-z0-9]/.test(seg) || /[(（][^()（）]*[^ぁ-ゖァ-ヶ一-龯ーA-Za-z0-9０-９\s、。・！？!?()（）][^()（）]*[)）]/.test(seg));
// かたまり1つを、折らない枠で包む所([字, true])とそのままの所([字, false])に分ける(jaWrap と検査 ja-wrap-lines-check.js が使う)。
// 空白で分けてから部分ごとに決める(空白をまたいで包むと、「大丈夫！ いってらっしゃい〜」が1行のまま吹き出しからはみ出した。2026-10-24)。
// 長い部分(「『MONSTERS』で」)は、かぎかっこの名前や、閉じかっこ・？・！とその前後の字だけを包む。「。って」「、っぽい」も(ブラウザは句点のあとを折る)。
// 「でつ……。」の三点リーダー、「……？💦」の終わりの絵文字も、手前の数字といっしょに包む(ブラウザはその手前を折る)
const JA_WRAP_TIGHT = /([「『][^「」『』\s]{1,8}[」』][ぁ-ゖ]{0,6}[！？!?、。…‥]*|(?:[ァ-ヶー]+|.)[」』？！?!][ぁ-ゖ笑ｗwW]{1,6}[！？!?、。…‥]*|.[。、][ぁぃぅぇぉっゃゅょ][ぁ-ゖ]{0,5}[！？!?、。…‥]*|[^\s…‥]{1,6}[…‥]+[。、！？!?]*(?:\p{Extended_Pictographic}|[♪♡✨])*\uFE0F?|[^\s]{1,3}[！？!?…]*(?:\p{Extended_Pictographic}|[♪♡✨])+\uFE0F?)/u;
const jaWrapPieces = (seg) => {
  const out = [];
  // 顔文字のかっこの中の空白((｡ ˘ω˘))では分けない
  for (const part of String(seg).split(/(\s+)(?![^(（]*[)）])/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) out.push([part, false]);
    else if (jaKeepWhole(part)) out.push([part, true]);
    // かぎかっこの名前は「「」からまとめて包む(「「ドラシ／ル」だって」と名前の中で折れた)。1行(10字)に入らないものは包まず、閉じかっこのあとで折れるのに任せる
    else if (/[」』？！?!][ぁ-ゖ笑ｗwW]|[。、][ぁぃぅぇぉっゃゅょ]|[…‥]|\p{Extended_Pictographic}|[♪♡✨]/u.test(part)) part.split(JA_WRAP_TIGHT).forEach((t, k) => {
      if (!t) return;
      if (k % 2 === 0 || [...t].length <= JA_WRAP_LINE) { out.push([t, k % 2 === 1]); return; }
      // 10字を超える「かぎかっこの名前+あとの字」は、名前だけを包む(「「チュートリア／ル」から」と名前の中で折れた)
      const m = t.match(/^([「『][^「」『』]+[」』])(.*)$/s);
      if (m && [...m[1]].length <= JA_WRAP_LINE) out.push([m[1], true], [m[2], false]); else out.push([t, false]);
    });
    else out.push([part, false]);
  }
  return out;
};
const jaWrap = (text) => {
  // 文字でない物が来たときの守り(2026-10-27 MFバトルカードのトップの吹き出しに「[object Object]」が出た)。
  //   画面の部品(React の要素)はそのまま出す。{ text } の形なら text を使う。ほかは出さない
  if (text && typeof text === 'object') {
    if (React.isValidElement(text) || Array.isArray(text)) return text;
    text = typeof text.text === 'string' ? text.text : '';
  }
  const s = jaWrapPoints(text);
  if (typeof s !== 'string' || !s.includes('\u200B')) return s;
  // ブラウザは「…」「～」「♡」・絵文字・顔文字の手前や中を、印が無くても折り目として扱う。「入れんのじゃ／……」「(っ`･／ω･´)」と
  // 崩れないよう、それを含む14字までのかたまりは折らずに置く(2026-10-24。見えない字は足さない)
  const keep = (t, k) => <span key={k} data-ja-keep style={{ whiteSpace: 'nowrap' }}>{t}</span>;
  // 空白で始まるかたまりの手前には印(<wbr>)を置かない。空白はもともと折れるうえ、「折らない枠」+<wbr>+「空白で始まる字」の並びで
  // Chromium が落ちた(行の長さをそろえる text-wrap: balance・pretty のとき。2026-10-24 台詞「本当に極限…！ (>人<;)」で見つけた)
  return s.split('\u200B').map((seg, i) => <React.Fragment key={i}>{i > 0 && !/^\s/.test(seg) && <wbr/>}{jaWrapPieces(seg).map(([t, kp], k) => (kp ? keep(t, k) : t))}</React.Fragment>);
};
// 太字(<b>)などが混ざった文用。文字の部分だけを jaWrap に通す(2026-10-26 マスモン設定「金色のノー／ツに」)。JA_WRAP_STYLE と一緒に使う
const jaWrapParts = (...parts) => parts.map((p, i) => <React.Fragment key={i}>{typeof p === 'string' ? jaWrap(p) : p}</React.Fragment>);
// textWrap:'wrap' … 画面全体の text-wrap:pretty(index.html)と anywhere が組み合わさると、語の中へ1字だけ動かすことがある(「スキッ／プ」)ので外す
const JA_WRAP_STYLE = Object.freeze({ wordBreak: 'keep-all', overflowWrap: 'anywhere', textWrap: 'wrap' });
// 短い説明・札向け(2026-10-21 社長決定・改善部の見直しの洗い出し)。言葉の切れ目で折り、行の長さもそろえる
// (「音が出ないと／き」「得意な曲を／見る」のように、最後の行に1〜2字だけ残らない)。jaWrap と一緒に使う
const JA_LABEL_STYLE = Object.freeze({ ...JA_WRAP_STYLE, textWrap: 'balance' });
// 大きな所持数を縮めて出す(2026-10-21 改善部の見直し N5「ダイヤが10桁になると HOME(320)の数が約6px まで縮む」)。
// 8桁まではそのまま(1,234,567 のように)。9桁(1億)からは「1.23億」「67.3億」「6,736億」、13桁からは「兆」で、上から3桁ぶん。
// 切り上げると持っていない数に見えるので、端は切り捨てる。保存値は変えない(出し方だけ)
const compactCount = (value) => {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n);
  if (a < 1e8) return n.toLocaleString();
  const [unit, div] = a >= 1e12 ? ['兆', 1e12] : ['億', 1e8];
  const v = a / div, digits = v >= 100 ? 0 : v >= 10 ? 1 : 2, f = Math.pow(10, digits);
  return `${n < 0 ? '-' : ''}${(Math.floor(v * f) / f).toLocaleString(undefined, { maximumFractionDigits: digits })}${unit}`;
};
// 縮めた数。押すと細かい数が小さな札で出る(2.5秒で消える)。縮めていないときはふつうの字のまま
const CompactCount = ({ value, className = '', style }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => { if (!open) return undefined; const t = setTimeout(() => setOpen(false), 2500); return () => clearTimeout(t); }, [open]);
  const exact = (Math.floor(Number(value)) || 0).toLocaleString();
  const text = compactCount(value);
  if (text === exact) return <b className={className} style={style}>{text}</b>;
  return <b role="button" tabIndex={0} data-compact-count={exact} aria-label={exact} title={exact} className={`${className} relative cursor-pointer`} style={style}
    onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}>
    {text}{open && <span data-compact-count-exact className="absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded-lg border border-amber-300/60 bg-slate-950 px-2 py-1 text-[12px] font-black text-amber-200 shadow-lg">{exact}</span>}
  </b>;
};
// ノーツの見本の絵(2026-10-21 社長「見た目とかちゃんとわかるようにしてほしい」)。ヘルプの表と助手のおしゃべりで使う。
// 絵は演奏画面と同じ描き方(data/rhythm-mode.js の rhythmDrawNoteSwatch)で描く。手描きの絵や写真は使わない。kind は RHYTHM_NOTE_SWATCH_KINDS の id
const RhythmNoteSwatch = ({ kind, width = 54, height = 42, className = '' }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c || typeof rhythmDrawNoteSwatch !== 'function') return;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    c.width = Math.round(width * dpr); c.height = Math.round(height * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
    rhythmDrawNoteSwatch(g, kind, width, height);
  }, [kind, width, height]);
  const label = ((typeof RHYTHM_NOTE_SWATCH_KINDS !== 'undefined' ? RHYTHM_NOTE_SWATCH_KINDS : []).find(k => k.id === kind) || {}).label || kind;
  return <canvas ref={ref} data-rhythm-note-swatch={kind} role="img" aria-label={`${label}の見た目`} className={className} style={{ display: 'block', width, height }} />;
};
// 数を直接打ち込む欄(2026-10-19 社長「マーケットのアイテムは直接数値入力で買えるようにしよう！」、
// 2026-10-20「個数系のやつは基本的に直接入力があったほうがいいね」)。★個数・回数・枚数を選ぶ所は、この欄を使う
//   (−/＋/MAX のボタンは呼ぶ側に並べたまま。tools/boot/count-input-check.js が見張る)
// ・数字のキーボード(inputMode=numeric)。字は20px(16px未満だと iPhone で欄を押したときに画面が拡大される)
// ・打っている途中でも、数として読めたら min〜max にそろえてすぐ onChange へ渡す(合計などの表示が追いつく)
// ・空・min未満のあいだは min として数え、max を超えたら max にそろえる。小数は点より前だけ。全角数字も読む
// ・欄に出すのは、打った字がいまの数と合うときだけ打った字、合わなければいまの数(−/＋ を押したら数が出し直される)
const countInputClamp = (n, min, max) => Math.min(Math.max(min, n), Math.max(min, max));
const CountInput = ({ value, max, min=1, onChange, unit='', label='数', className='', disabled=false, dataAttrs={} }) => {
  const safeMin=Math.max(0, Math.floor(Number(min)||0));
  const safeMax=Math.max(0, Math.floor(Number(max)||0));
  const current=countInputClamp(Math.floor(Number(value)||safeMin), safeMin, safeMax);
  const [draft,setDraft]=React.useState(null);
  const readDraft=(raw)=>{
    const digits=String(raw||'').split(/[.,．。]/)[0].replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[^0-9]/g,'');
    const n=parseInt(digits,10);
    return { digits, n:Number.isFinite(n)?n:null };
  };
  const type=(raw)=>{
    const { digits, n }=readDraft(raw);
    if(n!==null&&n>Math.max(safeMin,safeMax)) { const top=Math.max(safeMin,safeMax); setDraft(String(top)); onChange&&onChange(top); return; }
    setDraft(digits);
    onChange&&onChange(countInputClamp(n===null?safeMin:n, safeMin, safeMax));
  };
  const draftMatches=draft!==null&&countInputClamp(readDraft(draft).n??safeMin, safeMin, safeMax)===current;
  return <input type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" data-quantity-input {...dataAttrs}
    aria-label={`${label}（${safeMin.toLocaleString()}〜${Math.max(safeMin,safeMax).toLocaleString()}${unit}）`}
    disabled={disabled||safeMax<safeMin||safeMax<=0} value={draftMatches?draft:String(current)} onChange={(e)=>type(e.target.value)}
    onFocus={(e)=>e.target.select()} onBlur={()=>setDraft(null)} onKeyDown={(e)=>{ if(e.key==='Enter') e.currentTarget.blur(); }}
    style={{fontSize:20}} className={`min-h-[44px] min-w-0 rounded-xl border border-white/20 bg-black/40 px-1 text-center font-black font-mono text-white outline-none focus:border-amber-300 disabled:opacity-40 ${className}`}/>;
};
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
      <CountInput value={count} max={safeMax} onChange={setCount} unit={unit} className="w-full"/>
      <button type="button" disabled={count>=safeMax} onClick={()=>setCount(count+1)} className={stepClass}>+1</button>
      <button type="button" disabled={count>=safeMax} onClick={()=>setCount(count+10)} className={stepClass}>+10</button>
    </div>
    <button type="button" disabled={safeMax<=0} onClick={()=>setCount(safeMax)} className={`mh-button mh-button-secondary mt-2 min-h-[44px] w-full rounded-xl font-black active:scale-95 disabled:opacity-30 ${maxClass}`}>MAX（{safeMax.toLocaleString()}{unit}）</button>
  </>;
};
// 名前を入れる窓(2026-10-05)。ブリーダー名とマスモンの名前の窓が、ほぼ同じ作りで別々に手書きされ、
// ボタンが44pxに届かず、取りやめが「戻る」になっていた。外側を押すと取りやめる。
//   zIndex … 呼ぶ側の重なり順をそのまま渡す(値は変えない。窓どうしの前後が変わるため)
const NameEditModal = ({ title, value, onChange, maxLength, onCancel, onSave, border = 'border-indigo-400/70', zIndex = MODAL_Z.dialog }) => (
  <ModalFrame label={title} border={border} onClose={onCancel} narrow zIndex={zIndex}>
    <h3 className="text-center text-base font-black text-white">{title}</h3>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} maxLength={maxLength} aria-label={title}
      onKeyDown={e => { if (e.key === 'Enter') onSave(); }}
      className="mt-3 w-full min-h-[48px] rounded-xl border border-slate-600 bg-black/50 p-3 text-center font-bold text-white outline-none focus:border-amber-300"/>
    <p className="mt-1 text-right text-[10px] font-bold text-slate-500">{String(value || '').length} / {maxLength}文字</p>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <ModalCloseButton onClick={onCancel} label="やめる"/>
      <button type="button" onClick={onSave} className="mh-button mh-button-primary min-h-[48px] rounded-2xl font-black active:scale-[.98]">保存</button>
    </div>
  </ModalFrame>
);
// 確認の窓。title は問いかけ、message は何が起きるか(取り消せるかどうかも書く)。
// danger のときは決定ボタンを危険な操作の型(mh-button-danger)にする(削除など、元に戻せない操作)
const ConfirmSheet = ({ title, message='', confirmLabel='OK', danger=false, onConfirm, onCancel }) => (
  <ModalFrame label={title} border={danger?'border-red-400/70':'border-amber-400/70'} onClose={onCancel} zIndex={MODAL_Z.confirm}>
    <h3 data-confirm-sheet className={`text-center text-base font-black leading-snug ${danger?'text-red-200':'text-amber-200'}`}>{title}</h3>
    {message&&<p className="mt-3 whitespace-pre-line text-[12px] font-bold leading-relaxed text-slate-200">{message}</p>}
    <div className="mt-4 grid grid-cols-1 gap-2">
      <button type="button" onClick={onConfirm} className={`mh-button ${danger?'mh-button-danger':'mh-button-primary'} min-h-[52px] rounded-2xl font-black active:scale-[.98]`}>{confirmLabel}</button>
      <ModalCloseButton onClick={onCancel} label="やめる"/>
    </div>
  </ModalFrame>
);

// ==================== 強化フェーズ(WAVEクリア後の画面)の共通部品 ====================
// WAVEをクリアしてから次のバトルが始まるまでに、トレーニング・供モン・配置・固有技・
// アシストカードの画面が WAVE によって 1〜5 枚続く。どこまで進んで、あと何枚あるのかが
// 分からなかったので、各画面の上に同じ形の並びを出す(並びは postWavePhasePlan が組む)。
// 画面ごとの識別色もここで決める(背景の光・並びの「いまここ」の色)。
const PHASE_STEP_LABELS = Object.freeze({
  training:'トレーニング', growth:'自動成長', ally:'供モン', slot:'配置', skill:'固有技', teaching:'アシストカード', hero:'勇者モン',
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
  const holderRef = React.useRef(null);
  React.useEffect(() => {
    let reduce = false;
    try { reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    // バトル設定の「数字が増える動き」がオフのときは、最初から最後の値を出す
    try { if (holderRef.current && holderRef.current.closest('[data-mh-count-up="OFF"]')) reduce = true; } catch (e) {}
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
  return <span ref={holderRef}>{format ? format(value) : value}</span>;
};
// 「いくつから いくつへ」の1項目。元の値を小さく、新しい値を大きく(増えたぶんは駆け上がる)、増えた量を「+○○」で出す。
const PhaseGrowthCell = ({ row, d = 0, countMs = 900, compact = false, single = false }) => {
  const st = TRAINING_FX_STATS[row.key] || TRAINING_FX_STATS.hp;
  const Icon = { Heart, Sword, ShieldCheck, Sparkles }[st.Icon];
  const diff = row.after - row.before;
  // 1体ぶんの値だけを見せる形(タクティクスの合流など「元の値から増える」ものが無いとき)。0から値までを数える
  if (single) return (
    <div className="mh-ph-cell rounded-lg px-1 py-1.5 text-center font-mono">
      <span className="flex items-center justify-center gap-0.5 text-[8px] font-black text-slate-400 leading-none"><span className={st.tint}><Icon size={9}/></span>{row.label}</span>
      <span className={`mh-train-num block mt-1 font-black leading-tight ${compact ? 'text-[15px]' : 'text-[22px]'} ${st.tint}`} style={{'--d': `${d + countMs}ms`, '--glow': st.glow}}>
        <TrainingCountUp from={0} to={row.after} delay={d} duration={countMs}/>
      </span>
    </div>
  );
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
        <div className="text-[9px] font-bold text-sky-100/80 leading-snug whitespace-pre-line">{helpWrap(effect.guard.text)}</div>
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
        <div className="relative mb-1 text-left text-[9px] font-black text-[#f3d27a]">{effect.single ? `${effect.name}のステータス` : 'パーティのステータス'}</div>
        <div className="relative grid grid-cols-4 gap-1.5">
          {rows.map((row, ri) => <PhaseGrowthCell key={row.key} row={row} d={450 + ri * 110} countMs={countMs} single={!!effect.single}/>)}
        </div>
        {effect.apt && <div className="mh-train-gain relative mt-1.5 text-center text-[10px] font-black text-cyan-300" style={{'--d': '1000ms'}}>{effect.single ? 'この子の間合い適性' : '間合い適性'} {effect.apt}</div>}
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
      <div className="flex items-center gap-2" aria-hidden="true" style={{'--mh-rc': '192,132,252', '--mh-rc2': '233,213,255'}}>
        {Array.from({ length: (effect.maxLevel || 2) + 1 }).map((_, i) => (
          <i key={i} className={`mh-ph-pip${i === effect.toLevel ? ' mh-train-gain' : ''}`} data-on={i <= effect.toLevel ? '' : undefined} style={i === effect.toLevel ? {'--d': '450ms'} : undefined}/>
        ))}
      </div>
      <div className="mh-train-gain text-[12px] font-black text-purple-200" style={{'--d': '450ms'}}>{isUpgrade ? `Lv.${effect.fromLevel} → Lv.${effect.toLevel} に強化！` : '新しく習得しました！'}</div>
      {effect.desc && <div className="mh-train-card mh-ph-panel w-full max-w-sm rounded-2xl px-3 py-2 text-[11px] font-bold leading-snug text-slate-100" style={{'--d': '300ms'}}>{helpWrap(effect.desc)}</div>}
    </div>
  );
};

// ==== 固有技を強化したあとの演出 ====
// 強化の画面から「アシストカードへ」進むときに、レベルが上がった技ごとに「Lv.いくつからいくつへ」と
// 技威力・消費ガッツの変化を見せる。段の目盛りは、上がった段が1つずつ光る。
//   effect … { changes:[{ key, monName, skillName, iconUrl, emoji, from, to, powerBefore, powerAfter, gutsBefore, gutsAfter }], ms }
const SkillResultFx = ({ effect }) => {
  const changes = Array.isArray(effect?.changes) ? effect.changes : [];
  const total = Math.max(600, Number(effect?.ms) || 2200);
  const countMs = Math.max(250, Math.min(900, Math.round(total * 0.35)));
  const compact = changes.length >= 3;
  return (
    <div data-skill-result-fx className="mh-phase mh-ph-bg absolute inset-0 flex flex-col items-center justify-center gap-3 p-3 overflow-hidden" style={{'--ph':'245,158,11'}}>
      <div className="shrink-0 flex flex-col items-center gap-1">
        <span className="mh-ph-plate">UNIQUE SKILL</span>
        <div className="mh-ph-heading"><h2 className="mh-ph-title mh-train-title text-3xl font-black italic uppercase tracking-tighter leading-none">SKILL UP!</h2></div>
      </div>
      <div className={`w-full max-w-sm min-h-0 flex flex-col ${compact ? 'gap-1.5' : 'gap-2.5'}`}>
        {changes.map((c, ci) => {
          const base = 300 + ci * 260;
          return (
            <div key={c.key} className="mh-train-card mh-ph-panel relative overflow-hidden rounded-2xl px-3 py-2" style={{'--d': `${ci * 260}ms`}}>
              <span aria-hidden="true" className="mh-train-sweep" style={{'--d': `${base + 150}ms`}}/>
              <div className="relative flex items-center gap-2.5">
                <span className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} shrink-0 overflow-hidden rounded-full border border-white/15 bg-black/40 flex items-center justify-center`}>
                  {c.iconUrl ? <img src={c.iconUrl} alt="" className="h-full w-full object-cover"/> : <span className="text-xl">{c.emoji || '⚡'}</span>}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <div className="truncate text-[9px] font-black text-amber-300 leading-tight">{c.monName}</div>
                  <div className={`truncate font-black text-white leading-tight ${compact ? 'text-[12px]' : 'text-[14px]'}`}>{c.skillName}</div>
                </div>
                <div className="shrink-0 text-right font-mono">
                  <div className="text-[9px] font-black text-slate-500 leading-tight">Lv.{c.from} →</div>
                  <div className="mh-train-num text-[20px] font-black text-amber-300 leading-tight" style={{'--d': `${base + 500}ms`, '--glow': '251,191,36'}}>Lv.{c.to}</div>
                </div>
              </div>
              <div className="relative mt-1.5 flex items-center gap-[6px] pl-0.5" aria-hidden="true" style={{'--mh-rc': '245,158,11', '--mh-rc2': '255,240,160'}}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <i key={i} className={`mh-ph-pip${i >= c.from && i < c.to ? ' mh-train-gain' : ''}`} data-on={i < c.to ? '' : undefined} style={i >= c.from && i < c.to ? {'--d': `${base + 200 + (i - c.from) * 150}ms`} : undefined}/>
                ))}
              </div>
              <div className="relative mt-1.5 grid grid-cols-2 gap-1.5 font-mono">
                <div className="mh-ph-cell rounded-lg px-1.5 py-1 text-center">
                  <span className="block text-[8px] font-black text-slate-400 leading-none">技威力</span>
                  <span className="block text-[9px] font-black text-slate-500 leading-tight mt-0.5">{c.powerBefore} →</span>
                  <span className="mh-train-num block text-[17px] font-black text-red-300 leading-tight" style={{'--d': `${base + 300 + countMs}ms`, '--glow': '248,113,113'}}><TrainingCountUp from={c.powerBefore} to={c.powerAfter} delay={base + 300} duration={countMs}/></span>
                </div>
                <div className="mh-ph-cell rounded-lg px-1.5 py-1 text-center">
                  <span className="block text-[8px] font-black text-slate-400 leading-none">消費ガッツ</span>
                  <span className="block text-[9px] font-black text-slate-500 leading-tight mt-0.5">{c.gutsBefore} →</span>
                  <span className="block text-[17px] font-black text-amber-300 leading-tight">{c.gutsAfter}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
    // 出している途中で設定が切れたとき(超省エネに入ったときなど)は、表示を消すタイマーも一緒に止まるので、ここで消す
    if (!phase || !enabled) { lastRef.current = phase || null; setShown(null); return undefined; }
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
const WaveIntro = ({ enabled, wave, enemyName, title = '' }) => {
  const [shown, setShown] = React.useState(null);
  const lastRef = React.useRef(null);
  React.useEffect(() => {
    // 出している途中で設定が切れたとき(超省エネに入ったときなど)は、表示を消すタイマーも一緒に止まるので、ここで消す
    if (!enabled || !(wave > 0)) { lastRef.current = null; setShown(null); return undefined; }
    const key = `${wave}:${enemyName || ''}:${title}`;
    if (lastRef.current === key) return undefined;
    lastRef.current = key;
    setShown({ wave, name: enemyName || '', title, key: Date.now() });
    const timer = setTimeout(() => setShown(null), 1500);
    return () => clearTimeout(timer);
  }, [enabled, wave, enemyName, title]);
  if (!shown) return null;
  const boss = !shown.title && shown.wave >= 10;
  return (
    <div key={shown.key} data-wave-intro={shown.wave} aria-hidden="true" className={`mh-waveintro${boss ? ' mh-waveintro-boss' : ''}`}>
      <div className="mh-waveintro-line"/>
      <div className="mh-waveintro-body">
        <span className="mh-waveintro-sub">{boss ? 'FINAL BOSS' : 'BATTLE START'}</span>
        <b className="mh-waveintro-title">{shown.title || `WAVE ${shown.wave}`}</b>
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

// ==== 敵を倒した瞬間の演出 ====
// 敵のライフが尽きたら、白い閃光と「VICTORY!」を出してから WAVE リザルトへ進む。最後のWAVEは金色の「BOSS DOWN!」。
// 操作は止めない(pointer-events: none)。約1.1秒で、動き続けるものは無い。
const EnemyDefeatFx = ({ fx }) => {
  if (!fx) return null;
  return (
    <div key={fx.key} data-enemy-defeat-fx aria-hidden="true">
      <div className="mh-defeat-flash"/>
      <div className={`mh-waveintro mh-defeat${fx.boss ? ' mh-defeat-boss' : ''}`}>
        <div className="mh-waveintro-line"/>
        <div className="mh-waveintro-body">
          <span className="mh-waveintro-sub">{fx.name}を倒した！</span>
          <b className="mh-waveintro-title">{fx.boss ? 'BOSS DOWN!' : 'VICTORY!'}</b>
        </div>
        <div className="mh-waveintro-line"/>
      </div>
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

// お話や大事な窓が出ているあいだは、画面の上に重なる知らせ(新しいバージョンの帯など)を出すのを待つ。
// 閉じたら出す(2026-10-27 社長室カゲあつくんの指摘「お話の吹き出しの頭を隠す」)。
// 見るのは、お話の舞台(data-story-stage)と、窓(aria-modal・role="dialog")。待っているあいだだけ1秒ごとに見直す
const OVERLAY_WAIT_SELECTOR = '[data-story-stage],[aria-modal="true"],[role="dialog"]';
const overlayOpenNow = () => typeof document !== 'undefined' && !!document.querySelector(OVERLAY_WAIT_SELECTOR);
function WaitForOverlayClose({ children }) {
  const [blocked, setBlocked] = useState(overlayOpenNow);
  useEffect(() => {
    const tick = () => setBlocked(overlayOpenNow());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return blocked ? null : children;
}

// 中身が入りきらず窓の中を送れるときだけ、下に「続きがあります」を出す一覧(2026-10-27 ダメダシくんの指摘 f02
// 「横持ちで5件目が窓の外に隠れ、送れることも分からない」)。件数ではなく実際にあふれているかで決め、いちばん下まで送ったら消す
function ScrollMoreList({ className = '', moreText, children, ...rest }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 4);
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    return () => { el.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, []);
  return (
    <>
      <div ref={ref} className={className} {...rest}>{children}</div>
      {more && <div data-scroll-more className="mt-1.5 text-center text-[10px] font-black text-amber-200">{moreText}</div>}
    </>
  );
}
