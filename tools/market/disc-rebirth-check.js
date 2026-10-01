// 円盤石を買ったときの「円盤石から再生」の演出(2026-10-01)が、つながったままかを見る。
//
//   ユーザー指示「円盤石（モンスター）を買ったときに初回だけ円盤石から再生する演出がほしい」。
//   円盤石は1体につき1回しか買えないので、その子を初めて手に入れたときだけ出る。
//
// 見るもの
//   ① 演出の部品 DiscRebirthFx があり、押すと最後へ飛ばせる・閉じるボタンがある
//   ② ダイヤショップの円盤石とビートP交換所の円盤石の両方で、買えたあとに出す
//   ③ 見た目(.mh-disc-rebirth-*)があり、動きを減らす設定では最後の画面だけを出す
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ui = read('monster-hero/src/parts/20-market-notices-help.jsx');
const market = read('monster-hero/src/parts/55-screen-breeder-market.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };

// ① 部品
check('演出の部品 DiscRebirthFx がある', /const DiscRebirthFx = \(\{ mon, discIcon, onClose \}\) =>/.test(ui));
check('押すと最後の画面へ飛ばせる', ui.includes("onClick={() => { if (!done) setDone(true); }}"));
check('一定の時間で最後の画面になる', /setTimeout\(\(\) => setDone\(true\), DISC_REBIRTH_MS\)/.test(ui));
check('閉じるボタンがある', ui.includes('<ModalCloseButton onClick={onClose}/>') && ui.includes('mh-disc-rebirth-close'));
check('買った円盤石の絵と立ち絵を使う', ui.includes('src={discIcon}') && ui.includes('src={mon.imgUrl}'));

// ② つなぎ
check('ダイヤショップの円盤石で出す', market.includes("rebirth:item.type==='disc'?{monsterId:item.id,discIcon:item.icon}:null"));
check('ビートP交換所の円盤石で出す', market.includes('rebirth:{monsterId:offer.monsterId,discIcon:disc?.icon||item.icon}'));
check('買えたときだけ出す(失敗したら出さない)',
  /if\(result===true\|\|result\?\.ok\)\{[\s\S]{0,200}if\(sheet\.rebirth&&ALL_PLAYER_MONSTERS\[sheet\.rebirth\.monsterId\]\) setRebirth\(sheet\.rebirth\);/.test(market));
check('画面が演出を描く', market.includes('{rebirth&&<DiscRebirthFx mon={ALL_PLAYER_MONSTERS[rebirth.monsterId]}'));

// ③ 見た目
for (const cls of ['mh-disc-rebirth{', 'mh-disc-rebirth-disc{', 'mh-disc-rebirth-flash{', 'mh-disc-rebirth-art{', 'mh-disc-rebirth.is-done']) {
  check(`見た目 .${cls.replace('{', '')} がある`, css.includes(`.${cls}`));
}
check('動きを減らす設定では最後の画面だけを出す',
  /@media \(prefers-reduced-motion: reduce\)\{\.mh-disc-rebirth-disc[^}]*animation:none/.test(css));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
