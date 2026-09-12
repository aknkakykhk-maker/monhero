const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// コンボ数が「本当に空いているところ」に出るかを、座標を計算して確かめる。
//
//   node tools/mode/rhythm-combo-space-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-13)
//   「コンボの位置を調整出来るけどどれもこれも位置が微妙。大体ますもんに被ってたり /
//     ちゃんと空いてる位置を見つけてそこに配置されるようにして」
//
// 両サイドのマスモンは、台形の外の空きへ**計算で**置かれる(rhythmSideMonsterBox)。
// コンボ数はCSSの % で置いてあるので、片方だけ動かすと**黙って重なる**。
// 画面はふつうに動いてしまうので、同じ式を使ってここで重なりを計算する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const data = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- マスモンの置き場所は、実装の関数をそのまま動かして出す ---
const grabConst = name => {
  const m = data.match(new RegExp(`const ${name} ?= ?[^;]+;`));
  return m ? m[0] : '';
};
const grabFn = name => {
  const i = data.indexOf(`const ${name}=`);
  if (i < 0) return '';
  const j = data.indexOf('\n};', i);
  return j > i ? data.slice(i, j + 3) : '';
};
const sandboxSource = [
  'const rhythmClamp01=v=>Math.max(0,Math.min(1,Number(v)||0));',
  grabConst('RHYTHM_PROJECTION_TOP_SCALE'),
  grabConst('RHYTHM_LANE_COUNT'),
  grabConst('rhythmProjectionScale'),
  grabFn('rhythmProjectBoundary'),
  grabConst('RHYTHM_SIDE_MONSTER_ANCHORS'),
  grabConst('RHYTHM_SIDE_MONSTER_FILL'),
  grabConst('RHYTHM_SIDE_MONSTER_MAX_RATIO'),
  grabConst('RHYTHM_SIDE_MONSTER_HEIGHT_RATIO'),
  grabFn('rhythmSideMonsterPlacement'),
  grabFn('rhythmSideMonsterBox'),
].join('\n');
const ctx = {};
check('マスモンの置き場所の計算を取り出せている',
  sandboxSource.includes('rhythmSideMonsterBox') && sandboxSource.includes('rhythmProjectBoundary'));
vm.runInNewContext(`${sandboxSource}\nthis.out={rhythmSideMonsterBox,rhythmProjectBoundary,RHYTHM_SIDE_MONSTER_ANCHORS};`, ctx);
const { rhythmSideMonsterBox, rhythmProjectBoundary } = ctx.out;

// --- コンボ数の置き場所は index.html から読む ---
const percentOf = re => { const m = html.match(re); return m ? Number(m[1]) / 100 : null; };
const POS = {
  CENTER: { portrait: percentOf(/\[data-rhythm-combo-box\]\{\s*top:([\d.]+)%/), landscape: percentOf(/\[data-rhythm-combo-box\]\[data-combo-wide="1"\]\{top:([\d.]+)%\}/), edge: false },
  RIGHT: { portrait: percentOf(/\[data-combo-pos="RIGHT"\]\{left:auto;right:[\d.]+%;top:([\d.]+)%/), edge: true },
  LEFT: { portrait: percentOf(/\[data-combo-pos="LEFT"\]\{left:[\d.]+%;right:auto;top:([\d.]+)%/), edge: true },
  HUD: { portrait: percentOf(/\[data-combo-pos="HUD"\]\{left:auto;right:[\d.]+%;top:([\d.]+)%/), edge: true },
};
const wideEdgeTop = percentOf(/\[data-combo-pos="HUD"\]\{top:([\d.]+)%\}/);
for (const key of ['RIGHT', 'LEFT', 'HUD']) POS[key].landscape = wideEdgeTop;
check('コンボ数の置き場所をCSSから読めている',
  Object.values(POS).every(p => p.portrait !== null && p.landscape !== null),
  Object.entries(POS).map(([k, p]) => `${k} 縦${p.portrait !== null ? (p.portrait * 100).toFixed(1) + '%' : '?'} 横${p.landscape !== null ? (p.landscape * 100).toFixed(1) + '%' : '?'}`).join(' / '));

// コンボ数の見た目の高さ(数字＋COMBOの行)。CSSの font-size から見積もる。
// 端寄せは34px(横持ち28px)、真ん中は52px(横持ち40px)。ラベルと余白でおよそ1.5倍。
const comboHeight = (edge, landscape) => Math.round((edge ? (landscape ? 28 : 34) : (landscape ? 40 : 52)) * 1.5);

const inspect = (W, H, label) => {
  console.log(`\n--- ${label} (${W}x${H}) ---`);
  const monsters = [1, 2, 3, 4].map(slot => rhythmSideMonsterBox(slot, W, H));
  monsters.forEach(m => console.log(`  マスモン${m.side === 'left' ? '左' : '右'} y ${Math.round(m.top)}〜${Math.round(m.top + m.size)}px (${(m.top / H * 100).toFixed(0)}〜${((m.top + m.size) / H * 100).toFixed(0)}%)`));
  const landscape = W > H;
  for (const [key, spec] of Object.entries(POS)) {
    const top = (landscape ? spec.landscape : spec.portrait) * H;
    const bottom = top + comboHeight(spec.edge, landscape);
    // 端へ寄せる置き方だけを見る。真ん中は台形の上(レーン)へわざと重ねている
    if (!spec.edge) { console.log(`  ${key}: y ${Math.round(top)}〜${Math.round(bottom)}px (真ん中なのでマスモンとは元から離れている)`); continue; }
    const hit = monsters.filter(m => bottom > m.top && top < m.top + m.size);
    check(`  ${key} がマスモンに重ならない`, hit.length === 0,
      `y ${Math.round(top)}〜${Math.round(bottom)}px` + (hit.length ? ` / ぶつかる相手 ${hit.map(m => `${m.side} ${Math.round(m.top)}〜${Math.round(m.top + m.size)}`).join(', ')}` : ''));
    // 台形の外の空き(片側)に、数字が収まるか。
    // 基準は3桁(999コンボまで)。実測(390x844・34px・最大倍率1.25)で4桁118pxなので、
    // 1桁あたり0.70em(倍率を外した値)。4桁は1000コンボ以上のときだけで、そこは
    // 台形へ20〜30px入るが、薄く後ろに描いているので許す。
    const freeRatio = rhythmProjectBoundary(0, (top + bottom) / 2 / H);
    const freeWidth = freeRatio * W;
    const edgeGap = W * (key === 'HUD' ? .03 : .04);
    const digitWidth = (landscape ? 28 : 34) * 1.25 * .70 * 3;
    check(`  ${key} の数字(3桁)が台形の外の空きに収まる`, edgeGap + digitWidth <= freeWidth,
      `端の余白${Math.round(edgeGap)}px + 3桁で約${Math.round(digitWidth)}px / 空き ${Math.round(freeWidth)}px`);
  }
};
inspect(390, 844, '縦持ち');
inspect(844, 390, '横持ち');

// 端へ寄せるときは、真ん中より小さくする(空きが狭いため)
check('端へ寄せるときは小さくしている',
  /\[data-combo-pos="HUD"\] \[data-rhythm-combo\]\{\s*font-size:min\(34px,9vw\);/.test(html)
  && /transform:scale\(min\(var\(--mh-combo-scale,1\),1\.25\)\)/.test(html)
  && /\[data-rhythm-combo\]\{\s*font-size:min\(52px,13\.5vw\)/.test(html));
// 縦横ボタンで自分で回したときも同じ場所に出す(@media では効かない)
// @media のブロックを丸ごと取り出して、コンボの指定が残っていないかを見る
// (中括弧の対応を数える。正規表現だと最初の } で切れて見落とす)
const landscapeMediaBlocks = [];
for (let at = 0; (at = html.indexOf('@media (orientation: landscape)', at)) >= 0;) {
  const open = html.indexOf('{', at);
  let depth = 0, i = open;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}' && --depth === 0) break;
  }
  landscapeMediaBlocks.push(html.slice(open, i));
  at = i + 1;
}
check('横持ちの出し分けは data-combo-wide で行う(@media には残さない)',
  html.includes('[data-rhythm-combo-box][data-combo-wide="1"]{top:15%}')
  && landscapeMediaBlocks.length > 0
  && !landscapeMediaBlocks.some(block => block.includes('[data-rhythm-combo')),
  `@media (orientation: landscape) は ${landscapeMediaBlocks.length} か所`);

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
