#!/usr/bin/env node
// スライドの始まりのレーンが、押し始めを受け付けられる刻み(0.5刻み)になっているか。
//
// 【なぜ】2026-10-11、公開した Grievous Lady MASTER の 33.74秒のスライドが、どこを押しても押し始めを受け付けず必ず MISS になっていた
// (リバースくんの bot で見つけ、テンポくんが切り分け)。始まりのレーンが 0.75(0.25刻み)で、押し始めの受け付け幅
// (rhythmSlideInputSpan)は「スライドのレーンは0.5刻みだけ」の決めごと(rhythmSlideAuthoredLane・rhythm-mode-slide-sublane-check)
// どおり幅を出さなかったため。見た目はふつうに出るので、遊ぶまで気づけない。
// 途中の点は0.25刻みでよい(押さえている間の追いかけは横の位置で見るので効く。Sheriruth MASTER の交差などで使っている)。
// 見るのは始まりだけ。
//
//   node tools/mode/rhythm-slide-start-lane-check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const ctx = { console };
vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,rhythmSlideAuthoredLane,rhythmSlideInputSpan,proto:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[]};`, ctx);
const { RHYTHM_SONGS, rhythmSlideAuthoredLane, rhythmSlideInputSpan, proto } = ctx.out;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 押し始めを受け付けられるか(受け付け幅が出るか)。始まりのレーンだけで決まる
const startable = (note) => rhythmSlideAuthoredLane(note.lane) !== null && !!rhythmSlideInputSpan(note);

// 検査そのものが効いているか(わざと 0.25刻みで始めたスライドは落ちる・0.5刻みは通る)
const probe = (lane) => ({ type: 'SLIDE', timeMs: 1000, endTimeMs: 2000, lane, subLaneWidth: 2, done: false, activePointerId: null,
  slidePoints: [{ timeMs: 1000, lane, subLaneWidth: 2 }, { timeMs: 2000, lane: 1, subLaneWidth: 2 }] });
check('0.25刻みで始まるスライドを見分けられる', !startable(probe(0.75)) && startable(probe(0.5)) && startable(probe(1)));

const bad = [];
let slides = 0, quarterPoints = 0;
for (const song of [...RHYTHM_SONGS, ...proto]) {
  for (const [diff, chart] of Object.entries(song.difficulties || {})) {
    for (const note of (chart && chart.notes) || []) {
      if (note.type !== 'SLIDE') continue;
      slides++;
      if (!startable(note)) bad.push(`${song.songId} ${diff} ${note.timeMs}ms レーン${note.lane}`);
      for (const p of note.slidePoints || []) if (rhythmSlideAuthoredLane(p.lane) === null) quarterPoints++;
    }
  }
}
check(`どのスライドも押し始めを受け付けられる(始まりのレーンが0.5刻み・${slides}本)`, bad.length === 0,
  bad.length ? `始まりを0.5刻みへ: ${bad.slice(0, 8).join(' / ')}${bad.length > 8 ? ` ほか${bad.length - 8}本` : ''}` : `途中の点の0.25刻み ${quarterPoints}点は対象外`);

console.log(failed ? `\n${failed}件のNG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
