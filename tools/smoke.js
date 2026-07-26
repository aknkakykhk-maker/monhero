// data/*.js を実ブラウザ(Chromium)で読み込み、画像の変数がすべて正しく解決されるか確認する。
// 特に「同じ絵を変数参照に置き換えた」箇所(images-ally.js の _ICON / _FACE_ICON など)が
// load-order エラーで undefined になっていないかを検出するために使う。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node smoke.js
//
// 注: React / Tailwind / Babel はCDNから読むため、外部接続が塞がれた環境では
//     ゲーム本体の描画までは確認できない。その場合でもデータの読み込み確認は有効。
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 参照に置き換えた変数を中心に、実体が入っているか確かめたいもの
const CHECK = [
  'MOCCHI_IMG', 'MOCCHI_ICON', 'MOCCHI_FACE_ICON',
  'SUEZO_IMG', 'SUEZO_ICON', 'SUEZO_FACE_ICON',
  'PIXIE_ICON', 'PIXIE_FACE_ICON', 'GOLEM_ICON', 'GOLEM_FACE_ICON',
  'MITARASHI_ICON', 'MITARASHI_FACE_ICON', 'IBLIS_ICON', 'IBLIS_FACE_ICON',
  'TIGER_FACE_ICON', 'MONOL_FACE_ICON', 'OBORO_FACE_ICON', 'ZAN_FACE_ICON',
  'MOO_IMG_DATA', 'MOO_FULL',
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(8000);

  const result = await page.evaluate((names) => names.map((n) => {
    let v;
    try { v = eval(n); } catch (e) { return { n, ok: false, why: '未定義(' + e.message + ')' }; }
    if (typeof v !== 'string') return { n, ok: false, why: '文字列ではない: ' + typeof v };
    if (!v.startsWith('data:image/')) return { n, ok: false, why: 'dataURLではない' };
    return { n, ok: true, chars: v.length };
  }), CHECK);

  let ng = 0;
  for (const r of result) {
    if (r.ok) console.log(`  OK  ${r.n.padEnd(22)} ${r.chars} chars`);
    else { console.log(`  NG  ${r.n.padEnd(22)} ${r.why}`); ng++; }
  }

  // CDNブロックによるエラーは本質的な問題ではないので分けて表示する
  const cdn = errors.filter((e) => /ERR_TUNNEL|CDN|Babel not loaded/.test(e));
  const real = errors.filter((e) => !/ERR_TUNNEL|CDN|Babel not loaded/.test(e));
  console.log(`\n画像変数: ${result.length - ng}/${result.length} 正常`);
  if (cdn.length) console.log(`(参考) 外部CDNへの接続が塞がれています: ${cdn.length}件 — ゲーム本体の描画は確認できません`);
  if (real.length) console.log('その他のエラー:', real.slice(0, 10));

  await page.screenshot({ path: path.join(__dirname, 'out', 'smoke.png') }).catch(() => {});
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
