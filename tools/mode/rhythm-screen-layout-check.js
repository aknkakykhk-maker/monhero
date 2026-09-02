// 音ゲーの画面(デバッグ / オプション / プレイ)が、それぞれ独立した1画面になっているかを確かめる。
//
// 実際に「プレイ中の画面へ、譜面制作側の固定UI(座標校正ボタン)が浮いたまま重なる」状態を出した。
// 原因は、座標校正のトグルを document.body 直下へ position:fixed で置き、プレイエリアがある間は
// 常に表示していたこと。画面ごとにReactが描くDOMとは別の固定レイヤーが増えるため、
// 「どこが固定されているのか分からない」画面になっていた。
//
// ここでは、
//   ・各画面が「固定ヘッダー + スクロール1つ(+固定フッター)」で閉じていること
//   ・音ゲーのデバッグUIが body 直下へ固定レイヤーを作らないこと
//   ・座標校正のトグルが、その画面自身のUI(デバッグ画面 / ポーズメニュー)の中にあること
// を検査する。
//
//   node tools/mode/rhythm-screen-layout-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');
const calibration=read('monster-hero/data/rhythm-geometry-calibration.js');
const debugFiles=fs.readdirSync(path.join(ROOT,'monster-hero/debug')).filter(name=>name.endsWith('.js'));

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 1. プレイ画面: HUD・プレイエリア・ポーズだけで閉じる
check('プレイ画面は overflow-hidden の1画面で、内側にスクロールを作らない',
  game.includes('<main data-rhythm-tap-test className="flex flex-1 min-h-0 flex-col overflow-hidden')
  &&game.includes('<header data-rhythm-hud className="shrink-0'));
check('プレイ画面はSafe Areaを上下とも自分で持つ',
  game.includes("data-rhythm-tap-test")&&/data-rhythm-tap-test[\s\S]{0,400}paddingTop:'env\(safe-area-inset-top\)',paddingBottom:'env\(safe-area-inset-bottom\)'/.test(game));
check('ポーズ操作はプレイエリアの中のオーバーレイに閉じている',
  game.includes('data-rhythm-pause-menu className="absolute inset-0 z-20'));

// 2. オプション画面: ヘッダー / スクロール / フッターの3層だけ
check('オプション画面は固定ヘッダー+スクロール+固定フッターの3層',
  game.includes('<main data-rhythm-options className="flex flex-1 min-h-0 flex-col overflow-hidden')
  &&game.includes('<div data-rhythm-options-scroll className="flex-1 min-h-0 overflow-y-auto')
  &&game.includes('<footer data-rhythm-options-actions className="z-20 shrink-0'));
check('オプションの操作バーはSafe Areaを避けた画面下固定',
  /data-rhythm-options-actions[\s\S]{0,400}paddingBottom:'calc\(\.5rem \+ env\(safe-area-inset-bottom\)\)'/.test(game));

// 3. デバッグ画面: 画面自体はスクロールせず、本文だけがスクロールする
check('デバッグ画面も固定ヘッダー+スクロール本文の2層',
  game.includes('<main data-rhythm-debug-screen className="flex flex-1 min-h-0 flex-col overflow-hidden')
  &&game.includes('<div data-rhythm-debug className="flex-1 min-h-0 overflow-y-auto'));
check('デバッグ画面のヘッダーはsticky(スクロールに乗る固定)ではなくshrink-0',
  !/data-rhythm-debug-screen[\s\S]{0,600}<header className="sticky/.test(game));
check('譜面制作UIの受け皿はスクロール側なので、ヘッダーの下へ積み上がる',
  game.includes('data-rhythm-debug className=')&&game.includes('data-rhythm-debug-screen'));

// 4. body直下の固定レイヤーを作らない
check('座標校正のトグルを document.body へ固定配置しない',
  !calibration.includes('document.body.appendChild(button)')&&!/position:'fixed'/.test(calibration));
check('座標校正のトグルはデバッグ画面とポーズメニューの中へ置く',
  calibration.includes("mountToggle(document.querySelector('[data-rhythm-debug]'),'debug')")
  &&calibration.includes("mountToggle(document.querySelector('[data-rhythm-pause-menu]'),'pause')"));
check('プレイエリアがあるだけで固定ボタンを出す作りをやめた',
  !calibration.includes("ensureButton().style.display=area?'':'none'"));
const fixedInDebugUi=debugFiles.filter(name=>{
  const source=read(`monster-hero/debug/${name}`);
  return /position:\s*'?fixed/.test(source)||source.includes('document.body.appendChild')||source.includes('document.body.prepend');
});
check('デバッグ用スクリプトもbody直下へ固定UIを作らない',fixedInDebugUi.length===0,fixedInDebugUi.join(', '));

// 5. 譜面制作UIはデバッグ画面の中にだけ入る
const authoring=read('monster-hero/debug/rhythm-chart-authoring-ui.js');
const offset=read('monster-hero/debug/rhythm-preview-offset.js');
check('譜面エディタは音ゲーデバッグ画面の中にだけ作る',
  authoring.includes("const root=document.querySelector('[data-rhythm-debug]')"));
check('実機タイミング補正は譜面エディタの中にだけ作る',
  offset.includes("const editor=document.querySelector('[data-rhythm-chart-authoring-ui]')")
  &&offset.includes("if(!editor)return false"));
check('実機タイミング補正はプレイ中に再走査しない',
  offset.includes("document.documentElement.dataset.rhythmPlayActive==='true'"));

// 6. 実際にブラウザで動かして、トグルがその画面の中へ入ることを確かめる
const http=require('http');
const PORT=8978;
const MIME={'.html':'text/html','.js':'text/javascript'};
const PAGE=`<!doctype html><html><head><meta charset="utf-8"></head><body>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
<script src="/monster-hero/data/rhythm-geometry-calibration.js"><\/script>
</body></html>`;
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
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{
    console.log('（playwright が無いので実ブラウザ確認はスキップしました）');
    console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
    process.exit(failed?1:0);
  }}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/calibration-probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/calibration-probe.html`,{waitUntil:'networkidle'});
    check('座標校正スクリプトを読み込んでもエラーにならない',errors.length===0,errors[0]||'');

    const beforeAnyScreen=await page.evaluate(()=>document.querySelectorAll('[data-rhythm-calibration-toggle]').length);
    check('どの音ゲー画面も無い間はトグルを作らない',beforeAnyScreen===0,`${beforeAnyScreen}個`);

    const debugState=await page.evaluate(async()=>{
      const screen=document.createElement('div');
      screen.dataset.rhythmDebug='';
      document.body.appendChild(screen);
      await new Promise(resolve=>setTimeout(resolve,120));
      const toggle=screen.querySelector('[data-rhythm-calibration-toggle]');
      return {
        inside:!!toggle,
        position:toggle?getComputedStyle(toggle).position:null,
        outside:document.querySelectorAll('body > [data-rhythm-calibration-toggle]').length,
        label:toggle?toggle.textContent:null
      };
    });
    check('デバッグ画面が出るとトグルがその中へ入る',debugState.inside,debugState.label||'');
    check('トグルは固定配置ではなく通常フロー',debugState.position==='static'||debugState.position==='relative',String(debugState.position));
    check('body直下へ固定レイヤーを作らない',debugState.outside===0,`${debugState.outside}個`);

    const toggled=await page.evaluate(async()=>{
      const toggle=document.querySelector('[data-rhythm-calibration-toggle]');
      toggle.click();
      await new Promise(resolve=>setTimeout(resolve,60));
      return {label:toggle.textContent,pressed:toggle.getAttribute('aria-pressed')};
    });
    check('トグルを押すとONへ切り替わる',toggled.label==='座標校正 ON'&&toggled.pressed==='true',`${toggled.label} / aria-pressed=${toggled.pressed}`);

    const pauseState=await page.evaluate(async()=>{
      document.querySelector('[data-rhythm-debug]').remove();
      const play=document.createElement('div');
      play.dataset.rhythmPlayArea='';
      document.body.appendChild(play);
      await new Promise(resolve=>setTimeout(resolve,120));
      const duringPlay=document.querySelectorAll('[data-rhythm-calibration-toggle]').length;
      const pause=document.createElement('div');
      pause.dataset.rhythmPauseMenu='';
      play.appendChild(pause);
      await new Promise(resolve=>setTimeout(resolve,120));
      const toggle=pause.querySelector('[data-rhythm-calibration-toggle]');
      return {duringPlay,inPause:!!toggle,label:toggle?toggle.textContent:null,
        outside:document.querySelectorAll('body > [data-rhythm-calibration-toggle]').length};
    });
    check('プレイ中はトグルを画面へ浮かせない',pauseState.duringPlay===0,`${pauseState.duringPlay}個`);
    check('ポーズメニューを開くとその中にトグルが出る',pauseState.inPause);
    check('プレイ中もbody直下へ固定レイヤーを作らない',pauseState.outside===0,`${pauseState.outside}個`);
    check('ON/OFFの状態は画面をまたいで保持する',pauseState.label==='座標校正 ON',pauseState.label||'');
  }finally{
    await browser?.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
