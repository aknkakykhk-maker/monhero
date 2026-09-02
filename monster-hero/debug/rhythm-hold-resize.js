// DEBUG ONLY: 視覚譜面エディタ STEP 2-A。HOLD終端だけを16分グリッド単位で直接伸縮する。
// 既存CHART EDITOR v2のduration入力と更新処理を再利用し、譜面形式・判定・セーブデータは変更しない。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmHoldResizeUi==='ready')return;
  document.documentElement.dataset.rhythmHoldResizeUi='ready';

  const GRID_PX=14;
  let currentTimeline=null;
  let timelineObserver=null;
  let rootObserver=null;
  let attachQueued=false;

  const readNotes=()=>{
    const output=document.querySelector('[data-rhythm-chart-authoring-ui] [data-rhythm-chart-output]');
    if(!output)return [];
    try{
      const parsed=JSON.parse(output.value||'{}');
      return Array.isArray(parsed?.notes)?parsed.notes:[];
    }catch{return [];}
  };
  const snapGrid=timeMs=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
    const trackId=editor?.querySelector('[data-rhythm-chart-track]')?.value||'atsu_cup_theme';
    try{
      const snapped=typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId,Number(timeMs)||0,4):null;
      return snapped&&Number.isFinite(snapped.gridIndex)?Math.max(0,Math.round(snapped.gridIndex)):0;
    }catch{return 0;}
  };
  const gridFromPoint=(timeline,clientY)=>{
    const rect=timeline.getBoundingClientRect();
    return Math.max(0,Math.round((clientY-rect.top)/GRID_PX));
  };
  const clickExistingEdit=index=>{
    const list=document.querySelector('[data-rhythm-chart-authoring-ui] [data-rhythm-chart-list]');
    const row=list?.children?.[index];
    const button=row?[...row.querySelectorAll('button')].find(item=>(item.textContent||'').trim()==='編集'):null;
    if(!button)return false;
    button.click();
    return true;
  };
  const queueAttach=()=>{
    if(attachQueued)return;
    attachQueued=true;
    queueMicrotask(()=>{attachQueued=false;attachHandles();});
  };
  const attachHandles=()=>{
    const timeline=currentTimeline;
    if(!timeline?.isConnected)return;
    const notes=readNotes();
    timeline.querySelectorAll('[data-rhythm-visual-note]').forEach(node=>{
      const index=Number(node.dataset.rhythmVisualNote);
      const note=notes[index];
      if(note?.type!=='HOLD'||node.querySelector('[data-rhythm-hold-resize-handle]'))return;
      const startGrid=snapGrid(note.timeMs);
      const endGrid=Math.max(startGrid+1,snapGrid(note.endTimeMs));
      const handle=document.createElement('span');
      handle.dataset.rhythmHoldResizeHandle='';
      handle.setAttribute('role','button');
      handle.setAttribute('aria-label',`HOLD #${index+1} の終端を変更`);
      handle.className='absolute inset-x-0 bottom-0 z-[6] flex h-[18px] items-end justify-center pb-[2px]';
      handle.style.cursor='ns-resize';
      handle.style.touchAction='none';
      handle.style.background='linear-gradient(to bottom,transparent,rgba(236,254,255,.22))';
      const grip=document.createElement('i');
      grip.className='block h-[3px] w-[55%] rounded-full bg-white/90 shadow';
      handle.appendChild(grip);

      let pointerId=null;
      let duration=Math.max(1,Math.min(128,endGrid-startGrid));
      const preview=clientY=>{
        const targetGrid=gridFromPoint(timeline,clientY);
        duration=Math.max(1,Math.min(128,targetGrid-startGrid));
        node.style.height=`${Math.max(18,duration*GRID_PX+10)}px`;
        const selection=document.querySelector('[data-rhythm-chart-visual-ui] [data-rhythm-visual-selection]');
        if(selection)selection.textContent=`#${index+1} HOLD 長さ ${duration}グリッド`;
      };
      handle.addEventListener('pointerdown',event=>{
        if(event.pointerType==='mouse'&&event.button!==0)return;
        pointerId=event.pointerId;
        handle.setPointerCapture?.(pointerId);
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener('pointermove',event=>{
        if(pointerId!==event.pointerId)return;
        preview(event.clientY);
        event.preventDefault();
        event.stopPropagation();
      });
      handle.addEventListener('pointerup',event=>{
        if(pointerId!==event.pointerId)return;
        handle.releasePointerCapture?.(pointerId);
        pointerId=null;
        preview(event.clientY);
        event.preventDefault();
        event.stopPropagation();
        const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
        const durationInput=editor?.querySelector('[data-rhythm-chart-duration]');
        const apply=editor?.querySelector('[data-rhythm-chart-apply]');
        if(!durationInput||!apply||!clickExistingEdit(index))return;
        durationInput.value=String(duration);
        durationInput.dispatchEvent(new Event('input',{bubbles:true}));
        durationInput.dispatchEvent(new Event('change',{bubbles:true}));
        apply.click();
        const selection=document.querySelector('[data-rhythm-chart-visual-ui] [data-rhythm-visual-selection]');
        if(selection)selection.textContent=`#${index+1} HOLD を長さ${duration}へ変更`;
        setTimeout(()=>document.querySelector('[data-rhythm-chart-visual-ui]')?.scrollIntoView({block:'nearest'}),0);
      });
      handle.addEventListener('pointercancel',()=>{pointerId=null;queueAttach();});
      node.appendChild(handle);
    });
  };
  const mountTimeline=()=>{
    const timeline=document.querySelector('[data-rhythm-chart-visual-ui] [data-rhythm-visual-timeline]');
    if(!timeline)return false;
    if(currentTimeline===timeline&&timeline.isConnected){queueAttach();return true;}
    timelineObserver?.disconnect();
    currentTimeline=timeline;
    timelineObserver=new MutationObserver(queueAttach);
    timelineObserver.observe(timeline,{childList:true});
    queueAttach();
    return true;
  };
  const scan=()=>{
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    if(currentTimeline?.isConnected){queueAttach();return;}
    currentTimeline=null;
    mountTimeline();
  };
  const start=()=>{
    scan();
    rootObserver=new MutationObserver(scan);
    rootObserver.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
