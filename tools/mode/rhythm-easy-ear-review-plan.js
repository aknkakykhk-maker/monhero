#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..', '..');
const candidatePath = path.join(ROOT, 'monster-hero', 'debug', 'atsu-cup-theme-easy-formal-candidate-v1.json');
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));

const MAX_GROUP_GAP_GRIDS = 24;
const LOOP_PADDING_GRIDS = 8;
const reviews = [...candidate.earReviewGrids].map(Number);

assert.equal(candidate.trackId, 'atsu_cup_theme', 'あつ杯テーマ以外の候補を参照している');
assert.equal(candidate.difficulty, 'EASY', 'EASY以外の候補を参照している');
assert.equal(candidate.reviewRequired, true, '耳確認前にreviewRequiredを解除しない');
assert.equal(candidate.runtimeConnected, false, '耳確認前に正式runtimeへ接続しない');
assert.equal(reviews.length, 22, '耳確認候補は現行22点を維持する');
assert.deepEqual(reviews, [...reviews].sort((a, b) => a - b), '耳確認候補は時刻順であること');
assert.equal(new Set(reviews).size, reviews.length, '耳確認候補に重複がないこと');

const msPerGrid = 60000 / candidate.bpm / candidate.subdivisionsPerBeat;
const timeAtGrid = grid => candidate.beatZeroMs + grid * msPerGrid;
const formatTime = ms => {
  const totalTenths = Math.max(0, Math.round(ms / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
};

const groups = [];
for (const grid of reviews) {
  const current = groups[groups.length - 1];
  if (!current || grid - current.points[current.points.length - 1] > MAX_GROUP_GAP_GRIDS) {
    groups.push({ points: [grid] });
  } else {
    current.points.push(grid);
  }
}

for (const group of groups) {
  group.startGrid = Math.max(0, group.points[0] - LOOP_PADDING_GRIDS);
  group.endGrid = group.points[group.points.length - 1] + LOOP_PADDING_GRIDS;
  group.startMs = timeAtGrid(group.startGrid);
  group.endMs = timeAtGrid(group.endGrid);
}

assert.equal(groups.length, 16, '現行22点は16区間へまとめられること');
assert(groups.every(group => group.endGrid > group.startGrid), '全区間で開始<終了を満たすこと');
assert(groups.every(group => group.points.every(grid => grid >= group.startGrid && grid <= group.endGrid)), '全候補点が区間内に収まること');

console.log(`OK: EASY耳確認 ${reviews.length}点 → ${groups.length}区間`);
groups.forEach((group, index) => {
  console.log(
    `${String(index + 1).padStart(2, '0')}/${groups.length} ` +
    `${formatTime(group.startMs)}-${formatTime(group.endMs)} ` +
    `grid ${group.startGrid}-${group.endGrid} ` +
    `候補[${group.points.join(',')}]`
  );
});
console.log('OK: 採用/移動/不採用は決めず、reviewRequired=true / runtimeConnected=falseを維持');
