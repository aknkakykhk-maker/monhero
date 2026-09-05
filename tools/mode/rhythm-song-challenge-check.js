#!/usr/bin/env node
// 曲ごとに難しさの差が付いているかを見張る。
//
//   node tools/mode/rhythm-song-challenge-check.js
//
// 【なぜ要るか】
// 譜面の量は長く「1拍あたり何個」だけで決めていた。曲によって違うのはテンポだけなので、
// **どの曲もほとんど同じ量**になり、先行公開の5曲は EASY が全部Lv.8、HARD 15〜16、
// EXPERT 22〜23 と団子になった（2026-09-05・ユーザー指摘「5曲ともレベルが似たりよったり」）。
//
// いまは曲の性格（テンポ・音の詰まり具合・拍のはっきりさ）から歯ごたえを出して量に掛けている。
// この検査は「その差が実際にゲームへ出ているか」を見る。生成器の係数を弱めたり、
// 密度の決め方を戻したりすると、ここが落ちて気づける。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// --- ランタイムに載っている先行公開の曲のレベルを読む ---
const ctx={console,Object,Number,Math,Array,JSON,String,Boolean,isNaN,parseInt,parseFloat};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')
  +'\nthis.out={songs:RHYTHM_SONGS.filter(s=>RHYTHM_DEMO_SONG_IDS.includes(s.songId))'
  +'.map(s=>({id:s.songId,name:s.displayName,levels:Object.fromEntries('
  +'Object.entries(s.difficulties).map(([k,v])=>[k,Number(v.level)]))})),'
  +'difficulties:RHYTHM_DEMO_DIFFICULTY_IDS};',ctx);
const {songs,difficulties}=ctx.out;
// 曲数は固定で書かない(曲を足すたびにここが落ちるだけで、何も守れない)。
// 見たいのは「複数の曲を並べて散らばりを測れること」なので、下限だけを置く。
ok('先行公開の曲が複数そろっている',songs.length>=5,`${songs.length}曲`);

// 難易度ごとの散らばり。EASYは元の数字が小さいので、求める幅も小さくしてある。
// 「全部同じ」を防ぐのが目的なので、ここは**下限**だけを見る（上限は付けない）。
const MIN_SPREAD={EASY:2,NORMAL:3,HARD:3,EXPERT:4,MASTER:5};
for(const difficulty of difficulties){
  const levels=songs.map(song=>song.levels[difficulty]).filter(Number.isFinite);
  if(levels.length<songs.length){ok(`${difficulty}のレベルが全曲ぶんそろっている`,false,`${levels.length}/${songs.length}曲`);continue;}
  const spread=Math.max(...levels)-Math.min(...levels);
  ok(`${difficulty}は曲ごとに難しさが違う（差${MIN_SPREAD[difficulty]}以上）`,
    spread>=MIN_SPREAD[difficulty],
    `Lv.${Math.min(...levels)}〜${Math.max(...levels)}（差${spread}） / ${levels.join(',')}`);
}

// 曲の中では難易度の順が守られていること。歯ごたえは曲まるごとに掛かるので、
// ここが崩れるとしたら掛け方そのものが壊れている。
for(const song of songs){
  const levels=difficulties.map(id=>song.levels[id]);
  const rising=levels.every((level,index)=>index===0||!(level<levels[index-1]));
  ok(`${song.name} は難易度が上がるほど数字も上がる`,rising,levels.join(' → '));
}

// --- 生成器の歯ごたえ係数そのものを見る ---
// レベルは譜面から測った結果なので、係数が効いていなくても
// たまたま散らばることがある。もとの係数が曲ごとに違うことも直接確かめる。
const generator=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'utf8');
ok('生成器が曲ごとの歯ごたえを量に掛けている',
  generator.includes('songChallengeFactor')
  &&/target\.perBeat\*beatsPerSecond\*challenge\.factor/.test(generator));
ok('下限（間延びしない最低量）は歯ごたえで下げない',
  /Math\.max\(target\.minPerSecond,/.test(generator)
  &&!/Math\.max\(target\.minPerSecond\*challenge/.test(generator));

const REFERENCE=/CHALLENGE_REFERENCE=Object\.freeze\(\{bpm:([\d.]+),onsetsPerSecond:([\d.]+),beatClarity:([\d.]+)\}\)/.exec(generator);
const EXPONENT=/CHALLENGE_EXPONENT=Object\.freeze\(\{bpm:([\d.]+),onsets:([\d.]+),beatClarity:([\d.]+)\}\)/.exec(generator);
const RANGE=/CHALLENGE_RANGE=Object\.freeze\(\{min:([\d.]+),max:([\d.]+)\}\)/.exec(generator);
ok('歯ごたえの基準・効き・上下の挟みが生成器に書いてある',!!(REFERENCE&&EXPONENT&&RANGE));
if(REFERENCE&&EXPONENT&&RANGE){
  const ref={bpm:+REFERENCE[1],ops:+REFERENCE[2],clarity:+REFERENCE[3]};
  const exp={bpm:+EXPONENT[1],ops:+EXPONENT[2],clarity:+EXPONENT[3]};
  const range={min:+RANGE[1],max:+RANGE[2]};
  // 曲id → 解析JSONの名前。ランタイムの曲idから引く。
  const AUDIO={mf_ichika_mix:'atsu-cup-theme',monster_hero:'monster-hero-theme',
    six_eternel_remix:'six-eternel-remix-beat',stay_with_me:'pandora-boss',kiki_issen:'eiki-boss',
    kaze_ga_soyogu:'kaze-ga-soyogu'};
  const factors=[];
  for(const song of songs){
    const file=path.join(ROOT,`tools/mode/authoring/${AUDIO[song.id]}-v3-audio.json`);
    if(!AUDIO[song.id]||!fs.existsSync(file)){ok(`${song.name} の音源解析がある`,false,song.id);continue;}
    const audio=JSON.parse(fs.readFileSync(file,'utf8'));
    const seconds=Number(audio.durationMs)/1000;
    const raw=Math.pow(Number(audio.timing.bpm)/ref.bpm,exp.bpm)
      *Math.pow((Number(audio.summary.onsetCount)/seconds)/ref.ops,exp.ops)
      *Math.pow(Number(audio.summary.beatClarity.ratio)/ref.clarity,exp.clarity);
    factors.push({name:song.name,factor:Math.max(range.min,Math.min(range.max,raw))});
  }
  const values=factors.map(entry=>+entry.factor.toFixed(3));
  ok('歯ごたえは曲ごとに違う値になる',new Set(values).size===values.length,
    factors.map(entry=>`${entry.name} ${entry.factor.toFixed(2)}`).join(' / '));
  // 挟みに全部張り付くと差が消える。実際に効いている（＝中に収まっている）ことを見る。
  const inside=factors.filter(entry=>entry.factor>range.min+1e-9&&entry.factor<range.max-1e-9);
  ok('挟み込み（上下の頭打ち）で差が潰れていない',inside.length>=4,
    `${inside.length}曲が ${range.min}〜${range.max} の内側`);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
