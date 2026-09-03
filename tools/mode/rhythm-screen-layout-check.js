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
const rhythmData=read('monster-hero/data/rhythm-mode.js');
const debugFiles=fs.readdirSync(path.join(ROOT,'monster-hero/debug')).filter(name=>name.endsWith('.js'));

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 1. プレイ画面: HUD・プレイエリア・ポーズだけで閉じる
check('プレイ画面は overflow-hidden の1画面で、内側にスクロールを作らない',
  game.includes('<main data-rhythm-tap-test className="relative flex flex-1 min-h-0 flex-col overflow-hidden'));
// HUD(<header data-rhythm-hud>)は台形に重ねる絶対配置ではなく、画面上部の薄い帯として
// 通常のflowに置く(2026-09-03)。以前は台形の外側ウェッジ(HUD本文を左右の空きだけに収める形)
// だったが、台形の上端を狭く保つ必要があり「レーンが上まで見えない」原因になっていたため、
// 実領域を持つ薄い帯へ変更した。台形の頂点(中央)に重ねる背景パネルは持たせない
// (PR #983は全幅の背景パネルを敷いてしまい、台形の頂点そのものを覆って遠近感を変えてしまった)。
check('HUDはプレイエリアへ重ねる絶対配置ではなく、上の薄い帯として通常のflowに置く',
  !/<header data-rhythm-hud className="[^"]*\babsolute\b/.test(game)
  &&game.includes('<header data-rhythm-hud className="relative z-10 shrink-0 px-3 pt-1 pb-1"')
  &&!/data-rhythm-hud[\s\S]{0,50}background:/.test(game));
// 曲名を truncate で切ると、実機で「あつ杯テー…」となって曲が分からなくなる
check('曲名は truncate で切らずに折り返す',
  /data-rhythm-hud-song className="(?![^"]*truncate)/.test(game)
  &&/data-rhythm-hud-song[\s\S]{0,260}WebkitLineClamp/.test(game));
check('ポーズボタンはタップ精度を落とさない44px以上を確保する',
  /data-rhythm-pause aria-label="ポーズ" className="[^"]*min-h-\[44px\][^"]*min-w-\[44px\]/.test(game));
// Safe Areaは index.html の body が padding で確保済み(body{height:100dvh;box-sizing:border-box;
// padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)})。
// プレイ画面側で上下のenv()をもう一度足すと二重・三重掛けになり、実機の上部に大きな空白ができる
// (実際にそうなっていて「上のスペースが広いまま」と指摘された)。ここで足し直さないことを固定する。
// (index.htmlのbodyが確保しているのは上下だけで、左右は確保していない。横画面のノッチ回避で
// 左右を足すのは二重掛けにならないので、下の別チェックで許可している)
check('プレイ画面はSafe Areaの上下を二重に足さない(bodyがすでに確保している)',
  game.includes("data-rhythm-tap-test")
  &&!/data-rhythm-tap-test[\s\S]{0,400}env\(safe-area-inset-(top|bottom)\)/.test(game)
  &&!/data-rhythm-hud[\s\S]{0,300}env\(safe-area-inset-(top|bottom)\)/.test(game));
// 横画面(landscape)では端末のノッチ/センサーハウジングが画面の左右どちらかへ来る。
// bodyは上下しか確保していないので、プレイ画面自身が左右のSafe Areaを確保する必要がある。
// env(safe-area-inset-left/right)は、ノッチが無い側では0になるので両方へ足しても二重掛けにならない。
check('横画面ではプレイ画面自身が左右のSafe Area(ノッチ)を確保する',
  /data-rhythm-tap-test[\s\S]{0,400}landscape:pl-\[env\(safe-area-inset-left\)\]/.test(game)
  &&/data-rhythm-tap-test[\s\S]{0,400}landscape:pr-\[env\(safe-area-inset-right\)\]/.test(game));
// HUDの中身を書き換えるスクリプトは、並び順ではなく目印(data-*)で対象を探すこと。
// 以前 rhythm-mode.js が「HUDの最初の<small>」を 'MIX TEST' へ書き換えており、
// HUDの並びを変えたらBEST行が'MIX TEST'に化けた(実機で発覚)。
check('MIX TEST表記は位置ではなく目印(data-rhythm-mode-label)で書き換える',
  game.includes('<small data-rhythm-mode-label ')
  &&rhythmData.includes("document.querySelector('[data-rhythm-mode-label]')")
  &&!/previousElementSibling\?\.querySelector\?\('small'\)/.test(rhythmData));

// ポーズ中はHUD(z-30)より前に出す。逆にするとポーズメニューの上にスコアが浮く。
check('ポーズ操作はプレイエリアの中のオーバーレイに閉じ、HUDより前に出る',
  game.includes('data-rhythm-pause-menu className="absolute inset-0 z-40'));

// 2. オプション画面: ヘッダー / スクロール / フッターの3層だけ
check('オプション画面は固定ヘッダー+スクロール+固定フッターの3層',
  game.includes('<main data-rhythm-options className="flex flex-1 min-h-0 flex-col overflow-hidden')
  &&game.includes('<div data-rhythm-options-scroll className="flex-1 min-h-0 overflow-y-auto')
  &&game.includes('<footer data-rhythm-options-actions className="z-20 shrink-0'));
check('オプションの操作バーはSafe Areaを避けた画面下固定',
  /data-rhythm-options-actions[\s\S]{0,400}paddingBottom:'calc\(\.5rem \+ env\(safe-area-inset-bottom\)\)'/.test(game));

// 3. デバッグ画面: 画面自体はスクロールせず、タブで内容を分ける
check('デバッグ画面は固定ヘッダー+固定タブ+スクロール本文',
  game.includes('<main data-rhythm-debug-screen className="flex flex-1 min-h-0 flex-col overflow-hidden')
  &&game.includes('<nav data-rhythm-debug-tabs')
  &&/data-rhythm-debug-tabs[\s\S]{0,200}className="grid shrink-0 grid-cols-3/.test(game));
check('デバッグ画面のヘッダーはsticky(スクロールに乗る固定)ではなくshrink-0',
  !/data-rhythm-debug-screen[\s\S]{0,600}<header className="sticky/.test(game));
check('タブはプレイ・譜面制作・設定の3つ',
  game.includes("[['play','▶ プレイ'],['chart','🎼 譜面制作'],['settings','⚙️ 設定・記録']]"));
check('入場時は必ずプレイタブから始まる',
  game.includes("const [rhythmDebugTab,setRhythmDebugTab]=useState('play')")
  &&game.includes("setRhythmDebugTab('play'); setGameState('RHYTHM_DEBUG')"));
check('譜面制作UIは初回入場では作らず、開いた後は表示だけ切り替える',
  game.includes("if(id==='chart')setRhythmChartToolsOpened(true)")
  &&game.includes('{rhythmChartToolsOpened&&<div data-rhythm-debug hidden={rhythmDebugTab!==\'chart\'}/>}'));
check('スクロール領域はタブ本文の1つだけ',
  (game.match(/data-rhythm-debug-screen[\s\S]{0,2000}?overflow-y-auto/g)||[]).length===1);

// 4. body直下の固定レイヤーを作らない
check('座標校正のトグルを document.body へ固定配置しない',
  !calibration.includes('document.body.appendChild(button)')&&!/position:'fixed'/.test(calibration));
check('座標校正のトグルは設定タブとポーズメニューの中へ置く',
  calibration.includes("mountToggle(document.querySelector('[data-rhythm-debug-calibration]'),'debug')")
  &&calibration.includes("mountToggle(document.querySelector('[data-rhythm-pause-menu]'),'pause')")
  &&game.includes('<div data-rhythm-debug-calibration'));
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
      screen.dataset.rhythmDebugCalibration='';
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
    check('設定タブが出るとトグルがその中へ入る',debugState.inside,debugState.label||'');
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
      document.querySelector('[data-rhythm-debug-calibration]').remove();
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
