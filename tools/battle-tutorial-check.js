// バトルチュートリアル(操作しながら覚える練習)を確認する。
//
// いまはデバッグ設定からだけ開始できる「お試し」の状態。あとから
// 「初回起動で自動」「ヘルプからいつでも」へ移せる形になっているかも合わせて見る。
//
//   ① 台本が data/assistants.js のデータで、画面のJSXへ直接書かれていない
//   ② 仕様どおりの流れ(勇者モン → 距離 → 教え → バトル → クリア → 強化 → 終わり)になっている
//   ③ 通常のセーブデータに影響しない(記録しない状態で始める)
//   ④ 通常プレイからは始められない(デバッグ設定からだけ)
//   ⑤ 押してほしい場所を光らせ、途中で抜ける操作は止めている
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}
globalThis.__t = { ASSISTANT_BATTLE_TUTORIAL, findBattleTutorialStep, ASSISTANT_EXPRESSIONS };`, ctx);
const { ASSISTANT_BATTLE_TUTORIAL: steps, findBattleTutorialStep, ASSISTANT_EXPRESSIONS } = ctx.__t;

// --- ① 台本はデータで持つ ---
check('台本が data/assistants.js のデータになっている', Array.isArray(steps) && steps.length >= 8, `${steps.length}ステップ`);
check('ステップに必要な項目がそろっている',
  steps.every(s => s.id && s.at && s.t && s.e && ['next', 'act', 'end'].includes(s.wait)));
check('idが重複していない', new Set(steps.map(s => s.id)).size === steps.length);
check('表情はすべて用意されているもの', steps.every(s => ASSISTANT_EXPRESSIONS.includes(s.e)), steps.map(s => s.e).join('/'));
check('セリフは短く保つ(スマホで読める長さ)',
  steps.every(s => s.t.length <= 45), steps.filter(s => s.t.length > 45).map(s => `${s.id}:${s.t.length}字`).join(', '));
check('セリフを画面のJSXへ直接書いていない',
  steps.every(s => !source.includes(s.t.replace('{name}', ''))) && has('const battleTutorialSteps = (typeof ASSISTANT_BATTLE_TUTORIAL'));

// --- ② 流れ ---
const order = steps.map(s => s.at);
const idx = (id) => steps.findIndex(s => s.id === id);
check('勇者モン選択から始まる', steps[0].at === 'PICK_HERO');
check('仕様どおりの画面をこの順で通る',
  idx('hero') < idx('slot') && idx('slot') < idx('teaching') && idx('teaching') < idx('battle')
    && idx('battle') < idx('clear') && idx('clear') < idx('reward'),
  order.join(' → '));
check('自己紹介から入る', /よろしく|見てるからね|覚えよ/.test(steps[0].t));
check('供モンの合流と固有技にも触れる',
  steps.some(s => s.t.includes('供モン')) && steps.some(s => s.t.includes('固有技')));
check('最後は「ヘルプからいつでも見られる」で終わる',
  steps[steps.length - 1].wait === 'end' && steps[steps.length - 1].t.includes('ヘルプ'));
check('操作して進むステップがある', steps.filter(s => s.wait === 'act').length >= 4,
  `${steps.filter(s => s.wait === 'act').length}ステップ`);
check('画面が変わったら次のステップへ進める',
  findBattleTutorialStep(0, 'PICK_SLOT') === idx('slot')
    && findBattleTutorialStep(idx('slot') + 1, 'BATTLE') === idx('battle')
    && findBattleTutorialStep(0, 'NOPE') === idx('ally'),   // '*' はどの画面でも出る
  );
check('画面が変わったときの受け皿が画面側にある',
  has("const next = (typeof findBattleTutorialStep === 'function')") && has('}, [gameState, battleTutorialStep]);'));

// --- ③ 通常のデータに影響しない ---
const startBlock = source.slice(source.indexOf('const startBattleTutorial = () => {'), source.indexOf('const endBattleTutorial'));
check('記録しない状態で始める', startBlock.includes('debugBattleRef.current = true;'));
check('保存しないことはデバッグ戦と同じ仕組み',
  source.includes('if (debugBattleRef.current) {') && source.includes("setDebugOutcome('win');"));
check('練習の中で保存していない',
  !/storeSet\(/.test(startBlock) && !/submitLocalScore|recordClearOnce|saveMissionProgress/.test(startBlock));
const endBlock = source.slice(source.indexOf('const endBattleTutorial = () => {'), source.indexOf('const battleTutorialSteps'));
check('終わるときも保存しない', !/storeSet\(/.test(endBlock));
check('やさしい難易度で固定する', startBlock.includes("setDifficulty('Beginner');"));
check('編成が空でも始められる', startBlock.includes('setMonSelection(getUnlockedBaseMonsterList());'));

// --- ④ 入口はデバッグだけ ---
check('デバッグ設定から開始できる', has('<button onClick={startBattleTutorial}') && has('バトルチュートリアル開始'));
check('デバッグ設定より外に入口が無い',
  (source.match(/startBattleTutorial/g) || []).length === 2, `${(source.match(/startBattleTutorial/g) || []).length}か所`);
check('入口はデバッグ設定の中にある',
  source.indexOf('バトルチュートリアル開始') > source.indexOf("gameState==='DEBUG_SETTINGS'"));
check('何度でも始められる(既読フラグを持たない)',
  !/battleTutorial[A-Za-z]*(Seen|Done)/.test(source) && !source.includes('mh_battle_tutorial'));

// --- ⑤ 画面の重ね方 ---
check('専用画面を作らず、いまの画面へ重ねる',
  !source.includes("gameState==='BATTLE_TUTORIAL'") && has("aria-label=\"バトルチュートリアル\""));
// 操作するボタンは画面の下にあることが多いので、説明は上へ出す。
// それでも邪魔なときのために小さく畳めるようにしてある
check('吹き出しは画面の上に固定で出す', has("style={{position:'fixed',left:0,right:0,top:0,zIndex:92000"));
// 説明中と操作中をはっきり分ける。
// 説明中は暗くして操作を止め、操作の番になったら暗幕も吹き出しも消す
check('説明中と操作中を分けている', has("const acting=battleTutorial.wait==='act';"));
check('説明中は画面を暗くする',
  has("{!acting&&<div aria-hidden=\"true\"") && has("zIndex:91000") && has("'rgba(2,6,23,0.55)':'rgba(2,6,23,0.75)'"));
check('説明中はタップを暗幕で受け止める(先に進めない)', has('onClick={(e)=>e.stopPropagation()}'));
check('光らせる場所があるときは暗幕を薄くする', has("battleTutorial.spot?'rgba(2,6,23,0.55)'"));
check('操作の番では吹き出しを消す', has('{acting?(') && has('光っているところを操作してね</span>'));
check('操作の番でも「やめる」は残す',
  (source.match(/onClick=\{endBattleTutorial\}/g) || []).length >= 2,
  `${(source.match(/onClick=\{endBattleTutorial\}/g) || []).length}か所`);
check('吹き出し以外は操作を邪魔しない', has("pointerEvents:'none'") && has("pointerEvents:'auto'"));
check('みゅあの顔と吹き出しは共通のものを使う',
  has('<AssistantFace who={who} size={64} accent={who.accent} expression={battleTutorial.e}/>')
    && has('assistantSpeakText(battleTutorial.t, breederName, assistantBondLevelNow)'));
check('つぎへとスキップ(やめる)がある',
  has("{last?'おわる':'つぎへ'}") && has('<button onClick={endBattleTutorial}') && has('やめる</button>'));
// 押してほしい場所を光らせる
const SPOTS = ['monList', 'slots', 'teachings', 'cards', 'action', 'rewards'];
check('光らせる場所が画面側と結びついている',
  SPOTS.every(name => has(`battleTutorialSpotClass('${name}')`)),
  SPOTS.filter(name => !has(`battleTutorialSpotClass('${name}')`)).join(', '));
check('台本のspotは画面側に用意されているものだけ',
  steps.filter(s => s.spot).every(s => SPOTS.includes(s.spot)),
  steps.filter(s => s.spot && !SPOTS.includes(s.spot)).map(s => s.spot).join(', '));
check('光らせる見た目がCSSにある',
  has('.is-battle-tutorial-spot{') && has('@keyframes mhBattleSpot'));
check('動きを減らす設定にも配慮する', has('@media(prefers-reduced-motion:reduce){.is-battle-tutorial-spot{animation:none}}'));
// 途中で抜ける操作は止める
check('練習中は戻る・リタイアを止める',
  (source.match(/disabled=\{!!battleTutorial\}/g) || []).length >= 3,
  `${(source.match(/disabled=\{!!battleTutorial\}/g) || []).length}か所`);

// --- 将来の移行 ---
check('開始と終了が1つの関数にまとまっている',
  has('const startBattleTutorial = () => {') && has('const endBattleTutorial = () => {'));
check('あとから別の場所へ移せることを書いてある',
  source.includes('「初回起動で自動」「ヘルプからいつでも」へそのまま移せる')
    && assistantsSrc.includes('呼び出し口(いまはデバッグ設定)を変えるだけで'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
