// 音ゲーのノーツ・HOLD帯・SLIDE帯・ENDバーが、レーンと同じprojectionから外れていないかを
// 実際のブラウザで測って確かめる。
//
// 実際に「ノーツサイズを上げるとHOLD帯がレーン境界からはみ出す」不具合を出した。原因は
// ノーツの親要素へ noteSize の scale を掛けていたことで、子のHOLD帯・SLIDE帯・ENDバーまで
// 一緒に拡大され、帯が伸びた先の幅が clipPath / polygon の前提とズレていた。
// 帯は速度が速いほど長くなるため、高速ほどズレが目立つ。
//
// 文字列一致だけでは「拡大が子へ波及しているか」を判定できないので、ここでは
//   ・ノーツ頭の中心と幅
//   ・HOLD帯の上端/下端の中心と幅
//   ・SLIDE帯の各segmentの中心と幅
//   ・ENDバーの中心と幅
// を実測し、共通projection(rhythmProjectBoundary)から計算した期待値と突き合わせる。
//
//   node tools/mode/rhythm-note-geometry-audit.js
const fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=8979;
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 速度→travel(ms)は純関数なので、実装をそのまま取り出して確かめる ---
const speedSource=game.match(/const RHYTHM_NOTE_TRAVEL_BASE_MS=[\s\S]*?const rhythmTravelMsForSpeed=[\s\S]*?\n\};/)?.[0];
const rangeSource=game.match(/const RHYTHM_NOTE_SPEED_MIN=[\s\S]*?const RHYTHM_NOTE_SPEED_STEP=[^\n]*/)?.[0];
check('ノーツ速度の範囲と変換式を実装から取り出せる',!!speedSource&&!!rangeSource);
let travelMsForSpeed=null,SPEED={min:1,max:12,step:.1};
if(speedSource&&rangeSource){
  const context={DEFAULT_RHYTHM_SETTINGS:{noteSpeed:6}};
  vm.runInNewContext(`${rangeSource}\n${speedSource}\nthis.out={rhythmTravelMsForSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP};`,context);
  travelMsForSpeed=context.out.rhythmTravelMsForSpeed;
  SPEED={min:context.out.RHYTHM_NOTE_SPEED_MIN,max:context.out.RHYTHM_NOTE_SPEED_MAX,step:context.out.RHYTHM_NOTE_SPEED_STEP};
  check('速度は1.0〜12.0を0.1刻みで扱う',SPEED.min===1&&SPEED.max===12&&Math.abs(SPEED.step-.1)<1e-9,`${SPEED.min}〜${SPEED.max} / ${SPEED.step}刻み`);
  check('6.0は従来の見た目(2150ms)を維持',travelMsForSpeed(6)===2150,`${travelMsForSpeed(6)}ms`);
  const targets=[[1,7000],[3,5000],[8,1300],[10,800],[12,500]];
  targets.forEach(([speed,expected])=>check(`速度${speed.toFixed(1)}は約${expected}ms`,Math.abs(travelMsForSpeed(speed)-expected)<=60,`${travelMsForSpeed(speed)}ms`));
  let monotonic=true,noStep=0;
  for(let speed=SPEED.min;speed<=SPEED.max-SPEED.step/2;speed+=SPEED.step){
    const here=travelMsForSpeed(Math.round(speed*10)/10),next=travelMsForSpeed(Math.round((speed+SPEED.step)*10)/10);
    if(!(next<here))monotonic=false;
    if(next===here)noStep++;
  }
  check('速度を上げるほどtravelは必ず短くなる(0.1刻みで停滞しない)',monotonic&&noStep===0,`停滞${noStep}件`);
  check('範囲外の値は端へ丸める',travelMsForSpeed(-5)===travelMsForSpeed(1)&&travelMsForSpeed(99)===travelMsForSpeed(12));
  check('壊れた値は既定の6.0へ落ちる',travelMsForSpeed(undefined)===2150&&travelMsForSpeed('x')===2150&&travelMsForSpeed(null)===2150);
}

// --- 実描画の測定 ---
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
    const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT,()=>resolve(server));
});

// 本物のプレイ画面と同じノーツDOM(index.html / game-system.jsx のノーツ構造)
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden}
[data-rhythm-note]{position:absolute;top:0;height:20px;pointer-events:none}
[data-rhythm-note]>span:last-child{position:absolute;inset:4px 0;border-radius:5px;background:#fff}
[data-rhythm-hold-body]{position:absolute;left:18%;right:18%;bottom:50%;height:var(--rhythm-hold-body,0px);background:#0f0}
[data-rhythm-end-bar]{position:absolute;height:8px;background:#f0f}
</style></head><body>
<div id="area" data-rhythm-play-area><i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px"></i></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;

const NOTE_CASES=[
  {id:'TAP 幅1 左端',type:'TAP',subLane:0,subLaneWidth:1},
  {id:'TAP 幅1 右端',type:'TAP',subLane:9,subLaneWidth:1},
  {id:'TAP 幅2 中央',type:'TAP',subLane:4,subLaneWidth:2},
  {id:'TAP 幅3',type:'TAP',subLane:2,subLaneWidth:3},
  {id:'TAP 幅4',type:'TAP',subLane:6,subLaneWidth:4},
  {id:'FLICK 幅2',type:'FLICK',subLane:8,subLaneWidth:2},
  {id:'HOLD 幅1',type:'HOLD',subLane:0,subLaneWidth:1,holdMs:700},
  {id:'HOLD 幅2',type:'HOLD',subLane:4,subLaneWidth:2,holdMs:700},
  {id:'HOLD 幅4',type:'HOLD',subLane:6,subLaneWidth:4,holdMs:700},
  {id:'SLIDE 幅2 直線',type:'SLIDE',lane:1,subLaneWidth:2,holdMs:700},
  {id:'SLIDE 幅1 0.5レーン',type:'SLIDE',lane:.5,subLaneWidth:1,holdMs:700},
  {id:'SLIDE 幅4 移動',type:'SLIDE',lane:2.5,endLane:1,subLaneWidth:4,holdMs:700},
];
const SPEEDS=[1,3,6,10,12],SIZES=[80,100,120],PROGRESSES=[.5,.9];

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(failed?1:0);}}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:800}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'networkidle'});
    check('rhythm-mode.js を読み込んでもエラーにならない',errors.length===0,errors[0]||'');
    const helpersReady=await page.evaluate(()=>typeof rhythmLayoutNoteVisual==='function'&&typeof rhythmProjectBoundary==='function'&&typeof rhythmProjectionEdgeRatios==='function');
    check('共通projection helperがブラウザ側で使える',helpersReady);
    if(!helpersReady){await browser.close();server.close();console.log(`\n${failed}件のNGがあります`);process.exit(1);}

    const results=await page.evaluate(({cases,speeds,sizes,progresses,travelPoints,speedMin})=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const line=area.querySelector('[data-rhythm-judgment-line]');
      const travelMsForSpeed=speed=>{
        const offset=Math.max(0,Math.min(travelPoints.length-1,speed-speedMin));
        const index=Math.max(0,Math.min(travelPoints.length-2,Math.floor(offset)));
        return Math.round(travelPoints[index]+(travelPoints[index+1]-travelPoints[index])*(offset-index));
      };
      const out=[];
      for(const size of sizes){
        area.style.setProperty('--rhythm-note-size-scale',String(size/100));
        for(const speed of speeds){
          const travelMs=travelMsForSpeed(speed);
          for(const progress of progresses){
            for(const source of cases){
              const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2)};
              if(source.subLane!=null)note.subLane=source.subLane;
              if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
              if(source.holdMs){
                note.endTimeMs=note.timeMs+source.holdMs;
                if(source.type==='SLIDE'){
                  note.endLane=source.endLane??note.lane;
                  note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];
                }
              }
              const el=document.createElement('div');
              el.dataset.rhythmNote='';el.dataset.noteType=note.type;
              el.style.left='0px';el.style.width='60px';
              if(note.type==='HOLD'){const body=document.createElement('span');body.dataset.rhythmHoldBody='';el.appendChild(body);}
              if(note.type==='SLIDE'){
                const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
                svg.dataset.rhythmSlideBody='';el.appendChild(svg);
              }
              if(note.type==='HOLD'||note.type==='SLIDE'){const bar=document.createElement('span');bar.dataset.rhythmEndBar='';el.appendChild(bar);}
              const head=document.createElement('span');el.appendChild(head);
              area.appendChild(el);

              const areaRect=area.getBoundingClientRect(),lineRect=line.getBoundingClientRect();
              const noteHeight=20;
              const spawnY=-noteHeight,judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2;
              const travelPx=judgmentY-spawnY;
              const yFor=p=>spawnY+rhythmProjectTravelProgress(p)*travelPx;
              const yPx=Math.round(yFor(progress));
              const releaseProgress=progress-(source.holdMs||0)/travelMs;
              const releaseYpx=Math.round(yFor(releaseProgress));
              const bodyPx=Math.max(0,yPx-releaseYpx);
              // 本体のtickと同じ手順で配置する(scaleは掛けない)
              el.style.transform=`translate3d(0,${yPx}px,0)`;
              if(note.type==='HOLD')el.style.setProperty('--rhythm-hold-body',`${Math.round(bodyPx)}px`);
              const visualTime=note.timeMs-(1-progress)*travelMs;
              rhythmLayoutNoteVisual(el,note,yPx,note.lane,area,
                note.endTimeMs!=null?releaseYpx:null,
                {chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},
                {rect:areaRect,noteHeight,bodyHeight:bodyPx});

              const norm=rect=>({center:(rect.left+rect.width/2-areaRect.left)/areaRect.width,width:rect.width/areaRect.width,left:(rect.left-areaRect.left)/areaRect.width});
              const headRect=norm(head.getBoundingClientRect());
              const centerY=yPx+noteHeight/2,yRatio=Math.max(0,Math.min(1,centerY/areaRect.height));
              const expected=note.type==='SLIDE'
                ?rhythmProjectSlideSpan(note.lane,note,yRatio,visualTime)
                :(note.subLane!=null?rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,yRatio):rhythmProjectSubLaneSpan(note.lane*2,2,yRatio));
              const row={id:source.id,type:note.type,size,speed,progress,travelMs,bodyPx,
                head:headRect,expectedCenter:expected.center,expectedWidth:expected.width,
                laneLeft:rhythmProjectBoundary(0,yRatio),laneRight:rhythmProjectBoundary(5,yRatio)};

              const bodyEl=el.querySelector('[data-rhythm-hold-body],[data-rhythm-slide-body]');
              if(bodyEl){
                const bodyRect=norm(bodyEl.getBoundingClientRect());
                row.bodyWidthRatio=bodyRect.width;
                row.bodyLeftRatio=bodyRect.left;
                if(note.type==='HOLD'){
                  const clip=bodyEl.style.clipPath.match(/-?[\d.]+(?=%)/g)?.map(Number)||[];
                  if(clip.length>=8){
                    // polygon(topLeft% 0, topRight% 0, bottomRight% 100%, bottomLeft% 100%)
                    const topLeft=clip[0],topRight=clip[2],bottomRight=clip[4],bottomLeft=clip[6];
                    const toArea=fraction=>bodyRect.left+fraction/100*bodyRect.width;
                    row.bandTop={center:(toArea(topLeft)+toArea(topRight))/2,width:toArea(topRight)-toArea(topLeft)};
                    row.bandBottom={center:(toArea(bottomLeft)+toArea(bottomRight))/2,width:toArea(bottomRight)-toArea(bottomLeft)};
                    const topY=Math.max(0,Math.min(areaRect.height,centerY-bodyPx));
                    const topRatio=topY/areaRect.height;
                    const topSpan=note.subLane!=null?rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,topRatio):rhythmProjectSubLaneSpan(note.lane*2,2,topRatio);
                    row.bandTopExpectedCenter=topSpan.center;
                    row.bandTopLaneLeft=rhythmProjectBoundary(0,topRatio);
                    row.bandTopLaneRight=rhythmProjectBoundary(5,topRatio);
                  }
                }
                if(note.type==='SLIDE'){
                  const polygon=bodyEl.querySelector('polygon');
                  const points=(polygon?.getAttribute('points')||'').split(' ').map(pair=>pair.split(',').map(Number));
                  if(points.length>=4){
                    const xs=points.map(p=>p[0]/areaRect.width);
                    row.slideSpan={min:Math.min(...xs),max:Math.max(...xs)};
                  }
                }
              }
              const endBar=el.querySelector('[data-rhythm-end-bar]');
              if(endBar&&note.endTimeMs!=null){
                const barRect=norm(endBar.getBoundingClientRect());
                row.end={center:barRect.center,width:barRect.width};
                const endY=Math.max(0,Math.min(1,(releaseYpx+noteHeight/2)/areaRect.height));
                const endSpan=note.type==='SLIDE'
                  ?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,endY,rhythmReleaseTargetMs(note))
                  :(note.subLane!=null?rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,endY):rhythmProjectLane(note.lane,endY));
                row.endExpectedCenter=endSpan.center;
                row.endLaneLeft=rhythmProjectBoundary(0,endY);
                row.endLaneRight=rhythmProjectBoundary(5,endY);
              }
              out.push(row);
              el.remove();
            }
          }
        }
      }
      return out;
    },{cases:NOTE_CASES,speeds:SPEEDS,sizes:SIZES,progresses:PROGRESSES,
       travelPoints:JSON.parse(JSON.stringify((game.match(/const RHYTHM_NOTE_TRAVEL_MS_POINTS=Object\.freeze\(\[([^\]]*)\]\)/)?.[1]||'').split(',').map(v=>v.includes('RHYTHM_NOTE_TRAVEL_BASE_MS')?2150:Number(v)))),
       speedMin:SPEED.min});

    check('全組み合わせを測定できた',results.length===NOTE_CASES.length*SPEEDS.length*SIZES.length*PROGRESSES.length,`${results.length}件`);

    const near=(a,b,tolerance)=>Math.abs(a-b)<=tolerance;
    const worst=(rows,pick)=>rows.reduce((max,row)=>Math.max(max,pick(row)),0);

    // 1. ノーツ頭は共通projectionの中心に乗る
    const headOff=worst(results,row=>Math.abs(row.head.center-row.expectedCenter));
    check('ノーツ頭の中心が共通projectionと一致(全速度・全サイズ)',headOff<=.002,`最大ズレ ${(headOff*390).toFixed(2)}px`);

    // 2. ノーツ頭はnoteSizeで拡縮し、レーン外へは出ない
    const sizeGroups={};
    results.forEach(row=>{const key=`${row.id}|${row.speed}|${row.progress}`;(sizeGroups[key]=sizeGroups[key]||{})[row.size]=row;});
    let scaled=true,scaleDetail='';
    Object.values(sizeGroups).forEach(group=>{
      if(!group[80]||!group[100]||!group[120])return;
      const ratio80=group[80].head.width/group[100].head.width,ratio120=group[120].head.width/group[100].head.width;
      if(!near(ratio80,.8,.03)||!near(ratio120,1.2,.03)){scaled=false;scaleDetail=`${group[100].id} 速度${group[100].speed}: 80%→${ratio80.toFixed(3)} / 120%→${ratio120.toFixed(3)}`;}
    });
    check('ノーツ頭の大きさはnoteSizeにそのまま比例する',scaled,scaleDetail);
    const headOut=results.filter(row=>row.head.left<row.laneLeft-.002||row.head.left+row.head.width>row.laneRight+.002);
    check('ノーツ頭は速度12×サイズ120%でも5レーンの外へ出ない',headOut.length===0,headOut[0]?`${headOut[0].id} 速度${headOut[0].speed} サイズ${headOut[0].size}%`:'');

    // 3. HOLD帯・SLIDE帯はnoteSizeの影響を受けない(親のscaleが波及していない)
    const bodyRows=results.filter(row=>row.bodyWidthRatio!=null);
    const bodyScaled=bodyRows.filter(row=>!near(row.bodyWidthRatio,1,.005));
    check('HOLD/SLIDE帯の座標系はプレイエリア幅のまま(noteSizeが波及していない)',bodyScaled.length===0,
      bodyScaled[0]?`${bodyScaled[0].id} サイズ${bodyScaled[0].size}% で幅が${(bodyScaled[0].bodyWidthRatio*100).toFixed(1)}%`:'');

    // 4. HOLD帯の上端・下端がその高さのレーンgeometryに一致する
    const bandRows=results.filter(row=>row.bandTop);
    const bandBottomOff=worst(bandRows,row=>Math.abs(row.bandBottom.center-row.expectedCenter));
    const bandTopOff=worst(bandRows,row=>Math.abs(row.bandTop.center-row.bandTopExpectedCenter));
    check('HOLD帯の下端中心がノーツ中心と一致',bandBottomOff<=.002,`最大ズレ ${(bandBottomOff*390).toFixed(2)}px`);
    check('HOLD帯の上端中心もその高さのprojectionと一致',bandTopOff<=.002,`最大ズレ ${(bandTopOff*390).toFixed(2)}px`);
    const bandOut=bandRows.filter(row=>
      row.bandBottom.center-row.bandBottom.width/2<row.laneLeft-.002||row.bandBottom.center+row.bandBottom.width/2>row.laneRight+.002||
      row.bandTop.center-row.bandTop.width/2<row.bandTopLaneLeft-.002||row.bandTop.center+row.bandTop.width/2>row.bandTopLaneRight+.002);
    check('HOLD帯は速度12×サイズ120%でもレーンの外へはみ出さない',bandOut.length===0,
      bandOut[0]?`${bandOut[0].id} 速度${bandOut[0].speed} サイズ${bandOut[0].size}%`:'');
    const bandSizeChanged=Object.values(sizeGroups).filter(group=>group[80]?.bandBottom&&group[120]?.bandBottom
      &&!near(group[80].bandBottom.width,group[120].bandBottom.width,.002));
    check('HOLD帯の幅はnoteSizeで変わらない(レーンgeometry基準)',bandSizeChanged.length===0,
      bandSizeChanged[0]?`${bandSizeChanged[0][80].id}`:'');

    // 5. SLIDE帯もレーン内
    const slideRows=results.filter(row=>row.slideSpan);
    const slideOut=slideRows.filter(row=>row.slideSpan.min<Math.min(row.laneLeft,row.bandTopLaneLeft??row.laneLeft)-.01||row.slideSpan.max>Math.max(row.laneRight,row.bandTopLaneRight??row.laneRight)+.01);
    check('SLIDE帯も全速度・全サイズでレーンの外へ出ない',slideOut.length===0,
      slideOut[0]?`${slideOut[0].id} 速度${slideOut[0].speed} サイズ${slideOut[0].size}%`:'');
    const slideSizeChanged=Object.values(sizeGroups).filter(group=>group[80]?.slideSpan&&group[120]?.slideSpan
      &&(!near(group[80].slideSpan.min,group[120].slideSpan.min,.002)||!near(group[80].slideSpan.max,group[120].slideSpan.max,.002)));
    check('SLIDE帯の位置と幅はnoteSizeで変わらない',slideSizeChanged.length===0,slideSizeChanged[0]?`${slideSizeChanged[0][80].id}`:'');

    // 6. ENDバーも同じレーンgeometry基準
    const endRows=results.filter(row=>row.end);
    const endOff=worst(endRows,row=>Math.abs(row.end.center-row.endExpectedCenter));
    check('ENDバーの中心が終端レーンのprojectionと一致',endOff<=.004,`最大ズレ ${(endOff*390).toFixed(2)}px`);
    const endOut=endRows.filter(row=>row.end.center-row.end.width/2<row.endLaneLeft-.004||row.end.center+row.end.width/2>row.endLaneRight+.004);
    check('ENDバーもレーンの外へ出ない',endOut.length===0,endOut[0]?`${endOut[0].id} 速度${endOut[0].speed} サイズ${endOut[0].size}%`:'');
    const endSizeChanged=Object.values(sizeGroups).filter(group=>group[80]?.end&&group[120]?.end
      &&(!near(group[80].end.center,group[120].end.center,.002)||!near(group[80].end.width,group[120].end.width,.002)));
    check('ENDバーの位置と幅はnoteSizeで変わらない',endSizeChanged.length===0,endSizeChanged[0]?`${endSizeChanged[0][80].id}`:'');

    // 7. 速度が上がるほどHOLD帯は長くなる(見た目だけが変わっている)
    const lengthBySpeed=SPEEDS.map(speed=>{
      const row=results.find(r=>r.id==='HOLD 幅2'&&r.speed===speed&&r.size===100&&r.progress===.9);
      return row?row.bodyPx:0;
    });
    check('速度を上げるとHOLD帯が長く見える(1→12で単調に伸びる)',lengthBySpeed.every((value,index)=>index===0||value>lengthBySpeed[index-1]),lengthBySpeed.map((v,i)=>`${SPEEDS[i]}:${Math.round(v)}px`).join(' / '));

    // 8. レーン枠(表示)もノーツと同じ曲線に乗っている
    const edge=await page.evaluate(()=>{
      const ratios=rhythmProjectionEdgeRatios();
      const straight=y=>rhythmProjectBoundary(0,0)+(rhythmProjectBoundary(0,1)-rhythmProjectBoundary(0,0))*y;
      const sampled=ratios.map(y=>({y,curve:rhythmProjectBoundary(0,y),straight:straight(y)}));
      const polygonPoints=rhythmLanePolygon(0).match(/-?[\d.]+(?=%)/g)?.length||0;
      return {maxGap:Math.max(...sampled.map(s=>Math.abs(s.curve-s.straight))),polygonPoints};
    });
    check('レーン枠は2点の台形ではなく曲線に沿った多点ポリゴン',edge.polygonPoints>=20,`${edge.polygonPoints/2}点`);
    check('直線近似との差が実際にある(=多点化する意味がある)',edge.maxGap>.01,`最大 ${(edge.maxGap*390).toFixed(1)}px`);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
