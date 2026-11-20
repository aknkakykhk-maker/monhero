// ===== モンサクのアシモン専用の見せ方(アシスト詳細・r1119-011・2026-11-20 ④段2) =====
// 手本は docs/reference/line-mf/assist-card-8-detail-2026-11-19.png(1体の詳細)。絵・名前・文は写さない。
//   MsxAssistDetail … 編成に入れる子(マスモン・メモモン・フレンド)の1体の詳細。上に大の札と「はじめの親密度・友情タッグ・得意率・総合力」、
//                      下のタブで「アシスト効果」(先に開く)と「能力」。技・素質は「技・素質を見る」から今までの詳細(MsxMonDetail)へ
//   MsxAssistCard   … アシスト効果の札1枚。ボックスの詳細(MsxMonDetail のアシストのタブ)もこれを使う
//                      1行目は短く(上限の話は押して開く・#6888 B-8)。目盛りは「目盛り n/最大」と名前を付けて丸で見せる(B-5)
// 数字はどれも芯の memberOf とアシストの表(data/monhero-success-assist.js)のまま。保存は増やさない
const msxAsAT = () => (typeof window !== 'undefined' && window.MONHERO_SUCCESS_ASSIST && window.MONHERO_SUCCESS_ASSIST.VERSION === 3 ? window.MONHERO_SUCCESS_ASSIST : null);
const msxAsScene = (AT, sc) => { const f = AT && AT.SCENES ? AT.SCENES.find((x) => x.key === sc) : null; return f ? f.name : ''; };

function MsxAssistCard({ a, n }) {
  msxAsdEnsureCss();
  const AT = msxAsAT();
  const [open, setOpen] = useState(false);
  if (!AT || !a) return null;
  const note = typeof AT.capNote === 'function' ? AT.capNote(a.id) : '';
  const full = AT.describe(a.id, n);
  const short = note && full.endsWith(note) ? full.slice(0, full.length - note.length) : full;
  const scene = msxAsScene(AT, a.scene);
  const more = !!(note || scene);
  const dots = Math.min(5, a.max); const lit = Math.round(n / Math.max(1, a.max) * dots); // 目盛りを最大5つの丸で(参考の上限解放の丸)
  return (
    <div className={`msx-md-ac${a.type === 'battle' || a.scene === 'cup' ? ' gold' : ''}${open ? ' open' : ''}`} data-msx-assist-card={a.id} data-msx-assist-type={a.type || ''}
      role={more ? 'button' : undefined} tabIndex={more ? 0 : undefined} aria-expanded={more ? open : undefined}
      onClick={more ? () => setOpen(!open) : undefined} onKeyDown={more ? (e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(!open); } : undefined}>
      <span className="ic" aria-hidden="true">{typeof cardIconNode === 'function' ? cardIconNode(a.icon, 28) : a.icon}</span>
      <div className="bd"><div className="hd"><b>{a.name} <em>{AT.valueText(a.id, n)}</em></b>
        <span className="pips" aria-label={`目盛り ${n}/${a.max}`} data-msx-assist-meter><small>目盛り</small>{Array.from({ length: dots }, (_, i) => <s key={i} className={i < lit ? 'on' : ''}/>)}<i>{n}</i>/{a.max}</span></div>
        <div className="tx">{short}{more ? <span className="mr">{open ? ' ▲' : ' ▼くわしく'}</span> : null}</div>
        {open && note ? <div className="sc" data-msx-assist-cap>上限: {note.replace(/^[(（]|[)）]$/g, '')}</div> : null}
        {open && scene ? <div className="sc">効く場面: {scene}</div> : null}</div>
    </div>
  );
}

// rec … 保存枠の子(ボックス・メモモン)。フレンドは null / mem … 芯の memberOf の結果 / kind … 'box' | 'memo' | 'friend' | 'base'
function MsxAssistDetail({ rec = null, mem, name, sub, kind = 'box', onMore = null, onClose }) {
  msxAsdEnsureCss();
  const AT = msxAsAT();
  const assists = mem && Array.isArray(mem.assists) && mem.assists.length ? mem.assists : rec && Array.isArray(rec.assists) ? rec.assists : [];
  const got = AT ? assists.filter((x) => x && AT.BY_ID[x.id]).map((x) => ({ a: AT.BY_ID[x.id], n: AT.fromSaved(x) })).filter((x) => x.n > 0) : [];
  const [tab, setTab] = useState(got.length || kind === 'base' ? 'assist' : 'stat');
  if (!mem) return null;
  const cm = typeof msxTpCardM === 'function' ? msxTpCardM(rec, mem, mem.species) : { species: mem.species };
  const pow = rec && Number.isFinite(rec.score) ? rec.score : mem.power;
  const role = kind === 'friend' ? 'フレンド' : kind === 'memo' ? 'メモモン' : kind === 'base' ? 'ベースモン' : kind === 'team' ? '編成' : 'マスモン';
  const top = Array.isArray(mem.top) ? mem.top.slice(0, 3) : [];
  return (
    <div className="msx-ov msx-fade msx-asd-ov" data-msx-assist-detail onClick={onClose}>
      <div className="msx-sheet msx-asd" onClick={(e) => e.stopPropagation()}>
        <h3>アシスト詳細</h3>
        <div className="msx-asd-top">
          <div className="art"><MonsucMonCard m={cm} size="l" tag={{ text: role, kind: kind === 'friend' ? 'friend' : kind === 'memo' ? 'memo' : kind === 'base' ? 'base' : 'box' }}/></div>
          <div className="inf">
            <b className="nm">{name}</b><small className="sub">{sub}</small>
            <div className="kv" data-msx-asd-support>
              <span><i>はじめの親密度</i><b>{mem.bond0}</b></span>
              <span><i>友情タッグ</i><b>+{Math.round(Number(mem.tag) || 0)}%</b></span>
              <span><i>得意率</i><b>{Math.round((Number(mem.fav) || 0) * 100)}%</b></span>
              <span><i>総合力</i><b>{kind === 'base' ? '—' : msxFmt(pow || 0)}</b></span>
            </div>
            {top.length ? <div className="asd-up" data-msx-asd-up><i>伸びが上がる</i>{top.map((k) => <span key={k}>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]} <b>+{Math.round((mem.bonus && mem.bonus[k]) || 0)}%</b></span>)}</div> : null}
          </div>
        </div>
        <div className="msx-asd-tabs" role="tablist">{[['assist', 'アシスト効果'], ['stat', '能力']].map(([k, t]) => <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-msx-asd-tab={k}>{t}</button>)}
          {onMore ? <button type="button" className="more" onClick={onMore} data-msx-asd-more>技・素質</button> : null}</div>
        <div className="msx-dt-body msx-asd-body">
          {tab === 'assist' ? (got.length ? <>
            <div className="msx-asd-cnt" data-msx-assist-count>アシスト効果 {got.length} / {AT ? AT.MAX_KINDS : 8}種類{kind === 'memo' ? '(メモモンは育成に使えず、アシスト効果と伸びが上がる能力だけ効く)' : ''}</div>
            {got.map(({ a, n }) => <MsxAssistCard key={a.id} a={a} n={n}/>)}</>
            : <div className="msx-note" data-msx-assist-none style={{ padding: 8 }}>{kind === 'base' ? 'ベースモンはアシスト効果を持ちません。伸びが上がる能力だけ効きます' : 'アシスト効果はまだありません'}</div>)
            : <div className="msx-asd-st" data-msx-asd-stats>{MSX_STATS.map((k) => <span key={k}><i>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]}</i><b>{Math.round((mem.stats && mem.stats[k]) || 0)}</b></span>)}</div>}
        </div>
        <button type="button" className="msx-dt-close" data-msx-asd-close onClick={onClose}>閉じる</button>
      </div>
    </div>
  );
}

const MSX_ASD_CSS = `
.msx .msx-asd-ov{z-index:60}
.msx .msx-asd{display:flex;flex-direction:column;max-height:calc(100% - 24px)}
.msx .msx-asd h3{text-align:center}
.msx .msx-asd-top{display:flex;gap:10px;align-items:flex-start;margin-top:4px}
.msx .msx-asd-top .art{flex:0 0 34%;max-width:150px}
.msx .msx-asd-top .inf{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.msx .msx-asd-top .nm{font-size:16px;font-weight:900;line-height:1.2;overflow-wrap:anywhere}
.msx .msx-asd-top .sub{font-size:11px;color:#cbd5e1;font-weight:800}
.msx .msx-asd-top .kv{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.msx .msx-asd-top .kv span{display:flex;flex-direction:column;align-items:center;background:#0f172a;border:1px solid #4a4380;border-radius:9px;padding:3px 2px}
.msx .msx-asd-top .kv i{font-style:normal;font-size:10px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .msx-asd-top .kv b{font-size:15px;color:#fde68a;font-weight:900;line-height:1.2}
.msx .msx-asd-top .asd-up{display:flex;flex-wrap:wrap;gap:3px 6px;font-size:11px;font-weight:800;align-items:center}
.msx .msx-asd-top .asd-up i{font-style:normal;color:#f9a8d4;width:100%}.msx .msx-asd-top .asd-up b{color:#86efac}
.msx .msx-asd-tabs{display:flex;gap:6px;margin:8px 0 4px}
.msx .msx-asd-tabs button{position:relative;flex:1 1 0;height:36px;margin:4px 0;display:flex;align-items:center;justify-content:center;padding:0;border-radius:10px;background:#1e293b;border:1px solid #4a4380;color:#cbd5e1;font:inherit;font-size:12.5px;font-weight:900}
.msx .msx-asd-tabs button::after{content:'';position:absolute;left:0;right:0;top:-4px;bottom:-4px}
.msx .msx-asd-tabs button.on{background:linear-gradient(90deg,#f472b6,#fb923c);color:#fff;border-color:transparent}
.msx .msx-asd-tabs button.more{flex:0 0 auto;padding:0 10px;color:#f9a8d4}
.msx .msx-asd-body{flex:1 1 auto;min-height:0;overflow-y:auto}
.msx .msx-asd-cnt{font-size:11px;font-weight:800;color:#cbd5e1;margin:2px 0}
.msx .msx-asd-st{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:4px}
.msx .msx-asd-st span{display:flex;flex-direction:column;align-items:center;background:#1e1a36;border:1px solid #3b3566;border-radius:10px;padding:5px 2px}
.msx .msx-asd-st i{font-style:normal;font-size:11px;font-weight:800;color:#cbd5e1}.msx .msx-asd-st b{font-size:17px;font-weight:900}
.msx-md-ac[role=button]{cursor:pointer}
.msx-md-ac .pips{display:inline-flex;align-items:center;gap:2px}
.msx-md-ac .pips small{font-size:10px;color:#cbd5e1;margin-right:2px}
.msx-md-ac .pips s{display:inline-block;width:7px;height:7px;border-radius:50%;background:#334155;border:1px solid #64748b;text-decoration:none}
.msx-md-ac .pips s.on{background:#22d3ee;border-color:#a5f3fc}
.msx-md-ac .pips i{margin-left:3px}
.msx-md-ac .tx .mr{color:#f9a8d4;font-size:10.5px;white-space:nowrap}
`;
let msxAsdCssDone = false;
const msxAsdEnsureCss = () => {
  if (msxAsdCssDone || typeof document === 'undefined') return;
  msxAsdCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-asd-css', '1'); el.textContent = MSX_ASD_CSS; document.head.appendChild(el);
};
