// 反射(モノリスの勇者特性・固有技「トリオビームX」の障壁)で、
// 敵のライフが増えてしまわないことを確認する。
//
//   node tools/reflect-enemy-hp-check.js
//
// 【背景・実際に出した不具合】
// 反射は敵のライフを「絶対値」で書き戻す(setEnemy(prev=>({...prev,hp:reflectedHp})))。
// その計算に使っていた enemy.hp は、processTurn のクロージャが持つ
// 「ターンが始まった時点」の値で、同じターンにこちらが与えたダメージが入っていない。
// そのため反射が出ると、そのターンに削ったぶんがまるごと元へ戻り、
// 敵が回復したように見えていた(残り200まで削った敵が4900へ戻る、など)。
//
// 味方のライフは hpAtAttackStart として呼び出し側から渡していたので、
// 敵のライフも同じ形(enemyHpAtAttackStart)で渡すようにした。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- 結線 ----
check('敵のライフも呼び出し側から受け取る',
  has('const handleEnemyTurn = async (lastActionType, immediateEffects={}, overrideIntent=null, hpAtAttackStart=hp, enemyHpAtAttackStart=enemy?.hp??0) => {'));
check('反射は渡された最新のライフから引く(ターン開始時の値を使わない)',
  has('const reflectedHp=Math.max(0,enemyHpAtAttackStart-incomingDmg);'));
// ★ここが戻ると不具合も戻る
const enemyTurnFn = slice('const handleEnemyTurn = async (lastActionType', '  const useEmergency = async () => {');
check('敵の行動中に、古い enemy.hp を読んでいる箇所が無い',
  !/enemy\.hp/.test(enemyTurnFn), (enemyTurnFn.match(/.{0,40}enemy\.hp.{0,40}/g) || []).join(' 、 '));
check('このターンに削ったぶんを1か所で出して使い回す(撃破判定と敵の行動でずれない)',
  has('const enemyHpAfterOurAttacks=Math.max(0,(enemy?.hp??0)-totalDmg);')
    && has('resolveEnemyDefeat({remainingHp:enemyHpAfterOurAttacks,damage:totalDmg,distDamage:attackDistDamage})')
    && has('executedIntent,hpBeforeEnemyAttack,enemyHpAfterOurAttacks);'));
// 何もしなかったターン(緊急回復)は、こちらのダメージが無いので既定値のままでよい
check('緊急回復から敵が動くときは既定値のまま(こちらの与ダメが無いため)',
  has("await handleEnemyTurn('none',{},acting,hpAfterRecovery);"));
// こちらの攻撃は関数型更新のまま(絶対値で書き戻すと同じ不具合が起きる)
check('こちらの攻撃は関数型更新でライフを減らす',
  (source.match(/setEnemy\(prev=>\(\{\.\.\.prev,hp:Math\.max\(0,prev\.hp-/g) || []).length === 2);

// ---- 実際に動かして、敵が回復しないことを確かめる ----
// Reactのstateと同じ振る舞い(クロージャのenemyは更新されない)を再現する
const simulate = ({ turnStartHp, playerDmg, reflectDmg }) => {
  let stored = { hp: turnStartHp };
  const setEnemy = (v) => { stored = (typeof v === 'function') ? v(stored) : v; };
  const enemy = { hp: turnStartHp }; // クロージャが持つターン開始時の値(更新されない)

  // ① こちらの攻撃
  setEnemy(prev => ({ ...prev, hp: Math.max(0, prev.hp - playerDmg) }));
  const afterOurAttacks = stored.hp;

  // ② 本体と同じ受け渡し
  const enemyHpAfterOurAttacks = Math.max(0, (enemy?.hp ?? 0) - playerDmg);
  // ③ 敵の攻撃 → 反射(本体と同じ式)
  const reflectedHp = Math.max(0, enemyHpAfterOurAttacks - reflectDmg);
  setEnemy(prev => ({ ...prev, hp: reflectedHp }));
  return { afterOurAttacks, afterReflect: stored.hp };
};

const CASES = [
  { label: '削ったあとに反射', turnStartHp: 5000, playerDmg: 1200, reflectDmg: 300, want: 3500 },
  { label: 'あと少しで倒せる場面', turnStartHp: 5000, playerDmg: 4800, reflectDmg: 100, want: 100 },
  { label: '攻撃せずガードだけ', turnStartHp: 5000, playerDmg: 0, reflectDmg: 300, want: 4700 },
  { label: '反射で倒しきる', turnStartHp: 1000, playerDmg: 900, reflectDmg: 500, want: 0 },
  { label: '大ダメージを与えた直後', turnStartHp: 99999, playerDmg: 50000, reflectDmg: 1, want: 49998 },
];
for (const c of CASES) {
  const r = simulate(c);
  check(`${c.label}: 反射で敵のライフが増えない`, r.afterReflect <= r.afterOurAttacks,
    `攻撃後 ${r.afterOurAttacks} → 反射後 ${r.afterReflect}`);
  check(`${c.label}: 反射後のライフが正しい(${c.want})`, r.afterReflect === c.want, String(r.afterReflect));
}
// ライフが0を下回らない
check('反射でライフが0を下回らない', simulate({ turnStartHp: 100, playerDmg: 90, reflectDmg: 9999 }).afterReflect === 0);

// ---- 更新履歴 ----
const changelogSrc = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
check('更新履歴に書いてある', changelogSrc.includes('反射') && changelogSrc.includes('ライフが回復'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
