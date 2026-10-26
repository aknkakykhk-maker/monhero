// 縦画面の曲えらびで、アシスト・ミラー譜面を上の題名の行へ、ランキングを「決定」の右へ移したこと(2026-10-19)を実ブラウザで見る。
// 社長「縦画面だと曲選択が見づらい。アシスト、ミラーとかを上部の空いてるとことかに移動して」。
// 見ること(390x844・320x568 の縦、844x390 の横):
//   ・縦: 題名の行にアシスト・ミラー、決定の右にランキングがあり、どれも44px前後で押せる。下の3つ並びの段は出ていない
//   ・縦: 題名「曲えらび」が切れていない・横にはみ出してスクロールしない
//   ・縦: 上のボタンでアシストを入れると ON になり、今までと同じ mh_rhythm_settings_v1 に保存される
//   ・横: 置き場所は今までどおり(上のボタンは出さず、ジャケットの右の3つ並び)
// Playwright が無い環境では SKIP。
//   node tools/mode/rhythm-portrait-play-modes-check.js
const path=require('path'),http=require('http'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=Number(process.env.PORTRAIT_PLAY_MODES_PORT)||9253;
let failed=0;const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const seed=()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);
  put('mh_inherited_unique_level_compensation_v1',true);put('mh_rhythm_look_intro_seen_v1',true);};
(async()=>{let playwright;try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確かめられません');process.exit(0);}}
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
 if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(PORT,r));
const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
try{for(const [w,h] of [[390,844],[320,568],[844,390]]){const portrait=h>w;
 const page=await browser.newPage({viewport:{width:w,height:h},hasTouch:true,isMobile:true,deviceScaleFactor:2});
 await page.addInitScript(seed);
 const clickText=(p)=>page.evaluate((s)=>{const rx=new RegExp(s);const x=[...document.querySelectorAll('button')].find((b)=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));if(!x)return false;x.click();return true;},p);
 await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
 await page.getByRole('button',{name:'TAP TO START'}).click({force:true,timeout:60000});
 await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
 await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),null,{timeout:40000});
 for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK')))break;await page.waitForTimeout(250);}
 await clickText('モンヒロビート');
 await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
 await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});await page.waitForTimeout(1500);
 const r=await page.evaluate(()=>{const R=e=>e.getBoundingClientRect();const vis=e=>{if(!e)return false;const x=R(e);return x.width>0&&x.height>0;};
  const size=e=>{const x=R(e);return [Math.round(x.width),Math.round(x.height)];};
  const head=document.querySelector('[data-rhythm-header-play-modes]');
  const headBtns=head?[...head.querySelectorAll('[data-rhythm-play-mode-toggle]')]:[];
  const row=document.querySelector('[data-rhythm-play-modes]');
  const act=document.querySelector('[data-rhythm-ranking-place="action"]');
  const h2=[...document.querySelectorAll('h2')].find(e=>/曲えらび/.test(e.innerText));
  return {head:vis(head),headSizes:headBtns.filter(vis).map(size),headKeys:headBtns.map(b=>b.getAttribute('data-rhythm-play-mode-toggle')),
    row:vis(row),rowCount:row?[...row.querySelectorAll('button')].filter(vis).length:0,act:vis(act),actSize:act?size(act):null,
    title:h2?[h2.scrollWidth,h2.clientWidth]:null,hscroll:document.documentElement.scrollWidth>innerWidth+1};});
 const tag=`${w}x${h}`;
 if(portrait){
  check(`${tag} 縦: 題名の行にアシスト・ミラーがある`,r.head&&r.headKeys.join(',')==='assistMode,mirrorChart'&&r.headSizes.length===2,JSON.stringify(r.headKeys));
  check(`${tag} 縦: 上のボタンは44px前後で押せる`,r.headSizes.every(([bw,bh])=>bw>=44&&bh>=44),JSON.stringify(r.headSizes));
  check(`${tag} 縦: ランキングは決定の右にあり、押せる大きさ`,r.act&&r.actSize[0]>=44&&r.actSize[1]>=44,JSON.stringify(r.actSize));
  check(`${tag} 縦: 下の3つ並びの段は出ていない`,!r.row);
  check(`${tag} 縦: 題名「曲えらび」が切れていない`,r.title&&r.title[0]<=r.title[1],JSON.stringify(r.title));
  check(`${tag} 縦: 横にはみ出していない`,!r.hscroll);
  const t=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-header-play-modes] [data-rhythm-play-mode-toggle="assistMode"]');const before=b.getAttribute('aria-pressed');b.click();return before;});
  await page.waitForTimeout(400);
  const after=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-header-play-modes] [data-rhythm-play-mode-toggle="assistMode"]');let saved=null;try{saved=JSON.parse(localStorage.getItem('mh_rhythm_settings_v1')||'null');}catch{}
    return {pressed:b.getAttribute('aria-pressed'),label:b.getAttribute('aria-label'),saved:saved&&saved.assistMode,note:!!document.querySelector('[data-rhythm-assist-note]')};});
  check(`${tag} 縦: 上のボタンでアシストが ON になる`,t==='false'&&after.pressed==='true'&&/ON$/.test(after.label),JSON.stringify(after));
  check(`${tag} 縦: 今までと同じ設定(mh_rhythm_settings_v1)に保存される`,after.saved===true);
  check(`${tag} 縦: アシストONの説明は今までどおり出る`,after.note);
 }else{
  check(`${tag} 横: 上のボタンは出さない`,!r.head);
  check(`${tag} 横: 置き場所は今までどおり(ジャケットの右の3つ並び)`,r.row&&r.rowCount===3,`${r.rowCount}個`);
  check(`${tag} 横: 決定の右のランキングは出さない`,!r.act);
 }
 await page.close();}
}catch(e){check('最後まで確かめられた',false,String(e&&e.stack||e).slice(0,300));}
await browser.close();server.close();console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);})().catch(e=>{console.error(e);process.exit(1);});
