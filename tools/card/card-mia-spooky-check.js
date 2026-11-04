// ミーア(C-069)・スプーキー(C-070)(2026-11-04 社長「第8弾にスプーキーとミーア入ってなくない?」→ 第8弾に足す)の3種類ずつ・第8弾・
// 旧コレクション保持と天井を、実際の抽選/保存関数で検証する。ピンクグジラ(card-pink-gujira-check.js)と同じ確かめ方。
// 2体ともサブが ？？？ なので、メインの種族(ピクシー・ゴースト)の技をすべて使える。メインの種族の弾(第2弾・第4弾)ではなく第8弾から出る
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(['monster-hero/data/card-battle-cards.js', 'monster-hero/src/parts/82-card-battle-core.jsx', 'monster-hero/src/parts/89-card-pack.jsx'].map(read).join('\n;\n') + '\nthis.E={CARD_BATTLE_DATA,CARD_PACKS,cardPackOf,cardPackMonPool,cardPackAllCards,cardOpenPack,cardPackCardRates,cardNormalizeCollection,cardDeckProblems,cardCreateGame,cardUsableBy};', ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA, p = E.cardPackOf('p8');
const rarities = ['normal', 'kira', 'alt'];
const KIDS = [
  { base: 'C-069', name: 'ミーア', life: 6, main: 'pixie', img: 'MIA_IMG', face: 'MIA_FACE_ICON', files: ['images/monsters/mia.PNG', 'images/monster-icons/face/mia.png'] },
  { base: 'C-070', name: 'スプーキー', life: 5, main: 'ghost', img: 'SPOOKY_IMG', face: 'SPOOKY_FACE_ICON', files: ['images/monsters/spooky.png', 'images/monster-icons/face/spooky.png'] },
];
const allIds = KIDS.flatMap((k) => [k.base, `${k.base}S`, `${k.base}V`]);
for (const K of KIDS) {
const ids = [K.base, `${K.base}S`, `${K.base}V`];
const source = JSON.parse(read('tools/art-sources/card-battle/hybrid/cards.json')).monster;
assert.equal(new Set(source.map((m) => m.no)).size, source.length, '原本の番号は重複しない');
const old = { 'C-001': 1, '001': 3 };
const before = JSON.stringify(old);
ids.forEach((no, i) => {
  const m = db.monsters[no];
  assert.equal(m.name, K.name);
  assert.equal(m.life, K.life); assert.equal(m.type, 'air');
  assert.equal(m.main, K.main); assert.equal(m.sub, 'unknown');
  assert.equal(m.species, `hybrid:${K.base}`); assert.equal(m.ready, true);
  // メインの種族の弾(第2弾・第4弾)からは出ない
  E.CARD_PACKS.filter((x) => x.id !== 'p8').forEach((x) => assert(!E.cardPackAllCards(db, x).monsters.includes(no), `${no} が ${x.name} に入っている`));
  assert(E.cardPackAllCards(db, p).monsters.includes(no));
  assert(E.cardPackMonPool(db, p, rarities[i]).includes(no));
  const pool = E.cardPackMonPool(db, p, rarities[i]);
  const rateRoll = [0, 0.86, 0.99][i];
  let calls = 0;
  const rand = () => ++calls <= 7 ? 0 : calls === 8 ? rateRoll : (pool.indexOf(no) + 0.5) / pool.length;
  const r = E.cardOpenPack(db, 'p8', { collection: old, pity: { p4: 6, p8: 0 } }, rand);
  assert.equal(r.cards[7].no, no); assert.equal(r.collection[no], 1);
  assert.equal(r.collection['C-001'], 1); assert.equal(r.collection['001'], 3);
  assert.equal(E.cardNormalizeCollection(JSON.parse(JSON.stringify(r.collection)))[no], 1);
  assert.equal(r.pity.p4, 6);
  assert.equal(JSON.stringify(old), before, '入力の旧コレクションを書き換えない');
  // サブが ？？？ の子は、メインの種族の技をすべて使える(パンドラと同じ)
  for (const c of Object.values(db.cards).filter((c) => c.ready && c.user === K.main)) assert.equal(E.cardUsableBy(c, { ...m, ko: false }), true, `${no} が ${c.name} を使えない`);
  for (const size of ['s', 'l']) assert(fs.statSync(path.join(root, `monster-hero/images/card-battle/${size}/${m.img}.jpg`)).size > 0);
  // 7パック経過後でも別絵キラを選べ、当たれば天井がリセットされる。
  if (i === 2) {
    calls = 0;
    const pityHit = E.cardOpenPack(db, 'p8', { collection: {}, pity: { p8: 7 } }, rand);
    assert.equal(pityHit.cards[7].no, no); assert.equal(pityHit.pity.p8, 0); assert(pityHit.hit);
  }
});
const starter = Object.values(db.starters)[0];
const deck = { ...starter, monsters: [K.base, ...starter.monsters.slice(1)] };
assert.equal(E.cardDeckProblems(db, deck).length, 0);
assert(E.cardDeckProblems(db, { ...deck, monsters: [K.base, `${K.base}S`, 'C-003'] }).some((x) => x.includes('同じモンスター')));
const game = E.cardCreateGame(db, { decks: [deck, starter], seed: 5, first: 0 });
assert.equal(game.players[0].mons[0].life, K.life);
assert.equal(game.players[0].mons[0].no, K.base);
// 立ち絵・顔アイコン(場・図鑑・VS で出る)が番号から引ける(本編の立ち絵・顔をそのまま使う)
const ally = read('monster-hero/data/images/images-ally.js');
ids.forEach((no) => { assert(new RegExp(`'${no}': ${K.img}`).test(ally), `${no} の立ち絵`); assert(new RegExp(`'${no}': ${K.face}`).test(ally), `${no} の顔`); });
for (const f of K.files) assert(fs.statSync(path.join(root, 'monster-hero', f)).size > 0);
}
// 第8弾: 5体(通常5・キラ5・別絵キラ2)= 袋の「全12種類」
assert.deepEqual(rarities.map((k) => E.cardPackMonPool(db, p, k).length), [5, 5, 2]);
assert.equal(JSON.stringify(E.cardPackMonPool(db, p, 'alt')), JSON.stringify(['C-069V', 'C-070V']));
E.CARD_PACKS.forEach((pack) => {
  const want = pack.no <= 3 || pack.no === 5 || pack.no === 7 || pack.no === 8 ? [85, 12, 3] : [85, 15, 0]; // 第8弾はミーア・スプーキーの別絵キラが入って 85/12/3(2026-11-04)
  assert.deepEqual(rarities.map((k) => pack.rarity[k]), want);
  assert.equal(want.reduce((a, b) => a + b), 100);
  rarities.forEach((k, i) => { if (want[i]) assert(E.cardPackMonPool(db, pack, k).length > 0); });
});
console.log('OK: ミーア・スプーキー3種類ずつ・画像・立ち絵・顔・メインの種族の技・第8弾抽選/天井・保存復元・対戦生成');
console.log('第8弾候補数:', rarities.map((k) => `${k}=${E.cardPackMonPool(db, p, k).length}`).join(', '));

// 配信の絵(s・l)が、元の絵(tools/art-sources/card-battle/hybrid/C069*.jpg・C070*.jpg)と同じ見た目か。
// card-image-build の NO_COPYRIGHT に入れ忘れると、下の帯が塗られて名前の「ラ」が縞に化ける(2026-10-30 テスターさんの知らせ)
(async () => {
  const sharp = require(path.join(root, 'tools', 'node_modules', 'sharp'));
  for (const no of allIds) {
    const img = db.monsters[no].img;
    // 大きい絵(l)で見る(小さい絵 s は縮め方の差が大きく、塗った帯との見分けがつきにくい。s も同じ道具で同時に作られる)
    const out = path.join(root, `monster-hero/images/card-battle/l/${img}.jpg`);
    const { width: w, height: h } = await sharp(out).metadata();
    const a = await sharp(out).removeAlpha().raw().toBuffer();
    const b = await sharp(path.join(root, `tools/art-sources/card-battle/hybrid/${img}.jpg`)).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
    // 下の4分の1(名前・番号・ライフの段)で、行ごとの差の平均のいちばん悪い行。帯を塗ると23以上、塗らなければ9以下(2026-10-30 測った)
    let worst = 0;
    for (let y = Math.floor(h * 0.75); y < h; y++) {
      let t = 0;
      for (let x = 0; x < w; x++) { const i = (y * w + x) * 3; t += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; }
      worst = Math.max(worst, t / w);
    }
    assert(worst < 15, `l/${img}.jpg の下の段が元の絵と違う(いちばん違う行の差 ${worst.toFixed(1)})。card-image-build の NO_COPYRIGHT を見る`);
  }
  console.log('OK: 配信の絵の名前・番号の段が元の絵と同じ(帯を塗っていない)');
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
