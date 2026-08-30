#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const files = ['monster-hero/src/game-system.jsx', 'monster-hero/game-system.compiled.js'];
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };
for (const file of files) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const compact = source.replace(/\s+/g, '');
  const block = source.match(/const BGM_TRACKS = \[([\s\S]*?)\];/)?.[1] || '';
  const b = block.replace(/\s+/g, '');
  check(`${file}: あつ杯テーマを登録曲一覧へ追加`,
    b.includes("id:'atsu_cup_theme'") && b.includes("name:'あつ杯テーマ'") && b.includes("src:'audio/bgm-atsu-cup-theme.mp3'"));
  check(`${file}: BGMアレンジ共通選択肢を再利用`,
    compact.includes('BGM_TRACKS.map(track=>') && compact.includes('Audio_.previewBGM(trackId)') && compact.includes('BGM_TRACK_BY_ID[saved]'));
  check(`${file}: あつ杯テーマを既定BGMへ勝手に設定していない`,
    !/DEFAULT_BGM_ARRANGEMENT[^;]+atsu_cup_theme/.test(compact));
}
const audioPath = path.join(ROOT, 'monster-hero/audio/bgm-atsu-cup-theme.mp3');
const audio = fs.existsSync(audioPath) ? fs.readFileSync(audioPath) : null;
check('あつ杯テーマMP3が存在し内容を持つ', !!audio && audio.length > 1024 && (audio.slice(0,3).toString() === 'ID3' || audio[0] === 0xff));
const changelog = fs.readFileSync(path.join(ROOT, 'monster-hero/data/changelog.js'), 'utf8');
check('更新履歴にあつ杯テーマ追加を掲載', changelog.includes('新BGM「あつ杯テーマ」を追加しました') && changelog.includes('BGMアレンジの登録曲一覧'));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
