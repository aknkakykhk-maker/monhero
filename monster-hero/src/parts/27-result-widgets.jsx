// 最終リザルト画面(CHAMPION/敗北)共通: レベルの経験値バーが直前の進捗から今回の獲得分まで伸びる演出。
// レベルを跨ぐ場合は満タンまで伸ばしてからLEVEL UPを見せ、次レベルの進捗へ切り替える
const LevelGrowthBar = ({ levelBefore, levelAfter, onComplete }) => {
  const leveledUp = levelAfter.level > levelBefore.level;
  // 累計経験値。levelInfo/bondLevelInfoが返すtotalXpをそのまま出すだけなので計算は増えない
  const totalBefore = Number(levelBefore?.totalXp);
  const totalAfter = Number(levelAfter?.totalXp);
  const hasTotals = Number.isFinite(totalBefore) && Number.isFinite(totalAfter);
  const gainedXp = hasTotals ? Math.max(0, totalAfter - totalBefore) : 0;
  const [curLevel, setCurLevel] = useState(levelBefore.level);
  const [pct, setPct] = useState(Math.max(0, Math.min(100, (levelBefore.xpIntoLevel / Math.max(1, levelBefore.xpForNext)) * 100)));
  // 次のレベルまで残り何XPかの表示。バーの伸び(pct)と同じタイミングで切り替える
  const [remain, setRemain] = useState(Math.max(0, levelBefore.xpForNext - levelBefore.xpIntoLevel));
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    const timers = [];
    if (leveledUp) {
      timers.push(setTimeout(() => setPct(100), 200));
      timers.push(setTimeout(() => { Audio_.se.levelUp(); setFlash(true); }, 900));
      timers.push(setTimeout(() => { setFlash(false); setCurLevel(levelAfter.level); setPct(0); setRemain(levelAfter.xpForNext); }, 2000));
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 2100));
      timers.push(setTimeout(() => onComplete?.(), 2800));
    } else {
      timers.push(setTimeout(() => { setPct(Math.max(0, Math.min(100, (levelAfter.xpIntoLevel / Math.max(1, levelAfter.xpForNext)) * 100))); setRemain(Math.max(0, levelAfter.xpForNext - levelAfter.xpIntoLevel)); }, 200));
      timers.push(setTimeout(() => onComplete?.(), 900));
    }
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="font-mono text-slate-300 font-bold">LV.{curLevel}</span>
        {flash ? <span className="text-amber-400 font-black animate-pulse">LEVEL UP!</span> : <span className="text-slate-500 font-mono">次Lvまで{remain.toLocaleString()}</span>}
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-white/10">
        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-700 ease-out" style={{width:`${pct}%`}}></div>
      </div>
      <div className="flex items-center justify-between text-[8px] font-mono mt-0.5 gap-2">
        <span className={leveledUp?'text-amber-300 font-black shrink-0':'text-slate-500 shrink-0'}>Lv.{levelBefore.level} → Lv.{levelAfter.level}</span>
        {hasTotals&&<span className="text-slate-500 truncate">累計 {totalBefore.toLocaleString()} → {totalAfter.toLocaleString()}{gainedXp>0?` (+${gainedXp.toLocaleString()})`:''}</span>}
      </div>
    </div>
  );
};

// 数値がfrom→toへカウントアップする演出(ダイヤ表示用、バー無し)
const CountUpNumber = ({ from, to, onComplete }) => {
  const [val, setVal] = useState(from);
  useEffect(() => {
    const duration = 700, start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(from + (to - from) * t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else onComplete?.();
    };
    const timer = setTimeout(() => { raf = requestAnimationFrame(tick); }, 200);
    return () => { clearTimeout(timer); cancelAnimationFrame(raf); };
  }, []);
  return <span>{val.toLocaleString()}</span>;
};

// 最終リザルト画面(CHAMPION/敗北)共通: 今回の周回で獲得したブリーダー経験値・ダイヤ・
// 勇者モンの絆経験値をまとめて表示するカード
const RewardSummaryCard = ({ summary, onPresentationComplete }) => {
  const completedPartsRef = useRef(new Set());
  const expectedParts = 2 + (summary.heroBondGain ? 1 : 0) + (summary.allyBondGains?.length || 0);
  const markPresented = (part) => {
    completedPartsRef.current.add(part);
    if (completedPartsRef.current.size >= expectedParts) onPresentationComplete?.();
  };
  return (
  <div className="w-full max-w-xs bg-black/30 border border-white/10 rounded-2xl p-3 mb-2 text-left shrink-0 flex flex-col min-h-0">
    <div className="space-y-3 shrink-0">
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-indigo-300 font-black flex items-center gap-1"><Crown size={12}/>ブリーダー経験値</span>
          <span className="text-white font-mono font-bold">+{summary.breederXpGain.toLocaleString()}</span>
        </div>
        <LevelGrowthBar levelBefore={summary.breederLevelBefore} levelAfter={summary.breederLevelAfter} onComplete={()=>markPresented('breeder')}/>
      </div>
      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
        <span className="text-amber-300 font-black flex items-center gap-1"><Gem size={12}/>ダイヤ</span>
        <span className="text-white font-mono font-bold flex items-baseline gap-1"><span className="text-slate-500 text-[10px]">{summary.goldBefore.toLocaleString()} →</span><CountUpNumber from={summary.goldBefore} to={summary.goldAfter} onComplete={()=>markPresented('gold')}/>{summary.goldAfter>summary.goldBefore&&<span className="text-amber-300 text-[10px]">(+{(summary.goldAfter-summary.goldBefore).toLocaleString()})</span>}</span>
      </div>
      {/* クリアしたときだけ入る限界突破アイテム。1行だけ足して、リザルトの高さを崩さない */}
      {summary.psycheGain > 0 && (
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
          <span className="text-fuchsia-300 font-black flex items-center gap-1"><span aria-hidden="true">🌈</span>虹のプシュケー</span>
          <span className="text-white font-mono font-bold">×{summary.psycheGain.toLocaleString()}</span>
        </div>
      )}
      {summary.heroBondGain && (
        <div className="pt-2 border-t border-white/10">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-pink-300 font-black flex items-center gap-1 truncate"><Heart size={12}/>絆レベル：{summary.heroBondGain.name}</span>
            <span className="text-white font-mono font-bold shrink-0">+{summary.heroBondGain.xpGain.toLocaleString()}</span>
          </div>
          <LevelGrowthBar levelBefore={summary.heroBondGain.levelBefore} levelAfter={summary.heroBondGain.levelAfter} onComplete={()=>markPresented('hero')}/>
          {summary.heroBondGain.levelAfter.level > summary.heroBondGain.levelBefore.level && (
            <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{summary.heroBondGain.levelAfter.level - summary.heroBondGain.levelBefore.level}</div>
          )}
        </div>
      )}
      {summary.allyBondGains && summary.allyBondGains.length > 0 && (
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="text-[10px] text-pink-300 font-black flex items-center gap-1"><Heart size={10}/>仲間の絆経験値</div>
          {summary.allyBondGains.map((a, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-slate-300 font-bold truncate">{a.name}</span>
                <span className="text-white font-mono font-bold shrink-0">+{a.xpGain.toLocaleString()}</span>
              </div>
              <LevelGrowthBar levelBefore={a.levelBefore} levelAfter={a.levelAfter} onComplete={()=>markPresented(`ally-${i}`)}/>
              {a.levelAfter.level > a.levelBefore.level && (
                <div className="text-[8px] text-amber-300 font-black mt-1 flex items-center gap-1"><Sparkles size={9}/>強化ポイント +{a.levelAfter.level - a.levelBefore.level}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    {summary.waveHistory && summary.waveHistory.length > 0 && (
      <div className="pt-2 mt-3 border-t border-white/10 shrink-0 flex flex-col min-h-0">
        <div className="text-[10px] text-cyan-300 font-black flex items-center gap-1 mb-1 shrink-0"><Trophy size={11}/>WAVE別ログ</div>
        <div className="space-y-0.5 overflow-y-auto mh-scroll max-h-[18vh]">
          {summary.waveHistory.map(w => (
            <div key={w.wave} className="flex items-center justify-between gap-1 text-[9px] bg-white/5 rounded-lg px-2 py-1">
              <span className="text-slate-400 font-bold shrink-0">WAVE {w.wave}</span>
              {!summary.quickMode&&<span className="text-white font-mono font-bold truncate">スコア +{w.roundScore.toLocaleString()}</span>}
              <span className="text-indigo-300 font-mono font-bold shrink-0">XP+{w.xpGain.toLocaleString()}</span>
              <span className="text-amber-300 font-mono font-bold shrink-0">💎+{w.goldGain.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
  );
};

// ---- 起動ローディングのゲージ ----
// 進み具合そのものは index.html の __mhBoot が持っている。静的なローディング画面と
// Reactのブート画面で同じ値を使うため、React側は数えなおさずここから読むだけにする。
// __mhBoot が無い環境(検証用に compiled.js だけを読み込む道具など)でも落ちないよう、
// そのときは「読み込み済み」として扱う。
const bootLoadRatio = () => { try { return window.__mhBoot ? window.__mhBoot.ratio() : 1; } catch (e) { return 1; } };
const bootProgressNow = (label) => ({ done: Math.round(bootLoadRatio() * 1000), total: 1000, label });
const bootLoadDone = (name) => { try { if (window.__mhBoot) window.__mhBoot.done(name); } catch (e) {} };
// 数え漏れが残っていてもゲージの右端まで伸ばす(終わったのに98%で止まって見えないように)
const bootLoadFinish = () => { try { if (window.__mhBoot) window.__mhBoot.finish(); } catch (e) {} };
const bootLoadWatch = (fn) => { try { return window.__mhBoot ? window.__mhBoot.watch(fn) : null; } catch (e) { return null; } };

// 開発用。全ベースモンの本体ピクセルを唯一の座標系にする汎用タッチ式マスクエディタ。
const DyeMaskTouchEditor=({onClose,onTryInGame,onReleaseTemporary,onReleaseAllTemporary,temporaryMasks,active=true})=>{
 const targets=useMemo(makeDyeMaskEditorTargets,[]),[targetIndex,setTargetIndex]=useState(0),target=targets[targetIndex];
 const bodyRef=useRef(null),maskRef=useRef(null),originalRef=useRef(null),bodyDataRef=useRef(null),outsideRef=useRef(null),outlineRef=useRef(null),warningRef=useRef(null),loupeRef=useRef(null),historyRef=useRef({undo:[],redo:[]}),pointersRef=useRef(new Map()),gestureRef=useRef(null),lastTapRef=useRef(0),previewFrameRef=useRef(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[view,setView]=useState('composite'),[opacity,setOpacity]=useState(50),[dirty,setDirty]=useState(false),[search,setSearch]=useState('');
 const [previewMaskUrl,setPreviewMaskUrl]=useState(null),[previewRevision,setPreviewRevision]=useState(0),[previewColors,setPreviewColors]=useState(['red','green','blue']);
 const [color,setColor]=useState('red'),[tool,setTool]=useState('brush'),[size,setSize]=useState(18),[zoom,setZoom]=useState(1),[pan,setPan]=useState({x:0,y:0}),[historyTick,setHistoryTick]=useState(0),[details,setDetails]=useState(false),[imageSize,setImageSize]=useState({width:2,height:3});
 const [pointerDistance,setPointerDistance]=useState(50),[pointerDirection,setPointerDirection]=useState('up'),[pointer,setPointer]=useState(null),[loupe,setLoupe]=useState(true);
 const colors={red:[255,0,0,255],green:[0,255,0,255],blue:[0,0,255,255],eraser:[0,0,0,0]},colorCss={red:'#ff0000',green:'#00ff00',blue:'#0000ff',eraser:'#ffffff'};
 const context=()=>maskRef.current?.getContext('2d',{willReadFrequently:true}),snap=()=>{const c=maskRef.current;return c&&context()?.getImageData(0,0,c.width,c.height);},restore=image=>{if(image)context()?.putImageData(image,0,0);};
 const requestCompositePreview=()=>{if(view!=='composite'||previewFrameRef.current!==null)return;previewFrameRef.current=requestAnimationFrame(()=>{previewFrameRef.current=null;setPreviewRevision(v=>v+1);});};
 const flushCompositePreview=()=>{if(previewFrameRef.current!==null){cancelAnimationFrame(previewFrameRef.current);previewFrameRef.current=null;}if(view==='composite')setPreviewRevision(v=>v+1);};
 const checkpoint=()=>{const image=snap();if(!image)return;const h=historyRef.current;h.undo.push(image);if(h.undo.length>12)h.undo.shift();h.redo=[];setHistoryTick(v=>v+1);};
 const undo=()=>{const h=historyRef.current;if(!h.undo.length)return;h.redo.push(snap());restore(h.undo.pop());setDirty(true);setHistoryTick(v=>v+1);},redo=()=>{const h=historyRef.current;if(!h.redo.length)return;h.undo.push(snap());restore(h.redo.pop());setDirty(true);setHistoryTick(v=>v+1);};
 const findOutside=(body,w,h)=>{const outside=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;const add=i=>{if(i<0||i>=outside.length||outside[i]||body[i*4+3])return;outside[i]=1;queue[tail++]=i;};for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}while(head<tail){const i=queue[head++],x=i%w;if(x)add(i-1);if(x<w-1)add(i+1);add(i-w);add(i+w);}return outside;};
 // Canvas端から本体の透明画素だけを辿った「外部」だけを除去する。目など輪郭内の透明な穴は保持する。
 const normalizeMask=(image,outside)=>{const data=image.data;for(let i=0,p=0;i<data.length;i+=4,p++){if(outside[p]||!data[i+3]){data[i]=data[i+1]=data[i+2]=data[i+3]=0;continue;}const r=data[i],g=data[i+1],b=data[i+2];data[i]=r>=g&&r>=b?255:0;data[i+1]=g>r&&g>=b?255:0;data[i+2]=b>r&&b>g?255:0;data[i+3]=255;}return image;};
 const updateWarning=()=>{const c=maskRef.current,wc=warningRef.current,outside=outsideRef.current;if(!c||!wc||!outside)return;const source=context().getImageData(0,0,c.width,c.height).data,ctx=wc.getContext('2d'),warning=ctx.createImageData(c.width,c.height);for(let p=0;p<outside.length;p++){const i=p*4;if(outside[p]&&source[i+3]){warning.data[i]=255;warning.data[i+1]=0;warning.data[i+2]=255;warning.data[i+3]=255;}}ctx.putImageData(warning,0,0);};
 const loadTarget=useCallback(async()=>{let cancelled=false;setReady(false);setError('');historyRef.current={undo:[],redo:[]};setHistoryTick(v=>v+1);try{const load=url=>new Promise((resolve,reject)=>{const image=new window.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('画像を読み込めません'));image.src=url;});const body=await load(target.imageUrl);if(cancelled)return()=>{};const w=body.naturalWidth||body.width,h=body.naturalHeight||body.height,b=bodyRef.current,m=maskRef.current,wc=warningRef.current;b.width=m.width=wc.width=w;b.height=m.height=wc.height=h;setImageSize({width:w,height:h});const bc=b.getContext('2d',{willReadFrequently:true});bc.drawImage(body,0,0,w,h);bodyDataRef.current=bc.getImageData(0,0,w,h).data;outsideRef.current=findOutside(bodyDataRef.current,w,h);
   const mc=context();mc.clearRect(0,0,w,h);if(target.maskUrl){const rawMask=await load(target.maskUrl);mc.imageSmoothingEnabled=false;mc.drawImage(rawMask,0,0,w,h);}else if(target.hasMask){const urls=await getDyeRegionMasks(target.baseId,target.imageUrl);if(urls){const layers=await Promise.all(urls.slice(0,3).map(load));layers.forEach((layer,index)=>{const temp=document.createElement('canvas');temp.width=w;temp.height=h;const tc=temp.getContext('2d');tc.drawImage(layer,0,0,w,h);tc.globalCompositeOperation='source-in';tc.fillStyle=['#f00','#0f0','#00f'][index];tc.fillRect(0,0,w,h);mc.drawImage(temp,0,0);});}}const original=mc.createImageData(w,h);original.data.set(mc.getImageData(0,0,w,h).data);originalRef.current=original;updateWarning();
   const outline=document.createElement('canvas');outline.width=w;outline.height=h;const oc=outline.getContext('2d'),alpha=bodyDataRef.current,od=oc.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!alpha[i+3])continue;const edge=x===0||y===0||x===w-1||y===h-1||!alpha[i-4+3]||!alpha[i+4+3]||!alpha[i-w*4+3]||!alpha[i+w*4+3];if(edge){od.data[i]=255;od.data[i+1]=255;od.data[i+3]=255;}}oc.putImageData(od,0,0);outlineRef.current=outline;setDirty(false);setZoom(1);setPan({x:0,y:0});setReady(true);}catch(e){setError(e.message);}return()=>{cancelled=true;};},[target]);
 useEffect(()=>{let cleanup;loadTarget().then(fn=>cleanup=fn);return()=>cleanup?.();},[loadTarget]);
 useEffect(()=>{if(ready)updateWarning();},[ready,historyTick]);
 // 「合成」は編集補助Canvasを重ねず、編集中のPNGをBlob URLとして本番コンポーネントへ渡す。
 // これにより座標、縦横比、半透明輪郭、色変換、部位別透明度、特殊処理がゲーム内確認と同じになる。
 useEffect(()=>{if(!ready||view!=='composite')return;const c=maskRef.current,ctx=context();if(!c||!ctx)return;let cancelled=false;const source=ctx.getImageData(0,0,c.width,c.height),image=ctx.createImageData(c.width,c.height);image.data.set(source.data);normalizeMask(image,outsideRef.current);const temp=document.createElement('canvas');temp.width=c.width;temp.height=c.height;temp.getContext('2d').putImageData(image,0,0);temp.toBlob(blob=>{if(cancelled||!blob)return;const nextUrl=URL.createObjectURL(blob);setPreviewMaskUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return nextUrl;});},'image/png');return()=>{cancelled=true;};},[ready,view,historyTick,previewRevision,target.baseId]);
 useEffect(()=>()=>{if(previewFrameRef.current!==null)cancelAnimationFrame(previewFrameRef.current);setPreviewMaskUrl(previous=>{if(previous)URL.revokeObjectURL(previous);return null;});},[]);
 const confirmDiscard=()=>!dirty||window.confirm('未書き出しの編集があります。破棄してモンスターを切り替えますか？');
 const selectTarget=index=>{if(index===targetIndex||!confirmDiscard())return;setTargetIndex(index);};
 const offsetClient=e=>{const side=pointerDistance/Math.sqrt(2);return pointerDirection==='left'?{x:e.clientX-side,y:e.clientY-side}:pointerDirection==='right'?{x:e.clientX+side,y:e.clientY-side}:{x:e.clientX,y:e.clientY-pointerDistance};};
 const pointFromClient=client=>{const c=maskRef.current,r=c.getBoundingClientRect();return{x:(client.x-r.left)*c.width/r.width,y:(client.y-r.top)*c.height/r.height};};
 const paint=(from,to)=>{const c=maskRef.current,ctx=context(),body=bodyDataRef.current,rgba=colors[color],distance=Math.hypot(to.x-from.x,to.y-from.y),count=Math.max(1,Math.ceil(distance/Math.max(1,size*.22))),radius=size/2,left=Math.max(0,Math.floor(Math.min(from.x,to.x)-radius)),top=Math.max(0,Math.floor(Math.min(from.y,to.y)-radius)),right=Math.min(c.width,Math.ceil(Math.max(from.x,to.x)+radius+1)),bottom=Math.min(c.height,Math.ceil(Math.max(from.y,to.y)+radius+1)),width=right-left,height=bottom-top;if(!width||!height)return;const image=ctx.getImageData(left,top,width,height),data=image.data;for(let n=0;n<=count;n++){const cx=from.x+(to.x-from.x)*n/count,cy=from.y+(to.y-from.y)*n/count;for(let y=Math.max(top,Math.floor(cy-radius));y<Math.min(bottom,Math.ceil(cy+radius+1));y++)for(let x=Math.max(left,Math.floor(cx-radius));x<Math.min(right,Math.ceil(cx+radius+1));x++){if((x-cx)**2+(y-cy)**2>radius**2)continue;const local=((y-top)*width+x-left)*4,global=(y*c.width+x)*4;if(color!=='eraser'&&!body[global+3])continue;data.set(rgba,local);}}ctx.putImageData(image,left,top);setDirty(true);requestCompositePreview();};
 const fill=p=>{const c=maskRef.current,ctx=context(),image=ctx.getImageData(0,0,c.width,c.height),data=image.data,body=bodyDataRef.current,rgba=colors[color],x=Math.max(0,Math.min(c.width-1,Math.floor(p.x))),y=Math.max(0,Math.min(c.height-1,Math.floor(p.y))),start=y*c.width+x,o=start*4,targetColor=[data[o],data[o+1],data[o+2],data[o+3]];if((color!=='eraser'&&!body[o+3])||targetColor.every((v,i)=>v===rgba[i]))return;checkpoint();const q=[start],seen=new Uint8Array(c.width*c.height);while(q.length){const i=q.pop();if(seen[i])continue;seen[i]=1;const d=i*4;if((color!=='eraser'&&!body[d+3])||!targetColor.every((v,j)=>data[d+j]===v))continue;data.set(rgba,d);const x=i%c.width,y=(i/c.width)|0;if(x)q.push(i-1);if(x<c.width-1)q.push(i+1);if(y)q.push(i-c.width);if(y<c.height-1)q.push(i+c.width);}ctx.putImageData(image,0,0);setDirty(true);setHistoryTick(v=>v+1);};
 const drawLoupe=p=>{if(!loupe||!p)return;const c=loupeRef.current;if(!c)return;const ctx=c.getContext('2d'),span=Math.max(12,size*3),sx=p.x-span/2,sy=p.y-span/2;ctx.clearRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(bodyRef.current,sx,sy,span,span,0,0,c.width,c.height);ctx.globalAlpha=opacity/100;ctx.drawImage(maskRef.current,sx,sy,span,span,0,0,c.width,c.height);ctx.globalAlpha=1;ctx.strokeStyle=colorCss[color];ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.width/2,c.height/2,Math.max(4,size/span*c.width/2),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(c.width/2-7,c.height/2);ctx.lineTo(c.width/2+7,c.height/2);ctx.moveTo(c.width/2,c.height/2-7);ctx.lineTo(c.width/2,c.height/2+7);ctx.stroke();};
 useEffect(()=>{if(pointer?.p)drawLoupe(pointer.p);},[pointer,loupe,opacity,size,color]);
 const beginPan=()=>{const ps=[...pointersRef.current.values()];if(ps.length<2)return;const a=ps[0],b=ps[1];gestureRef.current={kind:'pan',mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.hypot(a.x-b.x,a.y-b.y),pan,zoom};setPointer(null);};
 const down=e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointersRef.current.size>=2){beginPan();return;}const now=Date.now();if(now-lastTapRef.current<300){setZoom(1);setPan({x:0,y:0});lastTapRef.current=0;return;}lastTapRef.current=now;const client=offsetClient(e),p=pointFromClient(client);setPointer({...client,p});drawLoupe(p);if(tool==='fill'){fill(p);return;}checkpoint();gestureRef.current={kind:'draw',pointerId:e.pointerId,point:p};paint(p,p);};
 const move=e=>{if(!pointersRef.current.has(e.pointerId))return;e.preventDefault();pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=gestureRef.current;if(pointersRef.current.size>=2){if(g?.kind!=='pan')beginPan();const pg=gestureRef.current,ps=[...pointersRef.current.values()],a=ps[0],b=ps[1],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance=Math.hypot(a.x-b.x,a.y-b.y),nextZoom=Math.max(.5,Math.min(8,pg.zoom*distance/Math.max(1,pg.distance)));setZoom(nextZoom);setPan({x:pg.pan.x+mid.x-pg.mid.x,y:pg.pan.y+mid.y-pg.mid.y});return;}if(!g||g.kind!=='draw'||g.pointerId!==e.pointerId)return;const client=offsetClient(e),p=pointFromClient(client);setPointer({...client,p});drawLoupe(p);paint(g.point,p);g.point=p;};
 const up=e=>{pointersRef.current.delete(e.pointerId);if(pointersRef.current.size<2&&gestureRef.current?.kind==='pan')gestureRef.current=null;if(!pointersRef.current.size){gestureRef.current=null;setPointer(null);}setHistoryTick(v=>v+1);flushCompositePreview();};
 const resetOriginal=()=>{if(!dirty||window.confirm('編集中の内容を破棄して元マスクを再読込しますか？')){restore(originalRef.current);historyRef.current={undo:[],redo:[]};setDirty(false);setHistoryTick(v=>v+1);}},clearAll=()=>{if(window.confirm('現在のマスクを全消去しますか？')){checkpoint();context().clearRect(0,0,maskRef.current.width,maskRef.current.height);setDirty(true);setHistoryTick(v=>v+1);}},cleanOutside=()=>{const c=maskRef.current,image=context().getImageData(0,0,c.width,c.height),outside=outsideRef.current;let changed=false;for(let p=0;p<outside.length;p++){const i=p*4;if(outside[p]&&image.data[i+3]){image.data[i]=image.data[i+1]=image.data[i+2]=image.data[i+3]=0;changed=true;}}if(!changed)return;checkpoint();context().putImageData(image,0,0);setDirty(true);setHistoryTick(v=>v+1);};
 const exportPng=()=>{const c=maskRef.current,image=normalizeMask(context().getImageData(0,0,c.width,c.height),outsideRef.current);context().putImageData(image,0,0);c.toBlob(blob=>{const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`${target.id}-dye-mask.PNG`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setDirty(false);},'image/png');};
 const tryInGame=()=>{const c=maskRef.current;if(!c||!ready)return;const image=normalizeMask(context().getImageData(0,0,c.width,c.height),outsideRef.current);context().putImageData(image,0,0);c.toBlob(blob=>{if(blob)onTryInGame(target,blob,previewColors);},'image/png');};
 const close=()=>{if(confirmDiscard())onClose();},colorButton=(id,label,bg)=><button onClick={()=>setColor(id)} aria-pressed={color===id} className={`min-h-[42px] rounded-xl border-2 text-[9px] font-black ${color===id?'border-white':'border-transparent'}`} style={{backgroundColor:bg}}>{label}</button>,history=historyRef.current,filtered=targets.map((t,i)=>({t,i})).filter(({t})=>t.name.includes(search)||t.baseId.toLowerCase().includes(search.toLowerCase()));
 return <main className={`${active?'flex':'hidden'} fixed inset-0 z-50 flex-col overflow-hidden bg-slate-950`} style={{paddingTop:'max(.25rem,env(safe-area-inset-top))'}}><header className="flex h-10 shrink-0 items-center px-1"><button onClick={close} className="min-h-[40px] min-w-[40px]"><ArrowLeft size={20}/></button><div className="min-w-0"><small className="block text-[7px] font-black text-cyan-400">DEBUG・メモリ上だけ／再読込で消去</small><h2 className="truncate text-[11px] font-black">汎用染色マスクエディタ</h2></div><button onClick={exportPng} disabled={!ready} className="ml-auto min-h-[36px] rounded-xl bg-cyan-600 px-2 text-[8px] font-black disabled:opacity-40">PNG書出</button></header>
 <section className="shrink-0 px-2 pb-1"><div className="grid grid-cols-[38px_1fr_38px] gap-1"><button onClick={()=>selectTarget((targetIndex-1+targets.length)%targets.length)} className="rounded-lg bg-slate-800" aria-label="前のモンスター">←</button><select aria-label="モンスター選択" value={targetIndex} onChange={e=>selectTarget(+e.target.value)} className="min-h-[34px] min-w-0 rounded-lg bg-slate-800 px-2 text-[9px] font-black">{targets.map((t,i)=><option key={t.baseId} value={i}>{t.name}／{t.hasMask?'染色マスクあり':'染色マスクなし'}</option>)}</select><button onClick={()=>selectTarget((targetIndex+1)%targets.length)} className="rounded-lg bg-slate-800" aria-label="次のモンスター">→</button></div><input value={search} onChange={e=>setSearch(e.target.value)} list="dye-mask-monsters" placeholder="名前検索" className="mt-1 min-h-[30px] w-full rounded-lg bg-slate-800 px-2 text-[9px]"/><datalist id="dye-mask-monsters">{filtered.map(({t})=><option key={t.baseId} value={t.name}/>)}</datalist>{search&&filtered.length>0&&<button onClick={()=>{selectTarget(filtered[0].i);setSearch('');}} className="mt-1 w-full rounded bg-cyan-900 py-1 text-[8px]">「{filtered[0].t.name}」を選択</button>}<p className={`text-center text-[8px] font-black ${target.hasMask?'text-emerald-300':'text-amber-300'}`}>{target.name}・{target.hasMask?'既存の染色マスクを読込':'染色マスクなし（完全透明から開始）'}{dirty?'・未書き出し':''}</p></section>
 <div className="grid shrink-0 grid-cols-4 gap-1 px-2">{[['composite','合成'],['body','本体のみ'],['mask','マスクのみ'],['boundary','境界確認']].map(([id,label])=><button key={id} onClick={()=>setView(id)} className={`min-h-[30px] rounded-lg text-[8px] font-black ${view===id?'bg-cyan-700':'bg-slate-800'}`}>{label}</button>)}</div>
 <section className="relative m-2 min-h-0 flex-1 overflow-hidden rounded-xl bg-slate-600" style={{touchAction:'none'}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{error?<p className="p-4 text-center text-red-200">{error}</p>:!ready&&<p className="p-4 text-center">画像を読み込み中…</p>}<div className="absolute inset-0 flex items-center justify-center" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,pointerEvents:ready?'auto':'none'}}><div className="relative max-h-full max-w-full" style={{height:'100%',aspectRatio:`${imageSize.width} / ${imageSize.height}`}}>{view==='composite'&&previewMaskUrl&&<DyedMonsterImage baseId={target.baseId} src={target.imageUrl} alt={`${target.name}合成`} masuColors={previewColors} debugMaskPlacement={{maskUrl:previewMaskUrl}} className="absolute inset-0 h-full w-full object-contain"/>}<canvas ref={bodyRef} aria-label={`${target.name}本体レイヤー`} className="absolute inset-0 h-full w-full" style={{display:view==='mask'||view==='composite'?'none':'block'}}/><canvas ref={maskRef} aria-label="染色マスク編集レイヤー" className="absolute inset-0 h-full w-full" style={{display:view==='body'?'none':'block',opacity:view==='composite'?0:view==='boundary'?opacity/100:1}}/>{view==='boundary'&&outlineRef.current&&<img src={outlineRef.current.toDataURL()} alt="本体の外周" className="pointer-events-none absolute inset-0 h-full w-full"/>}<canvas ref={warningRef} aria-label="本体範囲外のマスク警告" className="pointer-events-none absolute inset-0 h-full w-full" style={{display:view==='boundary'?'block':'none'}}/></div></div>{loupe&&pointer&&<canvas ref={loupeRef} width="120" height="120" aria-label="拡大鏡" className="pointer-events-none absolute left-2 top-2 rounded-full border-2 border-white bg-slate-950 shadow-xl"/>}{pointer&&<div className="pointer-events-none fixed z-10 rounded-full border-2" style={{left:pointer.x-size*zoom/2,top:pointer.y-size*zoom/2,width:size*zoom,height:size*zoom,borderColor:colorCss[color],background:color==='eraser'?'repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,.7) 3px,rgba(255,255,255,.7) 5px)':'transparent'}}><span className="absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 bg-white"/><span className="absolute left-1/2 top-1/2 h-3 w-px -translate-y-1/2 bg-white"/></div>}</section>
 <section className="shrink-0 rounded-t-2xl border-t-2 border-cyan-400 bg-slate-900 px-2 pt-1" style={{paddingBottom:'max(.4rem,env(safe-area-inset-bottom))'}}><div className="grid grid-cols-8 gap-1">{colorButton('red','赤','#f00')}{colorButton('green','緑','#080')}{colorButton('blue','青','#00f')}{colorButton('eraser','消す','#475569')}<button onClick={undo} disabled={!history.undo.length} className="rounded-xl bg-slate-700 text-[7px] disabled:opacity-30">Undo</button><button onClick={redo} disabled={!history.redo.length} className="rounded-xl bg-slate-700 text-[7px] disabled:opacity-30">Redo</button><button onClick={()=>setTool('brush')} className={`rounded-xl text-[7px] ${tool==='brush'?'bg-violet-700':'bg-slate-700'}`}>ブラシ</button><button onClick={()=>setTool('fill')} className={`rounded-xl text-[7px] ${tool==='fill'?'bg-violet-700':'bg-slate-700'}`}>塗りつぶし</button></div><div className="mt-1 grid grid-cols-3 gap-1"><button onClick={tryInGame} disabled={!ready} className="min-h-[38px] rounded-lg bg-fuchsia-700 text-[8px] font-black disabled:opacity-40">ゲームで試す</button><button onClick={()=>onReleaseTemporary(target.baseId)} disabled={!temporaryMasks[target.baseId]} className="rounded-lg bg-amber-800 text-[7px] font-black disabled:opacity-30">一時反映を解除</button><button onClick={onReleaseAllTemporary} disabled={!Object.keys(temporaryMasks).length} className="rounded-lg bg-red-900 text-[8px] font-black disabled:opacity-30">すべて解除</button></div>{temporaryMasks[target.baseId]&&<p className="pt-0.5 text-center text-[8px] font-black text-fuchsia-300">● 一時反映中</p>}<button onClick={()=>setDetails(v=>!v)} className="mt-1 min-h-[28px] w-full rounded-lg bg-slate-700 text-[8px]">詳細 {details?'▲':'▼'}</button>{details&&<div className="mt-1 grid grid-cols-2 gap-2 rounded-xl bg-slate-800 p-2 text-[8px]"><div className="col-span-2 grid grid-cols-3 gap-1">{Array.from({length:dyeRegionCount(target.baseId)},(_,idx)=><label key={idx} className="text-[7px] text-fuchsia-200">染色{'①②③④⑤'[idx]}<select value={previewColors[idx]||''} onChange={e=>setPreviewColors(current=>{const next=[...current];next[idx]=e.target.value||null;return next;})} className="block min-h-[28px] w-full rounded bg-slate-700 text-[8px]"><option value="">元の色</option>{Object.keys(MASU_COLOR_TARGET).map(id=><option key={id} value={id}>{MASU_COLOR_LABELS[id]}</option>)}</select></label>)}</div><label>ブラシ {size}px<input className="block w-full" type="range" min="2" max="100" step="2" value={size} onChange={e=>setSize(+e.target.value)}/></label><label>透明度 {opacity}%<input className="block w-full" type="range" min="25" max="100" step="25" value={opacity} onChange={e=>setOpacity(+e.target.value)}/></label><label>ポインター距離<select value={pointerDistance} onChange={e=>setPointerDistance(+e.target.value)} className="block w-full bg-slate-700">{[0,30,50,70].map(n=><option key={n} value={n}>{n}px</option>)}</select></label><label>方向<select value={pointerDirection} onChange={e=>setPointerDirection(e.target.value)} className="block w-full bg-slate-700"><option value="up">真上</option><option value="left">左上</option><option value="right">右上</option></select></label><button onClick={()=>setLoupe(v=>!v)} className="rounded bg-slate-700">拡大鏡 {loupe?'ON':'OFF'}</button><button onClick={()=>{setZoom(1);setPan({x:0,y:0});}} className="rounded bg-slate-700">全体表示</button><button onClick={cleanOutside} className="rounded bg-fuchsia-900">範囲外を掃除</button><button onClick={clearAll} className="rounded bg-red-900">全消去</button><button onClick={resetOriginal} className="rounded bg-amber-900">元マスク再読込</button></div>}<p className="pt-1 text-center text-[7px] text-slate-400">1本指：描画・2本指：パン/ピンチ・ダブルタップ：全体表示・{Math.round(zoom*100)}%</p></section></main>;
};

// タップは1回、長押しは一定間隔で繰り返す。Pointer Eventsを使ってタッチを優先し、
// 指が外れた時と画面破棄時のどちらでもタイマーを残さない。
function PressRepeatButton({ onPress, disabled, className, children, ...props }) {
  const delayRef = useRef(null), repeatRef = useRef(null), longPressedRef = useRef(false);
  const clearPress = useCallback(() => {
    if (delayRef.current !== null) clearTimeout(delayRef.current);
    if (repeatRef.current !== null) clearInterval(repeatRef.current);
    delayRef.current = repeatRef.current = null;
  }, []);
  useEffect(() => clearPress, [clearPress]);
  const startPress = event => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    clearPress(); longPressedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    delayRef.current = setTimeout(() => {
      longPressedRef.current = true; onPress();
      repeatRef.current = setInterval(onPress, 110);
    }, 420);
  };
  const clickPress = event => {
    if (longPressedRef.current) { longPressedRef.current = false; event.preventDefault(); return; }
    onPress();
  };
  return <button type="button" disabled={disabled} onPointerDown={startPress} onPointerUp={clearPress} onPointerCancel={clearPress} onLostPointerCapture={clearPress} onClick={clickPress} className={className} style={{touchAction:'manipulation',WebkitTouchCallout:'none'}} {...props}>{children}</button>;
}
