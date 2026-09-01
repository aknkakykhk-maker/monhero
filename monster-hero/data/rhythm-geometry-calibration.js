// DEBUG ONLY: 音ゲー表示座標の最終校正ガイド。
// 既存の5レーンSVG・ノーツ・入力と同じprojection helperだけを使い、通常の判定ロジックは変更しない。
const RHYTHM_CALIBRATION_DATA_BUILD='2026-09-01 13:52';
const RHYTHM_CALIBRATION_COMPILED_BUILD='2026-09-01 12:21';

(()=>{
  // data-onlyのデバッグ出荷でも更新バナーは1回だけ出す。
  // 開いたままの旧ページは新versionを検知し、更新後の新ページだけ今回buildを既存compiled buildへ橋渡しする。
  if(typeof window!=='undefined'&&typeof window.fetch==='function'&&!window.__mhRhythmCalibrationBuildBridge){
    const nativeFetch=window.fetch.bind(window);
    window.fetch=async(...args)=>{
      const response=await nativeFetch(...args);
      try{
        const input=args[0];
        const rawUrl=typeof input==='string'?input:(input&&input.url)||'';
        if(String(rawUrl).includes('version.json')&&typeof Response!=='undefined'){
          const data=await response.clone().json();
          if(data?.build===RHYTHM_CALIBRATION_DATA_BUILD){
            const headers=new Headers(response.headers);
            headers.set('content-type','application/json; charset=utf-8');
            return new Response(JSON.stringify({...data,build:RHYTHM_CALIBRATION_COMPILED_BUILD}),{
              status:response.status,statusText:response.statusText,headers
            });
          }
        }
      }catch(_e){}
      return response;
    };
    Object.defineProperty(window,'__mhRhythmCalibrationBuildBridge',{value:true,configurable:false});
  }

  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmGeometryCalibration==='ready')return;
  document.documentElement.dataset.rhythmGeometryCalibration='ready';

  const SVG_NS='http://www.w3.org/2000/svg';
  let enabled=false,currentArea=null,button=null;
  const svgEl=(tag,attrs={})=>{
    const el=document.createElementNS(SVG_NS,tag);
    Object.entries(attrs).forEach(([key,value])=>el.setAttribute(key,String(value)));
    return el;
  };
  const point=(x,y)=>`${(Number(x)*1000).toFixed(3)},${(Number(y)*1000).toFixed(3)}`;
  const projectionReady=()=>typeof rhythmProjectBoundary==='function'
    &&typeof rhythmProjectSubLaneSpan==='function'
    &&typeof rhythmProjectSlideSpan==='function'
    &&typeof rhythmClamp01==='function';

  const judgmentRatio=area=>{
    const areaRect=area.getBoundingClientRect(),line=area.querySelector('[data-rhythm-judgment-line]'),lineRect=line?.getBoundingClientRect();
    if(!(areaRect.width>0&&areaRect.height>0)||!lineRect)return .88;
    return rhythmClamp01((lineRect.top-areaRect.top+lineRect.height/2)/areaRect.height);
  };
  const quadForSpan=(spanAt,y,halfHeight)=>{
    const topY=Math.max(0,y-halfHeight),bottomY=Math.min(1,y+halfHeight),top=spanAt(topY),bottom=spanAt(bottomY);
    return [point(top.left,topY),point(top.right,topY),point(bottom.right,bottomY),point(bottom.left,bottomY)].join(' ');
  };
  const addText=(group,text,x,y,attrs={})=>{
    const label=svgEl('text',{
      x:(Number(x)*1000).toFixed(3),y:(Number(y)*1000).toFixed(3),
      'text-anchor':'middle','font-size':'22','font-weight':'900',
      'paint-order':'stroke','stroke':'#020617','stroke-width':'5','stroke-linejoin':'round',
      ...attrs
    });
    label.textContent=text;
    group.appendChild(label);
    return label;
  };
  const setGuideVisible=area=>{
    const guide=area?.querySelector(':scope > [data-rhythm-lane-svg] [data-rhythm-calibration-guide]');
    if(guide)guide.style.display=enabled?'':'none';
    if(button){
      const label=enabled?'座標校正 ON':'座標校正';
      // childListを監視しているため、同じ文字列を毎回textContentへ代入すると
      // 自分自身のMutationObserverを再発火し続けて画面遷移が固まる。実変更時だけ書き換える。
      if(button.textContent!==label)button.textContent=label;
      button.setAttribute('aria-pressed',enabled?'true':'false');
      button.dataset.active=enabled?'true':'false';
    }
  };

  const mountGuide=area=>{
    if(!area||!projectionReady())return;
    const svg=area.querySelector(':scope > [data-rhythm-lane-svg]');
    if(!svg||svg.querySelector('[data-rhythm-calibration-guide]'))return;
    const group=svgEl('g',{'data-rhythm-calibration-guide':'','pointer-events':'none'});
    group.style.display=enabled?'':'none';

    // 青=5メインレーン境界、黄=その中間の10サブレーン境界。
    for(let boundary=0;boundary<=10;boundary++){
      const main=boundary%2===0,topX=rhythmProjectBoundary(boundary/2,0),bottomX=rhythmProjectBoundary(boundary/2,1);
      group.appendChild(svgEl('line',{
        x1:(topX*1000).toFixed(3),y1:'0',x2:(bottomX*1000).toFixed(3),y2:'1000',
        stroke:main?'#22d3ee':'#fde047','stroke-opacity':main?'.92':'.78',
        'stroke-width':main?'3':'1.6','stroke-dasharray':main?'':'7 7'
      }));
    }

    const judgeY=judgmentRatio(area);
    for(const y of [.2,.4,.6,.8,judgeY]){
      group.appendChild(svgEl('line',{
        x1:(rhythmProjectBoundary(0,y)*1000).toFixed(3),y1:(y*1000).toFixed(3),
        x2:(rhythmProjectBoundary(5,y)*1000).toFixed(3),y2:(y*1000).toFixed(3),
        stroke:y===judgeY?'#f472b6':'#e2e8f0','stroke-opacity':y===judgeY?'.95':'.28',
        'stroke-width':y===judgeY?'4':'1.2','stroke-dasharray':y===judgeY?'':'5 8'
      }));
    }

    // TAP/HOLD/FLICKは同じsubLane spanを使う。幅1〜4を別位置で重ねて端を比較できるようにする。
    const widthSamples=[
      {subLane:0,width:1,y:.25,label:'T/H/F W1'},
      {subLane:2,width:2,y:.42,label:'T/H/F W2'},
      {subLane:4,width:3,y:.59,label:'T/H/F W3'},
      {subLane:6,width:4,y:.76,label:'T/H/F W4'},
    ];
    widthSamples.forEach(sample=>{
      const spanAt=y=>rhythmProjectSubLaneSpan(sample.subLane,sample.width,y);
      group.appendChild(svgEl('polygon',{
        points:quadForSpan(spanAt,sample.y,.021),fill:'#22c55e','fill-opacity':'.22',
        stroke:'#86efac','stroke-opacity':'.98','stroke-width':'2.2'
      }));
      const center=spanAt(sample.y).center;
      addText(group,sample.label,center,sample.y+.008,{fill:'#dcfce7'});
    });

    // SLIDEはhalf-lane中心を含む専用projectionを確認する。幅1〜4が紫の帯。
    const slideSamples=[
      {lane:.5,width:1,y:.31,label:'SL W1'},
      {lane:1.5,width:2,y:.48,label:'SL W2'},
      {lane:2.5,width:3,y:.65,label:'SL W3'},
      {lane:3.5,width:4,y:.82,label:'SL W4'},
    ];
    slideSamples.forEach(sample=>{
      const note={type:'SLIDE',timeMs:0,subLaneWidth:sample.width};
      const spanAt=y=>rhythmProjectSlideSpan(sample.lane,note,y,0);
      group.appendChild(svgEl('polygon',{
        points:quadForSpan(spanAt,sample.y,.013),fill:'#c084fc','fill-opacity':'.18',
        stroke:'#e9d5ff','stroke-opacity':'.94','stroke-width':'1.8'
      }));
      addText(group,sample.label,spanAt(sample.y).center,sample.y-.018,{fill:'#f3e8ff','font-size':'18'});
    });

    // 判定ライン上の10サブレーン中心。既存の入力発光とこの丸が一致するかを実機で確認する。
    for(let subLane=0;subLane<10;subLane++){
      const span=rhythmProjectSubLaneSpan(subLane,1,judgeY);
      group.appendChild(svgEl('circle',{
        cx:(span.center*1000).toFixed(3),cy:(judgeY*1000).toFixed(3),r:'7',
        fill:'#f8fafc','fill-opacity':'.96',stroke:'#f472b6','stroke-width':'3'
      }));
      addText(group,String(subLane+1),span.center,Math.min(.985,judgeY+.035),{fill:'#fdf2f8','font-size':'17'});
    }

    addText(group,'5 LANE / 10 SUB / WIDTH 1-4 / SLIDE',.5,.055,{fill:'#f8fafc','font-size':'24'});
    svg.appendChild(group);
  };

  const ensureButton=()=>{
    if(button&&button.isConnected)return button;
    button=document.createElement('button');
    button.type='button';
    button.dataset.rhythmCalibrationToggle='';
    button.textContent='座標校正';
    button.setAttribute('aria-pressed','false');
    Object.assign(button.style,{
      position:'fixed',top:'calc(env(safe-area-inset-top) + 72px)',right:'8px',zIndex:'100020',
      minWidth:'76px',minHeight:'34px',padding:'7px 10px',border:'1px solid rgba(103,232,249,.65)',
      borderRadius:'999px',background:'rgba(2,6,23,.86)',color:'#cffafe',fontSize:'11px',fontWeight:'900',
      boxShadow:'0 0 14px rgba(34,211,238,.22)',WebkitBackdropFilter:'blur(8px)',backdropFilter:'blur(8px)',
      touchAction:'manipulation',display:'none'
    });
    button.addEventListener('click',()=>{
      enabled=!enabled;
      if(currentArea)mountGuide(currentArea);
      setGuideVisible(currentArea);
    });
    document.body.appendChild(button);
    return button;
  };

  const remountGuide=area=>{
    const old=area?.querySelector(':scope > [data-rhythm-lane-svg] [data-rhythm-calibration-guide]');
    old?.remove();
    mountGuide(area);
    setGuideVisible(area);
  };
  const scan=()=>{
    const area=document.querySelector('[data-rhythm-play-area]');
    ensureButton().style.display=area?'':'none';
    if(!area){currentArea=null;return;}
    if(currentArea!==area){currentArea=area;enabled=false;}
    mountGuide(area);
    setGuideVisible(area);
  };
  const start=()=>{
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',()=>{if(currentArea)remountGuide(currentArea);},{passive:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();

// DEBUG ONLY: 譜面編集UIは通常プレイでは読み込まず、音ゲーデバッグ画面を開いた時だけ遅延読込する。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  let loaded=false;
  const load=()=>{
    if(loaded||!document.querySelector('[data-rhythm-debug]'))return;
    loaded=true;
    const script=document.createElement('script');
    script.dataset.rhythmChartAuthoringLoader='';
    script.src='debug/rhythm-chart-authoring-ui.js?v=20260901b';
    script.onerror=()=>{loaded=false;script.remove();};
    document.head.appendChild(script);
  };
  const start=()=>{
    load();
    if(!loaded)new MutationObserver(load).observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
