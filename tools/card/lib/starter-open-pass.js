// MFバトルカード: はじめのスターターを受け取ったあとの「開ける画面」を、検査の中で最後まで通す(2026-10-27 カード部パックくん)
//   「◯◯にする」を押すと、練習試合の前に、パックと同じ開ける画面が入るようになった(社長「最初に手に入れたときも」)。
//   練習試合や対戦の画面を見たい検査は、「にする」を押したあとにこれを呼ぶ:
//     await require('<このファイル>')(page);
//   破る → 1束ずつ「全部めくる」→「つぎへ」→ 一覧 → 「練習試合へ」。開ける画面が出なければ何もしない(false を返す)
module.exports = async (page) => {
  const opened = await page.locator('[data-card-pack-open]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  if (!opened) return false;
  for (let k = 0; k < 8; k++) {
    if (await page.locator('[data-card-pack-tear]').count()) await page.locator('[data-card-pack-tear]').dispatchEvent('click');
    await page.locator('[data-card-pack-open][data-card-pack-phase="open"]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-pack-flip-all]').dispatchEvent('click').catch(() => {});
    await page.waitForFunction(() => !document.querySelectorAll('[data-card-pack-card][data-card-pack-flipped="0"]').length, null, { timeout: 20000 });
    if (await page.locator('[data-card-pack-next]').count()) { await page.locator('[data-card-pack-next]').dispatchEvent('click'); continue; }
    break;
  }
  if (await page.locator('[data-card-pack-list-open]').count()) await page.locator('[data-card-pack-list-open]').dispatchEvent('click');
  await page.locator('[data-card-pack-done]').dispatchEvent('click');
  return true;
};
