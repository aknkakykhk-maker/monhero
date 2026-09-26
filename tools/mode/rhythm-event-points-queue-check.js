#!/usr/bin/env node
'use strict';
// ビートP(mh_rhythm_event_points_v1)を「待たずに続けて足しても」取りこぼさないかを、
// 本物の保存の関数(src/parts/25-storage.jsx)を vm で動かして確かめる。
//
//   node tools/mode/rhythm-event-points-queue-check.js
//
// 【なぜ要るか】(2026-09-26)
// addRhythmEventPoints は「読む → 待つ → 足して書く」の作りで、曲の終わりに
// 本体のビートPとラッキーラッシュのおまけを await せずに続けて呼んでいた。
// 2回とも同じ古い値を読み、あとから書いたおまけだけが残って、本体のぶんが消えていた
// (09-25 のラッキーラッシュ追加から)。いまは順番待ちにしてあり、ここでそれを見張る。
// 画面に何も出ないまま保存だけが食い違う不具合なので、静的な文字列ではなく実際に足して数える。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/25-storage.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const makeContext = () => {
  const data = new Map();
  const localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
  const window = { localStorage };
  const ctx = { window, localStorage, console, JSON, Math, Number, String, Array, Object, Promise, Map, Set, Date, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(`${src}\n;globalThis.__api={addRhythmEventPoints,loadRhythmEventPoints,RHYTHM_EVENT_POINTS_KEY};`, ctx, { filename: '25-storage.jsx' });
  return { api: ctx.__api, data };
};

(async () => {
  {
    const { api } = makeContext();
    await api.addRhythmEventPoints(1000);
    // 曲の終わりと同じ呼び方: 本体とおまけを待たずに続けて足す
    const a = api.addRhythmEventPoints(120);
    const b = api.addRhythmEventPoints(8);
    await Promise.all([a, b]);
    const now = await api.loadRhythmEventPoints();
    check('待たずに続けて足しても、両方のぶんが残る', now === 1128, `1000 + 120 + 8 → ${now}`);
  }
  {
    const { api } = makeContext();
    const results = await Promise.all([5, 10, 20, 40].map((n) => api.addRhythmEventPoints(n)));
    const now = await api.loadRhythmEventPoints();
    check('4回続けて足しても、合計が合う', now === 75, `0 + 5 + 10 + 20 + 40 → ${now}`);
    check('それぞれの戻り値の「増えた量」も足した量のとおり', results.map((r) => r.added).join(',') === '5,10,20,40',
      results.map((r) => r.added).join(','));
  }
  {
    const { api } = makeContext();
    await api.addRhythmEventPoints(50);
    const r = await Promise.all([api.addRhythmEventPoints(0), api.addRhythmEventPoints(-3), api.addRhythmEventPoints('abc'), api.addRhythmEventPoints(7)]);
    const now = await api.loadRhythmEventPoints();
    check('0・負の数・数でない値は足さず、あとの足し算も止めない', now === 57 && r[0].added === 0 && r[1].added === 0 && r[2].added === 0, `→ ${now}`);
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
