#!/usr/bin/env node
// 配信用の Tailwind CSS を作る。
//
//   node tools/build-tailwind.js            … 中身が変わっていれば作り直す
//   node tools/build-tailwind.js --force    … 必ず作り直す
//   node tools/build-tailwind.js --check    … 作らず、いまの tailwind.css が最新かだけ見る
//   → monster-hero/tailwind.css
//
// 【なぜ要るか】
// 以前は index.html が https://cdn.tailwindcss.com を読み、**ブラウザの中でCSSを作っていた**
// (docs/refactor/TECH_DEBT_AUDIT.md TD-13)。起動のたびに
// 「スクリプトを取りに行く → ソースを走査する → CSSを組み立てる」の3つが走り、
// CDNが落ちれば見た目が全部崩れる。作っておけば1ファイル読むだけで済む。
//
// 切り替えられることは事前に数えて確かめた(欠けるクラス0件・111KB)。
// 調査の記録は docs/refactor/TAILWIND_STATIC_REPORT.md。
//
// 【landscape: の差し替えについて】
// 自前で画面を回しているとき(端末が向きの指定を受け付けない端末のための逃げ道)は、
// 端末そのものは縦のままなので @media (orientation: landscape) が成立せず、
// landscape: がひとつも効かない。横長の器に縦持ち用の並びが入って一覧がほぼ消える。
// 以前は index.html の tailwind.config でこれを差し替えていたので、同じものをここへ移した。
//
// 【古くなっていないかの見張り方】
// tailwindcss は optionalDependencies なので CI(npm ci --omit=optional)には入らない。
// CI では作り直せないので、**元になった中身の指紋をCSSの1行目へ書いておき**、
// それが今のソースと一致するかだけを見る(node tools/build.js --check が呼ぶ)。
// 指紋からは「毎回必ず変わるもの」を外してある。外さないと、中身が1文字も変わっていなくても
// ビルドのたびに作り直すことになる(7秒かかる)。外しているのは次の2つ。
//   ・BUILD_DATE の値(ビルドのたびに変わる。Tailwind のクラス名ではない)
//   ・?v=<ハッシュ> のキャッシュキー(絵や音源を差し替えると変わる。これもクラス名ではない)
//   ・game-system.jsx の先頭にある generated-sha256(BUILD_DATE を打ち直すだけでも変わる)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'monster-hero', 'tailwind.css');
const WORK = path.join(__dirname, '.tailwind-build');
const CONFIG = path.join(WORK, 'config.js');
const INPUT = path.join(WORK, 'input.css');
const BIN = path.join(ROOT, 'tools', 'node_modules', '.bin', 'tailwindcss');
const MARK = 'tailwind-source';

// Tailwind が走査する対象。index.html は自前CSSしか使っていないので入れない
const GAME_SYSTEM = path.join(ROOT, 'monster-hero', 'src', 'game-system.jsx');
const DATA_DIR = path.join(ROOT, 'monster-hero', 'data');

// 設定の本文には**絶対パスを書かない**。書くとリポジトリの置き場所ごとに指紋が変わり、
// CI(/home/runner/work/…)と手元(/home/user/…)で食い違って「古い」と誤判定する
// (実際に GitHub Actions でだけ build.js --check が落ちた)。
// 置き場所は設定ファイル自身の位置(tools/.tailwind-build/)から数える。
const CONFIG_SOURCE = `const path = require('path');
const plugin = require('tailwindcss/plugin');
const ROOT = path.resolve(__dirname, '..', '..');
module.exports = {
  content: [path.join(ROOT, 'monster-hero', 'src', 'game-system.jsx'),
            path.join(ROOT, 'monster-hero', 'data', '*.js')],
  theme: { extend: {} },
  plugins: [
    // index.html の tailwind.config から移した。既存の書き方(landscape:mt-0 など)はそのまま使える
    plugin(function ({ addVariant }) {
      addVariant('landscape', [
        '@media (orientation: landscape)',
        '&:is([data-mh-view-rotation="true"] *)',
      ]);
    }),
  ],
};
`;

// ビルドのたびに必ず変わる値を落とす。ここに残すと中身が同じでも指紋だけが動く
const normalize = (text) => text
  .replace(/const BUILD_DATE = "[^"]*";/g, 'const BUILD_DATE = "";')
  .replace(/\?v=[0-9a-f]{6,}/g, '?v=')
  // game-system.jsx の先頭には parts の連結ハッシュが書いてある。BUILD_DATE を打ち直すだけでも変わる
  .replace(/generated-sha256:\s*[0-9a-f]+/g, 'generated-sha256:');

function contentFiles() {
  const files = [GAME_SYSTEM];
  for (const name of fs.readdirSync(DATA_DIR).filter((n) => n.endsWith('.js')).sort()) {
    files.push(path.join(DATA_DIR, name));
  }
  return files;
}

function fingerprint() {
  const h = crypto.createHash('sha256');
  h.update(CONFIG_SOURCE);
  for (const file of contentFiles()) {
    h.update(path.basename(file));
    h.update(normalize(fs.readFileSync(file, 'utf8')));
  }
  return h.digest('hex').slice(0, 16);
}

function embeddedFingerprint() {
  if (!fs.existsSync(OUT)) return null;
  const head = fs.readFileSync(OUT, 'utf8').slice(0, 200);
  const m = head.match(new RegExp(`${MARK}:\\s*([0-9a-f]+)`));
  return m ? m[1] : null;
}

// 作り直す。tailwindcss が入っていないときは null を返す(呼び出し側が判断する)
function generate(fp) {
  if (!fs.existsSync(BIN)) return null;
  fs.mkdirSync(WORK, { recursive: true });
  fs.writeFileSync(CONFIG, CONFIG_SOURCE);
  fs.writeFileSync(INPUT, '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  execFileSync(BIN, ['-c', CONFIG, '-i', INPUT, '-o', OUT, '--minify'], { stdio: ['ignore', 'ignore', 'inherit'] });
  const css = fs.readFileSync(OUT, 'utf8');
  fs.writeFileSync(OUT, `/*! ${MARK}: ${fp} — tools/build-tailwind.js が作った生成物。直接編集しないこと */\n${css}`);
  return fs.statSync(OUT).size;
}

// build.js から呼ぶ。中身が変わっていなければ何もしない
function buildTailwindIfNeeded() {
  const fp = fingerprint();
  if (embeddedFingerprint() === fp) return { changed: false, fingerprint: fp };
  const size = generate(fp);
  if (size === null) return { changed: false, fingerprint: fp, missingTool: true, stale: true };
  return { changed: true, fingerprint: fp, size };
}

// build.js --check と CI から呼ぶ。作り直さずに古くないかだけ見る
function checkTailwind() {
  if (!fs.existsSync(OUT)) return { ok: false, reason: 'monster-hero/tailwind.css がありません' };
  const fp = fingerprint();
  const embedded = embeddedFingerprint();
  if (!embedded) return { ok: false, reason: 'tailwind.css に元の中身の指紋がありません' };
  if (embedded !== fp) return { ok: false, reason: `tailwind.css が古いです(css=${embedded} / いまのソース=${fp})` };
  return { ok: true, fingerprint: fp };
}

module.exports = { buildTailwindIfNeeded, checkTailwind, fingerprint, OUT, CONFIG_SOURCE };

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const r = checkTailwind();
    console.log(r.ok ? `OK: tailwind.css は最新です(${r.fingerprint})` : `NG: ${r.reason}`);
    if (!r.ok) console.log('   node tools/build.js を実行してください');
    process.exit(r.ok ? 0 : 1);
  }
  const force = process.argv.includes('--force');
  const fp = fingerprint();
  if (!force && embeddedFingerprint() === fp) {
    console.log(`変更なし: monster-hero/tailwind.css は最新です(${fp})`);
    process.exit(0);
  }
  const size = generate(fp);
  if (size === null) {
    console.error('NG: tailwindcss が入っていません(cd tools && npm install で入ります)');
    process.exit(1);
  }
  console.log(`書き出しました: monster-hero/tailwind.css (${Math.round(size / 1024)} KB / ${fp})`);
  console.log('このあと node tools/build.js を通して、index.html のキャッシュキーを更新すること');
}
