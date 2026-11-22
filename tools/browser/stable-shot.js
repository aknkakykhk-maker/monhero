// 撮り比べ(tools/browser/visual-compare-check.js)の「毎回変わる所を止めて撮る」小道具。
// モンサクの撮影の道具(tools/success/success-shoot.js)も、SHOT_STABLE=<今日の時刻のミリ秒> のときだけこれで撮る。
//   ・日付と時刻は決まった時刻から始め、撮るあいだは1つの時刻に止める / 乱数は種を固定(画面ごとに入れ直せる)
//   ・CSS の動きは止め、動画は隠す
//   ・それでも動く所は、間をあけて何回か撮り、変わった画素を <止め絵>.move に控える(比べるときに外す)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

const PIXEL_DIFF = 28; // 1画素の色の差(0〜255)がこれを超えたら「違う」
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}video{visibility:hidden!important}';

// ページに入れる(addInitScript)。fixedNow … 時計を始める時刻(ミリ秒)
const stableInit = (fixedNow) => {
  const RealDate = Date, real0 = RealDate.now();
  let frozen = null;
  const now = () => (frozen != null ? frozen : fixedNow + (RealDate.now() - real0));
  class FakeDate extends RealDate { constructor(...a) { if (a.length === 0) super(now()); else super(...a); } static now() { return now(); } }
  window.Date = FakeDate;
  // 撮るあいだは時計を1つの時刻に止める(n … 画面の番号。画面ごとに1分ずつ先の、決まった時刻)。null で動かす
  window.__vcFreeze = (n) => { frozen = n == null ? null : fixedNow + 600000 + (n | 0) * 60000; };
  let seed = 20261122;
  window.__vcReseed = (n) => { seed = (20261122 + (n | 0) * 7919) >>> 0; };
  Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

const sharpOf = () => require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const toRaw = async (png) => sharpOf()(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
// 2枚の絵の違う画素に印を付ける(mask[i]=1)。大きさが違えば null
const diffMask = (a, b) => {
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return null;
  const n = a.info.width * a.info.height, m = new Uint8Array(n);
  const x = a.data, y = b.data;
  for (let i = 0, p = 0; i < n; i++, p += 3) if (Math.abs(x[p] - y[p]) > PIXEL_DIFF || Math.abs(x[p + 1] - y[p + 1]) > PIXEL_DIFF || Math.abs(x[p + 2] - y[p + 2]) > PIXEL_DIFF) m[i] = 1;
  return m;
};

// 止め絵を撮る: 動きを止め、間をあけて4回撮り、変わった画素を「動く所」として <file>.move に控える
const GAPS = [300, 500, 800];
const stableShot = async (page, file, n = 0) => {
  await page.addStyleTag({ content: FREEZE }).catch(() => {});
  await page.evaluate((k) => window.__vcFreeze && window.__vcFreeze(k), n).catch(() => {});
  await page.waitForTimeout(600);
  const shots = [await page.screenshot()];
  for (const g of GAPS) { await page.waitForTimeout(g); shots.push(await page.screenshot()); }
  await page.evaluate(() => window.__vcFreeze && window.__vcFreeze(null)).catch(() => {});
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, shots[shots.length - 1]);
  const raws = await Promise.all(shots.map(toRaw));
  let move = null, any = false;
  for (let i = 1; i < raws.length; i++) { const m = diffMask(raws[i - 1], raws[i]); if (!m) return; if (!move) move = m; else for (let j = 0; j < m.length; j++) if (m[j]) move[j] = 1; }
  for (let j = 0; j < move.length; j++) if (move[j]) { any = true; break; }
  const mf = file.replace(/\.png$/, '.move');
  if (any) fs.writeFileSync(mf, Buffer.from(move)); else fs.rmSync(mf, { force: true });
};

module.exports = { PIXEL_DIFF, FREEZE, stableInit, toRaw, diffMask, stableShot };
