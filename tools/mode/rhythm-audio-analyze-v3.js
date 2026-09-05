#!/usr/bin/env node
// 譜面制作V3 音源解析: 「いつ鳴ったか」だけでなく「どんな音か」「どんな曲か」まで出す。
//
//   node tools/mode/rhythm-audio-analyze-v3.js                              # 登録済みの曲を解析
//   node tools/mode/rhythm-audio-analyze-v3.js --write
//   node tools/mode/rhythm-audio-analyze-v3.js --audio <mp3> --track <id>   # 新しい曲を足す
//   node tools/mode/rhythm-audio-analyze-v3.js --bpm 173.153 --beat-zero 206  # 人が決めた値を使う
//   node tools/mode/rhythm-audio-analyze-v3.js --verbose
//
// 出力: tools/mode/authoring/<track>-v3-audio.json
//       tools/mode/authoring/rhythm-song-registry.json（曲の一覧。ここへ自動で足される）
//
// 【この道具が1つで出すもの】
//   ・テンポ / 拍の頭 / 拍子 / 刻み / 跳ね      … 音から自動（人が決めた値があればそちらを使う）
//   ・曲の区切り / 盛り上がり / 繰り返し         … 音から自動
//   ・打点ごとの 性格・伸びる長さ・音の高さ       … 音から
//   ・16分ごとの音の高さの線 / 高さが続く区間
//
// 【なぜ全部ここで出すか】
// 前は BPM を rhythm-timing.js へ手で書き、区切りは ffmpeg を使う別系統の道具が作っていた。
// そのため**書いてある2曲しか譜面を作れなかった**。曲を1つ足すのにコードと人手が要る状態では
// 「全ての曲に対応できるツール」にならない。ここを音だけで完結させる。
//
// 音源は読み取りしかしない。ゲームのランタイム・保存データには一切触れない。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const {audioFeatures,BANDS,SAMPLE_RATE,FFT_SIZE,HOP_SIZE,CONTRAST_RADIUS_MS}=require('./rhythm-audio-features-v3.js');
const {detectTiming}=require('./rhythm-audio-tempo-v3.js');
const {detectStructure}=require('./rhythm-audio-structure-v3.js');
const {pickPeaks,estimatePitch,biquadBandpass}=require('./rhythm-audio-dsp.js');
const {collectWarnings,criticalWarnings,formatWarnings}=require('./rhythm-audio-warnings.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const trackId=arg('--track','monster_hero_theme');
const verbose=process.argv.includes('--verbose');

const REGISTRY_FILE='tools/mode/authoring/rhythm-song-registry.json';
const readRegistry=()=>{
  const file=path.join(ROOT,REGISTRY_FILE);
  if(!fs.existsSync(file))return {schemaVersion:1,songs:{}};
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return {schemaVersion:1,songs:{}};}
};
const writeRegistry=registry=>{
  fs.writeFileSync(path.join(ROOT,REGISTRY_FILE),JSON.stringify(registry,null,1)+'\n');
};
// rhythm-timing.js に人が耳で合わせた値があれば、それを最優先で使う。
// 自動判定は「まだ誰も確かめていない曲」のためのもので、確かめ済みの値を上書きしない。
const registeredTiming=trackId=>{
  const file=path.join(ROOT,'monster-hero/data/rhythm-timing.js');
  if(!fs.existsSync(file))return null;
  const context={Object,Number,Math};
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(file,'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,context);
  return context.__t||null;
};

// --- 解析の設定（動かすと結果が変わるので定数で明示する） ---
const MIN_ONSET_GAP_MS=48;        // これより近い打点は1つにまとめる（32分より細かい音は拾わない）
const SUSTAIN_DROP=.4;            // 打点の盛り上がりがここまで落ちたら「伸びが終わった」
const SUSTAIN_MAX_MS=2400;
const PITCH_WINDOW=1024;          // 64ms。16分（87ms）より短く取り、音の変わり目を潰さない
const PITCH_BAND_HZ=600;          // メロディの帯だけ残してから音高を取る
const PITCH_BAND_Q=.55;
const PITCH_MIN_HZ=150,PITCH_MAX_HZ=1200;
const PITCH_MIN_CLARITY=.5;       // これ未満は「音程が取れなかった」とみなす

// 音の性格。楽器名を名乗らず、**譜面づくりで実際に使う区別**だけを持つ。
//   PUNCH … 低い帯だけが跳ねた重い打点        → 太い・中央寄り
//   BODY  … 中低〜中が跳ねた胴のある音         → ふつう
//   LIGHT … 高い帯だけが跳ねた軽い音           → 細い・外寄り
//   FULL  … 全部の帯が一度に跳ねた大きな一発   → 全幅のアクセント
const CHARACTER=Object.freeze({
  fullMinBands:3,        // これだけの帯が同時に跳ねたら「大きな一発」
  fullMinContrast:1.9,   // 「跳ねた」と数えるコントラスト
  punchLowShare:.34,
  lightHighShare:.42,
});

// --- どの曲を解析するか ---
const registry=readRegistry();
const audioArg=arg('--audio',null);
const outputDir=arg('--output-dir',null);
const bpmArg=Number(arg('--bpm',NaN));
const beatZeroArg=Number(arg('--beat-zero',NaN));
const beatsPerBarArg=Number(arg('--beats-per-bar',NaN));
const entry=registry.songs[trackId]||null;
const audioRelative=audioArg||entry?.audio||null;
if(!audioRelative){
  console.error(`曲が分かりません。--audio <mp3> を付けるか、${REGISTRY_FILE} へ登録してください。`);
  console.error(`登録済み: ${Object.keys(registry.songs).join(', ')||'（まだ無し）'}`);
  process.exit(1);
}
const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

(async()=>{
  const audioPath=path.join(ROOT,audioRelative);
  if(!fs.existsSync(audioPath)){console.error(`音源が見つかりません: ${audioRelative}`);process.exit(1);}
  const audioSha256=crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');

  // --- 1. 土台（デコード・帯域・打点らしさ） ---
  const features=await audioFeatures(audioRelative);
  const {frames,frameMs,level,contrast,bandIds:ids,samples,frameToMs,msToFrame}=features;

  // --- 2. テンポ・拍・拍子・刻み ---
  // 人が耳で合わせた値（rhythm-timing.js）や、コマンドで指定した値があればそちらを優先する。
  const detected=await detectTiming(audioRelative,{features});
  const registered=registeredTiming(trackId);
  const confirmed=entry?.confirmedTiming||null;
  const timing=(()=>{
    const base=detected||{bpm:120,beatMs:500,beatZeroMs:0,beatsPerBar:4,subdivisionsPerBeat:4,
      triplet:false,swing:{ratio:.5,shift:0},confidence:{}};
    const merged={...base,detected:detected?{bpm:detected.bpm,beatZeroMs:detected.beatZeroMs,
      beatsPerBar:detected.beatsPerBar,subdivisionsPerBeat:detected.subdivisionsPerBeat,
      gridFit:detected.gridFit,beatPresence:detected.beatPresence,
      stability:detected.stability,
      candidates:detected.tempoCandidates}:null};
    let source='detected';
    const apply=(values,name)=>{
      if(!values)return;
      source=name;
      if(Number.isFinite(values.bpm)){merged.bpm=values.bpm;merged.beatMs=60000/values.bpm;}
      // 人が書いた beatMs があれば、それをそのまま使う（BPMから割り直さない）。
      // rhythm-timing.js の beatMs は丸めた値なので、割り直すと1msずれ、
      // 既にランタイムへ入っている譜面の時刻がわずかに動いてしまう。
      if(Number.isFinite(values.beatMs)&&values.beatMs>0)merged.beatMs=values.beatMs;
      if(Number.isFinite(values.beatZeroMs))merged.beatZeroMs=values.beatZeroMs;
      if(Number.isFinite(values.beatsPerBar))merged.beatsPerBar=values.beatsPerBar;
      if(Number.isFinite(values.subdivisionsPerBeat))merged.subdivisionsPerBeat=values.subdivisionsPerBeat;
    };
    apply(registered,'registered');
    apply(confirmed,'confirmed');
    if(Number.isFinite(bpmArg)||Number.isFinite(beatZeroArg)||Number.isFinite(beatsPerBarArg)){
      apply({bpm:Number.isFinite(bpmArg)?bpmArg:undefined,
        beatZeroMs:Number.isFinite(beatZeroArg)?beatZeroArg:undefined,
        beatsPerBar:Number.isFinite(beatsPerBarArg)?beatsPerBarArg:undefined},'command');
    }
    merged.source=source;
    return merged;
  })();
  const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
  const gridOfMs=ms=>(ms-timing.beatZeroMs)/gridMs;

  // --- 3. 曲の区切り・盛り上がり・繰り返し ---
  const structure=await detectStructure(audioRelative,timing,{features});

  // --- 4. 打点ごとの特徴 ---
  const minGapFrames=Math.max(1,Math.round(MIN_ONSET_GAP_MS/frameMs));
  const peaks=pickPeaks(features.envelope,
    {medianRadius:features.contrastRadius,delta:.15,minGap:minGapFrames,multiplier:1.22});
  const strengthScale=(()=>{
    const sorted=Array.from(features.envelope).sort((a,b)=>a-b);
    const top=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.99))]||1;
    return value=>Math.max(0,Math.min(1,value/top));
  })();

  // 音高（メロディの帯だけ残してから取る）
  const melody=biquadBandpass(samples,SAMPLE_RATE,PITCH_BAND_HZ,PITCH_BAND_Q);
  const pitchAt=ms=>{
    const start=Math.round(ms/1000*SAMPLE_RATE);
    if(start<0||start+PITCH_WINDOW>=melody.length)return {hz:0,clarity:0,level:0};
    return estimatePitch(melody,start,PITCH_WINDOW,SAMPLE_RATE,{minHz:PITCH_MIN_HZ,maxHz:PITCH_MAX_HZ});
  };

  const onsets=[];
  for(const frame of peaks){
    const timeMs=frameToMs(frame);
    if(timeMs<0)continue;
    const raw=ids.map((id,b)=>Math.max(contrast[b][frame],contrast[b][Math.min(frames-1,frame+1)]));
    const excess=raw.map(value=>Math.max(0,value-1));
    const total=excess.reduce((a,b)=>a+b,0);
    const share=Object.fromEntries(ids.map((id,b)=>[id,total>0?excess[b]/total:0]));
    const jumped=raw.filter(value=>value>=CHARACTER.fullMinContrast).length;

    // 伸びの長さ: いちばん跳ねた帯の中で、打点の直前の高さを基準に測る
    const dominant=raw.indexOf(Math.max(...raw));
    const sustainMs=(()=>{
      const series=level[dominant];
      const before=series[Math.max(0,frame-6)]||0;
      let peak=0;
      for(let f=frame;f<=Math.min(frames-1,frame+4);f++)peak=Math.max(peak,series[f]);
      const rise=peak-before;
      if(rise<=0)return 0;
      const limit=Math.min(frames-1,frame+Math.round(SUSTAIN_MAX_MS/frameMs));
      for(let f=frame+2;f<=limit;f++){
        if(series[f]-before<rise*SUSTAIN_DROP)return Math.round((f-frame)*frameMs);
      }
      return SUSTAIN_MAX_MS;
    })();

    const pitch=pitchAt(timeMs+24);
    const pitched=pitch.clarity>=PITCH_MIN_CLARITY;
    let character='BODY';
    if(jumped>=CHARACTER.fullMinBands)character='FULL';
    else if(share.low>=CHARACTER.punchLowShare)character='PUNCH';
    else if(share.hi+share.air>=CHARACTER.lightHighShare&&share.low<.2)character='LIGHT';

    const grid=Math.round(gridOfMs(timeMs));
    onsets.push({
      timeMs:round(timeMs,2),grid,
      gridOffsetMs:round(timeMs-(timing.beatZeroMs+grid*gridMs),2),
      strength:round(strengthScale(features.envelope[frame])),
      character,bandsJumped:jumped,
      contrast:Object.fromEntries(ids.map((id,b)=>[id,round(raw[b],2)])),
      share:Object.fromEntries(ids.map(id=>[id,round(share[id])])),
      sustainMs,sustainGrids:round(sustainMs/gridMs,2),
      pitchHz:pitched?round(pitch.hz,1):0,
      pitchClarity:round(pitch.clarity),
    });
  }

  // --- 5. 16分ごとの音の高さ（SLIDEの経路に使う） ---
  const firstGrid=Math.max(0,Math.ceil(gridOfMs(0)));
  const lastGrid=Math.floor(gridOfMs(features.durationMs-PITCH_WINDOW/SAMPLE_RATE*1000));
  const semitoneOf=hz=>hz>0?69+12*Math.log2(hz/440):null;
  const pitchCurve=[];
  for(let grid=firstGrid;grid<=lastGrid;grid++){
    const ms=timing.beatZeroMs+grid*gridMs;
    const pitch=pitchAt(ms+16);
    const clear=pitch.clarity>=PITCH_MIN_CLARITY;
    pitchCurve.push({grid,hz:clear?round(pitch.hz,1):0,clarity:round(pitch.clarity),
      semitone:clear?round(semitoneOf(pitch.hz),2):null});
  }
  // オクターブの取り違えを直す（直前までの高さにいちばん近いオクターブへ寄せる）
  {
    const recent=[];
    for(const point of pitchCurve){
      if(point.semitone==null)continue;
      if(recent.length){
        const sorted=recent.slice().sort((a,b)=>a-b);
        const center=sorted[sorted.length>>1];
        let best=point.semitone,bestDistance=Math.abs(point.semitone-center);
        for(const shift of [-24,-12,12,24]){
          const moved=point.semitone+shift;
          const distance=Math.abs(moved-center);
          if(distance<bestDistance-.5){best=moved;bestDistance=distance;}
        }
        point.semitone=round(best,2);
        point.hz=round(440*2**((best-69)/12),1);
      }
      recent.push(point.semitone);
      if(recent.length>8)recent.shift();
    }
    const values=pitchCurve.map(point=>point.semitone);
    for(let i=0;i<pitchCurve.length;i++){
      if(values[i]==null)continue;
      const window=[values[i-1],values[i],values[i+1]].filter(value=>value!=null).sort((a,b)=>a-b);
      pitchCurve[i].semitone=round(window[window.length>>1],2);
    }
  }
  const semitones=pitchCurve.map(point=>point.semitone).filter(value=>value!=null).sort((a,b)=>a-b);
  const lo=semitones.length?semitones[Math.floor(semitones.length*.05)]:0;
  const hi=semitones.length?semitones[Math.floor(semitones.length*.95)]:1;
  for(const point of pitchCurve){
    point.height=point.semitone==null?null
      :round(Math.max(0,Math.min(1,(point.semitone-lo)/Math.max(1e-6,hi-lo))));
  }

  // --- 6. 高さが続いている区間（HOLDの長さ・SLIDEの範囲に使う） ---
  const sustains=[];
  {
    let run=null;
    const flush=()=>{
      if(run&&run.endGrid-run.startGrid>=2){
        const heights=run.heights;
        sustains.push({startGrid:run.startGrid,endGrid:run.endGrid,grids:run.endGrid-run.startGrid,
          fromHeight:heights[0],toHeight:heights[heights.length-1],
          minHeight:Math.min(...heights),maxHeight:Math.max(...heights),
          moves:round(Math.max(...heights)-Math.min(...heights)),clarity:round(run.clarity)});
      }
      run=null;
    };
    for(const point of pitchCurve){
      const usable=point.semitone!=null;
      if(usable&&run&&point.grid===run.endGrid+1&&Math.abs(point.semitone-run.lastSemitone)<=4){
        run.endGrid=point.grid;run.lastSemitone=point.semitone;
        run.heights.push(point.height);run.clarity=Math.max(run.clarity,point.clarity);
      }else{
        flush();
        if(usable)run={startGrid:point.grid,endGrid:point.grid,lastSemitone:point.semitone,
          heights:[point.height],clarity:point.clarity};
      }
    }
    flush();
  }

  const gridFit=(()=>{
    const within=ms=>onsets.filter(onset=>Math.abs(onset.gridOffsetMs)<=ms).length;
    return {within15ms:round(within(15)/Math.max(1,onsets.length)),
      within30ms:round(within(30)/Math.max(1,onsets.length)),
      within43ms:round(within(43)/Math.max(1,onsets.length))};
  })();
  const characterCounts=onsets.reduce((acc,onset)=>{acc[onset.character]=(acc[onset.character]||0)+1;return acc;},{});

  // 「拍がどれだけはっきりしているか」。拍の頭の音の強さ ÷ 16分裏の音の強さ。
  //
  // 【なぜ要るか】2026-09-05、Stay With Me で「全然テンポにあった譜面になってない」
  // という報告があった。調べると、格子は曲の頭から終わりまで±7ms以内で合っていて、
  // ずれていたわけではなかった。問題は**拾っている音**のほうで、
  // この曲は16分裏の音が全体の半分あり、しかもその強さが拍の頭とほぼ同じだった
  // （拍の頭0.405 / 8分裏0.403 / 16分裏0.393）。つまり打点の強弱で拍が立っていない。
  // ドラムではなく、ストリングスや持続音の立ち上がりを拾っているためで、
  // これを叩かせると「曲と関係ないところを押している」ことになる。
  //
  // 比べると Monster Hero は 0.583 / 0.573 / 0.391 で16分裏だけがはっきり弱い＝拍がある。
  // この比を出しておけば、生成側が「この曲は16分裏を拾ってよいか」を判断できる。
  const beatClarity=(()=>{
    const at=test=>{
      const list=onsets.filter(onset=>test(((onset.grid%timing.subdivisionsPerBeat)+timing.subdivisionsPerBeat)%timing.subdivisionsPerBeat));
      return list.length?list.reduce((sum,onset)=>sum+onset.strength,0)/list.length:0;
    };
    const onBeat=at(position=>position===0);
    const offBeat=at(position=>position%2===1);
    return {onBeatStrength:round(onBeat),offBeatStrength:round(offBeat),
      ratio:offBeat>0?round(onBeat/offBeat):null};
  })();

  // --- 7. あやしさ（このまま譜面にしてよいか） ---
  const warnings=collectWarnings({timing,detected,durationMs:features.durationMs,
    onsetCount:onsets.length,sectionCount:structure.sections.length});

  const report={
    schemaVersion:2,
    analysisType:'rhythm-audio-v3',
    trackId,
    audio:audioRelative,
    audioSha256,
    decodedVia:features.decodedVia,
    durationMs:Math.round(features.durationMs),
    reviewRequired:true,
    runtimeConnected:false,
    analysis:{sampleRate:SAMPLE_RATE,fftSize:FFT_SIZE,hopSize:HOP_SIZE,frameMs:round(frameMs),
      bands:BANDS,contrastRadiusMs:CONTRAST_RADIUS_MS,minOnsetGapMs:MIN_ONSET_GAP_MS,
      sustainDrop:SUSTAIN_DROP,pitchWindow:PITCH_WINDOW,pitchBandHz:PITCH_BAND_HZ,
      pitchMinClarity:PITCH_MIN_CLARITY,character:CHARACTER},
    timing:{bpm:round(timing.bpm,4),beatMs:round(timing.beatMs,4),beatZeroMs:round(timing.beatZeroMs,1),
      beatsPerBar:timing.beatsPerBar,subdivisionsPerBeat:timing.subdivisionsPerBeat,
      gridMs:round(gridMs,4),triplet:!!timing.triplet,swing:timing.swing,
      source:timing.source,confidence:timing.confidence,detected:timing.detected,
      stability:detected?detected.stability:null},
    warnings,
    structure:{sections:structure.sections,bars:structure.bars,repeats:structure.repeats,
      settings:structure.settings},
    summary:{onsetCount:onsets.length,characterCounts,gridFit,beatClarity,swing:timing.swing,
      pitchedOnsets:onsets.filter(onset=>onset.pitchHz>0).length,
      pitchCurvePoints:pitchCurve.length,
      pitchCurveClear:pitchCurve.filter(point=>point.height!=null).length,
      sustainSpans:sustains.length,
      sectionCount:structure.sections.length,
      barCount:structure.bars.length,
      notesPerSecondCeiling:round(onsets.length/(features.durationMs/1000),2)},
    onsets,pitchCurve,sustains,
  };

  console.log(`V3音源解析: ${trackId}  (${features.decodedVia}でデコード / ${SAMPLE_RATE}Hz / ${(features.durationMs/1000).toFixed(1)}秒)`);
  console.log(`  テンポ ${timing.bpm.toFixed(2)} BPM / ${timing.beatsPerBar}拍子 / 拍の頭 ${Math.round(timing.beatZeroMs)}ms / `
    +`${timing.subdivisionsPerBeat}分割${timing.triplet?'(3連)':''} / 跳ね ${timing.swing.ratio<=.53?'なし':timing.swing.ratio.toFixed(2)}`
    +`  [${timing.source==='detected'?'自動判定':timing.source==='registered'?'登録値':timing.source==='confirmed'?'確認済み':'コマンド指定'}]`);
  if(timing.detected&&timing.source!=='detected'){
    console.log(`    （自動判定は ${timing.detected.bpm.toFixed(2)} BPM / 拍の頭 ${Math.round(timing.detected.beatZeroMs)}ms）`);
  }
  console.log(`  打点 ${onsets.length}件  ${Object.entries(characterCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(' / ')}`);
  console.log(`  格子への乗り: ±15ms ${(gridFit.within15ms*100).toFixed(0)}% / ±30ms ${(gridFit.within30ms*100).toFixed(0)}% / ±43ms ${(gridFit.within43ms*100).toFixed(0)}%`);
  console.log(`  区切り ${structure.sections.length}個 (${structure.sections.map(s=>s.label).join('')}) / 繰り返し ${structure.repeats.length}組 / ${structure.bars.length}小節`);
  if(warnings.length){
    console.log(`  あやしい点 ${warnings.length}件（うち止めるべきもの ${criticalWarnings(warnings).length}件）`);
    for(const line of formatWarnings(warnings))console.log(`    ${line}`);
  }else{
    console.log('  あやしい点は見つかりませんでした');
  }
  console.log(`  音高が取れた打点 ${report.summary.pitchedOnsets}/${onsets.length}  16分ごとの音高 ${report.summary.pitchCurveClear}/${pitchCurve.length}  高さが続く区間 ${sustains.length}件`);
  if(verbose){
    for(const section of structure.sections){
      console.log(`    ${section.label} 第${String(section.startBar+1).padStart(3)}〜${String(section.endBarExclusive).padStart(3)}小節 `
        +`盛り上がり ${'█'.repeat(Math.round(section.intensity*20)).padEnd(20,'·')} ${section.intensity.toFixed(2)}`);
    }
  }

  if(write){
    const dir=outputDir?path.resolve(ROOT,outputDir):path.join(ROOT,'tools/mode/authoring');
    fs.mkdirSync(dir,{recursive:true});
    const out=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
    console.log(`\n書き出し: ${path.relative(ROOT,out)}`);
    // 曲の一覧へ登録する（次からは --track だけで解析できる）。
    // 検査などで書き出し先を変えているときは、本物の一覧を汚さない。
    if(!outputDir){
    registry.songs[trackId]={
      ...(registry.songs[trackId]||{}),
      audio:audioRelative,
      audioSha256,
      durationMs:Math.round(features.durationMs),
      analyzedTiming:{bpm:round(timing.bpm,4),beatZeroMs:round(timing.beatZeroMs,1),
        beatsPerBar:timing.beatsPerBar,subdivisionsPerBeat:timing.subdivisionsPerBeat,source:timing.source},
    };
    registry.schemaVersion=1;
    writeRegistry(registry);
    console.log(`登録: ${REGISTRY_FILE}（${Object.keys(registry.songs).length}曲）`);
    }
  }else{
    console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
  }
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
