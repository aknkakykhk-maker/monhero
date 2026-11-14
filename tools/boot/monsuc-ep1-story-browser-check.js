#!/usr/bin/env node
// お話「モンヒロサクセス 第1話 ～一番乗りは、だれだ～」(monsuc_beta_ep1・2026-11-14)を、実際のブラウザで HOME から流す。
// β版の前に先に出す予告のお話(公開の印 monsucStoryEp1・β版の印 monheroSuccess とは別)。台本 docs/progress/monsuc-beta-story/script.md
//
//   node tools/boot/monsuc-ep1-story-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、はじまり(題字)・最初の行・山場・おわりの札の写真を残す
//
//   ① 公開のあとの最初の HOME で、ひとりでに流れる(はじまりに題字ロゴの絵 MSX_LOGO_ART とβの札)
//   ② 最後まで送れて、行の数が台本どおり(あつを解放した人 45行・まだの人 42行)。まだの人には、あつが一度も出ない
//   ③ おわりの札に次回予告「第2話 ～ヒーローへの道～」「モンヒロサクセス β版 近日公開」。モンサクへ行くボタンは無い
//   ④ 見終えると見た印(mh_rhythm_event_story_v1 に monsuc_beta_ep1)が付き、開き直しても二度は流れない・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8941;
const SHOT_DIR = process.env.SHOT_DIR || '';
const ID = 'monsuc_beta_ep1';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.PNG': 'image/png', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const JOIN_ATSU = 'atsu_join_2026_10_22';
const CARD_CUP_STORY = 'card_cup_2026_10_31';
// あつを解放した人/まだの人。山場の写真は「デビューから頂まで」の行
const CASES = [{ atsu: true, lines: 45, shots: true }, { atsu: false, lines: 42, shots: false }];
const CLIMAX = 'デビューから頂まで';
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const storyKey = (fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8').match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1];
  check('⓪ 見た印の保存キーを本体から読める', !!storyKey);
  // 第1話だけは見ていないことにする(ほかのお話は見た扱い。HOME で別のお話が先に流れないように)
  const seed = eventStorySeed({ except: [ID] });
  // 種は最初の読み込みだけ入れる(開き直したときは、本体が書いた見た印をそのまま使って「二度は流れない」を確かめる)
  const seedOnce = { content: `(() => { if (sessionStorage.getItem('mh_check_seeded')) return; ${seed.content} })();` };
  // 個人杯を公開したあと(2026-10-31)は、起動の HOME で個人杯のお話が先に流れて見たことになり、あつの行が出る(あつに会った扱い)。
  //   「あつなし」を確かめるため、検査の中だけ個人杯を公開前に戻す(card-battle-intro-story-browser-check.js と同じ)
  const CUP_OPEN = 'const cardCupOpen = () => true;';
  const compiledRaw = fs.readFileSync(path.join(ROOT, 'monster-hero/game-system.compiled.js'), 'utf8');
  check('⓪ 個人杯の公開の印を、検査の中だけ閉じられる', compiledRaw.includes(CUP_OPEN), `「${CUP_OPEN}」が見つからない(書き方が変わったら、この検査を直す)`);
  const compiledCupClosed = compiledRaw.split(CUP_OPEN).join('const cardCupOpen = () => false;');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const cs of CASES) {
      const label = `あつ${cs.atsu ? 'あり' : 'なし'}`;
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
        put('mh_first_battle_done_v1', true);
      });
      await page.route(/game-system\.compiled\.js/, (route) => route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8', body: compiledCupClosed }));
      await page.addInitScript(seedOnce);
      await page.addInitScript(([key, add, drop]) => {
        if (sessionStorage.getItem('mh_check_seeded')) return; // 開き直したときは、本体が書いた見た印をそのまま使う
        sessionStorage.setItem('mh_check_seeded', '1');
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]').filter((id) => !drop.includes(id));
          localStorage.setItem(key, JSON.stringify([...list, ...add]));
        } catch (e) { /* 種が壊れていたら本体の既定に任せる */ }
      }, [storyKey, cs.atsu ? [JOIN_ATSU] : [], [JOIN_ATSU, CARD_CUP_STORY, ID]]);
      const boot = async () => {
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      };
      await boot();
      const story = page.locator(`[data-event-story="${ID}"]`);
      let appeared = false;
      for (let i = 0; i < 80 && !appeared; i++) {
        appeared = await story.count() > 0;
        if (appeared) break;
        // 先に出る受け取り・案内の窓を閉じる(お話は HOME で待っている)
        const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await b.count() > 0 && await b.isVisible().catch(() => false)) await b.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(500);
      }
      check(`① ${label}: HOME でひとりでに流れる`, appeared);
      if (!appeared) { if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${ID}-not-appeared-${label}.png`) }); } await ctx.close(); continue; }
      const logo = page.locator('[data-story-opening-logo]');
      await logo.waitFor({ timeout: 5000 }).catch(() => {});
      const logoText = await logo.innerText().catch(() => '');
      // 題字は社長のロゴの絵(MSX_LOGO_ART)。絵が読めていて(幅がある)、名前が alt に入っていること
      const art = await page.locator('[data-story-opening-logo-art]').evaluate((img) => ({ ok: img.complete && img.naturalWidth > 0, alt: img.alt, src: img.getAttribute('src') })).catch(() => null);
      check(`① ${label}: はじまりに題字ロゴの絵とβの札`, !!art && art.ok && /モンヒロサクセス/.test(art.alt) && /logo-monhero-success\.png/.test(art.src) && /β/.test(logoText), JSON.stringify(art));
      const shot = async (name) => { if (!SHOT_DIR || !cs.shots) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `${ID}-${name}.png`) }); };
      await page.waitForTimeout(1500); await shot('1-hajimari');
      // 幕開けを飛ばして台本へ
      await page.locator('[data-story-opening-card]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(900);
      await shot('2-saisho');
      const texts = [], stepSeen = new Set();
      let climaxShot = false;
      for (let i = 0; i < 300; i++) {
        if (await page.locator('[data-story-ending]').count() > 0) break;
        if (await story.count() === 0) break;
        const t = await story.innerText().catch(() => '');
        texts.push(t);
        const st = await page.evaluate(() => document.querySelector('[data-event-story]')?.getAttribute('data-story-step'));
        if (st != null) stepSeen.add(Number(st));
        if (!climaxShot && t.includes(CLIMAX)) { climaxShot = true; await page.waitForTimeout(500); await shot('3-yamaba'); }
        await story.locator('button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(60);
      }
      const lineCount = stepSeen.size ? Math.max(...stepSeen) + 1 : 0;
      check(`② ${label}: 最後まで送れて、${cs.lines}行`, lineCount === cs.lines && stepSeen.size === cs.lines, `台本 ${lineCount}行・見た行 ${stepSeen.size}`);
      const all = texts.join('\n');
      if (!cs.atsu) check(`② ${label}: あつが一度も出ない`, !all.includes('あつ') && !all.includes('大会の下見'));
      else check(`② ${label}: あつのセリフが出る`, all.includes('大会の下見'));
      const ending = page.locator('[data-story-ending]');
      await ending.waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(3500);
      const teaser = await page.locator('[data-story-ending-teaser]').innerText().catch(() => '');
      check(`③ ${label}: おわりの札に次回予告`, teaser.includes('第2話') && teaser.includes('ヒーローへの道') && teaser.includes('近日公開'), teaser.replace(/\s+/g, ' '));
      const endText = await ending.innerText().catch(() => '');
      check(`③ ${label}: モンサクへ行くボタンは無い`, !/モンヒロサクセスへ/.test(endText));
      await shot('4-owari');
      await page.locator('[data-story-ending-close]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(1200);
      const seen = await page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }, storyKey);
      check(`④ ${label}: 見終えると見た印が付く`, Array.isArray(seen) && seen.includes(ID));
      // 開き直しても二度は流れない
      await boot();
      let again = false;
      for (let i = 0; i < 12; i++) { if (await story.count() > 0) { again = true; break; } await page.waitForTimeout(500); }
      check(`④ ${label}: 開き直しても二度は流れない`, !again);
      check(`④ ${label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
