// 通常モードのUPGRADE_SKILL AUTO配分と、既存の手動・Quick経路の非変更を確認する。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}`); if (!ok) failed++; };
const slice = (from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  return start >= 0 && end > start ? source.slice(start, end) : '';
};

const helper = slice('const chooseAutoUniqueUpgradePlan', 'const INHERITED_UNIQUE_LEVEL_KEY_PREFIX');
const mod = { exports:{} };
new Function('module', `${source.match(/const MAX_UNIQUE_SKILL_LEVEL = \d+;/)[0]}\n${helper}\nmodule.exports={chooseAutoUniqueUpgradePlan,MAX_UNIQUE_SKILL_LEVEL};`)(mod);
const choose = mod.exports.chooseAutoUniqueUpgradePlan;

let result = choose([{key:'a',level:2}], 0, 8, ()=>0);
check('upgradePoints=0なら強化しない', result.remainingPoints===0 && result.levels.a===2);
result = choose([{key:'a',level:6}], 5, 8, ()=>0);
check('1技は上限まで強化し、余りを持ち越す', result.levels.a===8 && result.allocations.a===2 && result.remainingPoints===3);
result = choose([{key:'a',level:2},{key:'b',level:4}], 3, 8, (()=>{const rolls=[0.9,0,0.9];return()=>rolls.shift();})());
check('複数技を固定rngで再現できる', result.levels.a===3 && result.levels.b===6 && result.remainingPoints===0);
result = choose([{key:'a',level:7},{key:'b',level:0}], 3, 8, ()=>0);
check('Lv8到達後は候補から外す', result.levels.a===8 && result.levels.b===2);
result = choose([{key:'a',level:8},{key:'b',level:8}], 4, 8, ()=>0);
check('全技Lv8なら全ポイントを残す', result.remainingPoints===4 && result.levels.a===8 && result.levels.b===8);
check('所持ポイントと上限を超えない', Object.values(result.allocations).reduce((a,b)=>a+b,0)<=4 && Object.values(result.levels).every(v=>v<=8));
check('不正rngは失敗してポイントを確定しない', choose([{key:'a',level:0}],1,8,()=>1)===null);
check('純粋helperはReact stateと画面を変更しない', !/\bset[A-Z]|gameState|recoverGutsWithPoint/.test(helper));

const auto = slice("if(gameState==='UPGRADE_SKILL')", 'const upgradeUnique');
check('AUTOはガッツ回復を呼ばない', !/recoverGutsWithPoint|setGuts/.test(auto));
check('AUTOは最終stateを同期計算して一括反映する', auto.includes('const plan=chooseAutoUniqueUpgradePlan') && auto.indexOf('const nextOwnedUniques') < auto.indexOf('setOwnedUniques(nextOwnedUniques)'));
check('既存の次処理を1回だけ呼ぶ', (auto.match(/continueAfterUniqueUpgrade\(\)/g)||[]).length===1 && !/setGameState\(['"](?:PICK_ALLY|BATTLE)['"]\)/.test(auto));
check('既存AUTOロックを再利用する', /autoPostWaveRunningRef|autoPostWaveScheduledRef/.test(auto));
const manual = slice('const upgradeUnique =', '// 強化ポイントを使って');
const inherited = slice('const upgradeInheritedUnique =', '// 固有技の強化フェーズ');
check('AUTO OFFの＋／－処理を維持する', manual.includes('if(diff>0) setUpgradePoints(p=>p-1); else setUpgradePoints(p=>p+1);') && inherited.includes('setUpgradePoints(p=>diff>0?p-1:p+1);'));
check('手動ガッツ回復UIを維持する', source.includes('onClick={recoverGutsWithPoint}'));
const quick = slice('const rollQuickUniqueUpgrade =', 'const finishQuickJoin');
check('Quick固有技強化を維持する', quick.includes('Math.min(MAX_UNIQUE_SKILL_LEVEL, before + 1)') && source.includes('const rolled=rollQuickUniqueUpgrade(nextUniques,nextSlots);'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
