// 作り直しの止め絵を PNG に撮る。使い方: node shoot-redo.js [日本語フォントの woff2 があるフォルダ]
// 出す物: png/redo-compare.png(比べの1枚)・png/redo-main.png・redo-train.png・redo-start.png・png/phone-R*.png(390×844)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const dir = __dirname; const out = path.join(dir, 'png'); fs.mkdirSync(out, { recursive: true });
  const fontDir = process.argv[2];
  const css = fontDir ? [500, 700, 900].map((w) => `@font-face{font-family:'MockJP';font-weight:${w === 700 ? '600 800' : w};src:url('file://${path.join(fontDir, `noto-sans-jp-japanese-${w}-normal.woff2`)}')}`).join('') : '';
  const b = await chromium.launch();
  const open = async (q, vw, dsf) => {
    const p = await b.newPage({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: dsf });
    await p.goto('file://' + path.join(dir, 'redo.html') + q);
    if (css) await p.addStyleTag({ content: css });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
    const bad = await p.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
    if (bad.length) console.log('読めない絵:', [...new Set(bad)].join(' '));
    // はみ出しの見張り: スマホの中身が下の帯・ボタン・844 を超えていないか
    const over = await p.evaluate(() => [...document.querySelectorAll('.phone')].map((e) => { const ft = e.querySelector('.ft,.rd-ft'); const inn = e.querySelector('.in'); if (!inn) return null; const lim = ft ? ft.getBoundingClientRect().top : e.getBoundingClientRect().bottom; const d = Math.round(inn.getBoundingClientRect().bottom - lim); return d > 0 ? e.id + ' +' + d : null; }).filter(Boolean));
    console.log((q || '全画面') + ': ' + (over.length ? 'はみ出し ' + over.join(' / ') : 'はみ出しなし'));
    return p;
  };
  const NAME = { R4: 'redo-main', R5: 'redo-train', R1: 'redo-start' };
  let p = await open('', 1900, 2);
  for (const id of Object.keys(NAME)) await (await p.$('#s' + id)).screenshot({ path: path.join(out, NAME[id] + '.png') });
  await p.close();
  p = await open('', 1900, 1);
  const phones = await p.evaluate(() => [...document.querySelectorAll('.phone')].map((e) => e.id));
  for (const id of phones) await (await p.$('[id="' + id + '"]')).screenshot({ path: path.join(out, 'phone-' + id.slice(1) + '.png'), omitBackground: true });
  await p.close();
  p = await open('?cmp=1', 1900, 2);
  await (await p.$('#root')).screenshot({ path: path.join(out, 'redo-compare.png') });
  await b.close(); console.log('撮った:', phones.length, 'コマ');
})();
