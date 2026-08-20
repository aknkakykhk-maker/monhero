const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 間合い適性が「距離ごとの与ダメージ補正(%)」として扱われ、編成全員ぶんが
// 置いた距離に関係なく4距離すべてへ加算されることを確認する。
//
// 旧仕様: 攻撃したモンスター自身のグレードだけを見て、合流時はグレードを段階シフトしていた。
// 新仕様: 勇者モンを含む編成全員の補正値(%)を距離ごとに合計し、その距離で攻撃する全員に効く。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiledRaw = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const compiled = compiledRaw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 補正値の計算は本番の定義をそのまま動かして確かめる ---
const grab = (startNeedle, endNeedle) => source.slice(source.indexOf(startNeedle), source.indexOf(endNeedle));
const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  grab('const RANGE_LABELS =', 'const rangeAttackDamageMultiplier'),
  grab('const DIST_APTITUDE_GRADES =', 'const DIST_APTITUDE_COLOR'),
  grab('const aptGradeToPct =', '// マスモンが「これまでに得たはずの強化ポイント総数」'),
  'globalThis.__m={aptGradeToPct,getMonsterAptPct,formatAptPct,formatAptBonus};',
].join('\n'), ctx);
const m = ctx.__m;

check('Cは±0%', m.aptGradeToPct('C') === 0);
check('Mは+25%', Math.abs(m.aptGradeToPct('M') - 0.25) < 1e-9);
check('Gは-20%', Math.abs(m.aptGradeToPct('G') + 0.20) < 1e-9);
check('Bは+5%', Math.abs(m.aptGradeToPct('B') - 0.05) < 1e-9);
check('未知のグレードは±0%', m.aptGradeToPct('???') === 0);

const allC = { distAptitude: ['C', 'C', 'C', 'C'] };
const zeroB = { distAptitude: ['B', 'C', 'C', 'C'] };
const zeroM = { distAptitude: ['M', 'C', 'C', 'C'] };

check('オールCの補正は全距離0', m.getMonsterAptPct(allC).every(v => v === 0));
const near = (a, b) => Math.abs(a - b) < 1e-9;
check('零だけBなら零だけ+5%', near(m.getMonsterAptPct(zeroB)[0], 0.05) && m.getMonsterAptPct(zeroB).slice(1).every(v => v === 0));
check('オールCは合流ボーナス欄に何も出さない', m.formatAptBonus(allC) === '');
check('補正は%で表示する', m.formatAptBonus(zeroM) === '零+25%', m.formatAptBonus(zeroM));
check('マイナスの補正も%で表示する', m.formatAptBonus({ distAptitude: ['G', 'C', 'C', 'C'] }) === '零-20%');
check('小数の補正は小数第1位まで', m.formatAptPct(0.175) === '+17.5%' && m.formatAptPct(0.25) === '+25%');

// 編成全員ぶんの合計 = 実処理と同じ足し方
const partyPct = (party) => party.reduce((sum, mon) => sum.map((v, i) => v + m.getMonsterAptPct(mon)[i]), [0, 0, 0, 0]);
check('勇者モンの補正も全距離に入る', near(partyPct([zeroM])[0], 0.25) && partyPct([zeroM]).slice(1).every(v => v === 0));
check('編成人数ぶん積み上がる', Math.abs(partyPct([zeroM, zeroM, zeroB])[0] - 0.55) < 1e-9, `${partyPct([zeroM, zeroM, zeroB])[0]}`);
check('マイナス適性は差し引かれる', Math.abs(partyPct([zeroM, { distAptitude: ['G', 'C', 'C', 'C'] }])[0] - 0.05) < 1e-9);

// 仕様の例: 勇者モンが零C、ウェーブ報酬で零の補正が+6%。そこへ零Mが合流すると+31%
const waveBonus = [0.06, 0, 0, 0];
const before = partyPct([allC]).map((v, i) => v + waveBonus[i]);
const after = partyPct([allC, zeroM]).map((v, i) => v + waveBonus[i]);
check('例: 零+6%のところへ零Mが合流すると+31%',
  Math.abs(before[0] - 0.06) < 1e-9 && Math.abs(after[0] - 0.31) < 1e-9,
  `${m.formatAptPct(before[0])} → ${m.formatAptPct(after[0])}`);
check('例: 置いていない距離の補正は変わらない', after[1] === before[1] && after[2] === before[2] && after[3] === before[3]);

// --- 画面・実処理の結線 ---
for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  // 配信用JSはBabelが空白を入れ直すため、空白を除いた形で照合する
  const flat = code.replace(/\s+/g, '');
  check(`${label}: 距離ごとの合計補正を1か所で出す`, flat.includes('distTotalBonus=(dist,aptOverride=null)'));
  check(`${label}: ダメージ計算は距離枠の合計補正を使う`, flat.includes('distBonusMult=1.0+(distDmgBonus[slotIdx]||0)+(distAptPct[slotIdx]||0)'));
  check(`${label}: 攻撃側モンスター自身のグレードだけを見ていない`, !flat.includes('aptBonus=DIST_APTITUDE_MULT[getDistAptitude(mon,slotIdx)]-1.0'));
  check(`${label}: グレードは段階シフトしない`, /getDistAptitude=\(mon,slotIdx\)=>\(?mon&&mon\.distAptitude&&mon\.distAptitude\[slotIdx\]\)?\|\|'C'/.test(flat));
  check(`${label}: 技レベルの判定も合計補正を使う`, flat.includes('pct=distTotalBonus(dist,aptOverride)*100'));
  check(`${label}: 勇者モンの適性を編成へ入れる`, flat.includes('setDistAptPct(getMonsterAptPct(m))'));
  check(`${label}: 供モン合流で加算する`, flat.includes('setDistAptPct(prev=>prev.map((v,i)=>v+aptDelta[i]))'));
  check(`${label}: 旧仕様の段階加算が残っていない`, !code.includes('distAptBonus') && !code.includes('getMonsterAptDelta') && !code.includes('aptGradeToDelta'));
  check(`${label}: ダメージ計算の再計算条件に補正値を入れる`, flat.includes('waveBuffs,distDmgBonus,distAptPct]'));
}

// 表示
check('詳細に補正値(%)を出す', has('{formatAptPct(pct)}'));
check('詳細に「現在 → 合流後」を出す', has('現在 {formatAptPct(cur)}') && has('→ {formatAptPct(cur+pct)}'));
check('勇者モン選択・供モン合流でいまの補正値を渡す', has('aptCurrentPct: [0,1,2,3].map(i=>distTotalBonus(i)),'));
check('全距離にかかることを詳細で説明する', has('置く距離に関係なく、このモンスターの補正が4距離すべてに加算されます'));
check('スロットのバッジも合計補正を出す', has('const totalBonus=distTotalBonus(i);'));
// 補正0%も「補正が無い」という情報なので、枠ごとに常に出す
check('補正0%でもバッジを出す', has('const totalBonus=distTotalBonus(i); return(<div') && !has('return totalBonus!==0&&'));
check('WAVEリザルトの適性込み合計も編成合計を使う', has('const aptPct=(distAptPct[i]||0)*100;'));
check('マスモン強化でも補正値(%)を出す', (source.match(/formatAptPct\(aptGradeToPct\(/g) || []).length >= 3);
// ヘルプの本文は data/help.js にデータとして持っている
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
check('ヘルプが新しい仕様を説明している',
  helpSrc.includes('置いた距離だけでなく4つの距離すべて') && helpSrc.includes('零距離の補正は+31%になります'));
check('ヘルプから旧仕様の段階表記を消した', !helpSrc.includes('Aなら+2段階、Eなら-2段階') && !has('Aなら+2段階、Eなら-2段階'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
