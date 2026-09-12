// ==== 画面: 超越強化(gameState === 'MASU_TRANSCEND_ENHANCE') ====
//
// MonsterHeroGame から切り出した14本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
//
// 【この画面ならではの注意】
// ・超越ポイントの割り振りと確定は保存を伴うので、中身は MonsterHeroGame 側に残して props で受ける
// ・この画面は layout-consistency-check が「縦スクロールできる場所がある」を見張っている
//   (ベースから NG のままだが、切り出しでさらに悪くしないこと)

function MasuTranscendEnhanceScreen({
  commitTranscendExchange, commitTranscendFruit, commitTranscendPlan, getMasuMon, masuMonDetail,
  onBack, onMissing, onOpenAutoEnhance, ownedItems, renderPowerBadge, saveMissionProgress,
  setTranscendBulkUnit, setTranscendExchangeError, setTranscendExchangeOpen, setTranscendExchangeWant, setTranscendFruitConfirmAmount,
  setTranscendFruitError, setTranscendFruitItemId, setTranscendFruitOpen, setTranscendPlan, setTranscendResetError,
  setTranscendResetOpen, transcendBulkUnit, transcendExchangeError, transcendExchangeOpen, transcendExchangeWant,
  transcendFruitConfirmAmount, transcendFruitError, transcendFruitItemId, transcendFruitOpen, transcendPlan,
  transcendResetError, transcendResetOpen, useTranscendResetScroll,
})  {

      const masu = getMasuMon(masuMonDetail.id) || masuMonDetail;
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      const normalized = normalizeMasuProgression(masu);
      if (!base) { onMissing(); return null; }
      const points = normalized.transcendPoints;
      const psycheHave = ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID);
      const plan = transcendPlan || { apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0} };
      const planUsed = plan.apt.reduce((a,b)=>a+b,0) + Object.values(plan.stat).reduce((a,b)=>a+b,0);
      const planLeft = points - planUsed;
      const preview = planUsed>0 ? applyTranscendPlanToMasu(masu, plan) : null;
      const previewMasu = preview ? preview.masu : masu;
      const currentPower = masuPowerOf(masu);
      const previewPower = masuPowerOf(previewMasu);
      const baseApt = Array.isArray(base.distAptitude) ? base.distAptitude.slice(0,4) : ['C','C','C','C'];
      const maxGrade = DIST_APTITUDE_GRADES[DIST_APTITUDE_GRADES.length-1];
      const transcendGrade = (idx, extra=0) => raiseAptitudeGrade(baseApt[idx]||'C', normalized.transcendAptBoosts[idx] + extra);
      const aptAtMax = (idx) => transcendGrade(idx, plan.apt[idx]) === maxGrade;
      // 振り分けは通常強化と同じ作法にそろえる(1 / 5 / 10 / MAX・長押しで連続・確定するまで保存しない)
      const changeTranscendPlan = (kind, target, direction) => setTranscendPlan(previous => {
        const q = previous ? {apt:[...previous.apt], stat:{...previous.stat}} : {apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0}};
        const current = kind==='apt' ? q.apt[target] : (q.stat[target]||0);
        const used = q.apt.reduce((a,b)=>a+b,0) + Object.values(q.stat).reduce((a,b)=>a+b,0);
        const remaining = Math.max(0, points - used);
        let amount = transcendBulkUnit==='MAX' ? (direction>0?remaining:current)
          : Math.min(Number(transcendBulkUnit), direction>0?remaining:current);
        if (kind==='apt' && direction>0) {
          // 基礎の段階もMで止める。今の段階から残り何段階上げられるかで頭打ちにする
          const room = DIST_APTITUDE_GRADES.length - 1 - DIST_APTITUDE_GRADES.indexOf(transcendGrade(target));
          amount = Math.min(amount, Math.max(0, room - current));
        }
        const next = Math.max(0, current + direction*Math.max(0, amount));
        if (kind==='apt') q.apt[target] = next; else q.stat[target] = next;
        return q;
      });
      const addApt = (idx, direction) => changeTranscendPlan('apt', idx, direction);
      const addStat = (key, direction) => changeTranscendPlan('stat', key, direction);
      const setTranscendPlanExact = (kind, target, rawValue) => setTranscendPlan(previous => {
        const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};
        const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);
        const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);
        let maxForRow=Math.max(0,points-(used-current));
        if(kind==='apt'){
          const room=DIST_APTITUDE_GRADES.length-1-DIST_APTITUDE_GRADES.indexOf(transcendGrade(target));
          maxForRow=Math.min(maxForRow,Math.max(0,room));
        }
        const next=directEnhancePointAmount(rawValue,maxForRow);
        if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;
        return q;
      });
      // 虹のプシュケーの変換シート。ここで欲しいポイント数を決めてから確定する
      const exchangeMax = transcendPsycheExchange(psycheHave, Number.MAX_SAFE_INTEGER).maxPoints;
      const exchangeWant = Math.max(1, Math.min(Math.max(1, exchangeMax), transcendExchangeWant));
      const exchangeQuote = transcendPsycheExchange(psycheHave, exchangeWant);
      const setWant = (n) => setTranscendExchangeWant(Math.max(1, Math.min(Math.max(1, exchangeMax), n)));
      const openExchange = () => { setTranscendExchangeError(''); setTranscendExchangeWant(exchangeMax>0?1:1); setTranscendExchangeOpen(true); };
      const speciesFruitId = masuSpeciesTranscendFruitItemId(masu.baseId);
      const speciesFruit = speciesTranscendFruitItems()[monsterLineageOf(masu.baseId).main.id];
      const speciesFruitHave = transcendFruitOwnedCount(ownedItems, speciesFruitId);
      const rainbowFruitHave = transcendFruitOwnedCount(ownedItems, RAINBOW_TRANSCEND_FRUIT_ITEM_ID);
      // 【後方互換】種族をモンスター1体単位で作っていたころの実。もう配らないが、持っている人が
      // 使えないままにならないよう、所持しているぶんだけ選択肢へ出す(持っていなければ増えない)
      const legacyFruitChoices = legacySpeciesTranscendFruitsForLineage(masu.baseId)
        .map(item => ({ itemId:item.id, name:`超越の実（旧・${ALL_PLAYER_MONSTERS[item.baseId]?.name||item.baseId}）`, have:transcendFruitOwnedCount(ownedItems, item.id) }))
        .filter(choice => choice.have > 0);
      const fruitChoices = [
        { itemId:speciesFruitId, name:speciesFruit?.name||'対応種族の超越の実', have:speciesFruitHave },
        ...legacyFruitChoices,
        { itemId:RAINBOW_TRANSCEND_FRUIT_ITEM_ID, name:RAINBOW_TRANSCEND_FRUIT_ITEM.name, have:rainbowFruitHave },
      ];
      const hasTranscendFruit = fruitChoices.some(choice => choice.have > 0);
      const selectedFruitHave = transcendFruitOwnedCount(ownedItems, transcendFruitItemId);
      const selectedFruitName = fruitChoices.find(choice => choice.itemId === transcendFruitItemId)?.name || '';
      const openFruit = () => { setTranscendFruitItemId(''); setTranscendFruitConfirmAmount(0); setTranscendFruitError(''); setTranscendFruitOpen(true); };
      const requestFruitUse = async (amount) => {
        if (amount > 1) { setTranscendFruitConfirmAmount(amount); return; }
        await commitTranscendFruit(masu, transcendFruitItemId, amount);
      };
      const runFruitUse = async () => { await commitTranscendFruit(masu, transcendFruitItemId, transcendFruitConfirmAmount); };
      // 超越ポイントリセットの書。振り分け直したいときに、使った超越Pを全部戻す
      const resetScrollHave = ownedItemCount(ownedItems, TRANSCEND_RESET_ITEM_ID);
      const spentPoints = transcendSpentPoints(normalized);
      const openReset = () => { setTranscendResetError(''); setTranscendResetOpen(true); };
      const runReset = async () => {
        const done = await useTranscendResetScroll(masu.id);
        if (done) { await saveMissionProgress('itemUse',1); setTranscendResetOpen(false); }
      };
      const runExchange = async () => {
        const applied = await commitTranscendExchange(masu, exchangeWant);
        if (applied) { setTranscendExchangeOpen(false); setTranscendExchangeWant(1); }
      };
      return (
        <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 flex flex-col overflow-hidden" data-transcend-enhance={masu.id}>
          <div className="flex items-center gap-2 p-4 shrink-0 border-b border-white/10" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))'}}>
            <button aria-label="通常強化へ戻る" onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
            <div className="min-w-0 flex-1">
              <small className="block text-[8px] font-black tracking-widest text-sky-400">TRANSCENDENCE</small>
              <h2 className="truncate text-sm font-black text-white">{masu.name}</h2>
            </div>
            <span className="relative inline-block w-9 h-9 shrink-0">
              <span className="block w-9 h-9 overflow-hidden rounded-full border border-sky-400/40"><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></span>
              <TranscendenceBadge transcended={normalized.transcended} soulRankStage={normalized.soulRankStage} small/>
            </span>
          </div>
          <div data-transcend-enhance-tabs className="shrink-0 w-full max-w-md mx-auto px-4 pt-3 grid grid-cols-3 gap-1.5">
            <button onClick={onBack} className="min-h-[40px] rounded-xl border border-amber-400/50 bg-slate-900 text-amber-200 text-[11px] font-black active:scale-95">通常強化</button>
            <button className="min-h-[40px] rounded-xl bg-sky-500 text-slate-950 text-[11px] font-black">超越強化</button>
            <button onClick={onOpenAutoEnhance} className="min-h-[40px] rounded-xl border border-lime-400/50 bg-slate-900 text-lime-300/80 text-[11px] font-black active:scale-95">オート強化</button>
          </div>
          {/* 超越の話をするセリフは、正式に超越した個体のときだけにする */}
          <div className="shrink-0 w-full max-w-md mx-auto px-4 pt-3"><AssistantBubble scene={normalized.transcended?'transcendence':'masuEnhance'} compact/></div>
          <div className="flex-1 overflow-y-auto mh-scroll p-4 space-y-3 max-w-md mx-auto w-full" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            {/* 残りの超越ポイントと、足りないときの入口(プシュケー変換)を1枚にまとめる */}
            <div className="rounded-3xl border border-sky-400/40 bg-sky-950/30 p-3 shadow-xl">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black tracking-wider text-sky-200">超越ポイント</div>
                  <div className="text-[8px] font-bold text-slate-400">通常の強化ポイントとは別枠</div>
                </div>
                <div data-transcend-points className="text-right leading-none">
                  <span className="text-3xl font-black font-mono text-white">{planLeft}</span>
                  <span className="text-[10px] font-bold text-slate-400"> / {points}</span>
                </div>
              </div>
              <button data-transcend-exchange-open onClick={openExchange} className="mt-3 w-full min-h-[46px] rounded-2xl border border-fuchsia-400/50 bg-fuchsia-950/40 text-fuchsia-100 text-[11px] font-black active:scale-95 flex items-center justify-center gap-2">
                <span aria-hidden="true">🌈</span>虹のプシュケーを変換
                <span className="text-[9px] font-mono text-slate-300">所持 {psycheHave.toLocaleString()}</span>
              </button>
              {hasTranscendFruit&&<button data-transcend-fruit-open onClick={openFruit} className="mt-2 w-full min-h-[46px] rounded-2xl border border-emerald-400/50 bg-emerald-950/40 text-emerald-100 text-[11px] font-black active:scale-95 flex items-center justify-center gap-2">
                <span aria-hidden="true">🍎</span>超越の実を使う
                <span className="text-[9px] font-mono text-slate-300">種族 ×{speciesFruitHave}／虹 ×{rainbowFruitHave}</span>
              </button>}
              {/* 振り直し。使った超越Pが1つも無いときは押せない(本を無駄に減らさない) */}
              <button data-transcend-reset-open disabled={spentPoints<=0||resetScrollHave<=0} onClick={openReset} className="mt-2 w-full min-h-[42px] rounded-2xl border border-amber-400/50 bg-amber-950/30 text-amber-100 text-[11px] font-black active:scale-95 disabled:opacity-35 flex items-center justify-center gap-2">
                <span aria-hidden="true">🌠</span>超越ポイントリセット
                <span className="text-[9px] font-mono text-slate-300">書 ×{resetScrollHave}</span>
              </button>
              {spentPoints<=0&&<div className="mt-1 text-[9px] font-bold text-slate-500 text-center">リセットする超越強化がありません</div>}
              {spentPoints>0&&resetScrollHave<=0&&<div className="mt-1 text-[9px] font-bold text-slate-500 text-center">「超越ポイントリセットの書」はマーケットで買えます</div>}
            </div>
            {/* 振り分け。通常強化(まとめて強化)とまったく同じ並び・同じ操作にそろえている */}
            <div className="bg-slate-900 border border-sky-500/40 rounded-3xl p-3 shadow-xl">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-black text-sky-300 uppercase tracking-wider flex items-center gap-1.5"><Sparkles size={14}/>基礎値を上げる</div>
                <div className="text-[9px] text-slate-400 font-bold">全項目共通</div>
              </div>
              <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-black/40 mb-3" role="group" aria-label="振り分け単位">
                {[1,5,10,100,'MAX'].map(unit=><button type="button" key={unit} data-transcend-unit={unit} aria-pressed={transcendBulkUnit===unit} onClick={()=>setTranscendBulkUnit(unit)} className={`min-h-[40px] rounded-lg text-[11px] font-black active:scale-95 ${transcendBulkUnit===unit?'bg-sky-500 text-slate-950 shadow':'bg-slate-800 text-slate-300'}`}>{unit==='MAX'?'MAX':`${unit}P`}</button>)}
              </div>
              <div className="mb-3">{renderPowerBadge(previewPower, {before: currentPower, size:'md'})}</div>
              <div className="text-[9px] text-slate-400 font-bold mb-1.5">間合い適性<span className="ml-1 text-slate-500">（上限{maxGrade}）</span></div>
              <div className="space-y-1.5 mb-3">
                {RANGE_LABELS.map((label,idx)=>{const before=transcendGrade(idx),after=transcendGrade(idx,plan.apt[idx]),added=plan.apt[idx];return <div key={idx} className="grid grid-cols-[44px_1fr_46px_1fr] items-center gap-1 rounded-xl bg-black/35 p-1.5">
                  <span className={`text-[8px] text-center font-black px-1 py-1 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span>
                  <div className="text-center font-mono font-black text-[12px]"><span className={DIST_APTITUDE_COLOR[before]}>{before}</span><span className="text-slate-500 mx-1">→</span><span className={added>0?'text-sky-300':'text-slate-300'}>{after}</span></div>
                  <label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="transcend-apt" aria-label={`${label}の基礎適性の振り分けポイントを直接入力`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={added} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanExact('apt',idx,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-sky-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-sky-300 outline-none focus:border-sky-300"/><span className="text-[8px] font-black text-sky-300">P</span></label>
                  <div className="grid grid-cols-2 gap-1"><PressRepeatButton aria-label={`${label}の基礎適性を減らす`} disabled={added<=0} onPress={()=>addApt(idx,-1)} className="min-h-[40px] rounded-lg bg-slate-700 text-lg font-black disabled:opacity-20">−</PressRepeatButton><PressRepeatButton aria-label={`${label}の基礎適性を上げる`} disabled={planLeft<=0||aptAtMax(idx)} onPress={()=>addApt(idx,1)} className="min-h-[40px] rounded-lg bg-sky-600 text-lg font-black disabled:bg-slate-700 disabled:opacity-20">＋</PressRepeatButton></div>
                </div>;})}
              </div>
              <div className="text-[9px] text-slate-400 font-bold mb-1.5">ステータス</div>
              <div className="space-y-1.5">
                {Object.entries(STAT_POINT_KEYS).map(([key,label])=>{const n=plan.stat[key]||0,gain=n*(STAT_POINT_GAIN[key]||1),before=normalized.transcendStatPoints[key];return <div key={key} className="grid grid-cols-[44px_1fr_46px_1fr] items-center gap-1 rounded-xl bg-black/35 p-1.5">
                  <span className="text-[8px] text-center text-sky-200 font-black">{label}</span>
                  <div className="text-center font-mono font-black text-[11px]"><span className="text-white">基礎+{before}</span><span className="text-slate-500 mx-1">→</span><span className={gain>0?'text-sky-300':'text-slate-300'}>基礎+{before+gain}</span></div>
                  <label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="transcend-stat" aria-label={`${label}の基礎値の振り分けポイントを直接入力`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={n} onFocus={e=>e.currentTarget.select()} onChange={e=>setTranscendPlanExact('stat',key,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-8 rounded-md border border-sky-500/30 bg-slate-950/80 px-0.5 text-center text-[9px] font-mono font-black text-sky-300 outline-none focus:border-sky-300"/><span className="text-[8px] font-black text-sky-300">P</span></label>
                  <div className="grid grid-cols-2 gap-1"><PressRepeatButton aria-label={`${label}の基礎値を減らす`} disabled={n<=0} onPress={()=>addStat(key,-1)} className="min-h-[40px] rounded-lg bg-slate-700 text-lg font-black disabled:opacity-20">−</PressRepeatButton><PressRepeatButton aria-label={`${label}の基礎値を上げる`} disabled={planLeft<=0} onPress={()=>addStat(key,1)} className="min-h-[40px] rounded-lg bg-sky-600 text-lg font-black disabled:bg-slate-700 disabled:opacity-20">＋</PressRepeatButton></div>
                </div>;})}
              </div>
              <div className="text-[8px] text-slate-500 mt-2">＋／−は長押しでも連続調整できます。1Pで基礎ライフ+{STAT_POINT_GAIN.hp}／ちから・丈夫さ・ガッツ+{STAT_POINT_GAIN.atk}／間合い適性1段階（どれも総合力+10相当）。</div>
            </div>
            <div className="text-[9px] font-bold text-slate-400 leading-relaxed">超越強化は「基礎値」を上げるので、絆ポイントリセットの書で通常の強化を戻しても消えません。転生・限界突破でも残ります。確定するまで保存データは変わりません。</div>
            {!normalized.transcended&&<div data-transcend-not-yet className="rounded-2xl border border-slate-500/40 bg-black/40 p-3 text-[9px] font-bold text-slate-400 leading-relaxed">この個体はまだ神殿で超越していませんが、超越強化はいつでも使えます。あとで正式に超越しても、ここで上げた基礎値と残っている超越ポイントはそのまま引き継がれます。<br/>神殿の「超越」（Lv上限400→500・超越マーク）は、これまでどおりLv.{MAX_MASU_LEVEL_CAP}・限界突破{FINAL_BREAKTHROUGH_COUNT}回が必要です。</div>}
          </div>
          <div className="shrink-0 grid grid-cols-2 gap-2 p-4 border-t border-white/10" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
            <button onClick={()=>setTranscendPlan(null)} disabled={planUsed<=0} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 font-black text-xs disabled:opacity-35 active:scale-95">キャンセル</button>
            <button data-transcend-commit disabled={planUsed<=0} onClick={()=>commitTranscendPlan(masu, plan)} className="min-h-[48px] rounded-2xl bg-sky-500 text-slate-950 font-black text-xs disabled:opacity-35 active:scale-95">この配分で確定（{planUsed}P）</button>
          </div>
          {/* 超越ポイントのリセット。何が何点戻るのかを出してから確定させる */}
          {transcendResetOpen&&(
            <div data-transcend-reset-sheet role="dialog" aria-modal="true" aria-label="超越ポイントをリセット" className="absolute inset-0 flex items-end justify-center" style={{zIndex:30500,backgroundColor:'rgba(2,6,23,0.86)'}} onClick={()=>setTranscendResetOpen(false)}>
              <div className="w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border-t border-x border-amber-400/40 bg-slate-900 p-4 space-y-3" style={{maxHeight:'calc(100% - env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-amber-200 flex items-center gap-1.5"><span aria-hidden="true">🌠</span>超越ポイントをリセットしますか？</h3>
                  <button aria-label="閉じる" onClick={()=>setTranscendResetOpen(false)} className="p-2 text-slate-400 active:scale-90"><X size={18}/></button>
                </div>
                <div className="rounded-2xl border border-amber-400/30 bg-amber-950/25 p-3 space-y-1 text-[10px] font-black">
                  <div className="flex justify-between"><span className="text-slate-300">使用済み超越P</span><span className="font-mono text-white">{spentPoints}P</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">未使用超越P</span><span className="font-mono text-white">{points}P</span></div>
                  <div className="flex justify-between pt-1 border-t border-white/10"><span className="text-slate-300">リセット後の未使用超越P</span><span className="font-mono text-amber-200">{points + spentPoints}P</span></div>
                  <div className="flex justify-between"><span className="text-slate-300">超越ポイントリセットの書</span><span className="font-mono text-white">×{resetScrollHave} → ×{Math.max(0, resetScrollHave - 1)}</span></div>
                </div>
                <div className="text-[9px] font-bold text-slate-400 leading-relaxed">超越で上げた基礎ステータスと基礎の間合い適性が元へ戻り、そのぶんの超越ポイントが未使用へ返ります。絆レベル・絆経験値・Lv上限・超越済みかどうか・限界突破・転生回数・通常の強化は変わりません。<b className="text-amber-200">交換に使った虹のプシュケーは戻りません。</b></div>
                {transcendResetError&&<div className="text-[10px] font-black text-red-400">{transcendResetError}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setTranscendResetOpen(false)} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 font-black text-xs active:scale-95">やめる</button>
                  <button data-transcend-reset-commit disabled={spentPoints<=0||resetScrollHave<=0} onClick={runReset} className="min-h-[48px] rounded-2xl bg-amber-500 text-slate-950 font-black text-xs disabled:opacity-35 active:scale-95">書を1冊使ってリセット</button>
                </div>
              </div>
            </div>
          )}
          {/* 虹のプシュケーの変換。振り分けの画面と混ざるとごちゃつくので、専用のシートへ分けている */}
          {transcendExchangeOpen&&(
            <div data-transcend-exchange-sheet role="dialog" aria-modal="true" aria-label="虹のプシュケーを変換" className="absolute inset-0 flex items-end justify-center" style={{zIndex:30500,backgroundColor:'rgba(2,6,23,0.86)'}} onClick={()=>setTranscendExchangeOpen(false)}>
              <div className="w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border-t border-x border-fuchsia-400/40 bg-slate-900 p-4 space-y-3" style={{maxHeight:'calc(100% - env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-fuchsia-200 flex items-center gap-1.5"><span aria-hidden="true">🌈</span>虹のプシュケーを変換</h3>
                  <button aria-label="閉じる" onClick={()=>setTranscendExchangeOpen(false)} className="p-2 text-slate-400 active:scale-90"><X size={18}/></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-black/40 p-2.5 text-center"><div className="text-[8px] font-black text-slate-400">所持している🌈</div><div className="font-mono text-lg font-black text-white">{psycheHave.toLocaleString()}</div></div>
                  <div className="rounded-2xl bg-black/40 p-2.5 text-center"><div className="text-[8px] font-black text-slate-400">交換レート</div><div className="font-mono text-[11px] font-black text-fuchsia-200">🌈{TRANSCEND_PSYCHE_PER_POINT.toLocaleString()} → 1P</div></div>
                </div>
                {exchangeMax<=0
                  ? <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-3 text-center text-[10px] font-black text-amber-200">虹のプシュケーが {TRANSCEND_PSYCHE_PER_POINT.toLocaleString()} 個そろうと変換できます（あと {(TRANSCEND_PSYCHE_PER_POINT-psycheHave).toLocaleString()}）。</div>
                  : <>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-black/40 p-2.5">
                      <PressRepeatButton aria-label="変換するポイントを減らす" disabled={exchangeWant<=1} onPress={()=>setWant(exchangeWant-1)} className="min-h-[44px] rounded-xl bg-slate-700 text-xl font-black disabled:opacity-25">−</PressRepeatButton>
                      <div className="text-center leading-none"><span data-transcend-exchange-want className="font-mono text-3xl font-black text-white">{exchangeWant}</span><span className="text-[10px] font-bold text-slate-400">P</span></div>
                      <PressRepeatButton aria-label="変換するポイントを増やす" disabled={exchangeWant>=exchangeMax} onPress={()=>setWant(exchangeWant+1)} className="min-h-[44px] rounded-xl bg-fuchsia-700 text-xl font-black disabled:bg-slate-700 disabled:opacity-25">＋</PressRepeatButton>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[['1P',1],['5P',5],['MAX',exchangeMax]].map(([label,amount])=>(
                        <button key={label} data-transcend-exchange={label} disabled={amount>exchangeMax} onClick={()=>setWant(amount)} className={`min-h-[40px] rounded-xl text-[11px] font-black active:scale-95 disabled:opacity-30 ${exchangeWant===Math.min(amount,exchangeMax)?'bg-fuchsia-600 text-white':'bg-slate-800 text-slate-300'}`}>{label}</button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-950/25 p-3 space-y-1 text-[10px] font-black">
                      <div className="flex justify-between"><span className="text-slate-300">使う🌈</span><span className="font-mono text-white">{exchangeQuote.psycheCost.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-300">交換後の🌈</span><span className="font-mono text-white">{exchangeQuote.nextPsyche.toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-slate-300">超越ポイント</span><span className="font-mono text-fuchsia-200">{points} → {points+exchangeQuote.points}</span></div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400">{TRANSCEND_PSYCHE_PER_POINT.toLocaleString()}個に満たない端数は消費しません。変換したポイントは、いま開いている「{masu.name}」に入ります。</div>
                  </>}
                {transcendExchangeError&&<div className="text-[10px] font-black text-red-400">{transcendExchangeError}</div>}
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={()=>setTranscendExchangeOpen(false)} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 font-black text-xs active:scale-95">閉じる</button>
                  <button data-transcend-exchange-commit disabled={!exchangeQuote.ok} onClick={runExchange} className="min-h-[48px] rounded-2xl bg-fuchsia-600 text-white font-black text-xs disabled:opacity-35 active:scale-95">この内容で変換</button>
                </div>
              </div>
            </div>
          )}
          {transcendFruitOpen&&(
            <div data-transcend-fruit-sheet role="dialog" aria-modal="true" aria-label="超越の実を使う" className="absolute inset-0 flex items-end justify-center" style={{zIndex:30500,backgroundColor:'rgba(2,6,23,0.86)'}} onClick={()=>setTranscendFruitOpen(false)}>
              <div className="w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border-t border-x border-emerald-400/40 bg-slate-900 p-4 space-y-3" style={{maxHeight:'calc(100% - env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} onClick={e=>e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-black text-emerald-200">🍎 超越の実を使う</h3><button aria-label="閉じる" onClick={()=>setTranscendFruitOpen(false)} className="min-h-[44px] min-w-[44px] p-2 text-slate-400 active:scale-90"><X size={18}/></button></div>
                <p className="text-[9px] font-bold text-slate-400">使用する実を選んでください。虹の実が自動で代用されることはありません。</p>
                <div className="grid grid-cols-2 gap-2">
                  {fruitChoices.map(({itemId,name,have})=><button key={itemId} data-transcend-fruit-select={itemId} disabled={have<=0} aria-pressed={transcendFruitItemId===itemId} onClick={()=>{setTranscendFruitItemId(itemId);setTranscendFruitConfirmAmount(0);setTranscendFruitError('');}} className={`min-h-[64px] rounded-2xl border p-2 text-[9px] font-black active:scale-95 disabled:opacity-35 ${transcendFruitItemId===itemId?'border-emerald-200 bg-emerald-600 text-white ring-2 ring-emerald-200':'border-white/10 bg-slate-800 text-slate-200'}`}><span className="block leading-tight">{name}</span><span className="mt-1 block font-mono text-[12px]">所持 ×{have}</span></button>)}
                </div>
                {!transcendFruitItemId?<div className="rounded-xl bg-black/30 p-3 text-center text-[10px] font-black text-amber-200">使用する実を明示選択してください</div>:<>
                  <div className="grid grid-cols-3 gap-2">{[[1,'1'],[10,'10'],[selectedFruitHave,'MAX']].map(([amount,label])=><button key={label} data-transcend-fruit-amount={label} disabled={selectedFruitHave<amount||amount<=0} onClick={()=>requestFruitUse(amount)} className="min-h-[44px] rounded-xl bg-emerald-700 text-sm font-black active:scale-95 disabled:opacity-30">{label}</button>)}</div>
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-950/25 p-3 text-[10px] font-black"><div className="flex justify-between"><span className="text-slate-300">現在の超越ポイント</span><span className="font-mono">{points}P</span></div><div className="flex justify-between"><span className="text-slate-300">使用後（選択中）</span><span className="font-mono text-emerald-200">{points} → {points+(transcendFruitConfirmAmount||1)}P</span></div></div>
                </>}
                {transcendFruitConfirmAmount>1&&<div data-transcend-fruit-confirm className="rounded-2xl border border-amber-400/40 bg-amber-950/25 p-3 space-y-2"><div className="text-[11px] font-black text-amber-200">{selectedFruitName}を{transcendFruitConfirmAmount}個使いますか？</div><div className="text-[10px] font-bold text-slate-300">所持 ×{selectedFruitHave} → ×{selectedFruitHave-transcendFruitConfirmAmount}<br/>超越ポイント {points}P → {points+transcendFruitConfirmAmount}P</div><div className="grid grid-cols-2 gap-2"><button onClick={()=>setTranscendFruitConfirmAmount(0)} className="min-h-[44px] rounded-xl bg-slate-700 text-xs font-black">戻る</button><button data-transcend-fruit-commit onClick={runFruitUse} className="min-h-[44px] rounded-xl bg-amber-500 text-slate-950 text-xs font-black">使用を確定</button></div></div>}
                {transcendFruitError&&<div className="text-[10px] font-black text-red-400">{transcendFruitError}</div>}
                <button onClick={()=>setTranscendFruitOpen(false)} className="min-h-[48px] w-full rounded-2xl bg-slate-800 text-slate-200 text-xs font-black">閉じる</button>
              </div>
            </div>
          )}
        </div>
      );
    
}
