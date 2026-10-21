// 助手の仲良し度の節目のごほうび(2026-10-21)を実ブラウザで見る。
//
//   python3 tools/serve.py 8899 を立ててから
//   node tools/assistant-bond-reward-browser-check.js   (SHOT_DIR=<フォルダ> でギフト画面とプロフィールの写真も残す)
//
//   ① もう Lv30(みゅあ)・Lv25(きき)の人が起動すると、越えた節目のぶん(4+2)がギフトボックスへまとめて届く
//   ② 届けた印 mh_assistant_bond_rewards_v1 が保存される
//   ③ 開き直しても、受け取ったあとでも、二重に届かない
//   ④ ギフトボックスに「仲良し度」の札付きで並び、プロフィールに Lv30 が出る
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { quietBootSeed, updateNoticeSeed } = require('./boot/quiet-boot-seed');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// 必要な仲良し度は本体のデータから読む
const levels = fs.readFileSync(path.join(__dirname, '..', 'monster-hero/data/assistants.js'), 'utf8');
const needOf = (lv) => Number((levels.match(new RegExp(`\\{ level:${lv}, +need:(\\d+)`)) || [])[1]);

const seed = ({ mua, kiki }) => {
  const put = (k, v) => { if (localStorage.getItem('__seeded')) return; localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  put('mh_assistant_selected_v1', 'mua');
  // プロフィールで出る「解放の案内」は写真を隠すので、見たことにする
  put('mh_assistant_unlock_seen_v1', ['unlock_call_style_v1','unlock_profile_frame_v1','unlock_species_challenge_v1', 'unlock_profile_frame_v1']);
  put('mh_assistant_bond_v1', { points: mua, day: null, daily: {}, dailyTotal: 0 });
  put('mh_assistant_bond_kiki_v1', { points: kiki, day: null, daily: {}, dailyTotal: 0 });
  localStorage.setItem('__seeded', '1');
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
      const b = [...dialog.querySelectorAll('button')].find(x => /閉じる|あとで|スキップ|確認|OK/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => !!document.querySelector('button[aria-label="モンヒロバトル"]'))) break;
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(800);
  }
};
const bondGifts = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('mh_gifts') || '[]') || [])
  .filter(g => String(g.id).startsWith('gift_assistant_bond_')).map(g => ({ id: g.id, claimed: !!g.claimedAt })));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed, { mua: needOf(30), kiki: needOf(25) });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await openHome(page);
    await page.waitForFunction(() => !!localStorage.getItem('mh_assistant_bond_rewards_v1'), { timeout: 15000 }).catch(() => {});
    const first = await bondGifts(page);
    check('① 越えた節目のぶんがまとめて届く(みゅあ4・きき2)', first.length === 6, first.map(g => g.id).join(','));
    const mark = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_bond_rewards_v1') || 'null'));
    check('② 届けた印が保存される', JSON.stringify(mark) === JSON.stringify({ mua: [22, 25, 28, 30], kiki: [22, 25] }), JSON.stringify(mark));

    // ギフトボックスを開く
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.className.includes('mh-home-gift'))?.click());
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body.innerText);
    check('④ ギフトボックスに並ぶ', text.includes('みゅあとの仲良し度 Lv30 のごほうび') && text.includes('ききとの仲良し度 Lv25 のごほうび'));
    check('④ 「仲良し度」の札が付く', text.includes('仲良し度'));
    if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, 'gift-box-390.png') }); }
    // すべて受け取る
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('すべて受け取る') && !b.disabled)?.click());
    await page.waitForTimeout(1500);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, 'gift-claimed-390.png') });
    const claimed = await bondGifts(page);
    check('受け取れる', claimed.length === 6 && claimed.every(g => g.claimed), JSON.stringify(claimed));
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); [...(d ? d.querySelectorAll('button') : [])].find(x => /閉じる|OK/.test(x.textContent))?.click(); });
      await page.waitForTimeout(400);
    }
    // 受け取ったギフトを一覧から消してから開き直す(古いギフトが消えたときと同じ)
    await page.evaluate(() => {
      const g = JSON.parse(localStorage.getItem('mh_gifts') || '[]');
      localStorage.setItem('mh_gifts', JSON.stringify(g.filter(x => !String(x.id).startsWith('gift_assistant_bond_'))));
    });
    await page.reload({ waitUntil: 'load' });
    await openHome(page);
    await page.waitForTimeout(3000);
    const again = await bondGifts(page);
    check('③ 開き直しても二重に届かない', again.length === 0, JSON.stringify(again));
    // プロフィールの Lv の表示
    await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
    await page.waitForTimeout(1500);
    // 飾り枠をもらった案内(Lvが上がった扱いで出る)を読み進めて閉じる
    for (let i = 0; i < 12; i++) {
      const more = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(次へ|閉じる|とじる|OK|わかった)/.test(x.textContent.trim()) && x.closest('.fixed')); if (b) b.click(); return !!b; });
      await page.waitForTimeout(500);
      if (!more) break;
    }
    const prof = await page.evaluate(() => document.body.innerText);
    check('④ プロフィールに Lv30 と段階の名前が出る', /Lv\.30/.test(prof) && prof.includes('永遠のその先へ'));
    if (SHOT_DIR) {
      await page.evaluate(() => [...document.querySelectorAll('div')].find(d => d.textContent.trim().endsWith('との仲良し度') && d.children.length === 0)?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(SHOT_DIR, 'profile-bond-lv30-390.png') });
    }
    check('実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
