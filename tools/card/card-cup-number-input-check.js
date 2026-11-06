// MFバトルカード 大会の数の欄(預ける数・参加費・配る割合・入る番号)の読み方を見張る
//   2026-11-07 社長「数値が絡む項目は基本直接入力」・バトル部 #4654 と同じ読み方(全角数字は半角・小数点から先は切り捨て・ほかの文字は無視)。
//   前は全角数字を打つと消えていた(数字以外を全部落としてから読んでいた)
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let fail = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${ok ? '' : ' — ' + detail}`); if (!ok) fail++; };
const prize = read('monster-hero/src/parts/99-card-cup-prize.jsx');
const cup = read('monster-hero/src/parts/99-card-cup.jsx');
const between = (from, to) => { const i = prize.indexOf(from); if (i < 0) return ''; const j = prize.indexOf(to, i); return j < 0 ? '' : prize.slice(i, j + to.length); };
const src = between('const cardCupReadCount = ', '\n};\n') + between('const cardCupReadSplit = ', ';\n');
check('読み方の部品がある(cardCupReadCount・cardCupReadSplit)', /cardCupReadCount/.test(src) && /cardCupReadSplit/.test(src));
const sb = {}; vm.createContext(sb);
try { vm.runInContext(`${src}\nthis.c = cardCupReadCount; this.s = cardCupReadSplit;`, sb); } catch (e) { check('読み方の部品が動く', false, e.message); }
if (sb.c) {
  const cases = [['１２３', 123], ['12.5', 12], ['1,000', 1000], ['-500', 500], ['', 0], ['abc', 0], ['３．９', 3], [null, 0], ['０', 0]];
  check('全角数字は半角・小数点から先は切り捨て・カンマとマイナスは無視・空欄と数字なしは0', cases.every(([i, o]) => sb.c(i) === o), cases.map(([i]) => `${i}→${sb.c(i)}`).join(' / '));
  const sp = [['60,30,10', '60,30,10'], ['６０、３０、１０', '60,30,10'], ['50，50', '50,50'], ['70 30', '70,30'], ['0,abc,40', '40'], ['1,1,1,1,1,1,1,1,1,1', '1,1,1,1,1,1,1,1']];
  check('配る割合は全角数字・全角カンマ・読点・空白でも読める(0と読めない所は落とす・8つまで)', sp.every(([i, o]) => sb.s(i).join() === o), sp.map(([i]) => `${i}→${sb.s(i).join()}`).join(' / '));
}
check('預ける数の欄は cardCupReadCount で読む(数字のキーボード)', /data-card-cup-give-amount inputMode="numeric" pattern="\[0-9\]\*"[^>]*onChange=\{\(e\) => setPick\(\{ \.\.\.pick, amount: cardCupReadCount\(e\.target\.value\) \}\)\}/.test(prize));
check('参加費の欄は cardCupReadCount で読む(数字のキーボード)', /data-card-cup-fee-amount inputMode="numeric" pattern="\[0-9\]\*"[^>]*onChange=\{\(e\) => setFeeAmount\(cardCupReadCount\(e\.target\.value\)\)\}/.test(prize));
check('配る割合の欄は cardCupReadSplit で読む', /data-card-cup-split-custom[^>]*onChange=\{\(e\) => setSplit\(cardCupReadSplit\(e\.target\.value\)\)\}/.test(prize));
check('入る番号の欄は全角数字を半角にしてから6桁にする', /data-card-cup-code-input[^\n]*?setCode\(String\(e\.target\.value\)\.replace\(\/\[０-９\]\/g/.test(cup));
check('数字以外を先に全部落とす古い読み方が、大会の数の欄に残っていない', !/data-card-cup-(give|fee)-amount[^>]*Number\(String\(e\.target\.value\)\.replace\(\/\[\^0-9\]\/g/.test(prize));
console.log(fail ? `\n${fail}件のNGがあります` : '\nすべてOK');
process.exit(fail ? 1 : 0);
