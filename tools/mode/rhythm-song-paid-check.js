// モンヒロビートの新曲の購入(39-rhythm-song-owned.jsx・2026-11-13)を、画面なしで確かめる。
//
//   node tools/mode/rhythm-song-paid-check.js
//
//   A. 有料の表が空のあいだは、どの曲も無料(鍵にならない・助手の選曲もそのまま)
//   B. 表に曲を足すと: 持っていなければ鍵・買うとビートPが値段ぶん減り、持っている曲に入る(1つの取引)
//   C. 足りない・もう持っている・知らない曲・無料の曲は買えない(何も変わらない)
//   D. 保存に失敗したら、ビートPも持っている曲も元に戻る
//   E. 壊れた保存値(配列でない・文字でない値・重複)は空として読む
//   F. 助手が選べる曲は「無料+持っている曲」。絞って空になるときは元のまま
//   G. 表に書いた曲の id が、公開の曲に実在する
//   H. マルチの画面は鍵を見ない(持っていない人もその回だけ遊べる)。曲えらび・交換所・本体の入口は鍵に従う
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const src = read('src/parts/39-rhythm-song-owned.jsx').split('// ビートP交換所の「曲」の売り場')[0];
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const J = (v) => JSON.stringify(v);

// G: 実際の表(空でもよい)の曲 id
const tableText = (src.match(/const RHYTHM_SONG_PRICES = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '';
const realIds = [...tableText.matchAll(/['"]?([A-Za-z0-9_]+)['"]?\s*:\s*\d+/g)].map((m) => m[1]);
const songsJs = read('data/rhythm-mode.js');
check('G. 表に書いた曲が実在する', realIds.every((id) => songsJs.includes(`songId:'${id}'`) || songsJs.includes(`songId: '${id}'`) || songsJs.includes(`"${id}"`)), `表の曲 ${realIds.length}件`);

const make = (prices) => {
  const store = new Map();
  const fail = new Set();
  const ctx = {
    React: {}, console, Promise,
    RHYTHM_SONGS: [{ songId: 'a' }, { songId: 'b' }, { songId: 'free1' }],
    rhythmDemoSongs: (s) => s,
    RHYTHM_EVENT_POINTS_KEY: 'mh_rhythm_event_points_v1',
    loadRhythmEventPoints: async () => Number(store.has('mh_rhythm_event_points_v1') ? JSON.parse(store.get('mh_rhythm_event_points_v1')) : 0),
    storeGet: async (k, d = null) => (store.has(k) ? JSON.parse(store.get(k)) : d),
    storeSet: async (k, v) => { if (fail.has(k)) throw new Error('save'); store.set(k, JSON.stringify(v)); return true; },
    saveStoredValuesOrRollback: async (entries, get, set) => {
      try { for (const e of entries) await set(e.key, e.next); const back = await Promise.all(entries.map((e) => get(e.key))); if (entries.every((e, i) => J(back[i]) === J(e.next))) return true; } catch (_) { /* 戻す */ }
      for (const e of entries) { if (e.before === null || e.before === undefined) store.delete(e.key); else store.set(e.key, JSON.stringify(e.before)); }
      return false;
    },
  };
  const code = prices ? src.replace(/const RHYTHM_SONG_PRICES = Object\.freeze\(\{[\s\S]*?\}\);/, `const RHYTHM_SONG_PRICES = Object.freeze(${J(prices)});`) : src;
  vm.createContext(ctx);
  vm.runInContext(`${code}\nthis.api = { rhythmSongPrice, rhythmSongIsPaid, normalizeRhythmOwnedSongs, rhythmSongLocked, rhythmSongBuy, rhythmSongPickable, RHYTHM_SONG_OWNED, rhythmPaidSongList };`, ctx);
  return { api: ctx.api, store, fail };
};
const pts = (w) => JSON.parse(w.store.get('mh_rhythm_event_points_v1') || '0');
const own = (w) => JSON.parse(w.store.get('mh_rhythm_owned_songs_v1') || '[]');

(async () => {
  // A
  const w0 = make(null);
  check('A. 表が空なら有料の曲はない', realIds.length === 0 ? (!w0.api.rhythmSongIsPaid('a') && !w0.api.rhythmSongLocked('a', []) && w0.api.rhythmPaidSongList().length === 0) : true);
  check('A. 空の表の助手の選曲はそのまま', J(w0.api.rhythmSongPickable(['a', 'b'])) === J(['a', 'b']));

  // B
  const w = make({ a: 500, b: 700 });
  w.store.set('mh_rhythm_event_points_v1', '1000');
  check('B. 持っていない有料の曲は鍵', w.api.rhythmSongLocked('a', []) && !w.api.rhythmSongLocked('free1', []));
  const r1 = await w.api.rhythmSongBuy('a');
  check('B. 買えた(500P減る・持っている曲に入る)', r1.ok && pts(w) === 500 && J(own(w)) === J(['a']) && !w.api.rhythmSongLocked('a', w.api.RHYTHM_SONG_OWNED.get()));
  check('B. 値段は表の値(別の曲は別の値段)', w.api.rhythmSongPrice('b') === 700);

  // C
  const r2 = await w.api.rhythmSongBuy('a');
  check('C. もう持っている曲は買えない', !r2.ok && r2.reason === 'owned' && pts(w) === 500);
  const r3 = await w.api.rhythmSongBuy('b');
  check('C. ビートPが足りないと買えない(何も変わらない)', !r3.ok && r3.reason === 'points' && pts(w) === 500 && J(own(w)) === J(['a']));
  const r4 = await w.api.rhythmSongBuy('free1');
  check('C. 無料の曲は買えない', !r4.ok && r4.reason === 'free' && pts(w) === 500);
  const r5 = await w.api.rhythmSongBuy('nothing');
  check('C. 知らない曲は買えない', !r5.ok && r5.reason === 'unknown' && pts(w) === 500);

  // D
  const wd = make({ a: 500 });
  wd.store.set('mh_rhythm_event_points_v1', '900');
  wd.fail.add('mh_rhythm_owned_songs_v1');
  const r6 = await wd.api.rhythmSongBuy('a');
  check('D. 保存に失敗したらビートPも曲も元のまま', !r6.ok && r6.reason === 'save' && pts(wd) === 900 && own(wd).length === 0);

  // E
  const n = w.api.normalizeRhythmOwnedSongs;
  check('E. 壊れた保存値は空・重複と文字でない値は捨てる', J(n(null)) === '[]' && J(n('x')) === '[]' && J(n({})) === '[]' && J(n(['a', 'a', 3, '', null, 'b'])) === J(['a', 'b']));

  // F
  const wf = make({ a: 500, b: 700 });
  wf.api.RHYTHM_SONG_OWNED.replace(['b']);
  check('F. 助手は無料+持っている曲から選ぶ', J(wf.api.rhythmSongPickable(['a', 'b', 'free1'])) === J(['b', 'free1']));
  const wg = make({ a: 500 });
  check('F. 絞って空になるときは元のまま', J(wg.api.rhythmSongPickable(['a'])) === J(['a']));

  // H
  const multi = read('src/parts/77-screen-rhythm-multi.jsx');
  check('H. マルチは鍵を見ない', !/rhythmSongLocked|songLock/.test(multi));
  const screens = read('src/parts/29-rhythm-screens.jsx');
  const solo = read('src/parts/58-screen-rhythm.jsx');
  const app = read('src/parts/60-app.jsx');
  check('H. 曲えらびが鍵に従う(演奏ボタンを買うに替え、ランダムも除く)', /lockedSong\(song\)/.test(screens) && /pool=list\.filter\(item=>!lockedSong\(item\)\)/.test(screens) && /songLock=\{debugAll\?null/.test(solo));
  check('H. 本体の演奏の入口でも止める', /rhythmSongLocked\(song\.songId,RHYTHM_SONG_OWNED\.get\(\)\)\)return/.test(app));
  check('H. 交換所に「曲」の売り場と買う口がある', /eventTab==='song'/.test(read('src/parts/55-screen-breeder-market.jsx')) && /offer\?\.kind==='song'/.test(app));
  check('H. 助手の選曲が持っている曲で絞られる', /rhythmSongPickable\(catalog\)/.test(read('src/parts/80-screen-rhythm-assistant-session.jsx')));

  console.log(failed ? `\n${failed} 件 NG` : '\n全部 OK');
  process.exit(failed ? 1 : 0);
})();
