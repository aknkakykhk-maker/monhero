const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ギフト受取と日本時間4時更新ログインボーナスを本番ソースの関数で検証する。
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(TOOLS_DIR,'..','monster-hero','src','game-system.jsx'),'utf8');
const prefix=source.slice(source.indexOf('const LOGIN_BONUS_REWARDS'),source.indexOf('const STAT_POINT_GAIN'));
const context={React:{ Component: class { setState() {} }, PureComponent: class { setState() {} },createElement(){},useState(){},useEffect(){},useCallback(){},useMemo(){},useRef(){}}};vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.x={loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired,grantCompensationGifts,COMPENSATION_GIFTS,grantPlayerCompensationGifts,PLAYER_COMPENSATION_GIFTS,giftTitleDisplay,normalizeGiftRewards,NEW_PLAYER_WAIVED_COMPENSATION_IDS,COMPENSATION_WAIVED_KEY,normalizeWaivedCompensationIds,compensationIdsToWaive,waivedCompensationRewards,grantNewPlayerCampaignGift,NEW_PLAYER_CAMPAIGN_GIFT};`,context);
const {loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired,grantCompensationGifts,COMPENSATION_GIFTS,grantPlayerCompensationGifts,PLAYER_COMPENSATION_GIFTS,giftTitleDisplay,normalizeGiftRewards,NEW_PLAYER_WAIVED_COMPENSATION_IDS,COMPENSATION_WAIVED_KEY,normalizeWaivedCompensationIds,compensationIdsToWaive,waivedCompensationRewards,grantNewPlayerCampaignGift,NEW_PLAYER_CAMPAIGN_GIFT}=context.x;let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};
const at=s=>Date.parse(s);
check('JST 03:59と04:00で期間が切り替わる',loginBonusPeriodKey(at('2026-07-28T18:59:00Z'))==='2026-07-28'&&loginBonusPeriodKey(at('2026-07-28T19:00:00Z'))==='2026-07-29');
let state=null,gifts=[];const days=[];
for(let i=0;i<8;i++){const r=grantLoginBonus(state,gifts,at(`2026-08-${String(i+1).padStart(2,'0')}T00:00:00Z`));days.push(r.day);state=r.loginBonus;gifts=r.gifts;}
check('7日周期の次は1日目',days.join(',')==='1,2,3,4,5,6,7,1');
const duplicate=grantLoginBonus(state,gifts,at('2026-08-08T10:00:00Z'));
check('同一期間は重複配布しない',!duplicate.granted&&duplicate.gifts.length===8);
check('ログイン間隔が空いても続きから進む',grantLoginBonus(state,gifts,at('2026-08-20T00:00:00Z')).day===2);
const multi={id:'multi',rewards:[{type:'diamond',amount:10},{type:'breederPoint',amount:3},{type:'dyeMock',amount:2},{type:'bondPointReset',amount:1}],expiresAt:'2099-01-01T00:00:00.000Z',claimedAt:null};
const claimed=buildGiftClaim(multi,{gold:5,breederPoints:1,ownedItems:{}},at('2026-01-01T00:00:00Z'));
check('複数種類の報酬を正しく加算',claimed.ok&&claimed.balances.gold===15&&claimed.balances.breederPoints===4&&claimed.balances.ownedItems.dye_mock===2&&claimed.balances.ownedItems.bond_reset_scroll===1);
check('受取済みは再受取不可',!buildGiftClaim(claimed.gift,claimed.balances,at('2026-01-01T00:01:00Z')).ok);
check('期限切れは受取不可',giftIsExpired({...multi,expiresAt:'2025-01-01T00:00:00Z'},at('2026-01-01T00:00:00Z'))&&!buildGiftClaim({...multi,expiresAt:'2025-01-01T00:00:00Z'},{},at('2026-01-01T00:00:00Z')).ok);
const unknown=buildGiftClaim({...multi,rewards:[{type:'diamond',amount:10},{type:'unknown',amount:1}]},{gold:5},at('2026-01-01T00:00:00Z'));
check('不明報酬を含むギフトは全体を受取不可',!unknown.ok&&unknown.reason==='invalidReward');
check('保存キーが実装されている',source.includes("storeSet('mh_gifts'")&&source.includes("storeSet('mh_login_bonus'"));

// 7日ぶんの一覧表示(今日がどこか・明日以降に何がもらえるか)
check('7日ぶんの一覧を出す共通描画がある',source.includes('const renderLoginBonusList = (todayDay)')&&source.includes('7日間のログインボーナス'));
check('受取済み・今日・これからで出し分ける',source.includes("day < todayDay ? 'done' : day === todayDay ? 'today' : 'next'")&&source.includes("phase==='today'?'今日':phase==='done'?'受取済み':'これから'"));
check('獲得ポップアップにも一覧を出す',source.includes('{renderLoginBonusList(loginBonusPopup.day)}'));
check('ギフトボックスからいつでも開ける',source.includes('setShowLoginBonusList(true)')&&source.includes('ログインボーナス一覧を見る')&&source.includes('{renderLoginBonusList(loginBonusTodayDay)}'));
check('今日ぶん受取済みなら1日戻して今日を出す',source.includes("if (state.lastGrantedPeriod === loginBonusPeriodKey()) return state.currentDay === 1 ? 7 : state.currentDay - 1;"));
check('起動時に進み具合を画面へ渡す',source.includes('setLoginBonusState(loginGrant.loginBonus);'));

// 不具合のお詫び配布(1度だけギフトボックスへ届く)
const comp=grantCompensationGifts([],at('2026-07-31T00:00:00Z'));
check('お詫びギフトが届く',comp.granted&&comp.gifts.length===COMPENSATION_GIFTS.length);
const compReward=(id,type)=>comp.gifts.find(g=>g.id===id).rewards.filter(r=>r.type===type).reduce((a,r)=>a+r.amount,0);
const compId='gift_compensation_20260731_battle';
check('ダイヤ1000が入っている',compReward(compId,'diamond')===1000);
check('スキップチケットが3種とも1枚ずつ',compReward(compId,'skipTicketJo')===1&&compReward(compId,'skipTicketHa')===1&&compReward(compId,'skipTicketKyu')===1);
check('報酬が受取可能な形式になっている',!!normalizeGiftRewards(comp.gifts[0]));
check('受取期限が30日先',Date.parse(comp.gifts[0].expiresAt)-at('2026-07-31T00:00:00Z')===30*24*60*60*1000);
check('2回目は配らない',grantCompensationGifts(comp.gifts,at('2026-08-01T00:00:00Z')).granted===false);
check('受取済みでも再配布しない',grantCompensationGifts(comp.gifts.map(g=>({...g,claimedAt:'2026-08-01T00:00:00.000Z'})),at('2026-08-02T00:00:00Z')).granted===false);
check('既存のギフトは消さない',grantCompensationGifts([{id:'other'}],at('2026-07-31T00:00:00Z')).gifts.some(g=>g.id==='other'));
check('お詫びのラベルが付く',giftTitleDisplay(comp.gifts[0]).label==='お詫び');
// 染色のお詫び(染色もどき5個)。すでに配ったお詫びを消したり、数を変えたりしていないか
const dyeId='gift_compensation_20260807_dye';
check('染色のお詫びが入っている',comp.gifts.some(g=>g.id===dyeId));
check('染色もどきが5個',compReward(dyeId,'dyeMock')===5);
check('染色のお詫びも受取可能な形式',!!normalizeGiftRewards(comp.gifts.find(g=>g.id===dyeId)));
// すでに配ったお詫びを受け取り済みの人へ、染色のぶんだけが追加で届くこと
const onlyOld=COMPENSATION_GIFTS.filter(d=>d.id!==dyeId).map(d=>({...d,claimedAt:'2026-08-01T00:00:00.000Z'}));
const addDye=grantCompensationGifts(onlyOld,at('2026-08-07T00:00:00Z'));
check('過去のお詫びを受け取り済みでも染色のぶんは届く',addDye.granted&&addDye.gifts.filter(g=>g.id===dyeId).length===1);
check('過去のお詫びを重ねて配らない',addDye.gifts.filter(g=>g.id!==dyeId).length===onlyOld.length);
check('染色のお詫びも2回目は配らない',grantCompensationGifts(addDye.gifts,at('2026-08-08T00:00:00Z')).granted===false);
check('起動時にお詫びも配る',source.includes('const compensationGrant = grantCompensationGifts(loginGrant.gifts, Date.now(), waivedCompensationIds);')
  &&/if \(loginGrant\.granted \|\| compensationGrant\.granted[^)]*\) \{[\s\S]{0,200}?storeSet\('mh_gifts'/.test(source));

// その人だけに届くお詫び(PLAYER ID が一致した端末にだけ配る)
const target=PLAYER_COMPENSATION_GIFTS[0];
const targetId=target.playerIds[0];
const mine=grantPlayerCompensationGifts([],targetId,at('2026-09-21T00:00:00Z'));
check('対象のPLAYER IDには届く',mine.granted&&mine.gifts.some(g=>g.id===target.id));
check('対象外のPLAYER IDには届かない',grantPlayerCompensationGifts([],'MH-0000-0000',at('2026-09-21T00:00:00Z')).granted===false);
check('PLAYER IDが無い端末には届かない',grantPlayerCompensationGifts([],'',at('2026-09-21T00:00:00Z')).granted===false&&grantPlayerCompensationGifts([],null,at('2026-09-21T00:00:00Z')).granted===false);
check('大小と前後の空白は同じIDとみなす',grantPlayerCompensationGifts([],` ${targetId.toLowerCase()} `,at('2026-09-21T00:00:00Z')).granted===true);
check('2回目は配らない',grantPlayerCompensationGifts(mine.gifts,targetId,at('2026-09-22T00:00:00Z')).granted===false);
check('受取済みでも再配布しない',grantPlayerCompensationGifts(mine.gifts.map(g=>({...g,claimedAt:'2026-09-22T00:00:00.000Z'})),targetId,at('2026-09-23T00:00:00Z')).granted===false);
check('既存のギフトは消さない',grantPlayerCompensationGifts([{id:'other'}],targetId,at('2026-09-21T00:00:00Z')).gifts.some(g=>g.id==='other'));
const mineGift=mine.gifts.find(g=>g.id===target.id);
check('受取期限は付けない',!('expiresAt' in mineGift)&&!giftIsExpired(mineGift,at('2099-01-01T00:00:00Z')));
check('配る相手のIDはギフトへ残さない',!('playerIds' in mineGift));
check('報酬の形が通常のギフトとして成り立つ',!!normalizeGiftRewards(mineGift));
check('ダイヤ2億が入っている',buildGiftClaim(mineGift,{gold:0},at('2026-09-21T00:00:00Z')).balances.gold===200000000);
check('起動時にPLAYER IDを見て配る',source.includes('grantPlayerCompensationGifts(compensationGrant.gifts, currentPlayerId)')&&source.includes("window.localStorage.getItem('mh_player_id')"));

// はじめての人には7〜8月のお詫びを配らず、同じ合計をプレオープン記念へ足す(2026-10-09・社長の選択)
const allIds=COMPENSATION_GIFTS.map(d=>d.id);
check('控えるお詫びのidは、いま配っている4件と同じ',NEW_PLAYER_WAIVED_COMPENSATION_IDS.length===4&&NEW_PLAYER_WAIVED_COMPENSATION_IDS.every(id=>allIds.includes(id)));
check('控えのキーは新しいキー',COMPENSATION_WAIVED_KEY==='mh_compensation_waived_v1');
const toWaiveNew=compensationIdsToWaive([],[]);
check('はじめての人(ギフトが空)は4件とも控える',toWaiveNew.length===4);
const noComp=grantCompensationGifts([],at('2026-10-09T00:00:00Z'),toWaiveNew);
check('控えたお詫びは配らない',noComp.granted===false&&noComp.gifts.length===0);
check('2回目の起動(控えが保存済み)でも配らない',grantCompensationGifts(noComp.gifts,at('2026-10-10T00:00:00Z'),toWaiveNew).granted===false);
check('控えを渡さなければ従来どおり全員に届く',grantCompensationGifts([],at('2026-10-09T00:00:00Z')).gifts.length===4);
check('控えの対象は固定の4件だけ(これから足すお詫びのidは入らない)',!NEW_PLAYER_WAIVED_COMPENSATION_IDS.includes('gift_compensation_future')&&Object.isFrozen(NEW_PLAYER_WAIVED_COMPENSATION_IDS));
// すでにギフトボックスにあるお詫びは、控えに入れない・取り上げない・足さない
const hasTwo=COMPENSATION_GIFTS.slice(0,2).map(d=>({...d,claimedAt:null}));
const toWaivePart=compensationIdsToWaive(hasTwo,[]);
check('すでにあるお詫びは控えに入れない',toWaivePart.length===2&&toWaivePart.every(id=>!hasTwo.some(g=>g.id===id)));
check('持っているお詫びは配らない控えでも消えない',grantCompensationGifts(hasTwo,at('2026-10-09T00:00:00Z'),toWaivePart).gifts.length===2);
const partRewards=waivedCompensationRewards(hasTwo,toWaivePart);
const partSum=(t)=>partRewards.filter(r=>r.type===t).reduce((a,r)=>a+r.amount,0);
check('持っているお詫びの分は、記念の贈りものへ足さない(二重にならない)',partSum('diamond')===0&&partSum('skipTicketJo')===0);
// 足す量は、4通の合計そのまま
const sumRewards=waivedCompensationRewards([],toWaiveNew);
const sumOf=(t)=>sumRewards.filter(r=>r.type===t).reduce((a,r)=>a+r.amount,0);
check('足す量: ダイヤ1000・序2・破2・急7・染色もどき5',sumOf('diamond')===1000&&sumOf('skipTicketJo')===2&&sumOf('skipTicketHa')===2&&sumOf('skipTicketKyu')===7&&sumOf('dyeMock')===5);
check('足す量の種類は5つだけ',sumRewards.length===5);
check('控えが無ければ足さない',waivedCompensationRewards([],[]).length===0);
const withExtra=grantNewPlayerCampaignGift([],at('2026-10-09T00:00:00Z'),sumRewards);
const giftSum=(t)=>withExtra.gifts[0].rewards.filter(r=>r.type===t).reduce((a,r)=>a+r.amount,0);
check('記念の贈りものに足される',withExtra.granted&&giftSum('diamond')===101000&&giftSum('rainbowPsyche')===100&&giftSum('dyeMock')===5&&giftSum('skipTicketKyu')===7);
check('足してもギフトの定義そのものは変わらない',NEW_PLAYER_CAMPAIGN_GIFT.rewards.length===2&&NEW_PLAYER_CAMPAIGN_GIFT.rewards[0].amount===100000);
check('足す量なしなら従来どおり',grantNewPlayerCampaignGift([],at('2026-10-09T00:00:00Z')).gifts[0].rewards.length===2);
check('すでにある記念の贈りものには足さない',grantNewPlayerCampaignGift([{id:NEW_PLAYER_CAMPAIGN_GIFT.id}],at('2026-10-09T00:00:00Z'),sumRewards).granted===false);
check('壊れた控えの値でも落ちない',normalizeWaivedCompensationIds('x').length===0&&normalizeWaivedCompensationIds([1,'a','a',null]).length===1);
check('起動時: はじめて遊ぶ人だけ控える・既存の人は控えない',source.includes('if (!compensationEverPlayed) {')&&source.includes('compensationIdsToWaive(loginGrant.gifts, waivedCompensationIds)'));
check('はじめての設定の終わりに、合計を記念の贈りものへ足す',source.includes('waivedCompensationRewards(giftsNow, waivedNow)'));

process.exit(failed?1:0);
