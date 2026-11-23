// 案2「ききのカットイン」: 区間の頭で、ききが道の外(左)へ飛び込む → 区間中は叩くたびに赤金の火花 → 最後の一撃でききの決め台詞と花火
window.__mhMockFx=ms=>{const F=window.__fx;F.hideNow();const L=F.layer(),g=F.geo();L.innerHTML='';
  if(ms<F.FROM-100||ms>F.TO+600)return;
  const t=ms-F.FROM,after=ms-F.HIT;
  const kiki=(face,x,y,h,op)=>`<img src="images/assistant/${face}.PNG" style="position:absolute;left:${x}px;top:${y}px;height:${h}px;opacity:${op};filter:drop-shadow(0 0 10px #ff7a2e)">`;
  if(t<900){// カットイン: 帯もききも道の外(左の三角)で切り抜く(ノーツに重ねない)。0.9秒で引く
    const k=F.clamp(t/150),out=F.clamp((t-650)/250);let html='';
    html+=`<div style="position:absolute;left:${-30-out*260}px;top:${g.h*.16}px;width:300px;height:${g.h*.5}px;transform:skewX(-14deg);background:linear-gradient(90deg,rgba(200,20,30,.85),rgba(255,150,40,.75));clip-path:inset(0 ${100-k*100}% 0 0);box-shadow:0 0 18px #ff7a2e"></div>`;
    html+=kiki('kiki_excited',4-out*260+(1-k)*-120,g.h*.03,g.h*.5,1-out);
    html+=`<div style="position:absolute;left:${10-out*260}px;top:${g.h*.52}px;font:900 22px sans-serif;color:#fff;-webkit-text-stroke:1.5px #8a0a0a;opacity:${1-out}">いくでつ！</div>`;
    L.innerHTML+=`<div style="position:absolute;inset:0;clip-path:polygon(0 0,${g.topL-8}px 0,0 ${g.h}px)">${html}</div>`;}
  else if(after<0){// 区間中: ききは左下の外に小さく残り、判定ラインで叩いたところに赤金の火花
    L.innerHTML+=kiki('kiki_excited',6,g.h*.44,g.h*.34,.9);
    for(const x of [g.w*.33,g.w*.62]){L.innerHTML+=`<div style="position:absolute;left:${x-40}px;top:${g.judgeY-40}px;width:80px;height:80px;background:radial-gradient(circle,rgba(255,240,180,.95) 0 10%,rgba(255,120,30,.7) 30%,rgba(255,40,40,0) 65%);border-radius:50%"></div>`;
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;L.innerHTML+=`<i style="position:absolute;left:${x+Math.cos(a)*34}px;top:${g.judgeY+Math.sin(a)*20}px;width:5px;height:5px;background:#ffd36b;border-radius:50%;box-shadow:0 0 6px #ff7a2e"></i>`;}}}
  else{// 最後の一撃: ききが大きく前へ・決め台詞・花火(もう流れてくるノーツは無い)
    const k=F.clamp(after/250);
    L.innerHTML+=`<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 70%,rgba(255,210,120,${.55*(1-F.clamp(after/500))}),rgba(0,0,0,0) 70%)"></div>`;
    for(let i=0;i<5;i++){const x=g.w*(.2+i*.15),y=g.h*(.18+(i%2)*.12),r=20+k*40;L.innerHTML+=`<div style="position:absolute;left:${x-r}px;top:${y-r}px;width:${r*2}px;height:${r*2}px;border-radius:50%;background:radial-gradient(circle,transparent 45%,${['#ffd36b','#ff6a3d','#ff9ad5'][i%3]} 50%,transparent 62%)"></div>`;}
    L.innerHTML+=kiki('kiki_wink',g.w*.06,g.h*(.12+(1-k)*.3),g.h*.86,1);
    L.innerHTML+=`<div style="position:absolute;left:${g.w*.36}px;top:${g.h*.30}px;padding:8px 16px;border-radius:18px;background:#fff;border:3px solid #c81e1e;font:900 30px sans-serif;color:#c81e1e;transform:scale(${.6+.4*k})">必殺技でつ！</div>`;}
};
