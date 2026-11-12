const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1260,height:1000},deviceScaleFactor:1});
await p.goto('file://'+__dirname+'/mock.html');await p.waitForTimeout(500);
const rows=await p.$$('.row');const names=['A','B','C'];
for(let i=0;i<3;i++)await rows[i].screenshot({path:__dirname+'/png-'+names[i]+'.png'});
await b.close()})();
