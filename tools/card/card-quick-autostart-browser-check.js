// MFバトルカードのオプション「MFバトルカードを開いたら自動で始める」(mh_card_settings_v1.quickAutoStart)が、
// 実際のブラウザで働くかを確かめる(社長 2026-10-25「モンヒロビートと同じように」。手本は mode/quick-rhythm-autostart-check.js)。
//
//   node tools/card/card-quick-autostart-browser-check.js
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-quick-autostart-browser-check.js   オプションの写真も撮る
//
// 見ているもの
//   ① OFF(最初の値)のとき: HOME からカードを開いても、裏の周回は始まらない
//   ② オプションでONにすると mh_card_settings_v1 に quickAutoStart:true が入り、ほかの設定(速さ・自動パス)は消えない
//   ③ ONのとき: HOME からカードを開くと、何も押さずに裏の周回が始まる(帯が出て1周目から数える)
//   ④ ONでも、カードの中を行き来(トップ ↔ デッキ編成)しただけでは周回を立ち上げ直さない(周目が1へ戻らない)
//   ⑤ AUTO設定の編成(勇者モン・配置距離・難易度)が無いときは、オプションに「AUTO設定で…決めると使えます」と出る
//   ⑥ どこでも実行時エラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8999;
const SHOT = process.env.CARD_SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
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
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// withAuto … AUTO設定の「モンヒロビート中に回すクイック周回」の編成を入れておくか
const seed = (withAuto) => `(() => {
  if (sessionStorage.getItem('__cardAutoSeeded')) return;
  sessionStorage.setItem('__cardAutoSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true);
  put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
  ${withAuto ? `put('mh_auto_settings_v1', {
    strategy: 'random',
    allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 },
    quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: false },
  });` : ''}
  localStorage.setItem('mh_debug_unlocked_v1', '1');
})()`;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  const open = async (withAuto) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.addInitScript(seed(withAuto));
    await page.addInitScript(quiet.eventStorySeed());
    await page.addInitScript(quiet.updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('TAP TO START'))?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    return { context, page };
  };
  const dismiss = async (page) => {
    // ログインボーナスや助手たちの会話が HOME を覆うことがある。閉じるボタンが無くなり、入口が見えるまで閉じる
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
      if (!clicked && await page.evaluate(() => !!document.querySelector('[data-home-card-battle]') && !document.querySelector('[role="dialog"]'))) break;
      await page.waitForTimeout(600);
    }
  };
  // HOME の入口からカードを開き、はじめてならスターター → 練習試合を飛ばしてトップへ
  const enterCard = async (page) => {
    await dismiss(page);
    await page.evaluate(() => document.querySelector('[data-home-card-battle]')?.click());
    await page.waitForSelector('[data-card-top]', { timeout: 20000 }).catch(() => {});
    if (await page.evaluate(() => !!document.querySelector('[data-card-top="starter"]'))) {
      await page.click('[data-card-kit="powerful"]');
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 }).catch(() => {});
      await page.click('[data-card-quit]');
      await page.waitForTimeout(300);
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit'))?.click(); });
      await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 }).catch(() => {});
      await page.getByRole('button', { name: 'トップへ' }).click();
    }
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 }).catch(() => {});
  };
  const backHome = async (page) => {
    await page.evaluate(() => document.querySelector('[data-card-top="top"] header button')?.click());
    await page.waitForFunction(() => !document.querySelector('[data-card-top]'), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
  };
  const strip = (page) => page.evaluate(() => (document.querySelector('[data-card-quick-run] [data-rhythm-multi-quick-run]')?.textContent || '').replace(/\s+/g, ' '));
  try {
    // ---- 編成あり ----
    let { context, page } = await open(true);
    await enterCard(page);
    await page.waitForTimeout(3000);
    check('① OFF(最初の値)のとき、カードを開いても裏の周回は始まらない', !(await page.evaluate(() => !!document.querySelector('[data-card-quick-run]'))), await strip(page));
    await page.click('[data-card-options-open]');
    await page.waitForSelector('[data-card-quick-auto]', { timeout: 8000 }).catch(() => {});
    check('⑤ 編成があるときは「AUTO設定で…決めると使えます」は出ない', !(await page.evaluate(() => !!document.querySelector('[data-card-quick-auto-needs]'))));
    await page.click('[data-card-quick-auto]');
    await page.waitForTimeout(600);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'options-quick-auto.png') }); }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_settings_v1') || 'null'));
    check('② オプションでONにすると保存され、ほかの設定は消えない', !!saved && saved.quickAutoStart === true && saved.speed === 'normal' && saved.autoPass === true, JSON.stringify(saved));
    await page.evaluate(() => document.querySelector('[data-card-options] button')?.click());
    await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 }).catch(() => {});
    await backHome(page);
    await enterCard(page);
    const started = await page.waitForSelector('[data-card-quick-run="live"]', { timeout: 15000 }).then(() => true).catch(() => false);
    const s1 = await strip(page);
    check('③ ONのとき、カードを開くと何も押さずに裏の周回が始まる(1周目から)', started && /1周目/.test(s1), s1 || '帯が出ない');
    await page.waitForTimeout(4000);
    await page.click('[data-card-decks]');
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-mh-screen] button')?.click());
    await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const s2 = await strip(page);
    check('④ カードの中を行き来しただけでは周回を立ち上げ直さない', /周目/.test(s2) && !/WAVE 1\/10・1周目/.test(s2) || s2 === s1, `${s1} → ${s2}`);
    await context.close();
    // ---- 編成なし ----
    ({ context, page } = await open(false));
    await enterCard(page);
    await page.click('[data-card-options-open]');
    await page.waitForSelector('[data-card-quick-auto]', { timeout: 8000 }).catch(() => {});
    check('⑤ 編成が無いときは「AUTO設定で…決めると使えます」と出る', await page.evaluate(() => !!document.querySelector('[data-card-quick-auto-needs]')));
    await context.close();
    check('⑥ 操作中に実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
