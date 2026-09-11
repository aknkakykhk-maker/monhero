// ==== 画面: HOME(村の広場)とそこに重なる案内 ====
//
// MonsterHeroGame から切り出した19本目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-12)。
// 村の広場そのものと、HOME にだけ出るかぶせもの3つ(ききの加入・ももすけの登場・
// アップデートの案内)。
//
// 【この画面ならではの注意】
// ・HOME は**配置の検査がある唯一の画面**。触ったら必ず `node tools/home-layout-check.js` を通す。
//   助手(みゅあ)の吹き出し・施設のボタン・はじめての案内が同じ場所に重なるため、
//   ここだけは実際のブラウザで位置を測って確かめている
// ・施設へ入る7つの行き先は props(onOpen*)で受け取る。画面は行き先の名前を持たない
// ・かぶせもの3つは「HOME にいて、チュートリアルが終わっていて、前の会話が片付いていたら」
//   という順番で出る。その条件は MonsterHeroGame 側に残し、ここは中身だけを持つ
function HomeScreen({
  assistantBondUp, breederIcon, breederLevel, breederName, breederPoints, gifts, gold,
  hasUnreadChangelog, homeBackgroundReady, homePastureMasumons, masuMons, missions,
  onOpenBattle, onOpenManagement, onOpenMarket, onOpenProfile, onOpenRhythm, onOpenSettings,
  onOpenTemple, openChangelog, openGiftBox, openMissions, resolveIconUrl, spotClass,
}) {
  return (

      <main className="mh-home-scene" aria-label="村の広場">
        <picture className={`mh-home-background ${homeBackgroundReady?'is-ready':''}`} aria-hidden="true"><img src="data/images/home-background.jpg" alt=""/></picture>
        <div className="mh-home-masumon-layer" aria-hidden="true">{homePastureMasumons.map((masu,index)=><HomeWalkingMasumon key={masu.id} masu={masu} base={ALL_PLAYER_MONSTERS[masu.baseId]} masuColors={getMasuColors(masu)} index={index} count={homePastureMasumons.length}/>)}</div>
        {/* 設定を光らせるときは、上の帯ごと暗幕より前に出す(帯が z-index を持っていて中だけ前に出せないため) */}
        <header className={`mh-home-status${spotClass('settings')}`}>
          <button type="button" className="mh-home-player" onClick={onOpenProfile} aria-label="プロフィールを開く">
            <HomeProfileIcon src={resolveIconUrl(breederIcon)} id={breederIcon}/>
            <div className="mh-home-player-copy"><strong>{breederName}</strong><span>ブリーダー Lv.{breederLevel.level}</span><div className="mh-home-xp"><i style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></i></div><small>{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</small></div>
            <ChevronRight className="mh-home-profile-arrow" size={15}/>
          </button>
          <section className="mh-home-wallet">
            <div><Gem size={14}/><b>{gold.toLocaleString()}</b><small>ダイヤ</small></div><div><Coins size={14}/><b>{breederPoints}</b><small>pt</small></div>
            <button onClick={onOpenSettings} className={`mh-home-settings${spotClass('settings')}`} aria-label="設定"><Settings size={20}/><span>設定</span></button>
          </section>
        </header>
        <nav className="mh-home-facilities" aria-label="拠点施設">
          <button className={`mh-home-facility management${spotClass('management')}`} onClick={onOpenManagement} aria-label="M/B管理"><span><Layers size={18}/>M/B管理</span></button>
          <button className={`mh-home-facility temple${spotClass('temple')}`} onClick={onOpenTemple} aria-label="神殿"><span><Sparkles size={18}/>神殿</span></button>
          <button className={`mh-home-facility market${spotClass('market')}`} onClick={onOpenMarket} aria-label="マーケット"><span><ShoppingBag size={17}/>マーケット</span></button>
          {/* 修行の施設をやめ、その場所を音ゲー「モンヒロビート」に譲った(2026-09-03にユーザーが決定、
              2026-09-04に正式名称を「モンスタービート」から「モンヒロビート」へ変更)。
              公開フラグが立つまでは修行と同じように「準備中」の案内だけを出し、本編からは遊べない。
              中身はデバッグ画面の「音ゲー体験版」から確認できる */}
          <button className="mh-home-facility rhythm" onClick={onOpenRhythm} aria-label={RHYTHM_MODE_PUBLIC_RELEASE?"モンヒロビート":"モンヒロビート（準備中）"}><span>🎵 モンヒロビート{!RHYTHM_MODE_PUBLIC_RELEASE&&<small>準備中</small>}</span></button>
          <button className={`mh-home-facility battle${spotClass('battle')}`} onClick={onOpenBattle} aria-label="バトル"><span><Sword size={25}/>バトル</span></button>
        </nav>
        <button onClick={openMissions} className={`mh-home-mission${spotClass('reward')}`}><List size={16}/>ミッション
          {missionClaimableCount(normalizeMissions(missions))>0&&<em>{missionClaimableCount(normalizeMissions(missions))}</em>}
        </button>
        <button onClick={openGiftBox} className={`mh-home-gift${spotClass('reward')}`}><Package size={16}/>ギフト
          {giftClaimableCount(gifts)>0&&<em>{giftClaimableCount(gifts)}</em>}
        </button>
        <button onClick={openChangelog} className="mh-home-update"><RefreshCcw size={15}/>更新履歴{hasUnreadChangelog&&<em className="mh-unread-badge" aria-label="未読あり">!</em>}</button>
        {/* 仲良し度が上がった直後だけ、みゅあがそのことに触れる(HOMEを離れると元に戻る) */}
        <div className={`mh-home-assistant${spotClass('assistant')}`}><AssistantBubble scene="home" condition={assistantBondUp?'bondUp':(masuMons.length===0?'firstRun':null)} compact/></div>
      </main>
    
  );
}

function KikiIntroOverlay({
  kikiIntroStep, markKikiIntroSeen, setKikiIntroStep,
}) {

    const script=(typeof ASSISTANT_KIKI_INTRO!=='undefined'&&ASSISTANT_KIKI_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(kikiIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    const calls=(typeof ASSISTANT_KIKI_INTRO_CALLS!=='undefined'&&ASSISTANT_KIKI_INTRO_CALLS)||{};
    // 顔を並べるのは、この台本に出てくる助手だけ。
    // 全員を並べると、まだ登場していない助手までここに映ってしまう
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markKikiIntroSeen(); else setKikiIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ききが助手に加わりました">
      {/* どこを押しても次へ進む。最後の1回で見たことにする */}
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-300">あたらしい助手</p>
        {/* 2人を並べて出し、いま話しているほうを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?84:64} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1">{line.t}</span>
        </div>
        <p className="mt-2 text-center text-[8px] text-slate-500">
          {step+1} / {script.length}　／　みゅあは「{calls.mua||''}」、ききは「{calls.kiki||''}」と呼び合います
        </p>
        <button onClick={next} className="mt-3 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950 active:scale-[.98]" style={{pointerEvents:'auto'}}>{last?'とじる':'つぎへ'}</button>
      </div>
    </div>);
  
}

function MomosukeIntroOverlay({
  markMomosukeIntroSeen, momosukeIntroStep, setMomosukeIntroStep,
}) {

    const script=(typeof ASSISTANT_MOMOSUKE_INTRO!=='undefined'&&ASSISTANT_MOMOSUKE_INTRO)||[];
    if(script.length===0) return null;
    const step=Math.max(0,Math.min(momosukeIntroStep,script.length-1));
    const line=script[step];
    const speaker=assistantById(line.who);
    const last=step===script.length-1;
    const cast=ASSISTANT_LIST.filter(who=>script.some(l=>l.who===who.id));
    const next=()=>{ if(last) markMomosukeIntroSeen(); else setMomosukeIntroStep(step+1); };
    return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:77000,backgroundColor:'rgba(2,6,23,.95)'}} role="dialog" aria-modal="true" aria-label="ももすけが助手に加わりました">
      <button type="button" onClick={next} aria-label="次へ" className="absolute inset-0 w-full h-full" style={{background:'transparent'}}/>
      <div className="relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-pink-300 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))',pointerEvents:'none'}}>
        <p className="mb-2 text-center text-[10px] font-black tracking-widest text-pink-200">あたらしい助手</p>
        {/* 3人を並べて、いま話しているひとりを明るくする */}
        <div className="mb-3 flex items-end justify-center gap-3">
          {cast.map(who=>{
            const talking=who.id===line.who;
            return(
              <div key={who.id} className={`flex flex-col items-center gap-1 ${talking?'':'opacity-35'}`} style={{transform:talking?'scale(1)':'scale(.86)',transition:'opacity .18s, transform .18s'}}>
                <AssistantFace who={who} size={talking?76:56} accent={who.accent} expression={talking?line.e:'normal'}/>
                <span className="text-[9px] font-black" style={{color:talking?who.accent:'#64748b'}}>{who.name}</span>
              </div>
            );
          })}
        </div>
        <div className="rounded-2xl border-2 bg-slate-900 px-3 py-3" style={{borderColor:speaker.accent}}>
          <span className="block text-[9px] font-black tracking-widest" style={{color:speaker.accent}}>{speaker.name}</span>
          <span className="block text-[13px] font-bold leading-relaxed text-white mt-1">{line.t}</span>
        </div>
        <p className="mt-2 text-center text-[8px] text-slate-500">{step+1} / {script.length}</p>
        <button onClick={next} className="mt-3 min-h-[50px] w-full rounded-2xl bg-pink-400 text-sm font-black text-slate-950 active:scale-[.98]" style={{pointerEvents:'auto'}}>{last?'とじる':'つぎへ'}</button>
      </div>
    </div>);
  
}

function HomeUpdateGuideOverlay({
  activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, finishUpdateGuide,
  selectedAssistantId, setUpdateGuidePage, updateGuidePage, updateGuideQueue,
}) {
const notice=updateGuideQueue[0];const pages=Array.isArray(notice.pages)&&notice.pages.length?notice.pages:['新しいアップデートがあるよ♪'];const page=Math.min(updateGuidePage,pages.length-1);const last=page===pages.length-1;const who=activeAssistant;return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label={notice.title}>
      <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        {notice.debugOnly&&<div className="mb-2 rounded-lg bg-fuchsia-700 px-2 py-1 text-center text-[9px] font-black text-white">DEBUG・通常ログインでは表示されません</div>}
        <h2 className="mb-1 text-center text-base font-black text-pink-200">{notice.title}</h2><p className="mb-3 text-center text-[10px] font-bold text-slate-400">{page+1} / {pages.length}</p>
        <div className="flex items-end gap-2"><AssistantFace who={who} size={76} accent={who.accent} expression={notice.expression||'happy'}/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 px-3 py-3 text-[13px] font-bold leading-relaxed text-white">{assistantSpeakText(pages[page],breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId)}</div></div>
        {!last?<button onClick={()=>setUpdateGuidePage(page+1)} className="mt-4 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950">次へ</button>:<div className={`mt-4 grid ${notice.destination?'grid-cols-2':'grid-cols-1'} gap-2`}>{notice.destination&&<button onClick={()=>finishUpdateGuide(notice.destination)} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950">{notice.buttonLabel||'見に行く'}</button>}<button onClick={()=>finishUpdateGuide()} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white">{notice.destination?'あとで':'閉じる'}</button></div>}
      </div>
    </div>);
}
