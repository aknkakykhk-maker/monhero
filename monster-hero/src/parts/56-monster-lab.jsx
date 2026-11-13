// ===== モンスター画面(研究所・2026-11-13 キズナ) =====
// 社長の決め(台帳 2026-11-13): 図鑑はいまのまま。マスモン対戦・モンヒロサクセスで使う項目は別の「モンスター」の画面に載せる。
//   「ベースモンとマスモンは別枠にして」→ 入口は「マスモン」「ベースモン」「図鑑」の3つ。用語は docs/rules/TERMS.md
// 止め絵: docs/progress/monster-screen/(png-top.png・png-detail.png)。参考の画面は docs/reference/line-mf/monster-screens-2026-11-13/(形だけ参考)
// ★値はここで持たない。読むだけ:
//   ベースモンの6能力 … AMG_INIT(56-assistant-life-masmon-grow.jsx)/ 素質 … AMG_APT / 間合い適性 … ALL_PLAYER_MONSTERS.distAptitude(零・近・中・遠の順)
//   ガッツ回復力・移動速度・サイズ … 対戦の芯 ASSISTANT_MASMON_BATTLE.SPECIES_TRAITS(バトル部)/ 技 … ASSISTANT_MASMON_TECHS(技表)
//   マスモン … 保存枠 mh_monsuc_box_v1(msxR3ReadBox・読むだけ。何も書かない)
// ★資料が無い値は「資料待ち」。うちのオリジナル5種(エイキ・剣士モッチー・パンドラ・メロディ・クロミー)は等級が案なので「資料待ち」のまま
// ★公開の印 monsterLab が偽のあいだは、デバッグ設定の「🔬 モンスター(試す)」からだけ開く。保存には何も書かない
const MLAB_STATS = Object.freeze([['life', 'ライフ'], ['pow', 'ちから'], ['wise', 'かしこさ'], ['hit', '命中'], ['eva', '回避'], ['tough', '丈夫さ']]);
const MLAB_DIST = Object.freeze([['遠', 3, 'bg-blue-500'], ['中', 2, 'bg-green-500'], ['近', 1, 'bg-amber-500'], ['零', 0, 'bg-red-500']]);
const MLAB_NO_DATA = Object.freeze(['Eiki', 'KenshiMocchi', 'Pandora', 'Melody', 'Kuromy']);
const MLAB_SIZE = Object.freeze({ S: '小さい', M: 'ふつう', L: '大きい' });
const MLAB_WAIT = '資料待ち';

const mlabMon = (id) => (typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS && ALL_PLAYER_MONSTERS[id]) || null;
const mlabThumb = (id) => { const m = mlabMon(id); return m ? (m.faceIconUrl || m.iconUrl || m.imgUrl || '') : ''; };
const mlabFull = (id) => { const m = mlabMon(id); return m ? (m.imgUrl || m.iconUrl || '') : ''; };
// ベースモンの一覧: 6能力の表(AMG_INIT)にあり、デバッグ専用でない種類。表の並び
const mlabSpeciesList = () => {
  const init = typeof AMG_INIT === 'object' && AMG_INIT ? AMG_INIT : {};
  return Object.keys(init).filter((id) => { const m = mlabMon(id); return m && !m.debugOnly && Array.isArray(init[id]) && init[id].length === 6; });
};
const mlabBaseStats = (sp) => { const a = typeof AMG_INIT === 'object' && AMG_INIT && AMG_INIT[sp]; return Array.isArray(a) && a.length === 6 ? a.map((n) => (Number.isFinite(n) ? n : 0)) : null; };
const mlabApt = (sp) => { const s = typeof AMG_APT === 'object' && AMG_APT && AMG_APT[sp]; return typeof s === 'string' && s.length === 6 ? s.split('') : null; };
// 種類ごとの等級(対戦の芯の表を読むだけ。無い・オリジナル5種は null)
const mlabTraits = (engine, sp) => {
  if (!engine || MLAB_NO_DATA.includes(sp)) return null;
  const t = engine.SPECIES_TRAITS && engine.SPECIES_TRAITS[sp];
  return t && typeof t === 'object' ? { g: t.g, m: t.m, z: t.z } : null;
};
const mlabTechs = (sp) => {
  const t = typeof ASSISTANT_MASMON_TECHS === 'object' && ASSISTANT_MASMON_TECHS && ASSISTANT_MASMON_TECHS.species;
  return t && Array.isArray(t[sp]) ? t[sp] : [];
};
const mlabLineageName = (sp) => {
  const m = typeof MONSTER_LINEAGE_MAP === 'object' && MONSTER_LINEAGE_MAP && MONSTER_LINEAGE_MAP[sp];
  if (!m) return null;
  const nm = (k) => { const mm = mlabMon(k.charAt(0).toUpperCase() + k.slice(1)); return mm ? mm.name : k; };
  return m.main === m.sub ? `${nm(m.main)}(純血)` : `${nm(m.main)} × ${nm(m.sub)}`;
};
// 保存枠のマスモン(読むだけ・総合力の高い順)
const mlabReadMasmon = async () => {
  try {
    if (typeof msxR3ReadBox !== 'function') return [];
    const box = await msxR3ReadBox();
    const all = (box.mons || []).filter((m) => m && typeof m.species === 'string' && mlabMon(m.species));
    // 育成を終えたマスモン(総合力の高い順)と、合体で生まれたまだ育成していない合体円盤石(新しい順 = 保存枠の並びのまま)
    return {
      mas: all.filter((m) => m.raised !== false).sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0)),
      fuse: all.filter((m) => m.raised === false),
    };
  } catch (_) { return { mas: [], fuse: [] }; }
};

const MlabBtn = ({ on, onClick, children, cls = '' }) => (
  <button type="button" onClick={onClick} className={`flex-1 rounded-xl px-2 py-1.5 text-[12px] font-black active:scale-95 ${on ? 'bg-amber-500 text-amber-950' : 'bg-indigo-900/70 text-indigo-200'} ${cls}`}>{children}</button>
);
const MlabBox = ({ title, children }) => (
  <div className="mx-2.5 my-2 rounded-xl bg-indigo-950/80 p-2.5 text-[12px]">{title && <div className="mb-1.5 text-[11px] font-black text-amber-300">{title}</div>}{children}</div>
);
const MlabWait = () => <span className="text-[11px] font-bold text-indigo-300/70">{MLAB_WAIT}</span>;

function MlabCard({ sp, mon, fuse, onClick }) {
  const m = mlabMon(sp);
  return (
    <button type="button" onClick={onClick} className={`relative rounded-xl border-2 bg-indigo-900/60 p-1 text-center active:scale-95 ${fuse ? 'border-purple-400/80' : mon ? 'border-indigo-400/60' : 'border-dashed border-sky-300/70'}`}>
      {fuse ? <span className="absolute left-0.5 top-0.5 rounded bg-purple-500 px-1 text-[9px] font-black text-white">合体</span> : mon ? <span className="absolute right-1 top-0.5 text-[11px] font-black text-pink-300">{mon.rank || ''}</span> : <span className="absolute left-0.5 top-0.5 rounded bg-sky-500 px-1 text-[9px] font-black text-white">ベース</span>}
      <img src={mlabThumb(sp)} alt="" className="mx-auto h-16 w-full object-contain" draggable={false}/>
      <div className="truncate text-[10px] font-bold text-white">{mon ? (mon.nick || (m && m.name)) : (m && m.name)}</div>
      <div className="text-[9px] font-bold text-amber-200">{fuse ? '未育成' : mon ? `Lv.${Math.round(Number(mon.lv) || 1)}` : 'もとの値'}</div>
    </button>
  );
}

// 詳細。mon があればマスモン(能力の横に ベースモンからの伸び ▲)、無ければベースモン
function MlabDetail({ sp, mon, fuse, engine, onBack }) {
  const [tab, setTab] = useState('basic');
  const [sub, setSub] = useState('tech');
  const m = mlabMon(sp);
  const base = mlabBaseStats(sp); const apt = mlabApt(sp); const tr = mlabTraits(engine, sp);
  const dist = m && Array.isArray(m.distAptitude) && m.distAptitude.length === 4 ? m.distAptitude : null; // 零・近・中・遠の順
  const techs = mlabTechs(sp);
  const own = mon && !fuse && Array.isArray(mon.techs) ? mon.techs : null;
  const mine = mon && !fuse ? MLAB_STATS.map(([k]) => Number(mon.st && mon.st[k]) || 0) : null;           // マスモンだけ自分の値と ▲ を出す
  const fuseVals = fuse && mon && mon.st && MLAB_STATS.some(([k]) => Number(mon.st[k]) > 0) ? MLAB_STATS.map(([k]) => Number(mon.st[k]) || 0) : null; // 合体円盤石は ベースモンと同じ形(▲なし)
  const vals = mine || fuseVals || base;
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex gap-2 px-2.5 pt-2">
        <img src={mlabFull(sp)} alt="" className="h-32 w-28 shrink-0 rounded-xl bg-indigo-800/60 object-contain" draggable={false}/>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-black text-white">{mon ? (mon.nick || (m && m.name)) : (m && m.name)}</div>
          <div className="mb-1.5 text-[10px] font-bold text-indigo-300">{fuse ? `${m && m.name} / 合体円盤石(未育成)` : mon ? `${m && m.name}${mon.rank ? ` / ランク ${mon.rank}` : ''}${mon.score ? ` / 総合力 ${Math.round(mon.score).toLocaleString('ja-JP')}` : ''}` : 'ベースモン(種類ごとのもとの値)'}</div>
          <div className="flex gap-1">{[['basic', '基礎'], ['feature', '特徴'], ['apt', '適性']].map(([id, t]) => <MlabBtn key={id} on={tab === id} onClick={() => setTab(id)}>{t}</MlabBtn>)}</div>
        </div>
      </div>
      {tab === 'basic' && (
        <MlabBox title={mine ? '基礎ステータス(青い線 = ベースモン)' : '基礎ステータス'}>
          {!vals ? <MlabWait/> : MLAB_STATS.map(([k, label], i) => (
            <div key={k} className="my-1">
              <div className="grid grid-cols-[62px_1fr_40px_20px] items-center gap-1.5">
                <span>{label}</span>
                <span className="relative h-[7px] overflow-hidden rounded bg-indigo-950"><i className="block h-full bg-emerald-400" style={{ width: `${Math.min(100, vals[i] / 9.99)}%` }}/>{mine && base && <u className="absolute top-0 h-full w-[2px] bg-sky-300" style={{ left: `${Math.min(100, base[i] / 9.99)}%` }}/>}</span>
                <b className="text-right">{vals[i]}</b>
                <span className="text-center font-black text-pink-300" title="素質">{apt ? apt[i] : ''}</span>
              </div>
              {mine && base && <div className="text-right text-[10px] text-indigo-300">ベースモン {base[i]} → <b className={vals[i] >= base[i] ? 'text-emerald-300' : 'text-rose-300'}>{vals[i] >= base[i] ? '▲' : '▼'}{Math.abs(vals[i] - base[i])}</b></div>}
            </div>
          ))}
          <div className="mt-1 text-[10px] text-indigo-300/80">右の文字は素質(種類ごとの伸びやすさ)</div>
        </MlabBox>
      )}
      {tab === 'feature' && (
        <MlabBox title="特徴">
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex justify-between rounded-lg bg-indigo-900/70 px-2 py-1"><span>ガッツ回復力</span>{tr ? <b className="text-pink-300">{tr.g}</b> : <MlabWait/>}</div>
            <div className="flex justify-between rounded-lg bg-indigo-900/70 px-2 py-1"><span>移動速度</span>{tr ? <b className="text-pink-300">{tr.m}</b> : <MlabWait/>}</div>
            <div className="flex justify-between rounded-lg bg-indigo-900/70 px-2 py-1"><span>サイズ</span>{tr ? <b>{MLAB_SIZE[tr.z] || tr.z}</b> : <MlabWait/>}</div>
            <div className="flex justify-between rounded-lg bg-indigo-900/70 px-2 py-1"><span>血統</span><b className="truncate">{mlabLineageName(sp) || '—'}</b></div>
          </div>
        </MlabBox>
      )}
      {tab === 'apt' && (
        <>
          <MlabBox title="間合い適性">
            {!dist ? <MlabWait/> : <div className="flex justify-around">{MLAB_DIST.map(([l, di, bg]) => <div key={l} className="text-center"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black text-white ${bg}`}>{l}</span><div className="text-[22px] font-black text-pink-300">{dist[di]}</div></div>)}</div>}
          </MlabBox>
          <MlabBox title="地形適性"><MlabWait/></MlabBox>
        </>
      )}
      <div className="mx-2.5 mt-1 flex gap-1">{(mon && !fuse ? [['tech', '技'], ['skill', '能力'], ['nature', '性格'], ['history', '経歴']] : [['tech', '技'], ['skill', '能力'], ['nature', '性格'], ['event', 'イベント']]).map(([id, t]) => <MlabBtn key={id} on={sub === id} onClick={() => setSub(id)}>{t}</MlabBtn>)}</div>
      {sub === 'tech' && (
        <MlabBox title={mon && !fuse ? '技(覚えている技に ● )' : '技'}>
          {!techs.length ? <MlabWait/> : <div className="grid grid-cols-2 gap-1.5">{techs.map((t) => (
            <div key={t.id} className="rounded-lg bg-indigo-900/70 px-2 py-1 text-[11px]"><b>{own && own.includes(t.id) ? '● ' : ''}{t.name}</b><div className="text-[10px] text-indigo-300">{t.kind === 'wise' ? 'かしこさ' : 'ちから'} / ガッツ {t.guts}</div></div>
          ))}</div>}
          <div className="mt-1.5 text-[10px] text-indigo-300/80">血統ごとの技とオリジナル技・技能力は{MLAB_WAIT}(技表の作り直しのあと)</div>
        </MlabBox>
      )}
      {sub === 'skill' && <MlabBox title="アシスト能力">{mon && Array.isArray(mon.assists) && mon.assists.length ? mon.assists.map((a, i) => <div key={i} className="text-[12px]">{a.name || a.id || a.kind || '—'}</div>) : <MlabWait/>}</MlabBox>}
      {sub === 'nature' && <MlabBox title="性格"><MlabWait/></MlabBox>}
      {sub === 'event' && <MlabBox title="イベント"><MlabWait/></MlabBox>}
      {sub === 'history' && (
        <MlabBox title="経歴">
          <div>世代: {mon && mon.gen ? `${mon.gen}代目` : '—'}</div>
          <div>引退した日: {mon && mon.endAt ? new Date(mon.endAt).toLocaleDateString('ja-JP') : '—'}</div>
          <div>称号: {mon && Array.isArray(mon.titles) && mon.titles.length ? `${mon.titles.length}個` : 'なし'}</div>
        </MlabBox>
      )}
      <div className="mt-auto p-2.5 text-center"><button type="button" onClick={onBack} className="rounded-xl bg-amber-400 px-8 py-2 text-[13px] font-black text-amber-950 active:scale-95">もどる</button></div>
    </div>
  );
}

// 研究所(入口 → 一覧 → 詳細)。onOpenDex があれば「図鑑」を押せる(図鑑はいまのまま)
function MonsterLabScreen({ onClose, onOpenDex }) {
  const [view, setView] = useState('door'); // door | mas | base | detail
  const [from, setFrom] = useState('door');
  const [sel, setSel] = useState(null);     // { sp, mon }
  const [box, setBox] = useState(null); // { mas, fuse }
  const [engine, setEngine] = useState(null);
  useEffect(() => {
    let alive = true;
    mlabReadMasmon().then((l) => { if (alive) setBox(l); });
    if (typeof ambwLoadEngine === 'function') ambwLoadEngine().then((e) => { if (alive && e) setEngine(e); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const title = view === 'door' ? '研究所' : view === 'mas' ? 'マスモン一覧' : view === 'base' ? 'ベースモン一覧' : (sel && sel.fuse ? '合体円盤石詳細' : sel && sel.mon ? 'マスモン詳細' : 'ベースモン詳細');
  const back = () => { if (view === 'detail') setView(from); else if (view === 'door') onClose(); else setView('door'); };
  const species = mlabSpeciesList();
  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-[#141a33] text-white" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }} data-monster-lab>
      <div className="flex items-center justify-between border-b-2 border-indigo-500/60 bg-indigo-950 px-3 py-2.5">
        <button type="button" onClick={back} className="text-[13px] font-black text-pink-200 active:scale-95">← もどる</button>
        <span className="text-[15px] font-black">{title}</span>
        <button type="button" onClick={onClose} className="text-[13px] font-black text-indigo-200 active:scale-95">✕</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'door' && (
          <>
            <div className="m-2.5 rounded-xl bg-[#f5ead0] p-2.5 text-[13px] font-bold text-[#3b2a10]">研究所へようこそ。どちらを見ますか?</div>
            <div className="grid grid-cols-2 gap-2.5 px-2.5">
              <button type="button" onClick={() => setView('mas')} className="rounded-2xl border-2 border-pink-400 bg-[#7c3a6b] px-2 py-5 text-[15px] font-black active:scale-95">マスモン<small className="mt-1 block text-[11px] font-bold">育成を終えた1体</small></button>
              <button type="button" onClick={() => setView('base')} className="rounded-2xl border-2 border-sky-300 bg-[#1d4e7a] px-2 py-5 text-[15px] font-black active:scale-95">ベースモン<small className="mt-1 block text-[11px] font-bold">種類ごとのもとの値</small></button>
              <button type="button" onClick={() => { if (onOpenDex) onOpenDex(); }} disabled={!onOpenDex} className="col-span-2 rounded-2xl border-2 border-indigo-400/70 bg-indigo-900/70 px-2 py-3 text-[14px] font-black opacity-70 active:scale-95">図鑑<small className="ml-2 text-[11px] font-bold">いまのまま</small></button>
            </div>
          </>
        )}
        {view === 'mas' && (box === null ? <div className="p-6 text-center text-[12px] text-indigo-300">読み込み中…</div> : !box.mas.length && !box.fuse.length
          ? <div className="p-6 text-center text-[12px] font-bold text-indigo-300">まだマスモンがいません。モンヒロサクセスで育成を終えると、ここに並びます。</div>
          : <>
            <div className="px-3 pt-2.5 text-[12px] font-black text-amber-300">マスモン ({box.mas.length})</div>
            {box.mas.length ? <div className="grid grid-cols-4 gap-2 p-2.5">{box.mas.map((mm) => <MlabCard key={mm.id} sp={mm.species} mon={mm} onClick={() => { setSel({ sp: mm.species, mon: mm, fuse: false }); setFrom('mas'); setView('detail'); }}/>)}</div> : <div className="px-3 py-2 text-[11px] text-indigo-300">まだいません</div>}
            {box.fuse.length > 0 && <>
              <div className="px-3 pt-2 text-[12px] font-black text-amber-300">合体円盤石 ({box.fuse.length})</div>
              <div className="grid grid-cols-4 gap-2 p-2.5">{box.fuse.map((mm) => <MlabCard key={mm.id} sp={mm.species} mon={mm} fuse onClick={() => { setSel({ sp: mm.species, mon: mm, fuse: true }); setFrom('mas'); setView('detail'); }}/>)}</div>
            </>}
            <div className="p-2 text-center text-[11px] text-indigo-300">保存枠 {box.mas.length + box.fuse.length}体</div>
          </>)}
        {view === 'base' && (
          <><div className="grid grid-cols-4 gap-2 p-2.5">{species.map((sp) => <MlabCard key={sp} sp={sp} onClick={() => { setSel({ sp, mon: null }); setFrom('base'); setView('detail'); }}/>)}</div><div className="p-2 text-center text-[11px] text-indigo-300">図鑑とは別。ベースモンは種類ごとのもとの値です</div></>
        )}
        {view === 'detail' && sel && <MlabDetail sp={sel.sp} mon={sel.mon} fuse={sel.fuse} engine={engine} onBack={back}/>}
      </div>
    </div>
  );
}

// デバッグ設定からの入口(公開の印 monsterLab が偽のあいだの試し口。デバッグ専用なので更新履歴・ヘルプには載せない)
function MonsterLabDebugEntry({ onOpenDex }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-debug-monster-lab onClick={() => setOpen(true)} className="w-full min-h-[58px] rounded-2xl border-2 border-sky-400/60 bg-sky-950/40 px-3 py-2 text-left text-[12px] font-black text-sky-50 active:scale-95">
        🔬 モンスター(試す)
        <small className="mt-0.5 block text-[9px] font-bold leading-relaxed text-sky-200/80">公開前のモンスター画面。マスモンとベースモンの値を見る。読むだけで何も保存しない</small>
      </button>
      {open && <MonsterLabScreen onClose={() => setOpen(false)} onOpenDex={onOpenDex}/>}
    </>
  );
}
