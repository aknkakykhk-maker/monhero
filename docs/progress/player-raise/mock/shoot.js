// 止め絵を PNG に撮る。使い方: node shoot.js [日本語フォントの woff2 があるフォルダ]
//   フォント: npm pack @fontsource/noto-sans-jp して files/ を渡す(無ければ端末のフォントで撮る)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const dir = __dirname; const out = path.join(dir, 'png'); fs.mkdirSync(out, { recursive: true });
  const fontDir = process.argv[2];
  const css = fontDir ? [500, 700, 900].map((w) => `@font-face{font-family:'MockJP';font-weight:${w === 700 ? '600 800' : w};src:url('file://${path.join(fontDir, `noto-sans-jp-japanese-${w}-normal.woff2`)}')}`).join('') : '';
  const b = await chromium.launch();
  const open = async (q, vw, dsf) => {
    const p = await b.newPage({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: dsf });
    await p.goto('file://' + path.join(dir, 'index.html') + q);
    if (css) await p.addStyleTag({ content: css });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
    if (bad.length) console.log('読めない絵:', [...new Set(bad)].join(' '));
    return p;
  };
  let p = await open('', 1800, 2);
  const ids = await p.evaluate(() => SCREENS.map((s) => ({ id: s.id, phones: s.phones.map((x) => x.id) })));
  for (const s of ids) {
    await (await p.$('#s' + s.id)).screenshot({ path: path.join(out, `screen-${s.id}.png`) });           // 画面+動きの説明
  }
  // はみ出しの見張り: スマホの中身が 844 を超えていないか
  const over = await p.evaluate(() => [...document.querySelectorAll('.phone')].map((e) => { const ft = e.querySelector('.ft'); const inn = e.querySelector('.in'); if (!inn) return null; const lim = ft ? ft.getBoundingClientRect().top : e.getBoundingClientRect().bottom; const d = Math.round(inn.getBoundingClientRect().bottom - lim); return d > 0 ? e.id + ' +' + d : null; }).filter(Boolean));
  console.log(over.length ? 'はみ出し: ' + over.join(' / ') : 'はみ出しなし');
  await p.close();
  p = await open('', 1800, 1); // スマホだけ 390×844 ちょうど
  for (const s of ids) for (const ph of s.phones) await (await p.$('[id="p' + ph + '"]')).screenshot({ path: path.join(out, `phone-${ph}.png`), omitBackground: true });
  await p.close();
  p = await open('?sheet=1', 1560, 2);
  await p.screenshot({ path: path.join(out, 'contact-sheet.png'), fullPage: true });
  await b.close(); console.log('撮った:', ids.reduce((n, s) => n + s.phones.length, 0), 'コマ /', ids.length, '画面');
})();
