// ==== 画面: 神殿の限界突破・転生・超越・魂格進化と、その演出 ====
//
// MonsterHeroGame から切り出した12本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
// 4つの画面に加えて、gameState に紐づかない兄弟ブロック——再生の結果・レベル上限の補償告知・
// 継承固有技の補償告知・各種の演出——も一緒に置いた。
// **画面だけ移して演出を置き去りにすると、演出が元の場所に取り残される。**
//
// 【この画面ならではの注意】
// ・保存は一切していない。個体・ダイヤ・アイテムの更新は MonsterHeroGame 側の
//   executeMasuRebirth / executeMasuReincarnation / executeMasuTranscendence /
//   executeMasuSoulRank が担うので、props で受けて呼ぶだけ
// ・二重実行を止める *ProcessingRef は ref のままだと画面が本体の中身を持つので、
//   真偽値にして渡す(描画のたびに読む今の作りと同じ挙動)
// ・レベル上限の補償告知だけは storeSet('mh_masu_level_cap_compensation_notice_seen_v1', …) を
//   直接呼ぶ。**保存キーの名前は絶対に変えない**(CLAUDE.md ⑦)。
//   呼び出しごと props で受け取り、中身は本体に残す
// ・演出を消すタイマーは本体の execute* の中にあるので、ここには無い

function MasuRebirthScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, buildUnifiedMonsterEntries, executeMasuBreakthrough, getRebirthSkillChoices,
  gold, masuMons, monsterDisplayFlags, monsterEntryMatchesDisplayFlags, monsterEntryMatchesLineage,
  monsterRosterIds, onBackToTemple, ownedItems, rebirthError, rebirthProcessingRef,
  rebirthSelectedId, rebirthSkillKey, renderMonsterCardBody, renderMonsterSortFilterBar, renderScreenNote,
  setRebirthSelectedId, setRebirthSkillKey, sortMonsterEntries,
}) {

      const selected=masuMons.find(m=>String(m.id)===String(rebirthSelectedId));
      if (!selected) { const entries=sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds)).filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)&&monsterEntryMatchesLineage(e)); return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button onClick={onBackToTemple} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">限界突破</h2></div><div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="rebirth" compact/></div>{renderScreenNote('rebirth','レベル上限に届いたマスモンを、虹のプシュケーで上へ伸ばせます。',[`30凸までは上限+${BREAKTHROUGH_LEVEL_CAP_GAIN}。31〜35凸はLv.200・230・270・330・400へ上がり、金★が虹★へ1個ずつ置き換わります。`,'虹★4で解放されるLv270→330は強化P×2、虹★5で解放されるLv330→400は×3です。',`必要な虹のプシュケーは1回目${BREAKTHROUGH_ITEM_BASE}個、以降1回ごとに+${BREAKTHROUGH_ITEM_STEP}個。チャレンジ／クイックをクリアするともらえます。`])}<div className="flex items-center justify-between gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/30 px-3 py-2 mb-3 shrink-0"><span className="text-[10px] font-black text-fuchsia-200 flex items-center gap-1"><span aria-hidden="true">🌈</span>虹のプシュケー</span><span className="text-[11px] font-mono font-black text-white">所持 {ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID).toLocaleString()}</span></div>{renderMonsterSortFilterBar({singleType:true})}<div className="grid grid-cols-3 gap-2 overflow-y-auto mh-scroll">{entries.map(({masu})=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const lvl=masuBondLevelInfo(masu);const cap=normalizeMasuProgression(masu).levelCap;const need=breakthroughItemCost(normalizeMasuProgression(masu).rebirthCount+1);const enoughPsyche=ownedItemCount(ownedItems,BREAKTHROUGH_ITEM_ID)>=need;const can=lvl.level===cap&&cap<MAX_MASU_LEVEL_CAP&&enoughPsyche;return <button key={masu.id} disabled={!can} onClick={()=>{setRebirthSelectedId(masu.id);setRebirthSkillKey(null);}} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-violet-500/40 bg-slate-900 disabled:opacity-35`}>{renderMonsterCardBody({masu,base,status:<span className={`text-[8px] font-black ${enoughPsyche?'text-fuchsia-300':'text-red-400'}`}>🌈{need}</span>})}</button>})}</div></div>; }
      const normalized=normalizeMasuProgression(selected), base=ALL_PLAYER_MONSTERS[selected.baseId], lvl=masuBondLevelInfo(selected), cost=masuRebirthCost(lvl.level), skills=getRebirthSkillChoices(selected);
      return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button disabled={rebirthProcessingRef.current} onClick={()=>setRebirthSelectedId(null)} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">限界突破・固有技選択</h2></div><div className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3 mb-3"><div className="relative w-20 h-20 rounded-full overflow-hidden"><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/><RebirthStars count={selected.rebirthCount} className="mh-rebirth-stars-overlay"/></div><div><b>{selected.name}</b><div className="text-pink-300 text-xs">Lv.{lvl.level} / 上限Lv.{normalized.levelCap}</div><div className="text-slate-400 text-[10px]">{normalized.rebirthCount>=BREAKTHROUGH_MAX_COUNT?`次は${normalized.rebirthCount+1}凸：上限Lv.${breakthroughLevelCap(normalized.rebirthCount+1)}、虹★が1個増えます${normalized.rebirthCount+1>=34?`（LvUP強化ポイント×${levelUpPointMultiplier(normalized.rebirthCount+1)}）`:''}`:`星が1つ増えて上限が+${BREAKTHROUGH_LEVEL_CAP_GAIN}。レベルと強化はそのまま残ります`}</div><div className="text-amber-300 text-[10px] font-black">強化ポイント +{normalized.rebirthCount===0?BREAKTHROUGH_FIRST_POINTS:BREAKTHROUGH_POINTS}</div></div></div>{/* 必要ダイヤは合体の確認画面と同じように、独立した枠で目立たせる */}<div className="bg-black/40 p-3 rounded-xl border border-violet-500/30 mb-3 space-y-1.5"><div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要ダイヤ</span><span className={`font-black flex items-center gap-1 ${gold>=cost?'text-amber-300':'text-red-400'}`}><Gem size={12}/>{cost.toLocaleString()}</span></div><div className="text-[8px] text-slate-400">（絆Lv.{lvl.level}）× {REBIRTH_COST_PER_LEVEL}</div><div className="flex justify-between text-[9px] font-bold"><span className="text-slate-500">所持ダイヤ</span><span className="text-slate-300 font-black">{gold.toLocaleString()}</span></div>{gold<cost&&<div className="text-[8px] text-red-400 font-black">ダイヤが足りません（あと {(cost-gold).toLocaleString()}）</div>}</div>{/* 限界突破には虹のプシュケーも要る。必要数と所持数を必ず並べて出す */}{(()=>{const need=breakthroughItemCost(normalizeMasuProgression(selected).rebirthCount+1);const have=ownedItemCount(ownedItems,BREAKTHROUGH_ITEM_ID);return <div className="bg-black/40 p-3 rounded-xl border border-fuchsia-500/30 mb-3 space-y-1.5"><div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要な虹のプシュケー</span><span className={`font-black flex items-center gap-1 ${have>=need?'text-fuchsia-300':'text-red-400'}`}><span aria-hidden="true">🌈</span>{need.toLocaleString()}</span></div><div className="text-[8px] text-slate-400">（{normalizeMasuProgression(selected).rebirthCount+1}回目の限界突破：{BREAKTHROUGH_ITEM_BASE} +（回数-1）×{BREAKTHROUGH_ITEM_STEP}）</div><div className="flex justify-between text-[9px] font-bold"><span className="text-slate-500">所持数</span><span className="text-slate-300 font-black">{have.toLocaleString()}</span></div>{have<need&&<div className="text-[8px] text-red-400 font-black">虹のプシュケーが足りません（あと {(need-have).toLocaleString()}）</div>}</div>;})()}<div className="text-[10px] text-slate-300 mb-2">LvUPする固有技を1つ選べます（最大Lv.8）。選ばないときは「あとで決める」でポイントとして残せます</div><div className="space-y-2 flex-1 overflow-y-auto mh-scroll">{skills.map(skill=><button key={skill.key} disabled={skill.level>=MAX_UNIQUE_SKILL_LEVEL} onClick={()=>setRebirthSkillKey(skill.key)} className={`w-full p-3 rounded-xl border text-left disabled:opacity-30 ${rebirthSkillKey===skill.key?'bg-violet-700 border-white':'bg-slate-900 border-violet-500/40'}`}><div className="font-black text-xs">{skill.name}</div><div className="text-[10px] text-amber-300">現在Lv.{skill.level} → Lv.{Math.min(MAX_UNIQUE_SKILL_LEVEL,skill.level+1)}</div></button>)}
{/* 固有技を上げずに突破する道。全部の技が最大まで育っていても限界突破できるようにするためのもの。
残したぶんはマスモンの詳細からいつでも使える */}
<button onClick={()=>setRebirthSkillKey('')} className={`w-full p-3 rounded-xl border text-left ${rebirthSkillKey===''?'bg-amber-700 border-white':'bg-slate-900 border-amber-500/40'}`}><div className="font-black text-xs">あとで決める（ポイントとして残す）</div><div className="text-[10px] text-amber-300">固有技ポイント +1（いまの所持 {normalized.uniqueSkillPoints}）</div><div className="text-[9px] text-slate-300 mt-1">保留したポイントはマスモン詳細の「固有技強化」から使用できます</div></button></div>{rebirthError&&<div className="text-red-300 text-[10px] my-2">{rebirthError}</div>}<button disabled={rebirthSkillKey==null||gold<cost||ownedItemCount(ownedItems,BREAKTHROUGH_ITEM_ID)<breakthroughItemCost(normalizeMasuProgression(selected).rebirthCount+1)||rebirthProcessingRef.current} onClick={executeMasuBreakthrough} className="w-full py-3.5 bg-violet-600 rounded-2xl font-black disabled:opacity-30">限界突破する</button></div>;
    
}

function MasuReincarnateScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, buildUnifiedMonsterEntries, executeMasuReincarnation, getRebirthSkillChoices,
  gold, masuMons, monsterDisplayFlags, monsterEntryMatchesDisplayFlags, monsterEntryMatchesLineage,
  monsterRosterIds, onBackToTemple, reincarnateError, reincarnateProcessingRef, reincarnateSelectedId,
  reincarnateSkillKey, renderMonsterCardBody, renderMonsterSortFilterBar, renderScreenNote, setReincarnateError,
  setReincarnateSelectedId, setReincarnateSkillKey, sortMonsterEntries,
}) {

      const selected=masuMons.find(m=>String(m.id)===String(reincarnateSelectedId));
      if (!selected) {
        const entries=sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds)).filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)&&monsterEntryMatchesLineage(e));
        return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button onClick={onBackToTemple} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">転生</h2></div><div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="reincarnate" compact/></div>{renderScreenNote('reincarnate',`絆Lv.${REINCARNATE_MIN_LEVEL}以上のマスモンは、強化を振り直せます。`,[`レベルが${REINCARNATE_LEVEL_DROP}下がる代わりに、振った強化をすべて振り直せます。`,'限界突破の回数や★はそのまま残ります。'])}{renderMonsterSortFilterBar({singleType:true})}<div className="grid grid-cols-3 gap-2 overflow-y-auto mh-scroll">{entries.map(({masu})=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const lvl=masuBondLevelInfo(masu);const can=lvl.level>=REINCARNATE_MIN_LEVEL;return <button key={masu.id} disabled={!can} onClick={()=>{setReincarnateSelectedId(masu.id);setReincarnateSkillKey(null);setReincarnateError('');}} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-violet-500/40 bg-slate-900 disabled:opacity-35`}>{renderMonsterCardBody({masu,base,status:<ReincarnateBadge count={masu.reincarnateCount} className="is-inline"/>})}</button>})}</div></div>;
      }
      const normalized=normalizeMasuProgression(selected), base=ALL_PLAYER_MONSTERS[selected.baseId], lvl=masuBondLevelInfo(selected), cost=masuRebirthCost(lvl.level), skills=getRebirthSkillChoices(selected);
      const nextLevel=Math.max(1, lvl.level-REINCARNATE_LEVEL_DROP);
      const nextPoints=(nextLevel-1)+totalBreakthroughPoints(normalized.rebirthCount)+normalized.reincarnateBonusPoints+REINCARNATE_POINTS+normalized.inheritedReincarnateBonusPoints;
      return <div className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2 mb-3"><button disabled={reincarnateProcessingRef.current} onClick={()=>setReincarnateSelectedId(null)} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-violet-300">転生・固有技選択</h2></div>
        <div className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3 mb-3"><div className="relative w-20 h-20 rounded-full overflow-hidden"><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/><RebirthStars count={selected.rebirthCount} className="mh-rebirth-stars-overlay"/><ReincarnateBadge count={normalized.reincarnateCount}/></div><div><b>{selected.name}</b><div className="text-pink-300 text-xs">Lv.{lvl.level} → Lv.{nextLevel}</div><div className="text-slate-400 text-[10px]">上限Lv.{normalized.levelCap}はそのまま。振った強化は白紙に戻ります</div><div className="text-amber-300 text-[10px] font-black">振り直せる強化ポイント {nextPoints}（うち転生ぶん +{REINCARNATE_POINTS}）</div></div></div>
        <div className="bg-black/40 p-3 rounded-xl border border-violet-500/30 mb-3 space-y-1.5"><div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要ダイヤ</span><span className={`font-black flex items-center gap-1 ${gold>=cost?'text-amber-300':'text-red-400'}`}><Gem size={12}/>{cost.toLocaleString()}</span></div><div className="text-[8px] text-slate-400">（絆Lv.{lvl.level}）× {REBIRTH_COST_PER_LEVEL}</div><div className="flex justify-between text-[9px] font-bold"><span className="text-slate-500">所持ダイヤ</span><span className="text-slate-300 font-black">{gold.toLocaleString()}</span></div>{gold<cost&&<div className="text-[8px] text-red-400 font-black">ダイヤが足りません（あと {(cost-gold).toLocaleString()}）</div>}</div>
        <div className="text-[10px] text-slate-300 mb-2">LvUPする固有技を1つ選べます（最大Lv.8）。選ばないときは「あとで決める」でポイントとして残せます</div>
        <div className="space-y-2 flex-1 overflow-y-auto mh-scroll">{skills.map(skill=><button key={skill.key} disabled={skill.level>=MAX_UNIQUE_SKILL_LEVEL} onClick={()=>setReincarnateSkillKey(skill.key)} className={`w-full p-3 rounded-xl border text-left disabled:opacity-30 ${reincarnateSkillKey===skill.key?'bg-violet-700 border-white':'bg-slate-900 border-violet-500/40'}`}><div className="font-black text-xs">{skill.name}</div><div className="text-[10px] text-amber-300">現在Lv.{skill.level} → Lv.{Math.min(MAX_UNIQUE_SKILL_LEVEL,skill.level+1)}</div></button>)}
        {/* 固有技を上げずに転生する道。全部の技が最大まで育っていても転生できるようにする */}
        <button onClick={()=>setReincarnateSkillKey('')} className={`w-full p-3 rounded-xl border text-left ${reincarnateSkillKey===''?'bg-amber-700 border-white':'bg-slate-900 border-amber-500/40'}`}><div className="font-black text-xs">あとで決める（ポイントとして残す）</div><div className="text-[10px] text-amber-300">固有技ポイント +1（いまの所持 {normalized.uniqueSkillPoints}）</div><div className="text-[9px] text-slate-300 mt-1">保留したポイントはマスモン詳細の「固有技強化」から使用できます</div></button></div>
        {reincarnateError&&<div className="text-red-300 text-[10px] my-2">{reincarnateError}</div>}
        <button disabled={reincarnateSkillKey==null||gold<cost||reincarnateProcessingRef.current} onClick={executeMasuReincarnation} className="w-full py-3.5 bg-violet-600 rounded-2xl font-black disabled:opacity-30">転生する</button></div>;
    
}

function MasuTranscendenceScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, buildUnifiedMonsterEntries, executeMasuTranscendence, gold,
  masuMons, monsterDisplayFlags, monsterEntryMatchesDisplayFlags, monsterEntryMatchesLineage, monsterRosterIds,
  onBackToTemple, ownedItems, renderMonsterCardBody, renderMonsterSortFilterBar, setTranscendError,
  setTranscendSelectedId, sortMonsterEntries, transcendError, transcendProcessingRef, transcendSelectedId,
}) {

      const psycheHave = ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID);
      const selected = masuMons.find(m=>String(m.id)===String(transcendSelectedId));
      if (!selected) {
        const entries = sortMonsterEntries(buildUnifiedMonsterEntries([], masuMons, monsterRosterIds))
          .filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e, monsterDisplayFlags)&&monsterEntryMatchesLineage(e));
        return <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
          <div className="flex items-center gap-2 mb-3 shrink-0"><button onClick={onBackToTemple} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-amber-200">超越</h2></div>
          <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="transcendence" compact/></div>
          <div className="text-[10px] text-slate-400 mb-3 shrink-0">Lv.{MAX_MASU_LEVEL_CAP}・虹★{BREAKTHROUGH_STARS_PER_TIER}（限界突破{FINAL_BREAKTHROUGH_COUNT}回）まで育てたマスモンだけが超越できます。超越するとLv上限が{TRANSCEND_LEVEL_CAP}になり、Lv{MAX_MASU_LEVEL_CAP+1}以降のレベルアップで超越ポイントを獲得します。1個体につき1回だけです。</div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/40 bg-amber-950/30 px-3 py-2 mb-3 shrink-0">
            <span className="text-[10px] font-black text-amber-200 flex items-center gap-1"><span aria-hidden="true">🌈</span>虹のプシュケー</span>
            <span className="text-[11px] font-mono font-black text-white">所持 {psycheHave.toLocaleString()}</span>
          </div>
          <div className="text-[9px] text-slate-500 font-bold mb-2 shrink-0">超越には虹のプシュケー{TRANSCEND_PSYCHE_COST.toLocaleString()}個とダイヤ{TRANSCEND_DIAMOND_COST.toLocaleString()}が必要です。</div>
          {renderMonsterSortFilterBar({singleType:true})}
          <div className="grid grid-cols-3 gap-2 overflow-y-auto mh-scroll">{entries.map(({masu})=>{
            const base=ALL_PLAYER_MONSTERS[masu.baseId]; if(!base) return null;
            const lvl=masuBondLevelInfo(masu); const normalized=normalizeMasuProgression(masu);
            const eligible=canTranscendMasu(masu);
            return <button key={masu.id} data-transcend-candidate={masu.id} disabled={!eligible.ok} onClick={()=>{setTranscendSelectedId(masu.id);setTranscendError('');}} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-amber-400/40 bg-slate-900 disabled:opacity-35`}>
              {renderMonsterCardBody({masu,base,status:<span className={`text-[8px] font-black ${normalized.transcended?'text-amber-300':eligible.ok?'text-emerald-300':'text-slate-500'}`}>{normalized.transcended?'超越済み':eligible.ok?'超越できます':'条件未達'}</span>})}
            </button>;
          })}</div>
        </div>;
      }
      const base=ALL_PLAYER_MONSTERS[selected.baseId];
      const lvl=masuBondLevelInfo(selected);
      const normalized=normalizeMasuProgression(selected);
      const plan=buildMasuTranscendence({ masu:selected, gold, psycheOwned:psycheHave });
      const psycheShort=Math.max(0, TRANSCEND_PSYCHE_COST - psycheHave);
      const goldShort=Math.max(0, TRANSCEND_DIAMOND_COST - gold);
      return <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}} data-transcend-confirm={selected.id}>
        <div className="flex items-center gap-2 mb-2 shrink-0"><button disabled={transcendProcessingRef.current} onClick={()=>{setTranscendSelectedId(null);setTranscendError('');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-amber-200">超越の儀式</h2></div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2.5">
          <div className="flex items-center gap-3 bg-slate-900 rounded-2xl p-3">
            <div className="relative w-20 h-20 rounded-full overflow-visible shrink-0"><div className="w-20 h-20 rounded-full overflow-hidden"><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/></div><RebirthStars count={selected.rebirthCount} className="mh-rebirth-stars-overlay"/><TranscendenceBadge transcended={normalized.transcended} soulRankStage={normalized.soulRankStage}/></div>
            <div className="min-w-0">
              <b className="block truncate">{selected.name}</b>
              <div className="text-pink-300 text-xs">Lv.{lvl.level} / {normalized.levelCap}</div>
              <div className="text-amber-200 text-[10px] font-black">虹★{BREAKTHROUGH_STARS_PER_TIER}（限界突破{normalized.rebirthCount}回）</div>
              <div className="text-emerald-300 text-[10px] font-black">超越するとLv上限が{TRANSCEND_LEVEL_CAP}になります</div>
            </div>
          </div>
          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-3 text-[10px] leading-relaxed text-slate-200 space-y-1.5">
            <p>Lv.{MAX_MASU_LEVEL_CAP}・虹★{BREAKTHROUGH_STARS_PER_TIER}まで育ったマスモンだけが行える、限界の先へ進むための特別な儀式です。</p>
            <p>超越するとLv{MAX_MASU_LEVEL_CAP+1}以降の成長が解放され、Lv上限が{TRANSCEND_LEVEL_CAP}になります。</p>
            <p>Lv{MAX_MASU_LEVEL_CAP+1}以降のレベルアップでは通常の強化ポイントではなく「超越ポイント」を獲得します。</p>
            <p>超越ポイントは通常の強化とは別に、モンスターの基礎能力を永久的に強化できます。</p>
            <p>超越状態と超越強化は、転生や強化ポイントリセットを行っても失われません。</p>
          </div>
          <div className="rounded-xl border border-fuchsia-500/30 bg-black/40 p-3 space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要な虹のプシュケー</span><span className={`font-black flex items-center gap-1 ${psycheShort===0?'text-fuchsia-300':'text-red-400'}`}><span aria-hidden="true">🌈</span>{TRANSCEND_PSYCHE_COST.toLocaleString()}</span></div>
            <div className="flex justify-between text-[9px] font-bold"><span className="text-slate-500">所持数</span><span className="text-slate-300 font-black">{psycheHave.toLocaleString()}</span></div>
            {psycheShort>0&&<div className="text-[8px] text-red-400 font-black">虹のプシュケーが足りません（あと {psycheShort.toLocaleString()}）</div>}
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-black/40 p-3 space-y-1.5">
            <div className="flex justify-between text-[10px] font-bold"><span className="text-slate-400">必要ダイヤ</span><span className={`font-black flex items-center gap-1 ${goldShort===0?'text-amber-300':'text-red-400'}`}><Gem size={12}/>{TRANSCEND_DIAMOND_COST.toLocaleString()}</span></div>
            <div className="flex justify-between text-[9px] font-bold"><span className="text-slate-500">所持ダイヤ</span><span className="text-slate-300 font-black">{gold.toLocaleString()}</span></div>
            {goldShort>0&&<div className="text-[8px] text-red-400 font-black">ダイヤが足りません（あと {goldShort.toLocaleString()}）</div>}
          </div>
          <div className="rounded-xl border-2 border-red-400/60 bg-red-950/40 px-3 py-2 text-center text-[11px] font-black text-red-200">⚠ 超越は取り消せません</div>
          {transcendError&&<div className="text-[10px] text-red-400 font-black text-center">{transcendError}</div>}
        </div>
        <button data-transcend-execute disabled={!plan.ok||transcendProcessingRef.current} onClick={executeMasuTranscendence} className="shrink-0 mt-3 min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-amber-500 via-fuchsia-500 to-sky-400 text-slate-950 font-black text-sm disabled:opacity-40 disabled:from-slate-700 disabled:via-slate-700 disabled:to-slate-700 disabled:text-slate-400 active:scale-[.98]">超越する</button>
      </div>;
    
}

function MasuSoulRankScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, buildUnifiedMonsterEntries, executeMasuSoulRankEvolution, gold,
  masuMons, monsterDisplayFlags, monsterEntryMatchesDisplayFlags, monsterEntryMatchesLineage, monsterRosterIds,
  onBackToTemple, ownedItems, renderMonsterCardBody, renderMonsterSortFilterBar, setSoulRankError,
  setSoulRankSelectedId, sortMonsterEntries, soulRankError, soulRankProcessingRef, soulRankSelectedId,
}) {

      const heroProofHave=ownedItemCount(ownedItems,HERO_PROOF_ITEM_ID);
      const selected=masuMons.find(m=>String(m.id)===String(soulRankSelectedId));
      if(!selected){
        const entries=sortMonsterEntries(buildUnifiedMonsterEntries([],masuMons,monsterRosterIds))
          .filter(e=>e.type==='masu'&&monsterEntryMatchesDisplayFlags(e,monsterDisplayFlags)&&monsterEntryMatchesLineage(e));
        return <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
          <div className="flex items-center gap-2 mb-3 shrink-0"><button onClick={onBackToTemple} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic text-sky-200">魂格進化</h2></div>
          <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="temple" compact/></div>
          <div className="rounded-xl border border-sky-400/30 bg-sky-950/20 p-3 mb-2 text-[10px] leading-relaxed text-slate-300 shrink-0">超越後、現在のLv上限まで育ったマスモンを次の魂格へ進化できます。進化しても現在Lvは上がらず、Lv上限だけが100解放されます。</div>
          <div className="flex items-center justify-between rounded-xl border border-amber-400/40 bg-amber-950/30 px-3 py-2 mb-3 shrink-0"><span className="text-[10px] font-black text-amber-200">🏅 勇者の証</span><span className="text-[11px] font-mono font-black text-white">所持 {heroProofHave.toLocaleString()}</span></div>
          {renderMonsterSortFilterBar({singleType:true})}
          <div className="grid grid-cols-3 gap-2 overflow-y-auto mh-scroll">{entries.map(({masu})=>{
            const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;
            const status=soulRankEvolutionStatus(masu);
            const normalized=normalizeMasuProgression(masu);
            const canOpen=status.ok;
            const label=normalized.soulRankStage>0?'魂格'+['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][normalized.soulRankStage]:normalized.transcended?'超越済み':'未超越';
            const sub=!status.ok?status.reason:status.levelReady?status.next.label+'へ進化可能':'Lv.'+status.next.requiredLevel+'で'+status.next.label;
            return <button key={masu.id} data-soul-rank-candidate={masu.id} disabled={!canOpen} onClick={()=>{setSoulRankSelectedId(masu.id);setSoulRankError('');}} style={MONSTER_CARD_STYLE} className={MONSTER_CARD_CLASS+' border-sky-400/40 bg-slate-900 disabled:opacity-35'}>
              {renderMonsterCardBody({masu,base,nameBand:true,status:<span className="block text-center"><b className="text-[8px] text-sky-200">{label}</b><small className={'block text-[7px] '+(status.levelReady?'text-emerald-300':'text-slate-500')}>{sub}</small></span>})}
            </button>;
          })}</div>
        </div>;
      }
      const base=ALL_PLAYER_MONSTERS[selected.baseId];
      const status=soulRankEvolutionStatus(selected);
      if(!status.next){
        return <div data-mh-screen className="flex-1 flex flex-col h-full p-4"><div className="flex items-center gap-2"><button onClick={()=>setSoulRankSelectedId(null)} className="p-3 text-slate-400"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-sky-200">魂格進化</h2></div><div className="m-auto text-center text-sm font-black text-slate-300">魂格Ⅴまで進化済みです。</div></div>;
      }
      const plan=buildMasuSoulRankEvolution({masu:selected,gold,ownedItems});
      const next=status.next;
      const normalized=normalizeMasuProgression(selected);
      const level=masuBondLevelInfo(selected).level;
      const goldShort=Math.max(0,next.diamondCost-gold);
      const proofShort=Math.max(0,next.heroProofCost-heroProofHave);
      return <div data-mh-screen data-soul-rank-confirm={selected.id} className="flex-1 flex flex-col h-full min-h-0 p-4" style={{paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <div className="flex items-center gap-2 mb-2 shrink-0"><button disabled={soulRankProcessingRef.current} onClick={()=>{setSoulRankSelectedId(null);setSoulRankError('');}} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black italic" style={{color:next.accent}}>魂格進化の儀</h2></div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2.5">
          <div className="flex items-center gap-3 rounded-2xl bg-slate-900 p-3 border" style={{borderColor:next.accent+'66'}}>
            <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 border-2" style={{borderColor:next.accent}}><DyedMonsterImage baseId={selected.baseId} src={base?.iconUrl} alt={selected.name} masuColors={getMasuColors(selected)} className="w-full h-full object-cover"/></div>
            <div className="min-w-0 flex-1"><b className="block truncate">{selected.name}</b><div className="text-pink-300 text-xs">Lv.{level} / {normalized.levelCap}</div><div className="text-[10px] font-black text-slate-300">{status.currentLabel} → <span style={{color:next.accent}}>{next.label}</span></div><div className="text-[10px] font-black text-emerald-300">Lv上限 {normalized.levelCap} → {next.levelCap}</div></div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
            <div className="flex justify-between text-[10px]"><span className="text-slate-400">必要Lv</span><b className={level>=next.requiredLevel?'text-emerald-300':'text-red-300'}>Lv.{level} / Lv.{next.requiredLevel}</b></div>
            <div className="flex justify-between text-[10px]"><span className="text-slate-400">必要ダイヤ</span><b className={goldShort===0?'text-amber-300':'text-red-300'}>{gold.toLocaleString()} / {next.diamondCost.toLocaleString()}</b></div>
            <div className="flex justify-between text-[10px]"><span className="text-slate-400">必要な勇者の証</span><b className={proofShort===0?'text-amber-200':'text-red-300'}>{heroProofHave.toLocaleString()} / {next.heroProofCost.toLocaleString()}</b></div>
            {goldShort>0&&<div className="text-[8px] text-red-300 font-black">ダイヤ あと {goldShort.toLocaleString()}</div>}
            {proofShort>0&&<div className="text-[8px] text-red-300 font-black">勇者の証 あと {proofShort.toLocaleString()}</div>}
          </div>
          <div className="rounded-xl border border-sky-400/30 bg-sky-950/20 p-3 text-[10px] text-slate-300 leading-relaxed">進化後も現在Lv.{level}のままです。Lv上限だけ{next.levelCap}へ解放され、その後の初到達Lvで魂格Pを獲得できます。</div>
          <div className="rounded-xl border-2 border-red-400/50 bg-red-950/30 px-3 py-2 text-center text-[10px] font-black text-red-200">⚠ 魂格進化は取り消せません</div>
          {soulRankError&&<div className="text-[10px] text-red-400 font-black text-center">{soulRankError}</div>}
        </div>
        <button data-soul-rank-execute disabled={!plan.ok||soulRankProcessingRef.current} onClick={executeMasuSoulRankEvolution} className="shrink-0 mt-3 min-h-[52px] w-full rounded-2xl text-slate-950 font-black text-sm disabled:opacity-35 active:scale-[.98]" style={{background:next.stage===5?'linear-gradient(90deg,#60a5fa,#facc15,#4ade80,#f87171,#e879f9)':next.accent}}>{plan.ok?next.label+'へ進化する':plan.reason}</button>
      </div>;
    
}

function MasuRegenerationResult({
  onCloseRegenerationResult, regenerationResult,
}) {
const statRows=[['ライフ','hp','baseHp'],['ちから','atk','baseAtk'],['丈夫さ','def','baseDef'],['ガッツ','guts','baseGuts']];return <div className="mh-regeneration-animation" role="dialog" aria-modal="true"><img src={REGENERATION_DISC_IMAGE} alt="円盤石" className="mh-regeneration-disc"/><div className="mh-regeneration-born"><img src={regenerationResult.base.iconUrl} alt={regenerationResult.masu.name} className="w-28 h-28 object-contain mx-auto"/><h3>モンスター誕生！</h3><div className="text-[8px] text-slate-400 font-bold mt-1">ベースモンの基礎値との差</div><div className="grid grid-cols-2 gap-1 text-[11px] text-left mt-2">{statRows.map(([label,key,baseKey])=>{const value=regenerationResult.masu.individualStats[key];const delta=value-regenerationResult.base[baseKey];return <span key={key}>{label} <b>{value} <small className={`text-[9px] ${delta>0?'text-emerald-300':delta<0?'text-red-300':'text-slate-400'}`}>（{delta>0?'+':delta<0?'':'±'}{delta}）</small></b></span>;})}</div><button onClick={onCloseRegenerationResult} className="mt-4 w-full py-3 bg-amber-500 text-black rounded-xl font-black">一覧へ戻る</button></div></div>;
}

function MasuLevelCapCompensation({
  levelCapCompensation, onCloseLevelCapCompensation,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-5" style={{position:'fixed',inset:0,zIndex:50000,backgroundColor:'rgba(2,6,23,.96)'}}><div className="max-w-sm w-full bg-slate-900 border-2 border-amber-400 rounded-3xl p-6 text-center"><Gem size={38} className="text-amber-300 mx-auto mb-3"/><h2 className="font-black text-lg mb-2">Lv30上限補償</h2><p className="text-[11px] text-slate-300 leading-relaxed">Lv30を超えていた未限界突破マスモンの超過絆経験値を削除し、同数のダイヤへ還元しました。</p><div className="text-2xl text-amber-300 font-black my-4">+{levelCapCompensation.diamonds.toLocaleString()} ダイヤ</div><button onClick={onCloseLevelCapCompensation} className="w-full bg-amber-500 text-black py-3 rounded-2xl font-black">受け取る</button></div></div>
  );
}

function MasuInheritedUniqueCompensation({
  setInheritedUniqueCompensation,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-5" style={{position:'fixed',inset:0,zIndex:49999,backgroundColor:'rgba(2,6,23,.96)'}}><div className="max-w-sm w-full bg-slate-900 border-2 border-fuchsia-400 rounded-3xl p-6 text-center"><div className="text-4xl mb-3">🌈</div><h2 className="font-black text-lg mb-2">お詫びの配布</h2><p className="text-[11px] text-slate-300 leading-relaxed">継承固有技Lv不具合修正のお詫びとして虹のプシュケー×20を配布しました。</p><button onClick={()=>setInheritedUniqueCompensation(false)} className="w-full bg-fuchsia-500 text-white py-3 mt-5 rounded-2xl font-black">確認</button></div></div>
  );
}

function MasuRebirthAnimation({
  rebirthAnimation,
}) {

      const starList=breakthroughStars(rebirthAnimation.masu.rebirthCount||1);
      const finalBreak=isFinalBreakthroughCount(rebirthAnimation.masu.rebirthCount);
      return <div className="mh-breakthrough-animation" role="status" aria-live="polite">
        <div className="mh-breakthrough-beam"></div>
        <div className="mh-breakthrough-ring"></div>
        <div className="mh-breakthrough-cap">レベル上限<b>Lv.{rebirthAnimation.masu.levelCap}</b></div>
        <div className="mh-breakthrough-mon"><DyedMonsterImage baseId={rebirthAnimation.masu.baseId} src={rebirthAnimation.base?.iconUrl} alt={rebirthAnimation.masu.name} masuColors={getMasuColors(rebirthAnimation.masu)} className="w-full h-full object-contain"/></div>
        {/* 新しく増えた★は先頭。最終限界突破では5個とも虹になるので全部を「増えた★」として光らせる */}
        <div className="mh-breakthrough-stars" aria-hidden="true">{starList.map((s,i)=>renderBreakthroughStar(s,i,{ className:`${s.image?'mh-rainbow-breakthrough-star ':''}${(finalBreak||i===0)?'is-new':'is-old'}` }))}</div>
        <div className="mh-breakthrough-copy"><b>{finalBreak?'最終限界突破！':'限界突破！'}</b><span>{finalBreak?'★ が虹になりました':'★ が1つ増えました'}</span><span>{rebirthAnimation.raisesSkill===false?`固有技ポイント +1（所持 ${rebirthAnimation.keptSkillPoints}）`:`${rebirthAnimation.skillName} Lv.${rebirthAnimation.skillLevel}へ進化`}</span><span>強化ポイント +{rebirthAnimation.gainedPoints}</span></div>
      </div>;
    
}

function MasuTranscendAnimation({
  transcendAnimation,
}) {
  return (
<div className="mh-transcend-animation" role="status" aria-live="polite">
      <div className="mh-transcend-converge" aria-hidden="true"><i style={{'--i':0}}/><i style={{'--i':1}}/><i style={{'--i':2}}/><i style={{'--i':3}}/><i style={{'--i':4}}/><i style={{'--i':5}}/><i style={{'--i':6}}/><i style={{'--i':7}}/></div>
      <div className="mh-transcend-halo" aria-hidden="true"></div>
      <div className="mh-transcend-halo is-second" aria-hidden="true"></div>
      <div className="mh-transcend-rays" aria-hidden="true"></div>
      <div className="mh-transcend-mon"><DyedMonsterImage baseId={transcendAnimation.masu.baseId} src={transcendAnimation.base?.iconUrl} alt={transcendAnimation.masu.name} masuColors={getMasuColors(transcendAnimation.masu)} className="w-full h-full object-contain"/></div>
      <div className="mh-transcend-flash" aria-hidden="true"></div>
      <div className="mh-transcend-shock" aria-hidden="true"></div>
      <div className="mh-transcend-title" aria-hidden="true">超　越</div>
      <div className="mh-transcend-mark" aria-hidden="true"><TranscendenceBadge transcended/></div>
      <div className="mh-transcend-copy"><b>超越完了！</b><span>Lv上限 {transcendAnimation.fromLevelCap} → {transcendAnimation.toLevelCap}</span><span>Lv{MAX_MASU_LEVEL_CAP+1}以降が解放されました</span><span>超越ポイントが解放されました</span></div>
    </div>
  );
}

function MasuSoulRankAnimation({
  soulRankAnimation,
}) {
  return (
<div data-soul-rank-animation role="status" aria-live="polite" className="fixed inset-0 flex items-center justify-center p-5" style={{position:'fixed',inset:0,zIndex:50500,backgroundColor:'rgba(2,6,23,.94)',paddingTop:'calc(1rem + env(safe-area-inset-top))',paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
      <div className="w-full max-w-xs rounded-3xl border-2 p-6 text-center shadow-2xl" style={{borderColor:soulRankAnimation.step.accent,background:soulRankAnimation.toStage===5?'linear-gradient(145deg,rgba(30,64,175,.55),rgba(113,63,18,.45),rgba(20,83,45,.45),rgba(127,29,29,.45),rgba(88,28,135,.55))':'rgba(15,23,42,.96)'}}>
        <div className="text-[10px] font-black tracking-[.3em] text-slate-400 mb-2">SOUL RANK</div>
        <Sparkles size={28} className="mx-auto mb-2" style={{color:soulRankAnimation.step.accent}}/>
        <div className="w-28 h-28 mx-auto rounded-full overflow-hidden border-4 mb-3" style={{borderColor:soulRankAnimation.step.accent,boxShadow:'0 0 36px '+soulRankAnimation.step.accent+'88'}}><DyedMonsterImage baseId={soulRankAnimation.masu.baseId} src={soulRankAnimation.base?.iconUrl} alt={soulRankAnimation.masu.name} masuColors={getMasuColors(soulRankAnimation.masu)} className="w-full h-full object-cover"/></div>
        <div className="text-[11px] text-slate-400 font-black">{soulRankAnimation.fromStage>0?'魂格'+['','Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'][soulRankAnimation.fromStage]:'超越'} →</div>
        <div className="text-3xl font-black my-1" style={{color:soulRankAnimation.step.accent}}>{soulRankAnimation.step.label}</div>
        <div className="text-[12px] font-black text-emerald-300">Lv上限 {soulRankAnimation.fromLevelCap} → {soulRankAnimation.toLevelCap}</div>
      </div>
    </div>
  );
}

function MasuReincarnateAnimation({
  reincarnateAnimation,
}) {
  return (
<div className="mh-reincarnation-animation" role="status" aria-live="polite"><div className="mh-reincarnation-light"></div><div className="mh-reincarnation-mon mh-reincarnate-stack"><DyedMonsterImage baseId={reincarnateAnimation.masu.baseId} src={reincarnateAnimation.base?.iconUrl||reincarnateAnimation.base?.imgUrl} alt={reincarnateAnimation.masu.name} masuColors={getMasuColors(reincarnateAnimation.masu)} className="w-full h-full object-contain"/><SoulRankAura soulRankStage={normalizeMasuProgression(reincarnateAnimation.masu).soulRankStage} className="is-ceremony"/><RebirthStars count={reincarnateAnimation.masu.rebirthCount} className="mh-rebirth-stars-overlay"/></div><div className="mh-reincarnation-copy"><b>転生完了！</b><span>Lv.{reincarnateAnimation.fromLevel} → Lv.{reincarnateAnimation.nextLevel}</span><span>{reincarnateAnimation.raisesSkill===false?`固有技ポイント +1（所持 ${reincarnateAnimation.keptSkillPoints}）`:`${reincarnateAnimation.skillName} Lv.${reincarnateAnimation.skillLevel}へ進化`}</span><span>強化ポイント {reincarnateAnimation.nextPoints} を振り直せます</span></div></div>
  );
}

function MasuDonationAnimation({
  donationAnimation,
}) {
  return (
<div className="mh-donation-animation" role="status" aria-live="polite" aria-label="寄付を処理中"><div className="mh-donation-beam"></div><div className="mh-donation-monster"><DyedMonsterImage baseId={donationAnimation.baseId} src={donationAnimation.src} alt={donationAnimation.name} masuColors={donationAnimation.colors} className="w-full h-full object-contain"/></div><div className="mh-donation-gem"><Gem size={42}/></div><div className="mh-donation-particles">{Array.from({length:8},(_,i)=><i key={i} style={{'--i':i}}></i>)}</div><div className="mh-donation-copy">神殿へ寄付中…</div></div>
  );
}
