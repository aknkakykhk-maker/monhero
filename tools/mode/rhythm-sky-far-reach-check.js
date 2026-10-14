#!/usr/bin/env node
// HELL の空中の光「奥まで」が、どの設定・どの画面サイズでも、空中の判定線から空中の道の奥の端まで届くかを、canvas の画素で確かめる(2026-10-13)。
//
//   node tools/mode/rhythm-sky-far-reach-check.js
//
// 2026-10-13 社長の iPhone(390×844)「奥まで出ていない」「判定ラインより低い位置から出てる」。
// 押している間の空中の光(drawSkyPress)が、空中の判定線の上 0.22・下 0.06 だけを描く作りで、奥まで届かず、判定線より下へもはみ出していた。
// 演奏画面と同じ描き手(RHYTHM_CANVAS_RENDERER)を検査用の canvas へつなぎ、次の全部の組み合わせで描いて画素を読む。
//   画面 … 横 844×390(画素密度1)・縦 390×844(画素密度3 = iPhone)
//   描き方 … 2D canvas・WebGL
//   演出 … 標準(LIGHT)・最小(MINIMAL = 軽さ優先)・軽量モード
// 見るもの(サブレーンの左・中・右の3か所)
//   押した光: 空中の判定線のすぐ上が光る / 奥の端(画面に見える一番上)まで光る / 判定線より下には出ない
//   叩いた光の柱: 叩いて0.1秒後、空中の判定線のすぐ上と、奥の端まで光る
// 「短い」「出さない」を選んだときの形は見ない(変えていない)。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9067;
let playwright;try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}).listen(PORT);
const SIZES=[{name:'横 844×390',w:844,h:390,dpr:1},{name:'縦 390×844(iPhone)',w:390,h:844,dpr:3}];
(async()=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
  let bad=0,count=0;
  for(const size of SIZES){
    const page=await browser.newPage({viewport:{width:size.w,height:size.h},deviceScaleFactor:size.dpr});
    await page.addInitScript(()=>{try{localStorage.removeItem('mh_hell_sky_hit_proto');}catch(e){}});
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>typeof RHYTHM_CANVAS_RENDERER!=='undefined'&&typeof rhythmProjectSubLaneRange==='function',null,{timeout:60000});
    const rows=await page.evaluate(async({w,h})=>{
      const out=[];
      if(RHYTHM_HELL_SKY_HIT.id!=='far')return [{label:'既定',ok:false,why:`既定が far ではない(${RHYTHM_HELL_SKY_HIT.id})`}];
      const R=RHYTHM_CANVAS_RENDERER,line=RHYTHM_JUDGMENT_LINE_Y.ratio,rect={width:w,height:h,top:0,left:0},lift=t=>rhythmSkyLiftPx({height:h},t);
      const skyLineY=line*h-lift(line),farY=Math.max(2,0*h-lift(0)+2);
      const host=document.createElement('div');host.style.cssText=`position:fixed;left:0;top:0;width:${w}px;height:${h}px;z-index:99999`;
      document.body.appendChild(host);
      const reader=document.createElement('canvas'),rctx=reader.getContext('2d',{willReadFrequently:true});
      const frame=(cv,draw)=>new Promise(res=>requestAnimationFrame(()=>{draw();reader.width=cv.width;reader.height=cv.height;rctx.clearRect(0,0,reader.width,reader.height);rctx.drawImage(cv,0,0);res(rctx.getImageData(0,0,reader.width,reader.height));}));
      // 空中のサブレーンの中心の x(その高さ t での道の形に沿った位置)
      const sl=rhythmProjectionScale(line);
      const colX=(left,right,t)=>{const fl=Math.max(0,.5+(left-.5)/sl),fr=Math.min(1,.5+(right-.5)/sl),s=rhythmProjectionScale(t);return ((.5+(fl-.5)*s)+(.5+(fr-.5)*s))/2*w;};
      const tAtY=y=>{let lo=0,hi=line;for(let i=0;i<40;i++){const m=(lo+hi)/2;if(m*h-lift(m)<y)lo=m;else hi=m;}return (lo+hi)/2;};
      const alphaAt=(img,x,y)=>{const sx=img.width/w,X=Math.round(x*sx),Y=Math.round(y*sx);let best=0;
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=X+dx,yy=Y+dy;if(xx<0||yy<0||xx>=img.width||yy>=img.height)continue;best=Math.max(best,img.data[(yy*img.width+xx)*4+3]);}return best;};
      for(const backend of ['2d','webgl']){
        const cv=document.createElement('canvas');host.innerHTML='';host.appendChild(cv);
        R.attach(cv,{webgl:backend==='webgl'});
        if(backend==='webgl'&&R.backend!=='webgl'){out.push({label:`${backend}`,ok:false,why:'WebGL の描き込み先が作れなかった'});continue;}
        R.enableSkyHits(host);
        for(const [ename,effect,lightweight] of [['標準','LIGHT',false],['最小(軽さ優先)','MINIMAL',false],['軽量モード','LIGHT',true]]){
          for(const sub of [0,5,10]){
            const span=rhythmProjectSubLaneRange(sub,2,line),L=span.left,Rr=span.left+span.width;
            // 押した光
            R.setSkyPressed([sub,sub+1],1);
            const img=await frame(cv,()=>{R.begin(rect,{nowMs:performance.now(),effect,lightweight,dpr:window.devicePixelRatio});R.drawHits(line*h+2);R.end();});
            R.setSkyPressed([],1);
            const nearY=skyLineY-4,belowY=skyLineY+8;
            const a1=alphaAt(img,colX(L,Rr,tAtY(nearY)),nearY),a2=alphaAt(img,colX(L,Rr,tAtY(farY)),farY),a3=alphaAt(img,colX(L,Rr,line),belowY);
            const label=`${backend} ${ename} サブレーン${sub + 1}`;
            out.push({label:`${label} 押した光`,ok:a1>40&&a2>3&&a3===0,why:`判定線の上 ${a1}/255・奥の端(y=${Math.round(farY)}) ${a2}/255・判定線の下 ${a3}/255`});
            // 叩いた光の柱(0.1秒後)
            const center=(L+Rr)/2,width=(Rr-L)*1.15;
            R.pushHit({center,width,color:'#a5f3fc',judgment:'PERFECT',precise:false,big:false,sparkScale:1,flick:'',finish:false,sky:true});
            const t0=performance.now();
            const img2=await frame(cv,()=>{R.begin(rect,{nowMs:t0+100,effect,lightweight,dpr:window.devicePixelRatio});R.drawHits(line*h+2);R.end();});
            const b1=alphaAt(img2,colX(center-width/2,center+width/2,tAtY(nearY)),nearY),b2=alphaAt(img2,colX(center-width/2,center+width/2,tAtY(farY)),farY);
            out.push({label:`${label} 叩いた光`,ok:b1>40&&b2>3,why:`判定線の上 ${b1}/255・奥の端(y=${Math.round(farY)}) ${b2}/255`});
            // 次の組み合わせへ残さない
            await frame(cv,()=>{R.begin(rect,{nowMs:t0+5000,effect,lightweight});R.drawHits(line*h+2);R.end();});
          }
        }
        R.release();
      }
      host.remove();
      return out;
    },{w:size.w,h:size.h});
    for(const r of rows){count++;if(!r.ok){bad++;console.log(`NG  ${size.name} ${r.label}: ${r.why}`);}}
    console.log(`${size.name}: ${rows.filter(r=>r.ok).length}/${rows.length} OK`);
    await page.close();
  }
  await browser.close();server.close();
  if(bad){console.log(`\nNG: ${bad}/${count} で、空中の光が空中の判定線から奥の端まで届いていません`);process.exit(1);}
  console.log(`\nOK: ${count} の組み合わせすべてで、空中の光が空中の判定線から奥の端まで届いています(判定線より下にも出ていません)`);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
