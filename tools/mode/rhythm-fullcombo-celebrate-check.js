// フルコンボ等を達成して曲を終えたとき、リザルトの数字を出す前に一度大きく祝う
// 「celebrate」画面を見る(2026-09-04、ユーザーからの要望「フルコンボの場合リザルトに
// 行く前に『フルコンボっ！』みたいな声が出る感じにもしたい」に対応)。
//
// 本物の掛け声(音声ファイル)は用意していないため、大きな文字の演出と合成音で代える。
// このファイルはその判断の根拠と、コンボ演出で一度踏んだ「毎ノーツ変わる値をeffectの
// 依存にすると予約タイマーが誤って解除される」バグを再発させていないことを見る。
//
//   node tools/mode/rhythm-fullcombo-celebrate-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');
const rhythm=read('monster-hero/data/rhythm-mode.js');
const html=read('monster-hero/index.html');
const help=read('monster-hero/data/help.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const finishBlock=(()=>{
  const at=game.indexOf('const finish=useCallback(()=>{');
  const end=game.indexOf('const skipCelebrate=',at);
  return at>=0&&end>at?game.slice(at,end):'';
})();
check('finish()を取り出せる',finishBlock.length>0);

// --- 達成の判定は既存のrhythmResultAchievementsをそのまま使う(判定を増やさない) ---
check('達成の判定はリザルト画面と同じrhythmResultAchievementsを再利用する(二重定義していない)',
  finishBlock.includes('const achievements=rhythmResultAchievements(run.counts,chart.totalNotes);')
  &&(finishBlock.match(/rhythmResultAchievements\(/g)||[]).length===1);
check('称号の優先順はリザルト画面の表示と同じ(ALL MARVELOUS > ALL EXCELLENT > FULL COMBO)',
  finishBlock.includes("const celebrateTitle=achievements.allMarvelous?'ALL MARVELOUS!!':achievements.allExcellent?'ALL EXCELLENT!!':achievements.fullCombo?'FULL COMBO!':null;"));
check('celebrateTitleが無い(何も達成していない)ときは今までどおりresultへ直行する',
  finishBlock.includes('status:showCelebrate?\'celebrate\':\'result\''));
check('演出量MINIMAL・軽量モードではcelebrate画面を出さない(重くしないため)',
  finishBlock.includes("const showCelebrate=!!celebrateTitle&&!settings.lightweightMode&&settings.effectAmount!=='MINIMAL';"));
check('保存(onComplete)はcelebrateの有無に関わらず必ず1回呼ぶ(演出で記録が変わらない)',
  finishBlock.includes('onComplete(result,merged);'));

// --- celebrate画面のライフサイクル ---
const celebrateEffect=(()=>{
  const at=game.indexOf('const celebrateTimerRef=useRef(null);');
  const end=game.indexOf('const skipCelebrate=',at)+'const skipCelebrate='.length+400;
  return at>=0?game.slice(at,end):'';
})();
check('celebrateの効果音・タイマーの一式を取り出せる',celebrateEffect.length>0);
check('celebrateへ入った瞬間に合成音を1回鳴らす',
  celebrateEffect.includes('RHYTHM_NOTE_SE_RUNTIME.playFullCombo();'));
check('タイマーで既定の時間のあとresultへ進む',
  /setTimeout\(\(\)=>\{setView\(v=>v\.status==='celebrate'\?\{\.\.\.v,status:'result'\}:v\);\},1300\);/.test(celebrateEffect));
// ★ここが以前100コンボ演出で実際に踏んだバグと同じ形。view.comboのような毎ノーツ変わる値を
// 依存にすると、非該当の再実行のたびcleanupが走ってタイマーが節目と無関係に解除される。
// celebrateはview.statusが'celebrate'になる一度しか変化しない値なので、それだけを依存にする。
check('effectの依存はview.statusだけ(毎ノーツ変わる値を混ぜていない)',
  /\},\[view\.status\]\);\s*const skipCelebrate=/.test(celebrateEffect));
check('タップで早送りできる(即座にresultへ進む)',
  game.includes('const skipCelebrate=()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}setView(v=>v.status===\'celebrate\'?{...v,status:\'result\'}:v);};'));
check('アンマウント・状態変化時にタイマーを後片付けする',
  celebrateEffect.includes('return ()=>{if(celebrateTimerRef.current){clearTimeout(celebrateTimerRef.current);celebrateTimerRef.current=null;}};'));

// --- 画面本体 ---
check('celebrate画面がある',game.includes("view.status==='celebrate'")&&game.includes('data-rhythm-celebrate'));
check('達成の種類ごとに見出しを出し分ける',
  game.includes("celebrateResult?.allMarvelous?'ALL MARVELOUS!!':celebrateResult?.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!'"));
check('最大コンボも添えて出す',/data-rhythm-celebrate-slam[\s\S]{0,300}MAX COMBO \{view\.maxCombo\}/.test(game));
check('タップで早送りできる導線を画面に付けている',/data-rhythm-celebrate[^>]*onClick=\{skipCelebrate\}/.test(game));

// --- ゲームプレイ側への影響が無いこと ---
check('celebrate中はプレイ画面のタッチ入力を受け付けない(resultと同じ扱い)',
  /view\.status==='result'\|\|view\.status==='celebrate'\)return;const syncTouches=/.test(game));
check('判定窓・スコアの重みは変更していない',
  rhythm.includes('const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });'));
check('保存キーを増やしていない',!game.includes('mh_rhythm_celebrate')&&!rhythm.includes('mh_rhythm_celebrate'));

// --- 合成音(SE)側 ---
const seBlock=(()=>{
  const at=rhythm.indexOf('const playFullCombo=()=>{');
  // 公開するAPIが増えても切り出しがずれないよう、行頭のreturnだけを目印にする
  const end=rhythm.indexOf('\n  return {warm,',at);
  return at>=0&&end>at?rhythm.slice(at,end):'';
})();
check('専用の合成音(playFullCombo)を持つ',seBlock.length>0);
check('既存のタップ音と同じ設定(ON/OFF・音量・全体ミュート)を読む',
  seBlock.includes('const settings=readSettings();')
  &&seBlock.includes('if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;'));
check('タップ音とは別のAudioContextを新規に作らない(既存のcontext()を使い回す)',
  seBlock.includes('const audio=context();')&&!/new AudioContext/.test(seBlock));
check('鳴らしたオシレーターは鳴らし終えたら片付ける(繋ぎっぱなしにしない)',
  seBlock.includes("oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};"));
check('外部からrhythmPlayFullComboとして呼べる',
  rhythm.includes('playFullCombo,_readSettings:readSettings};')
  &&game.includes('RHYTHM_NOTE_SE_RUNTIME.playFullCombo()'));

// --- CSS ---
check('スラムイン演出のCSSがある',html.includes('[data-rhythm-celebrate-slam]{')&&html.includes('@keyframes mhRhythmCelebrateSlam'));
check('動きを減らす設定の端末では動かさない',
  /@media \(prefers-reduced-motion:reduce\)\{\s*\[data-rhythm-celebrate\]\{animation:none\}/.test(html));

// --- ヘルプ(遊び方として説明されているか) ---
check('ヘルプにフルコンボ演出の説明がある',/フルコンボ|FULL COMBO/.test(help)&&help.includes('releaseFlag'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
