#!/usr/bin/env node
// デバッグの全解放の曲えらび(RHYTHM_DEBUG_SELECT・2026-10-11 社長の依頼)を、実際のブラウザで通す。
//
//   node tools/mode/rhythm-debug-select-check.js           # 演奏を最後まで通す(約2分半)
//   node tools/mode/rhythm-debug-select-check.js --quick   # 演奏の頭だけ(保存値の突き合わせは演奏を抜けたあと)
//   node tools/mode/rhythm-debug-select-check.js --shots <フォルダ>   # 横 844×390・縦 390×844 の静止画も書き出す
//
// 見ること
//   ・デバッグ設定 → モンヒロビート → 「全解放の曲えらびを開く」で、本物の曲えらびと同じ画面が開く(アシスト・ミラー・オプション・「試作だけ」の切り替え)
//   ・公開前・試作の曲(試作の枠の Sheriruth HELL)が並び、HELL を含む全部の難易度に鍵が無い
//   ・「デバッグ(記録しない)」の印が出ている
//   ・横持ち(844×390)で演奏して、終わったら全解放の曲えらびへ戻る
//   ・演奏の前後で localStorage が1文字も変わらない(自己ベスト・クリア回数・実績・ビートP・ミッション)
//   ・ランキングへ何も送らない(Supabase への書き込みの通信が0件)
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9067;
let playwright;try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
const args=process.argv.slice(2);
const QUICK=args.includes('--quick');
const SHOTS=args.includes('--shots')?args[args.indexOf('--shots')+1]:null;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});fs.createReadStream(f).pipe(res);}).listen(PORT);
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const SONG_ID='sheriruth_hell_debug';

const openDebugSelect=async(page)=>{
  const clickText=(re)=>page.evaluate((p)=>{const b=[...document.querySelectorAll('button,summary')].find(x=>new RegExp(p).test(x.textContent));if(b)b.click();return !!b;},re);
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
  await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
  await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
  await page.waitForTimeout(2000);
  for(let i=0,q=0;i<80&&q<6;i++){if(await clickText('^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|次へ)$')){q=0;await page.waitForTimeout(300);}else{q++;await page.waitForTimeout(400);}}
  await page.evaluate(()=>document.querySelector('button[aria-label="設定"]')?.click());await page.waitForTimeout(900);
  await clickText('^ヘルプ');await page.waitForTimeout(900);
  await clickText('💊');await page.waitForTimeout(1200);
  await page.evaluate(()=>{const s=[...document.querySelectorAll('summary')].find(x=>/モンヒロビート/.test(x.textContent));if(s)s.click();});await page.waitForTimeout(500);
  await page.evaluate(()=>document.querySelector('[data-debug-rhythm-mode]')?.click());await page.waitForTimeout(1500);
  const opened=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-debug-select-open]');if(b)b.click();return !!b;});
  await page.waitForTimeout(1200);
  return opened;
};
// 曲の行を、曲の id から探して押す(同じ曲名の版がいくつもあるので、題名では探さない)
const selectSong=(page,songId)=>page.evaluate((songId)=>{
  const song=[...RHYTHM_SONGS,...RHYTHM_PROTO_SONGS].find(s=>s.songId===songId);if(!song)return 'no-song';
  const rows=[...document.querySelectorAll('[data-rhythm-song-row]')];
  const sub=song.subtitle||'';
  const row=rows.find(r=>r.textContent.includes(song.displayName)&&(!sub||r.textContent.includes(sub)));
  if(!row)return 'no-row';
  row.click();return 'ok';
},songId);
// 演奏と関係なく時間で書き直す値は突き合わせから外す。ゲームの記録ではない:
//   mhdev_*        … 遊んでいるあいだ15秒ごとに書き直す診断用の印(50-error-boundary.jsx)
//   mh_playtime_v1 … 画面が見えているあいだ数えて60秒ごとに保存する「遊んだ時間」(どの画面にいても増える)
const snapshot=page=>page.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^mhdev_/.test(k)||k==='mh_playtime_v1')continue;o[k]=localStorage.getItem(k);}return o;});

(async()=>{
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage({viewport:{width:844,height:390}});
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      if(localStorage.getItem('mh_intro_done'))return;
      put('mh_breeder_name','あつ');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);put('mh_rhythm_tutorial_seen_v1',true);});
    // 書き込みの通信(ランキング送信など)を数える。読むだけ(GET)と、関数呼び出し(/rest/v1/rpc/。どれも読むだけ・POST で送る)は数えない
    const writes=[];
    page.on('request',req=>{const u=req.url();if(/supabase/i.test(u)&&req.method()!=='GET'&&!/\/rest\/v1\/rpc\//.test(u))writes.push(`${req.method()} ${u.split('?')[0]}`);});
    const errors=[];page.on('pageerror',e=>errors.push(String(e&&e.message||e)));

    check('デバッグの「全解放の曲えらびを開く」がある',await openDebugSelect(page));
    check('全解放の曲えらびが開く',await page.locator('[data-rhythm-debug-select]').count()===1);
    check('「デバッグ(記録しない)」の印が出ている',(await page.locator('[data-rhythm-debug-select-badge]').innerText().catch(()=>'')).includes('記録しない'));
    check('横持ちの切り替えボタンがある',await page.evaluate(()=>!!document.querySelector('[data-rhythm-debug-select] header button[aria-label*="横"],[data-rhythm-debug-select] header button[aria-label*="縦"],[data-rhythm-debug-select] header [data-rhythm-orientation]')||/[🔄]/.test(document.querySelector('[data-rhythm-debug-select] header')?.textContent||'')));
    const counts=await page.evaluate(()=>({rows:document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]').length,
      songs:RHYTHM_SONGS.length+RHYTHM_PROTO_SONGS.length,demo:RHYTHM_DEMO_SONG_IDS.length}));
    check('公開前・試作の曲まで並んでいる(公開曲の数より多い)',counts.rows>counts.demo,`行 ${counts.rows} / 公開曲 ${counts.demo}`);
    check('曲を選べる',await selectSong(page,SONG_ID)==='ok');
    await page.waitForTimeout(500);
    const diff=await page.evaluate(()=>[...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-difficulty]')].map(b=>({id:b.getAttribute('data-rhythm-difficulty'),locked:b.getAttribute('data-rhythm-difficulty-locked')})));
    check('試作の HELL が選べる(鍵なし)',diff.some(d=>d.id==='HELL'&&d.locked!=='1'),JSON.stringify(diff));
    check('どの難易度にも鍵が無い',diff.length>0&&diff.every(d=>d.locked!=='1'));
    const publicLocks=await page.evaluate(async()=>{
      // 公開曲(まだ HARD をクリアしていない)でも EXPERT・MASTER に鍵が無いか
      const song=RHYTHM_SONGS.find(s=>s.songId==='against_my_own_shadow')||RHYTHM_SONGS.find(s=>RHYTHM_DEMO_SONG_IDS.includes(s.songId));
      const row=[...document.querySelectorAll('[data-rhythm-song-row]')].find(r=>r.textContent.includes(song.displayName));if(row)row.click();
      await new Promise(r=>setTimeout(r,500));
      return [...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-difficulty]')].filter(b=>b.getAttribute('data-rhythm-difficulty-locked')==='1').length;
    });
    check('公開曲でも EXPERT・MASTER に鍵が無い',publicLocks===0,`鍵 ${publicLocks}`);
    // 2026-10-26 社長室「デバッグの曲えらびを本物と同じ画面に」: 本物の曲えらび(RhythmSongSelectScreen)を debugAll で使う。
    //   アシスト・ミラー・オプションがその場で触れる/試作だけに絞れる/デバッグで意味の無いもの(周回・ランキング・ビートP)は出さない
    const same=await page.evaluate(()=>({modes:document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-play-mode-toggle]').length,
      options:!!document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-options]'),realHome:!!document.querySelector('[data-rhythm-demo-home]'),
      extras:document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-demo-ranking],[data-rhythm-debug-select] [data-quick-run-start],[data-rhythm-debug-select] [data-quick-run-start-header],[data-rhythm-debug-select] [data-rhythm-beat-point-balance]').length}));
    check('本物の曲えらびと同じ部品(アシスト・ミラーの切り替えとオプション)がある',same.modes>=2&&same.options,JSON.stringify(same));
    check('本物の曲えらび(体験版)の印とは分けてある',!same.realHome);
    check('デバッグで意味の無いもの(周回の入口・ランキング・ビートP)は出さない',same.extras===0,`${same.extras}件`);
    const filtered=await page.evaluate(async()=>{const b=document.querySelector('[data-rhythm-debug-song-filter-option="proto"]');if(!b)return null;b.click();await new Promise(r=>setTimeout(r,500));
      const proto=document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]').length;
      document.querySelector('[data-rhythm-debug-song-filter-option="all"]')?.click();await new Promise(r=>setTimeout(r,500));
      const label=id=>(document.querySelector(`[data-rhythm-debug-song-filter-option="${id}"]`)?.textContent||'').match(/\((\d+)\)/)?.[1];
      return {proto,protoSongs:RHYTHM_PROTO_SONGS.length,all:document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]').length,protoLabel:+label('proto'),allLabel:+label('all')};});
    check('「試作だけ」に絞ると試作の枠の曲だけになり、「すべての曲」で戻る',!!filtered&&filtered.proto===filtered.protoSongs&&filtered.all>filtered.proto,JSON.stringify(filtered));
    check('切り替えに出す曲の数が、並んでいる行の数と同じ',!!filtered&&filtered.protoLabel===filtered.proto&&filtered.allLabel===filtered.all,JSON.stringify(filtered));
    await selectSong(page,SONG_ID);await page.waitForTimeout(400);
    await page.evaluate(()=>document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="HELL"]')?.click());await page.waitForTimeout(400);

    if(SHOTS){
      fs.mkdirSync(SHOTS,{recursive:true});
      await page.screenshot({path:path.join(SHOTS,'debug-select-landscape-844x390.png')});
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(800);
      await page.screenshot({path:path.join(SHOTS,'debug-select-portrait-390x844.png')});
      await page.evaluate(()=>document.querySelector('[data-rhythm-debug-select] button[aria-label="モンヒロビートのデバッグへ戻る"]')?.click());await page.waitForTimeout(900);
      await page.screenshot({path:path.join(SHOTS,'debug-list-portrait-390x844.png')});
      await page.evaluate(()=>document.querySelector('[data-rhythm-debug-select-open]')?.click());await page.waitForTimeout(900);
      await page.setViewportSize({width:844,height:390});await page.waitForTimeout(800);
      await selectSong(page,SONG_ID);await page.waitForTimeout(300);
      await page.evaluate(()=>document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="HELL"]')?.click());await page.waitForTimeout(300);
    }

    const before=await snapshot(page);
    const started=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-start="HELL"]');if(b)b.click();return !!b;});
    check('横持ちで HELL の演奏を始められる',started);
    await page.waitForFunction(()=>window.__mhTestHooks?.rhythmSongMs?.()>0,{timeout:30000}).catch(()=>{});
    check('演奏が進む',await page.evaluate(()=>window.__mhTestHooks?.rhythmSongMs?.()>0));
    if(QUICK){
      // 頭だけ流して抜ける(中断)。抜けたあと全解放の曲えらびへ戻るかを見る
      await page.waitForTimeout(3000);
      await page.evaluate(()=>document.querySelector('[data-rhythm-pause]')?.click());await page.waitForTimeout(800);
      await page.evaluate(()=>document.querySelector('[data-rhythm-pause-exit]')?.click());await page.waitForTimeout(1200);
      await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/^(やめる|はい|OK|曲えらびへ)/.test(x.textContent.trim()));if(b&&!document.querySelector('[data-rhythm-debug-select]'))b.click();});await page.waitForTimeout(800);
    }else{
      // 最後まで流す(何も押さないので全部 MISS)。結果の画面が出たら閉じる
      const durationMs=await page.evaluate((id)=>{const s=RHYTHM_PROTO_SONGS.find(x=>x.songId===id);return s.difficulties.HELL.durationMs;},SONG_ID);
      await page.waitForFunction((d)=>!window.__mhTestHooks?.rhythmSongMs||window.__mhTestHooks.rhythmSongMs()>=d-200||!document.querySelector('canvas'),durationMs,{timeout:durationMs+60000}).catch(()=>{});
      await page.waitForTimeout(6000);
      for(let i=0;i<10;i++){
        if(await page.locator('[data-rhythm-debug-select]').count())break;
        await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/(へ戻る|^閉じる|^OK|^次へ)$/.test(x.textContent.trim()));if(b)b.click();});
        await page.waitForTimeout(1200);
      }
    }
    await page.waitForTimeout(1500);
    check('演奏のあと全解放の曲えらびへ戻る',await page.locator('[data-rhythm-debug-select]').count()===1,await page.evaluate(()=>document.querySelector('main')?.getAttribute('class')?.slice(0,40)||''));
    const after=await snapshot(page);
    const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]);
    check('演奏の前後で保存値(localStorage)が1つも変わらない',changed.length===0,changed.join(', '));
    check('ランキング・保存の書き込みの通信が0件',writes.length===0,writes.slice(0,5).join(' / '));
    check('ページのエラーが出ない',errors.length===0,errors.slice(0,3).join(' / '));
  }finally{await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);server.close();process.exit(1);});
