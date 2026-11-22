// 助手ライフ 段10: 助手どうしの台本(掛け合い・ミニイベント・けんか/仲直り・3人・関係の出来事)の数と中身が変わらないかを確かめる。ブラウザは使わない。
//   node tools/assistant/life-script-count-check.js           控え(life-script-count-baseline.json)と比べる
//   node tools/assistant/life-script-count-check.js --save    控えを作り直す(台本を足した・直したときだけ)
// 見るもの(公開の印 assistantLife が 偽 / 真 の両方):
//   ① 思い出アルバムで見返せる台本(assistantPeerAllTalks)の id と種類ごとの数
//   ② けんか・仲直り(assistantPeerExtraTalks().quarrels)の id・組・つながり(makeupId / quarrelId)・中身
//   ③ 関係の出来事の台本(ASSISTANT_LIFE_REL_TALKS)の種類ごとの数
//   どれも id が消えた・増えた・中身が変わった物を名前で出す(思い出アルバムとけんかの保存は id で覚えているので、id は変えない)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
const BASE = path.join(__dirname, 'life-script-count-baseline.json');
const save = process.argv.includes('--save');

const hash = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 12);
const codeOf = new Map();
const srcOf = (rel) => {
  if (codeOf.has(rel)) return codeOf.get(rel);
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const code = rel.endsWith('.jsx') ? babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code : src;
  codeOf.set(rel, code);
  return code;
};

const snapshot = (lifeOn) => {
  const ctx = vm.createContext({
    console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Promise, RegExp, Infinity,
    React: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useCallback: (f) => f, useMemo: (f) => f() },
    storeGet: async (k, d) => d, storeSet: () => {},
    RELEASE_FLAGS: { assistantPeer: true, assistantLife: lifeOn },
  });
  for (const rel of ['monster-hero/data/assistants.js', 'monster-hero/data/assistant-life-rel-talks.js']) vm.runInContext(srcOf(rel), ctx);
  vm.runInContext('var assistantBubbleDayKey = () => "2026-11-22"; var assistantPeerDayKey = () => "2026-11-22"; var jstDayKey4 = () => "2026-11-22"; var assistantById = (id) => ASSISTANTS.find(a => a.id === id); var AssistantFace = () => null;', ctx);
  for (const rel of ['56-assistant-peer.jsx', '56-assistant-life.jsx', '56-assistant-life-house.jsx', '56-assistant-life-rel.jsx']) vm.runInContext(srcOf(`monster-hero/src/parts/${rel}`), ctx);
  const G = (e) => vm.runInContext(e, ctx);
  const all = G('assistantPeerAllTalks()');
  const kinds = {};
  const album = {};
  for (const t of all) { const k = t.kind || 'pair'; kinds[k] = (kinds[k] || 0) + 1; album[t.id] = hash({ kind: k, pair: t.pair || null, trio: t.trio || null, lines: t.lines }); }
  const quarrels = {};
  for (const t of G('assistantPeerExtraTalks().quarrels')) {
    quarrels[t.id] = hash({ kind: t.kind, pair: t.pair, lv: t.lv, scene: t.scene, makeupId: t.makeupId || null, quarrelId: t.quarrelId || null, lines: t.lines, distance: t.distance || null, cause: t.cause || null, life: !!t.life, rel: t.rel || null, at: t.at || null, tods: t.tods || null });
  }
  const relKinds = {};
  for (const t of G('typeof ASSISTANT_LIFE_REL_TALKS !== "undefined" ? ASSISTANT_LIFE_REL_TALKS : []')) relKinds[t.kind] = (relKinds[t.kind] || 0) + 1;
  return { albumCount: all.length, kinds, albumOrder: hash(all.map(t => t.id)), album, quarrelCount: Object.keys(quarrels).length, quarrelOrder: hash(Object.keys(quarrels)), quarrels, relKinds };
};

const now = { off: snapshot(false), on: snapshot(true) };
if (save) {
  fs.writeFileSync(BASE, `${JSON.stringify(now, null, 1)}\n`);
  console.log(`控えを書いた: ${path.relative(root, BASE)}(印 偽: アルバム ${now.off.albumCount}本・けんか ${now.off.quarrelCount} / 印 真: アルバム ${now.on.albumCount}本・けんか ${now.on.quarrelCount})`);
  process.exit(0);
}
if (!fs.existsSync(BASE)) { console.log('NG: 控えが無い(--save で作る)'); process.exit(1); }
const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const diffMap = (a, b) => {
  const gone = Object.keys(a).filter(k => !(k in b));
  const added = Object.keys(b).filter(k => !(k in a));
  const changed = Object.keys(a).filter(k => k in b && a[k] !== b[k]);
  return { gone, added, changed, txt: [gone.length ? `消えた ${gone.length}(${gone.slice(0, 3).join(' ')})` : '', added.length ? `増えた ${added.length}(${added.slice(0, 3).join(' ')})` : '', changed.length ? `中身が変わった ${changed.length}(${changed.slice(0, 3).join(' ')})` : ''].filter(Boolean).join(' / ') };
};
for (const side of ['off', 'on']) {
  const b = base[side], n = now[side];
  const label = side === 'off' ? '印 偽' : '印 真';
  check(`① ${label}: 思い出アルバムの台本 ${n.albumCount}本(控え ${b.albumCount})`, n.albumCount === b.albumCount && JSON.stringify(n.kinds) === JSON.stringify(b.kinds), JSON.stringify(n.kinds));
  const a = diffMap(b.album, n.album);
  check(`① ${label}: アルバムの id と中身が同じ`, !a.txt, a.txt);
  const q = diffMap(b.quarrels, n.quarrels);
  check(`② ${label}: けんか・仲直り ${n.quarrelCount}本(控え ${b.quarrelCount})の id・つながり・中身が同じ`, !q.txt, q.txt);
  check(`④ ${label}: 並び順が同じ(アルバム・けんか)`, n.albumOrder === b.albumOrder && n.quarrelOrder === b.quarrelOrder);
  check(`③ ${label}: 関係の出来事の台本の数`, JSON.stringify(n.relKinds) === JSON.stringify(b.relKinds), JSON.stringify(n.relKinds));
}
console.log(failed ? `NG ${failed}件` : 'OK');
process.exit(failed ? 1 : 0);
