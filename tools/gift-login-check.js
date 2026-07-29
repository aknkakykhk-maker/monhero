// ギフト受取と日本時間4時更新ログインボーナスを本番ソースの関数で検証する。
const fs=require('fs'),vm=require('vm'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','monster-hero','src','game-system.jsx'),'utf8');
const prefix=source.slice(source.indexOf('const LOGIN_BONUS_REWARDS'),source.indexOf('const STAT_POINT_GAIN'));
const context={React:{createElement(){},useState(){},useEffect(){},useCallback(){},useMemo(){},useRef(){}}};vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.x={loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired};`,context);
const {loginBonusPeriodKey,grantLoginBonus,buildGiftClaim,giftIsExpired}=context.x;let failed=0;
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
process.exit(failed?1:0);
