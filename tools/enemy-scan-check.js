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

// --- 予告を出していない場面 ---
// 移動は必ず前のターンに吹き出しで予告してから行う。予告を出す機会が無かった直後
//   ・戦闘開始の1ターン目(実際に開幕から動いてしまっていた)
//   ・必殺技の準備をスタンで止めて、予約していた行動を引き直したとき
//     (こちらも実際に、止めた次のターンにいきなり移動が来ていた)
// には移動を選んではいけない
const unannounced = api.enemyActionProbabilities(enemy, 1, { unannounced: true });
check('予告を出していないターンの次は移動を選ばない', unannounced.find(a => a.id === 'move').available === false,
  unannounced.find(a => a.id === 'move').unavailableReason);
check('移動ぶんの出やすさは残りへ配り直す',
  JSON.stringify(pct(unannounced)) === JSON.stringify({ normal: 58.82353, charge: 17.64706, special: 0, wait: 23.52941, move: 0 }),
  JSON.stringify(pct(unannounced)));
const openings = Array.from({ length: 2000 }, (_, i) => api.chooseEnemyAction(enemy, 1, () => i / 2000, { unannounced: true }).type);
check('どんな乱数でも予告なしの移動にならない', !openings.includes('MOVE'),
  `出た行動: ${Array.from(new Set(openings)).join(' / ')}`);

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
  has('mh-enemy-move-hint') && has('{RANGE_LABELS[enemyNextIntent.targetDist]}距離')
    && has("enemyNextIntent.type==='MOVE'"));
// 吹き出しは行き先まで文章で書く(「近…！」だけでは何が起きるのか読み取れなかった)
check('吹き出しに行き先と、何が起きるかを書く', has('{RANGE_LABELS[enemyNextIntent.targetDist]}距離に移動しようとしている…？'));
// 大きいと敵の絵を隠してしまうので、画面下の行動予告バッジと同じ大きさで右へ寄せる
check('吹き出しは行動予告と同じ大きさで右へ寄せる',
  /font-size: 9px; font-weight: 1000;/.test(src) && has('translateX(calc(min(50vw, 300px) - 100% - 8px))'));
// ムーは丸枠の外へ巨大に描いているので、丸枠の中に置くと本体の裏へ回る。
// 必殺技の警告と同じく画面基準で前面に出すこと
const hintBlock = src.slice(src.indexOf("enemyNextIntent.type==='MOVE'&&("), src.indexOf('mh-enemy-move-hint') + 400);
check('吹き出しはムーの手前に出る(画面基準で前面に置く)',
  /fixed left-1\/2 pointer-events-none/.test(hintBlock) && /zIndex:65000/.test(hintBlock));
// 丸枠(敵の円)は transform を持つので独自の重ね順の島になる。
// その中に吹き出しを置くと、いくらz-indexを上げてもムーの裏へ回る。
// 必殺技の警告と同じ階層(丸枠より前)に置かれているかを、書かれている順で確かめる
const circleAt = src.indexOf("{/* 行動予測ラベルはmain下部に移動 */}");
const hintAt = src.indexOf("<div className=\"mh-enemy-move-hint\">");
const specialWarnAt = src.indexOf("必 殺 技</div>");
check('吹き出しを丸枠の中に置いていない', hintAt > 0 && circleAt > 0 && hintAt < circleAt,
  `吹き出し ${hintAt} / 丸枠 ${circleAt}`);
check('吹き出しは必殺技の警告と同じ階層にある', hintAt > specialWarnAt && specialWarnAt > 0);

// ためる(準備)の予告に、必殺技と同じ全画面オーラを出さないこと。
// 出すと「準備なのか、いま撃たれるのか」が見分けられなくなる
check('準備の予告に必殺技のオーラを流用しない',
  has("const isSpecial = enemyIntent.type==='SPECIAL';")
    && !has("const isSpecial = enemyIntent.type==='SPECIAL'||enemyIntent.type==='CHARGE';"));
// ムーの本体は丸枠の外へ別に描いているので、動きも別に指定しないと
// ためるターンに攻撃の突進(mooAttackLunge)が出てしまう
check('ムーの準備は突進せず、その場で溜める',
  has("enemyAttackFx?.kind==='charge'?'mooChargeGather") && has('@keyframes mooChargeGather'));
// 解析ボタンが吹き出し(画面の上から22%)と重なっていたので下げてある
check('解析ボタンを吹き出しと重ならない高さへ下げている',
  /onClick=\{\(\)=>setShowEnemyInfo\(true\)\} className="absolute right-2 top-24/.test(src));
// スタン・無効化・眼力・距離撃で敵の行動を止めたときは、その行動を「やらなかった」ことにする。
// ここが抜けていると、必殺技の準備をスタンで止めたのに次のターンだけ必殺技が飛んでくる
check('止められたターンは行動しなかった扱いにする',
  has('enemyActionPerformedRef.current = false;') && has('enemyActionPerformedRef.current = true;'));
check('止められたターンは直前の行動として数えない',
  has('setEnemyLastIntent(enemyActionPerformedRef.current?acting:null)')
    && has('setEnemyLastIntent(enemyActionPerformedRef.current?executedIntent:null)'));
check('止められたことを次の行動の抽選へ伝えている',
  has('advanceEnemyIntents(acting,distForNextPredict,enemyActionPerformedRef.current)')
    && has('advanceEnemyIntents(executedIntent,distForNextPredict,enemyActionPerformedRef.current)'));
check('ためを止めたら予約してあった必殺技を捨てる',
  has("if (reserved && reserved.type === 'SPECIAL' && !(performed && executedIntent?.type === 'CHARGE')) reserved = null;"));
check('いま居る間合いへの移動予約も捨てる',
  has("if (reserved && reserved.type === 'MOVE' && reserved.targetDist === distAfterExecuted) reserved = null;"));
// 抽選側も「何もしなかった」を受け取れること(nullを渡すとためも移動も無かった扱いになる)
const cancelled = api.enemyActionStateFrom(null);
check('何もしなかったターンの次はふつうの抽選に戻る',
  cancelled.charging === false && cancelled.movedLast === false, JSON.stringify(cancelled));
const afterCancel = api.enemyActionProbabilities(enemy, 1, cancelled);
check('ためを止めた次のターンは必殺技が出ない', afterCancel.find(a => a.id === 'special').available === false);
check('ためを止めた次のターンはふだんの出やすさに戻る',
  JSON.stringify(pct(afterCancel)) === JSON.stringify({ normal: 50, charge: 15, special: 0, wait: 20, move: 15 }),
  JSON.stringify(pct(afterCancel)));

check('予告済みの行動は抽選し直さず繰り上げる',
  has('const upcoming = reserved || getNextEnemyAction(enemy, distAfterExecuted, effective, {unannounced:true});')
    && has('setEnemyIntent(upcoming);'));
check('戦闘開始時に2手ぶん用意する',
  has('const firstIntent = getNextEnemyAction(newEnemy,dist,null,{unannounced:true});')
    && has('reserveEnemyNextIntent(getNextEnemyAction(newEnemy,distAfterIntent(firstIntent,dist),firstIntent));'));
check('戦闘開始前のSCANも同じ条件で見せる', has('scanBeforeBattle?{unannounced:true}:enemyActionStateFrom(enemyLastIntent)'));
// 予約を捨てて引き直した行動は、次のターンにそのまま実行されるのに吹き出しを出していない
check('引き直した行動でも予告なしの移動にしない',
  has('const upcoming = reserved || getNextEnemyAction(enemy, distAfterExecuted, effective, {unannounced:true});'));
check('次の行動を決めるとき直前の行動を渡している',
  /advanceEnemyIntents\(executedIntent,distForNextPredict[,)]/.test(src) && /advanceEnemyIntents\(acting,distForNextPredict[,)]/.test(src));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;
