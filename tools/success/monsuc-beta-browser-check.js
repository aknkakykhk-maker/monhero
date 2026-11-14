#!/usr/bin/env node
// モンヒロサクセスのβ版(56-monsuc-beta.jsx・2026-11-13)を実ブラウザで確かめる。
//   はじめて開くとβ版の話(2択)が出る → 見た印 mh_monsuc_beta_v1 が残り、開き直しても二度と出ない /
//   タイトルに「β」/ 助手はみゅあだけ選べ、ほかは「準備中」で、押すとみゅあの一言 / 準備の説明は最初の1回だけ /
//   育成の記念日(ジュニア期8月)が出来事の表にあり、体力 +50・ストレス −10 で一度きり(芯を node で回す)
// 使い方: node tools/success/monsuc-beta-browser-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const TURNS_BEFORE = Number(process.env.MSX_TURNS || 4); // 中断までに進めるターン
const TURNS_AFTER = 3;                                     // 再開してから進めるターン

if (!fs.existsSync(path.join(PARTS, '56-monhero-success-main.jsx')) || !fs.existsSync(path.join(PARTS, '56-monhero-success-store.jsx'))) {
  console.log('SKIP: モンヒロサクセスの画面(回2)がまだ入っていないので見送り'); process.exit(0);
}
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e2) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
}
const { eventStorySeed, quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const released = /monheroSuccess:\s*true/.test(fs.readFileSync(path.join(PARTS, '17-release-changelog-login-missions.jsx'), 'utf8'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server)); // 空いているポートを使う(ほかの検査とぶつからない)
});

const SEED = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare']));
  window.__mhSupabaseStubbed = true;
};

// 外へは出さない(Supabase・助手のおしゃべりの中継・外の CDN)
// (playwright は後から足した route が先に効くので、外を止める行を先に足す)
const isolate = async (page) => {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
};
const prepare = async (page, errors, consoleErrors) => {
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|favicon|status of 404|status of 503/i.test(t)) consoleErrors.push(t.slice(0, 160)); } });
  await page.addInitScript(SEED);
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(eventStorySeed());
  await isolate(page);
};
const toHome = async (page, port) => {
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 6; i++) { // ログインボーナス・お知らせ
    const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
  }
};
const openEntry = async (page) => {
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  const btn = page.locator('[data-debug-monhero-success]');
  await btn.evaluate((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await btn.dispatchEvent('click');
  await page.waitForSelector('.msx[data-msx-view]', { timeout: 30000 });
  await page.waitForTimeout(400);
};

// ---- 育成の記念日(芯を node で) ----
const annivCheck = () => {
  const { load } = require('./load');
  const { SUC } = load(); const EV = SUC.events;
  const at = (t) => { let s = SUC.newRun({ id: 'beta-anniv', species: SUC.speciesList[0], aid: 'mua' }); return { ...s, turn: t, hp: Math.round(s.hpMax * 0.2), stress: 30 }; };
  const r12 = EV.open(at(12), 'start'); check('記念日: ターン12には出ない', !(r12.out.ev && r12.out.ev.id === 'ev.self.anniv'));
  const s13 = at(13); const r = EV.open(s13, 'start'); const id = r.out.ev && r.out.ev.id;
  check('記念日: ターン13のはじめに出る', id === 'ev.self.anniv', String(id));
  if (id !== 'ev.self.anniv') return;
  const p = EV.pick(r.state, null);
  check('記念日: 体力が上限の50%回復', p.state.hp === Math.min(s13.hpMax, s13.hp + s13.hpMax * 0.5), `${s13.hp} → ${p.state.hp} / ${s13.hpMax}`);
  check('記念日: ストレス −10', p.state.stress === s13.stress - 10, `${s13.stress} → ${p.state.stress}`);
  const r2 = EV.open({ ...p.state, turn: 14, acted: false }, 'start');
  check('記念日: 一度きり(次のターンに出ない)', !(r2.out.ev && r2.out.ev.id === 'ev.self.anniv'));
};

(async () => {
  annivCheck();
  const server = await serve(); const port = server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  try {
    const errors = []; const cerr = [];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await prepare(page, errors, cerr);
    await toHome(page, port);
    await openEntry(page);
    const open = page.locator('[data-msx-beta="open"]');
    await open.waitFor({ timeout: 20000 }).catch(() => {});
    check('はじめて開くとβ版の話が出る', await open.count() === 1);
    check('タイトルに「β」', await page.locator('[data-msx-beta-mark]').count() >= 1);
    for (let i = 0; i < 30 && await open.count(); i++) {
      const opt = page.locator('.msx-beta-opts button').first();
      if (await opt.count()) await opt.click(); else await page.locator('.msx-beta-card').click();
      await page.waitForTimeout(120);
    }
    check('β版の話を最後まで読むと閉じる', await open.count() === 0);
    await page.waitForTimeout(300);
    const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_monsuc_beta_v1')); } catch (e) { return null; } });
    check('見た印 mh_monsuc_beta_v1 に open が残る', !!(saved && saved.seen && saved.seen.open), JSON.stringify(saved));
    // 新しく育成をはじめる → 準備の説明(最初の1回)
    await page.getByRole('button', { name: /新しく育成をはじめる/ }).click();
    await page.locator('[data-msx-scenario-next]').click(); // ストーリー選択(2026-11-14)の次へ
    const prep = page.locator('[data-msx-beta="prep"]');
    await prep.waitFor({ timeout: 10000 }).catch(() => {});
    check('準備の画面で説明が出る', await prep.count() === 1);
    for (let i = 0; i < 20 && await prep.count(); i++) { await page.locator('.msx-beta-card').click(); await page.waitForTimeout(100); }
    check('準備の説明を読むと閉じる', await prep.count() === 0);
    // 助手の選択(3つ目の段)まで進む
    for (let i = 0; i < 2; i++) { await page.locator('.v-ft button.go').click(); await page.waitForTimeout(200); }
    const opens = await page.locator('.v-faces button').count();
    check('選べる助手はみゅあだけ', opens === 1, `選べる ${opens}`);
    check('あつは準備中', await page.locator('[data-msx-soon="atsu"]').count() === 1);
    await page.locator('[data-msx-soon="atsu"]').click();
    const lock = page.locator('[data-msx-beta="lock"]');
    await lock.waitFor({ timeout: 5000 }).catch(() => {});
    check('準備中の助手を押すとみゅあの一言', await lock.count() === 1, await lock.innerText().catch(() => ''));
    await page.waitForTimeout(800); await page.screenshot({ path: path.join(ROOT, 'docs', 'progress', 'player-raise', 'shots', 'beta-2026-11-13', 'lock.png') }).catch(() => {});
    for (let i = 0; i < 5 && await lock.count(); i++) { await page.locator('.msx-beta-card').click(); await page.waitForTimeout(100); }
    check('一言は閉じられる', await lock.count() === 0);
    // 閉じて開き直すと、β版の話はもう出ない
    await page.locator('.v-hd .bk').click(); await page.waitForTimeout(200);
    for (let i = 0; i < 3 && await page.locator('.v-hd .bk').count(); i++) { await page.locator('.v-hd .bk').first().click(); await page.waitForTimeout(250); }
    await page.locator('[data-debug-monhero-success]').dispatchEvent('click');
    await page.waitForSelector('.msx[data-msx-view="home"]', { timeout: 20000 });
    await page.waitForTimeout(800);
    check('開き直すとβ版の話は出ない', await page.locator('[data-msx-beta]').count() === 0);
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
    check('コンソールのエラーが出ない', cerr.length === 0, cerr.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG monsuc-beta-browser-check: ${failed} 件` : 'OK monsuc-beta-browser-check: すべて');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
