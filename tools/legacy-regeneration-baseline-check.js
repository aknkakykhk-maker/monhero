// 第6B-1: 旧再生個体の4能力から歴代ベースを判定する純粋関数を検査する。
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf('const LEGACY_REGENERATION_STAT_BASELINES =');
const end = source.indexOf('// 第4段階の既存個体ドライラン', start);
if (start < 0 || end < 0) throw new Error('判定関数を抽出できません');

const bases = {
  Pixie: { baseHp:250, baseAtk:160, baseDef:50, baseGuts:170 },
  Mitarashi: { baseHp:630, baseAtk:140, baseDef:105, baseGuts:90 },
  Mocchi: { baseHp:500, baseAtk:100, baseDef:100, baseGuts:120 },
};
const context = { ALL_PLAYER_MONSTERS:bases };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nglobalThis.out={diagnoseLegacyRegenerationStatBaseline,regenerationStatCouldBeGenerated};`, context);
const diagnose = context.out.diagnoseLegacyRegenerationStatBaseline;
const check = (label, condition) => {
  if (!condition) throw new Error(`FAIL: ${label}`);
  console.log(`OK: ${label}`);
};
const run = (label, baseId, individualStats, status) => {
  const input = { id:`test-${label}`, baseId, individualStats:{ ...individualStats }, createdAt:'判定に使用しない値' };
  const before = JSON.stringify(input);
  const result = diagnose(input);
  check(`${label}: ${status}`, result.status === status);
  check(`${label}: 入力を変更しない`, JSON.stringify(input) === before);
  return result;
};

const pixieOld = run('ピクシー旧だけ', 'Pixie', { hp:250, atk:160, def:50, guts:130 }, 'SAFE_EXACT');
check('ピクシー旧だけ: 旧ベースとの差を算出', pixieOld.individualStatOffsets.guts === -10 && pixieOld.candidates[0].id === 'pre-2026-08-14');
run('ピクシー新だけ', 'Pixie', { hp:250, atk:160, def:50, guts:180 }, 'SAFE_EXACT');
run('ピクシー旧新両方', 'Pixie', { hp:250, atk:160, def:50, guts:154 }, 'AMBIGUOUS');
run('ピクシー不成立', 'Pixie', { hp:250, atk:160, def:50, guts:200 }, 'BLOCKED');

const mitarashiOld = run('ミタラシ旧だけ', 'Mitarashi', { hp:550, atk:110, def:110, guts:100 }, 'SAFE_EXACT');
check('ミタラシ旧だけ: 旧ベースとの差を算出', mitarashiOld.individualStatOffsets.hp === -50 && mitarashiOld.candidates[0].id === 'pre-2026-08-14');
run('ミタラシ新だけ', 'Mitarashi', { hp:680, atk:150, def:100, guts:85 }, 'SAFE_EXACT');
run('ミタラシ旧新両方', 'Mitarashi', { hp:620, atk:130, def:110, guts:95 }, 'AMBIGUOUS');
run('ミタラシ不成立', 'Mitarashi', { hp:700, atk:130, def:110, guts:95 }, 'BLOCKED');

run('その他の現行ベース成立', 'Mocchi', { hp:450, atk:110, def:100, guts:108 }, 'SAFE_EXACT');
run('その他の生成不可能値', 'Mocchi', { hp:449, atk:110, def:100, guts:108 }, 'BLOCKED');
check('1.1倍端点のMath.round結果を含む', context.out.regenerationStatCouldBeGenerated(116, 105));
check('localStorage書込み処理を含まない', !source.slice(start, end).includes('localStorage') && !source.slice(start, end).includes('mh_masu_mons'));
