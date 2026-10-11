#!/usr/bin/env node
// rhythm-tap-position-bot.js の書き出し(JSON)をまとめる。描かれたノーツの「真ん中」「左右の端の 10% 内側」を押したとき、
// 判定の関数 rhythmMatchInputBatch がそのノーツを相手に選ぶかを、rhythm-note-reach-scan.js と同じ状態の作り方で見る
// (前のノーツは取り終え・続いている HOLD/SLIDE は別の指が押さえ・同じ時刻の和音はまだ)。
//
//   node tools/playbot/rhythm-tap-position-report.js <JSONのあるフォルダ> [--md 表.md] [--json まとめ.json]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const DIR = argv.find(a => !a.startsWith('--') && fs.existsSync(a) && fs.statSync(a).isDirectory());
if (!DIR) { console.error('JSON のフォルダを渡す'); process.exit(2); }

const ctx = { console, performance: { now: () => 0 } };
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8')}
this.G={RHYTHM_SONGS,proto:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[],RHYTHM_SUB_LANE_COUNT,RHYTHM_LANE_COUNT,RHYTHM_NOTE_TYPES,rhythmMatchInputBatch,rhythmNoteIsSlide,rhythmSlidePoints,
  rhythmChartHasSky,rhythmNoteSkyHeight,rhythmSkyLineRatio,RHYTHM_SKY_INPUT,RHYTHM_SKY_LIFT,RHYTHM_JUDGMENT_LINE_Y,rhythmSlideSkyAt,rhythmSlideHasSky};`, ctx);
const G = ctx.G, S = G.RHYTHM_SUB_LANE_COUNT, L = G.RHYTHM_LANE_COUNT;
G.RHYTHM_SKY_LIFT.set && G.RHYTHM_SKY_LIFT.set(true);
const endOf = (n) => Number.isFinite(Number(n.endTimeMs)) ? Number(n.endTimeMs) : Number(n.timeMs);
const laneOf = (c) => Math.max(0, Math.min(L - 1, Math.floor(c / (S / L))));
const isSkyNote = (n) => G.rhythmNoteIsSlide(n) ? (G.rhythmSlideHasSky(n) && G.rhythmSlideSkyAt(n, Number(n.timeMs) || 0) >= .5) : G.rhythmNoteSkyHeight(n) > 0;

const runs = [], issues = [];
for (const f of fs.readdirSync(DIR).filter(x => x.endsWith('.json')).sort()) {
  let d; try { d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { continue; }
  if (!d || !Array.isArray(d.rows)) continue;
  const song = [...G.RHYTHM_SONGS, ...G.proto].find(s => s.songId === d.song), chart = song && song.difficulties[d.diff];
  if (!chart) continue;
  const sky = G.rhythmChartHasSky(chart.notes); G.RHYTHM_SKY_INPUT.active = !!sky;
  const groundRatio = G.RHYTHM_JUDGMENT_LINE_Y.ratio, skyRatio = sky ? G.rhythmSkyLineRatio() : groundRatio;
  const notes = chart.notes.map((n, index) => ({ ...n, index, done: false, activePointerId: null, ...(n.type === 'SLIDE' ? { _rhythmSlideRenderPoints: G.rhythmSlidePoints(n) } : {}) }));
  const screen = `${d.w}x${d.h}${d.safe ? ' セーフ' + d.safe : ''} 道${d.road} ${d.draw}`;
  const run = { file: f, song: d.song, diff: d.diff, screen, notes: d.rows.length, drawnMissing: 0, judg: {}, center: 0, edge: 0, errors: d.errors || [] };
  for (const row of d.rows) {
    run.judg[row.judgment || '-'] = (run.judg[row.judgment || '-'] || 0) + 1;
    const n = notes[row.index];
    if (!n || !G.RHYTHM_NOTE_TYPES.includes(n.type)) continue;
    if (!row.drawn) { run.drawnMissing++; continue; }
    const t = Number(n.timeMs);
    for (const x of notes) { const long = x.type === 'HOLD' || G.rhythmNoteIsSlide(x); x.done = x.timeMs < t && !(long && endOf(x) > t); x.activePointerId = long && x.timeMs < t && endOf(x) > t ? 'held:' + x.index : null; }
    const ratio = isSkyNote(n) ? skyRatio : groundRatio;
    const hit = (c) => { if (!Number.isFinite(c)) return false; const r = G.rhythmMatchInputBatch(notes, [{ inputKey: 'touch:pos', lane: laneOf(c), subLaneCoordinate: c, subLaneCoordinateAtLine: null, sky: sky ? ratio : null }], t, 0)[0]; return !!r && r.target === n; };
    const { subL, subC, subR, w } = row.drawn;
    const pxPerSub = Number.isFinite(subR - subL) && subR !== subL ? (w * .8) / (subR - subL) : null;
    const okC = hit(subC), okL = hit(subL), okR = hit(subR);
    // 外れたとき、いちばん近い「取れる座標」までの距離(サブレーン)。0.01刻みで内側へ探す
    const gap = (from, toward) => { for (let k = 0; k <= 600; k++) { const c = from + Math.sign(toward - from) * k * .01; if (hit(c)) return k * .01; if (Math.abs(c - toward) < .01) break; } return null; };
    const base = { song: d.song, diff: d.diff, screen, sec: +(t / 1000).toFixed(2), type: row.type, sky: !!row.sky, judgment: row.judgment, drawnSub: [subL, subC, subR].map(v => v == null ? null : +v.toFixed(2)), w: row.drawn.w };
    if (!okC) { run.center++; issues.push({ ...base, kind: '真ん中で取れない', off: gap(subC, (subL + subR) / 2) }); }
    else if (!okL || !okR) { run.edge++; const side = !okL && !okR ? '左右' : !okL ? '左' : '右'; const off = !okL ? gap(subL, subC) : gap(subR, subC);
      issues.push({ ...base, kind: `端の内側で取れない(${side})`, off, offPx: off != null && pxPerSub ? +(off * pxPerSub).toFixed(1) : null }); }
  }
  G.RHYTHM_SKY_INPUT.active = false;
  runs.push(run);
}

// 型でまとめる: 種類・空中・取れない側
const byKind = {};
for (const x of issues) { const k = `${x.kind} / ${x.type}${x.sky ? '(空中)' : ''}`; (byKind[k] = byKind[k] || []).push(x); }
const lines = [];
lines.push(`# タップ位置の確かめ(描いた位置と受け付けの位置)`, '', `譜面×画面 ${runs.length} 本 / ノーツ ${runs.reduce((a, r) => a + r.notes, 0)}`, '');
lines.push('| 譜面 | 画面 | ノーツ | 判定(ボットが描いた真ん中を叩いた結果) | 描いた位置が取れない | 真ん中で取れない | 端の内側で取れない |', '| --- | --- | --- | --- | --- | --- | --- |');
for (const r of runs) lines.push(`| ${r.song} ${r.diff} | ${r.screen} | ${r.notes} | ${Object.entries(r.judg).map(([k, v]) => k + ' ' + v).join(' / ')} | ${r.drawnMissing} | ${r.center} | ${r.edge} |`);
lines.push('', '## 型ごと', '');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${k}: ${v.length}`);
  v.slice(0, 40).forEach(x => lines.push(`- ${x.song} ${x.diff} ${x.sec}秒 ${x.screen} 描いた位置(サブレーン 左端内・真ん中・右端内) ${x.drawnSub.join(' / ')} ・取れる所まで ${x.off ?? '-'} サブレーン${x.offPx != null ? `(約${x.offPx}px)` : ''} ・判定 ${x.judgment}`));
  if (v.length > 40) lines.push(`- ほか ${v.length - 40}`);
  lines.push('');
}
const md = lines.join('\n');
if (arg('md')) fs.writeFileSync(arg('md'), md);
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ runs, issues }));
console.log(md.split('\n').slice(0, 60).join('\n'));
