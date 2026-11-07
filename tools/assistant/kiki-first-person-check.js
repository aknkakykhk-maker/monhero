// 助手ききの一人称を見張る(2026-11-07)。
//
// 2026-11-07・社長「パンドラのイベントでききがじぶんをわたくしと言っていた。ききは私だよ」。
// ききの一人称は「私」。会話(who:'kiki')のセリフに、ほかの一人称が混ざっていないかを見る。
// ブラウザは使わない。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistants.js');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const kiki = [];
lines.forEach((line, i) => {
  if (!/who:\s*'kiki'/.test(line)) return;
  const t = line.match(/\bt:\s*'([^']*)'/);
  if (t) kiki.push({ n: i + 1, t: t[1] });
});

const OTHER = /わたくし|あたし|わたし|ぼく|僕|俺|おで|ワイ|吾輩|拙者/;
// 相手の言葉をそのまま繰り返している所(ききの一人称ではない)
const QUOTED = new Set(['ぼくの音、でつか。']);
const bad = kiki.filter(l => OTHER.test(l.t) && !QUOTED.has(l.t));
check('ききのセリフを読めた', kiki.length >= 50, `${kiki.length}本`);
check('ききの一人称に「私」以外(わたくし・あたし・わたし・ぼく・俺 など)が混ざらない', bad.length === 0,
  bad.slice(0, 3).map(l => `${l.n}行: ${l.t}`).join(' / '));
check('ききは一人称「私」を使っている', kiki.filter(l => /私/.test(l.t)).length >= 5);

if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nききの一人称: OK');
