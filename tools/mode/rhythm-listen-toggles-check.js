#!/usr/bin/env node
// 曲鑑賞の画面の入/切を、本物の画面で押して確かめる(2026-11-24 r1119-162 社長「判定とかコンボの入りきりをひとにまとめないで」
// 「横向きだけど動画用にも使いたいから実際は演奏するときと同じ表示にもできるように秒数すすめる戻るもいりきりほしい」)。
//   node tools/mode/rhythm-listen-toggles-check.js      (MH_SHOT_DIR=<フォルダ> で止め絵も撮る)
// 見るもの(縦390・縦320・横844・小さい横568・🔄横):
//   ・判定とコンボのボタンが別々にあり、押すと片方だけが切れる(覚え先は新しいキー mh_rhythm_listen_judge_v1・mh_rhythm_listen_combo_v1。前のキー mh_rhythm_listen_hud_v1 は書かない)
//   ・下の操作のボタン(-10秒・止める・+10秒・判定・コンボ・隠す)が画面に収まり、重ならない
//   ・「操作を隠す」で操作・✕・鑑賞の札が消え、上の表示がふつうに遊ぶ時と同じ形(スコア・ライフ・ポーズ)になる。画面を叩くと操作が戻る
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SONG = 'zenbu_hissatsuwaza', DIFF = 'HELL', GPU = false, SHOT = null;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail && !ok ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
  put('mh_rhythm_owned_songs_v1', [${JSON.stringify(songId)}, ${JSON.stringify(songId.replace(/_short$/, ''))}]);   // 有料の曲も鑑賞できるように
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', ...(GPU ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
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
  await context.addInitScript(seed(SONG));
  if (GPU) await context.addInitScript(() => { try { localStorage.setItem('mh_rhythm_canvas_v1', 'webgl'); } catch (_) {} });
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
  await page.evaluate((id) => {
    const head = typeof rhythmSongVersionHead === 'function' ? rhythmSongVersionHead(id) : id;
    (document.querySelector(`[data-rhythm-song-row="${id}"]`) || document.querySelector(`[data-rhythm-song-row="${head}"]`))?.click();
  }, SONG); await page.waitForTimeout(1200);
  await page.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-version="${id}"]`); if (b && b.getAttribute('aria-pressed') !== 'true') b.click(); }, SONG); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-rhythm-song-art-zoom]')?.click()); await page.waitForTimeout(1000);
  const picked = await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-listen-diff="${d}"]`); if (!b) return false; b.click(); return true; }, DIFF);
  if (!picked) { const have = await page.evaluate(() => [...document.querySelectorAll('[data-rhythm-listen-diff]')].map(b => b.getAttribute('data-rhythm-listen-diff')).join(',') + ' / ' + (document.querySelector('[data-rhythm-listen-panel]')?.parentElement?.innerText || '').slice(0, 80)); throw new Error(`鑑賞の難易度 ${DIFF} を選べない(選べるのは ${have})`); }
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('[data-rhythm-listen-start]')?.click());
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 0, null, { timeout: 40000, polling: 100 });
  const SIZES = [[390, 844, 0, '縦390'], [320, 568, 0, '縦320'], [844, 390, 0, '横844'], [568, 320, 0, '小さい横568'], [390, 844, 90, '🔄横390']];
  const vis = () => page.evaluate(() => {
    const box = s => { const e = [...document.querySelectorAll(s)].find(x => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).display !== 'none'; }); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const btns = [...document.querySelectorAll('[data-rhythm-listen-bar] button')].filter(b => b.getBoundingClientRect().width > 0).map(b => { const r = b.getBoundingClientRect(); return { n: (b.getAttribute('aria-label') || b.textContent).slice(0, 14), l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, clip: b.scrollWidth > b.clientWidth + 1 }; });
    const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
    const over = []; for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) if (hit(btns[i], btns[j])) over.push(`${btns[i].n}×${btns[j].n}`);
    const out = btns.filter(b => b.l < -1 || b.t < -1 || b.r > innerWidth + 1 || b.b > innerHeight + 1).map(b => b.n);
    const small = btns.filter(b => Math.min(b.w, b.h) < 36).map(b => `${b.n}(${Math.round(b.w)}×${Math.round(b.h)})`);
    const clip = btns.filter(b => b.clip).map(b => b.n);
    return { bar: !!box('[data-rhythm-listen-bar]'), close: !!box('[data-rhythm-listen-close]'), badge: !!box('[data-rhythm-listen-badge]'), reveal: !!box('[data-rhythm-listen-reveal]'),
      judge: !!box('[data-rhythm-listen-toggle="judge"]'), combo: !!box('[data-rhythm-listen-toggle="combo"]'), hide: !!box('[data-rhythm-listen-hide]'),
      hudRight: !!box('[data-rhythm-hud-right]'), pauseHud: !!box('[data-rhythm-pause]'), comboShown: !!box('[data-rhythm-combo-box]'),
      hideCss: [...document.querySelectorAll('style')].some(s => s.textContent.includes('[data-rhythm-pace],[data-rhythm-timing-meter]')),
      n: btns.length, over, out, small, clip,
      keys: { judge: localStorage.getItem('mh_rhythm_listen_judge_v1'), combo: localStorage.getItem('mh_rhythm_listen_combo_v1'), hud: localStorage.getItem('mh_rhythm_listen_hud_v1') } };
  });
  const resume = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^再開/.test(x.textContent.trim())); if (b) b.click(); });
  const shot = async (name) => { if (process.env.MH_SHOT_DIR) await page.screenshot({ path: path.join(process.env.MH_SHOT_DIR, `listen-${name}.png`) }); };
  const click = (s) => page.evaluate((s) => { const e = [...document.querySelectorAll(s)].find(x => x.getBoundingClientRect().width > 0); if (e) e.click(); return !!e; }, s);
  for (const [w, h, rot, lab] of SIZES) {
    await page.setViewportSize({ width: w, height: h }); await page.evaluate(d => { try { RHYTHM_VIEW_ROTATION.set(d); } catch (_) {} }, rot);
    await page.waitForTimeout(1300); await resume(); await page.waitForTimeout(1500);
    // 既定(どれも入)
    let g = await vis();
    check(`${lab}: 判定・コンボ・操作を隠すのボタンが別々にある`, g.judge && g.combo && g.hide, JSON.stringify(g));
    check(`${lab}: 操作のボタン(${g.n}個)が画面に収まり、重ならず、押せる大きさで、字が切れない`, g.n >= 6 && !g.over.length && !g.out.length && !g.small.length && !g.clip.length, JSON.stringify({ over: g.over, out: g.out, small: g.small, clip: g.clip }));
    check(`${lab}: 鑑賞の見た目(スコア・ライフは隠す)`, g.hideCss && g.close, JSON.stringify(g));
    await shot(`${lab}-1-既定`);
    // 判定だけ切る → コンボだけ切る
    await click('[data-rhythm-listen-toggle="judge"]'); await page.waitForTimeout(1500);
    g = await vis();
    check(`${lab}: 判定を切ると判定だけ切れて、コンボは入のまま(新しいキーに覚える・前のキーは書かない)`, g.keys.judge === '0' && g.keys.combo !== '0' && g.keys.hud === null, JSON.stringify(g.keys));
    await shot(`${lab}-2-判定切`);
    await click('[data-rhythm-listen-toggle="judge"]'); await click('[data-rhythm-listen-toggle="combo"]'); await page.waitForTimeout(1500);
    g = await vis();
    check(`${lab}: コンボを切るとコンボ数が消え、判定は入に戻る`, g.keys.judge === '1' && g.keys.combo === '0' && !g.comboShown, JSON.stringify({ k: g.keys, combo: g.comboShown }));
    await shot(`${lab}-3-コンボ切`);
    await click('[data-rhythm-listen-toggle="combo"]'); await page.waitForTimeout(300);
    // 操作を隠す → 演奏する時と同じ形 → 叩くと戻る
    await click('[data-rhythm-listen-hide]'); await page.waitForTimeout(1500);
    g = await vis();
    check(`${lab}: 操作を隠すと、操作・✕・鑑賞の札が消える`, !g.bar && !g.close && !g.badge, JSON.stringify(g));
    check(`${lab}: 隠したあとは、上の表示がふつうに遊ぶ時と同じ形(スコア・ライフ・ポーズが出る)`, !g.hideCss && g.hudRight && g.pauseHud, JSON.stringify(g));
    check(`${lab}: 隠したあと、戻すための受け口(画面を叩く)がある`, g.reveal, JSON.stringify(g));
    await shot(`${lab}-4-操作を隠す`);
    await page.mouse.click(Math.round(w / 2), Math.round(h / 3)); await page.waitForTimeout(800);
    g = await vis();
    check(`${lab}: 画面を叩くと操作が戻る`, g.bar && g.close && g.hideCss && !g.reveal, JSON.stringify(g));
  }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close(); await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('NG: 検査が途中で止まった — ' + String(e && e.message || e).slice(0, 300)); process.exit(1); });
