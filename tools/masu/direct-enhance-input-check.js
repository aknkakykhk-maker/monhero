const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
let failed = 0;
const check = (name, ok, detail='') => { console.log(`${ok?'OK':'NG'}: ${name}${detail?' — '+detail:''}`); if(!ok) failed++; };

const start = source.indexOf('const directEnhancePointAmount =');
const end = source.indexOf('// 強化の下書き(plan)を当てはめた', start);
let direct = null;
try {
  if (start >= 0 && end > start) direct = new Function(`${source.slice(start,end)}\nreturn directEnhancePointAmount;`)();
} catch (e) { check('直接入力の正規化関数を取り出せる', false, e.message); }
check('直接入力の正規化関数がある', typeof direct === 'function');
if (direct) {
  check('37Pをそのまま受け付ける', direct('37',100) === 37);
  check('残り100Pに999を入れると100で止まる', direct('999',100) === 100);
  check('負数・小数・文字は0にする', direct('-5',100) === 0 && direct('12.5',100) === 0 && direct('abc',100) === 0);
  check('空欄は0にする', direct('',100) === 0);
  check('巨大な整数も上限へ安全に収める', direct('999999999999999999999999999999999999',7) === 7);
}
check('通常強化の能力・適性に直接入力がある', source.includes('data-direct-point-input="normal-stat"') && source.includes('data-direct-point-input="normal-apt"') && source.includes('const setPlanExact ='));
check('超越強化の能力・適性にも直接入力がある', source.includes('data-direct-point-input="transcend-stat"') && source.includes('data-direct-point-input="transcend-apt"') && source.includes('const setTranscendPlanExact ='));
check('スマホで数字キーボードを出す', (source.match(/inputMode="numeric"/g)||[]).length >= 4 && (source.match(/pattern="\[0-9\]\*"/g)||[]).length >= 4);
check('従来の1P/5P/10P/MAXと長押しを残す', source.includes("{[1,5,10,'MAX'].map") && source.includes('PressRepeatButton') && source.includes('bulkEnhanceUnit') && source.includes('transcendBulkUnit'));
check('ヘルプへ数値直接入力を反映', help.includes('使いたいポイント数を直接入力'));
check('更新履歴へ反映', changelog.includes('強化ポイントを数値で直接入力できるようにしました'));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
