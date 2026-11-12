// モンヒロサクセスの総合力ランキングの端末の口(56-monsuc-rank.jsx)の決まりを確かめる。ブラウザもサーバーも使わない。
//   node tools/success/monsuc-rank-check.js
// 設計 docs/progress/player-raise/RANKING.md。担当: 開発部クラフト
//   ① 公開の印 monheroSuccess が偽なら通信しない
//   ② 送らない: デビュー戦のゲームオーバー・まだ終わっていない育成・デバッグの育成
//   ③ 送る中身: 6能力は 0〜999 の整数・技は8つまで・熟練 0〜100・育成の id は「持ち主の番号-英数字」
//   ④ 二重に送らない: 送れた id は mh_monsuc_rank_sent_v1 に残り、同じ育成は2回目を送らない
//   ⑤ 送れなかったら mh_monsuc_rank_queue_v1 に積み、monsucRankFlush で1件ずつ送り直す。形で断られたものは積まない
//   ⑥ 保存は新しいキー2つだけ。壊れた値でも空として読める
//   ⑧ 画面: 絵は ALL_PLAYER_MONSTERS[種族名] で引く/ほかの人の色は配列だけ(6つ・40字まで)に整えてから DyedMonsterImage に渡す
//   ⑦ 端末の総合力の式(MASMON_CALC.power)とサーバの SQL の式の重みがそろっている
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) { console.log(`NG: ${name}${detail ? ` — ${detail}` : ''}`); failed++; } };

const mem = {};
const writes = [];
const calls = [];
let server = () => ({ status: 200, body: JSON.stringify({ ok: true, power: 9000, grade: 'B', place_all: 3, place_lineage: 1 }) });
const flags = { monheroSuccess: true };
const ctx = vm.createContext({
  console, Math, Date, JSON, Object, Array, Number, String, Promise, RegExp, AbortController, setTimeout, clearTimeout, encodeURIComponent,
  React: { useState: (v) => [v, () => {}], useEffect: () => {}, useMemo: (f) => f() },
  storeGet: async (k, d) => (k in mem ? JSON.parse(JSON.stringify(mem[k])) : d),
  storeSet: async (k, v) => { writes.push(k); mem[k] = JSON.parse(JSON.stringify(v)); return true; },
  RELEASE_FLAGS: flags,
  SUPABASE_URL: 'https://example.supabase.co', SB_HEADERS: { apikey: 'test', 'Content-Type': 'application/json' },
  fetch: async (url, init = {}) => {
    calls.push({ url: String(url), body: init.body ? JSON.parse(init.body) : null });
    const r = server(String(url), init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => null }, json: async () => JSON.parse(r.body) };
  },
  masmonPvpSelf: async () => ({ owner: 'self-0001', key: 'k'.repeat(48) }),
  MONSTER_LINEAGE_MAP: { Mocchi: { main: 'mocchi', sub: 'mocchi' }, Golem: { main: 'golem', sub: 'golem' } },
  MONSTER_LINEAGES: { mocchi: { id: 'mocchi', name: 'モッチー' }, golem: { id: 'golem', name: 'ゴーレム' } },
  ALL_PLAYER_MONSTERS: { Mocchi: { id: 'Mocchi', name: 'モッチー' }, Golem: { id: 'Golem', name: 'ゴーレム' } }, // 本体と同じく種族名をキーにしたオブジェクト
});
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-monsuc-rank.jsx'), 'utf8');
vm.runInContext(babel.transformSync(src, { presets: [require.resolve('@babel/preset-react')], babelrc: false, configFile: false }).code.replace(/^const /gm, 'var '), ctx);

const runOf = (o = {}) => ({ id: 'run1234abcd', species: 'Mocchi', over: 'done', lv: 20, pop: 30,
  stats: { life: 500, pow: 1200, wise: -5, hit: 300.4, eva: 'x', tough: 400 }, techs: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], mastery: { a: 150, b: 20 }, ...o });
const ev = { loyal: 70, lv: 20, pop: 30, power: 9999 };

(async () => {
  const S = ctx.monsucRankSubmit;
  // ① 印が偽なら通信しない
  flags.monheroSuccess = false;
  let r = await S({ run: runOf(), ev, name: 'もちまる', colors: { 0: 'red' } });
  check('① 印が偽なら off', r.reason === 'off' && calls.length === 0);
  flags.monheroSuccess = true;

  // ② 送らないもの
  for (const [why, run, debug] of [['ゲームオーバー', runOf({ over: 'gameover' })], ['途中', runOf({ over: null })], ['デバッグ', runOf(), true]]) {
    r = await S({ run, ev, name: 'x', debug });
    check(`② ${why}は送らない`, r.reason === 'skip' && calls.length === 0, JSON.stringify(r));
  }

  // ③ 送る中身
  r = await S({ run: runOf(), ev, name: 'もちまる', colors: ['red', 'blue', 7] });
  check('③ 送れた', r.ok === true && r.placeAll === 3, JSON.stringify(r));
  const body = calls[0] && calls[0].body;
  check('③ サーバの関数に送る', calls[0] && /\/rest\/v1\/rpc\/monsuc_rank_submit$/.test(calls[0].url));
  check('③ 持ち主と鍵', body && body.p_owner === 'self-0001' && body.p_key.length === 48);
  const row = body ? body.p_row : {};
  check('③ 育成の id', row.run_id === 'self-0001-run1234abcd' && /^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$/.test(row.run_id), row.run_id);
  check('③ 6能力は 0〜999 の整数', JSON.stringify(row.stats) === JSON.stringify({ life: 500, pow: 999, wise: 0, hit: 300, eva: 0, tough: 400 }), JSON.stringify(row.stats));
  check('③ 技は8つまで・熟練 0〜100', Array.isArray(row.techs) && row.techs.length === 8 && row.techs[0] === 100 && row.techs[1] === 20 && row.techs[7] === 0, JSON.stringify(row.techs));
  check('③ 血統・忠誠・名前', row.lineage === 'mocchi' && row.loyal === 70 && row.child_name === 'もちまる' && row.species === 'Mocchi');
  check('③ 色は配列だけ・文字でない所は null', JSON.stringify(row.dye) === JSON.stringify(['red', 'blue', null]), JSON.stringify(row.dye));
  check('⑧ 絵: 種族名で引ける', ctx.monsucRankMonOf('Golem') && ctx.monsucRankMonOf('Golem').name === 'ゴーレム' && ctx.monsucRankMonOf('toString') === null);
  check('⑧ ほかの人の色が配列でなければ null(画面が落ちない)', ctx.monsucRankDyeOf({}) === null && ctx.monsucRankDyeOf('x') === null && JSON.stringify(ctx.monsucRankDyeOf(['a', 3, 'x'.repeat(41), 'b', 'c', 'd', 'e'])) === JSON.stringify(['a', null, null, 'b', 'c', 'd']));
  check('③ 端末の総合力は送らない', !('power' in row) && !('grade' in row));

  // ④ 二重に送らない
  const n = calls.length;
  r = await S({ run: runOf(), ev, name: 'もちまる' });
  check('④ 同じ育成は2回目を送らない', r.reason === 'skip' && calls.length === n);
  check('④ 印が残る', Array.isArray(mem.mh_monsuc_rank_sent_v1) && mem.mh_monsuc_rank_sent_v1.includes('self-0001-run1234abcd'));

  // ⑤ 送れなかったら積んで送り直す
  server = () => ({ status: 503, body: '{}' });
  r = await S({ run: runOf({ id: 'run2' }), ev, name: 'ごろん' });
  check('⑤ 電波が悪いと失敗', r.ok === false && r.reason === 'network');
  check('⑤ 列に積む', Array.isArray(mem.mh_monsuc_rank_queue_v1) && mem.mh_monsuc_rank_queue_v1.length === 1 && mem.mh_monsuc_rank_queue_v1[0].run_id === 'self-0001-run200');
  server = () => ({ status: 200, body: JSON.stringify({ ok: true, power: 1, grade: 'G', place_all: 9, place_lineage: 2 }) });
  r = await ctx.monsucRankFlush();
  check('⑤ 送り直せた', r.ok === true && r.left === 0 && mem.mh_monsuc_rank_queue_v1.length === 0 && mem.mh_monsuc_rank_sent_v1.includes('self-0001-run200'), JSON.stringify(r));
  server = () => ({ status: 200, body: JSON.stringify({ ok: false, reason: 'over_cap' }) });
  r = await S({ run: runOf({ id: 'run3abcdef' }), ev, name: 'x' });
  check('⑤ 上限で断られたら積まない', r.reason === 'over_cap' && mem.mh_monsuc_rank_queue_v1.length === 0);
  server = () => ({ status: 200, body: JSON.stringify({ ok: false, reason: 'busy' }) });
  r = await S({ run: runOf({ id: 'run4abcdef' }), ev, name: 'x' });
  check('⑤ 混雑なら積む', r.reason === 'busy' && mem.mh_monsuc_rank_queue_v1.length === 1);

  // ⑥ 保存は新しいキーだけ・壊れた値
  check('⑥ 新しいキー2つだけに書く', writes.every(k => k === 'mh_monsuc_rank_sent_v1' || k === 'mh_monsuc_rank_queue_v1'), [...new Set(writes)].join(','));
  mem.mh_monsuc_rank_sent_v1 = 'こわれた'; mem.mh_monsuc_rank_queue_v1 = { x: 1 };
  check('⑥ 壊れた印は空', (await ctx.monsucRankSentList()).length === 0 && (await ctx.monsucRankQueue()).length === 0);

  // ⑦ 総合力の式の重み(端末とサーバ)
  const calc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-masmon-calc.jsx'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/202611120001_monsuc_rank.sql'), 'utf8');
  check('⑦ 端末の重みが変わっていない', /POWER_W = Object\.freeze\(\{ stat: 2\.5, tech: 100, mastery: 1, lv: 15, loyal: 10, pop: 10, techMax: 8 \}\)/.test(calc), '式を変えたら SQL の monsuc_rank_power も直す');
  check('⑦ SQL の式', sql.includes('* 2.5') && sql.includes('sum(100 + least(') && sql.includes('limit 8') && sql.includes('* 15 +') && /least\(greatest\(p_loyal, 0\), 100\) \* 10/.test(sql));
  const apply = fs.readFileSync(path.join(root, 'docs/sql/monsuc-rank/MONSUC_RANK_APPLY.sql'), 'utf8');
  check('⑦ docs/sql と migrations が同じ', apply === sql);

  console.log(failed ? `NG ${failed}件` : 'OK: モンヒロサクセスの総合力ランキングの端末の口');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('NG: 例外', e && e.stack); process.exit(1); });
