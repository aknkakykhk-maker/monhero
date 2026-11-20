// ===== モンヒロサクセスの「ひとときの状態」を見せる(r1119-029・2026-11-20 社長「そんなのあったんだ。分かりやすくして」) =====
// 状態の中身(名前・効き目・続くターン)は芯の SUC.events.BUFFS がただ1つの正本。ここは見せるだけで、何も保存しない。
//   msxBuffDef(k)        … { k, icon, name, text, long, good, dur }(dur は付いたときの長さ「3ターン」「次の修行まで」)
//   msxBuffGrantText(k)  … 付いたときの1行「🔥 やる気満々(3ターン): トレーニングの大成功 +10%・…」(出来事の結果・選択肢の詳細で使う)
//   msxBuffNow(s)        … いま付いている物の並び(芯の6つ+「💡 コツをつかんだ」= 芯の s.hirameki)。left は残りの言い方
//   MsxBuffChips({ s })  … 毎ターンの画面の札(良い=緑・悪い=赤)。押すと説明の窓。前のターンにあって消えた物は「切れた」の札を1ターンだけ
// 「💡 コツをつかんだ」は、編成のモンスターに「コツを教わる」・休むの🎲トレーニングチャンスで付く芯の旗(次のトレーニングの大成功 +10%・トレーニングで消える)。
//   名前の似た「✨ ひらめき中」(出来事・修行で技を覚えやすい)と取り違えないよう、別の名前で出す

const MSX_BUFF_KOTSU = Object.freeze({ k: 'kotsu', icon: '💡', name: 'コツをつかんだ', good: true, text: '次のトレーニングの大成功 +10%', long: '次にトレーニングをしたとき、大成功が出る確率が 10% 上がります。トレーニングをすると消えます(ターンでは消えません)。', dur: '次のトレーニングまで' });
const msxBuffTable = () => { const E = typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC ? msxSuc.SUC.events : null; return (E && E.BUFFS) || {}; };
const msxBuffDef = (k) => {
  if (k === 'kotsu') return MSX_BUFF_KOTSU;
  const B = msxBuffTable()[k]; if (!B) return null;
  return { k, icon: B.icon, name: B.name, text: B.text, long: B.long || B.text, good: B.good !== false, dur: B.left > 0 ? `${B.left}ターン` : '次の修行まで' };
};
const msxBuffGrantText = (k, got = false) => { const d = msxBuffDef(k); return d ? `${d.icon} ${d.name}${got ? 'になった' : ''}(${d.dur}): ${d.text}` : ''; }; // got = 付いた結果の行(「やる気満々になった(3ターン): …」)
const msxBuffNow = (s) => {
  const out = [];
  const E = typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC ? msxSuc.SUC.events : null;
  const list = E && typeof E.buffs === 'function' ? E.buffs(s) : [];
  list.slice(0, 2).forEach((b) => {
    const d = msxBuffDef(b.k); if (!d) return;
    const x = { ...d, left: Number.isFinite(b.left) ? `あと${b.left}ターン` : d.dur };
    // 🤝息ぴったりは、だれと息が合ったかを説明に出す
    const m = b.k === 'iki' && Number.isInteger(b.with) && s && Array.isArray(s.team) ? s.team[b.with] : null;
    if (m && typeof msxMemberName === 'function') x.long = `${msxMemberName(m)}と息が合っています。${d.long}`;
    out.push(x);
  });
  if (s && s.hirameki === true) out.push({ ...MSX_BUFF_KOTSU, left: MSX_BUFF_KOTSU.dur });
  return out;
};
// 前のターンに付いていて、いま消えた物(同じ育成・ターンが1つ進んだときだけ)。保存しない覚え書き
const msxBuffMemo = { id: null, turn: null, ks: [], gone: [] };
const msxBuffGone = (s) => {
  if (!s) return [];
  const ks = msxBuffNow(s).map((b) => b.k);
  const m = msxBuffMemo;
  if (m.id === s.id && m.turn === s.turn) { m.ks = ks; return m.gone.filter((k) => !ks.includes(k)); }
  const gone = m.id === s.id && Number.isInteger(m.turn) && s.turn === m.turn + 1 ? m.ks.filter((k) => !ks.includes(k)) : [];
  m.id = s.id; m.turn = s.turn; m.ks = ks; m.gone = gone;
  return gone;
};

const MSX_BUFF_CSS = `
.msx .v-chip.msx-bf{cursor:pointer;font:inherit;font-size:10.5px;font-weight:900;color:inherit;display:inline-flex;align-items:center;gap:3px;min-height:26px;position:relative}
.msx .v-chip.msx-bf::after{content:'';position:absolute;inset:-6px -4px}
.msx .v-chip.msx-bf.g{background:#14532d;border-color:#86efac;color:#dcfce7}
.msx .v-chip.msx-bf.b{background:#7f1d1d;border-color:#fca5a5;color:#fee2e2}
.msx .v-chip.msx-bf.end{background:#1f2937e0;border-color:#64748b;color:#cbd5e1;font-weight:800}
.msx .v-chip.msx-bf small{font-size:10px;font-weight:800;opacity:.9}
.msx-bf-pop{position:fixed;inset:0;z-index:9500;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px}
.msx-bf-pop .bx{width:min(340px,100%);background:#1e1a36;border:2px solid #86efac;border-radius:14px;padding:12px;color:#f1f5f9;font-family:inherit;box-shadow:0 8px 24px #000a}
.msx-bf-pop .bx.b{border-color:#fca5a5}
.msx-bf-pop .hd{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900}
.msx-bf-pop .tg{margin-left:auto;font-size:10.5px;font-weight:900;border-radius:99px;padding:2px 8px;background:#14532d;color:#dcfce7;white-space:nowrap}
.msx-bf-pop .bx.b .tg{background:#7f1d1d;color:#fee2e2}
.msx-bf-pop .lf{margin-top:6px;font-size:12px;font-weight:900;color:#fde047}
.msx-bf-pop .ln{margin-top:6px;font-size:12.5px;line-height:1.6;word-break:auto-phrase}
.msx-bf-pop .nt{margin-top:6px;font-size:10.5px;color:#94a3b8;line-height:1.5;word-break:auto-phrase}
.msx-bf-pop button{display:block;width:100%;min-height:44px;margin-top:10px;border:0;border-radius:12px;background:#2b3348;color:#f1f5f9;font:inherit;font-size:13px;font-weight:900;cursor:pointer}
`;
let msxBuffCssDone = false;
const msxBuffEnsureCss = () => {
  if (msxBuffCssDone || typeof document === 'undefined') return;
  msxBuffCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-buff-css', '1'); el.textContent = MSX_BUFF_CSS; document.head.appendChild(el);
};

function MsxBuffPop({ b, onClose }) {
  if (!b) return null;
  const node = (
    <div className="msx-bf-pop" data-msx-buff-pop={b.k} onClick={onClose}>
      <div className={`bx${b.good ? '' : ' b'}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={b.name}>
        <div className="hd">{cardIconNode(b.icon, 20)} {b.name}<span className="tg">{b.good ? '良い状態' : '悪い状態'}</span></div>
        <div className="lf">{b.ended ? 'このターンで切れました' : b.left}</div>
        <div className="ln">{b.long}</div>
        {b.k === 'kotsu' ? null : <div className="nt">ひとときの状態は、同時に2つまで付きます。3つ目が付くと、古いほうが消えます。</div>}
        <button type="button" onClick={onClose} data-msx-buff-close>閉じる</button>
      </div>
    </div>
  );
  return typeof document !== 'undefined' && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal ? ReactDOM.createPortal(node, document.body) : node;
}

function MsxBuffChips({ s }) {
  msxBuffEnsureCss();
  const [open, setOpen] = useState(null);
  const now = msxBuffNow(s);
  const gone = msxBuffGone(s).map((k) => msxBuffDef(k)).filter(Boolean);
  if (!now.length && !gone.length) return null;
  return (<>
    {now.map((b) => <button type="button" key={b.k} className={`v-chip msx-bf ${b.good ? 'g' : 'b'}`} data-msx-buff-chip={b.k} onClick={() => setOpen(b)}>{cardIconNode(b.icon, 14)} {b.name} <small>{b.left}</small></button>)}
    {gone.map((b) => <button type="button" key={`end-${b.k}`} className="v-chip msx-bf end" data-msx-buff-end={b.k} onClick={() => setOpen({ ...b, ended: true })}>{cardIconNode(b.icon, 14)} {b.name} <small>が切れた</small></button>)}
    <MsxBuffPop b={open} onClose={() => setOpen(null)}/>
  </>);
}
