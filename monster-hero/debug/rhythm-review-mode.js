// DEBUG ONLY: 音ゲー確認者向けの簡易表示。
// React本体のデバッグ項目は並べ替えず、制作パネルだけを末尾へ回してテスト導線を上部へ保つ。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmReviewMode==='ready')return;
  document.documentElement.dataset.rhythmReviewMode='ready';

  const EAR_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v1.json';
  const EAR_GROUP_GAP_GRIDS=24;
  const EAR_LOOP_PADDING_GRIDS=8;
  let currentRoot=null,rootObserver=null,bodyObserver=null,earPlanPromise=null,earPlan=null,earIndex=0;

  const setText=(node,text)=>{if(node&&node.textContent!==text)node.textContent=text;};
  const editor=()=>currentRoot?.querySelector('[data-rhythm-chart-authoring-ui]')||document.querySelector('[data-rhythm-chart-authoring-ui]');
  const formatTime=ms=>{
    const totalTenths=Math.max(0,Math.round((Number(ms)||0)/100));
    const minutes=Math.floor(totalTenths/600),seconds=Math.floor((totalTenths%600)/10),tenths=totalTenths%10;
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
    const reviews=Array.isArray(candidate?.earReviewGrids)?candidate.earReviewGrids.map(Number).filter(Number.isFinite):[];
    if(candidate?.trackId!=='atsu_cup_theme'||candidate?.difficulty!=='EASY'||candidate?.candidateVersion!==1||candidate?.status!=='FORMAL_CANDIDATE'||candidate?.reviewRequired!==true||candidate?.runtimeConnected!==false||reviews.length!==22)return null;
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
    if(typeof fetch!=='function')return Promise.reject(new Error('fetchを利用できません'));
    earPlanPromise=fetch(EAR_CANDIDATE_URL,{cache:'no-store'})
      .then(response=>{if(!response.ok)throw new Error(`HTTP ${response.status}`);return response.json();})
      .then(candidate=>{
        const plan=buildEarGroups(candidate);
        if(!plan)throw new Error('candidate v1の耳確認22点と一致しません');
        earPlan=plan;return plan;
      })
      .catch(error=>{earPlan=null;throw error;});
    return earPlanPromise;
  };

  const ensurePanel=root=>{
    let panel=root.querySelector(':scope > [data-rhythm-review-dock]');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.dataset.rhythmReviewDock='';
    panel.className='mb-3 rounded-2xl border border-amber-300/45 bg-amber-950/35 p-2 text-white';
    panel.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0"><small class="block text-[8px] font-black text-amber-300">EASY 確認用</small><b class="block truncate text-xs">あつ杯テーマ 正式候補</b></div>
        <span class="shrink-0 rounded-full bg-amber-400/15 px-2 py-1 text-[8px] font-black text-amber-100">DEBUG</span>
      </div>
      <button type="button" data-rhythm-review-preview-proxy class="mt-2 min-h-[48px] w-full rounded-xl bg-orange-600 px-3 text-xs font-black">▶ EASY候補をテストプレイ</button>
      <p data-rhythm-review-current class="mt-1 min-h-[18px] text-[8px] leading-relaxed text-cyan-100">譜面エディタを準備中…</p>
      <details data-rhythm-ear-review-details class="mt-2 rounded-xl border border-fuchsia-300/25 bg-fuchsia-950/30">
        <summary class="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-2 text-[9px] font-black" style="touch-action:manipulation;"><span>🎧 耳確認22点ナビ</span><span data-rhythm-ear-review-count class="text-fuchsia-200">読込中</span></summary>
        <div data-rhythm-ear-review-nav class="border-t border-fuchsia-300/15 p-2">
          <p data-rhythm-ear-review-detail class="rounded-lg bg-black/25 px-2 py-1.5 text-[9px] font-black text-white">candidate v1を読み込み中…</p>
          <div class="mt-2 grid grid-cols-2 gap-1"><button type="button" data-rhythm-ear-review-prev class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">◀ 前の区間</button><button type="button" data-rhythm-ear-review-next class="min-h-[44px] rounded-lg bg-slate-800 text-[9px] font-black">次の区間 ▶</button></div>
          <div class="mt-1 grid grid-cols-2 gap-1"><button type="button" data-rhythm-ear-review-play class="min-h-[46px] rounded-lg bg-fuchsia-700 text-[9px] font-black">▶ この区間をループ再生</button><button type="button" data-rhythm-ear-review-stop class="min-h-[46px] rounded-lg bg-slate-900 text-[9px] font-black">■ 停止</button></div>
          <p data-rhythm-ear-review-status class="mt-1 text-[8px] leading-relaxed text-fuchsia-100">採用・移動・不採用はここでは保存しません。</p>
        </div>
      </details>`;
    const header=root.querySelector(':scope > header');
    if(header)header.insertAdjacentElement('afterend',panel);else root.prepend(panel);
    panel.querySelector('[data-rhythm-review-preview-proxy]')?.addEventListener('click',()=>{
      const target=editor()?.querySelector('[data-rhythm-chart-preview]');
      if(!target){setText(panel.querySelector('[data-rhythm-review-current]'),'譜面エディタ準備中です。少し待ってもう一度押してください');return;}
      target.click();
    });
    return panel;
  };

  const refreshCurrent=root=>{
    const panel=root.querySelector(':scope > [data-rhythm-review-dock]'),target=panel?.querySelector('[data-rhythm-review-current]');
    if(!target)return;
    const status=editor()?.querySelector('[data-rhythm-chart-status]');
    setText(target,status?.textContent?.trim()?`現在: ${status.textContent.trim()}`:'EASY候補テストは上のボタンから開始できます');
  };
  const refreshEarNav=root=>{
    const panel=root.querySelector(':scope > [data-rhythm-review-dock]'),nav=panel?.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav)return;
    const count=panel.querySelector('[data-rhythm-ear-review-count]'),detail=nav.querySelector('[data-rhythm-ear-review-detail]');
    const currentEditor=editor(),track=currentEditor?.querySelector('[data-rhythm-chart-track]')?.value,ready=earPlan&&track==='atsu_cup_theme';
    ['prev','next','play'].forEach(name=>{const button=nav.querySelector(`[data-rhythm-ear-review-${name}]`);if(button)button.disabled=!ready;});
    if(!earPlan){setText(count,'読込中');setText(detail,'candidate v1を読み込み中…');return;}
    if(track!=='atsu_cup_theme'){setText(count,'対象外');setText(detail,'制作ツールで「あつ杯テーマ」を選択すると使えます');return;}
    earIndex=Math.max(0,Math.min(earIndex,earPlan.groups.length-1));
    const group=earPlan.groups[earIndex];
    setText(count,`${earIndex+1} / ${earPlan.groups.length}`);
    setText(detail,`${formatTime(group.startMs)}–${formatTime(group.endMs)}　候補 grid ${group.points.join(', ')}`);
  };
  const stopEarLoop=currentEditor=>{
    const player=currentEditor?.querySelector('[data-rhythm-chart-audio]'),loopToggle=currentEditor?.querySelector('[data-rhythm-loop-toggle]');
    player?.pause();
    if(loopToggle?.getAttribute('aria-pressed')==='true')loopToggle.click();
  };
  const playEarGroup=async root=>{
    const currentEditor=editor(),nav=root.querySelector('[data-rhythm-ear-review-nav]'),status=nav?.querySelector('[data-rhythm-ear-review-status]');
    const player=currentEditor?.querySelector('[data-rhythm-chart-audio]'),setStart=currentEditor?.querySelector('[data-rhythm-loop-set-start]'),setEnd=currentEditor?.querySelector('[data-rhythm-loop-set-end]'),loopToggle=currentEditor?.querySelector('[data-rhythm-loop-toggle]');
    if(!earPlan||!player||!setStart||!setEnd||!loopToggle){setText(status,'区間ループUIの準備待ちです');return;}
    const group=earPlan.groups[earIndex];
    if(!group||!Number.isFinite(group.startMs)||!Number.isFinite(group.endMs)){setText(status,'この区間の時刻を取得できません');return;}
    stopEarLoop(currentEditor);
    player.currentTime=Math.max(0,group.startMs/1000);setStart.click();
    player.currentTime=Math.max(0,group.endMs/1000);setEnd.click();
    player.currentTime=Math.max(0,group.startMs/1000);
    if(loopToggle.getAttribute('aria-pressed')!=='true')loopToggle.click();
    try{await player.play();setText(status,`${earIndex+1}/${earPlan.groups.length} をループ再生中。聞き終わったら停止→次の区間へ。`);}
    catch(_e){setText(status,'再生を開始できませんでした。もう一度「ループ再生」を押してください。');}
  };
  const bindEarNav=root=>{
    const nav=root.querySelector('[data-rhythm-ear-review-nav]');
    if(!nav||nav.dataset.bound==='true')return;
    nav.dataset.bound='true';
    nav.querySelector('[data-rhythm-ear-review-prev]')?.addEventListener('click',()=>{stopEarLoop(editor());if(earPlan)earIndex=(earIndex-1+earPlan.groups.length)%earPlan.groups.length;refreshEarNav(root);});
    nav.querySelector('[data-rhythm-ear-review-next]')?.addEventListener('click',()=>{stopEarLoop(editor());if(earPlan)earIndex=(earIndex+1)%earPlan.groups.length;refreshEarNav(root);});
    nav.querySelector('[data-rhythm-ear-review-play]')?.addEventListener('click',()=>playEarGroup(root));
    nav.querySelector('[data-rhythm-ear-review-stop]')?.addEventListener('click',()=>{stopEarLoop(editor());setText(nav.querySelector('[data-rhythm-ear-review-status]'),'停止しました。採否はまだ保存していません。');});
    loadEarPlan().then(()=>refreshEarNav(root)).catch(error=>{setText(root.querySelector('[data-rhythm-ear-review-count]'),'読込失敗');setText(nav.querySelector('[data-rhythm-ear-review-detail]'),'耳確認candidateを読み込めませんでした');setText(nav.querySelector('[data-rhythm-ear-review-status]'),`確認データエラー: ${error.message||error}`);});
  };

  const moveProductionToolsToBottom=root=>{
    const authoring=root.querySelector(':scope > [data-rhythm-authoring]'),chartEditor=root.querySelector(':scope > [data-rhythm-chart-authoring-ui]');
    if(!authoring||!chartEditor)return;
    const children=[...root.children],tail=children.slice(-2);
    if(tail[0]!==authoring||tail[1]!==chartEditor)root.append(authoring,chartEditor);
  };
  const syncRoot=root=>{
    if(!root?.isConnected)return;
    ensurePanel(root);bindEarNav(root);moveProductionToolsToBottom(root);refreshCurrent(root);refreshEarNav(root);
    if(root.dataset.rhythmReviewScrollReset!=='true'){
      root.dataset.rhythmReviewScrollReset='true';
      requestAnimationFrame(()=>{if(root.isConnected)root.scrollTop=0;});
    }
  };
  const attach=root=>{
    if(currentRoot===root&&root?.isConnected){syncRoot(root);return;}
    rootObserver?.disconnect();rootObserver=null;currentRoot=root;
    if(!root)return;
    syncRoot(root);
    rootObserver=new MutationObserver(()=>syncRoot(root));
    rootObserver.observe(root,{childList:true});
  };
  const scan=()=>{
    const root=document.querySelector('[data-rhythm-debug]');
    if(root!==currentRoot)attach(root);
  };
  const start=()=>{
    scan();
    bodyObserver=new MutationObserver(scan);
    bodyObserver.observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
