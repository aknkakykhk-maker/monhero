#!/usr/bin/env node
'use strict';
// 固有技設定の「初期技」が、バトルで実際に最初に構える固有技になるところまでを確かめる。
//
//   node tools/run/unique-initial-in-battle-check.js
//
// 【なぜ道具にするか】
// 設定画面で保存できることと、バトルでその技が選ばれることは別物で、実際に
// 「保存はできているのに毎回もとの固有技から始まる」不具合を出した。原因は
// 前の周回で手動で切り替えた一時選択(slotUniqueChoice)が残り、保存した初期技を
// 覆い隠していたこと。画面を見ただけでは「設定が保存されていない」としか分からない。
// ここでは山札を組み立てる本体のコードをそのまま切り出し、
// 「どの固有技カードが配られるか」を直接見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from), j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};
// 山札作りのうち、固有技カード1枚を決めている部分だけをそのまま取り出す
const sliceUniqueCardBody = () => {
  const from = 'const options=getAvailableUniquesForSlot(s,cUniques,idx,cInhEvo);';
  const to = 'ownerSlotIdx:idx});';
  const i = source.indexOf(from), j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log('NG: 山札の固有技カード生成を切り出せませんでした'); process.exit(1); }
  return `${source.slice(i, j + to.length)}\n        }`;
};

const ALL_PLAYER_MONSTERS = {
  Mocchi: {
    id:'Mocchi', name:'モッチー', baseHp:600, baseAtk:220, baseDef:200, baseGuts:180,
    distAptitude:['C','C','C','C'], plusStats:{},
    unique:{ monId:'Mocchi', name:'自前技', baseMult:2, baseGuts:30, effectDesc:'自前', names:Array.from({length:9},(_,i)=>`自前技${i}`) },
  },
  Zan: {
    id:'Zan', name:'ザン', baseHp:1, baseAtk:1, baseDef:1, baseGuts:1, distAptitude:['C','C','C','C'], plusStats:{},
    unique:{ monId:'Zan', name:'エーの技', baseMult:3, baseGuts:40, effectDesc:'継承A', names:Array.from({length:9},(_,i)=>`エーの技${i}`) },
  },
  Pixy: {
    id:'Pixy', name:'ピクシー', baseHp:1, baseAtk:1, baseDef:1, baseGuts:1, distAptitude:['C','C','C','C'], plusStats:{},
    unique:{ monId:'Pixy', name:'ビーの技', baseMult:4, baseGuts:50, effectDesc:'継承B', names:Array.from({length:9},(_,i)=>`ビーの技${i}`) },
  },
};

const sandbox = {
  console, Math, Map, Set, Number, Array, Object, String, JSON,
  ALL_PLAYER_MONSTERS,
  MAX_UNIQUE_SKILL_LEVEL: 8,
  DIST_APTITUDE_GRADES: ['G','F','E','D','C','B','A','S','S+','SS','SS+','M'],
  // 今回見たいのは固有技の選ばれ方だけなので、能力・染色まわりは最小の形で置き換える
  resolveMasuIndividualStats: (masu, base) => ({ hp:base.baseHp, atk:base.baseAtk, def:base.baseDef, guts:base.baseGuts }),
  resolveMasuDistAptitude: (masu, base) => base.distAptitude,
  getMasuColors: () => [],
  ownedUniques: [],
  inheritedUniqueEvo: {},
};
vm.createContext(sandbox);
vm.runInContext([
  "const INHERITED_UNIQUE_LEVEL_KEY_PREFIX = 'inhId:';",
  slice('const inheritedUniqueLevelKey = (unique) =>', 'const isValidInheritedUnique'),
  slice('const OWN_UNIQUE_KEY =', '// 構造ベースの冪等移行'),
  slice('const resolveInheritedUniqueDefinition = (unique) =>', '// 継承固有技は、ラン内stateがまだ無い間も'),
  slice('const inheritedUniqueRunLevel =', '// みゃるの薬系は進化するたび'),
  slice('const mergeMasuIntoMon = (masu) => {', '// ==================== 総合力'),
  slice('  const inhEvoKey = (slotIdx, inhIdx) =>', '  const applyUniqueChoiceForSlot'),
  `globalThis.api = {
    mergeMasuIntoMon, getAvailableUniquesForSlot, activeSlotUniqueKey, battleUniqueKeyFromSettingKey,
    pickUniqueCard: (s, idx, cUniques, cInhEvo, uChoice, uLevelChoice) => {
      const pool = [];
      ${sliceUniqueCardBody()}
      return pool[0] || null;
    },
  };`,
].join('\n'), sandbox);
const A = sandbox.api;

// --- 自前1つ + 継承2つを持つマスモン ---
const inhA = { ...ALL_PLAYER_MONSTERS.Zan.unique, inheritedUniqueId:'iu_a', sourceMasuName:'エー' };
const inhB = { ...ALL_PLAYER_MONSTERS.Pixy.unique, inheritedUniqueId:'iu_b', sourceMasuName:'ビー' };
const keyA = 'inhId:iu_a', keyB = 'inhId:iu_b';
const makeMasu = (extra = {}) => ({
  id:'m1', name:'テスト', baseId:'Mocchi',
  inheritedUniques:[inhA, inhB],
  uniqueSkillLevels:{ own:3, [keyA]:5, [keyB]:8 },
  ...extra,
});
// ラン開始時に配る自前固有技(setupMonと同じ形)
const ownUniqueOf = (mon) => ({ ...mon.unique, evoLevel: Math.max(0, mon.unique.evoLevel || 0) });
// スロット0にそのマスモンを置いて、配られる固有技カードを見る
const dealtUnique = (masu, { uChoice = {}, uLevelChoice = {}, extraUniques = [] } = {}) => {
  const mon = A.mergeMasuIntoMon(masu);
  const card = A.pickUniqueCard(mon, 0, [ownUniqueOf(mon), ...extraUniques], {}, uChoice, uLevelChoice);
  return { mon, card };
};

// ---------- ① 保存した初期技がバトルの1枚目になる ----------
{
  const { card } = dealtUnique(makeMasu({ initialUniqueKey:keyB }));
  check('初期技に設定した継承技が、バトルで最初に構える固有技になる',
    !!card && card.monId === 'Pixy', card ? `配られた技=${card.name}` : 'カードなし');
  check('その継承技の固有技Lvで配られる（Lvが入れ替わらない）', !!card && card.evoLevel === 8, card ? `Lv.${card.evoLevel}` : '');
  check('威力・消費もその継承技のもの', !!card && card.baseMult === 4 && card.baseGuts === 50);
}
{
  const { card } = dealtUnique(makeMasu({ initialUniqueKey:keyA }));
  check('もう一方の継承技を初期技にしても切り替わる', !!card && card.monId === 'Zan' && card.evoLevel === 5);
}
// ---------- ② 旧マスモン・壊れた設定は自前技 ----------
{
  const { card } = dealtUnique(makeMasu());
  check('初期技を設定していない既存マスモンは従来どおり自前技', !!card && card.monId === 'Mocchi' && card.evoLevel === 3);
}
{
  const { card } = dealtUnique(makeMasu({ initialUniqueKey:'inhId:iu_消えた' }));
  check('保存された初期技IDが無効なら自前技へフォールバック', !!card && card.monId === 'Mocchi');
}
// ---------- ③ 並び順は初期技を変えない ----------
{
  const { mon, card } = dealtUnique(makeMasu({ uniqueOrder:[keyB, 'own', keyA] }));
  check('並び順を変えただけでは初期技は変わらない（未設定なら自前技のまま）', !!card && card.monId === 'Mocchi');
  const options = A.getAvailableUniquesForSlot(mon, [ownUniqueOf(mon)], 0, {});
  check('切替候補の並びは設定順になる', options.map(o => o.key).join(',') === 'inh1,own,inh0');
  check('並べ替えても継承技のIDと対応する配列位置は変わらない',
    options.find(o => o.key === 'inh0')?.unique.inheritedUniqueId === 'iu_a'
    && options.find(o => o.key === 'inh1')?.unique.inheritedUniqueId === 'iu_b');
}
// ---------- ④ ラン中に手で切り替えたら、その選択が優先される ----------
{
  const { card } = dealtUnique(makeMasu({ initialUniqueKey:keyB }), { uChoice:{ 0:'own' } });
  check('バトル中に手動で切り替えたら、そのラン中はその選択を優先する', !!card && card.monId === 'Mocchi');
  const next = dealtUnique(makeMasu({ initialUniqueKey:keyB }), { uChoice:{ 0:'own' } });
  check('WAVEが変わっただけでは勝手に初期技へ戻さない', !!next.card && next.card.monId === 'Mocchi');
}
// ---------- ⑤ 別スロット・別モンスターへ引き継がない ----------
{
  const mon = A.mergeMasuIntoMon(makeMasu({ initialUniqueKey:keyB }));
  check('他のスロットの一時選択に引きずられない',
    A.activeSlotUniqueKey({ 1:'own' }, 0, mon) === 'inh1');
}

// --- 一時選択の後始末を実装から見る ---
// 新しいランへ入るときに前の周回の一時選択が残っていると、保存した初期技が覆い隠される。
// ラン開始の入口すべてで消していることを、実装の形として確かめる
const clearedAtRunStart = (marker) => {
  const at = source.indexOf(marker);
  if (at < 0) return false;
  const body = source.slice(at, at + 1400);
  return /clearSlotUniqueSelection\(\)/.test(body);
};
check('ラン開始(難易度を選んで挑戦)で前の周回の一時選択を消している',
  clearedAtRunStart("battleEntryStateRef.current='BATTLE_DIFFICULTY_SELECT';"));
check('ラン開始(バトルメニューから挑戦)で前の周回の一時選択を消している',
  clearedAtRunStart("battleEntryStateRef.current='BATTLE_MENU';"));
check('ラン開始(極限チャレンジ)で前の周回の一時選択を消している',
  clearedAtRunStart("battleEntryStateRef.current='EXTREME_DIFFICULTY_SELECT';"));
check('勇者モンを選び直すときも一時選択を消している',
  clearedAtRunStart("setMainHero(null);setSlots([null,null,null,null]);setCurrentPickingMon(null);"));
check('スロットへモンスターを置いたら、そのスロットの古い一時選択を残さない',
  /clearSlotUniqueSelection\(slotIdx\)/.test(slice('const setupMon = (m, slotIdx) => {', 'const bonus=m.plusStats||{};')));
check('消すのは一時選択だけで、保存(mh_masu_mons)には触っていない',
  !/storeSet/.test(slice('const clearSlotUniqueSelection =', 'const getAvailableUniquesForSlot')));
check('リトライ・AUTO∞の既存のリセットはそのまま使う',
  (source.match(/applyResetAllState\(\)/g) || []).length >= 2
  && /slotUniqueChoice:\{\}/.test(source));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
