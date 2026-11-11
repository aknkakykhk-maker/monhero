#!/usr/bin/env node
// モンヒロビートの演奏画面の「重さ」を、縦・横 × CPU の絞り × 見た目のおまかせ で一度に測り、1場面1行で出す。
// 最後の1行は必ず「OK: …」か「NG: …」(安いモデルで回して、最後の行だけ読めば足りるようにしてある)。
//
//   node tools/mode/rhythm-weight-report.js                 … 代表の8場面(標準・全部のせ × 縦・横 × CPU 1倍・1/4)
//   node tools/mode/rhythm-weight-report.js --quick         … 2場面だけ(標準・横・CPU 1/4 と 全部のせ・横・CPU 1/4)
//   node tools/mode/rhythm-weight-report.js --check         … 予算(tools/mode/weight-budget.json)を超えていないかを見る(超えたら NG で落ちる)
//   node tools/mode/rhythm-weight-report.js --write-budget  … いまの値から予算を書き直す(★わざと重くしたと分かっているときだけ)
//   node tools/mode/rhythm-weight-report.js --compare origin/main … 同じ場面を指定の版でも測り、差を出す
//   オプション: --song big_bridge_no_shitou --diff HELL --from 0:08 --seconds 8
//               --preset STANDARD,FULL --orient landscape,portrait --cpu 1,4 --draw canvas|webgl --dpr 2
//               --settings '{"roadFx":false}'(おまかせの値に重ねる) --hide '<CSSセレクタ>'(その部品を隠して測る=切り分け。{ を含めば CSS としてそのまま当てる=直す前の試し)
//               --json <ファイル>(全部の数字を JSON で残す) --port 9191
//               --trace(原因さがし: 時間の内訳と、スタイル再計算・レイアウト・塗り直しの出どころの上位を出す。数字は少し重く出る)
//               --screen select|mode(演奏ではなく曲えらび・モードえらびを、触らずに止まったまま測る。飾りのアニメーションの重さを見る。予算は見ない)
//               --inject <jsファイル>(ページへ足すスクリプト。見た目の案の見本を重ねて、重さの見込みを同じ物差しで測る)
//               --shot <png>(測っている途中の画面を撮る。ファイル名に場面の名前が付く)
//               --gpu(GPU のある端末と同じ層の分け方で動かす。GPU の仕事は CPU が肩代わりするので時間は遅く出る。層・塗り直しの「構造」を見るとき)
//               --profile(--trace に加えて JavaScript の関数ごとの時間も出す。★測る仕組みがとても重く、イベントの時間が大きく出る。関数の順位だけを見る)
//
// 【なぜ要るか】(2026-11-11・社長「モンビーの見た目を強化して更に重さを維持または軽くする方法も見つけさせてほしい」)
// 重さの道具は場面ごとに分かれていた(rhythm-live-frame-report = フレームの詰まり / rhythm-gpu-load-report = GPU の仕事 /
// rhythm-render-cost-check = 自前のページでのレイアウト)。見た目を足す前後で「重くなっていないか」を1本で言えるように、
// 本番の index.html を開いて HELL の密な所を自動で叩きながら、次をまとめて測る。
//
// 【出す数字】(1場面1行)
//   中央/95%  … 1フレームの間隔(ms)の中央値と95%点。60Hz なら 16.7 が満点
//   落ち      … 25ms を超えたフレームの割合(%)。カクつきとして感じる回数の目安
//   JS        … 1フレームあたりの JavaScript の時間(ms)
//   配置/型   … 1フレームあたりのレイアウト・スタイル再計算の回数(0 に近いほど良い。transform と opacity だけで動いていれば 0)
//   塗り      … 1秒あたりの塗り直しの面積(画面◯枚ぶん)
//   層        … 合成する層の枚数と面積(画面◯枚ぶん)。毎フレーム GPU が重ねる量
//   DOM       … 要素の数 / うち動いているアニメーションの数
//   メモリ    … JavaScript のヒープ(MB)
// ★この環境に GPU は無い(SwiftShader)。絶対値は実機と違うので、**同じ道具で前後を比べる**ために使う。
//   WebGL の塗りの量(機種ごとの fps の目安)は rhythm-gpu-estimate.js が受け持つ。こちらは既定で Canvas で測り、
//   JavaScript・レイアウト・塗り直し・層・DOM を見る。
// ★譜面・判定・音には触らない(読むだけ・叩くだけ)。
const fs=require('fs'),path=require('path'),os=require('os');
const {execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {serve}=require('./rhythm-gpu-load-report.js');
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:fallback;};
const flag=name=>process.argv.includes(`--${name}`);
const QUICK=flag('quick');
const SONG=arg('song','big_bridge_no_shitou'),DIFF=arg('diff','HELL'),FROM=arg('from','0:08'),SECONDS=Number(arg('seconds','8'))||8;
const PRESETS=arg('preset',QUICK?'STANDARD,FULL':'STANDARD,FULL').split(',').filter(Boolean);
const ORIENTS=arg('orient',QUICK?'landscape':'landscape,portrait').split(',').filter(Boolean);
const CPUS=arg('cpu',QUICK?'4':'1,4').split(',').map(Number).filter(n=>n>=1);
const DRAW=arg('draw','canvas'),DPR=Number(arg('dpr','2'))||2,PORT=Number(arg('port','9191'))||9191,HIDE=arg('hide','');
const INJECT=arg('inject',''),SHOT=arg('shot',''),SCREEN=arg('screen','play'),SELECT=SCREEN!=='play',MODE=SCREEN==='mode';
let EXTRA={};try{EXTRA=JSON.parse(arg('settings','{}'));}catch(e){console.log('NG: --settings は JSON で書いてください');process.exit(1);}
const BUDGET_FILE=path.join(__dirname,'weight-budget.json');
// 予算を見る数字(どれも「小さいほど良い」)。tol … 予算に対して何倍まで許すか(ぶれの分)。floor … これ以下は差を見ない(小さい数のぶれで落とさない)
const BUDGET_KEYS=[['p95','95%点',1.35,12],['jsPerFrame','JS',1.35,1.5],['layoutPerFrame','配置',1.3,.3],['stylePerFrame','型',1.3,.3],['repaintScreens','塗り',1.4,.5],['layerScreens','層の面積',1.25,1],['domNodes','DOM',1.2,200]];

const VIEW={portrait:{width:390,height:844},landscape:{width:844,height:390}};
const measure=async(playwright,port,scene)=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required',...(flag('gpu')?['--use-gl=angle','--use-angle=swiftshader','--enable-gpu-rasterization','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']:[])]});
  try{
    const page=await browser.newPage({viewport:VIEW[scene.orient],deviceScaleFactor:DPR,hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(([song,settings,draw,hide,count])=>{
      const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
      const cleared={clear:true,played:true,bestScore:1};put('mh_rhythm_best_v1',{[song]:{EASY:cleared,NORMAL:cleared,HARD:cleared,EXPERT:cleared,MASTER:cleared}});
      // 演出の自動調整は切る(この環境は遅く、測っている途中で演出が下がると数字が比べられない)
      localStorage.setItem('mh_rhythm_settings_v1',JSON.stringify({...settings,autoEffectDown:false,renderQuality:'HIGH'}));
      localStorage.setItem('mh_rhythm_canvas_v1',draw);if(draw==='webgl')localStorage.setItem('mh_rhythm_stage_gl_v1','webgl');
      window.__ft=[];window.__long=0;let last=0;const tick=t=>{if(last)window.__ft.push(t-last);last=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
      try{new PerformanceObserver(l=>{window.__long+=l.getEntries().length;}).observe({entryTypes:['longtask']});}catch(e){}
      // 原因さがしのときだけ: 2D canvas へ貼った画像の数と面積(=塗る画素の量)を数える
      if(count){const P=CanvasRenderingContext2D.prototype,o=P.drawImage;window.__di={n:0,area:0,clear:0,fill:0};P.drawImage=function(img,a,b,c,d,e,f,g,h){const w=g!==undefined?g:(c!==undefined?c:img.width),hh=h!==undefined?h:(d!==undefined?d:img.height);const m=this.getTransform();window.__di.n++;window.__di.area+=Math.abs(w*hh*m.a*m.d);return o.apply(this,arguments);};
        const oc=P.clearRect;P.clearRect=function(x,y,w,h){window.__di.clear+=Math.abs(w*h*this.getTransform().a*this.getTransform().d);return oc.apply(this,arguments);};const of=P.fill;P.fill=function(){window.__di.fill++;return of.apply(this,arguments);};}
      if(hide)document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent=hide.includes('{')?hide:`${hide}{display:none!important}`;document.head.appendChild(st);});
    },[SONG,scene.settings,DRAW,HIDE,!!scene.trace]);
    if(INJECT)await page.addInitScript({path:INJECT});
    const clickText=pattern=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pattern);
    await page.goto(`http://localhost:${port}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),{timeout:60000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|閉じる')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    if(MODE)await page.waitForSelector('[data-rhythm-mode-solo]',{timeout:30000});
    else{    for(let i=0;i<2;i++){await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());} await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});}
    for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|閉じる')))break;await page.waitForTimeout(300);}
    const bcdp=await browser.newBrowserCDPSession(),cdp=await page.context().newCDPSession(page);
    if(SELECT){await page.waitForTimeout(2500);if(scene.cpu>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:scene.cpu});await page.waitForTimeout(800);}
    else{
    await page.evaluate(s=>document.querySelector(`[data-rhythm-song-row="${s}"]`)?.click(),SONG);await page.waitForTimeout(300);
    await page.evaluate(d=>document.querySelector(`[data-rhythm-difficulty="${d}"]`)?.click(),DIFF);await page.waitForTimeout(300);
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    // 自動で叩く(TAP・HOLD だけ)。曲の時計が 0:01→0:02 に変わった瞬間で時刻を合わせる(rhythm-gpu-load-report.js と同じやり方)
    await page.evaluate(([song,diff])=>{
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
    // 絞るのは曲が始まってから(起動まで絞ると、測りたい所へ着くのが遅くなるだけ)。測る2秒前から絞って落ち着かせる
    const [fm,fs_]=FROM.split(':').map(Number),fromSec=fm*60+fs_,pre=Math.max(2,fromSec-2),preLabel=`${Math.floor(pre/60)}:${String(pre%60).padStart(2,'0')}`;
    await page.waitForFunction(rx=>(document.querySelector('[data-rhythm-song-clock]')?.textContent||'').includes(rx+'/'),preLabel,{timeout:240000,polling:100});
    if(scene.cpu>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:scene.cpu});
    await page.waitForFunction(rx=>(document.querySelector('[data-rhythm-song-clock]')?.textContent||'').includes(rx+'/'),FROM,{timeout:240000,polling:100});
    }
    const procTime=async()=>{const {processInfo}=await bcdp.send('SystemInfo.getProcessInfo');const sum=type=>processInfo.filter(p=>p.type===type).reduce((a,p)=>a+p.cpuTime,0);return {gpu:sum('GPU'),renderer:sum('renderer')};};
    const perf=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');return Object.fromEntries(metrics.map(m=>[m.name,m.value]));};
    let layers=null;cdp.on('LayerTree.layerTreeDidChange',e=>{if(e.layers)layers=e.layers;});await cdp.send('LayerTree.enable');await cdp.send('Performance.enable');
    await page.waitForTimeout(400);
    const snap=()=>{const list=(layers||[]).filter(l=>l.drawsContent&&!l.invisible&&l.width>0&&l.height>0);return new Map(list.map(l=>[l.layerId,{area:l.width*l.height,paint:l.paintCount||0}]));};
    const screen=VIEW[scene.orient].width*VIEW[scene.orient].height;
    await page.evaluate(()=>{window.__ft.length=0;window.__long=0;if(window.__di)window.__di={n:0,area:0,clear:0,fill:0};});
    if(scene.trace)await browser.startTracing(page,{categories:['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.invalidationTracking','disabled-by-default-devtools.timeline.stack','cc','gpu','blink',...(scene.profile?['disabled-by-default-v8.cpu_profiler']:[])]});
    const p0=await procTime(),m0=await perf(),l0=snap();const t0=Date.now();
    const layerSamples=[];let domMax=0,animMax=0,wcMax=0,animSeen=[];
    for(let s=0;s<SECONDS;s++){await page.waitForTimeout(1000);const m=snap();layerSamples.push({count:m.size,area:[...m.values()].reduce((a,l)=>a+l.area,0)/screen});
      if(SHOT&&s===Math.floor(SECONDS/2)+1)await page.screenshot({path:SHOT.replace(/(\.\w+)$/,`-${scene.key.replace(/\//g,'-')}$1`)});
      if(s===Math.floor(SECONDS/2)){const d=await page.evaluate(()=>{const all=document.querySelectorAll('*');let wc=0;const area=document.querySelector('[data-rhythm-play-area]');
        (area?area.querySelectorAll('*'):[]).forEach(el=>{if(getComputedStyle(el).willChange!=='auto')wc++;});
        const heavy=[];all.forEach(el=>{const cs=getComputedStyle(el),bf=cs.backdropFilter||cs.webkitBackdropFilter||'none';const tags=[];if(bf&&bf!=='none')tags.push('背景ぼかし '+bf);if(cs.filter&&cs.filter!=='none')tags.push('filter '+cs.filter.slice(0,30));if(cs.mixBlendMode&&cs.mixBlendMode!=='normal')tags.push('blend '+cs.mixBlendMode);
          if(tags.length){const r=el.getBoundingClientRect();if(r.width>0&&r.height>0)heavy.push(`${tags.join('+')} ${el.tagName.toLowerCase()} ${[...el.attributes].filter(x=>x.name.startsWith('data-')).map(x=>x.name.slice(5)).join(',')||String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className).slice(0,40)} ${Math.round(r.width)}×${Math.round(r.height)}`);}});
        return {heavy,dom:all.length,area:area?area.querySelectorAll('*').length:0,anims:document.getAnimations().filter(a=>a.playState==='running').map(a=>{const t=a.effect&&a.effect.target,pe=a.effect&&a.effect.pseudoElement||'';let props=[];try{props=[...new Set(a.effect.getKeyframes().flatMap(k=>Object.keys(k)).filter(k=>!/^(offset|easing|composite|computedOffset)$/.test(k)))];}catch(e){}
          const mark=t?[...t.attributes].filter(x=>x.name.startsWith('data-')).map(x=>x.name.slice(5)).join(',')||String(t.className&&t.className.baseVal!==undefined?t.className.baseVal:t.className).slice(0,50):'';
          return `${a.animationName||a.transitionProperty||'(script)'} [${props.join(',')}] ${t?t.tagName.toLowerCase():'?'}${pe} ${mark}${a.effect.getComputedTiming().iterations===Infinity?' ∞':''}`;}),anim:document.getAnimations().filter(a=>a.playState==='running').length,wc};});domMax=d.dom;animMax=d.anim;animSeen=d.anims;scene.heavy=d.heavy;wcMax=d.wc;scene.areaDom=d.area;}}
    // 原因さがし: 大きい層の持ち主を名前で言う(層 → DOM の要素)
    let layerList=null;if(scene.trace){await cdp.send('DOM.enable');await cdp.send('DOM.getDocument',{depth:0});const list=(layers||[]).filter(l=>l.drawsContent&&!l.invisible&&l.width>0&&l.height>0).sort((a,b)=>b.width*b.height-a.width*a.height).slice(0,40);layerList=[];
      for(const l of list){let name='(持ち主なし)';if(l.backendNodeId){try{const {node}=await cdp.send('DOM.describeNode',{backendNodeId:l.backendNodeId});const at=node.attributes||[],marks=[];for(let i=0;i<at.length;i+=2)if(at[i].startsWith('data-rhythm'))marks.push(at[i].slice(12)+(at[i+1]?'='+at[i+1].slice(0,12):''));const cls=at[at.indexOf('class')+1]||'';name=`${(node.localName||node.nodeName).toLowerCase()} ${marks.join(',')||(at.indexOf('class')>=0?cls.slice(0,60):'')}`;}catch(e){}}
        let why='';try{const r=await cdp.send('LayerTree.compositingReasons',{layerId:l.layerId});why=(r.compositingReasonIds||r.compositingReasons||[]).join('+').slice(0,60);}catch(e){}
        layerList.push({name,w:Math.round(l.width),h:Math.round(l.height),why});}}
    const p1=await procTime(),m1=await perf(),l1=snap();const sec=(Date.now()-t0)/1000;
    const ft=await page.evaluate(()=>({ft:window.__ft.slice(),long:window.__long,di:window.__di||null,canvases:[...document.querySelectorAll('[data-rhythm-play-area] canvas, canvas[data-rhythm-stage-gl]')].map(c=>`${[...c.attributes].filter(a=>a.name.startsWith('data-rhythm')).map(a=>a.name.slice(12)).join(',')||'canvas'} ${c.width}×${c.height}(表示 ${Math.round(c.getBoundingClientRect().width)}×${Math.round(c.getBoundingClientRect().height)})`)}));
    let causes=null;if(scene.trace)causes=summarizeTrace(JSON.parse((await browser.stopTracing()).toString('utf8')),Math.max(1,ft.ft.length),animSeen);
    if(scene.cpu>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    const combo=await page.evaluate(()=>document.querySelector('[data-rhythm-combo]')?.textContent||'');
    let repaint=0;for(const [id,l] of l1){const before=l0.get(id);repaint+=Math.max(0,l.paint-(before?before.paint:0))*l.area;}
    const sorted=[...ft.ft].sort((a,b)=>a-b),q=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:0,frames=Math.max(1,sorted.length);
    const avg=key=>layerSamples.reduce((a,x)=>a+x[key],0)/Math.max(1,layerSamples.length);
    const d=key=>(m1[key]||0)-(m0[key]||0);
    return {frames:sorted.length,fps:sorted.length/sec,median:q(.5),p95:q(.95),max:sorted[sorted.length-1]||0,over25:sorted.filter(x=>x>25).length/frames*100,over50:sorted.filter(x=>x>50).length/frames*100,longTasks:ft.long,
      jsPerFrame:d('ScriptDuration')*1000/frames,layoutPerFrame:d('LayoutCount')/frames,stylePerFrame:d('RecalcStyleCount')/frames,layoutMsPerFrame:d('LayoutDuration')*1000/frames,styleMsPerFrame:d('RecalcStyleDuration')*1000/frames,
      gpuPerFrame:(p1.gpu-p0.gpu)*1000/frames,rendererPerFrame:(p1.renderer-p0.renderer)*1000/frames,
      repaintScreens:repaint/screen/sec,layers:avg('count'),layerScreens:avg('area'),domNodes:domMax,areaDom:scene.areaDom||0,animations:animMax,willChange:wcMax,heapMb:(m1.JSHeapUsedSize||0)/1048576,combo:combo.replace(/\s+/g,' ').slice(0,20),errors,causes,layerList,heavy:scene.heavy||[],canvases:ft.canvases,canvasDraw:ft.di?{images:ft.di.n/frames,screens:ft.di.area/(screen*DPR*DPR)/frames,clearScreens:ft.di.clear/(screen*DPR*DPR)/frames,fills:ft.di.fill/frames}:null};
  }finally{await browser.close();}
};
// --trace: Chromium のトレースから「1フレームあたり何に時間を使ったか」と「スタイル再計算・レイアウトを起こした書き込みの出どころ」を上位だけ出す
const summarizeTrace=(trace,frames,anims)=>{
  const lay={n:0,dirty:0,total:0,partial:0,ms:0},sty={n:0,el:0,ms:0};const events=trace.traceEvents||trace,byName=new Map(),styleFrom=new Map(),layoutFrom=new Map(),paintBy=new Map();
  const where=e=>{const st=(e.args&&((e.args.data&&e.args.data.stackTrace)||(e.args.beginData&&e.args.beginData.stackTrace)))||[];const top=st.find(f=>f.url&&!/react|babel/.test(f.url))||st[0];return top?`${(top.functionName||'(無名)').slice(0,40)}@${String(top.url).split('/').pop().split('?')[0]}:${top.lineNumber}`:'(呼び出し元なし=CSSアニメーションなど)';};
  for(const e of events){
    if(e.ph==='X'&&e.dur&&/^(UpdateLayoutTree|Layout|PrePaint|Paint|Layerize|Commit|RasterTask|FunctionCall|FireAnimationFrame|EventDispatch|CompositeLayers|UpdateLayer|ImageDecodeTask|GPUTask|MinorGC|MajorGC|V8\.GC.*|ParseHTML|TimerFire|HitTest|IntersectionObserverController::computeIntersections|Animation)$/.test(e.name)){const b=byName.get(e.name)||{ms:0,n:0};b.ms+=e.dur/1000;b.n++;byName.set(e.name,b);}
    if(e.name==='ScheduleStyleRecalculation'||e.name==='StyleRecalcInvalidationTracking'){const k=(e.name==='StyleRecalcInvalidationTracking'?`${(e.args.data.reason||'')}${e.args.data.extraData?'/'+e.args.data.extraData:''} ${e.args.data.nodeName||''} ← `:'')+where(e);styleFrom.set(k,(styleFrom.get(k)||0)+1);}
    if(e.name==='InvalidateLayout'||e.name==='LayoutInvalidationTracking'){const k=(e.name==='LayoutInvalidationTracking'?`${e.args.data.reason||''} ${e.args.data.nodeName||''} ← `:'')+where(e);layoutFrom.set(k,(layoutFrom.get(k)||0)+1);}
    if(e.name==='UpdateLayoutTree'&&e.ph==='X'){sty.n++;sty.el+=(e.args&&e.args.elementCount)||0;sty.ms+=(e.dur||0)/1000;}
    if(e.name==='Layout'&&e.ph==='X'&&e.args&&e.args.beginData){lay.n++;lay.dirty+=e.args.beginData.dirtyObjects||0;lay.total+=e.args.beginData.totalObjects||0;if(e.args.beginData.partialLayout)lay.partial++;lay.ms+=(e.dur||0)/1000;}
    if(e.name==='Paint'&&e.args&&e.args.data){const c=e.args.data.clip||[];const w=Math.round(Math.abs((c[2]||0)-(c[0]||0))),h=Math.round(Math.abs((c[5]||0)-(c[1]||0)));const k=`${e.args.data.nodeName||'?'} ${w}×${h}`;const b=paintBy.get(k)||{n:0,ms:0};b.n++;b.ms+=(e.dur||0)/1000;paintBy.set(k,b);}
  }
  // JavaScript のどの関数が時間を使ったか(自分の中で使った時間。サンプリングなので目安)
  const nodes=new Map(),self=new Map();
  for(const e of events){if(e.name!=='ProfileChunk'||!e.args||!e.args.data)continue;const d=e.args.data;
    for(const n of (d.cpuProfile&&d.cpuProfile.nodes)||[])nodes.set(n.id,n.callFrame);
    const samples=(d.cpuProfile&&d.cpuProfile.samples)||[],deltas=d.timeDeltas||[];
    samples.forEach((id,i)=>{const cf=nodes.get(id);if(!cf)return;const name=cf.functionName||'(無名)';if(/^\((idle|program|root)\)$/.test(name))return;
      const k=`${name.slice(0,44)}@${String(cf.url||'').split('/').pop().split('?')[0]||'(ブラウザ)'}:${cf.lineNumber}`;self.set(k,(self.get(k)||0)+(deltas[i]||0)/1000);});}
  const top=(m,n,val=v=>v)=>[...m.entries()].sort((a,b)=>val(b[1])-val(a[1])).slice(0,n);
  const animCount=new Map();for(const a of anims||[])animCount.set(a,(animCount.get(a)||0)+1);
  return {styleScope:sty.n?`1回あたり ${(sty.ms/sty.n).toFixed(2)}ms・計算し直した要素 ${(sty.el/sty.n).toFixed(1)}個(1フレームに ${(sty.el/frames).toFixed(1)}個)`:'なし',layoutScope:lay.n?`レイアウト1回あたり ${(lay.ms/lay.n).toFixed(2)}ms・測り直した箱 ${(lay.dirty/lay.n).toFixed(0)}個 / 全体 ${(lay.total/lay.n).toFixed(0)}個・部分だけで済んだ ${Math.round(lay.partial/lay.n*100)}%`:'レイアウトなし',js:top(self,14).map(([k,v])=>`${(v/frames).toFixed(2)}ms ${k}`),anims:top(animCount,14).map(([k,v])=>`${v}個 ${k}`),time:top(byName,12,v=>v.ms).map(([k,v])=>`${k} ${(v.ms/frames).toFixed(2)}ms(${(v.n/frames).toFixed(1)}回)`),
    style:top(styleFrom,10).map(([k,v])=>`${(v/frames).toFixed(2)}/フレーム ${k}`),layout:top(layoutFrom,8).map(([k,v])=>`${(v/frames).toFixed(2)}/フレーム ${k}`),
    paint:top(paintBy,10,v=>v.n).map(([k,v])=>`${(v.n/frames).toFixed(2)}回/フレーム ${(v.ms/frames).toFixed(2)}ms ${k}`)};
};
const f1=v=>v.toFixed(1),f2=v=>v.toFixed(2);
const fmt=r=>`中央 ${f1(r.median)} / 95% ${f1(r.p95)}ms ・ 落ち ${f1(r.over25)}% ・ JS ${f1(r.jsPerFrame)}ms ・ 配置 ${f2(r.layoutPerFrame)} 型 ${f2(r.stylePerFrame)}/フレーム ・ 塗り ${f1(r.repaintScreens)}枚/秒 ・ 層 ${f1(r.layers)}枚(${f1(r.layerScreens)}) ・ DOM ${r.domNodes}(演奏 ${r.areaDom}・動き ${r.animations}・will-change ${r.willChange}) ・ メモリ ${Math.round(r.heapMb)}MB ・ 型 ${f2(r.styleMsPerFrame)}ms 配置 ${f2(r.layoutMsPerFrame)}ms/フレーム`;
const pct=(a,b)=>b>0?`${a>=b?'+':''}${Math.round((a-b)/b*100)}%`:'-';

module.exports={measure,VIEW};
if(require.main===module)(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('OK: SKIP(playwright が入っていないので測れません)');process.exit(0);}}
  // おまかせの値は本体(RHYTHM_LOOK_PRESETS)から読む(道具へ書き写さない)
  const server=await serve(ROOT,PORT);
  const compareRef=arg('compare',null);let baseRoot=null,baseServer=null;
  const out={scene:SELECT?`${MODE?'モードえらび':'曲えらび'}(止まったまま ${SECONDS}秒)・dpr${DPR}`:`${SONG} ${DIFF} ${FROM} から ${SECONDS}秒・${DRAW}・dpr${DPR}`,rows:[]};let ng=[];
  try{
    const b=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const probe=await b.newPage();
    await probe.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});await probe.waitForFunction(()=>typeof RHYTHM_LOOK_PRESETS!=='undefined',{timeout:60000});
    const presets=await probe.evaluate(()=>RHYTHM_LOOK_PRESETS.map(p=>({id:p.id,label:p.label,values:p.values})));await b.close();
    if(compareRef){baseRoot=fs.mkdtempSync(path.join(os.tmpdir(),'mh-weight-base-'));execFileSync('git',['-C',ROOT,'worktree','add','--detach',baseRoot,compareRef],{stdio:'ignore'});baseServer=await serve(baseRoot,PORT+1);}
    const budget=fs.existsSync(BUDGET_FILE)?JSON.parse(fs.readFileSync(BUDGET_FILE,'utf8')):{};
    console.log(`場面: ${out.scene}${SELECT?'':'(自動で叩く)'}`);
    for(const id of PRESETS){const preset=presets.find(p=>p.id===id);if(!preset){ng.push(`おまかせ ${id} が本体に無い`);continue;}
      for(const orient of ORIENTS)for(const cpu of CPUS){
        const key=`${id}/${orient}/cpu${cpu}`,label=`${preset.label}・${orient==='landscape'?'横':'縦'}・CPU 1/${cpu}`;
        const scene={key,orient,cpu,settings:{...preset.values,...EXTRA},trace:flag('trace')||flag('profile'),profile:flag('profile')};
        let r;try{r=await measure(playwright,PORT,scene);}catch(e){ng.push(`${label}: 測れない(${String(e.message).split('\n')[0].slice(0,80)})`);continue;}
        out.rows.push({key,label,...r});
        console.log(`■ ${label}: ${fmt(r)}`);
        if(r.layerList){const g=new Map();for(const l of r.layerList){const k=`${l.name} [${l.why}]`;const b=g.get(k)||{n:0,area:0,size:`${l.w}×${l.h}`};b.n++;b.area+=l.w*l.h;g.set(k,b);}const sc=VIEW[orient].width*VIEW[orient].height;
          console.log(`   大きい層(画面◯枚ぶん):\n     ${[...g.entries()].sort((a,b)=>b[1].area-a[1].area).slice(0,18).map(([k,v])=>`${(v.area/sc).toFixed(2)}枚 ${v.n>1?v.n+'個 ':''}${v.size} ${k}`).join('\n     ')}`);}
        if(r.layerList&&r.heavy.length)console.log(`   GPU に重い飾り(背景ぼかし・filter・blend。${r.heavy.length}個):\n     ${r.heavy.slice(0,16).join('\n     ')}`);
        if(r.causes){console.log(`   canvas: ${r.canvases.join(' / ')}${r.canvasDraw?` ・ 1フレームに 画像 ${f1(r.canvasDraw.images)}枚(画面 ${f2(r.canvasDraw.screens)}枚ぶん)・消す 画面 ${f2(r.canvasDraw.clearScreens)}枚ぶん・図形 ${f1(r.canvasDraw.fills)}個`:''}`);console.log(`   時間の内訳(1フレームあたり): ${r.causes.time.join(' / ')}`);if(r.causes.js.length)console.log(`   JavaScript の関数(自分の時間・1フレームあたり):\n     ${r.causes.js.join('\n     ')}`);console.log(`   動いているアニメーション(transform・opacity 以外を動かす物は毎フレーム型の再計算を起こす):\n     ${r.causes.anims.join('\n     ')}`);console.log(`   スタイル再計算の出どころ(${r.causes.styleScope}):\n     ${r.causes.style.join('\n     ')}`);console.log(`   レイアウトの出どころ(${r.causes.layoutScope}):\n     ${r.causes.layout.join('\n     ')}`);console.log(`   塗り直した物:\n     ${r.causes.paint.join('\n     ')}`);}
        if(r.errors.length)ng.push(`${label}: ページのエラー ${r.errors[0].slice(0,80)}`);
        if(!SELECT&&r.frames<SECONDS*2)ng.push(`${label}: フレームがほとんど取れていない(${r.frames})`);
        if(baseServer){try{const base=await measure(playwright,PORT+1,{...scene});
          console.log(`   ${compareRef} との差: 95% ${pct(r.p95,base.p95)} ・ JS ${pct(r.jsPerFrame,base.jsPerFrame)} ・ 配置 ${pct(r.layoutPerFrame,base.layoutPerFrame)} ・ 型 ${pct(r.stylePerFrame,base.stylePerFrame)} ・ 塗り ${pct(r.repaintScreens,base.repaintScreens)} ・ 層 ${pct(r.layerScreens,base.layerScreens)} ・ DOM ${pct(r.domNodes,base.domNodes)}`);
          out.rows[out.rows.length-1].base=base;}catch(e){console.log(`   ${compareRef} は測れない: ${String(e.message).split('\n')[0].slice(0,80)}`);}}
        if(flag('check')&&!SELECT&&budget.rows&&budget.rows[key]){for(const [k,name,tol,floor] of BUDGET_KEYS){const lim=Math.max(budget.rows[key][k]*tol,floor);if(r[k]>lim)ng.push(`${label}: ${name} ${f2(r[k])} が予算 ${f2(lim)} を超えた`);}}
      }}
    if(flag('write-budget')&&!ng.length){const rows={};for(const row of out.rows)rows[row.key]=Object.fromEntries(BUDGET_KEYS.map(([k])=>[k,Number(row[k].toFixed(3))]));
      fs.writeFileSync(BUDGET_FILE,JSON.stringify({note:'rhythm-weight-report.js --write-budget が書く。演奏画面の重さの予算(この環境での値。小さいほど良い)',scene:out.scene,rows},null,1)+'\n');console.log(`予算を書き直した: ${path.relative(ROOT,BUDGET_FILE)}`);}
    const jsonFile=arg('json',null);if(jsonFile)fs.writeFileSync(jsonFile,JSON.stringify(out,null,1));
  }catch(e){ng.push(`道具のエラー: ${String(e&&e.message||e).split('\n')[0]}`);}
  finally{server.close();if(baseServer)baseServer.close();if(baseRoot){try{execFileSync('git',['-C',ROOT,'worktree','remove','--force',baseRoot],{stdio:'ignore'});}catch(e){}}}
  const worst=out.rows.slice().sort((a,b)=>b.p95-a.p95)[0];
  console.log(ng.length?`NG: ${ng.length}件 — ${ng.slice(0,3).join(' / ')}`:`OK: ${out.rows.length}場面を測った${worst?`(いちばん重い: ${worst.label} 95% ${f1(worst.p95)}ms)`:''}${flag('check')?'・予算内':''}`);
  process.exit(ng.length?1:0);
})();
