// Supabaseをスタブし、複数ブリーダーLv記録が実際のDOMへ描画・保持されることを確認する。
const { chromium } = require('playwright');
const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
(async()=>{
  // ★この1本だけ「環境変数があればそれを使い、無ければPlaywright既定のパス」になっていて、
  //   既定のパス(playwright 1.62 が探す版)はこの環境に無いので即死していた。
  //   ほかの実ブラウザ検査30本以上と同じく、実体を直に指す
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||'/opt/pw-browsers/chromium'});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
    const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
    // 名前だけでは「はじめての設定」からやり直しになる(wasOnboarded は名前とアイコンの両方を見る)
    put('mh_breeder_name','テストブリーダー');
    put('mh_breeder_icon','Mocchi');
    put('mh_intro_done',true);
    put('mh_onboarded',true);
    put('mh_tutorial_seen_v1',true);
    put('mh_battle_tutorial_seen_v1',true);
    put('mh_battle_tutorial_guide_shown_v1',true);
    put('mh_masu_migrated',true);
    put('mh_kiki_intro_seen_v1',true);
    put('mh_momosuke_intro_seen_v1',true);
    put('mh_assistant_selected_v1','mua');
    put('mh_assistant_unlock_seen_v1',true);
    put('mh_update_notice_seen_v1',true);
    // HOMEへ着いた直後に全画面で流れるイベント回想を止める
    put('mh_rhythm_event_story_v1',['monbeat_cup_2026_09']);
    // 一度きりの「お詫びの配布」も全画面を覆うので、配布済みにしておく
    put('mh_inherited_unique_level_compensation_v1',true);
    put('mh_inherited_unique_level_compensation_pending_v1',false);
    put('mh_masu_level_cap_compensation_notice_seen_v1',true);
  });
  // ★取り方が「難易度ごとに1回ずつ」から「全難易度まとめて1回」へ変わったので、
  //   difficulty で出し分けずに全部返す。見たいのは
  //   「全難易度から集めて、同じ人は最高Lvへまとめる」ことなので、材料は同じ
  const ALL_ROWS=[
    {user_name:'アキラ',level:12,score:100,icon:null,hero:'モッチー',party:[]},
    {user_name:'ミナ',  level:8, score:90, icon:null,hero:'スエゾー',party:[]},
    {user_name:'アキラ',level:18,score:80, icon:null,hero:'ゴーレム',party:[]},
    {user_name:'レン',  level:15,score:70, icon:null,hero:'ライガー',party:[]},
  ];
  await page.route('**/rest/v1/rankings**',async route=>{
    if(route.request().method()!=='GET'){await route.fulfill({status:201,body:''});return;}
    // このファイルは先頭で URL という名前を使っているので、グローバルの URL が隠れている
    const url=new (require('url').URL)(route.request().url());
    const rows=[...ALL_ROWS];
    const order=url.searchParams.get('order')||'';
    if(order.startsWith('level.desc'))rows.sort((a,b)=>b.level-a.level);
    else if(order.startsWith('score.desc'))rows.sort((a,b)=>b.score-a.score);
    const limit=Number(url.searchParams.get('limit'))||rows.length;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows.slice(0,limit))});
  });
  // ★起動の流れが変わった。「TAP TO START」の先はHOMEではなくタイトル画面で、
  //   そこから button[aria-label="トップ画面へ進む"] を押してHOMEへ入る。
  //   通っている tools/ranking/breeder-ranking-paging-check.js と同じ段取りにそろえる
  const down=f=>page.evaluate(s=>{
    const b=s.aria?document.querySelector(`button[aria-label="${s.aria}"]`)
      :[...document.querySelectorAll('button')].find(x=>x.textContent.includes(s.text));
    if(b)b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    return !!b;
  },f);
  await page.goto(URL,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>document.getElementById('root')?.children.length>0,{timeout:60000});
  await page.waitForFunction(()=>document.body.innerText.includes('TAP TO START'),{timeout:40000}).catch(()=>{});
  await down({text:'TAP TO START'});
  await page.waitForFunction(()=>!!document.querySelector('button[aria-label="トップ画面へ進む"]'),{timeout:40000});
  await down({aria:'トップ画面へ進む'});
  await page.waitForTimeout(2500);
  // ログインボーナス・お知らせなど、HOMEに重なるものを閉じる
  // ★押すのは「重なりの中のボタン」だけにする。本文で探すとHOMEのギフトなどを
  //   押してしまい、別の画面へ迷い込む(実際に起きた)
  for(let i=0;i<8;i++){
    const closed=await page.evaluate(()=>{
      const inOverlay=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){
        const st=getComputedStyle(e);if(st.position==='fixed'||Number(st.zIndex)>1000)return true;}return false;};
      const b=[...document.querySelectorAll('button')]
        .find(x=>inOverlay(x)&&/^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ|あとで)$/.test((x.innerText||'').trim()));
      if(b)b.click();
      return !!b;
    });
    await page.waitForTimeout(500);
    if(!closed)break;
  }
  await page.evaluate(()=>{const b=document.querySelector('button[aria-label="バトル"]');if(b)b.click();});
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='ブリーダーLv');if(b)b.click();});
  const cards=page.locator('[data-ranking-kind="breeder"]');
  await cards.first().waitFor({timeout:30000});
  if(await cards.count()!==3)throw new Error(`ブリーダーLv DOM件数が3件ではありません: ${await cards.count()}`);
  const text=await cards.allTextContents();
  for(const expected of ['アキラブリーダーLv.18','レンブリーダーLv.15','ミナブリーダーLv.8'])if(!text.some(value=>value.replace(/\s/g,'').includes(expected)))throw new Error(`表示不足: ${expected}`);
  if(text.join(' ').match(/pt|勇者モン|供モン|絆Lv/))throw new Error('ブリーダーLv専用DOMに不要情報があります');
  // ★この画面のタブは「ブリーダーLv / 絆Lv」の2つ。スコアは別の画面
  //   (🏆 …のランキング → BATTLE_SCORE_RANKING)へ分かれたので、
  //   往復はこの画面の中にある2つで行う。見たいこと(タブを行き来しても
  //   ブリーダーの結果が消えない)は変わらない
  await page.getByRole('button',{name:'絆Lv'}).click();
  await page.waitForTimeout(1200);
  if(await page.locator('[data-ranking-kind="breeder"]').count())throw new Error('絆Lvタブへブリーダー結果が混入しました');
  await page.getByRole('button',{name:'ブリーダーLv'}).click();
  await cards.first().waitFor({timeout:30000});
  if(await cards.count()!==3)throw new Error('タブ往復でブリーダー結果が失われました');
  console.log('OK: 全難易度集約・最高Lv重複排除・複数ブリーダーのDOM表示・タブ間独立と保持を確認');
  await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
