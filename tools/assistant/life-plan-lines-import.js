// 予定表で行き先をお願いされた助手の返事(ココロ3・2026-11-11)を data/assistants.js へ取り込む。
//   node tools/assistant/life-plan-lines-import.js          取り込む(ASSISTANT_LIFE_PLAN_LINES の1行を書き直す。無ければ足す)
//   node tools/assistant/life-plan-lines-import.js --check  書き直さずに、ファイルと assistants.js がそろっているかだけ見る
// 読むファイル: docs/progress/assistant-life/schedule/lines.txt
//   ok <助手id> | <表情> <台詞>   … お願いどおり行った({place}=頼まれた場所)
//   no <助手id> | <表情> <台詞>   … 気分で別の場所へ行った({place}=実際に行った場所・{want}=頼まれた場所)
//   穴は {place}・{want}・{c} だけ。1本 40字まで(場所は「ひなたの丘」で数える)。8人とも ok・no が1本以上
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const DATA = path.join(root, 'monster-hero/data/assistants.js');
const FILE = path.join(root, 'docs/progress/assistant-life/schedule/lines.txt');
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const CHECK = process.argv.includes('--check');
const ng = [];
const out = {};
for (const id of IDS) out[id] = { ok: [], no: [] };
for (const [n, raw] of fs.readFileSync(FILE, 'utf8').split('\n').entries()) {
  const l = raw.trim(); if (!l || l.startsWith('#')) continue;
  const m = l.match(/^(ok|no)\s+(\S+)\s*\|\s*(\S+)\s+(.+)$/);
  if (!m) { ng.push(`${n + 1}行: 形が違う「${l}」`); continue; }
  const [, kind, id, e, t] = m;
  if (!IDS.includes(id)) { ng.push(`${n + 1}行: 知らない助手 ${id}`); continue; }
  if (!EXPR.includes(e)) { ng.push(`${n + 1}行: 知らない表情 ${e}`); continue; }
  const holes = t.match(/\{[^}]*\}/g) || [];
  if (holes.some(h => !['{place}', '{want}', '{c}'].includes(h)) || (kind === 'ok' && holes.includes('{want}'))) { ng.push(`${n + 1}行: 使えない穴 ${holes.join(',')}`); continue; }
  const len = [...t.replace(/\{place\}|\{want\}/g, 'ひなたの丘').replace(/\{c\}/g, 'ブリーダー')].length;
  if (len > 40) { ng.push(`${n + 1}行: 40字を超える(${len}字)`); continue; }
  out[id][kind].push({ e, t });
}
for (const id of IDS) for (const k of ['ok', 'no']) if (!out[id][k].length) ng.push(`${id} の ${k} が無い`);
const line = `const ASSISTANT_LIFE_PLAN_LINES = Object.freeze(${JSON.stringify(out)}); // 予定表の返事(tools/assistant/life-plan-lines-import.js が書く・元 docs/progress/assistant-life/schedule/lines.txt)`;
const src = fs.readFileSync(DATA, 'utf8');
const re = /^const ASSISTANT_LIFE_PLAN_LINES = .*$/m;
const now = (src.match(re) || [null])[0];
if (CHECK) {
  if (now !== line) ng.push('assistants.js の ASSISTANT_LIFE_PLAN_LINES がファイルとそろっていない(取り込み直す: node tools/assistant/life-plan-lines-import.js)');
} else if (!ng.length) {
  const next = now ? src.replace(re, () => line) : src.replace(/^const ASSISTANT_LIFE_GIFT_LINES = /m, () => `${line}\nconst ASSISTANT_LIFE_GIFT_LINES = `);
  fs.writeFileSync(DATA, next);
}
if (ng.length) { for (const x of ng) console.log(`NG: ${x}`); process.exit(1); }
console.log(`OK: 予定表の返事 ${IDS.reduce((s, id) => s + out[id].ok.length + out[id].no.length, 0)}本(8人・ok/no)${CHECK ? ' がそろっている' : ' を取り込んだ'}`);
