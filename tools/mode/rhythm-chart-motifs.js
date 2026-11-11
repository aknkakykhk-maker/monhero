#!/usr/bin/env node
// 短い動機(1〜2小節)の見分け(2026-11-11・MHB CHART ENGINE Rev.38)。
//
//   node tools/mode/rhythm-chart-motifs.js --track <曲> [--dir <場所>] [--difficulty MASTER]   # 作った譜面の動機(小節 ← 元の小節・高さのずれ)と、同じ手の動きの割合
//
// 【なぜ要るか】繰り返しの見分け(rhythm-chart-repeats.js・Rev.18)は4小節のまとまりが「ほぼ同じ」所しか見ない。
// 人の譜面は、1〜2小節の短い動機(同じリズム+同じ音の上下)にも同じ手の動きを当て、高さが違えば形ごと左右へずらす。
//
// 【決め方】音だけから1〜2小節の「同じ動機」を当てるのは、いまの解析(音の高さを1本だけ追う)では当たりが悪い
// (7曲で試すと、見つけた小節どうしで実際に拾う音の位置が合うのは6割。外れが多い)。そこで順番を逆にする。
//   1. リズムは**その難易度で実際に拾った音の位置**で比べる(小節の中の位置の重なりが MIN_RHYTHM 以上=遊ぶ人にほぼ同じリズムに見える。
//      ぴったり同じだけにすると、7曲でほとんど見つからない: 打点の拾い方が小節ごとに1音ずつ揺れるため)
//   2. そのうえで音の上下が似ているものだけを動機とする
//      ・音高が取れているグリッドが両方に MIN_PITCH 個以上あれば、高さの動きの相関(移調しても同じ形なら1に近い)が MIN_CONTOUR 以上
//      ・音高が足りなければ、歌・主旋律の帯(音の層の lead)の並びの相関が MIN_LEAD 以上(層の解析が無ければ動機にしない)
// 2小節ぶん(合わせて MIN_NOTES_2 個以上)を先に探し、残りを1小節(MIN_NOTES_1 個以上)で探す。元は前にある小節で、いちばん似ているもの(同じくらいなら近い方)。
// 高さのずれは、解析の音の高さ(pitchCurve の height・0〜1)の差の中央値(音高が足りなければ0)。生成器がレーンのずらし幅に直す。
// 解析ファイルは作り直さない・書かない。乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';

const MIN_RHYTHM=.6,MIN_NOTES_1=3,MIN_NOTES_2=4,MIN_PITCH=3,MIN_CONTOUR=.5,MIN_LEAD=.7,MIN_MOVE=1.5;
const median=list=>{const s=list.slice().sort((a,b)=>a-b);if(!s.length)return 0;const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const pearson=(xs,ys)=>{if(xs.length<3)return null;const mx=xs.reduce((p,c)=>p+c,0)/xs.length,my=ys.reduce((p,c)=>p+c,0)/ys.length;
  let d=0,p=0,q=0;for(let k=0;k<xs.length;k++){d+=(xs[k]-mx)*(ys[k]-my);p+=(xs[k]-mx)**2;q+=(ys[k]-my)**2;}
  return p>1e-9&&q>1e-9?d/Math.sqrt(p*q):null;};

// audio: 解析ファイル / layers: 音の層の解析(無ければ null)
// offsetsByBar: Map(小節 → 拾った音の小節の中の位置の Set) / skip(bar): もう繰り返しの元が付いている小節(見ない)
// 返り値: Map(小節 → {source, shift(高さのずれ・0〜1の差), bars(1か2), by('pitch'|'lead'), score})
const detectChartMotifs=(audio,layers,offsetsByBar,{skip=()=>false}={})=>{
  const timing=audio.timing,BAR=timing.subdivisionsPerBeat*timing.beatsPerBar;
  const semitone=new Map(),height=new Map();
  for(const p of audio.pitchCurve||[])if(Number(p.clarity)>=.5&&Number(p.hz)>0){
    semitone.set(p.grid,12*Math.log2(Number(p.hz)/440));
    if(Number.isFinite(Number(p.height)))height.set(p.grid,Number(p.height));
  }
  const leadSeries=layers&&layers.series&&Array.isArray(layers.series.lead)&&layers.grid?layers.series.lead:null;
  const leadAt=grid=>{const i=grid-layers.grid.firstGrid;return i>=0&&i<leadSeries.length?Number(leadSeries[i])||0:0;};
  const EMPTY=new Set();
  const setOf=bar=>offsetsByBar.get(bar)||EMPTY;
  const sizeOf=bar=>setOf(bar).size;
  // 拾った音の位置の重なり(共通 ÷ どちらかにある)。size 小節ぶんをまとめて数える
  const rhythmAlike=(bar,source,size)=>{let inter=0,union=0;
    for(let k=0;k<size;k++){const a=setOf(bar+k),b=setOf(source+k);for(const x of a)if(b.has(x))inter++;union+=a.size+b.size;}
    union-=inter;return union?inter/union:0;};
  // 似かた: 音高で比べられればその相関、だめなら歌の帯の相関。動機と言えなければ null
  const alike=(bar,source,size)=>{
    const xs=[],ys=[],hd=[],lb=[],ls=[];
    for(let k=0;k<size*BAR;k++){const g=bar*BAR+k,h=source*BAR+k;
      if(semitone.has(g)&&semitone.has(h)){xs.push(semitone.get(g));ys.push(semitone.get(h));if(height.has(g)&&height.has(h))hd.push(height.get(g)-height.get(h));}
      if(leadSeries){lb.push(leadAt(g));ls.push(leadAt(h));}}
    if(xs.length>=MIN_PITCH*size&&Math.max(...xs)-Math.min(...xs)>=MIN_MOVE&&Math.max(...ys)-Math.min(...ys)>=MIN_MOVE){
      const c=pearson(xs,ys);
      return c!=null&&c>=MIN_CONTOUR?{by:'pitch',score:c,shift:median(hd)}:null;   // 音高で比べられて違うなら、動機ではない
    }
    if(!leadSeries)return null;
    const c=pearson(lb,ls);
    return c!=null&&c>=MIN_LEAD?{by:'lead',score:c,shift:0}:null;
  };
  const bars=[...offsetsByBar.keys()].sort((a,b)=>a-b);
  const found=new Map();
  for(const size of [2,1]){
    const earlier=[];   // 前にある小節(の始まり)
    const enough=bar=>size===2?sizeOf(bar)>=1&&sizeOf(bar+1)>=1&&sizeOf(bar)+sizeOf(bar+1)>=MIN_NOTES_2:sizeOf(bar)>=MIN_NOTES_1;
    for(const bar of bars){
      if(!enough(bar))continue;
      let free=true;for(let k=0;k<size;k++)if(skip(bar+k)||found.has(bar+k))free=false;
      if(free){
        let best=null;
        for(const source of earlier){
          if(source+size>bar||rhythmAlike(bar,source,size)<MIN_RHYTHM)continue;
          const a=alike(bar,source,size);if(!a)continue;
          if(!best||a.score>best.score+.02||(Math.abs(a.score-best.score)<=.02&&source>best.source))best={source,...a};
        }
        if(best)for(let k=0;k<size;k++)found.set(bar+k,{source:best.source+k,shift:best.shift,bars:size,by:best.by,score:Math.round(best.score*1000)/1000});
      }
      earlier.push(bar);
    }
  }
  // 出どころをたどって、いちばん最初の小節へ(高さのずれは道すがら足す)
  const sourceByBar=new Map();
  for(const bar of [...found.keys()].sort((a,b)=>a-b)){
    let current=bar,shift=0;
    for(let guard=0;guard<64;guard++){const hit=found.get(current);if(!hit||hit.source>=current)break;shift+=hit.shift;current=hit.source;}
    if(current<bar)sourceByBar.set(bar,{...found.get(bar),source:current,shift:Math.round(shift*1000)/1000});
  }
  return sourceByBar;
};

// 生成器と同じ「もう元が付いている小節」(区切りの繰り返し・4小節の繰り返し)
const skipFor=(audio,layers)=>{
  const {detectRepeats}=require('./rhythm-chart-repeats.js');
  const sections=(audio.structure&&audio.structure.sections)||[];
  const four=detectRepeats(audio,layers).sourceByBar;
  return bar=>four.has(bar)||sections.some(s=>s.repeatOf!=null&&bar>=s.startBar&&bar<s.endBarExclusive);
};

// 点検用: できあがった譜面で、動機の小節(同じリズム+音の上下が似ている)が元の小節と「同じ手の動き」になっている割合。
//   sameStep/pairs … 元の小節の同じ位置にもノーツがある音どうしで、隣への1歩の向き(右・左・同じ)が元と同じ割合。
//   小節ごとに「そのまま」と「左右反転」の合う方で数える(写しは2回目を反転させるため)。なので何もしなくても5割は超える。目安は前後の差。
//   位置はノーツの真ん中(太いノーツ・区切りの一発で幅が変わっても向きは比べられる)。同時押しは左の1つで比べる
//   list … 比べる小節の組 [[小節, 元の小節], …]。渡さなければ、その譜面に生成器が書いた組(chart.motifs.list)、それも無ければ譜面のノーツから見分け直す。
//          強化の前後を比べるときは、後の譜面の組を前の譜面にも渡す(同じ小節どうしを比べる)
const copyRateOfChart=(chart,audio,layers=null,{list=null}={})=>{
  const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
  const byBar=new Map();
  for(const n of chart.notes){const bar=Math.floor(n.grid/BAR);if(!byBar.has(bar))byBar.set(bar,new Map());const m=byBar.get(bar);
    const k=n.grid-bar*BAR,x=Number.isFinite(Number(n.subLane))?Number(n.subLane)+(Number(n.subLaneWidth)||2)/2:Number(n.lane)*2+1;m.set(k,m.has(k)?Math.min(m.get(k),x):x);}
  const offsets=new Map([...byBar].map(([bar,m])=>[bar,new Set(m.keys())]));
  const written=list||(chart.motifs&&Array.isArray(chart.motifs.list)&&chart.motifs.list.length?chart.motifs.list:null);
  const motifs=written?new Map(written.map(([bar,source,shift])=>[bar,{source,shift:shift||0,bars:1,by:'chart',score:1}]))
    :detectChartMotifs(audio,layers,offsets,{skip:skipFor(audio,layers)});
  let notes=0,pairs=0,sameStep=0;
  for(const [bar,{source}] of motifs){
    const own=byBar.get(bar),src=byBar.get(source);
    if(!own||!src)continue;
    const keys=[...own.keys()].filter(k=>src.has(k)).sort((x,y)=>x-y);   // 元の小節の同じ位置にもノーツがある音どうしで比べる
    notes+=keys.length;
    let plain=0,mirror=0;
    for(let k=1;k<keys.length;k++){const x=Math.sign(own.get(keys[k])-own.get(keys[k-1])),y=Math.sign(src.get(keys[k])-src.get(keys[k-1]));pairs++;if(x===y)plain++;if(x===-y)mirror++;}
    sameStep+=Math.max(plain,mirror);
  }
  return {motifBars:motifs.size,notes,pairs,sameStep,motifs};
};

module.exports={detectChartMotifs,skipFor,copyRateOfChart,MIN_NOTES_1,MIN_NOTES_2};

if(require.main===module){
  const fs=require('fs'),path=require('path');
  const arg=name=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:null;};
  const trackId=arg('--track'),difficulty=(arg('--difficulty')||'MASTER').toLowerCase();
  const data=trackId?require('./rhythm-chart-chorus.js').loadForTrack(trackId):null;
  if(!data){console.error('使い方: node tools/mode/rhythm-chart-motifs.js --track <曲> [--dir <場所>] [--difficulty MASTER]');process.exit(1);}
  const dir=arg('--dir')?path.resolve(arg('--dir')):path.join(__dirname,'authoring');
  const file=['fixed','chart'].map(kind=>path.join(dir,`${trackId.replace(/_/g,'-')}-v3-${kind}-${difficulty}.json`)).find(f=>fs.existsSync(f));
  if(!file){console.error(`譜面が無い: ${dir}`);process.exit(1);}
  const r=copyRateOfChart(JSON.parse(fs.readFileSync(file,'utf8')),data.audio,data.layers);
  console.log(`短い動機(${trackId} ${difficulty.toUpperCase()}): ${r.motifBars}小節 / 元と同じ向きの1歩 ${r.sameStep}/${r.pairs}`);
  for(const [bar,m] of r.motifs)console.log(`  小節${String(bar).padStart(3)} ← 小節${String(m.source).padStart(3)}(${m.bars}小節の動機・${m.by==='chart'?`生成器が足した組・ずらし ${m.shift>=0?'+':''}${m.shift}レーン`:`${m.by==='pitch'?'音高':'歌の帯'}の似かた ${m.score.toFixed(2)}・高さのずれ ${m.shift>=0?'+':''}${m.shift.toFixed(2)}`})`);
}
