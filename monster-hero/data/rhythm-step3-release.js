// 音ゲーデバッグ STEP7 の小さい出荷レイヤー。
// 旧ページは version.json の新buildを見て標準更新バナーを出す。
// 更新後のページだけ今回buildを既存compiled buildへ橋渡しし、同じバナーの無限再表示を防ぐ。
// 条件は今回buildとの完全一致だけなので、将来の別buildはそのまま検知される。
(()=>{
  const RHYTHM_RELEASE_DATE='2026-09-01 07:10';
  const RHYTHM_DATA_BUILD='2026-09-01 07:10';
  const RHYTHM_COMPILED_BUILD='2026-09-01 07:10';
  const RHYTHM_RELEASE_TITLE='iPhoneでバックアップファイル名が変わる問題を修正';

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

  // STEP 2C後の入力拡張: Touch.radiusX が取れる端末では、1本の指を中心1点ではなく
  // 横幅を持つ接触領域として扱う。中心の入力は既存game-systemへ任せ、接触領域で新しく
  // 覆ったサブレーンだけTAP補助入力する。HOLD / SLIDE / FLICKのgesture中は補助取得しない。
  const RHYTHM_TOUCH_CONTACT_MAX_SUB_LANES=3;
  const RHYTHM_TOUCH_CONTACT_RUNTIME=(()=>{
    const states=new Map();
    let syntheticPointerId=700000,activeSeGroup=null;
    const clampSubLane=value=>Math.max(0,Math.min(9,Math.trunc(Number(value)||0)));
    const contactSubLanes=(touch,rect)=>{
      const center=rhythmSubLaneCoordinateAtPoint(Number(touch?.clientX),Number(touch?.clientY),rect);
      if(!Number.isFinite(center))return [];
      const centerLane=clampSubLane(Math.floor(center)),radiusX=Number(touch?.radiusX);
      if(!Number.isFinite(radiusX)||radiusX<=0)return [centerLane];
      const left=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)-radiusX,Number(touch.clientY),rect);
      const right=rhythmSubLaneCoordinateAtPoint(Number(touch.clientX)+radiusX,Number(touch.clientY),rect);
      const values=[center];
      if(Number.isFinite(left))values.push(left);
      if(Number.isFinite(right))values.push(right);
      const lo=clampSubLane(Math.floor(Math.min(...values))),hi=clampSubLane(Math.floor(Math.max(...values))),lanes=[];
      for(let lane=lo;lane<=hi;lane++)lanes.push(lane);
      if(!lanes.includes(centerLane))lanes.push(centerLane);
      return lanes.sort((a,b)=>Math.abs(a+.5-center)-Math.abs(b+.5-center)||a-b).slice(0,RHYTHM_TOUCH_CONTACT_MAX_SUB_LANES).sort((a,b)=>a-b);
    };
    const clientXForSubLane=(subLane,clientY,rect)=>{
      if(!rect||!(Number(rect.width)>0)||!(Number(rect.height)>0))return null;
      const yRatio=rhythmClamp01((Number(clientY)-rect.top)/rect.height),nx=rhythmProjectBoundary((Number(subLane)+.5)/2,yRatio);
      return rect.left+rect.width*nx;
    };
    const finishSeGroup=group=>{
      if(!group||group.finished)return;
      group.finished=true;
      if(group.runtime.play===group.playWrapper)group.runtime.play=group.playOriginal;
      if(group.runtime.playEmpty===group.emptyWrapper)group.runtime.playEmpty=group.emptyOriginal;
      if(group.success===0&&group.empty>0)group.emptyOriginal();
      if(activeSeGroup===group)activeSeGroup=null;
    };
    const beginSeGroup=event=>{
      if(!event.target?.closest?.('[data-rhythm-play-area]'))return;
      if(activeSeGroup)finishSeGroup(activeSeGroup);
      if(typeof RHYTHM_NOTE_SE_RUNTIME==='undefined')return;
      const runtime=RHYTHM_NOTE_SE_RUNTIME;
      if(typeof runtime.play!=='function'||typeof runtime.playEmpty!=='function')return;
      const group={runtime,playOriginal:runtime.play,emptyOriginal:runtime.playEmpty,success:0,empty:0,finished:false,playWrapper:null,emptyWrapper:null};
      group.playWrapper=(...args)=>{group.success++;return group.success===1?group.playOriginal(...args):false;};
      group.emptyWrapper=()=>{group.empty++;return false;};
      runtime.play=group.playWrapper;
      runtime.playEmpty=group.emptyWrapper;
      activeSeGroup=group;
      const later=typeof queueMicrotask==='function'?queueMicrotask:fn=>Promise.resolve().then(fn);
      later(()=>{if(activeSeGroup===group)finishSeGroup(group);});
    };
    const setContactFeedback=(area,active)=>{
      const pressed=new Set(active);
      area.querySelectorAll('[data-rhythm-sublane-feedback]').forEach((el,index)=>{
        const on=pressed.has(index);
        el.dataset.pressed=on?'true':'false';
        el.style.opacity=on?'1':'0';
      });
    };
    const shouldProbeTap=(area,subLane,clientY,rect)=>{
      const line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line?.getBoundingClientRect(),x=clientXForSubLane(subLane,clientY,rect);
      if(!lineRect||!Number.isFinite(x))return false;
      const lineY=lineRect.top+lineRect.height/2,limit=Math.max(56,rect.height*.16);
      let tapDistance=Infinity,otherDistance=Infinity;
      area.querySelectorAll('[data-rhythm-note]').forEach(el=>{
        if(el.style.opacity==='0')return;
        const noteRect=el.getBoundingClientRect();
        if(!(noteRect.width>0&&noteRect.height>0))return;
        const margin=Math.max(4,noteRect.width*.08);
        if(x<noteRect.left-margin||x>noteRect.right+margin)return;
        const distance=Math.abs(noteRect.top+noteRect.height/2-lineY);
        if(distance>limit)return;
        if(el.dataset.noteType==='TAP')tapDistance=Math.min(tapDistance,distance);
        else otherDistance=Math.min(otherDistance,distance);
      });
      return Number.isFinite(tapDistance)&&tapDistance<=otherDistance+2;
    };
    const dispatchTapProbe=(area,subLane,clientY,rect)=>{
      if(typeof PointerEvent!=='function')return false;
      const clientX=clientXForSubLane(subLane,clientY,rect);
      if(!Number.isFinite(clientX))return false;
      const pointerId=syntheticPointerId++,base={bubbles:true,cancelable:true,pointerId,pointerType:'pen',isPrimary:false,clientX,clientY:Number(clientY),button:0,width:1,height:1,pressure:.5};
      area.dispatchEvent(new PointerEvent('pointerdown',{...base,buttons:1}));
      area.dispatchEvent(new PointerEvent('pointerup',{...base,buttons:0,pressure:0}));
      return true;
    };
    const syncTouchContacts=event=>{
      const area=event.target?.closest?.('[data-rhythm-play-area]');
      if(!area){if(activeSeGroup)finishSeGroup(activeSeGroup);return;}
      const rect=area.getBoundingClientRect();
      if(!(rect.width>0&&rect.height>0)){if(activeSeGroup)finishSeGroup(activeSeGroup);return;}
      const live=new Set(),active=[];
      Array.from(event.touches||[]).forEach(touch=>{
        const id=String(touch.identifier),inputKey=`touch:${id}`,lanes=contactSubLanes(touch,rect),previous=states.get(id)||new Set();
        live.add(id);
        lanes.forEach(lane=>active.push(lane));
        if(event.type==='touchstart'||event.type==='touchmove'){
          const center=rhythmSubLaneCoordinateAtPoint(touch.clientX,touch.clientY,rect),centerLane=Number.isFinite(center)?clampSubLane(Math.floor(center)):null;
          const holdingGesture=typeof RHYTHM_GESTURE_RUNTIME!=='undefined'&&RHYTHM_GESTURE_RUNTIME?._sessions?.has(inputKey);
          if(!holdingGesture){
            lanes.forEach(lane=>{
              if(lane===centerLane||previous.has(lane))return;
              if(shouldProbeTap(area,lane,touch.clientY,rect))dispatchTapProbe(area,lane,touch.clientY,rect);
              else if(typeof RHYTHM_NOTE_SE_RUNTIME!=='undefined')RHYTHM_NOTE_SE_RUNTIME.playEmpty();
            });
          }
        }
        states.set(id,new Set(lanes));
      });
      Array.from(states.keys()).forEach(id=>{if(!live.has(id))states.delete(id);});
      setContactFeedback(area,active);
      if(activeSeGroup)finishSeGroup(activeSeGroup);
    };
    if(typeof document!=='undefined'){
      document.addEventListener('touchstart',beginSeGroup,{capture:true,passive:true});
      document.addEventListener('touchmove',beginSeGroup,{capture:true,passive:true});
      document.addEventListener('touchstart',syncTouchContacts,{passive:true});
      document.addEventListener('touchmove',syncTouchContacts,{passive:true});
      document.addEventListener('touchend',syncTouchContacts,{passive:true});
      document.addEventListener('touchcancel',syncTouchContacts,{passive:true});
    }
    return {contactSubLanes,clientXForSubLane,_states:states,maxSubLanes:RHYTHM_TOUCH_CONTACT_MAX_SUB_LANES};
  })();
  if(typeof globalThis!=='undefined')globalThis.__mhRhythmTouchContactRuntime=RHYTHM_TOUCH_CONTACT_RUNTIME;

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
        'iPhoneの共有メニューへバックアップファイルだけを渡すようにし、「ファイルに保存」で名前が「テキスト」などへ変わる問題を修正しました。',
        '保存名は「MonsterHero_Backup_YYYYMMDD_HHMM.mhsave」を維持します。従来の引き継ぎコード方式と既存のmh_*セーブデータ形式は変更していません。'
      ]
    });
  }
  if(typeof CHANGELOG!=='undefined'){
    const contactText='iPhone等で接触幅を取得できる場合は、1本指で覆った隣接最大3サブレーンを同時に発光し、TAPを複数同時取得できるようにしました。HOLD／SLIDE／FLICKは従来どおり1本指1操作です。';
    const entry=CHANGELOG.find(item=>item?.releaseFlag==='rhythmMode'&&item?.title==='音ゲーの操作フィードバックを調整');
    if(entry&&Array.isArray(entry.items)&&!entry.items.includes(contactText))entry.items.push(contactText);
  }
  if(typeof HELP_CATEGORIES!=='undefined'){
    const topic=HELP_CATEGORIES.flatMap(category=>category.topics||[]).find(item=>item.id==='rhythm-mode');
    if(topic){
      topic.blocks=[{t:'p',text:'曲ごとにEASY・NORMAL・HARD・EXPERT・MASTERの5難易度を遊べる音ゲーモードです。現在は開発中で、デバッグ画面ではEASYのTAP、NORMALのHOLD・2本指入力、HARDのFLICK・SLIDEを確認できます。レーンは上端へ強く収束し、ノーツは奥で小さく、手前へ近づくほど大きく加速して見えます。レーン境界、ノーツ、HOLD／SLIDE帯、判定ライン、タッチ判定は、プレイエリア全体を基準にした同じ遠近座標とレーン中心へ揃えています。HOLDとSLIDEは開始位置で押すだけでなく、終端のタイミングで指を離す必要があります。横長に発光する終端バーが判定ラインへ来たタイミングで指を離します。最後に指を離したタイミングも±200msでMARVELOUS〜BADを判定し、範囲外または+200msを超えて押しっぱなしの場合はMISSです。SLIDE途中はこれまでどおり指位置と経路も照合します。iPhone Safariのポーズ画面は「再開」「リスタート」「中断して音ゲーデバッグへ戻る」をtouchendのcapture段階で処理します。iPhone等でTouchの接触幅を取得できる場合は、1本指で覆った隣接最大3サブレーンを同時に発光し、TAPは複数同時取得できます。接触幅が取れない端末は従来の中心1サブレーン入力へ戻り、HOLD／SLIDE／FLICKは1本指1操作のままです。'}];
    }
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