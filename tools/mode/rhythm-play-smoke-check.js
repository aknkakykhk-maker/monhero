// モンヒロビートの演奏画面を、実際に開いて数秒動かす検査(見た目の「おまかせ」4つの設定で)。
//
//   node tools/mode/rhythm-play-smoke-check.js
//
// 【なぜ要るか】(2026-09-27)
// render-error-check は演奏画面を開かない。この日、次の2つを入れてしまい、どちらも既存の検査では見つからなかった。
//   ・演奏画面の部品で、まだ用意していない値(view)を読み、演奏画面が開けなくなった(公開前に手で見つけた)
//   ・「判定の演出」の印を演奏エリアではなくリザルト画面に付け、文字の大きな弾みが効いていなかった(本番に出た)
// ここでは設定ごとに演奏画面を開き、エラーが無いこと・設定どおりの部品が出ていることを確かめる。
// 演出の自動調整(重いと演出を下げる)は、この環境ではすぐ働いてしまうので切って確かめる。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9185;
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.mp3':'audio/mpeg'};
let failures=0;
const check=(label,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};

// 「おまかせ」の値は本体(RHYTHM_LOOK_PRESETS)をそのまま使う。expect … その設定で演奏画面に出ているはずのもの
const EXPECT={
  LIGHT:{effect:'MINIMAL',stage:null,road:false,judgmentFx:false,climax:false},
  STANDARD:{effect:'LIGHT',stage:null,road:false,judgmentFx:false,climax:false},
  VIVID:{effect:'LOW',stage:'VIVID',road:true,judgmentFx:true,climax:true},
  FULL:{effect:'NORMAL',stage:'LIVE',stageGl:true,road:true,judgmentFx:true,climax:true},
};

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');process.exit(0);}}
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,''),file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
  await new Promise(r=>server.listen(PORT,r));
  const browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  try{
    // 本体から「おまかせ」の値を読む(検査に値を書き写さない)
    const probe=await browser.newPage();await probe.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
    await probe.waitForFunction(()=>typeof RHYTHM_LOOK_PRESETS!=='undefined',{timeout:60000});
    const presets=await probe.evaluate(()=>RHYTHM_LOOK_PRESETS.map(p=>({id:p.id,label:p.label,values:p.values})));await probe.close();
    check('本体に見た目のおまかせが4つある',presets.length===4&&presets.every(p=>EXPECT[p.id]),presets.map(p=>p.id).join(','));
    for(const preset of presets){
      const expect=EXPECT[preset.id];if(!expect)continue;
      const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/screen-error|Cannot access|is not defined|is not a function/.test(m.text()))errors.push(m.text().slice(0,200));});
      await page.addInitScript(values=>{
        const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
        put('mh_breeder_name','テスト');put('mh_breeder_icon','🐣');put('mh_intro_done',true);put('mh_onboarded',true);
        put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
        put('mh_assistant_selected_v1','mua');put('mh_assistant_unlock_seen_v1',true);put('mh_update_notice_seen_v1',true);
        put('mh_rhythm_tutorial_seen_v1',true);put('mh_rhythm_play_defaults_restored_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
        localStorage.setItem('mh_rhythm_settings_v1',JSON.stringify({...values,autoEffectDown:false}));
        // この環境には GPU が無いので、ノーツも背景も WebGL を使うようにデバッグの指定で強制する
        localStorage.setItem('mh_rhythm_canvas_v1','webgl');localStorage.setItem('mh_rhythm_stage_gl_v1','webgl');
      },preset.values);
      const clickText=pattern=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pattern);
      let opened=false;
      try{
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`,{waitUntil:'load',timeout:60000});
        await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),{timeout:60000});
        await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
        await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
        await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
        for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|閉じる')))break;await page.waitForTimeout(250);}
        await clickText('モンヒロビート');
        await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
        for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|閉じる')))break;await page.waitForTimeout(300);}
        await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
        await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});opened=true;
        await page.waitForFunction(()=>/0:0[3-9]\//.test(document.querySelector('[data-rhythm-song-clock]')?.textContent||''),{timeout:60000,polling:200});
        await page.waitForTimeout(3000);
      }catch(e){errors.push(`開けない: ${String(e.message).split('\n')[0]}`);}
      const seen=opened?await page.evaluate(()=>{const q=s=>document.querySelector(s),area=q('[data-rhythm-play-area]');
        return {effect:area?.dataset.rhythmEffect||'',judgmentFx:area?.dataset.rhythmJudgmentFx==='1',stage:q('[data-rhythm-stage]')?.dataset.rhythmStage||null,stageGl:!!q('[data-rhythm-stage-gl]'),
          road:!!q('[data-rhythm-road-haze]'),roadCss:q('[data-rhythm-road-haze]')?getComputedStyle(q('[data-rhythm-road-haze]')).position:'',climax:!!q('[data-rhythm-climax]'),canvas:!!q('[data-rhythm-note-canvas]'),score:!!q('[data-rhythm-score]'),life:!!q('[data-rhythm-life-value]'),
          judgmentText:!!q('[data-rhythm-judgment-text]'),songDim:q('[data-rhythm-hud-songline]')?.dataset.hudSongDim==='1',clock:q('[data-rhythm-song-clock]')?.textContent||''};}):null;
      const tag=`「${preset.label}」`;
      check(`${tag} 演奏画面が開いて曲が進む`,!!seen&&/0:0[5-9]|0:1\d/.test(seen.clock),seen?seen.clock.slice(0,9):'開けない');
      check(`${tag} ページでエラーが起きていない`,!errors.length,errors.join(' / ').slice(0,300));
      if(!seen){await page.close();continue;}
      check(`${tag} ノーツの canvas・スコア・ライフ・判定の文字の部品がある`,seen.canvas&&seen.score&&seen.life&&seen.judgmentText);
      check(`${tag} 演出量の印が設定どおり(${expect.effect})`,seen.effect===expect.effect,seen.effect);
      check(`${tag} ライブ背景が設定どおり(${expect.stage||'なし'})`,seen.stage===expect.stage,String(seen.stage));
      if(expect.stageGl)check(`${tag} ライブ背景を WebGL で描いている`,seen.stageGl);
      check(`${tag} 道の演出が設定どおり(${expect.road?'あり':'なし'})`,seen.road===expect.road);
      // 2026-09-26 の main の取り込みで CSS が消え、部品はあるのに何も見えていなかった(2026-09-29 に見つけた)
      if(expect.road)check(`${tag} 道のもやの CSS が効いている`,seen.roadCss==='absolute',seen.roadCss);
      check(`${tag} 盛り上がりの光が設定どおり(${expect.climax?'あり':'なし'})`,seen.climax===expect.climax);
      check(`${tag} 判定の演出の印が演奏エリアに設定どおり付いている(${expect.judgmentFx?'あり':'なし'})`,seen.judgmentFx===expect.judgmentFx);
      check(`${tag} 演奏が始まって少したつと曲名が薄くなる`,seen.songDim);
      await page.close();
    }
  }catch(e){check('実測できる',false,String(e&&e.message||e).split('\n')[0]);}
  finally{await browser.close();server.close();}
  console.log(failures?`\n${failures}件のNGがあります`:'\nすべてOK');
  process.exit(failures?1:0);
})();
