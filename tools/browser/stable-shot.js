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

// iPhone の切り欠きの余白をブラウザに効かせる(env(safe-area-inset-*) が sa の値になる)
// ★CDP のつなぎを切ると余白が元に戻るので、ページごとに1本つないだままにする
const SA_CDP = new WeakMap();
const setSafeArea = async (context, page, sa) => {
  try {
    let cdp = SA_CDP.get(page);
    if (!cdp) { cdp = await context.newCDPSession(page); SA_CDP.set(page, cdp); }
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: sa.top || 0, bottom: sa.bottom || 0, left: sa.left || 0, right: sa.right || 0 } });
    return true;
  } catch (e) { return false; }
};

// ページの中で: 押す物(ボタン・リンク・タブ・入力)が切り欠きの範囲に入っていないかを測る。
//   上: 時刻・電池と重なる帯 / 下: ホームの棒の帯 / 左右(横持ち): 切り欠きの帯。上に見えていて、送っても(スクロールしても)逃がせない物だけ数える
const measureSafeArea = (sa) => {
  const W = innerWidth, H = innerHeight, out = [], TOL = 4;
  const scrollable = (el, dir) => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const st = getComputedStyle(e);
      if (dir === 'x') { if (/auto|scroll/.test(st.overflowX) && e.scrollWidth > e.clientWidth + 2) return true; continue; }
      if (!/auto|scroll/.test(st.overflowY) || e.scrollHeight <= e.clientHeight + 2) continue;
      if (dir === 'down' && e.scrollTop < e.scrollHeight - e.clientHeight - 2) return true;
      if (dir === 'up' && e.scrollTop > 2) return true;
    }
    const d = document.scrollingElement; if (!d || dir === 'x') return false;
    return dir === 'down' ? d.scrollTop < d.scrollHeight - d.clientHeight - 2 : d.scrollTop > 2;
  };
  for (const el of document.querySelectorAll('button,a[href],[role="button"],[role="tab"],input,select,textarea')) {
    if (el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.pointerEvents === 'none' || Number(st.opacity) === 0) continue;
    const cx = Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), cy = Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2));
    const t = document.elementFromPoint(cx, cy);
    if (!t || !(t === el || el.contains(t))) continue;
    const hit = [];
    if (sa.top && r.top < sa.top - TOL && !scrollable(el, 'up')) hit.push(['上', Math.round(sa.top - r.top)]);
    if (sa.bottom && r.bottom > H - sa.bottom + TOL && !scrollable(el, 'down')) hit.push(['下', Math.round(r.bottom - (H - sa.bottom))]);
    if (sa.left && r.left < sa.left - TOL && !scrollable(el, 'x')) hit.push(['左', Math.round(sa.left - r.left)]);
    if (sa.right && r.right > W - sa.right + TOL && !scrollable(el, 'x')) hit.push(['右', Math.round(r.right - (W - sa.right))]);
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 24);
    for (const [edge, px] of hit) out.push({ label, edge, px });
  }
  return out;
};

module.exports = { setSafeArea, measureSafeArea, PIXEL_DIFF, FREEZE, stableInit, toRaw, diffMask, stableShot };
