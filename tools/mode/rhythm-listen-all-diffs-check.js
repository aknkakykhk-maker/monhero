#!/usr/bin/env node
// 曲鑑賞は、難易度の鍵に関係なく、はじめから HELL まで全部の難易度を選べるか(2026-11-24 r1119-168 社長「モンビーの鑑賞ははじめからヘルまでできるようにして」)。
//   node tools/mode/rhythm-listen-all-diffs-check.js      (MH_SHOT_DIR=<フォルダ> で縦・横の止め絵も撮る)
// どの曲もクリアしていない新しい記録で、本物の画面を縦(390×844)と横(844×390)で開いて見る:
//   ・曲の詳細の窓の鑑賞の欄に、譜面のある難易度が HELL まで全部出る(EXPERT・MASTER・HELL は演奏ではまだ鍵)
//   ・演奏の難易度の札は今のまま鍵(EXPERT・MASTER・HELL が押せない)。HELL を鑑賞しても演奏の難易度は鍵の難易度にならない
//   ・鑑賞の HELL を選んで始めると、本当に HELL の譜面が流れる(鑑賞中の札が HELL)
//   ・鑑賞のあと、自己ベスト・クリアの記録(mh_rhythm_best_v1)が増えない
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail && !ok ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const SONG = 'zenbu_hissatsuwaza';
const LOCKED = ['EXPERT', 'MASTER', 'HELL'];

const run = async (browser, w, h, lab) => {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const u = route.request().url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) return sb.handle(route);
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  // クリアの記録は入れない(どの難易度も鍵のまま)。有料の曲でも鑑賞の欄が出るように、曲は持っている扱いにする
  await context.addInitScript(`(() => {
    const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
    put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
    put('mh_rhythm_owned_songs_v1', [${JSON.stringify(SONG)}, ${JSON.stringify(SONG + '_short')}]);
  })()`);
  await context.addInitScript(eventStorySeed());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
  await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
  const openDetail = async () => {
    await page.evaluate((id) => {
      const head = typeof rhythmSongVersionHead === 'function' ? rhythmSongVersionHead(id) : id;
      (document.querySelector(`[data-rhythm-song-row="${id}"]`) || document.querySelector(`[data-rhythm-song-row="${head}"]`))?.click();
    }, SONG); await page.waitForTimeout(1200);
    await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-version="${id}"]`); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }, SONG); await page.waitForTimeout(800);
  };
  await openDetail();
  const playState = () => page.evaluate(() => [...document.querySelectorAll('[data-rhythm-difficulty]')].filter(b => b.getBoundingClientRect().width > 0)
    .map(b => ({ id: b.getAttribute('data-rhythm-difficulty'), locked: b.getAttribute('data-rhythm-difficulty-locked') === '1', on: b.getAttribute('aria-pressed') === 'true' })));
  const play = await playState();
  const playIds = play.map(p => p.id);
  check(`${lab}: 演奏の難易度の札は今のまま鍵(EXPERT・MASTER・HELL が押せない)`, LOCKED.filter(d => playIds.includes(d)).every(d => play.find(p => p.id === d).locked) && playIds.includes('HELL'), JSON.stringify(play));
  await page.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click()); await page.waitForTimeout(1000);
  const listenIds = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map(b => b.getAttribute('data-rhythm-listen-diff')));
  check(`${lab}: 鑑賞の欄に、譜面のある難易度が HELL まで全部出る(${listenIds.join('・')})`, playIds.length > 0 && playIds.every(d => listenIds.includes(d)) && listenIds.includes('HELL'), `演奏の札 ${playIds.join(',')} / 鑑賞 ${listenIds.join(',')}`);
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-diff="HELL"]')?.click()); await page.waitForTimeout(500);
  const hellOn = await page.evaluate(() => document.querySelector('[data-rhythm-listen-diff="HELL"]')?.getAttribute('aria-pressed') === 'true');
  check(`${lab}: 鑑賞の HELL を選べる`, hellOn);
  if (process.env.MH_SHOT_DIR) {
    await page.evaluate(() => document.querySelector('[data-rhythm-listen-panel]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(process.env.MH_SHOT_DIR, `listen-all-diffs-${lab}.png`) });
  }
  const bestBefore = await page.evaluate(() => localStorage.getItem('mh_rhythm_best_v1'));
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 0, null, { timeout: 40000, polling: 100 }).catch(() => {});
  await page.waitForTimeout(1500);
  const badge = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-badge]')].map(e => e.textContent).join(' ') || (document.querySelector('[data-rhythm-listen-close]') ? '(札なし・鑑賞中)' : ''));
  const songMs = await page.evaluate(() => window.__mhTestHooks?.rhythmSongMs?.() ?? -1);
  check(`${lab}: 鑑賞の HELL を始めると HELL の譜面が流れる`, songMs > 0 && (/HELL/.test(badge) || (badge === '(札なし・鑑賞中)')), `札「${badge}」 曲の時刻 ${songMs}`);
  if (process.env.MH_SHOT_DIR) await page.screenshot({ path: path.join(process.env.MH_SHOT_DIR, `listen-all-diffs-${lab}-鑑賞中.png`) });
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-close]')?.click()); await page.waitForTimeout(2500); await closeDialogs(3);
  const bestAfter = await page.evaluate(() => localStorage.getItem('mh_rhythm_best_v1'));
  check(`${lab}: 鑑賞のあと、自己ベスト・クリアの記録が増えない`, bestAfter === bestBefore, `${bestBefore} → ${bestAfter}`);
  await openDetail();
  const after = await playState();
  const sel = after.find(p => p.on);
  check(`${lab}: 鑑賞のあとも演奏の HELL は鍵のまま・選んでいる演奏の難易度は鍵のない難易度`, !!sel && !sel.locked && after.find(p => p.id === 'HELL')?.locked === true, JSON.stringify(after));
  check(`${lab}: ページのエラーが出ない`, errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close();
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  await run(browser, 390, 844, '縦');
  await run(browser, 844, 390, '横');
  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('NG: 検査が途中で止まった — ' + String(e && e.message || e).slice(0, 300)); process.exit(1); });
