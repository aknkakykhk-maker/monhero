#!/usr/bin/env node
// フレンド一覧で、プロフィールフレームの枠が名前・時刻の文字にかぶらないことを、実際のブラウザで測る(2026-10-21)。
//
//   node tools/friends/friends-frame-fit-check.js                 # 確かめる
//   node tools/friends/friends-frame-fit-check.js --shots <dir>   # 幅320・390の一覧の絵も書く
//
// 社長「フレームのサイズ感微妙？」(フレンド一覧・幅390): 画像の枠がアイコンの外へ大きくはみ出し、右の名前と「◯時間前に開きました」の頭を隠していた。
// 決まり: 枠の有無にかかわらず、外側を同じ四角にそろえる(ProfileAvatar の fit)。枠のある人はそのぶん中のアイコンを縮める。小さい版の枠(srcSmall)を使う。
// 見ること(幅320・390):
//   ① 公開中の画像フレームを全種類、1人ずつ付けたフレンドを並べ、どの行も枠の外形が名前・時刻の文字の箱と重ならない
//   ② 枠のある人もない人も、アイコンの置き場所(外側の四角)が同じ大きさ
//   ③ 一覧の枠は小さい版(srcSmall)の絵を使う
// Supabase への通信は偽サーバー(fake-friends-server.js)へ差し替える。本物にはつながない。
'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {createFakeFriendsServer}=require('./fake-friends-server');
const ROOT=path.resolve(__dirname,'../..'),PORT=9191;
const shotsAt=process.argv.indexOf('--shots'),SHOTS=shotsAt>=0?path.resolve(process.argv[shotsAt+1]||'.'):null;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    if(rel.endsWith('game-system.compiled.js')){
      // フレンド機能の公開フラグを立てた状態で配る(本物のファイルは変えない)
      const text=fs.readFileSync(file,'utf8');
      res.writeHead(200,{'Content-Type':'text/javascript'});res.end(text.replace(/const FRIENDS_PUBLIC_RELEASE = (true|false)/,'const FRIENDS_PUBLIC_RELEASE = true'));return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);});
  server.listen(PORT,()=>resolve(server));});

const runAt=async(playwright,width)=>{
  const fake=createFakeFriendsServer(),server=await serve();let browser;const out={};
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e&&e.message?e.message:e)));
    await page.addInitScript(()=>{window.__mhSupabaseStubbed=true;});
    await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**',async(route)=>{
      const request=route.request(),url=request.url();
      if(/\/rest\/v1\/(friend_codes|friend_links|friend_profiles)/.test(url)||(/\/rest\/v1\/breeder_profiles/.test(url)&&request.method()==='GET'&&/breeder_id=in\./.test(url))){
        const r=fake.handle(url,request.method(),request.postData());
        await route.fulfill({status:r.status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:r.body===undefined?'':JSON.stringify(r.body)});return;}
      if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return;}
      await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});});
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);put('mh_breeder_id_v1','self-user');});
    const clickText=async(p)=>page.evaluate((s)=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<14;i++){if(!(await clickText('^(受け取る|閉じる|OK|確認|あとで|次へ|はじめる|決定|スキップ)$')))break;await page.waitForTimeout(250);}
    // 公開中のフレーム(画像は全種類・色の輪は1つ)と、枠の無い人を1人ずつフレンドにする。アイコンはふつうのブリーダーアイコン
    const looks=await page.evaluate(()=>{const list=(typeof releasedProfileFrames==='function'?releasedProfileFrames():PROFILE_FRAMES).filter(f=>f&&f.id);
      const icon=(typeof BREEDER_ICON_OPTIONS!=='undefined'&&BREEDER_ICON_OPTIONS[0]&&BREEDER_ICON_OPTIONS[0].id)||null;
      return {images:list.filter(f=>f.kind==='image').map(f=>f.id),ring:(list.find(f=>f.kind!=='image'&&f.kind!=='none')||{}).id||null,icon};});
    const frames=[...looks.images,...(looks.ring?[looks.ring]:[]),null];
    frames.forEach((frame,i)=>{const id=`friend-${i}`;
      fake.db.breeder_profiles.push({breeder_id:id,user_name:`いちかきき${i}`,icon:looks.icon,profile_frame:frame,updated_at:new Date(Date.now()-3*3600e3).toISOString()});
      fake.db.friend_links.push({requester_id:'self-user',target_id:id,status:'accepted',blocked_by:null,created_at:fake.tick(),updated_at:fake.tick()});});
    out.frames=frames.length;out.images=looks.images.length;
    await page.evaluate(()=>document.querySelector('.mh-home-player')?.click());
    await page.waitForSelector('[data-profile-friends]',{timeout:15000});
    await page.evaluate(()=>document.querySelector('[data-profile-friends]').click());
    await page.waitForFunction((n)=>document.querySelectorAll('[data-friend-presence]').length>=n,frames.length,{timeout:20000});
    await page.waitForTimeout(800);
    if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,`friends-${width}.png`)});}
    Object.assign(out,await page.evaluate(()=>{
      const textBox=el=>{const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return b;};
      const rows=[...document.querySelectorAll('[data-friend-presence]')].map(p=>p.closest('div.flex'));
      const res={overlaps:[],boxes:new Set(),large:[],rows:rows.length};
      for(const row of rows){if(!row)continue;
        const name=row.querySelector('b'),seen=row.querySelector('[data-friend-presence]');
        const box=row.querySelector('[data-profile-avatar-box]')||row.querySelector('.mh-profile-avatar');
        const frame=row.querySelector('.mh-profile-frame');
        const bb=box.getBoundingClientRect();res.boxes.add(`${Math.round(bb.width)}x${Math.round(bb.height)}`);
        if(!frame)continue;
        const fr=frame.getBoundingClientRect();
        for(const el of [name,seen]){const t=textBox(el);const w=Math.min(fr.right,t.right)-Math.max(fr.left,t.left),h=Math.min(fr.bottom,t.bottom)-Math.max(fr.top,t.top);
          if(w>0.5&&h>0.5)res.overlaps.push(`${name.textContent.trim()}(${Math.round(w)}px)`);}
        if(frame.tagName==='IMG'&&!/\/small\//.test(frame.getAttribute('src')||''))res.large.push(name.textContent.trim());}
      res.boxes=[...res.boxes];return res;}));
    out.errors=errors;
  }finally{if(browser)await browser.close();server.close();}
  return out;};

(async()=>{
  let playwright;
  try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  for(const width of [320,390]){
    let r;
    try{r=await runAt(playwright,width);}catch(e){ok(`幅${width}: 実行できた`,false,e.message);continue;}
    ok(`幅${width}: 公開中の画像フレームを全種類並べた(${r.images}種類+色の輪+枠なし)`,r.rows===r.frames&&r.images>0,`${r.rows}行/${r.frames}人`);
    ok(`幅${width}: どの行も、枠の外形が名前・時刻の文字にかぶらない`,r.overlaps.length===0,r.overlaps.slice(0,6).join(' / '));
    ok(`幅${width}: 枠のある人もない人も、アイコンの置き場所が同じ大きさ`,r.boxes.length===1,r.boxes.join(' / '));
    ok(`幅${width}: 一覧の枠は小さい版の絵を使う`,r.large.length===0,r.large.slice(0,4).join(' / '));
    ok(`幅${width}: 実行時エラーが出ない`,r.errors.length===0,r.errors.slice(0,2).join(' / '));}
  console.log(failed?`\n${failed}件 NG`:'\nすべてOK');
  process.exit(failed?1:0);
})();
