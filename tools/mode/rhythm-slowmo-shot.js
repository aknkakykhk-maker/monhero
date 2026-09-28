// モンヒロビートの演奏画面を「コマ送り」で撮る道具(2026-09-27)。参考動画と同じ間隔で並べて、叩いたときの光の動きまで見比べるためのもの。
//
//   node tools/mode/rhythm-slowmo-shot.js                          # Monster Hero HARD の 44.5秒から、0.083秒おきに8コマ(4つのおまかせ)
//   ONLY=FULL T=47 FRAMES=12 STEP=83 node tools/mode/rhythm-slowmo-shot.js
//   環境変数: OUT(書き出す先・既定は一時フォルダ) NAME(ファイル名の頭) W H DPR(画面の大きさ。既定は横向き 844×390・1倍)
//             ONLY(おまかせの id) PATCH(音ゲー設定に重ねる JSON) CSS(撮るときだけ足す CSS) ROOT(配るフォルダ。別の作業場所の見本を撮るとき)
//             CSSANIM=1(CSS のアニメーションも仮想の時間で進める。光を CSS で描くときに使う)
//             SONG(曲名) DIFF(難易度) SEED(撮るときだけ入れる保存データの JSON。例: '{"mh_rhythm_best_v1":{"monster_hero":{"HARD":{"clear":true},"EXPERT":{"clear":true}}}}' で MASTER まで開く)
//
// 【なぜ要るか】
// この作業環境はとても遅く(GPU のまね)、演奏画面は1秒に数コマしか描けない。そのまま撮ると自動で叩くのが間に合わず、
// 光の動きも本来の速さで見えない。そこでブラウザの「仮想の時間」(Emulation.setVirtualTimePolicy)で時間をこちらが進め、
// 曲の時計(AudioContext.currentTime)も performance.now につないで一緒に進める。叩くのも曲の時刻ちょうど(ページの中の自動タップ)。
// こうすると、どんなに遅い環境でも「本来の速さで遊んだときの、0.083秒ごとの画面」が撮れる。
// ★撮るときだけ requestAnimationFrame の時刻を performance.now にそろえる(仮想の時間では2つがずれ、叩いた光がすぐ消えた扱いになる)。
// ★止める位置(T)より前のノーツは叩かないのでライフが減る。ライフの表示と赤い縁は隠して撮る
const path=require('path'),http=require('http'),fs=require('fs');const ROOT=process.env.ROOT||path.resolve(__dirname,'..','..');const PORT=Number(process.env.PORT||9398);
const SONG=process.env.SONG||'Monster Hero';
const os=require('os'),OUT=process.env.OUT||fs.mkdtempSync(path.join(os.tmpdir(),'mh-slowmo-'));
const T=Number(process.env.T||44.5),DIFF=process.env.DIFF||'HARD',W=Number(process.env.W||844),H=Number(process.env.H||390);
fs.mkdirSync(OUT,{recursive:true});
(async()=>{const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
 const t={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'}[path.extname(f)]||'application/octet-stream';res.writeHead(200,{'Content-Type':t});fs.createReadStream(f).pipe(res);}).listen(PORT);
 const b=await require(path.join(__dirname,'..','node_modules','playwright')).chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const probe=await b.newPage();await probe.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load'});await probe.waitForFunction(()=>typeof RHYTHM_LOOK_PRESETS!=='undefined',null,{timeout:60000});
 const presets=await probe.evaluate(()=>RHYTHM_LOOK_PRESETS.map(p=>({id:p.id,values:p.values})));await probe.close();
 for(const preset of presets.filter(p=>!process.env.ONLY||p.id===process.env.ONLY)){
  const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:Number(process.env.DPR||1),hasTouch:true,isMobile:true});
  await page.addInitScript(values=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
   put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
   put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
   put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
   put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
   put('mh_inherited_unique_level_compensation_v1',true);
   localStorage.setItem('mh_rhythm_settings_v1',JSON.stringify({...values,...(values.__patch||{}),autoEffectDown:false,renderQuality:'HIGH'}));
   localStorage.setItem('mh_rhythm_canvas_v1','webgl');localStorage.setItem('mh_rhythm_stage_gl_v1','webgl');
   // SEED … 撮るときだけ入れておく保存データ({キー:値})。EXPERT以上を撮るときの「1つ下をクリア済み」など。最後に入れるので、描き方({"mh_rhythm_canvas_v1":"canvas"} など)も上書きできる
   for(const [k,v] of Object.entries(values.__seed||{}))localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
   // 撮影のときだけ: 描き直しの合図(rAF)の時刻を performance.now にそろえる(仮想の時間では2つがずれる)
   {const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(performance.now()));}
   // 曲の時計を止める仕掛け: 曲の音を鳴らしはじめた時刻を覚え、__mhFreezeSong を入れたらその位置で時計を止める
   const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
   Object.defineProperty(proto,'currentTime',{configurable:true,get(){const f=window.__mhFrozen;if(f&&f.ctx===this)return f.t;return desc.get.call(this);}});
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.duration>30)window.__mhSong={ctx:this.context,t:desc.get.call(this.context),offset:Number(a[1])||0};return start.apply(this,a);};
   window.__mhFreezeSong=sec=>{const s=window.__mhSong;if(!s)return false;const lat=typeof rhythmAudioOutputLatencyMs==='function'?rhythmAudioOutputLatencyMs(s.ctx)/1000:0;window.__mhFrozen={ctx:s.ctx,t:s.t+(sec-s.offset)+lat};return true;};
  },{...preset.values,__patch:JSON.parse(process.env.PATCH||'{}'),__seed:JSON.parse(process.env.SEED||'{}')});
  const clickText=p=>page.evaluate(s=>{const rx=new RegExp(s);const x=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!x)return false;x.click();return true;},p);
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
  await page.getByRole('button',{name:'TAP TO START'}).click({force:true,timeout:60000});
  await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
  await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),null,{timeout:40000});
  for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
  await clickText('モンヒロビート');await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
  for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(300);}
  if(SONG){await page.evaluate(t=>{const el=[...document.querySelectorAll('[data-rhythm-song-list] button, [data-rhythm-song-list] [role=button]')].find(x=>(x.innerText||'').split('\n').some(l=>l.trim()===t));if(el)el.click();},SONG);await page.waitForTimeout(600);}
  await clickText('^\\d+ '+DIFF);await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
  await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
  await page.waitForFunction(()=>!!window.__mhSong,null,{timeout:30000});
  // 止める位置の少し手前まで進めてから止める(時計を止めても描画は続くので、ノーツはその位置で止まる)
  await page.waitForFunction(sec=>{const s=window.__mhSong;return s&&(s.ctx.currentTime-s.t)>=sec-0.6;},T,{timeout:(T+30)*1000,polling:50});
  await page.evaluate(sec=>window.__mhFreezeSong(sec),T);
  await page.addStyleTag({content:'[data-rhythm-down-vignette],[data-rhythm-life-down-slam]{display:none!important}'});
  await page.addStyleTag({content:'[data-rhythm-life],[data-rhythm-life-down-slam],[data-rhythm-down-vignette]{visibility:hidden!important}'});
  if(process.env.CSS)await page.addStyleTag({content:process.env.CSS});
  await page.waitForTimeout(800);
  // 曲の時計を「止めた位置 + (いまの performance.now − つないだ時の performance.now)」にする。仮想の時間ではこれが進む
  await page.evaluate(([T,DIFF])=>{const f=window.__mhFrozen;f.base=f.t;f.p0=performance.now();f.song=T;window.__diff=DIFF;
    const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
    Object.defineProperty(proto,'currentTime',{configurable:true,get(){const z=window.__mhFrozen;if(z&&z.ctx===this)return z.base+(performance.now()-z.p0)/1000;return desc.get.call(this);}});
    // 自動で叩く(TAP・HOLD・FLICK)。曲の時刻がノーツの時刻を過ぎた瞬間に押す
    const ch=RHYTHM_SONGS.find(x=>x.songId===(window.__songId||'monster_hero'));
    window.__autoTap=(chart)=>{const notes=[...chart.notes].sort((a,b)=>a.timeMs-b.timeMs);const area=document.querySelector('[data-rhythm-play-area]');
      const r=area.getBoundingClientRect();const line=area.querySelector('[data-rhythm-judgment-line]').getBoundingClientRect();const y=line.top+line.height/2,yr=(y-r.top)/r.height;
      const z=window.__mhFrozen;const songNow=()=>z.song*1000+(performance.now()-z.p0);
      const s0=songNow();let i=notes.findIndex(n=>n.timeMs>=s0-5);if(i<0)i=notes.length;let id=900;const active=new Map();
      const fire=(down,x,tid)=>{const t=new Touch({identifier:tid,target:area,clientX:x,clientY:y,radiusX:10,radiusY:10,force:.5});if(down)active.set(tid,t);else active.delete(tid);
        area.dispatchEvent(new TouchEvent(down?'touchstart':'touchend',{bubbles:true,cancelable:true,touches:[...active.values()],targetTouches:[...active.values()],changedTouches:[t]}));};
      const step=()=>{const now=songNow();while(i<notes.length&&notes[i].timeMs<=now){const n=notes[i++];if(!['TAP','HOLD','FLICK'].includes(n.type))continue;
          const sub=Number.isFinite(n.subLane)?n.subLane:n.lane*2,w=Number(n.subLaneWidth)||2;const x=r.left+r.width*(rhythmProjectBoundary(sub/2,yr)+rhythmProjectBoundary((sub+w)/2,yr))/2;const tid=id++;
          if(n.type==='FLICK'){const dir=typeof rhythmFlickDir==='function'?rhythmFlickDir(n):'';fire(true,x,tid);
            const mv=(dx,dy)=>{const t=new Touch({identifier:tid,target:area,clientX:x+dx,clientY:y+dy,radiusX:10,radiusY:10,force:.5});active.set(tid,t);area.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[...active.values()],targetTouches:[...active.values()],changedTouches:[t]}));};
            const dx=dir==='left'?-1:dir==='right'?1:0,dy=dir?0:-1;setTimeout(()=>mv(dx*25,dy*25),12);setTimeout(()=>mv(dx*70,dy*70),24);setTimeout(()=>fire(false,x+dx*70,tid),40);continue;}
          fire(true,x,tid);const dur=n.type==='HOLD'?Math.max(40,(Number(n.endTimeMs)||(n.timeMs+(Number(n.durationMs)||0)))-n.timeMs):45;setTimeout(()=>fire(false,x,tid),dur);}
        requestAnimationFrame(step);};requestAnimationFrame(step);};
    window.__autoTap(ch.difficulties[window.__diff||'HARD']);
  },[T,DIFF]);
  const cdp=await page.context().newCDPSession(page);
  const advance=ms=>new Promise(res=>{cdp.once('Emulation.virtualTimeBudgetExpired',res);cdp.send('Emulation.setVirtualTimePolicy',{policy:'advance',budget:ms});});
  const FRAMES=Number(process.env.FRAMES||8),STEP=Number(process.env.STEP||83);
  for(let k=0;k<FRAMES;k++){await advance(STEP);
    // CSSANIM=1 … CSS のアニメーションも仮想の時間で進める。ブラウザの CSS アニメーションは仮想の時間に乗らず、
    // 撮るあいだの本当の時間で進んで1コマ目のあとに終わってしまう(光を CSS で描くときの見本が撮れなかった・2026-09-28)。
    // 新しく始まったものは止めて頭から、すでに止めたものは1コマぶん進める
    if(process.env.CSSANIM==='1')await page.evaluate(step=>{for(const a of document.getAnimations()){if(!a.__mhVirtual){a.__mhVirtual=true;a.pause();a.currentTime=0;}else{a.currentTime=(Number(a.currentTime)||0)+step;}}},STEP);
    const shotK=path.join(OUT,(process.env.NAME||'seq')+'-'+preset.id.toLowerCase()+'-'+String(k).padStart(2,'0')+'.png');await page.screenshot({path:shotK});}
  await cdp.send('Emulation.setVirtualTimePolicy',{policy:'advance'});
  console.log(preset.id,`${FRAMES}コマ`,OUT);
  await page.close();}
 await b.close();server.close();})().catch(e=>{console.log(String(e));process.exit(1)});
