#!/usr/bin/env node
// モンサクのモンスター表示の共通の型(MonsucMonCard・r1119-017)を本物のブラウザで並べ、
// 「名前に何も重ならない・札の縦横比が 3:4 でそろう・字が小さすぎない・ページのエラーが出ない」を見る。
//
//   node tools/success/monsuc-moncard-shoot.js                  … 縦390×844 で確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/monsuc-moncard-shoot.js … 縦・横・小さい横で撮る
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 8974;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で並べる見本(どの大きさでも同じ子を出す。名前の長い子・得意な能力2つ・選んだ子・選べない子を混ぜる)
const demo = () => {
  /* global React, ReactDOM, MonsucMonCard, MonsucCardGrid */
  const mk = (id, species, nick, grade, lv, fav) => ({ id, species, nick, grade, lv, fav, colors: [] });
  const mons = [mk('a', 'Mocchi', 'もちまる', 'A2', 8, ['pow', 'tough']), mk('b', 'Tiger', 'キリモチ', 'B2', 5, ['eva']), mk('c', 'Pixie', 'きき', 'S1', 5, ['wise', 'hit']),
    mk('d', 'Golem', 'いわおだいまおう', 'C3', 6, []), mk('e', 'Ghost', '', 'E1', 3, ['life']), mk('f', 'Plant', 'ぷらんと', 'D2', 4, ['hit']), mk('g', 'Snegurochka', '', 'M1', 12, ['wise'])];
  const h = React.createElement;
  const sec = (t, body) => h('section', { style: { margin: '0 0 12px' } }, h('div', { style: { fontWeight: 900, fontSize: 12, color: '#fde68a', margin: '0 0 4px' } }, t), body);
  return h('div', { id: 'mcd-demo', style: { position: 'fixed', inset: 0, overflow: 'auto', background: '#14112a', padding: 10, zIndex: 99999, color: '#fff', fontFamily: 'sans-serif' } },
    sec('小 s … 一覧(5列・横は7列)。札の下は総合力', h(MonsucCardGrid, { size: 's' }, mons.map((m, i) => h(MonsucMonCard, { key: m.id, m, size: 's', num: (9000 + i * 731).toLocaleString(), on: i === 1, lock: i === 3 ? '育成中' : null, onClick: () => {}, attrs: { 'data-mcd': 's' } })))),
    sec('中 m … 編成の6枠(3列・横は6列)。札の下は役の帯', h(MonsucCardGrid, { size: 'm' }, [
      h(MonsucMonCard, { key: 1, m: mons[0], size: 'm', tag: { text: 'マスモン', kind: 'box' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
      h(MonsucMonCard, { key: 2, m: mons[1], size: 'm', tag: { text: 'メモモン', kind: 'memo' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
      h(MonsucMonCard, { key: 3, m: { ...mons[3], grade: '', fav: [] }, size: 'm', tag: { text: 'ベースモン', kind: 'base' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
      h(MonsucMonCard, { key: 4, m: mons[2], size: 'm', tag: { text: 'フレンド', kind: 'friend' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
      h(MonsucMonCard, { key: 5, m: null, size: 'm', tag: { text: 'あき', kind: 'base' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
      h(MonsucMonCard, { key: 6, m: null, size: 'm', tag: { text: 'フレンド', kind: 'friend' }, onClick: () => {}, attrs: { 'data-mcd': 'm' } }),
    ])),
    sec('大 l … 詳細の1体', h('div', { style: { width: 'min(42vw,180px)' } }, h(MonsucMonCard, { m: mons[0], size: 'l', attrs: { 'data-mcd': 'l' } }))));
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [844, 390, 'land'], [568, 320, 'sland']] : [[390, 844, '']];
  try {
    for (const [w, h, tag] of sizes) {
      const label = tag || 'tate';
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonsucMonCard === 'function' && typeof MsxMmArt === 'function', undefined, { timeout: 90000 });
      await page.evaluate((src) => { const el = Object.assign(document.createElement('div'), { id: 'mcd-root' }); document.body.appendChild(el); ReactDOM.createRoot(el).render(new Function(`return (${src})`)()()); }, demo.toString());
      await page.waitForSelector('#mcd-demo [data-mcd]'); await page.waitForTimeout(1500);
      const q = await page.evaluate(() => {
        const out = { n: 0, hit: [], ratio: [], small: [] };
        document.querySelectorAll('#mcd-demo [data-mcd]').forEach((c) => {
          out.n += 1;
          const f = c.querySelector('.mcd-f').getBoundingClientRect(); out.ratio.push(+(f.height / f.width).toFixed(2));
          const nm = c.querySelector('.mcd-nm'); if (!nm) return;
          const r = nm.getBoundingClientRect();
          c.querySelectorAll('.mcd-gd, .mcd-fav i, .mcd-ck, .mcd-lk').forEach((e) => { const o = e.getBoundingClientRect(); if (o.width && o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top) out.hit.push(`${c.dataset.mcd}:${nm.innerText}`); });
          if (parseFloat(getComputedStyle(nm).fontSize) < 9) out.small.push(nm.innerText);
        });
        return out;
      });
      check(`${label}: 札が並ぶ(小7・中6・大1)`, q.n === 14, String(q.n));
      check(`${label}: 名前に評価・得意な能力・印・理由が重ならない`, q.hit.length === 0, q.hit.join(' '));
      check(`${label}: 札の縦横比が 3:4 でそろう`, q.ratio.every((x) => Math.abs(x - 1.333) < 0.04), q.ratio.join(','));
      check(`${label}: 名前の字が 9px より小さくならない`, q.small.length === 0, q.small.join(' '));
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `moncard${tag ? `-${tag}` : ''}.png`), fullPage: false }); }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();
