#!/usr/bin/env node
// 曲えらび(曲選択画面)を、実際のブラウザで動かして確かめる。
//
//   node tools/mode/rhythm-song-select-check.js
//
// 【なぜ要るか】
// この画面は「一覧で曲をえらぶ → 難易度をえらぶ → 決定」の3手でできている。
// ソースを文字で見るだけでは「選んだつもりが変わっていない」類の不具合を拾えない。
// 実際に本物のReactで組み立てて、押したときに中身が変わることまで見る。
//
// このサンドボックスはTailwindのCDNへ出られないので見た目は崩れるが、
// DOMの構造と押したときの動きはそのまま観測できる。
const http=require('http');
const path=require('path');
const fs=require('fs');

const ROOT=path.resolve(__dirname,'..','..');
const PORT=8981;
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
    await page.route('**cdn.tailwindcss.com**',route=>route.abort());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(6000);

    // 曲えらびだけを本物のReactで組み立てる。曲はデバッグ用も含めた全部を渡して、
    // 「曲が増えたとき」の並びも同時に見る。
    const mounted=await page.evaluate(()=>{
      const host=document.createElement('div');
      host.id='song-select-probe';
      host.style.cssText='position:fixed;inset:0;z-index:99999;background:#020617';
      document.body.appendChild(host);
      window.__picked=null;
      const root=ReactDOM.createRoot(host);
      root.render(React.createElement(RhythmSongSelect,{
        songs:RHYTHM_SONGS,
        difficulties:RHYTHM_DIFFICULTIES,
        difficultyLabels:RHYTHM_DEMO_DIFFICULTY_LABELS,
        bestRecords:[],
        onPlay:(song,difficulty)=>{window.__picked=`${song.songId}/${difficulty.id}`;},
      }));
      return true;
    });
    await page.waitForTimeout(600);
    ok('曲えらびを組み立てられる',mounted===true);

    const shape=await page.evaluate(()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      // スクロールの数は「クラス名」で数える。このサンドボックスはTailwindを読めないので
      // 実際のoverflowは効かず、getComputedStyleで数えると必ず0になってしまう。
      const scrolls=[...host.querySelectorAll('*')]
        .filter(el=>String(el.className||'').split(/\s+/).includes('overflow-y-auto'));
      return {
        rows:rows.length,
        rowIds:rows.map(row=>row.getAttribute('data-rhythm-song-row')),
        levels:rows.map(row=>(row.querySelector('[data-rhythm-song-row-level]')||{}).textContent||''),
        arts:host.querySelectorAll('[data-rhythm-song-art]').length,
        hasList:!!host.querySelector('[data-rhythm-song-list]'),
        hasDetail:!!host.querySelector('[data-rhythm-song-detail]'),
        scrolls:scrolls.length,
        difficulties:[...host.querySelectorAll('[data-rhythm-difficulty]')].map(el=>el.getAttribute('data-rhythm-difficulty')),
        level:(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'',
        best:(host.querySelector('[data-rhythm-demo-best]')||{}).textContent||'',
        start:!!host.querySelector('[data-rhythm-demo-start]'),
        random:!!host.querySelector('[data-rhythm-song-random]'),
      };
    });
    ok('曲が一覧に並ぶ',shape.rows>=2,`${shape.rows}曲`);
    ok('1行ごとに「楽曲Lv.」の数字が出る',shape.levels.every(text=>/^\d+$/.test(text.trim())),
      shape.levels.slice(0,4).join(' / '));
    ok('曲ごとに絵(ジャケット)がある',shape.arts>=shape.rows+1,`${shape.arts}枚（一覧${shape.rows}＋選択中1）`);
    ok('一覧と、選んでいる曲の欄が分かれている',shape.hasList&&shape.hasDetail);
    ok('スクロールするのは一覧の1か所だけ',shape.scrolls===1,`${shape.scrolls}か所`);
    ok('難易度ボタンが出る',shape.difficulties.length>=1,shape.difficulties.join('/'));
    ok('選んでいる難易度のレベルとノーツ数が出る',/Lv\.\d+ \/ \d+ノーツ/.test(shape.level),shape.level.trim());
    ok('自己ベストの欄がある（未プレイなら「まだ遊んでいません」）',/まだ遊んでいません/.test(shape.best),shape.best.trim());
    ok('決定とランダムのボタンがある',shape.start&&shape.random);

    // 曲を選び直すと、選んでいる曲の欄が変わる
    const switched=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      const before=(host.querySelector('[data-rhythm-song-title]')||{}).textContent||'';
      rows[rows.length-1].click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const after=(host.querySelector('[data-rhythm-song-title]')||{}).textContent||'';
      return {before,after,pressed:rows[rows.length-1].getAttribute('aria-pressed')};
    });
    ok('別の曲を押すと選んでいる曲が変わる',switched.before!==switched.after&&switched.pressed==='true',
      `${switched.before} → ${switched.after}`);

    // 難易度を選び直すと、レベルの表示が変わる。
    // 難易度が1つしかない曲では確かめようが無いので、いちばん多い曲へ戻してから見る。
    const changed=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      const rows=[...host.querySelectorAll('[data-rhythm-song-row]')];
      let best=rows[0],bestCount=-1;
      for(const row of rows){
        row.click();
        await new Promise(resolve=>setTimeout(resolve,60));
        const count=host.querySelectorAll('[data-rhythm-difficulty]').length;
        if(count>bestCount){bestCount=count;best=row;}
      }
      best.click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const buttons=[...host.querySelectorAll('[data-rhythm-difficulty]')];
      const before=(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'';
      buttons[buttons.length-1].click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const after=(host.querySelector('[data-rhythm-demo-level]')||{}).textContent||'';
      const start=host.querySelector('[data-rhythm-demo-start]');
      return {before,after,count:buttons.length,
        startId:start?start.getAttribute('data-rhythm-demo-start'):'',
        pickedId:buttons[buttons.length-1].getAttribute('data-rhythm-difficulty')};
    });
    ok('難易度を押すとレベルの表示が変わる',changed.count>=2&&changed.before!==changed.after,
      `${changed.before.trim()} → ${changed.after.trim()}`);
    ok('決定は、いま選んでいる難易度をそのまま始める',changed.startId===changed.pickedId,
      `決定=${changed.startId} / 選択=${changed.pickedId}`);

    // 決定を押すと、選んだ曲と難易度がそのまま渡る
    const picked=await page.evaluate(async()=>{
      const host=document.getElementById('song-select-probe');
      host.querySelector('[data-rhythm-demo-start]').click();
      await new Promise(resolve=>setTimeout(resolve,150));
      const row=host.querySelector('[data-rhythm-song-row][aria-pressed="true"]');
      return {picked:window.__picked,songId:row?row.getAttribute('data-rhythm-song-row'):''};
    });
    ok('決定を押すと、選んだ曲と難易度で始まる',
      typeof picked.picked==='string'&&picked.picked.startsWith(`${picked.songId}/`),String(picked.picked));

    ok('実行時エラーが出ていない',errors.length===0,errors.slice(0,2).join(' / '));
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
