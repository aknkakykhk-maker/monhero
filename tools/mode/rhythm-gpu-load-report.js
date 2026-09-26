// モンヒロビートの演奏中の「GPU の仕事量」の目安を測る(報告だけ。合否は出さない)。
//
//   node tools/mode/rhythm-gpu-load-report.js                       … 既定の場面を1回測る
//   node tools/mode/rhythm-gpu-load-report.js --suite               … 代表的な4つの設定(シンプル・派手・ライブ・全部ON)を測る
//   node tools/mode/rhythm-gpu-load-report.js --compare origin/main … 同じ場面を、指定した版と今の手元で測って並べる
//   オプション: --song freedom_dive --diff HARD --from 1:04 --seconds 6 --runs 1 --draw webgl|canvas
//               --settings '{"stageEffect":"VIVID"}'(音ゲー設定に重ねる) --no-tap(叩かない) --port 9181
//               --hide '[data-rhythm-stage-pulse]'(その部品を隠して測る。どの層が重いかを切り分けるとき)
//
// 【なぜ要るか】(2026-09-27・ユーザー「ここでGPUの軽さを測れるようにできないの？」)
// この作業環境には GPU が無く、WebGL も画面の合成も CPU が肩代わりしている(SwiftShader)。
// 実機の GPU の速さは測れないが、「GPU にやらせている仕事の量」は測れる。軽くしたつもりで増えていないかを、変更の前後で比べるための道具。
//
// 【出す数字】(どれも1秒あたり。端末は iPhone 相当の 390×844・画素密度3)
//   GPU の仕事   … ブラウザの GPU 担当の部分(GPU プロセス)が使った時間。WebGL・合成・塗りをすべて CPU が肩代わりしているので、GPU の仕事量の目安になる。
//                  肩代わりは複数の糸(スレッド)で走るので、1秒あたり1000msを超えることがある。
//                  ★この環境では GPU の肩代わりが重くフレームが落ちるので、比べるときは「1フレームあたり」を見る(1秒あたりはフレーム数に引っ張られる)
//   描く側の仕事 … ページ(JavaScript・配置・塗りの記録)が使った時間。参考
//   フレーム     … 1秒に描けた回数
//   WebGL の命令 … 1フレームあたりの描く命令(drawArrays・drawElements)の数
//   合成する層   … 画面に重ねている絵(層)の枚数と、面積の合計(画面何枚ぶんか)。合成は毎フレーム GPU がする仕事
//   塗り直し     … 層を塗り直した面積(画面何枚ぶんか)。塗り直しは絵を作り直す仕事
//   ★比べるとき(--compare)の差は、どれも1フレームあたりで出す。GPU が軽くなってフレームが増えると、1秒あたりの仕事は増えて見えるため
// ★実機の GPU は種類ごとに得意・不得意が違う。ここで出るのは「仕事の量」の比較で、実機での速さそのものではない。
// ★同じ条件でも数%〜1割ほどぶれる。差を見るときは --runs を増やす
// ★Canvas と WebGL の比べ合いには使えない。この環境の WebGL は CPU の肩代わり(SwiftShader)が極端に重く(画素密度3で1フレーム数百ms)、
//   Canvas の塗りは「描く側」に数えられるため。比べるのは同じ描画方式どうし(版の前後・演出の ON/OFF)だけにする
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');
const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:fallback;};
const flag=name=>process.argv.includes(`--${name}`);
const SONG=arg('song','freedom_dive'),DIFF=arg('diff','HARD'),FROM=arg('from','1:04'),SECONDS=Number(arg('seconds','6'))||6,RUNS=Math.max(1,Number(arg('runs','1'))||1);
const DRAW=arg('draw','webgl'),TAP=!flag('no-tap'),PORT=Number(arg('port','9181'))||9181,HIDE=arg('hide','');
let EXTRA={};try{EXTRA=JSON.parse(arg('settings','{}'));}catch(e){console.log('--settings は JSON で書いてください');process.exit(1);}
const SUITE=[
  {label:'シンプル・Canvas',draw:'canvas',settings:{stageEffect:'SIMPLE'}},
  {label:'派手・WebGL',draw:'webgl',settings:{stageEffect:'VIVID'}},
  {label:'ライブ・WebGL',draw:'webgl',settings:{stageEffect:'LIVE'}},
  {label:'全部ON・WebGL',draw:'webgl',settings:{stageEffect:'LIVE',roadFx:true,noteBloom:true,judgmentFx:true,noteMotionFx:true,comboMilestoneFx:true,effectAmount:'NORMAL'}},
];
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const serve=(root,port)=>new Promise(resolve=>{const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});server.listen(port,()=>resolve(server));});

const measure=async(playwright,port,scene)=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(([song,settings,draw,hide])=>{
      const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);
      // その曲の難易度を全部遊べるようにする(下の難易度をクリアした記録を入れる)
      const cleared={clear:true,played:true,bestScore:1};put('mh_rhythm_best_v1',{[song]:{EASY:cleared,NORMAL:cleared,HARD:cleared,EXPERT:cleared}});
      localStorage.setItem('mh_rhythm_settings_v1',JSON.stringify(settings));
      localStorage.setItem('mh_rhythm_canvas_v1',draw);
      // WebGL の描く命令を数える
      window.__glDraws=0;for(const proto of [window.WebGLRenderingContext&&WebGLRenderingContext.prototype,window.WebGL2RenderingContext&&WebGL2RenderingContext.prototype].filter(Boolean)){
        for(const name of ['drawArrays','drawElements']){const orig=proto[name];proto[name]=function(){window.__glDraws++;return orig.apply(this,arguments);};}}
      window.__frames=0;const tick=()=>{window.__frames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);
      if(hide)document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent=`${hide}{display:none!important}`;document.head.appendChild(st);});
    },[SONG,scene.settings,scene.draw,HIDE]);
    const clickText=pattern=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pattern);
    await page.goto(`http://localhost:${port}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),{timeout:60000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(300);}
    await page.evaluate(s=>document.querySelector(`[data-rhythm-song-row="${s}"]`)?.click(),SONG);await page.waitForTimeout(300);
    await page.evaluate(d=>document.querySelector(`[data-rhythm-difficulty="${d}"]`)?.click(),DIFF);await page.waitForTimeout(300);
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    // 自動で叩く(TAP・HOLD だけ。フリック・SLIDE は取り逃す)。曲の時計が 0:01→0:02 に変わった瞬間で時刻を合わせる
    if(TAP)await page.evaluate(([song,diff])=>{
      const chart=RHYTHM_SONGS.find(x=>x.songId===song).difficulties[diff];const notes=[...chart.notes].sort((a,b)=>a.timeMs-b.timeMs);
      const start=()=>{const area=document.querySelector('[data-rhythm-play-area]');const r=area.getBoundingClientRect();const line=area.querySelector('[data-rhythm-judgment-line]').getBoundingClientRect();const y=line.top+line.height/2,yr=(y-r.top)/r.height;
        let i=0,id=100;const t0=performance.now()-2000;const active=new Map();
        const fire=(down,x,tid)=>{const t=new Touch({identifier:tid,target:area,clientX:x,clientY:y,radiusX:10,radiusY:10,force:.5});if(down)active.set(tid,t);else active.delete(tid);
          area.dispatchEvent(new TouchEvent(down?'touchstart':'touchend',{bubbles:true,cancelable:true,touches:[...active.values()],targetTouches:[...active.values()],changedTouches:[t]}));};
        const step=()=>{const now=performance.now()-t0;while(i<notes.length&&notes[i].timeMs<=now){const n=notes[i++];if(n.type!=='TAP'&&n.type!=='HOLD')continue;
          const sub=Number.isFinite(n.subLane)?n.subLane:n.lane*2,w=Number(n.subLaneWidth)||2;const x=r.left+r.width*(rhythmProjectBoundary(sub/2,yr)+rhythmProjectBoundary((sub+w)/2,yr))/2;const tid=id++;
          fire(true,x,tid);const dur=n.type==='HOLD'?Math.max(40,(Number(n.endTimeMs)||Number(n.releaseTimeMs)||(n.timeMs+(Number(n.durationMs)||0)))-n.timeMs):45;setTimeout(()=>fire(false,x,tid),dur);}
          requestAnimationFrame(step);};requestAnimationFrame(step);};
      let seen1=false;const wait=()=>{const t=document.querySelector('[data-rhythm-song-clock]')?.textContent||'';if(/0:01\//.test(t))seen1=true;if(seen1&&/0:02\//.test(t))start();else requestAnimationFrame(wait);};requestAnimationFrame(wait);
    },[SONG,DIFF]);
    await page.waitForFunction(rx=>(document.querySelector('[data-rhythm-song-clock]')?.textContent||'').includes(rx+'/'),FROM,{timeout:240000,polling:100});
    const bcdp=await browser.newBrowserCDPSession(),cdp=await page.context().newCDPSession(page);
    const procTime=async()=>{const {processInfo}=await bcdp.send('SystemInfo.getProcessInfo');const sum=type=>processInfo.filter(p=>p.type===type).reduce((a,p)=>a+p.cpuTime,0);return {gpu:sum('GPU'),renderer:sum('renderer')};};
    let layers=null;cdp.on('LayerTree.layerTreeDidChange',e=>{if(e.layers)layers=e.layers;});await cdp.send('LayerTree.enable');
    await page.waitForTimeout(500);
    const snap=()=>{const list=(layers||[]).filter(l=>l.drawsContent&&!l.invisible&&l.width>0&&l.height>0);return new Map(list.map(l=>[l.layerId,{area:l.width*l.height,paint:l.paintCount||0}]));};
    const screen=390*844;
    const p0=await procTime(),l0=snap(),c0=await page.evaluate(()=>({frames:window.__frames,draws:window.__glDraws}));const t0=Date.now();
    const layerSamples=[];for(let s=0;s<SECONDS;s++){await page.waitForTimeout(1000);const m=snap();layerSamples.push({count:m.size,area:[...m.values()].reduce((a,l)=>a+l.area,0)/screen});}
    const p1=await procTime(),l1=snap(),c1=await page.evaluate(()=>({frames:window.__frames,draws:window.__glDraws}));const sec=(Date.now()-t0)/1000;
    let repaint=0;for(const [id,l] of l1){const before=l0.get(id);repaint+=Math.max(0,l.paint-(before?before.paint:0))*l.area;}
    const frames=(c1.frames-c0.frames)/sec,draws=c1.draws-c0.draws;
    const avg=key=>layerSamples.reduce((a,x)=>a+x[key],0)/Math.max(1,layerSamples.length);
    const perFrame=v=>frames>0?v/(frames*sec):0;
    return {gpuPerFrame:perFrame((p1.gpu-p0.gpu)*1000),rendererPerFrame:perFrame((p1.renderer-p0.renderer)*1000),repaintPerFrame:perFrame(repaint/screen),gpuMs:(p1.gpu-p0.gpu)*1000/sec,rendererMs:(p1.renderer-p0.renderer)*1000/sec,fps:frames,glPerFrame:frames>0?draws/(frames*sec):0,
      layers:avg('count'),layerScreens:avg('area'),repaintScreens:repaint/screen/sec,errors};
  }finally{await browser.close();}
};
const median=list=>{const s=[...list].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const runScene=async(playwright,port,scene)=>{const results=[];for(let i=0;i<RUNS;i++)results.push(await measure(playwright,port,scene));
  const out={};for(const key of ['gpuPerFrame','rendererPerFrame','repaintPerFrame','gpuMs','rendererMs','fps','glPerFrame','layers','layerScreens','repaintScreens'])out[key]=median(results.map(r=>r[key]));out.errors=[...new Set(results.flatMap(r=>r.errors))];return out;};
const fmt=r=>`GPU の仕事 ${r.gpuPerFrame.toFixed(1)}ms/フレーム(${Math.round(r.gpuMs)}ms/秒) ・ 描く側 ${Math.round(r.rendererMs)}ms/秒 ・ フレーム ${r.fps.toFixed(1)}/秒 ・ WebGL の命令 ${r.glPerFrame.toFixed(1)}/フレーム ・ 合成する層 ${r.layers.toFixed(1)}枚(画面${r.layerScreens.toFixed(2)}枚ぶん) ・ 塗り直し 画面${r.repaintScreens.toFixed(2)}枚ぶん/秒`;
const pct=(a,b)=>b>0?`${a>=b?'+':''}${Math.round((a-b)/b*100)}%`:'-';

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので測れません');process.exit(0);}}
  const scenes=flag('suite')?SUITE:[{label:`指定の設定・${DRAW==='canvas'?'Canvas':'WebGL'}`,draw:DRAW,settings:EXTRA}];
  console.log(`場面: ${SONG} ${DIFF} の ${FROM} から ${SECONDS}秒 ・ ${TAP?'自動で叩く':'叩かない'} ・ 各${RUNS}回の中央値${HIDE?` ・ 隠す: ${HIDE}`:''}`);
  const compareRef=arg('compare',null);
  let baseRoot=null,baseServer=null;
  if(compareRef){
    baseRoot=fs.mkdtempSync(path.join(os.tmpdir(),'mh-gpu-base-'));
    execFileSync('git',['-C',ROOT,'worktree','add','--detach',baseRoot,compareRef],{stdio:'ignore'});
    baseServer=await serve(baseRoot,PORT+1);
  }
  const server=await serve(ROOT,PORT);
  try{
    for(const scene of scenes){
      const now=await runScene(playwright,PORT,scene);
      console.log(`\n■ ${scene.label}`);
      if(baseServer){
        const base=await runScene(playwright,PORT+1,scene);
        console.log(`  ${compareRef}: ${fmt(base)}`);
        console.log(`  手元      : ${fmt(now)}`);
        console.log(`  差(1フレームあたり): GPU の仕事 ${pct(now.gpuPerFrame,base.gpuPerFrame)} ・ 描く側 ${pct(now.rendererPerFrame,base.rendererPerFrame)} ・ 合成する層の面積 ${pct(now.layerScreens,base.layerScreens)} ・ 塗り直し ${pct(now.repaintPerFrame,base.repaintPerFrame)} ・ フレーム数 ${pct(now.fps,base.fps)}`);
        if(base.errors.length)console.log(`  ${compareRef} のページのエラー: ${base.errors.join(' / ').slice(0,300)}`);
      }else console.log(`  ${fmt(now)}`);
      if(now.errors.length)console.log(`  ページのエラー: ${now.errors.join(' / ').slice(0,300)}`);
    }
  }finally{
    server.close();if(baseServer)baseServer.close();
    if(baseRoot){try{execFileSync('git',['-C',ROOT,'worktree','remove','--force',baseRoot],{stdio:'ignore'});}catch(e){}}
  }
})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
