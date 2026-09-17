// ==================== デバッグ画面の共通部品 ====================
// デバッグ画面は「必要になったら1つずつ足す」で増えてきたため、画面ごとに頭の作りが
// ばらばらになっていた(2026-09-17・ユーザー指摘「デバッグモード自体がほんとに適当に
// 追加してったその場しのぎの作りになってる」)。
//
// とくに困るのが**「この画面はセーブを書き換えるのか」の伝わり方が画面ごとに違う**こと。
// 赤帯(mh-debug-banner)を出すものもあれば、見出しの下に8pxの小さい字で書くだけのものもあり、
// 何も書いていないものもあった。押す前に分からないのは危ない。
//
// そこで、どのデバッグ画面も同じ頭を持つようにする。
//
//   ← 戻る ／ 画面の名前 ／ 「保存しません」か「保存します」のバッジ
//
// saves=true のときだけ赤くなる。バッジは必ず同じ位置に出るので、
// 「書いていない＝たぶん大丈夫」という読み取りが起きない。

// デバッグ画面の頭。すべてのデバッグ画面がこれを使う。
//   title … 画面の名前(日本語)
//   note  … 補足(省略可。本番と同じ部品を使っていることなど)
//   saves … セーブデータを書き換える画面なら true
//   onBack… 戻るときにすること(画面は自分の戻り先を知らない)
const DebugScreenHead = ({ title, note = '', saves = false, onBack, backLabel = 'デバッグ設定へ戻る', right = null }) => (
  <header className="mb-2 flex shrink-0 items-center gap-2">
    <button aria-label={backLabel} onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
    <div className="min-w-0">
      <h2 className="truncate text-sm font-black text-white">{title}</h2>
      {note && <small className="block truncate text-[9px] font-bold text-slate-400">{note}</small>}
    </div>
    <span data-debug-saves={saves ? 'yes' : 'no'}
      className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black ${saves ? 'bg-rose-700 text-white' : 'border border-white/15 bg-slate-900 text-slate-300'}`}>
      {saves ? '保存します' : '保存しません'}
    </span>
    {right}
  </header>
);

// デバッグメニューの1行。入口はすべてこの形にそろえる。
// **メニューには入口だけを置き、道具そのものを埋めない**のが決めごと。
// 以前はデバッグ戦の「難易度9個 → 敵10個 → 勇者モン → 開始」がメニューの中に直接あり、
// 次の欄へ行くのに1500pxスクロールする必要があった。
//   tone … 'go'(画面へ移る) / 'play'(その場で再生する) / 'save'(セーブを書き換える)
const DEBUG_ROW_TONE = {
  go:   'border-cyan-400/50 bg-cyan-950/40 text-cyan-50',
  play: 'border-pink-400/50 bg-pink-950/40 text-pink-50',
  save: 'border-rose-400/60 bg-rose-950/50 text-rose-50',
};
const DebugMenuRow = ({ icon = '', label, desc = '', tone = 'go', onClick, ...rest }) => (
  <button type="button" onClick={onClick} {...rest}
    className={`w-full min-h-[56px] rounded-2xl border-2 px-3 py-2 text-left font-black active:scale-95 ${DEBUG_ROW_TONE[tone] || DEBUG_ROW_TONE.go}`}>
    <span className="flex items-center gap-2">
      {icon && <span className="shrink-0 text-[15px]">{icon}</span>}
      <span className="min-w-0 flex-1 text-[12px] leading-tight">{label}</span>
      {tone === 'save' && <span className="shrink-0 rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] text-white">保存</span>}
    </span>
    {desc && <small className="mt-0.5 block text-[9px] font-bold leading-relaxed opacity-75">{desc}</small>}
  </button>
);
