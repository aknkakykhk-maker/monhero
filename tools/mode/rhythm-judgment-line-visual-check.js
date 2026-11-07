#!/usr/bin/env node
// ノーツの絵が、ノーツの時刻ちょうどに判定ラインの「見た目の中心」に重なっているかを、本物のゲームの画面を撮って画素で測る(2026-11-07)。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-judgment-line-visual-check.js                  # 高さ 12/20/35/50% × 縦・横 と、描き方・演出量・速さ・色の違い
//   ONLY=20%縦 node tools/mode/rhythm-judgment-line-visual-check.js      # 1つだけ(名前の一部)
//   SHOT_DIR=<フォルダ> …                                                # ノーツがラインに着いた瞬間の絵を書き出す
//
// 【なぜ要るか】社長「見た目からして違うって声があった」(判定ラインの位置が、見た目からしてずれている)。
// rhythm-judgment-line-height-check.js は DOM の線の位置しか見ていない。ノーツは canvas / WebGL に描くので、
// 「描いた粒が、判定の時刻にラインのどこに来ているか」は画面を撮らないと分からない。
//
// 【測り方】
// ・曲の時計(と performance.now)をこちらが進め、地上の TAP の時刻ちょうどで止める(rhythm-judgment-line-height-play-check.js と同じ仕掛け)
// ・同じ瞬間を2枚撮る: ふつうの画面と、ノーツだけ描かない画面。2枚の差の強い所 = 粒の本体(光のにじみは差が弱いので入れない)
// ・ノーツの無い1枚から、ノーツの横の列の明るさを行ごとに足し、ライン付近でいちばん明るい行 = ラインの見た目の中心
// ・出す数字(px・画面の CSS px):
//     粒の中心 − ラインの見た目の中心 / 粒の上端・下端 − ラインの見た目の中心 / ライン要素(DOM)の中心 − 見た目の中心
// 判定の窓・スコア・譜面には何も触らない(撮って測るだけ)。
'use strict';
const path=require('path'),fs=require('fs');
const {chromium}=require(path.join(__dirname,'..','node_modules','playwright'));

const PAGE_URL=process.env.SMOKE_URL||'http://localhost:8899/monster-hero/index.html';
const SHOT_DIR=process.env.SHOT_DIR||'',SHOT_SUFFIX=process.env.SHOT_SUFFIX||'';
// CSS … 撮るときだけ重ねる CSS(判定ラインの見た目の案を、直す前に絵で比べるとき)
const EXTRA_CSS=process.env.CSS||'';
// 許し: 粒の中心とラインの見た目の中心は 1.5px 以内・ライン要素と見た目の中心は 1.5px 以内
const MAX_CENTER_PX=1.5,MAX_LINE_PX=1.5;
const V=(name,o)=>({name,viewport:{width:390,height:844},height:20,settings:{},storage:{},...o});
const PORTRAIT={width:390,height:844},LANDSCAPE={width:844,height:390};
const ALL=[
  ...[12,20,35,50].flatMap(h=>[V(`${h}%縦`,{height:h,viewport:PORTRAIT}),V(`${h}%横`,{height:h,viewport:LANDSCAPE})]),
  V('20%縦 Canvas',{storage:{mh_rhythm_canvas_v1:'canvas'}}),
  V('20%縦 WebGL',{storage:{mh_rhythm_canvas_v1:'webgl'}}),
  V('20%縦 演出量 最小',{settings:{effectAmount:'MINIMAL'}}),
  V('20%縦 演出量 多め',{settings:{effectAmount:'NORMAL'}}),
  V('20%縦 速さ 遅い',{settings:{noteSpeed:3}}),
  V('20%縦 速さ 速い',{settings:{noteSpeed:11}}),
  V('20%縦 ノーツの色 ネオン',{settings:{notePalette:'NEON'}}),
  V('20%縦 ノーツの大きさ 130',{settings:{noteSize:130}}),
];
// ONLY … 名前の一部 / NAMES … 名前をそのまま(カンマ区切り)
const LIST=process.env.NAMES?ALL.filter(v=>process.env.NAMES.split(',').includes(v.name)):process.env.ONLY?ALL.filter(v=>v.name.includes(process.env.ONLY)):ALL;
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const seed=({height,settings,storage,songIds})=>{
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  put('mh_breeder_name','ロボット');put('mh_breeder_icon','Mocchi');put('mh_onboarded',true);
  put('mh_tutorial_seen_v1',true);put('mh_battle_tutorial_seen_v1',true);put('mh_battle_tutorial_guide_shown_v1',true);
  put('mh_rhythm_tutorial_seen_v1',true);put('mh_quick_rhythm_intro_seen_v1',true);put('mh_rhythm_six_lane_seen_v1',true);put('mh_rhythm_look_intro_seen_v1',true);
  put('mh_rhythm_settings_v1',{judgmentLineHeight:height,autoEffectDown:false,...settings});
  for(const [k,v] of Object.entries(storage||{}))localStorage.setItem(k,v);
  const best={};for(const id of songIds){best[id]={};for(const d of ['EASY','NORMAL','HARD','EXPERT','MASTER'])best[id][d]={bestScore:1,clear:true,played:true,maxCombo:1};}
  put('mh_rhythm_best_v1',best);
  const realNow=performance.now.bind(performance);
  performance.now=()=>{const z=window.__mhClock;return z?z.perf0+z.off*1000:realNow();};
  {const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(performance.now()));}
  const proto=BaseAudioContext.prototype,desc=Object.getOwnPropertyDescriptor(proto,'currentTime');
  Object.defineProperty(proto,'currentTime',{configurable:true,get(){const z=window.__mhClock;if(z&&z.ctx===this)return z.base+z.off;return desc.get.call(this);}});
  const start=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer&&this.buffer.duration>30&&!window.__mhSong)window.__mhSong={ctx:this.context,t:desc.get.call(this.context),offset:Number(a[1])||0};return start.apply(this,a);};
  window.__mhLinkSong=()=>{const s=window.__mhSong;if(!s)return false;window.__mhClock={ctx:s.ctx,base:desc.get.call(s.ctx),off:0,perf0:realNow()};return true;};
  window.__mhStep=ms=>{window.__mhClock.off+=ms/1000;return new Promise(r=>requestAnimationFrame(()=>r(window.__mhWatch&&window.__mhWatch.song)));};
};

// 描いた曲の時刻と、ノーツごとの最後に描いた粒の位置を覚える。__mhHideNotes のあいだはノーツを描かない
const installWatch=()=>{
  const w=window.__mhWatch={song:null,geo:new Map()};
  const perfSong=RHYTHM_PERF.songTime.bind(RHYTHM_PERF);
  RHYTHM_PERF.songTime=song=>{w.song=song;return perfSong(song);};
  const draw=RHYTHM_CANVAS_RENDERER.drawNote.bind(RHYTHM_CANVAS_RENDERER);
  RHYTHM_CANVAS_RENDERER.drawNote=(note,geo,opts)=>{
    if(note&&geo&&geo.head)w.geo.set(note.timeMs,{song:w.song,cx:geo.head.cx,cy:geo.head.cy,w:geo.head.w,h:geo.head.h,type:note._rhythmOriginalType||note.type,lane:note.lane});
    // 隠すときも「透明で描く」。何も描かないコマは描き手が前の絵を消さずに残すので、描かないと2枚が同じ絵になる
    if(window.__mhHideNotes)return draw(note,geo,{...opts,alpha:0});
    return draw(note,geo,opts);
  };
};

const startPlay=async(page,v,songIds,chart)=>{
  await page.addInitScript(seed,{height:v.height,settings:v.settings,storage:v.storage,songIds});
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
  await page.evaluate(id=>document.querySelector(`[data-rhythm-song-row="${id}"]`)?.click(),chart.songId);
  await page.waitForTimeout(500);
  await clickText('^\\d+ '+chart.diff);await page.waitForTimeout(300);
  await page.evaluate(()=>document.querySelector('[data-rhythm-demo-start]').click());
  await page.waitForSelector('[data-rhythm-play-area]',{timeout:30000});
  // 見張りは演奏が始まってから入れる(ノーツの色を選んでいると、演奏の頭で描き手を作り直すため)
  await page.evaluate(installWatch);
  await page.waitForFunction(()=>!!window.__mhSong,undefined,{timeout:60000,polling:20});
  await page.evaluate(()=>window.__mhLinkSong());
};

// 2枚の絵(ノーツあり・なし)から、粒の上端・下端とラインの見た目の中心を出す(画面の CSS px・切り抜きの上からの位置)
const analyse=async(page,a,b,dpr,clip)=>page.evaluate(async({a,b,dpr,clip})=>{
  const load=src=>new Promise(r=>{const im=new Image();im.onload=()=>r(im);im.src=src;});
  const [ia,ib]=await Promise.all([load(a),load(b)]);
  const px=im=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data;};
  const A=px(ia),B=px(ib),W=ia.width,H=ia.height;
  // 粒の本体: 真ん中 40% の列で、2枚の差(RGB の差の合計)が 150 を超える行
  const x0=Math.floor(W*.3),x1=Math.ceil(W*.7);
  const rows=[];for(let y=0;y<H;y++){let n=0;for(let x=x0;x<x1;x++){const i=(y*W+x)*4;const d=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);if(d>150)n++;}rows.push(n/(x1-x0));}
  let top=-1,bottom=-1;for(let y=0;y<H;y++)if(rows[y]>.5){if(top<0)top=y;bottom=y;}
  // ラインの見た目の中心: ノーツの無い絵の、行ごとの明るさ(R+G+B の平均)がいちばん高い行(同じ明るさが続くときはその真ん中)
  const lum=[];for(let y=0;y<H;y++){let s=0;for(let x=0;x<W;x++){const i=(y*W+x)*4;s+=B[i]+B[i+1]+B[i+2];}lum.push(s/W);}
  const max=Math.max(...lum);const peak=[];lum.forEach((v,y)=>{if(v>=max-6)peak.push(y);});
  const lineRow=(peak[0]+peak[peak.length-1])/2;
  // 明るい帯(いちばん明るい行の半分を超える行)の上下
  let bt=-1,bb=-1;lum.forEach((v,y)=>{if(v>max*.5){if(bt<0)bt=y;bb=y;}});
  const toCss=y=>clip.y+(y+.5)/dpr;
  return {headTop:top<0?null:toCss(top)-.5/dpr,headBottom:bottom<0?null:toCss(bottom)+.5/dpr,lineCore:toCss(lineRow),bandTop:toCss(bt),bandBottom:toCss(bb)};
},{a,b,dpr,clip});

const measureOne=async(browser,v,songIds,chart)=>{
  const DPR=2;
  const page=await browser.newPage({viewport:v.viewport,deviceScaleFactor:DPR,hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  try{
    await startPlay(page,v,songIds,chart);
    const step=ms=>page.evaluate(m=>window.__mhStep(m),ms);
    // 撮るノーツ: はじめの地上の TAP(空中でない・前後 300ms にほかのノーツが無いもの)
    const target=chart.targetMs;
    for(let guard=0;guard<4000;guard++){const s=await step(16);if(Number.isFinite(s)&&s>=target-40)break;}
    // 描く時刻がノーツの時刻ちょうどになるよう、時計を合わせる(2回で合う)
    for(let k=0;k<3;k++){await page.evaluate(t=>{const w=window.__mhWatch;window.__mhClock.off+=(t-w.song)/1000;return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},target);}
    if(EXTRA_CSS)await page.addStyleTag({content:EXTRA_CSS});
    await page.addStyleTag({content:'[data-rhythm-judgment-display],[data-rhythm-life],[data-rhythm-down-vignette],[data-rhythm-life-down-slam]{visibility:hidden!important}'});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const info=await page.evaluate(t=>{
      const w=window.__mhWatch,g=w.geo.get(t),area=document.querySelector('[data-rhythm-play-area]'),line=document.querySelector('[data-rhythm-judgment-line]');
      const ar=area.getBoundingClientRect(),lr=line.getBoundingClientRect();
      return {song:w.song,geo:g||null,area:{left:ar.left,top:ar.top,width:ar.width,height:ar.height},line:{top:lr.top,height:lr.height,center:lr.top+lr.height/2},gameRatio:RHYTHM_JUDGMENT_LINE_Y.ratio,
        lineStyle:(()=>{const s=getComputedStyle(line);return {h:s.height,bg:s.backgroundImage.slice(0,80),shadow:s.boxShadow.slice(0,80)};})()};
    },target);
    if(!info.geo)throw new Error('撮るノーツの粒の位置が取れない');
    const cx=info.area.left+info.geo.cx,cy=info.area.top+info.geo.cy,hw=Math.max(20,info.geo.w/2+12);
    const clip={x:Math.max(0,Math.round(cx-hw)),y:Math.max(0,Math.round(info.line.center-36)),width:Math.round(hw*2),height:72};
    // 描き直しが画面に出るまで少し待ってから撮る(待たないと、2枚が同じ絵になることがあった)
    await page.waitForTimeout(400);
    const a=await page.screenshot({clip});
    await page.evaluate(()=>{window.__mhHideNotes=true;return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    await page.waitForTimeout(400);
    const b=await page.screenshot({clip});
    await page.evaluate(()=>{window.__mhHideNotes=false;});
    if(SHOT_DIR){fs.mkdirSync(SHOT_DIR,{recursive:true});
      const wide={x:Math.max(0,Math.round(info.area.left)),y:Math.max(0,Math.round(info.line.center-140)),width:Math.round(info.area.width),height:Math.min(220,Math.round(v.viewport.height-Math.max(0,info.line.center-140)))};
      await page.screenshot({path:path.join(SHOT_DIR,`line-${v.name.replace(/[\s/]+/g,'_')}${SHOT_SUFFIX}.png`),clip:wide});}
    const m=await analyse(page,'data:image/png;base64,'+a.toString('base64'),'data:image/png;base64,'+b.toString('base64'),DPR,clip);
    return {...info,cyScreen:cy,...m,errors};
  }finally{await page.close();}
};

(async()=>{
  const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--autoplay-policy=no-user-gesture-required','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const out=[];
  try{
    const probe=await browser.newPage();await probe.goto(PAGE_URL,{waitUntil:'load',timeout:90000});
    await probe.waitForFunction(()=>typeof RHYTHM_SONGS!=='undefined'&&RHYTHM_SONGS.length>0,undefined,{timeout:90000});
    const songIds=await probe.evaluate(()=>RHYTHM_SONGS.map(s=>s.songId));
    // 撮る譜面: Monster Hero の HARD。はじめの「前後 300ms にほかのノーツが無い地上の TAP」を撮る
    const chart=await probe.evaluate(()=>{const s=RHYTHM_SONGS.find(x=>x.songId==='monster_hero')||RHYTHM_SONGS[0];const diff='HARD',ns=[...s.difficulties[diff].notes].sort((a,b)=>a.timeMs-b.timeMs);
      const t=ns.find((n,i)=>n.type==='TAP'&&!(rhythmNoteSkyHeight(n)>0)&&n.timeMs>1500&&ns.every((m,j)=>j===i||Math.abs(m.timeMs-n.timeMs)>300));return {songId:s.songId,name:s.displayName,diff,targetMs:t.timeMs};});
    await probe.close();
    console.log(`撮る譜面: ${chart.name} ${chart.diff} の ${(chart.targetMs/1000).toFixed(2)}秒の TAP`);
    for(const v of LIST){
      let r;try{r=await measureOne(browser,v,songIds,chart);}catch(e){r={error:String(e.message||e).split('\n')[0]};}
      out.push({v,r});
      if(r.error){console.log(`  ${v.name}: 測れなかった — ${r.error}`);continue;}
      const headC=(r.headTop+r.headBottom)/2;
      console.log(`  ${v.name}: 粒 上端 ${(r.headTop-r.lineCore).toFixed(1)} / 中心 ${(headC-r.lineCore).toFixed(1)} / 下端 ${(r.headBottom-r.lineCore).toFixed(1)}px(ラインの見た目の中心から・下が+)`
        +`・計算の粒の中心 ${(r.cyScreen-r.lineCore).toFixed(1)}px・ライン要素の中心 ${(r.line.center-r.lineCore).toFixed(1)}px・光の帯 ${(r.bandTop-r.lineCore).toFixed(1)}〜${(r.bandBottom-r.lineCore).toFixed(1)}px`
        +`・描いた時刻のずれ ${(r.song-chart.targetMs).toFixed(1)}ms${r.errors.length?`・ページのエラー ${r.errors[0]}`:''}`);
    }
  }finally{await browser.close();}
  for(const {v,r} of out){
    if(r.error){ok(`${v.name}: 測れた`,false,r.error);continue;}
    const headC=(r.headTop+r.headBottom)/2;
    ok(`${v.name}: ノーツの時刻に、粒の中心がラインの見た目の中心に重なる(${MAX_CENTER_PX}px 以内)`,r.headTop!==null&&Math.abs(headC-r.lineCore)<=MAX_CENTER_PX,`${(headC-r.lineCore).toFixed(2)}px`);
    ok(`${v.name}: ライン要素の中心と、ラインの見た目の中心がそろう(${MAX_LINE_PX}px 以内)`,Math.abs(r.line.center-r.lineCore)<=MAX_LINE_PX,`${(r.line.center-r.lineCore).toFixed(2)}px`);
  }
  console.log(failed?`\n✗ ${failed}件NG`:'\n✓ どの高さ・向き・描き方でも、ノーツはノーツの時刻にラインの見た目の中心へ重なる');
  process.exit(failed?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
