#!/usr/bin/env node
// モンヒロビートの全国ランキング「イベント」を、縦・横・🔄横で開いたときの最初の画面に、順位(または「記録はありません」)が見えて、
// 部門(曲)のボタンが下のメニューに隠れないことを確かめる(2026-11-20・点検 V4)。
//   node tools/ui/rhythm-event-ranking-landscape-check.js
//   ONLY=<姿勢> SHOT_DIR=<フォルダ> で1つだけ・止め絵つき
// ランキングの取得は本番へ行かせず、空の返事で受ける(順位の行は出ないので、「記録はありません」の欄の位置で見る)。
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium; let sharp;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (e) { console.log('SKIP: playwright か sharp が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 9361;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const TOL = 24; // 画面の端のふつうの余白(見出しの上の数px〜20px弱)と、線のにじみ・丸め(px)。env() の取り違えで出る帯(上59・左右47・下34)より小さい
// 姿勢: [名前, 幅, 高さ, 回す, 安全域(上・下・左・右)]。安全域は index.html の --mh-safe-* で差し込む(env() は作れない)
//   iPhone のアプリ(ホーム画面)・縦: 上59(ダイナミックアイランド)・下34。横に持ったとき: 上0・下21・左右47。ブラウザのバーが出ているとき(safari)は上下0
const POSTURES = [
  ['tate-390', 390, 844, false, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['yoko-844', 844, 390, false, { top: 0, bottom: 21, left: 47, right: 47 }],
  ['rot-390', 390, 844, true, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['rot-430', 430, 932, true, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['rot-safari', 390, 664, true, { top: 0, bottom: 0, left: 0, right: 0 }],
];
// 帯が出てよい幅(撮った絵を元の向きに戻した、画面の左・上・右・下)。わざと取る安全域だけ。
//   縦: 本体の padding が上・下に取る / 横: 左右(切り欠き側)と下 / 🔄横: 器の「左」が端末の上にあたるので、そこだけ(戻るボタンがノッチに隠れないように)
const allowOf = (rot, w, h, safe) => (rot ? { left: safe.top, top: 0, right: 0, bottom: 0 } : (w > h ? { left: safe.left, top: safe.top, right: safe.right, bottom: safe.bottom } : { left: safe.left, top: safe.top, right: safe.right, bottom: safe.bottom }));
// 撮った絵の四辺から、「絵の無い暗い帯」が何本続くかを数える。
//   帯の線 = 線ぜんぶがほぼ同じ暗い色(どの色の差も 8 以内・明るさ 60 未満)。文字・札・絵・グラデーションがかかる線は帯に数えない。
//   モンヒロビートの器の地は #020617(slate-950)・body は #000 で、どちらも暗い一色。
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [name, w, h, rot, safeInset] of POSTURES) {
      if (process.env.ONLY && process.env.ONLY !== name) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const allow = allowOf(rot, w, h, safeInset);
      // 安全域は、ブラウザの本物の env(safe-area-inset-*) を差し替えて入れる(CDP の Emulation.setSafeAreaInsetsOverride)。
      //   画面の中には env() を直に書いた所と、index.html の --mh-safe-* 経由の所の両方があるので、本物の env() で測らないと、直に書いた所の帯は見えない
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safeInset.top, bottom: safeInset.bottom, left: safeInset.left, right: safeInset.right } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(() => { class FakeWS { constructor() { this.readyState = 0; this.topic = null; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 0); } deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); } send(raw) { let m = null; try { m = JSON.parse(raw); } catch (_) { return; } if (m.event === 'phx_join') { this.topic = m.topic; this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } }); return; } if (m.event !== 'broadcast') return; this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: m.payload && m.payload.payload } }); } close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); } } window.WebSocket = FakeWS; });
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(500); }
      // ホームの入口は施設ボタン(data-home-fac="rhythm")を直接押す。言葉で探すと、イベントの札
      // (「🎉 モンヒロビート 本オープン記念 開催中」のバナー)が先に当たってモードえらびへ進めない
      // (2026-11-19・実際に30秒待ちで止まったので直した)
      await page.evaluate(() => { const x = document.querySelector('button[data-home-fac="rhythm"]'); x && x.click(); });
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
      await page.waitForTimeout(800);
      // 全国ランキング(イベント)を開く。ランキングの取得は本番へ行かせない(空の返事で受ける)
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.evaluate(() => document.querySelector('[data-rhythm-mode-ranking]').click());
      await page.waitForSelector('[data-rhythm-ranking-tab="event"]', { timeout: 20000 });
      await page.evaluate(() => document.querySelector('[data-rhythm-ranking-tab="event"]').click());
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('[data-rhythm-event-phase="prev"]')?.click());
      await page.waitForSelector('[data-rhythm-event-detail-open]', { timeout: 20000 });
      if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
      await page.waitForTimeout(1500);
      if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); fs.writeFileSync(path.join(process.env.SHOT_DIR, `${name}-event.png`), await page.screenshot()); }
      const m = await page.evaluate((rotated) => {
        // 🔄横は画面を90度回してあるので、部屋の枠の「上下」は画面の「右左」。枠の座標に直してから測る
        const W = window.innerWidth;
        const R = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return rotated ? { top: W - r.right, bottom: W - r.left, left: r.top, right: r.bottom } : r; };
        const menu = R('[data-rhythm-mode-ranking-tabs]'); const divs = [...document.querySelectorAll('[data-rhythm-event-division]')].map((e) => { const r = e.getBoundingClientRect(); return rotated ? { top: W - r.right, bottom: W - r.left } : r; });
        const body = R('[data-rhythm-event-list]') || R('[data-rhythm-event-self-empty]') || R('[data-rhythm-event-empty]');
        const phase = R('[data-rhythm-event-phase-tabs]'); const win = R('[data-rhythm-event-window]'); const det = R('[data-rhythm-event-detail-open]');
        return { menuTop: menu ? Math.round(menu.top) : null, divBottom: divs.length ? Math.round(Math.max(...divs.map((r) => r.bottom))) : null, bodyTop: body ? Math.round(body.top) : null, bodyBottom: body ? Math.round(body.bottom) : null,
          sameRow: !!(phase && win && det && Math.abs(phase.top - win.top) < 6 && Math.abs(win.top - det.top) < 6), vh: window.innerHeight };
      }, rot);
      console.log(`INFO: ${name} ${JSON.stringify(m)}`);
      const land = w > h;
      check(`${name}: 部門(曲)のボタンが、下のメニューに隠れない`, m.divBottom === null || (m.menuTop !== null && m.divBottom <= m.menuTop + 1), JSON.stringify(m));
      check(`${name}: ランキング(順位・記録なしの欄)が、最初の画面に見える(下のメニューより上に20px以上)`, m.bodyTop !== null && m.menuTop !== null && m.bodyTop <= m.menuTop - 20, JSON.stringify(m));
      if (land || rot) check(`${name}: 今回/前回・イベント名・詳細が1行に並ぶ`, m.sameRow, JSON.stringify(m));
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
