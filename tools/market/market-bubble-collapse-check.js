// マーケットの助手の吹き出しを「小さくたためる」ことを、実際の画面で確かめる(2026-10-26 開発部 k02)。
//   ① はじめはひらいている(たたむ印があり、たたんだ記録は無い)
//   ② 「たたむ」を押すと小さな札だけになり、新しいキー mh_bubble_collapsed_v1 に売り場の印(market:event)だけが入る
//   ③ 画面を読み込み直しても、その売り場はたたんだまま。ほかの売り場(マーケットの入口)はひらいたまま
//   ④ 「ひらく」を押すと元に戻り、記録から消える
//   ⑤ 壊れた値(文字列・配列・true 以外)が入っていても落ちず、ひらいたまま
//   ⑥ 保存キーを足すだけ: たたむ前後で、ほかの mh_* のキーの中身は変わらない
//
// 実行: node tools/market/market-bubble-collapse-check.js(配信は tools/serve.py を :8899 で)
const path = require('path');
const { chromium } = require('playwright');
const { createFakeSupabase } = require(path.join(__dirname, '..', 'playbot', 'lib', 'fake-supabase.js'));

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const KEY = 'mh_bubble_collapsed_v1';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, hasTouch: true });
  const sb = createFakeSupabase();
  await ctx.route('**/*', (route) => { const u = route.request().url(); if (/supabase\.co/.test(u)) return sb.handle(route); return route.continue(); });
  await ctx.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await ctx.addInitScript(seed);
  const page = await ctx.newPage();
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  const click = (re) => page.evaluate((src) => {
    const r = new RegExp(src);
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent !== null && r.test((x.getAttribute('aria-label') || x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true; }
    return false;
  }, re.source);
  const boot = async () => {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('TAP TO START')); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); b?.click(); });
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    for (let i = 0; i < 12; i++) { if (!(await click(/^(確認|受け取る|閉じる|OK|スキップ|あとで)$/))) break; await page.waitForTimeout(500); }
  };
  const goMarket = async () => { await click(/マーケット/); await page.waitForTimeout(1500); for (let i = 0; i < 6; i++) { if (!(await click(/^(確認|閉じる|OK)$/))) break; await page.waitForTimeout(400); } };
  const goBeat = async () => { await click(/ビートP交換所/); await page.waitForTimeout(1200); };
  const stateOf = () => page.evaluate(() => ({
    collapsed: !!document.querySelector('[data-bubble-collapsed]'),
    hasFold: !!document.querySelector('[data-bubble-collapse]'),
    hasText: !!document.querySelector('[data-bubble-text]'),
  }));
  const raw = () => page.evaluate((k) => localStorage.getItem(k), KEY);
  const otherKeys = () => page.evaluate((k) => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const n = localStorage.key(i); if (n && n !== k && n.startsWith('mh_')) o[n] = localStorage.getItem(n); } return o; }, KEY);

  await boot();
  await goMarket();
  const top = await stateOf();
  check('マーケットの入口の吹き出しは、はじめからひらいていて、たためる', !top.collapsed && top.hasFold && top.hasText);
  await goBeat();
  const first = await stateOf();
  check('① ビートP交換所の吹き出しは、はじめはひらいている(記録なし)', !first.collapsed && first.hasFold && first.hasText && (await raw()) === null, JSON.stringify(first));

  const keysBefore = await otherKeys();
  check('「たたむ」を押せる', await click(/ひとことをたたむ/));
  await page.waitForTimeout(600);
  const after = await stateOf();
  check('② たたむと小さな札だけになる', after.collapsed && !after.hasText, JSON.stringify(after));
  check('② 新しいキーに売り場の印だけが入る', (await raw()) === '{"market:event":true}', String(await raw()));
  const keysAfter = await otherKeys();
  const changed = Object.keys(keysAfter).filter((n) => keysBefore[n] !== keysAfter[n]);
  check('⑥ ほかの mh_* のキーの中身は変わらない(新しいキーを足すだけ)', changed.length === 0, changed.join(','));

  await boot();
  await goMarket();
  const top2 = await stateOf();
  check('③ 読み込み直しても、入口の吹き出しはひらいたまま(売り場ごとに覚える)', !top2.collapsed && top2.hasText);
  await goBeat();
  const again = await stateOf();
  check('③ 読み込み直しても、ビートP交換所はたたんだまま', again.collapsed && !again.hasText, JSON.stringify(again));

  check('「ひらく」を押せる', await click(/ひとことをひらく/));
  await page.waitForTimeout(600);
  const reopened = await stateOf();
  check('④ ひらくと元に戻り、記録から消える', !reopened.collapsed && reopened.hasText && (await raw()) === '{}', String(await raw()));

  for (const bad of ['"こわれた"', '[1,2,3]', '{"market:event":"yes"}', '123']) {
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, bad]);
    await boot();
    await goMarket();
    await goBeat();
    const s = await stateOf();
    check(`⑤ 壊れた値 ${bad} でも落ちず、ひらいたまま`, !s.collapsed && s.hasText && s.hasFold);
  }
  check('画面でエラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));

  await browser.close();
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `\n${bad}件のNGがあります` : '\nすべてOK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
