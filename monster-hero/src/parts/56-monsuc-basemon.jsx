// ===== モンヒロサクセスの「ベースモン」(2026-11-15 r1115-043 社長「ホームからベースモンの詳細を見られるように」) =====
//   ホームの札から開く。使えるベースモンの一覧 → 押すと、はじめる画面・育成中の「くわしく」と同じ部品 MsxMonDetail
//   (能力・素質・間合い適性・技の升目)。技の升の選びは、はじめる画面と同じ保存(mh_monsuc_techpick_v1)を読み書きする。
//   マスモン(育てた子)の詳細はマスモンボックスから開く(同じ部品)
function MsxBaseMons({ data, onClose }) {
  const SUC = msxSuc.SUC;
  const unlocked = Array.isArray(data.unlocked) ? data.unlocked : [];
  const [sp, setSp] = useState(null);
  const [tpAll, setTpAll] = useState(null);
  useEffect(() => { let on = true; msxReadTechPick().then((t) => { if (on) setTpAll(t); }).catch(() => { if (on) setTpAll(msxNormTechPick(null)); }); return () => { on = false; }; }, []);
  const picked = (data.meta && data.meta.picked) || {};
  let detail = null;
  if (sp) {
    const growType = typeof SUC.speciesType === 'function' ? SUC.speciesType(sp) : null;
    const startSt = typeof SUC.initStats === 'function' ? SUC.initStats(sp) : {};
    const preview = msxStartPreview(SUC, sp, growType, null, startSt);
    const apt = typeof msxAptOf === 'function' ? msxAptOf(sp) : ['C', 'C', 'C', 'C', 'C', 'C'];
    const tpSel = typeof SUC.techPickNorm === 'function' ? SUC.techPickNorm(tpAll && tpAll.base ? tpAll.base[sp] : null, sp) : {};
    const onTechPick = async (cell, id) => { const next = { ...tpSel, [cell]: id }; try { setTpAll(await msxWriteTechPick('base', sp, next)); } catch (e) { /* 書けなくても画面は動く */ } };
    detail = <MsxMonDetail pick={{ sel: tpSel, locked: () => false, onPick: onTechPick }} species={sp} name={msxMonName(sp)} sub="ベースモン" st={startSt} apt={apt} type={growType} grades={preview.grades} peak={preview.peak} power={preview.power} rank={preview.rank} onClose={() => setSp(null)} SUC={SUC}/>;
  }
  return (
    <>
      <MsxHd back="戻る" onBack={onClose} title="🌱 ベースモン"/>
      <div className="v-body">
        {/* 画面の名前は上の帯の「🌱 ベースモン」だけ。ここは使い方の1行(育-29) */}
        <div className="msx-note msx-kp" style={{ padding: '6px 4px' }}>押すと、能力・素質・間合い適性・技の升目が見られます</div>
        <div className="msx-scroll" data-msx-basemon-scroll>
        <div className="msx-bm-grid" data-msx-basemon-list>
          {unlocked.map((id) => (
            <button type="button" key={id} className="msx-bm" onClick={() => setSp(id)} data-msx-basemon={id}>
              <MsxMonFace species={id} alt=""/><b>{msxMonName(id)}</b>{picked[id] ? <small>育成 {picked[id]}回</small> : <small>まだ育てていない</small>}
            </button>))}
        </div>
        </div>
      </div>
      {detail}
    </>
  );
}
