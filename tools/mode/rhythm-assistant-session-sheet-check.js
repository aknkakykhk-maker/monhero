// モンヒロビート「助手とのセッション」: 呼ぶシートの助手のタブを、実際に開いて縦・横・🔄横で測る(2026-11-07 ビート部マモリ)。
//
//   node tools/mode/rhythm-assistant-session-sheet-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
//   MH_BASE_URL=https://aknkakykhk-maker.github.io/monhero node tools/mode/rhythm-assistant-session-sheet-check.js … 公開したあと、本番の版で同じことを確かめる
//
// 見張る崩れ(2026-11-07 社長「まだまだ仕上がりが甘すぎるからちゃんと検査しながらすすめて」):
//   ・助手が自分でモンビーに出かけているあいだは回数なし(社長の決定)。その札「🎵 いまモンヒロビートにいる・回数なし」が、
//     縦で助手のカードの幅を越えて🎵が切れていた。札とカードの中の文字がカードに収まるか
//   ・回数を使わない人数を、無料・券の数に入れていないか(無料も券も0でも「呼ぶ」が押せる)
//   ・呼んでも払わず、控え(mh_rhythm_buddy_v1 の calls)を残さない(返すものが無い)
// ★外へはつながない。WebSocket は偽物(同じページの中で部屋を作るだけ)。助手ライフの「いまの時間帯」はページの中で作る
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
if(!process.env.OFF)await page.evaluate(()=>{RELEASE_FLAGS.rhythmAssistantSession=true;});
// 部屋を作り、呼ぶシートの「助手」のタブを開く
await page.evaluate(()=>{RELEASE_FLAGS.rhythmAssistantSession=true;});
await page.locator('button.mh-home-facility.rhythm').click();
await page.locator('[data-rhythm-mode-private-open]').click();await page.locator('[data-rhythm-multi-create]').click();
await page.waitForSelector('[data-rhythm-multi-room-code]',{timeout:15000});await page.waitForTimeout(600);
// 助手ライフの「いまの時間帯」を作り、ききだけがモンビーに出かけている(練習)ことにする。無料も券も0にする
await page.evaluate(async()=>{RELEASE_FLAGS.assistantLife=true;const st=ASSISTANT_LIFE_STORE.state;ASSISTANT_LIFE_STORE.state={...st,life:{...(st.life||{}),abs:assistantLifeSlotAt().abs,groups:[],solo:{kiki:{place:'studio',doing:'practice'}}}};
  const day=rhythmBuddyDayKey(Date.now());await RHYTHM_BUDDY_STORE.update((s)=>{let x=s;for(let i=0;i<5;i++){const y=rhythmBuddyUseFree(x,day);if(y)x=y;}return x;});});
check('ききだけがモンビーにいる(助手ライフのつなぎ口)',await page.evaluate(()=>assistantLifeAtBeat('kiki')&&!assistantLifeAtBeat('mua')));
check('モンビーにいない助手は、無料も券も無いと誘えない(no_ticket)',await page.evaluate(()=>rhythmAssistSessionInvite('mua').reason==='no_ticket'));
await page.locator('[data-rhythm-buddy-open]').last().click();await page.waitForSelector('[data-rhythm-buddy-sheet]');
await page.locator('[data-rhythm-buddy-tab="assistant"]').click();await page.waitForTimeout(400);
{const g=await page.$('[data-rhythm-assist-guide-close]');if(g)await g.click();}
await page.locator('[data-rhythm-assist-card="kiki"]').click();await page.waitForTimeout(300);
for(const [w,h,rot,lab] of [[390,844,false,'縦画面'],[844,390,false,'横画面'],[390,844,true,'回転(横)'],[375,667,false,'小さい縦画面']]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await page.waitForTimeout(rot?1200:700);
  if(process.env.MH_SHOT_DIR)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`assist-sheet-${lab}.png`)});
  const r=await page.evaluate(()=>{
    const vis=(el)=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0;};
    const tags=[...document.querySelectorAll('[data-rhythm-assist-visit]')].filter(vis);
    // 札とその中の文字が、助手のカードの幅に収まる(縦で🎵が切れていた・2026-11-07)
    const out=[];
    document.querySelectorAll('[data-rhythm-assist-card]').forEach((card)=>{if(!vis(card))return;const c=card.getBoundingClientRect();
      card.querySelectorAll('*').forEach((x)=>{if(!vis(x)||x.children.length)return;const b=x.getBoundingClientRect();if(b.left<c.left-1||b.right>c.right+1)out.push(`${card.getAttribute('data-rhythm-assist-card')}:${(x.innerText||'').trim().slice(0,12)}`);});});
    tags.forEach((t)=>{const o=t.getBoundingClientRect();[...t.children].forEach((x)=>{const b=x.getBoundingClientRect();if(b.left<o.left-1||b.right>o.right+1)out.push(`札の中:${(x.innerText||'').trim()}`);});});
    const cost=[...document.querySelectorAll('[data-rhythm-buddy-multi-cost]')].filter(vis).map((e)=>e.innerText.replace(/\n/g,''));
    const btn=[...document.querySelectorAll('[data-rhythm-buddy-call-all]')].filter(vis).map((b)=>b.disabled);
    return {tags:tags.map((t)=>t.closest('[data-rhythm-assist-card]').getAttribute('data-rhythm-assist-card')),out,cost,btn};
  });
  check(`呼ぶシート(${lab}): モンビーにいる助手(きき)だけに「🎵 いまモンヒロビートにいる・回数なし」の札`,r.tags.join(',')==='kiki',r.tags.join(','));
  check(`呼ぶシート(${lab}): 助手のカードの中の文字・札がカードと札の幅からはみ出さない`,r.out.length===0,r.out.slice(0,6).join(' / '));
  check(`呼ぶシート(${lab}): 回数を使わないと書き、無料も券も0でも「呼ぶ」が押せる`,r.cost.length===1&&/回数は使いません/.test(r.cost[0])&&r.btn.length===1&&r.btn[0]===false,JSON.stringify(r));
}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));await page.waitForTimeout(500);
await page.locator('[data-rhythm-buddy-call-all]:visible').click();
await page.waitForFunction(()=>{const v=RHYTHM_MULTI.view();return v&&(v.myCpus||[]).some((c)=>c.masuId==='as:kiki');},null,{timeout:8000}).catch(()=>{});
const after=await page.evaluate(()=>({called:(RHYTHM_MULTI.view().myCpus||[]).map((c)=>c.masuId),calls:RHYTHM_BUDDY_STORE.get().calls.length}));
check('モンビーにいる助手を呼ぶと、払わずに部屋へ入り、控え(calls)も残さない',after.called.includes('as:kiki')&&after.calls===0,JSON.stringify(after));
// 寝ている助手(社長 2026-11-07「呼んで来てくれるときもあれば断られるときある」)。ドラが寝ている時間帯にし、無料を3回に戻す
await page.evaluate(async()=>{const st=ASSISTANT_LIFE_STORE.state;ASSISTANT_LIFE_STORE.state={...st,life:{...st.life,solo:{...st.life.solo,dra:{place:'home',doing:'sleep'}}}};
  await RHYTHM_BUDDY_STORE.update((s)=>({...s,used:0}));});
const free0=await page.evaluate(()=>rhythmBuddyFreeLeft(RHYTHM_BUDDY_STORE.get(),rhythmBuddyDayKey(Date.now())));
await page.locator('[data-rhythm-buddy-open]').last().click();await page.waitForSelector('[data-rhythm-buddy-sheet]');
await page.locator('[data-rhythm-buddy-tab="assistant"]').click();await page.waitForTimeout(400);
for(const [w,h,rot,lab] of [[390,844,false,'縦画面'],[844,390,false,'横画面'],[390,844,true,'回転(横)']]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await page.waitForTimeout(rot?1200:700);
  const r=await page.evaluate(()=>{const t=[...document.querySelectorAll('[data-rhythm-assist-asleep]')].filter((e)=>e.getBoundingClientRect().width>0);
    const card=t[0]&&t[0].closest('[data-rhythm-assist-card]');const a=t[0]&&t[0].getBoundingClientRect(),c=card&&card.getBoundingClientRect();
    return {who:t.map((x)=>x.closest('[data-rhythm-assist-card]').getAttribute('data-rhythm-assist-card')).join(','),inCard:!!(a&&c&&a.left>=c.left-1&&a.right<=c.right+1&&a.bottom<=c.bottom+1)};});
  check(`呼ぶシート(${lab}): 寝ている助手(ドラ)だけに「💤 寝ている」の札があり、カードに収まる`,r.who==='dra'&&r.inCard,JSON.stringify(r));
}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));await page.waitForTimeout(500);
// 断られる(乱数を大きくする)
await page.evaluate(()=>{window.__rand=Math.random;Math.random=()=>0.999;});
await page.locator('[data-rhythm-assist-card="dra"]').click();await page.waitForTimeout(200);
check('寝ている助手を選ぶと「来ないこともあります(来なければ回数は使いません)」と出る',await page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-buddy-multi-asleep]')].some((e)=>e.getBoundingClientRect().width>0)));
await page.locator('[data-rhythm-buddy-call-all]:visible').click();await page.waitForTimeout(800);
const ref=await page.evaluate(()=>({note:!!document.querySelector('[data-rhythm-assist-refused="dra"]'),inRoom:(RHYTHM_MULTI.view().myCpus||[]).some((c)=>c.masuId==='as:dra'),free:rhythmBuddyFreeLeft(RHYTHM_BUDDY_STORE.get(),rhythmBuddyDayKey(Date.now())),sheet:!!document.querySelector('[data-rhythm-buddy-sheet]')}));
check('断られたら、来ない・回数を使わない・シートに断りの一言が出る',ref.note&&!ref.inRoom&&ref.free===free0&&ref.sheet,JSON.stringify({...ref,free0}));
check('断りの一言は、その助手の refuse の台詞(寝言・断り)',await page.evaluate(()=>{const el=document.querySelector('[data-rhythm-assist-refused="dra"]');const lines=(RHYTHM_ASSIST_SESSION_SOLO_LINES.dra.refuse||[]).map((x)=>x[1]);return !!el&&lines.length>0&&lines.some((t)=>el.textContent.includes(t.replace(/\{name\}/g,'').slice(0,6)));}));
for(const [w,h,rot,lab] of [[390,844,false,'縦画面'],[844,390,false,'横画面'],[390,844,true,'回転(横)']]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await page.waitForTimeout(rot?1200:700);
  if(process.env.MH_SHOT_DIR)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`assist-sheet-refused-${lab}.png`)});
  const fit=await page.evaluate(()=>{const el=document.querySelector('[data-rhythm-assist-refused]');if(!el)return '(一言が無い)';const b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();
    return b.width<=0?'(見えない)':b.left<p.left-1||b.right>p.right+1?`はみ出し ${Math.round(b.right-p.right)}px`:el.scrollWidth>el.clientWidth+1?'文字が切れる':'';});
  check(`断りの一言(${lab}): シートの中に収まり、文字が切れない`,fit==='',fit);
}
await page.setViewportSize({width:390,height:844});await page.evaluate(()=>RHYTHM_VIEW_ROTATION.set(0));await page.waitForTimeout(500);
// 呼び直すと起きやすくなる(1回断られたあとは7割)
check('同じ時間帯に断られた助手は、呼び直すと起きやすくなる(5割→7割)',await page.evaluate(()=>rhythmAssistSessionWakeChanceOf('dra'))===0.7);
// 来てくれる(乱数を小さくする)
await page.evaluate(()=>{Math.random=()=>0;});
await page.locator('[data-rhythm-assist-card="dra"]').click();await page.waitForTimeout(200);
await page.locator('[data-rhythm-buddy-call-all]:visible').click();
await page.waitForFunction(()=>(RHYTHM_MULTI.view().myCpus||[]).some((c)=>c.masuId==='as:dra'),null,{timeout:8000}).catch(()=>{});
await page.evaluate(()=>{Math.random=window.__rand;});
const came=await page.evaluate(()=>({inRoom:(RHYTHM_MULTI.view().myCpus||[]).some((c)=>c.masuId==='as:dra'),free:rhythmBuddyFreeLeft(RHYTHM_BUDDY_STORE.get(),rhythmBuddyDayKey(Date.now()))}));
check('来てくれたら部屋に入り、回数を1回使う',came.inRoom&&came.free===free0-1,JSON.stringify({...came,free0}));
await page.waitForTimeout(800);
const after5=await page.evaluate(()=>({note:!!document.querySelector('[data-rhythm-assist-refused]'),sheet:!!document.querySelector('[data-rhythm-buddy-sheet]')}));
check('断られたあと呼び直して来てくれたら、古い断りの一言は消え、シートも開き直さない(ミハリ B5)',!after5.note&&!after5.sheet,JSON.stringify(after5));
await page.waitForTimeout(2500);
const wokeSaid=await page.evaluate(()=>{const lines=(RHYTHM_ASSIST_SESSION_SOLO_LINES.dra.woke||[]).map((x)=>x[1].replace(/\{name\}/g,'').slice(0,6));const chat=(RHYTHM_MULTI.view().chat||[]).map((c)=>String(c.text||''));return {ok:chat.some((t)=>lines.some((l)=>t.includes(l))),chat:chat.slice(-3)};});
check('来てくれたら、部屋に来たときの一言が起こされた一言(woke)になる',wokeSaid.ok,JSON.stringify(wokeSaid));
check('ページのエラーが出ない',errs.length===0,errs.slice(0,3).join(' / '));
await browser.close();server.close();
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
})().catch((e)=>{console.log('NG: 検査が途中で止まった — '+String(e&&e.message||e).slice(0,300));process.exit(1);});
