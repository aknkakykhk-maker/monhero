#!/usr/bin/env node
// 本番の index.html を開いて実際に演奏させ、そのあいだの「フレームの詰まり」を測る。
// **報告だけの道具**(しきい値で落とさないので -check.js ではなく -report.js)。
//
//   node tools/mode/rhythm-live-frame-report.js            # いまの配信CSSで測る
//   node tools/mode/rhythm-live-frame-report.js --compare  # 配信CSS と JIT相当 を続けて測って並べる
//   node tools/mode/rhythm-live-frame-report.js --seconds 8
//   node tools/mode/rhythm-live-frame-report.js --compare --cpu 4   # CPUを1/4に絞って測る
//   node tools/mode/rhythm-live-frame-report.js --cpu 4 --inject-css monster-hero/tailwind.css
//       … 静的CSSへ切り替える前の古いコミットを、同じCSS条件で測るとき
//
// 【なぜ要るか】
// 既存の2本(rhythm-render-cost-check / rhythm-canvas-render-check)は、本体と同じ形の
// ノーツを**自前の小さなページ**へ置いて測っている。手早く回せる代わりに、
// 本番の index.html が読むCSS(monster-hero/tailwind.css・111KB)が当たっていない。
// だから「CSSの当たり方が変わって重くなったのか」は、この2本では分からない。
//
// ここでは本番の index.html をそのまま開き、曲えらびから演奏まで進めて、
//   ・1フレームの間隔(rAF のタイムスタンプの差)
//   ・16.7ms / 33.3ms を超えたフレームの数(カクつきとして感じる回数)
//   ・スタイル再計算・レイアウトにかかった時間(CDP の Performance.getMetrics)
//   ・長いタスク(50ms以上・画面が固まる原因)
// を測る。
//
// 【--compare が見ているもの】
// 2026-09-12に Tailwind を CDN から静的CSSへ切り替えた。以前の Play CDN は
// **画面に出ているクラスだけ**のCSSをブラウザの中で作っていたのに対し、
// いまはソース中の全クラスが最初から入っている。ルールが増えると1要素あたりの
// 照合が増えるので、スタイル再計算が重くなりうる。
// そこで、演奏画面に実際に出ているクラス名だけを集めてCSSを作り直し(=JIT相当)、
// 同じ手順で測って並べる。差が出なければ、切り替えはカクつきの原因ではない。
//
// 【この環境の数字の読み方】
// ヘッドレスのChromiumなので、絶対値は実機と違う。**同じ条件で2つを比べるため**の道具。
const fs=require('fs'),path=require('path'),http=require('http'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..'),PORT=8993;
const SECONDS=Number((process.argv.find(a=>a.startsWith('--seconds='))||'').slice(10))||Number(process.argv[process.argv.indexOf('--seconds')+1])||6;
const COMPARE=process.argv.includes('--compare');
// 実機のスマホはこの環境より数倍遅い。余裕があるままだと差が埋もれるので、CPUを絞って測れるようにする
const CPU=Number(process.argv[process.argv.indexOf('--cpu')+1])||1;
// canvas への描き込みの内訳(1フレームあたり何回 drawImage しているか)も数える。
// 計測そのものが少し重くなるので、既定はOFF
const DRAW=process.argv.includes('--draw');
// 静的CSSへ切り替える前(2026-09-12より古い)のコミットを測るとき用。
// index.html が読む cdn.tailwindcss.com を、指定したCSSを流し込むスクリプトで置き換える。
// これを使わないと、古いコミットは「CSSがまったく当たっていない状態」で測ることになり、
// 新しいコミットと同じ土俵にならない
const INJECT=(()=>{const i=process.argv.indexOf('--inject-css');return i>=0?process.argv[i+1]:null;})();
// 【何回測るか】
// フレーム数(実効fps)は、この環境では同じコミットでも251〜300とばらつく(幅17%)。
// 2回や3回で比べると、ばらつきを「差」と読み違える(実際にやった)。
// --runs N で N 回測り、各指標の**中央値**を出す。
const RUNS=Number(process.argv[process.argv.indexOf('--runs')+1])||1;
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

// 演奏画面に出ているクラス名だけでCSSを作る(以前の Play CDN と同じ考え方)
const buildJitCss=(classNames)=>{
  const bin=path.join(ROOT,'tools','node_modules','.bin','tailwindcss');
  if(!fs.existsSync(bin))return null;
  const dir=path.join(__dirname,'..','.tailwind-build');
  fs.mkdirSync(dir,{recursive:true});
  const src=path.join(dir,'jit-source.txt'),cfg=path.join(dir,'jit-config.js'),inp=path.join(dir,'jit-input.css'),out=path.join(dir,'jit-out.css');
  fs.writeFileSync(src,classNames.join('\n'));
  fs.writeFileSync(cfg,`const plugin=require('tailwindcss/plugin');
module.exports={content:[${JSON.stringify(src)}],theme:{extend:{}},plugins:[
  plugin(function({addVariant}){addVariant('landscape',['@media (orientation: landscape)','&:is([data-mh-view-rotation="true"] *)']);}),
]};\n`);
  fs.writeFileSync(inp,'@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
  execFileSync(bin,['-c',cfg,'-i',inp,'-o',out,'--minify'],{stdio:['ignore','ignore','inherit']});
  return fs.readFileSync(out,'utf8');
};

const stats=(list)=>{
  const s=[...list].sort((a,b)=>a-b);
  const at=q=>s.length?s[Math.min(s.length-1,Math.floor(s.length*q))]:0;
  return {n:s.length,median:at(.5),p95:at(.95),max:s.length?s[s.length-1]:0,
    over16:list.filter(v=>v>16.7).length,over33:list.filter(v=>v>33.3).length};
};

const run=async(chromium,{css,label})=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
    if(css!=null)await page.route('**/tailwind.css*',r=>r.fulfill({status:200,contentType:'text/css',body:css}));
    if(INJECT){const inj=fs.readFileSync(path.resolve(INJECT),'utf8');
      await page.route('**cdn.tailwindcss.com**',r=>r.fulfill({status:200,contentType:'application/javascript',
        body:`(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(inj)};document.head.appendChild(s);})();`}));}
    await page.addInitScript(()=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
      put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
      put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
      put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
      put('mh_rhythm_tutorial_seen_v1',true);});
    const clickText=async(pat,nth=0)=>page.evaluate(([s,i])=>{const rx=new RegExp(s);
      const l=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
      if(!l[i])return false;l[i].click();return true;},[pat,nth]);

    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    // 演奏画面のクラスを集めるのは、始める直前のこの時点ではなく演奏中に行う(下)
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    // READY→3→2→1 のカウントダウンを見送ってから測る(曲が流れている最中だけを測りたい)
    await page.waitForTimeout(5000);

    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    if(CPU>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU});
    const pick=(m)=>Object.fromEntries(m.metrics.map(x=>[x.name,x.value]));
    const before=pick(await cdp.send('Performance.getMetrics'));

    // 曲の再生位置(AudioContext.currentTime)が、どれくらいの刻みで進んでいるかを測る。
    // ノーツの位置は run.audio.songTimeMs() から決まり、それは ctx.currentTime そのもの
    // (14-audio.jsx の songTimeSeconds)。演奏ループは補間していないので、
    // ctx.currentTime が粗く進む端末では、ノーツが「止まって飛ぶ」動きになる。
    // フレームレートは60fpsのままなので、フレーム間隔をいくら測っても見つからない。
    await page.evaluate(()=>{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      const desc=Object.getOwnPropertyDescriptor(AC.prototype,'currentTime');if(!desc||!desc.get)return;
      window.__ct=[];window.__ctOn=false;
      Object.defineProperty(AC.prototype,'currentTime',{configurable:true,get(){
        const v=desc.get.call(this);
        if(window.__ctOn&&window.__ct.length<40000)window.__ct.push(v);
        return v;}});
    });
    // 演奏中に getBoundingClientRect が何回呼ばれているかを数える。
    // measureTravel は「組み上がったと確かめられたときだけ」結果を覚える作りで、
    // そうでない間は毎フレーム3回測り直す(＝強制同期レイアウトが毎フレーム走る)。
    // 1フレームあたり0に近ければキャッシュが効いている。3以上なら測り直し続けている
    await page.evaluate(()=>{
      const orig=Element.prototype.getBoundingClientRect;window.__rect=0;
      Element.prototype.getBoundingClientRect=function(){window.__rect++;return orig.call(this);};
    });
    if(DRAW)await page.evaluate(()=>{
      const proto=CanvasRenderingContext2D.prototype;window.__draw={};
      for(const k of ['drawImage','fillRect','fill','stroke','arc','ellipse','createLinearGradient','createRadialGradient','save','restore']){
        const orig=proto[k];if(typeof orig!=='function')continue;
        proto[k]=function(...a){window.__draw[k]=(window.__draw[k]||0)+1;return orig.apply(this,a);};}
    });
    await page.evaluate(()=>{
      window.__f=[];window.__long=[];window.__ctOn=true;let last=0;
      try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__long.push(e.duration);}).observe({entryTypes:['longtask']});}catch{}
      const tick=t=>{if(last)window.__f.push(t-last);last=t;window.__raf=requestAnimationFrame(tick);};
      window.__raf=requestAnimationFrame(tick);
    });
    await page.waitForTimeout(SECONDS*1000);
    // 見た目そのものが変わっていないかも確かめる。canvas の中身は毎フレーム変わるので
    // 画素ではなく、演奏画面の骨格になる要素の computed style を全部取って突き合わせる
    const styles=await page.evaluate(()=>{
      const out={};
      const sels=['[data-rhythm-tap-test]','[data-rhythm-hud]','[data-rhythm-play-area]','[data-rhythm-judgment-line]','[data-rhythm-note-canvas]','[data-rhythm-lane]','[data-rhythm-score]','[data-rhythm-combo]'];
      for(const sel of sels){const el=document.querySelector(sel);if(!el)continue;
        const cs=getComputedStyle(el),o={};for(const k of cs)o[k]=cs.getPropertyValue(k);
        o['__rect']=JSON.stringify(el.getBoundingClientRect());out[sel]=o;}
      return out;});
    const got=await page.evaluate(()=>{cancelAnimationFrame(window.__raf);
      // 演奏中のDOMに出ているクラス名を全部集める(JIT相当のCSSを作るため)
      const set=new Set();
      for(const el of document.querySelectorAll('[class]'))for(const c of String(el.className.baseVal??el.className).split(/\s+/))if(c)set.add(c);
      window.__ctOn=false;
      // 「同じ値が続いたあと、いくつ飛んだか」= 曲の時刻の刻み(ms)
      const steps=[];let prev=null;
      for(const v of (window.__ct||[])){if(prev!==null&&v>prev)steps.push((v-prev)*1000);prev=v===prev?prev:v;}
      return {frames:window.__f,long:window.__long,classes:[...set],draw:window.__draw||null,rect:window.__rect||0,songSteps:steps,
        canvas:!!document.querySelector('[data-rhythm-note-canvas]'),
        rules:[...document.styleSheets].reduce((n,s)=>{try{return n+s.cssRules.length;}catch{return n;}},0)};});
    const after=pick(await cdp.send('Performance.getMetrics'));
    await page.close();
    const d=k=>Math.round(((after[k]||0)-(before[k]||0))*1000);
    return {label,...stats(got.frames),long:got.long.length,longMax:Math.round(Math.max(0,...got.long)),
      recalcMs:d('RecalcStyleDuration'),layoutMs:d('LayoutDuration'),scriptMs:d('ScriptDuration'),
      recalcCount:(after.RecalcStyleCount||0)-(before.RecalcStyleCount||0),cpu:CPU,styles,draw:got.draw,rect:got.rect,
      songStep:(()=>{const a=got.songSteps||[];if(!a.length)return null;const s2=[...a].sort((x,y)=>x-y);
        return {n:a.length,median:s2[Math.floor(s2.length*.5)],p95:s2[Math.floor(s2.length*.95)],max:s2[s2.length-1]};})(),
      classes:got.classes,canvas:got.canvas,rules:got.rules};
  }finally{await browser.close();}
};

(async()=>{
  let chromium;
  try{({chromium}=require(path.join(ROOT,'tools/node_modules/playwright')));}
  catch{console.log('SKIP: playwright が入っていないので測れません');process.exit(0);}
  const server=await serve();
  try{
    const show=r=>{
      console.log(`\n── ${r.label} ──`);
      console.log(`  描き方            : ${r.canvas?'canvas':'要素'} / CSSのルール ${r.rules}本${r.cpu>1?` / CPU 1/${r.cpu}`:''}`);
      console.log(`  フレーム間隔      : 中央 ${r.median.toFixed(1)}ms / p95 ${r.p95.toFixed(1)}ms / 最大 ${r.max.toFixed(1)}ms (${r.n}フレーム)`);
      console.log(`  詰まったフレーム  : 16.7ms超 ${r.over16}回 / 33.3ms超 ${r.over33}回`);
      console.log(`  長いタスク        : ${r.long}回 (最大 ${r.longMax}ms)`);
      console.log(`  スタイル再計算    : ${r.recalcMs}ms / ${r.recalcCount}回`);
      console.log(`  レイアウト        : ${r.layoutMs}ms`);
      console.log(`  JS                : ${r.scriptMs}ms`);
      if(r.songStep)console.log(`  曲の時刻の刻み    : 中央 ${r.songStep.median.toFixed(1)}ms / p95 ${r.songStep.p95.toFixed(1)}ms / 最大 ${r.songStep.max.toFixed(1)}ms (${r.songStep.n}回進んだ)`);
      console.log(`  位置の測り直し    : getBoundingClientRect ${r.rect}回 (1フレームあたり ${(r.rect/Math.max(1,r.n)).toFixed(2)}回)`);
      console.log(`  1フレームあたり   : JS ${(r.scriptMs/Math.max(1,r.n)).toFixed(2)}ms / スタイル再計算 ${(r.recalcMs/Math.max(1,r.n)).toFixed(2)}ms / レイアウト ${(r.layoutMs/Math.max(1,r.n)).toFixed(2)}ms`);
      if(r.draw){const per=k=>(r.draw[k]||0)/Math.max(1,r.n);
        console.log(`  canvasへの描き込み: 1フレームあたり drawImage ${per('drawImage').toFixed(1)}回 / fill ${per('fill').toFixed(1)}回 / stroke ${per('stroke').toFixed(1)}回 / グラデーション作成 ${(per('createLinearGradient')+per('createRadialGradient')).toFixed(1)}回`);}
    };
    const med=a=>{const x=[...a].sort((p,q)=>p-q);return x.length%2?x[(x.length-1)/2]:(x[x.length/2-1]+x[x.length/2])/2;};
    const many=async(opts)=>{
      const rs=[];for(let i=0;i<RUNS;i++)rs.push(await run(chromium,opts));
      if(RUNS===1)return rs[0];
      const pick=k=>med(rs.map(r=>r[k]));
      const out={...rs[rs.length-1]};
      for(const k of ['median','p95','max','over16','over33','long','longMax','recalcMs','layoutMs','scriptMs','recalcCount','n','rect'])out[k]=pick(k);
      out.label=`${opts.label} ／ ${RUNS}回の中央値`;
      out.spread=`フレーム数 ${Math.min(...rs.map(r=>r.n))}〜${Math.max(...rs.map(r=>r.n))} / 1フレームJS ${Math.min(...rs.map(r=>r.scriptMs/r.n)).toFixed(2)}〜${Math.max(...rs.map(r=>r.scriptMs/r.n)).toFixed(2)}ms`;
      return out;};
    const full=await many({css:null,label:`いまの配信CSS(tailwind.css ${Math.round(fs.statSync(path.join(ROOT,'monster-hero/tailwind.css')).size/1024)}KB)`});
    show(full);
    if(full.spread)console.log(`  ばらつき          : ${full.spread}`);
    if(!COMPARE){console.log('\n※ --compare を付けると「以前のCDN(JIT)相当」と並べて比べます');process.exit(0);}

    const jit=buildJitCss(full.classes);
    if(!jit){console.log('\nSKIP: tailwindcss が入っていないので JIT相当を作れません');process.exit(0);}
    console.log(`\n(演奏画面に出ているクラス ${full.classes.length}種から JIT相当のCSSを作りました: ${Math.round(Buffer.byteLength(jit)/1024)}KB)`);
    const lean=await many({css:jit,label:`以前のCDN相当(この画面のクラスだけ ${Math.round(Buffer.byteLength(jit)/1024)}KB)`});
    show(lean);

    console.log('\n── 差(いまの配信CSS − 以前のCDN相当) ──');
    const diff=(name,a,b,unit='ms')=>console.log(`  ${name.padEnd(18,'　')}: ${(a-b>=0?'+':'')}${(a-b).toFixed(1)}${unit}`);
    diff('フレーム中央値',full.median,lean.median);
    diff('フレームp95',full.p95,lean.p95);
    diff('16.7ms超の回数',full.over16,lean.over16,'回');
    diff('スタイル再計算',full.recalcMs,lean.recalcMs);
    diff('レイアウト',full.layoutMs,lean.layoutMs);
    diff('JS',full.scriptMs,lean.scriptMs);

    // 見た目が変わっていないか(演奏画面の骨格の computed style)
    console.log('\n── 見た目(演奏画面の骨格の computed style) ──');
    let seen=0,gaps=[];
    for(const sel of Object.keys(full.styles)){
      const a=full.styles[sel],b=lean.styles[sel]||{};
      for(const k of Object.keys(a)){seen++;if(a[k]!==b[k])gaps.push(`${sel} ${k}: 配信=${String(a[k]).slice(0,40)} / CDN相当=${String(b[k]).slice(0,40)}`);}
    }
    console.log(`  ${Object.keys(full.styles).length}要素 / ${seen}項目を突き合わせ`);
    if(!gaps.length)console.log('  ちがい: なし(当たり方は同じ)');
    else{console.log(`  ちがい: ${gaps.length}件`);gaps.slice(0,20).forEach(g=>console.log(`    ${g}`));}
  }finally{server.close();}
})();
