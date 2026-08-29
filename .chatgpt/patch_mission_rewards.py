from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'monster-hero/src/game-system.jsx'
HELP = ROOT / 'monster-hero/data/help.js'
CHANGELOG = ROOT / 'monster-hero/data/changelog.js'
MISSION_CHECK = ROOT / 'tools/boot/mission-check.js'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, got {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, repl, label, flags=0):
    out, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, got {count}')
    return out

src = SRC.read_text()

old_login = """const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 },      { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:1000 },     { type:'skipTicketJo', amount:1 }],
  [{ type:'breederXp', amount:100 },    { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:2000 },     { type:'skipTicketJo', amount:1 }],
  [{ type:'bondPointReset', amount:1 }, { type:'skipTicketJo', amount:1 }],
];"""
new_login = """const LOGIN_BONUS_REWARDS = [
  [{ type:'diamond', amount:500 },             { type:'skipTicketJo', amount:1 }],
  [{ type:'dyeMock', amount:1 },               { type:'skipTicketJo', amount:1 }],
  [{ type:'trainingTicket', amount:5 },        { type:'skipTicketJo', amount:1 }],
  [{ type:'breederXp', amount:200 },           { type:'skipTicketJo', amount:1 }],
  [{ type:'uniqueSkillResetTicket', amount:1 },{ type:'skipTicketJo', amount:1 }],
  [{ type:'diamond', amount:2000 }, { type:'rainbowPsyche', amount:10 }, { type:'skipTicketJo', amount:1 }],
  [{ type:'bondPointReset', amount:1 }, { type:'trainingTicketLarge', amount:1 }, { type:'skipTicketJo', amount:1 }],
];"""
src = replace_once(src, old_login, new_login, 'login rewards')

old_labels = "const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーポイント', breederXp:'ブリーダー経験値', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットアイテム', trainingTicket:'トレーニングチケット', trainingTicketLarge:'重トレーニングチケット', skipTicketJo:'スキップチケット・序', skipTicketHa:'スキップチケット・破', skipTicketKyu:'スキップチケット・急' };"
new_labels = "const GIFT_REWARD_LABELS = { diamond:'ダイヤ', breederPoint:'ブリーダーポイント', breederXp:'ブリーダー経験値', dyeMock:'染色もどき', bondPointReset:'絆ポイントリセットの書', uniqueSkillResetTicket:'スキルポイントリセット券', rainbowPsyche:'虹のプシュケー', trainingTicket:'トレーニングチケット', trainingTicketLarge:'重トレーニングチケット', skipTicketJo:'スキップチケット・序', skipTicketHa:'スキップチケット・破', skipTicketKyu:'スキップチケット・急' };"
src = replace_once(src, old_labels, new_labels, 'gift labels')

old_item_ids = "const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l', skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu' };"
new_item_ids = "const itemIds = { dyeMock:'dye_mock', bondPointReset:'bond_reset_scroll', uniqueSkillResetTicket:'unique_skill_reset_ticket', rainbowPsyche:'rainbow_psyche', trainingTicket:'training_ticket', trainingTicketLarge:'training_ticket_l', skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu' };"
src = replace_once(src, old_item_ids, new_item_ids, 'gift item ids')

mission_block = r"""const missionDailyPeriod = loginBonusPeriodKey;
const missionWeeklyPeriod = (now=Date.now()) => { const d=new Date(Number(now)+5*60*60*1000); const day=d.getUTCDay(); d.setUTCDate(d.getUTCDate()-((day+6)%7)); return d.toISOString().slice(0,10); };
const MISSION_WEEK_ROTATION_EPOCH = '2026-08-24';
const missionPeriodWeekday = (now=Date.now()) => new Date(`${missionDailyPeriod(now)}T00:00:00Z`).getUTCDay();
const missionWeekRotationIndex = (now=Date.now()) => {
  const periodMs=Date.parse(`${missionWeeklyPeriod(now)}T00:00:00Z`), epochMs=Date.parse(`${MISSION_WEEK_ROTATION_EPOCH}T00:00:00Z`);
  const index=Math.floor((periodMs-epochMs)/(7*24*60*60*1000));
  return ((index%4)+4)%4;
};
const DAILY_ROTATION_MISSIONS = Object.freeze({
  1:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'diamond',amount:200}]},
  2:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'trainingTicket',amount:3}]},
  3:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
  4:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  5:{id:'daily_rotation',name:'本日のミッション',condition:'アイテムを1個使用する',key:'itemUses',target:1,rewards:[{type:'dyeMock',amount:1}]},
  6:{id:'daily_rotation',name:'本日のミッション',condition:'プロモードを1回クリアする',key:'proClears',target:1,rewards:[{type:'diamond',amount:300}]},
  0:{id:'daily_rotation',name:'本日のミッション',condition:'クイックモードを1回クリアする',key:'quickClears',target:1,rewards:[{type:'trainingTicketLarge',amount:1}]},
});
const WEEKLY_ROTATION_MISSIONS = Object.freeze([
  {id:'weekly_rotation',name:'今週のミッション',condition:'プロモードを3回クリアする',key:'proClears',target:3,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'極限チャレンジを1回クリアする（未解放ならクイックモードを10回クリア）',key:'extremeOrQuick',target:1,rewards:[{type:'rainbowPsyche',amount:30}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'クイックモードを10回クリアする',key:'quickClears',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  {id:'weekly_rotation',name:'今週のミッション',condition:'アイテムを10個使用する',key:'itemUses',target:10,rewards:[{type:'bondPointReset',amount:1}]},
]);
const missionDailyDefinitions = (now=Date.now()) => [
  {id:'daily_login',name:'今日もMonster Hero！',condition:'その期間中にログインする',key:'login',target:1,rewards:[{type:'diamond',amount:100}]},
  {id:'daily_battles',name:'バトルに挑戦',condition:'バトルを3回行う',key:'battles',target:3,rewards:[{type:'trainingTicket',amount:3}]},
  // 旧 daily_wins のIDは受取履歴互換のため維持。条件は通常チャレンジのクリアへ置き換える。
  {id:'daily_wins',name:'デイリーチャレンジ',condition:'チャレンジモードを1回クリアする',key:'challengeClears',target:1,rewards:[{type:'rainbowPsyche',amount:5}]},
  {id:'daily_enhance',name:'モンスター育成',condition:'モンスターを1回強化する',key:'enhances',target:1,rewards:[{type:'diamond',amount:200}]},
  {...DAILY_ROTATION_MISSIONS[missionPeriodWeekday(now)]},
  {id:'daily_complete',name:'デイリーコンプリート',condition:'通常デイリー5個のうち4個を達成する',key:'complete',target:4,rewards:[{type:'diamond',amount:500},{type:'skipTicketHa',amount:1}],complete:true},
];
const missionWeeklyDefinitions = (now=Date.now()) => [
  {id:'weekly_logins',name:'継続は力なり',condition:'異なる5日分のログインを行う',key:'loginDays',target:5,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_battles',name:'バトル週間',condition:'バトルを20回行う',key:'battles',target:20,rewards:[{type:'diamond',amount:500}]},
  {id:'weekly_enhance',name:'育成週間',condition:'モンスターを10回強化する',key:'enhances',target:10,rewards:[{type:'trainingTicketLarge',amount:2}]},
  // 旧 weekly_wins のIDをクイック枠へ再利用し、同期間の二重受取を防ぐ。
  {id:'weekly_wins',name:'クイック育成',condition:'クイックモードを5回クリアする',key:'quickClears',target:5,rewards:[{type:'rainbowPsyche',amount:20}]},
  // 旧IDは受取履歴互換のため維持。旧「プレイ」から通常チャレンジのクリアへ変更する。
  {id:'weekly_donations',name:'チャレンジャー',condition:'チャレンジモードを3回クリアする',key:'challengeClears',target:3,rewards:[{type:'breederXp',amount:300}]},
  {id:'weekly_market',name:'マーケット常連',condition:'マーケットで3回購入する',key:'marketTrades',target:3,rewards:[{type:'dyeMock',amount:2}]},
  // 旧 weekly_daily_claims のIDをアイテム使用枠へ再利用する。
  {id:'weekly_daily_claims',name:'アイテム活用',condition:'アイテムを5個使用する',key:'itemUses',target:5,rewards:[{type:'uniqueSkillResetTicket',amount:1}]},
  {...WEEKLY_ROTATION_MISSIONS[missionWeekRotationIndex(now)]},
  {id:'weekly_complete',name:'ウィークリーコンプリート',condition:'通常ウィークリー8個のうち6個を達成する',key:'complete',target:6,rewards:[{type:'diamond',amount:2000},{type:'skipTicketKyu',amount:1},{type:'rainbowPsyche',amount:30}],complete:true},
];
// 既存コードは MISSION_DEFS.daily / weekly を参照するため、getterで現在のJST期間のローテーションを返す。
const MISSION_DEFS = {
  get daily(){ return missionDailyDefinitions(); },
  get weekly(){ return missionWeeklyDefinitions(); },
};
const emptyMissionCounts = () => ({login:0,battles:0,wins:0,enhances:0,dailyClaims:0,marketTrades:0,donations:0,challengeRuns:0,challengeClears:0,quickClears:0,proClears:0,extremeClears:0,itemUses:0});
const normalizeMissions = (value,now=Date.now()) => {
  const dailyPeriod=missionDailyPeriod(now), weeklyPeriod=missionWeeklyPeriod(now), old=value&&typeof value==='object'?value:{};
  const dailySame=old.dailyPeriod===dailyPeriod, weeklySame=old.weeklyPeriod===weeklyPeriod;
  return {version:1,dailyPeriod,weeklyPeriod,daily:dailySame?{...emptyMissionCounts(),...(old.daily||{})}:emptyMissionCounts(),weekly:weeklySame?{...emptyMissionCounts(),...(old.weekly||{})}:emptyMissionCounts(),sentDaily:dailySame&&Array.isArray(old.sentDaily)?old.sentDaily:[],sentWeekly:weeklySame&&Array.isArray(old.sentWeekly)?old.sentWeekly:[],weeklyLoginDays:weeklySame&&Array.isArray(old.weeklyLoginDays)?old.weeklyLoginDays:[]};
};
const missionValue = (state,type,mission) => {
  if(mission.complete){ const normal=MISSION_DEFS[type].filter(m=>!m.complete); return normal.filter(m=>missionValue(state,type,m)>=m.target).length; }
  if(mission.key==='loginDays') return state.weeklyLoginDays.length;
  // 旧仕様で同じIDの報酬を受取済みなら、新条件へ変わった同じ期間でも達成済みとして扱う。
  const sent=type==='daily'?state.sentDaily:state.sentWeekly;
  if(Array.isArray(sent)&&sent.includes(mission.id)) return mission.target;
  if(type==='weekly'&&mission.key==='extremeOrQuick') return ((Number(state.weekly?.extremeClears)||0)>=1||(Number(state.weekly?.quickClears)||0)>=10)?1:0;
  return Number(state[type]?.[mission.key])||0;
};
// 「達成済みかつ未受取(ギフト未送付)」のミッション。HOMEの通知バッジ・タブのバッジ・一括受取が
// すべてこの判定を共有するので、どこか1か所だけ数え方がずれることがない
const missionClaimableList = (state,type) => MISSION_DEFS[type].filter(m=>missionValue(state,type,m)>=m.target && !(type==='daily'?state.sentDaily:state.sentWeekly).includes(m.id));
const missionClaimableCount = state => ['daily','weekly'].reduce((sum,type)=>sum+missionClaimableList(state,type).length,0);
const missionNextReset = (type,now=Date.now()) => { const shifted=new Date(Number(now)+5*60*60*1000); shifted.setUTCHours(0,0,0,0); shifted.setUTCDate(shifted.getUTCDate()+(type==='daily'?1:7-((shifted.getUTCDay()+6)%7))); return shifted.getTime()-5*60*60*1000; };
"""
src = regex_once(src, r"const MISSION_DEFS = \{.*?const missionNextReset = .*?;\n", mission_block, 'mission definitions', re.S)

old_progress = """  const saveMissionProgress = async (event,amount=1) => {
    // 記録を残さない戦い(バトルのれんしゅう・デバッグ戦)ではミッションも進めない。
    // WAVEクリア時の battle/win がここを通っていたため、練習でも進んでしまっていた
    if (debugBattleRef.current) return;
    const next=normalizeMissions(missionsRef.current);
    const key={battle:'battles',win:'wins',enhance:'enhances',market:'marketTrades',donation:'donations',challengeRun:'challengeRuns'}[event];
    if(!key)return;
    next.daily[key]=(Number(next.daily[key])||0)+amount;
    next.weekly[key]=(Number(next.weekly[key])||0)+amount;
    missionsRef.current=next; setMissions(next); await storeSet('mh_missions',next,false);
  };"""
new_progress = """  const saveMissionProgress = async (event,amount=1) => {
    // 記録を残さない戦い(バトルのれんしゅう・デバッグ戦)ではミッションも進めない。
    if (debugBattleRef.current) return;
    const n=Math.max(0,Math.floor(Number(amount)||0));
    if(n<=0)return;
    const rule={
      battle:{key:'battles',daily:true,weekly:true},
      enhance:{key:'enhances',daily:true,weekly:true},
      market:{key:'marketTrades',daily:false,weekly:true},
      challengeClear:{key:'challengeClears',daily:true,weekly:true},
      quickClear:{key:'quickClears',daily:true,weekly:true},
      proClear:{key:'proClears',daily:true,weekly:true},
      extremeClear:{key:'extremeClears',daily:false,weekly:true},
      itemUse:{key:'itemUses',daily:true,weekly:true},
    }[event];
    if(!rule)return;
    const next=normalizeMissions(missionsRef.current);
    if(rule.daily)next.daily[rule.key]=(Number(next.daily[rule.key])||0)+n;
    if(rule.weekly)next.weekly[rule.key]=(Number(next.weekly[rule.key])||0)+n;
    missionsRef.current=next; setMissions(next); await storeSet('mh_missions',next,false);
  };"""
src = replace_once(src, old_progress, new_progress, 'mission progress')

src = regex_once(src, r"\n    // 通常プレイのチャレンジモードでWAVE 1の戦闘が成立した時点だけ、1周につき1回数える。.*?void saveMissionProgress\('challengeRun'\);\n    \}\n", "\n", 'remove challenge WAVE1 mission', re.S)

# クリア確定のモード別分岐にだけ加算する。種族チャレンジは先にreturnするので対象外。
src = replace_once(src,
"""      await storeSet(extremeClearCountKey(extremeDifficulty), nextExtreme, false);
      addAssistantBond('extremeClear');""",
"""      await storeSet(extremeClearCountKey(extremeDifficulty), nextExtreme, false);
      await saveMissionProgress('extremeClear');
      addAssistantBond('extremeClear');""", 'extreme clear mission')
src = replace_once(src,
"""      await storeSet(clearCountKey(BATTLE_MODE_QUICK, difficulty), nextQuick, false);
      addAssistantBond('quickClear');""",
"""      await storeSet(clearCountKey(BATTLE_MODE_QUICK, difficulty), nextQuick, false);
      await saveMissionProgress('quickClear');
      addAssistantBond('quickClear');""", 'quick clear mission')
src = replace_once(src,
"""      await storeSet(clearCountKey(BATTLE_MODE_PRO, difficulty), nextPro, false);
      addAssistantBond('proClear');""",
"""      await storeSet(clearCountKey(BATTLE_MODE_PRO, difficulty), nextPro, false);
      await saveMissionProgress('proClear');
      addAssistantBond('proClear');""", 'pro clear mission')
src = replace_once(src,
"""    await storeSet(`mh_clears_${difficulty}`, nextCount, false);
    addAssistantBond('clear');""",
"""    await storeSet(`mh_clears_${difficulty}`, nextCount, false);
    await saveMissionProgress('challengeClear');
    addAssistantBond('clear');""", 'challenge clear mission')

# アイテムの実消費だけを数える。失敗・キャンセルではこれらの行まで来ない。
src = replace_once(src,
"setOwnedItems(prev => { const next = { ...prev, dye_mock: (prev.dye_mock || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });\n    addAssistantBond('dye');",
"setOwnedItems(prev => { const next = { ...prev, dye_mock: (prev.dye_mock || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });\n    void saveMissionProgress('itemUse',1);\n    addAssistantBond('dye');", 'dye item use')
src = replace_once(src,
"setOwnedItems(prev => { const next = { ...prev, bond_reset_scroll: (prev.bond_reset_scroll || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });\n    Audio_.se.tap();",
"setOwnedItems(prev => { const next = { ...prev, bond_reset_scroll: (prev.bond_reset_scroll || 0) - 1 }; storeSet('mh_owned_items', next, false); return next; });\n    void saveMissionProgress('itemUse',1);\n    Audio_.se.tap();", 'bond reset item use')
src = replace_once(src,
"""    Audio_.se.tap();
    return result;
  };
  // 絆経験値のチケット""",
"""    void saveMissionProgress('itemUse',1);
    Audio_.se.tap();
    return result;
  };
  // 絆経験値のチケット""", 'unique reset item use')
src = replace_once(src,
"if(result)setXpTicketUse({itemId:item.id,masuId:masu.id,count,usedCount:count,result});",
"if(result){void saveMissionProgress('itemUse',count);setXpTicketUse({itemId:item.id,masuId:masu.id,count,usedCount:count,result});}", 'xp ticket item use')
src = replace_once(src,
"""            const done = await useTranscendResetScroll(masu.id);
            if (done) setTranscendResetOpen(false);""",
"""            const done = await useTranscendResetScroll(masu.id);
            if (done) { await saveMissionProgress('itemUse',1); setTranscendResetOpen(false); }""", 'transcend reset item use')
# スキップチケットも正常に消費した枚数ぶんアイテム使用として扱う。
src = replace_once(src,
"""      setOwnedItems(nextItems);
      await storeSet('mh_owned_items', nextItems, false);

      const scoreMult""",
"""      setOwnedItems(nextItems);
      await storeSet('mh_owned_items', nextItems, false);
      await saveMissionProgress('itemUse',count);

      const scoreMult""", 'skip item use')

# 超越の実は正常保存できたときだけ使用個数ぶん進める。
src = regex_once(src,
    r"(const commitTranscendFruit = async \(masu, itemId, amount\) => \{.*?const saved=await saveTranscendFruitPair\(.*?\);\n\s*if\(!saved\).*?\n)(\s*ownedItemsRef\.current=result\.nextOwnedItems;)",
    r"\1    await saveMissionProgress('itemUse',Math.max(1,Math.floor(Number(amount)||1)));\n\2",
    'transcend fruit item use', re.S)

SRC.write_text(src)

# ヘルプ：数値表は既存の実データ参照を維持し、説明だけ新仕様へ更新。
help_text = HELP.read_text()
old_help = "{ t:'p', text:'ウィークリーの「チャレンジ挑戦」は、通常プレイのチャレンジモードでWAVE 1のバトルを開始すると1周につき1回進みます。クイックモード、バトルのれんしゅう、デバッグバトル、スキップチケットは対象外です。' },"
new_help = "{ t:'p', text:'デイリーは通常5項目のうち4項目、ウィークリーは通常8項目のうち6項目を達成するとコンプリートです。デイリーには曜日ごとの「本日のミッション」、ウィークリーには4週周期の「今週のミッション」があり、どちらもJST 04:00の期間更新に合わせて切り替わります。通常チャレンジのミッションはWAVE10クリアで進み、クイック・プロ・極限・種族チャレンジのクリアとは別に数えます。' },"
help_text = replace_once(help_text, old_help, new_help, 'help mission text')
HELP.write_text(help_text)

# 更新履歴を先頭へ追加。
changelog = CHANGELOG.read_text()
entry = """  {
    date: \"2026-08-29 13:53\", type: 'update', title: 'ログイン・デイリー・ウィークリー報酬をリニューアルしました', status: 'new',
    items: [
      '7日ログインボーナスにトレーニングチケット、スキルポイントリセット券、虹のプシュケーなどを追加し、毎日のスキップチケット・序はこれまでどおり1枚ずつ受け取れます。',
      'デイリーは5項目中4項目でコンプリートする形に変更し、通常チャレンジ1回クリアと曜日ごとの日替わりミッションを追加しました。デイリーコンプリートのダイヤ500とスキップチケット・破1枚は維持しています。',
      'ウィークリーは8項目中6項目でコンプリートする形に変更し、クイック・通常チャレンジ・アイテム使用・4週周期ミッションなど、現在の遊び方に合わせて報酬の種類を増やしました。スキップチケット・急1枚も維持しています。',
    ],
  },
"""
changelog = replace_once(changelog, "const CHANGELOG = [\n", "const CHANGELOG = [\n" + entry, 'changelog insert')
CHANGELOG.write_text(changelog)

# 既存 mission-check の後半の資産/ブリーダーpt検査は残し、ミッション部分だけ新仕様へ更新。
check_text = MISSION_CHECK.read_text()
marker = '// --- ブリーダーポイント(pt)の配りすぎを防ぐ ---'
if marker not in check_text:
    raise SystemExit('mission-check marker missing')
tail = check_text[check_text.index(marker):]
head = r"""const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ミッションのJST期間更新、達成判定、ギフト報酬互換性を本番ソースから検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR,'..','monster-hero','src','game-system.jsx'),'utf8');
const start = source.indexOf('const LOGIN_BONUS_REWARDS');
const end = source.indexOf('const STAT_POINT_GAIN');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(start,end)}\nglobalThis.__m={LOGIN_BONUS_REWARDS,MISSION_DEFS,missionDailyPeriod,missionWeeklyPeriod,missionPeriodWeekday,missionWeekRotationIndex,normalizeMissions,missionValue,missionClaimableCount,missionNextReset,buildGiftClaim};`,context);
const m=context.__m;
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;};
const at=s=>Date.parse(s);
check('デイリーはJST 04:00で切り替わる',m.missionDailyPeriod(at('2026-07-29T18:59:59Z'))==='2026-07-29'&&m.missionDailyPeriod(at('2026-07-29T19:00:00Z'))==='2026-07-30');
check('ウィークリーは月曜JST 04:00で切り替わる',m.missionWeeklyPeriod(at('2026-08-02T18:59:59Z'))==='2026-07-27'&&m.missionWeeklyPeriod(at('2026-08-02T19:00:00Z'))==='2026-08-03');
const login=m.LOGIN_BONUS_REWARDS;
check('ログイン7日すべて序1枚を維持',login.length===7&&login.every(r=>r.some(x=>x.type==='skipTicketJo'&&x.amount===1)));
check('ログイン報酬を新アイテム構成へ更新',login[2].some(x=>x.type==='trainingTicket'&&x.amount===5)&&login[3].some(x=>x.type==='breederXp'&&x.amount===200)&&login[4].some(x=>x.type==='uniqueSkillResetTicket'&&x.amount===1)&&login[5].some(x=>x.type==='rainbowPsyche'&&x.amount===10)&&login[6].some(x=>x.type==='trainingTicketLarge'&&x.amount===1));
const daily=m.MISSION_DEFS.daily,weekly=m.MISSION_DEFS.weekly;
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
const receivedOld={...state,daily:{...state.daily,challengeClears:0},sentDaily:['daily_wins'],weekly:{...state.weekly,challengeClears:0,quickClears:0,itemUses:0},sentWeekly:['weekly_wins','weekly_donations','weekly_daily_claims']};
check('旧ID受取済みは新条件でも達成済みとして維持',m.missionValue(receivedOld,'daily',dailyChallenge)===1&&m.missionValue(receivedOld,'weekly',challenge)===3&&m.missionValue(receivedOld,'weekly',quick)===5&&m.missionValue(receivedOld,'weekly',items)===5);
check('WAVE1プレイ加算を廃止しクリア確定でモード別加算',!source.includes("saveMissionProgress('challengeRun')")&&source.includes("await saveMissionProgress('challengeClear')")&&source.includes("await saveMissionProgress('quickClear')")&&source.includes("await saveMissionProgress('proClear')")&&source.includes("await saveMissionProgress('extremeClear')"));
state.sentDaily=m.MISSION_DEFS.daily.map(x=>x.id);state.sentWeekly=m.MISSION_DEFS.weekly.map(x=>x.id);
check('ギフト送付済みは未受取バッジに含めない',m.missionClaimableCount(state)===0);
const base={gold:0,breederPoints:0,ownedItems:{}};
const gift={rewards:[{type:'trainingTicket',amount:3},{type:'trainingTicketLarge',amount:2},{type:'rainbowPsyche',amount:5},{type:'uniqueSkillResetTicket',amount:1}],expiresAt:new Date(Date.now()+100000).toISOString(),claimedAt:null};
const claim=m.buildGiftClaim(gift,base);
check('新旧アイテム報酬を所持品へ加算',claim.ok&&claim.balances.ownedItems.training_ticket===3&&claim.balances.ownedItems.training_ticket_l===2&&claim.balances.ownedItems.rainbow_psyche===5&&claim.balances.ownedItems.unique_skill_reset_ticket===1);
const invalid=m.buildGiftClaim({...gift,rewards:[{type:'diamond',amount:1},{type:'unknown',amount:1}]},base);
check('不明報酬を含むギフトは全体を拒否',!invalid.ok&&base.gold===0);
check('アイテムまとめ使用は個数をミッションへ渡す',source.includes("saveMissionProgress('itemUse',count)")&&source.includes("saveMissionProgress('itemUse',Math.max(1,Math.floor(Number(amount)||1)))"));
check('ミッション画面はHOME BGMを継続',/MISSIONS:\s*'home'/.test(source));
check('固定ギフトIDと同期ロックで重複送付を防止',/gift_mission_\$\{type\}_\$\{period\}_\$\{mission\.id\}/.test(source)&&/missionClaimingRef\.current/.test(source));

"""
MISSION_CHECK.write_text(head + tail)

print('mission reward refresh patch applied')
