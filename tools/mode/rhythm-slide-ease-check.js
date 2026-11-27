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
vm.runInContext(`${source}\nglobalThis.__x={rhythmSlideExpectedLane,rhythmSlideLaneSpeedAt,rhythmSlideEaseProgress,rhythmSlideEaseSlope,rhythmSlideSegmentEase,rhythmSlideFittedLane,rhythmSlideWidthAt,rhythmSlideSegmentLane,RHYTHM_SLIDE_EASES,RHYTHM_SONGS};`,context);
context.out=context.__x;
check('本体を読み込んで曲線の関数を取り出せる',typeof context.out.rhythmSlideEaseProgress==='function');
const h=context.out;
const near=(a,b,eps=1e-9)=>Math.abs(a-b)<=eps;

// 1. 曲線の形
check('ease は5種類だけ(linear / in / out / inout / through)',JSON.stringify([...h.RHYTHM_SLIDE_EASES])==='["linear","in","out","inout","through"]');
check('どの曲線も両端は区間の始点と終点に一致する',['linear','in','out','inout','through'].every(e=>near(h.rhythmSlideEaseProgress(e,0),0)&&near(h.rhythmSlideEaseProgress(e,1),1)));
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

// 4. 配信中の譜面は1点も動かない(通り抜け 'through' を足す前と同じ式)。
//    本体を丸ごと読み込み、全曲・全難易度のSLIDEを本体の rhythmSlideExpectedLane と「直線と in/out/inout の式」で突き合わせる
//    (2026-11-23 r1119-133: ease の区間も含めて全部比べる。通り抜けを書いた譜面が混ざっていないことも確かめる)
const rt=h;
const songs=Array.isArray(rt.RHYTHM_SONGS)?rt.RHYTHM_SONGS:Object.values(rt.RHYTHM_SONGS||{});
const oldProgress=(e,x)=>e==='in'?x*x:e==='out'?1-(1-x)*(1-x):e==='inout'?x*x*(3-2*x):x;
const oldLane=(note,t)=>{
  const pts=rhythmPts(note),fit=(lane,at)=>rt.rhythmSlideFittedLane(lane,rt.rhythmSlideWidthAt(note,at));
  if(t<=pts[0].timeMs)return fit(Number(pts[0].lane)||0,pts[0].timeMs);
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(t<=b.timeMs){const p=Math.max(0,Math.min(1,(t-a.timeMs)/Math.max(1,b.timeMs-a.timeMs)));
    const e=['in','out','inout'].includes(a.ease??note.slideEase)?(a.ease??note.slideEase):'linear';return fit(Number(a.lane)+(Number(b.lane)-Number(a.lane))*oldProgress(e,p),t);}}
  const last=pts[pts.length-1];return fit(Number(last.lane)||0,last.timeMs);
};
function rhythmPts(note){
  return Array.isArray(note.slidePoints)&&note.slidePoints.length>=2?note.slidePoints
    :[{timeMs:Number(note.timeMs)||0,lane:Number(note.lane)||0},{timeMs:Number(note.endTimeMs)||Number(note.timeMs)||0,lane:Number(note.endLane??note.lane)||0}];
}
// 通り抜け(ease:'through')は MHB CHART ENGINE Rev.42(2026-11-23)から新曲に使う。曲の一覧(rhythm-song-registry.json)で
// chartRevision が 42 以上の曲は、はじめから新しい作り方で作った曲なので「前と同じ位置か」の突き合わせから外す
// (2026-11-27 クリスマスの3曲が、通り抜けを使って配信する最初の曲になって CI が止まった)。前からある配信中の曲は今までどおり1点も動かさない
const THROUGH_FROM_REVISION=42;
const registrySongs=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring/rhythm-song-registry.json'),'utf8')).songs||{};
const {RELEASED_TRACKS:SLIDE_RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
const throughAllowed=songId=>{const track=(SLIDE_RELEASED_TRACKS&&SLIDE_RELEASED_TRACKS[songId])||String(songId||'').replace(/_hell_debug$/,'');const e=registrySongs[track];return !!e&&Number(e.chartRevision)>=THROUGH_FROM_REVISION;};
let slides=0,moved=0,withEase=0,withThrough=0,newSongs=0,newThrough=0;
for(const song of songs){
  const diffs=song&&song.difficulties?song.difficulties:{};
  if(throughAllowed(song&&song.songId)){newSongs++;for(const id of Object.keys(diffs)){const chart=diffs[id],notes=Array.isArray(chart)?chart:(chart&&chart.notes)||[];
    for(const note of notes)if(note&&note.type==='SLIDE'&&(note.slideEase==='through'||(note.slidePoints||[]).some(p=>p&&p.ease==='through')))newThrough++;}continue;}
  for(const id of Object.keys(diffs)){
    const chart=diffs[id],notes=Array.isArray(chart)?chart:(chart&&chart.notes)||[];
    for(const note of notes){
      if(!note||note.type!=='SLIDE')continue;
      slides++;
      if(note.slideEase!=null||(note.slidePoints||[]).some(p=>p&&p.ease!=null))withEase++;
      if(note.slideEase==='through'||(note.slidePoints||[]).some(p=>p&&p.ease==='through'))withThrough++;
      const start=Number(note.timeMs),end=Number(note.endTimeMs??note.timeMs);
      for(let k=0;k<=16;k++){const t=start+(end-start)*k/16;if(!near(rt.rhythmSlideExpectedLane(note,t),oldLane(note,t),1e-9)){moved++;break;}}
    }
  }
}
check('配信中のSLIDEは通り抜けを足す前と同じ位置(1点も動かない)',slides>0&&moved===0,`SLIDE ${slides}本 / 曲線を書いたもの ${withEase}本 / 動いたもの ${moved}本`);
check('配信中の譜面に通り抜けを書いたものは無い(使うのは新曲から)',withThrough===0,`${withThrough}本(Rev.${THROUGH_FROM_REVISION} 以上で作った新曲 ${newSongs}曲は外した・そちらの通り抜け ${newThrough}本)`);

// 4b. 通り抜け(through)の形
const thr=(pts,w=2)=>({type:'SLIDE',timeMs:pts[0][0],endTimeMs:pts[pts.length-1][0],lane:pts[0][1],endLane:pts[pts.length-1][1],subLaneWidth:w,
  slidePoints:pts.map(([timeMs,lane,ease])=>({timeMs,lane,...(ease?{ease}:{})}))});
const kink=thr([[0,0,'through'],[500,1,'through'],[900,4,'through'],[1500,5]]);
check('通り抜けは点の上で今までと同じ位置',[[0,0],[500,1],[900,4],[1500,5]].every(([t,l])=>near(h.rhythmSlideExpectedLane(kink,t),l,1e-9)));
check('同じ向きへ進む点では止まらない(点の上の速さが0でない)',h.rhythmSlideLaneSpeedAt(kink,500)>1&&h.rhythmSlideLaneSpeedAt(kink,900)>1);
const dl=1e-3,slopeL=(n,t)=>(h.rhythmSlideExpectedLane(n,t)-h.rhythmSlideExpectedLane(n,t-dl))/dl,slopeR=(n,t)=>(h.rhythmSlideExpectedLane(n,t+dl)-h.rhythmSlideExpectedLane(n,t))/dl;
check('点の前後で傾きがつながる(折れ目が出ない)',[500,900].every(t=>Math.abs(slopeL(kink,t)-slopeR(kink,t))<1e-4));
const zig=thr([[0,0,'through'],[500,2,'through'],[1000,0]]);
check('向きが変わる点で行き過ぎない(点のレーンを越えない)',[400,450,500,550,600].every(t=>h.rhythmSlideExpectedLane(zig,t)<=2+1e-9));
const pts=kink.slidePoints;
check('どの区間も区間の両端のレーンの間から出ない',[1,2,3].every(i=>[.1,.3,.5,.7,.9].every(p=>{const v=h.rhythmSlideSegmentLane(kink,pts,i,p),a=pts[i-1].lane,b=pts[i].lane;return v>=Math.min(a,b)-1e-9&&v<=Math.max(a,b)+1e-9;})));
const mixed=thr([[0,0],[500,1,'through'],[1000,3]]);
check('となりが直線の点では、直線の傾きにつながる',Math.abs(slopeL(mixed,500)-slopeR(mixed,500))<1e-4);
const speedMatches=[100,300,700,1200].every(t=>{const d=1e-3,num=Math.abs(h.rhythmSlideExpectedLane(kink,t+d)-h.rhythmSlideExpectedLane(kink,t-d))/(2*d)*1000;return Math.abs(num-h.rhythmSlideLaneSpeedAt(kink,t))<1e-3;});
check('速さの上乗せ(rhythmSlideLaneSpeedAt)は通り抜けの曲線の傾きと一致する',speedMatches);
const two=thr([[0,0,'through'],[1000,2]]);
check('点2つだけの通り抜けは直線',[250,500,750].every(t=>near(h.rhythmSlideExpectedLane(two,t),t/500,1e-9)));

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
