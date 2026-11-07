// ==== シート: 固有技のオリジナル強化(2026-11-07 社長) ====
//
// マスモン詳細の「固有技強化」の枠で、Lv.8(MAX)の技の「✨ オリジナル強化」から開く。
// 3つのタブ(攻撃・特攻・補助)に全部の種類をいつも同じ順で並べ、その技に効かない種類は灰色で押せない。
// 下書き(draft)は「確定後の目盛り数」。確定するまで保存へ触らない。確定は onCommit(plan) が
// applyUniqueBoostPlan を通して保存する(今より下げる・効かない種類・上限超え・P不足はそこで弾く)。
// 見た目はレフェリーくんの案の絵(docs/progress/unique-boost)に合わせる。
// ★🔄横(端末は縦のまま絵を回す)では --mh-vh が端末の縦の長さのままなので、高さは回した枠いっぱい(!max-h-full)にし、
//   横で背が低いときの畳み方も回したとき用([[data-mh-view-rotation=true]_&]:…)を並べて持つ(2026-11-07 レフェリーくんの指摘)

function UniqueBoostSheet({ masu, skillKey, onClose, onCommit }) {
  const [tab, setTab] = useState('attack');
  const [draft, setDraft] = useState({});
  const [helpId, setHelpId] = useState(null);
  if (!masu || !skillKey) return null;
  const normalized = normalizeMasuProgression(masu);
  const monId = uniqueBoostMonIdOfKey(normalized, skillKey);
  const level = uniqueBoostSkillLevelOf(normalized, skillKey);
  const base = ALL_PLAYER_MONSTERS[normalized.baseId];
  const uniqueDef = skillKey === OWN_UNIQUE_KEY ? base?.unique
    : (normalized.inheritedUniques || []).find(u => inheritedUniqueLevelKey(u) === skillKey);
  const skillName = uniqueSkillAtLevel(uniqueDef, level)?.name || uniqueDef?.name || '固有技';
  const current = uniqueBoostStepsOf(normalized, skillKey);
  const targetOf = (id) => Math.max(current[id] || 0, Math.floor(Number(draft[id]) || 0));
  const draftCost = UNIQUE_BOOST_DEFINITIONS.reduce((sum, def) => sum + (targetOf(def.id) - (current[def.id] || 0)) * def.stepCost, 0);
  const remaining = normalized.uniqueSkillPoints - draftCost;
  const setTarget = (def, target) => setDraft(prev => {
    const have = current[def.id] || 0;
    const now = Math.max(have, Math.floor(Number(prev[def.id]) || 0));
    const otherCost = draftCost - (now - have) * def.stepCost;
    const byPoints = have + Math.floor(Math.max(0, normalized.uniqueSkillPoints - otherCost) / def.stepCost);
    const next = Math.max(have, Math.min(target, uniqueBoostMaxSteps(def), byPoints));
    const out = { ...prev };
    if (next > have) out[def.id] = next; else delete out[def.id];
    return out;
  });
  const helpDef = helpId ? UNIQUE_BOOST_BY_ID[helpId] : null;
  const capText = (def) => (def.maxValue != null && Number.isFinite(Number(def.maxValue)) ? `・最大${def.sign === -1 ? '−' : '+'}${def.maxValue}${def.unit}` : '');
  const stepText = (def) => `${def.stepCost.toLocaleString()}Pで${formatUniqueBoostValue(def, 1)}${capText(def)}`;
  const rows = UNIQUE_BOOST_DEFINITIONS.filter(def => def.tab === tab);
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center" style={{ position:'fixed', inset:0, backgroundColor:'rgba(2,6,23,0.78)', zIndex:31600 }}
      role="dialog" aria-modal="true" aria-label={`${skillName}のオリジナル強化`} data-unique-boost-sheet>
      <div data-unique-boost-panel className="w-full max-w-md bg-slate-900 border-2 border-amber-500/80 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden [[data-mh-view-rotation=true]_&]:!max-h-full"
        style={{ maxHeight:'calc(var(--mh-vh) - env(safe-area-inset-top) - 12px)', paddingBottom:'env(safe-area-inset-bottom)' }}>
        <div data-unique-boost-head className="shrink-0 px-4 pt-3 pb-2 border-b border-white/10 [@media(orientation:landscape)_and_(max-height:520px)]:pt-2 [[data-mh-view-rotation=true]_&]:pt-2 [@media(orientation:landscape)_and_(max-height:520px)]:pb-1.5 [[data-mh-view-rotation=true]_&]:pb-1.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex items-baseline gap-1.5"><span className="truncate text-[15px] font-black text-white">{skillName}</span><span className="shrink-0 text-[11px] font-mono font-black text-amber-300">Lv.{level}</span></div>
            <div className="shrink-0 flex items-center gap-1 text-[11px] font-black text-amber-300"><Sparkles size={12}/>未使用 固有技P {normalized.uniqueSkillPoints.toLocaleString()}</div>
          </div>
          <div className="mt-1.5 text-[12px] font-black text-amber-200 [@media(orientation:landscape)_and_(max-height:520px)]:hidden [[data-mh-view-rotation=true]_&]:hidden">✨ オリジナル強化(この技だけに効きます)</div>
          {/* 横で背が低いときは説明を畳み、行が見える場所を広くする(2026-11-07 実画面で1行しか見えなかった) */}
          <div className="mt-0.5 text-[10px] font-bold leading-relaxed text-slate-400 [@media(orientation:landscape)_and_(max-height:520px)]:hidden [[data-mh-view-rotation=true]_&]:hidden">Lv.8 になった固有技に、余った固有技Pで強化を積めます。合体でこの技を引き継ぐと、強化も一緒に引き継ぎます。</div>
          <div className="mt-2 grid grid-cols-3 gap-2 [@media(orientation:landscape)_and_(max-height:520px)]:mt-1 [[data-mh-view-rotation=true]_&]:mt-1" role="tablist">
            {UNIQUE_BOOST_TABS.map(t => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-unique-boost-tab={t.id} onClick={() => setTab(t.id)}
                className={`min-h-[40px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[34px] [[data-mh-view-rotation=true]_&]:min-h-[34px] rounded-xl text-[12px] font-black border ${tab === t.id ? 'bg-amber-500 text-slate-950 border-amber-300' : 'bg-slate-800 text-slate-300 border-white/10'}`}>{t.label}</button>
            ))}
          </div>
        </div>
        <div data-unique-boost-rows className="flex-1 min-h-0 overflow-y-auto mh-scroll px-3 py-2 space-y-2">
          {rows.map(def => {
            const applies = uniqueBoostAppliesTo(def, monId);
            const have = current[def.id] || 0;
            const target = targetOf(def.id);
            const maxSteps = uniqueBoostMaxSteps(def);
            const canAdd = applies && target < maxSteps && remaining >= def.stepCost;
            return (
              <div key={def.id} data-unique-boost-row={def.id} data-unique-boost-applies={applies ? '1' : '0'}
                className={`rounded-2xl border px-3 py-2 ${!applies ? 'border-white/5 bg-slate-900/60 opacity-50' : target > have ? 'border-amber-400/80 bg-amber-950/20' : 'border-white/10 bg-slate-800/50'}`}>
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1"><span className={`text-[13px] font-black ${applies ? 'text-white' : 'text-slate-500'}`}>{def.name}</span>
                      <button type="button" aria-label={`${def.name}の説明`} onClick={() => setHelpId(def.id)} className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-slate-300 active:scale-90"><HelpCircle size={14}/></button></div>
                    {applies && <div className="text-[9px] font-bold text-slate-500">{stepText(def)}</div>}
                  </div>
                  <div className="shrink-0 text-right text-[12px] font-mono font-black">
                    {applies
                      ? <span className={target > have ? 'text-amber-300' : 'text-slate-300'}>{formatUniqueBoostValue(def, have)} → {formatUniqueBoostValue(def, target)}</span>
                      : <span className="text-[10px] font-sans text-slate-500">この技には効果がありません</span>}
                  </div>
                </div>
                {applies && <div className="mt-1.5 flex items-center justify-end gap-1.5">
                  <button type="button" aria-label={`${def.name}を1つ戻す`} disabled={target <= have} onClick={() => setTarget(def, target - 1)} className="min-w-[44px] min-h-[38px] px-2 rounded-xl bg-slate-800 border border-white/10 text-[12px] font-black text-white disabled:opacity-30">−1</button>
                  <button type="button" aria-label={`${def.name}を1つ上げる`} disabled={!canAdd} onClick={() => setTarget(def, target + 1)} className="min-w-[44px] min-h-[38px] px-2 rounded-xl bg-slate-800 border border-white/10 text-[12px] font-black text-white disabled:opacity-30">+1</button>
                  {maxSteps >= 10 && <button type="button" aria-label={`${def.name}を10上げる`} disabled={!canAdd} onClick={() => setTarget(def, target + 10)} className="min-w-[44px] min-h-[38px] px-2 rounded-xl bg-slate-800 border border-white/10 text-[12px] font-black text-white disabled:opacity-30">+10</button>}
                  <button type="button" aria-label={`${def.name}を上げられるだけ上げる`} disabled={!canAdd} onClick={() => setTarget(def, Infinity)} className="min-w-[44px] min-h-[38px] px-2 rounded-xl bg-slate-800 border border-white/10 text-[12px] font-black text-white disabled:opacity-30">MAX</button>
                </div>}
              </div>
            );
          })}
        </div>
        <div className="shrink-0 px-4 pt-2 pb-3 border-t border-white/10 [@media(orientation:landscape)_and_(max-height:520px)]:pt-1 [[data-mh-view-rotation=true]_&]:pt-1 [@media(orientation:landscape)_and_(max-height:520px)]:pb-2 [[data-mh-view-rotation=true]_&]:pb-2">
          <div className="flex items-center justify-between text-[12px] font-black"><span className="text-slate-400">残りP</span><span className="text-amber-300">{remaining.toLocaleString()}</span></div>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2 [@media(orientation:landscape)_and_(max-height:520px)]:mt-1 [[data-mh-view-rotation=true]_&]:mt-1">
            <button type="button" onClick={onClose} className="min-h-[48px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[40px] [[data-mh-view-rotation=true]_&]:min-h-[40px] rounded-2xl bg-slate-800 text-[13px] font-black text-white">やめる</button>
            <button type="button" data-unique-boost-commit disabled={draftCost <= 0} onClick={() => {
              const plan = {}; UNIQUE_BOOST_DEFINITIONS.forEach(def => { if (targetOf(def.id) > (current[def.id] || 0)) plan[def.id] = targetOf(def.id); });
              if (onCommit(plan)) { setDraft({}); onClose(); }
            }} className="min-h-[48px] [@media(orientation:landscape)_and_(max-height:520px)]:min-h-[40px] [[data-mh-view-rotation=true]_&]:min-h-[40px] rounded-2xl bg-gradient-to-b from-amber-500 to-orange-700 text-[13px] font-black text-white disabled:opacity-40">強化を確定</button>
          </div>
        </div>
      </div>
      {helpDef && (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ position:'fixed', inset:0, backgroundColor:'rgba(2,6,23,0.6)', zIndex:31700 }} onClick={() => setHelpId(null)} role="dialog" aria-modal="true" aria-label={`${helpDef.name}の説明`}>
          <div className="w-full max-w-xs rounded-2xl border border-amber-400/70 bg-slate-900 p-4" onClick={e => e.stopPropagation()}>
            <div className="text-[14px] font-black text-amber-200">{helpDef.name}</div>
            <div className="mt-1 text-[12px] font-bold leading-relaxed text-slate-200">{helpDef.desc}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-400">{stepText(helpDef)}</div>
            {!uniqueBoostAppliesTo(helpDef, monId) && <div className="mt-1 text-[11px] font-bold text-slate-500">この技には効果がありません。</div>}
            <button type="button" onClick={() => setHelpId(null)} className="mt-3 w-full min-h-[44px] rounded-xl bg-slate-700 text-[12px] font-black text-white">閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
