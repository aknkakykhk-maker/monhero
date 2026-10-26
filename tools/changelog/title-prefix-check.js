// 更新履歴の題の頭に、遊びの名前(「MFバトルカード: 」「モンヒロビート：」など)が付いていないかを見る。
//
//   node tools/changelog/title-prefix-check.js
//
// 【なぜ要るか】(2026-10-27 社長「更新履歴の題の頭に遊びの名前を付けない」)
// 一覧はまとまり(🃏 MFバトルカード・🎵 モンヒロビート など)の見出しの下に並ぶので、頭の名前は二重になる。
// すでに出ていた239件は頭だけ外した。そのとき既読が外れないよう、元の題を idTitle に残している
// (id は idTitle から作る。17-release-changelog-login-missions.jsx の changelogEntryId)。
//
// 見ること:
//   ・title の頭が「遊びの名前 + :/：」になっていない
//   ・idTitle を持つ項目は、id を元の題から作っている(本体がidTitleを読んでいる)
//   ・idTitle は title と違う(同じなら要らない)・idTitle どうしが重ならない
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const part = fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const g = {};
new Function('globalThis', src.replace(/^\s*const CHANGELOG\b/m, 'globalThis.CHANGELOG'))(g);
const list = Array.isArray(g.CHANGELOG) ? g.CHANGELOG : [];
check('更新履歴を読めた', list.length > 100, `${list.length}件`);

// 遊びの名前。新しい遊びができたらここへ足す
const GAMES = ['MFバトルカード', 'モンヒロビート', 'モンヒロバトル', 'タクティクスバトル', 'タクティクス', 'バトル', 'クイック', 'モンビー', '音ゲー'];
const PREFIX = new RegExp(`^\\s*【?(${GAMES.join('|')})】?\\s*[：:]`);
const bad = list.filter((e) => PREFIX.test(String(e.title || '')));
check('題の頭に遊びの名前が付いていない', bad.length === 0, bad.slice(0, 3).map((e) => `${e.date}「${e.title}」`).join(' / ') + (bad.length ? `(${bad.length}件。頭を外し、出ていた項目なら元の題を idTitle へ残す)` : ''));

const kept = list.filter((e) => typeof e.idTitle === 'string');
check('id は元の題(idTitle)から作っている', part.includes('entry.idTitle || entry.title'));
check('idTitle は title と違う', kept.every((e) => e.idTitle !== e.title), kept.filter((e) => e.idTitle === e.title).map((e) => e.title).slice(0, 3).join(' / '));
const seen = new Set(), twice = kept.filter((e) => { const k = `${e.type}\u001f${e.idTitle}`; if (seen.has(k)) return true; seen.add(k); return false; });
check('idTitle どうしが重ならない', twice.length === 0, twice.map((e) => e.idTitle).join(' / '));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
