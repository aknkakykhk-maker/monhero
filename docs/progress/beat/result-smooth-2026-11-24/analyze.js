// count-log.json を読んで、コマごとの増え方を数える。 node analyze.js before-yoko.json
const log=JSON.parse(require('fs').readFileSync(process.argv[2],'utf8'));
const num=s=>Number(String(s||'').replace(/,/g,''))||0;
const dts=log.slice(1).map((r,i)=>r.t-log[i].t);
const anim=log.filter(r=>r.anim==='1');
console.log(`コマ ${log.length} / 数えている間 ${anim.length} コマ / コマの間隔 平均 ${(dts.reduce((a,b)=>a+b,0)/dts.length).toFixed(1)}ms 最大 ${Math.max(...dts).toFixed(1)}ms / 25ms超 ${dts.filter(d=>d>25).length}回`);
const series=(name,get,wget)=>{
  const v=log.map(r=>num(get(r)));const last=v[v.length-1];
  let changes=0,still=0,maxJump=0,first=-1,lastI=-1;const steps=[];
  for(let i=1;i<v.length;i++){const d=v[i]-v[i-1];if(d!==0){changes++;steps.push(d);maxJump=Math.max(maxJump,d);if(first<0)first=i;lastI=i;}}
  const active=lastI>first?lastI-first+1:0;
  // 動いている間で、数字が変わらないコマ(止まって見える)
  for(let i=first+1;i<=lastI;i++)if(v[i]===v[i-1])still++;
  const ws=wget?log.map(wget).filter(Boolean):[];const rights=new Set(ws.map(w=>w[1]));
  console.log(`${name}: 最後 ${last} / 動いた ${active} コマ(${first>=0?log[first].t:'-'}〜${lastI>=0?log[lastI].t:'-'}ms) / 変わった ${changes} 回・止まったコマ ${still} / 1コマの最大の増え ${maxJump}${last?`(${(maxJump/last*100).toFixed(1)}%)`:''}${wget?` / 右端の位置 ${rights.size}種`:''}`);
  return {v,first,lastI};
};
series('スコア',r=>r.score,r=>r.sw);
const n=(log[0].rows||[]).length;
for(let k=0;k<n;k++)series(`判定${k}`,r=>r.rows[k],r=>r.rw&&r.rw[k]);
series('MAX COMBO',r=>r.combo);
if(process.argv[3]==='--score'){const v=log.map(r=>num(r.score));console.log(log.map((r,i)=>`${r.t}:${v[i]}`).join(' '));}
