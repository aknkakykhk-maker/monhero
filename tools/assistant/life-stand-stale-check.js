#!/usr/bin/env node
// 全身画(images/assistant/fullbody/)を替えたのに、そこから切り出す立ち絵(images/assistant/stand-*/)を作り直していない
// (切り出し直し忘れ)を見つける検査(助手部ナカヨシ)。全助手・全服を見る。
//   経緯: 2026-11-23 r1119-153 えるびん(ふだんの服・石油王)の全身画を「承認済みポーズ違い版」へ差し替えたのに、
//     バトルの入口・助手ライフの立ち絵が前の全身画から切ったままだった(社長が気づいた)
//   しくみ: tools/assistant/life-stand-from-fullbody.py が切り出すたびに、使った全身画8枚と書いた立ち絵8枚の指紋を
//     life-stand-made.json に書く。ここでは今の絵の指紋と比べる
//       ・全身画の指紋が違う → 全身画が立ち絵より新しい(NG)
//       ・立ち絵の指紋が違う → 立ち絵が道具の外で替わった(NG。道具で作り直す)
//       ・全身画8枚があり、立ち絵の表(ASSISTANT_STAND_ART)に載っているのに記録が無い → NG(道具の HEADS に足して切る)
//   直し方: python3 tools/assistant/life-stand-from-fullbody.py --only <キー> --write
//   REST … 全身画から切っていない立ち絵(表情の並んだ絵から作った物・作り直しを相談中の物)。NG にせず「残り」と1行で出す
//   使い方: node tools/assistant/life-stand-stale-check.js   (最後の1行が OK/NG)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const IMG = path.join(ROOT, 'monster-hero', 'images', 'assistant');
const FB = path.join(IMG, 'fullbody');
const MADE = path.join(__dirname, 'life-stand-made.json');
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const REST = {
  // 2026-11-23 r1119-153 で全身画がある組は全部、全身画から切るようにした(みゅあ ふだん・ハロウィン、ソラシド 補正も)
};

const hash = (files) => {
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 12);
};

// 立ち絵の表(キー → 置き場)
const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'assistants.js'), 'utf8');
const block = (/const ASSISTANT_STAND_ART = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(src) || [])[1] || '';
const art = {};
for (const m of block.replace(/\/\/.*$/gm, '').matchAll(/'?([a-z0-9:-]+)'?\s*:\s*'(stand-[a-z0-9-]+)'/g)) art[m[1]] = m[2];
// 助手の接頭辞(助手id → imagePrefix)
const prefixOf = {};
for (const m of src.matchAll(/\bid:\s*'([a-z0-9]+)'[\s\S]{0,3000}?imagePrefix:\s*'([a-z0-9]+)'/g)) if (!prefixOf[m[1]]) prefixOf[m[1]] = m[2];

const made = fs.existsSync(MADE) ? JSON.parse(fs.readFileSync(MADE, 'utf8')) : {};
const sets = [...new Set(fs.readdirSync(FB).filter(f => /__normal\.png$/.test(f)).map(f => f.replace(/__normal\.png$/, '')))].sort();
const ng = [];
const rest = [];
let ok = 0;
for (const name of sets) {
  const fbFiles = EXPR.map(e => path.join(FB, `${name}__${e}.png`));
  if (!fbFiles.every(f => fs.existsSync(f))) continue; // 8表情そろっていない全身画は立ち絵の元にしていない
  const key = name.replace('_', ':');
  const dir = art[key];
  if (!dir) continue; // 立ち絵を使っていない(全身画だけの組)
  if (REST[key]) { rest.push(key); continue; }
  const rec = made[key];
  if (!rec) { ng.push(`${key}: 切り出した記録が無い(life-stand-from-fullbody.py の HEADS に足して --only ${key} --write)`); continue; }
  if (hash(fbFiles) !== rec.fullbody) { ng.push(`${key}: 全身画が立ち絵より新しい(切り出し直し忘れ) → python3 tools/assistant/life-stand-from-fullbody.py --only ${key} --write`); continue; }
  const prefix = prefixOf[key.split(':')[0]] || key.split(':')[0];
  const stFiles = EXPR.map(e => path.join(IMG, dir, `${prefix}_${e}.png`));
  const missing = stFiles.filter(f => !fs.existsSync(f));
  if (missing.length) { ng.push(`${key}: 立ち絵が無い ${missing.map(f => path.relative(IMG, f)).join(' ')}`); continue; }
  if (hash(stFiles) !== rec.stand) { ng.push(`${key}: 立ち絵が道具の外で替わった(全身画から作り直す) → python3 tools/assistant/life-stand-from-fullbody.py --only ${key} --write`); continue; }
  ok++;
}
for (const l of ng) console.log('NG ' + l);
if (rest.length) console.log(`残り(全身画から切っていない・NG にしない): ${rest.join(' ')}`);
console.log(ng.length ? `NG: 立ち絵の切り出し直し忘れ ${ng.length}組(全身画から切る ${ok + ng.length}組のうち)` : `OK: 全身画から切る立ち絵 ${ok}組とも、今の全身画から切ってある`);
process.exit(ng.length ? 1 : 0);
