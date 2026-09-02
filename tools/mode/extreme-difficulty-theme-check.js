#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const order = ['EXTREME','NIGHTMARE','CHAOS','ULTIMATE','INFINITY','GOD'];
const start = source.indexOf('const EXTREME_DIFFICULTY_THEMES = Object.freeze({');
const end = source.indexOf('const PUBLIC_EXTREME_DIFFICULTIES', start);
assert(start >= 0 && end > start, '難易度テーマ定義が必要です');
const block = source.slice(start, end);
const themes = order.map((id, index) => {
  const next = index + 1 < order.length ? order[index + 1] : null;
  const from = block.indexOf(`${id}:Object.freeze({`);
  assert(from >= 0, `${id} のテーマ定義が必要です`);
  const to = next ? block.indexOf(`${next}:Object.freeze({`, from) : block.indexOf('});\nconst extremeDifficultyTheme', from);
  const part = block.slice(from, to > from ? to : undefined);
  const accent = part.match(/accent:'([^']+)'/)?.[1];
  const glow = Number(part.match(/glow:([0-9.]+)/)?.[1]);
  assert(accent, `${id} のaccentが必要です`);
  assert(Number.isFinite(glow), `${id} のglowが必要です`);
  return { id, accent, glow };
});
assert.strictEqual(new Set(themes.map(t => t.accent)).size, order.length, '6難易度は別々の色にしてください');
for (let i = 1; i < themes.length; i++) assert(themes[i].glow > themes[i-1].glow, `${themes[i].id} は一つ前より強い発光にしてください`);
for (const required of [
  'const theme=extremeDifficultyTheme(setting.id);',
  'background:previewable?theme.background',
  'background:theme.action',
  'borderColor:`rgba(${theme.rgb},.58)`',
  'text-[10px] leading-tight text-amber-300',
]) assert(source.includes(required), `実装に ${required} が必要です`);

const rankingStart = source.indexOf('const renderScoreRankingBody = (mode = BATTLE_MODE_CHALLENGE) => {');
const rankingEnd = source.indexOf('const renderBreederRankingBody', rankingStart);
assert(rankingStart >= 0 && rankingEnd > rankingStart, 'スコアランキング描画が必要です');
const rankingBlock = source.slice(rankingStart, rankingEnd);
assert(rankingBlock.includes('PUBLIC_EXTREME_DIFFICULTIES.map(setting=>{const active=rankingViewDiff===setting.id;const theme=extremeDifficultyTheme(setting.id);return <button'), '極限ランキングタブは既存の難易度テーマを再利用してください');
assert(rankingBlock.includes('background:theme.action'), '選択中の極限ランキングタブは難易度ごとのaction色を使ってください');
assert(rankingBlock.includes('backgroundColor:`rgba(${theme.rgb},.14)`'), '未選択の極限ランキングタブも難易度ごとの色を弱めて表示してください');
assert(rankingBlock.includes('color:active?theme.actionText:theme.accent'), '極限ランキングタブの文字色も選択状態に合わせてください');
assert(!rankingBlock.includes('style={{backgroundColor:EXTREME_MODE.color,color:\'#0f172a\'}}'), '極限ランキングタブへ固定マゼンタを使わないでください');

console.log('OK: 極限チャレンジ6難易度の固有色・段階的な強調・ランキングタブへのテーマ反映を確認');
