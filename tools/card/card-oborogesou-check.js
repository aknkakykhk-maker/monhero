// オボロゲソウの3種類・第5弾・旧コレクション保持と天井を、実際の抽選/保存関数で検証する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(['monster-hero/data/card-battle-cards.js', 'monster-hero/src/parts/82-card-battle-core.jsx', 'monster-hero/src/parts/89-card-pack.jsx'].map(read).join('\n;\n') + '\nthis.E={CARD_BATTLE_DATA,CARD_PACKS,cardPackOf,cardPackMonPool,cardPackAllCards,cardOpenPack,cardPackCardRates,cardNormalizeCollection,cardDeckProblems,cardCreateGame,cardUsableBy};', ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA, p = E.cardPackOf('p5');
const ids = ['C-208', 'C-208S', 'C-208V'], rarities = ['normal', 'kira', 'alt'];
const source = JSON.parse(read('tools/art-sources/card-battle/hybrid/cards.json')).monster;
assert.equal(new Set(source.map((m) => m.no)).size, source.length, '原本の番号は重複しない');
const old = { 'C-001': 1, '001': 3 };
const before = JSON.stringify(old);
ids.forEach((no, i) => {
  const m = db.monsters[no];
  assert.equal(m.name, 'オボロゲソウ');
  assert.equal(m.life, 10); assert.equal(m.type, 'ground');
  assert.equal(m.main, 'plant'); assert.equal(m.sub, 'jell');
  assert.equal(m.species, 'hybrid:C-208'); assert.equal(m.ready, true);
  assert(E.cardPackAllCards(db, p).monsters.includes(no));
  assert(E.cardPackMonPool(db, p, rarities[i]).includes(no));
  const pool = E.cardPackMonPool(db, p, rarities[i]);
  const rateRoll = [0, 0.86, 0.99][i];
  let calls = 0;
  const rand = () => ++calls <= 7 ? 0 : calls === 8 ? rateRoll : (pool.indexOf(no) + 0.5) / pool.length;
  const r = E.cardOpenPack(db, 'p5', { collection: old, pity: { p4: 6, p5: 0 } }, rand);
  assert.equal(r.cards[7].no, no); assert.equal(r.collection[no], 1);
  assert.equal(r.collection['C-001'], 1); assert.equal(r.collection['001'], 3);
  assert.equal(E.cardNormalizeCollection(JSON.parse(JSON.stringify(r.collection)))[no], 1);
  assert.equal(r.pity.p4, 6);
  assert.equal(JSON.stringify(old), before, '入力の旧コレクションを書き換えない');
  for (const c of Object.values(db.cards).filter((c) => c.ready && ['plant', 'jell'].includes(c.user))) {
    const guard = ['blk', 'dge'].includes(c.kind);
    assert.equal(E.cardUsableBy(c, { ...m, ko: false }), guard ? c.user === 'jell' : c.user === 'plant');
  }
  for (const size of ['s', 'l']) assert(fs.statSync(path.join(root, `monster-hero/images/card-battle/${size}/${m.img}.jpg`)).size > 0);
  // 7パック経過後でも別絵キラを選べ、当たれば天井がリセットされる。
  if (i === 2) {
    calls = 0;
    const pityHit = E.cardOpenPack(db, 'p5', { collection: {}, pity: { p5: 7 } }, rand);
    assert.equal(pityHit.cards[7].no, no); assert.equal(pityHit.pity.p5, 0); assert(pityHit.hit);
  }
});
E.CARD_PACKS.forEach((pack) => {
  const want = pack.no <= 3 || pack.no === 5 ? [85, 12, 3] : [85, 15, 0];
  assert.deepEqual(rarities.map((k) => pack.rarity[k]), want);
  assert.equal(want.reduce((a, b) => a + b), 100);
  rarities.forEach((k, i) => { if (want[i]) assert(E.cardPackMonPool(db, pack, k).length > 0); });
});
const starter = Object.values(db.starters)[0];
const deck = { ...starter, monsters: ['C-208', ...starter.monsters.slice(1)] };
assert.equal(E.cardDeckProblems(db, deck).length, 0);
assert(E.cardDeckProblems(db, { ...deck, monsters: ['C-208', 'C-208S', 'C-003'] }).some((x) => x.includes('同じモンスター')));
const game = E.cardCreateGame(db, { decks: [deck, starter], seed: 5, first: 0 });
assert.equal(game.players[0].mons[0].life, 10);
assert.equal(game.players[0].mons[0].no, 'C-208');
console.log('OK: オボロゲソウ3種類・画像・血統技・第5弾抽選/天井・保存復元・対戦生成');
console.log('第5弾候補数:', rarities.map((k) => `${k}=${E.cardPackMonPool(db, p, k).length}`).join(', '));
