#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const index = fs.readFileSync(path.join(root, 'monster-hero/index.html'), 'utf8');
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
  const rgb = part.match(/rgb:'([^']+)'/)?.[1];
  const action = part.match(/action:'linear-gradient\(135deg,([^,]+),([^\)]+)\)'/)?.slice(1);
  const actionText = part.match(/actionText:'([^']+)'/)?.[1];
  const glow = Number(part.match(/glow:([0-9.]+)/)?.[1]);
  assert(accent && rgb && action?.length === 2 && actionText, `${id} の色テーマが必要です`);
  assert(Number.isFinite(glow), `${id} のglowが必要です`);
  return { id, accent, rgb, action, actionText, glow };
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

const rankingCssStart = index.indexOf('/* 極限チャレンジランキングの6難易度タブ。');
const rankingCssEnd = index.indexOf('/* 音ゲー STEP B:', rankingCssStart);
assert(rankingCssStart >= 0 && rankingCssEnd > rankingCssStart, '極限ランキングタブ用CSSが必要です');
const rankingCss = index.slice(rankingCssStart, rankingCssEnd);
assert(rankingCss.includes(':has(> button:nth-child(6)):not(:has(> button:nth-child(7)))'), '6難易度だけを対象にして通常ランキングへ波及させないでください');
assert(rankingCss.includes('> button.ring-2'), '選択中タブは別の強調を持たせてください');
assert(rankingCss.includes('background:rgba(var(--mh-extreme-rank-rgb),.14)'), '未選択タブは難易度色を弱めて表示してください');
assert(rankingCss.includes('background:linear-gradient(135deg,var(--mh-extreme-rank-action-a),var(--mh-extreme-rank-action-b))'), '選択中タブは難易度ごとのaction色を使ってください');
assert(!rankingCss.includes('data-species-difficulty-tabs'), '種族ランキング専用セレクタへ干渉しないでください');

themes.forEach((theme, i) => {
  const nth = `> button:nth-child(${i + 1})`;
  const pos = rankingCss.indexOf(nth);
  assert(pos >= 0, `${theme.id} のランキングタブ色が必要です`);
  const next = rankingCss.indexOf('> button:nth-child(', pos + nth.length);
  const css = rankingCss.slice(pos, next > pos ? next : undefined);
  assert(css.includes(`--mh-extreme-rank-rgb:${theme.rgb}`), `${theme.id} のRGBは既存テーマと一致させてください`);
  assert(css.includes(`--mh-extreme-rank-accent:${theme.accent}`), `${theme.id} のaccentは既存テーマと一致させてください`);
  assert(css.includes(`--mh-extreme-rank-action-a:${theme.action[0]}`), `${theme.id} のaction開始色は既存テーマと一致させてください`);
  assert(css.includes(`--mh-extreme-rank-action-b:${theme.action[1]}`), `${theme.id} のaction終了色は既存テーマと一致させてください`);
  assert(css.includes(`--mh-extreme-rank-action-text:${theme.actionText}`), `${theme.id} の文字色は既存テーマと一致させてください`);
});

console.log('OK: 極限チャレンジ6難易度の固有色・段階的な強調・ランキングタブへの同色反映を確認');
