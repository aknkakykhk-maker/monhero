// ミッションのJST期間更新、達成判定、ギフト報酬互換性を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname,'..','monster-hero','src','game-system.jsx'),'utf8');
const start = source.indexOf('const LOGIN_BONUS_REWARDS');
const end = source.indexOf('const STAT_POINT_GAIN');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nglobalThis.__m={LOGIN_BONUS_REWARDS,MISSION_DEFS,missionDailyPeriod,missionWeeklyPeriod,normalizeMissions,missionValue,missionClaimableCount,missionNextReset,buildGiftClaim};`,context);
const m=context.__m;
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};
const at=s=>Date.parse(s);
check('デイリーはJST 04:00で切り替わる',m.missionDailyPeriod(at('2026-07-29T18:59:59Z'))==='2026-07-29'&&m.missionDailyPeriod(at('2026-07-29T19:00:00Z'))==='2026-07-30');
check('ウィークリーは月曜JST 04:00で切り替わる',m.missionWeeklyPeriod(at('2026-08-02T18:59:59Z'))==='2026-07-27'&&m.missionWeeklyPeriod(at('2026-08-02T19:00:00Z'))==='2026-08-03');
let state=m.normalizeMissions(null,at('2026-07-29T20:00:00Z'));state.daily={...state.daily,login:1,battles:3,wins:5,enhances:1};
check('通常デイリー4個達成でコンプリート',m.missionValue(state,'daily',m.MISSION_DEFS.daily[4])===4);
state.weekly={...state.weekly,battles:20,wins:50,enhances:10,dailyClaims:15,marketTrades:3,donations:3};state.weeklyLoginDays=['a','b','c','d','e'];
check('通常ウィークリー7個中6個でコンプリート',m.missionValue(state,'weekly',m.MISSION_DEFS.weekly[7])===7&&m.missionValue({...state,weekly:{...state.weekly,donations:0}},'weekly',m.MISSION_DEFS.weekly[7])===6);
state.sentDaily=m.MISSION_DEFS.daily.map(x=>x.id);state.sentWeekly=m.MISSION_DEFS.weekly.map(x=>x.id);
check('ギフト送付済みは未受取バッジに含めない',m.missionClaimableCount(state)===0);
const base={gold:0,breederPoints:0,ownedItems:{}};
const gift={rewards:[{type:'trainingTicket',amount:3},{type:'trainingTicketLarge',amount:2}],expiresAt:new Date(Date.now()+100000).toISOString(),claimedAt:null};
const claim=m.buildGiftClaim(gift,base);
check('トレーニング・修行チケットを既存IDへ加算',claim.ok&&claim.balances.ownedItems.training_ticket===3&&claim.balances.ownedItems.training_ticket_l===2);
const invalid=m.buildGiftClaim({...gift,rewards:[{type:'diamond',amount:1},{type:'unknown',amount:1}]},base);
check('不明報酬を含むギフトは全体を拒否',!invalid.ok&&base.gold===0);
check('ミッション画面はHOME BGMを継続',/MISSIONS:\s*'home'/.test(source));
check('固定ギフトIDと同期ロックで重複送付を防止',/gift_mission_\$\{type\}_\$\{period\}_\$\{mission\.id\}/.test(source)&&/missionClaimingRef\.current/.test(source));

// --- ブリーダーポイント(pt)の配りすぎを防ぐ ---
// ptはマーケットのアイコン(1個1pt)にしか使わない。1回の報酬で大量に配ると、
// もらった時点で使い道が無くなってしまう(ログインボーナスで100pt配っていた)。
// アイコンを全部買うのに必要な総額を基準に、1回あたりの上限を決める
const breederSrc = fs.readFileSync(path.join(__dirname,'..','monster-hero','data','breeder.js'),'utf8');
const bctx = {}; vm.createContext(bctx);
vm.runInContext(breederSrc.slice(breederSrc.indexOf('const TEACHING_CARDS = ['))
  .replace(/\b[A-Z_]+_ICON\b|\bDISC_STONE_BASE\b/g, "''") + '\nglobalThis.__b=BREEDER_MARKET_ITEMS;', bctx);
const iconTotalCost = bctx.__b.filter(i => i.type === 'icon').reduce((a, i) => a + i.cost, 0);
const ptOf = (rewards) => (rewards || []).filter(r => r.type === 'breederPoint').reduce((a, r) => a + r.amount, 0);
const ptLimit = Math.max(1, Math.floor(iconTotalCost / 2));
const ptRewards = [
  ...m.LOGIN_BONUS_REWARDS.map((r, i) => [`ログインボーナス${i+1}日目`, ptOf(r)]),
  ...m.MISSION_DEFS.daily.map(x => [`デイリー:${x.name}`, ptOf(x.rewards)]),
  ...m.MISSION_DEFS.weekly.map(x => [`ウィークリー:${x.name}`, ptOf(x.rewards)]),
];
const ptOver = ptRewards.filter(([, v]) => v > ptLimit);
check(`1回に配るptがアイコン総額(${iconTotalCost}pt)の半分を超えない` + (ptOver.length ? ` — ${ptOver.map(([k,v])=>`${k}=${v}`).join(', ')}` : ''), ptOver.length === 0);
check('ptを配る報酬が残っている', ptRewards.some(([, v]) => v > 0));
// レベルアップでもらえるptは「上がったレベルの数」だけ。まとめて何十ptも入らない
check('レベルアップで増えるptは上がったレベル数ぶんだけ',
  (source.match(/const next = prev \+ gainedLevels;/g) || []).length === 1
    && (source.match(/const next = prev \+ gainedBreederLevels;/g) || []).length === 1);
// 読み込みのたびに配り直さないよう、補填は「本来の数との差額」だけにして、配った総数を保存する
check('読み込み時の補填は本来の数との差額だけ',
  source.includes('if (expectedPoints > grantedPoints) {')
    && source.includes('savedPoints += expectedPoints - grantedPoints;')
    && source.includes("await storeSet('mh_breeder_points_granted', grantedPoints, false);")
    && source.includes('const expectedPoints = Math.max(0, levelInfo(savedXp).level - 1);'));

process.exit(failed?1:0);
