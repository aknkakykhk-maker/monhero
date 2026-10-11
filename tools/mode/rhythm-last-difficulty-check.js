#!/usr/bin/env node
// 曲えらびで前に選んだ難易度を、次に始めたときも引き継ぐか(mh_rhythm_last_difficulty_v1・2026-10-11)を実際のブラウザで確かめる。
//
//   node tools/mode/rhythm-last-difficulty-check.js
//
// 見ること
//   ・保存値が無い → EASY(今までどおり)
//   ・"HARD" が保存されている → HARD を選んだ状態で開く
//   ・壊れた値・公開していない難易度("HELL")・その曲でまだ解放していない難易度("MASTER")→ EASY に戻る
//   ・曲えらびで NORMAL を押すと "NORMAL" が保存され、開き直すと NORMAL で開く
//   (デバッグの全解放の曲えらびは別の入れ物 rhythmDebugSelectDifficultyId を使い、この保存値へは書かない)
//   ・関数だけの確かめ: normalizeRhythmLastDifficulty
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9068;
let playwright;try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}).listen(PORT);
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const KEY='mh_rhythm_last_difficulty_v1';

// stored: undefined なら書かない。文字列はそのまま localStorage へ入れる(壊れた値も試すため JSON にしない)
const openSelect=async(browser,stored)=>{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(([key,stored])=>{
    if(sessionStorage.getItem('__seeded'))return;sessionStorage.setItem('__seeded','1');
    const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
    put('mh_breeder_name','あつ');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
    put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
    put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);
    if(stored!==null)localStorage.setItem(key,stored);
  },[KEY,stored===undefined?null:stored]);
  await gotoSelect(page);
  return page;
};
const gotoSelect=async(page)=>{
  const clickText=(re)=>page.evaluate((p)=>{const b=[...document.querySelectorAll('button,summary')].find(x=>new RegExp(p).test(x.textContent));if(b)b.click();return !!b;},re);
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
  await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
  await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
  await page.waitForTimeout(2000);
  for(let i=0,q=0;i<80&&q<6;i++){if(await clickText('^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|次へ)$')){q=0;await page.waitForTimeout(300);}else{q++;await page.waitForTimeout(400);}}
  await page.evaluate(()=>document.querySelector('button[aria-label="モンヒロビート"]')?.click());
  await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});
  await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
  await page.waitForSelector('[data-rhythm-demo-home] [data-rhythm-difficulty]',{timeout:20000}).catch(()=>{});
  await page.waitForTimeout(800);
};
const selected=page=>page.evaluate(()=>{const b=document.querySelector('[data-rhythm-difficulty][aria-pressed="true"]');return b?b.getAttribute('data-rhythm-difficulty'):'';});

(async()=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    {
      const page=await openSelect(browser,undefined);
      check('関数: 公開している5難易度だけを通す',await page.evaluate(()=>normalizeRhythmLastDifficulty('HARD')==='HARD'&&normalizeRhythmLastDifficulty('MASTER')==='MASTER'
        &&normalizeRhythmLastDifficulty('HELL')===''&&normalizeRhythmLastDifficulty('hard')===''&&normalizeRhythmLastDifficulty(null)===''&&normalizeRhythmLastDifficulty({})===''&&normalizeRhythmLastDifficulty(3)===''));
      check('保存値が無いときは EASY',await selected(page)==='EASY',await selected(page));
      // NORMAL を押すと覚え、開き直すと NORMAL
      await page.evaluate(()=>document.querySelector('[data-rhythm-difficulty="NORMAL"]')?.click());await page.waitForTimeout(500);
      check('NORMAL を押すと保存される',await page.evaluate((k)=>localStorage.getItem(k),KEY)==='"NORMAL"',await page.evaluate((k)=>String(localStorage.getItem(k)),KEY));
      await gotoSelect(page);
      check('開き直すと NORMAL で開く',await selected(page)==='NORMAL',await selected(page));
      await page.close();
    }
    for(const [label,stored,want] of [['"HARD"','"HARD"','HARD'],['壊れた値','{broken','EASY'],['公開していない "HELL"','"HELL"','EASY'],['まだ解放していない "MASTER"','"MASTER"','EASY']]){
      const page=await openSelect(browser,stored);
      const got=await selected(page);
      check(`保存値が ${label} のとき ${want} で開く`,got===want,got);
      await page.close();
    }
  }finally{await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
