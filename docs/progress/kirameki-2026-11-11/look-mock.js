// 見た目の案の「見本」(撮影と重さの見込みのためだけ。ゲーム本体には入っていない)。
//   node tools/mode/rhythm-weight-report.js --inject docs/progress/kirameki-2026-11-11/look-mock-A.js --shot <png>
// look-mock-A.js / -B.js / -C.js / -C2.js は、先頭に window.__MH_LOOK='A' などを足しただけの写し(make-mocks.sh が作る)。
// 本番で作るときは、この絵を「いまあるノーツの canvas / WebGL の同じ1枚」に描く(層を足さない)。見本は上に canvas を1枚重ねているので、重さは多めに出る。
(function(){
  const V=window.__MH_LOOK||'A';
  const sprite=(w,h,draw)=>{const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c;};
  const glow=(rgb)=>sprite(64,64,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);r.addColorStop(0,`rgba(255,255,255,1)`);r.addColorStop(.25,`rgba(${rgb},.85)`);r.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=r;g.fillRect(0,0,w,w);});
  const pillar=(rgb)=>sprite(64,256,(g,w,h)=>{const v=g.createLinearGradient(0,h,0,0);v.addColorStop(0,`rgba(255,255,255,.95)`);v.addColorStop(.12,`rgba(${rgb},.7)`);v.addColorStop(1,`rgba(${rgb},0)`);g.fillStyle=v;g.fillRect(0,0,w,h);
    g.globalCompositeOperation='destination-in';const s=g.createLinearGradient(0,0,w,0);s.addColorStop(0,'rgba(0,0,0,0)');s.addColorStop(.5,'rgba(0,0,0,1)');s.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=s;g.fillRect(0,0,w,h);});
  const ring=(rgb)=>sprite(256,96,(g,w,h)=>{g.shadowBlur=14;g.shadowColor=`rgba(${rgb},1)`;g.strokeStyle='rgba(255,255,255,.95)';g.lineWidth=5;g.beginPath();g.ellipse(w/2,h/2,w/2-22,h/2-22,0,0,Math.PI*2);g.stroke();g.stroke();});
  const boot=()=>{
    const area=document.querySelector('[data-rhythm-play-area]'),line=area&&area.querySelector('[data-rhythm-judgment-line]');
    if(!area||!line||typeof rhythmProjectBoundary!=='function'||!/0:0[2-9]/.test(document.querySelector('[data-rhythm-song-clock]')?.textContent||'')){requestAnimationFrame(boot);return;}
    const r=area.getBoundingClientRect(),lr=line.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),W=r.width,H=r.height,ly=lr.top+lr.height/2-r.top,yr=ly/H;
    const c=document.createElement('canvas');c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:'+(V==='B'?1:4);area.appendChild(c);
    const g=c.getContext('2d');g.scale(dpr,dpr);
    const X=(lane,y)=>W*rhythmProjectBoundary(lane,y/H),laneW=X(1,ly)-X(0,ly);
    const GOLD=glow('253,224,71'),CYAN=glow('103,232,249'),PINK=glow('244,114,182'),PILLAR=pillar('125,211,252'),PILLAR_G=pillar('253,224,71'),RING=ring('125,211,252'),VIOLET=glow('167,139,250');
    const bursts=[];let lastCombo=0,milestoneAt=-1e9;
    area.addEventListener('touchstart',e=>{for(const t of e.changedTouches){if(bursts.length>=10)bursts.shift();bursts.push({x:t.clientX-r.left,t:performance.now(),seed:Math.random()*10});}},true);
    const confetti=[...Array(46)].map((_,i)=>({x:Math.random(),y:Math.random(),s:.5+Math.random(),h:[50,190,320,140,280][i%5],p:Math.random()*6}));
    const frame=now=>{
      g.clearRect(0,0,W,H);g.globalCompositeOperation='lighter';
      if(V==='A'){
        for(const b of bursts){const t=(now-b.t)/380;if(t>=1)continue;const k=1-t;
          const ph=H*.46*(.55+.45*t),pw=laneW*.95;g.globalAlpha=k;g.drawImage(t<.5?PILLAR_G:PILLAR,b.x-pw/2,ly-ph,pw,ph);
          const R=laneW*(.55+1.15*t);g.globalAlpha=k;g.drawImage(RING,b.x-R,ly-R*.3,R*2,R*.6);
          const f=laneW*1.9*(1-t*.5);g.globalAlpha=k;g.drawImage(GOLD,b.x-f/2,ly-f/2,f,f);
          for(let i=0;i<8;i++){const a=-Math.PI/2+(i-3.5)*.34+Math.sin(b.seed+i)*.2,sp=laneW*(1.3+((i*7+b.seed)%3)*.5);const px=b.x+Math.cos(a)*sp*t,py=ly+Math.sin(a)*sp*t+90*t*t,s=9*k+2;g.globalAlpha=k;g.drawImage(i%2?CYAN:GOLD,px-s,py-s,s*2,s*2);}}
      }
      if(V==='B'){
        const beat=.5+.5*Math.sin(now/1000*Math.PI*2*2.6),top=H*.02;
        g.globalAlpha=.3+.2*beat;const vg=W*.5;g.drawImage(VIOLET,W/2-vg/2,top-vg*.28,vg,vg*.56);
        for(let i=0;i<=6;i++){const edge=i===0||i===6;
          if(edge){g.globalAlpha=.3+.15*beat;g.strokeStyle=i?'#f0abfc':'#67e8f9';g.lineWidth=7;g.beginPath();g.moveTo(X(i,top),top);g.lineTo(X(i,H),H);g.stroke();}
          for(let k=0;k<3;k++){const p=((now/1000*.55+k/3+i*.17)%1),y0=top+(H-top)*p*p,y1=Math.min(H,y0+H*.1*(.2+p));g.globalAlpha=.25+.6*p;g.strokeStyle=i%2?'#a5b4fc':'#67e8f9';g.lineWidth=1+2.4*p;g.beginPath();g.moveTo(X(i,y0),y0);g.lineTo(X(i,y1),y1);g.stroke();}}
        const x0=X(0,ly),x1=X(6,ly),bh=34+10*beat;g.globalAlpha=.75;g.drawImage(CYAN,x0-30,ly-bh/2,x1-x0+60,bh);g.globalAlpha=.55;g.drawImage(PINK,x0+(x1-x0)*.25,ly-bh*.4,(x1-x0)*.5,bh*.8);
        g.globalAlpha=1;g.fillStyle='#fff';g.fillRect(x0,ly-1.5,x1-x0,3);
        for(let i=0;i<=6;i++){const s=10+4*beat;g.globalAlpha=.9;g.drawImage(GOLD,X(i,ly)-s,ly-s,s*2,s*2);}
        for(const b of bursts){const t=(now-b.t)/260;if(t>=1)continue;const f=laneW*(1.2+t);g.globalAlpha=1-t;g.drawImage(CYAN,b.x-f/2,ly-f*.3,f,f*.6);}
      }
      if(V==='C'||V==='C2'){
        const cb=document.querySelector('[data-rhythm-combo]'),combo=Number((cb&&cb.textContent||'').replace(/\D/g,''))||0;
        if(combo!==lastCombo){if(combo>0&&combo%10===0)milestoneAt=now;lastCombo=combo;}
        if(cb&&combo>1){const br=cb.getBoundingClientRect(),cx=br.left+br.width/2-r.left,cy=br.top+br.height/2-r.top,heat=Math.min(1,combo/60);
          const a=br.width*(1.6+.5*heat);g.globalAlpha=.35+.35*heat;g.drawImage(heat>.6?GOLD:CYAN,cx-a/2,cy-a*.35,a,a*.7);
          const mt=(now-milestoneAt)/520;if(mt<1){const k=1-mt;g.globalAlpha=k;const R=br.width*(.6+1.6*mt);g.drawImage(RING,cx-R,cy-R*.5,R*2,R);
            g.strokeStyle='#fde68a';g.lineWidth=3*k+1;for(let i=0;i<14;i++){const an=i/14*Math.PI*2,r0=br.width*(.5+.9*mt),r1=r0+br.width*.5*k;g.beginPath();g.moveTo(cx+Math.cos(an)*r0,cy+Math.sin(an)*r0*.6);g.lineTo(cx+Math.cos(an)*r1,cy+Math.sin(an)*r1*.6);g.stroke();}}
          const n=combo>=40?9:combo>=20?6:3;for(const side of [0,1])for(let i=0;i<n;i++){const p=((now/1000*(.9+heat)+i/n+side*.37)%1),x=side?W-6-(i%3)*9:6+(i%3)*9,y=H*p,len=H*(.1+.12*heat);g.globalAlpha=(.25+.45*heat)*Math.sin(p*Math.PI);g.drawImage(heat>.6?PILLAR_G:PILLAR,x-5,y-len,10,len);}}
      }
      if(V==='C2'){
        g.globalCompositeOperation='source-over';const t=(now/1000)%4,cy=H*.45,bh=H*.3;
        const band=g.createLinearGradient(0,cy-bh/2,0,cy+bh/2);band.addColorStop(0,'rgba(2,6,23,0)');band.addColorStop(.2,'rgba(2,6,23,.82)');band.addColorStop(.8,'rgba(2,6,23,.82)');band.addColorStop(1,'rgba(2,6,23,0)');g.globalAlpha=1;g.fillStyle=band;g.fillRect(0,cy-bh/2,W,bh);
        g.globalCompositeOperation='lighter';g.globalAlpha=.9;g.drawImage(GOLD,-W*.1,cy-bh*.5-6,W*1.2,12);g.drawImage(CYAN,-W*.1,cy+bh*.5-6,W*1.2,12);
        const fs=Math.min(W*.11,bh*.62);g.font=`italic 900 ${fs}px system-ui,sans-serif`;g.textAlign='center';g.textBaseline='middle';
        const tg=g.createLinearGradient(W*.2,0,W*.8,0);tg.addColorStop(0,'#fde047');tg.addColorStop(.35,'#f472b6');tg.addColorStop(.7,'#67e8f9');tg.addColorStop(1,'#fde047');
        g.globalCompositeOperation='source-over';g.shadowBlur=24;g.shadowColor='rgba(253,224,71,.9)';g.fillStyle=tg;g.fillText('FULL COMBO',W/2,cy);g.shadowBlur=0;g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.9)';g.strokeText('FULL COMBO',W/2,cy);
        g.globalCompositeOperation='lighter';const sx=-W*.2+W*1.4*((t/1.6)%1);g.globalAlpha=.55;g.save();g.translate(sx,cy);g.rotate(.35);g.drawImage(PILLAR,-40,-bh,80,bh*2);g.restore();
        g.globalCompositeOperation='source-over';for(const p of confetti){const y=((p.y+now/1000*.22*p.s)%1)*H,x=p.x*W+Math.sin(now/600+p.p)*14;g.globalAlpha=.9;g.fillStyle=`hsl(${p.h},95%,65%)`;g.save();g.translate(x,y);g.rotate(now/300*p.s+p.p);g.fillRect(-4,-2,8,4);g.restore();}
      }
      g.globalAlpha=1;requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
