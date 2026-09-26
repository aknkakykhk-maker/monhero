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
  canRecoverGutsWithPoint, continueAfterUniqueUpgrade, effectiveMaxGuts, guts, phasePlan,
  recoverGutsWithPoint, slots, tacticsUnits, uniqueUpgradeEntries, uniqueUpgradeRow, upgradePoints, wave,
}) {
  return (

    // mh-phase … 背の低い器(横持ち)で説明を畳む目印(70-bootstrap.jsx の @container)
    // mh-ph-* … タクティクス新盤面と同じ飾りの言葉(濃紺の地・金の縁・宝石)。--ph は画面の識別色
    <div style={{position:"absolute",inset:0,zIndex:30000,'--ph':'245,158,11'}} className="mh-phase mh-ph-bg absolute inset-0 z-[3000] flex flex-col items-center justify-start p-4 pt-3 text-center overflow-hidden">
      <div className="mb-2 shrink-0 w-full max-w-sm flex flex-col items-center gap-1.5">
        <div className="mh-ph-heading"><h2 className="mh-ph-title text-2xl font-black italic uppercase">固有技の強化</h2></div>
        {/* このあと何枚の画面を通ってバトルへ戻るのか */}
        {phasePlan&&<PhaseSteps plan={phasePlan} current="skill" nextWave={wave>0?wave+1:null}/>}
        {/* 残りポイントを大きく。★「Remaining Points: 数」の並びは検査が読む(大小は問わない) */}
        <div className="mh-ph-plate flex items-center justify-center gap-2 !tracking-normal">
          <span className="text-[9px] uppercase tracking-widest">Remaining Points: <b className="mh-ph-gem ml-1 h-8 w-8 align-middle font-mono text-[14px]"
            style={upgradePoints>0?{'--mh-rc':'245,158,11','--mh-rc2':'255,240,160'}:{'--mh-rc':'71,85,105','--mh-rc2':'203,213,225'}}>{upgradePoints}</b></span>
        </div>
        <p className="mh-phase-mid text-[10px] font-bold text-slate-400 leading-snug">ポイント1つで固有技が1段上がります。使わなかったポイントは次に持ち越せます</p>
      </div>
      {/* 強化ポイントのもう一つの使い道。技がすべてMAXでもポイントが無駄にならないよう、
          いまのガッツを戻せる。最大ガッツは増やさない。技の＋／－と違って取り消せないので、
          1回押すごとに確定する。技一覧を圧迫しないよう1行に収めている */}
      {(()=>{
        // ★タクティクスは1体ずつガッツを持つ(設計 4.4)。合計を出しても何の数字か読み取れないので、
        //   立っている子ごとに出す(2026-09-22 ユーザー指摘「クラシックをベースにしてるから
        //   そのへんごっちゃになってる」)。押せるかどうかは前から1体ずつで見ている
        const tacticsMode=Array.isArray(tacticsUnits);
        const gutsSlots=tacticsMode
          ? tacticsUnits.map((unit,index)=>(unit&&!unit.downed?index:-1)).filter(index=>index>=0) : [];
        const gutsFull=tacticsMode?!canRecoverGutsWithPoint&&upgradePoints>=GUTS_RECOVERY_POINT_COST:guts>=effectiveMaxGuts;
        const noPoint=upgradePoints<GUTS_RECOVERY_POINT_COST; return (
      <div data-guts-recovery className="mh-ph-panel w-full max-w-sm shrink-0 mb-2 px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0 text-left">
          <span className="mh-ph-panel-label block text-[8px] font-black leading-none">現在ガッツ</span>
          {tacticsMode
            ? <span data-tactics-guts-recovery className="block font-mono font-black leading-tight">
                {gutsSlots.length===0
                  ? <b className="text-slate-500" style={{fontSize:'12px'}}>立っている子がいません</b>
                  : gutsSlots.map(index=>{
                      const unit=tacticsUnits[index];
                      const full=unit.guts>=unit.maxGuts;
                      return (<span key={index} data-tactics-guts-slot={index} className="mr-2 inline-block whitespace-nowrap">
                        <span className="text-slate-500" style={{fontSize:'9px'}}>{slots?.[index]?.masuName||slots?.[index]?.name||RANGE_LABELS[index]} </span>
                        <b className={full?'text-amber-300':'text-white'} style={{fontSize:'13px'}}>{unit.guts}</b>
                        <span className="text-slate-500" style={{fontSize:'10px'}}>/{unit.maxGuts}</span>
                      </span>);
                    })}
              </span>
            : <span className="block font-mono font-black leading-tight">
                <b className={gutsFull?'text-amber-300':'text-white'} style={{fontSize:'17px'}}>{guts}</b>
                <span className="text-slate-500" style={{fontSize:'12px'}}> / {effectiveMaxGuts}</span>
              </span>}
        </div>
        <button type="button" data-guts-recovery-button
          disabled={!canRecoverGutsWithPoint}
          onClick={recoverGutsWithPoint}
          aria-label={`強化ポイント${GUTS_RECOVERY_POINT_COST}つでガッツを${GUTS_RECOVERY_AMOUNT}回復する`}
          className={`shrink-0 min-h-[44px] px-3 rounded-xl font-black leading-tight active:scale-95 ${canRecoverGutsWithPoint?'mh-ph-btn-gold':'mh-ph-btn-off'}`}>
          {gutsFull
            ? <span className="block" style={{fontSize:'13px'}}>MAX</span>
            : (<>
                <span className="block" style={{fontSize:'12px'}}>{GUTS_RECOVERY_POINT_COST}P で +{GUTS_RECOVERY_AMOUNT}</span>
                <span className="block opacity-80" style={{fontSize:'8px'}}>{noPoint?'ポイント不足':'ガッツ回復'}</span>
              </>)}
        </button>
      </div>);})()}
      <div className="w-full max-w-sm gap-2 mb-2 min-h-0 overflow-y-auto mh-scroll flex-1 p-1 flex flex-col justify-start">
        {uniqueUpgradeEntries().map((e,i)=><React.Fragment key={e.rowKey}><div style={{'--i':i}} className="contents">{uniqueUpgradeRow(e)}</div></React.Fragment>)}
      </div>
      {/* 次はアシストカードの画面。以前は「ブリーダー継承へ」と書いてあり、次の画面の名前と合っていなかった */}
      <button onClick={continueAfterUniqueUpgrade} className="mh-ph-btn-gold w-full max-w-sm min-h-[52px] rounded-2xl font-black active:scale-95 transition-transform mt-auto shrink-0 flex items-center justify-center gap-1">アシストカードへ<ChevronRight size={18}/></button>
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
  handleTraining, maxGuts, maxHp, phasePlan, runMode, setTrainingPicks, slots, tacticsUnits, trainingPicks, waveResult,
}) {

    const specialRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRun,extremeDifficulty);
    // 新モードは「居るモンスター個別に」選ぶ(2026-09-19 ユーザーが決めた形。設計 §4.5)。
    // trainingPicks は {slot,id} の並びになり、立っている子ごとに2回ずつ選ぶ。
    // ★タブは作らず、まだ選び終わっていない子へ自動で進む。押す回数を増やさないため
    const tacticsMode=Array.isArray(tacticsUnits);
    const trainableSlots=tacticsMode
      ? tacticsUnits.map((unit,index)=>(unit&&!unit.downed?index:-1)).filter(index=>index>=0) : [];
    const downedSlots=tacticsMode
      ? tacticsUnits.map((unit,index)=>(unit&&unit.downed?index:-1)).filter(index=>index>=0) : [];
    const picksOf=(slotIdx)=>trainingPicks.filter(entry=>entry&&entry.slot===slotIdx).map(entry=>entry.id);
    // ★まだ選び終わっていない子を指す。全員ぶん終わったら **最後の子を指したまま** 留まる。
    //   null へ落とすと、決定を押すまでのあいだ下の欄が baseStats のフォールバック
    //   (パーティ合計のライフ・ガッツ)へ戻り、選んだぶんの変化も消えてしまう
    //   (2026-09-22 ユーザー指摘「トレーニングを2回め選ぶとステがもとに戻る」)
    const pendingSlot=tacticsMode
      ? trainableSlots.find(index=>picksOf(index).length<TRAINING_PICK_COUNT) : undefined;
    const currentSlot=tacticsMode
      ? (pendingSlot!==undefined ? pendingSlot
        : (trainableSlots.length ? trainableSlots[trainableSlots.length-1] : null)) : null;
    // カードを押せるのは「まだ選び終わっていない子」がいるときだけ。指す先を残しても、
    // 選び終わった子へ3つ目を積めてしまってはいけない
    const pickable=!tacticsMode||pendingSlot!==undefined;
    const currentUnit=currentSlot!=null?tacticsUnits[currentSlot]:null;
    const currentName=currentSlot!=null
      ? (slots?.[currentSlot]?.masuName||slots?.[currentSlot]?.name||`${currentSlot+1}番目の子`) : '';
    const activePicks=tacticsMode?(currentSlot!=null?picksOf(currentSlot):[]):trainingPicks;
    const baseStats=currentUnit
      ? {atk:currentUnit.atk,def:currentUnit.def,hp:currentUnit.baseMaxHp,guts:currentUnit.baseMaxGuts}
      : {atk,def,hp:maxHp,guts:maxGuts};
    // いま選んでいるぶんまでを適用した値。次の1回はこの値からさらに伸びる
    const current=resolveTrainingStats(baseStats,activePicks,waveResult?.turn,specialRule,runMode);
    const remaining=TRAINING_PICK_COUNT-activePicks.length;
    const ready=tacticsMode
      ? (trainableSlots.length>0&&trainableSlots.every(index=>picksOf(index).length===TRAINING_PICK_COUNT))
      : trainingPicks.length===TRAINING_PICK_COUNT;
    const doneSlots=tacticsMode?trainableSlots.filter(index=>picksOf(index).length===TRAINING_PICK_COUNT).length:0;
    // 枠の色と模様は data-ph-kind(70-bootstrap.jsx の mh-ph-*)が持つ。ここは文字の色と伸び幅の棒だけ。
    // 選ぶ前から4項目を色で見分けられるようにする(以前は選ぶまで4枚とも同じ灰色だった)
    const STYLES={
      hp:  {icon:<Heart size={18}/>,       tint:'text-pink-300',    bar:'bg-pink-400'},
      atk: {icon:<Sword size={18}/>,       tint:'text-red-300',     bar:'bg-red-400'},
      def: {icon:<ShieldCheck size={18}/>, tint:'text-emerald-300', bar:'bg-emerald-400'},
      guts:{icon:<Sparkles size={18}/>,    tint:'text-amber-300',   bar:'bg-amber-400'},
    };
    const trainingOptions=trainingOptionsFor(runMode);
    const optionById=(id)=>trainingOptions.find(option=>option.id===id);
    const unitName=(slotIdx)=>slots?.[slotIdx]?.masuName||slots?.[slotIdx]?.name||`${slotIdx+1}番目の子`;
    // 「1回目」「2回目」の枠を押すと、その1回だけを取り消す。以前は「選び直す」で
    // 2つとも消すしかなく、2回目だけ変えたいときも1回目から選び直していた
    const removePick=(index)=>setTrainingPicks(prev=>{
      if(!tacticsMode) return prev.filter((_,i)=>i!==index);
      let seen=-1;
      return prev.filter(entry=>{
        if(!entry||entry.slot!==currentSlot) return true;
        seen+=1;
        return seen!==index;
      });
    });
    return (
    // mh-phase … 器の高さで中身を畳む目印(70-bootstrap.jsx の @container)
    // mh-ph-* … タクティクス新盤面と同じ飾りの言葉(濃紺の地・金の縁・回る光の縁・宝石)。--ph は画面の識別色
    <div style={{position:"absolute",inset:0,zIndex:30000,'--ph':'251,191,36'}} className="mh-phase mh-ph-bg absolute inset-0 z-[3000] flex flex-col items-center p-3 overflow-hidden" data-screen="training">
      <div className="shrink-0 w-full max-w-sm" style={{paddingTop:'calc(.25rem + env(safe-area-inset-top))'}}>
        {/* どのWAVEを抜けたごほうびなのかを見出しの上に出す */}
        {waveResult?.wave>0&&<div className="mb-1 flex justify-center">
          <span className="mh-ph-plate">WAVE {waveResult.wave} CLEAR</span>
        </div>}
        <div className="mh-ph-heading">
          <Trophy className="text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,.7)]" size={22}/>
          <h2 className="mh-ph-title text-2xl font-black italic uppercase tracking-tighter leading-none">トレーニング</h2>
        </div>
        {/* このあと何枚の画面を通ってバトルへ戻るのか */}
        {phasePlan&&<PhaseSteps plan={phasePlan} current="training" nextWave={waveResult?.wave>0?waveResult.wave+1:null} className="mt-1.5"/>}
        {/* 「4種類から2つ選ぶ」ことと、いま何を選んだかを一目で分かるようにする。
            点だけだと何を選んだのかは各カードの×1を探すしかなかったので、枠に中身を入れる */}
        <div className="mh-phase-tall mt-1.5 text-center text-[10px] font-black text-slate-300">{tacticsMode?(pickable?`${currentName||'全員'}のトレーニング`:'全員ぶん決まりました'):'4種類から2つ選ぶ'}</div>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          {Array.from({length:TRAINING_PICK_COUNT}).map((_,i)=>{
            const picked=optionById(activePicks[i]);
            const st=picked?(STYLES[picked.id]||STYLES.hp):null;
            if(!picked) return (
              <span key={i} className="mh-ph-step-todo flex min-w-0 items-center gap-1 rounded-full border-dashed px-2 py-1 text-[10px] font-black" style={{maxWidth:'42%'}}>
                <span className="shrink-0 text-[9px] text-slate-400">{i+1}回目</span><span>―</span>
              </span>
            );
            return (
              <button key={`${i}-${picked.id}`} type="button" disabled={!!effect} onClick={()=>removePick(i)}
                aria-label={`${i+1}回目の${picked.name}を取り消す`}
                data-ph-kind={picked.id} data-ph-on=""
                className="mh-phase-pop mh-ph-frame flex min-w-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black text-white active:scale-95 disabled:opacity-40" style={{maxWidth:'42%'}}><i aria-hidden="true" className="mh-ph-ring"/>
                <span className="shrink-0 text-[9px] text-slate-300">{i+1}回目</span>
                <span className={`shrink-0 ${st.tint}`}>{cardIconNode(st.icon)}</span><span className="truncate">{picked.name}</span>
                <span aria-hidden="true" className="shrink-0 text-[10px] text-slate-300">×</span>
              </button>
            );
          })}
          <span className="shrink-0 text-[11px] font-black font-mono text-[#f3d27a]">{activePicks.length} / {TRAINING_PICK_COUNT}</span>
        </div>
        {/* 何体ぶん終わったか。1体ずつ選ぶので、どこまで進んだのかが分からないと迷子になる。
            名前の札を並べ、いま選んでいる子を光らせる */}
        {tacticsMode&&<div data-tactics-training-progress={`${doneSlots}/${trainableSlots.length}`}
          className="mt-1.5 flex flex-wrap items-center justify-center gap-1 text-center text-[10px] font-black text-indigo-300">
          <span className="shrink-0">{doneSlots} / {trainableSlots.length} 体ぶん決定ずみ</span>
          {trainableSlots.length>1&&<>
            {trainableSlots.map(slotIdx=>{
              const count=picksOf(slotIdx).length;
              const done=count>=TRAINING_PICK_COUNT;
              const active=slotIdx===currentSlot&&pickable;
              return (
                <span key={slotIdx} className={`flex max-w-[32%] items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${active?'mh-ph-step-now':done?'border-emerald-400/60 bg-emerald-950/60 text-emerald-200':'mh-ph-step-todo'}`}>
                  <span className="truncate">{unitName(slotIdx)}</span>
                  <span className="shrink-0 font-mono">{done?'✓':`${count}/${TRAINING_PICK_COUNT}`}</span>
                </span>
              );
            })}
          </>}
        </div>}
        {extremeRuleNumber(specialRule,'awakeningZeroTurns')!=null&&(()=>{
          const turns=waveResult?.turn||0;
          // 低下は増加量へ掛かるので、率から引いた「-○pt」ではなく倍率で出す
          const gainRate=trainingGainRate(turns,specialRule);
          return <div data-ultimate-training-status={specialRule} className="mt-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-center text-[9px] font-black text-purple-100"><span className="text-amber-300">{specialRule}補正</span>　今回{turns}T → 強化量 {compactPercent(gainRate)}（-{compactPercent(1-gainRate)}）</div>;
        })()}
        {specialRule==='NIGHTMARE'&&<div data-nightmare-training-status className="mt-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-center text-[9px] font-black text-purple-100"><span className="text-amber-300">NIGHTMARE補正</span>　強化量 {specialRulePercent(extremeSpecialRule(specialRule,'waveEnhancement'))}</div>}
      </div>
      <div className={`${tacticsMode?'mh-phase-mid':'mh-phase-tall'} shrink-0 w-full max-w-sm mt-2 text-left`}><AssistantBubble scene="rewardPick" compact/></div>
      {/* いま選んでいるぶんを反映した4ステータス。選ぶ前は現在値だけ、選ぶと増える量も出る。
          各項目のカードは自分のステータスしか出さないので、ここで全体を見比べられるようにする */}
      {(!tacticsMode||currentUnit)&&<div className="mh-phase-tall mh-ph-panel shrink-0 w-full max-w-sm px-2 py-1.5 mt-2" data-training-status>
        <div className="mh-ph-panel-label text-[8px] font-black text-left mb-1">現在のステータス{trainingPicks.length>0&&<span className="text-amber-300">（選択中の変化）</span>}</div>
        <div className="grid grid-cols-4 gap-1">
          {trainingOptions.map(option=>{
            const st=STYLES[option.id]||STYLES.hp;
            const beforeAll=baseStats[option.stat];
            const afterAll=current[option.stat];
            const diff=afterAll-beforeAll;
            return (
              <div key={option.id} className="mh-ph-cell rounded-lg px-1 py-1 text-center">
                <span className="block text-[8px] font-black text-slate-400 leading-none">{option.statLabel}</span>
                <span className={`block text-[13px] font-black font-mono leading-tight ${diff>0?st.tint:'text-slate-300'}`}>{afterAll}</span>
                <span className={`block text-[8px] font-black font-mono leading-none ${diff>0?'text-emerald-400':'text-slate-700'}`}>{diff>0?`+${diff}`:'±0'}</span>
              </div>
            );
          })}
        </div>
      </div>}
      {/* 4項目。1画面に収めるため2列2行。空きがあればカードが伸びて画面を埋める。
          同じ項目をもう一度タップすると2回目として積める */}
      <div className={`mh-phase-cards w-full max-w-sm mt-2 grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0 overflow-y-auto mh-scroll${battleTutorialSpotClass('rewards')}`}>
        {trainingOptions.map((option,optionIndex)=>{
          const count=activePicks.filter(id=>id===option.id).length;
          const st=STYLES[option.id]||STYLES.hp;
          const before=current[option.stat];
          const after=resolveTrainingStep(current,option.id,waveResult?.turn,specialRule,runMode)[option.stat];
          const full=remaining<=0;
          return (
            <button key={option.id} type="button" disabled={full||!!effect||!pickable}
              onClick={()=>setTrainingPicks(prev=>{
                if(!tacticsMode) return prev.length>=TRAINING_PICK_COUNT?prev:[...prev,option.id];
                if(!pickable||currentSlot==null) return prev;
                if(prev.filter(entry=>entry&&entry.slot===currentSlot).length>=TRAINING_PICK_COUNT) return prev;
                return [...prev,{slot:currentSlot,id:option.id}];
              })}
              aria-label={`${option.name} ${option.effect}${count>0?` 選択中${count}回`:''}`}
              data-ph-kind={option.id} data-ph-on={count>0?'':undefined}
              className="mh-phase-card mh-phase-enter mh-ph-frame relative min-h-[112px] overflow-hidden rounded-2xl border-2 p-2.5 flex flex-col items-stretch gap-1.5 text-left transition-all active:scale-95 disabled:opacity-40"
              style={{'--i':optionIndex}}><i aria-hidden="true" className="mh-ph-ring"/>
              {/* 地の光の粒と、選んだ枠を横切る光の筋(飾り。押す範囲や文字には関わらない) */}
              <span aria-hidden="true" className="mh-ph-sparkle"/>
              {count>0&&<span aria-hidden="true" className="mh-ph-shine"/>}
              {/* ★ボタンの文字は項目名から始める(検査がボタンを「^走り込み」で探す)。
                  アイコンは絵だけなので前に置いても文字には入らない */}
              <span className="relative flex items-center gap-2">
                <span className={`mh-phase-card-icon mh-ph-medal shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${st.tint}`}>{cardIconNode(st.icon)}</span>
                <span className="min-w-0">
                  <b className="mh-phase-card-name block text-[14px] font-black text-white leading-tight">{option.name}</b>
                  <span className={`block text-[10px] font-black ${st.tint} leading-tight`}>{option.effect}{(extremeRuleNumber(specialRule,'awakeningZeroTurns')!=null||extremeRuleNumber(specialRule,'waveEnhancement')!=null)&&(()=>{
                    const normalAfter=resolveTrainingStep(current,option.id,waveResult?.turn,null,runMode)[option.stat];
                    const effectiveAfter=resolveTrainingStep(current,option.id,waveResult?.turn,specialRule,runMode)[option.stat];
                    const normalGain=normalAfter-current[option.stat],effectiveGain=effectiveAfter-current[option.stat];
                    return <span className="block text-purple-200">通常 +{normalGain} → 実際 +{effectiveGain}</span>;
                  })()}</span>
                </span>
              </span>
              {/* いちばん知りたい「どれだけ伸びるか」を大きく出す。カードが縦に伸びたぶんの空きもここで埋まる */}
              <span className="relative flex flex-1 items-center justify-center font-mono font-black leading-none">
                <span className={`mh-phase-gain ${after>before?st.tint:'text-slate-500'}`} style={after>before?{textShadow:'0 0 14px rgba(var(--mh-rc),.75), 0 2px 0 rgba(0,0,0,.7)'}:undefined}>+{Math.max(0,after-before)}</span>
              </span>
              <span className="mh-ph-cell relative w-full rounded-lg px-1.5 py-1 font-mono leading-tight">
                <span className="flex items-baseline justify-between gap-1">
                  <span className="mh-phase-stat-label text-[8px] text-slate-500 font-black">{option.statLabel}</span>
                  <span className="mh-phase-card-nums whitespace-nowrap text-[11px] font-black text-slate-300">{before} <span className="text-slate-600">→</span> <b className={st.tint}>{after}</b></span>
                </span>
                {/* 伸びる前の値を灰色、伸びるぶんを項目の色で塗った棒 */}
                <span className="mh-phase-bar mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <span className="h-full bg-slate-500" style={{width:`${after>0?Math.max(0,Math.min(100,before/after*100)):0}%`}}/>
                  <span className={`h-full ${st.bar}`} style={{width:`${after>0?Math.max(0,Math.min(100,(after-before)/after*100)):0}%`}}/>
                </span>
              </span>
              {/* 何回選んだかを ×1 / ×2 で明確に出す */}
              {count>0&&<span key={`count-${count}`} className="mh-phase-pop mh-phase-count mh-ph-gem absolute top-1.5 right-1.5 h-7 w-8 text-[11px]">×{count}</span>}
            </button>
          );
        })}
      </div>
      {/* 倒れた子はここで起こせる。★起こすとそのWAVEは誰も強化できない(ユーザーが決めた形) */}
      {tacticsMode&&downedSlots.length>0&&(
        <div data-tactics-training-revive className="shrink-0 w-full max-w-sm mt-2 space-y-1">
          {downedSlots.map(slotIdx=>(
            <button key={slotIdx} type="button" disabled={!!effect}
              onClick={()=>{setTrainingPicks([]); handleTraining({revive:slotIdx});}}
              data-ph-kind="revive"
              className="mh-ph-frame w-full min-h-[44px] rounded-2xl border-2 px-3 text-left font-black text-emerald-200 active:scale-95 disabled:opacity-40">
              <span className="block text-[12px] leading-tight">{slots?.[slotIdx]?.masuName||slots?.[slotIdx]?.name||`${slotIdx+1}番目の子`}を起こす<span className="text-[9px] font-black text-emerald-400/90">　このWAVEの強化はなし</span></span>
            </button>
          ))}
        </div>
      )}
      {/* 決定は2回そろうまで押せない。確定前ならいつでも選び直せる */}
      <div className="shrink-0 w-full max-w-sm mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-2" style={{paddingBottom:'calc(.25rem + env(safe-area-inset-bottom))'}}>
        <button type="button" disabled={trainingPicks.length===0||!!effect} onClick={()=>setTrainingPicks([])}
          className="mh-ph-btn min-h-[52px] px-4 rounded-2xl font-black text-[11px] active:scale-95 disabled:opacity-30">選び直す</button>
        <button type="button" disabled={!ready||!!effect} onClick={()=>{const picks=trainingPicks; setTrainingPicks([]); handleTraining(picks);}}
          className={`min-h-[52px] rounded-2xl font-black text-base uppercase active:scale-95 transition-all ${ready&&!effect?'mh-phase-ready mh-ph-btn-gold':'mh-ph-btn-off'}`}>{ready?'決定する':`あと${remaining}つ選ぶ`}</button>
      </div>
    </div>);
  
}

// 全国ランキングへ送れなかったときのお知らせ。
// これまでは console にだけ出ていて、プレイヤーからは成功と区別がつかなかった
// (rankings.score が int4 だったころ、約450億のスコアが黙って弾かれていた)。
// 記録は端末に残していて、次にHOMEへ戻ったとき自動で送り直す。
function RankingFailedNote() {
  return (
    <div className="w-full max-w-xs mx-auto mt-3 rounded-2xl border border-amber-300/60 bg-amber-950/40 px-3 py-2 text-left">
      <div className="text-[11px] font-black text-amber-200">全国ランキングへ送れませんでした</div>
      <div className="mt-0.5 text-[10px] leading-relaxed text-amber-100/80">
        記録は端末に残してあります。次にトップ画面へ戻ったとき、自動でもう一度送ります。
        自己ベストや報酬はいつもどおり反映されています。
      </div>
    </div>
  );
}

function ChampionScreen({
  autoRepeat, finalRewardSummary, masuRegisterButtonNode, openSpeciesChallengeSelection,
  resultActionPending, resultProcessing, returnToHome, runHighlights, runMode,
  runResultActionOnce, score, setAutoBattleEnabled, setAutoRepeatEnabled,
  setChampionPresentationComplete, speciesChallengeBattleRun, speciesChallengeClearCardNode,
  speciesChallengeFromDebugRef, speciesChallengeSaveRunRef, speciesChallengeBattleRunRef,
}) {
  return (
<div className="fixed inset-0 flex flex-col items-center p-6 text-center" style={{position:'fixed',inset:0,zIndex:80000,background:'linear-gradient(to bottom right,#fbbf24,#78350f)'}}><div className="shrink-0 flex flex-col items-center"><Crown size={64} className="text-white animate-bounce mb-3"/><h1 className="text-3xl font-black italic text-white uppercase">CHAMPION</h1>{!isQuickMode(runMode)&&<div className="w-full max-w-xs bg-black/40 border border-white/20 rounded-3xl p-6 mb-3 mt-3 shadow-2xl"><div className="text-5xl font-mono font-black text-white">{score.toLocaleString()}</div></div>}</div><div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto mh-scroll"><div className="m-auto w-full flex flex-col items-center">{masuRegisterButtonNode()}{speciesChallengeClearCardNode()}{finalRewardSummary&&<RewardSummaryCard key={resultProcessing?'locked':'ready'} summary={finalRewardSummary} onPresentationComplete={resultProcessing?undefined:()=>setChampionPresentationComplete(true)}/>}{runHighlights.rankingFailed&&<RankingFailedNote/>}<div className="w-full max-w-xs mx-auto mt-3 text-left"><AssistantBubble scene="resultWin" condition={runHighlights.firstWin?'firstWin':runHighlights.newRecord?'newRecord':runHighlights.firstClear?'firstClear':null} compact/></div></div></div>{isQuickMode(runMode)&&autoRepeat&&<div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2"><button onClick={()=>setAutoRepeatEnabled(false)} className="min-h-[40px] rounded-xl bg-fuchsia-950/70 border border-fuchsia-300 text-fuchsia-100 text-xs font-black">∞周回 OFF</button><button onClick={()=>setAutoBattleEnabled(false)} className="min-h-[40px] rounded-xl bg-slate-900/70 border border-white/30 text-white text-xs font-black">AUTO OFF</button></div>}{/* 種族チャレンジは続けて別の種族・難易度へ挑みやすいよう、選択画面への導線を足す */}
{speciesChallengeBattleRun&&<button data-species-champion-back onClick={()=>{const keepSaving=speciesChallengeSaveRunRef.current;const keepDebug=speciesChallengeFromDebugRef.current;const keepMode=speciesChallengeRunMode(speciesChallengeBattleRunRef.current);runResultActionOnce(()=>{returnToHome();openSpeciesChallengeSelection({saveProgress:keepSaving,fromDebug:keepDebug,mode:keepMode});});}} disabled={resultActionPending} className="w-full max-w-xs bg-cyan-700 text-white py-3.5 rounded-2xl font-black shrink-0 mt-2 disabled:opacity-50">種族チャレンジ選択へ戻る</button>}<button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} aria-busy={resultActionPending} className="w-full max-w-xs bg-white text-amber-900 py-4 rounded-3xl font-black text-xl uppercase shadow-2xl active:scale-95 transition-transform shrink-0 mt-2 disabled:opacity-50 disabled:cursor-not-allowed">{resultActionPending?'処理中…':'HOMEへ'}</button></div>
  );
}

function GameOverScreen({
  finalRewardSummary, handleRetry, masuRegisterButtonNode, resultActionPending, returnToHome,
  runHighlights, runMode, runResultActionOnce, score,
}) {
  return (
<div className="mh-game-over-screen fixed inset-0 flex flex-col items-center text-center" style={{position:'fixed',inset:0,zIndex:80000,backgroundColor:'rgba(0,0,0,0.97)'}}><div className="mh-game-over-head shrink-0 flex flex-col items-center"><Skull size={48} className="text-red-700 mb-3 animate-pulse"/><h2 className="text-2xl font-black italic text-white uppercase">敗 北</h2>{!isQuickMode(runMode)&&<div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-3 mt-3 w-full max-w-xs"><div className="text-3xl font-mono font-black text-white">{score.toLocaleString()}</div></div>}</div><div className="flex-1 min-h-0 w-full flex flex-col items-center overflow-y-auto mh-scroll"><div className="m-auto w-full flex flex-col items-center">{masuRegisterButtonNode()}{finalRewardSummary&&<RewardSummaryCard summary={finalRewardSummary}/>}{runHighlights.rankingFailed&&<RankingFailedNote/>}<div className="w-full max-w-xs mx-auto mt-3 text-left"><AssistantBubble scene="resultLose" condition={runHighlights.firstLose?'firstLose':null} compact/></div></div></div><div className="mh-game-over-actions flex flex-col gap-3 w-full max-w-xs shrink-0 mt-2"><button onClick={()=>runResultActionOnce(handleRetry)} disabled={resultActionPending} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg uppercase shadow-2xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><RotateCcw size={20}/> {resultActionPending?'処理中…':'再挑戦'}</button><button onClick={()=>runResultActionOnce(returnToHome)} disabled={resultActionPending} className="w-full bg-slate-800 text-slate-400 py-3 rounded-2xl font-black text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed">トップへ</button></div></div>
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
