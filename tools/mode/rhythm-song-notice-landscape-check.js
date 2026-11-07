// モンヒロビートのソロの曲えらび: 横画面の右の欄の最後にある助手の吹き出し(data-rhythm-song-notice-landscape)が、
// 欄と画面に収まるかを実際に開いて測る(2026-11-07 ビート部マモリ・検査部ミハリの指摘 #4885)。
//
//   node tools/mode/rhythm-song-notice-landscape-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 見張る崩れ: 決定ボタンまで詰めた欄の下に吹き出しを置いていたので、横 844×390 で 29px・小さい横 667×375 で 55px 画面の下へはみ出し、
//   顔と「タップで詳しく」が切れていた(🔄横では回した画面の下の外)。横では AssistantBubble の oneLine(1行・顔28px)で出す
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
await page.evaluate(()=>{setInterval(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;const b=d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]')||[...d.querySelectorAll('button')].find(x=>/受け取|閉じる|とじる|OK|はじめる|わかった|^次へ|あとで|見た/.test(x.innerText));if(b)b.click();},250);});
await page.waitForFunction(()=>document.querySelector('button.mh-home-facility.rhythm')&&!document.querySelector('[role=dialog]'),null,{timeout:40000});

await page.evaluate(()=>{try{localStorage.setItem('mh_rhythm_select_view_v1',JSON.stringify({noticeOpen:true,noticeTouched:true}));}catch(e){}});
await page.locator('button.mh-home-facility.rhythm').click();
await page.locator('[data-rhythm-mode-solo]').click();
await page.waitForSelector('[data-rhythm-song-detail]',{timeout:20000});await page.waitForTimeout(1500);
for(const [w,h,rot,lab] of [[844,390,false,'横画面'],[667,375,false,'小さい横画面'],[390,844,true,'回転(横)']]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await page.waitForTimeout(rot?1300:800);
  if(process.env.MH_SHOT_DIR)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`song-notice-${lab}.png`)});
  const r=await page.evaluate((rot)=>{
    const n=[...document.querySelectorAll('[data-rhythm-song-notice-landscape]')].filter((e)=>e.getBoundingClientRect().width>0)[0];
    if(!n)return {err:'吹き出しが無い'};
    const b=n.getBoundingClientRect(),a=document.querySelector('[data-rhythm-song-detail]').getBoundingClientRect();
    // 回したときは、見た目の下が端末の左になる
    const out=rot?(b.left<-1||b.right>innerWidth+1):(b.bottom>innerHeight+1||b.top<-1);
    const inAside=b.left>=a.left-1&&b.right<=a.right+1&&b.top>=a.top-1&&b.bottom<=a.bottom+1;
    const one=!!n.querySelector('[data-bubble-one-line]');
    return {box:[b.left,b.top,b.right,b.bottom].map(Math.round),aside:[a.left,a.top,a.right,a.bottom].map(Math.round),out,inAside,one};
  },!!rot);
  check(`曲えらび(${lab}): 横の助手の吹き出しが画面の外へはみ出さず、右の欄に収まる`,!r.err&&!r.out&&r.inAside,JSON.stringify(r));
  check(`曲えらび(${lab}): 横の吹き出しは1行の形(oneLine)`,!!r.one,JSON.stringify(r));
}
// 押すと説明が開く(1行にしても、全文は「詳しく」で読める)
await page.setViewportSize({width:844,height:390});await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));await page.waitForTimeout(800);
const opened=await page.evaluate(async()=>{const n=[...document.querySelectorAll('[data-rhythm-song-notice-landscape] [aria-label$="の説明を開く"]')].filter((e)=>e.getBoundingClientRect().width>0)[0];if(!n)return '押すところが無い';n.click();await new Promise((r)=>setTimeout(r,150));return document.querySelector('[aria-label="説明を閉じる"]')?'':'開かない';});
check('曲えらび(横画面): 1行の吹き出しを押すと、詳しい説明が開く',opened==='',opened);
check('ページのエラーが出ない',errs.length===0,errs.slice(0,3).join(' / '));
await browser.close();server.close();
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
})().catch((e)=>{console.log('NG: 検査が途中で止まった — '+String(e&&e.message||e).slice(0,300));process.exit(1);});
