#!/usr/bin/env node
// 演奏を始めるところで2つを確かめる。
//
//   node tools/mode/rhythm-start-sequence-check.js
//
// ① 判定ラインが外部CSS(Tailwind)なしでも見える
//    実機で「演奏を始めたときに下部の判定ラインがないときがある」と報告された
//    (2026-09-05)。位置(bottom-[12%])・厚み(h-[3px])・色(bg-gradient-to-r)を
//    すべてTailwindのクラスで書いていたのが原因。TailwindはCDNのJITが
//    後からCSSを作るため、間に合わないあいだは「高さ0・背景なしの線」になる。
//    このサンドボックスはそもそもCDNへ出られないので、
//    ここは「Tailwindが最後まで来なかったいちばん悪い場合」そのものになる。
//    判定ラインは音ゲーでいちばん大事な目印なので、外部CSSに依存させない。
//
// ② 曲がいきなり鳴らず、カウントダウンを挟む
//    「入ってすぐ音楽なるのも良くない？ 3秒から5秒ぐらいしてから演奏がいい」
//    (2026-09-05・ユーザー指摘)。READY→3→2→1 を出してから鳴らす。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9013;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
// ページの骨格だけを与えるCSS。
// わざと書かないもの:
//   ・[data-rhythm-judgment-line] の位置・厚み・色
//   ・[data-rhythm-play-area] の position
// この2つは「Tailwindが無くても効いていること」を確かめたい当のものなので、
// ここで足してしまうと検査にならない。実装側のインラインstyleだけで決まるはず
const SKELETON_CSS=`
html,body{height:100%;margin:0}
#root>div,#root>div>div{height:100%}
[data-rhythm-tap-test]{position:relative;display:flex;flex:1 1 0%;min-height:0;flex-direction:column;overflow:hidden;height:100%}
[data-rhythm-hud]{position:absolute;left:0;right:0;top:0;z-index:30;display:flex;pointer-events:none}
[data-rhythm-play-area]{flex:1 1 0%;min-height:0;margin:0 8px 8px}
[data-rhythm-note]{position:absolute;top:0;height:20px}
[data-rhythm-lane]{position:absolute;inset:0}
[data-rhythm-side-monster]{position:absolute}
`;
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

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
    for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|とじる|確認)$')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForTimeout(1500);
    const started=await clickText('^(決定|はじめる|プレイ|▶)$');
    if(!started){
      const btns=await page.evaluate(()=>[...document.querySelectorAll('button')].map(b=>(b.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,20));
      console.log('  [debug] 曲えらびのボタン:',btns.join(' / '));
    }

    // --- ② カウントダウン ---
    // 曲えらびを押した直後から見張る。カウントダウンが出ているあいだは曲が鳴っていないこと
    const seen=new Set();
    let sawCountdownBeforeNotes=null;
    for(let i=0;i<70;i++){
      const st=await page.evaluate(()=>{
        const c=document.querySelector('[data-rhythm-countdown-step]');
        const moving=[...document.querySelectorAll('[data-rhythm-note]')].some(n=>{
          const t=getComputedStyle(n).transform;return t&&t!=='none'&&!/matrix\(1, 0, 0, 1, 0, 0\)/.test(t);});
        return {step:c?(c.textContent||'').trim():null,moving};
      });
      if(st.step){seen.add(st.step);if(sawCountdownBeforeNotes===null)sawCountdownBeforeNotes=!st.moving;}
      if(!st.step&&seen.size>0)break;
      await page.waitForTimeout(120);
    }
    ok('演奏の前にカウントダウンが出る',seen.size>0,[...seen].join('→')||'出なかった');
    ok('READYと数字がそろって出る',seen.has('READY')&&seen.has('3')&&seen.has('2')&&seen.has('1'),
      [...seen].join('→'));
    ok('カウントダウン中はノーツが動いていない',sawCountdownBeforeNotes!==false,
      sawCountdownBeforeNotes===false?'数えているのにノーツが流れている':'流れていない');

    // --- ① 判定ライン ---
    // ページの骨格だけ与える。判定ラインとプレイエリアの position は与えないので、
    // ここから先で測る位置は実装側のインラインstyleだけで決まる
    await page.addStyleTag({content:SKELETON_CSS});
    await page.waitForTimeout(800);
    const line=await page.evaluate(()=>{
      const el=document.querySelector('[data-rhythm-judgment-line]');
      const area=document.querySelector('[data-rhythm-play-area]');
      if(!el||!area)return null;
      const r=el.getBoundingClientRect(),a=area.getBoundingClientRect(),cs=getComputedStyle(el);
      return {h:r.height,w:r.width,top:r.top,areaTop:a.top,areaH:a.height,
        bg:cs.backgroundImage!=='none'||cs.backgroundColor!=='rgba(0, 0, 0, 0)',
        visible:cs.display!=='none'&&cs.visibility!=='hidden'&&Number(cs.opacity)>0};
    });
    if(!line){
      const dbg=await page.evaluate(()=>({
        text:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,300),
        btns:[...document.querySelectorAll('button')].map(b=>(b.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean).slice(0,20),
        area:!!document.querySelector('[data-rhythm-play-area]')}));
      console.log('  [debug] エリア有無:',dbg.area,'\n  [debug] 画面:',dbg.text,'\n  [debug] ボタン:',dbg.btns.join(' / '));
    }
    ok('判定ラインが見つかる',!!line);
    if(line){
      ok('Tailwindが無くても厚みがある',line.h>=1,`高さ${line.h.toFixed(1)}px`);
      ok('Tailwindが無くても幅がある',line.w>0,`幅${line.w.toFixed(0)}px`);
      ok('Tailwindが無くても色が付いている',line.bg,line.bg?'':'背景が透明');
      ok('Tailwindが無くても隠れていない',line.visible);
      // 下から12%の位置。プレイエリアの下半分にあれば「置き場所が決まっている」
      const rel=line.areaH>0?(line.top-line.areaTop)/line.areaH:0;
      ok('プレイエリアの下のほうに置かれている',rel>0.5,`エリアの上から${(rel*100).toFixed(0)}%`);
    }
    // --- ③ 数えている途中でやり直しても、また数え直して遊べる ---
    // カウントダウン中にリスタートすると、待っている処理が解決されないまま残り、
    // そのプレイが始まらなくなることがあった(2026-09-05)
    await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-pause]');b&&b.click();});
    await page.waitForTimeout(400);
    const restarted=await page.evaluate(()=>{
      const b=[...document.querySelectorAll('button')].find(x=>x.hasAttribute('data-rhythm-pause-restart'));
      if(!b)return false;b.click();return true;});
    ok('ポーズからリスタートできる',restarted);
    if(restarted){
      let sawAgain=false,played=false;
      for(let i=0;i<80;i++){
        const st=await page.evaluate(()=>({
          step:(document.querySelector('[data-rhythm-countdown-step]')||{}).textContent||null,
          notes:document.querySelectorAll('[data-rhythm-note]').length}));
        if(st.step)sawAgain=true;
        if(sawAgain&&!st.step&&st.notes>0){played=true;break;}
        await page.waitForTimeout(120);
      }
      ok('やり直すとカウントダウンも数え直す',sawAgain);
      ok('数え直したあとちゃんと演奏が始まる',played,played?'':'カウントダウンのあと止まったまま');
    }
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
