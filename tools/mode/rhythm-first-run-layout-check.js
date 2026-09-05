#!/usr/bin/env node
// 「初回起動でノーツが出ないまま MISS だけが積み上がる」の再発を防ぐ。
//
//   node tools/mode/rhythm-first-run-layout-check.js
//
// 【何が起きていたか】(2026-09-05・実機の指摘「初回起動時はよくこの状態になる」)
// 演奏画面のノーツは、プレイエリアの大きさを測って置き場所を決めている。
// その測定を「高さが0でなければ正しい」とみなして覚え込んでいたため、
// まだ組み上がっていない最中の値(絵の読み込み前・スタイルが効く前・画面の回転中)を
// そのまま固定してしまい、ノーツが画面の外に置かれたまま戻らなくなっていた。
// 曲だけは進むので MISS が次々に確定し、ライフだけが減っていく。
// リスタートで直っていたのは、そのとき覚えた値を捨てていたからにすぎない。
//
// 【この検査のやり方】
// スタイルが効かない状態のまま演奏を始めさせ、途中でスタイルを流し込む。
// 実機で言えば「画面が組み上がるのが遅れている」状態そのもの。
//   ① 組み上がる前のあいだ、ライフが減らないこと(見えないノーツで減点しない)
//   ② 組み上がったあとは、ノーツがちゃんと画面に出て遊べること
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=8996;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

// 演奏画面が「組み上がった」状態にするための最低限のスタイル。
// このサンドボックスは外部CDNのCSSを取りに行けないので、遅れて効くぶんをここで足す
const LAYOUT_CSS=`
html,body{height:100%;margin:0}
#root>div,#root>div>div{height:100%}
[data-rhythm-tap-test]{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden;height:100%}
[data-rhythm-hud]{position:absolute;left:0;right:0;top:0;z-index:30;display:flex;pointer-events:none}
[data-rhythm-play-area]{position:relative;flex:1 1 0%;min-height:0;overflow:hidden;margin:0 8px 8px}
[data-rhythm-note]{position:absolute;top:0;height:20px}
[data-rhythm-judgment-line]{position:absolute;bottom:12%;left:0;right:0;height:3px}
[data-rhythm-lane]{position:absolute;inset:0}
[data-rhythm-side-monster]{position:absolute}
`;

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.route('**cdn.tailwindcss.com**',r=>r.abort());
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);});
    const clickText=async(pat,nth=0)=>page.evaluate(([s,i])=>{const rx=new RegExp(s);
      const l=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!l[i])return false;l[i].click();return true;},[pat,nth]);

    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForTimeout(1500);
    await clickText('決定|はじめる|プレイ|▶');
    await page.waitForTimeout(1000);

    const snap=()=>page.evaluate(()=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      const notes=[...document.querySelectorAll('[data-rhythm-note]')];
      const onScreen=notes.filter(n=>{const s=getComputedStyle(n);
        if(s.display==='none'||s.opacity==='0')return false;
        const r=n.getBoundingClientRect();return r.height>0&&r.bottom>0&&r.top<window.innerHeight;});
      return {area:area?Math.round(area.getBoundingClientRect().height):null,notes:notes.length,onScreen:onScreen.length,
        life:Number((document.querySelector('[data-rhythm-life-value]')||{}).textContent||0)};
    });

    const entered=await snap();
    ok('演奏画面へ入れている',entered.notes>0,`ノーツ${entered.notes}個 / エリア高さ${entered.area}px`);
    ok('組み上がる前は画面が実際に崩れている',entered.area>844,
      `エリア高さ${entered.area}px（画面は844px。この状態を作れていないと検査にならない）`);

    // 組み上がらないまま4秒すごす
    await page.waitForTimeout(4000);
    const before=await snap();
    ok('見えていないあいだはライフが減らない',before.life>=1000,
      `ライフ${before.life}（見えないノーツをMISSにして削っていないか）`);

    // ここで組み上がる
    await page.addStyleTag({content:LAYOUT_CSS});
    await page.waitForTimeout(1500);
    const after=await snap();
    ok('組み上がったら大きさを測り直している',after.area!==null&&after.area<=844,
      `エリア高さ${after.area}px（覚えたままの古い値で固まっていないか）`);
    ok('組み上がったらノーツが画面に出る',after.onScreen>0,`画面のノーツ${after.onScreen}個`);
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
