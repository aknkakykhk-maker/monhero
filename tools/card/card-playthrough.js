#!/usr/bin/env node
// MFバトルカードの通し遊び(2026-10-27 カード部ソランドくんの割り振り)。検査ではなく、人が遊ぶのと同じ押し方で最後まで通す台本。
// 1日にたくさんの直しが入ったあとに、実物の画面で「止まらない・エラーが出ない・押した手が消えない」をまとめて見る。
//
//   node tools/card/card-playthrough.js [--sizes 390x844,844x390,320x568] [--levels easy,normal,hard,expert,master] [--shots <フォルダ>] [--no-tutorial]
//
// やること(画面の大きさごと)
//   ① デバッグ設定の入口からスターターを選ぶ(本番のランキングへは送らない。Supabase への通信は全部ここで止める)
//   ② 練習試合を、ドラの案内どおりに最後まで押す
//   ③ 助手と対戦を、難易度ごとに1戦ずつ最後まで(自分の番は、出せるカードを押して使う子・相手を選ぶ。ときどき守る・ガッツにする)
//   ④ 結果の画面から「この対戦を見る」(見返し)を開き、最後まで進めて戻る
//   見るもの: 実行時エラー / 60秒動かない(止まり)/ 押したのに手が進まない回数 / 結果の画面まで行けたか。写真は --shots のフォルダへ
// マルチ2台・観戦は card-pvp-browser-check.js・card-pvp-watch-browser-check.js が最後まで通すので、そちらを回す
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8981;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SIZES = opt('--sizes', '390x844,844x390,320x568').split(',').map((s) => s.split('x').map(Number));
const LEVELS = opt('--levels', 'easy,normal,hard,expert,master').split(',');
const FOES = { easy: 'mua', normal: 'momosuke', hard: 'kiki', expert: 'kyuko', master: 'atsu' };
const SHOT = opt('--shots', '');
const TUTORIAL = !args.includes('--no-tutorial');
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
const results = [];
const note = (s) => { console.log(s); results.push(s); };
const shot = async (page, name) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }).catch(() => {}); };

// ---- 入口まで(card-qa-board-browser-check.js と同じ道) ----
const openTop = async (browser, [w, h], errors) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  // 本番のランキング・外の AI へは送らない(読むのも空で返す)
  await page.route(/supabase\.co|anthropic|card-assistant-talk/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => {
    window.__mhCardPvpAuto = false;
    if (sessionStorage.getItem('__cardSeeded')) return;
    sessionStorage.setItem('__cardSeeded', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', '通し遊び'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_card_cpu_unlocked_v1', { easy: true, normal: true, hard: true, expert: true, master: true });
    put('mh_card_settings_v1', { speed: 'fast', autoPass: true });
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
  await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
  return page;
};

// ---- 盤の上で1手ぶん押す。返す: 'over' | 'acted' | 'wait' ----
const R = (n) => Math.floor(Math.random() * n);
const modeOf = (page) => page.evaluate(() => { const b = document.querySelector('[data-card-battle]'); return b ? b.getAttribute('data-card-mode') : null; });
// 案内(「使う子をタップ」など)は下のボタンの上の札に出るので、盤ぜんたいの字から探す
const footerText = (page) => page.evaluate(() => (document.querySelector('[data-card-battle]') || document.body).innerText);
const clickText = async (page, re) => { const b = page.getByRole('button', { name: re }).first(); if (await b.count() && await b.isVisible().catch(() => false) && await b.isEnabled().catch(() => false)) { await b.click({ timeout: 3000 }).catch(() => {}); return true; } return false; };
const ringed = (page, cls, side) => page.evaluate(([c, s]) => [...document.querySelectorAll('[data-card-mon]')].filter((el) => el.className.includes(c) && (s === null || el.getAttribute('data-card-mon').startsWith(`${s}-`))).map((el) => el.getAttribute('data-card-mon')), [cls, side]);
const tapMon = (page, id) => page.locator(`[data-card-mon="${id}"]`).first().click({ timeout: 3000 }).catch(() => {});
const handCount = (page) => page.locator('[data-card-hand-card]').count();
const tapHand = (page, i) => page.locator(`[data-card-hand-card="${i}"]`).first().click({ timeout: 3000 }).catch(() => {});

const playStep = async (page, stats) => {
  if (await page.locator('[data-card-top="result"]').count()) return 'over';
  // 窓(選ぶ段・割り振り・カード投げ・確かめ・名指し)
  if (await page.locator('[data-card-choose-item]').count()) { await page.locator('[data-card-choose-item]').first().click().catch(() => {}); return 'acted'; }
  if (await page.locator('[data-card-split]').count()) { await page.locator('[data-card-split]').first().click().catch(() => {}); return 'acted'; }
  if (await page.locator('[data-card-toss-go]').count()) { await page.locator('[data-card-toss-go]').first().click().catch(() => {}); return 'acted'; }
  if (await page.locator('[data-card-pray-pass]').count()) { await page.locator('[data-card-pray-pass]').first().click().catch(() => {}); return 'acted'; }
  if (await clickText(page, /^はい$|名指しする|^OK$/)) return 'acted';
  if (await clickText(page, /^閉じる$/)) { stats.detail = (stats.detail || 0) + 1; return 'acted'; } // 2回タップの詳しい画面
  const mode = await modeOf(page);
  if (!mode) return 'wait';
  if (mode === 'setup') { await clickText(page, /始める/); return 'acted'; }
  if (mode === 'discard') { const t = await footerText(page); const n = Number((t.match(/(\d+)枚えらんで捨てる/) || [])[1] || 1); for (let i = 0; i < n; i++) await tapHand(page, i); await clickText(page, /えらんで捨てる/); return 'acted'; }
  if (mode === 'guard') {
    if (Math.random() < 0.5) { const hc = await handCount(page); for (let i = 0; i < hc; i++) { await tapHand(page, i); const u = await ringed(page, 'ring-4 ring-amber-300', 0); if (u.length) { await tapMon(page, u[0]); stats.guards++; return 'acted'; } } }
    await clickText(page, /守らない|これで守る/); return 'acted';
  }
  if (mode === 'guts') {
    if (Math.random() < 0.6) await tapHand(page, R(await handCount(page) || 1));
    await clickText(page, /ターン終了/); return 'acted';
  }
  if (mode === 'attack') {
    if (stats.turnActs >= 3 || Math.random() < 0.15) { stats.turnActs = 0; await clickText(page, /攻撃おわり/); return 'acted'; }
    const hc = await handCount(page);
    const order = [...Array(hc).keys()].sort(() => Math.random() - 0.5);
    for (const i of order) {
      await tapHand(page, i); await page.waitForTimeout(80);
      let g = await footerText(page);
      if (/使う子をタップ/.test(g)) { const u = await ringed(page, 'ring-4 ring-amber-300', 0); if (u.length) await tapMon(page, u[R(u.length)]); g = await footerText(page); }
      if (/狙う相手をタップ/.test(g)) { const t = await ringed(page, 'ring-4 ring-rose-400', null); if (t.length) { await tapMon(page, t[R(t.length)]); stats.used++; stats.turnActs++; return 'acted'; } }
      if (await page.locator('[data-card-split-open]').count()) { await page.locator('[data-card-split-open]').click().catch(() => {}); stats.used++; stats.turnActs++; return 'acted'; }
      if (await page.locator('[data-card-form]').count()) { await page.locator('[data-card-form]').first().click().catch(() => {}); stats.used++; stats.turnActs++; return 'acted'; }
      if (await clickText(page, /^使う$/)) { stats.used++; stats.turnActs++; return 'acted'; }
    }
    stats.turnActs = 0; await clickText(page, /攻撃おわり/); return 'acted';
  }
  return 'wait';
};
// 試合を最後まで。盤の指紋が60秒変わらなければ「止まった」
const playMatch = async (page, label, errors) => {
  const stats = { used: 0, guards: 0, turnActs: 0, steps: 0 };
  let last = '', since = Date.now(), shotMid = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60 * 1000) {
    const r = await playStep(page, stats).catch((e) => { errors.push(`台本: ${String(e).slice(0, 120)}`); return 'wait'; });
    if (r === 'over') break;
    stats.steps++;
    if (!shotMid && stats.used >= 3) { await shot(page, `${label}-mid`); shotMid = true; }
    const sig = await page.evaluate(() => { const b = document.querySelector('[data-card-battle]'); return b ? `${b.getAttribute('data-card-mode')}|${(document.querySelector('[data-card-head]') || {}).innerText || ''}|${document.querySelectorAll('[data-card-hand-card]').length}` : document.body.innerText.slice(0, 80); }).catch(() => '');
    if (sig !== last) { last = sig; since = Date.now(); }
    if (Date.now() - since > 60000) { await shot(page, `${label}-stuck`); return { ok: false, why: `60秒動かない(${sig.slice(0, 80)})`, stats }; }
    await page.waitForTimeout(r === 'wait' ? 400 : 150);
  }
  const over = await page.locator('[data-card-top="result"]').count();
  if (over) await shot(page, `${label}-result`);
  return { ok: !!over, why: over ? '' : '12分で終わらない', stats };
};

// 練習試合: ドラの「次へ」と、光っている所(案内の手札・ボタン)を順に押す
const playTutorial = async (page, label, errors) => {
  // 1回の繰り返しで1つだけ押し、700ms あける(同じ所を続けて押すと2回タップの詳しい画面になる)
  const t0 = Date.now(); let n = 0;
  while (Date.now() - t0 < 6 * 60 * 1000) {
    if (await page.locator('[data-card-top="result"]').count()) return { ok: true, n };
    let did = await clickText(page, /^閉じる$/);
    if (!did && await page.locator('[data-card-tutor-next]').count()) did = await page.locator('[data-card-tutor-next]').first().click({ timeout: 2000 }).then(() => true).catch(() => false);
    if (!did) { const t = await ringed(page, 'ring-4 ring-rose-400', 1); if (t.length) { await tapMon(page, t[0]); did = true; } }
    if (!did) { const u = await ringed(page, 'ring-4 ring-amber-300', 0); if (u.length) { await tapMon(page, u[0]); did = true; } }
    if (!did) { const focus = page.locator('[data-card-tutor-focus], .animate-pulse'); if (await focus.count()) did = await focus.first().click({ timeout: 2000 }).then(() => true).catch(() => false); }
    if (did) n++;
    await page.waitForTimeout(700);
    if (errors.length > 20) break;
  }
  return { ok: false, n };
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  try {
    for (const size of SIZES) {
      const tag = `${size[0]}x${size[1]}`;
      const errors = [];
      const page = await openTop(browser, size, errors);
      if (TUTORIAL) {
        const tu = await playTutorial(page, `${tag}-tutorial`, errors);
        await shot(page, `${tag}-tutorial-end`);
        note(`${tu.ok ? 'OK' : 'NG'}: ${tag} 練習試合を最後まで(押した ${tu.n} 回)`); if (!tu.ok) bad++;
        if (!tu.ok) { await clickText(page, /^閉じる$/); await page.locator('[data-card-quit]').click().catch(() => {}); await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click().catch(() => {}); }
      } else {
        await page.locator('[data-card-quit]').click(); await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
      }
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 }).catch(() => {});
      await clickText(page, /トップへ/);
      for (const lv of LEVELS) {
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-cpu]').click();
        await page.locator('[data-card-mode-assistant]').click();
        await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
        await page.locator(`[data-card-foe="${FOES[lv]}"]`).click();
        await page.locator(`[data-card-level="${lv}"]`).click().catch(() => {});
        await page.locator('[data-card-start]').click();
        await page.locator('[data-card-battle]').waitFor({ timeout: 30000 });
        const label = `${tag}-${lv}`;
        const r = await playMatch(page, label, errors);
        const outcome = r.ok ? await page.locator('[data-card-outcome], [data-card-result-banner]').first().innerText().catch(() => '') : '';
        note(`${r.ok ? 'OK' : 'NG'}: ${tag} ${lv}(${FOES[lv]}) を最後まで ${r.why} — 技 ${r.stats.used}回・守り ${r.stats.guards}回・手 ${r.stats.steps}・${outcome.replace(/\s+/g, ' ').slice(0, 30)}`);
        if (!r.ok) { bad++; await page.reload(); continue; }
        // 見返し: 結果の画面から開いて、最後まで進めて戻る
        if (lv === LEVELS[LEVELS.length - 1] && await page.locator('[data-card-result-replay]').count()) {
          await page.locator('[data-card-result-replay]').first().click();
          const opened = await page.locator('[data-card-replay-badge]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
          for (let i = 0; i < 400 && opened; i++) { if (!(await clickText(page, /^▶|次へ|進む|›/))) break; }
          await shot(page, `${label}-replay`);
          const back = opened && (await page.locator('[data-card-replay-exit]').first().click().then(() => true).catch(() => false));
          note(`${opened && back ? 'OK' : 'NG'}: ${tag} 見返しを開いて戻る`); if (!(opened && back)) bad++;
          await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 }).catch(() => {});
        }
        await clickText(page, /トップへ/);
      }
      const uniq = [...new Set(errors)];
      note(`${uniq.length ? 'NG' : 'OK'}: ${tag} 実行時エラー ${uniq.length}件${uniq.length ? ` — ${uniq.slice(0, 3).join(' / ')}` : ''}`); if (uniq.length) bad++;
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(bad ? `\n${bad}件 NG` : '\nすべて OK');
  process.exit(bad ? 1 : 0);
})();
