#!/usr/bin/env node
// バトルの監査(2026-11-11 社長「説明どおりに直す」)で直した計算が、元に戻っていないかを見る。
//
// 直したもの(どれも実際にあった食い違い):
//  1. 反射で敵を倒したターン、そのターンにカードで与えたダメージがWAVEのスコア・総ダメージ・距離強化から抜けていた
//  2. タクティクスの全体攻撃で、1体が吸収を引くと全員が無傷になっていた
//  3. このターンの被ダメ軽減(えるびんの見守り・大樹の加護系)が、カードの順番で上書きされて消えていた。予測にも入っていなかった
//  4. 時間停止のターンに「生命の源」のガッツ回復が2回入っていた
//  5. タクティクスで、回避・不発でもポルツが減っていた(monster/poltz-assist-check.js も見る)
//  6. 中二病の回数が、当たらなかった攻撃でも減っていた
//  7. 連撃を全部受け止めても、端数の1〜2点が通って余りの回復が消えていた
//  8. あつの挑発だけ、距離撃のあとも動かす前の距離で計算していた。二刀流のくり返しと会心率アップも入っていなかった
//  9. 氷海の支配者のガッツ回復が、距離撃で動かす前の距離で判定されていた
// 10. 山札の混ぜ方にかたよりがあった
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`  ${ok ? 'OK' : 'NG'}  ${label}${note ? ` — ${note}` : ''}`); };
const cut = (headText, tailText) => { const h = source.indexOf(headText); const t = h >= 0 ? source.indexOf(tailText, h) : -1; return h >= 0 && t > h ? source.slice(h, t) : ''; };

// ---------- 1. 撃破のときの合計 ----------
console.log('1. 反射で倒したターンの数え漏れ');
const defeatSrc = cut('const waveDamageAtDefeat = ', '// 贖罪の追撃');
check('撃破のときの合計を出す関数を切り出せる', !!defeatSrc);
if (defeatSrc) {
  const { waveDamageAtDefeat, waveDistDamageAtDefeat } = Function(`${defeatSrc}\nreturn { waveDamageAtDefeat, waveDistDamageAtDefeat };`)();
  // ターンの始め1000。カードで700与え、反射300でとどめ → いまの値は2000
  check('カード700＋反射300でとどめ: 合計は2000(直す前の数え方は1300)', waveDamageAtDefeat(2000, 1000, 300) === 2000 && 1000 + 300 === 1300);
  check('カードでとどめ(足し済み): 今までと同じ', waveDamageAtDefeat(1700, 1000, 700) === 1700);
  check('いまの値が読めないときは、前の数え方を下回らない', waveDamageAtDefeat(undefined, 1000, 300) === 1300 && waveDamageAtDefeat(NaN, 1000, 300) === 1300 && waveDamageAtDefeat(5, 1000, 300) === 1300);
  const d = waveDistDamageAtDefeat([700, 0, 50, 0], [0, 0, 50, 0], [0, 0, 0, 0]);
  check('距離ごとのダメージも、反射で倒したターンのカードのぶんを含む', JSON.stringify(d) === JSON.stringify([700, 0, 50, 0]), JSON.stringify(d));
  check('距離ごと: カードでとどめは今までと同じ', JSON.stringify(waveDistDamageAtDefeat([700, 0, 50, 0], [0, 0, 50, 0], [700, 0, 0, 0])) === JSON.stringify([700, 0, 50, 0]));
}
const resolver = (source.match(/const resolveEnemyDefeat = async[\s\S]*?\n  \};\n/) || [''])[0];
check('撃破処理は「いまの値」から合計を読む', resolver.includes('const totalWaveDamage=waveDamageAtDefeat(currentWaveDamageRef.current,currentWaveDamage,damage);')
  && resolver.includes('const finalDistDamage=waveDistDamageAtDefeat(waveDistDamageRef.current,waveDistDamage,distDamage);'));
check('「いまの値」は描くたびに state へ合わせる', source.includes('currentWaveDamageRef.current = currentWaveDamage;') && source.includes('waveDistDamageRef.current = waveDistDamage;'));
const adds = (source.match(/setCurrentWaveDamage\(p\s*=>\s*p\s*\+\s*([\w.]+)\);[^\n]*/g) || []);
check(`ダメージを足す所は全部、「いまの値」にも同じ量を足す(${adds.length}か所)`, adds.length >= 4 && adds.every(line => { const v = line.match(/p\s*\+\s*([\w.]+)\)/)[1]; return line.includes(`addCurrentWaveDamageLive(${v});`); }), adds.filter(l => !/addCurrentWaveDamageLive/.test(l)).join(' / ').slice(0, 200));
check('距離ごとのダメージを足す所も、「いまの値」に足す', /setWaveDistDamage\(prev=>\{[^\n]*\n\s*waveDistDamageRef\.current=\[0,1,2,3\]\.map\(k=>\(Number\(waveDistDamageRef\.current\?\.\[k\]\)\|\|0\)\+turnDistDmg\[k\]\);/.test(source));

// ---------- 2・5・6. 敵の番 ----------
console.log('2. 吸収 / 5. ポルツ / 6. 中二病');
const enemyTurn = cut('const handleEnemyTurn = async', '  const processTurn = async');
check('敵の番の処理を切り出せる', !!enemyTurn);
check('まとめて終わる吸収は既存5モードだけ', enemyTurn.includes('} else if (isAbsorb && !isTacticsMode(runMode)) {') && !enemyTurn.includes('} else if (isAbsorb) {'));
check('タクティクスの吸収は、狙われた1体だけが吸う', enemyTurn.includes('const absorbedSlot=isAbsorb?pickDefenseSlot():null;')
  && /if\(slotIdx===absorbedSlot\)\{\s*const gain=applyImmediateTakenReduction\(getIncomingDamageBeforeTurnReduction\(actingIntent,slotIdx\),slotIdx\);\s*const gutsGain=Math\.floor\(gain\*0\.1\);\s*units=recoverTacticsGutsAt\(healTacticsAt\(units,slotIdx,gain\),slotIdx,gutsGain\);/.test(enemyTurn));
const rollAt = enemyTurn.indexOf('rollUnifiedSpecialDefense(defenseTable');
const chuuniAdds = [...enemyTurn.matchAll(/addWaveBuff\('chuuniDmgCutUses',1\)/g)].map(m => m.index);
check('中二病の回数を足すのは1か所(useChuuniCut の中)', chuuniAdds.length === 1 && /const useChuuniCut = \(\) => \{[\s\S]{0,260}addWaveBuff\('chuuniDmgCutUses',1\)/.test(enemyTurn));
const uses = [...enemyTurn.matchAll(/useChuuniCut\(\);/g)].map(m => m.index);
check(`中二病の回数を使うのは、抽選のあと・実際に受けた枝だけ(${uses.length}か所)`, uses.length === 3 && uses.every(i => i > rollAt));
check('反射・吸収・回避の枝では中二病の回数を使わない', (() => { const h = enemyTurn.indexOf('if (isReflect && (forcedReflect || !isTacticsMode(runMode))) {'); const t = enemyTurn.indexOf('} else if (isTacticsMode(runMode)) {', h); return h > 0 && t > h && !enemyTurn.slice(h, t).includes('useChuuniCut'); })());

// ---------- 3. このターンの被ダメ軽減 ----------
console.log('3. このターンの被ダメ軽減');
check('大樹の加護系のこのターンぶんは掛け合わせる(代入しない)', source.includes('immediateTakenMult*=guardMult;') && !source.includes('immediateTakenMult=guardMult;')
  && source.includes('immediateTakenMultBySlot[slotIdx]=(Number.isFinite(cur)&&cur>0?cur:1)*guardMult;') && !source.includes('immediateTakenMultBySlot[slotIdx]=guardMult;'));
const planned = cut('  const plannedLifeTreeMult = (slotIdx) => {', '  const plannedHitFor = (slotIdx) => {');
check('受けるダメージ予測も掛け合わせ、えるびんの見守りを入れる', planned.includes("if (card?.subType === 'watch_erubin') {") && planned.includes('mult *= Math.max(0.1, 1 - conf.cut * cardEffectMultiplier(card, halved));')
  && planned.includes('mult *= lifeTreeGuardMult(cardEffectMultiplier(card, halved), card.monId);') && !/[^*]= lifeTreeGuardMult\(/.test(planned.replace(/mult \*= lifeTreeGuardMult/g, '')));
check('実処理のえるびんの見守りと同じ式', source.includes('const takenMul=Math.max(0.1,1-conf.cut*effMul);'));

// ---------- 4・9. ターンの終わり ----------
console.log('4. 生命の源 / 9. 氷海の支配者');
check('時間停止のターンは生命の源を判定しない', enemyTurn.includes('const lifeSourceTurn=timeStopSlot==null?turnCount+1:0;'));
const lifeSrc = (source.match(/const lifeSourceGutsTurn = [^\n]+\n/) || [''])[0];
check('ターン0は生命の源の回復のターンにならない', !!lifeSrc && (() => { try { const turnsSrc = (source.match(/const LIFE_SOURCE_[A-Z_]+ = [^\n]+\n/g) || []).join(''); const idsSrc = (source.match(/const hasLifeSourceTrait = [^\n]+\n/) || [''])[0]; const f = Function(`${turnsSrc}${idsSrc}${lifeSrc}\nreturn lifeSourceGutsTurn;`)(); return f('Yggdrasil', 0) === false || !f('Yggdrasil', 0); } catch (e) { return `切り出せない: ${e.message}`; } })() === true);
check('氷海の支配者は、距離撃で動かしたあとの距離で判定する', enemyTurn.includes('const enemyDistAfterTurn=Number.isInteger(immediateEffects.forcedMoveTarget)?immediateEffects.forcedMoveTarget:enemyDist;')
  && enemyTurn.includes('applyIceRulerAutoGutsRecovery(currentAutoGutsRecovery,mainHero?.id,iceLockActive,heroDist,enemyDistAfterTurn)')
  && enemyTurn.includes('applyIceRulerAutoGutsRecovery(currentAutoGutsRecovery,id,iceLockActive,slotIdx,enemyDistAfterTurn)'));

// ---------- 7. 連撃の端数 ----------
console.log('7. 連撃を全部受け止めたときの端数');
const gHead = source.indexOf('const TACTICS_RUSH_GUARD_CARDS = '), gTail = source.indexOf('// ===== 「2枚目以降は効果半減」の数え方 =====', gHead);
const safeInt = (source.match(/const tacticsSafeInt = [\s\S]*?\n\};\n/) || [''])[0];
check('受け方の関数を切り出せる', gHead >= 0 && gTail > gHead && !!safeInt);
if (gHead >= 0 && gTail > gHead && safeInt) {
  const resolve = Function(`${safeInt}\n${source.slice(gHead, gTail)}\nreturn resolveTacticsGuardedHit;`)();
  const a = resolve(100, 3, 500, 3), b = resolve(99, 3, 500, 3);
  check('合計100・3連撃・ガード500(全部受け止める): 通るのは0で、余りが出る', a.taken === 0 && a.saved === 500 - 34, `taken=${a.taken} saved=${a.saved}`);
  check('合計99(割り切れる)は今までと同じ', b.taken === 0 && b.saved === 500 - 33, `taken=${b.taken} saved=${b.saved}`);
  // 直す前の式
  const old = (incoming, hits, guard, guardHits) => { const total = Math.max(0, Math.floor(incoming)), count = Math.max(1, hits), covered = Math.min(count, Math.max(1, guardHits)); const perHit = count > 1 ? Math.floor(total / count) : total; const through = total - perHit * covered; const left = guard - perHit; return left < 0 ? { taken: (-left) * covered + through, saved: 0 } : (through > 0 ? { taken: through, saved: 0 } : { taken: 0, saved: left }); };
  let sameWhenPartial = true, sumMatches = true, neverWorse = true, n = 0;
  for (let total = 0; total <= 400; total += 7) for (let hits = 1; hits <= 5; hits++) for (const guard of [0, 1, 20, 33, 34, 35, 80, 150, 1000]) for (let guardHits = 1; guardHits <= 5; guardHits++) {
    n++; const r = resolve(total, hits, guard, guardHits), o = old(total, hits, guard, guardHits);
    const covered = Math.min(hits, guardHits);
    if (covered < hits || hits === 1 || total % hits === 0) { if (r.taken !== o.taken || r.saved !== o.saved) sameWhenPartial = false; }
    else { if (r.taken !== r.amounts.reduce((s, v) => s + v, 0)) sumMatches = false; if (r.taken > o.taken) neverWorse = false; }
  }
  check(`1発の攻撃・一部だけ受け止める連撃・割り切れる合計は、直す前と同じ(${n}通りのうち)`, sameWhenPartial);
  check('全部受け止める連撃は、通る量＝発ごとの数字の合計', sumMatches);
  check('直したあとに、通る量が増える場面は無い', neverWorse);
}

// ---------- 8. あつの挑発 ----------
console.log('8. あつの挑発');
const stun = cut('const stunMon=slots[slotIdx];', "else if (card.subType==='buff_myaru')");
check('あつの挑発も、その時点の距離で計算する', stun.includes('getDmg(card,slotIdx,stunMon,localOryoAdd,localDmgModAdd,false,attackDistance)'));
check('あつの挑発の連撃にも、二刀流のくり返しと会心率アップを入れる', stun.includes("hitRepeat:tacticsExStyleAt(slotIdx)==='dual'?TACTICS_EX_DUAL_HIT_REPEAT:1")
  && stun.includes("+(tacticsExMultiBuffNow(slotIdx).critAdd||0)+blackNoteEffectAt(slotIdx,stunMon?.id).critAdd+kyubiAttackAt(slotIdx,stunMon?.id,card).critAdd)*tacticsExMultiBuffNow(slotIdx).critRate)"));
check('予測も同じ距離', source.includes('const previewAttackStartDist = (card, dist) => dist;'));

// ---------- 10. 山札 ----------
console.log('10. 山札の混ぜ方');
const shSrc = cut('const shuffledCopy = ', '// 敵を倒した瞬間の');
check('混ぜる関数を切り出せる', !!shSrc);
if (shSrc) {
  const shuffledCopy = Function(`${shSrc}\nreturn shuffledCopy;`)();
  const src = [1, 2, 3, 4, 5, 6, 7];
  const out = shuffledCopy(src);
  check('中身は同じで、元の配列は変えない', out !== src && [...out].sort().join() === src.join() && src.join() === '1,2,3,4,5,6,7');
  check('空・配列でないものは空の配列', shuffledCopy([]).length === 0 && shuffledCopy(null).length === 0);
  // 決まった乱数で、3枚の6通りが同じ回数ずつ出る(乱数の全パターンを数える: 1回目3通り×2回目2通り)
  const counts = {};
  for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { const seq = [(a + 0.5) / 3, (b + 0.5) / 2]; let k = 0; const key = shuffledCopy(['a', 'b', 'c'], () => seq[k++]).join(''); counts[key] = (counts[key] || 0) + 1; }
  check('3枚なら6通りの並びが同じ確率で出る', Object.keys(counts).length === 6 && Object.values(counts).every(v => v === 1), JSON.stringify(counts));
}
check('山札を作るとき・捨て札を山札へ戻すときに、かたよりのない混ぜ方を使う', source.includes('nextDeck=shuffledCopy(nextGraveyard); nextGraveyard=[];') && source.includes('return shuffledCopy(pool);')
  && !source.includes('nextDeck=[...nextGraveyard].sort(()=>Math.random()-0.5)') && !source.includes('return pool.sort(()=>Math.random()-0.5);'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
