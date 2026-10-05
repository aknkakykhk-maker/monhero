// タクティクスの「手札を捨てる」のきまりを、本体の書き方から確かめる(2026-10-05 ユーザー指示)。
//   node tools/mode/tactics-discard-check.js
// 決めごと: 捨てた枚数 × 5% を、立っている味方それぞれの「自分の最大ガッツ」に掛けて全体へ回復する。
//          捨てるのは行動回数(cardLimit)を使う。AUTOでは使わない。新モード以外では動かない。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8').replace(/\s+/g, '');
const entry = fs.readFileSync(path.join(root, 'monster-hero/src/parts/22-enemy-and-bond-entries.jsx'), 'utf8');
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
check('1枚あたりの回復は最大ガッツの5%', /const TACTICS_DISCARD_GUTS_RATE = 0\.05;/.test(entry));
check('立っている子それぞれの最大ガッツ×率×枚数で配る(上限は超えない)',
  app.includes('tacticsAliveSlots(units).forEach(i=>{constv=normalizeTacticsUnit(units[i]);constg=Math.max(0,Math.min(v.maxGuts-v.guts,Math.floor(v.maxGuts*TACTICS_DISCARD_GUTS_RATE*discardedCards.length)));'));
check('捨てた札は墓地へ送り、そのぶん引き直す',
  app.includes('nextGraveyard=[...graveyard,...usedCards,...discardedCards]') && app.includes('replenish(usedCardEntries.length+discardedCards.length+drawCount)'));
check('捨てる札は行動回数(cardLimit)を使う', app.includes('constactionUsed=selectedCards.length+discardCards.length;') && app.includes('if(actionUsed>=cardLimit){setFocusedCard(null);return;}'));
check('捨てるのはタクティクスだけ・AUTOの明示の選択では使わない', app.includes('(!hasExplicitEntries&&isTacticsMode(runMode))?discardCards'));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
