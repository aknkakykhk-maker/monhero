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
  // 上限・効く場面は短いので、たたまずに最初から出す(開く印の「▲」と窓の「閉じる」が並んで、どちらで閉じるか分からなかった。r1119-033 窓-01)
  const more = false;
  const dots = Math.min(10, a.max); const lit = Math.round(n / Math.max(1, a.max) * dots); // 目盛りを丸で(10より多い目盛りは10個の丸に縮める。数と丸がずれないよう10まではそのまま)
  return (
    <div className={`msx-md-ac${a.type === 'battle' || a.scene === 'cup' ? ' gold' : ''}${open ? ' open' : ''}`} data-msx-assist-card={a.id} data-msx-assist-type={a.type || ''}
      role={more ? 'button' : undefined} tabIndex={more ? 0 : undefined} aria-expanded={more ? open : undefined}
      onClick={more ? () => setOpen(!open) : undefined} onKeyDown={more ? (e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(!open); } : undefined}>
      <span className="ic" aria-hidden="true">{typeof cardIconNode === 'function' ? cardIconNode(a.icon, 28) : a.icon}</span>
      {/* 数字は説明の文の1か所だけ(見出しの「+10%」と文の「+10%」が二重だった)。目盛りは数だけ(丸と数の二重をやめた)。
          上限・効く場面は全幅のボタンをやめ、見出しの右の小さな印で開く(2026-11-20 r1119-033 育-43・育-46・育-47・育-150・育-155) */}
      {/* 見出しは効果名だけ。数字は説明の文の1か所(目盛りの数が見出しの横にあると「+3」と二重に見えた)。
          目盛りは文の下に、次の目盛りで何が増えるかと一緒に出す(2026-11-20 r1119-033 育-07) */}
      <div className="bd"><div className="hd"><b>{a.name}</b>
        {more ? <span className="mr" aria-hidden="true">{open ? '▲' : 'ⓘ'}</span> : null}</div>
        <div className="tx">{short}</div>
        <div className="pips" aria-label={`目盛り ${n}/${a.max}`} data-msx-assist-meter data-msx-assist-lit={lit}><small>強さの目盛り</small><i>{n}</i>/{a.max}
          <small className="nx">{n < a.max && typeof AT.valueText === 'function' ? `(次の目盛りで ${AT.valueText(a.id, n + 1)})` : '(最大)'}</small></div>
        {note ? <div className="sc" data-msx-assist-cap>上限: {note.replace(/^[(（]|[)）]$/g, '')}</div> : null}
        {scene ? <div className="sc">効く場面: {scene}</div> : null}
        {open ? <div className="sc">目盛り … 効果の強さ。育て終えたときのアシストポイントで上げる</div> : null}</div>
    </div>
  );
}

// rec … 保存枠の子(ボックス・メモモン)。フレンドは null / mem … 芯の memberOf の結果 / kind … 'box' | 'memo' | 'friend' | 'base'
function MsxAssistDetail({ rec = null, mem, name, sub, kind = 'box', dropped = 0, droppedNames = [], onMore = null, onClose }) {
  msxAsdEnsureCss();
  const AT = msxAsAT();
  const assists = mem && Array.isArray(mem.assists) && mem.assists.length ? mem.assists : rec && Array.isArray(rec.assists) ? rec.assists : [];
  const got = AT ? assists.filter((x) => x && AT.BY_ID[x.id]).map((x) => ({ a: AT.BY_ID[x.id], n: AT.fromSaved(x) })).filter((x) => x.n > 0) : [];
  // ベースモンはアシスト効果を持たないので、札の切り替えを出さず能力だけ見せる(「持ちません」の1文だけの札だった。r1119-033 窓-48)
  const [tab, setTab] = useState((got.length && kind !== 'base') || dropped > 0 ? 'assist' : 'stat'); // 確かめで外れたフレンドは理由の文をアシストの札に出す
  const [kvTip, setKvTip] = useState(null); // 4つの数字の札を押すと、その言葉の説明を1行で出す(長い説明の段落をやめた・育-08)
  if (!mem) return null;
  const cm = typeof msxTpCardM === 'function' ? msxTpCardM(rec, mem, mem.species) : { species: mem.species };
  const pow = rec && Number.isFinite(rec.score) ? rec.score : mem.power;
  const role = kind === 'friend' ? 'フレンド' : kind === 'memo' ? 'メモモン' : kind === 'base' ? 'ベースモン' : kind === 'team' ? '編成' : 'マスモン';
  const top = Array.isArray(mem.top) ? mem.top.slice(0, 3) : [];
  return (
    <div className="msx-ov msx-fade msx-asd-ov" data-msx-assist-detail role="dialog" aria-modal="true" onClick={onClose}>
      <div className="msx-sheet msx-asd" onClick={(e) => e.stopPropagation()}>
        <h3>アシスト詳細</h3>
        <div className="msx-asd-top">
          {/* 名前と種類は右の見出しだけ(絵の札の名前帯・種類の札と二重だった・2026-11-20 r1119-033 育-102)。空いた分は絵を大きく */}
          <div className="art nostrip"><MonsucMonCard m={cm} size="l"/></div>
          <div className="inf">
            <b className="nm">{name}</b><small className="sub">{sub && String(sub).includes(role) ? sub : [role, sub].filter(Boolean).join('・')}</small>
            <div className="kv" data-msx-asd-support>
              {[['bond', '初めの親密度', mem.bond0, '育成を始めたときの親密度。'],
                ['tag', '友情タッグ', `+${Math.round(Number(mem.tag) || 0)}%`, '親密度80から、いっしょのトレーニングの伸びが上がる。'],
                ['fav', '得意率', `+${Math.round((Number(mem.fav) || 0) * 100)}%${top[0] ? `(${MSX_STAT_ICON[top[0]] || ''}${MSX_STAT_NAME[top[0]] || ''})` : ''}`, '来たとき、一番得意な能力のトレーニングに行く確率。'], // r1119-054: 1位の得意だけ・強さの段で15〜35%
                kind === 'base' ? null : ['pow', '総合力', msxFmt(pow || 0), '6つの能力から出す強さ。']].filter(Boolean).map(([k, t, v]) => (
                <button type="button" key={k} className={kvTip === k ? 'on' : ''} aria-expanded={kvTip === k} onClick={() => setKvTip(kvTip === k ? null : k)} data-msx-asd-kv={k}><i>{t}</i><b>{v}</b></button>))}
            </div>
            {kvTip ? <small className="asd-kvn" data-msx-asd-kv-tip>{({ bond: '初めの親密度 … 育成を始めたときの親密度。', tag: '友情タッグ … 親密度80から、いっしょのトレーニングの伸びが上がる。', fav: '得意率 … 来たとき、一番得意な能力のトレーニングに行く確率。強さの段で15〜35%(得意率アップで45%まで)。来ないこともあります。', pow: '総合力 … 6つの能力から出す強さ。' })[kvTip]}</small>
              : <small className="asd-kvn">数字を押すと説明</small>}
            {top.length ? <div className="asd-up" data-msx-asd-up><i>伸びが上がる</i>{top.map((k) => <span key={k}>{MSX_STAT_ICON[k]}{MSX_STAT_NAME[k]} <b>+{Math.round((mem.bonus && mem.bonus[k]) || 0)}%</b></span>)}</div> : null}
          </div>
        </div>
        <div className="msx-asd-tabs" role="tablist">{(kind === 'base' ? [] : [['assist', 'アシスト効果'], ['stat', '能力']]).map(([k, t]) => <button type="button" key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-msx-asd-tab={k}>{t}</button>)}
          {onMore ? <button type="button" className="more" onClick={onMore} data-msx-asd-more>技・素質</button> : null}</div>
        <div className="msx-dt-body msx-asd-body">
          {tab === 'assist' ? (got.length ? <>
            <div className="msx-asd-cnt" data-msx-assist-count>持っているアシスト効果 {got.length}つ(最大{AT ? AT.MAX_KINDS : 8}種類)</div>
            {got.map(({ a, n }) => <MsxAssistCard key={a.id} a={a} n={n}/>)}</>
            : <div className="msx-note" data-msx-assist-none style={{ padding: 8 }}>{kind === 'base' ? 'ベースモンはアシスト効果を持ちません。伸びが上がる能力だけ効きます' : dropped > 0 ? `このモンスターのアシスト効果(${droppedNames.length ? droppedNames.join('・') : `${dropped}つ`})は、能力から取れる強さを超えているため、編成に入れても効きません。伸びが上がる能力だけ効きます` : 'アシスト効果はまだありません'}</div>)
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
.msx .msx-asd-top .art{flex:0 0 38%;max-width:170px}.msx .msx-asd-top .art.nostrip .mcd-strip,.msx .msx-asd-top .art.nostrip .mcd-lv,.msx .msx-asd-top .art.nostrip .mcd-fav{display:none}
.msx .msx-asd-top .inf{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.msx .msx-asd-top .nm{font-size:16px;font-weight:900;line-height:1.2;overflow-wrap:anywhere}
.msx .msx-asd-top .sub{font-size:11px;color:#cbd5e1;font-weight:800}
.msx .msx-asd-top .kv{display:grid;grid-template-columns:1fr 1fr;gap:4px}
.msx .msx-asd-top .kv button{display:flex;flex-direction:column;align-items:center;background:#0f172a;border:1px solid #4a4380;border-radius:9px;padding:3px 2px;color:#fff;font:inherit;min-height:40px}.msx .msx-asd-top .kv button.on{border-color:#f472b6}
.msx .msx-asd-top .kv i{font-style:normal;font-size:11px;color:#cbd5e1;font-weight:800;white-space:nowrap}
.msx .msx-asd-top .kv b{font-size:15px;color:#fde68a;font-weight:900;line-height:1.2}
.msx .msx-asd-top .asd-up{display:flex;flex-wrap:wrap;gap:3px 8px;font-size:12px;font-weight:800;align-items:center}
.msx .msx-asd-top .asd-up i{font-style:normal;color:#f9a8d4;width:100%}.msx .msx-asd-top .asd-up b{color:#86efac}
.msx .msx-asd-tabs{display:flex;gap:6px;margin:8px 0 4px}
.msx .msx-asd-tabs button{position:relative;flex:1 1 0;height:36px;margin:4px 0;display:flex;align-items:center;justify-content:center;padding:0;border-radius:10px;background:#1e293b;border:1px solid #4a4380;color:#cbd5e1;font:inherit;font-size:12.5px;font-weight:900}
.msx .msx-asd-tabs button::after{content:'';position:absolute;left:0;right:0;top:-4px;bottom:-4px}
/* 選んだ札は決めるボタン(橙)と見分けるよう、控えめな下線にする(窓-48) */
.msx .msx-asd-tabs button.on{background:#2b2350;color:#fde047;border-color:#4a4380;box-shadow:inset 0 -3px 0 #fde047}
.msx .msx-asd-tabs button.more{color:#f9a8d4}
.msx .msx-asd-body{flex:1 1 auto;min-height:0;overflow-y:auto}
.msx .msx-asd-cnt{font-size:11px;font-weight:800;color:#cbd5e1;margin:2px 0}
.msx .msx-asd-st{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:4px}
.msx .msx-asd-st span{display:flex;flex-direction:column;align-items:center;background:#1e1a36;border:1px solid #3b3566;border-radius:10px;padding:5px 2px}
.msx .msx-asd-st i{font-style:normal;font-size:11px;font-weight:800;color:#cbd5e1}.msx .msx-asd-st b{font-size:17px;font-weight:900}
.msx-md-ac[role=button]{cursor:pointer}
.msx-md-ac .pips{display:inline-flex;align-items:center;gap:2px}
.msx-md-ac .hd{flex-direction:column;align-items:flex-start;gap:3px} /* 名前を1行に使い、目盛りは下の行へ(長い名前が途中で折れない) */
.msx .msx-asd .msx-dt-close{flex:none;display:flex;align-items:center;justify-content:center}
.msx-md-ac .pips small{font-size:10px;color:#cbd5e1;margin-right:2px}
.msx-md-ac .pips s{display:inline-block;width:6px;height:6px;border-radius:50%;background:#334155;border:1px solid #64748b;text-decoration:none}
.msx-md-ac .pips s.on{background:#22d3ee;border-color:#a5f3fc}
.msx-md-ac .pips i{margin-left:3px}
.msx .msx-md-ac{position:relative}
.msx .msx-md-ac>.bd>.hd>.mr{position:absolute;right:7px;top:7px;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;margin:0;border-radius:50%;background:#0f172a;border:1px solid #4a4380;color:#f9a8d4;font-size:12px;font-weight:900}
.msx .msx-md-ac>.bd>.hd>b{padding-right:26px}
.msx .msx-asd-top .asd-kvn{font-size:10.5px;color:#cbd5e1;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere}
.msx-md-ac .pips .nx{font-size:10px;color:#94a3b8;font-weight:800;margin-left:4px}
`;
let msxAsdCssDone = false;
const msxAsdEnsureCss = () => {
  if (msxAsdCssDone || typeof document === 'undefined') return;
  msxAsdCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-asd-css', '1'); el.textContent = MSX_ASD_CSS; document.head.appendChild(el);
};
