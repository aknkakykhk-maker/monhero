#!/usr/bin/env node
// API 総点検②の譜面の表を作る(読むだけ・譜面は変えない)。
//   node docs/progress/kensa/api-total-2026-11/2/chart-table.js <audit.json> <出力.tsv>
// audit.json は `node tools/mode/rhythm-chart-audit.js --write <フォルダ>` の出力。公開中の全曲・全難易度について、
// 既存の点検の数字に、同じ時刻の重なり・同じ所の短い間隔・HOLD/SLIDE の同時始まりを数えて足す。
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const { loadRuntimeSongs } = require(path.join(ROOT, 'tools/mode/rhythm-chart-level.js'));
const audit = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).rows;
const songs = loadRuntimeSongs().RHYTHM_SONGS;
const byId = new Map(songs.map((s) => [s.songId, s]));
const xr = (n) => { const s = Number(n.subLane), w = Number(n.subLaneWidth || 2); if (Number.isFinite(s)) return [s, s + w]; const l = Number(n.lane); return Number.isFinite(l) ? [l * 2, l * 2 + 2] : [0, 0]; };
const ovl = (a, b) => { const [a0, a1] = xr(a), [b0, b1] = xr(b); return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); };
const half = (a, b) => { const [a0, a1] = xr(a), [b0, b1] = xr(b); return ovl(a, b) >= Math.min(a1 - a0, b1 - b0) / 2; };
const head = ['曲', 'songId', '難易度', '表示Lv', '見込みLv', 'Lvの印', 'ノーツ', '毎秒', '最密4秒', '最短間隔ms', '押せない', '交差/100', '届きにくい/100', '跳び', '帯の中', 'モンスター数', '段の逆転', '同時で重なる', '同じ所70ms未満', '同じ所の最短ms', 'HOLD/SLIDEの同時始まり', '最後のノーツms', 'イベント曲', '気になる点'];
const rows = [head.join('\t')];
for (const a of audit) {
  const song = byId.get(a.songId); const ch = song && song.difficulties && song.difficulties[a.difficulty];
  const notes = (ch && ch.notes || []).slice().sort((p, q) => p.timeMs - q.timeMs);
  let same = 0, shortSame = 0, minSame = '', hs = 0;
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length && notes[j].timeMs - notes[i].timeMs < 70; j++) {
    const dt = notes[j].timeMs - notes[i].timeMs;
    if (dt <= 1 && ovl(notes[i], notes[j]) > 0) { same++; }
    else if (half(notes[i], notes[j])) { shortSame++; if (minSame === '' || dt < minSame) minSame = Math.round(dt); }
    if (dt <= 1 && ovl(notes[i], notes[j]) > 0 && [notes[i].type, notes[j].type].every((t) => t === 'HOLD' || t === 'SLIDE')) hs++;
  }
  const memo = [];
  if (a.levelFlag) memo.push(a.levelFlag); if (a.odd && a.odd.length) memo.push(a.odd.join('/'));
  rows.push([song && song.displayName || a.songId, a.songId, a.difficulty, a.shown, a.expected, a.levelFlag || '', a.notes, a.nps, a.peak4s, a.minGapMs, a.impossible, a.cross, a.reach, a.jump, a.heldBand, a.monsters, '', same, shortSame, minSame, hs, notes.length ? Math.round(notes[notes.length - 1].timeMs) : '', a.event ? '○' : '', memo.join(' ')].join('\t'));
}
fs.writeFileSync(process.argv[3], rows.join('\n') + '\n');
console.log(rows.length - 1, '譜面');
