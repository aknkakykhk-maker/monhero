#!/usr/bin/env node
// 参考譜面に寄せる道具 段1-2: コンボの数字を1コマずつ読む(2026-10-11・リバースくん。Grievous Lady の拾い漏れ探しから)
//
//   node tools/mode/rhythm-ref-combo.js --track <曲id> --video <参考動画> --learn <参考の秒>=<コンボ>,<秒>=<コンボ>,...
//        … 数字の見本(0〜9の形)を、コンボが分かっているコマから作る。ref-work/<曲id>/combo-digits.json に書く
//          (汚れて使えない字は ? にする。例 134.183=?369)
//   node tools/mode/rhythm-ref-combo.js --track <曲id> --video <参考動画> [--from <秒>] [--to <秒>]
//        … 全部のコマのコンボを読み、ref-work/<曲id>/combo.json に書く(コマごとの読み・増えた時刻の表)
//   node tools/mode/rhythm-ref-combo.js --track <曲id> --video <参考動画> --show <秒>
//        … そのコマで拾った数字の形を文字で出す(見本づくり・確かめ用)
//   node tools/mode/rhythm-ref-combo.js --track <曲id> --video <参考動画> --compare <ref-work の下書き> --beat-ms <1拍ms> --beat-zero <拍0のms>
//        … 読んだコンボと下書きを突き合わせ、下書きに無いノーツがありそうな所を ref-work/<曲id>/compare/combo-compare.md に書く
//   --region x,y,w,h … コンボの数字がある所(参考動画の画素)。書かなければ約束の表(rhythm-ref-profiles.json・--profile 既定 arcaea-hands-854)の combo.region
//
// 【何をするか】
// 参考動画のコンボの数字は、手や光でよく隠れる。それでも見えるコマだけで「何コマ目にいくつだったか」が分かれば、
// 2拍ごとの「コンボの増え方」と、下書き(段2)のノーツ数を突き合わせられ、手で隠れて拾えなかったノーツが見つかる。
//   1. ffmpeg で数字の所だけを切り出し、緑の明るさが周り(15×15の平均)より 18 以上明るい画素を「線」とする
//      (数字は背景より少し明るい細い線。色の濃さで切ると、光や帯と混ざる)
//   2. 列ごとに線の数を数え、空いた列で区切って1文字ずつにする。高さが数字の高さに近いものだけ使う
//   3. 1文字を 12×20 に縮め、見本(0〜9)といちばん似ているものを選ぶ。似ている度合いと、2番目との差が足りなければ読まない
//   4. 読めたコマの並びから、「減らない」並びをいちばん長く取る(読み違いを落とす)。途中でコンボが切れた所は、0からの並びとして分ける
//
// 【決めごと】
//   ・読んだ表は参考の写し。書き出すのは tools/mode/ref-work/<曲id>/(git が無視する所)だけ。リポジトリに置かない
//   ・数字の見本(combo-digits.json)も参考動画から取った絵なので、同じく ref-work/ に置く
'use strict';
const fs=require('fs'),path=require('path');
const {spawn,spawnSync}=require('child_process');
const {assertWorkPath}=require('./rhythm-ref-capture.js');

const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
const TRACK=get('track'),VIDEO=get('video');
const WORK=path.join(__dirname,'ref-work',String(TRACK||''));
const PROFILES=JSON.parse(fs.readFileSync(path.join(__dirname,'rhythm-ref-profiles.json'),'utf8'));
const profile=PROFILES[get('profile')||'arcaea-hands-854']||{};
const region=(get('region')||(profile.combo&&profile.combo.region)||'335,245,150,50').split(',').map(Number);
const [RX,RY,RW,RH]=region;
const FPS=Number(get('fps')||30);
const GW=12,GH=20;           // 1文字を縮める大きさ
const LIFT=Number(get('lift')||18),BLUR=7;        // 線とみなす明るさの差・周りの平均を取る半径
const MIN_H=Math.round(RH*.6),MAX_H=Math.round(RH*.9);

if(!TRACK||!VIDEO){console.log('使い方: --track <曲id> --video <参考動画> (--learn 秒=コンボ,... | --show 秒 | [--from 秒] [--to 秒])');process.exit(1);}

// 切り出した1コマ(RGB)から「線」の画素を出す
const maskOf=buf=>{
  const g=new Float64Array(RW*RH);for(let i=0;i<RW*RH;i++)g[i]=buf[i*3+1];
  // 周りの平均(箱の平均・端は端の値で埋める)
  const sum=new Float64Array((RW+1)*(RH+1));
  for(let y=0;y<RH;y++){let row=0;for(let x=0;x<RW;x++){row+=g[y*RW+x];sum[(y+1)*(RW+1)+x+1]=sum[y*(RW+1)+x+1]+row;}}
  const box=(x0,y0,x1,y1)=>sum[y1*(RW+1)+x1]-sum[y0*(RW+1)+x1]-sum[y1*(RW+1)+x0]+sum[y0*(RW+1)+x0];
  const m=new Uint8Array(RW*RH);
  for(let y=0;y<RH;y++)for(let x=0;x<RW;x++){
    const x0=Math.max(0,x-BLUR),x1=Math.min(RW,x+BLUR+1),y0=Math.max(0,y-BLUR),y1=Math.min(RH,y+BLUR+1);
    const mean=box(x0,y0,x1,y1)/((x1-x0)*(y1-y0));
    if(g[y*RW+x]-mean>LIFT)m[y*RW+x]=1;
  }
  return m;
};
// 線を、空いた列で区切って1文字ずつにする。返すのは [{x0,x1,y0,y1,glyph}]
const glyphsOf=m=>{
  const col=new Array(RW).fill(0);for(let x=0;x<RW;x++)for(let y=0;y<RH;y++)col[x]+=m[y*RW+x];
  const runs=[];let x=0;
  while(x<RW){if(col[x]<1){x++;continue;}let e=x;while(e<RW&&col[e]>=1)e++;runs.push([x,e]);x=e;}
  // くっついた2文字(「70」など)は、文字の幅より広ければ、真ん中あたりで線のいちばん少ない列で分ける
  const W1=Math.round(RH*.55);
  for(let i=0;i<runs.length;i++){const [a,b]=runs[i];if(b-a<=W1*1.2)continue;
    let cut=-1,low=Infinity;for(let xx=a+Math.round(W1*.6);xx<=b-Math.round(W1*.6);xx++)if(col[xx]<low){low=col[xx];cut=xx;}
    if(cut>0){runs.splice(i,1,[a,cut],[cut+1,b]);i--;}}
  const out=[];
  for(const [x0,x1] of runs){
    let y0=RH,y1=-1,n=0;for(let y=0;y<RH;y++)for(let xx=x0;xx<x1;xx++)if(m[y*RW+xx]){y0=Math.min(y0,y);y1=Math.max(y1,y);n++;}
    const h=y1-y0+1,w=x1-x0;
    if(h<MIN_H||h>MAX_H||w<2||w>RH*.9||n<h||y0<RH*.12||y1<RH*.7)continue;
    // 縮めた形(縦は文字の高さ、横は「1」のように細い字も同じ幅の箱の真ん中に置く)
    const box=Math.max(w,Math.round(h*.62)),cx=(x0+x1)/2,bx0=cx-box/2;
    const glyph=new Array(GW*GH).fill(0);
    for(let gy=0;gy<GH;gy++)for(let gx=0;gx<GW;gx++){
      let s=0,c=0;
      const ya=y0+gy*h/GH,yb=y0+(gy+1)*h/GH,xa=bx0+gx*box/GW,xb=bx0+(gx+1)*box/GW;
      for(let yy=Math.floor(ya);yy<Math.ceil(yb);yy++)for(let xx=Math.floor(xa);xx<Math.ceil(xb);xx++){if(xx<0||xx>=RW||yy<0||yy>=RH){c++;continue;}s+=m[yy*RW+xx];c++;}
      glyph[gy*GW+gx]=c?s/c:0;
    }
    out.push({x0,x1,y0,y1,w,h,glyph});
  }
  return out;
};
const corr=(a,b)=>{let ma=0,mb=0;for(let i=0;i<a.length;i++){ma+=a[i];mb+=b[i];}ma/=a.length;mb/=b.length;
  let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;s+=da*db;sa+=da*da;sb+=db*db;}return sa&&sb?s/Math.sqrt(sa*sb):0;};

// 1コマを切り出す(秒を指定)
const frameAt=sec=>{
  const r=spawnSync('ffmpeg',['-v','error','-ss',String(sec),'-i',VIDEO,'-frames:v','1','-vf',`crop=${RW}:${RH}:${RX}:${RY}`,'-f','rawvideo','-pix_fmt','rgb24','-'],{maxBuffer:1<<26});
  if(r.status!==0||r.stdout.length<RW*RH*3)throw new Error(`コマが取れない: ${sec}秒`);
  return r.stdout;
};
const DIGITS_PATH=path.join(WORK,'combo-digits.json');

if(get('show')){
  const m=maskOf(frameAt(Number(get('show'))));
  for(let y=0;y<RH;y++){let s='';for(let x=0;x<RW;x++)s+=m[y*RW+x]?'#':'.';console.log(s);}
  console.log(glyphsOf(m).map(g=>`x${g.x0}-${g.x1} y${g.y0}-${g.y1}`).join(' / '));
  process.exit(0);
}

if(get('learn')){
  // 見本: 数字ごとに、分かっているコマの形を平均する
  const acc={};
  for(const item of get('learn').split(',')){
    const [sec,val]=item.split('=');const digits=String(val).trim().split('');
    const gs=glyphsOf(maskOf(frameAt(Number(sec))));
    if(gs.length!==digits.length){console.log(`見本に使えない: ${sec}秒(文字${gs.length}個・コンボ ${val})`);continue;}
    gs.forEach((g,i)=>{const d=digits[i];if(d==='?')return;(acc[d]||(acc[d]=[])).push(g.glyph);});
  }
  const templates={};
  for(const [d,list] of Object.entries(acc))templates[d]=list[0].map((_,i)=>list.reduce((s,g)=>s+g[i],0)/list.length);
  const file=DIGITS_PATH;assertWorkPath(file);fs.mkdirSync(WORK,{recursive:true});
  fs.writeFileSync(file,JSON.stringify({note:'参考動画のコンボの数字の形(リポジトリに置かない)',region,gw:GW,gh:GH,templates}));
  const missing='0123456789'.split('').filter(d=>!templates[d]);
  console.log(`見本: ${Object.keys(templates).sort().join(' ')}${missing.length?` / 足りない数字 ${missing.join(' ')}`:''} → ${path.relative(process.cwd(),file)}`);
  process.exit(0);
}

if(get('compare')){
  // 突き合わせ: 読んだコンボ(combo.json)と、下書き(段2)から見込むコンボを、読めたコマの間ごとに比べる。
  //   見込み: タップ・フリックは1、ホールド・スライドは頭で1と、そのあと tickBeats 拍ごとに1。表示は判定から lag 秒遅れる
  //   「参考のコンボ − 見込み」の積み上がりが、前後6コマの中央値で2以上増える所 = 下書きに無いノーツがある所(拾い漏れの候補)
  const draftFile=path.resolve(get('compare'));assertWorkPath(draftFile);
  const notes=(d=>Array.isArray(d)?d:d.notes)(JSON.parse(fs.readFileSync(draftFile,'utf8')));
  const combo=JSON.parse(fs.readFileSync(path.join(WORK,get('combo')||'combo.json'),'utf8'));
  const cap=JSON.parse(fs.readFileSync(path.join(WORK,'capture.json'),'utf8'));
  const refMinusSong=Number(get('offset')||(cap.offset&&cap.offset.refMinusSongSec)||0);
  const beatMs=Number(get('beat-ms')),zero=Number(get('beat-zero')||0);
  if(!(beatMs>0)){console.log('--beat-ms <1拍のms> と --beat-zero <拍0の曲の時刻ms> を書く(下書きの時刻で)');process.exit(1);}
  const tick=Number(get('tick')||(profile.combo&&profile.combo.tickBeats)||.5),lag=Number(get('lag')||.05);
  const ev=[];
  for(const n of notes){
    if(n.k==='t'||n.k==='f'){ev.push(n.t);continue;}
    const s0=n.k==='s'?n.pts[0][0]:n.t,e0=n.k==='s'?n.pts[n.pts.length-1][0]:n.end;
    ev.push(s0);const c=Math.floor((e0-s0)/(tick*beatMs));for(let i=1;i<=c;i++)ev.push(s0+i*tick*beatMs);
  }
  const et=ev.map(t=>t/1000+refMinusSong+lag).sort((a,b)=>a-b);
  const upto=t=>{let lo=0,hi=et.length;while(lo<hi){const m=(lo+hi)>>1;if(et[m]<=t)lo=m+1;else hi=m;}return lo;};
  const beat=ref=>((ref-refMinusSong)*1000-zero)/beatMs;
  const D=combo.chain.map(([t,v])=>[t,v-upto(t)]);
  const med=a=>{const b=a.slice().sort((x,y)=>x-y);return b.length%2?b[(b.length-1)/2]:(b[b.length/2-1]+b[b.length/2])/2;};
  const K=6,rows=[];
  for(let i=K;i<D.length-K;i++){const before=med(D.slice(i-K,i).map(x=>x[1])),after=med(D.slice(i,i+K).map(x=>x[1]));
    if(after-before>=2&&(!rows.length||D[i][0]-rows[rows.length-1].sec>1))rows.push({sec:D[i][0],from:beat(D[i-1][0]),to:beat(D[i][0]),add:after-before});}
  const lines=['# コンボの増え方と下書きの突き合わせ(参考の写し・リポジトリに置かない)',
    `下書き ${path.basename(draftFile)} / 読んだコマ ${combo.chain.length} / 長いノーツは ${tick} 拍ごとに1 / 表示の遅れ ${lag} 秒`,
    `「参考のコンボ − 見込み」: 始め ${D.length?D[0][1]:'-'} → 終わり ${D.length?D[D.length-1][1]:'-'}`,'','区間(拍)|参考が多くなった数','---|---',
    ...rows.map(r=>`${r.from.toFixed(2)}〜${r.to.toFixed(2)}|+${r.add}`)];
  const file=path.join(WORK,'compare','combo-compare.md');assertWorkPath(file);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,lines.join('\n')+'\n');
  console.log(lines.slice(1,3).join('\n'));console.log(`拾い漏れの候補 ${rows.length}か所 → ${path.relative(process.cwd(),file)}`);
  process.exit(0);
}

// 全部のコマを読む
let T=JSON.parse(fs.readFileSync(DIGITS_PATH,'utf8')).templates;
const MIN_SCORE=Number(get('min-score')||.7),MIN_MARGIN=Number(get('min-margin')||.06),ROUNDS=Number(get('rounds')||3);
const readGlyph=g=>{let best=null,second=-1;for(const [d,t] of Object.entries(T)){const s=corr(g.glyph,t);if(!best||s>best.s){second=best?best.s:-1;best={d,s};}else if(s>second)second=s;}
  return best&&best.s>=MIN_SCORE&&best.s-second>=MIN_MARGIN?best:null;};
const readGlyphs=gs=>{
  if(!gs.length||gs.length>4)return null;
  // 文字の高さがそろっていること(光の切れ端を数字と読まない)
  const hs=gs.map(g=>g.h),hmax=Math.max(...hs);if(hs.some(h=>h<hmax*.85))return null;
  // 文字の間が空きすぎていないこと
  for(let i=1;i<gs.length;i++)if(gs[i].x0-gs[i-1].x1>hmax*.6)return null;
  const ds=gs.map(readGlyph);if(ds.some(d=>!d))return null;
  const text=ds.map(d=>d.d).join('');if(text.length>1&&text[0]==='0')return null;
  return {value:Number(text),score:Math.min(...ds.map(d=>d.s))};
};
// 読めたコマの並びから、減らない並びをいちばん長く取る(となりの読みとの差は、時間で増えうる分まで)
const chainOf=seen=>{
  const n=seen.length,len=new Array(n).fill(1),prev=new Array(n).fill(-1);
  for(let i=0;i<n;i++)for(let j=Math.max(0,i-400);j<i;j++){
    const ok=seen[j].value<=seen[i].value&&seen[i].value-seen[j].value<=Math.max(6,Math.ceil((seen[i].sec-seen[j].sec)*30));
    if(ok&&len[j]+1>len[i]){len[i]=len[j]+1;prev[i]=j;}}
  let end=0;for(let i=1;i<n;i++)if(len[i]>len[end])end=i;
  const keep=new Set();if(n)for(let i=end;i>=0;i=prev[i])keep.add(i);
  return seen.filter((_,i)=>keep.has(i));
};
const FROM=Number(get('from')||0),TO=get('to')!=null?Number(get('to')):null;
const ff=['-v','error','-ss',String(FROM),...(TO!=null?['-t',String(TO-FROM)]:[]),'-i',VIDEO,'-vf',`fps=${FPS},crop=${RW}:${RH}:${RX}:${RY}`,'-f','rawvideo','-pix_fmt','rgb24','-'];
const proc=spawn('ffmpeg',ff);
const size=RW*RH*3;let pending=Buffer.alloc(0),k=0;const frames=[];
proc.stdout.on('data',chunk=>{pending=Buffer.concat([pending,chunk]);
  while(pending.length>=size){const buf=pending.subarray(0,size);pending=pending.subarray(size);
    frames.push({sec:+(FROM+k/FPS).toFixed(3),gs:glyphsOf(maskOf(buf))});k++;}});
proc.on('close',()=>{
  let chain=[],seen=[];
  // 読む → 並びに残ったコマの形で見本を作り直す、をくり返す(見本が数コマぶんしか無いと、隠れかけの字を読めないため)
  for(let round=0;round<ROUNDS;round++){
    seen=frames.map(f=>({sec:f.sec,gs:f.gs,...(readGlyphs(f.gs)||{value:null})})).filter(r=>r.value!=null);
    chain=chainOf(seen);
    if(round===ROUNDS-1)break;
    const acc={};
    for(const r of chain){const text=String(r.value);if(r.gs.length!==text.length)continue;r.gs.forEach((g,i)=>{(acc[text[i]]||(acc[text[i]]=[])).push(g.glyph);});}
    const next={...T};for(const [d,list] of Object.entries(acc))if(list.length>=3)next[d]=list[0].map((_,i)=>list.reduce((s,g)=>s+g[i],0)/list.length);
    T=next;
  }
  // 増えた所: 前に読めたコマから値が増えたら、その間(前のコマ〜このコマ)に増えた
  const steps=[];for(let i=1;i<chain.length;i++){const a=chain[i-1],b=chain[i];if(b.value>a.value)steps.push({from:a.sec,to:b.sec,before:a.value,after:b.value});}
  const out={note:'参考の写し(リポジトリに置かない)',track:TRACK,video:path.basename(VIDEO),region,fps:FPS,frames:frames.length,read:seen.length,kept:chain.length,
    chain:chain.map(r=>[r.sec,r.value]),steps};
  const file=path.join(WORK,get('out')||'combo.json');assertWorkPath(file);fs.mkdirSync(WORK,{recursive:true});fs.writeFileSync(file,JSON.stringify(out));
  console.log(`コマ ${frames.length} / 読めた ${seen.length}(${Math.round(seen.length/Math.max(1,frames.length)*100)}%)/ 並びに残した ${chain.length} / 最後のコンボ ${chain.length?chain[chain.length-1].value:'-'} → ${path.relative(process.cwd(),file)}`);
});
