// 結果の画面の数え上げを、毎コマ(requestAnimationFrame)記録する(ページの中で動く・台帳 r1119-166)。
//   node tools/mode/rhythm-robot-play.js ... --init-script docs/progress/beat/result-smooth-2026-11-24/count-recorder.js \
//        --result-script docs/progress/beat/result-smooth-2026-11-24/count-dump.js
// 記録するもの: 結果に出てからの時刻・スコア/判定の行/MAX COMBO の文字(字の幅は測らない。測るとブラウザに配置の計算を強いて重さが変わる)
(function(){
  const raf=window.requestAnimationFrame.bind(window);
  window.__mhCountLog=[];
  let t0=0;
  const width=el=>{if(!el||!el.firstChild)return null;const r=document.createRange();r.selectNodeContents(el);const b=r.getBoundingClientRect();return [Math.round(b.width*10)/10,Math.round(b.right*10)/10];};
  const tick=now=>{
    const root=document.querySelector('[data-rhythm-result]');
    if(root&&window.__mhCountLog.length<600){
      if(!t0)t0=now;
      if(now-t0<4000){
        const score=root.querySelector('[data-rhythm-result-score]');
        const rows=[...root.querySelectorAll('[data-rhythm-result-judgment-table] dd')];
        const combo=root.querySelector('[data-rhythm-max-combo]');
        window.__mhCountLog.push({t:Math.round((now-t0)*10)/10,anim:root.getAttribute('data-rhythm-count-anim'),
          score:score&&score.textContent,rows:rows.map(d=>d.textContent),combo:combo&&combo.textContent});
      }
    }
    raf(tick);
  };
  raf(tick);
})();
