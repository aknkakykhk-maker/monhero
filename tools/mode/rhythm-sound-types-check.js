#!/usr/bin/env node
// Rev.6「音の性格でノーツの種類を決める」と、譜面メモ(遊んだ感想を残す仕組み)を見張る(2026-09-26)。
//
//   node tools/mode/rhythm-sound-types-check.js
//   node tools/mode/rhythm-sound-types-check.js --tracks a,b,c
//
// 【なぜ要るか】ユーザー指摘「ただ適当にフリックとかを置くじゃなくて、譜面にあわせてあった配置や
// ノーツの種類があるとおもう」／「遊んだ感想を譜面に残す仕組みも」。
// Rev.5までは、フリック・同時押しを数だけ決めて曲全体へ散らしていた(音の性格に乗る割合がTAP全体と同じ)。
// Rev.6は rhythm-sound-traits.js の物差しで「その音にふさわしい種類」を選ぶ。
//
// 見るもの:
//   ・音の性格の物差しが、作った音(シンバル・切れる音・語尾・旋律の上下)を正しく見分ける
//   ・実際にRev.5・Rev.6で生成し、Rev.6のフリック・同時押しが音の性格に乗る割合がはっきり上がる
//     (押せない・ノーツ数は悪くしない)。横フリックの向きが旋律の上下と合う
//   ・譜面メモ: 結果画面の部品がデバッグから始めた演奏にだけ出る／新しい保存キーが一覧に載っている／
//     指紋の式がランタイムと取り込み道具で同じ／貼り付けを読める
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {soundTraitsFor,flickScoreOf,chordScoreOf}=require('./rhythm-sound-traits.js');
const {reportFor:fitReportFor}=require('./rhythm-note-type-fit.js');
const {reportFor:qualityReportFor}=require('./rhythm-chart-quality-report.js');
const {CHART_REVISION_LATEST}=require('./rhythm-chart-v3-revision.js');
const feedback=require('./rhythm-chart-feedback.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 1. 物差し(作った音で) ──────────────────────────────────────────────────
{
  const beatMs=500;
  const onset=(timeMs,extra)=>({timeMs,grid:timeMs/125,strength:.5,character:'PUNCH',bandsJumped:1,share:{hi:0,air:0},sustainMs:50,pitchHz:0,...extra});
  const audio={timing:{beatMs},onsets:[
    onset(0,{character:'FULL',strength:.9,bandsJumped:5,share:{hi:.4,air:.2}}),   // シンバル＋大きな一発
    onset(250,{}),                                                                // 詰まった音(切れない)
    onset(500,{sustainMs:40}),                                                    // このあと1拍あく＝切れる
    onset(1000,{pitchHz:440}),onset(1250,{pitchHz:523}),                          // 旋律が上がる
    onset(1500,{pitchHz:392}),                                                    // 下がって、そのあと間があく＝語尾
    onset(3000,{character:'LIGHT',strength:.2}),
  ]};
  const traits=soundTraitsFor(audio);
  const at=ms=>traits.get(ms/125);
  ok('シンバル・大きな一発を見分ける',at(0).crash&&at(0).accent&&chordScoreOf(at(0))>0);
  ok('詰まった音は切れる音ではない',!at(250).release&&flickScoreOf(at(250))===0);
  ok('あとが空く短い音は切れる音',at(500).release&&flickScoreOf(at(500))>0);
  ok('旋律の上がり・下がりを見分ける',at(1250).pitchMove===1&&at(1500).pitchMove===-1);
  ok('旋律の語尾を見分ける',at(1500).phraseEnd&&!at(1000).phraseEnd);
  ok('同時押しはシンバル・大きな一発でない音を選ばない',chordScoreOf(at(250))===0);
}

// ── 2. Rev.6で実際に作って比べる ──────────────────────────────────────────────
ok('最新リビジョンは6以上',CHART_REVISION_LATEST>=6);
const tracks=(arg('--tracks','nothing_without_you,dullahan,kindan_no_resistance,monster_hero_theme')||'').split(',').filter(Boolean);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sound-types-'));
try{
  const sum={5:{flicks:0,flickHit:0,chords:0,chordHit:0,impossible:0,notes:0},6:{flicks:0,flickHit:0,chords:0,chordHit:0,impossible:0,notes:0,side:0,sideHit:0}};
  for(const trackId of tracks){
    for(const revision of [5,6]){
      const dir=path.join(tmp,`${trackId}-r${revision}`);
      fs.mkdirSync(dir,{recursive:true});
      const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'--track',trackId,
        '--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
      if(run.status!==0){ok(`${trackId} Rev.${revision}を生成できる`,false,(run.stderr||'').split('\n')[0]);continue;}
      const fit=fitReportFor(trackId,{dir,source:'v3'});
      const quality=qualityReportFor(trackId,{dir,source:'v3'});
      for(const [difficulty,m] of Object.entries(fit.difficulties)){
        const s=sum[revision];
        s.flicks+=m.flicks;s.flickHit+=Math.round((m.flickFit||0)*m.flicks);
        if(['EASY','NORMAL','HARD'].includes(difficulty)){s.chords+=m.chords;s.chordHit+=Math.round((m.chordFit||0)*m.chords);}
        if(revision===6){s.side+=m.sideJudged;s.sideHit+=Math.round((m.sideFit||0)*m.sideJudged);}
        s.impossible+=quality.difficulties[difficulty].gate.impossible;
        s.notes+=quality.difficulties[difficulty].noteCount;
      }
    }
  }
  const rate=(hit,total)=>total?hit/total:0;
  const f5=rate(sum[5].flickHit,sum[5].flicks),f6=rate(sum[6].flickHit,sum[6].flicks);
  const c5=rate(sum[5].chordHit,sum[5].chords),c6=rate(sum[6].chordHit,sum[6].chords);
  ok('Rev.6のフリックは音の性格(切れる・語尾・シンバル)に乗る',f6>=.8&&f6>=f5+.25,`Rev.5 ${Math.round(f5*100)}% → Rev.6 ${Math.round(f6*100)}%`);
  ok('Rev.6の同時押し(EASY〜HARD)はシンバル・大きな一発に乗る',c6>=.6&&c6>=c5+.3,`Rev.5 ${Math.round(c5*100)}% → Rev.6 ${Math.round(c6*100)}%`);
  ok('Rev.6の横フリックは旋律の上がり下がりと同じ向き',sum[6].side===0||rate(sum[6].sideHit,sum[6].side)>=.95,
    `${sum[6].sideHit}/${sum[6].side}`);
  ok('Rev.6で押せない配置を増やしていない',sum[6].impossible<=sum[5].impossible,`Rev.5 ${sum[5].impossible} → Rev.6 ${sum[6].impossible}`);
  ok('Rev.6でノーツ数を大きく変えていない(種類を選び直すだけ)',Math.abs(sum[6].notes-sum[5].notes)<=sum[5].notes*.03,
    `Rev.5 ${sum[5].notes} → Rev.6 ${sum[6].notes}`);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

// ── 3. 譜面メモ ──────────────────────────────────────────────────────────────
{
  const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
  ok('譜面メモの部品がある',/const RhythmChartNotePanel=/.test(play));
  ok('譜面メモはデバッグから始めた演奏にだけ出る',/\{debugPlay&&!tutorial&&!calibrating&&<RhythmChartNotePanel /.test(play)
    &&(play.match(/<RhythmChartNotePanel /g)||[]).length===1);
  ok('譜面メモは新しい保存キーだけを使う',/const RHYTHM_CHART_NOTES_KEY='mh_rhythm_chart_notes_v1'/.test(play));
  const saveDoc=fs.readFileSync(path.join(ROOT,'docs/spec/SAVE_DATA.md'),'utf8');
  ok('保存キーが SAVE_DATA.md に載っている',saveDoc.includes('mh_rhythm_chart_notes_v1'));
  // 指紋の式がランタイムと取り込み道具で同じ(片方だけ直すと、全部のメモが「作り直す前」扱いになる)
  const runtimeBody=(play.match(/const rhythmChartFingerprint=chart=>\{([\s\S]*?)\n\};/)||[])[1]||'';
  const toolBody=(fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-feedback.js'),'utf8').match(/const fingerprintOf=chart=>\{([\s\S]*?)\n\};/)||[])[1]||'';
  ok('指紋の式がランタイムと取り込み道具で同じ',runtimeBody.length>0&&runtimeBody.replace(/\s/g,'')===toolBody.replace(/\s/g,''));
  const note={kind:'monhero-rhythm-chart-note',version:1,songId:'toriko',difficulty:'MASTER',fingerprint:'1:0:0',segmentMs:8000,
    marks:['','good','bad'],memo:'1:20 の { フリック } が変',savedAt:'2026-09-26T00:00:00Z'};
  ok('貼り付けを読める(そのまま・文章まじり・複数)',feedback.parseNotes(JSON.stringify(note)).length===1
    &&feedback.parseNotes(`感想です\n${JSON.stringify(note)}\nよろしく`).length===1
    &&feedback.parseNotes(JSON.stringify([note,note])).length===2);
  ok('形の違うメモは取り込まない',!feedback.validNote({...note,marks:['すごい']})&&!feedback.validNote({...note,segmentMs:0}));
  ok('区間の中身を数えられる',feedback.segmentFeatures({notes:[{type:'FLICK',timeMs:100,flickDir:'left'},{type:'TAP',timeMs:100},{type:'TAP',timeMs:9000}]},0,8000).chords===1);
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 音の性格でノーツの種類を決めるRev.6と、譜面メモは期待どおり');
process.exit(failed?1:0);
