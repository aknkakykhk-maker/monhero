#!/usr/bin/env node
// スライドの形の見本図を撮る(2026-11-23 台帳 r1119-129・追跡表 r1123-016「スライドの形の種類を増やす案」)。
//
//   node tools/mode/rhythm-slide-shape-sheet.js [出力先のフォルダ]
//
// ゲーム本体(monster-hero/data/rhythm-mode.js)をそのまま読み込み、帯の中心と判定の的を
// 本体の rhythmSlideExpectedLane・rhythmSlideWidthAt で求めて、6レーンの道に奥行きの縮みを付けて描く。
// 本物の演奏画面ではなく「形の見比べ」のための図(背景・ノーツの板・光は描かない)。
// 「通り抜け」(新しい種類の案)だけはまだ本体に無いので、この道具の中の試しの式で描く(行き過ぎない3次の曲線・Steffen の傾き)。
const path=require('path'),fs=require('fs');
const ROOT=path.resolve(__dirname,'../..');
const OUT=path.resolve(process.argv[2]||path.join(ROOT,'docs/progress/beat/slide-shapes-2026-11-23'));
fs.mkdirSync(OUT,{recursive:true});

// [時刻ms, レーン, ease] の並び。ease は本体と同じ in / out / inout、'through' は新しい種類の案
const SHAPES={
  now_kink:{title:'いま① 同じ向きで速さが変わる点',sub:'直線のまま → 点で折れる',kind:'いま',pts:[[0,0],[500,1],[900,4],[1500,5]]},
  now_s:{title:'いま② 折り返しは S 字',sub:'生成の道具の既定(inout)',kind:'いま',pts:[[0,1,'inout'],[650,4,'inout'],[1300,1]]},
  arc:{title:'案A 弧',sub:'1区間だけ out',kind:'今の曲線',pts:[[0,0,'out'],[1300,4.5]]},
  bigS:{title:'案A 大きな S',sub:'in → out(点で止まらない)',kind:'今の曲線',pts:[[0,0,'in'],[700,2.5,'out'],[1400,5]]},
  wave:{title:'案A 波',sub:'inout を続ける',kind:'今の曲線',pts:[[0,1,'inout'],[400,3,'inout'],[800,1,'inout'],[1200,3,'inout'],[1600,1]]},
  hairpin:{title:'案A 行って戻る',sub:'out → in(丸い折り返し)',kind:'今の曲線',pts:[[0,0,'out'],[700,4.5,'in'],[1400,0]]},
  mix:{title:'案A ジグザグ→曲線',sub:'速い折れのあとに S 字',kind:'今の曲線',pts:[[0,1],[250,3],[500,1],[750,3,'inout'],[1350,0.5]]},
  through:{title:'案B 通り抜け(新しい種類)',sub:'いま①と同じ点・折れない',kind:'新しい種類',pts:[[0,0,'through'],[500,1,'through'],[900,4,'through'],[1500,5]]},
  uneven_lin:{title:'いま③ 不ぞろいな点(直線)',sub:'点ごとに向きが変わって見える',kind:'いま',pts:[[0,0],[300,1.5],[800,2],[1100,4],[1600,4.5]]},
  uneven_thr:{title:'案B 同じ点を通り抜け',sub:'点は同じ・その間だけ曲がる',kind:'新しい種類',pts:[[0,0,'through'],[300,1.5,'through'],[800,2,'through'],[1100,4,'through'],[1600,4.5]]},
};
const SHEETS=[
  {file:'shapes',keys:['now_kink','now_s','arc','bigS','wave','hairpin','mix','through']},
  {file:'through-compare',keys:['now_kink','through','uneven_lin','uneven_thr']},
];

const page=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0d1020;font-family:'Noto Sans CJK JP','Noto Sans JP',sans-serif}</style>
<canvas id="c"></canvas><script src="/monster-hero/data/rhythm-mode.js"></script><script>
// 新しい種類の案(through): 行き過ぎない3次の曲線。点 k の傾きは前後の区間だけで決まる(Steffen)
const sec=(a,b)=>{const h=b.timeMs-a.timeMs;return h>0?(b.lane-a.lane)/h:0;};
const tan=(P,k)=>{const n=P.length;if(n===2)return sec(P[0],P[1]);
  if(k<=0||k>=n-1){const e=k<=0?0:n-2,f=k<=0?1:n-3,de=sec(P[e],P[e+1]),df=sec(P[f],P[f+1]),he=P[e+1].timeMs-P[e].timeMs,hf=P[f+1].timeMs-P[f].timeMs;
    const pe=de*(1+he/(he+hf))-df*he/(he+hf);if(pe*de<=0)return 0;return Math.abs(pe)>2*Math.abs(de)?2*de:pe;}
  const h0=P[k].timeMs-P[k-1].timeMs,h1=P[k+1].timeMs-P[k].timeMs,d0=sec(P[k-1],P[k]),d1=sec(P[k],P[k+1]);if(d0*d1<=0)return 0;
  const p=(d0*h1+d1*h0)/(h0+h1);return (Math.sign(d0)+Math.sign(d1))*Math.min(Math.abs(d0),Math.abs(d1),.5*Math.abs(p));};
const throughLane=(note,t)=>{const P=note.slidePoints;let i=1;while(i<P.length-1&&t>P[i].timeMs)i++;
  const a=P[i-1],b=P[i],h=b.timeMs-a.timeMs,x=Math.max(0,Math.min(1,(t-a.timeMs)/h)),ma=tan(P,i-1)*h,mb=tan(P,i)*h,x2=x*x,x3=x2*x;
  const v=(2*x3-3*x2+1)*a.lane+(x3-2*x2+x)*ma+(-2*x3+3*x2)*b.lane+(x3-x2)*mb;
  return rhythmSlideFittedLane(Math.max(Math.min(a.lane,b.lane),Math.min(Math.max(a.lane,b.lane),v)),rhythmSlideWidthAt(note,t));};
const laneAt=(note,t)=>note._through?throughLane(note,t):rhythmSlideExpectedLane(note,t);
window.draw=(sheet,landscape)=>{
  const cols=landscape?2:4,pw=landscape?520:250,ph=landscape?250:500,rows=Math.ceil(sheet.length/cols),head=landscape?44:56;
  const c=document.getElementById('c'),S=2;c.width=cols*pw*S;c.height=rows*(ph+head)*S;c.style.width=cols*pw+'px';
  const g=c.getContext('2d');g.scale(S,S);g.fillStyle='#0d1020';g.fillRect(0,0,cols*pw,rows*(ph+head));
  sheet.forEach((shape,idx)=>{
    const ox=(idx%cols)*pw,oy=Math.floor(idx/cols)*(ph+head);
    const col={'いま':'#9aa3b8','今の曲線':'#7fd4ff','新しい種類':'#ffcf5a'}[shape.kind];
    g.fillStyle=col;g.font='bold '+(landscape?15:14)+'px sans-serif';g.fillText(shape.title,ox+10,oy+20);
    g.fillStyle='#c8cee0';g.font=(landscape?12:12)+'px sans-serif';g.fillText(shape.sub,ox+10,oy+(landscape?37:40));
    const y0=oy+head;
    // 道: 判定ライン(下)から奥(上)へ。奥行き z=1+3p で縮める
    const lineY=y0+ph*(landscape?.86:.84),topY=y0+ph*.04,cx=ox+pw/2,roadW=landscape?pw*.62:pw*.92;
    const K=3,proj=(p,lane)=>{const z=1+K*p,yy=topY+(lineY-topY)*((1/z-1/(1+K))/(1-1/(1+K)));return {x:cx+(lane-3)*roadW/6/z,y:yy,s:1/z};};
    g.fillStyle='#161b33';g.beginPath();const a=proj(1,0),b=proj(1,6),cc=proj(0,6),d=proj(0,0);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(cc.x,cc.y);g.lineTo(d.x,d.y);g.fill();
    g.strokeStyle='rgba(255,255,255,.12)';g.lineWidth=1;for(let l=0;l<=6;l++){const u=proj(1,l),v=proj(0,l);g.beginPath();g.moveTo(u.x,u.y);g.lineTo(v.x,v.y);g.stroke();}
    g.strokeStyle='#e8ecff';g.lineWidth=2;g.beginPath();g.moveTo(d.x-6,lineY);g.lineTo(cc.x+6,lineY);g.stroke();
    const pts=shape.pts.map(([timeMs,lane,ease])=>({timeMs,lane,...(ease&&ease!=='through'?{ease}:{})}));
    const note={type:'SLIDE',timeMs:pts[0].timeMs,endTimeMs:pts[pts.length-1].timeMs,lane:pts[0].lane,endLane:pts[pts.length-1].lane,subLaneWidth:2,slidePoints:pts,_through:shape.pts.some(p=>p[2]==='through')};
    const T=note.endTimeMs,travel=T*1.08,pOf=t=>(t+travel*.03)/travel;
    const R=[],L=[];for(let k=0;k<=240;k++){const t=T*k/240,lane=laneAt(note,t)+.5,half=rhythmSlideWidthAt(note,t)/4;R.push(proj(pOf(t),lane+half));L.push(proj(pOf(t),lane-half));}
    g.fillStyle=shape.kind==='新しい種類'?'rgba(255,190,70,.55)':'rgba(90,200,255,.5)';g.beginPath();R.forEach((q,i)=>i?g.lineTo(q.x,q.y):g.moveTo(q.x,q.y));L.slice().reverse().forEach(q=>g.lineTo(q.x,q.y));g.closePath();g.fill();
    g.strokeStyle=shape.kind==='新しい種類'?'#ffd98a':'#bfeaff';g.lineWidth=1.5;g.stroke();
    // 判定の的(追う位置): 本体と同じ関数で 50ms ごとに点を打つ。帯の真ん中を通っていれば見た目と同じ道
    g.fillStyle='#ff5d8f';for(let t=0;t<=T;t+=50){const q=proj(pOf(t),laneAt(note,t)+.5);g.beginPath();g.arc(q.x,q.y,Math.max(1.2,2.6*q.s),0,7);g.fill();}
    // 譜面の点
    g.fillStyle='#fff';g.strokeStyle='#0d1020';pts.forEach(p=>{const q=proj(pOf(p.timeMs),rhythmSlideFittedLane(p.lane,2)+.5);g.beginPath();g.arc(q.x,q.y,Math.max(2.5,5*q.s),0,7);g.fill();g.stroke();});
  });
  return c.toDataURL('image/png');
};
</script>`;

(async()=>{
  const http=require('http');
  const server=http.createServer((req,res)=>{
    if(req.url==='/'||req.url.startsWith('/?')){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(page);return;}
    const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
    if(!f.startsWith(ROOT)||!fs.existsSync(f)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'text/javascript'});fs.createReadStream(f).pipe(res);
  }).listen(0);
  const port=server.address().port;
  const browser=await require('playwright').chromium.launch();
  const tab=await browser.newPage();
  await tab.goto(`http://localhost:${port}/`,{waitUntil:'load',timeout:120000});
  await tab.waitForFunction(()=>typeof rhythmSlideExpectedLane==='function'&&typeof window.draw==='function',null,{timeout:120000});
  for(const sheet of SHEETS)for(const landscape of [false,true]){
    const url=await tab.evaluate(([s,l])=>window.draw(s,l),[sheet.keys.map(k=>SHAPES[k]),landscape]);
    const file=path.join(OUT,`${sheet.file}-${landscape?'yoko':'tate'}.png`);
    fs.writeFileSync(file,Buffer.from(url.split(',')[1],'base64'));
    console.log('書いた',path.relative(ROOT,file));
  }
  await browser.close();server.close();
})().catch(e=>{console.error(e);process.exit(1);});
