// Tier 表のページ(docs/playbot/dashboard/tier.html)を Artifact で出し直したら、その中身の印を残す道具。
// 社長「Tier表、おすすめとかは随時調査の進捗によって更新する仕組みにしてね」(2026-10-10)。
// 研究所が tier.json を直して tier.html を作り直すたびに、統括部長が社長のページ
// (https://claude.ai/artifact/3sUNc2pQgN5f4QdYYW5tW8)へ出し直す。出し直し忘れは president-room.js が
// 「要確認」で知らせる(ここに残した印と、いまの tier.html の印が違うとき)。
//   node tools/playbot/tier-published.js        … いまの tier.html を「出し直した」と記録する
//   node tools/playbot/tier-published.js --check … 出し直しが要るかだけを返す(要るなら終了コード1)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier.html');
const MARK = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier-published.json');

const hashOf = () => crypto.createHash('sha256').update(fs.readFileSync(PAGE)).digest('hex');
const readMark = () => { try { return JSON.parse(fs.readFileSync(MARK, 'utf8')); } catch (e) { return null; } };
const needsPublish = () => { const m = readMark(); return !m || m.sha256 !== hashOf(); };

module.exports = { needsPublish };

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const need = needsPublish();
    console.log(need ? 'Tier 表のページは、まだ社長のページへ出し直していない' : 'Tier 表のページは出し直し済み');
    process.exit(need ? 1 : 0);
  }
  const at = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(0, 16);
  fs.writeFileSync(MARK, JSON.stringify({ sha256: hashOf(), 出し直した日時: at }, null, 1) + '\n');
  console.log('記録した: Tier 表のページを ' + at + ' に出し直した');
}
