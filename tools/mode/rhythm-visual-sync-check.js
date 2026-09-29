#!/usr/bin/env node
// 縦・横で、ノーツが判定ラインに見える時刻と曲の時刻がそろっているかを、本物のゲームで1コマずつ測る(2026-09-29)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-visual-sync-check.js
//
// 【なぜ要るか】ユーザー「横だと音にあわせて違和感があるような気がした」。
// 計算の上では、描く時刻(曲の時刻 − 判定タイミング調整)もノーツの位置の式も向きに関係しない。
// それでも、画面を回したあと測り直しが遅れる・横で描くのが重くてコマが落ちる、などがあれば実際にはずれる。
// そこでロボットにふつうに遊ばせ(押すのはゲームのオートではなく、見るだけ)、次の3つで比べる。
//   ・縦(390×844)
//   ・端末ごと横(844×390)
//   ・縦のまま、横画面ボタンで回す(RHYTHM_VIEW_ROTATION.set(90))
// 測り方: ノーツを描く瞬間(RHYTHM_CANVAS_RENDERER.drawNote)に、その粒の中心の高さとその回の曲の時刻を記録し、
// 粒の中心が判定ラインの中心を通り過ぎたコマの前後から、ちょうど重なった曲の時刻を補間して出す。
// 「重なった曲の時刻 − ノーツの時刻」がずれ(判定タイミング調整は 0 のまま)。
'use strict';
const {chromium}=require('playwright');

const PAGE_URL=process.env.SMOKE_URL||'http://localhost:8899/monster-hero/index.html';
const MEASURE_MS=Number(process.env.MEASURE_MS||20000);
// ずれの許し: 1コマ(60fpsで17ms)の半分ほど。これを超えてそろっていないなら、見た目と音がずれている
const MAX_MEDIAN_MS=10,MAX_SPREAD_MS=12;
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const seed=()=>{
  const put=(k,v)=>{if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify(v));};
  put('mh_breeder_name','テスト');put('mh_breeder_icon','Mocchi');put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);
};

// ページの中で動かす見張り。描く瞬間の粒の高さと曲の時刻を貯める
const installProbe=()=>{
  const probe=window.__mhSyncProbe={song:null,frames:0,rows:[],frameGaps:[],lastFrameAt:null,line:null};
  const perfSong=RHYTHM_PERF.songTime.bind(RHYTHM_PERF);
  RHYTHM_PERF.songTime=ms=>{
    probe.song=ms;probe.frames++;
    const now=performance.now();if(probe.lastFrameAt!==null)probe.frameGaps.push(now-probe.lastFrameAt);probe.lastFrameAt=now;
    // 判定ラインの中心(プレイエリアの上からの高さ)。回しているときも同じ向きで測る
    const area=document.querySelector('[data-rhythm-play-area]'),line=document.querySelector('[data-rhythm-judgment-line]');
    if(area&&line){const a=RHYTHM_VIEW_ROTATION.rectOf(area),l=RHYTHM_VIEW_ROTATION.rectOf(line);probe.line=l.top-a.top+l.height/2;probe.areaH=a.height;}
    return perfSong(ms);
  };
  const draw=RHYTHM_CANVAS_RENDERER.drawNote.bind(RHYTHM_CANVAS_RENDERER);
  RHYTHM_CANVAS_RENDERER.drawNote=(note,geo,opts)=>{
    if(geo&&geo.head&&Number.isFinite(probe.song)&&probe.line!==null&&!note.done)
      probe.rows.push([note.timeMs,geo.head.cy,probe.song,probe.line,probe.frames]);
    return draw(note,geo,opts);
  };
};

// 記録から、ノーツごとに「粒の中心が判定ラインを通った曲の時刻 − ノーツの時刻」を出す
const analyse=rows=>{
  const byNote=new Map();
  for(const [timeMs,cy,song,line,frame] of rows){const list=byNote.get(timeMs)||[];list.push({cy,song,line,frame});byNote.set(timeMs,list);}
  const errors=[];
  for(const [timeMs,list] of byNote){
    list.sort((a,b)=>a.frame-b.frame);
    for(let i=1;i<list.length;i++){
      const a=list[i-1],b=list[i];
      const da=a.cy-a.line,db=b.cy-b.line;
      if(da<0&&db>=0&&b.cy>a.cy&&b.frame-a.frame<=2){
        const crossSong=a.song+(b.song-a.song)*(-da)/(db-da);
        errors.push(crossSong-timeMs);break;
      }
    }
  }
  errors.sort((x,y)=>x-y);
  const q=p=>errors.length?errors[Math.min(errors.length-1,Math.floor(errors.length*p))]:NaN;
  return {count:errors.length,median:q(.5),p10:q(.1),p90:q(.9)};
};

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required']});
  const modes=[
    {name:'縦',viewport:{width:390,height:844},rotate:0},
    {name:'端末ごと横',viewport:{width:844,height:390},rotate:0},
    {name:'横画面ボタンで回す',viewport:{width:390,height:844},rotate:90},
  ];
  const results={};
  try{
    for(const mode of modes){
      const page=await browser.newPage({viewport:mode.viewport,deviceScaleFactor:2,hasTouch:true,isMobile:true});
      await page.addInitScript(seed);
      const clickText=pattern=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},pattern);
      await page.goto(PAGE_URL,{waitUntil:'load',timeout:60000});
      await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),{timeout:60000});
      await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
      await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
      await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),{timeout:40000});
      for(let i=0;i<6;i++){if(!(await clickText('受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(250);}
      await clickText('モンヒロビート');
      await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
      for(let i=0;i<5;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|とじる')))break;await page.waitForTimeout(300);}
      if(mode.rotate)await page.evaluate(angle=>RHYTHM_VIEW_ROTATION.set(angle),mode.rotate);
      await page.evaluate(installProbe);
      await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
      await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
      await page.waitForFunction(()=>window.__mhSyncProbe&&window.__mhSyncProbe.rows.length>50,{timeout:60000,polling:200});
      await page.waitForTimeout(MEASURE_MS);
      const probe=await page.evaluate(()=>{const p=window.__mhSyncProbe;const gaps=p.frameGaps.slice(20).sort((a,b)=>a-b);
        return {rows:p.rows,frames:p.frames,areaH:p.areaH,line:p.line,gapMedian:gaps[gaps.length>>1],gapP95:gaps[Math.floor(gaps.length*.95)],long:gaps.filter(g=>g>33).length};});
      const r=analyse(probe.rows);
      results[mode.name]={...r,areaH:probe.areaH,gapMedian:probe.gapMedian,gapP95:probe.gapP95,long:probe.long,frames:probe.frames};
      console.log(`${mode.name}: 測れたノーツ ${r.count}個・ずれの中央 ${r.median.toFixed(1)}ms(1割 ${r.p10.toFixed(1)} / 9割 ${r.p90.toFixed(1)})`
        +`・プレイエリアの高さ ${Math.round(probe.areaH)}px・コマの間隔 中央 ${probe.gapMedian.toFixed(1)}ms / 95% ${probe.gapP95.toFixed(1)}ms・33ms を超えたコマ ${probe.long}`);
      await page.close();
    }
  }finally{await browser.close();}
  for(const [name,r] of Object.entries(results)){
    ok(`${name}: ノーツが判定ラインに見える時刻が、ノーツの時刻とそろっている(中央 ±${MAX_MEDIAN_MS}ms)`,r.count>=20&&Math.abs(r.median)<=MAX_MEDIAN_MS,`${r.count}個・中央 ${r.median.toFixed(1)}ms`);
    ok(`${name}: ばらつき(1割〜9割の幅)が ${MAX_SPREAD_MS*2}ms 以内`,r.p90-r.p10<=MAX_SPREAD_MS*2,`${(r.p90-r.p10).toFixed(1)}ms`);
  }
  const names=Object.keys(results);
  if(names.length===3){
    const diff=Math.max(...names.map(n=>results[n].median))-Math.min(...names.map(n=>results[n].median));
    ok('縦と横でずれの中央の差が 5ms 以内',diff<=5,`${diff.toFixed(1)}ms`);
  }
  console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 縦でも横でも、ノーツが見える時刻と曲の時刻はそろっている');
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
