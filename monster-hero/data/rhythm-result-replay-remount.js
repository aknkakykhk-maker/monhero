// iPhone Safari で旧run/audio/rAFを再利用しない。
// リザルトの「もう一度プレイ」とポーズ中の「リスタート」を外側で捕捉し、
// RhythmTapTest 自体を key 更新で完全再マウントする。
(()=>{
  if(typeof React==='undefined'||typeof document==='undefined'||typeof React.createElement!=='function')return;
  if(React.__mhRhythmRestartRemount)return;

  const originalCreateElement=React.createElement.bind(React);
  const RhythmRestartBoundary=({component:Component,componentProps,componentChildren})=>{
    const [runKey,setRunKey]=React.useState(0);
    React.useEffect(()=>{
      let lastTouchRestartAt=0;
      const matchRestart=target=>{
        const button=target?.closest?.('button');
        if(!button||button.disabled)return null;
        const label=(button.textContent||'').trim();
        const isResultReplay=label==='もう一度プレイ'&&!!button.closest?.('[data-rhythm-result]');
        const isPauseRestart=label==='リスタート'&&!!button.closest?.('[data-rhythm-pause-menu]');
        return isResultReplay||isPauseRestart?{isResultReplay,isPauseRestart}:null;
      };
      const remount=event=>{
        if(event.cancelable)event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if(typeof RHYTHM_GESTURE_RUNTIME!=='undefined')RHYTHM_GESTURE_RUNTIME.clear?.();
        setRunKey(value=>value+1);
      };
      const onTouchEnd=event=>{
        const match=matchRestart(event.target);
        if(!match?.isPauseRestart)return;
        // ポーズメニューはプレイエリア内。iPhone Safariでは既存touchendがpreventDefaultし
        // clickが発火しないため、capture段階のtouchendで直接再マウントする。
        lastTouchRestartAt=Date.now();
        remount(event);
      };
      const onClick=event=>{
        const match=matchRestart(event.target);
        if(!match)return;
        if(match.isPauseRestart&&Date.now()-lastTouchRestartAt<800){
          if(event.cancelable)event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation?.();
          return;
        }
        remount(event);
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
