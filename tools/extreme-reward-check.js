// 極限チャレンジ(EXTREME)の数値を、本番の定義をNode上で動かして確かめる。
//
//   ① 敵のライフ・攻撃がノーマル比×13
//   ② 通常難易度(Beginner〜Legend)・クイック・プロの敵性能に回帰がない
//      (powerOverride を渡さないときは今までどおり難易度の倍率が使われる)
//   ③ スコア×20・経験値×25・ダイヤ×7.5・虹のプシュケー75
//   ④ 解放条件(Grand Master / Hell / Legend のどれかを1回以上クリア)
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (a, b) => source.slice(source.indexOf(a), source.indexOf(b));

// --- 本番の定義をそのまま動かす ---
const ctx = {
  // createBattleEnemy が参照する敵データ。ノーマル比を測るため素の値を100にしてある
  ENEMY_DATA: { Test: { id:'Test', name:'テスト', baseHp:100, baseAtk:100, emoji:'❓' } },
  ENEMY_SEQUENCE: Array.from({ length: 10 }, () => 'Test'),
  console,
};
vm.createContext(ctx);
vm.runInContext([
  grab('const DIFFICULTY_SETTINGS', 'const CLEAR_PSYCHE_REWARD'),
  grab('const createBattleEnemy', 'const collectBondRankingEntries'),
  'globalThis.__m={DIFFICULTY_SETTINGS,EXTREME_DIFFICULTIES,EXTREME_SETTING,extremeSpecialRule,'
  + 'EXTREME_UNLOCK_DIFFICULTIES,isExtremeUnlocked,NIGHTMARE_SETTING,isNightmareUnlocked,normalizeBattleDifficulty,createBattleEnemy};',
].join('\n'), ctx);
const m = ctx.__m;

// --- ① EXTREMEの敵は×13 ---
const extremeEnemy = m.createBattleEnemy(1, 'Normal', null, m.EXTREME_SETTING.power);
check('EXTREMEの敵ライフはノーマル比×13', extremeEnemy.hp === 1300, `${extremeEnemy.hp}`);
check('EXTREMEの敵攻撃はノーマル比×13', extremeEnemy.atk === 1300, `${extremeEnemy.atk}`);

// --- ② 通常難易度に回帰がない ---
// powerOverride を渡さない(null / undefined)ときは、必ず難易度の倍率が使われること。
// 以前 powerOverride=null が0扱いされ、通常バトルの敵が全部0になる不具合があった
let regressed = [];
for (const [key, setting] of Object.entries(m.DIFFICULTY_SETTINGS)) {
  for (const override of [null, undefined]) {
    const enemy = m.createBattleEnemy(1, key, null, override);
    const wantHp = Math.floor(100 * setting.power);
    const wantAtk = Math.floor(100 * setting.power);
    if (enemy.hp !== wantHp || enemy.atk !== wantAtk) regressed.push(`${key}(${String(override)}) hp=${enemy.hp}/${wantHp} atk=${enemy.atk}/${wantAtk}`);
  }
}
check('通常難易度の敵性能に回帰がない(powerOverrideなし=難易度どおり)', regressed.length === 0, regressed.join(' / '));
check('ノーマルの敵は等倍のまま', m.createBattleEnemy(1, 'Normal').hp === 100);
check('Legendの敵は×10のまま', m.createBattleEnemy(1, 'Legend').hp === 1000);
// クイック・プロもモードで敵倍率を変えない(呼び出し側は同じ createBattleEnemy を通る)
check('クイック・プロも難易度どおりの敵倍率', m.createBattleEnemy(1, 'Hard').hp === Math.floor(100 * m.DIFFICULTY_SETTINGS.Hard.power));
check('0を渡したときだけ0倍になる(nullと取り違えない)', m.createBattleEnemy(1, 'Normal', null, 0).hp === 0);

// --- ③ 報酬倍率 ---
check('スコア×20', m.EXTREME_SETTING.score === 20);
check('経験値×25', m.EXTREME_SETTING.xp === 25);
check('ダイヤ×7.5', m.EXTREME_SETTING.gold === 7.5);
check('虹のプシュケー75個', m.EXTREME_SETTING.psyche === 75);
check('ブリーダーカード効果50%はEXTREME固有ルール',
  m.extremeSpecialRule('EXTREME', 'breederCardEffect') === 0.5
    && m.extremeSpecialRule('NIGHTMARE', 'breederCardEffect') === 1);
check('NIGHTMAREは×15 / ×20 / ×30 / ×10 / 虹100を持つ',
  m.NIGHTMARE_SETTING.available === false
    && m.NIGHTMARE_SETTING.power === 15 && m.NIGHTMARE_SETTING.score === 20
    && m.NIGHTMARE_SETTING.xp === 30 && m.NIGHTMARE_SETTING.gold === 10
    && m.NIGHTMARE_SETTING.psyche === 100);
check('NIGHTMAREより後の難易度は未実装のまま数値を持たない',
  m.EXTREME_DIFFICULTIES.slice(2).every(s => s.available === false && s.power === undefined && s.score === undefined));
check('NIGHTMAREはEXTREMEを1回以上クリア済みなら解放判定',
  m.isNightmareUnlocked(1) === true && m.isNightmareUnlocked('2') === true);
check('NIGHTMAREはEXTREME未クリアなら未解放判定',
  m.isNightmareUnlocked(0) === false && m.isNightmareUnlocked(undefined) === false);
check('難易度の並びは EXTREME → NIGHTMARE → CHAOS → ULTIMATE → INFINITY',
  m.EXTREME_DIFFICULTIES.map(s => s.id).join(',') === 'EXTREME,NIGHTMARE,CHAOS,ULTIMATE,INFINITY');

// --- ④ 解放条件 ---
check('Grand Masterを1回クリアで解放', m.isExtremeUnlocked({ GrandMaster: 1 }) === true);
check('Hellを1回クリアで解放', m.isExtremeUnlocked({ Hell: 1 }) === true);
check('Legendを1回クリアで解放', m.isExtremeUnlocked({ Legend: 1 }) === true);
check('Master以下だけならロック', m.isExtremeUnlocked({ Beginner: 9, Easy: 9, Normal: 9, Hard: 9, Expert: 9, Master: 9 }) === false);
check('記録が無い(旧セーブ・新規)ならロック', m.isExtremeUnlocked({}) === false && m.isExtremeUnlocked(undefined) === false);
check('壊れた値でも落ちずロック扱い', m.isExtremeUnlocked({ GrandMaster: null, Hell: 'x', Legend: NaN }) === false);
check('文字列で保存されていても解放できる', m.isExtremeUnlocked({ Legend: '2' }) === true);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
