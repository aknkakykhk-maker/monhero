#!/usr/bin/env node
// SLIDEの曲線(slidePoints[].ease / note.slideEase)を確かめる。2026-09-26。
//
// 点に ease('in' / 'out' / 'inout')を書くと、その点から次の点までを曲線でつなぐ。
// 見た目(帯)・追従の的・速さの上乗せは、どれも rhythmSlideExpectedLane と
// rhythmSlideLaneSpeedAt を通るので、この2つが同じ曲線を使っていればずれない。
//
// いちばん大事なのは「ease を書いていない既存の譜面は1点も動かない」こと(運用ルール⑩-2)。
// 配信中の全譜面のSLIDEを、曲線の式を通したものと直線の式で突き合わせて確かめる。
//
//   node tools/mode/rhythm-slide-ease-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// 本体を丸ごと読み込む(rhythm-runtime-notes.js の loadRuntime と同じやり方)。
// 切り出しだと依存する定数を追いかけ続けることになるので、そのまま動かす
const context={console};
vm.createContext(context);
vm.runInContext(`${source}\nglobalThis.__x={rhythmSlideExpectedLane,rhythmSlideLaneSpeedAt,rhythmSlideEaseProgress,rhythmSlideEaseSlope,rhythmSlideSegmentEase,rhythmSlideFittedLane,rhythmSlideWidthAt,RHYTHM_SLIDE_EASES,RHYTHM_SONGS};`,context);
context.out=context.__x;
check('本体を読み込んで曲線の関数を取り出せる',typeof context.out.rhythmSlideEaseProgress==='function');
const h=context.out;
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;

// 1. 曲線の形
check('ease は4種類だけ(linear / in / out / inout)',JSON.stringify([...h.RHYTHM_SLIDE_EASES])==='["linear","in","out","inout"]');
check('どの曲線も両端は区間の始点と終点に一致する',['linear','in','out','inout'].every(e=>near(h.rhythmSlideEaseProgress(e,0),0)&&near(h.rhythmSlideEaseProgress(e,1),1)));
check('inout は真ん中で半分・4分の1で 0.15625',near(h.rhythmSlideEaseProgress('inout',.5),.5)&&near(h.rhythmSlideEaseProgress('inout',.25),.15625));
check('in は遅く出る・out は速く出る',h.rhythmSlideEaseProgress('in',.25)<.25&&h.rhythmSlideEaseProgress('out',.25)>.25);
check('知らない ease・書いていない ease は直線',h.rhythmSlideSegmentEase({}, {ease:'bounce'})==='linear'&&h.rhythmSlideSegmentEase({}, {})==='linear'&&h.rhythmSlideSegmentEase(null,null)==='linear');
check('点の ease がノーツの slideEase より優先される',h.rhythmSlideSegmentEase({slideEase:'in'},{ease:'out'})==='out'&&h.rhythmSlideSegmentEase({slideEase:'in'},{})==='in');

// 傾きは曲線の式の微分と一致する(速さの上乗せが見た目と同じ曲線を使っている証拠)
const slopeMatches=['linear','in','out','inout'].every(e=>[.1,.3,.5,.7,.9].every(p=>{
  const d=1e-6,numeric=(h.rhythmSlideEaseProgress(e,p+d)-h.rhythmSlideEaseProgress(e,p-d))/(2*d);
  return near(numeric,h.rhythmSlideEaseSlope(e,p),1e-4);
}));
check('傾き(速さの倍率)は曲線の式の微分と一致する',slopeMatches);

// 2. 追従の的(=帯の中心)が曲線に沿う。幅2・レーン0→4 は寄せが起きない
const eased={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:0,endLane:4,subLaneWidth:2,slidePoints:[{timeMs:1000,lane:0,ease:'inout'},{timeMs:2000,lane:4}]};
check('inout のSLIDEは 1/4 の時刻で 0.625 レーン(直線なら1.0)',near(h.rhythmSlideExpectedLane(eased,1250),.625));
check('inout のSLIDEは真ん中の時刻で 2.0 レーン',near(h.rhythmSlideExpectedLane(eased,1500),2));
const byNote={...eased,slideEase:'inout',slidePoints:[{timeMs:1000,lane:0},{timeMs:2000,lane:4}]};
check('ノーツの slideEase でも同じ曲線になる',near(h.rhythmSlideExpectedLane(byNote,1250),.625));

// 3. 速さの上乗せ: inout は真ん中で平均の1.5倍・端で0
const avg=4/1;// 4レーン / 1秒
check('inout の速さは真ん中で平均の1.5倍',near(h.rhythmSlideLaneSpeedAt(eased,1500),avg*1.5,1e-6));
check('inout の速さは動き出しの瞬間は0',near(h.rhythmSlideLaneSpeedAt(eased,1000),0,1e-6));
const linear={...eased,slidePoints:[{timeMs:1000,lane:0},{timeMs:2000,lane:4}]};
check('直線の速さは区間のどこでも平均のまま',[1000,1250,1500,1999].every(t=>near(h.rhythmSlideLaneSpeedAt(linear,t),avg,1e-6)));

// 4. 配信中の譜面は1点も動かない(ease を書いていないので直線のまま)。
//    本体を丸ごと読み込み(rhythm-runtime-notes.js の loadRuntime)、全曲・全難易度のSLIDEを
//    本体の rhythmSlideExpectedLane と「直線の式」で突き合わせる。
const rt=h;
const songs=Array.isArray(rt.RHYTHM_SONGS)?rt.RHYTHM_SONGS:Object.values(rt.RHYTHM_SONGS||{});
const linearLane=(note,t)=>{
  const pts=rhythmPts(note);
  if(t<=pts[0].timeMs)return rt.rhythmSlideFittedLane(Number(pts[0].lane)||0,rt.rhythmSlideWidthAt(note,pts[0].timeMs));
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(t<=b.timeMs){const p=Math.max(0,Math.min(1,(t-a.timeMs)/Math.max(1,b.timeMs-a.timeMs)));return rt.rhythmSlideFittedLane(Number(a.lane)+(Number(b.lane)-Number(a.lane))*p,rt.rhythmSlideWidthAt(note,t));}}
  const last=pts[pts.length-1];return rt.rhythmSlideFittedLane(Number(last.lane)||0,rt.rhythmSlideWidthAt(note,last.timeMs));
};
function rhythmPts(note){
  return Array.isArray(note.slidePoints)&&note.slidePoints.length>=2?note.slidePoints
    :[{timeMs:Number(note.timeMs)||0,lane:Number(note.lane)||0},{timeMs:Number(note.endTimeMs)||Number(note.timeMs)||0,lane:Number(note.endLane??note.lane)||0}];
}
let slides=0,moved=0,withEase=0;
for(const song of songs){
  const diffs=song&&song.difficulties?song.difficulties:{};
  for(const id of Object.keys(diffs)){
    const chart=diffs[id],notes=Array.isArray(chart)?chart:(chart&&chart.notes)||[];
    for(const note of notes){
      if(!note||note.type!=='SLIDE')continue;
      slides++;
      if(note.slideEase!=null||(note.slidePoints||[]).some(p=>p&&p.ease!=null)){withEase++;continue;}
      const start=Number(note.timeMs),end=Number(note.endTimeMs??note.timeMs);
      for(let k=0;k<=8;k++){const t=start+(end-start)*k/8;if(!near(rt.rhythmSlideExpectedLane(note,t),linearLane(note,t),1e-9)){moved++;break;}}
    }
  }
}
check('配信中のSLIDEは ease を書いていないかぎり直線のまま',slides>0&&moved===0,`SLIDE ${slides}本 / 曲線を書いたもの ${withEase}本 / 動いたもの ${moved}本`);

// 5. 譜面の短い形(mhSlideV2 の点の4つ目)と、書き出し側の番号の並びがそろっている
const {SLIDE_EASE_CODES}=require('./rhythm-runtime-notes.js');
check('書き出しの番号の並びが本体の RHYTHM_SLIDE_EASES と同じ',JSON.stringify(SLIDE_EASE_CODES)===JSON.stringify([...h.RHYTHM_SLIDE_EASES]));
const ctx2={console};vm.createContext(ctx2);
vm.runInContext(`${source}\nglobalThis.__s=mhSlideV2(1000,2000,[[1000,0,2,3],[1500,4,2],[2000,0,2,9]]);`,ctx2);
const decoded=ctx2.__s;
check('短い形の4つ目の番号3は inout として読まれる',decoded.slidePoints[0].ease==='inout');
check('番号を書いていない点・知らない番号の点は直線(ease を持たない)',!('ease' in decoded.slidePoints[1])&&!('ease' in decoded.slidePoints[2]));
check('パイプラインも同じ番号で書き出す',fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8').includes("require('./rhythm-runtime-notes.js')")
  &&fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8').includes('SLIDE_EASE_CODES.indexOf(p.ease)'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
