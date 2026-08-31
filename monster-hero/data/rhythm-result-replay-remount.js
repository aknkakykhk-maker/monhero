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
      const restart=event=>{
        const button=event.target?.closest?.('button');
        if(!button||button.disabled)return;
        const label=(button.textContent||'').trim();
        const isResultReplay=label==='もう一度プレイ'&&!!button.closest?.('[data-rhythm-result]');
        const isPauseRestart=label==='リスタート'&&!!button.closest?.('[data-rhythm-pause-menu]');
        if(!isResultReplay&&!isPauseRestart)return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if(typeof RHYTHM_GESTURE_RUNTIME!=='undefined')RHYTHM_GESTURE_RUNTIME.clear?.();
        setRunKey(value=>value+1);
      };
      document.addEventListener('click',restart,true);
      return()=>document.removeEventListener('click',restart,true);
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
