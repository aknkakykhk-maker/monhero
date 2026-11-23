#!/usr/bin/env node
// 曲鑑賞(オートプレイ・r1119-112)の自動の手が、全曲・全難易度のノーツを1つも取り逃さないかを、ブラウザを使わずに確かめる(2026-11-23 r1119-145)。
//   社長「もんびーの鑑賞でダブルフリックだけ音が出てない気がする」「鑑賞なのにみすってるときがある。とくにヘルで」
//   原因は、自動の手が読んでいたノーツの控え(演奏画面の読み取り口 rhythmNotes)に、払う向き(flickDir)・終点フリック(endFlick)・
//   スライドの点の空中の高さが無かったこと。左右のフリック(ダブルフリック)を上へ払い、空中スライドを地上で押していた(MISS になるので音も鳴らない)。
//
// やること: 自動の手の本体(src/parts/30-rhythm-preview-hands.jsx の rhythmPreviewHandsStart)を、そのまま仮の時計で動かして、
// 送る指の合図(押す・動かす・離す)を全部集める。そのあとノーツ1つずつ、ゲームの判定の関数(data/rhythm-mode.js)で照らす。
//   ・押す … 時刻がノーツの時刻ちょうどか。押した位置で、そのとき残っているノーツの中から、そのノーツを取るか(rhythmMatchInputBatch。
//            同じ時刻に先に押した指が取ったノーツ・押さえているロングは取られた扱い。空中の高さの受け付けも入る)
//   ・フリック … 押してから RHYTHM_FLICK_MAX_MS のうちに、払う向き・距離が成り立つか(rhythmFlickMatches)
//   ・ホールド・スライド … 終わりの近くで離すか。終点フリックは終わりの前の受付のうちに RHYTHM_FLICK_DISTANCE_PX 払うか
// 判定の窓そのもの・押さえている間のなぞりの細かい当たりは、本物のブラウザで流す tools/mode/rhythm-listen-play-check.js で見る。
//
//   node tools/mode/rhythm-listen-hands-scan.js                 全曲・全難易度(試し用の曲は除く)。取り逃しが1つでもあれば終了コード1
//   node tools/mode/rhythm-listen-hands-scan.js --song mf_ichika_mix --diff HELL --list
//   --old-shape   直す前の渡し方(読み取り口の控えの形)で回す。検査が取り逃しを見つけられることの確かめ用
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, fb = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : fb; };
const SONG = arg('song'), DIFF = arg('diff'), LIST = argv.includes('--list'), OLD = argv.includes('--old-shape');
const W = 844, H = 390;   // 横持ちのスマホの演奏の器(rhythm-listen-play-check.js と同じ)

const mode = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const hands = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-preview-hands.jsx'), 'utf8');
// 仮の窓・時計。setTimeout と requestAnimationFrame は仮の時計(曲の時刻)で回す
const ctx = { console, Math, JSON, Number, Array, Object, Map, Set, String, Boolean, Infinity, NaN, isFinite, Error };
ctx.performance = { now: () => ctx.__clock };
ctx.__clock = 0; ctx.__timers = []; ctx.__rafs = []; ctx.__sent = [];
ctx.setTimeout = (fn, ms) => { const id = ctx.__timers.length + 1; ctx.__timers.push({ id, at: ctx.__clock + Math.max(0, Number(ms) || 0), fn, live: true }); return id; };
ctx.clearTimeout = (id) => { const t = ctx.__timers[id - 1]; if (t) t.live = false; };
ctx.requestAnimationFrame = (fn) => { ctx.__rafs.push(fn); return ctx.__rafs.length; };
ctx.cancelAnimationFrame = () => { ctx.__rafs = []; };
ctx.PointerEvent = function (type, o) { this.type = type; Object.assign(this, o); };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(`${mode}\n${hands}\nthis.G={rhythmPreviewHandsStart,rhythmMatchInputBatch,rhythmFlickMatches,rhythmNoteIsSlide,rhythmSlidePoints,rhythmChartHasSky,
  RHYTHM_SKY_INPUT,RHYTHM_SKY_LIFT,RHYTHM_JUDGMENT_LINE_Y,RHYTHM_GESTURE_RUNTIME,RHYTHM_VIEW_ROTATION,RHYTHM_NOTE_TYPES,RHYTHM_SONGS,
  RHYTHM_HELL_CHARTS:typeof RHYTHM_HELL_CHARTS!=='undefined'?RHYTHM_HELL_CHARTS:null,RHYTHM_FLICK_MAX_MS,RHYTHM_FLICK_DISTANCE_PX,RHYTHM_END_FLICK_ARM_MS,
  rhythmLaneAtPoint,rhythmSubLaneCoordinateAtPoint,rhythmSubLaneCoordinateAtLineIfBelow,rhythmNoteWantsEndFlick};`, ctx);
const G = ctx.G;
const rect = { left: 0, top: 0, width: W, height: H, right: W, bottom: H };
// 回していない器(画面の座標 = 器の座標)
try { G.RHYTHM_VIEW_ROTATION.rectOf = el => el.getBoundingClientRect(); G.RHYTHM_VIEW_ROTATION.unpoint = (x, y) => ({ clientX: x, clientY: y }); } catch (_) {}
if (G.RHYTHM_SKY_LIFT.set) G.RHYTHM_SKY_LIFT.set(true);

const TEST_SONG = /(_test$|^width_test$|^wide_width_test$|_candidate|_debug)/;
const charts = [];
for (const s of G.RHYTHM_SONGS || []) {
  if (SONG ? s.songId !== SONG : TEST_SONG.test(s.songId)) continue;
  const diffs = { ...(s.difficulties || {}) };
  if (G.RHYTHM_HELL_CHARTS && G.RHYTHM_HELL_CHARTS[s.songId] && !diffs.HELL) diffs.HELL = G.RHYTHM_HELL_CHARTS[s.songId];
  for (const [d, c] of Object.entries(diffs)) if ((!DIFF || d === DIFF) && c && Array.isArray(c.notes) && c.notes.length) charts.push({ songId: s.songId, diff: d, notes: c.notes });
}
if (!charts.length) { console.error('譜面が見つからない'); process.exit(2); }

// 直す前の渡し方: 読み取り口 rhythmNotes の控えと同じ項目だけ(30-rhythm-play.jsx の rhythmNotes)
const oldShape = n => ({ type: n.type, timeMs: n.timeMs, skyHeight: G.rhythmNoteSkyHeight ? undefined : undefined, endTimeMs: n.endTimeMs, lane: n.lane, subLane: n.subLane, subLaneWidth: n.subLaneWidth,
  slidePoints: Array.isArray(n.slidePoints) ? n.slidePoints.map(p => ({ timeMs: p.timeMs, lane: p.lane })) : null, ...(Number(n.skyHeight) > 0 ? { skyHeight: n.skyHeight } : {}) });

const runHands = (notes) => {
  ctx.__clock = -3000; ctx.__timers = []; ctx.__rafs = []; ctx.__sent = [];
  const area = { getBoundingClientRect: () => rect, dispatchEvent: e => { ctx.__sent.push({ type: e.type, id: e.pointerId, x: e.clientX, y: e.clientY, t: ctx.__clock }); return true; } };
  ctx.__mhTestHooks = { rhythmSongMs: () => ctx.__clock, rhythmNotes: () => notes.map(oldShape) };
  const stop = G.rhythmPreviewHandsStart(area, OLD ? null : { notes });
  const last = notes.reduce((m, n) => Math.max(m, Number(n.endTimeMs) || 0, Number(n.timeMs) || 0), 0) + 1500;
  // 1コマ 16ms。コマの間の時刻に来る setTimeout は、その時刻へ時計を合わせて走らせる(本物の setTimeout と同じく、合図は予定の時刻に出る)
  for (let frame = -3000; frame <= last; frame += 16) {
    for (;;) { const due = ctx.__timers.filter(t => t.live && t.at < frame).sort((a, b) => a.at - b.at || a.id - b.id)[0]; if (!due) break; due.live = false; ctx.__clock = due.at; due.fn(); }
    ctx.__clock = frame; const rafs = ctx.__rafs; ctx.__rafs = []; rafs.forEach(fn => fn());
  }
  stop();
  return ctx.__sent;
};

const isLong = n => (n.type === 'HOLD' || n.type === 'SLIDE') && Number(n.endTimeMs) > Number(n.timeMs);
const inputAt = (p, sky) => ({ lane: G.rhythmLaneAtPoint(p.x, p.y, rect), subLaneCoordinate: G.rhythmSubLaneCoordinateAtPoint(p.x, p.y, rect),
  subLaneCoordinateAtLine: G.rhythmSubLaneCoordinateAtLineIfBelow(p.x, p.y, rect), sky: sky ? (p.y - rect.top) / rect.height : null });

const checkChart = (c) => {
  const sorted = c.notes.map((n, index) => ({ n, index })).filter(x => G.RHYTHM_NOTE_TYPES.includes(x.n.type) && Number.isFinite(Number(x.n.timeMs)))
    .sort((a, b) => a.n.timeMs - b.n.timeMs);
  const sent = runHands(sorted.map(x => x.n));
  const byId = new Map(); for (const e of sent) { if (!byId.has(e.id)) byId.set(e.id, []); byId.get(e.id).push(e); }
  const sky = !!G.rhythmChartHasSky(c.notes); G.RHYTHM_SKY_INPUT.active = sky;
  // 判定の関数へ渡すノーツ(演奏画面の makeRuntimeNotes と同じ形の最小限)
  const rt = c.notes.map((n, index) => ({ ...n, index, done: false, activePointerId: null, holdJudgment: null, holdDeltaMs: 0, ...(n.type === 'SLIDE' ? { _rhythmSlideRenderPoints: G.rhythmSlidePoints(n) } : {}) }));
  const snap = rt.map(x => ({ ...x }));
  const endOf = n => Number.isFinite(Number(n.endTimeMs)) ? Number(n.endTimeMs) : Number(n.timeMs);
  const fails = [];
  // 押した順(同じ時刻は手が押した順)に、その時に残っているノーツで照らす
  const downs = sent.filter(e => e.type === 'pointerdown');
  const ownerOf = new Map(); sorted.forEach((x, k) => ownerOf.set(901 + k, x));   // 手は並べた順に 901 から番号を振る
  const claimedAt = new Map();   // ノーツ番号 → 取った押しの時刻
  for (const d of downs) {
    const own = ownerOf.get(d.id); if (!own) continue;
    const t = d.t;
    rt.forEach((x, i) => { Object.assign(x, snap[i]); const st = Number(x.timeMs), during = isLong(x) && st < t - 30 && endOf(x) > t;
      const took = claimedAt.has(i) && claimedAt.get(i) <= t;
      x.done = (took && !(isLong(x) && endOf(x) > t)) || (st < t - 200 && !during);
      x.activePointerId = took && isLong(x) && endOf(x) > t ? 'held:' + i : null; });
    let r = null; try { r = G.rhythmMatchInputBatch(rt, [{ inputKey: 'pointer:' + d.id, ...inputAt(d, sky) }], t, 0)[0]; } catch (e) { r = null; }
    G.RHYTHM_GESTURE_RUNTIME.clear && G.RHYTHM_GESTURE_RUNTIME.clear();
    const got = r && r.target ? r.target.index : null;
    if (got === own.index) claimedAt.set(own.index, t);
    else fails.push({ index: own.index, what: got == null ? '押した位置でどのノーツも取れない' : `押した指が別のノーツ(#${got})を取る` });
  }
  for (const [k, { n, index }] of sorted.entries()) {
    const ev = byId.get(901 + k) || [];
    const down = ev.find(e => e.type === 'pointerdown'), up = ev.find(e => e.type === 'pointerup');
    const t = Number(n.timeMs);
    if (!down) { fails.push({ index, what: '押していない' }); continue; }
    if (Math.abs(down.t - t) > 20) { fails.push({ index, what: `押す時刻が ${Math.round(down.t - t)}ms ずれる` }); continue; }
    if (n.type === 'FLICK' && !isLong(n)) {
      const ok = ev.some(e => e.type !== 'pointerdown' && e.t - down.t <= G.RHYTHM_FLICK_MAX_MS && G.rhythmFlickMatches(n, e.x - down.x, e.y - down.y));
      if (!ok) fails.push({ index, what: `払いが成り立たない(向き ${n.flickDir || '自由'})` });
    } else if (isLong(n)) {
      const e = Number(n.endTimeMs);
      if (!up || Math.abs(up.t - e) > 40) fails.push({ index, what: `終わりで離さない(${up ? Math.round(up.t - e) + 'ms' : '離しなし'})` });
      if (G.rhythmNoteWantsEndFlick(n)) {
        const armAt = e - G.RHYTHM_END_FLICK_ARM_MS, moves = ev.filter(x => x.t >= armAt && x.t <= e + 20);
        const base = ev.filter(x => x.t <= armAt).pop() || moves[0];
        const ok = !!base && moves.some(x => Math.hypot(x.x - base.x, x.y - base.y) >= G.RHYTHM_FLICK_DISTANCE_PX);
        if (!ok) fails.push({ index, what: '終点フリックを払わない' });
      }
    }
  }
  G.RHYTHM_SKY_INPUT.active = false;
  return fails;
};

const kindOf = n => { const sk = (G.rhythmNoteIsSlide(n) ? (Array.isArray(n.slidePoints) && n.slidePoints.some(p => Number(p.sky) > 0)) : Number(n.skyHeight) > 0) ? '空中' : '';
  return `${sk}${n.type}${n.flickDir ? '(' + n.flickDir + ')' : ''}${n.endFlick ? '(終点フリック)' : ''}`; };
let total = 0, badCharts = 0; const kinds = {};
// フリックの種類ごとの、取れた数 / 全数(2026-11-23 社長「鑑賞で横フリックも押せてないね」)
const flickKind = n => { const sky = Number(n.skyHeight) > 0 ? '空中の' : '';
  if (n.type === 'FLICK') return `${sky}${n.flickDir === 'left' ? '左フリック' : n.flickDir === 'right' ? '右フリック' : '上フリック(向き自由)'}`;
  if ((n.type === 'HOLD' || n.type === 'SLIDE') && G.rhythmNoteWantsEndFlick(n)) return '終点フリック';
  return null; };
const flickAll = {}, flickMiss = {};
const t0 = Date.now();
for (const c of charts) {
  const fails = checkChart(c);
  for (const n of c.notes) { const k = flickKind(n); if (k) flickAll[k] = (flickAll[k] || 0) + 1; }
  for (const i of new Set(fails.map(f => f.index))) { const k = flickKind(c.notes[i]); if (k) flickMiss[k] = (flickMiss[k] || 0) + 1; }
  if (!fails.length) continue;
  badCharts++; total += fails.length;
  const ks = {}; for (const f of fails) { const k = kindOf(c.notes[f.index]); ks[k] = (ks[k] || 0) + 1; kinds[k] = (kinds[k] || 0) + 1; }
  console.log(`✗ ${c.songId} ${c.diff}: 取り逃し ${fails.length} (${Object.entries(ks).map(([k, v]) => `${k} ${v}`).join(' / ')})`);
  if (LIST) for (const f of fails) console.log(`    ${(c.notes[f.index].timeMs / 1000).toFixed(2)}秒 #${f.index} ${kindOf(c.notes[f.index])}: ${f.what}`);
}
console.log(`${total ? '✗' : '✓'} 曲鑑賞の自動の手: ${charts.length} 譜面を確かめた / 取り逃しのある譜面 ${badCharts} / 取り逃し ${total}${total ? ` (${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' / ')})` : ''} / ${((Date.now() - t0) / 1000).toFixed(0)}秒${OLD ? ' 〔直す前の渡し方〕' : ''}`);
console.log(`  フリックの種類ごと(取れた数 / 全数): ${Object.keys(flickAll).sort().map(k => `${k} ${flickAll[k] - (flickMiss[k] || 0)}/${flickAll[k]}`).join(' ・ ')}`);
process.exitCode = total ? 1 : 0;
