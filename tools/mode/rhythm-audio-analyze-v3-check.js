#!/usr/bin/env node
// V3音源解析（rhythm-audio-analyze-v3.js）が、譜面づくりの土台として使えることを確かめる。
//
//   node tools/mode/rhythm-audio-analyze-v3-check.js
//
// 【なぜ要るか】
// 譜面の良し悪しは、まず「音をどれだけ正しく読めているか」で決まる。
// 読み違えたまま作り込むと、直しようのない譜面ができる。
// ここでは次を機械で見張る。
//   ・毎回同じ結果になる（乱数を使っていない／デコードがぶれない）
//   ・ゲームのランタイム・保存データ・既存の正式候補へ書き込まない
//   ・人が耳で確認して通した既存の候補を、ちゃんと含んでいる
//   ・16分格子に乗っている
//   ・音の性格の出方が音楽的（大きな一発は拍の頭、軽い音は裏に散る）
//   ・音の高さの線が暴れない（オクターブの取り違えが残っていない）
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const analyzerSource=read('tools/mode/rhythm-audio-analyze-v3.js');
const decodeSource=read('tools/mode/rhythm-audio-decode.js');
const dspSource=read('tools/mode/rhythm-audio-dsp.js');

// --- 書き込み先とふるまい ---
check('乱数を使わない（結果が毎回変わらないため）',
  ![analyzerSource,decodeSource,dspSource].some(source=>/Math\.random|crypto\.randomBytes/.test(source)));
check('書き出し先は設計資料の置き場（authoring）だけ',
  /tools\/mode\/authoring/.test(analyzerSource)
  &&!/writeFileSync\([^)]*monster-hero\//.test(analyzerSource));
check('曲をコードへ埋め込まず、一覧ファイルと --audio で足せる',
  /rhythm-song-registry\.json/.test(analyzerSource)&&/--audio/.test(analyzerSource)
  &&!/monster-hero\/audio\/bgm-/.test(analyzerSource));
check('人が耳で合わせた値（rhythm-timing.js）があればそちらを優先する',
  /registeredTiming/.test(analyzerSource)&&/source:timing\.source/.test(analyzerSource));
check('monster-hero からは読み取りしかしない',
  !/writeFileSync\([^)]*monster-hero/.test(analyzerSource)
  &&!/writeFileSync/.test(decodeSource));
check('設計資料であることを出力に書いている（ランタイムへは接続しない）',
  /reviewRequired:true/.test(analyzerSource)&&/runtimeConnected:false/.test(analyzerSource));
check('ffmpeg が無くてもデコードできる（ブラウザの経路を持っている）',
  /decodeWithChromium/.test(decodeSource)&&/decodeAudioData/.test(decodeSource));
check('解析のしきい値を定数で明示している',(()=>{
  const featuresSource=read('tools/mode/rhythm-audio-features-v3.js');
  const analyzerNames=['MIN_ONSET_GAP_MS','SUSTAIN_DROP','PITCH_WINDOW','PITCH_MIN_CLARITY','CHARACTER'];
  const featureNames=['SAMPLE_RATE','FFT_SIZE','HOP_SIZE','BANDS','CONTRAST_RADIUS_MS'];
  return analyzerNames.every(name=>new RegExp(`const ${name}=`).test(analyzerSource))
    &&featureNames.every(name=>new RegExp(`const ${name}=`).test(featuresSource));
})());
check('テンポ・拍子・刻みを音から出す道具がある',(()=>{
  const tempoSource=read('tools/mode/rhythm-audio-tempo-v3.js');
  return /estimateTempo/.test(tempoSource)&&/estimateMeter/.test(tempoSource)
    &&/estimateSubdivision/.test(tempoSource)&&/refineByRegression/.test(tempoSource);
})());
check('曲の区切り・盛り上がり・繰り返しを音から出す道具がある',(()=>{
  const structureSource=read('tools/mode/rhythm-audio-structure-v3.js');
  return /noveltyCurve/.test(structureSource)&&/repeats/.test(structureSource);
})());

// --- 信号処理の道具が正しいか（分かっている入力で確かめる） ---
const dsp=require('./rhythm-audio-dsp.js');
{
  const sampleRate=16000,length=sampleRate;
  const sine=new Float32Array(length);
  for(let i=0;i<length;i++)sine[i]=Math.sin(2*Math.PI*440*i/sampleRate)*.5;
  const pitch=dsp.estimatePitch(sine,1000,2048,sampleRate);
  check('440Hzのサイン波の音高を当てられる',Math.abs(pitch.hz-440)<2&&pitch.clarity>.9,
    `${pitch.hz.toFixed(1)}Hz / はっきり具合 ${pitch.clarity.toFixed(2)}`);
  // 低い音が強くても、帯域通過でメロディの帯を取り出せる
  const mixed=new Float32Array(length);
  for(let i=0;i<length;i++)mixed[i]=Math.sin(2*Math.PI*60*i/sampleRate)*.8+Math.sin(2*Math.PI*440*i/sampleRate)*.2;
  const filtered=dsp.biquadBandpass(mixed,sampleRate,600,.55);
  const melodyPitch=dsp.estimatePitch(filtered,2000,1024,sampleRate,{minHz:150,maxHz:1200});
  check('低音が強くても、帯域通過でメロディの音高を取り出せる',
    Math.abs(melodyPitch.hz-440)<12&&melodyPitch.clarity>.6,
    `${melodyPitch.hz.toFixed(1)}Hz / はっきり具合 ${melodyPitch.clarity.toFixed(2)}`);
  // 直近と比べた立ち上がりは、ずっと鳴っている帯を「跳ねた」と見なさない
  const flat=new Float32Array(200).fill(5);
  const contrastFlat=dsp.localContrast(flat,20);
  check('ずっと同じ大きさの帯は「跳ねた」と見なさない',
    Array.from(contrastFlat).every(v=>Math.abs(v-1)<.01));
  const spike=Float32Array.from(flat);spike[100]=25;
  const contrastSpike=dsp.localContrast(spike,20);
  check('跳ねた瞬間だけ大きくなる',contrastSpike[100]>4&&contrastSpike[99]<1.2,
    `跳ねた点 ${contrastSpike[100].toFixed(1)}倍 / 直前 ${contrastSpike[99].toFixed(2)}倍`);
}

// --- 実際に解析を通して結果を見る ---
const run=(...args)=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-audio-analyze-v3.js'),...args],
  {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
const outFile=path.join(ROOT,'tools/mode/authoring/monster-hero-theme-v3-audio.json');
const before=fs.existsSync(outFile)?fs.readFileSync(outFile,'utf8'):null;
const first=run('--write');
check('解析を実行できる',first.status===0,(first.stderr||'').split('\n')[0]);
if(first.status!==0){
  console.log(`\n${failed+1}件のNGがあります`);
  process.exit(1);
}
const firstHash=crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
const second=run('--write');
const secondHash=crypto.createHash('sha256').update(fs.readFileSync(outFile)).digest('hex');
check('2回走らせても1バイトも変わらない（決定的）',second.status===0&&firstHash===secondHash,
  `${firstHash.slice(0,12)} / ${secondHash.slice(0,12)}`);
if(before!==null&&before!==fs.readFileSync(outFile,'utf8')){
  // 検査が成果物を書き換えたままにしない
  fs.writeFileSync(outFile,before);
}
const report=JSON.parse(before!==null?before:fs.readFileSync(outFile,'utf8'));

check('出力の型が決めたとおり',report.analysisType==='rhythm-audio-v3'&&report.schemaVersion===2
  &&Array.isArray(report.onsets)&&Array.isArray(report.pitchCurve)&&Array.isArray(report.sustains)
  &&report.timing&&report.structure&&Array.isArray(report.structure.sections));
check('テンポ・拍子・刻みが出力に入っている',
  Number.isFinite(report.timing.bpm)&&Number.isFinite(report.timing.beatZeroMs)
  &&Number.isInteger(report.timing.beatsPerBar)&&Number.isInteger(report.timing.subdivisionsPerBeat)
  &&typeof report.timing.source==='string',
  `${report.timing.bpm} BPM / ${report.timing.beatsPerBar}拍子 / ${report.timing.subdivisionsPerBeat}分割 / ${report.timing.source}`);
check('曲の区切りが出力に入っている',
  report.structure.sections.length>=2&&report.structure.bars.length>=8
  &&report.structure.sections.every(s=>Number.isFinite(s.intensity)&&s.endBarExclusive>s.startBar),
  `${report.structure.sections.length}区切り / ${report.structure.bars.length}小節`);
check('音源のハッシュを残している（別の音源に差し替わったら分かる）',
  typeof report.audioSha256==='string'&&report.audioSha256.length===64);

const onsets=report.onsets;
check('打点の数が音楽的にありうる範囲',onsets.length>=400&&onsets.length<=1800,`${onsets.length}件`);
check('打点が時刻順に並んでいる',onsets.every((o,i)=>i===0||o.timeMs>=onsets[i-1].timeMs));
check('打点がすべて必要な項目を持っている',
  onsets.every(o=>Number.isFinite(o.timeMs)&&Number.isInteger(o.grid)&&Number.isFinite(o.strength)
    &&typeof o.character==='string'&&Number.isFinite(o.sustainMs)&&o.share&&Number.isFinite(o.share.low)));

check('16分格子へ乗っている（±43msに95%以上）',report.summary.gridFit.within43ms>=.95,
  `±15ms ${(report.summary.gridFit.within15ms*100).toFixed(0)}% / ±43ms ${(report.summary.gridFit.within43ms*100).toFixed(0)}%`);

// 人が耳で確認して通した既存の候補を含んでいるか
const gridsOf=list=>new Set(list);
const v3Grids=gridsOf(onsets.map(o=>o.grid));
const covers=file=>{
  const json=JSON.parse(read(file));
  const grids=json.candidates.map(c=>c[0]);
  const hit=grids.filter(g=>v3Grids.has(g)).length;
  return {hit,total:grids.length,ratio:hit/grids.length};
};
const dense=covers('tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json');
const normal=covers('tools/mode/authoring/monster-hero-theme-onset-candidates.json');
check('耳で確認済みの候補（dense）の8割以上を拾えている',dense.ratio>=.8,
  `${dense.hit}/${dense.total} (${(dense.ratio*100).toFixed(0)}%)`);
check('耳で確認済みの候補（normal）の8割以上を拾えている',normal.ratio>=.8,
  `${normal.hit}/${normal.total} (${(normal.ratio*100).toFixed(0)}%)`);

// 音の性格の出方が音楽的か
const positionOf=grid=>((grid%4)+4)%4;
const byCharacter=character=>{
  const list=onsets.filter(o=>o.character===character);
  const onBeat=list.filter(o=>positionOf(o.grid)===0).length;
  return {count:list.length,onBeat,onBeatRatio:list.length?onBeat/list.length:0};
};
const full=byCharacter('FULL'),light=byCharacter('LIGHT'),punch=byCharacter('PUNCH');
check('4つの性格がすべて出ている',
  ['PUNCH','BODY','FULL','LIGHT'].every(c=>byCharacter(c).count>0),
  ['PUNCH','BODY','FULL','LIGHT'].map(c=>`${c} ${byCharacter(c).count}`).join(' / '));
check('大きな一発（FULL）は拍の頭に偏る',full.onBeatRatio>=.4,
  `拍頭 ${(full.onBeatRatio*100).toFixed(0)}% (${full.onBeat}/${full.count})`);
check('軽い音（LIGHT）は拍の頭に偏らない（裏へ散る）',light.onBeatRatio<=.4,
  `拍頭 ${(light.onBeatRatio*100).toFixed(0)}% (${light.onBeat}/${light.count})`);
check('重い打点（PUNCH）は8分の位置に多い',(()=>{
  const eighth=onsets.filter(o=>o.character==='PUNCH'&&positionOf(o.grid)%2===0).length;
  return eighth/Math.max(1,punch.count)>=.55;
})(),`8分の位置 ${(onsets.filter(o=>o.character==='PUNCH'&&positionOf(o.grid)%2===0).length/Math.max(1,punch.count)*100).toFixed(0)}%`);

// 音の高さの線
const heights=report.pitchCurve.filter(p=>p.height!=null).map(p=>p.height);
check('16分ごとの音の高さを半分以上の位置で取れている',
  heights.length/report.pitchCurve.length>=.5,
  `${heights.length}/${report.pitchCurve.length} (${(heights.length/report.pitchCurve.length*100).toFixed(0)}%)`);
const wildJumps=heights.filter((h,i)=>i>0&&Math.abs(h-heights[i-1])>.5).length;
check('音の高さが一気に跳ばない（オクターブの取り違えが残っていない）',
  wildJumps/Math.max(1,heights.length)<=.01,
  `一気に半分以上跳ぶ ${wildJumps}/${heights.length} (${(wildJumps/Math.max(1,heights.length)*100).toFixed(1)}%)`);
check('音の高さが1点に張り付いていない（メロディとして動いている）',(()=>{
  const sorted=heights.slice().sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length*.9)]-sorted[Math.floor(sorted.length*.1)]>=.25;
})(),(()=>{
  const sorted=heights.slice().sort((a,b)=>a-b);
  return `上下1割を除いた幅 ${(sorted[Math.floor(sorted.length*.9)]-sorted[Math.floor(sorted.length*.1)]).toFixed(2)}`;
})());

// 伸びている区間（HOLDの長さに使う）
check('伸びている区間が十分にある（HOLDの元になる）',report.sustains.length>=20,`${report.sustains.length}件`);
check('伸びている区間の長さが実用的（1拍〜4拍が中心）',(()=>{
  const grids=report.sustains.map(s=>s.grids).sort((a,b)=>a-b);
  const median=grids[grids.length>>1];
  return median>=3&&median<=24;
})(),`中央値 ${report.sustains.map(s=>s.grids).sort((a,b)=>a-b)[report.sustains.length>>1]}グリッド`);
check('伸びている区間が時刻順で、重なっていない',
  report.sustains.every((s,i)=>s.endGrid>s.startGrid&&(i===0||s.startGrid>report.sustains[i-1].endGrid)));

// 跳ね（スイング）
check('跳ねの判定が範囲内',report.summary.swing.ratio>=.5&&report.summary.swing.ratio<=.72,
  `${report.summary.swing.ratio}`);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
