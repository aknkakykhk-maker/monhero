#!/usr/bin/env node
// 「初回の演奏だけサイドのマスモンが変な場所に出る／リスタートすると直る」の再発を防ぐ。
//
//   node tools/mode/rhythm-play-area-resize-check.js
//
// 【何が起きていたか】(2026-09-05・実機の指摘「まだ初回演奏開始時の表示バグが直ってない」)
// レーンの台形・判定ラインの左右・サイドのマスモンの箱は、プレイエリアを1回測って決める。
// 測り直す合図は「プレイエリアの要素が入れ替わったとき」と「window の resize」だけだった。
// ところが、window の大きさは変わらないのに**箱の大きさだけ**が変わる場面が実際にある。
//   ・遅れて届いた外部CDNのCSS(Tailwind)がやっと効いた
//   ・セーフエリア(ノッチ)や端末のUIぶんの高さが確定した
//   ・上下の要素の読み込みが終わって箱が縮んだ
// このとき測り直さないので、組み上がる前の大きさで決めた位置が
// **その回の演奏のあいだずっと**残る。サイドのマスモンは px で置いているため、
// 実測では高さ390pxの箱に対して top=953px、つまり画面の外に出たままだった。
// リスタートで直っていたのは、そのときプレイエリアの要素ごと作り直されて
// 「要素が入れ替わったとき」の合図が改めて出ていたからにすぎない。
//
// 【この検査のやり方】
// プレイエリアだけを置いた素のページで rhythm-mode.js を読ませ、
//   ① 組み上がる前(高さ3348px)の状態で置き場所が決まる
//   ② window は一切触らずに、箱の高さだけ390pxへ変える
//   ③ そのあとの置き場所が、はじめから390pxだったとき(=画面を回したとき)と一致する
// を見る。②で測り直していないと③が一致しないので、必ず落ちる。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=8971;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
// プレイエリアと、そこへ置くものだけの素のページ。Tailwindは使わない
// (使えないからではなく、「CSSがまだ効いていない状態」こそが再現したい状況のため)。
const PAGE=`<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%}
#area{position:relative;width:600px;height:3348px;overflow:hidden}
[data-rhythm-side-monster]{position:absolute}
</style>
<div id="area" data-rhythm-play-area>
  <span data-rhythm-side-monster="1"></span>
  <span data-rhythm-side-monster="2"></span>
  <span data-rhythm-side-monster="3"></span>
  <span data-rhythm-side-monster="4"></span>
  <div data-rhythm-judgment-line style="position:absolute;left:0;right:0;bottom:12%;height:3px"></div>
</div>
<script src="/monster-hero/data/rhythm-mode.js"></script>`;
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const url=decodeURIComponent(req.url.split('?')[0]);
  if(url==='/'||url==='/probe.html'){res.writeHead(200,{'Content-Type':'text/html'});res.end(PAGE);return;}
  const f=path.join(ROOT,url.replace(/^\/+/,''));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

(async()=>{
  let chromium;
  try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:844,height:390}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e).split('\n')[0]));
    const boxes=()=>page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-side-monster]')]
      .map(e=>`${e.style.left}/${e.style.top}/${e.style.width}/${e.style.height}`));
    const heightOf=async h=>{
      await page.evaluate(v=>{document.getElementById('area').style.height=v;},h);
      await page.waitForTimeout(400);
      return boxes();
    };
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'load',timeout:60000});
    await page.waitForTimeout(400);
    const tall=await boxes();
    ok('組み上がる前でも置き場所は決まる',tall.length===4&&tall.every(v=>/px/.test(v)),tall.join(' '));

    // window は一切触らない。箱の高さだけを変える
    const settled=await heightOf('390px');
    // 比較の相手: はじめから390pxだったときの答え。
    // 画面の大きさを変えれば今までどおり測り直されるので、その値を正解として使う。
    await page.setViewportSize({width:845,height:390});
    await page.waitForTimeout(400);
    const truth=await boxes();
    ok('画面の大きさが変わったときは今までどおり測り直す',truth.length===4&&truth.join()!==tall.join());
    ok('箱の大きさだけが変わったときも測り直す',settled.join()===truth.join(),
      `あとから組み上がったとき ${settled.join(' ')} / 正解 ${truth.join(' ')}`);
    ok('組み上がる前の値のまま固まっていない',settled.join()!==tall.join(),
      `組み上がる前 ${tall.join(' ')}`);

    // 測り直しが自分自身を呼び続けていないこと(監視している箱の中身しか触らない)
    const before=await page.evaluate(()=>{let n=0;const el=document.getElementById('area');
      const o=new ResizeObserver(()=>{n++;});o.observe(el);window.__probe=()=>n;return 0;});
    await page.waitForTimeout(700);
    const loops=await page.evaluate(()=>window.__probe());
    ok('測り直しが自己ループになっていない',loops<=1,`700msで${loops}回`,before);
    ok('画面のJSでエラーが出ていない',errors.length===0,errors[0]||'');
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
