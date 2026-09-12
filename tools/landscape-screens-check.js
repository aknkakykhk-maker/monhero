#!/usr/bin/env node
// 横画面(スマホを横に持ったとき)で本編の画面が使える形になっているかを、実ブラウザで測る。
//
//   node tools/landscape-screens-check.js
//
// 【何を見るか】(2026-09-05・#146 モンヒロ全体の横画面対応)
// 本体は #root > div を max-width:600px の縦長コラムにしている。横画面(844×390など)では
//   ・左右に黒帯が出る(600pxしか使わない)
//   ・高さ390pxに「見出し・助手・タブ」を縦に積むので、一覧が90px前後しか残らない
//   ・神殿は一覧がスクロールできず「限界突破」以降に届かない
// という状態だった。index.html の横画面用CSSで、①コラムを画面いっぱいに広げ、
// ②画面の根(data-mh-screen)の直下に一覧(.mh-scroll)がある画面を「左＝見出し・助手・タブ /
// 右＝一覧(全高)」の2カラムにしている。ここではそれが実際に効いているかを測る。
//   ① 横画面ではコラムが画面幅いっぱいになる
//   ② 一覧を持つ画面では、一覧が右カラムにあり、画面の高さの8割以上ある
//   ③ 神殿の6つのボタンがすべて届く(スクロールで最後まで見える)
//   ④ 横にはみ出さない
//   ⑤ 縦画面では何も変わらない(コラムは画面幅、一覧は左端から＝縦積みのまま)
//
// Tailwind は 2026-09-12 に静的CSS(monster-hero/tailwind.css)へ切り替えたので、
// ここで配っている index.html がそのまま本物のCSSを読む。差し込む細工は要らなくなった。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..'),PORT=8957;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});
// 一覧を持つ画面と、その画面へ入るHOMEのボタン
const LIST_SCREENS=['M/B管理','神殿','マーケット','ミッション','ギフト'];
// 神殿のボタンの数は実装から数える。ここを直に書くと、ボタンを足したときに
// 「届かない」ではなく「数が違う」で落ち、何が壊れたのか分からなくなる(魂格進化を足して実際に落ちた)
const TEMPLE_LINKS=(fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8').match(/mh-temple-link/g)||[]).length;

(async()=>{
  let chromium;
  try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const open=async(width,height)=>{
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);});
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    // Tailwind が本当に効いているかを最初に見る。効いていないと flex も w-full も無く、
    // 「はみ出していない」「一覧が8割ある」の測定がまるごと意味を失う(それでも数字は出てしまう)
    const twOn=await page.evaluate(()=>{const d=document.createElement('div');d.className='flex';document.body.appendChild(d);
      const on=getComputedStyle(d).display==='flex';d.remove();return on;});
    ok('Tailwind のCSSが効いている(測った数字に意味がある)',twOn);
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    await dismiss(page);
    return page;
  };
  // 画面を覆っているもの(fixed / z-index の高い overlay)の中のボタンだけを押して閉じる
  const dismiss=async page=>{for(let i=0;i<14;i++){
    const did=await page.evaluate(()=>{const inOverlay=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){const s=getComputedStyle(e);if(s.position==='fixed'||(s.position==='absolute'&&Number(s.zIndex)>=40))return true;}return false;};
      const l=[...document.querySelectorAll('button')].filter(b=>inOverlay(b)&&/^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ)$/.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!l.length)return false;l[0].click();return true;});
    if(!did)return;await page.waitForTimeout(300);}};
  const clickHome=(page,label)=>page.evaluate(l=>{const b=[...document.querySelectorAll('.mh-home-facility,.mh-home-mission,.mh-home-gift,.mh-home-settings')]
    .find(b=>(b.innerText||'').replace(/\s+/g,' ').trim().startsWith(l));if(!b)return false;b.click();return true;},label);
  const backHome=async page=>{for(let i=0;i<4;i++){
    if(await page.evaluate(()=>!!document.querySelector('.mh-home-scene')))return true;
    await page.evaluate(()=>{const col=document.querySelector('#root > div'),cr=col.getBoundingClientRect();
      const b=[...document.querySelectorAll('button')].find(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.x<cr.x+120&&r.y<110&&(b.innerText||'').trim()==='';});if(b)b.click();});
    await page.waitForTimeout(450);}
    return false;};
  const measure=page=>page.evaluate(()=>{
    const col=document.querySelector('#root > div'),cr=col.getBoundingClientRect();
    const root=document.querySelector('[data-mh-screen]');
    const scroller=root?[...root.children].find(e=>e.classList.contains('mh-scroll')):null;
    const first=root?root.children[0]:null;
    const r=e=>{const b=e.getBoundingClientRect();return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)};};
    return {vw:innerWidth,vh:innerHeight,column:{x:Math.round(cr.x),w:Math.round(cr.width)},
      hasRoot:!!root,scroller:scroller?{...r(scroller),scrollHeight:scroller.scrollHeight}:null,first:first?r(first):null,
      hOverflow:document.documentElement.scrollWidth>innerWidth+1};});
  try{
    // ── 横画面 ──
    let page=await open(844,390);
    let m=await measure(page);
    ok('横画面ではコラムが画面幅いっぱいになる',m.column.w===m.vw&&m.column.x===0,`コラム ${m.column.w}px / 画面 ${m.vw}px`);
    for(const name of LIST_SCREENS){
      if(!(await clickHome(page,name))){ok(`${name}: HOMEから入れる`,false,'ボタンが見つからない');continue;}
      await page.waitForTimeout(700);await dismiss(page);
      m=await measure(page);
      ok(`${name}: 画面の根に data-mh-screen があり、直下に一覧(.mh-scroll)がある`,m.hasRoot&&!!m.scroller);
      if(m.scroller){
        ok(`${name}: 一覧が右カラムにある`,m.scroller.x>=m.vw*.4&&m.first.x<m.vw*.4,`一覧 x=${m.scroller.x} / 見出し x=${m.first.x} / 画面 ${m.vw}`);
        ok(`${name}: 一覧が画面の高さの8割以上ある`,m.scroller.h>=m.vh*.8,`一覧 ${m.scroller.h}px / 画面 ${m.vh}px`);
      }
      ok(`${name}: 横にはみ出さない`,!m.hOverflow);
      if(name==='神殿'){
        const reach=await page.evaluate(()=>{const s=[...document.querySelector('[data-mh-screen]').children].find(e=>e.classList.contains('mh-scroll'));
          if(!s)return null;s.scrollTop=s.scrollHeight;const links=[...s.querySelectorAll('.mh-temple-link')];const last=links[links.length-1];
          const b=last.getBoundingClientRect(),sb=s.getBoundingClientRect();return {count:links.length,lastBottom:Math.round(b.bottom),listBottom:Math.round(sb.bottom)};});
        ok(`神殿: ${TEMPLE_LINKS}つのボタンがすべて届く(最後までスクロールできる)`,!!reach&&reach.count===TEMPLE_LINKS&&reach.lastBottom<=reach.listBottom+1,reach?`${reach.count}個 / 最後の下端 ${reach.lastBottom} / 一覧の下端 ${reach.listBottom}`:'一覧なし');
      }
      ok(`${name}: HOMEへ戻れる`,await backHome(page));
    }
    await page.close();
    // ── 縦画面(何も変わらないこと) ──
    page=await open(390,844);
    m=await measure(page);
    ok('縦画面ではコラムが画面幅のまま(600px制限は縦画面に効かない)',m.column.w===m.vw,`コラム ${m.column.w}px / 画面 ${m.vw}px`);
    if(await clickHome(page,'マーケット')){
      await page.waitForTimeout(700);await dismiss(page);
      m=await measure(page);
      ok('縦画面のマーケットは縦積みのまま(一覧が左端から始まる)',!!m.scroller&&m.scroller.x<m.vw*.2&&m.scroller.w>=m.vw*.8,m.scroller?`一覧 x=${m.scroller.x} w=${m.scroller.w}`:'一覧なし');
    }else ok('縦画面: マーケットへ入れる',false);
    await page.close();
  }catch(error){
    ok('確認を最後まで進められる',false,String(error).split('\n')[0]);
  }finally{
    await browser.close();server.close();
  }
  console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
  process.exit(failed===0?0:1);
})();
