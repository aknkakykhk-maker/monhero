// iPhone Safari でリザルト後の旧run/audio/rAFを再利用しない。
// 「もう一度プレイ」だけを外側で捕捉し、RhythmTapTest 自体を key 更新で完全再マウントする。
(()=>{
  if(typeof React==='undefined'||typeof document==='undefined'||typeof React.createElement!=='function')return;
  if(React.__mhRhythmResultReplayRemount)return;

  const originalCreateElement=React.createElement.bind(React);
  const RhythmResultReplayBoundary=({component:Component,componentProps,componentChildren})=>{
    const [runKey,setRunKey]=React.useState(0);
    React.useEffect(()=>{
      const replay=event=>{
        const button=event.target?.closest?.('[data-rhythm-result] button');
        if(!button||button.disabled||(button.textContent||'').trim()!=='もう一度プレイ')return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        if(typeof RHYTHM_GESTURE_RUNTIME!=='undefined')RHYTHM_GESTURE_RUNTIME.clear?.();
        setRunKey(value=>value+1);
      };
      document.addEventListener('click',replay,true);
      return()=>document.removeEventListener('click',replay,true);
    },[]);
    return originalCreateElement(Component,{...(componentProps||{}),key:runKey},...(componentChildren||[]));
  };

  React.createElement=(type,props,...children)=>{
    if(typeof type==='function'&&(type.name==='RhythmTapTest'||type.displayName==='RhythmTapTest')){
      return originalCreateElement(RhythmResultReplayBoundary,{component:type,componentProps:props,componentChildren:children});
    }
    return originalCreateElement(type,props,...children);
  };
  Object.defineProperty(React,'__mhRhythmResultReplayRemount',{value:true,configurable:false});
})();
