// ティア表のページ(docs/playbot/dashboard/tier.html)で、短い札・名前が言葉の途中で折れていないかを見る(2026-10-22 窓口「モンスタ/ー」「組み合わ/せ」)。
//
//   node tools/playbot/tier-page-wrap-check.js            幅320と390で見る
//   SHOT_DIR=<フォルダ> を付けると、上のタブ・総合・向き・詳しい欄の写真を残す
//
//   ① 上のタブ・モンスターの名前・アシカの名前・段の札・表の見出しなど、12字までの短い字が2行に分かれていない
//   ② それらの字が枠からはみ出していない(切れて見えない)
//   ③ ページが横にはみ出さない
//   詳しい欄(<details>)は全部開いてから見る。長い文(理由・根拠)は日本語ではどこで折れても読めるので数えない
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'docs', 'playbot', 'dashboard', 'tier.html');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  if (!fs.existsSync(PAGE)) { check('ページがある(node tools/playbot/tier-page.js で作る)', false); process.exit(1); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const W of [320, 390]) {
      const page = await browser.newPage({ viewport: { width: W, height: 844 } });
      await page.goto('file://' + PAGE);
      await page.waitForTimeout(400);
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `tier-top-${W}.png`) }); }
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const range = document.createRange();
        const bad = [];
        const clipped = [];
        // 短い字だけを持つ要素(子に要素を持たないか、字だけ)。長い文は数えない
        const els = [...document.querySelectorAll('body *')].filter((el) => {
          if (['SCRIPT', 'STYLE'].includes(el.tagName)) return false;
          const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
          return own && [...own].length <= 12 && /[\u3040-\u30ff\u4e00-\u9fff]/.test(own) && el.getBoundingClientRect().width > 0;
        });
        for (const el of els) {
          const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
          const tops = new Set();
          for (const n of texts) for (let i = 0; i < n.textContent.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); const rs = range.getClientRects(); if (rs.length) tops.add(Math.round(rs[0].top / 3)); }
          const label = texts.map((n) => n.textContent.trim()).join('');
          if (tops.size > 1) bad.push(label);
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') clipped.push(label);
        }
        return { bad: [...new Set(bad)], clipped: [...new Set(clipped)], wide: document.documentElement.scrollWidth > innerWidth + 1, n: els.length };
      });
      check(`① 幅${W}: 短い札・名前が2行に分かれていない(${r.n}か所)`, r.bad.length === 0, r.bad.slice(0, 8).join(' / '));
      check(`② 幅${W}: 短い札・名前が枠からはみ出して切れていない`, r.clipped.length === 0, r.clipped.slice(0, 8).join(' / '));
      check(`③ 幅${W}: ページが横にはみ出さない`, !r.wide);
      if (SHOT_DIR) {
        for (const [id, name] of [['monsters', 'monsters'], ['monsters-role', 'role'], ['party', 'party']]) {
          const loc = page.locator(`#${id}`);
          if (await loc.count()) await loc.screenshot({ path: path.join(SHOT_DIR, `tier-${name}-${W}.png`) });
        }
      }
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
