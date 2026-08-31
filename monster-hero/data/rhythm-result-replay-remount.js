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
      const buttonInfo=target=>{
        const button=target?.closest?.('button');
        if(!button||button.disabled)return null;
        const label=(button.textContent||'').trim();
        const inResult=!!button.closest?.('[data-rhythm-result]');
        const inPause=!!button.closest?.('[data-rhythm-pause-menu]');
        return {
          button,label,inResult,inPause,
          isResultReplay:label==='もう一度プレイ'&&inResult,
          isPauseRestart:label==='リスタート'&&inPause,
          isPauseResume:label==='再開'&&inPause,
          isPauseExit:/中断して音ゲーデバッグへ戻る/.test(label)&&inPause,
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
        if(info.inPause&&info.button===lastPauseButton&&Date.now()-lastPauseTouchAt<800){
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
