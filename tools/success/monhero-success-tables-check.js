#!/usr/bin/env node
// モンヒロサクセスの称号の表(monhero-success-titles.js)とアシスト能力の表(monhero-success-assist.js)の見張り。画面は開かない(1秒ほど)。
//   ・アシスト能力(第2版): 30〜40種類・どれも5段・段ごとに効き目と値段が上がる・値段は値段の組のどれか / 芯(第1版)の id は名前・型が同じで残っている / ポイントの式が芯と同じ
//   ・アシスト能力: 説明に {v} が入っている / おまかせ・確かめ方が 4種類まで・ポイント以内 / 試合型は対戦の芯の buffs の形
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

// ---- アシスト能力(第3版・2026-11-14: 参考から + オリジナル・目盛り・1体8種類) ----
const core = SUC.ASSISTS;
for (const id of Object.keys(core)) {
  const a = AS.BY_ID[id];
  const want = core[id].hint ? 'hint' : 'core';
  ok(a && a.from === want && (want === 'core' || a.aid === core[id].hint), `芯のアシスト ${id} が表にない(または from が ${want} でない)`);
  if (!a) continue;
  // 芯は表の名前を使う(試合型5つは第1版の数字のまま・名前も第1版)
  if (a.type !== 'battle') ok(a.name === core[id].name, `${id} の名前が芯と違う: ${a.name} / ${core[id].name}`);
  ok(a.type === core[id].type || (a.type === 'battle' && core[id].type === 'battle'), `${id} の型が芯と違う: ${a.type} / ${core[id].type}`);
}
ok(AS.VERSION === 3, '表の版が3でない');
ok(AS.LIST.length >= 60 && AS.LIST.length <= 80, `アシスト効果の数が60〜80でない(社長 2026-11-14「使えそうなのは全部」): ${AS.LIST.length}`);
ok(AS.LIST.filter(a => a.ref).length >= 40 && AS.LIST.filter(a => !a.ref).length === 22, `参考から/オリジナルの数がおかしい: ${AS.LIST.filter(a => a.ref).length} / ${AS.LIST.filter(a => !a.ref).length}`);
const V2_IDS = ['sokoji', 'kizuna', 'atooshi', 'hirameki', 'ochitsuki', 'itawari', 'miharu', 'kibarashi', 'kunpow', 'kunwise', 'kunhit', 'kuneva', 'kuntough', 'kunlife',
  'kaketsuke', 'hitonatsu', 'shitashi', 'nakayoshi', 'tagpow', 'shitsuke', 'gussuri', 'asobi', 'kuishinbo', 'tsukisoi', 'genki', 'tairyoku', 'shugyo',
  'shokin', 'kokoroe', 'ticket', 'rivaldamashii', 'ninki', 'yobimizu', 'mejirushi', 'joshu', 'gatsu', 'miseba', 'mitate', 'kensho', 'mimamori'];
ok(V2_IDS.every(id => AS.BY_ID[id] && Array.isArray(AS.BY_ID[id].v2) && AS.BY_ID[id].v2.length === 5), '第2版の40種類が残っていない(id は変えない・v2 で読み替える)');
for (const a of AS.LIST) {
  ok(/^[a-z0-9]+$/.test(a.id) && /^[a-z]/.test(a.id), `アシストの id は英小文字(と数字)だけ: ${a.id}`);
  if (a.from !== 'core') ok(a.from === 'hint' && TT.ASSIST_NAMES[a.aid], `${a.id} の from / aid がおかしい`);
  ok(Number.isInteger(a.max) && a.max >= 1 && a.v.length === a.max && a.cost.length === a.max && a.max <= AS.LV_MAX, `${a.id} の目盛りの数がおかしい`);
  ok(a.v.every((x, i) => Number.isFinite(x) && (i === 0 || x > a.v[i - 1])), `${a.id} の効き目が目盛りの順に上がっていない`);
  ok(a.cost.every((x, i) => x === a.pt * (i + 1)), `${a.id} の値段が 1目盛り ${a.pt}pt の積み上げでない`);
  ok(a.cost[a.max - 1] <= 110, `${a.id} の満タンの値段が高すぎる(第2版の約半分・110pt まで): ${a.cost[a.max - 1]}`);
  ok(AS.SCENES.some(g => g.key === a.scene), `${a.id} の scene が知らないもの: ${a.scene}`);
  ok(a.text.includes('{v}') || a.max === 1, `${a.id} の説明に {v} がない`);
  for (let n = 1; n <= a.max; n++) ok(!AS.describe(a.id, n).includes('{'), `${a.id} 目盛り${n} の説明に { が残る`);
  ok(!/訓練/.test(a.text) && !/訓練/.test(a.name), `${a.id}: 画面の呼び名は「トレーニング」(社長 2026-11-13)`);
  ok(['with', 'self', 'stay', 'battle'].includes(a.type), `${a.id} の型が知らないもの: ${a.type}`);
  ok((a.type === 'battle') === (a.from === 'hint'), `${a.id}: お話のひらめきは試合型、ほかは試合型でない(社長 2026-11-12)`);
  if (a.type === 'battle') ok(Array.isArray(a.buff) && a.buff.length === a.max, `${a.id} に目盛りごとの buff がない`);
  // 古い子の段1〜5は、同じ効き目の目盛りに読み替わる(CLAUDE.md ⑦)
  if (a.v2) for (let lv = 1; lv <= 5; lv++) { const n = AS.fromSaved({ id: a.id, lv }); ok(Math.abs(a.v[n - 1] - a.v2[lv - 1]) < 1e-9, `${a.id} 段${lv} が同じ効き目の目盛りに読み替わらない: ${a.v[n - 1]} / ${a.v2[lv - 1]}`); const sv = AS.toSaved(a.id, n); ok(sv.lv === lv && sv.n === n, `${a.id} 段${lv} の書き戻し(lv)がずれる`); }
}
ok(new Set(AS.LIST.map(a => a.name)).size === AS.LIST.length, 'アシスト効果の名前が重なる');
ok(Math.min(...AS.LIST.map(a => a.cost[0])) <= AS.POINTS_MIN, 'ポイント最低の子が1つも取れない');
const hintNames = Object.values(SUC.ASST_STORY).filter(s => s.good.hint === 'assist').map(s => s.good.name);
for (const n of hintNames) ok(AS.LIST.some(a => a.name === n && a.from === 'hint'), `お話のひらめき「${n}」が表にない`);
ok(AS.MAX_KINDS === 8, '1体に持てる数が8でない(社長 2026-11-14)');
for (const p of [0, 999, 2000, 8000, 14000, 19500, 20070, 99999]) ok(AS.pointsOf(p) === SUC.assistPointsOf(p), `ポイントの式が芯と違う(総合力 ${p})`);
ok(AS.describe('sokoji', 10) === 'いっしょにトレーニングすると、伸びが10%上がる', '説明の差しこみがおかしい');
ok(AS.valueText('sokoji', 12) === '+12%' && AS.valueText('hitonatsu', 2) === '×1.1', `効き目の短い字がおかしい: ${AS.valueText('sokoji', 12)} ${AS.valueText('hitonatsu', 2)}`);
for (const pts of [20, 40, 160, 288, 400]) {
  const r = AS.autoPick(pts, []);
  ok(r.picks.length <= 8 && r.used <= pts && r.used > 0 && r.left < 13, `おまかせ(${pts})がポイント・8種類を超える/何も取らない/余りが多い: ${r.used}`);
}
const hinted = AS.autoPick(400, [{ type: 'assist', name: '見せ場' }]);
ok(hinted.picks[0] && hinted.picks[0].id === 'miseba', 'おまかせがひらめきの候補を先に取っていない');
ok(!AS.candidates([]).some(a => a.from === 'hint'), 'ひらめきが無いのに、お話の能力が候補に出る');
const np = AS.normPicks([{ id: 'sokoji', lv: 9 }, { id: 'nai' }, { id: 'sokoji', lv: 1 }, { id: 'hirameki', n: 3 }, { id: 'itawari', n: 1 }, { id: 'ochitsuki', n: 1 }, { id: 'atooshi', n: 1 },
  { id: 'miharu', n: 1 }, { id: 'kibarashi', n: 1 }, { id: 'ninzu', n: 1 }, { id: 'tsuika', n: 1 }], 400);
ok(np.picks.length === 8 && np.picks[0].n === 25 && np.used <= 400, '確かめ方(段の読み替え・知らない id・8種類)がおかしい');
ok(AS.normPicks([{ id: 'sokoji', n: 25 }], 99).picks.length === 0, 'ポイントを超えた効果が残る');

// 試合型は対戦の芯の buffs に入る形・いちばん高い段だけ・範囲の中
const BUFF_KEYS = ['guts', 'hit1', 'crit', 'missCut', 'eva', 'noSulk'];
for (const a of AS.LIST.filter(x => x.type === 'battle')) for (const b of a.buff) ok(Object.keys(b).every(k => BUFF_KEYS.includes(k)), `${a.id} の buff に芯の知らない項目`);
const bb = AS.battleBuffs([[{ id: 'gatsu', lv: 1 }], [{ id: 'gatsu', lv: 3 }, { id: 'sokoji', lv: 3 }], [{ id: 'mimamori', lv: 5 }]], { guts: 10, crit: 0.1 });
ok(JSON.stringify(bb) === JSON.stringify({ guts: 16, hit1: 0.2, noSulk: true, crit: 0.1 }), `battleBuffs のまとめ方がおかしい: ${JSON.stringify(bb)}`);
ok(JSON.stringify(AS.battleBuffs(null, null)) === '{}' && JSON.stringify(AS.battleBuffs([[{ id: 'sokoji', lv: 3 }]])) === '{}', '試合型が無いのに buffs が付く');
ok(AS.stayValue([[{ id: 'gussuri', lv: 2 }], [{ id: 'gussuri', lv: 4 }]], 'gussuri') === 20 && AS.stayValue([[{ id: 'gussuri', n: 23 }]], 'gussuri') === 23 && AS.stayValue([], 'gussuri') === 0, 'stayValue がいちばん高い段を返さない');
ok(AS.battleBuffs([[{ id: 'kensho', lv: 5 }]], { missCut: 0.9 }).missCut === 1, 'buffs が芯の範囲で切られていない');

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
console.log(`✓ モンヒロサクセスの表: 称号 ${TT.TITLES.length}・アシスト能力 ${AS.LIST.length}(芯の第1版 ${Object.keys(core).length})・記録帳 ${RB.KEY}`);
