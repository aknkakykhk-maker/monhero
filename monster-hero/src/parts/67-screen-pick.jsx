// ==== 画面: ラン開始まわりのえらぶ画面(スキップ / 勇者モン・供モンえらび) ====
//
// MonsterHeroGame から切り出した17本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-11)。
// スキップ券の一連(えらぶ→最終確認→専用リザルト)と、ランの中でモンスターを選ぶ4画面。
//
// 【この一群ならではの注意】
// ・勇者モンえらび(PICK_HERO)と供モンえらび(PICK_ALLY)は元から1つのブロックで、
//   中で 21 箇所ぶん出し分けている。画面は gameState を知らない約束(ui/screen-parts-check)なので、
//   出し分けは pickMode('hero' / 'ally')という props に置き換えてある。**条件の綴りだけの違い**で、
//   要素・文言・並びは1文字も変えていない
// ・スキップの最終確認(SkipConfirmDialog)は gameState を持たない兄弟ブロック。
//   置き去りにすると「えらぶ画面だけ移って確認が本体に残る」ことになるので一緒に持ってくる
// ・進行フラグを戻すタイマー(SCREEN_EFFECTS_MAP.md の「進行」)は、この一群では
//   すべてハンドラの中にあり本体へ残る。画面の中に setTimeout は1つも無い
function SkipPickScreen({
  changeSkipCount, closeBattleSkip, difficulty, getActiveMonsterList, getMasuBondLevel,
  getUnlockedBaseMonsterList, ownedItems, setSkipConfirmOpen, setSkipPickTab, skipClearSlot,
  skipFlow, skipFlowCount, skipMaxCount, skipMonKey, skipPickMon, skipPickTab,
}) {

    const item=BREEDER_MARKET_ITEMS.find(i=>i.id===skipFlow.itemId);
    const label=DIFFICULTY_SETTINGS[skipFlow.difficulty]?.label||skipFlow.difficulty;
    const list=skipPickTab==='base'?getUnlockedBaseMonsterList():getActiveMonsterList();
    const chosen=[skipFlow.hero,...(skipFlow.allies||[])].filter(Boolean);
    const chosenKeys=new Set(chosen.map(skipMonKey));
    const slotLabels=['勇者モン','供モン1','供モン2','供モン3'];
    const slotMons=[skipFlow.hero,...(skipFlow.allies||[])];
    return(
    <div style={{position:'absolute',inset:0,backgroundColor:'#020617',zIndex:30000}} className="absolute inset-0 p-4 pt-6 flex flex-col overflow-hidden">
      <div className="mb-2 flex items-center justify-between px-2 shrink-0"><button onClick={closeBattleSkip} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-lg font-black italic text-teal-400 uppercase tracking-widest">スキップ・{label}</h2><div className="w-10"/></div>
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="skipPick" compact/></div>
      <div className="w-full max-w-md mx-auto shrink-0">
        <div className="grid grid-cols-4 gap-1.5">
          {slotLabels.map((sl,idx)=>{const mon=slotMons[idx];return(
            <button key={sl} disabled={!mon} onClick={()=>skipClearSlot(idx)} className={`rounded-2xl border-2 p-1.5 flex flex-col items-center gap-1 ${mon?'border-teal-400 bg-teal-950/50 active:scale-95':'border-dashed border-slate-700 bg-slate-900/50'}`}>
              <span className={`text-[7px] font-black uppercase ${idx===0?'text-amber-300':'text-slate-400'}`}>{sl}</span>
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/10 flex items-center justify-center bg-black/30">{mon?(mon.imgUrl?<DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={mon.name} masuColors={mon.colors} className="w-full h-full object-contain"/>:<span className="text-lg">{mon.emoji}</span>):<span className="text-slate-600 text-lg">＋</span>}</div>
              <span className="text-[8px] font-black text-white truncate w-full text-center">{mon?mon.name:'未選択'}</span>
            </button>);})}
        </div>
        <div className="text-[9px] text-slate-500 font-bold mt-1 px-1 text-center">上のわくをタップすると外せます。絆経験値が入るのはマスモンだけです</div>
        <div className="flex gap-1.5 mt-2">
          {[['roster','編成'],['base','ベースモン']].map(([key,tabLabel])=>(
            <button key={key} onClick={()=>setSkipPickTab(key)} aria-pressed={skipPickTab===key} className={`flex-1 min-h-[38px] rounded-2xl font-black text-[12px] border-2 active:scale-95 ${skipPickTab===key?'bg-teal-600 border-teal-300 text-white':'bg-slate-900 border-slate-700 text-slate-400'}`}>{tabLabel}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto min-h-0 mt-2">
        <div className="grid grid-cols-3 gap-2 pb-4">
          {list.map(mon=>{const used=chosenKeys.has(skipMonKey(mon)); const full=chosen.length>=4; return(
            <button key={skipMonKey(mon)} disabled={used||full} onClick={()=>skipPickMon(mon)} className={`rounded-2xl border-2 p-2 flex flex-col items-center gap-1 ${used?'border-teal-500 bg-teal-950/40 opacity-50':'border-slate-800 bg-slate-900 active:scale-95'} disabled:opacity-40`}>
              <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 flex items-center justify-center bg-black/30">{mon.imgUrl?<DyedMonsterImage baseId={mon.id} src={mon.imgUrl} alt={mon.name} masuColors={mon.colors} className="w-full h-full object-contain"/>:<span className="text-2xl">{mon.emoji}</span>}</div>
              <div className="text-[9px] font-black text-white truncate w-full text-center">{mon.name}</div>
              <div className="text-[7px] font-black">{mon.masuId?<span className="text-pink-300">絆Lv.{getMasuBondLevel(mon.masuId).level}</span>:<span className="text-slate-500">マスモン未登録</span>}</div>
            </button>);})}
        </div>
      </div>
      <div className="w-full max-w-md mx-auto shrink-0 pt-2">
        <div className="text-[10px] text-slate-400 font-bold text-center mb-1">{item?.name} 所持数 {ownedItems[skipFlow.itemId]||0} 枚</div>
        {/* まとめて使う枚数。1周ぶんの報酬×枚数をまとめて受け取れる */}
        {(()=>{const max=skipMaxCount(skipFlow.itemId);const n=skipFlowCount();return(
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-slate-400 shrink-0">使う枚数</span>
            <button disabled={n<=1} onClick={()=>changeSkipCount(n-1)} aria-label="使う枚数を1枚減らす" className="shrink-0 w-11 h-11 rounded-xl bg-slate-800 text-white font-black text-lg active:scale-95 disabled:opacity-30">−</button>
            <div className="flex-1 text-center"><span className="font-mono font-black text-white text-lg">{n}</span><span className="text-[10px] font-black text-slate-400"> / {max}枚</span></div>
            <button disabled={n>=max} onClick={()=>changeSkipCount(n+1)} aria-label="使う枚数を1枚増やす" className="shrink-0 w-11 h-11 rounded-xl bg-slate-800 text-white font-black text-lg active:scale-95 disabled:opacity-30">＋</button>
            <button disabled={n>=max} onClick={()=>changeSkipCount(max)} className="shrink-0 h-11 px-3 rounded-xl bg-slate-700 text-white font-black text-[11px] active:scale-95 disabled:opacity-30">全部</button>
          </div>
        );})()}
        <button disabled={!skipFlow.hero} onClick={()=>setSkipConfirmOpen(true)} className="w-full min-h-[52px] rounded-2xl bg-teal-600 text-white font-black text-sm uppercase shadow-lg active:scale-[.98] disabled:bg-slate-800 disabled:text-slate-500">決定</button>
      </div>
    </div>);
}

function SkipConfirmDialog({
  difficulty, executeBattleSkip, ownedItems, setSkipConfirmOpen, skipFlow, skipFlowCount,
}) {
const item=BREEDER_MARKET_ITEMS.find(i=>i.id===skipFlow.itemId); const useCount=skipFlowCount(); return(
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.92)',zIndex:41000}} role="dialog" aria-modal="true">
      <div className="bg-slate-900 border-2 border-teal-500 rounded-3xl p-5 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-2">{item?.emoji}</div>
        <h3 className="text-base font-black text-white mb-1">{item?.name}を{useCount}枚使いますか？</h3>
        <div className="text-[11px] text-slate-400 font-bold mb-2">{DIFFICULTY_SETTINGS[skipFlow.difficulty]?.label} を最後まで進めた扱いで、経験値とダイヤを{useCount}周ぶん受け取ります</div>
        <div className="text-[11px] font-black text-teal-200 bg-black/40 border border-teal-500/30 rounded-xl py-2 mb-4">所持数 {ownedItems[skipFlow.itemId]||0}枚 → {Math.max(0,(ownedItems[skipFlow.itemId]||0)-useCount)}枚</div>
        <div className="flex gap-2">
          <button onClick={()=>setSkipConfirmOpen(false)} className="w-2/5 bg-slate-800 text-slate-300 py-3.5 rounded-2xl font-black text-sm">いいえ</button>
          <button onClick={executeBattleSkip} className="w-3/5 bg-teal-600 text-white py-3.5 rounded-2xl font-black text-sm shadow-lg active:scale-95">はい</button>
        </div>
      </div>
    </div>);
}

function SkipResultScreen({
  difficulty, onClose, ownedItems, skipAnimPhase, skipResult,
}) {
  return (

    <div style={{position:'absolute',inset:0,backgroundColor:'#020617',zIndex:30000}} className="absolute inset-0 p-4 pt-6 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto mh-scroll w-full max-w-sm mx-auto">
        <div className="text-center py-4">
          <div className="text-5xl mb-1" style={{animation:'idleSpark 900ms ease-in-out infinite'}}>{skipResult.itemEmoji}</div>
          <div className="text-[10px] font-black tracking-[.3em] text-teal-400 uppercase">Skip Complete</div>
          <div className="w-full max-w-sm mx-auto mt-3 text-left"><AssistantBubble scene="skipResult" compact/></div>
          <h2 className="text-2xl font-black italic text-white mt-1">{DIFFICULTY_SETTINGS[skipResult.difficulty]?.label} 突破！</h2>
          <div className="text-[10px] text-slate-400 font-bold mt-1">{skipResult.itemName} を{skipResult.count||1}枚使いました（残り {ownedItems[skipResult.itemId]||0}枚）</div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-teal-400 flex items-center justify-center bg-black/40">{skipResult.heroImgUrl?<DyedMonsterImage baseId={skipResult.heroBaseId} src={skipResult.heroImgUrl} alt={skipResult.heroName} masuColors={skipResult.heroColors} className="w-full h-full object-contain"/>:<span className="text-3xl">{skipResult.heroEmoji}</span>}</div>
            <div className="text-left"><div className="text-[9px] text-slate-500 font-black uppercase">勇者モン</div><div className="text-sm font-black text-white">{skipResult.heroName}</div></div>
          </div>
        </div>
        <div className={`space-y-2 transition-all duration-500 ${skipAnimPhase>0?'opacity-100 translate-y-0':'opacity-0 translate-y-3'}`}>
          <div className="bg-black/40 rounded-2xl border border-amber-500/30 p-3 flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-300 flex items-center gap-1"><Sparkles size={13}/>ダイヤ</span>
            <span className="font-mono font-black text-white text-sm">{skipResult.goldBefore.toLocaleString()} → {skipResult.goldAfter.toLocaleString()} <span className="text-amber-300">(+{skipResult.goldGain.toLocaleString()})</span></span>
          </div>
          <div className="bg-black/40 rounded-2xl border border-indigo-500/30 p-3">
            <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-black text-indigo-300">ブリーダー経験値</span><span className="font-mono font-black text-white text-sm">+{skipResult.breederXpGain.toLocaleString()}</span></div>
            <LevelGrowthBar levelBefore={skipResult.breederLevelBefore} levelAfter={skipResult.breederLevelAfter}/>
            {skipResult.breederLevelAfter.level>skipResult.breederLevelBefore.level&&(<div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>ブリーダーポイント +{skipResult.breederLevelAfter.level-skipResult.breederLevelBefore.level}</div>)}
          </div>
          {skipResult.heroBondGain?(
            <div className="bg-black/40 rounded-2xl border border-pink-500/30 p-3">
              <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-black text-pink-300 flex items-center gap-1 truncate"><Heart size={13}/>絆レベル：{skipResult.heroBondGain.name}</span><span className="font-mono font-black text-white text-sm shrink-0">+{skipResult.heroBondGain.xpGain.toLocaleString()}</span></div>
              <LevelGrowthBar levelBefore={skipResult.heroBondGain.levelBefore} levelAfter={skipResult.heroBondGain.levelAfter}/>
              {skipResult.heroBondGain.levelAfter.level>skipResult.heroBondGain.levelBefore.level&&(<div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{skipResult.heroBondGain.levelAfter.level-skipResult.heroBondGain.levelBefore.level}</div>)}
            </div>
          ):(
            <div className="bg-black/30 rounded-2xl border border-white/10 p-3 text-[10px] text-slate-400 font-bold leading-relaxed">{skipResult.heroIsMasu?'勇者モンの絆経験値は入りませんでした。スキップではマスモン登録はできません。':'勇者モンがマスモンではないため、絆経験値は入りませんでした。スキップではマスモン登録はできません。'}</div>
          )}
          {skipResult.allyBondGains.map(a=>(
            <div key={a.masuId} className="bg-black/40 rounded-2xl border border-pink-500/20 p-3">
              <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-black text-pink-200 truncate">供モン：{a.name}</span><span className="font-mono font-black text-white text-xs shrink-0">+{a.xpGain.toLocaleString()}</span></div>
              <LevelGrowthBar levelBefore={a.levelBefore} levelAfter={a.levelAfter}/>
            </div>
          ))}
          <div className="text-[9px] text-slate-500 font-bold text-center px-2 leading-relaxed">スコア・ランキング・クリア回数には記録されません</div>
        </div>
      </div>
      <button onClick={onClose} className="w-full max-w-sm mx-auto shrink-0 mt-2 min-h-[52px] rounded-2xl bg-teal-600 text-white font-black text-sm uppercase shadow-lg active:scale-[.98]">バトルメニューへ戻る</button>
    </div>
  
  );
}

function PickHeroAllyScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, advanceRunStage, allyCardIndex, allyCarouselRef,
  allyJoinPreview, atk, battleTutorial, battleTutorialSpotClass, currentPickingMon,
  debugHeroMonsterList, def, difficulty, distTotalBonus, extremeDifficulty, extremeRunRef,
  getMasuMon, getUnlockedBaseMonsterList, heroPickTab, maxGuts, maxHp, monSelection, onBack,
  pickMode, proHeroPreset, renderMonsterCardBody, renderMonsterDetailModal, renderProMonsterRow,
  runMode, scenarioPicksHero, setAllyCardIndex, setCurrentPickingMon, setHeroPickTab,
  setProHeroPreset, setupMon, slots, spendAptPoint, spendStatPoint, waveResult,
}) {
  return (

    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] p-4 pt-6 flex flex-col justify-start overflow-hidden">
      {/* 戻るボタン。勇者モン選択はバトルを始める前なので、来た場所(難易度の画面)へ戻す。
          供モン選択はバトルの途中なので、これまでどおりHOMEへ戻る(挑戦をやめる)扱いにする */}
      <div className="mb-2 text-center flex items-center justify-between px-2 shrink-0"><button disabled={!!battleTutorial} onClick={onBack} className="p-3 text-slate-400 active:scale-90 disabled:opacity-25"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">{pickMode==='hero'?'勇者モンを選択':'供モンを選択'}</h2><div className="w-10"></div></div>
      {/* 勇者モンは編成に入れていないベースモンからも選べる(マスモン登録のためだけに編成を入れ替えなくてよい) */}
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble key={pickMode} scene={pickMode==='hero'?'pickHero':'pickAlly'} compact/></div>
      {/* 供モン合流は「いま何がどれだけ増えるか」を選ぶ場面なので、トレーニング画面と同じ形で
          基準になる現在値をここに固定表示する。各カードは自分の変動しか出さないため、
          ここが無いと「合流後の値」だけを見て比べることになり、どれが得か分からなかった */}
      {pickMode==='ally'&&(
        <div className="shrink-0 w-full max-w-md mx-auto mb-2 rounded-2xl border border-white/10 bg-slate-900/60 px-2 py-1.5" data-join-status>
          {(()=>{
            const joinRule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);
            if(extremeRuleNumber(joinRule,'allyJoinPenaltyRate')==null)return null;
            const totalTurns=waveResult?.totalTurnCount||0;
            const multiplier=ultimateAllyJoinMultiplier(totalTurns,joinRule);
            const floorValue=extremeRuleNumber(joinRule,'minimumAllyJoinBonus');
            return <div data-ultimate-join-status={joinRule} className="mb-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-[9px] font-black text-purple-100 flex flex-wrap justify-between gap-x-2"><span className="text-amber-300">{joinRule}補正</span><span>累計{totalTurns}T</span><span>加入ボーナス {precisePercent(multiplier)}（-{precisePercent(1-multiplier)}）{floorValue!=null?`／最低${specialRulePercent(floorValue)}`:''}</span></div>;
          })()}
          {(()=>{const rule=specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty);if(rule===NIGHTMARE_SETTING.id)return <div data-nightmare-join-status className="mb-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-[9px] font-black text-purple-100"><span className="text-amber-300">NIGHTMARE補正</span>　間合い適性：＋{specialRulePercent(extremeSpecialRule(rule,'positiveModifier'))} / －{specialRulePercent(extremeSpecialRule(rule,'negativeModifier'))}</div>;if(rule===CHAOS_SETTING.id)return <div data-chaos-join-status className="mb-1 rounded-lg border border-fuchsia-400/30 bg-purple-950/70 px-2 py-1 text-[9px] font-black text-purple-100"><span className="text-amber-300">CHAOS補正</span>　加入ボーナス {specialRulePercent(extremeSpecialRule(rule,'allyJoinBonus'))}</div>;return null;})()}
          <div className="text-[8px] font-black tracking-widest text-slate-500 text-left mb-1">現在のステータス</div>
          <div className="grid grid-cols-4 gap-1">
            {[['ライフ',maxHp,'text-pink-300'],['ちから',atk,'text-red-300'],['丈夫さ',def,'text-emerald-300'],['ガッツ',maxGuts,'text-amber-300']].map(([label,value,tint])=>(
              <div key={label} className="rounded-lg bg-black/40 px-1 py-1 text-center">
                <span className="block text-[8px] font-black text-slate-500 leading-none">{label}</span>
                <span className={`block text-[13px] font-black font-mono leading-tight ${tint}`}>{value}</span>
              </div>
            ))}
          </div>
          <div className="text-[8px] font-black tracking-widest text-slate-500 text-left mt-1.5 mb-1">間合い適性（距離補正）</div>
          <div className="grid grid-cols-4 gap-1">
            {RANGE_LABELS.map((label,idx)=>{const cur=distTotalBonus(idx); return (
              <div key={label} className="rounded-lg bg-black/40 px-1 py-1 text-center">
                <span className="block text-[8px] font-black text-slate-500 leading-none">{label}</span>
                <span className={`block text-[12px] font-black font-mono leading-tight ${cur>0?'text-cyan-300':cur<0?'text-red-300':'text-slate-400'}`}>{formatAptPct(cur)}</span>
              </div>
            );})}
          </div>
        </div>
      )}
      {pickMode==='hero'&&(
        <div className="shrink-0 w-full max-w-md mx-auto mb-2">
          {/* プロモードはベースモンだけなので、編成との切替は出さない */}
          {!isProMode(runMode)&&<div className="flex gap-1.5">
            {[['roster','編成'],['base','ベースモン']].map(([key,label])=>(
              <button key={key} onClick={()=>{setHeroPickTab(key); setCurrentPickingMon(null);}} aria-pressed={heroPickTab===key} className={`flex-1 min-h-[40px] rounded-2xl font-black text-[12px] border-2 active:scale-95 ${heroPickTab===key?'bg-indigo-600 border-indigo-300 text-white shadow-lg':'bg-slate-900 border-slate-700 text-slate-400'}`}>{label}</button>
            ))}
          </div>}
          <div className="text-[9px] text-slate-500 font-bold mt-1 px-1 text-center">{isProMode(runMode)?'プロモードはベースモンだけで挑みます。育てたマスモンは連れていけません':heroPickTab==='base'?'解放済みのベースモンから選べます。編成に入れていなくても、ラン終了時にマスモン登録できます':'M/B管理で組んだ編成から選びます'}</div>
        </div>
      )}
      {/* あふれる可能性のあるスクロール領域へ justify-center を付けると、あふれたぶんが
          上下へはみ出し、スクロールで追える下側と違って上側は永久に届かなくなる。
          内側を m-auto で寄せておけば、余っているときだけ中央、あふれたら先頭からたどれる */}
      <div className="flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto pb-4 min-h-0 flex flex-col">
       <div className={`w-full${pickMode==='ally'?' m-auto':''}`}>
        {/* バトルチュートリアル中は一覧の外枠ではなくカード1枚ずつを光らせる。
            外枠だと画面からはみ出して「どこを押すのか」が分からなかった */}
        {/* プロの供モン合流だけ、バトルモード選択と同じ横スライドで1体ずつ見せる。
            3体しか出ないので、2列に並べるより1体ずつ大きく見比べられるほうが選びやすい */}
        {(()=>{const allyCarousel=pickMode==='ally'&&isProMode(runMode);
          // 念のため、すでに編成にいる子は一覧にも出さない(勇者モンがもう一度出ないようにする)
          const inParty=slots.filter(x=>x).map(x=>x.id);
          const savedRawList=pickMode==='hero'&&(heroPickTab==='base'||isProMode(runMode))?getUnlockedBaseMonsterList():monSelection;
          const rawList=pickMode==='hero'?debugHeroMonsterList(savedRawList):savedRawList;
          const list=(pickMode==='ally'?rawList.filter(m=>m&&!inParty.includes(m.id)):rawList)||[];
          const stepAlly=(delta)=>{const root=allyCarouselRef.current;if(!root)return;const next=Math.max(0,Math.min(list.length-1,allyCardIndex+delta));setAllyCardIndex(next);centerCarouselChild(root,next,'smooth');};
          return (<>
        {allyCarousel&&<div className="text-center text-[8px] tracking-[.18em] text-slate-400 font-black shrink-0 mb-1">左右にスワイプして供モンを選択</div>}
        {allyCarousel&&<div className="relative h-0">
          <button aria-label="前の供モン" disabled={allyCardIndex===0} onClick={()=>stepAlly(-1)} className="absolute left-0 top-[70px] z-20 w-9 h-12 rounded-r-xl bg-black/70 disabled:opacity-20"><ChevronLeft/></button>
          <button aria-label="次の供モン" disabled={allyCardIndex>=list.length-1} onClick={()=>stepAlly(1)} className="absolute right-0 top-[70px] z-20 w-9 h-12 rounded-l-xl bg-black/70 disabled:opacity-20"><ChevronRight/></button>
        </div>}
        <div ref={allyCarousel?allyCarouselRef:null} onScroll={allyCarousel?(e=>{const root=e.currentTarget,c=root.scrollLeft+root.clientWidth/2;let best=0,d=Infinity;[...root.children].forEach((card,i)=>{const n=Math.abs(card.offsetLeft+card.offsetWidth/2-c);if(n<d){d=n;best=i;}});if(best!==allyCardIndex)setAllyCardIndex(best);}):undefined}
             className={allyCarousel?'flex items-start gap-2.5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory overscroll-x-contain py-1 mh-scroll':'grid grid-cols-2 gap-2.5'}
             style={allyCarousel?{paddingLeft:'18%',paddingRight:'18%',touchAction:'pan-x pinch-zoom'}:pickMode==='hero'&&isProMode(runMode)?{display:'flex',flexDirection:'column'}:undefined}>
        {list.map((m,cardIndex)=>{const isSel=currentPickingMon?.id===m.id;const focused=allyCarousel&&cardIndex===allyCardIndex;
          // カードはM/B管理の一覧とまったく同じ共通実装(renderMonsterCardBody)を通す。
          // 以前はこの画面だけ独自に組んでいたため、絆レベルも総合力も限界突破の★も出ず、
          // 同じマスモンが画面によって違う見た目になっていた。
          // この画面だけの情報(固有技名・ステータス・詳細への案内)はextraで足す。
          const pickMasu=m.masuId?getMasuMon(m.masuId):null;
          const pickBase=m.debugOnly?m:(ALL_PLAYER_MONSTERS[m.id]||m);
          // カードの見た目は「供モンの候補」と同じ共通部品(renderProMonsterRow)を通す
          if(pickMode==='hero'&&isProMode(runMode)) return (
            <React.Fragment key={m.id}>{renderProMonsterRow({
              mon: m,
              selected: proHeroPreset?.heroBaseId===m.id,
              disabled: !scenarioPicksHero(m.id),
              onSelect: ()=>{if(proHeroPreset?.heroBaseId===m.id){setupMon(m,proHeroPreset.heroDistance);return;}setProHeroPreset(null);setCurrentPickingMon(m);advanceRunStage('PICK_SLOT');},
              onDetail: ()=>setCurrentPickingMon(m),
              selectLabel: `${m.name}を勇者モンに選ぶ`,
              activeClass: 'active:bg-indigo-900/30',
              extraButtonClass: scenarioPicksHero(m.id)?battleTutorialSpotClass('monCards'):'',
            })}</React.Fragment>
          );
          return(<button key={m.id} disabled={pickMode==='hero'&&!scenarioPicksHero(m.id)} onClick={()=>setCurrentPickingMon(m)} style={allyCarousel?{...MONSTER_CARD_STYLE,flex:'0 0 64%'}:MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} bg-slate-900 transition-all disabled:opacity-25${pickMode!=='hero'||scenarioPicksHero(m.id)?battleTutorialSpotClass('monCards'):''}${allyCarousel?` snap-center shrink-0 ${focused?'scale-100 opacity-100':'scale-[.92] opacity-55'}`:''} ${isSel?'border-indigo-400 bg-indigo-900/30 ring-4 ring-indigo-500/50 scale-[1.03] shadow-[0_0_25px_rgba(99,102,241,0.6)]':'border-slate-800'}`}>
          {renderMonsterCardBody({
            masu: pickMasu, base: pickBase, mon: m,
            badge: m.debugOnly?<div className="absolute top-0 left-0 z-10 rounded-br-lg bg-fuchsia-700 px-1.5 py-0.5 text-[7px] font-black text-white">DEBUG専用</div>:isSel?<div className="absolute -top-1 -right-1 z-10 bg-indigo-500 rounded-full p-1 shadow-lg"><Check size={12} className="text-white"/></div>:null,
            extra: (<>
              <div className="text-amber-400 font-black flex items-center gap-1 leading-tight" style={{fontSize:'9px'}}><Zap size={9}/> {m.unique.name}</div>
              {/* 勇者モン選択はその子自身の基礎値、供モン合流は「いまの値 → 合流後の値」。
                  合流は加算量(+50など)だけ出しても得かどうか分からないので、
                  トレーニング画面と同じく変化そのものを見せる */}
              {pickMode==='hero'?(
              <div className="grid grid-cols-2 gap-x-2 gap-y-0 w-full px-1 font-mono" style={{fontSize:'9px'}}>
                <div className="flex justify-between"><span className="text-slate-500">HP</span><span className="text-pink-400 font-bold">{m.baseHp}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">力</span><span className="text-red-400 font-bold">{m.baseAtk}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">防</span><span className="text-emerald-400 font-bold">{m.baseDef}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">G</span><span className="text-amber-400 font-bold">{m.baseGuts}</span></div>
              </div>
              ):(()=>{const preview=allyJoinPreview(m); return (<>
                {/* 上の「現在のステータス」が今の値を出しているので、カードは合流後の値と
                    変化量だけを4列で並べる。「1480→1600」のように両方を1つの枠へ入れると
                    iPhone SEの幅では数字が切れてしまう */}
                <div className="w-full rounded-lg bg-black/40 px-1 py-1 grid grid-cols-4 gap-0.5 text-center font-mono" style={{fontSize:'8px'}}>
                  {preview.stats.map(stat=>(
                    <span key={stat.key} className="min-w-0 block">
                      <span className="block text-slate-500 font-black leading-none">{stat.short}</span>
                      {[ULTIMATE_SETTING.id,CHAOS_SETTING.id,INFINITY_SETTING.id].includes(specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty))&&stat.normalDiff!==stat.diff?<span className="block leading-none text-slate-500">本来 +{stat.normalDiff}</span>:null}
                      <b className={`block leading-tight ${stat.diff>0?stat.tint:'text-slate-400'}`} style={{fontSize:'9px'}}>{stat.after}</b>
                      <span className={`block leading-none ${stat.diff>0?'text-emerald-400':'text-slate-700'}`}>{stat.diff>0?`実際 +${stat.diff}`:'実際 ±0'}</span>
                    </span>
                  ))}
                </div>
                <div className="w-full rounded-lg bg-black/40 px-1 py-1 grid grid-cols-4 gap-0.5 text-center font-mono" style={{fontSize:'8px'}}>
                  {preview.apt.map(range=>(
                    <span key={range.idx} className="min-w-0 block">
                      <span className="block text-slate-500 font-black leading-none">{range.label}</span>
                      {specialRuleDifficultyForRun(runMode,difficulty,extremeRunRef.current,extremeDifficulty)===NIGHTMARE_SETTING.id&&range.normalDiff!==range.diff?<span className="block leading-none text-slate-500">通常 {formatAptPct(range.normalDiff)} →</span>:null}
                      <b className={`block leading-tight ${range.diff>0?'text-cyan-300':range.diff<0?'text-red-300':'text-slate-400'}`}>{formatAptPct(range.after)}</b>
                      <span className={`block leading-none ${range.diff>0?'text-emerald-400':range.diff<0?'text-red-400':'text-slate-700'}`}>{range.diff!==0?`${range.normalDiff!==range.diff?'実際 ':''}${formatAptPct(range.diff)}`:'±0'}</span>
                    </span>
                  ))}
                </div>
              </>);})()}
              <div className="min-h-[32px] w-full rounded-xl border border-indigo-400/40 bg-indigo-950/50 text-indigo-200 font-black mt-1 flex items-center justify-center gap-1" style={{fontSize:'10px'}}>詳細を見る <ChevronRight size={11}/></div>
            </>),
          })}
        </button>);})}
        </div>
        {allyCarousel&&<div className="flex justify-center gap-1 py-1 shrink-0">{list.map((m,i)=><button key={m.id} aria-label={`${i+1}体目`} onClick={()=>stepAlly(i-allyCardIndex)} className={`w-1.5 h-1.5 rounded-full ${i===allyCardIndex?'bg-indigo-300 scale-125':'bg-slate-700'}`}/>)}</div>}
          </>);})()}
       </div>
      </div>
      {/* 勇者モン選択・供モン合流の詳細。外枠と上部サマリーは他の画面と同じマスターUIで、
          この画面だけの違いは「現在値 → 合流後」のステータス表記と強化Pの割り振りボタン */}
      {currentPickingMon&&renderMonsterDetailModal({
        mon: currentPickingMon,
        masu: currentPickingMon.masuId ? getMasuMon(currentPickingMon.masuId) : null,
        onClose: ()=>setCurrentPickingMon(null),
        zIndex: 31000,
        // 練習中は上にみゅあの帯が出るので、その高さぶん下げて名前と重ならないようにする
        paddingTop: battleTutorial?'calc(4.25rem + env(safe-area-inset-top))':undefined,
        detailOpts: {
  // 一覧カードと同じ allyJoinPreview を通す。以前はここだけ plusStats をそのまま足していたため、
  // ULTIMATE(累計ターンで加算が下がる)では詳細の数値と実際に増える量が食い違っていた
  statValues: pickMode==='hero' ? null : allyJoinPreview(currentPickingMon).stats.map(stat=>[
stat.label, `${stat.before} → ${stat.after}${stat.diff>0?`（+${stat.diff}）`:''}`, stat.diff>0?stat.tint:'text-slate-400',
  ]),
  statTitle: pickMode==='hero' ? '基本ステータス' : '基本ステータス(現在 → 合流後)',
  // 距離補正は「いまの値 → このモンスターを加えた後の値」で見せる
  aptCurrentPct: [0,1,2,3].map(i=>distTotalBonus(i)),
  // 加算量も実際に足される値(NIGHTMAREの半減込み)で出す
  aptDeltaPct: pickMode==='hero' ? null : allyJoinPreview(currentPickingMon).apt.map(range=>range.diff),
  aptPointsLabel: currentPickingMon.masuId?<div className="text-[8px] text-amber-300 font-black flex items-center gap-1"><Sparkles size={9}/>強化P: {getMasuMon(currentPickingMon.masuId)?.distAptPoints||0}</div>:null,
  aptExtra: (idx,grade)=>{const pts=currentPickingMon.masuId?(getMasuMon(currentPickingMon.masuId)?.distAptPoints||0):0; const canUp=pts>0 && DIST_APTITUDE_GRADES.indexOf(grade)<DIST_APTITUDE_GRADES.length-1; return canUp?<button onClick={()=>{const updated=spendAptPoint(currentPickingMon.masuId,idx); if(updated) setCurrentPickingMon(mergeMasuIntoMon(updated));}} className="w-full text-[8px] font-black bg-amber-600 text-white rounded py-0.5 active:scale-95">+1</button>:null;},
  extraAfterApt: (<>
{currentPickingMon.masuId&&(getMasuMon(currentPickingMon.masuId)?.distAptPoints||0)>0&&(
  <div className="bg-black/40 p-2 rounded-xl border border-emerald-500/30">
    <div className="text-[7px] text-emerald-400 uppercase font-bold mb-1">ステータス強化(強化P 1つにつき使用・調整中)</div>
    <div className="grid grid-cols-4 gap-1">
      {Object.entries(STAT_POINT_KEYS).map(([key,label])=>(
        <button key={key} onClick={()=>{const updated=spendStatPoint(currentPickingMon.masuId,key); if(updated) setCurrentPickingMon(mergeMasuIntoMon(updated));}} className="flex flex-col items-center gap-0.5 bg-emerald-950/50 border border-emerald-500/30 rounded-lg py-1.5 active:scale-95">
          <span className="text-[7px] text-emerald-300 font-black">{label}</span>
          <span className="text-[10px] text-white font-black">+{STAT_POINT_GAIN[key]||1}</span>
        </button>
      ))}
    </div>
  </div>
)}
{!currentPickingMon.masuId&&!currentPickingMon.debugOnly&&(
  <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-[8px] text-slate-500 font-bold text-center">
    {pickMode==='hero'?'勇者モンとして選び、ラン終了時に登録すると「マスモン」として絆レベル・ステータスを強化できます':'絆レベルの強化は勇者モン(マスモン)のみ対象です'}
  </div>
)}
{currentPickingMon.debugOnly&&<div className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-950/50 p-2 text-center text-[9px] font-black text-fuchsia-200">DEBUG専用・保存、育成、マスモン登録の対象外</div>}
  </>),
        },
        footer: (
          <div className="flex gap-2 shrink-0"><button onClick={()=>setCurrentPickingMon(null)} className="w-2/5 min-h-[48px] bg-slate-800 text-slate-400 rounded-2xl font-black text-sm uppercase active:scale-95">戻る</button><button onClick={()=>advanceRunStage('PICK_SLOT')} className={`flex-1 min-h-[48px] bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase shadow-lg active:scale-95${battleTutorialSpotClass('monDecide')}`}>{pickMode==='hero'?'勇者モンに選ぶ':'この供モンを選ぶ'}</button></div>
        ),
      })}
    </div>
  
  );
}

function PickProAlliesScreen({
  advanceRunStage, clearSlotUniqueSelection, confirmProParty, getUnlockedBaseMonsterList,
  initialBattleDistanceRef, mainHero, proAllyDetail, proAllyPool, proEditingAllyIndex,
  renderMonsterDetailModal, renderProMonsterRow, runMode, setCurrentPickingMon, setMainHero,
  setProAllyDetail, setProAllyPool, setProEditingAllyIndex, setProHeroPreset, setSlots,
}) {

    const mode=battleModeInfo(runMode);
    const candidates=getUnlockedBaseMonsterList().filter(m=>m.id!==mainHero?.id);
    const need=Math.min(PRO_ALLY_POOL_SIZE,candidates.length);
    const ready=!!mainHero&&proAllyPool.length===need;
    const changeAlly=(m)=>{
      if(!Number.isInteger(proEditingAllyIndex))return;
      setProAllyPool(prev=>{
        const next=[...prev];
        next[proEditingAllyIndex]=m;
        return next.filter(Boolean);
      });
      setProEditingAllyIndex(null);
    };
    const returnToHero=()=>{
      setProAllyDetail(null);
      setProEditingAllyIndex(null);
      setProHeroPreset(mainHero?{heroBaseId:mainHero.id,heroDistance:initialBattleDistanceRef.current}:null);
      setMainHero(null);setSlots([null,null,null,null]);setCurrentPickingMon(null);clearSlotUniqueSelection();advanceRunStage('PICK_HERO');
    };
    return (
    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col h-full min-h-0 px-4 overflow-hidden" data-screen="pick-pro-allies">
      <div className="mb-2 text-center flex items-center justify-between px-2 shrink-0" style={{paddingTop:'calc(.35rem + env(safe-area-inset-top))'}}>
        <button aria-label="戻る" onClick={returnToHero} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black italic uppercase tracking-widest truncate" style={{color:mode.color}}>{proEditingAllyIndex===null?'プロモード編成':`供モン${proEditingAllyIndex+1}を変更`}</h2>
        <div className="w-10"></div>
      </div>
      <div className="w-full max-w-md mx-auto flex-1 min-h-0 flex flex-col">
        {proEditingAllyIndex===null?<>
          <div className="shrink-0 w-full mb-2"><AssistantBubble scene="pickProAllies" accent={mode.color} compact/></div>
          <p className="shrink-0 text-[9px] text-slate-400 font-bold text-center mb-2">変えたい枠だけ「変更」を押してください。他の枠はそのまま維持されます。</p>
          <div className="flex-1 overflow-y-auto mh-scroll min-h-0 space-y-1.5 pb-2">
            {[["勇者モン",mainHero],...Array.from({length:need},(_,i)=>[`供モン${i+1}`,proAllyPool[i]])].map(([label,mon],i)=><div key={label} className="min-h-[58px] rounded-2xl border border-white/10 bg-slate-900/80 px-2 py-1.5 flex items-center gap-2">
              <span className={`w-14 shrink-0 text-[9px] font-black ${i===0?'text-amber-300':'text-pink-300'}`}>{label}</span>
              <button disabled={!mon} onClick={()=>setProAllyDetail(mon)} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:opacity-50" aria-label={mon?`${mon.name}の詳細を見る`:`${label}は未選択`}>
                <span className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">{mon?(mon.imgUrl?<img src={mon.imgUrl} alt="" className="w-full h-full object-contain"/>:<span className="text-xl">{mon.emoji}</span>):<span className="text-slate-600">＋</span>}</span>
                <span className="min-w-0"><b className="block text-[11px] text-white truncate">{mon?.name||'未選択'}</b>{i===0&&<small className="block text-[8px] text-slate-500">{RANGE_LABELS[initialBattleDistanceRef.current]}距離に配置</small>}</span>
              </button>
              <button onClick={()=>i===0?returnToHero():setProEditingAllyIndex(i-1)} className="min-w-[58px] min-h-[42px] rounded-xl border border-pink-400/50 bg-pink-950/60 text-pink-200 text-[11px] font-black active:scale-95">変更</button>
            </div>)}
          </div>
          <div className="shrink-0 pt-1" style={{paddingBottom:'calc(.25rem + env(safe-area-inset-bottom))'}}><button disabled={!ready} onClick={confirmProParty} className="w-full min-h-[52px] rounded-2xl font-black text-sm active:scale-[.98] disabled:opacity-30" style={{backgroundColor:mode.color,color:'#0f172a'}}>{ready?'この編成で開始':`あと${need-proAllyPool.length}体えらんでください`}</button></div>
        </>:<>
          <p className="shrink-0 text-[9px] text-slate-400 font-bold text-center mb-2">この枠に入れるベースモンを1体選んでください。</p>
          <div className="flex-1 overflow-y-auto mh-scroll pb-2 min-h-0"><div className="flex flex-col gap-2.5">
            {candidates.filter(m=>!proAllyPool.some((chosen,i)=>i!==proEditingAllyIndex&&chosen.id===m.id)).map(m=><React.Fragment key={m.id}>{renderProMonsterRow({mon:m,selected:proAllyPool[proEditingAllyIndex]?.id===m.id,onSelect:()=>changeAlly(m),onDetail:()=>setProAllyDetail(m),selectLabel:`${m.name}を供モン${proEditingAllyIndex+1}に選ぶ`,activeClass:'active:bg-pink-900/30'})}</React.Fragment>)}
          </div></div>
          <button onClick={()=>setProEditingAllyIndex(null)} className="shrink-0 w-full min-h-[48px] rounded-2xl bg-slate-800 text-slate-300 font-black text-sm mb-1">変更せず戻る</button>
        </>}
        {proAllyDetail&&renderMonsterDetailModal({mon:proAllyDetail,onClose:()=>setProAllyDetail(null),accent:'pink',zIndex:31000,label:`${proAllyDetail.name}のベースモン詳細`,footer:<button onClick={()=>setProAllyDetail(null)} className="w-full min-h-[48px] bg-slate-800 text-slate-300 rounded-2xl font-black text-sm active:scale-95">閉じる</button>})}
      </div>
    </div>);
  
}

function PickSlotScreen({
  battleTutorial, battleTutorialSpotClass, currentPickingMon, distTotalBonus,
  getDistAptitude, onRepick, scenarioPicksSlot, setupMon, slots,
}) {
  return (

    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      {currentPickingMon?.imgUrl?(<DyedMonsterImage baseId={currentPickingMon.id} src={currentPickingMon.imgUrl} alt="mon" masuColors={currentPickingMon.colors} className="w-28 h-28 mb-4 object-contain animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)] scale-110"/>):(<div className="text-7xl mb-4 animate-bounce drop-shadow-[0_0_40px_rgba(99,102,241,0.4)]">{currentPickingMon?.emoji}</div>)}
      <h2 className="text-lg font-black mb-1 italic uppercase tracking-widest text-indigo-400">配置場所を決定せよ</h2>
      <div className="w-full max-w-xs mb-2"><AssistantBubble scene="pickSlot" compact/></div>
      {/* 間合い適性はどこに置いても4距離すべてに入る。ここの%は「このモンスターを加えた後の各距離の補正値」 */}
      <div className="text-[9px] text-slate-400 font-bold mb-5 leading-relaxed px-2">間合い適性はどこに置いても4距離すべてに加算されます。<br/>配置は「敵と同じ距離で攻撃する」ことと、覚える距離撃に影響します。</div>
      {/* 練習中は押せる枠だけを光らせる。枠全体を囲むと「どれを押すのか」が分からなかった */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
        {slots.map((s,i)=>{const grade=getDistAptitude(currentPickingMon,i); const after=distTotalBonus(i)+aptGradeToPct(grade);
          return(<button key={i} disabled={s!==null||!scenarioPicksSlot(i)} onClick={()=>setupMon(currentPickingMon,i)} className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all disabled:opacity-20${scenarioPicksSlot(i)?battleTutorialSpotClass('slots'):''} ${RANGE_STYLES[i].bg} ${RANGE_STYLES[i].border} ${s?'opacity-100 shadow-xl':'opacity-90 ring-2 ring-white/20 animate-pulse'} active:scale-90`}>
          <span className={`text-[10px] font-black mb-1 uppercase px-3 py-0.5 rounded-full ${RANGE_STYLES[i].labelBg} ${RANGE_STYLES[i].text} border border-white/10 shadow-md`}>{RANGE_LABELS[i]}距離</span>
          {s?(s.imgUrl?<DyedMonsterImage baseId={s.id} src={s.imgUrl} alt={s.name} masuColors={s.colors} className="w-10 h-10 mt-1 object-contain drop-shadow-md scale-125"/>:<span className="text-xl mt-1 drop-shadow-md">{s.emoji}</span>):<PlusCircle className="text-white/50 mt-1" size={20}/>}
          {!s&&<span className={`text-[9px] font-black mt-1 px-2 py-0.5 rounded-full border ${DIST_APTITUDE_COLOR[grade]}`}>{grade} 合流後 {formatAptPct(after)}</span>}
        </button>);})}
      </div>
      {/* 種族チャレンジは通常の勇者選択(PICK_HERO)を持たないので、選び直しは
          種族チャレンジの編成画面(出撃確認)へ戻す。ここを分けないと、種族の縛りが
          外れた通常の勇者選択へ入り込んでしまう */}
      <button disabled={!!battleTutorial} onClick={onRepick} className="mt-8 text-slate-400 flex items-center gap-2 font-black uppercase text-[10px] active:scale-90 disabled:opacity-25"><ArrowLeft size={14}/> モンスターを選び直す</button>
    </div>
  
  );
}

function PickTeachingScreen({
  battleTutorialSpotClass, confirmPickTeaching, getFullEvolutionDetails, ownedTeachings,
  scenarioPicksTeaching, selectedTeachingCard, setSelectedTeachingCard, teachingPool,
}) {
  return (

    <div style={{position:"absolute",inset:0,backgroundColor:"#020617",zIndex:30000}} className="absolute inset-0 z-[3000] p-4 flex flex-col items-center justify-center overflow-hidden">
      <div className="mb-4 text-center shrink-0"><h2 className="text-xl font-black text-purple-400 italic">アシストカードの継承・強化</h2><p className="text-[9px] text-slate-400 uppercase mt-1 tracking-widest">Select Breeder Card</p></div>
      <div className="shrink-0 w-full max-w-sm mb-2"><AssistantBubble scene="pickTeaching" compact/></div>
      {/* 練習中は押せるカードだけを光らせる */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto overflow-y-auto min-h-0 p-1 flex-1 content-center">
        {teachingPool.map(t=>{const owned=ownedTeachings.find(ot=>ot.id===t.id); const level=owned?owned.evoLevel:0; const isMax=level>=2;
          return(<button key={t.id} disabled={!scenarioPicksTeaching(t.id)} onClick={()=>setSelectedTeachingCard(t)} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center text-center gap-2 transition-all aspect-square disabled:opacity-20${scenarioPicksTeaching(t.id)?battleTutorialSpotClass('teachings'):''} ${owned?'bg-purple-900/40 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]':'bg-slate-900 border-slate-800 active:scale-95'}`}>
            <span style={{fontSize:'44px'}}>{cardIconNode(t.icon,52,t.id)}</span>
            <div className="text-[11px] font-black leading-tight flex flex-col items-center justify-center">{owned&&!isMax&&<div className="text-[8px] text-amber-400 mb-0.5 line-through">{BREEDER_EVO_NAMES[t.id][level]}</div>}<div className={owned?"text-white":""}>{owned?(isMax?BREEDER_EVO_NAMES[t.id][level]:BREEDER_EVO_NAMES[t.id][level+1]):BREEDER_EVO_NAMES[t.id][0]}</div></div>
            <div className="text-[8px] text-slate-200 bg-black/20 px-2 py-1 rounded-full">{owned?(isMax?"MAXレベル":"進化：効果上昇"):"新規習得"}</div>
          </button>);
        })}
      </div>
      {selectedTeachingCard&&(
        <div className="fixed inset-0 z-[3100] flex items-center justify-center p-6" style={{position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.85)',zIndex:31000}}>
          <div className="bg-slate-900 border-2 border-purple-500 rounded-3xl p-6 w-full max-w-xs flex flex-col items-center gap-4 shadow-2xl h-auto max-h-full">
            <div className="text-6xl mb-2 shrink-0">{cardIconNode(selectedTeachingCard.icon,76,selectedTeachingCard.id)}</div>
            <h3 className="text-lg font-black text-white mb-4 shrink-0">{(()=>{const t=selectedTeachingCard; const owned=ownedTeachings.find(ot=>ot.id===t.id); return BREEDER_EVO_NAMES[t.id][owned?owned.evoLevel:0];})()}</h3>
            <div className="w-full space-y-2 mb-4 overflow-y-auto min-h-0 flex-1">
              {getFullEvolutionDetails(selectedTeachingCard).map(info=>{const owned=ownedTeachings.find(ot=>ot.id===selectedTeachingCard.id); const currentLvl=owned?owned.evoLevel:-1; const isCurrent=info.lvl===currentLvl; const isNext=info.lvl===currentLvl+1;
                return(<div key={info.lvl} className={`p-2 rounded-xl border ${isCurrent?'bg-purple-900/50 border-purple-400':isNext?'bg-amber-900/30 border-amber-500/50':'bg-black/30 border-white/5'}`}><div className="flex justify-between items-center mb-1"><span className={`text-[9px] font-black ${isCurrent?'text-purple-300':isNext?'text-amber-300':'text-slate-500'}`}>Lv.{info.lvl} {info.name}</span>{isCurrent&&<span className="text-[7px] bg-purple-500 text-white px-1.5 rounded">所持</span>}{isNext&&<span className="text-[7px] bg-amber-600 text-white px-1.5 rounded">強化後</span>}</div><div className="text-[8px] text-slate-300">{info.desc}</div></div>);
              })}
            </div>
            <div className="flex gap-2 w-full mt-auto shrink-0"><button onClick={()=>setSelectedTeachingCard(null)} className="flex-1 bg-slate-800 text-slate-400 py-3 rounded-xl font-bold text-xs">戻る</button><button onClick={()=>confirmPickTeaching()} className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-black shadow-lg text-xs">{ownedTeachings.find(ot=>ot.id===selectedTeachingCard.id)?"強化する":"習得する"}</button></div>
          </div>
        </div>
      )}
    </div>
  
  );
}
