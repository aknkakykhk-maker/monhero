#!/usr/bin/env node
// プロフィール「見せる欄」のバトルカードのデッキ名が切れずに出るか・裏クイックの札が名前に重ならないかを、
// 自分のプロフィールとフレンドのプロフィールで測り、止め絵を撮る(r1119-167)。
//
//   SHOT_DIR=docs/progress/dev/profile-deck-name/before node tools/friends/profile-deck-name-shot.js
//
// 長い・絵文字入りのデッキ名と、裏クイックの周回中の札(「🔁 2周目 W4/10」)を偽のデータで作る。Supabase へは本物でつながない。
// 見る幅: 縦 320・375・390・430 と 横 844×390。SHOT_DIR を渡すと止め絵を書き、測定の表を measure.json に書く。
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { createFakeFriendsServer } = require('./fake-friends-server');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.PORT || 9191);
const SHOT_DIR = process.env.SHOT_DIR || '';
const DECK_NAME = '☀️🌙いちかスペシャルデッキ（強め）';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
const seed = () => {
  if (sessionStorage.getItem('__pdSeeded')) return;
  sessionStorage.setItem('__pdSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_intro_done', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: true } });
  put('mh_gold', 1000);
  put('mh_masu_mons', ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Ham'].map((b, i) => ({ id: `m${i + 1}`, baseId: b, name: `テスト${i + 1}`, bondXp: 999999999, createdAt: i + 1 })));
  put('mh_breeder_id_v1', 'self-user');
};
(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const table = [];
  try {
    for (const [w, h, tag] of [[320, 640, '縦320'], [375, 812, '縦375'], [390, 844, '縦390'], [430, 932, '縦430'], [844, 390, '横844']]) {
      const fake = createFakeFriendsServer();
      fake.db.friend_codes.push({ breeder_id: 'other-friend', friend_code: 'AAAA2222', created_at: fake.tick() });
      fake.db.friend_links.push({ requester_id: 'self-user', target_id: 'other-friend', status: 'accepted', blocked_by: null, created_at: fake.tick(), updated_at: fake.tick() });
      fake.db.friend_profiles.push({ breeder_id: 'other-friend', place: 'rhythm', started_on: '2026-09-01', play_seconds: 5 * 3600, best_bond: 20, best_bond_mon: 'Mocchi', best_power: 12345, best_power_mon: 'Pixie',
        favorite: { monsterId: 'Mocchi', name: 'モッチー', bondLevel: 20, power: 9876, detail: { v: 6, n: 'Mocchi' } }, updated_at: fake.tick() });
      fake.db.breeder_profiles.push({ breeder_id: 'other-friend', user_name: 'ともだちの子', icon: null, profile_frame: null, updated_at: new Date().toISOString() });
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      let deck = null; // 登録デッキ(ページが開いてから、実際のカード番号で作る)
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(seed);
      await page.addInitScript(quiet.quietBootSeed());
      await page.addInitScript(quiet.updateNoticeSeed());
      await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.route('**/rest/v1/**', async (route) => {
        const req = route.request(), url = req.url();
        const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (req.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
        if (/\/rest\/v1\/card_deck_entries/.test(url)) {
          const id = (url.match(/owner_id=eq\.([A-Za-z0-9_-]+)/) || [])[1];
          const rows = deck && id ? [{ owner_id: id, user_name: id === 'self-user' ? 'テスト' : 'ともだちの子', icon: null, profile_frame: null, deck, tactics: { name: DECK_NAME }, version: 1, active: true, battles: 12, deck_wins: 7, rents: 1, updated_at: new Date().toISOString() }] : [];
          await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(rows) }); return;
        }
        if (/\/rest\/v1\/(friend_codes|friend_links|friend_profiles)/.test(url) || (/\/rest\/v1\/breeder_profiles/.test(url) && req.method() === 'GET' && /breeder_id=in\./.test(url))) {
          const out = fake.handle(url, req.method(), req.postData());
          await route.fulfill({ status: out.status, contentType: 'application/json', headers: cors, body: out.body === undefined ? '' : JSON.stringify(out.body) }); return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: '[]' });
      });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const closePopups = () => page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]'));
        if (b) { b.click(); return true; }
        const x = [...document.querySelectorAll('button')].find((b2) => b2.offsetParent && (b2.getAttribute('aria-label') || '') === '閉じる'); if (x) { x.click(); return true; }
        return false;
      });
      for (let i = 0; i < 120 && !(await page.evaluate(() => !!document.querySelector('.mh-home-player'))); i++) {
        if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
        await closePopups(); await page.waitForTimeout(500);
      }
      await page.waitForTimeout(4000);
      for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
      deck = await page.evaluate(() => {
        const db = CARD_BATTLE_DATA; const mons = Object.keys(db.monsters).filter((k) => /^C-[0-9]{3}$/.test(k)).slice(0, 3); const cards = [];
        const list = Object.keys(db.cards).filter((k) => /^[A-Z]?[0-9]{3}$/.test(k)).slice(0, 17); list.forEach((c) => { for (let k = 0; k < 3 && cards.length < 50; k++) cards.push(c); });
        while (cards.length < 50) cards.push(list[0]);
        return { monsters: mons, cards: cards.slice(0, 50) };
      });
      const measure = (label) => page.evaluate((lb) => {
        const tile = document.querySelector('[data-profile-show="card-deck"]');
        const nameEl = tile && [...tile.querySelectorAll('b')].find((b) => /いちか/.test(b.textContent));
        const badge0 = document.querySelector('[data-quick-anywhere]');
        const badgeHidden = !!badge0 && getComputedStyle(badge0).visibility === 'hidden';
        const badge = badgeHidden ? null : badge0; // 隠れている札は重なりに数えない(隠れる仕組み)
        if (!tile || !nameEl) return { label: lb, error: '札が見つからない' };
        const r = nameEl.getBoundingClientRect(), t = tile.getBoundingClientRect();
        const cs = getComputedStyle(nameEl);
        const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
        const rects = (() => { const range = document.createRange(); range.selectNodeContents(nameEl); return [...range.getClientRects()]; })();
        const lines = Math.max(1, Math.round(r.height / lineH));
        const cut = nameEl.scrollWidth > nameEl.clientWidth + 1 || nameEl.scrollHeight > nameEl.clientHeight + 1 || /ellipsis/.test(cs.textOverflow) && nameEl.scrollWidth > nameEl.clientWidth;
        const B = badge ? badge.getBoundingClientRect() : null;
        const ov = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        return { label: lb, nameText: nameEl.textContent, nameLines: lines, nameCut: !!cut, tile: [t.left, t.top, t.width, t.height].map(Math.round), name: [r.left, r.top, r.width, r.height].map(Math.round),
          badge: B ? [B.left, B.top, B.width, B.height].map(Math.round) : null, badgeHidden, badgeText: badge ? badge.innerText.replace(/\s+/g, ' ') : null, badgeOnTile: ov(B, t), badgeOnName: ov(B, r), rectCount: rects.length };
      }, label);
      const shot = async (name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-${name}.png`) }); } };
      // ① 自分のプロフィール
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-showcase]', { timeout: 20000 });
      await page.waitForFunction(() => !!document.querySelector('[data-profile-show="card-deck"] b'), { timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.querySelector('[data-profile-showcase]').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(2500);
      const mSelf = await measure('自分'); table.push({ tag, ...mSelf }); await shot('自分');
      // ② フレンドのプロフィール
      await page.evaluate(() => document.querySelector('[data-profile-friends]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-friends-phase]')?.getAttribute('data-friends-phase') === 'ready', { timeout: 20000 });
      await page.waitForSelector('[data-friend-row="other-friend"]', { timeout: 10000 });
      await page.evaluate(() => document.querySelector('[data-friend-row="other-friend"]').click());
      await page.waitForSelector('[data-friends-profile]', { timeout: 10000 });
      await page.waitForFunction(() => !!document.querySelector('[data-card-share-tile="friend"] b'), { timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector('[data-card-share-tile="friend"]').scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(2500);
      const mFriend = await measure('フレンド'); table.push({ tag, ...mFriend }); await shot('フレンド');
      if (fatal.length) table.push({ tag, label: '実行時エラー', error: fatal.slice(0, 3).join(' / ') });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  for (const r of table) console.log(JSON.stringify(r));
  if (SHOT_DIR) fs.writeFileSync(path.join(SHOT_DIR, 'measure.json'), JSON.stringify(table, null, 1));
  const bad = table.filter((r) => r.error || r.nameCut || r.badgeOnName);
  console.log(bad.length ? `NG ${bad.length}件(名前が切れる・札が名前に重なる・エラー)` : 'すべてOK');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
