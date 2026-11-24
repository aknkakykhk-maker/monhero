// 紹介動画「HELL の見どころ(ステージ)」の冒頭(0〜33.6秒)を、見本と同じ場面順・構図・切り替えの時刻で作り直す(2026-11-24 r1119-159 追記2・第3版)。
// beat-stage-build.js から呼ぶ(plan.intro があるとき)。見本の冒頭は低い細かさの画面を引き伸ばしていたので、
//   ・文字は 720×1280 の完成の大きさで描く(書体は build と同じ Noto Serif JP / Noto Sans JP)
//   ・絵は公開済みの元画像から置く(本オープンの集合絵 images/events/rhythm-grand-open-teaser.jpg・助手の絵・マスモンの絵)
//   ・ゲームの画面は撮り直した物(マルチの部屋と結果: beat-stage-multi-shots.js / 記念ステージの演奏: beat-stage-capture.js)
//   ・寄り(ズームイン・アウト)は使わない。動きは幕・照明・文字に走る光・場面の押し出し(見本と同じ時刻)だけ
// 時刻 t ごとに HTML の見た目を決めて1コマずつ撮り、ffmpeg へ流す(60fps)。音は見本の冒頭のまま(build が重ねる)
const path = require('path'), fs = require('fs');
const { spawn } = require('child_process');

// 見本から測った時刻(秒)。切り替えは [始まり, 終わり]
const TL = {
  curtainOpen: [1.55, 3.4], titleIn: [2.9, 3.35], headIn: [3.15, 3.55],
  toRoom: [7.45, 7.85], toResult: [10.45, 10.8], toDuo: [14.7, 15.05], toStage: [19.62, 20.0], toGift: [25.35, 25.7], toMasu: [29.25, 29.5],
  sweeps: [[3.55, 4.35], [5.75, 6.55], [12.2, 12.9], [17.0, 17.7], [27.2, 27.9], [31.2, 31.9]],
};

const html = ({ fontsHead, file, plan }) => {
  const I = plan.images;
  const f = (p) => file(p);
  return `<!doctype html><html><head><meta charset="utf-8">${fontsHead}<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:720px;height:1280px;overflow:hidden;background:#0b0c1c}
body{position:relative;font-family:'Noto Sans JP',sans-serif;color:#f5efe0;-webkit-font-smoothing:antialiased}
.sc{position:absolute;left:0;top:0;width:720px;height:1280px;overflow:hidden;will-change:transform,opacity}
.abs{position:absolute;white-space:nowrap}
.mincho{font-family:'Noto Serif JP',serif;font-weight:700}
.latin{font-family:'Liberation Serif','Noto Serif JP',serif;font-weight:400}
.shine{position:absolute;white-space:nowrap;color:transparent;-webkit-background-clip:text;background-clip:text;
  background-image:linear-gradient(100deg,rgba(255,255,255,0) 42%,rgba(255,255,255,.95) 50%,rgba(255,255,255,0) 58%);background-size:320% 100%;background-repeat:no-repeat}
.blurbg{position:absolute;left:-60px;top:-60px;width:840px;height:1400px;object-fit:cover;filter:blur(22px) brightness(.34) saturate(1.15)}
.band{position:absolute;left:0;width:720px;overflow:hidden}
.band img{position:absolute;display:block}
.star{position:absolute;width:3px;height:3px;border-radius:50%;background:#fff}
.cap-k{font-size:21px;font-weight:700;letter-spacing:.06em;line-height:1}
.cap-t{font-size:47px;line-height:1.2}
.cap-s{font-size:24px;font-weight:700;line-height:1.2;color:#e9e6f4}
</style></head><body>
<!-- 1. 題字と本オープンの集合絵(幕の向こう) -->
<div class="sc" id="sTitle" style="background:radial-gradient(260px 900px at 22% 0%,#3b2a6a55,transparent 70%),radial-gradient(260px 900px at 78% 0%,#2a3b7a44,transparent 70%),linear-gradient(180deg,#14102c 0%,#1b1236 40%,#140d28 70%,#0c0a1b 100%)">
  <div id="spotL" class="abs" style="left:-40px;top:-80px;width:300px;height:1100px;background:linear-gradient(180deg,rgba(180,160,255,.16),rgba(180,160,255,0));transform-origin:50% 0;transform:rotate(-12deg)"></div>
  <div id="spotR" class="abs" style="left:460px;top:-80px;width:300px;height:1100px;background:linear-gradient(180deg,rgba(140,170,255,.14),rgba(140,170,255,0));transform-origin:50% 0;transform:rotate(12deg)"></div>
  <div id="stars"></div>
  <div id="tHead" class="abs latin" style="left:0;width:720px;text-align:center;top:136px;font-size:37px;letter-spacing:.02em;color:#a79c96">MONSTER HERO</div>
  <div class="abs mincho" style="left:0;width:720px;text-align:center;top:224px;font-size:84px;letter-spacing:.04em;color:#f8eed8;text-shadow:0 0 26px rgba(255,214,150,.35)">モンヒロビート</div>
  <div id="tShine" class="shine mincho" style="left:0;width:720px;text-align:center;top:224px;font-size:84px;letter-spacing:.04em">モンヒロビート</div>
  <div class="band" style="top:400px;height:405px;-webkit-mask-image:linear-gradient(180deg,#000 82%,transparent);mask-image:linear-gradient(180deg,#000 82%,transparent)"><img src="${f(I.teaser)}" style="left:${-245 * 1.516}px;top:${-182 * 1.516}px;width:${1000 * 1.516}px;height:${564 * 1.516}px"></div>
  <div id="tLine" class="abs" style="left:170px;top:858px;width:380px;height:2px;background:linear-gradient(90deg,transparent,#c9a45c,transparent)"></div>
  <div id="tOpen" class="abs mincho" style="left:0;width:720px;text-align:center;top:888px;font-size:72px;letter-spacing:.04em;color:#f0c870;text-shadow:0 0 22px rgba(240,190,90,.35)">本オープン</div>
  <div id="tOpenShine" class="shine mincho" style="left:0;width:720px;text-align:center;top:888px;font-size:72px;letter-spacing:.04em">本オープン</div>
</div>
<!-- 0. 幕 -->
<div class="sc" id="sCurtain" style="pointer-events:none">
  <div id="cL" class="abs" style="left:0;top:0;width:362px;height:1280px;background:repeating-linear-gradient(90deg,#3a0f44 0px,#6a2475 18px,#8a3496 30px,#5a1c66 44px,#2c0a35 60px);box-shadow:inset -18px 0 30px rgba(0,0,0,.45)"></div>
  <div id="cR" class="abs" style="left:358px;top:0;width:362px;height:1280px;background:repeating-linear-gradient(90deg,#2c0a35 0px,#5a1c66 16px,#8a3496 30px,#6a2475 42px,#3a0f44 60px);box-shadow:inset 18px 0 30px rgba(0,0,0,.45)"></div>
  <div id="cText" class="abs latin" style="left:0;width:720px;text-align:center;top:542px;font-size:37px;letter-spacing:.02em;color:#d9b88e">MONSTER HERO</div>
  <div id="cLine" class="abs" style="left:246px;top:624px;width:228px;height:1px;background:rgba(217,184,142,.5)"></div>
</div>
<!-- 2・3. マルチの部屋と結果 -->
${['Room', 'Result'].map((k, i) => `<div class="sc" id="s${k}" style="background:#0a0c1d">
  <img src="${f(I[k === 'Room' ? 'room' : 'result'])}" class="abs" style="left:0;top:0;width:720px;height:${Math.round(844 * 720 / 390)}px">
  <div class="abs" style="left:0;top:560px;width:720px;height:720px;background:linear-gradient(180deg,rgba(10,12,29,0) 0%,rgba(10,12,29,.86) 34%,rgba(10,12,29,.94) 100%)"></div>
  <div class="abs cap-k" style="left:40px;top:892px;color:#5ee7f0">MULTI LIVE</div>
  <div class="abs mincho cap-t" style="left:38px;top:932px">${i ? '同じ曲で、スコア対決。' : '最大5人でライブ'}</div>
  <div id="sh${k}" class="shine mincho cap-t" style="left:38px;top:932px">${i ? '同じ曲で、スコア対決。' : '最大5人でライブ'}</div>
  <div class="abs cap-s" style="left:40px;top:1030px">${i ? '演奏後、みんなの結果を発表。' : 'マルチの部屋に集合。'}</div>
</div>`).join('')}
<!-- 4. 助手とセッション -->
<div class="sc" id="sDuo" style="background:#120c22">
  <img class="blurbg" src="${f(I.teaser)}">
  <div class="abs" style="left:0;top:200px;width:358px;height:560px;overflow:hidden;background:#4f6770"><img src="${f(I.duoL)}" class="abs" style="left:${-(600 - 257) * 0.7}px;top:0;width:${1200 * 0.7}px;height:${800 * 0.7}px"></div>
  <div class="abs" style="left:362px;top:200px;width:358px;height:560px;overflow:hidden;background:#4f6770"><img src="${f(I.duoR)}" class="abs" style="left:${-(600 - 222) * 0.96}px;top:-20px;width:${1200 * 0.96}px;height:${800 * 0.96}px"></div>
  <div class="abs cap-k" style="left:40px;top:892px;color:#ff8fc8">DUO SESSION</div>
  <div class="abs mincho cap-t" style="left:38px;top:932px">助手とセッション</div>
  <div id="shDuo" class="shine mincho cap-t" style="left:38px;top:932px">助手とセッション</div>
  <div class="abs cap-s" style="left:40px;top:1030px">友情Lv3以上の2人でデュオ。</div>
</div>
<!-- 5. 記念ステージ -->
<div class="sc" id="sStage" style="background:#120c22">
  <img class="blurbg" src="${f(I.teaser)}">
  <div class="band" style="top:0;height:310px"><img src="${f(I.teaser)}" style="left:${-250 * 1.53}px;top:${-195 * 1.53}px;width:${1000 * 1.53}px;height:${564 * 1.53}px"></div>
  <div class="abs mincho" style="left:38px;top:334px;font-size:42px;line-height:1.2">記念ステージ、開演。</div>
  <div class="abs" style="left:0;top:454px;width:720px;height:337px;background:#050616"></div>
  <img id="gp" class="abs" style="left:0;top:456px;width:720px;height:333px" src="">
  <div class="abs mincho" style="left:38px;top:908px;font-size:38px;line-height:1.2">ノーツをネオン配色に。</div>
  <div class="abs cap-s" style="left:40px;top:990px;font-size:23px">設定「軽さ・演出」で選べる。</div>
</div>
<!-- 6. 記念ギフト -->
<div class="sc" id="sGift" style="background:#120c22">
  <img class="blurbg" src="${f(I.teaser)}">
  <div class="band" style="top:0;height:545px;-webkit-mask-image:linear-gradient(180deg,#000 90%,transparent);mask-image:linear-gradient(180deg,#000 90%,transparent)"><img src="${f(I.teaser)}" style="left:${-316 * 2.1}px;top:${-172 * 2.1}px;width:${1000 * 2.1}px;height:${564 * 2.1}px"></div>
  <div class="abs mincho" style="left:40px;top:628px;font-size:40px;line-height:1.2">本オープン記念ギフト</div>
  <div class="abs" style="left:38px;top:700px;font-size:78px;font-weight:700;line-height:1.1;color:#f2c46a;letter-spacing:.01em">10,000,000</div>
  <div id="shGift" class="shine" style="left:38px;top:700px;font-size:78px;font-weight:700;line-height:1.1;letter-spacing:.01em">10,000,000</div>
  <div class="abs" style="left:40px;top:830px;font-size:24px;font-weight:700">ダイヤ</div>
  <div class="abs" style="left:40px;top:896px;font-size:22px;font-weight:700;color:#e9e6f4">虹のプシュケー150 ほか</div>
</div>
<!-- 7. 育てたマスモン -->
<div class="sc" id="sMasu" style="background:radial-gradient(600px 500px at 50% 45%,#2a2d55aa,transparent 70%),linear-gradient(180deg,#151831 0%,#1a1c38 50%,#11122a 100%)">
  <div class="abs" style="left:48px;top:158px;font-size:21px;font-weight:700;color:#e8b45c;letter-spacing:.04em">モンヒロビート ／ 本オープン</div>
  <div class="abs mincho" style="left:46px;top:240px;font-size:60px;line-height:1.3">育てたマスモンと<br>ステージへ。</div>
  <div id="shMasu" class="shine mincho" style="left:46px;top:240px;font-size:60px;line-height:1.3;white-space:normal;width:640px">育てたマスモンと<br>ステージへ。</div>
  <div class="abs" style="left:22px;top:650px;width:676px;height:160px;border-radius:50%;background:radial-gradient(closest-side,#262447,#1a1a36 80%);border:2px solid #5a5680"></div>
  <img id="mGolem" src="${f(I.golem)}" class="abs" style="left:-5px;top:494px;width:281px;height:281px;object-fit:contain">
  <img id="mMocchi" src="${f(I.mocchi)}" class="abs" style="left:158px;top:562px;width:255px;height:255px;object-fit:contain">
  <img id="mSuezo" src="${f(I.suezo)}" class="abs" style="left:292px;top:506px;width:276px;height:276px;object-fit:contain">
  <img id="mTiger" src="${f(I.tiger)}" class="abs" style="left:411px;top:493px;width:285px;height:285px;object-fit:contain">
  <div class="abs" style="left:46px;top:910px;font-size:33px;font-weight:700">演奏が終わると、</div>
  <div class="abs" style="left:46px;top:982px;font-size:33px;font-weight:700;color:#7ce3e6">結果と性格に合わせてひとこと。</div>
</div>
<script>
// 星(決まった並び)
(() => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; const box = document.getElementById('stars');
  for (let i = 0; i < 70; i++) { const d = document.createElement('div'); d.className = 'star'; d.style.left = (r() * 720) + 'px'; d.style.top = (r() * 1280) + 'px'; d.dataset.ph = r() * 6.28; d.dataset.sp = 1 + r() * 2; d.style.opacity = .3; box.appendChild(d); } })();
const TL = ${JSON.stringify(TL)};
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const prog = ([a, b], t) => ease((t - a) / (b - a));
const $ = (id) => document.getElementById(id);
const show = (id, on) => { $(id).style.display = on ? 'block' : 'none'; };
const gpFrames = ${JSON.stringify(plan.gpFrames || [])};
let gpLast = '';
window.render = async (t) => {
  // 幕: 閉じたまま → 左右へ開く。幕の字は開き始めに消える
  const o = prog(TL.curtainOpen, t);
  $('cL').style.transform = 'translateX(' + (-o * 380) + 'px)'; $('cR').style.transform = 'translateX(' + (o * 380) + 'px)';
  const ct = 1 - clamp((t - TL.curtainOpen[0]) / .5);
  $('cText').style.opacity = ct; $('cLine').style.opacity = ct; show('sCurtain', o < 1);
  $('cText').style.opacity = ct * Math.min(1, t / .5 + .2);
  // 題字: 「本オープン」と上の小さい字が遅れて出る
  $('tOpen').style.opacity = prog(TL.titleIn, t); $('tLine').style.opacity = prog(TL.titleIn, t); $('tHead').style.opacity = prog(TL.headIn, t);
  // 照明(左右の光の筋がゆっくり揺れる)・星のまたたき
  $('spotL').style.transform = 'rotate(' + (-12 + 4 * Math.sin(t * 0.9)) + 'deg)'; $('spotR').style.transform = 'rotate(' + (12 - 4 * Math.sin(t * 0.9 + 1)) + 'deg)';
  for (const d of $('stars').children) d.style.opacity = (.25 + .55 * (.5 + .5 * Math.sin(t * d.dataset.sp + +d.dataset.ph))).toFixed(3);
  // 文字に走る光(拍に合わせて)
  let sw = -1; for (const [a, b] of TL.sweeps) if (t >= a && t <= b) sw = (t - a) / (b - a);
  const pos = sw < 0 ? '-200% 0' : (130 - sw * 160) + '% 0';
  for (const id of ['tShine', 'tOpenShine', 'shRoom', 'shResult', 'shDuo', 'shGift', 'shMasu']) $(id).style.backgroundPosition = pos;
  $('tOpenShine').style.opacity = prog(TL.titleIn, t);
  // 場面の押し出し(上へ / 左へ)と重ねて替わる所
  const up = (a, b, tr) => { const p = prog(tr, t); $(a).style.transform = 'translateY(' + (-p * 1280) + 'px)'; $(b).style.transform = 'translateY(' + ((1 - p) * 1280) + 'px)'; return p; };
  const left = (a, b, tr) => { const p = prog(tr, t); $(a).style.transform = 'translateX(' + (-p * 720) + 'px)'; $(b).style.transform = 'translateX(' + ((1 - p) * 720) + 'px)'; return p; };
  const ids = ['sTitle', 'sRoom', 'sResult', 'sDuo', 'sStage', 'sGift', 'sMasu'];
  ids.forEach(id => { $(id).style.transform = 'none'; $(id).style.opacity = 1; });
  let vis = [];
  if (t < TL.toRoom[0]) vis = ['sTitle'];
  else if (t < TL.toRoom[1]) { vis = ['sTitle', 'sRoom']; up('sTitle', 'sRoom', TL.toRoom); }
  else if (t < TL.toResult[0]) vis = ['sRoom'];
  else if (t < TL.toResult[1]) { vis = ['sRoom', 'sResult']; up('sRoom', 'sResult', TL.toResult); }
  else if (t < TL.toDuo[0]) vis = ['sResult'];
  else if (t < TL.toDuo[1]) { vis = ['sResult', 'sDuo']; left('sResult', 'sDuo', TL.toDuo); }
  else if (t < TL.toStage[0]) vis = ['sDuo'];
  else if (t < TL.toStage[1]) { vis = ['sDuo', 'sStage']; up('sDuo', 'sStage', TL.toStage); }
  else if (t < TL.toGift[0]) vis = ['sStage'];
  else if (t < TL.toGift[1]) { vis = ['sStage', 'sGift']; left('sStage', 'sGift', TL.toGift); }
  else if (t < TL.toMasu[0]) vis = ['sGift'];
  else if (t < TL.toMasu[1]) { vis = ['sGift', 'sMasu']; $('sMasu').style.opacity = clamp((t - TL.toMasu[0]) / (TL.toMasu[1] - TL.toMasu[0])); }
  else vis = ['sMasu'];
  ids.forEach(id => show(id, vis.includes(id)));
  // マスモンは拍ごとに小さく弾む(位置は動かさず、足もとを軸に少しだけ縦に伸び縮み)
  ['mGolem', 'mMocchi', 'mSuezo', 'mTiger'].forEach((id, k) => { const b = Math.max(0, Math.sin((t * 2.05 + k * .25) * Math.PI)); $(id).style.transform = 'translateY(' + (-b * 8).toFixed(1) + 'px)'; });
  // 記念ステージの演奏(撮ったコマを曲の時刻で選ぶ)
  if (vis.includes('sStage') && gpFrames.length) {
    const ms = ${Number(plan.gpFrom) || 0} + (t - TL.toStage[0]) * 1000;
    let best = gpFrames[0]; for (const g of gpFrames) if (Math.abs(g[1] - ms) < Math.abs(best[1] - ms)) best = g;
    if (best[0] !== gpLast) { gpLast = best[0]; const im = $('gp'); im.src = best[0]; try { await im.decode(); } catch (_) {} }
  }
};
</script></body></html>`;
};

// 冒頭の動画を書き出す。返すのは mp4 のパス(音なし・60fps・end 秒)
const buildIntro = async ({ ROOT, WORK, fontsHead, plan, end }) => {
  const R = (p) => path.resolve(ROOT, p);
  const file = (p) => 'file://' + R(p);
  const intro = plan.intro;
  // 記念ステージの演奏のコマ(撮影の frames.json から、曲の時刻つきで)
  let gpFrames = [];
  if (intro.stageCap && fs.existsSync(path.join(R(intro.stageCap), 'frames.json'))) {
    const dir = R(intro.stageCap), meta = JSON.parse(fs.readFileSync(path.join(dir, 'frames.json'), 'utf8'));
    gpFrames = meta.frames.filter(x => Number.isFinite(x.songMs)).map(x => ['file://' + path.join(dir, x.file), x.songMs]);
  }
  const page_ = html({ fontsHead, file, plan: { images: intro.images, gpFrames, gpFrom: intro.stageFrom } });
  const hf = path.join(WORK, 'intro.html'); fs.writeFileSync(hf, page_);
  const { chromium } = (() => { try { return require(R('tools/node_modules/playwright')); } catch { return require('playwright'); } })();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
  const out = path.join(WORK, 'intro.mp4');
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 1 });
    await page.goto('file://' + hf); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
    const n = process.env.INTRO_STILLS ? 0 : Math.round(end * 60);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'png', '-i', '-', '-frames:v', String(n), '-c:v', 'libx264', '-crf', '10', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg(冒頭) ' + c))));
    for (let k = 0; k < n; k++) {
      await page.evaluate((t) => window.render(t), k / 60);
      const png = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if (k % 600 === 0) console.log(`  冒頭 ${(k / 60).toFixed(0)}秒…`);
    }
    ff.stdin.end(); if (n) await done; else await done.catch(() => {});
    // 確かめ用に各場面の1コマ(原寸)を残す
    for (const t of intro.checkAt || [0.8, 5.2, 9.0, 12.5, 17.0, 22.5, 27.5, 31.5]) {
      await page.evaluate((x) => window.render(x), t);
      await page.screenshot({ path: path.join(WORK, `intro-${String(t).replace('.', '_')}.png`) });
    }
  } finally { await browser.close(); }
  return out;
};
module.exports = { buildIntro, TL };
