// ヘルプ(攻略情報局)の上の助手の吹き出しを「たためる」ことを、実際の画面で確かめる(2026-10-26 開発部 e01・e02)。
//   ① はじめはひらいている ② 吹き出しの「▴」でたたむと何も出なくなり、mh_bubble_collapsed_v1 に 'help' が入る(上の助手の顔は薄くなる)
//   ③ 読み込み直しても、ヘルプはたたんだまま ④ 上の助手の顔を押すとひらき、記録から消える
//   ⑤ 横向き(844×390)でも同じ(ひらいた吹き出しが2行までに収まり、一覧が見える)
//
// 実行: node tools/help-bubble-fold-check.js(配信は tools/serve.py を :8899 で)
const path = require('path');
const { chromium } = require('playwright');
const { createFakeSupabase } = require(path.join(__dirname, 'playbot', 'lib', 'fake-supabase.js'));

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
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
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
  const openHelp = async () => { await click(/^設定$/); await page.waitForTimeout(1200); await click(/ヘルプ/); await page.waitForTimeout(1500); };
  // ヘルプの画面の中だけを見る(裏のホームにも助手の吹き出しがある)
  const inHelp = "const root = [...document.querySelectorAll('button')].find((x) => /わかった！冒険に戻る/.test(x.innerText || ''))?.closest('.fixed'); const t = root ? root.querySelector('[data-bubble-text]') : null;";
  const bubbleShown = () => page.evaluate(`(() => { ${inHelp} return !!t; })()`);
  const lines = () => page.evaluate(`(() => { ${inHelp} if (!t) return null; const r = t.getBoundingClientRect(); return Math.round(r.height / (parseFloat(getComputedStyle(t).lineHeight) || 16)); })()`);
  const raw = () => page.evaluate((k) => localStorage.getItem(k), KEY);

  await boot();
  await openHelp();
  check('① ヘルプの吹き出しは、はじめはひらいている', (await bubbleShown()) && (await raw()) === null);
  const n = await lines();
  check('⑤ 横向きでは吹き出しの本文が2行までに収まる', n !== null && n <= 2, `${n}行`);
  check('「▴」を押せる', await click(/ひとことをたたむ/));
  await page.waitForTimeout(600);
  check('② たたむと吹き出しが何も出なくなる', !(await bubbleShown()));
  check('② 記録に help が入る', (await raw()) === '{"help":true}', String(await raw()));
  await boot();
  await openHelp();
  check('③ 読み込み直しても、ヘルプはたたんだまま', !(await bubbleShown()));
  check('④ 上の助手の顔を押す', await click(/助手のひとことを開く/));
  await page.waitForTimeout(600);
  check('④ ひらくと吹き出しが戻り、記録から消える', (await bubbleShown()) && (await raw()) === '{}', String(await raw()));
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, '[1,2]']);
  await boot();
  await openHelp();
  check('壊れた値でも落ちず、ひらいたまま', await bubbleShown());
  check('画面でエラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));

  await browser.close();
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `\n${bad}件のNGがあります` : '\nすべてOK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
