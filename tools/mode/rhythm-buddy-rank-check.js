#!/usr/bin/env node
// マスモンランキング(モンヒロビート)の行づくり・取得・上書き保存を、通信なしで確かめる。
//
//   node tools/mode/rhythm-buddy-rank-check.js
//
// 見張ること:
//   ・育ちの保存に「難易度ごとの最高スコア」が増えても、古い保存・壊れた保存で読める(既存の値を壊さない)
//   ・送る行は、遊んだことのあるマスモンだけ。名前はそのマスモンの名前で、血統の名前に置き換えない
//   ・取得はビートLv順/難易度ごとのスコア順で、テーブルが無い環境では黙って「準備中」になる
//   ・書き込みは rhythm_buddy_ranks だけ(rankings・bond_levels には触れない)。削除はしない
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md「マスモンランキング」
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', f), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const calls = [];
let nextResponse = null;
const sb = {
  Math, Date, Object, Number, String, Array, JSON, console, Map, Promise, setTimeout, clearTimeout,
  AbortController,
  ALL_PLAYER_MONSTERS: { Mocchi: { name: 'モッチー' }, Ham: { name: 'ハム' } },
  rankingPartyColors: (id, c) => [(c || [])[0] || null, (c || [])[1] || null],
  getMasuColors: (m) => m.colors || [],
  rankingProfileFrameValue: (v) => (v && v !== 'none' ? v : null),
  normalizeProfileFrameId: (v) => v || 'none',
  SUPABASE_URL: 'https://example.invalid', SB_HEADERS: { apikey: 'k' },
  _isMissingTableError: (status, body) => status === 404 && /PGRST205/.test(String(body || '')),
  fetch: async (url, opt = {}) => {
    calls.push({ url: String(url), method: (opt && opt.method) || 'GET', body: opt && opt.body });
    const r = nextResponse || { status: 200, body: '[]' };
    return { ok: r.status >= 200 && r.status < 300, status: r.status, statusText: '', text: async () => r.body };
  },
  bondLevelRowSignature: (row) => JSON.stringify(row),
};
vm.createContext(sb);
vm.runInContext(`${read('33-rhythm-buddy.jsx')}\n${read('39-rhythm-buddy-rank-api.jsx')}\n;globalThis.__r={
  norm:rhythmBuddyNormalizeMon, apply:rhythmBuddyApplyLive, rows:rhythmBuddyRankRows, entry:rhythmBuddyRankEntryFromRow, merge:rhythmBuddyRankMerge,
  fetchRanks:sbFetchRhythmBuddyRanks, upsert:sbUpsertRhythmBuddyRanks, toSync:rhythmBuddyRankRowsToSync, syncKey:rhythmBuddyRankSyncKeyOf,
  normSync:normalizeRhythmBuddyRankSync, unavailable:buddyRanksUnavailable, level:rhythmBuddyLevelInfo, table:RHYTHM_BUDDY_RANK_TABLE, syncStoreKey:RHYTHM_BUDDY_RANK_SYNC_KEY};`, sb);
const R = sb.__r;

(async () => {
  // ===== 最高スコア(育ちの保存) =====
  const broken = [null, 'x', 5, [], { best: 'x' }, { best: { MASTER: 3, EXPERT: { score: 'zz' }, NOPE: { score: 9 } } }];
  check('壊れた「最高スコア」でも読める(空になる)', broken.every((raw) => { const m = R.norm(raw); return m && typeof m.best === 'object' && Object.keys(m.best).length === 0; }));
  const old = R.norm({ exp: 100, recent: [{ at: 1, songId: 's1', diffId: 'MASTER', score: 800000, max: 1000000 }, { at: 0, songId: 's2', diffId: 'MASTER', score: 900000, max: 1000000 }, { at: 0, songId: 's3', diffId: 'HARD', score: 500000, max: 1000000 }] });
  check('「最高スコア」の無い古い保存は、残っている最近のスコアから拾い直す', old.best.MASTER.score === 900000 && old.best.MASTER.songId === 's2' && old.best.HARD.score === 500000);
  const live = (mon, o) => R.apply(mon, { round: o.round, songId: o.songId, diffId: o.diffId, durationMs: 60000, teamRank: 'B', dayKey: '2026-10-07', lean: '', nowMs: 1, score: o.score, maxScore: 1000000 }).mon;
  let mon = live(null, { round: 'a', songId: 'sA', diffId: 'MASTER', score: 700000 });
  check('遊んだスコアが、その難易度の最高になる', mon.best.MASTER.score === 700000 && mon.best.MASTER.songId === 'sA');
  mon = live(mon, { round: 'b', songId: 'sB', diffId: 'MASTER', score: 650000 });
  check('低いスコアでは最高は変わらない', mon.best.MASTER.score === 700000 && mon.best.MASTER.songId === 'sA');
  mon = live(mon, { round: 'c', songId: 'sB', diffId: 'MASTER', score: 810000 });
  mon = live(mon, { round: 'd', songId: 'sC', diffId: 'EASY', score: 400000 });
  check('高いスコアで更新され、別の難易度は別々に持つ', mon.best.MASTER.score === 810000 && mon.best.MASTER.songId === 'sB' && mon.best.EASY.score === 400000 && !mon.best.HARD);
  // 満点(max)を超える値は満点に丸める
  const over = R.apply(null, { round: 'z', songId: 's', diffId: 'HARD', durationMs: 1, teamRank: 'B', dayKey: '2026-10-07', lean: '', nowMs: 1, score: 9999999, maxScore: 1000000 }).mon;
  check('満点を超えるスコアは満点に丸める', over.best.HARD.score === 1000000);

  // ===== 送る行 =====
  const store = { mons: { 10: mon, 11: R.norm({}), 12: R.norm({ exp: 500, lives: 3 }) } };
  const masu = [
    { id: 10, baseId: 'Mocchi', name: 'もちこ', colors: ['#f00'] },
    { id: 11, baseId: 'Ham', name: 'はむ' },
    { id: 12, baseId: 'Ham', name: '' },
    { id: 13, baseId: 'Ham', name: '未プレイ' },
    { id: 14, baseId: 'Unknown', name: '知らない種' },
  ];
  const rows = R.rows('あ', '🐣', masu, store, null, null);
  check('遊んだことのあるマスモンだけ行になる(遊んでいない・知らない種は載せない)', rows.length === 2 && rows.map((r) => r.individual_id).join() === '10,12', rows.map((r) => r.individual_id).join());
  const r10 = rows[0];
  check('名前はそのマスモンの名前(血統の名前に置き換えない)', r10.mon_name === 'もちこ' && r10.monster_id === 'Mocchi');
  check('名前が空なら種の名前で補う', rows[1].mon_name === 'ハム');
  check('染色は位置を保って送る', JSON.stringify(r10.colors) === JSON.stringify(['#f00', null]) && rows[1].colors === null);
  check('ビートLvと経験値・難易度ごとの最高スコアが入る', r10.beat_level === R.level(mon.exp).level && r10.beat_exp === Math.floor(mon.exp) && r10.score_master === 810000 && r10.score_easy === 400000 && r10.score_hard === null && r10.best_songs.MASTER === 'sB');
  check('ブリーダーIDが無い端末では列ごと付けない', !('breeder_id' in r10) && !('profile_frame' in r10));
  const withId = R.rows('あ', null, masu, store, 'frame1', 'bid-1')[0];
  check('ブリーダーIDとフレームがあれば付ける', withId.breeder_id === 'bid-1' && withId.profile_frame === 'frame1' && withId.icon === null);

  // ===== 指紋(同じ行は送り直さない) =====
  const sent = {}; rows.forEach((r) => { sent[R.syncKey(r)] = JSON.stringify(r); });
  check('前に送った行は送らない', R.toSync(rows, sent).length === 0);
  check('中身が変わった行だけ送る', R.toSync([{ ...rows[0], beat_level: rows[0].beat_level + 1 }, rows[1]], sent).length === 1);
  check('壊れた指紋は空から(全員を送り直すだけ)', Object.keys(R.normSync({ sent: 'x' }).sent).length === 0 && Object.keys(R.normSync(null).sent).length === 0);
  check('指紋の保存キーは新しいキー', R.syncStoreKey === 'mh_rhythm_buddy_rank_sync_v1');

  // ===== 画面で使う形・重複整理 =====
  check('知らない種・個体IDの無い行は捨てる', R.entry({ individual_id: 'x', monster_id: 'Nope' }) === null && R.entry({ monster_id: 'Ham' }) === null && R.entry(null) === null);
  const e1 = R.entry({ user_name: 'あ', breeder_id: 'b1', individual_id: '10', monster_id: 'Mocchi', mon_name: 'もちこ', beat_level: '30', beat_exp: 99, lives: 5, score_master: 800000, score_easy: 'zz', best_songs: { MASTER: 's' }, updated_at: '2026-10-07T01:00:00Z' });
  check('壊れた数字は捨てる', e1.beatLevel === 30 && e1.scores.MASTER === 800000 && !('EASY' in e1.scores) && e1.songs.MASTER === 's');
  const dup = R.merge([
    R.entry({ user_name: '旧名', breeder_id: 'b1', individual_id: '10', monster_id: 'Mocchi', beat_level: 10, updated_at: '2026-10-01T00:00:00Z' }),
    R.entry({ user_name: '新名', breeder_id: 'b1', individual_id: '10', monster_id: 'Mocchi', beat_level: 12, updated_at: '2026-10-07T00:00:00Z' }),
    R.entry({ user_name: '別人', breeder_id: 'b2', individual_id: '10', monster_id: 'Mocchi', beat_level: 5, updated_at: '2026-10-07T00:00:00Z' }),
  ]);
  check('改名で2行になった同じ個体は新しい方だけ見せる(別の人の同じ個体IDは別扱い)', dup.length === 2 && dup.some((e) => e.userName === '新名') && !dup.some((e) => e.userName === '旧名'));

  // ===== 取得 =====
  const row = (i, lv, ms) => ({ user_name: `p${i}`, breeder_id: `b${i}`, individual_id: `m${i}`, monster_id: 'Ham', beat_level: lv, beat_exp: 1000 - i, score_master: ms, updated_at: '2026-10-07T00:00:00Z' });
  nextResponse = { status: 200, body: JSON.stringify([row(1, 10, 500), row(2, 30, 100), row(3, 30, 900)]) };
  const byLevel = await R.fetchRanks('level');
  check('ビートLv順(同じLvは経験値が多い方が上)', byLevel.map((e) => e.userName).join() === 'p2,p3,p1', byLevel.map((e) => e.userName).join());
  check('ビートLvの取得は rhythm_buddy_ranks だけを、Lv降順で読む', /rhythm_buddy_ranks\?/.test(calls[0].url) && /order=beat_level\.desc/.test(calls[0].url) && calls[0].method === 'GET' && !/rankings\?|bond_levels/.test(calls[0].url));
  const byScore = await R.fetchRanks('score', 'MASTER');
  check('スコア順は難易度の列で並べる', byScore.map((e) => e.userName).join() === 'p3,p1,p2' && /score_master=gt\.0/.test(calls[1].url) && /order=score_master\.desc/.test(calls[1].url), byScore.map((e) => e.userName).join());

  // ===== 書き込み =====
  nextResponse = { status: 201, body: '' };
  const okUp = await R.upsert(rows);
  const up = calls[calls.length - 1];
  check('上書き保存は POST で、主キー(名前×個体)でまとめる', okUp === true && up.method === 'POST' && /on_conflict=user_name,individual_id/.test(up.url) && /rhythm_buddy_ranks/.test(up.url));
  check('削除・別のテーブルへは書かない', calls.every((c) => c.method !== 'DELETE' && c.method !== 'PATCH') && calls.every((c) => !/\/rankings|bond_levels/.test(c.url)));
  check('空の行は送らない', (await R.upsert([])) === false);

  // ===== テーブルが無い環境 =====
  nextResponse = { status: 404, body: '{"code":"PGRST205","message":"Could not find the table"}' };
  const before = calls.length;
  const missing = await R.fetchRanks('level');
  check('テーブルが無ければ null(準備中)を返し、壊れない', missing === null && R.unavailable() === true);
  await R.fetchRanks('level'); await R.upsert(rows);
  check('無いと分かったあとは通信しない', calls.length === before + 1);

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('NG: 検査が途中で止まりました', e && e.stack || e); process.exit(1); });
