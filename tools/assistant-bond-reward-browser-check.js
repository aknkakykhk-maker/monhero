// 助手の仲良し度のLvごとのごほうび(Lv2〜30・2026-10-21)を実ブラウザで見る。
//
//   python3 tools/serve.py 8899 を立ててから
//   node tools/assistant-bond-reward-browser-check.js   (WIDTH=320 で狭い画面。SHOT_DIR=<フォルダ> でギフト画面とプロフィールの写真も残す)
//
//   ① もう Lv30(みゅあ)・Lv25(きき)の人が起動すると、越えたLvのぶん(29+24)がギフトボックスへまとめて届く。
//      ききは最初の量(#3241)を Lv22・25 で受け取っている(v1 の印)ので、その2つは差のぶんだけ「追加ぶん」で届く
//   ② 今の量の印 mh_assistant_bond_rewards_v2 が保存され、v1 の印は変わらない
//   ③ 開き直しても、受け取ったあとでも、二重に届かない。桁の大きいダイヤでも所持数の表示が崩れない
//   ④ ギフトボックスに「仲良し度」の札付きで並び、プロフィールの「ごほうび一覧」で Lv2〜30 ともらった所・次が分かる
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { quietBootSeed, updateNoticeSeed } = require('./boot/quiet-boot-seed');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const SHOT_DIR = process.env.SHOT_DIR || '';
// WIDTH=320 で狭い画面でも見る(写真の名前にも幅が入る)
const W = Number(process.env.WIDTH) || 390;
let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// 必要な仲良し度は本体のデータから読む
const levels = fs.readFileSync(path.join(__dirname, '..', 'monster-hero/data/assistants.js'), 'utf8');
const needOf = (lv) => Number((levels.match(new RegExp(`\\{ level:${lv}, +need:(\\d+)`)) || [])[1]);

const seed = ({ mua, kiki }) => {
  const put = (k, v) => { if (localStorage.getItem('__seeded')) return; localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
  put('mh_assistant_selected_v1', 'kiki');
  // ききは #3241 の最初の量を Lv22・25 で受け取っている
  put('mh_assistant_bond_rewards_v1', { kiki: [22, 25] });
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
    const page = await browser.newPage({ viewport: { width: W, height: W === 320 ? 568 : 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed, { mua: needOf(30), kiki: needOf(25) });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await openHome(page);
    await page.waitForFunction(() => !!localStorage.getItem('mh_assistant_bond_rewards_v2'), { timeout: 15000 }).catch(() => {});
    const first = await bondGifts(page);
    check('① 越えたLvのぶんがまとめて届く(みゅあ29・きき24)', first.length === 53, String(first.length));
    check('① ききの Lv22・25 は差のぶんだけ(追加ぶん)', first.filter(g => g.id.endsWith('_topup')).map(g => g.id).sort().join() === 'gift_assistant_bond_v2_kiki_lv22_topup,gift_assistant_bond_v2_kiki_lv25_topup');
    const mark = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_bond_rewards_v2') || 'null'));
    check('② 今の量の印が保存される', mark && mark.mua.length === 29 && mark.kiki.length === 24, JSON.stringify(mark).slice(0, 60));
    const v1 = await page.evaluate(() => localStorage.getItem('mh_assistant_bond_rewards_v1'));
    check('② 最初の量の印は変わらない', v1 === JSON.stringify({ kiki: [22, 25] }), v1);

    // ギフトボックスを開く
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.className.includes('mh-home-gift'))?.click());
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body.innerText);
    check('④ ギフトボックスに並ぶ', text.includes('ききとの仲良し度 Lv25 のごほうび(追加ぶん)') && text.includes('ききとの仲良し度 Lv24 のごほうび'));
    check('④ 「仲良し度」の札が付く', text.includes('仲良し度'));
    if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `gift-box-${W}.png`) }); }
    // すべて受け取る
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('すべて受け取る') && !b.disabled)?.click());
    await page.waitForTimeout(1500);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `gift-claimed-${W}.png`) });
    const claimed = await bondGifts(page);
    // 受け取り済みは新しい50件に整理される(GIFT_HISTORY_LIMIT)ので、残っているものが全部受け取り済みならよい
    check('受け取れる', claimed.length >= 50 && claimed.every(g => g.claimed), `${claimed.length}件`);
    const gold = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_gold') || '0'));
    // みゅあ Lv2〜30 の 1,684,190,000 + きき Lv2〜25 の 644,190,000 − ききが前に受け取った 50,000(ほかのギフトのダイヤはその上に乗る)
    check('③ ダイヤは数として足される(桁が大きくても)', Number.isFinite(gold) && gold >= 2328330000 && gold < 2328330000 + 1000000, gold.toLocaleString());
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
    // HOME の所持数の表示が、桁の大きいダイヤで崩れない(はみ出さない)
    const homeOverflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => /[0-9,]{11,}/.test(el.textContent || '') && el.children.length === 0)
      .some(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1; }));
    check('③ HOME のダイヤの表示が横にはみ出さない', !homeOverflow);
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `home-${W}.png`) });
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
    check('④ プロフィールに Lv25 が出る', /Lv\.25/.test(prof));
    // ごほうび一覧
    await page.evaluate(() => document.querySelector('[data-assistant-bond-reward-open]')?.click());
    await page.waitForTimeout(800);
    const list = await page.evaluate(() => {
      const root = document.querySelector('[data-assistant-bond-reward-list]');
      const rows = [...document.querySelectorAll('[data-bond-reward-level]')];
      const box = root && root.closest('[role="dialog"]') && root.getBoundingClientRect();
      return { who: root && root.dataset.assistantBondRewardList, levels: rows.map(r => Number(r.dataset.bondRewardLevel)),
        states: Object.fromEntries(rows.map(r => [r.dataset.bondRewardLevel, r.dataset.bondRewardState])),
        frames: [...document.querySelectorAll('[data-bond-reward-frame]')].map(f => `${f.closest('[data-bond-reward-level]').dataset.bondRewardLevel}:${f.dataset.bondRewardFrame}`),
        text: root ? root.innerText : '', overflow: !!box && (box.right > innerWidth + 1 || [...root.querySelectorAll('*')].some(el => el.getBoundingClientRect().right > innerWidth + 1)) };
    });
    check('④ 一覧は選んでいる助手(きき)の Lv2〜30', list.who === 'kiki' && list.levels.join() === Array.from({ length: 29 }, (_, i) => i + 2).join(), list.levels.join());
    check('④ もらった所・次・まだが分かる', list.states['25'] === 'got' && list.states['26'] === 'next' && list.states['27'] === 'later' && list.states['2'] === 'got');
    check('④ 飾り枠(Lv2・5・7)が絵つきで並ぶ', list.frames.join() === '2:frame_kiki_ouen,5:frame_kiki_honki,7:frame_kiki_zenryoku', list.frames.join());
    check('④ Lv6 の呼び方とごほうびの品が並ぶ', list.text.includes('呼び方を自由に決められる') && /ダイヤ ×500,000,000/.test(list.text) && list.text.includes('勇者の証'));
    check(`④ 幅${W}で一覧が横にはみ出さない`, !list.overflow);
    if (SHOT_DIR) {
      await page.screenshot({ path: path.join(SHOT_DIR, `profile-reward-list-${W}.png`) });
      await page.evaluate(() => document.querySelector('[data-bond-reward-level="2"]')?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOT_DIR, `profile-reward-list-top-${W}.png`) });
    }
    check('実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
