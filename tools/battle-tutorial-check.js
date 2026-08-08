// バトルチュートリアル(操作しながら覚える練習)を確認する。
//
// 入口は3つ。デバッグ設定・はじめての案内の最後・ヘルプの「バトルのれんしゅう」。
//
//   ① 台本が data/assistants.js のデータで、画面のJSXへ直接書かれていない
//   ② 仕様どおりの流れ(モード/難易度 → 勇者モン → 距離 → 教え → バトル → クリア → 強化 → 終わり)
//   ③ 通常のセーブデータに影響しない(記録しない状態で始める・始めたあとも保つ)
//   ④ 入口が3つそろっていて、終わったら始めた場所へ帰る
//   ⑤ 押してほしい場所を光らせ、途中で抜ける操作は止めている
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const helpSrc = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
// 既読フラグの定数名。ここだけで持つ
const BATTLE_TUTORIAL_SEEN = 'BATTLE_TUTORIAL_SEEN_KEY';

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}
globalThis.__t = { ASSISTANT_BATTLE_TUTORIAL, ASSISTANT_BATTLE_TUTORIAL_V2, ASSISTANT_BATTLE_TUTORIAL_BODY,
  ASSISTANT_BATTLE_TUTORIAL_INTRO_V1, ASSISTANT_BATTLE_TUTORIAL_INTRO_V2,
  ASSISTANT_BATTLE_TUTORIAL_OUTRO_V1, ASSISTANT_BATTLE_TUTORIAL_OUTRO_V2,
  findBattleTutorialStep, ASSISTANT_EXPRESSIONS };`, ctx);
const { ASSISTANT_BATTLE_TUTORIAL: steps, ASSISTANT_BATTLE_TUTORIAL_V2: stepsV2,
  ASSISTANT_BATTLE_TUTORIAL_BODY: bodySteps, ASSISTANT_BATTLE_TUTORIAL_INTRO_V2: introV2,
  ASSISTANT_BATTLE_TUTORIAL_OUTRO_V2: outroV2,
  findBattleTutorialStep, ASSISTANT_EXPRESSIONS } = ctx.__t;

// --- ① 台本はデータで持つ ---
check('台本が data/assistants.js のデータになっている', Array.isArray(steps) && steps.length >= 8, `${steps.length}ステップ`);
check('ステップに必要な項目がそろっている',
  steps.every(s => s.id && s.at && s.t && s.e && ['next', 'act', 'do', 'end'].includes(s.wait)));
// wait:'do' は「画面は変わらないが、この操作をしたら次へ」。必ず何を待つか(need)を書く
check("操作待ち(do)には待つ内容が書いてある",
  steps.filter(s => s.wait === 'do').every(s => !!s.need),
  steps.filter(s => s.wait === 'do' && !s.need).map(s => s.id).join(', '));
check('idが重複していない', new Set(steps.map(s => s.id)).size === steps.length);
check('表情はすべて用意されているもの', steps.every(s => ASSISTANT_EXPRESSIONS.includes(s.e)), steps.map(s => s.e).join('/'));
// 吹き出しは3行までなら収まる(実機で1行およそ17〜20字)
check('セリフは短く保つ(スマホで読める長さ)',
  steps.every(s => s.t.length <= 60), steps.filter(s => s.t.length > 60).map(s => `${s.id}:${s.t.length}字`).join(', '));
check('セリフを画面のJSXへ直接書いていない',
  steps.every(s => !source.includes(s.t.replace('{name}', '')))
    && stepsV2.every(s => !source.includes(s.t.replace('{name}', '')))
    && has("const battleTutorialSteps = (battleTutorialVariant === 'v2'"));

// --- ② 流れ ---
const order = steps.map(s => s.at);
const idx = (id) => steps.findIndex(s => s.id === id);
check('バトルの入口(モード・難易度)から始まる', steps[0].at === 'BATTLE_MENU');
check('仕様どおりの画面をこの順で通る',
  idx('start') < idx('hero') && idx('hero') < idx('slot') && idx('slot') < idx('teaching')
    && idx('teaching') < idx('battle') && idx('battle') < idx('clear') && idx('clear') < idx('reward'),
  order.join(' → '));
check('自己紹介から入る', /よろしく|見てるからね|覚えよ/.test(steps[0].t));
check('供モンの合流と固有技にも触れる',
  steps.some(s => s.t.includes('供モン')) && steps.some(s => s.t.includes('固有技')));
// モード・ランキング・難易度も練習の中で説明する(バトル画面の手前でつまずかないように)
check('チャレンジとクイックの違いに触れる',
  steps.some(s => s.t.includes('チャレンジ') && s.t.includes('クイック')));
check('ランキングの場所に触れる', steps.some(s => s.t.includes('ランキング')));
check('難易度の選び方に触れる', steps.some(s => s.t.includes('スワイプ') || s.t.includes('難易度')));
// バトル画面は覚えることが多いので、要素をひととおり説明したか数える
const BATTLE_TOPICS = [
  ['ターン数', /ターン/],
  ['敵のHPと距離', /HPバー|いる距離/],
  ['敵の解析', /解析/],
  ['自分のステータス', /ステータス/],
  ['距離の枠', /距離枠|同じ距離/],
  ['攻撃・ガード・ブリーダーカード', /ガードカード/],
  ['2枚目からの半減', /半減|半分/],
  ['使える枚数', /枚数/],
  ['山札', /山札/],
  ['固有技', /固有技/],
  ['緊急回復', /緊急/],
  ['1ターンの流れ', /ACTION/],
];
const missingTopics = BATTLE_TOPICS.filter(([, re]) => !steps.some(s => re.test(s.t)));
check('バトル画面の要素をひととおり説明している', missingTopics.length === 0,
  missingTopics.map(([name]) => name).join(', '));
check('練習はビギナーのチャレンジで行うと伝える',
  steps.some(s => s.t.includes('ビギナー')));
check('最後は「ヘルプからいつでも見られる」で終わる',
  steps[steps.length - 1].wait === 'end' && steps[steps.length - 1].t.includes('ヘルプ'));
// 終わりはちゃんと締める(いつのまにか終わっていた、にならないように)
check('終わりをはっきり締めている',
  steps.some(s => /れんしゅうは終わり|チュートリアル.*終わ|おつかれ/.test(s.t) || /おつかれ/.test(s.title || '')));
// 敵の行動予告は敵の絵の「下」に出る。台本の言い回しと光らせる場所を合わせる
check('攻撃予告の場所を正しく伝える',
  steps.some(s => s.spot === 'enemyIntent') && !steps.some(s => /敵の上に次の行動/.test(s.t)));
// 技の一覧で暗くなっている技の理由(距離補正・供モン加入)まで説明する
check('技が解放される条件にも触れる',
  steps.some(s => s.t.includes('補正')) && steps.some(s => s.t.includes('供モンが合流')));
// 技の一覧は「カードを選ぶ」→「もう一度名前を押す」の2回タップで開く。
// 1回で開くと思って書くと、押しても開かないように見えてしまう
check('技変更が2回タップだと伝えている',
  steps.some(s => /2回|もう1回|もう一度/.test(s.t) && /名前|一覧/.test(s.t)));
check('操作して進むステップがある', steps.filter(s => s.wait === 'act').length >= 4,
  `${steps.filter(s => s.wait === 'act').length}ステップ`);
// 「説明 → 操作 → 説明 → …」の流れ。いきなり操作モードに入る画面があると
// その画面の説明が出ないまま放り出されてしまう
const actWithoutTalk = steps.filter((s, i) => {
  if (s.wait !== 'act' && s.wait !== 'do') return false;
  const prev = steps[i - 1];
  return !(prev && prev.wait === 'next' && prev.at === s.at);
});
check('操作の手前に必ず同じ画面の説明がある', actWithoutTalk.length === 0,
  actWithoutTalk.map(s => `${s.id}(${s.at})`).join(', '));
// 操作させたい場所は、読んでいる間から光らせて場所が分かるようにする
const spotKey = (s) => JSON.stringify(s && s.spot !== undefined ? s.spot : null);
const talkWithoutSpot = steps.filter((s, i) => (s.wait === 'act' || s.wait === 'do') && steps[i - 1] && spotKey(steps[i - 1]) !== spotKey(s));
check('説明と操作で同じ場所を光らせている', talkWithoutSpot.length === 0,
  talkWithoutSpot.map(s => s.id).join(', '));
// 操作させる画面が説明だけで終わっていないか(逆向きの取りこぼし)
const actScreens = new Set(steps.filter(s => s.wait === 'act' || s.wait === 'do').map(s => s.at));
check('操作が要る画面がすべて説明つきで並んでいる',
  ['BATTLE_MENU', 'PICK_HERO', 'PICK_SLOT', 'PICK_TEACHING', 'BATTLE', 'WAVE_RESULT', 'REWARD_PICK'].every(at => actScreens.has(at)),
  [...actScreens].join('/'));
check('画面が変わったら次のステップへ進める',
  findBattleTutorialStep(0, 'PICK_SLOT') === idx('slotTalk')
    && findBattleTutorialStep(idx('slot') + 1, 'BATTLE') === idx('battle')
    && findBattleTutorialStep(0, 'NOPE') === idx('ally'),   // '*' はどの画面でも出る
  );
check('画面が変わったときの受け皿が画面側にある',
  has("const next = (typeof findBattleTutorialStep === 'function')") && has('}, [gameState, battleTutorialStep]);'));

// --- ③ 通常のデータに影響しない ---
const startBlock = source.slice(source.indexOf('const startBattleTutorial = ('), source.indexOf('const beginBattleTutorialRun'));
check('記録しない状態で始める', startBlock.includes('debugBattleRef.current = true;'));
check('保存しないことはデバッグ戦と同じ仕組み',
  source.includes('if (debugBattleRef.current) {') && source.includes("setDebugOutcome('win');"));
check('練習の中で保存していない',
  !/storeSet\(/.test(startBlock) && !/submitLocalScore|recordClearOnce|saveMissionProgress/.test(startBlock));
const endBlock = source.slice(source.indexOf('const endBattleTutorial = async ('), source.indexOf('const battleTutorialSteps'));
// 終わるときに書き込むのは「練習を見た」という既読フラグだけ。
// スコア・記録・編成などのセーブデータには一切触らない
check('終わるときに保存するのは既読フラグだけ',
  (endBlock.match(/storeSet\(/g) || []).length === 1 && endBlock.includes(`storeSet(${BATTLE_TUTORIAL_SEEN}, true, false)`)
    && !/submitLocalScore|recordClearOnce|saveMissionProgress/.test(endBlock));
check('やさしい難易度で固定する', startBlock.includes("setDifficulty('Beginner');"));
check('編成が空でも始められる', startBlock.includes('setMonSelection(getUnlockedBaseMonsterList());'));
// ふだんの「この難易度で挑戦」は debugBattleRef を false へ戻すので、
// そのまま通すと練習の結果が記録されてしまう。練習用の開始処理を必ず通す
const runBlock = source.slice(source.indexOf('const beginBattleTutorialRun = () => {'), source.indexOf('const endBattleTutorial'));
check('練習の開始は専用の処理を通る',
  has('const beginBattleTutorialRun = () => {') && runBlock.includes('debugBattleRef.current = true;'));
check('ふだんの開始ボタンは練習中そちらへ回す',
  (source.match(/onClick=\{\(\)=>\{if\(battleTutorial\)\{beginBattleTutorialRun\(\);return;\}/g) || []).length === 2,
  '既存のバトル画面と新しい難易度選択の2か所');
check('練習中はビギナー以外で始められない',
  has("disabled={!!battleTutorial&&key!=='Beginner'}"));
check('練習中はモードを切り替えられない',
  has('onClick={()=>{if(battleTutorial)return;setBattleMode(mode.id);'));
check('練習の中で保存していない(開始処理)', !/storeSet\(/.test(runBlock));
// WAVEクリアのミッション進捗が、記録を残さないはずの戦いでも保存されていた
check('記録を残さない戦いではミッションも進めない',
  has('const saveMissionProgress = async (event,amount=1) => {\n    // 記録を残さない戦い')
    && has('if (debugBattleRef.current) return;'));
// 練習は強化フェーズまで通して見せる。デバッグ戦の打ち切りに吸われると
// 「次へ進む」を押しても画面が変わらず、そこから先のステップに進めない
check('練習は強化フェーズまで進める',
  has('if (debugBattleRef.current && !battleScenarioRef.current) {'));

// --- ④ 入口は3つ・戻り先を覚える ---
check('デバッグ設定から開始できる', has('<button onClick={()=>startBattleTutorial()}') && has('バトルチュートリアル開始'));
check('はじめての案内の最後から開始できる',
  has("startBattleTutorial('HOME'); }") && has('バトルのれんしゅうをやってみる！'));
check('ヘルプの項目から開始できる',
  has("topic.launch==='battleTutorial'") && has('バトルのれんしゅうを始める'));
// ヘルプを開いてすぐ目に入る場所にも導線を置く(いつでも見返せるように)
check('ヘルプのいちばん上に導線がある',
  has("onClick={()=>{setHelpCatId('battle');setHelpTopicId('tutorial');}}")
    && has('みゅあと一緒に、実際に動かして遊び方を覚えられます'));
check('ヘルプ側に項目がある', helpSrc.includes("launch: 'battleTutorial'"));
// 呼び出し口は、定義を除いて デバッグ(v1)・デバッグ(v2お試し)・はじめての案内2つ・ヘルプ の5つ
const entryCalls = (source.match(/startBattleTutorial\(/g) || []).length;
check('入口は決めた5つだけ', entryCalls === 5, `${entryCalls}か所`);
check('新しい台本はデバッグからだけ開ける',
  (source.match(/startBattleTutorial\('DEBUG_SETTINGS','v2'\)/g) || []).length === 1
    && !/startBattleTutorial\('HOME',\s*'v2'\)/.test(source));
check('デバッグ設定の入口はデバッグ設定の中にある',
  source.indexOf('バトルチュートリアル開始') > source.indexOf("gameState==='DEBUG_SETTINGS'"));
check('終わったら始めた場所へ帰る',
  startBlock.includes('setBattleTutorialReturn(returnTo);')
    && endBlock.includes("if (back === 'HOME') { returnToHome(); return; }"));
// 既読は持つが、練習そのものは何度でも始められる(始めるときに既読を見ない)
check('何度でも始められる', !startBlock.includes(BATTLE_TUTORIAL_SEEN) && !startBlock.includes('battleTutorialSeen'));
// デバッグのお試し再生で、通常プレイの既読状態を書き換えない
check('既読にするのはふだんの入口から通したときだけ',
  endBlock.includes(`if (completed && back === 'HOME') { try { await storeSet(${BATTLE_TUTORIAL_SEEN}, true, false); } catch {} }`));

// --- ⑤ 画面の重ね方 ---
check('専用画面を作らず、いまの画面へ重ねる',
  !source.includes("gameState==='BATTLE_TUTORIAL'") && has("aria-label=\"バトルチュートリアル\""));
// 操作するボタンは画面の下にあることが多いので、説明は上へ出す。
// それでも邪魔なときのために小さく畳めるようにしてある
// 上に出しっぱなしだと、モードのタブや敵のHPバーを吹き出しが隠してしまう。
// 光っている場所を実際に測って、上半分なら下へ逃がす
check('吹き出しは画面の端に固定で出す',
  has("{position:'fixed',left:0,right:0,top:0,zIndex:92000") && has("{position:'fixed',left:0,right:0,bottom:0,zIndex:92000"));
check('光っている場所を測って吹き出しを逃がす',
  has("document.querySelectorAll('.is-battle-tutorial-spot')")
    && has('battleTutorialAtBottom'));
// 光る場所が2か所(一覧とその決定ボタン)のとき、上端だけで決めると
// 下にある決定ボタンを吹き出しが隠してしまう。全部を囲む枠の上下の空きで決める
check('光る場所が複数あっても隠さない側へ出す',
  has('bottom = Math.max(bottom, r.bottom);')
    && has('setBattleTutorialAtBottom((h - bottom) > top);'));
check('詳細を開き閉じしても測り直す', has('}, [battleTutorialStep, gameState, currentPickingMon]);'));
// 説明中と操作中をはっきり分ける。
// 説明中は暗くして操作を止め、操作の番になったら暗幕も吹き出しも消す
check('説明中と操作中を分けている', has("const acting=battleTutorial.wait==='act'||battleTutorial.wait==='do';"));
// 操作の中身で進むステップ(カードを使う・緊急回復・技変更)の受け皿
check('操作の中身でも次へ進める',
  has("if (!cur || cur.wait !== 'do' || !cur.need) return;")
    && has('}, [battleTutorialLastAction, battleTutorialStep]);'));
check('説明中は画面を暗くする',
  has("{!acting&&<div aria-hidden=\"true\"") && has("zIndex:91000") && has("'rgba(2,6,23,0.55)':'rgba(2,6,23,0.75)'"));
check('説明中はタップを暗幕で受け止める(先に進めない)', has('onClick={(e)=>e.stopPropagation()}'));
check('光らせる場所があるときは暗幕を薄くする', has("battleTutorial.spot?'rgba(2,6,23,0.55)'"));
check('操作の番では吹き出しを消す', has('{acting?(') && has("{battleTutorial.title||'光っているところを操作してね'}"));
// 技ピッカー(z:60000)は説明中の暗幕(z:91000)より下にあるので、
// 開いた時点で次の説明へ進むと閉じられなくなる。閉じたときに数える
check('技変更は閉じたときに数える',
  has('const skillPickerOpenRef = useRef(false);') && has('}, [skillPicker]);')
    && !has("if(battleScenarioRef.current)setBattleTutorialLastAction('skillPicker'); setSkillPicker("));
check('操作の番でも「やめる」は残す',
  (source.match(/onClick=\{\(\)=>endBattleTutorial\(false\)\}/g) || []).length >= 2,
  `${(source.match(/onClick=\{\(\)=>endBattleTutorial\(false\)\}/g) || []).length}か所`);
check('吹き出し以外は操作を邪魔しない', has("pointerEvents:'none'") && has("pointerEvents:'auto'"));
check('みゅあの顔と吹き出しは共通のものを使う',
  has('<AssistantFace who={who} size={64} accent={who.accent} expression={battleTutorial.e}/>')
    && has('assistantSpeakText(battleTutorial.t, breederName, assistantBondLevelNow)'));
check('つぎへとスキップ(やめる)がある',
  has("{last?'おわる':'つぎへ'}") && has('<button onClick={()=>endBattleTutorial(false)}') && has('やめる</button>'));
// 押してほしいものだけを押せるようにする。枠全体を光らせると
// 「どれを押すのか」が分からず、他が押せると台本から外れてしまう
check('置く距離は押せる枠だけ光らせる',
  has("disabled:opacity-20${scenarioPicksSlot(i)?battleTutorialSpotClass('slots'):''}")
    && !has("max-w-xs${battleTutorialSpotClass('slots')}"));
check('ブリーダーカードは押せるカードだけ光らせる',
  has("disabled:opacity-20${scenarioPicksTeaching(t.id)?battleTutorialSpotClass('teachings'):''}")
    && !has("content-center${battleTutorialSpotClass('teachings')}"));
check('手札は使わせたい種類だけ押せる',
  has('const battleTutorialCardAllowed = (card) => {')
    && has('if(isBusy||!tutorialAllowed)return;')
    && has('return !battleTutorialCardTarget || battleTutorialCardKind(card) === battleTutorialCardTarget;'));
check('手札は使わせたい種類だけ光らせる',
  has("${tutorialTargeted?' is-battle-tutorial-spot':''}")
    && has("${battleTutorialCardTarget&&!tutorialTargeted?' grayscale opacity-25':''}"));
// 「どこを押すのか分からない」を防ぐため、技変更は押す1枚と、そのカードの
// 名前のところまで光らせる。ほかのカードは触れない
check('技変更は押すカードと名前まで光らせる',
  has('const battleTutorialNeedCard = battleTutorial ? (battleTutorial.needCard || null) : null;')
    && has("${battleTutorialNeedCard&&tutorialTargeted?' is-battle-tutorial-spot':''}"));
check('技変更の番はACTIONを押せない',
  has("&&battleTutorialNeed!=='skillPicker';"));
// 説明を読んでいる間から光らせておけるよう、needCard は next のステップでも効く
check('押す場所は説明中から光っている',
  steps.some(s => s.wait === 'next' && s.needCard));
check('緊急回復はその番だけ押せる',
  has('const battleTutorialAllowsEmergency = !battleTutorialNeed') && has('disabled={isBusy||!battleTutorialAllowsEmergency}'));
// 押してほしい場所を光らせる
const SPOTS = ['modeTabs', 'rankingBtn', 'difficulty', 'battleStart',
  'monCards', 'monDecide', 'slots', 'teachings',
  'waveInfo', 'enemyBar', 'enemyIntent', 'heroStatus', 'emergency', 'battleSlots',
  'cards', 'cardCount', 'deckView', 'action', 'rewards', 'waveNext'];
check('光らせる場所が画面側と結びついている',
  SPOTS.every(name => has(`battleTutorialSpotClass('${name}')`)),
  SPOTS.filter(name => !has(`battleTutorialSpotClass('${name}')`)).join(', '));
const spotNames = steps.flatMap(s => (Array.isArray(s.spot) ? s.spot : s.spot ? [s.spot] : []));
check('台本のspotは画面側に用意されているものだけ',
  spotNames.every(name => SPOTS.includes(name)),
  spotNames.filter(name => !SPOTS.includes(name)).join(', '));
// 一覧の外枠だけを光らせると画面からはみ出して「どこを押すのか」が分からない。
// 勇者モン選択はカード1枚ずつを光らせる
check('勇者モンはカード1枚ずつを光らせる',
  has("${scenarioPicksHero(m.id)?battleTutorialSpotClass('monCards'):''}") && !has("battleTutorialSpotClass('monList')"));
// 詳細を開くと画面いっぱいのモーダルが出るので、上のみゅあの帯と名前が重ならないようにする
check('詳細と吹き出しが重ならない',
  has("paddingTop: battleTutorial?'calc(4.25rem + env(safe-area-inset-top))':undefined") && has('zIndex,paddingTop'));
check('光らせる見た目がCSSにある',
  has('.is-battle-tutorial-spot{') && has('@keyframes mhBattleSpot'));
check('動きを減らす設定にも配慮する', has('@media(prefers-reduced-motion:reduce){.is-battle-tutorial-spot{animation:none}}'));
// 途中で抜ける操作は止める
check('練習中は戻る・リタイアを止める',
  (source.match(/disabled=\{!!battleTutorial\}/g) || []).length >= 3,
  `${(source.match(/disabled=\{!!battleTutorial\}/g) || []).length}か所`);

// --- 将来の移行 ---
check('開始と終了が1つの関数にまとまっている',
  has('const startBattleTutorial = (returnTo = \'DEBUG_SETTINGS\', variant = \'v1\') => {')
    && has('const endBattleTutorial = async (completed = false) => {'));

// --- ⑥ 新しい入口の台本(V2・お試し) ---
check('新しい台本がある', Array.isArray(stepsV2) && stepsV2.length >= steps.length, `${stepsV2.length}ステップ`);
check('本体(勇者モン選択から強化フェーズまで)は新旧で同じものを使い回す',
  bodySteps.length > 0 && JSON.stringify(steps.slice(steps.length - bodySteps.length - 5, steps.length - 5)) === JSON.stringify(bodySteps)
    && JSON.stringify(stepsV2.slice(introV2.length, introV2.length + bodySteps.length)) === JSON.stringify(bodySteps));
check('新しい台本は新しいモード選択から始まる',
  stepsV2[0].at === 'BATTLE_MODE_SELECT' && introV2.some(s => s.at === 'BATTLE_DIFFICULTY_SELECT'));
check('3モードすべてに触れる',
  ['チャレンジ', 'クイック', 'プロ'].every(word => introV2.some(s => s.t.includes(word))));
check('チャレンジを選んでビギナーで始めると伝える',
  introV2.some(s => s.t.includes('チャレンジ') && s.wait === 'act') && introV2.some(s => s.t.includes('ビギナー')));
check('しめくくりで3モードの使い分けに触れる',
  ['チャレンジ', 'クイック', 'プロ'].every(word => outroV2.some(s => s.t.includes(word))));
check('新しい台本もセリフを短く保つ', stepsV2.every(s => s.t.length <= 70), stepsV2.filter(s => s.t.length > 70).map(s => `${s.id}:${s.t.length}字`).join(', '));
check('新しい台本のidも重複していない', new Set(stepsV2.map(s => s.id)).size === stepsV2.length);
check('新しい台本の表情もすべて用意されているもの', stepsV2.every(s => ASSISTANT_EXPRESSIONS.includes(s.e)));
// 初回でクイック・プロを実際に遊ばせない
check('練習中はチャレンジ以外の「難易度を選ぶ」を押せない',
  has('disabled={!!battleTutorial&&m.id!==BATTLE_MODE_CHALLENGE}'));
check('新しい難易度選択でも練習中はビギナーだけ',
  has("disabled={(pro&&!proReady)||(!!battleTutorial&&key!=='Beginner')}"));
check('練習中の難易度選択はビギナーから始まる',
  has("const start=battleTutorialStep!=null?'Beginner':BATTLE_DEFAULT_DIFFICULTY;"));
check('新しい画面でも押してほしい場所だけ光らせる',
  has("battleTutorialSpotClass('modeCards')") && has("battleTutorialSpotClass('modeRankTabs')")
    && has("battleTutorialSpotClass('modeStart')")
    && introV2.every(s => !s.spot || ['modeCards','modeRankTabs','modeStart','difficulty','battleStart'].includes(s.spot)));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
