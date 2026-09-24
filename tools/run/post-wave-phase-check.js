const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 強化フェーズ(WAVEクリア後にバトルへ戻るまで)の「手順の並び」を確認する。
//
//   node tools/run/post-wave-phase-check.js
//
// 【なぜ要るか】
// WAVEをクリアすると、トレーニング・供モン・配置・固有技・アシストカードの画面が
// WAVE によって 1〜5 枚続く。各画面の上に「✓ → 供モン → 配置 → …」の並び(PhaseSteps)を出すようにした。
// 並びは postWavePhasePlan が**先に**組むので、実際の進み方(handleTraining など)とずれると
// 「出ると言った画面が来ない」「来た画面が並びに無い」になる。そのずれをここで止める。
//
// 見ているもの:
//   ① postWavePhasePlan を本体から取り出して動かし、WAVEごとの並びを確かめる
//   ② 並びの条件(WAVE 2・4・6 で合流、1・3・5・7・9 でアシストカード)が、
//      実際に進める処理(handleTraining / finishQuickGrowth)と同じ数字を使っている
//   ③ WAVEクリアで並びを組み、次のバトルが始まったら消している(次のランへ持ち越さない)
//   ④ 各画面が自分の段(current)で並びを出し、ラン開始時の配置・アシストカードでは出さない
//   ⑤ PhaseSteps を実際に描き、済んだ段・いまの段・まだの段が見分けられる
const fs = require('fs');
const path = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const babel = require('@babel/core');
const PRESET_REACT = require.resolve('@babel/preset-react');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i + from.length);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- ① 並びの組み方(式を書き写さず、本体のものを動かす) ----
const planSrc = slice('const POST_WAVE_JOIN_WAVES', 'const chooseAutoTrainingPicks');
check('postWavePhasePlan を本体から取り出せる', planSrc.includes('const postWavePhasePlan'));
const mod = { exports: {} };
new Function('module', 'exports', `${planSrc}\nmodule.exports={postWavePhasePlan,POST_WAVE_JOIN_WAVES,POST_WAVE_TEACHING_WAVES};`)(mod, mod.exports);
const { postWavePhasePlan: plan, POST_WAVE_JOIN_WAVES, POST_WAVE_TEACHING_WAVES } = mod.exports;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('WAVE 2 で供モンが来るなら5段', eq(plan({ wave:2, joinPossible:true }), ['training','ally','slot','skill','teaching']));
check('WAVE 2 で供モンが来ない(編成が埋まっている)ならトレーニングだけ', eq(plan({ wave:2, joinPossible:false }), ['training']));
check('種族チャレンジは供モンが来なくても固有技とアシストカードへ進む',
  eq(plan({ wave:4, joinPossible:false, speciesChallenge:true }), ['training','skill','teaching']));
check('WAVE 1・3・5・7・9 はトレーニング → アシストカード',
  [1,3,5,7,9].every(wave => eq(plan({ wave }), ['training','teaching'])));
check('WAVE 8 はトレーニングだけで次のバトルへ', eq(plan({ wave:8 }), ['training']));
check('クイックは自動成長 → 供モン → 配置', eq(plan({ wave:2, quick:true, joinPossible:true }), ['growth','ally','slot']));
check('クイックで供モンが来ないWAVEは自動成長だけ', eq(plan({ wave:3, quick:true, joinPossible:true }), ['growth']));
check('引数が無くても落ちない', eq(plan(), ['training']));

// ---- ② 実際の進み方と同じ数字を使っている ----
const training = slice('const handleTraining =', '// UPGRADE_SKILL画面');
check('handleTraining の合流WAVEが並びと同じ',
  training.includes(`const joinWaves=[${POST_WAVE_JOIN_WAVES.join(',')}];`));
check('handleTraining のアシストカードWAVEが並びと同じ',
  training.includes(`[${POST_WAVE_TEACHING_WAVES.join(',')}].includes(wave)`));
check('handleTraining は種族チャレンジで合流が無くても固有技へ進む(並びの前提)',
  training.includes("else if(joinWaves.includes(wave)&&speciesChallengeBattleRunRef.current)")
    && training.includes("advanceRunStage('UPGRADE_SKILL');"));
const quickGrowth = slice('const finishQuickGrowth = () => {', 'const finishQuickJoin');
check('クイックの合流WAVEが並びと同じ',
  quickGrowth.includes(`const joinWaves = [${POST_WAVE_JOIN_WAVES.join(', ')}];`));
check('固有技のあとは必ずアシストカードへ進む(並びの前提)',
  slice('const continueAfterUniqueUpgrade = () => {', '};').includes("advanceRunStage('PICK_TEACHING');"));
const joinPossible = slice('const postWaveJoinPossible = (withSpeciesPool) => {', '};');
check('供モンが来るかの判定は、実際の候補の取り方(pickJoinCandidates)と編成の空きを使う',
  joinPossible.includes('pickJoinCandidates(joinCandidatePool(),activeIds,mainHero?.id,joinOfferSize())')
    && joinPossible.includes('slots.filter(Boolean).length<4&&avail.length>0'));

// ---- ③ 組むとき・消すとき ----
check('WAVEクリアでトレーニングへ入る前に並びを組む',
  has("setPhasePlan(postWavePhasePlan({ wave, joinPossible:postWaveJoinPossible(true), speciesChallenge:!!speciesChallengeBattleRunRef.current }));\n      setTrainingPicks([]);\n      advanceRunStage('REWARD_PICK');"));
check('クイックは自動成長へ入る前に並びを組む',
  has("setPhasePlan(postWavePhasePlan({ wave, quick:true, joinPossible:postWaveJoinPossible(false) }));"));
check('次のバトルが始まったら並びを消す',
  /const initBattle = \([^)]*\) => \{\n(?:\s*\/\/[^\n]*\n)*\s*setPhasePlan\(null\);/.test(source));
check('並びは保存しない(storeSet しない)', !/storeSet\([^)]*phasePlan/.test(source));

// ---- ④ 各画面の段 ----
const screens = [
  ['トレーニング', 'function RewardPickScreen(', 'current="training"'],
  ['供モン', 'function PickHeroAllyScreen(', 'current="ally"'],
  ['配置', 'function PickSlotScreen(', 'current="slot"'],
  ['固有技', 'function UpgradeSkillScreen(', 'current="skill"'],
  ['アシストカード', 'function PickTeachingScreen(', 'current="teaching"'],
];
for (const [label, head, current] of screens) {
  const body = slice(head, '\nfunction ');
  check(`${label}の画面は自分の段で並びを出す`, body.includes('<PhaseSteps') && body.includes(current));
}
check('クイックの自動成長は growth の段で出す', has('<PhaseSteps plan={phasePlan} current="growth"'));
check('供モンの並びは PICK_ALLY のときだけ渡す(勇者モン選びでは出さない)', has("phasePlan={gameState==='PICK_ALLY'?phasePlan:null}"));
check('配置の並びは合流のときだけ渡す(ラン開始時の勇者モンの配置では出さない)', has('phasePlan={mainHero?phasePlan:null}'));
check('アシストカードの並びはWAVEのあとだけ渡す(ラン開始時は出さない)', has('phasePlan={enemy?phasePlan:null}'));

// ---- ⑤ 描いてみる ----
const uiSrc = slice('const PHASE_STEP_LABELS', '// ==== 強化フェーズの共通部品ここまで');
check('PhaseSteps を本体から取り出せる', uiSrc.includes('const PhaseSteps'));
const transformed = babel.transformSync(`${uiSrc}\nmodule.exports={PhaseSteps,PHASE_STEP_LABELS};`,
  { presets: [[PRESET_REACT, { runtime: 'classic' }]], filename: 'post-wave-phase-check.jsx' });
const ui = { exports: {} };
new Function('module', 'exports', 'React', transformed.code)(ui, ui.exports, React);
const render = (props) => ReactDOMServer.renderToStaticMarkup(React.createElement(ui.exports.PhaseSteps, props));
const five = ['training','ally','slot','skill','teaching'];
const atSkill = render({ plan: five, current: 'skill', nextWave: 3 });
check('いまの段と何段目かを印に出す', atSkill.includes('data-phase-steps="skill:4/5"'));
check('いまの段は aria-current で分かる', /aria-current="step"[^>]*>固有技</.test(atSkill));
check('済んだ段は ✓ で出し、名前は読み上げに残す',
  (atSkill.match(/>✓</g) || []).length === 3 && atSkill.includes('aria-label="トレーニング（済み）"'));
check('まだの段は名前で出す', atSkill.includes('>アシストカード<'));
check('段が4つ以上のときは「WAVE n」を省く(SEの幅で1行に収める)', !atSkill.includes('WAVE 3'));
const short = render({ plan: ['training','teaching'], current: 'training', nextWave: 2 });
check('段が少ないときは最後に次のWAVEを出す', short.includes('⚔ WAVE 2'));
check('並びに無い画面では何も出さない', render({ plan: five, current: 'growth' }) === '');
check('並びが無いときは何も出さない', render({ plan: null, current: 'training' }) === '');

console.log(failed ? `\nNG ${failed} 件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
