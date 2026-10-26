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

// デバッグメニューのまとまり(2026-10-27 社長「デバッグモードがまたごちゃついてきてるから、使いやすく見やすく整備して」)。
// 見出しを押すと開く。開いているまとまりは、この端末だけに覚える(デバッグ専用の新しいキー。ほかの保存には触らない)。
//   id   … 覚えるときの名前(data-debug-group にも出す)
//   open … true ならいつも開いた状態で始める(「よく使う」用)
const DEBUG_MENU_OPEN_KEY = 'mh_debug_menu_open_v1';
const debugMenuOpenRead = () => { try { const v = JSON.parse(localStorage.getItem(DEBUG_MENU_OPEN_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch (e) { return []; } };
const debugMenuOpenWrite = (id, open) => {
  try { const set = new Set(debugMenuOpenRead()); if (open) set.add(id); else set.delete(id); localStorage.setItem(DEBUG_MENU_OPEN_KEY, JSON.stringify([...set].slice(-40))); } catch (e) {}
};
// 絞り込んでいるあいだに開け閉めしたものは覚えない(toggle の知らせはあとから届くので、印は絞り込みの間ずっと立てておく)
let debugMenuFiltering = false;
const DebugMenuGroup = ({ id, icon = '', title, desc = '', open = false, tone = 'slate', children }) => {
  const [startOpen] = useState(() => open || debugMenuOpenRead().includes(id));
  const toneClass = tone === 'pin' ? 'border-amber-400/60 bg-amber-950/25' : tone === 'trial' ? 'border-lime-400/50 bg-lime-950/20' : 'border-white/10 bg-slate-900/70';
  return (
    <details data-debug-group={id} open={startOpen} onToggle={(e) => { if (!open && !debugMenuFiltering) debugMenuOpenWrite(id, e.currentTarget.open); }}
      className={`rounded-2xl border ${toneClass}`}>
      <summary className="flex min-h-[52px] cursor-pointer select-none items-center gap-2 px-3 py-2">
        {icon && <span className="shrink-0 text-[16px]" aria-hidden="true">{icon}</span>}
        <span className="min-w-0 flex-1">
          <b className="block text-[13px] font-black leading-tight text-white">{title}</b>
          {desc && <small className="mt-0.5 block text-[9px] font-bold leading-snug text-slate-400">{desc}</small>}
        </span>
      </summary>
      <div className="space-y-2 px-3 pb-3">{children}</div>
    </details>
  );
};

// 名前で絞り込む欄。打った字を含む項目だけを残し、当たったまとまりは開く。消すと元の開き方へ戻す。
// 項目はまとまりの中のボタン(と試作の札)。画面の作りには触らず、表示するかどうかだけを切り替える
const debugMenuApplyFilter = (root, query) => {
  if (!root) return 0;
  const q = String(query || '').trim().toLowerCase();
  const remembered = debugMenuOpenRead();
  debugMenuFiltering = !!q;
  let hits = 0;
  root.querySelectorAll('[data-debug-group]').forEach((group) => {
    const items = [...group.querySelectorAll(':scope > div button, :scope > div [data-debug-trial]')]
      .filter((el) => !el.closest('[data-debug-trial]') || el.matches('[data-debug-trial]'));
    let groupHits = 0;
    items.forEach((el) => {
      const ok = !q || (el.innerText || el.textContent || '').toLowerCase().includes(q);
      el.hidden = !ok;
      if (ok) groupHits += 1;
    });
    // 中のたたみ(チュートリアルと旧画面など)も、当たりがあれば開く
    group.querySelectorAll(':scope > div details').forEach((d) => {
      const any = [...d.querySelectorAll('button')].some((b) => !b.hidden);
      d.hidden = !!q && !any;
      if (q && any) d.open = true;
    });
    group.hidden = !!q && groupHits === 0;
    if (q) group.open = groupHits > 0;
    else group.open = group.dataset.debugGroup === 'pinned' || remembered.includes(group.dataset.debugGroup);
    hits += groupHits;
  });
  return hits;
};
const DebugMenuSearch = ({ rootRef }) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);
  useEffect(() => { const n = debugMenuApplyFilter(rootRef.current, query); setHits(query.trim() ? n : null); }, [query]);
  return (
    <div className="mb-2 shrink-0">
      <label className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-white/15 bg-slate-900 px-3">
        <span aria-hidden="true" className="text-[14px]">🔎</span>
        <input data-debug-menu-search type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="名前で探す(例: 染色・ジャック・未読)"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-white outline-none placeholder:text-slate-500"/>
        {query && <button type="button" data-debug-menu-search-clear onClick={() => setQuery('')} className="shrink-0 rounded-full bg-slate-700 px-2 py-1 text-[10px] font-black text-slate-100">消す</button>}
      </label>
      {hits !== null && <p data-debug-menu-search-hits className="mt-1 text-[10px] font-bold text-slate-400">{hits ? `${hits}件 見つかりました` : '見つかりませんでした'}</p>}
    </div>
  );
};
