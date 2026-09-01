// DEBUG ONLY: 音ゲー確認者向けの簡易表示。
// 制作機能は削除せず折りたたみへ収納し、普段の実機確認で触る項目だけを前面に出す。
(()=>{
  if(typeof document==='undefined'||typeof MutationObserver==='undefined')return;
  if(document.documentElement.dataset.rhythmReviewMode==='ready')return;
  document.documentElement.dataset.rhythmReviewMode='ready';

  let currentEditor=null;
  let statusObserver=null;

  const ensureGuide=editor=>{
    let guide=editor.querySelector('[data-rhythm-review-guide]');
    if(guide)return guide;
    guide=document.createElement('section');
    guide.dataset.rhythmReviewGuide='';
    guide.className='mb-3 rounded-2xl border border-amber-300/50 bg-amber-950/35 p-3 text-white';
    guide.innerHTML=`
      <div class="flex items-center justify-between gap-2">
        <div>
          <small class="text-[8px] font-black tracking-wider text-amber-300">今回ここだけ確認</small>
          <h3 class="text-base font-black">あつ杯テーマ EASY 実機確認</h3>
        </div>
        <span class="shrink-0 rounded-full bg-amber-400/20 px-2 py-1 text-[8px] font-black text-amber-100">確認用</span>
      </div>
      <div class="mt-2 rounded-xl bg-black/25 p-2 text-[9px] leading-relaxed text-slate-100">
        <b>やること</b>
        <ol class="mt-1 list-decimal space-y-1 pl-4">
          <li>下のオレンジ色「現在のEASY譜面をテストプレイ」を押す</li>
          <li>まずは <b>0 ms</b> のまま1曲プレイする</li>
          <li>音とノーツが気持ちよく合うか、HOLDの開始・終端が自然かを見る</li>
          <li>全体が明らかに早い/遅い時だけ −10 / ＋10 ms を試す</li>
        </ol>
      </div>
      <p data-rhythm-review-current class="mt-2 rounded-lg bg-cyan-950/50 px-2 py-1.5 text-[8px] leading-relaxed text-cyan-100">現在の確認対象を読み込み中…</p>
      <p class="mt-2 text-[8px] leading-relaxed text-slate-300">音源解析・ノーツ編集・JSON/実装JSなどは通常触らなくてOKです。必要な時だけ下の「制作ツール」を開いてください。</p>
    `;
    editor.prepend(guide);
    return guide;
  };

  const refreshCurrent=editor=>{
    const target=editor.querySelector('[data-rhythm-review-current]');
    const status=editor.querySelector('[data-rhythm-chart-status]');
    if(!target||!status)return;
    const text=(status.textContent||'').trim();
    const next=text?`現在: ${text}`:'現在の確認対象を読み込み中…';
    if(target.textContent!==next)target.textContent=next;
  };

  const ensureAdvanced=editor=>{
    let details=editor.querySelector(':scope > [data-rhythm-review-advanced]');
    if(details)return details;
    details=document.createElement('details');
    details.dataset.rhythmReviewAdvanced='';
    details.className='mt-3 rounded-2xl border border-slate-600/70 bg-slate-950/70 text-white';
    details.innerHTML=`
      <summary class="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-black text-slate-200" style="touch-action:manipulation;">
        <span>🛠 制作ツールを表示</span><span class="text-[8px] font-bold text-slate-400">通常は触らなくてOK</span>
      </summary>
      <div data-rhythm-review-advanced-content class="border-t border-white/10 p-2"></div>
    `;
    editor.appendChild(details);
    return details;
  };

  const adoptAuthoringPanel=(content)=>{
    const root=document.querySelector('[data-rhythm-debug]');
    const analysis=root?.querySelector('[data-rhythm-authoring]');
    if(analysis&&!content.contains(analysis))content.prepend(analysis);
  };

  const placeAfter=(anchor,node)=>{
    if(!anchor||!node)return anchor;
    if(anchor.nextElementSibling!==node)anchor.insertAdjacentElement('afterend',node);
    return node;
  };

  const layout=()=>{
    const editor=document.querySelector('[data-rhythm-chart-authoring-ui]');
    if(!editor){
      currentEditor=null;
      statusObserver?.disconnect();statusObserver=null;
      return false;
    }
    if(currentEditor&&currentEditor!==editor){
      statusObserver?.disconnect();statusObserver=null;
    }
    currentEditor=editor;

    const guide=ensureGuide(editor);
    const details=ensureAdvanced(editor);
    const content=details.querySelector('[data-rhythm-review-advanced-content]');
    const status=editor.querySelector('[data-rhythm-chart-status]');
    const preview=editor.querySelector('[data-rhythm-chart-preview]');
    const offset=editor.querySelector('[data-rhythm-preview-offset-ui]');
    const keep=new Set([guide,status,preview,offset,details].filter(Boolean));

    [...editor.children].forEach(child=>{
      if(!keep.has(child)&&child.parentElement===editor)content.appendChild(child);
    });
    adoptAuthoringPanel(content);

    // 確認用の要素だけを上から一定順序へ保つ。実際に順序が違う時だけDOMを動かす。
    let anchor=guide;
    anchor=placeAfter(anchor,status);
    anchor=placeAfter(anchor,preview);
    anchor=placeAfter(anchor,offset);
    placeAfter(anchor,details);
    refreshCurrent(editor);

    if(!statusObserver&&status){
      statusObserver=new MutationObserver(()=>refreshCurrent(editor));
      statusObserver.observe(status,{childList:true,subtree:true,characterData:true});
    }
    return true;
  };

  const observer=new MutationObserver(layout);
  const start=()=>{layout();observer.observe(document.body,{childList:true,subtree:true});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
