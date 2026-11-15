#!/usr/bin/env node
// r1115-176 修行のアシスト3種(修行効果アップ・修行特別効果アップ・技習得効果アップ)の、修行1回の能力の上がりを実際の処理で出す。
//   node tools/success/monsuc-shugyo-assist-cmp.js [芯のファイル] [アシストの表]   … 省くといまの main。JSON を出す(前後の比較は前の版の写しを渡す)
'use strict';
const { loadDeps, depsFor } = require('./load');
const path = require('path'); const ROOT = path.join(__dirname, '..', '..'); const core = path.resolve(process.argv[2] || path.join(ROOT, 'monster-hero/data/monhero-success.js')); const assist = path.resolve(process.argv[3] || path.join(ROOT, 'monster-hero/data/monhero-success-assist.js'));
const AT = require(assist);
const SUC = require(core).create(depsFor(loadDeps(), { assist: AT }));
const K=['pow','tough','life','wise','hit','eva'];
const A4={pow:550,tough:420,life:350,wise:250,hit:300,eva:280};
const B4={hit:550,eva:420,wise:350,pow:250,tough:300,life:280};
const SP=['Undine','Mocchi','Golem','Pixie','Tiger','Kyubi'];
const MAX3=[{id:'shugyo',n:AT.BY_ID.shugyo.max},{id:'shugyotoku',n:AT.BY_ID.shugyotoku.max},{id:'wazakazu',n:AT.BY_ID.wazakazu.max}];
const mem=(i,st,as)=>({kind:'raised',species:SP[i],name:'仲間'+(i+1),stats:{...st},lv:30,loy:80,pop:55,techs:SUC.techsOf(SP[i]).slice(0,4).map(t=>t.id),assists:as});
const SPEC='Kyubi';
const prep=(team,{techs=6,hachi=true}={})=>{
  const s=SUC.newRun({id:'c176',species:SPEC,aid:'mua',team,aidBondLv:1});
  const all=SUC.techsOf(SPEC).map(t=>t.id); s.techs=all.slice(0,techs); s.mastery=Object.fromEntries(s.techs.map(t=>[t,30])); s.techPick=null;
  K.forEach(k=>{s.stats[k]=300;}); s.hp=s.hpMax; s.stress=0; s.tickets=10; s.superLeft=2;
  if(hachi) s.good={...(s.good||{}),shugyoGood:true};
  return s;
};
const shu=(s,sup)=>{ const ids=SUC.peek(s).shugyo.techs.map(t=>t.id); const x=SUC.act(JSON.parse(JSON.stringify(s)),{kind:'shugyo',course:'ice',techs:sup?ids.slice(0,2):ids.slice(0,1)});
  if(!x.out.ok) return {ng:x.out.why}; const g={}; K.forEach(k=>g[k]=x.state.stats[k]-s.stats[k]); g.sum=K.reduce((a,k)=>a+g[k],0);
  g.mastery=x.state.techs.filter(t=>s.techs.includes(t)).reduce((a,t)=>a+x.state.mastery[t]-s.mastery[t],0); return g; };
const out={};
out.four={ normal: shu(prep(SP.map((_,i)=>mem(i,A4,MAX3)))) };
const six=SP.map((_,i)=>mem(i,i%2?B4:A4,MAX3));
out.six={ normal: shu(prep(six)), super: shu(prep(six),true) };
out.four.super=shu(prep(SP.map((_,i)=>mem(i,A4,MAX3))),true);
out.first={ normal: shu(prep([],{techs:2,hachi:false})) };          // 初回育成(ベースモン・アシストなし)
out.noAssist={ normal: shu(prep(SP.map((_,i)=>mem(i,A4,[])))) };      // 強い仲間・修行アシストなし
out.one={ normal: shu(prep(SP.map((_,i)=>mem(i,A4,i===0?MAX3:[])))) }; // 特化1体
// 1目盛り目・途中の目盛りの効き(説明と実際)
out.steps={}; ['shugyo','shugyotoku','wazakazu'].forEach(id=>{ const a=AT.BY_ID[id]; out.steps[id]={v:a.v.slice(), desc:[1,Math.ceil(a.max/2),a.max].map(n=>AT.describe(id,n))}; if(a.mv) out.steps[id].mv=a.mv.slice(); });
// トレーニング・全員集合: 同じ乱数で8回。修行アシストを持つ仲間の編成で
const trainSeq=(team)=>{ let s=prep(team); s.id='tr176'; const log=[]; for(let i=0;i<8;i++){ const x=SUC.act(s,{kind:'train',stat:K[i%6]}); s=x.state; log.push([x.out.ok,x.out.result||'',K.map(k=>s.stats[k]).join(',')]); s=SUC.endTurn(s).state; } return {log, mastery:s.mastery}; };
out.train=trainSeq(SP.map((_,i)=>mem(i,A4,MAX3)));
console.log(JSON.stringify(out));
