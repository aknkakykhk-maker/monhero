#!/usr/bin/env node
// お話「モンヒロサクセス 第2話 ～ヒーローへの道～」(monsuc_beta_ep2・2026-11-15 ココロ4)を、実際のブラウザで HOME から流す。
// β版の公開と同時に出たお話(公開の印 monheroSuccess。もう公開済みなので、本体JSはそのまま使う)。台本 docs/progress/monsuc-beta-story/script.md
//
//   node tools/boot/monsuc-ep2-story-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、はじまり・最初の行・山場・おわりの札・モンサクを開いたところ・飛ばした人への告知の写真を残す(390×844)
//
//   ⓪ 公開の印 monheroSuccess が真(公開済み)
//   ① 見ていない人には、HOME でひとりでに流れる(はじまりは iris。題字ロゴは出さない)
//   ② 最後まで送れて、34行。あつは出ない
//   ③ おわりの札に「🌱 モンヒロサクセスへ」。押すとモンサクが開く。見た印が付き、開き直しても二度は流れない
//   ④ 飛ばした人: 見た印が付き、飛ばした印(mh_monsuc_story_skip_seen_v1)が付く。HOME でみゅあが1回だけ知らせ、閉じると二度と出ない
//   ⑤ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8942;
const SHOT_DIR = process.env.SHOT_DIR || '';
const ID = 'monsuc_beta_ep2';
const SKIP_KEY = 'mh_monsuc_story_skip_seen_v1';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.PNG': 'image/png', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const CLIMAX = 'ヒーローズファイナルで、ヒーローになる';
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const storyKey = (fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8').match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1];
  check('⓪ 見た印の保存キーを本体から読める', !!storyKey);
  const seed = eventStorySeed({ except: [ID] });
  const seedOnce = { content: `(() => { if (sessionStorage.getItem('mh_check_seeded')) return; ${seed.content} })();` };
  const compiledRaw = fs.readFileSync(path.join(ROOT, 'monster-hero/game-system.compiled.js'), 'utf8');
  const released = compiledRaw.includes('monheroSuccess: true,');
  check('⓪ 公開の印 monheroSuccess が真(公開済み)', released, released ? '' : '「monheroSuccess: true,」が見つからない(書き方が変わったら、この検査を直す)');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async (page, name) => { if (!SHOT_DIR) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${ID}-${name}.png`) }); };
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      if (sessionStorage.getItem('mh_check_seeded')) return;
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      put('mh_first_battle_done_v1', true);
    });
    await page.addInitScript(seedOnce);
    await page.addInitScript(([key, drop]) => {
      if (sessionStorage.getItem('mh_check_seeded')) return;
      sessionStorage.setItem('mh_check_seeded', '1');
      try { const list = JSON.parse(localStorage.getItem(key) || '[]').filter((id) => !drop.includes(id)); localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    }, [storyKey, [ID]]);
    const boot = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    };
    return { ctx, page, errors, boot };
  };
  // 先に出る受け取り・案内の窓を閉じながら、want(locator)が出るのを待つ。お話・告知の中のボタンは押さない
  const waitFor = async (page, want, tries = 80) => {
    for (let i = 0; i < tries; i++) {
      if (await want.count() > 0) return true;
      const bs = page.locator('button').filter({ hasText: /受け取る|閉じる|(?:始|はじ)める|OK|あとで読む/ });
      for (let k = 0, n = await bs.count(); k < n; k++) {
        const b = bs.nth(k);
        const inside = await b.evaluate((el) => !!el.closest('[data-event-story],[data-monsuc-story-skip-notice]')).catch(() => true);
        if (!inside && await b.isVisible().catch(() => false)) { await b.dispatchEvent('click').catch(() => {}); break; }
      }
      await page.waitForTimeout(500);
    }
    return want.count().then((n) => n > 0);
  };
  try {
    // ①〜③ 最後まで見る
    {
      const { ctx, page, errors, boot } = await open();
      await boot();
      const story = page.locator(`[data-event-story="${ID}"]`);
      const appeared = await waitFor(page, story);
      check('① 見ていない人には HOME でひとりでに流れる', appeared);
      if (appeared) {
        await page.waitForTimeout(1200);
        check('① はじまりは iris・題字ロゴは出さない', await page.locator('[data-story-opening-card="iris"]').count() > 0 && await page.locator('[data-story-opening-logo]').count() === 0);
        await shot(page, '1-hajimari');
        await page.locator('[data-story-opening-card]').dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(1200);
        await shot(page, '2-saisho');
        const texts = [], stepSeen = new Set();
        let climaxShot = false;
        for (let i = 0; i < 300; i++) {
          if (await page.locator('[data-story-ending]').count() > 0) break;
          if (await story.count() === 0) break;
          const t = await story.innerText().catch(() => '');
          texts.push(t);
          const st = await page.evaluate(() => document.querySelector('[data-event-story]')?.getAttribute('data-story-step'));
          if (st != null) stepSeen.add(Number(st));
          if (!climaxShot && t.includes(CLIMAX)) { climaxShot = true; await page.waitForTimeout(2600); await shot(page, '3-yamaba'); }
          const holdWait = stepSeen.size <= 1 || t.includes('…………すごい') ? 2600 : 60;
          await page.waitForTimeout(holdWait);
          await story.locator('button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {});
        }
        const lineCount = stepSeen.size ? Math.max(...stepSeen) + 1 : 0;
        check('② 最後まで送れて、34行', lineCount === 34 && stepSeen.size === 34, `台本 ${lineCount}行・見た行 ${stepSeen.size}`);
        check('② あつは出ない', !texts.join('\n').includes('あつ'));
        await page.locator('[data-story-ending]').waitFor({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(3800);
        const btn = page.locator('[data-story-ending-open="monsuc"]');
        const label = await btn.innerText().catch(() => '');
        check('③ おわりの札に「🌱 モンヒロサクセスへ」', /🌱\s*モンヒロサクセスへ/.test(label), label);
        await shot(page, '4-owari');
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(2500);
        const msx = await page.locator('[data-msx-view]').count();
        check('③ 押すとモンサクが開く', msx > 0);
        await shot(page, '5-monsuc');
        const seen = await page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }, storyKey);
        check('③ 見終えると見た印が付く', seen.includes(ID));
        const skip = await page.evaluate((k) => localStorage.getItem(k), SKIP_KEY);
        check('③ 最後まで見た人には飛ばした印を付けない', skip == null, String(skip));
        await boot();
        let again = false;
        for (let i = 0; i < 12; i++) { if (await story.count() > 0) { again = true; break; } await page.waitForTimeout(500); }
        check('③ 開き直しても二度は流れない', !again);
      }
      check('⑤ 実行時エラーが無い(見た人)', errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
    // ④ 飛ばす
    {
      const { ctx, page, errors, boot } = await open();
      await boot();
      const story = page.locator(`[data-event-story="${ID}"]`);
      const appeared = await waitFor(page, story);
      check('④ 飛ばす人: HOME で流れる', appeared);
      if (appeared) {
        await page.waitForTimeout(1200);
        await page.locator('[data-story-opening-card]').dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(800);
        await story.getByRole('button', { name: 'スキップ' }).dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(1200);
        const seen = await page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }, storyKey);
        check('④ 飛ばしても見た印が付く', seen.includes(ID));
        const skip = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, SKIP_KEY);
        check('④ 飛ばした印が付く', !!skip && skip.v === 1 && skip.skippedAt > 0 && !skip.shownAt, JSON.stringify(skip));
        const notice = page.locator('[data-monsuc-story-skip-notice]');
        const shown = await waitFor(page, notice, 30);
        const text = await notice.innerText().catch(() => '');
        check('④ みゅあが「HOMEに新しいボタン」と知らせる', shown && /HOMEに新しいボタンが出て/.test(text.replace(/\s+/g, '')), text.replace(/\s+/g, ' '));
        await page.waitForTimeout(600);
        await shot(page, '6-skip-kokuchi');
        await notice.getByRole('button', { name: '閉じる' }).dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(800);
        await shot(page, '7-home-after');
        const skip2 = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, SKIP_KEY);
        check('④ 閉じると告知を出した印が付く', !!skip2 && skip2.shownAt > 0, JSON.stringify(skip2));
        await boot();
        let again = false;
        for (let i = 0; i < 16; i++) { if (await notice.count() > 0 || await story.count() > 0) { again = true; break; } await page.waitForTimeout(500); }
        check('④ 開き直しても、お話も告知も二度は出ない', !again);
      }
      check('⑤ 実行時エラーが無い(飛ばした人)', errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
