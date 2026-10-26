#!/usr/bin/env node
// MFバトルカードの全体カード(場に1枚だけ残るカード)とおいのりを、実際の画面で通す(2026-10-25)。
//
//   node tools/card/card-field-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、写真(field-*.png)を残す
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする)
//   ① 自分が全体カードを出すと、場の札(data-card-env)に名前と「自分が出した」が出る・名前が切れない・タップで詳しい画面
//   ② 相手が全体カードを出した瞬間(おいのりの窓)に、窓が出る・狭い画面でも収まる・使うと、出した全体カードは場に出ず前のものが残る
//   ③ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8983;
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


// 決めた場面: 自分の番・攻撃の段。先頭の子を sp の種族にして、手札・捨て札・相手の手札を決める
const sceneScript = (cfg) => {
  window.__mhCardScene = (st) => {
    const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
    const me = st.players[0], opp = st.players[1];
    const m = Object.values(db.monsters).filter((x) => x.species === cfg.sp && !x.main).sort((a, b) => (a.no < b.no ? -1 : 1))[0];
    me.mons[0] = { ...me.mons[0], no: m.no, species: m.species, name: m.name, type: m.type, life: m.life, max: m.life, main: null, sub: null };
    me.hand = cfg.hand.slice(); me.discard = cfg.discard.slice(); me.guts = Array(9).fill('100');
    opp.hand = cfg.opp.slice(); opp.guts = Array(3).fill('100');
    st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = cfg.active || 0; st.turn = 2; st.first = 0;
    if (cfg.field) st.field = { no: cfg.field, p: 1, effects: (db.cards[cfg.field].effects || []).map((e) => ({ ...e })) };
    if (cfg.pray) st.pendingPray = { p: 0, by: 1, no: cfg.pray };
    me.breederUsed = false; me.mons.forEach((x) => { x.attacks = 0; });
    return st;
  };
};
const openBattle = async (browser, cfg, errors) => {
  const page = await browser.newPage({ viewport: cfg.viewport || { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  // 自分で Supabase を差し替える検査は印を入れる(印が無いと、差し替え先へ届く前にゲーム側が空の返事で止める。2026-10-27)
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
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
  await page.addInitScript(sceneScript, cfg);
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
  await page.waitForFunction((m) => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === m, cfg.mode || 'attack', { timeout: 20000 });
  return page;
};
// 手札の1枚目の特殊技を使う(使う子を選ぶ必要があれば先頭の子)
const useFirst = async (page) => {
  await page.locator('[data-card-hand-card="0"]').click();
  await page.waitForTimeout(200);
  const user = page.locator('[data-card-mon].ring-amber-300').first();
  if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
  await page.getByRole('button', { name: '使う' }).click();
};
const handNames = (page) => page.locator('[data-card-hand-card]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  // 場の全体カードの札: 名前が切れていない(はみ出していない)
  const fieldBadge = (page) => page.evaluate(() => { const b = document.querySelector('[data-card-env]'); if (!b) return null; const r = b.getBoundingClientRect();
    return { no: b.getAttribute('data-card-env'), side: b.getAttribute('data-card-env-side'), text: b.innerText.replace(/\s+/g, ''), inside: r.left >= 0 && r.right <= innerWidth + 0.5, fits: [...b.querySelectorAll('span')].every((s) => s.scrollWidth <= s.clientWidth + 1) }; });
  try {
    // ① 自分が全体カード(壮絶な戦い)を出す。相手はおいのりを持っていない
    {
      const page = await openBattle(browser, { sp: 'golem', hand: ['F116', '100'], discard: [], opp: ['100', '100', '100'] }, errors);
      await useFirst(page);
      await page.waitForSelector('[data-card-env]', { timeout: 8000 }).catch(() => {});
      const b = await fieldBadge(page);
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'field-mine.png') }); }
      check('① 全体カードを出すと、場の札に名前と「自分が出した」が出る', b && b.no === 'F116' && b.side === 'me' && b.text.includes('壮絶な戦い') && b.text.includes('自分'), JSON.stringify(b));
      check('① 場の札は画面の中で、名前が切れていない', b && b.inside && b.fits, JSON.stringify(b));
      await page.locator('[data-card-env]').click();
      await page.waitForTimeout(300);
      check('① 場の札をタップすると、カードの詳しい画面が出る', (await page.locator('[data-card-detail-note], [data-card-detail]').count()) > 0);
      await page.close();
    }
    // ② 相手が全体カード(大混乱)を出した瞬間: おいのりの窓が出て、使うと場に出ない(狭い画面 320 でも窓が収まる)
    {
      const page = await openBattle(browser, { sp: 'golem', hand: ['280', '100'], discard: [], opp: ['100', '100', '100'], active: 1, field: 'F261', pray: 'F120', mode: 'pray', viewport: { width: 320, height: 640 } }, errors);
      await page.locator('[data-card-pray]').waitFor({ timeout: 8000 }).catch(() => {});
      const box = await page.evaluate(() => { const el = document.querySelector('[data-card-pray] > div'); if (!el) return null; const r = el.getBoundingClientRect(); return { inside: r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5, text: el.innerText.replace(/\s+/g, '') }; });
      if (SHOT) await page.screenshot({ path: path.join(SHOT, 'field-pray.png') });
      check('② 相手が全体カードを出すと、おいのりの窓が出る(名前・文・2つのボタン)', box && box.text.includes('大混乱') && box.text.includes('おいのりを使う') && box.text.includes('使わない'), JSON.stringify(box));
      check('② おいのりの窓は 320×640 の画面に収まる', box && box.inside, JSON.stringify(box));
      await page.locator('[data-card-pray-use]').click();
      await page.waitForTimeout(1400); // おいのりのカードを大きく出してから効く(2026-10-26)
      const b = await fieldBadge(page);
      const log = await page.locator('[data-card-log]').innerText().catch(() => '');
      check('② おいのりを使うと窓が閉じて、大混乱は場に出ず、前の全体カード(飛び散る火花)が残る', (await page.locator('[data-card-pray]').count()) === 0 && b && b.no === 'F261' && b.side === 'foe', `${JSON.stringify(b)} ${log.replace(/\s+/g, ' ').slice(-80)}`);
      await page.close();
    }
    check('③ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
