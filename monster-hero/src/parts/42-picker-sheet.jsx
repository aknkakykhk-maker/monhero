// ==== 共通部品: 一覧から選ぶ窓(PickerSheet) ====
//
// アイコン・プロフィールフレーム・好きなモンスターのように、**数が増えていく一覧から1つ選ぶ**窓の共通の形。
// 増えても分かりにくくならないよう、次をそろえる(2026-10-03・ユーザー指摘
// 「アイコンとフレーム設定が見にくい。今の状態だと数が増えれば増えるほど分かりにくくなる」)。
//   ・上に「いまの選択」(preview)を固定して、選んだ結果がいつも見える
//   ・名前で探す検索欄(search)と、絞り込みのチップ(chips。件数つき)
//   ・一覧(children)だけがスクロールする。見出し・チップ・閉じるは動かない
//   ・下に「閉じる」(footerExtra で、その場の補足も置ける)
// 選んだ項目の目印は文字を足さず、枠・色・チェックの絵だけで示す(ボタンの文字は名前だけに保つ)。
//
//   title / note … 見出しと補足(1行)
//   preview      … 固定で出す「いまの選択」(省略可)
//   onSearch     … 渡すと検索欄を出す(search が入力中の文字)
//   chips        … [{ id, label, count }]。chip が選ばれている id、onChip で切り替え
//   footerExtra  … 一覧の下・閉じるの上に置くもの(鍵の説明など。省略可)
//   onClose      … 閉じる(背景を押しても閉じる)
const PickerSheet = ({ title, note = '', preview = null, search = '', onSearch = null, searchPlaceholder = '名前でさがす',
  chips = null, chip = null, onChip = null, footerExtra = null, onClose, accent = 'border-indigo-500', dataPicker = '', children }) => (
  <div {...(dataPicker ? { 'data-picker-sheet': dataPicker } : {})} className="fixed inset-0 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}
    onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', zIndex: 90000 }}>
    <div onClick={(event) => event.stopPropagation()} className={`flex w-full max-w-md flex-col rounded-t-3xl border-2 border-b-0 ${accent} bg-slate-900 shadow-2xl`}
      style={{ maxHeight: '94%', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      <div className="shrink-0 px-4 pb-2 pt-4">
        <h3 className="text-center text-lg font-black text-white">{title}</h3>
        {note ? <p className="mt-0.5 text-center text-[10px] font-bold leading-tight text-slate-400">{note}</p> : null}
        {preview ? <div data-picker-preview className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">{preview}</div> : null}
        {onSearch ? (
          <input type="search" value={search} onChange={(event) => onSearch(event.target.value.slice(0, 20))} data-picker-search
            placeholder={searchPlaceholder} aria-label={searchPlaceholder} autoComplete="off" spellCheck={false}
            className="mt-3 min-h-[44px] w-full rounded-xl border border-white/15 bg-black/40 px-3 text-[13px] font-bold text-white placeholder:text-slate-500"/>
        ) : null}
        {Array.isArray(chips) && chips.length > 0 ? (
          <div role="tablist" className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 mh-scroll">
            {chips.map((c) => {
              const on = c.id === chip;
              return (
                <button key={c.id} type="button" role="tab" aria-selected={on} data-picker-chip={c.id} onClick={() => onChip && onChip(c.id)}
                  className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3 text-[11px] font-black active:scale-95 ${on ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-white/15 bg-slate-800 text-slate-300'}`}>
                  {c.label}{typeof c.count === 'number' ? <span className={`ml-1 text-[10px] ${on ? 'text-slate-800' : 'text-slate-500'}`}>{c.count}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 mh-scroll" data-picker-body>{children}</div>
      {footerExtra ? <div className="shrink-0 px-4 pt-1">{footerExtra}</div> : null}
      <div className="shrink-0 px-4 pt-2">
        <button type="button" onClick={onClose} className="min-h-[48px] w-full rounded-xl bg-slate-800 py-3 text-xs font-bold text-slate-300 active:scale-[.98]">閉じる</button>
      </div>
    </div>
  </div>
);
// 一覧の中の見出し(グリッドの全幅を使う)。件数も出す
const PickerGroupLabel = ({ children, count = null }) => (
  <div className="col-span-full flex items-baseline gap-2 px-0.5 pt-2 first:pt-0">
    <h4 className="text-[11px] font-black tracking-wider text-amber-300">{children}</h4>
    {typeof count === 'number' ? <span className="text-[10px] font-bold text-slate-500">{count}</span> : null}
    <span className="h-px flex-1 bg-white/10" aria-hidden="true"></span>
  </div>
);
// 選ばれている印(チェックの丸)。文字を足さず、絵だけで示す
const PickerCheckMark = () => (
  <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow"><Check size={12}/></span>
);
