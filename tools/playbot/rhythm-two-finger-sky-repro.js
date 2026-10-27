#!/usr/bin/env node
// 2本指の再現(実ブラウザ): 指1が空中スライドをなぞり、指2が地上のノーツを叩く(2026-10-15 社長「Sheriruth HELL の空スライド中にほかのノーツを拾われる」)。
// 空中の帯は判定ラインの道をそのまま持ち上げた形なので、空中の指は「判定ラインの高さでの横の位置のまま、高さだけ上げる」(ボットと同じ)。
//   node tools/playbot/rhythm-two-finger-sky-repro.js --song sheriruth --diff HELL     (SLIDE=174 TAPS=175,176,177,178,179,180 TAPDX=0.9)
//   SLIDE=150 TAPS=151,152 node tools/playbot/rhythm-two-finger-sky-repro.js --song against_my_own_shadow --diff HELL   (NOFLICK=1 で終点フリックを払わずに離す)
//   OMIT=1 で指2の touchstart の指の一覧から指1を一瞬欠けさせる(iPhone で起きる形)。OMITGAP=90 でそのあと指1の合図を90ms止める(指をじっと置いている)
//   BFLICK=1 で指2のタップも払う動きにする(指2が動くときに指1の空中スライドへ入り込まないかを見る)
//   --root <前の版の worktree> で直す前と比べる。LAG=80 で空中の指を遅らせる。SHOT=40500 SHOTDIR=<フォルダ> で画面写し
// 目安(直したあと): Sheriruth の TAPDX=0.9 で空中スライドも地上の6つも取れる(直す前は地上が6つとも MISS)
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
  // ---- 2本指の再現: 指1が空中スライドをなぞり、指2が地上のノーツを叩く ----
  const SLIDE_I = Number(process.env.SLIDE), TAPS = String(process.env.TAPS || '').split(',').filter(Boolean).map(Number);
  const { touchInputSource: TIS } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));
  const shotP = process.env.SHOT ? (async () => { for (const at of String(process.env.SHOT).split(',').map(Number)) { await page.waitForFunction((m) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= m, at, { timeout: 600000, polling: 'raf' }); await page.screenshot({ path: `${process.env.SHOTDIR || '.'}/shot-${at}.png` }); } })() : null;
  const resP = page.evaluate(async ([sid, si, taps, src, chartKey, lag, tapdx, noflick, bflick, omit, omitgap]) => {
    const area = document.querySelector('[data-rhythm-play-area]');
    const ti = (0, eval)('(' + src.replace(/radiusX: 11, radiusY: 11/g, 'radiusX: 18, radiusY: 18') + ')')(area, 'touch');
    const notes = window.__mhTestHooks.rhythmNotes();
    const chart = RHYTHM_HELL_CHARTS[chartKey], cn = i => chart.notes[i];
    const r = () => RHYTHM_VIEW_ROTATION.rectOf(area);
    const lineR = () => RHYTHM_JUDGMENT_LINE_Y.ratio;
    const ptLane = (laneCenter, sky) => { const rr = r(); const yR = lineR() - (sky > 0 ? RHYTHM_SKY_LIFT.ratio * sky : 0); return { x: rr.left + rr.width * rhythmProjectBoundary(laneCenter, lineR()), y: rr.top + rr.height * yR }; };
    const s = notes[si], sc = cn(si);
    const slidePos = t => { const L = rhythmSlideExpectedLane(sc, t); const sky = rhythmSlideHasSky(sc) ? rhythmSlideSkyAt(sc, t) : 0; return ptLane(L + .5, sky); };
    const events = [];
    events.push({ at: s.timeMs, f: () => ti.send(ti.makeEvents('down', 1, slidePos(s.timeMs))) });
    for (const ti2 of taps) { const n = notes[ti2], c = (n.subLane + (n.subLaneWidth || 2) / 2) / 2 + tapdx, p = ptLane(c, 0);
      if (omit) {
        // iPhone で起きる「合図の中の指の一覧が一瞬欠ける」を真似る: 指2の touchstart の touches に指1が載っていない(次の合図からは載る)
        events.push({ at: n.timeMs, f: () => { const mk = (id, q) => new Touch({ identifier: id, target: area, clientX: q.x, clientY: q.y, pageX: q.x, pageY: q.y, screenX: q.x, screenY: q.y, radiusX: 18, radiusY: 18, force: 1 });
          area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 2, pointerType: 'touch', isPrimary: false, clientX: p.x, clientY: p.y, button: 0, buttons: 1 }));
          area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [mk(2, p)], targetTouches: [mk(2, p)], changedTouches: [mk(2, p)] }));
          ti.makeEvents('down', 2, p).build?.(); window.__mhOmitUntil = window.__mhTestHooks.rhythmSongMs() + omitgap; } });
      } else
      events.push({ at: n.timeMs, f: () => ti.send(ti.makeEvents('down', 2, p)) });
      if (n.type === 'FLICK' || bflick) { events.push({ at: n.timeMs + 25, f: () => ti.send(ti.makeEvents('move', 2, { x: p.x, y: p.y - 30 })) }); events.push({ at: n.timeMs + 45, f: () => ti.send(ti.makeEvents('move', 2, { x: p.x, y: p.y - 60 })) }); events.push({ at: n.timeMs + 60, f: () => ti.send(ti.makeEvents('up', 2, { x: p.x, y: p.y - 60 })) }); }
      else events.push({ at: n.timeMs + 60, f: () => ti.send(ti.makeEvents('up', 2, p)) }); }
    const endFlick = !!(sc.endFlick || s.endFlick);
    let flicking = false;
    if (endFlick && !noflick) { events.push({ at: s.endTimeMs - 40, f: () => { flicking = true; const q = slidePos(s.endTimeMs); ti.send(ti.makeEvents('move', 1, { x: q.x, y: q.y - 30 })); } }); events.push({ at: s.endTimeMs - 20, f: () => { const q = slidePos(s.endTimeMs); ti.send(ti.makeEvents('move', 1, { x: q.x, y: q.y - 70 })); } }); events.push({ at: s.endTimeMs, f: () => { const q = slidePos(s.endTimeMs); ti.send(ti.makeEvents('up', 1, { x: q.x, y: q.y - 70 })); } }); }
    else events.push({ at: s.endTimeMs - 5, f: () => ti.send(ti.makeEvents('up', 1, slidePos(s.endTimeMs))) });
    events.sort((a, b) => a.at - b.at);
    const offLog = [], floatLog = []; let lastMove = 0;
    // 浮いた帯の一覧へ足された瞬間をそのまま捕まえる(毎コマの見回りでは、一瞬で戻ったものを取りこぼす)
    if (typeof RHYTHM_FLOATING_NOTES !== 'undefined' && !RHYTHM_FLOATING_NOTES.__mhWatched) { const add = RHYTHM_FLOATING_NOTES.add.bind(RHYTHM_FLOATING_NOTES); RHYTHM_FLOATING_NOTES.add = x => { try { if (x && x.index === si) floatLog.push('浮' + Math.round(window.__mhTestHooks.rhythmSongMs())); } catch (_) {} return add(x); }; RHYTHM_FLOATING_NOTES.__mhWatched = true; }
    await new Promise(done => { const tick = () => { const ms = window.__mhTestHooks.rhythmSongMs();
      while (events.length && ms >= events[0].at) events.shift().f();
      if (!flicking && ms >= s.timeMs && ms < s.endTimeMs - 5 && ms - lastMove > 16 && !(ms < (window.__mhOmitUntil || 0))) { lastMove = ms; ti.send(ti.makeEvents('move', 1, slidePos(ms - lag))); const off = RHYTHM_GESTURE_RUNTIME.slideOffForIndex(si); if (off) offLog.push(Math.round(ms)); }
      if (events.length) requestAnimationFrame(tick); else setTimeout(done, 700); }; requestAnimationFrame(tick); });
    const rs = window.__mhTestHooks.rhythmNoteResults();
    return { slide: rs[si], taps: taps.map(i => rs[i]), offMs: offLog.length ? offLog[0] + '〜' + offLog[offLog.length - 1] + '(' + offLog.length + 'コマ)' : 'なし', floatMs: floatLog.length ? floatLog.join(',') : 'なし' };
  }, [SONG, SLIDE_I, TAPS, TIS, process.env.CHART || SONG, Number(process.env.LAG || 0), Number(process.env.TAPDX || 0), !!process.env.NOFLICK, !!process.env.BFLICK, !!process.env.OMIT, Number(process.env.OMITGAP || 0)]);
  const res = await resP; if (shotP) await shotP;
  console.log('空中スライド', SLIDE_I, res.slide.judgment, '押し始め', res.slide.holdJudgment, '離し', res.slide.releaseJudgment, '暗い時間', res.offMs, '離した扱い', res.floatMs);
  res.taps.forEach(t => console.log('  地上', t.index, t.judgment, 'ずれ', t.deltaMs == null ? '-' : Math.round(t.deltaMs)));
  if (errors.length) console.log(`  ページのエラー: ${errors.join(' | ')}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
