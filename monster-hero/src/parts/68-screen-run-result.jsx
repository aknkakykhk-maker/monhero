// ==== 画面: バトルの結果まわり(WAVE結果・報酬えらび・ラン終了) ====
//
// MonsterHeroGame から切り出した18本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-11b)。
// WAVEごとの結果と技の強化、報酬えらび、そしてランの終わり方3つ(勝ち・敗北・リタイア)と
// そこから開くマスモン登録。
//
// 【この一群ならではの注意】
// ・ラン終了の処理(報酬の付与・記録の送信・保存)は MonsterHeroGame 側に残す。
//   画面は「もう決まった結果」を見せるだけで、計算も保存もしない(CLAUDE.md ⑦)
// ・演出の進み具合(championPresentationComplete など)を動かすタイマーはハンドラの中にあり
//   本体へ残る。画面の中に setTimeout は1つも無い
// ・ラン終了画面は勝ち(CHAMPION)だけが gameState を持ち、敗北とリタイアは
//   hp<=0 / gaveUp という別の条件で出る。3つとも同じマスモン登録へつながるので、
//   置き去りにせずまとめて持ってくる
function UpgradeSkillScreen({
  canRecoverGutsWithPoint, continueAfterUniqueUpgrade, effectiveMaxGuts, guts,
  recoverGutsWithPoint, uniqueUpgradeEntries, uniqueUpgradeRow, upgradePoints,
}) {
  return (

    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-start p-4 pt-8 text-center overflow-hidden">
      <div className="mb-2 shrink-0"><h2 className="text-xl font-black text-amber-400 italic uppercase">固有技の強化</h2><div className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest flex items-center justify-center gap-2">Remaining Points: <span className="text-white bg-amber-600 px-2 rounded-full font-mono">{upgradePoints}</span></div></div>
      {/* 強化ポイントのもう一つの使い道。技がすべてMAXでもポイントが無駄にならないよう、
          いまのガッツを戻せる。最大ガッツは増やさない。技の＋／－と違って取り消せないので、
          1回押すごとに確定する。技一覧を圧迫しないよう1行に収めている */}
      {(()=>{const gutsFull=guts>=effectiveMaxGuts; const noPoint=upgradePoints<GUTS_RECOVERY_POINT_COST; return (
      <div data-guts-recovery className="w-full max-w-sm shrink-0 mb-2 rounded-2xl border border-amber-500/40 bg-amber-950/25 px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0 text-left">
          <span className="block text-[8px] font-black tracking-widest text-amber-300/80 leading-none">現在ガッツ</span>
          <span className="block font-mono font-black leading-tight">
            <b className={gutsFull?'text-amber-300':'text-white'} style={{fontSize:'17px'}}>{guts}</b>
            <span className="text-slate-500" style={{fontSize:'12px'}}> / {effectiveMaxGuts}</span>
          </span>
        </div>
        <button type="button" data-guts-recovery-button
          disabled={!canRecoverGutsWithPoint}
          onClick={recoverGutsWithPoint}
          aria-label={`強化ポイント${GUTS_RECOVERY_POINT_COST}つでガッツを${GUTS_RECOVERY_AMOUNT}回復する`}
          className="shrink-0 min-h-[44px] px-3 rounded-xl bg-amber-600 text-white font-black leading-tight active:scale-95 disabled:opacity-30">
          {gutsFull
            ? <span className="block" style={{fontSize:'13px'}}>MAX</span>
            : (<>
                <span className="block" style={{fontSize:'12px'}}>{GUTS_RECOVERY_POINT_COST}P で +{GUTS_RECOVERY_AMOUNT}</span>
                <span className="block text-amber-100/90" style={{fontSize:'8px'}}>{noPoint?'ポイント不足':'ガッツ回復'}</span>
              </>)}
        </button>
      </div>);})()}
      <div className="w-full max-w-sm space-y-3 mb-2 min-h-0 overflow-y-auto mh-scroll flex-1 p-1 flex flex-col justify-start pt-2">
        {uniqueUpgradeEntries().map(e=>uniqueUpgradeRow(e))}
      </div>
      <button onClick={continueAfterUniqueUpgrade} className="w-full max-w-xs bg-white text-black py-3 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-transform mt-auto shrink-0">ブリーダー継承へ</button>
    </div>
  
  );
}

function WaveResultScreen({
  battleTutorialSpotClass, difficulty, distAptPct, extremeDifficulty, extremeRun,
  handleNextWave, runFinalizing, runMode, scoreMultiplier, slots, waveResult,
}) {
  return (

    /* 内訳が長くなると背の低い端末で「次のWAVEへ」が画面外に出る。justify-center は
       あふれたぶんを上下へ均等にはみ出させるので、overflow-hidden と合わさると
       スクロールもできず進行不能になっていた(320x568で実測)。
       見出しと内訳を min-h-0 の入れ物にまとめ、あふれたときだけそこが縮んで
       内側をスクロールさせる。ボタンは shrink-0 なので必ず画面内に残り、
       収まっているときは今までどおり全体が中央に寄る */
    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-center p-3 text-center overflow-hidden">
      <div className="w-full min-h-0 flex flex-col items-center overflow-y-auto mh-scroll">
      <div className="mb-2 shrink-0"><Trophy className="text-yellow-400 mx-auto mb-1" size={32}/><h2 className="text-xl font-black italic uppercase tracking-tighter text-white">WAVE {waveResult.wave} リザルト</h2></div>
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5 mb-3 shadow-2xl shrink-0">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-indigo-950/60 border border-indigo-400/20 px-2 py-1">
          <span className="text-[10px] font-black text-indigo-200">今回：<b className="font-mono text-sm text-white">{waveResult.turn}</b>ターン</span>
          <span className="text-[10px] font-black text-amber-200">累計：<b className="font-mono text-sm text-white">{waveResult.totalTurnCount}</b>ターン</span>
        </div>
        {isQuickMode(runMode)&&specialRuleDifficultyForRun(runMode,difficulty,extremeRun,extremeDifficulty)===ULTIMATE_SETTING.id&&(()=>{
          const normalRate=quickGrowthRateForRun(runMode,'Normal',waveResult.turn);
          const effectiveRate=quickGrowthRateForRun(runMode,difficulty,waveResult.turn);
          return <div data-quick-ultimate-growth className="rounded-lg border border-fuchsia-400/40 bg-purple-950/70 px-2 py-1 text-[9px] font-black text-purple-100"><span className="text-amber-300">自動成長</span>　通常 +{compactPercent(normalRate)} <span className="text-slate-500">→</span> 今回 +{compactPercent(effectiveRate)}<span className="block text-[8px] text-purple-300">WAVE {waveResult.turn}T / ULTIMATE補正 -{compactPercent(normalRate-effectiveRate)}</span></div>;
        })()}
        {waveResult.pendingUltimateDistanceBreak&&<div data-ultimate-distance-break-warning className="rounded-lg border border-red-400/60 bg-purple-950/80 px-2 py-1 text-[10px] font-black text-red-200">⚠ 次WAVEで距離弱体化が発動</div>}
        <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">WAVE 与ダメージ</span><span className="text-red-400 font-mono font-black text-base">{waveResult.totalDamage.toLocaleString()}</span></div>
        {waveResult.totalAllDamage!=null&&(<div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">全WAVE累計ダメージ</span><span className="text-orange-400 font-mono font-black text-base">{waveResult.totalAllDamage.toLocaleString()}</span></div>)}
        {waveResult.distDamage&&(<div className="border-b border-white/10 pb-1.5">
          <div className="text-cyan-400 font-black uppercase tracking-widest mb-1 text-left" style={{fontSize:'9px'}}>距離別ダメージ（味方位置）& 補正値(永続)</div>
          <div className="grid grid-cols-4 gap-1">
            {['零','近','中','遠'].map((lbl,i)=>{const dmg=waveResult.distDamage[i]||0; const cumDmg=waveResult.totalDistDamage?.[i]||0; const normalGained=(waveResult.normalGainedDistBonus?.[i]||0)*100; const gained=(waveResult.gainedDistBonus?.[i]||0)*100; const total=(waveResult.newDistBonus?.[i]||0)*100; const mon=slots[i]; const aptPct=(distAptPct[i]||0)*100; const combinedTotal=total+aptPct;
              return(<div key={i} className="bg-black/40 rounded-lg border border-white/5 flex flex-col items-center justify-center" style={{padding:'4px 2px',gap:'2px'}}>
                <div className="flex items-center" style={{gap:'3px'}}><div className="rounded-full bg-indigo-600/40 border border-indigo-400/50 flex items-center justify-center overflow-hidden shrink-0" style={{width:'26px',height:'26px'}}>{mon?(mon.imgUrl?<img src={mon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span style={{fontSize:'13px'}}>{mon.emoji}</span>):<span className="text-slate-600" style={{fontSize:'9px'}}>-</span>}</div><div className="font-black text-slate-300" style={{fontSize:'10px'}}>{lbl}</div></div>
                <div className="font-mono font-black text-red-400 leading-none" style={{fontSize:'11px'}}>{dmg.toLocaleString()}</div>
                <div className="text-orange-300/80 font-mono leading-none" style={{fontSize:'7px'}}>累計{cumDmg.toLocaleString()}</div>
                <div className="font-mono font-black text-cyan-300 leading-none" style={{fontSize:'9px'}}>+{total.toFixed(1)}%</div>
                {gained>0&&<div className="text-emerald-400 font-mono leading-none" style={{fontSize:'7px'}}>{normalGained!==gained?`通常 +${normalGained.toFixed(1)} → 実際 +${gained.toFixed(1)}`:`(+${gained.toFixed(1)})`}</div>}
                {mon&&<div className="text-indigo-300 font-mono font-black leading-none" style={{fontSize:'8px'}}>適性込合計+{combinedTotal.toFixed(1)}%</div>}
              </div>);})}
          </div>
        </div>)}
        {waveResult.recoveryDelta!=null&&(<div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">自動回復率 補正</span><span className="flex items-baseline gap-2"><span className={`font-mono font-black text-base ${waveResult.recoveryDelta>=0?'text-emerald-400':'text-red-400'}`}>{waveResult.baseRecoveryDelta!==waveResult.recoveryDelta&&<>通常 {waveResult.baseRecoveryDelta>=0?'+':''}{(waveResult.baseRecoveryDelta*100).toFixed(1)}% → 実際 </>}{waveResult.recoveryDelta>=0?'+':''}{(waveResult.recoveryDelta*100).toFixed(1)}%</span><span className="text-[8px] text-slate-500 font-mono">累計 <span className={`${waveResult.totalRecoveryDelta>=0?'text-emerald-300':'text-red-300'}`}>{waveResult.totalRecoveryDelta>=0?'+':''}{(waveResult.totalRecoveryDelta*100).toFixed(1)}%</span></span></span></div>)}
        {/* スコアの内訳。クイックモードはスコアを競わないので出さない */}
        {!isQuickMode(runMode)&&(<>
        <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">WAVE ボーナス ({waveResult.wave} WAVE)</span><span className="text-yellow-400 font-mono font-black text-base">x{waveResult.waveMult.toFixed(2)}</span></div>
        <div className="flex justify-between items-center border-b border-white/10 pb-0.5"><span className="text-slate-400 text-[11px] font-bold uppercase">残りターン数ボーナス ({waveResult.remainingTurns})</span><span className="text-blue-400 font-mono font-black text-base">x{waveResult.turnMult.toFixed(2)}</span></div>
        <div className="pt-1 flex flex-col gap-0.5 text-right"><div className="text-[9px] text-slate-500 font-bold uppercase italic">難易度ボーナス ({extremeRun?extremeDifficulty:difficulty}): x{scoreMultiplier}</div><div className="flex justify-between items-end"><span className="text-indigo-400 text-xs font-black uppercase">獲得スコア</span><span className="text-white font-mono font-black text-xl">{waveResult.roundScore.toLocaleString()}</span></div></div>
        <div className="pt-1 flex justify-between items-end border-t border-white/20"><span className="text-amber-500 text-[11px] font-black uppercase">累計スコア</span><span className="text-amber-400 font-mono font-black text-lg">{waveResult.totalScore.toLocaleString()}</span></div>
        </>)}
      </div>
      </div>
      <button onClick={handleNextWave} disabled={runFinalizing} aria-busy={runFinalizing} className={`w-full max-w-xs py-3 rounded-2xl font-black text-lg uppercase shadow-[0_0_20px_rgba(255,255,255,0.3)] shrink-0${battleTutorialSpotClass('waveNext')} ${runFinalizing?'bg-slate-500 text-slate-300 cursor-not-allowed':'bg-white text-indigo-900 active:scale-95'}`}>{runFinalizing?'処理中…':<>次へ進む <ChevronRight className="inline" size={20}/></>}</button>
    </div>
  
  );
}

function RewardPickScreen({
  atk, battleTutorialSpotClass, def, difficulty, effect, extremeDifficulty, extremeRun, guts,
  handleTraining, maxGuts, maxHp, runMode, setTrainingPicks, trainingPicks, waveResult,
}) {

    const specialRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRun,extremeDifficulty);
    const baseStats={atk,def,hp:maxHp,guts:maxGuts};
    // いま選んでいるぶんまでを適用した値。次の1回はこの値からさらに伸びる
    const current=resolveTrainingStats(baseStats,trainingPicks,waveResult?.turn,specialRule);
    const remaining=TRAINING_PICK_COUNT-trainingPicks.length;
    const ready=trainingPicks.length===TRAINING_PICK_COUNT;
    const STYLES={
      hp:  {icon:<Heart size={16}/>,      ring:'border-pink-400',    bg:'bg-pink-900/40',    tint:'text-pink-300',    chip:'bg-pink-500'},
      atk: {icon:<Sword size={16}/>,      ring:'border-red-400',     bg:'bg-red-900/40',     tint:'text-red-300',     chip:'bg-red-500'},
      def: {icon:<ShieldCheck size={16}/>,ring:'border-emerald-400', bg:'bg-emerald-900/40', tint:'text-emerald-300', chip:'bg-emerald-500'},
      guts:{icon:<Sparkles size={16}/>,   ring:'border-amber-400',   bg:'bg-amber-900/40',   tint:'text-amber-300',   chip:'bg-amber-500'},
    };
    return (
    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center p-3 overflow-hidden" data-screen="training">
      <div className="shrink-0 w-full max-w-sm" style={{paddingTop:'calc(.25rem + env(safe-area-inset-top))'}}>
        <div className="flex items-center justify-center gap-2">
          <Trophy className="text-amber-400" size={22}/>
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-white leading-none">トレーニング</h2>
        </div>
        {/* 「4種類から2つ選ぶ」ことと、いま何回選んだかを一目で分かるようにする */}
        <div className="mt-1.5 flex items-center justify-center gap-2">
          <span className="text-[10px] font-black text-slate-300">4種類から2つ選ぶ</span>
          <span className="flex items-center gap-1">
            {Array.from({length:TRAINING_PICK_COUNT}).map((_,i)=>(
              <i key={i} className={`block rounded-full ${i<trainingPicks.length?'bg-amber-400':'bg-slate-700'}`} style={{width:'9px',height:'9px'}}/>
            ))}
          </span>
          <span className="text-[11px] font-black font-mono text-amber-300">{trainingPicks.length} / {TRAINING_PICK_COUNT}</span>
        </div>
        {extremeRuleNumber(specialRule,'awakeningZeroTurns')!=null&&(()=>{
          const turns=waveResult?.turn||0;
          // 低下は増加量へ掛かるので、率から引いた「-○pt」ではなく倍率で出す
          const gainRate=trainingGainRate(turns,specialRule);
          return <div data-ultimate-training-status={specialRule} className="mt-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-center text-[9px] font-black text-purple-100"><span className="text-amber-300">{specialRule}補正</span>　今回{turns}T → 強化量 {compactPercent(gainRate)}（-{compactPercent(1-gainRate)}）</div>;
        })()}
        {specialRule==='NIGHTMARE'&&<div data-nightmare-training-status className="mt-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-center text-[9px] font-black text-purple-100"><span className="text-amber-300">NIGHTMARE補正</span>　強化量 {specialRulePercent(extremeSpecialRule(specialRule,'waveEnhancement'))}</div>}
      </div>
      <div className="shrink-0 w-full max-w-sm my-2 text-left"><AssistantBubble scene="rewardPick" compact/></div>
      {/* いま選んでいるぶんを反映した4ステータス。選ぶ前は現在値だけ、選ぶと増える量も出る。
          各項目のカードは自分のステータスしか出さないので、ここで全体を見比べられるようにする */}
      <div className="shrink-0 w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-1.5 mb-2" data-training-status>
        <div className="text-[8px] font-black tracking-widest text-slate-500 text-left mb-1">現在のステータス{trainingPicks.length>0&&<span className="text-amber-300">（選択中の変化）</span>}</div>
        <div className="grid grid-cols-4 gap-1">
          {TRAINING_OPTIONS.map(option=>{
            const st=STYLES[option.id]||STYLES.hp;
            const beforeAll=baseStats[option.stat];
            const afterAll=current[option.stat];
            const diff=afterAll-beforeAll;
            return (
              <div key={option.id} className="rounded-lg bg-black/40 px-1 py-1 text-center">
                <span className="block text-[8px] font-black text-slate-500 leading-none">{option.statLabel}</span>
                <span className={`block text-[13px] font-black font-mono leading-tight ${diff>0?st.tint:'text-slate-300'}`}>{afterAll}</span>
                <span className={`block text-[8px] font-black font-mono leading-none ${diff>0?'text-emerald-400':'text-slate-700'}`}>{diff>0?`+${diff}`:'±0'}</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* 4項目。1画面に収めるため2列2行。空きがあればカードが伸びて画面を埋める。
          同じ項目をもう一度タップすると2回目として積める */}
      <div className={`w-full max-w-sm grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0 overflow-y-auto mh-scroll${battleTutorialSpotClass('rewards')}`}>
        {TRAINING_OPTIONS.map(option=>{
          const count=trainingPicks.filter(id=>id===option.id).length;
          const st=STYLES[option.id]||STYLES.hp;
          const before=current[option.stat];
          const after=resolveTrainingStep(current,option.id,waveResult?.turn,specialRule)[option.stat];
          const full=remaining<=0;
          return (
            <button key={option.id} type="button" disabled={full||!!effect}
              onClick={()=>setTrainingPicks(prev=>prev.length>=TRAINING_PICK_COUNT?prev:[...prev,option.id])}
              aria-label={`${option.name} ${option.effect}${count>0?` 選択中${count}回`:''}`}
              className={`relative min-h-[112px] rounded-2xl border-2 p-2.5 flex flex-col items-start justify-center gap-2 text-left transition-all active:scale-95 disabled:opacity-40 ${count>0?`${st.bg} ${st.ring}`:'bg-slate-900/60 border-slate-800'}`}>
              {/* 何回選んだかを ×1 / ×2 で明確に出す */}
              {count>0&&<span className={`absolute top-1.5 right-1.5 ${st.chip} text-white text-[11px] font-black rounded-full px-2 py-0.5 shadow-lg`}>×{count}</span>}
              <span className={`flex items-center gap-1.5 ${st.tint}`}>{cardIconNode(st.icon)}<b className="text-[13px] font-black text-white leading-none">{option.name}</b></span>
              <span className={`text-[10px] font-black ${st.tint} leading-tight`}>{option.effect}{(extremeRuleNumber(specialRule,'awakeningZeroTurns')!=null||extremeRuleNumber(specialRule,'waveEnhancement')!=null)&&(()=>{
                const normalAfter=resolveTrainingStep(current,option.id,waveResult?.turn,null)[option.stat];
                const effectiveAfter=resolveTrainingStep(current,option.id,waveResult?.turn,specialRule)[option.stat];
                const normalGain=normalAfter-current[option.stat],effectiveGain=effectiveAfter-current[option.stat];
                return <span className="block text-purple-200">通常 +{normalGain} → 実際 +{effectiveGain}</span>;
              })()}</span>
              <span className="w-full rounded-lg bg-black/40 px-1.5 py-1 font-mono leading-tight">
                <span className="block text-[8px] text-slate-500 font-black">{option.statLabel}</span>
                <span className="block text-[11px] font-black text-slate-300">{before} <span className="text-slate-600">→</span> <b className={st.tint}>{after}</b></span>
              </span>
            </button>
          );
        })}
      </div>
      {/* 決定は2回そろうまで押せない。確定前ならいつでも選び直せる */}
      <div className="shrink-0 w-full max-w-sm mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2" style={{paddingBottom:'calc(.25rem + env(safe-area-inset-bottom))'}}>
        <button type="button" disabled={trainingPicks.length===0||!!effect} onClick={()=>setTrainingPicks([])}
          className="min-h-[52px] px-4 rounded-2xl font-black text-[11px] bg-slate-800 text-slate-300 active:scale-95 disabled:opacity-30">選び直す</button>
        <button type="button" disabled={!ready||!!effect} onClick={()=>{const picks=trainingPicks; setTrainingPicks([]); handleTraining(picks);}}
          className={`min-h-[52px] rounded-2xl font-black text-base uppercase shadow-lg active:scale-95 transition-all ${ready&&!effect?'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]':'bg-slate-800 text-slate-600'}`}>{ready?'決定する':`あと${remaining}つ選ぶ`}</button>
      </div>
    </div>);
  
}

function ChampionScreen({
  autoRepeat, finalRewardSummary, masuRegisterButtonNode, openSpeciesChallengeSelection,
  resultActionPending, resultProcessing, returnToHome, runHighlights, runMode,
  runResultActionOnce, score, setAutoBattleEnabled, setAutoRepeatEnabled,
  setChampionPresentationComplete, speciesChallengeBattleRun, speciesChallengeClearCardNode,
  speciesChallengeFromDebugRef, speciesChallengeSaveRunRef,
}) {
  return (
<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,background:'linear-gradient(to bottom right,#fbbf24,#78350f)'}}><div className="shrink-0 flex flex-col items-center"><Crown size={64} className="text-white animate-bounce mb-3"/><h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1>{!isQuickMode(runMode)&&<div className="w-full max-w-xs bg-black/40 border border-white/20 rounded-3xl p-6 mb-3 mt-3 shadow-2xl"><div className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</div></div>}</div><div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto mh-scroll"><div className="m-auto w-full flex flex-col items-center">{masuRegisterButtonNode()}{speciesChallengeClearCardNode()}{finalRewardSummary&&<RewardSummaryCard key={resultProcessing?'locked':'ready'} summary={finalRewardSummary} onPresentationComplete={resultProcessing?undefined:()=>setChampionPresentationComplete(true)}/>}<div className="w-full max-w-xs mx-auto mt-3 text-left"><AssistantBubble scene="resultWin" condition={runHighlights.firstWin?'firstWin':runHighlights.newRecord?'newRecord':runHighlights.firstClear?'firstClear':null} compact/></div></div></div>{isQuickMode(runMode)&&autoRepeat&&<div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2"><button onClick={()=>setAutoRepeatEnabled(false)} className="min-h-[40px] rounded-xl bg-fuchsia-950/70 border border-fuchsia-300 text-fuchsia-100 text-xs font-black">∞周回 OFF</button><button onClick={()=>setAutoBattleEnabled(false)} className="min-h-[40px] rounded-xl bg-slate-900/70 border border-white/30 text-white text-xs font-black">AUTO OFF</button></div>}{/* 種族チャレンジは続けて別の種族・難易度へ挑みやすいよう、選択画面への導線を足す */}
{speciesChallengeBattleRun&&<button data-species-champion-back onClick={()=>{const keepSaving=speciesChallengeSaveRunRef.current;const keepDebug=speciesChallengeFromDebugRef.current;runResultActionOnce(()=>{returnToHome();openSpeciesChallengeSelection({saveProgress:keepSaving,fromDebug:keepDebug});});}} disabled={resultActionPending} className="w-full max-w-xs bg-cyan-700 text-white py-3.5 rounded-2xl font-black shrink-0 mt-2 disabled:opacity-50">種族チャレンジ選択へ戻る</button>}<button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} aria-busy={resultActionPending} className="w-full max-w-xs bg-white text-amber-900 py-4 rounded-3xl font-black text-xl uppercase shadow-2xl active:scale-95 transition-transform shrink-0 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">{resultActionPending?'処理中…':'HOMEへ'}</button></div>
  );
}

function GameOverScreen({
  finalRewardSummary, handleRetry, masuRegisterButtonNode, resultActionPending, returnToHome,
  runHighlights, runMode, runResultActionOnce, score,
}) {
  return (
<div className="mh-game-over-screen fixed inset-0 flex flex-col items-center text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="mh-game-over-head shrink-0 flex flex-col items-center"><Skull size={48} className="text-red-700 mb-3 animate-pulse"/><h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2>{!isQuickMode(runMode)&&<div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div>}</div><div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto mh-scroll"><div className="m-auto w-full flex flex-col items-center">{masuRegisterButtonNode()}{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}<div className="w-full max-w-xs mx-auto mt-3 text-left"><AssistantBubble scene="resultLose" condition={runHighlights.firstLose?'firstLose':null} compact/></div></div></div><div className="mh-game-over-actions flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={()=>runResultActionOnce(handleRetry)} disabled={resultActionPending} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><RotateCcw size={20}/> {resultActionPending?'処理中…':'再挑戦'}</button><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">トップへ</button></div></div>
  );
}

function GaveUpScreen({
  finalRewardSummary, handleRetry, masuRegisterButtonNode, resultActionPending, returnToHome,
  runMode, runResultActionOnce, score,
}) {
  return (
<div className="mh-game-over-screen fixed inset-0 flex flex-col items-center text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="mh-game-over-head shrink-0 flex flex-col items-center"><Flag size={48} className="text-slate-400 mb-3"/><h2 className="text-2xl font-black italic text-white uppercase">リタイア</h2>{!isQuickMode(runMode)&&<div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div>}</div><div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto mh-scroll"><div className="m-auto w-full flex flex-col items-center">{masuRegisterButtonNode()}{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}<div className="w-full max-w-xs mx-auto mt-3 text-left"><AssistantBubble scene="resultRetire" compact/></div></div></div><div className="mh-game-over-actions flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={()=>runResultActionOnce(handleRetry)} disabled={resultActionPending} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><RotateCcw size={20}/> {resultActionPending?'処理中…':'再挑戦'}</button><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">トップへ</button></div></div>
  );
}

function MasuRegisterModal({
  mainHero, masuNameInput, registerMasuMon, setMasuNameInput, setShowMasuRegisterModal,
}) {
  return (

    <div className="fixed inset-0 flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:90000}}>
      <div className="bg-slate-900 border-2 border-pink-500 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl mb-2">🐾</div>
          <h3 className="text-lg font-black text-white">マスモンとして登録</h3>
          <div className="text-[10px] text-slate-400 mt-1">名前を付けて保存すると、今回得た絆レベル・強化ポイントが引き継がれます。同じ種でも違う名前で複数登録できます。</div>
        </div>
        <input type="text" value={masuNameInput} onChange={e=>setMasuNameInput(e.target.value.slice(0,12))} placeholder={mainHero?.name||'名前'} maxLength={12} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-black focus:outline-none focus:border-pink-400"/>
        <div className="flex gap-2">
          <button onClick={()=>setShowMasuRegisterModal(false)} className="w-2/5 bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-xs uppercase active:scale-95">キャンセル</button>
          <button onClick={()=>{ registerMasuMon(masuNameInput); setShowMasuRegisterModal(false); }} className="w-3/5 bg-pink-600 text-white py-3 rounded-2xl font-black text-xs uppercase shadow-lg active:scale-95">登録する</button>
        </div>
      </div>
    </div>
  
  );
}
