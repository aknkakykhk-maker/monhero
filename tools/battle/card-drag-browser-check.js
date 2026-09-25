const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// カードを指で引きずって枠へ置く操作を、実際のブラウザで確かめる。
//
//   node tools/battle/card-drag-browser-check.js
//
// 【なぜ要るか】
// 2026-09-26 に、引きずっているあいだは state を変えずにカード1枚の left/top だけを直接動かす形を試した。
// パソコン相当のブラウザでは問題なかったが、iPhone の Safari では手札の欄の backdrop-filter が
// position:fixed の基準を変え、カードが指についてこず、下から別の位置のカードが追いかけてくる表示になった
// (ユーザーの画面録画で確認)。元の「動くたびに state で描く」形へ戻してある。
// 指についてくる・置ける・押すだけなら選ぶ、は壊れても例外が出ないので、ここで実際に引きずって見張る。
// ⚠️ この道具は Chromium で動くので、Safari だけで起きるずれは拾えない。引きずりの作りを変えたら実機で確かめる。
//
// 見るもの:
//   ・少し動かすと引きずり始める(カードが指についてくる)
//   ・どこへ動かしても、カードの位置が指の位置と一致している
//   ・置き先の枠が光って画面が描き直されても、カードが古い位置へ戻らない
//   ・枠の上で離すとカードが置かれ、引きずりの表示が消える
//   ・動かさずに押して離したときは、今までどおり「選ぶ」になる
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8994;
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
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i += 1) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      const b = [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ'));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled);
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    // 勇者モン → 配置 → 供モン候補5体 → アシストカード、とたどってバトルまで進める。
    // ★押すものは「その画面にしか無いもの」で選ぶ。とりあえず押せるものを押すと、
    //   戻るボタンを踏んで難易度選択まで戻ってしまう
    await page.evaluate(() => { window.__pick = 0; window.__change = 1; });
    for (let i = 0; i < 40; i += 1) {
      const state = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      if (/WAVE 1\/10/.test(state)) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|はじめる|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力/.test(x.textContent) && x.textContent.trim() !== '詳細を見る');
        if (mons.length) { const m = mons[Math.min(window.__pick, mons.length - 1)]; window.__pick += 1; m.click(); return 'mon'; }
        const changes = live.filter((x) => x.textContent.trim() === '変更');
        if (changes.length) { const c = changes[Math.min(window.__change, changes.length - 1)]; window.__change += 1; c.click(); return 'change'; }
        return null;
      });
      if (!step) break;
      await page.waitForTimeout(1000);
    }
    const inBattle = await page.evaluate(() => /WAVE 1\/10/.test(document.body.innerText));
    check('タクティクスのバトルが立ち上がる', inBattle);
    if (!inBattle) { console.log(`\n${failed}件のNGがあります`); await browser.close(); server.close(); process.exit(1); }

    const cardBox = async (idx) => page.evaluate((i) => {
      const r = document.querySelectorAll('[data-hand-card]')[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, idx);
    const slotBox = async (idx) => page.evaluate((i) => {
      const el = document.querySelector(`[data-slot-index="${i}"]`);
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, idx);
    const dragged = async () => page.evaluate(() => {
      const el = document.querySelector('[data-dragging-card]');
      if (!el) return null;
      return { left: parseFloat(el.style.left), top: parseFloat(el.style.top), fixed: el.style.position === 'fixed' };
    });
    const actionEnabled = async () => page.evaluate(() => {
      const b = document.querySelector('[data-battle-action]');
      return !!b && !b.disabled;
    });
    const idx = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')]
      .findIndex((c) => c.getAttribute('data-card-usable') === 'true' && /攻撃/.test(c.textContent)));
    check('引きずれる攻撃カードがある', idx >= 0);
    const before = await actionEnabled();
    const start = await cardBox(idx);
    const target = await slotBox(0);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 4, start.y - 4);
    await page.waitForTimeout(100);
    check('少し動かしただけでは引きずり始めない', (await dragged()) === null);
    await page.mouse.move(start.x + 20, start.y - 30);
    await page.waitForTimeout(150);
    const first = await dragged();
    check('しきい値を超えると引きずり始める', !!first && first.fixed, JSON.stringify(first));
    check('引きずり始めた位置が指と一致する', !!first && Math.abs(first.left - (start.x + 20)) < 1 && Math.abs(first.top - (start.y - 30)) < 1,
      JSON.stringify(first));
    // 枠の外を小刻みに動かす(置き先が変わらないので、描き直しは要らない場面)
    let worst = 0;
    for (let k = 1; k <= 20; k += 1) {
      const x = start.x + 20 + k * 3, y = start.y - 30 - k;
      await page.mouse.move(x, y);
      await page.waitForTimeout(16);
      const d = await dragged();
      if (d) worst = Math.max(worst, Math.abs(d.left - x), Math.abs(d.top - y));
      else worst = Infinity;
    }
    check('動かしているあいだカードが指についてくる', worst < 1, `最大のずれ ${worst}px`);
    // 枠の上へ(置き先が光る = 画面の描き直しが起きる)。描き直しのあとも位置が戻らない
    const steps = 8;
    for (let k = 1; k <= steps; k += 1) {
      const from = { x: start.x + 80, y: start.y - 50 };
      await page.mouse.move(from.x + (target.x - from.x) * k / steps, from.y + (target.y - from.y) * k / steps);
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(200);
    const onSlot = await dragged();
    check('置き先の枠の上でも、カードが指の位置にある', !!onSlot && Math.abs(onSlot.left - target.x) < 1 && Math.abs(onSlot.top - target.y) < 1,
      JSON.stringify(onSlot));
    await page.mouse.up();
    await page.waitForTimeout(800);
    check('離すと引きずりの表示が消える', (await dragged()) === null);
    check('枠の上で離すとカードが置かれる(行動できるようになる)', !before && await actionEnabled(), `前 ${before}`);
    // 動かさずに押して離すと「選ぶ」になる(今までどおり)
    const idx2 = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')]
      .findIndex((c) => c.getAttribute('data-card-usable') === 'true'));
    if (idx2 >= 0) {
      const p = await cardBox(idx2);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(500);
      check('押して離しただけでは引きずりにならない', (await dragged()) === null);
    }
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 160));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
