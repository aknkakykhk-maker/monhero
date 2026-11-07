#!/usr/bin/env node
// 判定ラインの高さ(オプション)を変えても、本物のゲームで「ノーツがラインに着く」「ラインで叩くと最上の判定になる」かを確かめる(2026-11-07)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-judgment-line-height-play-check.js                 # 地上の譜面: 高さ 12/20/35/50% × 4つの向き
//   HEIGHTS=20 MODES=縦 node tools/mode/rhythm-judgment-line-height-play-check.js   # 一部だけ
//   SKY=1 node tools/mode/rhythm-judgment-line-height-play-check.js           # 空中の判定線のある譜面(HELL)も見る
//
// 【なぜ要るか】社長「モンビーのオプションの判定ラインの位置変更ってちゃんと機能してるか確認して」。
// rhythm-judgment-line-height-check.js は、作った小さなページでラインの置き場所を測るだけで、本物のゲームで叩いてはいない。
// ゲームは、判定ラインの実測(RHYTHM_JUDGMENT_LINE_Y.ratio)を、ノーツの走る先・押した点の読み替え(道は奥ほど細い)・
// 空中の受け付けの境目のすべてに使う。測り直しが遅れる場面(横画面・演奏中に回したとき)があると、見た目と押せる所がずれる。
//
// 【測り方】
// ・この環境は描くのがとても遅いので、曲の時計(AudioContext.currentTime)をこちらが 16ms ずつ進め、そのたびに本物のコマを1つ描かせる
//   (ブラウザの「仮想の時間」は、撮影をしないとコマが描かれなかった)。叩く時刻は、16ms 刻みのコマの頭で「次のコマまでに来るノーツ」を押す(ずれは ±8ms 以内)
// ・押す点は、ゲームが測った値ではなく、**画面に出ている判定ラインの要素の位置**から出す(ゲームの測り方が違っていても見つかる)。
//   横の位置は、その高さでのノーツの見た目の真ん中(rhythmNoteVisualSpan)。空中のノーツは空中の判定線の高さで押す
// ・横画面ボタンで回しているときは、押す点を画面の座標へ直して(RHYTHM_VIEW_ROTATION.unpoint)送る
// ・ノーツを描く瞬間(drawNote)の粒の中心を覚え、ノーツの時刻ちょうどの粒の中心が、ラインの中心から何px離れているかを出す
//   (縦の離れ = 着く位置のずれ、横の離れ = 押した点と粒の真ん中のずれ)
// 判定の窓・スコア・譜面には何も触らない(見るだけ・ロボット用のブラウザの中だけ)。
'use strict';
const path=require('path');
const {chromium}=require(path.join(__dirname,'..','node_modules','playwright'));

const PAGE_URL=process.env.SMOKE_URL||'http://localhost:8899/monster-hero/index.html';
const HEIGHTS=(process.env.HEIGHTS||'12,20,35,50').split(',').map(Number);
const ALL_MODES=[
  {name:'縦',viewport:{width:390,height:844},rotate:0},
  {name:'端末ごと横',viewport:{width:844,height:390},rotate:0},
  {name:'横画面ボタン',viewport:{width:390,height:844},rotate:90},
  {name:'演奏中に横画面ボタン',viewport:{width:390,height:844},rotate:0,rotateAfterMs:3000},
];
const MODES=process.env.MODES?ALL_MODES.filter(m=>process.env.MODES.split(',').includes(m.name)):ALL_MODES;
const WINDOW_MS=Number(process.env.WINDOW_MS||14000),STEP_MS=16;
// 許し: 着く位置は 2px・押した点と粒の真ん中は 2px 以内。判定は全部が最上(MARVELOUS)
const MAX_ARRIVE_PX=2,MAX_X_PX=2;
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const seed=({height,songIds,debug})=>{
  if(debug)window.__mhDebugFlag=true;
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','ロボット');put('mh_breeder_icon','Mocchi');put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);put('mh_quick_rhythm_intro_seen_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
  put('mh_rhythm_settings_v1',{judgmentLineHeight:height,autoEffectDown:false});
  const best={};for(const id of songIds){best[id]={};for(const d of ['EASY','NORMAL','HARD','EXPERT','MASTER'])best[id][d]={bestScore:1,clear:true,played:true,maxCombo:1};}
  put('mh_rhythm_best_v1',best);
  // 曲の時計: 曲を鳴らしはじめた時刻を覚え、__mhLinkSong(sec) で「その位置 + 仮想の時間の進み」にする
  // ゲームの中には、押してからの曲の時刻を performance.now の進みで見積もる所がある(指の動きの受け付け RHYTHM_GESTURE_RUNTIME)。
  // 曲の時計だけを進めると、そこが「とっくに終わりを過ぎた」と見て HOLD/SLIDE を MISS にする。performance.now と描き直しの合図の時刻も、曲の時計と同じだけ進める
  const realNow=performance.now.bind(performance);
  performance.now=()=>{const z=window.__mhClock;return z?z.perf0+z.off*1000:realNow();};
  {const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(performance.now()));}
  const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
  Object.defineProperty(proto,'currentTime',{configurable:true,get(){const z=window.__mhClock;if(z&&z.ctx===this)return z.base+z.off;return desc.get.call(this);}});
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.duration>30&&!window.__mhSong)window.__mhSong={ctx:this.context,t:desc.get.call(this.context),offset:Number(a[1])||0};return start.apply(this,a);};
  window.__mhLinkSong=()=>{const s=window.__mhSong;if(!s)return false;window.__mhClock={ctx:s.ctx,base:desc.get.call(s.ctx),off:0,perf0:realNow()};return true;};
  // 曲の時計を ms だけ進め、本物のコマを1つ描かせる
  window.__mhStep=ms=>{window.__mhClock.off+=ms/1000;return new Promise(r=>requestAnimationFrame(()=>r(window.__mhBot&&window.__mhBot.song)));};
};

// ページの中のロボットと見張り
const installRobot=({rotateAfterMs,noPointer})=>{
  window.__mhNoPointer=!!noPointer;window.__mhDebug=!!window.__mhDebugFlag;
  const bot=window.__mhBot={live:new Map(),seen:new Map(),nextId:1,song:null,log:[],arrive:[],rotatedAt:null,firstSong:null};
  const area=()=>document.querySelector('[data-rhythm-play-area]');
  const lineEl=()=>document.querySelector('[data-rhythm-judgment-line]');
  const R=RHYTHM_VIEW_ROTATION;
  // 画面に出ている判定ラインの中心(プレイエリアの上からの比)。ゲームが測った値は使わない
  const domLine=()=>{const a=area(),l=lineEl();if(!a||!l)return null;const ar=R.rectOf(a),lr=R.rectOf(l);return {rect:ar,ratio:(lr.top-ar.top+lr.height/2)/ar.height,px:lr.top-ar.top+lr.height/2};};
  const isSky=(note,t)=>rhythmNoteIsSlide(note)?(typeof rhythmSlideHasSky==='function'&&rhythmSlideHasSky(note)&&rhythmSlideSkyAt(note,t)>=.5):(typeof rhythmNoteSkyHeight==='function'&&rhythmNoteSkyHeight(note)>0);
  const original=note=>note._rhythmOriginalType||note.type;
  // 押す点(器の座標)。地上はラインの高さ・空中は空中の判定線の高さ。横はその高さでの見た目の真ん中
  const pointAt=(note,t)=>{
    const d=domLine();if(!d)return null;
    const sky=isSky(note,t),ratio=sky?d.ratio-RHYTHM_SKY_LIFT.ratio:d.ratio;
    const lane=original(note)==='SLIDE'?rhythmSlideExpectedLane(note,t):Number(note.lane)||0;
    const span=rhythmNoteVisualSpan(note,lane,ratio,t);
    return {x:d.rect.left+d.rect.width*span.center,y:d.rect.top+d.rect.height*ratio,sky};
  };
  const toScreen=p=>{if(!R.active())return p;const s=R.unpoint(p.x,p.y);return {...p,x:s.x,y:s.y};};
  const makeTouch=(id,p)=>{const s=toScreen(p);return new Touch({identifier:id,target:area(),clientX:s.x,clientY:s.y,radiusX:8,radiusY:8,force:1});};
  // 送り方は本物の指と同じ(tools/playbot/lib/touch-input.js の 'touch'): pointerType 'touch' のポインタの合図と TouchEvent の両方。
  // 押した時刻(timeStamp)は送る瞬間の performance.now(ゲームは timeStamp から遅れを引く)
  const send=(type,entry)=>{const el=area();if(!el)return;const all=[...bot.live.values()].map(e=>e.touch);const touches=type==='touchend'?all.filter(t=>t!==entry.touch):all;
    const t=entry.touch,ptype={touchstart:'pointerdown',touchmove:'pointermove',touchend:'pointerup'}[type],now=performance.now();
    const list=window.__mhNoPointer?[new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:[t]})]:[new PointerEvent(ptype,{bubbles:true,cancelable:true,pointerId:t.identifier,pointerType:'touch',isPrimary:false,clientX:t.clientX,clientY:t.clientY,width:16,height:16,pressure:type==='touchend'?0:.5,buttons:type==='touchend'?0:1}),
      new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:[t]})];
    for(const e of list){Object.defineProperty(e,'timeStamp',{value:now});el.dispatchEvent(e);}};
  const perfSong=RHYTHM_PERF.songTime.bind(RHYTHM_PERF);
  RHYTHM_PERF.songTime=song=>{
    const result=perfSong(song);bot.song=song;bot.frames=(bot.frames||0)+1;(bot.songs||(bot.songs=[])).length<400&&bot.songs.push(Math.round(song));if(bot.firstSong===null)bot.firstSong=song;
    try{
      if(rotateAfterMs&&bot.rotatedAt===null&&song>=bot.firstSong+rotateAfterMs){bot.rotatedAt=song;R.set(90);}
      for(const [id,entry] of [...bot.live]){
        const note=entry.note;
        if(entry.kind==='tap'&&song>=entry.upAt){send('touchend',entry);bot.live.delete(id);continue;}
        if(entry.kind==='flick'){
          if(!entry.moved&&song>=entry.moveAt){entry.touch=makeTouch(id,{...entry.base,x:entry.base.x+entry.dx,y:entry.base.y+entry.dy});send('touchmove',entry);entry.moved=true;}
          else if(entry.moved&&song>=entry.upAt){send('touchend',entry);bot.live.delete(id);}
          continue;
        }
        if(entry.kind==='hold'){
          const end=entry.endMs,t=Math.min(song,end),p=pointAt(note,t);
          if(p&&!entry.flicking){entry.base=p;entry.touch=makeTouch(id,p);send('touchmove',entry);}
          if(song>=end-8){
            if(entry.endFlick&&!entry.flicking){entry.flicking=true;entry.upAt=song+40;entry.touch=makeTouch(id,{...entry.base,x:entry.base.x+entry.dx,y:entry.base.y+entry.dy});send('touchmove',entry);}
            else if(!entry.endFlick||song>=entry.upAt){send('touchend',entry);bot.live.delete(id);if(window.__mhDebug)bot.log.push('離した '+Math.round(note.timeMs)+' 曲 '+Math.round(song)+' 終わり '+Math.round(end)+' 位置 '+Math.round(entry.base.x)+','+Math.round(entry.base.y));}
          }
        }
      }
      for(const [note,info] of bot.seen){
        if(info.pressed||note.timeMs>song+8)continue;
        info.pressed=true;info.pressSong=song;
        const p=pointAt(note,note.timeMs);if(!p){info.error='位置が出せない';continue;}
        info.sky=p.sky;
        const id=bot.nextId++,type=original(note),dir=note.flickDir==='left'?-1:note.flickDir==='right'?1:0;
        const entry={note,touch:makeTouch(id,p),base:p,dx:dir?dir*48:0,dy:dir?-4:-48};
        if(type==='FLICK'){entry.kind='flick';entry.moveAt=song+16;entry.upAt=song+40;}
        else if(type==='HOLD'||type==='SLIDE'){entry.kind='hold';
          // 離す時刻は押した瞬間に読んで覚える(ゲームは取れた HOLD/SLIDE のノーツを書き換えるので、あとから読むと違う値になる)
          entry.endMs=rhythmReleaseTargetMs(note)||Number(note.endTimeMs)||note.timeMs;entry.endFlick=note.endFlick===true||note.endFlick===1;}
        else{entry.kind='tap';entry.upAt=song+40;}
        bot.live.set(id,entry);send('touchstart',entry);
      }
    }catch(e){bot.log.push(String(e&&e.stack||e).slice(0,300));}
    return result;
  };
  // 描く瞬間の粒の中心を覚える(ノーツの時刻の前後のコマから、時刻ちょうどの位置を出す)
  const draw=RHYTHM_CANVAS_RENDERER.drawNote.bind(RHYTHM_CANVAS_RENDERER);
  RHYTHM_CANVAS_RENDERER.drawNote=(note,geo,opts)=>{
    if(note&&Number.isFinite(note.timeMs)){
      if(!bot.seen.has(note))bot.seen.set(note,{pressed:false,rows:[]});
      const info=bot.seen.get(note);
      if(geo&&geo.head&&Number.isFinite(bot.song)&&Math.abs(bot.song-note.timeMs)<120&&!(original(note)==='SLIDE')){
        const d=domLine(),p=pointAt(note,note.timeMs);
        if(d&&p&&info.rows.length<12)info.rows.push([bot.song,geo.head.cy,geo.head.cx,p.sky?d.px-d.rect.height*RHYTHM_SKY_LIFT.ratio:d.px,p.x-d.rect.left,R.active()?1:0]);
      }
    }
    return draw(note,geo,opts);
  };
};

const collect=()=>{
  const bot=window.__mhBot;
  const rows=[...bot.seen].filter(([,info])=>info.pressed).map(([note,info])=>{
    // ノーツの時刻をまたぐ2コマから、時刻ちょうどの粒の位置を出す
    let arrive=null;const r=info.rows.slice().sort((a,b)=>a[0]-b[0]);
    for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];if(a[0]<=note.timeMs&&b[0]>=note.timeMs&&a[5]===b[5]&&b[0]>a[0]){const k=(note.timeMs-a[0])/(b[0]-a[0]);
      arrive={dy:(a[1]+(b[1]-a[1])*k)-(a[3]+(b[3]-a[3])*k),dx:(a[2]+(b[2]-a[2])*k)-(a[4]+(b[4]-a[4])*k)};break;}}
    return {timeMs:note.timeMs,type:note._rhythmOriginalType||note.type,flickDir:note.flickDir||'',endFlick:!!note.endFlick,sky:!!info.sky,
      judgment:note._rhythmFinalJudgment||null,delta:note._rhythmDeltaMs,hold:note.holdJudgment||null,holdDelta:note.holdDeltaMs,endMs:note.endTimeMs,pressSong:info.pressSong,error:info.error||null,arrive};
  });
  const line=document.querySelector('[data-rhythm-judgment-line]'),area=document.querySelector('[data-rhythm-play-area]');
  let lineRatio=null;if(line&&area){const a=RHYTHM_VIEW_ROTATION.rectOf(area),l=RHYTHM_VIEW_ROTATION.rectOf(line);lineRatio=(l.top-a.top+l.height/2)/a.height;}
  return {frames:bot.frames,songs:(bot.songs||[]).filter((_,i)=>i%10===0),rows,log:bot.log.slice(0,5),rotatedAt:bot.rotatedAt,lineRatio,gameRatio:RHYTHM_JUDGMENT_LINE_Y.ratio,angle:RHYTHM_VIEW_ROTATION.get()};
};

// 地上の譜面のうち、はじめのノーツから WINDOW_MS のあいだに TAP・HOLD・SLIDE・FLICK(上・横)がそろう譜面を選ぶ(いちばん早くそろうもの)
const pickChart=()=>{
  let best=null;
  for(const song of RHYTHM_SONGS){for(const diff of ['HARD','EXPERT','MASTER']){
    const chart=song.difficulties&&song.difficulties[diff];if(!chart||!Array.isArray(chart.notes)||!chart.notes.length)continue;
    const notes=[...chart.notes].sort((a,b)=>a.timeMs-b.timeMs),t0=notes[0].timeMs,need=new Set(['TAP','HOLD','SLIDE','FLICK','FLICK_SIDE']);
    let doneAt=null;for(const n of notes){if(n.timeMs>t0+12000)break;const k=n.type==='FLICK'&&(n.flickDir==='left'||n.flickDir==='right')?'FLICK_SIDE':n.type;need.delete(k);if(!need.size){doneAt=n.timeMs;break;}}
    if(doneAt!==null&&(!best||doneAt<best.doneAt))best={songId:song.songId,name:song.displayName,diff,doneAt,firstMs:t0};
  }}
  return best;
};

const playOne=async(browser,songIds,chart,height,mode)=>{
  const page=await browser.newPage({viewport:mode.viewport,deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  try{
    await page.addInitScript(seed,{height,songIds,debug:!!process.env.DEBUG});
    const clickText=p=>page.evaluate(s=>{const rx=new RegExp(s);const b=[...document.querySelectorAll('button')].find(x=>rx.test((x.innerText||'').replace(/\s+/g,' ').trim()));if(!b)return false;b.click();return true;},p);
    await page.goto(PAGE_URL,{waitUntil:'load',timeout:90000});
    await page.waitForFunction(()=>document.body&&document.body.innerText.includes('TAP TO START'),undefined,{timeout:90000});
    await page.getByRole('button',{name:'TAP TO START'}).click({force:true});
    await page.getByRole('button',{name:'トップ画面へ進む'}).click({timeout:30000});
    await page.waitForFunction(()=>document.body.innerText.includes('モンヒロビート'),undefined,{timeout:40000});
    for(let i=0;i<8;i++){if(!(await clickText('受け取る|閉じる|OK|スキップ')))break;await page.waitForTimeout(250);}
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]',{timeout:30000}).catch(()=>{});
    await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
    await page.waitForSelector('[data-rhythm-demo-start]',{timeout:30000});
    for(let i=0;i<6;i++){if(!(await clickText('^確認$|受け取る|閉じる|OK|^スキップ$')))break;await page.waitForTimeout(300);}
    // 曲は id で選ぶ(同じ曲名の版があるため)
    await page.evaluate(id=>document.querySelector(`[data-rhythm-song-row="${id}"]`)?.click(),chart.songId);
    await page.waitForTimeout(500);
    await clickText('^\\d+ '+chart.diff);await page.waitForTimeout(300);
    if(mode.rotate)await page.evaluate(a=>RHYTHM_VIEW_ROTATION.set(a),mode.rotate);
    await page.evaluate(installRobot,{rotateAfterMs:mode.rotateAfterMs||0,noPointer:process.env.NOPOINTER==='1'});
    await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
    await page.waitForFunction(()=>!!window.__mhSong,undefined,{timeout:60000,polling:20});
    // 鳴りはじめた瞬間に曲の時計を仮想の時間へつなぐ(はじめのノーツより前なので、取りこぼしは出ない)
    await page.evaluate(()=>window.__mhLinkSong());
    const advance=ms=>page.evaluate(m=>window.__mhStep(m),ms);
    const endMs=chart.firstMs+WINDOW_MS;
    for(let guard=0;guard<20000;guard++){
      const s=await advance(STEP_MS);
      if(Number.isFinite(s)&&s>=endMs)break;
    }
    // 終わりのころに押した HOLD/SLIDE の判定が付くまで、もう少しだけ進める
    for(let k=0;k<20;k++)await advance(STEP_MS);
    const out=await page.evaluate(collect);
    return {...out,errors};
  }finally{await page.close();}
};

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  try{
    const probe=await browser.newPage();await probe.goto(PAGE_URL,{waitUntil:'load',timeout:90000});
    await probe.waitForFunction(()=>typeof RHYTHM_SONGS!=='undefined'&&RHYTHM_SONGS.length>0,undefined,{timeout:90000});
    const songIds=await probe.evaluate(()=>RHYTHM_SONGS.map(s=>s.songId));
    const chart=await probe.evaluate(pickChart);await probe.close();
    if(!chart)throw new Error('TAP・HOLD・SLIDE・FLICK がはじめにそろう譜面が見つからない');
    console.log(`譜面: ${chart.name} ${chart.diff}(はじめのノーツ ${(chart.firstMs/1000).toFixed(1)}秒から ${WINDOW_MS/1000}秒ぶん)`);
    for(const height of HEIGHTS){for(const mode of MODES){
      let r;try{r=await playOne(browser,songIds,chart,height,mode);}catch(e){r={error:String(e.message||e).split('\n')[0],rows:[]};}
      results.push({height,mode:mode.name,...r});
      const rows=r.rows||[],counts={};for(const x of rows)counts[x.judgment||'判定なし']=(counts[x.judgment||'判定なし']||0)+1;
      const ar=rows.map(x=>x.arrive).filter(Boolean),maxDy=ar.length?Math.max(...ar.map(a=>Math.abs(a.dy))):NaN,maxDx=ar.length?Math.max(...ar.map(a=>Math.abs(a.dx))):NaN;
      const types={};for(const x of rows){const k=x.type+(x.flickDir?`(${x.flickDir})`:'')+(x.sky?'・空中':'');types[k]=(types[k]||0)+1;}
      if(process.env.DEBUG)console.log('コマ',r.frames,JSON.stringify(r.songs));console.log(`  ${height}% ${mode.name}: ノーツ ${rows.length}個 ${JSON.stringify(counts)}・着く位置のずれ 最大 ${maxDy.toFixed(2)}px・押した点と粒の真ん中 最大 ${maxDx.toFixed(2)}px`
        +`・ライン(画面) 上から${r.lineRatio!==null&&r.lineRatio!==undefined?(r.lineRatio*100).toFixed(1):'-'}% / ゲームの実測 ${r.gameRatio?(r.gameRatio*100).toFixed(1):'-'}%${r.rotatedAt?`・${Math.round(r.rotatedAt)}ms で回した(角度 ${r.angle})`:''}`
        +`\n      種類 ${JSON.stringify(types)}${r.error?`\n      止まった: ${r.error}`:''}${(r.log||[]).length?`\n      ロボットの記録: ${r.log[0]}`:''}${(r.errors||[]).length?`\n      ページのエラー: ${r.errors[0]}`:''}`);
      const bad=rows.filter(x=>x.judgment!=='MARVELOUS');
      if(bad.length)console.log('      最上でなかったもの: '+bad.slice(0,6).map(x=>`${(x.timeMs/1000).toFixed(2)}s ${x.type}${x.flickDir?`(${x.flickDir})`:''}${x.sky?'(空中)':''} → ${x.judgment||'判定なし'}${Number.isFinite(x.delta)?` ${Math.round(x.delta)}ms`:''}・押した曲の時刻 ${Math.round(x.pressSong)}${x.hold?`・終わり ${x.hold}(${Math.round(x.holdDelta)}ms・終わりの時刻 ${Math.round(x.endMs)})`:''}`).join(' / '));
    }}
  }finally{await browser.close();}
  for(const r of results){
    const rows=r.rows||[],label=`${r.height}% ${r.mode}`;
    const kinds=new Set(rows.map(x=>x.type));
    ok(`${label}: 遊べた(TAP・HOLD・SLIDE・FLICK を押した)`,!r.error&&['TAP','HOLD','SLIDE','FLICK'].every(k=>kinds.has(k)),r.error||[...kinds].join('・'));
    ok(`${label}: 画面のラインと、ゲームが測ったラインがそろう(0.3% 以内)`,Number.isFinite(r.lineRatio)&&Number.isFinite(r.gameRatio)&&Math.abs(r.lineRatio-r.gameRatio)<.003,`画面 ${(r.lineRatio*100).toFixed(2)}% / ゲーム ${(r.gameRatio*100).toFixed(2)}%`);
    const ar=rows.map(x=>x.arrive).filter(Boolean);
    ok(`${label}: ノーツの時刻に、粒の中心がラインに着く(${MAX_ARRIVE_PX}px 以内)`,ar.length>=10&&ar.every(a=>Math.abs(a.dy)<=MAX_ARRIVE_PX),`${ar.length}個・最大 ${ar.length?Math.max(...ar.map(a=>Math.abs(a.dy))).toFixed(2):'-'}px`);
    ok(`${label}: 押した点(ラインの高さの真ん中)と粒の真ん中がそろう(${MAX_X_PX}px 以内)`,ar.length>=10&&ar.every(a=>Math.abs(a.dx)<=MAX_X_PX),`最大 ${ar.length?Math.max(...ar.map(a=>Math.abs(a.dx))).toFixed(2):'-'}px`);
    const bad=rows.filter(x=>x.judgment!=='MARVELOUS');
    ok(`${label}: ラインの高さで時刻ちょうどに押すと、全部が最上の判定(MARVELOUS)`,rows.length>=20&&bad.length===0,`${rows.length}個中 ${bad.length}個`);
  }
  console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 判定ラインの高さを変えても、縦でも横でも、ノーツはラインに着き、ラインで押すと最上の判定になる');
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
