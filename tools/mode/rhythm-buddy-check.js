#!/usr/bin/env node
// 相棒(モンヒロビートのマルチに呼ぶ、自分のマスモン)を、通信も実時間も使わずに動かして確かめる。
//
//   node tools/mode/rhythm-buddy-check.js
//
// 【なぜ要るか】
// 相棒は、呼んだ人の端末が「もう1人ぶん」の知らせを代わりに出して部屋に入る作り(サーバーを持たない)。
// 部屋主にならないこと・抜けるときに一緒に消えること・MVPを取らないこと・報酬の人数に入ることは、
// 実機で2台以上そろえないと試せない。ここでは本物の RHYTHM_MULTI(77-screen-rhythm-multi.jsx)と
// 相棒の計算(33-rhythm-buddy.jsx)を、偽の通信と偽の時計の上で動かして決めごとを1つずつ確かめる。
// 仕様の正本: docs/spec/RHYTHM_BUDDY.md
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const MULTI = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/77-screen-rhythm-multi.jsx'), 'utf8');
const BUDDY = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/33-rhythm-buddy.jsx'), 'utf8');
const cut = MULTI.indexOf('const useRhythmMultiView');
if (cut < 0) { console.log('NG: RHYTHM_MULTI の部分を切り出せませんでした'); process.exit(1); }
const multiSource = MULTI.slice(0, cut);

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ===== A. 相棒の計算(純粋) =====
const pure = (() => {
  const sb = { Math, Date, Object, Number, String, Array, JSON, console };
  vm.createContext(sb);
  vm.runInContext(`${BUDDY}\n;globalThis.__b={norm:rhythmBuddyNormalize,normMon:rhythmBuddyNormalizeMon,freeLeft:rhythmBuddyFreeLeft,useFree:rhythmBuddyUseFree,
    level:rhythmBuddyLevelInfo,apply:rhythmBuddyApplyLive,stars:rhythmBuddyFamiliarStars,mood:rhythmBuddyMood,moods:RHYTHM_BUDDY_MOODS,
    play:rhythmBuddyPlay,lean:rhythmBuddySpeciesLean,comfort:rhythmBuddyComfortLevelOf,day:rhythmBuddyDayKey,key:RHYTHM_BUDDY_KEY,free:RHYTHM_BUDDY_FREE_PER_DAY,max:RHYTHM_BUDDY_LEVEL_MAX,need:rhythmBuddyNeedExp};`, sb);
  return sb.__b;
})();
{
  const b = pure;
  check('保存キーは新しいキー(mh_rhythm_buddy_v1)', b.key === 'mh_rhythm_buddy_v1');
  const broken = [null, undefined, 'x', 3, [], { mons: 'x' }, { day: 5, used: -3, mons: { a: { exp: 'zz', songs: [1], diffs: null, trait: 'evil' } } }];
  check('壊れた保存でも既定値で読める', broken.every((raw) => { const s = b.norm(raw); return s && typeof s.mons === 'object' && Number.isFinite(s.used) && s.used >= 0; }));
  const bad = b.norm(broken[6]).mons.a;
  check('知らない性格・壊れた数字は捨てる', bad && bad.trait === '' && bad.exp === 0 && Object.keys(bad.songs).length === 0 && bad.diffs.MASTER === 0);

  let st = b.norm(null);
  const d1 = '2026-10-07';
  check('1日に無料で呼べるのは3回', b.free === 3 && b.freeLeft(st, d1) === 3);
  for (let i = 0; i < 3; i += 1) st = b.useFree(st, d1);
  check('3回使うと残り0回になり、4回目は使えない(null)', b.freeLeft(st, d1) === 0 && b.useFree(st, d1) === null);
  check('日付が変わると3回に戻る', b.freeLeft(st, '2026-10-08') === 3);
  // 朝5:00(JST)で区切る: JST 4:59 は前の日、5:00 はその日
  const jst = (h, m) => Date.UTC(2026, 9, 7, h - 9, m);
  check('日付の区切りは朝5:00(JST)', b.day(jst(4, 59)) === '2026-10-06' && b.day(jst(5, 0)) === '2026-10-07');

  check('Lv は1から始まり、100で止まる', b.level(0).level === 1 && b.level(1e9).level === b.max && b.max === 100);
  let expTo50 = 0; for (let l = 1; l < 50; l += 1) expTo50 += b.need(l);
  let expTo100 = expTo50; for (let l = 50; l < 100; l += 1) expTo100 += b.need(l);
  check('Lv.50までは1,000〜2,500(30〜50ライブ)、Lv.100までは5,000〜8,000(100〜160ライブ)', expTo50 >= 1000 && expTo50 <= 2500 && expTo100 >= 5000 && expTo100 <= 8000, `${expTo50} / ${expTo100}`);

  const r1 = b.apply(null, { round: 'r1', songId: 'songA', diffId: 'HARD', durationMs: 120000, teamRank: 'A', dayKey: d1, lean: 'steady', nowMs: 1 });
  const r1b = b.apply(r1.mon, { round: 'r1', songId: 'songA', diffId: 'HARD', durationMs: 120000, teamRank: 'A', dayKey: d1, lean: 'steady', nowMs: 2 });
  check('1ライブで経験値・回数・なじみ・難易度の熟練が増える', r1.gain > 0 && r1.mon.lives === 1 && r1.mon.songs.songA === 1 && r1.mon.diffs.HARD === 1);
  check('同じ回(round)は2度数えない', r1b.gain === 0 && r1b.mon.lives === 1);
  const rs = b.apply(null, { round: 'rs', songId: 'songA', diffId: 'MASTER', teamRank: 'S', dayKey: d1, nowMs: 5, score: 812345, maxScore: 1000000 });
  check('スコアの伸びのために、その回のスコアと満点を覚える', rs.mon.recent.length === 1 && rs.mon.recent[0].score === 812345 && rs.mon.recent[0].max === 1000000 && rs.mon.recent[0].diffId === 'MASTER');
  let many = null; for (let i = 0; i < 40; i += 1) many = b.apply(many, { round: `m${i}`, songId: 'songA', diffId: 'EASY', teamRank: 'C', dayKey: d1, nowMs: i, score: i, maxScore: 600000 }).mon;
  check('覚えるのは最近30回まで(新しい順)', many.recent.length === 30 && many.recent[0].score === 39);
  check('壊れたスコアの記録は捨てる', b.normMon({ recent: [null, { score: 9, max: 5 }, { score: 'x', max: 10 }, 7] }).recent.length === 1);
  check('叩ける譜面Lv.の目安は、育つほど上がる(Lv.1 で14前後・Lv.100 で50台)', b.comfort(null) >= 12 && b.comfort(null) <= 16 && b.comfort({ exp: 1e9 }) >= 50, `${b.comfort(null)} → ${b.comfort({ exp: 1e9 })}`);
  check('難しい難易度・高いチームランクほど経験値が多い',
    b.apply(null, { round: 'x', diffId: 'MASTER', teamRank: 'S' }).gain > b.apply(null, { round: 'x', diffId: 'EASY', teamRank: 'C' }).gain);
  check('得意度は0〜5の星。インテリは早くたまる', b.stars(0, '') === 0 && b.stars(1, '') === 1 && b.stars(99, '') === 5 && b.stars(4, 'smart') > b.stars(4, ''));

  // 性格は Lv.10 まで見えない
  let mon = null; let traitAtLevel = 0;
  for (let i = 0; i < 400 && !traitAtLevel; i += 1) {
    const r = b.apply(mon, { round: `r${i}`, songId: 'songA', diffId: i % 2 ? 'MASTER' : 'EXPERT', durationMs: 60000, teamRank: 'B', dayKey: d1, lean: '', nowMs: 1 });
    mon = r.mon;
    if (mon.trait) traitAtLevel = b.level(mon.exp).level;
  }
  check('性格は Lv.50 で決まる', traitAtLevel === 50, `Lv.${traitAtLevel}`);
  check('EXPERT・MASTER をよく遊ぶとひょうきん(種類の傾向より育て方が勝つ)', mon && mon.trait === 'jester', mon && mon.trait);

  // 9つの性格: 育て方ごとに決まる
  const grow = (opts) => {
    let m2 = null;
    for (let i = 0; i < 60; i += 1) {
      const day = new Date(Date.UTC(2026, 9, 1) + (opts.daily ? i : 0) * 86400000).toISOString().slice(0, 10);
      const diffId = typeof opts.diff === 'function' ? opts.diff(i) : opts.diff;
      m2 = b.apply(m2, { round: `g${i}`, songId: opts.songs ? `s${i}` : 'songA', diffId, durationMs: opts.long ? 200000 : 100000, teamRank: 'B', dayKey: day, lean: '', nowMs: i,
        chartLevel: opts.hard ? 99 : 1, humans: opts.crowd ? 4 : 1, moodId: opts.bad ? 'bad' : 'normal' }).mon;
    }
    return m2.trait;
  };
  const mixed = (i) => ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER'][i % 5];
  const cases = {
    brave: grow({ diff: mixed, hard: true }), proud: grow({ diff: mixed, crowd: true }), worrier: grow({ diff: mixed, bad: true }),
    clingy: grow({ diff: mixed, daily: true }), smart: grow({ diff: mixed, songs: true }), easygoing: grow({ diff: mixed, long: true }),
    stubborn: grow({ diff: 'NORMAL' }), serious: grow({ diff: (i) => ['EASY', 'NORMAL', 'HARD'][i % 3] }),
  };
  check('9つの性格は、それぞれの育て方で決まる', Object.entries(cases).every(([want, got]) => want === got), JSON.stringify(cases));
  check('はじめの4つで決まっていた性格は、読み込むときに置き換える', ['steady', 'burst', 'stamina', 'artisan'].map((t) => b.normMon({ trait: t }).trait).join(',') === 'serious,jester,easygoing,smart');
  // 効き目
  const seqT = (seed) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
  const normalT = b.moods.find((m) => m.id === 'normal');
  const playAvg = (trait, extra = {}) => { const rand = seqT(11); let sum = 0; let miss = 0; for (let i = 0; i < 300; i += 1) { const r = b.play({ mon: { exp: 3000, trait, diffs: { MASTER: 30, EASY: 0 } }, songId: 's', diffId: 'MASTER', totalNotes: 330, maxScore: 1000000, durationMs: 100000, mood: normalT, rand, chartLevel: 26, ...extra }); sum += r.score; miss += r.judgments.MISS; } return { avg: sum / 300, miss: miss / 300 }; };
  check('勇敢は、難しい譜面で落ちにくい', playAvg('brave', { chartLevel: 47 }).avg > playAvg('serious', { chartLevel: 47 }).avg);
  check('心配性は、MISSが少ない', playAvg('worrier').miss < playAvg('serious').miss);
  check('プライドが高いは、人が多い部屋ほど上手', playAvg('proud', { humans: 5 }).avg > playAvg('proud', { humans: 1 }).avg);
  const stubEasy = (() => { const rand = seqT(5); let s1 = 0; for (let i = 0; i < 300; i += 1) s1 += b.play({ mon: { exp: 3000, trait: 'stubborn', diffs: {} }, songId: 's', diffId: 'MASTER', totalNotes: 330, maxScore: 1000000, durationMs: 100000, mood: normalT, rand, chartLevel: 26 }).score; return s1 / 300; })();
  check('頑固は、慣れていない難易度でかなり落ちる', stubEasy < playAvg('stubborn').avg - 30000, `${Math.round(stubEasy)}`);
  const clingyBad = (lastDay) => { let n = 0; for (let i = 0; i < 2000; i += 1) if (['bad', 'awful'].includes(b.mood(`c${i}`, d1, { trait: 'clingy', lastDay }).id)) n += 1; return n; };
  check('甘えん坊は、毎日呼ぶと不機嫌になりにくく、何日もあくと不機嫌になりやすい', clingyBad('2026-10-06') < 300 && clingyBad('2026-09-30') > 800, `${clingyBad('2026-10-06')} / ${clingyBad('2026-09-30')}`);

  const counts = {};
  for (let i = 0; i < 4000; i += 1) { const m = b.mood(`masu_${i}`, d1, null); counts[m.id] = (counts[m.id] || 0) + 1; }
  const near = (id, pct) => Math.abs(counts[id] / 4000 * 100 - pct) < 3;
  check('調子の出やすさは 10/25/35/20/10%', near('great', 10) && near('good', 25) && near('normal', 35) && near('bad', 20) && near('awful', 10), JSON.stringify(counts));
  check('調子は同じ子・同じ日なら何度見ても同じ', b.mood('masu_a', d1, null).id === b.mood('masu_a', d1, null).id);
  let kept = 0; let plain = 0;
  for (let i = 0; i < 4000; i += 1) {
    if (['bad', 'awful'].includes(b.mood(`m${i}`, d1, { lastDay: '2026-10-06' }).id)) kept += 1;
    if (['bad', 'awful'].includes(b.mood(`m${i}`, d1, null).id)) plain += 1;
  }
  check('前の日に一緒に遊ぶと、不機嫌が出にくい', kept < plain, `${kept} < ${plain}`);

  // 演奏の結果
  const seq = (seed) => { let x = seed; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
  const normal = b.moods.find((m) => m.id === 'normal');
  // 譜面は実際の曲の真ん中あたり(MASTER は Lv.26・1秒に3.3個)。chart で変えられる
  const run = (lvExp, diffId, max, plays, songPlays = 0, chart = {}) => {
    const lvOf = { EASY: 7, NORMAL: 9, HARD: 14, EXPERT: 19, MASTER: 26 }[diffId];
    const chartLevel = chart.level || lvOf;
    const notes = chart.notes || Math.round((1 + chartLevel / 10) * 100);
    const rand = seq(7); const scores = []; let fc = 0; let perfect = 0; let over = false;
    for (let i = 0; i < 400; i += 1) {
      const r = b.play({ mon: { exp: lvExp, diffs: { [diffId]: plays }, songs: { s: songPlays } }, songId: 's', diffId, totalNotes: notes, maxScore: max, durationMs: 100000, mood: normal, rand, chartLevel });
      if (r.score > max || r.score < 0) over = true;
      scores.push(r.score); if (r.fullCombo) fc += 1; if (r.score >= max) perfect += 1;
    }
    scores.sort((x, y) => x - y);
    return { over, fc, perfect, avg: scores.reduce((x, y) => x + y, 0) / scores.length, width: scores[379] - scores[20] };
  };
  const lv1 = run(0, 'EASY', 600000, 0);
  const lv50 = run(1e9, 'EASY', 600000, 40);
  const lv1m = run(0, 'MASTER', 1000000, 0);
  const lv50m = run(1e9, 'MASTER', 1000000, 40);
  const lv50mFav = run(1e9, 'MASTER', 1000000, 40, 30);
  check('スコアは0〜その難易度の満点に収まる', [lv1, lv50, lv1m, lv50m, lv50mFav].every((x) => !x.over));
  check('育つほどうまくなる(Lv.1 < Lv.50)', lv1.avg < lv50.avg, `${Math.round(lv1.avg)} < ${Math.round(lv50.avg)}`);
  // 育ちきると満点に近づいて差が小さくなるので、Lv.50(経験値1,800)で比べる
  const midFav = run(1764, 'MASTER', 1000000, 40, 30);
  const midNew = run(1764, 'MASTER', 1000000, 40, 0);
  check('遊んだ曲ほど得意(30回遊んだ曲 > 初めての曲)', midFav.avg > midNew.avg + 30000, `${Math.round(midFav.avg)} > ${Math.round(midNew.avg)}`);
  const lv50mFav50 = run(1e9, 'MASTER', 1000000, 40, 60);
  check('育ちきって得意な曲なら、MASTERでSに届き、たまに満点(上限は満点)', lv50mFav.avg >= 850000 && lv50mFav50.perfect > 0, `平均${Math.round(lv50mFav.avg)} 満点${lv50mFav50.perfect}/400`);
  const hardChart = run(1e9, 'MASTER', 1000000, 40, 0, { level: 47 });
  const easyChart = run(1e9, 'MASTER', 1000000, 40, 0, { level: 20 });
  check('譜面のLv.が高いほどスコアが落ちる(同じ MASTER でも Lv.20 > Lv.47)', easyChart.avg > hardChart.avg, `${Math.round(easyChart.avg)} > ${Math.round(hardChart.avg)}`);
  const midLv = 250; // 経験値250(Lv.15前後)
  const reach26 = run(midLv, 'MASTER', 1000000, 40, 0, { level: 26 });
  const reach47 = run(midLv, 'MASTER', 1000000, 40, 0, { level: 47 });
  check('育ちかけの相棒には、難しい譜面ほど差が大きい', (reach26.avg - reach47.avg) > (easyChart.avg - hardChart.avg), `${Math.round(reach26.avg - reach47.avg)} > ${Math.round(easyChart.avg - hardChart.avg)}`);
  const dense = run(1e9, 'MASTER', 1000000, 40, 0, { level: 26, notes: 560 });
  check('Lv.の割にノーツが詰まった譜面は、さらに少し落ちる', dense.avg < run(1e9, 'MASTER', 1000000, 40, 0, { level: 26 }).avg);
  check('育てはじめは満点もフルコンボも出ない', lv1.perfect === 0 && lv1m.perfect === 0 && lv1.fc === 0 && lv1m.fc === 0);
  check('うまくなるほどブレが小さい(Lv.1 の振れ幅 > Lv.50)', lv1m.width > lv50m.width, `${lv1m.width} > ${lv50m.width}`);
  const great = b.moods.find((m) => m.id === 'great');
  const awful = b.moods.find((m) => m.id === 'awful');
  const byMood = (mood) => { const rand = seq(3); let s = 0; for (let i = 0; i < 300; i += 1) s += b.play({ mon: { exp: 5000 }, songId: 's', diffId: 'HARD', totalNotes: 500, maxScore: 800000, mood, rand }).score; return s / 300; };
  check('調子が良い日ほどスコアが高い', byMood(great) > byMood(normal) && byMood(normal) > byMood(awful));

  const bases = [{ baseHp: 900, baseAtk: 100, baseDef: 60, baseGuts: 120 }, { baseHp: 300, baseAtk: 220, baseDef: 50, baseGuts: 100 }, { baseHp: 500, baseAtk: 100, baseDef: 250, baseGuts: 80 }, { baseHp: 300, baseAtk: 120, baseDef: 50, baseGuts: 180 }];
  check('種類の傾向は能力値でいちばん抜けたもの(ライフ→のんびり屋・ちから→勇敢・丈夫さ→真面目・ガッツ→ひょうきん)',
    bases.map((x) => b.lean(x, bases)).join(',') === 'easygoing,brave,serious,jester');
}

// ===== B. 部屋の中の相棒 =====
const clock = {
  now: 1_800_000_000_000, seq: 0, timers: new Map(),
  set(fn, ms, repeat) { const id = ++this.seq; this.timers.set(id, { fn, at: this.now + Math.max(0, ms || 0), ms: Math.max(1, ms || 0), repeat }); return id; },
  clear(id) { this.timers.delete(id); },
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      let next = null;
      for (const [id, t] of this.timers) if (t.at <= end && (!next || t.at < next[1].at || (t.at === next[1].at && id < next[0]))) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      this.now = Math.max(this.now, t.at);
      if (t.repeat) t.at += t.ms; else this.timers.delete(id);
      try { t.fn(); } catch (e) { console.log('NG: タイマーの中で例外', e && e.message); failed++; }
    }
    this.now = end;
  },
};
const hub = { sockets: new Set() };
class FakeSocket {
  constructor() {
    this.readyState = 0; this.topic = null; this.owner = FakeSocket.owner;
    hub.sockets.add(this);
    clock.set(() => { if (this.readyState === 0) { this.readyState = 1; this.onopen && this.onopen(); } }, 0, false);
  }
  deliver(msg) { if (this.readyState !== 1) return; const data = JSON.stringify(msg); clock.set(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0, false); }
  send(data) {
    if (this.readyState !== 1) throw new Error('closed');
    const m = JSON.parse(data);
    if (m.event === 'phx_join') { this.topic = m.topic; this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } }); return; }
    if (m.event !== 'broadcast') return;
    for (const s of hub.sockets) if (s.topic === m.topic) s.deliver({ topic: m.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: m.payload.payload } });
  }
  close() { this.readyState = 3; hub.sockets.delete(this); }
}
const RANKS = [['M', 1000000], ['SS', 900000], ['S', 800000], ['A', 700000], ['B', 600000], ['C', 500000], ['D', 0]];
let seq = 0;
const makeClient = (name, { brain = true } = {}) => {
  const tag = `${name}#${++seq}`;
  const sandbox = {
    console, Math, JSON, Object, Array, Number, String, Boolean, Promise, Set, Map, Error,
    Date: { now: () => clock.now },
    setTimeout: (fn, ms) => clock.set(fn, ms, false), clearTimeout: (id) => clock.clear(id),
    setInterval: (fn, ms) => clock.set(fn, ms, true), clearInterval: (id) => clock.clear(id),
    SUPABASE_URL: 'https://example.test', SUPABASE_KEY: 'test-key',
    WebSocket: class extends FakeSocket { constructor(url) { FakeSocket.owner = tag; super(url); } },
    storeGet: async (k, d) => d, storeSet: async () => {},
    rhythmRankForScore: (score) => (RANKS.find(([, min]) => score >= min) || ['D'])[0],
    RHYTHM_LOOK_PRESETS: [{ id: 'LIGHT', values: {} }],
  };
  vm.createContext(sandbox);
  vm.runInContext(`${multiSource}\n;globalThis.__api={M:RHYTHM_MULTI,team:rhythmMultiTeamResult,clean:rhythmMultiCleanMessage,scale:rhythmMultiRewardScale,total:rhythmMultiTotalScale};`, sandbox);
  const api = sandbox.__api;
  const starts = [];
  api.M.onStart((info) => starts.push(info));
  api.M.setCatalog(['songA', 'songB', 'songC'], { songA: 60000, songB: 90000, songC: 120000 });
  const plays = [];
  const refunds = [];
  if (brain) {
    api.M.setCpuBrain({
      play: (req) => { plays.push(req); return { score: 650000, maxCombo: 300, judgments: { MARVELOUS: 300, EXCELLENT: 50, GREAT: 20, GOOD: 5, BAD: 2, MISS: 3 }, fast: 30, slow: 47 }; },
      pick: () => 'songC',
      refund: (masuId) => refunds.push(masuId),
    });
  }
  return { name, ...api, starts, plays, refunds };
};
const view = (c) => c.M.view();
const phaseOf = (c) => (view(c) ? view(c).room.phase : '-');
const join = (c, code, mode, i = 0) => { c.M.join(code, { name: c.name, level: 40, icon: '', frame: '', diff: 'HARD' }, mode); clock.advance(10 + i); };
const MATE = { masuId: 'masu_1', name: 'モッチー', level: 12, baseId: 'mocchi', colors: ['red', 'custom:120:50:80'] };

// B-1 ひとり + 相棒で、フリーマッチが始まる
{
  const a = makeClient('A');
  join(a, 'BUDY', 'free');
  clock.advance(3000);
  check('部屋に入ったら相棒を呼べる', a.M.canSummon() === true);
  check('相棒を呼べる', a.M.summon(MATE) === true);
  check('同じマスモンは2体呼べない(別の子なら呼べる)', a.M.summon(MATE) === false && a.M.canSummon() === true);
  clock.advance(2500);
  const v = view(a);
  const cpu = v.members.find((m) => m.cpu);
  check('相棒はメンバーに並び、自分が部屋主のまま', v.members.length === 2 && cpu && v.hostId === v.selfId && v.myCpus.length === 1 && v.myCpus[0].id === cpu.id && v.myCpus[0].masuId === 'masu_1');
  clock.advance(16000);
  check('相棒と2人なら、フリーマッチは待ち時間のあと選曲へ進む', phaseOf(a) === 'select', phaseOf(a));
  clock.advance(1500);
  const cpuSel = view(a).members.find((m) => m.cpu);
  check('相棒は選曲の段に入るとすぐ得意な曲を選ぶ', cpuSel.pick === 'songC' && cpuSel.pickRound === view(a).room.round);
  a.M.pick('songA');
  clock.advance(5000);
  check('人の選んだ曲が優先される(相棒の曲は抽選に入らない)', view(a).room.songId === 'songA' && phaseOf(a) === 'ready', view(a).room.songId);
  a.M.ready();
  clock.advance(1500);
  check('相棒もすぐ準備完了になり、ライブが始まる', phaseOf(a) === 'playing');
  check('報酬の人数に呼んだマスモンも入る(人1+マスモン1 = 1.3倍)', a.starts.length === 1 && a.starts[0].count === 2 && a.starts[0].cpus === 1 && a.scale(a.starts[0].count, a.starts[0].cpus) === 1.3, JSON.stringify(a.starts[0]));
  a.M.reportResult(view(a).room.round, { score: 600000, maxCombo: 200, cleared: true, judgments: {} }, false, { diffId: 'HARD' });
  clock.advance(1500);
  const cpuRes = view(a).members.find((m) => m.cpu).res;
  check('自分の演奏が終わると、相棒の結果も出る(難易度は自分と同じ)', cpuRes && cpuRes.score === 650000 && cpuRes.diffId === 'HARD' && a.plays.length === 1 && a.plays[0].masuId === 'masu_1');
  check('相棒の演奏は1ライブにつき1回だけ作る', a.plays.length === 1);
  check('全員の結果がそろうと結果の段へ進む', phaseOf(a) === 'result');
  const t = a.team(view(a).members, view(a).room.round, view(a).room.participants, true);
  check('相棒もMVPを取れる(スコアがいちばん上なら)', t.mvpId === view(a).myCpus[0].id);
  a.M.leave();
}

// B-2 ほかの人の端末からの見え方・部屋主・抜けたとき
{
  const a = makeClient('A');
  const b = makeClient('B', { brain: false });
  join(a, 'PALS', 'private', 0);
  join(b, 'PALS', 'private', 1);
  clock.advance(3000);
  a.M.summon(MATE);
  clock.advance(2500);
  const seen = view(b).members.find((m) => m.cpu);
  check('ほかの人にも相棒が見え、CPUのしるし・種類・染色の色が届く', seen && seen.name === 'モッチー' && seen.mb === 'mocchi' && seen.mc.join('|') === 'red|custom:120:50:80', seen && JSON.stringify({ mb: seen.mb, mc: seen.mc }));
  check('相棒は部屋主にならない', view(b).hostId === view(a).selfId && view(b).members.length === 3);
  check('ほかの人も自分のマスモンを1体呼べる(1人1体)', b.M.canSummon() === true && b.M.summon({ ...MATE, masuId: 'masu_b', name: 'スエゾー' }) === true);
  clock.advance(2500);
  check('2体そろって並ぶ。人が先、呼んだマスモンはうしろ', view(a).members.length === 4 && view(a).members.map((m) => (m.cpu ? 'c' : 'h')).join('') === 'hhcc', view(a).members.map((m) => (m.cpu ? 'c' : 'h')).join(''));
  a.M.leave();
  clock.advance(1000);
  check('呼んだ人が抜けると、その人のマスモンもすぐいなくなる(ほかの人のマスモンは残る)', view(b).members.length === 2 && view(b).members.filter((m) => m.cpu).length === 1 && view(b).members.find((m) => m.cpu).name === 'スエゾー', view(b).members.map((m) => m.name).join(','));
  b.M.leave();
}

// B-3 呼んだ人がライブに出ないとき・やめたとき
{
  const a = makeClient('A');
  const b = makeClient('B');
  join(a, 'SOLO', 'private', 0);
  join(b, 'SOLO', 'private', 1);
  clock.advance(3000);
  b.M.summon(MATE);
  clock.advance(2500);
  a.M.confirmMembers();
  clock.advance(1500);
  a.M.pick('songB'); b.M.pick('songB');
  clock.advance(5000);
  a.M.ready(); b.M.ready();
  clock.advance(1500);
  check('3人(相棒入り)でライブが始まる', phaseOf(a) === 'playing' && a.starts.length === 1 && a.starts[0].count === 3);
  b.M.reportResult(view(b).room.round, null, true, { diffId: 'HARD', noPenalty: true });
  clock.advance(1500);
  // (A はまだ演奏中で、届いた知らせを溜めている。呼んだ B の端末で見る)
  const cpuRes = view(b).members.find((m) => m.cpu).res;
  check('呼んだ人がやめても、相棒は最後まで演奏した扱いで結果を出す', cpuRes && !cpuRes.quit && cpuRes.score === 650000);
  a.M.reportResult(view(a).room.round, { score: 500000, maxCombo: 100, cleared: true, judgments: {} }, false, { diffId: 'HARD' });
  clock.advance(1500);
  const seenByA = view(a).members.find((m) => m.cpu).res;
  check('ほかの人にも、演奏が終わったあとで相棒の結果が届く', seenByA && seenByA.score === 650000 && phaseOf(a) === 'result');
  a.M.leave(); b.M.leave();
}

// B-5 人が来たら、呼んだマスモンが席をゆずる(5人まで。人が優先)
{
  const cs = ['A', 'B', 'C', 'D'].map((n) => makeClient(n));
  cs.forEach((c, i) => join(c, 'FULL', 'private', i));
  clock.advance(3000);
  check('4人の部屋で、1人がマスモンを呼べる', cs[0].M.summon(MATE) === true);
  clock.advance(2500);
  check('5人で満員になり、ほかの人はもう呼べない', view(cs[1]).members.length === 5 && cs[1].M.canSummon() === false);
  const e = makeClient('E');
  join(e, 'FULL', 'private', 9);
  clock.advance(4000);
  check('人が入ってくると、呼んだマスモンが席をゆずって帰る', view(e).full === false && view(cs[1]).members.length === 5 && !view(cs[1]).members.some((m) => m.cpu), view(cs[1]).members.map((m) => m.name).join(','));
  check('席をゆずったぶん、呼んだ人に回数・券が返る(1回だけ)', cs[0].refunds.length === 1 && cs[0].refunds[0] === 'masu_1', JSON.stringify(cs[0].refunds));
  check('席をゆずったあとは、呼んでいる子がいなくなる', cs[0].M.myBuddies().length === 0);
  [...cs, e].forEach((c) => c.M.leave());
}

// B-6 ひとりで何体も呼べる(空きがあるだけ)。報酬は人+50%、マスモンは+30%/+20%/+10%/+10%
{
  const a = makeClient('A');
  join(a, 'SOLO4', 'free');
  clock.advance(3000);
  const ok = ['m1', 'm2', 'm3', 'm4'].map((id) => a.M.summon({ ...MATE, masuId: id, name: id }));
  check('ひとりで4体まで呼べる(5人で満員)', ok.every(Boolean) && view(a).members.length === 5 && a.M.canSummon() === false && a.M.summon({ ...MATE, masuId: 'm5' }) === false);
  check('人数ボーナス: 人1+マスモン1〜4 は 1.3 / 1.5 / 1.6 / 1.7 倍', [1, 2, 3, 4].map((c) => a.scale(1 + c, c)).join(',') === '1.3,1.5,1.6,1.7', [1, 2, 3, 4].map((c) => a.scale(1 + c, c)).join(','));
  check('人数ボーナス: 人2+マスモン3 は 2.1 倍、人だけの5人は今までどおり3倍', a.scale(5, 3) === 2.1 && a.scale(5, 0) === 3 && a.scale(5) === 3);
  check('連続ボーナスも掛け合わせる', a.total(5, 11, 4) === 3.4, String(a.total(5, 11, 4)));
  clock.advance(16000);
  check('ひとりとマスモンだけでも選曲へ進む', phaseOf(a) === 'select');
  a.M.pick('songA'); clock.advance(5000); a.M.ready(); clock.advance(1500);
  check('4体ともライブに入り、報酬はマスモン4体ぶんで数える', a.starts.length === 1 && a.starts[0].count === 5 && a.starts[0].cpus === 4, JSON.stringify(a.starts[0]));
  a.M.reportResult(view(a).room.round, { score: 600000, maxCombo: 200, cleared: true, judgments: {} }, false, { diffId: 'HARD' });
  clock.advance(1500);
  check('自分の演奏が終わると、呼んだ4体それぞれの結果が出る', a.plays.length === 4 && view(a).members.filter((m) => m.cpu && m.res).length === 4 && phaseOf(a) === 'result');
  a.M.leave();
}

// B-7 人がひとりだけ(あとは呼んだマスモン)のあいだは、選曲の制限時間を進めない
{
  const a = makeClient('A');
  join(a, 'FREE1', 'free');
  clock.advance(3000);
  a.M.summon(MATE);
  clock.advance(18000);
  check('ひとりとマスモンで、選曲の段へ進む', phaseOf(a) === 'select', phaseOf(a));
  const r0 = view(a).room;
  check('選曲の段は、制限時間なし(deadline 0)', r0.deadline === 0 && r0.left === 0, JSON.stringify({ d: r0.deadline, l: r0.left }));
  clock.advance(120000);
  check('2分待っても、選曲の段のまま(おまかせにならず、勝手に抽選もされない)', phaseOf(a) === 'select' && view(a).members.find((m) => !m.cpu).pick === '', phaseOf(a));
  a.M.pick('songB');
  clock.advance(2500);
  check('自分が選べば、すぐ抽選されて準備の段へ進む', phaseOf(a) === 'ready' && view(a).room.songId === 'songB', `${phaseOf(a)} ${view(a).room.songId}`);
  a.M.leave();
}

// B-8 選曲の段のあいだに人が入ってきたら、そこから制限時間が始まる
{
  const a = makeClient('A');
  const b = makeClient('B', { brain: false });
  join(a, 'FREE2', 'private', 0);
  clock.advance(3000);
  a.M.summon(MATE);
  clock.advance(2500);
  a.M.confirmMembers();
  clock.advance(2500);
  check('ひとり+マスモンの選曲の段は、制限時間なし', phaseOf(a) === 'select' && view(a).room.deadline === 0);
  join(b, 'FREE2', 'private', 1);
  clock.advance(4500);
  check('人が入ると、制限時間が始まる(残り30秒以内)', view(a).room.deadline > 0 && view(a).room.left > 0 && view(a).room.left <= 30, JSON.stringify({ l: view(a).room.left }));
  clock.advance(40000);
  check('時間切れになると、ふつうに抽選へ進む(人が2人いるとき)', phaseOf(a) !== 'select', phaseOf(a));
  a.M.leave(); b.M.leave();
}

// B-4 古い端末との行き来(相棒の項目が無い知らせ)
{
  const c = makeClient('x');
  const plain = c.clean({ t: 'hb', id: 'p1', name: 'ふつうの人' });
  check('相棒の項目が無い知らせは、ふつうの人として読む', plain && plain.cpu === false && plain.mb === undefined);
  const evil = c.clean({ t: 'hb', id: 'c1', cpu: 1, mb: '../x<script>', mc: ['<b>', 'a'.repeat(99), 1, null] });
  check('相棒の種類と色は、決まった文字だけを通す', evil && evil.mb === 'xscript' && evil.mc.every((x) => /^[A-Za-z0-9_#:-]*$/.test(x) && x.length <= 24));
}

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
