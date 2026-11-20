// 撮影の道具の小さな配り口を、古い版(git のコミット)の画面に切り替える(社長の指摘の較正 tools/browser/president-eye-calibrate.js)。
// SHOT_REV=<コミット> のとき、その版と今とで違うファイルだけ git から読んで配る(作業ツリーを作らない。1つ 3.6GB あるため)。
// 指定が無いときは何もしない(今の作業ツリーのファイルをそのまま配る)。
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const make = (ROOT) => {
  const rev = process.env.SHOT_REV;
  if (!rev) return null;
  const run = (args, opts = {}) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, ...opts });
  const changed = new Set(run(['diff', '--name-only', '--no-renames', rev, '--', 'monster-hero']).toString().split('\n').filter(Boolean));
  const cache = new Map();
  // 配るファイル(ROOT からの相対の道)の中身。違わない物は null(今のファイルを使う)。古い版に無い物は false
  return (rel) => {
    const p = rel.replace(/^\/+/, '').split(path.sep).join('/');
    if (!changed.has(p)) return null;
    if (cache.has(p)) return cache.get(p);
    let buf = false;
    try { buf = run(['show', `${rev}:${p}`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { buf = false; }
    cache.set(p, buf);
    return buf;
  };
};

// http の配り口から呼ぶ: 古い版の中身を返せたら true
const serve = (fromRev, ROOT, file, res, type) => {
  if (!fromRev) return false;
  const buf = fromRev(path.relative(ROOT, file));
  if (buf === null) return false;
  if (buf === false) { res.writeHead(404); res.end(); return true; }
  res.writeHead(200, { 'Content-Type': type || 'application/octet-stream' });
  res.end(buf);
  return true;
};

module.exports = { make, serve };
void fs;
