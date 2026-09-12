// 演奏画面のプレイエリアの「見た目」を画素で比べる。
//
//   node tools/mode/rhythm-decor-pixel-check.js                  # 作業ツリー と HEAD を比べる
//   node tools/mode/rhythm-decor-pixel-check.js --base HEAD~1    # 比べる相手を選ぶ
//   node tools/mode/rhythm-decor-pixel-check.js --shot <dir>     # 撮った絵も残す
//   node tools/mode/rhythm-decor-pixel-check.js --max 6 --ratio 0.4
//
// 【なぜ要るか】
// 2026-09-12 の実機計測で、演奏画面の装飾を切るだけで 25ms超が 448→214、33ms超が 124→62 に
// 半減した(docs/ops/rhythm-frame-drop-20260912.md)。原因は装飾に使っている「ぼかし」で、
//   ・[data-rhythm-play-area]::before の filter:drop-shadow(0 0 24px …)  … プレイエリア全面
//   ・[data-rhythm-play-area]::after  の filter:blur(12px)               … 上部18%
//   ・[data-rhythm-play-area]         の box-shadow:inset 0 -42px 80px   … 下端(判定ライン付近)
// の3つ。ぼかしは半径ぶんを毎回作り直すので、上をノーツが動くと再合成がそのたび走る。
//
// これを「見た目を変えずに軽い書き方(グラデーション)へ置き換える」とき、
// 目で見比べるだけでは 1〜2 の差に気づけない。静的化した Tailwind(2026-09-12)のおかげで
// このサンドボックスでも本物と同じ見た目を出せるようになったので、画素で比べる。
//
// 【決めごと】
// ・比べるのは index.html の <style> だけ。DOM はプレイエリアの形(親・レーン・判定ライン)を
//   最小限で再現する。装飾は ::before / ::after / 本体の background と box-shadow なので、
//   これで3つとも画面に出る。
// ・相手は git から取り出す(二重管理をしない)。道具の中へ「元のCSS」を書き写さない。
// ・落とす基準は「1画素の最大差」と「差が目に見える画素の割合」の2つ。
//   ぼかしをグラデーションで作り直すと必ず微差は出るので、0 は求めない。
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),PORT=8987;
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;};
const BASE=arg('--base','HEAD');
const SHOT_DIR=arg('--shot',null);
const MAX_DIFF=Number(arg('--max','6'));        // 1画素あたりの色の差(0-255)の上限
const RATIO_PCT=Number(arg('--ratio','0.4'));   // 差が見える画素(差>3)の割合の上限(%)
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const styleOf=html=>{
  const out=[];
  let i=0;
  for(;;){
    const s=html.indexOf('<style',i);if(s<0)break;
    const open=html.indexOf('>',s);if(open<0)break;
    const e=html.indexOf('</style>',open);if(e<0)break;
    out.push(html.slice(open+1,e));
    i=e+8;
  }
  return out.join('\n');
};

// プレイエリアの形だけを作る。中身(ノーツ)は装飾の見た目に関わらないので置かない。
const pageFor=style=>`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#000}
#wrap{position:relative;width:390px;height:620px;overflow:hidden}
</style><style>${style}</style></head><body>
<div id="wrap"><div data-rhythm-play-area style="position:absolute;inset:0;overflow:hidden">
  <div><i data-rhythm-lane style="left:0;width:25%"></i><i data-rhythm-lane style="left:25%;width:25%"></i><i data-rhythm-lane style="left:50%;width:25%"></i><i data-rhythm-lane style="left:75%;width:25%"></i></div>
  <i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px;background:rgba(255,255,255,.9)"></i>
</div></div>
</body></html>`;

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(0);}}

  const nowHtml=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
  let baseHtml;
  try{baseHtml=execFileSync('git',['show',`${BASE}:monster-hero/index.html`],{cwd:ROOT,maxBuffer:64*1024*1024,encoding:'utf8'});}
  catch(err){console.log(`SKIP: ${BASE} の index.html を取り出せませんでした(${String(err.message).split('\n')[0]})`);process.exit(0);}

  const nowStyle=styleOf(nowHtml),baseStyle=styleOf(baseHtml);
  check('index.html から <style> を取り出せている',nowStyle.length>1000&&baseStyle.length>1000,
    `いま ${Math.round(nowStyle.length/1024)}KB / ${BASE} ${Math.round(baseStyle.length/1024)}KB`);
  if(nowStyle===baseStyle){console.log(`\n${BASE} から <style> は変わっていません。比べるものがないので終わります。`);process.exit(0);}

  const pages={now:pageFor(nowStyle),base:pageFor(baseStyle)};
  const server=http.createServer((req,res)=>{
    const url=decodeURIComponent(req.url.split('?')[0]);
    if(url==='/now.html'||url==='/base.html'){
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(pages[url==='/now.html'?'now':'base']);return;
    }
    const file=path.join(ROOT,url.replace(/^\/+/,''));
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    const ext=path.extname(file),type=ext==='.css'?'text/css':ext==='.js'?'text/javascript':'application/octet-stream';
    res.writeHead(200,{'content-type':type});res.end(fs.readFileSync(file));
  });
  await new Promise(r=>server.listen(PORT,r));

  const exe=process.env.PLAYWRIGHT_CHROMIUM||'/opt/pw-browsers/chromium';
  const launch=fs.existsSync(exe)?{executablePath:exe}:{};
  const browser=await playwright.chromium.launch(launch);
  const shots={};
  try{
    for(const key of ['base','now']){
      const page=await browser.newPage({viewport:{width:390,height:620},deviceScaleFactor:2});
      await page.goto(`http://127.0.0.1:${PORT}/${key}.html`,{waitUntil:'load'});
      await page.waitForTimeout(120);
      shots[key]=await page.screenshot({clip:{x:0,y:0,width:390,height:620}});
      await page.close();
    }
    const page=await browser.newPage();
    await page.goto('about:blank');
    const diff=await page.evaluate(async ([a,b])=>{
      const read=async b64=>{
        const img=new Image();img.src='data:image/png;base64,'+b64;await img.decode();
        const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
        c.getContext('2d').drawImage(img,0,0);
        return {data:c.getContext('2d').getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};
      };
      const A=await read(a),B=await read(b);
      if(A.w!==B.w||A.h!==B.h)return {sizeMismatch:true,a:[A.w,A.h],b:[B.w,B.h]};
      let max=0,sum=0,over=0,n=0,maxAt=null;
      for(let i=0;i<A.data.length;i+=4){
        const d=Math.max(Math.abs(A.data[i]-B.data[i]),Math.abs(A.data[i+1]-B.data[i+1]),Math.abs(A.data[i+2]-B.data[i+2]));
        if(d>max){max=d;maxAt=[(i/4)%A.w,Math.floor((i/4)/A.w)];}
        sum+=d;n++;if(d>3)over++;
      }
      return {max,avg:sum/n,overPct:over*100/n,n,maxAt,w:A.w,h:A.h};
    },[shots.base.toString('base64'),shots.now.toString('base64')]);
    await page.close();

    if(diff.sizeMismatch){check('2枚の大きさがそろっている',false,`${diff.a.join('x')} と ${diff.b.join('x')}`);}
    else{
      console.log(`\n  比べた相手: ${BASE} / ${diff.w}x${diff.h}px(${diff.n.toLocaleString()}画素)`);
      console.log(`  1画素の最大差 ${diff.max} (${diff.maxAt?`x${diff.maxAt[0]} y${diff.maxAt[1]}`:'-'}) / 平均差 ${diff.avg.toFixed(3)} / 差が見える画素 ${diff.overPct.toFixed(3)}%\n`);
      check(`1画素の最大差が ${MAX_DIFF} 以下`,diff.max<=MAX_DIFF,`${diff.max}`);
      check(`差が見える画素(差>3)が ${RATIO_PCT}% 以下`,diff.overPct<=RATIO_PCT,`${diff.overPct.toFixed(3)}%`);
    }
    if(SHOT_DIR){
      fs.mkdirSync(SHOT_DIR,{recursive:true});
      fs.writeFileSync(path.join(SHOT_DIR,'base.png'),shots.base);
      fs.writeFileSync(path.join(SHOT_DIR,'now.png'),shots.now);
      console.log(`  撮った絵: ${path.join(SHOT_DIR,'base.png')} / ${path.join(SHOT_DIR,'now.png')}`);
    }
  }finally{await browser.close();server.close();}

  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
