#!/usr/bin/env node
// モンヒロサクセスの称号の表(monhero-success-titles.js)とアシスト能力の表(monhero-success-assist.js)の見張り。画面は開かない(1秒ほど)。
//   ・アシスト能力: 第1弾(from:'core')の数字・値段・型が芯の ASSISTS と同じ / 芯にある id が表から抜けていない / ポイントの式が芯と同じ
//   ・アシスト能力: 説明に {v} が入っている / 値段は段が上がるほど高い / おまかせ・確かめ方が 4種類まで・ポイント以内
//   ・称号: id と名前が重ならない / 芯が s.titles に積む文字(ソースの文字)がどれも表で引ける / finalize が id の配列を返し、知らない文字を消さない
//   ・記録帳(monhero-success-record.js): 新しいキーだけ・壊れた値は空・同じ育成は1件・200件まで・localStorage に触らない
//   ・どれも index.html から読まれていない(回3まで誰にも見えない約束)
'use strict';
const fs = require('fs');
const path = require('path');
const { load, ROOT, CORE } = require('./load');

const { SUC } = load();
const TT = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-titles.js'));
const AS = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-assist.js'));
const RB = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-record.js'));
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

// ---- アシスト能力 ----
const core = SUC.ASSISTS;
for (const id of Object.keys(core)) {
  const a = AS.BY_ID[id];
  // 芯の ASSISTS に hint(助手)が付いた物は、お話のひらめきで取れる5つ(表では from:'hint'・aid が同じ)
  const want = core[id].hint ? 'hint' : 'core';
  ok(a && a.from === want && (want === 'core' || a.aid === core[id].hint), `芯のアシスト ${id} が表にない(または from が ${want} でない)`);
  if (!a) continue;
  ok(a.name === core[id].name, `${id} の名前が芯と違う: ${a.name} / ${core[id].name}`);
  ok(a.type === core[id].type, `${id} の型が芯と違う: ${a.type} / ${core[id].type}`);
  ok(JSON.stringify(a.v) === JSON.stringify(core[id].v), `${id} の効き目が芯と違う: ${a.v} / ${core[id].v}`);
  ok(JSON.stringify(a.cost) === JSON.stringify(core[id].cost), `${id} の値段が芯と違う: ${a.cost} / ${core[id].cost}`);
  if (core[id].start) ok(JSON.stringify(a.start) === JSON.stringify(core[id].start), `${id} のはじめの親密度が芯と違う`);
}
for (const a of AS.LIST) {
  ok(/^[a-z]+$/.test(a.id), `アシストの id は英小文字だけ: ${a.id}`);
  if (a.from === 'core') ok(core[a.id] && !core[a.id].hint, `表の ${a.id} は from:'core' なのに芯にない`);
  else ok(a.from === 'hint' && TT.ASSIST_NAMES[a.aid], `${a.id} の from / aid がおかしい`);
  ok(a.v.length === 3 && a.cost.length === 3, `${a.id} の段が3つでない`);
  ok(a.cost[0] < a.cost[1] && a.cost[1] < a.cost[2], `${a.id} の値段が段の順に上がっていない`);
  ok(a.text.includes('{v}'), `${a.id} の説明に {v} がない`);
  ok(!AS.describe(a.id, 3).includes('{'), `${a.id} の説明に { が残る`);
  ok(['with', 'self', 'stay'].includes(a.type), `${a.id} の型が知らないもの: ${a.type}`);
}
const hintNames = Object.values(SUC.ASST_STORY).filter(s => s.good.hint === 'assist').map(s => s.good.name);
for (const n of hintNames) ok(AS.LIST.some(a => a.name === n && a.from === 'hint'), `お話のひらめき「${n}」が表にない`);
ok(AS.MAX_KINDS === 4, '1体に持てる数が4でない');
for (const p of [0, 999, 2000, 8000, 14000, 19500, 20070, 99999]) ok(AS.pointsOf(p) === SUC.assistPointsOf(p), `ポイントの式が芯と違う(総合力 ${p})`);
ok(AS.describe('sokoji', 2) === 'この子がいっしょに訓練すると、伸びが7%上がる', '説明の差しこみがおかしい');
for (const pts of [24, 40, 160, 288, 400]) {
  const r = AS.autoPick(pts, []);
  ok(r.picks.length <= 4 && r.used <= pts && r.used > 0, `おまかせ(${pts})がポイント・4種類を超える/何も取らない`);
}
const hinted = AS.autoPick(400, [{ type: 'assist', name: '見せ場' }]);
ok(hinted.picks[0] && hinted.picks[0].id === 'miseba', 'おまかせがひらめきの候補を先に取っていない');
ok(!AS.candidates([]).some(a => a.from === 'hint'), 'ひらめきが無いのに、お話の能力が候補に出る');
const np = AS.normPicks([{ id: 'sokoji', lv: 9 }, { id: 'nai' }, { id: 'sokoji', lv: 1 }, { id: 'hirameki', lv: 3 }, { id: 'itawari', lv: 1 }, { id: 'ochitsuki', lv: 1 }, { id: 'atooshi', lv: 1 }], 400);
ok(np.picks.length === 4 && np.picks[0].lv === 3 && np.used <= 400, '確かめ方(段の丸め・知らない id・4種類)がおかしい');
ok(AS.normPicks([{ id: 'sokoji', lv: 3 }], 100).picks.length === 0, 'ポイントを超えた能力が残る');

// ---- 称号 ----
const ids = new Set(); const names = new Set();
for (const t of TT.TITLES) {
  ok(!ids.has(t.id), `称号の id が重なる: ${t.id}`); ids.add(t.id);
  ok(!names.has(t.name), `称号の名前が重なる: ${t.name}`); names.add(t.name);
  ok(TT.GROUPS.some(g => g.key === t.group), `${t.id} の group が知らないもの: ${t.group}`);
  ok(typeof t.how === 'string' && t.how.length > 0, `${t.id} に取り方がない`);
  ok([1, 2, 3].includes(t.rare), `${t.id} の rare が 1〜3 でない`);
  ok(t.effect === null, `${t.id} に効き目がある(第1弾は名誉だけ)`);
}
// 芯が積む文字: ソースの s.titles.push('…') / title: '…' と、テンプレートの2つ(シナリオの大会・お話の結末)
const src = fs.readFileSync(CORE, 'utf8');
const lits = new Set();
for (const m of src.matchAll(/title: '([^']+)'/g)) lits.add(m[1]);
for (const m of src.matchAll(/titles\.push\('([^']+)'\)/g)) lits.add(m[1]);
for (const m of src.matchAll(/titles\.includes\('([^']+)'\)/g)) lits.add(m[1]);
Object.values(SUC.SC_NAME).forEach(n => lits.add(`${n}の優勝`));
Object.keys(SUC.ASST_STORY).forEach(aid => { lits.add(`${aid}:お話の結末(いい結末)`); lits.add(`${aid}:お話の結末(ほろ苦い結末)`); });
ok(lits.size >= 20, `芯の称号の文字が見つからない(${lits.size})`);
for (const s of lits) ok(TT.resolve(s), `芯が積む称号「${s}」が表で引けない`);
const fin = TT.finalize(['はじめの一歩', 'mua:お話の結末(いい結末)', 'はじめの一歩', 'むかしの称号'], { rank: 'S', loyal: 100, pop: 50, techs: 8 }, { issaWon: 3 });
ok(JSON.stringify(fin) === JSON.stringify(['debut', 'story-mua-good', 'issa-pupil', 'grade-S', 'feat-loyal', 'feat-techs', 'むかしの称号']), `finalize の結果がおかしい: ${fin}`);
ok(TT.finalize(null, null, null).length === 0, 'finalize が壊れた値で落ちる');
ok(TT.nameOf('ヒーロー記念') === '冬のヒーロー記念の覇者' && TT.nameOf('むかしの称号') === 'むかしの称号', 'nameOf がおかしい');
ok(TT.atRetire({ rank: 'SSS' }).includes('grade-SS') && TT.atRetire({ rank: 'C' }).length === 0, '評価の称号の区切りがおかしい');

// ---- 育成の記録帳(新しいキー mh_monsuc_record_v1 だけ・二重に足さない・壊れた値でも空で読める) ----
ok(RB.KEY === 'mh_monsuc_record_v1', `記録帳のキーが違う: ${RB.KEY}`);
for (const bad of [null, '', '{', '[]', '{"list":5}', 'null']) ok(RB.parse(bad).list.length === 0 && RB.parse(bad).v === 1, `壊れた値(${bad})で記録帳が空にならない`);
let bk = RB.parse(null);
bk = RB.add(bk, { id: 'r1', species: 'Golem', rank: 'B', power: 8000, titles: ['debut'], endAt: 1 }).book;
const twice = RB.add(bk, { id: 'r1', species: 'Golem', rank: 'B', power: 8000, endAt: 1 });
ok(!twice.added && twice.book.total === 1, '同じ育成を2度足せる');
bk = RB.add(bk, { id: 'r2', species: 'Golem', rank: 'A', power: 12000, endAt: 2 }).book;
bk = RB.add(bk, { id: 'r3', species: 'Golem', rank: 'C', power: 6000, endAt: 3, aid: 'nobody', power2: 1 }).book;
ok(bk.list[0].id === 'r3' && bk.list[1].best === true && bk.list[0].best === false && bk.list[0].aid === '' && !('power2' in bk.list[0]), '記録帳の並び・いちばんの印・知らない項目の捨て方がおかしい');
ok(RB.view(bk, { order: 'power' })[0].id === 'r2' && RB.view(bk, { order: 'rank' })[2].id === 'r3', '記録帳の並べ替えがおかしい');
ok(RB.summary(bk).total === 3 && RB.summary(bk).topRank === 'A', '記録帳のまとめがおかしい');
let big = RB.parse(null); for (let i = 0; i < 205; i++) big = RB.add(big, { id: `x${i}`, power: i }).book;
ok(big.list.length === RB.MAX && big.total === 205 && RB.parse(RB.stringify(big)).total === 205, '記録帳の200件の上限・育てた数の数え方がおかしい');
const recSrc = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-record.js'), 'utf8').replace(/\/\/.*$/gm, '');
for (const b of ['localStorage', 'Date.now', 'new Date', 'window.']) ok(!recSrc.includes(b), `記録帳の部品が ${b} を使っている(読み書きは画面がする)`);

// ---- まだ誰にも見えない ----
const html = fs.readFileSync(path.join(ROOT, 'monster-hero', 'index.html'), 'utf8');
ok(!['monhero-success-titles.js', 'monhero-success-assist.js', 'monhero-success-record.js'].some(f => html.includes(f)), '称号・アシスト・記録帳の表が index.html から読まれている(回3まで見えない約束)');

if (errors.length) { console.error(`✗ モンヒロサクセスの表: ${errors.length}件`); errors.slice(0, 30).forEach(e => console.error('  - ' + e)); process.exit(1); }
console.log(`✓ モンヒロサクセスの表: 称号 ${TT.TITLES.length}・アシスト能力 ${AS.LIST.length}(芯と同じ ${Object.keys(core).length})・記録帳 ${RB.KEY}`);
