// モンヒロビートのノーツ描画が、1フレームあたりどれだけ「レイアウト」と「塗り直し」を
// 起こしているかを実際のブラウザで数える。発熱対策(2026-09-07)の物差し。
//
// 演奏中の発熱は、毎フレームの仕事量でほぼ決まる。ノーツの位置決めは transform(合成側)だけで
// 済む形にしてあるが、幅・高さ・left/top・filter を毎フレーム書くと、そのたびに
// レイアウト(要素の寸法の計算)と塗り直し(画素の作り直し)が走る。塗り直しは画素数に比例するので、
// 画面の広い端末ほど熱くなる。この検査は「ノーツを落とすあいだ、レイアウトが起きないこと」と
// 「塗り直しが HOLD/SLIDE の帯ぶんだけに収まっていること」を数値で確かめる。
//
// 測りかた:
//   本番の rhythm-mode.js を読み込んだページに、本体のプレイ画面と同じ構造のノーツ
//   (TAP×6・FLICK×1・HOLD×2・SLIDE×1)を置き、本体の tick と同じ順番で
//   transform / 帯の高さ / rhythmLayoutNoteVisual を毎フレーム呼ぶ。
//   ウォームアップ後の一定フレームを Chromium のトレースで記録し、
//   Layout / UpdateLayoutTree(スタイル再計算) / Paint / RasterTask の回数を1フレームあたりで出す。
//
//   node tools/mode/rhythm-render-cost-check.js            # 検査(しきい値あり)
//   node tools/mode/rhythm-render-cost-check.js --report   # 数値だけ出す(しきい値で落とさない)
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=8981;
const REPORT_ONLY=process.argv.includes('--report');
// --types=TAP,HOLD のように種類を絞ると、どの種類が負担を作っているかを切り分けられる(数値だけ出す)
const TYPE_FILTER=(process.argv.find(arg=>arg.startsWith('--types='))||'').slice(8).split(',').filter(Boolean);
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

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 本体のプレイ画面と同じノーツ構造(30-rhythm-play.jsx の noteElements)。
// 見た目のクラスは Tailwind なので、ここでは同じ意味のCSSを直接書く。
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden}
[data-rhythm-note]{position:absolute;top:0;height:20px;pointer-events:none}
[data-rhythm-note]>span:last-child{position:absolute;inset:0;border-radius:9999px;background:linear-gradient(#fde68a,#d946ef);box-shadow:0 10px 15px -3px rgba(0,0,0,.24)}
[data-rhythm-note][data-note-type="HOLD"]>span:last-child{border:2px solid rgba(255,255,255,.9);background:linear-gradient(#ecfeff,#22d3ee)}
[data-rhythm-hold-body]{position:absolute;left:18%;right:18%;bottom:50%;height:var(--rhythm-hold-body,0px);border-radius:8px 8px 0 0;background:linear-gradient(to top,rgba(52,211,153,.9),rgba(103,232,249,.7))}
[data-rhythm-end-bar]{position:absolute;z-index:2;height:8px;border-radius:9999px;border:1px solid rgba(255,255,255,.8);background:linear-gradient(90deg,#e879f9,#cffafe,#e879f9);box-shadow:0 0 10px #67e8f9,0 0 18px #d946ef;pointer-events:none}
</style></head><body>
<div id="area" data-rhythm-play-area><i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px"></i></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;

const ALL_NOTES=[
  {type:'TAP',subLane:0,subLaneWidth:2,offset:0},
  {type:'TAP',subLane:4,subLaneWidth:2,offset:.08},
  {type:'TAP',subLane:8,subLaneWidth:2,offset:.16},
  {type:'TAP',subLane:2,subLaneWidth:3,offset:.24},
  {type:'TAP',subLane:6,subLaneWidth:1,offset:.32},
  {type:'TAP',subLane:3,subLaneWidth:4,offset:.40},
  {type:'FLICK',subLane:7,subLaneWidth:2,offset:.12},
  {type:'HOLD',subLane:0,subLaneWidth:2,holdMs:700,offset:.05},
  {type:'HOLD',subLane:6,subLaneWidth:4,holdMs:500,offset:.30},
  {type:'SLIDE',lane:1,endLane:3,subLaneWidth:2,holdMs:700,offset:.20},
];
const NOTES=TYPE_FILTER.length?ALL_NOTES.filter(note=>TYPE_FILTER.includes(note.type)):ALL_NOTES;
const WARMUP_FRAMES=30,MEASURE_FRAMES=120,TRAVEL_MS=2150;

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(0);}}
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
    const ready=await page.evaluate(()=>typeof rhythmLayoutNoteVisual==='function'&&typeof rhythmProjectTravelProgress==='function');
    check('位置決め関数がブラウザ側で使える',ready);
    if(!ready){await browser.close();server.close();process.exit(1);}

    const measure=async notes=>{
    // ノーツを置き、本体の tick と同じ手順で動かす関数をページ側へ用意する
    await page.evaluate(({notes,travelMs})=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const line=area.querySelector('[data-rhythm-judgment-line]');
      const areaRect=area.getBoundingClientRect(),lineRect=line.getBoundingClientRect();
      const noteHeight=20,spawnY=-noteHeight,judgmentY=lineRect.top-areaRect.top+lineRect.height/2-noteHeight/2,travelPx=judgmentY-spawnY;
      area.querySelectorAll('[data-rhythm-note]').forEach(el=>el.remove());
      const built=notes.map(source=>{
        const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2)};
        if(source.subLane!=null)note.subLane=source.subLane;
        if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
        if(source.holdMs){
          note.endTimeMs=note.timeMs+source.holdMs;
          if(source.type==='SLIDE'){note.endLane=source.endLane??note.lane;note.slidePoints=[{timeMs:note.timeMs,lane:note.lane},{timeMs:note.endTimeMs,lane:note.endLane}];}
        }
        const el=document.createElement('div');
        el.dataset.rhythmNote='';el.dataset.noteType=note.type;
        el.style.left=`calc(${note.lane*20}% + 5px)`;el.style.width='calc(20% - 10px)';
        if(note.type==='HOLD'){const body=document.createElement('span');body.dataset.rhythmHoldBody='';el.appendChild(body);}
        if(note.type==='SLIDE'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.dataset.rhythmSlideBody='';svg.setAttribute('aria-hidden','true');el.appendChild(svg);}
        if(note.type==='HOLD'||note.type==='SLIDE'){const bar=document.createElement('span');bar.dataset.rhythmEndBar='';el.appendChild(bar);}
        const head=document.createElement('span');head.dataset.rhythmNoteHead='';
        if(note.type==='HOLD'){const mark=document.createElement('i');mark.dataset.rhythmHoldHeadMark='';head.appendChild(mark);}
        const shade=document.createElement('i');shade.dataset.rhythmNoteShade='';shade.setAttribute('aria-hidden','true');head.appendChild(shade);
        el.appendChild(head);
        area.appendChild(el);
        return {note,el,offset:source.offset,holdMs:source.holdMs||0};
      });
      const yFor=p=>spawnY+rhythmProjectTravelProgress(p)*travelPx;
      window.__rhythmBench={
        frame(step){
          const rect=area.getBoundingClientRect();
          built.forEach(({note,el,offset,holdMs})=>{
            const progress=((step*0.0045)+offset)%1.1-.05;
            const visible=progress>=-.1&&progress<=1.18;
            const nextOpacity=visible?'1':'0';
            if(el._rhythmOpacity!==nextOpacity){el.style.opacity=nextOpacity;el._rhythmOpacity=nextOpacity;}
            const nextWillChange=visible?'transform, opacity':'';
            if(el._rhythmWillChange!==nextWillChange){el.style.willChange=nextWillChange;el._rhythmWillChange=nextWillChange;}
            const live=visible?'1':'';
            if(el._rhythmLive!==live){if(live)el.dataset.rhythmLive=live;else delete el.dataset.rhythmLive;el._rhythmLive=live;}
            if(!visible)return;
            const yPx=Math.round(yFor(progress));
            const nextTransform=`translate3d(0,${yPx}px,0)`;
            if(el._rhythmTransform!==nextTransform){el.style.transform=nextTransform;el._rhythmTransform=nextTransform;}
            const releaseProgress=progress-holdMs/travelMs;
            const releaseYpx=Math.round(yFor(releaseProgress)),bodyPx=Math.max(0,yPx-releaseYpx);
            if(note.type==='HOLD'){const holdBody=`${Math.round(bodyPx)}px`;if(el._rhythmHoldBody!==holdBody){el.style.setProperty('--rhythm-hold-body',holdBody);el._rhythmHoldBody=holdBody;}}
            if(note.type==='SLIDE'){const slideBody=`${Math.round(bodyPx)}px`;if(el._rhythmSlideBody!==slideBody){el.style.setProperty('--rhythm-slide-height',slideBody);el.style.setProperty('--rhythm-slide-visible-height',slideBody);el._rhythmSlideBody=slideBody;}}
            const visualTime=note.timeMs-(1-progress)*travelMs;
            rhythmLayoutNoteVisual(el,note,yPx,note.lane,area,
              note.endTimeMs!=null?releaseYpx:null,
              {chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},
              {rect,noteHeight,bodyHeight:bodyPx});
          });
        },
        async run(from,count){
          for(let step=from;step<from+count;step++){
            this.frame(step);
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          }
        },
      };
    },{notes,travelMs:TRAVEL_MS});

    await page.evaluate(({count})=>window.__rhythmBench.run(0,count),{count:WARMUP_FRAMES});

    const tracePath=path.join(require('os').tmpdir(),`rhythm-render-cost-${process.pid}.json`);
    await browser.startTracing(page,{path:tracePath,categories:['disabled-by-default-devtools.timeline','devtools.timeline','blink']});
    await page.evaluate(({from,count})=>window.__rhythmBench.run(from,count),{from:WARMUP_FRAMES,count:MEASURE_FRAMES});
    await browser.stopTracing();
    const trace=JSON.parse(fs.readFileSync(tracePath,'utf8'));
    fs.unlinkSync(tracePath);
    const events=Array.isArray(trace)?trace:(trace.traceEvents||[]);
    const countOf=name=>events.filter(event=>event.name===name&&(event.ph==='X'||event.ph==='B')).length;
    const durationOf=name=>events.filter(event=>event.name===name&&event.ph==='X').reduce((sum,event)=>sum+(event.dur||0),0)/1000;
    const frames=Math.max(1,countOf('DrawFrame')||MEASURE_FRAMES);
    const per=name=>countOf(name)/MEASURE_FRAMES;
    return {
      frames,
      layout:per('Layout'),
      recalc:per('UpdateLayoutTree'),
      paint:per('Paint'),
      raster:per('RasterTask'),
      layoutMs:durationOf('Layout')/MEASURE_FRAMES,
      recalcMs:durationOf('UpdateLayoutTree')/MEASURE_FRAMES,
      paintMs:durationOf('Paint')/MEASURE_FRAMES,
      rasterMs:durationOf('RasterTask')/MEASURE_FRAMES,
    };
    };
    const show=(label,notes,stats)=>{
    console.log(`[${label}] 1フレームあたり(${MEASURE_FRAMES}フレーム・同時表示${notes.length}ノーツ・描画フレーム${stats.frames})`);
    console.log(`  レイアウト        ${stats.layout.toFixed(2)}回 / ${stats.layoutMs.toFixed(3)}ms`);
    console.log(`  スタイル再計算    ${stats.recalc.toFixed(2)}回 / ${stats.recalcMs.toFixed(3)}ms`);
    console.log(`  塗り直し(Paint)   ${stats.paint.toFixed(2)}回 / ${stats.paintMs.toFixed(3)}ms`);
    console.log(`  ラスタライズ      ${stats.raster.toFixed(2)}回 / ${stats.rasterMs.toFixed(3)}ms`);
    };
    const stats=await measure(NOTES);
    show(TYPE_FILTER.length?TYPE_FILTER.join('+'):'全種類',NOTES,stats);
    const outPath=path.join(ROOT,'tools/mode/authoring/rhythm-render-cost.json');
    if(process.argv.includes('--write')){
      fs.writeFileSync(outPath,JSON.stringify({measuredAt:new Date().toISOString().slice(0,10),notes:NOTES.length,frames:MEASURE_FRAMES,perFrame:stats},null,2)+'\n');
      console.log(`書き出し: ${path.relative(ROOT,outPath)}`);
    }
    if(!REPORT_ONLY&&!TYPE_FILTER.length){
      // 帯を持たない TAP/FLICK は、落ちているあいだ何も塗り直さない(粒・影の層は合成レイヤーで transform と opacity だけ)。
      const taps=NOTES.filter(note=>note.type==='TAP'||note.type==='FLICK');
      const tapStats=await measure(taps);
      show('TAP+FLICK',taps,tapStats);
      check('TAP/FLICK は落ちているあいだレイアウトも塗り直しも起こさない',tapStats.layout===0&&tapStats.paint===0,`レイアウト${tapStats.layout.toFixed(2)}回 / 塗り直し${tapStats.paint.toFixed(2)}回`);
      // HOLD は帯の形(clipPath)が毎フレーム変わるので塗り直しは残るが、高さ・left・width を書かないのでレイアウトは起きない。
      const holds=NOTES.filter(note=>note.type==='HOLD');
      const holdStats=await measure(holds);
      show('HOLD',holds,holdStats);
      check('HOLD は帯が伸びてもレイアウトを起こさない(scaleY で伸縮)',holdStats.layout===0,`${holdStats.layout.toFixed(2)}回/フレーム`);
      check('HOLD の塗り直しは帯ぶんに収まる(HOLD×2 で1フレームあたり4回以下)',holdStats.paint<=4,`${holdStats.paint.toFixed(2)}回/フレーム`);
      // SLIDE は帯の形(SVGのpolygon)が毎フレーム変わり、SVGは形の更新でレイアウトを1回起こす(SVGの中だけ)。
      // 全種類を合わせても、レイアウトはその1回、塗り直しは帯を持つ3ノーツぶんに収まること。
      check('全種類を合わせてもレイアウトは SLIDE のSVG更新1回だけ(1フレームあたり1回以下)',stats.layout<=1,`${stats.layout.toFixed(2)}回/フレーム`);
      check('全種類を合わせても塗り直しは帯を持つノーツ(HOLD×2・SLIDE×1)の範囲(1フレームあたり6回以下)',stats.paint<=6,`${stats.paint.toFixed(2)}回/フレーム`);
    }
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nOK: ノーツ描画の1フレームあたりの負担');
  process.exit(failed?1:0);
})().catch(error=>{console.error(error);process.exit(1);});
