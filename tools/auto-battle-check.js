const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const has = text => source.includes(text);

assert(has('const [autoBattle, setAutoBattle] = useState(false);'), 'AUTOの初期値がOFFではありません');
assert(has('const autoBattleRef = useRef(false);'), 'AUTOの同期refがありません');
assert(has('const autoTurnRunningRef = useRef(false);'), 'AUTO実行ロックがありません');
assert(has('const autoTurnScheduledRef = useRef(false);'), 'AUTO予約ロックがありません');
assert(!/setInterval\s*\(/.test(source.slice(source.indexOf('const setAutoBattleEnabled'), source.indexOf('// WAVE 10'))), 'AUTOがsetIntervalを使用しています');
assert(has('const turnPromise=runAutoTurnOnce();'), '連続AUTOがrunAutoTurnOnceを使用していません');
assert(has('return entries.length>0 ? processTurn(entries) : null'), 'AUTOが明示entriesのPromiseを返していません');
assert(has("const blocked=gameState!=='BATTLE'||!enemy||enemy.hp<=0||isBusy||"), 'BATTLE・敵・busyの実行条件がありません');
assert(has('!!battleScenarioRef.current||battleTutorialStep!=null||'), 'バトル練習のAUTO禁止がありません');
assert(has("addPopup('AUTO停止：使えるカードがありません'"), '合法行動なしのAUTO停止がありません');
assert(has('if(isBusy||autoBattleRef.current) return;'), '手動カード選択・割当のAUTOガードがありません');
assert(has('const canAct=!autoBattle&&!isBusy'), 'AUTO中のACTION無効化がありません');
assert(has('disabled={isBusy||autoBattle||!battleTutorialAllowsEmergency}'), 'AUTO中の緊急回復無効化がありません');
assert(has("setSelectedCards([]);setCardAssignments({});setPendingCard(null);setFocusedCard(null);setSkillPicker(null);"), 'AUTO開始時に手動選択を破棄していません');
assert(has('const usedHandIndexes=new Set(usedCardEntries.map(entry=>entry.handIndex));'), '明示entriesで使用した手札を消費していません');
assert(!has("'mh_auto_battle"), 'AUTO ON/OFFを新しい保存キーへ保存しています');

console.log('OK: AUTOの連続実行・同期ロック・停止条件・手動操作の排他を確認');
