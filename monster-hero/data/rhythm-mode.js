// 音ゲーモードの拡張用データ。音源そのものは既存 BGM_TRACKS を正本とし、trackId だけを参照する。
const RHYTHM_LANE_COUNT = 5;
const RHYTHM_SUB_LANE_COUNT = RHYTHM_LANE_COUNT*2;
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
const RHYTHM_PROJECTION_TOP_SCALE=.30;
const RHYTHM_NOTE_WIDTH_RATIO=.78;
const RHYTHM_BODY_WIDTH_RATIO=.64;
// 幅1だけに付ける入力側の余白。隣接する細ノーツの中心までは広げない。
const RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES=.18;
const rhythmClamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const rhythmProjectionScale=yRatio=>RHYTHM_PROJECTION_TOP_SCALE+(1-RHYTHM_PROJECTION_TOP_SCALE)*Math.pow(rhythmClamp01(yRatio),1.24);
const rhythmProjectBoundary=(boundary,yRatio)=>{
  const scale=rhythmProjectionScale(yRatio),flat=Number(boundary)/RHYTHM_LANE_COUNT;
  return .5+(flat-.5)*scale;
};
const rhythmProjectLane=(lane,yRatio)=>{
  const value=Number(lane),left=rhythmProjectBoundary(value,yRatio),right=rhythmProjectBoundary(value+1,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio)};
};
const rhythmProjectSubLaneSpan=(subLane,width,yRatio)=>{
  const total=RHYTHM_LANE_COUNT*2;
  const span=Math.max(1,Math.min(4,Math.trunc(Number(width))||2));
  const start=Math.max(0,Math.min(total-span,Math.trunc(Number(subLane))||0));
  const left=rhythmProjectBoundary(start/2,yRatio),right=rhythmProjectBoundary((start+span)/2,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLane:start,subLaneWidth:span};
};
// 旧譜面は lane を正本のまま使い、従来と同じ中央・2サブレーン幅へ写す。
// TAP/HOLDはsubLaneで可変幅、SLIDEはlane/slidePoints.laneを中心線として幅1〜4へ対応する。
const rhythmNoteHasVariableSpan=note=>(note?.type==='TAP'||note?.type==='HOLD'||note?.type==='FLICK'||note?._rhythmOriginalType==='FLICK')&&note?.subLane!=null&&Number.isFinite(Number(note.subLane));
const rhythmNoteIsSlide=note=>note?.type==='SLIDE'||note?._rhythmOriginalType==='SLIDE';
const rhythmSlideAuthoredLane=lane=>{
  const value=Number(lane),doubled=Math.round(value*2);
  if(!Number.isFinite(value)||Math.abs(value*2-doubled)>1e-6||doubled<0||doubled>RHYTHM_SUB_LANE_COUNT-2)return null;
  return doubled/2;
};
const rhythmSlideAuthoredWidth=value=>{
  const width=Number(value);
  return Number.isInteger(width)&&width>=1&&width<=4?width:null;
};
const rhythmSlideWidth=note=>rhythmSlideAuthoredWidth(note?.subLaneWidth)??2;
const rhythmSlidePointWidth=(note,point)=>rhythmSlideAuthoredWidth(point?.subLaneWidth)??rhythmSlideWidth(note);
const rhythmProjectSlideSpan=(lane,note,yRatio,chartTimeMs=note?.timeMs)=>{
  const value=Number(lane),width=rhythmSlideWidthAt(note,chartTimeMs),half=width/4,centerBoundary=value+.5;
  const left=rhythmProjectBoundary(centerBoundary-half,yRatio),right=rhythmProjectBoundary(centerBoundary+half,yRatio);
  return {left,right,center:(left+right)/2,width:right-left,scale:rhythmProjectionScale(yRatio),subLaneWidth:width};
};
const rhythmSlideInputSpan=note=>{
  if(!rhythmNoteIsSlide(note))return null;
  const lane=rhythmSlideAuthoredLane(note?.lane);
  if(lane===null)return null;
  const width=rhythmSlideWidthAt(note,note?.timeMs),center=(lane+.5)*2;
  return {start:center-width/2,end:center+width/2,center,width};
};
const rhythmNoteVisualSpan=(note,visualLane,yRatio)=>rhythmNoteHasVariableSpan(note)
  ?rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,yRatio)
  :rhythmNoteIsSlide(note)
    ?rhythmProjectSlideSpan(Number(visualLane),note,yRatio)
    :rhythmProjectSubLaneSpan(Number(visualLane)*2,2,yRatio);
// projectionはyに対する曲線(pow 1.24)なので、上端と下端だけを直線で結ぶ台形にすると
// 中間の高さでレーン枠だけがノーツより外側へ膨らむ。見た目の枠も同じboundary helperを
// 一定間隔でサンプルし、ノーツ・HOLD帯・SLIDE帯と同じ曲線へ沿わせる。
const RHYTHM_PROJECTION_EDGE_STEPS=16;
// SLIDEはauthored点の間を実時間で細分化して曲線へ沿わせる。点が多い譜面でも描画量が跳ねないよう、
// レーン枠(静的)より粗い刻みにする。
const RHYTHM_SLIDE_SEGMENT_STEPS=10;
const rhythmProjectionEdgeRatios=(steps=RHYTHM_PROJECTION_EDGE_STEPS)=>Array.from({length:steps+1},(_,index)=>index/steps);
const rhythmBoundaryEdgePoints=(boundary,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>rhythmProjectionEdgeRatios(steps).map(y=>({x:rhythmProjectBoundary(boundary,y),y}));
const rhythmSpanPolygon=(leftBoundary,rightBoundary,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>{
  const at=(boundary,y)=>`${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% ${(y*100).toFixed(4)}%`;
  const ratios=rhythmProjectionEdgeRatios(steps);
  const right=ratios.map(y=>at(rightBoundary,y)),left=ratios.map(y=>at(leftBoundary,y)).reverse();
  return `polygon(${[at(leftBoundary,0),...right,...left.slice(0,-1)].join(',')})`;
};
// 1px幅の境界線も同じ曲線に沿わせる。幅だけはpx指定なのでcalcで足す。
const rhythmBoundaryLinePolygon=(boundary,widthPx=1,steps=RHYTHM_PROJECTION_EDGE_STEPS)=>{
  const ratios=rhythmProjectionEdgeRatios(steps);
  const right=ratios.map(y=>`calc(${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% + ${widthPx}px) ${(y*100).toFixed(4)}%`);
  const left=ratios.map(y=>`${(rhythmProjectBoundary(boundary,y)*100).toFixed(4)}% ${(y*100).toFixed(4)}%`).reverse();
  return `polygon(${[...right,...left].join(',')})`;
};
const rhythmLanePolygon=lane=>rhythmSpanPolygon(lane,lane+1);
const rhythmSubLanePolygon=subLane=>rhythmSpanPolygon(subLane/2,(subLane+1)/2);
const rhythmProjectTravelProgress=progress=>{
  const p=Number(progress)||0;
  if(p<0)return p*.72;
  if(p>1)return 1+(p-1)*1.28;
  return p*(.54+.46*p);
};
const rhythmReleaseTargetMs=note=>Number(note?._rhythmReleaseTargetMs??note?._rhythmReleaseOriginalEndTimeMs??note?.endTimeMs??note?.timeMs)||0;
const rhythmReleaseLane=note=>{
  const points=Array.isArray(note?.slidePoints)?note.slidePoints:[];
  return Number(points[points.length-1]?.lane??note?.endLane??note?.lane)||0;
};
const rhythmLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  if(!rect||!Number.isFinite(rect.width)||rect.width<=0||!Number.isFinite(rect.height)||rect.height<=0)return null;
  const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=(Number(clientX)-rect.left)/rect.width;
  const left=rhythmProjectBoundary(0,yRatio),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,yRatio),laneWidth=(right-left)/RHYTHM_LANE_COUNT;
  if(!Number.isFinite(nx)||nx<left||nx>right||!(laneWidth>0))return null;
  return (nx-left)/laneWidth-.5;
};
const rhythmSubLaneCoordinateAtPoint=(clientX,clientY,rect)=>{
  const coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  return coordinate===null?null:(coordinate+.5)*2;
};
const rhythmLaneAtPoint=(clientX,clientY,rect)=>{
  const coordinate=rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
  if(coordinate===null)return null;
  return Math.max(0,Math.min(RHYTHM_LANE_COUNT-1,Math.floor(coordinate+.5)));
};

const RHYTHM_FLICK_DISTANCE_PX = 24;
const RHYTHM_FLICK_MAX_MS = 450;
const RHYTHM_SLIDE_TOLERANCE_LANES = .82;
const RHYTHM_RELEASE_MAX_MS = 200;
const RHYTHM_RELEASE_DEFER_ARM_MS = 100;
const RHYTHM_RELEASE_AUTO_MISS_ARM_MS = 180;
const RHYTHM_RELEASE_JUDGMENT_IDS = Object.freeze(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS']);
const rhythmSlideTrackingTolerance=(note,chartTimeMs)=>RHYTHM_SLIDE_TOLERANCE_LANES+(rhythmSlideWidthAt(note,chartTimeMs)-2)/4;
const rhythmJudgeRelease=deltaMs=>{
  const value=Math.abs(Number(deltaMs));
  if(!Number.isFinite(value))return 'MISS';
  for(const judgment of RHYTHM_JUDGMENTS){
    if(judgment.windowMs!==null&&value<=judgment.windowMs)return judgment.id;
  }
  return 'MISS';
};
const rhythmWorseJudgment=(a,b)=>{
  const left=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(String(a||'MISS')),right=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(String(b||'MISS'));
  return RHYTHM_RELEASE_JUDGMENT_IDS[Math.max(left<0?RHYTHM_RELEASE_JUDGMENT_IDS.length-1:left,right<0?RHYTHM_RELEASE_JUDGMENT_IDS.length-1:right)];
};
const rhythmSlidePoints=note=>Array.isArray(note?.slidePoints)&&note.slidePoints.length>=2
    ? note.slidePoints
    : [{timeMs:Number(note?.timeMs)||0,lane:Number(note?.lane)||0},{timeMs:Number(note?._rhythmReleaseOriginalEndTimeMs??note?.endTimeMs)||Number(note?.timeMs)||0,lane:Number(note?.endLane??note?.lane)||0}];
const rhythmSlideWidthAt=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note),t=Number(chartTimeMs);
  if(!Number.isFinite(t)||t<=Number(points[0]?.timeMs))return rhythmSlidePointWidth(note,points[0]);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(t<=Number(b.timeMs)){
      const span=Math.max(1,Number(b.timeMs)-Number(a.timeMs)),p=Math.max(0,Math.min(1,(t-Number(a.timeMs))/span));
      return rhythmSlidePointWidth(note,a)+(rhythmSlidePointWidth(note,b)-rhythmSlidePointWidth(note,a))*p;
    }
  }
  return rhythmSlidePointWidth(note,points[points.length-1]);
};
const rhythmSlideExpectedLane=(note,chartTimeMs)=>{
  const points=rhythmSlidePoints(note);
  const t=Number(chartTimeMs);
  if(!Number.isFinite(t))return Number(points[0]?.lane)||0;
  if(t<=points[0].timeMs)return Number(points[0]?.lane)||0;
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

// STEP 2A.5: 入力成功と空押しを即座に返すWeb Audio SE。既存の音ゲー設定キーだけを読み、
// AudioContextは1個だけ遅延生成して再利用する。空押しは新規入力でノーツを取得できなかったときだけ呼ぶ。
// 音ゲーのタップ音量はメインのSE音量設定と独立している(rhythm-mode.js側で自前のAudioContextを使う)。
// ただし全体ミュート(タイトル画面の「音がオフです」)だけは、game-system.jsx の Audio_.setEnabled が
// window.__mhAudioEnabled へ反映するのでそれを見て共通に効かせる。値が無い(main未読込)場合はfalse扱いにしない。
const rhythmAudioGloballyEnabled=()=>typeof window==='undefined'||window.__mhAudioEnabled!==false;
const RHYTHM_NOTE_SE_RUNTIME=(()=>{
  let ctx=null,cachedRaw=null,cachedSettings={enabled:true,volume:70},inputGroupDepth=0,inputGroupHit=false;
  const readSettings=()=>{
    if(typeof localStorage==='undefined')return cachedSettings;
    let raw=null;
    try{raw=localStorage.getItem('mh_rhythm_settings_v1');}catch{return cachedSettings;}
    if(raw===cachedRaw)return cachedSettings;
    cachedRaw=raw;
    if(!raw){cachedSettings={enabled:true,volume:70};return cachedSettings;}
    try{
      const value=JSON.parse(raw),number=Number(value?.noteSeVolume);
      cachedSettings={
        enabled:typeof value?.noteSeEnabled==='boolean'?value.noteSeEnabled:true,
        volume:Number.isFinite(number)?Math.max(0,Math.min(100,number)):70,
      };
    }catch{cachedSettings={enabled:true,volume:70};}
    return cachedSettings;
  };
  const context=()=>{
    if(ctx&&ctx.state!=='closed')return ctx;
    if(typeof window==='undefined')return null;
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;
    if(!AudioContextClass)return null;
    try{ctx=new AudioContextClass();}catch{return null;}
    return ctx;
  };
  const warm=()=>{
    const audio=context();
    if(audio?.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
  };
  const play=(previewSettings=null)=>{
    if(inputGroupDepth>0)inputGroupHit=true;
    const settings=previewSettings?{enabled:previewSettings.noteSeEnabled!==false,volume:Math.max(0,Math.min(100,Number(previewSettings.noteSeVolume)||0))}:readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const oscillator=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime,level=Math.max(.0001,.035*(settings.volume/100));
    oscillator.type='triangle';
    oscillator.frequency.setValueAtTime(1120,now);
    oscillator.frequency.exponentialRampToValueAtTime(820,now+.035);
    gain.gain.setValueAtTime(level,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+.045);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now+.05);
    oscillator.onended=()=>{try{oscillator.disconnect();gain.disconnect();}catch{}};
    return true;
  };
  const emitEmpty=()=>{
    const settings=readSettings();
    if(!settings.enabled||settings.volume<=0||!rhythmAudioGloballyEnabled())return false;
    const audio=context();
    if(!audio)return false;
    if(audio.state==='suspended'&&typeof audio.resume==='function')audio.resume().catch(()=>{});
    const duration=.055,sampleRate=audio.sampleRate||44100,buffer=audio.createBuffer(1,Math.max(1,Math.floor(sampleRate*duration)),sampleRate),samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),now=audio.currentTime,level=Math.max(.0001,.022*(settings.volume/100));
    source.buffer=buffer;
    filter.type='bandpass';
    filter.frequency.setValueAtTime(2800,now);
    filter.Q.setValueAtTime(.7,now);
    gain.gain.setValueAtTime(level,now);
    gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    source.connect(filter);filter.connect(gain);gain.connect(audio.destination);
    source.start(now);source.stop(now+duration);
    source.onended=()=>{try{source.disconnect();filter.disconnect();gain.disconnect();}catch{}};
    return true;
  };
  const playEmpty=()=>inputGroupDepth>0?true:emitEmpty();
  const beginInputGroup=()=>{if(inputGroupDepth===0)inputGroupHit=false;inputGroupDepth++;};
  const markInputGroupHandled=()=>{if(inputGroupDepth>0)inputGroupHit=true;};
  const endInputGroup=()=>{
    if(inputGroupDepth<=0)return false;
    inputGroupDepth--;
    if(inputGroupDepth>0)return true;
    const handled=inputGroupHit;
    inputGroupHit=false;
    return handled?true:emitEmpty();
  };
  return {warm,play,preview:settings=>play(settings),playEmpty,beginInputGroup,markInputGroupHandled,endInputGroup,_readSettings:readSettings};
})();

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
  const laneCoordinate=(clientX,clientY)=>{
    const rect=areaRect();
    if(!rect)return null;
    return rhythmLaneCoordinateAtPoint(clientX,clientY,rect);
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
      const actual=laneCoordinate(pos.clientX,pos.clientY);
      if(actual===null){session.note.holdJudgment='MISS';session.failed=true;return;}
      const chartNow=estimatedSongMs(session)-session.offsetMs;
      const expected=rhythmSlideExpectedLane(session.note,chartNow);
      if(Math.abs(actual-expected)>rhythmSlideTrackingTolerance(session.note,chartNow)){
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
      if(session.releaseRequired&&session.startJudgment===null&&session.note.holdJudgment){
        session.startJudgment=session.note.holdJudgment;
        session.startDeltaMs=Number(session.note.holdDeltaMs)||0;
      }
      if(session.kind==='FLICK'&&!session.finished&&perf-session.startPerfMs>RHYTHM_FLICK_MAX_MS){
        finishGesture(session,false);
        return;
      }
      if(session.kind==='SLIDE'&&!session.finished)evaluatePosition(session,positions.get(key));
      if(session.releaseRequired&&!session.note.done){
        const releaseDelta=estimatedSongMs(session)-(session.releaseTargetMs+session.offsetMs);
        if(!session.autoCompletionDeferred&&releaseDelta>=-RHYTHM_RELEASE_DEFER_ARM_MS){
          // 本体の「終端到達で自動成功」を終端判定窓の直後まで延期する。
          session.note.endTimeMs=session.releaseTargetMs+RHYTHM_RELEASE_MAX_MS+1;
          session.autoCompletionDeferred=true;
        }
        if(releaseDelta>=RHYTHM_RELEASE_AUTO_MISS_ARM_MS){
          session.expiredGuard=true;
          session.note.holdJudgment='MISS';
          session.note.holdDeltaMs=releaseDelta;
        }
      }
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
  const release=(key,cancelled=false)=>{
    const id=String(key),session=sessions.get(id);
    positions.delete(id);
    if(!session){sessions.delete(id);return;}
    if(session.releaseRequired&&!session.note.done){
      if(session.startJudgment===null&&session.note.holdJudgment){
        session.startJudgment=session.note.holdJudgment;
        session.startDeltaMs=Number(session.note.holdDeltaMs)||0;
      }
      const songNow=estimatedSongMs(session);
      const releaseDelta=songNow-(session.releaseTargetMs+session.offsetMs);
      const endJudgment=cancelled?'MISS':rhythmJudgeRelease(releaseDelta);
      const startJudgment=session.startJudgment||session.note.holdJudgment||'MISS';
      const finalJudgment=session.failed?'MISS':rhythmWorseJudgment(startJudgment,endJudgment);
      const startRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(startJudgment),endRank=RHYTHM_RELEASE_JUDGMENT_IDS.indexOf(endJudgment);
      session.note.holdJudgment=finalJudgment;
      session.note.holdDeltaMs=session.failed||endRank>=startRank?releaseDelta:(session.startDeltaMs||0);
      session.note._rhythmReleaseJudgment=endJudgment;
      session.note._rhythmReleaseDeltaMs=releaseDelta;
      session.note._rhythmReleaseDone=true;
      // game-system.jsx の既存 inputEnds に最終判定だけ適用させる。
      // document capture は play-area の inputEnds より先に走るため、ここで終了時刻を
      // 現在より十分前へ寄せれば旧「早離し」分岐へ入らず、上で合成した判定が1回だけ反映される。
      session.note.endTimeMs=songNow-session.offsetMs-101;
    }
    sessions.delete(id);
  };
  const bind=(inputKeyValue,note,kind,startSongMs,offsetMs)=>{
    const key=String(inputKeyValue||'');
    if(!key||!note||(kind!=='HOLD'&&kind!=='FLICK'&&kind!=='SLIDE'))return;
    const pos=positions.get(key)||{clientX:0,clientY:0,perfMs:nowPerf()};
    note._rhythmGestureType=kind;
    note._rhythmOriginalType=kind;
    note.type='HOLD';
    const releaseRequired=kind==='HOLD'||kind==='SLIDE';
    const releaseTargetMs=releaseRequired?(Number(note.endTimeMs)||Number(note.timeMs)||0):null;
    if(releaseRequired){
      note._rhythmReleaseTargetMs=releaseTargetMs;
      note._rhythmReleaseOriginalEndTimeMs=releaseTargetMs;
      note._rhythmReleaseRequired=true;
      // 普段の見た目は元のendTimeMsを保ち、終端100ms前からだけ自動完了を延期する。
      // release() が終端判定を作り、押しっぱなしなら+200ms超でMISSになる。
    }else if(kind==='FLICK')note.endTimeMs=(Number(note.timeMs)||0)+60000;
    const perf=nowPerf();
    sessions.set(key,{key,note,kind,startSongMs:Number(startSongMs)||0,offsetMs:Number(offsetMs)||0,startPerfMs:perf,lastPerfMs:perf,startX:pos.clientX,startY:pos.clientY,finished:false,failed:false,releaseRequired,releaseTargetMs,startJudgment:null,startDeltaMs:0,expiredGuard:false,autoCompletionDeferred:false});
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
    const captureTouchStart=event=>{if(event.target?.closest?.('[data-rhythm-play-area]'))RHYTHM_NOTE_SE_RUNTIME.warm();captureTouchPositions(event);};
    const releaseTouches=event=>{Array.from(event.changedTouches||[]).forEach(touch=>release(inputKey('touch',touch.identifier),false));};
    const cancelTouches=event=>{Array.from(event.changedTouches||[]).forEach(touch=>release(inputKey('touch',touch.identifier),true));};
    document.addEventListener('touchstart',captureTouchStart,{capture:true,passive:true});
    document.addEventListener('touchmove',captureTouchPositions,{capture:true,passive:true});
    document.addEventListener('touchend',releaseTouches,{capture:true,passive:true});
    document.addEventListener('touchcancel',cancelTouches,{capture:true,passive:true});
    document.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'){if(event.target?.closest?.('[data-rhythm-play-area]'))RHYTHM_NOTE_SE_RUNTIME.warm();record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);}},true);
    document.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')record(inputKey('pointer',event.pointerId),event.clientX,event.clientY);},true);
    document.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId),false);},true);
    document.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')release(inputKey('pointer',event.pointerId),true);},true);
    document.addEventListener('click',event=>{const button=event.target?.closest?.('[data-rhythm-pause-menu] button');if(button&&/リスタート|中断/.test(button.textContent||''))clear();},true);
  }

  return {bind,record,release,clear,slideVisualLaneForIndex,_sessions:sessions};
})();

// iPhoneのTouch.radiusXを既存projectionへ通し、実際の接触幅に応じたサブレーン領域として扱う。
// radiusXは端を拾いすぎないよう70%へ縮小し、隣接サブレーンは25%以上重なった時だけ接触扱いにする。
// 明らかな異常値だけ中心1サブレーンへfallbackする。ゲーム本体の中心1点入力はそのまま残し、
// 中心以外の新規接触サブレーンだけTAP専用の疑似Pointerで補う。
const RHYTHM_TOUCH_RADIUS_SCALE=.70;
const RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE=.25;
const RHYTHM_TOUCH_RADIUS_MAX_PLAY_AREA_RATIO=.25;
const RHYTHM_TOUCH_CENTER_DEADZONE_MIN_PX=6;
const RHYTHM_TOUCH_CENTER_DEADZONE_MAX_PX=10;
const RHYTHM_TOUCH_CENTER_DEADZONE_PLAY_AREA_RATIO=.02;
const RHYTHM_TOUCH_RADIUS_EXPAND_MIN_PX=3;
const RHYTHM_TOUCH_RADIUS_EXPAND_MIN_RATIO=.10;
const RHYTHM_TOUCH_SPAN_RUNTIME=(()=>{
  const touchStates=new Map(),syntheticTapKeys=new Set();
  let nextSyntheticPointerId=900000;
  const clampSubLane=value=>Math.max(0,Math.min(RHYTHM_SUB_LANE_COUNT-1,Math.floor(Number(value))));
  const centerDeadzonePx=rect=>Math.min(RHYTHM_TOUCH_CENTER_DEADZONE_MAX_PX,Math.max(RHYTHM_TOUCH_CENTER_DEADZONE_MIN_PX,(Number(rect?.width)||0)*RHYTHM_TOUCH_CENTER_DEADZONE_PLAY_AREA_RATIO));
  const stabilizedMoveTouch=(previous,touch,rect)=>{
    const rawClientX=Number(touch?.clientX),rawClientY=Number(touch?.clientY),rawRadiusX=Number(touch?.radiusX);
    const previousAnchor=Number(previous?.centerAnchorX),anchor=Number.isFinite(previousAnchor)?previousAnchor:rawClientX,deadzone=centerDeadzonePx(rect);
    const centerMoved=Number.isFinite(rawClientX)&&Number.isFinite(anchor)&&Math.abs(rawClientX-anchor)>deadzone,effectiveClientX=centerMoved?rawClientX:anchor;
    return {touch:{identifier:touch?.identifier,clientX:effectiveClientX,clientY:rawClientY,radiusX:rawRadiusX},centerAnchorX:effectiveClientX,centerMoved,rawClientX};
  };
  const radiusExpansionAccepted=(previousRadius,currentRadius)=>{
    const from=Number(previousRadius),to=Number(currentRadius);
    if(!(from>0&&to>from))return false;
    return to-from>=Math.max(RHYTHM_TOUCH_RADIUS_EXPAND_MIN_PX,from*RHYTHM_TOUCH_RADIUS_EXPAND_MIN_RATIO);
  };
  const contactsForTouch=(touch,rect)=>{
    const centerCoordinate=rhythmSubLaneCoordinateAtPoint(touch?.clientX,touch?.clientY,rect);
    if(!Number.isFinite(centerCoordinate))return null;
    const centerSubLane=clampSubLane(centerCoordinate),rawRadiusX=Number(touch?.radiusX);
    if(!(rawRadiusX>0))return {centerCoordinate,centerSubLane,subLanes:[centerSubLane]};
    const maxSaneRadiusX=Number(rect?.width)*RHYTHM_TOUCH_RADIUS_MAX_PLAY_AREA_RATIO;
    if(!(maxSaneRadiusX>0)||rawRadiusX>maxSaneRadiusX)return {centerCoordinate,centerSubLane,subLanes:[centerSubLane]};
    const radiusX=rawRadiusX*RHYTHM_TOUCH_RADIUS_SCALE;
    const leftCoordinate=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)-radiusX,touch.clientY,rect);
    const rightCoordinate=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)+radiusX,touch.clientY,rect);
    const coordinates=[centerCoordinate];
    if(Number.isFinite(leftCoordinate))coordinates.push(leftCoordinate);
    if(Number.isFinite(rightCoordinate))coordinates.push(rightCoordinate);
    const min=Math.max(0,Math.min(...coordinates)),max=Math.min(RHYTHM_SUB_LANE_COUNT-.000001,Math.max(...coordinates));
    let subLanes=[];
    for(let lane=clampSubLane(min);lane<=clampSubLane(max);lane++){
      const overlap=Math.max(0,Math.min(max,lane+1)-Math.max(min,lane));
      if(lane===centerSubLane||overlap>=RHYTHM_TOUCH_MIN_SUBLANE_COVERAGE)subLanes.push(lane);
    }
    if(!subLanes.includes(centerSubLane))subLanes.push(centerSubLane);
    subLanes.sort((a,b)=>a-b);
    return {centerCoordinate,centerSubLane,subLanes};
  };
  const defer=fn=>{if(typeof queueMicrotask==='function')queueMicrotask(fn);else Promise.resolve().then(fn);};
  const pointForSubLane=(subLane,clientY,rect)=>{
    const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=rhythmProjectBoundary((Number(subLane)+.5)/2,yRatio);
    return {clientX:rect.left+rect.width*nx,clientY:Number(clientY)};
  };
  const makePointerEvent=(type,id,point)=>{
    const init={bubbles:true,cancelable:true,pointerId:id,pointerType:'pen',isPrimary:false,clientX:point.clientX,clientY:point.clientY,button:0,buttons:type==='pointerdown'?1:0};
    if(typeof PointerEvent==='function')return new PointerEvent(type,init);
    const event=new Event(type,{bubbles:true,cancelable:true});
    Object.entries(init).forEach(([key,value])=>{try{Object.defineProperty(event,key,{value,configurable:true});}catch{}});
    return event;
  };
  const dispatchTapProbe=(area,touch,subLane)=>{
    if(!area?.dispatchEvent)return false;
    const rect=area.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return false;
    const id=++nextSyntheticPointerId,key=`pointer:${id}`,point=pointForSubLane(subLane,touch.clientY,rect);
    syntheticTapKeys.add(key);
    try{
      area.dispatchEvent(makePointerEvent('pointerdown',id,point));
      area.dispatchEvent(makePointerEvent('pointerup',id,point));
      return true;
    }finally{syntheticTapKeys.delete(key);}
  };
  const applyTouchSpanGlow=()=>{
    if(typeof document==='undefined')return;
    const active=new Set();
    touchStates.forEach(state=>state.subLanes.forEach(lane=>active.add(lane)));
    document.querySelectorAll('[data-rhythm-sublane-feedback]').forEach((el,index)=>{
      if(active.has(index))el.dataset.rhythmTouchspan='true';
      else delete el.dataset.rhythmTouchspan;
    });
  };
  const clear=()=>{touchStates.clear();applyTouchSpanGlow();};
  const startOrMove=(event,isStart)=>{
    if(typeof document==='undefined')return;
    const eventArea=event.target?.closest?.('[data-rhythm-play-area]'),fallbackArea=document.querySelector('[data-rhythm-play-area]'),area=eventArea||fallbackArea;
    if(!area)return;
    if(isStart&&!eventArea)return;
    const rect=area.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return;
    const actions=[];
    Array.from(event.changedTouches||[]).forEach(touch=>{
      const id=Number(touch.identifier),previous=touchStates.get(id),stabilized=previous&&!isStart?stabilizedMoveTouch(previous,touch,rect):{touch,centerAnchorX:Number(touch.clientX),centerMoved:false},next=contactsForTouch(stabilized.touch,rect);
      if(!next)return;
      const previousSet=new Set(previous?.subLanes||[]),candidateEntered=next.subLanes.filter(lane=>!previousSet.has(lane)),centerChanged=!previous||previous.centerSubLane!==next.centerSubLane;
      let entered=candidateEntered,acceptedRadiusX=Number(previous?.acceptedRadiusX);
      const rawRadiusX=Number(touch?.radiusX);
      if(isStart||centerChanged||stabilized.centerMoved){
        acceptedRadiusX=rawRadiusX>0?rawRadiusX:acceptedRadiusX;
      }else if(candidateEntered.length){
        if(!radiusExpansionAccepted(acceptedRadiusX,rawRadiusX)){
          const nextSet=new Set(next.subLanes),kept=(previous?.subLanes||[]).filter(lane=>nextSet.has(lane));
          if(!kept.includes(next.centerSubLane))kept.push(next.centerSubLane);
          next.subLanes=kept.sort((a,b)=>a-b);
          entered=[];
        }else acceptedRadiusX=rawRadiusX;
      }else if(rawRadiusX>0&&(!(acceptedRadiusX>0)||rawRadiusX<acceptedRadiusX))acceptedRadiusX=rawRadiusX;
      touchStates.set(id,{...next,touch,centerAnchorX:stabilized.centerAnchorX,acceptedRadiusX});
      if(isStart||centerChanged||entered.length)actions.push({id,touch,next,entered:isStart?next.subLanes:entered});
    });
    if(!actions.length){defer(applyTouchSpanGlow);return;}
    RHYTHM_NOTE_SE_RUNTIME.beginInputGroup?.();
    defer(()=>{
      let eligible=false;
      try{
        actions.forEach(action=>{
          const baseKey=`touch:${action.id}`;
          if(RHYTHM_GESTURE_RUNTIME._sessions?.has(baseKey))return;
          eligible=true;
          action.entered.filter(lane=>lane!==action.next.centerSubLane).forEach(lane=>dispatchTapProbe(area,action.touch,lane));
        });
        if(!eligible)RHYTHM_NOTE_SE_RUNTIME.markInputGroupHandled?.();
        applyTouchSpanGlow();
      }finally{RHYTHM_NOTE_SE_RUNTIME.endInputGroup?.();}
    });
  };
  if(typeof document!=='undefined'){
    const style=document.createElement('style');
    style.dataset.rhythmTouchSpan='';
    style.textContent='[data-rhythm-sublane-feedback][data-rhythm-touchspan="true"]{opacity:1!important}';
    document.head.appendChild(style);
    document.addEventListener('touchstart',event=>startOrMove(event,true),{capture:true,passive:true});
    document.addEventListener('touchmove',event=>{if(Array.from(event.changedTouches||[]).some(touch=>touchStates.has(Number(touch.identifier))))startOrMove(event,false);},{capture:true,passive:true});
    const finish=event=>{Array.from(event.changedTouches||[]).forEach(touch=>touchStates.delete(Number(touch.identifier)));defer(applyTouchSpanGlow);};
    document.addEventListener('touchend',finish,{capture:true,passive:true});
    document.addEventListener('touchcancel',finish,{capture:true,passive:true});
    document.addEventListener('click',event=>{if(event.target?.closest?.('[data-rhythm-pause],[data-rhythm-pause-menu] button'))clear();},true);
  }
  return {contactsForTouch,isSyntheticTapKey:key=>syntheticTapKeys.has(String(key)),clear,_touchStates:touchStates,_syntheticTapKeys:syntheticTapKeys,_stabilizedMoveTouch:stabilizedMoveTouch,_radiusExpansionAccepted:radiusExpansionAccepted};
})();

const rhythmMatchInputBatch=(notes,inputs,nowMs,offsetMs=0)=>{
  const source=Array.isArray(notes)?notes:[],claimed=new Set(),seenInputs=new Set(),now=Number(nowMs),offset=Number(offsetMs)||0;
  return (Array.isArray(inputs)?inputs:[]).map(input=>{
    const key=String(input?.inputKey??'');
    if(!key||seenInputs.has(key))return {input,target:null,deltaMs:null};
    seenInputs.add(key);
    const lane=Number(input?.lane),subCoordinate=Number(input?.subLaneCoordinate),tapOnly=RHYTHM_TOUCH_SPAN_RUNTIME.isSyntheticTapKey(key);
    const inputSpan=note=>{
      if(rhythmNoteHasVariableSpan(note)){
        const span=rhythmProjectSubLaneSpan(note.subLane,note.subLaneWidth,1);
        return {start:span.subLane,end:span.subLane+span.subLaneWidth,center:span.subLane+span.subLaneWidth/2,width:span.subLaneWidth};
      }
      return rhythmSlideInputSpan(note);
    };
    const acceptsPosition=note=>{
      const span=inputSpan(note);
      if(!span)return note.lane===lane;
      if(!Number.isFinite(subCoordinate))return note.lane===lane;
      const tolerance=span.width===1?RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES:0;
      return subCoordinate>=span.start-tolerance&&subCoordinate<=span.end+tolerance;
    };
    const spatialDistance=note=>{
      if(!Number.isFinite(subCoordinate))return 0;
      const span=inputSpan(note);
      return span?Math.abs(subCoordinate-span.center):0;
    };
    const candidates=source.map((note,index)=>({note,index})).filter(({note,index})=>!claimed.has(index)&&!note.done&&note.activePointerId===null&&RHYTHM_NOTE_TYPES.includes(note.type)&&(!tapOnly||note.type==='TAP')&&acceptsPosition(note)&&Math.abs(now-(note.timeMs+offset))<=200).sort((a,b)=>Math.abs(now-(a.note.timeMs+offset))-Math.abs(now-(b.note.timeMs+offset))||spatialDistance(a.note)-spatialDistance(b.note)||a.index-b.index);
    const picked=candidates[0];
    if(!picked)return {input,target:null,deltaMs:null};
    claimed.add(picked.index);
    const originalType=picked.note.type;
    if(originalType==='HOLD'||originalType==='FLICK'||originalType==='SLIDE')RHYTHM_GESTURE_RUNTIME.bind(key,picked.note,originalType,now,offset);
    RHYTHM_NOTE_SE_RUNTIME.play();
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

// 10サブレーン入力と幅1〜4を実際に確認するデバッグ専用譜面。
const widthTestNotes = Object.freeze([
  [1800,0,1],[2600,4,1],[3400,9,1], // 左端・中央・右端の幅1
  [4400,1,2],[5200,3,3],[6000,6,4], // 幅2〜4とワイドTAP
  [7200,4,1],[7200,5,1],             // 隣接する幅1の同時押し
  [8400,0,1],[9000,1,2],[9600,3,3],[10200,6,4], // 幅1→2→3→4
  [11200,3,1],[11200,4,1],[11200,5,1],          // 1本指の接触幅で確認する幅1×3同時TAP
].map(([timeMs,subLane,subLaneWidth])=>Object.freeze({type:'TAP',timeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth})));
const widthTestChart=Object.freeze({level:1,notes:widthTestNotes,totalNotes:widthTestNotes.length,durationMs:13000});
// STEP 2A: 可変幅HOLDの始点・帯・ENDバーと複数指入力を確認するNORMAL専用譜面。
const widthHoldTestNotes=Object.freeze([
  [1800,3200,0,1],[4000,5400,2,2],[6200,7600,4,3],[8400,10000,6,4],
  [10800,12200,0,1],[13000,14400,9,1],
  [15200,17000,4,1],[15200,17000,5,1],
].map(([timeMs,endTimeMs,subLane,subLaneWidth])=>Object.freeze({type:'HOLD',timeMs,endTimeMs,lane:Math.floor(subLane/2),subLane,subLaneWidth})).concat([
  Object.freeze({type:'HOLD',timeMs:18000,endTimeMs:20200,lane:2,subLane:4,subLaneWidth:2}),
  Object.freeze({type:'TAP',timeMs:18800,lane:4,subLane:8,subLaneWidth:2}),
  // STEP 2C: FLICKもTAP/HOLDと同じ10サブレーン・幅1〜4で開始位置を確認する。
  Object.freeze({type:'FLICK',timeMs:22200,lane:0,subLane:0,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:23000,lane:1,subLane:2,subLaneWidth:2}),
  Object.freeze({type:'FLICK',timeMs:23800,lane:2,subLane:4,subLaneWidth:3}),
  Object.freeze({type:'FLICK',timeMs:24600,lane:3,subLane:6,subLaneWidth:4}),
  Object.freeze({type:'FLICK',timeMs:25600,lane:4,subLane:9,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:26600,lane:2,subLane:4,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:26600,lane:2,subLane:5,subLaneWidth:1}),
  Object.freeze({type:'FLICK',timeMs:27800,lane:1,subLane:2,subLaneWidth:2}),
  Object.freeze({type:'TAP',timeMs:27800,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'HOLD',timeMs:29000,endTimeMs:31000,lane:0,subLane:0,subLaneWidth:2}),
  Object.freeze({type:'FLICK',timeMs:29800,lane:3,subLane:6,subLaneWidth:2}),
]));
const widthHoldTestChart=Object.freeze({level:2,notes:widthHoldTestNotes,totalNotes:widthHoldTestNotes.length,durationMs:32000});
// STEP 2B-1: SLIDEの幅は従来のまま、始点とslidePointsを0.5レーン刻みへ拡張するHARD専用テスト譜面。
const widthSlideTestNotes=Object.freeze([
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3600,lane:.5,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:.5}),Object.freeze({timeMs:2400,lane:1}),Object.freeze({timeMs:3000,lane:1.5}),Object.freeze({timeMs:3600,lane:2})])}),
  Object.freeze({type:'SLIDE',timeMs:4600,endTimeMs:6400,lane:3.5,endLane:2,slidePoints:Object.freeze([Object.freeze({timeMs:4600,lane:3.5}),Object.freeze({timeMs:5200,lane:3}),Object.freeze({timeMs:5800,lane:2.5}),Object.freeze({timeMs:6400,lane:2})])}),
  Object.freeze({type:'SLIDE',timeMs:7400,endTimeMs:9800,lane:1,endLane:3,slidePoints:Object.freeze([Object.freeze({timeMs:7400,lane:1}),Object.freeze({timeMs:8000,lane:1.5}),Object.freeze({timeMs:8600,lane:1}),Object.freeze({timeMs:9200,lane:2.5}),Object.freeze({timeMs:9800,lane:3})])}),
  Object.freeze({type:'TAP',timeMs:8600,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'SLIDE',timeMs:10800,endTimeMs:12800,lane:2.5,endLane:.5,slidePoints:Object.freeze([Object.freeze({timeMs:10800,lane:2.5}),Object.freeze({timeMs:11300,lane:2}),Object.freeze({timeMs:11800,lane:1.5}),Object.freeze({timeMs:12300,lane:1}),Object.freeze({timeMs:12800,lane:.5})])}),
]);
const widthSlideTestChart=Object.freeze({level:4,notes:widthSlideTestNotes,totalNotes:widthSlideTestNotes.length,durationMs:14000});
// STEP 2B-2: SLIDE全体へsubLaneWidth 1〜4を指定するEXPERT専用テスト譜面。
// この段階では途中幅変化は行わず、1ノーツ内は始点・帯・ENDバーまで一定幅とする。
const widthSlideVariableTestNotes=Object.freeze([
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3400,lane:0,endLane:1,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:0}),Object.freeze({timeMs:2600,lane:.5}),Object.freeze({timeMs:3400,lane:1})])}),
  Object.freeze({type:'SLIDE',timeMs:4200,endTimeMs:5800,lane:1,endLane:2.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:4200,lane:1}),Object.freeze({timeMs:5000,lane:1.5}),Object.freeze({timeMs:5800,lane:2.5})])}),
  Object.freeze({type:'SLIDE',timeMs:6600,endTimeMs:8400,lane:1.5,endLane:2.5,subLaneWidth:3,slidePoints:Object.freeze([Object.freeze({timeMs:6600,lane:1.5}),Object.freeze({timeMs:7200,lane:2}),Object.freeze({timeMs:7800,lane:1.5}),Object.freeze({timeMs:8400,lane:2.5})])}),
  Object.freeze({type:'SLIDE',timeMs:9200,endTimeMs:11200,lane:1.5,endLane:2.5,subLaneWidth:4,slidePoints:Object.freeze([Object.freeze({timeMs:9200,lane:1.5}),Object.freeze({timeMs:9800,lane:2}),Object.freeze({timeMs:10400,lane:2.5}),Object.freeze({timeMs:11200,lane:2.5})])}),
  Object.freeze({type:'TAP',timeMs:10000,lane:4,subLane:8,subLaneWidth:2}),
  Object.freeze({type:'SLIDE',timeMs:12200,endTimeMs:14200,lane:.5,endLane:1.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:12200,lane:.5}),Object.freeze({timeMs:13200,lane:1}),Object.freeze({timeMs:14200,lane:1.5})])}),
  Object.freeze({type:'SLIDE',timeMs:12200,endTimeMs:14200,lane:3.5,endLane:2.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:12200,lane:3.5}),Object.freeze({timeMs:13200,lane:3}),Object.freeze({timeMs:14200,lane:2.5})])}),
]);
const widthSlideVariableTestChart=Object.freeze({level:7,notes:widthSlideVariableTestNotes,totalNotes:widthSlideVariableTestNotes.length,durationMs:15500});
// STEP 2B-4: STEP2B-3の幅変化に、複雑な経路を実際に追従するMASTER専用テストを追加する。
const widthSlideChangingTestNotes=Object.freeze([
  // STEP2B-3の基本的な幅変化を維持する。
  Object.freeze({type:'SLIDE',timeMs:1800,endTimeMs:3800,lane:1.5,endLane:1.5,slidePoints:Object.freeze([Object.freeze({timeMs:1800,lane:1.5,subLaneWidth:1}),Object.freeze({timeMs:3800,lane:1.5,subLaneWidth:4})])}),
  Object.freeze({type:'SLIDE',timeMs:4600,endTimeMs:6600,lane:2.5,endLane:2.5,slidePoints:Object.freeze([Object.freeze({timeMs:4600,lane:2.5,subLaneWidth:4}),Object.freeze({timeMs:6600,lane:2.5,subLaneWidth:1})])}),
  Object.freeze({type:'SLIDE',timeMs:7400,endTimeMs:10600,lane:1.5,endLane:1.5,slidePoints:Object.freeze([Object.freeze({timeMs:7400,lane:1.5,subLaneWidth:1}),Object.freeze({timeMs:8400,lane:1.5,subLaneWidth:3}),Object.freeze({timeMs:9400,lane:1.5,subLaneWidth:2}),Object.freeze({timeMs:10600,lane:1.5,subLaneWidth:4})])}),
  // 大きなS字。緩やかな折り返しで帯と追従経路の一致を見る。
  Object.freeze({type:'SLIDE',timeMs:11400,endTimeMs:15800,lane:.5,endLane:.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:11400,lane:.5}),Object.freeze({timeMs:12500,lane:2}),Object.freeze({timeMs:13600,lane:3.5}),Object.freeze({timeMs:14700,lane:2}),Object.freeze({timeMs:15800,lane:.5})])}),
  // 細かいジグザグ。短いsegmentの連続で飛びや隙間が出ないかを見る。
  Object.freeze({type:'SLIDE',timeMs:16600,endTimeMs:20600,lane:1,endLane:3,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:16600,lane:1}),Object.freeze({timeMs:17100,lane:3}),Object.freeze({timeMs:17600,lane:1}),Object.freeze({timeMs:18100,lane:3}),Object.freeze({timeMs:18600,lane:1}),Object.freeze({timeMs:19100,lane:3}),Object.freeze({timeMs:19600,lane:1}),Object.freeze({timeMs:20100,lane:3}),Object.freeze({timeMs:20600,lane:3})])}),
  // 0.5レーン単位の左右移動。SLIDE中の別TAPも同時に確認する。
  Object.freeze({type:'SLIDE',timeMs:21400,endTimeMs:25400,lane:1.5,endLane:1.5,subLaneWidth:1,slidePoints:Object.freeze([Object.freeze({timeMs:21400,lane:1.5}),Object.freeze({timeMs:21900,lane:2}),Object.freeze({timeMs:22400,lane:1.5}),Object.freeze({timeMs:22900,lane:2}),Object.freeze({timeMs:23400,lane:1.5}),Object.freeze({timeMs:23900,lane:2}),Object.freeze({timeMs:24400,lane:1.5}),Object.freeze({timeMs:24900,lane:2}),Object.freeze({timeMs:25400,lane:1.5})])}),
  Object.freeze({type:'TAP',timeMs:23400,lane:4,subLane:8,subLaneWidth:2}),
  // 曲がりながら幅1→4→1。頭とENDバーも各時刻の幅に揃える。
  Object.freeze({type:'SLIDE',timeMs:26200,endTimeMs:30600,lane:.5,endLane:3.5,slidePoints:Object.freeze([Object.freeze({timeMs:26200,lane:.5,subLaneWidth:1}),Object.freeze({timeMs:27300,lane:2,subLaneWidth:2}),Object.freeze({timeMs:28400,lane:3.5,subLaneWidth:4}),Object.freeze({timeMs:29500,lane:2,subLaneWidth:2}),Object.freeze({timeMs:30600,lane:3.5,subLaneWidth:1})])}),
  // 多数pointの長い経路。同時HOLDで別pointerの入力も確認する。
  Object.freeze({type:'SLIDE',timeMs:31400,endTimeMs:39400,lane:.5,endLane:3.5,subLaneWidth:2,slidePoints:Object.freeze([Object.freeze({timeMs:31400,lane:.5}),Object.freeze({timeMs:31900,lane:1}),Object.freeze({timeMs:32400,lane:1.5}),Object.freeze({timeMs:32900,lane:2}),Object.freeze({timeMs:33400,lane:2.5}),Object.freeze({timeMs:33900,lane:3}),Object.freeze({timeMs:34400,lane:3.5}),Object.freeze({timeMs:34900,lane:3}),Object.freeze({timeMs:35400,lane:2.5}),Object.freeze({timeMs:35900,lane:2}),Object.freeze({timeMs:36400,lane:1.5}),Object.freeze({timeMs:36900,lane:1}),Object.freeze({timeMs:37400,lane:.5}),Object.freeze({timeMs:37900,lane:1.5}),Object.freeze({timeMs:38400,lane:2.5}),Object.freeze({timeMs:38900,lane:3}),Object.freeze({timeMs:39400,lane:3.5})])}),
  Object.freeze({type:'HOLD',timeMs:33800,endTimeMs:35800,lane:4,subLane:8,subLaneWidth:2}),
]);
const widthSlideChangingTestChart=Object.freeze({level:9,notes:widthSlideChangingTestNotes,totalNotes:widthSlideChangingTestNotes.length,durationMs:41000});

// 同じあつ杯テーマ音源を0秒から使う、約60秒の総合回帰テスト譜面。
// 正式譜面候補やWIDTH TESTとは分離し、169 BPM / beatZero 40msの16分グリッドへ揃える。
const atsuCupDebugGridMs=grid=>Math.round(40+Number(grid)*(60000/169/4));
const atsuCupDebugTap=(grid,subLane,subLaneWidth=2)=>Object.freeze({type:'TAP',timeMs:atsuCupDebugGridMs(grid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugHold=(startGrid,endGrid,subLane,subLaneWidth=2)=>Object.freeze({type:'HOLD',timeMs:atsuCupDebugGridMs(startGrid),endTimeMs:atsuCupDebugGridMs(endGrid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugFlick=(grid,subLane,subLaneWidth=2)=>Object.freeze({type:'FLICK',timeMs:atsuCupDebugGridMs(grid),lane:Math.floor(subLane/2),subLane,subLaneWidth});
const atsuCupDebugSlide=(points,subLaneWidth=2)=>{
  const slidePoints=Object.freeze(points.map(([grid,lane,width])=>Object.freeze({timeMs:atsuCupDebugGridMs(grid),lane,...(width?{subLaneWidth:width}:{})})));
  return Object.freeze({type:'SLIDE',timeMs:slidePoints[0].timeMs,endTimeMs:slidePoints[slidePoints.length-1].timeMs,lane:slidePoints[0].lane,endLane:slidePoints[slidePoints.length-1].lane,subLaneWidth,slidePoints});
};
const atsuCupDebugShortNotes=Object.freeze([
  // 0〜14秒: 導入、左右・中央・交互・同時押しの基本TAP。
  atsuCupDebugTap(20,4),atsuCupDebugTap(32,2),atsuCupDebugTap(40,6),
  atsuCupDebugTap(48,0),atsuCupDebugTap(56,8),atsuCupDebugTap(64,2),atsuCupDebugTap(72,6),
  atsuCupDebugTap(80,4),atsuCupDebugTap(88,0),atsuCupDebugTap(88,8),atsuCupDebugTap(96,2),
  atsuCupDebugTap(104,6),atsuCupDebugTap(112,4),atsuCupDebugTap(120,0),atsuCupDebugTap(120,8),
  atsuCupDebugTap(132,2),atsuCupDebugTap(144,6),
  // 14〜24秒: 幅1〜4、左右端、隣接幅1、2本指と指腹接触の確認。
  atsuCupDebugTap(160,0,1),atsuCupDebugTap(176,2,2),atsuCupDebugTap(192,4,3),atsuCupDebugTap(208,6,4),
  atsuCupDebugTap(220,9,1),atsuCupDebugTap(232,4,1),atsuCupDebugTap(232,5,1),
  atsuCupDebugTap(244,0,1),atsuCupDebugTap(244,8,2),
  atsuCupDebugTap(260,3,1),atsuCupDebugTap(260,4,1),atsuCupDebugTap(260,5,1),
  // 24〜34秒: 幅1〜4、短長HOLD、HOLD中別TAP、左右2本指。
  atsuCupDebugHold(276,292,0,1),atsuCupDebugHold(304,328,2,2),atsuCupDebugTap(316,8,2),
  atsuCupDebugHold(340,372,4,3),atsuCupDebugTap(352,0,1),
  atsuCupDebugHold(380,412,6,4),atsuCupDebugHold(380,404,0,1),
  // 34〜42秒: 左右・幅違いFLICKとFLICK+別TAP。
  atsuCupDebugFlick(420,0,1),atsuCupDebugFlick(432,8,2),atsuCupDebugFlick(444,2,3),
  atsuCupDebugFlick(456,6,4),atsuCupDebugFlick(468,0,2),atsuCupDebugTap(468,8,2),
  // 42〜52秒: 直線、0.5レーン、折り返し、固定幅、幅1→4→1。
  atsuCupDebugSlide([[480,.5],[496,1.5],[512,2.5]],2),
  atsuCupDebugSlide([[520,3.5],[532,3],[544,3.5],[556,2.5]],1),
  atsuCupDebugSlide([[566,.5,1],[578,2,4],[590,3.5,1]],1),
  atsuCupDebugTap(578,8,2),
  // 52〜58秒: HOLD/SLIDE中の別TAP、幅違い、左右2本指。
  atsuCupDebugHold(596,628,0,2),atsuCupDebugTap(608,8,1),atsuCupDebugTap(620,6,3),
  atsuCupDebugSlide([[632,3.5,1],[644,2.5,3],[656,3.5,2]],1),atsuCupDebugTap(644,0,2),
  // 終了直前は疎にして、最終ノーツ後の短縮終了とリザルト遷移を見やすくする。
  atsuCupDebugTap(664,4,2),
]);
const ATSU_CUP_DEBUG_SHORT_END_MS=atsuCupDebugGridMs(676);
const atsuCupDebugShortChart=Object.freeze({level:8,notes:atsuCupDebugShortNotes,totalNotes:atsuCupDebugShortNotes.length,durationMs:ATSU_CUP_DEBUG_SHORT_END_MS});

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
  Object.freeze({
    songId:'width_test', displayName:'WIDTH TEST', bgmTrackId:'atsu_cup_theme',
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='EASY'?widthTestChart:id==='NORMAL'?widthHoldTestChart:id==='HARD'?widthSlideTestChart:id==='EXPERT'?widthSlideVariableTestChart:id==='MASTER'?widthSlideChangingTestChart:emptyRhythmChart()])))
  }),
  Object.freeze({
    songId:'atsu_cup_theme_debug_short',
    displayName:'あつ杯テーマ DEBUG 60s',
    debugDescription:'約60秒の総合テスト（正式候補・WIDTH TESTとは別）',
    bgmTrackId:'atsu_cup_theme',
    playDurationMs:ATSU_CUP_DEBUG_SHORT_END_MS,
    difficulties:Object.freeze(Object.fromEntries(RHYTHM_DIFFICULTIES.map(({id})=>[id,id==='HARD'?atsuCupDebugShortChart:emptyRhythmChart()])))
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
    svg[data-rhythm-slide-body]{position:absolute;inset:0;height:var(--rhythm-slide-area-height,0px)!important;overflow:visible;pointer-events:none;filter:drop-shadow(0 0 5px rgba(168,85,247,.38))}
    [data-rhythm-slide-segment]{fill:rgba(168,85,247,.48);stroke:rgba(233,213,255,.56);stroke-width:1}
  `;
  document.head.appendChild(style);
  const decorate=()=>{
    const area=document.querySelector('[data-rhythm-play-area]');
    if(!area)return;
    const els=Array.from(area.querySelectorAll('[data-rhythm-note]'));
    els.forEach((el,index)=>{
      if(el.dataset.noteType!=='SLIDE'||el.querySelector('[data-rhythm-slide-body]'))return;
      const body=document.createElementNS('http://www.w3.org/2000/svg','svg');
      body.dataset.rhythmSlideBody='';
      body.setAttribute('aria-hidden','true');
      el.insertBefore(body,el.firstChild);
    });
    const label=area.previousElementSibling?.querySelector?.('small');
    const hasGestureNotes=els.some(el=>el.dataset.noteType==='FLICK'||el.dataset.noteType==='SLIDE');
    if(label&&hasGestureNotes&&label.textContent!=='MIX TEST')label.textContent='MIX TEST';
  };
  const observer=new MutationObserver(decorate);
  const start=()=>{decorate();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmGestureVisuals();

const installRhythmGeometryStyles=()=>{
  if(typeof document==='undefined')return;
  if(document.documentElement.dataset.rhythmGeometryStyle==='ready')return;
  document.documentElement.dataset.rhythmGeometryStyle='ready';
  const style=document.createElement('style');
  style.dataset.rhythmGeometryStyle='';
  style.textContent=`
    [data-rhythm-lane]{position:absolute!important;inset:0!important;border:0!important;filter:none!important;background:linear-gradient(180deg,rgba(15,23,42,.76) 0%,rgba(15,23,42,.48) 48%,rgba(8,47,73,.58) 100%)!important}
    [data-rhythm-lane]::before{content:"";position:absolute;inset:0!important;pointer-events:none;opacity:1!important;filter:none!important;background:linear-gradient(180deg,rgba(216,180,254,.26),rgba(103,232,249,.34) 72%,rgba(236,254,255,.72));clip-path:var(--rhythm-boundary-clip,none)!important}
    [data-rhythm-lane]::after{content:none!important}
    [data-rhythm-lane]:last-child::after{content:""!important;position:absolute;inset:0!important;pointer-events:none;opacity:1!important;filter:none!important;background:linear-gradient(180deg,rgba(216,180,254,.26),rgba(103,232,249,.34) 72%,rgba(236,254,255,.72));clip-path:var(--rhythm-right-clip,none)!important}
    [data-rhythm-sublane-boundary]{display:block;position:absolute;z-index:1;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(216,180,254,.12),rgba(103,232,249,.20) 70%,rgba(236,254,255,.38));clip-path:var(--rhythm-sub-clip,none)}
    [data-rhythm-note]{z-index:2}
    [data-rhythm-lane][data-pressed="true"]{background:linear-gradient(180deg,rgba(34,211,238,.10),rgba(34,211,238,.22) 54%,rgba(217,70,239,.30) 100%)!important;box-shadow:inset 0 0 30px rgba(103,232,249,.48),inset 0 -72px 64px rgba(6,182,212,.34),0 0 15px rgba(34,211,238,.24)!important;border:0!important;filter:none!important}
    [data-rhythm-note]>span:last-child{transform:scale(var(--rhythm-note-size-scale,1)) scaleY(var(--rhythm-note-depth-scale,1));transform-origin:center;filter:brightness(var(--rhythm-note-depth-brightness,1));transition:filter 40ms linear}
    [data-rhythm-note][data-rhythm-failed="true"]{filter:grayscale(1) brightness(.72)!important}
    [data-rhythm-note][data-rhythm-failed="true"]>span:last-child{box-shadow:none!important;border-color:rgba(148,163,184,.6)!important}
    [data-rhythm-judgment-line]{height:4px!important;background:linear-gradient(90deg,#d8b4fe 0%,#ecfeff 50%,#d8b4fe 100%)!important;border-radius:999px;box-shadow:0 0 14px #67e8f9,0 0 28px #c084fc,0 8px 24px rgba(34,211,238,.34)!important}
  `;
  document.head.appendChild(style);
};
installRhythmGeometryStyles();

const rhythmLayoutPlayArea=area=>{
  if(!area)return;
  const rect=area.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  Array.from(area.querySelectorAll('[data-rhythm-lane]')).forEach((lane,index)=>{
    lane.style.clipPath=rhythmLanePolygon(index);
    lane.style.setProperty('--rhythm-boundary-clip',rhythmBoundaryLinePolygon(index));
    if(index===RHYTHM_LANE_COUNT-1)lane.style.setProperty('--rhythm-right-clip',rhythmBoundaryLinePolygon(RHYTHM_LANE_COUNT,-1));
    const label=lane.querySelector('span');
    if(label){
      const labelRect=label.getBoundingClientRect(),labelY=rhythmClamp01((labelRect.top-rect.top+labelRect.height/2)/rect.height),at=rhythmProjectLane(index,labelY);
      label.style.left=`${at.center*100}%`;
      label.style.transform='translateX(-50%)';
    }
  });
  Array.from(area.querySelectorAll('[data-rhythm-sublane-boundary]')).forEach((boundary,index)=>{
    boundary.style.setProperty('--rhythm-sub-clip',rhythmBoundaryLinePolygon(index+.5));
  });
  const line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line?.getBoundingClientRect();
  if(line&&lineRect){
    const y=rhythmClamp01((lineRect.top-rect.top+lineRect.height/2)/rect.height),left=rhythmProjectBoundary(0,y),right=rhythmProjectBoundary(RHYTHM_LANE_COUNT,y);
    line.style.left=`${(left*100).toFixed(4)}%`;
    line.style.right=`${((1-right)*100).toFixed(4)}%`;
  }
};
const rhythmSlideSegmentPolygons=(note,chartNowMs,travel,rect,noteHalfHeight=Number(travel.noteHalfHeight)||0)=>{
  const source=note?._rhythmSlideRenderPoints||rhythmSlidePoints(note),start=Number(source[0]?.timeMs)||0,end=Number(source[source.length-1]?.timeMs)||start;
  const now=Math.max(start,Math.min(end,Number(chartNowMs)||start));
  const project=point=>{
    const progress=1-(Number(point.timeMs)-Number(travel.visualTime))/Number(travel.travelMs),y=Number(travel.spawnY)+rhythmProjectTravelProgress(progress)*Number(travel.travelPx)+noteHalfHeight,yRatio=rhythmClamp01(y/rect.height),span=rhythmProjectSlideSpan(Number(point.lane),note,yRatio,point.timeMs),half=rect.width*span.width*RHYTHM_BODY_WIDTH_RATIO/2;
    return {y,left:rect.width*span.center-half,right:rect.width*span.center+half};
  };
  let firstIndex=0;
  while(firstIndex<source.length&&Number(source[firstIndex].timeMs)<=now)firstIndex++;
  const segments=[];
  // authored点の間をそのまま直線で結ぶと、projectionの曲線ぶんだけ途中がレーンから外れる。
  // 点の間隔が長い(=高速でSLIDEが画面より長く伸びる)ほど差が開くので、時間で細分化して沿わせる。
  const startPoint=now>start?{timeMs:now,lane:rhythmSlideExpectedLane(note,now)}:source[0];
  let fromPoint=startPoint,from=project(startPoint);
  for(let index=Math.max(1,firstIndex);index<source.length;index++){
    const toPoint=source[index],fromTime=Number(fromPoint.timeMs),toTime=Number(toPoint.timeMs),spanMs=toTime-fromTime;
    for(let step=1;step<=RHYTHM_SLIDE_SEGMENT_STEPS;step++){
      const ratio=step/RHYTHM_SLIDE_SEGMENT_STEPS,timeMs=fromTime+spanMs*ratio;
      const to=step===RHYTHM_SLIDE_SEGMENT_STEPS?project(toPoint):project({timeMs,lane:rhythmSlideExpectedLane(note,timeMs)});
      segments.push(`${from.left.toFixed(2)},${from.y.toFixed(2)} ${from.right.toFixed(2)},${from.y.toFixed(2)} ${to.right.toFixed(2)},${to.y.toFixed(2)} ${to.left.toFixed(2)},${to.y.toFixed(2)}`);
      from=to;
    }
    fromPoint=toPoint;
  }
  return segments;
};
const rhythmLayoutNoteVisual=(el,note,yPx,visualLane,area,releaseYpx=null,slideTravel=null,frameLayout=null)=>{
  if(!el||!area)return;
  const rect=frameLayout?.rect||area.getBoundingClientRect();
  if(!(rect.width>0&&rect.height>0))return;
  const noteHeight=Number(frameLayout?.noteHeight)||el.offsetHeight,lane=Number(visualLane),centerY=Number(yPx)+noteHeight/2,yRatio=rhythmClamp01(centerY/rect.height);
  const projected=rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(lane,note,yRatio,slideTravel?.chartNowMs):rhythmNoteVisualSpan(note,lane,yRatio),projectedWidth=rect.width*projected.width,width=Math.min(projectedWidth,Math.max(4,projectedWidth*RHYTHM_NOTE_WIDTH_RATIO)),left=rect.width*projected.center-width/2;
  el.style.left=`${left.toFixed(2)}px`;
  el.style.width=`${width.toFixed(2)}px`;
  el.style.setProperty('--rhythm-note-depth-scale',(0.56+projected.scale*.44).toFixed(3));
  el.style.setProperty('--rhythm-note-depth-brightness',(0.72+projected.scale*.28).toFixed(3));
  const body=el._rhythmVisualBody||el.querySelector('[data-rhythm-hold-body],[data-rhythm-slide-body]');
  if(!body)return;
  el._rhythmVisualBody=body;
  if(body.hasAttribute('data-rhythm-slide-body')){
    body.style.left=`${(-left).toFixed(2)}px`;
    body.style.top=`${(-Number(yPx)).toFixed(2)}px`;
    body.style.width=`${rect.width.toFixed(2)}px`;
    body.style.setProperty('--rhythm-slide-area-height',`${rect.height.toFixed(2)}px`);
    body.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);
    const polygons=slideTravel?rhythmSlideSegmentPolygons(note,slideTravel.chartNowMs,slideTravel,rect,noteHeight/2):[];
    polygons.forEach((points,index)=>{
      let segment=body.childNodes[index];
      if(!segment){segment=document.createElementNS('http://www.w3.org/2000/svg','polygon');segment.dataset.rhythmSlideSegment='';body.appendChild(segment);}
      segment.style.display='';
      if(segment._rhythmPoints!==points){segment.setAttribute('points',points);segment._rhythmPoints=points;}
    });
    for(let index=polygons.length;index<body.childNodes.length;index++)body.childNodes[index].style.display='none';
  }else{
  const measuredBodyHeight=frameLayout&&Number.isFinite(Number(frameLayout.bodyHeight))?Number(frameLayout.bodyHeight):parseFloat(getComputedStyle(body).height),height=Math.max(0,measuredBodyHeight||0);
  // 帯の上端と下端だけを直線で結ぶと、projectionが曲線であるぶん途中の高さでレーンから外れる。
  // さらに帯が画面上端を越えて長い(=高速)場合、clipPathの0%は画面外のyを指すのに
  // 幅は画面内の0%位置で計算されてしまい、可視範囲の全体が外側へ膨らむ。
  // 帯の実際の上端(画面外でも可)から下端までを一定間隔でサンプルし、曲線へ沿わせる。
  const bodyTopY=centerY-height;
  const variableHold=rhythmNoteHasVariableSpan(note)&&note.type==='HOLD',bodyRatio=variableHold?RHYTHM_NOTE_WIDTH_RATIO:RHYTHM_BODY_WIDTH_RATIO;
  const edgeAt=ratio=>{
    const span=variableHold?rhythmNoteVisualSpan(note,lane,rhythmClamp01((bodyTopY+height*ratio)/rect.height)):rhythmProjectLane(lane,rhythmClamp01((bodyTopY+height*ratio)/rect.height)),half=span.width*bodyRatio/2;
    return {left:span.center-half,right:span.center+half};
  };
  // 画面上端はprojectionの曲がりが一番きついので、帯がそこを跨ぐときは必ず点を置く。
  const topEdgeRatio=height>0?(0-bodyTopY)/height:0;
  const bodyRatios=topEdgeRatio>1e-6&&topEdgeRatio<1-1e-6
    ?[...rhythmProjectionEdgeRatios(),topEdgeRatio].sort((a,b)=>a-b)
    :rhythmProjectionEdgeRatios();
  const bodyEdges=bodyRatios.map(edgeAt);
  const bodyRight=bodyEdges.map((edge,index)=>`${(edge.right*100).toFixed(3)}% ${(bodyRatios[index]*100).toFixed(3)}%`);
  const bodyLeft=bodyEdges.map((edge,index)=>`${(edge.left*100).toFixed(3)}% ${(bodyRatios[index]*100).toFixed(3)}%`).reverse();
  body.style.left=`${(-left).toFixed(2)}px`;
  body.style.width=`${rect.width.toFixed(2)}px`;
  body.style.clipPath=`polygon(${[...bodyRight,...bodyLeft].join(',')})`;
  }
  const endBar=el._rhythmEndBar||el.querySelector('[data-rhythm-end-bar]');
  if(endBar)el._rhythmEndBar=endBar;
  if(endBar&&Number.isFinite(releaseYpx)){
    const endY=rhythmClamp01((Number(releaseYpx)+noteHeight/2)/rect.height),end=rhythmNoteHasVariableSpan(note)&&note.type==='HOLD'?rhythmNoteVisualSpan(note,lane,endY):rhythmNoteIsSlide(note)?rhythmProjectSlideSpan(rhythmReleaseLane(note),note,endY,rhythmReleaseTargetMs(note)):rhythmProjectLane(rhythmReleaseLane(note),endY),barWidth=Math.max(10,rect.width*end.width*RHYTHM_NOTE_WIDTH_RATIO);
    endBar.style.left=`${(rect.width*end.center-left-barWidth/2).toFixed(2)}px`;
    endBar.style.top=`${(Number(releaseYpx)-Number(yPx)+noteHeight/2-4).toFixed(2)}px`;
    endBar.style.width=`${barWidth.toFixed(2)}px`;
    endBar.style.setProperty('--rhythm-end-depth-scale',(0.52+end.scale*.48).toFixed(3));
  }
};

// レーンのDOMが入れ替わった時だけ静的形状を設定する。ノーツはプレイ本体の1本のrAFから直接配置する。
const installRhythmPerspectiveNoteVisuals=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmPerspectiveNotes==='ready')return;
  document.documentElement.dataset.rhythmPerspectiveNotes='ready';

  let area=null;
  const scan=()=>{
    const next=document.querySelector('[data-rhythm-play-area]');
    if(next!==area){area=next;rhythmLayoutPlayArea(area);}
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
