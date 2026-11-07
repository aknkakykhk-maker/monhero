#!/usr/bin/env node
// モンヒロビートのオプションの選択肢(data-rhythm-option-choice)の字が、縦の iPhone の幅で切れていないかを見る(2026-11-07)。
//
//   python3 tools/serve.py を起動した状態で  node tools/mode/rhythm-option-choice-fit-check.js
//
// 【なぜ要るか】
// 社長が本番の iPhone で「ノーツの色」の4つ並びが「標準|パステ|ネオン|見分け」と切れているのを見つけた。
// 4つ並びで長い名前は 2×2 に並べる決まり(29-rhythm-screens.jsx の segments)にしたので、
// オプションの全部のタブ・全部の組を開いて、字が箱からはみ出している選択肢が1つも無いことを確かめる。
const { chromium } = require('playwright');
const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
  });
  const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((e) => rx.test((e.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), undefined, { timeout: 40000 });
    for (let i = 0; i < 8; i++) { if (!(await clickText('受け取る|閉じる|OK|スキップ'))) break; await page.waitForTimeout(300); }
    await clickText('モンヒロビート');
    for (let k = 0; k < 2; k++) { await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]', { timeout: 30000 }).catch(() => {}); await page.evaluate(() => document.querySelector('[data-rhythm-mode-solo]')?.click()); }
    await page.waitForSelector('[data-rhythm-song-row]', { timeout: 30000 });
    for (let i = 0; i < 12; i++) { await page.mouse.click(195, 300); await page.waitForTimeout(200); if (!(await clickText('^スキップ$|閉じる|OK|^確認$'))) break; await page.waitForTimeout(400); }
    await clickText('設定'); await page.waitForTimeout(1200);
    const tabs = ['演奏', '表示', '音', '軽さ'];
    const cut = []; let seen = 0; let twoByTwo = 0; let preview = 0;
    for (const tab of tabs) {
      await clickText(`^${tab}`); await page.waitForTimeout(700);
      // 組(背景・道・ノーツ…)は1度に1つしか開かないので、1つずつ開いて数える(組の無いタブは1回だけ数える)
      const heads = await page.evaluate(() => document.querySelectorAll('[data-rhythm-fx-group-head]').length);
      const found = [];
      for (let i = 0; i < Math.max(1, heads); i++) {
        if (heads) {
          await page.evaluate((k) => { const b = document.querySelectorAll('[data-rhythm-fx-group-head]')[k]; if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, i);
          await page.waitForTimeout(400);
        }
        const part = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-option-choice]')].filter((b) => b.offsetParent)
          .map((b) => ({ id: b.getAttribute('data-rhythm-option-choice'), text: (b.innerText || '').trim(), cut: b.scrollWidth > b.clientWidth + 1 })));
        part.forEach((f) => { if (!found.some((g) => g.id === f.id)) found.push(f); });
        if (heads) {
          const note = await page.evaluate((k) => document.querySelectorAll('[data-rhythm-fx-group-head]')[k]?.getAttribute('data-rhythm-fx-group-head'), i);
          if (note === 'note') {
            twoByTwo = await page.evaluate(() => { const b = document.querySelector('[data-rhythm-option-choice="notePalette:CLEAR"]'); return b ? getComputedStyle(b.parentElement).gridTemplateColumns.split(' ').length : 0; });
            preview = await page.evaluate(() => document.querySelectorAll('[data-rhythm-note-look-preview] [data-rhythm-note-swatch]').length);
          }
        }
      }
      seen += found.length;
      found.filter((f) => f.cut).forEach((f) => cut.push(`${tab}:${f.id}(${f.text})`));
    }
    ok('オプションの選択肢を見つけられた(全部のタブ)', seen >= 20, `${seen}個`);
    ok('縦の iPhone の幅(390px)で、字が切れている選択肢が無い', cut.length === 0, cut.slice(0, 6).join(' / '));
    ok('ノーツの色の4つは 2×2 に並ぶ', twoByTwo === 2, `${twoByTwo}列`);
    ok('ノーツの色の欄に、各ノーツの見本が並ぶ', preview >= 4, `${preview}枚`);
  } catch (e) {
    ok('オプション画面を開けた', false, String(e.message || e).split('\n')[0]);
  }
  await browser.close();
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
