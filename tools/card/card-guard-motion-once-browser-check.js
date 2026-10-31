// MFバトルカード: 攻撃を受けるときの動きが「攻撃 → よける/防ぐ/当たる」の1回ずつになっているか(二重に出ないか)を、実際の画面で確かめる。
//   node tools/card/card-guard-motion-once-browser-check.js   (1分ほど)
// 使うのは、デバッグ設定の「技の動きの見本」(85 の cardMotionDemo。跳んでよける・防ぐ・重ねて守る・はね返して倒す を含む)。
// 2026-10-31 社長「まだ攻撃→防御(回避)の流れで二重描写がある」: 守りのカードを出した手と、当たりが決まった手の両方で
//   よける/防ぐの動きを流していて、同じ子が2回よけて見えていた。攻撃の動きも守りのカードを出した手で流れていた
// 見るもの
//   ① どの攻撃の動き(ATK)のあとも、守る側の動き(よける・跳ぶ・防ぐ・当たる)は、攻撃1回につき1回だけ(同じ子が続けて2回動かない)
//   ② よける・跳ぶ・防ぐの動きの前には、必ずその攻撃の動きがある(攻撃が見えないまま守りだけ動かない。全体攻撃の2体目からは除く)
//   ③ はね返されて倒れる子も、攻撃の動きを見せてから倒れる
//   ④ 実行時エラーが無い
//   ⑤ 捨て札は1回のタップで詳しい画面が開き、捨て札の窓より手前に出る(2026-10-31 社長)
//   ⑥ 効果の文が空のカード(ダメージだけの技)にも、詳しい画面に一文が出る(2026-10-31 社長「観戦でカードの効果がわからないものがある」)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8996;
const SHOT = process.env.CARD_SHOT_DIR || '';
// 画面の大きさ(既定は iPhone 13 の 390×844。SE は CARD_VIEWPORT=375x667)
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${name}${!ok && detail ? ` — ${detail}` : ''}`); };
(async () => {
  const playwright = require('playwright');
  const server = await serve();
  const errors = [];
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(() => {
      window.__fx = []; const t0 = Date.now(); const seen = new WeakSet();
      const scan = () => {
        document.querySelectorAll('[data-card-art]').forEach((art) => {
          const id = art.getAttribute('data-card-art');
          const fx = art.querySelector('[data-skill-fx]'); if (fx && !seen.has(fx)) { seen.add(fx); window.__fx.push(`${Date.now() - t0} ATK ${id}`); }
          const pose = art.querySelector('[data-card-pose]'); if (pose && !seen.has(pose)) { seen.add(pose); const v = pose.getAttribute('data-card-pose'); if (v !== 'still') window.__fx.push(`${Date.now() - t0} ${v} ${id}`); }
        });
      };
      new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true });
    });
    await page.addInitScript(eventStorySeed());
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
    // ここまでの保存(既存のキー)を控える。カードバトルが書くのは mh_card_* だけのはず
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const openCard = async () => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    await openCard();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    // スターターを選ぶと練習試合が始まるので、飛ばしてトップへ
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const t0 = Date.now();
    await page.locator('[data-card-motion-demo]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    // 見本の最後(スエゾーの「偵察」で1枚引く)まで待ち、動きが消えるまで少し置く。届かなくても 45 秒で切る
    await page.waitForFunction(() => /1枚引いた/.test(document.querySelector('[data-card-log]')?.textContent || ''), null, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2200);
    const demoSec = (Date.now() - t0) / 1000; // 見本を押してから終わるまでの長さ。この長さだけを残す
    const log = (await page.evaluate(() => window.__fx || [])).map((x) => { const [t, k, id] = x.split(' '); return { t: Number(t), k, id }; });
    const atks = log.filter((x) => x.k === 'ATK');
    const poses = log.filter((x) => ['dodge', 'jump', 'guard', 'hit'].includes(x.k));
    // ① 同じ子の守りの動きが、1.5秒以内に2回続かない
    const doubles = poses.filter((x, i) => poses.slice(0, i).some((y) => y.id === x.id && x.t - y.t < 1500));
    check('① 守る側の動きは、攻撃1回につき1回だけ(同じ子が続けて2回動かない)', doubles.length === 0 && poses.length >= 5, JSON.stringify({ doubles, n: poses.length }));
    // ② よける・跳ぶ・防ぐの前、1.2秒以内に攻撃の動きがある(全体攻撃の2体目以降は、1体目の前に見せているので除く)
    const firsts = poses.filter((x) => x.k !== 'hit').filter((x, i, arr) => !arr.slice(0, i).some((y) => x.t - y.t < 6000 && y.id[0] === x.id[0]));
    const noAtk = firsts.filter((x) => !atks.some((a) => a.t <= x.t && x.t - a.t < 1200 && a.id[0] !== x.id[0]));
    check('② よける・跳ぶ・防ぐの前に、その攻撃の動きがある', firsts.length >= 2 && noAtk.length === 0, JSON.stringify({ noAtk, firsts }));
    // ③ はね返しで倒れた子(ko)の、倒れる前に攻撃の動きがある
    const kos = log.filter((x) => x.k === 'ko');
    check('③ はね返されて倒れる子も、攻撃の動きを見せてから倒れる', kos.some((k) => atks.some((a) => a.id === k.id && a.t <= k.t && k.t - a.t < 2000)), JSON.stringify({ kos, atks }));
    // ⑤ 捨て札(2026-10-31 社長「すてふだはワンタップで詳細見せて」「すてふだからだと詳細カード画面が裏に回ってる」): 1回のタップで詳しい画面が、いちばん手前に出る
    await page.getByRole('button', { name: /^捨て札 [1-9]/ }).first().click();
    const item = page.locator('[data-card-discard-item]').first();
    await item.waitFor({ timeout: 5000 });
    await item.click();
    const opened = await page.locator('[data-card-detail]').waitFor({ timeout: 3000 }).then(() => true).catch(() => false);
    const top = opened ? await page.evaluate(() => { const d = document.querySelector('[data-card-detail] img'); const r = d.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(el && el.closest('[data-card-detail]')); }) : false;
    check('⑤ 捨て札は1回のタップで詳しい画面が開き、捨て札の窓より手前に出る', opened && top, JSON.stringify({ opened, top }));
    // ⑥ 効果の文が空のカード(ダメージだけの技)にも、詳しい画面に一文が出る
    const plain = await page.evaluate(() => (typeof cardPlainEffectText === 'function' && typeof CARD_BATTLE_DATA !== 'undefined')
      ? ['177', '184', '334'].map((no) => cardPlainEffectText(CARD_BATTLE_DATA.cards[no])) : null);
    check('⑥ 効果の文が空のカード(パンチ・バーストキャノン・かま首突き)にも一文が出る', Array.isArray(plain) && /2ダメージ.*ちから技/.test(plain[0]) && /8ダメージ.*かしこさ技/.test(plain[1]) && /2ダメージ/.test(plain[2]), JSON.stringify(plain));
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (failed) { console.log(`✗ 攻撃を受けるときの動き: ${failed} 件 NG`); process.exit(1); }
  console.log('✓ 攻撃を受けるときの動き: すべて OK');
})().catch((e) => { console.log(`NG: 実行中にエラー — ${e.message || e}`); process.exit(1); });
