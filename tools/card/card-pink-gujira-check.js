// ピンクグジラ(2026-10-30 社長「ピンクグジラ実装」)の3種類・第7弾・旧コレクション保持と天井を、実際の抽選/保存関数で検証する。
// オボロゲソウ(card-oborogesou-check.js)と同じ確かめ方。攻撃・特殊はグジラ、防御・回避はピクシーの技だけ使える
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = vm.createContext({ console });
vm.runInContext(['monster-hero/data/card-battle-cards.js', 'monster-hero/src/parts/82-card-battle-core.jsx', 'monster-hero/src/parts/89-card-pack.jsx'].map(read).join('\n;\n') + '\nthis.E={CARD_BATTLE_DATA,CARD_PACKS,cardPackOf,cardPackMonPool,cardPackAllCards,cardOpenPack,cardPackCardRates,cardNormalizeCollection,cardDeckProblems,cardCreateGame,cardUsableBy};', ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA, p = E.cardPackOf('p7');
const ids = ['C-068', 'C-068S', 'C-068V'], rarities = ['normal', 'kira', 'alt'];
const source = JSON.parse(read('tools/art-sources/card-battle/hybrid/cards.json')).monster;
assert.equal(new Set(source.map((m) => m.no)).size, source.length, '原本の番号は重複しない');
const old = { 'C-001': 1, '001': 3 };
const before = JSON.stringify(old);
ids.forEach((no, i) => {
  const m = db.monsters[no];
  assert.equal(m.name, 'ピンクグジラ');
  assert.equal(m.life, 6); assert.equal(m.type, 'water');
  assert.equal(m.main, 'zilla'); assert.equal(m.sub, 'pixie');
  assert.equal(m.species, 'hybrid:C-068'); assert.equal(m.ready, true);
  assert(E.cardPackAllCards(db, p).monsters.includes(no));
  assert(E.cardPackMonPool(db, p, rarities[i]).includes(no));
  const pool = E.cardPackMonPool(db, p, rarities[i]);
  const rateRoll = [0, 0.86, 0.99][i];
  let calls = 0;
  const rand = () => ++calls <= 7 ? 0 : calls === 8 ? rateRoll : (pool.indexOf(no) + 0.5) / pool.length;
  const r = E.cardOpenPack(db, 'p7', { collection: old, pity: { p4: 6, p7: 0 } }, rand);
  assert.equal(r.cards[7].no, no); assert.equal(r.collection[no], 1);
  assert.equal(r.collection['C-001'], 1); assert.equal(r.collection['001'], 3);
  assert.equal(E.cardNormalizeCollection(JSON.parse(JSON.stringify(r.collection)))[no], 1);
  assert.equal(r.pity.p4, 6);
  assert.equal(JSON.stringify(old), before, '入力の旧コレクションを書き換えない');
  for (const c of Object.values(db.cards).filter((c) => c.ready && ['zilla', 'pixie'].includes(c.user))) {
    const guard = ['blk', 'dge'].includes(c.kind);
    assert.equal(E.cardUsableBy(c, { ...m, ko: false }), guard ? c.user === 'pixie' : c.user === 'zilla');
  }
  for (const size of ['s', 'l']) assert(fs.statSync(path.join(root, `monster-hero/images/card-battle/${size}/${m.img}.jpg`)).size > 0);
  // 7パック経過後でも別絵キラを選べ、当たれば天井がリセットされる。
  if (i === 2) {
    calls = 0;
    const pityHit = E.cardOpenPack(db, 'p7', { collection: {}, pity: { p7: 7 } }, rand);
    assert.equal(pityHit.cards[7].no, no); assert.equal(pityHit.pity.p7, 0); assert(pityHit.hit);
  }
});
E.CARD_PACKS.forEach((pack) => {
  const want = pack.no <= 3 || pack.no === 5 || pack.no === 7 ? [85, 12, 3] : [85, 15, 0]; // 第7弾はピンクグジラ(2026-10-30)で 85/12/3
  assert.deepEqual(rarities.map((k) => pack.rarity[k]), want);
  assert.equal(want.reduce((a, b) => a + b), 100);
  rarities.forEach((k, i) => { if (want[i]) assert(E.cardPackMonPool(db, pack, k).length > 0); });
});
const starter = Object.values(db.starters)[0];
const deck = { ...starter, monsters: ['C-068', ...starter.monsters.slice(1)] };
assert.equal(E.cardDeckProblems(db, deck).length, 0);
assert(E.cardDeckProblems(db, { ...deck, monsters: ['C-068', 'C-068S', 'C-003'] }).some((x) => x.includes('同じモンスター')));
const game = E.cardCreateGame(db, { decks: [deck, starter], seed: 5, first: 0 });
assert.equal(game.players[0].mons[0].life, 6);
assert.equal(game.players[0].mons[0].no, 'C-068');
// 立ち絵・顔アイコン(場・図鑑・VS で出る)が番号から引ける
const ally = read('monster-hero/data/images/images-ally.js');
ids.forEach((no) => { assert(new RegExp(`'${no}': HYBRID_C068_IMG`).test(ally), `${no} の立ち絵`); assert(new RegExp(`'${no}': HYBRID_C068_FACE_ICON`).test(ally), `${no} の顔`); });
for (const f of ['images/monsters/c068.png', 'images/monster-icons/face/c068.png']) assert(fs.statSync(path.join(root, 'monster-hero', f)).size > 0);
console.log('OK: ピンクグジラ3種類・画像・立ち絵・顔・血統技・第7弾抽選/天井・保存復元・対戦生成');
console.log('第7弾候補数:', rarities.map((k) => `${k}=${E.cardPackMonPool(db, p, k).length}`).join(', '));

// 配信の絵(s・l)が、元の絵(tools/art-sources/card-battle/hybrid/C068*.jpg)と同じ見た目か。
// card-image-build の NO_COPYRIGHT に入れ忘れると、下の帯が塗られて名前の「ラ」が縞に化ける(2026-10-30 テスターさんの知らせ)
(async () => {
  const sharp = require(path.join(root, 'tools', 'node_modules', 'sharp'));
  for (const no of ids) {
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
