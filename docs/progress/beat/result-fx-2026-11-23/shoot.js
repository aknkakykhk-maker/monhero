// 案の止め絵を撮る: node docs/progress/beat/result-fx-2026-11-23/shoot.js
// mock.html を案・向きごとに開き、コマごとに動きを止めて1枚に撮る(台帳 r1119-143)
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const dir=__dirname;
for(const p of ['Now','A','B','C'])for(const o of ['tate','yoko']){
  const pg=await b.newPage({viewport:{width:o==='tate'?1060:1960,height:600},deviceScaleFactor:2});
  await pg.goto('file://'+path.join(dir,'mock.html')+`?p=${p}&o=${o}`);
  await pg.evaluate(()=>window.freeze());await pg.waitForTimeout(150);
  const out=path.join(dir,`${p==='Now'?'now':'an-'+p.toLowerCase()}-${o}.jpg`);
  await pg.screenshot({path:out,fullPage:true,type:'jpeg',quality:85});console.log(out);await pg.close();}
await b.close();})();
