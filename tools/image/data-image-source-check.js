#!/usr/bin/env node
// 商品・モンスターのデータが、画像を「定数」で指しているかを見る。
//
//   node tools/image/data-image-source-check.js
//
// 【なぜ道具にするか】
// 画像のパスをデータの中へ直接書くと、同じ絵を2か所以上で使ったときに
// 書き写しが増える。片方だけ直すと食い違い、公開してから
// 「片方だけ古い絵のまま」で気づくことになる。
// 2026-09-05の実測では breeder.js に7か所の直書きがあり、
//   ・images/breeder-icons/kiki.PNG が3か所
//   ・images/disc-icons/pandora-disc.PNG が2か所
//   ・undine.PNG / yaobikuni.PNG は images-ally.js に定数があるのに直書き
// という状態だった(円盤石の見え方が商品ごとに食い違っていた一因)。
//
// 定数にまとめておけば、絵を差し替えるときに触るのは1行で済む。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const WEB = path.join(ROOT, 'monster-hero');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const DATA_FILES = ['data/breeder.js', 'data/ally-monsters.js', 'data/enemy-monsters.js'];

// 「定数の宣言」ではなく「データの中身」で画像パスを直接書いている行を探す。
//   const FOO = "images/...";        → よい(定数の宣言)
//   { icon:'images/...' }            → わるい(データの中の直書き)
const inlineRefs = [];
for (const rel of DATA_FILES) {
  const p = path.join(WEB, rel);
  if (!fs.existsSync(p)) continue;
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (/^\s*(?:\/\/|\*)/.test(line)) return;                     // コメントは対象外
    if (/^\s*const\s+[A-Z0-9_]+\s*=\s*["']images\//.test(line)) return; // 定数の宣言はよい
    if (!/["']images\/[^"']+["']/.test(line)) return;
    inlineRefs.push(`${rel}:${i + 1}`);
  });
}
ok('データの中に画像パスを直接書いていない', inlineRefs.length === 0,
  inlineRefs.length ? `${inlineRefs.length}か所: ${inlineRefs.slice(0, 8).join(' / ')}` : '');

// 同じ画像を指す定数が2つ以上ないか(名前だけ違う写しは、片方だけ直る元になる)
const declared = {};
for (const rel of DATA_FILES.concat(['data/images/images-ally.js', 'data/images/images-enemy.js'])) {
  const p = path.join(WEB, rel);
  if (!fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, 'utf8').matchAll(/^const\s+([A-Z0-9_]+)\s*=\s*["'](images\/[^"'?]+)/gm)) {
    (declared[m[2]] = declared[m[2]] || []).push(`${m[1]}(${rel.split('/').pop()})`);
  }
}
const dup = Object.entries(declared).filter(([, names]) => names.length > 1);
ok('同じ画像を指す定数が重複していない', dup.length === 0,
  dup.map(([img, names]) => `${img.split('/').pop()} = ${names.join(' / ')}`).join(' / '));

// --- 商品idの付け方 ---
// マーケットの商品idは、種類ごとに形をそろえる。
//   disc(円盤石)   → モンスターのid そのまま(大文字始まり)  例: Pandora
//   icon(アイコン)  → <なにか>_icon                        例: pandora_icon
//   assist(カード)  → 助手のid                              例: kiki
//   item(道具)      → スネークケース                        例: skip_ticket_jo
//
// 【古いidは直せない】
// 商品idは「持っているアイコン」として端末の保存データへ書き込まれている。
// 名前を変えると、買ったはずのアイコンが消える。だから下の一覧は**そのまま残す**。
// ここで見るのは「これから足すものが形に従っているか」だけ。
const vm = require('vm');
const dataCtx = {};
vm.createContext(dataCtx);
vm.runInContext(
  fs.readFileSync(path.join(WEB, 'data/images/images-ally.js'), 'utf8') + '\n'
  + fs.readFileSync(path.join(WEB, 'data/breeder.js'), 'utf8')
  + "\nglobalThis.__ITEMS = BREEDER_MARKET_ITEMS;", dataCtx);
const marketItems = dataCtx.__ITEMS || [];
ok('マーケットの商品を読めている', marketItems.length > 0, `${marketItems.length}件`);

// 形に従っていない「古くからある」id。保存データに残っているので変えられない。
// ここへ足してよいのは、すでに公開したものだけ。新しく作るものは形に従う
const GRANDFATHERED = new Set([
  // アシストカードのアイコン(_icon が付く前からあるもの)
  'oryo', 'dra', 'cadmium', 'mua', 'atsu', 'myaru', 'mocchi_pet', 'gezudero', 'melopanman',
  // 助手の表情アイコン(みゅあ・きき・ももすけ 各8種)
  ...['myua', 'kiki', 'momosuke'].flatMap(who =>
    ['normal', 'happy', 'wink', 'excited', 'surprise', 'troubled', 'angry', 'crying'].map(e => `${who}_${e}`)),
]);
const shapeOf = {
  disc: id => /^[A-Z][A-Za-z0-9]*$/.test(id),
  icon: id => /_icon$/.test(id),
  assist: id => /^[a-z][a-z0-9_]*$/.test(id),
  item: id => /^[a-z][a-z0-9_]*$/.test(id),
};
const offenders = marketItems.filter(it => {
  if (GRANDFATHERED.has(it.id)) return false;
  const test = shapeOf[it.type];
  return test ? !test(it.id) : false;
});
ok('新しい商品idが種類ごとの形に従っている', offenders.length === 0,
  offenders.map(it => `${it.id}(${it.type})`).join(' / '));
// 一覧に残っている「古いid」が、実際に商品として残っているかも見る。
// 商品を消したのに一覧だけ残ると、次の人が「まだ例外がある」と誤解する
const stale = [...GRANDFATHERED].filter(id => !marketItems.some(it => it.id === id));
ok('古いidの一覧に、もう無い商品が残っていない', stale.length === 0, stale.join(' / '));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
