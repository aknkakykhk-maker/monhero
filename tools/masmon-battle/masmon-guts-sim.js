#!/usr/bin/env node
// マスモンの対戦のガッツの回復の候補を見くらべる試算(2026-11-13 バトル部・社長「移動を増やし、種の差も広げる」「回復が速い種ほど与ダメを少し下げる」)
//   node tools/masmon-battle/masmon-guts-sim.js <戦数> '移動,ためる,回復の下,回復の上,与ダメの補正' ...
//   例: node tools/masmon-battle/masmon-guts-sim.js 3000 '10,22,10,10,0' '10,22,7,13,0.1'
//   --grades を付けると、種を7段の等級(G〜A)に分けた表で回す
// 芯の定数だけを差し替えた写しで、同じ能力・種だけ違う1対1を左右入れ替えて回す。
//   「速い種の勝率」= 回復が速い側(いまの芯の並びで決める)の勝率。「差4以上」は回復の幅を 0〜6 にならした目盛りで4以上離れた組。'…,10,10,0'(回復の差なし)の値が種そのものの強さ
'use strict';
const fs=require('fs'),path=require('path');
const W=path.resolve(__dirname,'..','..'); const N=Number(process.argv[2])||2000; const cfgs=process.argv.slice(3).filter((x)=>x!=='--grades');
const os=require('os'); const SIMDIR=fs.mkdtempSync(path.join(os.tmpdir(),'mgs-'));
const { load, makeUnit } = require(path.join(W,'tools/masmon-battle/load.js'));
const { data, engine: e0 } = load();
// --grades: 種を基礎ガッツの順に7つに分け、等級 G〜A の表を渡して回す(社長の等級の資料が届くまでの見立て)
if (process.argv.includes('--grades')) {
  const ids = Object.keys(data.ALL_PLAYER_MONSTERS).sort((a, b) => (data.ALL_PLAYER_MONSTERS[a].baseGuts || 0) - (data.ALL_PLAYER_MONSTERS[b].baseGuts || 0));
  data.ASSISTANT_MASMON_GUTS_REGEN = Object.fromEntries(ids.map((id, i) => [id, 'GFEDCBA'[Math.min(6, Math.floor(i / ids.length * 7))]]));
} const REF0=e0.buildCatalog(data).species; const REF={}; // 速い・遅いの並び(芯の幅を 0〜6 の目盛りにそろえる。「差4以上」はこの目盛りで)
for (const k of Object.keys(REF0)) REF[k]={ regen: Math.round((REF0[k].regen-e0.GUTS_REGEN_MIN)/(e0.GUTS_REGEN_MAX-e0.GUTS_REGEN_MIN)*6) };
const src=fs.readFileSync(path.join(W,'monster-hero/data/assistant-masmon-battle.js'),'utf8');
for (const c of cfgs){
  const [mv,ch,mn,mx,sw]=c.split(',').map(Number);
  let t=src.replace(/const GUTS_MOVE = \d+;/,`const GUTS_MOVE = ${mv};`).replace(/const GUTS_CHARGE = \d+;/,`const GUTS_CHARGE = ${ch};`)
    .replace(/const GUTS_REGEN_MIN = \d+;/,`const GUTS_REGEN_MIN = ${mn};`).replace(/const GUTS_REGEN_MAX = \d+;/,`const GUTS_REGEN_MAX = ${mx};`)
    .replace(/const REGEN_DMG_SWING = [\d.]+;/,`const REGEN_DMG_SWING = ${sw};`);
  const f=path.join(SIMDIR,`e-${c.replace(/[,.]/g,'_')}.js`); fs.writeFileSync(f,t);
  const engine=require(f); const catalog=engine.buildCatalog(data);
  const ids=Object.keys(catalog.species); const rng=engine.makeRng('g-'+c);
  let fastW=0,fastN=0,big=0,bigN=0; const act={tech:0,move:0,guard:0,charge:0,sulk:0}; let rounds=0,judge=0,games=0,margin=0;
  for(let i=0;i<N;i++){
    let a=ids[Math.floor(rng()*ids.length)], b=ids[Math.floor(rng()*ids.length)];
    const ra=REF[a].regen, rb=REF[b].regen; if(ra===rb) {i--;continue;}
    const ua=makeUnit(engine,catalog,rng,{species:a}); const ub={...makeUnit(engine,catalog,rng,{species:b}),stats:{...ua.stats},lv:ua.lv};
    for(const sw2 of [0,1]){
      const A=sw2?ub:ua,B=sw2?ua:ub;
      const r=engine.simulate({seed:`g${i}-${sw2}`,catalog,teamA:{assistantId:'atsu',tactics:50,members:[A]},teamB:{assistantId:'atsu',tactics:50,members:[B]}});
      games++; rounds+=r.rounds; if(r.reason==='judge')judge++;
      const fastSide = (REF[A.species].regen>REF[B.species].regen)?'A':'B';
      if(r.winner!=='draw'){fastN++; if(r.winner===fastSide)fastW++;}
      if(Math.abs(ra-rb)>=4 && r.winner!=='draw'){bigN++; if(r.winner===fastSide)big++;}
      for(const e of r.log){ if(e.ev==='tech')act.tech++; else if(e.ev==='move')act.move++; else if(e.ev==='guard')act.guard++; else if(e.ev==='charge') (e.why==='sulk'?act.sulk++:act.charge++);}
      const fin=r.final||{}; 
    }
  }
  const tot=Object.values(act).reduce((x,y)=>x+y,0); const pc=(x)=>(x*100).toFixed(1)+'%';
  console.log(`${c.padEnd(18)} 速い種の勝率 ${pc(fastW/fastN)} (差4以上 ${pc(big/bigN)}) | 技${pc(act.tech/tot)} 移動${pc(act.move/tot)} ガード${pc(act.guard/tot)} ためる${pc(act.charge/tot)} | 平均${(rounds/games).toFixed(1)}R 判定${pc(judge/games)}`);
}
