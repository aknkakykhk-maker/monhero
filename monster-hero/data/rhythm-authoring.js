// DEBUG ONLY: 音ゲー譜面制作向けの実音源解析ツール。
// 本番譜面は固定データとして持ち、この解析結果をプレイ中に動的生成へ使わない。
const RHYTHM_AUTHORING_BPM_MIN = 70;
const RHYTHM_AUTHORING_BPM_MAX = 200;
const RHYTHM_AUTHORING_ENVELOPE_HZ = 100;

const rhythmEstimateBeatGridFromOnsets=(onsets,framesPerSecond,durationMs)=>{
  const values=Array.isArray(onsets)?onsets.map(v=>Math.max(0,Number(v)||0)):[];
  const fps=Math.max(1,Number(framesPerSecond)||0);
  if(values.length<8)return null;
  const minLag=Math.max(2,Math.floor(fps*60/RHYTHM_AUTHORING_BPM_MAX));
  const maxLag=Math.min(values.length-2,Math.ceil(fps*60/RHYTHM_AUTHORING_BPM_MIN));
  if(maxLag<=minLag)return null;
  const scores=[];
  let bestLag=minLag,bestScore=-Infinity;
  for(let lag=minLag;lag<=maxLag;lag++){
    let score=0,weight=0;
    for(let i=lag;i<values.length;i++){
      const a=values[i],b=values[i-lag];
      score+=a*b;
      weight+=Math.max(a,b);
    }
    const normalized=weight>0?score/weight:0;
    scores.push(normalized);
    if(normalized>bestScore){bestScore=normalized;bestLag=lag;}
  }
  const bpm=60*fps/bestLag;
  let bestPhase=0,bestPhaseScore=-Infinity;
  for(let phase=0;phase<bestLag;phase++){
    let score=0,hits=0;
    for(let i=phase;i<values.length;i+=bestLag){
      score+=values[i];
      if(i>0)score+=values[i-1]*.45;
      if(i+1<values.length)score+=values[i+1]*.45;
      hits++;
    }
    const normalized=hits?score/hits:0;
    if(normalized>bestPhaseScore){bestPhaseScore=normalized;bestPhase=phase;}
  }
  const sorted=scores.slice().sort((a,b)=>a-b);
  const median=sorted[Math.floor(sorted.length/2)]||0;
  const confidence=Math.max(0,Math.min(1,median>0?(bestScore/median-1)/3:bestScore>0?1:0));
  const beatMs=60000/bpm;
  const offsetMs=bestPhase/fps*1000;
  const limit=Math.max(0,Number(durationMs)||values.length/fps*1000);
  const beats=[];
  for(let time=offsetMs;time<=limit&&beats.length<32;time+=beatMs)beats.push(Math.round(time));
  return {bpm,beatMs,offsetMs,confidence,beats};
};

const rhythmBuildOnsetEnvelope=audioBuffer=>{
  if(!audioBuffer||!Number.isFinite(audioBuffer.sampleRate)||audioBuffer.sampleRate<=0||!audioBuffer.length)return null;
  const sampleRate=audioBuffer.sampleRate;
  const channels=Math.max(1,audioBuffer.numberOfChannels||1);
  const hop=Math.max(64,Math.round(sampleRate/RHYTHM_AUTHORING_ENVELOPE_HZ));
  const frameCount=Math.max(1,Math.ceil(audioBuffer.length/hop));
  const energy=new Array(frameCount).fill(0);
  const channelData=[];
  for(let c=0;c<channels;c++)channelData.push(audioBuffer.getChannelData(c));
  for(let frame=0;frame<frameCount;frame++){
    const start=frame*hop,end=Math.min(audioBuffer.length,start+hop);
    let sum=0,count=0;
    for(let i=start;i<end;i+=2){
      let mono=0;
      for(let c=0;c<channels;c++)mono+=channelData[c][i]||0;
      mono/=channels;
      sum+=mono*mono;
      count++;
    }
    energy[frame]=count?Math.sqrt(sum/count):0;
  }
  const onsets=new Array(frameCount).fill(0);
  let smooth=energy[0]||0,maxOnset=0;
  for(let i=1;i<frameCount;i++){
    smooth=smooth*.86+energy[i-1]*.14;
    const rise=Math.max(0,energy[i]-smooth*1.08);
    onsets[i]=rise;
    if(rise>maxOnset)maxOnset=rise;
  }
  if(maxOnset>0)for(let i=0;i<onsets.length;i++)onsets[i]/=maxOnset;
  return {onsets,framesPerSecond:sampleRate/hop};
};

const rhythmAnalyzeAudioBuffer=audioBuffer=>{
  const envelope=rhythmBuildOnsetEnvelope(audioBuffer);
  if(!envelope)return null;
  const durationMs=Math.round((Number(audioBuffer.duration)||audioBuffer.length/audioBuffer.sampleRate)*1000);
  const grid=rhythmEstimateBeatGridFromOnsets(envelope.onsets,envelope.framesPerSecond,durationMs);
  return grid?{durationMs,...grid}:null;
};

const rhythmResolveAuthoringTrack=song=>{
  try{
    if(typeof BGM_TRACKS!=='undefined'&&Array.isArray(BGM_TRACKS))return BGM_TRACKS.find(track=>track.id===song?.bgmTrackId)||null;
  }catch{}
  return null;
};

const installRhythmAuthoringPanel=()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmAuthoring==='ready')return;
  document.documentElement.dataset.rhythmAuthoring='ready';
  const results=new Map();
  let busy=false;

  const fmt=n=>Number.isFinite(Number(n))?Number(n).toFixed(2):'-';
  const renderResult=(result,song)=>JSON.stringify({
    songId:song.songId,
    bgmTrackId:song.bgmTrackId,
    durationMs:result.durationMs,
    estimatedBpm:Number(result.bpm.toFixed(3)),
    beatMs:Number(result.beatMs.toFixed(3)),
    beatOffsetMs:Number(result.offsetMs.toFixed(1)),
    confidence:Number(result.confidence.toFixed(3)),
    firstBeatsMs:result.beats.slice(0,16),
  },null,2);

  const mount=()=>{
    const root=document.querySelector('[data-rhythm-debug]');
    if(!root||root.querySelector('[data-rhythm-authoring]'))return;
    const section=document.createElement('section');
    section.dataset.rhythmAuthoring='';
    section.className='mb-3 rounded-2xl border border-emerald-400/40 bg-emerald-950/30 p-3 text-white';
    section.innerHTML=`<div class="mb-2"><small class="text-[8px] font-black tracking-wider text-emerald-300">DEBUG ONLY・CHART AUTHORING</small><h3 class="font-black">譜面作成・音源解析</h3><p class="mt-1 text-[9px] leading-relaxed text-slate-300">実音源からBPM・拍間隔・先頭拍オフセットを推定します。解析は制作補助専用で、本番譜面は固定データとして保存します。</p></div><label class="block text-[9px] text-slate-300">対象曲<select data-rhythm-authoring-song class="mt-1 min-h-[44px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm font-bold text-white"></select></label><button data-rhythm-authoring-analyze class="mt-2 min-h-[48px] w-full rounded-xl bg-emerald-700 font-black">実音源を自動解析</button><p data-rhythm-authoring-status class="mt-2 min-h-[18px] text-[9px] text-emerald-200">未解析</p><pre data-rhythm-authoring-output class="max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950/80 p-2 text-[9px] text-slate-200">解析結果がここに表示されます</pre><button data-rhythm-authoring-copy disabled class="mt-2 min-h-[44px] w-full rounded-xl bg-indigo-700 font-black disabled:opacity-40">解析JSONをコピー</button>`;
    const select=section.querySelector('[data-rhythm-authoring-song]');
    const songs=typeof RHYTHM_SONGS!=='undefined'&&Array.isArray(RHYTHM_SONGS)?RHYTHM_SONGS:[];
    songs.forEach((song,index)=>{const option=document.createElement('option');option.value=String(index);option.textContent=song.displayName;select.appendChild(option);});
    const status=section.querySelector('[data-rhythm-authoring-status]');
    const output=section.querySelector('[data-rhythm-authoring-output]');
    const analyze=section.querySelector('[data-rhythm-authoring-analyze]');
    const copy=section.querySelector('[data-rhythm-authoring-copy]');
    analyze.addEventListener('click',async()=>{
      if(busy)return;
      const song=songs[Number(select.value)||0];
      const track=rhythmResolveAuthoringTrack(song);
      if(!song||!track?.src){status.textContent='音源情報を取得できません';return;}
      busy=true;analyze.disabled=true;copy.disabled=true;status.textContent='音源を読み込み・解析中…';output.textContent='解析中…';
      let context=null;
      try{
        const response=await fetch(track.src,{cache:'no-store'});
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const bytes=await response.arrayBuffer();
        const Context=window.AudioContext||window.webkitAudioContext;
        if(!Context)throw new Error('AudioContext unavailable');
        context=new Context();
        const audioBuffer=await context.decodeAudioData(bytes.slice(0));
        const result=rhythmAnalyzeAudioBuffer(audioBuffer);
        if(!result)throw new Error('解析結果を作成できません');
        const text=renderResult(result,song);
        results.set(song.songId,text);
        output.textContent=text;
        status.textContent=`推定 BPM ${fmt(result.bpm)} / 1拍 ${fmt(result.beatMs)}ms / オフセット ${fmt(result.offsetMs)}ms / 信頼度 ${Math.round(result.confidence*100)}%`;
        copy.disabled=false;
      }catch(error){
        status.textContent=`解析失敗: ${error?.message||error}`;
        output.textContent='端末で音源をデコードできませんでした。';
      }finally{
        try{await context?.close?.();}catch{}
        busy=false;analyze.disabled=false;
      }
    });
    copy.addEventListener('click',async()=>{
      const song=songs[Number(select.value)||0],text=song?results.get(song.songId):'';
      if(!text)return;
      try{await navigator.clipboard.writeText(text);status.textContent='解析JSONをコピーしました';}
      catch{status.textContent='コピーできませんでした。表示中JSONを長押しでコピーしてください';}
    });
    root.insertBefore(section,root.children[1]||null);
  };
  const observer=new MutationObserver(mount);
  const start=()=>{mount();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
};
installRhythmAuthoringPanel();

// DEBUG ONLY: iPhone等のTouch.radiusXを使い、1本指の接触面積を最大3サブレーンとして扱う。
// 中心入力はgame-system.jsxの既存処理を正本にし、追加領域ではTAPだけを補助入力する。
// HOLD / SLIDE / FLICKのgesture sessionを保持中の指は追加TAPを取得しない。
const RHYTHM_TOUCH_CONTACT_RUNTIME=(()=>{
  const MAX_CONTACT_SUB_LANES=3;
  const touchStates=new Map();
  let syntheticPointerId=700000;
  let activeSeGroup=null;

  const clampSubLane=value=>Math.max(0,Math.min(9,Math.trunc(Number(value)||0)));
  const contactSubLanes=(touch,rect)=>{
    const center=rhythmSubLaneCoordinateAtPoint(Number(touch?.clientX),Number(touch?.clientY),rect);
    if(!Number.isFinite(center))return [];
    const centerLane=clampSubLane(Math.floor(center));
    const radiusX=Number(touch?.radiusX);
    if(!(radiusX>0)&&radiusX!==0)return [centerLane];
    if(!Number.isFinite(radiusX)||radiusX<=0)return [centerLane];
    const left=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)-radiusX,Number(touch.clientY),rect);
    const right=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)+radiusX,Number(touch.clientY),rect);
    const values=[center];
    if(Number.isFinite(left))values.push(left);
    if(Number.isFinite(right))values.push(right);
    const lo=clampSubLane(Math.floor(Math.min(...values))),hi=clampSubLane(Math.floor(Math.max(...values)));
    const lanes=[];
    for(let lane=lo;lane<=hi;lane++)lanes.push(lane);
    if(!lanes.includes(centerLane))lanes.push(centerLane);
    return lanes.sort((a,b)=>Math.abs(a+.5-center)-Math.abs(b+.5-center)||a-b).slice(0,MAX_CONTACT_SUB_LANES).sort((a,b)=>a-b);
  };
  const clientXForSubLane=(subLane,clientY,rect)=>{
    const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height);
    const nx=rhythmProjectBoundary((Number(subLane)+.5)/2,yRatio);
    return rect.left+rect.width*nx;
  };
  const beginSeGroup=event=>{
    if(!event.target?.closest?.('[data-rhythm-play-area]'))return;
    if(activeSeGroup)finishSeGroup(activeSeGroup);
    const runtime=RHYTHM_NOTE_SE_RUNTIME;
    if(!runtime||typeof runtime.play!=='function'||typeof runtime.playEmpty!=='function')return;
    const group={runtime,playOriginal:runtime.play,emptyOriginal:runtime.playEmpty,success:0,empty:0,finished:false,playWrapper:null,emptyWrapper:null};
    group.playWrapper=(...args)=>{group.success++;return group.success===1?group.playOriginal(...args):false;};
    group.emptyWrapper=(...args)=>{group.empty++;return false;};
    runtime.play=group.playWrapper;
    runtime.playEmpty=group.emptyWrapper;
    activeSeGroup=group;
    const later=typeof queueMicrotask==='function'?queueMicrotask:fn=>Promise.resolve().then(fn);
    later(()=>{if(activeSeGroup===group)finishSeGroup(group);});
  };
  const finishSeGroup=group=>{
    if(!group||group.finished)return;
    group.finished=true;
    if(group.runtime.play===group.playWrapper)group.runtime.play=group.playOriginal;
    if(group.runtime.playEmpty===group.emptyWrapper)group.runtime.playEmpty=group.emptyOriginal;
    if(group.success===0&&group.empty>0)group.emptyOriginal();
    if(activeSeGroup===group)activeSeGroup=null;
  };
  const setContactFeedback=(area,active)=>{
    const pressed=new Set(active);
    area.querySelectorAll('[data-rhythm-sublane-feedback]').forEach((el,index)=>{
      const on=pressed.has(index);
      el.dataset.pressed=on?'true':'false';
      el.style.opacity=on?'1':'0';
    });
  };
  const shouldProbeTap=(area,subLane,clientY,rect)=>{
    const line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line?.getBoundingClientRect();
    if(!lineRect)return false;
    const lineY=lineRect.top+lineRect.height/2,x=clientXForSubLane(subLane,clientY,rect),limit=Math.max(56,rect.height*.16);
    let tapDistance=Infinity,otherDistance=Infinity;
    area.querySelectorAll('[data-rhythm-note]').forEach(el=>{
      if(el.style.opacity==='0')return;
      const noteRect=el.getBoundingClientRect();
      if(!(noteRect.width>0&&noteRect.height>0))return;
      const margin=Math.max(4,noteRect.width*.08);
      if(x<noteRect.left-margin||x>noteRect.right+margin)return;
      const distance=Math.abs(noteRect.top+noteRect.height/2-lineY);
      if(distance>limit)return;
      if(el.dataset.noteType==='TAP')tapDistance=Math.min(tapDistance,distance);
      else otherDistance=Math.min(otherDistance,distance);
    });
    return Number.isFinite(tapDistance)&&tapDistance<=otherDistance+2;
  };
  const dispatchTapProbe=(area,subLane,clientY,rect)=>{
    if(typeof PointerEvent!=='function')return false;
    const pointerId=syntheticPointerId++,clientX=clientXForSubLane(subLane,clientY,rect);
    const base={bubbles:true,cancelable:true,pointerId,pointerType:'pen',isPrimary:false,clientX,clientY:Number(clientY),button:0,width:1,height:1,pressure:.5};
    area.dispatchEvent(new PointerEvent('pointerdown',{...base,buttons:1}));
    area.dispatchEvent(new PointerEvent('pointerup',{...base,buttons:0,pressure:0}));
    return true;
  };
  const syncTouchContacts=event=>{
    const area=event.target?.closest?.('[data-rhythm-play-area]');
    if(!area){if(activeSeGroup)finishSeGroup(activeSeGroup);return;}
    const rect=area.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0)){if(activeSeGroup)finishSeGroup(activeSeGroup);return;}
    const live=new Set(),active=[];
    Array.from(event.touches||[]).forEach(touch=>{
      const id=String(touch.identifier),key=`touch:${id}`,lanes=contactSubLanes(touch,rect),previous=touchStates.get(id)||new Set();
      live.add(id);
      lanes.forEach(lane=>active.push(lane));
      if(event.type==='touchstart'||event.type==='touchmove'){
        const center=rhythmSubLaneCoordinateAtPoint(touch.clientX,touch.clientY,rect),centerLane=Number.isFinite(center)?clampSubLane(Math.floor(center)):null;
        const holdingGesture=RHYTHM_GESTURE_RUNTIME?._sessions?.has(key);
        if(!holdingGesture){
          lanes.forEach(lane=>{
            if(lane===centerLane||previous.has(lane))return;
            if(shouldProbeTap(area,lane,touch.clientY,rect))dispatchTapProbe(area,lane,touch.clientY,rect);
            else RHYTHM_NOTE_SE_RUNTIME.playEmpty();
          });
        }
      }
      touchStates.set(id,new Set(lanes));
    });
    Array.from(touchStates.keys()).forEach(id=>{if(!live.has(id))touchStates.delete(id);});
    setContactFeedback(area,active);
    if(activeSeGroup)finishSeGroup(activeSeGroup);
  };
  const patchHelpAndChangelog=()=>{
    try{
      if(typeof CHANGELOG!=='undefined'&&Array.isArray(CHANGELOG)){
        const entry=CHANGELOG.find(item=>item?.releaseFlag==='rhythmMode'&&item?.title==='音ゲーの操作フィードバックを調整');
        const text='iPhone等では指の接触幅を使い、1本指で覆った隣接最大3サブレーンのTAPを同時に取れるようにしました。HOLD／SLIDE／FLICK操作中の指は従来どおり1操作として扱います。';
        if(entry&&Array.isArray(entry.items)&&!entry.items.includes(text))entry.items.push(text);
      }
    }catch{}
    try{
      if(typeof HELP_CATEGORIES!=='undefined'){
        const suffix=' iPhone等で接触幅を取得できる場合は、1本指で覆った隣接最大3サブレーンを同時に発光し、TAPは同時取得できます。接触幅が取れない端末は従来の中心1サブレーン入力へ戻り、HOLD／SLIDE／FLICKは1本指1操作のままです。';
        const visit=value=>{
          if(!value||typeof value!=='object')return false;
          if(value.id==='rhythm-mode'&&Array.isArray(value.blocks)){
            const block=value.blocks.find(item=>item?.t==='p'&&typeof item.text==='string');
            if(block&&!block.text.includes('接触幅を取得できる場合'))block.text+=suffix;
            return true;
          }
          if(Array.isArray(value)){for(const child of value)if(visit(child))return true;return false;}
          for(const child of Object.values(value))if(visit(child))return true;
          return false;
        };
        visit(HELP_CATEGORIES);
      }
    }catch{}
  };
  const install=()=>{
    if(typeof document==='undefined')return;
    document.addEventListener('touchstart',beginSeGroup,{capture:true,passive:true});
    document.addEventListener('touchmove',beginSeGroup,{capture:true,passive:true});
    document.addEventListener('touchstart',syncTouchContacts,{passive:true});
    document.addEventListener('touchmove',syncTouchContacts,{passive:true});
    document.addEventListener('touchend',syncTouchContacts,{passive:true});
    document.addEventListener('touchcancel',syncTouchContacts,{passive:true});
    patchHelpAndChangelog();
  };
  install();
  return {contactSubLanes,clientXForSubLane,_states:touchStates,_maxContactSubLanes:MAX_CONTACT_SUB_LANES};
})();