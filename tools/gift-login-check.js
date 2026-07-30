// ギフト受取と日本時間4時更新ログインボーナスを本番ソースの関数で検証する。
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','monster-hero','src','game-system.jsx'),'utf8');
const prefix=source.slice(source.indexOf('const LOGIN_BONUS_REWARDS'),source.indexOf('const STAT_POINT_GAIN'));
const context={React:{createElement(){},useState(){},useEffect(){},useCallback(){},useMemo(){},useRef(){}}};vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.x={loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired,grantCompensationGifts,COMPENSATION_GIFTS,giftTitleDisplay,normalizeGiftRewards};`,context);
const {loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired,grantCompensationGifts,COMPENSATION_GIFTS,giftTitleDisplay,normalizeGiftRewards}=context.x;let failed=0;
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
check('起動時にお詫びも配る',source.includes('const compensationGrant = grantCompensationGifts(loginGrant.gifts);')&&source.includes('if (loginGrant.granted || compensationGrant.granted)'));

process.exit(failed?1:0);
