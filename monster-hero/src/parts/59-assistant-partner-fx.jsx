// ==================== 助手の解放の演出(2026-11-11 社長「解放されたときの専用演出も作って」) ====================
// 止め絵: docs/progress/assistant-unlock/fx-portrait.jpg・fx-landscape.jpg(4コマ)
//   1 カードが満ちる(約0.8秒) → 2 カードが光に割れ、影が現れる(約0.8秒) → 3 立ち絵と一言(押すまで待つ) → 4 できるようになったことと「助手にする/あとで」
// 出すかどうか・見たことの保存は 60-app.jsx(assistantPartnerPendingNotice / assistantPartnerMarkNoticed)。ここは見た目だけで保存に触らない。
// 押せば前のコマを飛ばせる(1・2コマ目は押すと3コマ目へ)。動きを減らす設定の人は1・2コマ目を出さない
const ASSISTANT_PARTNER_FX_CSS = `
@keyframes mhPartnerGlow{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes mhPartnerFill{0%{width:70%}100%{width:100%}}
@keyframes mhPartnerSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}
@keyframes mhPartnerRise{0%{transform:translateY(18px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes mhPartnerSil{0%{filter:brightness(0) drop-shadow(0 0 22px var(--mh-pc));opacity:0;transform:scale(.9)}100%{filter:brightness(0) drop-shadow(0 0 22px var(--mh-pc));opacity:1;transform:scale(1)}}
.mh-partner-rays{position:absolute;inset:-60%;background:repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.12) 0 6deg,transparent 6deg 18deg);animation:mhPartnerSpin 18s linear infinite}
@media (prefers-reduced-motion: reduce){.mh-partner-rays{animation:none}}
`;
function AssistantPartnerUnlockFx({ who, cardName = '', need = 40, line = '', effects = [], onChoose, onLater }) {
  const reduce = (() => { try { return !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } })();
  const [step, setStep] = useState(reduce ? 2 : 0);
  useEffect(() => {
    if (step >= 2) return undefined;
    const t = setTimeout(() => setStep(s => Math.min(s + 1, 2)), 800);
    return () => clearTimeout(t);
  }, [step]);
  if (!who) return null;
  const accent = who.accent || '#38bdf8';
  const name = who.name || '';
  const next = () => setStep(s => (s < 2 ? 2 : s === 2 ? 3 : s));
  const stand = (expr) => (typeof assistantFullImage === 'function' ? assistantFullImage(who, expr) : '');
  const face = typeof assistantFaceImage === 'function' ? assistantFaceImage(who, 'normal') : '';
  return (
    <div data-assistant-partner-fx={who.id} data-step={step} onClick={step < 3 ? next : undefined}
      className="fixed inset-0 overflow-hidden select-none" style={{ zIndex: 90500, backgroundColor: '#05060f', '--mh-pc': accent }}>
      <style>{ASSISTANT_PARTNER_FX_CSS}</style>
      {step >= 1 && step <= 2 && <div className="mh-partner-rays" aria-hidden="true"/>}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${accent} 0, transparent 58%)`, opacity: step === 1 ? .9 : step === 3 ? .35 : .55 }}/>
      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))' }}>
        {step === 0 && (
          <div className="flex flex-col landscape:flex-row items-center gap-6" style={{ animation: 'mhPartnerGlow .4s ease-out' }}>
            <div className="w-[150px] h-[210px] rounded-2xl flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(160deg,#1e3a8a,#0f172a)', border: `3px solid ${accent}`, boxShadow: `0 0 30px ${accent}` }}>
              <img src={face} alt="" className="w-[92px] h-[92px] rounded-full object-cover border-[3px] border-white"/>
              <b className="text-[13px] font-black text-white text-center px-2">{cardName}</b>
            </div>
            <div className="text-center">
              <div className="text-[34px] font-black tabular-nums" style={{ color: '#fde047', textShadow: '0 0 14px #facc15' }}>{need} / {need}</div>
              <div className="w-[220px] h-2.5 rounded-full bg-slate-800 overflow-hidden mx-auto my-1.5"><div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg,#38bdf8,#fde047)', animation: 'mhPartnerFill .7s ease-out forwards' }}/></div>
              <div className="text-[12px] text-slate-300">モンヒロバトルで使った回数</div>
            </div>
          </div>
        )}
        {step === 1 && <img src={stand('normal')} alt="" className="max-h-[78vh] max-w-[80vw] object-contain" style={{ animation: 'mhPartnerSil .8s ease-out forwards' }}/>}
        {step === 2 && (
          <div className="flex flex-col landscape:flex-row items-center justify-center gap-2 landscape:gap-6 w-full h-full">
            <img src={stand('happy')} alt="" className="object-contain max-h-[56vh] landscape:max-h-[92vh] max-w-[90vw] landscape:max-w-[45vw]" style={{ animation: 'mhPartnerRise .5s ease-out', filter: 'drop-shadow(0 0 18px rgba(255,255,255,.35))' }}/>
            <div className="max-w-[360px] landscape:max-w-[420px] w-full" style={{ animation: 'mhPartnerRise .6s ease-out' }}>
              <div className="text-[12px] font-black text-center" style={{ color: '#fde047', letterSpacing: '.25em' }}>NEW PARTNER</div>
              <div className="text-[24px] font-black text-white text-center whitespace-nowrap my-1">{name}が助手になりました！</div>
              <div data-assistant-partner-line className="rounded-2xl px-3 py-2.5 text-[13px] leading-relaxed text-slate-100" style={{ background: 'rgba(15,23,42,.9)', border: `2px solid ${accent}` }}>
                <b style={{ color: accent }}>{name}</b>「{line}」
              </div>
              <div className="text-[11px] text-slate-400 text-center mt-2">画面を押して次へ</div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col landscape:flex-row items-center justify-center gap-3 landscape:gap-6 w-full h-full" style={{ animation: 'mhPartnerRise .4s ease-out' }}>
            <img src={stand('wink')} alt="" className="object-contain max-h-[38vh] landscape:max-h-[90vh] max-w-[80vw] landscape:max-w-[40vw]" style={{ filter: 'drop-shadow(0 0 18px rgba(255,255,255,.35))' }}/>
            <div className="w-full max-w-[380px] landscape:max-w-[420px]">
              <div className="text-[19px] font-black text-white text-center mb-2">{name}とできるようになったこと</div>
              <div className="flex flex-col gap-1.5">
                {effects.map(e => <div key={e} className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold text-slate-100 border border-slate-700" style={{ background: 'rgba(15,23,42,.8)' }}><b className="text-green-400">✓</b>{e}</div>)}
              </div>
              <div className="flex gap-2 mt-3">
                <button type="button" data-assistant-partner-choose onClick={onChoose} className="flex-[1.3] min-h-[46px] rounded-2xl font-black text-[14px] text-white active:scale-[.98]" style={{ background: 'linear-gradient(#ec4899,#be185d)' }}>{name}を助手にする</button>
                <button type="button" data-assistant-partner-later onClick={onLater} className="flex-1 min-h-[46px] rounded-2xl font-black text-[14px] text-slate-300 bg-slate-800 border border-slate-600 active:scale-[.98]">あとで</button>
              </div>
              <div className="text-[11px] text-slate-400 text-center mt-1.5">あとでも、HOME の助手アイコンからいつでも変えられます</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
