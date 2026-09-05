#!/usr/bin/env node
// 更新情報の一覧で、不具合修正と新機能が見分けられることを確かめる。
//
//   node tools/changelog/type-badge-check.js
//
// 【なぜ要るか】(2026-09-05・ユーザー指摘)
// 「直近の更新情報が不具合修正との区別がついてないから判別つく仕組みにして」
//
// データには前から type(fix/feature/update/market/issue)があったのに、画面へは
// 日付とタイトルと本文しか出しておらず、読んでも種類が分からなかった。
// ここでは実際にタイトル画面の更新履歴を開き、各項目に種類の札が付いていることを見る。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=8997;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

// --- データ側 ---
const vm=require('vm');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','changelog.js'),'utf8');
const box={};vm.createContext(box);vm.runInContext(src+';globalThis.__c=CHANGELOG;',box);
const shipped=box.__c.filter(e=>e.dev!==true);
const KNOWN=['fix','feature','update','market','issue'];
ok('出している項目に必ず種類が付いている',
  shipped.every(e=>KNOWN.includes(e.type)),
  shipped.filter(e=>!KNOWN.includes(e.type)).slice(0,3).map(e=>`${e.date} ${e.title}`).join(' / ')||`${shipped.length}件すべて`);
const counts={};shipped.forEach(e=>counts[e.type]=(counts[e.type]||0)+1);
ok('不具合修正と新機能がどちらも記録されている',(counts.fix||0)>0&&(counts.feature||0)>0,JSON.stringify(counts));

// --- 画面側 ---
(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので画面は確認できません');process.exit(failed?1:0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**cdn.tailwindcss.com**',r=>r.abort());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    // TAP TO START を抜けたところに更新履歴の入口がある
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.waitForTimeout(1200);
    const opened=await page.evaluate(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>/お知らせ|更新情報|更新履歴|✦/.test(x.innerText||''));
      if(!b)return false;b.click();return true;});
    ok('更新履歴を開ける',opened,
      opened?'':await page.evaluate(()=>[...document.querySelectorAll('button')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,12).join(' / ')));
    if(opened){
      await page.waitForTimeout(800);
      const view=await page.evaluate(()=>{
        const list=document.querySelector('[data-changelog-list]');
        const articles=[...(list?list.querySelectorAll('article'):[])];
        return {
          articles:articles.length,
          withKind:articles.filter(a=>a.querySelector('.mh-changelog-kind')).length,
          first:articles.slice(0,5).map(a=>({
            kind:(a.querySelector('.mh-changelog-kind')||{}).textContent||'(札なし)',
            tone:(a.querySelector('.mh-changelog-kind')||{}).dataset?.kind||'',
            title:(a.querySelector('b')||{}).textContent||''})),
        };
      });
      ok('更新履歴に項目が並んでいる',view.articles>0,`${view.articles}件`);
      ok('すべての項目に種類の札が付いている',view.articles>0&&view.withKind===view.articles,
        `${view.withKind}/${view.articles}件`);
      const kinds=new Set(view.first.map(f=>f.kind));
      ok('直近の並びで種類が見分けられる',kinds.size>=2,
        view.first.map(f=>`[${f.kind}]${f.title.slice(0,20)}`).join(' / '));
      ok('不具合修正の札が出ている',view.first.some(f=>f.tone==='fix'),
        view.first.map(f=>f.tone).join(','));
    }
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
