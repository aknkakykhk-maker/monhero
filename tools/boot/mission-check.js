const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ミッションのJST期間更新、達成判定、ギフト報酬互換性を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR,'..','monster-hero','src','game-system.jsx'),'utf8');
const start = source.indexOf('const LOGIN_BONUS_REWARDS');
const end = source.indexOf('const STAT_POINT_GAIN');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nglobalThis.__m={LOGIN_BONUS_REWARDS,MISSION_DEFS,missionDailyPeriod,missionWeeklyPeriod,missionMonthlyPeriod,missionPeriodWeekday,missionWeekRotationIndex,normalizeMissions,missionValue,missionClaimableCount,missionNextReset,reconcileMonthlyMissionCompletions,buildGiftClaim};`,context);
const m=context.__m;
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};
const at=s=>Date.parse(s);
check('デイリーはJST 04:00で切り替わる',m.missionDailyPeriod(at('2026-07-29T18:59:59Z'))==='2026-07-29'&&m.missionDailyPeriod(at('2026-07-29T19:00:00Z'))==='2026-07-30');
check('ウィークリーは月曜JST 04:00で切り替わる',m.missionWeeklyPeriod(at('2026-08-02T18:59:59Z'))==='2026-07-27'&&m.missionWeeklyPeriod(at('2026-08-02T19:00:00Z'))==='2026-08-03');
check('マンスリーは毎月1日JST 04:00で切り替わる',m.missionMonthlyPeriod(at('2026-08-31T18:59:59Z'))==='2026-08'&&m.missionMonthlyPeriod(at('2026-08-31T19:00:00Z'))==='2026-09');
const login=m.LOGIN_BONUS_REWARDS;
check('ログイン7日すべて序1枚を維持',login.length===7&&login.every(r=>r.some(x=>x.type==='skipTicketJo'&&x.amount===1)));
check('ログイン報酬を新アイテム構成へ更新',login[2].some(x=>x.type==='trainingTicket'&&x.amount===5)&&login[3].some(x=>x.type==='breederXp'&&x.amount===200)&&login[4].some(x=>x.type==='uniqueSkillResetTicket'&&x.amount===1)&&login[5].some(x=>x.type==='rainbowPsyche'&&x.amount===10)&&login[6].some(x=>x.type==='trainingTicketLarge'&&x.amount===1));
const daily=m.MISSION_DEFS.daily,weekly=m.MISSION_DEFS.weekly,monthly=m.MISSION_DEFS.monthly;
check('デイリーは通常5個+コンプリート',daily.filter(x=>!x.complete).length===5&&daily.find(x=>x.complete)?.target===4);
const dailyChallenge=daily.find(x=>x.id==='daily_wins');
check('旧daily_wins IDを通常チャレンジ1クリアへ再利用',dailyChallenge?.key==='challengeClears'&&dailyChallenge?.target===1&&dailyChallenge?.rewards?.some(r=>r.type==='rainbowPsyche'&&r.amount===5));
let state=m.normalizeMissions(null,at('2026-08-29T05:00:00Z'));state.daily={...state.daily,login:1,battles:3,challengeClears:1,enhances:1};
check('デイリー4/5でコンプリート',m.missionValue(state,'daily',m.MISSION_DEFS.daily.find(x=>x.complete))===4);
check('日替わりは曜日で共通固定',m.missionPeriodWeekday(at('2026-08-24T05:00:00Z'))===1&&m.missionPeriodWeekday(at('2026-08-30T05:00:00Z'))===0);
check('ウィークリーは通常8個+コンプリート',weekly.filter(x=>!x.complete).length===8&&weekly.find(x=>x.complete)?.target===6);
const quick=weekly.find(x=>x.id==='weekly_wins'),challenge=weekly.find(x=>x.id==='weekly_donations'),items=weekly.find(x=>x.id==='weekly_daily_claims');
check('週クイック5クリア',quick?.key==='quickClears'&&quick?.target===5&&quick?.rewards?.some(r=>r.type==='rainbowPsyche'&&r.amount===20));
check('旧weekly_donations IDを通常チャレンジ3クリアへ再利用',challenge?.key==='challengeClears'&&challenge?.target===3&&challenge?.rewards?.some(r=>r.type==='breederXp'&&r.amount===300));
check('週アイテム5個使用',items?.key==='itemUses'&&items?.target===5&&items?.rewards?.some(r=>r.type==='uniqueSkillResetTicket'&&r.amount===1));
check('週間ローテーションは4週周期',m.missionWeekRotationIndex(at('2026-08-24T05:00:00Z'))===0&&m.missionWeekRotationIndex(at('2026-08-31T05:00:00Z'))===1&&m.missionWeekRotationIndex(at('2026-09-21T05:00:00Z'))===0);
state.weekly={...state.weekly,battles:20,enhances:10,quickClears:5,challengeClears:3,marketTrades:3,itemUses:5,proClears:3};state.weeklyLoginDays=['a','b','c','d','e'];
check('ウィークリー6/8でコンプリート可能',m.missionValue(state,'weekly',m.MISSION_DEFS.weekly.find(x=>x.complete))>=6);
check('マンスリーは通常10個+8個達成コンプリート',monthly.filter(x=>!x.complete).length===10&&monthly.find(x=>x.complete)?.target===8);
const monthlyComplete=monthly.find(x=>x.complete);
check('月次コンプリート報酬が指定どおり',monthlyComplete.rewards.some(r=>r.type==='diamond'&&r.amount===10000)&&monthlyComplete.rewards.some(r=>r.type==='rainbowPsyche'&&r.amount===200)&&monthlyComplete.rewards.some(r=>r.type==='rainbowTranscendFruit'&&r.amount===1));
const monthlyExpected=[
  ['monthly_logins','loginDays',20,'diamond',3000],
  ['monthly_battles','battles',100,'rainbowPsyche',50],
  ['monthly_wins','wins',200,'trainingTicketLarge',5],
  ['monthly_daily_completes','dailyCompletes',20,'diamond',5000],
  ['monthly_weekly_completes','weeklyCompletes',3,'rainbowPsyche',100],
  ['monthly_quick_runs','quickRuns',20,'skipTicketKyu',2],
  ['monthly_challenge_runs','challengeRuns',10,'rainbowPsyche',50],
  ['monthly_enhances','enhances',30,'uniqueSkillResetTicket',2],
  ['monthly_market','marketTrades',10,'dyeMock',5],
  ['monthly_mode_runs','modeRuns',30,'bondPointReset',2],
];
check('月次10項目の条件・目標・個別報酬が指定どおり',monthlyExpected.every(([id,key,target,type,amount])=>{const def=monthly.find(x=>x.id===id);return def?.key===key&&def?.target===target&&def?.rewards?.length===1&&def.rewards[0].type===type&&def.rewards[0].amount===amount;}));
let monthlyState=m.normalizeMissions(null,at('2026-08-15T05:00:00Z'));
monthlyState.monthly={...monthlyState.monthly,battles:100,wins:200,dailyCompletes:20,weeklyCompletes:3,quickRuns:20,challengeRuns:10,enhances:30,marketTrades:10};
check('月次は10個中8個でコンプリート',m.missionValue(monthlyState,'monthly',monthlyComplete)===8);
check('月次の次回更新は翌月1日JST 04:00',m.missionNextReset('monthly',at('2026-08-15T05:00:00Z'))===at('2026-08-31T19:00:00Z'));
const legacyMidMonth=m.normalizeMissions({dailyPeriod:'2026-08-15',weeklyPeriod:'2026-08-10',daily:{login:1},weekly:{},sentDaily:[],sentWeekly:[],weeklyLoginDays:[]},at('2026-08-15T05:00:00Z'));
check('月途中の旧セーブは月次を安全な初期値で補う',legacyMidMonth.monthlyPeriod==='2026-08'&&legacyMidMonth.monthly.battles===0&&Array.isArray(legacyMidMonth.sentMonthly)&&Array.isArray(legacyMidMonth.monthlyLoginDays));
let completionState=m.normalizeMissions(null,at('2026-08-29T05:00:00Z'));
completionState.daily={...completionState.daily,login:1,battles:3,challengeClears:1,enhances:1};
completionState=m.reconcileMonthlyMissionCompletions(completionState,at('2026-08-29T05:00:00Z'));
completionState=m.reconcileMonthlyMissionCompletions(completionState,at('2026-08-29T05:00:00Z'));
check('同じデイリー期間のコンプリートは月次へ1回だけ加算',completionState.monthly.dailyCompletes===1&&completionState.monthlyDailyCompletePeriods.length===1);
completionState.weekly={...completionState.weekly,battles:20,enhances:10,quickClears:5,challengeClears:3,marketTrades:3,itemUses:5};
completionState.weeklyLoginDays=['a','b','c','d','e'];
completionState=m.reconcileMonthlyMissionCompletions(completionState,at('2026-08-29T05:00:00Z'));
completionState=m.reconcileMonthlyMissionCompletions(completionState,at('2026-08-29T05:00:00Z'));
check('同じウィークリー期間のコンプリートは月次へ1回だけ加算',completionState.monthly.weeklyCompletes===1&&completionState.monthlyWeeklyCompletePeriods.length===1);
const nextMonth=m.normalizeMissions(completionState,at('2026-08-31T19:00:00Z'));
check('月替わりで月次進捗と受取履歴だけをリセット',nextMonth.monthlyPeriod==='2026-09'&&nextMonth.monthly.dailyCompletes===0&&nextMonth.sentMonthly.length===0&&completionState.daily.battles===3);
const receivedOld={...state,daily:{...state.daily,challengeClears:0},sentDaily:['daily_wins'],weekly:{...state.weekly,challengeClears:0,quickClears:0,itemUses:0},sentWeekly:['weekly_wins','weekly_donations','weekly_daily_claims']};
check('旧ID受取済みは新条件でも達成済みとして維持',m.missionValue(receivedOld,'daily',dailyChallenge)===1&&m.missionValue(receivedOld,'weekly',challenge)===3&&m.missionValue(receivedOld,'weekly',quick)===5&&m.missionValue(receivedOld,'weekly',items)===5);
check('日次・週次のモード条件はクリア確定で加算',source.includes("await saveMissionProgress('challengeClear')")&&source.includes("await saveMissionProgress('quickClear')")&&source.includes("await saveMissionProgress('proClear')")&&source.includes("await saveMissionProgress('extremeClear')"));
state.sentDaily=m.MISSION_DEFS.daily.map(x=>x.id);state.sentWeekly=m.MISSION_DEFS.weekly.map(x=>x.id);state.sentMonthly=m.MISSION_DEFS.monthly.map(x=>x.id);
check('ギフト送付済みは未受取バッジに含めない',m.missionClaimableCount(state)===0);
const base={gold:0,breederPoints:0,ownedItems:{}};
const gift={rewards:[{type:'trainingTicket',amount:3},{type:'trainingTicketLarge',amount:2},{type:'rainbowPsyche',amount:5},{type:'uniqueSkillResetTicket',amount:1},{type:'rainbowTranscendFruit',amount:1}],expiresAt:new Date(Date.now()+100000).toISOString(),claimedAt:null};
const claim=m.buildGiftClaim(gift,base);
check('新旧アイテム報酬を所持品へ加算',claim.ok&&claim.balances.ownedItems.training_ticket===3&&claim.balances.ownedItems.training_ticket_l===2&&claim.balances.ownedItems.rainbow_psyche===5&&claim.balances.ownedItems.unique_skill_reset_ticket===1&&claim.balances.ownedItems.transcend_fruit_rainbow===1);
const invalid=m.buildGiftClaim({...gift,rewards:[{type:'diamond',amount:1},{type:'unknown',amount:1}]},base);
check('不明報酬を含むギフトは全体を拒否',!invalid.ok&&base.gold===0);
check('アイテムまとめ使用は個数をミッションへ渡す',source.includes("saveMissionProgress('itemUse',count)")&&source.includes("saveMissionProgress('itemUse',Math.max(1,Math.floor(Number(amount)||1)))"));
check('月次カウンタは既存の行動確定箇所へ接続',source.includes("saveMissionProgress('win')")&&source.includes("saveMissionProgress('market')")&&source.includes("saveMissionProgress('enhance')")&&source.includes("saveMissionProgress('quickRun')")&&source.includes("saveMissionProgress('challengeRun')")&&source.includes("saveMissionProgress('modeRun')"));
check('ミッション画面はHOME BGMを継続',/MISSIONS:\s*'home'/.test(source));
check('固定ギフトIDと同期ロックで重複送付を防止',/gift_mission_\$\{type\}_\$\{period\}_\$\{mission\.id\}/.test(source)&&/missionClaimingRef\.current/.test(source));

// --- ブリーダーポイント(pt)の配りすぎを防ぐ ---
// ptはマーケットのアイコン(1個1pt)にしか使わない。1回の報酬で大量に配ると、
// もらった時点で使い道が無くなってしまう(ログインボーナスで100pt配っていた)。
// アイコンを全部買うのに必要な総額を基準に、1回あたりの上限を決める
const breederSrc = fs.readFileSync(path.join(TOOLS_DIR,'..','monster-hero','data','breeder.js'),'utf8');
const bctx = {}; vm.createContext(bctx);
vm.runInContext(breederSrc.slice(breederSrc.indexOf('const TEACHING_CARDS = ['))
  .replace(/\b[A-Z_]+_(?:ICON|IMG)\b|\bDISC_STONE_BASE\b/g, "''") + '\nglobalThis.__b=BREEDER_MARKET_ITEMS;', bctx);
const iconTotalCost = bctx.__b.filter(i => i.type === 'icon').reduce((a, i) => a + i.cost, 0);
const ptOf = (rewards) => (rewards || []).filter(r => r.type === 'breederPoint').reduce((a, r) => a + r.amount, 0);
const ptLimit = Math.max(1, Math.floor(iconTotalCost / 2));
const ptRewards = [
  ...m.LOGIN_BONUS_REWARDS.map((r, i) => [`ログインボーナス${i+1}日目`, ptOf(r)]),
  ...m.MISSION_DEFS.daily.map(x => [`デイリー:${x.name}`, ptOf(x.rewards)]),
  ...m.MISSION_DEFS.weekly.map(x => [`ウィークリー:${x.name}`, ptOf(x.rewards)]),
  ...m.MISSION_DEFS.monthly.map(x => [`マンスリー:${x.name}`, ptOf(x.rewards)]),
];
const ptOver = ptRewards.filter(([, v]) => v > ptLimit);
check(`1回に配るptがアイコン総額(${iconTotalCost}pt)の半分を超えない` + (ptOver.length ? ` — ${ptOver.map(([k,v])=>`${k}=${v}`).join(', ')}` : ''), ptOver.length === 0);
// ptはレベルアップでしか増えないのが本来の形。報酬として配る場合も上のしきい値までに収める
check('ptはレベルアップで増える形になっている',
  source.includes("const [breederPoints, setBreederPoints] = useState(0); // レベルアップ毎に+1"));
// ブリーダー経験値の報酬(ログインボーナス4日目・ウィークリー神殿)が正しく扱えること
const xpOf = (rewards) => (rewards || []).filter(r => r.type === 'breederXp').reduce((a, r) => a + r.amount, 0);
check('ブリーダー経験値を報酬として配れる',
  m.LOGIN_BONUS_REWARDS.some(r => xpOf(r) > 0) && m.MISSION_DEFS.weekly.some(x => xpOf(x.rewards) > 0));
const xpClaim = m.buildGiftClaim(
  { rewards:[{type:'breederXp',amount:100}], expiresAt:new Date(Date.now()+100000).toISOString(), claimedAt:null },
  { gold:0, breederPoints:0, breederXp:50, ownedItems:{} });
check('ギフトのブリーダー経験値が加算される', xpClaim.ok && xpClaim.balances.breederXp === 150);
check('経験値の報酬でレベルアップぶんのptも配る',
  source.includes('if (balances.breederXp !== breederXp) {')
    && source.includes('balances.breederPoints += gainedLevels;'));

// --- ログインボーナスでptとして配ってしまったぶんの付け替え(一度きり) ---
const fixCtx = {}; vm.createContext(fixCtx);
vm.runInContext(source.slice(source.indexOf("const LOGIN_PT_TO_XP_KEY"), source.indexOf('const grantCompensationGifts'))
  + '\nglobalThis.__f={LOGIN_PT_TO_XP_KEY,mistakenLoginPoints,applyLoginPointFix};', fixCtx);
const F = fixCtx.__f;
const loginGift = (amount, claimed) => ({ source:'loginBonus', claimedAt: claimed ? '2026-08-01T00:00:00.000Z' : null, rewards:[{type:'breederPoint',amount}] });
check('付け替えは新しい保存キーで一度だけ', F.LOGIN_PT_TO_XP_KEY === 'mh_login_pt_to_xp_v1'
  && source.includes("const ptFixDone = await storeGet(LOGIN_PT_TO_XP_KEY, false, false);")
  && source.includes("await storeSet(LOGIN_PT_TO_XP_KEY, true, false);"));
check('受け取り済みのぶんだけ数える',
  F.mistakenLoginPoints([loginGift(100, true), loginGift(100, false), loginGift(3, true)]) === 100);
check('ptを減らして同じだけ経験値を足す', (() => {
  const r = F.applyLoginPointFix(138, 1000, [loginGift(100, true)]);
  return r.changed && r.points === 38 && r.xp === 1100 && r.moved === 100;
})());
check('使ってしまっていてもptはマイナスにしない', (() => {
  const r = F.applyLoginPointFix(20, 0, [loginGift(100, true)]);
  return r.points === 0 && r.xp === 100 && r.moved === 20;
})());
check('対象が無ければ何もしない', F.applyLoginPointFix(50, 500, []).changed === false);
check('壊れた値でも落ちない', F.applyLoginPointFix(null, undefined, null).points === 0);

// --- お詫びのギフト ---
const compCtx = {}; vm.createContext(compCtx);
vm.runInContext(source.slice(source.indexOf('const COMPENSATION_GIFTS = ['), source.indexOf('const LOGIN_PT_TO_XP_KEY'))
  + '\nglobalThis.__c=COMPENSATION_GIFTS;', compCtx);
const comps = compCtx.__c;
check('お詫びのギフトidが重複していない', new Set(comps.map(c => c.id)).size === comps.length);
check('今回のお詫びでスキップチケット3種を配る', (() => {
  const g = comps.find(c => c.id === 'gift_compensation_20260801_points');
  if (!g) return false;
  const has = (t) => g.rewards.some(r => r.type === t && r.amount >= 1);
  return has('skipTicketJo') && has('skipTicketHa') && has('skipTicketKyu');
})());
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
