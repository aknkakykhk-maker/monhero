// タクティクス(とレイド)の EX で、いま効いている強化・弱化の一覧(34-tactics-ex-effects.jsx)を確かめる。
//   node tools/battle/tactics-ex-effects-check.js
// 見ること:
//   ・TACTICS_EX_SKILLS の EX がすべて TACTICS_EX_EFFECT_VIEW にある(足したのに一覧に出ない、を防ぐ・docs/progress/battle-ex-buffs.md の31種)
//   ・どの EX でも pct・note がエラー無しで作れる(pct は数か null、note は空でない文字)
//   ・本体が一覧を 71 へ渡している(tacticsExEffectsAt・tacticsExEnemyEffects)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const grab = (src, head) => {
  const i = src.indexOf(head); if (i < 0) return null;
  let depth = 0, j = i + head.length, start = j;
  for (; j < src.length; j++) { const c = src[j]; if (c === '(' || c === '{') depth++; else if (c === ')' || c === '}') { depth--; if (depth === 0) { j++; break; } } }
  return src.slice(start, j);
};
const units = read('monster-hero/src/parts/32-tactics-units.jsx');
const view = read('monster-hero/src/parts/34-tactics-ex-effects.jsx');
const ctx = vm.createContext({ Object, Math, Number, String, Array, JSON });
const skills = vm.runInContext('(' + grab(units, 'const TACTICS_EX_SKILLS = ') + ')', ctx);
vm.runInContext(view.split('\n').find((l) => l.startsWith('const tacticsExPct = ')).replace('const tacticsExPct', 'globalThis.tacticsExPct'), ctx);
const views = vm.runInContext('(' + grab(view, 'const TACTICS_EX_EFFECT_VIEW = ') + ')', ctx);
const effects = Object.values(skills).map((d) => d.effect);
const missing = effects.filter((e) => !views[e]);
check(`TACTICS_EX_SKILLS の EX(${effects.length}種)がすべて一覧の見せ方にある`, missing.length === 0, missing.join(','));
Object.entries(skills).forEach(([mon, d]) => {
  const v = views[d.effect]; if (!v) return;
  try {
    const pct = v.pct ? v.pct(d) : null, note = v.note ? v.note(d) : '';
    check(`${mon}「${d.name}」: pct は数か null・note がある`, (pct === null || Number.isFinite(pct)) && typeof note === 'string' && note.length > 0 && !/undefined|NaN/.test(note), `${pct} / ${note}`);
  } catch (e) { check(`${mon}「${d.name}」: pct・note を作れる`, false, String(e)); }
});
// 中身: 本体(game-system.jsx)から切り出して、決まった状態で並べてみる
{
  const gs = read('monster-hero/src/game-system.jsx');
  const i = gs.indexOf('const TACTICS_START_GUTS_RATE'), j = gs.indexOf('// ===== イベント・レイドボス「ジャック」の定義');
  const sb = { Math, Number, String, Array, Object, JSON, console, monsterTypeOf: () => ({ main: 'attacker', sub: null }), MONSTER_TYPES: {} };
  vm.createContext(sb);
  // 溜まる物の名前・絵・上限は 22-enemy-and-bond-entries.jsx の定数を読むので、それも先に入れる
  const k = gs.indexOf('const BATTLE_STACK_MARKS'), kEnd = gs.indexOf('});', k) + 3;
  const consts = gs.split('\n').filter((l) => /^const (SWEET_STACK_MAX|KENSHI_COMBO_POWER_MAX|KYUBI_RENGOKU_MAX|KITSUNEBI_MAX|TACTICS_ROAR_MAX_STACKS)\b/.test(l)).join('\n');
  vm.runInContext(consts + '\n' + gs.slice(k, kEnd) + '\n' + gs.slice(i, j) + ';globalThis.api={listTacticsExEffectsAt,listTacticsExEnemyEffects,listTacticsStackItems,TACTICS_EX_SKILLS};', sb);
  const A = sb.api;
  const units = [{ id: 'Mocchi' }, { id: 'Plant' }, { id: 'Suezo' }, null];
  const now = { wave: 1, turn: 2 };
  const eff = (monId, effect, turns, extra = {}) => ({ monId, effect, duration: 'turns', turns, wave: 1, turn: 1, ...extra });
  const state = { effects: { 1: eff('Plant', 'partyBoost', 5), 2: eff('Suezo', 'psychoLock', 5, { psychoLockCfg: A.TACTICS_EX_SKILLS.Suezo.psychoLock }) } };
  const opts = { defOf: (id) => A.TACTICS_EX_SKILLS[id], nameOf: (k) => ['モッチー', 'プラント', 'スエゾー'][k] };
  const at0 = A.listTacticsExEffectsAt(state, units, 0, now, opts);
  const pb = at0.find((x) => x.key === 'partyBoost@1');
  check('プラントの緑のめぐみは、使っていないモッチーの枠にも全員向けとして入る', !!pb && pb.allAllies === true && pb.pct === 10 && pb.fromName === 'プラント' && pb.turnsLeft === 4, JSON.stringify(pb));
  check('敵だけに付く EX(サイコロックオン)は味方の枠に入らない', !at0.some((x) => x.key.startsWith('psychoLock')));
  const en = A.listTacticsExEnemyEffects(state, units, now, opts);
  const ps = en.find((x) => x.key.startsWith('psychoLock'));
  check('サイコロックオンは敵の一覧に入る(被ダメ+30%・残り4ターン・スエゾーの EX)', !!ps && ps.pct === 30 && ps.turnsLeft === 4 && ps.fromName === 'スエゾー' && ps.kind === 'debuff', JSON.stringify(ps));
  check('切れたあと(WAVE が変わった)は何も返さない', A.listTacticsExEffectsAt(state, units, 0, { wave: 2, turn: 1 }, opts).length === 0
    && A.listTacticsExEnemyEffects(state, units, { wave: 2, turn: 1 }, opts).length === 0);
  const st = A.listTacticsStackItems({ cookie: 0, kitsunebi: 3, exTurns: 2, reikon: 2, chuuni: 1, rengoku: 0 });
  const by = (key) => st.find((x) => x.key === `stack:${key}`);
  check('溜まる物: 狐火は名前・絵・数・上限5', by('kitsunebi') && by('kitsunebi').name === '狐火' && by('kitsunebi').icon === '🦊' && by('kitsunebi').count === 3 && by('kitsunebi').max === 5 && by('kitsunebi').kind === 'stack', JSON.stringify(by('kitsunebi')));
  check('溜まる物: クッキーは0個でも出す・煉獄は0なら出さない', by('cookie') && by('cookie').count === 0 && !by('rengoku'));
  check('溜まる物: 霊魂は残りターンで数える(turnsLeft)', by('reikon') && by('reikon').turnsLeft === 2 && by('reikon').max === null);
  check('溜まる物: EX の残りターンは EX の要素と重ねて出さない', !by('exTurns'));
  check('溜まる物: マーク×数に無い物(中二病の重ね)も名前と絵を持つ', by('chuuni') && by('chuuni').name === '中二病の固有技の重ね' && !!by('chuuni').note);
  check('空いた枠・タクティクスの盤が無いときは []', A.listTacticsExEffectsAt(state, units, 3, now, opts).length === 0 && A.listTacticsExEffectsAt(state, null, 0, now, opts).length === 0);
}
const app = read('monster-hero/src/parts/60-app.jsx');
check('本体が一覧を 71 へ渡している', /tacticsExEffectsAt=\{/.test(app) && /tacticsExEnemyEffects=\{/.test(app));
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nすべてOK');
