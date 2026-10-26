#!/usr/bin/env node
// MFバトルカードの対戦の上の帯が、どの幅でも切れないかを実際の画面で確かめる(2026-10-26 社長「上のタブが色々切れてる。難易度の表示もほしい」)。
//
//   node tools/card/card-head-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、帯の写真(head-<幅>x<高さ>.png)を残す
//
// 見ているもの(320×640・375×667・390×844・横向き 844×390)
//   ① 上の帯の中のどの字も切れていない(はみ出し・…で切れる が無い)・帯が画面の中に収まる
//   ② 難易度の札(EASY など)が出る
//   ③ 「投了」「記録」が押せる大きさ(高さ28px以上)で、ほかの物の下に隠れていない
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8985;
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
  try {
    for (const [w, h] of [[320, 640], [375, 667], [390, 844], [844, 390]]) {
      const page = await openBattle(browser, { sp: 'golem', hand: ['026', '100', '100', '100', '100'], discard: [], opp: ['100', '100', '100'], active: 1, viewport: { width: w, height: h } , mode: 'wait' }, errors).catch(async (e) => { errors.push(`${w}x${h} ${e.message.slice(0, 80)}`); return null; });
      if (!page) continue;
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const head = document.querySelector('[data-card-head]'); if (!head) return null;
        const hr = head.getBoundingClientRect();
        const cut = [];
        head.querySelectorAll('*').forEach((el) => {
          if (!el.getClientRects().length) return;
          const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
          if (el.scrollWidth > el.clientWidth + 1 && (cs.overflow !== 'visible' || cs.textOverflow === 'ellipsis')) cut.push((el.innerText || el.tagName).slice(0, 16));
          if (b.right > innerWidth + 0.5 || b.left < -0.5) cut.push(`外:${(el.innerText || el.tagName).slice(0, 16)}`);
        });
        const btn = (sel) => { const b = document.querySelector(sel); if (!b) return null; const q = b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { h: Math.round(q.height), ok: !!hit && b.contains(hit) }; };
        const lv = document.querySelector('[data-card-level-badge]');
        return { inside: hr.left >= -0.5 && hr.right <= innerWidth + 0.5 && hr.top >= -0.5, cut: [...new Set(cut)], level: lv ? lv.innerText : '', quit: btn('[data-card-quit]'), log: btn('[data-card-log-open]'), text: head.innerText.replace(/\s+/g, ' ') };
      });
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `head-${w}x${h}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, 120) } }); }
      check(`① ${w}×${h}: 上の帯の字が切れない・画面に収まる`, r && r.inside && !r.cut.length, r ? `${r.text} ${r.cut.join(' / ')}` : 'なし');
      check(`② ${w}×${h}: 難易度の札が出る`, r && /EASY|NORMAL|HARD|EXPERT|MASTER/.test(r.level), r && r.level);
      check(`③ ${w}×${h}: 「投了」「記録」が押せる大きさで隠れていない`, r && r.quit && r.log && r.quit.ok && r.log.ok && r.quit.h >= 28 && r.log.h >= 28, JSON.stringify(r && { quit: r.quit, log: r.log }));
      await page.close();
    }
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
