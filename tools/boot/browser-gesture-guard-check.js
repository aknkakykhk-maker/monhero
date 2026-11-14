#!/usr/bin/env node
// ブラウザらしい動き(左端スワイプの「戻る」・長押しの吹き出し・文字の選択・箱の中の連続タップ拡大)を、ゲームの中で出さない仕組みの見張り(2026-11-11)。
//
//   node tools/boot/browser-gesture-guard-check.js
//
// 社長「ブラウザだからかたまに画面の挙動がおかしい。左でスワイプで戻るみたいのとかズームみたいのとか。ホームに追加しても、それでもブラウザのような挙動がある気がする」。
// 原因: HOME 以外の画面で「戻る」の目印の履歴を1つ足していた(スマホの戻るでゲームの外へ出ないため)。
// iPhone は履歴があると、ホーム画面のアプリでも左端からのスワイプで戻れてしまい、前の画面の写しが横から出てくる。
//   ① iPhone のホーム画面のアプリ(navigator.standalone)では履歴を足さない
//   ② Safari・Chrome で遊ぶとき・Android のホーム画面では、今までどおり履歴を足し、戻るで画面の戻るボタンが押される
//   ③ 長押しの吹き出し・文字の選択を止める。入力欄は選べるまま
//   ④ 箱の中の要素にも touch-action(拡大なし)が付く。touch-action:none の所はそのまま・スクロールは止めない
//   ⑤ 指の長押しのメニュー(contextmenu)を止める。パソコンの右クリックと入力欄はそのまま
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'../..'),PORT=8971;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/10-core.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
// 書き方の見張り(実物で確かめる前に、要の行が消えていないか)
const back=(app.match(/useEffect\(\(\) => \{\n\s*if \(typeof window === 'undefined'\) return;\n\s*if \(mhIsIosHomeScreenApp\(\)\) return;\n\s*let armed = false;[\s\S]*?pushState\(\{ mhBack:1 \}/)||[''])[0];
ok('戻るの履歴は、iPhone のホーム画面のアプリでは足さない(60-app.jsx)',!!back);
ok('ホーム画面のアプリかどうかは navigator.standalone で見る(Android のホーム画面は対象外)',/function mhIsIosHomeScreenApp\(\)\{[\s\S]{0,160}navigator\.standalone===true/.test(core));
ok('index.html が箱の中の要素にも拡大なしの touch-action を付ける(強さ0)',html.includes(':where(body *) { touch-action: pan-x pan-y; }'));
ok('index.html が長押しの吹き出しと文字の選択を止める',/:where\(body\) \{ -webkit-user-select:none; user-select:none; -webkit-touch-callout:none; \}/.test(html));
ok('index.html は入力欄の選択を残す',/:where\(input, textarea, [^\n]*\.select-text \*\) \{ -webkit-user-select:text; user-select:text;/.test(html));
ok('指の長押しのメニューを止める(10-core.jsx)',/const MH_TOUCH_MENU_GUARD=/.test(core)&&/addEventListener\('contextmenu'/.test(core));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.woff2':'font/woff2'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
  const f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});
const seed=()=>{ if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s','1'); const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','テスト'); put('mh_breeder_icon','🐣'); put('mh_intro_done',true); put('mh_onboarded',true); put('mh_tutorial_seen_v1',true);
  put('mh_battle_tutorial_seen_v1',true); put('mh_battle_tutorial_guide_shown_v1',true); put('mh_assistant_selected_v1','mua'); put('mh_assistant_unlock_seen_v1',true);
  put('mh_update_notice_seen_v1',true); put('mh_rhythm_tutorial_seen_v1',true); put('mh_inherited_unique_level_compensation_v1',true); put('mh_masu_level_cap_compensation_notice_seen_v1',true); };
(async()=>{
  let chromium;
  try{({chromium}=require('playwright'));}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(failed===0?0:1);}
  const server=await serve();
  let browser;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    // HOME まで進め、HOME から別の画面(上に戻るボタンのある画面)を1つ開く
    const openGame=async({standalone})=>{
      const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
      const page=await ctx.newPage();
      await page.addInitScript(()=>{window.__mhSupabaseStubbed=true;});
      await page.route(/supabase|functions\/v1/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));   // 本番へ書かない
      await page.addInitScript(seed);
      if(standalone)await page.addInitScript(()=>{Object.defineProperty(Navigator.prototype,'standalone',{configurable:true,get:()=>true});});
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.querySelector('.mh-home-assistant'),{timeout:40000});
      for(let i=0;i<14;i++){
        const did=await page.evaluate(()=>{const inO=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const st=getComputedStyle(e);if(st.position==='fixed'||(st.position==='absolute'&&Number(st.zIndex)>=40))return true;}return false;};
          const l=[...document.querySelectorAll('button')].filter(b=>inO(b)&&/^(確認|閉じる|OK|受け取る|次へ|(?:分|わ)かった|はい|スキップ|あとで読む)$/.test((b.innerText||'').replace(/\s+/g,' ').trim()));
          if(!l.length)return false;l[0].click();return true;});
        if(!did)break;await page.waitForTimeout(300);
      }
      const len0=await page.evaluate(()=>history.length);
      const opened=await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/ミッション/.test(x.innerText||''));if(!b)return false;b.click();return true;});
      if(opened)await page.waitForSelector('header.mh-screen-head > button[aria-label]',{timeout:15000}).catch(()=>{});
      await page.waitForTimeout(1300);   // 目印は500msごとに足す
      const len1=await page.evaluate(()=>history.length);
      const head=await page.evaluate(()=>!!document.querySelector('header.mh-screen-head > button[aria-label]'));
      return {ctx,page,len0,len1,head};
    };
    // ① iPhone のホーム画面のアプリ
    {
      const {ctx,page,len0,len1,head}=await openGame({standalone:true});
      ok('  (HOME から別の画面を開ける)',head);
      ok('① iPhone のホーム画面のアプリでは、別の画面でも履歴が増えない(左端スワイプの戻るが出ない)',len1===len0,`履歴 ${len0} → ${len1}`);
      await ctx.close();
    }
    // ② Safari・Chrome で遊ぶとき(Android のホーム画面も同じ道)
    {
      const {ctx,page,len0,len1,head}=await openGame({standalone:false});
      ok('② ブラウザでは、今までどおり別の画面で履歴を1つ足す(戻るでゲームの外へ出ない)',head&&len1===len0+1,`履歴 ${len0} → ${len1}`);
      await page.goBack().catch(()=>{});
      await page.waitForTimeout(900);
      const r=await page.evaluate(()=>({home:!!document.querySelector('.mh-home-assistant'),url:location.pathname}));
      ok('② ブラウザの戻るで、ゲームの HOME へ戻る(外へ出ない)',r.home&&/monster-hero\/index\.html$/.test(r.url),JSON.stringify(r));
      // ③ 長押しの吹き出し・文字の選択
      const st=await page.evaluate(()=>{
        const pick=el=>{const c=getComputedStyle(el);return {us:c.userSelect||c.webkitUserSelect,co:c.webkitTouchCallout||'(なし)',ta:c.touchAction};};
        const txt=[...document.querySelectorAll('#root span,#root p,#root div')].find(e=>e.childElementCount===0&&(e.textContent||'').trim().length>2);
        const sc=document.createElement('div');sc.style.cssText='overflow-y:auto;height:50px';sc.innerHTML='<div style="height:300px"><span>a</span></div>';document.getElementById('root').appendChild(sc);
        const box={...pick(sc.querySelector('span')),scroll:pick(sc).ta};sc.remove();
        const inp=document.createElement('input');document.getElementById('root').appendChild(inp);const ip=pick(inp);inp.remove();
        const none=document.createElement('div');none.style.touchAction='none';document.getElementById('root').appendChild(none);const nt=getComputedStyle(none).touchAction;none.remove();
        const sel=document.createElement('div');sel.className='select-text';sel.innerHTML='<span>a</span>';document.body.appendChild(sel);const sp=pick(sel.firstChild);sel.remove();
        return {txt:txt?pick(txt):null,box,inp:ip,none:nt,sel:sp,body:pick(document.body)};
      });
      ok('③ 画面の文字は選べない(長押し・連続タップで選択が出ない)',!!st.txt&&st.txt.us==='none',JSON.stringify(st.txt));
      ok('③ 入力欄は今までどおり選べる',st.inp.us!=='none',JSON.stringify(st.inp));
      ok('③ select-text を付けた所は選べる',st.sel.us!=='none',JSON.stringify(st.sel));
      ok('④ スクロールする箱の中にも拡大なしの touch-action が付く(連続タップの拡大が出ない)',!!st.box&&st.box.ta==='pan-x pan-y'&&st.box.scroll==='pan-x pan-y',JSON.stringify(st.box));
      ok('④ touch-action:none の所はそのまま',st.none==='none',st.none);
      // ⑤ 長押しのメニュー
      const cm=await page.evaluate(()=>{
        const fire=(el,pointerType)=>{const E=window.PointerEvent||MouseEvent;el.dispatchEvent(new E('pointerdown',{bubbles:true,pointerType}));const e=new E('contextmenu',{bubbles:true,cancelable:true,pointerType});el.dispatchEvent(e);return e.defaultPrevented;};
        const root=document.getElementById('root');const inp=document.createElement('input');root.appendChild(inp);
        const r={touch:fire(root,'touch'),mouse:fire(root,'mouse'),input:fire(inp,'touch')};inp.remove();return r;
      });
      ok('⑤ 指の長押しのメニューは出さない',cm.touch===true);
      ok('⑤ パソコンの右クリックはそのまま',cm.mouse===false);
      ok('⑤ 入力欄の長押しはそのまま(貼り付けなど)',cm.input===false);
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
