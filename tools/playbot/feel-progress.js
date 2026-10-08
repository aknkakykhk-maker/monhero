// 反応の点検(feel.js)の進み具合を、動いている全部の組ぶんまとめて1行ずつ出す。
//   node tools/playbot/feel-progress.js            直近6時間に動いた組
//   node tools/playbot/feel-progress.js --hours 3
// 各組は1曲ごとに tools/out/playbot/feel-<日時>-<tag>/progress.json を書く(feel.js)。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', 'out', 'playbot');
const i = process.argv.indexOf('--hours');
const hours = i >= 0 ? Number(process.argv[i + 1]) || 6 : 6;
const t = process.argv.indexOf('--tags');
const tags = t >= 0 ? String(process.argv[t + 1] || '').split(',').filter(Boolean) : null;   // 見る組を決める(省略すると、直近に動いた組を全部)
const rows = [];
for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) {
  if (!d.startsWith('feel-')) continue;
  const f = path.join(root, d, 'progress.json');
  try {
    const p = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (tags && !tags.includes(p.tag)) continue;
    if (Date.now() - Date.parse(p.updatedAt) > hours * 3600 * 1000) continue;
    // 同じ組が何度も動いたときは、いちばん新しいものだけ
    const old = rows.findIndex((r) => r.tag === p.tag);
    if (old < 0) rows.push(p); else if (Date.parse(p.updatedAt) > Date.parse(rows[old].updatedAt)) rows[old] = p;
  } catch { /* 進み具合が無い組は数えない */ }
}
if (!rows.length) { console.log('動いている組が見つからない'); process.exit(0); }
rows.sort((a, b) => String(a.tag).localeCompare(String(b.tag)));
rows.forEach((r) => console.log(r.line + (r.finished >= r.all ? '(終わり)' : '')));
const unfinished = rows.filter((r) => r.finished < r.all && r.eta);
const finished = rows.reduce((a, r) => a + r.finished, 0), all = rows.reduce((a, r) => a + r.all, 0);
const nowJst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(11, 16);
console.log(`全体 ${finished}/${all}曲(${Math.round(finished / all * 100)}%)・いま ${nowJst}${unfinished.length ? `・全部終わる見込み ${unfinished.map((r) => r.eta).sort().pop()}(日本時間)` : '・全部終わり'}`);
