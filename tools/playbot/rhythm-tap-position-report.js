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
this.G={RHYTHM_SONGS,proto:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[],RHYTHM_SUB_LANE_COUNT,RHYTHM_LANE_COUNT,RHYTHM_NOTE_TYPES,rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,rhythmNoteIsSlide,rhythmSlidePoints,
  rhythmChartHasSky,rhythmNoteSkyHeight,rhythmSkyLineRatio,RHYTHM_SKY_INPUT,RHYTHM_SKY_LIFT,RHYTHM_JUDGMENT_LINE_Y,rhythmSlideSkyAt,rhythmSlideHasSky};`, ctx);
const G = ctx.G, S = G.RHYTHM_SUB_LANE_COUNT, L = G.RHYTHM_LANE_COUNT;
// ★判定の関数 rhythmMatchInputBatch は、取れた HOLD/FLICK/SLIDE を指の動きを待つ形へ書き換える(type を HOLD に・FLICK は終わりを60秒先へ)
//   うえに、指の受け付け(RHYTHM_GESTURE_RUNTIME)へ記録を残す。演奏では1回しか当たらないが、ここでは同じノーツへ何度も当てるので、
//   当てるたびに元の形へ戻す(戻さないと、FLICK が60秒の帯に化けて、あとのノーツが「帯の上の持ち替え待ち」に吸われる)
const pureMatch = (notes, inputs, t) => {
  const res = G.rhythmMatchInputBatch(notes, inputs, t, 0);
  for (const r of res) { const n = r && r.target; if (!n || !n.__snap) continue; for (const k of Object.keys(n)) if (!(k in n.__snap) && k !== '__snap') delete n[k]; for (const [k, v] of Object.entries(n.__snap)) if (k !== 'done' && k !== 'activePointerId') n[k] = v; }
  G.RHYTHM_GESTURE_RUNTIME.clear();
  return res;
};

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
  for (const x of notes) x.__snap = Object.fromEntries(Object.entries(x));
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
    const hit = (c, altC = null) => { if (!Number.isFinite(c)) return false; const r = pureMatch(notes, [{ inputKey: 'touch:pos', lane: laneOf(c), subLaneCoordinate: c, subLaneCoordinateAtLine: altC, sky: sky ? ratio : null }], t)[0]; return !!r && r.target === n; };
    const { subL, subC, subR, w } = row.drawn;
    const pxPerSub = Number.isFinite(subR - subL) && subR !== subL ? (w * .8) / (subR - subL) : null;
    const okC = hit(subC), okL = hit(subL), okR = hit(subR);
    // 外れたとき、いちばん近い「取れる座標」までの距離(サブレーン)。0.01刻みで内側へ探す
    const gap = (from, toward) => { for (let k = 0; k <= 600; k++) { const c = from + Math.sign(toward - from) * k * .01; if (hit(c)) return k * .01; if (Math.abs(c - toward) < .01) break; } return null; };
    const base = { song: d.song, diff: d.diff, screen, sec: +(t / 1000).toFixed(2), type: row.type, sky: !!row.sky, judgment: row.judgment, drawnSub: [subL, subC, subR].map(v => v == null ? null : +v.toFixed(2)), w: row.drawn.w };
    if (!okC) { run.center++; issues.push({ ...base, kind: '真ん中で取れない', off: gap(subC, (subL + subR) / 2) }); }
    else if (!okL || !okR) { run.edge++; const side = !okL && !okR ? '左右' : !okL ? '左' : '右'; const off = !okL ? gap(subL, subC) : gap(subR, subC);
      issues.push({ ...base, kind: `端の内側で取れない(${side})`, off, offPx: off != null && pxPerSub ? +(off * pxPerSub).toFixed(1) : null }); }
    // 線の 20px 上・下を押したとき(横は描いた位置のまま)。空中のノーツは空中の線の高さで押すので見ない
    if (!row.sky && Array.isArray(row.drawn.up)) {
      const names = ['左端内', '真ん中', '右端内'];
      const upBad = row.drawn.up.map((c, k) => hit(c) ? null : names[k]).filter(Boolean);
      const downBad = row.drawn.down.map((c, k) => hit(c, row.drawn.downAlt[k]) ? null : names[k]).filter(Boolean);
      if (upBad.length) { run.up = (run.up || 0) + 1; issues.push({ ...base, kind: `線の20px上で取れない(${upBad.join('・')})`, upSub: row.drawn.up.map(v => v == null ? null : +v.toFixed(2)) }); }
      if (downBad.length) { run.down = (run.down || 0) + 1; issues.push({ ...base, kind: `線の20px下で取れない(${downBad.join('・')})`, downSub: row.drawn.down.map(v => v == null ? null : +v.toFixed(2)) }); }
    }
  }
  G.RHYTHM_SKY_INPUT.active = false;
  runs.push(run);
}

// 型でまとめる: 種類・空中・取れない側
const byKind = {};
for (const x of issues) { const k = `${x.kind} / ${x.type}${x.sky ? '(空中)' : ''}`; (byKind[k] = byKind[k] || []).push(x); }
const lines = [];
lines.push(`# タップ位置の確かめ(描いた位置と受け付けの位置)`, '', `譜面×画面 ${runs.length} 本 / ノーツ ${runs.reduce((a, r) => a + r.notes, 0)}`, '');
lines.push('| 譜面 | 画面 | ノーツ | 判定(ボットが描いた真ん中を叩いた結果) | 描いた位置が取れない | 真ん中で取れない | 端の内側で取れない | 線の20px上 | 線の20px下 |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of runs) lines.push(`| ${r.song} ${r.diff} | ${r.screen} | ${r.notes} | ${Object.entries(r.judg).map(([k, v]) => k + ' ' + v).join(' / ')} | ${r.drawnMissing} | ${r.center} | ${r.edge} | ${r.up || 0} | ${r.down || 0} |`);
lines.push('', '## 型ごと', '');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`### ${k}: ${v.length}`);
  v.slice(0, 40).forEach(x => lines.push(`- ${x.song} ${x.diff} ${x.sec}秒 ${x.screen} 描いた位置(サブレーン 左端内・真ん中・右端内) ${x.drawnSub.join(' / ')} ・取れる所まで ${x.off ?? '-'} サブレーン${x.offPx != null ? `(約${x.offPx}px)` : ''} ・判定 ${x.judgment}${x.upSub ? ' ・上で押した位置 ' + x.upSub.join(' / ') : ''}${x.downSub ? ' ・下で押した位置 ' + x.downSub.join(' / ') : ''}`));
  if (v.length > 40) lines.push(`- ほか ${v.length - 40}`);
  lines.push('');
}
const md = lines.join('\n');
if (arg('md')) fs.writeFileSync(arg('md'), md);
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify({ runs, issues }));
console.log(md.split('\n').slice(0, 60).join('\n'));
