#!/usr/bin/env node
// MHB CHART ENGINE Rev.8(手の動きと繰り返しを揃える・2026-09-26)を見張る。
//   ・作り方の最新と学び直しの番号がぶつからない(学び直しは「最新＋1」を書く)
//   ・手のモデルの SLIDE の読み方は既定が今までどおりで、切り替えたときだけゲーム本体と同じ座標になる
//   ・6レーンの中央を 2 と直書きしていない(CENTER_LANE を使う)
//   ・実際に Rev.7 と Rev.8 で作り、Rev.8 だけ横フリックの向きが払う指の動きと合い、自動修正のあとも合っている
//   ・Rev.7 で作った譜面は、公開していた Rev.7 の作者用の譜面と1バイトも変わらない(sha256 で比べる)
// 設計: docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の段1
'use strict';
const crypto=require('crypto'),fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST,CHART_REVISION_LATEST}=require('./rhythm-chart-v3-revision.js');
const {learn}=require('./rhythm-chart-learn.js');
const handModel=require('./rhythm-hand-model.js');
const {sideFlickContexts,chooseSideFlickDir,collides}=require('./rhythm-side-flick.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 1. リビジョンの番号 ──
ok('作り方の最新は Rev.8 以上',CHART_REVISION_CODE_LATEST>=8&&CHART_REVISION_LATEST>=CHART_REVISION_CODE_LATEST);
{
  const result=learn();
  ok('学び直しは最新リビジョンの次の番号を書く(作り方の改良と同じ番号にしない)',
    result.baseRevision===CHART_REVISION_LATEST&&result.nextRevision===CHART_REVISION_LATEST+1,`元 ${result.baseRevision} → 次 ${result.nextRevision}`);
}

// ── 2. 手のモデルの SLIDE の読み方 ──
{
  const slide={type:'SLIDE',grid:0,lane:2,subLaneWidth:2,durationGrids:8,slidePoints:[{grid:0,lane:2,subLaneWidth:2},{grid:8,lane:4,subLaneWidth:2}]};
  const center=()=>{const [lo,hi]=handModel.noteTouchSpan(slide);return (lo+hi)/2;};
  ok('既定は今までの読み方(値そのものが中心)',handModel.slideLaneOffset()===0&&center()===2&&handModel.slideLaneAtGrid(slide,4)===3);
  handModel.useRuntimeSlideLanes(true);
  const runtime=center()===2.5&&handModel.slideLaneAtGrid(slide,4)===3.5;
  handModel.useRuntimeSlideLanes(false);
  ok('切り替えるとゲーム本体と同じ座標(値＋0.5が中心)',runtime);
  ok('切り替えを戻せる',handModel.slideLaneOffset()===0);
  // TAP の読み方は変えない
  handModel.useRuntimeSlideLanes(true);
  const [lo,hi]=handModel.noteTouchSpan({type:'TAP',subLane:4,subLaneWidth:2});
  handModel.useRuntimeSlideLanes(false);
  ok('TAP の座標は切り替えで変わらない',lo===2&&hi===3);
}

// ── 3. 6レーンの中央 ──
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  ok('中央を CENTER_LANE で数える(Rev.8 は (LANES-1)/2)',/const CENTER_LANE=rev8\?\(LANES-1\)\/2:2;/.test(source));
  const hardcoded=[/lastLane=2[,;]/,/lane>=2\?-1:1/,/Math\.abs\(base-2\)/].filter(re=>re.test(source));
  ok('中央の 2 を直書きしていない',hardcoded.length===0,hardcoded.map(String).join(' '));
}

// ── 4. 実際に作って比べる(Monster Hero) ──
{
  const trackId='monster_hero_theme',dashed='monster-hero-theme';
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev8-'));
  const run=(args)=>spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const generate=revision=>{
    const dir=path.join(tmp,`rev${revision}`);fs.mkdirSync(dir,{recursive:true});
    const result=run([path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir]);
    return {dir,stdout:result.stdout||'',status:result.status};
  };
  try{
    const rev7=generate(7),rev8=generate(8);
    ok('Rev.7・Rev.8 とも作れる',rev7.status===0&&rev8.status===0);
    // Rev.7 は公開していた Rev.7 の作者用の譜面と同じ(既存曲の作り方が変わっていない)。
    // 2026-09-26 に公開曲を Rev.15 で作り直し authoring/ の譜面が変わったので、作り直す前の Rev.7 の譜面の sha256 を持って比べる
    const REV7_SHA256={easy:'1562188e328f8205ceae7b097ffcd4d00ad771c0b8f24111ccf6732464069641',normal:'5a1f319e5d9f9adc91779ac1d660c81971b5158037d8521f5731ea07a318e5e8',
      hard:'9cc22cbbd4510847ee477c0469e8cf050983e455d9ca8a12b0aae3dd1a1297c2',expert:'5af139c7f6d9ad40cb2dc296b6b20fc05799e7eb9b8d12a4947e625a371e74c1',
      master:'f10c8b11ce1367942859e2d21bb517147b44fe56351b581fa531925840dd4fb0'};
    const same=Object.entries(REV7_SHA256).every(([d,sha])=>
      crypto.createHash('sha256').update(fs.readFileSync(path.join(rev7.dir,`${dashed}-v3-chart-${d}.json`))).digest('hex')===sha);
    ok('Rev.7 で作った譜面は、公開していた Rev.7 の譜面と1バイトも変わらない',same);
    ok('Rev.8 だけ写しの小節の FLICK を揃える',!/写しの小節/.test(rev7.stdout)&&/写しの小節の FLICK を元の小節に揃えた/.test(rev8.stdout));

    const readChart=(dir,kind)=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-${kind}-master.json`),'utf8'));
    const consistent=chart=>{
      handModel.useRuntimeSlideLanes(true);
      try{
        let total=0,match=0,collide=0;
        for(const context of sideFlickContexts(chart.notes,audio.timing)){
          const note=chart.notes[context.index];
          const dir=note.flickDir==='left'?-1:note.flickDir==='right'?1:0;
          total++;
          if(dir===chooseSideFlickDir(context).dir)match++;
          if(collides(context,dir))collide++;
        }
        return {total,match,collide};
      }finally{handModel.useRuntimeSlideLanes(false);}
    };
    const gen8=readChart(rev8.dir,'chart');
    const c8=consistent(gen8);
    ok('Rev.8 の生成直後、横フリックの向きは決め方どおり・もう片方の指へ向かわない',c8.total>0&&c8.match===c8.total&&c8.collide===0,JSON.stringify(c8));

    // 自動修正を通しても向きが決め方どおり(動かしたあとに付け直している)
    const fixDir=path.join(tmp,'fix8');fs.mkdirSync(fixDir);
    const fix=run([path.join(__dirname,'rhythm-chart-v2-step7-autofix.js'),'--source','v3','--track',trackId,'--input-dir',rev8.dir,'--difficulty','MASTER','--write','--output-dir',fixDir]);
    ok('Rev.8 の譜面を自動修正できる',fix.status===0,(fix.stderr||'').split('\n')[0]);
    const fixed8=readChart(fixDir,'fixed');
    const f8=consistent(fixed8);
    ok('自動修正のあとも横フリックの向きは決め方どおり',f8.total>0&&f8.match===f8.total&&f8.collide===0,JSON.stringify(f8));
    ok('自動修正でノーツの数は変わらない',fixed8.notes.length===gen8.notes.length);

    const fix7Dir=path.join(tmp,'fix7');fs.mkdirSync(fix7Dir);
    run([path.join(__dirname,'rhythm-chart-v2-step7-autofix.js'),'--source','v3','--track',trackId,'--input-dir',rev7.dir,'--difficulty','MASTER','--write','--output-dir',fix7Dir]);
    const feel7=measureFeel(readChart(fix7Dir,'fixed'),audio,{withQuality:false});
    const feel8=measureFeel(fixed8,audio,{withQuality:false});
    ok('物差しでも Rev.8 の横フリックは Rev.7 より自然',feel8.sideFlick.naturalRate>feel7.sideFlick.naturalRate&&feel8.sideFlick.collide===0,
      `Rev.7 ${feel7.sideFlick.naturalRate}（ぶつかる${feel7.sideFlick.collide}） → Rev.8 ${feel8.sideFlick.naturalRate}（ぶつかる${feel8.sideFlick.collide}）`);
    ok('Rev.8 でも押せない配置は無い',feel8.impossible===0,`${feel8.impossible}件`);
  }finally{
    fs.rmSync(tmp,{recursive:true,force:true});
  }
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.8(手の動きと繰り返しを揃える)は期待どおり');
process.exit(failed?1:0);
