// 個数・回数・枚数を選ぶ所は、数を直接打ち込める欄(CountInput)を使う(2026-10-20 社長「個数系のやつは基本的に直接入力があったほうがいいね」)。
//
//   node tools/boot/count-input-check.js
//
//   ① CountInput の作り: 数字のキーボード(inputMode=numeric)・字は16px以上(iPhone で拡大されない)・
//      打っている途中で min〜max にそろえて onChange へ渡す・空は min・上限超えは上限・小数は点より前
//   ② 「MAX（…）」「全部」「最大」のボタン(=数を選ぶ所の目印)のそばには、必ず CountInput か QuantityStepper がある
//      (新しく −/＋/MAX で数を選ぶ所を作って、数字の欄を付け忘れたらここで止まる)
//   ③ 今ある数を選ぶ所(マーケット・トレーニングチケット・スキップチケット・お布施・転生・まとめて転生)がどれも欄を使っている
//   ④ CountInput の動き(打ち込み → そろえ方)を、部品だけ取り出して確かめる
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero/src/parts');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const read = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');

// ① 作り
const ui = read('41-screen-ui.jsx');
const def = (ui.split('const CountInput = ')[1] || '').split('\n};\n')[0];
check('CountInput がある', def.length > 0);
check('数字のキーボードが出る(inputMode="numeric")', def.includes('inputMode="numeric"') && def.includes('pattern="[0-9]*"'));
const fontSize = Number((def.match(/fontSize:(\d+)/) || [])[1]);
check('字は16px以上(iPhone で欄を押したときに画面が拡大されない)', fontSize >= 16, `${fontSize}px`);
check('マーケットの QuantityStepper も CountInput を使う', /const QuantityStepper[\s\S]*?<CountInput /.test(ui));

// ② MAX/全部/最大 のそばに欄がある
const NEAR = 3000;
const files = fs.readdirSync(PARTS).filter(f => f.endsWith('.jsx') && !/debug/.test(f));
const misses = [];
let marks = 0;
for (const f of files) {
  const src = read(f);
  const re = />\s*(MAX（|全部\s*<|最大\{)/g;
  let m;
  while ((m = re.exec(src))) {
    marks++;
    const around = src.slice(Math.max(0, m.index - NEAR), m.index + 200);
    // もとから数字の欄(inputMode="numeric")で打ち込める所(お布施のダイヤの量など)も、打ち込めるのでよい
    if (!/<CountInput |<QuantityStepper |const QuantityStepper|inputMode="numeric"/.test(around)) misses.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
  }
}
check(`「MAX」「全部」「最大」で数を選ぶ所(${marks}か所)のそばに、数を打ち込む欄がある`, marks >= 5 && misses.length === 0, misses.join(' / '));

// ③ 今ある数を選ぶ所
const sites = [
  ['マーケットの確認の窓', '20-market-notices-help.jsx', '<QuantityStepper value={count} max={maxQuantity}'],
  ['トレーニングチケットを使う枚数', '60-app.jsx', '<QuantityStepper value={count} max={have} unit="枚"'],
  ['スキップチケットの使う枚数', '67-screen-pick.jsx', '<CountInput value={n} max={max} onChange={changeSkipCount}'],
  ['お布施の上げるレベル', '62-screen-masu-offering.jsx', '<CountInput value={amount} max={limits.maxLevels} onChange={setLevels}'],
  ['お布施の転生する回数', '62-screen-masu-offering.jsx', '<CountInput value={amount} max={limits.maxTimes} onChange={setTimes}'],
  ['転生(1体ずつ)の回数', '62-screen-masu-temple.jsx', '<CountInput value={times} max={maxTimes}'],
  ['まとめて転生の1体あたりの回数', '62-screen-masu-temple.jsx', '<CountInput value={timesNum} max={timesMax}'],
];
for (const [label, f, needle] of sites) check(`${label}は数を打ち込める`, read(f).includes(needle));

// ④ 動き(部品だけを取り出し、Babel で JSX を外して、React の useState と createElement を差し替えて動かす)
{
  const clampSrc = (ui.match(/const countInputClamp = [^\n]+\n/) || [''])[0];
  let ok4 = true, detail = '';
  try {
    const babel = require(path.join(ROOT, 'tools/node_modules/@babel/core'));
    const code = babel.transformSync(`${clampSrc}const CountInput = ${def}\n};`, { presets: [require.resolve(path.join(ROOT, 'tools/node_modules/@babel/preset-react'))], babelrc: false, configFile: false }).code;
    let state;
    const React = { useState: (init) => [state === undefined ? init : state, (v) => { state = v; }], createElement: (type, props) => props };
    const F = new Function('React', `${code}\nreturn CountInput;`)(React);
    const run = (typed, max) => {
      state = undefined; let got = null;
      const props = F({ value: 1, max, onChange: (v) => { got = v; } });
      props.onChange({ target: { value: typed } });
      return got;
    };
    const cases = [['25', 500, 25], ['99999', 489, 489], ['3.7', 500, 3], ['', 500, 1], ['0', 500, 1], ['１２', 500, 12], ['abc', 500, 1]];
    for (const [typed, max, want] of cases) { const got = run(typed, max); if (got !== want) { ok4 = false; detail += `「${typed}」→${got}(期待${want}) `; } }
    state = undefined;
    const shown = F({ value: 7, max: 50, onChange: () => {} });
    if (shown.value !== '7' || shown.inputMode !== 'numeric') { ok4 = false; detail += `表示 ${shown.value} / ${shown.inputMode}`; }
  } catch (e) { ok4 = false; detail = String(e).slice(0, 200); }
  check('打ち込んだ数を そろえて渡す(25→25 / 上限超え→上限 / 3.7→3 / 空・0・文字→1 / 全角１２→12)', ok4, detail);
}

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
