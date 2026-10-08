const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトルの入口(BATTLE_SYSTEM_SELECT)が、小さい端末でも1画面に収まることを実際に測る。
//
// 【なぜ道具にするか】(2026-10-08 に札+舞台の作りへ変えた。測るのは「札3枚が画面に収まり、文字があふれない」)
// この画面はカード3枚＋助手のひとことを縦に並べるだけなので、
// 行を1つ足す・余白を少し広げる、で簡単に画面からあふれる。
// あふれてもエラーは出ず、大きい端末では気づけない(2026-09-21・ユーザー報告
// 「1画面に収まってない」。そのときは iPhone SE で179pxあふれていた)。
//
// 測るのは1つだけ。「いちばん小さい端末で、縦スクロールせずに全部見えるか」。
//   ・375×667(iPhone SE。ホーム画面から起動したときの高さ)を下限にする
//   ・それより小さい端末(ブラウザのバーが出た状態のSEなど)は、
//     カード3枚＋助手では物理的に入らないので対象にしない
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8971;
// 収まっていてほしい端末。いちばん小さいものを基準にする
const SIZES = [
  { w: 375, h: 667, name: 'iPhone SE' },
  { w: 390, h: 844, name: 'iPhone 13/14' },
  { w: 430, h: 932, name: 'iPhone Pro Max' },
  { w: 360, h: 640, name: '小さい画面' },
  { w: 844, h: 390, name: '横向き', landscape: true },
];
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
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
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    for (const size of SIZES) {
      const page = await browser.newPage({ viewport: { width: size.w, height: size.h } });
      // このサンドボックスは外部CDNへ出られない。横幅に効くぶんだけ自前で足す
      await page.route('**/cdn.tailwindcss.com*', (r) => r.abort());
      await page.addInitScript(() => {
        localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
        localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
        localStorage.setItem('mh_onboarded', JSON.stringify(true));
        localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
        localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
        localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
        localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
      });
      await page.goto(`http://127.0.0.1:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      // 配布のお知らせなどが重なっていると測れないので、先に閉じる
      const dismiss = async () => {
        for (let i = 0; i < 6; i += 1) {
          const b = page.getByRole('button', { name: /^(確認|受け取る|閉じる|はじめる|OK)$/ }).first();
          if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
          await b.dispatchEvent('click').catch(() => {});
          await page.waitForTimeout(400);
        }
      };
      await dismiss();
      await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.waitForTimeout(1500);
      await dismiss();
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const screen = document.querySelector('[data-mh-screen]');
        const scroller = screen && screen.querySelector('.overflow-y-auto');
        const cards = [...document.querySelectorAll('[data-battle-system-card]')];
        // 札(押す側のボタン)が3枚とも画面の中に収まっているか。文字が札から出ていないかも見る
        const tiles = [...document.querySelectorAll('[data-battle-system]')];
        const tileOut = tiles.filter(t => { const r = t.getBoundingClientRect(); return r.top < 0 || r.bottom > window.innerHeight + 1; }).length;
        // 透かしの英字ははみ出す作りなので数えない。名前とひとこと(最後の span)が札の中にあるかを見る
        const textOut = tiles.filter(t => { const r = t.getBoundingClientRect(); const x = t.lastElementChild.getBoundingClientRect(); return x.top < r.top - 1 || x.bottom > r.bottom + 1; }).length;
        return {
          cards: cards.length,
          content: scroller ? Math.round(scroller.scrollHeight) : 0,
          frame: scroller ? Math.round(scroller.clientHeight) : 0,
          tileOut, textOut,
          wide: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      const over = m.content - m.frame;
      // 横向きは右の列が自分でスクロールするので、札が画面の中にあるかだけを見る
      check(`${size.name}(${size.w}×${size.h}) で1画面に収まる`, m.cards === 3 && m.tileOut === 0 && (size.landscape || over <= 1),
        over > 1 ? `${over}px はみ出している（中身 ${m.content} / 画面 ${m.frame}・画面外の札 ${m.tileOut}）` : `余り ${-over}px・画面外の札 ${m.tileOut}`);
      check(`${size.name} で横にはみ出さない`, m.wide === false);
      // ★札の文字が札からあふれていないこと(タイトルとひとことが折り返しすぎると札が伸びられず切れる)
      check(`${size.name} で札の文字が札からあふれていない`, m.textOut === 0, `あふれた札 ${m.textOut}`);
      await page.close();
    }
  } catch (e) {
    check('確認できました', false, e && e.message ? e.message : String(e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
