// DEBUG ONLY: 音ゲー確認者向けの簡易表示。
// 制作機能は削除せず折りたたみへ収納し、普段の実機確認で触る項目だけを前面に出す。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmReviewMode==='ready')return;
  document.documentElement.dataset.rhythmReviewMode='ready';

  const EAR_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v1.json';
  const EAR_GROUP_GAP_GRIDS=24;
  const EAR_LOOP_PADDING_GRIDS=8;
  let currentEditor=null;
  let statusObserver=null;
  let earPlanPromise=null;
  let earPlan=null;
  let earIndex=0;

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
    return Number(candidate.beatZeroMs)||0+grid*(60000/(Number(candidate.bpm)||169)/(Number(candidate.subdivisionsPerBeat)||4));
  };
  const buildEarGroups=candidate=>{
    const reviews=Array.isArray(candidate?.earReviewGrids)?candidate.earReviewGrids.map(Number).filter(Number.isFinite):[];
    if(candidate?.trackId!=='atsu_cup_theme'||candidate?.difficulty!=='EASY'||candidate?.reviewRequired!==true||candidate?.runtimeConnected!==false||reviews.length!==22)return null;
    const sorted=[...reviews].sort((a,b)=>a-b);
    if(sorted.some((grid,index)=>grid!==reviews[index])||new Set(sorted).size!==sorted.length)return null;
    const groups=[];
    sorted.forEach(grid=>{
      const current=groups[groups.length-1];
      if(!current||grid-current.points[current.points.length-1]>EAR_GROUP_GAP_GRIDS)groups.push({points:[grid]});
      else current.points.push(grid);
    });
    groups.forEach(group=>{
      group.startGrid=Math.max(0,group.points[0]-EAR_LOOP_PADDING_GRIDS);
      group.endGrid=group.points[group.points.length-1]+EAR_LOOP_PADDING_GRIDS;
      group.startMs=timingAtGrid(candidate,group.startGrid);
      group.endMs=timingAtGrid(candidate,group.endGrid);
    });
    return groups.length===16?{candidate,groups}:null;
  };
  const loadEarPlan=()=>{
    if(earPlanPromise)return earPlanPromise;
    earPlanPromise=fetch(EAR_CANDIDATE_URL,{cache:'no-store'})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
      .then(candidate=>{
        const plan=buildEarGroups(candidate);
        if(!plan)throw new Error('candidate v1の耳確認22点と一致しません');
        earPlan=plan;
        return plan;
      })
      .catch(error=>{earPlan=null;throw error;});
    return earPlanPromise;
  };

  const ensureGuide=editor=>{
    let guide=editor.querySelector('[data-rhythm-review-guide]');
    if(guide)return guide;
    guide=document.createElement('section');
    guide.dataset.rhythmReviewGuide='';
    guide.className='mb-3 rounded-2xl border border-amber-300/50 bg-amber-950/35 p-3 text-white';
    guide.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <div>
          <small class="text-[8px] font-black tracking-wider text-amber-300">今回ここだけ確認</small>
          <h3 class="text-base font-black">あつ杯テーマ EASY 実機確認</h3>
        </div>
        <span class="shrink-0 rounded-full bg-amber-400/20 px-2 py-1 text-[8px] font-black text-amber-100">確認用</span>
      </div>
      <div class="mt-2 rounded-xl bg-black/25 p-2 text-[9px] leading-relaxed text-slate-100">
        <b>やること</b>
        <ol class="mt-1 list-decimal space-y-1 pl-4">
          <li>下のオレンジ色「現在のEASY譜面をテストプレイ」を押す</li>
          <li>まずは <b>0 ms</b> のまま1曲プレイする</li>
          <li>音とノーツが気持ちよく合うか、HOLDの開始・終端が自然かを見る</li>
          <li>全体が明らかに早い/遅い時だけ −10 / ＋10 ms を試す</li>
        </ol>
      </div>
      <div data-rhythm-ear-review-nav class="mt-2 rounded-xl border border-fuchsia-300/30 bg-fuchsia-950/35 p-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <b class="text-[10px] text-fuchsia-100">耳確認22点ナビ</b>
            <p class="text-[8px] leading-relaxed text-fuchsia-200/80">近い候補をまとめた16区間を順番にループ再生します。</p>
          </div>
          <span data-rhythm-ear-review-count class="shrink-0 rounded-full bg-fuchsia-400/15 px-2 py-1 text-[8px] font-black text-fuchsia-100">読込中</span>
        </div>
        <p data-rhythm-ear-review-detail class="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[9px] font-black text-white">candidate v1を読み込み中…</p>
        <div class="mt-2 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-ear-review-prev class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">◀ 前の区間</button>
          <button type="button" data-rhythm-ear-review-next class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">次の区間 ▶</button>
        </div>
        <div class="mt-1 grid grid-cols-2 gap-1">
          <button type="button" data-rhythm-ear-review-play class="min-h-[46px] rounded-lg bg-fuchsia-700 text-[9px] font-black">▶ この区間をループ再生</button>
          <button type="button" data-rhythm-ear-review-stop class="min-h-[46px] rounded-lg bg-slate-900 text-[9px] font-black">■ 停止</button>
        </div>
        <p data-rhythm-ear-review-status class="mt-1 text-[8px] leading-relaxed text-fuchsia-100">採用・移動・不採用はここでは保存しません。</p>
      </div>
      <p data-rhythm-review-current class="mt-2 rounded-lg bg-cyan-950/50 px-2 py-1.5 text-[8px] leading-relaxed text-cyan-100">現在の確認対象を読み込み中…</p>
      <p class="mt-2 text-[8px] leading-relaxed text-slate-300">音源解析・ノーツ編集・JSON/実装JSなどは通常触らなくてOKです。必要な時だけ下の「制作ツール」を開いてください。</p>
    `;
    editor.prepend(guide);
    return guide;
  };

  const refreshEarNav=editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav)return;
    const count=nav.querySelector('[data-rhythm-ear-review-count]');
    const detail=nav.querySelector('[data-rhythm-ear-review-detail]');
    const status=nav.querySelector('[data-rhythm-ear-review-status]');
    const prev=nav.querySelector('[data-rhythm-ear-review-prev]');
    const next=nav.querySelector('[data-rhythm-ear-review-next]');
    const play=nav.querySelector('[data-rhythm-ear-review-play]');
    const track=editor.querySelector('[data-rhythm-chart-track]')?.value;
    const ready=earPlan&&track==='atsu_cup_theme';
    [prev,next,play].forEach(button=>{if(button)button.disabled=!ready;});
    if(!earPlan){
      setText(count,'読込中');
      setText(detail,'candidate v1を読み込み中…');
      return;
    }
    if(track!=='atsu_cup_theme'){
      setText(count,'対象外');
      setText(detail,'あつ杯テーマ EASY を選択すると耳確認ナビを使えます');
      return;
    }
    earIndex=Math.max(0,Math.min(earIndex,earPlan.groups.length-1));
    const group=earPlan.groups[earIndex];
    setText(count,`${earIndex+1} / ${earPlan.groups.length}`);
    setText(detail,`${formatTime(group.startMs)}–${formatTime(group.endMs)}　候補 grid ${group.points.join(', ')}`);
    setText(status,'採用・移動・不採用はここでは保存しません。耳で判断するための再生補助だけです。');
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
    player.currentTime=Math.max(0,group.startMs/1000);
    setStart.click();
    player.currentTime=Math.max(0,group.endMs/1000);
    setEnd.click();
    player.currentTime=Math.max(0,group.startMs/1000);
    if(loopToggle.getAttribute('aria-pressed')!=='true')loopToggle.click();
    try{
      await player.play();
      setText(status,`${earIndex+1}/${earPlan.groups.length} をループ再生中。聞き終わったら停止→次の区間へ。`);
    }catch(_e){
      setText(status,'再生を開始できませんでした。もう一度「ループ再生」を押してください。');
    }
  };
  const bindEarNav=editor=>{
    const nav=editor.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav||nav.dataset.bound==='true')return;
    nav.dataset.bound='true';
    nav.querySelector('[data-rhythm-ear-review-prev]')?.addEventListener('click',()=>{
      stopEarLoop(editor);
      if(earPlan)earIndex=(earIndex-1+earPlan.groups.length)%earPlan.groups.length;
      refreshEarNav(editor);
    });
    nav.querySelector('[data-rhythm-ear-review-next]')?.addEventListener('click',()=>{
      stopEarLoop(editor);
      if(earPlan)earIndex=(earIndex+1)%earPlan.groups.length;
      refreshEarNav(editor);
    });
    nav.querySelector('[data-rhythm-ear-review-play]')?.addEventListener('click',()=>playEarGroup(editor));
    nav.querySelector('[data-rhythm-ear-review-stop]')?.addEventListener('click',()=>{
      stopEarLoop(editor);
      setText(nav.querySelector('[data-rhythm-ear-review-status]'),'停止しました。採否はまだ保存していません。');
    });
    const track=editor.querySelector('[data-rhythm-chart-track]');
    if(track&&track.dataset.earReviewBound!=='true'){
      track.dataset.earReviewBound='true';
      track.addEventListener('change',()=>{stopEarLoop(editor);refreshEarNav(editor);});
    }
    loadEarPlan().then(()=>refreshEarNav(editor)).catch(error=>{
      const status=nav.querySelector('[data-rhythm-ear-review-status]');
      setText(nav.querySelector('[data-rhythm-ear-review-count]'),'読込失敗');
      setText(nav.querySelector('[data-rhythm-ear-review-detail]'),'耳確認candidateを読み込めませんでした');
      setText(status,`確認データエラー: ${error.message||error}`);
    });
  };

  const refreshCurrent=editor=>{
    const target=editor.querySelector('[data-rhythm-review-current]');
    const status=editor.querySelector('[data-rhythm-chart-status]');
    if(!target||!status)return;
    const text=(status.textContent||'').trim();
    const next=text?`現在: ${text}`:'現在の確認対象を読み込み中…';
    if(target.textContent!==next)target.textContent=next;
  };

  const ensureAdvanced=editor=>{
    let details=editor.querySelector(':scope > [data-rhythm-review-advanced]');
    if(details)return details;
    details=document.createElement('details');
    details.dataset.rhythmReviewAdvanced='';
    details.className='mt-3 rounded-2xl border border-slate-600/70 bg-slate-950/70 text-white';
    details.innerHTML=`
      <summary class="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-black text-slate-200" style="touch-action:manipulation;">
        <span>🛠 制作ツールを表示</span><span class="text-[8px] font-bold text-slate-400">通常は触らなくてOK</span>
      </summary>
      <div data-rhythm-review-advanced-content class="border-t border-white/10 p-2"></div>
    `;
    editor.appendChild(details);
    return details;
  };

  const adoptAuthoringPanel=content=>{
    const root=document.querySelector('[data-rhythm-debug]');
    const analysis=root?.querySelector('[data-rhythm-authoring]');
    if(analysis&&!content.contains(analysis))content.prepend(analysis);
  };

  const placeAfter=(anchor,node)=>{
    if(!anchor||!node)return anchor;
    if(anchor.nextElementSibling!==node)anchor.insertAdjacentElement('afterend',node);
    return node;
  };

  const layout=()=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
    if(!editor){
      currentEditor=null;
      statusObserver?.disconnect();statusObserver=null;
      return false;
    }
    if(currentEditor&&currentEditor!==editor){
      statusObserver?.disconnect();statusObserver=null;
    }
    currentEditor=editor;

    const guide=ensureGuide(editor);
    bindEarNav(editor);
    const details=ensureAdvanced(editor);
    const content=details.querySelector('[data-rhythm-review-advanced-content]');
    const status=editor.querySelector('[data-rhythm-chart-status]');
    const preview=editor.querySelector('[data-rhythm-chart-preview]');
    const offset=editor.querySelector('[data-rhythm-preview-offset-ui]');
    const keep=new Set([guide,status,preview,offset,details].filter(Boolean));

    [...editor.children].forEach(child=>{
      if(!keep.has(child)&&child.parentElement===editor)content.appendChild(child);
    });
    adoptAuthoringPanel(content);

    // 確認用の要素だけを上から一定順序へ保つ。実際に順序が違う時だけDOMを動かす。
    let anchor=guide;
    anchor=placeAfter(anchor,status);
    anchor=placeAfter(anchor,preview);
    anchor=placeAfter(anchor,offset);
    placeAfter(anchor,details);
    refreshCurrent(editor);
    refreshEarNav(editor);

    if(!statusObserver&&status){
      statusObserver=new MutationObserver(()=>refreshCurrent(editor));
      statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
    }
    return true;
  };

  const observer=new MutationObserver(layout);
  const start=()=>{layout();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();