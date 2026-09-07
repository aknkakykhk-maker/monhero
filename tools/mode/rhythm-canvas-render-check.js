// canvas 版のノーツ描画(RHYTHM_CANVAS_RENDERER)を実ブラウザで動かし、
//   ・粒の中心に画素が置かれ、何も無いところは透明のままか
//   ・種類ごとの色(TAP=桃・FLICK=緑・HOLD=水色・SLIDE=紫・モンスター=金)が出ているか
//   ・120フレーム描き続けたときの、1フレームあたりの JS 時間とレイアウト/塗り直しの回数
// を確かめる(2026-09-07・canvas 化)。Playwright が無い環境では SKIP。
//   node tools/mode/rhythm-canvas-render-check.js            # 検査
//   node tools/mode/rhythm-canvas-render-check.js --shot <path.png>   # 描いた絵も保存する
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const ROOT=path.resolve(__dirname,'../..'),PORT=8983;
const shotPath=(()=>{const i=process.argv.indexOf('--shot');return i>=0?process.argv[i+1]:null;})();
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden;background:#0b1224}
</style></head><body>
<div id="area" data-rhythm-play-area><i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px;background:#fff"></i>
<canvas id="c" data-rhythm-note-canvas></canvas></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;
const NOTES=[
  {type:'TAP',subLane:4,subLaneWidth:2,progress:.6},
  {type:'FLICK',subLane:8,subLaneWidth:2,progress:.7},
  {type:'HOLD',subLane:0,subLaneWidth:2,holdMs:700,progress:.8},
  {type:'SLIDE',lane:1,endLane:3,subLaneWidth:2,holdMs:900,progress:.9},
  {type:'TAP',subLane:6,subLaneWidth:2,progress:.5,monster:true},
  {type:'TAP',subLane:2,subLaneWidth:6,progress:.95},
  {type:'HOLD',subLane:6,subLaneWidth:4,holdMs:500,progress:1.0,endFlick:true},
  // 取り損ねた HOLD は消さず、終端まで薄い灰色で流す(実機「途中で判定ミスるとノーツ自体が消える」の再発防止)
  {type:'HOLD',subLane:8,subLaneWidth:2,holdMs:900,progress:.75,failed:true},
  // 指で触って取り損ねた FLICK。判定のために type が 'HOLD'・終端が60秒先に化けている。
  // 粒は判定ラインの下(画面外)にあり、レーンには何も残ってはいけない(2026-09-08・実機「レーンに白いあとが出続けた」)
  {type:'FLICK',subLane:6,subLaneWidth:2,holdMs:60000,progress:1.35,touched:true,failed:true},
];
(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(0);}}
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':'text/javascript'});fs.createReadStream(file).pipe(res);
  });
  await new Promise(r=>server.listen(PORT,r));
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:700},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'networkidle'});
    check('rhythm-mode.js を読み込んでもエラーにならない',errors.length===0,errors[0]||'');
    const ready=await page.evaluate(()=>typeof RHYTHM_CANVAS_RENDERER==='object'&&typeof rhythmNoteCanvasGeometry==='function');
    check('canvas の描画部品がブラウザ側で使える',ready);
    if(!ready)throw new Error('部品が無い');
    const result=await page.evaluate(({notes,travelMs})=>{
      const area=document.querySelector('[data-rhythm-play-area]'),canvas=document.getElementById('c');
      const areaRect=area.getBoundingClientRect(),line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line.getBoundingClientRect();
      const noteHeight=20,spawnY=-noteHeight,judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2,travelPx=judgmentY-spawnY;
      const yFor=p=>spawnY+rhythmProjectTravelProgress(p)*travelPx;
      const build=(source,index)=>{
        const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2),index};
        if(source.subLane!=null)note.subLane=source.subLane;
        if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
        if(source.endFlick)note.endFlick=true;
        if(source.holdMs){note.endTimeMs=note.timeMs+source.holdMs;if(source.type==='SLIDE'){note.endLane=source.endLane??note.lane;note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];}}
        if(source.touched){note._rhythmOriginalType=note.type;note._rhythmGestureType=note.type;note.type='HOLD';}
        return note;
      };
      const built=notes.map(build);
      RHYTHM_CANVAS_RENDERER.attach(canvas);
      const frame=(step,collect)=>{
        const ok=RHYTHM_CANVAS_RENDERER.begin({width:areaRect.width,height:areaRect.height},{nowMs:step*16.7,effect:'FULL',lightweight:false,sizeScale:1});
        const heads=[];
        built.forEach((note,i)=>{
          const source=notes[i],progress=collect?source.progress:((step*0.006)+source.progress)%1.1-.05;
          const yPx=Math.round(yFor(progress)),releaseYpx=Math.round(yFor(progress-(source.holdMs||0)/travelMs)),bodyPx=Math.max(0,yPx-releaseYpx);
          // 帯を持つかは元の種類で決める(実機の tick と同じ)。触った FLICK だけは、直す前の tick と同じく
          // 60秒先の終端と長い帯の高さを渡し、それでも帯が出ないことを確かめる
          const visualTime=note.timeMs-(1-progress)*travelMs,hasBody=source.touched?true:rhythmNoteHasBody(note);
          const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,areaRect,noteHeight,hasBody?releaseYpx:null,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},hasBody?bodyPx:0);
          const depthScale=Math.round((0.56+geo.scale*.44)*100)/100,brightness=Math.round((0.72+geo.scale*.28)*100)/100;
          RHYTHM_CANVAS_RENDERER.drawNote(note,geo,{failed:!!source.failed,monster:!!source.monster,wide:note.subLaneWidth>=5,pressed:false,alpha:source.failed?.34:1,pop:null,depthScale,brightness});
          heads.push({type:source.touched?'FLICK_TOUCHED':source.failed?'FAILED':source.monster?'MONSTER':note.type,cx:geo.head.cx,cy:geo.head.cy,band:geo.band&&geo.band.length?{x:(geo.band[3].left+geo.band[3].right)/2,y:geo.band[3].y}:null});
        });
        RHYTHM_CANVAS_RENDERER.end();
        return {ok,heads};
      };
      const first=frame(0,true);
      const g=canvas.getContext('2d'),dpr=canvas.width/areaRect.width;
      const pixel=(x,y)=>{const d=g.getImageData(Math.round(x*dpr),Math.round(y*dpr),1,1).data;return {r:d[0],g:d[1],b:d[2],a:d[3]};};
      const samples=first.heads.map(h=>({type:h.type,...pixel(h.cx,h.cy),band:h.band?pixel(h.band.x,h.band.y):null}));
      const empty=pixel(areaRect.width*.5,areaRect.height*.1);
      // 触って取り損ねた FLICK のレーン(サブレーン6〜7)の、画面の高さ 40% の位置
      const touchedSpan=rhythmProjectSubLaneRange(6,2,.4),touchedLane=pixel(areaRect.width*touchedSpan.center,areaRect.height*.4);
      // 120フレーム描き続けたときの JS 時間
      const times=[];
      for(let step=1;step<=120;step++){const t0=performance.now();frame(step,false);times.push(performance.now()-t0);}
      times.sort((a,b)=>a-b);
      return {ok:first.ok,drawn:RHYTHM_CANVAS_RENDERER.drawn,samples,empty,touchedLane,jsMedianMs:times[60],jsP95Ms:times[113],canvas:{w:canvas.width,h:canvas.height}};
    },{notes:NOTES,travelMs:2150});
    check('フレームの準備(begin)が通り、全ノーツを描いた',result.ok===true&&result.drawn===NOTES.length,`${result.drawn}/${NOTES.length}`);
    check('canvas の画素数がプレイエリア × 画素密度になっている',result.canvas.w===780&&result.canvas.h===1400,`${result.canvas.w}x${result.canvas.h}`);
    check('粒の中心に画素が置かれている(全ノーツ)',result.samples.filter(s=>s.type!=='FAILED'&&s.type!=='FLICK_TOUCHED').every(s=>s.a>200),result.samples.map(s=>`${s.type}:a${s.a}`).join(' '));
    const failedSample=result.samples.find(s=>s.type==='FAILED');
    check('取り損ねた HOLD は消えず、薄く(不透明度 .34 前後)灰色で描かれる',failedSample&&failedSample.a>40&&failedSample.a<170&&failedSample.band&&failedSample.band.a>40&&Math.abs(failedSample.r-failedSample.b)<70&&failedSample.g<160,failedSample?`粒 a${failedSample.a} rgb(${failedSample.r},${failedSample.g},${failedSample.b}) / 帯 a${failedSample.band?failedSample.band.a:'-'}`:'無し');
    check('何も無いところは透明のまま',result.empty.a===0,`a=${result.empty.a}`);
    check('触って取り損ねた FLICK のレーンに帯が残らない(終端60秒先の HOLD として描かない)',result.touchedLane.a===0,`a=${result.touchedLane.a}`);
    const by=type=>result.samples.find(s=>s.type===type);
    check('TAP は桃色(赤 > 緑)',by('TAP').r>by('TAP').g,`rgb(${by('TAP').r},${by('TAP').g},${by('TAP').b})`);
    check('FLICK は緑(緑 > 赤)',by('FLICK').g>by('FLICK').r,`rgb(${by('FLICK').r},${by('FLICK').g},${by('FLICK').b})`);
    check('HOLD は水色(青 > 赤)',by('HOLD').b>by('HOLD').r,`rgb(${by('HOLD').r},${by('HOLD').g},${by('HOLD').b})`);
    check('SLIDE は紫(青 > 緑)',by('SLIDE').b>by('SLIDE').g,`rgb(${by('SLIDE').r},${by('SLIDE').g},${by('SLIDE').b})`);
    check('モンスターノーツは金(赤 > 青)',by('MONSTER').r>by('MONSTER').b,`rgb(${by('MONSTER').r},${by('MONSTER').g},${by('MONSTER').b})`);
    console.log(`  1フレームの JS 時間(${NOTES.length}ノーツ・Chromium): 中央値 ${result.jsMedianMs.toFixed(2)}ms / 上位5% ${result.jsP95Ms.toFixed(2)}ms`);
    check('1フレームの JS 時間が 4ms 未満(中央値)',result.jsMedianMs<4,`${result.jsMedianMs.toFixed(2)}ms`);
    if(shotPath){await page.screenshot({path:shotPath});console.log(`  描いた絵: ${shotPath}`);}
  }catch(error){check('実行中にエラー',false,String(error));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nOK: canvas 版のノーツ描画');
  process.exit(failed?1:0);
})();
