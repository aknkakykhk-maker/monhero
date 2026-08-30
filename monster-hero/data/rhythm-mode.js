// 音ゲーモードの拡張用データ。音源そのものは既存 BGM_TRACKS を正本とし、trackId だけを参照する。
const RHYTHM_LANE_COUNT = 5;
const RHYTHM_NOTE_TYPES = Object.freeze(['TAP', 'HOLD', 'FLICK', 'SLIDE']);
const RHYTHM_DIFFICULTIES = Object.freeze([
  Object.freeze({ id:'EASY', maxScore:600000 }),
  Object.freeze({ id:'NORMAL', maxScore:700000 }),
  Object.freeze({ id:'HARD', maxScore:800000 }),
  Object.freeze({ id:'EXPERT', maxScore:900000 }),
  Object.freeze({ id:'MASTER', maxScore:1000000 }),
]);
const RHYTHM_JUDGMENTS = Object.freeze([
  Object.freeze({ id:'MARVELOUS', windowMs:25, scoreRate:1 }),
  Object.freeze({ id:'EXCELLENT', windowMs:50, scoreRate:.98 }),
  Object.freeze({ id:'GREAT', windowMs:100, scoreRate:.9 }),
  Object.freeze({ id:'GOOD', windowMs:150, scoreRate:.7 }),
  Object.freeze({ id:'BAD', windowMs:200, scoreRate:.3 }),
  Object.freeze({ id:'MISS', windowMs:null, scoreRate:0 }),
]);
const RHYTHM_SCORE_WEIGHTS = Object.freeze({ judgment:.9, combo:.1 });

const RHYTHM_FLICK_DISTANCE_PX = 24;
const RHYTHM_FLICK_MAX_MS = 450;
const RHYTHM_SLIDE_TOLERANCE_LANES = .82;
const rhythmSlideExpectedLane=(note,chartTimeMs)=>{
  const points=Array.isArray(note?.slidePoints)&&note.slidePoints.length>=2
    ? note.slidePoints
    : [{timeMs:Number(note?.timeMs)||0,lane:Number(note?.lane)||0},{timeMs:Number(note?.endTimeMs)||Number(note?.timeMs)||0,lane:Number(note?.endLane??note?.lane)||0}];
  const t=Number(chartTimeMs);
  if(!Number.isFinite(t))return Number(points[0]?.lane)||0;
  if(t<=points[0].timeMs)return Number(points[0].lane)||0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=b.timeMs){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs));
      const p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      return Number(a.lane)+(Number(b.lane)-Number(a.lane))*p;
    }
  }
  return Number(points[points.length-1]?.lane)||0;
};

const RHYTHM_GESTURE_RUNTIME=(()=>{
  const positions=new Map(),sessions=new Map();
  let raf=0;

  const nowPerf=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const inputKey=(kind,id)=>`${kind}:${id}`;
  const areaRect=()=>{
    if(typeof document==='undefined')return null;
    const area=document.querySelector('[data-rhythm-play-area]');
    if(!area)return null;
    const rect=area.getBoundingClientRect();
    return rect&&Number.isFinite(rect.width)&&rect.width>0?rect:null;
  };
  const normalizedX=clientX=>{
    const rect=areaRect();
    if(!rect)return null;
    return Math.max(0,Math.min(1,(Number(clientX)-rect.left)/rect.width));
  };
  const estimatedSongMs=session=>{
    const elapsed=Math.max(0,nowPerf()-session.startPerfMs);
    return session.startSongMs+elapsed;
  };
  const finishGesture=(session,success)=>{
    if(!session||session.note.done||session.finished)return;
    session.finished=true;
    if(!success)session.note.holdJudgment='MISS';
    const songNow=estimatedSongMs(session);
    session.note.endTimeMs=songNow-session.offsetMs;
    session.note._rhythmGestureDone=true;
  };
  const evaluatePosition=(session,pos)=>{
    if(!session||session.finished||session.note.done||!pos)return;
    if(session.kind==='FLICK'){
      const elapsed=Math.max(0,pos.perfMs-session.startPerfMs);
      const dx=pos.clientX-session.startX,dy=pos.clientY-session.startY;
      if(elapsed<=RHYTHM_FLICK_MAX_MS&&Math.hypot(dx,dy)>=RHYTHM_FLICK_DISTANCE_PX)finishGesture(session,true);
      return;
    }
    if(session.kind==='SLIDE'){
      const nx=normalizedX(pos.clientX);
      if(nx===null)return;
      const chartNow=estimatedSongMs(session)-session.offsetMs;
      const expected=rhythmSlideExpectedLane(session.note,chartNow);
      const actual=nx*RHYTHM_LANE_COUNT-.5;
      if(Math.abs(actual-expected)>RHYTHM_SLIDE_TOLERANCE_LANES){
        session.note.holdJudgment='MISS';
        session.failed=true;
      }
    }
  };
  const tick=()=>{
    raf=0;
    const paused=typeof document!=='undefined'&&!!document.querySelector('[data-rhythm-pause-menu]');
    const perf=nowPerf();
    sessions.forEach((session,key)=>{
      if(!session.note||session.note.done){sessions.delete(key);return;}
      if(paused){
        const delta=Math.max(0,perf-session.lastPerfMs);
        session.startPerfMs+=delta;
        session.lastPerfMs=perf;
        return;
      }
      session.lastPerfMs=perf;
      if(session.kind==='FLICK'&&!session.finished&&perf-session.startPerfMs>RHYTHM_FLICK_MAX_MS){
        finishGesture(session,false);
        return;
      }
      if(session.kind==='SLIDE'&&!session.finished)evaluatePosition(session,positions.get(key));
    });
    if(sessions.size&&typeof requestAnimationFrame==='function')raf=requestAnimationFrame(tick);
  };
  const ensureTick=()=>{
    if(!raf&&sessions.size&&typeof requestAnimationFrame==='function')raf=requestAnimationFrame(tick);
  };
  const record=(key,clientX,clientY)=>{
    const pos={clientX:Number(clientX)||0,clientY:Number(clientY)||0,perfMs:nowPerf()};
    positions.set(String(key),pos);
    evaluatePosition(sessions.get(String(key)),pos);
  };
  const release=key=>{
    positions.delete(String(key));
    sessions.delete(String(key));
  };
  const bind=(inputKeyValue,note,kind,startSongMs,offsetMs)=>{
    const key=String(inputKeyValue||'');
    if(!key||!note||(kind!=='FLICK'&&kind!=='SLIDE'))return;
    const pos=positions.get(key)||{clientX:0,clientY:0,perfMs:nowPerf()};
    note._rhythmGestureType=kind;
    note._rhythmOriginalType=kind;
    note.type='HOLD';
    if(kind==='FLICK')note.endTimeMs=(Number(note.timeMs)||0)+60000;
    const perf=nowPerf();
    sessions.set(key,{key,note,kind,startSongMs:Number(startSongMs)||0,offsetMs:Number(offsetMs)||0,startPerfMs:perf,lastPerfMs:perf,startX:pos.clientX,startY:pos.clientY,finished:false,failed:false});
    ensureTick();
  };
  const slideVisualLaneForIndex=index=>{
    for(const session of sessions.values()){
      if(session.kind==='SLIDE'&&session.note?.index===index&&!session.note.done)return rhythmSlideExpectedLane(session.note,estimatedSongMs(session)-session.offsetMs);
    }
    return null;
  };
  const clear=()=>{
    positions.clear();
    sessions.clear();
    if(raf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(raf);
    raf=0;
  };

  if(typeof document!=='undefined'){
    const captureTouchPositions=event=>{Array.from(event.changedTouches||[]).forEach(touch=>record(inputKey('touch',touch.identifier),touch.clientX,touch.clientY));};
    const releaseTouches=event=>{Array.from(event.changedTouches||[]).forEach(touch=>release(inputKey('touch',touch.identifier)));};
    document.addEventListener('touchstart',captureTouchPositions,{capture:true,passive:true});
    document.addEventListener('touchmove',captureTouchPositions,{capture:true,passive:true});
    document.addEventListener('touchend',releaseTouches,{capture:true,passive:true});
    document.addEventListener('touchcancel',releaseTouches,{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch')record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);},true);
    document.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);},true);
    document.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId));},true);
    document.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId));},true);
    document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-rhythm-pause-menu] button');if(button&&/リスタート|中断/.test(button.textContent||''))clear();},true);
  }

  return {bind,record,release,clear,slideVisualLaneForIndex,_sessions:sessions};
})();

const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  return (Array.isArray(inputs)?inputs:[]).map(input=>{
    const key=String(input?.inputKey??'');
    if(!key||seenInputs.has(key))return {input,target:null,deltaMs:null};
    seenInputs.add(key);
    const lane=Number(input?.lane);
    const candidates=source.map((note,index)=>({note,index})).filter(({note,index})=>!claimed.has(index)&&!note.done&&note.activePointerId===null&&RHYTHM_NOTE_TYPES.includes(note.type)&&note.lane===lane&&Math.abs(now-(note.timeMs+offset))<=200).sort((a,b)=>Math.abs(now-(a.note.timeMs+offset))-Math.abs(now-(b.note.timeMs+offset))||a.index-b.index);
    const picked=candidates[0];
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(picked.index);
    const originalType=picked.note.type;
    if(originalType==='FLICK'||originalType==='SLIDE')RHYTHM_GESTURE_RUNTIME.bind(key,picked.note,originalType,now,offset);
    return {input,target:picked.note,deltaMs:now-(picked.note.timeMs+offset)};
  });
};

const emptyRhythmChart = (level=0) => Object.freeze({ level, notes:Object.freeze([]), totalNotes:0 });
const atsuCupTapNotes = Object.freeze([
  [1800,2],[2600,0],[3200,4],[4000,1],[4400,3],[5200,2],[5800,2],[6400,0],[6400,4],
  [7200,1],[7600,2],[8000,3],[8800,0],[9200,4],[10000,2],[10600,1],[11200,3],[11800,0],
  [11800,4],[12600,2],[13000,1],[13400,0],[14200,3],[14600,4],[15000,2],[15800,0],[16200,1],
  [16600,2],[17000,3],[17400,4],[18200,1],[18200,3],[19000,0],[19400,2],[19800,4],[20600,2],
  [21200,1],[21600,3],[22200,0],[22200,4],[23000,2],[23400,1],[23800,3],[24600,0],[24600,4],
].map(([timeMs,lane])=>Object.freeze({type:'TAP',timeMs,lane})));
const atsuCupTapChart = Object.freeze({level:1,notes:atsuCupTapNotes,totalNotes:atsuCupTapNotes.length,durationMs:26000});

// STEP 3A: HOLDと複数指入力を検証するNORMAL専用テスト譜面。
// HOLD中の別レーンTAPと、同時2本HOLDを意図的に含める。
const atsuCupHoldTestNotes = Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2}),
  Object.freeze({type:'HOLD',timeMs:2600,endTimeMs:4000,lane:0}),
  Object.freeze({type:'TAP',timeMs:3200,lane:4}),
  Object.freeze({type:'TAP',timeMs:3600,lane:2}),
  Object.freeze({type:'TAP',timeMs:4600,lane:1}),
  Object.freeze({type:'HOLD',timeMs:5200,endTimeMs:6800,lane:3}),
  Object.freeze({type:'TAP',timeMs:5800,lane:0}),
  Object.freeze({type:'TAP',timeMs:6400,lane:4}),
  Object.freeze({type:'TAP',timeMs:7600,lane:2}),
  Object.freeze({type:'HOLD',timeMs:8400,endTimeMs:10000,lane:1}),
  Object.freeze({type:'TAP',timeMs:9000,lane:3}),
  Object.freeze({type:'TAP',timeMs:9600,lane:4}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:11800,endTimeMs:13600,lane:4}),
  Object.freeze({type:'TAP',timeMs:14200,lane:2}),
  Object.freeze({type:'HOLD',timeMs:15000,endTimeMs:16600,lane:3}),
  Object.freeze({type:'TAP',timeMs:15600,lane:0}),
  Object.freeze({type:'TAP',timeMs:16200,lane:1}),
  Object.freeze({type:'HOLD',timeMs:17400,endTimeMs:19000,lane:2}),
  Object.freeze({type:'TAP',timeMs:18000,lane:4}),
  Object.freeze({type:'TAP',timeMs:18600,lane:0}),
  Object.freeze({type:'HOLD',timeMs:19800,endTimeMs:21600,lane:1}),
  Object.freeze({type:'TAP',timeMs:20400,lane:3}),
  Object.freeze({type:'TAP',timeMs:21200,lane:4}),
  Object.freeze({type:'TAP',timeMs:22800,lane:0}),
  Object.freeze({type:'TAP',timeMs:23400,lane:2}),
  Object.freeze({type:'TAP',timeMs:24200,lane:4}),
]);
const atsuCupHoldTestChart = Object.freeze({level:5,notes:atsuCupHoldTestNotes,totalNotes:atsuCupHoldTestNotes.length,durationMs:26000});

// STEP 3B: 4種類のノーツと複数指ジェスチャーを確認するHARD専用テスト譜面。
// FLICKは方向指定なし。SLIDEはslidePointsを1本の指で追従し、各ノーツは最終的に1判定だけを持つ。
const atsuCupGestureTestNotes = Object.freeze([
  Object.freeze({type:'TAP',timeMs:1800,lane:2}),
  Object.freeze({type:'FLICK',timeMs:2600,lane:0}),
  Object.freeze({type:'TAP',timeMs:3200,lane:4}),
  Object.freeze({type:'HOLD',timeMs:4000,endTimeMs:5600,lane:1}),
  Object.freeze({type:'FLICK',timeMs:4600,lane:4}),
  Object.freeze({type:'SLIDE',timeMs:6400,endTimeMs:8000,lane:0,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:6400,lane:0}),Object.freeze({timeMs:7200,lane:1}),Object.freeze({timeMs:8000,lane:2})])}),
  Object.freeze({type:'TAP',timeMs:7200,lane:4}),
  Object.freeze({type:'FLICK',timeMs:8800,lane:3}),
  Object.freeze({type:'HOLD',timeMs:9600,endTimeMs:11200,lane:0}),
  Object.freeze({type:'SLIDE',timeMs:10000,endTimeMs:11600,lane:4,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:10000,lane:4}),Object.freeze({timeMs:10800,lane:3}),Object.freeze({timeMs:11600,lane:2})])}),
  Object.freeze({type:'TAP',timeMs:12400,lane:2}),
  Object.freeze({type:'FLICK',timeMs:13200,lane:0}),
  Object.freeze({type:'FLICK',timeMs:13200,lane:4}),
  Object.freeze({type:'SLIDE',timeMs:14400,endTimeMs:16400,lane:1,endLane:3,slidePoints:Object.freeze([Object.freeze({timeMs:14400,lane:1}),Object.freeze({timeMs:15400,lane:2}),Object.freeze({timeMs:16400,lane:3})])}),
  Object.freeze({type:'TAP',timeMs:15200,lane:4}),
  Object.freeze({type:'HOLD',timeMs:17400,endTimeMs:19000,lane:3}),
  Object.freeze({type:'FLICK',timeMs:18000,lane:0}),
  Object.freeze({type:'SLIDE',timeMs:19800,endTimeMs:21800,lane:4,endLane:1,slidePoints:Object.freeze([Object.freeze({timeMs:19800,lane:4}),Object.freeze({timeMs:20800,lane:3}),Object.freeze({timeMs:21300,lane:2}),Object.freeze({timeMs:21800,lane:1})])}),
  Object.freeze({type:'TAP',timeMs:20600,lane:0}),
  Object.freeze({type:'TAP',timeMs:22800,lane:2}),
]);
const atsuCupGestureTestChart = Object.freeze({level:9,notes:atsuCupGestureTestNotes,totalNotes:atsuCupGestureTestNotes.length,durationMs:26000});

const RHYTHM_SONGS = Object.freeze([
  Object.freeze({
    songId:'atsu_cup_theme_test',
    displayName:'あつ杯テーマ',
    bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[
      id,
      id==='EASY'?atsuCupTapChart:id==='NORMAL'?atsuCupHoldTestChart:id==='HARD'?atsuCupGestureTestChart:emptyRhythmChart()
    ])))
  }),
]);

const installRhythmGestureVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmGestureVisuals==='ready')return;
  document.documentElement.dataset.rhythmGestureVisuals='ready';
  const style=document.createElement('style');
  style.textContent=`
    [data-rhythm-note][data-note-type="FLICK"] > span:last-child{background:linear-gradient(180deg,#f9a8d4,#ec4899 52%,#a21caf)!important;border-color:rgba(253,164,175,.95)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 0 16px rgba(236,72,153,.68)!important}
    [data-rhythm-note][data-note-type="FLICK"] > span:last-child::after{content:"▲";position:absolute;left:50%;top:-18px;transform:translateX(-50%);color:#fdf2f8;font-size:18px;line-height:1;text-shadow:0 0 8px #ec4899,0 0 14px #d946ef}
    [data-rhythm-note][data-note-type="SLIDE"] > span:last-child{background:linear-gradient(180deg,#ddd6fe,#a855f7 58%,#6d28d9)!important;border-color:rgba(221,214,254,.95)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.82),0 0 16px rgba(168,85,247,.64)!important}
    [data-rhythm-slide-body]{position:absolute;left:50%;bottom:50%;width:34%;height:var(--rhythm-slide-height,120px);transform:translateX(-50%) rotate(var(--rhythm-slide-angle,0deg));transform-origin:50% 100%;border-radius:999px 999px 3px 3px;background:linear-gradient(180deg,rgba(216,180,254,.38),rgba(168,85,247,.72));box-shadow:0 0 14px rgba(168,85,247,.42);pointer-events:none}
  `;
  document.head.appendChild(style);
  const decorate=()=>{
    const area=document.querySelector('[data-rhythm-play-area]');
    if(!area)return;
    const els=Array.from(area.querySelectorAll('[data-rhythm-note]'));
    els.forEach((el,index)=>{
      if(el.dataset.noteType!=='SLIDE'||el.querySelector('[data-rhythm-slide-body]'))return;
      const body=document.createElement('span');
      body.dataset.rhythmSlideBody='';
      body.setAttribute('aria-hidden','true');
      const note=atsuCupGestureTestChart.notes[index];
      if(note?.type==='SLIDE'){
        const duration=Math.max(500,note.endTimeMs-note.timeMs),delta=Number(note.endLane??note.lane)-Number(note.lane);
        body.style.setProperty('--rhythm-slide-height',`${Math.round(92+duration/2000*82)}px`);
        body.style.setProperty('--rhythm-slide-angle',`${Math.max(-24,Math.min(24,delta*9))}deg`);
      }
      el.insertBefore(body,el.firstChild);
    });
    const label=area.previousElementSibling?.querySelector?.('small');
    if(label&&els.some(el=>el.dataset.noteType==='FLICK'||el.dataset.noteType==='SLIDE'))label.textContent='MIX TEST';
  };
  const observer=new MutationObserver(decorate);
  const start=()=>{decorate();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmGestureVisuals();

// STEP B: 遠近化した5レーンに、既存ノーツ描画だけを追従させる。
// 判定・入力座標・AudioContext時間には触れず、表示中ノーツのleft/widthだけを補正する。
const installRhythmPerspectiveNoteVisuals=()=>{
  if(typeof document==='undefined'||typeof requestAnimationFrame!=='function'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmPerspectiveNotes==='ready')return;
  document.documentElement.dataset.rhythmPerspectiveNotes='ready';

  const style=document.createElement('style');
  style.textContent='[data-rhythm-note][data-note-type="HOLD"] [data-rhythm-hold-body]{clip-path:polygon(34% 0,66% 0,100% 100%,0 100%)}';
  document.head.appendChild(style);

  let area=null,notes=[],raf=0;
  const meta=new WeakMap();
  const reset=el=>{
    const info=meta.get(el);
    if(!info)return;
    el.style.left=`calc(${info.lane*20}% + 5px)`;
    el.style.width='calc(20% - 10px)';
  };
  const stop=()=>{
    if(raf)cancelAnimationFrame(raf);
    raf=0;
    notes.forEach(reset);
    notes=[];
    area=null;
  };
  const noteLane=el=>{
    const cached=meta.get(el);
    if(cached)return cached.lane;
    const match=String(el.style.left||'').match(/calc\(\s*([\d.]+)%/);
    if(!match)return null;
    const lane=Math.round(Number(match[1])/20);
    if(lane<0||lane>=RHYTHM_LANE_COUNT)return null;
    meta.set(el,{lane});
    return lane;
  };
  const frame=()=>{
    if(!area||!area.isConnected){stop();scan();return;}
    const areaRect=area.getBoundingClientRect();
    const line=area.querySelector('[data-rhythm-judgment-line]');
    const lineRect=line?.getBoundingClientRect();
    if(areaRect.width>0&&areaRect.height>0&&lineRect){
      const judgeY=Math.max(1,lineRect.top-areaRect.top+lineRect.height/2);
      const flatNoteWidth=Math.max(8,areaRect.width/RHYTHM_LANE_COUNT-10);
      notes.forEach((el,index)=>{
        if(!el.isConnected||el.style.opacity==='0')return;
        const move=String(el.style.transform||'').match(/translate3d\(\s*[-\d.]+(?:px)?\s*,\s*([-\d.]+)px/i);
        if(!move)return;
        const lane=noteLane(el);
        if(lane===null)return;
        const y=Number(move[1]);
        if(!Number.isFinite(y))return;
        const depth=Math.max(0,Math.min(1,y/judgeY));
        const scale=.44+.56*depth;
        const activeSlideLane=RHYTHM_GESTURE_RUNTIME.slideVisualLaneForIndex(index);
        const visualLane=activeSlideLane===null?lane:activeSlideLane;
        const baseCenter=areaRect.width*((visualLane+.5)/RHYTHM_LANE_COUNT);
        const visualCenter=areaRect.width/2+(baseCenter-areaRect.width/2)*scale;
        const visualWidth=Math.max(8,flatNoteWidth*scale);
        el.style.left=`${(visualCenter-visualWidth/2).toFixed(2)}px`;
        el.style.width=`${visualWidth.toFixed(2)}px`;
      });
    }
    raf=requestAnimationFrame(frame);
  };
  const start=next=>{
    stop();
    if(!next)return;
    area=next;
    notes=Array.from(area.querySelectorAll('[data-rhythm-note]'));
    notes.forEach(noteLane);
    raf=requestAnimationFrame(frame);
  };
  const scan=()=>{
    const next=document.querySelector('[data-rhythm-play-area]');
    if(next!==area)start(next);
  };
  const observe=()=>{
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe,{once:true});
  else observe();
};
installRhythmPerspectiveNoteVisuals();

// DEBUG ONLY: 音ゲーデバッグ画面を開いた時だけ譜面制作ツールを読み込む。
const installRhythmAuthoringLoader=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  let loaded=false;
  const load=()=>{
    if(loaded||!document.querySelector('[data-rhythm-debug]'))return;
    loaded=true;
    const script=document.createElement('script');
    script.dataset.rhythmAuthoringLoader='';
    script.src='data/rhythm-authoring.js?v=20260831a';
    document.head.appendChild(script);
  };
  const start=()=>{load();if(!loaded)new MutationObserver(load).observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmAuthoringLoader();