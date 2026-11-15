#!/usr/bin/env node
// モンサクの「横に流れる札・タブの列」が縦にも動いてしまわないかを見る(2026-11-15 社長 r1115-094「上のタブが上下にも動く」)。
//   node tools/success/msx-hscroll-check.js            文字で見る + 本物のブラウザ(縦390・320)で見る
//   node tools/success/msx-hscroll-check.js --static   文字で見るだけ
//   SHOT=<フォルダ> …                                  縦に動かしたあとの止め絵を置く
// ① 文字: モンサクの見た目(parts の *_CSS)で overflow-x が auto/scroll の決まりは、overflow-y:hidden と touch-action:pan-x も持つこと。
//          className に overflow-x-auto を持つ列は overflow-y-hidden と touch-pan-x も持つこと
// ② ブラウザ: 本物の見た目(MSX_CSS・MSX_R3_CSS)で、アシスト効果を選ぶ画面の上のタブの列(.r3-bar.sc・場面の名前は表の SCENES)を作り、
//          縦に動かしても(scrollTop・ホイール・指の縦なぞり)列の位置が変わらない・中に縦のはみ出しが無い・札が上下に切れていないこと
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const STATIC_ONLY = process.argv.includes('--static');
const files = fs.readdirSync(PARTS).filter(f => /^56-(monhero-success|monsuc)-.*\.jsx$/.test(f));
const ng = [];
const cssOf = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(PARTS, f), 'utf8');
  const re = /const ([A-Z0-9_]*CSS[A-Z0-9_]*) = `([\s\S]*?)`;/g; let m;
  while ((m = re.exec(src))) {
    cssOf[m[1]] = m[2];
    const rules = m[2].replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
    rules.forEach((r) => { if (/overflow-x\s*:\s*(auto|scroll)/.test(r) && !(/overflow-y\s*:\s*hidden/.test(r) && /touch-action\s*:\s*pan-x/.test(r))) ng.push(`${f} ${m[1]}: ${r.trim().slice(0, 90)} … overflow-y:hidden と touch-action:pan-x が無い`); });
  }
  (src.match(/className=(?:"[^"]*"|\{`[^`]*`\})/g) || []).forEach((c) => { if (/\boverflow-x-(auto|scroll)\b/.test(c) && !(/\boverflow-y-hidden\b/.test(c) && /\btouch-pan-x\b/.test(c))) ng.push(`${f}: ${c.slice(0, 90)} … overflow-y-hidden と touch-pan-x が無い`); });
}
if (ng.length) { ng.forEach(x => console.log(`NG: ${x}`)); console.log(`NG ${ng.length}件(文字)`); process.exit(1); }
console.log(`OK: 文字 — モンサクの ${files.length} ファイル・横に流れる列は縦に動かない作り`);
if (STATIC_ONLY) process.exit(0);

let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); }
const AT = require(path.join(ROOT, 'monster-hero', 'data', 'monhero-success-assist.js'));
const SHOT = process.env.SHOT || '';
(async () => {
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const bad = [];
  for (const [w, h] of [[390, 844], [320, 568]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const chips = AT.SCENES.map((sc, i) => `<button type="button" class="r3-chip${i === 2 ? ' on' : ''}">${sc.name}</button>`).join('');
    await page.setContent(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#0f0b1f}${cssOf.MSX_CSS || ''}${cssOf.MSX_R3_CSS || ''}</style>
      <div class="msx${w <= 340 ? ' s320' : ''}" style="height:100vh"><div class="r3" style="padding:8px"><div class="r3-bar sc" id="bar">${chips}</div><div style="height:1200px"></div></div></div>`);
    const r = await page.evaluate(async () => {
      const el = document.getElementById('bar'); const cs = getComputedStyle(el); const top0 = el.getBoundingClientRect().top;
      el.scrollTop = 40; const st1 = el.scrollTop;
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })); await new Promise(r => setTimeout(r, 50));
      const b = el.getBoundingClientRect(); const cut = [...el.children].filter(c => { const q = c.getBoundingClientRect(); return q.top < b.top - 0.5 || q.bottom > b.bottom + 0.5; }).map(c => c.textContent);
      return { oy: cs.overflowY, ta: cs.touchAction, st1, st2: el.scrollTop, over: el.scrollHeight - el.clientHeight, cut, wide: el.scrollWidth > el.clientWidth, top0, top1: el.getBoundingClientRect().top };
    });
    // 指で縦になぞる(列の上から下へ)
    const box = await page.locator('#bar').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    const st3 = await page.evaluate(() => document.getElementById('bar').scrollTop);
    const tag = `縦${w}`;
    if (r.oy !== 'hidden') bad.push(`${tag}: overflow-y が ${r.oy}`);
    if (r.ta !== 'pan-x') bad.push(`${tag}: touch-action が ${r.ta}`);
    if (r.st1 !== 0 || r.st2 !== 0 || st3 !== 0) bad.push(`${tag}: 縦に動いた(scrollTop ${r.st1}/${r.st2}/${st3})`);
    if (r.over > 0) bad.push(`${tag}: 列の中に縦のはみ出し ${r.over}px`);
    if (r.cut.length) bad.push(`${tag}: 上下に切れた札 ${r.cut.join('・')}`);
    console.log(`${tag}: overflow-y ${r.oy}・touch-action ${r.ta}・縦の動き ${r.st1}/${r.st2}/${st3}・はみ出し ${Math.max(0, r.over)}px・横に流れる ${r.wide ? 'はい' : 'いいえ'}`);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `assist-tabs-${w}.png`), clip: { x: 0, y: 0, width: w, height: 120 } }); }
    await page.close();
  }
  await browser.close();
  if (bad.length) { bad.forEach(x => console.log(`NG: ${x}`)); console.log(`NG ${bad.length}件(ブラウザ)`); process.exit(1); }
  console.log('OK: ブラウザ — アシスト効果を選ぶ画面の上のタブの列は、縦390・320で縦に動かない・切れない');
})().catch((e) => { console.error(e); process.exit(1); });
