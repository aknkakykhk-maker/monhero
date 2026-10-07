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
    // 回転(端末は縦のまま、アプリが画面を90度回して横長に描く)も測る。向きの指定が縦画面のほうへ効くので、崩れ方が違う
    for (const [w, h, rotated] of [[390, 844], [375, 667], [844, 390], [667, 375], [750, 370], [390, 716, true], [375, 667, true]]) {
      await A.setViewportSize({ width: w, height: h });
      await A.evaluate((on) => RHYTHM_VIEW_ROTATION.set(on ? 90 : 0), !!rotated);
      await A.waitForTimeout(rotated ? 900 : 500);
      if (rotated) await A.screenshot({ path: `/tmp/claude-0/shots/X-mode-rot-${w}x${h}.png` }).catch(() => {});
      const out = await overflowing(A, '[data-rhythm-mode-select]');
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: ボタンや入力欄が画面の外へはみ出さない`, out.length === 0, out.join(' / '));
      // プライベートルームは押すと開くシート。作成・コード・入室がシートに収まる(2026-10-07・2×2のタイルへ組み替えた)
      const tiles = await A.evaluate(() => ['[data-rhythm-mode-solo]', '[data-rhythm-multi-free]', '[data-rhythm-mode-private-open]', '[data-rhythm-mode-ranking]']
        .map((q) => { const el = document.querySelector(q); const r = el && el.getBoundingClientRect(); return { q, ok: !!r && r.width > 40 && r.height > 40 && r.right <= innerWidth + 1 && r.left >= -1 }; })
        .filter((x) => !x.ok).map((x) => x.q));
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: ソロ・フリー・プライベート・ランキングの4つのタイルが画面に収まる`, tiles.length === 0, tiles.join(' / '));
      // 4つのタイルは、絵と文字の並び方(向き・そろえ)が同じ。プライベートとランキングだけ横画面の指定が抜けて、
      // 文字が絵と重なって左上に寄った(2026-10-07・ユーザー報告「プライベートとランキングの文字位置がおかしい」)
      const flows = await A.evaluate(() => ['[data-rhythm-mode-solo]', '[data-rhythm-multi-free]', '[data-rhythm-mode-private-open]', '[data-rhythm-mode-ranking]']
        .map((q) => { const el = document.querySelector(q); const c = el && getComputedStyle(el); return c ? `${c.flexDirection}/${c.alignItems}` : 'なし'; }));
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: 4つのタイルの絵と文字の並び方がそろっている`, new Set(flows).size === 1 && !flows.includes('なし'), flows.join(' | '));
      await A.locator('[data-rhythm-mode-private-open]').click();
      await A.waitForSelector('[data-rhythm-mode-private-sheet]', { timeout: 5000 });
      const box = await A.evaluate(() => {
        const sec = document.querySelector('[data-rhythm-mode-private-sheet]');
        if (!sec) return { ok: false, why: 'プライベートルームのシートが無い' };
        const s = sec.getBoundingClientRect();
        const bad = [...sec.querySelectorAll('button,input')].filter((el) => { const r = el.getBoundingClientRect(); return r.right > s.right + 1 || r.left < s.left - 1; }).map((el) => el.innerText || 'コード');
        return { ok: bad.length === 0 && s.right <= innerWidth + 1, why: bad.join(' / ') };
      });
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: 「部屋をつくる」・コード・「入室」がプライベートルームのシートに収まる`, box.ok, box.why);
      await A.locator('[data-rhythm-mode-private-sheet] button[aria-label="閉じる"]').first().click({ force: true }).catch(() => {});
      await A.waitForTimeout(150);
      const line = await A.evaluate(() => {
        const p = document.querySelector('[data-rhythm-mode-assistant-line]');
        const panel = document.querySelector('[data-rhythm-mode-assistant]');
        if (!p || !panel) return false;
        const a = p.getBoundingClientRect(); const b = panel.getBoundingClientRect();
        return a.top >= b.top - 1 && a.bottom <= b.bottom + 1 && a.height > 0;
      });
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: 助手の吹き出しが立ち絵の枠の中に出る`, line);
      // ★立ち絵とコメントは重ならない(コメントは絵の下に出る。2026-10-04・ユーザー指摘「助手コメントが助手に被ってる」)
      const apart = await A.evaluate(() => {
        const art = document.querySelector('[data-rhythm-mode-assistant-art-box]');
        const bubble = document.querySelector('[data-rhythm-mode-assistant-line]');
        if (!art || !bubble) return '(絵かコメントが無い)';
        // 四角どうしが交わらないこと(回転中は「下」が画面の左右になるので、上下だけでは比べられない)
        const a = art.getBoundingClientRect(); const b = bubble.getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left); const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return w > 1 && h > 1 ? `コメントが絵に重なっている(重なり ${Math.round(w)}×${Math.round(h)}px)` : '';
      });
      check(`モードえらび ${rotated ? `回転(${w}×${h})` : `${w}×${h}`}: 助手のコメントが立ち絵に重ならない`, apart === '', apart);
    }
    // 回転は、端末が縦の大きさのうちに戻す(横の大きさで戻すと、戻ったことにならないことがある)
    await A.setViewportSize({ width: 390, height: 844 });
    await A.evaluate(() => RHYTHM_VIEW_ROTATION.set(0));
    await A.waitForFunction(() => document.querySelector('[data-mh-view-rotation]')?.getAttribute('data-mh-view-rotation') !== 'true', null, { timeout: 5000 }).catch(() => {});
    await A.waitForTimeout(500);
    check('回転を戻せる(以降は回転なしで測る)', await A.evaluate(() => document.querySelector('[data-mh-view-rotation]')?.getAttribute('data-mh-view-rotation') !== 'true'));
    await A.setViewportSize({ width: 844, height: 390 });
    await A.waitForTimeout(500);
    // 立ち絵の枠は縦画面で狭くしない(2026-10-04・ユーザー指摘「立絵エリアがせまくなってる / デフォでもっとでかくしたい」)。
    // コメントを絵の下へ出したあと、画面の高さの半分より低くなった
    await A.setViewportSize({ width: 390, height: 844 });
    await A.waitForTimeout(500);
    const artH = await A.evaluate(() => { const e = document.querySelector('[data-rhythm-mode-assistant-art-box]'); return e ? Math.round(e.getBoundingClientRect().height) : 0; });
    check('縦画面(390×844)で、立ち絵の枠が画面の高さの半分以上ある', artH >= 422, `${artH}px / 画面844px`);
    // 助手のオン・オフ(立ち絵とコメントを別々に。両方オフで枠ごと消える。2026-10-04・ユーザー指示)
    await A.waitForTimeout(100);
    const has = (sel) => A.evaluate((q) => !!document.querySelector(q), sel);
    await A.locator('[data-rhythm-mode-toggle-comment]').click();
    check('コメントをオフにすると、絵だけが残る', (await has('[data-rhythm-mode-assistant-art-box]')) && !(await has('[data-rhythm-mode-assistant-line]')));
    await A.locator('[data-rhythm-mode-toggle-comment]').click();
    await A.locator('[data-rhythm-mode-toggle-art]').click();
    check('立ち絵をオフにすると、コメントだけが残る', !(await has('[data-rhythm-mode-assistant-art-box]')) && (await has('[data-rhythm-mode-assistant-line]')));
    await A.locator('[data-rhythm-mode-toggle-comment]').click();
    check('両方オフにすると、助手の枠ごと消える(切り替えの札は残る)', !(await has('[data-rhythm-mode-assistant]')) && (await has('[data-rhythm-mode-assistant-toggles]')));
    const offOut = await overflowing(A, '[data-rhythm-mode-select]');
    check('両方オフでも、ボタンが画面の外へはみ出さない', offOut.length === 0, offOut.join(' / '));
    // 立ち絵オフは上に詰めない(縦の真ん中にそろえる。2026-10-04・ユーザー指摘「立絵オフは上詰めでよくない」)
    const gaps = await A.evaluate(() => {
      const first = document.querySelector('[data-rhythm-mode-assistant-toggles]');
      const last = document.querySelector('[data-rhythm-mode-options]');
      const head = document.querySelector('[data-rhythm-mode-select] header');
      if (!first || !last || !head) return null;
      const top = first.getBoundingClientRect().top - head.getBoundingClientRect().bottom;
      const bottom = window.innerHeight - last.getBoundingClientRect().bottom;
      return { top: Math.round(top), bottom: Math.round(bottom) };
    });
    check('立ち絵もコメントもオフのとき、ボタンが縦の真ん中にそろう(上に詰めない)', !!gaps && Math.abs(gaps.top - gaps.bottom) <= 60 && gaps.top >= 100, gaps ? `上${gaps.top}px / 下${gaps.bottom}px` : '測れない');
    await A.locator('[data-rhythm-mode-toggle-art]').click();
    await A.locator('[data-rhythm-mode-toggle-comment]').click();
    check('もう一度オンにすると、絵もコメントも戻る', (await has('[data-rhythm-mode-assistant-art-box]')) && (await has('[data-rhythm-mode-assistant-line]')));
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
    await A.locator('[data-rhythm-mode-private-open]').click();
    await A.locator('[data-rhythm-multi-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-mode-private-open]').click();
    await B.locator('[data-rhythm-multi-code-input]').fill(code);
    await B.locator('[data-rhythm-multi-join]').click();
    await A.waitForFunction(() => typeof RHYTHM_MULTI !== "undefined" && RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2, null, { timeout: 20000 });
    check('偽の通信で、2人が同じ部屋に入れる', true, code);
    await A.locator('[data-rhythm-multi-confirm]').click();
    const step = (p) => p.evaluate(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') || '');
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 15000 });
    // 部屋の中のヘッダーに全国ランキングのボタンがある(2026-10-04・ユーザー指示「マルチ中にもランキングボタンいれて」)
    check('選曲の画面に、全国ランキングのボタンがある', await A.evaluate(() => !!document.querySelector('[data-rhythm-multi-ranking]')));
    await A.locator('[data-rhythm-demo-start]').click();
    await B.waitForSelector('[data-rhythm-multi-omakase]', { timeout: 15000 });
    await B.locator('[data-rhythm-multi-omakase]').click();
    await A.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 });
    await B.waitForSelector('[data-rhythm-multi-ready]', { timeout: 20000 });
    check('難易度えらびの画面に、全国ランキングのボタンがある', await A.evaluate(() => !!document.querySelector('[data-rhythm-multi-ranking]')));
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
    // ★「回転」は、端末は縦(390×844)のまま、アプリが画面を90度回して横長に描いている状態(RHYTHM_VIEW_ROTATION)。
    //   端末の向きは縦のままなので、`portrait:` や `max-height` の指定は縦画面のほうが効いてしまう。
    //   実機(iPhone)の「横」ボタンがこの状態で、結果画面のカードが切れたのは、ここだった(2026-10-04・ユーザー報告「画面切れしてる」)
    for (const [w, h, rotated] of [[750, 370], [844, 390], [667, 375], [390, 844], [390, 716, true], [390, 844, true], [375, 667, true]]) {
      await A.setViewportSize({ width: w, height: h });
      await A.evaluate((on) => RHYTHM_VIEW_ROTATION.set(on ? 90 : 0), !!rotated);
      await A.waitForTimeout(rotated ? 1000 : 600);
      const label = rotated ? `回転(${w}×${h}を横に回す)` : `${w}×${h}`;
      const rows = await A.evaluate(() => [...document.querySelectorAll('[data-rhythm-multi-result-row]')].map((row) => {
        const box = row.getBoundingClientRect();
        // カードの中で見えているべきもの: アイコン・名前・スコア・難易度
        const parts = [...row.children].filter((el) => !el.hasAttribute('data-rhythm-multi-chat-bubble') && getComputedStyle(el).position !== 'absolute');
        // ★上下だけでなく左右も見る。回転中は、見た目の左右がカードの上下になる(以前は上下だけ見ていて、回転中の切れを見逃した)
        const cut = parts.filter((el) => { const r = el.getBoundingClientRect(); return r.height > 0 && r.width > 0 && (r.top < box.top - 1 || r.bottom > box.bottom + 1 || r.left < box.left - 1 || r.right > box.right + 1 || Math.min(r.width, r.height) < 6); })
          .map((el) => (el.innerText || 'アイコン').trim().slice(0, 10));
        return { name: (row.innerText || '').split('\n')[0], cut };
      }));
      const cut = rows.filter((r) => r.cut.length);
      check(`結果画面 ${label}: カードのアイコン・名前・スコア・難易度が切れない`, rows.length === 2 && cut.length === 0,
        cut.map((r) => `${r.name}: ${r.cut.join('・')}`).join(' / ') || `${rows.length}枚`);
      const mvp = await A.evaluate(() => {
        const b = document.querySelector('[data-rhythm-multi-mvp]');
        if (!b) return 'MVPの札が無い';
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return top && (top === b || b.contains(top)) ? '' : `札の上に ${top ? top.tagName : '何もない'} が重なっている`;
      });
      check(`結果画面 ${label}: MVPの札がアイコンより前に見えている`, mvp === '', mvp);
      const out = await overflowing(A, '[data-rhythm-multi]');
      check(`結果画面 ${label}: ボタンが画面の外へはみ出さない`, out.length === 0, out.join(' / '));
      // 結果画面から全国ランキングを開く: 対戦の画面の上へ重なり(画面は移らない)、戻ると閉じて結果画面へ戻る
      if (w === 750 || rotated) {
        const hasBtn = await A.evaluate(() => !!document.querySelector('[data-rhythm-multi-result-chat] [data-rhythm-multi-ranking]'));
        check(`結果画面 ${label}: 全国ランキングのボタンがある`, hasBtn);
        await A.locator('[data-rhythm-multi-result-chat] [data-rhythm-multi-ranking]').click().catch(() => {});
        await A.waitForTimeout(700);
        const layer = await A.evaluate(() => {
          const l = document.querySelector('[data-rhythm-multi-ranking-layer]');
          const main = document.querySelector('[data-rhythm-multi]');
          if (!l || !l.querySelector('[data-rhythm-ranking]')) return 'ランキングが出ない';
          const a = l.getBoundingClientRect(); const b = main.getBoundingClientRect();
          return a.width >= b.width - 2 && a.height >= b.height - 2 ? '' : `ランキングの重なりが部屋の画面より小さい(${Math.round(a.width)}×${Math.round(a.height)} / ${Math.round(b.width)}×${Math.round(b.height)})`;
        });
        check(`結果画面 ${label}: 全国ランキングが対戦の画面の上へ重なって出る`, layer === '', layer);
        const stillRoom = await A.evaluate(() => typeof RHYTHM_MULTI !== 'undefined' && !!RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2);
        check(`結果画面 ${label}: ランキングを開いても部屋にいる`, stillRoom);
        await A.evaluate(() => document.querySelector('[data-rhythm-multi-ranking-layer] button[aria-label="戻る"]')?.click());
        await A.waitForTimeout(500);
        check(`結果画面 ${label}: ランキングの戻るで閉じて、結果画面へ戻る`, await A.evaluate(() => !document.querySelector('[data-rhythm-multi-ranking-layer]') && !!document.querySelector('[data-rhythm-multi-result-row]')));
      }
      if (w > h || rotated) {
        // 回転中は、見た目の上下が画面の左右になる。段の数えかたは「見た目の横方向に直す前の、上下の位置」の種類数
        const stampRows = await A.evaluate((rot) => {
          const bar = document.querySelector('[data-rhythm-multi-result-chat] [data-rhythm-multi-stamps]');
          if (!bar) return -1;
          const key = rot ? 'left' : 'top';
          return new Set([...bar.querySelectorAll('[data-rhythm-multi-chat-stamp]')].map((b) => Math.round(b.getBoundingClientRect()[key]))).size;
        }, !!rotated);
        check(`結果画面 ${label}: 横長のときの定型文は1列(2段にならない)`, stampRows === 1, `${stampRows}段`);
      }
    }
    await A.evaluate(() => RHYTHM_VIEW_ROTATION.set(0));
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
