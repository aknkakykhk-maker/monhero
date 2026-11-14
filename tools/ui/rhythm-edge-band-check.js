#!/usr/bin/env node
// モンヒロビートの全画面で、画面の四辺に「ゲームの絵が無い黒い帯」ができていないかを、本物の画面で測って見張る(2026-11-14・社長「何回も言ってんだから」)。
//
//   node tools/ui/rhythm-edge-band-check.js
//   ONLY=<名前> で1つの姿勢だけ(tate-390 / yoko-844 / rot-390 / rot-430 / rot-safari)。SHOT_DIR=<フォルダ> で撮った絵を残す
//
// 【なぜ要るか】🔄横(端末は縦のまま絵を90度回す・RHYTHM_VIEW_ROTATION)のモンヒロビートで、端の黒い帯が何度も戻ってきた
//   (2026-09-29「上の空き」・2026-11-12「また」・2026-11-14「マルチでまた上に空白」)。回した器の中では、画面が env(safe-area-inset-*) を
//   そのまま足すと、端末の上端のぶん(ノッチ 59px)が、回したあとの別の辺に出る。1つ直すたびに別の画面で戻っていたので、
//   画面の作りを1つずつ調べるのをやめ、**出来上がった絵の四辺の黒(#000)の帯を数える**ことにした。
//
// 【測り方】本物のブラウザで、縦・ふつうの横・🔄横の3つの姿勢を、iPhone の大きさ(安全域あり)で開き、画面ごとに撮る。
//   端から内側へ「線ぜんぶがほぼ同じ暗い一色の線」が何本続くかが、そのまま「絵の無い帯の幅」。🔄横は絵を元の向き(横長)に戻してから測る。決まりの幅は、わざと取る安全域だけ(下の ALLOW)+4px。
//   画面: モードえらび・ソロの曲えらび・オプション・ランキング・マルチ(待ち・曲えらび・準備・演奏・結果)
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
const PORT = 9317;
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
const bandsOf = async (buf, rot) => {
  let img = sharp(buf); if (rot) img = img.rotate(-90);
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width; const H = info.height;
  const px = (x, y) => { const i = (y * W + x) * 3; return [data[i], data[i + 1], data[i + 2]]; };
  const solidLine = (len, at) => { let lo = [255, 255, 255]; let hi = [0, 0, 0];
    for (let k = 0; k < len; k++) { const p = at(k); for (let c = 0; c < 3; c++) { if (p[c] < lo[c]) lo[c] = p[c]; if (p[c] > hi[c]) hi[c] = p[c]; } }
    return hi[0] - lo[0] <= 8 && hi[1] - lo[1] <= 8 && hi[2] - lo[2] <= 8 && Math.max(hi[0], hi[1], hi[2]) < 60; };
  const rowSolid = (y) => solidLine(W, (x) => px(x, y));
  const colSolid = (x) => solidLine(H, (y) => px(x, y));
  const run = (len, solid) => { let n = 0; while (n < len && solid(n)) n++; return n; };
  return { top: run(H, rowSolid), bottom: run(H, (k) => rowSolid(H - 1 - k)), left: run(W, colSolid), right: run(W, (k) => colSolid(W - 1 - k)), W, H };
};
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
      // 画面を撮って、四辺の黒い帯を測る
      const shoot = async (label) => {
        await page.waitForTimeout(700);
        const buf = await page.screenshot();
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); fs.writeFileSync(path.join(SHOT_DIR, `${name}-${label}.png`), buf); }
        const b = await bandsOf(buf, rot);
        // 🔄横は四辺。縦・ふつうの横は、見出しや下の札の暗い地が全幅に続くので上下は帯と区別できず、左右だけを見る
        const over = (rot ? ['left', 'top', 'right', 'bottom'] : ['left', 'right']).filter((k) => b[k] > allow[k] + TOL).map((k) => `${{ left: '左', top: '上', right: '右', bottom: '下' }[k]}${b[k]}px(許す${allow[k] + TOL})`);
        check(`${name}: ${label} — 四辺に絵の無い黒い帯が無い`, over.length === 0, over.length ? over.join(' / ') : `左${b.left} 上${b.top} 右${b.right} 下${b.bottom}`);
      };
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(500); }
      await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /モンヒロビート/.test(e.innerText || '')); x && x.click(); });
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
      await page.waitForTimeout(800);
      if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
      await shoot('モードえらび');
      // 画面を開いて撮り、モードえらびへ戻る。戻れなければ(閉じるボタンが無い)そのあとは見ない
      const visit = async (label, openSel, readySel, closeSel = '') => {
        const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, openSel);
        if (!ok) { console.log(`INFO: ${name}: ${label} の入り口が見つからない(${openSel})`); return; }
        await page.waitForSelector(readySel, { timeout: 15000 }).catch(() => {});
        await shoot(label);
        const back = await page.evaluate((cs) => {
          if (cs) { const c = document.querySelector(cs); if (c) { c.click(); return true; } }
          const vis = (e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed';
          const x = [...document.querySelectorAll('[data-rhythm-song-select-back], button')].filter(vis).find((e) => e.matches('[data-rhythm-song-select-back]') || /^(←|✕|×|✖|もどる|戻る|閉じる|とじる|◀ ?もどる|← ?もどる)/.test((e.innerText || e.getAttribute('aria-label') || '').trim()) || /戻|閉じ/.test(e.getAttribute('aria-label') || ''));
          if (x) { x.click(); return true; } return false; }, closeSel);
        if (!back) await page.keyboard.press('Escape');
        await page.waitForTimeout(900);
        if (!(await page.evaluate(() => !!document.querySelector('[data-rhythm-mode-select]')))) { console.log(`INFO: ${name}: ${label} からモードえらびへ戻れなかったので、以降のソロ画面は見ない`); throw new Error('stop-solo'); }
      };
      try {
        await visit('ソロの曲えらび', '[data-rhythm-mode-solo]', '[data-rhythm-song-select]');
        await visit('オプション', '[data-rhythm-mode-options]', 'body');
        await visit('ランキング', '[data-rhythm-mode-ranking]', '[data-rhythm-mode-ranking-tabs]', '[data-rhythm-mode-ranking-layer] button');
      } catch (e) { if (String(e.message) !== 'stop-solo') throw e; }
      // マルチ: 部屋を作って、待ち・曲えらび・準備・演奏・結果
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free]').click());
      await page.waitForTimeout(800);
      await shoot('マルチ・フリーマッチの窓');
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free-create]').click());
      await page.waitForSelector('[data-rhythm-multi-step="matching"]', { timeout: 30000 });
      await page.waitForTimeout(1500);
      await shoot('マルチ・待ち');
      // 「呼ぶ」のしぼりこみの窓(RhythmBuddyListSheet)。呼ぶ画面の一覧は呼べるマスモンが要るので、窓だけを器の中へ直に出して測る
      //   (この窓は paddingTop に env(safe-area-inset-top) を直に書いていて、🔄横では、回した画面の上に端末の上端のぶん(59px)の帯が出た)
      const mounted = await page.evaluate(() => { try {
        const host = document.querySelector('.mh-app'); if (!host || typeof RhythmBuddyListSheet !== 'function') return false;
        const d = document.createElement('div'); d.id = '__bandProbe'; host.appendChild(d);
        const root = ReactDOM.createRoot(d); window.__bandProbeRoot = root;
        root.render(React.createElement(RhythmBuddyListSheet, { tab: 'filter', settings: rhythmBuddyNormalizeListSettings({}), onChange() {}, onTab() {}, onClose() {} }));
        return true; } catch (e) { return false; } });
      check(`${name}: しぼりこみの窓を出して測れる`, mounted);
      if (mounted) {
        await page.waitForSelector('[data-rhythm-buddy-list-sheet]', { timeout: 5000 }).catch(() => {});
        await shoot('マルチ・呼ぶ(並べ替え・しぼりこみの窓)');
        await page.evaluate(() => { try { window.__bandProbeRoot.unmount(); document.getElementById('__bandProbe').remove(); } catch (e) {} });
      }
      // 「呼ぶ」の画面と、その中の並べ替え・しぼりこみの窓(部屋の中で開く。env() を直に書いた窓がここにあった)
      const clickIf = (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return false; e.click(); return true; }, sel);
      if (await clickIf('[data-rhythm-buddy-open]')) {
        await page.waitForTimeout(900);
        await shoot('マルチ・呼ぶ画面');
        if (await clickIf('[data-rhythm-buddy-list-bar] button')) {
          await page.waitForSelector('[data-rhythm-buddy-list-sheet]', { timeout: 5000 }).catch(() => {});
          await shoot('マルチ・呼ぶ(並べ替え・しぼりこみ)');
          await page.evaluate(() => { const sheet = document.querySelector('[data-rhythm-buddy-list-sheet]'); const x = sheet && [...sheet.querySelectorAll('button')].find((e) => /✕|×|閉じる|とじる|もどる/.test((e.innerText || e.getAttribute('aria-label') || '').trim())); x && x.click(); });
          await page.waitForTimeout(500);
        }
        await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(✕|×|閉じる|とじる)/.test((e.innerText || e.getAttribute('aria-label') || '').trim())); x && x.click(); });
        await page.waitForTimeout(500);
      }
      await page.evaluate(() => { for (const id of ['erubin', 'kiki', 'momosuke']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-confirm]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await shoot('マルチ・曲えらび');
      await page.locator('[data-rhythm-multi-omakase]').click({ force: true, timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'ready' && document.querySelector('[data-rhythm-multi-ready]'), null, { timeout: 90000 });
      await shoot('マルチ・準備');
      await page.locator('[data-rhythm-multi-ready]').click({ force: true, timeout: 15000 });
      await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]'), null, { timeout: 90000 });
      await shoot('マルチ・演奏');
      const round = await page.evaluate(() => RHYTHM_MULTI.view().room.round);
      await page.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 987654, cleared: true, fullCombo: true, maxCombo: 431, judgments: { MARVELOUS: 400, EXCELLENT: 25, GREAT: 6, GOOD: 0, BAD: 0, MISS: 0 }, fast: 12, slow: 7 }, false, { diffId: 'HELL' }), round);
      for (let i = 0; i < 6; i += 1) {
        if (!(await page.evaluate(() => !!document.querySelector('[data-rhythm-play-area]')))) break;
        await page.evaluate(() => document.querySelector('[data-rhythm-pause]')?.click());
        await page.waitForTimeout(700);
        await page.locator('[data-rhythm-pause-exit]').click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'result', null, { timeout: 40000 });
      await page.waitForTimeout(3500);
      await shoot('マルチ・結果');
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
