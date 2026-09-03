// モンスタービートのプレイ中HUD・コンボ節目・フルコンボ直前演出を補強する小さい表示レイヤー。
// レーン/判定ライン/projection/入力/スコア計算には触れず、既存DOMへ表示だけを追加する。
(()=>{
  if(typeof window==='undefined'||typeof document==='undefined'||window.__mhRhythmPresentationPlus)return;
  Object.defineProperty(window,'__mhRhythmPresentationPlus',{value:true,configurable:false});

  const RANK_MAX_SCORE=900000;
  const RANK_MARKERS=[
    ['C',400000],['B',500000],['A',600000],['S',700000],['SS',800000],['M',900000]
  ];
  const COMBO_STEP=100;
  const COMBO_DURATION_MS=1200;
  const FULL_COMBO_DURATION_MS=1350;
  const state={play:null,scoreObserver:null,comboObserver:null,lastHundred:0,result:null};

  const style=document.createElement('style');
  style.dataset.rhythmPresentationPlus='';
  style.textContent=`
    /* 左HUDの内側だけで完結。プレイエリア/レーンの寸法・位置には一切指定を持たない。 */
    [data-rhythm-rank-gauge-enhanced]{
      box-sizing:border-box;width:100%;max-width:35vw;margin:0 0 6px 0;display:flex;align-items:center;gap:5px;
      pointer-events:none;color:#e2e8f0;font-variant-numeric:tabular-nums;
    }
    [data-rhythm-rank-gauge-enhanced] .mh-rank-orb{
      width:32px;height:32px;min-width:32px;border:2px solid rgba(125,211,252,.72);border-radius:50%;
      display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.86);font-size:14px;font-weight:1000;
      box-shadow:0 0 8px rgba(103,232,249,.3);text-shadow:0 1px 4px rgba(2,6,23,.95);
    }
    [data-rhythm-rank-gauge-enhanced] .mh-rank-track-wrap{position:relative;min-width:0;flex:1;height:28px;padding-top:11px}
    [data-rhythm-rank-gauge-enhanced] .mh-rank-track{
      position:relative;height:6px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(2,6,23,.8);overflow:visible;
    }
    [data-rhythm-rank-gauge-enhanced] .mh-rank-fill{
      position:absolute;inset:0 auto 0 0;width:0;border-radius:inherit;background:linear-gradient(90deg,#67e8f9,#22d3ee,#c084fc);
      box-shadow:0 0 8px rgba(34,211,238,.65);transition:width 120ms linear;
    }
    [data-rhythm-rank-gauge-enhanced] .mh-rank-marker{position:absolute;top:-11px;transform:translateX(-50%);width:1px;height:22px;background:rgba(226,232,240,.74)}
    [data-rhythm-rank-gauge-enhanced] .mh-rank-marker b{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:7px;line-height:1;color:#f8fafc;text-shadow:0 1px 3px #020617;white-space:nowrap}
    [data-rhythm-rank-gauge-enhanced] .mh-rank-marker.is-current{background:#67e8f9;box-shadow:0 0 6px #22d3ee}
    [data-rhythm-rank-gauge-enhanced] .mh-rank-marker.is-current b{color:#67e8f9}
    @media (orientation:landscape){[data-rhythm-rank-gauge-enhanced]{max-width:28vw;margin-bottom:2px}[data-rhythm-rank-gauge-enhanced] .mh-rank-orb{width:28px;height:28px;min-width:28px}}

    /* 既存の100コンボ表示は実装上のtimerが次のcombo更新cleanupで消され得るため、表示だけこちらへ一本化する。 */
    [data-rhythm-combo-milestone]{display:none!important}
    [data-rhythm-combo-celebration]{
      position:absolute;left:50%;top:37%;z-index:24;transform:translate(-50%,-50%);pointer-events:none;text-align:center;white-space:nowrap;
      animation:mhComboPlus 1.2s cubic-bezier(.18,.82,.22,1) forwards;
    }
    [data-rhythm-combo-celebration] .mh-combo-number{display:block;font-size:44px;font-weight:1000;line-height:.92;letter-spacing:-.04em}
    [data-rhythm-combo-celebration] .mh-combo-label{display:block;margin-top:5px;font-size:12px;font-weight:1000;letter-spacing:.22em}
    [data-rhythm-combo-celebration]::before,[data-rhythm-combo-celebration]::after{content:"";position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none}
    [data-rhythm-combo-celebration][data-tier="1"] .mh-combo-number{color:#fef3c7;text-shadow:0 0 12px #f59e0b}
    [data-rhythm-combo-celebration][data-tier="1"] .mh-combo-label{color:#fcd34d}
    [data-rhythm-combo-celebration][data-tier="2"] .mh-combo-number{color:#fde68a;text-shadow:0 0 12px #f59e0b,0 0 22px #fb923c}
    [data-rhythm-combo-celebration][data-tier="2"] .mh-combo-label{color:#fbbf24}
    [data-rhythm-combo-celebration][data-tier="2"]::before{width:118px;height:118px;border:1px solid rgba(251,191,36,.6);box-shadow:0 0 16px rgba(251,191,36,.45)}
    [data-rhythm-combo-celebration][data-tier="3"] .mh-combo-number{font-size:50px;color:#fff;text-shadow:0 0 10px #fff,0 0 22px #22d3ee,0 0 30px #f59e0b}
    [data-rhythm-combo-celebration][data-tier="3"] .mh-combo-label{color:#67e8f9}
    [data-rhythm-combo-celebration][data-tier="3"]::before{width:138px;height:138px;border:2px solid rgba(34,211,238,.65);box-shadow:0 0 18px rgba(34,211,238,.55),inset 0 0 20px rgba(251,191,36,.25)}
    [data-rhythm-combo-celebration][data-tier="3"]::after{width:178px;height:2px;background:linear-gradient(90deg,transparent,#fde047,#67e8f9,transparent);box-shadow:0 0 12px #22d3ee}
    [data-rhythm-combo-celebration][data-tier="4"] .mh-combo-number{font-size:54px;color:#fff;text-shadow:0 0 10px #fff,0 0 22px #f0abfc,0 0 34px #38bdf8,0 0 42px #f59e0b}
    [data-rhythm-combo-celebration][data-tier="4"] .mh-combo-label{color:#f0abfc}
    [data-rhythm-combo-celebration][data-tier="4"]::before{width:154px;height:154px;border:2px solid rgba(240,171,252,.7);box-shadow:0 0 22px rgba(217,70,239,.6),inset 0 0 28px rgba(34,211,238,.3)}
    [data-rhythm-combo-celebration][data-tier="4"]::after{width:206px;height:206px;background:conic-gradient(from 0deg,transparent 0 10%,rgba(103,232,249,.7) 11% 12%,transparent 13% 23%,rgba(253,224,71,.7) 24% 25%,transparent 26% 39%,rgba(240,171,252,.75) 40% 41%,transparent 42%);opacity:.7}
    [data-rhythm-combo-celebration][data-tier="5"] .mh-combo-number{font-size:58px;background:linear-gradient(90deg,#f0abfc,#67e8f9,#fde68a,#fb7185);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(255,255,255,.85)) drop-shadow(0 0 24px rgba(217,70,239,.75))}
    [data-rhythm-combo-celebration][data-tier="5"] .mh-combo-label{color:#fff;text-shadow:0 0 10px #f0abfc,0 0 18px #38bdf8}
    [data-rhythm-combo-celebration][data-tier="5"]::before{width:174px;height:174px;border:2px solid rgba(255,255,255,.75);box-shadow:0 0 24px #d946ef,0 0 38px rgba(56,189,248,.7),inset 0 0 32px rgba(251,191,36,.28)}
    [data-rhythm-combo-celebration][data-tier="5"]::after{width:230px;height:230px;background:conic-gradient(from 15deg,transparent 0 8%,#67e8f9 9% 10%,transparent 11% 20%,#fde047 21% 22%,transparent 23% 33%,#f0abfc 34% 35%,transparent 36% 47%,#fb7185 48% 49%,transparent 50%);filter:drop-shadow(0 0 8px rgba(255,255,255,.65));opacity:.86}
    @keyframes mhComboPlus{0%{opacity:0;transform:translate(-50%,-50%) scale(.56)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.13)}35%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1.03)}}

    [data-rhythm-full-combo-prelude]{position:fixed;inset:0;z-index:100050;display:flex;align-items:center;justify-content:center;pointer-events:none;background:radial-gradient(circle at 50% 52%,rgba(56,189,248,.16),rgba(217,70,239,.08) 28%,transparent 58%)}
    [data-rhythm-full-combo-prelude] .mh-full-inner{text-align:center;animation:mhFullComboPrelude 1.35s cubic-bezier(.18,.82,.22,1) forwards}
    [data-rhythm-full-combo-prelude] b{display:block;font-size:clamp(38px,12vw,64px);font-weight:1000;line-height:.95;background:linear-gradient(90deg,#fff,#fde68a,#67e8f9,#f0abfc,#fff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(255,255,255,.85)) drop-shadow(0 0 28px rgba(56,189,248,.72))}
    [data-rhythm-full-combo-prelude] small{display:block;margin-top:10px;font-size:clamp(18px,6vw,30px);font-weight:1000;color:#fff;text-shadow:0 0 10px #d946ef,0 0 18px #38bdf8}
    @keyframes mhFullComboPrelude{0%{opacity:0;transform:scale(.62)}18%{opacity:1;transform:scale(1.09)}35%{transform:scale(1)}78%{opacity:1}100%{opacity:0;transform:scale(1.04)}}
    @media(prefers-reduced-motion:reduce){[data-rhythm-combo-celebration],[data-rhythm-full-combo-prelude] .mh-full-inner{animation:none!important}}
  `;
  document.head.appendChild(style);

  const scoreNumber=el=>Number(String(el?.textContent||'').replace(/[^0-9]/g,''))||0;
  const comboNumber=el=>Number(String(el?.textContent||'').replace(/[^0-9]/g,''))||0;
  const rankMarkerScore={C:400000,B:500000,A:600000,S:700000,SS:800000,M:900000};

  const syncRankGauge=()=>{
    const play=document.querySelector('[data-rhythm-tap-test]');
    if(!play)return;
    const left=play.querySelector('[data-rhythm-hud-left]');
    const rank=left?.querySelector('[data-rhythm-rank]');
    const score=left?.querySelector('[data-rhythm-score]');
    if(!left||!rank||!score)return;
    let gauge=left.querySelector('[data-rhythm-rank-gauge-enhanced]');
    if(!gauge){
      gauge=document.createElement('div');
      gauge.dataset.rhythmRankGaugeEnhanced='';
      gauge.innerHTML=`<div class="mh-rank-orb" aria-hidden="true"></div><div class="mh-rank-track-wrap"><div class="mh-rank-track"><i class="mh-rank-fill" aria-hidden="true"></i>${RANK_MARKERS.map(([name,value])=>`<span class="mh-rank-marker" data-rank-marker="${name}" style="left:${(value/RANK_MAX_SCORE*100).toFixed(3)}%"><b>${name}</b></span>`).join('')}</div></div>`;
      left.insertBefore(gauge,left.firstChild);
      // 既存の小さい丸バッジと「次ランクまで」だけを隠す。スコア/BEST/難易度/曲名は下へそのまま残す。
      if(rank.parentElement)rank.parentElement.style.display='none';
      const scoreBox=score.parentElement;
      const oldProgress=scoreBox?Array.from(scoreBox.children).find(child=>child!==score&&child.querySelector?.('i')):null;
      if(oldProgress)oldProgress.style.display='none';
    }
    const value=scoreNumber(score);
    const current=String(rank.textContent||'G').trim();
    const orb=gauge.querySelector('.mh-rank-orb');
    const fill=gauge.querySelector('.mh-rank-fill');
    if(orb)orb.textContent=current;
    if(fill)fill.style.width=`${Math.max(0,Math.min(100,value/RANK_MAX_SCORE*100)).toFixed(2)}%`;
    gauge.querySelectorAll('[data-rank-marker]').forEach(marker=>marker.classList.toggle('is-current',marker.dataset.rankMarker===current));
  };

  const comboTier=value=>value>=500?5:value>=400?4:value>=300?3:value>=200?2:1;
  const showComboCelebration=(play,value)=>{
    const area=play.querySelector('[data-rhythm-play-area]');
    if(!area||area.dataset.rhythmLightweight==='true'||area.dataset.rhythmEffect==='MINIMAL')return;
    area.querySelector('[data-rhythm-combo-celebration]')?.remove();
    const node=document.createElement('div');
    node.dataset.rhythmComboCelebration='';
    node.dataset.tier=String(comboTier(value));
    node.setAttribute('aria-hidden','true');
    node.innerHTML=`<b class="mh-combo-number">${value}</b><small class="mh-combo-label">COMBO!</small>`;
    area.appendChild(node);
    window.setTimeout(()=>node.remove(),COMBO_DURATION_MS);
  };

  const bindPlay=play=>{
    if(state.play===play)return;
    state.scoreObserver?.disconnect();
    state.comboObserver?.disconnect();
    state.play=play;
    state.lastHundred=0;
    syncRankGauge();
    const score=play.querySelector('[data-rhythm-score]');
    const combo=play.querySelector('[data-rhythm-combo]');
    if(score){
      state.scoreObserver=new MutationObserver(syncRankGauge);
      state.scoreObserver.observe(score,{subtree:true,childList:true,characterData:true});
    }
    if(combo){
      const syncCombo=()=>{
        const value=comboNumber(combo);
        if(value<COMBO_STEP){state.lastHundred=0;return;}
        const hundred=Math.floor(value/COMBO_STEP)*COMBO_STEP;
        if(hundred<=state.lastHundred)return;
        state.lastHundred=hundred;
        showComboCelebration(play,hundred);
      };
      state.comboObserver=new MutationObserver(syncCombo);
      state.comboObserver.observe(combo,{subtree:true,childList:true,characterData:true});
      syncCombo();
    }
  };

  const showFullComboPrelude=result=>{
    if(!result||state.result===result||result.dataset.rhythmFullComboPreludeSeen==='true')return;
    const text=String(result.textContent||'');
    if(!/FULL COMBO|ALL EXCELLENT|ALL MARVELOUS/.test(text))return;
    state.result=result;
    result.dataset.rhythmFullComboPreludeSeen='true';
    result.style.visibility='hidden';
    const overlay=document.createElement('div');
    overlay.dataset.rhythmFullComboPrelude='';
    overlay.innerHTML='<div class="mh-full-inner"><b>FULL COMBO!</b><small>フルコンボっ！</small></div>';
    document.body.appendChild(overlay);
    // 専用ボイス素材を後から差し込むための安定した再生フック。現時点では音声ファイルを追加しない。
    try{window.dispatchEvent(new CustomEvent('mh:rhythm-full-combo',{detail:{result}}));}catch(_e){}
    window.setTimeout(()=>{
      overlay.remove();
      if(result.isConnected)result.style.visibility='';
    },FULL_COMBO_DURATION_MS);
  };

  const syncScreens=()=>{
    const play=document.querySelector('[data-rhythm-tap-test]');
    if(play)bindPlay(play);
    else if(state.play){state.scoreObserver?.disconnect();state.comboObserver?.disconnect();state.play=null;state.lastHundred=0;}
    const result=document.querySelector('[data-rhythm-result]');
    if(result)showFullComboPrelude(result);
    else state.result=null;
  };

  const rootObserver=new MutationObserver(syncScreens);
  rootObserver.observe(document.documentElement,{subtree:true,childList:true});
  syncScreens();

  // 公開フラグが立ったときだけユーザー向け更新履歴に現れる。HELPの既存説明は変更しない。
  const title='モンスタービートのランクゲージと達成演出を強化';
  if(typeof CHANGELOG!=='undefined'&&!CHANGELOG.some(entry=>entry?.title===title)){
    CHANGELOG.unshift({
      date:'2026-09-03 22:31',type:'update',title,releaseFlag:'rhythmMode',
      items:[
        'プレイ画面の左上に、現在ランクとC・B・A・S・SS・Mの到達位置が分かるスコアランクゲージを追加しました。レーンの形・位置・消失点・判定ラインは変更していません。',
        '100コンボごとのお祝いを100・200・300・400・500以降の5段階で強くし、500コンボ以降も100ごとに最大演出が出るようにしました。',
        'フルコンボ時はリザルトへ切り替わる前に「FULL COMBO! / フルコンボっ！」の短い演出を出します。専用ボイスは後から追加できる再生フックを用意しています。'
      ]
    });
  }
})();
