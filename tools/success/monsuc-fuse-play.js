#!/usr/bin/env node
// モンサク点検(r1115-038): マスモンボックス → 合体 → メモモン → 編成 を、本物のブラウザで押して見る。見つけて記録するだけ。
//   OUT=<フォルダ> node tools/success/monsuc-fuse-play.js
'use strict';
const fs = require('fs'), path = require('path');
const P = require('./monsuc-play10.js');
const OUT = process.env.OUT || path.join(P.ROOT, 'docs', 'progress', 'monsuc-soak-1115');
(async () => {
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const server = await P.serve(); const port = server.address().port;
  const browser = await P.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const [w, h] = (process.env.VIEW || '390,844').split(',').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message || e).slice(0, 200)));
  const cfg = { ctl: 'auto', box: P.boxSeed('box-high') };
  await page.addInitScript(P.lapSeed, cfg); await page.addInitScript(P.quietBootSeed()); await page.addInitScript(P.updateNoticeSeed()); await page.addInitScript(P.eventStorySeed());
  await P.isolate(page); await P.toHome(page, port); await P.openEntry(page);
  const dump = async (tag) => { const i = await P.screenInfo(page); console.log(`## ${tag} view=${i.view}\n  ${i.text.slice(0, 700)}\n  ボタン: ${i.btns.slice(0, 24).join(' | ')}\n  はみ出し:${i.over.join('/')} 切れ:${i.clip.join('/')} 画像:${i.imgs.join('/')} 伸び:${i.stretch.join('/')}`); await page.screenshot({ path: path.join(OUT, 'shots', `fuse-${w}x${h}-${tag}.png`) }); return i; };
  const click = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll('.msx button, [data-monsuc-fuse] button, .mmg button')].find((x) => !x.disabled && new RegExp(src).test(x.innerText)); if (b) b.click(); return !!b; }, re);
  await dump('home');
  console.log('open box', await click('マスモンボックス')); await page.waitForTimeout(500); await dump('gate');
  console.log('open fuse', await click('合体')); await page.waitForTimeout(700); await dump('fuse1');
  const attrs = () => page.evaluate(() => [...document.querySelectorAll('[data-monsuc-fuse] [data-monsuc-fuse-pick], [data-monsuc-fuse] button')].filter((b) => !b.disabled).map((b) => (b.getAttribute('data-monsuc-fuse-pick') || '') + ':' + (b.innerText || '').replace(/\s+/g, ' ').slice(0, 20)).slice(0, 20));
  console.log('fuse btns', await attrs());
  const pick = async (n) => page.evaluate((n) => { const b = [...document.querySelectorAll('[data-monsuc-fuse-pick]')].filter((x) => !x.disabled)[n]; if (b) b.click(); return !!b; }, n);
  console.log('pick1', await pick(0)); await page.waitForTimeout(500); await dump('fuse2');
  console.log('pick2', await pick(1)); await page.waitForTimeout(700); await dump('fuse3');
  console.log('go', await page.evaluate(() => { const b = document.querySelector('[data-monsuc-fuse-go]'); if (b) b.click(); return !!b; })); await page.waitForTimeout(1200);
  console.log('go2', await page.evaluate(() => { const b = document.querySelector('[data-monsuc-fuse-go]:not([disabled])'); if (b) b.click(); return !!b; })); await page.waitForTimeout(2500); await dump('fuse4');
  await page.fill('[data-monsuc-fuse-nameinput]', 'テスト子').catch((e) => console.log('fill NG', String(e).slice(0, 80)));
  console.log('name', await page.evaluate(() => { const b = document.querySelector('[data-monsuc-fuse-namego]'); if (b) b.click(); return !!b; })); await page.waitForTimeout(800); await dump('fuse5');
  console.log('close', await click('^閉じる')); await page.waitForTimeout(500); await dump('afterfuse');
  console.log('memo', await click('メモリアルモンスター')); await page.waitForTimeout(600); await dump('memo');
  const d = await page.evaluate(() => ({ box: JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null'), asst: JSON.parse(localStorage.getItem('mh_monsuc_assist_v1') || 'null'), fuse: JSON.parse(localStorage.getItem('mh_monsuc_fuse_v1') || 'null') }));
  console.log('STORE box', d.box && d.box.mons.length, d.box && d.box.mons.map((m) => m.nick + (m.raised === false ? '(未)' : '')).join(','), '| assist', JSON.stringify(d.asst).slice(0, 500), '| fuse', JSON.stringify(d.fuse).slice(0, 200));
  console.log('errors', errs);
  await browser.close(); server.close();
})();
