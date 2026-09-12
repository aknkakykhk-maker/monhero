const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// はじめて遊ぶ人が「名前とアイコンを決める画面」を必ず通ることを、実際のブラウザで確かめる。
//
// 実際にあった抜け道(2026-09-12・ユーザー指摘「初回チュートリアルを飛ばすと
// 名前やアイコンを設定しないでゲームをやれちゃう」):
//   起動直後に出るログインボーナスの「ギフトを確認」→ ギフトボックス → 戻る
//   → 戻り先がHOME固定だったので、名無しのブリーダーのままHOMEへ着いてしまい、
//     バトルも施設もそのまま遊べる状態になっていた。
//
// 直し方は2つ重ねてある。
//   ① はじめての設定が終わるまで、ログインボーナスのポップアップを出さない
//      (報酬はすでにギフトボックスへ配ってあるので、出すのを遅らせても何も失われない)
//   ② それでもHOMEへ着いてしまったら、助手えらび/プロフィールへ連れ戻す
//
// ②は「戻り先がHOME固定の画面」がほかにもあるための保険なので、
// ここでは①で入口が塞がっていることと、正しく設定を終えた人が
// これまでどおりHOMEへ入れて、ログインボーナスも受け取れることを見る。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8987;

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

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    // セーブデータを何も入れずに開く。いちばん最初に遊ぶ人と同じ状態
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    // このサンドボックスは外部CDN(Tailwind)へ出られないので、横スライドの最低限だけ足す
    await page.addStyleTag({ content: `.snap-mandatory{display:flex;overflow-x:auto;width:100%;}` });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 60000 });
    await page.waitForTimeout(1500);

    // 画面の中身と、いま保存されているもの
    const saved = () => page.evaluate(() => ({
      name: localStorage.getItem('mh_breeder_name'),
      icon: localStorage.getItem('mh_breeder_icon'),
      onboarded: localStorage.getItem('mh_onboarded'),
    }));
    const textOf = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
    const tap = async (re) => {
      const btn = page.locator('button').filter({ hasText: re }).first();
      if (await btn.count() === 0) return false;
      await btn.dispatchEvent('click');
      await page.waitForTimeout(700);
      return true;
    };

    // --- ① 助手えらびから始まり、そこから抜け出す導線が出ていない ---
    const first = await textOf();
    check('はじめての人は助手えらびから始まる', first.includes('助手をえらぶ'), first.slice(0, 30));
    check('はじめての設定が終わるまでログインボーナスは出さない',
      !first.includes('ログインボーナス')
        && await page.locator('button').filter({ hasText: /ギフトを確認/ }).count() === 0);
    check('助手えらびの時点では何も保存されていない',
      JSON.stringify(await saved()) === JSON.stringify({ name:null, icon:null, onboarded:'false' }),
      JSON.stringify(await saved()));

    // --- ② 助手を選ぶとプロフィール(はじめての設定)へ。まだ決められない ---
    await tap(/みゅあ/);
    const profile = await textOf();
    check('助手を選ぶとはじめての設定へ進む',
      profile.includes('はじめての設定') && profile.includes('なまえを決める') && profile.includes('アイコンを選ぶ'));
    check('名前もアイコンも決めていないうちは「けってい！」を押せない',
      await page.locator('button').filter({ hasText: /^けってい！$/ }).first().isDisabled());

    // --- ③ 寄り道してもHOMEへは出られない ---
    // プロフィールからはアイテムや記録を見られる。その戻り先がHOMEになっていると、
    // そこから遊べてしまう。戻ってくる先が「はじめての設定」のままであることを見る
    await tap(/^アイテム（/);
    check('寄り道してもHOMEへは出られない', !(await textOf()).includes('バトル記録'));
    await page.locator('button').nth(1).dispatchEvent('click'); // 見出しの左にある戻る
    await page.waitForTimeout(800);
    check('寄り道から戻る先ははじめての設定', (await textOf()).includes('はじめての設定'));
    check('寄り道しても何も保存されていない',
      (await saved()).name === null && (await saved()).onboarded === 'false');

    // --- ④ 名前とアイコンを決めれば、これまでどおりHOMEへ入れる ---
    await tap(/^なまえを決める$/);
    await page.locator('input').first().fill('けんさ');
    await tap(/保存/);
    check('名前を決めると保存される', (await saved()).name === JSON.stringify('けんさ'), String((await saved()).name));
    await tap(/^アイコンを選ぶ$/);
    await page.evaluate(() => {
      const list = [...document.querySelectorAll('button')]
        .filter(b => b.querySelector('img') && b.className.includes('aspect-square'));
      if (list.length) list[0].click();
    });
    await page.waitForTimeout(700);
    check('アイコンを選ぶと保存される', !!(await saved()).icon, String((await saved()).icon));
    check('両方そろうと「けってい！」を押せる',
      await page.locator('button').filter({ hasText: /^けってい！$/ }).first().isEnabled());
    await tap(/^けってい！$/);
    await page.waitForTimeout(1200);
    const home = await textOf();
    check('はじめての設定を終えるとHOMEへ入れる',
      home.includes('バトル') && home.includes('マーケット'), home.slice(0, 30));
    check('決めた名前とアイコンで始まる', (await saved()).onboarded === 'true' && home.includes('けんさ'));
    // 出すのを遅らせただけで、受け取り損ねてはいけない
    check('遅らせたログインボーナスは設定のあとに出る',
      await page.locator('[aria-label="ログインボーナス"]').count() === 1);

    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (errors.length) console.log(`  実行時エラー: ${errors[0]}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
