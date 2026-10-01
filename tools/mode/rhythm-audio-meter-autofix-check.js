#!/usr/bin/env node
// 拍子の読み違いを解析で自動で直す(rhythm-audio-analyze-v3.js の 7b・2026-09-29)を見張る。
//   ・人が直した2曲(crossing_field / six_eternel_beat)は、自動判定のまま解析すると、人が決めた値へ自動で直る
//   ・本当の3拍子の曲(toriko)は直さない。やや疑わしいだけの曲(freedom_dive)も直さない(注意のまま)
//   ・--no-auto-meter なら直さず、止める警告(meter-doubt)のまま
//   ・直したら、止める警告ではなく注意(meter-corrected)を出す。人が決めた値として扱わない
// 書き出しは一時フォルダだけ。解析済みのファイルと曲の一覧は触らない(CLAUDE.md ⑩-2)
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
// 解析はブラウザ(Chromium)でデコードして確かめる。ffmpeg でデコードすると打点の検出がずれ、
// six_eternel_beat は 138 BPM・4拍子と読まれて「3拍子の読み違い」にならず、自動修正まで届かない。
// 人が決めた値と解析済みファイルはブラウザ経路で作られているので、こちらに合わせる。Playwright が無い環境では飛ばす
try{require('playwright');}catch(e){console.log('SKIP: Playwright が無いので、ブラウザ経路でデコードするこの検査は飛ばします');process.exit(0);}
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const registryFile=path.join(__dirname,'authoring','rhythm-song-registry.json');
const registryBefore=sha(registryFile);

const source=fs.readFileSync(path.join(__dirname,'rhythm-audio-analyze-v3.js'),'utf8');
ok('直すのは自動判定のままで、止める警告の meter-doubt が出たときだけ',
  /const meterDoubt=timing\.source==='detected'&&!noAutoMeter\s*\?warnings\.find\(warning=>warning\.code==='meter-doubt'&&warning\.severity==='critical'\)/.test(source));
ok('直すと格子への乗りが悪くなるときは直さない',/if\(autoMeterFrom&&gridFit\.within15ms<autoMeterFrom\.within15ms\)/.test(source)
  &&/if\(child\.status!==AUTO_METER_WORSE\)/.test(source));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-meterfix-'));
try{
  const analyze=(trackId,extra=[])=>{
    const dir=path.join(tmp,`${trackId}${extra.length?'-x':''}`);fs.mkdirSync(dir);
    const run=spawnSync(process.execPath,[path.join(__dirname,'rhythm-audio-analyze-v3.js'),'--track',trackId,'--write','--output-dir',dir,...extra],
      {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,MHB_AUDIO_DECODE:'chromium'}});
    const file=path.join(dir,`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{error:run.stderr||run.stdout};
  };
  for(const [trackId,truth] of [['crossing_field',178.97],['six_eternel_beat',275.99]]){
    const audio=analyze(trackId);
    const t=audio.timing||{};
    ok(`${trackId}: 人が決めた値(${truth} BPM・4拍子)へ自動で直る`,t.source==='auto-corrected'&&t.beatsPerBar===4&&Math.abs(t.bpm/truth-1)<.0005,
      `${t.bpm} BPM・${t.beatsPerBar}拍子(${t.source})`);
    const warnings=audio.warnings||[];
    ok(`${trackId}: 止める警告ではなく注意(meter-corrected)を出す`,warnings.some(w=>w.code==='meter-corrected'&&w.severity==='notice')
      &&!warnings.some(w=>w.code==='meter-doubt'),warnings.map(w=>w.code).join(' / '));
  }
  for(const trackId of ['toriko','freedom_dive']){
    const t=analyze(trackId).timing||{};
    ok(`${trackId}: 直さない`,t.source==='detected'&&t.beatsPerBar===3,`${t.bpm} BPM・${t.beatsPerBar}拍子(${t.source})`);
  }
  const kept=analyze('crossing_field',['--no-auto-meter']);
  ok('--no-auto-meter なら直さず、止める警告のまま',kept.timing&&kept.timing.source==='detected'
    &&(kept.warnings||[]).some(w=>w.code==='meter-doubt'&&w.severity==='critical'));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
ok('曲の一覧は書き換えない',sha(registryFile)===registryBefore);
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 拍子の読み違いの自動修正は期待どおり');
process.exit(failed?1:0);
