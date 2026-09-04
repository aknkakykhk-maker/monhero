#!/usr/bin/env node
// 譜面制作V3 音源解析: 「いつ鳴ったか」だけでなく「どんな音か」まで出す。
//
//   node tools/mode/rhythm-audio-analyze-v3.js                      # 内訳を表示するだけ
//   node tools/mode/rhythm-audio-analyze-v3.js --write              # authoring/ へ書き出す
//   node tools/mode/rhythm-audio-analyze-v3.js --track atsu_cup_theme
//   node tools/mode/rhythm-audio-analyze-v3.js --verbose            # 打点を並べて見る
//
// 出力: tools/mode/authoring/<track>-v3-audio.json
//
// 【なぜ要るか】
// 本物の音ゲーの譜面は「音の種類」でノーツの種類を決めている。
//   低くて重い打点（キック）      → 太いTAP・画面の中央寄り
//   胴のある打点（スネア/クラップ）→ アクセント・左右で受け合う
//   軽くて高い音（ハイハット）    → 細いTAP・16分の埋め
//   伸びる音                     → HOLD（**音が伸びている長さぶん**）
//   高さが動く音                 → SLIDE（**音の高さの動きに沿った経路**）
//
// これまでの解析（STEP1）は、打点ごとに持っているのが「強さ」だけだった。そのため
//   ・HOLDの長さを「次のノーツまでの間隔」から決めていた（音とは無関係）
//   ・SLIDEの経路を決まった形の組み合わせで作っていた（音の高さとは無関係）
//   ・どの音も同じ扱いで、強さの順位だけで幅を決めていた
// という作り方しかできなかった。
//
// 【測り方の要点】
// ゲームのBGMは密なミックスで、高域はほぼ鳴りっぱなし。帯域の絶対値で見ると
// 「いつも鳴っている」で終わるので、**その帯域自身の直近の中央値と比べて何倍か**
// （コントラスト）で見る。これで「低域だけ跳ねた＝重い打点」「高域だけ跳ねた＝軽い音」
// を分けられる。伸びの長さも、いちばん跳ねた帯域の中で、打点の直前の高さを基準に測る。
//
// 音源は読み取りしかしない。ゲームのランタイム・保存データには一切触れない。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const crypto=require('crypto');
const {decodeAudio}=require('./rhythm-audio-decode.js');
const {spectrogram,bandFlux,normalize,pickPeaks,estimatePitch,biquadBandpass,localContrast}=require('./rhythm-audio-dsp.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const trackId=arg('--track','monster_hero_theme');
const verbose=process.argv.includes('--verbose');

const TRACKS=Object.freeze({
  monster_hero_theme:{audio:'monster-hero/audio/bgm-monster-hero-theme.mp3'},
  atsu_cup_theme:{audio:'monster-hero/audio/bgm-atsu-cup-theme.mp3'},
});

// --- 解析の設定（動かすと結果が変わるので定数で明示する） ---
const SAMPLE_RATE=16000;
const FFT_SIZE=1024;              // 64ms。打点の鋭さを見るのに十分で、ハイハットも分けられる
const HOP_SIZE=128;               // 8ms。16分（87ms）の中に約11フレーム入る
const BANDS=Object.freeze([
  Object.freeze({id:'low',    fromHz:40,   toHz:120}),   // キックの胴
  Object.freeze({id:'lowMid', fromHz:120,  toHz:400}),   // ベース・スネアの胴
  Object.freeze({id:'mid',    fromHz:400,  toHz:1600}),  // 声・リード・スネアの芯
  Object.freeze({id:'hi',     fromHz:1600, toHz:4000}),  // 子音・スネアのアタック
  Object.freeze({id:'air',    fromHz:4000, toHz:7800}),  // ハイハット・シンバル
]);
const CONTRAST_RADIUS_MS=350;     // 「直近」の幅。1小節（約800ms）より短く、拍より長く取る
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

const config=TRACKS[trackId];
if(!config){console.error(`未登録のトラックです: ${trackId} (${Object.keys(TRACKS).join(', ')})`);process.exit(1);}

// --- BPM・グリッド（既存の rhythm-timing.js をそのまま使う） ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} の timing データがありません`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridOfMs=ms=>(ms-timing.beatZeroMs)/gridMs;
const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

(async()=>{
  const audioPath=path.join(ROOT,config.audio);
  const audioSha256=crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
  const decoded=await decodeAudio(config.audio,{sampleRate:SAMPLE_RATE});
  const samples=decoded.samples;
  const frameMs=HOP_SIZE/SAMPLE_RATE*1000;
  const frameToMs=frame=>frame*frameMs+FFT_SIZE/2/SAMPLE_RATE*1000;
  const msToFrame=ms=>Math.round((ms-FFT_SIZE/2/SAMPLE_RATE*1000)/frameMs);

  const spec=spectrogram(samples,FFT_SIZE,HOP_SIZE);
  const {ids,flux,level,frames}=bandFlux(spec,SAMPLE_RATE,BANDS);
  const contrastRadius=Math.max(4,Math.round(CONTRAST_RADIUS_MS/frameMs));
  // 帯域ごとに「直近と比べて何倍か」を出す。密なミックスでもここで差が出る。
  const contrast=flux.map(values=>localContrast(values,contrastRadius));
  const levelContrast=level.map(values=>localContrast(values,contrastRadius));

  // 打点の検出関数: どれかの帯がはっきり跳ねたら山になる（帯ごとの跳ねの最大＋平均）
  const detection=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    let max=0,sum=0;
    for(let b=0;b<contrast.length;b++){const v=contrast[b][f];if(v>max)max=v;sum+=v;}
    detection[f]=max*.6+sum/contrast.length*.4;
  }
  const smooth=new Float32Array(frames);
  for(let f=0;f<frames;f++){
    const a=detection[Math.max(0,f-1)],b=detection[f],c=detection[Math.min(frames-1,f+1)];
    smooth[f]=(a+b*2+c)/4;
  }
  const minGapFrames=Math.max(1,Math.round(MIN_ONSET_GAP_MS/frameMs));
  const peaks=pickPeaks(smooth,{medianRadius:contrastRadius,delta:.15,minGap:minGapFrames,multiplier:1.22});
  const strengthScale=normalize(smooth,.99);

  // --- 音高（メロディの帯だけ残してから取る） ---
  const melody=biquadBandpass(samples,SAMPLE_RATE,PITCH_BAND_HZ,PITCH_BAND_Q);
  const pitchAt=ms=>{
    const start=Math.round(ms/1000*SAMPLE_RATE);
    if(start<0||start+PITCH_WINDOW>=melody.length)return {hz:0,clarity:0,level:0};
    return estimatePitch(melody,start,PITCH_WINDOW,SAMPLE_RATE,{minHz:PITCH_MIN_HZ,maxHz:PITCH_MAX_HZ});
  };

  // --- 打点ごとの特徴 ---
  const onsets=[];
  for(const frame of peaks){
    const timeMs=frameToMs(frame);
    if(timeMs<0)continue;
    // 立ち上がりは8〜16msで立つので、2フレームぶん見る
    const raw=ids.map((id,b)=>Math.max(contrast[b][frame],contrast[b][Math.min(frames-1,frame+1)]));
    const excess=raw.map(v=>Math.max(0,v-1));          // 1倍＝いつもどおり。超えたぶんだけ数える
    const total=excess.reduce((a,b)=>a+b,0);
    const share=Object.fromEntries(ids.map((id,b)=>[id,total>0?excess[b]/total:0]));
    const contrastByBand=Object.fromEntries(ids.map((id,b)=>[id,round(raw[b],2)]));
    const jumped=raw.filter(v=>v>=CHARACTER.fullMinContrast).length;

    // 伸びの長さ: いちばん跳ねた帯の中で、打点の直前の高さを基準に測る
    const dominant=raw.indexOf(Math.max(...raw));
    const sustainMs=(()=>{
      const series=level[dominant];
      const before=series[Math.max(0,frame-6)]||0;     // 48ms前
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

    const pitch=pitchAt(timeMs+24);                     // アタックの直後を見る（雑音を避ける）
    const pitched=pitch.clarity>=PITCH_MIN_CLARITY;

    let character='BODY';
    if(jumped>=CHARACTER.fullMinBands)character='FULL';
    else if(share.low>=CHARACTER.punchLowShare)character='PUNCH';
    else if(share.hi+share.air>=CHARACTER.lightHighShare&&share.low<.2)character='LIGHT';

    const grid=Math.round(gridOfMs(timeMs));
    onsets.push({
      timeMs:round(timeMs,2),
      grid,
      gridOffsetMs:round(timeMs-(timing.beatZeroMs+grid*gridMs),2),
      strength:round(strengthScale[frame]),
      character,
      bandsJumped:jumped,
      contrast:contrastByBand,
      share:Object.fromEntries(ids.map(id=>[id,round(share[id])])),
      sustainMs,
      sustainGrids:round(sustainMs/gridMs,2),
      pitchHz:pitched?round(pitch.hz,1):0,
      pitchClarity:round(pitch.clarity),
    });
  }

  // --- 16分ごとの音の高さ（SLIDEの経路に使う） ---
  const firstGrid=Math.max(0,Math.ceil(gridOfMs(0)));
  const lastGrid=Math.floor(gridOfMs(decoded.durationMs-PITCH_WINDOW/SAMPLE_RATE*1000));
  const semitoneOf=hz=>hz>0?69+12*Math.log2(hz/440):null;
  const pitchCurve=[];
  for(let grid=firstGrid;grid<=lastGrid;grid++){
    const ms=timing.beatZeroMs+grid*gridMs;
    const pitch=pitchAt(ms+16);
    const clear=pitch.clarity>=PITCH_MIN_CLARITY;
    pitchCurve.push({grid,hz:clear?round(pitch.hz,1):0,clarity:round(pitch.clarity),
      semitone:clear?round(semitoneOf(pitch.hz),2):null});
  }
  // オクターブの取り違えを直す。自己相関は倍の周期・半分の周期も山になるので、
  // 「直前までの高さにいちばん近いオクターブ」へ寄せる。これをしないと、
  // 同じメロディなのに高さが0と1を行き来し、SLIDEの経路が暴れる。
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
    // 3点の中央値でならす（1点だけ跳ねる取り違えを消す）
    const values=pitchCurve.map(p=>p.semitone);
    for(let i=0;i<pitchCurve.length;i++){
      if(values[i]==null)continue;
      const window=[values[i-1],values[i],values[i+1]].filter(v=>v!=null).sort((a,b)=>a-b);
      pitchCurve[i].semitone=round(window[window.length>>1],2);
    }
  }

  // 曲の中での高さを0〜1で持つ（SLIDEのレーンへ写すため）
  const semitones=pitchCurve.map(p=>p.semitone).filter(v=>v!=null).sort((a,b)=>a-b);
  const lo=semitones.length?semitones[Math.floor(semitones.length*.05)]:0;
  const hi=semitones.length?semitones[Math.floor(semitones.length*.95)]:1;
  for(const point of pitchCurve){
    point.height=point.semitone==null?null:round(Math.max(0,Math.min(1,(point.semitone-lo)/Math.max(1e-6,hi-lo))));
  }

  // --- 音の高さが続いている区間（HOLDの長さ・SLIDEの範囲に使う） ---
  const sustains=[];
  {
    let run=null;
    const flush=()=>{
      if(run&&run.endGrid-run.startGrid>=2){
        const heights=run.heights;
        sustains.push({startGrid:run.startGrid,endGrid:run.endGrid,
          grids:run.endGrid-run.startGrid,
          fromHeight:heights[0],toHeight:heights[heights.length-1],
          minHeight:Math.min(...heights),maxHeight:Math.max(...heights),
          moves:round(Math.max(...heights)-Math.min(...heights)),
          clarity:round(run.clarity)});
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

  // --- 跳ね（スイング）の検出 ---
  const swing=(()=>{
    const offsets=[];
    for(const onset of onsets){
      const position=((onset.grid%4)+4)%4;
      if(position!==1&&position!==3)continue;
      offsets.push(onset.gridOffsetMs/gridMs);
    }
    if(offsets.length<12)return {ratio:.5,shift:0,confidence:0,samples:offsets.length};
    offsets.sort((a,b)=>a-b);
    const median=offsets[offsets.length>>1];
    return {ratio:round(Math.max(.5,Math.min(.72,.5+median/2))),shift:round(median),
      confidence:round(Math.min(1,offsets.length/60)),samples:offsets.length};
  })();

  const gridFit=(()=>{
    const within=ms=>onsets.filter(o=>Math.abs(o.gridOffsetMs)<=ms).length;
    return {within15ms:round(within(15)/onsets.length),within30ms:round(within(30)/onsets.length),
      within43ms:round(within(43)/onsets.length)};
  })();

  const characterCounts=onsets.reduce((acc,o)=>{acc[o.character]=(acc[o.character]||0)+1;return acc;},{});
  const report={
    schemaVersion:1,
    analysisType:'rhythm-audio-v3',
    trackId,
    audio:config.audio,
    audioSha256,
    decodedVia:decoded.via,
    durationMs:Math.round(decoded.durationMs),
    reviewRequired:true,
    runtimeConnected:false,
    analysis:{sampleRate:SAMPLE_RATE,fftSize:FFT_SIZE,hopSize:HOP_SIZE,frameMs:round(frameMs),
      bands:BANDS,contrastRadiusMs:CONTRAST_RADIUS_MS,minOnsetGapMs:MIN_ONSET_GAP_MS,
      sustainDrop:SUSTAIN_DROP,pitchWindow:PITCH_WINDOW,pitchBandHz:PITCH_BAND_HZ,
      pitchMinClarity:PITCH_MIN_CLARITY,character:CHARACTER},
    timing:{bpm:timing.bpm,beatMs:timing.beatMs,beatZeroMs:timing.beatZeroMs,
      subdivisionsPerBeat:timing.subdivisionsPerBeat,gridMs:round(gridMs)},
    summary:{onsetCount:onsets.length,characterCounts,gridFit,swing,
      pitchedOnsets:onsets.filter(o=>o.pitchHz>0).length,
      pitchCurvePoints:pitchCurve.length,
      pitchCurveClear:pitchCurve.filter(p=>p.height!=null).length,
      sustainSpans:sustains.length},
    onsets,pitchCurve,sustains,
  };

  console.log(`V3音源解析: ${trackId}  (${decoded.via}でデコード / ${SAMPLE_RATE}Hz)`);
  console.log(`  打点 ${onsets.length}件  ${Object.entries(characterCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k} ${v}`).join(' / ')}`);
  console.log(`  16分格子への乗り: ±15ms ${(gridFit.within15ms*100).toFixed(0)}% / ±30ms ${(gridFit.within30ms*100).toFixed(0)}% / ±43ms ${(gridFit.within43ms*100).toFixed(0)}%`);
  console.log(`  跳ね: ${swing.ratio<=.53?'なし（均等）':swing.ratio.toFixed(2)}  ずれ${(swing.shift*100).toFixed(0)}%グリッド`);
  console.log(`  音高が取れた打点 ${report.summary.pitchedOnsets}/${onsets.length}  16分ごとの音高 ${report.summary.pitchCurveClear}/${pitchCurve.length}  高さが続く区間 ${sustains.length}件`);
  const sustainStats=onsets.map(o=>o.sustainMs).sort((a,b)=>a-b);
  if(sustainStats.length)console.log(`  伸びの長さ: 中央値 ${sustainStats[sustainStats.length>>1]}ms / 上位1割 ${sustainStats[Math.floor(sustainStats.length*.9)]}ms / 最長 ${sustainStats[sustainStats.length-1]}ms`);
  if(verbose){
    console.log('  86.5秒〜90秒（サビ）の打点:');
    for(const o of onsets.filter(o=>o.timeMs>=86500&&o.timeMs<90000)){
      console.log(`    ${(o.timeMs/1000).toFixed(2)}s grid${String(o.grid).padStart(4)} ${o.character.padEnd(5)} 強${o.strength.toFixed(2)} 伸${String(o.sustainMs).padStart(4)}ms `
        +`低${o.share.low.toFixed(2)} 中低${o.share.lowMid.toFixed(2)} 中${o.share.mid.toFixed(2)} 高${o.share.hi.toFixed(2)} 空${o.share.air.toFixed(2)}`
        +`  ${o.pitchHz?o.pitchHz.toFixed(0)+'Hz':'—'}`);
    }
  }

  if(write){
    const out=path.join(ROOT,`tools/mode/authoring/${trackId.replace(/_/g,'-')}-v3-audio.json`);
    fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
    console.log(`\n書き出し: ${path.relative(ROOT,out)}`);
  }else{
    console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
  }
})().catch(e=>{console.error(e.stack||e.message);process.exit(1);});
