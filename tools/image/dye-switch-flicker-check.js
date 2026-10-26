// 染色の色を続けて変えたとき、元の色(染める前の絵)へ一瞬もどってチラつかないことを、実際のブラウザで確かめる(2026-10-23)。
//
//   node tools/image/dye-switch-flicker-check.js
//
// 【なぜ要るか】
// 染めた絵は、部位を重ねたものを1枚に焼いて出す(DyedMonsterImage・2026-10-13〜)。焼いているあいだ元の絵を出していたため、
// 色を変えるたびに「染めた絵 → 元の色 → 新しい色」と一瞬もどり、社長「染色するときに色の変化の動きがかくつく」になった
// (色を0.1秒ごとに変えると、270コマ中177コマが元の色だった)。焼いているあいだは、ひとつ前に焼いた絵を出し続ける。
//
// 【見かた】
// 部位3つ(ピクシー)と部位5つ(ドリーミィ)で、0.1秒ごとに30回色を変えるあいだ、元の色の絵だけが出ているコマが0。
// 最後には新しい色の焼いた絵が出ている(元の絵のままで止まらない)。
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.DYE_FLICKER_PORT || 8952);
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { console.log('SKIP: playwright が入っていません'); return; }
  const server = spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
  await new Promise(r => setTimeout(r, 900));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof DyedMonsterImage === 'function' && typeof ReactDOM !== 'undefined', { timeout: 60000 });
    for (const baseId of ['Pixie', 'Dreamy']) {
      const r = await page.evaluate(async (baseId) => {
        const src = ALL_PLAYER_MONSTERS[baseId].iconUrl;
        const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:0;top:0;width:96px;height:96px;z-index:999999';
        document.body.appendChild(host);
        const root = ReactDOM.createRoot(host);
        const n = (MASU_COLOR_REGION_HUES[baseId] || [1]).length;
        const draw = (h) => root.render(React.createElement(DyedMonsterImage, { baseId, src, alt: '', className: 'w-full h-full object-cover',
          masuColors: Array.from({ length: n }, (_, i) => `custom:${(h + i * 40) % 360}:0.7:0.7`) }));
        const onlyOriginal = () => { const imgs = host.querySelectorAll('img'); return imgs.length === 1 && imgs[0].getAttribute('src') === src; };
        draw(0); await new Promise(res => setTimeout(res, 2500));
        let frames = 0, flash = 0, running = true;
        const loop = () => { frames++; if (onlyOriginal()) flash++; if (running) requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
        for (let k = 1; k <= 30; k++) { draw(k * 12); await new Promise(res => setTimeout(res, 100)); }
        await new Promise(res => setTimeout(res, 2000)); running = false;
        const endImg = host.querySelector('img');
        const done = !!endImg && endImg.getAttribute('src') !== src;
        root.unmount(); host.remove();
        return { frames, flash, done };
      }, baseId);
      check(`${baseId}: 色を続けて変えても、元の色の絵へもどるコマが無い`, r.flash === 0, `${r.flash}/${r.frames}コマ`);
      check(`${baseId}: 最後は新しい色の絵が出ている`, r.done);
    }
  } finally { await browser.close(); server.kill(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
