// MFバトルカード: 2回タップで詳しい画面(#3873)のあとも、1回目のタップは待たずにすぐ効くか(2026-10-27 部長ソランドくん)。
// 前は、守りの番・使う子・狙う相手で1回目を 350ms 待ってから動かしていたので、反応が遅く、
// 待っているあいだに別の札を押すと1回目が取り消されていた(ナガメくんの見つけた点)。
//
//   node tools/card/card-tap-instant-browser-check.js
//
// 場面は助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決める
//   A(自分の攻撃の番): 自分の1体目と2体目を同じ種類にして、どちらも使える技を手札に(使う子を選ぶ段が出る)
//   B(相手の攻撃を守る番): 手札は「緊急回避」(0ガッツ・全モンスターの回避)だけ
// 見るもの
//   ① 攻撃の番: 手札を1回押すと、すぐ選ばれる
//   ② 使う子 → 狙う相手 を速く続けて押しても、両方とも効いて技が出る(使う子が取り消されない)
//   ③ 同じ手札を2回続けて押すと詳しい画面。1回目で選んだ技は選ばれたまま残らない
//   ④ 守りの番: 守りの札を1回押すと、待たずにすぐ予告の窓が出る(前は 350ms 以上かかっていた)。「これで守る」で決める
//   ⑤ 守りの札が1回だけ使われる
//   ⑥ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8957;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
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
const FAST_MS = 250; // 押してから選ばれるまで(Playwright の押す手間を含む)。前の作りは 350ms 待っていた
// 守りの札を押してから手札から出るまで(守りの演出の分 約 0.7秒を含む)。待たない作りで 0.73秒前後、前の作りは 1.09秒前後だった
const GUARD_MS = 950;

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていない'); return; } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false });
    await ctx.route(/supabase\.co\//, (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
      s('mh_card_settings_v1', { confirmUse: 'OFF', confirmEnd: 'OFF', think: 'fast' });
    });
    await ctx.addInitScript(() => {
      window.__mhCardScene = (st) => {
        const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
        const me = st.players[0], opp = st.players[1];
        const m0 = me.mons[0];
        if (window.__mhTapScene === 'guard') {
          // B: 相手の番。相手の1体目を自分の1体目と同じ種類にして、その子の文の無いちから技で必ず攻める。自分の手札は緊急回避だけ
          const o0 = opp.mons[0];
          Object.assign(o0, { species: m0.species, name: m0.name, main: m0.main, sub: m0.sub, type: m0.type });
          const oatk = Object.values(db.cards).filter((c) => c.ready && c.user === m0.species && c.kind === 'pow' && !(c.effects || []).length && c.guts > 0).sort((a, b) => a.guts - b.guts)[0];
          opp.hand = [oatk.no, oatk.no, oatk.no, oatk.no, oatk.no];
          opp.guts = Array(9).fill(oatk.no);
          me.hand = ['109', '109', '109', '109', '109'];
          me.guts = Array(3).fill('109');
          st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 1; st.turn = 3; st.first = 1;
          opp.breederUsed = false; opp.mons.forEach((m) => { m.attacks = 0; });
          return st;
        }
        // A: 自分の番。2体目を1体目と同じ種類にして、どちらも使える技を手札に
        const m1 = me.mons[1];
        Object.assign(m1, { species: m0.species, name: m0.name, main: m0.main, sub: m0.sub, type: m0.type });
        const atk = Object.values(db.cards).filter((c) => c.ready && c.user === m0.species && c.kind === 'pow' && !(c.effects || []).length && c.guts > 0).sort((a, b) => a.guts - b.guts)[0];
        window.__mhTapAtk = atk ? atk.no : null;
        me.hand = [atk.no, atk.no, atk.no, atk.no, atk.no];
        me.guts = Array(9).fill(atk.no);
        opp.hand = ['100', '100', '100', '100', '100'];
        opp.guts = [];
        st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 0; st.turn = 2; st.first = 0;
        me.breederUsed = false; me.mons.forEach((m) => { m.attacks = 0; });
        return st;
      };
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
    const detailOpen = async () => (await page.locator('[data-card-detail]').count()) > 0;
    const closeDetail = async () => { if (await detailOpen()) { await page.locator('[data-card-detail]').click({ position: { x: 10, y: 10 } }).catch(() => {}); await sleep(300); } };
    const raisedIdx = () => page.evaluate(() => [...document.querySelectorAll('[data-card-hand-card]')].filter((el) => { const im = el.querySelector('img'); return im && /outline-amber-300/.test(im.className); }).map((el) => Number(el.getAttribute('data-card-hand-card'))));
    // 押してから選ばれるまでの時間(ms)。選ばれなければ null
    const tapLatency = async (loc) => {
      await page.evaluate(() => { window.__t0 = performance.now(); });
      await loc.click({ timeout: 5000 });
      return page.evaluate(() => new Promise((resolve) => {
        const end = window.__t0 + 1500;
        const tick = () => {
          const up = [...document.querySelectorAll('[data-card-hand-card] img')].some((im) => /outline-amber-300/.test(im.className));
          if (up) return resolve(Math.round(performance.now() - window.__t0));
          if (performance.now() > end) return resolve(null);
          setTimeout(tick, 5);
        };
        tick();
      }));
    };
    const mode = () => page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);

    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' });
    const home = page.locator('[data-home-card-battle]');
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
    for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
    await home.click();
    await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
    await sleep(600); await dismiss();
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
    const startBattle = async (scene) => {
      await page.evaluate((s) => { window.__mhTapScene = s; }, scene);
      await page.locator('[data-card-cpu]').first().click(); await sleep(300);
      await page.locator('[data-card-mode-assistant]').click();
      await page.locator('[data-card-foe="mua"]').click(); await sleep(200);
      await page.locator('[data-card-level="easy"]').click().catch(() => {});
      await page.locator('[data-card-start]').click();
      for (let i = 0; i < 40 && !(await page.locator('[data-card-battle]').count()); i++) { if (i > 6) await page.mouse.click(195, 420); await sleep(300); }
    };
    // 対戦を抜ける: 読み込み直して MFバトルカードへ入り直す(途中の対戦は、次に開いたとき投了として数えられる)
    const quitBattle = async () => {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
      await home.click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      await sleep(600); await dismiss();
    };

    // ---- A: 攻撃の番 ----
    await startBattle('attack');
    await page.waitForFunction(() => { const b = document.querySelector('[data-card-battle]'); return b && b.getAttribute('data-card-mode') === 'attack'; }, null, { timeout: 20000 });
    await sleep(800);
    const lat1 = await tapLatency(page.locator('[data-card-hand-card="0"]'));
    check('① 攻撃の番: 手札を1回押すと、すぐ選ばれる', lat1 !== null && lat1 < FAST_MS, `${lat1}ms`);
    // ③ 同じ手札を2回続けて → 詳しい画面・選びは戻る(いま 0 が選ばれているので、1 で確かめる)
    const h1 = page.locator('[data-card-hand-card="1"]');
    await h1.click(); await sleep(60); await h1.click(); await sleep(500);
    check('③ 同じ手札を2回続けて押すと、詳しい画面が出る', await detailOpen());
    await closeDetail();
    const up3 = await raisedIdx();
    check('③ 1回目で選んだ技は選ばれたまま残らない(前の選び＝0番に戻る)', !up3.includes(1), JSON.stringify(up3));
    // ② 使う子 → 狙う相手 を速く続けて
    if (!up3.includes(0)) { await page.locator('[data-card-hand-card="0"]').click(); await sleep(400); }
    const users = await page.locator('[data-card-mon^="0-"].ring-amber-300').count();
    check('② 使う子を選ぶ段が出る(同じ種類の2体)', users >= 2, `${users}体`);
    const hand0 = await page.locator('[data-card-hand-card]').count();
    const log0 = await page.locator('[data-card-log]').textContent().catch(() => '');
    await page.locator('[data-card-mon="0-0"]').click();
    await page.locator('[data-card-mon="1-0"]').click(); // 待たずに続けて
    let fired = false;
    for (let i = 0; i < 30 && !fired; i++) {
      await sleep(100);
      const log1 = await page.locator('[data-card-log]').textContent().catch(() => '');
      fired = (await page.locator('[data-card-hand-card]').count()) < hand0 || log1 !== log0 || (await page.locator('[data-card-bind-pick]').count()) > 0;
    }
    check('② 使う子 → 狙う相手 を速く続けて押しても、両方効いて技が出る', fired, `手札 ${hand0} → ${await page.locator('[data-card-hand-card]').count()}`);
    await sleep(1500);
    await quitBattle();

    // ---- B: 守りの番 ----
    await startBattle('guard');
    await page.waitForFunction(() => { const b = document.querySelector('[data-card-battle]'); return b && b.getAttribute('data-card-mode') === 'guard'; }, null, { timeout: 30000 }).catch(() => {});
    const inGuard = (await mode()) === 'guard';
    check('守りの番になる(相手が攻めてくる)', inGuard, String(await mode()));
    if (inGuard) {
      await sleep(2000); // 相手の技の知らせが出ているあいだは待つ
      // ④ 守りの札を1回押すと、待たずにすぐ予告の窓が出る(2026-10-29 案C: 「受けるダメージ 前→後」を見て「これで守る」で決める)
      await page.evaluate(() => { window.__t0 = performance.now(); });
      await page.locator('[data-card-hand-card="0"]').click();
      const lat4 = await page.evaluate(() => new Promise((resolve) => {
        const end = window.__t0 + 2500;
        const tick = () => {
          if (document.querySelector('[data-card-guard-ask]')) return resolve(Math.round(performance.now() - window.__t0));
          if (performance.now() > end) return resolve(null);
          setTimeout(tick, 5);
        };
        tick();
      }));
      check('④ 守りの番: 守りの札を1回押すと、待たずにすぐ予告の窓が出る', lat4 !== null && lat4 < GUARD_MS, `${lat4}ms`);
      await page.locator('[data-card-guard-ask-yes]').click();
      await sleep(1500);
      check('⑤ 守りが1回だけ使われる(手札の緊急回避が1枚減る)', (await page.locator('[data-card-hand-card]').count()) === 4, String(await page.locator('[data-card-hand-card]').count()));
    }
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message || e).slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
