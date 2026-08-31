// 音ゲーデバッグ STEP7 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-09-01 07:10';
  const RHYTHM_DATA_BUILD='2026-09-01 07:10';
  const RHYTHM_COMPILED_BUILD='2026-09-01 07:10';
  const RHYTHM_RELEASE_TITLE='バックアップファイル保存を本体UIへ統合';

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

  // STEP 2A.6: HOLD / SLIDE を正常な終端判定幅内で離したときも、
  // 既存の仮ノーツSEを1回鳴らす。window capture は rhythm-mode.js の
  // document capture より先に走るため、release() がsessionを削除する前に判定する。
  const installRhythmReleaseNoteSe=()=>{
    if(typeof window==='undefined'||typeof RHYTHM_GESTURE_RUNTIME==='undefined'||typeof RHYTHM_NOTE_SE_RUNTIME==='undefined')return;
    if(window.__mhRhythmReleaseNoteSe)return;
    const runtime=RHYTHM_GESTURE_RUNTIME;
    if(!runtime._sessions||typeof RHYTHM_NOTE_SE_RUNTIME.play!=='function')return;
    const nowPerf=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
    const shouldPlay=session=>{
      if(!session?.releaseRequired||session.note?.done||session.failed)return false;
      const songNow=(Number(session.startSongMs)||0)+Math.max(0,nowPerf()-(Number(session.startPerfMs)||0));
      const releaseDelta=songNow-((Number(session.releaseTargetMs)||0)+(Number(session.offsetMs)||0));
      return Number.isFinite(releaseDelta)&&Math.abs(releaseDelta)<=RHYTHM_RELEASE_MAX_MS;
    };
    const playForKey=key=>{
      const session=runtime._sessions.get(String(key));
      if(shouldPlay(session))RHYTHM_NOTE_SE_RUNTIME.play();
    };
    window.addEventListener('touchend',event=>{
      Array.from(event.changedTouches||[]).forEach(touch=>playForKey(`touch:${touch.identifier}`));
    },{capture:true,passive:true});
    window.addEventListener('pointerup',event=>{
      if(event.pointerType!=='touch')playForKey(`pointer:${event.pointerId}`);
    },true);
    Object.defineProperty(window,'__mhRhythmReleaseNoteSe',{value:true,configurable:false});
  };
  installRhythmReleaseNoteSe();

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
      date:RHYTHM_RELEASE_DATE,type:'update',title:RHYTHM_RELEASE_TITLE,status:'new',
      items:[
        'データ引き継ぎ画面のReact本体へ「バックアップファイルを保存（.mhsave）」と「バックアップファイルから復元（.mhsave）」を直接追加しました。',
        'iPhoneでは共有メニューから「ファイルに保存」を選べます。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式もそのまま維持しています。'
      ]
    });
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic)topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。レーンは上端へ強く収束し、ノーツは奥で小さく、手前へ近づくほど大きく加速して見えます。レーン境界、ノーツ、HOLD／SLIDE帯、判定ライン、タッチ判定は、プレイエリア全体を基準にした同じ遠近座標とレーン中心へ揃えています。HOLDとSLIDEは開始位置で押すだけでなく、終端のタイミングで指を離す必要があります。横長に発光する終端バーが判定ラインへ来たタイミングで指を離します。最後に指を離したタイミングも±200msでMARVELOUS〜BADを判定し、範囲外または+200msを超えて押しっぱなしの場合はMISSです。SLIDE途中はこれまでどおり指位置と経路も照合します。iPhone Safariのポーズ画面は「再開」「リスタート」「中断して音ゲーデバッグへ戻る」をtouchendのcapture段階で処理します。'}];
  }

  // データ引き継ぎの .mhsave 拡張を読み込む。保存形式は従来の引き継ぎコードと同じ。
  if(typeof document!=='undefined'&&!document.querySelector('script[data-mhsave-backup]')){
    const script=document.createElement('script');
    script.src='data/mhsave-backup.js?v=202609010649';
    script.dataset.mhsaveBackup='true';
    script.async=false;
    document.head.appendChild(script);
  }
})();
