// DEBUG ONLY: 音ゲー譜面制作の配置・音合わせUI。
// 本番譜面やセーブデータは変更せず、既存の固定 timing/projection データを制作補助として使う。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmChartAuthoringUi==='ready')return;
  document.documentElement.dataset.rhythmChartAuthoringUi='ready';

  const DRAFT_URL='debug/atsu-cup-theme-easy-draft.json';
  const FORMAL_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v1.json';
  const TIMING_URL='data/rhythm-timing.js';
  const DIV=4;
  const PREVIEW_SONG_ID='__rhythm_authoring_preview__';
  const PREVIEW_LABEL='EASY FORMAL CANDIDATE PREVIEW';
  const EASY_LANE_PATTERN=Object.freeze([2,1,3,0,4,2,3,1,4,0]);
  let timingPromise=null;

  // RHYTHM_SONGS は既存仕様どおり freeze されているため、配列そのものは変更しない。
  // デバッグ編集中だけ map/find/some がこの1曲を仮想的に末尾へ見せる。対象配列以外の挙動は完全に素通しする。
  const previewChart={level:1,notes:[],totalNotes:0,durationMs:1000};
  const emptyPreviewChart=()=>({level:0,notes:[],totalNotes:0,durationMs:1000});
  const previewSong={
    songId:PREVIEW_SONG_ID,
    displayName:PREVIEW_LABEL,
    bgmTrackId:'atsu_cup_theme',
    difficulties:{
      EASY:previewChart,
      NORMAL:emptyPreviewChart(),
      HARD:emptyPreviewChart(),
      EXPERT:emptyPreviewChart(),
      MASTER:emptyPreviewChart(),
    },
  };
  let previewCatalogInstalled=false;
  const installPreviewCatalog=()=>{
    if(previewCatalogInstalled)return true;
    let catalog=null;
    try{catalog=RHYTHM_SONGS;}catch{return false;}
    if(!Array.isArray(catalog))return false;
    const proto=Array.prototype;
    const nativeMap=proto.map,nativeFind=proto.find,nativeSome=proto.some;
    proto.map=function(callback,thisArg){
      if(this===catalog){
        const result=nativeMap.call(this,callback,thisArg);
        result.push(callback.call(thisArg,previewSong,this.length,this));
        return result;
      }
      return nativeMap.call(this,callback,thisArg);
    };
    proto.find=function(callback,thisArg){
      if(this===catalog&&callback.call(thisArg,previewSong,this.length,this))return previewSong;
      return nativeFind.call(this,callback,thisArg);
    };
    proto.some=function(callback,thisArg){
      if(this===catalog&&callback.call(thisArg,previewSong,this.length,this))return true;
      return nativeSome.call(this,callback,thisArg);
    };
    previewCatalogInstalled=true;
    try{Object.defineProperty(window,'__mhRhythmAuthoringPreviewSong',{value:previewSong,configurable:false});}catch{}
    return true;
  };

  const ensureTiming=()=>{
    if(typeof rhythmTimingAt==='function'&&typeof rhythmSnapTimeToGrid==='function')return Promise.resolve();
    if(timingPromise)return timingPromise;
    timingPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('[data-rhythm-chart-timing-loader]');
      if(existing){
        existing.addEventListener('load',()=>resolve(),{once:true});
        existing.addEventListener('error',()=>reject(new Error('timing load failed')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.dataset.rhythmChartTimingLoader='';
      script.src=`${TIMING_URL}?debug=${Date.now()}`;
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error('timing load failed'));
      document.head.appendChild(script);
    });
    return timingPromise;
  };

  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const int=(n,min,max)=>Math.max(min,Math.min(max,Math.trunc(Number(n)||0)));
  const getTiming=trackId=>{
    try{return typeof RHYTHM_TIMING_DATA!=='undefined'?RHYTHM_TIMING_DATA?.[trackId]||null:null;}catch{return null;}
  };
  const getTrack=trackId=>{
    try{return typeof BGM_TRACKS!=='undefined'&&Array.isArray(BGM_TRACKS)?BGM_TRACKS.find(track=>track.id===trackId)||null:null;}catch{return null;}
  };
  const timeAt=(trackId,beat,sub)=>typeof rhythmTimingAt==='function'?rhythmTimingAt(trackId,int(beat,0,9999),int(sub,0,DIV-1),DIV):null;
  const snap=(trackId,timeMs)=>typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId,timeMs,DIV):null;
  const cleanNote=note=>{
    const out={type:String(note.type||'TAP'),timeMs:Math.round(Number(note.timeMs)||0),lane:Number(note.lane)||0};
    if(note.subLane!=null)out.subLane=int(note.subLane,0,9);
    if(note.subLaneWidth!=null)out.subLaneWidth=int(note.subLaneWidth,1,4);
    if(note.endTimeMs!=null)out.endTimeMs=Math.round(Number(note.endTimeMs)||out.timeMs);
    if(note.endLane!=null)out.endLane=Number(note.endLane)||0;
    if(Array.isArray(note.slidePoints))out.slidePoints=note.slidePoints.map(point=>{
      const row={timeMs:Math.round(Number(point.timeMs)||0),lane:Number(point.lane)||0};
      if(point.subLaneWidth!=null)row.subLaneWidth=int(point.subLaneWidth,1,4);
      return row;
    });
    return out;
  };
  const noteLabel=(note,index,trackId)=>{
    const grid=snap(trackId,note.timeMs);
    const pos=grid?`${grid.beatIndex}:${grid.subdivisionIndex}`:`${Math.round(note.timeMs)}ms`;
    const span=note.type==='SLIDE'?`L${note.lane}→${note.endLane}`:`S${Number(note.subLane)+1}`;
    const end=note.endTimeMs!=null?` → ${Math.round(note.endTimeMs)}ms`:'';
    return `#${index+1} ${pos} ${note.type} ${span} W${note.subLaneWidth||2}${end}`;
  };

  const mount=async()=>{
    const root=document.querySelector('[data-rhythm-debug]');
    if(!root||root.querySelector('[data-rhythm-chart-authoring-ui]'))return;
    installPreviewCatalog();

    const section=document.createElement('section');
    section.dataset.rhythmChartAuthoringUi='';
    section.className='mb-3 rounded-2xl border border-cyan-400/40 bg-slate-950/80 p-3 text-white';
    section.innerHTML=`
      <div class="mb-2">
        <small class="text-[8px] font-black tracking-wider text-cyan-300">DEBUG ONLY・CHART EDITOR v2</small>
        <h3 class="font-black">譜面エディタ・音合わせ</h3>
        <p class="mt-1 text-[9px] leading-relaxed text-slate-300">169 BPMの固定拍グリッドで譜面を作ります。現在はEASY正式候補v1（78ノーツ・TAP/HOLD）を優先読込し、±30ms超の22候補は耳確認待ちとして保留しています。</p>
      </div>
      <div data-rhythm-chart-status class="mb-2 rounded-lg bg-cyan-950/60 px-2 py-1 text-[9px] text-cyan-100">準備中…</div>
      <button type="button" data-rhythm-chart-preview disabled class="mb-3 min-h-[56px] w-full rounded-xl bg-amber-500 px-3 text-sm font-black text-slate-950 shadow-lg disabled:opacity-40">🎮 現在のEASY譜面をテストプレイ</button>
      <p class="-mt-2 mb-3 text-center text-[8px] text-amber-100">正式完成前のデバッグ候補です。既存の入力・判定・演出でそのまま試せます</p>
      <label class="block text-[9px] text-slate-300">対象曲
        <select data-rhythm-chart-track class="mt-1 min-h-[44px] w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm font-bold text-white"></select>
      </label>
      <audio data-rhythm-chart-audio controls playsinline preload="metadata" class="mt-2 w-full"></audio>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button type="button" data-rhythm-chart-seek-grid class="min-h-[44px] rounded-xl bg-cyan-800 text-xs font-black">入力拍へシーク</button>
        <button type="button" data-rhythm-chart-capture-grid class="min-h-[44px] rounded-xl bg-sky-800 text-xs font-black">再生位置→拍へ</button>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <label class="text-[9px] text-slate-300">種類<select data-rhythm-chart-type class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-2 text-sm font-black"><option>TAP</option><option>HOLD</option><option>FLICK</option><option>SLIDE</option></select></label>
        <label class="text-[9px] text-slate-300">幅<select data-rhythm-chart-width class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-2 text-sm font-black"><option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>7</option><option>8</option><option>9</option><option>10</option></select></label>
        <label class="text-[9px] text-slate-300">拍<input data-rhythm-chart-beat type="number" inputmode="numeric" min="0" value="8" class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-black"></label>
        <label class="text-[9px] text-slate-300">16分位置<select data-rhythm-chart-sub class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-2 text-sm font-black"><option value="0">0 / 表</option><option value="1">1</option><option value="2">2 / 8分裏</option><option value="3">3</option></select></label>
      </div>
      <div data-rhythm-chart-normal-fields class="mt-2">
        <label class="text-[9px] text-slate-300">サブレーン 1〜10<input data-rhythm-chart-sublane type="number" inputmode="numeric" min="1" max="10" value="5" class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-black"></label>
      </div>
      <div data-rhythm-chart-slide-fields class="mt-2 hidden grid-cols-2 gap-2">
        <label class="text-[9px] text-slate-300">SLIDE始点 0〜4<input data-rhythm-chart-slide-start type="number" inputmode="decimal" min="0" max="4" step="0.5" value="1" class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-black"></label>
        <label class="text-[9px] text-slate-300">SLIDE終点 0〜4<input data-rhythm-chart-slide-end type="number" inputmode="decimal" min="0" max="4" step="0.5" value="3" class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-black"></label>
      </div>
      <div data-rhythm-chart-duration-field class="mt-2 hidden">
        <label class="text-[9px] text-slate-300">長さ（16分グリッド数）<input data-rhythm-chart-duration type="number" inputmode="numeric" min="1" max="128" value="4" class="mt-1 min-h-[44px] w-full rounded-xl bg-slate-900 px-3 text-sm font-black"></label>
      </div>
      <button type="button" data-rhythm-chart-apply class="mt-3 min-h-[50px] w-full rounded-xl bg-emerald-700 font-black">ノーツを追加</button>
      <div class="mt-2 grid grid-cols-2 gap-2">
        <button type="button" data-rhythm-chart-load-candidate class="col-span-2 min-h-[46px] rounded-xl bg-emerald-700 text-[10px] font-black">EASY正式候補v1を再読込</button>
        <button type="button" data-rhythm-chart-load-draft class="min-h-[46px] rounded-xl bg-indigo-700 text-[10px] font-black">旧・自動ドラフト100</button>
        <button type="button" data-rhythm-chart-clear class="min-h-[46px] rounded-xl bg-rose-900/80 text-[10px] font-black">ドラフトを空にする</button>
      </div>
      <div class="mt-3 flex items-center justify-between"><b class="text-xs">ドラフト一覧</b><small data-rhythm-chart-count class="text-[9px] text-cyan-200">0 notes</small></div>
      <div data-rhythm-chart-list class="mt-2 max-h-72 space-y-1 overflow-auto rounded-xl bg-black/30 p-2 text-[9px]"></div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-rhythm-chart-copy-json class="min-h-[46px] rounded-xl bg-sky-700 text-[10px] font-black">JSONコピー</button>
        <button type="button" data-rhythm-chart-copy-js class="min-h-[46px] rounded-xl bg-violet-700 text-[10px] font-black">実装JSコピー</button>
      </div>
      <textarea data-rhythm-chart-output readonly class="mt-2 h-32 w-full rounded-xl bg-slate-950 p-2 font-mono text-[8px] text-slate-300" aria-label="譜面出力"></textarea>
    `;
    root.insertBefore(section,root.querySelector('[data-rhythm-authoring]')?.nextSibling||root.children[1]||null);

    const q=selector=>section.querySelector(selector);
    const status=q('[data-rhythm-chart-status]');
    const preview=q('[data-rhythm-chart-preview]');
    const trackSelect=q('[data-rhythm-chart-track]');
    const audio=q('[data-rhythm-chart-audio]');
    const type=q('[data-rhythm-chart-type]');
    const width=q('[data-rhythm-chart-width]');
    const beat=q('[data-rhythm-chart-beat]');
    const sub=q('[data-rhythm-chart-sub]');
    const subLane=q('[data-rhythm-chart-sublane]');
    const slideStart=q('[data-rhythm-chart-slide-start]');
    const slideEnd=q('[data-rhythm-chart-slide-end]');
    const duration=q('[data-rhythm-chart-duration]');
    const normalFields=q('[data-rhythm-chart-normal-fields]');
    const slideFields=q('[data-rhythm-chart-slide-fields]');
    const durationField=q('[data-rhythm-chart-duration-field]');
    const apply=q('[data-rhythm-chart-apply]');
    const list=q('[data-rhythm-chart-list]');
    const count=q('[data-rhythm-chart-count]');
    const output=q('[data-rhythm-chart-output]');
    let draft=[];
    let editingIndex=-1;

    const setStatus=text=>{if(status.textContent!==text)status.textContent=text;};
    const selectedTrackId=()=>trackSelect.value||'atsu_cup_theme';
    const syncTrack=()=>{
      const id=selectedTrackId(),track=getTrack(id);
      audio.removeAttribute('src');
      if(track?.src){audio.src=track.src;audio.load();}
      const timing=getTiming(id);
      setStatus(timing?`制作基準 ${timing.bpm} BPM / 1拍 ${timing.beatMs.toFixed(2)}ms / beatZero ${timing.beatZeroMs}ms`:'固定タイミング未登録');
      render();
    };
    const syncType=()=>{
      const isSlide=type.value==='SLIDE';
      const hasDuration=type.value==='HOLD'||isSlide;
      normalFields.style.display=isSlide?'none':'';
      slideFields.classList.toggle('hidden',!isSlide);
      slideFields.classList.toggle('grid',isSlide);
      durationField.style.display=hasDuration?'':'none';
    };
    const gridIndexFromFields=()=>int(beat.value,0,9999)*DIV+int(sub.value,0,DIV-1);
    const endTimeFromDuration=(trackId,startGrid)=>{
      const endGrid=startGrid+int(duration.value,1,128);
      return timeAt(trackId,Math.floor(endGrid/DIV),endGrid%DIV);
    };
    const buildNote=()=>{
      const trackId=selectedTrackId(),startGrid=gridIndexFromFields(),timeMs=timeAt(trackId,Math.floor(startGrid/DIV),startGrid%DIV);
      if(!Number.isFinite(timeMs))throw new Error('拍位置を時刻へ変換できません');
      const noteType=type.value,w=int(width.value,1,4);
      if(noteType==='SLIDE'){
        const a=Math.round(clamp(slideStart.value,0,4)*2)/2,b=Math.round(clamp(slideEnd.value,0,4)*2)/2,endTimeMs=endTimeFromDuration(trackId,startGrid);
        if(!(endTimeMs>timeMs))throw new Error('SLIDEの終端時刻が不正です');
        return {type:'SLIDE',timeMs:Math.round(timeMs),endTimeMs:Math.round(endTimeMs),lane:a,endLane:b,subLaneWidth:w,slidePoints:[{timeMs:Math.round(timeMs),lane:a,subLaneWidth:w},{timeMs:Math.round(endTimeMs),lane:b,subLaneWidth:w}]};
      }
      const s=int(Number(subLane.value)-1,0,9),note={type:noteType,timeMs:Math.round(timeMs),lane:Math.floor(s/2),subLane:s,subLaneWidth:w};
      if(noteType==='HOLD'){
        const endTimeMs=endTimeFromDuration(trackId,startGrid);
        if(!(endTimeMs>timeMs))throw new Error('HOLDの終端時刻が不正です');
        note.endTimeMs=Math.round(endTimeMs);
      }
      return note;
    };
    const sortDraft=()=>draft.sort((a,b)=>Number(a.timeMs)-Number(b.timeMs)||String(a.type).localeCompare(String(b.type)));
    const exportObject=()=>{
      const id=selectedTrackId(),timing=getTiming(id),notes=draft.map(cleanNote);
      return {trackId:id,bpm:timing?.bpm??null,beatZeroMs:timing?.beatZeroMs??null,subdivisionsPerBeat:DIV,noteCount:notes.length,notes};
    };
    const jsOutput=()=>{
      const notes=draft.map(cleanNote);
      return `const authoringDraftNotes = Object.freeze(${JSON.stringify(notes,null,2)});\nconst authoringDraftChart = Object.freeze({level:1,notes:authoringDraftNotes,totalNotes:authoringDraftNotes.length,durationMs:${Math.max(1000,...notes.map(n=>Number(n.endTimeMs??n.timeMs)+1000))}});`;
    };
    const syncPreviewChart=()=>{
      const notes=draft.map(cleanNote);
      previewSong.bgmTrackId=selectedTrackId();
      previewChart.notes=notes;
      previewChart.totalNotes=notes.length;
      previewChart.durationMs=Math.max(1000,...notes.map(note=>Number(note.endTimeMs??note.timeMs)+1000));
      preview.disabled=!notes.length;
      return notes.length;
    };
    const render=()=>{
      sortDraft();
      count.textContent=`${draft.length} notes`;
      preview.disabled=!draft.length;
      list.replaceChildren();
      if(!draft.length){
        const empty=document.createElement('p');empty.className='py-3 text-center text-slate-500';empty.textContent='まだノーツがありません';list.appendChild(empty);
      }else draft.forEach((note,index)=>{
        const row=document.createElement('div');
        row.className='flex items-center gap-1 rounded-lg bg-slate-900/80 p-1.5';
        const label=document.createElement('span');label.className='min-w-0 flex-1 truncate';label.textContent=noteLabel(note,index,selectedTrackId());
        const seek=document.createElement('button');seek.type='button';seek.className='min-h-[34px] rounded bg-cyan-800 px-2 font-black';seek.textContent='▶';seek.addEventListener('click',()=>{audio.currentTime=Math.max(0,Number(note.timeMs)/1000-.8);audio.play().catch(()=>{});});
        const edit=document.createElement('button');edit.type='button';edit.className='min-h-[34px] rounded bg-amber-700 px-2 font-black';edit.textContent='編集';edit.addEventListener('click',()=>loadNoteForEdit(index));
        const del=document.createElement('button');del.type='button';del.className='min-h-[34px] rounded bg-rose-900 px-2 font-black';del.textContent='×';del.addEventListener('click',()=>{draft.splice(index,1);editingIndex=-1;apply.textContent='ノーツを追加';render();syncPreviewChart();});
        row.append(label,seek,edit,del);list.appendChild(row);
      });
      output.value=JSON.stringify(exportObject(),null,2);
    };
    const loadNoteForEdit=index=>{
      const note=draft[index];if(!note)return;
      editingIndex=index;
      type.value=note.type;
      width.value=String(note.subLaneWidth||2);
      const start=snap(selectedTrackId(),note.timeMs);
      if(start){beat.value=String(start.beatIndex);sub.value=String(start.subdivisionIndex);}
      if(note.type==='SLIDE'){
        slideStart.value=String(note.lane);slideEnd.value=String(note.endLane??note.lane);
      }else subLane.value=String(int(note.subLane,0,9)+1);
      if(note.endTimeMs!=null&&start){
        const end=snap(selectedTrackId(),note.endTimeMs);
        if(end)duration.value=String(Math.max(1,end.gridIndex-start.gridIndex));
      }
      syncType();apply.textContent='選択ノーツを更新';setStatus(`#${index+1} を編集中`);section.scrollIntoView({behavior:'smooth',block:'start'});
    };
    const copyText=async(text,label)=>{
      output.value=text;
      try{await navigator.clipboard.writeText(text);setStatus(`${label}をコピーしました`);}
      catch{output.focus();output.select();setStatus('自動コピーできません。下の欄を長押ししてコピーしてください');}
    };
    const candidateNote=(row,trackId)=>{
      const grid=int(row?.grid,0,99999),timeMs=timeAt(trackId,Math.floor(grid/DIV),grid%DIV),lane=int(row?.lane,0,4),w=int(row?.subLaneWidth,1,4),noteType=String(row?.type||'TAP');
      if(!Number.isFinite(timeMs)||!['TAP','HOLD','FLICK'].includes(noteType))return null;
      const s=int(row?.subLane,lane*2,Math.min(9,lane*2)),note={type:noteType,timeMs:Math.round(timeMs),lane,subLane:s,subLaneWidth:w,_sourceGrid:grid,_strength:Number(row?.sourceStrength)||0,_sourcePeakOffsetMs:Number(row?.sourcePeakOffsetMs)||0};
      if(noteType==='HOLD'){
        const endGrid=grid+int(row?.durationGrids,1,128),endTimeMs=timeAt(trackId,Math.floor(endGrid/DIV),endGrid%DIV);
        if(!(endTimeMs>timeMs))return null;
        note.endTimeMs=Math.round(endTimeMs);
      }
      return note;
    };
    const loadFormalCandidate=async(confirmReplace)=>{
      try{
        const response=await fetch(`${FORMAL_CANDIDATE_URL}?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        if(!Array.isArray(data?.notes))throw new Error('notesなし');
        if(confirmReplace&&draft.length&&!confirm('現在のドラフトをEASY正式候補v1で置き換えますか？'))return false;
        const id=data.trackId||'atsu_cup_theme';
        if([...trackSelect.options].some(option=>option.value===id))trackSelect.value=id;
        syncTrack();
        draft=data.notes.map(row=>candidateNote(row,id)).filter(Boolean);
        editingIndex=-1;apply.textContent='ノーツを追加';
        setStatus(`EASY正式候補v${Number(data.candidateVersion)||1}: ${draft.length}ノーツ（TAP ${Number(data.typeCounts?.TAP)||0} / HOLD ${Number(data.typeCounts?.HOLD)||0}）。耳確認待ち ${Array.isArray(data.earReviewGrids)?data.earReviewGrids.length:0}点`);
        render();syncPreviewChart();return true;
      }catch(error){setStatus(`正式候補読込失敗: ${error?.message||error}`);return false;}
    };
    const loadAutoDraft=async(confirmReplace)=>{
      try{
        const response=await fetch(`${DRAFT_URL}?t=${Date.now()}`,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        if(!Array.isArray(data?.points))throw new Error('pointsなし');
        if(confirmReplace&&draft.length&&!confirm('現在のドラフトをEASY自動ドラフトで置き換えますか？'))return false;
        const id=data.trackId||'atsu_cup_theme';
        if([...trackSelect.options].some(option=>option.value===id))trackSelect.value=id;
        syncTrack();
        draft=data.points.map((row,index)=>{
          const grid=int(row?.[0],0,99999),timeMs=timeAt(id,Math.floor(grid/DIV),grid%DIV),lane=EASY_LANE_PATTERN[index%EASY_LANE_PATTERN.length];
          return {type:'TAP',timeMs:Math.round(timeMs),lane,subLane:lane*2,subLaneWidth:2,_sourceGrid:grid,_strength:Number(row?.[1])||0};
        }).filter(note=>Number.isFinite(note.timeMs));
        editingIndex=-1;apply.textContent='ノーツを追加';
        setStatus(`旧EASY自動ドラフト ${draft.length}ノーツを5レーンへ仮配置しました。比較用です`);
        render();syncPreviewChart();return true;
      }catch(error){setStatus(`ドラフト読込失敗: ${error?.message||error}`);return false;}
    };
    const findSelectWithLabels=(scope,labels)=>[...scope.querySelectorAll('select')].find(select=>{
      const texts=[...select.options].map(option=>(option.textContent||'').trim());
      return labels.every(label=>texts.some(text=>text===label||text.includes(label)));
    });
    const dispatchValue=(select,value,label)=>{
      if(!select)return false;
      if(label&&![...select.options].some(option=>option.value===value)){
        const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);
      }
      select.value=value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    };
    const startPreview=()=>{
      if(!syncPreviewChart()){setStatus('テストするノーツがありません');return;}
      if(!installPreviewCatalog()){setStatus('音ゲー曲一覧へプレビューを接続できません');return;}
      const debugRoot=document.querySelector('[data-rhythm-debug]');
      if(!debugRoot){setStatus('音ゲーデバッグ画面を取得できません');return;}
      const difficultySelect=findSelectWithLabels(debugRoot,['EASY','NORMAL','HARD','EXPERT','MASTER']);
      const songSelect=findSelectWithLabels(debugRoot,['あつ杯テーマ','WIDTH TEST']);
      if(!songSelect){setStatus('曲選択欄を取得できません。上の曲一覧を一度操作してから再試行してください');return;}
      audio.pause();
      const changeSelection=()=>{
        if(difficultySelect)dispatchValue(difficultySelect,'EASY');
        dispatchValue(songSelect,PREVIEW_SONG_ID,PREVIEW_LABEL);
      };
      try{
        if(window.ReactDOM&&typeof window.ReactDOM.flushSync==='function')window.ReactDOM.flushSync(changeSelection);
        else changeSelection();
      }catch{changeSelection();}
      const startButton=[...debugRoot.querySelectorAll('button')].find(button=>!button.closest('[data-rhythm-chart-authoring-ui]')&&/テストプレイ/.test(button.textContent||''));
      if(!startButton){setStatus('プレビュー曲へ切り替えました。上の「テストプレイ」ボタンを押してください');return;}
      startButton.click();
    };

    try{
      await ensureTiming();
      const timingIds=(()=>{try{return typeof RHYTHM_TIMING_DATA!=='undefined'?Object.keys(RHYTHM_TIMING_DATA):[];}catch{return [];}})();
      timingIds.forEach(id=>{const option=document.createElement('option');option.value=id;option.textContent=id==='atsu_cup_theme'?'あつ杯テーマ':id;trackSelect.appendChild(option);});
      if(!timingIds.length){const option=document.createElement('option');option.value='atsu_cup_theme';option.textContent='あつ杯テーマ';trackSelect.appendChild(option);}
      syncTrack();syncType();render();
      if(!await loadFormalCandidate(false))await loadAutoDraft(false);
    }catch(error){setStatus(`タイミング読込失敗: ${error?.message||error}`);}

    trackSelect.addEventListener('change',syncTrack);
    type.addEventListener('change',syncType);
    preview.addEventListener('click',startPreview);
    q('[data-rhythm-chart-seek-grid]').addEventListener('click',()=>{const time=timeAt(selectedTrackId(),beat.value,sub.value);if(Number.isFinite(time)){audio.currentTime=Math.max(0,time/1000-.5);audio.play().catch(()=>{});}});
    q('[data-rhythm-chart-capture-grid]').addEventListener('click',()=>{const snapped=snap(selectedTrackId(),audio.currentTime*1000);if(!snapped)return;beat.value=String(snapped.beatIndex);sub.value=String(snapped.subdivisionIndex);setStatus(`再生位置 ${Math.round(audio.currentTime*1000)}ms → 拍 ${snapped.beatIndex}:${snapped.subdivisionIndex}（差 ${Math.round(snapped.deltaMs)}ms）`);});
    apply.addEventListener('click',()=>{
      try{
        const note=buildNote();
        if(editingIndex>=0&&editingIndex<draft.length)draft[editingIndex]=note;else draft.push(note);
        editingIndex=-1;apply.textContent='ノーツを追加';setStatus('ドラフトを更新しました');render();syncPreviewChart();
      }catch(error){setStatus(`追加できません: ${error?.message||error}`);}
    });
    section.addEventListener('rhythm-chart-replace-note',event=>{
      try{
        const index=Math.trunc(Number(event.detail?.index));
        if(!(index>=0&&index<draft.length))throw new Error('対象ノーツが見つかりません');
        const next=cleanNote(event.detail?.note||{});
        if(next.type!=='SLIDE'||!Array.isArray(next.slidePoints)||next.slidePoints.length<2)throw new Error('SLIDE経路が不正です');
        for(let i=1;i<next.slidePoints.length;i++){
          if(!(next.slidePoints[i].timeMs>next.slidePoints[i-1].timeMs))throw new Error('SLIDE経路の時刻順が不正です');
        }
        const first=next.slidePoints[0],last=next.slidePoints[next.slidePoints.length-1];
        next.timeMs=first.timeMs;next.lane=first.lane;next.endTimeMs=last.timeMs;next.endLane=last.lane;
        draft[index]=next;
        editingIndex=-1;apply.textContent='ノーツを追加';setStatus(String(event.detail?.label||`#${index+1} SLIDE経路を更新`));render();syncPreviewChart();
      }catch(error){setStatus(`SLIDE経路を更新できません: ${error?.message||error}`);}
    });
    section.addEventListener('rhythm-chart-load-review-preview',event=>{
      try{
        const rows=Array.isArray(event.detail?.notes)?event.detail.notes:[];
        if(!rows.length)throw new Error('レビュー譜面が空です');
        const id=String(event.detail?.trackId||'atsu_cup_theme');
        if([...trackSelect.options].some(option=>option.value===id))trackSelect.value=id;
        syncTrack();
        draft=rows.map(row=>candidateNote(row,id)).filter(Boolean);
        editingIndex=-1;apply.textContent='ノーツを追加';
        setStatus(String(event.detail?.label||`v2レビュー譜面 ${draft.length}ノーツを仮適用しました`));
        render();syncPreviewChart();
      }catch(error){setStatus(`v2レビュー譜面を仮適用できません: ${error?.message||error}`);}
    });
    q('[data-rhythm-chart-load-candidate]').addEventListener('click',()=>loadFormalCandidate(true));
    q('[data-rhythm-chart-load-draft]').addEventListener('click',()=>loadAutoDraft(true));
    q('[data-rhythm-chart-clear]').addEventListener('click',()=>{if(draft.length&&!confirm('編集中のドラフトを空にしますか？'))return;draft=[];editingIndex=-1;apply.textContent='ノーツを追加';setStatus('ドラフトを空にしました');render();syncPreviewChart();});
    q('[data-rhythm-chart-copy-json]').addEventListener('click',()=>copyText(JSON.stringify(exportObject(),null,2),'JSON'));
    q('[data-rhythm-chart-copy-js]').addEventListener('click',()=>copyText(jsOutput(),'実装JS'));
  };

  const observer=new MutationObserver(()=>mount().catch(()=>{}));
  const start=()=>{mount().catch(()=>{});observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
