// ゲームソフトのカットの部品(小包・ソフト・古いテレビの起動画面)を透過PNGにする
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const S = process.argv[2];
const head = `<link rel="stylesheet" href="file://${S}/fonts/package/900.css"><link rel="stylesheet" href="file://${S}/fonts/package/700.css"><link rel="stylesheet" href="file://${S}/fonts2/package/800.css"><link rel="stylesheet" href="file://${S}/fonts2/package/500.css">
<style>body{margin:0;background:transparent;-webkit-font-smoothing:antialiased}.mc{font-family:'Shippori Mincho B1',serif}.mg{font-family:'Zen Maru Gothic'}</style>`;
const items = {
 parcel: [520, 420, `<div style="width:520px;height:420px;display:flex;align-items:flex-end;justify-content:center">
  <div style="position:relative;width:440px;height:300px;border-radius:6px;background:linear-gradient(160deg,#c49a63 0%,#a97b45 55%,#7d5730 100%);box-shadow:0 30px 50px rgba(0,0,0,.65),inset 0 2px 0 rgba(255,235,200,.35),inset 0 -14px 30px rgba(60,35,10,.45)">
   <div style="position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0 3px,rgba(0,0,0,.03) 3px 7px)"></div>
   <div style="position:absolute;left:0;right:0;top:-34px;height:46px;background:linear-gradient(180deg,#d6ad74,#b48550);transform:perspective(500px) rotateX(38deg);border-radius:4px;box-shadow:inset 0 -6px 10px rgba(60,35,10,.35)"></div>
   <div style="position:absolute;left:206px;top:-30px;bottom:0;width:10px;background:linear-gradient(90deg,#e8dcc2,#b9a780);box-shadow:0 0 3px rgba(0,0,0,.4)"></div>
   <div style="position:absolute;top:150px;left:0;right:0;height:9px;background:linear-gradient(180deg,#e8dcc2,#b9a780);box-shadow:0 0 3px rgba(0,0,0,.4)"></div>
   <div class="mg" style="position:absolute;left:250px;top:40px;width:160px;padding:10px 12px;background:#f4efe2;color:#3a2a1a;font-weight:700;font-size:15px;line-height:1.7;transform:rotate(3deg);box-shadow:0 3px 6px rgba(0,0,0,.35)">
     <div style="border-bottom:1px solid #9a8a70">おとどけもの</div><div>差出人：<span style="color:#9a8a70">――</span></div></div>
   <div class="mc" style="position:absolute;left:40px;top:190px;padding:2px 10px;border:3px solid rgba(150,20,25,.8);color:rgba(150,20,25,.85);font-weight:800;font-size:22px;transform:rotate(-8deg)">われもの注意</div>
  </div></div>`],
 cart: [340, 440, `<div style="width:340px;height:440px;display:flex;align-items:center;justify-content:center">
  <div style="position:relative;width:280px;height:380px;border-radius:10px;background:linear-gradient(160deg,#20242f,#0c0e14);box-shadow:0 24px 40px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.18)">
   <div style="position:absolute;left:14px;right:14px;top:14px;bottom:52px;border-radius:4px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#4a1218,#1a0508 70%);box-shadow:inset 0 0 30px rgba(0,0,0,.8)">
     <div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.15) 0 2px,transparent 2px 4px)"></div>
     <div style="position:absolute;left:84px;top:30px;width:84px;height:84px;border-radius:50%;background:radial-gradient(circle,#f3e6c4,#c9a86a);box-shadow:0 0 0 4px #6b4a22,0 0 18px rgba(255,190,90,.45)"><div class="mc" style="position:absolute;left:0;right:0;top:8px;text-align:center;color:#3a1a10;font-weight:800;font-size:17px">XIII</div><div style="position:absolute;left:40px;top:30px;width:4px;height:14px;background:#3a1a10;border-radius:2px"></div><div style="position:absolute;left:40px;top:40px;width:22px;height:4px;background:#3a1a10;border-radius:2px;transform:rotate(30deg);transform-origin:left center"></div><div style="position:absolute;left:38px;top:38px;width:8px;height:8px;border-radius:50%;background:#7a1a14"></div></div>
     <div class="mc" style="position:absolute;left:0;right:0;top:150px;text-align:center;color:#f1e2c0;font-weight:800;font-size:40px;letter-spacing:.06em;text-shadow:0 2px 0 #000,0 0 12px rgba(200,40,40,.7)">モンヒロ<br>事件簿</div>
     <div class="mc" style="position:absolute;left:0;right:0;top:262px;text-align:center;color:#c9a46a;font-weight:500;font-size:15px;letter-spacing:.04em">―呪いのセーブデータ―</div>
   </div>
   <div style="position:absolute;left:30px;right:30px;bottom:16px;height:20px;border-radius:3px;background:repeating-linear-gradient(90deg,#3a3f4c 0 6px,#1b1e26 6px 12px)"></div>
   <div style="position:absolute;inset:0;border-radius:10px;background:linear-gradient(120deg,rgba(255,255,255,.12),transparent 35%)"></div>
  </div></div>`],
 crt: [640, 480, `<div style="width:640px;height:480px;position:relative;background:radial-gradient(circle at 50% 45%,#1c0a0d,#050203 75%);overflow:hidden">
   <div class="mc" style="position:absolute;left:0;right:0;top:110px;text-align:center;color:#efe0bd;font-weight:800;font-size:74px;letter-spacing:.03em;line-height:1;white-space:nowrap;text-shadow:3px 0 0 rgba(255,0,40,.45),-3px 0 0 rgba(0,200,255,.35),0 0 22px rgba(220,40,40,.6)">モンヒロ事件簿</div>
   <div class="mc" style="position:absolute;left:0;right:0;top:214px;text-align:center;color:#c9a46a;font-weight:500;font-size:34px;letter-spacing:.08em;text-shadow:0 0 10px rgba(200,150,80,.5)">―呪いのセーブデータ―</div>
   <div style="position:absolute;left:150px;right:150px;top:272px;height:2px;background:linear-gradient(90deg,transparent,#8a6a3a,transparent)"></div></div>`],
 crt_sub: [640, 80, `<div class="mc" style="width:640px;height:80px;display:flex;align-items:center;justify-content:center;color:#ff5a52;font-weight:800;font-size:46px;letter-spacing:.3em;text-shadow:0 0 14px rgba(255,40,30,.8)">十三番目の鐘</div>`],
 crt_press: [640, 50, `<div class="mg" style="width:640px;height:50px;display:flex;align-items:center;justify-content:center;color:#e8e2d0;font-weight:700;font-size:24px;letter-spacing:.3em">PRESS START</div>`],
 tv: [720, 620, `<div style="width:720px;height:620px;position:relative">
   <div style="position:absolute;left:250px;top:560px;width:220px;height:50px;background:linear-gradient(#24201c,#100e0c);clip-path:polygon(12% 0,88% 0,100% 100%,0 100%)"></div>
   <div style="position:absolute;left:40px;top:40px;width:640px;height:480px;border-radius:28px;box-shadow:0 0 0 6px #0b0a09,0 0 0 26px #2f2925,0 0 0 30px #1a1714,0 30px 60px 30px rgba(0,0,0,.55),inset 0 0 40px 8px rgba(0,0,0,.85)"></div>
   <div style="position:absolute;left:300px;top:534px;width:120px;height:8px;border-radius:4px;background:#0e0c0b"></div>
   <div style="position:absolute;left:610px;top:531px;width:12px;height:12px;border-radius:50%;background:#e03a2a;box-shadow:0 0 10px #ff4a30"></div></div>`],
 g1: [720, 160, `<div class="mg" style="width:720px;height:160px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fffaf0;font-weight:900;font-size:42px;line-height:1.35;letter-spacing:.04em;text-shadow:0 0 3px #0a1030,0 0 3px #0a1030,0 2px 6px #0a1030,0 0 18px rgba(10,16,48,.9)">差出人のない小包に、<br>古いゲームソフト。</div>`],
};
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 720, height: 700 } });
  for (const [k, [w, h, html]] of Object.entries(items)) {
    const f = path.join(S, 'work', '_g.html'); fs.writeFileSync(f, `<html><head>${head}</head><body>${html}</body></html>`);
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(S, 'txt', k + '.png'), clip: { x: 0, y: 0, width: w, height: h }, omitBackground: true });
  }
  await b.close();
})();
