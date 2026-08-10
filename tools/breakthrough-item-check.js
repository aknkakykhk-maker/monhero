// 限界突破専用アイテム「虹のプシュケー」を確認する。
//
// このアイテムは所持数がそのまま限界突破の可否になるので、
//   ・必要数の式がずれる
//   ・失敗やキャンセルでも減る／成功しても減らない
//   ・クリアしていないのに配られる／同じクリアで二重に配られる
// のどれが起きても、例外にはならず「いつの間にか数が合わない」形で表面化する。
// 数の出入りを1つずつ機械的に確かめる。
const fs = require('fs');
const path = require('path');

const { REPO_ROOT, loadDyeModule } = require('./harness');
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/game-system.compiled.js'), 'utf8')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const {
  BREAKTHROUGH_ITEM_ID, BREAKTHROUGH_ITEM_BASE, BREAKTHROUGH_ITEM_STEP,
  breakthroughItemCost, ownedItemCount, CLEAR_PSYCHE_REWARD, clearPsycheReward,
  DIFFICULTY_SETTINGS, BREEDER_MARKET_ITEMS,
  buildMasuBreakthrough, totalBondXpForLevel,
  INITIAL_MASU_LEVEL_CAP, MAX_MASU_LEVEL_CAP, BREAKTHROUGH_MAX_COUNT, FINAL_BREAKTHROUGH_COUNT,
} = loadDyeModule();

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== 1. アイテムの定義 =====
const item = BREEDER_MARKET_ITEMS.find(i => i.id === BREAKTHROUGH_ITEM_ID);
check('虹のプシュケーがアイテムとして定義されている', !!item && item.name === '虹のプシュケー', item ? item.name : 'なし');
check('他の消耗アイテムと同じ type:item', item.type === 'item');
check('マーケットでは売らない(shop:false)', item.shop === false);
check('限界突破で使うアイテムだと分かる印がある', item.usage === 'breakthrough');
check('説明に必要数の増え方が書いてある', /5個/.test(item.desc) && /1個ずつ/.test(item.desc));

// ===== 2. 必要数 =====
check('1回目は5個', breakthroughItemCost(1) === 5, String(breakthroughItemCost(1)));
check('2回目は6個', breakthroughItemCost(2) === 6, String(breakthroughItemCost(2)));
check('3回目は7個', breakthroughItemCost(3) === 7, String(breakthroughItemCost(3)));
check('4回目は8個', breakthroughItemCost(4) === 8, String(breakthroughItemCost(4)));
check('5回目は9個', breakthroughItemCost(5) === 9, String(breakthroughItemCost(5)));
let formulaOk = true, formulaNg = '';
for (let n = 1; n <= 40; n++) {
  const want = BREAKTHROUGH_ITEM_BASE + (n - 1) * BREAKTHROUGH_ITEM_STEP;
  if (breakthroughItemCost(n) !== want) { formulaOk = false; formulaNg = `${n}回目=${breakthroughItemCost(n)}(期待${want})`; break; }
}
check('n回目 = 5 +(n-1)×1', formulaOk, formulaNg);
check('30回目は34個', breakthroughItemCost(BREAKTHROUGH_MAX_COUNT) === 34, String(breakthroughItemCost(BREAKTHROUGH_MAX_COUNT)));
check('最終限界突破(31回目)は35個', breakthroughItemCost(FINAL_BREAKTHROUGH_COUNT) === 35, String(breakthroughItemCost(FINAL_BREAKTHROUGH_COUNT)));
check('おかしな回数でも落ちない',
  breakthroughItemCost(0) === 5 && breakthroughItemCost(-5) === 5 && breakthroughItemCost(null) === 5 && breakthroughItemCost('あ') === 5);

// ===== 3. 旧セーブ互換(所持数0として読める) =====
check('所持データが無ければ0個', ownedItemCount(undefined, BREAKTHROUGH_ITEM_ID) === 0 && ownedItemCount(null, BREAKTHROUGH_ITEM_ID) === 0);
check('旧セーブ(他のアイテムだけ)でも0個', ownedItemCount({ dye_mock: 3, training_ticket: 10 }, BREAKTHROUGH_ITEM_ID) === 0);
check('壊れた値でも0個へ倒す',
  ownedItemCount({ [BREAKTHROUGH_ITEM_ID]: 'あ' }, BREAKTHROUGH_ITEM_ID) === 0
  && ownedItemCount({ [BREAKTHROUGH_ITEM_ID]: -5 }, BREAKTHROUGH_ITEM_ID) === 0
  && ownedItemCount({ [BREAKTHROUGH_ITEM_ID]: 4.7 }, BREAKTHROUGH_ITEM_ID) === 4);
check('新しい保存キーを作っていない',
  !/mh_psyche|mh_rainbow|mh_breakthrough_item/.test(source) && source.includes("'mh_owned_items'"));

// ===== 4. 所持数と限界突破の可否 =====
const makeMasu = (levelCap, rebirthCount) => ({
  id: 'x', baseId: 'Golem', name: 'テスト',
  bondXp: totalBondXpForLevel(levelCap), levelCap, rebirthCount, reincarnateCount: 0,
  statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptPoints: 0,
  uniqueSkillLevels: { own: 0 }, inheritedUniques: [], fusionHistory: [],
});
const build = (masu, psycheOwned) => buildMasuBreakthrough({ masu, skillKey: 'own', gold: 9_999_999, psycheOwned });
const first = makeMasu(INITIAL_MASU_LEVEL_CAP, 0);
check('必要数ちょうどなら突破できる', build(first, 5).ok === true);
check('1個足りないと突破できない', build(first, 4).ok === false, build(first, 4).reason);
check('0個でも落ちずに断る', build(first, 0).ok === false && build(first, undefined).ok === false);
check('足りないときは必要数と所持数を伝える', /必要 5/.test(build(first, 4).reason) && /所持 4/.test(build(first, 4).reason));
check('足りないときも必要数を返す', build(first, 0).psycheCost === 5);
check('成功したら必要数ぶんだけ減った数を返す', build(first, 42).nextPsyche === 37, String(build(first, 42).nextPsyche));
check('多く持っていても余分に減らさない', build(first, 1000).nextPsyche === 995);
// 回数が進むと必要数も増える
const tenth = makeMasu(INITIAL_MASU_LEVEL_CAP + 5 * 9, 9);
check('10回目は14個必要', build(tenth, 14).ok === true && build(tenth, 13).ok === false && build(tenth, 14).psycheCost === 14);
// 30凸→最終限界突破
const thirtieth = makeMasu(180, 30);
check('最終限界突破は35個必要', build(thirtieth, 35).ok === true && build(thirtieth, 34).ok === false,
  `35個=${build(thirtieth, 35).ok} / 34個=${build(thirtieth, 34).ok}`);
check('最終限界突破でもLv.200・最終扱いは変わらない',
  build(thirtieth, 35).nextMasu.levelCap === MAX_MASU_LEVEL_CAP && build(thirtieth, 35).finalBreakthrough === true);
// 他の条件で弾かれるときは、アイテムを持っていても突破できない(誤って消費させない)
check('レベルが上限に届いていなければ突破できない',
  build({ ...first, bondXp: 0 }, 999).ok === false);
check('上限Lv.200なら何個持っていても突破できない', build(makeMasu(200, 31), 999).ok === false);
check('ダイヤが足りなければ突破できない',
  buildMasuBreakthrough({ masu: first, skillKey: 'own', gold: 0, psycheOwned: 999 }).ok === false);

// 30回＋最終1回を通しでまわして、合計消費数が式どおりか
let masu = makeMasu(INITIAL_MASU_LEVEL_CAP, 0);
let stock = 100000, spent = 0, steps = 0, costs = [];
while (steps < 40) {
  const r = build(masu, stock);
  if (!r.ok) break;
  costs.push([masu.rebirthCount + 1, r.psycheCost]);
  spent += r.psycheCost;
  stock = r.nextPsyche;
  masu = { ...r.nextMasu, bondXp: totalBondXpForLevel(r.nextMasu.levelCap), uniqueSkillLevels: { own: 0 } };
  steps++;
}
const costAt = (n) => (costs.find(c => c[0] === n) || [])[1];
check('通しでまわしても各回の必要数が式どおり', costAt(1) === 5 && costAt(30) === 34 && costAt(31) === 35,
  `1回目=${costAt(1)} 30回目=${costAt(30)} 31回目=${costAt(31)}`);
check('31回で打ち止め', steps === 31, `${steps}回`);
check('31回ぶんの合計は620個', spent === 620, String(spent));

// ===== 5. クリア報酬 =====
const want = { Beginner: 1, Easy: 2, Normal: 3, Hard: 5, Expert: 7, Master: 10, GrandMaster: 15, Hell: 20, Legend: 25 };
for (const [diff, n] of Object.entries(want)) {
  check(`${DIFFICULTY_SETTINGS[diff].label}のクリア報酬は${n}個`, clearPsycheReward(diff) === n, String(clearPsycheReward(diff)));
}
check('難易度の並びが実データと一致している',
  Object.keys(CLEAR_PSYCHE_REWARD).join(',') === Object.keys(DIFFICULTY_SETTINGS).join(','),
  `報酬=${Object.keys(CLEAR_PSYCHE_REWARD).join(',')} / 難易度=${Object.keys(DIFFICULTY_SETTINGS).join(',')}`);
check('全難易度に報酬が決まっている', Object.keys(DIFFICULTY_SETTINGS).every(d => clearPsycheReward(d) > 0));
check('知らない難易度が来てもNormal扱いで落ちない', clearPsycheReward('NoSuchDifficulty') === 3 && clearPsycheReward(null) === 3);

// ===== 6. 配る場所・消費する場所 =====
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  // 配るのはクリアを記録する1か所だけ(チャレンジ・クイック共通)
  check(`${label}: 配るのはクリア記録の1か所だけ`,
    (code.match(/awardClearPsyche\(\)/g) || []).length === 1
    && (code.match(/const awardClearPsyche = /g) || []).length === 1);
  const clearFrom = code.indexOf('const recordClearOnce');
  const clearEnd = code.indexOf('useEffect(', clearFrom);
  const clearBody = clearFrom > 0 ? code.slice(clearFrom, clearEnd > clearFrom ? clearEnd : clearFrom + 2500) : '';
  check(`${label}: クリアの二重記録を止める鍵より後で配る`,
    /clearRecordedRef\.current = true;[\s\S]{0,400}awardClearPsyche\(\)/.test(clearBody));
  check(`${label}: チャレンジ・クイックの分岐より前で配る`,
    clearBody.indexOf('awardClearPsyche()') < clearBody.indexOf('isQuickMode(runMode)'),
    `配る=${clearBody.indexOf('awardClearPsyche()')} / 分岐=${clearBody.indexOf('isQuickMode(runMode)')}`);
  // 敗北・リタイア・スキップチケットの経路では配らない
  const giveUpFrom = code.indexOf('const handleGiveUp');
  const giveUpBody = giveUpFrom > 0 ? code.slice(giveUpFrom, code.indexOf('const handleRetry', giveUpFrom)) : '';
  check(`${label}: リタイアでは配らない`, giveUpBody.length > 0 && !/awardClearPsyche|recordClearOnce/.test(giveUpBody));
  const skipFrom = code.indexOf('const executeBattleSkip');
  const skipBody = skipFrom > 0 ? code.slice(skipFrom, skipFrom + 3000) : '';
  check(`${label}: スキップチケットでは配らない`, skipBody.length > 0 && !/awardClearPsyche|recordClearOnce/.test(skipBody));
  // 報酬を配る awardRunRewards は敗北・リタイアでも走るので、そこには入れない
  const awardFrom = code.indexOf('const awardRunRewards');
  const awardBody = awardFrom > 0 ? code.slice(awardFrom, code.indexOf('const SKIP_WAVES', awardFrom)) : '';
  check(`${label}: 敗北でも走る報酬付与には入れない`, awardBody.length > 0 && !/awardClearPsyche|rainbow_psyche|BREAKTHROUGH_ITEM_ID/.test(awardBody));

  // 消費するのは限界突破が成立したときだけ
  const execFrom = code.indexOf('const executeMasuBreakthrough');
  const execBody = execFrom > 0 ? code.slice(execFrom, code.indexOf('const executeMasuReincarnation', execFrom) > execFrom ? code.indexOf('const executeMasuReincarnation', execFrom) : execFrom + 2500) : '';
  check(`${label}: 限界突破の実行が所持数を渡す`, /psycheOwned:\s*ownedItemCount\(ownedItemsRef\.current, BREAKTHROUGH_ITEM_ID\)/.test(execBody));
  check(`${label}: 失敗したら何も減らさない`,
    execBody.indexOf('if (!result.ok)') < execBody.indexOf('BREAKTHROUGH_ITEM_ID]: result.nextPsyche'));
  check(`${label}: 減らすのは成立後の1回だけ`,
    (execBody.match(/\[BREAKTHROUGH_ITEM_ID\]: result\.nextPsyche/g) || []).length === 1
    && /storeSet\('mh_owned_items', nextItems, false\)/.test(execBody));

  // 画面表示
  check(`${label}: 限界突破の確認画面に必要数と所持数を出す`,
    code.includes('必要な虹のプシュケー') && code.includes('虹のプシュケーが足りません'));
  check(`${label}: 限界突破の一覧に所持数を出す`, /虹のプシュケー[\s\S]{0,200}所持 /.test(code));
  // 配信用JSでは演算子まわりに空白が入るので、空白をまたいで見る
  check(`${label}: 足りないときは限界突破のボタンを押せない`,
    /disabled[=:]\s*\{?\s*rebirthSkillKey\s*===?\s*null\s*\|\|\s*gold\s*<\s*cost\s*\|\|\s*ownedItemCount\(ownedItems,\s*BREAKTHROUGH_ITEM_ID\)\s*<\s*breakthroughItemCost/.test(code));
  check(`${label}: リザルトに獲得数を出す`, /summary\.psycheGain > 0/.test(code) && code.includes('虹のプシュケー'));
  check(`${label}: マーケットには並べない`, (code.match(/item\.shop !== false|item\.shop!==false/g) || []).length === 2);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
