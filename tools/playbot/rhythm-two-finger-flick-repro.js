#!/usr/bin/env node
// 2本指の再現(実ブラウザ): Crazy Party Night フル MASTER の最後。右指でスライド789 → 終わりでフリック791。左指はホールド788 → TAP790(2026-10-15 社長)
//   FORM=keep node tools/playbot/rhythm-two-finger-flick-repro.js --song crazy_party_night_full --diff MASTER   指を上げずに払う
//   FORM=lift …                                                                                             一度上げてから払う
// 目安(直したあと): どちらでも 791 が取れる(直す前は keep で 791 が MISS)。難易度の選び直しが外れて EASY で始まることがあるので、そのときは回し直す
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const ROOT = path.resolve(arg('root', ROOT_DEFAULT));
const SONG = arg('song', 'sheriruth'), DIFF = arg('diff', 'MASTER'), ENTRY = arg('entry', 'select');
const FROM = Number(arg('from', 104000)), TO = Number(arg('to', 112000)), CPU = Number(arg('cpu', 1));
const LAND = arg('landscape', '1') !== '0';
const DRAW = arg('draw', ''), BAND = arg('band', '');
const W = LAND ? 844 : 390, H = LAND ? 390 : 844;
const FUNCS = ['paintCanvasNote', 'drawNote', 'drawSlide', 'drawHead', 'rhythmNoteCanvasGeometry', 'rhythmSlideSegmentQuads', 'rhythmSlideCheckpointLines', 'drawSlideGpu', 'pushSlideGround', 'rhythmRestartAnimations', 'visitNote', 'tick',
  ...String(arg('funcs', '')).split(',').filter(Boolean)];
const { chromium } = require(path.join(ROOT_DEFAULT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT_DEFAULT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));

const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  ${DRAW ? `localStorage.setItem('mh_rhythm_canvas_v1', ${JSON.stringify(DRAW)});` : ''}
  ${BAND ? `localStorage.setItem('mh_rhythm_gpu_band_v1', ${JSON.stringify(BAND)});` : DRAW === 'webgl' ? `localStorage.setItem('mh_rhythm_gpu_band_v1', 'off');` : ''}
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  // 上の難易度を開けておく(曲えらびから MASTER などを選べるように)
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    const m = u.match(/^https:\/\/sky\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) {
      if (req.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return route.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(route);
    }
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed(SONG));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
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
  let started = false;
  if (ENTRY === 'select') {
    await clickText('モンヒロビート$'); await page.waitForTimeout(2500); await closeDialogs(6);
    await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
    // 曲の名前は曲えらびの表示名で探す(songId から表示名を引く)
    const name = await page.evaluate((id) => (RHYTHM_SONGS.find(s => s.songId === id) || {}).displayName || id, SONG);
    await clickText('^' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); await page.waitForTimeout(1200);
    await clickText(DIFF); await page.waitForTimeout(800);
    started = await clickText('^(▶\\s*)?決定$');
  } else {
    await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    await clickText('💊'); await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
    started = await page.evaluate(async ([song, diff, entry]) => {
      if (entry === 'proto') { const b = document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start="${diff}"]`) || document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start]`); if (b) b.click(); return !!b; }
      // 公開曲は、デバッグの全解放の曲えらび(記録しない・2026-10-11 古い縦の一覧を外した)から始める。曲は id で探す(同じ曲名の版があるため)
      document.querySelector('[data-rhythm-debug-select-open]')?.click();
      await new Promise(r => setTimeout(r, 1200));
      const target = [...RHYTHM_SONGS, ...RHYTHM_PROTO_SONGS].find(x => x.songId === song); if (!target) return false;
      const row = [...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]')].find(r => r.textContent.includes(target.displayName) && (!target.subtitle || r.textContent.includes(target.subtitle)));
      if (!row) return false; row.click(); await new Promise(r => setTimeout(r, 500));
      document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="' + diff + '"]')?.click(); await new Promise(r => setTimeout(r, 400));
      const b = document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-start="' + diff + '"]'); if (b) b.click(); return !!b;
    }, [SONG, DIFF, ENTRY]);
  }
  if (!started) throw new Error(`曲を始められなかった(${ENTRY} ${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  const playing = await page.evaluate(() => ({ notes: (window.__mhTestHooks.rhythmNotes() || []).length, title: (document.querySelector('[data-rhythm-play-area]')?.closest('main')?.innerText || '').split('\n').slice(0, 4).join(' ') }));
  const backend = await page.evaluate(() => ({ backend: document.querySelector('[data-rhythm-note-backend]')?.dataset.rhythmNoteBackend || '', band: typeof RHYTHM_CANVAS_RENDERER === 'object' ? RHYTHM_CANVAS_RENDERER.gpuBand : false }));
  console.log(`演奏: ノーツ ${playing.notes} / ${playing.title.slice(0, 60)} / 描き方 ${backend.backend || '?'}${backend.band ? '・帯は GPU' : ''}`);
  // ---- Crazy Party Night フル MASTER の最後: 右指でスライド789 → 終わりでフリック791。左指はホールド788 → TAP790 ----
  const FORM = process.env.FORM || 'keep';   // keep=指を上げずに払う / lift=一度上げてから払う
  const { touchInputSource: TIS } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));
  const res = await page.evaluate(async ([src, form, diff]) => {
    const area = document.querySelector('[data-rhythm-play-area]');
    const ti = (0, eval)('(' + src.replace(/radiusX: 11, radiusY: 11/g, 'radiusX: 18, radiusY: 18') + ')')(area, 'touch');
    const notes = window.__mhTestHooks.rhythmNotes();
    const chart = RHYTHM_SONGS.find(s => s.songId === 'crazy_party_night_full').difficulties[diff];
    const rr = RHYTHM_VIEW_ROTATION.rectOf(area), lineR = RHYTHM_JUDGMENT_LINE_Y.ratio;
    const at = c => ({ x: rr.left + rr.width * rhythmProjectBoundary(c, lineR), y: rr.top + rr.height * lineR });
    const tapC = n => (n.subLane + (n.subLaneWidth || 2) / 2) / 2;
    const sl = notes[789], slc = chart.notes[789], hold = notes[788], tap = notes[790], fl = notes[791];
    const slidePos = t => at(rhythmSlideExpectedLane(slc, t) + .5);
    const ev = [];
    ev.push({ at: hold.timeMs, f: () => ti.send(ti.makeEvents('down', 1, at(tapC(hold)))) });
    ev.push({ at: hold.endTimeMs - 5, f: () => ti.send(ti.makeEvents('up', 1, at(tapC(hold)))) });
    ev.push({ at: tap.timeMs, f: () => ti.send(ti.makeEvents('down', 1, at(tapC(tap)))) });
    ev.push({ at: tap.timeMs + 50, f: () => ti.send(ti.makeEvents('up', 1, at(tapC(tap)))) });
    ev.push({ at: sl.timeMs, f: () => ti.send(ti.makeEvents('down', 2, slidePos(sl.timeMs))) });
    let following = true;
    const end = sl.endTimeMs, p = slidePos(end);
    if (form === 'keep') {
      ev.push({ at: end - 10, f: () => { following = false; ti.send(ti.makeEvents('move', 2, { x: p.x + 30, y: p.y })); } });
      [[5, 50], [20, 75], [35, 100], [50, 125]].forEach(([dt, dx]) => ev.push({ at: end + dt, f: () => ti.send(ti.makeEvents('move', 2, { x: p.x + dx, y: p.y })) }));
      ev.push({ at: end + 60, f: () => ti.send(ti.makeEvents('up', 2, { x: p.x + 125, y: p.y })) });
    } else {
      ev.push({ at: end - 15, f: () => { following = false; ti.send(ti.makeEvents('up', 2, p)); } });
      ev.push({ at: end + 5, f: () => ti.send(ti.makeEvents('down', 3, p)) });
      ev.push({ at: end + 25, f: () => ti.send(ti.makeEvents('move', 3, { x: p.x + 35, y: p.y })) });
      ev.push({ at: end + 40, f: () => ti.send(ti.makeEvents('move', 3, { x: p.x + 75, y: p.y })) });
      ev.push({ at: end + 55, f: () => ti.send(ti.makeEvents('up', 3, { x: p.x + 75, y: p.y })) });
    }
    ev.sort((a, b) => a.at - b.at); let last = 0;
    await new Promise(done => { const tick = () => { const ms = window.__mhTestHooks.rhythmSongMs();
      while (ev.length && ms >= ev[0].at) ev.shift().f();
      if (following && ms >= sl.timeMs && ms < end && ms - last > 16) { last = ms; ti.send(ti.makeEvents('move', 2, slidePos(ms))); }
      if (ev.length) requestAnimationFrame(tick); else setTimeout(done, 800); }; requestAnimationFrame(tick); });
    const rs = window.__mhTestHooks.rhythmNoteResults();
    return [788, 789, 790, 791].map(i => rs[i]);
  }, [TIS, FORM, DIFF]);
  res.forEach(r => console.log('  ', r.index, r.judgment, 'ずれ', r.deltaMs == null ? '-' : Math.round(r.deltaMs), '押し始め', r.holdJudgment || '-', '離し', r.releaseJudgment || '-'));
  if (errors.length) console.log(`  ページのエラー: ${errors.join(' | ')}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
