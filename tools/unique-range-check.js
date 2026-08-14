const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'OK' : 'NG'}: ${label}`);
  if (!ok) failed++;
};

const uniqueChunk = source.slice(source.indexOf('const INHERITED_UNIQUE_LEVEL_KEY_PREFIX'), source.indexOf('// 転生では個体'));
const uniqueContext = {
  INITIAL_MASU_LEVEL_CAP:30,
  MAX_UNIQUE_SKILL_LEVEL:8,
  // 切り出した範囲に限界突破の★の定数が含まれるので、外にある値だけ補う
  BREAKTHROUGH_LEVEL_CAP_GAIN:5,
  ALL_PLAYER_MONSTERS: {
    Ham: { unique:{ monId:'Ham', names:['おなら'] } },
    Golem: { unique:{ monId:'Golem', names:['合掌','フライングプレス','竜巻アタック'] } },
    Suezo: { unique:{ monId:'Suezo', names:['サイコキネシス'] } },
  },
};
vm.createContext(uniqueContext);
vm.runInContext(`${uniqueChunk};globalThis.out={uniqueLineageId,normalizeInheritedUniqueLineages,migrateInheritedUniqueLevelIds,resolveInheritedUniqueLevel};`, uniqueContext);
const { uniqueLineageId, normalizeInheritedUniqueLineages, migrateInheritedUniqueLevelIds, resolveInheritedUniqueLevel } = uniqueContext.out;

check('表示名ではなく固有技系統ID(monId/lineageId)を使う',
  uniqueLineageId({name:'合掌',monId:'Golem'}) === 'Golem'
  && uniqueLineageId({name:'竜巻アタック',lineageId:'Golem'}) === 'Golem');

const legacy = [{
  id:'m1', baseId:'Ham', inheritedUniques:[
    {name:'合掌',monId:'Golem',evoLevel:0},
    {name:'サイコキネシス',monId:'Suezo',evoLevel:1},
    {name:'竜巻アタック',monId:'Golem',evoLevel:2},
    {name:'おなら',monId:'Ham',evoLevel:8},
  ],
  uniqueSkillLevels:{own:3,'inh:0':0,'inh:1':1,'inh:2':1,'inh:3':8},
}];
let nextId = 0;
const migrated = migrateInheritedUniqueLevelIds(legacy, () => `range_${++nextId}`).nextMasuMons;
const normalized = normalizeInheritedUniqueLineages(migrated);
check('本来の固有技と同系統の継承を除去する', !normalized[0].inheritedUniques.some(u => u.lineageId === 'Ham'));
const keptGolemIndex = normalized[0].inheritedUniques.findIndex(u => u.lineageId === 'Golem');
check('重複系統は最高固有技Lvの1件だけ残す', keptGolemIndex >= 0
  && normalized[0].inheritedUniques.filter(u => u.lineageId === 'Golem').length === 1
  && resolveInheritedUniqueLevel(normalized[0], normalized[0].inheritedUniques[keptGolemIndex], keptGolemIndex) === 1);
check('重複整理でも旧位置Lvを削除・改名しない', normalized[0].uniqueSkillLevels['inh:0'] === 0 && normalized[0].uniqueSkillLevels['inh:2'] === 1);
check('別系統の固有技を残す', normalized[0].inheritedUniques.some(u => u.lineageId === 'Suezo'));
check('正規化は冪等', JSON.stringify(normalizeInheritedUniqueLineages(normalized)) === JSON.stringify(normalized));
check('今回専用の移行フラグを使う', source.includes("mh_unique_lineage_dedupe_migrated_v1"));
check('合体候補と実行時の両方で系統IDを判定する', (source.match(/ownedUniqueIds = new Set\(\[uniqueLineageId/g) || []).length === 2);

const rangeChunk = source.slice(source.indexOf('const RANGE_LABELS'), source.indexOf('// モンスターごとの間合い'));
const rangeContext = {};
vm.createContext(rangeContext);
vm.runInContext(`${rangeChunk};globalThis.rangeAttackDamageMultiplier=rangeAttackDamageMultiplier;`, rangeContext);
const multiplier = rangeContext.rangeAttackDamageMultiplier;
for (let distance=0; distance<4; distance++) {
  const card = {type:'range_atk',rangeIdx:distance,mult:2};
  check(`${['零','近','中','遠'][distance]}撃は攻撃開始時の指定距離だけ威力アップ`, multiplier(card,distance) === 2 && multiplier(card,(distance+1)%4) === 0.8);
}
// 第6引数は「2枚目以降で効果半減か」。攻撃枚数ではなくカード枚数で数えるようになった(halved)。
// getDmgの引数は後ろへ増えることがある(絶氷の楔の判定を足した等)ので、
// 攻撃開始時距離を渡していることだけを見る
check('距離撃はダメージ計算へ攻撃開始時距離を渡す', /getDmg\(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist[,)]/.test(source));
check('距離撃は指定距離そのものを移動先にする', source.includes("rangeMoveTarget=card.type==='range_atk' && card.rangeIdx!=null ? card.rangeIdx : null"));
check('敵行動後に距離撃の最終距離を再適用する', source.indexOf('await handleEnemyTurn(finalActionType') < source.indexOf('if (forcedMoveTarget!=null) {', source.indexOf('await handleEnemyTurn(finalActionType')));
check('各配置スロット自身の距離撃を取得する', source.includes('const rIdx=idx;') && !source.includes('const rIdx=(idx+RANGE_LABELS.length-1)%RANGE_LABELS.length;'));
check('旧「次の距離」説明が残っていない', !source.includes('次の距離へ移動') && !source.includes('(focusedCard.rangeIdx+1)%4'));

// 距離撃を撃ったターンは最終的な間合いが距離撃側で確定する。敵が移動モーションだけ見せて
// 距離は変わらない、という見た目のズレを無くすため、移動しようとした敵は行動なし扱いにする。
check('距離撃を撃ったターンかどうかを敵の行動処理へ渡す', source.includes('distLocked:forcedMoveTarget!=null'));
check('距離撃のターンは敵の移動を行動なし扱いにする',
  source.includes("if (intent.type==='MOVE' && immediateEffects.distLocked) {")
    && source.includes('距離撃！ 移動できない'));
const lockedBlock = source.slice(source.indexOf("if (intent.type==='MOVE' && immediateEffects.distLocked) {"), source.indexOf("} else if (intent.type==='MOVE') {"));
check('行動なし扱いのときは移動モーションも距離変更もしない',
  !lockedBlock.includes('setEnemyAttackAnim(true)') && !lockedBlock.includes('setEnemyDist(') && !lockedBlock.includes('enemyMove()'));
check('距離撃が無いターンは今までどおり移動する',
  source.includes("} else if (intent.type==='MOVE') {") && source.includes('setEnemyDist(intent.targetDist);'));

if (failed) process.exit(1);
