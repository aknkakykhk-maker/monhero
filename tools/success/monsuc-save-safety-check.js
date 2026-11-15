#!/usr/bin/env node
// モンサクの保存の安全(r1115-171): 保存の失敗・再試行・古い画面からの保存・中断直後の再開を、本物の関数を切り出して確かめる。
//   (a) 引退: 成績・子・記録帳のどれかが書けないと ok にしない/再試行で足りない分だけ補う(引退回数・ベスト・子が二重にならない)/古い meta も読める
//   (b) 途中の育成の保存: 渡したビートPを 100→50→100 で保存しても財布は +100 だけ/消した育成を古い画面が書き戻さない/前のターンで巻き戻さない
//   (c) 中断: 並べた保存が終わってから読む(msxSaveWait)/begin・intro を保存から戻す
//   r1115-200: 育成開始の消費と育成を一緒に書く/引退の順(満杯でビートPを付けない・報酬や記録帳の失敗を完了にしない・再試行で補う)/
//             古い画面の「やめる」は id が同じときだけ・同じターンでも版番号で巻き戻さない・終わった育成の記録が書けなければ消さない
// 使い方: node tools/success/monsuc-save-safety-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
const STORE = read('56-monhero-success-store.jsx');
const R3 = read('56-monhero-success-r3-store.jsx');
const MAIN = read('56-monhero-success-main.jsx');
const RETIRE = read('56-monhero-success-r3-retire.jsx');
const CORE = read('11-masu-progression.jsx');
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
  const { storeGet, storeSet } = env;
  // 本物(11-masu-progression.jsx): 全部書く → 読み戻して比べる → 食い違えば全部を before へ戻す
  // eslint-disable-next-line no-eval
  const saveStoredValuesOrRollback = eval(`(${cut(CORE, 'async (entries, getValue, setValue) => {', 'const saveTranscendFruitPair').trim().replace(/;$/, '')})`);
  // eslint-disable-next-line no-eval
  return eval(`${saveSrc}; ({ msxSaveRun, msxClearRun, msxSaveWait, msxStartRunSave, MSX_RUN_GONE_KEY })`);
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

// ---- r1115-200 1・3 ----
const META = 'mh_monsuc_meta_v1';
const checkR200Save = async () => {
  // 1 育成開始: 片方だけ書けない → 両方元のまま(アイテムも前の育成も残る)→ 直って再試行すると両方入る
  for (const k of [RUN, META]) {
    const env = makeEnv(); const S = makeSave(env);
    env.store[META] = { v: 1, items: { x: 1 } }; env.store[RUN] = runOf('old', 9, 0);
    env.failKeys.add(k);
    const r = await S.msxStartRunSave({ ...runOf('new', 1, 0), startAt: 9000 }, { v: 1, items: {} });
    ok(r === false, `1: ${k} が書けないとき始められない(${r})`);
    ok(env.store[META].items.x === 1 && env.store[RUN].id === 'old', `1: ${k} が書けないとき、アイテムと前の育成が残る`);
    env.failKeys.clear();
    const r2 = await S.msxStartRunSave({ ...runOf('new', 1, 0), startAt: 9000 }, { v: 1, items: {} });
    ok(r2 === true && !env.store[META].items.x && env.store[RUN].id === 'new', `1: ${k} の失敗のあとの再試行で、消費と育成が両方入る`);
  }
  // 3a 古い画面の「やめる」: id が違えば消さない・同じなら消す・id なしは今までどおり
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = { ...runOf('rNEW', 1, 0), startAt: 9000 };
    const r = await S.msxClearRun('rOLD');
    ok(r === 'other' && env.store[RUN] && env.store[RUN].id === 'rNEW', '3a: 古い画面の「やめる」で新しい育成を消さない');
    const r2 = await S.msxClearRun('rNEW');
    ok(r2 === true && env.store[RUN] == null, '3a: 同じ id なら消す');
    ok((await S.msxClearRun('rNEW')) === true, '3a: もう無い育成を消すのは true(引退の再試行が止まらない)'); }
  // 3b 同じターン・同じビートPでも、版番号が進んだ保存を古い画面が巻き戻さない(2つのタブ)
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 5, 30, { rev: 10, phase: 'battle' });
    const a = await S.msxSaveRun(runOf('r1', 5, 30, { rev: 11, phase: 'result' })); // タブA(最新)
    const b = await S.msxSaveRun(runOf('r1', 5, 30, { rev: 11, phase: 'main' })); // タブB(版10を読んだ古い画面)
    ok(a === true && b === 'stale' && env.store[RUN].phase === 'result', `3b: 同じ版の2つ目の保存は書かない(${a}/${b})`);
    const c = await S.msxSaveRun(runOf('r1', 5, 30, { rev: 9, phase: 'main' }));
    ok(c === 'stale' && env.store[RUN].phase === 'result', '3b: 古い大会画面(前の版)の保存で巻き戻さない');
    ok((await S.msxSaveRun(runOf('r1', 5, 30, { rev: 12, phase: 'main' }))) === true, '3b: 次の版は書ける'); }
  // 3b 版番号の無い古い保存は比べない(古い版のアプリの保存も、続きを保存できる)
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 5, 0);
    ok((await S.msxSaveRun(runOf('r1', 5, 0, { rev: 1 }))) === true, '3b: 版の無い保存の続きを版つきで保存できる');
    env.store[RUN] = runOf('r1', 6, 0); // 古い版のアプリが版なしで書いた
    ok((await S.msxSaveRun(runOf('r1', 6, 0, { rev: 2 }))) === true, '3b: 古い版のアプリが版なしで書いたあとも保存できる'); }
  // 3c 終わった育成の記録が書けない → 消さない → 古い画面からの保存でも戻らない(残ったまま)/ 直れば消える
  { const env = makeEnv(); const S = makeSave(env); env.store[RUN] = runOf('r1', 4, 0); env.failKeys.add(S.MSX_RUN_GONE_KEY);
    const r = await S.msxClearRun('r1');
    ok(r === false && env.store[RUN] && env.store[RUN].id === 'r1', '3c: 終わった育成の記録が書けないときは消さない');
    env.failKeys.clear();
    ok((await S.msxClearRun('r1')) === true && env.store[RUN] == null, '3c: 再試行で記録と削除が両方済む');
    await S.msxSaveRun(runOf('r1', 4, 0));
    ok(env.store[RUN] == null, '3c: 消したあと古い画面の保存で戻らない'); }
  // 3c 終わった育成の記録が読めない(例外)ときは、記録を作り直さず消さない(ほかの id を落とさない)
  { const env = makeEnv(); const S0 = env.storeGet; env.store[RUN] = runOf('r2', 4, 0); env.store['mh_monsuc_run_gone_v1'] = ['a', 'b'];
    env.storeGet = async (k, d) => { if (k === 'mh_monsuc_run_gone_v1') throw new Error('x'); return S0(k, d); };
    const S = makeSave(env); const r = await S.msxClearRun('r2');
    ok(r === false && env.store[RUN] && env.store['mh_monsuc_run_gone_v1'].length === 2, '3c: 記録が読めないときは記録を消さず、育成も消さない'); }
};

// 2 引退の順(画面 decide): 満杯なら何もしない(ビートPも)→ 引退の保存 → ビートP → 削除。途中で失敗したら完了にしない
const decideSrc = cut(RETIRE, '  const decide = async () => {', '  // ---- 自分だけのベスト3');
const makeDecide = (env, S, R, runRef, st) => {
  const SUC = { beatOfEnd: () => 80, evaluate: () => ({ rank: 'D' }) };
  const msxR3Retire = R.msxR3Retire; const msxR3ClearRun = (id) => S.msxClearRun(id);
  // eslint-disable-next-line no-eval
  const msxBeatMark = eval(`(${cut(STORE, 'const msxBeatMark = ', 'let msxSaveChain').replace('const msxBeatMark = ', '').trim().replace(/;$/, '')})`);
  const setRun = (r) => { const n = { ...msxBeatMark(r), rev: (runRef.rev || 0) + 1 }; runRef.rev = n.rev; st.run = n; return S.msxSaveRun(n); };
  const setRes = (x) => { st.res = x; }; const setStep = (x) => { st.step = x; }; const setBusy = () => {}; const setSure = () => {};
  const sure = true; const busy = false; const pick = {}; const V3 = false; const AT = null; const points = 0; const debug = false;
  return (run, ws, ev) => {
    // eslint-disable-next-line no-eval
    const decide = eval(`(() => { ${decideSrc.replace('  const decide = async () => {', 'return async () => {')} })()`);
    return decide();
  };
};
const checkR200Retire = async () => {
  const BOX = 'mh_monsuc_box_v1'; const REC = 'mh_monsuc_record_v1';
  const s = { species: 'Mocchi', stats: { life: 1 }, techs: [], titles: [], wonNow: [], aid: 'kiki', pop: 1, lv: 1, type: 0, beatEarned: 100, turn: 30 };
  const run = { id: 'r1', nick: 'もち', colors: [], from: { base: 'Mocchi' }, startAt: 1000, s, beatSent: 100, rev: 3 };
  const ev = { power: 5000, rank: 'D', loyal: 50, top: [] };
  const setup = () => {
    const env = makeEnv(); const S = makeSave(env); const R = makeRetire(env, { n: 0 }); env.store.wallet = 100; env.store[RUN] = clone(run);
    const st = {}; const ref = { rev: 3 }; const D = makeDecide(env, S, R, ref, st);
    return { env, S, R, st, go: async () => { await D(st.run || run, s, ev); await S.msxSaveWait(); } };
  };
  // 満杯: ビートPを付けない・何も書かない
  { const t = setup(); t.env.store[BOX] = { v: 1, cap: 100, mons: Array.from({ length: 100 }, (_, i) => ({ id: `m${i}` })), memory: [] };
    await t.go();
    ok(t.st.res && t.st.res.full && t.env.store.wallet === 100 && t.env.store[RUN].beatEnd !== true, `2: 満杯ならビートPを付けない(財布 ${t.env.store.wallet})`); }
  // ふつう: 完了・ビートP +80・育成が消える
  { const t = setup(); await t.go();
    ok(t.st.step === 'done' && t.env.store.wallet === 180 && t.env.store[RUN] == null, `2: ふつうの引退で完了・ビートP +80・育成が消える(財布 ${t.env.store.wallet})`); }
  // ビートPが書けない → 完了にしない・育成は残る → 再試行で子・成績は二重にならずビートPだけ補う
  { const t = setup(); t.env.failKeys.add('wallet'); await t.go();
    ok(t.st.step !== 'done' && t.st.res && t.st.res.why === 'beat' && t.env.store[RUN] && t.env.store.wallet === 100, '2: ビートPが書けないと完了にしない(育成は残る)');
    t.env.failKeys.clear(); await t.go();
    ok(t.st.step === 'done' && t.env.store.wallet === 180 && t.env.store[RUN] == null, `2: ビートPの失敗のあとの再試行で補う(財布 ${t.env.store.wallet})`);
    ok(t.env.store[BOX].mons.filter((m) => m.id === 'r1').length === 1 && t.env.store[META].retired === 1 && t.env.store[REC].length === 1, '2: 報酬の再試行で子・成績・記録帳が二重にならない'); }
  // 記録帳の読み込みで例外 → 完了にしない・ビートPも付けない → 直って再試行で記録帳とビートPが入る
  { const t = setup(); const g = t.env.storeGet; let bad = true; t.env.storeGet = async (k, d) => { if (bad && k === REC) throw new Error('x'); return g(k, d); };
    const t2R = makeRetire(t.env, { n: 0 }); const t2D = makeDecide(t.env, makeSave(t.env), t2R, { rev: 3 }, t.st);
    const go = async () => { await t2D(t.st.run || run, s, ev); };
    await go();
    ok(t.st.step !== 'done' && t.env.store.wallet === 100 && t.env.store[RUN], '2: 記録帳の例外で完了にしない(ビートPも付けない)');
    bad = false; await go();
    ok(t.st.step === 'done' && t.env.store[REC].length === 1 && t.env.store.wallet === 180 && t.env.store[META].retired === 1, '2: 記録帳の例外のあとの再試行で、記録帳とビートPが1回ずつ入る'); }
  // 育成の削除が書けない → 完了にしない → 再試行で消える(ビートPは二重にならない)
  { const t = setup(); t.env.failKeys.add('mh_monsuc_run_gone_v1'); await t.go();
    ok(t.st.step !== 'done' && t.st.res.why === 'clear' && t.env.store[RUN], '2: 育成の削除が書けないと完了にしない');
    t.env.failKeys.clear(); await t.go();
    ok(t.st.step === 'done' && t.env.store[RUN] == null && t.env.store.wallet === 180, `2: 削除の失敗のあとの再試行で消える・ビートPは1回(財布 ${t.env.store.wallet})`); }
};

// (c) 画面側: toHome は待ってから読む・begin/intro を戻す
const checkResumeText = () => {
  const home = MAIN.split('\n').find((l) => l.includes('const toHome'));
  ok(home && /msxSaveWait\(\)[\s\S]*msxReadAll/.test(home), 'c: toHome が msxSaveWait のあとに msxReadAll を呼ぶ');
  const ph = STORE.split('\n').find((l) => /phase: \[.*\]\.includes\(raw\.phase\)/.test(l)) || '';
  ok(ph.includes("'begin'") && ph.includes("'intro'"), 'c: 途中の育成の正規化が begin・intro を戻す');
  // r1115-200: 画面側が結果を見る
  ok(/msxStartRunSave\(r1, meta\)/.test(MAIN) && /if \(saved !== true\)[^\n]*return false/.test(MAIN), '1: 育成開始は消費と育成を一緒に書き、失敗なら進まない');
  ok(/msxClearRun\(run && run\.id\)/.test(MAIN), '3a: 「やめる」は画面の育成の id を渡す');
  ok(/rev: msxNum\(raw\.rev, 0\)/.test(STORE), '3b: 途中の育成の正規化が版番号を残す');
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
  await checkSave(); checkResumeText(); await checkRetire(); await checkR200Save(); await checkR200Retire();
  if (fail) { console.log(`モンサクの保存の安全: ${fail} 件の失敗(${pass} 件は通過)`); process.exit(1); }
  console.log(`✓ モンサクの保存の安全: ${pass} 件すべて通過(引退の失敗と再試行・ビートPの二重付与・古い画面・中断直後の再開・育成開始の取引・引退の順・別タブ)`);
})().catch((e) => { console.error(e); process.exit(1); });
