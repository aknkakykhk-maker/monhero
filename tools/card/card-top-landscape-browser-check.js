// MFバトルカードのトップを横画面で開いたとき、主なボタン(対戦・デッキ編成・マーケット・ランキング・カード図鑑・ルール・記録・オプション)が
// 全部画面の中で押せるかを、実際のブラウザで確かめる(2026-10-25 ダメダシくん「横画面で対戦ボタンが画面の外に出て押しにくい」)。
//
//   node tools/card/card-top-landscape-browser-check.js
//
// 見ているもの(合言葉の端末 = デバッグの欄がある、いちばん縦に長い形で)
//   ① 844×390・667×375・844×340・740×320・568×320 で、トップのボタンが全部画面の中にある(右の列を送らなくても押せる)
//   ② どの大きさでも「対戦」がいちばん上から見えている(右の列は、はみ出すとき上から並べる。真ん中ぞろえで上が見えない所へ出ない)
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9017;
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
  let VIEW = { width: 844, height: 390 };
  const open = async (withAuto) => {
    const context = await browser.newContext({ viewport: VIEW });
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
  try {
    for (const [w, h] of [[844, 390], [667, 375], [844, 340], [740, 320], [568, 320]]) {
      VIEW = { width: w, height: h };
      const { context, page } = await open(true);
      await enterCard(page);
      await page.waitForTimeout(1200);
      const r = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('[data-card-top="top"] [data-card-top-cards] button, [data-card-top="top"] [data-card-top-shortcuts] button')].filter((b) => b.getClientRects().length);
        const out = btns.filter((b) => { const x = b.getBoundingClientRect(); return !(x.top >= 0 && x.bottom <= innerHeight + 0.5 && x.left >= 0 && x.right <= innerWidth + 0.5); }).map((b) => (b.innerText || '').replace(/\s+/g, ''));
        const battle = btns[0]; const menu = document.querySelector('[data-card-top-menu]');
        const br = battle ? battle.getBoundingClientRect() : null; const mr = menu ? menu.getBoundingClientRect() : null;
        return { n: btns.length, out, battleTop: br ? Math.round(br.top - mr.top) : -1, scrollTop: menu ? menu.scrollTop : -1 };
      });
      check(`① ${w}×${h}: トップのボタン(${r.n}個)が全部画面の中にある`, r.n === 8 && r.out.length === 0, r.out.join('・'));
      check(`② ${w}×${h}: 「対戦」がいちばん上から見えている`, r.battleTop >= 0 && r.scrollTop === 0, JSON.stringify(r));
      await context.close();
    }
    check('どこでも実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
