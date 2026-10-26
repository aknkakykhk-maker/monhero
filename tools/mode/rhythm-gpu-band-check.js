// スライドの帯を GPU に一度だけ置いて描く描き方(作り替え B・rhythmCreateGpuSlideBand)が、今の描き方と同じ絵を描けているかを画素で確かめる(2026-10-11)。
//
// 社長の決まり「既存の全曲は今の描き方と画素で突き合わせて同じであること(止まる演出の曲・参考版2曲も)」のための検査。
// 譜面ごとに、スライドが見えている場面をいくつか選び、その時刻に見えているノーツ全部(粒・帯・スライド)を
//   A: 今の描き方(canvas 2D。CPU で帯を刻む)
//   B: 今の WebGL の描き方(CPU で帯を刻み、WebGL の描き込み先で描く)
//   C: 新しい描き方(WebGL の描き込み先で、帯と区切りの線を GPU に置いた形で描く)
// の3通りで描き、C を A・B と比べる。押さえている最中・取り損ね・流れる光・ノーツサイズ80%・演出量 最小 も混ぜる。
// 比べる曲: 公開中の全曲・全難易度、Sheriruth 全難易度(止まる演出)、デバッグの試作の枠(sheriruth_proto・止まる演出の参考版2曲)。
//
// ずれたときは、rhythm-mode.js の rhythmCreateGpuSlideBand の頂点シェーダー(BAND_VS)が、
// rhythmSlideSegmentQuads の project(奥行きの投影・空中の持ち上げ)と同じ式になっているかを見る。
// Playwright が無い環境では SKIP。
//   node tools/mode/rhythm-gpu-band-check.js            全部
//   node tools/mode/rhythm-gpu-band-check.js --quick    譜面ごとの場面を減らして速く(手元の確かめ用)
//   node tools/mode/rhythm-gpu-band-check.js --song sheriruth   その曲だけ
//   node tools/mode/rhythm-gpu-band-check.js --song <曲> --dump <フォルダ>  場面ごとに 今の2D・今のWebGL・新しい描き方・差 の画像を書き出す(差を目で見る用)
//   node tools/mode/rhythm-gpu-band-check.js --extra <譜面.json>  まだ main に無い譜面(HELL など)も比べる。[{songId,difficulties:{名前:{notes,scrollChanges,scrollGroups}}}] の形
const fs=require('fs'),path=require('path'),http=require('http');
// 番号はほかの検査と重ねない(まとめて回したときにぶつかるため)
const ROOT=path.resolve(__dirname,'../..'),PORT=Number(process.env.GPU_BAND_PORT)||9187;
const QUICK=process.argv.includes('--quick');
const ONLY=(()=>{const i=process.argv.indexOf('--song');return i>=0?process.argv[i+1]:'';})();
const DUMP=(()=>{const i=process.argv.indexOf('--dump');return i>=0?path.resolve(process.argv[i+1]):'';})();
const EXTRA=(()=>{const i=process.argv.indexOf('--extra');return i>=0?JSON.parse(fs.readFileSync(process.argv[i+1],'utf8')):[];})();
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#000}</style></head><body>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;
// 許す幅。ふちのなめらかさ(アンチエイリアス)と、帯の刻み方(今の描き方はいまの位置から刻み、新しい描き方は譜面の点から刻む)の差だけが出る
// bigOver: 差の大きい画素(どれかの値が64以上違う)が、今の WebGL と 2D の間より何画素多いか。細い線(区切りの線)の抜けは平均の差に埋もれるので、これで見る
//   色は「濃さを掛けた色」(画面に重ねたときに出る色)で比べる(2026-10-11)。ほぼ透明な画素(薄い光のふち)は、濃さを掛ける前の色だと
//   なめらかさのわずかな違い(1画素の5%)でも 64 以上ずれて数えられてしまう(ノーツの板を GPU で描いたときに演出量 最小の場面で出た)
//   押さえている帯の切り口(判定ラインの所で横にまっすぐ切る)は、なめらかさの差が高さ1画素の横一列に出る。横長(844x390)の太い帯では
//   それだけで200画素を越えた(2026-10-21 black_shout HELL)ので、上下どちらにも差の大きい画素が無い画素は数えない(区切りの線は4画素の太さなので残る)
// avg: 今の WebGL がもともと 2D から上限近くまで離れている場面(重なった空中スライドの取り損ね・2026-10-21 sad_song HELL で 1.445)は、
//   今の WebGL より overBase 以上離れたときだけ NG にする(新しい描き方が今の WebGL と同じ絵なら通す)
const LIMIT={avg:1.5,missing:.003,extra:.003,overBase:.3,bigOver:200};
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
    const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:2});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'networkidle'});
    const ready=await page.evaluate(()=>typeof RHYTHM_CANVAS_RENDERER==='object'&&typeof rhythmCreateGpuSlideBand==='function'&&typeof rhythmCreateGL2D==='function');
    check('帯を GPU に置く部品と canvas の描画部品が使える',ready);
    if(!ready)throw new Error('部品が無い');
    await page.evaluate(extra=>{window.__EXTRA_SONGS=extra;},EXTRA);
    // 譜面の一覧(曲・難易度)
    const charts=await page.evaluate(only=>{
      const list=[];
      const add=(song,proto)=>{for(const [id,chart] of Object.entries(song.difficulties||{})){const notes=(chart&&chart.notes)||[];if(!notes.some(n=>rhythmNoteIsSlide(n)))continue;if(only&&song.songId!==only)continue;list.push({songId:song.songId,id,proto});}};
      RHYTHM_SONGS.forEach(s=>add(s,false));(typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[]).forEach(s=>add(s,true));(window.__EXTRA_SONGS||[]).forEach(s=>add(s,true));
      return list;
    },ONLY);
    console.log(`      スライドのある譜面 ${charts.length}本`);
    check('比べる譜面がある(この確認が空振りしていない)',charts.length>0);
    const SIZES=[{w:844,h:390},{w:390,h:700}];
    const totals={frames:0,slides:0,gpuSlides:0,lines:0,worst:{avg:0,missing:0,extra:0,where:''},worstB:{avg:0,where:''},overBase:{d:-1,where:''},bigOver:{d:-1e9,where:''},bad:[],stops:0,sky:0};
    for(let ci=0;ci<charts.length;ci++){
      const c=charts[ci];
      const r=await page.evaluate(({c,ci,SIZES,QUICK,DUMP})=>{
        const song=[...(window.__EXTRA_SONGS||[]),...RHYTHM_SONGS,...(typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[])].find(s=>s.songId===c.songId);
        const chart=song.difficulties[c.id];
        // 演奏画面と同じく、スライドには描く点の並びと区切りの線の時刻を焼き込んでおく(30-rhythm-play.jsx の makeRuntimeNotes と同じ。
        // 焼き込まないと区切りの線を描かず、線の突き合わせが空振りする)
        const cpInterval=rhythmSlideCheckpointIntervalMs(c.id,chart.level);
        const notes=chart.notes.map((note,index)=>({...note,index,...(note.type==='SLIDE'?{_rhythmSlideRenderPoints:rhythmSlidePoints(note),_rhythmSlideCheckpoints:rhythmSlideCheckpointTimes(note,cpInterval)}:{})}));
        // 画面の大きさ・ノーツの速さは譜面ごとに決める(曲名から。--song で絞っても同じ場面になる)
        const hash=[...(c.songId+'/'+c.id)].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7);
        const size=SIZES[hash%SIZES.length],rect={width:size.w,height:size.h};
        const noteHeight=20,travelMs=[2150,1300,3000][(hash>>>3)%3],spawnY=-noteHeight,judgmentY=rect.height*.86-noteHeight/2,travelPx=judgmentY-spawnY;
        rhythmScrollSet(chart.scrollChanges,travelMs,chart.scrollGroups);
        RHYTHM_SKY_LIFT.set(size.w>size.h);
        const slides=notes.filter(n=>rhythmNoteIsSlide(n));
        // 場面: スライドを譜面全体から均等に選び、「近づいてくる所」と「押さえている最中」を描く
        const pick=QUICK?2:4,frames=[];
        for(let k=0;k<pick;k++){
          const s=slides[Math.floor((k+.5)/pick*slides.length)];if(!s)continue;
          const end=rhythmReleaseTargetMs(s);
          frames.push({t:s.timeMs-travelMs*.45,variant:k});
          frames.push({t:s.timeMs+Math.max(1,(end-s.timeMs)*.4),variant:k+1});
        }
        // 止まる演出の曲は、止まっている最中の場面も
        const stops=Array.isArray(chart.scrollChanges)?chart.scrollChanges.filter(x=>Number(x[1])===0||x[1]==='RUSH'):[];
        if(stops.length){const st=stops[Math.floor(stops.length/2)];frames.push({t:Number(st[0])+60,variant:2});}
        // 後ろに戻る演出(['MOVE',マイナス])の曲は、戻っている最中の場面も(2026-10-11 Grievous Lady の試作)
        const backs=Array.isArray(chart.scrollChanges)?chart.scrollChanges.filter(x=>x[1]==='MOVE'&&Number(x[2])<0):[];
        backs.slice(0,QUICK?1:3).forEach((bk,i)=>frames.push({t:Number(bk[0])+150+i*120,variant:i}));
        const R=RHYTHM_CANVAS_RENDERER;
        // variant ごとの見た目の違い(押さえている最中・取り損ね・流れる光・ノーツサイズ・演出量)
        const style=v=>({effect:v%5===4?'MINIMAL':'NORMAL',motion:v%3===1,sizeScale:v%4===3?.8:1,failEvery:v%5===2});
        const drawFrame=(fr,gpu)=>{
          const st=style(fr.variant),visualTime=fr.t;
          R.begin(rect,{nowMs:1000+fr.variant*137,effect:st.effect,lightweight:false,maxDpr:2,sizeScale:st.sizeScale,motion:st.motion});
          let drawnSlides=0,gpuSlides=0,lines=0;
          for(const note of notes){
            const progress=1-(rhythmScrollPos(note.timeMs,note.scrollGroup)-rhythmScrollPos(visualTime,note.scrollGroup))/travelMs;
            const hasBody=rhythmNoteHasBody(note),end=rhythmReleaseTargetMs(note);
            const holding=hasBody&&note.timeMs<=visualTime&&visualTime<end;
            const visible=holding||(progress>=-.1&&progress<=1.18);
            if(!visible)continue;
            const yPx=Math.round(spawnY+rhythmProjectTravelProgress(progress)*travelPx);
            const releaseProgress=1-(rhythmScrollPos(end,note.scrollGroup)-rhythmScrollPos(visualTime,note.scrollGroup))/travelMs,releaseYpx=Math.round(spawnY+rhythmProjectTravelProgress(releaseProgress)*travelPx),bodyPx=Math.max(0,yPx-releaseYpx);
            const geo=rhythmNoteCanvasGeometry(note,yPx,note.lane,rect,noteHeight,hasBody?releaseYpx:null,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx,gpu},hasBody?bodyPx:0);
            const isSlide=rhythmNoteIsSlide(note);if(isSlide){drawnSlides++;if(geo.slideGpu){gpuSlides++;if(!rhythmSlideHasSky(note))lines+=rhythmSlideCheckpointLines(note,visualTime,{chartNowMs:visualTime,visualTime,travelMs,spawnY,travelPx},rect,noteHeight/2).length;}}
            const failedNote=st.failEvery&&isSlide&&(note.index??note.timeMs)%2===1;
            const depthScale=Math.round((0.56+geo.scale*.44)*100)/100,brightness=Math.round((0.72+geo.scale*.28)*100)/100;
            R.drawNote(note,geo,{failed:failedNote,monster:false,wide:rhythmNoteIsWide(note),pressed:holding&&!failedNote,slideOff:holding&&isSlide&&!failedNote&&(note.index??note.timeMs)%3===0/* 指が帯から外れて暗くなる状態も2Dと突き合わせる */,heldMs:visualTime-note.timeMs,alpha:failedNote?.34:1,pop:null,depthScale,brightness});
          }
          R.end();
          return {drawnSlides,gpuSlides,lines};
        };
        const snap=canvas=>{const s=document.createElement('canvas');s.width=canvas.width;s.height=canvas.height;const x=s.getContext('2d');x.drawImage(canvas,0,0);return x.getImageData(0,0,s.width,s.height).data;};
        const results=frames.map(()=>({}));
        // A: 2D
        {const cv=document.createElement('canvas');R.attach(cv,{webgl:false});R.additiveGlow=false;R.warmSprites({effect:'NORMAL',lightweight:false,maxDpr:2});
          frames.forEach((fr,i)=>{drawFrame(fr,false);results[i].A=snap(cv);});R.release();}
        // B・C: WebGL(同じ描き込み先で、帯を CPU で刻む/GPU に置く)
        let backend='',gpuReady=false;
        {const cv=document.createElement('canvas');R.attach(cv,{webgl:true,gpuBand:true});R.additiveGlow=false;R.warmSprites({effect:'NORMAL',lightweight:false,maxDpr:2});backend=R.backend;gpuReady=R.gpuBand;
          frames.forEach((fr,i)=>{drawFrame(fr,false);results[i].B=snap(cv);const n=drawFrame(fr,true);results[i].C=snap(cv);results[i].n=n;});R.release();R.additiveGlow=true;}
        const BIG=64;
        const W=size.w*2;
        const cmp=(X,Y)=>{let sum=0,opaqueX=0,opaqueY=0,missing=0,extra=0,big=0;const mask=new Uint8Array(X.length/4);
          for(let i=0;i<X.length;i+=4){let d=0;const ax=X[i+3]/255,ay=Y[i+3]/255;for(let k=0;k<4;k++){const e=Math.abs(X[i+k]-Y[i+k]);sum+=e;const p=k<3?Math.abs(X[i+k]*ax-Y[i+k]*ay):e;if(p>d)d=p;}if(d>=BIG)mask[i/4]=1;if(X[i+3]>128){opaqueX++;if(Y[i+3]<32)missing++;}if(Y[i+3]>128){opaqueY++;if(X[i+3]<32)extra++;}}
          for(let j=0;j<mask.length;j++)if(mask[j]&&((j>=W&&mask[j-W])||(j+W<mask.length&&mask[j+W])))big++;
          return {avg:sum/X.length,missing:opaqueX?missing/opaqueX:0,extra:opaqueY?extra/opaqueY:0,opaque:opaqueX,big};};
        const toUrl=(data,diffWith)=>{const s=document.createElement('canvas');s.width=size.w*2;s.height=size.h*2;const x=s.getContext('2d');const img=x.createImageData(s.width,s.height);
          if(diffWith){for(let i=0;i<data.length;i+=4){let d=0;for(let k=0;k<4;k++)d=Math.max(d,Math.abs(data[i+k]-diffWith[i+k]));img.data[i]=Math.min(255,d*4);img.data[i+1]=d>24?255:0;img.data[i+2]=0;img.data[i+3]=255;}}
          else{for(let i=0;i<data.length;i+=4){const a=data[i+3]/255;img.data[i]=data[i]+(1-a)*11;img.data[i+1]=data[i+1]+(1-a)*18;img.data[i+2]=data[i+2]+(1-a)*36;img.data[i+3]=255;}}
          x.putImageData(img,0,0);return s.toDataURL('image/png');};
        const out=results.map((r,i)=>({t:Math.round(frames[i].t),variant:frames[i].variant,n:r.n,CA:cmp(r.A,r.C),BA:cmp(r.A,r.B),CB:cmp(r.B,r.C),
          dump:DUMP?{A:toUrl(r.A),B:toUrl(r.B),C:toUrl(r.C),D:toUrl(r.C,r.A)}:null}));
        return {backend,gpuReady,size,travelMs,frames:out,stops:stops.length,sky:rhythmChartHasSky(notes)};
      },{c,ci,SIZES,QUICK,DUMP:!!DUMP});
      if(r.backend!=='webgl'||!r.gpuReady){check(`${c.songId} ${c.id}: WebGL と帯の部品が使える`,false,`${r.backend} / ${r.gpuReady}`);continue;}
      if(r.stops)totals.stops++;if(r.sky)totals.sky++;
      for(const f of r.frames){
        totals.frames++;totals.slides+=f.n.drawnSlides;totals.gpuSlides+=f.n.gpuSlides;totals.lines+=f.n.lines;
        const where=`${c.songId} ${c.id} ${f.t}ms(${r.size.w}x${r.size.h}・速さ${r.travelMs}ms・場面${f.variant})`;
        if(f.dump){fs.mkdirSync(DUMP,{recursive:true});for(const [k,url] of Object.entries(f.dump))fs.writeFileSync(path.join(DUMP,`${c.songId}_${c.id}_${f.t}_${k}.png`),Buffer.from(url.split(',')[1],'base64'));}
        if(f.CA.avg>totals.worst.avg)totals.worst={...totals.worst,avg:f.CA.avg,where};
        totals.worst.missing=Math.max(totals.worst.missing,f.CA.missing);totals.worst.extra=Math.max(totals.worst.extra,f.CA.extra);
        if(f.BA.avg>totals.worstB.avg)totals.worstB={avg:f.BA.avg,where};
        const over=f.CA.avg-f.BA.avg;if(over>totals.overBase.d)totals.overBase={d:over,where};
        const bigOver=f.CA.big-f.BA.big;if(bigOver>totals.bigOver.d)totals.bigOver={d:bigOver,where,ca:f.CA.big,ba:f.BA.big};
        const bad=f.CA.avg>=Math.max(LIMIT.avg,f.BA.avg+LIMIT.overBase)||f.CA.missing>=LIMIT.missing||f.CA.extra>=LIMIT.extra||over>=LIMIT.overBase||bigOver>=LIMIT.bigOver;
        if(bad)totals.bad.push(`${where} 平均${f.CA.avg.toFixed(3)}(今のWebGL ${f.BA.avg.toFixed(3)})・抜け${(f.CA.missing*100).toFixed(2)}%・余計${(f.CA.extra*100).toFixed(2)}%・大きく違う画素 +${bigOver}`);
      }
      process.stdout.write(`\r      ${ci+1}/${charts.length} ${c.songId} ${c.id}                    `);
    }
    process.stdout.write('\n');
    console.log(`      場面 ${totals.frames}・描いたスライド ${totals.slides}(うち GPU で描いた ${totals.gpuSlides})・区切りの線 ${totals.lines}本・止まる演出の譜面 ${totals.stops}・空中のある譜面 ${totals.sky}`);
    console.log(`      新しい描き方と今の 2D の差: 平均の最大 ${totals.worst.avg.toFixed(3)}/255(${totals.worst.where})・抜けの最大 ${(totals.worst.missing*100).toFixed(3)}%・余計の最大 ${(totals.worst.extra*100).toFixed(3)}%`);
    console.log(`      (参考)今の WebGL と今の 2D の差: 平均の最大 ${totals.worstB.avg.toFixed(3)}/255(${totals.worstB.where})`);
    console.log(`      新しい描き方が今の WebGL より 2D から離れた分の最大 ${totals.overBase.d.toFixed(3)}/255(${totals.overBase.where})`);
    console.log(`      大きく違う画素(差64以上)が今の WebGL より多い分の最大 ${totals.bigOver.d}画素(${totals.bigOver.where}・新しい描き方 ${totals.bigOver.ca}/今の WebGL ${totals.bigOver.ba})`);
    check('ページでエラーが出ない',errors.length===0,errors[0]||'');
    check('スライドを GPU で描けている(場面のスライドを全部 GPU で描いた)',totals.slides>0&&totals.gpuSlides===totals.slides,`${totals.gpuSlides} / ${totals.slides}`);
    if(!ONLY)check('区切りの線も比べている(この確認が空振りしていない)',totals.lines>0,`${totals.lines}本`);
    if(!ONLY)check('止まる演出の譜面も比べている',totals.stops>0,`${totals.stops}本`);
    check(`どの場面も今の描き方と同じ絵(平均の差 ${LIMIT.avg}/255 未満・抜けと余計 ${LIMIT.missing*100}% 未満・今の WebGL より ${LIMIT.overBase}/255 以上離れない・大きく違う画素が今の WebGL より ${LIMIT.bigOver} 以上多くない)`,totals.bad.length===0,totals.bad.length?`${totals.bad.length}場面: ${totals.bad.slice(0,3).join(' / ')}`:'');
  }catch(error){check('実行中にエラー',false,String(error&&error.stack||error));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nOK: スライドの帯を GPU に置く描き方は、今の描き方と同じ絵を描けている');
  process.exit(failed?1:0);
})();
