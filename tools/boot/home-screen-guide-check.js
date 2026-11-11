#!/usr/bin/env node
// 「ホーム画面に追加」の案内(51-home-screen-guide.jsx・2026-11-11)の見張り。
//
//   node tools/boot/home-screen-guide-check.js
//
// 決まり(社長の選択 B・窓口経由):
//   ① iPhone の Safari だけに出す(ホーム画面のアプリ・Android・パソコン・iPhone の Chrome・LINE などのアプリ内ブラウザには出さない)
//   ② データ引き継ぎの案内とセット(バックアップ → 追加 → 戻す の順・データ引き継ぎを開くボタン)
//   ③ しつこくしない: はじめて HOME に来てから1時間は出さない・出したら14日あける・自動は3回まで・「もう表示しない」で二度と出さない
//   ④ 新しいキー mh_home_screen_guide_v1 だけを使う。壊れた値でも既定値で動く
//   ⑤ ヘルプ(homescreen)に同じ手順・設定から開ける
const fs=require('fs'),path=require('path'),vm=require('vm'),http=require('http');
const ROOT=path.resolve(__dirname,'../..'),PORT=8976;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const src=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/51-home-screen-guide.jsx'),'utf8');
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');
const settings=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/51-screen-settings.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
const logic=(src.match(/const MH_HOME_SCREEN_GUIDE_KEY[\s\S]*?(?=\n\/\/ 案内の窓)/)||[''])[0];
ok('判定の部分を取り出せる',logic.length>200);
const UA={
  safari:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIos:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1',
  line:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.18.0',
  xApp:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.70',
  android:'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  ipad:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  pc:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};
const make=standalone=>{const store={};const ctx={window:{navigator:{standalone,userAgent:''},localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v);}}},
  mhIsIosHomeScreenApp:()=>standalone===true,Number,JSON,Math,String,Array};vm.createContext(ctx);vm.runInContext(logic.replace(/^const /gm,'var '),ctx);ctx.store=store;return ctx;};
// ①
{
  const c=make(undefined);
  ok('① iPhone の Safari には出す',c.mhIsIphoneSafariBrowser(UA.safari)===true);
  for(const k of ['chromeIos','line','xApp','android','ipad','pc'])ok(`① ${k} には出さない`,c.mhIsIphoneSafariBrowser(UA[k])===false);
  ok('① iPhone のホーム画面のアプリには出さない',make(true).mhIsIphoneSafariBrowser(UA.safari)===false);
}
// ③④
{
  const c=make(undefined),H=3600e3,D=24*H,now=Date.now();
  const due=s=>c.homeScreenGuideAutoDue(s,now);
  ok('③ はじめて HOME に来た記録が無いうちは出さない',due({})===false);
  ok('③ はじめて来てから1時間たつまでは出さない',due({firstSeenAt:now-30*60e3})===false);
  ok('③ 1時間たてば出す',due({firstSeenAt:now-2*H})===true);
  ok('③ 出してから14日のあいだは出さない',due({firstSeenAt:now-30*D,lastShownAt:now-13*D,autoCount:1})===false);
  ok('③ 14日たてばまた出す',due({firstSeenAt:now-30*D,lastShownAt:now-15*D,autoCount:1})===true);
  ok('③ 自動で出すのは3回まで',due({firstSeenAt:now-90*D,lastShownAt:now-30*D,autoCount:3})===false);
  ok('③ 「もう表示しない」なら出さない',due({firstSeenAt:now-2*H,never:true})===false);
  const n=c.normalizeHomeScreenGuideState;
  const bad=[null,'x',[1],{firstSeenAt:'abc',lastShownAt:-5,autoCount:NaN,never:'yes'}].map(v=>JSON.stringify(n(v)));
  ok('④ 壊れた値でも既定値になる',bad.every(v=>v===JSON.stringify({firstSeenAt:0,lastShownAt:0,autoCount:0,never:false})),bad[3]);
  ok('④ 保存キーは mh_home_screen_guide_v1 だけ',c.MH_HOME_SCREEN_GUIDE_KEY==='mh_home_screen_guide_v1'&&(src.match(/mh_[a-z0-9_]+/g)||[]).every(k=>k==='mh_home_screen_guide_v1'));
}
// ②⑤ 書き方
ok('② 手順は バックアップ → 追加 → 戻す の順',/step\(1, 'いまの Safari でバックアップを作る'[\s\S]*step\(2, 'ホーム画面に追加する'[\s\S]*step\(3, '追加したアイコンから開いて、データを戻す'/.test(src));
ok('② 「保存データが別々」を手順の前に出す',src.indexOf('保存データが別々')>0&&src.indexOf('保存データが別々')<src.indexOf("step(1,"));
ok('⑤ ヘルプに同じ手順がある',/id: 'homescreen'[\s\S]{0,1600}t:'steps'/.test(help)&&help.includes('保存データが別々'));
ok('⑤ 設定の入口は iPhone の Safari のときだけ',/mhIsIphoneSafariBrowser\(\)&&\(\s*<SettingsMenuLink icon="📲"/.test(settings));
ok('HOME で自動の案内を置いている',/gameState==='HOME'&&typeof HomeScreenGuideAuto==='function'/.test(app));
// 実物(iPhone の Safari のまね)
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'}[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});
const seed=(guide)=>{ if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s','1'); const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','テスト'); put('mh_breeder_icon','🐣'); put('mh_intro_done',true); put('mh_onboarded',true); put('mh_tutorial_seen_v1',true);
  put('mh_battle_tutorial_seen_v1',true); put('mh_battle_tutorial_guide_shown_v1',true); put('mh_assistant_selected_v1','mua'); put('mh_assistant_unlock_seen_v1',true);
  put('mh_update_notice_seen_v1',true); put('mh_rhythm_tutorial_seen_v1',true); put('mh_inherited_unique_level_compensation_v1',true); put('mh_masu_level_cap_compensation_notice_seen_v1',true);
  if(guide)put('mh_home_screen_guide_v1',{firstSeenAt:Date.now()-2*3600e3}); };
(async()=>{
  let chromium;
  try{({chromium}=require('playwright'));}catch{console.log('SKIP: playwright が入っていないので実物は確かめません');finish();return;}
  const server=await serve();let browser;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const home=async(ua,guide)=>{
      const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:ua});
      const page=await ctx.newPage();
      await page.addInitScript(()=>{window.__mhSupabaseStubbed=true;});
      await page.route(/supabase|functions\/v1/,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
      await page.addInitScript(seed,guide);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.querySelector('.mh-home-assistant'),{timeout:40000});
      for(let i=0;i<14;i++){const did=await page.evaluate(()=>{const l=[...document.querySelectorAll('button')].filter(b=>!b.closest('[data-home-screen-guide]')&&/^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む)$/.test((b.innerText||'').trim()));if(!l.length)return false;l[0].click();return true;});if(!did)break;await page.waitForTimeout(300);}
      return {ctx,page};
    };
    {
      const {ctx,page}=await home(UA.safari,true);
      const shown=await page.waitForSelector('[data-home-screen-guide]',{timeout:60000}).then(()=>true).catch(()=>false);
      ok('実物: iPhone の Safari で、HOME に案内が出る',shown);
      const st=await page.evaluate(()=>JSON.parse(localStorage.getItem('mh_home_screen_guide_v1')||'{}'));
      ok('実物: 出したときに回数と時刻を覚える',st.autoCount===1&&st.lastShownAt>0,JSON.stringify(st));
      await page.click('[data-home-screen-guide-backup]');
      const backup=await page.waitForFunction(()=>[...document.querySelectorAll('h3')].some(h=>/データ引き継ぎ|データのバックアップ/.test(h.textContent||'')),{timeout:8000}).then(()=>true).catch(()=>false);
      ok('実物: 「データ引き継ぎを開く」でデータ引き継ぎの窓が開く',backup);
      await page.keyboard.press('Escape').catch(()=>{});
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(閉じる|×|✕)$/.test((x.innerText||'').trim())&&!x.closest('[data-home-screen-guide]'));if(b)b.click();});
      await page.waitForTimeout(400);
      await page.click('[data-home-screen-guide-never]');
      const st2=await page.evaluate(()=>JSON.parse(localStorage.getItem('mh_home_screen_guide_v1')||'{}'));
      ok('実物: 「もう表示しない」を覚える',st2.never===true&&!(await page.$('[data-home-screen-guide]')));
      await ctx.close();
    }
    {
      const {ctx,page}=await home(UA.android,true);
      await page.waitForTimeout(6000);
      ok('実物: Android には出さない',!(await page.$('[data-home-screen-guide]')));
      await ctx.close();
    }
  }catch(error){ok('実物を最後まで確かめられる',false,String(error).split('\n')[0]);}
  finally{await browser?.close();server.close();}
  finish();
})();
function finish(){console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);process.exit(failed===0?0:1);}
