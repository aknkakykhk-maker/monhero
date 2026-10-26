// 長いスライドの帯を演奏の前に GPU へ置いておく(RHYTHM_CANVAS_RENDERER.warmSlideBands・rhythmCreateGpuSlideBand の prepare)を確かめる(2026-10-18)。
//
// 社長の報告「モンスターノーツ取るとやっぱり固まるときがある。特にsheriの4つめのノーツが」。端末の記録(stats.mon)では、
// 4つめ(106.1秒)の直後に画面へ入る長い空中スライド2本(106.771秒・271点 / 107.339秒・254点)の形を、画面に入ったその1コマで
// 作って GPU に送っていて、iPhone で約130ms 止まっていた(GPU の帯を使っている回だけ。前の描き方に戻っていた回は出ない)。
// 社長の決定(案A): 曲の前の準備で帯を作って GPU に置き、見えない形で1回描いておく。使うまで片付けない。
//
// 見ること(Sheriruth HELL の譜面で):
//   1. 先に置く帯は、点の多い長いスライドだけ(上限の本数まで)
//   2. 先に置いたあと、その帯を描くときに形を作り直さない(GPU の入れ物を新しく作らない)
//   3. 先に置いても、描いた絵は1画素も変わらない(見た目・判定は変えない)
//   4. GPU の帯を使っていない描き方(今の WebGL・2D)では何もしない
// Playwright が無い環境では SKIP。
//   node tools/mode/rhythm-gpu-band-warm-check.js
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=Number(process.env.GPU_BAND_WARM_PORT)||9191;
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;
// 本体の書き方(静的に): 演奏の前の準備で呼んでいる
{
  const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
  check('演奏の前の準備(光の絵を焼くのと同じ所)で、演奏に使うノーツを渡して呼んでいる',
    /RHYTHM_CANVAS_RENDERER\.warmSprites\([\s\S]{0,900}RHYTHM_CANVAS_RENDERER\.warmSlideBands\(runRef\.current&&runRef\.current\.notes\)/.test(play));
  const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  check('先に置いた帯は、初めて描くまで片付けない(3秒の片付けから外す)',/for\(const e of alive\)\{if\(!e\.pinned&&t-e\.usedAt>3000\)/.test(data)&&/e\.usedAt=t;e\.pinned=false;sweep\(t\);/.test(data));
}
(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(failed?1:0);}}
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':'text/javascript'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(PORT,r));
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'networkidle'});
    const r=await page.evaluate(()=>{
      const out={};
      const song=(RHYTHM_PROTO_SONGS||[]).find(s=>s.songId==='sheriruth_hell_debug');
      const chart=song&&song.difficulties.HELL;
      if(!chart||!chart.notes)return {missing:true};
      // 演奏画面と同じく、スライドには描く点の並びと区切りの線の時刻を焼き込む(makeRuntimeNotes と同じ。帯の鍵は点の並び)
      const cpInterval=rhythmSlideCheckpointIntervalMs('HELL',chart.level);
      const notes=chart.notes.map((note,index)=>({...note,index,...(note.type==='SLIDE'?{_rhythmSlideRenderPoints:rhythmSlidePoints(note),_rhythmSlideCheckpoints:rhythmSlideCheckpointTimes(note,cpInterval)}:{})}));
      const longs=notes.filter(n=>n.type==='SLIDE'&&n._rhythmSlideRenderPoints.length>=RHYTHM_GPU_BAND_WARM_POINTS).map(n=>n._rhythmSlideRenderPoints.length);
      out.longs=longs;
      const rect={width:390,height:700},noteHeight=20,travelMs=630,spawnY=-noteHeight,judgmentY=rect.height*.86-noteHeight/2,travelPx=judgmentY-spawnY;
      rhythmScrollSet(chart.scrollChanges,travelMs,chart.scrollGroups);RHYTHM_SKY_LIFT.set(false);
      const R=RHYTHM_CANVAS_RENDERER;
      // GPU の入れ物を作った回数(帯の形を作ると1つ増える)
      let made=0;const proto=WebGLRenderingContext.prototype,orig=proto.createBuffer;proto.createBuffer=function(){made++;return orig.apply(this,arguments);};
      // 4つめのモンスターノーツ(106.122秒)の瞬間に1本目、約0.55秒後に2本目の長い空中スライドが画面に入ってくる
      const frames=[106122,106700,107300,108000];
      const drawFrame=(visualTime,only)=>{
        R.begin(rect,{nowMs:1000,effect:'NORMAL',lightweight:false,maxDpr:2,sizeScale:1,motion:false});
        for(const note of notes){
          if(only&&!only(note))continue;
          const progress=1-(rhythmScrollPos(note.timeMs,note.scrollGroup)-rhythmScrollPos(visualTime,note.scrollGroup))/travelMs;
          const hasBody=rhythmNoteHasBody(note),end=rhythmReleaseTargetMs(note);
          const holding=hasBody&&note.timeMs<=visualTime&&visualTime<end;
          if(!(holding||(progress>=-.1&&progress<=1.18)))continue;
          const yPx=Math.round(spawnY+rhythmProjectTravelProgress(progress)*travelPx);
          const releaseProgress=1-(rhythmScrollPos(end,note.scrollGroup)-rhythmScrollPos(visualTime,note.scrollGroup))/travelMs,releaseYpx=Math.round(spawnY+rhythmProjectTravelProgress(releaseProgress)*travelPx);
          const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,rect,noteHeight,hasBody?releaseYpx:null,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx,gpu:true},hasBody?Math.max(0,yPx-releaseYpx):0);
          R.drawNote(note,geo,{failed:false,monster:false,wide:rhythmNoteIsWide(note),pressed:holding,slideOff:false,heldMs:visualTime-note.timeMs,alpha:1,pop:null,depthScale:1,brightness:1});
        }
        R.end();
      };
      const snap=canvas=>{const s=document.createElement('canvas');s.width=canvas.width;s.height=canvas.height;const x=s.getContext('2d');x.drawImage(canvas,0,0);return x.getImageData(0,0,s.width,s.height).data;};
      const isLong=n=>n.type==='SLIDE'&&n._rhythmSlideRenderPoints.length>=RHYTHM_GPU_BAND_WARM_POINTS;
      // 先に置かない(今まで): 長い帯を描いたコマで形を作る
      const plain=[];
      {const cv=document.createElement('canvas');R.attach(cv,{webgl:true,gpuBand:true});R.additiveGlow=false;R.warmSprites({effect:'NORMAL',lightweight:false,maxDpr:2});out.gpuBand=R.gpuBand;
        drawFrame(frames[0]-200);made=0;drawFrame(frames[0],isLong);drawFrame(frames[1],isLong);out.madeWithout=made;
        frames.forEach(t=>{drawFrame(t);plain.push(snap(cv));});R.release();}
      // 先に置く: 準備で作り、描くときは作らない
      const warm=[];
      {const cv=document.createElement('canvas');R.attach(cv,{webgl:true,gpuBand:true});R.additiveGlow=false;R.warmSprites({effect:'NORMAL',lightweight:false,maxDpr:2});
        drawFrame(frames[0]-200);
        out.warmed=R.warmSlideBands(notes);
        made=0;drawFrame(frames[0],isLong);drawFrame(frames[1],isLong);out.madeWith=made;
        frames.forEach(t=>{drawFrame(t);warm.push(snap(cv));});
        // 2回目の曲(同じ描き込み先で準備し直す): 前の印を外してから置き直す
        out.warmedAgain=R.warmSlideBands(notes);R.release();}
      let diff=0,px=0;for(let k=0;k<plain.length;k++){const A=plain[k],B=warm[k];for(let i=0;i<A.length;i++){if(A[i]!==B[i])diff++;}px+=A.length;}
      out.diff=diff;out.px=px;
      // 先に置いた場面で、帯がちゃんと描かれている(空振りしていない)
      out.inked=warm.map(d=>{let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;});
      // GPU の帯を使わない描き方では何もしない
      {const cv=document.createElement('canvas');R.attach(cv,{webgl:true,gpuBand:false});out.warmedNoBand=R.warmSlideBands(notes);R.release();}
      {const cv=document.createElement('canvas');R.attach(cv,{webgl:false});out.warmed2d=R.warmSlideBands(notes);R.release();}
      R.additiveGlow=true;proto.createBuffer=orig;
      return out;
    });
    if(r.missing){check('Sheriruth HELL の譜面がある',false);}
    else{
      check('Sheriruth HELL に、先に置く長いスライドがある',r.longs.length>=2,`点 ${r.longs.join('・')}`);
      if(r.gpuBand){
        check('GPU の帯を使う描き方で、長いスライドを先に置いた(上限の本数まで)',r.warmed===Math.min(r.longs.length,12),`${r.warmed}本`);
        check('先に置かないと、画面に入ったコマで形を作っていた(比べる元が空振りしていない)',r.madeWithout>=2,`GPU の入れ物 ${r.madeWithout}個`);
        check('先に置くと、画面に入ったコマで形を作らない',r.madeWith===0,`GPU の入れ物 ${r.madeWith}個`);
        check('先に置いても、描いた絵は1画素も変わらない',r.diff===0,`違う値 ${r.diff} / ${r.px}`);
        check('比べた場面に帯が描かれている(空振りしていない)',r.inked.every(n=>n>1000),r.inked.join('・')+'画素');
        check('2回目の準備でも置き直せる',r.warmedAgain===r.warmed,`${r.warmedAgain}本`);
      }else console.log('SKIP: この環境では GPU の帯を作れないので、描くところは確かめられません');
      check('GPU の帯を使わない WebGL・2D では何もしない',r.warmedNoBand===0&&r.warmed2d===0,`WebGL ${r.warmedNoBand}本・2D ${r.warmed2d}本`);
    }
    check('ページでエラーが出ていない',errors.length===0,errors.slice(0,2).join(' / '));
  }catch(e){check('確かめられた',false,String(e&&e.stack||e).slice(0,400));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
