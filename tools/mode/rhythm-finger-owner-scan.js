#!/usr/bin/env node
// 全曲・全難易度(HELL も)から「指の持ち主が絡む形」を抜き出す(2026-10-15 社長「ちゃんと押しているのに判定が機能しないのは致命的。
// 曲ごとに潰すのではなく全曲・全難易度を機械で洗い出して」)。
//
// 【なぜ】押さえている指(ホールド・スライド)と、叩く/払う別の指の判定が混ざって MISS になる不具合が、
// Sheriruth HELL(空中スライド中の地上タップ)と Crazy Party Night フル MASTER(スライドの終わりのフリック)で見つかった。
// 同じ形がほかの曲にもあるはずなので、譜面を読むだけで(ブラウザなしで)形を全部数える。
// ここで出た形は、自動演奏 tools/playbot/rhythm-ideal-hands.js が MISS・BAD を形ごとに分けるのにも使う(require して scanChart を呼ぶ)。
//
// 【見る形】(位置はレーンの境目の座標: 0〜6。サブレーンの半分=0.5 が「半レーン」)
//   押さえ中   … ホールド・地上スライド・空中スライドを押さえている間に、別のノーツが来る。
//                 位置の関係: 同じ位置(中心の差 0.25 未満)/半レーンずれ(幅が重なるがずれている)/
//                 交差(前後150msのうちに帯がノーツの中心をまたぐ)/隣(重ならないが隙間 0.5 レーン以内)
//   上下クロス  … 地上の帯(ホールド・地上スライド)と空中の帯(空中スライド)が、同じ時刻に同じ横の位置で交わる
//   地上同士の交差 … 地上の帯どうしが同じ横の位置で交わる(参考)
//   終わり横   … ロングの終わり(±60ms)に、すぐ横(隙間 1 レーン以内)・同じ時刻のフリックやタップがある
//   同時半レーンずれ … 同じ時刻の2ノーツが、幅は重なるのに中心がずれている
//
// 使い方:
//   node tools/mode/rhythm-finger-owner-scan.js                          全曲の件数のまとめ
//   node tools/mode/rhythm-finger-owner-scan.js --song sheriruth --diff HELL --list   1件ずつ
//   node tools/mode/rhythm-finger-owner-scan.js --json <ファイル>         1件ずつの一覧を JSON で書き出す
//   --root <フォルダ>  別の作業場所(git worktree)の譜面を読む / --top 5  曲・難易度ごとの上位の数 / --tests  試し用の曲も数える
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GLOBALS = ['RHYTHM_SONGS', 'RHYTHM_HELL_CHARTS', 'RHYTHM_NOTE_TYPES', 'RHYTHM_LANE_COUNT', 'RHYTHM_SUB_LANE_COUNT', 'rhythmNoteIsSlide', 'rhythmNoteSkyHeight',
  'rhythmSlideHasSky', 'rhythmSlideSkyAt', 'rhythmSlideExpectedLane', 'rhythmSlideWidthAt', 'rhythmHoldSpanAt', 'rhythmNoteHasHoldPoints', 'rhythmFlickDir'];
const loadGame = (root) => {
  const source = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-mode.js'), 'utf8');
  const ctx = { console, performance: { now: () => 0 } };
  vm.runInNewContext(`${source}\nthis.out={${GLOBALS.map(k => `${k}:typeof ${k}!=='undefined'?${k}:null`).join(',')}};`, ctx);
  return ctx.out;
};
// 試し用の曲(公開していない並べ方の確かめ用)は既定で数えない
const TEST_SONG = /(_test$|^width_test$|^wide_width_test$|_candidate|_debug)/;
const chartsOf = (G, { song = null, diff = null, tests = false } = {}) => {
  const out = [];
  for (const s of G.RHYTHM_SONGS || []) {
    if (song && s.songId !== song) continue;
    if (!tests && !song && TEST_SONG.test(s.songId)) continue;
    const diffs = { ...(s.difficulties || {}) };
    if (G.RHYTHM_HELL_CHARTS && G.RHYTHM_HELL_CHARTS[s.songId] && !diffs.HELL) diffs.HELL = G.RHYTHM_HELL_CHARTS[s.songId];
    for (const [d, c] of Object.entries(diffs)) {
      if (diff && d !== diff) continue;
      if (c && Array.isArray(c.notes) && c.notes.length) out.push({ songId: s.songId, diff: d, notes: c.notes });
    }
  }
  return out;
};

const isLong = (n) => n && (n.type === 'HOLD' || n.type === 'SLIDE') && Number(n.endTimeMs) > Number(n.timeMs);
// その時刻のノーツの位置(レーンの境目の座標の中心・半分の幅・空中の高さ)
const spanAt = (G, n, t) => {
  if (G.rhythmNoteIsSlide(n)) {
    const sky = G.rhythmSlideHasSky(n) ? G.rhythmSlideSkyAt(n, t) : 0;
    return { c: G.rhythmSlideExpectedLane(n, t) + .5, h: G.rhythmSlideWidthAt(n, t) / 4, sky };
  }
  const sky = G.rhythmNoteSkyHeight(n);
  if (n.subLane != null && Number.isFinite(Number(n.subLane))) {
    const sp = G.rhythmNoteHasHoldPoints(n) ? G.rhythmHoldSpanAt(n, t) : { subLane: Number(n.subLane), subLaneWidth: Number(n.subLaneWidth) || 2 };
    return { c: (sp.subLane + sp.subLaneWidth / 2) / 2, h: sp.subLaneWidth / 4, sky };
  }
  return { c: (Number(n.lane) || 0) + .5, h: .5, sky };
};
const heldKind = (G, n, t) => n.type === 'HOLD' ? 'ホールド' : (spanAt(G, n, t).sky >= .5 ? '空中スライド' : '地上スライド');
const noteKind = (G, n) => {
  const t = Number(n.timeMs), sky = spanAt(G, n, t).sky >= .5 ? '空中' : '地上';
  const ty = n.type === 'FLICK' ? (G.rhythmFlickDir && G.rhythmFlickDir(n) ? '横FLICK' : 'FLICK') : n.type;
  return sky + ty;
};
const relOf = (a, b) => {   // a, b: spanAt の結果
  const d = Math.abs(a.c - b.c), gap = d - a.h - b.h;
  if (d < .25) return '同じ位置';
  if (gap < -1e-6) return '半レーンずれ';
  if (gap <= .5 + 1e-6) return '隣';
  return null;
};

// 1つの譜面の形をすべて返す。notes は譜面の並び(演奏のノーツの index と同じ)
const scanChart = (G, notes, meta = {}) => {
  const recs = [];
  const add = (kind, base, t, idx, detail) => recs.push({ ...meta, sec: +(t / 1000).toFixed(3), timeMs: Math.round(t), base, kind, notes: idx, detail });
  const list = notes.map((n, i) => ({ n, i, t: Number(n.timeMs) })).filter(x => (G.RHYTHM_NOTE_TYPES || ['TAP', 'HOLD', 'FLICK', 'SLIDE']).includes(x.n.type));
  const sorted = [...list].sort((a, b) => a.t - b.t);
  const firstAtOrAfter = (t) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m].t < t) lo = m + 1; else hi = m; } return lo; };
  const longs = sorted.filter(x => isLong(x.n));
  // 押さえ中
  for (const L of longs) {
    const s = L.t, e = Number(L.n.endTimeMs);
    for (let k = firstAtOrAfter(s + 1); k < sorted.length && sorted[k].t <= e - 1; k++) {
      const X = sorted[k]; if (X.i === L.i) continue;
      const t = X.t, a = spanAt(G, L.n, t), b = spanAt(G, X.n, t);
      let rel = relOf(a, b);
      if (rel !== '同じ位置' && rel !== '半レーンずれ') {
        let sign = 0, crossed = false;
        for (let u = Math.max(s, t - 150); u <= Math.min(e, t + 150); u += 10) { const v = Math.sign(spanAt(G, L.n, u).c - b.c); if (v && sign && v !== sign) { crossed = true; break; } if (v) sign = v; }
        if (crossed) rel = '交差';
      }
      if (!rel) continue;
      add(`押さえ中:${heldKind(G, L.n, t)}×${noteKind(G, X.n)} ${rel}`, '押さえ中', t, [L.i, X.i], `帯${a.c.toFixed(2)}(高さ${a.sky.toFixed(2)}) ノーツ${b.c.toFixed(2)}(高さ${b.sky.toFixed(2)})`);
    }
  }
  // 上下クロス・地上同士の交差(時刻の重なる帯の組)
  for (let p = 0; p < longs.length; p++) {
    const A = longs[p], ae = Number(A.n.endTimeMs);
    for (let q = p + 1; q < longs.length && longs[q].t < ae; q++) {
      const B = longs[q], from = Math.max(A.t, B.t), to = Math.min(ae, Number(B.n.endTimeMs));
      if (to - from < 20) continue;
      let prev = null, inEp = false;
      for (let u = from; u <= to; u += 10) {
        const a = spanAt(G, A.n, u), b = spanAt(G, B.n, u), sa = a.sky >= .5, sb = b.sky >= .5;
        const diffH = sa !== sb, d = a.c - b.c, sg = Math.sign(d);
        const meet = Math.abs(d) < .25 || (prev != null && sg && prev && sg !== prev);
        if (sg) prev = sg;
        if (meet && !inEp && (diffH || (!sa && !sb))) {
          const g = sa ? B : A, k = sa ? heldKind(G, B.n, u) : heldKind(G, A.n, u);
          if (diffH) add(`上下クロス:${k}×空中スライド`, '上下クロス', u, [A.i, B.i], `横の位置 ${a.c.toFixed(2)} / ${b.c.toFixed(2)}`);
          else add(`地上同士の交差:${heldKind(G, A.n, u)}×${heldKind(G, B.n, u)}`, '地上同士の交差', u, [A.i, B.i], `横の位置 ${a.c.toFixed(2)} / ${b.c.toFixed(2)}`);
          void g;
        }
        inEp = meet;
      }
    }
  }
  // 終わり横
  for (const L of longs) {
    const e = Number(L.n.endTimeMs), a = spanAt(G, L.n, e), ef = L.n.endFlick === true ? '終点フリック有' : '終点フリック無';
    for (let k = firstAtOrAfter(e - 60); k < sorted.length && sorted[k].t <= e + 60; k++) {
      const X = sorted[k]; if (X.i === L.i || (X.n.type !== 'FLICK' && X.n.type !== 'TAP')) continue;
      const b = spanAt(G, X.n, X.t), d = Math.abs(a.c - b.c), gap = d - a.h - b.h;
      if (gap > 1 + 1e-6) continue;
      add(`終わり横:${heldKind(G, L.n, e)}(${ef})×${noteKind(G, X.n)} ${d < .25 ? '同じ位置' : gap < 0 ? '重なる' : 'すぐ横'}`, '終わり横', X.t, [L.i, X.i], `終わり${(e / 1000).toFixed(3)}秒 帯${a.c.toFixed(2)} ノーツ${b.c.toFixed(2)} 時刻の差${Math.round(X.t - e)}ms`);
    }
  }
  // 同時半レーンずれ
  for (let p = 0; p < sorted.length; p++) {
    for (let q = p + 1; q < sorted.length && sorted[q].t - sorted[p].t <= 2; q++) {
      const A = sorted[p], B = sorted[q], a = spanAt(G, A.n, A.t), b = spanAt(G, B.n, B.t);
      if (relOf(a, b) !== '半レーンずれ') continue;
      add(`同時半レーンずれ:${noteKind(G, A.n)}×${noteKind(G, B.n)}`, '同時半レーンずれ', A.t, [A.i, B.i], `${a.c.toFixed(2)} / ${b.c.toFixed(2)}`);
    }
  }
  return recs.sort((x, y) => x.timeMs - y.timeMs);
};
// ノーツの番号 → そのノーツが入っている形の一覧
const shapesByNote = (recs) => { const m = new Map(); for (const r of recs) for (const i of r.notes) { if (!m.has(i)) m.set(i, []); m.get(i).push(r); } return m; };

module.exports = { loadGame, chartsOf, scanChart, shapesByNote, spanAt };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const arg = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
  const flag = name => argv.includes('--' + name);
  const ROOT = path.resolve(arg('root', path.resolve(__dirname, '../..')));
  const G = loadGame(ROOT);
  const charts = chartsOf(G, { song: arg('song'), diff: arg('diff'), tests: flag('tests') });
  const TOP = Number(arg('top', 5));
  const all = [];
  for (const c of charts) all.push(...scanChart(G, c.notes, { songId: c.songId, diff: c.diff }));
  console.log(`譜面 ${charts.length} / 形 ${all.length}件`);
  const bases = [...new Set(all.map(r => r.base))];
  for (const b of bases) {
    const rs = all.filter(r => r.base === b);
    console.log(`\n■ ${b}: ${rs.length}件`);
    const byKind = new Map(); rs.forEach(r => byKind.set(r.kind, (byKind.get(r.kind) || 0) + 1));
    [...byKind].sort((x, y) => y[1] - x[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));
    const byChart = new Map(); rs.forEach(r => { const k = `${r.songId} ${r.diff}`; byChart.set(k, (byChart.get(k) || 0) + 1); });
    console.log(`  曲・難易度の上位: ${[...byChart].sort((x, y) => y[1] - x[1]).slice(0, TOP).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  }
  if (flag('list')) all.forEach(r => console.log(`${r.songId} ${r.diff} ${r.sec.toFixed(2)}秒 ${r.kind} [${r.notes.join(',')}] ${r.detail}`));
  const out = arg('json');
  if (out) { fs.writeFileSync(out, JSON.stringify({ summary: Object.fromEntries(bases.map(b => [b, all.filter(r => r.base === b).length])), records: all }, null, 0)); console.log(`\n書き出した: ${out}(${all.length}件)`); }
}
