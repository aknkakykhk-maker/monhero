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
// 敵のidと技名は実データから取る。検査へ書き写すと、敵を入れ替えたときに見落とす
// (2026-09-21、行動表のキーがクラシックの敵idのまま残り、追加6技が丸ごと出ていなかった)
const enemySrc = fs.readFileSync(path.join(root, 'monster-hero/data/enemy-monsters.js'), 'utf8');
const imageSrc = fs.readFileSync(path.join(root, 'monster-hero/data/images/images-enemy.js'), 'utf8');
const dataCtx = {};
vm.createContext(dataCtx);
vm.runInContext(`${imageSrc}\n${enemySrc}\nglobalThis.out={TACTICS_ENEMY_DATA,TACTICS_ENEMY_SEQUENCE};`, dataCtx);
const { TACTICS_ENEMY_DATA, TACTICS_ENEMY_SEQUENCE } = dataCtx.out;
const chunk = src.slice(src.indexOf('const ENEMY_ACTION_DEFINITIONS'), src.indexOf('// 難易度選択プレビュー'));
const context = { RANGE_LABELS: ['零', '近', '中', '遠'], Math };
vm.createContext(context);
vm.runInContext(`${chunk};globalThis.api={ENEMY_ACTION_DEFINITIONS,TACTICS_ACTION_DEFINITIONS,TACTICS_ENEMY_ACTION_IDS,`
  + `TACTICS_BASE_ACTION_IDS,tacticsActionDefinitions,enemyActionProbabilities,chooseEnemyAction,`
  + `enemyActionStateFrom,enemyActionLabel,enemyActionDisplayName,tacticsEnemyActionIds,`
  + `TACTICS_DIFFICULTY_ACTION_DELTA,TACTICS_EXTRA_ACTION_ORDER,TACTICS_SUPPORT_ACTION_IDS,TACTICS_ROAR_MAX_STACKS,TACTICS_SWEEP_MULT,TACTICS_SWEEP_MISS_MULT,`
  + `TACTICS_RUSH_HITS,TACTICS_REGEN_HP_THRESHOLD,TACTICS_ALLOUT_MULT,TACTICS_PIERCE_MULT,TACTICS_RUSH_MULT,TACTICS_SWEEP_MULT,`
  + `TACTICS_ROAR_ATK_RATE,TACTICS_REGEN_RATE};`, context);
const api = context.api;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => src.includes(needle);
const screen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
const entries = fs.readFileSync(path.join(root, 'monster-hero/src/parts/22-enemy-and-bond-entries.jsx'), 'utf8');
const tacticsDef = (id) => api.TACTICS_ACTION_DEFINITIONS.find(d => d.id === id) || {};
// 満タンでない敵(再生が選べる状態)。hp/maxHp を渡さないと再生は候補から外れる
const enemyOf = (id, hpRate = 0.5) => ({
  ...(TACTICS_ENEMY_DATA[id] || { normal: 'パンチ', special: '必殺' }),
  id, atk: 100, hp: Math.floor(1000 * hpRate), maxHp: 1000,
});
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

// --- ② 「何もしないターン」は戻した(2026-09-20 ユーザー指示) ---
// ★作り始めた当初は「新モードに何もしないターンは作らない」だった。
//   倍率を下げて敵を落としにくくしたぶん、回復や立て直しに使える休みが要るので戻した。
//   既存5モードは重み20、新モードは重み10(出すぎると間延びする)
const waitDef = api.TACTICS_ACTION_DEFINITIONS.find(d => d.id === 'wait') || {};
check('新モードにも「様子を見ている」がある', waitDef.type === 'WAIT' && waitDef.weight === 10,
  `重み${waitDef.weight}`);
check('「様子を見ている」はどの敵も持つ', api.TACTICS_BASE_ACTION_IDS.includes('wait')
  && Object.keys(api.TACTICS_ENEMY_ACTION_IDS).every(id => api.tacticsActionDefinitions(id).some(d => d.id === 'wait')));
check('「様子を見ている」はダメージを持たない', waitDef.multiplier === 0 && waitDef.hits === 0);

// --- ③ 敵ごとの行動表 ---
// 敵の順は TACTICS_ENEMY_SEQUENCE。WAVEが進むほど読むことが増える並びにしてある
const ENEMY_ORDER = TACTICS_ENEMY_SEQUENCE;
const FIRST = ENEMY_ORDER[0], SECOND = ENEMY_ORDER[1], BOSS = ENEMY_ORDER[ENEMY_ORDER.length - 1];
// その技を持つ敵をWAVE順に探す。敵を入れ替えても検査が追随するよう、idを直に書かない
const firstWith = (actionId) => ENEMY_ORDER.find(id => (api.TACTICS_ENEMY_ACTION_IDS[id] || []).includes(actionId));
// ★この一致が崩れると、敵は追加6技を1つも持たなくなる。例外も画面の乱れも出ないので、ここでしか気付けない
check('行動表のキーが、タクティクスの敵の並びと過不足なく一致する',
  ENEMY_ORDER.every(id => api.TACTICS_ENEMY_ACTION_IDS[id])
    && Object.keys(api.TACTICS_ENEMY_ACTION_IDS).every(id => ENEMY_ORDER.includes(id)),
  `行動表に無い敵:${ENEMY_ORDER.filter(id => !api.TACTICS_ENEMY_ACTION_IDS[id]).join(',') || 'なし'}`
  + ` / 並びに無いキー:${Object.keys(api.TACTICS_ENEMY_ACTION_IDS).filter(id => !ENEMY_ORDER.includes(id)).join(',') || 'なし'}`);
check('10体ぶんの敵に行動が割り当てられている',
  ENEMY_ORDER.every(id => Array.isArray(api.TACTICS_ENEMY_ACTION_IDS[id]) && api.TACTICS_ENEMY_ACTION_IDS[id].length >= 1),
  ENEMY_ORDER.map(id => `${id}:${(api.TACTICS_ENEMY_ACTION_IDS[id] || []).length}`).join(' '));
check('どの敵も通常攻撃・ためる・必殺技・移動は持つ',
  ENEMY_ORDER.every(id => api.TACTICS_BASE_ACTION_IDS.every(base => idsOf(api.tacticsActionDefinitions(id)).includes(base))));
check('後のWAVEの敵ほど技が多い(最初の敵より最後の敵)',
  api.TACTICS_ENEMY_ACTION_IDS[BOSS].length > api.TACTICS_ENEMY_ACTION_IDS[FIRST].length,
  `${FIRST}${api.TACTICS_ENEMY_ACTION_IDS[FIRST].length} → ${BOSS}${api.TACTICS_ENEMY_ACTION_IDS[BOSS].length}`);
check('最後のWAVEの敵は新モードの技をすべて持つ',
  ['sweep', 'rush', 'pierce', 'roar', 'regen', 'allout'].every(id => api.TACTICS_ENEMY_ACTION_IDS[BOSS].includes(id)), BOSS);
// ★単体狙い(focus)は廃止した(2026-09-20)。必殺技と役割がかぶるため
check('単体狙いはどこにも残っていない',
  api.TACTICS_ACTION_DEFINITIONS.every(d => d.id !== 'focus' && d.variant !== 'focus')
    && Object.values(api.TACTICS_ENEMY_ACTION_IDS).every(list => !list.includes('focus')));
// 全体攻撃は後半の敵から出す。最初のWAVEから全部来ると、受け方を1つずつ覚えられない
check('全体攻撃は最初の敵には割り当てない',
  !api.TACTICS_ENEMY_ACTION_IDS[FIRST].includes('allout')
    && !api.TACTICS_ENEMY_ACTION_IDS[SECOND].includes('allout'));
check('後半の敵は全体攻撃を持つ',
  ENEMY_ORDER.slice(4).some(id => api.TACTICS_ENEMY_ACTION_IDS[id].includes('allout')));
check('知らない技idを割り当てていない',
  Object.values(api.TACTICS_ENEMY_ACTION_IDS).every(list =>
    list.every(id => api.TACTICS_ACTION_DEFINITIONS.some(def => def.id === id))));
// ★種別の呼び名は「何をする技か」が分かる言い方にする(2026-09-21 ユーザー指示
//   「薙ぎ払いじゃなんのことか分からない」「薙ぎ払いは間合い攻撃に」「咆哮は攻撃力アップに」)。
//   画面に出る技名は敵ごとのもので、ここはその種別名。SCANとヘルプにも出る
const OLD_CATEGORY_NAMES = ['薙ぎ払い', '咆哮'];
check('種別の呼び名に、分かりにくい古い言い方が残っていない',
  api.TACTICS_ACTION_DEFINITIONS.every(d => !OLD_CATEGORY_NAMES.includes(d.category)),
  api.TACTICS_ACTION_DEFINITIONS.filter(d => OLD_CATEGORY_NAMES.includes(d.category)).map(d => d.category).join(','));
check('どの技にも発動条件の説明がある(SCANへ出す)',
  api.TACTICS_ACTION_DEFINITIONS.every(d => typeof d.condition === 'string' && d.condition.length > 0));

// --- ④ ためる → 必殺技の決まりは新モードでも同じ ---
const charging = api.enemyActionProbabilities(enemyOf(BOSS), 1, { ...api.enemyActionStateFrom({ type: 'CHARGE' }), definitions: api.tacticsActionDefinitions(BOSS) });
check('ためた次のターンは必殺技だけ', availableIds(charging).join(',') === 'special');

// --- ⑤ 再生はライフが減っているときだけ ---
const regenEnemy = firstWith('regen');
const fullHp = api.enemyActionProbabilities(enemyOf(regenEnemy, 1.0), 1, { definitions: api.tacticsActionDefinitions(regenEnemy) });
const lowHp = api.enemyActionProbabilities(enemyOf(regenEnemy, 0.5), 1, { definitions: api.tacticsActionDefinitions(regenEnemy) });
check('ライフが満タンなら再生は選ばれない', !availableIds(fullHp).includes('regen'));
check('ライフが減っていれば再生を選べる', availableIds(lowHp).includes('regen'));
check('再生のしきい値は1未満(満タンでは使わない)',
  api.TACTICS_REGEN_HP_THRESHOLD > 0 && api.TACTICS_REGEN_HP_THRESHOLD <= 1, String(api.TACTICS_REGEN_HP_THRESHOLD));

// --- ⑥ 咆哮の重ねがけには上限がある ---
const roarEnemy = firstWith('roar');
const roarFresh = api.enemyActionProbabilities(enemyOf(roarEnemy), 1, { definitions: api.tacticsActionDefinitions(roarEnemy), roarStacks: 0 });
const roarMaxed = api.enemyActionProbabilities(enemyOf(roarEnemy), 1, { definitions: api.tacticsActionDefinitions(roarEnemy), roarStacks: api.TACTICS_ROAR_MAX_STACKS });
check('攻撃力アップは重ねていなければ選べる', availableIds(roarFresh).includes('roar'));
check('攻撃力アップは上限まで重ねたら選ばれない', !availableIds(roarMaxed).includes('roar'),
  `上限${api.TACTICS_ROAR_MAX_STACKS}回`);

// --- ⑦ 抽選が実際に作る intent の形 ---
// 抽選は乱数を渡して固定する。狙った技が出るまで乱数を振り、その技の intent を取り出す
const intentOf = (enemyId, actionId, state = {}) => {
  const definitions = api.tacticsActionDefinitions(enemyId);
  for (let i = 0; i < 400; i++) {
    const roll = i / 400;
    const intent = api.chooseEnemyAction(enemyOf(enemyId), 1, () => roll, { definitions, ...state });
    if (intent && intent.actionId === actionId) return intent;
  }
  return null;
};
const sweep = intentOf(firstWith('sweep'), 'sweep');
check('間合い攻撃は「いまの間合い」を予告する', !!sweep && sweep.sweepDist === 1, sweep ? `間合い${sweep.sweepDist}` : '出ませんでした');
check('間合い攻撃は外したときの威力も持ち歩く',
  !!sweep && Number.isFinite(sweep.missValue) && sweep.missValue < sweep.value,
  sweep ? `当たり${sweep.value} / 外れ${sweep.missValue}` : '');
check('間合い攻撃の威力は定義どおり',
  !!sweep && sweep.value === Math.floor(100 * api.TACTICS_SWEEP_MULT) && sweep.missValue === Math.floor(100 * api.TACTICS_SWEEP_MISS_MULT));
const rush = intentOf(firstWith('rush'), 'rush');
check('連撃は手数を持ち歩く', !!rush && rush.hits === api.TACTICS_RUSH_HITS, rush ? `${rush.hits}ヒット` : '出ませんでした');
// ★貫通撃は構えた次のターンにしか出ない(2026-09-21)。構えなしで引こうとすると出ない
const pierceState = api.enemyActionStateFrom({ type: 'PIERCE_CHARGE' });
const pierce = intentOf(firstWith('pierce'), 'pierce', pierceState);
check('貫通撃は variant で見分けられる', !!pierce && pierce.variant === 'pierce');
check('新モードの攻撃は type が ATTACK のまま(既存のダメージ計算を通すため)',
  [sweep, rush, pierce].every(intent => intent && intent.type === 'ATTACK'));
// 全体攻撃(設計 5.3)
const allout = intentOf(firstWith('allout'), 'allout');
check('全体攻撃は targetsAll を持ち歩く', !!allout && allout.targetsAll === true,
  allout ? '' : '出ませんでした');
// ★ここが崩れると「全員を殴るほうが得」になり、狙いを読む意味も供モンを連れる意味も消える。
//   もとは0.9で、4体そろうと合計×3.6と最も重い技になっていた(2026-09-20 に0.4へ)
const normalMult = (api.TACTICS_ACTION_DEFINITIONS.find(d => d.id === 'normal') || {}).multiplier;
check('全体攻撃1体あたりの威力は通常攻撃より低い',
  api.TACTICS_ALLOUT_MULT < normalMult,
  `全体×${api.TACTICS_ALLOUT_MULT} / 通常×${normalMult}`);
check('全体攻撃を4体へ撒いても、ためて撃つ必殺技より軽い',
  api.TACTICS_ALLOUT_MULT * 4 < (api.TACTICS_ACTION_DEFINITIONS.find(d => d.id === 'special') || {}).multiplier,
  `4体で合計×${(api.TACTICS_ALLOUT_MULT * 4).toFixed(1)}`);
check('全体攻撃以外の技に targetsAll を付けていない',
  api.TACTICS_ACTION_DEFINITIONS.filter(d => d.targetsAll).map(d => d.id).join(',') === 'allout',
  api.TACTICS_ACTION_DEFINITIONS.filter(d => d.targetsAll).map(d => d.id).join(','));
const roar = intentOf(roarEnemy, 'roar');
const regen = intentOf(regenEnemy, 'regen');
check('攻撃力アップ・再生はダメージを持たない', !!roar && roar.value === 0 && !!regen && regen.value === 0);
check('攻撃力アップ・再生にも見出しとアイコンが付く',
  !!roar && !!roar.label && !!roar.icon && !!regen && !!regen.label && !!regen.icon);

// --- ⑧ 実装側(バトル本体)に受け方が書かれているか ---
// 定義だけ足して実処理を忘れると、技が出ても通常攻撃と同じ挙動になってしまう
check('貫通撃はガードを無視する', has("intent.variant==='pierce' ? 0"));
// ★連撃は 0.4×3 の3ヒット。**ガード1枚につき1ヒット**を受け止める(2026-09-21 ユーザー指示
//   「連撃はガード1個で1個めのガードが出来て、2個使えば2個目までも出来る」)。
//   ガードの厚さを手数ぶん掛ける書き方(＝厚い1枚で全部止まる)が戻っていないか見る。
//   受け止める枚数の数え方そのものは tactics-units-check.js が実際に計算して確かめている
check('連撃のガードは構えた枚数ぶんのヒットを受け止める',
  has("const guardValue = intent.variant==='pierce' ? 0 : baseGuardValue;")
    && has('resolveTacticsGuardedHit(slotIncoming,rushHits,slotGuard,tacticsGuardHits(own.weight))')
    && !has("intent.variant==='rush' ? baseGuardValue"));
// ★ガードの枚数はスロットごとに持つ。厚さ(flat/mult)だけに戻ると、2枚構えても1ヒットしか止まらない
check('ガードは厚さだけでなく枚数も数える',
  has('const addGuardForSlot=(idx,flat,mult,weight)=>{')
    && has('entry.flat+=flat; entry.mult+=mult; entry.weight+=Math.max(0,Number(weight)||0);')
    && has('addGuardForSlot(slotIdx,GUARD_EVOLUTION[guardLevel].flat*effMul,GUARD_EVOLUTION[guardLevel].mult*effMul,guardCardWeight(card));'));
// ★連撃と分かるように出す(2026-09-21 ユーザー指摘「敵の連撃技が連撃表示になってない」)。
//   ガードしていないときも出す(前はガードして貫通したときだけ出ていた)
check('連撃は何ヒットかを画面に出す',
  has('if(rushHits>1){') && has('addPopup(`連撃 ${rushHits}ヒット！${coverText}`'));
check('間合い攻撃は間合いをずらすと威力が落ちる',
  has("const sweptAway = intent.variant==='sweep'") && has('value:Math.max(0,Math.floor(Number(intent.missValue)||0))'));
check('間合い攻撃の判定は距離撃で動かした先を見る',
  has('Number.isInteger(immediateEffects.forcedMoveTarget) ? immediateEffects.forcedMoveTarget : enemyDist')
    && has('distLocked:forcedMoveTarget!=null,forcedMoveTarget,'));
check('攻撃力アップは敵の攻撃を上げ、重ねた回数を数える',
  has('tacticsRoarStacksRef.current += 1') && has('atk:Math.floor(Math.max(0,Number(prev.atk)||0)*TACTICS_ROAR_ATK_RATE)'));
check('再生は敵のライフを最大値まででとどめる',
  has('hp:Math.min(Number(prev.maxHp)||0,Math.max(0,Number(prev.hp)||0)+healed)'));
check('攻撃力アップの重ねがけはWAVEごとに数え直す', has('tacticsRoarStacksRef.current=0'));
check('SCANも新モードの行動表を見る（難易度つき）',
  has('definitions:enemyActionDefinitionsFor(runMode,scanEnemy?.id,scanEnemy?.difficulty)'));
check('SCANは新モードの技を敵ごとの技名で並べる', has('const actionName=enemyActionDisplayName(scanEnemy,action);'));

// --- 咆哮の効き目を画面へ出す(2026-09-20 ユーザー指摘「咆哮の効果が分からない」) ---
// ★敵の攻撃そのものを上げて元に戻らないのに、一瞬のポップアップしか出ていなかった。
//   SCANの「バフ・デバフ・状態異常」は"なし"で固定されていて、咆哮でも嘘になっていた
check('SCANの効果欄は技の定義から出す(なしで固定しない)',
  has("バフ・デバフ・状態異常 <b>{action.effectText||'なし'}</b>")
    && !has('バフ・デバフ・状態異常 <b>なし</b>'));
const roarDef = tacticsDef('roar'), regenDef = tacticsDef('regen');
check('攻撃力アップに効果の説明がある', !!roarDef.effectText && roarDef.effectText.includes('×'), roarDef.effectText || '(なし)');
check('攻撃力アップの説明は実データから作る(数字を書き写さない)',
  roarDef.effectText.includes(String(api.TACTICS_ROAR_ATK_RATE))
    && roarDef.effectText.includes(String(api.TACTICS_ROAR_MAX_STACKS)),
  roarDef.effectText);
check('再生に効果の説明がある', !!regenDef.effectText, regenDef.effectText || '(なし)');
check('ダメージだけの技に効果の説明は足さない',
  ['normal','sweep','rush','pierce','allout','wait'].every(id => !tacticsDef(id).effectText));
check('いま何回咆哮したかを敵にも持たせる(refは画面から見えない)',
  has('const roarStacks = tacticsRoarStacksRef.current;')
    && has('*TACTICS_ROAR_ATK_RATE),roarStacks}:prev)'));
check('強化の札に敵の咆哮を出す',
  screen.includes("if(enemy?.roarStacks>0) chip('roarUp'")
    && screen.includes('`×${enemy.roarStacks}`'));

// --- 反射も狙われた子の丈夫さで返す(2026-09-20) ---
// ★incomingDmg はパーティの丈夫さから出した値。1体ずつにした今は実際に受ける量とずれる
check('反射は狙われた子ごとに数え直す',
  has('const reflectSlots=isTacticsMode(runMode)')
    && has('? tacticsIntentTargets(intent,tacticsUnitsRef.current,actingEnemyDist) : null;\n          const reflectDmg=reflectSlots'));
check('反射は狙われた全員ぶんを足して返す',
  has('reflectSlots.reduce((sum,slotIdx)=>sum+applyTurnDamageReduction(getIncomingDamageBeforeTurnReduction(intent,slotIdx)),0)'));
check('反射は返す量でスコアも撃破も決める',
  has('setCurrentWaveDamage(p=>p+reflectDmg);')
    && has('resolveEnemyDefeat({remainingHp:reflectedHp,damage:reflectDmg})')
    && !has('resolveEnemyDefeat({remainingHp:reflectedHp,damage:incomingDmg})'));
check('誰にも当たらなければ反射しない', has("if(reflectDmg<=0){"));

// --- 反射・回避・吸収の効く範囲(2026-09-20 ユーザー指示) ---
// ★分け方は「確定バフ(固有技)は味方全体、確率で出るものは狙われた子だけ」の1本。
//   同じ「反射」でも出どころで範囲が変わるので、枝を取り違えると
//   「全体攻撃を全員が避けた」「固有技を使ったのに1体しか守れない」になる
check('確定反射と確率反射を分けて持つ', has('const forcedReflect = getTurnBuff(\'reflect\',false);'));
check('味方全体の反射は確定バフか既存モードのときだけ',
  has('if (isReflect && (forcedReflect || !isTacticsMode(runMode))) {'));
check('新モードは回避を「回避！」の枝へ落とさない',
  has('} else if (isEvasion && !isTacticsMode(runMode)) {'));
// ★避けた子・反射した子は、受ける計算へ進まずそこで抜ける(枠へ出す印だけ控える)
check('避けた子・反射した子はダメージ処理を飛ばす',
  has('if(slotIdx===evadedSlot){ evadedName=tacticsTargetName(units,slotIdx); slotFx[slotIdx]={evade:true}; return; }')
    && has('if(slotIdx===reflectedSlot){') && has('slotFx[slotIdx]={reflect:true};'));
check('確率で出た反射は、その子が受けるはずだった量を返す',
  has('reflectBack+=applyTurnDamageReduction(getIncomingDamageBeforeTurnReduction(intent,slotIdx));'));
check('返すのは味方の増減を確定させてから',
  src.indexOf('currentHp=commitTacticsUnits(units);\n            if(dealt>0)') < src.indexOf('if(reflectBack>0){'));
check('確率で出た反射でも撃破を確定できる',
  has('if (await resolveEnemyDefeat({remainingHp:reflectedHp,damage:reflectBack})) return;'));
check('避けた子・反射した子がいるときは「無傷！」を出さない',
  has("if(dealt<=0&&saved<=0&&evadedSlot==null&&reflectedSlot==null) addPopup('無傷！'"));

// --- 勇者特性は「その札を出した／狙われた、その子の能力」(2026-09-20 ユーザー提案) ---
// ★ザン・エイキ・パンドラ・剣士モッチーの連撃はもともと attackerId を見て本人限定だったのに、
//   被弾側(もち肌・中二病・俊足・反射・吸収)と攻撃側(怪力・魔力開放・禁忌解錠)は
//   mainHero を見るだけ＝誰が狙われても／誰が攻撃しても効く、とちぐはぐだった。
//   タクティクスバトルは1体ずつライフを持つので、特性も**その子のもの**にそろえる。
//   効き目は勇者モンと同じ等倍。既存5モードはステータスがパーティ共通なので変えない(仕様 8.触らないもの)
check('連撃系はもともと本人限定のまま',
  entries.includes("heroId === 'Zan' && attackerId === 'Zan'")
    && entries.includes("heroId === 'Eiki' && attackerId === 'Eiki'")
    && entries.includes("heroId === 'Pandora' && attackerId === 'Pandora'")
    && entries.includes("heroId === 'KenshiMocchi' && attackerId === 'KenshiMocchi'"));
check('被弾側は狙われた子自身の特性で効かせる',
  has('const traitHeroId = !isTacticsMode(runMode) ? mainHero?.id')
    && has('      : (Number.isInteger(targetSlot) ? (tacticsUnitsRef.current[targetSlot]?.id || null) : mainHero?.id);'));
check('もち肌・中二病は traitHeroId で見る',
  has("(traitHeroId==='Ark'||traitHeroId==='Iblis')")
    && has("((traitHeroId==='Mocchi'||traitHeroId==='Mitarashi')?0.8:1.0)")
    && !has("((mainHero?.id==='Mocchi'||mainHero?.id==='Mitarashi')?0.8:1.0)"));
check('攻撃側は札を出した子自身の特性が乗る',
  has('const attackHeroId = !isTacticsMode(runMode) ? mainHero?.id : (mon?.id || null);')
    && has("let traitMult=(attackHeroId==='Golem'?1.2:1.0)")
    && has("if (attackHeroId==='Pandora' && card.type==='unique' && card.monId!=='Pandora') traitMult*=1.5;"));
// ★回避・反射・吸収は「先に受ける子を1体決めて、その子の特性で表を作る」。
//   表を引いてから避ける子を選ぶと、俊足を持っていない子が俊足ぶんの確率で避けてしまう
check('先に受ける子を1体決めてから抽選する',
  has('const defenseSlot = aimedSlots && aimedSlots.length')
    && has('          ? aimedSlots[Math.floor(Math.random()*aimedSlots.length)] : null;')
    && has('const pickDefenseSlot = () => defenseSlot;'));
check('抽選の表はその子の特性だけで作る',
  has('const defenseTable = !isTacticsMode(runMode) ? unifiedSpecialDefense : buildUnifiedSpecialDefense({')
    && has("existingEvasion:defenseHeroId==='Tiger'?50:0,")
    && has("existingReflect:defenseHeroId==='Monol'?30:0,")
    && has("existingAbsorb:(defenseHeroId==='Oboro'||defenseHeroId==='Plant')?30:0,"));
check('その表にも魂格由来のぶんは今までどおり渡す',
  /defenseTable = !isTacticsMode\(runMode\) \? unifiedSpecialDefense : buildUnifiedSpecialDefense\(\{\s*soulEvasion:soulBattleParty\.evasion,\s*soulReflect:soulBattleParty\.reflect,\s*soulAbsorb:soulBattleParty\.absorb,/.test(src));
check('抽選は1回だけ・その表を引く',
  has('rollUnifiedSpecialDefense(defenseTable,Math.random(),Math.random());')
    && (src.match(/rollUnifiedSpecialDefense\(/g) || []).length === 1);
check('中二病の回数は、持っている子が狙われたときだけ減らす',
  has("const chuuniAimed = !isTacticsMode(runMode) ? (mainHero?.id==='Ark'||mainHero?.id==='Iblis')")
    && has("      : (aimedSlots||[]).some(i=>{const id=tacticsUnitsRef.current[i]?.id;return id==='Ark'||id==='Iblis';});")
    && has("if (chuuniAimed && getWaveBuff('chuuniDmgCutUses')<2) {"));
check('避ける／返す／吸うのは表を引いた本人',
  has('const evadedSlot=isEvasion?pickDefenseSlot():null;')
    && has('const reflectedSlot=isReflect?pickDefenseSlot():null;')
    && has('const absorbSlot=isTacticsMode(runMode)?pickDefenseSlot():null;'));
check('氷海の支配者は、持っている子ごとに敵と同じ距離かを見る',
  has('const iceExtraRateAt=(slotIdx)=>{')
    && has('const withIce=applyIceRulerAutoGutsRecovery(currentAutoGutsRecovery,id,iceLockActive,slotIdx,enemyDist);')
    && has('const extra=iceExtraRateAt(slotIdx);'));
check('全員へ配る自動回復には氷海ぶんを混ぜない',
  has('tacticsRegen(autoHpRecoveryRate,isTacticsMode(runMode)?baseGutsRecoveryRate:soulAdjustedGutsRecoveryRate)'));
// ★ハムの「同時使用可能枚数+1」とスエゾーの「眼力」は、狙われた／攻撃した の枠に収まらないので別に見る
check('札の枚数ボーナスは持っている子だけが1枚多く使える',
  has('const bonusOwner=isTacticsMode(runMode)')
    && has('      ? heroCardBonusOf(mon?.id)>0')
    && has('      : (heroCardBonusOf(mainHero?.id)>0&&mon?.id===mainHero?.id);'));
check('盤面にいる持ち主の人数ぶんを heroCardBonus に数える',
  has('? tacticsAliveSlots(tacticsUnits).filter(i => heroCardBonusOf(tacticsUnits[i]?.id) > 0).length'));
check('スエゾーの眼力は、その子が攻撃したターンに1回だけ引く',
  has('usedCardEntries.some(e=>isAttackCard(e.card)&&Number.isInteger(e.slotIdx)')
    && has("        && tacticsUnitsRef.current[e.slotIdx]?.id==='Suezo')")
    && has('&& Math.random()<TACTICS_INTIMIDATE_RATE) {'));
check('新モードは敵ターン頭の威圧にスエゾーぶんを混ぜない',
  has("(!isTacticsMode(runMode)&&mainHero?.id==='Suezo')?40:0,"));

// --- ⑩ 技名は敵ごとに違う(2026-09-21 ユーザーが10体ぶんを1体ずつ決めた) ---
// ★ここが崩れると、どの敵も「間合い攻撃」「連撃」としか名乗らなくなる。
//   吹き出しもSCANもふつうに動くので、遊んでも壊れたことに気付けない
const VARIANT_IDS = ['sweep', 'rush', 'pierce', 'roar', 'regen', 'allout'];
check('10体とも通常攻撃・必殺技の名前を持つ',
  ENEMY_ORDER.every(id => (TACTICS_ENEMY_DATA[id] || {}).normal && (TACTICS_ENEMY_DATA[id] || {}).special),
  ENEMY_ORDER.filter(id => !((TACTICS_ENEMY_DATA[id] || {}).normal && (TACTICS_ENEMY_DATA[id] || {}).special)).join(',') || '');
check('10体とも追加6技ぶんの名前を持つ',
  ENEMY_ORDER.every(id => VARIANT_IDS.every(a => typeof ((TACTICS_ENEMY_DATA[id] || {}).actions || {})[a] === 'string'
    && ((TACTICS_ENEMY_DATA[id] || {}).actions || {})[a].trim().length > 0)),
  ENEMY_ORDER.filter(id => !VARIANT_IDS.every(a => ((TACTICS_ENEMY_DATA[id] || {}).actions || {})[a])).join(',') || '');
// 実際に使う技に名前が無いと、その敵だけ共通の見出しに戻る
const namelessUsed = ENEMY_ORDER.flatMap(id => (api.TACTICS_ENEMY_ACTION_IDS[id] || [])
  .filter(a => !((TACTICS_ENEMY_DATA[id] || {}).actions || {})[a]).map(a => `${id}:${a}`));
check('その敵が実際に使う技は、すべて名前を持っている', namelessUsed.length === 0, namelessUsed.join(' ') || '');
// 共通の見出し(間合い攻撃・連撃…)のままの敵が残っていないか。1体でも残ると名前を決めた意味が消える
// ★咆哮・再生は variant を持たないので、category ではなく「咆哮している」「傷を癒している」へ落ちる。
//   category だけを見ると、この2つの落ちを取りこぼす
const stillCategory = ENEMY_ORDER.flatMap(id => {
  const ent = enemyOf(id);
  return api.tacticsActionDefinitions(id)
    .filter(def => VARIANT_IDS.includes(def.id))
    .filter(def => {
      const shown = api.enemyActionDisplayName(ent, def);
      return shown === def.category || shown === api.enemyActionLabel(ent, def.type);
    })
    .map(def => `${id}:${def.id}`);
});
check('共通の見出しのままの技が1つも残っていない', stillCategory.length === 0, stillCategory.join(' ') || '');
// 通常攻撃・必殺技も含めて、同じ名前を2体で使っていないか(どの敵の技か分からなくなる)
const allNames = ENEMY_ORDER.flatMap(id => {
  const e = TACTICS_ENEMY_DATA[id] || {};
  return [e.normal, e.special, ...VARIANT_IDS.map(a => (e.actions || {})[a])].filter(Boolean).map(n => `${n}`);
});
const dupNames = allNames.filter((n, i) => allNames.indexOf(n) !== i);
check('同じ技名を2体で使っていない', dupNames.length === 0, [...new Set(dupNames)].join(',') || '');
// 抽選が作る intent の見出しも、共通の見出しではなく技名になっているか(実物で確かめる)
const bossLabels = VARIANT_IDS.map(a => {
  const intent = intentOf(BOSS, a, a === 'pierce' ? pierceState : {});
  return { a, label: intent ? String(intent.label) : '' };
});
check('最後のWAVEの敵は、6技とも技名で予告する',
  bossLabels.every(({ a, label }) => label && label.startsWith(((TACTICS_ENEMY_DATA[BOSS] || {}).actions || {})[a] || '\u0000')),
  bossLabels.map(({ a, label }) => `${a}=${label || '出ませんでした'}`).join(' / '));

// --- ⑪ 貫通撃は「構え → 次のターンに確定」(2026-09-21 ユーザー指示) ---
// ★ガードが効かない＝受け方が無い技なので、来ると分かってから距離や回避で備えられるようにした。
//   構えを飛ばして直に出るようになると、その読み合いが丸ごと消える
const pierceDef = tacticsDef('pierce'), pierceChargeDef = tacticsDef('pierceCharge');
check('貫通技準備が行動表にある', pierceChargeDef.type === 'PIERCE_CHARGE', pierceChargeDef.category || 'なし');
check('抽選に出るのは構えのほうで、貫通撃そのものは出ない',
  pierceChargeDef.weight > 0 && pierceDef.weight === 0,
  `構え${pierceChargeDef.weight} / 貫通撃${pierceDef.weight}`);
check('構えはダメージを持たない', pierceChargeDef.multiplier === 0 && pierceChargeDef.hits === 0);
check('貫通撃を持つ敵は、必ず構えも持つ',
  ENEMY_ORDER.every(id => {
    const ids = idsOf(api.tacticsActionDefinitions(id));
    return ids.includes('pierce') === ids.includes('pierceCharge');
  }));
const pierceOwner = firstWith('pierce');
const beforeCharge = api.enemyActionProbabilities(enemyOf(pierceOwner), 1, { definitions: api.tacticsActionDefinitions(pierceOwner) });
check('ふつうのターンに貫通撃は選ばれない', !availableIds(beforeCharge).includes('pierce'));
check('ふつうのターンに構えは選べる', availableIds(beforeCharge).includes('pierceCharge'));
const afterCharge = api.enemyActionProbabilities(enemyOf(pierceOwner), 1,
  { definitions: api.tacticsActionDefinitions(pierceOwner), ...pierceState });
check('構えた次のターンは貫通撃だけ', availableIds(afterCharge).join(',') === 'pierce');
check('構えた次のターンの貫通撃は100%',
  (afterCharge.find(a => a.id === 'pierce') || {}).probability === 1);
// ためると構えは別物。片方の状態がもう片方を発動させてはいけない
const afterNormalCharge = api.enemyActionProbabilities(enemyOf(pierceOwner), 1,
  { definitions: api.tacticsActionDefinitions(pierceOwner), ...api.enemyActionStateFrom({ type: 'CHARGE' }) });
check('ためた次のターンに貫通撃は出ない', availableIds(afterNormalCharge).join(',') === 'special');
const pierceChargeIntent = intentOf(pierceOwner, 'pierceCharge');
check('構えの intent はダメージ0で、アイコンが付く',
  !!pierceChargeIntent && pierceChargeIntent.value === 0 && !!pierceChargeIntent.icon,
  pierceChargeIntent ? `${pierceChargeIntent.label} ${pierceChargeIntent.icon}` : '出ませんでした');
// 構えの見出しは、その敵の貫通撃の名前から作る(「◯◯の構え」)。何が来るかを名前で分かるようにした
check('構えの見出しは、その敵の貫通撃の名前から作る',
  !!pierceChargeIntent
    && pierceChargeIntent.label === `${((TACTICS_ENEMY_DATA[pierceOwner] || {}).actions || {}).pierce}の構え`,
  pierceChargeIntent ? pierceChargeIntent.label : '');
check('実装側が構えを受け止めている(ダメージを出さず、演出だけ)',
  has("} else if (intent.type==='PIERCE_CHARGE') {"));
check('構えを止めたら、予約していた貫通撃を捨てる',
  has("if (reserved && reserved.variant === 'pierce' && !(performed && executedIntent?.type === 'PIERCE_CHARGE')) reserved = null;"));
check('画面にも構えの警告を出す', screen.includes("enemyIntent.type==='PIERCE_CHARGE'"));
// ★貫通撃の倍率は通常攻撃より低いままにする(2026-09-21 ユーザー判断)。
//   「基本相手の攻撃はガードで防げるけど貫通はおならとか反射で対策しないとだから強くするのはない」。
//   ガードも距離も効かない技なので、備え(スタン・回避・反射)を持たない編成には手の打ちようがない。
//   構えを挟むぶん1ターンあたりが軽くなるが、それを理由に上げ直さないための歯止め
check('貫通撃の倍率は通常攻撃より低い（備えが要る技なので上げない）',
  api.TACTICS_PIERCE_MULT < normalMult,
  `貫通×${api.TACTICS_PIERCE_MULT} / 通常×${normalMult}`);
check('貫通撃は全間合いから来る（間合いで外せないので、なおさら上げない）',
  pierceDef.range === '全間合い', pierceDef.range);

// --- ⑫ 難易度が上がると使える技が増える(2026-09-21 ユーザー指示) ---
const DELTA = api.TACTICS_DIFFICULTY_ACTION_DELTA;
const ATTACK_ACTION_IDS = ['sweep', 'rush', 'pierce', 'allout'];
check('難易度ごとの増減が決まっている', Object.keys(DELTA).length >= 9, `${Object.keys(DELTA).length}段階`);
check('難易度を渡さなければ基本構成のまま',
  ENEMY_ORDER.every(id => api.tacticsEnemyActionIds(id).join(',') === (api.TACTICS_ENEMY_ACTION_IDS[id] || []).join(',')));
check('知らない難易度を渡しても基本構成のまま(落ちない)',
  ENEMY_ORDER.every(id => api.tacticsEnemyActionIds(id, 'この難易度は無い').join(',') === (api.TACTICS_ENEMY_ACTION_IDS[id] || []).join(',')));
// ★難易度の並びは**本体の定義順から読む**。検査へ書き写さないのはもちろん、
//   増減の値でソートしてもいけない(値を並べ替えてしまうので、どんな値でも単調に見えて
//   「難易度が上がると減る」を素通りさせる。2026-09-21に実際そうなっていた)
const difficultyOrderFrom = (name) => {
  const i = src.indexOf(`const ${name} = `);
  if (i < 0) return [];
  const block = src.slice(i, src.indexOf('\n};', i));
  return [...block.matchAll(/^ {2}(\w+):/gm)].map(m => m[1]);
};
const sortedDiffs = [...difficultyOrderFrom('DIFFICULTY_SETTINGS'), ...difficultyOrderFrom('QUICK_EXTREME_SETTINGS')]
  .filter(d => DELTA[d] !== undefined);
check('難易度の並びを本体から読めた', sortedDiffs.length >= 9, sortedDiffs.join(','));
check('増減の表に、本体の難易度がすべて載っている',
  [...difficultyOrderFrom('DIFFICULTY_SETTINGS'), ...difficultyOrderFrom('QUICK_EXTREME_SETTINGS')]
    .every(d => DELTA[d] !== undefined),
  [...difficultyOrderFrom('DIFFICULTY_SETTINGS'), ...difficultyOrderFrom('QUICK_EXTREME_SETTINGS')]
    .filter(d => DELTA[d] === undefined).join(',') || '');
const notMonotonic = [];
for (const id of ENEMY_ORDER) {
  for (let i = 1; i < sortedDiffs.length; i += 1) {
    const prev = api.tacticsEnemyActionIds(id, sortedDiffs[i - 1]).length;
    const now = api.tacticsEnemyActionIds(id, sortedDiffs[i]).length;
    if (now < prev) notMonotonic.push(`${id}:${sortedDiffs[i - 1]}(${prev})→${sortedDiffs[i]}(${now})`);
  }
}
check('難易度が上がって技が減ることはない', notMonotonic.length === 0, notMonotonic.slice(0, 3).join(' '));
const easiest = sortedDiffs[0], hardest = sortedDiffs[sortedDiffs.length - 1];
check('いちばん易しい難易度より、いちばん難しい難易度のほうが技が多い敵がいる',
  ENEMY_ORDER.some(id => api.tacticsEnemyActionIds(id, hardest).length > api.tacticsEnemyActionIds(id, easiest).length),
  `${easiest} → ${hardest}`);
// ★1本も無いと、通常攻撃とためるだけになってこのモードの読み合いが消える
const emptyOnes = ENEMY_ORDER.flatMap(id => sortedDiffs
  .filter(d => api.tacticsEnemyActionIds(id, d).length < 1).map(d => `${id}:${d}`));
check('どの難易度でも、その敵の技が最低1本は残る', emptyOnes.length === 0, emptyOnes.slice(0, 3).join(' '));
// ★減らすときに咆哮・再生だけが残ると、易しい難易度ほど「敵が何もしてこない」ように見える
const noAttack = ENEMY_ORDER.flatMap(id => sortedDiffs
  .filter(d => !api.tacticsEnemyActionIds(id, d).some(a => ATTACK_ACTION_IDS.includes(a))).map(d => `${id}:${d}`));
check('どの難易度でも、殴ってくる技が1つは残る', noAttack.length === 0, noAttack.slice(0, 3).join(' '));
check('減らすときに先に落とすのは、殴ってこない技',
  api.TACTICS_SUPPORT_ACTION_IDS.every(a => !ATTACK_ACTION_IDS.includes(a)),
  api.TACTICS_SUPPORT_ACTION_IDS.join(','));
// 増やす順には6技すべてが入っていること(抜けがあると、その技は一生増えない)
check('増やす順に6技すべてが入っている',
  VARIANT_IDS.every(a => api.TACTICS_EXTRA_ACTION_ORDER.includes(a)),
  api.TACTICS_EXTRA_ACTION_ORDER.join(','));
// ★全体攻撃は増やす順のいちばん後ろ。早い段階で全員攻撃が来ると、受け方を1つずつ覚えられない
check('全体攻撃は増やす順のいちばん後ろ',
  api.TACTICS_EXTRA_ACTION_ORDER[api.TACTICS_EXTRA_ACTION_ORDER.length - 1] === 'allout');
check('いちばん難しい難易度では、どの敵も6技すべてを使う',
  ENEMY_ORDER.every(id => VARIANT_IDS.every(a => api.tacticsEnemyActionIds(id, hardest).includes(a))),
  ENEMY_ORDER.filter(id => api.tacticsEnemyActionIds(id, hardest).length < VARIANT_IDS.length).join(','));
check('難易度は敵そのものが持ち歩く(実戦とSCANでずれないため)',
  has('    difficulty:safeDifficulty,'));
check('実戦の行動表も難易度つきで引く',
  has('definitions:enemyActionDefinitionsFor(runMode,enemy?.id,enemy?.difficulty)')
    && has('definitions:enemyActionDefinitionsFor(runMode,newEnemy?.id,newEnemy?.difficulty)'));

// --- 何をする技かを、敵の右上へ出す(2026-09-22 ユーザー指示) ---
// 「他の技も効果が名前だけだと覚えられないから全部吹き出しで効果出しても良さそう」
//   タクティクスの敵は技に固有の名前が付いている(「かえるのうた」「しこ踏み」)ので、
//   名前だけでは連撃なのか回復なのか分からない。予告のあいだ効果を添える
{
  const defs = api.TACTICS_ACTION_DEFINITIONS;
  const battleScreen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  const missing = defs.filter(def => !def.noticeLabel);
  check('タクティクスの全技に、何をする技かの言葉がある', missing.length === 0,
    missing.map(def => def.id).join(',') || `${defs.length}技すべて`);
  // ★ここはプレイヤーが覚えるための言葉。分類名(category)をそのまま出すと
  //   「再生」「特殊行動」のように、何が起きるのか分からない言い方になる
  const noticeOf = (id) => (defs.find(def => def.id === id) || {}).noticeLabel;
  check('再生は「回復」と出す', noticeOf('regen') === '回復', String(noticeOf('regen')));
  check('連撃はヒット数まで出す', noticeOf('rush') === `${api.TACTICS_RUSH_HITS}連撃`, String(noticeOf('rush')));
  check('様子見は分かる言い方にする', noticeOf('wait') === '様子見', String(noticeOf('wait')));
  // ★貫通は「構え」と「貫通技準備」の2つの言い方が混ざっていた(2026-09-22 ユーザー指摘
  //   「予告は固有技で出て吹き出しで貫通の構えって出る…矛盾が感じる」)
  check('貫通の予告は「貫通技準備」でそろえる',
    noticeOf('pierceCharge') === '貫通技準備'
      && (defs.find(def => def.id === 'pierceCharge') || {}).category === '貫通技準備',
    String(noticeOf('pierceCharge')));
  check('画面の大きな警告も同じ言葉にする',
    battleScreen.includes('>貫 通 技 準 備</div>') && !battleScreen.includes('貫 通 の 構 え'));
  // 予告へ持ち歩いて、画面が敵の右上へ出す
  check('予告へ「何をする技か」を持たせる', has('notice:enemyActionNoticeLabel(selected)'));
  check('敵の絵の右上へ出す',
    battleScreen.includes('data-enemy-notice={enemyIntent.notice}')
      && battleScreen.includes('absolute -top-3 -right-2'));
  check('出すのはタクティクスだけ(既存5モードは今までどおり❗)',
    battleScreen.includes("enemyIntent.type==='ATTACK'&&!Array.isArray(tacticsUnits)&&"));
  check('中央に大きく出ているときは、右上へ重ねない',
    battleScreen.includes("enemyIntent.notice&&enemyIntent.type!=='PIERCE_CHARGE'&&"));
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
