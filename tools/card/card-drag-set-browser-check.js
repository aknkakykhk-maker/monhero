#!/usr/bin/env node
// MFバトルカード: 組み合わせて使う札(付ける札・同時に使う札)を、選んだ組み合わせのとおりに出す(2026-10-27 ソラシドさんの報告)。
//
//   node tools/card/card-drag-set-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、写真(drag-set-*.png)を残す
//
// 【なぜ要るか】
// 技を押すと「技＋クリティカル＋集中」「技」のように組み合わせの札が並び、選べる。前は、選んでから相手まで運ぶ(ドラッグ)と、
// 選んだ組み合わせではなく、組める札が全部付いて出ていた(運ぶときは、置き先ごとにいちばん枚数の多い組み合わせを選んでいた)
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする。手札: 技・クリティカル・集中・ほか2枚)
//   A 技を押して組み合わせ「技だけ」を選び、マウスで相手まで運ぶ → 技だけが出る(クリティカル・集中は手札に残る)
//   B 技を押して組み合わせ「技だけ」を選び、相手を押す → 技だけが出る(タップとそろう)
//   C 何も選ばずに、マウスで相手まで運ぶ → 運んだ技1枚だけで出る(組み合わせの札は見えていないので、付けたつもりが無いのに付かないように。2026-10-27 部長と決めた)
//   D 付ける札(集中)だけを、組み合わせを選ばずに運ぶ → 出さない(1枚では出せない札は、組み合わせのボタンを押すまで何も付けない。2026-10-28 社長・案C)
//   E 集中を押すと「組み合わせを選んでね」と出て、組み合わせのボタン(技＋集中)を押してから運ぶと、その2枚で出る
//   どれも実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8996;
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.addInitScript(eventStorySeed());
    await page.addInitScript(() => {
      window.__mhCardScene = (st) => {
        const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
        const me = st.players[0], opp = st.players[1];
        const mon = me.mons[0];
        const atk = Object.values(db.cards).filter((c) => c.ready && c.user === mon.species && c.kind === 'pow' && !(c.effects || []).length && c.guts > 0).sort((x, y) => x.guts - y.guts)[0];
        window.__mhSetAtk = atk ? { no: atk.no, name: atk.name } : null;
        me.hand = [atk.no, '121', '274', '100', '100'];
        me.guts = Array(9).fill('100');
        opp.hand = ['100', '100', '100', '100', '100'];
        opp.guts = Array(3).fill('100');
        st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 0; st.turn = 2; st.first = 0;
        me.breederUsed = false; me.mons.forEach((x) => { x.attacks = 0; });
        return st;
      };
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // デバッグ設定から MFバトルカードへ。はじめてなのでスターターを選び、練習試合は飛ばす
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-foe="momosuke"]').click();
    await page.locator('[data-card-start]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'attack', null, { timeout: 20000 });
    return page;
  };
  const handCount = (pg) => pg.evaluate(() => document.querySelectorAll('[data-card-hand-card]').length);
  const handNames = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-card-hand-card]')].map((e) => e.innerText.split('\n')[0]));
  // マウスで、手札の1枚を相手の子まで運ぶ(PC のドラッグ)
  const mouseDrag = async (pg, from, to) => {
    const a = await pg.locator(from).boundingBox(), b = await pg.locator(to).boundingBox();
    await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await pg.mouse.down();
    for (let k = 1; k <= 12; k++) { await pg.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2) - (a.x + a.width / 2)) * k / 12, a.y + a.height / 2 + ((b.y + b.height / 2) - (a.y + a.height / 2)) * k / 12); await pg.waitForTimeout(16); }
    await pg.mouse.up();
  };
  const settle = async (pg, n0) => { for (let i = 0; i < 20; i++) { await pg.waitForTimeout(150); if ((await handCount(pg)) !== n0) break; } await pg.waitForTimeout(400); };
  try {
    // ---- A 組み合わせ「技だけ」を選んでから、マウスで運ぶ ----
    let page = await open();
    const atk = await page.evaluate(() => window.__mhSetAtk);
    check('場面を作れた(先頭の子の文の無いちから技・クリティカル・集中)', !!atk, JSON.stringify(atk));
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    const sets = await page.locator('[data-card-set]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-set')));
    check('技を押すと、組み合わせが並ぶ(技だけ・付ける札あり)', sets.includes('[0]') && sets.some((x) => JSON.parse(x).length >= 2), sets.join(' / '));
    await page.locator('[data-card-set="[0]"]').click();
    await page.waitForTimeout(200);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'drag-set-pick.png') }); }
    let n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="1-0"]');
    await settle(page, n0);
    let names = await handNames(page);
    check('A 「技だけ」を選んでマウスで運ぶと、技だけが出る(クリティカル・集中は手札に残る)', (await handCount(page)) === n0 - 1 && names.includes('クリティカル') && names.includes('集中'), `${n0}→${await handCount(page)}枚・${names.join(',')}`);
    await page.close();
    // ---- B 組み合わせ「技だけ」を選んでから、相手を押す ----
    page = await open();
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-card-set="[0]"]').click();
    await page.waitForTimeout(200);
    n0 = await handCount(page);
    const user = page.locator('[data-card-mon].ring-amber-300').first();
    if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
    await page.locator('[data-card-mon="1-0"]').click();
    await settle(page, n0);
    names = await handNames(page);
    check('B 「技だけ」を選んで相手を押すと、技だけが出る(運ぶのとそろう)', (await handCount(page)) === n0 - 1 && names.includes('クリティカル') && names.includes('集中'), `${n0}→${await handCount(page)}枚`);
    await page.close();
    // ---- C 何も選ばずに、マウスで運ぶ(いまの既定: 技を押したときに先に選ばれている組み合わせ) ----
    page = await open();
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="1-0"]');
    await settle(page, n0);
    names = await handNames(page);
    check('C 何も選ばずに運ぶと、運んだ技1枚だけで出る(クリティカル・集中は付かない)', (await handCount(page)) === n0 - 1 && names.includes('クリティカル') && names.includes('集中'), `${n0}→${await handCount(page)}枚`);
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'drag-set-default.png') });
    await page.close();
    // ---- D 付ける札(集中)を、組み合わせを選ばずに運ぶ: 出さない(案C。前はいちばん枚数の多い組で出て、付けたつもりの無い札まで付いた) ----
    page = await open();
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="2"]', '[data-card-mon="1-0"]');
    await page.waitForTimeout(1500);
    names = await handNames(page);
    check('D 付ける札(集中)を、組み合わせを選ばずに運んでも出さない', (await handCount(page)) === n0, `${n0}→${await handCount(page)}枚・${names.join(',')}`);
    await page.close();
    // ---- E 集中を押す → 「組み合わせを選んでね」→ いちばん少ない組(技＋集中)のボタンを押してから運ぶ → その2枚で出る ----
    page = await open();
    n0 = await handCount(page);
    await page.locator('[data-card-hand-card="2"]').click();
    await page.waitForTimeout(300);
    const askSet = await page.getByText('組み合わせを選んでね').count();
    const setKeys = await page.locator('[data-card-set]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-set')));
    const fewest = setKeys.slice().sort((a, b) => JSON.parse(a).length - JSON.parse(b).length)[0];
    if (fewest) await page.locator(`[data-card-set="${fewest}"]`).click();
    await page.waitForTimeout(200);
    await mouseDrag(page, '[data-card-hand-card="2"]', '[data-card-mon="1-0"]');
    await settle(page, n0);
    names = await handNames(page);
    check('E 集中を押すと「組み合わせを選んでね」と出て、選んだ組(技＋集中)で運ぶとその2枚で出る(クリティカルは残る)', askSet > 0 && fewest === '[0,2]' && (await handCount(page)) === n0 - 2 && names.includes('クリティカル'), `案内 ${askSet}・ボタン ${setKeys.join(' / ')}・${n0}→${await handCount(page)}枚・${names.join(',')}`);
    check('実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
