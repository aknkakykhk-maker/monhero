#!/usr/bin/env node
// 譜面制作ツールが「特定の曲に合わせ込んだもの」になっていないことを確かめる。
//
//   node tools/mode/rhythm-audio-general-check.js
//   node tools/mode/rhythm-audio-general-check.js --songs 6   # 試す曲を増やす
//
// 【なぜ要るか】
// ユーザーの問い「全ての曲に対応出来るものになってる？」に、答えを数字で持つため。
//
// 作った直後のV3は、実際には**2曲専用**だった。
//   ・BPMと拍の頭を rhythm-timing.js へ手で書く必要があった（登録は2曲だけ）
//   ・曲の区切りは ffmpeg を使う別系統の道具の出力に頼っていた
//   ・譜面の量が「その曲の打点の何割」で決まっていて、曲が変わると量が変わった
//
// いまは音だけで完結する。ここでは**登録の無い曲**を何曲か通しにかけ、
// 人手を一切入れずに最後まで作れることを毎回確かめる。
'use strict';
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

// 性格の違う曲を選ぶ（速い戦闘曲・遅い曲・長い曲・短い曲）。
// どれも rhythm-timing.js に登録が無い＝人が耳で合わせていない曲。
const SONGS=[
  {track:'check_pro_battle_01', audio:'monster-hero/audio/bgm-pro-battle-01.mp3', label:'速い戦闘曲（3分）'},
  {track:'check_market',        audio:'monster-hero/audio/bgm-market.mp3',        label:'落ち着いた曲'},
  {track:'check_dullahan',      audio:'monster-hero/audio/bgm-dullahan.mp3',      label:'重い曲'},
  {track:'check_title_theme',   audio:'monster-hero/audio/bgm-title-theme.mp3',   label:'短い曲（30秒台）'},
  {track:'check_boss',          audio:'monster-hero/audio/bgm-boss.mp3',          label:'ボス曲'},
  {track:'check_event_01',      audio:'monster-hero/audio/bgm-event-01.mp3',      label:'イベント曲'},
];
const LIMIT=Math.max(2,Math.min(SONGS.length,Number(arg('--songs',4))));
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
// 人が耳で確認して通した2曲。ここが崩れたら、テンポの判定そのものが壊れている。
const ANCHORS=[
  {audio:'monster-hero/audio/bgm-monster-hero-theme.mp3',bpm:173.153,tolerancePercent:.1},
  {audio:'monster-hero/audio/bgm-atsu-cup-theme.mp3',    bpm:169,    tolerancePercent:.5},
];

const run=(tool,args)=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode',tool),...args],
  {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});

// --- 1. 道具が特定の曲を名指ししていないこと ---
{
  const analyzer=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-audio-analyze-v3.js'),'utf8');
  const generator=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'utf8');
  check('解析の道具が曲をコードへ埋め込んでいない（一覧ファイルと --audio で足せる）',
    !/monster-hero\/audio\/bgm-/.test(analyzer)&&analyzer.includes('rhythm-song-registry.json'));
  check('生成の道具が別系統（ffmpegを使うV2の解析）に頼っていない',
    !/v2-features\.json|v2-structure\.json/.test(generator));
  check('生成の量が「1拍あたり」の目標で決まる（曲ごとの合わせ込みではない）',
    /DENSITY_TARGET/.test(generator)&&/perBeat/.test(generator)&&!/musicalShare/.test(generator));
}

// --- 2. 耳で確認済みの曲でテンポを外していないこと ---
{
  const {detectTiming}=require('./rhythm-audio-tempo-v3.js');
  const results=[];
  const done=(async()=>{
    for(const anchor of ANCHORS){
      const timing=await detectTiming(anchor.audio);
      results.push({anchor,timing});
    }
  })();
  done.then(()=>{
    for(const {anchor,timing} of results){
      const errorPercent=Math.abs(timing.bpm/anchor.bpm-1)*100;
      check(`耳で確認済みの曲のテンポを当てられる（${path.basename(anchor.audio)}）`,
        errorPercent<=anchor.tolerancePercent,
        `${timing.bpm.toFixed(3)} BPM / 正解 ${anchor.bpm} / 誤差 ${errorPercent.toFixed(3)}%`);
    }
    main();
  }).catch(error=>{
    check('テンポの判定を実行できる',false,error.message);
    main();
  });
}

function main(){
  const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-general-check-'));
  const registryBefore=fs.readFileSync(path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json'),'utf8');
  try{
    for(const song of SONGS.slice(0,LIMIT)){
      console.log(`\n--- ${song.label}: ${path.basename(song.audio)} ---`);
      const analyzed=run('rhythm-audio-analyze-v3.js',
        ['--audio',song.audio,'--track',song.track,'--write','--output-dir',tempDir]);
      check(`${song.track}: 人手なしで解析できる`,analyzed.status===0,
        (analyzed.stderr||'').split('\n')[0]);
      if(analyzed.status!==0)continue;
      const audioFile=path.join(tempDir,`${song.track.replace(/_/g,'-')}-v3-audio.json`);
      const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));
      check(`${song.track}: テンポを自動で決められた`,
        audio.timing.source==='detected'&&audio.timing.bpm>=70&&audio.timing.bpm<=210,
        `${audio.timing.bpm.toFixed(2)} BPM / ${audio.timing.beatsPerBar}拍子 / ${audio.timing.subdivisionsPerBeat}分割`);
      // 打点が格子へどれだけ乗るかは曲の作りにもよる（打ち込みでない曲はゆるい）。
      // ここで見たいのは「テンポを大きく外していないか」なので、8割を下限にする。
      check(`${song.track}: 打点が格子へ乗っている（テンポを大きく外していない）`,
        audio.summary.gridFit.within43ms>=.8,
        `±43ms ${(audio.summary.gridFit.within43ms*100).toFixed(0)}% / ±30ms ${(audio.summary.gridFit.within30ms*100).toFixed(0)}%`);
      check(`${song.track}: 曲の区切りを見つけられた`,audio.structure.sections.length>=2,
        `${audio.structure.sections.length}個 / ${audio.structure.bars.length}小節`);
      check(`${song.track}: 音の性格が偏りすぎていない`,(()=>{
        const counts=audio.summary.characterCounts;
        const total=Object.values(counts).reduce((a,b)=>a+b,0);
        const top=Math.max(...Object.values(counts));
        return Object.keys(counts).length>=2&&top/total<=.92;
      })(),Object.entries(audio.summary.characterCounts).map(([k,v])=>`${k}${v}`).join(' '));

      const generated=run('rhythm-chart-v3-generate.js',
        ['--track',song.track,'--write','--input-dir',tempDir,'--output-dir',tempDir]);
      check(`${song.track}: 人手なしで5難易度を作れる`,generated.status===0,
        (generated.stderr||'').split('\n')[0]);
      if(generated.status!==0)continue;
      const charts={};
      for(const difficulty of DIFFICULTIES){
        const file=path.join(tempDir,`${song.track.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
        charts[difficulty]=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
      }
      check(`${song.track}: 5難易度そろっている`,DIFFICULTIES.every(d=>charts[d]&&charts[d].notes.length>0),
        DIFFICULTIES.map(d=>`${d} ${charts[d]?.notes.length??0}`).join(' / '));
      if(!DIFFICULTIES.every(d=>charts[d]))continue;
      check(`${song.track}: ノーツ数が難易度順に増える`,
        DIFFICULTIES.every((d,i)=>i===0||charts[d].notes.length>charts[DIFFICULTIES[i-1]].notes.length),
        DIFFICULTIES.map(d=>charts[d].notes.length).join(' < '));
      check(`${song.track}: 密度が狙いどおり（曲が変わってもそろう）`,(()=>
        DIFFICULTIES.every(d=>{
          const chart=charts[d];
          const target=chart.policy.densityTarget;
          const wanted=Math.max(target.minPerSecond,Math.min(target.maxPerSecond,
            target.perBeat*1000/(60000/chart.bpm)));
          return Math.abs(chart.densityPerSecond/wanted-1)<=.15;
        })
      )(),DIFFICULTIES.map(d=>`${d} ${charts[d].densityPerSecond}`).join(' / ')+' 毎秒');
      const onsetGrids=new Set(audio.onsets.map(onset=>onset.grid));
      check(`${song.track}: 鳴っていない場所へ置いていない`,
        DIFFICULTIES.every(d=>charts[d].notes.every(note=>note.chord||onsetGrids.has(note.grid))));
      check(`${song.track}: 形の語彙を使っている`,
        DIFFICULTIES.every(d=>new Set((charts[d].shapes||[]).map(entry=>entry.pattern).filter(Boolean)).size>=4),
        DIFFICULTIES.map(d=>new Set((charts[d].shapes||[]).map(e=>e.pattern).filter(Boolean)).size).join('/')+'種');

      // 押せるか（自動修正の前の時点で見る。EASY〜HARDは0件、上位は1%まで）
      for(const difficulty of DIFFICULTIES){
        const file=path.join(tempDir,`${song.track.replace(/_/g,'-')}-v3-chart-${difficulty.toLowerCase()}.json`);
        const result=run('rhythm-chart-v2-step6-playability.js',['--file',file]);
        const matched=/押せない (\d+)件/.exec(result.stdout||'');
        const impossible=matched?Number(matched[1]):-1;
        const total=charts[difficulty].notes.length;
        const allowed=['EASY','NORMAL','HARD'].includes(difficulty)?0:Math.ceil(total*.01);
        check(`${song.track} ${difficulty}: 指で押せる`,impossible>=0&&impossible<=allowed,
          `押せない ${impossible}件 / 許容 ${allowed}件 (${total}ノーツ)`);
      }
    }
  }finally{
    fs.rmSync(tempDir,{recursive:true,force:true});
    // 曲の一覧を汚していないことを確かめる
    const registryAfter=fs.readFileSync(path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json'),'utf8');
    check('検査が曲の一覧を書き換えていない',registryBefore===registryAfter);
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
}
