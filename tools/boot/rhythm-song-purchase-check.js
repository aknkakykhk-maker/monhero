#!/usr/bin/env node
// モンヒロビートの「ビートPで買う曲」(2026-11-08 社長「本オープン実装以降は新曲はビートPで500で1曲買うようになる」・決めごとは全部 A)。
//
//   node tools/boot/rhythm-song-purchase-check.js
//
// 【なぜ要るか】ビートPを引いたのに曲が開かない・二重に引く・持っているのに鍵がかかる、は、どれも取り返しがつかない(社長への約束)。
// 実際の定義(data/rhythm-event.js)を vm で動かし、買う曲の表に試しの1曲を足して確かめる。画面側のつなぎは本文で確かめる。
//   ① 表に無い曲は無料(本オープン時点の曲はずっと無料)・値段は既定 500・表で変えられる
//   ② 買う: ビートPが足りなければ買えない/買えれば値段ぶんだけ減り、持っている曲に1つ足す
//   ③ 二重に引かない: 持っている曲は 'owned' で止まる・画面から来た値段が表と違えば止まる
//   ④ 無料の期間・期間限定イベントの対象のあいだは鍵なし(買えない)
//   ⑤ 保存は新しいキー mh_rhythm_owned_songs_v1 だけ。残高と同じ1つの取引で保存する(失敗したら両方戻す)
//   ⑥ 画面: ソロ・マルチとも、持っていない買う曲は始められない/はじめての1曲・ランダム・おまかせ・マスモン/助手の選曲は鍵のない曲から
//   ⑦ 表に書いた曲が本当にある曲か
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const eventSrc = read('monster-hero/data/rhythm-event.js');
const TABLE_RE = /const RHYTHM_PAID_SONGS = Object\.freeze\(\{([\s\S]*?)\n\}\);/;
check('買う曲の表(RHYTHM_PAID_SONGS)が1か所にある', TABLE_RE.test(eventSrc) && (eventSrc.match(/const RHYTHM_PAID_SONGS\b/g) || []).length === 1);
check('既定の値段は 500 ビートP', /const RHYTHM_SONG_PRICE_DEFAULT = 500;/.test(eventSrc));

// 試しの表で動かす(本物の表は書き換えない)
const load = (tableBody, events = '[]') => {
  const ctx = { console, Date };
  vm.createContext(ctx);
  const src = eventSrc.replace(TABLE_RE, `const RHYTHM_PAID_SONGS = Object.freeze({${tableBody}\n});`);
  vm.runInContext(`const RHYTHM_EVENTS = ${events};\n${src.replace(/^const RHYTHM_EVENTS\s*=/m, 'const RHYTHM_EVENTS_UNUSED =')}\n`
    + 'globalThis.api={rhythmSongPrice,rhythmSongIsPaid,rhythmSongLocked,normalizeRhythmOwnedSongs,rhythmEventPointExchangePreview,rhythmSongShopOffers,RHYTHM_OWNED_SONGS_KEY};', ctx);
  return ctx.api;
};
let api;
try {
  api = load(`\n  t_new: {},\n  t_cheap: { price: 300 },\n  t_free: { freeFrom: '2026-12-01T10:00:00+09:00', freeUntil: '2026-12-02T10:00:00+09:00' },\n  t_event: {},`,
    `[{ id:'ev', kind:'limited', startAt:'2026-12-10T12:00:00+09:00', endAt:'2026-12-14T04:00:00+09:00', songIds:['t_event'] }]`);
} catch (e) { check('定義を動かせる', false, String(e && e.message || e).slice(0, 200)); process.exit(1); }
const NOW = Date.parse('2026-11-20T12:00:00+09:00');

// ①
check('表に無い曲は無料(値段0・鍵なし)', api.rhythmSongPrice('monster_hero') === 0 && !api.rhythmSongIsPaid('monster_hero', NOW) && !api.rhythmSongLocked('monster_hero', [], NOW));
check('表の曲の値段は既定 500', api.rhythmSongPrice('t_new') === 500);
check('表で値段を変えられる', api.rhythmSongPrice('t_cheap') === 300);
check('持っていない買う曲は鍵つき', api.rhythmSongLocked('t_new', [], NOW) === true);
check('持っている買う曲は鍵なし', api.rhythmSongLocked('t_new', ['t_new'], NOW) === false);
check('保存値が壊れていても鍵つきのまま(開かない)', api.rhythmSongLocked('t_new', 'x', NOW) && api.rhythmSongLocked('t_new', null, NOW) && api.rhythmSongLocked('t_new', [{}], NOW));
check('保存値をそろえる(文字以外・重複を落とす)', JSON.stringify(api.normalizeRhythmOwnedSongs(['a', 'a', 3, null, 'b'])) === '["a","b"]' && JSON.stringify(api.normalizeRhythmOwnedSongs({})) === '[]');
check('交換所の「新曲」の棚に表の曲が並ぶ', api.rhythmSongShopOffers().map((o) => `${o.songId}:${o.cost}:${o.kind}`).join(',') === 't_new:500:song,t_cheap:300:song,t_free:500:song,t_event:500:song');

// ②③
const offer = (songId, cost) => ({ id: `song:${songId}`, kind: 'song', songId, cost, grantAmount: 1 });
const buy = (o, points, owned, now = NOW) => api.rhythmEventPointExchangePreview({ offer: o, eventPoints: points, gold: 7, ownedItems: { x: 1 }, ownedSongs: owned, songNowMs: now });
let r = buy(offer('t_new', 500), 499, []);
check('ビートPが足りなければ買えない(減らない)', !r.ok && r.reason === 'points' && r.eventPoints === 499);
r = buy(offer('t_new', 500), 1200, ['old']);
check('買えれば値段ぶんだけ減り、持っている曲に1つ足す(前の曲は消えない)', r.ok && r.eventPoints === 700 && JSON.stringify(r.ownedSongs) === '["old","t_new"]', JSON.stringify({ p: r.eventPoints, s: r.ownedSongs }));
check('曲を買っても、ダイヤ・所持品は変わらない', r.gold === 7 && r.ownedItems.x === 1);
r = buy(offer('t_new', 500), 1200, ['t_new']);
check('持っている曲は二重に買えない(減らない)', !r.ok && r.reason === 'owned' && r.eventPoints === 1200);
r = buy(offer('t_new', 1), 1200, []);
check('画面から来た値段が表と違えば買えない(表の値段で決める)', !r.ok && r.reason === 'invalidOffer' && r.eventPoints === 1200);
r = buy(offer('monster_hero', 500), 1200, []);
check('無料の曲は買えない', !r.ok && r.eventPoints === 1200);
r = buy(offer('t_cheap', 300), 300, []);
check('ちょうどの残高で買える(0になる)', r.ok && r.eventPoints === 0);

// ④
const FREE_IN = Date.parse('2026-12-01T12:00:00+09:00');
const FREE_AFTER = Date.parse('2026-12-02T10:00:00+09:00');
check('無料の期間のあいだは鍵なし', !api.rhythmSongLocked('t_free', [], FREE_IN) && api.rhythmSongLocked('t_free', [], NOW) && api.rhythmSongLocked('t_free', [], FREE_AFTER));
check('無料の期間のあいだは買えない(減らない)', (() => { const x = buy(offer('t_free', 500), 900, [], FREE_IN); return !x.ok && x.reason === 'free' && x.eventPoints === 900; })());
const EV_IN = Date.parse('2026-12-12T12:00:00+09:00');
check('期間限定イベントの対象のあいだは鍵なし(終われば鍵つきに戻る)', !api.rhythmSongLocked('t_event', [], EV_IN) && api.rhythmSongLocked('t_event', [], Date.parse('2026-12-14T04:00:00+09:00')));

// ⑤ 保存
const app = read('monster-hero/src/parts/60-app.jsx');
const fn = (app.match(/const exchangeRhythmEventPoints = async[\s\S]*?\n  \};\n/) || [''])[0];
check('保存キーは新しい mh_rhythm_owned_songs_v1', api.RHYTHM_OWNED_SONGS_KEY === 'mh_rhythm_owned_songs_v1');
check('買うと、残高と持っている曲を1つの取引で保存する(失敗したら両方戻す)',
  /saveStoredValuesOrRollback\(\[[\s\S]*?key:RHYTHM_EVENT_POINTS_KEY[\s\S]*?\.\.\.\(isSong \? \[\{ key:RHYTHM_OWNED_SONGS_KEY, before:storedSongs, next:exchange\.ownedSongs \}\] : \[\]\)/.test(fn));
check('持っている曲は保存値を読み直してから足す(画面の値で上書きしない)', /const storedSongs = isSong \? await storeGet\(RHYTHM_OWNED_SONGS_KEY, \[\], false\) : null;/.test(fn));
check('残高も保存値を読み直す', /const beforePoints = await loadRhythmEventPoints\(\);/.test(fn));
check('連打で二重に引かない(処理中は次を受け付けない)', /if \(marketPurchaseProcessingRef\.current\) return \{ ok:false, reason:'busy' \};[\s\S]*?marketPurchaseProcessingRef\.current = true;/.test(fn)
  && /finally \{ marketPurchaseProcessingRef\.current = false; \}/.test(fn));
check('保存できたときだけ、画面の持っている曲を変える', /if \(!saved\) \{[\s\S]*?return \{ ok:false, reason:'save' \};\n      \}[\s\S]*?if \(isSong\) setRhythmOwnedSongs\(exchange\.ownedSongs\);/.test(fn));
check('起動時に持っている曲を読む(壊れていれば空)', /storeGet\(RHYTHM_OWNED_SONGS_KEY, \[\], false\);[^\n]*setRhythmOwnedSongs\(normalizeRhythmOwnedSongs\(raw\)\)/.test(app));
const saveDoc = read('docs/spec/SAVE_DATA.md');
check('SAVE_DATA.md に新しいキーを書いてある', saveDoc.includes('`mh_rhythm_owned_songs_v1`'));

// ⑥ 画面
const select = read('monster-hero/src/parts/29-rhythm-screens.jsx');
const multi = read('monster-hero/src/parts/77-screen-rhythm-multi.jsx');
const solo = read('monster-hero/src/parts/58-screen-rhythm.jsx');
check('曲えらび: 鍵の曲は決定ボタンが「買う」に替わる', /\{songLocked\(song\.songId\)\s*\?<button type="button" data-rhythm-song-buy=/.test(select));
check('曲えらび: 行に「🔒 ◯P」を出す', select.includes("'data-rhythm-song-locked':entry.songId"));
check('曲えらび: はじめての1曲は無料の曲から', /if\(songPaid\(entry\.songId\)\)continue;/.test(select));
check('曲えらび: ランダムは鍵のない曲から', /const pool=list\.filter\(item=>!songLocked\(item\.songId\)\);/.test(select));
check('ソロ: 持っていない買う曲は始めない(ボタンを通らなくても)', /onPlaySong=\{\(song,difficulty\)=>\{[^\n]*?if\(song&&rhythmSongLocked\(song\.songId,rhythmOwnedSongs\)\)return;/.test(app));
check('ソロ: 曲えらびへ鍵を渡す(デバッグの全解放には渡さない)', /songLock=\{debugAll\?null:songLock\}/.test(solo) && /<RhythmSongSelectScreen\n\s+songLock=\{rhythmSongLock\}/.test(app));
check('マルチ: 曲を選べるのは持っている人だけ', /onPlay=\{\(song, difficulty\) => \{ if \(songLock && songLock\.isLocked && songLock\.isLocked\(song\.songId\)\) return;/.test(multi) && /<RhythmMultiScreen key=\{gameState\} songLock=\{rhythmSongLock\}/.test(app));
check('マルチ: おまかせは鍵のない曲から', /const freeCatalog = catalog\.filter\(\(id\) => !\(typeof rhythmSongLockedNow === 'function' && rhythmSongLockedNow\(id\)\)\);/.test(multi));
check('マルチ: マスモン・助手の選曲は鍵のない曲から', /const cpuCatalog = catalog\.filter[\s\S]{0,200}cpuBrain\.pick\(cpuCatalog\.length \? cpuCatalog : catalog, x\.masuId\)/.test(multi));
check('マルチ: ほかの人が選んだ曲は、持っていなくても一緒に遊べる(演奏の始まりで鍵を見ない)', !/rhythmSongLocked[\s\S]{0,80}onStartPlay|onStartPlay[\s\S]{0,200}rhythmSongLocked/.test(multi));
check('画面の外の処理が見る「持っている曲」を、画面の state と同じにする', /RHYTHM_OWNED_SONGS_RUNTIME\.list = rhythmOwnedSongs;/.test(app));

// ⑦ 表の曲
const realBody = (eventSrc.match(TABLE_RE) || ['', ''])[1];
const realIds = [...realBody.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]);
const modeSrc = read('monster-hero/data/rhythm-mode.js');
const missing = realIds.filter((id) => !new RegExp(`songId:\\s*['"]${id}['"]`).test(modeSrc));
check('買う曲の表に書いた曲が、すべて実際の曲', missing.length === 0, missing.length ? `無い曲: ${missing.join(', ')}` : `${realIds.length}曲`);

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
