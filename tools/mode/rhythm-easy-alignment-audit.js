#!/usr/bin/env node
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..','..');
const draft=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-easy-draft.json'),'utf8'));

let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const round=(n,d=2)=>Number(Number(n).toFixed(d));
const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
const median=values=>{
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
};
const regressionSlope=(xs,ys)=>{
  const mx=mean(xs),my=mean(ys);
  let numerator=0,denominator=0;
  for(let i=0;i<xs.length;i++){
    const dx=xs[i]-mx;
    numerator+=dx*(ys[i]-my);
    denominator+=dx*dx;
  }
  return denominator?numerator/denominator:0;
};

const points=Array.isArray(draft.points)?draft.points:[];
const beatMs=60000/Number(draft.bpm||169);
const stepMs=beatMs/Number(draft.subdivisionsPerBeat||4);
const grids=points.map(row=>Number(row?.[0])).filter(Number.isFinite);
const deltas=points.map(row=>Number(row?.[2])).filter(Number.isFinite);
const absDeltas=deltas.map(Math.abs);
const timesMs=grids.map(grid=>Number(draft.beatZeroMs||0)+grid*stepMs);
const slopeMsPerMs=regressionSlope(timesMs,deltas);
const driftMsPerMin=slopeMsPerMs*60000;
const within30=absDeltas.filter(value=>value<=30).length/Math.max(1,absDeltas.length);
const within40=absDeltas.filter(value=>value<=40).length/Math.max(1,absDeltas.length);
const flagged=points.filter(row=>Math.abs(Number(row?.[2]))>30);
const quartileSize=Math.max(1,Math.floor(deltas.length/4));
const firstQuarter=mean(deltas.slice(0,quartileSize));
const lastQuarter=mean(deltas.slice(-quartileSize));
const sectionShift=lastQuarter-firstQuarter;

console.log('あつ杯テーマ EASY 音ハメ監査');
console.log(`  ノーツ候補: ${points.length}`);
console.log(`  平均ピーク差: ${round(mean(deltas),1)}ms`);
console.log(`  中央ピーク差: ${round(median(deltas),1)}ms`);
console.log(`  平均絶対差: ${round(mean(absDeltas),1)}ms`);
console.log(`  中央絶対差: ${round(median(absDeltas),1)}ms`);
console.log(`  ±30ms以内: ${round(within30*100,1)}%`);
console.log(`  ±40ms以内: ${round(within40*100,1)}%`);
console.log(`  時間ドリフト傾向: ${round(driftMsPerMin,1)}ms/分`);
console.log(`  前半1/4→後半1/4の平均差: ${round(sectionShift,1)}ms`);
console.log(`  要耳確認(±30ms超): ${flagged.length}点`);
if(flagged.length)console.log(`  要耳確認grid: ${flagged.map(row=>row[0]).join(', ')}`);

check('100点のEASY制作ドラフトを監査',points.length===100&&deltas.length===100);
check('中央絶対差が25ms以内',median(absDeltas)<=25);
check('平均絶対差が25ms以内',mean(absDeltas)<=25);
check('90%以上が±40ms以内',within40>=.90);
check('曲中の継続ドリフトが10ms/分以内',Math.abs(driftMsPerMin)<=10);
check('前半→後半の区間偏りが20ms以内',Math.abs(sectionShift)<=20);

console.log('\n※ ±30ms超は自動NGではなく、正式譜面化前に区間ループ＋実機で耳確認する対象。');
console.log(failed?`\n${failed}件のNGがあります`:'\n音ハメ基礎監査: OK');
process.exit(failed?1:0);
