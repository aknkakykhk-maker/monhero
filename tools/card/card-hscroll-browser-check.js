#!/usr/bin/env node
// MFバトルカードの画面で、縦に流す所(一覧など)が横にも動いてしまわないかを、本物のブラウザで測る
// (2026-11-24 社長 r1119-157「ここのスライド横にも動く」「たまにこういうのある」= ランキングのランクのタブ)。
//
//   node tools/card/card-hscroll-browser-check.js            縦 390×844・320×568 と横 844×390 で見る
//   SHOT_DIR=<フォルダ> …                                    NG の場面と、ランキングのタブの止め絵を置く
//   SIZES=390x844 …                                          大きさをしぼる(カンマ区切り)
//
// 見るもの(画面ごと・大きさごと)
//   ① 縦に流す所(overflow-y が auto/scroll)が、横にも動かない(scrollLeft を動かしても 0 のまま)。
//      動くときは scrollWidth と clientWidth の差と、はみ出している一番外の中身を出す
//   ② ページ全体(html・body)が横に動かない
//   横に流す作りの列(overflow-y が hidden で overflow-x が auto)は、はじめから横に流すものなので見ない。
//   カード部の外の画面(マーケットなど)へは行かない。Supabase は偽物(読む表は決めた行を返す。本物へは何も送らない)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed, updateNoticeSeed, loginBonusDoneSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8961;
const SHOT = process.env.SHOT_DIR || '';
const SELF = 'self-0000-0000-0000-000000000001';
const SIZES = (process.env.SIZES || '390x844,320x568,844x390').split(',').map((s) => s.split('x').map(Number));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 偽物の表(長い名前・大きい数も入れて、幅がいちばん広がる形にする)
const NAMES = ['ソラシド', 'えるびん', 'りりう', '♪みゅあ♪', 'いちか', 'ながいなまえのブリーダーさん', 'ドラ', 'たろう', 'はなこ', 'じろう', 'ABCDEFGHIJKLMNOPQRST'];
const rankRows = NAMES.map((n, i) => ({ breeder_id: i === 5 ? SELF : `b-${i}`, user_name: n, icon: '🐣', profile_frame: null, rank: 48 - i * 3, xp_total: 4385 - i * 300, updated_at: '2026-11-20T00:00:00Z' }));
const winRows = NAMES.map((n, i) => ({ user_name: n, breeder_id: `b-${i}`, icon: '🐣', profile_frame: null, week_key: '2026-11-23', wins_easy: 0, wins_normal: 9999 - i, wins_hard: 0, wins_expert: 0, wins_master: 0,
  week_wins_easy: 0, week_wins_normal: 999 - i, week_wins_hard: 0, week_wins_expert: 0, week_wins_master: 0, best_streak: 999 - i, current_streak: 0, dex_count: 450 - i, dex_total: 451, updated_at: '2026-11-20T00:00:00Z' }));
const pvpRows = NAMES.map((n, i) => ({ breeder_id: `b-${i}`, user_name: n, icon: '🐣', profile_frame: null, rating: 2500 - i * 10, wins: 999, loses: 99 }));

// 画面に出ている「縦に流す所」と、ページ全体の横の動きを測る(ページの中で動かす)
const measure = () => {
  const out = [];
  const label = (el) => {
    const a = [...el.attributes].filter((x) => x.name.startsWith('data-')).map((x) => (x.value ? `${x.name}=${x.value}` : x.name)).slice(0, 2).join(' ');
    return `${el.tagName.toLowerCase()}${a ? `[${a}]` : ''}.${String(el.className || '').split(/\s+/).slice(0, 4).join('.')}`;
  };
  const outer = (el) => { // 右か左へはみ出している一番外の中身
    const b = el.getBoundingClientRect(); let worst = null; let w = 0;
    el.querySelectorAll('*').forEach((c) => { const q = c.getBoundingClientRect(); if (!q.width) return; const o = Math.max(q.right - b.right, b.left - q.left); if (o > w + 0.5) { w = o; worst = c; } });
    return worst ? `${label(worst)} ${Math.round(w)}px` : '';
  };
  const all = [...document.querySelectorAll('body *')];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY)) continue;
    if (el.clientHeight < 40 || el.clientWidth < 40) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    if (cs.visibility === 'hidden') continue;
    const prev = el.scrollLeft; el.scrollLeft = 100000; const moved = el.scrollLeft; el.scrollLeft = prev;
    if (moved > 0) out.push({ where: label(el), diff: el.scrollWidth - el.clientWidth, ox: cs.overflowX, worst: outer(el) });
  }
  const se = document.scrollingElement || document.documentElement;
  const px = se.scrollLeft; se.scrollLeft = 100000; const pm = se.scrollLeft; se.scrollLeft = px;
  if (pm > 0) out.push({ where: 'ページ全体', diff: se.scrollWidth - se.clientWidth, ox: getComputedStyle(se).overflowX, worst: '' });
  return out;
};

let failed = 0;
const found = []; // { size, scene, where, diff, worst, own }
(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    for (const [W, H] of SIZES) {
      const size = `${W >= H ? '横' : '縦'}${W}×${H}`;
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true });
      await ctx.route(/supabase\.co\//, async (r) => {
        const req = r.request(); const url = req.url();
        const m = url.match(/\/rest\/v1\/(?:rpc\/)?([a-z0-9_]+)/); const table = m ? m[1] : '';
        const json = (body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        if (req.method() !== 'GET') return json([]);
        if (table === 'card_ranks') return json(/breeder_id=eq\./.test(url) ? rankRows.filter((x) => x.breeder_id === SELF) : rankRows);
        if (/^card_battle_ranks/.test(table)) return json(/select=breeder_id,user_name&/.test(url) ? [] : winRows);
        if (table === 'card_battle_pvp_ratings') return json(/breeder_id=eq\./.test(url) ? [] : pvpRows);
        return json([]);
      });
      await ctx.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await ctx.addInitScript((self) => {
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
        s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
        s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
        s('mh_breeder_id_v1', self);
      }, SELF);
      await ctx.addInitScript(quietBootSeed()); await ctx.addInitScript(updateNoticeSeed()); await ctx.addInitScript(loginBonusDoneSeed()); await ctx.addInitScript(oneTimeNoticeSeed());
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${size}: ${String(e).slice(0, 160)}`));
      const sleep = (ms) => page.waitForTimeout(ms);
      const dismiss = async () => {
        for (let i = 0; i < 8; i++) {
          const b = page.getByRole('button', { name: /^(受け取る|閉じる|(?:始|はじ)める|OK|スキップ|あとで読む)$/ }).first();
          if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
          await b.dispatchEvent('click').catch(() => {}); await sleep(250);
        }
      };
      const look = async (scene) => {
        await sleep(700);
        const r = await page.evaluate(measure);
        r.forEach((x) => found.push({ size, scene, ...x }));
        const tag = r.length ? 'NG' : 'OK';
        console.log(`${tag}: ${size} ${scene}${r.length ? ` — ${r.map((x) => `${x.where} 横に ${x.diff}px${x.worst ? `(はみ出し ${x.worst})` : ''}`).join(' / ')}` : ''}`);
        if (SHOT && (r.length || /ランキング/.test(scene))) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${size}-${scene.replace(/[\s/・>]+/g, '_')}.png`) }).catch(() => {}); }
      };
      const back = async () => {
        for (let i = 0; i < 4 && !(await page.locator('[data-card-top="top"]').isVisible().catch(() => false)); i++) {
          const b = page.getByRole('button', { name: '戻る' }).first();
          if (await b.count() && await b.isVisible().catch(() => false)) await b.click().catch(() => {}); else await page.keyboard.press('Escape').catch(() => {});
          await sleep(400); await dismiss();
        }
      };
      const clickIf = async (sel) => { const l = page.locator(sel).first(); if (!(await l.count()) || !(await l.isVisible().catch(() => false))) return false; await l.click().catch(() => {}); await sleep(500); return true; };

      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(400); await dismiss(); }
      await home.click();
      await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
      await sleep(600); await dismiss();
      if (await page.locator('[data-card-top="starter"]').count()) {
        await look('スターターを選ぶ');
        await page.locator('[data-card-kit="speed"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
        await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
        await look('対戦の結果');
        await page.getByRole('button', { name: /トップへ/ }).first().click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
      }
      await sleep(500); await dismiss();
      await look('トップ');

      // ランキング: 5つのタブ(勝ち数は今週・通算も)
      if (await clickIf('[data-card-ranking-open]')) {
        await page.locator('[data-card-ranking]').waitFor({ timeout: 10000 }).catch(() => {});
        for (const [id, name] of [['wins', '勝ち数'], ['streak', '連勝'], ['dex', '図鑑'], ['multi', 'マルチ'], ['rank', 'ランク']]) {
          await clickIf(`[data-card-ranking-tab="${id}"]`);
          await sleep(500);
          await look(`ランキング・${name}`);
          if (id === 'wins' && await clickIf('[data-card-ranking-period="total"]')) await look('ランキング・勝ち数・通算');
        }
        await back();
      }
      // トップから開く画面(カード部の中だけ。マーケットはほかの部なので行かない)
      const openers = await page.evaluate(() => [...document.querySelectorAll('[data-card-top="top"] button')]
        .map((b) => [...b.attributes].map((a) => a.name).find((n) => /^data-card-[a-z-]+-open$/.test(n)))
        .filter((n) => n && !/market|ranking|demo/.test(n)));
      openers.push('data-card-active-deck'); // 使うデッキ(デッキを組む画面)
      for (const attr of [...new Set(openers)]) {
        if (!(await clickIf(`[data-card-top="top"] [${attr}]`))) continue;
        await dismiss();
        await look(attr.replace(/^data-card-|-open$/g, '').replace('active-deck', 'deck'));
        // 開いた先のタブも全部見る(role=tab か aria-pressed のボタン)
        // (オプションの切り替えは設定を変えるだけで画面は同じなので押さない)
        const tabs = /options/.test(attr) ? 0 : await page.locator('[role="tab"], button[aria-pressed]').count();
        for (let i = 0; i < Math.min(tabs, 8); i++) {
          const t = page.locator('[role="tab"], button[aria-pressed]').nth(i);
          if (!(await t.isVisible().catch(() => false))) continue;
          const nm = ((await t.innerText().catch(() => '')) || '').replace(/\s+/g, '').slice(0, 10);
          await t.click().catch(() => {}); await look(`${attr.replace(/^data-card-|-open$/g, '')}・${nm}`);
        }
        await back();
      }
      // 対戦を選ぶ画面と、その先(助手と対戦・登録・大会・カップ・マルチ)
      const modeBtn = page.locator('[data-card-mode-open], [data-card-battle-open], button:has-text("対戦")').first();
      if (await modeBtn.count()) {
        await modeBtn.click().catch(() => {}); await sleep(600); await dismiss();
        if (await page.locator('[data-card-top="mode"]').isVisible().catch(() => false)) {
          await look('対戦を選ぶ');
          for (const [sel, name] of [['[data-card-mode-assistant]', '助手と対戦'], ['[data-card-mode-tactics]', 'デッキ登録'], ['[data-card-mode-tour]', '大会'], ['[data-card-mode-cup]', 'カップ'], ['[data-card-mode-multi]', 'マルチ']]) {
            const b = page.locator(sel).first();
            if (!(await b.count()) || !(await b.isEnabled().catch(() => false))) continue;
            await b.click().catch(() => {}); await sleep(900); await dismiss();
            await look(name);
            for (let k = 0; k < 4 && !(await page.locator('[data-card-top="mode"]').isVisible().catch(() => false)); k++) {
              const bb = page.getByRole('button', { name: '戻る' }).first();
              if (await bb.count() && await bb.isVisible().catch(() => false)) await bb.click().catch(() => {}); else break;
              await sleep(500); await dismiss();
            }
            if (!(await page.locator('[data-card-top="mode"]').isVisible().catch(() => false))) break;
          }
        }
        await back();
      }
      await ctx.close();
    }
  } catch (e) {
    console.log(`NG: 途中で止まった — ${String(e && e.message || e).slice(0, 300)}`); failed++;
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (errors.length) { console.log(`NG: 実行時エラー ${errors.length}件 — ${errors.slice(0, 2).join(' / ')}`); failed++; }
  if (found.length) failed += found.length;
  console.log(failed ? `\nNG ${failed}件(縦に流す所が横にも動く ${found.length}件)` : '\nOK: カード部の画面で、縦に流す所は横に動かない(縦390・320・横844)');
  process.exit(failed ? 1 : 0);
})();
