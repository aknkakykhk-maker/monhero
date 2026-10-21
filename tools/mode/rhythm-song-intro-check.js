#!/usr/bin/env node
// 曲が始まる前の幕(ジャケット・曲名・難易度)を確かめる。
//
//   node tools/mode/rhythm-song-intro-check.js
//
// ① 幕の見た目(index.html の [data-rhythm-song-intro] の節)が残っている
//    2026-10-11: 新曲の公開のマージ(#2652)でこの節が丸ごと消え、本番の幕が暗幕も動きもないまま
//    演奏画面の上に文字だけ出ていた。画面は動くので誰も気づけない。ここで見張る。
// ② 並び: ジャケットが上、その下に曲名・難易度(2026-10-11 社長「ジャケットを上に、その下に曲名」)。
//    縦 390×844・360×640、横 844×390・640×360 で、画面からはみ出さず、重ならない
// ③ 長さ: 最短(RHYTHM_SONG_INTRO_MS)より早く閉じない。閉じてからカウントダウンが始まる
// ④ 準備の待ち(rhythmSongIntroHold): 渡した Promise が済むまで閉じない。タップで飛ばしても、済むまでは閉じない。
//    最長(RHYTHM_SONG_INTRO_MAX_MS)に達したら、済んでいなくても閉じる
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9047;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ① 見た目の節(ブラウザなしで見る)
const html=fs.readFileSync(path.join(ROOT,'monster-hero','index.html'),'utf8');
ok('index.html に幕の暗幕の指定がある',/\[data-rhythm-song-intro\]\{[^}]*background:/.test(html));
ok('index.html に閉じるときの消え方がある',/\[data-rhythm-song-intro\]\[data-intro-closing="1"\]/.test(html));
ok('index.html にジャケットの出る動きがある',/\[data-rhythm-song-intro-art\]\{[^}]*animation:/.test(html));

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(failed?1:0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    // 曲えらびまで進めて「決定」を押す。押した時刻を返す
    const openPlay=async(vp)=>{
      const page=await browser.newPage({viewport:vp});
      await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);
        // 幕が出た時刻・閉じた時刻(幕が消えてカウントダウンが出た時刻)を、ページの中で毎フレーム記録する(2026-10-21)。
        //   前は「幕が出てから 900ms 待った」と決めつけて足していたので、読み込みが重いと実際に待った時間より短く見えて NG になった
        window.__mhIntro={clicked:null,shown:null,closed:null};
        const watch=()=>{const m=window.__mhIntro,now=performance.now(),intro=document.querySelector('[data-rhythm-song-intro]');
          if(intro&&m.shown==null)m.shown=now;
          if(m.shown!=null&&m.closed==null&&!intro&&document.querySelector('[data-rhythm-countdown-step]'))m.closed=now;
          requestAnimationFrame(watch);};
        requestAnimationFrame(watch);});
      const clickText=async(pat)=>page.evaluate((s)=>{const rx=new RegExp(s);
        const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));
        if(!b)return false;if(window.__mhIntro&&/^\^\(決定/.test(s))window.__mhIntro.clicked=performance.now();b.click();return true;},pat);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
      for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|確認)$')))break;await page.waitForTimeout(250);}
      await clickText('モンヒロビート');
      await page.waitForSelector('[data-rhythm-mode-solo]',{timeout:30000}).catch(()=>{});
      await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
      await page.waitForTimeout(1500);
      await clickText('^(決定|はじめる|プレイ|▶)$');
      await page.waitForSelector('[data-rhythm-song-intro]',{timeout:20000});
      return page;
    };
    // 幕が消えてカウントダウンが出るまでの時間(幕が出た時点から)
    const untilCountdown=async(page)=>page.evaluate(()=>new Promise(res=>{const t0=performance.now();
      const tick=()=>{if(document.querySelector('[data-rhythm-countdown-step]')&&!document.querySelector('[data-rhythm-song-intro]'))res(performance.now()-t0);
        else if(performance.now()-t0>15000)res(-1);else requestAnimationFrame(tick);};tick();}));
    const consts=async(page)=>page.evaluate(()=>({min:RHYTHM_SONG_INTRO_MS,max:RHYTHM_SONG_INTRO_MAX_MS,close:RHYTHM_SONG_INTRO_CLOSE_MS}));

    // ②③ 並びと長さ
    for(const [name,vp] of [['縦390×844',{width:390,height:844}],['縦360×640',{width:360,height:640}],['横844×390',{width:844,height:390}],['横640×360',{width:640,height:360}]]){
      const page=await openPlay(vp);
      await page.waitForTimeout(900);
      const box=await page.evaluate(()=>{const q=s=>{const el=document.querySelector(s);if(!el)return null;const r=el.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom};};
        const intro=document.querySelector('[data-rhythm-song-intro]');
        return {art:q('[data-rhythm-song-intro-art]'),title:q('[data-rhythm-song-intro-title]'),diff:q('[data-rhythm-song-intro-difficulty]'),
          bg:intro?getComputedStyle(intro).backgroundImage:'',vw:innerWidth,vh:innerHeight};});
      ok(`${name}: 暗幕が敷かれている`,/gradient/.test(box.bg),box.bg.slice(0,40));
      ok(`${name}: ジャケットと曲名と難易度が出る`,!!(box.art&&box.title&&box.diff));
      if(box.art&&box.title&&box.diff){
        ok(`${name}: ジャケットが曲名より上`,box.art.b<=box.title.t,`絵の下${box.art.b.toFixed(0)} / 曲名の上${box.title.t.toFixed(0)}`);
        const inside=[box.art,box.title,box.diff].every(r=>r.l>=0&&r.t>=0&&r.r<=box.vw+0.5&&r.b<=box.vh+0.5);
        ok(`${name}: 画面からはみ出さない`,inside);
      }
      if(name==='縦390×844'){
        const c=await consts(page);
        // ページの中で記録した時刻で測る。最短は「幕が見えてから」数える(2026-10-21 社長「幕が見えてから3秒」)ので、
        //   幕が出てから閉じるまでが最短以上(丸めの1フレームぶんは許す)。読み込みが重いと幕が出るのが遅れる(2026-10-21 に押してから 678ms)
        await page.waitForFunction(()=>window.__mhIntro&&window.__mhIntro.closed!=null,{timeout:15000}).catch(()=>{});
        const t=await page.evaluate(()=>window.__mhIntro);
        const fromClick=t.clicked!=null&&t.closed!=null?t.closed-t.clicked:-1,fromShown=t.shown!=null&&t.closed!=null?t.closed-t.shown:-1;
        ok('最短より早く閉じない(幕が見えてから数える)',fromShown>=c.min-17&&fromClick>=fromShown,`押してから ${fromClick.toFixed(0)}ms・幕が出てから ${fromShown.toFixed(0)}ms(最短${c.min}ms)`);
        const ms=fromShown;
        ok('閉じたあとカウントダウンが始まる',ms>0);
      }
      await page.close();
    }

    // ④ 準備の待ち
    {
      const page=await openPlay({width:844,height:390});
      const c=await consts(page);
      const accepted=await page.evaluate(()=>rhythmSongIntroHold(new Promise(r=>setTimeout(r,4200))));
      ok('幕のあいだは準備を受け付ける',accepted===true);
      const ms=await untilCountdown(page);
      ok('準備が済むまで閉じない(最短より長く待つ)',ms>=4200-150,`${ms.toFixed(0)}ms`);
      ok('準備が済んだら閉じる(最長まで待たない)',ms>0&&ms<c.max,`${ms.toFixed(0)}ms`);
      const late=await page.evaluate(()=>rhythmSongIntroHold(new Promise(()=>{})));
      ok('幕が閉じたあとは受け付けない',late===false);
      await page.close();
    }
    {
      const page=await openPlay({width:844,height:390});
      await page.evaluate(()=>rhythmSongIntroHold(new Promise(r=>setTimeout(r,3600))));
      await page.locator('[data-rhythm-song-intro]').dispatchEvent('pointerdown');
      await page.waitForTimeout(300);
      const waiting=await page.evaluate(()=>!!document.querySelector('[data-rhythm-song-intro-wait]'));
      ok('飛ばしても準備がまだなら幕を閉じず「まもなく はじまります」で待つ',waiting);
      const ms=await untilCountdown(page);
      ok('飛ばしたあと準備が済んだら閉じる',ms>=3600-300-150&&ms<5500,`${ms.toFixed(0)}ms`);
      await page.close();
    }
    {
      const page=await openPlay({width:844,height:390});
      const c=await consts(page);
      await page.evaluate(()=>rhythmSongIntroHold(new Promise(()=>{})));
      const ms=await untilCountdown(page);
      ok('準備が済まなくても最長で閉じる',ms>0&&ms<=c.max+c.close+400,`${ms.toFixed(0)}ms(最長${c.max}ms)`);
      await page.close();
    }
    {
      const page=await openPlay({width:844,height:390});
      await page.evaluate(()=>rhythmSongIntroHold(Promise.reject(new Error('準備の失敗'))));
      const ms=await untilCountdown(page);
      ok('準備が失敗しても閉じる',ms>0);
      await page.close();
    }
  }catch(e){console.log('NG: 実行できませんでした —',e.message);failed++;}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件 NG`:'\nすべてOK');
  process.exit(failed?1:0);
})();
