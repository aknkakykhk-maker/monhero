// 固有技のオリジナル強化(2026-11-07)を、実際のブラウザで確かめる。
//
//   node tools/masu/unique-boost-browser-check.js   (UB_SHOT_DIR=<フォルダ> で縦・横の止め絵も撮る)
//
// 見るのは次のとおり。
//   ① マスモン詳細の「固有技強化」に、Lv.8 の技だけ「✨ オリジナル強化」が出る
//   ② シートは3タブ。ゴーレムの技では 連撃ダメージ・連撃数 が灰色、ザンの技(引き継ぎ)では押せる
//   ③ +1・MAX で下書きし、「強化を確定」で保存(固有技Pが減り、uniqueSkillBoosts に入る)。行に要約が出る
//   ④ 総合力の札を押すと内わけが開き、オリジナル強化の行が出る
//   ⑤ 縦・横で横にはみ出さず、実行時エラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');

// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8996;
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
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const SHOT = process.env.UB_SHOT_DIR || '';
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOT ? 2 : 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_unique_lineage_dedupe_migrated_v1', JSON.stringify(true));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Golem', 'Zan', 'Pixie', 'Suezo']));
      const zan = { name: 'リバースレイド', monId: 'Zan', lineageId: 'Zan', inheritedUniqueId: 'ubz1', sourceMasuName: 'ザンさん', baseMult: 2.4, baseGuts: 44, evoLevel: 8 };
      localStorage.setItem('mh_masu_mons', JSON.stringify([
        { id: 'ub-m1', baseId: 'Golem', name: '検査ゴーレム', bondXp: 300, createdAt: 1, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
          inheritedUniques: [zan], uniqueSkillLevels: { own: 8, 'inhId:ubz1': 8 }, uniqueSkillPoints: 30000 },
        { id: 'ub-m2', baseId: 'Suezo', name: '検査スエゾー', bondXp: 300, createdAt: 2, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, uniqueSkillLevels: { own: 3 } },
      ]));
      localStorage.setItem('mh_owned_items', JSON.stringify({ unique_skill_reset_ticket: 1 }));
      localStorage.setItem('mh_monster_roster', JSON.stringify(['masu:ub-m1', 'masu:ub-m2']));
    });
    await page.addInitScript(eventStorySeed());
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 8; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|あとで/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'M/B管理' }).first().dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.getByText(/マスモン一覧/).first().dispatchEvent('click');
    await page.waitForTimeout(400);
    await page.getByText('検査ゴーレム').first().waitFor({ timeout: 20000 });
    await page.getByText('検査ゴーレム').first().dispatchEvent('click');
    await page.locator('[data-unique-boost-open]').first().waitFor({ timeout: 20000 });
    check('① Lv.8 の技(2つ)に「✨ オリジナル強化」が出る', await page.locator('[data-unique-boost-open]').count() === 2);
    if (SHOT) { await page.locator('[data-unique-boost-open]').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await page.screenshot({ path: `${SHOT}/01-詳細-固有技強化の枠-縦.png` }); }
    // ゴーレム(自前)の技を開く
    await page.locator('[aria-label*="合掌"][data-unique-boost-open], [data-unique-boost-open]').first().dispatchEvent('click');
    await page.locator('[data-unique-boost-sheet]').waitFor({ timeout: 10000 });
    const gray = async (id) => (await page.locator(`[data-unique-boost-row="${id}"]`).getAttribute('data-unique-boost-applies')) === '0';
    check('② 攻撃タブ: 5行、ゴーレムの技では連撃ダメージ・連撃数が灰色', await page.locator('[data-unique-boost-row]').count() === 5 && await gray('comboDamage') && await gray('comboCount') && !(await gray('power')));
    if (SHOT) await page.screenshot({ path: `${SHOT}/02-シート-攻撃タブ-縦.png` });
    await page.locator('[data-unique-boost-row="power"] button[aria-label="威力を10上げる"]').dispatchEvent('click');
    await page.waitForTimeout(300);
    await page.locator('[data-unique-boost-row="power"] button[aria-label="威力を1つ上げる"]').dispatchEvent('click');
    await page.locator('[data-unique-boost-tab="slayer"]').dispatchEvent('click');
    check('② 特攻タブ: 8行', await page.locator('[data-unique-boost-row]').count() === 8);
    await page.locator('[data-unique-boost-row="mooSlayer"] button[aria-label="ムー特攻を1つ上げる"]').dispatchEvent('click');
    if (SHOT) await page.screenshot({ path: `${SHOT}/03-シート-特攻タブ-縦.png` });
    await page.locator('[data-unique-boost-tab="support"]').dispatchEvent('click');
    check('② 補助タブ: 6行・ゴーレムでは回復の量・効果の長さ・効果の確率が灰色', await page.locator('[data-unique-boost-row]').count() === 6 && await gray('healAmount') && await gray('effectDuration') && await gray('effectChance') && !(await gray('evade')));
    await page.locator('button[aria-label="効果の長さの説明"]').dispatchEvent('click');
    await page.waitForTimeout(200);
    const help = (await page.locator('[role="dialog"][aria-label="効果の長さの説明"]').innerText()).replace(/\s+/g, ' ');
    check('② ?で説明が出る(灰色の種類は「この技には効果がありません」)', /続くターンが長くなります/.test(help) && /5,000Pで\+1ターン・最大\+1ターン/.test(help) && /この技には効果がありません/.test(help), help);
    if (SHOT) await page.screenshot({ path: `${SHOT}/04-種類の説明-縦.png` });
    await page.getByRole('button', { name: '閉じる' }).last().dispatchEvent('click');
    await page.waitForTimeout(200);
    if (SHOT) await page.screenshot({ path: `${SHOT}/05-シート-補助タブ-縦.png` });
    await page.locator('[data-unique-boost-commit]').dispatchEvent('click');
    await page.waitForTimeout(600);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]').find(m => m.id === 'ub-m1'));
    check('③ 確定で保存: 威力11目盛り・ムー特攻1目盛り、固有技Pが1,200減る', saved && saved.uniqueSkillBoosts && saved.uniqueSkillBoosts.own.power === 11 && saved.uniqueSkillBoosts.own.mooSlayer === 1 && saved.uniqueSkillPoints === 28800, JSON.stringify(saved && { b: saved.uniqueSkillBoosts, p: saved.uniqueSkillPoints }));
    const summary = await page.locator('[data-unique-boost-summary]').first().innerText();
    check('③ 技の行に要約が出る', /威力\+1\.1%・ムー特攻\+0\.2%/.test(summary), summary);
    // ザン(引き継いだ技)では連撃数が押せる
    await page.locator('[data-unique-boost-open]').nth(1).dispatchEvent('click');
    await page.locator('[data-unique-boost-sheet]').waitFor({ timeout: 10000 });
    check('② ザンの技では連撃ダメージ・連撃数が押せる', !(await gray('comboDamage')) && !(await gray('comboCount')));
    await page.locator('[data-unique-boost-row="comboCount"] button[aria-label="連撃数を上げられるだけ上げる"]').dispatchEvent('click');
    const comboText = await page.locator('[data-unique-boost-row="comboCount"]').innerText();
    check('連撃数は MAX で +2本(P 28,800 で買えるぶん。上限は+3本)', /\+0本 → \+2本/.test(comboText.replace(/\s+/g, ' ')), comboText.replace(/\s+/g, ' '));
    for (const [w, h, name] of [[844, 390, '横'], [320, 568, '縦-小']]) {
      await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const sheetBox = await page.locator('[data-unique-boost-sheet] > div').first().boundingBox();
      check(`⑤ シートが${name}(${w}×${h})で横にはみ出さず、画面に収まる`, over <= 0 && sheetBox && sheetBox.y >= -1 && sheetBox.y + sheetBox.height <= h + 1, JSON.stringify(sheetBox));
      if (SHOT) await page.screenshot({ path: `${SHOT}/06-シート-連撃数-${name}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    await page.locator('[data-unique-boost-commit]').dispatchEvent('click');
    await page.waitForTimeout(600);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]').find(m => m.id === 'ub-m1'));
    check('③ 引き継いだ技にも保存(連撃数2本・20,000P)', saved2.uniqueSkillBoosts['inhId:ubz1'].comboCount === 2 && saved2.uniqueSkillPoints === 8800, JSON.stringify(saved2.uniqueSkillBoosts));
    // ④ 総合力の内わけ
    await page.locator('[data-power-breakdown-toggle]').first().dispatchEvent('click');
    await page.waitForTimeout(300);
    const bd = (await page.locator('[data-power-breakdown]').first().innerText()).replace(/\s+/g, ' ');
    check('④ 総合力の内わけにオリジナル強化(使った固有技P 21,200 → +212,000)が出る', /オリジナル強化/.test(bd) && /21,200/.test(bd) && /\+212,000/.test(bd), bd);
    if (SHOT) {
      await page.locator('[data-power-breakdown]').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
      await page.screenshot({ path: `${SHOT}/07-総合力の内わけ-縦.png` });
      await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT}/08-総合力の内わけ-横.png` });
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300);
    }
    const overDetail = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('⑤ 詳細が縦で横にはみ出さない', overDetail <= 0, String(overDetail));
    check('⑤ 実行時エラーが出ない', errors.length === 0, errors.join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
