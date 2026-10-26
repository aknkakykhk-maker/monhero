// 前のカードポイントを、ビートPへ1回だけ移す処理(82-card-battle-core.jsx の cardMigratePointsOnce)を確かめる。
// 2026-10-26 社長「カードポイントを廃止してビートポイントにして」「ビートPに1回だけ移す」。
//   ・印が無い → 前のカードポイントをビートPに足し、印を立てる
//   ・印がある → 足さない(二度目に開いても増えない)
//   ・壊れた値・0以下 → 足さない(印は立つ)
//   ・前のキー(mh_card_point_v1)は消さない・書き換えない
//   ・保存に失敗したら、印もビートPも元のまま(次に開いたときに1回だけ足される)
// 保存は本物と同じ取引(11-masu-progression.jsx の saveStoredValuesOrRollback)を持ち込み、保存先だけ偽物にする。
// 使い方: node tools/card/card-point-migration-check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const masu = fs.readFileSync(path.join(PARTS, '11-masu-progression.jsx'), 'utf8');
const saveSrc = masu.slice(masu.indexOf('const saveStoredValuesOrRollback = async'), masu.indexOf('const saveTranscendFruitPair'));
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Promise });
vm.runInContext(`${fs.readFileSync(path.join(PARTS, '82-card-battle-core.jsx'), 'utf8')}\n;\n${saveSrc}\n;\n`
  + 'this.E = { cardMigratePointsOnce, cardPointMigrationAmount, CARD_POINT_MIGRATED_KEY, CARD_POINT_STORE_KEY, CARD_SAVE_KEYS, saveStoredValuesOrRollback };', ctx);
const E = ctx.E;

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 偽物の保存先(storeGet / storeSet と同じ呼び方)。failWrites が真のあいだは、ビートPのキーへ書いたものが読み戻せない(保存の失敗)
const makeStore = (init) => {
  const data = { ...init };
  const st = { data, failWrites: false };
  st.get = async (k, def) => (k in data && data[k] !== null && data[k] !== undefined ? JSON.parse(JSON.stringify(data[k])) : def);
  st.set = async (k, v) => { if (st.failWrites && k === E.CARD_POINT_STORE_KEY && v !== init[k]) { data[k] = 'broken'; return; } if (v === null || v === undefined) delete data[k]; else data[k] = JSON.parse(JSON.stringify(v)); };
  return st;
};
const run = (st) => E.cardMigratePointsOnce(st.get, st.set, E.saveStoredValuesOrRollback);
const LEGACY = E.CARD_SAVE_KEYS.point;
const BEAT = E.CARD_POINT_STORE_KEY;
const FLAG = E.CARD_POINT_MIGRATED_KEY;

(async () => {
  check('キーの名前(前のカードポイント・ビートP・印)', LEGACY === 'mh_card_point_v1' && BEAT === 'mh_rhythm_event_points_v1' && FLAG === 'mh_card_points_to_beatp_migrated_v1', JSON.stringify({ LEGACY, BEAT, FLAG }));
  check('印は CARD_SAVE_KEYS に入っていない(デバッグの「記録を消す」で消えて、もう一度足されないように)', !Object.values(E.CARD_SAVE_KEYS).includes(FLAG));

  // ① 印が無い → 足して印を立てる。前のキーはそのまま
  const a = makeStore({ [LEGACY]: 450, [BEAT]: 1200 });
  const r1 = await run(a);
  check('① 印が無い: 前のカードポイントをビートPに足し、印を立てる', r1.added === 450 && a.data[BEAT] === 1650 && a.data[FLAG] === true, JSON.stringify({ r1, data: a.data }));
  check('① 前のキー(mh_card_point_v1)は消さない・書き換えない', a.data[LEGACY] === 450);
  // ② 二度目 → 足さない
  const r2 = await run(a);
  check('② 印がある: 二度目に開いても足さない', r2.added === 0 && a.data[BEAT] === 1650, JSON.stringify({ r2, beat: a.data[BEAT] }));
  // ③ はじめから印がある → 足さない
  const b = makeStore({ [LEGACY]: 300, [BEAT]: 10, [FLAG]: true });
  const r3 = await run(b);
  check('③ はじめから印がある: 足さない', r3.added === 0 && b.data[BEAT] === 10 && b.data[LEGACY] === 300, JSON.stringify({ r3, data: b.data }));
  // ④ 壊れた値・0以下・無い → 足さない(印は立つ)
  for (const bad of ['abc', -5, 0, {}, [3], true, NaN, Infinity, undefined]) {
    const c = makeStore(bad === undefined ? { [BEAT]: 70 } : { [LEGACY]: bad, [BEAT]: 70 });
    const r = await run(c);
    check(`④ 壊れた値(${JSON.stringify(bad) ?? 'なし'})は足さない`, r.added === 0 && c.data[BEAT] === 70 && c.data[FLAG] === true, JSON.stringify({ r, data: c.data }));
  }
  // ⑤ 数の文字列・小数は、数として読めるものだけ切り捨てで足す
  const d = makeStore({ [LEGACY]: '120.9' });
  const r5 = await run(d);
  check('⑤ 数として読める文字列は切り捨てて足す(ビートPが無い人は0から)', r5.added === 120 && d.data[BEAT] === 120, JSON.stringify({ r5, data: d.data }));
  // ⑥ 保存に失敗 → 印もビートPも元のまま。次に開いたときに1回だけ足される
  const f = makeStore({ [LEGACY]: 500, [BEAT]: 40 });
  f.failWrites = true;
  const r6 = await run(f);
  check('⑥ 保存に失敗したら、印もビートPも元のまま', r6.added === 0 && r6.saved === false && f.data[BEAT] === 40 && f.data[FLAG] === undefined, JSON.stringify({ r6, data: f.data }));
  f.failWrites = false;
  const r7 = await run(f);
  const r8 = await run(f);
  check('⑥ 次に開いたときに1回だけ足される', r7.added === 500 && r8.added === 0 && f.data[BEAT] === 540, JSON.stringify({ r7, r8, beat: f.data[BEAT] }));

  console.log(failed ? `\n${failed}件のNG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
