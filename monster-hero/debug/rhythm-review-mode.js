// DEBUG ONLY: 音ゲー確認者向けの補助表示。
// 元のデバッグ曲/難易度一覧は並べ替えず最優先で触れる状態を保ち、制作エディタは下部へ退避する。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmReviewMode==='ready')return;
  document.documentElement.dataset.rhythmReviewMode='ready';

  const EAR_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v2-review.json';
  const EAR_GROUP_GAP_GRIDS=24;
  const EAR_LOOP_PADDING_GRIDS=8;
  const PREVIEW_SONG_ID='__rhythm_authoring_preview__';
  const PREVIEW_LABEL='EASY FORMAL CANDIDATE PREVIEW';
  let currentEditor=null;
  let currentRoot=null;
  let statusObserver=null;
  let earPlanPromise=null;
  let earPlan=null;
  let earIndex=0;
  let candidateIndex=0;
  const reviewDecisions=new Map();

  const setText=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
  const formatTime=ms=>{
    const totalTenths=Math.max(0,Math.round((Number(ms)||0)/100));
    const minutes=Math.floor(totalTenths/600);
    const seconds=Math.floor((totalTenths%600)/10);
    const tenths=totalTenths%10;
    return `${minutes}:${String(seconds).padStart(2,'0')}.${tenths}`;
  };
  const timingAtGrid=(candidate,grid)=>{
    try{
      if(typeof rhythmTimingAt==='function'){
        const value=rhythmTimingAt(candidate.trackId,Math.floor(grid/4),grid%4,4);
        if(Number.isFinite(value))return value;
      }
    }catch(_e){}
    return (Number(candidate.beatZeroMs)||0)+grid*(60000/(Number(candidate.bpm)||169)/(Number(candidate.subdivisionsPerBeat)||4));
  };
  const buildEarGroups=candidate=>{
    const pending=Array.isArray(candidate?.pendingReviews)?candidate.pendingReviews:[];
    const reviews=pending.map(row=>Number(row?.grid)).filter(Number.isFinite);
    if(candidate?.trackId!=='atsu_cup_theme'||candidate?.difficulty!=='EASY'||candidate?.candidateVersion!==2||candidate?.status!=='FORMAL_CANDIDATE_REVIEW'||candidate?.reviewRequired!==true||candidate?.runtimeConnected!==false||candidate?.notes?.length!==78||reviews.length!==22)return null;
    const sorted=[...reviews].sort((a,b)=>a-b);
    if(sorted.some((grid,index)=>grid!==reviews[index])||new Set(sorted).size!==sorted.length)return null;
    const groups=[];
    sorted.forEach(grid=>{
      const current=groups[groups.length-1];
      if(!current||grid-current.points[current.points.length-1]>EAR_GROUP_GAP_GRIDS)groups.push({points:[grid]});
      else current.points.push(grid);
    });
    groups.forEach(group=>{
      group.candidates=group.points.map(grid=>pending.find(row=>Number(row.grid)===grid));
      group.startGrid=Math.max(0,group.points[0]-EAR_LOOP_PADDING_GRIDS);
      group.endGrid=group.points[group.points.length-1]+EAR_LOOP_PADDING_GRIDS;
      group.startMs=timingAtGrid(candidate,group.startGrid);
      group.endMs=timingAtGrid(candidate,group.endGrid);
    });
    return groups.length===16?{candidate,groups}:null;
  };
  const loadEarPlan=()=>{
    if(earPlanPromise)return earPlanPromise;
    if(typeof fetch!=='function')return Promise.reject(new Error('fetchを利用できません'));
    earPlanPromise=fetch(EAR_CANDIDATE_URL,{cache:'no-store'})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
      .then(candidate=>{
        const plan=buildEarGroups(candidate);
        if(!plan)throw new Error('candidate v2-reviewの耳確認22点と一致しません');
        earPlan=plan;
        return plan;
      })
      .catch(error=>{earPlan=null;throw error;});
    return earPlanPromise;
  };

  // Tailwind CDNの動的class生成が端末側で遅延/欠落しても、ノーツ本体を枠線だけにしない。
  // 既存の意図と同じ色を通常CSSでも保証し、座標・判定・速度には一切触れない。
  const ensureNoteVisibilityStyle=()=>{
    if(document.querySelector('style[data-rhythm-note-visibility-fallback]'))return;
    const style=document.createElement('style');
    style.dataset.rhythmNoteVisibilityFallback='';
    style.textContent=`
      [data-rhythm-note] { z-index:5; }
      [data-rhythm-note] > span:last-child {
        display:block !important;
        background:linear-gradient(to bottom,#fde68a 0%,#f0abfc 48%,#d946ef 100%) !important;
        opacity:1 !important;
      }
      [data-rhythm-note][data-note-type="HOLD"] > span:last-child {
        background:linear-gradient(to bottom,#a7f3d0 0%,#67e8f9 52%,#0891b2 100%) !important;
      }
      [data-rhythm-note][data-note-type="FLICK"] > span:last-child {
        background:linear-gradient(to bottom,#fef3c7 0%,#f9a8d4 46%,#c026d3 100%) !important;
      }
      [data-rhythm-note][data-note-type="SLIDE"] > span:last-child {
        background:linear-gradient(to bottom,#ddd6fe 0%,#67e8f9 50%,#9333ea 100%) !important;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureGuide=editor=>{
    let guide=editor.querySelector(':scope > [data-rhythm-review-guide]');
    if(guide)return guide;
    guide=document.createElement('section');
    guide.dataset.rhythmReviewGuide='';
    guide.className='mb-3 rounded-2xl border border-amber-300/50 bg-amber-950/35 p-3 text-white';
    guide.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <div>
          <small class="text-[8px] font-black tracking-wider text-amber-300">EASY制作確認</small>
          <h3 class="text-sm font-black">あつ杯テーマ EASY 耳確認</h3>
        </div>
        <span class="shrink-0 rounded-full bg-amber-400/20 px-2 py-1 text-[8px] font-black text-amber-100">制作ツール内</span>
      </div>
      <p class="mt-2 text-[8px] leading-relaxed text-slate-200">通常のテストモード選択はこの制作エディタより上に残しています。ここはEASY候補を編集・耳確認する時だけ使います。</p>
      <div data-rhythm-ear-review-nav class="mt-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-950/35 p-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <b class="text-[10px] text-fuchsia-100">耳確認22点ナビ</b>
            <p class="text-[8px] leading-relaxed text-fuchsia-200/80">近い候補をまとめた16区間を順番にループ再生します。</p>
          </div>
          <span data-rhythm-ear-review-count class="shrink-0 rounded-full bg-fuchsia-400/15 px-2 py-1 text-[8px] font-black text-fuchsia-100">読込中</span>
        </div>
        <p data-rhythm-ear-review-detail class="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[9px] font-black text-white">candidate v2-reviewを読み込み中…</p>
        <div data-rhythm-ear-review-candidates class="mt-1 space-y-1 rounded-lg bg-black/20 p-2 text-[8px] text-slate-200"></div>
        <div class="mt-2 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-ear-review-prev class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">◀ 前の区間</button>
          <button type="button" data-rhythm-ear-review-next class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">次の区間 ▶</button>
        </div>
        <div class="mt-1 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-ear-review-play class="min-h-[46px] rounded-lg bg-fuchsia-700 text-[9px] font-black">▶ この区間をループ再生</button>
          <button type="button" data-rhythm-ear-review-stop class="min-h-[46px] rounded-lg bg-slate-900 text-[9px] font-black">■ 停止</button>
        </div>
        <details class="mt-2 rounded-lg border border-white/10 bg-slate-950/50 p-2">
          <summary class="min-h-[44px] cursor-pointer py-3 text-[9px] font-black text-cyan-100">候補ごとの採否を入力</summary>
          <div class="grid grid-cols-2 gap-1">
            <button type="button" data-rhythm-ear-candidate-prev class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">◀ 前の候補</button>
            <button type="button" data-rhythm-ear-candidate-next class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">次の候補 ▶</button>
          </div>
          <p data-rhythm-ear-candidate-current class="mt-1 rounded bg-black/30 p-2 text-[9px] font-black text-white">候補読込中…</p>
          <div class="mt-1 grid grid-cols-2 gap-1">
            <button type="button" data-review-decision="KEEP" class="min-h-[44px] rounded-lg bg-emerald-700 text-[9px] font-black">採用</button>
            <button type="button" data-review-decision="DROP" class="min-h-[44px] rounded-lg bg-rose-800 text-[9px] font-black">削除</button>
            <button type="button" data-review-decision="SHIFT_PREVIOUS_GRID" class="min-h-[44px] rounded-lg bg-amber-700 text-[9px] font-black">前へ1grid</button>
            <button type="button" data-review-decision="SHIFT_NEXT_GRID" class="min-h-[44px] rounded-lg bg-amber-700 text-[9px] font-black">後ろへ1grid</button>
            <button type="button" data-review-decision="PENDING" class="col-span-2 min-h-[44px] rounded-lg bg-slate-700 text-[9px] font-black">保留</button>
          </div>
          <div class="mt-2 grid grid-cols-2 gap-1">
            <button type="button" data-rhythm-ear-copy-review class="min-h-[46px] rounded-lg bg-sky-700 text-[9px] font-black">レビューJSONコピー</button>
            <button type="button" data-rhythm-ear-apply-preview class="min-h-[46px] rounded-lg bg-violet-700 text-[9px] font-black">v2レビュー譜面を仮適用</button>
          </div>
          <textarea data-rhythm-ear-review-output readonly class="mt-1 h-28 w-full rounded-lg bg-black/40 p-2 font-mono text-[8px] text-slate-200" aria-label="レビュー結果JSON"></textarea>
        </details>
        <p data-rhythm-ear-review-status class="mt-1 text-[8px] leading-relaxed text-fuchsia-100">採用・移動・不採用はここでは保存しません。</p>
      </div>
      <p data-rhythm-review-current class="mt-2 rounded-lg bg-cyan-950/50 px-2 py-1.5 text-[8px] leading-relaxed text-cyan-100">現在の確認対象を読み込み中…</p>
    `;
    editor.prepend(guide);
    return guide;
  };

  const refreshEarNav=editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav)return;
    const count=nav.querySelector('[data-rhythm-ear-review-count]');
    const detail=nav.querySelector('[data-rhythm-ear-review-detail]');
    const prev=nav.querySelector('[data-rhythm-ear-review-prev]');
    const next=nav.querySelector('[data-rhythm-ear-review-next]');
    const play=nav.querySelector('[data-rhythm-ear-review-play]');
    const track=editor.querySelector('[data-rhythm-chart-track]')?.value;
    const ready=earPlan&&track==='atsu_cup_theme';
    [prev,next,play].forEach(button=>{if(button)button.disabled=!ready;});
    if(!earPlan){setText(count,'読込中');setText(detail,'candidate v2-reviewを読み込み中…');return;}
    if(track!=='atsu_cup_theme'){setText(count,'対象外');setText(detail,'あつ杯テーマ EASY を選択すると耳確認ナビを使えます');return;}
    earIndex=Math.max(0,Math.min(earIndex,earPlan.groups.length-1));
    const group=earPlan.groups[earIndex];
    setText(count,`${earIndex+1} / ${earPlan.groups.length}`);
    setText(detail,`${formatTime(group.startMs)}–${formatTime(group.endMs)}　候補 grid ${group.points.join(', ')}`);
    const list=nav.querySelector('[data-rhythm-ear-review-candidates]');
    const listSignature=group.candidates.map(row=>`${row.grid}:${row.sourcePeakOffsetMs}:${row.sourceStrength}:${row.machineRecommendation}`).join('|');
    // body全体のchildList監視内から呼ばれるため、同じ候補を毎回作り直すと
    // replaceChildren自身を再検知して無限再描画になる。区間が変わった時だけ更新する。
    if(list&&list.dataset.rhythmEarCandidateSignature!==listSignature){
      list.dataset.rhythmEarCandidateSignature=listSignature;
      list.replaceChildren(...group.candidates.map(row=>{const p=document.createElement('p');p.textContent=`grid ${row.grid}　${Number(row.sourcePeakOffsetMs)>=0?'+':''}${row.sourcePeakOffsetMs}ms　strength ${Number(row.sourceStrength).toFixed(2)}　${row.machineRecommendation}`;return p;}));
    }
    refreshCandidate(editor);
  };
  const allCandidates=()=>earPlan?earPlan.groups.flatMap(group=>group.candidates):[];
  const currentCandidate=()=>allCandidates()[candidateIndex]||null;
  const reviewExport=()=>({trackId:'atsu_cup_theme',difficulty:'EASY',candidateVersion:2,status:'HUMAN_REVIEW_IN_PROGRESS',decisions:allCandidates().map(row=>{const decision=reviewDecisions.get(row.grid)||'PENDING';return {grid:row.grid,decision,targetGrid:decision==='SHIFT_PREVIOUS_GRID'?row.grid-1:decision==='SHIFT_NEXT_GRID'?row.grid+1:null};})});
  const refreshCandidate=editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]'),rows=allCandidates();
    if(!nav||!rows.length)return;
    candidateIndex=Math.max(0,Math.min(candidateIndex,rows.length-1));
    const row=rows[candidateIndex],decision=reviewDecisions.get(row.grid)||'PENDING';
    setText(nav.querySelector('[data-rhythm-ear-candidate-current]'),`${candidateIndex+1} / ${rows.length}　grid ${row.grid}　${row.timeLabel}　推奨 ${row.machineRecommendation}　入力 ${decision}`);
    nav.querySelectorAll('[data-review-decision]').forEach(button=>{button.setAttribute('aria-pressed',button.dataset.reviewDecision===decision?'true':'false');button.style.outline=button.dataset.reviewDecision===decision?'2px solid white':'';});
    const output=nav.querySelector('[data-rhythm-ear-review-output]');if(output)output.value=JSON.stringify(reviewExport(),null,2);
  };
  const applyReviewPreview=editor=>{
    if(!earPlan)return;
    const additions=[];
    allCandidates().forEach(row=>{const decision=reviewDecisions.get(row.grid)||'PENDING';if(decision==='KEEP')additions.push({...row.proposedNote});if(decision==='SHIFT_PREVIOUS_GRID'||decision==='SHIFT_NEXT_GRID'){const shift=decision==='SHIFT_PREVIOUS_GRID'?-1:1;additions.push({...row.proposedNote,grid:row.grid+shift});}});
    const notes=[...earPlan.candidate.notes.map(note=>({...note})),...additions].sort((a,b)=>Number(a.grid)-Number(b.grid));
    editor.dispatchEvent(new CustomEvent('rhythm-chart-load-review-preview',{detail:{trackId:'atsu_cup_theme',notes,label:`v2レビュー仮適用: v1 78 + 採用/移動 ${additions.length}（保留は追加なし）`}}));
  };
  const stopEarLoop=editor=>{
    const player=editor.querySelector('[data-rhythm-chart-audio]');
    const loopToggle=editor.querySelector('[data-rhythm-loop-toggle]');
    player?.pause();
    if(loopToggle?.getAttribute('aria-pressed')==='true')loopToggle.click();
  };
  const playEarGroup=async editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]');
    const status=nav?.querySelector('[data-rhythm-ear-review-status]');
    const player=editor.querySelector('[data-rhythm-chart-audio]');
    const setStart=editor.querySelector('[data-rhythm-loop-set-start]');
    const setEnd=editor.querySelector('[data-rhythm-loop-set-end]');
    const loopToggle=editor.querySelector('[data-rhythm-loop-toggle]');
    if(!earPlan||!player||!setStart||!setEnd||!loopToggle){setText(status,'区間ループUIの準備待ちです');return;}
    const group=earPlan.groups[earIndex];
    if(!group||!Number.isFinite(group.startMs)||!Number.isFinite(group.endMs)){setText(status,'この区間の時刻を取得できません');return;}
    stopEarLoop(editor);
    player.currentTime=Math.max(0,group.startMs/1000);setStart.click();
    player.currentTime=Math.max(0,group.endMs/1000);setEnd.click();
    player.currentTime=Math.max(0,group.startMs/1000);
    if(loopToggle.getAttribute('aria-pressed')!=='true')loopToggle.click();
    try{await player.play();setText(status,`${earIndex+1}/${earPlan.groups.length} をループ再生中。聞き終わったら停止→次の区間へ。`);}
    catch(_e){setText(status,'再生を開始できませんでした。もう一度「ループ再生」を押してください。');}
  };
  const bindEarNav=editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav||nav.dataset.bound==='true')return;
    nav.dataset.bound='true';
    nav.querySelector('[data-rhythm-ear-review-prev]')?.addEventListener('click',()=>{stopEarLoop(editor);if(earPlan){earIndex=(earIndex-1+earPlan.groups.length)%earPlan.groups.length;candidateIndex=Math.max(0,allCandidates().findIndex(row=>row.grid===earPlan.groups[earIndex].points[0]));}refreshEarNav(editor);});
    nav.querySelector('[data-rhythm-ear-review-next]')?.addEventListener('click',()=>{stopEarLoop(editor);if(earPlan){earIndex=(earIndex+1)%earPlan.groups.length;candidateIndex=Math.max(0,allCandidates().findIndex(row=>row.grid===earPlan.groups[earIndex].points[0]));}refreshEarNav(editor);});
    nav.querySelector('[data-rhythm-ear-review-play]')?.addEventListener('click',()=>playEarGroup(editor));
    nav.querySelector('[data-rhythm-ear-review-stop]')?.addEventListener('click',()=>{stopEarLoop(editor);setText(nav.querySelector('[data-rhythm-ear-review-status]'),'停止しました。採否はまだ保存していません。');});
    nav.querySelector('[data-rhythm-ear-candidate-prev]')?.addEventListener('click',()=>{const rows=allCandidates();if(rows.length)candidateIndex=(candidateIndex-1+rows.length)%rows.length;refreshCandidate(editor);});
    nav.querySelector('[data-rhythm-ear-candidate-next]')?.addEventListener('click',()=>{const rows=allCandidates();if(rows.length)candidateIndex=(candidateIndex+1)%rows.length;refreshCandidate(editor);});
    nav.querySelectorAll('[data-review-decision]').forEach(button=>button.addEventListener('click',()=>{const row=currentCandidate();if(!row)return;reviewDecisions.set(row.grid,button.dataset.reviewDecision);refreshCandidate(editor);}));
    nav.querySelector('[data-rhythm-ear-copy-review]')?.addEventListener('click',async()=>{const text=JSON.stringify(reviewExport(),null,2),output=nav.querySelector('[data-rhythm-ear-review-output]');if(output)output.value=text;try{await navigator.clipboard.writeText(text);setText(nav.querySelector('[data-rhythm-ear-review-status]'),'レビュー結果JSONをコピーしました');}catch{output?.focus();output?.select();setText(nav.querySelector('[data-rhythm-ear-review-status]'),'下のJSON欄を長押ししてコピーしてください');}});
    nav.querySelector('[data-rhythm-ear-apply-preview]')?.addEventListener('click',()=>{applyReviewPreview(editor);setText(nav.querySelector('[data-rhythm-ear-review-status]'),'レビュー結果をDEBUGプレビューへ仮適用しました。上の候補セット→テストプレイを直接押してください。');});
    const track=editor.querySelector('[data-rhythm-chart-track]');
    if(track&&track.dataset.earReviewBound!=='true'){
      track.dataset.earReviewBound='true';
      track.addEventListener('change',()=>{stopEarLoop(editor);refreshEarNav(editor);});
    }
    loadEarPlan().then(()=>refreshEarNav(editor)).catch(error=>{
      setText(nav.querySelector('[data-rhythm-ear-review-count]'),'読込失敗');
      setText(nav.querySelector('[data-rhythm-ear-review-detail]'),'耳確認candidateを読み込めませんでした');
      setText(nav.querySelector('[data-rhythm-ear-review-status]'),`確認データエラー: ${error.message||error}`);
    });
  };
  const refreshCurrent=editor=>{
    const target=editor.querySelector('[data-rhythm-review-current]');
    const status=editor.querySelector('[data-rhythm-chart-status]');
    if(!target||!status)return;
    const text=(status.textContent||'').trim();
    setText(target,text?`現在: ${text}`:'現在の確認対象を読み込み中…');
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
  const bindDirectPreviewStart=(root,editor)=>{
    const preview=editor.querySelector('[data-rhythm-chart-preview]');
    if(!preview||preview.dataset.rhythmDirectStartBound==='true')return;
    preview.dataset.rhythmDirectStartBound='true';
    setText(preview,'① EASY候補をテスト欄へセット');
    preview.addEventListener('click',event=>{
      // iPhone Safariで音声開始のユーザー操作権限を失わないよう、ここではゲーム開始を自動clickしない。
      // EASY候補の選択だけ済ませ、本物の「テストプレイ」はユーザー自身の次のタップで開始する。
      event.preventDefault();
      event.stopImmediatePropagation();
      if(preview.disabled)return;
      const difficultySelect=findSelectWithLabels(root,['EASY','NORMAL','HARD','EXPERT','MASTER']);
      const songSelect=findSelectWithLabels(root,['あつ杯テーマ','WIDTH TEST']);
      const status=editor.querySelector('[data-rhythm-chart-status]');
      const audio=editor.querySelector('[data-rhythm-chart-audio]');
      if(!songSelect){setText(status,'曲選択欄を取得できません。上の曲一覧を一度操作してから再試行してください');return;}
      audio?.pause();
      if(difficultySelect)dispatchValue(difficultySelect,'EASY');
      dispatchValue(songSelect,PREVIEW_SONG_ID,PREVIEW_LABEL);
      const startButton=[...root.querySelectorAll('button')].find(button=>!button.closest('[data-rhythm-chart-authoring-ui]')&&/テストプレイ/.test(button.textContent||''));
      if(!startButton){setText(status,'EASY候補をセットしました。上の「テストプレイ」を直接押してください');return;}
      setText(status,'EASY候補をセットしました。黄色枠の「テストプレイ」を直接押してください');
      startButton.dataset.rhythmDirectPreviewReady='true';
      startButton.style.outline='3px solid #fbbf24';
      startButton.style.outlineOffset='3px';
      startButton.style.boxShadow='0 0 18px rgba(251,191,36,.75)';
      try{startButton.scrollIntoView({behavior:'smooth',block:'center'});}catch(_e){}
      try{startButton.focus({preventScroll:true});}catch(_e){}
      startButton.addEventListener('click',()=>{
        startButton.removeAttribute('data-rhythm-direct-preview-ready');
        startButton.style.outline='';
        startButton.style.outlineOffset='';
        startButton.style.boxShadow='';
      },{once:true});
    },true);
  };

  const placeProductionToolsAfterTests=(root,editor)=>{
    // React管理の曲/難易度セクションには触れず、外付け制作ツールだけを末尾へ送る。
    // これにより画面を開いた直後から通常の「リズムテストプレイ」を選べる。
    const analysis=root.querySelector(':scope > [data-rhythm-authoring]');
    if(analysis&&analysis.nextElementSibling!==editor)root.appendChild(analysis);
    if(editor.parentElement===root&&editor!==root.lastElementChild)root.appendChild(editor);
  };
  const layout=()=>{
    const root=document.querySelector('[data-rhythm-debug]');
    const editor=root?.querySelector(':scope > [data-rhythm-chart-authoring-ui]');
    if(!root||!editor){
      currentEditor=null;currentRoot=null;
      statusObserver?.disconnect();statusObserver=null;
      return false;
    }
    ensureNoteVisibilityStyle();
    if(currentEditor&&currentEditor!==editor){statusObserver?.disconnect();statusObserver=null;}
    currentEditor=editor;currentRoot=root;
    if(root.dataset.rhythmReviewScrollFixed!=='true'){
      root.dataset.rhythmReviewScrollFixed='true';
      root.style.scrollPaddingTop='calc(56px + env(safe-area-inset-top))';
      root.style.overscrollBehaviorY='contain';
      root.scrollTop=0;
    }
    placeProductionToolsAfterTests(root,editor);
    ensureGuide(editor);
    bindEarNav(editor);
    bindDirectPreviewStart(root,editor);
    refreshCurrent(editor);
    refreshEarNav(editor);
    const status=editor.querySelector('[data-rhythm-chart-status]');
    if(!statusObserver&&status){
      statusObserver=new MutationObserver(()=>refreshCurrent(editor));
      statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
    }
    return true;
  };

  const observer=new MutationObserver(()=>{
    // プレイ中はDOMを並べ替えない。デバッグ一覧へ戻った時だけ補助UIを整える。
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    layout();
  });
  const start=()=>{ensureNoteVisibilityStyle();layout();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
