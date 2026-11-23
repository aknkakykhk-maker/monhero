// 止め絵を撮る: node docs/progress/beat/sky-slide-color-2026-11-23/shoot.js(台帳 r1119-149)
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1880,height:900},deviceScaleFactor:2});
await pg.goto('file://'+path.join(__dirname,'mock.html'));await pg.waitForTimeout(200);
const out=path.join(__dirname,'compare.jpg');await pg.screenshot({path:out,fullPage:true,type:'jpeg',quality:85});console.log(out);await b.close();})();
