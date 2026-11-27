#!/usr/bin/env node
// 期間で出し入れする HOME のひとこと(ASSISTANT_SEASON_LINES・2026-11-27 r1126-066 クリスマスイベント)を見張る。ブラウザは使わない。
//   ふだんの口調の検査(mua-tone-check など)は ASSISTANT_SCENES だけを読むので、期間の台詞はここで見る。
//   ①開幕前・開催中・終了後で出る/出ないが切り替わる ②着ている服で「着ているときだけ」「着ていないときだけ」が入れ替わる
//   ③条件つき(仲良し度アップなど)には混ざらない ④ネタバレの語・きゅうこの正体に触れる話・あつの決め台詞の使いすぎ・一人称のまちがいが無い
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
let NOW = 0;
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
const ctx = vm.createContext({ console, Date: FakeDate, Math, JSON, Object, Array, Number, String, Set, Map,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, window: {} });
vm.runInContext('var RELEASE_FLAGS = {};', ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js', 'data/breeder.js', 'data/assistants.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'monster-hero', f), 'utf8'), ctx, { filename: f });
}
const run = (code) => vm.runInContext(code, ctx);
let ng = 0;
const ok = (cond, label) => { console.log(`${cond ? 'OK' : 'NG'}: ${label}`); if (!cond) ng += 1; };

const all = run('ASSISTANT_SEASON_LINES');
const xmas = all.filter(l => l.season === 'xmas2026Home');
const ids = run('ASSISTANTS.map(a => a.id)');
const from = run('ASSISTANT_COSTUME_XMAS_START_AT'), until = run('ASSISTANT_COSTUME_XMAS_END_AT');
ok(xmas.length > 0, `クリスマスの HOME のひとことがある — ${xmas.length}本`);
ok(xmas.every(l => l.from === from && l.until === until), 'クリスマスの期間が、きせかえの期間と同じ(開幕〜12/31 4:00)');
for (const id of ids) {
  const mine = xmas.filter(l => l.who === id);
  const plain = mine.filter(l => !l.outfit && !l.notOutfit).length;
  ok(plain >= 3 && mine.some(l => l.outfit === 'santa') && mine.some(l => l.notOutfit === 'santa'),
    `${id}: いつも出る台詞が3本以上・着ているときだけ・着ていないときだけが1本以上 — ${plain}/${mine.length}本`);
}

const seasonalNow = (id) => run(`assistantSceneLines('home', null, 10, ${JSON.stringify(id)}).filter(l => l.season === 'xmas2026Home')`);
NOW = Date.parse(from) - 60000;
ok(ids.every(id => seasonalNow(id).length === 0), '開幕の1分前は出ない');
NOW = Date.parse(from);
ok(ids.every(id => seasonalNow(id).length > 0), '開幕の時刻から出る');
ok(ids.every(id => !seasonalNow(id).some(l => l.outfit)), 'ふだんの服では「着ているときだけ」の台詞が出ない');
ok(run(`assistantSceneLines('home', 'bondUp', 10, 'mua').every(l => !l.season)`), '仲良し度アップの台詞には混ざらない');
ok(run(`(() => { const d = ASSISTANT_SCENES.home; return [...(d.lines || []), ...Object.values(d.when || {}).flat()].every(l => !l.season); })()`),
  'ふだんの台詞の表(ASSISTANT_SCENES)には入っていない(ほかの道具・画面へ漏れない)');
const worn = run(`(() => { const c = releasedAssistantCostumes().find(x => x.assistantId === 'mua' && /santa/.test(String(x.imageDir || ''))); if (!c) return ''; ASSISTANT_COSTUME_WORN_NOW.mua = c.id; return c.id; })()`);
const muaWorn = seasonalNow('mua');
ok(!!worn && muaWorn.some(l => l.outfit === 'santa') && !muaWorn.some(l => l.notOutfit === 'santa'),
  'サンタの服を着ると「着ているときだけ」に入れ替わる(みゅあ)');
run('delete ASSISTANT_COSTUME_WORN_NOW.mua');
NOW = Date.parse(until);
ok(ids.every(id => seasonalNow(id).length === 0), '終わり(12/31 4:00)からは出ない');

// 中身の決まり(r1126-066・STORY.md の「決まったこと」)
const text = (l) => String(l.t || '');
const spoil = /犯人|正体|消え|いなくな|仕立て|真実はいつも|イチーカ|スネグーラチカ/;
ok(!xmas.some(l => spoil.test(text(l))), `ネタバレの語(犯人・正体・消える・真実はいつもひとつ ほか)を書かない — ${xmas.filter(l => spoil.test(text(l))).map(text).join(' / ') || 'なし'}`);
ok(!xmas.some(l => /\d[\d,]*\s*(ダメージ|ライフ|HP)/.test(text(l))), '敵の数字を書かない');
ok(!xmas.filter(l => l.who === 'kyuko').some(l => /黒いサンタ|レイド/.test(text(l))), 'きゅうこは黒いサンタの話をしない(作中の正体に触れない)');
ok(xmas.filter(l => /謎は全て解けた/.test(text(l))).length <= 1, 'あつの「謎は全て解けた！」は1本まで');
const wrong = { mua: /(^|[^ぁ-ん])(私|俺|おで)/, kiki: /あたし|俺|おで/, momosuke: /あたし|俺|おで|(^|[^ぁ-ん])私/, dra: /あたし|(^|[^ぁ-ん])私|俺/,
  atsu: /あたし|(^|[^ぁ-ん])私|僕|おで/, kyuko: /あたし|(^|[^ぁ-ん])私|おで/, erubin: /あたし|(^|[^ぁ-ん])私|僕|おで/, sorashido: /あたし|俺|おで/ };
for (const [id, re] of Object.entries(wrong)) {
  const bad = xmas.filter(l => l.who === id && re.test(text(l)));
  ok(!bad.length, `${id}: ほかの助手の一人称を使わない — ${bad.map(text).join(' / ') || 'なし'}`);
}
ok(!xmas.filter(l => l.who === 'kyuko').some(l => /ほい/.test(text(l))), 'きゅうこに「ほい」を言わせない(r1126-041 社長「ほいほいうるさい」)');
ok(!xmas.some(l => /モンビー/.test(text(l)) && !['mua', 'dra'].includes(l.who)), '「モンビー」と呼ぶのはみゅあ・ドラだけ');

console.log(ng ? `${ng}件のNGがあります` : 'すべてOK');
process.exit(ng ? 1 : 0);
