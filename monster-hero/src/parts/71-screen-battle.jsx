// ==== 画面: バトル ====
//
// MonsterHeroGame から切り出した20本目・最後の1本(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-13)。
// バトル画面そのもの(87千字)と、バトル中にだけ重なる演出4つ。
//
// 【この画面ならではの注意】
// ・A等級(docs/refactor/REGRESSION_RISK_MAP.md)。ランキングに影響しうるので、
//   **計算・保存・ターン進行はひとつも移していない**。ここにあるのは見せ方だけ
// ・オート進行・演出・ターンのタイマーはすべて MonsterHeroGame 側に残る。
//   画面へ移すと、画面のライフサイクルで途中の setTimeout が止まって進行不能になる
//   (この画面の中に残る setTimeout は、カードを置いたあと 0.5 秒で光を消す1つだけ)
// ・省エネ切替ボタンだけ、バトル画面の中でもういちど gameState==='BATTLE' を見ていた。
//   画面は gameState を知らない約束(ui/screen-parts-check)なので、
//   本体から battleScreenActive として渡している(綴りだけの違い)
function BattleScreen({
  applyTurnDamageReduction, attackAnim, autoBattle, autoBattleRef, autoRepeat, battleIntimidate,
  battleScenarioRef, battleScreenActive, battleSoulMasus, battleSpeed, battleTutorial,
  battleTutorialAllowsEmergency, battleTutorialCardAllowed, battleTutorialCardKind,
  battleTutorialCardTarget, battleTutorialNeed, battleTutorialNeedCard, battleTutorialSpotClass,
  battleTutorialStep, cardAssignments, cardDragActiveRef, cardEffectMultiplier, cardLimit,
  cardNeedsMonster, cycleActiveUniqueForSlot, cycleBattleAuto, cycleBattleSpeed, cycleEcoMode,
  debugBattle, difficulty, dismissQuickRhythmIntro, distTotalBonus, dragOverSlot, dragState,
  ecoBattleView, ecoMode, effectiveMaxGuts, effectiveMaxHp, enemy, enemyAttackAnim,
  enemyAttackFx, enemyDist, enemyIntent, enemyNextIntent, enemyRevivalUsed, enemySkillName,
  extremeDifficulty, extremeRun, extremeRunRef, focusedCard, getAttackPredictedDmg,
  getAvailableUniquesForSlot, getCardGuts, getDmg, getIncomingDamageBeforeTurnReduction,
  getMasuMon, getNextTurnBuff, getPermaBuff, getTurnBuff, getWaveBuff, guardCardWeight, guardFx,
  guardLevel, guardValueOf, guts, hand, heroCardBonus, heroDist, hp, iceLockActive,
  iceLockPreparing, iceLockTurns, isAssistCard, isAttackCard, isBusy, isHeroSlotMon,
  kikiCardBonus, liteBattleView, mainHero, openHelp, ownedUniques, pendingCard, pendingCardGuts,
  popups, previewLocalBoosts, processTurn, quickRhythmIntroVisible, quickToRhythmButtonNode,
  renderQuickRunBattleBand, runMode, safeDifficulty, score, selectedCardGuts, selectedCards,
  setCardAssignments, setDragState, setFocusedCard, setPendingCard, setShowAutoBgmPicker,
  setShowDeckInfo, setShowEnemyInfo, setShowHeroInfo, setShowQuitConfirm,
  setShowSoulBattleEffects, setSkillPicker, setSlotSettle, slotMaxUses, slotSettle, slotSkill,
  slotUniqueChoice, slots, soulBattleParty, soulCoordinationCardBonus, suppressCardClickRef,
  teachingFx, totalTurnCount, turnCount, ultimateDistanceBreakLevels, ultraBattleView,
  unifiedSpecialDefense, useEmergency, wave,
}) {
  return (

      <div className="flex-1 flex flex-col h-full relative" data-battle-speed={battleSpeed} data-eco-view={ultraBattleView?'ultra':liteBattleView?'lite':'off'}>
        {liteBattleView&&<div data-lite-eco-dimmer className="absolute inset-0 bg-black/20 pointer-events-none" style={{zIndex:89999}} aria-hidden="true"/>}
        <header data-battle-header className="h-[5%] min-h-[40px] shrink-0 bg-slate-900 px-1.5 flex items-center border-b border-white/5 z-[6500] overflow-hidden">
          <div className={`flex flex-1 min-w-0 items-center gap-0.5 overflow-hidden${battleTutorialSpotClass('waveInfo')}`}>{debugBattle&&<span className="text-[7px] font-black text-fuchsia-300 border border-fuchsia-500/40 rounded px-1 py-0.5 tracking-widest">DEBUG</span>}<span className={`text-[8px] font-black bg-opacity-10 px-1 py-0.5 rounded border tracking-tight whitespace-nowrap ${difficulty==='Hard'?'text-red-400 bg-red-500 border-red-500':'text-indigo-400 bg-indigo-500 border-indigo-500'}`}>WAVE {wave}/10</span>{/* 狭い幅ではモード名だけを縮め、ターン・スコアと右側の操作領域は動かさない */}<span className="min-w-0 overflow-hidden text-ellipsis text-[7px] font-black px-1 py-0.5 rounded border whitespace-nowrap" style={{color:battleModeInfo(runMode).color,borderColor:`${battleModeInfo(runMode).color}66`,backgroundColor:'rgba(0,0,0,.35)'}}>{extremeRun?`極限チャレンジ / ${extremeDifficulty}`:<>{battleModeInfo(runMode).short} / {QUICK_DIFFICULTY_SETTINGS[safeDifficulty]?.label||safeDifficulty}</>}</span></div>
          <div data-battle-metrics className="shrink-0 flex items-center gap-1 px-1 leading-none">
            <div data-battle-turn className="flex flex-col items-center justify-center whitespace-nowrap font-black text-blue-400"><span className="flex items-center gap-0.5 text-[7px] tracking-wide"><Timer size={7}/>TURN</span><span className="mt-0.5 text-[10px] font-mono">{turnCount}/20</span></div>
            {!isQuickMode(runMode)&&<div data-battle-score className="flex min-w-[64px] flex-col items-end justify-center whitespace-nowrap font-mono font-black text-amber-500"><span className="flex items-center gap-0.5 text-[7px] tracking-wide"><Award size={7}/>SCORE</span><span data-battle-score-value className="mt-0.5 text-[10px] tabular-nums">{score.toLocaleString()}</span></div>}
          </div>
          <div data-battle-controls className="flex shrink-0 items-center gap-0.5"><button type="button" disabled={!!battleTutorial||autoRepeat} onClick={cycleBattleSpeed} aria-label={battleTutorial?'バトルのれんしゅう中は1倍固定':autoRepeat?'∞周回中は4倍固定':`バトル速度、現在${battleSpeed}倍。タップで切り替え`} title={autoRepeat?'∞周回中は×4固定':undefined} className="shrink-0 min-w-[42px] h-[28px] px-1.5 rounded-lg border-2 font-black text-[11px] leading-none active:scale-90 disabled:cursor-not-allowed disabled:opacity-60" style={{color:'#fef3c7',borderColor:'#f59e0b',backgroundColor:'rgba(120,53,15,.72)',boxShadow:'0 0 9px rgba(245,158,11,.35)'}}>×{battleSpeed}{autoRepeat&&<span className="ml-0.5 text-[7px]">固定</span>}</button><button onClick={()=>openHelp()} aria-label="ヘルプ" className="shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-slate-800 rounded text-emerald-400 active:scale-90"><HelpCircle size={14}/></button><button data-battle-quit disabled={!!battleTutorial} onClick={()=>setShowQuitConfirm(true)} aria-label="諦める" className="shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-slate-800 rounded text-slate-400 active:scale-90 disabled:opacity-25"><Flag size={14}/></button></div>
        </header>
        {ultraBattleView?(
          <div data-ultra-battle-view className="flex-1 min-h-0 flex flex-col bg-slate-950 text-slate-100">
            <div className="flex-1 min-h-0 px-2 py-1.5 flex flex-col gap-1.5 overflow-hidden">
              {enemy&&(
                <section className="rounded-xl border border-red-900/70 bg-slate-900/95 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2 text-[10px] font-black"><span className="min-w-0 truncate text-red-200">{enemy.name}</span><span className="shrink-0 font-mono text-red-300">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-red-600" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`}}/></div>
                  <div className="mt-1 flex items-center justify-center gap-3">
                    <div className="h-[clamp(82px,16dvh,132px)] w-[clamp(82px,16dvh,132px)] flex items-center justify-center">{enemy.imgUrl?<img src={enemy.imgUrl} alt={enemy.name} className="w-full h-full object-contain"/>:<span style={{fontSize:'clamp(58px,11dvh,104px)',lineHeight:1}}>{enemy.emoji}</span>}</div>
                    <div className="text-center"><div className="text-[8px] font-black text-slate-400">現在距離</div><div className={`mt-1 rounded-full border px-3 py-1 text-[11px] font-black ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}距離</div></div>
                  </div>
                  <div data-ultra-enemy-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-red-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{enemySkillName&&<div className="truncate text-[11px] font-black text-red-200">{enemySkillName.label}</div>}{popups.filter(p=>p.side==='enemy').map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
                </section>
              )}
              <section className="rounded-xl border border-indigo-900/70 bg-slate-900/95 px-2 py-1.5">
                <div data-ultra-ally-slots className="grid grid-cols-4 gap-1">{slots.map((s,i)=><div key={i} className={`flex h-[42px] min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 py-1 text-center ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border}`}><div className="w-full truncate text-[9px] font-black text-white">{s?.name||'---'}</div><div className="mt-1 text-[8px] font-black">{RANGE_LABELS[i]}距離</div></div>)}</div>
                <div className="mt-1.5 space-y-1">
                  <div><div className="flex justify-between text-[8px] font-black text-pink-300"><span>味方HP</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-pink-500" style={{width:`${(hp/effectiveMaxHp)*100}%`}}/></div></div>
                  <div><div className="flex justify-between text-[8px] font-black text-amber-300"><span>ガッツ</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{width:`${(guts/effectiveMaxGuts)*100}%`}}/></div></div>
                </div>
                <div data-ultra-ally-log className="mt-1 h-[42px] overflow-hidden rounded-lg border border-indigo-800/60 bg-black/50 px-2 py-1 text-center leading-tight">{slotSkill&&<div className="truncate text-[11px] font-black text-indigo-200">{slotSkill.name}</div>}{popups.filter(p=>['hero','life','guts'].includes(p.side)).map(p=><div key={p.id} className={`${p.color} truncate text-sm font-black`}>{p.text}</div>)}</div>
              </section>
              {/* 空いたところへ周回の積み上がりを出す(2026-09-07・ユーザー指示)。
                  ★中身は描くときに組み立てる(関数で呼ぶ)。上のほうで const にすると、
                    見込み報酬の計算がまだ定義されておらず ∞ にした瞬間に画面が落ちる */}
              {renderQuickRunBattleBand()}
            </div>
            <div className="shrink-0 border-t border-white/10 bg-slate-900 p-1">
              <div className="flex items-center justify-between gap-1 px-1">
                <div className="min-w-0 flex-1"><div className="text-[8px] font-black uppercase tracking-wider text-indigo-300">Action Cards</div><div className="truncate text-[9px] font-bold text-slate-300">AUTO∞で進行中</div></div>
                <button onClick={()=>setShowDeckInfo(true)} className="flex min-h-[32px] items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 px-2 text-[7px] font-black"><Layers size={9}/>VIEW</button>
                {/* 超省エネでも🎵の縦列は通常のバトル画面と同じ並びにする */}
                <div className="shrink-0 flex flex-col gap-0.5">
                  <button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="バトルBGMと音量を調整" title="BGM / 音量" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[7px] font-black leading-none">BGM</span></button>
                  {quickToRhythmButtonNode}
                </div>
                <div className="w-[44px] shrink-0 flex flex-col gap-0.5"><button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className="h-8 w-full rounded-lg border-2 border-fuchsia-300 bg-fuchsia-500 text-[8px] font-black leading-tight text-slate-950"><span className="block">AUTO</span><span className="block text-[7px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button><button type="button" onClick={cycleEcoMode} aria-label="省エネ 超" className="min-h-[24px] w-full rounded-md border border-lime-200 bg-lime-500 text-[7px] font-black leading-[9px] text-slate-950"><span className="block">省エネ</span><span className="block">超</span></button></div>
                <button disabled className="min-h-[44px] min-w-[84px] shrink-0 rounded-full border-2 border-black bg-slate-700 px-2 text-[11px] font-black uppercase text-slate-400 opacity-50"><Play fill="currentColor" size={12} className="inline mr-1"/>Action</button>
              </div>
            </div>
          </div>
        ):(<>
        {/* 累計ターンで動く倍率だけをここへ出す。静的なルールの全文は「ルール詳細」で読む。
            ULTIMATEとINFINITYのように同じ系統のルールを持つ難易度は、同じ表示を共有する */}
        {(()=>{
          const statusRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);
          const hasEnemyRate=extremeRuleNumber(statusRule,'enemyTurnRate')!=null;
          const hasDamageRate=extremeRuleNumber(statusRule,'damageTurnRate')!=null;
          if(!hasEnemyRate&&!hasDamageRate)return null;
          const elapsedTotalTurns=totalTurnCount+Math.max(0,turnCount-1);
          const enemyMultiplier=ultimateEnemyTurnMultiplier(totalTurnCount,statusRule);
          const damageMultiplier=extremeDamageTurnMultiplier(elapsedTotalTurns,statusRule,wave);
          const hasJoinRate=extremeRuleNumber(statusRule,'allyJoinPenaltyRate')!=null;
          // 段階(神威・黄昏)と不死の残り回数は難易度名で分岐せず、持っている難易度だけに出す
          const stageLabel=extremeWaveStageLabel(statusRule);
          const stagedEnemyMultiplier=extremeWaveEnemyMultiplier(statusRule,wave);
          const revivalTotal=extremeRevivalCount(statusRule,wave);
          return <div data-ultimate-battle-status={statusRule} className="shrink-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[8px] font-black leading-none text-purple-100">
            <span className="text-amber-300">{statusRule}{stageLabel?` ${stageLabel} Lv.${extremeWaveStageLevel(wave)}`:''}</span>{revivalTotal>0&&<span className="text-slate-200">不死 残り{Math.max(0,revivalTotal-enemyRevivalUsed)}回</span>}{hasEnemyRate&&<span>敵強化 +{compactPercent(enemyMultiplier*stagedEnemyMultiplier-1)}（WAVE開始時 累計{totalTurnCount}T）</span>}{hasDamageRate&&<span>与ダメ {compactPercent(damageMultiplier)}（現在 累計{elapsedTotalTurns}T）</span>}{hasJoinRate&&<span>加入B {compactPercent(ultimateAllyJoinMultiplier(elapsedTotalTurns,statusRule))}（現在）</span>}{extremeDistanceBreakRule(statusRule)&&<span>BREAK {ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]}Lv${level}`:null).filter(Boolean).join(' / ')||'未発生'}</span>}
          </div>;
        })()}
        {(()=>{const rule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);return [NIGHTMARE_SETTING.id,CHAOS_SETTING.id].includes(rule)&&<div data-extreme-battle-status={rule} className="shrink-0 grid grid-cols-4 items-center gap-1 border-b border-fuchsia-500/30 bg-purple-950/80 px-2 py-1 text-[9px] font-black leading-none text-purple-100"><span className="text-amber-300">{rule}</span>{extremeSpecialRuleLines(rule).map(([label,value])=><span key={label} className="text-center whitespace-nowrap">{label} {value}</span>)}</div>;})()}
        {enemy&&(
          <div className={`shrink-0 bg-slate-950/95 border-b border-red-900/40 px-4 py-1.5 z-[6400] shadow-[0_4px_12px_rgba(0,0,0,0.6)]${battleTutorialSpotClass('enemyBar')}`}>
            <div className="flex justify-between items-center text-[10px] font-black italic uppercase tracking-tighter mb-1">
              <span className={`flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 leading-none ${wave===10?'text-red-500 animate-pulse':'text-slate-200'}`}><Skull size={11} className="shrink-0"/><span className="max-w-[34vw] truncate">{enemy.name}</span><span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[8px] text-white font-bold border ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border}`}>{RANGE_LABELS[enemyDist]}</span>{iceLockTurns>0&&<span data-ice-lock-status className="shrink-0 px-1 py-0.5 rounded-full border border-cyan-400/60 bg-cyan-950/80 text-[7px] not-italic tracking-tighter whitespace-nowrap text-cyan-100">❄️絶氷 {iceLockPreparing?'準備':<>{iceLockTurns}T　⬇30%</>}</span>}</span>
              <span className="text-red-500 flex items-center gap-1 font-mono drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">{Math.max(0,enemy.hp).toLocaleString()} / {enemy.maxHp.toLocaleString()}</span>
            </div>
            <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/20 relative shadow-inner">
              <div className="h-full bg-gradient-to-r from-red-700 via-red-500 to-orange-400 transition-all duration-1000" style={{width:`${(Math.max(0,enemy.hp)/enemy.maxHp)*100}%`,backgroundImage:'linear-gradient(to right, #b91c1c, #ef4444, #fb923c)'}}></div>
            </div>
          </div>
        )}
        <main className="flex-1 relative flex flex-col items-center justify-between pt-3 pb-1 px-2 overflow-x-visible overflow-y-auto min-h-0">
          {/* 移動の吹き出し(画面の上から22%)と重なるため、左の「緊急」と同じ高さまで下げている */}
          <button onClick={()=>setShowEnemyInfo(true)} className="absolute right-2 top-24 flex flex-col items-center justify-center p-2 rounded-2xl border border-red-500 bg-red-950/30 active:scale-90 z-20 shadow-lg"><Search className="text-red-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">解析</span></button>
          <button onClick={()=>setShowHeroInfo(true)} className={`absolute left-2 top-10 flex flex-col items-center justify-center p-2 rounded-2xl border border-indigo-500 bg-indigo-950/30 active:scale-90 z-20 shadow-lg${battleTutorialSpotClass('heroStatus')}`}><Crown className="text-indigo-400 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">ステータス</span></button>
          {battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&<button data-soul-battle-effects-button type="button" onClick={()=>setShowSoulBattleEffects(true)} className="absolute right-2 top-10 min-h-[44px] min-w-[52px] flex flex-col items-center justify-center px-2 py-1 rounded-2xl border border-sky-400 bg-sky-950/60 active:scale-90 z-20 shadow-lg"><Sparkles className="text-sky-300 mb-0.5" size={14}/><span className="text-[7px] font-black text-white">魂格効果</span></button>}
          {turnCount===1&&battleSoulMasus.some(m=>normalizeSoulRankStage(m.soulRankStage)>0)&&!isBusy&&<div data-soul-battle-start-summary className="absolute left-1/2 top-2 -translate-x-1/2 z-10 max-w-[62%] truncate rounded-full border border-sky-400/30 bg-sky-950/75 px-2 py-1 text-[7px] font-black text-sky-100 pointer-events-none">魂格効果 発動中{Math.round(soulBattleParty.damageReduction*10)/10>0?` ・鉄壁${(Math.round(soulBattleParty.damageReduction*10)/10)}%`:''}{unifiedSpecialDefense.rate>0?` ・特殊防御${(Math.round(unifiedSpecialDefense.rate*10)/10)}%`:''}{battleIntimidate>0?` ・威圧${(Math.round(battleIntimidate*10)/10)}%`:''}{soulCoordinationCardBonus>0?' ・カード+1':''}</div>}
          <button onClick={useEmergency} disabled={isBusy||autoBattle||!battleTutorialAllowsEmergency} className={`absolute left-2 top-24 flex flex-col items-center justify-center p-2 rounded-2xl border border-blue-500 bg-blue-900/30 active:scale-90 disabled:opacity-20 z-20 shadow-lg${battleTutorialSpotClass('emergency')}`}><Activity className="text-blue-400 mb-0.5" size={16}/><span className="text-[7px] font-black text-white">緊急</span></button>
          <div className="mt-1 relative flex flex-col items-center">
            {enemySkillName&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{top:'14%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className="px-4 py-1.5 rounded-xl font-black text-[13px] bg-red-700 border-2 border-red-200 text-white shadow-[0_2px_16px_rgba(0,0,0,0.9)] flex items-center gap-2"><span>{cardIconNode(enemySkillName.icon,16)}</span>{enemySkillName.label}</div>
              </div>
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='SPECIAL'&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 500ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(217,70,239,1)]">☠️</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-purple-900 via-fuchsia-700 to-purple-900 border-2 border-fuchsia-300 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(217,70,239,0.9)]">必 殺 技</div>
              </div>
            )}
            {enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='CHARGE'&&(
              <div className="fixed left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-1" style={{top:'11%',zIndex:65000,animation:'specialWarnFlash 700ms ease-in-out infinite'}}>
                <div className="text-5xl drop-shadow-[0_0_20px_rgba(251,191,36,1)]">✨</div>
                <div className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-900 via-amber-600 to-amber-900 border-2 border-amber-200 text-sm font-black text-white tracking-[0.2em] shadow-[0_0_20px_rgba(251,191,36,0.9)]">た め る</div>
              </div>
            )}
            {/* 移動の予告。いま出ている行動予告(通常攻撃など)と同時に、
                「その次のターンに間合いを変える」ことを敵のつぶやきとして見せる。
                出す間合いは enemyNextIntent.targetDist そのもので、繰り上げても抽選し直さないため、
                吹き出しに出た間合いへ必ず動く。
                【置き場所】丸枠(敵の円)の中には置かないこと。丸枠は transform を持つため
                独自の重ね順の島になり、いくらz-indexを上げても、枠の外へ巨大に描くムーの
                裏へ回ってしまう。必殺技の警告と同じこの階層に置くと前面に出る */}
            {enemy&&enemyNextIntent&&!isBusy&&!enemyAttackFx&&enemyNextIntent.type==='MOVE'&&(
              // 画面ではなく遊ぶ列(最大600px)の右端に寄せる。left:50%から
              // 「列の半分ぶん右へ、自分の幅だけ左へ」動かすと、広い画面でも列の中に収まる
              <div className="fixed left-1/2 pointer-events-none" style={{top:'22%',transform:'translateX(calc(min(50vw, 300px) - 100% - 8px))',zIndex:65000}}>
                <div className="mh-enemy-move-hint">
                  <span aria-hidden="true">🏃</span>
                  <span>{RANGE_LABELS[enemyNextIntent.targetDist]}距離に移動しようとしている…？</span>
                </div>
              </div>
            )}
            {slotSkill&&(
              <div className="fixed -translate-x-1/2 pointer-events-none whitespace-nowrap" style={{left:`${12.5+slotSkill.slotIndex*25}%`,bottom:'30%',zIndex:65000,animation:liteBattleView?undefined:'skillNamePop 350ms ease-out forwards'}}>
                <div className={`px-3 py-1 rounded-xl font-black text-[12px] border-2 shadow-[0_2px_16px_rgba(0,0,0,0.9)] ${slotSkill.type==='unique'?'bg-purple-700 border-purple-200 text-white drop-shadow-[0_0_10px_rgba(217,70,239,0.9)]':slotSkill.type==='special'?'bg-amber-600 border-amber-200 text-white':'bg-red-700 border-red-200 text-white'}`}>{slotSkill.name}</div>
              </div>
            )}
            {!ecoBattleView&&guardFx&&(
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:64000}}>
                <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                  <div className="text-[120px] drop-shadow-[0_0_30px_rgba(56,189,248,1)]">🛡️</div>
                </div>
                {[0,1,2,3,4,5].map(k=>(
                  <div key={k} className="absolute" style={{transform:`rotate(${k*60}deg)`}}>
                    <div className="rounded-full border-4 border-cyan-200" style={{width:'36px',height:'36px',animation:`guardSpark 500ms ease-out ${k*25}ms forwards`}}></div>
                  </div>
                ))}
                <div className="absolute font-black text-cyan-100 text-4xl tracking-widest drop-shadow-[0_0_16px_rgba(56,189,248,1)]" style={{top:'34%',animation:'guardShine 550ms ease-out forwards'}}>キーン!</div>
                <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.5) 0%, rgba(56,189,248,0.3) 20%, rgba(0,0,0,0) 45%)',animation:'guardFlash 350ms ease-out forwards'}}></div>
              </div>
            )}
            {!ecoBattleView&&teachingFx&&TEACHING_FX_STYLE[teachingFx.id]&&(()=>{
              const fx=TEACHING_FX_STYLE[teachingFx.id];
              return (
                <div key={teachingFx.fxId} className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{zIndex:63000}}>
                  <div className="absolute" style={{animation:'guardShine 550ms ease-out forwards'}}>
                    <div className="text-[110px] drop-shadow-[0_0_30px_rgba(255,255,255,0.9)]">{cardIconNode(fx.icon,110)}</div>
                  </div>
                  {[0,1,2,3,4,5,6,7].map(k=>(
                    <div key={k} className="absolute" style={{transform:`rotate(${k*45}deg)`}}>
                      <div className={`rounded-full border-4 ${fx.ring}`} style={{width:'30px',height:'30px',animation:`guardSpark 550ms ease-out ${k*20}ms forwards`}}></div>
                    </div>
                  ))}
                  <div className={`absolute font-black text-3xl tracking-widest drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${fx.text}`} style={{top:'32%',animation:'guardShine 550ms ease-out forwards'}}>{fx.label}</div>
                  <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 45%, rgba(${fx.rgb},0.5) 0%, rgba(${fx.rgb},0.25) 22%, rgba(0,0,0,0) 48%)`,animation:'guardFlash 400ms ease-out forwards'}}></div>
                </div>
              );
            })()}
            {enemy?.id==='Moo'&&enemy?.imgUrl&&(
              <div className="fixed left-1/2 pointer-events-none flex items-center justify-center" style={{top:'30%',transform:'translate(-50%,-50%)',zIndex:focusedCard?5:30,width:'min(108vw,560px)',height:'min(108vw,560px)'}}>
                <img src={enemy.imgUrl} alt="ムー" style={{width:'100%',height:'100%',animation:liteBattleView?undefined:(enemyAttackAnim?(enemyAttackFx?.kind==='move'?'mooMoveSlide 1000ms ease-in-out forwards':enemyAttackFx?.kind==='charge'?'mooChargeGather 1100ms ease-in-out forwards':'mooAttackLunge 900ms ease-in-out forwards'):'mooFloat 3000ms ease-in-out infinite'),imageRendering:'auto',WebkitMaskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)',maskImage:'radial-gradient(circle at 50% 42%, #000 60%, transparent 92%)'}} className={`relative z-[1] object-contain drop-shadow-[0_0_55px_rgba(168,85,247,0.95)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/>
              </div>
            )}
            {/* ムー攻撃時: 全画面の破壊的演出 */}
            {!ecoBattleView&&enemy?.id==='Moo'&&enemyAttackFx?.kind==='moo'&&(
              <div className="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden" style={{zIndex:25}}>
                <div className="absolute inset-0" style={{background:'radial-gradient(circle at 50% 34%, rgba(168,85,247,0.55) 0%, rgba(239,68,68,0.4) 30%, rgba(251,191,36,0.25) 48%, rgba(0,0,0,0) 70%)', animation:'auraPulse 450ms ease-out infinite'}}></div>
                <div className="absolute inset-0" style={{animation:'specialFlash 400ms ease-out infinite', background:'radial-gradient(circle at 50% 34%, rgba(255,255,255,0.45) 0%, rgba(168,85,247,0.15) 35%, rgba(255,255,255,0) 60%)'}}></div>
                <div className="absolute" style={{top:'34%',left:'50%',transform:'translate(-50%,-50%)',width:'min(120vw,640px)',height:'min(120vw,640px)'}}>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute left-1/2 top-1/2 text-5xl" style={{transform:`translate(-50%,-50%) rotate(${deg}deg) translateY(-42vw)`, animation:'sparkFlicker 240ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-purple-300/80" style={{animation:'auraRing 500ms ease-out infinite'}}></div>
                  <div className="absolute inset-0 rounded-full border-4 border-red-500/60" style={{animation:'auraRing 650ms ease-out 120ms infinite'}}></div>
                </div>
              </div>
            )}
            {/* 行動予測ラベルはmain下部に移動 */}
            <div className={`rounded-full transition-all duration-500 border-4 relative ${RANGE_STYLES[enemyDist].bg} ${RANGE_STYLES[enemyDist].border} ${RANGE_STYLES[enemyDist].shadow} ${RANGE_STYLES[enemyDist].glow} shadow-[0_0_50px]`} style={enemyAttackAnim&&!ecoBattleView?{padding:'clamp(8px,2.2dvh,28px)',animation:(enemyAttackFx?.kind==='move'?(enemy?.id==='Moo'?'enemyMoveSlideMoo 1000ms ease-in-out forwards':'enemyMoveSlide 1000ms ease-in-out forwards'):enemyAttackFx?.kind==='charge'?'enemyChargeShake 1100ms ease-in-out forwards':'enemyAttackFly 450ms ease-in forwards'), ...(enemy?.id==='Moo'&&enemyAttackFx?.kind!=='move'?{transform:'translateY(3dvh)'}:{}),...(enemy?.id!=='Moo'&&enemyAttackFx?.kind!=='move'?{zIndex:9999}:{})}:{padding:'clamp(8px,2.2dvh,28px)',...(enemy?.id==='Moo'?{transform:'translateY(3dvh)'}:{})}}>
              {enemy?.imgUrl?(enemy?.id==='Moo'?<div style={{width:'clamp(70px,12dvh,120px)',height:'clamp(80px,16dvh,150px)'}}/>:<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''} style={{width:'clamp(70px,12dvh,120px)',height:'clamp(80px,16dvh,150px)'}}><img src={enemy.imgUrl} alt={enemy?.name} className={`relative z-[1] w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}/></span>):(<span className={extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?'mh-nightmare-enemy-aura-shell':'mh-extreme-enemy-aura-shell'):''}><div style={{fontSize:'clamp(58px,11dvh,104px)',lineHeight:1}} className={`relative z-[1] drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]${extremeRun?(extremeDifficulty===NIGHTMARE_SETTING.id?' mh-nightmare-enemy-image':' mh-extreme-enemy-image'):''}`}>{enemy?.emoji}</div></span>)}
              {/* ラスボス・ムー: 丸枠内は台座オーラのみ（本体は枠外に巨大表示） */}
              {!ecoBattleView&&enemy?.id==='Moo'&&(
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible" style={{zIndex:1}}>
                  <div className="absolute -inset-8 rounded-full" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(139,0,139,0.32) 45%, rgba(0,0,0,0) 72%)', animation:'auraPulse 1500ms ease-in-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-2 border-purple-500/60" style={{animation:'idleAuraPulse 1700ms ease-in-out infinite'}}></div>
                </div>
              )}
              {/* Move: dash effect with motion marks */}
              {!ecoBattleView&&enemyAttackFx?.kind==='move'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-2 rounded-full border-4 border-cyan-300/80" style={{animation:'shockRing 600ms ease-out forwards'}}></div>
                  <div className="absolute -inset-5 rounded-full border-2 border-sky-400/50" style={{animation:'shockRing 600ms ease-out 100ms forwards'}}></div>
                  <div className="absolute text-5xl drop-shadow-[0_0_14px_rgba(34,211,238,1)]" style={{animation:'moveDash 700ms ease-in-out forwards'}}>💨</div>
                  <div className="absolute -top-3 text-4xl font-black text-cyan-200 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 600ms cubic-bezier(.2,1.4,.4,1) forwards'}}>🏃</div>
                </div>
              )}
              {/* Normal attack: surprised exclamation burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='normal'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center" style={{animation:'enemyExclaim 500ms ease-out forwards'}}>
                  <div className="absolute -top-3 -right-2 text-5xl font-black text-yellow-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" style={{animation:'exclaimPop 500ms cubic-bezier(.2,1.4,.4,1) forwards'}}>❗</div>
                  <div className="absolute inset-0 rounded-full border-4 border-yellow-300/80" style={{animation:'shockRing 500ms ease-out forwards'}}></div>
                </div>
              )}
              {/* Special attack: crackling aura + lightning burst */}
              {!ecoBattleView&&enemyAttackFx?.kind==='special'&&(
                <div className="absolute inset-0 pointer-events-none z-[10000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(239,68,68,0.45) 40%, rgba(168,85,247,0.25) 60%, rgba(0,0,0,0) 75%)', animation:'auraPulse 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-3 rounded-full border-4 border-amber-300" style={{animation:'auraRing 600ms ease-out infinite'}}></div>
                  <div className="absolute -inset-8 rounded-full border-2 border-red-500/70" style={{animation:'auraRing 700ms ease-out 120ms infinite'}}></div>
                  <div className="absolute -inset-12 rounded-full border-2 border-purple-500/50" style={{animation:'auraRing 800ms ease-out 240ms infinite'}}></div>
                  {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                    <div key={deg} className="absolute text-3xl" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'sparkFlicker 300ms ease-in-out infinite', animationDelay:`${deg}ms`}}>⚡</div>
                  ))}
                  <div className="absolute text-7xl drop-shadow-[0_0_24px_rgba(251,191,36,1)]" style={{animation:'specialThrob 500ms ease-in-out infinite'}}>🔥</div>
                  <div className="absolute inset-0 rounded-full" style={{animation:'specialFlash 600ms ease-out infinite', background:'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 60%)'}}></div>
                </div>
              )}
              {/* MOO (last boss): catastrophic aura + lightning storm */}
              {/* IDLE telegraph (player's turn): show what the enemy is about to do. Hidden while an attack is actually firing. */}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&enemyIntent.type==='ATTACK'&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center">
                  <div className="absolute -top-2 -right-1 text-4xl font-black text-yellow-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]" style={{animation:'idleExclaim 1100ms ease-in-out infinite'}}>❗</div>
                </div>
              )}
              {/* ためている最中は、敵の周りにオーラが集まる */}
              {!ecoBattleView&&enemy&&enemyAttackFx?.kind==='charge'&&(
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  <div className="absolute -inset-6 rounded-full" style={{background:'radial-gradient(circle, rgba(251,191,36,0.45) 0%, rgba(251,191,36,0.2) 45%, rgba(0,0,0,0) 70%)', animation:'auraPulse 700ms ease-out infinite'}}></div>
                  {[0,1,2,3,4,5,6,7].map(k=>(
                    <div key={k} className="absolute text-2xl" style={{'--deg':`${k*45}deg`, animation:`chargeGather 900ms ease-in ${k*70}ms infinite`}}>✨</div>
                  ))}
                  <div className="absolute inset-0 rounded-full border-4 border-amber-300/80" style={{animation:'auraRing 700ms ease-out infinite'}}></div>
                </div>
              )}
              {!ecoBattleView&&enemy&&enemyIntent&&!isBusy&&!enemyAttackFx&&(enemyIntent.type==='SPECIAL'||(enemy?.id==='Moo'&&enemyIntent.type==='ATTACK'))&&(()=>{
                // ためる(CHARGE)の予告にはこのオーラを出さない。必殺技の予告と同じ見た目になり、
                // 「準備なのか、いま撃たれるのか」が見分けられなくなるため
                const isSpecial = enemyIntent.type==='SPECIAL';
                // 通常技 = 赤系 / 必殺技(チャージ) = 紫＋金系 で明確に色分け
                return (
                <div className="absolute inset-0 pointer-events-none z-[9000] flex items-center justify-center overflow-visible">
                  {isSpecial ? (
                    <>
                      {/* 全画面の危険ビネット(画面端が赤紫に脈動) */}
                      <div className="fixed inset-0 pointer-events-none" style={{position:'fixed',inset:0,zIndex:85000,background:'radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(168,85,247,0.25) 72%, rgba(127,29,29,0.55) 100%)', animation:'specialDangerPulse 700ms ease-in-out infinite'}}></div>
                      {/* 拡大する衝撃波リング(複数) */}
                      <div className="absolute -inset-8 rounded-full border-4 border-fuchsia-400/80" style={{animation:'specialShockwave 1400ms ease-out infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-purple-300/70" style={{animation:'specialShockwave 1400ms ease-out 466ms infinite'}}></div>
                      <div className="absolute -inset-8 rounded-full border-4 border-amber-300/60" style={{animation:'specialShockwave 1400ms ease-out 933ms infinite'}}></div>
                      {/* 内側の脈動オーラ */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(217,70,239,0.6) 0%, rgba(168,85,247,0.45) 38%, rgba(251,191,36,0.3) 62%, rgba(0,0,0,0) 82%)', animation:'specialWarnFlash 600ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-3 rounded-full border-[3px] border-fuchsia-300" style={{animation:'specialWarnFlash 600ms ease-in-out infinite', boxShadow:'0 0 30px rgba(217,70,239,0.9), inset 0 0 30px rgba(217,70,239,0.7)'}}></div>
                      {/* 回転する危険スパーク */}
                      {[0,30,60,90,120,150,180,210,240,270,300,330].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_12px_rgba(217,70,239,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-100px, -13dvh, -64px))`, animation:'idleSpark 600ms ease-in-out infinite', animationDelay:`${deg*1.5}ms`}}>⚡</div>
                      ))}
                      {/* 必殺技バナーは敵コンテナ直下(fixed)に移動済み */}
                    </>
                  ) : (
                    <>
                      {/* 通常技: 赤系のシンプルな警告 */}
                      <div className="absolute -inset-10 rounded-full" style={{background:'radial-gradient(circle, rgba(239,68,68,0.45) 0%, rgba(220,38,38,0.32) 42%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-4 rounded-full border-2 border-red-500/90" style={{animation:'idleAuraPulse 1100ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-7 rounded-full border-2 border-orange-500/60" style={{animation:'idleAuraPulse 1300ms ease-in-out 120ms infinite'}}></div>
                      {[0,45,90,135,180,225,270,315].map(deg=>(
                        <div key={deg} className="absolute text-2xl drop-shadow-[0_0_8px_rgba(239,68,68,1)]" style={{transform:`rotate(${deg}deg) translateY(clamp(-96px, -12dvh, -60px))`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                      <div className="absolute -top-3 text-3xl drop-shadow-[0_0_12px_rgba(239,68,68,1)]" style={{animation:'idleExclaim 900ms ease-in-out infinite'}}>❗</div>
                    </>
                  )}
                </div>
                );
              })()}
            </div>
            {getTurnBuff('stunEnemy',false)&&<div className="absolute inset-0 flex items-center justify-center text-3xl bg-indigo-500/20 rounded-full border-4 border-indigo-500 animate-pulse">💫</div>}
            {(() => {
    const enemyPopups=popups.filter(p=>p.side==='enemy');
    const wrapEnemyPopups=!liteBattleView&&enemyPopups.length>4;
    const popupColumns=wrapEnemyPopups?Math.ceil(enemyPopups.length/4):1;
    const popupGridStyle=wrapEnemyPopups?{
      display:'grid',
      gridAutoFlow:'column',
      gridTemplateRows:'repeat(4, auto)',
      gridAutoColumns:'max-content',
      justifyContent:'center',
      alignContent:'start',
      columnGap:popupColumns>=3?'0px':'4px',
      rowGap:'2px',
      paddingTop:'4px'
    }:undefined;
    const compactPopupStyle=wrapEnemyPopups?{
      fontSize:popupColumns>=3?'clamp(1.4rem, 5.8vw, 1.85rem)':'clamp(1.75rem, 7.5vw, 2.25rem)',
      lineHeight:1.05,
      paddingLeft:'2px',
      paddingRight:'2px'
    }:undefined;
    return (
      <div className={`absolute inset-0 z-50 pointer-events-none ${wrapEnemyPopups?'':'flex flex-col items-center justify-start pt-1 gap-0.5'}`} style={popupGridStyle}>
        {enemyPopups.map(p=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} style={compactPopupStyle} className={`text-center ${p.color} font-black whitespace-nowrap px-4 ${liteBattleView?'rounded-lg border border-white/20 bg-slate-950/95 py-1 text-base':'drop-shadow-[0_0_15px_rgba(0,0,0,1)]'}`}>{p.text}</div>))}
      </div>
    );
  })()}
          </div>
          <div className="w-full max-w-[180px] mt-2 mb-1 shrink-0 relative z-[40]">
            <div className="h-2"></div>
          </div>
          {/* 技詳細パネルはmain外(画面直下)に移動して、ムー画像と同階層でz-index勝負させる */}
          {enemy&&enemyIntent&&!isBusy&&(()=>{
            // ためる・待機・移動はダメージが無いので「予測」を出さない。
            // 出すと必ず0になり、ガードを構える判断の邪魔になる
            const rawDmg=getIncomingDamageBeforeTurnReduction(enemyIntent);
            let previewGuardFlat=0, previewGuardMult=0, previewPenaltyCnt=0;
            selectedCards.forEach(idx=>{
              const card=hand[idx];
              const isPenalty=!isAssistCard(card);
              const halved=isPenalty&&previewPenaltyCnt>0;
              const weight=guardCardWeight(card);
              if(weight>0){const effect=cardEffectMultiplier(card,halved); previewGuardFlat+=GUARD_EVOLUTION[guardLevel].flat*weight*effect; previewGuardMult+=GUARD_EVOLUTION[guardLevel].mult*weight*effect;}
              if(isPenalty) previewPenaltyCnt++;
            });
            const plannedDmg=applyTurnDamageReduction(Math.max(0,rawDmg-guardValueOf(previewGuardFlat,previewGuardMult)));
            const tone=enemyIntent.type==='SPECIAL'?'bg-fuchsia-950 border-fuchsia-500 text-fuchsia-300'
              :enemyIntent.type==='CHARGE'?'bg-amber-950 border-amber-500 text-amber-400'
              :enemyIntent.type==='MOVE'?'bg-cyan-950 border-cyan-500/60 text-cyan-300'
              :'bg-red-950 border-red-600/50 text-red-400';
            return <div className={`mt-auto mb-1 border p-1 px-4 rounded-full flex items-center gap-1.5 animate-pulse z-[45] shadow-lg shrink-0${battleTutorialSpotClass('enemyIntent')} ${focusedCard?'invisible':'visible'} ${tone}`}><Target size={12}/><div className="text-[9px] font-black uppercase tracking-tight">{enemyIntent.label}{rawDmg>0?` (予定: ${plannedDmg})`:''}</div></div>;
          })()}
          <div className={`flex flex-wrap justify-center gap-1 max-w-[340px] mt-auto mb-1 shrink-0 relative z-[40] ${focusedCard?'invisible':'visible'}`}>
            {/* === 永続バフ（常時表示・数値が増減） === */}
            <div className="text-[7px] font-black text-red-500 bg-black/60 px-2 py-0.5 rounded border border-red-500/50 flex items-center gap-1 shadow-lg uppercase"><Sword size={7}/> ATK +{Math.floor((getPermaBuff('atkPct')+getPermaBuff('muaAtkPct'))*100)}%</div>
            <div className="text-[7px] font-black text-emerald-500 bg-black/60 px-2 py-0.5 rounded border border-emerald-500/50 flex items-center gap-1 shadow-lg uppercase"><Shield size={7}/> 被ダメ -{Math.floor(getPermaBuff('dmgCutPct')*100)}%</div>
            <div className="text-[7px] font-black text-emerald-500 bg-black/60 px-2 py-0.5 rounded border border-emerald-500/50 flex items-center gap-1 shadow-lg uppercase"><Shield size={7}/> DEF +{Math.floor(getPermaBuff('defPct')*100)}%</div>
            <div className="text-[7px] font-black text-pink-500 bg-black/60 px-2 py-0.5 rounded border border-pink-500/50 flex items-center gap-1 shadow-lg uppercase"><Heart size={7}/> ライフ +{Math.floor(getPermaBuff('muaHpPct')*100)}%</div>
            <div className="text-[7px] font-black text-amber-500 bg-black/60 px-2 py-0.5 rounded border border-amber-500/50 flex items-center gap-1 shadow-lg uppercase"><Zap size={7}/> ガッツ +{Math.floor(getPermaBuff('muaGutsPct')*100)}%</div>
            <div className="text-[7px] font-black text-yellow-400 bg-black/60 px-2 py-0.5 rounded border border-yellow-400/50 flex items-center gap-1 shadow-lg uppercase"><Sparkles size={7}/> クリ率 +{Math.round(getPermaBuff('critRatePct')*100)}%</div>
            <div className="text-[7px] font-black text-yellow-400 bg-black/60 px-2 py-0.5 rounded border border-yellow-400/50 flex items-center gap-1 shadow-lg uppercase"><Sparkles size={7}/> クリダメ +{Math.round(getPermaBuff('critDmgPct')*100)}%</div>
            <div className="text-[7px] font-black text-cyan-400 bg-black/60 px-2 py-0.5 rounded border border-cyan-400/50 flex items-center gap-1 shadow-lg uppercase"><Sword size={7}/> 連撃 +{Math.round(getPermaBuff('comboDmgPct')*100)}%</div>
            {getPermaBuff('globalComboDmgPct')>0&&<div className="text-[7px] font-black text-sky-300 bg-black/60 px-2 py-0.5 rounded border border-sky-300/50 flex items-center gap-1 shadow-lg"><Sword size={7}/> 全体連撃 +{Math.round(getPermaBuff('globalComboDmgPct')*100)}%</div>}
            {kikiCardBonus>0&&<div className="text-[7px] font-black text-violet-300 bg-black/60 px-2 py-0.5 rounded border border-violet-300/50 flex items-center gap-1 shadow-lg"><PlusCircle size={7}/> カード上限 +1（残り{Math.ceil(getPermaBuff('kikiCardBonusTurns'))}T）</div>}
            {/* ソードスキル(剣士モッチー)。既存の永続バフ表示と同じ帯へ並べる。
                連撃パワーは3たまるごとに永久追加連撃へ変わるので、両方が見えないと進み具合が分からない */}
            {(getPermaBuff('kenshiComboPower')>0||getPermaBuff('kenshiExtraCombo')>0)&&<div className="text-[7px] font-black text-violet-300 bg-black/60 px-2 py-0.5 rounded border border-violet-300/50 flex items-center gap-1 shadow-lg"><Sword size={7}/> 連撃パワー {getPermaBuff('kenshiComboPower')}/{KENSHI_COMBO_POWER_MAX}{getPermaBuff('kenshiExtraCombo')>0?`・追加連撃 +${getPermaBuff('kenshiExtraCombo')}`:''}</div>}
            <div className={`text-[7px] font-black bg-black/60 px-2 py-0.5 rounded border flex items-center gap-1 shadow-lg uppercase ${getPermaBuff('autoHpRecovery',0.1)>=0.1?'text-rose-400 border-rose-400/50':'text-red-400 border-red-400/50'}`}><Heart size={7}/> ライフ回復 {Math.round(getPermaBuff('autoHpRecovery',0.1)*100)}%</div>
            <div className="text-[7px] font-black text-amber-400 bg-black/60 px-2 py-0.5 rounded border border-amber-400/50 flex items-center gap-1 shadow-lg uppercase"><Zap size={7}/> ガッツ回復 {Math.round(applyIceRulerAutoGutsRecovery(Math.max(0,0.05+(getPermaBuff('autoHpRecovery',0.1)-0.1))+getPermaBuff('gutsRecoverPct'),mainHero?.id,iceLockActive,heroDist,enemyDist)*100)}%</div>
            {/* ポルツの待機。あと何回ぶん敵の攻撃で発動するかを出す(0になったら消える。得た効果は残る) */}
            {getPermaBuff('poltzCharges')>0&&<div className="text-[7px] font-black text-lime-300 bg-lime-950/60 px-2 py-1 rounded-full border border-lime-400/50 animate-pulse flex items-center gap-1"><Zap size={8}/> {BREEDER_EVO_NAMES.poltz[Math.max(0,Math.min(getPermaBuff('poltzTier'),2))]} ×{Math.floor(getPermaBuff('poltzCharges'))}</div>}
            {/* === ターン限定バフ（都度表示） === */}
            {getNextTurnBuff('melosoFullRecoveryMult',0)>0&&<div className="text-[7px] font-black text-rose-300 bg-rose-950/60 px-2 py-1 rounded-full border border-rose-400/50 animate-pulse flex items-center gap-1"><Heart size={8}/> 次ターン全回復</div>}
            {getTurnBuff('atkMult',1.0)>1&&<div className="text-[7px] font-black text-red-500 bg-red-950/60 px-2 py-1 rounded-full border border-red-500/50 animate-pulse uppercase flex items-center gap-1"><Sparkles size={8}/> Boost x{getTurnBuff('atkMult',1.0).toFixed(1)}</div>}
            {getTurnBuff('stunEnemy',false)&&<div className="text-[7px] font-black text-yellow-400 bg-yellow-950/60 px-2 py-1 rounded-full border border-yellow-500/50 animate-pulse uppercase flex items-center gap-1"><Zap size={8}/> スタン予約</div>}
            {getTurnBuff('guaranteedCrit',false)&&<div className="text-[7px] font-black text-orange-400 bg-orange-950/60 px-2 py-1 rounded-full border border-orange-500/50 animate-pulse uppercase flex items-center gap-1"><Target size={8}/> 会心予約</div>}
            {(getTurnBuff('zeroGuts',false)||getNextTurnBuff('zeroGuts',false))&&<div className="text-[7px] font-black text-blue-400 bg-blue-950/60 px-2 py-1 rounded-full border border-blue-500/50 animate-pulse uppercase flex items-center gap-1"><Star size={8}/> 0消費中</div>}
            {getNextTurnBuff('reflect',false)&&<div className="text-[7px] font-black text-purple-400 bg-purple-950/60 px-2 py-1 rounded-full border border-purple-500/50 animate-pulse uppercase flex items-center gap-1"><RefreshCcw size={8}/> 次反射</div>}
            {getTurnBuff('reflect',false)&&<div className="text-[7px] font-black text-purple-300 bg-purple-900/80 px-2 py-1 rounded-full border border-purple-400 animate-bounce uppercase flex items-center gap-1"><RefreshCcw size={8}/> 反射待機</div>}
            {getWaveBuff('enemyAtkDebuffPct')>0&&<div className="text-[7px] font-black text-indigo-400 bg-indigo-950/60 px-2 py-1 rounded-full border border-indigo-500/50 animate-pulse uppercase flex items-center gap-1"><ArrowDownCircle size={8}/> 敵攻-{Math.round(getWaveBuff('enemyAtkDebuffPct')*100)}%</div>}
            {getWaveBuff('enemyTakenDmgBonus')>0&&<div className="text-[7px] font-black text-orange-400 bg-orange-950/60 px-2 py-1 rounded-full border border-orange-500/50 animate-pulse uppercase flex items-center gap-1"><PlusCircle size={8}/> 敵被ダメ+{Math.round(getWaveBuff('enemyTakenDmgBonus')*100)}%</div>}
            {getNextTurnBuff('takenDamageMult',1.0)<1&&<div className="text-[7px] font-black text-pink-400 bg-pink-950/60 px-2 py-1 rounded-full border border-pink-500/50 animate-pulse uppercase flex items-center gap-1"><Shield size={8}/> 次T被ダメ-{Math.round((1-getNextTurnBuff('takenDamageMult',1.0))*100)}%</div>}
            {getTurnBuff('takenDamageMult',1.0)<1&&<div className="text-[7px] font-black text-pink-300 bg-pink-900/80 px-2 py-1 rounded-full border border-pink-400 animate-bounce uppercase flex items-center gap-1"><Shield size={8}/> 被ダメ-{Math.round((1-getTurnBuff('takenDamageMult',1.0))*100)}%</div>}
            {getNextTurnBuff('gutsCostMult',1.0)>1&&<div className="text-[7px] font-black text-amber-400 bg-amber-950/60 px-2 py-1 rounded-full border border-amber-500/50 animate-pulse uppercase flex items-center gap-1"><Zap size={8}/> 次T消費G+{Math.round((getNextTurnBuff('gutsCostMult',1.0)-1)*100)}%</div>}
            {getTurnBuff('gutsCostMult',1.0)>1&&<div className="text-[7px] font-black text-amber-300 bg-amber-900/80 px-2 py-1 rounded-full border border-amber-400 animate-bounce uppercase flex items-center gap-1"><Zap size={8}/> 消費G+{Math.round((getTurnBuff('gutsCostMult',1.0)-1)*100)}%</div>}
          </div>
        </main>
        <div className="shrink-0 py-2 px-2 bg-slate-950 border-y border-white/5 flex flex-col items-center justify-center gap-1 z-10 relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1" style={{zIndex:200}}>{popups.filter(p=>p.side==='hero').map((p)=>(<div key={p.id} data-lite-damage={liteBattleView?'true':undefined} className={`${p.color} font-black leading-tight px-2 py-0.5 rounded-lg ${liteBattleView?'border border-white/20 text-base':'drop-shadow-[0_2px_8px_rgba(0,0,0,1)]'}`} style={{backgroundColor:liteBattleView?'rgba(2,6,23,0.95)':'rgba(2,6,23,0.55)'}}>{p.text}</div>))}</div>
          <div className="w-full space-y-1 px-2 py-1 bg-black/40 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 relative"><Heart className="text-pink-500 shrink-0" size={12}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-pink-400 mb-0.5 uppercase tracking-widest"><span>Ally Life</span><span className="font-mono">{hp.toLocaleString()} / {effectiveMaxHp.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-pink-700 to-rose-400 transition-all duration-1000" style={{width:`${(hp/effectiveMaxHp)*100}%`,backgroundImage:'linear-gradient(to right, #be185d, #fb7185)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='life').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
            <div className="flex items-center gap-2 relative"><Zap className="text-amber-500 shrink-0" size={10}/><div className="flex-1"><div className="flex justify-between text-[7px] font-bold text-amber-400 mb-0.5 uppercase tracking-widest"><span>Ally Guts</span><span className="font-mono">{Math.floor(guts).toLocaleString()} / {effectiveMaxGuts.toLocaleString()}</span></div><div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5 shadow-inner"><div className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500" style={{width:`${(guts/effectiveMaxGuts)*100}%`,backgroundImage:'linear-gradient(to right, #d97706, #fde047)'}}></div></div></div><div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>{popups.filter(p=>p.side==='guts').map((p)=>(<div key={p.id} className={`${p.color} text-base font-black drop-shadow-[0_2px_8px_rgba(0,0,0,1)] whitespace-nowrap px-2 py-0.5 rounded-lg animate-bounce`} style={{backgroundColor:'rgba(2,6,23,0.8)'}}>{p.text}</div>))}</div></div>
          </div>
          {(()=>{
            // Overall total damage across ALL monster slots, matching processTurn's global attack order.
            // Existing total = sum of already-assigned attack cards.
            // If a card is pending and validly assignable somewhere, also compute the projected new total.
            // committed (already assigned) attack cards in selection order
            // 2枚目以降のカードは効果半減。processTurnと同じく「アシストカード以外の枚数」で数える。
            // 保留中(タップしただけでまだ置いていない)カードは、まだ使っていないので枚数に数えない。
            // ここを数えてしまうと、1枚目なのに自分自身を2枚目とみなして半減表示になる。
            const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
            const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
            // おりょう・ゴーレム・モッチー/ミタラシ・ききは使ったターンからすぐ効くため、
            // 先に選んだカードぶんの補正を、あとに続くカードの予測へも反映する
            // (processTurnの実行順序と同じ数え方。localBoostFromCard/previewLocalBoosts参照)。
            const boosts=previewLocalBoosts(pendingIdx);
            let committedTotal=0; let committedPenaltyCnt=0; let guardFlat=0; let guardMult=0;
            selectedCards.forEach(idx=>{
              if(idx===pendingIdx) return;
              const card=hand[idx]; const slotIdx=cardAssignments[idx];
              const isPenalty=!isAssistCard(card);
              const halved=isPenalty&&committedPenaltyCnt>0;
              const b=boosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
              if(slotIdx!=null&&isAttackCard(card)){const baseDmg=getDmg(card,slotIdx,slots[slotIdx],b.oryo,b.dmgMod,halved); committedTotal+=getAttackPredictedDmg(card,slots[slotIdx],baseDmg,b.combo);}
              const gw=guardCardWeight(card);
              if(gw>0){ const e=cardEffectMultiplier(card,halved); guardFlat+=GUARD_EVOLUTION[guardLevel].flat*gw*e; guardMult+=GUARD_EVOLUTION[guardLevel].mult*gw*e; }
              if(isPenalty) committedPenaltyCnt++;
            });
            const committedGuard=guardValueOf(guardFlat,guardMult);
            // 保留カードがガードなら、置いたあとの合計軽減も出す
            const pendingGuardWeight=guardCardWeight(pendingCardObj);
            const pendingGuardHalved=pendingGuardWeight>0&&!isAssistCard(pendingCardObj)&&committedPenaltyCnt>0;
            const pendingGuardEffect=cardEffectMultiplier(pendingCardObj,pendingGuardHalved);
            const projectedGuard=pendingGuardWeight>0
              ? guardValueOf(guardFlat+GUARD_EVOLUTION[guardLevel].flat*pendingGuardWeight*pendingGuardEffect, guardMult+GUARD_EVOLUTION[guardLevel].mult*pendingGuardWeight*pendingGuardEffect)
              : committedGuard;
            const pendingIsAtk=isAttackCard(pendingCardObj);
            // projected damage the pending card would add (as the next attack in order)
            let pendingAdd=0; let pendingValidSlot=null;
            if(pendingIsAtk){
              // find a slot it could legally hit (for unique: its own monster; else any occupied slot)
              for(let i=0;i<slots.length;i++){
                const s=slots[i]; if(!s) continue;
                const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
                const maxUses=slotMaxUses(s,i); if(assignedCount>=maxUses) continue;
                if(pendingCardObj.type==='unique'&&pendingCardObj.ownerSlotIdx!==i) continue;
                pendingValidSlot=i; const baseDmg=getDmg(pendingCardObj,i,s,boosts.forPending.oryo,boosts.forPending.dmgMod,!isAssistCard(pendingCardObj)&&committedPenaltyCnt>0); pendingAdd=getAttackPredictedDmg(pendingCardObj,s,baseDmg,boosts.forPending.combo); break;
              }
            }
            const projectedTotal=committedTotal+pendingAdd;
            const showProjected=pendingIsAtk&&pendingValidSlot!=null&&pendingAdd>0;
            // 合計軽減は、ガードを置いたぶんの合計。2枚目以降のガードは半分で計算される。
            const showGuardProjected=pendingGuardWeight>0&&projectedGuard>committedGuard;
            const showDmg=committedTotal>0||showProjected;
            const showGuard=committedGuard>0||showGuardProjected;
            if(!showDmg&&!showGuard) return null;
            return(
              <div className="absolute left-1/2 -translate-x-1/2 z-[50] flex flex-col items-center justify-center gap-1 pointer-events-none" style={{bottom:'calc(78% + 2px)'}}>
                {showDmg&&(
                <div className={`flex items-center gap-2 px-3 py-0.5 rounded-full border shadow-lg ${showProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-red-950/90 border-red-500/50'} backdrop-blur-sm`}>
                  <Sword size={11} className={showProjected?'text-yellow-400':'text-red-400'}/>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">合計DMG</span>
                  {showProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedTotal}</span>
                      <span className="text-yellow-400">+{pendingAdd}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedTotal}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.5)]">{committedTotal}</span>
                  )}
                </div>
                )}
                {showGuard&&(
                <div className={`flex items-center gap-2 px-3 py-0.5 rounded-full border shadow-lg ${showGuardProjected?'bg-yellow-950/90 border-yellow-500/70':'bg-emerald-950/90 border-emerald-500/50'} backdrop-blur-sm`}>
                  <Shield size={11} className={showGuardProjected?'text-yellow-400':'text-emerald-400'}/>
                  <span className="text-[8px] font-black uppercase tracking-widest text-slate-300">合計軽減</span>
                  {showGuardProjected?(
                    <span className="text-[11px] font-black font-mono flex items-center gap-1">
                      <span className="text-slate-400">{committedGuard}</span>
                      <span className="text-yellow-400">+{projectedGuard-committedGuard}</span>
                      <ChevronRight size={10} className="text-slate-500"/>
                      <span className="text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]">{projectedGuard}</span>
                    </span>
                  ):(
                    <span className="text-[11px] font-black font-mono text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">{committedGuard}</span>
                  )}
                </div>
                )}
              </div>
            );
          })()}
          <div className={`grid grid-cols-4 gap-2 w-full relative shrink-0${battleTutorialSpotClass('battleSlots')}`} style={{height:'100px'}}>
            {slots.map((s,i)=>{
              // Count how many cards already assigned to this slot
              const assignedCount=Object.values(cardAssignments).filter(v=>v===i).length;
              // 通常は1枠1枚。枚数+1の勇者特性(ハムの連続攻撃・剣士モッチーの二刀流)を持つ
              // 勇者モンが居ると、その本人のスロットだけ複数枚OK。
              // ききのカード上限+1が効いているときも、その+1ぶんはどのスロットへ重ねてよい
              const maxUses=slotMaxUses(s,i);
              const pendingCardObj=pendingCard!=null?hand[pendingCard]:(dragState&&dragState.active?dragState.card:null);
              // 保留中のカードはまだ使っていないので、「何枚目か」の枚数には数えない
              const pendingIdx=pendingCard!=null?pendingCard:((dragState&&dragState.active)?dragState.cardIndex:null);
              // Can this slot accept the pending card?
              let canAssign=false;
              if(s && pendingCardObj){
                canAssign = assignedCount<maxUses;
                if(pendingCardObj.type==='unique') canAssign = canAssign && (pendingCardObj.ownerSlotIdx===i);
              }
              // 選択順に「アシストカード以外」を数え、どのカードが2枚目以降(効果半減)かを出す。
              // 保留中のカードはまだ使っていないので数えない。
              // 保留中のカードは自分を数えず、「次に使う1枚」として半減かどうかを決める。
              // (数えてしまうと1枚目でも半減、除外しっぱなしだと2枚目でも全開の表示になる)
              const halvedByIdx={};
              {let n=0;
                selectedCards.forEach(idx=>{ if(idx===pendingIdx) return; const c=hand[idx]; const p=!isAssistCard(c); halvedByIdx[idx]=p&&n>0; if(p) n++; });
                if(pendingIdx!=null&&selectedCards.includes(pendingIdx)) halvedByIdx[pendingIdx]=!isAssistCard(hand[pendingIdx])&&n>0;}
              // Preview damage:
              // - if a card is pending assignment, show what THIS card would do on this monster
              // - otherwise show the sum of damage from cards already assigned to this slot,
              //   using the GLOBAL attack order (2nd+ attack = half damage), matching processTurn
              // おりょう・ゴーレム・モッチー/ミタラシ・ききの同ターン即時効果を、
              // このスロットの予測にも反映する(合計DMG欄と同じpreviewLocalBoosts)。
              const slotBoosts=previewLocalBoosts(pendingIdx);
              let previewDmg=0; let isPendingPreview=false; let isPendingHalved=false; let previewSoulPct=0;
              if(s && pendingCardObj && canAssign && isAttackCard(pendingCardObj)){
                // 既に選んだ「アシストカード以外」の枚数を数え、保留カードはその次の1枚として扱う
                let committedPenalty=0;
                selectedCards.forEach(idx=>{if(idx!==pendingIdx&&!isAssistCard(hand[idx]))committedPenalty++;});
                const isSecondOrLater = committedPenalty>=1 && !isAssistCard(pendingCardObj);
                const baseDmg=getDmg(pendingCardObj,i,s,slotBoosts.forPending.oryo,slotBoosts.forPending.dmgMod,isSecondOrLater);
                previewDmg=getAttackPredictedDmg(pendingCardObj,s,baseDmg,slotBoosts.forPending.combo);
                previewSoulPct=soulTraitAttackProfile(s?.masuId?getMasuMon(s.masuId):null,pendingCardObj,i).damagePct;
                isPendingPreview=true; isPendingHalved=isSecondOrLater;
              } else if(s){
                // 選択順で「アシストカード以外」を数え、2枚目以降は半減として予測する
                let globalPenaltyCnt=0;
                selectedCards.forEach(idx=>{
                  if(idx===pendingIdx) return;
                  const card=hand[idx];
                  const isPenalty=!isAssistCard(card);
                  const halved=isPenalty&&globalPenaltyCnt>0;
                  if(cardAssignments[idx]===i){
                    const b=slotBoosts.perCard[idx]||{oryo:0,dmgMod:0,combo:0};
                    const baseDmg=getDmg(card,i,s,b.oryo,b.dmgMod,halved);
                    previewDmg+=getAttackPredictedDmg(card,s,baseDmg,b.combo);
                  }
                  if(isPenalty)globalPenaltyCnt++;
                });
              }
              const isAnimating = !ecoBattleView && attackAnim && attackAnim.slotIndex === i;
              // このスロットに固有技カードが割り当てられているか（セット中は常時エフェクト）
              const hasUniqueSet = selectedCards.some(idx=>cardAssignments[idx]===i && hand[idx]?.type==='unique');
              // このスロットに表示する選択中カード: 攻撃系は割当先スロット、全体系(ガード/バフ/回復等)は全スロット
              const slotAssignedCards = selectedCards.filter(idx=>{
                const card=hand[idx]; if(!card) return false;
                if(cardNeedsMonster(card)) return cardAssignments[idx]===i;
                return true; // 全体系は全スロット
              }).map(idx=>({idx,card:hand[idx]}));
              const distanceBreakLevel=ultimateDistanceBreakLevels[i]||0;
              const distanceBroken=distanceBreakLevel>0;
              const distanceBreakPercent=100*(0.5**distanceBreakLevel);
              const distanceBreakRoman=['','I','II','III','IV'][distanceBreakLevel]||String(distanceBreakLevel);
              return(<button key={i} data-slot-index={i} data-distance-broken={distanceBroken?'true':undefined} data-distance-break-level={distanceBroken?distanceBreakLevel:undefined} aria-label={`${RANGE_LABELS[i]}距離${distanceBroken?`（BREAK Lv${distanceBreakLevel}・与ダメージ${distanceBreakPercent}%）`:''}`} onClick={()=>{
                if(isBusy||autoBattleRef.current)return;
                if(pendingCard!=null && canAssign){
                  setCardAssignments(p=>({...p,[pendingCard]:i}));
                  setPendingCard(null);
                  setFocusedCard(null);
                  Audio_.se.card();
                  setSlotSettle(i);
                  setTimeout(()=>{ setSlotSettle(null); }, 500);
                }
              }} disabled={isBusy||autoBattle} className={`relative rounded-xl border-2 flex flex-col items-stretch overflow-visible transition-all ${RANGE_STYLES[i].bg} ${distanceBroken?'border-red-400':' '+RANGE_STYLES[i].border} ${(canAssign||(dragState?.active&&dragOverSlot===i))?'ring-2 ring-yellow-400 scale-105 z-10 shadow-lg animate-pulse':'opacity-100'} ${assignedCount>0?'ring-2 ring-indigo-500':''} ${dragState?.active&&dragOverSlot===i?'ring-4 ring-green-400 scale-110':''} ${slotSettle===i?'ring-4 ring-white':''}`} style={isAnimating?{zIndex:9999, animation:attackMotionAnimation(attackAnim)}:(distanceBroken?{backgroundColor:distanceBreakLevel>=2?'rgb(12,2,5)':'rgb(24,5,25)',boxShadow:`inset 0 0 0 ${Math.min(4,distanceBreakLevel+1)}px rgba(248,113,113,.95), inset 0 0 ${28+distanceBreakLevel*8}px rgba(76,5,25,.98), 0 0 ${9+distanceBreakLevel*4}px rgba(220,38,38,.65)`}:(slotSettle===i?{animation:'slotSettle 400ms ease-out'}:undefined))}>
                {distanceBroken&&<>
                  <div className="absolute inset-0 rounded-lg pointer-events-none z-[15]" style={{background:`repeating-linear-gradient(${135+distanceBreakLevel*12}deg,rgba(0,0,0,.12) 0 ${Math.max(3,8-distanceBreakLevel)}px,rgba(127,29,29,${Math.min(.8,.28+distanceBreakLevel*.14)}) ${Math.max(4,9-distanceBreakLevel)}px ${Math.max(5,10-distanceBreakLevel)}px),radial-gradient(circle at 50% 40%,rgba(${distanceBreakLevel>=2?'69,10,10':'88,28,135'},.55),rgba(5,0,2,.9))`}}></div>
                  <div className="absolute inset-[2px] rounded-lg border border-red-300/80 pointer-events-none z-[45]" style={{boxShadow:'inset 0 0 12px rgba(239,68,68,.7)'}}></div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-[65] whitespace-nowrap rounded-full border-2 border-red-200 bg-red-950 px-1.5 py-0.5 text-[7px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,.9)]">{distanceBreakLevel===1?'⚠':'☠'} BREAK {distanceBreakRoman}｜与ダメ {distanceBreakPercent}%</div>
                  {!s&&<div className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none text-red-200/80"><span className="text-2xl font-black">⚠</span></div>}
                </>}
                {/* 名前の行。勇者モンには王冠を付ける。どれが勇者モンか分からないと
                    「勇者モン選択時だけ効く特性」が効いているのか判断できないため */}
                <div className={`h-[25%] flex items-center justify-center px-1 border-b z-20 ${isHeroSlotMon(s)?'bg-amber-500/25 border-amber-300/50':'bg-black/60 border-white/10'}`}>{isHeroSlotMon(s)&&<Crown size={8} className="shrink-0 mr-0.5 text-amber-300"/>}<span className={`text-[7px] font-black truncate uppercase leading-none ${isHeroSlotMon(s)?'text-amber-100':'text-white'}`}>{s?.name||'---'}</span>{assignedCount>0&&<span className="ml-1 text-[7px] font-black text-indigo-300">×{assignedCount}</span>}</div>
                {(()=>{const uOptions=getAvailableUniquesForSlot(s,ownedUniques,i); if(uOptions.length<2) return null; const curKey=activeSlotUniqueKey(slotUniqueChoice,i,s); const curIdx=Math.max(0,uOptions.findIndex(o=>o.key===curKey));
                  return(<div onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation(); if(isBusy||autoBattleRef.current)return; cycleActiveUniqueForSlot(i);}} className={`shrink-0 z-20 flex items-center justify-center gap-0.5 bg-purple-700/90 border-b border-purple-300/50 py-0.5 active:scale-95${autoBattle?' opacity-40':''}`}>
                    <RefreshCcw size={7} className="text-white"/><span className="text-[6px] font-black text-white leading-none">固有技 {curIdx+1}/{uOptions.length}</span>
                  </div>);
                })()}
                <div className="flex-1 flex flex-col items-center justify-center relative">
                  {slotSettle===i&&(
                    <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center overflow-visible">
                      <div className="absolute rounded-full border-4 border-cyan-300" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out forwards'}}></div>
                      <div className="absolute rounded-full border-2 border-white" style={{width:'40px',height:'40px',animation:'setRing 500ms ease-out 80ms forwards'}}></div>
                      <div className="absolute w-8 h-8 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-[0_0_16px_rgba(103,232,249,0.9)]" style={{animation:'setPop 500ms cubic-bezier(.2,1.5,.4,1) forwards'}}><Check size={18} className="text-white" strokeWidth={4}/></div>
                    </div>
                  )}
                  <div className={`absolute inset-0 rounded-xl ${RANGE_STYLES[i].slotBg} opacity-20 pointer-events-none`}></div>
                  {slotAssignedCards.length>0&&(
                    <div className="absolute top-0 left-0 right-0 flex flex-col gap-px items-center z-[55] pointer-events-none px-0.5">
                      {slotAssignedCards.map(({idx,card})=>{
                        // ガードは軽減量をその場で出す。2枚目以降なら半分になった値をそのまま表示する
                        const gw=guardCardWeight(card), ge=cardEffectMultiplier(card,halvedByIdx[idx]);
                        const gv=gw>0?guardValueOf(GUARD_EVOLUTION[guardLevel].flat*gw*ge,GUARD_EVOLUTION[guardLevel].mult*gw*ge):0;
                        return(
                        <div key={idx} className={`flex items-center gap-0.5 px-1 rounded w-full justify-center min-w-0 ${cardNeedsMonster(card)?'bg-red-600/85':'bg-emerald-600/85'}`}>
                          <span style={{fontSize:'7px'}} className="leading-none shrink-0">{cardIconNode(card.icon,9,card.id)}</span>
                          <span style={{fontSize:'7px'}} className="font-black text-white leading-none truncate min-w-0">{halvedByIdx[idx]?'½':''}{card.name}</span>
                          {gv>0&&<span style={{fontSize:'7px'}} className="font-black text-emerald-100 leading-none shrink-0">-{gv}</span>}
                        </div>
                        );
                      })}
                    </div>
                  )}
                  {!ecoBattleView&&hasUniqueSet&&(
                    <div className="absolute inset-0 pointer-events-none z-40 flex items-center justify-center overflow-visible">
                      <div className="absolute inset-0 rounded-xl" style={{background:'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(99,102,241,0.28) 50%, rgba(0,0,0,0) 75%)', animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      <div className="absolute -inset-0.5 rounded-xl border-2 border-purple-400/80" style={{animation:'idleAuraPulse 1200ms ease-in-out infinite'}}></div>
                      {[0,90,180,270].map(deg=>(
                        <div key={deg} className="absolute text-base" style={{transform:`rotate(${deg}deg) translateY(-26px)`, animation:'idleSpark 900ms ease-in-out infinite', animationDelay:`${deg*2}ms`}}>⚡</div>
                      ))}
                    </div>
                  )}
                  {/* 距離補正は0%でも出す(「補正が無い」ことも情報なので、枠ごとに常に見えるようにする) */}
                  {(()=>{const totalBonus=distTotalBonus(i); return(<div className={`absolute bottom-0.5 right-0.5 text-[6px] font-black leading-none flex items-center gap-0.5 bg-black/50 px-1 py-0.5 rounded border z-30 ${totalBonus>0?'text-cyan-300 border-cyan-400/30':totalBonus<0?'text-red-300 border-red-400/30':'text-slate-300 border-white/20'}`}><Sword size={5}/>{totalBonus>0?'+':''}{(totalBonus*100).toFixed(1)}%</div>);})()}
                  {previewDmg>0&&(<div className={`absolute ${slotAssignedCards.length>0?'top-[18px]':'top-0'} ${isPendingPreview?'bg-yellow-500 text-black ring-yellow-200':'bg-red-600 text-white ring-white/50'} text-[8px] font-black px-1.5 py-0.5 rounded shadow-lg z-50 animate-bounce ring-1`}>{isPendingPreview&&isPendingHalved?'½ ':''}DMG:{previewDmg}{isPendingPreview&&previewSoulPct>0&&<span data-soul-damage-preview className="ml-1 rounded bg-sky-950/80 px-1 py-0.5 text-[6px] text-sky-100">魂格 +{previewSoulPct}%</span>}</div>)}
                  {s?.imgUrl?(isAnimating&&s.id==='Pandora'&&attackAnim.motion==='pandoraDualThunder'
                    ?<PandoraDualThunder image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="object-contain drop-shadow-md"/>}/>
                    :isAnimating&&attackAnim.motion==='arkHolyRain'
                      ?<ArkHolyRainMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        charging={attackAnim.charge===true}
                        empowered={attackAnim.charge===false}/>
                    :isAnimating&&attackAnim.motion==='waterBurst'
                      ?<WaterBurstMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                    :isAnimating&&attackAnim.motion==='miaSongNotes'
                      ?<MiaSongNotesMotion
                        image={<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>}
                        lunge={attackAnim.charge===false}
                        charging={attackAnim.charge===true}/>
                      :<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} style={{width:'64px',height:'64px'}} className="z-10 object-contain drop-shadow-md"/>):(<span style={{fontSize:'40px'}} className="z-10 drop-shadow-md">{s?.emoji||''}</span>)}
                  {/* 剣士モッチーの二刀流の軌跡。エイキの桜と同じく攻撃中だけ重ねる */}
                  {isAnimating&&attackAnim.twinBlade&&<KenshiTwinSlash/>}
                  {/* エイキの桜。攻撃モーションが出ているあいだだけ重ねる(常時アニメーションにしない) */}
                  {isAnimating&&attackAnim.sakura&&<EikiSakuraPetals/>}
                </div>
                <div className={`h-[28%] ${RANGE_STYLES[i].labelBg} flex items-center justify-center border-t border-white/20 z-20`}><span className="text-[9px] font-black uppercase tracking-tighter leading-none">{RANGE_LABELS[i]}距離</span></div>
              </button>);
            })}
          </div>
        </div>
        {/* ∞周回にした最初の1回だけ、モンビーへ行けることを伝える(PR8) */}
        {quickRhythmIntroVisible&&<div data-quick-rhythm-intro className="shrink-0 border-t border-fuchsia-400/30 bg-slate-950/95 px-2 py-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1"><AssistantBubble scene="quickRhythmIntro" compact/></div>
            <button type="button" onClick={dismissQuickRhythmIntro} aria-label="この案内を閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg text-slate-400 font-black">×</button>
          </div>
        </div>}
        <div className="h-[24%] shrink-0 bg-slate-900/95 p-1 flex flex-col relative border-t border-white/10">
          <div className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 flex justify-between px-2 items-center gap-1">
            {/* 勇者モンの特性で枚数が増えているときは、その分を王冠付きで出す。
                「勇者モンに選んだときだけ効く特性」が今効いていることを確かめられるようにする */}
            <span className={`flex-1 min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0.5${battleTutorialSpotClass('cardCount')}`}><span className="whitespace-nowrap">Action Cards</span> <span className="shrink-0 bg-white/10 text-white px-2 py-0.5 rounded-full font-mono">{selectedCards.length}/{cardLimit}</span>{heroCardBonus>0&&<span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-300/40 text-amber-200 whitespace-nowrap"><Crown size={8}/>+{heroCardBonus}</span>}{kikiCardBonus>0&&<span className="shrink-0 px-1.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-300/40 text-violet-200 whitespace-nowrap">応援+1</span>}{soulCoordinationCardBonus>0&&<span data-soul-coordination-bonus className="shrink-0 px-1.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-300/40 text-sky-200 whitespace-nowrap">魂格+1</span>}</span>
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={()=>setShowDeckInfo(true)} className={`flex items-center gap-0.5 px-1.5 py-1 bg-white/5 rounded-lg border border-white/10 active:scale-95${battleTutorialSpotClass('deckView')}`}><Layers size={9}/><span className="text-[7px]">VIEW</span></button>
              {/* 🎵の縦列。BGMの下にモンビーを並べる(どちらも音に関わる入口なので隣り合わせにする) */}
              <div className="shrink-0 flex flex-col gap-0.5">
                <button data-auto-bgm-button type="button" onClick={()=>setShowAutoBgmPicker(true)} aria-label="バトルBGMと音量を調整" title="BGM / 音量" className="shrink-0 min-h-[32px] min-w-[42px] rounded-lg border border-indigo-400/50 bg-indigo-800 px-1.5 text-indigo-100 active:scale-90"><span className="block text-[13px] leading-none">🎵</span><span className="mt-0.5 block text-[7px] font-black leading-none">BGM</span></button>
                {quickToRhythmButtonNode}
              </div>
              <div className="w-[44px] shrink-0 flex flex-col gap-0.5">
                <button type="button" disabled={!!battleScenarioRef.current||battleTutorialStep!=null} onClick={cycleBattleAuto} aria-pressed={autoBattle} aria-label={`AUTO ${autoRepeat?'∞':autoBattle?'ON':'OFF'}`} className={`h-8 w-full px-1 rounded-lg border-2 font-black text-[8px] leading-tight active:scale-90 disabled:opacity-25 ${autoRepeat?'border-fuchsia-300 bg-fuchsia-500 text-slate-950 shadow-[0_0_12px_rgba(217,70,239,.65)]':autoBattle?'border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(34,211,238,.65)]':'border-slate-500 bg-slate-800 text-slate-300'}`}><span className="block">AUTO</span><span className="block text-[7px]">{autoRepeat?'∞':autoBattle?'ON':'OFF'}</span></button>
                {battleScreenActive&&isQuickMode(runMode)&&autoRepeat===true&&<button type="button" onClick={cycleEcoMode} aria-label={`省エネ ${ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}`} className={`min-h-[24px] w-full rounded-md border font-black text-[7px] leading-[9px] active:scale-90 ${ecoMode==='lite'?'border-emerald-300 bg-emerald-700 text-emerald-50':ecoMode==='ultra'?'border-lime-200 bg-lime-500 text-slate-950':'border-slate-500 bg-slate-700 text-slate-200'}`}><span className="block">省エネ</span><span className="block">{ecoMode==='lite'?'簡易':ecoMode==='ultra'?'超':'OFF'}</span></button>}
              </div>
              {(()=>{const allAttackAssigned=selectedCards.filter(idx=>cardNeedsMonster(hand[idx])).every(idx=>cardAssignments[idx]!=null); const canAct=!autoBattle&&!isBusy&&selectedCards.length>0&&pendingCard===null&&allAttackAssigned&&battleTutorialNeed!=='skillPicker'; return(<button onClick={()=>processTurn()} disabled={!canAct} className={`min-h-[44px] min-w-[84px] shrink-0 px-2 sm:px-5 rounded-full font-black text-[11px] sm:text-[13px] whitespace-nowrap active:scale-90 flex items-center justify-center gap-1 border-2 border-black uppercase tracking-wide transition-all${battleTutorialSpotClass('action')} ${canAct?'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.4)]':'bg-slate-700 text-slate-500 opacity-50'}`}><Play fill="currentColor" size={12}/> Action</button>);})()}
            </div>
          </div>
          {/* 使うカードが決まっている番は、その種類だけを光らせる(枠全体は光らせない) */}
          <div className={`flex-1 flex gap-1.5 overflow-x-auto items-stretch scrollbar-hide px-1 pb-1 justify-center${battleTutorialCardTarget?'':battleTutorialSpotClass('cards')}`}>
            {hand.map((c,i)=>{
              const isSel=selectedCards.includes(i);
              const assignedSlot=cardAssignments[i];
              const curGuts=assignedSlot!=null?getCardGuts(c,assignedSlot):getCardGuts(c,null);
              const requiredGuts=assignedSlot!=null?curGuts:pendingCardGuts(c);
              const remainingGuts=guts-selectedCards.reduce((acc,idx)=>acc+(idx===i?0:selectedCardGuts(idx)),0);
              const isSelectable=isSel||(remainingGuts>=requiredGuts&&selectedCards.length<cardLimit);
              const isPending=pendingCard===i;
              const assignedMon=assignedSlot!=null?slots[assignedSlot]:null;
              const isDragging=dragState?.active&&dragState?.cardIndex===i;
              // 練習で使わせたい種類以外は、つかむこと自体をさせない(選択も割り当ても起きない)
              const tutorialAllowed=battleTutorialCardAllowed(c);
              // 光らせるのは「いま触ってほしい種類」だけ。技変更の番は名前のところも光らせる
              const tutorialTargeted=!!battleTutorialCardTarget&&battleTutorialCardKind(c)===battleTutorialCardTarget;
              return(<div key={c.uid} className="flex-1 min-w-0 max-w-[20%] flex"><button onPointerDown={(e)=>{
                if(isBusy||autoBattleRef.current||!tutorialAllowed)return;
                const pt=e.touches?e.touches[0]:e;
                cardDragActiveRef.current=false;
                setDragState({cardIndex:i, x:pt.clientX, y:pt.clientY, active:false, card:c});
              }} style={{...(isDragging?{touchAction:'none',position:'fixed',left:dragState.x,top:dragState.y,transform:'translate(-50%,-50%) rotate(-3deg) scale(1.15)',zIndex:70000,width:'72px',pointerEvents:'none',transition:'none',filter:'drop-shadow(0 12px 18px rgba(0,0,0,0.65))'}:{touchAction:'none'}),...(TYPE_INLINE_STYLE[c.type]||{})}} className={`relative w-full rounded-xl border-2 p-1 flex flex-col items-center justify-between bg-gradient-to-b ${TYPE_COLORS[c.type]} ${isDragging?'ring-4 ring-white shadow-[0_0_24px_rgba(255,255,255,0.6)]':isSel?'transition-all -translate-y-1.5 ring-4 ring-cyan-300 z-20 scale-105 opacity-60 saturate-[0.7] shadow-[0_0_18px_rgba(103,232,249,0.6)]':'transition-all opacity-90'} ${isPending?'ring-4 ring-yellow-400 animate-pulse shadow-[0_0_20px_rgba(250,204,21,0.7)]':''} ${!isSelectable&&!isSel&&!isDragging?'grayscale opacity-50':''}${tutorialTargeted?' is-battle-tutorial-spot':''}${battleTutorialCardTarget&&!tutorialTargeted?' grayscale opacity-25':''}`}>
                {isSel&&!assignedMon&&(<div className="absolute top-0.5 left-0.5 z-30 w-5 h-5 rounded-full bg-cyan-400 border-2 border-white flex items-center justify-center shadow-lg"><Check size={10} className="text-white" strokeWidth={4}/></div>)}
                {assignedMon&&(<div className="absolute top-0.5 right-0.5 z-30 w-5 h-5 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center overflow-hidden shadow-lg">{assignedMon.imgUrl?<img src={assignedMon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span className="text-[9px]">{assignedMon.emoji}</span>}</div>)}
                <div className="text-3xl mt-1.5">{cardIconNode(c.icon,32,c.id)}</div><div className="w-full text-center flex flex-col justify-end gap-0.5">{['atk','range_atk','unique'].includes(c.type)?(<div onClick={(ev)=>{ev.stopPropagation(); if(isBusy||autoBattleRef.current||Date.now()<=suppressCardClickRef.current)return; setSkillPicker({handIndex:i});}} className={`text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5 underline decoration-dotted decoration-white/60 underline-offset-2 active:opacity-60${battleTutorialNeedCard&&tutorialTargeted?' is-battle-tutorial-spot':''}`}>{c.name}</div>):(<div className="text-[9px] font-black leading-tight w-full whitespace-normal h-7 flex items-center justify-center overflow-hidden uppercase italic px-0.5">{c.name}</div>)}<div className="text-[9px] font-black bg-black/40 text-white rounded py-1 flex items-center justify-center gap-0.5"><Zap size={9}/>{curGuts}</div></div></button></div>);
            })}
          </div>
        </div>
        </>)}
      </div>
    
  );
}

function UltimateDistanceBreakReveal({
  difficulty, extremeDifficulty, extremeRunRef, runMode, ultimateDistanceBreakLevels,
  ultimateDistanceBreakReveal,
}) {
  return (
<div data-ultimate-distance-break-reveal data-distance-break-overwrite={ultimateDistanceBreakReveal.level>=2?'true':undefined} className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:ultimateDistanceBreakReveal.level>=2?'radial-gradient(circle,rgba(69,10,10,.9),rgba(0,0,0,.99))':'radial-gradient(circle,rgba(127,29,29,.72),rgba(2,6,23,.97))'}} role="dialog" aria-modal="true" aria-label="距離弱体化発動">
    <div className={`w-full max-w-xs rounded-3xl border-2 border-red-300 px-5 py-7 ${ultimateDistanceBreakReveal.level>=2?'bg-black/95 shadow-[0_0_64px_rgba(220,38,38,.9)]':'bg-purple-950/95 shadow-[0_0_48px_rgba(239,68,68,.65)]'}`} style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-amber-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||ULTIMATE_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-red-100">{ultimateDistanceBreakReveal.level>=2?'DISTANCE BREAK OVERWRITE':'DISTANCE BREAK'}</div>
      <div className="mt-5 text-xl font-black text-white">{RANGE_LABELS[ultimateDistanceBreakReveal.distance]}距離 BREAK Lv{ultimateDistanceBreakReveal.level}</div>
      <div className="mt-2 rounded-xl border border-red-300/50 bg-black/40 py-2 text-sm font-black text-red-200">与ダメージ {100*(0.5**ultimateDistanceBreakReveal.level)}%</div>
      <div className="mt-4 border-t border-red-300/20 pt-3 text-[10px] text-purple-100"><span className="font-black text-slate-400">現在のBREAK：</span><br/><span className="font-black">{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</span></div>
    </div>
  </div>
  );
}

function EnemyRevivalReveal({
  difficulty, enemyRevivalReveal, extremeDifficulty, extremeRunRef, runMode,
}) {
  return (
<div data-extreme-revival-reveal className="fixed inset-0 flex items-center justify-center p-5 text-center" style={{zIndex:91000,background:'radial-gradient(circle,rgba(51,65,85,.82),rgba(2,6,23,.98))'}} role="dialog" aria-modal="true" aria-label="死者の再起">
    <div className="w-full max-w-xs rounded-3xl border-2 border-slate-200 bg-slate-950/95 px-5 py-7 shadow-[0_0_56px_rgba(203,213,225,.7)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      <div className="text-xs font-black tracking-[.24em] text-slate-300">{specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)||RAGNAROK_SETTING.id}</div>
      <div className="mt-2 text-2xl font-black italic tracking-wider text-slate-100">DEAD RISING</div>
      <div className="mt-5 text-xl font-black text-white">死者の再起 {enemyRevivalReveal.revivalNumber}回目</div>
      <div className="mt-2 rounded-xl border border-slate-300/50 bg-black/40 py-2 text-sm font-black text-slate-200">ライフ半分で起き上がり、攻撃力+50%</div>
      <div className="mt-4 border-t border-slate-300/20 pt-3 text-[10px] text-slate-300"><span className="font-black text-slate-400">残りの再起：</span><span className="font-black">{enemyRevivalReveal.remaining}回</span></div>
    </div>
  </div>
  );
}

function ExtremeRuleOverlay({
  closeExtremeRule, difficulty, extremeDifficulty, extremeRunRef, runMode, totalTurnCount,
  ultimateDistanceBreakLevels,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-5" style={{zIndex:90500,background:'radial-gradient(circle,rgba(112,26,117,.58),rgba(2,6,23,.9))',paddingTop:'calc(1.25rem + env(safe-area-inset-top))',paddingBottom:'calc(1.25rem + env(safe-area-inset-bottom))'}} onClick={closeExtremeRule} role="dialog" aria-modal="true" aria-label="極限ルール発動">
    <div className="w-full max-w-xs max-h-full flex flex-col rounded-3xl border-2 border-fuchsia-300 bg-slate-950/95 px-5 py-6 text-center shadow-[0_0_42px_rgba(217,70,239,.65)]" style={{animation:'mhExtremeRuleIn .38s ease-out'}}>
      {(()=>{const specialDifficulty=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);const groups=extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode));const breakRule=extremeDistanceBreakRule(specialDifficulty);return <>
        <div className="shrink-0 text-[11px] font-black tracking-[.12em] text-amber-300">⚠ {specialDifficulty} 特殊ルール</div>
        <div data-extreme-rule-intro={specialDifficulty} className="mt-3 min-h-0 flex-1 overflow-y-auto mh-scroll grid content-start gap-1.5 text-left">
          {groups.map(group=><div key={group.title} className="rounded-xl border border-fuchsia-400/25 bg-purple-950/55 px-2.5 py-1.5">
            <div className="text-[9px] font-black text-fuchsia-300">【{group.title}】</div>
            {group.lines.map(([label,value])=><div key={label} className="mt-0.5 grid grid-cols-[auto_1fr] items-start gap-2 text-[10px] font-bold leading-snug text-white"><span className="shrink-0 text-slate-300">{label}</span><b className="min-w-0 text-right">{value}</b></div>)}
          </div>)}
        </div>
        {breakRule&&<div className="mt-2 shrink-0 rounded-xl border border-amber-300/40 bg-black/45 px-3 py-2 text-left text-[10px] leading-relaxed text-slate-200">
          <div><span className="text-slate-400">現在の累計ターン：</span><b className="text-white">{totalTurnCount}</b></div>
          <div><span className="text-slate-400">現在のBREAK：</span><b className={ultimateDistanceBreakLevels.some(level=>level>0)?'text-red-200':'text-white'}>{ultimateDistanceBreakLevels.map((level,index)=>level>0?`${RANGE_LABELS[index]} Lv${level}`:null).filter(Boolean).join(' / ')||'なし'}</b></div>
        </div>}
      </>;})()}
      <div className="mt-4 shrink-0 text-[9px] font-black tracking-widest text-fuchsia-200">タップしてバトル開始</div>
    </div>
  </div>
  );
}

function SoulBattleEffects({
  battleIntimidate, battleSoulMasus, setShowSoulBattleEffects, soulBattleParty,
  soulCoordinationCardBonus, unifiedSpecialDefense,
}) {
  return (
<div data-soul-battle-effects className="fixed inset-0 flex flex-col bg-slate-950 text-white" style={{position:'fixed',inset:0,zIndex:41000,paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-sky-400/20 px-4 pb-3">
      <div><div className="text-[9px] font-black tracking-[.25em] text-sky-400">SOUL RANK</div><h3 className="text-lg font-black text-sky-100">魂格効果</h3></div>
      <button type="button" onClick={()=>setShowSoulBattleEffects(false)} className="min-h-[44px] min-w-[64px] rounded-full bg-white/10 px-4 text-[11px] font-black active:scale-95">戻る</button>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto mh-scroll px-4 py-3 space-y-3">
      <section className="rounded-2xl border border-sky-400/30 bg-sky-950/25 p-3">
        <div className="mb-2 text-[10px] font-black text-sky-200">パーティ効果</div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">被ダメージ</span><b className="text-emerald-300">-{(Math.round(soulBattleParty.damageReduction*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">特殊防御率</span><b className="text-cyan-300">{(Math.round(unifiedSpecialDefense.rate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">回避 / 反射 / 吸収</span><b className="text-slate-100">{(Math.round(unifiedSpecialDefense.evasion*10)/10)} / {(Math.round(unifiedSpecialDefense.reflect*10)/10)} / {(Math.round(unifiedSpecialDefense.absorb*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">威圧</span><b className="text-violet-300">{(Math.round(battleIntimidate*10)/10)}%</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">自動ガッツ回復</span><b className="text-amber-300">×{soulBattleParty.autoGutsMultiplier.toFixed(2)}</b></div>
          <div className="rounded-xl bg-black/30 p-2"><span className="block text-slate-400">使用可能カード</span><b className="text-sky-300">{soulCoordinationCardBonus>0?'+1':'変化なし'}</b></div>
        </div>
        {unifiedSpecialDefense.rate>0&&<div className="mt-2 text-[9px] leading-relaxed text-slate-400">特殊防御が発動した場合、回避・反射・吸収の比率から1つだけ発動します。</div>}
      </section>
      <section className="space-y-2">
        <div className="text-[10px] font-black text-sky-200">参加中マスモン</div>
        {battleSoulMasus.filter(m=>normalizeSoulRankStage(m.soulRankStage)>0).map(masu=>{
          const stage=normalizeSoulRankStage(masu.soulRankStage);
          const active=SOUL_TRAIT_DEFINITIONS.filter(t=>soulTraitLevel(masu,t.id)>0);
          const base=ALL_PLAYER_MONSTERS[masu.baseId];
          return <div key={masu.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <div className="flex items-center justify-between gap-2"><b className="truncate text-[11px]">{masu.name||base?.name||'マスモン'}</b><span className="shrink-0 rounded-full border border-sky-400/30 bg-sky-950/50 px-2 py-1 text-[8px] font-black text-sky-200">魂格{['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][stage]}</span></div>
            {active.length>0?<div className="mt-2 flex flex-wrap gap-1">{active.map(t=><span key={t.id} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[8px]"><b className="text-slate-200">{t.name}</b> <span className="text-sky-300">{formatSoulTraitEffect(t,soulTraitEffectValue(masu,t.id))}</span></span>)}</div>:<div className="mt-2 text-[9px] text-slate-500">振り分け済みの魂格特性はありません。</div>}
          </div>;
        })}
      </section>
    </div>
  </div>
  );
}
