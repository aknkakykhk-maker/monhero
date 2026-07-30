const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (label, ok) => {
  console.log(`${ok ? 'OK' : 'NG'}: ${label}`);
  if (!ok) failed++;
};

const uniqueChunk = source.slice(source.indexOf('const uniqueSkillAtLevel'), source.indexOf('// 転生では個体'));
const uniqueContext = {
  INITIAL_MASU_LEVEL_CAP:30,
  ALL_PLAYER_MONSTERS: {
    Ham: { unique:{ monId:'Ham', names:['おなら'] } },
    Golem: { unique:{ monId:'Golem', names:['合掌','フライングプレス','竜巻アタック'] } },
    Suezo: { unique:{ monId:'Suezo', names:['サイコキネシス'] } },
  },
};
vm.createContext(uniqueContext);
vm.runInContext(`${uniqueChunk};globalThis.out={uniqueLineageId,normalizeInheritedUniqueLineages};`, uniqueContext);
const { uniqueLineageId, normalizeInheritedUniqueLineages } = uniqueContext.out;

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
const normalized = normalizeInheritedUniqueLineages(legacy);
check('本来の固有技と同系統の継承を除去する', !normalized[0].inheritedUniques.some(u => u.lineageId === 'Ham'));
check('重複系統は最高固有技Lvの1件だけ残す', normalized[0].inheritedUniques.filter(u => u.lineageId === 'Golem').length === 1 && normalized[0].uniqueSkillLevels['inh:0'] === 2);
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
check('距離撃はダメージ計算へ攻撃開始時距離を渡す', source.includes('getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,attackCount>0,attackStartDist)'));
check('距離撃は指定距離そのものを移動先にする', source.includes("rangeMoveTarget=card.type==='range_atk' && card.rangeIdx!=null ? card.rangeIdx : null"));
check('敵行動後に距離撃の最終距離を再適用する', source.indexOf('await handleEnemyTurn(finalActionType') < source.indexOf('if (forcedMoveTarget!=null) {', source.indexOf('await handleEnemyTurn(finalActionType')));
check('各配置スロット自身の距離撃を取得する', source.includes('const rIdx=idx;') && !source.includes('const rIdx=(idx+RANGE_LABELS.length-1)%RANGE_LABELS.length;'));
check('旧「次の距離」説明が残っていない', !source.includes('次の距離へ移動') && !source.includes('(focusedCard.rangeIdx+1)%4'));

if (failed) process.exit(1);
