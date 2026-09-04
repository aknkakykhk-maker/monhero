#!/usr/bin/env node
// 音源解析の「あやしさ」を、機械が読める形の警告にまとめる。
//
// 【なぜ要るか】
// 曲はこれからも増える。そのとき最悪なのは「判定を外したまま、何も言わずに譜面が出来る」こと。
// テンポを取り違えた譜面は、遊んだ人には**ゲームが壊れている**ようにしか見えない。
// そこで、解析の段で疑わしい点を必ず書き出し、パイプラインは重い警告があれば
// ランタイムへの反映（--release）を止める。人が確かめた値を使っているときは軽い注意へ下げる。
//
// severity:
//   'critical' … このまま譜面にすると音とずれる恐れが高い。--release を止める
//   'notice'   … 気に留めておく程度。止めない
'use strict';

const THRESHOLD=Object.freeze({
  // 2位のテンポ候補と点が拮抗しているか。実曲30曲で測ると、正しく当たっている曲でも
  // 0〜0.75 と幅があり（倍・半分の候補は本質的に近い点になる）、ここで止めると
  // ほとんどの曲が通らなくなる。**軽い注意**にとどめ、止める材料にはしない。
  tempoConfidence:.12,
  gridFit:.62,             // 打点が16分格子に乗っていない
  beatPresence:.45,        // 拍のところに音が無い（速すぎるテンポで取っている疑い）
  onsetsPerSecond:.9,      // 打点が少なすぎて譜面が作れない
  shortAudioMs:25000,
  longSongSections:2,
  longSongMs:90000,
});

const collectWarnings=({timing,detected,durationMs,onsetCount,sectionCount})=>{
  const warnings=[];
  const trusted=timing&&timing.source&&timing.source!=='detected';
  const add=(code,severity,message,detail)=>{
    // 人が耳で確かめた値（登録値・確認済み・コマンド指定）を使っているときは、
    // 自動判定のあやしさで止めない。止めるべきなのは「自動判定だけで押し切る」場合。
    const level=trusted&&severity==='critical'&&code!=='few-onsets'?'notice':severity;
    warnings.push({code,severity:level,message:trusted&&level!==severity?`${message}（人が決めた値を使うので止めません）`:message,
      ...(detail?{detail}:{})});
  };
  if(!detected){
    add('timing-undetected','critical','音からテンポを判定できませんでした');
  }else{
    const stability=detected.stability;
    if(stability&&stability.changeSuspected){
      add('tempo-unstable','critical','曲の途中でテンポが変わっている（またはずれていく）ようです',
        {bpmSpread:stability.bpmSpread,shiftedShare:stability.shiftedShare,
         badWindowShare:stability.badWindowShare,overallFit:stability.overallFit});
    }
    const tempoConfidence=detected.confidence?.tempo??1;
    if(tempoConfidence<THRESHOLD.tempoConfidence){
      add('tempo-ambiguous','notice','ほかのテンポ候補と点が拮抗しています',
        {confidence:tempoConfidence,candidates:detected.tempoCandidates});
    }
    if((detected.gridFit??1)<THRESHOLD.gridFit){
      add('grid-loose','critical','打点が16分の格子に乗っていません',{gridFit:detected.gridFit});
    }
    if((detected.beatPresence??1)<THRESHOLD.beatPresence){
      add('beat-weak','notice','拍のところに音が無い拍が多いです',{beatPresence:detected.beatPresence});
    }
  }
  const seconds=Math.max(1,(durationMs||0)/1000);
  if(onsetCount/seconds<THRESHOLD.onsetsPerSecond){
    add('few-onsets','critical','打点が少なすぎて譜面を作れません',
      {onsetsPerSecond:Math.round(onsetCount/seconds*100)/100});
  }
  if((durationMs||0)<THRESHOLD.shortAudioMs){
    add('short-audio','notice','曲が短いので、難易度の差が付きにくいです',{durationMs});
  }
  if((durationMs||0)>=THRESHOLD.longSongMs&&(sectionCount||0)<THRESHOLD.longSongSections){
    add('structure-flat','notice','曲の区切りを見つけられませんでした（ずっと同じ密度になります）',{sectionCount});
  }
  return warnings;
};

const criticalWarnings=warnings=>(warnings||[]).filter(warning=>warning.severity==='critical');
const formatWarnings=warnings=>(warnings||[]).map(warning=>
  `${warning.severity==='critical'?'✗':'・'} [${warning.code}] ${warning.message}`);

module.exports={THRESHOLD,collectWarnings,criticalWarnings,formatWarnings};
