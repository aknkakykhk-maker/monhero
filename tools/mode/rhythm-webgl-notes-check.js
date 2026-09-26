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
  // 太さが変わるホールド(holdPoints: [経過ms, サブレーン, 幅])。2026-09-26 ユーザー報告「形の変わるホールドが犯人」
  {type:'HOLD',subLane:4,subLaneWidth:2,holdMs:1400,progress:.95,points:[[0,4,2],[500,2,6],[900,2,6],[1400,4,2]]},
  {type:'HOLD',subLane:8,subLaneWidth:2,holdMs:1800,progress:.7,points:[[0,8,2],[200,7,4],[400,6,6],[600,7,4],[800,8,2],[1000,7,4],[1200,6,6],[1800,8,2]]},
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
  // 形を GPU へ渡す入れ物は、塗るたびに新しく用意する(bufferData)。1つの入れ物を上書きして使い回す(bufferSubData)と、
  // iPhone の Safari(Metal)でまだ終わっていない前の描画が上書き後の形を使い、帯が残像のように残った(2026-09-26・実機)
  const glText=(src.match(/const rhythmCreateGL2D=[\s\S]*?\n\};\n/)||[''])[0];
  check('形は塗るたびに新しい入れ物で渡す(bufferSubData で使い回さない)',/gl\.bufferData\(gl\.ARRAY_BUFFER,data\.subarray\([^)]*\),gl\.STREAM_DRAW\)/.test(glText)&&!/bufferSubData\(/.test(glText));
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
        if(source.points)note.holdPoints=source.points.map(([at,sl,w])=>({timeMs:note.timeMs+at,subLane:sl,subLaneWidth:w}));
        if(source.holdMs){note.endTimeMs=note.timeMs+source.holdMs;if(source.type==='SLIDE'){note.endLane=source.endLane??note.lane;note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];}}
        return note;
      };
      const built=notes.map(build);
      // 何フレームか進めてから写す(押さえている最中の光のように、時刻で形が変わるものも比べるため)
      // additive … WebGL のときだけ光を足し算で重ねる(2026-09-26)。2D と同じ絵かを比べるときは切る
      const draw=(canvas,webgl,effect,additive=false)=>{
        const R=RHYTHM_CANVAS_RENDERER;R.attach(canvas,{webgl});R.additiveGlow=additive;
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
        R.release();R.additiveGlow=true;
        return {backend,data:snap.getContext('2d').getImageData(0,0,snap.width,snap.height).data};
      };
      const out={};
      for(const effect of ['NORMAL','LIGHT','MINIMAL']){
        let a,b,c,error='';
        try{a=draw(document.createElement('canvas'),false,effect);b=draw(document.createElement('canvas'),true,effect);c=draw(document.createElement('canvas'),true,effect,true);}
        catch(e){error=String(e&&e.message||e);}
        if(error){out[effect]={error};continue;}
        const A=a.data,B=b.data;let sum=0,opaqueA=0,opaqueB=0,missingInGl=0,extraInGl=0;
        for(let i=0;i<A.length;i+=4){
          for(let k=0;k<4;k++)sum+=Math.abs(A[i+k]-B[i+k]);
          if(A[i+3]>128){opaqueA++;if(B[i+3]<32)missingInGl++;}
          if(B[i+3]>128){opaqueB++;if(A[i+3]<32)extraInGl++;}
        }
        // 足し算ありの WebGL: 2D で描けている画素が抜けていないか、光のぶん明るくなっているか(色の合計)
        const C=c.data;let missingAdd=0,lumB=0,lumC=0;
        for(let i=0;i<A.length;i+=4){if(A[i+3]>128&&C[i+3]<32)missingAdd++;lumB+=B[i]+B[i+1]+B[i+2];lumC+=C[i]+C[i+1]+C[i+2];}
        out[effect]={backends:[a.backend,b.backend],avg:sum/A.length,opaqueA,opaqueB,missingInGl,extraInGl,missingAdd,brighter:lumB>0?lumC/lumB:0};
      }
      return out;
    },{notes:NOTES,travelMs:2150});
    check('ページでエラーが出ない',errors.length===0,errors[0]||'');
    for(const [effect,r] of Object.entries(result)){
      if(r.error){check(`演出量 ${effect}: WebGL で描いても例外が出ない`,false,r.error);continue;}
      check(`演出量 ${effect}: WebGL の描き込み先で描けている`,r.backends[0]==='2d'&&r.backends[1]==='webgl',r.backends.join(' / '));
      check(`演出量 ${effect}: 何かが描かれている`,r.opaqueA>2000,`${r.opaqueA}画素`);
      check(`演出量 ${effect}: 光の足し算ありでも、2D で描けている画素が抜けていない`,r.missingAdd<r.opaqueA*.005,`${r.missingAdd} / ${r.opaqueA}`);
      check(`演出量 ${effect}: 光の足し算で明るくなる(暗くならない)`,r.brighter>=1,r.brighter.toFixed(3));
      // 輪郭のなめらかさだけ違うので、平均の差はごく小さい(実測 0.6/255 前後)
      check(`演出量 ${effect}: 2D と WebGL の画素の差が小さい(平均 1.5/255 未満)`,r.avg<1.5,r.avg.toFixed(3));
      check(`演出量 ${effect}: 2D で描けていて WebGL で抜けている画素がほぼ無い(0.5%未満)`,r.missingInGl<r.opaqueA*.005,`${r.missingInGl} / ${r.opaqueA}`);
      check(`演出量 ${effect}: WebGL だけに余計に描かれた画素がほぼ無い(0.5%未満)`,r.extraInGl<r.opaqueB*.005,`${r.extraInGl} / ${r.opaqueB}`);
    }
    // ---- 太さが変わるホールドの帯を、WebGL の三角形分けがはみ出さずに塗れるか(2026-09-26) ----
    // ユーザー報告「ノーツ残像バグ / 形の変わるホールドが犯人」。へこんだ帯で耳を切る方式が行き詰まり、
    // 1点からの扇に逃げてへこみの外まで塗っていた(細くなったところに前の太さが残って見えた)。
    // 実際の譜面の太さが変わるホールドを、いろいろな高さで帯の形にして、WebGL と同じ三角形分けに通し、
    // 帯の外を塗った画素・帯の中の抜けを数える。三角形分けのコードは rhythm-mode.js からそのまま切り出す
    {
      const src=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
      const from=src.indexOf('  const isConvex=pts=>{'),to=src.indexOf('  const textureOf=source=>{');
      check('三角形分けのコードを切り出せた',from>0&&to>from);
      const audit=await page.evaluate(({TRI})=>{
        let data=[],fellBack=false;
        const T=new Function('tri','markOverlap',TRI.replace(/triOverlap=true/g,'markOverlap()')+';return {triangulate};')((...t)=>data.push(t),()=>{fellBack=true;});
        const rect={width:390,height:700},noteHeight=20,spawnY=-noteHeight,travelMs=2150,travelPx=rect.height*.86-spawnY;
        const yFor=p=>spawnY+rhythmProjectTravelProgress(p)*travelPx;
        const inPoly=(x,y,pts)=>{let c=false;const k=pts.length/2;for(let i=0,j=k-1;i<k;j=i++){const xi=pts[i*2],yi=pts[i*2+1],xj=pts[j*2],yj=pts[j*2+1];if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;}return c;};
        const inTri=(x,y,t)=>{const s=(ax,ay,bx,by)=>(bx-ax)*(y-ay)-(by-ay)*(x-ax);const d1=s(t[0],t[1],t[2],t[3]),d2=s(t[2],t[3],t[4],t[5]),d3=s(t[4],t[5],t[0],t[1]);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));};
        const out={holds:0,shapes:0,fellBack:0,outside:0,missing:0,worst:''};
        for(const song of RHYTHM_SONGS)for(const [id,chart] of Object.entries(song.difficulties||{}))for(const note of (chart&&chart.notes)||[]){
          if(!rhythmNoteHasHoldPoints(note))continue;out.holds++;
          const hold=note.endTimeMs-note.timeMs;
          for(let p=.05;p<1.5;p+=.05){
            const yPx=Math.round(yFor(Math.min(p,1.3))),releaseYpx=Math.round(yFor(p-hold/travelMs)),bodyPx=Math.max(0,yPx-releaseYpx);if(!(bodyPx>0))continue;
            const visualTime=note.timeMs-(1-p)*travelMs;
            const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,rect,noteHeight,releaseYpx,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},bodyPx);
            const band=geo.band;if(!band||band.length<2)continue;
            const pts=[];band.forEach(e=>pts.push(e.right,e.y));for(let i=band.length-1;i>=0;i--)pts.push(band[i].left,band[i].y);
            data=[];fellBack=false;T.triangulate(pts);out.shapes++;if(fellBack)out.fellBack++;
            let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;for(let i=0;i<pts.length;i+=2){minX=Math.min(minX,pts[i]);maxX=Math.max(maxX,pts[i]);minY=Math.min(minY,pts[i+1]);maxY=Math.max(maxY,pts[i+1]);}
            let outside=0,missing=0;
            for(let y=Math.floor(Math.max(minY,0))+.5;y<Math.min(maxY,rect.height);y+=2)for(let x=Math.floor(minX)+.5;x<maxX;x+=2){const inside=inPoly(x,y,pts),cov=data.some(t=>inTri(x,y,t));if(cov&&!inside)outside++;if(inside&&!cov)missing++;}
            out.outside+=outside;out.missing+=missing;
            if((outside+missing)>0&&!out.worst)out.worst=`${song.songId} ${id} ${note.timeMs}ms 外${outside}/抜け${missing}`;
          }
        }
        return out;
      },{TRI:src.slice(from,to)});
      console.log(`      太さが変わるホールド ${audit.holds}本・形 ${audit.shapes}通り`);
      check('実際の譜面に太さが変わるホールドがある(この確認が空振りしていない)',audit.holds>0&&audit.shapes>0,`${audit.holds}本`);
      check('太さが変わるホールドの帯で、1点からの扇に逃げない',audit.fellBack===0,`${audit.fellBack} / ${audit.shapes}`);
      check('太さが変わるホールドの帯を、帯の外まで塗らない・抜けを作らない',audit.outside===0&&audit.missing===0,audit.worst||'はみ出し 0・抜け 0');
    }
  }catch(error){check('実行中にエラー',false,String(error));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nOK: WebGL の描き込み先は 2D と同じ絵を描けている');
  process.exit(failed?1:0);
})();
