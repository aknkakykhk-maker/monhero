const { chromium } = require('playwright');
const path = require('path');
const S = process.argv[2];
const css = `file://${S}/fonts/package/900.css`;
const css7 = `file://${S}/fonts/package/700.css`;
const base = `body{margin:0;background:transparent;font-family:'Zen Maru Gothic';-webkit-font-smoothing:antialiased}
.wrap{width:720px;display:flex;justify-content:center;align-items:center;text-align:center}
.sub{color:#fffaf0;font-weight:900;font-size:44px;line-height:1.35;letter-spacing:.04em;
 text-shadow:0 0 3px #0a1030,0 0 3px #0a1030,0 2px 6px #0a1030,0 0 18px rgba(10,16,48,.9),0 0 34px rgba(10,16,48,.7)}`;
const items = {
  s1:`<div class="wrap" style="height:220px"><div class="sub">雪の山の上の、<br>小さなペンション。</div></div>`,
  band:`<div class="wrap" style="height:110px"><div style="font-weight:700;font-size:28px;color:#fff;letter-spacing:.12em;padding:10px 30px;border-top:2px solid #e9c46a;border-bottom:2px solid #e9c46a;background:linear-gradient(90deg,rgba(120,20,30,0),rgba(120,20,30,.85),rgba(120,20,30,0));text-shadow:0 2px 4px #300">雪山のペンション シュプール</div></div>`,
  s2:`<div class="wrap" style="height:220px"><div class="sub">イチーカから届いた、<br>クリスマスの招待状。</div></div>`,
  card:`<div style="width:560px;height:400px;display:flex;align-items:center;justify-content:center">
   <div style="width:500px;height:340px;box-sizing:border-box;border-radius:14px;background:radial-gradient(circle at 50% 40%,#fffaf0,#f3e3c3);box-shadow:0 10px 30px rgba(0,0,0,.6);border:6px double #b8892b;padding:26px 30px;text-align:center;color:#5a1a1a;position:relative">
    <div style="font-weight:900;font-size:40px;letter-spacing:.3em;color:#8e1b24">招待状</div>
    <div style="height:2px;background:linear-gradient(90deg,transparent,#b8892b,transparent);margin:10px 30px 16px"></div>
    <div style="font-weight:700;font-size:25px;line-height:1.6">山の上のペンション・シュプールで<br>クリスマス会をひらきます。<br>どうぞ、仮装をしておこしください。</div>
    <div style="font-weight:700;font-size:22px;margin-top:14px;text-align:right;color:#2a5a7a">オーナー　イチーカ</div>
    <div style="position:absolute;left:18px;top:14px;font-size:30px">🎄</div><div style="position:absolute;right:18px;top:14px;font-size:30px">❄</div>
   </div></div>`,
  s3:`<div class="wrap" style="height:220px"><div class="sub">みんなで過ごす、<br>たのしいクリスマス。</div></div>`,
  s3b:`<div class="wrap" style="height:140px"><div class="sub" style="font-size:40px">……の、はずだった。</div></div>`,
  s4:`<div class="wrap" style="height:220px"><div class="sub">からっぽになった、<br>プレゼントの箱。</div></div>`,
  v1:`<div class="wrap" style="height:150px"><div class="sub">仲間が、ひとり、</div></div>`,
  v2:`<div class="wrap" style="height:150px"><div class="sub">またひとり――。</div></div>`,
  stamp:`<div style="width:220px;height:110px;display:flex;align-items:center;justify-content:center"><div style="font-weight:900;font-size:34px;color:#e0262f;border:6px solid #e0262f;border-radius:12px;padding:4px 12px;letter-spacing:.06em;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 2px rgba(224,38,47,.4)">ゆくえ不明</div></div>`,
  s5:`<div class="wrap" style="height:220px"><div class="sub">窓の外に、<br>黒い影――。</div></div>`,
  s6a:`<div class="wrap" style="height:170px"><div class="sub" style="font-size:84px;letter-spacing:.08em">名探偵は、</div></div>`,
  s6b:`<div class="wrap" style="height:170px"><div class="sub" style="font-size:96px;letter-spacing:.1em;color:#ffe08a">だれだ。</div></div>`,
  s7:`<div class="wrap" style="height:200px;flex-direction:column"><div class="sub" style="font-size:30px;letter-spacing:.2em">クリスマスイベント</div><div class="sub" style="font-size:62px;color:#ffe08a;letter-spacing:.02em">11/30(月) 10:00 開幕</div></div>`,
};
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage({viewport:{width:720,height:400},deviceScaleFactor:1});
  for (const [k,h] of Object.entries(items)) {
    require('fs').writeFileSync(path.join(S,'work','_t.html'),`<html><head><link rel="stylesheet" href="${css}"><link rel="stylesheet" href="${css7}"><style>${base}</style></head><body>${h}</body></html>`); await p.goto('file://'+path.join(S,'work','_t.html'));
    await p.evaluate(()=>document.fonts.ready);
    await p.waitForTimeout(300);
    const el = await p.$('body > div');
    await el.screenshot({path:path.join(S,'txt',k+'.png'),omitBackground:true});
  }
  await b.close();
})();
