#!/usr/bin/env node
'use strict';
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
const changelog = fs.readFileSync('monster-hero/data/changelog.js', 'utf8');
const saveSpec = fs.readFileSync('docs/spec/SAVE_DATA.md', 'utf8');
const start = source.indexOf("const AUTO_SETTINGS_KEY = 'mh_auto_settings_v1';");
const end = source.indexOf('// 難易度。', start);
if (start < 0 || end < 0) throw new Error('AUTO設定の正規化定義が見つかりません');
const context = {};
vm.runInNewContext(`${source.slice(start, end)};this.normalizeAutoSettings=normalizeAutoSettings;`, context);
const normalize = value => JSON.parse(JSON.stringify(context.normalizeAutoSettings(value, ['Mocchi','masu:one','masu:two'])));
const expectedDefault = {
  strategy:'random',
  allies:[{rosterEntry:null,slot:null},{rosterEntry:null,slot:null},{rosterEntry:null,slot:null}],
  breakthroughReserve:{gold:0,psyche:0},
  quickRun:{heroRosterEntry:null,distance:null,difficulty:null,autoStart:false},
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(JSON.stringify(normalize(null)) === JSON.stringify(expectedDefault), 'キーなしを既定値へ戻せません');
assert(JSON.stringify(normalize({strategy:'unknown',allies:'broken'})) === JSON.stringify(expectedDefault), '壊れた値を既定値へ戻せません');
const normalized = normalize({strategy:'offense',allies:[{rosterEntry:'masu:one',slot:3},{rosterEntry:'masu:one',slot:1},{rosterEntry:'missing',slot:0}]});
assert(normalized.strategy === 'offense', '有効な方針を保持できません');
assert(normalized.allies[0].rosterEntry === 'masu:one' && normalized.allies[0].slot === 3, 'masu roster entryまたは距離を保持できません');
assert(normalized.allies[1].rosterEntry === null && normalized.allies[2].rosterEntry === null, '重複または候補外のentryを除外できません');
const reserve = normalize({breakthroughReserve:{gold:12345.9,psyche:87.9}});
assert(reserve.breakthroughReserve.gold === 12345 && reserve.breakthroughReserve.psyche === 87, '資源保護を0以上の整数として保持できません');
for (const brokenReserve of [
  {gold:-1,psyche:-1},
  {gold:'x',psyche:NaN},
  {gold:Infinity,psyche:[]},
]) {
  const safe = normalize({breakthroughReserve:brokenReserve});
  assert(safe.breakthroughReserve.gold === 0 && safe.breakthroughReserve.psyche === 0, '壊れた資源保護値を0へ戻せません');
}
// ---- モンヒロビートを開いたら自動で∞周回を始める(2026-09-11・ユーザー指示) ----
// 既定はOFF。項目を持たない既存ユーザーが、ある日いきなり裏でバトルを始められては困る
assert(normalize({quickRun:{autoStart:true}}).quickRun.autoStart === true, '自動開始のONを保持できません');
for (const broken of ['true', 1, {}, [], null, undefined, 'ON']) {
  assert(normalize({quickRun:{autoStart:broken}}).quickRun.autoStart === false,
    `壊れた自動開始の値(${String(broken)})をOFFへ倒せません`);
}
// 3つそろっていなければ、スイッチがONでも始めない(始めようがないため)
const autoStartStart = source.indexOf('const autoQuickRunConfigured =');
const autoStartEnd = source.indexOf('// AUTOの1ターンぶん', autoStartStart);
if (autoStartStart < 0 || autoStartEnd < 0) throw new Error('自動開始の判定が見つかりません');
const autoStartContext = { Number };
vm.runInNewContext(`${source.slice(autoStartStart, autoStartEnd)};this.autoQuickRunAutoStartEnabled=autoQuickRunAutoStartEnabled;`, autoStartContext);
const autoStartEnabled = autoStartContext.autoQuickRunAutoStartEnabled;
const configuredQuick = { heroRosterEntry:'masu:one', distance:2, difficulty:'Normal' };
assert(autoStartEnabled({quickRun:{...configuredQuick, autoStart:true}}) === true, '3つそろってONのときに自動開始を認めません');
assert(autoStartEnabled({quickRun:{...configuredQuick, autoStart:false}}) === false, 'OFFなのに自動開始してしまいます');
assert(autoStartEnabled({quickRun:{...configuredQuick, difficulty:null, autoStart:true}}) === false,
  '事前設定が欠けているのに自動開始してしまいます');
assert(autoStartEnabled(null) === false && autoStartEnabled({}) === false, '設定が無くても自動開始してしまいます');
// 画面のスイッチ。3つそろうまでは押せない
assert(source.includes('data-auto-quick-run-autostart'), 'AUTO設定に自動開始のスイッチがありません');
assert(source.includes('disabled={!autoQuickRunConfigured(draftAutoSettings)}'), '事前設定が欠けているのにスイッチを押せます');
assert(source.includes('updateDraftAutoQuickRun({autoStart:'), 'スイッチをAUTO設定の下書きへ接続していません');
// 始めるのは「モンヒロビートへ入った瞬間」だけ。曲えらびにいるあいだ何度も試さない
const autoStartEffect = source.slice(source.indexOf('const rhythmAutoStartInsideRef'), source.indexOf('const cycleBattleAuto'));
assert(autoStartEffect.length > 0, '自動開始の処理が見つかりません');
assert(autoStartEffect.includes('if (!inside || wasInside) return;'), '「入った瞬間だけ」の判定がありません');
assert(autoStartEffect.includes('autoQuickRunAutoStartEnabled(autoSettings)'), 'スイッチを見ずに自動開始しています');
assert(autoStartEffect.includes('quickRunProgressRef.current && !quickRunProgressRef.current.finished'),
  'すでに回っている周回の上へ重ねて始める可能性があります');
assert(autoStartEffect.includes('runStageRef.current && !runResultFinishedRef.current'),
  '勝負のついていない挑戦の上へ新しいランを重ねる可能性があります');
assert(autoStartEffect.includes('repeatTemplateFromAutoSettings()'), '編成を作れないときに見送る判定がありません');
assert(source.includes("const RHYTHM_AUTO_START_SCREENS = [...RHYTHM_BACKGROUND_RUN_SCREENS,'RHYTHM_PLAY','RHYTHM_OPTIONS']"),
  '「モンヒロビートの中」の一覧が、演奏・オプションを含んでいません');
assert(help.includes('モンヒロビートを開いたときに自動で'), 'ヘルプに自動開始の説明がありません');
assert(changelog.includes('モンヒロビートを開いたら自動でクイックの∞周回を始められるようにしました'), '更新履歴に自動開始がありません');
assert(saveSpec.includes('autoStart'), 'SAVE_DATAに自動開始の保存項目がありません');

const saveSettingsStart = source.indexOf('const saveAutoSettings = async () => {');
const saveSettingsEnd = source.indexOf('const autoRosterLabel =', saveSettingsStart);
const saveSettings = source.slice(saveSettingsStart, saveSettingsEnd);
assert(saveSettings.includes('saveStoredValuesOrRollback([') && saveSettings.includes('{ key:AUTO_SETTINGS_KEY, before:autoSettings, next:normalized }'), '決定時のAUTO設定保存が読み戻し検証つきではありません');
assert(saveSettings.includes('if (!saved)') && saveSettings.indexOf('if (!saved)') < saveSettings.indexOf("setGameState('MB_MANAGEMENT')"), 'AUTO設定保存失敗時に画面を閉じる可能性があります');
assert(saveSettings.includes('AUTO設定を保存できませんでした'), 'AUTO設定保存失敗時の案内がありません');
assert(source.includes("const [autoBreakthroughBulkValue, setAutoBreakthroughBulkValue] = useState('follow')"), '自動限凸一括設定の一時stateがありません');
assert(source.includes("setAutoBreakthroughBulkValue('follow')"), 'AUTO設定を開くたび一括候補を安全な初期値へ戻していません');
const bulkStart = source.indexOf('const applyAutoBreakthroughBulk = async () => {');
const bulkEnd = source.indexOf('const saveAutoSettings = async () => {', bulkStart);
const bulk = source.slice(bulkStart, bulkEnd);
assert(bulk.includes("window.confirm(`所有マスモン${currentMons.length}体"), '一括変更前の確認がありません');
assert(bulk.includes("saveStoredValuesOrRollback([") && bulk.includes("{ key:'mh_masu_mons', before:currentMons, next }"), '一括設定を読み戻し検証つきで既存mh_masu_monsへ保存していません');
assert(bulk.includes('if (!saved)') && bulk.indexOf('if (!saved)') < bulk.indexOf('masuMonsRef.current = next'), '一括保存失敗時にstateへ進む可能性があります');
assert(bulk.includes('masuMonsRef.current = next') && bulk.includes('setMasuMons(next)'), '一括保存成功後に最新個体ref/stateを同期していません');
assert(!bulk.includes('AUTO_SETTINGS_KEY'), '一括設定をAUTO設定へ永続化して新規個体へ自動適用する形になっています');
assert(source.includes('data-auto-breakthrough-bulk-settings'), 'AUTO設定画面に自動限凸セクションがありません');
assert(source.includes('全員 ブリーダーLvに自動追従') && source.includes('全員OFF') && source.includes('全員 Lv{level}まで固定'), '一括設定の3モードがそろっていません');
assert(source.includes('今後新しく入手するマスモンは自動ではONになりません'), '新規個体には自動適用しない説明がありません');
assert(source.includes('id="auto-breakthrough-reserve-gold"') && source.includes('id="auto-breakthrough-reserve-psyche"'), '残高保護の数値入力がありません');
assert(source.includes('残すダイヤを1000減らす') && source.includes('残すダイヤを1000増やす'), 'ダイヤの±操作がありません');
assert(source.includes('残す虹のプシュケーを10減らす') && source.includes('残す虹のプシュケーを10増やす'), '虹のプシュケーの±操作がありません');
assert(source.includes('updateDraftAutoBreakthroughReserve'), '残高保護をAUTO設定の下書きへ接続していません');
assert(help.includes("title:'AUTO∞の自動限界突破'"), 'ヘルプにAUTO∞自動限界突破の説明がありません');
assert(help.includes('ブリーダーLvに自動追従') && help.includes('残すダイヤ') && help.includes('残す虹のプシュケー'), 'ヘルプに追従・残高保護の説明が不足しています');
assert(changelog.includes('AUTO∞の自動限界突破をまとめて設定できるようにしました'), '更新履歴にAUTO∞自動限凸改善がありません');
assert(saveSpec.includes('autoRepeatBreakthroughMode') && saveSpec.includes('breakthroughReserve'), 'SAVE_DATAに自動限凸の保存項目がありません');
assert(source.includes("k.startsWith('mh_')"), 'mh_キーのバックアップ処理が見つかりません');
assert(source.includes('onClick={()=>setAutoAllyDetail({ mon, masu })}'), '選択済み供モンの詳細導線が見つかりません');
assert(source.includes('autoAllyDetail&&renderMonsterDetailModal({mon:autoAllyDetail.mon,masu:autoAllyDetail.masu'), '共通モンスター詳細UIの再利用が見つかりません');
assert(source.includes("readOnly:true,label:`${autoAllyDetail.mon.name}の確認用詳細`"), 'AUTO設定の詳細が読み取り専用ではありません');
assert(source.includes('if (!entry) return null;'), '未指定の簡易情報・詳細導線を隠す処理が見つかりません');
const helperStart = source.indexOf('const joinRosterEntry =');
const helperEnd = source.indexOf('// そのレベルから次レベルに必要なXP', helperStart);
const helperContext = { Math:Object.create(Math) };
vm.runInNewContext(`${source.slice(helperStart, helperEnd)};this.chooseAutoAllyJoin=chooseAutoAllyJoin;this.joinRosterEntry=joinRosterEntry;`, helperContext);
const base = {id:'Mocchi'};
const masuOne = {id:'Mocchi',masuId:'one'};
const masuTwo = {id:'Mocchi',masuId:'two'};
assert(helperContext.joinRosterEntry(masuOne) === 'masu:one', 'マスモンの安定IDにmasuIdを使っていません');
let choice = helperContext.chooseAutoAllyJoin({pool:[base,masuOne,masuTwo],activeMons:[masuTwo],heroId:'Hero',setting:{rosterEntry:'masu:one',slot:3},slots:[{},null,null,null]},()=>0);
assert(choice.mon === masuOne && choice.slotIdx === 3, '設定したマスモン個体または空き希望距離を選べません');
choice = helperContext.chooseAutoAllyJoin({pool:[masuOne,masuTwo],activeMons:[masuOne],heroId:'Hero',setting:{rosterEntry:'masu:one',slot:0},slots:[{},null,null,null]},()=>0);
assert(choice.mon === masuTwo && choice.slotIdx === 1, '加入済み個体・使用中距離から合法候補へフォールバックできません');
choice = helperContext.chooseAutoAllyJoin({pool:[base],activeMons:[],heroId:'Hero',setting:{rosterEntry:null,slot:null},slots:[null,{},null,{}]},()=>0);
assert(choice.mon === base && choice.slotIdx === 0, '未設定時に合法候補と空き距離を自動選択できません');
assert(helperContext.chooseAutoAllyJoin({pool:[],activeMons:[],heroId:'Hero',setting:{},slots:[null,null,null,null]},()=>0) === null, '候補0体を安全に終了できません');
assert(source.includes('setupMon(choice.mon,choice.slotIdx);'), 'AUTO加入が決定したmonとslotをsetupMonへ直接渡していません');
assert(source.includes("const settingIndex=[2,4,6].indexOf(wave);"), 'WAVE2・4・6と設定①・②・③の対応がありません');
console.log('OK: AUTO設定・個体識別・供モン自動加入・配置フォールバックを確認');
