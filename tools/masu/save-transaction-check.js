const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 複数キーをまとめて保存する取引関数 saveStoredValuesOrRollback の挙動を固定する。
//
//   node tools/masu/save-transaction-check.js
//
// 【なぜ要るか】
// 合体・限界突破・超越・転生・再生・マーケット購入・超越の実は、mh_masu_mons と mh_gold と
// mh_owned_items のように複数の保存キーを同時に書く。片方だけ保存されると「ダイヤは減ったのに
// 個体は変わっていない」状態になり、セーブデータの整合が壊れる(TECH_DEBT_AUDIT.md TD-02)。
// この関数はそれを防ぐ唯一の正本なので、書く→読み戻す→食い違えば全部戻す、を実際に走らせて確かめる。
//
// 【見かた】
// storeGet / storeSet を差し替えて呼び、成功・読み戻し不一致・途中の例外・巻き戻し自体の失敗、
// のそれぞれで「保存先が全部 before か全部 next のどちらかにしかならない」ことを見る。
const path = require('path');
const { loadDyeModule } = require(path.join(TOOLS_DIR, 'harness'));
const api = loadDyeModule();

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const makeStore = (initial, { failWriteOn = null, corruptReadOn = null, failRollbackOn = null } = {}) => {
  const storage = { ...initial };
  const writes = [];
  let phase = 'write';
  const setValue = async (key, value, sync) => {
    writes.push({ key, value, sync, phase });
    if (phase === 'write' && key === failWriteOn) throw new Error(`write failed: ${key}`);
    if (phase === 'rollback' && key === failRollbackOn) throw new Error(`rollback failed: ${key}`);
    storage[key] = value;
  };
  const getValue = async (key, fallback) => {
    phase = 'readback';
    if (key === corruptReadOn) return { corrupted:true };
    return key in storage ? storage[key] : fallback;
  };
  const wrappedGet = async (...args) => { const v = await getValue(...args); phase = 'rollback'; return v; };
  return { storage, writes, getValue: wrappedGet, setValue };
};

const before = { mh_masu_mons:[{ id:'a', bondXp:1 }], mh_gold:500, mh_owned_items:{ rainbow_psyche:3 } };
const entries = (s) => [
  { key:'mh_masu_mons', before:s.mh_masu_mons, next:[{ id:'a', bondXp:99 }] },
  { key:'mh_gold', before:s.mh_gold, next:400 },
  { key:'mh_owned_items', before:s.mh_owned_items, next:{ rainbow_psyche:2 } },
];
const allNext = (storage, list) => list.every(e => same(storage[e.key], e.next));
const allBefore = (storage, list) => list.every(e => same(storage[e.key], e.before));

(async () => {
  check('取引関数が公開されている', typeof api.saveStoredValuesOrRollback === 'function');

  // 1. 成功
  {
    const st = makeStore(before);
    const list = entries(before);
    const ok = await api.saveStoredValuesOrRollback(list, st.getValue, st.setValue);
    check('全部書けて読み戻しも一致すれば true で、3キーとも次の値になる', ok === true && allNext(st.storage, list));
    check('保存は sync=false(遅延書き)で呼ぶ', st.writes.every(w => w.sync === false));
    check('成功時は巻き戻しを書かない', st.writes.length === 3);
  }
  // 2. 途中の書き込みで例外
  {
    const st = makeStore(before, { failWriteOn:'mh_gold' });
    const list = entries(before);
    const ok = await api.saveStoredValuesOrRollback(list, st.getValue, st.setValue);
    check('1キーの保存が例外なら false で、先に書けたキーも含め全部 before へ戻す', ok === false && allBefore(st.storage, list));
  }
  // 3. 書けたが読み戻しが一致しない
  {
    const st = makeStore(before, { corruptReadOn:'mh_owned_items' });
    const list = entries(before);
    const ok = await api.saveStoredValuesOrRollback(list, st.getValue, st.setValue);
    check('読み戻した値が 1 つでも違えば false で全部 before へ戻す', ok === false && allBefore(st.storage, list));
  }
  // 4. 巻き戻し自体が一部失敗しても残りは戻す(allSettled)
  {
    const st = makeStore(before, { corruptReadOn:'mh_gold', failRollbackOn:'mh_masu_mons' });
    const list = entries(before);
    const ok = await api.saveStoredValuesOrRollback(list, st.getValue, st.setValue).catch(() => 'threw');
    check('巻き戻しで例外が出ても投げずに false を返し、残りのキーは before へ戻す',
      ok === false && same(st.storage.mh_gold, before.mh_gold) && same(st.storage.mh_owned_items, before.mh_owned_items));
  }
  // 5. 空・不正な entries
  {
    const st = makeStore(before);
    const ok = await api.saveStoredValuesOrRollback([], st.getValue, st.setValue);
    const ok2 = await api.saveStoredValuesOrRollback(null, st.getValue, st.setValue);
    check('entries が空や不正でも例外にならず true(何も書かない)', ok === true && ok2 === true && st.writes.length === 0);
  }
  // 6. 既存の2本は同じ正本を通る薄い包みになっている
  {
    const st = makeStore(before, { failWriteOn:'mh_owned_items' });
    const ok = await api.saveMarketBalances(before.mh_gold, before.mh_owned_items, 400, { rainbow_psyche:2 }, st.getValue, st.setValue);
    check('saveMarketBalances: 片方失敗で両方 before へ戻す', ok === false && st.storage.mh_gold === 500 && same(st.storage.mh_owned_items, before.mh_owned_items));
    const st2 = makeStore(before, { corruptReadOn:'mh_masu_mons' });
    const ok2 = await api.saveTranscendFruitPair(before.mh_masu_mons, before.mh_owned_items, [{ id:'a', bondXp:5 }], { rainbow_psyche:1 }, st2.getValue, st2.setValue);
    check('saveTranscendFruitPair: 読み戻し不一致で両方 before へ戻す', ok2 === false && same(st2.storage.mh_masu_mons, before.mh_masu_mons) && same(st2.storage.mh_owned_items, before.mh_owned_items));
  }
  // 7. 本体側で採用している箇所(合体・限界突破・超越・転生・再生)が取引関数を通している
  {
    const fs = require('fs');
    const src = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero/src/parts/60-app.jsx'), 'utf8');
    const between = (from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a); return a < 0 || b < 0 ? '' : src.slice(a, b); };
    const sites = [
      ['合体', between('const executeMasuFusion', 'const resetFusionFlow'), ['mh_masu_mons', 'mh_gold', 'mh_owned_items']],
      ['限界突破', between('const executeMasuBreakthrough', 'const executeMasuTranscendence'), ['mh_masu_mons', 'mh_gold', 'mh_owned_items']],
      ['超越', between('const executeMasuTranscendence', 'const commitTranscendPlan'), ['mh_masu_mons', 'mh_gold', 'mh_owned_items']],
      ['転生', between('const executeMasuReincarnation', 'const executeMasuRegeneration'), ['mh_masu_mons', 'mh_gold']],
      ['再生', between('const executeMasuRegeneration', 'const executeMasuDonation'), ['mh_masu_mons', 'mh_gold', 'mh_temple_regeneration_used_v1']],
    ];
    for (const [label, body, keys] of sites) {
      check(`${label}: saveStoredValuesOrRollback で ${keys.join(' / ')} をまとめて保存し、失敗時は先へ進まない`,
        body.includes('const saved = await saveStoredValuesOrRollback([')
        && keys.every(k => body.includes(`{ key:'${k}',`))
        && !/await storeSet\('mh_(masu_mons|gold|owned_items|temple_regeneration_used_v1)'/.test(body)
        && body.includes('if (!saved) throw new Error('));
    }
    const exchange = between('const commitTranscendExchange', 'const commitTranscendPlan') || between('const commitTranscendExchange', '  };\n  // ');
    check('超越交換: 既存の saveTranscendFruitPair(同じ正本の包み)を通す', exchange.includes('const saved = await saveTranscendFruitPair(masuMonsRef.current, ownedItemsRef.current, next, nextItems, storeGet, storeSet);'));
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
