#!/usr/bin/env node
// 起動時のお知らせの「まとめ」(2026-10-10・ユーザー指示「起動時のお知らせを1枚にまとめる」)を実ブラウザで確かめる。
//   ・昔のセーブで起動すると、未読が2件以上のとき見出しの一覧が1枚だけ出る(中身のページは出ない)
//   ・「くわしく」を押した件だけ、今までのページ送りで開く。読み終えるとその件だけ既読になり、残りは一覧へ戻る
//   ・「あとで読む」で、残りの全件が既読になって閉じる(既読の保存キー mh_seen_update_notices_v1 は足すだけ)
//   ・開き直すと、同じお知らせはもう出ない
// プレイボット(tools/playbot)の道具を借りる。ランキングへは送らない(fake-supabase)。
//
//   node tools/assistant/update-notice-bundle-check.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.BUNDLE_CHECK_PORT || 8913);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { console.log('SKIP: playwright が入っていません'); return; }
  const { openSession } = require('../playbot/lib/session');
  const { prepareLegacy } = require('../playbot/lib/seeds');
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(PORT);
  const out = path.join(require('os').tmpdir(), 'update-notice-bundle-check');
  fs.mkdirSync(out, { recursive: true });
  const report = { headed: false, shotNo: 0, issues: [], steps: [], screens: new Map(), issueKeys: new Set(), phases: [] };
  const s = await openSession({ playwright, pageUrl: `http://localhost:${PORT}/monster-hero/index.html`, port: PORT, out, rand: Math.random, persona: 'bundle-check', report });
  const seenIds = () => s.page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_seen_update_notices_v1') || '[]'); } catch { return null; } });
  const bundle = () => s.page.$('[data-update-guide-bundle]');
  const items = () => s.page.$$eval('[data-update-guide-bundle-item]', els => els.map(e => e.getAttribute('data-update-guide-bundle-item')));
  // まとめが出るまで、ほかの重なり(ログインボーナスなど)を1つずつ閉じる
  const untilBundle = async () => { for (let i = 0; i < 60; i++) { if (await bundle()) return true; await s.dismissOverlays(1); await s.wait(300); } return !!(await bundle()); };
  try {
    await prepareLegacy(s);
    await s.boot({ toHome: false });
    await s.tapLabel(/トップ画面へ進む/, 2200);
    const shown = await untilBundle();
    check('未読が2件以上のとき、見出しの一覧が1枚だけ出る', shown);
    if (!shown) throw new Error('まとめが出なかった');
    const first = await items();
    check('一覧に2件以上の見出しが並ぶ', first.length >= 2, first.join(' / '));
    check('実装予告(本物が出ているもの)は一覧に並ばない', !first.some(id => /_soon_v1$|lineage_preview_v1$/.test(id)), first.join(' / '));
    const seen0 = await seenIds();
    check('一覧を出しただけでは既読にならない', Array.isArray(seen0) && !first.some(id => seen0.includes(id)));

    // 「くわしく」→ 開いた件のページ送り → 読み終えると、その件だけ既読になって一覧へ戻る
    const target = first[0];
    await s.page.click(`[data-update-guide-bundle-item="${target}"] button`);
    await s.wait(500);
    check('「くわしく」で一覧が閉じ、その件のページが出る', !(await bundle()) && !!(await s.page.$('[role="dialog"][aria-label]')));
    for (let i = 0; i < 40 && !(await bundle()); i++) { const b = (await s.listButtons()).find(x => x.overlay && /^(次へ|閉じる|あとで)$/.test(x.label)); if (!b) break; await s.tap(b, '読む'); await s.wait(250); if (first.length - 1 < 2) break; }
    const seen1 = await seenIds();
    check('開いた件だけが既読になる', Array.isArray(seen1) && seen1.includes(target) && first.slice(1).every(id => !seen1.includes(id)), JSON.stringify(first.slice(1)));
    if (first.length - 1 >= 2) {
      check('残りは一覧へ戻る', !!(await bundle()) && (await items()).length === first.length - 1);
      await s.page.click('[data-update-guide-bundle-later]');
      await s.wait(500);
      const seen2 = await seenIds();
      check('「あとで読む」で一覧が閉じ、残りも既読になる', !(await bundle()) && first.every(id => seen2.includes(id)));
      check('既読の保存キーは足すだけ(前の中身が消えない)', Array.isArray(seen0) && seen0.every(id => seen2.includes(id)));
    }
    // 開き直すと、同じお知らせは出ない
    await s.boot({ toHome: false });
    await s.tapLabel(/トップ画面へ進む/, 2200);
    for (let i = 0; i < 12; i++) { await s.dismissOverlays(1); await s.wait(200); }
    check('開き直しても、既読のお知らせは出ない', !(await bundle()));
  } catch (e) {
    check('検査が最後まで進む', false, e.message.split('\n')[0]);
  } finally {
    try { await s.close(); } catch {}
    server.close();
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
