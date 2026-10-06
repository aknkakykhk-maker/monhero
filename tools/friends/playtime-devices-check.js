// 端末ごとのプレイ時間(2026-10-06)を確かめる。
//
//   node tools/friends/playtime-devices-check.js
//
// 【なぜ要るか】ユーザー報告「フレンドのプレイ時間が短くなるバグ」。プレイ時間は端末の中だけで数え、
// フレンドの表は「最後に送った端末」の値で上書きしていた。データ引き継ぎでブリーダーIDごとコピーされるので、
// 2台で遊ぶと、あまり使っていない端末で開いたとたんに短くなった。ユーザーの選択は「2台の合計を出す」。
//
// 【見ること】
//   ① 合計は「昔のぶん(base)は一番大きいもの1つ」＋「その後のぶん(own)は全端末の和」
//      (引き継ぎでコピーされた昔のぶんを2台で二重に数えない)
//   ② 端末の保存キーは mh_ で始まらない(引き継ぎのバックアップに入ると、IDも own もコピーされて二重に数える)
//   ③ 壊れた保存値・行は捨てる(型を確かめる)
//   ④ 送る・読むの両方が、表がまだ無い環境でも黙って今までどおり動く作りになっている
//   ⑤ 数える処理が、この端末のぶん(ownMs)も同じだけ進め、保存のたびに書く
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const part17 = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const api = read('monster-hero/src/parts/34-friends-api.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const backup = read('monster-hero/data/mhsave-backup.js');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 17-release… から、プレイ時間の部品だけを切り出して動かす
const start = part17.indexOf('const PLAYTIME_KEY = ');
const end = part17.indexOf('const formatPlaytime = ');
const store = {};
const sandbox = {
  crypto: require('crypto').webcrypto,
  globalThis: null, Uint8Array, Math, JSON, Number, String, Array, Object, Date,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(`${part17.slice(start, end)}\nglobalThis.__p = { PLAYTIME_DEVICE_KEY, normalizePlaytimeDevice, newPlaytimeDeviceId, loadPlaytimeDevice, savePlaytimeDevice, combineDevicePlaytime };`, sandbox);
const p = sandbox.__p;
const storage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };

// ① 合計の出し方
const a = { base_seconds: 36000, own_seconds: 900, started_on: '2026-09-06' };  // ずっと使っている端末(昔のぶん10時間)
const b = { base_seconds: 1800, own_seconds: 300, started_on: '2026-09-06' };   // 早い時期の引き継ぎで作った2台目
const both = p.combineDevicePlaytime([a, b]);
check('① 昔のぶんは一番大きいもの1つ＋その後のぶんは全端末の和', both && both.seconds === 36000 + 900 + 300, JSON.stringify(both));
check('① 2台目で開いても、合計は1台目だけのときより短くならない', both.seconds >= p.combineDevicePlaytime([a]).seconds);
check('① 遊びはじめは一番古い日', p.combineDevicePlaytime([{ ...a, started_on: '2026-09-10' }, b]).startedOn === '2026-09-06');
check('① 端末の数を返す', both.devices === 2);
check('① 行が無ければ null(呼ぶ側は今までの値を使う)', p.combineDevicePlaytime([]) === null && p.combineDevicePlaytime(null) === null);

// ② 保存キー
check('② 端末の保存キーは mh_ で始まらない(引き継ぎにコピーされない)', !/^mh_/.test(p.PLAYTIME_DEVICE_KEY), p.PLAYTIME_DEVICE_KEY);
check('② バックアップは mh_ のキーだけを写す(前提が変わっていない)', /startsWith\('mh_'\)/.test(backup) && /k\.startsWith\('mh_'\)/.test(app));

// ③ 壊れた値
check('③ 形の違う端末IDは捨てる', p.normalizePlaytimeDevice({ deviceId: 'bad id!', baseMs: 1 }) === null && p.normalizePlaytimeDevice(null) === null);
const n = p.normalizePlaytimeDevice({ deviceId: 'abcdefghijkl12', baseMs: -5, ownMs: 'x', since: 'きのう' });
check('③ マイナス・数字でない時間は0、日付でない since は null', n && n.baseMs === 0 && n.ownMs === 0 && n.since === null, JSON.stringify(n));
check('③ 壊れた行は0として数える', p.combineDevicePlaytime([{ base_seconds: 'x', own_seconds: -3 }, a]).seconds === 36000 + 900);
const id1 = p.newPlaytimeDeviceId(), id2 = p.newPlaytimeDeviceId();
check('③ 新しい端末IDは決まった形で、毎回ちがう', /^[a-z0-9]{12,40}$/.test(id1) && id1 !== id2, `${id1} / ${id2}`);
check('③ 保存先が使えなくても落ちない', p.loadPlaytimeDevice(null) === null && p.savePlaytimeDevice(null, { deviceId: id1 }) === false);
check('③ 保存して読み戻せる', p.savePlaytimeDevice(storage, { deviceId: id1, baseMs: 1200.4, ownMs: 3000.6, since: '2026-10-06' })
  && JSON.stringify(p.loadPlaytimeDevice(storage)) === JSON.stringify({ deviceId: id1, baseMs: 1200, ownMs: 3001, since: '2026-10-06' }));

// ④ 表が無いときの扱い
check('④ 送る: 表が無ければ以後は送らない', /const sbUpsertFriendPlaytimeDevice/.test(api) && /if \(error\.softMissing\) _friendPlaytimeDevicesUnavailable = true/.test(api));
check('④ 読む: 表が無ければ空で返し、今までの値を使う', /const sbFetchFriendPlaytimeTotals/.test(api) && /if \(error && error\.softMissing\) _friendPlaytimeDevicesUnavailable = true/.test(api));
check('④ 読んだ合計は、今までの値より短くしない(大きいほうを出す)', /view\.playSeconds = Math\.max\(Number\(view\.playSeconds\) \|\| 0, total\.seconds\)/.test(api));

// ⑤ 数える処理
check('⑤ 数えるたびに、この端末のぶん(ownMs)も同じだけ進める', /playtimeDeviceRef\.current = \{ \.\.\.playtimeDeviceRef\.current, ownMs: playtimeDeviceRef\.current\.ownMs \+ delta \}/.test(app));
check('⑤ 保存のたびに端末のぶんも書く', /if \(playtimeDeviceRef\.current\) savePlaytimeDevice\(playtimeDeviceStorage\(\), playtimeDeviceRef\.current\);/.test(app));
check('⑤ この端末で初めて動いたときは、いま持っている時間を昔のぶんとして控える',
  /loadPlaytimeDevice\(playtimeDeviceStorage\(\)\) \|\| \{ deviceId:newPlaytimeDeviceId\(\), baseMs:saved\.totalMs, ownMs:0, since:saved\.since \}/.test(app));
check('⑤ フレンドへ送るときに端末のぶんも送る', /await sbUpsertFriendPlaytimeDevice\(id, playtimeDeviceRef\.current\);/.test(app));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
