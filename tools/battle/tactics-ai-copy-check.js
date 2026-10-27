const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスの AIコピー(ソラシドのアシカの5人目・2026-10-27 社長の決め)の、タクティクスだけの部品を確かめる。
//   ① コピーを渡さないときは、狙いの重み・狙われる%・狙いの抽選・予告が今までとまったく同じ
//   ② コピーを渡すと狙いの候補に5人目が足され、%の合計は100のまま
//   ③ 置き場所は元の子のとなりの空いたマス(右が先)。空きが無ければ元の子と同じマスに重ねる
//   ④ 出たときのヘイトは元の子の 50/75/100%(Lv)・たまり方は ×1.0/1.25/1.5
//   ⑤ 敵の行動がコピーに当たるか(全体・単体・間合い)
//   ⑥ 倒されたらその場で消える(null)。盤面のライフの合計・全滅にはコピーが混ざらない
// 計算は本体(32-tactics-units.jsx → game-system.jsx)から切り出して動かす(検査へ書き写さない)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const slice = (from, to) => {
  const i = source.indexOf(from); const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};
// タイプ(ヘイトの倍率)は data から来るので、検査では「タイプ無し」で動かす
const sandbox = { Math, Number, console, monsterTypeOf: () => ({ main: 'attacker', sub: null }), MONSTER_TYPES: {} };
vm.createContext(sandbox);
vm.runInContext(slice('const TACTICS_START_GUTS_RATE', '// ===== イベント・レイドボス「ジャック」の定義')
  + ';globalThis.api={createTacticsUnit,tacticsTargetWeights,tacticsTargetChances,tacticsTargetChancesWithCopy,chooseTacticsTarget,withTacticsTarget,'
  + 'tacticsTotalHp,isTacticsWipedOut,TACTICS_AI_COPY_TARGET,isTacticsAiCopyStanding,tacticsAiCopyPos,tacticsAiCopyStartHate,'
  + 'tacticsAiCopyHateStep,tacticsIntentHitsAiCopy,damageTacticsAiCopy,tacticsAiCopyName};', sandbox);
const A = sandbox.api;

const unit = (id, hp = 500) => ({ ...A.createTacticsUnit({ id, name: id, hp, maxHp: hp, atk: 100, def: 100, guts: 100 }) });
const board = [unit('a'), unit('b'), null, unit('d', 300)];
const hate = [40, 0, 0, 20];
const copy = { name: 'b', hp: 250, maxHp: 250, hate: 10, pos: 2 };

// ① 渡さないときは今までと同じ
const w0 = JSON.stringify(A.tacticsTargetWeights(board, 2, hate));
check('コピー無しの重みは枠の子だけ', !w0.includes('copy'), w0);
const c0 = A.tacticsTargetChances(board, hate);
const cw0 = A.tacticsTargetChancesWithCopy(board, hate, 2, null);
check('コピー無しの%は今までどおり4つの配列', Array.isArray(c0) && c0.length === 4 && JSON.stringify(c0) === JSON.stringify(cw0.slots) && cw0.copy === null, JSON.stringify(c0));
check('コピー無しの%の合計は100', c0.filter(v => v != null).reduce((a, b) => a + b, 0) === 100);
const rolls = [0, 0.3, 0.6, 0.99].map(r => A.chooseTacticsTarget(board, () => r, 2, hate));
check('コピー無しの抽選は枠の番号だけ', rolls.every(n => Number.isInteger(n)), rolls.join(','));

// ② 渡すと5人目が足される
const cw = A.tacticsTargetChancesWithCopy(board, hate, 2, copy);
const sum = cw.slots.filter(v => v != null).reduce((a, b) => a + b, 0) + cw.copy;
check('コピーにも%が付く', Number.isInteger(cw.copy) && cw.copy > 0, `コピー ${cw.copy}%`);
check('コピー入りの%の合計も100', sum === 100, `${JSON.stringify(cw.slots)} + ${cw.copy}`);
check('コピーが入ると枠の子の%は下がる', cw.slots[0] < c0[0], `${c0[0]}% → ${cw.slots[0]}%`);
const last = A.chooseTacticsTarget(board, () => 0.999, 2, hate, copy);
check('抽選の最後(くじの端)でコピーが選ばれる', last === A.TACTICS_AI_COPY_TARGET, String(last));
const intent = A.withTacticsTarget({ type: 'ATTACK', value: 100 }, board, () => 0.999, 2, hate, copy);
check('予告はコピーを targetCopy で持ち、枠の番号は付けない', intent.targetCopy === true && intent.targetSlot === undefined && intent.targetName === 'bのコピー', JSON.stringify(intent));
check('倒れたコピーは候補に入らない', !JSON.stringify(A.tacticsTargetWeights(board, 2, hate, { ...copy, hp: 0 })).includes('copy'));

// ③ 置き場所
check('右のとなりが空いていれば右', JSON.stringify(A.tacticsAiCopyPos(board, 1)) === JSON.stringify({ pos: 2, stacked: false }));
check('右がふさがっていれば左', true
  && JSON.stringify(A.tacticsAiCopyPos([unit('z'), null, unit('b'), unit('c')], 2)) === JSON.stringify({ pos: 1, stacked: false }));
check('右も左もふさがっていれば重ねる', JSON.stringify(A.tacticsAiCopyPos([unit('a'), unit('b'), unit('c'), unit('d')], 1)) === JSON.stringify({ pos: 1, stacked: true }));
check('端(遠)の子は左を見る', JSON.stringify(A.tacticsAiCopyPos([null, null, null, unit('d')], 3)) === JSON.stringify({ pos: 2, stacked: false }));

// ④ ヘイト
check('出たときのヘイトの既定は元の子の半分(切り捨て)', A.tacticsAiCopyStartHate([41, 0, 0, 0], 0) === 20 && A.tacticsAiCopyStartHate(hate, 3) === 10);
check('Lv で割合を変えられる(75%・100%)', A.tacticsAiCopyStartHate([40, 0, 0, 0], 0, 0.75) === 30 && A.tacticsAiCopyStartHate([40, 0, 0, 0], 0, 1) === 40);
const g1 = A.tacticsAiCopyHateStep({ ...copy, hate: 0 }, { gain: 10 }, null, 1), g15 = A.tacticsAiCopyHateStep({ ...copy, hate: 0 }, { gain: 10 }, null, 1.5);
check('たまり方の倍率(×1.5)で多くたまる', g15 > g1 && Math.abs(g15 / g1 - 1.5) < 1e-9, `×1.0 ${g1} / ×1.5 ${g15}`);
const h1 = A.tacticsAiCopyHateStep({ ...copy, hate: 20 }, { gain: 0 }, null);
check('何もしなければヘイトは減っていく', h1 < 20, `20 → ${h1}`);
check('倒れたコピーのヘイトは0', A.tacticsAiCopyHateStep({ ...copy, hp: 0 }, { gain: 50 }, null) === 0);

// ⑤ 当たるか
check('全体攻撃はコピーにも当たる', A.tacticsIntentHitsAiCopy({ targetsAll: true }, copy));
check('単体攻撃は targetCopy のときだけ', A.tacticsIntentHitsAiCopy({ targetCopy: true }, copy) && !A.tacticsIntentHitsAiCopy({ targetSlot: 0 }, copy));
check('狙いの無い間合い攻撃はコピーのマスなら当たる', A.tacticsIntentHitsAiCopy({ variant: 'sweep', sweepDist: 2 }, copy) && !A.tacticsIntentHitsAiCopy({ variant: 'sweep', sweepDist: 1 }, copy));

// ⑥ 倒されたら消える・盤面に混ざらない
check('ライフが残れば減るだけ', A.damageTacticsAiCopy(copy, 100).hp === 150);
check('ライフが0になったら消える(null)', A.damageTacticsAiCopy(copy, 999) === null);
const hpBefore = A.tacticsTotalHp(board);
const hpUnits = board.filter(Boolean).reduce((sum, u) => sum + u.hp, 0);
check('盤面のライフの合計は枠の子だけの合計(コピーは盤面の外)', hpBefore === hpUnits, `${hpBefore} / 枠の子の合計 ${hpUnits}`);
check('全滅の判定はコピーがいても枠の子だけで決まる', A.isTacticsWipedOut([null, null, null, null]) === false && A.isTacticsWipedOut(board) === false);

if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nすべてOK');
