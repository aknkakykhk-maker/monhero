#!/usr/bin/env node
// 手の流れを狙う配置(2026-10-21 社長「新しい譜面から流れを狙う」)の決まりを見張る。
//
//   node tools/mode/rhythm-chart-flow-check.js
//
// ① 既定は切: 指定も曲の一覧の flowPlacement も無ければ、--no-flow を付けたときと1バイトも同じ譜面になる(公開中の曲は作り直さない・⑩-2)
// ② --flow を付けると効く(同じ曲で譜面が変わり、流れの割合が下がらない)
// ③ 曲の一覧(rhythm-song-registry.json)で、流れの配置より前(Rev.31 以下)の曲に flowPlacement を書いていない(書くのは新曲だけ)
// ④ 数え方は rhythm-chart-flow-report.js と生成器で同じ区切り(半拍以内・1.6レーン・3.5レーン)
'use strict';
const fs=require('fs'),path=require('path');
const {generate,flowStats}=require('./rhythm-chart-flow-report.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const gen=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
ok('既定は切(--flow か曲の一覧の flowPlacement:true のときだけ効く)',/let FLOW_ON=process\.argv\.includes\('--flow'\)&&!process\.argv\.includes\('--no-flow'\);/.test(gen)
  &&/entry&&entry\.flowPlacement===true&&!process\.argv\.includes\('--no-flow'\)\)FLOW_ON=true/.test(gen));
ok('流れの費用は FLOW_ON のときだけ足す',/const flow=FLOW_ON&&!attempt\.fromMemory&&!attempt\.fromCopy\?flowCostFor\(placed,trial\):0;/.test(gen));
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8'));
// 曲の一覧は {songs:{<音源のid>:{...}}} の形
const songs=registry&&registry.songs&&typeof registry.songs==='object'?registry.songs:{};
const flagged=Object.entries(songs).filter(([,e])=>e&&e.flowPlacement===true).map(([id])=>id);
ok('曲の一覧を読めた',Object.keys(songs).length>10,`${Object.keys(songs).length}曲`);
// 流れの配置より前の曲 = Rev.31 以下で作った曲(2026-10-21 に流れの配置を足したとき、公開中の曲はどれも Rev.31 以下だった)。
// 新曲は Rev.32 以上で作るので、公開したあともここには入らない
const FLOW_FIRST_REVISION=32;
const older=new Set(Object.entries(songs).filter(([,e])=>!(Number(e&&e.chartRevision)>=FLOW_FIRST_REVISION)).map(([id])=>id));
ok('前からある曲(Rev.31 以下)には flowPlacement を書いていない(書くのは新曲だけ)',flagged.filter(id=>older.has(id)).length===0,flagged.join(' ')||'なし');
// ①② 実際に作って比べる(短い曲の HARD・書き込みなし)
const track='toriko',diff='HARD';
const plain=generate(track,diff,0,false);
const defaultRun=(()=>{const os=require('os'),{spawnSync}=require('child_process');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-flow-'));
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',track,'--difficulty',diff,'--output-dir',dir,'--write'],{encoding:'utf8',maxBuffer:64*1024*1024});
  const text=r.status===0?fs.readFileSync(path.join(dir,`${track}-v3-chart-${diff.toLowerCase()}.json`),'utf8'):'';fs.rmSync(dir,{recursive:true,force:true});return text?JSON.parse(text):null;})();
ok(`指定なしは --no-flow と1バイトも同じ(${track} ${diff})`,!!defaultRun&&JSON.stringify(defaultRun.notes)===JSON.stringify(plain.notes),defaultRun?`${defaultRun.notes.length}ノーツ`:'作れなかった');
const flowed=generate(track,'MASTER',0,true),flowOff=generate(track,'MASTER',0,false);
const a=flowStats(flowOff.notes,4),b=flowStats(flowed.notes,4);
ok(`--flow を付けると譜面が変わり、流れの割合が下がらない(${track} MASTER)`,JSON.stringify(flowed.notes)!==JSON.stringify(flowOff.notes)&&b.flowRatio>=a.flowRatio,`流れ ${(a.flowRatio*100).toFixed(1)}% → ${(b.flowRatio*100).toFixed(1)}%・跳び ${a.jump} → ${b.jump}`);
ok('数え方の区切りが生成器と同じ(半拍以内・1.6レーン・3.5レーン)',/FLOW_FAST_GRIDS=BEAT\/2/.test(gen)&&/Math\.abs\(d\)<=1\.6/.test(gen)&&/Math\.abs\(d\)<=3\.5/.test(gen));
console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);
