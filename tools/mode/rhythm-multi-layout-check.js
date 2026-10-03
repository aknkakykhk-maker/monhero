// モンヒロビートの「モードえらび」と「みんなで対戦の結果画面」の配置を、実際に開いて測る(2026-10-03)。
//
//   node tools/mode/rhythm-multi-layout-check.js
//
// 2026-10-03・ユーザー指示「配置関係の検査して」。ほかの配置の検査はこの2画面を測っていなかった。
// この日に実際に踏んだ崩れを見張る:
//   ・モードえらびの縦画面で、ルームコードの欄が右へはみ出して「入室」が切れた(ユーザー報告「サイズ感悪い」)
//   ・ももすけの立ち絵の枠に、絵のかけらが見えた(体の真ん中に合わせて切り出す枠 RHYTHM_MODE_ASSISTANT_FRAMES)
//   ・結果画面で、実機の横画面(切り欠き・ホームバーで狭い)だと定型文が2段になり、カードが押しつぶされて
//     アイコンと難易度が切れた(ユーザー報告「結果画面のアイコンとか難易度が切れてる」)
//   ・MVPの札がアイコンの後ろに隠れた(ユーザー報告「MVPが裏に回ってる」)
//
// ★外へはつながない。WebSocket を偽物に差し替え、同じブラウザの2つのページのあいだを BroadcastChannel で中継する
//   (Supabase Realtime の Broadcast を、部屋の仕組みが使うぶんだけ真似る。tools/mode/rhythm-multi-check.js と同じ考え方)。
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
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

// ページの中の偽の WebSocket。部屋(topic)ごとに BroadcastChannel で同じブラウザのほかのページへ届ける。
// Realtime は自分が送ったものも返ってくる(self:true)ので、自分にも返す
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

// 画面の中で、ボタンや入力欄が画面の外へはみ出していないか
const overflowing = (page, rootSel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return ['(画面が見つからない)'];
  return [...root.querySelectorAll('button,input')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1 || r.bottom > window.innerHeight + 1);
  }).map((el) => (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 12));
}, rootSel);

(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await context.addInitScript(FAKE_WS);
  const errors = [];
  const open = async (name) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.addInitScript((nm) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', nm); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
    }, name);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await page.getByText('TAP TO START').click();
    await page.waitForTimeout(2500);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(3000);
    // お知らせ・ギフトなどの吹き出しは閉じ続ける
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /受け取|閉じる|とじる|OK|はじめる|わかった|^次へ|あとで|見た/.test(x.innerText)); if (b) b.click(); }, 250); });
    await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button.mh-home-facility.rhythm').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  try {
    const A = await open('あ');

    // ===== ① モードえらび =====
    for (const [w, h] of [[390, 844], [375, 667], [844, 390], [667, 375], [750, 370]]) {
      await A.setViewportSize({ width: w, height: h });
      await A.waitForTimeout(500);
      const out = await overflowing(A, '[data-rhythm-mode-select]');
      check(`モードえらび ${w}×${h}: ボタンや入力欄が画面の外へはみ出さない`, out.length === 0, out.join(' / '));
      const box = await A.evaluate(() => {
        const sec = document.querySelector('[data-rhythm-mode-private]');
        if (!sec) return { ok: false, why: 'プライベートルームの欄が無い' };
        const s = sec.getBoundingClientRect();
        const bad = [...sec.querySelectorAll('button,input')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > s.right + 1 || r.left < s.left - 1; }).map((el) => el.innerText || 'コード');
        return { ok: bad.length === 0, why: bad.join(' / ') };
      });
      check(`モードえらび ${w}×${h}: 「作成」・コード・「入室」がプライベートルームの欄に収まる`, box.ok, box.why);
      const line = await A.evaluate(() => {
        const p = document.querySelector('[data-rhythm-mode-assistant-line]');
        const panel = document.querySelector('[data-rhythm-mode-assistant]');
        if (!p || !panel) return false;
        const a = p.getBoundingClientRect(); const b = panel.getBoundingClientRect();
        return a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.height > 0;
      });
      check(`モードえらび ${w}×${h}: 助手の吹き出しが立ち絵の枠の中に出る`, line);
    }
    // ももすけの絵は、表情ごとに体の真ん中へ合わせて広げる(かけらを枠の外へ出す)
    const art = await A.evaluate(() => {
      const img = document.querySelector('[data-rhythm-mode-assistant-art]');
      return img ? { src: img.getAttribute('src') || '', style: img.getAttribute('style') || '' } : null;
    });
    check('モードえらび: ももすけの立ち絵は、表情ごとの切り出し位置で広げて出す', !!art && /momosuke_/.test(art.src) && /translate\(-\d/.test(art.style) && /width: 150%/.test(art.style),
      art ? `${art.src.split('/').pop()} ${art.style.slice(0, 60)}` : '絵が無い');

    // ===== ② 2人でライブを終えて、結果画面へ =====
    await A.setViewportSize({ width: 844, height: 390 });
    const B = await open('い');
    await A.locator('[data-rhythm-multi-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-multi-code-input]').fill(code);
    await B.locator('[data-rhythm-multi-join]').click();
    await A.waitForFunction(() => typeof RHYTHM_MULTI !== "undefined" && RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2, null, { timeout: 20000 });
    check('偽の通信で、2人が同じ部屋に入れる', true, code);
    await A.locator('[data-rhythm-multi-confirm]').click();
    const step = (p) => p.evaluate(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') || '');
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 15000 });
    await A.locator('[data-rhythm-demo-start]').click();
    await B.waitForSelector('[data-rhythm-multi-omakase]', { timeout: 15000 });
    await B.locator('[data-rhythm-multi-omakase]').click();
    await A.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 });
    await B.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 });
    await A.locator('[data-rhythm-multi-ready]').click();
    await B.locator('[data-rhythm-multi-ready]').click();
    await A.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await B.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    const round = await A.evaluate(() => RHYTHM_MULTI.view().room.round);
    await A.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 912345, cleared: true, fullCombo: true, maxCombo: 231, judgments: { MARVELOUS: 180, EXCELLENT: 40, GREAT: 11, GOOD: 0, BAD: 0, MISS: 0 }, fast: 12, slow: 7 }, false, { diffId: 'MASTER' }), round);
    await B.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 640000, cleared: true, maxCombo: 120, judgments: { MARVELOUS: 90, EXCELLENT: 80, GREAT: 30, GOOD: 10, BAD: 5, MISS: 16 }, fast: 30, slow: 25 }, false, { diffId: 'EXPERT' }), round);
    // 演奏の画面からポーズ→「やめる」で抜ける。演奏の始まりの演出中は効かないことがあるので、抜けるまで数回くり返す
    for (const p of [A, B]) {
      for (let i = 0; i < 6; i += 1) {
        if (!(await p.evaluate(() => !!document.querySelector('[data-rhythm-play-area]')))) break;
        await p.evaluate(() => document.querySelector('[data-rhythm-pause]')?.click());
        await p.waitForTimeout(700);
        await p.locator('[data-rhythm-pause-exit]').click({ force: true, timeout: 3000 }).catch(() => {});
        await p.waitForTimeout(1200);
      }
    }
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'result', null, { timeout: 30000 })
      .catch(async () => { throw new Error(`結果画面へ進まない(あ=${await step(A) || 'なし'} / い=${await step(B) || 'なし'} / あの段=${await A.evaluate(() => (typeof RHYTHM_MULTI !== 'undefined' && RHYTHM_MULTI.view() ? RHYTHM_MULTI.view().room.phase : '-'))})`); });
    check('ライブのあと結果画面が出る', (await step(A)) === 'result', await step(A));

    // ===== ③ 結果画面: カードの中身が切れない・MVPの札が前に出る・定型文は横画面で1列 =====
    for (const [w, h] of [[750, 370], [844, 390], [667, 375], [390, 844]]) {
      await A.setViewportSize({ width: w, height: h });
      await A.waitForTimeout(600);
      const rows = await A.evaluate(() => [...document.querySelectorAll('[data-rhythm-multi-result-row]')].map((row) => {
        const box = row.getBoundingClientRect();
        // カードの中で見えているべきもの: アイコン・名前・スコア・難易度
        const parts = [...row.children].filter((el) => !el.hasAttribute('data-rhythm-multi-chat-bubble') && getComputedStyle(el).position !== 'absolute');
        const cut = parts.filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.height < 6); })
          .map((el) => (el.innerText || 'アイコン').trim().slice(0, 10));
        return { name: (row.innerText || '').split('\n')[0], cut };
      }));
      const cut = rows.filter((r) => r.cut.length);
      check(`結果画面 ${w}×${h}: カードのアイコン・名前・スコア・難易度が切れない`, rows.length === 2 && cut.length === 0,
        cut.map((r) => `${r.name}: ${r.cut.join('・')}`).join(' / ') || `${rows.length}枚`);
      const mvp = await A.evaluate(() => {
        const b = document.querySelector('[data-rhythm-multi-mvp]');
        if (!b) return 'MVPの札が無い';
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top && (top === b || b.contains(top)) ? '' : `札の上に ${top ? top.tagName : '何もない'} が重なっている`;
      });
      check(`結果画面 ${w}×${h}: MVPの札がアイコンより前に見えている`, mvp === '', mvp);
      const out = await overflowing(A, '[data-rhythm-multi]');
      check(`結果画面 ${w}×${h}: ボタンが画面の外へはみ出さない`, out.length === 0, out.join(' / '));
      if (w > h) {
        const stampRows = await A.evaluate(() => {
          const bar = document.querySelector('[data-rhythm-multi-result-chat] [data-rhythm-multi-stamps]');
          if (!bar) return -1;
          return new Set([...bar.querySelectorAll('[data-rhythm-multi-chat-stamp]')].map((b) => Math.round(b.getBoundingClientRect().top))).size;
        });
        check(`結果画面 ${w}×${h}: 横画面の定型文は1列(2段にならない)`, stampRows === 1, `${stampRows}段`);
      }
    }
    check('操作中にページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査を最後まで実行できる', false, e && e.message ? e.message.split('\n')[0] : String(e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
