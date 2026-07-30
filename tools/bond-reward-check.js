// 周回終了時の絆経験値配分を、本番ソースの計算関数と終了経路から検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const sourcePath = path.join(__dirname, '..', 'monster-hero', 'src', 'game-system.jsx');
const source = fs.readFileSync(sourcePath, 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const context = { React: { createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} } };
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.__bondRewards = { buildRunBondAwards, bondLevelInfo, levelInfo, cappedBondXp, totalBondXpForLevel };`, context);
const { buildRunBondAwards, bondLevelInfo, levelInfo, cappedBondXp, totalBondXpForLevel } = context.__bondRewards;

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
const masuMons = [
  { id:'hero', bondXp:0, levelCap:30 },
  { id:'joined', bondXp:0, levelCap:30 },
  { id:'bench', bondXp:0, levelCap:30 },
  { id:'outside', bondXp:0, levelCap:30 },
  { id:'no-xp', levelCap:30 },
];
const awards = buildRunBondAwards({
  gain:101,
  heroMasuId:'hero',
  participantMasuIds:['hero','joined','joined'],
  monsterRosterIds:['masu:hero','masu:joined','masu:bench','masu:bench','masu:no-xp','Mocchi'],
  masuMons,
});
const byId = new Map(awards.map(award => [award.masuId, award]));
check('勇者モンへ100%付与', byId.get('hero')?.gain === 101 && byId.get('hero')?.rate === 1);
check('バトル参加マスモンへ50%を切り捨てて付与', byId.get('joined')?.gain === 50 && byId.get('joined')?.rate === 0.5);
check('編成内の控えマスモンへ25%を切り捨てて付与', byId.get('bench')?.gain === 25 && byId.get('bench')?.rate === 0.25);
check('参加個体へ50%と25%を重複付与しない', awards.filter(award => award.masuId === 'joined').length === 1);
check('同一個体の複数枠を一度にまとめる', awards.filter(award => award.masuId === 'bench').length === 1);
check('編成外と絆経験値を持たない個体は対象外', !byId.has('outside') && !byId.has('no-xp'));
check('控えはリザルト表示対象にしない', byId.get('bench')?.showInResult === false && byId.get('joined')?.showInResult === true);
check('0WAVE相当の獲得0では誰にも付与しない', buildRunBondAwards({ gain:0, heroMasuId:'hero', participantMasuIds:['joined'], monsterRosterIds:['masu:bench'], masuMons }).length === 0);

const levelStartXp = totalBondXpForLevel(2) - 1;
const levelingMasu = { id:'leveling', bondXp:levelStartXp, levelCap:30 };
const before = bondLevelInfo(levelingMasu.bondXp);
const afterXp = cappedBondXp(levelingMasu, 2);
const after = bondLevelInfo(afterXp);
const pointsAfter = 3 + (after.level - before.level);
check('レベル上昇数ぶん強化ポイントを加算できる', after.level - before.level === 1 && pointsAfter === 4);
const cappedMasu = { id:'capped', bondXp:totalBondXpForLevel(30) - 1, levelCap:30 };
check('既存のレベル上限で絆経験値を打ち止める', cappedBondXp(cappedMasu, 999999) === totalBondXpForLevel(30));

check('敗北・リタイアは共通の報酬関数を呼ぶ', /await awardRunRewards\(Math\.max\(0, wave - 1\)\)/.test(source) && /setGaveUp\(true\)/.test(source));
check('通常クリアと最終クリアの報酬経路が存在する', /await awardRunRewards\(10\)/.test(source) && /waveHistory/.test(source));
check('同期ロックで終了経路からの重複付与を防ぐ', /if \(rewardsAwardedRef\.current\) return;\s*rewardsAwardedRef\.current = true;/.test(source));
check('控えを既存リザルト配列へ追加していない', /bondAwards\.filter\(award => award\.rate === 0\.5 && award\.showInResult\)/.test(source));

// リザルトで「Lv.いくつ → いくつ」「累計経験値の変化」を出すための材料
check('レベル情報が累計経験値も持つ', bondLevelInfo(1234).totalXp === 1234 && levelInfo(5678).totalXp === 5678);
check('リザルトのバーがLv変化と累計を出す',
  source.includes('Lv.{levelBefore.level} → Lv.{levelAfter.level}')
    && source.includes('累計 {totalBefore.toLocaleString()} → {totalAfter.toLocaleString()}'));
check('リザルトのダイヤが増えた分も出す', source.includes('(+{(summary.goldAfter-summary.goldBefore).toLocaleString()})'));

process.exit(failed ? 1 : 0);
