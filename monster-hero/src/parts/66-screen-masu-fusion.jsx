// ==== 画面: マスモン合体(gameState === 'MASU_FUSION') ====
//
// MonsterHeroGame から切り出した16本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
// MASU_* でいちばん大きい画面(約37千字)。
//
// 【この画面ならではの注意】
// ・合体の実行は保存を伴う(複数キーを同時に書く取引)。中身は MonsterHeroGame 側に残して
//   props で受ける。CLAUDE.md ⑦ のとおり保存の順序には触らない
// ・魂格の継承切替(soulRankInherit)は masu/soul-rank-step5a-check が見ているので、
//   目印(data-soul-rank-inherit-fusion / -result)を消さない
// ・並べ替えと供モンの選択はこの画面の中の関数(sortMasuList / toggleFusionSub /
//   continueWithFusionSubs)なので、そのまま持ってくる

function MasuFusionScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, continueFusionFlow, executeMasuFusion,
  fusionAnimPhase, fusionInheritSoulRank, fusionInheritUniqueIds, fusionMainId,
  fusionProcessingRef, fusionResultData, fusionSortDir, fusionSortKey, fusionStep,
  fusionSubIds, getMasuMon, gold, masuMons, onClose, ownedItems, renderMonsterCardBody,
  renderScreenNote, resetFusionFlow, setFusionInheritSoulRank, setFusionInheritUniqueIds,
  setFusionMainId, setFusionResultData, setFusionSortDir, setFusionSortKey, setFusionStep,
  setFusionSubId, setFusionSubIds, setMasuMonDetail,
}) {

      // 戻り先(TEMPLE)の指定は本体に残す。この画面は「閉じる」とだけ言う
      const closeFusion = onClose;
      const fusedBorder = (masu) => (masu.fusionHistory||[]).length>0 ? 'border-amber-400 ring-1 ring-amber-400' : 'border-violet-400/40';
      // 合体の仕様説明。何が引き継がれて何が消えるのか、固有技の引き継ぎ条件は何かが
      // 画面から読み取れず分かりにくかったため、選択画面の余白に常設で出す
      // 合体画面の一覧の並べかえ。押すたびに昇順/降順が入れ替わる
      const FUSION_SORT_OPTIONS = [
        { key: 'bond', label: '絆レベル' },
        { key: 'lineage', label: '血統' },
        { key: 'name', label: '名前' },
        { key: 'fused', label: '合体回数' },
      ];
      const sortMasuList = (list) => {
        const dir = fusionSortDir === 'asc' ? 1 : -1;
        const val = (m) => {
          if (fusionSortKey === 'bond') return masuBondLevelInfo(m).level;
          if (fusionSortKey === 'fused') return (m.fusionHistory||[]).length;
          if (fusionSortKey === 'lineage') return (ALL_PLAYER_MONSTERS[m.baseId]||{}).name || '';
          return m.name || '';
        };
        return [...list].sort((a,b)=>{
          const va = val(a), vb = val(b);
          if (typeof va === 'string') return va.localeCompare(vb, 'ja') * dir;
          return (va - vb) * dir;
        });
      };
      const fusionSortBar = (
        <div className="flex gap-1.5 mb-2 shrink-0 overflow-x-auto scrollbar-hide">
          {FUSION_SORT_OPTIONS.map(o=>{
            const active = fusionSortKey === o.key;
            return (
              <button key={o.key} onClick={()=>{ if(active) setFusionSortDir(d=>d==='asc'?'desc':'asc'); else { setFusionSortKey(o.key); setFusionSortDir('desc'); } }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[9px] font-black border active:scale-95 ${active?'bg-violet-600 border-violet-400 text-white':'bg-slate-900 border-white/10 text-slate-400'}`}>
                {o.label}{active&&<span className="ml-0.5">{fusionSortDir==='asc'?'▲':'▼'}</span>}
              </button>
            );
          })}
        </div>
      );
      // ルールは5行あって画面の3分の1を占めていた。主役はモンスターの一覧なので、
      // ふだんは1行だけ出して「詳しく」で開く
      // (2026-09-07・ユーザー指摘「モンスターの部分がメインなのに
      //  他でスペースを取りすぎて肝心なとこが窮屈で見にくい」)
      const fusionGuide = renderScreenNote('fusion',
        '主が残り、副は消えます。副の絆経験値はそのまま主へ加わります。',
        ['上がった絆レベルの数だけ、主が強化ポイントを獲得します。',
         '主の名前・見た目・間合い適性・ステータス強化はそのまま維持されます（副の強化は引き継がれません）。',
         '技を引き継がない合体は0ダイヤ、引き継ぐ合体は3000ダイヤです。',
         '固有技の引き継ぎは、副が絆Lv.30以上のときだけ選べます。条件を満たすと副の固有技が主に記録されます。']);

      if (fusionStep==='main') {
        return (
          <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={closeFusion} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体・主を選ぶ</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">絆経験値を受け継いで残る「主」となるマスモンを選んでください</div>
            <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="fusion" compact/></div>
            {fusionGuide}
            {fusionSortBar}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {sortMasuList(masuMons).map(masu=>{
                  const base = ALL_PLAYER_MONSTERS[masu.baseId];
                  if (!base) return null;
                  return (
                    <div key={masu.id} className="relative">
                      {/* 主を選ぶだけの画面なので、絆Lvだけを出す(総合力・強化Pは渡さない)。
                          カードそのものは一覧と同じ共通実装を通すので、染色・限界突破★・
                          転生オーラ・超越マークは他の画面とそろう */}
                      <button onClick={()=>{setFusionMainId(masu.id); setFusionSubId(null); setFusionSubIds([]); setFusionStep('sub');}} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-violet-900/50 bg-slate-900`}>
                        {renderMonsterCardBody({masu,base,mon:null,sub:null})}
                      </button>
                      <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      if (fusionStep==='sub') {
        const main = getMasuMon(fusionMainId);
        if (!main) { resetFusionFlow(); return null; }
        const candidates = sortMasuList(masuMons.filter(m=>m.id!==fusionMainId));
        const candidateIds = new Set(candidates.map(m=>m.id));
        const selectedSubs = fusionSubIds.map(id=>getMasuMon(id)).filter(m=>m && candidateIds.has(m.id));
        const totalSubXp = selectedSubs.reduce((sum, sub)=>sum+cappedBondXp(sub), 0);
        const plannedXp = cappedBondXp(main, totalSubXp);
        const plannedLevel = bondLevelInfo(plannedXp).level;
        const toggleFusionSub = (id) => setFusionSubIds(prev => prev.includes(id) ? prev.filter(selectedId=>selectedId!==id) : [...prev, id]);
        const continueWithFusionSubs = () => {
          if (selectedSubs.length === 0) return;
          setFusionSubId(selectedSubs[0].id);
          setFusionInheritUniqueIds([]);
          setFusionStep('confirm');
        };
        return (
          <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>{setFusionMainId(null); setFusionSubId(null); setFusionSubIds([]); setFusionStep('main');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体・副を選ぶ</h2>
            </div>
            <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">「{main.name}」に絆経験値を渡す「副」をタップして選択／解除してください</div>
            <div className="shrink-0 mb-2 rounded-2xl border border-violet-400/50 bg-violet-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-white">副 <span className="text-violet-300">{selectedSubs.length}体</span>選択中</div>
                {selectedSubs.length>0&&<button onClick={()=>{setFusionSubId(null); setFusionSubIds([]);}} className="min-h-9 px-3 rounded-xl border border-white/15 bg-slate-900 text-[9px] font-black text-slate-200 active:scale-95">すべて解除</button>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] font-bold">
                <div className="rounded-xl bg-black/30 p-2 text-slate-300">獲得予定XP<span className="block text-sm text-cyan-300 font-black">+{totalSubXp.toLocaleString()}</span></div>
                <div className="rounded-xl bg-black/30 p-2 text-slate-300">主の予定値<span className="block text-sm text-emerald-300 font-black">Lv.{plannedLevel} / {plannedXp.toLocaleString()} XP</span></div>
              </div>
              {selectedSubs.length>0&&<div className="mt-2 max-h-16 overflow-y-auto mh-scroll space-y-1">{selectedSubs.map(sub=><div key={sub.id} className="flex justify-between gap-2 text-[9px] text-slate-200"><span className="truncate">{sub.name}・絆Lv.{masuBondLevelInfo(sub).level}</span><span className="shrink-0 text-cyan-300">+{cappedBondXp(sub).toLocaleString()} XP</span></div>)}</div>}
              {selectedSubs.length>1&&<div className="mt-2 rounded-xl border border-violet-500/40 bg-violet-950/40 p-2 text-[9px] font-bold text-violet-200">複数副を選択順にまとめて合体します。固有技継承は確認画面で副ごとに選べ、Lv上限を超える場合は「限界突破して合体」も選べます。</div>}
              <button onClick={continueWithFusionSubs} disabled={selectedSubs.length===0} className="mt-2 w-full min-h-11 rounded-xl bg-violet-600 text-white text-xs font-black disabled:bg-slate-800 disabled:text-slate-500 active:scale-95">{selectedSubs.length>0?`副${selectedSubs.length}体で確認へ`:'副を選択してください'}</button>
            </div>
            {fusionSortBar}
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              {candidates.length===0?(
                <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>💫</span><div className="text-[11px] text-slate-400 mt-2">合体できる他のマスモンがいません。</div></div>
              ):(
                <div className="grid grid-cols-3 gap-2.5 pb-4">
                  {candidates.map(masu=>{
                    const base = ALL_PLAYER_MONSTERS[masu.baseId];
                    if (!base) return null;
                    const selected = fusionSubIds.includes(masu.id);
                    return (
                      <div key={masu.id} className="relative">
                        <button aria-pressed={selected} onClick={()=>toggleFusionSub(masu.id)} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} relative ${selected?'border-violet-300 bg-violet-900/70 ring-2 ring-violet-400/70':'border-violet-900/50 bg-slate-900'}`}>
                          {renderMonsterCardBody({masu,base,mon:null,sub:null})}
                          {selected&&<div className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-violet-500 border-2 border-white flex items-center justify-center shadow-lg"><Check size={13} className="text-white" strokeWidth={4}/></div>}
                        </button>
                        <button onClick={(ev)=>{ev.stopPropagation(); setMasuMonDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      }

      if (fusionStep==='confirm') {
        const main = getMasuMon(fusionMainId);
        const selectedSubs = fusionSubIds.map(id=>getMasuMon(id));
        const sub = selectedSubs[0];
        if (!main || selectedSubs.length===0 || selectedSubs.some(candidate=>!candidate)) { resetFusionFlow(); return null; }
        const mainBase = ALL_PLAYER_MONSTERS[main.baseId];
        const subBase = ALL_PLAYER_MONSTERS[sub.baseId];
        if (!mainBase || !subBase) { resetFusionFlow(); return null; }
        const mainLvl = masuBondLevelInfo(main);
        const subLvl = masuBondLevelInfo(sub);
        const inheritancePlan = buildFusionInheritancePlan({ main, subs:selectedSubs, selectedSubIds:fusionInheritUniqueIds });
        const soulInheritancePreview = buildFusionSoulRankInheritancePlan({
          main, subs:selectedSubs, inherit:false, gold, ownedItems,
        });
        // 魂格継承ONなら、主の魂格/上限を先にプレビュー上だけ引き上げ、その上限で受取XPを再計算する。
        // OFFなら従来の主上限そのまま。副の魂格P最高到達Lv・特性はどちらでも持ち込まない。
        const previewMain = fusionInheritSoulRank && soulInheritancePreview.eligible
          ? soulInheritancePreview.previewMasu : main;
        const mainCap = normalizeMasuProgression(previewMain).levelCap;
        const subXp = selectedSubs.reduce((sum, candidate)=>sum+cappedBondXp(candidate), 0);
        const beforeXp = cappedBondXp(main);
        const soulDiamondCost = fusionInheritSoulRank ? soulInheritancePreview.diamondCost : 0;
        const soulHeroProofCost = fusionInheritSoulRank ? soulInheritancePreview.heroProofCost : 0;
        const goldAfterSoul = Math.max(0, donationDiamondValue(gold)-soulDiamondCost);
        const proofAfterSoul = Math.max(0, ownedItemCount(ownedItems,HERO_PROOF_ITEM_ID)-soulHeroProofCost);
        const previewItems = fusionInheritSoulRank
          ? { ...ownedItems, [HERO_PROOF_ITEM_ID]:proofAfterSoul }
          : ownedItems;
        const diamondSummary = buildFusionDiamondSummary({
          masu:previewMain, fusionXp:subXp, gold:goldAfterSoul,
          psycheOwned:ownedItemCount(previewItems, BREAKTHROUGH_ITEM_ID),
          mainLevel:mainLvl.level, subLevel:subLvl.level, inheritCount:inheritancePlan.inheritCount,
        });
        const { inheritCost, breakthroughDiamondCost, breakthroughPlan } = diamondSummary;
        const normalTotalDiamondCost = soulDiamondCost + diamondSummary.normalDiamondCost;
        const totalDiamondCost = soulDiamondCost + diamondSummary.totalDiamondCost;
        const normalDiamondAfter = donationDiamondValue(gold)-normalTotalDiamondCost;
        const diamondAfter = donationDiamondValue(gold)-totalDiamondCost;
        const normalDiamondShortage = Math.max(0,-normalDiamondAfter);
        const diamondShortage = Math.max(0,-diamondAfter);
        const soulProofShortage = fusionInheritSoulRank ? soulInheritancePreview.heroProofShortage : 0;
        const canAfford = normalDiamondShortage===0 && soulProofShortage===0;
        const afterXp = cappedBondXp(previewMain, subXp);
        const afterLvl = bondLevelInfo(afterXp);
        const gainedLevels = afterLvl.level - mainLvl.level;
        const gainedLevelPoints = gainedEnhancePointsBetweenLevels(mainLvl.level, afterLvl.level);
        const reincarnateTransfer = selectedSubs.reduce((total, candidate)=>{const transfer=transferableReincarnateBonus(candidate);return {points:total.points+transfer.points,count:total.count+transfer.count};},{points:0,count:0});
        // 上限で切り捨てられる絆経験値。あるときは事前に知らせる
        const wastedXp = Math.max(0, (beforeXp + subXp) - afterXp);
        const mainPointsNow = main.distAptPoints || 0;
        return (
          <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
            <div className="flex items-center gap-2 mb-2 shrink-0">
              <button onClick={()=>{setFusionSubId(null); setFusionStep('sub');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
              <h2 className="text-xl font-black italic text-violet-400 uppercase tracking-widest">合体の確認</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-violet-400 shrink-0"><DyedMonsterImage baseId={main.baseId} src={mainBase.iconUrl} alt={main.name} masuColors={getMasuColors(main)} className="w-full h-full object-cover"/></div>
                  <div className="text-[9px] font-black text-violet-200">{main.name}</div>
                  <div className="text-[7px] text-amber-300 font-black">主(残る)</div>
                </div>
                <Sparkles size={20} className="text-amber-300"/>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-500 shrink-0"><DyedMonsterImage baseId={sub.baseId} src={subBase.iconUrl} alt={sub.name} masuColors={getMasuColors(sub)} className="w-full h-full object-cover"/></div>
                  <div className="text-[9px] font-black text-slate-300">{sub.name}</div>
                  <div className="text-[7px] text-slate-500 font-black">副{selectedSubs.length}体(すべて消える)</div>
                </div>
              </div>
              {/* 合体後にどう変わるかの内訳。実行前に結果が分かるようにしている */}
              {soulInheritancePreview.eligible&&<button
                type="button"
                data-soul-rank-inherit-fusion
                onClick={()=>setFusionInheritSoulRank(v=>!v)}
                className={`w-full mb-2 rounded-xl border p-3 text-left active:scale-[.99] ${fusionInheritSoulRank?'border-sky-400 bg-sky-950/40':'border-slate-700 bg-slate-900'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black text-sky-200">魂格を引き継いで合体</div>
                    <div className="text-[8px] font-bold text-slate-400 mt-0.5">
                      {soulInheritancePreview.currentStage>0?`魂格${['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][soulInheritancePreview.currentStage]}`:'魂格なし'}
                      {' → '}
                      魂格{['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][soulInheritancePreview.targetStage]}
                      {' ／ '}Lv上限 {normalizeMasuProgression(main).levelCap} → {soulInheritancePreview.targetLevelCap}
                    </div>
                    <div className="text-[8px] font-black mt-1 text-amber-200">
                      追加 {soulInheritancePreview.diamondCost.toLocaleString()}ダイヤ + 勇者の証{soulInheritancePreview.heroProofCost}
                    </div>
                    <div className="text-[7px] text-slate-500 mt-0.5">副の魂格P・最高到達Lv・魂格特性はコピーしません。通常合体も選べます。</div>
                  </div>
                  <div className={`w-10 h-6 rounded-full shrink-0 relative ${fusionInheritSoulRank?'bg-sky-500':'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${fusionInheritSoulRank?'left-5':'left-1'}`}></div>
                  </div>
                </div>
                {fusionInheritSoulRank&&soulInheritancePreview.heroProofShortage>0&&<div className="mt-1 text-[8px] font-black text-red-300">勇者の証 あと {soulInheritancePreview.heroProofShortage}</div>}
                {fusionInheritSoulRank&&soulInheritancePreview.diamondShortage>0&&<div className="mt-1 text-[8px] font-black text-red-300">魂格継承分だけでダイヤ あと {soulInheritancePreview.diamondShortage.toLocaleString()}</div>}
              </button>}
              <div className="bg-black/40 p-3 rounded-xl border border-pink-500/30 mb-2">
                <div className="text-[9px] font-black text-pink-300 uppercase tracking-wider mb-2">合体後の「{main.name}」</div>
                <div className="grid grid-cols-3 items-center gap-1 mb-2">
                  <div className="text-center">
                    <div className="text-[7px] text-slate-500 font-bold">いま</div>
                    <div className="text-[15px] font-mono font-black text-slate-300">絆Lv.{mainLvl.level}</div>
                  </div>
                  <div className="text-center text-slate-500 text-[14px] font-black">→</div>
                  <div className="text-center">
                    <div className="text-[7px] text-pink-400 font-bold">合体後</div>
                    <div className="text-[15px] font-mono font-black text-pink-300">絆Lv.{afterLvl.level}</div>
                    <div className="text-[7px] text-slate-500 font-bold">上限 Lv.{mainCap}{fusionInheritSoulRank&&soulInheritancePreview.eligible?'（魂格継承後）':''}</div>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">絆レベル</span><span className={`font-black ${gainedLevels>0?'text-pink-300':'text-slate-400'}`}>{gainedLevels>0?`+${gainedLevels}`:'変化なし'}</span></div>
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">絆経験値</span><span className="text-white font-black">{(main.bondXp||0).toLocaleString()} → {afterXp.toLocaleString()} XP</span></div>
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">次のレベルまで</span><span className="text-slate-300 font-black">{afterLvl.xpIntoLevel.toLocaleString()} / {afterLvl.xpForNext.toLocaleString()} XP</span></div>
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">強化ポイント</span><span className={`font-black ${gainedLevelPoints+reincarnateTransfer.points>0?'text-amber-300':'text-slate-400'}`}>{mainPointsNow} → {mainPointsNow + gainedLevelPoints + reincarnateTransfer.points}{gainedLevelPoints+reincarnateTransfer.points>0&&<span className="text-amber-200"> (+{gainedLevelPoints+reincarnateTransfer.points})</span>}</span></div>
                </div>
                {gainedLevels===0&&wastedXp===0&&<div className="text-[8px] text-slate-500 leading-relaxed mt-2">※ 絆経験値は加算されますが、次のレベルには届きません(強化ポイントは増えません)</div>}
                {/* 主のレベル上限を超えるぶんは入らない。押す前に分かるようにしておく */}
                {wastedXp>0&&<div className="text-[9px] text-amber-200 leading-relaxed mt-2 bg-amber-950/40 border border-amber-500/40 rounded-xl px-2.5 py-2">
                  <b className="text-amber-300">この合体ではLv上限を超える経験値を獲得します</b><br/>
                  通常合体では、超過する {wastedXp.toLocaleString()} XP は失われます。
                </div>}
              </div>
              {breakthroughPlan.count>0&&<div className="bg-violet-950/45 p-3 rounded-xl border border-violet-400/50 mb-2 space-y-1">
                <div className="flex justify-between text-[10px] font-black text-violet-200"><span>合体後予定</span><span>Lv.{breakthroughPlan.plannedLevel}</span></div>
                <div className="flex justify-between text-[9px] font-bold"><span className="text-slate-400">現在のLv上限</span><span>Lv.{mainCap}</span></div>
                <div className="flex justify-between text-[10px] font-black"><span className="text-slate-300">必要な限界突破</span><span className="text-violet-300">×{breakthroughPlan.count}</span></div>
                <div className={`flex justify-between text-[9px] font-bold ${breakthroughPlan.psycheShortage?'text-red-300':'text-fuchsia-300'}`}><span>虹のプシュケー</span><span>{breakthroughPlan.psycheHave.toLocaleString()} / {breakthroughPlan.psycheCost.toLocaleString()}{breakthroughPlan.psycheShortage?`（あと${breakthroughPlan.psycheShortage.toLocaleString()}個）`:''}</span></div>
                <div className="flex justify-between text-[9px] font-bold text-amber-300"><span>限界突破のダイヤ</span><span>{breakthroughDiamondCost.toLocaleString()}</span></div>
                {breakthroughPlan.diamondCosts.length>1&&<div className="text-right text-[7px] text-slate-400">{breakthroughPlan.diamondCosts.map(value=>value.toLocaleString()).join(' + ')}</div>}
                {!breakthroughPlan.canReceiveAll&&<div className="text-[8px] text-red-300 font-black">最大上限Lv.{MAX_MASU_LEVEL_CAP}でも全XPは受け取れません。</div>}
                <div className="text-[7px] text-slate-400">限界突破分の固有技ポイントは「あとで決める」として保持されます。</div>
              </div>}
              <div className="bg-black/40 p-3 rounded-xl border border-violet-500/30 mb-2 space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">副の数</span><span className="text-violet-300 font-black">{selectedSubs.length}体</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">合計獲得予定XP</span><span className="text-pink-300 font-black">{subXp.toLocaleString()} XP</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">実際に入るXP</span><span className="text-emerald-300 font-black">{Math.max(0,afterXp-beforeXp).toLocaleString()} XP</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">失われるXP</span><span className={wastedXp>0?"text-amber-300 font-black":"text-slate-300 font-black"}>{wastedXp.toLocaleString()} XP</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">合体後予定Lv</span><span className="text-pink-300 font-black">Lv.{afterLvl.level}</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">転生育成ボーナス</span><span className="text-amber-300 font-black">{reincarnateTransfer.count}回分 / +{reincarnateTransfer.points}P</span></div>
                {reincarnateTransfer.count>0&&<div className="text-[8px] text-slate-400">{selectedSubs.length===1?`副自身 ${normalizeMasuProgression(sub).reincarnateCount}回＋継承済み ${inheritedReincarnateCountOf(sub)}回分を全量継承します`:`選択した副${selectedSubs.length}体の転生由来分をすべて累積します`}</div>}
                <div className="text-[9px] font-black text-violet-200 tracking-wider">ダイヤ消費</div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">所持ダイヤ</span><span className="text-white font-black">{donationDiamondValue(gold).toLocaleString()}</span></div>
                {fusionInheritSoulRank&&soulInheritancePreview.eligible&&<>
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">魂格継承ダイヤ</span><span className="text-sky-300 font-black">{soulDiamondCost.toLocaleString()}</span></div>
                  <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">勇者の証</span><span className={soulProofShortage?'text-red-300 font-black':'text-sky-200 font-black'}>{ownedItemCount(ownedItems,HERO_PROOF_ITEM_ID)} / {soulHeroProofCost}{soulProofShortage?`（あと${soulProofShortage}）`:''}</span></div>
                </>}
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">継承する固有技数</span><span className="text-amber-300 font-black">{inheritancePlan.inheritCount}個</span></div>
                <div className="flex justify-between gap-2 text-[10px] font-bold"><span className="text-slate-400 shrink-0">継承対象</span><span className="text-amber-200 font-black text-right">{inheritancePlan.inheritedEntries.length?inheritancePlan.inheritedEntries.map(entry=>`${entry.sub.name}「${entry.subBase.unique.name}」`).join('、'):'なし'}</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">固有技継承ダイヤ合計</span><span className="text-amber-300 font-black">{inheritCost.toLocaleString()}</span></div>
                <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">限界突破 ×{breakthroughPlan.count}</span><span className="text-amber-300 font-black">{breakthroughDiamondCost.toLocaleString()}</span></div>
                <div className="border-t border-slate-700 pt-1 flex justify-between text-[11px] font-black"><span className="text-slate-200">合計消費</span><span className={diamondShortage?'text-red-300':'text-amber-300'}>{totalDiamondCost.toLocaleString()}</span></div>
                <div className="flex justify-between text-[11px] font-black"><span className="text-slate-200">合体後ダイヤ残高</span><span className={diamondShortage?'text-red-300':'text-emerald-300'}>{Math.max(0, diamondAfter).toLocaleString()}</span></div>
                {diamondShortage>0&&<div className="text-[9px] text-red-300 font-black text-right">あと{diamondShortage.toLocaleString()}ダイヤ必要</div>}
              </div>
              <div className="space-y-2 mb-2">
                {inheritancePlan.entries.map(entry=>{
                  const selected = fusionInheritUniqueIds.includes(entry.sub.id);
                  const disabled = !entry.eligible || (entry.duplicate&&!selected);
                  const reason = !entry.eligible ? `絆Lv${FUSION_INHERIT_MIN_SUB_LEVEL}以上と継承可能な固有技が必要です` : entry.duplicate ? '同じ系統の固有技が主または先の副から継承されます' : '';
                  return <button key={entry.sub.id} disabled={disabled} onClick={()=>setFusionInheritUniqueIds(prev=>prev.includes(entry.sub.id)?prev.filter(id=>id!==entry.sub.id):[...prev,entry.sub.id])} className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border active:scale-95 disabled:opacity-60 ${selected&&!disabled?'bg-amber-950/50 border-amber-500':'bg-slate-900 border-slate-800'}`}>
                    <span className="text-[10px] font-black text-left text-white">{entry.sub.name}：{entry.subBase?.unique?`固有技「${entry.subBase.unique.name}」を引き継ぐ`:'継承可能な固有技なし'}{reason&&<><br/><span className="text-[7px] text-slate-500 font-bold">{reason}{selected&&entry.duplicate?'（選択中ですが費用・継承対象には含みません）':''}</span></>}</span>
                    <div className={`w-9 h-5 rounded-full shrink-0 relative ${selected&&!disabled?'bg-amber-500':'bg-slate-700'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${selected&&!disabled?'left-4':'left-0.5'}`}></div></div>
                  </button>;
                })}
              </div>
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-3 mb-2">
                <div className="text-[9px] text-red-300 font-black flex items-center gap-1 mb-1"><AlertCircle size={11}/>注意</div>
                <div className="text-[8px] text-red-200/90 leading-relaxed">合体すると{selectedSubs.length===1?`副の「${sub.name}」`:`選択した副${selectedSubs.length}体`}はいなくなります。この操作は取り消せません。</div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 shrink-0 mt-1">
            {breakthroughPlan.count>0&&<button onClick={async()=>{
              if (diamondShortage || soulProofShortage || !breakthroughPlan.canAfford) return;
              const result = await executeMasuFusion(true);
              if (!result) return;
              setFusionResultData(result); setFusionStep('anim'); Audio_.se.fusion();
            }} disabled={!!diamondShortage||!!soulProofShortage||!breakthroughPlan.canAfford||fusionProcessingRef.current} className="w-full py-2.5 rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50"><Star size={16}/><span>限界突破 ×{breakthroughPlan.count} して合体<span className="block text-[8px] font-bold opacity-80">{totalDiamondCost.toLocaleString()}ダイヤ消費 → 残り{Math.max(0, diamondAfter).toLocaleString()}</span></span></button>}
            <button onClick={async()=>{
              if (!canAfford) return;
              const result = await executeMasuFusion(false);
              if (!result) return;
              setFusionResultData(result);
              setFusionStep('anim');
              Audio_.se.fusion();
            }} disabled={!canAfford||fusionProcessingRef.current} className={`w-full py-2.5 rounded-2xl font-black text-sm uppercase shadow-lg flex items-center justify-center gap-2 ${canAfford?'bg-slate-700 text-white active:scale-95':'bg-slate-800 text-slate-600'}`}><Sparkles size={16}/><span>{breakthroughPlan.count>0?'通常合体':'合体する'}<span className="block text-[8px] normal-case font-bold opacity-80">{normalTotalDiamondCost.toLocaleString()}ダイヤ消費{fusionInheritSoulRank&&soulHeroProofCost>0?` + 証${soulHeroProofCost}`:''} → 残り{Math.max(0, normalDiamondAfter).toLocaleString()}</span></span></button>
            </div>
          </div>
        );
      }

      if (fusionStep==='anim') {
        const d = fusionResultData;
        if (!d) return null;
        return (
          <div className="fixed inset-0 flex items-center justify-center" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:32000,overflow:'hidden'}}>
            {fusionAnimPhase>=3&&(<div className="absolute inset-0" style={{animation:'fusionFlashFade 700ms ease-out forwards'}}></div>)}
            <div className="flex items-center justify-center gap-6 relative">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-violet-400 shadow-[0_0_30px_rgba(167,139,250,0.6)] bg-slate-900" style={{animation: fusionAnimPhase===1?'fusionSlideInLeft 700ms ease-out forwards':fusionAnimPhase>=2?'fusionMergeShake 600ms ease-in-out':'none'}}>
                {d.mainIconUrl?(<DyedMonsterImage baseId={d.mainBaseId} src={d.mainIconUrl} alt={d.mainName} masuColors={d.mainColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.mainEmoji}</div>)}
              </div>
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-400 shadow-[0_0_30px_rgba(148,163,184,0.5)] bg-slate-900" style={{animation: fusionAnimPhase===1?'fusionSlideInRight 700ms ease-out forwards':fusionAnimPhase>=2?'fusionMergeShake 600ms ease-in-out':'none'}}>
                {d.subIconUrl?(<DyedMonsterImage baseId={d.subBaseId} src={d.subIconUrl} alt={d.subName} masuColors={d.subColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.subEmoji}</div>)}
              </div>
              {fusionAnimPhase>=3&&(
                <div className="absolute left-1/2 top-1/2 rounded-full bg-white" style={{width:'40px',height:'40px',marginLeft:'-20px',marginTop:'-20px',animation:'fusionFlashBurst 700ms ease-out forwards'}}></div>
              )}
            </div>
          </div>
        );
      }

      // result
      const d = fusionResultData;
      if (!d) { resetFusionFlow(); return null; }
      const pctAfter = Math.max(0,Math.min(100,(d.after.xpIntoLevel/Math.max(1,d.after.xpForNext))*100));
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,0.97)',zIndex:32000}}>
          <Sparkles size={32} className="text-amber-300 mb-2"/>
          <h2 className="text-lg font-black text-white mb-1">合体完了！</h2>
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)] mb-3 bg-slate-900">
            {d.mainIconUrl?(<DyedMonsterImage baseId={d.mainBaseId} src={d.mainIconUrl} alt={d.mainName} masuColors={d.mainColors} className="w-full h-full object-cover"/>):(<div className="w-full h-full flex items-center justify-center text-5xl">{d.mainEmoji}</div>)}
          </div>
          <div className="text-sm font-black text-white text-center mb-3">{d.mainName}が{d.subCount>1?`副${d.subCount}体を合体し、`:<>「{d.subName}」の</>}絆経験値<span className="text-pink-300"> {d.gainedXp.toLocaleString()} XP</span>を受け継いだ！</div>
          <div className="w-full max-w-xs bg-black/40 border border-pink-500/30 rounded-2xl p-3 mb-2">
            <div className="flex justify-between text-[9px] text-pink-300 font-black mb-1"><span>絆Lv.{d.before.level}</span><span>→</span><span>絆Lv.{d.after.level}</span></div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pctAfter}%`}}></div></div>
            {d.gainedLevels>0&&<div className="text-[9px] text-emerald-400 font-black text-center mt-1">絆レベルが{d.gainedLevels}上がった！</div>}
          </div>
          {d.soulRankInherited&&(<div data-soul-rank-inherit-result className="text-[10px] text-sky-200 font-black bg-sky-950/50 border border-sky-500/40 rounded-xl px-3 py-1.5 mb-2">魂格を継承しました：{d.soulRankFromStage>0?`魂格${['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][d.soulRankFromStage]}`:'魂格なし'} → 魂格{['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][d.soulRankToStage]}<br/><span className="text-[8px] text-slate-400">追加 {d.soulRankDiamondCost.toLocaleString()}ダイヤ / 勇者の証{d.soulRankHeroProofCost}</span></div>)}
          {d.inherited&&(<div className="text-[10px] text-amber-300 font-black bg-amber-950/50 border border-amber-500/40 rounded-xl px-3 py-1.5 mb-2">「{d.subName}」の固有技を継承データとして記録しました</div>)}
          {d.inheritedReincarnateCount>0&&(<div className="text-[10px] text-amber-200 font-black bg-amber-950/50 border border-amber-500/40 rounded-xl px-3 py-1.5 mb-2">転生育成ボーナス {d.inheritedReincarnateCount}回分（強化ポイント +{d.inheritedReincarnatePoints}）を継承しました</div>)}
          <div className="text-[9px] text-slate-500 font-bold mb-4">ダイヤを{d.cost.toLocaleString()}消費しました</div>
          <button onClick={continueFusionFlow} className="w-full max-w-xs bg-violet-600 text-white py-3.5 rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95">とじる</button>
        </div>
      );
    
}
