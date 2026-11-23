#!/usr/bin/env node
// モンヒロビートの歌詞カード: 歌詞があるのに出ない曲がないか(全曲)。
//
//   node tools/mode/rhythm-lyric-cards-check.js
//
// 【なぜ要るか】(2026-11-23 r1119-150 社長「もも曲も歌詞いれたのにでてない」)
// 歌詞カードは data/rhythm-mode.js の RHYTHM_SONG_LYRIC_CARDS に曲ごとに書いた物だけが出る。
// 「きみ待ち♡ループ」は社長から歌詞カードの絵(docs/progress/beat/event-flower3/assets/momo-kimimachi-loop-lyrics.png)が
// 届いていたのに、ここへの登録と images/song-lyrics/ への配置が抜けていて、詳細の窓に出なかった。
// 次の4つを確かめる。
//   1. 登録した曲が本当にある曲か(songId の書き違いだと黙って出ない)
//   2. 登録した絵のファイルが images/song-lyrics/ に実際にあるか
//   3. images/song-lyrics/ に置いたのに、どの曲にも登録していない絵がないか
//   4. 受け取った歌詞カードの元絵(docs/progress・tools/art-sources の名前に lyrics / 歌詞 を含む絵)の曲や、
//      曲のデータに「歌詞カードあり」と書いた曲が、登録から漏れていないか
//      (元絵の名前に曲の songId を - か _ でつないだ形が入っていれば、その曲の歌詞とみなす)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA = path.join(ROOT, 'monster-hero', 'data', 'rhythm-mode.js');
const LYRIC_DIR = path.join(ROOT, 'monster-hero', 'images', 'song-lyrics');
// 歌詞カードの元絵として見なくてよい物(確かめ用の止め絵など)。名前の一部で書く
const NOT_SOURCE = [/^lyrics-\d-/, /president-/];

const problems = [];
const src = fs.readFileSync(DATA, 'utf8');

// 曲の一覧(songId)。確かめ用(_debug)と短い版(_short)は元の曲のカードを使うので、元の名前でも数える
const songIds = new Set([...src.matchAll(/songId:'([a-z0-9_]+)'/g)].map((m) => m[1]));
const baseIds = new Set([...songIds].map((id) => id.replace(/_hell_debug$/, '').replace(/_short$/, '')));

// 登録の表
const start = src.indexOf('const RHYTHM_SONG_LYRIC_CARDS=Object.freeze({');
const end = start >= 0 ? src.indexOf('});', start) : -1;
if (start < 0 || end < 0) {
  console.log('NG: RHYTHM_SONG_LYRIC_CARDS が見つからない');
  process.exit(1);
}
const block = src.slice(start, end);
const registered = new Map();
for (const m of block.matchAll(/^\s*([a-z0-9_]+):Object\.freeze\(\[([^\]]*)\]\)/gm)) {
  registered.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

// 1・2
for (const [id, files] of registered) {
  if (!songIds.has(id)) problems.push(`登録した曲 ${id} が曲の一覧に無い(書き違い?)`);
  if (!files.length) problems.push(`${id}: 絵が1枚も書かれていない`);
  for (const f of files) {
    const rel = f.split('?')[0];
    if (!rel.startsWith('images/song-lyrics/')) problems.push(`${id}: ${rel} が images/song-lyrics/ の外`);
    if (!fs.existsSync(path.join(ROOT, 'monster-hero', rel))) problems.push(`${id}: ${rel} のファイルが無い`);
  }
}

// 3
const used = new Set([...registered.values()].flat().map((f) => path.basename(f.split('?')[0])));
for (const f of fs.existsSync(LYRIC_DIR) ? fs.readdirSync(LYRIC_DIR) : []) {
  if (/\.(jpe?g|png|webp)$/i.test(f) && !used.has(f)) problems.push(`images/song-lyrics/${f} がどの曲にも登録されていない`);
}

// 4-a 受け取った元絵
const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png|webp)$/i.test(e.name) && /lyric|歌詞/i.test(e.name) && !NOT_SOURCE.some((re) => re.test(e.name))) out.push(p);
  }
  return out;
};
const sources = [...walk(path.join(ROOT, 'docs', 'progress')), ...walk(path.join(ROOT, 'tools', 'art-sources'))];
// 長い songId から当てる(kimimachi_loop を kimimachi より先に)
const idsByLen = [...baseIds].sort((a, b) => b.length - a.length);
let matched = 0;
for (const p of sources) {
  const name = path.basename(p).toLowerCase();
  const id = idsByLen.find((sid) => sid.length >= 4 && (name.includes(sid) || name.includes(sid.replace(/_/g, '-'))));
  if (!id) continue;
  matched++;
  if (!registered.has(id)) problems.push(`歌詞カードの元絵 ${path.relative(ROOT, p)} があるのに、曲 ${id} が RHYTHM_SONG_LYRIC_CARDS に無い`);
}

// 4-b 曲のデータに「歌詞カードあり」と書いた曲
const entryRe = /songId:'([a-z0-9_]+)'[\s\S]{0,600}?difficulties:/g;
for (const m of src.matchAll(entryRe)) {
  const id = m[1].replace(/_hell_debug$/, '').replace(/_short$/, '');
  if (/歌詞カードあり/.test(m[0]) && !registered.has(id)) problems.push(`曲 ${m[1]} は「歌詞カードあり」と書いてあるのに RHYTHM_SONG_LYRIC_CARDS に無い`);
}

if (problems.length) {
  for (const p of problems.slice(0, 20)) console.log(`NG: ${p}`);
  console.log(`NG ${problems.length} 件(歌詞カードの登録 ${registered.size} 曲・元絵 ${sources.length} 枚)`);
  process.exit(1);
}
console.log(`OK: 歌詞カード ${registered.size} 曲(${[...registered.keys()].join(', ')})・元絵 ${sources.length} 枚(曲に当たった ${matched} 枚)・漏れなし`);
