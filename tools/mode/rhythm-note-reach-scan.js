#!/usr/bin/env node
// 全曲・全難易度の全ノーツについて、「どこを押せばそのノーツが取れるか」をゲームの判定の関数そのもので測る。
//
// 【なぜ】2026-10-11、社長が本番で遊んで「Grievous Lady マスターで32秒位の左のスライドが反応しない」。
// 始まりのレーンが 0.75 のスライドで、押し始めの受け付け幅が出ず、どこを押しても取れなかった(#2780・#2782)。
// 見た目はふつうに出るので、遊ぶまで気づけない。同じ型・ほかの型が無いかを、機械で全部見る。
//
// 【やり方】ブラウザは使わない。data/rhythm-mode.js を読み込み、演奏画面と同じ形の演奏用ノーツ
// (makeRuntimeNotes と同じ: done:false・activePointerId:null を足す)を作って、入力とノーツの突き合わせ
// rhythmMatchInputBatch をそのまま呼ぶ。各ノーツの時刻ちょうどに、
//   ・それより前のノーツは取り終えている(上手に遊んでいる)
//   ・その時刻に続いている HOLD/SLIDE は別の指が押さえている(持ち替えの扱いも本物どおり効く)
//   ・同じ時刻の和音の相手はまだ取っていない
// という状態を作り、指1本を判定ラインの高さ(空中のノーツは空中の線の高さ)で左右へ 0.05 サブレーンずつずらして置く。
// そのノーツが相手に選ばれた位置の範囲が「取れる幅」。
//
// 【見る型】
//   取れない     … どこを押しても取れない(0.25刻みの始まりのスライドなど)
//   真ん中で取れない … 見た目の真ん中を押すと、ほかのノーツへ行く/どこへも行かない
//   和音で取れない … 同じ時刻のノーツを、全部の真ん中を同時に押したとき、どれかが取れない
//   幅が狭い     … 取れる幅が見た目の幅の半分未満(報告だけ。--check でも落とさない)
//
//   node tools/mode/rhythm-note-reach-scan.js                 全曲の結果を数える
//   node tools/mode/rhythm-note-reach-scan.js --song grievous_lady --diff MASTER --list
//   node tools/mode/rhythm-note-reach-scan.js --json out.json  ノーツごとの「見た目の幅」と「取れる幅」を書き出す
//                                                              (見えている位置と受け付けの位置のずれを画面で確かめるときの元)
//   node tools/mode/rhythm-note-reach-scan.js --fast --check  速い形(真ん中と和音だけ・1分ほど)。どこを押しても取れないノーツは真ん中でも取れないので、ここで見つかる
//   node tools/mode/rhythm-note-reach-scan.js --check         取れない・真ん中で取れない・和音で取れない が1つでもあれば落ちる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
const flag = name => argv.includes('--' + name);
const FAST = flag('fast');   // 速い形: 左右へずらして幅を測るのをやめ、見た目の真ん中と和音だけを見る(検査 rhythm-note-reach-check.js が使う)
const ONLY_SONG = arg('song'), ONLY_DIFF = arg('diff'), JSON_OUT = arg('json'), LIST = flag('list'), CHECK = flag('check');
const STEP = Number(arg('step', 0.05));

const source = fs.readFileSync(arg('data') || path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');   // --data <ファイル>: 前の版の譜面で比べるとき
const ctx = { console, performance: { now: () => 0 } };
vm.runInNewContext(`${source}
this.out={RHYTHM_SONGS,proto:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[],RHYTHM_SUB_LANE_COUNT,RHYTHM_LANE_COUNT,RHYTHM_NOTE_TYPES,
  rhythmMatchInputBatch,rhythmNoteIsSlide,rhythmNoteHasVariableSpan,rhythmProjectSubLaneSpan,rhythmSlideFittedLane,rhythmSlideWidthAt,rhythmSlidePoints,
  rhythmChartHasSky,rhythmNoteSkyHeight,rhythmSkyLineRatio,RHYTHM_SKY_INPUT,RHYTHM_SKY_LIFT,RHYTHM_JUDGMENT_LINE_Y,rhythmSlideSkyAt,rhythmSlideHasSky};`, ctx);
const G = ctx.out;
const S = G.RHYTHM_SUB_LANE_COUNT, L = G.RHYTHM_LANE_COUNT;
G.RHYTHM_SKY_LIFT.set && G.RHYTHM_SKY_LIFT.set(true);   // 横画面の高さで見る

// 見た目の幅(サブレーン座標)。スライドは描くときと同じく、道の内側へ寄せた位置
const visualSpan = (n) => {
  if (G.rhythmNoteIsSlide(n)) {
    const w = G.rhythmSlideWidthAt(n, n.timeMs), c = (G.rhythmSlideFittedLane(Number(n.lane), w) + .5) * 2;
    return { start: c - w / 2, end: c + w / 2 };
  }
  if (G.rhythmNoteHasVariableSpan(n)) { const p = G.rhythmProjectSubLaneSpan(n.subLane, n.subLaneWidth, 1); return { start: p.subLane, end: p.subLane + p.subLaneWidth }; }
  const lane = Number(n.lane); return { start: lane * (S / L), end: (lane + 1) * (S / L) };
};
const isSkyNote = (n) => G.rhythmNoteIsSlide(n) ? (G.rhythmSlideHasSky(n) && G.rhythmSlideSkyAt(n, Number(n.timeMs) || 0) >= .5) : G.rhythmNoteSkyHeight(n) > 0;
const laneOf = (c) => Math.max(0, Math.min(L - 1, Math.floor(c / (S / L))));
const endOf = (n) => Number.isFinite(Number(n.endTimeMs)) ? Number(n.endTimeMs) : Number(n.timeMs);

const charts = [];
for (const song of [...G.RHYTHM_SONGS, ...G.proto]) {
  if (ONLY_SONG && song.songId !== ONLY_SONG) continue;
  for (const [diff, chart] of Object.entries(song.difficulties || {})) {
    if (ONLY_DIFF && diff !== ONLY_DIFF) continue;
    if (chart && Array.isArray(chart.notes) && chart.notes.length) charts.push({ songId: song.songId, diff, chart, proto: G.proto.includes(song) });
  }
}

const found = { 取れない: [], 真ん中で取れない: [], 和音で取れない: [], 幅が狭い: [] };
const perNote = [];
let total = 0;
for (const { songId, diff, chart, proto } of charts) {
  const sky = G.rhythmChartHasSky(chart.notes);
  G.RHYTHM_SKY_INPUT.active = !!sky;
  const groundRatio = G.RHYTHM_JUDGMENT_LINE_Y.ratio, skyRatio = sky ? G.rhythmSkyLineRatio() : groundRatio;
  // 演奏画面の makeRuntimeNotes と同じ形
  const notes = chart.notes.map((n, index) => ({ ...n, index, done: false, activePointerId: null, holdJudgment: null, holdDeltaMs: 0,
    ...(n.type === 'SLIDE' ? { _rhythmSlideRenderPoints: G.rhythmSlidePoints(n) } : {}) }));
  const byTime = new Map();
  notes.forEach(n => { if (G.RHYTHM_NOTE_TYPES.includes(n.type)) { const k = Number(n.timeMs); if (!byTime.has(k)) byTime.set(k, []); byTime.get(k).push(n); } });
  const at = (t) => { for (const n of notes) { const start = Number(n.timeMs), long = n.type === 'HOLD' || G.rhythmNoteIsSlide(n);
    n.done = start < t && !(long && endOf(n) > t); n.activePointerId = long && start < t && endOf(n) > t ? 'held:' + n.index : null; } };
  const tag = (n) => `${songId}${proto ? '(試作)' : ''} ${diff} ${(Number(n.timeMs) / 1000).toFixed(2)}秒 ${n._rhythmOriginalType || n.type} レーン${n.lane}${n.subLane != null ? ' サブ' + n.subLane + '/' + n.subLaneWidth : ''}`;
  for (const [t, group] of byTime) {
    at(t);
    for (const n of group) {
      total++;
      const vis = visualSpan(n), ratio = isSkyNote(n) ? skyRatio : groundRatio, center = (vis.start + vis.end) / 2;
      const hit = (c) => { const r = G.rhythmMatchInputBatch(notes, [{ inputKey: 'touch:scan', lane: laneOf(c), subLaneCoordinate: c, subLaneCoordinateAtLine: null, sky: sky ? ratio : null }], t, 0)[0];
        return !!r && r.target === n; };
      let lo = null, hi = null;
      if (FAST) { if (!hit(Math.min(S - 1e-6, Math.max(0, center)))) found.真ん中で取れない.push(tag(n) + ` 見た目${vis.start.toFixed(2)}〜${vis.end.toFixed(2)}`); continue; }
      for (let c = Math.max(0, vis.start - 2); c < Math.min(S, vis.end + 2) - 1e-9; c += STEP) if (hit(c)) { if (lo === null) lo = c; hi = c; }
      const width = lo === null ? 0 : hi - lo + STEP, visWidth = vis.end - vis.start;
      const rec = { songId, diff, proto, timeMs: Number(n.timeMs), type: n._rhythmOriginalType || n.type, sky: isSkyNote(n), visual: [+vis.start.toFixed(2), +vis.end.toFixed(2)], reach: lo === null ? null : [+lo.toFixed(2), +(hi + STEP).toFixed(2)] };
      perNote.push(rec);
      if (lo === null) found.取れない.push(tag(n));
      else if (!hit(Math.min(S - 1e-6, Math.max(0, center)))) found.真ん中で取れない.push(tag(n) + ` 見た目${rec.visual.join('〜')} 取れる${rec.reach.join('〜')}`);
      else if (width < visWidth * .5) found.幅が狭い.push(tag(n) + ` 見た目${rec.visual.join('〜')} 取れる${rec.reach.join('〜')}`);
    }
    if (group.length > 1) {
      const inputs = group.map((n, k) => { const v = visualSpan(n), c = Math.min(S - 1e-6, Math.max(0, (v.start + v.end) / 2));
        return { inputKey: 'touch:chord' + k, lane: laneOf(c), subLaneCoordinate: c, subLaneCoordinateAtLine: null, sky: sky ? (isSkyNote(n) ? skyRatio : groundRatio) : null }; });
      const got = new Set(G.rhythmMatchInputBatch(notes, inputs, t, 0).map(r => r.target).filter(Boolean));
      for (const n of group) if (!got.has(n)) found.和音で取れない.push(tag(n) + ` (同時${group.length}個)`);
    }
  }
}
G.RHYTHM_SKY_INPUT.active = false;

console.log(`譜面 ${charts.length} / ノーツ ${total}(${FAST ? '見た目の真ん中と和音だけを見た' : `1本の指を ${STEP} サブレーンずつずらして測った`})`);
for (const [k, v] of Object.entries(found)) {
  console.log(`${k}: ${v.length}`);
  if (v.length && (LIST || k !== '幅が狭い')) v.slice(0, LIST ? 1e9 : 20).forEach(x => console.log('  ' + x));
  if (!LIST && k !== '幅が狭い' && v.length > 20) console.log(`  ほか ${v.length - 20}`);
}
if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify(perNote)); console.log(`書き出した: ${JSON_OUT}(${perNote.length}件)`); }
if (CHECK) {
  const bad = found.取れない.length + found.真ん中で取れない.length + found.和音で取れない.length;
  console.log(bad ? `\n${bad}件のNG` : '\nすべてOK');
  process.exit(bad ? 1 : 0);
}
