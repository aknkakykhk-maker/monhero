#!/usr/bin/env node
// クリスマスのイベント「聖夜の名探偵」の動線を、時計をずらした実際のブラウザで通して確かめる(台帳 r1126-028 ①②)。
//
//   node tools/battle/xmas-flow-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦・横・タブレットの止め絵を残す(HOME・物語・レイド・ボーナス・カードの案内・終了後の HOME)
//
//   ① 11/27 13:05(序章だけ): HOME に入口がありボスは無い・物語は序章だけ(事件簿の入口も第1話も無い)・レイドとボーナスは「11/30 10:00 から」・
//      タブを替えてもポスターの大きさが変わらない・横で入口の帯がほかのイベントの帯に重ならない
//   ② 11/30 10:05(開催): 入口の二度押しで二重に開かない・HOME のボス → レイドのタブ → 戻ると HOME・
//      バトルで挑む → 編成 → 戻るとレイド・ビートで挑む → 曲えらび → 戻るとレイド・
//      スターターの無い人がカードで挑むと案内が出る(何も起きないことが無い)・事件簿を開く → 閉じると物語・序章を飛ばすと「読んだ」・
//      横のレイドのタブは上の部分で高さを使い切らない(ポスターを出さない・幅をそろえる)
//   ③ 12/31 4:05(終了後): HOME に入口もボスも無い
//   どの時刻も実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8957;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// 時計をずらす(Date だけ。タイマーはそのまま進む)
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const VPS = [
  { label: '縦', shot: 'tate', viewport: { width: 390, height: 844 } },
  { label: '横', shot: 'yoko', viewport: { width: 844, height: 390 } },
  { label: 'タブレット', shot: 'tablet', viewport: { width: 820, height: 1180 } },
];
const PRE = '2026-11-27T13:05:00+09:00', OPEN = '2026-11-30T10:05:00+09:00', AFTER = '2026-12-31T04:05:00+09:00';
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async (iso, vp) => {
    const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: true, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(shiftClock(iso));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true);
    });
    await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 8; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(800);
    const shot = async (name) => { if (!SHOT_DIR) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, `${name}-${vp.shot}.jpg`), type: 'jpeg', quality: 80 }); };
    // いまいる画面
    const where = () => page.evaluate(() => {
      if (document.querySelector('[data-xmas-novel]')) return 'novel';
      if (document.querySelector('[data-raid-jack-prep]')) return 'prep';
      if (document.querySelector('[data-raid-jack-footer]')) return 'raid';
      const e = document.querySelector('[data-xmas-event]'); if (e) return `event:${e.getAttribute('data-xmas-event')}`;
      if (document.querySelector('[data-home-xmas-entry]') || document.querySelector('[data-home-raid-jack]')) return 'home';
      if ([...document.querySelectorAll('button')].some((b) => /モード選びへ戻る/.test(b.innerText))) return 'rhythm';
      return 'other';
    });
    const tab = async (name) => { await page.getByRole('tab', { name }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(900); };
    const back = async () => { await page.getByRole('button', { name: /戻る/ }).first().click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1300); };
    const box = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }, sel);
    return { ctx, page, errors, shot, where, tab, back, box };
  };
  const overlap = (a, b) => !!a && !!b && a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
  try {
    for (const vp of VPS) {
      // ① 開催前(序章だけ)
      {
        const { ctx, page, errors, shot, tab, box } = await open(PRE, vp);
        await shot('pre-home');
        check(`① ${vp.label}: HOME に入口があり、ボスはまだ出ない`, await page.locator('[data-home-xmas-entry]').count() > 0 && await page.locator('[data-home-raid-jack]').count() === 0);
        check(`① ${vp.label}: 入口の帯が、ほかのイベントの帯に重ならない`, !overlap(await box('[data-home-xmas-entry]'), await box('[data-home-event-strip]')));
        await page.locator('[data-home-xmas-entry]').first().click();
        await page.waitForTimeout(1300);
        await shot('pre-story');
        const rows = await page.locator('[data-xmas-story-chapter]').evaluateAll((els) => els.map((e) => e.getAttribute('data-xmas-story-chapter')));
        check(`① ${vp.label}: 物語は序章だけ(事件簿の入口は出ない)`, rows.join(',') === 'xs00' && await page.locator('[data-xmas-novel-open]').count() === 0, rows.join(','));
        const posterStory = await box('[data-xmas-event-poster]');
        for (const [name, id] of [['レイド', 'raid'], ['ボーナス', 'bonus']]) {
          await tab(name);
          await shot(`pre-${id}`);
          check(`① ${vp.label}: ${name}は「11/30(月) 10:00 から」だけ`, await page.locator(`[data-xmas-event-preopen="${id}"]`).count() > 0 && await page.locator('[data-raid-jack-footer]').count() === 0);
          const p = await box('[data-xmas-event-poster]');
          check(`① ${vp.label}: ${name}に替えてもポスターの大きさが変わらない`, !!p && !!posterStory && Math.abs(p.h - posterStory.h) < 2, `${posterStory && Math.round(posterStory.h)} → ${p && Math.round(p.h)}`);
        }
        check(`① ${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
        await ctx.close();
      }
      // ② 開催中
      {
        const { ctx, page, errors, shot, where, tab, back, box } = await open(OPEN, vp);
        await shot('open-home');
        check(`② ${vp.label}: HOME に入口とボスがある`, await page.locator('[data-home-xmas-entry]').count() > 0 && await page.locator('[data-home-raid-jack]').count() > 0);
        // 入口の二度押し
        await page.locator('[data-home-xmas-entry]').first().evaluate((el) => { el.click(); el.click(); });
        await page.waitForTimeout(1300);
        check(`② ${vp.label}: 入口の二度押しで物語が1つだけ開く`, (await where()) === 'event:story' && await page.locator('[data-xmas-event]').count() === 1);
        await shot('open-story');
        await back();
        check(`② ${vp.label}: 物語から戻ると HOME`, (await where()) === 'home');
        // HOME のボス
        await page.locator('[data-home-raid-jack]').first().click();
        await page.waitForTimeout(1300);
        check(`② ${vp.label}: HOME のボスからレイドのタブが開く`, (await where()) === 'raid');
        await shot('open-raid');
        if (vp.shot === 'yoko') {
          const head = await box('[data-xmas-event-head]'); const foot = await box('[data-raid-jack-footer]');
          check(`② ${vp.label}: 横のレイドはポスターを出さず、上の部分が高さの半分を超えない`, (await box('[data-xmas-event-poster]')).h === 0 && head.h <= 390 / 2, `上の部分 ${Math.round(head.h)}px`);
          const list = await box('[data-raid-ways]');
          check(`② ${vp.label}: 横のレイドは、上の部分と挑戦のボタンの幅がそろう`, !!list && Math.abs(head.w - list.w) < 4, `${Math.round(head.w)} / ${list && Math.round(list.w)}`);
          void foot;
        }
        // バトルで挑む → 編成 → 戻る
        await page.locator('[data-raid-ways] button').filter({ hasText: 'バトルで' }).first().click();
        await page.waitForTimeout(1300);
        check(`② ${vp.label}: バトルで挑むと編成が開く`, (await where()) === 'prep');
        await back();
        check(`② ${vp.label}: 編成から戻るとレイドのタブ`, (await where()) === 'raid');
        // ビートで挑む → 曲えらび → 戻る
        await page.locator('[data-raid-ways] button').filter({ hasText: 'モンヒロビートで' }).first().click();
        await page.waitForTimeout(2000);
        check(`② ${vp.label}: ビートで挑むと曲えらびが開く`, (await where()) === 'rhythm');
        await back();
        await page.waitForTimeout(800);
        check(`② ${vp.label}: 曲えらびから戻るとレイドのタブ`, (await where()) === 'raid');
        // カードで挑む(スターター無し)→ 案内が出る
        await page.locator('[data-raid-ways] button').filter({ hasText: 'バトルカードで' }).first().evaluate((el) => { el.click(); el.click(); });
        await page.waitForTimeout(1300);
        const notice = page.locator('[data-xmas-event-notice]');
        check(`② ${vp.label}: スターターの無い人がカードで挑むと、案内が1つ出る`, await notice.count() === 1 && /スターター/.test(await notice.innerText().catch(() => '')));
        await shot('open-card-notice');
        await page.locator('[data-xmas-event-notice-close]').click().catch(() => {});
        await page.waitForTimeout(500);
        check(`② ${vp.label}: 案内を閉じるとレイドのタブのまま`, (await where()) === 'raid' && await notice.count() === 0);
        // ボーナス・物語
        await tab('ボーナス');
        await shot('open-bonus');
        check(`② ${vp.label}: ボーナスに5つ並ぶ`, await page.locator('[data-xmas-bonus-item]').count() === 5);
        await tab('物語');
        // 事件簿を開く(二度押し) → 閉じる
        await page.locator('[data-xmas-novel-open]').evaluate((el) => { el.click(); el.click(); });
        await page.waitForTimeout(2000);
        check(`② ${vp.label}: 事件簿が1つだけ開く`, await page.locator('[data-xmas-novel]').count() >= 1 && await page.locator('[data-xmas-novel-title]').count() <= 1);
        await shot('open-novel');
        await page.locator('[aria-label="閉じる"]').first().click().catch(() => {});
        await page.waitForTimeout(1300);
        check(`② ${vp.label}: 事件簿を閉じると物語のタブ`, (await where()) === 'event:story');
        // 序章を読む → 飛ばす → 読んだ
        await page.locator('[data-xmas-story-chapter="xs00"]').click();
        await page.waitForTimeout(500);
        await page.locator('[data-xmas-story-read]').click();
        await page.waitForTimeout(2500);
        await page.getByRole('button', { name: /スキップ/ }).first().click().catch(() => {});
        await page.waitForTimeout(1500);
        for (let i = 0; i < 4 && (await where()) !== 'event:story'; i++) {
          const c = page.locator('[data-story-ending-close]');
          if (await c.count()) await c.click().catch(() => {}); else await page.getByRole('button', { name: /閉じる|次へ/ }).first().click().catch(() => {});
          await page.waitForTimeout(1200);
        }
        check(`② ${vp.label}: 序章を飛ばすと物語のタブへ戻り「読んだ」`, (await where()) === 'event:story' && await page.locator('[data-xmas-story-chapter="xs00"] [data-xmas-story-done]').count() > 0);
        check(`② ${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
        await ctx.close();
      }
      // ③ 終了後
      {
        const { ctx, page, errors, shot } = await open(AFTER, vp);
        await shot('after-home');
        check(`③ ${vp.label}: 終了後の HOME に入口もボスも無い`, await page.locator('[data-home-xmas-entry]').count() === 0 && await page.locator('[data-home-raid-jack]').count() === 0);
        check(`③ ${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
        await ctx.close();
      }
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'OK: クリスマスの動線の検査はすべて通りました');
  process.exit(failed ? 1 : 0);
})();
