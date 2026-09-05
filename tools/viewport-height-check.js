#!/usr/bin/env node
// 画面の高さの取り方が、どの端末でも「1画面に収まる」ものになっているかを確かめる。
//
//   node tools/viewport-height-check.js
//
// 【なぜ要るか】
// 高さを 100dvh で取っていた。dvh はブラウザのUIの出入りで伸び縮みするため、
// Androidのナビゲーションバーが出ている端末では画面より高くなり、
// 下端がその裏へ隠れる。実際にホームの「バトル」ボタンが下半分だけ切れていた
// (2026-09-05・ユーザー指摘、Galaxy Z Fold6)。
//
// いまは --mh-vh ひとつにまとめ、svh(いちばん小さいときの高さ)が使えるなら
// そちらへ切り替えている。ここが元に戻ると、また下端が隠れる。
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const compiled=fs.readFileSync(path.join(ROOT,'monster-hero/game-system.compiled.js'),'utf8');

ok('画面の高さを --mh-vh 1か所で決めている',/:root\s*\{\s*--mh-vh:\s*100dvh;?\s*\}/.test(html));
ok('svh が使えるときは svh へ切り替える',
  /@supports \(height: 100svh\)\s*\{\s*:root\s*\{\s*--mh-vh:\s*100svh;?\s*\}\s*\}/.test(html));
ok('body の高さは --mh-vh から取る',/body \{ height:var\(--mh-vh\);/.test(html));
// svh を知らないブラウザでも dvh で動くこと(=フォールバックを消していない)
ok('svh を知らないブラウザでも高さが決まる（dvh のまま残す）',
  html.indexOf('--mh-vh: 100dvh')<html.indexOf('--mh-vh: 100svh'));

// 画面いっぱいを使う場所が、直に 100dvh を書いていないこと。
// 直書きが1か所でもあると、そこだけナビゲーションバーの裏へ回り込む。
const stray=(text,label)=>{
  const hits=(text.match(/100dvh/g)||[]).length;
  ok(`${label} に 100dvh の直書きが無い`,hits===0,hits?`${hits}件`:'');
};
stray(game,'game-system.jsx');
stray(compiled,'game-system.compiled.js');
// index.html の 100dvh は --mh-vh の既定値の1か所だけ。
// コメント(/* */)の中の説明文は数えない。
const htmlCode=html.replace(/\/\*[\s\S]*?\*\//g,'');
ok('index.html の 100dvh は既定値の1か所だけ',(htmlCode.match(/100dvh/g)||[]).length===1,
  `${(htmlCode.match(/100dvh/g)||[]).length}件`);

// 100vh(古い書き方)も混ざっていないこと。iOSでアドレスバーぶん大きくなる
for(const [text,label] of [[html,'index.html'],[game,'game-system.jsx']]){
  const hits=(text.match(/[^ds]100vh/g)||[]).length;
  ok(`${label} に 100vh(古い書き方)が無い`,hits===0,hits?`${hits}件`:'');
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
