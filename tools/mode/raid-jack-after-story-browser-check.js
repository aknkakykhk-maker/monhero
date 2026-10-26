#!/usr/bin/env node
// ハロウィン・ナイトの大王を倒したあとのお話(第6部・終章2本)と、きゅうこの加入のお話を、実際のブラウザで最後まで流す
// (2026-10-23 社長「ジャック大王を倒した以降のイベントにあつときゅうこもいれて」「あつが解放されてるかどうかの分岐もきゅうこ登場含めて」)。
// 台本: docs/playbot/reports/2026-10-23/raid-jack-after/story.md
//
//   node tools/mode/raid-jack-after-story-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、あつが出る行(解放あり)と差し替えの行(解放なし)の写真を残す
//
//   あつの加入のお話を「見た」人(解放あり)と「まだ」の人(解放なし)の2通りで起動し、デバッグ設定の「全ストーリーを確認」から再生する
//   ① どのお話も最後まで送れて、行の数が台本どおり(解放あり/なしで違う)
//   ② 解放なしの人には、あつが一度も出ない(名前・顔の列・セリフのどこにも)。差し替えの行が出る
//   ③ 解放ありの人には、あつのセリフが出て、差し替えの行は出ない
//   ④ 再生しても保存は何も変わらない(デバッグの一覧は見ただけにしない)・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8936;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// お話ごとの行の数(解放あり・なし)と、写真を撮る行(0から)と、その行に出るはずの文
const STORIES = [
  { id: 'raid_jack_story_6', title: '第6部', lines: { with: 34, without: 32 }, shot: 3, withText: '間に合った……いや、もう終わったんだね', withoutText: '……終わった、みたいだな' },
  { id: 'raid_jack_ending_cleared', title: '終章(倒せた)', lines: { with: 48, without: 48 }, shot: 4, withText: '主役、ちょっと緊張してるかもね', withoutText: '主役は、ちょっと緊張しているかもしれないでつね' },
  { id: 'raid_jack_ending_notcleared', title: '終章(倒せなかった)', lines: { with: 47, without: 47 }, shot: 2, withText: '今回は、ジャックの勝ちだ', withoutText: '……今回は、ジャックの勝ちだな' },
  { id: 'kyuko_join_2026_10_22', title: 'きゅうこの加入', lines: { with: 55, without: 55 }, shot: 33, withText: 'あつニキ、ひさしぶりぃ', withoutText: 'あ、知っててくれたんだぁ' },
];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const seed = eventStorySeed();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const atsu of ['with', 'without']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      // 自分で Supabase を差し替える検査は印を入れる(印が無いと、差し替え先へ届く前にゲーム側が空の返事で止める。2026-10-27)
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      });
      await page.addInitScript(seed);
      // 解放あり … あつの加入のお話を見たことにする / 解放なし … 見ていないことにする(ほかの既読はそのまま)
      await page.addInitScript(([key, on]) => {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]').filter((id) => id !== 'atsu_join_2026_10_22');
          if (on) list.push('atsu_join_2026_10_22');
          localStorage.setItem(key, JSON.stringify(list));
        } catch (e) { /* 検査の種が壊れていたら、本体の既定に任せる */ }
      }, [(fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8').match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1], atsu === 'with']);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300);
      }
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      const keysBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay/i.test(k)))));
      const listBtn = page.locator('[data-debug-story-list]');
      await listBtn.evaluate((el) => { let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } });
      await listBtn.dispatchEvent('click');
      await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
      const label = atsu === 'with' ? 'あつ解放あり' : 'あつ解放なし';
      for (const st of STORIES) {
        await page.locator(`[data-debug-story-item="${st.id}"]`).dispatchEvent('click');
        const dlg = page.locator('[role="dialog"][aria-label^="イベント回想"]');
        await dlg.waitFor({ timeout: 10000 });
        const texts = [];
        for (let i = 0; i < 200; i++) {
          if (await dlg.count() === 0) break;
          texts.push(await dlg.innerText());
          if (i === st.shot && SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOT_DIR, `${st.id}-${atsu}.png`) }); }
          await dlg.locator('button[aria-label="次へ"]').dispatchEvent('click').catch(() => {});
          await page.waitForTimeout(40);
        }
        const want = st.lines[atsu];
        // 行の数は画面の「◯ / ◯」で数える(曲が流れて止まる行では「次へ」が空振りするので、押した回数では数えない)
        const steps = texts.map((t) => (/(\d+)\s*\/\s*(\d+)/.exec(t) || []).slice(1).map(Number)).filter((x) => x.length === 2);
        const total = steps.length ? steps[0][1] : 0, seen = new Set(steps.map((x) => x[0]));
        check(`① ${label} ${st.title}: 最後まで送れて、${want}行`, total === want && seen.size === want && seen.has(want), `全部で ${total}行・見た行 ${seen.size}`);
        const all = texts.join('\n');
        if (atsu === 'without') {
          check(`② ${label} ${st.title}: あつが一度も出ない・差し替えの行が出る`, !/あつ/.test(all) && all.includes(st.withoutText), (all.match(/.{0,12}あつ.{0,12}/) || [''])[0]);
        } else {
          check(`③ ${label} ${st.title}: あつのセリフが出て、差し替えの行は出ない`, all.includes(st.withText) && !all.includes(st.withoutText));
        }
        await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
      }
      const keysAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay/i.test(k)))));
      check(`④ ${label}: 再生しても保存は変わらない・実行時エラーが無い`, keysBefore === keysAfter && errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
