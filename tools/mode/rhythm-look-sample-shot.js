// 「見た目のおまかせ」の見本の絵(images/rhythm-look/look-*-v2.jpg)を撮り直す道具(2026-09-27)。
//
//   node tools/mode/rhythm-look-sample-shot.js            # 4つとも撮って images/rhythm-look/ へ書く
//   VER=v3 node tools/mode/rhythm-look-sample-shot.js     # 版を上げて書く(絵を変えたらファイル名も変える。キャッシュに残らないように)
//
// ★4つの見本は「同じ曲・同じ瞬間」で撮る(以前の見本は瞬間がばらばらで、ノーツの並びまで違って見えた)。
//   曲の時計(AudioContext.currentTime)を、曲を鳴らしはじめた時刻から数えて T 秒の位置で止め、
//   描画は続けたまま撮る。ノーツはその位置で止まり、背景の演出だけが動く。
//   既定は Monster Hero の HARD の 0:44.8(ホールドとフリックが判定ラインの手前にそろう瞬間)。
// 撮ったら、HUD(上の150px)を外して幅240の JPEG(quality 80・mozjpeg)に縮める。1枚8〜13KB。
// ★撮り直したら 13-bgm-and-rhythm-settings.jsx の RHYTHM_LOOK_PRESETS の image を新しい名前へ直し、node tools/build.js を通す
const path=require('path'),http=require('http'),fs=require('fs');const ROOT='/home/user/monhero';const PORT=9198;
const OUT=process.env.OUT||path.join(ROOT,'monster-hero/images/rhythm-look'),VER=process.env.VER||'v2',SONG=process.env.SONG||'Monster Hero';
const os=require('os'),TMP=fs.mkdtempSync(path.join(os.tmpdir(),'mh-look-'));
const T=Number(process.env.T||44.8),DIFF=process.env.DIFF||'HARD',W=Number(process.env.W||390),H=Number(process.env.H||844);
fs.mkdirSync(OUT,{recursive:true});
(async()=>{const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
 const t={'.js':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg'}[path.extname(f)]||'application/octet-stream';res.writeHead(200,{'Content-Type':t});fs.createReadStream(f).pipe(res);}).listen(PORT);
 const b=await require('playwright').chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const probe=await b.newPage();await probe.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load'});await probe.waitForFunction(()=>typeof RHYTHM_LOOK_PRESETS!=='undefined',null,{timeout:60000});
 const presets=await probe.evaluate(()=>RHYTHM_LOOK_PRESETS.map(p=>({id:p.id,values:p.values})));await probe.close();
 for(const preset of presets.filter(p=>!process.env.ONLY||p.id===process.env.ONLY)){
  const page=await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  await page.addInitScript(values=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
   put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
   put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
   put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
   put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
   put('mh_inherited_unique_level_compensation_v1',true);
   localStorage.setItem('mh_rhythm_settings_v1',JSON.stringify({...values,autoEffectDown:false,renderQuality:'HIGH'}));
   localStorage.setItem('mh_rhythm_canvas_v1','webgl');localStorage.setItem('mh_rhythm_stage_gl_v1','webgl');
   // 曲の時計を止める仕掛け: 曲の音を鳴らしはじめた時刻を覚え、__mhFreezeSong を入れたらその位置で時計を止める
   const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
   Object.defineProperty(proto,'currentTime',{configurable:true,get(){const f=window.__mhFrozen;if(f&&f.ctx===this)return f.t;return desc.get.call(this);}});
   const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.duration>30)window.__mhSong={ctx:this.context,t:desc.get.call(this.context),offset:Number(a[1])||0};return start.apply(this,a);};
   window.__mhFreezeSong=sec=>{const s=window.__mhSong;if(!s)return false;const lat=typeof rhythmAudioOutputLatencyMs==='function'?rhythmAudioOutputLatencyMs(s.ctx)/1000:0;window.__mhFrozen={ctx:s.ctx,t:s.t+(sec-s.offset)+lat};return true;};
  },preset.values);
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
  await page.waitForTimeout(2500);
  const clock=await page.evaluate(()=>document.querySelector('[data-rhythm-song-clock]')?.textContent||'');
  const shot=path.join(TMP,`${preset.id}.png`);await page.screenshot({path:shot});
  const sharp=require(path.join(ROOT,'tools/node_modules/sharp'));const out=path.join(OUT,`look-${preset.id.toLowerCase()}-${VER}.jpg`);
  await sharp(shot).extract({left:0,top:150,width:W,height:H-150}).resize(240,Math.round(240*(H-150)/W)).jpeg({quality:80,mozjpeg:true}).toFile(out);
  console.log(preset.id,clock.slice(0,10),path.relative(ROOT,out),fs.statSync(out).size+'B');
  await page.close();}
 await b.close();server.close();})().catch(e=>{console.log(String(e));process.exit(1)});
