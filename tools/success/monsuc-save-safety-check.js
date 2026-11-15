#!/usr/bin/env node
// モンサクの保存の安全(r1115-171): 保存の失敗・再試行・古い画面からの保存・中断直後の再開を、本物の関数を切り出して確かめる。
//   (a) 引退: 成績・子・記録帳のどれかが書けないと ok にしない/再試行で足りない分だけ補う(引退回数・ベスト・子が二重にならない)/古い meta も読める
//   (b) 途中の育成の保存: 渡したビートPを 100→50→100 で保存しても財布は +100 だけ/消した育成を古い画面が書き戻さない/前のターンで巻き戻さない
//   (c) 中断: 並べた保存が終わってから読む(msxSaveWait)/begin・intro を保存から戻す
// 使い方: node tools/success/monsuc-save-safety-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const STORE = read('56-monhero-success-store.jsx');
const R3 = read('56-monhero-success-r3-store.jsx');
const MAIN = read('56-monhero-success-main.jsx');
const cut = (src, a, b) => { const i = src.indexOf(a); const j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error(`切り出せません: ${a}`); return src.slice(i, j); };

let fail = 0; let pass = 0;
const ok = (cond, msg) => { if (cond) pass += 1; else { fail += 1; console.log(`✗ ${msg}`); } };
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

// 端末の保存のにせもの。failKeys に入れたキーは書けない(storeSet が false を返す・本物と同じ)
const makeEnv = () => {
  const store = {}; const failKeys = new Set();
  const storeGet = async (k, d) => (k in store && store[k] !== null ? clone(store[k]) : d);
  const storeSet = async (k, v) => { await Promise.resolve(); if (failKeys.has(k)) return false; store[k] = clone(v); return true; };
  return { store, failKeys, storeGet, storeSet };
};

// ---- (b)(c) 途中の育成の保存 ----
const saveSrc = cut(STORE, 'let msxSaveChain', 'const msxSaveMeta');
const makeSave = (env) => {
  const RHYTHM_EVENT_POINTS_KEY = 'wallet';
  const MSX_KEYS = { run: 'mh_monsuc_run_v1', box: 'mh_monsuc_box_v1', meta: 'mh_monsuc_meta_v1' };
  const MSX_RUN_OVER_KEY = 'mh_monsuc_run_over_v1';
  const msxRunOverOf = () => null;
  const loadRhythmEventPoints = async () => Number(env.store.wallet) || 0;
  const saveStoredValuesOrRollback = async (list, get, set) => { for (const x of list) if ((await set(x.key, x.next)) === false) return false; return true; };
  const { storeGet, storeSet } = env;
  // eslint-disable-next-line no-eval
  return eval(`${saveSrc}; ({ msxSaveRun, msxClearRun, msxSaveWait, MSX_RUN_GONE_KEY })`);
};
const RUN = 'mh_monsuc_run_v1';
const runOf = (id, turn, sent, extra = {}) => ({ id, startAt: 1000, s: { turn }, beatSent: sent, ...extra });

const checkSave = async () => {
  // 100 → 50 → 100: 財布は +100 だけ・保存は 100 のまま
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 1, 0);
    for (const n of [100, 50, 100]) await S.msxSaveRun(runOf('r1', 3, n));
    ok(env.store.wallet === 100, `b: 100→50→100 で財布が ${env.store.wallet}(100 のはず)`);
    ok(env.store[RUN].beatSent === 100, 'b: 少ない量の保存で途中の育成を書き戻さない'); }
  // 消したあとの古い画面からの保存(渡した量 0 でも)で育成が戻らない
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 4, 0);
    await S.msxClearRun(); await S.msxSaveRun(runOf('r1', 3, 0));
    ok(env.store[RUN] == null, 'b: 消した育成を古い画面の保存が書き戻さない');
    ok(Array.isArray(env.store[S.MSX_RUN_GONE_KEY]) && env.store[S.MSX_RUN_GONE_KEY].includes('r1'), 'b: 終わった育成の id が足される');
    await S.msxSaveRun({ ...runOf('r2', 1, 0), startAt: 2000 });
    ok(env.store[RUN] && env.store[RUN].id === 'r2', 'b: 消したあとに始めた新しい育成は保存できる'); }
  // 前のターンの保存で巻き戻さない(別のタブ)・あとに始めた育成を古い育成で上書きしない
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 5, 0);
    await S.msxSaveRun(runOf('r1', 4, 0));
    ok(env.store[RUN].s.turn === 5, 'b: 前のターンの保存で巻き戻さない');
    env.store[RUN] = { ...runOf('r9', 2, 0), startAt: 5000 };
    await S.msxSaveRun(runOf('r1', 6, 0));
    ok(env.store[RUN].id === 'r9', 'b: あとに始めた育成を古い育成で上書きしない');
    env.store[RUN] = runOf('r1', 5, 0, { beatEnd: true });
    await S.msxSaveRun(runOf('r1', 5, 0));
    ok(env.store[RUN].beatEnd === true, 'b: 終わりのビートPを足した保存を、足す前の保存で戻さない'); }
  // ふつうの流れ: 始める → 進める → 払う(差だけ)
  { const env = makeEnv(); const S = makeSave(env);
    await S.msxSaveRun(runOf('r1', 1, 0)); await S.msxSaveRun(runOf('r1', 2, 30)); await S.msxSaveRun(runOf('r1', 3, 30)); await S.msxSaveRun(runOf('r1', 4, 80));
    ok(env.store.wallet === 80 && env.store[RUN].s.turn === 4, `b: ふつうの流れで財布 80・4ターン目(財布 ${env.store.wallet})`);
    await S.msxSaveRun(runOf('r1', 4, 80), true);
    ok(env.store.wallet === 80, 'b: デバッグの育成は財布に足さない'); }
  // 古い版の保存(startAt・beatSent が無い)も読めて、続きを保存できる
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = { id: 'old', s: { turn: 7 } };
    await S.msxSaveRun({ id: 'old', s: { turn: 8 } });
    ok(env.store[RUN].s.turn === 8, 'b: 古い版の保存の続きを保存できる'); }
  // (c) 中断: 保存中に読み直しても、待てば5ターン目
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 4, 0);
    S.msxSaveRun(runOf('r1', 5, 0));
    const early = env.store[RUN].s.turn;
    await S.msxSaveWait();
    ok(early === 4 && env.store[RUN].s.turn === 5, 'c: msxSaveWait のあとに読むと5ターン目'); }
};

// (c) 画面側: toHome は待ってから読む・begin/intro を戻す
const checkResumeText = () => {
  const home = MAIN.split('\n').find((l) => l.includes('const toHome'));
  ok(home && /msxSaveWait\(\)[\s\S]*msxReadAll/.test(home), 'c: toHome が msxSaveWait のあとに msxReadAll を呼ぶ');
  const ph = STORE.split('\n').find((l) => /phase: \[.*\]\.includes\(raw\.phase\)/.test(l)) || '';
  ok(ph.includes("'begin'") && ph.includes("'intro'"), 'c: 途中の育成の正規化が begin・intro を戻す');
};

// ---- (a) 引退 ----
const r3Src = cut(R3, '// ---- 保存(足すだけ) ----', '// ゲームオーバー: 保存枠には入れない') + cut(R3, '// 育成の記録帳に1件', '// ---- 台詞');
const makeRetire = (env, sent) => {
  const MSX_KEYS = { run: 'mh_monsuc_run_v1', box: 'mh_monsuc_box_v1', meta: 'mh_monsuc_meta_v1' };
  const MSX_BOX_CAP0 = 100; const MSX_BOX_CAP_MAX = 100;
  const { storeGet, storeSet } = env;
  const msxR3Grade = (p) => ({ label: `X${Math.floor(p / 500)}` });
  const msxR3T = () => ({ titles: null, record: { KEY: 'mh_monsuc_record_v1', parse: (r) => (Array.isArray(r) ? r : []), add: (book, e) => (book.some((x) => x.id === e.id) ? { added: false, book } : { added: true, book: [...book, e] }) } });
  const msxR3RankSend = () => { sent.n += 1; return true; };
  const window = {};
  // eslint-disable-next-line no-eval
  return eval(`${r3Src}; ({ msxR3Retire })`);
};
const checkRetire = async () => {
  const run = { id: 'r1', nick: 'もち', colors: [], from: { base: 'Mocchi' } };
  const s = { species: 'Mocchi', stats: { life: 1 }, techs: [], titles: [], wonNow: ['c1'], aid: 'kiki', pop: 1, lv: 1, type: 0 };
  const ev = { power: 5000, rank: 'D', loyal: 50, top: [] };
  const BOX = 'mh_monsuc_box_v1'; const META = 'mh_monsuc_meta_v1'; const REC = 'mh_monsuc_record_v1';
  // meta が書けない → ok にしない → 直って再試行 → 1回だけ
  for (const k of [META, BOX, REC]) {
    const env = makeEnv(); const sent = { n: 0 }; const R = makeRetire(env, sent);
    env.store[META] = { v: 1, retired: 3, best: {}, myField: 'keep' };
    env.failKeys.add(k);
    const r1 = await R.msxR3Retire(run, s, ev, [], false);
    ok(r1 && r1.ok === false, `a: ${k} が書けないとき ok にしない`);
    env.failKeys.clear();
    const r2 = await R.msxR3Retire(run, s, ev, [], false);
    const r3 = await R.msxR3Retire(run, s, ev, [], false);
    ok(r2.ok && r3.ok && r3.already, `a: ${k} の失敗のあとの再試行で ok・もう一度押すと already`);
    ok(env.store[META].retired === 4, `a: ${k} の失敗のあとも引退回数は1回だけ増える(${env.store[META].retired})`);
    ok(env.store[BOX].mons.filter((m) => m.id === 'r1').length === 1, `a: ${k} の失敗のあとも保存枠の子は1匹`);
    ok(env.store[REC].filter((x) => x.id === 'r1').length === 1, `a: ${k} の失敗のあとも記録帳は1件`);
    ok(env.store[META].best.Mocchi && env.store[META].best.Mocchi.power === 5000 && env.store[META].best3.length === 1, `a: ${k} の失敗のあとにベストとベスト3が入る`);
    ok(env.store[META].myField === 'keep' && env.store[META].wonCups.includes('c1'), `a: ${k}: 知らない項目を消さない・優勝ずみの大会が入る`);
    ok(sent.n === 1, `a: ${k}: ランキングへ送る口は1回だけ(${sent.n})`);
  }
  // 古い版で引退済み(保存枠に居る・meta に retiredIds が無い)の再試行は数え直さない
  { const env = makeEnv(); const sent = { n: 0 }; const R = makeRetire(env, sent);
    env.store[META] = { v: 1, retired: 9, best: {} }; env.store[BOX] = { v: 1, cap: 100, mons: [{ id: 'r1', species: 'Mocchi' }, { id: 'old2', species: 'Mocchi' }], memory: [] }; env.store[REC] = [{ id: 'r1' }]; // 古い版は記録帳も書いていた
    const r = await R.msxR3Retire(run, s, ev, [], false);
    ok(r.ok && env.store[META].retired === 9 && sent.n === 0, 'a: 古い版で引退済みの子を数え直さない');
    const run2 = { ...run, id: 'r2' };
    await R.msxR3Retire(run2, s, ev, [], false);
    ok(env.store[META].retired === 10 && ['r1', 'old2', 'r2'].every((id) => env.store[META].retiredIds.includes(id)), 'a: 古い meta に retiredIds を足すとき、保存枠の子の id で埋める'); }
  // 保存枠がいっぱいなら何も書かない
  { const env = makeEnv(); const R = makeRetire(env, { n: 0 });
    env.store[META] = { v: 1, retired: 1, best: {} }; env.store[BOX] = { v: 1, cap: 100, mons: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, species: 'Mocchi' })), memory: [] };
    const r = await R.msxR3Retire(run, s, ev, [], false);
    ok(r.full && env.store[META].retired === 1, 'a: 保存枠がいっぱいなら成績も書かない'); }
};

(async () => {
  await checkSave(); checkResumeText(); await checkRetire();
  if (fail) { console.log(`モンサクの保存の安全: ${fail} 件の失敗(${pass} 件は通過)`); process.exit(1); }
  console.log(`✓ モンサクの保存の安全: ${pass} 件すべて通過(引退の失敗と再試行・ビートPの二重付与・古い画面・中断直後の再開)`);
})().catch((e) => { console.error(e); process.exit(1); });
