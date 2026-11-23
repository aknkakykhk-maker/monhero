require('../shared-serve'); // :8899 が無ければ立てる(単独で回したとき)
// 💬▲▼ を全画面に(2026-11-23 台帳 r1119-135)を、実際の画面で確かめる。
//   ① HOME の吹き出しには 💬▲ が付かない(「隠す」r1119-081 のまま)
//   ② 設定の画面のひとことは、はじめは開いていて 💬▲ がある(記録なし)
//   ③ 💬▲ で畳むと 💬▼ だけになり、mh_bubble_collapsed_v1 に screen:settings だけが入る。ほかの mh_* は変わらない
//   ④ 読み込み直しても設定は畳んだまま・HOME の吹き出しはそのまま出る
//   ⑤ 💬▼ で開くと元に戻り、記録から消える
//   ⑥ 設定「助手のひとこと」が「出さない」なら、吹き出しも 💬▼ も出ない(3択が先に効く)
//   ⑦ 同じ画面で場面が変わるもの(ミッション・バトルのモード・結果)は1つの名前。HOME・一度きりの案内・ビートの曲えらびは畳まない
//   ⑧ 壊れた値が入っていても落ちず、開いたまま
// 実行: node tools/assistant/bubble-fold-all-check.js
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
  const goSettings = async () => { await click(/^設定$/); await page.waitForTimeout(1500); for (let i = 0; i < 4; i++) { if (!(await click(/^(確認|閉じる|OK)$/))) break; await page.waitForTimeout(400); } };
  const goHome = async () => { await click(/HOMEへ戻る/); await page.waitForTimeout(1200); };
  const stateOf = () => page.evaluate(() => ({
    collapsed: !!document.querySelector('[data-bubble-collapsed]'),
    hasFold: !!document.querySelector('[data-bubble-collapse]'),
    hasText: !!document.querySelector('[data-bubble-text]'),
  }));
  const raw = () => page.evaluate((k) => localStorage.getItem(k), KEY);
  const otherKeys = () => page.evaluate((k) => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const n = localStorage.key(i); if (n && n !== k && n.startsWith('mh_')) o[n] = localStorage.getItem(n); } return o; }, KEY);
  const homeState = () => page.evaluate(() => ({ bubble: !!document.querySelector('.mh-home-assistant [data-assistant-bubble]'), fold: !!document.querySelector('.mh-home-assistant [data-bubble-collapse]') }));

  await boot();
  const home = await homeState();
  check('① HOME の吹き出しはあり、💬▲ は付かない', home.bubble && !home.fold, JSON.stringify(home));
  await goSettings();
  const first = await stateOf();
  check('② 設定のひとことは、はじめは開いていて 💬▲ がある(記録なし)', !first.collapsed && first.hasFold && first.hasText && (await raw()) === null, JSON.stringify(first));
  const keysBefore = await otherKeys();
  check('💬▲(ひとことをたたむ)を押せる', await click(/ひとことをたたむ/));
  await page.waitForTimeout(600);
  const after = await stateOf();
  check('③ 畳むと 💬▼ だけになる', after.collapsed && !after.hasText && !after.hasFold, JSON.stringify(after));
  check('③ 記録は screen:settings だけ', (await raw()) === JSON.stringify({ 'screen:settings': true }), String(await raw()));
  check('③ ほかの mh_* のキーは変わらない', JSON.stringify(await otherKeys()) === JSON.stringify(keysBefore));

  await boot();
  const home2 = await homeState();
  check('④ 読み込み直しても HOME の吹き出しはそのまま出る', home2.bubble && !home2.fold, JSON.stringify(home2));
  await goSettings();
  const again = await stateOf();
  check('④ 読み込み直しても設定は畳んだまま', again.collapsed && !again.hasText, JSON.stringify(again));
  check('💬▼(ひとことを開く)を押せる', await click(/^ひとことを開く$/));
  await page.waitForTimeout(600);
  const reopened = await stateOf();
  check('⑤ 開くと元に戻り、記録から消える', !reopened.collapsed && reopened.hasText && (await raw()) === '{}', String(await raw()));

  await page.evaluate(() => localStorage.setItem('mh_assistant_bubble_mode_v1', JSON.stringify('OFF')));
  await boot(); await goSettings();
  const off = await stateOf();
  check('⑥ 「出さない」なら吹き出しも 💬▼ も出ない', !off.collapsed && !off.hasText && !off.hasFold, JSON.stringify(off));
  await page.evaluate(() => localStorage.removeItem('mh_assistant_bubble_mode_v1'));

  const keys = await page.evaluate(() => Object.fromEntries(['missionsClaimable', 'missionsNormal', 'battleQuick', 'battleChallenge', 'resultWin', 'resultLose', 'monsterDex', 'home', 'rhythmHome', 'raidJackIntro', 'quickRhythmBackground', 'rhythmWeeklyEvent'].map((x) => [x, assistantBubbleFoldKey(x)])));
  check('⑦ ミッションは1つの名前', keys.missionsClaimable === 'screen:missions' && keys.missionsNormal === 'screen:missions', JSON.stringify(keys));
  check('⑦ バトルのモード・結果も1つの名前', keys.battleQuick === keys.battleChallenge && keys.resultWin === keys.resultLose && keys.monsterDex === 'screen:monsterDex');
  check('⑦ HOME・一度きりの案内・ビートの曲えらびは畳まない', ['home', 'rhythmHome', 'raidJackIntro', 'quickRhythmBackground', 'rhythmWeeklyEvent'].every((x) => keys[x] === null));

  for (const bad of ['"x"', '[1,2]', '{"screen:settings":"yes"}', 'not-json']) {
    await page.evaluate((v) => localStorage.setItem('mh_bubble_collapsed_v1', v), bad);
    await boot(); await goSettings();
    const s = await stateOf();
    check(`⑧ 壊れた値 ${bad} でも落ちず、開いたまま`, !s.collapsed && s.hasText && s.hasFold);
  }
  check('画面でエラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));

  await browser.close();
  const bad = results.filter((x) => !x).length;
  console.log(bad ? `\n${bad}件のNGがあります` : '\nすべてOK');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
