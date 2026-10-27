// 公開の印(RELEASE_FLAGS)が立つ前の助手の名前・絵が、ふつうの画面に出ていないかを見張る(2026-10-27)。
// 社長「まだ実装されてないソラシドが衣装のとこの名前にあった。ネタバレになるから今後気をつけて」
//   → プロフィールの「助手の着替え」の窓で、助手のタブに「ソラシド 0」が出ていた(ASSISTANT_LIST をそのまま並べていた)。
//
// 見るもの
//   ① 一覧の作り方: 画面に並べる所で ASSISTANT_LIST / ASSISTANTS をそのまま回していない(assistantReleased・assistantUnlockedBy を通す)
//   ② 実ブラウザ: HOME・プロフィール(着替えの窓は助手のタブを全部押す)・マーケットの売り場(タブを全部押す)を開き、
//      公開前の助手の名前と絵(画像のファイル名)が、文字・名札(aria-label)・代わりの文字(alt)・画像のどこにも出ない
//   公開前の助手は、そのときの RELEASE_FLAGS から数える(全員公開済みなら②は「該当なし」で通る)。デバッグの画面は見ない
//
//   node tools/assistant/unreleased-assistant-hidden-check.js(配信は tools/serve.py を :8899 で)
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ① 一覧の作り方
{
  const partsDir = path.join(ROOT, 'monster-hero/src/parts');
  // 画面に出さない所(読み込み・保存・話し手の引き当て)は、全員を回してよい
  const allowed = [
    /const ASSISTANT_LIST = /, /const assistantById = /, /ASSISTANT_LIST\.find\(/, /ASSISTANT_LIST\[0\]/, /const storyCastOf = /,
    /for \(const who of ASSISTANT_LIST\)/,                       // 起動時に助手ごとの保存を読む
    /Object\.fromEntries\(ASSISTANT_LIST\.map\(who =>/,          // 仲良し度のごほうびの計算(解放前は Lv0 とみなす)
    /const cast=ASSISTANT_LIST\.filter\(who=>script\.some/,      // お話の話し手(お話そのものが公開の印で出し入れされる)
  ];
  const bad = [];
  for (const f of fs.readdirSync(partsDir).filter(n => n.endsWith('.jsx'))) {
    const lines = read(`monster-hero/src/parts/${f}`).split('\n');
    lines.forEach((line, i) => {
      if (!/\bASSISTANT_LIST\b|\bASSISTANTS\.(map|filter|forEach)\(/.test(line)) return;
      // 次の行で絞っている書き方(… ASSISTANT_LIST) || [])\n .filter(… assistantReleased …))も通す
      if (/assistantReleased|assistantUnlockedBy|unlockedAssistants/.test(line + (lines[i + 1] || ''))) return;
      if (allowed.some(re => re.test(line))) return;
      if (/^\s*\/\//.test(line)) return;
      bad.push(`${f}:${i + 1}`);
    });
  }
  check('画面に並べる所で、助手の一覧をそのまま回していない(公開の印を通す)', bad.length === 0, bad.join(' / '));
}

// ② 実ブラウザ
(async () => {
  const { eventStorySeed } = require(path.join(__dirname, '..', 'boot', 'quiet-boot-seed'));
  const { chromium } = require('playwright');
  const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => fatal.push(e.message));
    await page.addInitScript(() => {
      const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
      put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
      put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      put('mh_breeder_points', 5); put('mh_rhythm_event_points_v1', 2500); put('mh_gold', 300000);
    });
    await page.addInitScript(eventStorySeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('TAP TO START')); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(3000);
    let quiet = 0;
    for (let i = 0; i < 40 && quiet < 2; i++) {
      const closed = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) { const inner = [...dialog.querySelectorAll('button')]; if (inner.length) { inner[inner.length - 1].click(); return true; } }
        const b = [...document.querySelectorAll('button')].find(x => /^(受け取る|閉じる|あとで|スキップ|次へ|確認|OK|今は見ない)$/.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(closed ? 500 : 900);
      quiet = closed ? 0 : quiet + 1;
    }
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="マーケット"]'), { timeout: 30000 });

    // 公開前の助手(名前と、絵のファイル名に入る id)
    const hidden = await page.evaluate(() => (typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : [])
      .filter(a => typeof assistantReleased === 'function' && !assistantReleased(a.id))
      .map(a => ({ id: a.id, name: a.name, prefix: a.imagePrefix || a.id })));
    if (!hidden.length) { check('公開前の助手はいない(見るものなし)', true); return; }
    console.log(`  公開前の助手: ${hidden.map(h => h.name).join('・')}`);
    const leaks = async (where) => page.evaluate(({ hidden, where }) => {
      const texts = [document.body.innerText || ''];
      document.querySelectorAll('[aria-label],[alt],[title]').forEach(el => ['aria-label', 'alt', 'title'].forEach(a => { const v = el.getAttribute(a); if (v) texts.push(v); }));
      const srcs = [...document.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
      const all = texts.join('\n');
      const out = [];
      hidden.forEach(h => {
        if (all.includes(h.name)) out.push(`${where}: 「${h.name}」`);
        const img = srcs.find(s => s.toLowerCase().includes(`/${h.prefix.toLowerCase()}`) || s.toLowerCase().includes(`${h.prefix.toLowerCase()}_`));
        if (img) out.push(`${where}: 絵 ${img}`);
      });
      return out;
    }, { hidden, where });
    const clickAria = (label) => page.evaluate((l) => { const b = document.querySelector(`button[aria-label="${l}"]`); if (b) b.click(); return !!b; }, label);
    const back = async () => { await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); }); await page.waitForTimeout(800); };
    const found = [];

    found.push(...await leaks('HOME'));

    // プロフィール
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /プロフィール/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); });
    await page.waitForTimeout(1500);
    found.push(...await leaks('プロフィール'));
    // 着替えの窓(助手のタブを全部押す)
    const costumeOpened = await page.evaluate(() => { const b = document.querySelector('[data-profile-tile="costume"]'); if (b) b.click(); return !!b; });
    await page.waitForTimeout(1000);
    if (costumeOpened) {
      found.push(...await leaks('着替えの窓'));
      const chips = await page.evaluate(() => [...document.querySelectorAll('[data-picker-sheet="assistant-costume"] [data-picker-chip]')].length);
      for (let i = 0; i < chips; i++) {
        await page.evaluate((i) => { const list = [...document.querySelectorAll('[data-picker-sheet="assistant-costume"] [data-picker-chip]')]; list[i]?.click(); }, i);
        await page.waitForTimeout(300);
        found.push(...await leaks(`着替えの窓(タブ${i + 1})`));
      }
      await page.keyboard.press('Escape');
      await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find(x => /閉じる/.test(x.getAttribute('aria-label') || x.innerText || '')); if (b) b.click(); });
      await page.waitForTimeout(600);
    }
    check('プロフィールに「着替え」のタイルがある(着替えの窓を開けた)', costumeOpened);
    await clickAria('ホームへ戻る'); await page.waitForTimeout(1200);

    // マーケットの売り場(タブを全部押す)
    for (const shop of ['ダイヤショップ', 'ブリーダーP交換所', 'ビートP交換所']) {
      await clickAria('マーケット'); await page.waitForTimeout(1200);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="戻る"]')].find(x => x.closest('.mh-screen-head')); if (b && !document.querySelector('button[aria-label="ダイヤショップ"]')) b.click(); });
      await page.waitForTimeout(600);
      const entered = await clickAria(shop);
      await page.waitForTimeout(1000);
      if (!entered) { check(`${shop}に入れる`, false, (await page.evaluate(() => [...document.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label')).slice(0, 12).join(',')))); continue; }
      found.push(...await leaks(shop));
      const tabCount = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].length);
      for (let i = 0; i < tabCount; i++) {
        const name = await page.evaluate((i) => { const t = [...document.querySelectorAll('[role="tab"]')][i]; if (t) t.click(); return t ? (t.innerText || '').trim() : ''; }, i);
        await page.waitForTimeout(400);
        found.push(...await leaks(`${shop}「${name}」`));
      }
      await back();
    }

    check('公開前の助手の名前・絵が、ふつうの画面に出ていない', found.length === 0, [...new Set(found)].slice(0, 8).join(' / '));
    check('画面を回すあいだに致命的なエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
    console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
    process.exit(failed ? 1 : 0);
  }
})().catch((e) => { console.error(e); process.exit(1); });
