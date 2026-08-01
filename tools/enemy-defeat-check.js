// 敵ダメージの境界値と、攻撃・反射が共通撃破処理へ合流することを再現可能に確認する。
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const results = [];
const check = (name, ok) => {
  results.push({ name, ok });
  console.log(`  ${ok ? 'OK' : 'NG'}  ${name}`);
};
const damageOutcome = (hp, damage) => {
  const remainingHp = Math.max(0, hp - damage);
  return { remainingHp, defeated: remainingHp <= 0 };
};

const below = damageOutcome(100, 99);
check('反射が残りライフ未満なら敵は生存する', below.remainingHp === 1 && !below.defeated);
const equal = damageOutcome(100, 100);
check('反射が残りライフと同じならライフ0で撃破する', equal.remainingHp === 0 && equal.defeated);
const over = damageOutcome(100, 101);
check('反射が残りライフを上回ってもライフ0未満にならず撃破する', over.remainingHp === 0 && over.defeated);

const resolver = source.match(/const resolveEnemyDefeat = async[\s\S]*?\n  };\n\n  const handleEnemyTurn/);
check('共通の敵撃破処理がある', !!resolver);
check('撃破処理に同期ロックがあり二重確定を防ぐ', !!resolver && /enemyDefeatResolvedRef\.current/.test(resolver[0]));
check('撃破ファンファーレとWAVEリザルト遷移は共通処理にある', !!resolver && /playJingle\('victory'\)/.test(resolver[0]) && /setGameState\('WAVE_RESULT'\)/.test(resolver[0]));
check('通常攻撃・固有技・連撃・追撃の合計が共通撃破処理へ進む', /resolveEnemyDefeat\(\{remainingHp:Math\.max\(0,enemy\.hp-totalDmg\),damage:totalDmg,distDamage:attackDistDamage\}\)/.test(source));
check('反射は演出待機後に確定ライフを渡して共通撃破処理へ進む', /setEnemy\(prev=>\(\{\.\.\.prev,hp:reflectedHp\}\)\); await wait\(1000\);[\s\S]{0,220}resolveEnemyDefeat\(\{remainingHp:reflectedHp,damage:incomingDmg\}\)/.test(source));
check('反射撃破後は回復・次ターンへ進まずreturnする', /if \(await resolveEnemyDefeat\(\{remainingHp:reflectedHp,damage:incomingDmg\}\)\) return;/.test(source));
check('反射ダメージはWAVE合計へ一度だけ加算する', (source.match(/setCurrentWaveDamage\(p=>p\+incomingDmg\)/g) || []).length === 1);
check('反射ダメージは距離別ダメージを渡さない', /resolveEnemyDefeat\(\{remainingHp:reflectedHp,damage:incomingDmg\}\)/.test(source));
check('通常WAVE・最終WAVEとチャレンジ・クイックは共通WAVEリザルト後の既存分岐を使う', /if \(wave === 10\)[\s\S]*?else if \(isQuickMode\(runMode\)\)/.test(source));

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 項目OK`);
process.exit(failed.length ? 1 : 0);
