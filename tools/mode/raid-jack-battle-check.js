// ジャック戦の「戦闘データ」を確かめる(35-raid-jack.jsx の定義と、敵データ・技の表の食い違いを防ぐ)。
// 正本: docs/spec/RAID_BOSS_JACK.md。実装の段階が進むたびに、ここへ見るものを足す。
//
// 見るもの(Nodeで本物のデータと式を動かす)
//   ① 敵データ Jack の技名が RAID_JACK_SKILL_NAMES と同じ(二重管理の食い違い防止)。絵が実在する
//   ② Jack は TACTICS_ENEMY_SEQUENCE に入っていない(通常ランは10体固定)
//   ③ 使う技の本数が段階ごとに 3/4/5/5/5、再生なし、落とす順は 攻撃力アップ → うしろから
//   ④ 敵のライフ・攻撃が、段階の倍率で決まった値(RAID_JACK_*_TIERS の hp / atk)と一致する
//   ⑤ ほかの敵の技の本数が変わっていない(回帰)
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const dataCtx = { Object, Number, Math, Array, JSON, String, Boolean, Date, isNaN };
vm.createContext(dataCtx);
vm.runInContext(`${read('monster-hero/data/images/images-enemy.js')}\n${read('monster-hero/data/enemy-monsters.js')}\n${read('monster-hero/src/parts/35-raid-jack.jsx')}\n`
  + 'globalThis.out={TACTICS_ENEMY_DATA,TACTICS_ENEMY_SEQUENCE,JACK_IMG,JACK_POSE_IMG,JACK_ICON_IMG,RAID_JACK_A_TIERS,RAID_JACK_B_TIERS,RAID_JACK_SKILL_NAMES,RAID_JACK_ACTION_IDS};', dataCtx);
const o = dataCtx.out;

const entriesSrc = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const chunk = entriesSrc.slice(entriesSrc.indexOf('const TACTICS_BASE_ACTION_IDS'), entriesSrc.indexOf('// 直前の行動から、次に選べる行動を決めるための状態を作る'));
const defsSrc = read('monster-hero/src/game-system.jsx');
const defChunk = defsSrc.slice(defsSrc.indexOf('const ENEMY_ACTION_DEFINITIONS'), defsSrc.indexOf('const TACTICS_BASE_ACTION_IDS'));
const ctx = { RANGE_LABELS: ['零', '近', '中', '遠'], Math, Number, Object, Array, Set };
vm.createContext(ctx);
vm.runInContext(`${defChunk}\n${chunk}\nglobalThis.api={TACTICS_ENEMY_ACTION_IDS,tacticsEnemyActionIds,tacticsActionDefinitions,enemyActionDefinitionsFor};`, ctx);
const api = ctx.api;

// ① データ
const jack = o.TACTICS_ENEMY_DATA.Jack;
check('敵データ Jack がある', !!jack);
const n = o.RAID_JACK_SKILL_NAMES;
check('通常攻撃・必殺技の名前が定義と同じ', jack.normal === n.normal && jack.special === n.special);
check('追加技の名前が定義と同じ', ['sweep', 'rush', 'pierce', 'roar', 'allout'].every((k) => jack.actions[k] === n[k]), JSON.stringify(jack.actions));
check('再生の名前を持たない', !('regen' in jack.actions));
const fileOf = (u) => path.join(ROOT, 'monster-hero', String(u).split('?')[0]);
check('立ち絵(通常・ポーズ)と顔アイコンの絵が実在する', [o.JACK_IMG, o.JACK_POSE_IMG, o.JACK_ICON_IMG].every((u) => fs.existsSync(fileOf(u))));
check('Jack の絵は敵データが指している', jack.imgUrl === o.JACK_IMG && jack.poseImgUrl === o.JACK_POSE_IMG);

// ② 通常ランに混ざらない
check('Jack は TACTICS_ENEMY_SEQUENCE に入っていない', !o.TACTICS_ENEMY_SEQUENCE.includes('Jack') && o.TACTICS_ENEMY_SEQUENCE.length === 10);

// ③ 技の本数
check('技の並びは定義と同じ(再生なし)', api.TACTICS_ENEMY_ACTION_IDS.Jack.join() === o.RAID_JACK_ACTION_IDS.join() && !api.TACTICS_ENEMY_ACTION_IDS.Jack.includes('regen'));
const counts = [...o.RAID_JACK_A_TIERS, ...o.RAID_JACK_B_TIERS];
counts.forEach((t) => {
  const ids = api.tacticsEnemyActionIds('Jack', 'Normal', t.actionCount);
  check(`${t.name}: 技は ${t.actionCount} 本`, ids.length === t.actionCount, ids.join(','));
});
check('3本は 連撃・間合い・貫通(攻撃力アップと全体攻撃を落とす)', api.tacticsEnemyActionIds('Jack', 'Normal', 3).join() === 'rush,sweep,pierce');
check('4本は 攻撃力アップだけ落とす', api.tacticsEnemyActionIds('Jack', 'Normal', 4).join() === 'rush,sweep,pierce,allout');
check('5本は全部', api.tacticsEnemyActionIds('Jack', 'Normal', 5).join() === 'rush,sweep,roar,pierce,allout');
check('どんな難易度を渡しても actionCount が優先', ['Beginner', 'Legend', 'EXTREME'].every((d) => api.tacticsEnemyActionIds('Jack', d, 4).length === 4));
check('actionCount が無ければ今までどおり(難易度の増減)', api.tacticsEnemyActionIds('Jack', 'Normal').length === 5);
check('貫通撃を持つ段階は構え(pierceCharge)も持つ',
  api.tacticsActionDefinitions('Jack', 'Normal', 3).some((d) => d.id === 'pierceCharge') && api.tacticsActionDefinitions('Jack', 'Normal', 3).some((d) => d.id === 'pierce'));
check('行動表の入口(enemyActionDefinitionsFor)でも本数が反映される(新タクティクス)',
  (() => { const prev = ctx.isTacticsMode; ctx.isTacticsMode = () => true; vm.runInContext('globalThis.isTacticsMode = () => true', ctx);
    const defs = api.enemyActionDefinitionsFor('raid', 'Jack', 'Normal', 3); return defs.filter((d) => ['rush', 'sweep', 'roar', 'pierce', 'allout'].includes(d.id)).length === 3; })());

// ④ ライフ・攻撃
const enemySrc = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const ceStart = enemySrc.indexOf('const createBattleEnemy');
const ceChunk = enemySrc.slice(ceStart, enemySrc.indexOf('const collectBondRankingEntries'));
const ceCtx = { Math, Number, Object, isTacticsMode: () => true, TACTICS_ENEMY_SEQUENCE: o.TACTICS_ENEMY_SEQUENCE, TACTICS_ENEMY_DATA: o.TACTICS_ENEMY_DATA, ENEMY_SEQUENCE: [], ENEMY_DATA: {},
  normalizeBattleDifficulty: (d) => d || 'Normal', QUICK_DIFFICULTY_SETTINGS: { Normal: { power: 1 } } };
vm.createContext(ceCtx);
vm.runInContext(`${ceChunk}\nglobalThis.createBattleEnemy=createBattleEnemy;`, ceCtx);
counts.forEach((t) => {
  const e = ceCtx.createBattleEnemy(1, 'Normal', 'Jack', t.power, 1, { mode: 'raid', actionCount: t.actionCount });
  check(`${t.name}: ライフ ${t.hp.toLocaleString()} / 攻撃 ${t.atk.toLocaleString()}`, e.maxHp === t.hp && e.hp === t.hp && e.atk === t.atk && e.actionCount === t.actionCount && e.id === 'Jack', `hp=${e.hp} atk=${e.atk}`);
});
const plain = ceCtx.createBattleEnemy(1, 'Normal', 'Dokudoku', 1, 1, { mode: 'tactics' });
check('ほかの敵には actionCount が付かない(回帰)', !('actionCount' in plain));

// ⑤ 回帰
const expectBase = { Kawazumo: 1, Metalner: 1, Inari: 2, Koinobori: 2, Delpiero: 2, Dokudoku: 3, Lamia: 2, Nyarlathotep: 3, Splatter: 4, AwakenedMoo: 6 };
check('ほかの敵の技の本数は変わっていない', Object.entries(expectBase).every(([k, v]) => api.tacticsEnemyActionIds(k, 'Normal').length === v));
check('ドクドクは難易度でこれまでどおり増える(Legend=+3)', api.tacticsEnemyActionIds('Dokudoku', 'Legend').length === 6);

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');
