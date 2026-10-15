#!/usr/bin/env node
// 参考譜面に寄せる道具 段1: 読み取り(2026-10-10・オンプくん。台帳 r2610101530refcap)
//
//   node tools/mode/rhythm-ref-capture.js --track <曲id> --video <参考動画> --audio <ゲームの音源> --from <秒> --to <秒>
//   node tools/mode/rhythm-ref-capture.js ... --profile arcaea          # 約束の表(rhythm-ref-profiles.json)の名前。既定 arcaea
//   node tools/mode/rhythm-ref-capture.js ... --offset -0.414          # ずれを測らずに決め打ちする(参考の時刻 = 曲の時刻 + これ)
//   node tools/mode/rhythm-ref-capture.js --sheet <参考動画の秒> --video <参考動画> --track <曲id>   # 0.25秒ごとの16コマを1枚に並べる(目で確かめる用)
//
// 【何をするか】
// よそのゲームのプレイ動画(参考譜面)から、ノーツを取った瞬間とアークの通り道を「表」に起こす。
//   1. ずれ: 参考動画の音とゲームの音源の包絡を相互相関で突き合わせ、「参考の時刻 = 曲の時刻 + ずれ」を出す。
//      区間を4つに分けて別々に測り、そろっているかも出す(そろわなければ止まる)
//   2. コマ: ffmpeg で 640×360 に縮めて1コマずつ読み、光の芯(真っ白に近い塊)を拾う
//   3. 光の芯の上(奥)へ伸びる帯の色で、アーク(赤・青)か、ただのノーツの光かを分ける
//   4. アークは色ごとの通り道に、ノーツの光はコマをまたいだ「鎖」にまとめる(長い鎖はホールド)
//
// 【決めごと】
//   ・写し取った表は、よその作品の譜面の写し。**リポジトリに置かない**(2026-10-10 社長の答え・台帳 r2610101530refcap)。
//     書き出すのは tools/mode/ref-work/<曲id>/(tools/.gitignore で外してある)だけ。git が無視しない場所へは書かない
//   ・参考譜面の集め(コーパス・docs/spec/RHYTHM_CHART_CORPUS.md)には入れない
//   ・時刻はすべて「ゲームの音源の時刻(ms)」で持つ。動画は 12fps 程度のことが多く、1コマ(83ms)は16分(185BPMで81ms)と同じくらい。
//     絵からは16分±1までしか読めないので、寄せるのは段2(rhythm-ref-map.js)で音の立ち上がりを使って行う
//
// 【経緯】sheriruth の試作(2026-10-10)で、ずれの向きを取り違えて2拍ずれた・タップの光をアークと読み違えた。
//   ずれは音で測り区間ごとにそろうかを見る、アークは帯の画素数で見分ける、をここに入れてある。
'use strict';
const fs=require('fs'),path=require('path');
const {spawn,spawnSync,execFileSync}=require('child_process');

const REPO_ROOT=path.resolve(__dirname,'..','..');
const PROFILES_PATH=path.join(__dirname,'rhythm-ref-profiles.json');
const WORK_ROOT=path.join(__dirname,'ref-work');

const loadProfile=name=>{
  const all=JSON.parse(fs.readFileSync(PROFILES_PATH,'utf8'));
  if(!all[name]||name.startsWith('_'))throw new Error(`約束の表に「${name}」が無い(${Object.keys(all).filter(k=>!k.startsWith('_')).join(' / ')})`);
  return all[name];
};

// 写しを書いてよい場所か: リポジトリの外か、リポジトリの中なら git が無視する場所だけ
const assertWorkPath=target=>{
  const abs=path.resolve(target),rel=path.relative(REPO_ROOT,abs);
  if(rel.startsWith('..')||path.isAbsolute(rel))return abs;
  const r=spawnSync('git',['check-ignore','-q',rel],{cwd:REPO_ROOT});
  if(r.status!==0)throw new Error(`${rel} は git が無視しない場所。参考譜面の写しはリポジトリに置かない(tools/mode/ref-work/ を使う)`);
  return abs;
};
const workDirFor=track=>{
  if(!/^[a-z0-9_]+$/i.test(String(track||'')))throw new Error('--track <曲id> が要る(英数字と _)');
  const dir=assertWorkPath(path.join(WORK_ROOT,track));
  fs.mkdirSync(dir,{recursive:true});
  return dir;
};

// ── 1. 音のずれ ──
const decodeMono=(file,rate)=>{
  const buf=execFileSync('ffmpeg',['-v','error','-i',file,'-ac','1','-ar',String(rate),'-f','f32le','-'],{maxBuffer:1<<30});
  return new Float32Array(buf.buffer,buf.byteOffset,Math.floor(buf.length/4));
};
const envelope=(x,hop)=>{
  const n=Math.floor(x.length/hop),out=new Float64Array(n);
  for(let i=0;i<n;i++){let s=0;for(let j=i*hop;j<(i+1)*hop;j++)s+=x[j]*x[j];out[i]=Math.sqrt(s/hop);}
  return out;
};
const corr=(a,a0,b,b0,len)=>{
  if(a0<0||b0<0||a0+len>a.length||b0+len>b.length)return -2;
  let sa=0,sb=0;for(let i=0;i<len;i++){sa+=a[a0+i];sb+=b[b0+i];}
  const ma=sa/len,mb=sb/len;let num=0,da=0,db=0;
  for(let i=0;i<len;i++){const x=a[a0+i]-ma,y=b[b0+i]-mb;num+=x*y;da+=x*x;db+=y*y;}
  return da&&db?num/Math.sqrt(da*db):-2;
};
// 曲の [fromSec,toSec] で、参考がどれだけずれているか(参考の時刻 = 曲の時刻 + 戻り値)
const bestLag=(song,ref,fps,fromSec,toSec,maxLagSec)=>{
  const a0=Math.round(fromSec*fps),len=Math.round((toSec-fromSec)*fps),max=Math.round(maxLagSec*fps);
  let best={c:-2,lag:0};
  for(let lag=-max;lag<=max;lag++){const c=corr(song,a0,ref,a0+lag,len);if(c>best.c)best={c,lag};}
  return {offsetSec:best.lag/fps,corr:best.c};
};
const measureOffset=(songFile,videoFile,fromSec,toSec,{rate=22050,hop=110,maxLagSec=2}={})=>{
  const fps=rate/hop;
  const song=envelope(decodeMono(songFile,rate),hop),ref=envelope(decodeMono(videoFile,rate),hop);
  const whole=bestLag(song,ref,fps,fromSec,toSec,maxLagSec);
  const parts=[];const step=(toSec-fromSec)/4;
  for(let i=0;i<4;i++)parts.push(bestLag(song,ref,fps,fromSec+i*step,fromSec+(i+1)*step,maxLagSec));
  const spread=Math.max(...parts.map(p=>p.offsetSec))-Math.min(...parts.map(p=>p.offsetSec));
  return {...whole,parts,spreadSec:spread};
};

// ── 2〜3. コマを読んで光の芯を拾う ──
// 1コマ(RGB の Buffer)から光の芯を拾い、帯の色で分ける。戻り値 [{x,y,n,col,trail}]
const sparksInFrame=(px,profile)=>{
  const {width:W,height:H}=profile.frame,{top,left,right}=profile.area,S=profile.spark,T=profile.trail;
  const at=(x,y)=>(y*W+x)*3;
  const white=(x,y)=>{const i=at(x,y);return px[i]>S.whiteMin&&px[i+1]>S.whiteMin&&px[i+2]>S.whiteMin;};
  const colorOf=(x,y)=>{
    const i=at(x,y),r=px[i],g=px[i+1],b=px[i+2];
    if(r>140&&r>=b*0.95&&g<r*0.5)return 'pink';
    if(b>170&&g>r+20&&g>100)return 'cyan';
    return null;
  };
  // 列ごとに白い画素を数え、横に連なる列を1つの塊にする
  const cols=new Int32Array(W);
  for(let x=left;x<right;x++){let c=0;for(let y=top;y<H;y++)if(white(x,y))c++;cols[x]=c;}
  const blobs=[];let start=-1,prev=-1;
  const close=()=>{
    if(start<0)return;
    let sx=0,sy=0,n=0;
    for(let x=start;x<=prev;x++)for(let y=top;y<H;y++)if(white(x,y)){sx+=x;sy+=y;n++;}
    if(n>=S.minPixels)blobs.push({x:sx/n,y:sy/n,n});
  };
  for(let x=left;x<right;x++){
    if(cols[x]<S.minColumnPixels)continue;
    if(start<0||x-prev>S.joinGapPx){close();start=x;}
    prev=x;
  }
  close();
  for(const b of blobs){
    const xi=Math.round(b.x),yi=Math.round(b.y),count={pink:0,cyan:0};
    for(let y=Math.max(0,yi-T.above[1]);y<Math.max(0,yi-T.above[0]);y++)
      for(let x=Math.max(0,xi-T.halfWidth);x<Math.min(W,xi+T.halfWidth);x++){const c=colorOf(x,y);if(c)count[c]++;}
    b.trail=count;
    b.col=count.pink>=T.minPixels&&count.pink>count.cyan*T.ratio?'pink'
      :count.cyan>=T.minPixels&&count.cyan>count.pink*T.ratio?'cyan':'note';
  }
  return blobs;
};

// 参考動画の [startSec, startSec+durSec] を 640×360 で1コマずつ流し、onFrame(rgb, 参考の秒) を呼ぶ
const readFrames=(videoFile,startSec,durSec,profile,onFrame)=>new Promise((resolve,reject)=>{
  const {width:W,height:H}=profile.frame,size=W*H*3;
  const probe=execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=r_frame_rate','-of','csv=p=0',videoFile]).toString().trim();
  const [nu,de]=probe.split('/').map(Number),fps=de?nu/de:nu;
  const p=spawn('ffmpeg',['-v','error','-ss',String(Math.max(0,startSec)),'-i',videoFile,'-t',String(durSec),'-f','rawvideo','-pix_fmt','rgb24','-s',`${W}x${H}`,'-']);
  let pending=Buffer.alloc(0),k=0;
  p.stdout.on('data',chunk=>{
    pending=pending.length?Buffer.concat([pending,chunk]):chunk;
    while(pending.length>=size){onFrame(pending.subarray(0,size),Math.max(0,startSec)+k/fps);k++;pending=pending.subarray(size);}
  });
  p.on('error',reject);
  p.on('close',code=>code===0?resolve({frames:k,fps}):reject(new Error(`ffmpeg が止まった(${code})`)));
});

// ── 4. 通り道と鎖にまとめる ──
const buildTracks=(frames,profile,fps)=>{
  const arcs={};for(const a of profile.arcs)arcs[a.id]=[];
  const chains=[];let live=[];
  for(const f of frames){
    for(const a of profile.arcs){
      const c=f.sparks.filter(s=>s.col===a.id);if(!c.length)continue;
      const path_=arcs[a.id],last=path_[path_.length-1];
      // 前のコマから続いていれば近いほう、途切れていれば大きいほう
      const s=last&&f.ms-last[0]<250?c.reduce((p,q)=>Math.abs(q.x-last[1])<Math.abs(p.x-last[1])?q:p)
        :c.reduce((p,q)=>q.n>p.n?q:p);
      path_.push([f.ms,+s.x.toFixed(1),+s.y.toFixed(1)]);
    }
    const cur=f.sparks.filter(s=>s.col==='note'),next=[];
    for(const s of cur){
      const m=live.find(c=>Math.abs(s.x-c.x)<25&&Math.abs(s.y-c.yLast)<60&&!next.includes(c));
      if(m){m.endMs=f.ms;m.x=s.x;m.yLast=s.y;m.frames++;next.push(m);}
      else{const c={startMs:f.ms,endMs:f.ms,x0:+s.x.toFixed(1),y0:+s.y.toFixed(1),x:s.x,yLast:s.y,frames:1};chains.push(c);next.push(c);}
    }
    live=next;
  }
  const lag=profile.hit.lagFrames*1000/fps;
  const hits=chains.map(c=>({ms:Math.round(c.startMs-lag),endMs:Math.round(c.endMs-lag),x:c.x0,y:c.y0,frames:c.frames,
    sky:c.y0<profile.hit.skyBelowY}));
  return {arcs,hits};
};

const capture=async({track,video,audio,fromSec,toSec,profileName='arcaea',offsetSec=null})=>{
  const profile=loadProfile(profileName),dir=workDirFor(track);
  let offset;
  if(Number.isFinite(offsetSec))offset={offsetSec,corr:null,parts:[],spreadSec:0,fixed:true};
  else{
    offset=measureOffset(audio,video,fromSec,toSec);
    if(offset.spreadSec>0.05)throw new Error(`区間ごとのずれがそろわない(${offset.parts.map(p=>p.offsetSec.toFixed(3)).join(' / ')}秒)。録画の途中で止まったか、別の版の音源。--offset で決め打ちするなら、目で確かめてから`);
  }
  const frames=[];
  const pad=0.5,start=fromSec+offset.offsetSec-pad,dur=toSec-fromSec+pad*2;
  const {frames:count,fps}=await readFrames(video,start,dur,profile,(rgb,refSec)=>{
    frames.push({ms:Math.round((refSec-offset.offsetSec)*1000),sparks:sparksInFrame(rgb,profile)});
  });
  const {arcs,hits}=buildTracks(frames,profile,fps);
  const out={
    note:'参考譜面の写し。リポジトリに置かない(r2610101530refcap)',
    track,profile:profileName,video:path.basename(video),audio:path.basename(audio),
    rangeMs:[Math.round(fromSec*1000),Math.round(toSec*1000)],
    offset:{refMinusSongSec:+offset.offsetSec.toFixed(3),corr:offset.corr&&+offset.corr.toFixed(3),
      parts:offset.parts.map(p=>+p.offsetSec.toFixed(3)),fixed:!!offset.fixed},
    fps:+fps.toFixed(3),frames:count,arcs,hits,
  };
  const file=path.join(dir,'capture.json');
  fs.writeFileSync(file,JSON.stringify(out));
  return {file,out};
};

const sheet=(video,atSec,track)=>{
  const dir=workDirFor(track),file=path.join(dir,`sheet-${atSec.toFixed(2)}.png`);
  execFileSync('ffmpeg',['-v','error','-y','-ss',String(atSec),'-i',video,'-vf','fps=4,scale=320:-1,tile=4x4','-frames:v','1',file]);
  return file;
};

const parseArgs=argv=>{
  const o={};
  for(let i=0;i<argv.length;i++){const a=argv[i];if(a.startsWith('--')){const v=argv[i+1];if(v===undefined||v.startsWith('--'))o[a.slice(2)]=true;else{o[a.slice(2)]=v;i++;}}}
  return o;
};

if(require.main===module){
  const a=parseArgs(process.argv.slice(2));
  (async()=>{
    if(a.sheet!==undefined){console.log('書き出した:',path.relative(REPO_ROOT,sheet(a.video,Number(a.sheet),a.track)));return;}
    for(const k of ['track','video','audio','from','to'])if(a[k]===undefined)throw new Error(`--${k} が要る`);
    const {file,out}=await capture({track:a.track,video:a.video,audio:a.audio,fromSec:Number(a.from),toSec:Number(a.to),
      profileName:a.profile||'arcaea',offsetSec:a.offset!==undefined?Number(a.offset):null});
    const sky=out.hits.filter(h=>h.sky).length;
    console.log(`ずれ: 参考 = 曲 ${out.offset.refMinusSongSec>=0?'+':''}${out.offset.refMinusSongSec}秒${out.offset.fixed?'(決め打ち)':`(相関 ${out.offset.corr}・4区間 ${out.offset.parts.join(' / ')})`}`);
    console.log(`コマ ${out.frames}(${out.fps}fps) / アークの点 ${Object.entries(out.arcs).map(([k,v])=>`${k} ${v.length}`).join('・')} / ノーツの光 ${out.hits.length}(空中 ${sky})`);
    console.log('書き出した:',path.relative(REPO_ROOT,file),'(リポジトリには入らない)');
  })().catch(e=>{console.error('止まった:',e.message);process.exit(1);});
}

module.exports={loadProfile,assertWorkPath,workDirFor,envelope,corr,bestLag,measureOffset,sparksInFrame,buildTracks,capture,WORK_ROOT,REPO_ROOT};
