#!/usr/bin/env node
// ページの拡大・見えている範囲のずれで「押した所と反応する所がずれる」のを止める仕組みの見張り(2026-11-11)。
//
//   node tools/boot/page-zoom-guard-check.js
//
// 社長「モンヒロでたまにタップズレが起きる。モンビー中や、起動直後の更新情報を見るときに起きやすい」。
// iPhone は viewport の user-scalable=no / maximum-scale を無視するので、演奏中(自前で止めている)以外の画面では
// 2本指でページを拡大できていた。拡大されると window.scrollY は0のまま visualViewport だけがずれ、
// 11/2 に入れた見張り(scrollY が0でなければ戻す)は気づけなかった。
//
// ここでは iPhone をまねて viewport の縛りを外した index.html を配り、実際に2本指で広げて確かめる。
//   ① 直す前の形(touch-action も外す)では、本当に拡大され、scrollY は0のままずれる(=再現できる条件)
//   ② そのとき見張りが気づいて、画面の出来事の記録(vv)に残す
//   ③ いまの形では、タイトル・お知らせの窓・はじめたあとの画面のどこで広げても拡大されない
//   ④ 中の箱のスクロールは止めていない(pan-x pan-y)・演奏エリアなどの touch-action:none はそのまま
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'../..'),PORT=8969;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/10-core.jsx'),'utf8');
const RULE='html, body, #root { touch-action: pan-x pan-y; }';
const guard=(core.match(/const MH_PAGE_OFFSET_GUARD=[\s\S]*?\n\}\)\(\);/)||[''])[0];
ok('index.html がページの拡大を止めている(touch-action: pan-x pan-y)',html.includes(RULE));
ok('見張りは visualViewport の位置と倍率も見る',/vv\.offsetTop/.test(guard)&&/vv\.offsetLeft/.test(guard)&&/vv\.scale/.test(guard));
ok('見張りは起動のとき・戻ってきたときにも見る',["'load'","'pageshow'","'visibilitychange'"].every(k=>guard.includes(k)));
ok('見張りは入力中は戻さない',/const reset=\(\)=>\{\s*if\(editing\(\)\)return;/.test(guard));
ok('見張りは演奏中のタッチ・毎コマでは動かない',!/touchstart|touchmove|pointerdown|pointermove|requestAnimationFrame/.test(guard));
ok('見張りは拡大が解けたら resize を鳴らして測り直させる',/if\(wasBig\)\{wasBig=false;remeasure\(\);\}/.test(guard)&&/dispatchEvent\(new Event\('resize'\)\)/.test(guard));
ok('見張りは押したとき(click)にも見る',/document\.addEventListener\('click',reset,\{capture:true,passive:true\}\)/.test(guard));
ok('2本指の合図(gesturestart)をどの画面でも止める',/\['gesturestart','gesturechange'\]\.forEach\(type=>document\.addEventListener\(type,e=>\{if\(e\.cancelable\)e\.preventDefault\(\);\},\{passive:false\}\)\)/.test(guard));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
// iPhone のまね: viewport の拡大の縛りを外す。/old/ から始まる道は、直す前の形(touch-action も無い)
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  let rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
  const old=rel.startsWith('old/');if(old)rel=rel.slice(4);
  const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  if(rel.endsWith('index.html')){
    let body=html.replace(', maximum-scale=1.0, user-scalable=no','');
    if(old)body=body.replace(RULE,'').replace(':where(body *) { touch-action: pan-x pan-y; }','');   // 2026-11-11 箱の中の縛り(browser-gesture-guard-check)も外す
    res.end(body);return;
  }
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});
(async()=>{
  let chromium;
  try{({chromium}=require('playwright'));}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const open=async prefix=>{
      const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/${prefix}monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      const cdp=await ctx.newCDPSession(page);
      // 2本の指を置いて、左右へ広げる
      const pinch=async(cx,cy)=>{const pts=d=>[{x:cx-d,y:cy,id:1},{x:cx+d,y:cy,id:2}];
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(20)});
        for(let d=30;d<=80;d+=10){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(d)});await page.waitForTimeout(16);}
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);};
      const vv=()=>page.evaluate(()=>({scale:Math.round(visualViewport.scale*100)/100,ot:Math.round(visualViewport.offsetTop),ol:Math.round(visualViewport.offsetLeft),sy:Math.round(window.scrollY)}));
      return {ctx,page,pinch,vv};
    };
    const show=s=>`倍率 ${s.scale} / 見えている範囲のずれ ${s.ol},${s.ot} / scrollY ${s.sy}`;
    // ①② 直す前の形
    {
      const {ctx,page,pinch,vv}=await open('old/');
      await pinch(195,400);
      const s=await vv();
      ok('① 直す前の形では2本指で拡大され、scrollY は0のままずれる(再現できる条件)',s.scale>1.05&&s.sy===0&&(s.ot>0||s.ol>0),show(s));
      await page.waitForTimeout(2300);
      const trail=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('mh_screen_trail_v1')||'[]');}catch(_){return [];}});
      const hit=trail.find(x=>x&&x.k==='vv');
      ok('② 見張りが拡大に気づいて、画面の出来事の記録に残す',!!hit&&/^s\d/.test(hit.d),hit?hit.d:'vv の記録なし');
      // ⑥ 拡大が解けたら resize を1回鳴らす(拡大中に測った画面の大きさ=🔄横の器・押した点の直しを測り直させる)
      const r=await page.evaluate(async()=>{
        const vvp=window.visualViewport;let fake=1.4,n=0;
        Object.defineProperty(vvp,'scale',{configurable:true,get:()=>fake});
        const count=()=>{n++;};window.addEventListener('resize',count);
        const wait=ms=>new Promise(r=>setTimeout(r,ms));
        vvp.dispatchEvent(new Event('resize'));await wait(900);const whileBig=n;
        fake=1;vvp.dispatchEvent(new Event('resize'));await wait(900);const afterBack=n;
        vvp.dispatchEvent(new Event('resize'));await wait(900);const again=n;
        window.removeEventListener('resize',count);delete vvp.scale;
        return {whileBig,afterBack,again};
      });
      ok('⑥ 拡大が解けたら、画面の大きさを測り直させる(resize を1回だけ)',r.whileBig===0&&r.afterBack===1&&r.again===1,`拡大中 ${r.whileBig} / 解けたあと ${r.afterBack} / そのあと ${r.again}`);
      await ctx.close();
    }
    // ③④ いまの形
    {
      const {ctx,page,pinch,vv}=await open('');
      const same=s=>s.scale===1&&s.ot===0&&s.ol===0&&s.sy===0;
      await pinch(195,400);let s=await vv();
      ok('③ タイトルで広げても拡大されない',same(s),show(s));
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.waitForTimeout(800);
      const opened=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/お知らせ|更新情報|更新履歴|✦/.test(x.innerText||''));if(!b)return false;b.click();return true;});
      if(opened){
        await page.waitForSelector('[data-changelog-list] article',{timeout:10000});
        await pinch(195,420);s=await vv();
        ok('③ お知らせ(更新情報)の窓で広げても拡大されない',same(s),show(s));
        // 中の一覧は指でスクロールできる
        const before=await page.evaluate(()=>{const el=document.querySelector('[data-changelog-list]');let p=el;while(p&&!(p.scrollHeight>p.clientHeight+20&&/auto|scroll/.test(getComputedStyle(p).overflowY)))p=p.parentElement;window.__zoomCheckBox=p;return p?p.scrollTop:null;});
        if(before!==null){
          const cdp=await ctx.newCDPSession(page);
          await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:600,id:1}]});
          for(let y=580;y>=300;y-=20){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y,id:1}]});await page.waitForTimeout(16);}
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(500);
          const after=await page.evaluate(()=>window.__zoomCheckBox.scrollTop);
          ok('④ 窓の中の一覧は、指でスクロールできる',after>before+50,`${before} → ${after}`);
        }else ok('④ 窓の中の一覧は、指でスクロールできる',false,'スクロールする箱が見つからない');
        s=await vv();
        ok('  スクロールのあともページはずれていない',same(s),show(s));
        await page.keyboard.press('Escape');
        await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(閉じる|とじる|×|✕)$/.test((x.innerText||'').trim())||/閉じる/.test(x.getAttribute('aria-label')||''));if(b)b.click();});
        await page.waitForTimeout(300);
      }else ok('お知らせの窓を開ける',false);
      await page.waitForTimeout(700);
      await pinch(195,400);s=await vv();
      ok('③ 窓を閉じたあとの画面で広げても拡大されない',same(s),show(s));
      const trail=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('mh_screen_trail_v1')||'[]');}catch(_){return [];}});
      ok('  ずれていないときは、記録を増やさない',!trail.some(x=>x&&x.k==='vv'));
      // 合図が何も来ないままページがずれていても、次のひと押しで戻る(どの画面のボタンでも同じ道)
      const healed=await page.evaluate(async()=>{
        const spacer=document.createElement('div');spacer.style.cssText='height:400px';document.body.appendChild(spacer);
        const prev=document.documentElement.style.overflow;document.documentElement.style.overflow='visible';
        window.scrollTo(0,120);
        await new Promise(r=>setTimeout(r,900));   // スクロールの合図で動く見張りが済むのを待つ
        window.scrollTo(0,120);const before=Math.round(window.scrollY);
        document.body.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        const after=Math.round(window.scrollY);
        spacer.remove();document.documentElement.style.overflow=prev;
        return {before,after};
      });
      ok('⑤ ページがずれていても、次のひと押し(click)で0へ戻る',healed.before>0&&healed.after===0,`${healed.before} → ${healed.after}`);
      const ta=await page.evaluate(()=>{const el=document.createElement('div');el.style.touchAction='none';document.getElementById('root').appendChild(el);const v=getComputedStyle(el).touchAction;el.remove();return v;});
      ok('④ touch-action:none の所はそのまま',ta==='none',ta);
      await ctx.close();
    }
    // 横向き(本体を横に持った形)でも同じ
    {
      const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await ctx.newPage();
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      const cdp=await ctx.newCDPSession(page);
      const pts=d=>[{x:422-d,y:200,id:1},{x:422+d,y:200,id:2}];
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pts(20)});
      for(let d=30;d<=80;d+=10){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pts(d)});await page.waitForTimeout(16);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(350);
      const sc=await page.evaluate(()=>Math.round(visualViewport.scale*100)/100);
      ok('③ 横向きの画面で広げても拡大されない',sc===1,`倍率 ${sc}`);
      await ctx.close();
    }
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
