// DEBUG ONLY: EASY自動ドラフトの実機タイミング補正UI。
// 正式譜面・セーブには書き込まず、プレビュー曲を読み出す瞬間だけ全ノーツへ共通ms補正を加える。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmPreviewOffsetUi==='ready')return;
  document.documentElement.dataset.rhythmPreviewOffsetUi='ready';

  const MIN=-200,MAX=200;
  const VISUAL_EDITOR_URL='debug/rhythm-chart-visual-editor.js?v=20260901a';
  let offsetMs=0,currentSection=null;
  let visualEditorRequested=false;
  const clamp=value=>Math.max(MIN,Math.min(MAX,Math.round(Number(value)||0)));
  const shiftNote=(note,delta)=>{
    const out={...note,timeMs:Math.max(0,Math.round(Number(note?.timeMs)||0)+delta)};
    if(note?.endTimeMs!=null)out.endTimeMs=Math.max(out.timeMs,Math.round(Number(note.endTimeMs)||0)+delta);
    if(Array.isArray(note?.slidePoints))out.slidePoints=note.slidePoints.map(point=>({
      ...point,timeMs:Math.max(0,Math.round(Number(point?.timeMs)||0)+delta)
    }));
    return out;
  };
  const previewChart=()=>{
    try{return window.__mhRhythmAuthoringPreviewSong?.difficulties?.EASY||null;}catch{return null;}
  };
  const loadVisualEditor=()=>{
    if(document.documentElement.dataset.rhythmChartVisualUi==='ready')return true;
    if(document.querySelector('[data-rhythm-chart-visual-loader]'))return true;
    if(visualEditorRequested)return true;
    visualEditorRequested=true;
    const script=document.createElement('script');
    script.dataset.rhythmChartVisualLoader='';
    script.src=VISUAL_EDITOR_URL;
    script.onerror=()=>{visualEditorRequested=false;script.remove();};
    document.head.appendChild(script);
    return true;
  };
  const installChartHook=()=>{
    const chart=previewChart();
    if(!chart)return false;
    if(chart.__mhPreviewOffsetHook)return true;
    let rawNotes=Array.isArray(chart.notes)?chart.notes:[];
    Object.defineProperty(chart,'notes',{
      configurable:true,enumerable:true,
      get:()=>rawNotes.map(note=>shiftNote(note,offsetMs)),
      set:value=>{rawNotes=Array.isArray(value)?value:[];}
    });
    Object.defineProperty(chart,'__mhPreviewOffsetHook',{value:true,enumerable:false});
    Object.defineProperty(window,'__mhRhythmPreviewOffsetMs',{
      configurable:true,
      get:()=>offsetMs,
      set:value=>{offsetMs=clamp(value);updateUi();}
    });
    return true;
  };
  const updateUi=()=>{
    const value=currentSection?.querySelector('[data-rhythm-preview-offset-value]');
    if(value)value.textContent=`${offsetMs>0?'+':''}${offsetMs} ms`;
    const note=currentSection?.querySelector('[data-rhythm-preview-offset-note]');
    if(note)note.textContent=offsetMs===0
      ?'補正なし'
      :offsetMs>0
        ?`ノーツを ${offsetMs}ms 遅らせてテスト`
        :`ノーツを ${Math.abs(offsetMs)}ms 早めてテスト`;
  };
  const adjust=delta=>{offsetMs=clamp(offsetMs+delta);updateUi();};
  const mount=()=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
    if(!editor)return false;
    loadVisualEditor();
    if(!installChartHook())return false;
    const existing=editor.querySelector('[data-rhythm-preview-offset-ui]');
    if(existing){currentSection=existing;updateUi();return true;}

    const box=document.createElement('section');
    box.dataset.rhythmPreviewOffsetUi='';
    box.className='mb-3 rounded-xl border border-fuchsia-400/40 bg-fuchsia-950/30 p-2 text-white';
    box.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <b class="text-[10px]">実機タイミング補正</b>
        <strong data-rhythm-preview-offset-value class="text-sm text-fuchsia-200">0 ms</strong>
      </div>
      <p class="mt-1 text-[8px] leading-relaxed text-slate-300">判定ラインにノーツが重なる瞬間に叩く基準です。＋はノーツを遅らせ、－は早めます。ここはテスト専用で保存しません。</p>
      <div class="mt-2 grid grid-cols-5 gap-1">
        <button type="button" data-rhythm-offset="-20" class="min-h-[44px] rounded-lg bg-slate-800 text-xs font-black">−20</button>
        <button type="button" data-rhythm-offset="-10" class="min-h-[44px] rounded-lg bg-slate-800 text-xs font-black">−10</button>
        <button type="button" data-rhythm-offset-reset class="min-h-[44px] rounded-lg bg-fuchsia-800 text-xs font-black">0</button>
        <button type="button" data-rhythm-offset="10" class="min-h-[44px] rounded-lg bg-slate-800 text-xs font-black">＋10</button>
        <button type="button" data-rhythm-offset="20" class="min-h-[44px] rounded-lg bg-slate-800 text-xs font-black">＋20</button>
      </div>
      <p data-rhythm-preview-offset-note class="mt-1 text-center text-[8px] font-bold text-fuchsia-100">補正なし</p>
    `;
    const previewButton=editor.querySelector('[data-rhythm-chart-preview]');
    previewButton?.insertAdjacentElement('afterend',box);
    if(!previewButton)editor.prepend(box);
    box.querySelectorAll('[data-rhythm-offset]').forEach(button=>button.addEventListener('click',()=>adjust(Number(button.dataset.rhythmOffset))));
    box.querySelector('[data-rhythm-offset-reset]')?.addEventListener('click',()=>{offsetMs=0;updateUi();});
    currentSection=box;
    updateUi();
    return true;
  };

  const scan=()=>{
    if(currentSection&&currentSection.isConnected)return;
    currentSection=null;
    mount();
  };
  const observer=new MutationObserver(()=>{
    // プレイ中はeditorが存在しないので、DOM変化ごとの重い処理は行わない。
    if(document.documentElement.dataset.rhythmPlayActive==='true')return;
    scan();
  });
  const start=()=>{scan();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
