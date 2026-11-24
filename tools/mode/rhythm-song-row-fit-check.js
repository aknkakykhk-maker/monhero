// モンヒロビートのソロの曲えらび: 左の曲の一覧の行で、Lv.・ランク・スコア・「2つの版」などの札が重ならず、行からはみ出さないかを測る
// (2026-11-24 ミハリの気付き: 小さい横 568×320 で、行のスコア「C 799…」と「2つの版」の札が重なっていた)。
//
//   node tools/mode/rhythm-song-row-fit-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 全曲・全難易度に7桁近い自己ベストを入れ、横 844×390・667×375・568×320、🔄横 390・320、縦 390・320 で、一覧の全部の行を測る。
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const http=require('http'),fs=require('fs');
let playwright;
try{playwright=require(path.join(ROOT,'tools','node_modules','playwright'));}catch(_){try{playwright=require('playwright');}catch(e){console.log('SKIP: playwright が無いので測れません');process.exit(0);}}
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail&&!ok?` — ${detail}`:''}`);if(!ok)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.PNG':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');const f=path.join(ROOT,rel);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,()=>r(s));});
(async()=>{const server=await serve();const PORT=server.address().port;
const browser=await playwright.chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const page=await context.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));put('mh_breeder_name','ブリーダー');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_hell_story_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);});
await page.addInitScript(require(ROOT+'/tools/boot/quiet-boot-seed').eventStorySeed());
await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
// 全曲・全難易度に自己ベスト(6〜7桁)を入れる。難易度の札に数字の段が出て、HELL まで開いた形(社長の写真と同じ)
await page.waitForFunction(()=>typeof RHYTHM_SONGS!=='undefined'&&typeof rhythmSongDifficultyDefs==='function',null,{timeout:60000});
await page.evaluate(()=>{const rec={};RHYTHM_SONGS.forEach(s=>{rec[s.songId]={};rhythmSongDifficultyDefs(s).forEach((d,i)=>{rec[s.songId][d.id]={bestScore:799166+i*35000,maxCombo:400,played:true,clear:true};});});
  ['mh_rhythm_best_v1','mh_rhythm_best_v2'].forEach(k=>localStorage.setItem(k,JSON.stringify(rec)));});
await page.reload({waitUntil:'load'});
await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),null,{timeout:60000});
await page.getByText('TAP TO START').click();await page.waitForTimeout(2500);await page.mouse.click(422,195);await page.waitForTimeout(3000);
await page.evaluate(()=>{setInterval(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;const b=d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]')||[...d.querySelectorAll('button')].find(x=>/受け取|閉じる|とじる|OK|(?:始|はじ)める|(?:分|わ)かった|^次へ|あとで|見た/.test(x.innerText));if(b)b.click();},250);});
await page.waitForFunction(()=>document.querySelector('button[data-home-fac="rhythm"]')&&!document.querySelector('[role=dialog]'),null,{timeout:40000});
await page.locator('button[data-home-fac="rhythm"]').click();
await page.locator('[data-rhythm-mode-solo]').click();
await page.waitForSelector('[data-rhythm-song-detail]',{timeout:20000});await page.waitForTimeout(1500);
const CASES=[[844,390,0,'横844'],[667,375,0,'小さい横667'],[568,320,0,'小さい横568'],[390,844,90,'🔄横390'],[320,568,90,'🔄横320'],[390,844,0,'縦390'],[320,568,0,'縦320']];
for(const wide of [false,true]){
 for(const [w,h,rot,lab0] of CASES){
  const lab=lab0+(wide?'・字が広い':'');
  await page.setViewportSize({width:w,height:h});await page.evaluate(d=>RHYTHM_VIEW_ROTATION.set(d),rot);
  await page.evaluate((on)=>{let st=document.getElementById('__wide');if(!st){st=document.createElement('style');st.id='__wide';document.head.appendChild(st);}st.textContent=on?'[data-rhythm-song-list]{letter-spacing:.09em}':'';},wide);
  await page.waitForTimeout(rot?1200:700);
  // 一覧を上から下まで送りながら、見えている行を全部測る
  const r=await page.evaluate(async()=>{const list=document.querySelector('[data-rhythm-song-list]');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const bad=new Set();let rows=0;const seen=new Set();
    const B=e=>e.getBoundingClientRect();
    for(let y=0;y<=list.scrollHeight;y+=Math.max(80,list.clientHeight-40)){list.scrollTop=y;await sleep(120);
      for(const row of document.querySelectorAll('[data-rhythm-song-row]')){const id=row.getAttribute('data-rhythm-song-row');if(seen.has(id))continue;const rb=B(row);if(rb.width<=0||rb.bottom<0||rb.top>innerHeight)continue;seen.add(id);rows++;
        const line=row.querySelector('[data-rhythm-song-row-level-tone]')&&row.querySelector('[data-rhythm-song-row-level-tone]').parentElement;if(!line)continue;
        const lb=B(line);
        const kids=[...line.querySelectorAll(':scope > *, :scope > small > *')].filter(e=>{const b=B(e);return b.width>0&&getComputedStyle(e).display!=='none';});
        const items=kids.filter(e=>e.parentElement===line?!e.matches('small[data-rhythm-song-row-rank]'):true).map(e=>({e,b:B(e),n:(e.textContent||e.getAttribute('title')||'').trim().slice(0,10)}));
        for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i].b,c=items[j].b;if(items[i].e.contains(items[j].e)||items[j].e.contains(items[i].e))continue;
          if(Math.min(a.right,c.right)-Math.max(a.left,c.left)>1&&Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)>1)bad.add(`${id}: 「${items[i].n}」と「${items[j].n}」が重なる`);}
        // 回したときは行の幅が縦の向きになる。行の箱(row)から出ていないかで見る
        for(const it of items){const b=it.b;if(b.left<rb.left-1||b.right>rb.right+1||b.top<rb.top-1||b.bottom>rb.bottom+1)bad.add(`${id}: 「${it.n}」が行の外へ出る`);}
      }}
    list.scrollTop=0;return {rows,bad:[...bad]};});
  if(process.env.MH_SHOT_DIR&&wide)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`row-fit-${lab.replace(/[ ・×]/g,'_')}.png`)});
  check(`${lab}: 曲の一覧の${r.rows}行で、Lv.・スコア・版の札などが重ならず行に収まる`,r.rows>5&&!r.bad.length,`${r.bad.length}件 ${r.bad.slice(0,6).join(' / ')}`);
 }
}
check('ページのエラーが出ない',errs.length===0,errs.slice(0,3).join(' / '));
await browser.close();server.close();
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
})().catch((e)=>{console.log('NG: 検査が途中で止まった — '+String(e&&e.message||e).slice(0,300));process.exit(1);});
