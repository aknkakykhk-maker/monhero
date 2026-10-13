#!/usr/bin/env node
// モンスターノーツを取った瞬間に、新しい絵を作ったり GPU へ渡したりしないことを確かめる(2026-10-13 社長報告「モンスターノーツを取った瞬間に一瞬かくつく」)。
//
//   node tools/mode/rhythm-monster-note-warm-check.js
//
// 見張ること(ソースを読む検査。実際の重さは tools/playbot/rhythm-frame-perf.js などで測る):
//   ・叩いたときの光の作り置き(warmHitSprites)が、はじける粒(hitSparkSprite)を判定の色・虹・モンスターノーツの金色ぶん焼く
//     (焼いていないと、金色の粒は最初のモンスターノーツを取った瞬間に作って GPU へ渡していた)
//   ・描き込み先に、絵を前もって GPU へ渡す口(preloadImage)がある
//   ・演奏画面が、焼けたモンスターノーツの顔の絵(plain・glow)を前もって GPU へ渡す(渡していないと、そのノーツが出た瞬間に渡す)
//   ・演奏の前に、カットインの絵を読み解いておく(img.decode)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const mode = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const body = (src, head) => { const i = src.indexOf(head); if (i < 0) return ''; const j = src.indexOf('\n  };', i); return j < 0 ? '' : src.slice(i, j); };
const warm = body(mode, 'const warmHitSprites=()=>{');
check('叩いたときの光の作り置き(warmHitSprites)がある', !!warm);
check('作り置きで、はじける粒を判定の色ぶん焼く', /for\(const judgment of \['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD'\]\)hitSparkSprite\(rhythmHitEffectColor\(judgment\)\)/.test(warm));
check('作り置きで、はじける粒を虹の色ぶん焼く', /RHYTHM_JUDGMENT_RAINBOW\.forEach\(color=>hitSparkSprite\(color\)\)/.test(warm));
check('作り置きで、モンスターノーツの金色の粒(#fde047)を焼く', /hitSparkSprite\('#fde047'\)/.test(warm));
// 光を描く所で使う粒の色が、作り置きの色から外れていないか(金色の値を変えたら作り置きも直す)
check('モンスターノーツの光の色(#fde047)は、作り置きと同じ値', /color:big\?'#fde047'/.test(mode));
check('描き込み先に、絵を前もって GPU へ渡す口(preloadImage)がある', /\n    preloadImage\(source\)\{if\(source&&ctx&&backend==='webgl'/.test(mode));
check('焼けたモンスターノーツの顔の絵を、すぐ GPU へ渡す', /faceBitmapsRef\.current\[index\]=face;RHYTHM_CANVAS_RENDERER\.preloadImage\(face\.plain\);RHYTHM_CANVAS_RENDERER\.preloadImage\(face\.glow\);/.test(play));
check('演奏を始めるときにも、顔の絵を GPU へ渡す(焼き上がりが先だったときの分)', /faceBitmapsRef\.current\.forEach\(face=>\{if\(face\)\{RHYTHM_CANVAS_RENDERER\.preloadImage\(face\.plain\)/.test(play));
check('演奏の前に、カットインの絵を読み解いておく(img.decode)', /cutInRefs\.current\.forEach\(el=>\{const img=el&&el\.querySelector\('img'\);if\(img&&typeof img\.decode==='function'\)img\.decode\(\)/.test(play));
console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
