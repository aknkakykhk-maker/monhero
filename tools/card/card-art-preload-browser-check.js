#!/usr/bin/env node
// MFバトルカードの対戦の立ち絵が、通信が遅い・失敗するときにも出るか(2026-10-31 社長「対戦時に出る立ち絵モンスターが表示されないときがある」)。
//   node tools/card/card-art-preload-browser-check.js
//   ① 立ち絵(images/monsters/)を0.8秒遅らせても、対戦開始の画面(CardVsIntro)は読み終えてから出て、3体ずつの絵が全部描ける
//   ② 立ち絵の通信を失敗させても、真っ白にならずカードの絵で出る(読み直し→カードの絵)
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const run = async (mode) => {
  const http = require('http'), fs = require('fs');
  const root = ROOT; const PORT = mode === 'slow' ? 9051 : 9052;
  const quiet = require(path.join(root, 'tools/boot/quiet-boot-seed'));
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
  const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const file = path.join(root, rel); if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res); });
  await new Promise((r) => server.listen(PORT, r));
  let chromium;
  try { ({ chromium } = require(path.join(root, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); server.close(); process.exit(0); }
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); // 事前ダウンロード(Service Worker)の取得は route を通らないので止める(ページが直接取りに行くときを見る)
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  });
  // 立ち絵だけ遅らせる / 失敗させる(カードの絵 images/card-battle/ はそのまま)
  // ★本体は「長くても2.5秒」待って出す(83 の cardArtPreload の capMs)。1.5秒遅らせると、ほかの検査やビルドが同時に走って
  //   重いときに2.5秒を超え、決めたとおり先に出て①が落ちた(2026-11-01 ビート部)。待つ上限に余裕を残して0.8秒にする
  //   (読み終えるのを待たずに出す作りなら、0.8秒でも絵は描けていないので①で分かる)
  await page.route(/\/images\/monsters\/[^/]+\.(png|webp)/i, async (route) => {
    if (mode === 'fail') return route.abort();
    await new Promise((r) => setTimeout(r, 800)); return route.continue();
  });
  await page.addInitScript(quiet.eventStorySeed()); await page.addInitScript(quiet.updateNoticeSeed());
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 6; i++) { const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break; await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
  await page.locator('[data-debug-card-battle]').dispatchEvent('click');
  await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-kit="powerful"]').click();
  await page.getByRole('button', { name: /にする$/ }).click();
  await require(path.join(root, 'tools/card/lib/starter-open-pass.js'))(page);
  // 対戦開始の画面(練習試合)。読んでいるあいだは「対戦の準備中…」、読み終えてから出る
  const vs = await page.locator('[data-card-vs]').waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  const arts = await page.evaluate(() => [...document.querySelectorAll('[data-card-vs-mon] img')].map((im) => ({ src: im.getAttribute('src') || '', ok: im.complete && im.naturalWidth > 0 })));
  // 事前ダウンロードに入れる立ち絵(84 の cardArtPrefetchPaths)が、一覧(asset-manifest.json)にあるパスか
  const pre = await page.evaluate(async () => {
    const paths = typeof cardArtPrefetchPaths === 'function' ? cardArtPrefetchPaths() : [];
    const m = await fetch('asset-manifest.json').then((r) => r.json()).catch(() => null);
    return { n: paths.length, missing: paths.filter((p) => !(m && m.files[p])) };
  });
  await b.close(); server.close();
  return { vs, arts, errs, pre };
};
(async () => {
  const slow = await run('slow');
  check('① 立ち絵を0.8秒遅らせても、対戦開始の画面が出たときに6体ぶんの絵が全部描けている(読み終えてから出す)',
    slow.vs && slow.arts.length === 6 && slow.arts.every((x) => x.ok) && slow.arts.some((x) => /images\/monsters\//.test(x.src)), JSON.stringify(slow.arts.map((x) => `${x.ok ? 'o' : 'x'}${x.src.split('/').pop()}`)));
  const fail = await run('fail');
  check('② 立ち絵の通信が失敗しても、真っ白にならず、カードの絵で6体とも出る', fail.vs && fail.arts.length === 6 && fail.arts.every((x) => x.ok) && fail.arts.every((x) => /card-battle/.test(x.src)),
    JSON.stringify(fail.arts.map((x) => `${x.ok ? 'o' : 'x'}${x.src.split('/').pop()}`)));
  check('④ 自動の事前ダウンロード・「バトルカード」のまとまりに入れる立ち絵が、全部一覧にある(パスが合っている)', slow.pre.n >= 20 && !slow.pre.missing.length, JSON.stringify(slow.pre));
  check('③ 実行時エラーが無い', !slow.errs.length && !fail.errs.length, [...slow.errs, ...fail.errs].slice(0, 2).join(' / '));
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
