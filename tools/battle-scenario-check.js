// バトルのれんしゅう(台本どおりに動くバトル)の数値を、実際の計算式で検算する。
//
// このサンドボックスではアプリを最後まで起動できないため、実プレイでしか分からない
// 「敵が途中で倒れてしまう」「固有技で倒しきれない」「こちらが先に倒れる」といった
// 事故を、ゲーム本体と同じ式を使ってここで数値として確かめる。
//
//   ① 台本の並びが実装とかみ合っている(選ばせるもの・手札・敵の行動)
//   ② 敵は距離技＋通常攻撃では倒れない(固有技の見せ場が残る)
//   ③ 固有技で必ず倒しきれる
//   ④ こちらは倒れない・ガッツも足りる
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ゲームのデータを読む ---
const ctx = { Math };
vm.createContext(ctx);
// 敵の行動の定義(威力倍率・見出し・アイコン)は game-system.jsx にある。
// 台本もこれを見て行動を組み立てるので、本番と同じものを先に読み込んでおく
// (入れずに動かすと倍率が0扱いになり、威力の確認が素通りしてしまう)
const gs = read('monster-hero/src/game-system.jsx');
const enemyActionChunk = gs.slice(gs.indexOf('const ENEMY_ACTION_DEFINITIONS'), gs.indexOf('// 難易度選択プレビュー'));
vm.runInContext([
  read('monster-hero/data/images/images-ally.js'),
  read('monster-hero/data/images/images-enemy.js'),
  read('monster-hero/data/skills.js'),
  read('monster-hero/data/ally-monsters.js'),
  read('monster-hero/data/enemy-monsters.js'),
  read('monster-hero/data/breeder.js'),
  enemyActionChunk,
  read('monster-hero/data/assistants.js'),
  'globalThis.__d = { BATTLE_TUTORIAL_SCENARIO, battleScenarioIntent, orderDeckForScenario, ASSISTANT_BATTLE_TUTORIAL, ALL_PLAYER_MONSTERS, ENEMY_DATA, BASE_ATK_EVOLUTION, RANGE_EVOLUTION, GUARD_EVOLUTION, TEACHING_CARDS };',
].join('\n'), ctx);
const d = ctx.__d;
const sc = d.BATTLE_TUTORIAL_SCENARIO;

// game-system.jsx から、検算に要る数値だけを取り出す
const source = read('monster-hero/src/game-system.jsx');
const num = (re, label) => {
  const m = source.match(re);
  if (!m) throw new Error(`${label} を game-system.jsx から読み取れませんでした`);
  return Number(m[1]);
};
const beginnerPower = num(/Beginner:\s*\{[^}]*power:\s*([\d.]+)/, 'Beginnerの敵強度');
const critMult = num(/isCrit\?Math\.floor\(d\*\((\d+(?:\.\d+)?)\+critDmgBonus\)\)/, 'クリティカル倍率');
const distMults = (source.match(/const distMult = \[([\d.,\s]+)\]/) || [])[1];
const DIST_MULT = distMults ? distMults.split(',').map(Number) : null;

check('検算に使う数値を実装から読めている',
  Number.isFinite(beginnerPower) && Number.isFinite(critMult) && Array.isArray(DIST_MULT) && DIST_MULT.length === 4,
  `敵強度×${beginnerPower} / 会心×${critMult} / 距離補正${JSON.stringify(DIST_MULT)}`);

// --- ① 台本と実装のかみ合わせ ---
const hero = d.ALL_PLAYER_MONSTERS[sc.heroId];
check('勇者モンが実在する', !!hero, `${sc.heroId}`);
check('敵が実在する', !!d.ENEMY_DATA[sc.enemyKey], `${sc.enemyKey}`);
check('ブリーダーカードが実在する', d.TEACHING_CARDS.some(t => t.id === sc.teachingId), `${sc.teachingId}`);
check('置く距離が4枠の中にある', Number.isInteger(sc.slotIndex) && sc.slotIndex >= 0 && sc.slotIndex < 4, `${sc.slotIndex}`);
check('敵の初期距離が4枠の中にある', Number.isInteger(sc.enemyDist) && sc.enemyDist >= 0 && sc.enemyDist < 4, `${sc.enemyDist}`);
check('はじめは勇者モンと敵が同じ距離', sc.slotIndex === sc.enemyDist);

// 台本が必要とするカードが、手札と引く順にそろっているか
const steps = d.ASSISTANT_BATTLE_TUTORIAL;
const needed = steps.filter(s => s.wait === 'do' && s.need && s.need !== 'emergency' && s.need !== 'skillPicker').map(s => s.need);
const supply = [...(sc.hand || []), ...(sc.draw || [])];
const shortage = [];
const left = [...supply];
needed.forEach(n => { const at = left.indexOf(n); if (at < 0) shortage.push(n); else left.splice(at, 1); });
// 最後のトドメ(固有技)は wait:'act' なので別に数える
const finisher = 'unique';
check('操作させるカードが手札・引く順にそろっている', shortage.length === 0, shortage.join(', '));
check('トドメの固有技が配られる', supply.includes(finisher));
check('最初の5枚に必要な枚数がある', (sc.hand || []).length === 5, `${(sc.hand || []).length}枚`);
// 使う順に配られているか(1ターン1枚ずつなので、手札5枚＋引く順で間に合う)
const useOrder = [...needed, finisher];
let cursor = 0;
const orderOk = useOrder.every(n => {
  const at = supply.indexOf(n, cursor);
  if (at < 0) return false;
  cursor = 0; // 手札は5枚同時に持てるので厳密な順序までは求めない
  return true;
});
check('使う順のカードが全部そろっている', orderOk, useOrder.join(' → '));

// 敵の行動が、台本の説明(ガード→必殺技→…)と合っているか
const intents = (sc.intents || []).map(i => i.type);
check('1ターン目は攻撃予告', intents[0] === 'ATTACK', intents.join(' → '));
// 必殺技は「ためる」→「発動」の2ターン。台本もその並びになっていないと、
// 練習でオーラを溜めたまま必殺技が飛んでこない
check('2ターン目はためる', intents[1] === 'CHARGE');
check('3ターン目にためた必殺技が飛んでくる', intents[2] === 'SPECIAL', intents.join(' → '));
// 台本が返す行動が、本番と同じ形(見出し・アイコン・威力)になっていること
// 練習では敵の攻撃力を台本の値へ差し替えるので、そのときの値で組み立てる
const enemyForScript = { ...d.ENEMY_DATA[sc.enemyKey], atk: sc.enemyAtk };
const scripted = (sc.intents || []).map((_, i) => d.battleScenarioIntent(sc, i, enemyForScript, 2));
check('台本の行動を組み立てられる', scripted.every(x => x && x.type));
const chargeStep = scripted[1], specialStep = scripted[2];
check('ためるターンにダメージは無い', chargeStep.value === 0, `value=${chargeStep.value}`);
check('必殺技のターンだけ威力が乗る', specialStep.value > 0, `value=${specialStep.value}`);
check('台本の移動先が行動にそのまま入る',
  scripted.filter(x => x.type === 'MOVE').every(x => Number.isInteger(x.targetDist)));
check('緊急回復のターンに敵が移動する', intents.some(t => t === 'MOVE'));
const moveStep = (sc.intents || []).find(i => i.type === 'MOVE');
check('移動先が勇者モンと違う距離', !!moveStep && moveStep.targetDist !== sc.slotIndex,
  moveStep ? `${sc.slotIndex} → ${moveStep.targetDist}` : '移動なし');

// --- ダメージ計算(game-system.jsx の getDmg と同じ式) ---
const atkStat = hero.baseAtk, defStat = hero.baseDef, maxHp = hero.baseHp, maxGuts = hero.baseGuts;
const teaching = d.TEACHING_CARDS.find(t => t.id === sc.teachingId);
// おりょう(atk_buff)は永続の攻撃アップ。使ったあとの攻撃はすべてこの倍率が乗る
const buffMult = teaching && teaching.subType === 'atk_buff' ? 1 + teaching.baseValue : 1;
const dmg = (baseDmgMult, startDist, withBuff) =>
  Math.floor(atkStat * (DIST_MULT[Math.abs(sc.slotIndex - startDist)] || 1.0) * baseDmgMult * (withBuff ? buffMult : 1));

const rangeCard = d.RANGE_EVOLUTION[0];
const atkCard = d.BASE_ATK_EVOLUTION[0];
const uniqueMult = hero.unique.baseMult;   // evoLevel 0
const moveTo = moveStep ? moveStep.targetDist : sc.slotIndex;
// 距離技は「離れた敵」へ撃つので、指定距離と違う分だけ威力が落ちる(mult × 0.4)
const rangeDmg = dmg(rangeCard.mult * (moveTo === sc.slotIndex ? 1 : 0.4), moveTo, true);
// 距離技のあと敵は勇者モンと同じ距離へ引き戻される
const atkDmg = dmg(atkCard.mult, sc.slotIndex, true);
const uniqueDmg = dmg(uniqueMult, sc.slotIndex, true);
const maxBefore = Math.floor(rangeDmg * critMult) + Math.floor(atkDmg * critMult);
const minBefore = rangeDmg + atkDmg;

check('② 敵は固有技の前に倒れない', sc.enemyHp > maxBefore,
  `敵ライフ${sc.enemyHp} > 会心込みの最大${maxBefore}(距離技${rangeDmg}/攻撃${atkDmg})`);
check('③ 固有技で必ず倒しきれる', sc.enemyHp <= minBefore + uniqueDmg,
  `敵ライフ${sc.enemyHp} ≦ 会心なしの合計${minBefore + uniqueDmg}(固有技${uniqueDmg})`);

// --- ④ こちらは倒れない・ガッツも足りる ---
// 被ダメージ(getPredictedDamage と同じ式)。モッチー/ミタラシは特性で20%軽減
const traitCut = (sc.heroId === 'Mocchi' || sc.heroId === 'Mitarashi') ? 0.8 : 1.0;
const incoming = (mult) => Math.max(1, Math.floor(Math.max(30, sc.enemyAtk * mult - defStat * 0.15) * traitCut));
const guard = d.GUARD_EVOLUTION[0];
const guardCut = Math.floor(guard.flat + defStat * guard.mult);
const ATTACK_MULT = num(/id:'normal',type:'ATTACK',category:'通常攻撃',weight:\d+,multiplier:(\d+(?:\.\d+)?)/, '通常攻撃の倍率');
// 必殺技は「ためる(CHARGE)」→「発動(SPECIAL)」の2ターンに分かれた。
// ダメージが出るのは発動ターンだけなので、倍率はSPECIALの定義から読む
const CHARGE_MULT = num(/id:'special',type:'SPECIAL',category:'必殺技',weight:\d+,multiplier:(\d+(?:\.\d+)?)/, '必殺技の倍率');
const normalHit = Math.max(0, incoming(ATTACK_MULT) - guardCut);
const chargeHit = Math.max(0, incoming(CHARGE_MULT) - guardCut);
const totalTaken = normalHit + chargeHit;
check('④ ガードしていればこちらは倒れない', totalTaken < maxHp,
  `被ダメ合計${totalTaken}(通常${normalHit}/必殺${chargeHit}) < ライフ${maxHp}`);
check('必殺技はガードしても手ごたえがある', chargeHit > 0,
  `ガード軽減${guardCut} / 必殺技${incoming(CHARGE_MULT)} → ${chargeHit}`);
check('通常攻撃はガードで受けきれる', normalHit === 0,
  `ガード軽減${guardCut} ≧ 通常攻撃${incoming(ATTACK_MULT)}`);

// ガッツ。ガード0・教え20・距離技20・攻撃16・固有技(モンスターごと)。毎ターン5%回復
const gutsCosts = [0, 0, teaching.guts, 0, rangeCard.baseGuts, atkCard.baseGuts, hero.unique.baseGuts];
let guts = maxGuts, gutsOk = true, gutsLog = [];
gutsCosts.forEach((cost) => {
  if (guts < cost) gutsOk = false;
  guts = Math.min(maxGuts, guts - cost + Math.floor(maxGuts * 0.05));
  gutsLog.push(guts);
});
check('④ 全部の操作でガッツが足りる', gutsOk, `残り推移 ${gutsLog.join('→')}`);

// --- 敵の行動が足りているか ---
const battleDoSteps = steps.filter(s => s.at === 'BATTLE' && (s.wait === 'do' || s.wait === 'act')).length;
check('敵の行動が操作の回数ぶん用意されている', (sc.intents || []).length >= battleDoSteps - 1,
  `行動${(sc.intents || []).length}件 / 操作${battleDoSteps}回`);
check('20ターン以内に終わる', battleDoSteps <= 20, `${battleDoSteps}ターン`);

// --- ⑤ ふだんのバトルに影響しない ---
// 台本の分岐はすべて battleScenarioRef で囲む。囲み忘れると通常プレイの
// 敵の行動や手札まで固定されてしまうので、ここで数えて確かめる
const has = (needle) => source.includes(needle);
check('台本は専用の入れ物に持つ', has('const battleScenarioRef = useRef(null);'));
check('台本を入れるのは練習の開始だけ',
  (source.match(/battleScenarioRef\.current = /g) || []).length === 2
    && has("battleScenarioRef.current = (typeof BATTLE_TUTORIAL_SCENARIO !== 'undefined' && BATTLE_TUTORIAL_SCENARIO) || null;")
    && has('battleScenarioRef.current = null;'),
  `代入${(source.match(/battleScenarioRef\.current = /g) || []).length}か所`);
check('敵の行動は台本があるときだけ差し替える',
  has('const scenario = battleScenarioRef.current;\n    if (scenario && typeof battleScenarioIntent === \'function\') {')
    // 台本が無ければ通常の抽選へ落ちること。抽選には「直前に何をしたか」も渡すので、
    // 引数の並びまでは決め打ちしない
    && /return chooseEnemyAction\(ent,currentDist[,)]/.test(source));
check('手札の並びは台本があるときだけ固定する',
  has('if (scenario && typeof orderDeckForScenario === \'function\') return orderDeckForScenario(scenario, pool);')
    && has('return pool.sort(()=>Math.random()-0.5);'));
check('敵の強さを書き換えるのは台本があるときだけ',
  has('if (scenario) {\n      if (Number.isFinite(Number(scenario.enemyHp)))'));
check('選択肢を絞るのは台本があるときだけ',
  has('const scenarioPicksHero = (id) => !battleScenario || !battleScenario.heroId')
    && has('const scenarioPicksSlot = (idx) => !battleScenario || !Number.isInteger(battleScenario.slotIndex)')
    && has('const scenarioPicksTeaching = (id) => !battleScenario || !battleScenario.teachingId'));
// 予告した行動をそのまま実行することが大事なので、handleEnemyTurn へ渡す引数が
// 増えても通るように「acting を渡していること」だけを見る
check('緊急回復は予告済みの敵行動を再抽選せず実行する',
  has('const acting=enemyIntent;')
    && /await handleEnemyTurn\('none',\{\},acting[,)]/.test(source)
    && !has('const acting=scenario&&enemyIntent?enemyIntent:getNextEnemyAction(enemy,enemyDist);'));
check('緊急回復後は敵行動を終えてから次ターンを1回だけ予約する',
  has("const distForNextPredict=acting&&acting.type==='MOVE'?acting.targetDist:enemyDist;")
    && /setEnemyIntent\(getNextEnemyAction\(enemy,distForNextPredict[,)]/.test(source)
    && (source.match(/setEnemyIntent\(getNextEnemyAction\(enemy,distForNextPredict/g) || []).length === 2);
check('大きなスコアでも諦める領域を縮めない',
  has('data-battle-metrics className="shrink-0')
    && has('data-battle-score className="flex min-w-[64px]')
    && has('data-battle-controls className="flex shrink-0')
    && has('data-battle-quit disabled={!!battleTutorial}')
    && has('aria-label="諦める" className="shrink-0 w-[28px] h-[28px]'));
check('操作の記録も台本があるときだけ',
  has('const tutorialKinds=battleScenarioRef.current'));
// カードを出した瞬間ではなく、敵の行動まで終わってから次の説明へ進める。
// 早すぎると攻撃の演出中に説明が始まり、何が起きたのか分からなくなる
check('次へ進めるのは1ターンぶんを見せ終わってから',
  has('if (tutorialKinds.length) setBattleTutorialLastAction(tutorialKinds.join(\',\'));')
    && has("if (scenario) setBattleTutorialLastAction('emergency');"));
// 光る枠に position を当てると、absolute で置いている「ステータス」「緊急」が
// 本来の場所から外れて画面の中央へ落ちてしまう
check('光る枠が配置を壊さない',
  has('.is-battle-tutorial-spot{border-radius:18px;outline:3px solid')
    && !has('.is-battle-tutorial-spot{position:relative'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
