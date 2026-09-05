#!/usr/bin/env node
// ポーズの3ボタン(再開・リスタート・中断して戻る)が、iPhone Safari と同じ
// 「touchend が先に来て、そのあと click が来る」順番でも必ず働くかを確かめる。
//
// なぜ実際に動かすのか:
//   data/rhythm-result-replay-remount.js は以前ボタンの「文言」でどのボタンかを
//   見分けていた。ポーズの文言を「中断して音ゲーデバッグへ戻る」から
//   「曲えらびへ戻る」「練習をやめて曲えらびへ戻る」へ変えたとき、見分けが外れて
//   iPhone では戻るを押しても何も起きなくなった(2026-09-05・実機の指摘)。
//   しかも見分けから外れたボタンは、touchend で印だけ付けられ、そのあとの本物の
//   click が「橋渡し済みのghost click」と取り違えられて潰されるため、
//   「反応しない」ではなく「完全に無反応」になっていた。
//   文字列の一致を見る検査ではこれを拾えなかったので、本物のReactとブラウザの
//   イベントで、押した結果 onClick が呼ばれるところまでを見る。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..'),SITE=path.join(ROOT,'monster-hero'),PORT=8991;
const {chromium}=require(path.join(ROOT,'tools','node_modules','playwright-core'));

const TYPES={'.js':'text/javascript','.html':'text/html; charset=utf-8'};
const page=`<!doctype html><meta charset="utf-8"><div id="root"></div>
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="/data/rhythm-result-replay-remount.js"></script>
<script>
window.RHYTHM_GESTURE_RUNTIME={clear(){window.__cleared=(window.__cleared||0)+1;}};
window.__calls=[];
const e=React.createElement;
// 本体のポーズメニューと同じ形。文言はわざと本体と変えてあり、
// 「文言が変わっても見分けられるか」をここで確かめる。
function RhythmTapTest(){
  const [n,setN]=React.useState(0);
  React.useEffect(()=>{window.__mounts=(window.__mounts||0)+1;},[]);
  return e('div',{'data-rhythm-play-area':''},
    e('div',{'data-rhythm-pause-menu':''},
      e('button',{'data-rhythm-pause-resume':'',onClick:()=>window.__calls.push('resume')},'つづける'),
      e('button',{'data-rhythm-pause-restart':'',onClick:()=>window.__calls.push('restart')},'やりなおす'),
      e('button',{'data-rhythm-pause-exit':'',onClick:()=>window.__calls.push('exit')},'ぬける'),
      // 見分けの対象ではないボタン。押したら必ず onClick が呼ばれること(=無反応にならない)
      e('button',{'data-test-other':'',onClick:()=>window.__calls.push('other')},'なにか別のもの')));
}
ReactDOM.createRoot(document.getElementById('root')).render(e(RhythmTapTest,null));
// iPhone Safari と同じ順番(touchend → click)で押す
window.__tap=(selector)=>{
  const el=document.querySelector(selector);
  const t=new TouchEvent('touchend',{bubbles:true,cancelable:true});
  el.dispatchEvent(t);
  el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
};
</script>`;

const server=http.createServer((req,res)=>{
  const url=req.url.split('?')[0];
  if(url==='/'||url==='/index.html'){res.writeHead(200,{'content-type':TYPES['.html']});return res.end(page);}
  const file=path.join(SITE,url.replace(/^\//,''));
  if(!file.startsWith(SITE)||!fs.existsSync(file)){res.writeHead(404);return res.end('');}
  res.writeHead(200,{'content-type':TYPES[path.extname(file)]||'text/plain'});
  res.end(fs.readFileSync(file));
});

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

(async()=>{
  await new Promise(resolve=>server.listen(PORT,resolve));
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await browser.newContext({hasTouch:true});
  const p=await ctx.newPage();
  const errors=[];
  p.on('pageerror',err=>errors.push(String(err)));
  await p.goto(`http://127.0.0.1:${PORT}/`,{waitUntil:'load'});
  await p.waitForFunction('window.__mounts>0');

  check('橋渡しが読み込めて画面が出ている',errors.length===0,errors.join(' / ')||'エラーなし');

  const tap=async sel=>{await p.evaluate(s=>window.__tap(s),sel);await p.waitForTimeout(30);};
  const calls=async()=>p.evaluate(()=>window.__calls.slice());

  await tap('[data-rhythm-pause-resume]');
  check('再開: touchend→click でも onClick が1回だけ呼ばれる',JSON.stringify(await calls())===JSON.stringify(['resume']),JSON.stringify(await calls()));

  await p.evaluate(()=>{window.__calls.length=0;});
  const mountsBefore=await p.evaluate(()=>window.__mounts);
  await tap('[data-rhythm-pause-restart]');
  const mountsAfter=await p.evaluate(()=>window.__mounts);
  check('リスタート: 旧runを捨てて作り直す',mountsAfter===mountsBefore+1&&(await p.evaluate(()=>window.__cleared))>0,`再マウント ${mountsBefore}→${mountsAfter}`);

  await p.evaluate(()=>{window.__calls.length=0;});
  await tap('[data-rhythm-pause-exit]');
  check('中断して戻る: 文言を変えても onClick が1回だけ呼ばれる',JSON.stringify(await calls())===JSON.stringify(['exit']),JSON.stringify(await calls()));

  await p.evaluate(()=>{window.__calls.length=0;});
  await tap('[data-test-other]');
  check('見分けの対象でないボタンも無反応にならない',JSON.stringify(await calls())===JSON.stringify(['other']),JSON.stringify(await calls()));

  await browser.close();
  server.close();
  console.log('');
  if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
  console.log('すべてOK');
})().catch(err=>{console.error(err);server.close();process.exit(1);});
