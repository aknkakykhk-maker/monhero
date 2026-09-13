const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンビーのオプション画面を見る。
//
//   node tools/mode/rhythm-options-layout-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「オプション画面が窮屈すぎる／サイズ感に余裕を持たして」
//   「タップ調整が窮屈で見にくい／専用画面に飛ばしたほうがいい」
//   「ノーツの開始位置（奥行き）もオプションで調整できるようにしたい」
//   「演奏中のみ物理的に端末の通知を出さないようにすることは可能？ オプションでオンオフできて」
//
// 画面の「詰まり具合」は、字を小さくして詰めるほど**入る量は増える**ので、
// 気を抜くと少しずつ元へ戻る。ここでは数値(余白・文字の大きさ・押す場所の高さ)を見張る。
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');
// 演奏画面(タイミング合わせのリザルトを含む)は parts 側で見る
const play = fs.readFileSync(path.join(web, 'src/parts/30-rhythm-play.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (from, to) => {
  const i = game.indexOf(from);
  const j = game.indexOf(to, i);
  return i >= 0 && j > i ? game.slice(i, j) : '';
};
const options = grab('const RhythmOptions=({value,onSave,onBack,onCalibrate=null,calibrationResult=null,onClearCalibration=null})=>{', '\n// モンスターノーツ用のマスモン設定');


// ---- ゆとり ----
check('オプションの本体が取り出せている', options.length > 0);
check('カードの余白を広げてある(p-3のままにしていない)',
  /const card=wide\?'':'rounded-2xl border border-cyan-400\/35 bg-slate-900\/85 p-4/.test(options));
check('項目どうしの間を広げてある', /const row='[^']*py-3/.test(options) && /const row='[^']*gap-4/.test(options));
check('セクションどうしの間を広げてある', options.includes("wide?'space-y-2':'space-y-4'"));
check('項目名が小さすぎない(13px以上)', /const label='text-\[13px\]/.test(options));
check('説明文が9pxまで小さくなっていない',
  /const note='text-\[10px\]/.test(options) && !/text-\[9px\]/.test(options));
check('見出しが本文と同じ大きさになっていない', /const head='[^']*text-\[15px\]/.test(options));
// 数値の項目は「見出し → 操作 → 説明」を必ず間を空けて並べる。
// ここが1行に詰まると、どの説明がどの項目のものか分からなくなる
check('項目の並べ方を1か所にまとめてある', /const field=\(title,control,description=null,\{full=false\}=\{\}\)=>/.test(options));

// ---- タップ調整は「実際の演奏画面」で行う(2026-09-13・ユーザー指示) ----
// 「今の仕様はみにくすぎるし実用性がない / 特に横画面は終わってる /
//  普通に実際の画面を使ってやればいい / そこで判定も合わせて出して調整するのが1番合うとおもう」。
check('専用の小さな画面はもう作らない',
  !game.includes('const RhythmTimingCalibrator=') && !game.includes('data-rhythm-calibrator-area'));
check('オプションから演奏画面のタイミング合わせへ送る',
  options.includes('data-rhythm-calibrator-open') && /onClick=\{goCalibrate\}/.test(options)
  && game.includes("setRhythmPlay({ song:RHYTHM_CALIBRATION_SONG, difficulty:RHYTHM_CALIBRATION_DIFFICULTY, from:'calibration' });"));
// 画面を移るので、未保存の変更は先に保存してから送る(戻ってきたときに消えていないように)
check('未保存の変更を持ったまま画面を移らない',
  /const goCalibrate=async\(\)=>\{[\s\S]{0,200}if\(dirty\)\{const saved=await onSave\(draft\);setDraft\(saved\);\}/.test(options));
// 2026-09-13・ユーザー指摘「設定にもなってない」。測り終わった画面でそのまま決められるようにした。
// 戻ってからもう一度ボタンを押す、という二度手間にしない(勝手に入りもしない)
check('測った値は本人が選んでから入る(勝手に設定を書き換えない)',
  play.includes('data-rhythm-calibration-apply')
  && /onClick=\{\(\)=>onApplyCalibration&&onApplyCalibration\(measured\)\}/.test(play)
  && game.includes('judgmentTimingOffsetMs:offsetMs'));
check('決めたらその場で保存してオプションへ戻る',
  /const saved=await saveRhythmSettings\(\{\.\.\.rhythmSettings,judgmentTimingOffsetMs:offsetMs\}\)/.test(game)
  && game.includes("setRhythmPlay(null);setGameState('RHYTHM_OPTIONS');"));
check('オプションへ戻ったら入れた値が分かる',
  options.includes('data-rhythm-calibrator-result') && options.includes('にしました'));
check('タイミング合わせの記録は残さない(自己ベストにもランキングにも触れない)',
  game.includes("if(rhythmPlay.from==='calibration')return;"));

// ---- ノーツの出る位置 ----
check('ノーツの出る位置を画面から変えられる',
  options.includes("stepper('noteStartPosition',-100,100,5,{fine:5,coarse:25})"));
check('その値が実際にノーツの出る場所へ効いている',
  game.includes('const spawnY=-noteHeight+(settings.noteStartPosition/100)*areaRect.height*.2;'));
check('判定は変わらないと書いてある',
  /判定ラインの位置・判定のタイミング・判定窓・スコアは変わりません/.test(options));

// ---- 演奏中は通知を出さない ----
check('オプションに切り替えがある', options.includes("toggle('quietDuringPlay')"));
check('この端末で何ができるかを添えている', options.includes('rhythmQuietModeSupportText()'));
// できないのに「止まる」と見せない。ここがいちばん大事
check('通知そのものは止められないと書いてある',
  /通知そのものを止めることはブラウザからはできない/.test(game));
check('対応していない端末にはそう出す',
  /この端末のブラウザでは、全画面にすることも画面が消えないようにすることもできません/.test(game));
check('演奏へ入る「押した瞬間」に頼む(あとからでは断られる)',
  game.includes('if(rhythmSettings.quietDuringPlay)RHYTHM_QUIET_MODE.enter();'));
check('演奏が終わったら必ず戻す',
  /if\(gameState==='RHYTHM_PLAY'\)return;\s*RHYTHM_QUIET_MODE\.exit\(\);/.test(game));
check('自分で入った全画面だけ抜ける(縦横の切り替えを巻き添えにしない)',
  game.includes('if(fullscreenByUs){'));
check('画面を伏せて戻ってきたら取り直す',
  game.includes("document.addEventListener('visibilitychange',onVisibility)"));
check('保存の既定はOFF', /quietDuringPlay:false,/.test(game));
check('保存値は既定を通して読む', game.includes("quietDuringPlay:bool('quietDuringPlay'),"));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
