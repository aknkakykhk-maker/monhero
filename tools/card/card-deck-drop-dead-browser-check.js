// MFバトルカードのデッキ編成「使えないカードを外す」(2026-10-31 社長「デッキ編成で使えないカードを外すボタンを実装して」)を、実際の画面で確かめる。
//   node tools/card/card-deck-drop-dead-browser-check.js  (1分ほど)
// ① 計算: 3体のだれも使えない技・準備中の札を、入っている枚数ぶん数える(ブリーダー・全員・全体のカードは数えない)
// ② 使えないカードが無いときはボタンを出さない
// ③ 1体外すと、その子の技の枚数がボタンに出る → 押すと「◯枚外しますか？」→ 外すと、外した札の名前が出てボタンが消える
// ④ 外しただけでは保存しない(保存せずに戻れば、デッキはそのまま)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else failed++; if (!ok || process.argv.includes('-v')) console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); };

// ---- ① 計算(82・87 の関数を読み込んで呼ぶ) ----
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src87 = fs.readFileSync(path.join(GAME, 'src', 'parts', '87-card-deck-edit.jsx'), 'utf8');
const fn = /\nconst cardDeckUnusableCards = [\s\S]*?\n};\n/.exec(src87);
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n${fn ? fn[0] : ''}\n;this.E = { CARD_BATTLE_DATA, cardDeckUnusableCards, cardDeckDeadCount };`, ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
check('① 87 に cardDeckUnusableCards がある', !!fn && typeof E.cardDeckUnusableCards === 'function');
{
  const tigerPow = Object.values(db.cards).find((c) => c.ready && c.user === 'tiger' && c.kind === 'pow');
  const golemPow = Object.values(db.cards).find((c) => c.ready && c.user === 'golem' && c.kind === 'pow');
  const breeder = Object.values(db.cards).find((c) => c.ready && c.user === 'breeder');
  const field = Object.values(db.cards).find((c) => c.ready && c.kind === 'fld');
  const notReady = Object.values(db.cards).find((c) => !c.ready);
  const tiger = Object.values(db.monsters).find((m) => m.species === 'tiger' && !m.variant);
  const deck = { monsters: [tiger.no], cards: [tigerPow.no, golemPow.no, golemPow.no, breeder.no, field.no, ...(notReady ? [notReady.no] : []), 'XX-9'] };
  const out = E.cardDeckUnusableCards(db, deck);
  const want = [golemPow.no, golemPow.no, ...(notReady ? [notReady.no] : []), 'XX-9'];
  check('① ゴーレムの技2枚・準備中・表に無い番号を数え、ライガーの技・ブリーダー・全体のカードは数えない', JSON.stringify(out) === JSON.stringify(want), JSON.stringify({ out, want }));
  check('① 技の数え方はデッキ一覧の「使えないカード◯枚」と同じ', E.cardDeckDeadCount(db, { ...deck, cards: [tigerPow.no, golemPow.no, golemPow.no, breeder.no, field.no] }) === 2);
  check('① モンスターがまだいないときは、技を数えない', E.cardDeckUnusableCards(db, { monsters: [], cards: [golemPow.no, tigerPow.no] }).length === 0);
  check('① 壊れたデッキでも落ちない', E.cardDeckUnusableCards(db, null).length === 0 && E.cardDeckUnusableCards(db, { monsters: 'x', cards: 'y' }).length === 0);
}

// ---- ②〜④ 画面 ----
const browser = async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); return; }
  const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8983;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // 本番のサーバーへは書かない(外へは GET だけ通す)
    await page.route('**/*', (route) => { const rq = route.request(); const u = new URL(rq.url()); if (u.hostname === 'localhost' || rq.method() === 'GET') return route.continue(); return route.abort(); });
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
    await page.locator('[data-card-decks]').click();
    await page.waitForSelector('[data-card-deck-list]', { timeout: 5000 });
    const saved0 = await get('mh_card_decks_v1');
    await page.locator('[data-card-deck-open]').first().click();
    await page.waitForSelector('[data-card-deck-edit]', { timeout: 5000 });
    check('② スターターのデッキ(使えないカードが無い)では、ボタンを出さない', (await page.locator('[data-card-deck-drop-dead]').count()) === 0);
    const count0 = Number(await page.locator('[data-card-deck-count]').first().innerText().then((t) => (t.match(/\d+/) || [0])[0]));
    // 1体目を外す(名前と3体の枠を開いてから)
    if (await page.locator('[data-card-deck-bar="closed"]').count()) await page.locator('[data-card-deck-bar]').click();
    await page.locator('[data-card-deck-mon="0"]').click();
    await page.waitForTimeout(400);
    const btn = page.locator('[data-card-deck-drop-dead]');
    const n = Number(await btn.getAttribute('data-card-deck-drop-dead').catch(() => 0));
    check('③ 1体外すと、その子の技の枚数がボタンに出る', n > 0 && /使えないカードを外す\(\d+枚\)/.test(await btn.innerText().catch(() => '')), String(n));
    await btn.click();
    const sheet = page.locator('[data-confirm-sheet]').locator('xpath=..');
    const title = await sheet.innerText().catch(() => '');
    check('③ 押すと「◯枚外しますか？」と外すカードの名前を出す', new RegExp(`使えないカードを${n}枚外しますか`).test(title) && /外すカード: /.test(title), title.slice(0, 120));
    await sheet.getByRole('button', { name: '外す' }).click();
    await page.waitForTimeout(400);
    const count1 = Number(await page.locator('[data-card-deck-count]').first().innerText().then((t) => (t.match(/\d+/) || [0])[0]));
    const notice = await page.locator('[data-card-deck-notice]').innerText().catch(() => '');
    check('③ 外すと枚数がその分減り、外した札の名前が出て、ボタンが消える', count1 === count0 - n && /^外しました: /.test(notice) && (await page.locator('[data-card-deck-drop-dead]').count()) === 0, JSON.stringify({ count0, count1, n, notice: notice.slice(0, 60) }));
    // ④ 保存せずに戻る
    await page.getByRole('button', { name: 'やめる' }).first().click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '保存せずに戻る' }).click();
    await page.waitForSelector('[data-card-deck-list]', { timeout: 5000 });
    check('④ 外しただけでは保存しない(保存せずに戻ると、デッキはそのまま)', JSON.stringify(await get('mh_card_decks_v1')) === JSON.stringify(saved0));
    // 幅320pxでも、ボタンがはみ出さない
    await page.locator('[data-card-deck-open]').first().click();
    await page.waitForSelector('[data-card-deck-edit]', { timeout: 5000 });
    await page.setViewportSize({ width: 320, height: 640 }); await page.waitForTimeout(300);
    if (await page.locator('[data-card-deck-bar="closed"]').count()) await page.locator('[data-card-deck-bar]').click();
    await page.locator('[data-card-deck-mon="0"]').click(); await page.waitForTimeout(300);
    const fit = await page.locator('[data-card-deck-drop-dead]').evaluate((el) => ({ right: Math.round(el.getBoundingClientRect().right), w: window.innerWidth, over: el.scrollWidth > el.clientWidth + 1 })).catch(() => null);
    check('幅320pxでもボタンがはみ出さない', !!fit && fit.right <= fit.w && !fit.over, JSON.stringify(fit));
    check('画面でエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await b.close(); server.close(); }
};

(async () => {
  await browser();
  if (failed) { console.log(`✗ 使えないカードを外す: ${failed} 件 NG(${passed} 件 OK)`); process.exit(1); }
  console.log(`✓ 使えないカードを外す: ${passed} 件すべて OK`);
})().catch((e) => { console.log(`NG: 実行中にエラー — ${e.message}`); process.exit(1); });
