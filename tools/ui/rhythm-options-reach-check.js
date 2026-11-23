#!/usr/bin/env node
// モンヒロビートのオプションで、「戻る」と下のボタン(保存・最初の設定に戻す)・上のタブが、いつでも押せるかを本物の画面で確かめる。
//
//   node tools/ui/rhythm-options-reach-check.js          (SHOT_DIR=… で止め絵も撮る)
//
// 【なぜ要るか】2026-11-23 社長「設定行ったらかぶってて戻れなくなった。このバグも何回目だよ」(台帳 r1119-147)
//   iPhone の🔄横(端末は縦のまま器を90度回す)で、判定ラインのスライダーを動かして保存したあと、画面ごと上へずれて
//   左上の「戻る」が状態表示(時計・電池)の下に入り、押せなくなった。
//   原因: スライダー(input type=range)にフォーカスが残ると、ページのずれを戻す見張り(10-core.jsx MH_PAGE_OFFSET_GUARD)が
//   「文字を入力中」と見て戻すのをやめていた。前の直し(2026-09-12 器の安全域・2026-11-02/11 ずれの見張り)は
//   それぞれ別の道で、スライダーが残す「入力中」の道を誰も試していなかった。
//
// 見るもの(機種 iPhone SE 相当 375×667 安全域なし / iPhone 14 相当 390×844 状態表示47px・ホームバー34px
//          × 縦・横(端末を回す)・🔄横90°・🔄横270° × 判定ラインを下端・上端まで動かした時 × 4つのタブ):
//   ① 「戻る」・タブ・「保存」・「最初の設定に戻す」の真ん中を押すと、そのボタンに届く(何も重なっていない)
//   ② 見出しの帯と下のボタンの帯の上を細かく押して、中身(欄・見本の絵)が1か所も出てこない
//   ③ 「戻る」が状態表示・ホームバーの下に入っていない(安全域の内側)
//   ④ スライダーにフォーカスを残したまま、ページが状態表示の高さぶんずれても、「保存」を押せば0へ戻る
//   ⑤ 実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT || 8993);
const SHOT_DIR = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const problems = [];
const check = (name, ok, detail = '') => { if (!ok) { failed++; problems.push(`NG: ${name}${detail ? ` — ${detail}` : ''}`); } return ok; };
const seed = () => {
  if (sessionStorage.getItem('__roSeeded')) return;
  sessionStorage.setItem('__roSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
};
// 機種: 安全域は検査用の差し替え(--mh-safe-*)で入れる(env() はブラウザの外から作れない)
const DEVICES = [
  { name: 'SE', w: 375, h: 667, safe: { top: 0, bottom: 0 } },
  { name: '14', w: 390, h: 844, safe: { top: 47, bottom: 34 } },
];
// 向き: 縦 / 横(端末を回す) / 🔄横90 / 🔄横270(端末は縦のまま器を回す)
const VIEWS = [
  { name: '縦', land: false, rot: 0 },
  { name: '横', land: true, rot: 0 },
  { name: '🔄横90', land: false, rot: 90 },
  { name: '🔄横270', land: false, rot: 270 },
];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let cases = 0;
  try {
    for (const dev of DEVICES) for (const view of VIEWS) {
      const tag = `${dev.name}${view.name}`;
      // 端末を回す横は、安全域も左右へ回る(状態表示は左、ホームバーは下のまま小さく)
      const w = view.land ? dev.h : dev.w, h = view.land ? dev.w : dev.h;
      const safe = view.land ? { top: 0, bottom: dev.safe.bottom ? 21 : 0, left: dev.safe.top, right: dev.safe.top } : { ...dev.safe, left: 0, right: 0 };
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      await page.addInitScript(seed); await page.addInitScript(quiet.quietBootSeed()); await page.addInitScript(quiet.updateNoticeSeed());
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript((s) => { document.addEventListener('DOMContentLoaded', () => { const st = document.documentElement.style; for (const k of ['top', 'bottom', 'left', 'right']) st.setProperty(`--mh-safe-${k}`, `${s[k]}px`); }); }, safe);
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      const cp = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]')); if (b) { b.click(); return true; } return false; });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {}); await cp(); await page.waitForTimeout(500); }
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /モンヒロビート/.test((x.getAttribute('aria-label') || '') + ' ' + (x.innerText || ''))); if (b) b.click(); });
      await page.waitForTimeout(2500); for (let i = 0; i < 4 && await cp(); i++) await page.waitForTimeout(300);
      if (view.rot) { await page.evaluate((r) => RHYTHM_VIEW_ROTATION.set(r), view.rot); await page.waitForTimeout(800); }
      await page.evaluate(() => document.querySelector('[data-rhythm-mode-options]')?.click()); await page.waitForTimeout(1500);
      if (!check(`[${tag}] オプションが開く`, await page.evaluate(() => !!document.querySelector('[data-rhythm-options]')))) { await page.close(); continue; }
      const shot = async (name) => { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${tag}-${name}.png`) }); } };
      const tabOf = (id) => page.evaluate((t) => { document.querySelector(`[data-rhythm-options-tab="${t}"]`)?.click(); }, id);
      // 判定ラインの位置(地上・空中)を端まで動かす。dir=-1 で下端、+1 で上端
      const pushLines = async (dir) => {
        await tabOf('live'); await page.waitForTimeout(200);
        for (let i = 0; i < 30; i++) {
          const moved = await page.evaluate((d) => {
            const btns = [...document.querySelectorAll('[data-rhythm-option-nudge]')].filter((b) => /^(judgmentLineHeight|skyLine)/.test(b.dataset.rhythmOptionNudge) && (d < 0 ? /-/.test(b.dataset.rhythmOptionNudge) : /\+/.test(b.dataset.rhythmOptionNudge)) && !b.disabled);
            // 粗いほう(数の大きいほう)を押す
            const byKey = {};
            for (const b of btns) { const k = b.dataset.rhythmOptionNudge.replace(/[-+].*$/, ''); const n = Math.abs(parseFloat(b.dataset.rhythmOptionNudge.slice(k.length))); if (!byKey[k] || n > byKey[k].n) byKey[k] = { b, n }; }
            Object.values(byKey).forEach(({ b }) => b.click());
            return Object.keys(byKey).length;
          }, dir);
          if (!moved) break;
          await page.waitForTimeout(30);
        }
      };
      // 押せるか・帯の上に中身が出ていないか・安全域の内側か を、いまの画面で測る
      const measure = (sf) => page.evaluate(({ sf, rot }) => {
        const hits = (el) => { if (!el) return '無い'; const q = el.getBoundingClientRect(); if (q.width < 1) return '見えない'; const t = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return t && (t === el || el.contains(t)) ? '' : `重なり ${t ? (t.tagName + '.' + String(t.className).slice(0, 60)) : 'null'}`; };
        const opt = document.querySelector('[data-rhythm-options]');
        const bar = opt.querySelector('[data-rhythm-options-bar]'), foot = opt.querySelector('[data-rhythm-options-actions]');
        const back = opt.querySelector('button[aria-label="戻る"]');
        const out = [];
        const add = (name, why) => { if (why) out.push(`${name}: ${why}`); };
        add('戻る', hits(back));
        add('保存', hits(opt.querySelector('[data-rhythm-options-save]')));
        add('最初の設定に戻す', hits([...foot.querySelectorAll('button')].find((b) => /最初の設定/.test(b.innerText))));
        opt.querySelectorAll('[data-rhythm-options-tab]').forEach((b) => add(`タブ ${b.innerText.trim()}`, hits(b)));
        // 帯の上を細かく押して、中身(スクロール欄の中)が出てこないか
        for (const [name, el] of [['見出しの帯', bar], ['下のボタンの帯', foot]]) {
          const q = el.getBoundingClientRect();
          let bad = '';
          for (let i = 1; i < 12 && !bad; i++) for (let j = 1; j < 5 && !bad; j++) {
            const x = q.left + (q.width * i) / 12, y = q.top + (q.height * j) / 5;
            const t = document.elementFromPoint(x, y);
            if (t && t.closest && t.closest('[data-rhythm-options-scroll]')) bad = `中身が出ている(${t.tagName}.${String(t.className).slice(0, 50)})`;
          }
          add(name, bad);
        }
        // 安全域: 縦は上に状態表示・下にホームバー。🔄横90 は器の左上=端末の右上、🔄横270 は端末の左下
        const b = back.getBoundingClientRect();
        if (rot === 90 && b.top < sf.top) add('戻る', `状態表示の下に入っている(上端 ${Math.round(b.top)}px < ${sf.top}px)`);
        if (rot === 270 && b.bottom > innerHeight - sf.bottom) add('戻る', `ホームバーの下に入っている(下端 ${Math.round(b.bottom)}px)`);
        if (!rot && b.top < sf.top) add('戻る', `状態表示の下に入っている(上端 ${Math.round(b.top)}px)`);
        if (!rot && b.left < sf.left) add('戻る', `左の切り欠きの下に入っている(左端 ${Math.round(b.left)}px)`);
        return out;
      }, { sf: safe, rot: view.rot });
      for (const [dir, dirName] of [[-1, '判定ライン下端'], [1, '判定ライン上端']]) {
        await pushLines(dir);
        for (const tab of ['live', 'display', 'volume', 'system']) {
          await tabOf(tab); await page.waitForTimeout(250);
          // 中身をいちばん下まで送った状態でも見る(下のボタンの帯に食い込まないか)
          for (const pos of ['上', '下']) {
            await page.evaluate((p) => { const s = document.querySelector('[data-rhythm-options-scroll]'); if (s) s.scrollTop = p === '下' ? s.scrollHeight : 0; }, pos);
            await page.waitForTimeout(60);
            const out = await measure(safe);
            cases++;
            check(`[${tag}・${dirName}・${tab}・${pos}] 戻る・タブ・保存が押せる`, out.length === 0, out.join(' / '));
          }
        }
        await tabOf('live'); await page.waitForTimeout(200);
        await shot(dirName);
      }
      // ④ スライダーにフォーカスを残したまま、ページが状態表示の高さぶんずれた時(社長の写真の状態)。保存を押せば戻る
      const shift = await page.evaluate(async () => {
        document.documentElement.style.overflow = 'auto'; document.body.style.overflow = 'auto'; document.body.style.minHeight = '2000px';
        window.scrollTo(0, 47);
        const before = window.scrollY;
        const r = document.querySelector('[data-rhythm-option-slider]'); if (r) r.focus();
        return { before, focused: document.activeElement && document.activeElement.type };
      });
      await page.evaluate(() => document.querySelector('[data-rhythm-options-save]')?.click());
      await page.waitForTimeout(800);
      const after = await page.evaluate(() => { const y = window.scrollY; document.documentElement.style.overflow = ''; document.body.style.overflow = ''; document.body.style.minHeight = ''; return y; });
      cases++;
      check(`[${tag}] スライダーにフォーカスが残ったままページがずれても、保存で戻る`, shift.before > 0 && shift.focused === 'range' && after === 0, `ずらした ${shift.before}px(フォーカス ${shift.focused}) → 保存後 ${after}px`);
      // 判定ラインは下書きのまま戻しておく必要はない(この頁は捨てる)。実行時エラー
      check(`[${tag}] 実行時エラーが出ない`, fatal.length === 0, fatal.slice(0, 2).join(' | '));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  problems.slice(0, 15).forEach((p) => console.log(p));
  if (problems.length > 15) console.log(`… ほか ${problems.length - 15} 件`);
  console.log(failed === 0 ? `\nすべてOK(${cases}場面: 2機種 × 縦・横・🔄横90・🔄横270 × 判定ライン下端・上端 × 4タブ × 中身の上・下 + ずれの戻し)` : `\n${failed}件のNGがあります`);
  process.exit(failed === 0 ? 0 : 1);
})();
