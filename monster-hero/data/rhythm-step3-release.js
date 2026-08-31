// 音ゲーデバッグ STEP7 以降の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ対象buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は対象buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-08-31 18:25';
  const RHYTHM_DATA_BUILD='2026-08-31 18:25';
  const RHYTHM_COMPILED_BUILD='2026-08-31 18:25';
  const RHYTHM_RELEASE_TITLE='音ゲーの奥行きとレーン位置を再調整';
  const RHYTHM_NOTE_SE_DATE='2026-08-31 21:39';
  const RHYTHM_NOTE_SE_TITLE='音ゲーに仮のノーツヒットSEを追加';

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

  if(typeof CHANGELOG!=='undefined'){
    if(!CHANGELOG.some(entry=>entry?.title===RHYTHM_RELEASE_TITLE)){
      CHANGELOG.unshift({
        date:RHYTHM_RELEASE_DATE,type:'update',title:RHYTHM_RELEASE_TITLE,status:'new',releaseFlag:'rhythmMode',
        items:[
          'レーン上端の収束と奥のノーツの縮小、判定ラインへ近づくほど加速して迫る動きをもう一段階強めました。',
          'レーン描画をプレイエリア全体の座標へ統一し、TAP／FLICK／HOLD／SLIDEと帯、判定ライン、タッチ判定を同じ投影中心へ揃えました。'
        ]
      });
    }
    if(!CHANGELOG.some(entry=>entry?.title===RHYTHM_NOTE_SE_TITLE)){
      CHANGELOG.unshift({
        date:RHYTHM_NOTE_SE_DATE,type:'update',title:RHYTHM_NOTE_SE_TITLE,status:'new',releaseFlag:'rhythmMode',
        items:['TAP／HOLD／FLICK／SLIDEの開始入力が正常にノーツを取得したときだけ、短い仮SEが鳴るようにしました。空打ちでは鳴らず、既存の音ゲー設定にあるノーツSE ON/OFFと音量を反映します。']
      });
    }
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDE、WIDTH TESTの幅1〜4 TAP／HOLDを確認できます。操作表示は5メインレーンで、可変幅TAP／HOLDは10サブレーン単位で配置・入力します。SLIDE／FLICKの可変幅はまだ未対応です。レーン境界、ノーツ、HOLD／SLIDE帯、判定ライン、タッチ判定は同じ遠近座標へ揃えています。HOLDとSLIDEは開始位置で押したあと、終端バーが判定ラインへ来たタイミングで指を離します。SLIDEは途中もslidePointsに沿って追従します。ノーツの開始入力を正常取得したときは短い仮ヒットSEが鳴り、空打ちでは鳴りません。SEは音ゲー設定のノーツSE ON/OFFと音量を反映します。'}];
  }
})();
