// モンヒロビートの演奏中の GPU の重さを、実機が無くても「機種の帯ごとの fps の目安」で見積もる。
//
//   node tools/mode/rhythm-gpu-estimate.js              … 見た目のおまかせ4つ(軽さ優先・標準・華やか・全部のせ)を見積もる
//   node tools/mode/rhythm-gpu-estimate.js --check      … 予算(tools/mode/gpu-budget.json)を超えていないかを見る(超えたら落ちる)
//   node tools/mode/rhythm-gpu-estimate.js --write-budget … いまの値から予算を書き直す(★見た目を重くしたと分かっているときだけ。ユーザーに確かめてから)
//   オプション: --seconds 4(測る長さ) --runs 1 --only FULL(おまかせの id を1つだけ) --port 9187
//
// 【なぜ要るか】(2026-09-27・ユーザー「実機でみないでもGPUを見れる仕組みを作って」)
// この作業環境には GPU が無い。WebGL も画面の合成も、CPU で動く GPU のまね(SwiftShader)が肩代わりしている。
// SwiftShader がかけた時間は「GPU にさせた仕事の量」にほぼ比例するので、次のように見積もる。
//   ① 較正: 同じ環境で「画面いっぱいを半透明で1回塗る」を N 回(0・2・4・8回)描き、1回ぶんが何 ms かを測る(直線で当てはめる)
//   ② 測る: 演奏中の GPU の仕事(1フレームあたり)を rhythm-gpu-load-report.js と同じ測り方で測る
//   ③ 換算: 「画面いっぱいを何回塗ったのと同じか」= (演奏中の ms − 何も塗らないときの ms) ÷ 1回ぶんの ms
//   ④ 見積もり: 機種の帯ごとの「1ms に塗れる画素の数(目安)」と画面の画素数から、1フレームの GPU の時間と fps の目安を出す
//
// 【読み方と限り】
// ・機種の帯の速さ(tools/mode/gpu-device-profiles.json)は、公開されている性能から置いた「目安」。正確な数字ではない。
//   実機の GPU の時間が分かったら(デバッグの性能計測の「GPU(ノーツ)/(背景)」。Android の Chrome なら出る)、その表を直す。
// ・見るのは「どの帯に入るか」と「変更の前後でどれだけ増えたか」。1〜2割のぶれは普通にある。
// ・GPU の仕事だけを見る。JavaScript の重さ(判定・配置)は rhythm-live-frame-report.js(CPU を絞って測る)で見る。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(`--${name}`);return i>=0&&process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:fallback;};
const flag=name=>process.argv.includes(`--${name}`);
const PORT=Number(arg('port','9187'))||9187,ONLY=arg('only','');
const PROFILES_FILE=path.join(__dirname,'gpu-device-profiles.json'),BUDGET_FILE=path.join(__dirname,'gpu-budget.json');
const {measure,serve}=require('./rhythm-gpu-load-report.js');

// ── ① 較正のページ(画面いっぱいの半透明の四角を N 回、毎フレーム描く) ─────────────────
const CALIB_HTML=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#000}canvas{display:block;width:100vw;height:100vh}</style><canvas id=c></canvas><script>
const c=document.getElementById('c');const dpr=devicePixelRatio||1;c.width=Math.round(innerWidth*dpr);c.height=Math.round(innerHeight*dpr);
const gl=c.getContext('webgl',{alpha:false,antialias:false});
const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);return o;};
const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}'));
gl.attachShader(p,sh(gl.FRAGMENT_SHADER,'precision mediump float;varying vec2 v;uniform float t;void main(){gl_FragColor=vec4(v.x,v.y,.5+.5*sin(t),.35);}'));
gl.linkProgram(p);gl.useProgram(p);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const loc=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);const ut=gl.getUniformLocation(p,'t');
window.__passes=0;window.__frames=0;
const frame=now=>{window.__frames++;gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);
  for(let i=0;i<window.__passes;i++){gl.uniform1f(ut,now*.001+i);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}requestAnimationFrame(frame);};requestAnimationFrame(frame);
</script>`;

const fit=points=>{ // 最小二乗で ms = a + b × N
  const n=points.length,sx=points.reduce((s,p)=>s+p.n,0),sy=points.reduce((s,p)=>s+p.ms,0);
  const sxx=points.reduce((s,p)=>s+p.n*p.n,0),sxy=points.reduce((s,p)=>s+p.n*p.ms,0);
  const b=(n*sxy-sx*sy)/(n*sxx-sx*sx),a=(sy-b*sx)/n;return {a,b};
};

const calibrate=async(playwright)=>{
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(CALIB_HTML);});
  await new Promise(r=>server.listen(PORT+5,r));
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{
    // 演奏を測るときと同じ大きさ(390×844・画素密度3)にそろえる
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
    await page.goto(`http://localhost:${PORT+5}/`);
    const bcdp=await browser.newBrowserCDPSession();
    const gpuTime=async()=>{const {processInfo}=await bcdp.send('SystemInfo.getProcessInfo');return processInfo.filter(p=>p.type==='GPU').reduce((a,p)=>a+p.cpuTime,0);};
    const points=[];
    for(const n of [0,2,4,8]){
      await page.evaluate(v=>{window.__passes=v;},n);await page.waitForTimeout(800);
      const g0=await gpuTime(),f0=await page.evaluate(()=>window.__frames);const t0=Date.now();
      await page.waitForTimeout(3000);
      const g1=await gpuTime(),f1=await page.evaluate(()=>window.__frames);
      const frames=f1-f0;points.push({n,ms:frames>0?(g1-g0)*1000/frames:NaN,fps:frames/((Date.now()-t0)/1000)});
    }
    return {points,...fit(points.filter(p=>Number.isFinite(p.ms)))};
  }finally{await browser.close();server.close();}
};

// ── ② おまかせの見た目の値を本体から読む(検査に書き写さない) ────────────────────────
const lookPresets=async(playwright)=>{
  const server=await serve(ROOT,PORT+6);
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  try{
    const page=await browser.newPage();await page.goto(`http://localhost:${PORT+6}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await page.waitForFunction(()=>typeof RHYTHM_LOOK_PRESETS!=='undefined',{timeout:60000});
    return await page.evaluate(()=>RHYTHM_LOOK_PRESETS.map(p=>({id:p.id,label:p.label,values:p.values})));
  }finally{await browser.close();server.close();}
};

const median=list=>{const s=[...list].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const estimateFor=(passes,profile)=>{
  const ms=passes*profile.pixels/profile.pixelsPerMs;
  return {ms,fps:Math.min(profile.refreshHz||60,1000/Math.max(ms,1e-6))};
};

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので見積もれません');process.exit(0);}}
  const profiles=JSON.parse(fs.readFileSync(PROFILES_FILE,'utf8')).profiles;
  const RUNS=Math.max(1,Number(arg('runs','1'))||1);
  console.log('① 較正(画面いっぱいを半透明で N 回塗る)');
  const cal=await calibrate(playwright);
  for(const p of cal.points)console.log(`   N=${p.n}: GPU の仕事 ${p.ms.toFixed(1)}ms/フレーム(${p.fps.toFixed(1)}fps)`);
  console.log(`   → 何も塗らないとき ${cal.a.toFixed(1)}ms ・ 画面いっぱい1回ぶん ${cal.b.toFixed(1)}ms`);
  if(!(cal.b>0)){console.log('NG: 較正の結果が使えません(1回ぶんが0以下)');process.exit(1);}

  console.log('\n② 演奏中の GPU の仕事を測る(ノーツ・背景とも WebGL。GPU のある端末で何も設定していない人と同じ描き方)');
  const presets=(await lookPresets(playwright)).filter(p=>!ONLY||p.id===ONLY);
  const server=await serve(ROOT,PORT);
  const results=[];
  try{
    for(const preset of presets){
      const runs=[];for(let i=0;i<RUNS;i++)runs.push(await measure(playwright,PORT,{label:preset.label,draw:'webgl',settings:{...preset.values,autoEffectDown:false}}));
      const gpuPerFrame=median(runs.map(r=>r.gpuPerFrame));
      const passes=Math.max(0,(gpuPerFrame-cal.a)/cal.b);
      results.push({id:preset.id,label:preset.label,gpuPerFrame,passes,errors:[...new Set(runs.flatMap(r=>r.errors))]});
    }
  }finally{server.close();}

  console.log('\n③④ 見積もり(画面いっぱいを何回塗ったのと同じか → 機種の帯ごとの GPU の時間と fps の目安)');
  console.log(`   機種の帯: ${profiles.map(p=>`${p.label}(${(p.pixels/1e6).toFixed(2)}M画素・${p.pixelsPerMs/1000}M画素/ms)`).join(' / ')}`);
  for(const r of results){
    const cells=profiles.map(p=>{const e=estimateFor(r.passes,p);return `${p.short} ${e.ms.toFixed(1)}ms(${Math.round(e.fps)}fps)`;});
    console.log(`   「${r.label}」 画面 ${r.passes.toFixed(1)} 回ぶん(GPU の仕事 ${r.gpuPerFrame.toFixed(1)}ms) ・ ${cells.join(' ・ ')}`);
    if(r.errors.length)console.log(`     ページのエラー: ${r.errors.join(' / ').slice(0,200)}`);
  }
  console.log('   ★機種の帯の速さは目安(tools/mode/gpu-device-profiles.json)。実機の数字が分かったら表を直す');

  if(flag('write-budget')){
    // 予算は「いまの値 × 1.25」。1〜2割のぶれでは落ちず、はっきり重くしたときに落ちる幅
    const budget={note:'rhythm-gpu-estimate.js --write-budget で書いた。値は「画面いっぱいを何回塗ったのと同じか」の上限(いまの値×1.25)',
      writtenAt:new Date().toISOString(),passesMax:Object.fromEntries(results.map(r=>[r.id,Math.round(r.passes*1.25*10)/10]))};
    fs.writeFileSync(BUDGET_FILE,JSON.stringify(budget,null,2)+'\n');
    console.log(`\n予算を書きました: ${path.relative(ROOT,BUDGET_FILE)}`);
  }
  if(flag('check')){
    const budget=JSON.parse(fs.readFileSync(BUDGET_FILE,'utf8'));let failed=0;
    console.log('');
    for(const r of results){
      const max=budget.passesMax[r.id];if(!Number.isFinite(max))continue;
      const ok=r.passes<=max&&!r.errors.length;if(!ok)failed++;
      console.log(`${ok?'OK':'NG'}: 「${r.label}」の GPU の仕事が予算の中 — 画面 ${r.passes.toFixed(1)} 回ぶん / 予算 ${max} 回ぶん${r.errors.length?' ・ ページのエラーあり':''}`);
    }
    console.log(failed?`\n${failed}件のNGがあります(重くしたなら理由を確かめ、意図どおりなら --write-budget で予算を書き直す)`:'\nすべてOK');
    process.exit(failed?1:0);
  }
})().catch(e=>{console.log('ERR',e.message);process.exit(1);});
