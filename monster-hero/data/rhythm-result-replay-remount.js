// iPhone Safari で旧run/audio/rAFを再利用しない。
// リザルトの「もう一度プレイ」とポーズ中の操作を外側で捕捉し、
// リスタートは RhythmTapTest 自体を key 更新で完全再マウントする。
(()=>{
  if(typeof React==='undefined'||typeof document==='undefined'||typeof React.createElement!=='function')return;
  if(React.__mhRhythmRestartRemount)return;

  const originalCreateElement=React.createElement.bind(React);
  const RhythmRestartBoundary=({component:Component,componentProps,componentChildren})=>{
    const [runKey,setRunKey]=React.useState(0);
    React.useEffect(()=>{
      let lastPauseTouchAt=0;
      let lastPauseButton=null;
      let bridgingPauseClick=false;
      // ポーズの3ボタンは data-rhythm-pause-* で見分ける。
      // 以前は表示中の文字で見分けていたため、「中断して音ゲーデバッグへ戻る」を
      // 「曲えらびへ戻る」「練習をやめて曲えらびへ戻る」へ書き換えたとき橋渡しが外れ、
      // iPhoneでは戻るを押しても何も起きない状態になっていた(2026-09-05・実機の指摘)。
      // 属性なら文言を変えても外れない。属性の無い古い並びのために文言も残す。
      const buttonInfo=target=>{
        const button=target?.closest?.('button');
        if(!button||button.disabled)return null;
        const label=(button.textContent||'').trim();
        const inResult=!!button.closest?.('[data-rhythm-result]');
        const inPause=!!button.closest?.('[data-rhythm-pause-menu]');
        const isPauseRestart=inPause&&(button.hasAttribute('data-rhythm-pause-restart')||label==='リスタート');
        const isPauseResume=inPause&&(button.hasAttribute('data-rhythm-pause-resume')||label==='再開');
        const isPauseExit=inPause&&(button.hasAttribute('data-rhythm-pause-exit')||/戻る$/.test(label));
        return {
          button,label,inResult,inPause,
          isResultReplay:label==='もう一度プレイ'&&inResult,
          isPauseRestart,isPauseResume,isPauseExit,
          // どれとも見分けられないポーズ内のボタン。ここを取りこぼしても
          // 「押しても何も起きない」にはしない(下の onTouchEnd / onClick を参照)
          isPauseKnown:isPauseRestart||isPauseResume||isPauseExit,
        };
      };
      const stop=event=>{
        if(event.cancelable)event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      };
      const remount=event=>{
        stop(event);
        if(typeof RHYTHM_GESTURE_RUNTIME!=='undefined')RHYTHM_GESTURE_RUNTIME.clear?.();
        setRunKey(value=>value+1);
      };
      const bridgePauseClick=(event,info)=>{
        stop(event);
        lastPauseTouchAt=Date.now();
        lastPauseButton=info.button;
        // play area 側の touchend に click を潰される前に、元ボタンの React onClick を明示的に発火する。
        setTimeout(()=>{
          if(!info.button?.isConnected)return;
          bridgingPauseClick=true;
          try{info.button.click();}finally{bridgingPauseClick=false;}
        },0);
      };
      const onTouchEnd=event=>{
        const info=buttonInfo(event.target);
        if(!info?.inPause)return;
        // 見分けられないボタンは触らない。ここで印だけ付けると、下の onClick が
        // 「橋渡し済みのghost click」と取り違えて本物のclickまで潰してしまい、
        // そのボタンが完全に無反応になる
        if(!info.isPauseKnown)return;
        lastPauseTouchAt=Date.now();
        lastPauseButton=info.button;
        if(info.isPauseRestart){
          // ポーズメニューはプレイエリア内。iPhone Safariでは既存touchendがclickを消すため、
          // capture段階で旧runを破棄して直接再マウントする。
          remount(event);
          return;
        }
        if(info.isPauseResume||info.isPauseExit)bridgePauseClick(event,info);
      };
      const onClick=event=>{
        if(bridgingPauseClick)return;
        const info=buttonInfo(event.target);
        if(!info)return;
        // touchendを橋渡しした直後のghost clickは二重実行させない。
        if(info.inPause&&info.isPauseKnown&&info.button===lastPauseButton&&Date.now()-lastPauseTouchAt<800){
          stop(event);
          return;
        }
        if(info.isResultReplay||info.isPauseRestart)remount(event);
      };
      document.addEventListener('touchend',onTouchEnd,true);
      document.addEventListener('click',onClick,true);
      return()=>{
        document.removeEventListener('touchend',onTouchEnd,true);
        document.removeEventListener('click',onClick,true);
      };
    },[]);
    return originalCreateElement(Component,{...(componentProps||{}),key:runKey},...(componentChildren||[]));
  };

  React.createElement=(type,props,...children)=>{
    if(typeof type==='function'&&(type.name==='RhythmTapTest'||type.displayName==='RhythmTapTest')){
      return originalCreateElement(RhythmRestartBoundary,{component:type,componentProps:props,componentChildren:children});
    }
    return originalCreateElement(type,props,...children);
  };
  Object.defineProperty(React,'__mhRhythmRestartRemount',{value:true,configurable:false});
})();
