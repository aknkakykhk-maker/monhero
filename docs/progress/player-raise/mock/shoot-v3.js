// 第3版の止め絵を PNG に撮る。使い方: node shoot-v3.js [日本語フォントの woff2 があるフォルダ] [--quick]
// 出す物: png/v3-compare.png(前の見本との比べ)・png/v3-sheet.png(一覧)・png/v3-<組>.png(組ごと+説明)・png/v3-phone-<コマ>.png
// 撮る前に見張る: 絵が読めない/画面の中身が枠からはみ出す/字が切れている(… になっている・横にあふれている)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const dir = __dirname; const out = path.join(dir, 'png'); fs.mkdirSync(out, { recursive: true });
  const fontDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';
  const quick = process.argv.includes('--quick');
  const css = fontDir ? [500, 700, 900].map((w) => `@font-face{font-family:'MockJP';font-weight:${w === 700 ? '600 800' : w};src:url('file://${path.join(fontDir, `noto-sans-jp-japanese-${w}-normal.woff2`)}')}`).join('') : '';
  const b = await chromium.launch();
  let bad = 0;
  const open = async (q, vw, dsf) => {
    const p = await b.newPage({ viewport: { width: vw, height: 1000 }, deviceScaleFactor: dsf });
    await p.goto('file://' + path.join(dir, 'v3.html') + q);
    if (css) await p.addStyleTag({ content: css });
    await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
    const res = await p.evaluate(() => {
      const outp = [];
      const noimg = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
      if (noimg.length) outp.push('読めない絵: ' + [...new Set(noimg)].join(' '));
      for (const ph of document.querySelectorAll('.phone.v3')) {
        if (ph.closest('.sheet3')) continue; // 一覧は縮めて並べただけ(同じ画面を全画面のほうで見張っている)
        const R = ph.getBoundingClientRect(); const sc = R.width / ph.offsetWidth;
        const body = ph.querySelector('.v-body');
        if (body && body.scrollHeight > body.clientHeight + 1) outp.push(ph.id + ': 中身が縦に ' + (body.scrollHeight - body.clientHeight) + 'px あふれている');
        const scn = ph.querySelector('.v-scene'); if (scn && scn.offsetHeight < 150) outp.push(ph.id + ': 住む場所が低すぎる(' + scn.offsetHeight + 'px)');
        for (const e of ph.querySelectorAll('.v-body *,.v-hd *,.v-ft *')) {
          if (e.closest('.v-issa,.pic,.v-res3 .mon')) continue;
          const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
          if (!r.width || cs.position === 'absolute' && e.tagName === 'IMG') continue;
          const txt = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          if (txt && e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') outp.push(ph.id + ': 字が切れている「' + e.textContent.trim().slice(0, 16) + '」');
          if (txt && (r.right > R.right + 1 || r.left < R.left - 1)) outp.push(ph.id + ': 字が画面の外「' + e.textContent.trim().slice(0, 16) + '」');
          // 字のある箱が、親の箱(スクロールしない箱)から横にはみ出していないか
          const par = e.parentElement; if (txt && par && cs.position !== 'absolute') { const pr = par.getBoundingClientRect(); if (r.width > pr.width + 2 && getComputedStyle(par).display !== 'contents') outp.push(ph.id + ': 箱からあふれている「' + e.textContent.trim().slice(0, 16) + '」(' + Math.round((r.width - pr.width) / sc) + 'px)'); }
        }
      }
      return [...new Set(outp)];
    });
    console.log((q || '全画面') + ': ' + (res.length ? '\n  ' + res.join('\n  ') : '問題なし')); bad += res.length;
    return p;
  };
  let p = await open('', 2600, 1);
  const phones = await p.evaluate(() => [...document.querySelectorAll('.phone')].map((e) => e.id));
  if (!quick) for (const id of phones) await (await p.$('[id="' + id + '"]')).screenshot({ path: path.join(out, 'v3-phone-' + id.slice(1) + '.png'), omitBackground: true });
  await p.close();
  p = await open('', 2600, quick ? 1 : 1.5);
  for (const g of await p.evaluate(() => GROUPS.map((x) => x.id))) await (await p.$('#g' + g)).screenshot({ path: path.join(out, 'v3-' + g + '.png') });
  await p.close();
  p = await open('?cmp=1', 1900, quick ? 1 : 1.5); await (await p.$('#root')).screenshot({ path: path.join(out, 'v3-compare.png') }); await p.close();
  p = await open('?sheet=1', 2000, 1); await (await p.$('#root')).screenshot({ path: path.join(out, 'v3-sheet.png') });
  await b.close(); console.log('撮った:', phones.length, 'コマ / 見張りの指摘', bad, '件');
})();
