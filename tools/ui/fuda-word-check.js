// 画面に出る文に「札」を使っていないか見る(2026-11-15 社長「よくこの札って単語出るけどちゃんと適した用語になってる?」)。
//
//   node tools/ui/fuda-word-check.js
//
// 「札」は開発の中の呼び名で、遊ぶ人には何を指すか伝わらない。画面の文・助手の台詞・ヘルプでは
// 指す物ごとの言葉にする(大会の案内・技のカード・ラベル・表示・ボタン・欄など)。TERMS.md「札は画面の文で使わない」。
// 見ない物: コメント・識別子・CSS・過去の更新履歴(changelog.js)・カードゲームの決まった言葉
// (手札・山札・捨て札・切り札(切札)・名札・値札・改札・荷札・表札・千札・入札)。
//
// 直し終わっていない場所は PENDING に入れておく(直したら外す。空になるまで減らす)。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const SKIP_FILES = new Set(['changelog.js', 'assistant-chat-digest.json']);
const PENDING = new Set(['help.js', '56-assistant-life-map.jsx', '56-assistant-masmon-battle-beta.jsx', '60-app.jsx', '82-card-tactics-core.jsx', '94-card-spectate.jsx', 'assistants.js']);
const COMPOUND = /(手|山|捨て|切り?|名|改|荷|表|千|入|礼|値)札/g;

const files = [];
for (const d of ['monster-hero/src/parts', 'monster-hero/data']) {
  for (const f of fs.readdirSync(path.join(root, d))) {
    if (/\.(jsx|js)$/.test(f) && !SKIP_FILES.has(f)) files.push(path.join(d, f));
  }
}

const hits = [];
for (const rel of files) {
  const name = path.basename(rel);
  let t = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!t.includes('札')) continue;
  t = t.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  t.split('\n').forEach((ln, i) => {
    const s = ln.replace(/(^|[^:'"`\\])\/\/.*$/, '$1').replace(COMPOUND, '');
    if (s.includes('札')) hits.push({ rel, name, line: i + 1, text: ln.trim() });
  });
}

const blocked = hits.filter(h => !PENDING.has(h.name));
const pendingN = hits.length - blocked.length;
if (!blocked.length) {
  console.log(`OK: 画面の文に「札」が無い${pendingN ? `(直し待ち ${pendingN}行・PENDING の場所)` : ''}`);
  process.exit(0);
}
console.log(`NG: 画面の文に「札」が ${blocked.length} 行ある(指す物ごとの言葉に: docs/rules/TERMS.md)`);
for (const h of blocked.slice(0, 20)) {
  const k = h.text.indexOf('札');
  console.log(`  ${h.rel}:${h.line}  …${h.text.slice(Math.max(0, k - 24), k + 24)}…`);
}
if (blocked.length > 20) console.log(`  ほか ${blocked.length - 20} 行`);
process.exit(1);
