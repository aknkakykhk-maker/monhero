#!/usr/bin/env node
// 更新履歴が「見出しだけの一覧 → 押した項目だけ詳細」になっているかを実ブラウザで確かめる。
//
//   node tools/changelog/collapsed-detail-check.js
//
// 2026-09-05・ユーザー指示「更新情報の内容が細かすぎる。もう少し簡潔に表示して、
// タップすると詳細が見れるようにしてほしい」。
//   ① 開いた直後は、どの項目も本文(items)を出していない
//   ② 見出しを押すとその項目だけ本文が出る(1つ以上の行がある)
//   ③ 別の見出しを押すと前のものは閉じ、押したものだけが開く(開くのは常に1つ)
//   ④ もう一度押すと閉じる
//   ⑤ 見出し(b)と種類の札は折りたたんでいても出ている(他の検査もここを見る)
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'../..'),PORT=8953;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});
(async()=>{
  let chromium;
  try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.waitForTimeout(800);
    const opened=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/お知らせ|更新情報|更新履歴|✦/.test(x.innerText||''));if(!b)return false;b.click();return true;});
    ok('更新履歴を開ける',opened);
    await page.waitForSelector('[data-changelog-list] article',{timeout:10000});
    const state=()=>page.evaluate(()=>{const arts=[...document.querySelectorAll('[data-changelog-list] article')];
      return {articles:arts.length,
        open:arts.filter(a=>a.dataset.changelogOpen==='1').length,
        details:document.querySelectorAll('[data-changelog-list] [data-changelog-detail]').length,
        detailLines:[...document.querySelectorAll('[data-changelog-list] [data-changelog-detail] p')].length,
        withTitle:arts.filter(a=>a.querySelector('b')&&(a.querySelector('b').textContent||'').trim()).length,
        withKind:arts.filter(a=>a.querySelector('.mh-changelog-kind')).length,
        toggles:arts.filter(a=>a.querySelector('[data-changelog-toggle]')).length};});
    let s=await state();
    ok('項目が並んでいる',s.articles>0,`${s.articles}件`);
    ok('① 開いた直後はどの項目も本文を出していない',s.open===0&&s.details===0,`開いている ${s.open} / 本文 ${s.details}`);
    ok('⑤ 折りたたんでいても見出しと札は出ている',s.withTitle===s.articles&&s.withKind===s.articles,`見出し ${s.withTitle} / 札 ${s.withKind} / ${s.articles}件`);
    ok('すべての項目に押せる見出しがある',s.toggles===s.articles,`${s.toggles}/${s.articles}`);
    const tap=i=>page.evaluate(i=>{const t=document.querySelectorAll('[data-changelog-list] [data-changelog-toggle]')[i];if(!t)return false;t.click();return true;},i);
    await tap(0);await page.waitForTimeout(150);s=await state();
    ok('② 見出しを押すとその項目だけ本文が出る',s.open===1&&s.details===1&&s.detailLines>=1,`開いている ${s.open} / 本文 ${s.details} / 行 ${s.detailLines}`);
    const firstOpen=await page.evaluate(()=>document.querySelector('[data-changelog-list] article')?.dataset.changelogOpen);
    ok('  開いたのは押した項目(1つめ)',firstOpen==='1');
    await tap(1);await page.waitForTimeout(150);s=await state();
    const which=await page.evaluate(()=>[...document.querySelectorAll('[data-changelog-list] article')].map(a=>a.dataset.changelogOpen).slice(0,2).join(','));
    ok('③ 別の見出しを押すと前のものは閉じ、押したものだけが開く',s.open===1&&which==='0,1',`開いている ${s.open} / 先頭2件 ${which}`);
    await tap(1);await page.waitForTimeout(150);s=await state();
    ok('④ もう一度押すと閉じる',s.open===0&&s.details===0,`開いている ${s.open}`);
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
