#!/usr/bin/env node
// 「複数候補を作って自動で批評する」段(rhythm-chart-v3-candidates.js)が
// ちゃんと働いているかを確かめる。
//
//   node tools/mode/rhythm-chart-v3-candidates-check.js
//
// 【なぜ要るか】(2026-09-12)
// V2にあった STEP5 をV3へ移したもの。ここでいちばん怖いのは次の2つ。
//   ・候補ちがい(--variant)が既定(0)の出力を変えてしまうこと → 既存曲の譜面が変わる(運用ルール ⑩-2)
//   ・候補がどれも同じ点数で、選ぶ意味が無くなっていること
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const generate=(variant,dir)=>{
  fs.mkdirSync(dir,{recursive:true});
  const run=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--variant',String(variant),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  return run.status===0;
};
const chartsOf=dir=>fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort();

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v3-cand-check-'));
try{
  // ── ① variant 0 は「指定しないとき」と1バイトも変わらない ──────────────────
  const plain=path.join(tmp,'plain'),zero=path.join(tmp,'zero');
  fs.mkdirSync(plain,{recursive:true});
  const plainRun=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--write','--output-dir',plain],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  ok('候補を指定せずに生成できる',plainRun.status===0);
  ok('variant 0 で生成できる',generate(0,zero));
  const files=chartsOf(plain);
  ok('難易度ぶんの譜面が出る',files.length>=5,`${files.length}件`);
  const same=files.every(file=>
    fs.readFileSync(path.join(plain,file),'utf8')===fs.readFileSync(path.join(zero,file),'utf8'));
  // ★ここが最重要。既定の出荷は variant 0 なので、ここが崩れると既存曲の譜面が変わる
  ok('variant 0 は指定なしと完全に同じ(既存曲の譜面を変えない)',same,
    same?`${files.length}件すべて一致`:'差がある');

  // ── ② 候補ちがいは、ちゃんと別の譜面になる ────────────────────────────────
  const one=path.join(tmp,'one');
  ok('variant 1 で生成できる',generate(1,one));
  const laneSeq=dir=>{
    const chart=JSON.parse(fs.readFileSync(path.join(dir,'monster-hero-theme-v3-chart-master.json'),'utf8'));
    return (chart.notes||[]).map(note=>note.subLane!==undefined?note.subLane:note.lane);
  };
  const a=laneSeq(zero),b=laneSeq(one);
  const differing=a.filter((value,index)=>value!==b[index]).length;
  ok('候補ちがいで譜面が実際に変わる',differing>=a.length*.1,
    `${differing}/${a.length}ノーツが違う`);
  ok('ノーツの数は変わらない(音源で決まるので)',a.length===b.length,`${a.length} と ${b.length}`);

  // ── ③ 採点して順位が付く ──────────────────────────────────────────────────
  const judged=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-candidates.js'),
    '--count','6'],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  ok('候補を作って採点できる',judged.status===0,(judged.stderr||'').split('\n')[0]);
  const out=judged.stdout||'';
  const totals=[...out.matchAll(/^\s+[★ ]\s*v(\d+)\s+(\d+\.\d)/gm)].map(m=>({v:Number(m[1]),total:Number(m[2])}));
  ok('候補ぜんぶの点数が出る',totals.length>=6,`${totals.length}件`);
  if(totals.length>=2){
    const spread=Math.max(...totals.map(t=>t.total))-Math.min(...totals.map(t=>t.total));
    // ★候補がどれも同じ点数だと、選ぶ意味が無い。
    //   種だけを変えていたときは差が0.2点しか出なかったので、好み(prefer)も変えている
    ok('候補どうしに点数の差が付く(選ぶ意味がある)',spread>=1,`いちばん上と下で ${spread.toFixed(1)}点`);
  }
  ok('勝った候補が1つ決まる',/勝った候補: v\d+/.test(out),
    (out.match(/勝った候補: v\d+（合計 [\d.]+）/)||[])[0]||'');
  ok('押せない箇所がある候補は失格にする',/失格（押せない箇所あり）|押せない\s*$/m.test(out)||!/\d+件/.test(out),
    (out.match(/失格（押せない箇所あり）: .*/)||['失格は今回なし'])[0]);
  ok('ランタイムへ勝手に反映しない',
    out.includes('ランタイムへは反映しません')&&!out.includes('rhythm-mode.js へ書き'));
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
