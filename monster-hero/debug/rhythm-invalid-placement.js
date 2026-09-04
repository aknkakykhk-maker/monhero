// DEBUG ONLY: 視覚譜面エディタ STEP 2-D。不正配置チェック。
// 正式譜面・BEST・ゲーム本体の判定は変更せず、編集中draftの事故だけを検出する。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmInvalidPlacementUi==='ready')return;
  document.documentElement.dataset.rhythmInvalidPlacementUi='ready';

  const DIV=4;
  const ALLOWED_TYPES=new Set(['TAP','HOLD','FLICK','SLIDE']);
  let currentEditor=null,currentList=null,listObserver=null,rootObserver=null,renderQueued=false;

  const finite=value=>Number.isFinite(Number(value));
  const integer=value=>Number.isInteger(Number(value));
  const halfLane=value=>{
    const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=4&&Math.abs(n*2-Math.round(n*2))<1e-6;
  };
  // 幅の上限は全幅(=10サブレーン)。以前は4で頭打ちにしていたが、実機で
  // 「上限を無くして全幅もありに」と言われて撤廃した(2026-09-04)。
  const validWidth=value=>integer(value)&&Number(value)>=1&&Number(value)<=10;
  const readDraft=editor=>{
    const output=editor?.querySelector('[data-rhythm-chart-output]');
    if(!output)return [];
    try{const parsed=JSON.parse(output.value||'{}');return Array.isArray(parsed?.notes)?parsed.notes:[];}catch{return [];}
  };
  const trackId=editor=>editor?.querySelector('[data-rhythm-chart-track]')?.value||'atsu_cup_theme';
  const snap=(editor,timeMs)=>{
    try{return typeof rhythmSnapTimeToGrid==='function'?rhythmSnapTimeToGrid(trackId(editor),Number(timeMs),DIV):null;}catch{return null;}
  };
  const gridInfo=(editor,timeMs)=>{
    const row=snap(editor,timeMs);
    return row&&Number.isFinite(row.gridIndex)?{gridIndex:Math.round(row.gridIndex),deltaMs:Number(row.deltaMs)||0}:null;
  };
  const pushOffGrid=(errors,editor,timeMs,label)=>{
    const row=gridInfo(editor,timeMs);
    if(row&&Math.abs(row.deltaMs)>1)errors.push(`${label}が16分グリッド外です`);
    return row;
  };
  const validateNote=(editor,note,index=-1)=>{
    const errors=[],warnings=[],prefix=index>=0?`#${index+1} `:'';
    const type=String(note?.type||'');
    if(!ALLOWED_TYPES.has(type))errors.push(`${prefix}未対応の種類です`);
    if(!finite(note?.timeMs)||Number(note.timeMs)<0)errors.push(`${prefix}開始時刻が不正です`);
    else pushOffGrid(errors,editor,note.timeMs,`${prefix}開始時刻`);
    if(!validWidth(note?.subLaneWidth))errors.push(`${prefix}幅は1〜10の整数が必要です`);
    // 終点フリック(endFlick)。書き間違いは画面上では「ただ効かない」だけになるので、ここで拾う。
    if(note?.endFlick!==undefined){
      if(note.endFlick!==true)errors.push(`${prefix}endFlickはtrueだけ書けます`);
      else if(type!=='HOLD'&&type!=='SLIDE')errors.push(`${prefix}終点フリックはHOLD / SLIDEにだけ付けられます`);
    }

    if(type!=='SLIDE'){
      const subLane=Number(note?.subLane),width=Number(note?.subLaneWidth);
      if(!integer(subLane)||subLane<0||subLane>9)errors.push(`${prefix}サブレーンは1〜10内が必要です`);
      else if(validWidth(width)&&subLane+width>10)errors.push(`${prefix}幅${width}が10サブレーン外へはみ出します`);
      if(type==='HOLD'){
        if(!finite(note?.endTimeMs)||!(Number(note.endTimeMs)>Number(note.timeMs)))errors.push(`${prefix}HOLD終端時刻が不正です`);
        else{
          const start=gridInfo(editor,note.timeMs),end=pushOffGrid(errors,editor,note.endTimeMs,`${prefix}HOLD終端`);
          if(start&&end){const grids=end.gridIndex-start.gridIndex;if(grids<1||grids>128)errors.push(`${prefix}HOLD長さは1〜128グリッドが必要です`);}
        }
      }
      return {errors,warnings};
    }

    if(!halfLane(note?.lane))errors.push(`${prefix}SLIDE始点は0〜4の0.5レーン刻みが必要です`);
    if(!halfLane(note?.endLane))errors.push(`${prefix}SLIDE終点は0〜4の0.5レーン刻みが必要です`);
    if(!finite(note?.endTimeMs)||!(Number(note.endTimeMs)>Number(note.timeMs)))errors.push(`${prefix}SLIDE終端時刻が不正です`);
    const points=Array.isArray(note?.slidePoints)?note.slidePoints:[];
    if(points.length<2){errors.push(`${prefix}SLIDE経路は2点以上必要です`);return {errors,warnings};}
    points.forEach((point,pointIndex)=>{
      const label=`${prefix}SLIDE ${pointIndex+1}点目`;
      if(!finite(point?.timeMs))errors.push(`${label}の時刻が不正です`);
      else pushOffGrid(errors,editor,point.timeMs,`${label}の時刻`);
      if(!halfLane(point?.lane))errors.push(`${label}は0〜4の0.5レーン刻みが必要です`);
      const pointWidth=point?.subLaneWidth??note?.subLaneWidth;
      if(!validWidth(pointWidth))errors.push(`${label}の幅は1〜10の整数が必要です`);
      if(pointIndex>0&&finite(point?.timeMs)&&finite(points[pointIndex-1]?.timeMs)&&!(Number(point.timeMs)>Number(points[pointIndex-1].timeMs)))errors.push(`${prefix}SLIDE経路の時刻順が不正です`);
    });
    const first=points[0],last=points[points.length-1];
    if(finite(first?.timeMs)&&Math.abs(Number(first.timeMs)-Number(note.timeMs))>1)errors.push(`${prefix}SLIDE始点と経路先頭の時刻が一致しません`);
    if(finite(last?.timeMs)&&Math.abs(Number(last.timeMs)-Number(note.endTimeMs))>1)errors.push(`${prefix}SLIDE終点と経路末尾の時刻が一致しません`);
    if(halfLane(first?.lane)&&halfLane(note?.lane)&&Math.abs(Number(first.lane)-Number(note.lane))>1e-6)errors.push(`${prefix}SLIDE始点と経路先頭のレーンが一致しません`);
    if(halfLane(last?.lane)&&halfLane(note?.endLane)&&Math.abs(Number(last.lane)-Number(note.endLane))>1e-6)errors.push(`${prefix}SLIDE終点と経路末尾のレーンが一致しません`);
    const start=gridInfo(editor,note?.timeMs),end=gridInfo(editor,note?.endTimeMs);
    if(start&&end){const grids=end.gridIndex-start.gridIndex;if(grids<1||grids>128)errors.push(`${prefix}SLIDE長さは1〜128グリッドが必要です`);}
    return {errors,warnings};
  };

  const validateDraft=editor=>{
    const notes=readDraft(editor),errors=[],warnings=[],byIndex=new Map(),seen=new Map();
    notes.forEach((note,index)=>{
      const result=validateNote(editor,note,index);
      if(result.errors.length){byIndex.set(index,'error');errors.push(...result.errors);}
      if(note?.type!=='SLIDE'&&finite(note?.timeMs)&&integer(note?.subLane)&&validWidth(note?.subLaneWidth)){
        const key=[note.type,Math.round(Number(note.timeMs)),Number(note.subLane),Number(note.subLaneWidth)].join('|');
        if(seen.has(key)){
          const first=seen.get(key);warnings.push(`#${first+1} と #${index+1} が同時刻・同位置で重複しています`);
          if(!byIndex.has(first))byIndex.set(first,'warning');if(!byIndex.has(index))byIndex.set(index,'warning');
        }else seen.set(key,index);
      }
    });
    return {notes,errors,warnings,byIndex};
  };

  const validateForm=editor=>{
    const errors=[],type=editor.querySelector('[data-rhythm-chart-type]')?.value||'',width=Number(editor.querySelector('[data-rhythm-chart-width]')?.value);
    const beat=Number(editor.querySelector('[data-rhythm-chart-beat]')?.value),sub=Number(editor.querySelector('[data-rhythm-chart-sub]')?.value);
    if(!ALLOWED_TYPES.has(type))errors.push('未対応のノーツ種類です');
    if(!integer(width)||width<1||width>10)errors.push('幅は1〜10の整数にしてください');
    if(!integer(beat)||beat<0)errors.push('拍は0以上の整数にしてください');
    if(!integer(sub)||sub<0||sub>=DIV)errors.push('16分位置は0〜3にしてください');
    if(type==='SLIDE'){
      const a=Number(editor.querySelector('[data-rhythm-chart-slide-start]')?.value),b=Number(editor.querySelector('[data-rhythm-chart-slide-end]')?.value);
      if(!halfLane(a))errors.push('SLIDE始点は0〜4の0.5レーン刻みにしてください');
      if(!halfLane(b))errors.push('SLIDE終点は0〜4の0.5レーン刻みにしてください');
    }else{
      const lane=Number(editor.querySelector('[data-rhythm-chart-sublane]')?.value);
      if(!integer(lane)||lane<1||lane>10)errors.push('サブレーンは1〜10の整数にしてください');
      else if(validWidth(width)&&(lane-1)+width>10)errors.push(`幅${width}ではサブレーン${lane}開始にできません`);
    }
    if(type==='HOLD'||type==='SLIDE'){
      const duration=Number(editor.querySelector('[data-rhythm-chart-duration]')?.value);
      if(!integer(duration)||duration<1||duration>128)errors.push('長さは1〜128グリッドにしてください');
    }
    return errors;
  };

  const ensurePanel=editor=>{
    let panel=editor.querySelector('[data-rhythm-invalid-placement-ui]');
    if(panel)return panel;
    panel=document.createElement('div');panel.dataset.rhythmInvalidPlacementUi='';
    panel.className='mt-2 rounded-xl border border-emerald-400/40 bg-emerald-950/30 p-2 text-[9px] text-emerald-100';
    panel.innerHTML='<div class="font-black" data-rhythm-invalid-summary>配置チェック: OK</div><div class="mt-1 hidden leading-relaxed" data-rhythm-invalid-detail></div>';
    const list=editor.querySelector('[data-rhythm-chart-list]');
    if(list)list.insertAdjacentElement('beforebegin',panel);else editor.appendChild(panel);
    return panel;
  };
  const setPanel=(editor,result,overrideErrors=null)=>{
    const panel=ensurePanel(editor),summary=panel.querySelector('[data-rhythm-invalid-summary]'),detail=panel.querySelector('[data-rhythm-invalid-detail]');
    const errors=overrideErrors||result.errors,warnings=overrideErrors?[]:result.warnings;
    panel.className='mt-2 rounded-xl border p-2 text-[9px] '+(errors.length?'border-rose-400/70 bg-rose-950/45 text-rose-100':warnings.length?'border-amber-400/70 bg-amber-950/35 text-amber-100':'border-emerald-400/40 bg-emerald-950/30 text-emerald-100');
    summary.textContent=errors.length?`配置チェック: エラー ${errors.length}件`:warnings.length?`配置チェック: 警告 ${warnings.length}件`:'配置チェック: OK';
    const rows=[...errors.slice(0,4),...warnings.slice(0,3)];
    detail.classList.toggle('hidden',!rows.length);detail.replaceChildren(...rows.map(text=>{const p=document.createElement('p');p.textContent=`・${text}`;return p;}));
  };
  const paintNotes=(editor,result)=>{
    const list=editor.querySelector('[data-rhythm-chart-list]');
    [...(list?.children||[])].forEach((row,index)=>{
      const state=result.byIndex.get(index)||'';row.dataset.rhythmInvalidState=state;
      row.style.outline=state==='error'?'2px solid #fb7185':state==='warning'?'2px solid #fbbf24':'';
    });
    editor.querySelectorAll('[data-rhythm-visual-note]').forEach(node=>{
      const index=Number(node.dataset.rhythmVisualNote),state=result.byIndex.get(index)||'';node.dataset.rhythmInvalidState=state;
      node.style.boxShadow=state==='error'?'0 0 0 3px #fb7185,0 0 14px rgba(251,113,133,.8)':state==='warning'?'0 0 0 2px #fbbf24,0 0 10px rgba(251,191,36,.6)':'';
      if(state)node.setAttribute('aria-invalid',state==='error'?'true':'false');else node.removeAttribute('aria-invalid');
    });
  };
  const render=()=>{
    renderQueued=false;const editor=currentEditor;if(!editor?.isConnected)return;
    const result=validateDraft(editor);setPanel(editor,result);paintNotes(editor,result);
    const preview=editor.querySelector('[data-rhythm-chart-preview]'),copyJson=editor.querySelector('[data-rhythm-chart-copy-json]'),copyJs=editor.querySelector('[data-rhythm-chart-copy-js]');
    if(preview)preview.disabled=!result.notes.length||result.errors.length>0;
    if(copyJson)copyJson.disabled=result.errors.length>0;if(copyJs)copyJs.disabled=result.errors.length>0;
  };
  const queueRender=()=>{if(renderQueued)return;renderQueued=true;setTimeout(render,0);};
  const bind=()=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');if(!editor)return false;
    currentEditor=editor;ensurePanel(editor);
    const list=editor.querySelector('[data-rhythm-chart-list]');
    if(currentList!==list){listObserver?.disconnect();currentList=list;if(list){listObserver=new MutationObserver(queueRender);listObserver.observe(list,{childList:true});}}
    if(!editor.dataset.rhythmInvalidBound){
      editor.dataset.rhythmInvalidBound='true';
      editor.addEventListener('click',event=>{
        const apply=event.target.closest('[data-rhythm-chart-apply]');
        if(apply){const errors=validateForm(editor);if(errors.length){event.preventDefault();event.stopImmediatePropagation();setPanel(editor,validateDraft(editor),errors);const status=editor.querySelector('[data-rhythm-chart-status]');if(status)status.textContent=`追加できません: ${errors[0]}`;}}
        const protectedAction=event.target.closest('[data-rhythm-chart-preview],[data-rhythm-chart-copy-json],[data-rhythm-chart-copy-js]');
        if(protectedAction){const result=validateDraft(editor);if(result.errors.length){event.preventDefault();event.stopImmediatePropagation();setPanel(editor,result);}}
      },true);
      editor.addEventListener('rhythm-chart-replace-note',event=>{
        const result=validateNote(editor,event.detail?.note||{},Number(event.detail?.index));
        if(result.errors.length){event.stopImmediatePropagation();setPanel(editor,validateDraft(editor),result.errors);const status=editor.querySelector('[data-rhythm-chart-status]');if(status)status.textContent=`SLIDE経路を更新できません: ${result.errors[0]}`;}
      },true);
      editor.querySelector('[data-rhythm-chart-track]')?.addEventListener('change',queueRender);
    }
    queueRender();return true;
  };
  const scan=()=>{
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    if(currentEditor?.isConnected&&currentList?.isConnected)return;
    currentEditor=null;currentList=null;listObserver?.disconnect();listObserver=null;bind();
  };
  const start=()=>{scan();rootObserver=new MutationObserver(scan);rootObserver.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
