#!/usr/bin/env node
// シールドが割れたあとの連撃必殺技(INFERNO系のデュラハン・ムー)の「受けるダメージの予測」が、実際の受け方と同じかを見る(2026-11-11 バトルの監査)。
//
// 実際にあった食い違い: 実処理(handleEnemyTurn)は、割れた枚数で必殺技が連撃になり(extremeLayerRushHits)、
// そのターンのガードが1枚なら1発ぶんだけ、2枚以上で全部を止める(resolveTacticsGuardedHit)。
// 予測(plannedHitFor)の既存5モードの側は連撃を知らず、いつも「1発をガードの合計で受ける」で出していた。
// 合計3000・3連撃・ガード1200(1枚)だと、予測は 1800、実際は 2000(1発ぶんは全部止まり、残り2発が通る)。
// ガードが1発ぶんより厚いと、予測は「全部止まる」、実際は残りの発がそのまま通る。
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`  ${ok ? 'OK' : 'NG'}  ${label}${note ? ` — ${note}` : ''}`); };

// ---- 予測と実処理が、同じ回数・同じ枚数の決まりを読んでいるか ----
const planHead = source.indexOf('    let hits = enemyIntent.variant === \'rush\'');
const planTail = source.indexOf('    const hit = resolveTacticsGuardedHit(raw, hits, guard, guardHits);', planHead);
check('予測(plannedHitFor)の受け方の部分を切り出せる', planHead >= 0 && planTail > planHead);
const plan = planHead >= 0 && planTail > planHead ? source.slice(planHead, planTail) : '';
check('予測は割れた枚数から連撃の回数を読む(extremeLayerRushHits)', /const layerRushHits = enemyIntent\.type === 'SPECIAL' \? extremeLayerRushHits\(infernoShellRule, wave, infernoShellView\?\.broken\) : 1;/.test(plan));
check('予測は、ガードの枚数が決まりの数以上のときだけ全部の発を受け止める', /if \(layerRushHits > 1\) \{ hits = layerRushHits; guardHits = guardCards >= TACTICS_RUSH_GUARD_CARDS \? hits : 1; \}/.test(plan));
check('予測のガードの枚数は、ガードの厚さを足すカードと同じものを数える', /if \(!\(w > 0\)\) return;\s+guardCards \+= 1;/.test(plan));
check('実処理は同じ回数の関数を読む', /const rushHits=intent\.type==='SPECIAL'\?extremeLayerRushHits\(specialRuleDifficultyForRun\(runMode,difficulty,extremeRunRef\.current,extremeDifficulty\),wave,enemyLiveRef\.current\?\.shellBroken\):1;/.test(source));
check('実処理は同じ枚数の決まりで受ける', source.includes('const rushGuard=rushHits>1?resolveTacticsGuardedHit(incomingBeforeTurnReduction,rushHits,guardValue,guardCards>=TACTICS_RUSH_GUARD_CARDS?rushHits:1):null;'));
check('実処理のガードの枚数も、厚さを足すたびに1枚', /const addGuardForSlot=\(idx,flat,mult,weight\)=>\{[\s\S]{0,300}?entry\.cards\+=1;/.test(source));

// ---- 本体の受け方の関数で検算 ----
const head = source.indexOf('const TACTICS_RUSH_GUARD_CARDS = ');
const tail = source.indexOf('// ===== 「2枚目以降は効果半減」の数え方 =====', head);
check('受け方の関数を切り出せる', head >= 0 && tail > head);
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
const safeIntSrc = source.match(/const tacticsSafeInt = [\s\S]*?\n(?=const |\/\/)/);
check('数の丸めの関数を切り出せる', !!safeIntSrc);
const { resolve, CARDS } = Function(`${safeIntSrc ? safeIntSrc[0] : ''}\n${source.slice(head, tail)}\nreturn { resolve: resolveTacticsGuardedHit, CARDS: TACTICS_RUSH_GUARD_CARDS };`)();
// 実処理: 連撃なら rushGuard、連撃でなければ ガード − 受ける量
const actualTaken = (raw, rushHits, guard, cards) => {
  if (!(guard > 0)) return raw;
  if (rushHits > 1) return resolve(raw, rushHits, guard, cards >= CARDS ? rushHits : 1).taken;
  return Math.max(0, raw - guard);
};
// 予測(直したあと)と、直す前(いつも1発扱い)
const plannedTaken = (raw, rushHits, guard, cards) => { let hits = 1, guardHits = 1; if (rushHits > 1) { hits = rushHits; guardHits = cards >= CARDS ? hits : 1; } return resolve(raw, hits, guard, guardHits).taken; };
const oldPlanned = (raw, rushHits, guard) => resolve(raw, 1, guard, 1).taken;
check('合計3000・3連撃・ガード1200(1枚): 実際は2000', actualTaken(3000, 3, 1200, 1) === 2000, `実際 ${actualTaken(3000, 3, 1200, 1)}`);
check('同じ場面で、直す前の予測は1800(実際より少なく見えていた)', oldPlanned(3000, 3, 1200) === 1800, `直す前 ${oldPlanned(3000, 3, 1200)}`);
check('合計3000・3連撃・ガード3500(1枚): 直す前は「全部止まる」、実際は2000通る', oldPlanned(3000, 3, 3500) === 0 && actualTaken(3000, 3, 3500, 1) === 2000);
let all = true, cases = 0;
for (const raw of [1, 99, 100, 2999, 3000, 3001, 12345]) for (const rushHits of [1, 2, 3, 4, 5]) for (const guard of [0, 1, 500, 1000, 1200, 3500, 20000]) for (const cards of [0, 1, 2, 3]) {
  if (guard > 0 && cards === 0) continue; if (guard === 0 && cards > 0) continue;
  cases++;
  if (plannedTaken(raw, rushHits, guard, cards) !== actualTaken(raw, rushHits, guard, cards)) { all = false; if (failed < 3) console.log('   食い違い', { raw, rushHits, guard, cards, plan: plannedTaken(raw, rushHits, guard, cards), act: actualTaken(raw, rushHits, guard, cards) }); }
}
check(`受ける量7×連撃1〜5×ガード7×枚数の ${cases} 通りで、予測＝実際(使ったターンの軽減を掛ける前)`, all);
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
