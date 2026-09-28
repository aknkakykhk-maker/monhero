// 道の遠近(投影)の計算を、本体(monster-hero/data/rhythm-mode.js)から丸ごと切り出して返す(検査が使う部品・2026-09-27)。
//
//   const {rhythmProjectionSource}=require('./rhythm-projection-source.js');
//   const src=rhythmProjectionSource(rhythmModeText);   // RHYTHM_LANE_COUNT ～ rhythmProjectBoundary までを定義するコード
//
// 【なぜ要るか】
// 検査が1本ずつ「RHYTHM_PROJECTION_TOP_SCALE」「rhythmProjectionScale」…と名前で切り出していたので、
// 計算を分けたり値を足したりするたびに(2026-09-25 の曲線・2026-09-27 の横向きの道の幅)4本が同時に壊れた。
// ここでは始まり(RHYTHM_PROJECTION_TOP_SCALE)から rhythmProjectBoundary の終わりまでを1かたまりで取るので、
// 間に定数や関数が増えても自動で含まれる。
// ★間にある rhythmClamp01 も含む。検査の側で同じ名前を定義しないこと
const rhythmProjectionSource=(src,{laneCount=true}={})=>{
  const text=String(src||'');
  const from=text.indexOf('const RHYTHM_PROJECTION_TOP_SCALE=');
  const last=text.indexOf('const rhythmProjectBoundary=',from);
  const end=last<0?-1:text.indexOf('\n};',last);
  if(from<0||last<0||end<0)throw new Error('道の遠近の計算(RHYTHM_PROJECTION_TOP_SCALE ～ rhythmProjectBoundary)が見つかりません');
  const lanes=laneCount?((text.match(/const RHYTHM_LANE_COUNT\s*=[^\n]*/)||[''])[0]):'';
  return `${lanes}\n${text.slice(from,end+3)}`;
};
module.exports={rhythmProjectionSource};
