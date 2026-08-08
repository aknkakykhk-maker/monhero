// 固有技ポイント(限界突破・転生で「あとで決める」を選んだときに残るぶん)を検証する。
//
//   ① 固有技が全部最大まで育っていても限界突破できる(以前はここで止まっていた)
//   ② 上げなかったぶんはポイントとして1つ残り、既存データは0から始まる
//   ③ その場で上げたときはポイントが増えない
//   ④ 転生も同じ扱い
//   ⑤ マスモンの詳細からいつでも使えて、最大の技には使えない
//   ⑥ 既存の保存キーを増やさず、マスモンの中の新しい項目として持つ
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const grab = (a, b) => source.slice(source.indexOf(a), source.indexOf(b));

// --- 本番の計算をそのまま動かす ---
const ctx = { ALL_PLAYER_MONSTERS: { Mocchi: { id:'Mocchi', unique:{ name:'もちもちアタック', baseMult:1 }, distAptitude:['C','C','C','C'], baseHp:100, baseAtk:100, baseDef:100, baseGuts:100 } } };
vm.createContext(ctx);
vm.runInContext([
  // 絆Lvの計算から寄付ダイヤの換算までを、本番の定義のまま持ってくる
  grab('const XP_CURVE_EXPONENT', 'const BOND_XP_DISCOUNT'),
  grab('const BOND_XP_DISCOUNT', 'const rosterBaseId = (entryId, masuMons)'),
  'globalThis.__m={normalizeMasuProgression,buildMasuBreakthrough,buildMasuReincarnation,resetMasuForRebirth,'
  + 'MAX_UNIQUE_SKILL_LEVEL,INITIAL_MASU_LEVEL_CAP,MAX_MASU_LEVEL_CAP,BREAKTHROUGH_LEVEL_CAP_GAIN,'
  + 'totalBondXpForLevel,masuBondLevelInfo,breakthroughItemCost,masuRebirthCost,REINCARNATE_MIN_LEVEL};',
].join('\n'), ctx);
const m = ctx.__m;

// Lv30(上限)まで育ち、固有技が最大まで行っているマスモン
const maxedMasu = {
  id: 'x', baseId: 'Mocchi', name: 'テスト',
  bondXp: m.totalBondXpForLevel(m.INITIAL_MASU_LEVEL_CAP),
  levelCap: m.INITIAL_MASU_LEVEL_CAP, rebirthCount: 0, distAptPoints: 0,
  uniqueSkillLevels: { own: m.MAX_UNIQUE_SKILL_LEVEL },
};
const plentyGold = 999999, plentyPsyche = 999;

// --- ② 既存データは0から ---
check('固有技ポイントを持たない既存データは0として読む',
  m.normalizeMasuProgression({ id:'y', baseId:'Mocchi' }).uniqueSkillPoints === 0);
check('壊れた値でも0以上の整数に落ちる',
  m.normalizeMasuProgression({ uniqueSkillPoints:-5 }).uniqueSkillPoints === 0
    && m.normalizeMasuProgression({ uniqueSkillPoints:'3' }).uniqueSkillPoints === 3
    && m.normalizeMasuProgression({ uniqueSkillPoints:NaN }).uniqueSkillPoints === 0);

// --- ① 全部最大でも限界突破できる ---
const maxedResult = m.buildMasuBreakthrough({ masu: maxedMasu, skillKey: '', gold: plentyGold, psycheOwned: plentyPsyche });
check('固有技が全部最大でも限界突破できる', maxedResult.ok === true, maxedResult.reason || '');
check('その場合はレベル上限がちゃんと上がる',
  maxedResult.ok && maxedResult.nextMasu.levelCap === m.INITIAL_MASU_LEVEL_CAP + m.BREAKTHROUGH_LEVEL_CAP_GAIN,
  maxedResult.ok ? `上限 ${maxedResult.nextMasu.levelCap}` : '');
check('上げなかったぶんは固有技ポイントとして1つ残る',
  maxedResult.ok && maxedResult.raisesSkill === false && maxedResult.nextMasu.uniqueSkillPoints === 1);
check('最大の技を選んでもポイントとして残る（止まらない）', (() => {
  const r = m.buildMasuBreakthrough({ masu: maxedMasu, skillKey: 'own', gold: plentyGold, psycheOwned: plentyPsyche });
  return r.ok && r.raisesSkill === false && r.nextMasu.uniqueSkillPoints === 1
    && r.nextMasu.uniqueSkillLevels.own === m.MAX_UNIQUE_SKILL_LEVEL;
})());

// --- ③ その場で上げたときはポイントが増えない ---
const freshMasu = { ...maxedMasu, uniqueSkillLevels: { own: 2 }, uniqueSkillPoints: 4 };
const raised = m.buildMasuBreakthrough({ masu: freshMasu, skillKey: 'own', gold: plentyGold, psycheOwned: plentyPsyche });
check('その場で上げたときは固有技のLvが1上がる',
  raised.ok && raised.raisesSkill === true && raised.nextMasu.uniqueSkillLevels.own === 3);
check('その場で上げたときはポイントが増えない',
  raised.ok && raised.nextMasu.uniqueSkillPoints === 4);
check('あとで決めるを選ぶと持っていたぶんに1つ足される', (() => {
  const r = m.buildMasuBreakthrough({ masu: freshMasu, skillKey: '', gold: plentyGold, psycheOwned: plentyPsyche });
  return r.ok && r.nextMasu.uniqueSkillPoints === 5 && r.nextMasu.uniqueSkillLevels.own === 2;
})());
// 突破そのものの条件(レベル上限に届いていること・ダイヤ・プシュケー)は今までどおり
check('上限に届いていないと今までどおり突破できない', (() => {
  const r = m.buildMasuBreakthrough({ masu: { ...maxedMasu, bondXp: 0 }, skillKey: '', gold: plentyGold, psycheOwned: plentyPsyche });
  return r.ok === false && r.reason.includes('到達後');
})());
check('ダイヤ・プシュケーが足りないときも今までどおり止まる', (() => {
  const a = m.buildMasuBreakthrough({ masu: maxedMasu, skillKey: '', gold: 0, psycheOwned: plentyPsyche });
  const b = m.buildMasuBreakthrough({ masu: maxedMasu, skillKey: '', gold: plentyGold, psycheOwned: 0 });
  return a.ok === false && a.reason.includes('ダイヤ') && b.ok === false && b.reason.includes('プシュケー');
})());

// --- ④ 転生も同じ ---
const reincMasu = {
  id: 'z', baseId: 'Mocchi', name: 'テスト2',
  bondXp: m.totalBondXpForLevel(m.REINCARNATE_MIN_LEVEL),
  levelCap: 200, rebirthCount: 5, reincarnateCount: 0, distAptPoints: 0,
  uniqueSkillLevels: { own: m.MAX_UNIQUE_SKILL_LEVEL }, uniqueSkillPoints: 2,
};
const reinc = m.buildMasuReincarnation({ masu: reincMasu, skillKey: '', gold: plentyGold });
check('固有技が全部最大でも転生できる', reinc.ok === true, reinc.reason || '');
check('転生でもポイントとして残り、転生後も持ち越す',
  reinc.ok && reinc.raisesSkill === false && reinc.nextMasu.uniqueSkillPoints === 3);
check('転生でその場で上げたときはポイントが増えない', (() => {
  const r = m.buildMasuReincarnation({ masu: { ...reincMasu, uniqueSkillLevels:{ own:1 } }, skillKey: 'own', gold: plentyGold });
  return r.ok && r.raisesSkill === true && r.nextMasu.uniqueSkillLevels.own === 2 && r.nextMasu.uniqueSkillPoints === 2;
})());
check('転生でリセットしても固有技ポイントは消えない',
  m.resetMasuForRebirth({ ...reincMasu }).uniqueSkillPoints === 2);

// --- ⑤ 画面から使える ---
check('ポイントを使う処理がある',
  has('const spendUniqueSkillPoint = (masuId, skillKey) => {')
    && has('if (normalized.uniqueSkillPoints <= 0) return null;')
    && has('if (current >= MAX_UNIQUE_SKILL_LEVEL) return null;')
    && has('uniqueSkillPoints: normalized.uniqueSkillPoints - 1,'));
check('マスモンの詳細から使える枠がある',
  has('const renderUniqueSkillPointBox = (masu, onUpdated) => {')
    && has('extraAfterApt: renderUniqueSkillPointBox(masu, updated=>setMasuMonDetail(updated)),')
    && has('extraAfterApt: renderUniqueSkillPointBox(getMasuMon(rosterDetailMon.masuId)'));
check('ポイントが無いときは枠を出さない', has('if (normalized.uniqueSkillPoints <= 0) return null;'));
check('最大まで育った技は押せない', has('const maxed=choice.level>=MAX_UNIQUE_SKILL_LEVEL;'));
// 限界突破・転生の画面に「あとで決める」がある
check('限界突破の画面であとで決められる',
  has("<button onClick={()=>setRebirthSkillKey('')}") && has('あとで決める（ポイントとして残す）'));
check('転生の画面でもあとで決められる', has("<button onClick={()=>setReincarnateSkillKey('')}"));
check('何も選ばないうちは押せない',
  has('disabled={rebirthSkillKey==null||gold<cost') && has('disabled={reincarnateSkillKey==null||gold<cost'));

// --- ⑥ 保存 ---
check('新しい保存キーを作らず、マスモンの中の項目として持つ',
  !/mh_unique_skill|mh_skill_point/.test(source)
    && has('uniqueSkillPoints: Math.max(0, Math.floor(Number(masu?.uniqueSkillPoints) || 0)),'));
check('保存はこれまでどおり mh_masu_mons へ書く',
  grab('const spendUniqueSkillPoint = (masuId, skillKey) => {', '// 強化ポイントリセットの書').includes("storeSet('mh_masu_mons', next, false)"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
