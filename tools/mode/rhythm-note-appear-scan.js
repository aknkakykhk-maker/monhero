// ノーツが「初めて見えた位置」を並べる道具(2026-11-22・台帳 r1119-096 追記2「HELL でいきなり表示される」)。
//
//   SONG="Beyond the Same Sky" DIFF=HELL node tools/mode/rhythm-note-appear-scan.js
//   SONG_ID=beyond_the_same_sky_short DIFF=HELL FROM=0 TO=60 node tools/mode/rhythm-note-appear-scan.js
//
// 実際の演奏画面(canvas 版)を横持ち(既定 844×390)で開き、曲の時計(AudioContext.currentTime)を STEP ms(既定50)ずつ止めて進める。
// 止めたコマごとに、描き手(RHYTHM_CANVAS_RENDERER.drawNote)へ渡ったノーツの番号と頭の位置を記録し、
// ノーツごとに「初めて描かれたコマ」の (残り時間・画面の縦の位置・道の奥からの割合) を出す。
// 出始め(progress -0.1)より大きく遅れて初めて描かれたノーツ = いきなり出たノーツ、として一覧にする。
// 撮影(SHOTS=1)は、いきなり出たノーツの直前・直後のコマを OUT へ PNG で残す(数が多いときは先頭から SHOT_MAX 件)。
// SHOT_EVERY=1 FROM=<秒> TO=<秒> で、その範囲のコマを全部撮る(空中と地上の出方を絵で比べる)。
// 縦持ちと比べるときは W=390 H=844。
// 演奏は記録しない(ランキング・自己ベストは測るブラウザの中だけ。本物の保存データには触らない)。
const path=require('path'),http=require('http'),fs=require('fs'),os=require('os');
const ROOT=path.resolve(__dirname,'../..');
const PORT=Number(process.env.PORT||9231);
const SONG=process.env.SONG||'Beyond the Same Sky',SONG_ID=process.env.SONG_ID||'',DIFF=process.env.DIFF||'HELL';
const W=Number(process.env.W||844),H=Number(process.env.H||390),STEP=Number(process.env.STEP||50);
const FROM=Number(process.env.FROM||0),TO=Number(process.env.TO||1e9);
const OUT=process.env.OUT||fs.mkdtempSync(path.join(os.tmpdir(),'mh-appear-'));
const SHOTS=process.env.SHOTS==='1',SHOT_MAX=Number(process.env.SHOT_MAX||12);
const LATE=Number(process.env.LATE||0.15); // 初めて描かれた時の progress がこれより大きければ「いきなり」
fs.mkdirSync(OUT,{recursive:true});
// 空中の持ち上げ方を比べる(2026-11-23・台帳 r1119-123「上がり方を早める」)。配る rhythm-mode.js だけをこのブラウザの中で差し替える(本体は触らない)。
//   SKY_LIFT=rise:<割合> … 上端〜判定ラインの <割合> の所で上がり切る(本体は RHYTHM_SKY_RISE_AT=.25 の案B)
//   SKY_LIFT=old  … 11/22 より前の式(奥の縮み/判定ラインの縮み。上端でも持ち上げが残る)
//   SKY_LIFT=nov22 … 11/22〜11/23 の式(上端で0・判定ラインまで一定の割合で上がる)
//   案を並べた止め絵: docs/progress/beat/sky-rise-2026-11-23/
const SKY_LIFT=process.env.SKY_LIFT||'';
// 前の版と比べる(2026-11-23・台帳 r1119-149): RHYTHM_REV=origin/main で、配る rhythm-mode.js だけをその版の中身にする(git から読むだけ。ファイルは作らない)
const RHYTHM_REV=process.env.RHYTHM_REV||'';let revCache=null;
const revSource=()=>revCache||(revCache=require('child_process').execFileSync('git',['show',`${RHYTHM_REV}:monster-hero/data/rhythm-mode.js`],{cwd:ROOT,maxBuffer:64<<20}).toString('utf8'));
const skyLiftPatched=src=>{
 const rep=(a,b)=>{if(!src.includes(a))throw new Error('差し替える所が見つからない: '+a.slice(0,80));src=src.replace(a,b);};
 const js="rise=u>=1?1:u*(2-u);",sh="float skyRise(float y){float u=y/uSkyRise;return u>=1.0?1.0:u*(2.0-u);}";
 if(SKY_LIFT==='old'){rep(js,"rise=1;");rep(sh,"float skyRise(float y){return 1.0;}");return src;}
 if(SKY_LIFT==='nov22'){
  rep("return RHYTHM_SKY_LIFT.ratio*rhythmProjectionScale(y)/base*rise;","const top=rhythmProjectionScale(0);return RHYTHM_SKY_LIFT.ratio*(rhythmProjectionScale(y)-top)/(base-top);");
  rep("uSkyK*depth(min(yr,1.0))*uRoad*skyRise(yr)*sky","uSkyK*(depth(min(yr,1.0))-uTop)*uRoad*sky");
  rep("const base=rhythmProjectionScale(RHYTHM_JUDGMENT_LINE_Y.ratio);\n","const base=rhythmProjectionScale(RHYTHM_JUDGMENT_LINE_Y.ratio)-rhythmProjectionScale(0);\n");
  return src;}
 const m=/^rise:([\d.]+)$/.exec(SKY_LIFT);if(!m)throw new Error('SKY_LIFT が分からない: '+SKY_LIFT);
 rep("const RHYTHM_SKY_RISE_AT=.25;",`const RHYTHM_SKY_RISE_AT=${Number(m[1])};`);
 return src;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  const t={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.json':'application/json'}[path.extname(f)]||'application/octet-stream';res.writeHead(200,{'Content-Type':t});
  if(SKY_LIFT&&/data[\\/]rhythm-mode\.js$/.test(f)){res.end(skyLiftPatched(fs.readFileSync(f,'utf8')));return;}
  if(RHYTHM_REV&&/data[\\/]rhythm-mode\.js$/.test(f)){res.end(revSource());return;}
  fs.createReadStream(f).pipe(res);}).listen(PORT);
 const b=await require('playwright').chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const MOBILE=process.env.MOBILE!=='0'; // PC で撮るときは MOBILE=0(端末の真似をしない)
 const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1,hasTouch:MOBILE,isMobile:MOBILE});
 await page.addInitScript(({songId,diff,ls})=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
  put('mh_inherited_unique_level_compensation_v1',true);
  // HELL を開く口: 測るブラウザの中だけの MASTER クリアの記録
  if(songId){const rec={bestScore:900000,maxCombo:100,played:true,clear:true,fullCombo:false,allExcellent:false,allMarvelous:false};put('mh_rhythm_best_v1',{[songId]:{HARD:rec,EXPERT:rec,MASTER:rec}});put('mh_rhythm_owned_songs_v1',[songId,songId.replace(/_short$/,''),songId+'_short']);}
  localStorage.setItem('mh_rhythm_canvas_v1','webgl');localStorage.setItem('mh_rhythm_stage_gl_v1','webgl');
  if(ls)for(const [k,v] of Object.entries(ls))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v)); // LS='{"キー":値}' で撮るときだけ入れる保存データ(このブラウザの中だけ)
  const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
  Object.defineProperty(proto,'currentTime',{configurable:true,get(){const f=window.__mhFrozen;if(f&&f.ctx===this)return f.t;return desc.get.call(this);}});
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.duration>30){window.__mhSong={ctx:this.context,t:desc.get.call(this.context),offset:Number(a[1])||0};
   // 止めた時計で少しずつ進める間に、実時間で音源が鳴り終わって曲が終わらないように、曲の音源は繰り返し鳴らし「終わり」の知らせを渡さない
   this.loop=true;Object.defineProperty(this,'onended',{configurable:true,get(){return null;},set(){}});const add=this.addEventListener.bind(this);this.addEventListener=(type,...r)=>type==='ended'?undefined:add(type,...r);}
   return start.apply(this,a);};
  window.__mhFreezeSong=sec=>{const s=window.__mhSong;if(!s)return false;const lat=typeof rhythmAudioOutputLatencyMs==='function'?rhythmAudioOutputLatencyMs(s.ctx)/1000:0;window.__mhFrozen={ctx:s.ctx,t:s.t+(sec-s.offset)+lat};return true;};
  window.__mhDraws=[];
  window.__mhHook=()=>{const R=RHYTHM_CANVAS_RENDERER;if(!R||R.__mhHooked)return;const orig=R.drawNote;R.drawNote=function(note,geo,opt){try{window.__mhDraws.push({i:note.index,t:note.timeMs,type:note._rhythmOriginalType||note.type,sky:typeof rhythmNoteSkyHeight==='function'?rhythmNoteSkyHeight(note):0,lane:note.lane,cx:Math.round(geo.head.cx),cy:Math.round(geo.head.cy),h:Math.round(geo.head.h||0),w:Math.round(geo.head.w),now:Number.isFinite(opt&&opt.heldMs)?note.timeMs+opt.heldMs:null,scale:Math.round((geo.scale||0)*1000)/1000,a:opt&&opt.alpha});}catch(_){}return orig.apply(this,arguments);};R.__mhHooked=true;};
 },{songId:SONG_ID,diff:DIFF,ls:JSON.parse(process.env.LS||'null')});
 const clickText=p=>page.evaluate(s=>{const rx=new RegExp(s);const x=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!x)return false;x.click();return true;},p);
 await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:90000});
 await page.getByRole('button',{name:'TAP TO START'}).click({force:true,timeout:90000});
 await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
 await page.waitForFunction(()=>!!document.querySelector('main.mh-home-scene'),null,{timeout:40000});
 for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK')))break;await page.waitForTimeout(250);}
 await page.evaluate(()=>document.querySelector('[data-home-fac="rhythm"]')?.click());
 await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]',{timeout:30000}).catch(()=>{});
 await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
 await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
 for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK')))break;await page.waitForTimeout(300);}
 const picked=await page.evaluate(({t,id})=>{const els=[...document.querySelectorAll('[data-rhythm-song-list] button, [data-rhythm-song-list] [role=button]')];
  const el=els.find(x=>(x.innerText||'').split('\n').some(l=>l.trim()===t));if(el){el.click();return (el.innerText||'').split('\n')[0];}return null;},{t:SONG,id:SONG_ID});
 await page.waitForTimeout(700);
 if(/_short$/.test(SONG_ID)){await clickText('^short ver');await page.waitForTimeout(500);}
 const diffOk=await clickText('^\\d+ '+DIFF+'$')||await clickText('^\\d+ '+DIFF);
 await page.waitForTimeout(400);
 const selected=await page.evaluate(()=>({diff:document.querySelector('[data-rhythm-demo-difficulty][aria-pressed=true],[aria-pressed=true][data-rhythm-difficulty]')?.innerText||''}));
 if(process.env.DEBUG_SHOT)await page.screenshot({path:path.join(OUT,"select.png")});console.error("曲:",picked,"難易度:",diffOk,JSON.stringify(selected));
 await page.waitForSelector("[data-rhythm-demo-start]",{timeout:15000});
 // LISTEN=1: 曲の鑑賞(ジャケット → 鑑賞の難易度 → 鑑賞する)で始める。ノーツは鑑賞の自動の手が叩く(AUTO_TAP でも道具は押さない)
 if(process.env.LISTEN==='1'){await page.evaluate(()=>[...document.querySelectorAll('button[aria-label]')].find(b=>/ジャケットを大きく見る/.test(b.getAttribute('aria-label')))?.click());
  await page.waitForSelector('[data-rhythm-listen-start]',{timeout:15000});await page.evaluate(d=>document.querySelector(`[data-rhythm-listen-diff="${d}"]`)?.click(),DIFF);await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelector('[data-rhythm-listen-start]').click());}
 else await page.evaluate(()=>document.querySelector("[data-rhythm-demo-start]").click());
 await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
 await page.waitForFunction(()=>!!window.__mhSong,null,{timeout:60000});
 await page.waitForFunction(()=>typeof RHYTHM_CANVAS_RENDERER!=='undefined',null,{timeout:30000});
 await page.evaluate(()=>window.__mhHook());
 // いまの曲の位置より前へは戻せない(演奏画面は時計の後戻りを無視する)ので、いまの位置の直後から止め始める
 await page.evaluate(()=>window.__mhHook());
 await page.waitForFunction(()=>{window.__mhHook();return window.__mhDraws.some(d=>d.now!=null&&d.now!==d.t);},null,{timeout:60000,polling:20});
 const cur=await page.evaluate(()=>{window.__mhHook();const s=window.__mhSong;const v=s.ctx.currentTime-s.t+s.offset;window.__mhFreezeSong(v+0.02);return v+0.02;});
 if(FROM>cur){await page.evaluate(sec=>window.__mhFreezeSong(sec),FROM);}
 const first=Math.round(Math.max(FROM,cur)*1000)/1000+STEP/1000;
 console.error('止め始め',first.toFixed(2),'秒');
 await page.addStyleTag({content:'[data-rhythm-down-vignette],[data-rhythm-life-down-slam]{display:none!important}'});
 const info=await page.evaluate(()=>{const a=document.querySelector('[data-rhythm-play-area]'),r=a.getBoundingClientRect();const cv=[...a.querySelectorAll('canvas')].map(c=>{const q=c.getBoundingClientRect();return {x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height)};});
  const songEnd=(window.__mhSong.ctx&&0)||0;return {area:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)},canvas:cv};});
 const songLen=await page.evaluate(()=>{const s=window.__mhSong;return s?null:null;});
 const raf=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 // REAL_SHOTS=1 PRE_CLICK=… SHOT_AT=…: 時計を止めずに実時間で流し、PRE_CLICK のボタンを押してから、曲の時刻が SHOT_AT に来たら撮る
 //   (鑑賞の「+10秒」は止めた時計とかみ合わないため。撮る時刻は数十ms ずれる)
 if(process.env.REAL_SHOTS==='1'){await page.evaluate(()=>{window.__mhFrozen=null;});await page.waitForTimeout(600);
  const [label,times]=(process.env.PRE_CLICK||':0').split(':');for(let i=0;i<(Number(times)||0);i++){await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').replace(/\s+/g,'').includes(t));if(b)b.click();},label);await page.waitForTimeout(350);}
  for(const x of (process.env.SHOT_AT||'').split(',').map(Number).filter(Number.isFinite)){
   await page.waitForFunction(ms=>{const f=window.__mhTestHooks&&window.__mhTestHooks.rhythmSongMs;const v=f?f():null;return v!=null&&v>=ms;},x*1000-25,{timeout:180000,polling:10});
   const at=await page.evaluate(()=>Math.round(window.__mhTestHooks.rhythmSongMs()));await page.screenshot({path:path.join(OUT,`${process.env.PREFIX||'real'}-${Math.round(x*1000)}.png`)});console.log('撮った',x,'実際',at);}
  await b.close();server.close();return;}
 // PRE_CLICK=<ボタンの字>:<回数>(例 '+10秒:3'): 止めた時計で進める前に、そのボタンを押す(鑑賞の送り戻しの後も演出が出るかを撮る・r1119-141)
 if(process.env.PRE_CLICK){const [label,times]=process.env.PRE_CLICK.split(':');for(let i=0;i<(Number(times)||1);i++){
   const ok=await page.evaluate(t=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').replace(/\s+/g,'').includes(t));if(!b)return false;b.click();return true;},label);console.log('押した',label,ok);await page.waitForTimeout(400);}}
 // AUTO_TAP=1 SHOT_AT=<秒>,…: FROM から STEP ずつ止めた時計を進め、ノーツの時刻が来たら判定ラインのその位置を押して離す(タップだけ。
 //   スライドの押さえは続けないので取り逃しになる)。SHOT_AT の時刻のコマを PREFIX-<ms>.png で撮る(演出の止め絵用・2026-11-23 r1119-141)
 if(process.env.AUTO_TAP==='1'&&process.env.SHOT_AT){const shots=process.env.SHOT_AT.split(',').map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  const cv=info.canvas[0]||{x:0,y:0},tapped=new Set(),end=shots[shots.length-1];let si=0;
  // 叩いたときに始まる動き(element.animate)に、始まった曲の時刻を覚えさせ、すぐ止めておく(実時間で終わって消えないように。撮るときにその経過へ合わせる)
  await page.evaluate(()=>{if(Element.prototype.__mhAnimHooked)return;const orig=Element.prototype.animate;Element.prototype.animate=function(k,o){const a=orig.call(this,k,o);a._mhSongMs=window.__mhNowMs||0;a.pause();return a;};Element.prototype.__mhAnimHooked=true;});
  for(let sec=Math.max(FROM,cur);sec<=end+1e-6;sec=Math.round((sec+STEP/1000)*1000)/1000){
   await page.evaluate(s=>{window.__mhHook();window.__mhDraws=[];window.__mhFreezeSong(s);window.__mhNowMs=s*1000;},sec);await raf();
   const draws=await page.evaluate(()=>{const d=window.__mhDraws;window.__mhDraws=[];return d;});
   for(const d of (process.env.LISTEN==='1'?[]:draws)){if(tapped.has(d.i)||d.t>sec*1000+1||d.t<sec*1000-STEP*2||d.type==='SLIDE'||d.type==='HOLD')continue;tapped.add(d.i);
    await page.mouse.move(cv.x+d.cx,cv.y+d.cy);await page.mouse.down();await page.mouse.up();}
   while(si<shots.length&&shots[si]<=sec+1e-6){await raf();
    // 叩いたときに始まる動き(element.animate)は実時間で進むので、撮る時刻に合わせて止める(始まった曲の時刻からの経過。終わった動きは消す)
    await page.evaluate(now=>{for(const a of (document.getAnimations?document.getAnimations():[])){if(!Number.isFinite(a._mhSongMs))continue;const ms=now-a._mhSongMs;
      const dur=Number(a.effect&&a.effect.getTiming&&a.effect.getTiming().duration)||0;if(ms>dur){a.cancel();continue;}a.pause();a.currentTime=Math.max(0,ms);}},shots[si]*1000);
    await page.screenshot({path:path.join(OUT,`${process.env.PREFIX||'shot'}-${Math.round(shots[si]*1000)}.png`)});si++;}}
  console.log('押した数',tapped.size);if(process.env.DUMP_AT){const want=process.env.DUMP_AT.split(',').map(Number);console.log(JSON.stringify(await page.evaluate(w=>{const r=window.__mhTestHooks&&window.__mhTestHooks.rhythmNoteResults?window.__mhTestHooks.rhythmNoteResults():[];const ns=window.__mhTestHooks.rhythmNotes();return ns.filter(n=>w.some(t=>Math.abs(n.timeMs-t)<2)).map(n=>({t:n.timeMs,sub:n.subLane,type:n.type,j:(r[n.index]||{}).judgment}));},want)));}await b.close();server.close();return;}
 const notes=new Map();let emptyRun=0,firstStep=true;
 // 画面に入った = 頭の真ん中が canvas の上端より下(cy>=TOP)。TOP は既定0(横持ちの上の帯で隠れる分は TOP で足す)
 const TOP=Number(process.env.TOP||0);
 for(let sec=first;sec<=TO;sec=Math.round((sec+STEP/1000)*1000)/1000){
  await page.evaluate(s=>{window.__mhHook();window.__mhDraws=[];window.__mhFreezeSong(s);},sec);
  await raf();
  const draws=await page.evaluate(()=>{const d=window.__mhDraws;window.__mhDraws=[];return d;});
  const ended=await page.evaluate(()=>!document.querySelector('[data-rhythm-play-area]'));
  if(ended)break;
  if(process.env.SHOT_EVERY==='1')await page.screenshot({path:path.join(OUT,`step-${Math.round(sec*1000)}.png`)}); // FROM〜TO の全コマを撮る(短い範囲で使う)
  const seen=new Set();
  for(const d of draws){if(d.now===d.t)continue; // 演奏前の温め(heldMs:0)の描画は数えない
   if(seen.has(d.i))continue;seen.add(d.i);const now=d.now;const lead=now==null?null:d.t-now;
   let n=notes.get(d.i);
   if(!n){n={firstNow:now,i:d.i,t:d.t,type:d.type,sky:d.sky,lane:d.lane,atStart:firstStep,firstSec:sec,firstLead:lead,firstY:d.cy,firstX:d.cx,firstScale:d.scale,lastSec:sec,gaps:0,on:null,prevY:d.cy};notes.set(d.i,n);}
   else{if(Math.round((sec-n.lastSec)*1000)>STEP+1)n.gaps++;
    if(n.on&&d.cy-n.prevY>60&&!n.jump&&lead!=null&&lead>100)n.jump={sec,lead,from:n.prevY,to:d.cy};
    n.lastSec=sec;n.prevY=d.cy;}
   if(!n.on&&d.cy>=TOP)n.on={sec,lead,y:d.cy,x:d.cx,scale:d.scale,drawnBefore:n.firstSec<sec};
  }
  firstStep=false;
  if(draws.length)emptyRun=0;else if(sec>10&&++emptyRun>Math.round(4000/STEP))break;
  if(Math.round(sec*1000)%10000<STEP)process.stderr.write(`${sec.toFixed(1)}s 描画中のノーツ ${draws.length}\n`);
 }
 const list=[...notes.values()].filter(n=>!n.atStart&&n.on&&n.firstLead!=null).sort((a,b)=>a.t-b.t);
 // ふつうのノーツが画面に入るときの位置(縦)と残り時間の中央値。そこから大きく下で初めて画面に入ったノーツ=いきなり出た
 const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};
 const medY=med(list.map(n=>n.on.y)),medLead=med(list.map(n=>n.on.lead)),medFirstLead=med(list.map(n=>n.firstLead));
 const LATE_PX=Number(process.env.LATE_PX||40);
 const late=list.filter(n=>n.on.y>medY+LATE_PX||n.gaps>0||n.jump);
 if(process.env.DUMP)for(const n of list.slice(0,+process.env.DUMP))console.log(n.t,n.firstSec,Math.round(n.firstNow),n.firstY,n.on.y,Math.round(n.on.lead));
 const report={song:SONG,songId:SONG_ID,diff:DIFF,picked,diffOk,selected,viewport:{W,H},step:STEP,top:TOP,info,notesSeen:list.length,
  medianOnScreenY:medY,medianOnScreenLeadMs:Math.round(medLead),medianFirstDrawLeadMs:Math.round(medFirstLead),latePx:LATE_PX,
  late:late.map(n=>({sec:n.t/1000,type:n.type,sky:n.sky,lane:n.lane,onY:n.on.y,onX:n.on.x,onLeadMs:Math.round(n.on.lead),firstY:n.firstY,firstLeadMs:Math.round(n.firstLead),gaps:n.gaps,jump:n.jump||null})),
  all:list.map(n=>[n.i,n.t,n.type,n.sky,Math.round(n.firstLead),n.firstY,Math.round(n.on.lead),n.on.y,n.on.x,n.gaps])};
 // 地上・空中ごとの「画面に入ってから判定までの残り」(中央値)。空中だけ遅れて入るなら、その差が「空中がいきなり出る」の大きさ
 const byKind={};for(const n of list){const k=n.sky>0?'空中':'地上';(byKind[k]=byKind[k]||[]).push(n.on.lead);}
 report.onScreenLeadByKind=Object.fromEntries(Object.entries(byKind).map(([k,a])=>[k,{n:a.length,median:Math.round(med(a)),min:Math.round(Math.min(...a))}]));
 console.log('画面に入ってから判定までの残り(中央値): '+Object.entries(report.onScreenLeadByKind).map(([k,v])=>`${k} ${v.median}ms(${v.n}個・最短${v.min}ms)`).join(' / '));
 const out=path.join(OUT,`appear-${(SONG_ID||SONG).replace(/\W+/g,'_')}-${DIFF}-${W}x${H}.json`);fs.writeFileSync(out,JSON.stringify(report));
 console.log(`${SONG}${SONG_ID?' ('+SONG_ID+')':''} ${DIFF} ${W}×${H}: 測ったノーツ ${list.length} / 画面に入る位置の中央 y${medY}(残り${Math.round(medLead)}ms・描き始め残り${Math.round(medFirstLead)}ms) / いきなり ${late.length}件 → ${out}`);
 for(const n of late.slice(0,40))console.log(`  ${(n.t/1000).toFixed(3)}秒 ${n.type}${n.sky?' 空中':''} 画面に入ったのは y${n.on.y} x${n.on.x}(残り${Math.round(n.on.lead)}ms) 描き始め y${n.firstY}(残り${Math.round(n.firstLead)}ms)${n.gaps?' 途切れ'+n.gaps:''}${n.jump?` 飛び y${n.jump.from}→${n.jump.to}`:''}`);
 if(SHOTS){let k=0;for(const n of late){if(k++>=SHOT_MAX)break;for(const d of [-STEP,0]){const s=Math.round(((n.on?n.on.sec:n.firstSec)*1000+d))/1000;await page.evaluate(x=>window.__mhFreezeSong(x),s);await raf();await page.screenshot({path:path.join(OUT,`late-${Math.round(n.t)}-${d<0?'before':'after'}.png`)});}}}
 await b.close();server.close();
})().catch(e=>{console.log(String(e&&e.stack||e));process.exit(1)});
