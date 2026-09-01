// DEBUG ONLY: 視覚譜面エディタ STEP 2-C。編集用audioへ区間ループを追加する。
// 正式譜面・BEST・ゲーム本体の再生/判定には触れず、既存16分グリッドと視覚タイムラインだけを再利用する。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmSectionLoopUi==='ready')return;
  document.documentElement.dataset.rhythmSectionLoopUi='ready';

  const GRID_PX=14;
  let currentVisual=null,currentTimeline=null,timelineObserver=null,rootObserver=null;
  let loopStartGrid=null,loopEndGrid=null,loopEnabled=false,loopTimer=0;

  const editor=()=>document.querySelector('[data-rhythm-chart-authoring-ui]');
  const visual=()=>document.querySelector('[data-rhythm-chart-visual-ui]');
  const audio=()=>editor()?.querySelector('[data-rhythm-chart-audio]');
  const trackId=()=>editor()?.querySelector('[data-rhythm-chart-track]')?.value||'atsu_cup_theme';
  const snapGrid=timeMs=>{
    try{
      const snapped=typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId(),Number(timeMs)||0,4):null;
      return snapped&&Number.isFinite(snapped.gridIndex)?Math.max(0,Math.round(snapped.gridIndex)):null;
    }catch{return null;}
  };
  const timeAtGrid=grid=>{
    try{
      return typeof rhythmTimingAt==='function'?rhythmTimingAt(trackId(),Math.floor(grid/4),grid%4,4):null;
    }catch{return null;}
  };
  const gridLabel=grid=>grid==null?'未設定':`${Math.floor(grid/4)}:${grid%4}`;
  const validRange=()=>Number.isInteger(loopStartGrid)&&Number.isInteger(loopEndGrid)&&loopEndGrid>loopStartGrid;
  const clearTimer=()=>{if(loopTimer){clearTimeout(loopTimer);loopTimer=0;}};

  const removeRange=()=>currentTimeline?.querySelector('[data-rhythm-section-loop-range]')?.remove();
  const renderRange=()=>{
    if(!currentTimeline?.isConnected)return;
    const existing=currentTimeline.querySelector('[data-rhythm-section-loop-range]');
    if(!validRange()){
      existing?.remove();
      return;
    }
    const top=loopStartGrid*GRID_PX;
    const height=Math.max(2,(loopEndGrid-loopStartGrid)*GRID_PX);
    const range=existing||document.createElement('div');
    range.dataset.rhythmSectionLoopRange='';
    range.className='pointer-events-none absolute left-0 z-[2] w-full border-y-2 border-indigo-300 bg-indigo-400/10';
    range.style.top=`${top}px`;
    range.style.height=`${height}px`;
    if(!existing)currentTimeline.appendChild(range);
  };

  const syncControls=(message='')=>{
    const panel=currentVisual?.querySelector('[data-rhythm-section-loop-ui]');
    if(!panel)return;
    const startLabel=panel.querySelector('[data-rhythm-loop-start-label]');
    const endLabel=panel.querySelector('[data-rhythm-loop-end-label]');
    const toggle=panel.querySelector('[data-rhythm-loop-toggle]');
    const status=panel.querySelector('[data-rhythm-loop-status]');
    if(startLabel)startLabel.textContent=`開始 ${gridLabel(loopStartGrid)}`;
    if(endLabel)endLabel.textContent=`終了 ${gridLabel(loopEndGrid)}`;
    if(toggle){
      toggle.textContent=`ループ ${loopEnabled?'ON':'OFF'}`;
      toggle.setAttribute('aria-pressed',loopEnabled?'true':'false');
      toggle.style.opacity=loopEnabled?'1':'.65';
    }
    if(status&&message)status.textContent=message;
    renderRange();
  };

  const disableLoop=(message='ループ OFF')=>{
    loopEnabled=false;
    clearTimer();
    syncControls(message);
  };
  const loopTick=()=>{
    loopTimer=0;
    const player=audio();
    if(!loopEnabled||!validRange()||!player||player.paused||player.ended)return;
    const startMs=timeAtGrid(loopStartGrid),endMs=timeAtGrid(loopEndGrid);
    if(!(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs)){
      disableLoop('区間時刻を取得できないためループを停止しました');
      return;
    }
    const nowMs=player.currentTime*1000;
    if(nowMs<startMs-35||nowMs>=endMs-10)player.currentTime=Math.max(0,startMs/1000);
    loopTimer=setTimeout(loopTick,32);
  };
  const startLoopWatcher=()=>{
    clearTimer();
    const player=audio();
    if(loopEnabled&&validRange()&&player&&!player.paused&&!player.ended)loopTimer=setTimeout(loopTick,0);
  };
  const resetRange=(message='曲変更のため区間ループを解除しました')=>{
    loopStartGrid=null;loopEndGrid=null;loopEnabled=false;clearTimer();removeRange();syncControls(message);
  };

  const mount=()=>{
    const target=visual(),targetEditor=editor(),player=audio();
    if(!target||!targetEditor||!player)return false;
    currentVisual=target;
    const timeline=target.querySelector('[data-rhythm-visual-timeline]');
    if(!timeline)return false;
    currentTimeline=timeline;

    if(!target.querySelector('[data-rhythm-section-loop-ui]')){
      const panel=document.createElement('section');
      panel.dataset.rhythmSectionLoopUi='';
      panel.className='mt-2 rounded-xl border border-indigo-400/35 bg-indigo-950/35 p-2';
      panel.innerHTML=`
        <div class="flex items-center justify-between gap-2">
          <div>
            <b class="text-[10px] text-indigo-100">区間ループ</b>
            <p class="text-[8px] text-indigo-200/80">現在の再生位置を16分グリッドへスナップして開始/終了を設定します。</p>
          </div>
          <button type="button" data-rhythm-loop-toggle aria-pressed="false" class="min-h-[44px] shrink-0 rounded-lg bg-indigo-700 px-3 text-[9px] font-black">ループ OFF</button>
        </div>
        <div class="mt-2 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-loop-set-start class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black"><span data-rhythm-loop-start-label>開始 未設定</span><br><small class="text-[7px] text-slate-300">現在位置を開始</small></button>
          <button type="button" data-rhythm-loop-set-end class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black"><span data-rhythm-loop-end-label>終了 未設定</span><br><small class="text-[7px] text-slate-300">現在位置を終了</small></button>
        </div>
        <div class="mt-1 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-loop-jump-start class="min-h-[44px] rounded-lg bg-cyan-900 text-[9px] font-black">開始へシーク</button>
          <button type="button" data-rhythm-loop-clear class="min-h-[44px] rounded-lg bg-slate-900 text-[9px] font-black">区間を解除</button>
        </div>
        <p data-rhythm-loop-status class="mt-1 text-[8px] text-indigo-100">開始と終了を設定するとループできます</p>
      `;
      const scroller=target.querySelector('[data-rhythm-visual-scroller]');
      if(scroller)scroller.insertAdjacentElement('beforebegin',panel);else target.appendChild(panel);

      panel.querySelector('[data-rhythm-loop-set-start]').addEventListener('click',()=>{
        const grid=snapGrid(player.currentTime*1000);
        if(grid==null){syncControls('再生位置を拍へ変換できません');return;}
        loopStartGrid=grid;
        if(loopEndGrid!=null&&loopEndGrid<=loopStartGrid){loopEndGrid=null;loopEnabled=false;clearTimer();}
        syncControls(`開始を ${gridLabel(loopStartGrid)} に設定`);
      });
      panel.querySelector('[data-rhythm-loop-set-end]').addEventListener('click',()=>{
        const grid=snapGrid(player.currentTime*1000);
        if(grid==null){syncControls('再生位置を拍へ変換できません');return;}
        if(loopStartGrid==null){syncControls('先に開始位置を設定してください');return;}
        if(grid<=loopStartGrid){syncControls('終了位置は開始位置より後に設定してください');return;}
        loopEndGrid=grid;
        syncControls(`終了を ${gridLabel(loopEndGrid)} に設定`);
      });
      panel.querySelector('[data-rhythm-loop-toggle]').addEventListener('click',()=>{
        if(loopEnabled){disableLoop();return;}
        if(!validRange()){syncControls('開始と終了を設定してください');return;}
        const startMs=timeAtGrid(loopStartGrid),endMs=timeAtGrid(loopEndGrid);
        if(!(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs)){syncControls('区間時刻を取得できません');return;}
        loopEnabled=true;
        const nowMs=player.currentTime*1000;
        if(nowMs<startMs||nowMs>=endMs)player.currentTime=Math.max(0,startMs/1000);
        syncControls(`区間 ${gridLabel(loopStartGrid)} → ${gridLabel(loopEndGrid)} をループ`);
        startLoopWatcher();
      });
      panel.querySelector('[data-rhythm-loop-jump-start]').addEventListener('click',()=>{
        if(loopStartGrid==null){syncControls('開始位置が未設定です');return;}
        const startMs=timeAtGrid(loopStartGrid);
        if(Number.isFinite(startMs))player.currentTime=Math.max(0,startMs/1000);
      });
      panel.querySelector('[data-rhythm-loop-clear]').addEventListener('click',()=>resetRange('区間を解除しました'));

      player.addEventListener('play',startLoopWatcher);
      player.addEventListener('pause',clearTimer);
      player.addEventListener('ended',clearTimer);
      targetEditor.querySelector('[data-rhythm-chart-track]')?.addEventListener('change',()=>resetRange());
    }

    if(timelineObserver&&timelineObserver._target!==timeline){timelineObserver.disconnect();timelineObserver=null;}
    if(!timelineObserver){
      timelineObserver=new MutationObserver(()=>renderRange());
      timelineObserver._target=timeline;
      timelineObserver.observe(timeline,{childList:true});
    }
    syncControls();
    return true;
  };

  const scan=()=>{
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    const target=visual();
    if(currentVisual===target&&target?.isConnected&&target.querySelector('[data-rhythm-section-loop-ui]')){
      const timeline=target.querySelector('[data-rhythm-visual-timeline]');
      if(timeline!==currentTimeline){currentTimeline=timeline;timelineObserver?.disconnect();timelineObserver=null;mount();}
      return;
    }
    currentVisual=null;currentTimeline=null;timelineObserver?.disconnect();timelineObserver=null;mount();
  };
  const start=()=>{
    scan();
    rootObserver=new MutationObserver(scan);
    rootObserver.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
