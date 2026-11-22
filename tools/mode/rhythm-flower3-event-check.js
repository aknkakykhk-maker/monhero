// 花の女3人のモンヒロビートイベント(data/rhythm-event.js の FLOWER3_*・台帳 r1119-101)を、画面なしで確かめる。
//
//   node tools/mode/rhythm-flower3-event-check.js
//
//   A. 受け口の曲がまだ公開曲に無いあいだは、イベントもHOMEの帯も入らない(画面は今までどおり)
//   B. 受け口の曲が入ると、イベント・帯・部門が自動でできる(週の区切りで終わる・参加報酬の曲数=入っている曲の数)
//   C. 曲は日ごとに開く(1曲目は開始・2曲目は翌朝4:00・3曲目はその翌朝4:00)。short ver. も本編と同じ時刻
//   D. イベントのあいだは無料、終わったらビートPで買う曲(値段の表に書かなくても既定の値段)
//   E. お話は本文が入っている話だけ・時刻が来た話だけ流す
const fs = require('fs'), path = require('path'), vm = require('vm');
const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const read = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const eventSrc = read('data/rhythm-event.js');
const ownedSrc = read('src/parts/39-rhythm-song-owned.jsx').split('// ビートP交換所の「曲」の売り場')[0];
const modeSrc = read('data/rhythm-mode.js');
const releasedSrc = (modeSrc.match(/const rhythmSongReleased=[\s\S]*?\n\};\n/) || [''])[0];
check('rhythm-mode.js の rhythmSongReleased がイベントの開く時刻を見る', releasedSrc.includes('rhythmEventSongOpenAtMs'));

const make = (published, { versions = null, replays = [] } = {}) => {
  const ctx = { console, React: {}, RHYTHM_DEMO_SONG_IDS: published, RHYTHM_SONG_RELEASE_AT: {}, EVENT_REPLAYS: replays,
    RHYTHM_SONGS: published.map(songId => ({ songId })), storeGet: async (k, d) => d };
  vm.createContext(ctx);
  const ev = versions ? eventSrc.replace('const FLOWER3_SONG_VERSIONS = Object.freeze({});', `const FLOWER3_SONG_VERSIONS = Object.freeze(${JSON.stringify(versions)});`) : eventSrc;
  vm.runInContext(`${releasedSrc}\n${ev}\n${ownedSrc}\nthis.api = { RHYTHM_EVENTS, RHYTHM_EVENT_POINT_CAMPAIGNS, rhythmLimitedEventAt, rhythmEventPointCampaignAt, rhythmSongReleased, rhythmSongPrice, rhythmSongLocked, rhythmEventHasSong, flower3StoryIdsAt, FLOWER3_SONG_SLOTS, FLOWER3_EVENT_ID, rhythmWeekStartMs };`, ctx);
  return ctx.api;
};
const T = (s) => Date.parse(s);

// A
const none = make(['monster_hero']);
check('A. 曲が無いあいだはイベントが入らない', !none.RHYTHM_EVENTS.some(e => e.id === none.FLOWER3_EVENT_ID));
check('A. 曲が無いあいだは帯(キャンペーン)も入らない', !none.RHYTHM_EVENT_POINT_CAMPAIGNS.some(c => c.id === 'flower3_2026'));
check('A. 曲が無いあいだはお話も流れない', none.flower3StoryIdsAt(T('2026-11-27T05:00:00+09:00')).length === 0);

// B
const ids = make([]).FLOWER3_SONG_SLOTS.map(s => s.songId);
const all = make(['monster_hero', ...ids], { replays: [{ id: 'flower3_2026_ep2', script: [{ t: 'a' }] }, { id: 'flower3_2026_ep3', script: [] }] });
const ev = all.RHYTHM_EVENTS.find(e => e.id === all.FLOWER3_EVENT_ID);
check('B. 曲が入るとイベントが入る', !!ev && ev.songIds.join() === ids.join());
check('B. 開始前は開いていない・開始で開く', all.rhythmLimitedEventAt(T('2026-11-23T11:59:59+09:00'))?.id !== all.FLOWER3_EVENT_ID
  && all.rhythmLimitedEventAt(T('2026-11-23T12:00:00+09:00'))?.id === all.FLOWER3_EVENT_ID);
check('B. 終わりは週の区切り(月曜4:00)', Date.parse(ev.endAt) === all.rhythmWeekStartMs(Date.parse(ev.endAt))
  && all.rhythmLimitedEventAt(T('2026-11-30T03:59:59+09:00'))?.id === all.FLOWER3_EVENT_ID && !all.rhythmLimitedEventAt(T('2026-11-30T04:00:00+09:00')));
check('B. 参加報酬の曲数は入っている曲の数', ev.participationReward.songs === ids.length);
check('B. 帯(周回5倍・ビートP5倍)が期間中だけ出る', all.rhythmEventPointCampaignAt(T('2026-11-25T10:00:00+09:00'))?.id === 'flower3_2026'
  && all.rhythmEventPointCampaignAt(T('2026-11-30T04:00:00+09:00'))?.id !== 'flower3_2026');
const one = make([ids[0]]);
const ev1 = one.RHYTHM_EVENTS.find(e => e.id === one.FLOWER3_EVENT_ID);
check('B. 1曲だけ入っていても、その1曲でイベントが開く', !!ev1 && ev1.songIds.length === 1 && ev1.participationReward.songs === 1);

// C
const at = (i, s) => all.rhythmSongReleased(ids[i], T(s));
check('C. 1曲目は開始の時刻から', !at(0, '2026-11-23T11:59:00+09:00') && at(0, '2026-11-23T12:00:00+09:00'));
check('C. 2曲目は 11/24 4:00 から', !at(1, '2026-11-24T03:59:59+09:00') && at(1, '2026-11-24T04:00:00+09:00'));
check('C. 3曲目は 11/25 4:00 から', !at(2, '2026-11-25T03:59:59+09:00') && at(2, '2026-11-25T04:00:00+09:00'));
check('C. 受け口でない曲は今までどおり', all.rhythmSongReleased('monster_hero', T('2026-11-23T00:00:00+09:00')));
const withShort = make([ids[0], `${ids[0]}_short`], { versions: { [ids[0]]: [`${ids[0]}_short`] } });
check('C. short ver. も本編と同じ時刻に開き、同じ曲として数える', !withShort.rhythmSongReleased(`${ids[0]}_short`, T('2026-11-23T11:00:00+09:00'))
  && withShort.rhythmSongReleased(`${ids[0]}_short`, T('2026-11-23T12:00:00+09:00'))
  && withShort.rhythmEventHasSong(withShort.RHYTHM_EVENTS.find(e => e.id === withShort.FLOWER3_EVENT_ID), `${ids[0]}_short`));

// D
check('D. 開催中は無料(鍵にならない)', all.rhythmSongPrice(ids[2], T('2026-11-29T23:00:00+09:00')) === 0 && !all.rhythmSongLocked(ids[2], []));
check('D. 終わったらビートPで買う曲(500)', all.rhythmSongPrice(ids[2], T('2026-11-30T04:00:00+09:00')) === 500);
check('D. ふつうの無料曲は無料のまま', all.rhythmSongPrice('monster_hero', T('2026-12-01T00:00:00+09:00')) === 0);

// E
check('E. 本文の入っている話だけ・時刻が来たら流す', all.flower3StoryIdsAt(T('2026-11-24T03:59:00+09:00')).length === 0
  && all.flower3StoryIdsAt(T('2026-11-26T05:00:00+09:00')).join() === 'flower3_2026_ep2');

console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);
