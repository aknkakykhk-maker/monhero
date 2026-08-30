// DEBUG/AUTHORING: 音ゲー譜面制作で使う固定タイミング基準。
// 実音源解析から得た値を制作基準として保存し、プレイ中に自動再解析しない。
// beatZeroMs は解析由来の初期値であり、iPhone実機の体感確認後に全体オフセットだけ微調整できる。
const RHYTHM_TIMING_DATA = Object.freeze({
  atsu_cup_theme:Object.freeze({
    trackId:'atsu_cup_theme',
    audioDurationMs:144640,
    bpm:169,
    beatMs:60000/169,
    beatZeroMs:40,
    subdivisionsPerBeat:4,
    analysis:Object.freeze({
      method:'onset-autocorrelation-200hz',
      detectedBpm:169.014,
      detectedBeatMs:355,
      detectedBeatOffsetMs:40,
      crossCheckBpm:169.01,
      deviceTimingVerified:false,
      note:'169 BPMを譜面制作基準とし、全体オフセットは実機プレイ確認後に必要なら微調整する',
    }),
  }),
});

const rhythmTimingAt=(trackId,beatIndex,subdivisionIndex=0,subdivisions=null)=>{
  const timing=RHYTHM_TIMING_DATA[trackId];
  if(!timing)return null;
  const div=Math.max(1,Number(subdivisions)||timing.subdivisionsPerBeat||1);
  const beat=Number(beatIndex)||0;
  const sub=Number(subdivisionIndex)||0;
  return timing.beatZeroMs+(beat+sub/div)*timing.beatMs;
};

const rhythmSnapTimeToGrid=(trackId,timeMs,subdivisions=null)=>{
  const timing=RHYTHM_TIMING_DATA[trackId];
  if(!timing)return null;
  const div=Math.max(1,Number(subdivisions)||timing.subdivisionsPerBeat||1);
  const stepMs=timing.beatMs/div;
  const source=Number(timeMs);
  if(!Number.isFinite(source))return null;
  const gridIndex=Math.round((source-timing.beatZeroMs)/stepMs);
  const snappedMs=timing.beatZeroMs+gridIndex*stepMs;
  return Object.freeze({
    timeMs:snappedMs,
    gridIndex,
    beatIndex:Math.floor(gridIndex/div),
    subdivisionIndex:((gridIndex%div)+div)%div,
    subdivisions:div,
    deltaMs:source-snappedMs,
  });
};
