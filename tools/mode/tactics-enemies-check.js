const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスバトル専用の敵(TACTICS_ENEMY_SEQUENCE)を見張る。
//
//   node tools/mode/tactics-enemies-check.js
//
// 【なぜ道具にするか】
// 敵の並びは**クラシック・クイックと共通の1本**だった。タクティクスのために
// そちらを差し替えると、いま遊んでいる人のチャレンジ・プロ・極限の手ごたえが
// 同時に変わってしまう。そこで並びを2本に分けた(2026-09-21)。
// 分けたことが崩れると、
//   ・クラシックの敵がタクティクスの敵に置き換わる(既存の攻略が全部変わる)
//   ・タクティクスだけ敵が出ない・絵が出ない
// のどちらかが静かに起きるので、ここで機械的に押さえる。
//
// 見るのは次の5つ。
//   ① クラシック・クイックの並び(ENEMY_SEQUENCE)が変わっていないこと
//   ② タクティクスの並びが10体で、idがひとつも既存と重ならないこと
//   ③ 強さの総量が既存とそろっていること(難易度の倍率がこの上に乗るため)
//   ④ 絵が実在し、名前・通常攻撃・必殺技が空でないこと
//   ⑤ 敵を作る処理が、モードを見てどちらの並びを使うか決めていること
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const enemySrc = fs.readFileSync(path.join(root, 'monster-hero/data/enemy-monsters.js'), 'utf8');
const imageSrc = fs.readFileSync(path.join(root, 'monster-hero/data/images/images-enemy.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed += 1;
};

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${imageSrc}\n${enemySrc}\nglobalThis.out={ENEMY_DATA,ENEMY_SEQUENCE,TACTICS_ENEMY_DATA,TACTICS_ENEMY_SEQUENCE};`, ctx);
const { ENEMY_DATA, ENEMY_SEQUENCE, TACTICS_ENEMY_DATA, TACTICS_ENEMY_SEQUENCE } = ctx.out;

// ---- ① クラシック・クイックの並びは動かさない ----
// ここを変えるときは、いま遊んでいる人の攻略が全部変わることを承知のうえで直すこと
const CLASSIC = ['Dino', 'Gel', 'BlackDino', 'Jaakusou', 'BlueMountain', 'Gali', 'Naga', 'Lilim', 'Durahan', 'Moo'];
check('クラシック・クイックの敵の並びが変わっていない',
  Array.isArray(ENEMY_SEQUENCE) && ENEMY_SEQUENCE.join(',') === CLASSIC.join(','), (ENEMY_SEQUENCE || []).join(','));

// ---- ② タクティクスの並び ----
check('タクティクスの並びが10体ある',
  Array.isArray(TACTICS_ENEMY_SEQUENCE) && TACTICS_ENEMY_SEQUENCE.length === 10,
  `${(TACTICS_ENEMY_SEQUENCE || []).length}体`);
const overlap = (TACTICS_ENEMY_SEQUENCE || []).filter(id => CLASSIC.includes(id));
check('既存の敵とidがひとつも重ならない', overlap.length === 0, overlap.join(','));
check('並びに書いた敵がすべてデータにある',
  (TACTICS_ENEMY_SEQUENCE || []).every(id => TACTICS_ENEMY_DATA[id]),
  (TACTICS_ENEMY_SEQUENCE || []).filter(id => !TACTICS_ENEMY_DATA[id]).join(','));
check('データに並びへ入れ忘れた敵が残っていない',
  Object.keys(TACTICS_ENEMY_DATA || {}).every(id => (TACTICS_ENEMY_SEQUENCE || []).includes(id)),
  Object.keys(TACTICS_ENEMY_DATA || {}).filter(id => !(TACTICS_ENEMY_SEQUENCE || []).includes(id)).join(','));

// ---- ③ 強さの総量 ----
// 難易度の倍率(Beginner 0.25 〜 Legend 3.0、極限はさらに上)はこの数字の上に乗る。
// 総量が既存から大きく離れると、極限だけ極端に重く/軽くなる
const sum = (seq, table, key) => seq.reduce((total, id) => total + (Number(table[id]?.[key]) || 0), 0);
const classicHp = sum(ENEMY_SEQUENCE, ENEMY_DATA, 'baseHp');
const classicAtk = sum(ENEMY_SEQUENCE, ENEMY_DATA, 'baseAtk');
const tacticsHp = sum(TACTICS_ENEMY_SEQUENCE || [], TACTICS_ENEMY_DATA || {}, 'baseHp');
const tacticsAtk = sum(TACTICS_ENEMY_SEQUENCE || [], TACTICS_ENEMY_DATA || {}, 'baseAtk');
const within = (a, b, rate) => Math.abs(a - b) <= b * rate;
check('合計ライフが既存と±10%に収まる', within(tacticsHp, classicHp, 0.1),
  `タクティクス ${tacticsHp.toLocaleString()} / 既存 ${classicHp.toLocaleString()}`);
check('合計こうげきが既存と±10%に収まる', within(tacticsAtk, classicAtk, 0.1),
  `タクティクス ${tacticsAtk.toLocaleString()} / 既存 ${classicAtk.toLocaleString()}`);
// WAVEが進むほど強くなる(途中で弱くならない)。崩れると難易度の感じ方がおかしくなる。
// ★ライフ単体では見ない。敵には「硬いが一撃は軽い」「柔らかいが一撃が重い」の性格を
//   付けてあり(スプラッターはW8より柔らかくて攻撃が高い)、ライフだけ見ると性格を
//   付けた瞬間に落ちる。手ごたえの目安になる ライフ×こうげき で見る
const weightOf = (table) => (id) => (Number(table[id]?.baseHp) || 0) * (Number(table[id]?.baseAtk) || 0);
const rising = (seq, table, label) => {
  const list = seq.map(weightOf(table));
  check(`${label}: WAVEが進むほど手ごたえが上がる`, list.every((v, i) => i === 0 || v > list[i - 1]),
    seq.map((id, i) => `${i + 1}:${Math.round(list[i] / 1000)}k`).join(' '));
  check(`${label}: 最後のWAVEがいちばん強い(ボス)`, list[list.length - 1] >= list[list.length - 2] * 2,
    `${Math.round(list[list.length - 2] / 1000)}k → ${Math.round(list[list.length - 1] / 1000)}k`);
};
rising(TACTICS_ENEMY_SEQUENCE || [], TACTICS_ENEMY_DATA || {}, 'タクティクス');
// 既存の並びも同じ約束で見る(こちらを崩すと、いま遊んでいる人の手ごたえが変わる)
rising(ENEMY_SEQUENCE, ENEMY_DATA, 'クラシック');

// ---- ④ 中身 ----
for (const id of TACTICS_ENEMY_SEQUENCE || []) {
  const e = TACTICS_ENEMY_DATA[id] || {};
  const file = String(e.imgUrl || '').split('?')[0].replace(/^images\//, '');
  check(`${id}: 名前・技名・絵がそろっている`,
    !!e.name && !!e.normal && !!e.special && !!e.emoji
      && !!file && fs.existsSync(path.join(root, 'monster-hero/images', file)),
    [e.name, e.normal, e.special, file].join(' / '));
}

// ---- ⑤ 敵を作る処理の結線 ----
check('敵を作るときにモードでどちらの並びを使うか決める',
  source.includes("const tacticsEnemies = typeof isTacticsMode === 'function' && isTacticsMode(options && options.mode)")
    && source.includes('const sequence = tacticsEnemies ? TACTICS_ENEMY_SEQUENCE : ENEMY_SEQUENCE;'));
check('実戦の敵生成へモードを渡している',
  source.includes('enemyTurnMultiplier*stagedEnemyMultiplier*tacticsEnemyBoost,{mode:runMode})'));
check('全WAVE詳細へもモードを渡している',
  source.includes('createBattleEnemy(index+1,waveDifficulty,null,powerOverride,1,{mode:battleMode})'));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
