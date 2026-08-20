// 染色の「濃さ(透過率)」を確かめる。
//
// 【なぜ道具にするか】
// 濃さは色id(masu.colors の中身)の末尾へ "@60" のように埋めている。
// 保存データそのものへ手を入れる作りなので、次の2つを外すと取り返しがつかない。
//   ・濃さ100%のときに "@100" を書いてしまうと、これまでの保存値と文字列が変わる
//     (古い版のアプリで開いたときに「知らない色」として色が消える)
//   ・"@" を外さずに色を解決してしまうと、濃さを付けた瞬間に色が「元の色」へ戻る
// どちらも例外は出ず、遊んでいて色が消えて初めて分かる。式だけを取り出して確かめる。
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 色idまわりの式だけを切り出して動かす
const from = source.indexOf('const MASU_COLOR_TARGET');
const to = source.indexOf('// モンスター種ごとの「染色もどき」部位分割データ');
check('色idの式を取り出せる', from >= 0 && to > from);
if (from < 0 || to <= from) { console.log('\n1件のNGがあります'); process.exit(1); }
const ctx = { Math, Number, Object, String };
vm.createContext(ctx);
vm.runInContext(`${source.slice(from, to)};globalThis.api={splitColorAlpha,withColorAlpha,colorAlphaOf,_resolveColorTarget,_parseCustomColorId,getColorSwatchHex,MASU_COLOR_ALPHA_MIN,MASU_COLOR_ALPHA_MAX,MASU_COLOR_TARGET};`, ctx);
const api = ctx.api;
const { splitColorAlpha, withColorAlpha, colorAlphaOf, _resolveColorTarget, MASU_COLOR_ALPHA_MIN, MASU_COLOR_ALPHA_MAX } = api;

// --- 既存データを1文字も変えないこと ---
check('濃さ100%では "@100" を付けない', withColorAlpha('blue', 100) === 'blue', String(withColorAlpha('blue', 100)));
check('上限を超える値でも "@" が付かない', withColorAlpha('blue', 250) === 'blue', String(withColorAlpha('blue', 250)));
check('「元の色」(null)は null のまま', withColorAlpha(null, 40) === null, String(withColorAlpha(null, 40)));
const oldIds = ['blue', 'red_light', 'custom:210:70:70'];
check('古い色idはそのまま濃さ100%として読める',
  oldIds.every(id => colorAlphaOf(id) === MASU_COLOR_ALPHA_MAX && splitColorAlpha(id).base === id));
check('古い色idは書き戻しても文字列が変わらない',
  oldIds.every(id => withColorAlpha(id, colorAlphaOf(id)) === id));

// --- 濃さの読み書き ---
check('濃さを付けて読み戻せる', withColorAlpha('blue', 60) === 'blue@60' && colorAlphaOf('blue@60') === 60);
check('カスタム色にも付けられる',
  withColorAlpha('custom:210:70:70', 45) === 'custom:210:70:70@45' && colorAlphaOf('custom:210:70:70@45') === 45,
  withColorAlpha('custom:210:70:70', 45));
check('濃さを付け替えても二重に付かない', withColorAlpha('blue@60', 30) === 'blue@30', withColorAlpha('blue@60', 30));
check('下限より小さい値は下限に丸める', colorAlphaOf(withColorAlpha('blue', 1)) === MASU_COLOR_ALPHA_MIN,
  `${withColorAlpha('blue', 1)} (下限 ${MASU_COLOR_ALPHA_MIN}%)`);
check('文字列で渡しても数として読む', withColorAlpha('blue', '35') === 'blue@35', String(withColorAlpha('blue', '35')));
check('壊れた濃さは100%として読む(色は消さない)',
  colorAlphaOf('blue@abc') === MASU_COLOR_ALPHA_MAX && splitColorAlpha('blue@abc').base === 'blue@abc');

// --- 濃さが「塗る色」に影響しないこと ---
const sameTarget = (a, b) => JSON.stringify(_resolveColorTarget(a)) === JSON.stringify(_resolveColorTarget(b));
check('プリセットは濃さを付けても同じ色に解決する', sameTarget('blue', 'blue@30'));
check('カスタムも濃さを付けても同じ色に解決する', sameTarget('custom:210:70:70', 'custom:210:70:70@30'));
check('濃さ付きでも「知らない色」にならない',
  Object.keys(api.MASU_COLOR_TARGET).every(id => !!_resolveColorTarget(withColorAlpha(id, 20))));
check('見本の丸も濃さを外して色を出す',
  api.getColorSwatchHex('blue@20') === api.getColorSwatchHex('blue'), api.getColorSwatchHex('blue@20'));

// --- 画面側 ---
const has = (t) => source.includes(t);
check('染色画面に濃さのつまみがある', /min=\{MASU_COLOR_ALPHA_MIN\} max=\{MASU_COLOR_ALPHA_MAX\}/.test(source));
check('つまみは色を選んでいる部位にだけ出す', /\{colors\[idx\]&&<div className="mt-1\.5 flex items-center gap-2">/.test(source));
check('つまみが色idへ濃さを書き戻す', /onChange\(idx,withColorAlpha\(colors\[idx\],e\.target\.value\)\)/.test(source));
check('色を選び直しても濃さを引き継ぐ', /onChange\(idx,withColorAlpha\(colorId,colorAlphaOf\(colors\[idx\]\)\)\)/.test(source));
check('カスタム色を作り直しても濃さを引き継ぐ', /withColorAlpha\(_encodeCustomColorId\(h, s, v\), colorAlphaOf\(next\[idx\]\)\)/.test(source));
// 表示: 重ねる絵の透明度として使っているか
check('部位ごとの重ね絵に濃さを効かせている', /opacity:colorAlphaOf\(colors\[idx\]\)\/100/.test(source));
check('部位分けの無いモンスターにも濃さが効く',
  has('if (recoloredSrc && alpha < MASU_COLOR_ALPHA_MAX)') && /opacity:alpha\/100/.test(source));
// 濃さで絵を作り直さないこと(つまみを動かすたびにCanvas処理が走ると固まる)
check('染め直した絵の置き場所に濃さを含めない', has("const _recoloredKey = (idx, colorId) => idx + '|' + splitColorAlpha(colorId).base;"));
check('絵のキャッシュキーも濃さを外してから作る',
  /const getRecoloredImage = \(imgUrl, rawColorId, baseId, regionIdx\) => \{\s*\n(?:\s*\/\/[^\n]*\n)*\s*const colorId = splitColorAlpha\(rawColorId\)\.base;/.test(source));
// 保存時に濃さを落とさないこと
check('染色もどきを使ったときに濃さごと保存する',
  /const cleaned = \(colors \|\| \[\]\)\.map\(c => \(c && _resolveColorTarget\(c\)\) \? c : null\);/.test(source));

// --- ヘルプ ---
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
check('ヘルプが濃さを説明している', /濃さ/.test(help) && new RegExp(`${MASU_COLOR_ALPHA_MIN}[%％〜~]`).test(help));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
