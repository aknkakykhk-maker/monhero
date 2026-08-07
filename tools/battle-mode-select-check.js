// 新しいバトルの入口(バトルモード選択 → 難易度選択 → モード別スコアランキング)を
// 実際のブラウザで開いて、押して進めることを確かめる。
//
//   ① デバッグ設定からモード選択画面を開ける
//   ② 3モードがカードで並び、左右の矢印とドットで切り替わる
//   ③ クイックにはスコアランキングの導線が出ない(高さ合わせの空枠も出さない)
//   ④ モードカードのランキングからプロ専用ランキングへ入れる
//   ⑤ 難易度を選ぶ → 難易度カードが並ぶ → そこからもランキングへ入れる
//   ⑥ 難易度カードから入ったときは、その難易度のタブが最初に選ばれている
//   ⑦ 上のタブでブリーダーLv・絆Lvランキングへ切り替えられる
//   ⑧ どこを通っても実行時エラー(真っ白)が出ない
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動する。見た目は崩れるが、押せるかどうかと実行時エラーは観測できる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const PORT = 8979;

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
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**cdn.tailwindcss.com**', (r) => r.abort());
    // 既存ユーザーとして起動し、はじめての案内・バトル練習の案内は出さない
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });

    // LOADING → TITLE → GAME
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    // 起動直後のモーダル(補償・案内)は片付けてから進む
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // --- ① デバッグ設定から新しい入口を開く ---
    // デバッグ設定はヘルプの一番下の「💊」からしか開けない
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    // Tailwindを読めないぶん見た目が崩れて画面外に出ることがあるので、
    // 押せるかどうかは DOM のクリックで確かめる(押した結果の画面遷移は同じ)
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    const openButton = page.getByRole('button', { name: '新バトルモード選択を開く（お試し）' });
    check('デバッグ設定に新しい入口のボタンがある', await openButton.count() === 1);
    await openButton.dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });

    // --- ② 3モードがカードで並ぶ ---
    const modeCards = page.locator('.snap-mandatory > article');
    check('モードのカードが3枚ある', await modeCards.count() === 3, `${await modeCards.count()}枚`);
    for (const label of ['チャレンジモード', 'クイックモード', 'プロモード']) {
      check(`${label}のカードがある`, await page.getByRole('heading', { name: new RegExp(label) }).count() === 1);
    }
    check('前へ・次への矢印がある',
      await page.getByRole('button', { name: '前のモード' }).count() === 1
        && await page.getByRole('button', { name: '次のモード' }).count() === 1);
    check('最初は先頭なので「前のモード」は押せない', await page.getByRole('button', { name: '前のモード' }).isDisabled());

    // --- ③ ランキングの導線はチャレンジとプロだけ ---
    check('チャレンジのカードにランキングの導線がある',
      await page.getByRole('button', { name: /チャレンジモードのランキング/ }).count() === 1);
    check('プロのカードにランキングの導線がある',
      await page.getByRole('button', { name: /プロモードのランキング/ }).count() === 1);
    // 「ランキング対象外」はクイックのカードの特徴として1行出るが、
    // 既存画面にあった高さ合わせだけの空枠(押せない案内ボックス)は新UIには置かない
    check('クイックにはランキングの導線も高さ合わせの空枠も出さない',
      await page.getByRole('button', { name: /クイックモードのランキング/ }).count() === 0
        && await page.getByText('クイックモードはランキング対象外です').count() === 0);

    // --- ④ プロ専用ランキングへ入れる ---
    await page.getByRole('button', { name: /プロモードのランキング/ }).dispatchEvent('click');
    await page.getByRole('heading', { name: 'プロモードランキング' }).waitFor({ timeout: 15000 });
    check('プロモードのランキング画面へ入れる', true);
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('ランキングから戻るとモード選択へ帰る', true);

    // --- ⑤ 難易度選択へ進む ---
    await page.getByRole('button', { name: '次のモード' }).dispatchEvent('click');
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: '次のモード' }).dispatchEvent('click');
    await page.waitForTimeout(600);
    check('矢印でプロモードまで進める', await page.getByRole('button', { name: '次のモード' }).isDisabled());
    // プロのカードの「難易度を選ぶ」
    await page.locator('article').filter({ hasText: 'プロモード' }).getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    check('難易度選択画面へ進める', await page.getByRole('heading', { name: 'プロモード' }).count() === 1);
    check('難易度のカードが9枚ある', await page.locator('.snap-mandatory > article').count() === 9,
      `${await page.locator('.snap-mandatory > article').count()}枚`);
    check('プロはまだ始められない',
      await page.getByRole('button', { name: 'プロモードは準備中です' }).first().isDisabled());

    // --- ⑥ 難易度カードのランキングは、その難易度のタブが最初に選ばれる ---
    const hardCard = page.locator('.snap-mandatory > article').filter({ hasText: 'Hard' }).first();
    await hardCard.scrollIntoViewIfNeeded();
    await hardCard.getByRole('button', { name: /Hardのランキング/ }).dispatchEvent('click');
    await page.getByRole('heading', { name: 'プロモードランキング' }).waitFor({ timeout: 15000 });
    const selected = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.className.includes('ring-2 ring-white'));
      return btn ? btn.textContent.trim() : null;
    });
    check('難易度カードから入ると、その難易度のタブが選ばれている', selected === 'Hard', String(selected));

    // --- ⑦ 上のタブでブリーダーLv・絆Lvへ切り替えられる ---
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    for (const [label, marker] of [['ブリーダーLv', 'ブリーダーLvランキング'], ['絆Lv', '絆Lvランキング']]) {
      await page.getByRole('button', { name: marker }).dispatchEvent('click');
      await page.waitForTimeout(400);
      check(`${label}ランキングのタブへ切り替えられる`,
        await page.getByText('BATTLE MODE').count() === 0);
    }
    await page.getByRole('button', { name: 'モード選択' }).dispatchEvent('click');
    await page.waitForTimeout(400);
    check('モード選択のタブへ戻れる', await page.getByText('BATTLE MODE').first().isVisible());

    // --- ⑧ 実行時エラー ---
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
