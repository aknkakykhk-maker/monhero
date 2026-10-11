#!/usr/bin/env node
// 参考譜面に寄せる道具 段1b: 流れの速さ(2026-10-11・オンプくん。社長「せっかく参考動画も上げてるんだから、もっとそれを解析して活かして」)
// 決まり: docs/playbot/REFERENCE_VIDEO.md(作る前に、動画から流れの速さ・演出中のノーツ・待っているノーツを読み取って表にする)
//
//   node tools/mode/rhythm-ref-flow.js --track <曲id> --video <参考動画> --profile <約束の表の名前> --offset <秒>
//   node tools/mode/rhythm-ref-flow.js ... --audio <ゲームの音源>          # --offset の代わりに、音の包絡でずれを測る
//   node tools/mode/rhythm-ref-flow.js ... --from <参考の秒> --to <参考の秒>  # 区間だけ(既定は動画の全部)
//   node tools/mode/rhythm-ref-flow.js ... --sheet                         # 軌跡図(縦=時間・横=道の奥行き)も書き出す
//
// 【何をするか】
//   1. 道の奥行き: 画面の高さ y を、消失点 vp からの 1/(y−vp) で「道の上の距離」に直す(遠くほど縮む分を戻す)。
//      p = 0 が道の奥の端、p = 1 が判定線。ふだんの流れでは p は時間に比例して増える
//   2. コマ: ノーツの明るさ(白さ)から、区間の中央値(=動かない背景)を引き、行ごとに足して p の上に並べる
//   3. 流れ: となりのコマどうしで、p の並びがどれだけずれたかを相関で求める(全部のノーツがそろって動く量)。
//      1つずつのノーツを追うと、ほぼ等間隔に並んだ隣のノーツと取り違える(Grievous Lady の答え合わせで分かった)ので、
//      まとめて動く量を正本にする
//   4. 区間: ふだんの速さ(中央値)と比べて、止まる・前へ飛ぶ・戻る・速い・遅いのコマを続きごとにまとめる
//   5. 演出中のノーツ: その区間に判定線を越えたノーツの時刻の数(同じ高さに並ぶ同時押しは1つ)と、
//      区間の始まりに道の上に見えているノーツの位置(道の%。奥行きと見た目の両方)
//
// 【時刻】ずれは「参考の時刻 = 曲の時刻 + ずれ」(段1 rhythm-ref-capture.js と同じ向き)。書き出す時刻は曲の時刻(ms)
// 【決めごと】読み取った表は参考譜面の写しに近いので、書き出すのは tools/mode/ref-work/<曲id>/ だけ(リポジトリに置かない)
'use strict';
const fs=require('fs'),path=require('path');
const {execFileSync}=require('child_process');
const {loadProfile,workDirFor,assertWorkPath,measureOffset,REPO_ROOT}=require('./rhythm-ref-capture.js');

const N=240;   // 奥行きの刻み
const KIND={stop:'止まる',jump:'前へ飛ぶ',back:'戻る',fast:'速い',slow:'遅い'};

// ── 1. 道の奥行き ──
const zOf=(y,g)=>1/(y-g.vp);
const pOf=(y,g)=>(zOf(g.farY,g)-zOf(y,g))/(zOf(g.farY,g)-zOf(g.judgeY,g));
const yOf=(p,g)=>g.vp+1/(zOf(g.farY,g)-p*(zOf(g.farY,g)-zOf(g.judgeY,g)));
// 判定線から奥へ何%か: 奥行き(道の上の距離)と、見た目(画面の高さ)の2つ
const depthBack=p=>Math.round((1-p)*100);
const screenBack=(p,g)=>Math.round((g.judgeY-yOf(p,g))/(g.judgeY-g.farY)*100);

// ── 2. コマ ──
const decode=(video,fromSec,durSec,g)=>{
  // 切り出しの位置と大きさは偶数にそろえる(動画の色は2×2の画素でまとめて持つので、奇数から切ると色がずれて白さを読み違える)
  const even=v=>v-(v%2),top=even(Math.floor(g.farY-4)),h=even(Math.ceil(g.judgeY+6)-top+1),w=even(g.x1-g.x0),x0=even(g.x0);
  const buf=execFileSync('ffmpeg',['-v','error','-ss',String(Math.max(0,fromSec)),'-t',String(durSec),'-i',video,
    '-vf',`fps=${g.fps},crop=${w}:${h}:${x0}:${top}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:2**31});
  const n=Math.floor(buf.length/(w*h*3)),frames=[];
  for(let i=0;i<n;i++){const f=new Uint8Array(w*h);
    for(let j=0;j<w*h;j++){const o=(i*w*h+j)*3,r=buf[o],gg=buf[o+1],b=buf[o+2];
      const mn=Math.min(r,gg,b),mx=Math.max(r,gg,b);
      // 白さ: 明るく、色味が少ない(R・G・B の差が小さい)。肌(指)や色の付いた光は外す
      f[j]=g.metric==='luma'?Math.round(0.299*r+0.587*gg+0.114*b):(mx-mn<=(g.maxChroma||255)&&mn>=(g.whiteMin||0)?mn:0);}
    frames.push(f);}
  return {frames,w,h,top};
};
const median=(frames,len)=>{const step=Math.max(1,Math.floor(frames.length/31)),s=[];for(let i=0;i<frames.length;i+=step)s.push(frames[i]);
  const out=new Uint8Array(len),tmp=new Uint8Array(s.length);
  for(let j=0;j<len;j++){for(let k=0;k<s.length;k++)tmp[k]=s[k][j];tmp.sort();out[j]=tmp[tmp.length>>1];}
  return out;};
// 1コマの「ノーツの明るさ」を p の上に並べる
const profileOf=(f,bg,{w,h,top},g)=>{
  const prof=new Float64Array(N),cnt=new Float64Array(N);
  for(let y=0;y<h;y++){const p=pOf(top+y,g),b=Math.round(p*(N-1));if(b<0||b>=N)continue;
    // 道の内側だけ: 半幅は消失点からの距離に比例する(奥ほど細い)。端の飾りを避けて内側 inner の割合だけ見る
    const hw=g.hwJudge?g.hwJudge*(top+y-g.vp)/(g.judgeY-g.vp)*(g.inner||0.8):Infinity,xa=g.hwJudge?Math.max(0,Math.round(g.cx-hw-g.x0)):0,xb=g.hwJudge?Math.min(w,Math.round(g.cx+hw-g.x0)):w;
    // 外す四角(コンボの数字など、画面に重なって出る白い文字)
    const yy=top+y,masks=(g.masks||[]).filter(m=>yy>=m[1]&&yy<=m[3]);
    let s=0;for(let x=xa;x<xb;x++){const X=x+g.x0;if(masks.some(m=>X>=m[0]&&X<=m[2]))continue;const v=f[y*w+x]-bg[y*w+x]-g.fgMin;if(v>0)s+=v;}
    prof[b]+=xb>xa?s/(xb-xa):0;cnt[b]++;}
  // 行の無い刻み(道の奥では1行が何刻みにもまたがる)は埋めない。埋めると奥の部分が平らに伸びて相関を支配し、手前のノーツの動きが効かなくなる
  for(let i=0;i<N;i++)prof[i]=cnt[i]?prof[i]/cnt[i]:0;
  return prof;
};
// 3. となりのコマとのずれ(p の刻み)。中身が無いコマは null
const shiftOf=(a,b,g)=>{
  const lim=Math.floor((g.corrMaxP||0.9)*(N-1)),maxS=Math.ceil(0.45*(N-1));
  let ea=0;for(let i=0;i<lim;i++)ea+=a[i]*a[i];if(ea<(g.minEnergy||0.5))return null;
  let best=null;
  for(let s=-maxS;s<=maxS;s++){let c=0,eb=0;for(let i=0;i<lim;i++){const j=i+s;if(j<0||j>=N)continue;c+=a[i]*b[j];eb+=b[j]*b[j];}
    const r=eb>0?c/Math.sqrt(ea*eb):0;if(!best||r>best.r)best={s,r};}
  return best&&best.r>=(g.minCorr||0.75)?{dp:best.s/(N-1),r:best.r}:null;
};
// 3'. ずれごとの点数(正規化した相関)の並び。中身が無いコマは null
const MAXS=Math.ceil(0.45*(N-1));
const shiftScores=(a,b,g)=>{
  const lim=Math.floor((g.corrMaxP||0.9)*(N-1));let ea=0;for(let i=0;i<lim;i++)ea+=a[i]*a[i];if(ea<(g.minEnergy||1e-3))return null;
  const out=new Float64Array(2*MAXS+1);
  for(let s=-MAXS;s<=MAXS;s++){let c=0,eb=0;for(let i=0;i<lim;i++){const j=i+s;if(j<0||j>=N)continue;c+=a[i]*b[j];eb+=b[j]*b[j];}out[s+MAXS]=eb>0?c/Math.sqrt(ea*eb):0;}
  return out;};
// 速さは急には変わらない: コマごとの点数から、ずれの変化に罰を付けて、いちばんつながりのよい道筋を選ぶ(取り違えの跳ねを消す)。
// 本当の「一瞬で飛ぶ」は罰の上限(jumpCost)を払えば選べる
const smoothShifts=(scores,g)=>{
  const K=2*MAXS+1,T=scores.length,lam=g.smoothPerBin||0.01,cap=g.jumpCost||0.35;
  let prev=new Float64Array(K),back=[];
  for(let t=0;t<T;t++){const sc=scores[t],cur=new Float64Array(K),bp=new Int16Array(K);
    for(let k=0;k<K;k++){let best=-Infinity,bk=0;
      for(let j=0;j<K;j++){const v=prev[j]-Math.min(cap,lam*Math.abs(k-j));if(v>best){best=v;bk=j;}}
      cur[k]=best+(sc?sc[k]:0);bp[k]=bk;}
    back.push(bp);prev=cur;}
  let k=0;for(let j=1;j<K;j++)if(prev[j]>prev[k])k=j;
  const path=new Array(T);for(let t=T-1;t>=0;t--){path[t]=k;k=back[t][k];}
  return path.map((k2,t)=>scores[t]?{dp:(k2-MAXS)/(N-1),r:scores[t][k2]}:null);};
const peaksOf=(prof,g)=>{const out=[],sp=Math.max(1,Math.round(0.03*(N-1))),min=g.peakMin||1.5;
  for(let i=1;i<N-1;i++){if(prof[i]<min)continue;let ok=true;
    for(let k=Math.max(0,i-sp);k<=Math.min(N-1,i+sp);k++)if(prof[k]>prof[i]||(prof[k]===prof[i]&&k<i)){ok=false;break;}
    if(ok)out.push(+(i/(N-1)).toFixed(3));}
  return out;};
// ── 読み取り ──
const readFlow=({video,profile,fromSec=0,toSec=null,offsetSec=0})=>{
  const g=profile.flow;if(!g)throw new Error('約束の表にこの動画の flow(道の形)が無い');
  const fps=g.fps;
  const videoDur=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',video]).toString());
  const dur=toSec==null?videoDur:Math.min(toSec,videoDur);
  // 背景(動かない物)は、区切りの前後3秒まで足した長さの中央値でとる(短いと、ゆっくり動くノーツや同じ所に続くノーツを背景と取り違える)
  const frames=[];const CH=6,MG=3;
  for(let c=fromSec;c<dur;c+=CH){
    const a=Math.max(0,c-MG),d=decode(video,a,Math.min(videoDur,c+CH+MG)-a,g);if(!d.frames.length)continue;
    const bg=median(d.frames,d.w*d.h);const profs=d.frames.map(f=>profileOf(f,bg,d,g));
    // 白いノーツが道の上にほとんど無いコマ(アークだけの所・音の休み)は「読めない」にする。目安はこの区切りの中央値の15%
    const lim=Math.floor((g.corrMaxP||0.9)*(N-1)),energy=profs.map(p=>{let e=0;for(let i=0;i<lim;i++)e+=p[i]*p[i];return e;});
    const sorted=energy.slice().sort((x,y)=>x-y),gg={...g,minEnergy:Math.max(g.minEnergy||1e-3,(g.minEnergyRatio||0.15)*sorted[sorted.length>>1])};
    const scores=[null];for(let i=1;i<profs.length;i++)scores.push(shiftScores(profs[i-1],profs[i],gg));
    const smooth=smoothShifts(scores,g);
    for(let i=1;i<profs.length;i++){const t=a+i/fps;if(t<c||t>=Math.min(dur,c+CH))continue;
      const sh=smooth[i]&&smooth[i].r>=(g.minCorr||0)?smooth[i]:null,pk=peaksOf(profs[i],g);
      // 判定線を越えたノーツ: 1つ前のコマで p≥0.88 にあり、ずれを足すと1を越えるもの
      // 同じ高さに並ぶ同時押しは1つに数える(横の塊で数えると、指や叩いた光まで数えてしまう)。判定線のすぐ手前の動かない光は、ずれが0なので越えない
      let crossed=0;if(sh&&sh.dp>0)for(const p of peaksOf(profs[i-1],g))if(p>=0.85&&p<(g.leadMaxP||0.9)+0.1&&p+sh.dp>=1)crossed++;
      frames.push({ref:+t.toFixed(3),songMs:Math.round((t-offsetSec)*1000),dp:sh?+sh.dp.toFixed(4):null,r:sh?+sh.r.toFixed(2):null,peaks:pk,crossed});}
  }
  // ふだんの速さ(1秒に進む p)
  const ok=frames.filter(f=>f.dp!=null&&f.dp>0&&f.r>=0.85).map(f=>f.dp*fps).sort((a,b)=>a-b);
  const v0=ok.length?ok[Math.floor(ok.length/2)]:null;
  const kindOf=f=>{if(f.dp==null||!v0)return null;const rate=f.dp*fps/v0;
    // 止まる: ふだんの6%未満(1コマ1刻みのずれ=ふだんの約8%なので、ほぼ0だけ)。ゆっくり戻るのは「戻る」に入れる
    if(Math.abs(rate)<(g.stopRate||0.06))return 'stop';if(rate<0)return 'back';if(rate>2.5)return 'jump';if(rate>1.35)return 'fast';if(rate<0.65)return 'slow';return 'normal';};
  frames.forEach(f=>f.kind=kindOf(f));
  // 区間にまとめる(止まる・戻る・速いなどの続き)。ふだんの流れは外す
  const segs=[];for(const f of frames){const k=f.kind;if(!k)continue;const s=segs[segs.length-1];
    if(s&&s.kind===k&&f.ref-s.lastRef<=1.5/fps){s.frames.push(f);s.lastRef=f.ref;}else segs.push({kind:k,frames:[f],lastRef:f.ref});}
  const events=segs.filter(s=>s.kind!=='normal'&&(s.frames.length>=2||s.kind==='jump'||s.kind==='back')).map(s=>{
    const fs0=s.frames,first=fs0[0],last=fs0[fs0.length-1];
    const startRef=first.ref-1/fps,amount=fs0.reduce((a,f)=>a+f.dp,0);
    // 判定線のすぐ手前(p 0.9 以上)には、叩いた光や判定の文字が動かずに残るので、待っているノーツからは外す
    const waiting=(frames.find(f=>f.ref>=startRef-1e-6)||first).peaks.filter(p=>p<(g.leadMaxP||0.9));
    return {kind:s.kind,label:KIND[s.kind],fromRef:+startRef.toFixed(3),toRef:last.ref,fromMs:Math.round((startRef-offsetSec)*1000),toMs:last.songMs,
      amount:+amount.toFixed(3),hits:fs0.reduce((a,f)=>a+f.crossed,0),
      waiting:waiting.map(p=>({p,depthBack:depthBack(p),screenBack:screenBack(p,g)})),
      lead:waiting.length?Math.max(...waiting):null};});
  return {fps,v0:v0&&+v0.toFixed(3),travelSec:v0&&+(1/v0).toFixed(2),frames,events,geometry:g};
};

// 軌跡図(縦=時間・横=道の奥行き)を PGM で書き、ffmpeg で PNG にする
const writeSheet=(file,{frames})=>{const rows=frames.length,cols=N;const img=Buffer.alloc(rows*cols,0);
  frames.forEach((f,r)=>{for(const p of f.peaks){const c=Math.round(p*(cols-1));for(let k=-1;k<=1;k++)if(c+k>=0&&c+k<cols)img[r*cols+c+k]=255;}
    if(f.kind&&f.kind!=='normal')img[r*cols]=img[r*cols+1]=img[r*cols+2]=f.kind==='stop'?120:200;});
  const pgm=Buffer.concat([Buffer.from(`P5 ${cols} ${rows} 255\n`),img]);const tmp=file.replace(/\.png$/,'.pgm');
  fs.writeFileSync(assertWorkPath(tmp),pgm);execFileSync('ffmpeg',['-v','error','-y','-i',tmp,assertWorkPath(file)]);fs.unlinkSync(tmp);};

if(require.main===module){
  const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
  try{
    const track=get('track'),dir=workDirFor(track),video=get('video');if(!video)throw new Error('--video <参考動画> が要る');
    const profile=loadProfile(get('profile')||'arcaea');
    let offsetSec=get('offset')!=null?Number(get('offset')):null;
    if(offsetSec==null){if(!get('audio'))throw new Error('--offset <秒> か --audio <ゲームの音源> が要る');
      const m=measureOffset(get('audio'),video,10,60);offsetSec=m.offsetSec;console.log(`ずれ(音で測った): 参考 = 曲 ${offsetSec>=0?'+':''}${offsetSec.toFixed(3)}秒(4区間の差 ${m.spreadSec.toFixed(3)}秒)`);}
    const res=readFlow({video,profile,fromSec:get('from')!=null?Number(get('from')):0,toSec:get('to')!=null?Number(get('to')):null,offsetSec});
    const file=path.join(dir,`flow${get('name')?'-'+get('name'):''}.json`);
    fs.writeFileSync(assertWorkPath(file),JSON.stringify({track,video:path.basename(video),offsetSec,...res,frames:undefined,frameCount:res.frames.length}));
    if(args.includes('--sheet'))writeSheet(file.replace(/\.json$/,'.png'),res);
    console.log(`ふだんの速さ: 1秒に道の ${Math.round(res.v0*100)}%(道を ${res.travelSec}秒で通る)・${res.frames.length}コマ`);
    console.log('区間(曲の時刻 ms) | 種類 | 動いた量(道の%) | 判定線を越えたノーツ | 始まりに見えているノーツ(判定線から奥へ: 奥行き%/見た目%)');
    for(const e of res.events)console.log(`${e.fromMs}〜${e.toMs} | ${e.label} | ${e.amount>=0?'+':''}${Math.round(e.amount*100)} | ${e.hits} | ${e.waiting.map(w=>`${w.depthBack}/${w.screenBack}`).join(' ')}`);
    console.log('書き出した:',path.relative(REPO_ROOT,file),'(リポジトリには入らない)');
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}

module.exports={readFlow,decode,median,shiftScores,smoothShifts,pOf,yOf,depthBack,screenBack,shiftOf,peaksOf,profileOf,N,KIND};
