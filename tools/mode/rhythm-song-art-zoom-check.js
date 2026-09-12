#!/usr/bin/env node
// 曲えらびのジャケットを押すと、大きい絵が出るか。
//
//   node tools/mode/rhythm-song-art-zoom-check.js
//
// 【なぜ要るか】(2026-09-08・ユーザー指示「モンビー中のジャケットをタップすると
//  拡大画像が見れるようにもして」)
// 曲えらびのジャケットは 48〜64px しかなく、絵の中身までは分からない。
// 押したら大きく見られるようにしたが、この手のものは
//   ・一覧の行のジャケットまで押せるようにしてしまい、曲が選べなくなる
//     (行そのものがボタンなので、中にボタンを置くと押し分けられない)
//   ・閉じられなくなる
//   ・曲えらびの状態(選んでいる曲・難易度)まで巻き添えで変わる
// のどれかを起こしやすい。実際にブラウザで押して確かめる。
//
// このサンドボックスはTailwindのCDNへ出られないので見た目は崩れるが、
// DOMの構造と押したときの動きはそのまま観測できる。
const http=require('http');
const path=require('path');
const fs=require('fs');

const ROOT=path.resolve(__dirname,'..','..');
const PORT=8983;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
    const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT,()=>resolve(server));
});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(6000);

    const mounted=await page.evaluate(()=>{
      const host=document.createElement('div');
      host.id='art-zoom-probe';
      host.style.cssText='position:fixed;inset:0;z-index:99999;background:#020617';
      document.body.appendChild(host);
      const root=ReactDOM.createRoot(host);
      const Host=()=>{
        const [songId,setSongId]=React.useState('');
        const [difficultyId,setDifficultyId]=React.useState('');
        const [view,setView]=React.useState(DEFAULT_RHYTHM_SELECT_VIEW);
        window.__songId=songId;window.__difficultyId=difficultyId;
        return React.createElement(RhythmSongSelect,{
          // 本物の画面と同じ「公開中の曲」を渡す。RHYTHM_SONGS をそのまま渡すと
          // 先頭がデバッグ曲(絵なし)になり、実画面とは違うものを見ることになる。
          songs:rhythmDemoSongs(RHYTHM_SONGS),difficulties:RHYTHM_DIFFICULTIES,bestRecords:[],
          songId,difficultyId,onSongId:setSongId,onDifficultyId:setDifficultyId,
          view,onView:setView,onPlay:()=>{},
        });
      };
      root.render(React.createElement(Host));
      return true;
    });
    await page.waitForTimeout(600);
    ok('曲えらびを組み立てられる',mounted===true);

    const sel='#art-zoom-probe';
    // Tailwindが読めないサンドボックスでは実際の配置が崩れ、要素が画面の外に出る。
    // page.click は「画面の中にあること」を求めるので、ここではイベントを直接起こす。
    // 見た目ではなく「押したときに何が起きるか」を見たいので、これで用は足りる。
    const tap=selector=>page.evaluate(target=>{
      const el=document.querySelector(target);
      if(!el)throw new Error('見つからない: '+target);
      el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    },selector);
    const shape=await page.evaluate(root=>{
      const host=document.querySelector(root);
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      const zooms=[...host.querySelectorAll('[data-rhythm-song-art-zoom]')];
      return {
        rows:rows.length,
        arts:host.querySelectorAll('[data-rhythm-song-art]').length,
        zooms:zooms.length,
        // 一覧の行(ボタン)の中に「押せるジャケット」が入っていないこと
        zoomInsideRow:zooms.filter(el=>el.closest('[data-rhythm-song-row]')).length,
        detailZoom:!!host.querySelector('[data-rhythm-song-detail] [data-rhythm-song-art-zoom]'),
        open:!!host.querySelector('[data-rhythm-song-art-modal]'),
        label:(zooms[0]||{}).ariaLabel||(zooms[0]&&zooms[0].getAttribute('aria-label'))||'',
      };
    },sel);
    ok('一覧に曲が並ぶ',shape.rows>=2,`${shape.rows}曲`);
    ok('ジャケットの枚数は変わっていない（一覧＋選択中）',shape.arts>=shape.rows+1,`${shape.arts}枚`);
    ok('押せるジャケットは「選んでいる曲」の1枚だけ',shape.zooms===1,`${shape.zooms}枚`);
    ok('一覧の行の中に押せるジャケットを置いていない',shape.zoomInsideRow===0,`${shape.zoomInsideRow}枚`);
    ok('押せるジャケットは選んでいる曲の欄にある',shape.detailZoom===true);
    ok('押す前は大きい絵が出ていない',shape.open===false);
    ok('押せるジャケットに読み上げ用の説明がある',/ジャケット/.test(shape.label),shape.label);

    // --- 押して開く ---
    const before=await page.evaluate(()=>({song:window.__songId,difficulty:window.__difficultyId}));
    await tap(`${sel} [data-rhythm-song-art-zoom]`);
    await page.waitForTimeout(300);
    const opened=await page.evaluate(root=>{
      const host=document.querySelector(root);
      const modal=host.querySelector('[data-rhythm-song-art-modal]');
      if(!modal)return {open:false};
      const img=modal.querySelector('img');
      const rect=img?img.getBoundingClientRect():null;
      const small=host.querySelector('[data-rhythm-song-art-zoom] img');
      const smallRect=small?small.getBoundingClientRect():null;
      return {
        open:true,
        role:modal.getAttribute('role'),
        modalAttr:modal.getAttribute('aria-modal'),
        hasClose:!!modal.querySelector('[data-rhythm-song-art-close]'),
        src:img?img.getAttribute('src'):'',
        alt:img?img.getAttribute('alt'):'',
        width:rect?Math.round(rect.width):0,
        smallWidth:smallRect?Math.round(smallRect.width):0,
        complete:img?(img.complete&&img.naturalWidth>0):false,
        natural:img?img.naturalWidth:0,
        height:rect?Math.round(rect.height):0,
        viewport:window.innerWidth,viewportH:window.innerHeight,
      };
    },sel);
    ok('ジャケットを押すと大きい絵が出る',opened.open===true);
    ok('大きい絵は本物の画像を指している',/\.(jpg|jpeg|png|webp)/i.test(opened.src||''),opened.src);
    ok('大きい絵が実際に読み込めている',opened.complete===true,`元の大きさ ${opened.natural}px`);
    // 「小さいジャケットの何倍か」では測れない。このサンドボックスはTailwindを読めないので
    // 小さいほうが原寸(512px)のまま描かれ、実機(64〜144px)とはまるで違う大きさになる。
    // かわりに「画面の幅をどれだけ使っているか」を見る。ここは実機でも同じ値になる。
    ok('大きい絵が画面の幅いっぱいに出る',opened.width>=opened.viewport*0.8,
      `${opened.width}px / 画面 ${opened.viewport}px`);
    ok('大きい絵が画面からはみ出さない',opened.width<=opened.viewport&&opened.height<=opened.viewportH,
      `${opened.width}×${opened.height}px / 画面 ${opened.viewport}×${opened.viewportH}px`);
    ok('読み上げに対応している（dialog / aria-modal / 代替テキスト）',
      opened.role==='dialog'&&opened.modalAttr==='true'&&/ジャケット/.test(opened.alt||''));
    ok('とじるボタンがある',opened.hasClose===true);

    const during=await page.evaluate(()=>({song:window.__songId,difficulty:window.__difficultyId}));
    ok('大きい絵を出しても、選んでいる曲と難易度は変わらない',
      during.song===before.song&&during.difficulty===before.difficulty,
      `${before.song||'(既定)'}/${before.difficulty||'(既定)'} → ${during.song||'(既定)'}/${during.difficulty||'(既定)'}`);

    // --- とじるボタンで閉じる ---
    await tap(`${sel} [data-rhythm-song-art-close]`);
    await page.waitForTimeout(300);
    ok('「とじる」で閉じられる',
      await page.evaluate(root=>!document.querySelector(root).querySelector('[data-rhythm-song-art-modal]'),sel));

    // --- 背景を押しても閉じる ---
    await tap(`${sel} [data-rhythm-song-art-zoom]`);
    await page.waitForTimeout(300);
    await page.evaluate(root=>{
      const modal=document.querySelector(root).querySelector('[data-rhythm-song-art-modal]');
      modal.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    },sel);
    await page.waitForTimeout(300);
    ok('背景を押しても閉じられる',
      await page.evaluate(root=>!document.querySelector(root).querySelector('[data-rhythm-song-art-modal]'),sel));

    // --- 絵そのものを押しても閉じない(見ている最中に消えない) ---
    await tap(`${sel} [data-rhythm-song-art-zoom]`);
    await page.waitForTimeout(300);
    await tap(`${sel} [data-rhythm-song-art-modal] img`);
    await page.waitForTimeout(300);
    ok('絵そのものを押しても閉じない',
      await page.evaluate(root=>!!document.querySelector(root).querySelector('[data-rhythm-song-art-modal]'),sel));

    // --- 曲を変えても壊れない ---
    await tap(`${sel} [data-rhythm-song-art-close]`);
    await page.waitForTimeout(200);
    const rowIds=await page.evaluate(root=>[...document.querySelector(root)
      .querySelectorAll('[data-rhythm-song-row]')].map(el=>el.getAttribute('data-rhythm-song-row')),sel);
    if(rowIds.length>=2){
      await tap(`${sel} [data-rhythm-song-row="${rowIds[1]}"]`);
      await page.waitForTimeout(300);
      await tap(`${sel} [data-rhythm-song-art-zoom]`);
      await page.waitForTimeout(400);
      const second=await page.evaluate(root=>{
        const modal=document.querySelector(root).querySelector('[data-rhythm-song-art-modal]');
        const img=modal&&modal.querySelector('img');
        return {open:!!modal,src:img?img.getAttribute('src'):'',complete:img?(img.complete&&img.naturalWidth>0):false};
      },sel);
      ok('別の曲を選んでも、その曲の絵が出る',second.open&&second.complete,second.src);
    }

    ok('実行時エラーが出ていない',errors.length===0,errors.slice(0,2).join(' / '));
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
