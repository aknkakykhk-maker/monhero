#!/usr/bin/env node
// 助手とのセッションの台詞(docs/progress/beat-assistant-session/lines/*.txt)を、ゲームの部品
// monster-hero/src/parts/33-rhythm-assistant-session-lines.jsx へ取り込む(2026-11-07 ビート部マモリ)。
//
//   node tools/mode/rhythm-assistant-session-lines-import.js          … txt から部品を書き直す
//   node tools/mode/rhythm-assistant-session-lines-import.js --check  … 部品が txt と同じかだけを見る(違えば NG)
//
// 台詞の正本は txt(コトバ・ナカヨシの見直しは txt に入れる)。部品は手で直さない。
//   solo-draft.txt: 「場面 | 話す人 表情 セリフ」。## <助手id> の見出しの下に並べる
//   pair-draft.txt: 「場面 | 話す人 表情 セリフ | 話す人 表情 セリフ」。## <助手id> <助手id> の見出しの下に並べる。相手の呼び方は {c}
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'docs/progress/beat-assistant-session/lines');
const OUT = path.join(ROOT, 'monster-hero/src/parts/33-rhythm-assistant-session-lines.jsx');
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const SOLO_SCENES = ['join', 'first', 'like', 'dislike', 'combo', 'miss', 'climax', 'last', 'mvp', 'high', 'mid', 'low', 'fc', 'levelup', 'likeup', 'overcome'];
const PAIR_SCENES = ['play', 'result', 'gattai'];

const errors = [];
const parseLine = (part, where) => {
  const m = /^([a-z]+) ([a-z]+) (.+)$/.exec(part.trim());
  if (!m) { errors.push(`${where}: 「話す人 表情 セリフ」の形でない — ${part}`); return null; }
  const [, who, expr, text] = m;
  if (!IDS.includes(who)) errors.push(`${where}: 知らない助手 ${who}`);
  if (!EXPR.includes(expr)) errors.push(`${where}: 知らない表情 ${expr}`);
  if (/[`\\]/.test(text)) errors.push(`${where}: 使えない字 — ${text}`);
  return [who, expr, text];
};

const solo = {};
{
  let who = '';
  fs.readFileSync(path.join(DIR, 'solo-draft.txt'), 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const where = `solo-draft.txt:${i + 1}`;
    if (!line || line.startsWith('#') && !line.startsWith('## ')) return;
    const head = /^## ([a-z]+)$/.exec(line);
    if (head) { who = head[1]; if (!IDS.includes(who)) errors.push(`${where}: 知らない助手 ${who}`); solo[who] = solo[who] || {}; return; }
    const m = /^([a-z]+(?::[a-z0-9_]+)?) \| (.+)$/.exec(line);
    if (!m || !who) { errors.push(`${where}: 読めない行 — ${line}`); return; }
    const [, scene, rest] = m;
    if (!SOLO_SCENES.includes(scene) && !scene.startsWith('song:')) errors.push(`${where}: 知らない場面 ${scene}`);
    const row = parseLine(rest, where);
    if (!row) return;
    if (row[0] !== who) errors.push(`${where}: 見出しの助手(${who})と話す人(${row[0]})が違う`);
    (solo[who][scene] = solo[who][scene] || []).push([row[1], row[2]]);
  });
}
const pairs = {};
{
  let key = ''; let members = [];
  fs.readFileSync(path.join(DIR, 'pair-draft.txt'), 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim();
    const where = `pair-draft.txt:${i + 1}`;
    if (!line || line.startsWith('#') && !line.startsWith('## ')) return;
    const head = /^## ([a-z]+) ([a-z]+)$/.exec(line);
    if (head) {
      members = [head[1], head[2]];
      key = members.slice().sort().join('-');
      if (!members.every((x) => IDS.includes(x)) || members[0] === members[1]) errors.push(`${where}: ペアの見出しがおかしい`);
      if (pairs[key]) errors.push(`${where}: 同じペアが2回ある ${key}`);
      pairs[key] = {};
      return;
    }
    const m = /^([a-z]+) \| (.+)$/.exec(line);
    if (!m || !key) { errors.push(`${where}: 読めない行 — ${line}`); return; }
    const [, scene, rest] = m;
    if (!PAIR_SCENES.includes(scene)) errors.push(`${where}: 知らない場面 ${scene}`);
    const rows = rest.split(' | ').map((p) => parseLine(p, where)).filter(Boolean);
    if (rows.length < 2 || !members.every((x) => rows.some((r) => r[0] === x))) errors.push(`${where}: 2人とも話していない`);
    if (rows.some((r) => !members.includes(r[0]))) errors.push(`${where}: ペアでない助手が話している`);
    (pairs[key][scene] = pairs[key][scene] || []).push(rows);
  });
}
IDS.forEach((id) => { if (!solo[id]) errors.push(`solo-draft.txt: ${id} がいない`); else SOLO_SCENES.forEach((sc) => { if (!(solo[id][sc] || []).length) errors.push(`solo-draft.txt: ${id} の ${sc} が無い`); }); });
for (let i = 0; i < IDS.length; i += 1) for (let j = i + 1; j < IDS.length; j += 1) {
  const key = [IDS[i], IDS[j]].sort().join('-');
  if (!pairs[key]) errors.push(`pair-draft.txt: ${key} がいない`);
  else PAIR_SCENES.forEach((sc) => { if (!(pairs[key][sc] || []).length) errors.push(`pair-draft.txt: ${key} の ${sc} が無い`); });
}
if (errors.length) { errors.forEach((e) => console.log(`NG: ${e}`)); process.exit(1); }

const q = (s) => `'${String(s).replace(/'/g, "\\'")}'`;
const soloSrc = IDS.map((id) => `  ${id}: {\n${Object.keys(solo[id]).map((sc) => `    ${/^[a-z]+$/.test(sc) ? sc : q(sc)}: [${solo[id][sc].map(([e, t]) => `[${q(e)}, ${q(t)}]`).join(', ')}],`).join('\n')}\n  },`).join('\n');
const pairSrc = Object.keys(pairs).sort().map((key) => `  ${q(key)}: {\n${PAIR_SCENES.map((sc) => `    ${sc}: [${pairs[key][sc].map((rows) => `[${rows.map(([w, e, t]) => `[${q(w)}, ${q(e)}, ${q(t)}]`).join(', ')}]`).join(', ')}],`).join('\n')}\n  },`).join('\n');
const out = `// ===== 助手とのセッションの台詞(生成物。手で直さない) =====
// 正本は docs/progress/beat-assistant-session/lines/solo-draft.txt・pair-draft.txt。
// 直したら node tools/mode/rhythm-assistant-session-lines-import.js で書き直す(--check で食い違いを見張る)。
// 1人ぶん: { 助手id: { 場面: [[表情, 台詞], …] } }。場面 'song:<曲id>' は好きな曲・苦手な曲の結果の専用
// デュオ: { 'a-b'(並べた id): { play/result/gattai: [[[話す人, 表情, 台詞], …], …] } }。{c} は話す人から相手への呼び方
const RHYTHM_ASSIST_SESSION_SOLO_LINES = Object.freeze({
${soloSrc}
});
const RHYTHM_ASSIST_SESSION_PAIR_LINES = Object.freeze({
${pairSrc}
});
`;
if (process.argv.includes('--check')) {
  const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  console.log(now === out ? 'OK: 台詞の部品は txt と同じ' : 'NG: 台詞の部品が txt と違う(node tools/mode/rhythm-assistant-session-lines-import.js で書き直す)');
  process.exit(now === out ? 0 : 1);
}
fs.writeFileSync(OUT, out);
const nSolo = IDS.reduce((n, id) => n + Object.values(solo[id]).reduce((a, b) => a + b.length, 0), 0);
const nPair = Object.values(pairs).reduce((n, p) => n + PAIR_SCENES.reduce((a, sc) => a + p[sc].length, 0), 0);
console.log(`書き直しました: 1人ぶん ${nSolo}本・デュオ ${nPair}本 → ${path.relative(ROOT, OUT)}`);
