// 音ゲーデバッグ STEP6 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-08-31 16:33';
  const RHYTHM_DATA_BUILD='2026-08-31 16:33';
  const RHYTHM_COMPILED_BUILD='2026-08-31 10:17';
  const RHYTHM_RELEASE_TITLE='音ゲーデバッグのSLIDE帯の残り表示を修正';

  const rhythmSlideRemainingRatio=(startMs,endMs,chartNowMs)=>{
    const start=Number(startMs)||0,end=Number(endMs)||start,now=Number(chartNowMs);
    if(!Number.isFinite(now))return 1;
    return Math.max(0,Math.min(1,(end-now)/Math.max(1,end-start)));
  };
  const installRhythmSlideRemainingVisual=()=>{
    if(typeof document==='undefined'||typeof requestAnimationFrame!=='function'||typeof RHYTHM_GESTURE_RUNTIME==='undefined')return;
    const runtime=RHYTHM_GESTURE_RUNTIME;
    if(runtime.__mhSlideRemainingVisual||!runtime._sessions||typeof runtime.bind!=='function')return;
    const originalBind=runtime.bind.bind(runtime),timings=new WeakMap();
    let raf=0;
    const nowPerf=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
    const clearVisibleHeights=()=>document.querySelectorAll('[data-rhythm-slide-body]').forEach(body=>body.style.removeProperty('--rhythm-slide-visible-height'));
    const update=()=>{
      raf=0;
      const active=new Map();
      for(const session of runtime._sessions.values()){
        if(session?.kind!=='SLIDE'||!session.note||session.note.done)continue;
        const timing=timings.get(session.note)||{start:Number(session.note.timeMs)||0,end:Number(session.note.endTimeMs)||Number(session.note.timeMs)||0};
        const chartNow=(Number(session.startSongMs)||0)+Math.max(0,nowPerf()-(Number(session.startPerfMs)||0))-(Number(session.offsetMs)||0);
        active.set(Number(session.note.index),{remaining:rhythmSlideRemainingRatio(timing.start,timing.end,chartNow)});
      }
      if(!active.size){clearVisibleHeights();return;}
      if(!document.querySelector('[data-rhythm-pause-menu]')){
        const area=document.querySelector('[data-rhythm-play-area]');
        if(area){
          const notes=Array.from(area.querySelectorAll('[data-rhythm-note]'));
          notes.forEach((el,domIndex)=>{
            const body=el.querySelector('[data-rhythm-slide-body]');
            if(!body)return;
            const attr=Number(el.dataset.rhythmNoteIndex??el.dataset.noteIndex),noteIndex=Number.isInteger(attr)?attr:domIndex,state=active.get(noteIndex);
            if(!state){body.style.removeProperty('--rhythm-slide-visible-height');return;}
            const computed=getComputedStyle(body),base=parseFloat(body.style.getPropertyValue('--rhythm-slide-height'))||parseFloat(computed.getPropertyValue('--rhythm-slide-height'))||parseFloat(computed.height)||0;
            body.style.setProperty('--rhythm-slide-visible-height',`${Math.max(0,base*state.remaining).toFixed(2)}px`);
          });
        }
      }
      raf=requestAnimationFrame(update);
    };
    const ensure=()=>{if(!raf)raf=requestAnimationFrame(update);};
    runtime.bind=(inputKeyValue,note,kind,startSongMs,offsetMs)=>{
      if(kind==='SLIDE'&&note)timings.set(note,{start:Number(note.timeMs)||0,end:Number(note.endTimeMs)||Number(note.timeMs)||0});
      const result=originalBind(inputKeyValue,note,kind,startSongMs,offsetMs);
      if(kind==='SLIDE')ensure();
      return result;
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
        'HARDデバッグのSLIDEで、押している間も紫の帯が固定長のまま残り、終端が判定ラインへ近づいて見えない問題を修正しました。',
        'SLIDE開始後は残り時間率に合わせて帯の表示高さを毎フレーム縮め、消化済み部分を残さず、残りの終端が時間と一緒に判定ラインへ降りてくる表示にしました。',
        'SLIDEの入力判定・追従レーン・譜面・スコア計算には変更を加えていません。'
      ]
    });
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。SLIDEは押し始めた後、残り時間に合わせて紫の帯が短くなり、残りの終端が判定ラインへ近づく表示になります。入力判定はこれまでどおり指位置とSLIDE経路を照合します。iPhone Safariのポーズ画面は「再開」「リスタート」「中断して音ゲーデバッグへ戻る」をtouchendのcapture段階で処理します。'}];
  }
})();
