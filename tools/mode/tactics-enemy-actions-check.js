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
  + `enemyActionStateFrom,enemyActionLabel,enemyActionDisplayName,TACTICS_ROAR_MAX_STACKS,TACTICS_SWEEP_MULT,TACTICS_SWEEP_MISS_MULT,`
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
const sweep = intentOf(firstWith('sweep'), 'sweep');
check('薙ぎ払いは「いまの間合い」を予告する', !!sweep && sweep.sweepDist === 1, sweep ? `間合い${sweep.sweepDist}` : '出ませんでした');
check('薙ぎ払いは外したときの威力も持ち歩く',
  !!sweep && Number.isFinite(sweep.missValue) && sweep.missValue < sweep.value,
  sweep ? `当たり${sweep.value} / 外れ${sweep.missValue}` : '');
check('薙ぎ払いの威力は定義どおり',
  !!sweep && sweep.value === Math.floor(100 * api.TACTICS_SWEEP_MULT) && sweep.missValue === Math.floor(100 * api.TACTICS_SWEEP_MISS_MULT));
const rush = intentOf(firstWith('rush'), 'rush');
check('連撃は手数を持ち歩く', !!rush && rush.hits === api.TACTICS_RUSH_HITS, rush ? `${rush.hits}ヒット` : '出ませんでした');
const pierce = intentOf(firstWith('pierce'), 'pierce');
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
check('咆哮・再生はダメージを持たない', !!roar && roar.value === 0 && !!regen && regen.value === 0);
check('咆哮・再生にも見出しとアイコンが付く',
  !!roar && !!roar.label && !!roar.icon && !!regen && !!regen.label && !!regen.icon);

// --- ⑧ 実装側(バトル本体)に受け方が書かれているか ---
// 定義だけ足して実処理を忘れると、技が出ても通常攻撃と同じ挙動になってしまう
check('貫通撃はガードを無視する', has("intent.variant==='pierce' ? 0"));
// ★連撃は 0.6×3 の3ヒットで、ガードが届くのは1ヒットぶんだけ(2026-09-20 ユーザー指示)。
//   ガードを手数ぶん掛ける書き方が戻っていないか見る
check('連撃のガードは1ヒットぶんしか効かない',
  has("const guardValue = intent.variant==='pierce' ? 0 : baseGuardValue;")
    && has('resolveTacticsGuardedHit(slotIncoming,rushHits,slotGuard)')
    && !has("intent.variant==='rush' ? baseGuardValue"));
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
check('SCANは新モードの技を敵ごとの技名で並べる', has('const actionName=enemyActionDisplayName(scanEnemy,action);'));

// --- 咆哮の効き目を画面へ出す(2026-09-20 ユーザー指摘「咆哮の効果が分からない」) ---
// ★敵の攻撃そのものを上げて元に戻らないのに、一瞬のポップアップしか出ていなかった。
//   SCANの「バフ・デバフ・状態異常」は"なし"で固定されていて、咆哮でも嘘になっていた
check('SCANの効果欄は技の定義から出す(なしで固定しない)',
  has("バフ・デバフ・状態異常 <b>{action.effectText||'なし'}</b>")
    && !has('バフ・デバフ・状態異常 <b>なし</b>'));
const roarDef = tacticsDef('roar'), regenDef = tacticsDef('regen');
check('咆哮に効果の説明がある', !!roarDef.effectText && roarDef.effectText.includes('×'), roarDef.effectText || '(なし)');
check('咆哮の説明は実データから作る(数字を書き写さない)',
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
check('避けた子・反射した子はダメージ処理を飛ばす',
  has('if(slotIdx===evadedSlot){ evadedName=tacticsTargetName(units,slotIdx); return; }')
    && has('if(slotIdx===reflectedSlot){'));
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
// ★ここが崩れると、どの敵も「薙ぎ払い」「連撃」としか名乗らなくなる。
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
// 共通の見出し(薙ぎ払い・連撃…)のままの敵が残っていないか。1体でも残ると名前を決めた意味が消える
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
  const intent = intentOf(BOSS, a);
  return { a, label: intent ? String(intent.label) : '' };
});
check('最後のWAVEの敵は、6技とも技名で予告する',
  bossLabels.every(({ a, label }) => label && label.startsWith(((TACTICS_ENEMY_DATA[BOSS] || {}).actions || {})[a] || '\u0000')),
  bossLabels.map(({ a, label }) => `${a}=${label || '出ませんでした'}`).join(' / '));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
