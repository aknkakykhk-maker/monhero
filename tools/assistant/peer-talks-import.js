// 助手どうしの掛け合いの台本(テキスト)を、data/assistants.js の ASSISTANT_PEER_TALKS の末尾へ足す(2026-11-07 ナカヨシ)。
//   node tools/assistant/peer-talks-import.js <テキスト> [--dry]
// テキストの形(docs/progress/assistant-peer/VOICE.md):
//   ## mua kiki
//   7 any | mua happy {c}、… | kiki wink …
//   10 special | 6行
// id は「ペア(名前順)-Lv」(Lv10 の特別なお話は「ペア-sp2」)。同じ id がもうあれば止める。--dry は足さずに変換結果だけ出す
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const [file, flag] = process.argv.slice(2);
if (!file) { console.error('使い方: node tools/assistant/peer-talks-import.js <テキスト> [--dry]'); process.exit(1); }
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const q = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const out = [];
const errors = [];
let pair = null;
fs.readFileSync(file, 'utf8').split('\n').forEach((raw, i) => {
  const l = raw.trim();
  if (!l || l.startsWith('#!')) return;
  if (l.startsWith('## ')) { pair = l.slice(3).trim().split(/\s+/); if (pair.length !== 2 || !pair.every(id => IDS.includes(id))) errors.push(`${i + 1}行目: ペアが読めない`); return; }
  if (!pair) { errors.push(`${i + 1}行目: ## のペアより前`); return; }
  const parts = l.split(' | ');
  const [lvS, scene] = parts[0].split(/\s+/);
  const lv = Number(lvS);
  const lines = parts.slice(1).map((p) => {
    const m = p.trim().match(/^(\S+) (\S+) (.+)$/);
    if (!m || !pair.includes(m[1]) || !EXPR.includes(m[2]) || m[3].length > 60) { errors.push(`${i + 1}行目: 「${p.slice(0, 30)}」の話す人・表情・長さ`); return null; }
    return { who: m[1], e: m[2], t: m[3] };
  }).filter(Boolean);
  if (!Number.isFinite(lv) || lines.length < 2) { errors.push(`${i + 1}行目: Lv か行数`); return; }
  const key = [...pair].sort().join('-');
  const special = scene === 'special';
  const id = special ? `${key}-sp${lv >= 10 ? 2 : ''}` : `${key}-${lv}`;
  out.push(`  { id:${q(id)}, pair:[${[...pair].sort().map(q).join(', ')}], lv:${lv}, scene:${q(special ? 'home' : scene)}${special ? ', special:true' : ''}, lines:[\n${lines.map(x => `    { who:${q(x.who)}, e:${q(x.e)}, t:${q(x.t)} },`).join('\n')}\n  ] },`);
});
const p = path.join(root, 'monster-hero', 'data', 'assistants.js');
let src = fs.readFileSync(p, 'utf8');
for (const o of out) { const id = o.match(/id:'([^']+)'/)[1]; if (src.includes(`id:'${id}'`)) errors.push(`${id} はもうある`); }
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const start = src.indexOf('const ASSISTANT_PEER_TALKS = Object.freeze([');
const end = src.indexOf('\n]);\n', start);
if (start < 0 || end < 0) { console.error('ASSISTANT_PEER_TALKS が見つからない'); process.exit(1); }
if (flag === '--dry') { console.log(out.join('\n')); console.error(`${out.length}本(足していない)`); process.exit(0); }
src = `${src.slice(0, end)}\n${out.join('\n')}${src.slice(end)}`;
fs.writeFileSync(p, src);
console.log(`${out.length}本を足しました`);
