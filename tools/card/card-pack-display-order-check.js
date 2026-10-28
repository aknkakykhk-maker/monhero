// 全8弾の表示順・カード/確率の保持・入力非変更を、売り場の実関数で検証する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ui = read('monster-hero/src/parts/87-card-deck-edit.jsx');
const pure = ui.slice(ui.indexOf('const CARD_RARITY_ORDER ='), ui.indexOf('// 詳しい画面は一覧の外'));
const ctx = vm.createContext({ console });
vm.runInContext(['monster-hero/data/card-battle-cards.js', 'monster-hero/src/parts/82-card-battle-core.jsx', 'monster-hero/src/parts/89-card-pack.jsx'].map(read).join('\n;\n') + '\n' + pure + '\nthis.E={CARD_BATTLE_DATA,CARD_PACKS,cardPackCardRates,cardPackDisplayRows,cardOpenPack,cardMonRarity};', ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA;
const family = (m) => m.no.replace(/[SV]$/, '');
const contiguous = (keys) => {
  const seen = new Set(); let last;
  for (const key of keys) { if (key !== last) { assert(!seen.has(key), `分断されたまとまり: ${key}`); seen.add(key); last = key; } }
};
const freeze = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
const seed = () => { let n = 100; return () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296); };
freeze(db);
for (const pack of E.CARD_PACKS) {
  const source = E.cardPackCardRates(db, pack.id);
  const before = JSON.stringify(source);
  const state = { collection: { 'C-001': 1, '001': 3 }, pity: { [pack.id]: 7 } };
  const openedBefore = JSON.stringify(E.cardOpenPack(db, pack.id, state, seed()));
  freeze(source);
  for (const kind of ['mon', 'tech']) {
    const rows = source[kind], sorted = E.cardPackDisplayRows(db, pack, rows);
    const ids = sorted.map((r) => r.no);
    assert.notEqual(sorted, rows, '入力配列をsortしない');
    assert.equal(new Set(ids).size, rows.length);
    assert.deepEqual([...ids].sort(), Array.from(rows, (r) => r.no).sort(), 'カードの抜け/追加が無い');
    assert(sorted.every((r) => rows.find((x) => x.no === r.no) === r), '確率を含む行は元と同じ');
    assert.deepEqual(Array.from(E.cardPackDisplayRows(db, pack, [...rows].reverse()), (r) => r.no), Array.from(ids), '入力順に依存しない');
    const users = [...pack.species, 'any', 'breeder'];
    const groups = sorted.map((r) => { const m = db.monsters[r.no]; return users.indexOf(m ? m.main || m.species : db.cards[r.no].user); });
    assert(groups.every((v, i) => i === 0 || groups[i - 1] <= v), '血統はパックの順');
    if (kind === 'mon') {
      const mons = sorted.map((r) => db.monsters[r.no]);
      contiguous(mons.map(family));
      mons.forEach((m, i) => {
        const prev = mons[i - 1];
        if (!prev) return;
        if ((m.main || m.species) === (prev.main || prev.species)) assert(!prev.main || m.main, '血統ごとに純血が先');
        if (family(prev) === family(m)) {
          const order = ['normal', 'kira', 'alt'];
          assert(order.indexOf(E.cardMonRarity(prev)) <= order.indexOf(E.cardMonRarity(m)), '同じ子は通常→キラ→別絵キラ');
        }
      });
    } else {
      const cards = sorted.map((r) => db.cards[r.no]);
      cards.forEach((c, i) => {
        const prev = cards[i - 1]; if (!prev || c.user !== prev.user) return;
        const kinds = ['pow', 'int', 'spe', 'blk', 'dge', 'fld'];
        assert(kinds.indexOf(prev.kind) <= kinds.indexOf(c.kind), '血統ごとに技の種類順');
      });
    }
  }
  assert.equal(JSON.stringify(source), before, '確率表を変更しない');
  assert.equal(JSON.stringify(E.cardOpenPack(db, pack.id, state, seed())), openedBefore, '抽選・重複・天井・保存結果を変えない');
  console.log(`OK: ${pack.name} カード${source.mon.length + source.tech.length}種類・表示順/カード/確率/抽選を保持`);
}
const p7 = E.CARD_PACKS.find((p) => p.id === 'p7');
const zilla = E.cardPackDisplayRows(db, p7, E.cardPackCardRates(db, p7.id).mon).filter((r) => db.monsters[r.no].species === 'zilla').map((r) => r.no);
assert.deepEqual(Array.from(zilla), ['C-031', 'C-031S', 'C-031R', 'C-031RS'], 'グジラの地上・水中は混ぜない');
console.log('すべてOK');
