#!/usr/bin/env node
// はじめての HELL の目安と、曲えらびの HELL の Lv. の目立たせ方を確かめる(2026-10-21 改善部 N6・社長の決定)。
//
//   node tools/mode/rhythm-hell-entry-check.js            # 確かめる
//   node tools/mode/rhythm-hell-entry-check.js --shots    # 絵も docs/playbot/reports/2026-10-21/hell-entry/ へ書く
//
// HELL は MASTER を1回クリアで開くが、MASTER と HELL の Lv. の差が25以上の曲がある(デュラハンテーマ MASTER 25 → HELL 59 など)。
// ① 目安の曲は、HELL の譜面のうち Lv. がいちばん低い公開曲を実データから選ぶ(曲名・Lv. を手で書かない)
// ② 曲えらびの HELL のボタンは、Lv. をほかの段より大きく出す(縦390・横844)
// ③ HELL の説明(お話のあと)の最後のページと、ヘルプの HELL の節に目安が出る
// ④ HELL が開く条件(MASTER を1回クリア)は変えていない
'use strict';
const http=require('http'),path=require('path'),fs=require('fs'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9061;
const SHOTS=process.argv.includes('--shots')?path.join(ROOT,'docs/playbot/reports/2026-10-21/hell-entry'):null;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ① 実データから選ぶ
const rhythm=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const ctx={Object,Number,Math,JSON,Array,String,Date};vm.createContext(ctx);
vm.runInContext(`${rhythm}\nthis.x={entry:rhythmHellEntrySong(),text:rhythmHellEntryText(),levels:RHYTHM_SONGS.filter(s=>RHYTHM_HELL_CHARTS[s.songId]).map(s=>RHYTHM_HELL_CHARTS[s.songId].level)};`,ctx);
const {entry,text,levels}=ctx.x;
ok('目安の曲は、HELL の Lv. がいちばん低い公開曲',!!entry&&entry.level===Math.min(...levels),entry?`${entry.name} Lv.${entry.level}(HELL ${levels.length}曲)`:'なし');
ok('目安の文は実データから作る(曲名と Lv. を含む)',!!entry&&text.includes(entry.name)&&text.includes(`Lv.${entry.level}`),text);
ok('ヘルプ・説明・曲えらびに、目安の曲名を手で書いていない',!!entry&&!help.includes(`${entry.name}(Lv.`)&&!help.includes(`「${entry.name}」Lv.`));
ok('ヘルプの HELL の節に、実データの目安がある',help.includes("{t:'data', id:'rhythmHellEntry'}")&&game.includes("case 'rhythmHellEntry':"));
// ④ 開く条件は変えていない(MASTER のクリアで開く)
ok('HELL が開く条件は MASTER を1回クリアのまま',/rhythmDifficultyUnlockRequirement/.test(game)&&/HELL[^\n]{0,80}MASTER/.test(game));

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4','.ico':'image/x-icon','.mp4':'video/mp4','.webm':'video/webm'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

(async()=>{
  let playwright;try{playwright=require('playwright');}catch{console.log('SKIP: playwright が無いのでブラウザの確かめは飛ばします');console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);}
  const server=await serve();let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
    for(const [name,vp,file] of [['縦390×844',{width:390,height:844},'select-390.png'],['横844×390',{width:844,height:390},'select-844.png']]){
      const page=await browser.newPage({viewport:vp});
      await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);});
      const clickText=async(p)=>page.evaluate((s)=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},p);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
      for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|確認)$')))break;await page.waitForTimeout(250);}
      await clickText('モンヒロビート');
      await page.waitForSelector('[data-rhythm-mode-solo]',{timeout:30000});
      await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]').click());
      // MASTER と HELL の Lv. の差が大きい曲(デュラハンテーマ)を選ぶ
      await page.waitForSelector('[data-rhythm-difficulty-row]',{timeout:30000});
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/デュラハンテーマ/.test(x.innerText||''));if(b)b.click();});
      await page.waitForTimeout(800);
      const sizes=await page.evaluate(()=>{const fs=sel=>{const el=document.querySelector(sel);return el?parseFloat(getComputedStyle(el).fontSize):0;};
        return {hell:fs('[data-rhythm-hell-level]'),master:fs('[data-rhythm-difficulty="MASTER"] b'),over:document.documentElement.scrollWidth>innerWidth+1};});
      ok(`${name}: 曲えらびの HELL の Lv. は MASTER より大きい`,sizes.hell>sizes.master&&sizes.master>0,`HELL ${sizes.hell}px / MASTER ${sizes.master}px`);
      ok(`${name}: 横にはみ出さない`,!sizes.over);
      if(SHOTS){fs.mkdirSync(SHOTS,{recursive:true});await page.screenshot({path:path.join(SHOTS,file)});}
      // HELL の説明の最後のページ(お話のあとに出る)を、ページの中で描いて確かめる
      const guide=await page.evaluate(()=>{const host=document.createElement('div');document.body.appendChild(host);
        const last=RHYTHM_HELL_GUIDE_PAGES.length-1;ReactDOM.createRoot(host).render(React.createElement(RhythmHellGuide,{pageIndex:last,onPage:()=>{},onClose:()=>{}}));
        return new Promise(r=>setTimeout(()=>{const el=document.querySelector('[data-rhythm-hell-guide-entry]');r(el?el.textContent:'');},400));});
      ok(`${name}: HELL の説明の最後のページに目安が出る`,guide.includes(text),guide.slice(0,60));
      if(SHOTS&&name.startsWith('縦'))await page.screenshot({path:path.join(SHOTS,'guide-last-390.png')});
      await page.close();}
  }catch(e){console.log('NG: 実行できませんでした —',e.message);failed++;}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);
})();
