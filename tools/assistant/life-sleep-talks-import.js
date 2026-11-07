// 助手ライフ: 寝ている助手の寝言・起こされた反応(コトバの台本 kotoba-house.txt の sleep 行)を、
// 56-assistant-life-house.jsx の印のあいだ(ASSISTANT_LIFE_SLEEP_TALKS)へ書き出す。2026-11-07 社長「寝てるのに話したら普通に会話した」
//   node tools/assistant/life-sleep-talks-import.js          書き出す
//   node tools/assistant/life-sleep-talks-import.js --check  書き出し済みと台本が同じか確かめる(違えば NG)
// 1行の形: sleep <人> line=talk|woken [lv=1-4|5-10] | <話す人> <表情> <セリフ> | …
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const SRC = path.join(root, 'docs/progress/assistant-peer/lines/kotoba-house.txt');
const DEST = path.join(root, 'monster-hero/src/parts/56-assistant-life-house.jsx');
const BEGIN = '// <life-sleep-talks:begin>', END = '// <life-sleep-talks:end>';
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const out = [], counts = {};
for (const raw of fs.readFileSync(SRC, 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line.startsWith('sleep ')) continue;
  const [head, ...parts] = line.split('|').map(x => x.trim());
  const w = head.split(/\s+/);
  const who = w[1];
  const keys = Object.fromEntries(w.slice(2).map(x => x.split('=')));
  if (!IDS.includes(who) || !['talk', 'woken'].includes(keys.line)) throw new Error(`読めない行: ${line}`);
  const lines = parts.map(p => { const m = p.match(/^(\S+)\s+(\S+)\s+(.+)$/); if (!m || m[1] !== who || !EXPR.includes(m[2])) throw new Error(`話す人・表情が違う: ${line}`); return { who: m[1], e: m[2], t: m[3] }; });
  counts[who] = (counts[who] || 0) + 1;
  out.push({ id: `life-sleep-${who}-${String(counts[who]).padStart(3, '0')}`, kind: 'life-sleep', who, line: keys.line, lv: keys.lv || null, lines });
}
const js = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const body = [
  BEGIN,
  `// ここは tools/assistant/life-sleep-talks-import.js が書く(手で直さない。台本は docs/progress/assistant-peer/lines/kotoba-house.txt)。${out.length}本`,
  'const ASSISTANT_LIFE_SLEEP_TALKS = Object.freeze([',
  ...out.map(t => `  { id:${js(t.id)}, kind:'life-sleep', who:${js(t.who)}, line:${js(t.line)}, lv:${t.lv ? js(t.lv) : 'null'}, lines:[${t.lines.map(l => `{ who:${js(l.who)}, e:${js(l.e)}, t:${js(l.t)} }`).join(', ')}] },`),
  ']);',
  END,
].join('\n');
const dest = fs.readFileSync(DEST, 'utf8');
const a = dest.indexOf(BEGIN), b = dest.indexOf(END);
if (a < 0 || b < 0) throw new Error('印が見つかりません');
const next = dest.slice(0, a) + body + dest.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== dest) { console.log('NG: 寝言の台本が書き出しと合っていません(node tools/assistant/life-sleep-talks-import.js を流す)'); process.exit(1); }
  console.log(`OK: 寝言・起こされた反応 ${out.length}本が書き出し済み`); process.exit(0);
}
fs.writeFileSync(DEST, next);
console.log(`書き出しました: ${out.length}本(寝言 ${out.filter(t => t.line === 'talk').length}・起こされた ${out.filter(t => t.line === 'woken').length})`);
