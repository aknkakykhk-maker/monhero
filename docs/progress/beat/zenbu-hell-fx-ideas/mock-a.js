// 案1「溜めて、放つ」: 道の外側に必殺ゲージが下から満ちる → 最後の一撃で閃光・衝撃波・画面の揺れ・決め文字
window.__mhMockFx=ms=>{const F=window.__fx;F.hideNow();const L=F.layer(),g=F.geo();L.innerHTML='';
  F.area().style.transform='';
  if(ms<F.FROM-100||ms>F.TO+600)return;
  const charge=F.clamp((ms-F.FROM)/(F.HIT-F.FROM));const after=ms-F.HIT;
  // 道の外側(左右の三角)だけに溜まる光。道の中は塗らない
  const full=after>=0?1:charge,stop=(1-full)*100;
  const side=(pts)=>`<div style="position:absolute;inset:0;clip-path:polygon(${pts});background:linear-gradient(to top,rgba(255,170,40,.55) 0%,rgba(255,60,40,.35) ${100-stop}%,rgba(0,0,0,0) ${100-stop}%)"></div>`;
  L.innerHTML+=side(`0 0,${g.topL-6}px 0,0 ${g.h}px`)+side(`${g.topR+6}px 0,${g.w}px 0,${g.w}px ${g.h}px`);
  // 満ちた高さの縁に火の粉の線
  if(after<0){const y=g.h*stop/100;L.innerHTML+=`<div style="position:absolute;left:0;right:0;top:${y-2}px;height:4px;background:linear-gradient(90deg,#ffd36b 0 ${Math.max(0,(g.h-y)*g.topL/g.h-12)}px,transparent 0 ${g.w-Math.max(0,(g.h-y)*g.topL/g.h-12)}px,#ffd36b 0);filter:drop-shadow(0 0 6px #ff9a2e)"></div>`;
    L.innerHTML+=`<div style="position:absolute;left:14px;bottom:10px;font:900 13px sans-serif;color:#ffd36b;text-shadow:0 0 6px #ff5a2e">必殺ゲージ ${Math.round(charge*100)}%</div>`;}
  if(after>=0){const k=F.clamp(after/600);
    // 閃光(最後のノーツのあと・すぐ引く)
    L.innerHTML+=`<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% ${g.judgeY}px,rgba(255,255,255,${(1-k)*.85}),rgba(255,200,80,${(1-k)*.4}) 45%,rgba(0,0,0,0) 75%)"></div>`;
    // 衝撃波(判定ラインから広がる輪)
    const rw=120+k*700,rh=24+k*140;
    L.innerHTML+=`<div style="position:absolute;left:${g.cx-rw/2}px;top:${g.judgeY-rh/2}px;width:${rw}px;height:${rh}px;border-radius:50%;border:${6-4*k}px solid rgba(255,220,120,${1-k*.7});box-shadow:0 0 24px #ff8a2e"></div>`;
    L.innerHTML+=`<div style="position:absolute;left:0;right:0;top:${g.h*.2}px;text-align:center;font:900 ${64-10*k}px/1 sans-serif;color:#fff;-webkit-text-stroke:3px #c81e1e;text-shadow:0 0 18px #ffb02e,0 4px 0 #7a0a0a;transform:scale(${1.25-0.25*F.clamp(after/180)}) rotate(-4deg)">必殺技！</div>`;
    // 画面の揺れ(最初の0.25秒だけ・数px)
    if(after<250){const s=(1-after/250)*6;F.area().style.transform=`translate(${s}px,${-s*.6}px)`;}}
};
