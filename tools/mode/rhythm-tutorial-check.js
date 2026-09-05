#!/usr/bin/env node
// モンビーの初回チュートリアルと「あそびかた練習」を、本物のブラウザで動かして確かめる。
//
//   node tools/mode/rhythm-tutorial-check.js
//
// 【なぜ要るか】
// 実機の指摘(2026-09-05)「初回チュートリアルモードを作ったのに実装されてなかったからいれて」。
// 曲えらびを初めて開いたときの案内は、コードの上では書かれているのに出ていないと言われた。
// 出る・出ないは「保存値・画面遷移・重なる案内」の組み合わせで決まるので、
// ソースを文字で見ても分からない。実際に起動して、HOMEからモンビーへ入って確かめる。
//
// あわせて「実際の音ゲー画面でやり方や各ノーツの操作方法などまで作って」への対応
// (あそびかた練習)も、案内を最後まで読んだら始まるところまで通して見る。
const http=require('http');
const path=require('path');
const fs=require('fs');

const ROOT=path.resolve(__dirname,'..','..');
const PORT=8983;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
    const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT,()=>resolve(server));
});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**cdn.tailwindcss.com**',route=>route.abort());
    // モンビーの案内**だけ**をまだ見ていない状態にする。
    // ほかの重なる案内(初回の助手えらび・村の案内など)は先に済ませておかないと、
    // HOMEのボタンへ届かず、そもそもモンビーへ入れない
    await page.addInitScript(()=>{
      const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テストブリーダー');
      put('mh_breeder_icon','🐣');
      put('mh_intro_done',true);
      put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);
      put('mh_battle_tutorial_seen_v1',true);
      put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');
      put('mh_assistant_unlock_seen_v1',true);
      put('mh_update_notice_seen_v1',true);
      // ここが本題。モンビーの案内はまだ見ていない
      localStorage.removeItem('mh_rhythm_tutorial_seen_v1');
    });
    const bodyText=()=>page.evaluate(()=>document.body?document.body.innerText.replace(/\s+/g,' '):'');
    const clickText=async(pattern,nth=0)=>page.evaluate(([src,index])=>{
      const rx=new RegExp(src);
      const list=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!list[index])return false;
      list[index].click();return true;
    },[pattern,nth]);

    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>!!document.body&&document.body.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    // ログインボーナスなどが重なっていたら閉じる
    for(let i=0;i<6;i++){
      if(!(await clickText('受け取る|閉じる|OK|とじる')))break;
      await page.waitForTimeout(300);
    }
    ok('HOMEにモンヒロビートの入口がある',(await bodyText()).includes('モンヒロビート'));

    // --- 本題① 曲えらびを初めて開いたら案内が出るか ---
    await clickText('モンヒロビート');
    await page.waitForTimeout(2500);
    const afterEnter=await bodyText();
    ok('モンビーの曲えらびへ入れる',afterEnter.includes('楽曲選択')||afterEnter.includes('モンビーへようこそ'));
    const tutorialShown=await page.evaluate(()=>!!document.querySelector('[aria-label="はじめての案内"]'));
    ok('初めて開いたら助手の案内が出る',tutorialShown,
      tutorialShown?'':'出ていない（保存値・重なる案内・画面遷移のどれかで止まっている）');

    if(tutorialShown){
      const total=await page.evaluate(()=>{
        const el=document.querySelector('[aria-label="はじめての案内"]');
        const m=(el?.innerText||'').match(/(\d+)\s*\/\s*(\d+)/);
        return m?Number(m[2]):0;
      });
      ok('案内が複数ページある',total>=5,`${total}ページ`);
      // --- 本題② 最後まで読むと「あそびかた練習」が始まるか ---
      for(let i=0;i<total+2;i++){
        const moved=await clickText('^つぎへ$')||await clickText('^はじめる！$');
        if(!moved)break;
        await page.waitForTimeout(220);
      }
      await page.waitForTimeout(2500);
      const practice=await page.evaluate(()=>({
        banner:!!document.querySelector('[data-rhythm-tutorial-banner]'),
        play:!!document.querySelector('[data-rhythm-play-area]'),
        label:(document.querySelector('[data-rhythm-mode-label]')||{}).textContent||'',
        labels:[...document.querySelectorAll('[data-rhythm-mode-label]')].map(el=>el.textContent),
        song:(document.querySelector('[data-rhythm-hud-song]')||{}).textContent||'',
      }));
      ok('案内を最後まで読むと演奏画面の練習が始まる',practice.play&&practice.banner,
        `プレイ画面=${practice.play} / 説明=${practice.banner}`);
      ok('練習中だと画面で分かる',practice.label.includes('れんしゅう'),JSON.stringify(practice.labels)+' / 曲='+practice.song);
      const banner=await page.evaluate(()=>{
        const el=document.querySelector('[data-rhythm-tutorial-banner]');
        return el?el.innerText.replace(/\s+/g,' '):'';
      });
      ok('最初の説明が「タップ」から始まる',banner.includes('タップ'),banner.slice(0,60));
    }

    ok('実行時エラーが出ていない',errors.length===0,errors.slice(0,2).join(' / '));
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
