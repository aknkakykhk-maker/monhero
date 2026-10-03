#!/usr/bin/env node
// タクティクスの敵の技の格上げ(2026-10-02 ユーザー指示「敵モンスターの攻撃を演出も強化して。これはタクティクスのみ」)を見張る。
//
// 覚醒ムー以外の敵(9体)の大技に、技名の帯・当たる瞬間の閃光・画面の揺れ・フィニッシュを足した。
// 敵を足したときに、フィニッシュの書き忘れで大技が地味なまま残らないように、データのつながりを見る。
// 実際の見え方は 71-screen-battle.jsx の TacticsEnemyStageFx / 70-bootstrap.jsx の [data-enemy-banner]。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };

const battle = read('monster-hero/src/parts/71-screen-battle.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');

const ctx = { Object, Array, Math, String };
vm.createContext(ctx);
vm.runInContext(slice(battle, 'const TACTICS_ENEMY_MOTIONS =', 'const tacticsEnemyMotionMs =') + '\nthis.__m = { TACTICS_ENEMY_MOTIONS };', ctx);
vm.runInContext(slice(battle, 'const TACTICS_ENEMY_BANNER_SKILLS =', 'const TacticsEnemyStageFx =')
  + '\nthis.__f = { TACTICS_ENEMY_BANNER_SKILLS, TACTICS_ENEMY_FLASH_SKILLS, TACTICS_ENEMY_PIERCE_FINISH, TACTICS_ENEMY_FINISH };', ctx);
const { TACTICS_ENEMY_MOTIONS } = ctx.__m;
const { TACTICS_ENEMY_BANNER_SKILLS, TACTICS_ENEMY_FLASH_SKILLS, TACTICS_ENEMY_PIERCE_FINISH, TACTICS_ENEMY_FINISH } = ctx.__f;

const motions = [...new Set(Object.values(TACTICS_ENEMY_MOTIONS))].filter(m => m !== 'awakenedMoo');
check('ムー以外の敵(9体)の全部に、必殺技と全体攻撃のフィニッシュがある',
  motions.every(m => TACTICS_ENEMY_FINISH[m] && TACTICS_ENEMY_FINISH[m].special && TACTICS_ENEMY_FINISH[m].allout),
  motions.filter(m => !(TACTICS_ENEMY_FINISH[m] && TACTICS_ENEMY_FINISH[m].special && TACTICS_ENEMY_FINISH[m].allout)).join(','));
check('覚醒ムーは別の全画面の演出を持つので、フィニッシュの表に入れない', !TACTICS_ENEMY_FINISH.awakenedMoo);
check('貫通撃には共通のフィニッシュがある', Array.isArray(TACTICS_ENEMY_PIERCE_FINISH) && TACTICS_ENEMY_PIERCE_FINISH.length > 0);
check('帯は 連撃・貫通・必殺技・全体攻撃、閃光は 貫通・必殺技・全体攻撃',
  JSON.stringify(TACTICS_ENEMY_BANNER_SKILLS) === '["rush","pierce","special","allout"]' && JSON.stringify(TACTICS_ENEMY_FLASH_SKILLS) === '["pierce","special","allout"]');

// --- 部品と形(CSS)。固有技のフィニッシュ(.fin-*)と同じ部品を使う ---
const all = [...Object.values(TACTICS_ENEMY_FINISH).flatMap(o => Object.values(o).flat()), ...TACTICS_ENEMY_PIERCE_FINISH];
const partCss = { blade:'.fin-blade', ring:'.fin-ring', col:'.fin-col', wave:'.fin-wave', fall:'.fin-fall', bits:'.fin-bit' };
const types = [...new Set(all.map(p => p.t))];
check('部品の種類の全部に CSS の形がある', types.every(t => partCss[t] && css.includes(partCss[t])), types.filter(t => !(partCss[t] && css.includes(partCss[t]))).join(','));
const shapes = [...new Set(all.map(p => p.shape).filter(Boolean))];
check('粒・落下物の形(shape)の全部に CSS がある', shapes.every(sh => css.includes(`.fin-shape--${sh}`)), shapes.filter(sh => !css.includes(`.fin-shape--${sh}`)).join(','));
check('全部の部品が遅れ(d)を持つ', all.every(p => Number.isFinite(p.d)));
check('敵の技ごとに、帯・閃光の CSS がある(敵の色 --em-c を使う)',
  css.includes('[data-enemy-banner-band]') && css.includes('@keyframes enBanner') && css.includes('[data-enemy-flash]') && css.includes('rgb(var(--em-c))'));
check('敵の色(--em-c)を、全部の敵(ムー以外)が持っている', motions.every(m => css.includes(`[data-enemy-motion="${m}"] { --em-c:`)), motions.filter(m => !css.includes(`[data-enemy-motion="${m}"] { --em-c:`)).join(','));

// --- 結線 ---
const stage = slice(battle, 'const TacticsEnemyStageFx =', 'const kindOfTacticsSlotFx =');
check('帯・閃光・フィニッシュは覚醒ムー以外・軽量表示でないときだけ出す',
  stage.includes('!isMoo && !lite && !afterMovie && TACTICS_ENEMY_BANNER_SKILLS.includes(skill)')
  && stage.includes('!isMoo && !lite && TACTICS_ENEMY_FLASH_SKILLS.includes(skill)')
  && stage.includes('!isMoo && !lite && strikes'));
check('フィニッシュは狙われた枠(geo.slots)ごとに、当たる瞬間(hit)に合わせて出す',
  stage.includes('geo.slots.map((t) =>') && stage.includes('const hitMs = Math.round(ms * hit);') && stage.includes('<SpecialFinish parts={parts} offset='));
check('全体攻撃は覚醒ムー以外でも画面を暗くする', stage.includes("(!isMoo && skill === 'allout')"));
check('ムー以外の大技の当たる瞬間に、画面の揺れと効果音を重ねる(待ち時間は足さない)',
  app.includes("['rush','pierce','special','allout'].includes(fxSkill)") && app.includes('setTimeout(()=>{ triggerShake(big); if(big) Audio_.se.crit(); }, hitAt);'));
check('SpecialFinish は表を持たない呼び出し元が部品をそのまま渡せる(parts / offset)',
  read('monster-hero/src/parts/24-battle-fx.jsx').includes('const SpecialFinish = ({ kind, parts: partsProp = null, offset = 0 }) => {'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
