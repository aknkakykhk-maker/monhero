// 打点ごとの「音の性格」を、V3音源解析(<曲>-v3-audio.json)だけから決める共通部品。
//
// 【なぜ要るか】(2026-09-26・ユーザー指摘「ただ適当にフリックとかを置くじゃなくて、
//   譜面にあわせてあった配置やノーツの種類があるとおもう」)
// それまでの生成器は、フリック・同時押しを「1分あたり何本」と先に数を決め、置ける所へ均等に散らしていた。
// 本物の譜面は、音が切れる所・シンバルが鳴る所・歌の語尾のように、**音の性格から種類が決まる**。
// ここではその性格を、解析ファイルにすでにある項目(帯域ごとの跳ね・音の伸び・音の高さ)から出す。
// **解析をやり直さない**(運用ルール ⑩-2。既存の解析ファイルは作り直さない)。
//
// 生成器(版6)と、測る道具(rhythm-note-type-fit.js)が同じ物差しを使う。片方だけ直すと、
// 「直したつもりで別の物差しになる」ので、線はここにだけ書く。
//
//   crash     … シンバルのような広い帯域の一斉(4帯域以上が跳ね、高音の割合が高い)
//   accent    … 大きな一発(FULL)で、その曲の中で上位の強さ
//   release   … 音が伸びず、次の目立つ音まで間があく(音が「切れる」)
//   phraseEnd … 音程のある音(歌・旋律)の語尾(次の音程のある音まで間があく)
//   pitchMove … 前の音程のある音からの高さの動き(+1 上がる / -1 下がる / 0 動かない・分からない)
'use strict';

// 線(実測: 公開中の曲の打点 約3.2万個の分布から決めた。2026-09-26)
//   高音(hi+air)の割合  … 中央 0.09 / 上位25% 0.26 / 上位10% 0.49
//   跳ねた帯の数        … 1〜2 が7割、4以上が16%
//   次の目立つ音まで    … 中央 0.33拍 / 上位10% 0.72拍
const TRAIT_LINES=Object.freeze({
  crashBands:4,          // 跳ねた帯の数がこれ以上
  crashHighShare:.35,    // 高音(hi+air)の割合がこれ以上
  accentQuantile:.75,    // FULLのうち、その曲の強さの上位25%
  releaseGapBeats:.75,   // 次の目立つ音まで、これ以上あく
  releaseSustainBeats:.5,// 音の伸びがこれ未満
  phraseGapBeats:1,      // 次の音程のある音まで、これ以上あく
  audibleStrength:.15,   // 「目立つ音」とみなす強さ
  pitchMoveSemitones:1,  // 音程の動きを「動いた」とみなす半音
});

const hzToSemitone=hz=>hz>0?12*Math.log2(hz/440)+69:null;

// 解析1つから、グリッド → 性格 の表を作る。同じグリッドに打点が複数あるときは強いほうを代表にする。
const soundTraitsFor=(audio,lines=TRAIT_LINES)=>{
  const beatMs=Number(audio.timing&&audio.timing.beatMs)||500;
  const onsets=(Array.isArray(audio.onsets)?audio.onsets:[]).slice().sort((a,b)=>a.timeMs-b.timeMs);
  const fullStrengths=onsets.filter(o=>o.character==='FULL').map(o=>o.strength).sort((a,b)=>a-b);
  const accentFloor=fullStrengths.length?fullStrengths[Math.floor(fullStrengths.length*lines.accentQuantile)]:Infinity;
  const pitched=onsets.filter(o=>o.pitchHz>0);
  const pitchedIndex=new Map(pitched.map((o,i)=>[o,i]));
  const byGrid=new Map();
  onsets.forEach((onset,index)=>{
    let gapMs=Infinity;
    for(let k=index+1;k<onsets.length;k++){
      if(onsets[k].strength>=lines.audibleStrength&&onsets[k].timeMs>onset.timeMs){gapMs=onsets[k].timeMs-onset.timeMs;break;}
    }
    const high=(Number(onset.share&&onset.share.hi)||0)+(Number(onset.share&&onset.share.air)||0);
    const crash=(Number(onset.bandsJumped)||0)>=lines.crashBands&&high>=lines.crashHighShare;
    const accent=onset.character==='FULL'&&onset.strength>=accentFloor;
    const release=gapMs>=beatMs*lines.releaseGapBeats&&(Number(onset.sustainMs)||0)<beatMs*lines.releaseSustainBeats;
    let phraseEnd=false,pitchMove=0;
    if(onset.pitchHz>0){
      const at=pitchedIndex.get(onset);
      const nextPitched=pitched[at+1],prevPitched=pitched[at-1];
      phraseEnd=!nextPitched||nextPitched.timeMs-onset.timeMs>=beatMs*lines.phraseGapBeats;
      if(prevPitched&&onset.timeMs-prevPitched.timeMs<beatMs*2){
        const delta=hzToSemitone(onset.pitchHz)-hzToSemitone(prevPitched.pitchHz);
        pitchMove=delta>=lines.pitchMoveSemitones?1:delta<=-lines.pitchMoveSemitones?-1:0;
      }
    }
    const traits={crash,accent,release,phraseEnd,pitchMove,strength:onset.strength,character:onset.character,gapBeats:gapMs/beatMs};
    const before=byGrid.get(onset.grid);
    if(!before||onset.strength>before.strength)byGrid.set(onset.grid,traits);
  });
  return byGrid;
};

// フリックに向く音か(切れる・語尾・シンバル)。点数は大きいほど向く(0なら向かない)
const flickScoreOf=traits=>{
  if(!traits)return 0;
  let score=0;
  if(traits.release)score+=1;
  if(traits.phraseEnd)score+=.8;
  if(traits.crash)score+=.7;
  if(traits.accent)score+=.4;
  if(traits.character==='LIGHT')score*=.3;
  return score;
};
// 同時押しに向く音か(シンバル・大きな一発)
const chordScoreOf=traits=>{
  if(!traits)return 0;
  let score=0;
  if(traits.crash)score+=1;
  if(traits.accent)score+=.8;
  if(traits.character==='FULL')score+=.3;
  return score;
};

module.exports={TRAIT_LINES,soundTraitsFor,flickScoreOf,chordScoreOf};
