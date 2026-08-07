// 敵の行動の決まりを、実戦の抽選とSCAN表示の両方について数値で確かめる。
//
// 【なぜ道具にするか】
// 敵の行動は「見た目には動いているが、決まりどおりではない」という壊れ方をする。
// たとえば移動が連続してしまう、ためたのに必殺技が来ない、予告した移動先と
// 実際の移動先が違う、といったものは例外も出ず画面も壊れないので、
// 遊んでいて「なんか変」と気付くまで分からない。ここで機械的に押さえる。
//
// 必殺技は「ためる(CHARGE)」→「発動(SPECIAL)」の2ターン。
// ためた次のターンは必ず必殺技で、ほかの行動では上書きされない。
// 移動は、移動した次のターンには選ばれない。
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const chunk = src.slice(src.indexOf('const ENEMY_ACTION_DEFINITIONS'), src.indexOf('// 難易度選択プレビュー'));
const context = { RANGE_LABELS: ['零', '近', '中', '遠'], Math };
vm.createContext(context);
vm.runInContext(`${chunk};globalThis.api={ENEMY_ACTION_DEFINITIONS,enemyActionProbabilities,chooseEnemyAction,enemyActionStateFrom,enemyActionLabel};`, context);
const api = context.api;
const enemy = { atk: 100, normal: 'パンチ', special: '必殺' };

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const pct = (actions) => Object.fromEntries(actions.map(a => [a.id, Number((a.probability * 100).toFixed(5))]));

// --- ふつうのターン(直前が「ためる」でも「移動」でもない) ---
const normal = api.enemyActionProbabilities(enemy, 1, {});
check('ふだんの出やすさが決めたとおり',
  JSON.stringify(pct(normal)) === JSON.stringify({ normal: 50, charge: 15, special: 0, wait: 20, move: 15 }),
  JSON.stringify(pct(normal)));
check('必殺技はふだんの抽選に出てこない', normal.find(a => a.id === 'special').available === false);
check('威力倍率は必殺技だけが高い',
  JSON.stringify(normal.map(a => a.multiplier)) === JSON.stringify([1, 0, 2.5, 0, 0]),
  JSON.stringify(normal.map(a => a.multiplier)));
check('ためるターン自体にダメージは無い', normal.find(a => a.id === 'charge').multiplier === 0);

// --- ためた次のターン ---
const charging = api.enemyActionProbabilities(enemy, 1, api.enemyActionStateFrom({ type: 'CHARGE' }));
check('ためた次のターンは必殺技が100%',
  JSON.stringify(pct(charging)) === JSON.stringify({ normal: 0, charge: 0, special: 100, wait: 0, move: 0 }),
  JSON.stringify(pct(charging)));
// 乱数がどう転んでも必殺技以外にならないこと(ほかの行動で上書きしない)
const overwritten = [0, 0.25, 0.5, 0.75, 0.999]
  .map(r => api.chooseEnemyAction(enemy, 1, () => r, api.enemyActionStateFrom({ type: 'CHARGE' })).type)
  .filter(t => t !== 'SPECIAL');
check('ためた次のターンは何を引いても必殺技', overwritten.length === 0, overwritten.join(','));

// --- 移動した次のターン ---
const afterMove = api.enemyActionProbabilities(enemy, 1, api.enemyActionStateFrom({ type: 'MOVE' }));
check('移動した次のターンは移動を選ばない', afterMove.find(a => a.id === 'move').available === false);
const moveAgain = [0, 0.25, 0.5, 0.75, 0.999]
  .map(r => api.chooseEnemyAction(enemy, 1, () => r, api.enemyActionStateFrom({ type: 'MOVE' })).type)
  .filter(t => t === 'MOVE');
check('連続で移動しない', moveAgain.length === 0, `${moveAgain.length}回 移動を引いた`);
check('移動を除いたぶんは残りへ配り直される',
  Math.abs(afterMove.filter(a => a.available).reduce((s, a) => s + a.probability, 0) - 1) < 1e-9);

// --- 抽選そのもの ---
check('小さい乱数では通常攻撃', api.chooseEnemyAction(enemy, 1, () => 0, {}).type === 'ATTACK');
check('通常攻撃の次の帯はためる', api.chooseEnemyAction(enemy, 1, () => 0.51, {}).type === 'CHARGE');
let seq = [0.9, 0];
const move = api.chooseEnemyAction(enemy, 1, () => seq.shift(), {});
check('大きい乱数では移動', move.type === 'MOVE');
// 予告に出した移動先が、そのまま実行に使われること。
// ここが別々に決まっていると「近と予告して遠へ動く」という食い違いが起きる
check('移動先は予告の時点で決まる', move.targetDist === 0, `targetDist=${move.targetDist}`);
check('移動先は現在の間合い以外', [0, 0.25, 0.5, 0.75, 0.99].every(r => {
  const m = api.chooseEnemyAction(enemy, 1, () => 0.95 + r * 0.04, {});
  return m.type !== 'MOVE' || m.targetDist !== 1;
}));

// --- 見出し ---
check('必殺技は技名がそのまま出る', api.enemyActionLabel(enemy, 'SPECIAL') === '必殺');

// --- 画面側 ---
const has = (t) => src.includes(t);
check('SCANは実戦と同じ定義・同じ状態で評価する', has('enemyActionProbabilities(scanEnemy,scanDist,scanState)'));
check('SCANは「直前に何をしたか」を実戦と同じ形で渡す', has('enemyActionStateFrom(enemyLastIntent)'));
check('W1〜W10のカードから戦闘開始前のSCANを開ける', has('setWaveScanPreview({enemy,wave:index+1,difficulty:safeDifficulty})'));
check('戦闘開始前のSCANは現在の間合いを出さない', has("scanBeforeBattle?'戦闘開始前'"));
const scanBlock = src.slice(src.indexOf('(showEnemyInfo&&enemy||waveScanPreview)'), src.indexOf('showHeroInfo', src.indexOf('(showEnemyInfo&&enemy||waveScanPreview)')));
check('SCANは乱数を使わない', !scanBlock.includes('Math.random'));
// ためるターンと必殺技のターンで、演出と予測ダメージの出し分けが効いていること
check('予測ダメージが出るのは通常攻撃と必殺技だけ',
  has("if (!intent||(intent.type!=='ATTACK'&&intent.type!=='SPECIAL')) return 0;"));
check('ためるターンは専用の演出でダメージを与えない',
  has("} else if (intent.type==='CHARGE') {") && has("setEnemyAttackFx({kind:'charge'})"));
check('必殺技の警告は発動ターンの予告で出る', has("!enemyAttackFx&&enemyIntent.type==='SPECIAL'&&("));
// 準備のターンは、必殺技そのものの音と突進モーションを使わないこと。
// 同じものを使うと「準備しただけなのに撃たれた」ように見え・聞こえる
check('準備のターンは専用の音を鳴らす', has('Audio_.se.enemyCharge();') && has('enemyCharge: async () =>'));
check('準備のターンは突進せず、その場で溜める',
  has("enemyAttackFx?.kind==='charge'?'enemyChargeShake") && has('@keyframes enemyChargeShake'));
const chargeBranch = src.slice(src.indexOf("} else if (intent.type==='CHARGE') {"), src.indexOf("} else if (intent.type==='ATTACK'||intent.type==='SPECIAL') {"));
check('準備のターンに必殺技の音を鳴らさない', !chargeBranch.includes('enemySpecial'));
check('準備の見出しに技名を出さない', api.enemyActionLabel(enemy, 'CHARGE') === '必殺技の準備をしている',
  api.enemyActionLabel(enemy, 'CHARGE'));
// 移動の吹き出しは「1つ先」ではなく「2つ先」を見て出す。
// 通常攻撃などの予告と同時に出て、その次のターンに実際に動く
check('移動の吹き出しは2手先の行動から出す',
  has('mh-enemy-move-hint') && has('{RANGE_LABELS[enemyNextIntent.targetDist]}…！')
    && has("enemyNextIntent.type==='MOVE'"));
check('予告済みの行動は抽選し直さず繰り上げる',
  has('const upcoming = enemyNextIntentRef.current || getNextEnemyAction(enemy, distAfterExecuted, executedIntent);')
    && has('setEnemyIntent(upcoming);'));
check('戦闘開始時に2手ぶん用意する',
  has('const firstIntent = getNextEnemyAction(newEnemy,dist);')
    && has('reserveEnemyNextIntent(getNextEnemyAction(newEnemy,distAfterIntent(firstIntent,dist),firstIntent));'));
check('次の行動を決めるとき直前の行動を渡している',
  has('advanceEnemyIntents(executedIntent,distForNextPredict)') && has('advanceEnemyIntents(acting,distForNextPredict)'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
