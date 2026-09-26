#!/usr/bin/env node
// MHB CHART ENGINE Rev.9(主役の追跡・2026-09-26・ROADMAP の段3)を見張る。
//   ・主役の追跡(rhythm-chart-focus.js): 打楽器が前に出る所はドラム、歌や主旋律の帯が前に出る所はメロディ。
//     差の小さい1小節のぶれでは切り替えない。区切りの直前の1小節で打楽器がはっきり前に出る(フィル)ときだけ、そこでドラムを追う
//   ・後押しの向き: ドラムを追う所は打楽器寄りの打点、メロディを追う所は音程のある打点を上げる
//   ・生成器: 層の解析が無い・合わない曲では効かず、Rev.8 と同じノーツになる。あれば効き、押せない配置を作らない
//   ・パイプラインは Rev.9 以降の曲で、書き出すときだけ層の解析を作る
// 音声を読まずに済むよう、層の解析は検査の中で作った値を使う(実際の解析は rhythm-audio-layers-v3-check.js が見る)。
'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const {trackFocus,focusBoost}=require('./rhythm-chart-focus.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

ok('作り方の最新は Rev.9 以上',CHART_REVISION_CODE_LATEST>=9);

// ── 1. 主役の追跡 ──
{
  const BAR=16,bars=24;
  // 0〜7小節: 打楽器が前 / 8〜15: 歌や主旋律が前 / 16〜23: 同じくらい。
  // 11小節目は打楽器がわずかに前に出るだけ(弱いぶれ)、15小節目(区切りの直前)は打楽器がはっきり前に出る(フィル)
  const percussive=[],lead=[];
  for(let b=0;b<bars;b++)for(let g=0;g<BAR;g++){
    if(b===11){percussive.push(.6);lead.push(.45);continue;}
    const drums=b<8||b===15,melody=b>=8&&b<16&&b!==15;
    percussive.push(drums?.9:melody?.2:.5);lead.push(drums?.2:melody?.9:.5);
  }
  const layers={grid:{firstGrid:0},series:{percussive,lead}};
  const {byBar}=trackFocus(layers,{bar:BAR,sectionStarts:new Set([0,8,16])});
  ok('打楽器が前に出る区切りはドラムを追う',[0,1,2,3,4,5,6,7].every(b=>byBar.get(b)==='drums'));
  ok('歌や主旋律が前に出る区切りはメロディを追う',[8,9,10,12,13,14].every(b=>byBar.get(b)==='melody'));
  ok('差の小さい1小節のぶれでは切り替えない',byBar.get(11)==='melody');
  ok('区切りの直前で打楽器がはっきり前に出る小節(フィル)はドラムを追う',byBar.get(15)==='drums');
  ok('同じくらいの区切りは混ざり(後押ししない)',[16,17,18,19,20,21,22,23].every(b=>byBar.get(b)==='mix'));
  ok('2回とも同じ結果',JSON.stringify([...trackFocus(layers,{bar:BAR,sectionStarts:new Set([0,8,16])}).byBar])===JSON.stringify([...byBar]));
  ok('層の解析が無ければ何も決めない',trackFocus(null,{bar:BAR}).byBar.size===0);
}

// ── 2. 後押しの向き ──
ok('ドラムを追う所は打楽器寄りの打点を上げ、音程楽器寄りを下げる',focusBoost('drums',{percussiveShare:.9})>0&&focusBoost('drums',{percussiveShare:.1})<0);
ok('メロディを追う所は音程のある打点を上げ、音程の無い打楽器だけの打点を下げる',
  focusBoost('melody',{pitched:true,lead:.7})>0&&focusBoost('melody',{pitched:false,percussiveShare:.95,lead:.3})<0);
ok('混ざりは後押ししない',focusBoost('mix',{pitched:true,percussiveShare:.9,lead:.9})===0);

// ── 3. 生成器 ──
{
  const trackId='monster_hero_theme',dashed='monster-hero-theme';
  const audioFile=path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`);
  const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev9-'));
  const run=args=>spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),...args],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const generate=(revision,inputDir,label)=>{
    const out=path.join(tmp,label);fs.mkdirSync(out,{recursive:true});
    const result=run(['--track',trackId,'--chart-revision',String(revision),'--input-dir',inputDir,'--write','--output-dir',out]);
    const chart=d=>JSON.parse(fs.readFileSync(path.join(out,`${dashed}-v3-chart-${d}.json`),'utf8'));
    return {stdout:result.stdout||'',status:result.status,chart};
  };
  try{
    // 層の解析の無い入力の置き場
    const bare=path.join(tmp,'bare');fs.mkdirSync(bare);fs.copyFileSync(audioFile,path.join(bare,`${dashed}-v3-audio.json`));
    const rev8=generate(8,bare,'rev8'),rev9bare=generate(9,bare,'rev9bare');
    ok('Rev.9 で層の解析が無ければ「効かない」と出す',rev9bare.status===0&&/主役の追跡: 効かない（音の層の解析が無い）/.test(rev9bare.stdout));
    const sameNotes=['easy','normal','hard','expert','master'].every(d=>JSON.stringify(rev8.chart(d).notes)===JSON.stringify(rev9bare.chart(d).notes));
    ok('層の解析が無ければ Rev.8 と同じノーツ',sameNotes);

    // 検査の中で作った層の解析: 前半はドラム、後半はメロディ。打点の打楽器成分の割合は打点の性格で振る
    const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
    const lastGrid=Math.max(...audio.onsets.map(o=>o.grid).filter(Number.isFinite))+BAR;
    const half=Math.floor(lastGrid/BAR/2)*BAR;
    const percussive=[],lead=[];
    for(let g=0;g<=lastGrid;g++){percussive.push(g<half?.85:.25);lead.push(g<half?.25:.85);}
    const audioSha=crypto.createHash('sha256').update(fs.readFileSync(audioFile)).digest('hex');
    const layers={schemaVersion:1,analysisType:'rhythm-audio-layers-v3',basedOn:{file:path.basename(audioFile),sha256:audioSha},
      grid:{firstGrid:0,count:lastGrid+1},series:{percussive,lead,harmonic:lead,high:percussive},
      onsets:audio.onsets.map(o=>({timeMs:o.timeMs,drums:[],percussiveShare:o.character==='PUNCH'||o.character==='LIGHT'?.6:.1}))};
    const withLayers=path.join(tmp,'layers');fs.mkdirSync(withLayers);
    fs.copyFileSync(audioFile,path.join(withLayers,`${dashed}-v3-audio.json`));
    fs.writeFileSync(path.join(withLayers,`${dashed}-v3-layers.json`),JSON.stringify(layers));
    const rev9=generate(9,withLayers,'rev9');
    ok('層の解析があれば主役の追跡が効く',rev9.status===0&&/主役の追跡: ドラム\d+小節・歌や主旋律\d+小節/.test(rev9.stdout),(rev9.stdout.match(/主役の追跡.*/)||[''])[0]);
    const master9=rev9.chart('master'),master8=rev8.chart('master');
    ok('譜面に追った層が残る',typeof master9.focus?.bars==='string'&&/:d/.test(master9.focus.bars)&&/:v/.test(master9.focus.bars));
    const grids=chart=>new Set(chart.notes.map(n=>n.grid));
    const g8=grids(master8),g9=grids(master9);
    ok('拾う音が変わる(主役に合わせて選び直す)',[...g9].some(g=>!g8.has(g)));
    // 狙いどおりに選び直している: ドラムを追う前半は打楽器寄りの打点(この検査では PUNCH・LIGHT)、
    // メロディを追う後半は音程のある打点が、層の解析なしで作ったときより増える(全難易度の合計)
    const onsetByGrid=new Map(audio.onsets.map(o=>[o.grid,o]));
    const lean=result=>{
      let drumN=0,drumHit=0,melN=0,melHit=0;
      for(const d of ['easy','normal','hard','expert','master'])for(const note of result.chart(d).notes){
        const onset=onsetByGrid.get(note.grid);if(!onset||note.chord)continue;
        if(note.grid<half){drumN++;if(onset.character==='PUNCH'||onset.character==='LIGHT')drumHit++;}
        else{melN++;if(onset.pitchHz>0)melHit++;}
      }
      return {drums:drumHit/drumN,melody:melHit/melN};
    };
    const before=lean(rev9bare),after=lean(rev9);
    ok('ドラムを追う所で打楽器寄りの打点が増え、メロディを追う所で音程のある打点が増える',after.drums>before.drums&&after.melody>before.melody,
      `打楽器寄り ${before.drums.toFixed(3)}→${after.drums.toFixed(3)} / 音程あり ${before.melody.toFixed(3)}→${after.melody.toFixed(3)}`);
    // 下の難易度は上の難易度の部分集合(拾う順番が同じ)。Rev.8 と比べて崩れていない
    const subsetRate=r=>{const e=grids(r.chart('easy')),m=grids(r.chart('master'));return [...e].filter(g=>m.has(g)).length/e.size;};
    ok('EASY の置き場所が MASTER にも入っている割合が Rev.8 と同じくらい',subsetRate(rev9)>=subsetRate(rev8)-.02,`Rev.8 ${subsetRate(rev8).toFixed(3)} / Rev.9 ${subsetRate(rev9).toFixed(3)}`);
    ok('作法 layer_follow は止まる(主役の追跡と二重に効かない)',!master9.notes.some(n=>Array.isArray(n.knowledge)&&n.knowledge.includes('layer_follow')));

    // 解析ファイルと合わない層の解析は使わない
    layers.basedOn.sha256='0'.repeat(64);
    fs.writeFileSync(path.join(withLayers,`${dashed}-v3-layers.json`),JSON.stringify(layers));
    const stale=generate(9,withLayers,'stale');
    ok('いまの解析ファイルと合わない層の解析は使わない',/主役の追跡: 効かない（音の層の解析が、いまの解析ファイルと合わない/.test(stale.stdout));
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}

// ── 4. パイプライン ──
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8');
  ok('パイプラインは Rev.9 以降の曲で、書き出すときだけ層の解析を作る',
    /chartRevisionOf\(\(registry\.songs\|\|\{\}\)\[trackId\]\)>=9/.test(source)&&/if\(!fresh&&write\)step\([^)]*rhythm-audio-layers-v3\.js/.test(source));
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.9(主役の追跡)は期待どおり');
process.exit(failed?1:0);
