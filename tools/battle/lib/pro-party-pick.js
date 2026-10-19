// プロモードの編成(ProPartyPicker)を、検査から通す手伝い。
// 2026-10-19 から「① 上の枠へ好きな順で入れる → ② 入れた子から勇者モンを選ぶ」になった(社長「プロモードもこの仕様のほうが見やすい」)。
// heroName を勇者モンにし、残りの枠は一覧の先頭から順に埋める。うまくいけば null、だめなら理由の文字を返す。
async function pickProParty(page, heroName) {
  try { await page.waitForSelector('[data-pro-party]', { timeout: 15000 }); } catch (e) { return 'プロモードの編成の枠が出ない'; }
  // 前回使った子が入っていれば、いったん全部外す(どの子が入るかを検査で決める)
  for (let i = 0; i < 12; i++) {
    const filled = page.locator('[data-pro-party-slot][aria-label$="を枠から外す"]');
    if (await filled.count() === 0) break;
    await filled.first().click();
  }
  const put = async (name) => {
    const shown = await page.evaluate((n) => {
      const grid = document.querySelector('[data-pro-pick-scroll]');
      const b = grid && [...grid.querySelectorAll('button')].find((x) => !x.disabled && x.getAttribute('aria-label') === `${n}を見る`);
      if (b) b.click();
      return !!b;
    }, name);
    if (!shown) return false;
    const go = page.getByRole('button', { name: `${name}を枠に入れる`, exact: true });
    if (await go.count() === 0) return false;
    await go.click();
    return true;
  };
  if (!(await put(heroName))) return `勇者モンに ${heroName} が並んでいない`;
  for (let i = 0; i < 12 && !(await page.locator('[data-pro-party-next]').isEnabled()); i++) {
    const name = await page.evaluate(() => {
      const chosen = new Set([...document.querySelectorAll('[data-pro-party-slot][aria-label$="を枠から外す"]')].map((x) => x.getAttribute('aria-label').replace(/を枠から外す$/, '')));
      const grid = document.querySelector('[data-pro-pick-scroll]');
      const b = grid && [...grid.querySelectorAll('button[aria-label$="を見る"]')].find((x) => !x.disabled && !chosen.has(x.getAttribute('aria-label').replace(/を見る$/, '')));
      return b ? b.getAttribute('aria-label').replace(/を見る$/, '') : null;
    });
    if (!name || !(await put(name))) return '供モンの候補で枠を埋められない';
  }
  await page.locator('[data-pro-party-next]').click();
  const heroBtn = page.getByRole('button', { name: `${heroName}を勇者モンにする`, exact: true });
  if (await heroBtn.count() === 0) return `② で ${heroName} を勇者モンに選べない`;
  await heroBtn.click();
  await page.locator('[data-pro-party-done]').click();
  return null;
}
module.exports = { pickProParty };
