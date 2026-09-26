// 検証用の WebGL の描き方(rhythmCreateGL2D)が、ふだんの canvas(2D)と同じ絵を描けているかを確かめる(2026-09-26)。
//
// ノーツの描き方のコードは1つだけで、同じ命令を 2D の canvas か WebGL の描き込み先へ出している。
// そのため、ノーツの色や形を変えると WebGL にもそのまま効く。ただし WebGL の描き込み先は
// canvas の命令を全部は知らないので、知らない命令(ぼかしの影・放射グラデーション など)を
// ノーツの描き方に足すと、WebGL のときだけその部分が出ない(または止まる)。ここで気づけるようにする。
//
//   ・同じノーツの並び(粒・帯・終端・FLICK・横フリック・SLIDE・モンスター・取り損ね・押さえている最中)を
//     2D と WebGL の両方で描き、画素を比べる(演出量 最大/標準/最小 のそれぞれ)
//   ・2D では描けているのに WebGL では抜けている画素(またはその逆)が無いか
//   ・WebGL で描いているあいだに例外が出ないか
//
// ずれたときは、WebGL の描き込み先(rhythm-mode.js の rhythmCreateGL2D)に足りない命令を足すか、
// ノーツの描き方をどちらでも描ける命令へ直す。Playwright が無い環境では SKIP。
//   node tools/mode/rhythm-webgl-notes-check.js
const fs=require('fs'),path=require('path'),http=require('http');
// 番号はほかの検査と重ねない(まとめて回したときにぶつかるため)
const ROOT=path.resolve(__dirname,'../..'),PORT=9173;
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden;background:#0b1224}
</style></head><body>
<div id="area" data-rhythm-play-area><i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px;background:#fff"></i></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;
// rhythm-canvas-render-check.js と同じ並びに、押さえている最中(pressed)の HOLD・SLIDE と横フリックを足した
const NOTES=[
  {type:'TAP',subLane:4,subLaneWidth:2,progress:.6},
  {type:'FLICK',subLane:8,subLaneWidth:2,progress:.7},
  {type:'FLICK',subLane:2,subLaneWidth:2,progress:.45,flickDir:'left'},
  {type:'FLICK',subLane:9,subLaneWidth:2,progress:.4,flickDir:'right'},
  {type:'HOLD',subLane:0,subLaneWidth:2,holdMs:700,progress:.8},
  {type:'SLIDE',lane:1,endLane:3,subLaneWidth:2,holdMs:900,progress:.9},
  {type:'TAP',subLane:6,subLaneWidth:2,progress:.5,monster:true},
  {type:'TAP',subLane:2,subLaneWidth:6,progress:.95},
  {type:'HOLD',subLane:6,subLaneWidth:4,holdMs:500,progress:1.0,endFlick:true},
  {type:'HOLD',subLane:8,subLaneWidth:2,holdMs:900,progress:.75,failed:true},
  {type:'HOLD',subLane:10,subLaneWidth:2,holdMs:1200,progress:1.15,pressed:true},
  {type:'SLIDE',lane:4,endLane:2,subLaneWidth:2,holdMs:1400,progress:1.2,pressed:true},
];
// 塗り側(フラグメントシェーダ)で画素座標のまま大きな数を掛けない(2026-09-26・実機「スライドやホールドで
// ノーツラインが残像になるみたい」)。塗り側の精度が低い(16ビットの)GPU では長い帯で桁があふれ、色が崩れて線や段が残る。
// グラデーションの位置は頂点側で 0〜1 にしてから渡す(vT)。
{
  const src=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  const fsText=(src.match(/const FS='([\s\S]*?)';\n/)||[])[1]||'';
  const vsText=(src.match(/const VS='([\s\S]*?)';\n/)||[])[1]||'';
  check('シェーダを読めた',!!fsText&&!!vsText);
  check('グラデーションの位置は頂点側で計算して渡している(vT)',/varying float vT/.test(vsText)&&/vT=dot\(aPos-uG0,d\)/.test(vsText)&&/clamp\(vT,0\.0,1\.0\)/.test(fsText));
  check('塗り側で画素座標(vPos・uG0・uG1)を使っていない',!/vPos|uG0|uG1/.test(fsText));
}
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
    const ready=await page.evaluate(()=>typeof RHYTHM_CANVAS_RENDERER==='object'&&typeof rhythmCreateGL2D==='function');
    check('WebGL の描き込み先と canvas の描画部品が使える',ready);
    if(!ready)throw new Error('部品が無い');
    const result=await page.evaluate(({notes,travelMs})=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const areaRect=area.getBoundingClientRect(),line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line.getBoundingClientRect();
      const noteHeight=20,spawnY=-noteHeight,judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2,travelPx=judgmentY-spawnY;
      const yFor=p=>spawnY+rhythmProjectTravelProgress(p)*travelPx;
      const build=(source,index)=>{
        const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2),index};
        if(source.subLane!=null)note.subLane=source.subLane;
        if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
        if(source.flickDir)note.flickDir=source.flickDir;
        if(source.endFlick)note.endFlick=true;
        if(source.holdMs){note.endTimeMs=note.timeMs+source.holdMs;if(source.type==='SLIDE'){note.endLane=source.endLane??note.lane;note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];}}
        return note;
      };
      const built=notes.map(build);
      // 何フレームか進めてから写す(押さえている最中の光のように、時刻で形が変わるものも比べるため)
      const draw=(canvas,webgl,effect)=>{
        const R=RHYTHM_CANVAS_RENDERER;R.attach(canvas,{webgl});
        R.warmSprites({effect,lightweight:false,maxDpr:2});
        let backend=R.backend;
        for(let step=0;step<6;step++){
          R.begin({width:areaRect.width,height:areaRect.height},{nowMs:1000+step*16.7,effect,lightweight:false,maxDpr:2,sizeScale:1});
          built.forEach((note,i)=>{
            const source=notes[i],progress=source.progress;
            const yPx=Math.round(yFor(progress)),releaseYpx=Math.round(yFor(progress-(source.holdMs||0)/travelMs)),bodyPx=Math.max(0,yPx-releaseYpx);
            const visualTime=note.timeMs-(1-progress)*travelMs,hasBody=rhythmNoteHasBody(note);
            const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,areaRect,noteHeight,hasBody?releaseYpx:null,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},hasBody?bodyPx:0);
            const depthScale=Math.round((0.56+geo.scale*.44)*100)/100,brightness=Math.round((0.72+geo.scale*.28)*100)/100;
            R.drawNote(note,geo,{failed:!!source.failed,monster:!!source.monster,wide:note.subLaneWidth>=5,pressed:!!source.pressed,alpha:source.failed?.34:1,pop:null,depthScale,brightness});
          });
          R.end();
        }
        // WebGL の絵は、描き終わった直後(同じ処理の中)なら 2D へ写して読める
        const snap=document.createElement('canvas');snap.width=canvas.width;snap.height=canvas.height;snap.getContext('2d').drawImage(canvas,0,0);
        R.release();
        return {backend,data:snap.getContext('2d').getImageData(0,0,snap.width,snap.height).data};
      };
      const out={};
      for(const effect of ['NORMAL','LIGHT','MINIMAL']){
        let a,b,error='';
        try{a=draw(document.createElement('canvas'),false,effect);b=draw(document.createElement('canvas'),true,effect);}
        catch(e){error=String(e&&e.message||e);}
        if(error){out[effect]={error};continue;}
        const A=a.data,B=b.data;let sum=0,opaqueA=0,opaqueB=0,missingInGl=0,extraInGl=0;
        for(let i=0;i<A.length;i+=4){
          for(let k=0;k<4;k++)sum+=Math.abs(A[i+k]-B[i+k]);
          if(A[i+3]>128){opaqueA++;if(B[i+3]<32)missingInGl++;}
          if(B[i+3]>128){opaqueB++;if(A[i+3]<32)extraInGl++;}
        }
        out[effect]={backends:[a.backend,b.backend],avg:sum/A.length,opaqueA,opaqueB,missingInGl,extraInGl};
      }
      return out;
    },{notes:NOTES,travelMs:2150});
    check('ページでエラーが出ない',errors.length===0,errors[0]||'');
    for(const [effect,r] of Object.entries(result)){
      if(r.error){check(`演出量 ${effect}: WebGL で描いても例外が出ない`,false,r.error);continue;}
      check(`演出量 ${effect}: WebGL の描き込み先で描けている`,r.backends[0]==='2d'&&r.backends[1]==='webgl',r.backends.join(' / '));
      check(`演出量 ${effect}: 何かが描かれている`,r.opaqueA>2000,`${r.opaqueA}画素`);
      // 輪郭のなめらかさだけ違うので、平均の差はごく小さい(実測 0.6/255 前後)
      check(`演出量 ${effect}: 2D と WebGL の画素の差が小さい(平均 1.5/255 未満)`,r.avg<1.5,r.avg.toFixed(3));
      check(`演出量 ${effect}: 2D で描けていて WebGL で抜けている画素がほぼ無い(0.5%未満)`,r.missingInGl<r.opaqueA*.005,`${r.missingInGl} / ${r.opaqueA}`);
      check(`演出量 ${effect}: WebGL だけに余計に描かれた画素がほぼ無い(0.5%未満)`,r.extraInGl<r.opaqueB*.005,`${r.extraInGl} / ${r.opaqueB}`);
    }
  }catch(error){check('実行中にエラー',false,String(error));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nOK: WebGL の描き込み先は 2D と同じ絵を描けている');
  process.exit(failed?1:0);
})();
