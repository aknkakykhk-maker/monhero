// 読み込みにかかる時間を実ブラウザで計測する。
// 事前変換(tools/build.js)の効果を数値で確認するために使う。
//
//   python3 -m http.server 8899   などでリポジトリのルートを配信した状態で
//   node perf-check.js
//
// 注: React / Tailwind はCDNから読むため、外部接続が塞がれた環境では描画完了までは測れない。
//     その場合でも「自前のスクリプト(データ+ゲーム本体)の取得と実行にかかる時間」は測れる。
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const transfers = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (!url.startsWith('http://localhost')) return;
    try { transfers.push({ url: url.split('/').pop().split('?')[0], size: (await res.body()).length }); } catch (e) {}
  });

  const t0 = Date.now();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 自前のスクリプトが全て評価し終わるまで待つ(ゲーム本体の関数が定義された時点)
  await page.waitForFunction(() => typeof MonsterHeroGame !== 'undefined', { timeout: 60000 }).catch(() => {});
  const ownScriptsMs = Date.now() - t0;

  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return n ? { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null;
  });

  const total = transfers.reduce((a, b) => a + b.size, 0);
  console.log('自前ファイルの転送量');
  transfers.sort((a, b) => b.size - a.size).slice(0, 12)
    .forEach((t) => console.log(`  ${(t.size / 1024).toFixed(0).padStart(6)} KB  ${t.url}`));
  console.log(`  合計 ${(total / 1024 / 1024).toFixed(2)} MB (${transfers.length}ファイル)`);
  console.log(`\nゲーム本体が使えるようになるまで: ${ownScriptsMs} ms`);
  if (nav) console.log(`DOMContentLoaded: ${nav.domContentLoaded} ms`);

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
