// ==== 画面: マスモン強化(gameState === 'MASU_ENHANCE') ====
//
// MonsterHeroGame から切り出した15本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
//
// 【この画面ならではの注意】
// ・強化ポイントの割り振りと確定は保存を伴うので、中身は MonsterHeroGame 側に残して props で受ける
// ・戻り先は masuEnhanceFrom(どこから来たか)で決まる。行き先の判断は本体に残す
// ・見た目は 41-screen-ui.jsx の共通ガワ(SCREEN_*/ScreenHead/ScreenEmpty)へそろえてある。
//   根は data-mh-screen 付き(横画面で2カラムへ組み替わる目印)で、一覧は根の直下に1つだけ置く。
//   確定バーは一覧の中へ sticky で入れない(下の中身をスクロール中ずっと覆ってしまう)

function MasuEnhanceScreen({
  addAssistantBond, autoEnhanceIntroVisible, bulkEnhanceUnit, bulkPlan, getMasuMon, masuMonDetail,
  onBack, onDismissAutoEnhanceIntro, onMissing, onOpenAutoEnhance, onOpenTranscendEnhance,
  renderPowerBadge, saveMissionProgress,
  setBulkEnhanceUnit, setBulkPlan, setEffect, setMasuMonDetail, spendPointsBulk,
})  {

      const masu = getMasuMon(masuMonDetail.id) || masuMonDetail;
      const base = ALL_PLAYER_MONSTERS[masu.baseId];
      if (!base) { onMissing(); return null; }
      const lvl = masuBondLevelInfo(masu);
      const pct = Math.max(0, Math.min(100, (lvl.xpIntoLevel/Math.max(1,lvl.xpForNext))*100));
      const points = masu.distAptPoints||0;
      const resolvedIndividualStats = resolveMasuIndividualStats(masu, base);
      const resolvedDistAptitude = resolveMasuDistAptitude(masu, base);
      const currentStatValue = (key) => (resolvedIndividualStats[key]||0) + (masu.statPoints?.[key]||0);
      // 総合力は共通関数から都度出す。1ポイント強化も一括強化も、強化前と強化後を
      // 同じ計算に通した差分を出すので、画面に「+10」を直接書かない
      const currentPower = masuPowerOf(masu);
      const ps = mergeMasuIntoMon(masu)?.plusStats||{};
      const autoEnhance = normalizeMasuAutoEnhance(masu.autoEnhance);
      // 強化はマスモン詳細の「育成・カスタム」から入るので、戻り先も詳細にする。
      // ここで masuMonDetail を消すと一覧まで戻され、続けて染色やトレーニングをしたいときに
      // また同じ個体を探し直すことになる(詳細の中身は getMasuMon で引き直すので最新の値が出る)
      const backToDetail = onBack;
      // --- まとめて振るモード ---
      const plan = bulkPlan || { apt:[0,0,0,0], stat:{hp:0,atk:0,def:0,guts:0} };
      const planUsed = plan.apt.reduce((a,b)=>a+b,0) + Object.values(plan.stat).reduce((a,b)=>a+b,0);
      const planLeft = points - planUsed;
      const restoreDraft = buildBondResetRestorePlan(masu, masu.bondResetAllocationSnapshot);
      const restoreResetAllocation = () => { if (restoreDraft?.restored > 0) setBulkPlan(restoreDraft.plan); };
      // 下書き段階での間合い適性(何段階上がるか)。上限Mを超えないようにする
      const plannedGrade = (idx) => {
        const cur = DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[idx]||'C');
        return DIST_APTITUDE_GRADES[Math.min(DIST_APTITUDE_GRADES.length-1, Math.max(0, cur + plan.apt[idx]))];
      };
      const canPlanApt = (idx) => planLeft>0 && DIST_APTITUDE_GRADES.indexOf(plannedGrade(idx)) < DIST_APTITUDE_GRADES.length-1;
      const changePlan = (kind, target, direction) => setBulkPlan(previous => {
        const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};
        const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);
        const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);
        const remaining=Math.max(0,points-used);
        let amount=bulkEnhanceUnit==='MAX'?(direction>0?remaining:current):Math.min(Number(bulkEnhanceUnit),direction>0?remaining:current);
        if(kind==='apt'&&direction>0){
          const baseGradeIndex=DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[target]||'C');
          amount=Math.min(amount,DIST_APTITUDE_GRADES.length-1-baseGradeIndex-current);
        }
        const next=Math.max(0,current+direction*Math.max(0,amount));
        if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;
        return q;
      });
      const addPlanApt = (idx, direction) => changePlan('apt',idx,direction);
      const addPlanStat = (key, direction) => changePlan('stat',key,direction);
      const setPlanExact = (kind, target, rawValue) => setBulkPlan(previous => {
        const q=previous?{apt:[...previous.apt],stat:{...previous.stat}}:{apt:[0,0,0,0],stat:{hp:0,atk:0,def:0,guts:0}};
        const current=kind==='apt'?q.apt[target]:(q.stat[target]||0);
        const used=q.apt.reduce((a,b)=>a+b,0)+Object.values(q.stat).reduce((a,b)=>a+b,0);
        let maxForRow=Math.max(0,points-(used-current));
        if(kind==='apt'){
          const baseGradeIndex=DIST_APTITUDE_GRADES.indexOf(resolvedDistAptitude[target]||'C');
          maxForRow=Math.min(maxForRow,Math.max(0,DIST_APTITUDE_GRADES.length-1-baseGradeIndex));
        }
        const next=directEnhancePointAmount(rawValue,maxForRow);
        if(kind==='apt')q.apt[target]=next;else q.stat[target]=next;
        return q;
      });
      const applyPlan = () => {
        const updated = spendPointsBulk(masu.id, plan);
        if (!updated) return;
        setMasuMonDetail(updated);
        saveMissionProgress('enhance');
        addAssistantBond('enhance');
        setBulkPlan(null);
        const lines = [];
        plan.apt.forEach((n,i)=>{ if(n>0) lines.push(`${RANGE_LABELS[i]}距離適性 +${n}`); });
        Object.entries(plan.stat).forEach(([k,n])=>{ if(n>0) lines.push(`${STAT_POINT_KEYS[k]} +${n*(STAT_POINT_GAIN[k]||1)}`); });
        setEffect({type:'enhance',label:'まとめて強化！',icon:'💪',monEmoji:base.emoji,imgUrl:base.iconUrl,baseId:masu.baseId,colors:getMasuColors(updated),subLabel:lines.join('\n')});
        setTimeout(()=>setEffect(null),1200);
      };
      return (
        <div data-mh-screen style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className={`absolute inset-0 overflow-hidden ${SCREEN_SHELL_CLASS}`}>
          <ScreenHead title="マスモン強化" accent="text-amber-400" onBack={backToDetail} backLabel="マスモン詳細へ戻る"/>
          {/* どのマスモンでも通常強化・超越強化・オート強化を切り替えられる。
              超越強化が使えるかどうかと、神殿で正式に超越したかどうかは別の話 */}
          <div data-transcend-enhance-tabs className="shrink-0 w-full max-w-md mx-auto mb-2 grid grid-cols-3 gap-2">
            <button type="button" aria-current="page" className="min-h-[44px] rounded-xl bg-amber-500 text-slate-950 text-[11px] font-black">通常強化</button>
            <button type="button" onClick={onOpenTranscendEnhance} className="min-h-[44px] rounded-xl border border-white/10 bg-slate-900 text-sky-200 text-[11px] font-black active:scale-95">超越強化</button>
            <button type="button" onClick={onOpenAutoEnhance} className={`min-h-[44px] rounded-xl border bg-slate-900 text-[11px] font-black active:scale-95 flex items-center justify-center gap-1 ${autoEnhance.enabled?'border-lime-400/60 text-lime-200':'border-white/10 text-lime-300/80'}`}>オート強化{autoEnhance.enabled&&<span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-lime-400"/>}</button>
          </div>
          <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="masuEnhance" compact/></div>
          <div className={`${SCREEN_LIST_CLASS} w-full max-w-md mx-auto space-y-3`}>
            {/* どの子を強化しているかは、いちばん上で分かるようにする(下にあると最初の画面に入らない) */}
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-slate-900 p-3">
              <div className="relative w-16 h-16 shrink-0">
                <div className={`w-16 h-16 rounded-full overflow-hidden border ${(masu.fusionHistory||[]).length>0?'border-amber-400 ring-2 ring-amber-400':'border-amber-400/40'}`}><DyedMonsterImage baseId={masu.baseId} src={base.iconUrl} alt={masu.name} masuColors={getMasuColors(masu)} className="w-full h-full object-cover"/></div>
                <ReincarnateBadge count={masu.reincarnateCount}/>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black text-white truncate">{masu.name}</h3>
                <div className="text-[10px] text-amber-400 font-bold">マスモン・元は{base.name}</div>
                <div className="mt-1">
                  <div className="text-[10px] text-pink-300 font-black flex items-center gap-1"><Heart size={10}/>絆 Lv.{lvl.level} <span className="text-slate-400">/ {normalizeMasuProgression(masu).levelCap}</span></div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-pink-500/20 mt-0.5"><div className="h-full bg-gradient-to-r from-pink-500 to-rose-400" style={{width:`${pct}%`}}></div></div>
                  <div className="mt-1.5">{renderPowerBadge(currentPower, {dense:true, size:'sm'})}</div>
                </div>
              </div>
            </div>
            <div className={`${SCREEN_PANEL_FLAT_CLASS} flex items-center justify-between`}>
              <div className="text-[11px] text-amber-300 font-black flex items-center gap-1.5"><Sparkles size={12}/>強化ポイント</div>
              <div className="text-xl text-white font-black font-mono">{points}</div>
            </div>
            {/* 画面のなかでの使い方案内(CLAUDE.md ⑤)。オート強化は裏で働く仕組みで、
                ここを開いた人が上のタブに気づかないと一生出会えないため、最初の1回だけ知らせる */}
            {autoEnhanceIntroVisible&&(
              <div className="rounded-2xl border border-lime-400/60 bg-lime-950/30 p-3">
                <div className="text-[13px] font-black text-lime-200">💡 強化を毎回手で振るのが大変なら</div>
                <div className="mt-1 text-[11px] font-bold text-slate-200 leading-relaxed">上の「オート強化」で、この子ごとに「どこまで上げてよいか」と「その中での優先順位」を決めておけます。強化ポイントが入るたび自動で振られるので、転生したあとの周回でも放っておくだけで元の形まで戻ります。</div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={()=>{onDismissAutoEnhanceIntro();onOpenAutoEnhance();}} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-lime-500 text-slate-950 text-[12px] font-black active:scale-95">設定を開く</button>
                  <button type="button" onClick={onDismissAutoEnhanceIntro} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 text-slate-300 text-[12px] font-black active:scale-95">あとで</button>
                </div>
              </div>
            )}
            {autoEnhance.enabled&&(
              <button type="button" onClick={onOpenAutoEnhance} className="w-full min-h-[44px] rounded-xl border border-lime-400/60 bg-lime-950/20 px-3 py-2 text-left active:scale-95">
                <div className="text-[11px] font-black text-lime-200 flex items-center gap-1.5"><Sparkles size={12}/>オート強化 ON</div>
                <div className="text-[10px] font-bold text-slate-300 mt-0.5">強化ポイントが入ると、決めた上限と優先順位で自動的に振られます。タップで設定へ。</div>
              </button>
            )}

            {/* まとめて強化: 1ポイントずつタップするのが手間なので、
                振り分けを下書きしてから一度に確定できるようにしている */}
            {points>0&&(
              <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-3 shadow-xl">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[13px] font-black text-amber-300 flex items-center gap-1.5"><Sparkles size={14}/>まとめて強化</div>
                  <div className="text-[10px] text-slate-400 font-bold">全項目共通</div>
                </div>
                <div className="grid grid-cols-5 gap-1 p-1 rounded-xl bg-black/30 mb-3" role="group" aria-label="振り分け単位">
                  {[1,5,10,100,'MAX'].map(unit=><button type="button" key={unit} aria-pressed={bulkEnhanceUnit===unit} onClick={()=>setBulkEnhanceUnit(unit)} className={`min-h-[44px] rounded-xl text-[11px] font-black active:scale-95 ${bulkEnhanceUnit===unit?'bg-amber-500 text-slate-950 shadow':'bg-slate-800 text-slate-300'}`}>{unit==='MAX'?'MAX':`${unit}P`}</button>)}
                </div>
                {restoreDraft&&restoreDraft.requested>0&&<div className="mb-3 rounded-xl border border-cyan-400/40 bg-cyan-950/20 p-2">
                  <button type="button" onClick={restoreResetAllocation} disabled={restoreDraft.restored<=0} className="mh-button mh-button-secondary w-full min-h-[44px] rounded-xl bg-slate-800 text-cyan-200 text-[12px] font-black active:scale-95 disabled:opacity-30">↩ リセット前の配分を復元</button>
                  <div className={`mt-1 text-[10px] font-bold text-center ${restoreDraft.omitted>0?'text-amber-300':'text-slate-400'}`}>{restoreDraft.omitted>0?`現行の上限・残りptに合わせ、${restoreDraft.restored}ptを仮配分（復元できない分 ${restoreDraft.omitted}pt）`:'保存は「強化する」を押した時だけです'}</div>
                </div>}
                <div className="mb-3">{renderPowerBadge(plannedMasuPowerOf(masu, plan), {before: currentPower, size:'md'})}</div>
                <div className="text-[11px] text-slate-400 font-black mb-1.5">間合い適性</div>
                <div className="space-y-1.5 mb-3">
                  {RANGE_LABELS.map((label,idx)=>{const before=resolvedDistAptitude[idx]||'C',after=plannedGrade(idx),added=plan.apt[idx];return <div key={idx} className="grid grid-cols-[48px_1fr_56px_1fr] items-center gap-1 rounded-xl bg-black/30 p-1.5">
                    <span className={`text-[10px] text-center font-black px-1 py-1 rounded-full ${RANGE_STYLES[idx].labelBg}`}>{label}</span>
                    <div className="text-center font-mono font-black text-[12px]"><span className={DIST_APTITUDE_COLOR[before]}>{before}</span><span className="text-slate-400 mx-1">→</span><span className={added>0?'text-cyan-300':'text-slate-300'}>{after}</span></div>
                    <label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="normal-apt" aria-label={`${label}距離適性の振り分けポイントを直接入力`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={added} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanExact('apt',idx,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-11 rounded-xl border border-amber-400/40 bg-slate-950/80 px-0.5 text-center text-[12px] font-mono font-black text-amber-300 outline-none focus:border-amber-300"/><span className="text-[10px] font-black text-amber-300">P</span></label>
                    <div className="grid grid-cols-2 gap-1"><PressRepeatButton aria-label={`${label}距離適性を減らす`} disabled={added<=0} onPress={()=>addPlanApt(idx,-1)} className="min-h-[44px] rounded-xl bg-slate-700 text-lg font-black active:scale-95 disabled:opacity-30">−</PressRepeatButton><PressRepeatButton aria-label={`${label}距離適性を増やす`} disabled={!canPlanApt(idx)} onPress={()=>addPlanApt(idx,1)} className="min-h-[44px] rounded-xl bg-amber-600 text-lg font-black active:scale-95 disabled:bg-slate-700 disabled:opacity-30">＋</PressRepeatButton></div>
                  </div>;})}
                </div>
                <div className="text-[11px] text-slate-400 font-black mb-1.5">ステータス</div>
                <div className="space-y-1.5">
                  {Object.entries(STAT_POINT_KEYS).map(([key,label])=>{const n=plan.stat[key]||0,gain=n*(STAT_POINT_GAIN[key]||1),before=currentStatValue(key);return <div key={key} className="grid grid-cols-[48px_1fr_56px_1fr] items-center gap-1 rounded-xl bg-black/30 p-1.5">
                    <span className="text-[10px] text-center text-emerald-300 font-black">{label}</span>
                    <div className="text-center font-mono font-black text-[11px]"><span className="text-white">{before}</span><span className="text-slate-400 mx-1">→</span><span className={gain>0?'text-emerald-300':'text-slate-300'}>{before+gain}</span></div>
                    <label className="flex items-center gap-0.5 min-w-0"><input data-direct-point-input="normal-stat" aria-label={`${label}の振り分けポイントを直接入力`} type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" autoComplete="off" value={n} onFocus={e=>e.currentTarget.select()} onChange={e=>setPlanExact('stat',key,e.currentTarget.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}} className="w-full min-w-0 h-11 rounded-xl border border-amber-400/40 bg-slate-950/80 px-0.5 text-center text-[12px] font-mono font-black text-amber-300 outline-none focus:border-amber-300"/><span className="text-[10px] font-black text-amber-300">P</span></label>
                    <div className="grid grid-cols-2 gap-1"><PressRepeatButton aria-label={`${label}を減らす`} disabled={n<=0} onPress={()=>addPlanStat(key,-1)} className="min-h-[44px] rounded-xl bg-slate-700 text-lg font-black active:scale-95 disabled:opacity-30">−</PressRepeatButton><PressRepeatButton aria-label={`${label}を増やす`} disabled={planLeft<=0} onPress={()=>addPlanStat(key,1)} className="min-h-[44px] rounded-xl bg-emerald-700 text-lg font-black active:scale-95 disabled:bg-slate-700 disabled:opacity-30">＋</PressRepeatButton></div>
                  </div>;})}
                </div>
                <div className="text-[10px] text-slate-400 mt-2">＋／−は長押しでも連続調整できます。確定するまで保存データは変わりません。</div>
              </div>
            )}
            {/* 振れるポイントが無いときは、まとめて強化の枠ごと消える。何も出ないと迷うので理由を出す */}
            {points<=0&&(
              <ScreenEmpty emoji="💪" lines={['いま振り分けられる強化ポイントはありません','絆レベルが上がると強化ポイントが増えます']}/>
            )}
            <div className={SCREEN_PANEL_FLAT_CLASS}>
              <div className="text-[10px] text-slate-400 font-bold mb-1">現在のステータス(強化分込み)</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1"><div className="flex justify-between text-[11px] font-mono"><span>ライフ:</span><span className="text-pink-400 font-bold">{currentStatValue('hp')}{(masu.statPoints?.hp||0)>0&&<span className="text-emerald-400 text-[10px]"> (+{masu.statPoints.hp})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>ちから:</span><span className="text-red-400 font-bold">{currentStatValue('atk')}{(masu.statPoints?.atk||0)>0&&<span className="text-emerald-400 text-[10px]"> (+{masu.statPoints.atk})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>丈夫さ:</span><span className="text-emerald-400 font-bold">{currentStatValue('def')}{(masu.statPoints?.def||0)>0&&<span className="text-emerald-400 text-[10px]"> (+{masu.statPoints.def})</span>}</span></div><div className="flex justify-between text-[11px] font-mono"><span>ガッツ:</span><span className="text-amber-400 font-bold">{currentStatValue('guts')}{(masu.statPoints?.guts||0)>0&&<span className="text-emerald-400 text-[10px]"> (+{masu.statPoints.guts})</span>}</span></div></div>
            </div>
            <div className="rounded-xl border border-pink-500/30 bg-black/30 px-3 py-2">
              <div className="text-[10px] text-pink-400 font-bold">合流ボーナス(このマスモンが供モンとして合流した時に加算される値)</div>
              <div className="text-[11px] text-white font-bold mt-1">{ps.hp>0&&`HP+${ps.hp} `}{ps.atk>0&&`攻+${ps.atk} `}{ps.def>0&&`防+${ps.def} `}{ps.guts>0&&`G+${ps.guts} `}{!(ps.hp>0||ps.atk>0||ps.def>0||ps.guts>0)&&'なし'}</div>
            </div>
            <div className="text-[10px] text-slate-400 font-bold text-center px-2">強化は上の「まとめて強化」で下書きし、確定すると保存されます。</div>
            <button type="button" onClick={backToDetail} className="mh-button mh-button-secondary w-full min-h-[48px] rounded-xl border border-white/10 bg-slate-800 text-slate-300 font-black text-[12px] active:scale-95 mt-2">完了</button>
          </div>
          {/* 確定は一覧の外に置く。中へ sticky で入れると、下の中身をスクロール中ずっと覆ってしまう */}
          {points>0&&(
            <div className={`${SCREEN_FOOTER_CLASS} w-full max-w-md mx-auto`} aria-label="強化の確定操作">
              <div className="flex items-center justify-between mb-2"><span className="text-[11px] font-black text-slate-300">残りpt</span><span className="font-mono font-black"><b className={planLeft>0?'text-amber-300':'text-slate-400'}>{planLeft}</b><small className="text-slate-400"> / {points} pt</small></span></div>
              <div className="flex gap-2"><button type="button" disabled={planUsed<=0} onClick={()=>setBulkPlan(null)} className="mh-button mh-button-secondary min-h-[52px] px-3 rounded-xl font-black text-[12px] bg-slate-800 text-slate-300 active:scale-95 disabled:opacity-30">配分をすべて取消</button><button type="button" disabled={planUsed<=0} onClick={applyPlan} className="mh-button mh-button-primary min-h-[52px] flex-1 rounded-xl font-black text-[13px] bg-gradient-to-r from-amber-600 to-orange-600 text-white active:scale-95 disabled:opacity-30 disabled:from-slate-700 disabled:to-slate-700">{planUsed>0?`${planUsed}ptを使って強化する`:'振り分けてください'}</button></div>
            </div>
          )}
        </div>
      );

}
