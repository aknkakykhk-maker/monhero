#!/usr/bin/env node
'use strict';
// マスモンの「固有技設定」(並び順・初期技)を確かめる。
//
//   node tools/masu/unique-setting-check.js
//
// 【なぜ道具にするか】
// この機能は「保存した順番が、あとから増えた技や消えた技で壊れないか」「並び替えても
// 固有技Lvが入れ替わらないか」が要で、どれも画面を見ただけでは分からない。
// しかも壊れ方が「気づいたら別の技がLv8になっている」という取り返しのつかない形になる。
// 本体から正規化・並び替え・バトル側のキー解決をそのまま切り出して、1つずつ確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'docs/spec/MONSTER_SYSTEM.md'), 'utf8');
const saveSpec = fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from), j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// --- 本体の実装をそのまま動かす(式を書き写さない) ---
const sandbox = { console, Math, Map, Set, Number, Array, Object, String };
vm.createContext(sandbox);
vm.runInContext([
  "const INHERITED_UNIQUE_LEVEL_KEY_PREFIX = 'inhId:';",
  slice('const inheritedUniqueLevelKey = (unique) =>', 'const isValidInheritedUnique'),
  slice('const OWN_UNIQUE_KEY =', '// 構造ベースの冪等移行'),
  `globalThis.api = { OWN_UNIQUE_KEY, uniqueSettingKeyOf, isStableUniqueSettingKey, defaultUniqueSettingKeys,
    normalizeUniqueOrder, normalizeInitialUniqueKey, buildUniqueSettingUpdate, buildUniqueSettingReset,
    battleUniqueKeyFromSettingKey, activeSlotUniqueKey, sortUniqueOptionsByMasuOrder, moveUniqueOrderKey };`,
].join('\n'), sandbox);
const A = sandbox.api;

// 自前1つ + 継承2つを持つ個体。継承技はそれぞれ別のLvを持たせて、入れ替わりを見つけられるようにする
const inhA = { name:'エーの技', inheritedUniqueId:'iu_a', monId:'Zan', sourceMasuName:'エー' };
const inhB = { name:'ビーの技', inheritedUniqueId:'iu_b', monId:'Pixy', sourceMasuName:'ビー' };
const keyA = `inhId:iu_a`, keyB = `inhId:iu_b`;
const makeMasu = (extra = {}) => ({
  id:'m1', name:'テスト', baseId:'Mocchi',
  inheritedUniques:[inhA, inhB],
  uniqueSkillLevels:{ own:3, [keyA]:5, [keyB]:8 },
  uniqueSkillPoints:2,
  ...extra,
});

// ---------- ① 旧セーブ互換(設定が無い個体は従来どおり) ----------
const legacy = makeMasu();
check('設定が無ければ従来順(自前が先頭)', JSON.stringify(A.normalizeUniqueOrder(legacy)) === JSON.stringify(['own', keyA, keyB]));
check('初期技の設定が無ければ自前の固有技', A.normalizeInitialUniqueKey(legacy) === 'own');
check('継承技を持たない個体でも落ちない',
  JSON.stringify(A.normalizeUniqueOrder({ id:'m0' })) === JSON.stringify(['own'])
  && A.normalizeInitialUniqueKey({ id:'m0' }) === 'own');
check('保存値が壊れていても従来順へ落とす',
  JSON.stringify(A.normalizeUniqueOrder(makeMasu({ uniqueOrder:'こわれた' }))) === JSON.stringify(['own', keyA, keyB])
  && JSON.stringify(A.normalizeUniqueOrder(makeMasu({ uniqueOrder:[null, 7, {}] }))) === JSON.stringify(['own', keyA, keyB]));

// ---------- ② 並び替え ----------
const moved = A.buildUniqueSettingUpdate(legacy, { order:A.moveUniqueOrderKey(A.normalizeUniqueOrder(legacy), keyB, -1), initialKey:'own' });
check('「↑」で1つ上へ動く', JSON.stringify(moved.uniqueOrder) === JSON.stringify(['own', keyB, keyA]));
check('先頭より上・末尾より下へは動かない',
  JSON.stringify(A.moveUniqueOrderKey(['own', keyA, keyB], 'own', -1)) === JSON.stringify(['own', keyA, keyB])
  && JSON.stringify(A.moveUniqueOrderKey(['own', keyA, keyB], keyB, 1)) === JSON.stringify(['own', keyA, keyB]));
check('保存し直しても並びが残る（再読み込み相当）',
  JSON.stringify(A.normalizeUniqueOrder(JSON.parse(JSON.stringify(moved)))) === JSON.stringify(['own', keyB, keyA]));
// 並び替えで固有技Lvが動かないこと。Lvの正本は inhId:<id> なので、順番を変えても対応は変わらない
check('並び替えても各技の固有技Lvが入れ替わらない',
  moved.uniqueSkillLevels.own === 3 && moved.uniqueSkillLevels[keyA] === 5 && moved.uniqueSkillLevels[keyB] === 8);
check('並び替えで固有技P・継承技の中身を変えない',
  moved.uniqueSkillPoints === 2 && JSON.stringify(moved.inheritedUniques) === JSON.stringify([inhA, inhB]));
check('保存するのは安定キーだけ（配列位置の仮キーを残さない）',
  moved.uniqueOrder.every(A.isStableUniqueSettingKey)
  && !moved.uniqueOrder.some(key => /^inh:\d+$/.test(key)));

// ---------- ③ 初期技 ----------
const initB = A.buildUniqueSettingUpdate(legacy, { order:A.normalizeUniqueOrder(legacy), initialKey:keyB });
check('初期技を継承技へ変えられる', A.normalizeInitialUniqueKey(initB) === keyB);
check('初期技の変更で固有技Lvを変えない',
  initB.uniqueSkillLevels.own === 3 && initB.uniqueSkillLevels[keyA] === 5 && initB.uniqueSkillLevels[keyB] === 8);
check('無効な初期技IDは自前へフォールバック',
  A.normalizeInitialUniqueKey(makeMasu({ initialUniqueKey:'inhId:iu_消えた' })) === 'own'
  && A.normalizeInitialUniqueKey(makeMasu({ initialUniqueKey:123 })) === 'own'
  && A.normalizeInitialUniqueKey(makeMasu({ initialUniqueKey:'' })) === 'own');

// ---------- ④ 技が増えた・消えたとき ----------
const inhC = { name:'シーの技', inheritedUniqueId:'iu_c', monId:'Golem' };
const keyC = 'inhId:iu_c';
const added = { ...moved, inheritedUniques:[inhA, inhB, inhC] };
check('新しく増えた技は既存の設定を壊さず末尾へ足される',
  JSON.stringify(A.normalizeUniqueOrder(added)) === JSON.stringify(['own', keyB, keyA, keyC]));
const removed = { ...moved, inheritedUniques:[inhA], uniqueSkillLevels:{ own:3, [keyA]:5 } };
check('保存された順番に無くなった技は無視される',
  JSON.stringify(A.normalizeUniqueOrder(removed)) === JSON.stringify(['own', keyA]));
check('消えた技が初期技だったら自前へ戻る',
  A.normalizeInitialUniqueKey({ ...removed, initialUniqueKey:keyB }) === 'own');
check('同じ技が二重に保存されていても1つだけ使う',
  JSON.stringify(A.normalizeUniqueOrder(makeMasu({ uniqueOrder:[keyB, keyB, 'own'] }))) === JSON.stringify([keyB, 'own', keyA]));

// ---------- ⑤ 初期状態に戻す ----------
const reset = A.buildUniqueSettingReset(initB);
check('「初期状態に戻す」で自前が先頭・自前が初期技',
  JSON.stringify(reset.uniqueOrder) === JSON.stringify(['own', keyA, keyB]) && reset.initialUniqueKey === 'own');
check('「初期状態に戻す」で固有技Lv・固有技Pをリセットしない',
  reset.uniqueSkillLevels.own === 3 && reset.uniqueSkillLevels[keyA] === 5
  && reset.uniqueSkillLevels[keyB] === 8 && reset.uniqueSkillPoints === 2);

// ---------- ⑥ バトルへの反映 ----------
// バトル側のキー(inh0/inh1)は inheritedUniques の配列位置のまま。並び替えても位置は動かさない
const mon = { inheritedUniques:[inhA, inhB], uniqueOrder:['own', keyB, keyA], initialUniqueKey:keyB };
check('初期技の安定キーがバトルの選択キーへ変換される', A.battleUniqueKeyFromSettingKey(mon, keyB) === 'inh1');
check('自前・未設定は従来どおり own',
  A.battleUniqueKeyFromSettingKey(mon, 'own') === 'own'
  && A.battleUniqueKeyFromSettingKey(mon, null) === 'own'
  && A.battleUniqueKeyFromSettingKey(mon, 'inhId:iu_消えた') === 'own');
check('ラン中に切り替えていなければ初期技が選ばれる', A.activeSlotUniqueKey({}, 0, mon) === 'inh1');
check('ラン中に切り替えたらその選択が優先される', A.activeSlotUniqueKey({ 0:'own' }, 0, mon) === 'own');
check('設定が無い既存マスモンは従来どおり own から始まる',
  A.activeSlotUniqueKey({}, 0, { inheritedUniques:[inhA, inhB] }) === 'own');
// 候補の並びだけを設定順にする。キーと配列位置(inhIdx)は動かさない
const options = [
  { key:'own', settingKey:'own', unique:{ name:'自前' } },
  { key:'inh0', inhIdx:0, settingKey:keyA, unique:{ name:'エー' } },
  { key:'inh1', inhIdx:1, settingKey:keyB, unique:{ name:'ビー' } },
];
const sorted = A.sortUniqueOptionsByMasuOrder(options, ['own', keyB, keyA]);
check('バトルの切替候補が設定順に並ぶ', sorted.map(o=>o.key).join(',') === 'own,inh1,inh0');
check('並べ替えても各候補のキー・配列位置は変わらない',
  sorted.every(option => options.some(src => src.key === option.key && src.inhIdx === option.inhIdx && src.settingKey === option.settingKey)));
check('並び順に無い候補も消えず末尾へ残る',
  A.sortUniqueOptionsByMasuOrder(options, ['own']).map(o=>o.key).join(',') === 'own,inh0,inh1');
check('並び順が無ければ候補はそのままの並び',
  A.sortUniqueOptionsByMasuOrder(options, null).map(o=>o.key).join(',') === 'own,inh0,inh1');

// --- 実装の配線を見る ---
const merge = slice('const mergeMasuIntoMon = (masu) => {', '// ==================== 総合力');
const avail = slice('const getAvailableUniquesForSlot = (mon, cUniques, slotIdx, cInhEvo) => {', 'const MAX_GUARD_CARD_COUNT');
const saver = slice('const updateMasuUniqueSetting = (masuId, mutate) => {', 'const useUniqueSkillResetTicket');

check('設定はマスモンを戦闘用へ変換するところで解決される（勇者モンでも供モンでも同じ経路）',
  merge.includes('uniqueOrder: normalizeUniqueOrder(masu)') && merge.includes('initialUniqueKey: normalizeInitialUniqueKey(masu)'));
check('バトルの候補生成が設定順を通る', avail.includes('sortUniqueOptionsByMasuOrder(') && avail.includes('mon.uniqueOrder'));
check('候補のキーは配列位置のまま（固有技Lvとの対応を崩さない）',
  avail.includes('key:`inh${ii}`') && avail.includes('inhIdx:ii'));
check('スロットの選択キー解決が1か所に統一されている',
  !/slotUniqueChoice\[[^\]]+\]\s*\|\|\s*'own'/.test(source)
  && !/\(uChoice&&uChoice\[idx\]\)\|\|'own'/.test(source)
  && (source.match(/activeSlotUniqueKey\(/g) || []).length >= 6);
check('保存は既存の mh_masu_mons へ書く', saver.includes("storeSet('mh_masu_mons', next, false)"));
check('新しい mh_* 保存キーを増やしていない',
  !/['"]mh_[^'"]*(?:unique_order|initial_unique|unique_setting)/i.test(source));
check('起動時に既存個体を一括で書き換えていない',
  !/normalizeUniqueOrder\(/.test(slice('const inheritedUniqueIdMigration = migrateInheritedUniqueLevelIds', 'setMasuMons')));
check('固有技Lv・固有技Pの計算には触っていない',
  !/uniqueSkillLevels\s*:/.test(slice('const buildUniqueSettingUpdate =', 'const battleUniqueKeyFromSettingKey'))
  && !/uniqueSkillPoints/.test(slice('const buildUniqueSettingReset =', 'const battleUniqueKeyFromSettingKey')));

// --- 画面 ---
const sheet = slice('{uniqueSettingMasuId!=null&&(()=>{', '{/* マスモン強化: 専用ページ');
check('マスモン詳細に固有技設定の導線がある', source.includes('data-unique-setting-open'));
check('技ごとに 現在名・Lv・初期技表示・初期技に設定・並び替え がある',
  sheet.includes('data-unique-setting-row') && sheet.includes('uniqueSkillAtLevel(choice.unique, choice.level)')
  && sheet.includes('Lv.{choice.level}') && sheet.includes('data-unique-setting-initial-badge')
  && sheet.includes('data-unique-setting-initial') && sheet.includes('data-unique-setting-up') && sheet.includes('data-unique-setting-down'));
check('並び替えはドラッグに頼らずタップできる（↑↓ボタン）',
  sheet.includes('>↑</button>') && sheet.includes('>↓</button>') && !/onDragStart|draggable/.test(sheet));
check('スマホで押せる大きさ（44px以上）を確保している',
  (sheet.match(/min-h-\[4[4-9]px\]|min-h-\[[5-9]\dpx\]/g) || []).length >= 4);
check('「初期状態に戻す」がある', sheet.includes('data-unique-setting-reset') && sheet.includes('初期状態に戻す'));
check('固有技Lvを変えないと画面にも書いてある', sheet.includes('固有技Lvと固有技Pは変わりません'));

// --- 案内 ---
check('ヘルプに固有技設定の説明がある', help.includes('固有技設定'));
check('更新履歴に固有技設定の追加が載っている', changelog.includes('固有技設定'));
check('仕様書へ書いてある', spec.includes('固有技設定') && saveSpec.includes('initialUniqueKey') && saveSpec.includes('uniqueOrder'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
