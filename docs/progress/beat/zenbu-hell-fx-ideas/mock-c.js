// 案3「道が技になる」: 区間中、道の縁が赤金の炎になり、道の奥に光の玉が溜まる(ノーツの色・形は変えない) → 最後の一撃で玉が道を走って画面を白く抜く
window.__mhMockFx=ms=>{const F=window.__fx;F.hideNow();const L=F.layer(),g=F.geo();L.innerHTML='';
  if(ms<F.FROM-100||ms>F.TO+600)return;
  const charge=F.clamp((ms-F.FROM)/(F.HIT-F.FROM)),after=ms-F.HIT;
  const svg=(body)=>`<svg width="${g.w}" height="${g.h}" viewBox="0 0 ${g.w} ${g.h}" style="position:absolute;inset:0">${body}</svg>`;
  const flick=0.6+0.4*Math.sin(ms/60);
  const edges=`<defs><linearGradient id="fe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd36b"/><stop offset="1" stop-color="#ff3a2e"/></linearGradient>
    <filter id="gl"><feGaussianBlur stdDeviation="4"/></filter></defs>
    <g opacity="${after<0?.9:F.clamp(1-after/500)*.9}"><line x1="${g.topL}" y1="0" x2="${g.botL}" y2="${g.h}" stroke="url(#fe)" stroke-width="${10*flick}" filter="url(#gl)"/>
    <line x1="${g.topR}" y1="0" x2="${g.botR}" y2="${g.h}" stroke="url(#fe)" stroke-width="${10*flick}" filter="url(#gl)"/>
    <line x1="${g.topL}" y1="0" x2="${g.botL}" y2="${g.h}" stroke="#ffe7a8" stroke-width="2"/><line x1="${g.topR}" y1="0" x2="${g.botR}" y2="${g.h}" stroke="#ffe7a8" stroke-width="2"/></g>`;
  let body=edges;
  if(after<0){// 奥の光の玉(溜まるほど大きく)。道の奥の端に置くので、手前のノーツには重ならない
    const r=8+charge*30;body+=`<circle cx="${g.cx}" cy="${r*.5}" r="${r*1.8}" fill="#ff7a2e" opacity=".35" filter="url(#gl)"/><circle cx="${g.cx}" cy="${r*.5}" r="${r}" fill="#ffe7a8" opacity=".9"/>`;
    // 道の床をうっすら赤金に(ノーツより下の層のつもり)
    L.innerHTML+=`<div style="position:absolute;inset:0;clip-path:polygon(${g.topL}px 0,${g.topR}px 0,${g.botR}px ${g.h}px,${g.botL}px ${g.h}px);background:linear-gradient(to bottom,rgba(255,90,40,${.10+.12*charge}),rgba(255,180,60,.04));mix-blend-mode:screen"></div>`;}
  else{// 放つ: 玉が道を一直線に走る → 白く抜けて、星が散る
    const k=F.clamp(after/220),y=k*g.judgeY;
    body+=`<polygon points="${g.cx-14},0 ${g.cx+14},0 ${g.cx+40+k*120},${y} ${g.cx-40-k*120},${y}" fill="#ffe7a8" opacity="${.85*(1-F.clamp((after-220)/300))}" filter="url(#gl)"/>`;
    body+=`<circle cx="${g.cx}" cy="${y}" r="${30+k*40}" fill="#fff" opacity="${1-F.clamp((after-220)/300)}"/>`;
    if(after>200){const s=F.clamp((after-200)/400);for(let i=0;i<14;i++){const a=i/14*Math.PI*2;body+=`<path d="M0,-7 L2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2Z" fill="#ffd36b" transform="translate(${g.cx+Math.cos(a)*s*300},${g.judgeY+Math.sin(a)*s*120}) scale(${1.4-s*.6})"/>`;}}
    L.innerHTML+=`<div style="position:absolute;inset:0;background:#fff;opacity:${after<220?0:.7*(1-F.clamp((after-220)/280))}"></div>`;}
  L.innerHTML+=svg(body);
};
