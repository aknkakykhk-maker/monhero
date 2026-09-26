#!/usr/bin/env node
// MHB CHART ENGINE Rev.15(旋律の上下に沿って動かす・2026-09-26・最初にもらった案の2)を見張る。
//   ・かたまりの継ぎ目の起点・フレーズの写しの向き・形の向きを旋律の上がり下がりに合わせ、
//     旋律と逆向きの動き(気持ちよさの物差しの againstMelodyRate)が Rev.14 より大きく減る
//   ・押せない配置を作らない・ノーツ数はほぼ変わらない(レーンの向きが変わるだけ)
//   ・Rev.14 以前は旋律の向きを見ない(rev15 の入口で閉じている)
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.15 以上',CHART_REVISION_CODE_LATEST>=15);
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  ok('継ぎ目の費用・写しの向き・形の向きは Rev.15 以降だけ',/const rev15=chartRevision>=15;/.test(source)
    &&/if\(rev15&&againstMelodyMove\(lastPlacedGrid,lastLane,grids\[0\],lanes\[0\]\)\)cost\+=MELODY_DIRECTION_COST;/.test(source)
    &&/if\(rev15\)\{\s*const againstCount=/.test(source)
    &&/const flip=rev15&&againstInside\(mirror\(chosen\.offsets\)\)<againstInside\(chosen\.offsets\);/.test(source));
}

const tracks=[['monster_hero_theme','monster-hero-theme'],['dullahan','dullahan']];
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev15-'));
try{
  const total={14:{moves:0,against:0,notes:0,impossible:0},15:{moves:0,against:0,notes:0,impossible:0}};
  let status=true;
  for(const [trackId,dashed] of tracks){
    const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
    for(const revision of [14,15]){
      const dir=path.join(tmp,`${trackId}-r${revision}`);fs.mkdirSync(dir);
      const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],
        {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      if(result.status!==0){status=false;continue;}
      for(const d of ['easy','normal','hard','expert','master']){
        const chart=JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'));
        const feel=measureFeel(chart,audio,{withQuality:false});
        const moves=feel.readability.melodyMoves||0;
        total[revision].moves+=moves;total[revision].against+=Math.round((feel.readability.againstMelodyRate||0)*moves);
        total[revision].notes+=chart.notes.length;total[revision].impossible+=feel.impossible;
      }
    }
  }
  ok('Rev.14・Rev.15 とも作れる',status);
  const rate=r=>r.moves?r.against/r.moves:0;
  ok('旋律と逆向きの動きが Rev.14 の半分以下になる',total[15].moves>0&&rate(total[15])<=rate(total[14])*.5,
    `Rev.14 ${total[14].against}/${total[14].moves}(${Math.round(rate(total[14])*100)}%) → Rev.15 ${total[15].against}/${total[15].moves}(${Math.round(rate(total[15])*100)}%)`);
  ok('押せない配置を作らない(生成直後・両手のシミュレート)',total[15].impossible===0,`${total[15].impossible}件`);
  ok('ノーツ数はほぼ変わらない(1%以内)',Math.abs(total[15].notes-total[14].notes)<=total[14].notes*.01,`${total[14].notes} → ${total[15].notes}`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.15(旋律の上下に沿って動かす)は期待どおり');
process.exit(failed?1:0);
