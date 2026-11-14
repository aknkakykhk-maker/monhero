#!/usr/bin/env node
// マルチの曲えらびの画面が、縦・ふつうの横・🔄横の全部で、吹き出しも「この曲で決定」も切れず重ならないかを、本物の画面で見張る(2026-11-14・社長の止め絵)。
//
//   node tools/ui/rhythm-multi-select-fit-check.js
//   ONLY=<名前> で1つの姿勢だけ。SHOT_DIR=<フォルダ> で撮った絵を残す
//
// 見ること(助手を呼んで、助手が話しているあいだの曲えらび):
//   ① 席の上の吹き出し(data-rhythm-multi-chat-bubble)の文字が、白い吹き出しの中に収まる(2行目が吹き出しの下へはみ出して切れない)
//   ② 「この曲で決定」の帯が、難易度の札(EASY〜HELL)に重ならない(縦・横・🔄横・小さい横)
//   ③ 「この曲で決定」が画面(部屋の枠)の中に見えている

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
const PORT = 9321;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const POSTURES = [
  ['tate-390', 390, 844, false, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['tate-320', 320, 568, false, { top: 20, bottom: 0, left: 0, right: 0 }],
  ['rot-320', 320, 568, true, { top: 20, bottom: 0, left: 0, right: 0 }],
  ['yoko-844', 844, 390, false, { top: 0, bottom: 21, left: 47, right: 47 }],
  ['yoko-667', 667, 375, false, { top: 0, bottom: 21, left: 47, right: 47 }],
  ['rot-390', 390, 844, true, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['rot-430', 430, 932, true, { top: 59, bottom: 34, left: 0, right: 0 }],
  ['rot-safari', 390, 664, true, { top: 0, bottom: 0, left: 0, right: 0 }],
];
const MEASURE = () => {
  const R = (e) => e && e.getBoundingClientRect();
  const hit = (a, b) => a && b && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const bad = { bubble: [], overlap: [], inside: [], header: '' };
  // ① 吹き出し: 白い箱の中身(字)が箱の外へはみ出していない(scroll の大きさが箱の大きさを超えない)。回しているときは offset 系で比べる
  document.querySelectorAll('[data-rhythm-multi-chat-bubble] > span').forEach((s) => {
    const text = (s.innerText || '').trim(); if (!text) return;
    const cs = getComputedStyle(s);
    const lh = parseFloat(cs.lineHeight) || 12;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    // 字は2行までで、それを超える分は「…」で省く(line-clamp)。見える行(多くても2行)ぶんの高さが箱にあればよい。箱が低くて、見える行が箱の下へはみ出すのが NG
    const lines = Math.max(1, Math.round((s.scrollHeight - pad) / lh));
    const shown = Math.min(lines, 2);
    const need = shown * lh + pad;
    if (s.clientHeight < need - 1) bad.bubble.push(`「${text.slice(0, 14)}」は${shown}行出すのに、箱の高さが${s.clientHeight}px(要る高さ${Math.round(need)}px)`);
  });
  // ② 決定の帯と難易度の札
  const act = document.querySelector('[data-rhythm-song-act]');
  const diffs = [...document.querySelectorAll('[data-rhythm-difficulty-best]')].map((e) => e.closest('button')).filter(Boolean);
  const main = R(document.querySelector('[data-rhythm-multi]'));
  const detail = document.querySelector('[data-rhythm-song-detail]');
  if (!act) bad.inside.push('決定の帯が無い');
  else {
    diffs.forEach((d) => { if (hit(R(act), R(d))) bad.overlap.push(`${(d.innerText || '').trim().split('\n')[0]} の札が決定の帯に隠れる`); });
    const a = R(act);
    if (!(main && a.left >= main.left - 1 && a.right <= main.right + 1 && a.top >= main.top - 1 && a.bottom <= main.bottom + 1)) bad.inside.push('決定の帯が画面の外');
  }
  // ④ 上の帯が1段に収まり、💬が下の段へ落ちない(2026-11-14 社長「吹き出しのコメントのやつが押し出されて下に来る」・🏆は曲の側へ移した)
  const head = document.querySelector('[data-rhythm-multi] > header');
  const hbtn = head ? [...head.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0) : [];
  // 🔄横は器を90度回してあるので、帯の「段」は画面の左右の位置で分かれる。向きに合わせて軸を替える
  const rotOn = !!document.querySelector('[data-mh-view-rotation="true"]');
  const tops = hbtn.map((b) => (rotOn ? R(b).left : R(b).top));
  const rowsN = tops.length ? tops.filter((t, i) => tops.findIndex((u) => Math.abs(u - t) < 20) === i).length : 0;
  const chatBtn = head && head.querySelector('[data-rhythm-multi-chat-open]');
  const portraitOnly = !rotOn && innerHeight > innerWidth;
  if (!head) bad.inside.push('上の帯が無い');
  else {
    // 横・🔄横は1段。縦は細くて入りきらないので、ボタンが2段目へ回るのはもとの作り(題字の下)で、2段までなら良い
    if (rowsN > (portraitOnly ? 2 : 1)) bad.header = `上の帯のボタンが${rowsN}段に分かれる`;
    const out = rotOn ? R(chatBtn || head).left < R(head).left - 1 : (chatBtn && R(chatBtn).bottom > R(head).bottom + 1);
    if (chatBtn && out) bad.header = (bad.header ? bad.header + ' / ' : '') + '💬が上の帯の外(下の段)へ落ちる';
    if (head.querySelector('[data-rhythm-multi-ranking]')) bad.header = (bad.header ? bad.header + ' / ' : '') + '🏆が上の帯に残っている';
  }
  // 帯の空き(裏クイックの「WAVE」の札が出ると、幅の24%ぶん使う。その余裕が残っているかを INFO で出す)
  let slack = '';
  if (head) { const w = (r) => (rotOn ? r.height : r.width); const kids = [...head.children].filter((e) => R(e).width > 0 || R(e).height > 0); const titleEl = kids.find((e) => e.querySelector('b') && /MULTI LIVE/.test(e.innerText || '')); const minTitle = titleEl ? (parseFloat(getComputedStyle(titleEl).minWidth) || 120) : 0; const used = kids.reduce((n, e) => n + (e === titleEl ? minTitle : w(R(e))), 0) + 4 * Math.max(0, kids.length - 1); slack = `帯の幅${Math.round(w(R(head)))}・ボタンと題字(最小幅)${Math.round(used)}・空き${Math.round(w(R(head)) - used)}`; if (!bad.header && !portraitOnly && w(R(head)) - used < 0) bad.header = slack; }
  const rankSong = document.querySelector('[data-rhythm-song-detail] [data-rhythm-multi-ranking]');
  if (!rankSong) bad.header = (bad.header ? bad.header + ' / ' : '') + '🏆が曲の側(詳しい欄)に無い';
  else {
    // 高さ380px以下の横(667×375 など)は、詳しい欄の下の段なので送って見る(欄の中にあれば良い)。それより広い画面は、画面の中に見えていること
    const shortScreen = !rotOn && innerHeight <= 380;
    if (!(R(rankSong).width > 0)) bad.header = (bad.header ? bad.header + ' / ' : '') + '🏆(曲の側)が見えない';
    else if (!shortScreen && R(rankSong).bottom > (main ? main.bottom : 1e9) + 1) bad.header = (bad.header ? bad.header + ' / ' : '') + '🏆(曲の側)が画面の外';
  }
  return { bubble: bad.bubble.join(' / '), overlap: bad.overlap.join(' / '), inside: bad.inside.join(' / '), header: bad.header, detail: (detail ? `詳しい欄 高さ${detail.clientHeight}・中身${detail.scrollHeight}` : '') + ' / ' + slack };
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
      // 安全域は、ブラウザの本物の env(safe-area-inset-*) を差し替えて入れる(CDP の Emulation.setSafeAreaInsetsOverride)。
      //   画面の中には env() を直に書いた所と、index.html の --mh-safe-* 経由の所の両方があるので、本物の env() で測らないと、直に書いた所の帯は見えない
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safeInset.top, bottom: safeInset.bottom, left: safeInset.left, right: safeInset.right } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(() => { class FakeWS { constructor() { this.readyState = 0; this.topic = null; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 0); } deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); } send(raw) { let m = null; try { m = JSON.parse(raw); } catch (_) { return; } if (m.event === 'phx_join') { this.topic = m.topic; this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } }); return; } if (m.event !== 'broadcast') return; this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: m.payload && m.payload.payload } }); } close() { this.readyState = 3; setTimeout(() => this.onclose && this.onclose({}), 0); } } window.WebSocket = FakeWS; });
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      const shoot = async (label) => {
        const buf = await page.screenshot();
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); fs.writeFileSync(path.join(SHOT_DIR, `${name}-${label}.png`), buf); }
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
      // マルチ: 部屋を作って、待ち・曲えらび・準備・演奏・結果
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free]').click());
      await page.waitForTimeout(800);
      await shoot('マルチ・フリーマッチの窓');
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-free-create]').click());
      await page.waitForSelector('[data-rhythm-multi-step="matching"]', { timeout: 30000 });
      await page.waitForTimeout(1500);
      await shoot('マルチ・待ち');
      await page.evaluate(() => { for (const id of ['erubin', 'kiki', 'momosuke']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-confirm]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await page.waitForTimeout(2500);
      // 助手が話しているあいだに測る(話は数秒で消えるので、何回か測って、いちばん悪いときを見る)
      let worst = { bubble: '', overlap: '', inside: '', header: '', detail: '' };
      for (let i = 0; i < 6; i++) {
        const m = await page.evaluate(MEASURE);
        for (const k of ['bubble', 'overlap', 'inside', 'header']) if (m[k] && !worst[k]) worst[k] = m[k];
        worst.detail = m.detail || worst.detail;
        const n = await page.evaluate(() => document.querySelectorAll('[data-rhythm-multi-chat-bubble]').length);
        if (i === 1) console.log(`INFO: ${name}: 吹き出し ${n}個 / ${m.detail} / ${await page.evaluate(() => { const R = (e) => e.getBoundingClientRect(); const d = document.querySelector('[data-rhythm-song-detail]'); return [...document.querySelectorAll('[data-rhythm-song-detail-grid] > *')].map((e) => `${e.style.gridArea || e.tagName}:${Math.round(R(e).top)}+${Math.round(R(e).height)}`).join(' ') + ' aside=' + (d ? Math.round(R(d).top) + '+' + Math.round(R(d).height) : ''); })}`);
        await page.waitForTimeout(700);
      }
      await shoot('マルチ・曲えらび');
      const bubbles = await page.evaluate(() => document.querySelectorAll('[data-rhythm-multi-chat-bubble]').length);
      check(`${name}: 席の上の吹き出しの字が、吹き出しの中に収まる`, !worst.bubble, worst.bubble);
      check(`${name}: 「この曲で決定」の帯が、難易度の札に重ならない`, !worst.overlap, worst.overlap);
      check(`${name}: 「この曲で決定」が画面の中に見える`, !worst.inside, worst.inside);
      check(`${name}: 上の帯が1段に収まり、💬が落ちない(🏆は曲の側)`, !worst.header, worst.header);
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
