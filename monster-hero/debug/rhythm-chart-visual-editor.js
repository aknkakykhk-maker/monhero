// DEBUG ONLY: スマホ向け視覚譜面エディタ STEP 1。
// 既存CHART EDITOR v2のフォーム/ドラフト/実プレイ経路を再利用し、10サブレーン上で直接配置・選択・移動する。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmChartVisualUi==='ready')return;
  document.documentElement.dataset.rhythmChartVisualUi='ready';

  const GRID_PX=14;
  const MIN_GRIDS=64;
  const EXTRA_GRIDS=24;
  let currentEditor=null;
  let listObserver=null;

  const int=(value,min,max)=>Math.max(min,Math.min(max,Math.trunc(Number(value)||0)));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const readDraft=editor=>{
    const output=editor?.querySelector('[data-rhythm-chart-output]');
    if(!output)return [];
    try{
      const parsed=JSON.parse(output.value||'{}');
      return Array.isArray(parsed?.notes)?parsed.notes:[];
    }catch{return [];}
  };
  const snapTime=(editor,timeMs)=>{
    const trackId=editor?.querySelector('[data-rhythm-chart-track]')?.value||'atsu_cup_theme';
    try{return typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId,Number(timeMs)||0,4):null;}catch{return null;}
  };
  const gridOfTime=(editor,timeMs)=>{
    const snapped=snapTime(editor,timeMs);
    return snapped&&Number.isFinite(snapped.gridIndex)?Math.max(0,Math.round(snapped.gridIndex)):0;
  };
  const gridToFields=(editor,gridIndex)=>{
    const beat=editor.querySelector('[data-rhythm-chart-beat]');
    const sub=editor.querySelector('[data-rhythm-chart-sub]');
    if(beat)beat.value=String(Math.floor(gridIndex/4));
    if(sub)sub.value=String(gridIndex%4);
  };
  const noteTypeColor=type=>({
    TAP:'#d97706',HOLD:'#0891b2',FLICK:'#c026d3',SLIDE:'#059669'
  }[type]||'#475569');
  const laneGeometry=note=>{
    const width=int(note?.subLaneWidth??2,1,4);
    if(note?.type==='SLIDE'){
      const lane=clamp(note?.lane,0,4);
      const center=10+lane*20;
      const span=width*10;
      return {left:clamp(center-span/2,0,100-span),width:span};
    }
    const subLane=int(note?.subLane??Math.floor((Number(note?.lane)||0)*2),0,9);
    const span=width*10;
    return {left:clamp(subLane*10,0,100-span),width:span};
  };
  const subLaneFromPoint=(timeline,clientX)=>{
    const rect=timeline.getBoundingClientRect();
    const ratio=clamp((clientX-rect.left)/Math.max(1,rect.width),0,.999999);
    return int(Math.floor(ratio*10),0,9);
  };
  const slideLaneFromPoint=(timeline,clientX)=>{
    const rect=timeline.getBoundingClientRect();
    const percent=clamp((clientX-rect.left)/Math.max(1,rect.width)*100,0,100);
    return Math.round(clamp((percent-10)/20,0,4)*2)/2;
  };
  const gridFromPoint=(timeline,clientY)=>{
    const rect=timeline.getBoundingClientRect();
    return Math.max(0,Math.round((clientY-rect.top)/GRID_PX));
  };
  const clickExistingEdit=(editor,index)=>{
    const list=editor.querySelector('[data-rhythm-chart-list]');
    const row=list?.children?.[index];
    const button=row?[...row.querySelectorAll('button')].find(item=>(item.textContent||'').trim()==='編集'):null;
    if(!button)return false;
    button.click();
    return true;
  };
  const setPlacementLane=(editor,timeline,clientX,noteType)=>{
    if(noteType==='SLIDE'){
      const start=editor.querySelector('[data-rhythm-chart-slide-start]');
      if(start)start.value=String(slideLaneFromPoint(timeline,clientX));
    }else{
      const subLane=editor.querySelector('[data-rhythm-chart-sublane]');
      if(subLane)subLane.value=String(subLaneFromPoint(timeline,clientX)+1);
    }
  };

  const mount=()=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
    if(!editor)return false;
    if(editor.querySelector('[data-rhythm-chart-visual-ui]'))return true;
    currentEditor=editor;

    const box=document.createElement('section');
    box.dataset.rhythmChartVisualUi='';
    box.className='mt-3 rounded-2xl border border-emerald-400/40 bg-slate-950/70 p-2 text-white';
    box.innerHTML=`
      <div class="flex items-start justify-between gap-2">
        <div>
          <small class="text-[8px] font-black tracking-wider text-emerald-300">VISUAL EDITOR STEP 1</small>
          <h4 class="text-sm font-black">10サブレーン譜面ビュー</h4>
          <p class="mt-1 text-[8px] leading-relaxed text-slate-300">空白をタップで配置。ノーツをタップで選択、ドラッグで拍・レーン移動。既存フォームとテストプレイをそのまま使います。</p>
        </div>
        <button type="button" data-rhythm-visual-follow class="min-h-[40px] shrink-0 rounded-lg bg-emerald-800 px-2 text-[9px] font-black">追従 ON</button>
      </div>
      <div class="mt-2 grid grid-cols-4 gap-1" data-rhythm-visual-types>
        <button type="button" data-type="TAP" class="min-h-[40px] rounded-lg bg-slate-800 text-[9px] font-black">TAP</button>
        <button type="button" data-type="HOLD" class="min-h-[40px] rounded-lg bg-slate-800 text-[9px] font-black">HOLD</button>
        <button type="button" data-type="FLICK" class="min-h-[40px] rounded-lg bg-slate-800 text-[9px] font-black">FLICK</button>
        <button type="button" data-type="SLIDE" class="min-h-[40px] rounded-lg bg-slate-800 text-[9px] font-black">SLIDE</button>
      </div>
      <div class="mt-1 grid grid-cols-4 gap-1" data-rhythm-visual-widths>
        <button type="button" data-width="1" class="min-h-[40px] rounded-lg bg-slate-900 text-[9px] font-black">幅1</button>
        <button type="button" data-width="2" class="min-h-[40px] rounded-lg bg-slate-900 text-[9px] font-black">幅2</button>
        <button type="button" data-width="3" class="min-h-[40px] rounded-lg bg-slate-900 text-[9px] font-black">幅3</button>
        <button type="button" data-width="4" class="min-h-[40px] rounded-lg bg-slate-900 text-[9px] font-black">幅4</button>
      </div>
      <div class="mt-2 grid grid-cols-10 text-center text-[7px] font-black text-slate-400" aria-hidden="true">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
      </div>
      <div data-rhythm-visual-scroller class="relative mt-1 max-h-[62vh] min-h-[360px] overflow-auto rounded-xl border border-white/10 bg-black/40 overscroll-contain" style="touch-action:pan-y;">
        <div data-rhythm-visual-timeline class="relative w-full select-none" style="min-height:896px;touch-action:pan-y;"></div>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 text-[8px] text-slate-300">
        <span data-rhythm-visual-selection>未選択</span>
        <button type="button" data-rhythm-visual-jump class="min-h-[38px] rounded-lg bg-cyan-900 px-3 font-black">再生位置へ</button>
      </div>
    `;

    const list=editor.querySelector('[data-rhythm-chart-list]');
    const output=editor.querySelector('[data-rhythm-chart-output]');
    (list?.parentElement||output?.parentElement||editor).insertAdjacentElement('beforebegin',box);

    const timeline=box.querySelector('[data-rhythm-visual-timeline]');
    const scroller=box.querySelector('[data-rhythm-visual-scroller]');
    const selection=box.querySelector('[data-rhythm-visual-selection]');
    const followButton=box.querySelector('[data-rhythm-visual-follow]');
    const typeSelect=editor.querySelector('[data-rhythm-chart-type]');
    const widthSelect=editor.querySelector('[data-rhythm-chart-width]');
    const apply=editor.querySelector('[data-rhythm-chart-apply]');
    const audio=editor.querySelector('[data-rhythm-chart-audio]');
    let selectedIndex=-1;
    let follow=true;
    let suppressTimelineClick=false;

    const currentType=()=>typeSelect?.value||'TAP';
    const updateToolbar=()=>{
      box.querySelectorAll('[data-rhythm-visual-types] [data-type]').forEach(button=>{
        const active=button.dataset.type===currentType();
        button.style.outline=active?'2px solid #34d399':'none';
        button.style.background=active?'#065f46':'';
      });
      box.querySelectorAll('[data-rhythm-visual-widths] [data-width]').forEach(button=>{
        const active=button.dataset.width===String(widthSelect?.value||'2');
        button.style.outline=active?'2px solid #67e8f9':'none';
      });
    };
    const selectNote=index=>{
      const notes=readDraft(editor);
      if(index<0||index>=notes.length||!clickExistingEdit(editor,index)){
        selectedIndex=-1;
        selection.textContent='未選択';
        render();
        return false;
      }
      selectedIndex=index;
      const note=notes[index];
      selection.textContent=`#${index+1} ${note.type} を選択中`;
      updateToolbar();
      render();
      return true;
    };
    const totalGridCount=notes=>{
      const noteMax=notes.reduce((max,note)=>Math.max(max,gridOfTime(editor,note.endTimeMs??note.timeMs)),0);
      const durationGrid=Number.isFinite(audio?.duration)?gridOfTime(editor,audio.duration*1000):0;
      return Math.max(MIN_GRIDS,noteMax+EXTRA_GRIDS,durationGrid+8);
    };
    const updatePlayhead=()=>{
      const playhead=timeline.querySelector('[data-rhythm-visual-playhead]');
      if(!playhead||!audio)return;
      const top=gridOfTime(editor,audio.currentTime*1000)*GRID_PX;
      playhead.style.transform=`translateY(${top}px)`;
      if(follow&&!audio.paused){
        const min=scroller.scrollTop+36,max=scroller.scrollTop+scroller.clientHeight-36;
        if(top<min||top>max)scroller.scrollTop=Math.max(0,top-scroller.clientHeight*.45);
      }
    };
    const render=()=>{
      const notes=readDraft(editor);
      if(selectedIndex>=notes.length)selectedIndex=-1;
      const grids=totalGridCount(notes);
      timeline.style.height=`${grids*GRID_PX}px`;
      timeline.style.backgroundImage=[
        'repeating-linear-gradient(to right, rgba(148,163,184,.22) 0, rgba(148,163,184,.22) 1px, transparent 1px, transparent 10%)',
        `repeating-linear-gradient(to bottom, rgba(148,163,184,.13) 0, rgba(148,163,184,.13) 1px, transparent 1px, transparent ${GRID_PX}px)`,
        `repeating-linear-gradient(to bottom, rgba(34,211,238,.28) 0, rgba(34,211,238,.28) 2px, transparent 2px, transparent ${GRID_PX*4}px)`,
        `repeating-linear-gradient(to bottom, rgba(251,191,36,.30) 0, rgba(251,191,36,.30) 2px, transparent 2px, transparent ${GRID_PX*16}px)`
      ].join(',');
      timeline.replaceChildren();

      for(let grid=0;grid<grids;grid+=16){
        const label=document.createElement('span');
        label.className='pointer-events-none absolute left-0 z-[1] rounded-br bg-black/70 px-1 text-[7px] font-black text-amber-200';
        label.style.top=`${grid*GRID_PX+2}px`;
        label.textContent=`${Math.floor(grid/16)+1}`;
        timeline.appendChild(label);
      }

      notes.forEach((note,index)=>{
        const startGrid=gridOfTime(editor,note.timeMs);
        const endGrid=gridOfTime(editor,note.endTimeMs??note.timeMs);
        const geo=laneGeometry(note);
        const node=document.createElement('button');
        node.type='button';
        node.dataset.rhythmVisualNote=String(index);
        node.className='absolute z-[3] overflow-hidden rounded border text-[7px] font-black text-white shadow-sm';
        node.style.left=`${geo.left}%`;
        node.style.width=`${geo.width}%`;
        node.style.top=`${Math.max(0,startGrid*GRID_PX-5)}px`;
        node.style.minHeight='18px';
        node.style.height=note.type==='HOLD'||note.type==='SLIDE'?`${Math.max(18,(endGrid-startGrid)*GRID_PX+10)}px`:'18px';
        node.style.background=noteTypeColor(note.type);
        node.style.borderColor=index===selectedIndex?'#ffffff':'rgba(255,255,255,.45)';
        node.style.borderWidth=index===selectedIndex?'3px':'1px';
        node.style.touchAction='none';
        node.textContent=note.type==='TAP'?'T':note.type==='HOLD'?'H':note.type==='FLICK'?'F':'S';

        let pointerId=null,startX=0,startY=0,moved=false;
        node.addEventListener('pointerdown',event=>{
          if(event.pointerType==='mouse'&&event.button!==0)return;
          pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;moved=false;
          node.setPointerCapture?.(event.pointerId);
          event.preventDefault();
        });
        node.addEventListener('pointermove',event=>{
          if(pointerId!==event.pointerId)return;
          if(Math.hypot(event.clientX-startX,event.clientY-startY)>5)moved=true;
        });
        node.addEventListener('pointerup',event=>{
          if(pointerId!==event.pointerId)return;
          node.releasePointerCapture?.(event.pointerId);pointerId=null;
          suppressTimelineClick=true;setTimeout(()=>{suppressTimelineClick=false;},0);
          if(!moved){selectNote(index);return;}
          if(note.type==='SLIDE'&&Array.isArray(note.slidePoints)&&note.slidePoints.length>2){
            selection.textContent='複雑SLIDEの移動はSTEP 2で対応';
            return;
          }
          if(!selectNote(index))return;
          const newGrid=gridFromPoint(timeline,event.clientY);
          gridToFields(editor,newGrid);
          if(note.type==='SLIDE'){
            const start=editor.querySelector('[data-rhythm-chart-slide-start]');
            const end=editor.querySelector('[data-rhythm-chart-slide-end]');
            const oldStart=Number(note.lane)||0,oldEnd=Number(note.endLane??note.lane)||0;
            const nextStart=slideLaneFromPoint(timeline,event.clientX);
            const delta=nextStart-oldStart;
            if(start)start.value=String(nextStart);
            if(end)end.value=String(Math.round(clamp(oldEnd+delta,0,4)*2)/2);
          }else{
            const subLane=editor.querySelector('[data-rhythm-chart-sublane]');
            if(subLane)subLane.value=String(subLaneFromPoint(timeline,event.clientX)+1);
          }
          apply?.click();
          selection.textContent=`#${index+1} を移動しました`;
        });
        node.addEventListener('pointercancel',()=>{pointerId=null;});
        timeline.appendChild(node);
      });

      const playhead=document.createElement('div');
      playhead.dataset.rhythmVisualPlayhead='';
      playhead.className='pointer-events-none absolute left-0 top-0 z-[5] h-[2px] w-full bg-rose-400 shadow';
      timeline.appendChild(playhead);
      updatePlayhead();
      updateToolbar();
    };

    timeline.addEventListener('click',event=>{
      if(suppressTimelineClick||event.target.closest('[data-rhythm-visual-note]'))return;
      const grid=gridFromPoint(timeline,event.clientY);
      gridToFields(editor,grid);
      setPlacementLane(editor,timeline,event.clientX,currentType());
      apply?.click();
      selectedIndex=-1;
      selection.textContent=`拍 ${Math.floor(grid/4)}:${grid%4} に ${currentType()} を追加`;
    });

    box.querySelectorAll('[data-rhythm-visual-types] [data-type]').forEach(button=>button.addEventListener('click',()=>{
      if(!typeSelect)return;
      typeSelect.value=button.dataset.type;
      typeSelect.dispatchEvent(new Event('change',{bubbles:true}));
      updateToolbar();
    }));
    box.querySelectorAll('[data-rhythm-visual-widths] [data-width]').forEach(button=>button.addEventListener('click',()=>{
      if(!widthSelect)return;
      if(selectedIndex>=0)selectNote(selectedIndex);
      widthSelect.value=button.dataset.width;
      widthSelect.dispatchEvent(new Event('change',{bubbles:true}));
      updateToolbar();
      if(selectedIndex>=0){
        apply?.click();
        selection.textContent=`#${selectedIndex+1} を幅${button.dataset.width}へ変更`;
      }
    }));
    followButton.addEventListener('click',()=>{
      follow=!follow;
      followButton.textContent=`追従 ${follow?'ON':'OFF'}`;
      followButton.style.opacity=follow?'1':'.55';
      if(follow)updatePlayhead();
    });
    box.querySelector('[data-rhythm-visual-jump]').addEventListener('click',()=>{
      const top=gridOfTime(editor,(audio?.currentTime||0)*1000)*GRID_PX;
      scroller.scrollTop=Math.max(0,top-scroller.clientHeight*.35);
    });

    typeSelect?.addEventListener('change',updateToolbar);
    widthSelect?.addEventListener('change',updateToolbar);
    editor.querySelector('[data-rhythm-chart-track]')?.addEventListener('change',()=>{selectedIndex=-1;render();});
    audio?.addEventListener('loadedmetadata',render);
    audio?.addEventListener('durationchange',render);
    audio?.addEventListener('timeupdate',updatePlayhead);
    audio?.addEventListener('seeked',updatePlayhead);

    if(list){
      listObserver?.disconnect();
      listObserver=new MutationObserver(()=>render());
      listObserver.observe(list,{childList:true});
    }
    render();
    return true;
  };

  const scan=()=>{
    if(currentEditor&&currentEditor.isConnected&&currentEditor.querySelector('[data-rhythm-chart-visual-ui]'))return;
    currentEditor=null;
    mount();
  };
  const observer=new MutationObserver(()=>{
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    scan();
  });
  const start=()=>{scan();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
