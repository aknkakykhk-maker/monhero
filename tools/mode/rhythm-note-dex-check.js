#!/usr/bin/env node
// ノーツ図鑑(2026-10-21 社長「見た目とかちゃんとわかるようにしてほしい」)を確かめる。
//
//   node tools/mode/rhythm-note-dex-check.js            # 確かめる
//   node tools/mode/rhythm-note-dex-check.js --shots    # 画面の絵も docs/playbot/reports/2026-10-21/note-dex/ へ書く
//
// ① データ: 10種類(TAP・同時押し・HOLD・SLIDE・FLICK・横フリック・終点フリック・モンスターノーツ・SKY TAP・SKY SLIDE)が並び、
//    どれもその種類のノーツだけの短い譜面で、説明はヘルプの表から引ける(書き写していない)
// ② 記録に残さない: from:'notedex' は練習と同じく、記録・ランキング・ビートP・ミッションの手前で抜ける。戻り先は図鑑
// ③ 実際のブラウザで、図鑑を開いて各ノーツを1回ずつ流す: 帯にノーツの名前が出る・判定が出る(叩かないので MISS)・
//    空のノーツは空の道が出る・結果から図鑑へ戻る。縦390×844 と 横844×390 で一覧がはみ出さない
'use strict';
const http=require('http'),path=require('path'),fs=require('fs'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9053;
const SHOTS=process.argv.includes('--shots')?path.join(ROOT,'docs/playbot/reports/2026-10-21/note-dex'):null;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ① データ
const rhythmSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const ctx={Object,Number,Math,JSON,Array,String,Date};vm.createContext(ctx);
vm.runInContext(`${rhythmSource}\nthis.x={RHYTHM_NOTE_DEX,rhythmNoteDexSong,RHYTHM_DEMO_SONG_IDS};`,ctx);
const {RHYTHM_NOTE_DEX:dex,rhythmNoteDexSong,RHYTHM_DEMO_SONG_IDS}=ctx.x;
const WANT=['tap','chord','hold','slide','flick','sideFlick','endFlick','monster','skyTap','skySlide'];
ok('図鑑に10種類が並ぶ',JSON.stringify(dex.map(e=>e.id))===JSON.stringify(WANT),dex.map(e=>e.id).join(' '));
const sky=n=>n.skyHeight>0||(n.slidePoints||[]).some(p=>p.sky>0);
const kind={tap:n=>n.type==='TAP'&&!n.monsterSlot&&!sky(n),chord:n=>n.type==='TAP'&&!sky(n),hold:n=>n.type==='HOLD'&&!n.endFlick,slide:n=>n.type==='SLIDE'&&!sky(n),
  flick:n=>n.type==='FLICK'&&!n.flickDir,sideFlick:n=>n.type==='FLICK'&&(n.flickDir==='left'||n.flickDir==='right'),endFlick:n=>n.type==='HOLD'&&n.endFlick===true,
  monster:n=>n.type==='TAP'&&n.monsterSlot>0,skyTap:n=>n.type==='TAP'&&n.skyHeight>0,skySlide:n=>n.type==='SLIDE'&&sky(n)};
for(const e of dex){const s=rhythmNoteDexSong(e.id,'説明'),c=s.difficulties.TUTORIAL;
  ok(`${e.name}: その種類のノーツだけが流れる`,c.notes.length>=2&&c.notes.every(kind[e.id]),`${c.notes.length}ノーツ`);
  ok(`${e.name}: 帯の見出しは名前・本文は渡した説明`,s.tutorialSteps[0].title===e.name&&s.tutorialSteps[0].text==='説明');
  ok(`${e.name}: 曲えらびの一覧には出さない`,!RHYTHM_DEMO_SONG_IDS.includes(s.songId));
  ok(`${e.name}: 説明を引くヘルプの行がある`,new RegExp(`\\['${e.help[1].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`).test(help),e.help.join(' / '));}
{const s=rhythmNoteDexSong('chord'),n=s.difficulties.TUTORIAL.notes;ok('同時押しは同じ時刻に2つずつ',n.every(a=>n.some(b=>b!==a&&b.timeMs===a.timeMs)));}
// ② 記録に残さない・戻り先
ok('図鑑の試し打ちは何も残さない(onComplete の手前で抜ける)',game.includes("if(rhythmPlay.from==='notedex')return;"));
ok('図鑑の試し打ちは練習と同じ扱い(ライフを減らさない・ログや診断を送らない)',game.includes("tutorial={rhythmPlay.from==='tutorial'||rhythmPlay.from==='notedex'}"));
ok('終わったら図鑑へ戻る',game.includes("rhythmPlay.backTo==='RHYTHM_NOTE_DEX'?'RHYTHM_NOTE_DEX'")&&game.includes("backTo:'RHYTHM_NOTE_DEX'"));
ok('説明はヘルプの表から引く(書き写さない)',game.includes('const rhythmNoteDexHelpRow=')&&/helpCategoryById\('rhythm'\)/.test(game));

// ③ 実際のブラウザ
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
  catch{console.log('SKIP: playwright が入っていないので、ブラウザでの確かめは飛ばします');console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);}
  const server=await serve();let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    const openDex=async(vp)=>{
      const page=await browser.newPage({viewport:vp});
      await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);});
      const clickText=async(pat)=>page.evaluate((s)=>{const rx=new RegExp(s);
        const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pat);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
      for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|確認)$')))break;await page.waitForTimeout(250);}
      await clickText('モンヒロビート');
      await page.waitForSelector('[data-rhythm-demo-help]',{timeout:30000});
      await page.evaluate(()=>document.querySelector('[data-rhythm-demo-help]').click());
      await page.waitForSelector('[data-rhythm-demo-note-dex]',{timeout:20000});
      await page.evaluate(()=>document.querySelector('[data-rhythm-demo-note-dex]').click());
      await page.waitForSelector('[data-rhythm-note-dex-list]',{timeout:20000});
      return page;};
    for(const [name,vp,file] of [['縦390×844',{width:390,height:844},'portrait-390.png'],['横844×390',{width:844,height:390},'landscape-844.png']]){
      const page=await openDex(vp);
      const info=await page.evaluate(()=>{const items=[...document.querySelectorAll('[data-rhythm-note-dex-item]')];
        return {n:items.length,withText:items.filter(x=>x.querySelector('[data-rhythm-note-dex-text]')&&x.querySelector('[data-rhythm-note-dex-text]').textContent.trim().length>4).length,
          over:document.documentElement.scrollWidth>innerWidth+1};});
      ok(`${name}: 図鑑に10種類が並び、どれにも説明が付く`,info.n===10&&info.withText===10,`${info.withText}/${info.n}`);
      ok(`${name}: 横にはみ出さない`,!info.over);
      if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,file)});}
      if(name.startsWith('縦')){
        for(const id of ['tap','chord','hold','slide','flick','sideFlick','endFlick','monster','skyTap','skySlide']){
          await page.evaluate(i=>document.querySelector(`[data-rhythm-note-dex-play="${i}"]`).click(),id);
          await page.waitForSelector('[data-rhythm-tutorial-banner]',{timeout:20000});
          const title=await page.evaluate(()=>document.querySelector('[data-rhythm-tutorial-title]').textContent.trim());
          // 叩かないので、流れてきたノーツは判定ラインを過ぎて MISS になる(判定の文字が出る=本物の演奏の仕組みで流れて判定された)
          const judged=await page.waitForFunction(()=>[...document.querySelectorAll('[data-rhythm-judgment-display],[data-rhythm-sky-judgment-display]')].some(x=>/MISS/.test(x.textContent||'')),{timeout:20000}).then(()=>true).catch(()=>false);
          const skyShown=await page.evaluate(()=>!!document.querySelector('[data-rhythm-sky-lane-look],[data-rhythm-sky-flow],[data-rhythm-sky-lift]'));
          if(SHOTS&&(id==='tap'||id==='skySlide'||id==='monster'))await page.screenshot({path:path.join(SHOTS,`play-${id}.png`)});
          await page.waitForSelector('[data-rhythm-result-actions]',{timeout:30000});
          await page.evaluate(()=>{const b=[...document.querySelectorAll('[data-rhythm-result-actions] button')];b[b.length-1].click();});
          const back=await page.waitForSelector('[data-rhythm-note-dex-list]',{timeout:20000}).then(()=>true).catch(()=>false);
          const e=dex.find(x=>x.id===id);
          ok(`${e.name}: 流れてきて判定が出て、終わると図鑑へ戻る`,title===e.name&&judged&&back,`帯「${title}」・判定 ${judged?'出た':'出ない'}・戻り ${back?'図鑑':'ほか'}`);
          if(id==='skyTap'||id==='skySlide')ok(`${e.name}: 空の道が出る(HELL を開けていなくても見られる)`,skyShown);}}
      await page.close();}
  }catch(e){console.log('NG: 実行できませんでした —',e.message);failed++;}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件 NG`:'\nすべてOK');
  process.exit(failed?1:0);
})();
