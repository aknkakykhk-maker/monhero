// モンヒロサクセスの合体(56-monsuc-fuse.jsx)の保存の順番と、失敗したときに何も消えないことを確かめる(画面は開かない)
//   ・記録 mh_monsuc_fuse_v1 を先に書き、そのあと箱を1回で書く
//   ・記録が書けない / 箱が書けない → 箱は前のまま(親2体とも残る)
//   ・同じ2体で2回押しても子は1体(id が親2体から決まる)・編成などの子は使えない・未育成の子は使えない
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, ROOT } = require('./load.js');

const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };
const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', '56-monsuc-fuse.jsx'), 'utf8');
const head = src.slice(0, src.indexOf('function MonsucFuseSheet'));
ok(head.length > 1000, '56-monsuc-fuse.jsx の計算の部分が見つからない');
const { SUC, deps } = load();
const ctx = vm.createContext({ ALL_PLAYER_MONSTERS: deps.ALL_PLAYER_MONSTERS, RELEASE_FLAGS: { monheroSuccess: false }, JSON, Date, Math, Number, Set, Array, Object, String });
vm.runInContext(head + '\n;globalThis.__f = { monsucFuse, monsucFuseApply, normalizeMonsucFuse, monsucFuseOn, MONSUC_FUSE_KEY };', ctx, { filename: '56-monsuc-fuse.jsx' });
const F = ctx.__f;

const mk = (id, sp, v, extra) => ({ id, species: sp, nick: id.toUpperCase(), raised: true, gen: 1, st: { life: v, pow: v, wise: v, hit: v, eva: v, tough: v }, techs: [], gt: 2, rank: 'A', ...(extra || {}) });
const boxOf = () => ({ v: 1, cap: 30, mons: [mk('a', 'Undine', 800), mk('b', 'Mocchi', 700), mk('c', 'Golem', 600), { ...mk('d', 'Mocchi', 300), raised: false }], memory: [] });
const ioOf = (failLog) => { const mem = {}; const order = []; return { mem, order, io: { get: async (k) => mem[k] ?? null, set: async (k, v) => { order.push(k); if (failLog) return false; mem[k] = JSON.parse(JSON.stringify(v)); return true; } } }; };

(async () => {
  ok(F.monsucFuseOn() === false, '公開の印が偽なのに合体が開ける');
  // うまくいく
  {
    let box = boxOf(); const before = JSON.stringify(box); const t = ioOf(false);
    const saveBox = async (next) => { t.order.push('box'); box = next; return true; };
    const r = await F.monsucFuse({ box, saveBox, mainId: 'a', matId: 'b', suc: SUC, at: '2026-11-12 10:00', io: t.io });
    ok(r === true, `合体できない(${r})`);
    ok(t.order.join(',') === `${F.MONSUC_FUSE_KEY},box`, `記録より先に箱を書いている(${t.order})`);
    ok(box.mons.length === 3 && !box.mons.some(m => m.id === 'a' || m.id === 'b'), '親2体が保存枠から外れていない');
    const child = box.mons[box.mons.length - 1];
    ok(child.species === 'Yaobikuni' && child.raised === false && child.gen === 2 && child.id === SUC.fuseId('a', 'b'), '生まれた子が違う');
    ok(box.memory.length === 2 && box.memory.every(m => m.rank === 'A' && m.gen === 1 && m.nick), '思い出に名前・ランク・代が残らない');
    const log = F.normalizeMonsucFuse(t.mem[F.MONSUC_FUSE_KEY]);
    ok(log.log.length === 1 && log.log[0].parents.length === 2 && log.log[0].parents[0].st.life === 800, '記録に親2体の中身が残らない');
    ok(JSON.parse(before).mons.length === 4, '元の箱を書き換えている');
    // 同じ2体の子がもういれば何もしない
    const again = F.monsucFuseApply({ ...boxOf(), mons: [...boxOf().mons, child] }, SUC.fusePlan(mk('a', 'Undine', 800), mk('b', 'Mocchi', 700)), '');
    ok(again === null, '同じ2体の子が2体になる');
  }
  // 記録が書けない → 何も変えない
  {
    const box = boxOf(); const t = ioOf(true); let wrote = false;
    const r = await F.monsucFuse({ box, saveBox: async () => { wrote = true; return true; }, mainId: 'a', matId: 'b', suc: SUC, io: t.io });
    ok(r !== true && !wrote && box.mons.length === 4, '記録が書けないのに箱を書いた');
  }
  // 箱が書けない → 親は消えない
  {
    let box = boxOf(); const t = ioOf(false);
    const r = await F.monsucFuse({ box, saveBox: async () => false, mainId: 'a', matId: 'b', suc: SUC, io: t.io });
    ok(r !== true && box.mons.length === 4 && box.mons.some(m => m.id === 'a') && box.mons.some(m => m.id === 'b'), '箱が書けないのに親が消えた');
  }
  // 箱の保存が例外を投げる(回3の storeSet の形) → 親は消えない / onSave の名前でも受ける
  {
    const box = boxOf(); const t = ioOf(false);
    const r = await F.monsucFuse({ box, onSave: async () => { throw new Error('quota'); }, mainId: 'a', matId: 'b', suc: SUC, io: t.io });
    ok(r !== true && box.mons.length === 4, '箱の保存が例外のときに合体したことになる');
    let got = null; const r2 = await F.monsucFuse({ box: boxOf(), onSave: async (n) => { got = n; return true; }, mainId: 'a', matId: 'b', suc: SUC, io: ioOf(false).io });
    ok(r2 === true && got && got.mons.some(m => m.id === SUC.fuseId('a', 'b') && Array.isArray(m.mast) && m.parents.join() === 'a,b'), 'onSave で合体できない・子の形が回3の箱と違う');
  }
  // 書く直前に箱を読み直す: 開いたあとに足されたモンスターを消さない・親がもういなければ何もしない(ミハリ5)
  {
    const later = { ...boxOf(), mons: [...boxOf().mons, mk('e', 'Ham', 500)] };
    let got = null;
    const r = await F.monsucFuse({ box: boxOf(), readBox: async () => later, onSave: async (n) => { got = n; return true; }, mainId: 'a', matId: 'b', suc: SUC, io: ioOf(false).io });
    ok(r === true && got && got.mons.some(m => m.id === 'e') && got.mons.length === 4, '開いたあとに箱へ足されたモンスターが合体で消える');
    let wrote = false;
    const gone = { ...boxOf(), mons: boxOf().mons.filter(m => m.id !== 'b') };
    const r2 = await F.monsucFuse({ box: boxOf(), readBox: () => gone, onSave: async () => { wrote = true; return true; }, mainId: 'a', matId: 'b', suc: SUC, io: ioOf(false).io });
    ok(r2 !== true && !wrote, '読み直した箱に親がいないのに合体する');
  }
  // 使えない子
  {
    const t = ioOf(false); const box = boxOf(); const save = async () => true;
    ok(await F.monsucFuse({ box, saveBox: save, mainId: 'a', matId: 'b', locked: ['b'], suc: SUC, io: t.io }) !== true, '編成・貸し出し中の子を合体に使える');
    ok(await F.monsucFuse({ box, saveBox: save, mainId: 'a', matId: 'd', suc: SUC, io: t.io }) !== true, '未育成の子を合体に使える');
    ok(await F.monsucFuse({ box, saveBox: save, mainId: 'a', matId: 'a', suc: SUC, io: t.io }) !== true, '同じ子どうしで合体できる');
    ok(await F.monsucFuse({ box, saveBox: save, mainId: 'a', matId: 'zz', suc: SUC, io: t.io }) !== true, '箱にいない子で合体できる');
  }
  // 二重押し(同時に2回呼んでも1回)
  {
    let box = boxOf(); const t = ioOf(false); let n = 0;
    const saveBox = async (next) => { n += 1; box = next; return true; };
    const [r1, r2] = await Promise.all([F.monsucFuse({ box, saveBox, mainId: 'a', matId: 'c', suc: SUC, io: t.io }), F.monsucFuse({ box, saveBox, mainId: 'a', matId: 'c', suc: SUC, io: t.io })]);
    ok([r1, r2].filter(x => x === true).length === 1 && n === 1, '同時に2回押すと2回合体する');
  }
  // 壊れた記録でも落ちない
  ok(F.normalizeMonsucFuse({ seq: 'x', log: [null, 5, { child: 3 }, { child: 'f1', parents: 'no' }] }).log.length === 1, '壊れた記録を読めない');

  if (errors.length) { console.error(`NG monsuc-fuse-check: ${errors.length}件`); errors.forEach(e => console.error('  - ' + e)); process.exit(1); }
  console.log('OK monsuc-fuse-check: 記録が先・箱は1回・失敗で何も消えない・二重押し・使えない子・思い出');
})();
