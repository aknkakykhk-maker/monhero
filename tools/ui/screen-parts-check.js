const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// MonsterHeroGame から切り出した画面部品(parts.json の 51-screen-*.jsx)の型を固定する。
//
//   node tools/ui/screen-parts-check.js
//
// 【なぜ要るか】
// STEP 6 では 13 画面を1つずつ切り出す。1画面目(SETTINGS)で決めた型——
// 「画面は gameState を知らない」「遷移は props で受け取る」——を後の 12 本でも守らないと、
// 画面ファイルが MonsterHeroGame の中身へじわじわ手を伸ばし、切り出した意味が無くなる。
// props の付け忘れ自体は undefined-reference-check が拾うので、ここは型だけを見る。
//
// 【見かた】
// 画面部品ごとに、gameState / setGameState を直接触っていないこと、連結順が 60-app.jsx より前であること、
// 実際に 60-app.jsx から呼ばれていることを確かめる。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, readPartsManifest, PARTS_DIR } = require(path.join(TOOLS_DIR, 'harness'));

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const names = readPartsManifest();
const screens = names.filter((n) => /^\d+-screen-/.test(n) && n !== '40-screen-effects.jsx');
const appIndex = names.indexOf('60-app.jsx');
const app = fs.readFileSync(path.join(PARTS_DIR, '60-app.jsx'), 'utf8');

check('切り出した画面部品がある', screens.length > 0, screens.join(' / '));

for (const name of screens) {
  const src = fs.readFileSync(path.join(PARTS_DIR, name), 'utf8');
  const label = name.replace(/^\d+-screen-|\.jsx$/g, '');
  // コメントは対象外。型を破っているのは実際のコードだけ
  const code = src.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

  check(`${label}: 連結順が 60-app.jsx より前にある`, names.indexOf(name) < appIndex);

  // 1ファイルに複数の画面を置くことがある(図鑑は 一覧・詳細・攻撃プレビューの3つで1組)。
  // 定義したものが全部使われていることまで見る
  const components = [...src.matchAll(/^function ([A-Z][A-Za-z0-9]*)\(/gm)].map((m) => m[1]);
  check(`${label}: 画面コンポーネントを定義している`, components.length > 0, components.join(' / ') || '見つからない');
  const unused = components.filter((c) => !app.includes(`<${c}`));
  check(`${label}: 定義した画面がすべて 60-app.jsx から使われている`, unused.length === 0,
    unused.length ? `使われていない: ${unused.join(' / ')}` : `${components.length}個`);

  // 画面は「自分がどの gameState か」を知らなくてよい。知っていると別の画面へ手が伸びる
  check(`${label}: gameState を直接読まない`, !/\bgameState\b/.test(code));
  // 遷移は props で受け取る。画面が自分で setGameState を呼ぶと、戻り先が画面側の知識になる
  check(`${label}: setGameState を直接呼ばない`, !/\bsetGameState\s*\(/.test(code));
}

console.log(failed === 0 ? '\nすべてOK' : `\nNG ${failed} 件`);
process.exit(failed === 0 ? 0 : 1);
