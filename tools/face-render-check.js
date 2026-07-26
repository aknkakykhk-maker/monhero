// 顔アイコンが実ブラウザで正しくデコード・描画されるかを確認する。
// アイコン選択画面と同じレイアウト(4列・aspect-square・object-cover)を再現して
// out/face-icons-in-browser.png に書き出すので、切り出し位置の目視確認にも使える。
//
//   python3 -m http.server 8899   などでリポジトリのルートを配信した状態で
//   node face-render-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const IDS = ['MOCCHI', 'SUEZO', 'PIXIE', 'GOLEM', 'MITARASHI', 'IBLIS', 'TIGER', 'HAM', 'MONOL', 'OBORO', 'ZAN', 'ARK'];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);

  const count = await page.evaluate((ids) => {
    document.body.innerHTML = '<div id="g" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;background:#0f172a"></div>';
    const g = document.getElementById('g');
    let n = 0;
    for (const id of ids) {
      const url = eval(id + '_FACE_ICON');
      const cell = document.createElement('div');
      cell.style.cssText = 'aspect-ratio:1;border-radius:16px;overflow:hidden;border:2px solid #475569';
      const im = document.createElement('img');
      im.src = url;
      im.style.cssText = 'width:100%;height:100%;object-fit:cover';
      cell.appendChild(im); g.appendChild(cell); n++;
    }
    return n;
  }, IDS);

  await page.waitForTimeout(2500);
  const decoded = await page.evaluate(() => [...document.images].map((i) => ({ ok: i.complete && i.naturalWidth > 0, size: i.naturalWidth + 'x' + i.naturalHeight })));
  const ng = decoded.filter((d) => !d.ok);
  console.log(`描画した顔アイコン: ${count}枚`);
  console.log(ng.length ? `NG デコード失敗が ${ng.length}枚` : `OK 全${decoded.length}枚がデコード成功 (${[...new Set(decoded.map((d) => d.size))].join(', ')})`);

  const out = path.join(__dirname, 'out', 'face-icons-in-browser.png');
  await page.screenshot({ path: out });
  console.log(`スクリーンショット: ${path.relative(process.cwd(), out)}`);
  await browser.close();
  process.exit(ng.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
