// ===== モンヒロサクセスの持ち物を使ったときの演出(2026-11-15 社長 r1115-079「これももっと使った描写いれて」) =====
// 何も保存しない・公開の印は持たない(持ち物の画面 MsxBag からだけ呼ぶ)。数は芯の useItem の前と後の状態の差と、芯の表(ITEMS・ITEM_FX)だけを使う。
//   msxItemFxOf(key, s0, s1) … 種類(色・形)と、変わった物の札・このターンだけの効き目の文
//   MsxItemUseFx({ run, fx, onDone }) … 場面に重ねる: 持ち物の絵が飛び込む → 育てる子が光る → 「◯◯を使った!」と効き目の札。押すと閉じる
//   上の帯の体力・ストレスのゲージは MsxBand の hpFrom・stFrom で前の値から動く(呼ぶ側)。忠誠度・人気の増減の数字も MsxBand が出す
// 動きを減らす設定では動かさず、そのまま札を出す。音は SuccessSound(消音・音量はそちらが見る)
const MSX_IFX_KIND = Object.freeze({
  heal: { c1: '#4ade80', c2: '#bbf7d0', pt: ['➕', '✨', '💚'], se: 'itemHeal', word: '体力が回復!' },
  calm: { c1: '#67e8f9', c2: '#cffafe', pt: ['🌿', '✨', '💧'], se: 'itemHeal', word: 'すっきり!' },
  fruit: { c1: '#fb923c', c2: '#fed7aa', pt: ['💥', '✨', '🔥'], se: 'itemBuff', word: '力がみなぎる!' },
  elixir: { c1: '#a78bfa', c2: '#ede9fe', pt: ['🫧', '✨', '🫧'], se: 'itemBuff', word: '技のひらめきが冴える!' },
  star: { c1: '#facc15', c2: '#fef9c3', pt: ['⭐', '✨', '🌟'], se: 'itemBuff', word: 'キラキラ輝く!' },
  bond: { c1: '#f472b6', c2: '#fce7f3', pt: ['💗', '✨', '💞'], se: 'itemBond', word: '気持ちが通じた!' },
  box: { c1: '#d97706', c2: '#fde68a', pt: ['🎁', '✨', '🎉'], se: 'itemBox', word: '中身が出てきた!' },
  loupe: { c1: '#818cf8', c2: '#e0e7ff', pt: ['🔍', '✨', '💡'], se: 'itemBuff', word: '準備ばっちり!' },
  max: { c1: '#f87171', c2: '#fecaca', pt: ['🍑', '✨', '💪'], se: 'itemHeal', word: 'おなかいっぱい!' },
});
// 汁の色(赤・橙・緑・藍)。間合いの名前は芯の d(0 零・1 近・2 中・3 遠)
const MSX_IFX_ELIXIR = Object.freeze([['#ef4444', '零'], ['#f97316', '近'], ['#22c55e', '中'], ['#6366f1', '遠']]);
const msxIfxCalm = () => typeof msxFxCalm === 'function' && msxFxCalm();
const msxIfxNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

function msxItemFxOf(key, s0, s1) {
  const SUC = typeof msxSuc !== 'undefined' && msxSuc ? msxSuc.SUC : null;
  const it = (SUC && SUC.ITEMS && SUC.ITEMS[key]) || {};
  const FX = (SUC && SUC.ITEM_FX) || { fruit: 1.5, pop: 1.5, elixir: 20 };
  const chips = []; const buffs = [];
  const a = s0 || {}; const b = s1 || {};
  const d = (k) => Math.round(msxIfxNum(b[k]) - msxIfxNum(a[k]));
  if (d('hpMax')) chips.push({ t: '❤️ 体力の最大値', v: d('hpMax') });
  if (d('hp')) chips.push({ t: '❤️ 体力', v: d('hp') });
  if (d('stress')) chips.push({ t: '💢 ストレス', v: d('stress'), good: d('stress') < 0 });
  if (d('ama')) chips.push({ t: '💗 甘え度', v: d('ama') });
  if (d('fear')) chips.push({ t: '😨 恐れ度', v: d('fear') });
  const cured = Object.keys(a.yosu || {}).filter((k) => a.yosu[k] && !(b.yosu || {})[k]);
  const yName = typeof MSX_YOSU_NAME !== 'undefined' ? MSX_YOSU_NAME : {};
  cured.forEach((k) => chips.push({ t: `🩺「${yName[k] || k}」が治った`, v: null }));
  if (it.gives) Object.entries(it.gives).forEach(([k, n]) => { const nm = (SUC && SUC.ITEMS && SUC.ITEMS[k] && SUC.ITEMS[k].name) || k; chips.push({ t: `🎁 ${nm}`, v: n, unit: '個' }); });
  if (it.fruit) buffs.push(`このターンのトレーニングで、${(typeof MSX_STAT_NAME !== 'undefined' && MSX_STAT_NAME[it.fruit]) || it.fruit}の伸び ×${FX.fruit}`);
  if (Number.isInteger(it.elixir)) buffs.push(`このターンの修行で、${(MSX_IFX_ELIXIR[it.elixir] || [])[1] || ''}の間合いの技を覚える率 +${FX.elixir}`);
  if (it.popTurn) buffs.push(`このターンだけ、人気の上がり ×${FX.pop}`);
  if (it.issaSure) buffs.push('このターン、博士の実験が必ず成功する');
  if (it.hpFull && !d('hp')) chips.push({ t: '❤️ 体力はもう満タン', v: null });
  if (it.cure && !cured.length) chips.push({ t: '🩺 悪いようすは無かった', v: null });
  const kind = it.fruit ? 'fruit' : Number.isInteger(it.elixir) ? 'elixir' : it.popTurn ? 'star' : it.gives ? 'box' : it.issaSure ? 'loupe' : (it.ama || it.fear || it.loyal) ? 'bond' : it.hpMax ? 'max' : (it.stress && !it.hp && !it.hpFull) ? 'calm' : 'heal';
  const K = { ...MSX_IFX_KIND[kind] };
  if (kind === 'elixir' && MSX_IFX_ELIXIR[it.elixir]) { K.c1 = MSX_IFX_ELIXIR[it.elixir][0]; }
  if (!chips.length && !buffs.length) chips.push({ t: '変化なし', v: null });
  return { kind, K, chips, buffs };
}

const MSX_IFX_CSS = `
.msx .msx-ifx{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:10px;cursor:pointer;background:radial-gradient(circle at 50% 42%,var(--c1a),#0f0d24e6 62%);animation:msxIfxIn .25s ease-out both}
.msx .msx-ifx .ifx-rays{position:absolute;inset:-40%;pointer-events:none;background:repeating-conic-gradient(from 0deg at 50% 50%,var(--c1b) 0 8deg,#0000 8deg 18deg);animation:msxIfxSpin 9s linear infinite;opacity:.6}
.msx .msx-ifx .ifx-st{position:relative;width:min(220px,60%);aspect-ratio:1/1;flex:none}
.msx .msx-ifx .ifx-st .ifx-mon{position:absolute;left:50%;bottom:0;height:88%;width:84%;display:block;transform:translateX(-50%);filter:drop-shadow(0 6px 4px #0008);animation:msxIfxMon .6s cubic-bezier(.2,1.4,.4,1) .55s both}
.msx .msx-ifx .ifx-st .glow{position:absolute;inset:6%;border-radius:50%;background:radial-gradient(var(--c2),var(--c1a) 45%,transparent 70%);opacity:0;animation:msxIfxGlow .9s ease-out .5s both}
.msx .msx-ifx .ifx-st .ring{position:absolute;left:50%;top:55%;width:100%;height:100%;border-radius:50%;border:5px solid var(--c1);box-shadow:0 0 18px var(--c1);opacity:0;transform:translate(-50%,-50%) scale(.2);animation:msxIfxRing .7s ease-out .5s both}
.msx .msx-ifx .ifx-st .it{position:absolute;left:50%;top:0;font-size:54px;line-height:1;opacity:0;filter:drop-shadow(0 0 10px var(--c1)) drop-shadow(0 3px 0 #0007);animation:msxIfxItem .55s cubic-bezier(.3,0,.5,1) both}
.msx .msx-ifx .ifx-st .pt{position:absolute;left:50%;top:55%;font-style:normal;font-size:18px;opacity:0;animation:msxIfxPt 1s ease-out both;animation-delay:calc(.55s + var(--i) * .05s)}
.msx .msx-ifx .ifx-hd{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;font-weight:900;color:#fff;line-height:1.25;animation:msxIfxPop .4s cubic-bezier(.2,1.4,.4,1) .7s both}
.msx .msx-ifx .ifx-hd b{display:block;max-width:100%;font-size:min(24px,6.4vw);-webkit-text-stroke:2px #1e1a36;paint-order:stroke fill;text-shadow:0 0 12px var(--c1),0 3px 0 #1e1a36}
.msx .msx-ifx .ifx-hd small{display:block;font-size:13px;color:var(--c2);text-shadow:0 1px 0 #000}
.msx .msx-ifx .ifx-ch{position:relative;display:flex;flex-wrap:wrap;justify-content:center;gap:5px;max-width:100%}
.msx .msx-ifx .ifx-ch span{display:inline-flex;align-items:center;justify-content:center;gap:4px;background:#1e1a36;border:1.5px solid var(--c1);border-radius:99px;padding:3px 11px;font-size:12.5px;font-weight:900;color:#fff;white-space:nowrap;box-shadow:0 0 8px var(--c1a);animation:msxIfxPop .35s cubic-bezier(.2,1.4,.4,1) both;animation-delay:calc(.85s + var(--i) * .08s)}
.msx .msx-ifx .ifx-ch span em{font-style:normal;color:#fde047}
.msx .msx-ifx .ifx-ch span em.dn{color:#fca5a5}
.msx .msx-ifx .ifx-ch span em.gd{color:#86efac}
.msx .msx-ifx .ifx-bf{position:relative;max-width:100%;text-align:center;background:linear-gradient(90deg,transparent,var(--c1a) 15%,var(--c1a) 85%,transparent);border-top:1.5px solid var(--c1);border-bottom:1.5px solid var(--c1);padding:4px 16px;font-size:12.5px;font-weight:900;color:#fff;text-shadow:0 1px 0 #000;animation:msxIfxPop .4s cubic-bezier(.2,1.4,.4,1) 1s both}
.msx .msx-ifx .ifx-bf small{display:block;font-size:10.5px;color:var(--c2)}
.msx .msx-ifx .ifx-tap{position:relative;font-size:10.5px;color:#ffffffaa;animation:msxIfxPop .3s ease-out 1.4s both}
.msx .msx-ifx.calm *,.msx .msx-ifx.calm{animation:none!important}
.msx .msx-ifx.calm .ifx-st .it{opacity:1;transform:translate(-50%,-10%) scale(.7)}
.msx .msx-ifx.calm .ifx-st .glow{opacity:1}
@keyframes msxIfxIn{from{opacity:0}to{opacity:1}}
@keyframes msxIfxSpin{to{transform:rotate(360deg)}}
@keyframes msxIfxItem{0%{opacity:0;transform:translate(-50%,-60%) scale(1.6) rotate(-20deg)}35%{opacity:1;transform:translate(-50%,0) scale(1.1) rotate(8deg)}70%{opacity:1;transform:translate(-50%,40%) scale(.8)}100%{opacity:0;transform:translate(-50%,90%) scale(.3)}}
@keyframes msxIfxMon{0%{transform:translateX(-50%) scale(1)}35%{transform:translateX(-50%) translateY(-12%) scale(1.06)}70%{transform:translateX(-50%) scale(.97,1.03)}100%{transform:translateX(-50%) scale(1)}}
@keyframes msxIfxGlow{0%{opacity:0;transform:scale(.4)}40%{opacity:1}100%{opacity:.75;transform:scale(1)}}
@keyframes msxIfxRing{0%{opacity:1;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.3)}}
@keyframes msxIfxPt{0%{opacity:0;transform:translate(-50%,-50%) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) scale(1)}}
@keyframes msxIfxPop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
`;
let msxIfxCssDone = false;
const msxIfxEnsureCss = () => {
  if (msxIfxCssDone || typeof document === 'undefined') return;
  msxIfxCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-msx-ifx-css', '1'); el.textContent = MSX_IFX_CSS; document.head.appendChild(el);
};
const msxIfxHex = (c, a) => { const h = String(c || '#ffffff').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

function MsxItemUseFx({ run, fx, onDone }) {
  msxIfxEnsureCss();
  const info = React.useMemo(() => msxItemFxOf(fx.key, fx.s0, fx.s1), [fx]);
  const calm = msxIfxCalm();
  React.useEffect(() => {
    if (calm || typeof SuccessSound === 'undefined' || !SuccessSound.isActive()) return undefined;
    const ids = [['itemUse', 0], [info.K.se, 520]].map(([id, ms]) => setTimeout(() => { try { SuccessSound.se(id); } catch (e) { /* 鳴らせなくても続ける */ } }, ms));
    return () => ids.forEach(clearTimeout);
  }, [fx]);
  const K = info.K;
  const style = { '--c1': K.c1, '--c2': K.c2, '--c1a': msxIfxHex(K.c1, 0.45), '--c1b': msxIfxHex(K.c1, 0.22) };
  return (
    <div className={`msx-ifx k-${info.kind}${calm ? ' calm' : ''}`} style={style} onClick={onDone} data-msx-item-fx={fx.key} data-msx-item-kind={info.kind}>
      <span className="ifx-rays" aria-hidden="true"/>
      <div className="ifx-st" aria-hidden="true">
        <span className="glow"/><span className="ring"/>
        {typeof MsxMonArt === 'function' ? <MsxMonArt run={run} className="ifx-mon" noPeak/> : null}
        {calm ? null : Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return <i key={i} className="pt" style={{ '--i': i, '--x': `${Math.round(Math.cos(a) * 95)}px`, '--y': `${Math.round(Math.sin(a) * 80 - 20)}px` }}>{K.pt[i % K.pt.length]}</i>; })}
        <span className="it">{fx.e}</span>
      </div>
      <div className="ifx-hd"><b><span style={{ display: 'inline-block' }}>{fx.name}</span><span style={{ display: 'inline-block' }}>を使った!</span></b><small>{K.word}</small></div>
      <div className="ifx-ch" data-msx-item-chips={info.chips.length}>
        {info.chips.map((c, i) => <span key={i} style={{ '--i': i }}>{c.t}{c.v != null ? <em className={c.good ? 'gd' : c.v < 0 ? 'dn' : ''}>{c.v > 0 ? `+${c.v}` : `−${Math.abs(c.v)}`}{c.unit || ''}</em> : null}</span>)}
      </div>
      {info.buffs.length ? <div className="ifx-bf" data-msx-item-buff>{info.buffs.map((t, i) => <div key={i}>✨ {t}</div>)}<small>使ったターンが終わるまで効く</small></div> : null}
      <div className="ifx-tap">タップで閉じる</div>
    </div>
  );
}
