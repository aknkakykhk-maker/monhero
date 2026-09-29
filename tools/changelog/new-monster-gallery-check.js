#!/usr/bin/env node
// 新モンスターの公開のお知らせに、紹介カードと染色イメージが付いているかを見張る(2026-09-29)。
//
//   node tools/changelog/new-monster-gallery-check.js
//
// ユーザー指示「更新情報に画像付きのモンスター説明みたいのもいれといて」「新モンスター実装時にまた染色イメージも一緒につけて」。
// 対象は 2026-09-29 以降の、group:'monster' でタイトルに「新モンスター」とある公開のお知らせ(assistantNotice の type が market)。
// それより前のお知らせは絵の決まりが無かったころのものなので見ない。
// 手順: .claude/skills/monster-add/SKILL.md §8
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8')}\nglobalThis.L=CHANGELOG;`, ctx);
const FROM = '2026-09-29 00:00';
// ★アイコンだけが並んだお知らせ(同じ group:'monster' の market)は対象外。タイトルに「新モンスター」とあるものだけを見る
const targets = ctx.L.filter(e => e && e.group === 'monster' && String(e.date || '') >= FROM && /新モンスター/.test(e.title || '')
  && e.assistantNotice && e.assistantNotice.type === 'market' && !e.dev);
check('対象のお知らせがある(新モンスターを公開したお知らせ)', targets.length > 0, `${targets.length}件`);
const exists = (img) => fs.existsSync(path.join(ROOT, 'monster-hero', String(img).split('?')[0]));
for (const e of targets) {
  const gallery = Array.isArray(e.gallery) ? e.gallery : [];
  const profiles = gallery.filter(g => /紹介/.test(g.caption || ''));
  const dyes = gallery.filter(g => /染色イメージ/.test(g.caption || ''));
  check(`${e.title}: キー画像がある`, typeof e.image === 'string' && exists(e.image), e.image || '無し');
  check(`${e.title}: 紹介カードがある`, profiles.length > 0 && profiles.every(g => exists(g.image)), profiles.map(g => g.caption).join('・') || '無し');
  check(`${e.title}: 染色イメージがある`, dyes.length > 0 && dyes.every(g => exists(g.image)), dyes.map(g => g.caption).join('・') || '無し');
  check(`${e.title}: 紹介カードと染色イメージの枚数がそろっている(1体につき1枚ずつ)`, profiles.length === dyes.length, `${profiles.length} / ${dyes.length}`);
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
