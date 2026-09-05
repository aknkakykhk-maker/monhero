const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// モンビーの中では、選んでいる曲が鳴り続けるかを見る。
//
//   node tools/mode/rhythm-preview-continue-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)
//   「全国ランキング、マスモン設定、オプション場面で音楽がない。
//     選んでいた音楽が鳴り続けるようにして」「オプションだけは無音でいい」
//
// 曲を鳴らしていたのは曲えらびの部品(RhythmSongSelect)の中だった。
// ほかの画面へ移るとその部品ごと消えるので、音も一緒に止まっていた。
// いまは App本体で鳴らし、画面が変わっても鳴らし直さない。
//
// ここでは、
//   ・鳴らす画面／鳴らさない画面の顔ぶれ
//   ・画面が変わるだけで鳴らし直していないこと(依存に gameState を入れていない)
//   ・選んでいる曲が画面をまたいで残ること
// を見張る。どれも「実際に音を鳴らして確かめる」ことがこのサンドボックスではできないので、
// 作りの側から確かめる。
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const game = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

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

// ---- 鳴らす画面 ----
const listMatch = game.match(/const RHYTHM_PREVIEW_SCREENS=Object\.freeze\(\[([^\]]*)\]\)/);
check('鳴らす画面が一覧になっている', !!listMatch);
const screens = listMatch ? listMatch[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean) : [];
for (const screen of ['RHYTHM_DEMO_HOME', 'RHYTHM_RANKING', 'RHYTHM_DEMO_MONSTERS']) {
  check(`${screen} では鳴らす`, screens.includes(screen));
}
check('遊びかたでも鳴らす', screens.includes('RHYTHM_DEMO_HELP'));
// オプションには「♪ BGM試聴」があるので、裏で鳴っていると重なって聴けない(ユーザー指示)
check('オプションは無音のまま', !screens.includes('RHYTHM_OPTIONS'));
check('演奏中は自分で鳴らすので入れない', !screens.includes('RHYTHM_PLAY'));

// ---- 鳴らし直さないこと ----
const effect = grab('const rhythmPreviewSong=', '},[rhythmPreviewTrackId,rhythmSettings.bgmVolume]);');
check('鳴らす処理がApp本体にある', effect.length > 0);
check('画面が変わるだけでは鳴らし直さない(依存にgameStateを入れていない)',
  effect.length > 0 && game.includes('},[rhythmPreviewTrackId,rhythmSettings.bgmVolume]);')
  && !/\},\[[^\]]*gameState[^\]]*rhythmPreviewTrackId/.test(game));
check('曲えらびの中では鳴らしていない',
  !/Audio_\.startRhythmTrack\(previewTrackId/.test(game));
check('鳴らすかどうかは「曲えらびで試聴する」の設定に従う',
  effect.includes('rhythmSettings.songPreviewEnabled'));
check('音量は音ゲー専用のBGM音量を使う', effect.includes('rhythmSettings.bgmVolume'));
check('画面を離れたら止める', effect.includes('if(handle)handle.stop();'));

// ---- 選んでいる曲が残ること ----
check('選んでいる曲をApp本体で持っている',
  game.includes('const [rhythmSelectedSongId,setRhythmSelectedSongId]=useState('));
check('選んでいる難易度もApp本体で持っている',
  game.includes('const [rhythmSelectedDifficultyId,setRhythmSelectedDifficultyId]=useState('));
check('曲えらびは外から曲を受け取る形になっている',
  /const RhythmSongSelect=\({[^}]*songId='',difficultyId='',onSongId=null,onDifficultyId=null}\)/.test(game));
check('曲えらびが自分で曲を覚えていない(戻ると先頭へ戻る作りでない)',
  !/const \[songId,setSongId\]=React\.useState/.test(game));
check('曲えらびへ選択を渡している',
  game.includes('songId={rhythmSelectedSongId}') && game.includes('onSongId={setRhythmSelectedSongId}'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
