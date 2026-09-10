// ==== 画面: 魂格特性(gameState === 'MASU_SOUL_TRAITS') ====
//
// MonsterHeroGame から切り出した13本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
//
// 【この画面ならではの注意】
// ・特性の確定と振り直しは保存を伴うので、中身は MonsterHeroGame 側の
//   commitSoulTrait* に残し、props で受けて呼ぶだけ
// ・二重実行を止める soulTraitProcessing は真偽値で受け取る
// ・この画面にタイマーは無い

function MasuSoulTraitsScreen({
  commitSoulTraitRespec, commitSoulTraitUpgrade, getMasuMon, masuMonDetail, monsterRosterIds,
  onClose, ownedItems, setSoulTraitDraftLevels, setSoulTraitError, setSoulTraitRespecOpen,
  setSoulTraitSelectedId, setSoulTraitTab, soulTraitDraftLevels, soulTraitError, soulTraitProcessingRef,
  soulTraitRespecOpen, soulTraitSelectedId, soulTraitTab,
})   {

      const sourceMasu=masuMonDetail ? (getMasuMon(masuMonDetail.id)||masuMonDetail) : null;
      if(!sourceMasu)return null;
      const masu=normalizeMasuProgression(sourceMasu);
      const level=masuBondLevelInfo(masu).level;
      const unlocked=masu.soulRankStage>=1;
      const stageStep=soulRankEvolutionForStage(masu.soulRankStage);
      const stageLabel=stageStep?.label||'魂格未解放';
      const accent=stageStep?.accent||'#94a3b8';
      const earned=soulPointEarned(masu);
      const spent=soulTraitSpentPoints(masu);
      const available=soulTraitAvailablePoints(masu);
      const scrollHave=ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID);
      const traits=SOUL_TRAIT_DEFINITIONS.filter(trait=>trait.category===soulTraitTab);
      const selected=soulTraitSelectedId?SOUL_TRAIT_BY_ID[soulTraitSelectedId]:null;
      const maxUpgrade=selected?maxSoulTraitUpgradeLevels(masu,selected.id):0;
      const draft=selected?Math.max(0,Math.min(maxUpgrade,Math.floor(Number(soulTraitDraftLevels)||0))):0;
      const currentLevel=selected?soulTraitLevel(masu,selected.id):0;
      const currentEffect=selected?soulTraitEffectValue(masu,selected.id):0;
      const afterLevel=selected?currentLevel+draft:0;
      const afterEffect=selected?afterLevel*selected.effectPerLevel:0;
      const draftCost=selected?draft*selected.costPerLevel:0;
      const closeScreen=()=>{onClose();};
      const openTrait=(trait)=>{const max=maxSoulTraitUpgradeLevels(masu,trait.id);setSoulTraitSelectedId(trait.id);setSoulTraitDraftLevels(max>0?1:0);setSoulTraitError('');};
      const addDraft=(amount)=>setSoulTraitDraftLevels(prev=>Math.max(0,Math.min(maxUpgrade,Math.floor(Number(prev)||0)+amount)));
      // M/B管理の現在セットは8体の候補。魂格特性の実戦値プレビューは、その中のマスモンだけを合成して見せる。
      // 実戦では実際に参加した個体だけでSTEP4の同じ正本を再計算するため、ここでは「編成セット内」の値と明示する。
      const rosterSoulMasus=monsterRosterIds
        .filter(entry=>String(entry||'').startsWith('masu:'))
        .map(entry=>getMasuMon(String(entry).slice(5)))
        .filter(Boolean);
      const inCurrentRoster=rosterSoulMasus.some(entry=>String(entry.id)===String(masu.id));
      const currentPartyPreview=inCurrentRoster?soulTraitPartyPreview(rosterSoulMasus):null;
      const draftUpgrade=selected&&draft>0?buildSoulTraitUpgrade(masu,selected.id,draft):null;
      const afterPartyPreview=currentPartyPreview&&draftUpgrade
        ? soulTraitPartyPreview(rosterSoulMasus.map(entry=>String(entry.id)===String(masu.id)?draftUpgrade.nextMasu:entry))
        : currentPartyPreview;
      const pctText=(value)=>`${(Number(value)||0).toFixed(1).replace(/\.0$/,'')}%`;
      const partyPreviewRows=currentPartyPreview&&afterPartyPreview?[
        {label:'最終被ダメ軽減',before:currentPartyPreview.damageReduction,after:afterPartyPreview.damageReduction,format:pctText},
        {label:'回避E',before:currentPartyPreview.evasion,after:afterPartyPreview.evasion,format:pctText},
        {label:'反射R',before:currentPartyPreview.reflect,after:afterPartyPreview.reflect,format:pctText},
        {label:'吸収A',before:currentPartyPreview.absorb,after:afterPartyPreview.absorb,format:pctText},
        {label:'特殊防御',before:currentPartyPreview.specialDefenseRate,after:afterPartyPreview.specialDefenseRate,format:pctText},
        {label:'威圧',before:currentPartyPreview.intimidate,after:afterPartyPreview.intimidate,format:pctText},
        {label:'自動ガッツ回復',before:(currentPartyPreview.autoGutsMultiplier-1)*100,after:(afterPartyPreview.autoGutsMultiplier-1)*100,format:pctText},
        {label:'カード増加',before:currentPartyPreview.coordinationCardBonus,after:afterPartyPreview.coordinationCardBonus,format:value=>`+${value}枚`},
      ].filter(row=>Math.abs(row.after-row.before)>1e-9):[];
      return <div data-mh-screen data-soul-trait-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <div className="shrink-0 flex items-center gap-2 mb-2">
          <button type="button" aria-label="マスモン詳細へ戻る" onClick={closeScreen} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
          <div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-widest" style={{color:accent}}>魂格特性</div><h2 className="text-lg font-black truncate">{masu.name}</h2></div>
          <div className="shrink-0 text-right"><div className="text-[10px] font-black" style={{color:accent}}>{stageLabel}</div><div className="text-[9px] font-mono text-slate-400">Lv.{level}</div></div>
        </div>
        <div className="shrink-0 grid grid-cols-3 gap-1.5 mb-2">
          <div className="rounded-xl border border-sky-500/30 bg-sky-950/30 px-2 py-2 text-center"><div className="text-[7px] text-slate-400 font-black">未使用 魂格P</div><div className="text-lg font-black text-sky-300">{available}</div></div>
          <div className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-2 py-2 text-center"><div className="text-[7px] text-slate-400 font-black">使用済み</div><div className="text-lg font-black text-violet-300">{spent}</div></div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-2 py-2 text-center"><div className="text-[7px] text-slate-400 font-black">総獲得</div><div className="text-lg font-black text-amber-300">{earned}</div></div>
        </div>
        {inCurrentRoster?<div data-soul-trait-party-preview className="shrink-0 mb-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
          <div className="flex items-center justify-between gap-2"><div className="text-[9px] font-black text-emerald-200">現在の編成セット内・合成後効果</div><div className="text-[8px] font-black text-slate-500">マスモン {rosterSoulMasus.length}体</div></div>
          <div className="mt-1 grid grid-cols-4 gap-1 text-center">
            <div className="rounded-lg bg-black/25 p-1"><div className="text-[7px] text-slate-500">被ダメ軽減</div><div className="text-[9px] font-black text-emerald-300">{pctText(currentPartyPreview.damageReduction)}</div></div>
            <div className="rounded-lg bg-black/25 p-1"><div className="text-[7px] text-slate-500">特殊防御</div><div className="text-[9px] font-black text-cyan-300">{pctText(currentPartyPreview.specialDefenseRate)}</div></div>
            <div className="rounded-lg bg-black/25 p-1"><div className="text-[7px] text-slate-500">威圧</div><div className="text-[9px] font-black text-violet-300">{pctText(currentPartyPreview.intimidate)}</div></div>
            <div className="rounded-lg bg-black/25 p-1"><div className="text-[7px] text-slate-500">カード</div><div className="text-[9px] font-black text-amber-300">+{currentPartyPreview.coordinationCardBonus}</div></div>
          </div>
          <div className="mt-1 text-[7px] font-bold leading-tight text-slate-500">回避E {pctText(currentPartyPreview.evasion)} ／ 反射R {pctText(currentPartyPreview.reflect)} ／ 吸収A {pctText(currentPartyPreview.absorb)} ／ 自動ガッツ回復 ×{currentPartyPreview.autoGutsMultiplier.toFixed(3)}。実戦では実際に参加した個体だけで再計算します。</div>
        </div>:<div data-soul-trait-party-preview-empty className="shrink-0 mb-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[8px] font-bold text-slate-500 text-center">この個体は現在の編成セットに入っていないため、合成後効果プレビューは表示しません。</div>}
        {!unlocked&&<div data-soul-trait-locked className="shrink-0 mb-2 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-[10px] font-black text-amber-200 text-center">Lv500到達＋魂格進化Ⅰで解放<br/><span className="text-[8px] font-bold text-slate-300">特性一覧と必要魂格Pは先に確認できます</span></div>}
        <div className="shrink-0 flex gap-1.5 mb-2" role="tablist" aria-label="魂格特性カテゴリ">
          {SOUL_TRAIT_CATEGORIES.map(category=><button key={category.id} role="tab" aria-selected={soulTraitTab===category.id} onClick={()=>{setSoulTraitTab(category.id);setSoulTraitSelectedId(null);setSoulTraitDraftLevels(0);}} className={`flex-1 min-h-[44px] rounded-xl text-[11px] font-black ${soulTraitTab===category.id?'bg-sky-600 text-white':'bg-slate-900 border border-slate-700 text-slate-400'}`}>{category.label}</button>)}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2 pb-2">
          {traits.map(trait=>{
            const traitLevel=soulTraitLevel(masu,trait.id);
            const effect=soulTraitEffectValue(masu,trait.id);
            const maxed=Number.isFinite(trait.maxLevel)&&traitLevel>=trait.maxLevel;
            return <button type="button" key={trait.id} data-soul-trait-card={trait.id} onClick={()=>openTrait(trait)} className="w-full min-h-[72px] rounded-2xl border border-white/10 bg-slate-900 p-3 text-left active:scale-[.99]">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="text-[12px] font-black text-white">{trait.name}</div><div className="mt-0.5 text-[9px] font-bold leading-relaxed text-slate-400">{trait.desc}</div></div><div className="shrink-0 text-right"><div className="text-[10px] font-black text-sky-300">{traitLevel>0?`Lv.${traitLevel}`:'未習得'}</div>{traitLevel>0&&<div className="text-[9px] font-mono font-black text-emerald-300">{formatSoulTraitEffect(trait,effect)}</div>}</div></div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[8px] font-black"><span className="text-slate-500">{trait.id==='coordination'?'習得':'1段階'} {trait.costPerLevel}P</span><span className={maxed?'text-amber-300':unlocked&&maxSoulTraitUpgradeLevels(masu,trait.id)>0?'text-sky-300':'text-slate-600'}>{maxed?'MAX':unlocked?'タップして強化':'閲覧のみ'}</span></div>
            </button>;
          })}
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[8px] font-bold leading-relaxed text-slate-400">魂格特性による総合力加算：使用済み魂格P {spent} × 10 = <b className="text-amber-300">+{spent*10}</b><br/>実戦での合成後効果・攻撃予測への反映は、戦闘接続時に同じ特性データから計算します。</div>
        </div>
        <div className="shrink-0 mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2"><div className="text-[8px] font-black text-slate-400">魂格再編の書</div><div className={`text-[10px] font-black ${scrollHave>0?'text-cyan-300':'text-slate-500'}`}>所持 {scrollHave}冊</div></div>
          <button type="button" data-soul-trait-respec-open disabled={spent<=0||scrollHave<=0||soulTraitProcessingRef.current} onClick={()=>{setSoulTraitError('');setSoulTraitRespecOpen(true);}} className="min-h-[48px] rounded-xl bg-cyan-700 px-4 text-[10px] font-black text-white disabled:opacity-30">全リセット</button>
        </div>
        {soulTraitError&&<div className="shrink-0 mt-1 text-center text-[9px] font-black text-red-400">{soulTraitError}</div>}

        {selected&&<div className="fixed inset-0 z-[32000] flex items-end justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-label={`${selected.name}の魂格特性強化`}>
          <div data-soul-trait-sheet data-soul-trait-upgrade-sheet className="w-full max-w-sm rounded-t-3xl border-2 border-sky-500/60 bg-slate-950 p-4 shadow-2xl" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            <div className="flex items-start justify-between gap-2"><div><div className="text-[8px] font-black text-sky-300">魂格特性</div><div className="text-lg font-black">{selected.name}</div><div className="mt-1 text-[9px] font-bold text-slate-400">{selected.desc}</div></div><button type="button" aria-label="強化画面を閉じる" onClick={()=>{setSoulTraitSelectedId(null);setSoulTraitDraftLevels(0);setSoulTraitError('');}} className="p-2 rounded-full bg-white/10 active:scale-90"><X size={16}/></button></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl border border-white/10 bg-black/30 p-2"><div className="text-[8px] text-slate-500 font-black">現在</div><div className="text-[13px] font-black text-white">Lv.{currentLevel}</div><div className="text-[10px] font-mono font-black text-sky-300">{formatSoulTraitEffect(selected,currentEffect)}</div></div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2"><div className="text-[8px] text-slate-500 font-black">強化後</div><div className="text-[13px] font-black text-white">Lv.{afterLevel}</div><div className="text-[10px] font-mono font-black text-emerald-300">{formatSoulTraitEffect(selected,afterEffect)}</div></div>
            </div>
            {partyPreviewRows.length>0&&<div data-soul-trait-before-after className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2">
              <div className="text-[8px] font-black text-emerald-200 mb-1">現在編成の実戦値プレビュー</div>
              <div className="space-y-1">{partyPreviewRows.map(row=><div key={row.label} className="flex items-center justify-between gap-2 text-[9px] font-black"><span className="text-slate-400">{row.label}</span><span><b className="text-slate-300">{row.format(row.before)}</b><span className="mx-1 text-slate-600">→</span><b className="text-emerald-300">{row.format(row.after)}</b></span></div>)}</div>
            </div>}
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-2 text-[9px] font-bold"><div className="flex justify-between"><span className="text-slate-400">1段階の効果</span><b>{formatSoulTraitEffect(selected,selected.effectPerLevel)}</b></div><div className="mt-1 flex justify-between"><span className="text-slate-400">1段階の必要P</span><b>{selected.costPerLevel}P</b></div><div className="mt-1 flex justify-between"><span className="text-slate-400">消費魂格P</span><b className="text-amber-300">{draftCost}P</b></div><div className="mt-1 flex justify-between"><span className="text-slate-400">強化後の未使用P</span><b className="text-sky-300">{Math.max(0,available-draftCost)}P</b></div></div>
            {!unlocked?<div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-950/30 px-3 py-3 text-center text-[10px] font-black text-amber-200">Lv500到達＋魂格進化Ⅰで強化操作が解放されます</div>
            :selected.id==='coordination'?<button type="button" data-soul-trait-learn data-soul-trait-learn-coordination disabled={maxUpgrade<=0||soulTraitProcessingRef.current} onClick={()=>commitSoulTraitUpgrade(masu.id,selected.id,1)} className="mt-3 min-h-[52px] w-full rounded-2xl bg-sky-500 text-slate-950 text-[12px] font-black disabled:opacity-30">{currentLevel>=1?'習得済み':'習得する 200P'}</button>
            :<>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                <button type="button" data-soul-trait-minus-one disabled={draft<=0} onClick={()=>addDraft(-1)} className="min-h-[46px] rounded-xl bg-slate-700 text-[11px] font-black disabled:opacity-30">-1</button>
                <button type="button" data-soul-trait-plus-one disabled={draft>=maxUpgrade} onClick={()=>addDraft(1)} className="min-h-[46px] rounded-xl bg-sky-800 text-[11px] font-black disabled:opacity-30">+1</button>
                <button type="button" data-soul-trait-plus-five disabled={draft>=maxUpgrade} onClick={()=>addDraft(5)} className="min-h-[46px] rounded-xl bg-sky-700 text-[11px] font-black disabled:opacity-30">+5</button>
                <button type="button" data-soul-trait-max disabled={maxUpgrade<=0} onClick={()=>setSoulTraitDraftLevels(maxUpgrade)} className="min-h-[46px] rounded-xl bg-violet-700 text-[10px] font-black disabled:opacity-30">MAX</button>
              </div>
              <div className="my-2 text-center text-[11px] font-black text-sky-200">今回 +{draft}段階</div>
              <button type="button" data-soul-trait-confirm disabled={draft<=0||soulTraitProcessingRef.current} onClick={()=>commitSoulTraitUpgrade(masu.id,selected.id,draft)} className="min-h-[52px] w-full rounded-2xl bg-sky-500 text-slate-950 text-[12px] font-black disabled:opacity-30">強化を決定</button>
            </>}
          </div>
        </div>}

        {soulTraitRespecOpen&&<div className="fixed inset-0 z-[32100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="魂格特性の全リセット確認">
          <div data-soul-trait-respec-sheet className="w-full max-w-sm rounded-3xl border-2 border-cyan-500/60 bg-slate-950 p-5">
            <div className="text-center text-xl mb-1">🌀</div><h3 className="text-center text-base font-black text-cyan-200">魂格特性を全リセット</h3>
            <p className="mt-2 text-[10px] font-bold leading-relaxed text-slate-300">「{masu.name}」が使用した魂格P <b className="text-amber-300">{spent}P</b> をすべて未使用へ戻します。魂格段階・Lv・最高初到達Lvは変わりません。</p>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black flex justify-between"><span className="text-slate-400">魂格再編の書</span><span className="text-cyan-300">{scrollHave} → {Math.max(0,scrollHave-1)}冊</span></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={soulTraitProcessingRef.current} onClick={()=>setSoulTraitRespecOpen(false)} className="min-h-[48px] rounded-xl bg-slate-700 text-[11px] font-black">やめる</button><button type="button" data-soul-trait-respec-confirm disabled={soulTraitProcessingRef.current} onClick={()=>commitSoulTraitRespec(masu.id)} className="min-h-[48px] rounded-xl bg-cyan-600 text-slate-950 text-[11px] font-black">1冊使って再編</button></div>
          </div>
        </div>}
      </div>;
    
}
