#!/usr/bin/env node
// 譜面の量の上限(DENSITY_TARGET.hardMaxPerSecond)が、
// **品質レポートの帯とずれていないこと**と**歯ごたえで持ち上がらないこと**を確かめる。
//
//   node tools/mode/rhythm-density-ceiling-check.js
//
// 【なぜ要るか】(2026-09-12)
// maxPerSecond は歯ごたえ(challenge.factor・最大1.9倍)を掛けるので、速い曲では
// 上限として働かない。実測で SIX ÉTERNEL(BPM207)のEXPERTが毎秒4.56になり、
// EXPERTの maxPerSecond(4.0)を超えて MASTER の4.6に迫っていた。
//
// そこで「曲によらない上限」を足した。置いた線は
// **品質レポート(rhythm-chart-quality-report.js)が減点を始めるところ** ——
// BANDS.density の上端 ＋ inBand の許容(slack 0.6)。
//
// ★ここを帯の真ん中へ絞ってはいけない。ユーザー指示「どの曲も難易度が似たりよったり /
//   もっと振れ幅がほしい」(2026-09-06)で曲どうしの差をわざと強めているので、
//   上限を下げるとその差をまた潰す。これは「帯から出るほど詰まった譜面が
//   出たときだけ効く安全柵」であって、いまの曲を薄くするためのものではない。
//   だから **いまの曲が1曲も変わらないこと** も検査する。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {BANDS}=require('./rhythm-chart-quality-report.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// inBand の許容。レポート側の difficultyFit が密度に使っている値と同じでなければ意味が無い。
const SLACK=.6;
const source=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'utf8');
const reportSource=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-quality-report.js'),'utf8');

// ── ① レポート側の許容が 0.6 のままか ────────────────────────────────────────
ok('レポートが密度に使っている許容が 0.6 のまま',
  /inBand\(density,band\.density,\.6\)/.test(reportSource),
  '変わっていたら、下の上限の値も一緒に直す');

// ── ② 上限の値が帯＋許容と1対1で合っているか ────────────────────────────────
const targets={};
for(const match of source.matchAll(/^\s{2}(EASY|NORMAL|HARD|EXPERT|MASTER):\s*Object\.freeze\(\{perBeat:([\d.]+),minPerSecond:([\d.]+),maxPerSecond:([\d.]+),hardMaxPerSecond:([\d.]+)\}\),/gm)){
  targets[match[1]]={perBeat:Number(match[2]),min:Number(match[3]),max:Number(match[4]),hard:Number(match[5])};
}
ok('5段すべてに上限(hardMaxPerSecond)がある',Object.keys(targets).length===5,
  Object.keys(targets).join(' / ')||'読み取れなかった');
const mismatched=[];
for(const [difficulty,target] of Object.entries(targets)){
  const want=Math.round((BANDS[difficulty].density[1]+SLACK)*10)/10;
  if(Math.abs(target.hard-want)>1e-9)mismatched.push(`${difficulty} ${target.hard}（帯${BANDS[difficulty].density[1]}＋${SLACK}=${want}）`);
}
ok('上限が「帯の上端＋許容」と一致している',mismatched.length===0,
  mismatched.join(' / ')||Object.entries(targets).map(([d,t])=>`${d} ${t.hard}`).join(' / '));
// 上限は maxPerSecond より上（そうでないと maxPerSecond が死んで曲の差が消える）
const tooLow=Object.entries(targets).filter(([,t])=>t.hard<=t.max);
ok('上限は maxPerSecond より上にある(曲どうしの差を潰さない)',tooLow.length===0,
  tooLow.map(([d,t])=>`${d} ${t.hard}<=${t.max}`).join(' / ')||'5段すべて');

// ── ③ 上限に歯ごたえを掛けていないか ────────────────────────────────────────
// 掛けてしまうと上限にならない（これが元の不具合）。
ok('上限に歯ごたえ(challenge.factor)を掛けていない',
  !/hardMaxPerSecond\s*\*/.test(source),'掛けると上限として働かない');
// 2026-09-13 に曲ごとの「激しさ」(INTENSITY_STYLES)を足したので、Math.min に入るのは
// hardMaxPerSecond そのものではなく ceiling という変数になった。
// ceiling は「激しさに ceiling を書いた難易度」だけその値を使い、**それ以外は
// target.hardMaxPerSecond のまま**なので、安全柵としての働きは変わっていない。
// 見るのは2つ ── ceiling の作り方と、それが Math.min に入っていること。
ok('上限が実際に Math.min へ入っている',
  /Math\.min\(\s*(?:target\.hardMaxPerSecond|ceiling),/.test(source));
ok('激しさを書いていない難易度では、上限が hardMaxPerSecond のままである',
  /const ceiling=Number\(I\.ceiling\)>0\s*\n?\s*\?Math\.max\(target\.hardMaxPerSecond,Number\(I\.ceiling\)\)\s*\n?\s*:target\.hardMaxPerSecond;/.test(source)
  ||/Math\.min\(\s*target\.hardMaxPerSecond,/.test(source),
  '書いていない曲では ceiling === target.hardMaxPerSecond になること');

// ── ④ いまの曲が1曲も変わらないこと ────────────────────────────────────────
// 柵を外した版と入れた版で生成して、譜面が1バイトも変わらないことを見る。
// 変わったら「安全柵」ではなく「いまの難易度を動かす変更」なので、
// 運用ルール⑥-3（難易度はユーザーへ聞く）に触れる。
const TRACKS=['six_eternel_beat','monster_hero_theme','dullahan'];   // 実測でいちばん濃い3曲
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'density-ceiling-'));
try{
  const loose=path.join(tmp,'tools','mode');
  fs.mkdirSync(loose,{recursive:true});
  // 柵を無限へ緩めた生成器を一時的に作る（同じディレクトリに置かないと require が解けない）
  const patched=path.join(ROOT,'tools/mode/.density-ceiling-off.js');
  // 2026-09-13: 天井が ceiling という変数になったので、どちらの書き方でも外せるようにする。
  // ここが空振りすると「柵を外した版」が作れず、下の比較が**必ず一致してしまう**。
  const loosened=source.replace(/Math\.min\(\s*(?:target\.hardMaxPerSecond|ceiling),/,'Math.min(Infinity,');
  if(loosened===source){
    ok('柵を外した版が作れている(検査が空振りしていない)',false,
      '生成器の Math.min(...) の書き方が変わったので、この置換を直すこと');
  }
  fs.writeFileSync(patched,loosened);
  let changed=[];
  for(const track of TRACKS){
    const dashed=track.replace(/_/g,'-');
    const on=path.join(tmp,'on',track),off=path.join(tmp,'off',track);
    fs.mkdirSync(on,{recursive:true});fs.mkdirSync(off,{recursive:true});
    for(const [tool,dir] of [['rhythm-chart-v3-generate.js',on],['.density-ceiling-off.js',off]]){
      spawnSync('node',[path.join(ROOT,'tools/mode',tool),'--track',track,'--write','--output-dir',dir],
        {cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
    }
    for(const difficulty of ['easy','normal','hard','expert','master']){
      const file=`${dashed}-v3-chart-${difficulty}.json`;
      const a=path.join(on,file),b=path.join(off,file);
      if(!fs.existsSync(a)||!fs.existsSync(b))continue;
      const A=JSON.parse(fs.readFileSync(a,'utf8')),B=JSON.parse(fs.readFileSync(b,'utf8'));
      if(JSON.stringify(A.notes)!==JSON.stringify(B.notes))
        changed.push(`${track} ${difficulty}（${B.noteCount}→${A.noteCount}ノーツ）`);
    }
  }
  fs.rmSync(patched,{force:true});
  // ★これが本題。柵を入れても、いまの曲の譜面は1つも変わらない
  ok('いまの曲は柵に当たらない(難易度が動かない)',changed.length===0,
    changed.join(' / ')||`${TRACKS.length}曲 × 5段すべて一致`);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
  fs.rmSync(path.join(ROOT,'tools/mode/.density-ceiling-off.js'),{force:true});
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
