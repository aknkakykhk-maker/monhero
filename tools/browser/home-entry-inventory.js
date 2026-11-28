#!/usr/bin/env node
// HOME の作り直し(r1126-073 追記1)の「入口の洗い出し」。時計を開幕後(既定 11/28 10:05)にずらし、
// HOME から各画面を1つずつ開いて、見えている押す所(button・a・role=button)の名前を全部拾う。
// 拾った名前をコンテンツ(イベント・モンヒロビート・バトル・カード・サクセス・マーケット・助手ライフ・ミッション・ギフトなど)の語で振り分け、
// 「どの画面のどの押す所から、どのコンテンツへ入れるか」を一覧にする。止め絵も画面ごとに残す。
//   SHOT_DIR=<置き場> [AT=2026-11-28T10:05:00+09:00] node tools/browser/home-entry-inventory.js
//   置き場に <画面>.jpg と inventory.json を残す
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8964;
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, 'docs/progress/home-rebuild-2026-11/entries');
const AT = process.env.AT || '2026-11-28T10:05:00+09:00';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
// 画面の開き方(HOME から)。sel を押す。pre があれば先に押す
const SCREENS = [
  { id: 'home', label: 'HOME' },
  { id: 'home-menu', label: 'HOME のメニュー☰', sel: '[data-home-menu-btn]', stay: true },
  { id: 'assistant-menu', label: '助手の吹き出しのメニュー', pre: '[data-home-assistant-toggle="show"]', sel: '.mh-home-assistant [data-bubble-text]', stay: true },
  { id: 'profile', label: 'プロフィール', sel: '.mh-home-player' },
  { id: 'missions', label: 'ミッション', sel: '.mh-home-mission' },
  { id: 'gift', label: 'ギフト', sel: '.mh-home-gift' },
  { id: 'changelog', label: '更新履歴', sel: '.mh-home-update' },
  { id: 'settings', label: '設定', sel: '.mh-home-settings' },
  { id: 'xmas', label: 'クリスマスのイベントページ', sel: '[data-home-xmas-entry]' },
  { id: 'battle', label: 'モンヒロバトル', sel: '[data-home-fac="battle"]' },
  { id: 'rhythm', label: 'モンヒロビート', sel: '[data-home-fac="rhythm"]' },
  { id: 'card', label: 'MFバトルカード', sel: '[data-home-fac="card"]' },
  { id: 'success', label: 'モンヒロサクセス', sel: '[data-home-monhero-success]' },
  { id: 'market', label: 'マーケット', sel: '[data-home-fac="market"]' },
  { id: 'life', label: '助手ライフ', sel: '[data-home-fac="life"]' },
  { id: 'management', label: 'M/B管理', sel: '[data-home-fac="management"]' },
  { id: 'temple', label: '神殿', sel: '[data-home-fac="temple"]' },
];
// コンテンツの語(押す所の名前・説明に入っていれば、そのコンテンツへの入口とみなす)
const CONTENT = [
  ['イベント(クリスマス)', /クリスマス|聖夜|名探偵|サンタ|レイド|事件簿/],
  ['イベント(ほか)', /ハナウタ|イベント|公式杯|大会/],
  ['モンヒロビート', /ビート|曲|音ゲー|演奏/],
  ['モンヒロバトル', /モンヒロバトル|バトル(?!カード)|挑戦|クイック|チャレンジ/],
  ['MFバトルカード', /バトルカード|カード対戦|デッキ/],
  ['モンヒロサクセス', /サクセス|育成/],
  ['マーケット', /マーケット|ショップ|ダイヤショップ|買う|購入/],
  ['助手ライフ', /助手ライフ|がいます|ライフ/],
  ['ミッション', /ミッション/],
  ['ギフト', /ギフト|受け取/],
  ['更新履歴・お知らせ', /更新履歴|お知らせ|告知/],
  ['設定', /^設定|設定$/],
];
(async () => {
  const { chromium } = (() => { try { return require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (e) { return require('playwright'); } })();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const out = [];
  const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
  for (const sc of SCREENS.filter((x) => !ONLY.length || ONLY.includes(x.id))) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(shiftClock(AT));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true);
    });
    await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
    let note = '';
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
      await page.waitForTimeout(1200);
      if (sc.pre) { await page.locator(sc.pre).first().dispatchEvent('click').catch(() => {}); await page.waitForTimeout(800); }
      if (sc.sel) {
        const n = await page.locator(sc.sel).count();
        if (!n) note = `押す所(${sc.sel})が無い`;
        else { await page.evaluate((s) => document.querySelector(s).click(), sc.sel); await page.waitForTimeout(2500); }
        // 開いたあとに出る一度きりの案内は閉じる
        for (let i = 0; i < 4; i++) {
          const btn = page.getByRole('button', { name: /^(閉じる|OK|はじめる|始める|あとで)$/ }).first();
          if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
          if (sc.stay) break;
          await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(400);
        }
      }
      await page.screenshot({ path: path.join(SHOT_DIR, `${sc.id}.jpg`), type: 'jpeg', quality: 78 });
      const items = await page.evaluate(() => {
        const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; const st = getComputedStyle(el); return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0.05; };
        return [...document.querySelectorAll('button, a[href], [role="button"], [role="tab"]')].filter(vis).map((el) => {
          const t = (el.getAttribute('aria-label') || el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
          return t;
        }).filter(Boolean);
      });
      if (process.env.DUMP) console.log(await page.evaluate(new Function(`return (${process.env.DUMP})`)()).catch((e) => String(e)));
      const hits = [];
      for (const t of [...new Set(items)]) for (const [c, re] of CONTENT) if (re.test(t)) { hits.push({ content: c, label: t }); break; }
      out.push({ screen: sc.id, label: sc.label, note, count: items.length, hits });
      console.log('見た', sc.label, `押す所 ${items.length}・入口 ${hits.length}`, note);
    } catch (e) { out.push({ screen: sc.id, label: sc.label, note: `開けなかった: ${String(e).slice(0, 120)}`, hits: [] }); console.log('開けなかった', sc.label); }
    await ctx.close();
  }
  fs.writeFileSync(path.join(SHOT_DIR, 'inventory.json'), JSON.stringify(out, null, 1));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
