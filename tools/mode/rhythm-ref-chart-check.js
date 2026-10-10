#!/usr/bin/env node
// 参考譜面に寄せる道具(rhythm-ref-capture.js / rhythm-ref-map.js)の検査(2026-10-10・台帳 r2610101530refcap)
//
//   node tools/mode/rhythm-ref-chart-check.js
//
// よその作品の譜面は使わない。作った絵・作った数字だけで、道具の約束が守られているかを見る。
//   ・写しはリポジトリに置かない: ref-work/ が git に無視され、1つも追跡されていない。それ以外の場所へは書かない
//   ・ずれ: 包絡を決まった量だけずらすと、その量が戻ってくる
//   ・光の芯: 帯の色でアーク(赤・青)とノーツの光を分け、帯の薄い光をアークと読み違えない
//   ・置き換え: 16分の格子・はみ出し無し・2本のスライドの間にノーツ無し・交わらない版は左右が入れ替わらない
'use strict';
const fs=require('fs'),path=require('path');
const {spawnSync}=require('child_process');
const {loadProfile,assertWorkPath,bestLag,sparksInFrame,buildTracks,REPO_ROOT,WORK_ROOT}=require('./rhythm-ref-capture.js');
const {mapCapture,simplify}=require('./rhythm-ref-map.js');

let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'} ${name}${!cond&&detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 写しを置かない ──
const profile=loadProfile('arcaea');
ok('約束の表に arcaea があり、床・判定・帯・写し方が書いてある',
  ['frame','area','judge','floor','spark','trail','arcs','hit','map'].every(k=>profile[k]));
ok('ref-work/ は git が無視する',spawnSync('git',['check-ignore','-q','tools/mode/ref-work/x/capture.json'],{cwd:REPO_ROOT}).status===0);
const tracked=spawnSync('git',['ls-files','tools/mode/ref-work'],{cwd:REPO_ROOT}).stdout.toString().trim();
ok('ref-work/ のファイルが1つも追跡されていない',tracked==='',tracked);
let refused=false;try{assertWorkPath(path.join(REPO_ROOT,'tools','mode','ref-copy.json'));}catch(e){refused=true;}
ok('git が無視しない場所(tools/mode/ref-copy.json)へは書かない',refused);
ok('ref-work/ の下へは書ける',assertWorkPath(path.join(WORK_ROOT,'x'))===path.join(WORK_ROOT,'x'));
const mapSrc=fs.readFileSync(path.join(__dirname,'rhythm-ref-map.js'),'utf8');
ok('置き換えの段も書き出し先を workDirFor で決める',/workDirFor\(track\)/.test(mapSrc)&&!/writeFileSync\((?!file)/.test(mapSrc));
const corpus=fs.readFileSync(path.join(REPO_ROOT,'docs','spec','RHYTHM_CHART_CORPUS.md'),'utf8');
ok('譜面コーパスの資料に「写しを残さない形でだけ使う」とある',/参考譜面に寄せる道具は、写しを残さない形でだけ使う/.test(corpus));

// ── ずれ ──
{
  const fps=200,n=fps*40,song=new Float64Array(n),ref=new Float64Array(n);
  let seed=7;const rnd=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
  for(let i=0;i<n;i++)song[i]=rnd()**3;
  const shift=-83;   // 参考 = 曲 - 0.415秒
  for(let i=0;i<n;i++){const j=i-shift;ref[i]=j>=0&&j<n?song[j]*0.7+rnd()*0.05:0;}
  const r=bestLag(song,ref,fps,10,30,2);
  ok('ずれ: ずらした量(-0.415秒)が戻る',Math.abs(r.offsetSec-shift/fps)<1e-9,`${r.offsetSec}`);
}

// ── 光の芯 ──
{
  const {width:W,height:H}=profile.frame,px=Buffer.alloc(W*H*3,20);
  const paint=(x0,x1,y0,y1,[r,g,b])=>{for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*3;px[i]=r;px[i+1]=g;px[i+2]=b;}};
  paint(140,160,320,340,[255,255,255]);paint(130,170,280,315,[210,80,200]);      // 赤い帯の下に光 → pink
  paint(440,460,300,320,[255,255,255]);paint(430,470,260,295,[60,170,240]);      // 青い帯の下に光 → cyan
  paint(300,320,330,345,[255,255,255]);paint(305,315,318,325,[200,80,190]);      // 帯が薄い光 → ノーツ
  const s=sparksInFrame(px,profile).sort((a,b)=>a.x-b.x);
  ok('光の芯を3つ拾う',s.length===3,JSON.stringify(s.map(x=>Math.round(x.x))));
  ok('赤い帯の光はピンクのアーク・青い帯は水色のアーク',s[0]?.col==='pink'&&s[2]?.col==='cyan',JSON.stringify(s.map(x=>x.col)));
  ok('帯の薄い光はアークにしない(タップの光の読み違いを防ぐ)',s[1]?.col==='note',JSON.stringify(s[1]?.trail));
}

// ── 置き換え ──
{
  ok('間引き: まっすぐな線は2点になる',simplify([[0,0,0],[100,1,0],[200,2,0],[300,3,0]],0.4,0.2).length===2);
  ok('間引き: 折り返しは残す',simplify([[0,0,0],[100,2,0],[200,4,0],[300,2,0],[400,0,0]],0.4,0.2).length===3);
  const Z=500,B=400,Q=B/4,audio={timing:{beatZeroMs:Z,beatMs:B,beatsPerBar:4},onsets:[]};
  const xOf=lane6=>profile.floor.left+(lane6/6)*(profile.floor.right-profile.floor.left);
  const frames=[],ms0=Z+8*B;
  for(let k=0;k<120;k++){
    const t=ms0+k*83,ph=k/120;
    const sparks=[];
    if(k>=20&&k<100){
      const a=1+4*Math.abs(((ph*4)%2)-1),b=5-4*Math.abs(((ph*4)%2)-1);        // 2本が交わりながら往復する
      sparks.push({x:xOf(a+0.5),y:330,n:40,col:'cyan'},{x:xOf(b+0.5),y:300,n:40,col:'pink'});
    }
    if(k%6===0)sparks.push({x:xOf(k<20||k>=100?1.5:3),y:340,n:30,col:'note'});
    frames.push({ms:t,sparks});
  }
  const {arcs,hits}=buildTracks(frames,profile,12);
  const cap={track:'synthetic',profile:'arcaea',rangeMs:[ms0,ms0+120*83],arcs,hits};
  for(const uncross of [false,true]){
    const {draft,stat}=mapCapture(cap,audio,profile,{uncross});
    const tag=uncross?'交わらない版':'参考どおり';
    const slides=draft.notes.filter(n=>n.k==='s'),taps=draft.notes.filter(n=>n.k!=='s');
    ok(`${tag}: スライドが左右1本ずつ`,slides.length===2&&new Set(slides.map(s=>s.hand)).size===2,JSON.stringify(slides.map(s=>s.hand)));
    const onGrid=t=>Math.abs((t-Z)/Q-Math.round((t-Z)/Q))<0.02;
    ok(`${tag}: 時刻はすべて16分の格子`,draft.notes.every(n=>n.k==='s'?n.pts.every(p=>onGrid(p[0])):onGrid(n.t)));
    ok(`${tag}: はみ出し無し(サブレーン0〜12・レーン0〜5の0.5刻み・高さ0〜1)`,
      taps.every(n=>n.sub>=0&&n.sub+n.w<=12)&&slides.every(s=>s.pts.every(([,l,,h])=>l>=0&&l<=5&&(l*2)%1===0&&h>=0&&h<=1)));
    const both=t=>slides.filter(s=>s.pts[0][0]-40<=t&&t<=s.pts[s.pts.length-1][0]+40).length>=2;
    ok(`${tag}: 2本のスライドの間にほかのノーツが無い`,taps.every(n=>!both(n.t)));
    ok(`${tag}: 省いた数を数えている`,stat.dropped.twoSlides>0,JSON.stringify(stat.dropped));
    if(uncross)ok('交わらない版: 左右が入れ替わらない',stat.slidePairs.crossings===0,JSON.stringify(stat.slidePairs));
    else ok('参考どおり: 交わりを数えて出す',stat.slidePairs.crossings>0,JSON.stringify(stat.slidePairs));
  }
}

console.log(failed?`\n${failed}件 NG`:'\nすべて OK');
process.exit(failed?1:0);
