// スキップチケット(序・破・急)と、勇者モン選択のタブ(編成/ベースモン)を検証する。
// 報酬の計算は本番の関数をNode上で動かし、画面側の結線はソースで確認する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const breeder = fs.readFileSync(path.join(root, 'monster-hero/data/breeder.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const grab = (text, a, b) => text.slice(text.indexOf(a), text.indexOf(b));

// --- アイテム定義 ---
const itemCtx = {};
vm.createContext(itemCtx);
vm.runInContext(
  breeder.slice(breeder.indexOf('const BREEDER_MARKET_ITEMS = ['))
    .replace(/[A-Z_]+_ICON|DISC_STONE_BASE/g, "''")
  + '\nglobalThis.__i={BREEDER_MARKET_ITEMS,SKIP_TICKET_BY_DIFFICULTY};', itemCtx);
const { BREEDER_MARKET_ITEMS: items, SKIP_TICKET_BY_DIFFICULTY: byDiff } = itemCtx.__i;
const ticket = (id) => items.find(i => i.id === id);

// 価格は「その難易度を10WAVEクリアしたときに受け取れるダイヤ × 1.5」。
// 数字を直に書かず、本番の獲得ダイヤの式と難易度倍率から計算して照合する
const goldCtx = {};
vm.createContext(goldCtx);
vm.runInContext([
  grab(source, 'const WAVE_XP_TABLE =', 'const xpForLevel ='),
  grab(source, 'const DIFFICULTY_SETTINGS = {', 'const normalizeBattleDifficulty'),
  'globalThis.__g={goldForWavesCleared,DIFFICULTY_SETTINGS};',
].join('\n'), goldCtx);
const { goldForWavesCleared, DIFFICULTY_SETTINGS } = goldCtx.__g;
const skipClearGold = (diff) => goldForWavesCleared(10, DIFFICULTY_SETTINGS[diff].gold);
const expectedCost = (diff) => skipClearGold(diff) * 1.5;

check('スキップチケット・序はNormalの獲得ダイヤ×1.5', ticket('skip_ticket_jo')?.cost === expectedCost('Normal') && ticket('skip_ticket_jo')?.skipDifficulty === 'Normal', `${skipClearGold('Normal')}×1.5=${expectedCost('Normal')} / 実際${ticket('skip_ticket_jo')?.cost}`);
check('スキップチケット・破はHardの獲得ダイヤ×1.5', ticket('skip_ticket_ha')?.cost === expectedCost('Hard') && ticket('skip_ticket_ha')?.skipDifficulty === 'Hard', `${skipClearGold('Hard')}×1.5=${expectedCost('Hard')} / 実際${ticket('skip_ticket_ha')?.cost}`);
check('スキップチケット・急はExpertの獲得ダイヤ×1.5', ticket('skip_ticket_kyu')?.cost === expectedCost('Expert') && ticket('skip_ticket_kyu')?.skipDifficulty === 'Expert', `${skipClearGold('Expert')}×1.5=${expectedCost('Expert')} / 実際${ticket('skip_ticket_kyu')?.cost}`);
check('価格は難易度が上がるほど高い', ticket('skip_ticket_jo').cost < ticket('skip_ticket_ha').cost && ticket('skip_ticket_ha').cost < ticket('skip_ticket_kyu').cost);
check('3種ともマーケットで買える消耗アイテム', ['skip_ticket_jo', 'skip_ticket_ha', 'skip_ticket_kyu'].every(id => ticket(id)?.type === 'item' && ticket(id)?.usage === 'battleSkip'));
check('難易度→チケットの対応表がある', byDiff.Normal === 'skip_ticket_jo' && byDiff.Hard === 'skip_ticket_ha' && byDiff.Expert === 'skip_ticket_kyu');
check('スキップできる難易度は3つだけ', Object.keys(byDiff).length === 3, Object.keys(byDiff).join('/'));

// --- 配布(ログインボーナス・ミッション) ---
const rewardCtx = {};
vm.createContext(rewardCtx);
vm.runInContext([
  grab(source, 'const LOGIN_BONUS_REWARDS = [', 'const LOGIN_BONUS_DEFAULT'),
  grab(source, 'const MISSION_DEFS = {', 'const missionDailyPeriod'),
  'globalThis.__r={LOGIN_BONUS_REWARDS,GIFT_REWARD_LABELS,MISSION_DEFS};',
].join('\n'), rewardCtx);
const r = rewardCtx.__r;
const amountOf = (rewards, type) => (rewards || []).filter(x => x.type === type).reduce((a, x) => a + x.amount, 0);

check('ログインボーナスは毎日 序を1枚配る', r.LOGIN_BONUS_REWARDS.length === 7 && r.LOGIN_BONUS_REWARDS.every(day => amountOf(day, 'skipTicketJo') === 1));
check('ログインボーナスの既存報酬は残っている',
  amountOf(r.LOGIN_BONUS_REWARDS[0], 'diamond') === 500 && amountOf(r.LOGIN_BONUS_REWARDS[5], 'diamond') === 2000
    && amountOf(r.LOGIN_BONUS_REWARDS[1], 'dyeMock') === 1 && amountOf(r.LOGIN_BONUS_REWARDS[6], 'bondPointReset') === 1);

const dailyComplete = r.MISSION_DEFS.daily.find(x => x.id === 'daily_complete');
const weeklyComplete = r.MISSION_DEFS.weekly.find(x => x.id === 'weekly_complete');
check('デイリーコンプリート報酬に 破 を1枚追加', amountOf(dailyComplete.rewards, 'skipTicketHa') === 1 && amountOf(dailyComplete.rewards, 'diamond') === 500);
check('ウィークリーコンプリート報酬に 急 を1枚追加', amountOf(weeklyComplete.rewards, 'skipTicketKyu') === 1 && amountOf(weeklyComplete.rewards, 'diamond') === 2000);
check('ギフトの表示名が3種とも登録されている',
  r.GIFT_REWARD_LABELS.skipTicketJo === 'スキップチケット・序' && r.GIFT_REWARD_LABELS.skipTicketHa === 'スキップチケット・破' && r.GIFT_REWARD_LABELS.skipTicketKyu === 'スキップチケット・急');
check('ギフト受取で正しいアイテムidへ変換する',
  has("skipTicketJo:'skip_ticket_jo', skipTicketHa:'skip_ticket_ha', skipTicketKyu:'skip_ticket_kyu'"));

// --- スキップの実処理 ---
const skipBlock = grab(source, 'const executeBattleSkip', 'const openBattleSkip');
check('チケットが無ければ実行しない', skipBlock.includes("if ((ownedItems[item.id] || 0) <= 0) return;"));
check('連打しても1枚しか消費しない', skipBlock.includes('if (skipProcessingRef.current) return;') && skipBlock.includes('skipProcessingRef.current = true;'));
check('チケットを1枚減らして保存する', skipBlock.includes("[item.id]: (ownedItems[item.id] || 0) - 1") && skipBlock.includes("storeSet('mh_owned_items', nextItems, false)"));
check('経験値の計算は通常クリアと同じ式', skipBlock.includes('xpForWavesCleared(SKIP_WAVES, scoreMult)') && skipBlock.includes('goldForWavesCleared(SKIP_WAVES, goldMult)'));
check('WAVE10まで到達した扱いにする', has('const SKIP_WAVES = 10;'));
check('絆経験値の配り方も通常と同じ(勇者=満額・供モン1/2・控え1/4)', skipBlock.includes('buildRunBondAwards({'));
check('絆レベルが上がれば強化ポイントも配る', skipBlock.includes('distAptPoints: (mon.distAptPoints || 0) + (after.level - before.level)'));
check('ブリーダー経験値とポイントも入る', skipBlock.includes("storeSet('mh_breeder_xp', nextBreederXp, false)") && skipBlock.includes("storeSet('mh_breeder_points', next, false)"));
check('ダイヤも入る', skipBlock.includes("storeSet('mh_gold', goldAfter, false)"));
// A案: スコア・ランキング・クリア回数・ミッションは対象外
check('スコアを加算しない', !skipBlock.includes('setScore('));
check('ランキングへ送らない', !skipBlock.includes('submitRunScoreOnce') && !skipBlock.includes('submitLocalScore'));
check('クリア回数を記録しない', !skipBlock.includes('recordClearOnce') && !skipBlock.includes('mh_clears_'));
check('ミッション進捗を進めない', !skipBlock.includes('saveMissionProgress'));
check('マスモン登録はしない', !skipBlock.includes('registerMasuMon'));

// --- 画面 ---
check('難易度カードにスキップと説明ボタンがある', has('openBattleSkip(key)') && has('setSkipInfoItemId(tid)'));
check('チケットが無ければスキップは押せない', has('disabled={have<=0}') && has("'bg-slate-800 text-slate-500'"));
check('スキップの文字は1行に収まる形にする', has('whitespace-nowrap') && has('<span>スキップ</span>') && has('{have}枚'));
// 説明ボタンには disabled を付けない(チケットが無くても読める)
const infoButton = source.slice(source.indexOf('<button onClick={()=>setSkipInfoItemId(tid)}'), source.indexOf('？</button>'));
check('説明ボタンはチケットが無くても押せる', infoButton.length > 0 && !infoButton.includes('disabled'));
check('説明に何がもらえて何がもらえないかを書く', has('受け取れるもの') && has('受け取れないもの') && has('スコアとランキングへの記録'));
check('編成を決める画面がある', has("gameState==='SKIP_PICK'") && has('勇者モン') && has('供モン1'));
check('編成/ベースモンのタブがある', has('setSkipPickTab(key)') && has('getUnlockedBaseMonsterList()'));
check('同じ種を二重に選べない', has('const skipMonKey = (mon) => mon ? String(mon.id)') && has('chosenKeys.has(skipMonKey(mon))'));
check('勇者モンを選ぶまで決定できない', has('disabled={!skipFlow.hero}'));
check('使う前に確認が出る', has('を使いますか？') && has('executeBattleSkip'));
check('専用リザルトがある', has("gameState==='SKIP_RESULT'") && has('Skip Complete'));
check('リザルトに簡単な演出がある', has('setSkipAnimPhase(1)') && has('skipAnimPhase>0'));
check('リザルトに記録されない旨を出す', has('スコア・ランキング・クリア回数には記録されません'));
check('アイテム欄では使う対象を選ばせない', has("item.usage==='battleSkip'") && has('スキップで使用'));
check('スキップ画面のBGMが決まっている', has("SKIP_PICK: 'enhance',") && has("SKIP_RESULT: 'result',"));
check('ヘルプにスキップチケットの説明がある', has('スキップチケット・序:'));
// 所持数がどこでも分かるようにする
check('確認画面で使う前後の所持数が分かる', has('所持数 {ownedItems[skipFlow.itemId]||0}枚 → {Math.max(0,(ownedItems[skipFlow.itemId]||0)-1)}枚'));
check('リザルトで残り枚数が分かる', has('を1枚使いました（残り {ownedItems[skipResult.itemId]||0}枚）') && has('itemId: item.id,'));
check('説明モーダルにも所持数を出す', has('所持数: <b className="text-white">{ownedItems[item.id]||0}</b> 枚'));
// 難易度カードのバッジは中央に来ている1難易度ぶんしか見えないため、
// 難易度タブの上に3種の所持数をまとめて常時出す
const ticketRow = grab(source, '<span className="text-[8px] font-black text-slate-500 tracking-[.12em]">所持スキップチケット</span>', '</div>\n              )}<div className="relative shrink-0">');
check('難易度タブに3種の所持数をまとめて出す', ticketRow.length > 0 && ticketRow.includes('Object.entries(SKIP_TICKETS).map(([diff,tid])=>'));
check('まとめ表示は序/破/急の短い名前と枚数を出す', ticketRow.includes("(item?.name||'').split('・')[1]") && ticketRow.includes('<span className="font-mono">{have}枚</span>'));
check('まとめ表示は0枚でも消さずに灰色で出す', ticketRow.includes("have>0?'bg-teal-950/70 border-teal-500/40 text-teal-200':'bg-black/30 border-white/5 text-slate-500'"));
check('まとめ表示から説明を開ける', ticketRow.includes('onClick={()=>setSkipInfoItemId(tid)}'));

// --- 勇者モン選択のタブ ---
check('勇者モン選択にタブがある', has("setHeroPickTab(key); setCurrentPickingMon(null);") && has("[['roster','編成'],['base','ベースモン']]"));
check('ベースモンタブは解放済みの種を全部出す', has("gameState==='PICK_HERO'&&heroPickTab==='base'?getUnlockedBaseMonsterList():monSelection"));
check('タブは勇者モン選択だけに出す', has("{gameState==='PICK_HERO'&&(\n            <div className=\"shrink-0 w-full max-w-md mx-auto mb-2\">"));
check('挑戦するたびに編成タブから始まる', has("setHeroPickTab('roster');setGameState('PICK_HERO');"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
