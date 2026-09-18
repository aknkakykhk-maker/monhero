// ==== 画面: 神殿の再生と寄付 ====
//
// MonsterHeroGame から切り出した11本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
// MASU_REGENERATION / MASU_REGENERATION_DETAIL / MASU_DONATION と、
// 寄付の「最終確認」「結果」——同じ gameState にぶら下がる兄弟ブロック——をまとめて置いた。
//
// 【この画面ならではの注意】
// ・保存は一切していない。ダイヤ・所持個体の更新は MonsterHeroGame 側の
//   executeMasuRegeneration / executeMasuDonation が担うので、props で受けて呼ぶだけ
// ・二重実行を止める regenerationProcessing / donationProcessing は真偽値で受け取る
//   (元は ref ではなく state なので、そのまま渡してよい)
// ・寄付の確認と結果は gameState='MASU_DONATION' の中の出し分けなので、
//   条件(donationConfirmOpen / donationResult)は呼び出し側に残してある
// ・この画面にタイマーは無い(演出の停止は本体の execute* の中にある)

function MasuRegenerationScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, onBackToTemple, onSelectBase, renderMonsterCardBody,
  unlockedMonsterIds,
}) {
const unlocked=Object.values(ALL_PLAYER_MONSTERS).filter(m=>unlockedMonsterIds.includes(m.id));return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="ベースモンを選ぶ" accent="text-violet-300" note="タップすると再生前の性能を確認できます" onBack={onBackToTemple} backLabel="神殿へ戻る"/><div className={SCREEN_LIST_CLASS}>{unlocked.length===0?<ScreenEmpty emoji="🥚" lines={['再生できるベースモンがいません。','モンスターを手に入れると選べるようになります。']}/>:<div className="grid grid-cols-3 gap-2 pb-3">{unlocked.map(base=><button key={base.id} onClick={()=>onSelectBase(base.id)} aria-label={`${base.name}の再生詳細を見る`} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-violet-500/30 bg-slate-900`}>{renderMonsterCardBody({base})}</button>)}</div>}</div></div>;
}

function MasuRegenerationDetailScreen({
  executeMasuRegeneration, gold, onBackToBaseSelect, regenerationProcessing, regenerationSelectedId,
  regenerationUsed, renderDetailSectionLabel, renderMonsterDetailInfo,
}) {
const cost=regenerationUsed?REGENERATION_COST:0;const selectedBase=regenerationSelectedId?ALL_PLAYER_MONSTERS[regenerationSelectedId]:null;if(!selectedBase)return null;return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="再生詳細" accent="text-violet-300" onBack={onBackToBaseSelect} backLabel="ベースモン選択へ戻る" disabled={regenerationProcessing}/><div className={`${SCREEN_LIST_CLASS} space-y-2 pb-3`}><h2 className="text-center text-xl font-black text-white">{selectedBase.name}</h2><img src={selectedBase.iconUrl} alt={selectedBase.name} className="w-32 h-32 max-w-full mx-auto object-contain"/><section className="space-y-2" aria-label={`${selectedBase.name}の基礎性能`}>{renderDetailSectionLabel('ベースモンの性能', '再生前の正式な基礎値です')}{renderMonsterDetailInfo(selectedBase)}</section><section className="rounded-2xl border border-amber-400/60 bg-amber-950/30 p-3" aria-label="再生に必要な情報"><div className="text-[10px] text-amber-200 font-black mb-1">再生に必要な情報</div><div className="flex items-center justify-between text-sm"><span className="text-slate-300">対象</span><b className="text-white">{selectedBase.name}</b></div><div className="flex items-center justify-between text-sm mt-1"><span className="text-slate-300">必要ダイヤ</span><b className="text-amber-300">{cost===0?'初回無料':cost.toLocaleString()}</b></div><div className="flex items-center justify-between text-[10px] mt-1"><span className="text-slate-400">所持ダイヤ</span><span className="text-slate-300">{gold.toLocaleString()}</span></div></section><button disabled={gold<cost||regenerationProcessing} onClick={executeMasuRegeneration} className="w-full min-h-[52px] rounded-2xl bg-violet-600 text-sm font-black active:scale-[.98] disabled:opacity-30">{regenerationProcessing?'再生中…':gold<cost?'ダイヤが不足しています':`${selectedBase.name}を再生する`}</button></div></div>;
}

function MasuDonationScreen({
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, donationError, donationProcessing, donationSelectedIds,
  donationSortDir, donationSortKey, draftMonsterRoster, gold, masuMons,
  monsterRosterIds, onLeaveDonation, renderMonsterCardBody, setDonationConfirmOpen, setDonationError,
  setDonationSelectedIds, setDonationSortDir, setDonationSortKey, unlockedMonsterIds,
}) {

      const options=[{key:'bondXp',label:'絆経験値'},{key:'bond',label:'絆レベル'},{key:'power',label:'総合力'},{key:'name',label:'名前'},{key:'lineage',label:'血統'},{key:'newest',label:'新しい順'},{key:'active',label:'編成中'}];
      const donationArgs={masuMons, gold, monsterRosterIds, draftMonsterRoster, unlockedMonsterIds, validBaseIds:Object.keys(ALL_PLAYER_MONSTERS), requiredCount:STARTER_MONSTER_IDS.length};
      const selectedSet=new Set(donationSelectedIds.map(String));
      const selectedResult=donationSelectedIds.length?buildMasuDonations({...donationArgs,targetIds:donationSelectedIds}):null;
      const selectedDiamonds=selectedResult?.ok?selectedResult.diamonds:donationSelectedIds.reduce((sum,id)=>sum+donationDiamondValue(masuMons.find(m=>String(m.id)===String(id))?.bondXp),0);
      const selectedPsyche=selectedResult?.ok?selectedResult.psyche:donationSelectedIds.reduce((sum,id)=>{const m=masuMons.find(x=>String(x.id)===String(id));return sum+(m?donationPsycheValue(m):0);},0);
      const sorted=sortDonationMasuMons(masuMons,donationSortKey,donationSortDir,monsterRosterIds);
      return <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="寄付" accent="text-violet-300" onBack={onLeaveDonation} backLabel="神殿へ戻る" disabled={donationProcessing}/>
        <p className="shrink-0 mb-2 rounded-xl border border-violet-500/60 bg-violet-950/40 px-3 py-2 text-[10px] font-bold leading-relaxed text-slate-300">総合力と報酬を見比べて複数選べます。累計絆経験値と同じ数のダイヤを受け取れます</p>
        <div className="grid grid-cols-4 gap-1 mb-2 shrink-0" aria-label="寄付一覧の並べ替え">{options.map(o=>{const active=donationSortKey===o.key;const direction=donationSortDir==='asc'?'低い順':'高い順';const activeLabel=o.key==='power'?`${o.label}：${direction}`:`${o.label}${donationSortDir==='asc'?' ▲':' ▼'}`;return <button key={o.key} onClick={()=>{if(active)setDonationSortDir(d=>d==='asc'?'desc':'asc');else{setDonationSortKey(o.key);setDonationSortDir(o.key==='name'||o.key==='lineage'?'asc':'desc');}}} aria-pressed={active} aria-label={o.key==='power'?(active?`総合力を${direction}で表示中。押すと${donationSortDir==='asc'?'高い順':'低い順'}に変更`:'総合力を高い順に並べ替え'):undefined} className={`min-w-0 min-h-[44px] px-1 py-1 rounded-xl text-[10px] leading-tight font-black border active:scale-95 ${active?'bg-violet-600 border-violet-400 text-white':'bg-slate-900 border-white/10 text-slate-400'} ${o.key==='power'?'col-span-2':''}`}>{active?activeLabel:o.label}</button>})}</div>
        {donationError&&<div className="shrink-0 mb-2 rounded-xl border border-amber-500/60 bg-amber-950/40 p-2 text-[10px] font-bold text-amber-200"><AlertCircle size={12} className="inline mr-1"/>{donationError}</div>}
        <div className={SCREEN_LIST_CLASS}>
          {masuMons.length===0?<ScreenEmpty emoji="💎" lines={['寄付できるマスモンがいません','マスモンを育てると、ここから寄付できます。']}/>:<div className="grid grid-cols-3 gap-1.5 pb-3">{sorted.map(masu=>{const base=ALL_PLAYER_MONSTERS[masu.baseId];if(!base)return null;const diamonds=donationDiamondValue(masu.bondXp);const lvl=masuBondLevelInfo(masu);const active=monsterRosterIds.includes(`masu:${masu.id}`);const selected=selectedSet.has(String(masu.id));const trial=selected?{ok:true}:buildMasuDonations({...donationArgs,targetIds:[...donationSelectedIds,masu.id]});const canSelect=trial.ok;return <button key={masu.id} disabled={donationProcessing||(!selected&&!canSelect)} aria-pressed={selected} onClick={()=>{setDonationError('');setDonationSelectedIds(ids=>selected?ids.filter(id=>String(id)!==String(masu.id)):[...ids,masu.id]);}} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} bg-slate-900 disabled:opacity-35 ${selected?'border-amber-300 bg-violet-950/80':'border-violet-500/30'}`}>
            {renderMonsterCardBody({masu,base,
              badge:<>{active&&<span className="absolute -top-1 -left-1 z-10 rounded-full bg-pink-600/95 px-1 text-[10px] font-black leading-4 text-white">編成中</span>}{selected&&<span className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 font-black text-slate-950">✓</span>}</>,
              sub:<span className="flex items-center gap-0.5 text-[10px] font-black text-amber-300"><Gem size={8}/>{diamonds.toLocaleString()}</span>,
              status:!canSelect&&!selected?<span className="text-[10px] font-black leading-tight text-red-300">編成を維持できません</span>:null})}
          </button>})}</div>}
        </div>
        <div className="shrink-0 mt-2 rounded-2xl border border-violet-400/60 bg-slate-950 px-3 py-2 shadow-xl"><div className="flex items-center justify-between mb-2 text-[10px] font-black"><span className="text-violet-200">選択数：<b className="text-white text-sm">{donationSelectedIds.length}体</b></span><span className="text-amber-300">合計 <Gem size={11} className="inline"/> {selectedDiamonds.toLocaleString()} / 虹のプシュケー ×{selectedPsyche}</span></div><button disabled={!donationSelectedIds.length||donationProcessing||!selectedResult?.ok} onClick={()=>setDonationConfirmOpen(true)} className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-amber-600 text-sm font-black text-white active:scale-[.98] disabled:opacity-30">選んだマスモンを寄付する</button></div>
      </div>;
    
}

function MasuDonationConfirm({
  donationProcessing, donationSelectedIds, draftMonsterRoster, executeMasuDonation, gold,
  masuMons, monsterRosterIds, setDonationConfirmOpen, unlockedMonsterIds,
}) {
const selected=donationSelectedIds.map(id=>masuMons.find(m=>String(m.id)===String(id))).filter(Boolean);const result=buildMasuDonations({masuMons,targetIds:donationSelectedIds,gold,monsterRosterIds,draftMonsterRoster,unlockedMonsterIds,validBaseIds:Object.keys(ALL_PLAYER_MONSTERS),requiredCount:STARTER_MONSTER_IDS.length});if(!result.ok)return null;return <div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,.95)',zIndex:32000}} role="dialog" aria-modal="true"><div className="w-full max-w-sm rounded-2xl border-2 border-violet-400 bg-slate-900 p-5 shadow-2xl">
      <h3 className="text-lg font-black text-violet-200 text-center mb-3">寄付の最終確認</h3><div className="flex -space-x-2 justify-center mb-3">{selected.slice(0,5).map(m=>{const base=ALL_PLAYER_MONSTERS[m.baseId];return <div key={m.id} className="w-14 h-14 rounded-xl overflow-hidden border-2 border-amber-400 bg-slate-950"><DyedMonsterImage baseId={m.baseId} src={masuDisplayImageUrl(base)} alt={m.name} masuColors={getMasuColors(m)} className="w-full h-full object-contain"/></div>})}{selected.length>5&&<span className="w-14 h-14 flex items-center justify-center rounded-xl border-2 border-amber-400 bg-slate-800 font-black">+{selected.length-5}</span>}</div>
      <div className="bg-black/40 rounded-2xl p-3 space-y-1 text-[12px] mb-3"><div className="flex justify-between"><span>選択数</span><b>{selected.length}体</b></div><div className="flex justify-between text-amber-300"><span>獲得ダイヤ合計</span><b>{result.diamonds.toLocaleString()}</b></div><div className="flex justify-between text-fuchsia-300"><span>虹のプシュケー合計</span><b>×{result.psyche}</b></div><div className="flex justify-between text-slate-300"><span>寄付後の所持ダイヤ</span><b>{result.nextGold.toLocaleString()}</b></div></div>
      <div className="bg-amber-950/40 border border-amber-500/50 text-amber-100 text-[10px] leading-relaxed rounded-xl p-3 mb-3"><AlertCircle size={14} className="inline mr-1"/>選択した全マスモンがいなくなります。この操作は取り消せません。</div>
      <div className="flex gap-2"><button onClick={()=>setDonationConfirmOpen(false)} disabled={donationProcessing} className="flex-1 min-h-[48px] rounded-xl bg-slate-800 text-xs font-black text-slate-300 active:scale-95 disabled:opacity-40">戻る</button><button onClick={executeMasuDonation} disabled={donationProcessing} className="flex-[2] min-h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-amber-600 text-xs font-black text-white shadow-lg active:scale-[.98] disabled:opacity-40">{donationProcessing?'処理中…':`${selected.length}体を寄付する`}</button></div>
    </div></div>
}

function MasuDonationResult({
  donationResult, setDonationResult,
}) {
  return (
<div className="fixed inset-0 flex items-center justify-center p-4" style={{position:'fixed',inset:0,backgroundColor:'rgba(2,6,23,.96)',zIndex:32100}}><div className="w-full max-w-sm rounded-2xl border-2 border-amber-400 bg-slate-900 p-6 text-center shadow-2xl"><Gem size={48} className="text-amber-300 mx-auto mb-3"/><h3 className="text-xl font-black text-white mb-3">寄付完了</h3><p className="text-sm text-violet-200 font-bold">{donationResult.count===1?`${donationResult.name}を寄付しました`:`${donationResult.count}体をまとめて寄付しました`}</p><p className="text-lg text-amber-300 font-black mt-2">{donationResult.diamonds.toLocaleString()}ダイヤを受け取りました</p><p className="text-base text-fuchsia-300 font-black mt-1">虹のプシュケー ×{donationResult.psyche}</p><p className="text-[11px] text-slate-300 mt-2">所持ダイヤ {donationResult.gold.toLocaleString()}</p><button onClick={()=>setDonationResult(null)} className="mt-5 w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-amber-600 text-sm font-black text-white active:scale-[.98]">寄付一覧へ戻る</button></div></div>
  );
}
