// ==== 画面: プロフィール(gameState === 'PROFILE') ====
//
// MonsterHeroGame から切り出した6画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-7)。
// これまでで最大の画面(約19,500文字)で、本体から受け取るものが 38 個ある。
//
// 【この画面ならではの注意】
// ・名前とアイコンの変更、助手えらび、呼び方の変更は、どれも保存を伴うモーダルを開く操作。
//   モーダルの中身は MonsterHeroGame 側に残し、ここは「開いて」と伝えるだけ
// ・はじめての設定(onboarding)はこの画面の中に同居している。finishOnboarding も本体のまま
// ・アイテム欄へ行く導線があるが、画面は行き先を知らない(onOpenItems)
// ・記録の読み方(modeRecordFor / resolveIconUrl など)は本体の state を見るので、関数ごと受け取る
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に PROFILE の行が無い)
//
// props が多いのは、この画面が「ブリーダーの全記録の置き場」だから。
// 減らすなら記録のまとまりごとに部品を分ける必要があり、それは切り出しとは別の作業にする。
function ProfileScreen({
  activeAssistant, assistantBond, assistantBondLevelNow, assistantBonds, assistantCallStyle, attemptCounts,
  breederIcon, breederLevel, breederName, breederPoints, extremeBestScores, extremeClearCounts,
  finishOnboarding, gold, highScores, isEventReplayUnlocked, modeRecordFor, onboarded,
  onboardingIcon, onboardingName, onboardingPreview, ownedItems, playtimeView, proHighScores,
  profileBattleMode, quickHighestWaves, resolveIconUrl, selectedAssistantId, speciesChallengeProgress,
  onBack, onOpenNameEdit, onOpenIconPicker, onOpenItems, onOpenCallStylePicker, onOpenAssistantPicker,
  onSelectBattleMode, onOpenEventReplayList, onOpenSpeciesRecords,
}) {
  return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        {/* プレビュー中は上に帯が出るので、見出しが隠れないぶんだけ下げる */}
        <div className="flex items-center gap-2 mb-4 shrink-0" style={onboardingPreview?{paddingTop:'calc(2.25rem + env(safe-area-inset-top))'}:undefined}>
          {/* はじめての設定が終わるまでは、まだ帰る場所(HOME)が無いので戻るボタンを出さない */}
          {(onboarded&&!onboardingPreview)
            ? <button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
            : <span className="w-11"/>}
          <h2 className="text-xl font-black italic text-indigo-400 uppercase tracking-widest">プロフィール</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="profile"/></div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
        {/* はじめての設定。ここで名前とアイコンを決めてもらい、そのまま村の案内へ続ける。
            進み具合(どちらが決まっているか)に応じて、みゅあが次にやることを教える */}
        {(!onboarded||onboardingPreview)&&(()=>{
          const hasName=!!(onboardingName||'').trim();
          const hasIcon=!!onboardingIcon;
          const ready=hasName&&hasIcon;
          const step=(typeof findAssistantOnboarding==='function')?findAssistantOnboarding(hasName,hasIcon,selectedAssistantId):null;
          return(
          <div className="mb-4 rounded-2xl border-2 border-indigo-400/60 bg-indigo-950/50 p-3 shrink-0">
            {onboardingPreview&&<div className="-mx-3 -mt-3 mb-2 px-3 py-1.5 rounded-t-xl bg-fuchsia-700 text-white text-[10px] font-black tracking-widest">DEBUG・見るだけの表示です。名前もアイコンも保存されません</div>}
            <div className="text-[10px] font-black text-indigo-300 tracking-widest mb-2">はじめての設定</div>
            <AssistantBubble line={step?.t||null} expression={step?.e||null} helpRef="basics/onboarding" compact/>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button onClick={()=>onOpenNameEdit(hasName?breederName:'')} className={`min-h-[46px] rounded-xl border-2 text-[11px] font-black active:scale-95 ${hasName?'bg-emerald-950/60 border-emerald-400/60 text-emerald-200':'bg-slate-900 border-indigo-400/60 text-white'}`}>{hasName?'✓ なまえ':'なまえを決める'}</button>
              <button onClick={onOpenIconPicker} className={`min-h-[46px] rounded-xl border-2 text-[11px] font-black active:scale-95 ${hasIcon?'bg-emerald-950/60 border-emerald-400/60 text-emerald-200':'bg-slate-900 border-indigo-400/60 text-white'}`}>{hasIcon?'✓ アイコン':'アイコンを選ぶ'}</button>
            </div>
            <button disabled={!ready} onClick={finishOnboarding} className="w-full mt-2 min-h-[52px] rounded-2xl font-black text-sm text-black disabled:opacity-30 active:scale-[.98]" style={{backgroundColor:'#f472b6'}}>けってい！</button>
            <div className="text-[9px] text-slate-400 text-center mt-1.5">名前もアイコンも、あとからこの画面でいつでも変えられます</div>
          </div>);
        })()}
        <div className="shrink-0 bg-slate-900/80 border border-white/10 rounded-3xl p-5 flex flex-col items-center gap-3 mb-4">
          <button onClick={onOpenIconPicker} className="relative w-20 h-20 rounded-full bg-slate-800 border-2 border-indigo-400/50 flex items-center justify-center overflow-hidden active:scale-95">
            {resolveIconUrl(breederIcon)?(<BreederIcon src={resolveIconUrl(breederIcon)} id={breederIcon} alt="icon" className="w-full h-full"/>):(<User size={36} className="text-indigo-400"/>)}
            <div className="absolute bottom-0 inset-x-0 bg-black/60 py-0.5 flex items-center justify-center"><Edit3 size={9} className="text-white"/></div>
          </button>
          <button onClick={()=>onOpenNameEdit(breederName)} className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl active:scale-95 group">
            <span className="font-black text-base text-white">{breederName}</span><Edit3 size={13} className="text-slate-500 group-hover:text-white"/>
          </button>
          <div className="flex items-center gap-2"><Crown size={16} className="text-amber-300"/><span className="text-lg font-black text-indigo-200">LV.{breederLevel.level}</span></div>
          <div className="w-full max-w-[240px]">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/5"><div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400" style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></div></div>
            <div className="text-[8px] text-slate-500 font-mono text-center mt-1">{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</div>
          </div>
          <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full">
            <Gem size={11} className="text-amber-400"/>
            <span className="text-[11px] font-black text-amber-300 font-mono">{gold.toLocaleString()}</span>
            <span className="text-[8px] text-amber-500/70 font-bold">ダイヤ</span>
          </div>
          <div className="w-full flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 px-4 py-2.5 rounded-xl">
            <Coins size={14} className="text-amber-400"/><span className="text-[11px] font-black text-amber-200">{breederPoints} pt</span>
          </div>
          <button onClick={onOpenItems} className="w-full flex items-center justify-center gap-2 bg-teal-950/40 border border-teal-500/40 px-4 py-2.5 rounded-xl active:scale-95">
            <Package size={12} className="text-teal-400"/><span className="text-[10px] font-black text-teal-200">アイテム（{Object.values(ownedItems).reduce((sum,n)=>sum+(n||0),0)}個）</span>
          </button>
          {/* 遊んだ時間。数え始めた日も一緒に出す(これまで数えていなかったので、
              既存のプレイヤーは0から始まる。いつからの記録かが分からないと短すぎると誤解される) */}
          <div className="w-full flex flex-col items-center gap-1 bg-indigo-950/40 border border-indigo-500/30 px-4 py-2.5 rounded-2xl">
            <div className="flex items-center gap-2">
              <Timer size={13} className="text-indigo-300"/>
              <span className="text-[10px] font-black text-indigo-200">プレイ時間</span>
              <span className="text-[11px] font-black text-white font-mono">{formatPlaytime(playtimeView.totalMs)}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-black text-indigo-300">
              <span>今日 <span className="text-white font-mono">{formatPlaytime(playtimeTodayMs(playtimeView))}</span></span>
              <span className="text-slate-600">/</span>
              <span>遊んだ日 <span className="text-white font-mono">{playtimeView.days}</span>日</span>
            </div>
            {playtimeView.longest.day&&(
              <div className="text-[8px] text-slate-500 font-bold">いちばん長かった日 {formatPlaytime(playtimeView.longest.ms)}（{playtimeView.longest.day}）</div>
            )}
            <div className="text-[8px] text-slate-500 font-bold">{playtimeView.since?`${playtimeView.since} から数えています`:'いま数え始めたところです'}</div>
          </div>
        </div>
        {/* 助手との仲良し度。遊ぶほど増えて、呼び方と話す内容が変わる。
            助手ごとに別々に貯まるので、切り替えても片方が消えることはない */}
        {onboarded&&!onboardingPreview&&(()=>{
          const stage=(typeof assistantBondStageByLevel==='function')?assistantBondStageByLevel(assistantBondLevelNow,selectedAssistantId):null;
          const next=(typeof assistantBondNext==='function')?assistantBondNext(assistantBond.points):null;
          const from=stage?stage.need:0;
          const width=next?Math.max(0,Math.min(100,((assistantBond.points-from)/Math.max(1,next.need-from))*100)):100;
          const accent=activeAssistant.accent||'#f472b6';
          return(
            <div className="bg-slate-900/60 rounded-2xl p-3 mb-4" style={{border:`1px solid ${accent}4d`}}>
              <div className="flex items-center gap-2">
                <AssistantFace who={activeAssistant} size={40} accent={accent} expression={assistantBondLevelNow>=4?'excited':assistantBondLevelNow>=2?'happy':'normal'}/>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-black tracking-widest" style={{color:accent}}>{activeAssistant.name}との仲良し度</div>
                  <div className="text-[11px] font-black text-white">Lv.{assistantBondLevelNow}　{stage?stage.title:''}</div>
                </div>
                {assistantBondLevelNow>=((typeof ASSISTANT_CALL_STYLE_UNLOCK_LEVEL!=='undefined'&&ASSISTANT_CALL_STYLE_UNLOCK_LEVEL)||6)?(
                  <button type="button" onClick={onOpenCallStylePicker} className="shrink-0 text-right active:scale-95">
                    <div className="text-[8px] text-slate-500 flex items-center justify-end gap-0.5">呼び方<Edit3 size={8}/></div>
                    <div className="text-[11px] font-black" style={{color:accent}}>{assistantSpeakText('{name}',breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId)}</div>
                  </button>
                ):(
                  <div className="shrink-0 text-right"><div className="text-[8px] text-slate-500">呼び方</div><div className="text-[11px] font-black" style={{color:accent}}>{assistantSpeakText('{name}',breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId)}</div></div>
                )}
              </div>
              <div className="h-1.5 mt-2 rounded-full bg-black/50 overflow-hidden"><i className="block h-full rounded-full" style={{width:`${width}%`,background:`linear-gradient(90deg,${accent},#fbbf24)`}}/></div>
              <div className="text-[8px] text-slate-400 font-bold mt-1 text-right">{next?`次のLv.${next.level}まで あと${next.remain}`:'いちばん仲良し！'}</div>
              {/* 助手の切り替え。もう片方の仲良し度Lvもここで確認できる */}
              {ASSISTANT_LIST.length>1&&(
                <div className="mt-2.5 pt-2.5 border-t border-white/10">
                  <div className="text-[8px] font-black text-slate-500 tracking-widest mb-1.5">いっしょに遊ぶ助手</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ASSISTANT_LIST.map(who=>{
                      const active=who.id===selectedAssistantId;
                      const lv=assistantBondLevelOf(normalizeAssistantBond(assistantBonds[who.id]).points);
                      const t=(typeof assistantBondStageByLevel==='function')?assistantBondStageByLevel(lv,who.id):null;
                      return(
                        <button key={who.id} type="button" onClick={()=>{ if(!active) onOpenAssistantPicker(); }} aria-pressed={active}
                          className={`min-h-[52px] rounded-xl px-2 py-1.5 flex items-center gap-1.5 text-left active:scale-95 ${active?'':'opacity-60'}`}
                          style={{border:`2px solid ${active?who.accent:'rgba(255,255,255,.1)'}`,backgroundColor:active?`${who.accent}22`:'rgba(15,23,42,.6)'}}>
                          <AssistantFace who={who} size={30} accent={who.accent} expression={active?'happy':'normal'}/>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[10px] font-black text-white truncate">{who.name}{active&&'（選択中）'}</b>
                            <small className="block text-[8px] text-slate-400 truncate">Lv.{lv} {t?t.title:''}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[8px] text-slate-500 mt-1">仲良し度は助手ごとに別々に貯まります。切り替えても消えません。</div>
                </div>
              )}
            </div>
          );
        })()}
        {/* 保存済みの各モード記録を読むだけのプロフィール表示。新しい保存キーは作らない。 */}
        {(()=>{
          const difficultyIds=Object.keys(DIFFICULTY_SETTINGS);
          const modes=[...PUBLIC_BATTLE_MODES,EXTREME_MODE,SPECIES_CHALLENGE_MODE];
          const selected=modes.find(mode=>mode.id===profileBattleMode)||null;
          const speciesSummary=speciesChallengeProfileSummary(speciesChallengeProgress);
          const speciesDifficultyLabel=(id)=>DIFFICULTY_SETTINGS[id]?.label||EXTREME_DIFFICULTIES.find(setting=>setting.id===id)?.label||id;
          const scoreMapFor=(mode)=>isProMode(mode.id)?proHighScores:highScores;
          const representativeFor=(mode)=>{
            if(mode.id===BATTLE_MODE_SPECIES_CHALLENGE)return speciesSummary.bestScore>0?`最高スコア: ${speciesSummary.bestScore.toLocaleString()} pt`:'最高スコア: 記録なし';
            if(isQuickMode(mode.id)){
              const wave=highestModeWave(quickHighestWaves,difficultyIds);
              return wave>0?`最高到達 WAVE ${wave}`:'未記録';
            }
            const scores=mode.id===EXTREME_MODE.id
              ? extremeBestScores
              : scoreMapFor(mode);
            const ids=mode.id===EXTREME_MODE.id?PUBLIC_EXTREME_DIFFICULTIES.map(item=>item.id):difficultyIds;
            const best=highestModeScore(scores,ids);
            return best>0?`最高スコア ${best.toLocaleString()} pt`:'未記録';
          };
          return <section className="mb-4" data-profile-battle-records>
            <div className="mb-2 flex items-end justify-between px-1"><div><div className="text-[10px] font-black text-indigo-300 tracking-widest">バトル記録</div><div className="text-[9px] text-slate-500">モードをタップすると詳しい記録を確認できます</div></div></div>
            {!selected?(
              <div className="grid grid-cols-1 gap-2">
                {modes.map(mode=>{const species=mode.id===BATTLE_MODE_SPECIES_CHALLENGE;return <button key={mode.id} type="button" data-profile-mode={mode.id} onClick={()=>species?onOpenSpeciesRecords():onSelectBattleMode(mode.id)} className="w-full min-h-[64px] rounded-2xl border bg-slate-900/70 px-3 py-2.5 text-left active:scale-[.98]" style={{borderColor:`${mode.color}66`}}>
                  <span className="flex items-center gap-2"><span className="text-xl" aria-hidden="true">{mode.emoji}</span><span className="min-w-0 flex-1"><b className="block text-[13px] text-white">{mode.label}</b><small className="block text-[11px] font-black" style={{color:mode.color}}>{representativeFor(mode)}</small>{species&&<><small className="block truncate text-[9px] font-black text-cyan-100">最高記録: {speciesSummary.bestScore>0?`${speciesChallengeSpeciesName(speciesSummary.bestSpeciesId)} / ${speciesDifficultyLabel(speciesSummary.bestDifficultyId)}`:'記録なし'}</small><small className="block text-[9px] font-black text-emerald-300">クリア: {speciesSummary.clearedCount} / {speciesSummary.totalCount}</small></>}</span><ChevronRight size={18} className="shrink-0 text-slate-500"/></span>
                </button>})}
              </div>
            ):(
              <div className="rounded-2xl border bg-slate-900/70 p-3" style={{borderColor:`${selected.color}66`}}>
                <button type="button" onClick={()=>onSelectBattleMode(null)} className="mb-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-black/25 px-2 text-left active:scale-[.98]"><ArrowLeft size={18}/><span className="text-lg" aria-hidden="true">{selected.emoji}</span><span className="font-black text-[13px]">{selected.label}の記録</span></button>
                <div className="flex flex-col gap-2">
                  {selected.id===EXTREME_MODE.id
                    ? PUBLIC_EXTREME_DIFFICULTIES.map(setting=>{const score=extremeBestScores[setting.id]||0;const clears=extremeClearCounts[setting.id]||0;const played=score>0||clears>0;return <div key={setting.id} className="rounded-xl border border-white/5 bg-black/25 p-3"><b className="block text-[11px] text-fuchsia-200">{setting.label}</b>{played?<div className="mt-2 grid grid-cols-2 gap-2 text-center"><div><small className="block text-[8px] text-slate-500">最高スコア</small><strong className="text-[12px] text-amber-300">{score.toLocaleString()} pt</strong></div><div><small className="block text-[8px] text-slate-500">クリア回数</small><strong className="text-[12px] text-emerald-300">{clears}回</strong></div></div>:<div className="mt-2 text-center text-[11px] font-black text-slate-500">未記録</div>}</div>})
                    : Object.entries(DIFFICULTY_SETTINGS).map(([key,setting])=>{const record=modeRecordFor(selected.id,key);const quick=isQuickMode(selected.id);const challenge=selected.id===BATTLE_MODE_CHALLENGE;const attempts=challenge?(attemptCounts[key]||0):0;const played=record.score>0||record.wave>0||record.clears>0||attempts>0;return <div key={key} className="rounded-xl border border-white/5 bg-black/25 p-3"><div className="px-2 py-1 rounded-lg text-[10px] font-black text-center" style={difficultyStyle(setting,true)}>{setting.label}</div>{played?<div className={`mt-2 grid gap-1 text-center ${quick?'grid-cols-2':challenge?'grid-cols-2':'grid-cols-3'}`}>{challenge&&<div><small className="block text-[8px] text-slate-500">挑戦回数</small><strong className="text-[11px] text-white">{attempts}回</strong></div>}{!quick&&<div><small className="block text-[8px] text-slate-500">最高スコア</small><strong className="text-[11px] text-amber-300">{record.score.toLocaleString()} pt</strong></div>}<div><small className="block text-[8px] text-slate-500">最高到達WAVE</small><strong className="text-[11px] text-indigo-200">WAVE {record.wave}</strong></div><div><small className="block text-[8px] text-slate-500">クリア回数</small><strong className="text-[11px] text-emerald-300">{record.clears}回</strong></div></div>:<div className="mt-2 text-center text-[11px] font-black text-slate-500">未記録</div>}</div>})}
                </div>
              </div>
            )}
          </section>;
        })()}
        {/* イベント回想: 見たことのある会話イベントを、あとから何度でも見返せる。
            見るだけで、初回閲覧フラグ・助手選択・仲良し度・通常のアップデート通知には一切影響しない */}
        {onboarded&&!onboardingPreview&&(()=>{
          const list=(typeof EVENT_REPLAYS!=='undefined'&&EVENT_REPLAYS)||[];
          if(list.length===0) return null;
          const unlockedCount=list.filter(isEventReplayUnlocked).length;
          return (
            <button type="button" onClick={onOpenEventReplayList} className="w-full mb-4 flex items-center gap-2 bg-fuchsia-950/40 border border-fuchsia-500/40 px-4 py-3 rounded-2xl active:scale-[.98]">
              <Sparkles size={14} className="text-fuchsia-300 shrink-0"/>
              <span className="flex-1 min-w-0 text-left">
                <b className="block text-[11px] font-black text-fuchsia-100">イベント回想</b>
                <small className="block text-[9px] text-fuchsia-300/70">見たことのある会話をもう一度見られます（{unlockedCount}/{list.length}）</small>
              </span>
              <ChevronRight size={16} className="shrink-0 text-fuchsia-400"/>
            </button>
          );
        })()}
        </div>
      </div>
  );
}
