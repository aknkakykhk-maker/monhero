#!/usr/bin/env node
// 空中の判定の文字(HELL の SKY TAP・SKY SLIDE の MARVELOUS など)が、地上の判定と同じ時間(RHYTHM_JUDGMENT_DISPLAY_MS)で消えるか。
//
//   node tools/mode/rhythm-sky-judgment-text-check.js [秒数(既定30)]
//
// 2026-10-11 社長「HELL確認したら空中判定(マーベラス)がでっぱなしになってた」。
// 消す予約が地上と空中で1本だったため、地上の判定が来るたびに空中の文字の消える時刻まで先へ延び、
// 地上のノーツが続くあいだ空中の文字が残っていた(直す前: Sheriruth HELL 最長2.6秒・Grievous Lady HELL 最長4.7秒)。
// デバッグの試作の枠から HELL の2曲を流し、何も押さずに(全部 MISS)、最後の空中の判定から 450ms+250ms を過ぎても
// 空中の文字が出ていたら NG。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9061;
let playwright;try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}).listen(PORT);
const SECONDS=Number(process.argv[2]||30);
(async()=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  let bad=0;
  for(const id of ['sheriruth_hell_debug','grievous_lady_hell','kaze_ga_soyogu_hell_debug']){
    const page=await browser.newPage({viewport:{width:844,height:390}});
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','あつ');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);});
    const clickText=(re)=>page.evaluate((p)=>{const b=[...document.querySelectorAll('button,summary')].find(x=>new RegExp(p).test(x.textContent));if(b)b.click();return !!b;},re);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForTimeout(2000);
    for(let i=0,q=0;i<80&&q<6;i++){if(await clickText('^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|次へ)$')){q=0;await page.waitForTimeout(300);}else{q++;await page.waitForTimeout(400);}}
    await page.evaluate(()=>document.querySelector('button[aria-label="設定"]')?.click());await page.waitForTimeout(900);
    await clickText('^ヘルプ');await page.waitForTimeout(900);
    await clickText('💊');await page.waitForTimeout(1200);
    await page.evaluate(()=>{const s=[...document.querySelectorAll('summary')].find(x=>/モンヒロビート/.test(x.textContent));if(s)s.click();});await page.waitForTimeout(500);
    await page.evaluate(()=>document.querySelector('[data-debug-rhythm-mode]')?.click());await page.waitForTimeout(1500);
    const diff=await page.evaluate((id)=>{const song=RHYTHM_PROTO_SONGS.find(s=>s.songId===id);return Object.keys(song.difficulties).find(k=>{const n=song.difficulties[k]&&song.difficulties[k].notes;return Array.isArray(n)&&n.some(x=>rhythmNoteIsSky(x));});},id);
    const started=await page.evaluate(([id,diff])=>{const b=document.querySelector(`[data-rhythm-proto-song="${id}"] [data-rhythm-proto-start="${diff}"]`);if(b)b.click();return !!b;},[id,diff]);
    if(!started){console.log(id,'NG 始められない');bad++;await page.close();continue;}
    await page.waitForFunction(()=>window.__mhTestHooks?.rhythmSongMs?.()>0,{timeout:30000});
    // 何も押さない(全部 MISS になる)ので、空中のノーツも判定線を過ぎた順に MISS が出る
    const r=await page.evaluate(async([id,sec,diff])=>{
      const song=RHYTHM_PROTO_SONGS.find(s=>s.songId===id);const notes=song.difficulties[diff].notes;
      const sky=new Set(notes.map((n,i)=>rhythmNoteIsSky(n)?i:-1).filter(i=>i>=0));
      const el=()=>document.querySelector('[data-rhythm-sky-judgment-display] [data-rhythm-judgment-text]');
      let lastSkyDone=null,doneSky=new Set(),worst=0,worstAt=null,samples=0,lingering=0;
      const t0=performance.now();
      while(performance.now()-t0<sec*1000){
        const res=window.__mhTestHooks.rhythmNoteResults?.()||[];const now=performance.now();
        for(const x of res){if(x.done&&sky.has(x.index)&&!doneSky.has(x.index)){doneSky.add(x.index);lastSkyDone=now;}}
        const text=(el()?.textContent||'').trim();
        if(text&&lastSkyDone!=null){const since=now-lastSkyDone;if(since>worst){worst=since;worstAt=window.__mhTestHooks.rhythmSongMs();}if(since>RHYTHM_JUDGMENT_DISPLAY_MS+250)lingering++;}
        samples++;await new Promise(r=>setTimeout(r,40));
      }
      return {skyNotes:sky.size,skyJudged:doneSky.size,worstMs:Math.round(worst),worstSongMs:Math.round(worstAt||0),lingeringSamples:lingering,samples};
    },[id,SECONDS,diff]);
    const ok=r.worstMs<=450+250;if(!ok)bad++;
    console.log(id,diff,ok?'OK':'NG','空中の判定のあと文字が残った最長',r.worstMs+'ms','(曲の',(r.worstSongMs/1000).toFixed(1)+'秒あたり)','残っていた回数',r.lingeringSamples,'/',r.samples,'空中の判定',r.skyJudged,'/',r.skyNotes);
    await page.close();
  }
  await browser.close();server.close();console.log(bad?`\n${bad}曲 NG`:'\nすべてOK');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
