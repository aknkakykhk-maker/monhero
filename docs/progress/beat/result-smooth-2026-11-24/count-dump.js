// 結果の画面が出たら4秒待って、count-recorder.js の記録を JSON に書き出す。出す先は COUNT_OUT(既定 ./count-log.json)
// COUNT_CPU=4 … 結果が出た直後から CPU を4倍遅くする(遅い端末の代わり。数え上げは出てから 0.3 秒後に始まる)
const fs=require('fs');
module.exports=async page=>{
  const rate=Number(process.env.COUNT_CPU)||0;
  const cdp=await page.context().newCDPSession(page);
  if(rate>1)await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const prof=!!process.env.COUNT_PROF;
  if(prof){await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:200});await cdp.send('Profiler.start');}
  const m0=await metrics();
  await page.waitForTimeout(3000);
  const m1=await metrics();
  if(prof){const {profile}=await cdp.send('Profiler.stop');const self=new Map();const dt=profile.timeDeltas||[];const byId=new Map(profile.nodes.map(n=>[n.id,n]));
    (profile.samples||[]).forEach((id,i)=>{const n=byId.get(id);const f=n.callFrame;const k=`${f.functionName||'(無名)'} ${String(f.url).split('/').pop()}:${f.lineNumber}`;self.set(k,(self.get(k)||0)+(dt[i]||0));});
    console.log('重い所(自分の時間 ms):\n'+[...self].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>`  ${(v/1000).toFixed(0)} ${k}`).join('\n'));}
  const keys=['TaskDuration','ScriptDuration','RecalcStyleDuration','LayoutDuration','LayoutCount','RecalcStyleCount'];
  console.log('3秒の内訳(秒・回): '+keys.map(k=>`${k}=${(m1[k]-m0[k]).toFixed(3)}`).join(' '));
  await page.waitForTimeout(1200);
  const log=await page.evaluate(()=>window.__mhCountLog||[]);
  const out=process.env.COUNT_OUT||'count-log.json';
  fs.writeFileSync(out,JSON.stringify(log));
  console.log(`記録 ${log.length} コマ → ${out}`);
};
