// MFバトルカード: 助手と対戦の途中で閉じた試合を、次に開いたときに投了として数える(2026-10-26 社長「負け扱いにする」)。
// 印は新しいキー mh_card_cpu_open_v1(84-screen-card-battle.jsx の CARD_CPU_OPEN_KEY)。実際のブラウザで確かめる。
//
//   node tools/card/card-cpu-open-browser-check.js
//
// 見るもの
//   ① 助手と対戦を始めると、印(試合の鍵・相手・強さ・自分の番の数)が書かれる
//   ② 対戦の途中で読み込み直し、もう一度入ると、記録の投了が1つ増え、連勝が切れ、印が消える。トップに知らせが出る
//   ③ もう一度開き直しても、二重に数えない
//   ④ 印が新しい(ほかのタブで対戦中)ときは数えない
//   ⑤ 投了ボタンで終えたときは、印が結果と一緒に消える(次に開いても数えない)
//   ⑥ 壊れた印は数えずに消す。実行時エラーが無い・mh_card_* 以外の保存を書き換えない
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8947;
const OPEN_KEY = 'mh_card_cpu_open_v1';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    // 検証環境に置いてある Chromium があればそれを使う(tools の playwright と版が違っても動くように。ほかのカードの検査と同じ)
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    // 本物の Supabase へは書かない(読むだけは通す)。外の AI も呼ばない
    await ctx.route(/supabase\.co\//, (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const sleep = (ms) => page.waitForTimeout(ms);
    const dismiss = async () => {
      for (let i = 0; i < 8; i++) {
        const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await sleep(250);
      }
    };
    const boot = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
    };
    const enterCard = async () => { await page.locator('[data-home-card-battle]').click(); await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 }); await sleep(800); await dismiss(); };
    const ls = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, k);
    const surrenders = async () => { const r = await ls('mh_card_record_v1'); return r && r.cpu ? r.cpu.surrender || 0 : 0; };
    const startMua = async () => {
      await page.locator('[data-card-cpu]').first().click(); await sleep(300);
      await page.locator('[data-card-mode-assistant]').click();
      await page.locator('[data-card-foe="mua"]').click(); await sleep(200);
      await page.locator('[data-card-level="easy"]').click().catch(() => {});
      await page.locator('[data-card-start]').click(); await page.locator('[data-card-deck-pick-go]').click(); // 対戦の前のデッキ選び(前に使ったデッキが選ばれている)
      for (let i = 0; i < 40 && !(await page.locator('[data-card-battle]').count()); i++) { if (i > 6) await page.mouse.click(195, 420); await sleep(300); }
    };

    await boot();
    await enterCard();
    // はじめてはスターター → 練習試合(飛ばす)
    if (await page.locator('[data-card-top="starter"]').count()) {
      await page.locator('[data-card-kit="speed"]').click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: /トップへ/ }).first().click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
    }
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_') && !k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));

    // ① 始めると印が書かれる
    await startMua();
    await sleep(800);
    const open1 = await ls(OPEN_KEY);
    check('① 助手と対戦を始めると、印(試合の鍵・相手・強さ)が書かれる', !!open1 && typeof open1.id === 'string' && open1.who === 'mua' && open1.level === 'easy' && !!open1.facts, JSON.stringify(open1));

    // ② 途中で読み込み直す → 入り直すと投了として数える(beat を古くして、15秒待たずに確かめる)
    const s0 = await surrenders();
    await page.evaluate((key) => { const v = JSON.parse(localStorage.getItem(key)); v.beat = Date.now() - 60000; v.facts = { ownTurns: 5, kos: 1 }; localStorage.setItem(key, JSON.stringify(v)); }, OPEN_KEY);
    await boot();
    await page.evaluate((key) => { const v = JSON.parse(localStorage.getItem(key)); if (v) { v.beat = Date.now() - 60000; localStorage.setItem(key, JSON.stringify(v)); } }, OPEN_KEY);
    await enterCard();
    let notice = '';
    for (let i = 0; i < 20 && !/投了/.test(notice); i++) { await sleep(400); notice = await page.locator('[data-card-top-notice]').innerText().catch(() => ''); }
    const s1 = await surrenders();
    const rec1 = await ls('mh_card_record_v1');
    check('② 途中で閉じた試合を、次に開いたときに投了として1つ数える', s1 === s0 + 1, `${s0} → ${s1}`);
    check('② 連勝が切れる(いまの連勝 0)', !!rec1 && !!rec1.rank && rec1.rank.streak.now === 0, JSON.stringify(rec1 && rec1.rank && rec1.rank.streak));
    check('② 最近の対戦に「投了」が入る', !!rec1 && Array.isArray(rec1.recent) && rec1.recent[0] && rec1.recent[0].outcome === 'surrender' && rec1.recent[0].who === 'mua');
    check('② 印が消える', (await ls(OPEN_KEY)) === null);
    check('② トップに「投了として数えました」の知らせが出る', /投了として数えました/.test(notice), notice);

    // ③ 二重に数えない
    await boot();
    await enterCard();
    await sleep(1500);
    check('③ もう一度開いても、二重に数えない', (await surrenders()) === s1);

    // ④ 印が新しい(ほかのタブで対戦中)ときは数えない
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ id: 'other-tab', who: 'kiki', level: 'easy', rankable: false, at: Date.now(), beat: Date.now() + 60000, facts: { ownTurns: 4, kos: 0 } })), OPEN_KEY);
    await boot();
    await enterCard();
    await sleep(1500);
    check('④ ほかのタブで対戦中(印が新しい)なら数えない', (await surrenders()) === s1 && !!(await ls(OPEN_KEY)));
    // ⑥ 壊れた印は数えずに消す
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ id: 3, level: 'weird' })), OPEN_KEY);
    await boot();
    await enterCard();
    await sleep(1500);
    check('⑥ 壊れた印は数えずに消す', (await surrenders()) === s1 && (await ls(OPEN_KEY)) === null);

    // ⑤ 投了ボタンで終えたら、印は結果と一緒に消える
    await startMua();
    await sleep(800);
    await page.locator('[data-card-quit]').click();
    await page.getByRole('button', { name: /^投了する$/ }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
    await sleep(600);
    const s2 = await surrenders();
    check('⑤ 投了ボタンの投了は1つだけ数え、印は結果と一緒に消える', s2 === s1 + 1 && (await ls(OPEN_KEY)) === null, `${s1} → ${s2}`);
    await boot();
    await enterCard();
    await sleep(1500);
    check('⑤ 次に開いても、投了ボタンの試合をもう一度数えない', (await surrenders()) === s2);

    const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_') && !k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));
    // ビートP(ポイント)はカードとモンヒロビートで同じ物なので増減してよい。クイック周回の記録・時刻の印など、起動ごとに変わるものも除く
    const allowed = /^mh_(rhythm_event_points_v1|quick|last_|login|daily|session|bgm|boot|app_|breeder_id|assistant|mission|play|seen|notice|title)/;
    const changed = Object.keys(before).filter((k) => before[k] !== after[k] && !allowed.test(k));
    check('⑥ mh_card_* とビートP以外の保存を、この操作で消していない', Object.keys(before).every((k) => k in after), changed.slice(0, 5).join(','));
    check('⑥ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
