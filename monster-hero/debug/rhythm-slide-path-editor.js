// DEBUG ONLY: 視覚譜面エディタ STEP 2-B。SLIDEの始点・終点・中継点を直接編集する。
// 既存の0.5レーン位置・16分グリッド・authoring draft更新経路を再利用し、ゲーム本体の判定や保存形式は変更しない。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmSlidePathUi==='ready')return;
  document.documentElement.dataset.rhythmSlidePathUi='ready';

  const GRID_PX=14;
  const SVG_NS='http://www.w3.org/2000/svg';
  let currentTimeline=null;
  let currentList=null;
  let listObserver=null;
  let rootObserver=null;
  let selectedIndex=-1;
  let selectedPoint=-1;
  let renderQueued=false;

  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const readNotes=()=>{
    const output=document.querySelector('[data-rhythm-chart-authoring-ui] [data-rhythm-chart-output]');
    if(!output)return [];
    try{
      const parsed=JSON.parse(output.value||'{}');
      return Array.isArray(parsed?.notes)?parsed.notes:[];
    }catch{return [];}
  };
  const editor=()=>document.querySelector('[data-rhythm-chart-authoring-ui]');
  const trackId=()=>editor()?.querySelector('[data-rhythm-chart-track]')?.value||'atsu_cup_theme';
  const snapGrid=timeMs=>{
    try{
      const snapped=typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId(),Number(timeMs)||0,4):null;
      return snapped&&Number.isFinite(snapped.gridIndex)?Math.max(0,Math.round(snapped.gridIndex)):0;
    }catch{return 0;}
  };
  const timeAtGrid=grid=>{
    try{
      return typeof rhythmTimingAt==='function'?rhythmTimingAt(trackId(),Math.floor(grid/4),grid%4,4):null;
    }catch{return null;}
  };
  const gridFromPoint=(timeline,clientY)=>{
    const rect=timeline.getBoundingClientRect();
    return Math.max(0,Math.round((clientY-rect.top)/GRID_PX));
  };
  const laneFromPoint=(timeline,clientX)=>{
    const rect=timeline.getBoundingClientRect();
    const percent=clamp((clientX-rect.left)/Math.max(1,rect.width)*100,0,100);
    return Math.round(clamp((percent-10)/20,0,4)*2)/2;
  };
  const xOfLane=lane=>100+clamp(lane,0,4)*200;
  const pointSet=note=>{
    const width=Math.max(1,Math.min(4,Math.trunc(Number(note?.subLaneWidth)||2)));
    const raw=Array.isArray(note?.slidePoints)&&note.slidePoints.length>=2
      ?note.slidePoints
      :[{timeMs:note?.timeMs,lane:note?.lane},{timeMs:note?.endTimeMs,lane:note?.endLane??note?.lane}];
    return raw.map(point=>({
      timeMs:Math.round(Number(point?.timeMs)||0),
      lane:Math.round(clamp(point?.lane,0,4)*2)/2,
      subLaneWidth:Math.max(1,Math.min(4,Math.trunc(Number(point?.subLaneWidth)||width))),
    }));
  };
  const commitPoints=(index,note,points,label)=>{
    if(!note||note.type!=='SLIDE'||points.length<2)return false;
    const normalized=points.map(point=>({
      timeMs:Math.round(Number(point.timeMs)||0),
      lane:Math.round(clamp(point.lane,0,4)*2)/2,
      subLaneWidth:Math.max(1,Math.min(4,Math.trunc(Number(point.subLaneWidth)||Number(note.subLaneWidth)||2))),
    }));
    for(let i=1;i<normalized.length;i++){
      if(!(snapGrid(normalized[i].timeMs)>snapGrid(normalized[i-1].timeMs)))return false;
    }
    const next={...note,
      timeMs:normalized[0].timeMs,
      lane:normalized[0].lane,
      endTimeMs:normalized[normalized.length-1].timeMs,
      endLane:normalized[normalized.length-1].lane,
      slidePoints:normalized,
    };
    const target=editor();
    if(!target)return false;
    target.dispatchEvent(new CustomEvent('rhythm-chart-replace-note',{detail:{index,note:next,label}}));
    return true;
  };
  const ensureControls=()=>{
    const visual=document.querySelector('[data-rhythm-chart-visual-ui]');
    if(!visual)return null;
    let controls=visual.querySelector('[data-rhythm-slide-path-controls]');
    if(controls)return controls;
    controls=document.createElement('div');
    controls.dataset.rhythmSlidePathControls='';
    controls.className='mt-2 rounded-xl border border-emerald-300/25 bg-emerald-950/35 p-2 text-[8px] text-emerald-50';
    controls.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0">
          <b class="block text-[9px]">SLIDE経路編集</b>
          <span data-rhythm-slide-path-status class="block truncate text-emerald-200">SLIDEを選択してください</span>
        </div>
        <button type="button" data-rhythm-slide-delete-point disabled class="min-h-[44px] shrink-0 rounded-lg bg-rose-900 px-3 text-[9px] font-black disabled:opacity-35">中継点削除</button>
      </div>
      <p class="mt-1 leading-relaxed text-emerald-100/75">線をタップで中継点追加。●をドラッグで0.5レーン・16分単位に編集。始点は横移動、終点と中継点は縦横移動できます。</p>
    `;
    const scroller=visual.querySelector('[data-rhythm-visual-scroller]');
    if(scroller)scroller.insertAdjacentElement('afterend',controls);else visual.appendChild(controls);
    controls.querySelector('[data-rhythm-slide-delete-point]').addEventListener('click',()=>{
      const notes=readNotes(),note=notes[selectedIndex];
      if(note?.type!=='SLIDE')return;
      const points=pointSet(note);
      if(!(selectedPoint>0&&selectedPoint<points.length-1))return;
      points.splice(selectedPoint,1);
      const deleted=selectedPoint;
      selectedPoint=-1;
      if(commitPoints(selectedIndex,note,points,`#${selectedIndex+1} SLIDE 中継点${deleted}を削除`))queueRender();
    });
    return controls;
  };
  const updateControls=(note,points)=>{
    const controls=ensureControls();
    if(!controls)return;
    const status=controls.querySelector('[data-rhythm-slide-path-status]');
    const del=controls.querySelector('[data-rhythm-slide-delete-point]');
    if(note?.type==='SLIDE'){
      status.textContent=`#${selectedIndex+1} / ${points.length}点${selectedPoint>=0?` / 点${selectedPoint+1}選択中`:''}`;
      del.disabled=!(selectedPoint>0&&selectedPoint<points.length-1);
    }else{
      status.textContent='SLIDEを選択してください';
      del.disabled=true;
    }
  };
  const paintGeometry=(line,hit,buttons,points)=>{
    const data=points.map(point=>`${xOfLane(point.lane)},${snapGrid(point.timeMs)*GRID_PX}`).join(' ');
    line.setAttribute('points',data);
    hit.setAttribute('points',data);
    buttons.forEach((button,index)=>{
      const point=points[index];
      button.style.left=`calc(${xOfLane(point.lane)/10}% - 22px)`;
      button.style.top=`${snapGrid(point.timeMs)*GRID_PX-22}px`;
    });
  };
  const renderPath=()=>{
    renderQueued=false;
    const timeline=currentTimeline;
    if(!timeline?.isConnected)return;
    timeline.querySelector('[data-rhythm-slide-path-layer]')?.remove();
    timeline.querySelectorAll('[data-rhythm-slide-point-handle]').forEach(node=>node.remove());

    const notes=readNotes();
    const note=notes[selectedIndex];
    if(note?.type!=='SLIDE'){
      selectedPoint=-1;
      updateControls(null,[]);
      return;
    }
    const points=pointSet(note);
    if(selectedPoint>=points.length)selectedPoint=-1;
    updateControls(note,points);

    const svg=document.createElementNS(SVG_NS,'svg');
    svg.dataset.rhythmSlidePathLayer='';
    svg.setAttribute('viewBox',`0 0 1000 ${Math.max(1,timeline.clientHeight)}`);
    svg.setAttribute('preserveAspectRatio','none');
    svg.classList.add('pointer-events-none','absolute','inset-0','z-[7]','h-full','w-full','overflow-visible');
    const line=document.createElementNS(SVG_NS,'polyline');
    line.setAttribute('fill','none');line.setAttribute('stroke','#6ee7b7');line.setAttribute('stroke-width','7');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.setAttribute('stroke-opacity','.9');
    const hit=document.createElementNS(SVG_NS,'polyline');
    hit.setAttribute('fill','none');hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width','34');hit.setAttribute('stroke-linecap','round');hit.setAttribute('stroke-linejoin','round');
    hit.style.pointerEvents='stroke';hit.style.touchAction='manipulation';
    svg.append(line,hit);timeline.appendChild(svg);

    const buttons=[];
    points.forEach((point,index)=>{
      const button=document.createElement('button');
      button.type='button';
      button.dataset.rhythmSlidePointHandle=String(index);
      button.setAttribute('aria-label',index===0?'SLIDE始点':index===points.length-1?'SLIDE終点':`SLIDE中継点 ${index}`);
      button.className='absolute z-[9] flex h-[44px] w-[44px] items-center justify-center rounded-full';
      button.style.touchAction='none';
      button.style.background='transparent';
      const dot=document.createElement('span');
      dot.className=`block h-[15px] w-[15px] rounded-full border-2 ${index===selectedPoint?'border-white bg-amber-400':'border-emerald-50 bg-emerald-500'} shadow`;
      button.appendChild(dot);
      timeline.appendChild(button);buttons.push(button);

      let pointerId=null,moved=false,startX=0,startY=0,previewPoints=null;
      const preview=event=>{
        const next=previewPoints||points.map(row=>({...row}));
        const lane=laneFromPoint(timeline,event.clientX);
        next[index].lane=lane;
        if(index>0){
          const previousGrid=snapGrid(next[index-1].timeMs);
          const maxByStart=snapGrid(next[0].timeMs)+128;
          const nextGrid=index<next.length-1?snapGrid(next[index+1].timeMs):maxByStart;
          const minGrid=previousGrid+1;
          const maxGrid=index<next.length-1?Math.max(minGrid,nextGrid-1):Math.max(minGrid,maxByStart);
          const grid=Math.max(minGrid,Math.min(maxGrid,gridFromPoint(timeline,event.clientY)));
          const time=timeAtGrid(grid);
          if(Number.isFinite(time))next[index].timeMs=Math.round(time);
        }
        previewPoints=next;
        paintGeometry(line,hit,buttons,next);
      };
      button.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0)return;
        pointerId=event.pointerId;moved=false;startX=event.clientX;startY=event.clientY;previewPoints=points.map(row=>({...row}));
        button.setPointerCapture?.(pointerId);event.preventDefault();event.stopPropagation();
      });
      button.addEventListener('pointermove',event=>{
        if(pointerId!==event.pointerId)return;
        if(Math.hypot(event.clientX-startX,event.clientY-startY)>5)moved=true;
        preview(event);event.preventDefault();event.stopPropagation();
      });
      button.addEventListener('pointerup',event=>{
        if(pointerId!==event.pointerId)return;
        button.releasePointerCapture?.(pointerId);pointerId=null;
        if(moved){
          preview(event);
          const next=previewPoints||points;
          if(commitPoints(selectedIndex,note,next,`#${selectedIndex+1} SLIDE 点${index+1}を移動`))selectedPoint=index;
        }else selectedPoint=index;
        event.preventDefault();event.stopPropagation();queueRender();
      });
      button.addEventListener('pointercancel',()=>{pointerId=null;queueRender();});
    });
    paintGeometry(line,hit,buttons,points);

    hit.addEventListener('pointerup',event=>{
      event.preventDefault();event.stopPropagation();
      const current=readNotes()[selectedIndex];
      if(current?.type!=='SLIDE')return;
      const next=pointSet(current);
      const startGrid=snapGrid(next[0].timeMs),endGrid=snapGrid(next[next.length-1].timeMs);
      if(endGrid-startGrid<2)return;
      const rawGrid=gridFromPoint(timeline,event.clientY);
      const grid=Math.max(startGrid+1,Math.min(endGrid-1,rawGrid));
      if(next.some(point=>snapGrid(point.timeMs)===grid))return;
      const time=timeAtGrid(grid);if(!Number.isFinite(time))return;
      const insertAt=next.findIndex(point=>snapGrid(point.timeMs)>grid);
      const width=Math.max(1,Math.min(4,Math.trunc(Number(current.subLaneWidth)||2)));
      const point={timeMs:Math.round(time),lane:laneFromPoint(timeline,event.clientX),subLaneWidth:width};
      const position=insertAt<0?next.length-1:insertAt;
      next.splice(position,0,point);selectedPoint=position;
      if(commitPoints(selectedIndex,current,next,`#${selectedIndex+1} SLIDE 中継点を追加`))queueRender();
    });
  };
  const queueRender=()=>{
    if(renderQueued)return;
    renderQueued=true;
    setTimeout(renderPath,0);
  };
  const bindTimeline=()=>{
    const timeline=document.querySelector('[data-rhythm-chart-visual-ui] [data-rhythm-visual-timeline]');
    const list=editor()?.querySelector('[data-rhythm-chart-list]');
    ensureControls();
    if(!timeline||!list)return false;
    if(currentTimeline!==timeline){
      currentTimeline=timeline;
      timeline.addEventListener('pointerup',event=>{
        if(event.target.closest('[data-rhythm-slide-point-handle]')||event.target.closest('[data-rhythm-slide-path-layer]'))return;
        const node=event.target.closest('[data-rhythm-visual-note]');
        if(!node)return;
        const index=Number(node.dataset.rhythmVisualNote),note=readNotes()[index];
        selectedIndex=note?.type==='SLIDE'?index:-1;selectedPoint=-1;queueRender();
      },true);
    }
    if(currentList!==list){
      listObserver?.disconnect();currentList=list;
      listObserver=new MutationObserver(()=>setTimeout(()=>{bindTimeline();queueRender();},0));
      listObserver.observe(list,{childList:true});
      list.addEventListener('click',event=>{
        const button=event.target.closest('button');if(!button||(button.textContent||'').trim()!=='編集')return;
        const row=button.parentElement,index=row?[...list.children].indexOf(row):-1,note=readNotes()[index];
        selectedIndex=note?.type==='SLIDE'?index:-1;selectedPoint=-1;queueRender();
      },true);
    }
    queueRender();return true;
  };
  const scan=()=>{
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    if(currentTimeline?.isConnected&&currentList?.isConnected){ensureControls();return;}
    currentTimeline=null;currentList=null;bindTimeline();
  };
  const start=()=>{
    scan();
    rootObserver=new MutationObserver(scan);
    rootObserver.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();