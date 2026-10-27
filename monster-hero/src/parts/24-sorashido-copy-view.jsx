// ===== ソラシドの自動化(アシカ copy_sorashido・2026-10-27 社長の決定)の見せ方の部品 =====
// 計算は 32-sorashido-copy.jsx、バトルへの組み込み(5人目の枠・出す/消す時期)はバトル部。ここは見た目だけで、状態を持たない。
//   ・SorashidoCopyFx        … コピーの絵を包む。phase: 'appear'(緑のコードの線から組み上がる) / 'idle'(少し透けて緑のふちどり)
//                              / 'thinking'(選ぶときに小さな歯車) / 'vanish'(ノイズから光の粒になって消える)
//   ・SorashidoNextCardBadge … 枠の上に出す「次に使うカード」の札(縦・横どちらの置き方でも枠の幅に合わせる)
//   ・SorashidoCopyHandSheet … 5人目の枠を押したときに開く、コピーの手札の窓
// 目印(data-sorashido-*)は検査 tools/battle/sorashido-copy-view-check.js が見る。

const SORASHIDO_GREEN = '#34d399';
const SORASHIDO_COPY_CSS = `
[data-sorashido-fx]{position:relative;display:inline-block;isolation:isolate}
[data-sorashido-fx] > [data-sorashido-body]{position:relative;z-index:1}
[data-sorashido-fx="idle"] > [data-sorashido-body],[data-sorashido-fx="thinking"] > [data-sorashido-body]{opacity:.78;filter:drop-shadow(0 0 1px ${SORASHIDO_GREEN}) drop-shadow(0 0 3px rgba(52,211,153,.75))}
[data-sorashido-fx="appear"] > [data-sorashido-body]{animation:mhSoraBuild 1.1s steps(11,end) both;filter:drop-shadow(0 0 3px rgba(52,211,153,.9))}
@keyframes mhSoraBuild{0%{opacity:0;clip-path:inset(100% 0 0 0)}15%{opacity:.35}100%{opacity:.78;clip-path:inset(0 0 0 0)}}
[data-sorashido-code]{position:absolute;inset:-6% -4%;z-index:2;pointer-events:none;overflow:hidden}
[data-sorashido-code] i{position:absolute;top:-30%;width:1.5px;height:60%;background:linear-gradient(180deg,transparent,${SORASHIDO_GREEN},transparent);opacity:.85;animation:mhSoraRain .9s linear infinite}
@keyframes mhSoraRain{from{transform:translateY(0)}to{transform:translateY(220%)}}
[data-sorashido-gear]{position:absolute;right:-4px;top:-4px;z-index:3;width:16px;height:16px;line-height:16px;font-size:13px;text-align:center;color:${SORASHIDO_GREEN};text-shadow:0 0 3px rgba(0,0,0,.9);animation:mhSoraGear 1.2s linear infinite}
@keyframes mhSoraGear{to{transform:rotate(360deg)}}
[data-sorashido-fx="vanish"] > [data-sorashido-body]{animation:mhSoraNoise .7s steps(7,end) forwards}
@keyframes mhSoraNoise{0%{opacity:.78;transform:translateX(0)}20%{transform:translateX(-2px);clip-path:inset(10% 0 55% 0)}40%{transform:translateX(2px);clip-path:inset(45% 0 20% 0)}60%{opacity:.5;transform:translateX(-1px);clip-path:inset(0 0 70% 0)}100%{opacity:0;clip-path:inset(50% 0 50% 0)}}
[data-sorashido-spark]{position:absolute;left:50%;top:50%;z-index:3;width:4px;height:4px;border-radius:9999px;background:#d1fae5;box-shadow:0 0 6px ${SORASHIDO_GREEN};opacity:0;animation:mhSoraSpark .9s ease-out .35s forwards}
@keyframes mhSoraSpark{0%{opacity:1;transform:translate(-50%,-50%)}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(.4)}}
[data-sorashido-next]{display:flex;flex-direction:column;align-items:center;width:100%;max-width:100%;min-width:0;padding:2px 3px;border-radius:8px;border:1px solid rgba(52,211,153,.75);background:rgba(2,44,34,.9);color:#d1fae5;font-weight:900;box-shadow:0 0 6px rgba(52,211,153,.45);text-align:center}
[data-sorashido-next] > b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-width:100%;font-size:10px;line-height:12px;word-break:keep-all;overflow-wrap:anywhere}
[data-sorashido-next][data-sorashido-layout="landscape"] > b{font-size:9px;line-height:11px}
[data-sorashido-next] > small{font-size:8px;line-height:10px;color:#6ee7b7}
@media (prefers-reduced-motion: reduce){[data-sorashido-fx] *,[data-sorashido-fx] > [data-sorashido-body]{animation:none!important}[data-sorashido-fx="vanish"] > [data-sorashido-body]{opacity:0}}
`;
// 組み上がり・消えるときの線と粒の置き場(毎回同じ並び。Math.random は使わない)
const SORASHIDO_CODE_LINES = [6, 17, 29, 41, 52, 63, 74, 86, 95];
const SORASHIDO_SPARKS = [[-26, -22], [24, -26], [-30, 8], [30, 6], [-12, 28], [14, 30], [0, -34], [-34, -6], [34, -10], [6, 34]];

function SorashidoCopyFx({ phase = 'idle', children }) {
  const p = ['appear', 'idle', 'thinking', 'vanish'].includes(phase) ? phase : 'idle';
  return (
    <span data-sorashido-fx={p}>
      <style>{SORASHIDO_COPY_CSS}</style>
      <span data-sorashido-body>{children}</span>
      {p === 'appear' && <span data-sorashido-code aria-hidden="true">{SORASHIDO_CODE_LINES.map((x, i) => <i key={i} style={{ left: `${x}%`, animationDelay: `${(i % 4) * 0.12}s` }}/>)}</span>}
      {p === 'thinking' && <span data-sorashido-gear aria-hidden="true">⚙</span>}
      {p === 'vanish' && SORASHIDO_SPARKS.map(([dx, dy], i) => <span key={i} data-sorashido-spark aria-hidden="true" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` }}/>)}
    </span>
  );
}

// 次に使うカードの札。card が無いときは「考え中」(歯車)。layout は置き方('portrait' 縦 / 'landscape' 横)で、横は少し小さい字。
// 枠の幅いっぱいに置き、名前は2行まで(それより長い名前だけ「…」)。残りターンは下の小さい行
function SorashidoNextCardBadge({ card, layout = 'portrait', turnsLeft = null }) {
  const name = card ? (card.name || card.baseName || '') : '';
  return (
    <span data-sorashido-next={card ? 'card' : 'thinking'} data-sorashido-layout={layout}
      aria-label={card ? `コピーが次に使うカード: ${name}` : 'コピーが次に使うカードを考え中'}>
      <b>{card ? jaWrap(name) : '⚙ 考え中'}</b>
      {Number.isFinite(turnsLeft) && turnsLeft > 0 && <small data-sorashido-turns className="whitespace-nowrap tabular-nums">{layout === 'landscape' ? `あと${turnsLeft}` : `あと${turnsLeft}ターン`}</small>}
    </span>
  );
}

// コピーの手札の窓。cards は sorashidoCopyHand の結果、nextCard は sorashidoPickNext の結果。
// renderCard(card) を渡すと、バトルの手札と同じ見た目で出せる(無ければ名前と消費ガッツの札)
function SorashidoCopyHandSheet({ open, copyName = '', turnsLeft = null, cards = [], nextCard = null, guts = null, maxGuts = null, onClose, renderCard }) {
  if (!open) return null;
  const list = Array.isArray(cards) ? cards : [];
  return (
    <div data-sorashido-hand-sheet role="dialog" aria-modal="true" aria-label="AIコピーの手札" className="fixed inset-0 flex items-end justify-center sm:items-center"
      style={{ zIndex: 95000, background: 'rgba(0,0,0,.6)' }} onClick={() => onClose && onClose()}>
      <div className="w-full max-w-md rounded-t-3xl border-2 bg-slate-950 p-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:rounded-3xl [@media(max-height:500px)]:max-h-[94dvh] [@media(max-height:500px)]:overflow-y-auto"
        style={{ borderColor: SORASHIDO_GREEN }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-black text-emerald-200" style={JA_LABEL_STYLE}>{jaWrap(`${copyName || 'コピー'}のAIコピー`)}</b>
            <small className="block text-[10px] font-bold text-emerald-100/75">
              {Number.isFinite(turnsLeft) ? `あと${turnsLeft}ターン` : ''}{Number.isFinite(guts) && Number.isFinite(maxGuts) ? `・ガッツ ${guts}/${maxGuts}` : ''}
            </small>
          </span>
          <button type="button" data-sorashido-hand-close onClick={() => onClose && onClose()} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 text-[12px] font-black text-slate-200 active:scale-95">閉じる</button>
        </div>
        <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('コピーは毎ターン、この中から自分で1枚だけ選んで使います。光っているのが次に使うカードです。')}</p>
        <div data-sorashido-hand className="mt-2 grid grid-cols-3 gap-2">
          {list.map((card, i) => {
            const next = !!nextCard && (card === nextCard || (card.uid && card.uid === nextCard.uid) || (!card.uid && card.id === nextCard.id && card.name === nextCard.name));
            return (
              <div key={card.uid || `${card.id}-${i}`} data-sorashido-hand-card={i} data-sorashido-hand-next={next ? '1' : undefined}
                className="relative rounded-xl border p-1.5 text-center" style={{ borderColor: next ? SORASHIDO_GREEN : 'rgba(255,255,255,.15)', boxShadow: next ? '0 0 10px rgba(52,211,153,.6)' : 'none' }}>
                {typeof renderCard === 'function' ? renderCard(card) : (
                  <>
                    <b className="block text-[11px] font-black text-white" style={JA_LABEL_STYLE}>{jaWrap(card.name || card.baseName || '')}</b>
                    {Number.isFinite(Number(card.guts ?? card.cost)) && <small className="block text-[9px] font-bold tabular-nums text-slate-400">ガッツ {Number(card.guts ?? card.cost)}</small>}
                  </>
                )}
                {next && <small data-sorashido-hand-next-label className="mt-0.5 block text-[9px] font-black text-emerald-300">次に使う</small>}
              </div>
            );
          })}
          {list.length === 0 && <p className="col-span-3 py-3 text-center text-[11px] font-bold text-slate-400">使えるカードがありません</p>}
        </div>
      </div>
    </div>
  );
}
