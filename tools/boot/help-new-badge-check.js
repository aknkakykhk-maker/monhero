const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ヘルプの🆕(2026-10-18 社長「新しくヘルプに載ったやつは🆕のマークみたいなのつけといて」)を実ブラウザで見る。
//
//   node tools/boot/help-new-badge-check.js   (SHOT_DIR=<フォルダ> で画面の写真も残す)
//
//   ① 載せてから14日以内の項目(added)に🆕が付き、そのカテゴリにも付く
//   ② 開いた項目の🆕は消え、mh_help_new_seen_v1 に覚える
//   ③ added の書式が正しい(YYYY-MM-DD)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { quietBootSeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const help = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero/data/help.js'), 'utf8');
const added = [...help.matchAll(/^\s+id: *'[^']+', added:'([^']*)'/gm)].map((m) => m[1]);
check('③ added の書式', added.length > 0 && added.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), added.join(', '));
// いちばん新しい added の日に時計を合わせる(いつ回しても①を確かめられるように)
const newest = added.slice().sort().pop();
const FAKE_NOW = Date.parse(`${newest}T12:00:00+09:00`);

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
};

const openHome = async (page) => {
  const pointerDown = (sel) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, sel);
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await pointerDown({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;
      const b = [...dialog.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ|確認|OK/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }
  // 告知からよその画面(ギフトボックスなど)へ飛んでいることがあるので、HOMEへ戻るまで「戻る」を押す
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break;
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);
  }
};

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript((now) => { const real = Date.now.bind(Date); const off = now - real(); Date.now = () => real() + off; }, FAKE_NOW);
    await page.addInitScript(seed);
    await page.addInitScript(quietBootSeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await openHome(page);
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    const catNew = await page.evaluate(() => [...document.querySelectorAll('[data-help-new]')].map(b => b.closest('button')?.innerText.split('\n')[0] || ''));
    check('① カテゴリに🆕が付く', catNew.length > 0, catNew.join(' / '));
    if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, 'help-top.png') }); }
    // 🆕の付いたカテゴリを開く
    await page.evaluate(() => document.querySelector('[data-help-new]')?.closest('button')?.click());
    await page.waitForTimeout(500);
    const topicNew = await page.evaluate(() => [...document.querySelectorAll('[data-help-new]')].map(b => b.closest('button')?.innerText.split('\n')[0] || ''));
    check('① 項目に🆕が付く', topicNew.length > 0, topicNew.join(' / '));
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, 'help-category.png') });
    const first = topicNew[0];
    await page.evaluate(() => document.querySelector('[data-help-new]')?.closest('button')?.click());
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: '項目一覧へ' }).dispatchEvent('click');
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => [...document.querySelectorAll('[data-help-new]')].map(b => b.closest('button')?.innerText.split('\n')[0] || ''));
    check('② 開いた項目の🆕は消える', !after.includes(first) && after.length === topicNew.length - 1, `${first} → 残り ${after.join(' / ') || 'なし'}`);
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_help_new_seen_v1') || '[]'));
    check('② 開いた項目を新しいキーに覚える', Array.isArray(seen) && seen.length === 1, JSON.stringify(seen));
  } finally { await browser.close(); }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
