// モンヒロビートのソロの曲えらび・横: 右の詳しい欄で、難易度の札(自己ベストの数字の段まで)と「ランダム・決定」の段が重ならないかを実際に開いて測る
// (2026-11-24 r1119-161 社長の写真 docs/progress/beat/yoko-select-overlap-2026-11-24/「横画面まだかぶってるじゃん」)。
//
//   node tools/mode/rhythm-song-detail-landscape-fit-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 見張る崩れ: 横は決定の段を欄の下に貼り付けている(sticky)。版が3つある曲(Stay With Me ~Locked Fate~ short ver.)は曲名が2行・版の札・♡が折れて
//   欄が高くなり、iPhone の下の余白(ホームバーぶん)も足されて欄があふれ、決定の段が難易度の札の下の段(HARD 799,166 など)にかぶさっていた。
//   自己ベストを全部の難易度に入れ(数字の段が出る形)、横 844×390(切り欠きあり/なし)・小さい横 568×320・667×375・🔄横で測る。
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const http=require('http'),fs=require('fs');
let playwright;
try{playwright=require(path.join(ROOT,'tools','node_modules','playwright'));}catch(_){try{playwright=require('playwright');}catch(e){console.log('SKIP: playwright が無いので測れません');process.exit(0);}}
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail&&!ok?` — ${detail}`:''}`);if(!ok)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.PNG':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');const f=path.join(ROOT,rel);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(0,()=>r(s));});
const SONGS=process.env.MH_SONGS?process.env.MH_SONGS.split(','):['stay_with_me_short','stay_with_me','kiki_issen_short','six_eternel_beat'];
(async()=>{const server=await serve();const PORT=server.address().port;
const browser=await playwright.chromium.launch({executablePath:fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const page=await context.newPage();const errs=[];page.on('pageerror',e=>errs.push(e.message));
await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));put('mh_breeder_name','ブリーダー');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_hell_story_seen_v1',true);put('mh_inherited_unique_level_compensation_v1',true);put('mh_masu_level_cap_compensation_notice_seen_v1',true);});
await page.addInitScript(require(ROOT+'/tools/boot/quiet-boot-seed').eventStorySeed());
await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
// 全曲・全難易度に自己ベスト(6〜7桁)を入れる。難易度の札に数字の段が出て、HELL まで開いた形(社長の写真と同じ)
await page.waitForFunction(()=>typeof RHYTHM_SONGS!=='undefined'&&typeof rhythmSongDifficultyDefs==='function',null,{timeout:60000});
await page.evaluate(()=>{const rec={};RHYTHM_SONGS.forEach(s=>{rec[s.songId]={};rhythmSongDifficultyDefs(s).forEach((d,i)=>{rec[s.songId][d.id]={bestScore:799166+i*35000,maxCombo:400,played:true,clear:true};});});
  ['mh_rhythm_best_v1','mh_rhythm_best_v2'].forEach(k=>localStorage.setItem(k,JSON.stringify(rec)));});
await page.reload({waitUntil:'load'});
await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),null,{timeout:60000});
await page.getByText('TAP TO START').click();await page.waitForTimeout(2500);await page.mouse.click(422,195);await page.waitForTimeout(3000);
await page.evaluate(()=>{setInterval(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;const b=d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]')||[...d.querySelectorAll('button')].find(x=>/受け取|閉じる|とじる|OK|(?:始|はじ)める|(?:分|わ)かった|^次へ|あとで|見た/.test(x.innerText));if(b)b.click();},250);});
await page.waitForFunction(()=>document.querySelector('button[data-home-fac="rhythm"]')&&!document.querySelector('[role=dialog]'),null,{timeout:40000});
await page.locator('button[data-home-fac="rhythm"]').click();
await page.locator('[data-rhythm-mode-solo]').click();
await page.waitForSelector('[data-rhythm-song-detail]',{timeout:20000});await page.waitForTimeout(1500);
const setSafe=(v)=>page.evaluate((v)=>{const r=document.documentElement.style;Object.entries(v).forEach(([k,x])=>r.setProperty(`--mh-safe-${k}`,x));},v);
const setNotice=(open)=>page.evaluate((open)=>{try{const v=JSON.parse(localStorage.getItem('mh_rhythm_select_view_v1')||'{}');v.noticeOpen=open;v.noticeTouched=true;localStorage.setItem('mh_rhythm_select_view_v1',JSON.stringify(v));}catch(e){}},open);
// 一覧の行は版の組ごとに1つ(行の名前は組のどれかの版)。名前の頭が同じ行を順に押し、版の札があれば押して、その曲が選ばれたかを確かめる
const pick=async(id)=>page.evaluate(async(id)=>{const vis=s=>[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().width>0)[0];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const now=()=>{const v=vis('[data-rhythm-song-version][aria-pressed="true"]');if(v)return v.getAttribute('data-rhythm-song-version');
    const r=document.querySelector('[data-rhythm-song-row][aria-pressed="true"]');return r&&r.getAttribute('data-rhythm-song-row');};
  const tryVer=async()=>{const v=vis(`[data-rhythm-song-version="${id}"]`);if(v){v.click();await sleep(400);}return now()===id;};
  if(await tryVer())return true;
  const head=id.split('_').slice(0,2).join('_');
  for(const row of [...document.querySelectorAll('[data-rhythm-song-row]')].filter(r=>r.getAttribute('data-rhythm-song-row').startsWith(head))){
    row.scrollIntoView({block:'center'});row.click();await sleep(500);if(await tryVer())return true;}
  return false;},id);
const NO={top:'0px',bottom:'0px',left:'0px',right:'0px'},LAND={top:'0px',bottom:'21px',left:'47px',right:'47px'},PORTR={top:'47px',bottom:'34px',left:'0px',right:'0px'};
const CASES=[[844,390,false,LAND,'横844×390・切り欠き'],[844,390,false,NO,'横844×390'],[932,430,false,LAND,'大きい横932×430'],[667,375,false,NO,'小さい横667×375'],[568,320,false,NO,'小さい横568×320'],
  [390,844,true,PORTR,'🔄横390'],[375,667,true,NO,'🔄横375'],[320,568,true,NO,'🔄横320']];
// iPhone の字(ヒラギノ・SF の太字)は検査の端末の字より幅が広い。社長の写真では曲名が2行・♡が次の行に落ちていた。字の間を広げてまねる形(wide)も測る
const setWide=(on)=>page.evaluate((on)=>{let st=document.getElementById('__wide');if(!st){st=document.createElement('style');st.id='__wide';document.head.appendChild(st);}st.textContent=on?'[data-rhythm-song-detail]{letter-spacing:.09em}':'';},on);
for(const [notice,wide] of [[false,false],[false,true],[true,true]]){
 for(const [w0,h0,rot,safe,lab0] of CASES){
  const w=w0,h=h0,lab=lab0+(wide?'・字が広い':'');
  await setNotice(notice);await setWide(wide);
  await page.setViewportSize({width:w,height:h});await page.evaluate(on=>RHYTHM_VIEW_ROTATION.set(on?90:0),rot);await setSafe(safe);await page.waitForTimeout(rot?1200:700);
  for(const id of SONGS){
    let ok=await pick(id);if(!ok){await page.waitForTimeout(800);ok=await pick(id);}
    if(!ok){check(`${lab}: ${id} を選べる`,false,'一覧に無い');continue;}
    await page.waitForTimeout(500);
    const r=await page.evaluate((rot)=>{const vis=s=>[...document.querySelectorAll(s)].filter(e=>e.getBoundingClientRect().width>0);
      const as=vis('[data-rhythm-song-detail]')[0];const act=vis('[data-rhythm-song-act]')[0];
      if(!as||!act)return {err:'欄が無い'};
      const B=e=>e.getBoundingClientRect();const a=B(act),s=B(as);
      // 回したときは、見た目の上下が端末の左右になる(90度: 見た目の下 = 端末の左)。見た目の座標へ直して比べる
      const down=b=>rot?{t:s.right-b.right,b:s.right-b.left,l:b.top,r:b.bottom}:{t:b.top,b:b.bottom,l:b.left,r:b.right};
      const A=down(a),S=down(s);
      const hit=(x,y)=>Math.min(x.r,y.r)-Math.max(x.l,y.l)>1&&Math.min(x.b,y.b)-Math.max(x.t,y.t)>0.5;
      const over=[];vis('[data-rhythm-difficulty-row] > button').forEach(b=>{const D=down(B(b));if(hit(D,A))over.push(`${b.getAttribute('data-rhythm-difficulty')}(${Math.round(D.b-A.t)}px)`);
        const best=b.querySelector('[data-rhythm-difficulty-best]');if(best){const E=down(B(best));if(E.b>D.b+0.5)over.push(`${b.getAttribute('data-rhythm-difficulty')}の数字が札の外`);}});
      const out=A.b>S.b+1||A.t<S.t-1;
      return {over,out,overflow:as.scrollHeight-as.clientHeight,title:((document.querySelector('[data-rhythm-song-detail] [data-rhythm-song-title]')||{}).textContent||'').slice(0,40)};
    },rot);
    if(process.env.MH_SHOT_DIR&&!notice&&wide)await page.screenshot({path:path.join(process.env.MH_SHOT_DIR,`yoko-fit-${lab.replace(/[ ・×]/g,'_')}-${id}.png`)});
    check(`${lab}${notice?'・一言あり':''}: ${id} の難易度の札(数字の段まで)が「ランダム・決定」の段と重ならない`,!r.err&&!r.over.length&&!r.out,JSON.stringify(r));
    check(`${lab}${notice?'・一言あり':''}: ${id} の右の欄があふれない`,!r.err&&r.overflow<=1,JSON.stringify(r));
  }
 }
}
check('ページのエラーが出ない',errs.length===0,errs.slice(0,3).join(' / '));
await browser.close();server.close();
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
})().catch((e)=>{console.log('NG: 検査が途中で止まった — '+String(e&&e.message||e).slice(0,300));process.exit(1);});
