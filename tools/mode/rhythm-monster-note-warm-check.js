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
//   ・モンスターノーツの音を、曲の前に聞こえない音量(0)で1回通しておく(最初に取った瞬間だけ重かった・2026-10-13 2件目)
//   ・能力名の文字を、同じ書式で見えないまま最初から置いておく(最初のモンスターノーツで文字の形を用意して重かった)
//   ・ライフの帯は幅(width)を動かさず、幅いっぱいの帯を切り抜いて(clip-path)出す。幅を動かすと動くあいだ毎コマ並べ直しが起きる(「元気」・MISS のとき)
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
check('モンスターノーツの音に、聞こえない音量で通す道(silent)がある', /const playMonster=\(\{silent=false\}=\{\}\)=>\{/.test(mode) && /gain\.gain\.setValueAtTime\(silent\?0:\.0001,start\);\s*if\(!silent\)\{gain\.gain\.exponentialRampToValueAtTime/.test(mode));
check('音の作り置き(prepare)で、モンスターノーツの音を聞こえない音量で1回通す', /setTimeout\(\(\)=>\{try\{playMonster\(\{silent:true\}\);\}catch\{\}\},120\);/.test(mode));
const barAt = play.indexOf('data-rhythm-life-bar '), bar = barAt < 0 ? '' : play.slice(barAt, play.indexOf('}}/>', barAt));
check('ライフの帯は幅を動かさず、切り抜き(clip-path)と色の大きさ(background-size)で長さを出す', !!bar && /width:'100%'/.test(bar) && /clipPath:`inset\(0 \$\{\(100-lifeRatio\*100\)\.toFixed\(1\)\}% 0 0 round 999px\)`/.test(bar) && /backgroundSize:`\$\{\(lifeRatio\*100\)\.toFixed\(1\)\}% 100%`/.test(bar), bar.slice(0, 80));
check('ライフの帯の動きは140msのまま(幅の動きではない)', /'clip-path 140ms linear,background-size 140ms linear'/.test(bar) && !/width 140ms/.test(bar));
check('ライフの帯の色はまとめ書き(background)にしない(色が変わると大きさが元へ戻るため)', /backgroundImage:lifeRatio>\.5\?/.test(bar) && !/[{,]background:/.test(bar));
const warmAt = play.indexOf('data-rhythm-ability-warm'), flashAt = play.indexOf('data-rhythm-ability-flash ');
const warmTag = warmAt < 0 ? '' : play.slice(warmAt, play.indexOf('</div>', warmAt));
const flashCls = flashAt < 0 ? '' : (play.slice(flashAt, flashAt + 400).match(/className="([^"]*)"/) || [])[1] || '';
check('能力名の文字を、見えないまま(visibility:hidden)最初から置いておく', !!warmTag && /visibility:'hidden'/.test(warmTag) && /aria-hidden="true"/.test(warmTag) && /m\.ability\.name/.test(warmTag));
check('置いておく能力名は、表示と同じ文字の大きさ・太さ(text-lg font-black)', /text-lg font-black/.test(warmTag) && /text-lg/.test(flashCls) && /font-black/.test(flashCls), flashCls.slice(0, 60));
console.log(failed ? `\n${failed} 件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
