// 音ゲーデバッグ STEP7 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-08-31 17:53';
  const RHYTHM_DATA_BUILD='2026-08-31 17:53';
  const RHYTHM_COMPILED_BUILD='2026-08-31 10:17';
  const RHYTHM_RELEASE_TITLE='音ゲーデバッグのHOLD・SLIDE終端判定を追加';

  const rhythmSlideRemainingRatio=(startMs,endMs,chartNowMs)=>{
    const start=Number(startMs)||0,end=Number(endMs)||start,now=Number(chartNowMs);
    if(!Number.isFinite(now))return 1;
    return Math.max(0,Math.min(1,(end-now)/Math.max(1,end-start)));
  };
  const installRhythmSlideRemainingVisual=()=>{
    if(typeof document==='undefined'||typeof RHYTHM_GESTURE_RUNTIME==='undefined')return;
    const runtime=RHYTHM_GESTURE_RUNTIME;
    if(runtime.__mhSlideRemainingVisual||!runtime._sessions||typeof runtime.slideVisualLaneForIndex!=='function')return;
    const originalSlideVisualLaneForIndex=runtime.slideVisualLaneForIndex.bind(runtime);
    const nowPerf=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
    const bodyForIndex=index=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      return area?Array.from(area.querySelectorAll('[data-rhythm-note]'))[Number(index)]?.querySelector('[data-rhythm-slide-body]')||null:null;
    };
    const updateBody=(index)=>{
      const body=bodyForIndex(index);
      if(!body)return;
      let session=null;
      for(const candidate of runtime._sessions.values()){
        if(candidate?.kind==='SLIDE'&&Number(candidate.note?.index)===Number(index)&&!candidate.note?.done){session=candidate;break;}
      }
      if(!session){body.style.removeProperty('--rhythm-slide-visible-height');return;}
      const chartNote=typeof atsuCupGestureTestChart!=='undefined'?atsuCupGestureTestChart.notes?.[Number(index)]:null;
      const start=Number(chartNote?.timeMs??session.note?.timeMs)||0,end=Number(chartNote?.endTimeMs??session.note?.endTimeMs)||start;
      const chartNow=(Number(session.startSongMs)||0)+Math.max(0,nowPerf()-(Number(session.startPerfMs)||0))-(Number(session.offsetMs)||0);
      const remaining=rhythmSlideRemainingRatio(start,end,chartNow);
      const computed=getComputedStyle(body),base=parseFloat(body.style.getPropertyValue('--rhythm-slide-height'))||parseFloat(computed.getPropertyValue('--rhythm-slide-height'))||parseFloat(computed.height)||0;
      body.style.setProperty('--rhythm-slide-visible-height',`${Math.max(0,base*remaining).toFixed(2)}px`);
    };
    runtime.slideVisualLaneForIndex=index=>{
      const lane=originalSlideVisualLaneForIndex(index);
      updateBody(index);
      return lane;
    };
    const style=document.createElement('style');
    style.dataset.rhythmSlideRemainingVisual='';
    style.textContent='[data-rhythm-slide-body]{height:var(--rhythm-slide-visible-height,var(--rhythm-slide-height,120px))!important;transition:none!important}';
    document.head.appendChild(style);
    Object.defineProperty(runtime,'__mhSlideRemainingVisual',{value:true,configurable:false});
  };
  installRhythmSlideRemainingVisual();

  if(typeof window!=='undefined'&&typeof window.fetch==='function'&&!window.__mhRhythmDataBuildBridge){
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await nativeFetch(...args);
      try{
        const input=args[0];
        const rawUrl=typeof input==='string'?input:(input&&input.url)||'';
        if(String(rawUrl).includes('version.json')&&typeof Response!=='undefined'){
          const data=await response.clone().json();
          if(data?.build===RHYTHM_DATA_BUILD){
            const headers=new Headers(response.headers);
            headers.set('content-type','application/json; charset=utf-8');
            return new Response(JSON.stringify({...data,build:RHYTHM_COMPILED_BUILD}),{status:response.status,statusText:response.statusText,headers});
          }
        }
      }catch(_e){}
      return response;
    };
    Object.defineProperty(window,'__mhRhythmDataBuildBridge',{value:true,configurable:false});
  }

  if(typeof CHANGELOG!=='undefined'&&!CHANGELOG.some(entry=>entry?.title===RHYTHM_RELEASE_TITLE)){
    CHANGELOG.unshift({
      date:RHYTHM_RELEASE_DATE,type:'issue',title:RHYTHM_RELEASE_TITLE,status:'new',
      items:[
        'HOLDとSLIDEを、終端まで押し続けるだけでは成功せず、最後に指を離したタイミングまで判定するよう変更しました。',
        '終端の離し判定は開始時と同じ±200msの判定幅を使い、MARVELOUS / EXCELLENT / GREAT / GOOD / BAD / MISSを付けます。最終判定は開始と終了の悪い方です。',
        '終端から+200msを超えて押しっぱなしの場合もMISSになります。TAP・FLICK、SLIDE途中の追従判定、譜面・スコア計算は変更していません。'
      ]
    });
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。HOLDとSLIDEは開始位置で押すだけでなく、終端のタイミングで指を離す必要があります。終端も±200msでMARVELOUS〜BADを判定し、範囲外または+200msを超えて押しっぱなしの場合はMISSです。1ノーツの最終判定は開始と終了の悪い方を採用します。SLIDE途中はこれまでどおり指位置と経路も照合します。iPhone Safariのポーズ画面は「再開」「リスタート」「中断して音ゲーデバッグへ戻る」をtouchendのcapture段階で処理します。'}];
  }
})();
