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
const numAfter = (re, fallback = null) => { const m = html.match(re); return m ? Number(m[1]) : fallback; };
// 縦向き
const PORTRAIT = {
  CENTER: { top: numAfter(/\[data-rhythm-combo-box\]\{\s*top:([\d.]+)%/), edge: null, font: 52 },
  RIGHT: { top: numAfter(/\[data-combo-pos="RIGHT"\]\{left:auto;right:([\d.]+)%;top:[\d.]+%/) === null ? null : numAfter(/\[data-combo-pos="RIGHT"\]\{left:auto;right:[\d.]+%;top:([\d.]+)%/), edge: 'right', gap: numAfter(/\[data-combo-pos="RIGHT"\]\{left:auto;right:([\d.]+)%/), font: 34 },
  LEFT: { top: numAfter(/\[data-combo-pos="LEFT"\]\{left:[\d.]+%;right:auto;top:([\d.]+)%/), edge: 'left', gap: numAfter(/\[data-combo-pos="LEFT"\]\{left:([\d.]+)%/), font: 34 },
  HUD: { top: numAfter(/\[data-combo-pos="HUD"\]\{left:auto;right:[\d.]+%;top:([\d.]+)%/), edge: 'right', gap: numAfter(/\[data-combo-pos="HUD"\]\{left:auto;right:([\d.]+)%/), font: 34 },
};
// 横向き(data-combo-wide="1")
const wideSideTop = numAfter(/\[data-combo-wide="1"\]\[data-combo-pos="RIGHT"\]\{top:([\d.]+)%\}/);
const LANDSCAPE = {
  CENTER: { top: numAfter(/\[data-rhythm-combo-box\]\[data-combo-wide="1"\]\{top:([\d.]+)%\}/), edge: null, font: 40 },
  RIGHT: { top: wideSideTop, edge: 'right', gap: PORTRAIT.RIGHT.gap, font: 28 },
  LEFT: { top: wideSideTop, edge: 'left', gap: PORTRAIT.LEFT.gap, font: 28 },
  HUD: { top: numAfter(/\[data-combo-wide="1"\]\[data-combo-pos="HUD"\]\{top:([\d.]+)%;right:([\d.]+)%\}/), edge: 'right',
    gap: (html.match(/\[data-combo-wide="1"\]\[data-combo-pos="HUD"\]\{top:[\d.]+%;right:([\d.]+)%\}/) || [])[1], font: 26 },
};
LANDSCAPE.HUD.gap = Number(LANDSCAPE.HUD.gap);
const describe = spec => Object.entries(spec).map(([k, v]) => `${k} ${v.top}%`).join(' / ');
check('コンボ数の置き場所をCSSから読めている',
  Object.values(PORTRAIT).every(p => p.top !== null) && Object.values(LANDSCAPE).every(p => p.top !== null),
  `縦: ${describe(PORTRAIT)} / 横: ${describe(LANDSCAPE)}`);

// 数字の見た目の幅。実測(390x844・34px・最大倍率1.25)で4桁118px＝1桁あたり0.70em(倍率を外した値)。
// ★枠そのものの幅は「COMBO」のラベル(tracking 0.36em)で決まっていて、数字はその中央に出る。
//   つまりこの見積もりは**実際に字が描かれる幅より広め**で、安全側に振ってある。
// 基準は3桁(999コンボまで)。4桁は1000コンボ以上のときだけで、そこは台形へ少し入るが
// 薄く後ろに描いているので許す。
const digitsWidth = (font, digits = 3) => font * 1.25 * .70 * digits;
const comboHeight = font => font * 1.5;

const inspect = (W, H, spec, label) => {
  console.log(`\n--- ${label} (${W}x${H}) ---`);
  const monsters = [1, 2, 3, 4].map(slot => rhythmSideMonsterBox(slot, W, H));
  monsters.forEach(m => console.log(`  マスモン${m.side === 'left' ? '左' : '右'} x ${Math.round(m.left)}〜${Math.round(m.left + m.size)} / y ${Math.round(m.top)}〜${Math.round(m.top + m.size)}`));
  for (const [key, pos] of Object.entries(spec)) {
    const top = pos.top / 100 * H, bottom = top + comboHeight(pos.font);
    if (!pos.edge) { console.log(`  ${key}: y ${Math.round(top)}〜${Math.round(bottom)}px (真ん中なのでレーンへわざと重ねる)`); continue; }
    const width = digitsWidth(pos.font);
    const gapPx = pos.gap / 100 * W;
    const left = pos.edge === 'left' ? gapPx : W - gapPx - width;
    const right = left + width;
    // ★重なりは**縦と横の両方**で見る。高さだけで見ると、横向きの「右上」のように
    //   マスモンと同じ高さでも左右がずれていて当たらない場所を、当たると誤判定する。
    const hit = monsters.filter(m => bottom > m.top && top < m.top + m.size && right > m.left && left < m.left + m.size);
    check(`  ${key} がマスモンに重ならない`, hit.length === 0,
      `x ${Math.round(left)}〜${Math.round(right)} / y ${Math.round(top)}〜${Math.round(bottom)}`
      + (hit.length ? ` / ぶつかる相手 ${hit.map(m => `${m.side} x${Math.round(m.left)}〜${Math.round(m.left + m.size)} y${Math.round(m.top)}〜${Math.round(m.top + m.size)}`).join(', ')}` : ''));
    // 台形の外の空き(片側)に、数字(3桁)が収まるか
    const freeWidth = rhythmProjectBoundary(0, (top + bottom) / 2 / H) * W;
    check(`  ${key} の数字(3桁)が台形の外の空きに収まる`, gapPx + width <= freeWidth,
      `端の余白${Math.round(gapPx)}px + 3桁で約${Math.round(width)}px / 空き ${Math.round(freeWidth)}px`);
  }
};
inspect(390, 844, PORTRAIT, '縦持ち');
inspect(844, 390, LANDSCAPE, '横持ち');

// 「右上」は縦でも横でも**上の方**に出す(オプションの名前と合わせる)
check('「右上」は縦でも横でも上の方に出る',
  PORTRAIT.HUD.top <= 25 && LANDSCAPE.HUD.top <= 30,
  `縦 ${PORTRAIT.HUD.top}% / 横 ${LANDSCAPE.HUD.top}%`);

// 端へ寄せるときは、真ん中より小さくする(空きが狭いため)
check('端へ寄せるときは小さくしている',
  /\[data-combo-pos="HUD"\] \[data-rhythm-combo\]\{\s*font-size:calc\(min\(34px,9vw\) \* var\(--mh-combo-size,1\)\);/.test(html)
  && /transform:scale\(min\(var\(--mh-combo-scale,1\),1\.25\)\)/.test(html)
  && /\[data-rhythm-combo\]\{\s*font-size:calc\(min\(52px,13\.5vw\) \* var\(--mh-combo-size,1\)\)/.test(html));
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
