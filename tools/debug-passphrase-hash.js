// デバッグ設定の合言葉のハッシュを作る(2026-10-20 社長決定・改善部の見直し M1)。
//
//   node tools/debug-passphrase-hash.js <合言葉>
//
// リポジトリは公開なので、合言葉の文字はソース・コミット・PR・報告書に書かない。ここで作った塩とハッシュだけを
// monster-hero/src/parts/25-storage.jsx の DEBUG_PASSPHRASE_SALT / DEBUG_PASSPHRASE_HASH へ書く。
// 合言葉が短い(数字8桁)ので、ただの SHA-256 では公開のハッシュから総当たりで割れる。
// 塩(ランダムな固定値)+ PBKDF2(SHA-256・DEBUG_PASSPHRASE_ITERATIONS 回)にして、1回照らすのに時間がかかるようにする
// (端末で1回0.3〜0.5秒ほど)。画面では Web Crypto の crypto.subtle で同じ計算をする
const crypto = require('crypto');
const ITERATIONS = 600000;
const phrase = process.argv.slice(2).join(' ').trim();
if (!phrase) { console.log('使い方: node tools/debug-passphrase-hash.js <合言葉>'); process.exit(1); }
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(Buffer.from(phrase, 'utf8'), Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256').toString('hex');
console.log(JSON.stringify({ salt, iterations: ITERATIONS, hash }));
