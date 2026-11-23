// オプションの「空中スライドの色」の欄を撮る(台帳 r1119-149 追記3): node docs/progress/beat/sky-slide-color-2026-11-23/shoot-options.js
// 縦(375×667)と横(844×390)。欄までスクロールし、既定(空中・地上)と「左右の手」を選んだ所を撮る
const path=require('path'),http=require('http'),fs=require('fs');
const root=path.resolve(__dirname,'../../../..'),PORT=9461,OUT=path.join(__dirname,'options');fs.mkdirSync(OUT,{recursive:true});
const quiet=require(path.join(root,'tools/boot/quiet-boot-seed'));
(async()=>{const server=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end();return;}
 r.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'}[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);}).listen(PORT);
 const b=await require('playwright').chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
 for(const [name,w,h] of [['tate',375,667],['yoko',844,390]]){
  const page=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:2});
  await page.addInitScript(()=>{if(sessionStorage.getItem('s'))return;sessionStorage.setItem('s','1');const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
   put('mh_breeder_name','テスト');put('mh_breeder_icon','Mocchi');put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
   put('mh_rhythm_tutorial_seen_v1',true);put('mh_quick_rhythm_intro_seen_v1',true);put('mh_quick_rhythm_bg_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_inherited_unique_level_compensation_pending_v1',false);
   put('mh_monster_roster',['Suezo','Golem','Tiger']);put('mh_clears_Beginner',3);put('mh_quick_clears_Beginner',3);});
  await page.addInitScript(quiet.quietBootSeed());await page.addInitScript(quiet.updateNoticeSeed());await page.addInitScript(()=>{window.__mhSupabaseStubbed=true;});
  await page.route('**/functions/v1/**',r=>r.fulfill({status:503,body:'{}'}));await page.route('**/rest/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'TAP TO START'}).click({timeout:90000});
  const top=page.getByRole('button',{name:'トップ画面へ進む'}),home=page.locator('button[aria-label="モンヒロバトル"]');
  const cp=()=>page.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&/^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText||'').trim())&&!x.closest('[data-mh-screen]'));if(x){x.click();return true;}return false;});
  for(let i=0;i<120&&!(await home.isVisible().catch(()=>false));i++){if(await top.isVisible().catch(()=>false))await top.dispatchEvent('pointerdown').catch(()=>{});await cp();await page.waitForTimeout(500);}
  await page.evaluate(()=>{const x=[...document.querySelectorAll('button')].find(x=>x.offsetParent&&/モンヒロビート/.test((x.getAttribute('aria-label')||'')+' '+(x.innerText||'')));if(x)x.click();});
  await page.waitForTimeout(2500);for(let i=0;i<4&&await cp();i++)await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelector('[data-rhythm-mode-options]')?.click());await page.waitForTimeout(1500);
  for(const tab of await page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-options-tab]')].map(x=>x.getAttribute('data-rhythm-options-tab')))){
   await page.evaluate(t=>document.querySelector(`[data-rhythm-options-tab="${t}"]`)?.click(),tab);await page.waitForTimeout(400);
   if(await page.evaluate(()=>{const n=document.querySelector('[data-rhythm-sky-slide-color-note]');if(!n)return false;n.closest('[data-rhythm-option-field]')?.scrollIntoView({block:'center'});return true;}))break;}
  await page.waitForTimeout(400);await page.screenshot({path:path.join(OUT,`${name}-height.png`)});
  await page.evaluate(()=>{const f=document.querySelector('[data-rhythm-sky-slide-color-note]').closest('[data-rhythm-option-field]');[...f.querySelectorAll('button')].find(x=>/左右の手/.test(x.innerText))?.click();});
  await page.waitForTimeout(400);await page.screenshot({path:path.join(OUT,`${name}-hand.png`)});console.log(name);await page.close();}
 await b.close();server.close();})();
