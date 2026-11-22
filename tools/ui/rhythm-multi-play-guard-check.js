#!/usr/bin/env node
// マルチの演奏中に、押していないのに HOME などへ画面が替わろうとしても止まることを、本物の画面で確かめる(2026-11-15 r1115-006)。
//
//   node tools/ui/rhythm-multi-play-guard-check.js
//   ONLY=<名前> で1つの姿勢だけ(tate-390 / tate-320 / yoko-844 / rot-390 ほか)
//
// 見ること(助手を呼んで、おまかせで曲を決めて、演奏まで進めたあと):
//   ① 押していない HOME への切り替え(画面のエラー受け止めの「ホームへ戻る」と同じ処理を、押さずに呼ぶ)は止まり、演奏の画面のまま
//   ② 止めたことが画面の記録(MH_SCREEN_TRAIL)に blk として残る
//   ③ 本物のタップで「やめる」と、演奏が終わってマルチへ戻れる(守りが演奏の終わりの切り替えを止めない)
//   ほかに、守りの条件そのもの(ひとり用・RHYTHM_ の画面へ・演奏中でないときは止めない)を確かめる
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
const PORT = 9341;
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
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_rhythm_best_v2', { mf_ichika_mix: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map((d) => [d, { bestScore: 950000, maxCombo: 400, played: true, clear: true, fullCombo: true }])) }); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      // 偽の visualViewport(キーボードの出入りを模す。iPhone は画面の大きさを変えず、見える範囲だけを縮めてずらす)。window.__vvSet(高さ, 上のずれ)
      await page.addInitScript(() => {
        const ls = { resize: [], scroll: [] };
        const fake = { width: window.innerWidth, height: window.innerHeight, offsetTop: 0, offsetLeft: 0, scale: 1, pageTop: 0, pageLeft: 0,
          addEventListener(t, f) { (ls[t] || (ls[t] = [])).push(f); }, removeEventListener(t, f) { ls[t] = (ls[t] || []).filter((x) => x !== f); } };
        window.__vvSet = (h, top) => { fake.height = h; fake.offsetTop = top; for (const t of ['resize', 'scroll']) (ls[t] || []).forEach((f) => f()); };
        try { Object.defineProperty(window, 'visualViewport', { value: fake, configurable: true }); } catch (e) {}
      });
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
      // 更新履歴などの窓が少し遅れて開くことがあるので、閉じては押すを入れるまで繰り返す(2026-11-22 窓が開いたまま押して止まっていた)
      for (let i = 0; i < 30; i++) {
        if (await page.$('[data-rhythm-mode-select]')) break;
        await page.evaluate(() => {
          const shown = (e) => e.offsetParent;
          const close = [...document.querySelectorAll('button')].find((e) => shown(e) && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim()));
          if (close) { close.click(); return; }
          const x = [...document.querySelectorAll('button')].find((e) => shown(e) && /モンヒロビート[\s\S]*音ゲー/.test(e.innerText || '')); x && x.click(); // 上の「本オープン記念」の札ではなく HOME の入口
        });
        await page.waitForTimeout(700);
      }
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
      // 「部屋はそのままで、ほかの画面へ」が言葉の途中で折れない(窓口の確認 2026-11-15。「そのまま/で」と折れていた)
      const stepAway = await page.evaluate(() => {
        const b = document.querySelector('[data-rhythm-multi-step-away]'); if (!b || !b.offsetParent) return '';
        const out = []; const walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n;
        while ((n = walker.nextNode())) { const t = (n.textContent || '').trim(); if (!t) continue; const r = document.createRange(); r.selectNodeContents(n); const tops = new Set([...r.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top / 4))); if (tops.size > 1 && /^(部屋はそのままで、|ほかの画面へ)$/.test(t)) out.push(`「${t}」${tops.size}行`); }
        return out.join(' / ');
      });
      check(`${name}: 「部屋はそのままで、ほかの画面へ」が言葉の途中で折れない`, !stepAway, stepAway);
      await page.evaluate(() => { for (const id of ['erubin', 'kiki', 'momosuke']) { const who = assistantById(id); RHYTHM_MULTI.summon({ masuId: `as:${id}`, assistantId: id, name: who ? who.name : id, level: 1, baseId: '', colors: null }); } });
      await page.waitForTimeout(2500);
      await page.evaluate(() => document.querySelector('[data-rhythm-multi-confirm]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 20000 });
      await page.waitForTimeout(1200);
      await page.locator('[data-rhythm-multi-omakase]').click({ force: true, timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'ready' && document.querySelector('[data-rhythm-multi-ready]'), null, { timeout: 90000 });
      await page.locator('[data-rhythm-multi-ready]').click({ force: true, timeout: 15000 });
      await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]'), null, { timeout: 90000 });
      await page.waitForTimeout(1500);
      const unit = await page.evaluate(() => { const g = MH_MULTI_PLAY_GUARD; const far = Date.now() + 100000; return { stray: g.shouldBlock('RHYTHM_PLAY', 'HOME', 'multi', far), solo: !g.shouldBlock('RHYTHM_PLAY', 'HOME', 'demo', far), toRhythm: !g.shouldBlock('RHYTHM_PLAY', 'RHYTHM_MULTI', 'multi', far), notPlaying: !g.shouldBlock('RHYTHM_MULTI', 'HOME', 'multi', far) }; });
      check(`${name}: 守りの条件(マルチの演奏中に押さず外へ=止める)`, unit.stray);
      check(`${name}: 守りの条件(ひとり用・RHYTHM_ の画面へ・演奏中でない=止めない)`, unit.solo && unit.toRhythm && unit.notPlaying, JSON.stringify(unit));
      // ===== マルチの演奏中に、押していないのに HOME へ替わろうとしても止まる(2026-11-15 r1115-006) =====
      const gs = () => page.evaluate(() => ({ play: !!document.querySelector('[data-rhythm-play-area]'), trail: MH_SCREEN_TRAIL.list().slice(-8).map((x) => `${x.k}:${x.d}`).join(' | ') }));
      const before = await gs();
      check(`${name}: 演奏の画面が出ている`, before.play, before.trail);
      // 自動で動く処理の代わり: 画面のエラー受け止め(MhErrorBoundary)の「ホームへ戻る」と同じ処理(returnToHome)を、React の中から押さずに呼ぶ
      await page.waitForTimeout(1700);
      const fired = await page.evaluate(() => {
        const el = document.querySelector('[data-rhythm-play-area]'); const key = el && Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
        let f = key ? el[key] : null;
        while (f) { const p = f.memoizedProps; if (p && typeof p.onRecover === 'function' && p.screen !== undefined) { p.onRecover(); return true; } f = f.return; }
        return false;
      });
      check(`${name}: 画面の中の「ホームへ戻る」の処理を、押さずに呼べた(検査の下ごしらえ)`, fired);
      await page.waitForTimeout(800);
      const blocked = await gs();
      check(`${name}: 押していない HOME への切り替えは止まり、演奏の画面のまま`, blocked.play, blocked.trail);
      check(`${name}: 止めたことが画面の記録(blk)に残る`, /blk:HOME/.test(blocked.trail), blocked.trail);
      // 押した(本物のタップ)ときは通る: 一時停止 → やめる → 演奏が終わってマルチへ戻る
      for (let i = 0; i < 6; i += 1) {
        if (!(await page.evaluate(() => !!document.querySelector('[data-rhythm-play-area]')))) break;
        await page.evaluate(() => document.querySelector('[data-rhythm-pause]')?.click());
        await page.waitForTimeout(700);
        await page.locator('[data-rhythm-pause-exit]').click({ force: true, timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1200);
      }
      const exited = await page.evaluate(() => ({ play: !!document.querySelector('[data-rhythm-play-area]'), step: document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') || '' }));
      check(`${name}: 押して「やめる」と、演奏が終わってマルチへ戻る(守りが通す)`, !exited.play && !!exited.step, JSON.stringify(exited));
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
