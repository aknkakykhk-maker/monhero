// 画面が真っ白になる類の不具合(JSの実行時エラー)を、実際にブラウザで開いて確かめる。
//
// check-syntax.js は構文しか見ず、undefined-reference-check.js は
// 「その場所から見えない変数」しか見ない。今回のように
//
//     const battleTutorialNeed = battleTutorial && ...   // ← battleTutorial の定義より前
//     ...
//     const battleTutorial = ...
//
// と書いてしまうと、構文も参照先も正しいのに、描画した瞬間に
// 「Cannot access 'battleTutorial' before initialization」で真っ白になる。
// これはブラウザで動かさないと分からないので、ここで実際に開いて拾う。
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動する。見た目は崩れるが、JSの実行時エラーはそのまま観測できる。
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const PORT = 8977;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    // 外へ出られないので、TailwindのCDNだけ打ち切る(見た目は崩れるがJSは動く)
    await page.route('**cdn.tailwindcss.com**', (r) => r.abort());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const mounted = await page.evaluate(() => typeof MonsterHeroGame);
    const rendered = await page.evaluate(() => {
      const root = document.getElementById('root');
      return !!root && root.childElementCount > 0;
    });
    console.log(`${mounted === 'function' ? 'OK' : 'NG'}: ゲーム本体を読み込めている — ${mounted}`);
    console.log(`${rendered ? 'OK' : 'NG'}: 画面が描画されている`);
    console.log(`${errors.length === 0 ? 'OK' : 'NG'}: 実行時エラーが出ていない${errors.length ? ` — ${errors[0]}` : ''}`);
    const failed = (mounted !== 'function') || !rendered || errors.length > 0;
    console.log(failed ? '\n真っ白になる可能性があります' : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
