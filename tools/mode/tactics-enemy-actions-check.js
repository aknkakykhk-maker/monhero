const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新モード(id: tactics)の敵行動を、定義と実装の両面から確かめる。
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
// 【なぜ道具にするか】
// このモードの中身は「敵が技を使い分け、こちらが受け方を決める」ことそのものなので、
//   ・敵が何もしないターンが混ざる
//   ・ある敵だけ技を持っていない
//   ・ガードが効かないはずの貫通撃をガードで受けられてしまう
// といった壊れ方をすると、モードの意味そのものが無くなる。どれも例外を出さず画面も壊れないため、
// 遊んで気付くのは難しい。ここで機械的に押さえる。
//
// 既存モードの行動表(ENEMY_ACTION_DEFINITIONS)を巻き込んで変えていないことも、
// 同じ場所で見る(新モードは別の表として持つ、が崩れていないこと)。
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const chunk = src.slice(src.indexOf('const ENEMY_ACTION_DEFINITIONS'), src.indexOf('// 難易度選択プレビュー'));
const context = { RANGE_LABELS: ['零', '近', '中', '遠'], Math };
vm.createContext(context);
vm.runInContext(`${chunk};globalThis.api={ENEMY_ACTION_DEFINITIONS,TACTICS_ACTION_DEFINITIONS,TACTICS_ENEMY_ACTION_IDS,`
  + `TACTICS_BASE_ACTION_IDS,tacticsActionDefinitions,enemyActionProbabilities,chooseEnemyAction,`
  + `enemyActionStateFrom,enemyActionLabel,TACTICS_ROAR_MAX_STACKS,TACTICS_SWEEP_MULT,TACTICS_SWEEP_MISS_MULT,`
  + `TACTICS_RUSH_HITS,TACTICS_REGEN_HP_THRESHOLD};`, context);
const api = context.api;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => src.includes(needle);
// 満タンでない敵(再生が選べる状態)。hp/maxHp を渡さないと再生は候補から外れる
const enemyOf = (id, hpRate = 0.5) => ({ id, atk: 100, hp: Math.floor(1000 * hpRate), maxHp: 1000, normal: 'パンチ', special: '必殺' });
const idsOf = (actions) => actions.map(a => a.id);
const availableIds = (actions) => actions.filter(a => a.available).map(a => a.id);

// --- ① 既存モードの行動表を巻き込んで変えていない(回帰) ---
check('既存モードの行動表は5種のまま',
  idsOf(api.ENEMY_ACTION_DEFINITIONS).join(',') === 'normal,charge,special,wait,move',
  idsOf(api.ENEMY_ACTION_DEFINITIONS).join(','));
check('既存モードの重みも変わっていない',
  api.ENEMY_ACTION_DEFINITIONS.map(d => d.weight).join(',') === '50,15,0,20,15',
  api.ENEMY_ACTION_DEFINITIONS.map(d => d.weight).join(','));
check('既存モードの行動表に新モードの技が混ざっていない',
  api.ENEMY_ACTION_DEFINITIONS.every(d => !d.variant && d.type !== 'ROAR' && d.type !== 'REGEN'));

// --- ② 新モードは「何もしないターン」を作らない ---
check('新モードの行動表に「様子を見ている」が無い',
  api.TACTICS_ACTION_DEFINITIONS.every(d => d.type !== 'WAIT' && d.id !== 'wait'));
check('どの敵の行動表にも「様子を見ている」が無い',
  Object.keys(api.TACTICS_ENEMY_ACTION_IDS).every(id => api.tacticsActionDefinitions(id).every(d => d.type !== 'WAIT')));

// --- ③ 敵ごとの行動表 ---
// 敵の順は ENEMY_SEQUENCE。WAVEが進むほど読むことが増える並びにしてある
const ENEMY_ORDER = ['Dino', 'Gel', 'BlackDino', 'Jaakusou', 'BlueMountain', 'Gali', 'Naga', 'Lilim', 'Durahan', 'Moo'];
check('10体ぶんの敵に行動が割り当てられている',
  ENEMY_ORDER.every(id => Array.isArray(api.TACTICS_ENEMY_ACTION_IDS[id]) && api.TACTICS_ENEMY_ACTION_IDS[id].length >= 1),
  ENEMY_ORDER.map(id => `${id}:${(api.TACTICS_ENEMY_ACTION_IDS[id] || []).length}`).join(' '));
check('どの敵も通常攻撃・ためる・必殺技・移動は持つ',
  ENEMY_ORDER.every(id => api.TACTICS_BASE_ACTION_IDS.every(base => idsOf(api.tacticsActionDefinitions(id)).includes(base))));
check('後のWAVEの敵ほど技が多い(最初の敵より最後の敵)',
  api.TACTICS_ENEMY_ACTION_IDS.Moo.length > api.TACTICS_ENEMY_ACTION_IDS.Dino.length,
  `ディノ${api.TACTICS_ENEMY_ACTION_IDS.Dino.length} → ムー${api.TACTICS_ENEMY_ACTION_IDS.Moo.length}`);
check('ムーは新モードの技をすべて持つ',
  ['sweep', 'rush', 'pierce', 'roar', 'regen'].every(id => api.TACTICS_ENEMY_ACTION_IDS.Moo.includes(id)));
check('知らない技idを割り当てていない',
  Object.values(api.TACTICS_ENEMY_ACTION_IDS).every(list =>
    list.every(id => api.TACTICS_ACTION_DEFINITIONS.some(def => def.id === id))));
check('どの技にも発動条件の説明がある(SCANへ出す)',
  api.TACTICS_ACTION_DEFINITIONS.every(d => typeof d.condition === 'string' && d.condition.length > 0));

// --- ④ ためる → 必殺技の決まりは新モードでも同じ ---
const charging = api.enemyActionProbabilities(enemyOf('Moo'), 1, { ...api.enemyActionStateFrom({ type: 'CHARGE' }), definitions: api.tacticsActionDefinitions('Moo') });
check('ためた次のターンは必殺技だけ', availableIds(charging).join(',') === 'special');

// --- ⑤ 再生はライフが減っているときだけ ---
const fullHp = api.enemyActionProbabilities(enemyOf('Lilim', 1.0), 1, { definitions: api.tacticsActionDefinitions('Lilim') });
const lowHp = api.enemyActionProbabilities(enemyOf('Lilim', 0.5), 1, { definitions: api.tacticsActionDefinitions('Lilim') });
check('ライフが満タンなら再生は選ばれない', !availableIds(fullHp).includes('regen'));
check('ライフが減っていれば再生を選べる', availableIds(lowHp).includes('regen'));
check('再生のしきい値は1未満(満タンでは使わない)',
  api.TACTICS_REGEN_HP_THRESHOLD > 0 && api.TACTICS_REGEN_HP_THRESHOLD <= 1, String(api.TACTICS_REGEN_HP_THRESHOLD));

// --- ⑥ 咆哮の重ねがけには上限がある ---
const roarFresh = api.enemyActionProbabilities(enemyOf('Durahan'), 1, { definitions: api.tacticsActionDefinitions('Durahan'), roarStacks: 0 });
const roarMaxed = api.enemyActionProbabilities(enemyOf('Durahan'), 1, { definitions: api.tacticsActionDefinitions('Durahan'), roarStacks: api.TACTICS_ROAR_MAX_STACKS });
check('咆哮は重ねていなければ選べる', availableIds(roarFresh).includes('roar'));
check('咆哮は上限まで重ねたら選ばれない', !availableIds(roarMaxed).includes('roar'),
  `上限${api.TACTICS_ROAR_MAX_STACKS}回`);

// --- ⑦ 抽選が実際に作る intent の形 ---
// 抽選は乱数を渡して固定する。狙った技が出るまで乱数を振り、その技の intent を取り出す
const intentOf = (enemyId, actionId) => {
  const definitions = api.tacticsActionDefinitions(enemyId);
  for (let i = 0; i < 400; i++) {
    const roll = i / 400;
    const intent = api.chooseEnemyAction(enemyOf(enemyId), 1, () => roll, { definitions });
    if (intent && intent.actionId === actionId) return intent;
  }
  return null;
};
const sweep = intentOf('Moo', 'sweep');
check('薙ぎ払いは「いまの間合い」を予告する', !!sweep && sweep.sweepDist === 1, sweep ? `間合い${sweep.sweepDist}` : '出ませんでした');
check('薙ぎ払いは外したときの威力も持ち歩く',
  !!sweep && Number.isFinite(sweep.missValue) && sweep.missValue < sweep.value,
  sweep ? `当たり${sweep.value} / 外れ${sweep.missValue}` : '');
check('薙ぎ払いの威力は定義どおり',
  !!sweep && sweep.value === Math.floor(100 * api.TACTICS_SWEEP_MULT) && sweep.missValue === Math.floor(100 * api.TACTICS_SWEEP_MISS_MULT));
const rush = intentOf('Dino', 'rush');
check('連撃は手数を持ち歩く', !!rush && rush.hits === api.TACTICS_RUSH_HITS, rush ? `${rush.hits}ヒット` : '出ませんでした');
const pierce = intentOf('Lilim', 'pierce');
check('貫通撃は variant で見分けられる', !!pierce && pierce.variant === 'pierce');
check('新モードの攻撃は type が ATTACK のまま(既存のダメージ計算を通すため)',
  [sweep, rush, pierce].every(intent => intent && intent.type === 'ATTACK'));
const roar = intentOf('Durahan', 'roar');
const regen = intentOf('Lilim', 'regen');
check('咆哮・再生はダメージを持たない', !!roar && roar.value === 0 && !!regen && regen.value === 0);
check('咆哮・再生にも見出しとアイコンが付く',
  !!roar && !!roar.label && !!roar.icon && !!regen && !!regen.label && !!regen.icon);

// --- ⑧ 実装側(バトル本体)に受け方が書かれているか ---
// 定義だけ足して実処理を忘れると、技が出ても通常攻撃と同じ挙動になってしまう
check('貫通撃はガードを無視する', has("intent.variant==='pierce' ? 0"));
check('連撃はガードが手数ぶん効く', has("intent.variant==='rush' ? baseGuardValue*Math.max(1,Math.floor(Number(intent.hits)||1))"));
check('薙ぎ払いは間合いをずらすと威力が落ちる',
  has("const sweptAway = intent.variant==='sweep'") && has('value:Math.max(0,Math.floor(Number(intent.missValue)||0))'));
check('薙ぎ払いの判定は距離撃で動かした先を見る',
  has('Number.isInteger(immediateEffects.forcedMoveTarget) ? immediateEffects.forcedMoveTarget : enemyDist')
    && has('distLocked:forcedMoveTarget!=null,forcedMoveTarget,'));
check('咆哮は敵の攻撃を上げ、重ねた回数を数える',
  has('tacticsRoarStacksRef.current += 1') && has('atk:Math.floor(Math.max(0,Number(prev.atk)||0)*TACTICS_ROAR_ATK_RATE)'));
check('再生は敵のライフを最大値まででとどめる',
  has('hp:Math.min(Number(prev.maxHp)||0,Math.max(0,Number(prev.hp)||0)+healed)'));
check('咆哮の重ねがけはWAVEごとに数え直す', has('tacticsRoarStacksRef.current=0'));
check('SCANも新モードの行動表を見る', has('definitions:enemyActionDefinitionsFor(runMode,scanEnemy?.id)'));
check('SCANは新モードの技を技名で並べる', has("action.variant?action.category:enemyActionLabel(scanEnemy,action.type)"));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
