// MFバトルカード: ほかのブリーダーの登録デッキと戦う前に、自分のデッキを選べる(2026-10-31 テスターさんの要望)を、実際の画面で確かめる。
//   node tools/card/card-share-deck-pick-browser-check.js  (1分ほど)
// ① フリー対戦の「ほかのブリーダー」タブで「戦う」を押すと、すぐ対戦にならず、助手と対戦と同じデッキ選びが出る(前に使ったデッキが選ばれている)
// ② デッキ選びの「戻る」で、「ほかのブリーダー」タブへ戻る
// ③ 借りたデッキのタブは出ない(ごほうびの扱いを変えないため)
// ④ 「このデッキで対戦」で、選んだデッキで対戦が始まる
// ⑤ 一覧の「詳細」で、名前・3体・全カード・賢さ・数字が見られ、そこからも「戦う」でデッキ選びへ進む
// 登録デッキの一覧(card_deck_entries)は、検査の中で1人ぶんを返す(本番のサーバには書かない)
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else failed++; if (!ok || process.argv.includes('-v')) console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); return; }
  const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8987;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // 本番のサーバーへは書かない(外へは GET だけ通す)
    let shareRow = null;
    await page.route('**/*', (route) => {
      const rq = route.request(); const u = new URL(rq.url());
      if (u.hostname === 'localhost') return route.continue();
      // 登録デッキの一覧: 検査の相手を1人だけ返す
      if (/\/rest\/v1\/card_deck_entries/.test(u.pathname) && rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shareRow ? [shareRow] : []) });
      if (rq.method() === 'GET') return route.continue();
      return route.abort();
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.addInitScript(eventStorySeed());
    const get = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return 'こわれ'; } }, k);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) { const x = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (!(await x.count()) || !(await x.isVisible().catch(() => false))) break; await x.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
    await page.waitForTimeout(800);
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
    await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // 検査の相手: 自分のスターターのデッキを、ほかのブリーダーが登録した形にする
    const decks = await get('mh_card_decks_v1');
    const d0 = decks && decks.decks && decks.decks[0];
    shareRow = { owner_id: 'check-breeder-1', user_name: '検査の相手', icon: null, profile_frame: null, deck: { monsters: d0.monsters, cards: d0.cards }, tactics: {}, version: 1, active: true, battles: 0, deck_wins: 0, rents: 0, updated_at: new Date().toISOString() };
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator('[data-card-foe-tab="breeder"]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-foe-tab="breeder"]').click();
    const fight = page.locator('[data-card-share-fight="check-breeder-1"]');
    await fight.waitFor({ timeout: 15000 });
    await fight.click();
    const picked = await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('① 「戦う」を押すと、すぐ対戦にならず、デッキ選びが出る', picked && (await page.locator('[data-card-battle]').count()) === 0);
    const on = await page.locator('[data-card-deck-pick-on]').getAttribute('data-card-deck-pick-row').catch(() => null);
    check('① 前に使ったデッキが選ばれている', on === (decks.active || d0.id), JSON.stringify({ on, active: decks.active }));
    check('③ 借りたデッキのタブは出ない', (await page.locator('[data-card-deck-pick-tab]').count()) === 0 && (await page.locator('[data-card-deck-pick-rent]').count()) === 0);
    // ② 戻る
    await page.locator('[data-mh-screen] header button, [data-mh-screen] button').first().click();
    const back = await page.locator('[data-card-share-fight="check-breeder-1"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('② デッキ選びの「戻る」で、「ほかのブリーダー」タブへ戻る', back && (await page.locator('[data-card-foe-tab="breeder"][aria-selected="true"]').count()) === 1);
    // ⑤ 「詳細」(2026-10-31 社長「各ブリーダーの詳細がわかりにくい。詳細ボタンつけて」): 名前・デッキ名・3体(絵と名前)・全カード・賢さ・数字・戦う
    await page.locator('[data-card-share-detail-open="check-breeder-1"]').click();
    const det = page.locator('[data-card-share-deck-detail]');
    const opened = await det.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    const info = opened ? await det.evaluate((el) => ({
      name: (el.querySelector('[data-card-share-detail-name]') || {}).textContent || '',
      mons: el.querySelectorAll('[data-card-share-detail-mons] img').length,
      cards: Number((el.querySelector('[data-card-share-detail-cards]') || { getAttribute: () => 0 }).getAttribute('data-card-share-detail-cards')),
      sum: [...el.querySelectorAll('[data-card-share-detail-card]')].reduce((a, x) => a + Number((x.textContent.match(/×(\d+)$/) || [0, 0])[1]), 0),
      smart: !!el.querySelector('[data-card-share-detail-smart]'),
      stats: (el.querySelector('[data-card-share-detail-stats]') || {}).textContent || '',
      fight: !!el.querySelector('[data-card-share-detail-fight]'),
    })) : null;
    check('⑤ 「詳細」で、名前・3体の絵・全カード(合わせて50枚)・賢さ・戦われた数・「戦う」が出る',
      !!info && /検査の相手/.test(info.name) && info.mons === 3 && info.cards === 50 && info.sum === 50 && info.smart && /まだ戦われていません/.test(info.stats) && info.fight, JSON.stringify(info));
    if (process.env.SHARE_SHOT) await page.screenshot({ path: process.env.SHARE_SHOT });
    const fitD = await det.evaluate((el) => { const box = el.firstElementChild.getBoundingClientRect(); return { right: Math.round(box.right), w: window.innerWidth, over: [...el.querySelectorAll('*')].filter((c) => c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflowX !== 'auto').length }; }).catch(() => null);
    check('⑤ 詳細の窓が画面からはみ出さない', !!fitD && fitD.right <= fitD.w && fitD.over === 0, JSON.stringify(fitD));
    await page.locator('[data-card-share-detail-fight]').click();
    const viaDetail = await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check('⑤ 詳細の「戦う」でも、デッキ選びへ進む', viaDetail);
    await page.locator('[data-mh-screen] header button, [data-mh-screen] button').first().click();
    await page.locator('[data-card-share-fight="check-breeder-1"]').waitFor({ timeout: 8000 });
    // ④ 対戦が始まる
    await page.locator('[data-card-share-fight="check-breeder-1"]').click();
    await page.locator('[data-card-deck-pick-go]').click();
    const started = await page.locator('[data-card-battle]').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    check('④ 「このデッキで対戦」で、ほかのブリーダーのデッキとの対戦が始まる', started);
    check('画面でエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await b.close(); server.close(); }
};

(async () => {
  await browser();
  if (failed) { console.log(`✗ ほかのブリーダーと戦う前のデッキ選び: ${failed} 件 NG(${passed} 件 OK)`); process.exit(1); }
  console.log(`✓ ほかのブリーダーと戦う前のデッキ選び: ${passed} 件すべて OK`);
})().catch((e) => { console.log(`NG: 実行中にエラー — ${e.message}`); process.exit(1); });
