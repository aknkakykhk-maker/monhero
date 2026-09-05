const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 「あそびかた練習」の中身を見る。
//
//   node tools/mode/rhythm-practice-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「初回チュートリアルモードを作ったのに実装されてなかったからいれて／チュートリアル追加／
//     実際の音ゲー画面でやり方や各ノーツの操作方法などまで作って」
//
// それまでのチュートリアルは曲えらびで助手が説明するだけで、叩いて覚える場所が無かった。
// いまは演奏画面をそのまま使い、ノーツの種類を1つずつ出す専用の譜面を通す。
//
// ここで見張るのは主に2つ。
//   ① 教える種類が抜けていないこと(足したノーツの種類が練習に出てこない、を防ぐ)
//   ② 練習の結果を記録に残さないこと(自己ベストと全国ランキングを練習で汚さない)
// 画面まで通した確認は tools/mode/rhythm-tutorial-check.js が本物のブラウザで行う。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
const rhythmSource = fs.readFileSync(path.join(web, 'data/rhythm-mode.js'), 'utf8');
const help = fs.readFileSync(path.join(web, 'data/help.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const context = { console };
vm.createContext(context);
vm.runInContext(`${rhythmSource}\nglobalThis.x={RHYTHM_TUTORIAL_SONG,RHYTHM_TUTORIAL_CHART,RHYTHM_TUTORIAL_STEPS,`
  + `RHYTHM_TUTORIAL_DIFFICULTY,RHYTHM_TUTORIAL_END_MS,rhythmTutorialStepAt,RHYTHM_DEMO_SONG_IDS,`
  + `RHYTHM_INPUT_MATCH_WINDOW_MS,rhythmNoteIsSlide};`, context);
const { RHYTHM_TUTORIAL_SONG:song, RHYTHM_TUTORIAL_CHART:chart, RHYTHM_TUTORIAL_STEPS:steps,
        RHYTHM_TUTORIAL_DIFFICULTY:difficulty, RHYTHM_TUTORIAL_END_MS:endMs,
        rhythmTutorialStepAt, RHYTHM_DEMO_SONG_IDS } = context.x;

// ---- 譜面の中身 ----
check('練習用の曲がある', !!song && song.songId === 'rhythm_tutorial', song && song.songId);
check('曲えらびの一覧には出さない', !RHYTHM_DEMO_SONG_IDS.includes('rhythm_tutorial'));
check('登録済みのBGMを使う(専用の音源を増やしていない)', song.bgmTrackId === 'atsu_cup_theme', song.bgmTrackId);
check('長すぎない(30秒以内)', endMs > 0 && endMs <= 30000, `${(endMs/1000).toFixed(1)}秒`);

const types = chart.notes.map(note => note.type);
for (const [label, ok2] of [
  ['タップ', types.includes('TAP')],
  ['ホールド', types.includes('HOLD')],
  ['スライド', types.includes('SLIDE')],
  ['フリック', types.includes('FLICK')],
]) check(`${label}が出てくる`, ok2);
check('同時押しが出てくる',
  chart.notes.some((a,i) => chart.notes.some((b,j) => j!==i && b.timeMs===a.timeMs)));
check('終点フリックが出てくる', chart.notes.some(note => note.endFlick === true));
check('モンスターノーツが出てくる', chart.notes.some(note => note.monsterSlot === 1));

// 1つずつ覚えるための譜面なので、詰まっていてはいけない。
// 判定の受付幅(240ms)より狭い間隔で並んでいたら、練習にならない
const times = [...new Set(chart.notes.map(note => Number(note.timeMs)))].sort((a,b) => a-b);
let tightest = Infinity;
for (let i = 1; i < times.length; i++) tightest = Math.min(tightest, times[i]-times[i-1]);
check('ノーツの間隔が十分に空いている(判定の受付幅より広い)',
  tightest > context.x.RHYTHM_INPUT_MATCH_WINDOW_MS, `いちばん狭いところで${Math.round(tightest)}ms`);

// ---- 説明 ----
check('説明が種類ごとにある', steps.length >= 7, `${steps.length}件`);
check('説明は時刻の順に並んでいる',
  steps.every((step,i) => i===0 || step.fromMs >= steps[i-1].fromMs));
check('最初は「タップ」から始まる', /タップ/.test(steps[0].title));
check('曲が始まる前でも説明が出る', !!rhythmTutorialStepAt(-500));
// 説明は、そのノーツが来る前に出ていないと読む間がない
const firstOf = type => Math.min(...chart.notes.filter(note => note.type === type).map(note => Number(note.timeMs)));
for (const [type, keyword] of [['HOLD','ホールド'],['SLIDE','スライド'],['FLICK','フリック']]) {
  const at = firstOf(type);
  const step = rhythmTutorialStepAt(at - 1);
  check(`${keyword}のノーツが来る前に${keyword}の説明が出ている`,
    step && step.title.includes(keyword), step ? step.title : 'なし');
}

// ---- 記録に残さない ----
check('練習は from:\'tutorial\' で始める',
  game.includes("from:'tutorial' }") || game.includes("from:'tutorial'}"));
check('練習の結果は自己ベストにも全国ランキングにも保存しない',
  game.includes("if(rhythmPlay.from==='tutorial')return;"));
check('練習ではライフを減らさない(途中で倒れて最後まで届かない、を防ぐ)',
  game.includes('run.life=tutorial?RHYTHM_LIFE_MAX:rhythmLifeAfterWithMonsterAbilities'));
check('練習の満点は0や1になっていない(ランクの表示が壊れる)',
  Number(difficulty.maxScore) >= 100000, String(difficulty.maxScore));

// ---- 入口 ----
check('「遊びかた」から練習を始められる', game.includes('data-rhythm-demo-practice'));
check('初回の案内を最後まで読むと練習へ続く',
  game.includes('if (remember && rhythmTutorialToPracticeRef.current) startRhythmPractice();'));
check('スキップした人は練習へ連れて行かない',
  game.includes('rhythmTutorialToPracticeRef.current = false;'));
check('ヘルプにも練習のことが書いてある', /叩いて練習する/.test(help));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
