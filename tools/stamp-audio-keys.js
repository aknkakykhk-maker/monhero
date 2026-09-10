#!/usr/bin/env node
// 音源(audio/*.mp3)のキャッシュキーを、中身のハッシュから書き直す。
//
//   node tools/stamp-audio-keys.js          … 書き直す
//   node tools/stamp-audio-keys.js --check  … 書き直さず、古くなっていないかだけ見る
//
// 【なぜ要るか】(2026-09-10・ユーザー指摘「禁断のレジスタンスまだ音小さい /
//  ほんとに音量調整した？」)
// 音量をそろえて mp3 を差し替えたのに、端末では**古い音のまま**鳴っていた。
// 音源を読む loadBuffer は fetch(url,{cache:'force-cache'}) を使う。これは
// 「キャッシュにあれば**期限が切れていても**それを使う」という指定なので、
// URLが同じままだと中身を入れ替えても新しい音源を取りに行かない。
// 一度でもその曲を聴いた端末は、**ずっと古い音のまま**になる。
//
// 画像は stamp-version.js が data/*.js の中で ?v=<ハッシュ> を付けている。
// 音源も同じ考え方にするが、**BGM_TRACKS の src は素のパスのままにする**
// (src の文字列はいくつもの検査が丸ごと突き合わせているため)。
// かわりに parts/14-audio.jsx の <audio-cache-keys> の中へ表を作り、
// 読むときだけ audioUrlWithKey() がキーを足す。
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const AUDIO_DIR = path.join(ROOT, 'monster-hero/audio');
const PART = path.join(ROOT, 'monster-hero/src/parts/14-audio.jsx');
const BEGIN = '// <audio-cache-keys>';
const END = '// </audio-cache-keys>';

const buildBlock = () => {
  const files = fs.readdirSync(AUDIO_DIR).filter(name => name.toLowerCase().endsWith('.mp3')).sort();
  const lines = files.map(name => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(AUDIO_DIR, name))).digest('hex').slice(0, 12);
    // 曲名に日本語や記号が入るので、キーは必ずクォートで囲む
    return `    ${JSON.stringify(`audio/${name}`)}: ${JSON.stringify(hash)},`;
  });
  return { text: lines.join('\n'), count: files.length };
};

const replaceBlock = (source, body) => {
  const from = source.indexOf(BEGIN);
  const to = source.indexOf(END);
  if (from < 0 || to < from) {
    console.error(`NG: ${path.relative(ROOT, PART)} に ${BEGIN} … ${END} がありません`);
    process.exit(1);
  }
  return `${source.slice(0, from + BEGIN.length)}\n${body}\n${source.slice(to)}`;
};

const source = fs.readFileSync(PART, 'utf8');
const { text, count } = buildBlock();
const next = replaceBlock(source, text);

if (process.argv.includes('--check')) {
  if (next !== source) {
    console.error('NG: 音源のキャッシュキーが古いです。node tools/build.js を実行してください');
    console.error('  (音源を差し替えたのにキーがそのままだと、端末に古い音が残り続けます)');
    process.exit(1);
  }
  console.log(`OK: 音源のキャッシュキーは中身と一致しています（${count}件）`);
  process.exit(0);
}

const changed = next !== source;
if (changed) fs.writeFileSync(PART, next);
module.exports = { changed, count };
if (require.main === module) {
  console.log(`音源のキャッシュキー: ${count}件${changed ? '（書き直しました）' : '（変更なし）'}`);
}
