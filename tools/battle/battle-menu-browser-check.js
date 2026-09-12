const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 390x844 の実ブラウザで HOME → 難易度画面の主要導線と例外ゼロを確認する。
// 実行前に `python3 tools/serve.py` でリポジトリルートを配信する。
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';

(async () => {
  // このサンドボックスのChromiumは /opt/pw-browsers/chromium にある(npmの取得はしない)
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage({ viewport: { width:390, height:844 } });
  const exceptions = [];
  page.on('pageerror', error => exceptions.push(error.message));
  // ★はじめての案内をとばす鍵は mh_intro_done ではなく mh_onboarded。
  //   起動画面と「はじめる」は pointerdown で拾う作りなので click() では進まない(2026-09-07に追随)
  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_breeder_icon', 'Mocchi');
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
  });
  await page.goto(URL, { waitUntil:'load', timeout:60000 });
  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true }));
    return !!b;
  }, find);
  // ログインボーナス・ギフト・更新のお知らせが出ていたら送り切って閉じる
  const dismissOverlays = async () => {
    // お知らせは何枚も続けて出る(ログインボーナス → ギフト → 更新 → 助手の告知)。
    // 1枚閉じると次が出てくるので、2回続けて「何も無い」まで送る
    let quiet = 0;
    for (let i = 0; i < 40 && quiet < 2; i++) {
      const closed = await page.evaluate(() => {
        // ダイアログが出ているときは、その中の最後のボタン(閉じる側)を押す。
        // 助手の告知は「◯◯を見る / 今は見ない」のように、閉じる言い方が場面ごとに変わる
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const inner = [...dialog.querySelectorAll('button')];
          if (inner.length) { inner[inner.length - 1].click(); return true; }
          dialog.click(); return true;
        }
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|とじる|OK|つぎへ|次へ|はじめる|今は見ない|あとで|スキップ|やめる)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!closed) { quiet++; await page.waitForTimeout(600); continue; }
      quiet = 0;
      await page.waitForTimeout(400);
    }
  };
  await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout:40000 }).catch(() => {});
  await pointerDown({ text:'TAP TO START' }); await page.waitForTimeout(2200);
  await pointerDown({ aria:'トップ画面へ進む' }); await page.waitForTimeout(2200);
  await dismissOverlays();
  // ★この検査はカードの高さ・スクロール・ボタンが画面内に収まるかを実測する。
  //   Tailwind の CSS が無いと素の縦積みになってしまい、測っても意味が無いうえ、
  //   要素が重なって Playwright のクリックも通らない。CDN が届かない環境では飛ばす
  //   (docs/refactor/BASELINE_2026-09.md の bgm-arrangement-layout-check と同じ理由)。
  const tailwindReady = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'w-12';
    document.body.appendChild(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return Math.round(w) === 48;
  });
  if (!tailwindReady) {
    console.log('SKIP: 難易度画面の実測は飛ばす(TailwindのCSSが読めない環境のため)');
    await browser.close();
    process.exit(0);
  }
  await page.getByRole('button', { name:'バトル' }).waitFor();

  const openBattleMenu = async () => {
    await page.getByRole('button', { name:'バトル' }).click();
    await page.getByRole('heading', { name:'バトル' }).waitFor();
    await page.getByRole('button', { name:'前の難易度' }).waitFor();
    await page.getByRole('button', { name:'次の難易度' }).waitFor();
    await page.getByText('BATTLE DIFFICULTY').first().waitFor();
  };
  await openBattleMenu();

  const activeCard = page.locator('.snap-mandatory > article').filter({ hasText:'Normal' });
  const cardLayout = await activeCard.evaluate(card => {
    const rect = card.getBoundingClientRect();
    const challenge = [...card.querySelectorAll('button')].find(button => button.textContent.includes('この難易度で挑戦')).getBoundingClientRect();
    const title = card.querySelector('h3').getBoundingClientRect();
    return { scrollable:card.scrollHeight > card.clientHeight, inside:rect.top >= 0 && challenge.bottom <= innerHeight, titleVisible:title.height > 0 && title.top >= 0, pageY:scrollY, right:rect.right };
  });
  if (cardLayout.scrollable || !cardLayout.inside || !cardLayout.titleVisible || cardLayout.pageY !== 0 || cardLayout.right > 390) throw new Error(`難易度カードが1画面に収まりません: ${JSON.stringify(cardLayout)}`);

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
  for (let wave=1; wave<=10; wave++) {
    const card = dialog.locator(`[data-wave="${wave}"]`);
    const expected = await card.evaluate(node => ({ name:node.querySelector('[data-wave-art]').nextElementSibling.querySelector('b').textContent.trim(), hp:node.querySelector('[data-wave-stats] b').textContent.trim() }));
    await card.scrollIntoViewIfNeeded();
    await card.click();
    const scan = page.getByRole('dialog', { name:'敵行動詳細' });
    await scan.waitFor();
    await scan.getByText(`WAVE ${wave}・戦闘開始前`).waitFor();
    await scan.getByRole('heading', { name:expected.name }).waitFor();
    if (!await scan.getByText(expected.hp, { exact:true }).count()) throw new Error(`W${wave}のHPがSCANへ渡っていません`);
    await scan.getByRole('button', { name:'戻る' }).click();
    await scan.waitFor({ state:'hidden' });
    await dialog.waitFor();
  }
  const wave10 = dialog.locator('[data-wave="10"]');
  await wave10.scrollIntoViewIfNeeded();
  const layout = await dialog.evaluate(node => {
    const cards = [...node.querySelectorAll('[data-wave]')];
    const boss = node.querySelector('[data-wave="10"]');
    const bossImage = boss.querySelector('img').getBoundingClientRect();
    const bossRect = boss.getBoundingClientRect();
    const textRects = [...boss.querySelectorAll('b, span')].map(el => el.getBoundingClientRect());
    return {
      bossImageWidth:bossImage.width,
      otherImageWidths:cards.slice(0, -1).map(card => card.querySelector('img')?.getBoundingClientRect().width || 0),
      nameLefts:cards.map(card => card.querySelector('[data-wave-art]').nextElementSibling.getBoundingClientRect().left),
      statsRights:cards.map(card => card.querySelector('[data-wave-stats]').getBoundingClientRect().right),
      cardsInside:cards.every(card => card.scrollWidth <= card.clientWidth),
      inside:bossImage.left >= bossRect.left && bossImage.right <= bossRect.right && bossImage.top >= bossRect.top && bossImage.bottom <= bossRect.bottom,
      overlapsText:textRects.some(rect => bossImage.left < rect.right && bossImage.right > rect.left && bossImage.top < rect.bottom && bossImage.bottom > rect.top),
    };
  });
  if (layout.bossImageWidth <= Math.max(...layout.otherImageWidths)) throw new Error('ムーが一覧内で最大表示ではありません');
  if (!layout.inside || layout.overlapsText) throw new Error('ムー画像がカード外または文字へ重なっています');
  if (Math.max(...layout.nameLefts)-Math.min(...layout.nameLefts)>1) throw new Error('敵名の基準位置がWAVE間で揃っていません');
  if (Math.max(...layout.statsRights)-Math.min(...layout.statsRights)>1) throw new Error('能力値の右端がWAVE間で揃っていません');
  if (!layout.cardsInside) throw new Error('WAVEカード内の要素が横にはみ出しています');
  await dialog.screenshot({ path:path.join(TOOLS_DIR, 'out', 'battle-wave-details-390x844.png') });
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
