const TOOLS_DIR = require('path').join(__dirname, '..');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
const prefix = source.slice(0, source.indexOf('// =====================================================================\n// AUDIO:'));
const context = {
  React: { createElement: () => null, useState(){}, useEffect(){}, useCallback(){}, useMemo(){}, useRef(){} },
  ALL_PLAYER_MONSTERS: { base: { distAptitude:['C','C','C','C'] } },
};
vm.createContext(context);
vm.runInContext(`${prefix}\nglobalThis.__cap={levelInfo,bondLevelInfo,totalBondXpForLevel,cappedBondXp,applyBondXpGain};`, context);
const { bondLevelInfo, totalBondXpForLevel, cappedBondXp, applyBondXpGain } = context.__cap;

let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
const atLevel = level => totalBondXpForLevel(level);
const gainWithAutoRepeatCap = (masu, gain, breederLevel) => applyBondXpGain(masu, gain, breederLevel);

const from49 = gainWithAutoRepeatCap({ id:'from49', baseId:'base', bondXp:atLevel(49), levelCap:100, distAptPoints:0 }, 999999, 50);
check('ブリーダーLv50ならマスモンLv49からLv50まで上がる', from49.after.level === 50 && from49.gainedLevels === 1);
const at50 = gainWithAutoRepeatCap(from49.masu, 999999, 50);
check('Lv50到達後はAUTO∞XPでLv51にならない', at50.after.level === 50 && at50.xpGain === 0);
const ownCap40 = gainWithAutoRepeatCap({ id:'own-cap', baseId:'base', bondXp:atLevel(39), levelCap:40, distAptPoints:0 }, 999999, 50);
check('個体levelCap40ならブリーダーLv50でもLv40で止まる', ownCap40.after.level === 40);
const aboveBreederXp = atLevel(90);
const already90 = gainWithAutoRepeatCap({ id:'above', baseId:'base', bondXp:aboveBreederXp, levelCap:100, distAptPoints:0 }, 999999, 70);
check('既存Lv90・ブリーダーLv70でもLvとXPを巻き戻さない', already90.after.level === 90 && already90.masu.bondXp === aboveBreederXp && already90.xpGain === 0);

const unrestricted = { id:'normal', baseId:'base', bondXp:atLevel(50), levelCap:100, distAptPoints:0 };
check('通常AUTO・手動は上限引数なしの共通処理でLv51以上へ上がれる', applyBondXpGain(unrestricted, 999999).after.level > 50);
check('チケットも上限引数なしならブリーダーLvに依存しない', applyBondXpGain(unrestricted, 150).masu.bondXp > unrestricted.bondXp);
check('AUTO∞の報酬経路だけが最新breederXpをlevelInfoで換算して上限へ渡す',
  source.includes('const autoRepeatBondLevelCap = autoRepeatRef.current ? levelInfo(breederXp).level : null;')
    && source.includes('applyBondXpGain(m, award.gain, autoRepeatBondLevelCap)'));
check('報酬量・ランキング・次周処理・保存キーを専用上限処理へ混ぜない',
  !source.slice(source.indexOf('const cappedBondXp ='), source.indexOf('// 周回終了時の絆経験値配布先')).includes('storeSet')
    && !source.slice(source.indexOf('const cappedBondXp ='), source.indexOf('// 周回終了時の絆経験値配布先')).includes('ranking'));
check('一時上限は共通XP計算を複製せずcappedBondXpへ委譲する',
  cappedBondXp(unrestricted, 999999, 50) === atLevel(50) && bondLevelInfo(cappedBondXp(unrestricted, 999999)).level > 50);

process.exit(failed ? 1 : 0);
