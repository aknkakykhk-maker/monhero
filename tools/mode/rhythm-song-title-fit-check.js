// モンヒロビートの曲えらび: 詳しい欄の曲名と版の札の名前が、全曲で「…」にならずに収まるかを測る
// (2026-11-23 r1119-142 社長「曲名のあとのてんてんがあるやつとないやつなんなの？てかできるだけちゃんとおさめてほしい」)。
//
//   node tools/mode/rhythm-song-title-fit-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 見張ること: ①曲名・版の札が置き場所からはみ出さない ②「…」(clip)になるのは、下限の字で決めた行数に入らない時だけ
//   (ここでは全曲で clip が0件であること。新しい曲で入らなくなったら、上限・下限か置き場所を見直す)
//
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const http=require('http'),fs=require('fs');
let playwright;
try{playwright=require(path.join(ROOT,'tools','node_modules','playwright'));}catch(_){try{playwright=require('playwright');}catch(e){console.log('SKIP: playwright が無いので測れません');process.exit(0);}}
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail&&!ok?` — ${detail}`:''}`);if(!ok)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.PNG':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');const f=path.join(ROOT,rel);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,()=>r(s));});
const FAKE_WS=()=>{class FakeWS{constructor(){this.readyState=0;this.topic=null;this.ch=null;setTimeout(()=>{this.readyState=1;if(this.onopen)this.onopen({});},0);}deliver(o){const data=JSON.stringify(o);setTimeout(()=>{if(this.readyState===1&&this.onmessage)this.onmessage({data});},0);}send(d){const m=JSON.parse(d);if(m.event==='phx_join'){this.topic=m.topic;this.ch=new BroadcastChannel(`fake-ws:${m.topic}`);this.ch.onmessage=e=>this.deliver({topic:this.topic,event:'broadcast',payload:{type:'broadcast',event:'msg',payload:e.data}});this.deliver({topic:m.topic,event:'phx_reply',ref:m.ref,payload:{status:'ok',response:{}}});return;}if(m.event!=='broadcast')return;const p=m.payload&&m.payload.payload;if(this.ch)this.ch.postMessage(p);this.deliver({topic:this.topic,event:'broadcast',payload:{type:'broadcast',event:'msg',payload:p}});}close(){this.readyState=3;if(this.ch)this.ch.close();if(this.onclose)this.onclose({});}}window.WebSocket=FakeWS;};
(async()=>{const server=await serve();const PORT=server.address().port;
const browser=await playwright.chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:Number(390),height:Number(844)},isMobile:true,hasTouch:true});
await context.addInitScript(FAKE_WS);const page=await context.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));put('mh_breeder_name','ブリーダー');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);if(window.__masu!==false)put('mh_masu_mons',[{id:'m1',baseId:'Mocchi',name:'もちまる',bondXp:5000,createdAt:1}]);put('mh_rhythm_hell_story_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);});
await page.addInitScript(require(ROOT+'/tools/boot/quiet-boot-seed').eventStorySeed());
await page.goto(process.env.MH_BASE_URL?`${process.env.MH_BASE_URL.replace(/\/+$/,'')}/monster-hero/index.html`:`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),null,{timeout:60000});
await page.getByText('TAP TO START').click();await page.waitForTimeout(2500);await page.mouse.click(Number(390)/2,Number(844)/2);await page.waitForTimeout(3000);
await page.evaluate(()=>{setInterval(()=>{if(window.__noAutoClose)return;const d=document.querySelector('[role=dialog]');if(!d)return;const b=d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]')||[...d.querySelectorAll('button')].find(x=>/受け取|閉じる|とじる|OK|(?:始|はじ)める|(?:分|わ)かった|^次へ|あとで|見た/.test(x.innerText));if(b)b.click();},250);});
await page.waitForFunction(()=>document.querySelector('button[data-home-fac="rhythm"]')&&!document.querySelector('[role=dialog]'),null,{timeout:40000});

await page.evaluate(()=>{try{localStorage.setItem('mh_rhythm_select_view_v1',JSON.stringify({noticeOpen:true,noticeTouched:true}));}catch(e){}});
await page.locator('button[data-home-fac="rhythm"]').click();
await page.locator('[data-rhythm-mode-solo]').click();
await page.waitForSelector('[data-rhythm-song-detail]',{timeout:20000});await page.waitForTimeout(1500);

const SIZES=[[390,844,false,'縦'],[375,667,false,'低い縦'],[320,568,false,'320縦'],[844,390,false,'横'],[667,375,false,'小さい横'],[932,430,false,'大きい横'],[390,844,true,'🔄横'],[1280,800,false,'PC']];
for(const [w,h,rot,lab] of SIZES){
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await page.waitForTimeout(rot?1300:800);
  const ids=await page.evaluate(()=>[...new Set([...document.querySelectorAll('[data-rhythm-song-row]')].map(e=>e.getAttribute('data-rhythm-song-row')))].filter(Boolean));
  const bad=[];let n=0;
  for(const id of ids){
    await page.evaluate(id=>{const r=[...document.querySelectorAll(`[data-rhythm-song-row="${id}"]`)].find(e=>e.getBoundingClientRect().width>0);if(r)r.click();},id);
    await page.waitForTimeout(120);
    const vers=await page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-song-version]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.getAttribute('data-rhythm-song-version')));
    for(const v of [null,...vers]){
      if(v){await page.evaluate(v=>{const b=[...document.querySelectorAll(`[data-rhythm-song-version="${v}"]`)].find(e=>e.getBoundingClientRect().width>0);if(b)b.click();},v);await page.waitForTimeout(120);}
      const r=await page.evaluate(()=>{const vis=s=>[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().width>0);
        const out=[];
        const t=vis('[data-rhythm-song-detail] [data-rhythm-song-title]')[0];
        if(!t)return [{what:'曲名が無い'}];
        const over=e=>e.scrollWidth>e.clientWidth+1||e.scrollHeight>e.clientHeight+2;
        if(t.getAttribute('data-rhythm-title-fit')==='clip'||over(t))out.push({what:'曲名',text:t.textContent,fit:t.getAttribute('data-rhythm-title-fit'),w:t.clientWidth});
        for(const l of vis('[data-rhythm-song-version] [data-rhythm-label-fit]'))if(l.getAttribute('data-rhythm-label-fit')==='clip'||over(l))out.push({what:'版の札',text:l.textContent,fit:l.getAttribute('data-rhythm-label-fit'),w:l.clientWidth});
        return out;});
      n++;
      for(const x of r)bad.push(`${x.what}「${x.text||''}」(${x.fit||''}・幅${x.w||'?'})`);
    }
  }
  if(process.env.MH_SHOT_DIR)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`title-fit-${lab}.png`)});
  check(`曲えらび(${lab}・${w}×${h}): 全${ids.length}曲・${n}か所で、曲名と版の札が「…」にならずに収まる`,ids.length>0&&bad.length===0,[...new Set(bad)].slice(0,6).join(' / ')||`曲が${ids.length}`);
}
await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));
check('ページのエラーが出ない',errs.length===0,errs.slice(0,3).join(' / '));
await browser.close();server.close();
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
})().catch((e)=>{console.log('NG: 検査が途中で止まった — '+String(e&&e.message||e).slice(0,300));process.exit(1);});
