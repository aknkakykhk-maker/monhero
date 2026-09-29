#!/usr/bin/env node
// ロボットに本物のゲームでモンヒロビートを通しで遊ばせ、取れないノーツを探す(2026-09-29・ユーザー判断「1と2を進めて」)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-robot-play.js --song big_bridge_no_shitou --difficulty MASTER
//   node tools/mode/rhythm-robot-play.js --all [--difficulties EXPERT,MASTER] [--parallel 3] [--out <json>]
//
// 【なぜ要るか】
// 譜面を作る道具の中の「押せる」(手のシミュレート)は、ゲームの判定そのものではない。
// 実際のゲームでは、隣のノーツに当たり判定を取られる・長押しの終わりが判定されない・スライドを追い切れない、などが起こりうる。
// そこで本物のゲームをブラウザで動かし、ロボットが「画面に見えたノーツ」を、その時刻ぴったりに本物のタッチ(TouchEvent)で押す。
//   ・押す位置: 判定ラインの高さで、ノーツの横の位置(rhythmNoteVisualSpan・スライドは rhythmSlideExpectedLane)の真ん中
//   ・TAP は押してすぐ離す。FLICK は押して横(向き付き)か上へ払う。HOLD / SLIDE は終わりまで押さえたまま位置を追い、終わりで離す(終点フリックは払う)
//   ・押す時刻はコマの頭(RHYTHM_PERF.songTime が呼ばれた所)。次のコマまでに来るノーツを、8ms 早めまで先取りして押す
// 曲が終わったら、ロボットが押したノーツごとにゲームが付けた判定(note._rhythmFinalJudgment)を集め、MARVELOUS でなかったものを並べる。
// ゲームの自己ベストなどはロボット用のブラウザの中だけ(本物のプレイヤーのデータには触らない)。
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const PAGE_URL=process.env.SMOKE_URL||'http://localhost:8899/monster-hero/index.html';
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

// ロボット用のブラウザの初期値(はじめての案内を閉じた状態・全曲の全難易度を開けた状態)
const seed=songIds=>{
  const put=(k,v)=>{localStorage.setItem(k,JSON.stringify(v));};
  put('mh_breeder_name','ロボット');put('mh_breeder_icon','Mocchi');put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);
  const best={};for(const id of songIds){best[id]={};for(const d of ['EASY','NORMAL','HARD','EXPERT','MASTER'])best[id][d]={score:1,clear:true,rank:'C',maxCombo:1};}
  put('mh_rhythm_best_v1',best);
};

// ページの中のロボット
const installRobot=()=>{
  const bot=window.__mhRobot={seen:new Map(),live:new Map(),nextId:1,started:0,log:[],song:null};
  const area=()=>document.querySelector('[data-rhythm-play-area]');
  const lineRatio=()=>RHYTHM_JUDGMENT_LINE_Y.ratio||.88;
  const originalType=note=>note._rhythmOriginalType||note.type;
  const pointAt=(note,t)=>{
    const el=area();if(!el)return null;
    const rect=RHYTHM_VIEW_ROTATION.rectOf(el),ratio=lineRatio();
    const visualLane=originalType(note)==='SLIDE'?rhythmSlideExpectedLane(note,t):Number(note.lane)||0;
    const span=rhythmNoteVisualSpan(note,visualLane,ratio,t);
    return {x:rect.left+rect.width*span.center,y:rect.top+rect.height*ratio,el};
  };
  const touchList=()=>[...bot.live.values()].map(entry=>entry.touch);
  const send=(type,entry)=>{
    const el=area();if(!el)return;
    const touches=type==='touchend'?touchList().filter(t=>t!==entry.touch):touchList();
    el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:[entry.touch]}));
  };
  const makeTouch=(id,p)=>new Touch({identifier:id,target:p.el,clientX:p.x,clientY:p.y,radiusX:8,radiusY:8,force:1});
  const perfSong=RHYTHM_PERF.songTime.bind(RHYTHM_PERF);
  RHYTHM_PERF.songTime=song=>{
    const result=perfSong(song);
    bot.song=song;
    try{
      // 押さえている指を動かす・離す
      for(const [id,entry] of [...bot.live]){
        const note=entry.note;
        if(entry.kind==='tap'&&song>=entry.upAt){send('touchend',entry);bot.live.delete(id);continue;}
        if(entry.kind==='flick'){
          if(!entry.moved&&song>=entry.moveAt){const p=entry.base;entry.touch=makeTouch(id,{...p,x:p.x+entry.dx,y:p.y+entry.dy});send('touchmove',entry);entry.moved=true;}
          else if(entry.moved&&song>=entry.upAt){send('touchend',entry);bot.live.delete(id);}
          continue;
        }
        if(entry.kind==='hold'){
          const end=rhythmReleaseTargetMs(note)||entry.endMs;
          const t=Math.min(song,end);const p=pointAt(note,t);
          if(p&&!entry.flicking){entry.touch=makeTouch(id,p);send('touchmove',entry);}
          if(song>=end-8){
            if(entry.endFlick&&!entry.flicking){entry.flicking=true;entry.base=p||entry.base;entry.upAt=song+40;entry.touch=makeTouch(id,{...entry.base,x:entry.base.x+entry.dx,y:entry.base.y+entry.dy});send('touchmove',entry);}
            else if(!entry.endFlick||song>=entry.upAt){send('touchend',entry);bot.live.delete(id);}
          }
        }
      }
      // 来たノーツを押す(次のコマまでに来るもの・8ms 早めまで)
      for(const [note,info] of bot.seen){
        if(info.pressed||note.timeMs>song+8)continue;
        info.pressed=true;info.pressSong=song;bot.started++;
        const p=pointAt(note,note.timeMs);if(!p){info.error='位置が出せない';continue;}
        const id=bot.nextId++;
        const type=originalType(note);
        const dir=note.flickDir==='left'?-1:note.flickDir==='right'?1:0;
        const entry={note,touch:makeTouch(id,p),base:p,dx:dir?dir*48:0,dy:dir?-4:-48};
        if(type==='FLICK'){entry.kind='flick';entry.moveAt=song+16;entry.upAt=song+40;}
        else if(type==='HOLD'||type==='SLIDE'){entry.kind='hold';entry.endMs=Number(note.endTimeMs)||note.timeMs;entry.endFlick=note.endFlick===true||note.endFlick===1;}
        else {entry.kind='tap';entry.upAt=song+40;}
        bot.live.set(id,entry);send('touchstart',entry);
      }
    }catch(e){bot.log.push(String(e&&e.stack||e));}
    return result;
  };
  const draw=RHYTHM_CANVAS_RENDERER.drawNote.bind(RHYTHM_CANVAS_RENDERER);
  RHYTHM_CANVAS_RENDERER.drawNote=(note,geo,opts)=>{
    if(note&&!bot.seen.has(note)&&Number.isFinite(note.timeMs))bot.seen.set(note,{pressed:false});
    return draw(note,geo,opts);
  };
};

const collect=()=>{
  const bot=window.__mhRobot;
  const rows=[...bot.seen].map(([note,info])=>({timeMs:note.timeMs,type:note._rhythmOriginalType||note.type,subLane:note.subLane,width:note.subLaneWidth,
    lane:note.lane,flickDir:note.flickDir||'',endFlick:!!note.endFlick,judgment:note._rhythmFinalJudgment||null,delta:note._rhythmDeltaMs,pressed:info.pressed,error:info.error||null}));
  return {rows,log:bot.log.slice(0,5)};
};

const playOne=async(browser,songIds,songId,difficulty)=>{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true});
  try{
    await page.addInitScript(seed,songIds);
    const clickText=pattern=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pattern);
    await page.goto(PAGE_URL,{waitUntil:'load',timeout:90000});
    await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),undefined,{timeout:90000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),undefined,{timeout:40000});
    for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(300);}
    const picked=await page.evaluate(id=>{const row=document.querySelector(`[data-rhythm-song-row="${id}"]`);if(!row)return false;row.scrollIntoView();row.click();return true;},songId);
    if(!picked)return {songId,difficulty,error:'曲の行が無い'};
    await page.waitForTimeout(400);
    const diffOk=await page.evaluate(d=>{const b=document.querySelector(`[data-rhythm-difficulty="${d}"]`);if(!b||b.disabled)return false;b.click();return true;},difficulty);
    if(!diffOk)return {songId,difficulty,error:'難易度を選べない'};
    await page.waitForTimeout(300);
    await page.evaluate(installRobot);
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    // 曲が終わるまで待つ(結果の画面が出る・プレイエリアが消える)
    await page.waitForFunction(()=>!document.querySelector('[data-rhythm-play-area]')||/RESULT|リザルト|もう一度/.test(document.body.innerText),undefined,{timeout:8*60*1000,polling:1000});
    await page.waitForTimeout(500);
    const data=await page.evaluate(collect);
    return {songId,difficulty,...data};
  }catch(e){const text=await page.evaluate(()=>(document.body&&document.body.innerText||'').replace(/\s+/g,' ').slice(0,200)).catch(()=>'');return {songId,difficulty,error:`${String(e.message||e).split('\n')[0]}・画面: ${text}`};}
  finally{await page.close();}
};

const summarize=result=>{
  if(result.error)return `${result.songId} ${result.difficulty}: ✗ ${result.error}`;
  const rows=result.rows||[];
  const bad=rows.filter(r=>r.judgment!=='MARVELOUS');
  const counts={};for(const r of rows)counts[r.judgment||'判定なし']=(counts[r.judgment||'判定なし']||0)+1;
  return `${result.songId} ${result.difficulty}: ${rows.length}ノーツ ${Object.entries(counts).map(([k,v])=>`${k}${v}`).join(' / ')}`
    +(bad.length?`\n    ${bad.slice(0,8).map(r=>`${(r.timeMs/1000).toFixed(2)}s ${r.type}${r.flickDir?`(${r.flickDir})`:''}${r.endFlick?'(終点フリック)':''} 幅${r.width??'-'} → ${r.judgment||'判定なし'}${Number.isFinite(r.delta)?` ${Math.round(r.delta)}ms`:''}`).join('\n    ')}${bad.length>8?`\n    ほか${bad.length-8}個`:''}`:'')
    +(result.log&&result.log.length?`\n    ロボットの失敗: ${result.log[0].split('\n')[0]}`:'');
};

(async()=>{
  const runtimeNotes=require('./rhythm-runtime-notes.js');
  const songIds=Object.keys(runtimeNotes.RELEASED_MARKERS);
  const jobs=[];
  if(process.argv.includes('--all')){
    const diffs=(arg('--difficulties','')||DIFFICULTIES.join(',')).split(',').filter(Boolean);
    const only=(arg('--songs','')||'').split(',').filter(Boolean);
    for(const s of (only.length?only:songIds))for(const d of diffs)jobs.push([s,d]);
  }else jobs.push([arg('--song','big_bridge_no_shitou'),arg('--difficulty','MASTER')]);
  const parallel=Math.max(1,Math.min(4,Number(arg('--parallel',1))||1));
  const out=arg('--out',null);
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const results=[];
  try{
    let next=0;
    const worker=async()=>{while(next<jobs.length){const [s,d]=jobs[next++];const r=await playOne(browser,songIds,s,d);results.push(r);console.log(summarize(r));
      if(out)fs.writeFileSync(out,JSON.stringify(results,null,1));}};
    await Promise.all(Array.from({length:parallel},worker));
  }finally{await browser.close();}
  const bad=results.filter(r=>r.error||(r.rows||[]).some(x=>x.judgment!=='MARVELOUS'));
  console.log(`\n${results.length}譜面・MARVELOUS でないノーツのある譜面 ${bad.length}`);
})().catch(e=>{console.error(e);process.exit(1);});
