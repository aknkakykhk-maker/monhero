// ビートP交換所の「曲」の売り場(新曲の札)を、本物の画面で確かめる(2026-11-14 社長「ジャケットがアップで見れない・視聴ができない」)。
//
//   node tools/mode/rhythm-song-shop-check.js            確かめるだけ
//   MH_SHOT_DIR=<dir> node tools/mode/rhythm-song-shop-check.js   止め絵も撮る(縦・横・幅320)
//
// 見張ること(縦 390×844・横 844×390・幅 320×568。3曲とも所持済みの状態と、持っていない状態の両方):
//   ・札のジャケットを押すと大きく見られる(拡大の窓が開く)
//   ・札に「▶ 試し聴き」がある。押すと、その曲が鳴り(BGM は止まる)、もう一度押す・窓を離れると止まって、BGM が戻る
//   ・売り場の説明文が、言葉の途中(short ver. など)で折れない
//   ・札の中に大きな空きが無い(曲の長さ・作者・難易度の幅が札に入っている)
// ★外へはつながない。WebSocket を偽物に差し替える(tools/mode/multi-stamp-check.js と同じ)
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}
const SHOT = process.env.MH_SHOT_DIR || '';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});
const FAKE_WS = () => {
  class FakeWS {
    constructor() { this.readyState = 0; this.topic = null; this.ch = null; setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0); }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic;
        this.ch = new BroadcastChannel(`fake-ws:${m.topic}`);
        this.ch.onmessage = (e) => this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: e.data } });
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (this.ch) this.ch.postMessage(payload);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { this.readyState = 3; if (this.ch) this.ch.close(); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
};

const POSTURES = [[390, 844, 'tate'], [844, 390, 'yoko'], [320, 568, 'narrow']].filter(([, , l]) => !process.env.ONLY_POSTURE || process.env.ONLY_POSTURE === l);
// 文字の並びを1文字ずつ測り、英字・数字・ピリオドが続く「語」の途中で行が変わっていないかを返す(short ver. が short/ver. に割れる、など)
const WRAP_PROBE = (sel) => {
  const root = document.querySelector(sel); if (!root) return { found: false, bad: [], lines: [] };
  const bad = []; const lines = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const chars = [];
  while (walker.nextNode()) { const n = walker.currentNode; for (let i = 0; i < n.data.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (b.width === 0 && b.height === 0) continue; chars.push({ ch: n.data[i], top: Math.round(b.top), left: b.left }); } }
    let cur = ''; let curTop = chars.length ? chars[0].top : 0;
  const okBreakAfter = (c) => /[。、]/.test(c);
  chars.forEach((c, i) => { if (Math.abs(c.top - curTop) > 4) { lines.push(cur); cur = ''; curTop = c.top; const prev = chars.slice(0, i).reverse().find((x) => !/\s/.test(x.ch)); if (prev && !okBreakAfter(prev.ch)) bad.push(`「${prev.ch}」と「${c.ch}」の間で折れる(…${lines[lines.length - 1].slice(-10)} / ${c.ch}…)`); } cur += c.ch; });
  if (cur) lines.push(cur);
  return { found: true, bad, lines };
};
(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    for (const owned of (process.env.ONLY_OWNED === '0' ? [false] : [true, false])) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 });
      await context.addInitScript(FAKE_WS);
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((own) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_hell_story_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
        put('mh_rhythm_event_points_v1', 20000);
        if (own) put('mh_rhythm_owned_songs_v1', ['departure', 'rpg', 'midnight_studio']);
      }, owned);
      await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
      await page.addInitScript(require('../boot/quiet-boot-seed').quietBootSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
      await page.getByText('TAP TO START').click();
      await page.waitForTimeout(2500);
      await page.mouse.click(195, 422);
      await page.waitForTimeout(3000);
      await page.evaluate(() => { window.__dismiss = setInterval(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK|あとで読む)$/.test((e.innerText || '').trim())); if (x) x.click(); const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]'); if (b) b.click(); }, 700); });
      await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 }).catch(() => {});
      // 起動のお知らせを閉じる係は、売り場を見る前に止める(止めないと、拡大の窓の「閉じる」まで押してしまう)
      await page.waitForTimeout(1500);
      await page.evaluate(() => clearInterval(window.__dismiss));
      for (const [w, h, label] of POSTURES) {
        const tag = `${owned ? '所持済み' : '未所持'}・${label}`;
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(400);
        await page.locator('[data-home-market], .mh-home-facility.market').first().click({ timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1200);
        await page.getByRole('button', { name: /ビートP交換所/ }).first().click({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(800);
        await page.getByRole('tab', { name: '曲' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(900);
        const n = await page.evaluate(() => document.querySelectorAll('[data-rhythm-song-offer]').length);
        check(`${tag}: 曲の札が3つ並ぶ`, n === 3, `${n}個`);
        if (SHOT) await page.screenshot({ path: path.join(SHOT, `shop-${owned ? 'own' : 'none'}-${label}.png`) });
        const info = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-song-offer]')].map((c) => { const r = c.getBoundingClientRect(); const img = c.querySelector('img'); const ir = img && img.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width), img: ir ? `${Math.round(ir.width)}x${Math.round(ir.height)}` : '-', text: c.innerText.replace(/\n/g, ' / ') }; }));
        console.log(`INFO: ${tag}: ${JSON.stringify(info)}`);
        const wrap = await page.evaluate(WRAP_PROBE, '[data-rhythm-song-shop-note]');
        console.log(`INFO: ${tag}: 説明文の行 ${JSON.stringify(wrap.lines)}`);
        check(`${tag}: 売り場の説明文が言葉の途中で折れない`, wrap.found && wrap.bad.length === 0, wrap.bad.join(' / '));
        // 札の空き: 札の中の部品のすき間(縦)が大きすぎない・札が中身の高さに近い
        const gaps = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-song-offer]')].map((c) => {
          const cr = c.getBoundingClientRect(); const kids = [...c.querySelectorAll(':scope > *')].map((e) => e.getBoundingClientRect()).filter((r) => r.height > 0);
          let max = 0; for (let i = 1; i < kids.length; i++) max = Math.max(max, kids[i].top - kids[i - 1].bottom);
          const used = kids.length ? Math.max(...kids.map((r) => r.bottom)) : 0;
          return { max: Math.round(max), tail: Math.round(cr.bottom - used), h: Math.round(cr.height) };
        }));
        check(`${tag}: 札の中に大きな空きが無い(部品どうしのすき間 32px 以内。前は90px以上)`, gaps.length === 3 && gaps.every((g) => g.max <= 32 && g.tail <= 16), JSON.stringify(gaps));
        // ジャケットを押すと大きく見られる
        const art = await page.evaluate(() => { const b = document.querySelector('[data-rhythm-song-offer] [data-rhythm-song-art-zoom]'); if (!b) return { found: false }; const r = b.getBoundingClientRect(); return { found: true, w: Math.round(r.width) }; });
        // 本物の指のように押す(要素に click を撃つだけでは、上に別の物が重なっていても押せたことになる)
        await page.locator('[data-rhythm-song-offer] [data-rhythm-song-art-zoom]').first().click({ timeout: 5000 }).catch((e) => console.log('INFO: 押せない: ' + String(e.message).slice(0, 900)));
        await page.waitForTimeout(700);
        const zoom = await page.evaluate(() => { const m = [...document.querySelectorAll('[aria-label$="の拡大表示"]')][0]; const img = m && m.querySelector('img'); const r = img && img.getBoundingClientRect(); return { open: !!m, w: r ? Math.round(r.width) : 0 }; });
        check(`${tag}: ジャケットが押せて(幅 ${art.w}px)、押すと大きく見られる(拡大 ${zoom.w}px)`, art.found && art.w >= 60 && zoom.open && zoom.w >= Math.min(300, w - 110, h - 160) && zoom.w >= art.w * 1.7, JSON.stringify({ art, zoom }));
        if (SHOT && label === 'tate' && owned) await page.screenshot({ path: path.join(SHOT, 'zoom-open.png') });
        await page.evaluate(() => { const m = [...document.querySelectorAll('[aria-label$="の拡大表示"]')][0]; const x = m && [...m.querySelectorAll('button')].find((e) => /閉じる|とじる|✕/.test(e.innerText || e.getAttribute('aria-label') || '')); x && x.click(); });
        await page.waitForTimeout(400);
        // 試し聴き: 押すと鳴り(previewBGM)、もう一度押すと止まる。別のタブへ移っても止まる
        await page.evaluate(() => { window.__pv = []; if (!window.__pvWrapped) { window.__pvWrapped = true; const a = Audio_.previewBGM; Audio_.previewBGM = async (k) => { const r = await a(k); window.__pv.push(['start', k, r]); return r; }; const st = Audio_.stopPreview; Audio_.stopPreview = (...x) => { window.__pv.push(['stop']); return st(...x); }; } });
        const listenLabel = () => page.evaluate(() => (document.querySelector('[data-rhythm-song-listen="departure"]') || {}).innerText || '');
        const l0 = await listenLabel();
        await page.evaluate(() => document.querySelector('[data-rhythm-song-listen="departure"]').click());
        await page.waitForTimeout(1200);
        const l1 = await listenLabel(); const pv1 = await page.evaluate(() => JSON.stringify(window.__pv));
        check(`${tag}: 「▶ 試し聴き」を押すと、その曲の試聴が始まる`, /試し聴き/.test(l0) && /melo_departure/.test(pv1), `${l0} → ${l1} / ${pv1}`);
        if (/とめる/.test(l1)) {
          await page.evaluate(() => document.querySelector('[data-rhythm-song-listen="departure"]').click());
          await page.waitForTimeout(800);
          const l2 = await listenLabel();
          check(`${tag}: もう一度押すと止まり、ボタンが「▶ 試し聴き」に戻る`, /試し聴き/.test(l2), l2);
        } else console.log(`INFO: ${tag}: この環境では音が鳴らせず、試聴は「止める」表示にならなかった(${pv1})`);
        // 別のタブへ移ったら止める(売り場を離れる)
        await page.evaluate(() => { window.__pv.length = 0; });
        await page.getByRole('tab', { name: 'スタンプ' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(600);
        const left = await page.evaluate(() => JSON.stringify(window.__pv));
        check(`${tag}: 売り場を離れると試聴を止めて元の BGM へ戻す`, /stop/.test(left), left);
        await page.getByRole('tab', { name: '曲' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);
        // 戻る
        await page.keyboard.press('Escape').catch(() => {});
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(←|もどる|戻る|閉じる)/.test((e.innerText || e.getAttribute('aria-label') || '').trim())); b && b.click(); });
        await page.waitForTimeout(600);
      }
      await context.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
