// 助手ライフ: 人間らしい関係の出来事(けんか・仲直り・やきもちなど)の台本を、
// 56-assistant-life-rel.jsx の印のあいだ(ASSISTANT_LIFE_REL_TALKS)へ書き出す。2026-11-07 社長「助手同士の関係で喧嘩とか仲直りとかそういう人間じみたのもどんどんいれてね」
//   node tools/assistant/life-rel-talks-import.js          書き出す
//   node tools/assistant/life-rel-talks-import.js --check  書き出し済みと台本が同じか確かめる(違えば NG)
// 台本: docs/progress/assistant-peer/lines/kotoba-house.txt・tsumugi-house.txt(注文 ORDER-HOUSE.md)。読む種類と形:
//   fight <a> <b> cause=…   | 言い合い || 距離をおく || 仲直り
//   mend <a> <b> how=apology|gift|player | …
//   mend3 <間に入る人> <a> <b> | …
//   jealous <見ている人> <a> <b> lv=4-6|7-10 | …
//   secret <a> <b> | … / consult <相談する人> <乗る人> mood=… | … / tease <からかう人> <照れる人> | …
//   rival <a> <b> game=beat|card | … / awkward <a> <b> | …
// 1つの区切りは「<話す人> <表情> <セリフ>」。trio・quad・home・rhythm・owl・sleep はここでは読まない(別の道具)
'use strict';
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const SRCS = ['kotoba-house.txt', 'tsumugi-house.txt'].map(f => path.join(root, 'docs/progress/assistant-peer/lines', f));
const DEST = path.join(root, 'monster-hero/src/parts/56-assistant-life-rel.jsx');
const BEGIN = '// <life-rel-talks:begin>', END = '// <life-rel-talks:end>';
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
// 種類ごとの「人」の数と、鍵の決まり
const KINDS = {
  fight: { n: 2, keys: { cause: ['tidy', 'snack', 'song', 'win', 'late', 'promise'] } },
  mend: { n: 2, keys: { how: ['apology', 'gift', 'player'] } },
  mend3: { n: 3, keys: {} },
  jealous: { n: 3, keys: { lv: ['4-6', '7-10'] } },
  secret: { n: 2, keys: {} },
  consult: { n: 2, keys: { mood: ['lonely', 'sulky', 'restless'] } },
  tease: { n: 2, keys: {} },
  rival: { n: 2, keys: { game: ['beat', 'card'] } },
  awkward: { n: 2, keys: {} },
};
const bad = (line, why) => { throw new Error(`${why}: ${line.slice(0, 120)}`); };
const parseRows = (s, ppl, line) => s.split('|').map(x => x.trim()).filter(Boolean).map(p => {
  const m = p.match(/^(\S+)\s+(\S+)\s+(.+)$/);
  if (!m) bad(line, '区切りの形が違う');
  if (!ppl.includes(m[1])) bad(line, `出てこない人が話している(${m[1]})`);
  if (!EXPR.includes(m[2])) bad(line, `表情が違う(${m[2]})`);
  for (const c of m[3].matchAll(/\{c:([a-z]+)\}/g)) if (!ppl.includes(c[1]) || c[1] === m[1]) bad(line, `{c:${c[1]}} の相手が違う`);
  if (ppl.length > 2 && /\{c\}/.test(m[3])) bad(line, '3人の台本で {c} を使っている({c:id} にする)');
  if (/ブリーダー(さん)?(?!Lv|P|ランク|経験|の教え)/.test(m[3])) bad(line, 'プレイヤーは {name} で書く');
  return { who: m[1], e: m[2], t: m[3] };
});
const out = [], counts = {};
for (const src of SRCS) {
  for (const raw of fs.readFileSync(src, 'utf8').split('\n')) {
    const line = raw.trim();
    const kind = line.split(/\s+/)[0];
    if (!KINDS[kind]) continue;
    const def = KINDS[kind];
    const cut = line.indexOf('|');
    if (cut < 0) bad(line, '台詞がない');
    const head = line.slice(0, cut).trim().split(/\s+/);
    const ppl = head.slice(1, 1 + def.n);
    if (ppl.length !== def.n || !ppl.every(id => IDS.includes(id)) || new Set(ppl).size !== def.n) bad(line, '人の並びが違う');
    const keys = {};
    for (const kv of head.slice(1 + def.n)) {
      const [k, v] = kv.split('=');
      if (!def.keys[k] || !def.keys[k].includes(v)) bad(line, `鍵が違う(${kv})`);
      keys[k] = v;
    }
    for (const k of Object.keys(def.keys)) if (kind !== 'jealous' && !keys[k]) bad(line, `鍵 ${k} がない`);
    const body = line.slice(cut + 1);
    const t = { kind, ppl, keys };
    if (kind === 'fight') {
      const secs = body.split('||');
      if (secs.length !== 3) bad(line, '言い合い || 距離 || 仲直り の3つに分かれていない');
      [t.lines, t.distance, t.makeup] = secs.map(s => parseRows(s, ppl, line));
      if (!t.lines.length || !t.makeup.length) bad(line, '言い合いか仲直りが空');
    } else t.lines = parseRows(body, ppl, line);
    // 2人の種類は、だれもが1回は話す(ひとりだけの掛け合いにしない)
    if (def.n === 2 && !ppl.every(id => [...t.lines, ...(t.makeup || [])].some(l => l.who === id))) bad(line, '話さない人がいる');
    const ck = `${kind}-${ppl.join('-')}`;
    counts[ck] = (counts[ck] || 0) + 1;
    t.id = `rel-${ck}-${counts[ck]}`;
    out.push(t);
  }
}
const js = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const rows = (a) => `[${a.map(l => `{ who:${js(l.who)}, e:${js(l.e)}, t:${js(l.t)} }`).join(', ')}]`;
const tally = Object.entries(out.reduce((m, t) => ((m[t.kind] = (m[t.kind] || 0) + 1), m), {})).map(([k, n]) => `${k} ${n}`).join('・');
const body = [
  BEGIN,
  `// ここは tools/assistant/life-rel-talks-import.js が書く(手で直さない。台本は docs/progress/assistant-peer/lines/kotoba-house.txt・tsumugi-house.txt)。${out.length}本(${tally})`,
  'const ASSISTANT_LIFE_REL_TALKS = Object.freeze([',
  ...out.map(t => `  { id:${js(t.id)}, kind:${js(t.kind)}, ppl:[${t.ppl.map(js).join(', ')}], keys:{ ${Object.entries(t.keys).map(([k, v]) => `${k}:${js(v)}`).join(', ')} }, lines:${rows(t.lines)}${t.distance ? `, distance:${rows(t.distance)}, makeup:${rows(t.makeup)}` : ''} },`),
  ']);',
  END,
].join('\n');
const dest = fs.readFileSync(DEST, 'utf8');
const a = dest.indexOf(BEGIN), b = dest.indexOf(END);
if (a < 0 || b < 0) throw new Error('印が見つかりません');
const next = dest.slice(0, a) + body + dest.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== dest) { console.log('NG: 関係の出来事の台本が書き出しと合っていません(node tools/assistant/life-rel-talks-import.js を流す)'); process.exit(1); }
  console.log(`OK: 関係の出来事の台本 ${out.length}本(${tally})は書き出しと同じ`);
} else {
  fs.writeFileSync(DEST, next);
  console.log(`書き出しました: ${out.length}本(${tally})`);
}
