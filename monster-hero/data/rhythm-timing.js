// 音ゲー譜面制作の固定タイミング基準。
// 実音源解析の結果を人が確認して固定値へ落としたもので、プレイ中に自動再解析しない。
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
      note:'169BPMを制作基準とし、最終の全体オフセットは実機プレイで微調整可能',
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
