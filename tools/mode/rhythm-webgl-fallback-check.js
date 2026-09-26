// モンヒロビートで WebGL の準備が途中で失敗したとき、「ふつう」の描き方(Canvas 2D)へ戻って
// ノーツが見えるかを、実際の演奏画面で確かめる(2026-09-26)。
//
//   node tools/mode/rhythm-webgl-fallback-check.js
//
// 【なぜ要るか】
// canvas から WebGL を取れたのに、そのあとの準備(シェーダを作る・つなぐ)で失敗すると、
// 同じ canvas からは 2D も取り出せず、描き込み先が無いまま曲が進んでいた。判定とスコアは進むのに
// ノーツが1つも見えない。いまは演奏画面が RHYTHM_CANVAS_RENDERER.ready を見て canvas を作り直し、
// 2D へ戻す。ここでは WebGL の準備をわざと失敗させて(createProgram が null を返す)確かめる。
//   ① 描き方「軽い」(WebGL)を選んでいても、ノーツの canvas は 2D で描いている
//   ② 実際にノーツが描かれている(画素がある)
//   ③ 例外が出ていない
// あわせて、失敗させないときは WebGL で描けていること(この検査の前提)も見る。
// 直す前のコードに当てると、②で落ちる(描き込み先が無く、画素が0のまま)ことを確かめてある。
const http=require('http'),path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9181;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css',
  '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ico':'image/x-icon'};
const serve=()=>new Promise(r=>{const s=http.createServer((req,res)=>{
  const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),f=path.join(ROOT,rel);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream'});
  fs.createReadStream(f).pipe(res);});s.listen(PORT,()=>r(s));});

const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const rhythm=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
ok('描き込み先が取れているかを演奏画面から見られる(ready)',/get ready\(\)\{return !!ctx;\}/.test(rhythm));
ok('取れなかったときは canvas を作り直して 2D へ戻す',
  play.includes('if(webglNotes&&canvas&&RHYTHM_CANVAS_RENDERER.ready===false){setWebglLost(true);'));

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-gl=swiftshader','--ignore-gpu-blocklist']});
    for(const breakGl of [false,true]){
      const label=breakGl?'WebGL の準備を失敗させたとき':'ふだん';
      const page=await browser.newPage({viewport:{width:390,height:844}});
      const errors=[];
      page.on('pageerror',e=>errors.push(String(e)));
      await page.addInitScript(([broken])=>{const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);
        // 描き方「軽い」= WebGL で描く
        put('mh_rhythm_settings_v1',{noteDrawMode:'LIGHT'});
        if(broken&&typeof WebGLRenderingContext!=='undefined'){WebGLRenderingContext.prototype.createProgram=function(){return null;};}
      },[breakGl]);
      const clickText=async(pat,nth=0)=>page.evaluate(([s,i])=>{const rx=new RegExp(s);
        const l=[...document.querySelectorAll('button')].filter(b=>rx.test((b.innerText||'').replace(/\s+/g,' ').trim()));
        if(!l[i])return false;l[i].click();return true;},[pat,nth]);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body?.innerText.includes('TAP TO START'),{timeout:40000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
      for(let i=0;i<6;i++){if(!(await clickText('^(受け取る|閉じる|OK|とじる|確認)$')))break;await page.waitForTimeout(250);}
      await clickText('モンヒロビート');await page.waitForTimeout(1200);
      // タイミング合わせは、決まった譜面がすぐ流れはじめる(曲えらびを通らなくてよい)
      await clickText('⚙️');await page.waitForTimeout(600);
      const opened=await page.evaluate(()=>{const b=document.querySelector('[data-rhythm-calibrator-open]');if(!b)return false;b.click();return true;});
      ok(`[${label}] 演奏画面を開ける`,opened);
      if(!opened){await page.close();continue;}
      // カウントダウンのあと、ノーツが流れてくるまで待つ
      let drawn=0,backend='';
      for(let i=0;i<40;i++){
        await page.waitForTimeout(250);
        const st=await page.evaluate(()=>{
          const c=document.querySelector('canvas[data-rhythm-note-backend]');
          if(!c)return {backend:'',drawn:0};
          const backend=c.getAttribute('data-rhythm-note-backend');
          // WebGL は画素を読み出せない(preserveDrawingBuffer なし)ので、2D のときだけ数える
          if(backend!=='2d')return {backend,drawn:-1};
          const ctx=c.getContext('2d');
          if(!ctx)return {backend,drawn:0};
          const d=ctx.getImageData(0,0,c.width,c.height).data;
          let drawn=0;for(let k=3;k<d.length;k+=16)if(d[k]>0)drawn++;
          return {backend,drawn};
        });
        backend=st.backend;
        if(st.drawn!==0){drawn=st.drawn;if(st.drawn>0)break;}
      }
      if(breakGl){
        ok(`[${label}] ノーツの canvas は 2D で描いている`,backend==='2d',backend||'(canvas なし)');
        ok(`[${label}] ノーツが実際に描かれている`,drawn>0,`${drawn}画素`);
      }else{
        ok(`[${label}] (前提) WebGL で描いている`,backend==='webgl',backend||'(canvas なし)');
      }
      ok(`[${label}] 実行時エラーが出ていない`,errors.length===0,errors.slice(0,2).join(' / '));
      await page.close();
    }
  }catch(e){ok('最後まで確かめられた',false,String(e).slice(0,200));}
  finally{if(browser)await browser.close();server.close();}
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
