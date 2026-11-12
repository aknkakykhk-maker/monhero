// サクセス杯(モンヒロバトルの新しい大会・モンヒロサクセス 回5b)を確かめる。
//   ① 換算: 6能力 → 4能力の式(PLAN §5)・固有技 Lv・壊れた保存枠でも落ちない
//   ② 一覧: 引退した子が先・同じ種は1体・足りないぶんはベースモン・マスモンは混ざらない
//   ③ 成績: mh_suc_cup_v1 は同じ周回を二度足さない・壊れていても空から読む
//   ④ 記録とランキング: 保存キーは mh_suc_*・ランキングは Suc<難易度>・印が偽のあいだは送らない
//   ⑤ 守り: チャレンジ・プロの記録・前回のプロ編成・マスモン登録・∞周回に触れない
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const parts = path.join(root, 'monster-hero/src/parts');
const read = (f) => fs.readFileSync(path.join(parts, f), 'utf8');
const sucSrc = read('19-success-cup.jsx');
const core = read('10-core.jsx');
const sb = read('26-supabase.jsx');
const app = read('60-app.jsx');
const pick = read('67-screen-pick.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) { failed++; console.log(`NG: ${name}${detail ? ` — ${detail}` : ''}`); }
};

// --- 計算は部品をそのまま動かす ---
const ctx = {
  ALL_PLAYER_MONSTERS: {
    Mocchi: { id: 'Mocchi', name: 'モッチー', baseHp: 720, baseAtk: 140, baseDef: 140, baseGuts: 140, plusStats: { hp: 250, atk: 30, def: 30, guts: 10 }, unique: { name: 'u' } },
    Golem: { id: 'Golem', name: 'ゴーレム', baseHp: 800, baseAtk: 200, baseDef: 150, baseGuts: 120, plusStats: { hp: 200, atk: 40, def: 30, guts: 10 }, unique: { name: 'd' } },
    Kyubi: { id: 'Kyubi', name: 'キュービ', baseHp: 600, baseAtk: 160, baseDef: 120, baseGuts: 160, plusStats: { hp: 150, atk: 30, def: 20, guts: 20 }, unique: { name: 'n' } },
    Secret: { id: 'Secret', name: 'ひみつ', debugOnly: true, baseHp: 1, baseAtk: 1, baseDef: 1, baseGuts: 1, unique: { name: 's' } },
  },
  uniqueSkillAtLevel: (unique, lv) => ({ ...unique, evoLevel: lv }),
  DIFFICULTY_SETTINGS: { Beginner: {}, Easy: {}, Normal: {}, Hard: {}, Expert: {}, Master: {}, GrandMaster: {}, Hell: {}, Legend: {} },
};
vm.createContext(ctx);
vm.runInContext(`${sucSrc}\nglobalThis.__s={SUCCESS_CUP_PUBLIC_RELEASE,SUC_BOX_KEY,SUC_CUP_KEY,sucStatRatio,normalizeSucBoxMon,readSucBoxMons,sucUniqueLevelOf,convertSucMonToBattle,successCupPickList,isSucBoxBattleMon,normalizeSucCupRecord,addSucCupWin,sucCupTitlesOf,SUC_DEMO_BOX,SUCCESS_CUP_MODE,SUC_CUP_TITLE};`, ctx);
const s = ctx.__s;

// ① 換算
check('割合は 0 で ×0.8・999 で ×1.6', Math.abs(s.sucStatRatio(0) - 0.8) < 1e-9 && Math.abs(s.sucStatRatio(999) - 1.6) < 1e-9);
check('割合は範囲の外を丸める', Math.abs(s.sucStatRatio(-50) - 0.8) < 1e-9 && Math.abs(s.sucStatRatio(5000) - 1.6) < 1e-9 && Math.abs(s.sucStatRatio('x') - 0.8) < 1e-9);
const m500 = s.convertSucMonToBattle({ id: 'a', species: 'Mocchi', st: { life: 500, pow: 500, wise: 500, hit: 500, eva: 500, tough: 500 }, techs: ['t'], mast: { t: 100 } });
// PLAN の例(約1.4倍)は式と合わないので、式どおりの値(×1.2)で確かめる
check('モッチー 6能力みな500 → ライフ 864・ほか 168(×1.2)', m500 && m500.baseHp === 864 && m500.baseAtk === 168 && m500.baseDef === 168 && m500.baseGuts === 168, m500 && `${m500.baseHp}/${m500.baseAtk}/${m500.baseDef}/${m500.baseGuts}`);
check('id は種のまま・マスモンではない・保存枠の id を持つ', m500 && m500.id === 'Mocchi' && m500.masuId === undefined && m500.sucBoxId === 'a');
check('熟練100 → 固有技 Lv9(添字8)', m500 && m500.unique.evoLevel === 8 && m500.sucUniqueLv === 9);
check('技なし → 固有技 Lv1', s.sucUniqueLevelOf({ mast: [] }) === 0);
const pw = s.convertSucMonToBattle({ id: 'b', species: 'Mocchi', st: { life: 0, pow: 999, wise: 0, hit: 0, eva: 0, tough: 0 } });
check('ちからは ちから・かしこさの高い方×0.7＋低い方×0.3', pw && pw.baseAtk === Math.round(140 * (0.8 + (999 * 0.7) / 999 * 0.8)), pw && String(pw.baseAtk));
check('stats/mastery(育成中の形)も読める', !!s.convertSucMonToBattle({ id: 'c', species: 'Kyubi', stats: { life: 100 }, techs: ['x'], mastery: { x: 50 } }));
check('壊れた子は落とす(null)', [null, 1, [], {}, { id: 'x' }, { id: 'x', species: 'Mocchi' }, { id: 'x', species: 'Nope', st: {} }, { id: 'x', species: 'Secret', st: {} }]
  .every(v => s.convertSucMonToBattle(v) === null));
check('壊れた保存枠でも空の一覧', [null, 'x', {}, { mons: 'x' }, { mons: [null, 3] }].every(v => Array.isArray(s.readSucBoxMons(v)) && s.readSucBoxMons(v).length === 0));
check('未育成の合体の子(raised:false)は出られない', s.readSucBoxMons({ mons: [{ id: 'u', species: 'Mocchi', st: {}, raised: false }, { id: 'r', species: 'Mocchi', st: {} }] }).map(m => m.id).join() === 'r');

// ② 一覧
const base = Object.values(ctx.ALL_PLAYER_MONSTERS).filter(m => !m.debugOnly);
const boxMons = s.readSucBoxMons({ mons: [
  { id: 'm1', species: 'Mocchi', st: { life: 100, pow: 100, wise: 100, hit: 100, eva: 100, tough: 100 } },
  { id: 'm2', species: 'Mocchi', st: { life: 900, pow: 900, wise: 900, hit: 900, eva: 900, tough: 900 } },
] });
const list = s.successCupPickList(boxMons, [...base, { id: 'Kyubi', masuId: 'masu1' }]);
check('引退した子が先・同じ種は強い1体だけ', list[0] && list[0].sucBoxId === 'm2' && list.filter(m => m.id === 'Mocchi').length === 1);
check('足りないぶんはベースモン(その種がいない種だけ)', list.length === 3 && list.slice(1).every(m => !m.sucBoxId) && list.some(m => m.id === 'Golem'));
check('マスモンは混ざらない', list.every(m => m.masuId == null));
check('仮の子は 0・500・999 の3パターン', s.readSucBoxMons(s.SUC_DEMO_BOX).length === 3);

// ③ 成績
const r1 = s.addSucCupWin(null, { runId: 'run1', boxIds: ['m2', 'm2', '', null], difficulty: 'Hard' });
check('優勝で出た子に1回・名声が増える', r1.added && r1.record.wins.m2 === 1 && r1.record.fame === 13);
const r2 = s.addSucCupWin(r1.record, { runId: 'run1', boxIds: ['m2'], difficulty: 'Hard' });
check('同じ周回は二度足さない', !r2.added && r2.record.wins.m2 === 1 && r2.record.fame === 13);
check('周回 id が無ければ足さない', !s.addSucCupWin(null, { runId: '', boxIds: ['m2'] }).added);
check('壊れた成績は空から', JSON.stringify(s.normalizeSucCupRecord('x')) === JSON.stringify({ v: 1, wins: {}, fame: 0, runs: [] }));
check('称号「サクセス杯 優勝」が付く(二重にしない)', s.sucCupTitlesOf('m2', r1.record, [s.SUC_CUP_TITLE]).length === 1 && s.sucCupTitlesOf('m2', r1.record).includes(s.SUC_CUP_TITLE) && s.sucCupTitlesOf('m1', r1.record).length === 0);

// ④ 記録とランキング
check('印は偽のまま', s.SUCCESS_CUP_PUBLIC_RELEASE === false);
check('保存キーは回3の保存枠(読むだけ)と新しい成績キー', s.SUC_BOX_KEY === 'mh_monsuc_box_v1' && s.SUC_CUP_KEY === 'mh_suc_cup_v1');
check('記録の接頭辞は mh_suc_', /isSuccessMode\(mode\)\) \? 'mh_suc_'/.test(core));
check('ランキングは Suc<難易度>', /SUC_RANKING_PREFIX = 'Suc'/.test(sb) && /mode === 'success'\) return `\$\{SUC_RANKING_PREFIX\}/.test(sb) && /\$\{SUC_RANKING_PREFIX\}\$\{key\}/.test(sb));
check('印が偽のあいだは遊べず・ランキングも無い', /if \(id === 'success'\) return typeof SUCCESS_CUP_PUBLIC_RELEASE/.test(core) && /isSuccessMode\(mode\)\) \|\| battleModePlayable\(mode\)/.test(core));
check('送るのは modeHasRanking のときだけ', /if \(isSuccessMode\(runMode\)\) \{\s*try \{\s*let result = null;\s*if \(modeHasRanking\(runMode\)\)/.test(app));
check('絆経験値は入らない', /modeBondXpMult = \(mode\) => \(typeof isSuccessMode === 'function' && isSuccessMode\(mode\)\) \? 0/.test(core));

// ⑤ 守り
const sucScore = app.slice(app.indexOf('if (isSuccessMode(runMode)) {\n      try {'), app.indexOf('// プロモードはランキングへ載せるが'));
check('自己ベストは mh_suc_ だけ(プロ・チャレンジに触れない)', sucScore.length > 0 && !/BATTLE_MODE_PRO|setProHighScores|setHighScores|mh_hs_/.test(sucScore));
const sucClear = app.slice(app.indexOf('if (isSuccessMode(runMode)) {\n      const nextSuc'), app.indexOf('// 極限チャレンジは専用キーへ'));
check('クリア回数は mh_suc_ だけ・ミッションを進めない', sucClear.length > 0 && !/saveMissionProgress|setClearCounts|setProClearCounts|BATTLE_MODE_PRO/.test(sucClear) && /return;\s*\}\s*$/.test(sucClear));
check('成績は保存枠を書き換えず SUC_CUP_KEY へ', /storeSet\(SUC_CUP_KEY/.test(sucClear) && !/storeSet\(SUC_BOX_KEY/.test(app));
check('前回のプロ編成を書き換えない', /\/\/ サクセス杯はプロの「前回の編成」\(mh_pro_last_party\)を書き換えない\n    if \(isSuccessMode\(runMode\)\) \{/.test(app));
check('マスモン登録は出さない', /if \(isSuccessMode\(runMode\)\) return null;/.test(app));
check('∞周回のテンプレートを使わない', /if \(template && isSuccessMode\(template\.runMode\)\) return \{ ok:false/.test(app));
check('選ぶ画面はプロの形(isProPickMode)', /const isProPickMode = \(mode\) => isProMode\(mode\) \|\| mode === BATTLE_MODE_SUCCESS/.test(core) && !/isProMode\(runMode\)/.test(pick));
check('極限タブは出さない', /!isProMode\(battleMode\)&&!isSuccessMode\(battleMode\)/.test(app));

if (failed) { console.log(`サクセス杯の検査: NG ${failed}件`); process.exit(1); }
console.log('サクセス杯の検査: すべてOK');
