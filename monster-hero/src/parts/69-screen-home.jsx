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
// イベント開催中の角バッジ(2026-09-11・ユーザー指示
// 「右上とか左上とか専用バッジを付けるようにして」「そこそこ派手目に / キラキラ強調されてるような」)。
//
// ★この機能ぶんのCSSは、ここで <style> を置いて閉じる。70-bootstrap.jsx の大きなCSSへ
//   書き足したときは、1行に複数の規則が並ぶ場所へ入って @media の内側になり、
//   文書へ一度も読み込まれなかった(実ブラウザで 0件 / 全1161規則)。
//   さらに消すときに同じ行の続きまで巻き込んで、横画面の配置を壊した。
//   ここへ閉じておけば、ほかのCSSを壊しようがない。
// ★位置は超越バッジ・魂格バッジと同じ「角へ少しはみ出す」置き方にそろえる。
// ★動きを減らす設定の人には光らせない(prefers-reduced-motion)。
// ★位置と見た目は style で直に持たせる。配置の検査(home-layout-check.js)は
//   このCSSを読み込まないので、クラスだけに頼ると検査の中で「ただの文字」になり、
//   ボタンが横に広がって施設の位置がずれてしまう(実際に落ちた)。
//   クラスのほうは「光り方・動き」だけを足す係にする。
const HOME_EVENT_BADGE_STYLE = Object.freeze({
  position:'absolute', top:'-10px', right:'-9px', zIndex:8,
  display:'block', overflow:'hidden', padding:'2px 7px',
  border:'1px solid #fff3c4', borderRadius:'999px',
  background:'linear-gradient(135deg,#f59e0b,#fde047 45%,#f97316)',
  color:'#4a1d00', fontSize:'8px', fontWeight:1000, fontStyle:'normal',
  lineHeight:1.6, whiteSpace:'nowrap', textShadow:'0 1px 0 #fff8', pointerEvents:'none',
  boxShadow:'0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80',
});
const HOME_EVENT_BADGE_CSS = `
.mh-home-event-badge{animation:mhHomeEventBadgePulse 1.6s ease-in-out infinite}
.mh-home-event-badge::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:45%;
  background:linear-gradient(100deg,#fff0,#ffffffcc,#fff0);
  animation:mhHomeEventBadgeShine 2.4s ease-in-out infinite}
@keyframes mhHomeEventBadgePulse{
  0%,100%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 10px #fbbf24cc,0 0 18px #f59e0b80;transform:scale(1)}
  50%{box-shadow:0 0 0 1px #0006,0 2px 8px #000a,0 0 16px #fde047,0 0 30px #f59e0bcc;transform:scale(1.06)}}
@keyframes mhHomeEventBadgeShine{0%{left:-60%}55%{left:120%}100%{left:120%}}
@media(prefers-reduced-motion:reduce){
  .mh-home-event-badge{animation:none;transform:none}
  .mh-home-event-badge::after{display:none}}
`;
// ★イベント・レイドボス「ジャック」(docs/spec/RAID_BOSS_JACK.md)。開催中だけ、HOMEの真ん中でぴょこぴょこ跳ねる。
//   タップでレイド画面を開く。近くに、いま挑める段階の共有HPバーを出す。ときどき両腕を上げたポーズに変わる(HPとは連動しない)。
// ★位置・大きさ・見た目は style で直に持たせ、クラスは「動き」だけを足す係にする(配置の検査はこのCSSを読まないため)。
// ★CSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、配置の検査が数える要素の数がずれる。
// ★動きを減らす設定の人には跳ねさせない(prefers-reduced-motion)。
const HOME_RAID_JACK_CSS = `
.mh-home-raid-jack-img{animation:mhRaidJackHop 1.15s cubic-bezier(.3,.1,.4,1) infinite;transform-origin:50% 100%}
.mh-home-raid-jack-shadow{animation:mhRaidJackShadow 1.15s cubic-bezier(.3,.1,.4,1) infinite}
@keyframes mhRaidJackHop{
  0%,100%{transform:translateY(0) scale(1.06,.92)}
  18%{transform:translateY(0) scale(.96,1.06)}
  50%{transform:translateY(-16px) scale(1,1) rotate(-2deg)}
  82%{transform:translateY(0) scale(1.05,.94) rotate(1deg)}}
@keyframes mhRaidJackShadow{0%,100%{transform:scaleX(1.05);opacity:.5}50%{transform:scaleX(.7);opacity:.3}}
@media(prefers-reduced-motion:reduce){.mh-home-raid-jack-img,.mh-home-raid-jack-shadow{animation:none}}
`;
const HOME_RAID_JACK_WRAP_STYLE = Object.freeze({
  position:'absolute', left:'50%', top:'44%', transform:'translate(-50%,-50%)', zIndex:2,
  width:'44%', maxWidth:'190px', minWidth:'120px',
});
const HOME_RAID_JACK_BUTTON_STYLE = Object.freeze({
  display:'flex', flexDirection:'column', alignItems:'center', width:'100%',
  background:'transparent', border:'0', padding:'0', cursor:'pointer',
});
const HomeRaidJack = ({ eventId, onOpen }) => {
  // 前回取れた段階の合計から描き始める(36-raid-jack-api.jsx の raidJackTotalsCache)。読み込みが終わるまでの間を「男爵・ライフ満タン」にしない
  const [totals, setTotalsState] = React.useState(() => raidJackCachedTotals(eventId));
  const setTotals = (t) => { raidJackRememberTotals(eventId, t); setTotalsState((prev) => (t || prev === undefined ? t : prev)); };
  // ひとこと(吹き出し)。押すと次のセリフへ。最初の1つは開くたびに変わる
  const [lineNo, setLineNo] = React.useState(() => Math.floor(Math.random() * 1000));
  const [pose, setPose] = React.useState(false);
  React.useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-home-raid-jack-css')) return;
    const tag = document.createElement('style'); tag.id = 'mh-home-raid-jack-css'; tag.textContent = HOME_RAID_JACK_CSS; document.head.appendChild(tag);
  }, []);
  React.useEffect(() => {
    let alive = true;
    // 通信が弱くて送れなかった与ダメージが端末に残っていれば、ここで送り直す(空なら通信しない)。本番のイベントだけ
    const flush = async () => { if (eventId !== RAID_JACK_EVENT.id) return; try { const id = await ensureBreederId(); await raidJackFlushStoredPending(id, eventId); } catch (e) { /* 次に開いたときに送り直す */ } };
    const load = async () => { await flush(); const t = await sbFetchRaidJackTierTotals(eventId); if (alive) setTotals(t); };
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
  }, [eventId]);
  // ときどき両腕ポーズ(約7秒に1回、1.4秒だけ)
  React.useEffect(() => {
    let alive = true; let timer = null;
    const loop = () => { timer = setTimeout(() => { if (!alive) return; setPose(true); timer = setTimeout(() => { if (!alive) return; setPose(false); loop(); }, 1400); }, 5600); };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  // 初めて読み込み中(まだ一度も合計が取れていない)あいだは、段階もライフも分からないので描かない
  if (totals === undefined) return null;
  // いま挑める段階 = まだ共有HPが残っている最初の段階。全部倒していたら「討伐おめでとう」
  const tiers = RAID_JACK_A_TIERS;
  const totalOf = (i) => (totals && totals.a && totals.a[i + 1] ? totals.a[i + 1].total : 0);
  // 大王が倒されたか(段階5の合計がライフ以上)で決める。倒されたあとは、小さなぱんぷきんが遊びに来る
  const allDone = raidJackBossDown(totals);
  const currentIndex = allDone ? -1 : (totals ? tiers.findIndex((t, i) => totalOf(i) < t.hp) : 0);
  const tier = tiers[Math.max(0, allDone ? tiers.length - 1 : currentIndex)];
  const left = allDone ? 0 : Math.max(0, tier.hp - totalOf(Math.max(0, currentIndex)));
  const rate = tier.hp > 0 ? Math.max(0, Math.min(1, left / tier.hp)) : 0;
  // いま話せるセリフ: 段階(爵位)の話し方 × 残りライフの場面。大王を倒したあとはぱんぷきん(場面なし)
  const speechLines = raidJackHomeLines(tier.id, rate, allDone);
  const speech = speechLines[lineNo % speechLines.length];
  const speechAccent = allDone ? '#fdba74' : '#fb923c';
  return (
    <div data-home-raid-jack-wrap style={HOME_RAID_JACK_WRAP_STYLE}>
    {/* ひとこと。ジャックの上に出る吹き出し。押すと次のセリフへ(ジャック本体を押すとレイド画面) */}
    <button type="button" key={`say${lineNo}`} data-home-raid-say data-story-pop="1" onClick={() => setLineNo((n) => n + 1)} aria-label="ジャックのひとこと(押すと次のセリフ)"
      style={{ position:'absolute', left:'50%', bottom:'100%', marginLeft:-92, marginBottom:'4px', width:184, padding:'6px 10px', borderRadius:'14px',
        border:`2px solid ${speechAccent}`, background:'#1c0a02ee', color:'#ffedd5', fontSize:'11px', fontWeight:900, lineHeight:1.45, textAlign:'left', cursor:'pointer',
        boxShadow:`0 0 12px ${speechAccent}66`, animation:'storyPop .25s ease-out both', zIndex:2 }}>
      <span style={{ display:'block' }}>{speech}</span>
      <span aria-hidden="true" style={{ display:'block', textAlign:'right', fontSize:'8px', opacity:.7 }}>▶ つぎ</span>
      <span aria-hidden="true" style={{ position:'absolute', left:'50%', bottom:-9, marginLeft:-8, width:0, height:0, borderLeft:'8px solid transparent', borderRight:'8px solid transparent', borderTop:`9px solid ${speechAccent}` }} />
    </button>
    <button type="button" data-home-raid-jack onClick={onOpen} aria-label={allDone ? `${RAID_JACK_PUMPKIN.name}が遊びに来た！タップでレイド画面を開く` : `${tier.name}があらわれた！タップでレイド画面を開く`} style={HOME_RAID_JACK_BUTTON_STYLE}>
      {/* 通常絵とポーズ絵を重ねて、切り替えは透明度だけで行う(先に両方読み込める・切り替えで枠の高さが変わらない)。
          ポーズ絵は腕が左右に広がるぶん本体が幅の約半分になるので、通常絵を半分の大きさ(RAID_JACK_NORMAL_ART_SCALE)で描いて本体の大きさをそろえる。
          どちらも足もと(本体の下端)をそろえて置く */}
      <span data-jack-aura={allDone ? undefined : (Number(String(tier.id).slice(1)) || undefined)} data-home-raid-pumpkin={allDone ? 'true' : undefined} style={{ position:'relative', display:'block', width:'100%', aspectRatio:'1024 / 640' }}>
        {/* 段階が進むほど派手になるオーラ(バトルと同じ部品)。絵の後ろに置く */}
        {/* HOMEのジャックは小さいので、オーラは絵より大きな枠へ広げて描く(段階が上がるほど大きく) */}
        {!allDone && <span aria-hidden="true" style={{ position:'absolute', pointerEvents:'none', inset:`${-20 - (Number(String(tier.id).slice(1)) || 0) * 8}% ${-10 - (Number(String(tier.id).slice(1)) || 0) * 5}% -6%` }}>
          <JackAuraLayer tier={Number(String(tier.id).slice(1)) || 0} />
        </span>}
        {/* 大王を倒したあとは、小さなぱんぷきんが遊びに来る(オーラ・ポーズ絵なし。跳ねる動きは同じ) */}
        {allDone ? <img className="mh-home-raid-jack-img" src={PUMPKIN_ICON_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_PUMPKIN_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_PUMPKIN_ART_SCALE * 100}%`, height:'auto', filter:'drop-shadow(0 6px 10px #000a)', pointerEvents:'none' }} /> : <>
        <img className="mh-home-raid-jack-img" src={JACK_IMG} alt="" draggable={false}
          style={{ position:'absolute', left:`${(1 - RAID_JACK_NORMAL_ART_SCALE) * 50}%`, bottom:0, width:`${RAID_JACK_NORMAL_ART_SCALE * 100}%`, height:'auto', opacity:pose ? 0 : 1, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        <img className="mh-home-raid-jack-img" src={JACK_POSE_IMG} alt="" draggable={false} aria-hidden="true"
          style={{ position:'absolute', left:0, bottom:'-6%', width:'100%', height:'auto', opacity:pose ? 1 : 0, filter:`drop-shadow(0 6px 10px #000a) ${raidJackAuraGlowFilter(Number(String(tier.id).slice(1)) || 0, 0.8)}`, pointerEvents:'none' }} />
        </>}
      </span>
      <span className="mh-home-raid-jack-shadow" aria-hidden="true" style={{ display:'block', width:'70%', height:'8px', marginTop:'-6px', borderRadius:'50%', background:'#0008', filter:'blur(3px)' }} />
      <span style={{ display:'block', width:'100%', marginTop:'6px', padding:'3px 6px', borderRadius:'10px', border:'1px solid #fdba74aa', background:'#1c0a02d9', color:'#ffedd5', fontSize:'10px', fontWeight:900, textAlign:'center', lineHeight:1.3 }}>
        <span style={{ display:'block' }}>{allDone ? `${RAID_JACK_PUMPKIN.name}が遊びに来た！` : `${tier.name}があらわれた！`}</span>
        {allDone ? <span data-home-raid-pumpkin-note style={{ display:'block', marginTop:'2px', fontSize:'8px', opacity:.9 }}>ジャックを倒した！あそんでダメージを競おう</span> : <>
        <span style={{ display:'block', height:'7px', marginTop:'3px', borderRadius:'999px', overflow:'hidden', background:'#000a', border:'1px solid #fff3' }} role="progressbar" aria-valuemin={0} aria-valuemax={tier.hp} aria-valuenow={left}>
          <span style={{ display:'block', height:'100%', width:`${rate * 100}%`, background:'#f97316' }} />
        </span>
        {totals === null ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>準備中</span>
          : totals === undefined ? <span style={{ display:'block', fontSize:'8px', opacity:.8 }}>…</span>
          : <span style={{ display:'block', fontSize:'8px', opacity:.85 }}>共有HP {left.toLocaleString()}</span>}
        </>}
      </span>
    </button>
    </div>
  );
};
function HomeScreen({
  assistantBondUp, friendRequestCount = 0, breederIcon, breederLevel, breederName, breederPoints, gifts, gold,
  hasUnreadChangelog, homeBackgroundReady, homeArt, homePastureMasumons, masuMons, missions,
  onOpenBattle, onOpenManagement, onOpenMarket, onOpenProfile, onOpenRhythm, onOpenSettings,
  onOpenTemple, openChangelog, openGiftBox, openMissions, profileFrameId, resolveIconUrl, spotClass,
  raidJackVisible = false, raidJackEventId, onOpenRaidJack,
}) {
  // 背景の絵は「HOMEの枠が横長かどうか」で選ぶ。画面の向きでは決めない。
  // パソコンは画面が横長でも、HOMEは幅600の縦長の列に収まるので、横長の絵を出すと村の真ん中だけが大きく写り、
  // 施設ボタンが建物と合わなくなる。枠の大きさは自前で回しているとき(横持ちの描き方)も回す前の値なので、そのまま使える
  const homeSceneRef=React.useRef(null);
  const [homeSceneWide,setHomeSceneWide]=React.useState(false);
  React.useEffect(()=>{
    const el=homeSceneRef.current;
    if(!el)return undefined;
    const measure=()=>{const w=el.clientWidth,h=el.clientHeight;if(w>0&&h>0)setHomeSceneWide(w/h>1.2);};
    measure();
    if(typeof ResizeObserver==='undefined'){window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);}
    const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();
  },[]);
  const homeBackgroundSrc=homeArtSrc(homeArt,homeSceneWide);
  const homeBackgroundWide=homeArtIsWide(homeArt,homeSceneWide);
  // ★バッジのCSSは <head> へ1回だけ入れる。HOMEのDOMへ <style> を混ぜると、
  //   配置の検査(home-layout-check.js)が施設の位置を測るときに数がずれる。
  //   head なら画面の中身に影響しない。
  React.useEffect(()=>{
    if(typeof document==='undefined')return;
    if(document.getElementById('mh-home-event-badge-css'))return;
    const tag=document.createElement('style');
    tag.id='mh-home-event-badge-css';
    tag.textContent=HOME_EVENT_BADGE_CSS;
    document.head.appendChild(tag);
  },[]);
  // 開催中のキャンペーンのうち、HOMEの札・バナー(banner)を持つもの(ハロウィン・ナイト)。描くたびに数え直す
  const homeEventCampaign=(()=>{
    if(typeof RELEASE_FLAGS==='undefined'||!RELEASE_FLAGS||RELEASE_FLAGS.rhythmEventPoints!==true||typeof rhythmEventPointCampaignAt!=='function')return null;
    const campaign=rhythmEventPointCampaignAt(Date.now());
    return campaign&&campaign.banner?campaign:null;
  })();
  // モンヒロビートのイベントを開催しているか。描くたびに数え直す(上の★のとおり)
  const homeRhythmEventOpen=(()=>{
    const released=(typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS&&RELEASE_FLAGS.rhythmWeeklyRanking===true);
    if(!released||typeof rhythmLimitedEventAt!=='function')return false;
    return !!rhythmLimitedEventAt(Date.now());
  })();
  return (

      <main ref={homeSceneRef} className="mh-home-scene" aria-label="村の広場">
        {/* 背景は設定の「ホーム画面アレンジ」で選んだ絵。HOMEの枠が横長なら横長の絵を画面いっぱいに出す(is-wide) */}
        <picture className={`mh-home-background ${homeBackgroundReady?'is-ready':''} ${homeBackgroundWide?'is-wide':''}`} aria-hidden="true"><img className="mh-home-backdrop" src={homeBackgroundSrc} alt=""/><img className="mh-home-main" src={homeBackgroundSrc} alt=""/></picture>
        <div className="mh-home-masumon-layer" aria-hidden="true">{homePastureMasumons.map((masu,index)=><HomeWalkingMasumon key={masu.id} masu={masu} base={ALL_PLAYER_MONSTERS[masu.baseId]} masuColors={getMasuColors(masu)} index={index} count={homePastureMasumons.length}/>)}</div>
        {/* 設定を光らせるときは、上の帯ごと暗幕より前に出す(帯が z-index を持っていて中だけ前に出せないため) */}
        {raidJackVisible&&<HomeRaidJack eventId={raidJackEventId} onOpen={onOpenRaidJack}/>}
        <header className={`mh-home-status${spotClass('settings')}`}>
          <button type="button" className="mh-home-player relative" onClick={onOpenProfile} aria-label="プロフィールを開く">
            <HomeProfileIcon src={resolveIconUrl(breederIcon)} id={breederIcon} frameId={profileFrameId}/>
            <div className="mh-home-player-copy"><strong>{breederName}</strong><span>ブリーダー Lv.{breederLevel.level}</span><div className="mh-home-xp"><i style={{width:`${Math.min(100,(breederLevel.xpIntoLevel/breederLevel.xpForNext)*100)}%`}}></i></div><small>{breederLevel.xpIntoLevel.toLocaleString()} / {breederLevel.xpForNext.toLocaleString()} XP</small></div>
            <ChevronRight className="mh-home-profile-arrow" size={15}/>
            {Number(friendRequestCount)>0&&<span data-home-friend-badge aria-label={`フレンド申請が${Number(friendRequestCount)}件届いています`} className="absolute -right-1 -top-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[12px] font-black text-white shadow-lg">{Math.min(99,Number(friendRequestCount))}</span>}
          </button>
          <section className="mh-home-wallet">
            <div><Gem size={14}/><b>{gold.toLocaleString()}</b><small>ダイヤ</small></div><div><Coins size={14}/><b>{breederPoints.toLocaleString()}</b><small>ブリーダーP</small></div>
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
          {/* ★イベント開催中は、その遊びのボタンに札を出す(2026-09-11・ユーザー指示
              「イベント開催中は対応してるコンテンツボタンのとこにイベント開催中みたいなのがほしい」)。
              HOMEを開いた時点で「いま何かやっている」と分かるようにする。
              ★期間の判定は描くたびに行う(読み込み時に1回だけ決めると、開きっぱなしの端末で
                古いままになる・CLAUDE.md ⑥-4)。開催していなければ何も出ない。
              ★いまのイベントはモンヒロビートの曲だけを対象にするので、札もここだけ。
                ほかの遊びを対象にするイベントを作るときは、そのボタンにも同じ em を足す */}
          <button className="mh-home-facility rhythm" onClick={onOpenRhythm} aria-label={RHYTHM_MODE_PUBLIC_RELEASE?"モンヒロビート":"モンヒロビート（準備中）"}><span>🎵 モンヒロビート{!RHYTHM_MODE_PUBLIC_RELEASE&&<small>準備中</small>}{homeRhythmEventOpen&&<em data-home-event-badge className="mh-home-event-badge" style={HOME_EVENT_BADGE_STYLE}>✨開催中✨</em>}</span></button>
          {/* 2026-09-20 ユーザー指示で正式名称を「モンヒロバトル」にした。
              モンヒロビートと同じく、字が長くても略さずそのまま入れる(CLAUDE.md ⑤) */}
          <button className={`mh-home-facility battle${spotClass('battle')}`} onClick={onOpenBattle} aria-label="モンヒロバトル"><span><Sword size={25}/>モンヒロバトル</span></button>
        </nav>
        <button onClick={openMissions} className={`mh-home-mission${spotClass('reward')}`}><List size={16}/>ミッション
          {missionClaimableCount(normalizeMissions(missions))>0&&<em>{missionClaimableCount(normalizeMissions(missions))}</em>}
        </button>
        <button onClick={openGiftBox} className={`mh-home-gift${spotClass('reward')}`}><Package size={16}/>ギフト
          {giftClaimableCount(gifts)>0&&<em>{giftClaimableCount(gifts)}</em>}
        </button>
        <button onClick={openChangelog} className="mh-home-update"><RefreshCcw size={15}/>更新履歴{hasUnreadChangelog&&<em className="mh-unread-badge" aria-label="未読あり">!</em>}</button>
        {/* 期間限定イベントのバナー(2026-10-04)。押すと更新履歴(イベントの詳細)を開く。ゲーム全体のイベントなので、特定の遊びのボタンには付けない。縦持ちの左下(モンヒロバトルのすぐ上)。右側のボタン列・上の吹き出しとかぶらない場所。横持ちでは出さない */}
        {homeEventCampaign&&<button type="button" data-home-event-banner className="mh-home-event-banner" onClick={openChangelog} aria-label={`${homeEventCampaign.banner.title} ${homeEventCampaign.banner.sub}`}>
          <b>{homeEventCampaign.banner.emoji} {homeEventCampaign.banner.title}</b><small>{homeEventCampaign.banner.sub}</small>
        </button>}
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
        <button onClick={next} className="mt-3 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950 active:scale-[.98]" style={{pointerEvents:'auto'}}>{last?'閉じる':'次へ'}</button>
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
        {/* スキップ(2026-10-07・モンヒロくんの報告とユーザー指示)。39場面あり、イベントのお話のように飛ばせなかった。
            飛ばしても見たことになり、回想(EVENT_REPLAYS の momosuke_intro)からいつでも見直せる */}
        <div className={`relative mt-3 grid ${last?'grid-cols-1':'grid-cols-[1fr_2fr]'} gap-2`} style={{pointerEvents:'auto'}}>
          {!last&&<button type="button" onClick={(e)=>{e.stopPropagation();markMomosukeIntroSeen();}} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]">スキップ</button>}
          <button type="button" onClick={(e)=>{e.stopPropagation();next();}} className="min-h-[50px] rounded-2xl bg-pink-400 text-sm font-black text-slate-950 active:scale-[.98]">{last?'閉じる':'次へ'}</button>
        </div>
      </div>
    </div>);
  
}

// フレンド申請が届いているときの、助手の知らせ(HOMEに来たときだけ)。
// 選んでいる助手の口調で一言。「見にいく」でフレンド画面へ、「あとで」で閉じる(閉じるだけで申請は消えない)
const FRIEND_NOTICE_LINES = Object.freeze({
  mua: (who) => `${who}からフレンド申請が届いてるよ♪ 見にいってみよう！`,
  kiki: (who) => `${who}からフレンド申請が届いてまつよ。見にいきまつか？`,
  momosuke: (who) => `${who}からフレンド申請が来てるよw 見にいこ？`,
  dra: (who) => `${who}からフレンド申請が来てるわ。見にいくか`,
});
function HomeFriendRequestNotice({ activeAssistant, count, names, onOpen, onLater }) {
  const who = activeAssistant;
  const list = Array.isArray(names) ? names.filter(Boolean) : [];
  const label = list.length === 0 ? `${count}人`
    : count > list.length ? `${list.join('さん・')}さんたち` : `${list.join('さん・')}さん`;
  const line = (FRIEND_NOTICE_LINES[who && who.id] || FRIEND_NOTICE_LINES.mua)(label);
  return (
    <div data-friend-request-notice className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:75000,backgroundColor:'rgba(2,6,23,.80)'}} role="dialog" aria-modal="true" aria-label="フレンド申請のお知らせ">
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-x-2 border-rose-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        <h2 className="mb-2 text-center text-base font-black text-rose-200">フレンド申請が届いています</h2>
        <div className="flex items-end gap-2">
          {who&&<AssistantFace who={who} size={76} accent={who.accent} expression="happy"/>}
          <div className="flex-1 rounded-2xl border-2 border-rose-400 bg-slate-900 p-3 text-[13px] font-bold leading-relaxed text-white">{line}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" data-friend-notice-later onClick={onLater} className="min-h-[50px] rounded-2xl border border-white/20 bg-slate-800 text-sm font-black text-slate-200 active:scale-95">あとで</button>
          <button type="button" data-friend-notice-open onClick={onOpen} className="min-h-[50px] rounded-2xl bg-rose-500 text-sm font-black text-white active:scale-95">見にいく</button>
        </div>
      </div>
    </div>);
}

// 起動時のお知らせが2件以上たまっているとき、見出しの一覧を1枚だけ出す(2026-10-10・ユーザー指示「起動時のお知らせを1枚にまとめる」)。
// 読みたい件だけ「くわしく」で開く(開いた件は今までどおりのページ送り)。「あとで読む」はその場の全件を既読にする(更新履歴にはいつでも残る)
function HomeUpdateGuideBundle({ activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, selectedAssistantId, updateGuideQueue, openUpdateGuideDetail, dismissUpdateGuideAll }) {
const who=activeAssistant;
const headline=n=>{const pages=(typeof assistantNoticePagesFor==='function')?assistantNoticePagesFor(n,who&&who.id):(Array.isArray(n.pages)?n.pages:[]);const first=pages[0];const text=(typeof assistantNoticePageText==='function')?assistantNoticePageText(first):String(first||'');return assistantSpeakText(text,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId);};
return(
  <div data-update-guide-bundle className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label="新しいお知らせの一覧">
    <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(env(safe-area-inset-bottom) + 16px)'}}>
      <div className="flex items-center gap-2"><AssistantFace who={who} size={56} accent={who.accent} expression="happy"/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 p-2.5 text-sm font-bold text-white">新しいお知らせが{updateGuideQueue.length}件あるよ♪ 読みたいものだけ「くわしく」で開いてね。</div></div>
      <div className="mt-3 space-y-2">{updateGuideQueue.map(n=><div key={n.id} data-update-guide-bundle-item={n.id} className="flex items-center gap-2 rounded-2xl border border-pink-400/40 bg-slate-900/80 p-2.5">
        <div className="min-w-0 flex-1"><div className="text-[13px] font-black leading-snug text-pink-200">{n.title}</div><div className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{headline(n)}</div></div>
        <button type="button" onClick={()=>openUpdateGuideDetail(n.id)} className="min-h-[44px] shrink-0 rounded-xl bg-pink-500 px-3 text-xs font-black text-slate-950">くわしく</button>
      </div>)}</div>
      <button type="button" data-update-guide-bundle-later onClick={dismissUpdateGuideAll} className="mt-4 min-h-[50px] w-full rounded-2xl bg-slate-700 text-sm font-black text-white">あとで読む</button>
      <p className="mt-2 text-center text-[10px] font-bold text-slate-500">更新履歴からいつでも読めます</p>
    </div>
  </div>);
}
function HomeUpdateGuideOverlay({
  activeAssistant, assistantBondLevelNow, assistantCallStyle, breederName, finishUpdateGuide,
  selectedAssistantId, setUpdateGuidePage, updateGuidePage, updateGuideQueue,
  updateGuideDetail, openUpdateGuideDetail, dismissUpdateGuideAll,
}) {
if(updateGuideQueue.length>=2&&!updateGuideDetail&&!updateGuideQueue[0].debugPreview)
  return <HomeUpdateGuideBundle activeAssistant={activeAssistant} assistantBondLevelNow={assistantBondLevelNow} assistantCallStyle={assistantCallStyle} breederName={breederName} selectedAssistantId={selectedAssistantId} updateGuideQueue={updateGuideQueue} openUpdateGuideDetail={openUpdateGuideDetail} dismissUpdateGuideAll={dismissUpdateGuideAll}/>;
const notice=updateGuideQueue[0];const who=activeAssistant;
// ★選んでいる助手が自分の口調で話す(2026-09-11・ユーザー指示)。
//   その助手のセリフが用意されていない告知は、今までどおり更新履歴の本文をそのまま読む。
//   1ページは文字列でも { e, t } でも書ける(既存の告知は文字列のまま動く)
const pages=(typeof assistantNoticePagesFor==='function')
  ?assistantNoticePagesFor(notice,who&&who.id)
  :(Array.isArray(notice.pages)&&notice.pages.length?notice.pages:['新しいアップデートがあるよ♪']);
const page=Math.min(updateGuidePage,pages.length-1);const last=page===pages.length-1;
const pageText=(typeof assistantNoticePageText==='function')?assistantNoticePageText(pages[page]):String(pages[page]||'');
const pageExpression=(typeof assistantNoticePageExpression==='function')
  ?assistantNoticePageExpression(pages[page],notice.expression||'happy')
  :(notice.expression||'happy');
return(
    <div className="fixed inset-0 flex items-end justify-center" style={{position:'fixed',inset:0,zIndex:76000,backgroundColor:'rgba(2,6,23,.94)'}} role="dialog" aria-modal="true" aria-label={notice.title}>
      <div className="w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto rounded-t-3xl border-t-2 border-x-2 border-pink-400 bg-slate-950 p-4" style={{paddingBottom:'calc(1rem + env(safe-area-inset-bottom))'}}>
        {notice.debugOnly&&<div className="mb-2 rounded-lg bg-fuchsia-700 px-2 py-1 text-center text-[9px] font-black text-white">DEBUG・通常ログインでは表示されません</div>}
        {/* 告知画像(イベントなど)。あるときだけ、いちばん上に大きく出す。
            画面の高さを食いすぎないよう上限を付ける(正方形の絵でも説明が読める位置に残る)。
            読めなかったら黙って消す(壊れた画像のアイコンを残さない) */}
        {notice.image&&<img data-update-notice-image src={notice.image} alt={`${notice.title}のお知らせ`}
          onError={e=>{e.currentTarget.style.display='none';}} decoding="async"
          className="mb-3 w-full max-h-[42vh] rounded-2xl border border-pink-400/50 object-contain"/>}
        <h2 className="mb-1 text-center text-base font-black text-pink-200">{notice.title}</h2><p className="mb-3 text-center text-[10px] font-bold text-slate-400">{page+1} / {pages.length}</p>
        <div className="flex items-end gap-2"><AssistantFace who={who} size={76} accent={who.accent} expression={pageExpression}/><div className="flex-1 rounded-2xl border-2 border-pink-400 bg-slate-900 px-3 py-3 text-[13px] font-bold leading-relaxed text-white">{assistantSpeakText(pageText,breederName,assistantBondLevelNow,assistantCallStyle,selectedAssistantId)}</div></div>
        {!last?<button onClick={()=>setUpdateGuidePage(page+1)} className="mt-4 min-h-[50px] w-full rounded-2xl bg-pink-500 text-sm font-black text-slate-950">次へ</button>:<div className={`mt-4 grid ${notice.destination?'grid-cols-2':'grid-cols-1'} gap-2`}>{notice.destination&&<button onClick={()=>finishUpdateGuide(notice.destination)} className="min-h-[50px] rounded-2xl bg-pink-500 text-sm font-black text-slate-950">{notice.buttonLabel||'見に行く'}</button>}<button onClick={()=>finishUpdateGuide()} className="min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white">{notice.destination?'あとで':'閉じる'}</button></div>}
      </div>
    </div>);
}
