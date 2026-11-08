#!/usr/bin/env node
// マルチの🔄横(縦の端末をアプリが回した表示)などで、助手を呼んだライブの曲えらび・結果の画面が切れないか(2026-11-08)。
//
//   node tools/ui/rhythm-multi-assist-result-check.js
//   SHOT_DIR=<フォルダ> を付けると、曲えらびと結果を撮る
//
// 社長の報告(本番・🔄横・助手4人と5人・Rebellion・MVP は本人):
//   ・結果の MVP の枠で、顔アイコンの上下と「HELL Lv.48」が切れる
//   ・定型のあいさつの列の6つ目が半分だけ見えて切れ、すぐ下の🏆とチャットの「タップで開く」が詰まる
//   ・下の助手の「経験値+◯・セッションLv.UP!」の札と、友情Lv の長い1行が画面の幅にぎりぎり
//   ・曲えらびで、いちばん上の見出しの上に空きができ、全体が下へずれて難易度の数字の列と曲の一覧が端で切れる
// 実際のブラウザで、Realtime を作り物にしてフリーマッチの部屋を作り、助手を4人呼んで1曲終えて確かめる
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
const PORT = 8966;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
// 要素が、その器(回しているときも、器の中の座標)からはみ出していないか。offset 系は回す前の座標なので、回していても上下左右がそのまま比べられる
const MEASURE_LIB = () => {
  window.__mhBox = (el, root) => { let x = 0; let y = 0; let e = el; while (e && e !== root) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { l: x, t: y, r: x + el.offsetWidth, b: y + el.offsetHeight }; };
};
// 曲えらび: 決定のボタンと難易度の列が、部屋の枠(画面)の中に見えている
const measureSelect = (page) => page.evaluate(() => {
  const R = (e) => e && e.getBoundingClientRect();
  const inBox = (a, b) => a && b && a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  const main = R(document.querySelector('[data-rhythm-multi]'));
  const bad = [];
  const play = document.querySelector('[data-rhythm-demo-start]');
  if (!inBox(R(play), main)) bad.push('「この曲で決定」が画面の外');
  // 送れる欄の中にあるものは、欄の見えている所に入っていればよい
  const detail = document.querySelector('[data-rhythm-song-detail]');
  if (play && detail && !inBox(R(play), R(detail))) bad.push('「この曲で決定」が詳しい欄の見えている所の外');
  const diffs = [...document.querySelectorAll('[data-rhythm-difficulty-best]')].map((e) => e.closest('button')).filter(Boolean);
  if (!diffs.length) bad.push('難易度の列が無い');
  return bad.join(' / ');
});
// 四角 a が四角 b の中に入っているか。回していても、画面上の四角どうしで比べれば向きに関係なく言える
const measureResult = (page) => page.evaluate(() => {
  const R = (e) => e && e.getBoundingClientRect();
  const inBox = (a, b) => a && b && a.width > 0 && a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const out = { mvp: [], stamps: [], growth: [] };
  // ① MVP の枠: 顔・名前・点数・難易度が枠の中
  const mvp = document.querySelector('[data-rhythm-multi-mvp]');
  const li = mvp && mvp.closest('[data-rhythm-multi-result-row]');
  if (!li) out.mvp.push('MVP の枠が無い');
  else {
    const box = R(li);
    const face = li.querySelector('img') || li.querySelector('span.rounded-full');
    if (!inBox(R(face), box)) out.mvp.push('顔が枠で切れる');
    li.querySelectorAll('small, b').forEach((e) => { if (e === mvp || !e.innerText.trim()) return; if (!inBox(R(e), box)) out.mvp.push(`「${e.innerText.trim().slice(0, 10)}」が枠で切れる`); });
  }
  // ② 定型のあいさつ: 6つとも列の中に見え、🏆・チャットと重ならない
  const bar = document.querySelector('[data-rhythm-multi-result-chat] [data-rhythm-multi-stamps]');
  const stamps = bar ? [...bar.querySelectorAll('[data-rhythm-multi-chat-stamp]')] : [];
  if (stamps.length !== 6) out.stamps.push(`あいさつが${stamps.length}つ`);
  stamps.forEach((b) => { if (!inBox(R(b), R(bar))) out.stamps.push(`「${b.innerText}」が切れる`); });
  ['[data-rhythm-multi-result-chat] [data-rhythm-multi-ranking]', '[data-rhythm-multi-result-chat] [data-rhythm-multi-chat-open]'].forEach((q) => {
    const e = document.querySelector(q); if (!e) return;
    if (stamps.some((b) => hit(R(b), R(e)))) out.stamps.push(`${q.includes('ranking') ? '🏆' : 'チャット'}があいさつに重なる`);
  });
  // ③ 育ちの札・友情Lv の行: 画面(部屋の枠)の幅からはみ出さない
  const main = document.querySelector('[data-rhythm-multi]');
  document.querySelectorAll('[data-rhythm-buddy-growth-list] > *').forEach((e) => {
    const a = R(e); const m = R(main);
    const side = a.left < m.left - 1 || a.right > m.right + 1;
    const rot = document.querySelector('[data-mh-view-rotation="true"]');
    // 回しているときは画面の上下が枠の左右にあたる
    const sideRot = a.top < m.top - 1 || a.bottom > m.bottom + 1;
    if (rot ? sideRot : side) out.growth.push(`「${e.innerText.trim().slice(0, 12)}」がはみ出す`);
    if (e.scrollWidth > e.clientWidth + 1) out.growth.push(`「${e.innerText.trim().slice(0, 12)}」の中身が切れる`);
  });
  // ⑤ カードの上の吹き出しが、送る欄で切れていない(横向きは欄が切らない作り)
  const body = document.querySelector('[data-rhythm-multi-result-body]');
  if (body && getComputedStyle(body).overflowY !== 'visible') document.querySelectorAll('[data-rhythm-multi-result-bubble]').forEach((b) => { if (!inBox(R(b), R(body))) out.mvp.push(`吹き出し「${b.innerText.trim().slice(0, 8)}」が欄で切れる`); });
  // ④ いちばん下の「メンバーの成績」「次へ」が部屋の枠の中に見える(押し出されない)
  ['[data-rhythm-multi-member-stats]', '[data-rhythm-multi-result-next]'].forEach((q) => { const e = document.querySelector(q); if (!inBox(R(e), R(main))) out.growth.push(`${q.includes('next') ? '「次へ」' : '「メンバーの成績」'}が画面の外`); });
  return { mvp: out.mvp.join(' / '), stamps: out.stamps.join(' / '), growth: out.growth.join(' / ') };
});
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [w, h, rot, name] of [[390, 664, true, 'rot-iphone'], [390, 844, true, 'rot'], [375, 667, true, 'rot-se'], [390, 844, false, 'tate'], [844, 390, false, 'yoko'], [320, 568, false, 'small']]) {
      if (process.env.ONLY && process.env.ONLY !== name) continue;
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      // iPhone の切り欠き(上 59px・ホームバー 34px)を入れて測る(env() は作れないので、index.html の --mh-safe-* で差し替える)
      //   端末を横に持ったとき(yoko)は、切り欠きが左右・ホームバーが下に来て、上は0(実機と同じ向きで入れる)
      await page.addInitScript((land) => { document.addEventListener('DOMContentLoaded', () => { const r = document.documentElement.style; const v = land ? { top: '0px', bottom: '21px', left: '47px', right: '47px' } : { top: '59px', bottom: '34px', left: '0px', right: '0px' }; Object.entries(v).forEach(([k, x]) => r.setProperty(`--mh-safe-${k}`, x)); }); }, w > h);
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      // 偽の Realtime。本物は自分の送った知らせも返す(self:true)ので、ここでも返す(返さないと部屋主が自分の「ライブ開始」を受け取れず、演奏が始まらない)
      await page.addInitScript(() => { class FakeWS { constructor() { this.readyState = 0; this.topic = null; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 0); } deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); } send(raw) { let m = null; try { m = JSON.parse(raw); } catch (_) { return; } if (m.event === 'phx_join') { this.topic = m.topic; this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } }); return; } if (m.event !== 'broadcast') return; this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: m.payload && m.payload.payload } }); } close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); } } window.WebSocket = FakeWS; });
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(300); }
      await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /モンヒロビート/.test(e.innerText || '')); x && x.click(); });
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
      await page.waitForTimeout(800);
      if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free]').click());
      await page.waitForTimeout(800);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free-create]').click());
      await page.waitForSelector('[data-rhythm-multi-step="matching"]', { timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { for (const id of ['erubin', 'kiki', 'momosuke']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { for (const id of ['atsu', 'dra', 'erubin', 'kiki']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2000);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-confirm]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 20000 });
      await page.waitForTimeout(1500);
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `select-${name}.png`) }); }
      const sel = await measureSelect(page);
      check(`${name}: 曲えらびの上に空きが無く、下の難易度の列と曲の一覧が切れない`, sel === '', sel);
      await page.locator('[data-rhythm-multi-omakase]').click({ force: true, timeout: 15000 });
      // 難易度えらび(ready の段)になってから「準備OK」を押す。早く押すと効かず、自分ぬきでライブが始まった
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'ready' && document.querySelector('[data-rhythm-multi-ready]'), null, { timeout: 90000 });
      await page.waitForTimeout(500);
      await page.locator('[data-rhythm-multi-ready]').click({ force: true, timeout: 15000 });
      // ライブが始まり、演奏の画面へ入ったら、自分の結果を知らせる。助手の結果もそこで出る
      await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]'), null, { timeout: 90000 });
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
      // 助手(CPU)の結果がそろうまで待つ(そろうと MVP・育ちの札・友情Lv が出る)
      const all = await page.waitForFunction(() => { const v = RHYTHM_MULTI.view(); return v && v.members.every((m) => m.res && m.res.startId === v.room.round); }, null, { timeout: 60000 }).then(() => true).catch(() => false);
      if (!all) console.log('INFO: ' + await page.evaluate(() => { const v = RHYTHM_MULTI.view(); return JSON.stringify(v.members.map((m) => ({ n: m.name, cpu: !!m.cpu, playing: m.playing, res: !!m.res }))); }));
      check(`${name}: 助手の結果もそろう`, all);
      await page.waitForTimeout(4000);
      if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `result-${name}.png`) });
      const res = await measureResult(page);
      check(`${name}: 結果の MVP の枠で顔と難易度が切れない`, res.mvp === '', res.mvp);
      check(`${name}: 定型のあいさつが切れずに並び、🏆・チャットと重ならない`, res.stamps === '', res.stamps);
      check(`${name}: 助手の育ちの札・友情Lv の行がはみ出さず、下の「次へ」も画面の中`, res.growth === '', res.growth);
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
