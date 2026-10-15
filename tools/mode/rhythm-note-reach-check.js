#!/usr/bin/env node
// どこを押しても取れないノーツが無いか(全曲・全難易度・試作の HELL も)。
// 中身は rhythm-note-reach-scan.js の速い形(--fast --check)。ゲームの判定の関数 rhythmMatchInputBatch をそのまま呼び、
// 各ノーツの時刻ちょうどに、見た目の真ん中を押したらそのノーツが取れるか・同時のノーツを全部の真ん中で同時に押したら全部取れるかを見る。
// 2026-10-11 社長「Grievous Lady マスターで32秒位の左のスライドが反応しない。他にもこういうのがないか確認して」から(#2780・#2782)。
// 取れる幅を左右へずらして測る詳しい形は `node tools/mode/rhythm-note-reach-scan.js --list`(約18分)。
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync(process.execPath, [path.join(__dirname, 'rhythm-note-reach-scan.js'), '--fast', '--check', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
