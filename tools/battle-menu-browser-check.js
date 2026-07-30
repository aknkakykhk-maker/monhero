// 390x844 の実ブラウザで HOME → 難易度画面の主要導線と例外ゼロを確認する。
// 実行前に `python3 tools/serve.py` でリポジトリルートを配信する。
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';

(async () => {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {});
  const page = await browser.newPage({ viewport: { width:390, height:844 } });
  const exceptions = [];
  page.on('pageerror', error => exceptions.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テストブリーダー'));
    localStorage.setItem('mh_intro_done', JSON.stringify(true));
  });
  await page.goto(URL, { waitUntil:'load', timeout:60000 });
  await page.getByRole('button', { name:'TAP TO START' }).click();
  await page.getByRole('button', { name:'バトル' }).waitFor();

  const openBattleMenu = async () => {
    await page.getByRole('button', { name:'バトル' }).click();
    await page.getByRole('heading', { name:'バトル' }).waitFor();
    await page.getByRole('button', { name:'前の難易度' }).waitFor();
    await page.getByRole('button', { name:'次の難易度' }).waitFor();
    await page.getByText('BATTLE DIFFICULTY').first().waitFor();
  };
  await openBattleMenu();

  const next = page.getByRole('button', { name:'次の難易度' });
  await next.click();
  await page.waitForTimeout(500);
  if (await page.getByRole('button', { name:'前の難易度' }).isDisabled()) throw new Error('右矢印で難易度が移動しません');
  const carousel = page.locator('.snap-mandatory').first();
  await carousel.evaluate(node => node.scrollTo({ left:node.scrollWidth, behavior:'instant' }));
  await page.waitForTimeout(500);
  if (!(await next.isDisabled())) throw new Error('スワイプ相当のスクロールで最終難易度へ移動しません');

  await page.getByRole('button', { name:'全WAVE詳細' }).last().click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  if (await dialog.getByText(/^W\d+$/).count() !== 10) throw new Error('全10 WAVEが表示されません');
  await dialog.getByRole('button', { name:'閉じる' }).click();
  await dialog.waitFor({ state:'hidden' });

  await page.getByRole('heading', { name:'バトル' }).locator('..').getByRole('button').click();
  await page.getByRole('button', { name:'バトル' }).waitFor();
  await openBattleMenu();
  await page.getByRole('button', { name:'この難易度で挑戦' }).first().click();
  await page.getByRole('heading', { name:'勇者モンを選択' }).waitFor();
  if (exceptions.length) throw new Error(`JavaScript例外: ${exceptions.join(' / ')}`);

  console.log('OK: 390x844で難易度画面、例外ゼロ、矢印・スワイプ、全WAVE、戻る、再入場、勇者選択を確認');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
