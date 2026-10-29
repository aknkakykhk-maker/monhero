// 本編(5つの遊び)とタクティクスの EX 以外の強化・弱化を、#4206 と同じ形に直す部品(34-tactics-ex-effects.jsx の後半)を確かめる。
//   node tools/battle/battle-effects-check.js
// 見ること:
//   ・71 の battleBuffChips が作る札の種類が、すべて CLASSIC_CHIP_VIEW にある(札を足したのに一覧に出ない、を防ぐ)
//   ・60 の enemyDebuffs が作る弱化の種類が、すべて CLASSIC_DEBUFF_VIEW にある
//   ・並べた中身(全員に効く札は allAllies・その子だけの札は持ち主の枠だけ・何%・残りターン・二重に出さない)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const screen = read('monster-hero/src/parts/71-screen-battle.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const chipsSrc = screen.slice(screen.indexOf('const battleBuffChips = () => {'), screen.indexOf('return chips;', screen.indexOf('const battleBuffChips = () => {')));
const chipKeys = [...new Set([...chipsSrc.matchAll(/chip\((['`])([a-zA-Z]+)/g)].map((m) => m[2]))];
const debStart = app.indexOf('const enemyDebuffs = (() => {');
const debSrc = app.slice(debStart, app.indexOf('return list;\n  })();', debStart));
const debKeys = [...new Set([...debSrc.matchAll(/add\('([a-zA-Z]+)'/g)].map((m) => m[1]))];
check('71 の強化の札が読めた', chipKeys.length >= 20, chipKeys.join(','));
check('60 の敵の弱化が読めた', debKeys.length >= 10, debKeys.join(','));

const gs = read('monster-hero/src/game-system.jsx');
const k = gs.indexOf('const BATTLE_STACK_MARKS'), kEnd = gs.indexOf('});', k) + 3;
const consts = gs.split('\n').filter((l) => /^const (SWEET_STACK_MAX|KENSHI_COMBO_POWER_MAX|KYUBI_RENGOKU_MAX|KITSUNEBI_MAX|TACTICS_ROAR_MAX_STACKS)\b/.test(l)).join('\n');
const part = read('monster-hero/src/parts/34-tactics-ex-effects.jsx');
const sb = { Math, Number, String, Array, Object, JSON, Set };
vm.createContext(sb);
vm.runInContext(consts + '\n' + gs.slice(k, kEnd) + '\n' + part.slice(part.indexOf('// ---- 溜まる物')) + ';globalThis.api={CLASSIC_CHIP_VIEW,CLASSIC_DEBUFF_VIEW,classicChipKindOf,classicEffectsFromChips,classicEnemyEffectsFromDebuffs};', sb);
const A = sb.api;
const missChips = chipKeys.filter((key) => !A.classicChipKindOf(key));
check('強化の札の種類がすべて見せ方の表にある', missChips.length === 0, missChips.join(','));
const missDeb = debKeys.filter((key) => !A.CLASSIC_DEBUFF_VIEW[key]);
check('敵の弱化の種類がすべて見せ方の表にある', missDeb.length === 0, missDeb.join(','));

const chips = [
  { key: 'atk', label: '攻撃力', value: '+30%', short: '+30%', owner: null },
  { key: 'kyukoCut', label: '被ダメ', value: '-20%（残り2T）', short: '-20%', owner: null },
  { key: 'trick1', label: 'ゴーストトリック', value: 'ち+20%', short: 'ち+20%', owner: 1 },
  { key: 'sweetparty', label: 'クッキー', value: '🍪3/10', short: '🍪3/10', owner: 0 },
  { key: 'boost', label: 'Boost', value: 'x1.5', short: 'x1.5', owner: null },
];
const at0 = A.classicEffectsFromChips(chips, 0, { cookie: 3, kitsunebi: 2 });
const by = (k2) => at0.find((x) => x.key === k2);
check('全員に効く札は allAllies・何%を読む', by('chip:atk') && by('chip:atk').allAllies === true && by('chip:atk').pct === 30 && by('chip:atk').turnsLeft === null);
check('残りターンを読む(きゅうこ 残り2T・被ダメ−20%)', by('chip:kyukoCut') && by('chip:kyukoCut').turnsLeft === 2 && by('chip:kyukoCut').pct === -20);
check('ほかの子だけの札は出さない(枠1のトリックは枠0に出ない)', !by('chip:trick1'));
check('このターンだけの札は残り1', by('chip:boost') && by('chip:boost').turnsLeft === 1);
check('札と同じ溜まる物(クッキー)は二重に出さない・札に無い溜まる物(狐火)は stack で足す', !by('stack:cookie') && by('stack:kitsunebi') && by('stack:kitsunebi').kind === 'stack');
const en = A.classicEnemyEffectsFromDebuffs([{ key: 'psycho', mark: '🎯', label: 'サイコロックオン', value: '残り3T' }, { key: 'ice', mark: '❄️', label: '絶氷の楔', value: '残り2T' }, { key: 'roar', mark: '📢', label: '咆哮', value: '×2' }], { roar: 2, kusabi: 3 }, { withoutEx: true });
check('敵: タクティクスでは EX の弱化(サイコロックオン)を外す', !en.some((x) => x.key === 'debuff:psycho'));
check('敵: 絶氷の楔は残り2ターン・咆哮は弱化の一覧のほうだけ(stack と二重にしない)・楔は stack', en.some((x) => x.key === 'debuff:ice' && x.turnsLeft === 2) && !en.some((x) => x.key === 'stack:roar') && en.some((x) => x.key === 'stack:kusabi'));
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nすべてOK');
