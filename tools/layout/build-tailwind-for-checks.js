#!/usr/bin/env node
// 検査のためだけに Tailwind の CSS を作る。**配信物には一切入れない。**
//
//   node tools/layout/build-tailwind-for-checks.js
//   → tools/layout/.tailwind-for-checks.css （gitには入れない）
//
// 【なぜ要るか】
// 本体は Tailwind を CDN (cdn.tailwindcss.com) から読んでいる。このサンドボックスは
// 外部CDNへ出られないので、Tailwindのクラスがまったく効かない状態でしか画面を開けず、
// 「横画面で崩れているか」を測ることができなかった（実測すると、スタイルが効かない
// プレイエリアは844pxの画面で3352pxになる。それは崩れではなくCSSが無いだけ）。
//
// ここで同じクラス群のCSSを手元に作っておけば、検査のときだけ注入して
// 本物に近い見た目で位置を測れる。配信している index.html は変えないので、
// プレイヤーへ届くものは今までどおり CDN 版のまま。
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const OUT=path.join(__dirname,'.tailwind-for-checks.css');
const CONFIG=path.join(__dirname,'.tailwind-for-checks.config.js');
const INPUT=path.join(__dirname,'.tailwind-for-checks.input.css');

fs.writeFileSync(CONFIG,`module.exports={
  content:[${JSON.stringify(path.join(ROOT,'monster-hero','src','game-system.jsx'))},
           ${JSON.stringify(path.join(ROOT,'monster-hero','data','*.js'))}],
  theme:{extend:{}},
};\n`);
fs.writeFileSync(INPUT,'@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');

const bin=path.join(ROOT,'tools','node_modules','.bin','tailwindcss');
if(!fs.existsSync(bin)){
  console.log('SKIP: tailwindcss が入っていません（cd tools && npm install で入ります）');
  process.exit(0);
}
execFileSync(bin,['-c',CONFIG,'-i',INPUT,'-o',OUT,'--minify'],{stdio:'inherit',cwd:ROOT});
const size=fs.statSync(OUT).size;
console.log(`書き出しました: ${path.relative(ROOT,OUT)} (${Math.round(size/1024)} KB)`);
console.log('※ 検査のためだけのファイルです。配信物(monster-hero/)には入りません。');
