// shots/ のコマを、案ごと・向きごとに1枚へ並べる: node docs/progress/beat/result-count-2026-11-24/compose.js
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const dir=__dirname,shots=process.env.SHOTS||path.join(dir,'shots');
const NAME={now:'今(#7390)',A:'案A 判定が1行ずつ決まる',B:'案B スロットの桁止め',C:'案C 光のステージ'};
const NOTE={now:'全部の数字が同時に0から数え上がる(1.2秒)',A:'上の行から1行ずつ数えて「カチッ」→ スコアが積み上がる → MAX COMBO → じゃん(約2.5秒)',
  B:'スコアの桁がスロットのように回り、左の桁から1つずつ止まって金色に光る → 光が横切り輪が広がる(約1.8秒)',
  C:'札の後ろで光の筋が回り、判定の表を光がなでる → 決まる瞬間に白く光って衝撃の輪と金の粒、はんこで画面が揺れる(約1.8秒)'};
(async()=>{const b=await chromium.launch();
for(const o of ['yoko','tate']){
  const files=fs.readdirSync(shots).filter(f=>f.endsWith(`-${o}-`+f.split('-').pop())&&f.includes(`-${o}-`));
  for(const p of Object.keys(NAME)){
    const list=files.filter(f=>f.startsWith(p+'-')).sort((a,c)=>parseInt(a.split('-').pop())-parseInt(c.split('-').pop()));
    const w=o==='yoko'?844:390,cols=o==='yoko'?2:5,sc=o==='yoko'?.62:.62;
    const html=`<body style="margin:0;background:#0b1020;color:#e2e8f0;font:700 15px system-ui;padding:12px"><div style="font-size:20px;font-weight:900">${NAME[p]}(${o==='yoko'?'横 844×390':'縦 390×844'})</div><div style="margin:4px 0 10px;color:#a5b4fc">${NOTE[p]}</div>
      <div style="display:grid;grid-template-columns:repeat(${cols},${Math.round(w*sc)}px);gap:10px">${list.map(f=>`<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(path.join(shots,f)).toString('base64')}" style="width:100%;border:1px solid #334155;border-radius:6px"><figcaption style="color:#fde68a">${parseInt(f.split('-').pop())} ms</figcaption></figure>`).join('')}</div></body>`;
    const pg=await b.newPage({viewport:{width:cols*Math.round(w*sc)+(cols-1)*10+24,height:300},deviceScaleFactor:1.5});
    await pg.setContent(html);await pg.waitForTimeout(300);
    const out=path.join(dir,`${p==='now'?'now':'an-'+p.toLowerCase()}-${o}.jpg`);await pg.screenshot({path:out,fullPage:true,type:'jpeg',quality:82});console.log(out);await pg.close();}}
await b.close();})();
