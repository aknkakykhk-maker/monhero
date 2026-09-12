#!/usr/bin/env node
// 本番の canvas 描画が、ノーツの種類ごとに1個あたりどれだけ重いかを実際のブラウザで測る。
//
//   node tools/mode/rhythm-canvas-note-cost.js            # 数値を出す
//   node tools/mode/rhythm-canvas-note-cost.js --strict    # しきい値で落とす
//
// 【なぜ要るか】(2026-09-12・ユーザー指摘)
// 「モンスターノーツでかくつきがまた出てきた / 曲もあわせて遅くなる(重くなる？)ときもある」
//
// 既にある rhythm-render-cost-check.js は **DOM 版**(rhythmLayoutNoteVisual)しか測っていない。
// ところが本番は canvas 版(RHYTHM_CANVAS_NOTES_PUBLIC_RELEASE = true)なので、
// 実際に動いているほうの数字を誰も持っていなかった。原因を推測で潰すのをやめるために作る。
//
// 【測りかた】
// 本物の rhythm-mode.js を読み込んだページで RHYTHM_CANVAS_RENDERER を canvas へ繋ぎ、
// 種類ごとに「同じノーツを1個だけ」毎フレーム描く。2D コンテキストの drawImage / fill /
// stroke を数え、drawNote にかかった時間を測る。スプライトのキャッシュが効いたあとの
// 定常状態を見たいので、ウォームアップぶんは捨てる。
//
// 【読みかた】
// ノーツ1個あたりの drawImage の回数が、そのまま「貼る画素の量」の目安になる。
// 光のスプライトは粒より大きい(ぼかしの余白ぶん)ので、ここが増えるほど発熱時に効く。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=8987;
const STRICT=process.argv.includes('--strict');
const WARMUP=20,FRAMES=200;

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

const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden}
canvas{position:absolute;inset:0}
</style></head><body>
<div id="area" data-rhythm-play-area><canvas data-rhythm-note-canvas></canvas><i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px"></i></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;

// 測る種類。MONSTER は TAP に monsterSlot を付けたもの(本体と同じ扱い)
const CASES=[
  {id:'TAP',       note:{type:'TAP',subLane:4,subLaneWidth:2}},
  {id:'TAP(幅4)',  note:{type:'TAP',subLane:3,subLaneWidth:4}},
  {id:'FLICK',     note:{type:'FLICK',subLane:4,subLaneWidth:2}},
  {id:'HOLD',      note:{type:'HOLD',subLane:4,subLaneWidth:2,holdMs:700}},
  {id:'SLIDE(2点)', note:{type:'SLIDE',lane:1,endLane:3,subLaneWidth:2,holdMs:700}},
  // 配信中の譜面のSLIDEは中継点が7〜9点ある(2点は最小の形)。実際に近いほうも測る。
  {id:'SLIDE(8点)', note:{type:'SLIDE',lane:0,subLaneWidth:2,holdMs:1400,points:8}},
  {id:'MONSTER',   note:{type:'TAP',subLane:4,subLaneWidth:2},monster:true},
];

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
    const ready=await page.evaluate(()=>typeof RHYTHM_CANVAS_RENDERER==='object'&&typeof rhythmNoteCanvasGeometry==='function');
    check('canvas 描画がブラウザ側で使える',ready);
    if(!ready){await browser.close();server.close();process.exit(1);}

    const rows=await page.evaluate(({CASES,WARMUP,FRAMES})=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const canvas=area.querySelector('[data-rhythm-note-canvas]');
      const rect={width:390,height:700,top:0,left:0};
      const noteHeight=20,spawnY=-noteHeight,judgmentY=700*.88-1.5-noteHeight/2,travelPx=judgmentY-spawnY,travelMs=2150;
      // 2D コンテキストの呼び出しを数える。描く内容は変えない(数えるだけ)
      const ctx=canvas.getContext('2d');
      const counts={drawImage:0,fill:0,stroke:0,gradient:0};
      for(const name of ['drawImage','fill','stroke']){
        const original=ctx[name].bind(ctx);
        ctx[name]=(...args)=>{counts[name]++;return original(...args);};
      }
      const originalGradient=ctx.createLinearGradient.bind(ctx);
      ctx.createLinearGradient=(...args)=>{counts.gradient++;return originalGradient(...args);};
      RHYTHM_CANVAS_RENDERER.attach(canvas);

      const build=source=>{
        const note={type:source.type,timeMs:10000,lane:source.lane??Math.floor((source.subLane??0)/2)};
        if(source.subLane!=null)note.subLane=source.subLane;
        if(source.subLaneWidth!=null)note.subLaneWidth=source.subLaneWidth;
        if(source.holdMs){
          note.endTimeMs=note.timeMs+source.holdMs;
          if(source.type==='SLIDE'){
            note.endLane=source.endLane??note.lane;
            const count=Math.max(2,Number(source.points)||2);
            note.slidePoints=Array.from({length:count},(_,i)=>({
              timeMs:note.timeMs+(note.endTimeMs-note.timeMs)*(i/(count-1)),
              // 行ったり来たりさせる(まっすぐより実際の譜面に近い)
              lane:count===2?(i===0?note.lane:note.endLane):(i%2?3:1),
            }));
            note.endLane=note.slidePoints[count-1].lane;
          }
        }
        return note;
      };
      const drawOnce=(note,monster,frame)=>{
        // 画面のまんなかあたりを流れている状態(progress 0.5 前後)を、少しずつ動かしながら描く
        const progress=.45+(frame%40)/400;
        const visualTime=note.timeMs-(1-progress)*travelMs;
        const yPx=Math.round(spawnY+rhythmProjectTravelProgress(progress)*travelPx);
        const hasBody=rhythmNoteHasBody(note);
        const releaseTargetMs=rhythmReleaseTargetMs(note);
        const releaseProgress=1-(releaseTargetMs-visualTime)/travelMs;
        const releaseYpx=Math.round(spawnY+rhythmProjectTravelProgress(releaseProgress)*travelPx);
        const bodyPx=Math.max(0,yPx-releaseYpx);
        const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,rect,noteHeight,hasBody?releaseYpx:null,
          {chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},hasBody?bodyPx:0);
        const depthScale=Math.round((0.56+geo.scale*.44)*100)/100;
        const brightness=Math.round((0.72+geo.scale*.28)*100)/100;
        RHYTHM_CANVAS_RENDERER.drawNote(note,geo,{failed:false,monster,wide:rhythmNoteIsWide(note),
          pressed:false,alpha:1,pop:null,depthScale,brightness});
      };

      const out=[];
      for(const item of CASES){
        const note=build(item.note),monster=!!item.monster;
        // ウォームアップ(スプライトを作らせる)
        for(let f=0;f<WARMUP;f++){
          RHYTHM_CANVAS_RENDERER.begin(rect,{nowMs:f*16,effect:'FULL',lightweight:false,sizeScale:1,dpr:2});
          drawOnce(note,monster,f);
          RHYTHM_CANVAS_RENDERER.end();
        }
        counts.drawImage=counts.fill=counts.stroke=counts.gradient=0;
        const start=performance.now();
        for(let f=0;f<FRAMES;f++){
          RHYTHM_CANVAS_RENDERER.begin(rect,{nowMs:(WARMUP+f)*16,effect:'FULL',lightweight:false,sizeScale:1,dpr:2});
          drawOnce(note,monster,f);
          RHYTHM_CANVAS_RENDERER.end();
        }
        const elapsed=performance.now()-start;
        out.push({id:item.id,ms:elapsed/FRAMES,
          drawImage:counts.drawImage/FRAMES,fill:counts.fill/FRAMES,
          stroke:counts.stroke/FRAMES,gradient:counts.gradient/FRAMES});
      }
      return out;
    },{CASES,WARMUP,FRAMES});

    console.log(`\n[canvas版] ノーツ1個・1フレームあたり(${FRAMES}フレームの平均・dpr2・演出FULL)`);
    console.log('  種類        |  時間   | drawImage | 塗り | 線 | グラデ');
    for(const row of rows){
      console.log(`  ${row.id.padEnd(11)} | ${row.ms.toFixed(4)}ms | ${row.drawImage.toFixed(1).padStart(8)}回 | ${row.fill.toFixed(1).padStart(3)} | ${row.stroke.toFixed(1).padStart(2)} | ${row.gradient.toFixed(1).padStart(4)}`);
    }
    const tap=rows.find(r=>r.id==='TAP'),monster=rows.find(r=>r.id==='MONSTER'),slide=rows.find(r=>r.id==='SLIDE(8点)');
    if(tap&&monster){
      console.log(`\n  モンスターノーツ ÷ ふつうのTAP: 時間 ${(monster.ms/tap.ms).toFixed(2)}倍 / drawImage ${(monster.drawImage/tap.drawImage).toFixed(2)}倍`);
      if(slide)console.log(`  中継点8点のSLIDE ÷ ふつうのTAP: 時間 ${(slide.ms/tap.ms).toFixed(2)}倍 / 塗り ${(slide.fill/tap.fill).toFixed(2)}倍`);
    }

    await browser.close();server.close();
    if(!STRICT){console.log(failed?`\n${failed}件のNGがあります`:'\n(数値を出すだけの道具です。--strict でしきい値を見ます)');process.exit(failed?1:0);}
    // --strict: 「モンスターノーツだけ極端に重い」状態へ戻っていないかを見る
    check('モンスターノーツの drawImage がふつうのTAPの3倍を超えない',monster.drawImage<=tap.drawImage*3,
      `${monster.drawImage.toFixed(1)}回 対 ${tap.drawImage.toFixed(1)}回`);
    console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
    process.exit(failed?1:0);
  }catch(error){
    console.log('NG: 測定できませんでした —',String(error).split('\n')[0]);
    try{await browser?.close();}catch{}
    server.close();process.exit(1);
  }
})();
