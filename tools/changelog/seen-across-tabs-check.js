#!/usr/bin/env node
// 更新履歴の「既読」がタブの振り分けを変えても消えないことを、本物のブラウザで確かめる。
//
// 【なぜ道具にするか】
// 既読はタブごとに mh_changelog_seen_ids_<タブ> へ保存している。
// どの項目をどちらのタブへ出すかを変えると、前に読んだ項目のIDが別のタブへ移る。
// タブごとのID一覧でふるいにかけたり、開いたタブのIDで上書きしたりしていると、
// 移った先で未読(NEW)へ戻り、既読が実質的に消える。
// 2026-09-05に不具合修正(fix)を「更新情報」から「不具合情報」へ移したときの前提。
//
// ここでは旧ビルドの保存の形(fixのIDが update 側だけに入っている状態)を実際に作り、
// 読み込み直してNEWが出ないことを見る。localStorageの中身と画面の両方を見るので、
// 「保存はできているのに画面ではNEWになる」も拾える。
//
//   node tools/changelog/seen-across-tabs-check.js
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'../..');const PORT=9011;
const MIME={'.js':'text/javascript','.html':'text/html','.json':'application/json','.png':'image/png','.PNG':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
const srv=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html';
  const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  const buf=fs.readFileSync(f);
  res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Content-Length':buf.length});
  res.end(buf);
});
let failed=0;const ok=(n,c,d='')=>{console.log(`${c?'OK':'NG'}: ${n}${d?` — ${d}`:''}`);if(!c)failed++;};
const openChangelog=async(page)=>{
  await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
  await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/お知らせ|更新情報|更新履歴|✦/.test(x.innerText||''));b&&b.click();});
  await page.waitForTimeout(800);
};
const tab=async(page,name)=>{
  await page.evaluate((n)=>{const b=[...document.querySelectorAll('.mh-changelog-tabs button')].find(x=>x.innerText.includes(n));b&&b.click();},name);
  await page.waitForTimeout(500);
};
const newCount=(page)=>page.evaluate(()=>[...document.querySelectorAll('[data-changelog-list] article')].filter(a=>a.classList.contains('unread')).length);
(async()=>{
  let pw;
  try{pw=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので画面は確認できません');process.exit(failed?1:0);}
  await new Promise(r=>srv.listen(PORT,r));
  const browser=await pw.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await browser.newContext({viewport:{width:390,height:844}});
  const page=await ctx.newPage();
  await page.route('**cdn.tailwindcss.com**',r=>r.abort());
  const URL=`http://localhost:${PORT}/monster-hero/index.html`;
  try{
    // 1回目: 両方のタブを開いて全部を既読にする
    await page.goto(URL,{waitUntil:'load',timeout:60000});
    await openChangelog(page);
    await tab(page,'不具合情報'); await tab(page,'更新情報'); await tab(page,'不具合情報');
    await page.waitForTimeout(600);
    const seen=await page.evaluate(()=>({
      update:JSON.parse(localStorage.getItem('mh_changelog_seen_ids_update')||'[]'),
      issue:JSON.parse(localStorage.getItem('mh_changelog_seen_ids_issue')||'[]')}));
    ok('両タブを開くと既読が保存される',seen.update.length>0&&seen.issue.length>0,
      `更新情報${seen.update.length}件 / 不具合情報${seen.issue.length}件`);
    const fixIds=seen.issue.filter(id=>id.startsWith('fix-'));
    ok('不具合情報タブに不具合修正のIDが入っている',fixIds.length>0,`${fixIds.length}件`);

    // 2回目: 旧ビルドの保存の形へ戻す(fixのIDを update 側だけに持たせる)
    await page.evaluate(({fixIds,seen})=>{
      localStorage.setItem('mh_changelog_seen_ids_update',JSON.stringify([...seen.update,...fixIds]));
      localStorage.setItem('mh_changelog_seen_ids_issue',JSON.stringify(seen.issue.filter(id=>!id.startsWith('fix-'))));
    },{fixIds,seen});
    await page.goto(URL,{waitUntil:'load',timeout:60000});
    await openChangelog(page);
    await tab(page,'不具合情報');
    const unread=await newCount(page);
    ok('旧い保存でも不具合修正がNEWへ戻らない',unread===0,`NEW ${unread}件`);
    const badge=await page.evaluate(()=>{
      const b=[...document.querySelectorAll('.mh-changelog-tabs button')].find(x=>x.innerText.includes('不具合情報'));
      return !!b?.querySelector('.mh-unread-badge');});
    ok('タブにも未読マークが出ない',badge===false,badge?'出ている':'出ていない');
  }catch(e){ ok('最後まで進められる',false,String(e).split('\n')[0]); }
  finally{ await browser.close(); srv.close(); }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
