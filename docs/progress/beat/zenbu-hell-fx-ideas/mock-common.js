// 案の止め絵を撮るための重ね絵(本体ではない・台帳 r1119-141)。tools/mode/rhythm-note-appear-scan.js の MOCK_FX で読む。
// 区間 112.9〜118.0秒、最後の一撃は 117.594秒(幅6の左右2つ)。横 844×390 の道の形に合わせて描く。
window.__fx=(()=>{
  const FROM=112900,HIT=117594,TO=118000;
  const area=()=>document.querySelector('[data-rhythm-play-area]');
  const layer=()=>{let el=document.getElementById('mock-fx');const a=area();
    if(!el){el=document.createElement('div');el.id='mock-fx';el.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:40;overflow:hidden';a.appendChild(el);}
    return el;};
  const geo=()=>{const r=area().getBoundingClientRect();const w=r.width,h=r.height;
    // 道: 奥の端(上端)の左右と手前(下端)の左右・判定ライン
    return {w,h,cx:w/2,topL:w*0.456,topR:w*0.544,botL:0,botR:w,judgeY:h*0.79};};
  const hideNow=()=>{const s=document.querySelector('[data-rhythm-special-fx]');if(s)s.style.display='none';};
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  return {FROM,HIT,TO,layer,geo,hideNow,clamp,area};
})();
