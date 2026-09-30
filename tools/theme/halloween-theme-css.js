// 画面テーマ「ハロウィン」の色の置き換えを、Tailwind が作ったCSSから機械で作る。
//
// 【なぜ要るか】
// 画面の多くは bg-slate-900 のような Tailwind の色をその場で書いている(60-app.jsx だけで150か所ほど)。
// 共通の色(--mh-bg など)を替えるだけでは染まりきらないので、紺色系(slate・gray・zinc・indigo・blue の暗い色)を
// 使っているクラスを拾い、同じ明るさの紫へ置き換えた規則を [data-mh-theme=halloween] の下に書き足す。
// 手で書き写すと、新しいクラスを使ったときに取りこぼすので、CSSを作るたびに作り直す(build-tailwind.js が呼ぶ)。
//
// ★明るさはそろえてある(文字の読みやすさを変えないため)。色みだけを夜の紫へ寄せる。
// ★意味のある色(難易度・レア度・ダメージなど)は赤・緑・金などなので、ここでは触らない。
const SCOPE = '[data-mh-theme=halloween]';

// 置き換え先。50〜950 の明るさの段ごとに1色
const NIGHT = {
  50: [253, 248, 255], 100: [248, 238, 252], 200: [240, 224, 247], 300: [222, 200, 236],
  400: [184, 158, 204], 500: [138, 108, 163], 600: [98, 70, 125], 700: [70, 42, 94],
  800: [47, 25, 67], 900: [31, 15, 47], 950: [18, 7, 30],
};
// 置き換える元の色(Tailwind 3 の既定値)
const SOURCE = {
  slate: { 50: [248, 250, 252], 100: [241, 245, 249], 200: [226, 232, 240], 300: [203, 213, 225], 400: [148, 163, 184], 500: [100, 116, 139], 600: [71, 85, 105], 700: [51, 65, 85], 800: [30, 41, 59], 900: [15, 23, 42], 950: [2, 6, 23] },
  gray: { 50: [249, 250, 251], 100: [243, 244, 246], 200: [229, 231, 235], 300: [209, 213, 219], 400: [156, 163, 175], 500: [107, 114, 128], 600: [75, 85, 99], 700: [55, 65, 81], 800: [31, 41, 55], 900: [17, 24, 39], 950: [3, 7, 18] },
  zinc: { 700: [63, 63, 70], 800: [39, 39, 42], 900: [24, 24, 27], 950: [9, 9, 11] },
  // 紺のパネルに使っている暗い indigo・blue だけ。明るい indigo はボタンの色として意味を持つので残す
  indigo: { 800: [88, 32, 118], 900: [66, 24, 92], 950: [44, 16, 64] },
  blue: { 900: [66, 24, 92], 950: [44, 16, 64] },
};
const INDIGO_SRC = { indigo: { 800: [55, 48, 163], 900: [49, 46, 129], 950: [30, 27, 75] }, blue: { 900: [30, 58, 138], 950: [23, 37, 84] } };

// 明るい indigo(ボタン・見出し・選択中の印)は、ハロウィンではかぼちゃ色のオレンジへ寄せる(2026-09-30・ユーザー要望「オレンジを押したほうが雰囲気が出そう」)。
// 白い文字を載せるボタン(500〜700)は、文字が読めるよう少し深いオレンジにしてある
const PUMPKIN = {
  indigo: {
    200: [[199, 210, 254], [254, 226, 190]], 300: [[165, 180, 252], [255, 200, 140]], 400: [[129, 140, 248], [255, 166, 77]],
    500: [[99, 102, 241], [232, 110, 22]], 600: [[79, 70, 229], [204, 84, 12]], 700: [[67, 56, 202], [156, 60, 10]],
  },
};

const MAP = new Map();
for (const shades of Object.values(PUMPKIN)) for (const [from, to] of Object.values(shades)) MAP.set(from.join(','), to);
for (const [family, shades] of Object.entries(SOURCE)) {
  for (const [shade, rgb] of Object.entries(shades)) {
    const from = (INDIGO_SRC[family] && INDIGO_SRC[family][shade]) || rgb;
    const to = INDIGO_SRC[family] ? rgb : NIGHT[shade];
    MAP.set(from.join(','), to);
  }
}
const hex = (rgb) => '#' + rgb.map((n) => n.toString(16).padStart(2, '0')).join('');
const hexMap = (map) => new Map([...map].map(([k, to]) => [hex(k.split(',').map(Number)), hex(to)]));
const HEX = hexMap(MAP);

// モンヒロビートの画面だけ、シアン(青緑)もオレンジへ寄せる。シアンは他の画面では意味のある色(オートの印など)なので、
// 画面の種類が rhythm のときだけ(.mh-app の data-mh-theme-category)。演奏中のノーツ・判定は class ではなく個別の色なので変わらない
const RHYTHM_SCOPE = '[data-mh-theme=halloween][data-mh-theme-category=rhythm]';
const RHYTHM_MAP = new Map([
  [[165, 243, 252], [254, 215, 170]], [[103, 232, 249], [255, 190, 120]], [[34, 211, 238], [255, 150, 50]],
  [[6, 182, 212], [240, 110, 20]], [[8, 145, 178], [204, 84, 12]], [[14, 116, 144], [156, 60, 10]],
].map(([from, to]) => [from.join(','), to]));

// 1つの宣言の並びの中の色を置き換える。置き換えたものが無ければ null
function recolor(decls, map = MAP, hexes = HEX) {
  let changed = false;
  let out = decls.replace(/rgb\((\d+) (\d+) (\d+)\//g, (m, r, g, b) => {
    const to = map.get(`${r},${g},${b}`); if (!to) return m; changed = true; return `rgb(${to.join(' ')}/`;
  });
  out = out.replace(/rgba\((\d+),(\d+),(\d+),/g, (m, r, g, b) => {
    const to = map.get(`${r},${g},${b}`); if (!to) return m; changed = true; return `rgba(${to.join(',')},`;
  });
  out = out.replace(/#[0-9a-f]{6}\b/g, (m) => { const to = hexes.get(m); if (!to) return m; changed = true; return to; });
  return changed ? out : null;
}

// いちばん外側の「セレクタ{宣言}」だけを見る(@media の中は写さない)
function halloweenThemeRules(css, scope = SCOPE, map = MAP, hexes = HEX) {
  const rules = [];
  let i = 0, depth = 0, start = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) {
        const selector = css.slice(start, i).trim();
        const close = css.indexOf('}', i);
        if (!selector.startsWith('@') && close > 0 && css.lastIndexOf('{', close - 1) === i) {
          const parts = selector.split(',').map((s) => s.trim());
          const decls = css.slice(i + 1, close);
          const colored = parts.every((p) => p.startsWith('.')) ? recolor(decls, map, hexes) : null;
          if (colored) rules.push(`${parts.map((p) => `${scope} ${p}`).join(',')}{${colored}}`);
          i = close + 1; start = i; continue;
        }
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) start = i + 1;
    }
    i++;
  }
  return rules;
}

function withHalloweenTheme(css) {
  const rules = halloweenThemeRules(css).concat(halloweenThemeRules(css, RHYTHM_SCOPE, RHYTHM_MAP, hexMap(RHYTHM_MAP)));
  if (!rules.length) throw new Error('ハロウィンの色の置き換えが1つも作れませんでした');
  return `${css}\n/* halloween-theme: tools/theme/halloween-theme-css.js が作った色の置き換え(${rules.length}件) */\n${rules.join('')}`;
}

module.exports = { withHalloweenTheme, halloweenThemeRules, recolor, SCOPE };

if (require.main === module) {
  const fs = require('fs'); const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'tailwind.css'), 'utf8');
  const rules = halloweenThemeRules(css.split('/* halloween-theme')[0]);
  console.log(`置き換えの規則: ${rules.length}件`);
  console.log(rules.slice(0, 3).join('\n'));
}
