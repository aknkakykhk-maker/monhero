// Supabaseをスタブし、複数ブリーダーLv記録が実際のDOMへ描画・保持されることを確認する。
const { chromium } = require('playwright');
const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
(async()=>{
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{localStorage.setItem('mh_breeder_name',JSON.stringify('テストブリーダー'));localStorage.setItem('mh_intro_done',JSON.stringify(true));});
  await page.route('**/rest/v1/rankings**',async route=>{
    const difficulty=new URL(route.request().url()).searchParams.get('difficulty')?.replace('eq.','')||'Normal';
    const rows=difficulty==='Normal'?[{user_name:'アキラ',level:12,score:100,icon:null,hero:'モッチー',party:[]},{user_name:'ミナ',level:8,score:90,icon:null,hero:'スエゾー',party:[]}]:difficulty==='Hard'?[{user_name:'アキラ',level:18,score:80,icon:null,hero:'ゴーレム',party:[]},{user_name:'レン',level:15,score:70,icon:null,hero:'ライガー',party:[]}]:[];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});
  });
  await page.goto(URL,{waitUntil:'load',timeout:60000});
  await page.getByRole('button',{name:'TAP TO START'}).click();
  await page.getByRole('button',{name:'バトル'}).click();
  await page.getByRole('button',{name:'ランキング'}).click();
  await page.getByRole('button',{name:'ブリーダーLv'}).click();
  const cards=page.locator('[data-ranking-kind="breeder"]');
  await cards.first().waitFor({timeout:30000});
  if(await cards.count()!==3)throw new Error(`ブリーダーLv DOM件数が3件ではありません: ${await cards.count()}`);
  const text=await cards.allTextContents();
  for(const expected of ['アキラブリーダーLv.18','レンブリーダーLv.15','ミナブリーダーLv.8'])if(!text.some(value=>value.replace(/\s/g,'').includes(expected)))throw new Error(`表示不足: ${expected}`);
  if(text.join(' ').match(/pt|勇者モン|供モン|絆Lv/))throw new Error('ブリーダーLv専用DOMに不要情報があります');
  await page.getByRole('button',{name:'絆Lv'}).click();
  if(await page.locator('[data-ranking-kind="breeder"]').count())throw new Error('絆Lvタブへブリーダー結果が混入しました');
  await page.getByRole('button',{name:'スコア'}).click();
  await page.getByRole('button',{name:'ブリーダーLv'}).click();
  if(await cards.count()!==3)throw new Error('タブ往復でブリーダー結果が失われました');
  console.log('OK: 全難易度集約・最高Lv重複排除・複数ブリーダーのDOM表示・タブ間独立と保持を確認');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
