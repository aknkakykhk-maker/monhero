// ===== モンヒロサクセス: マスモン一覧(モンサク)の画面(2026-11-14 社長「マスモンの画面は画像参照」・台帳 #6112) =====
// 参考の組み立て: docs/reference/line-mf/master-monster-2026-11-14/(REF-MAP の「保存枠(マスモンの画面)」mm-02〜04)。絵・名前・固有の見た目は写さない
//   入口(mm-02 型の1段): 助手+吹き出し+大きな札2枚「マスモン一覧」「合体」+もどる
//   一覧(mm-03): 顔の丸い升目5列・右上に評価の印・下の欄は切り替え(総合力/評価/名前/Lv/種族/世代/育てた助手)・お気に入りのハート・タブ「一覧/お別れ」・並べ替え・所持数
//   詳細(mm-04): 左に立ち絵・名前・Lv・評価の印・総合力/右上のタブ 基礎・特徴・適性/下のタブ 技・アシスト・育成情報/貸し出し・お別れ・とじる
// 呼び名: 画面の題・札は「マスモン一覧」を基本に、本編のマスモンと混ざる所では「(モンサク)」を添える。「保存枠」の字は画面に出さない(社長)
// 保存(CLAUDE.md ⑦・足すだけ):
//   既存の mh_monsuc_box_v1(子の並び)・mh_monsuc_meta_v1(貸し出し・編成)は、名前と染色・お別れ・貸し出しのいまの関数だけで書く(形は変えない)
//   新しいキー mh_monsuc_fav_v1 … ハートを付けた子の id の並び(ハートの子はお別れで選べない)
//   新しいキー mh_monsuc_box_view_v1 … 一覧の { label: 下の欄に出す物, sort: 並べ替え }(端末に覚える)
const MSX_MM_FAV_KEY = 'mh_monsuc_fav_v1';
const MSX_MM_VIEW_KEY = 'mh_monsuc_box_view_v1';
const MSX_MM_LABELS = Object.freeze([['power', '総合力'], ['grade', '評価'], ['name', '名前'], ['lv', 'Lv'], ['species', '種族'], ['gen', '世代'], ['coach', '育てた助手']]);
const MSX_MM_SORTS = Object.freeze([['new', '入手'], ['power', '総合力'], ['grade', '評価'], ['lv', 'Lv'], ['species', '種族'], ['name', '名前']]);
const MSX_MM_DIST = Object.freeze(['零', '近', '中', '遠']);
// 読めない値は既定へ(保存値が無い・壊れているときも画面は出る)
const msxMmNormView = (v) => {
  const o = v && typeof v === 'object' ? v : {};
  return { label: MSX_MM_LABELS.some(([k]) => k === o.label) ? o.label : 'power', sort: MSX_MM_SORTS.some(([k]) => k === o.sort) ? o.sort : 'new' };
};
const msxMmNormFav = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 200) : []);
const msxMmName = (m) => (m && m.nick) || msxMonName(m && m.species);
const msxMmPow = (m) => (Number.isFinite(m && m.score) ? m.score : 0);
const msxMmLabelOf = (m, label) => {
  if (label === 'grade') return m.grade || m.rank || '—';
  if (label === 'name') return msxMmName(m);
  if (label === 'lv') return `Lv.${Math.round(Number(m.lv) || 1)}`;
  if (label === 'species') return msxMonName(m.species);
  if (label === 'gen') return `第${Math.max(1, Math.round(Number(m.gen) || 1))}世代`;
  if (label === 'coach') return m.coach ? msxAidName(m.coach) : '—';
  return m.raised === false ? '未育成' : msxFmt(msxMmPow(m));
};
const msxMmSorted = (mons, sort) => {
  const list = mons.map((m, i) => ({ m, i }));
  const by = {
    new: (a, b) => b.i - a.i,
    power: (a, b) => msxMmPow(b.m) - msxMmPow(a.m) || b.i - a.i,
    grade: (a, b) => msxMmPow(b.m) - msxMmPow(a.m) || b.i - a.i, // 評価は総合力から決まるので、総合力の順と同じ
    lv: (a, b) => (Number(b.m.lv) || 0) - (Number(a.m.lv) || 0) || b.i - a.i,
    species: (a, b) => String(msxMonName(a.m.species)).localeCompare(String(msxMonName(b.m.species)), 'ja') || b.i - a.i,
    name: (a, b) => String(msxMmName(a.m)).localeCompare(String(msxMmName(b.m)), 'ja') || b.i - a.i,
  }[sort] || ((a, b) => b.i - a.i);
  return list.sort(by).map((x) => x.m);
};
// 子の絵(染色・覚醒のキラも出す)
function MsxMmArt({ m, size, thumb = false }) {
  const src = thumb ? msxMonThumb(m.species) : msxMonImg(m.species);
  const dyed = Array.isArray(m.colors) && m.colors.some(Boolean) && typeof DyedMonsterImage === 'function';
  const img = dyed
    ? <DyedMonsterImage baseId={m.species} src={msxMonImg(m.species)} masuColors={m.colors} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
    : <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: thumb ? 'cover' : 'contain' }}/>;
  const kira = m.awake && typeof MsxKira === 'function' && typeof msxKiraOf === 'function';
  return <span className="mm-art" style={{ width: size, height: size }}>{kira ? <MsxKira kind={msxKiraOf(m.awake)} small={thumb}>{img}</MsxKira> : img}</span>;
}

// ---- マスモンを並べて見せる所は全部この升目(ボックス式)にそろえる(2026-11-14 社長)。一覧・はじめる画面の編成えらび・合体の親えらびで使う ----
// mons … 並べる子 / onPick(m) … 押したとき / isOn(m) … 選んでいる印 / lockOf(m) … 選べない理由(文字)か null / label … 顔の下に出す物(無ければ端末に覚えた表示)
// attrs(m) … 検査用の data 属性など。見た目は .msx の外(合体の画面)でも同じになるよう、.mmg の中で閉じる
function MsxMmGrid({ mons, onPick, isOn, lockOf, label, attrs, fav, mark }) {
  const [saved, setSaved] = useState(null);
  const [favs, setFavs] = useState(Array.isArray(fav) ? fav : []);
  useEffect(() => {
    let alive = true;
    if (!label) storeGet(MSX_MM_VIEW_KEY, null).then((v) => { if (alive) setSaved(msxMmNormView(v).label); }).catch(() => {});
    if (!Array.isArray(fav)) storeGet(MSX_MM_FAV_KEY, []).then((v) => { if (alive) setFavs(msxMmNormFav(v)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const lb = label || saved || 'power'; const fv = Array.isArray(fav) ? fav : favs;
  return (<div className="mmg" data-msx-mm-grid>
    <style>{MSX_MM_GRID_CSS}</style>
    {mons.map((m) => { const lock = lockOf ? lockOf(m) : null; const on = isOn ? isOn(m) : false;
      return (
        <button type="button" key={m.id} className={`mmg-c${on ? ' on' : ''}${lock ? ' lk' : ''}`} disabled={!!lock} onClick={() => onPick && onPick(m)} {...(attrs ? attrs(m) : {})}>
          <span className="mmg-fc"><MsxMmArt m={m} size="100%" thumb/></span>
          {m.grade || m.rank ? <i className="mmg-gd">{m.grade || m.rank}</i> : null}
          {fv.includes(m.id) ? <i className="mmg-hr" aria-label="お気に入り">❤</i> : null}
          {on ? <i className="mmg-ck" aria-hidden="true">✓</i> : null}
          {lock ? <i className="mmg-lk">{lock}</i> : null}
          {mark && mark(m) ? <i className="mmg-as">{mark(m)}</i> : null}
          <span className="mmg-lb">{msxMmLabelOf(m, lb)}</span>
        </button>);
    })}
  </div>);
}
const MSX_MM_GRID_CSS = `
.mmg{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px 6px;align-content:start;padding:8px 2px 6px}
.mmg .mmg-c{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;min-height:44px;text-align:center;background:none;border:0;padding:0;margin:0;color:#fff;font:inherit;cursor:pointer}
.mmg .mmg-c:disabled{cursor:default}
.mmg .mmg-fc{display:block;width:100%;height:auto;aspect-ratio:1/1;min-height:0;max-height:none;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 35%,#e0e7ff 0,#a5b4fc 75%);border:2.5px solid #fde047;box-shadow:0 2px 0 #0006}
.mmg .mmg-c.on .mmg-fc{border-color:#f472b6;box-shadow:0 0 0 3px #f472b6}
.mmg .mmg-c.lk{opacity:.5}
.mmg .mmg-gd{position:absolute;right:-2px;top:-2px;font-style:normal;font-size:10px;font-weight:900;color:#fff;background:#7c3aed;border:1.5px solid #fde047;border-radius:8px;padding:0 4px;line-height:15px}
.mmg .mmg-hr{position:absolute;left:-1px;top:-2px;font-style:normal;font-size:14px;color:#f43f5e;text-shadow:0 1px 0 #fff}
.mmg .mmg-ck{position:absolute;left:50%;top:22%;transform:translateX(-50%);font-style:normal;font-size:22px;font-weight:900;color:#fff;text-shadow:0 2px 4px #000}
.mmg .mmg-lk{position:absolute;left:50%;top:30%;transform:translateX(-50%);font-style:normal;font-size:10px;font-weight:900;background:#0f0d24e0;border-radius:6px;padding:0 4px;white-space:nowrap}
.mmg .mmg-as{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);font-style:normal;font-size:8.5px;font-weight:900;color:#fff;background:#4f46e5;border:1.5px solid #c7d2fe;border-radius:8px;padding:0 4px;line-height:13px;white-space:nowrap}
.mmg .mmg-lb{max-width:100%;font-size:10.5px;font-weight:900;background:#0f0d24;border-radius:8px;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mmg .mm-art{display:block;position:relative;width:100%;height:100%}
.mmg .mmg-fc img{width:100%!important;height:100%!important;object-fit:cover;object-position:50% 30%}
`;

function MsxR3Box({ onClose }) {
  const [box, setBox] = useState(null);
  const [meta, setMeta] = useState(null);
  const [fav, setFav] = useState([]);
  const [view, setViewState] = useState(msxMmNormView(null));
  const [page, setPage] = useState('gate'); // 'gate' 入口 / 'list' 一覧 / 'detail' 詳細 / 'edit' 名前と染色 / 'fuse' 合体
  const [tab, setTab] = useState('list'); // 一覧のタブ 'list' / 'bye'(お別れをまとめて選ぶ)
  const [pick, setPick] = useState([]); // お別れで選んだ子の id
  const [byeAsk, setByeAsk] = useState(null); // お別れの確かめ { ids }
  const [tpAll, setTpAll] = useState(null); // 合体で生まれた子(未育成)の技の升の選び(mh_monsuc_techpick_v1)
  useEffect(() => { let on = true; msxReadTechPick().then((t) => { if (on) setTpAll(t); }).catch(() => {}); return () => { on = false; }; }, []);
  const [assist, setAssist] = useState(null); // メモリアルモンスターの置き場(mh_monsuc_assist_v1)
  const fuseKept = React.useRef(null); // 合体でメモリアルモンスターとして残った親の数(生まれたあとの文に使う)
  const [apick, setApick] = useState([]); // 置き場で、外すために選んだ子の id
  const [aAsk, setAAsk] = useState(false); // 外す確かめ
  const [menu, setMenu] = useState(null); // 'sort' / 'label' の小窓
  const [sel, setSel] = useState(null);
  const [runFrom, setRunFrom] = useState(null);
  const [msg, setMsg] = useState('');
  const [edit, setEdit] = useState(null); // { nick, colors, err }
  const [top, setTop] = useState('base'); // 詳細の右上のタブ base / feat / apt
  const [low, setLow] = useState('tech'); // 詳細の下のタブ tech / assist / info
  const [techSel, setTechSel] = useState(null);
  useEffect(() => {
    let alive = true;
    msxR3ReadBox().then((b) => { if (alive) setBox(b); });
    msxR3ReadMeta().then((m) => { if (alive) setMeta(m); });
    msxReadAssist().then((a) => { if (alive) setAssist(a); }).catch(() => {});
    storeGet(MSX_MM_FAV_KEY, []).then((v) => { if (alive) setFav(msxMmNormFav(v)); }).catch(() => {});
    storeGet(MSX_MM_VIEW_KEY, null).then((v) => { if (alive) setViewState(msxMmNormView(v)); }).catch(() => {});
    storeGet(MSX_KEYS.run, null).then((r) => { if (alive && r && r.from && typeof r.from.box === 'string') setRunFrom(r.from.box); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const setView = (v) => { const n = msxMmNormView(v); setViewState(n); storeSet(MSX_MM_VIEW_KEY, n).catch(() => {}); };
  const toggleFav = (id) => { const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id]; setFav(n); storeSet(MSX_MM_FAV_KEY, n).catch(() => {}); };
  const cur = box && sel ? box.mons.find((m) => m.id === sel) : null;
  const lendOn = typeof monsucLendSet === 'function';
  const lendId = meta && typeof meta.lend === 'string' ? meta.lend : null;
  const teamIds = meta && Array.isArray(meta.team) ? meta.team.filter((t) => t && typeof t.box === 'string').map((t) => t.box) : [];
  // お別れで選べない子: ハートの子・貸し出し中・育成中の元の子
  const byeLock = (m) => fav.includes(m.id) ? 'ハート' : lendId === m.id ? '貸し出し中' : runFrom === m.id ? '育成中' : null;
  const saveLend = async (id) => { const m = { ...(await msxR3ReadMeta()), lend: id }; await storeSet(MSX_KEYS.meta, m); setMeta(m); };
  const lend = async () => {
    if (!cur || !lendOn) return;
    let r = null; try { r = await monsucLendSet(cur, {}); } catch (e) { r = { ok: false, reason: 'error' }; }
    if (r && r.ok) { await saveLend(cur.id); setMsg('フレンドに貸し出しました'); }
    else setMsg(typeof monsucLendReasonText === 'function' ? monsucLendReasonText(r && r.reason) : '貸し出せませんでした');
  };
  const unlend = async () => { try { if (typeof monsucLendClear === 'function') await monsucLendClear(); } catch (e) {} await saveLend(null); setMsg('貸し出しをやめました'); };
  // お別れ(1体ずつ、いまの msxR3Farewell を通す。思い出に名前とランクだけ残る)
  const farewell = async (ids) => {
    let b = box;
    const gone = []; // アシスト用に残す(お別れの前の写し)
    for (const id of ids) { const m0 = b.mons.find((x) => x.id === id); if (lendId === id) await unlend(); b = await msxR3Farewell(id); if (m0) gone.push(m0); }
    let kept = null; try { kept = await msxAssistKeep(gone, 'farewell'); if (kept && kept.assist) setAssist(kept.assist); } catch (e) { kept = null; }
    setBox(b); setPick([]); setByeAsk(null); setSel(null); setPage('list'); setTab('list');
    setMsg(`${ids.length}体とお別れしました` + (kept ? (kept.kept ? `。${kept.kept}体はメモリアルモンスターとして残りました(${kept.assist.mons.length}/${MSX_ASSIST_CAP})` : kept.full ? '。アシスト用がいっぱいなので、残りませんでした' : '') : ''));
  };
  const saveEdit = async () => {
    if (!cur || !edit) return;
    const r = await msxR3EditMon(cur.id, edit.nick, edit.colors);
    if (!r.ok) { setEdit({ ...edit, err: r.why === 'name' ? 'その名前は使えません。ほかの名前にしてね' : '保存できませんでした' }); return; }
    setBox(r.box); setEdit(null); setPage('detail');
    if (meta && meta.lend === cur.id && typeof monsucLendSet === 'function') { try { await monsucLendSet(r.mon, {}); } catch (e) {} }
  };
  const SUC = msxSuc && msxSuc.SUC;
  // 入口の助手: いちばん新しく育てたマスモンの助手(いなければみゅあ)
  const aid = (box && box.mons.length && typeof box.mons[box.mons.length - 1].coach === 'string' && box.mons[box.mons.length - 1].coach) || 'mua';

  // ---- 合体(別の会話の部品 MonsucFuseSheet)。編成に入れている子・貸し出し中の子・育成中の子は選べない ----
  if (page === 'fuse' && box && typeof MonsucFuseSheet === 'function') {
    const locked = [...teamIds, ...(lendId ? [lendId] : []), ...(runFrom ? [runFrom] : [])];
    return (<>
      <style>{MSX_R3_CSS}</style><style>{MSX_MM_CSS}</style>
      <MonsucFuseSheet box={box} locked={locked} readBox={msxR3ReadBox} onName={async (id, nick, cols) => { const r = await msxR3EditMon(id, nick, cols); if (r && r.ok && r.box) setBox(r.box); return r; }} keepNote={(() => { const have = assist ? assist.mons.length : 0; const room = Math.max(0, MSX_ASSIST_CAP - have); if (room >= 2) return `メモリアルモンスターとして残ります(${have + 2}/${MSX_ASSIST_CAP})。\u200b育成には使えず、\u200b編成にだけ入れられます`; if (room <= 0) return `メモリアルモンスターがいっぱいなので、\u200bメモリアルモンスターには残りません(思い出に名前・ランク・代だけ残ります)`; return `片方だけ、\u200bメモリアルモンスターとして残ります。\u200bもう一方はメモリアルモンスターがいっぱいなので残りません`; })()}
        keptOf={() => (fuseKept.current)}
        onSave={async (n) => { let old = null; try { old = await msxR3ReadBox(); } catch (e) { old = null; } const r = await storeSet(MSX_KEYS.box, n); if (r === true && old && n && Array.isArray(n.mons)) { try { const left = old.mons.filter((m) => !n.mons.some((x) => x.id === m.id)); const k = await msxAssistKeep(left, 'fuse'); fuseKept.current = k ? k.kept : 0; if (k && k.assist) setAssist(k.assist); } catch (e) {} } return r; }} onDone={() => { msxR3ReadBox().then(setBox); }} onClose={() => { setPage('gate'); msxR3ReadBox().then(setBox); }}/>
    </>);
  }

  let body = null; let foot = null; let title = 'マスモンボックス(モンサク)';
  if (!box) body = <div className="msx-note" style={{ margin: 'auto' }}>読み込んでいます…</div>;
  // ---- 入口(mm-02 型) ----
  else if (page === 'gate') {
    title = 'マスモンボックス(モンサク)';
    body = (<div className="mm-gate">
      <div className="mm-desk"><img className="mm-bg" src="images/story-bg/monhero_town.jpg" alt=""/><img className="mm-aid" src={msxFace(aid, 'happy')} alt=""/>
        <div className="mm-bub">{box.mons.length ? '育てたマスモンの様子を見にきたの?' : 'まだマスモンはいないみたい。育成を最後まで終えると、ここに来るよ!'}</div></div>
      <div className="mm-cards">
        <button type="button" className="mm-card" onClick={() => { setPage('list'); setTab('list'); setMsg(''); }} data-msx-mm-open-list data-msx-r3-mmlist>
          <span className="e" aria-hidden="true">🐾</span><b>マスモンボックス</b><small>{box.mons.length} / {box.cap}体</small></button>
        {typeof MonsucFuseSheet === 'function' ? <button type="button" className="mm-card" onClick={() => setPage('fuse')} disabled={box.mons.length < 2} data-msx-r3-fuse>
          <span className="e" aria-hidden="true">🧬</span><b>合体</b><small>{box.mons.length < 2 ? '2体からできる' : '2体から新しいマスモン'}</small></button> : null}
      </div>
      <button type="button" className="mm-card mm-asb" onClick={() => { setPage('assist'); setApick([]); setMsg(''); }} data-msx-mm-open-assist>
        <b>メモリアルモンスター</b><small>{assist ? assist.mons.length : 0} / {MSX_ASSIST_CAP}体(合体・お別れしたモンスター。編成にだけ入れられる)</small></button>
      {box.memory.length ? <div className="mm-memo">思い出: {box.memory.slice(-5).reverse().map((m) => `${m.nick || msxMonName(m.species)}(${m.rank || '—'})`).join('・')}</div> : null}
    </div>);
    foot = <div className="v-ft"><button type="button" onClick={onClose}>← 戻る</button></div>;
  }
  // ---- メモリアルモンスター(合体の親・お別れしたモンスター。育成には使えない・編成にだけ入れる。外すと消える) ----
  else if (page === 'assist') {
    title = 'メモリアルモンスター';
    const stock = assist ? assist.mons : [];
    body = (<>
      <div className="mm-hint msx-kp">合体の親にしたモンスター・お別れしたモンスターが残っています。{'\u200b'}育成には使えず、{'\u200b'}育成を始めるときの編成にだけ入れられます。{'\u200b'}アシスト効果と得意な能力が効きます</div>
      {msg ? <div className="mm-hint ok">{msg}</div> : null}
      <div className="mm-gridw">{stock.length ? <MsxMmGrid mons={stock} label={view.label} mark={() => 'メモモン'} isOn={(m) => apick.includes(m.id)}
        attrs={(m) => ({ 'data-msx-assist-mon': m.id })} onPick={(m) => setApick(apick.includes(m.id) ? apick.filter((x) => x !== m.id) : [...apick, m.id])}/>
        : <div className="msx-note" style={{ padding: 8 }}>まだいません。合体の親にしたモンスター・お別れしたモンスターが、ここに残ります</div>}</div>
      <div className="mm-bar"><span className="cnt">メモモン <b>{stock.length}</b>/{MSX_ASSIST_CAP}体</span>
        <button type="button" className="mm-sel" disabled={!apick.length} onClick={() => setAAsk(true)} data-msx-assist-remove>外す({apick.length}体)</button></div>
      {aAsk ? <div className="msx-ov msx-fade"><div className="msx-sheet">
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{apick.length}体をメモリアルモンスターから外しますか? 外したモンスターは元に戻せません</div>
        <button type="button" className="msx-btn go" data-msx-assist-remove-yes onClick={async () => { try { const a = await msxAssistRemove(apick); setAssist(a); setMsg(`${apick.length}体を外しました`); } catch (e) { setMsg('外せませんでした'); } setApick([]); setAAsk(false); }}>外す</button>
        <button type="button" className="msx-btn sub" onClick={() => setAAsk(false)}>やめておく</button></div></div> : null}
    </>);
    foot = <div className="v-ft"><button type="button" onClick={() => { setPage('gate'); setApick([]); }}>← 戻る</button></div>;
  }
  // ---- 一覧(mm-03) ----
  else if (page === 'list' || (page === 'detail' && cur)) {
    const list = msxMmSorted(box.mons, view.sort);
    const sortName = (MSX_MM_SORTS.find(([k]) => k === view.sort) || [])[1];
    const labelName = (MSX_MM_LABELS.find(([k]) => k === view.label) || [])[1];
    body = (<>
      <div className="mm-tabs"><button type="button" className={tab === 'list' ? 'on' : ''} onClick={() => { setTab('list'); setPick([]); }}>一覧</button>
        <button type="button" className={tab === 'bye' ? 'on' : ''} onClick={() => { setTab('bye'); setPick([]); setMsg(''); }} data-msx-mm-tab-bye data-msx-r3-mmbye>お別れ</button></div>
      {tab === 'bye' ? <div className="mm-hint">お別れするマスモンを選んでね<br/>ハート・貸し出し中・育成中のマスモンは選べません</div> : null}
      {msg ? <div className="mm-hint ok">{msg}</div> : null}
      <div className="mm-gridw">{list.length ? <MsxMmGrid mons={list} label={view.label} fav={fav}
        isOn={(m) => tab === 'bye' && pick.includes(m.id)} lockOf={tab === 'bye' ? byeLock : null}
        attrs={(m) => ({ 'data-msx-r3-boxmon': m.id })}
        onPick={(m) => { if (tab === 'bye') setPick(pick.includes(m.id) ? pick.filter((x) => x !== m.id) : [...pick, m.id]); else { setSel(m.id); setPage('detail'); setTechSel(null); setMsg(''); } }}/>
        : <div className="msx-note" style={{ padding: 8 }}>まだマスモンはいません。育成を最後まで終えると、ここに入ります</div>}</div>
      <div className="mm-bar">
        <span className="cnt">所持数 <b>{box.mons.length}</b>/{box.cap}体</span>
        <button type="button" className="mm-sel" onClick={() => setMenu('sort')} data-msx-mm-sort>並べ替え: {sortName}▼</button>
        <button type="button" className="mm-sel" onClick={() => setMenu('label')} data-msx-mm-label data-msx-r3-mmlabel>表示: {labelName}▼</button>
      </div>
      {menu ? <div className="msx-ov msx-fade" onClick={() => setMenu(null)}><div className="msx-sheet" onClick={(e) => e.stopPropagation()}>
        <h3>{menu === 'sort' ? '並べ替え' : '顔の下に出す物'}</h3>
        <div className="mm-opts">{(menu === 'sort' ? MSX_MM_SORTS : MSX_MM_LABELS).map(([k, n]) => (
          <button type="button" key={k} className={(menu === 'sort' ? view.sort : view.label) === k ? 'on' : ''} onClick={() => { setView(menu === 'sort' ? { ...view, sort: k } : { ...view, label: k }); setMenu(null); }}>{n}</button>))}</div>
        <button type="button" className="msx-btn" onClick={() => setMenu(null)}>閉じる</button></div></div> : null}
      {byeAsk ? <div className="msx-ov msx-fade"><div className="msx-sheet">
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.6 }}>{byeAsk.ids.length === 1 && box.mons.find((x) => x.id === byeAsk.ids[0]) ? msxMmName(box.mons.find((x) => x.id === byeAsk.ids[0])) : `${byeAsk.ids.length}体`}とお別れしますか?</div>
        <div className="mm-keep msx-kp" data-msx-mm-keepnote>{(() => { const have = assist ? assist.mons.length : 0; const room = Math.max(0, MSX_ASSIST_CAP - have); const n = byeAsk.ids.length;
          if (room >= n) return `マスモンボックスからはいなくなり、\u200bメモリアルモンスターとして残ります(${have + n}/${MSX_ASSIST_CAP})。\u200b育成には使えず、\u200b編成にだけ入れられます。\u200b思い出にも名前とランクが残ります`;
          if (room <= 0) return `マスモンボックスからはいなくなります。\u200bメモリアルモンスターがいっぱいなので、\u200bメモリアルモンスターには残りません(思い出に名前とランクだけ残ります)。\u200b元に戻せません`;
          return `マスモンボックスからはいなくなります。\u200b${n}体のうち${room}体は、\u200bメモリアルモンスターとして残ります。\u200bメモリアルモンスターがいっぱいなので、\u200bのこりは残りません(思い出に名前とランクだけ残ります)`; })()}</div>
        <div className="mm-byelist">{byeAsk.ids.map((id) => { const m = box.mons.find((x) => x.id === id); return m ? <span key={id}>{msxMmName(m)}</span> : null; })}</div>
        <button type="button" className="msx-btn go" onClick={() => farewell(byeAsk.ids)} data-msx-mm-bye-yes>お別れする</button>
        <button type="button" className="msx-btn sub" onClick={() => setByeAsk(null)}>やめておく</button></div></div> : null}
      {page === 'detail' && cur && typeof MsxMonDetail === 'function' ? (() => {
        // 詳細は、はじめる画面・育成中の「くわしく」と同じ部品 MsxMonDetail(社長の手本 monster-detail-basic・r1114-039/046)。マスモンボックスの分だけ差し込む
        const lock = byeLock(cur);
        const assistText = Array.isArray(cur.assists) && cur.assists.length ? cur.assists.map((a) => { const T3 = msxR3T().assist; return T3 && T3.VERSION === 3 && T3.BY_ID[a.id] ? `${T3.BY_ID[a.id].name} ${T3.valueText(a.id, T3.valueOf ? T3.valueOf(a) : a.v)}` : (a.name || a.id); }).join('・') : '';
        const endAt = Number.isFinite(cur.endAt) ? new Date(cur.endAt) : null;
        const more = [
          ['忠誠 / 人気', `${Math.round(cur.loy || 0)} / ${Math.round(cur.pop || 0)}`],
          Array.isArray(cur.fav) && cur.fav.length ? ['得意な能力', cur.fav.map((k) => MSX_STAT_NAME[k] || k).join('・')] : null,
          cur.awake ? ['覚醒', cur.awake >= 2 ? '🌈 超覚醒' : '✨ 覚醒'] : null,
          assistText ? ['アシスト', assistText] : null,
          Array.isArray(cur.titles) && cur.titles.length ? ['称号', cur.titles.slice(0, 4).map((t) => `「${msxR3TitleName(t)}」`).join('')] : null,
          cur.coach ? ['育てた助手', msxAidName(cur.coach)] : null,
          ['世代', `第${Math.max(1, Math.round(Number(cur.gen) || 1))}世代`],
          endAt ? ['育成完了日', `${endAt.getFullYear()}/${endAt.getMonth() + 1}/${endAt.getDate()}`] : null,
          cur.ending ? ['エンディング', { super: 'スーパー', good: 'グッド', bad: 'ふつう' }[cur.ending] || cur.ending] : null,
          lendId === cur.id ? ['フレンド', '🤝 貸し出し中'] : null,
        ];
        return (<MsxMonDetail species={cur.species} name={msxMmName(cur)} sub={`Lv.${Math.round(Number(cur.lv) || 1)}・${msxMonName(cur.species)}`}
          art={<MsxMmArt m={cur} size="100%"/>} st={MSX_STATS.reduce((o, k) => ({ ...o, [k]: Math.round((cur.st && cur.st[k]) || 0) }), {})}
          apt={typeof msxAptOf === 'function' ? msxAptOf(cur.species) : ['C', 'C', 'C', 'C', 'C', 'C']} type={cur.gt} grades={SUC && typeof SUC.aptGradesOf === 'function' ? (() => { try { return SUC.aptGradesOf(cur); } catch (e) { return null; } })() : null}
          pick={cur.raised === false && SUC && typeof SUC.techPickNorm === 'function' ? (() => { const sel = SUC.techPickNorm(tpAll && tpAll.mon ? tpAll.mon[cur.id] : null, cur.species); return { sel, locked: () => false, onPick: async (c, id) => { const next = { ...sel, [c]: id }; setTpAll((t0) => { const t = t0 || msxNormTechPick(null); return { ...t, mon: { ...t.mon, [cur.id]: next } }; }); try { setTpAll(await msxWriteTechPick('mon', cur.id, next)); } catch (e) {} } }; })() : null} known={Array.isArray(cur.techs) ? cur.techs : []} power={cur.raised === false ? null : msxMmPow(cur)} rank={cur.grade ? null : cur.rank} grade={cur.grade} SUC={SUC}
          head={<><button type="button" className={`mm-fav${fav.includes(cur.id) ? ' on' : ''}`} onClick={() => toggleFav(cur.id)} aria-label="お気に入り" data-msx-mm-fav>{fav.includes(cur.id) ? '❤' : '♡'}</button>
            <button type="button" className="mm-ed" aria-label="名前と染色を変える" onClick={() => { setEdit({ nick: cur.nick || msxMonName(cur.species), colors: Array.isArray(cur.colors) ? cur.colors.slice(0, 6) : [], err: '' }); setPage('edit'); }} data-msx-r3-edit>✏</button></>}
          more={more}
          foot={<>{msg ? <div className="mm-hint ok">{msg}</div> : null}<div className="mm-acts">
            {lendOn && cur.raised !== false ? (lendId === cur.id ? <button type="button" onClick={unlend}>🤝 貸し出しをやめる</button> : <button type="button" onClick={lend}>🤝 貸し出す</button>) : null}
            <button type="button" disabled={!!lock} onClick={() => setByeAsk({ ids: [cur.id] })} data-msx-r3-bye>{lock ? `お別れ(${lock})` : 'お別れ'}</button></div></>}
          onClose={() => { setSel(null); setPage('list'); setMsg(''); }}/>);
      })() : null}
    </>);
    foot = tab === 'bye'
      ? <div className="v-ft"><button type="button" onClick={() => { setTab('list'); setPick([]); }}>← やめる</button><button type="button" className="go" disabled={!pick.length} onClick={() => setByeAsk({ ids: pick.slice() })} data-msx-mm-bye>お別れする({pick.length}体)</button></div>
      : <div className="v-ft"><button type="button" onClick={() => { setPage('gate'); setMsg(''); }}>← 戻る</button></div>;
  }
  // ---- 名前と染色を変える ----
  else if (page === 'edit' && cur && edit) {
    title = '名前と染色';
    body = (<div className="v-card" data-msx-r3-editbox>
      <div style={{ display: 'flex', justifyContent: 'center', height: 120 }}><MsxMmArt m={{ ...cur, colors: edit.colors, awake: 0 }} size={120}/></div>
      <label className="v-inp" style={{ display: 'flex' }}>
        <input type="text" value={edit.nick} maxLength={typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8} onChange={(e) => setEdit({ ...edit, nick: e.target.value.slice(0, typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8), err: '' })} data-msx-r3-nick
          style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0, outline: 'none', color: '#1e1b4b', font: 'inherit', fontSize: 16 }}/>
        <small>{(edit.nick || '').length} / {typeof MSX_NAME_MAX !== 'undefined' ? MSX_NAME_MAX : 8}文字</small>
      </label>
      {edit.err ? <div className="msx-note" style={{ color: '#fca5a5' }}>{edit.err}</div> : null}
      {typeof DyeRegionColorControls === 'function'
        ? <DyeRegionColorControls baseId={cur.species} colors={edit.colors}
          onChange={(idx, colorId) => { const n = edit.colors.slice(); while (n.length <= idx) n.push(null); n[idx] = colorId; setEdit({ ...edit, colors: n }); }}
          onCustom={(idx) => { const p = typeof _parseCustomColorId === 'function' ? _parseCustomColorId(edit.colors[idx]) : null; const h = p ? (p.h + 40) % 360 : 200; if (typeof _encodeCustomColorId === 'function') { const n = edit.colors.slice(); while (n.length <= idx) n.push(null); n[idx] = _encodeCustomColorId(h, 70, 55); setEdit({ ...edit, colors: n }); } }}
          big names={typeof ASSISTANT_MASMON_DYE_PARTS !== 'undefined' && ASSISTANT_MASMON_DYE_PARTS[cur.species] ? ASSISTANT_MASMON_DYE_PARTS[cur.species].map((x) => x[0]) : null}/>
        : <div className="msx-note">染色はこの端末では使えません</div>}
    </div>);
    foot = <div className="v-ft"><button type="button" onClick={() => { setEdit(null); setPage('detail'); }}>やめる</button><button type="button" className="go" onClick={saveEdit} data-msx-r3-editsave>これで決める</button></div>;
  }
  else { body = <div className="msx-note">見つかりませんでした</div>; foot = <div className="v-ft"><button type="button" onClick={() => setPage('list')}>← 戻る</button></div>; }
  return (<>
    <style>{MSX_R3_CSS}</style><style>{MSX_MM_CSS}</style>
    <MsxHd back="戻る" onBack={page === 'gate' ? onClose : page === 'list' ? () => setPage('gate') : page === 'edit' ? () => { setEdit(null); setPage('detail'); } : () => setPage('list')} title={title}/>
    <div className="v-body r3 mm" data-msx-mm={page}>{body}</div>
    {foot}
  </>);
}

const MSX_MM_CSS = `
.msx .mm{gap:0}
.msx .mm-gate{flex:1 1 0;min-height:0;display:flex;flex-direction:column;gap:12px;padding-top:8px}
.msx .mm-desk{position:relative;flex:1 1 0;min-height:200px;border-radius:16px;overflow:hidden;background:radial-gradient(circle at 70% 40%,#4c3a8a 0,#1e1a36 70%);border:1px solid #3b3566}
/* 参考 mm-02 の組み立て: 右に助手の上半身、左に吹き出し。場面の高さに上限を付けて、助手が下に寄って上が大きく空かないようにする */
.msx .mm-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 60%;opacity:.85}
.msx .mm-aid{position:absolute;right:0;bottom:0;height:100%;width:100%;object-fit:contain;object-position:right bottom;filter:drop-shadow(0 4px 8px #0008)}
.msx .mm-bub{position:absolute;z-index:1;left:10px;top:30%;max-width:62%;background:#fff;color:#1e1b4b;border-radius:14px;padding:10px 12px;font-size:13px;font-weight:900;line-height:1.5;box-shadow:0 4px 0 #0005}
.msx .mm-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;flex:none}
.msx .mm-card{min-height:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-radius:16px;background:linear-gradient(180deg,#43307a,#2a2052);border:2px solid #fde047;border-bottom-width:5px;padding:8px 6px;text-align:center}
.msx .mm-card .e{font-size:30px;line-height:1.1}
.msx .mm-card b{font-size:15px;font-weight:900}
.msx .mm-asb{grid-column:1/-1;min-height:46px;margin-top:6px;width:100%;flex-direction:column}
.msx .mm-keep{margin-top:4px;font-size:11px;font-weight:800;color:#c7d2fe;line-height:1.5}
.msx .mm-card small{font-size:10.5px;font-weight:800;color:#fde68a}
.msx .mm-memo{font-size:10.5px;color:#cbd5e1;font-weight:700;line-height:1.5}
.msx .mm-tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;margin-top:6px}
.msx .mm-tabs button{min-height:44px;border-radius:12px;background:#1e1a36;border:1.5px solid #4a4380;font-size:13px;font-weight:900;text-align:center}
.msx .mm-tabs button.on{background:linear-gradient(90deg,#f472b6,#fb923c);border-color:#fde047}
.msx .mm-tabs.sm{margin-top:0}.msx .mm-tabs.sm button{font-size:12px;border-radius:10px}
.msx .mm-hint{font-size:11px;font-weight:800;color:#f9a8d4;margin-top:6px;line-height:1.4}.msx .mm-hint.ok{color:#86efac}
.msx .mm-art{display:block;position:relative}
.msx .mm-gridw{flex:1 1 0;min-height:0;overflow-y:auto}
.msx .mm-bar{display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap}
.msx .mm-bar .cnt{flex:1;font-size:11px;font-weight:900;color:#e2e8f0;white-space:nowrap}.msx .mm-bar .cnt b{font-size:14px;color:#fde047}
.msx .mm-sel{min-height:44px;border-radius:12px;background:#1e1a36;border:1.5px solid #fde047;padding:4px 10px;font-size:11.5px;font-weight:900;white-space:nowrap}
.msx .mm-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.msx .mm-opts button{min-height:44px;border-radius:12px;background:#1e1a36;border:1.5px solid #4a4380;font-size:13px;font-weight:900;text-align:center}
.msx .mm-opts button.on{border-color:#fde047;background:#3b2f0b}
.msx .mm-byelist{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.msx .mm-byelist span{font-size:11px;font-weight:800;background:#0f172a;border-radius:8px;padding:2px 7px}
.msx .mm-top{display:grid;grid-template-columns:44% 1fr;gap:8px;margin-top:6px}
.msx .mm-l{position:relative;display:flex;flex-direction:column;align-items:center;background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:6px}
.msx .mm-nm{display:flex;align-items:center;gap:4px;max-width:100%}.msx .mm-nm b{font-size:13.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx .mm-ed{flex:none;min-width:30px;min-height:30px;border-radius:9px;background:#2b3348;font-size:13px;text-align:center}
.msx .mm-sub{font-size:10.5px;font-weight:800;color:#cbd5e1}
.msx .mm-big{width:100%;aspect-ratio:1;max-height:150px;display:flex;justify-content:center}
.msx .mm-pw{display:flex;align-items:center;flex-wrap:wrap;justify-content:center;gap:2px 5px;max-width:100%;background:#0f0d24;border-radius:10px;padding:2px 8px}
.msx .mm-pw .gd{font-style:normal;font-size:11px;font-weight:900;color:#fff;background:#7c3aed;border:1.5px solid #fde047;border-radius:8px;padding:0 5px}
.msx .mm-pw small{font-size:10px;color:#cbd5e1;font-weight:800;white-space:nowrap}.msx .mm-pw b{font-size:17px;font-weight:900;color:#fde047}
.msx .mm-fav{flex:none;min-width:30px;min-height:30px;border-radius:9px;background:#0f0d24;font-size:16px;color:#f43f5e;text-align:center}
.msx .mm-r{display:flex;flex-direction:column;gap:6px;min-width:0}
.msx .mm-st{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:6px 8px;display:flex;flex-direction:column;gap:5px}
.msx .mm-st .row{display:grid;grid-template-columns:auto 1fr;grid-template-areas:'k v' 'b b';column-gap:6px;font-size:11px;font-weight:900}
.msx .mm-st .k{grid-area:k;white-space:nowrap}.msx .mm-st .v{grid-area:v;text-align:right;color:#fde047}
.msx .mm-st .bar{grid-area:b;height:5px;border-radius:3px;background:#0b0920;overflow:hidden}.msx .mm-st .bar i{display:block;height:100%;background:linear-gradient(90deg,#f472b6,#fb923c)}
.msx .mm-kv{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:6px 9px;display:flex;flex-direction:column;gap:4px}
.msx .mm-kv div{display:flex;gap:8px;font-size:11px;font-weight:800;line-height:1.4}.msx .mm-kv b{flex:none;color:#f9a8d4;font-weight:900;min-width:5.5em}.msx .mm-kv span{min-width:0}
.msx .mm-apt{background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:6px;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;text-align:center}
.msx .mm-apt small{display:block;font-size:10.5px;font-weight:900;color:#cbd5e1}.msx .mm-apt b{font-size:20px;font-weight:900;color:#fde047}
.msx .mm-apt .note{grid-column:1/-1;font-size:10px;color:#cbd5e1;font-weight:700;text-align:left}
/* 下のタブの中身は残りの高さを全部使う札にする(下に空きを残さない・決まりは48pxまで) */
.msx .mm-low{flex:1 1 0;min-height:120px;overflow-y:auto;margin-top:6px;background:#1e1a36;border:1px solid #3b3566;border-radius:14px;padding:6px}
.msx .mm-low>.mm-kv{background:none;border:0;padding:0}
.msx .mm-tech{display:grid;grid-template-columns:52% 1fr;gap:6px}
.msx .mm-tg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;align-content:start}
.msx .mm-tg .hd{font-size:10.5px;font-weight:900;text-align:center;border-radius:8px;background:#334155;padding:1px 0}
.msx .mm-tg .tc,.msx .mm-tg .no{aspect-ratio:1;min-height:0;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px}
.msx .mm-tg .tc{background:#3b2a6b;border:1.5px solid #a78bfa}.msx .mm-tg .tc.lk{background:#1e293b;border-color:#475569;opacity:.7}
.msx .mm-tg .tc.on{border-color:#fde047;box-shadow:0 0 0 2px #fde047}.msx .mm-tg .no{background:#0f0d24;border:1px dashed #334155}
.msx .mm-td{background:#1e1a36;border:1px solid #3b3566;border-radius:12px;padding:6px 8px;display:flex;flex-direction:column;gap:3px;min-width:0}
.msx .mm-td b{font-size:12.5px;font-weight:900;color:#fde047;line-height:1.3}
.msx .mm-td div{display:flex;justify-content:space-between;gap:4px;font-size:10.5px;font-weight:800}.msx .mm-td em{font-style:normal;color:#fff}
.msx .mm-td .nt{color:#94a3b8;font-size:10.5px}
.msx .msx-md-head{display:flex;gap:4px;margin-bottom:3px}
.msx .msx-md-grade{font-style:normal;font-size:10px;font-weight:900;color:#fff;background:#7c3aed;border:1.5px solid #fde047;border-radius:8px;padding:0 5px;margin-left:3px}
.msx .mm-acts{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:6px;margin-top:6px}
.msx .mm-acts button{min-height:44px;border-radius:12px;background:#2b3348;font-size:12.5px;font-weight:900;text-align:center}
.msx .mm-acts button:disabled{opacity:.5}
`;

// ---- 本編の M/B管理 から開く口(2026-11-14 社長「M/B管理からもマスモンボックス(モンサク)を開けるように」) ----
// 公開の印 monheroSuccess が偽のあいだは札を出さない(msxReleased)。開くのはモンサクと同じマスモンボックス(見る・詳細・ハート・お別れ)
// 本体(60-app.jsx)は M/B管理 の札で msxOpenBox() を呼び、MonheroSuccessBoxHost を1つ置くだけ(助手ライフの AssistantLifeSuccessHost と同じ形)
const MSX_BOX_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach((f) => { try { f(v); } catch (e) {} }); } };
const msxOpenBox = () => { if (typeof msxReleased === 'function' && msxReleased()) MSX_BOX_HOST.set({ at: Date.now() }); };
function MonheroSuccessBoxHost({ callNameOf, bondLvOf, onOpenChange }) {
  const [open, setOpen] = useState(MSX_BOX_HOST.open);
  useEffect(() => { const f = (v) => setOpen(v); MSX_BOX_HOST.subs.add(f); return () => { MSX_BOX_HOST.subs.delete(f); }; }, []);
  useEffect(() => { try { if (onOpenChange) onOpenChange(!!open); } catch (e) {} }, [!!open]);
  if (!open || typeof msxReleased !== 'function' || !msxReleased()) return null;
  return <MonheroSuccessScreen key={open.at} startView="box" onClose={() => MSX_BOX_HOST.set(null)} callNameOf={callNameOf} bondLvOf={bondLvOf}/>;
}
