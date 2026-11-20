#!/usr/bin/env node
// モンサクの大会(組み合わせ表 → 試合の前 → 試合)を、本番と同じ入口で開いて止め絵を撮る(r1115-202 H3・M12〜M14・M16・L10)。
//   公開の印 monheroSuccess をページの中だけ真にして、助手ライフの口(ALSX_HOST)から開く(デバッグの入口は組み合わせ表・試合が別の部品)。
//   育成の状態は芯(monhero-success.js)を Node で回して「デビュー戦の当日」まで進めたものを保存に入れる。
//   node tools/battle/monsuc-match-shoot.js [出力先(既定 scratch)]   … 390×844・320×568・844×390 で 4場面ずつ
//   画面の数え(体力の帯と札が同時に見えるか・下の札が切れていないか)も出す
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { serve, isolate, toHome, lapSeed, quietBootSeed, updateNoticeSeed, eventStorySeed } = require('../success/monsuc-play10.js');
const { load } = require('../success/load.js');

const OUT = path.resolve(process.argv[2] || path.join(process.env.SCRATCH || '/tmp', 'monsuc-match-shoot'));
fs.mkdirSync(OUT, { recursive: true });
const VIEWS = [['390', 390, 844], ['320', 320, 568], ['land', 844, 390]].filter(([t]) => !process.env.VIEWS || process.env.VIEWS.split(',').includes(t));

const runSeed = () => {
  const { SUC } = load();
  // MSX_NOSULK=1 … 見守り(意味不明な行動をしない)を最大で持つ子を編成する(試合の前の助言の確認用)
  const AT = require('../../monster-hero/data/monhero-success-assist.js');
  const team = process.env.MSX_NOSULK ? [{ kind: 'raised', species: 'Golem', name: '見守り役', stats: { life: 300, pow: 300, wise: 300, hit: 300, eva: 300, tough: 300 }, lv: 30, loy: 80, pop: 50, techs: [], assists: [{ id: 'mimamori', n: AT.BY_ID.mimamori.max }] }] : [];
  let s = SUC.newRun({ id: 'shoot1', species: 'Mocchi', aid: 'mua', team, aidBondLv: 1 });
  for (let i = 0; i < 80 && !s.battle; i++) { s = SUC.act(s, { kind: 'train', stat: i % 2 ? 'pow' : 'hit' }).state; s = SUC.endTurn(s).state; }
  return { v: 1, id: 'shoot1', s, scn: 'hero', nick: 'モチ太', colors: null, from: null, items: [], used: 0, phase: 'battle', out: null, log: [], startAt: Date.now() };
};

const seed = ({ run }) => {
  if (!localStorage.getItem('mh_monsuc_run_v1')) localStorage.setItem('mh_monsuc_run_v1', JSON.stringify(run));
  localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: Object.fromEntries(['scn', 'prep', 'team', 'bring', 'turn', 'train', 'result', 'rest', 'shugyo', 'cup', 'rank', 'meal', 'match', 'rematch', 'event', 'awake', 'retire', 'open', 'firstend', 'start'].map((k) => [k, 1])) }));
};

// 見えている範囲に、体力の帯・場面・技の札・下のボタンが入っているか
const measure = (page) => page.evaluate(() => {
  const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; const t = Math.max(0, r.top); const b = Math.min(innerHeight, r.bottom); const l = Math.max(0, r.left); const rr = Math.min(innerWidth, r.right); return b > t && rr > l ? Math.round(((b - t) * (rr - l)) / (r.width * r.height) * 100) : 0; };
  const q = (s) => document.querySelector(s);
  return { hp: vis(q('[data-msa-hud="A"]')), stage: vis(q('[data-msa-stage]')), card: vis(q('[data-msxm-tech], [data-msa-dc-card]')), move: vis(q('[data-msxm-move]')), bottom: [...document.querySelectorAll('.msc-foot button')].map(vis), hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
});

(async () => {
  const run = runSeed();
  const server = await serve(); const port = server.address().port;
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const report = [];
  for (const [tag, w, h] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await isolate(page);
    await page.addInitScript(lapSeed, { ctl: 'manual' }); await page.addInitScript(seed, { run });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(eventStorySeed());
    try { await toHome(page, port); } catch (e) { await page.screenshot({ path: path.join(OUT, tag + '-fail.png') }); throw e; }
    await page.evaluate(() => { RELEASE_FLAGS.monheroSuccess = true; ALSX_HOST.set({ assistantId: 'mua', from: 'room', at: Date.now() }); });
    await page.waitForSelector('[data-msx-view]', { timeout: 30000 });
    const shot = async (name) => { await page.waitForTimeout(700); const f = path.join(OUT, `${tag}-${name}.png`); await page.screenshot({ path: f }); const m = await measure(page); report.push({ tag, name, ...m }); };
    const click = async (sel) => { const l = page.locator(sel).first(); if (await l.count()) { await l.dispatchEvent('click'); return true; } return false; };
    for (let i = 0; i < 8; i++) { if (await click('[data-msx-home-cont]')) break; await click('button:has-text("閉じる"), button:has-text("OK"), button:has-text("はじめる")'); await page.waitForTimeout(500); }
    await page.waitForTimeout(1500);
    await shot('0-day');
    // 大会の日 → 組み合わせ表まで(前置きの画面は押して進む)
    for (let i = 0; i < 20; i++) {
      if (await page.locator('[data-msc-bracket]').count()) break;
      const hit = await page.evaluate(() => {
        const vis = (b) => b && !b.disabled && b.offsetParent !== null;
        const bs = [...document.querySelectorAll('.msx button')].filter(vis);
        const pick = document.querySelector('[data-msx-r3-cupintro-go], [data-msx-r3-yes], [data-msx-r3-precup], [data-msx-r3-enter]') || bs.find((b) => /^🏆\s*大会|大会\s*デビュー|出場 ▶|^はい$|次へ|つぎへ|▶$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (pick && vis(pick)) { pick.click(); return (pick.innerText || '').slice(0, 20); } return null;
      });
      await page.waitForTimeout(hit ? 900 : 600);
    }
    await click('[data-msc-skip]');
    await page.waitForTimeout(1200);
    await shot('1-bracket');
    await click('[data-msc-go]');
    await page.waitForTimeout(1200);
    await shot('2-card');
    await click('.msc-card button:has-text("技"), button:has-text("技"):not(:has-text("全部"))');
    await shot('3-card-tech');
    await click('[data-msc-ready]');
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) { if (!(await click('button:has-text("試合開始"), button:has-text("いくよ"), [data-msc-cutin] button'))) break; await page.waitForTimeout(800); }
    await page.waitForTimeout(6000);
    await shot('4-match');
    // 札まで送ったところ
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msxm-move]')].pop(); if (b) b.scrollIntoView({ block: 'end' }); });
    await shot('5-match-cards');
    await ctx.close();
  }
  await browser.close(); server.close();
  report.forEach((r) => console.log(`${r.tag} ${r.name} 体力の帯${r.hp ?? '-'}% 場面${r.stage ?? '-'}% 札${r.card ?? '-'}% 移動の札${r.move ?? '-'}% 下のボタン${JSON.stringify(r.bottom)}${r.hscroll ? ' 横にはみ出す' : ''}`));
  console.log(`止め絵: ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
