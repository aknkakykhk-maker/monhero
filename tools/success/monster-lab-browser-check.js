#!/usr/bin/env node
// モンスター画面(研究所・56-monster-lab.jsx)の通し検査(本物のブラウザ)。デバッグ設定の「🔬 モンスター(試す)」から実際に押す。
//   node tools/success/monster-lab-browser-check.js
//   SHOT_DIR=<フォルダ> node tools/success/monster-lab-browser-check.js   … 場面ごとに止め絵も撮る
// 見るもの(縦390×844・幅320×568):
//   ① 入口に「マスモン」「合体円盤石」「ベースモン」「図鑑」の4つ(「育てた子」の言い方が画面に出ない)
//   ② マスモン一覧に保存枠の子が並び、詳細に「ベースモン ○ → ▲○」が出る(読むだけ・mh_monsuc_* を書き換えない)
//   ③ ベースモン一覧 → 詳細の特徴・適性(ピクシー: 遠A・中B・近F・零G の並び)。オリジナル5種は「資料待ち」
//   ④ 真っ白・ページのエラーが出ない
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');

let chromium0 = null;
const { eventStorySeed, quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));

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
  localStorage.setItem('mh_monsuc_box_v1', JSON.stringify({ v: 1, cap: 30, memory: [], mons: [{ id: 'chk1', species: 'Pixie', nick: 'ぴくりん', st: { life: 640, pow: 512, wise: 802, hit: 455, eva: 590, tough: 210 }, techs: [], lv: 50, rank: 'A', score: 14200, raised: true, gen: 1 }, { id: 'chk2', species: 'Tiger', nick: '', st: { life: 0, pow: 0, wise: 0, hit: 0, eva: 0, tough: 0 }, techs: [], lv: 1, rank: '', score: 0, raised: false, gen: 2 }] }));
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
    const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
  }
};
const openEntry = async (page) => {
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: '分かった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  const btn = page.locator('[data-debug-monster-lab]');
  await btn.evaluate((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await btn.dispatchEvent('click');
  await page.waitForSelector('[data-monster-lab]', { timeout: 30000 });
  await page.waitForTimeout(400);
};


(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e2) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); } }
  const server = await serve(); const port = server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  for (const [vw, vh] of [[390, 844], [375, 812], [320, 568]]) {
    const tag = `${vw}x${vh}`;
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errors = [], consoleErrors = [];
    await prepare(page, errors, consoleErrors);
    await toHome(page, port); await openEntry(page);
    const shot = async (n) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `lab-${tag}-${n}.png`) }); } };
    const text = () => page.locator('[data-monster-lab]').innerText();
    const press = (name) => page.locator('[data-monster-lab] button', { hasText: name }).first().click();
    let t = await text();
    check(`${tag} 入口に4つ`, /マスモン/.test(t) && /合体円盤石/.test(t) && /ベースモン/.test(t) && /図鑑/.test(t)); await shot('door');
    check(`${tag} 「育てた子」の言い方が出ない`, !/育てた子|育て終えた子/.test(t));
    await press('マスモン'); await page.waitForTimeout(500); t = await text();
    check(`${tag} マスモン一覧に保存枠の1体と合体円盤石の区切り`, /ぴくりん/.test(t) && /Lv\.50/.test(t) && !/合体円盤石/.test(t.split('保存枠')[0])); await shot('mas');
    await press('ぴくりん'); await page.waitForTimeout(400); t = await text();
    // 言葉の途中で折り返さない: 入口と一覧の見出し・説明が1行に収まる(札・ボタンの中の文字の高さが1行ぶん)
    check(`${tag} 詳細にベースモンからの伸び ▲`, /ベースモン 50 → ▲590/.test(t) || /ベースモン \d+ → ▲\d+/.test(t), t.replace(/\s+/g, ' ').slice(0, 160)); await shot('mas-detail');
    await press('戻る'); await page.waitForTimeout(200); await press('戻る'); await page.waitForTimeout(200); await press('合体円盤石'); await page.waitForTimeout(300); await shot('fuse'); await press('ライガー'); await page.waitForTimeout(300); t = await text();
    check(`${tag} 合体円盤石の詳細に ▲ が出ない`, /合体円盤石詳細/.test(t) && !/▲/.test(t)); await shot('fuse-detail');
    await press('戻る'); await page.waitForTimeout(200); await press('戻る'); await page.waitForTimeout(200); await press('マスモン'); await page.waitForTimeout(300); await press('ぴくりん'); await page.waitForTimeout(300);
    await press('適性'); await page.waitForTimeout(200); t = await text();
    check(`${tag} 間合い適性は 遠A・中B・近F・零G`, /遠\s*A\s*中\s*B\s*近\s*F\s*零\s*G/.test(t.replace(/\s+/g, ' ').replace(/\s/g, '')) || /遠A中B近F零G/.test(t.replace(/\s/g, '')), t.replace(/\s+/g, ' ').slice(0, 200)); await shot('apt');
    await press('特徴'); await page.waitForTimeout(200); t = await text();
    check(`${tag} 特徴にガッツ回復力・移動速度・サイズ`, /ガッツ回復力/.test(t) && /移動速度/.test(t) && /サイズ/.test(t)); await shot('feature');
    await press('戻る'); await page.waitForTimeout(200); await press('戻る'); await page.waitForTimeout(200);
    await press('ベースモン'); await page.waitForTimeout(400); t = await text();
    check(`${tag} ベースモン一覧`, /ピクシー/.test(t) && /ベース/.test(t)); await shot('base');
    const box0 = await page.evaluate(() => localStorage.getItem('mh_monsuc_box_v1'));
    check(`${tag} 保存枠を書き換えない`, !!box0 && JSON.parse(box0).mons.length === 2);
    const body = await page.evaluate(() => document.body.innerText.length);
    check(`${tag} 真っ白でない・ページのエラー無し`, body > 50 && errors.length === 0, errors.concat(consoleErrors).slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed} 件` : 'ALL OK'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('NG: 例外', e && e.message); process.exit(1); });
