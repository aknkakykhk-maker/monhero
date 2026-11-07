#!/usr/bin/env node
// モンヒロビートのオプションを横向き(端末ごと横・🔄 横画面ボタン)で開き、
// ①欄が中身より大きく引き伸ばされて「空の枠」になっていないか ②数字の小さなボタンの字が箱からはみ出していないか を見る(2026-11-07)。
//
//   python3 tools/serve.py を起動した状態で  node tools/mode/rhythm-option-wide-layout-check.js
//
// 【なぜ要るか】社長「モンビーの画面ひどくなってる」。横向きの「演奏」タブで「判定ラインの位置」の欄が縦に長く(700px ほど)、
// 同じ行の「ノーツの出る位置」「レーンカバー」が同じ高さまで引き伸ばされて、中身のない背の高い枠が並んでいた。
// 判定ラインの欄は横のとき行いっぱいに広げ、左に道の見本・右に数字の欄を並べる形に直した(29-rhythm-screens.jsx の wideFull)。
const { chromium } = require('playwright');
const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
// 欄の高さが、中身(見出し+中身+詳しく)の高さをこれ以上こえたら「引き伸ばされた空の枠」とみなす
const MAX_SLACK_PX = 40;

const openOptions = async (page, rotate) => {
  const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((e) => rx.test((e.innerText || '').replace(/\s+/g, ' ').trim()) && e.offsetParent); if (!x) return false; x.click(); return true; }, p);
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), undefined, { timeout: 40000 });
  for (let i = 0; i < 8; i++) { if (!(await clickText('受け取る|閉じる|OK|スキップ'))) break; await page.waitForTimeout(250); }
  await clickText('モンヒロビート');
  for (let k = 0; k < 2; k++) { await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]', { timeout: 30000 }).catch(() => {}); await page.evaluate(() => document.querySelector('[data-rhythm-mode-solo]')?.click()); }
  await page.waitForSelector('[data-rhythm-song-row]', { timeout: 30000 });
  const vp = page.viewportSize();
  for (let i = 0; i < 12; i++) { await page.mouse.click(Math.round(vp.width / 2), Math.round(vp.height * 0.33)); await page.waitForTimeout(200); if (!(await clickText('^スキップ$|閉じる|OK|^確認$'))) break; await page.waitForTimeout(400); }
  if (rotate) { await page.evaluate((a) => RHYTHM_VIEW_ROTATION.set(a), rotate); await page.waitForTimeout(800); }
  await clickText('設定'); await page.waitForTimeout(1200);
  return clickText;
};

// いま見えている欄と、数字のボタンを調べる(回しているときも、器の向きで測る)
const inspect = () => {
  const R = typeof RHYTHM_VIEW_ROTATION !== 'undefined' ? RHYTHM_VIEW_ROTATION : null;
  const rect = (el) => (R && R.active() ? R.rectOf(el) : el.getBoundingClientRect());
  const fields = [...document.querySelectorAll('[data-rhythm-option-field]')].filter((f) => f.offsetParent).map((f) => {
    const box = rect(f); let content = 0;
    const kids = [...f.children].filter((c) => c.offsetParent || c.tagName === 'DETAILS');
    if (kids.length) { const top = Math.min(...kids.map((c) => rect(c).top)), bottom = Math.max(...kids.map((c) => rect(c).bottom)); content = bottom - top; }
    const pad = parseFloat(getComputedStyle(f).paddingTop) + parseFloat(getComputedStyle(f).paddingBottom);
    return { title: (f.innerText || '').split('\n')[0].slice(0, 16), height: Math.round(box.height), content: Math.round(content + pad) };
  });
  const nudges = [...document.querySelectorAll('[data-rhythm-option-nudge]')].filter((b) => b.offsetParent)
    .map((b) => ({ id: b.getAttribute('data-rhythm-option-nudge'), cut: b.scrollWidth > b.clientWidth + 1 }));
  return { fields, nudges };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const modes = [['端末ごと横', { width: 844, height: 390 }, 0], ['🔄 横画面ボタン', { width: 390, height: 844 }, 90]];
  try {
    for (const [name, viewport, rotate] of modes) {
      const page = await browser.newPage({ viewport, hasTouch: true, isMobile: true });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
      });
      try {
        const clickText = await openOptions(page, rotate);
        const stretched = [], cut = []; let fieldCount = 0, lineField = null;
        for (const tab of ['演奏', '表示', '音', '軽さ']) {
          await clickText(`^${tab}`); await page.waitForTimeout(600);
          // 演出の組は1つずつ選んで見る(組の無いタブは1回だけ)
          const groups = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-fx-group-tab]')].filter((b) => b.offsetParent).map((b) => b.getAttribute('data-rhythm-fx-group-tab')));
          for (const g of groups.length ? groups : [null]) {
            if (g) { await page.evaluate((id) => document.querySelector(`[data-rhythm-fx-group-tab="${id}"]`)?.click(), g); await page.waitForTimeout(400); }
            const r = await page.evaluate(inspect);
            fieldCount += r.fields.length;
            r.fields.forEach((f) => { if (f.height - f.content > MAX_SLACK_PX) stretched.push(`${tab}:${f.title}(${f.height}px・中身${f.content}px)`); if (f.title.startsWith('判定ラインの位置')) lineField = f; });
            r.nudges.forEach((n) => { if (n.cut && !cut.includes(n.id)) cut.push(n.id); });
          }
        }
        ok(`${name}: オプションの欄を見つけられた`, fieldCount >= 20, `${fieldCount}個`);
        ok(`${name}: 中身より大きく引き伸ばされた欄(空の枠)が無い`, stretched.length === 0, stretched.slice(0, 4).join(' / '));
        ok(`${name}: 「判定ラインの位置」の欄が縦に長くなりすぎない(420px 以下)`, !!lineField && lineField.height <= 420, lineField ? `${lineField.height}px` : '見つからない');
        ok(`${name}: 数字の小さなボタンの字が箱からはみ出していない`, cut.length === 0, cut.slice(0, 6).join(' / '));
      } catch (e) {
        ok(`${name}: オプション画面を開けた`, false, String(e.message || e).split('\n')[0]);
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
