const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const source = fs.readFileSync(path.join(TOOLS_DIR, '../monster-hero/src/game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
const grab = (from, to) => source.slice(source.indexOf(from), source.indexOf(to));
const ctx = { MAX_MASU_LEVEL_CAP:200, INITIAL_MASU_LEVEL_CAP:30 };
vm.createContext(ctx);
// 超越(Lv上限を伸ばす育成)の定数・正規化。normalizeMasuProgression がLv上限の判定に使う
vm.runInContext(`${grab('const TRANSCEND_LEVEL_CAP =', '// --- マスモンの絆レベル')}\n${grab('const REINCARNATE_POINTS =', 'const applyUniqueSkillPointPlan =')}globalThis.x={normalizeMasuProgression,transferableReincarnateBonus};`, ctx);
const { normalizeMasuProgression: normalize, transferableReincarnateBonus: transfer } = ctx.x;

const cases = [
  [{ reincarnateCount:0 }, 0, 0],
  [{ reincarnateCount:3 }, 30, 3],
  [{ reincarnateCount:4, reincarnateBonusPoints:37 }, 37, 4],
  [{ reincarnateCount:4, reincarnateBonusPoints:37, inheritedReincarnateBonusPoints:18, inheritedReincarnateCount:2 }, 55, 6],
];
cases.forEach(([masu, points, count], i) => { const got=transfer(masu); check(`継承計算ケース${i+1}`, got.points===points && got.count===count); });
check('旧セーブは回数×当時の10Pへ一度だけ正規化', normalize({ reincarnateCount:3 }).reincarnateBonusPoints===30);
check('保存済み実ボーナスは回数から再計算しない', normalize({ reincarnateCount:3, reincarnateBonusPoints:27 }).reincarnateBonusPoints===27);

const fusion = grab('const executeMasuFusion =', 'const resetFusionFlow =');
check('通常合体と同時限界突破が共通確定処理を使う', source.includes('executeMasuFusion(true)') && source.includes('executeMasuFusion(false)'));
check('二重実行ロックを継承加算前に取得', fusion.indexOf('fusionProcessingRef.current = true') < fusion.indexOf('transferableReincarnateBonus(sub)'));
check('副削除と主への加算を同じnextで確定', fusion.includes('.filter(m => m.id !== sub.id)') && fusion.includes('inheritedReincarnateBonusPoints: inheritedReincarnateBonusPointsOf(m) + reincarnateTransfer.points'));
check('主の転生回数・Lvを継承値で変更しない', !fusion.includes('reincarnateCount:') && !fusion.includes('REINCARNATE_LEVEL_DROP'));
check('通常強化・距離適性・固有技を丸ごと移さない', !fusion.includes('sub.statPoints') && !fusion.includes('sub.distApt') && !fusion.includes('sub.uniqueSkillPoints'));
check('継承Pだけを未使用強化ポイントへ加算', fusion.includes('distAptPoints: advanced.masu.distAptPoints + reincarnateTransfer.points'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
