const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// index.html が読み込む data/*.js のキャッシュキー(?v=)が、いまのファイルの中身と一致しているかを確認する。
//
// 背景: 本体(game-system.compiled.js)のキャッシュキーはGAME_BUILDで毎回更新されるが、
// data/*.js のキーは手書きの固定値だった。data/breeder.js に新しい定義を足しても
// キーが変わらないため、ブラウザは古いbreeder.jsを使い続け、
// 「本体は新しいのにデータが古い」状態で参照エラー → 画面が真っ暗になった。
// tools/stamp-version.js が中身のハッシュへ揃えるようになったので、ここで出荷前に検証する。
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const indexPath = path.join(root, 'monster-hero/index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const tags = [...index.matchAll(/<script src="(data\/[^"?]+\.js)\?v=([^"]*)"/g)];
check('index.htmlがdata/*.jsを読み込んでいる', tags.length > 0, `${tags.length}件`);

for (const [, relPath, key] of tags) {
  const filePath = path.join(root, 'monster-hero', relPath);
  const exists = fs.existsSync(filePath);
  if (!exists) { check(`${relPath} が存在する`, false); continue; }
  const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').slice(0, 12);
  check(`${relPath} のキャッシュキーが中身と一致`, key === hash, key === hash ? key : `index=${key} / 実際=${hash}`);
}

check('本体JSはGAME_BUILDでキャッシュを更新する', /game-system\.compiled\.js\?v=' \+ GAME_BUILD/.test(index));
check('stamp-version.jsが中身のハッシュでキーを打つ', fs.readFileSync(path.join(root, 'tools/stamp-version.js'), 'utf8').includes("createHash('sha256')"));

// 万一データ側が古いままでも画面が真っ暗にならないよう、参照側で既定値へ落とす
check('未定義でも落ちないように参照している',
  source.includes("const SKIP_TICKETS = (typeof SKIP_TICKET_BY_DIFFICULTY !== 'undefined' && SKIP_TICKET_BY_DIFFICULTY) || {};"));
// 生の名前を使ってよいのは、既定値へ落とすこの1行だけ
const rawUses = source.split('\n').filter(line => line.includes('SKIP_TICKET_BY_DIFFICULTY') && !line.includes('const SKIP_TICKETS ='));
check('画面側は直接SKIP_TICKET_BY_DIFFICULTYを参照しない', rawUses.length === 0, rawUses.join(' / '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
