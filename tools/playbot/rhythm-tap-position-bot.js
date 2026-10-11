#!/usr/bin/env node
// 「画面に描かれたノーツの位置」と「判定が受け付ける位置」がずれていないかを、実際の画面で確かめる(2026-10-12 社長
// 「全曲エキスパート以上のノーツのタップ位置の確認作業をして。今まで押しづらいとかうまく反応しないのって判定位置のズレとかあるんじゃない？」)。
//
// 【やり方】ボットに1譜面を最後まで遊ばせる。そのあいだ、描く口 RHYTHM_CANVAS_RENDERER.drawNote に渡る「描く座標」
// (rhythmNoteCanvasGeometry の head の中心 cx・幅 w・高さ centerY)をノーツごとに毎コマ控える。GPU で描くときも 2D で描くときも同じ口を通る。
//   ① ボットは、各ノーツが判定ラインに来た瞬間に「描かれたノーツの真ん中」(控えた座標を判定ラインの高さへ延ばした位置)を押す。
//      空中のノーツは空中の線の高さで押す(横の位置は描かれた位置)。スライド・ホールドの押さえ続けはボットのいつもの追い方
//   ② 描かれたノーツの左右の端の少し内側(幅の 10% 内側)と真ん中を、ゲームの「押した位置→サブレーン」の計算
//      (rhythmSubLaneCoordinateAtPoint・入力と同じ rect)に通して書き出す。取れるかどうかは rhythm-tap-position-report.js が
//      判定の関数 rhythmMatchInputBatch で見る(rhythm-note-reach-scan.js と同じ状態の作り方)
// 本物の Supabase へは1件も送らない(偽の Supabase)。デバッグの全解放の曲えらび(記録しない)から始める。
//
//   node tools/playbot/rhythm-tap-position-bot.js --song grievous_lady --diff MASTER --out /tmp/gl.json
//     [--w 844 --h 390] [--road WIDE|STANDARD|NARROW] [--draw gpu|2d] [--safe 0|47] [--entry debug|proto]
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const SONG = arg('song', 'grievous_lady'), DIFF = arg('diff', 'MASTER'), ENTRY = arg('entry', 'debug');
const W = Number(arg('w', 844)), H = Number(arg('h', 390)), ROAD = arg('road', ''), DRAW = arg('draw', 'gpu'), SAFE = Number(arg('safe', 0));
const OUT = arg('out', path.join(require('os').tmpdir(), `tap-${SONG}-${DIFF}.json`));
const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT, 'tools/playbot/lib/touch-input.js'));

const seed = (songId, road, draw) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
  // 道の幅(設定)。書かなければ既定のまま
  if (${JSON.stringify(road)}) { let s = {}; try { s = JSON.parse(localStorage.getItem('mh_rhythm_settings_v1') || '{}') || {}; } catch {} s.roadWidth = ${JSON.stringify(road)}; localStorage.setItem('mh_rhythm_settings_v1', JSON.stringify(s)); }
  // 描き方: gpu = 既定(GPU の帯)/ 2d = GPU の帯を切る
  localStorage.setItem('mh_rhythm_gpu_band_v1', ${JSON.stringify(draw === '2d' ? 'off' : 'gpu')});
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
  await context.addInitScript(seed(SONG, ROAD, DRAW));
  // 左右のセーフエリア(切り欠きのある横持ちの iPhone のつもり)。index.html の --mh-safe-left/right を上書きする
  if (SAFE > 0) await context.addInitScript((px) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.setProperty('--mh-safe-left', px + 'px'); document.documentElement.style.setProperty('--mh-safe-right', px + 'px'); }); }, SAFE);
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (!b) return false; const r = b.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerType: 'mouse', isPrimary: true, button: 0 }; b.dispatchEvent(new PointerEvent('pointerdown', o)); b.dispatchEvent(new PointerEvent('pointerup', o)); b.click(); return true; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(400); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
  await clickText('^ヘルプ'); await page.waitForTimeout(900);
  await clickText('💊'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
  const started = await page.evaluate(async ([song, diff, entry]) => {
    if (entry === 'proto') { const b = document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start="${diff}"]`) || document.querySelector(`[data-rhythm-proto-song="${song}"] [data-rhythm-proto-start]`); if (b) b.click(); return !!b; }
    document.querySelector('[data-rhythm-debug-select-open]')?.click();
    await new Promise(r => setTimeout(r, 1200));
    const target = [...RHYTHM_SONGS, ...RHYTHM_PROTO_SONGS].find(x => x.songId === song); if (!target) return false;
    // 曲の行は代表の版の id を持つ(版は1行にまとまる・RHYTHM_SONG_VERSION_GROUPS)。行を id で選び、版の切り替えがあればその版を押す
    const group = (typeof RHYTHM_SONG_VERSION_GROUPS !== 'undefined' ? RHYTHM_SONG_VERSION_GROUPS : []).find(g => g.some(([id]) => id === song));
    const ids = group ? group.map(([id]) => id) : [song];
    const row = [...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]')].find(r => ids.includes(r.getAttribute('data-rhythm-song-row')));
    if (!row) return false; row.click(); await new Promise(r => setTimeout(r, 500));
    const v = document.querySelector('[data-rhythm-debug-select] [data-rhythm-song-version="' + song + '"]'); if (v) { v.click(); await new Promise(r => setTimeout(r, 400)); }
    document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="' + diff + '"]')?.click(); await new Promise(r => setTimeout(r, 400));
    const b = document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-start="' + diff + '"]'); if (b) b.click(); return !!b;
  }, [SONG, DIFF, ENTRY]);
  if (!started) throw new Error(`曲を始められなかった(${ENTRY} ${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  // 始まった譜面が目当ての譜面か(ノーツの数と時刻)。違えば止める(別の曲・別の版を測ってしまわないように)
  const same = await page.evaluate(([song, diff]) => { const all = [...RHYTHM_SONGS, ...RHYTHM_PROTO_SONGS]; const c = (all.find(x => x.songId === song) || { difficulties: {} }).difficulties[diff]; const n = window.__mhTestHooks.rhythmNotes() || [];
    return !!c && c.notes.length === n.length && c.notes.every((x, i) => Math.round(x.timeMs) === Math.round(n[i].timeMs)); }, [SONG, DIFF]);
  if (!same) throw new Error(`始まった譜面が ${SONG} ${DIFF} と違う`);
  const info = await page.evaluate(() => ({ notes: (window.__mhTestHooks.rhythmNotes() || []).length, title: (document.querySelector('[data-rhythm-play-area]')?.closest('main')?.innerText || '').split('\n').slice(0, 4).join(' ') }));
  console.log(`演奏: ノーツ ${info.notes} / ${info.title.slice(0, 60)} / ${W}x${H} 道${ROAD || '既定'} ${DRAW} セーフ${SAFE}`);

  // 描く口に控えを挟む。ノーツごとに直近2コマの {centerY, cx, w} を持つ(area 基準の px)
  await page.evaluate(() => {
    const drawn = window.__drawn = new Map();
    const R = RHYTHM_CANVAS_RENDERER, orig = R.drawNote.bind(R);
    R.drawNote = (note, geo, opts) => {
      try { if (note && Number.isFinite(note.index) && geo && geo.head && !note.done && note.activePointerId == null) {   // 押される前のコマだけ(押されたスライド・ホールドは先頭が線に止まり、横も指に合わせて描かれる) const r = drawn.get(note.index) || [];
        const f = { cy: geo.centerY, cx: geo.head.cx, w: geo.head.w };
        if (!r.length || r[r.length - 1].cy !== f.cy) { r.push(f); if (r.length > 2) r.shift(); drawn.set(note.index, r); } } } catch {}
      return orig(note, geo, opts);
    };
    const area = () => document.querySelector('[data-rhythm-play-area]');
    // 判定ラインの高さ(area 基準の px)。描く座標の centerY と同じ基準(ノーツの真ん中が線に重なる高さ)
    window.__lineY = () => { const a = area().getBoundingClientRect(), l = document.querySelector('[data-rhythm-judgment-line]').getBoundingClientRect(); return l.top + l.height / 2 - a.top; };
    // 控えた2コマから、判定ラインの高さでの横の位置と幅を出す(奥行きで x と幅は y に沿って変わるので、直線で延ばす)
    window.__drawnAtLine = (index) => { const r = drawn.get(index); if (!r || !r.length) return null; const y = window.__lineY();
      if (r.length < 2 || r[1].cy === r[0].cy) return { cx: r[r.length - 1].cx, w: r[r.length - 1].w, dy: y - r[r.length - 1].cy };
      const k = (y - r[1].cy) / (r[1].cy - r[0].cy); return { cx: r[1].cx + (r[1].cx - r[0].cx) * k, w: r[1].w + (r[1].w - r[0].w) * k, dy: y - r[1].cy }; };
    window.__drawnX = (n) => { const d = window.__drawnAtLine(n.index); if (!d) return null; return area().getBoundingClientRect().left + d.cx; };
  });
  // ボット: 押す横の位置を「描かれたノーツの真ん中」にする(高さはボットのいつもの決め方・空中のノーツは空中の高さ)
  const target = 'const p = fingerAt(c, hab, null, now);';
  const src = installPlayer.toString();
  if (!src.includes(target)) throw new Error('ボットの押す行が見つからない');
  const posLine = 'const pos = fingerAt(laneOfHold(a.n, now), a.hab, a.drift, now);';
  const skyY = (expr) => `(() => { const q = ${expr}; const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : (window.__slideSkyAt ? window.__slideSkyAt(n, Number(n.timeMs) || 0) : 0); if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })()`;
  let player = src.replace(target, `const p = (() => { const q = ${skyY('fingerAt(c, hab, null, now)')}; const dx = window.__drawnX ? window.__drawnX(n) : null; return dx == null ? q : { x: dx, y: q.y }; })();`);
  if (!player.includes(posLine)) throw new Error('ボットの押さえる指の行が見つからない');
  player = player.replace(posLine, 'const pos = (() => { const q = fingerAt(laneOfHold(a.n, now), a.hab, a.drift, now); if (!window.__slideSkyAt || typeof RHYTHM_SKY_LIFT === "undefined") return q; const sh = window.__slideSkyAt(a.n, now); if (!(sh > 0)) return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();');
  await page.evaluate(([song, diff]) => {
    const all = [...(typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : []), ...(typeof RHYTHM_PROTO_SONGS !== 'undefined' ? RHYTHM_PROTO_SONGS : [])];
    const chart = (all.find(s => s.songId === song) || { difficulties: {} }).difficulties[diff];
    const map = new Map(); ((chart && chart.notes) || []).forEach(x => { if (Array.isArray(x.slidePoints)) map.set(Math.round(Number(x.timeMs)) + ':' + Number(x.lane), x); });
    window.__slideSkyAt = (n, t) => { if (typeof rhythmSlideSkyAt !== 'function') return 0; const o = map.get(Math.round(Number(n.timeMs)) + ':' + Number(n.lane)) || n; return Array.isArray(o.slidePoints) ? rhythmSlideSkyAt(o, t) : 0; };
  }, [SONG, DIFF]);
  const args = { sigma: 0, missRate: 0, seed: 7, human: false, persona: 'center', input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
  await page.evaluate(`(${player})(${JSON.stringify(args)})`);
  // 最後のノーツが済むまで待つ(結果の画面へ移ったら終わり)
  await page.waitForFunction(() => { const r = window.__mhTestHooks?.rhythmNoteResults?.() || []; return !document.querySelector('[data-rhythm-play-area]') || (r.length && r.every(x => x && x.done)); }, null, { timeout: 900000, polling: 500 });
  // 書き出し: ノーツごとに、判定・描いた位置(判定ラインの高さ)・左右の端の 10% 内側と真ん中のサブレーン座標
  const rows = await page.evaluate(() => {
    const n = window.__mhTestHooks.rhythmNotes() || [], r = window.__mhTestHooks.rhythmNoteResults?.() || [];
    const areaEl = document.querySelector('[data-rhythm-play-area]'); const a = areaEl ? areaEl.getBoundingClientRect() : null;
    const rect = areaEl ? (RHYTHM_GESTURE_RUNTIME.areaRect(areaEl) || RHYTHM_VIEW_ROTATION.rectOf(areaEl)) : null;
    const y = areaEl ? window.__lineY() : 0;
    const sub = (x, dy = 0) => rect ? rhythmSubLaneCoordinateAtPoint(a.left + x, a.top + y + dy, rect) : null;
    // 判定ラインより下を押した指は、ゲームが線の高さへ直した位置でも見る(rhythmSubLaneCoordinateAtLineIfBelow)。それも一緒に書く
    const alt = (x, dy) => rect ? (rhythmSubLaneCoordinateAtLineIfBelow(a.left + x, a.top + y + dy, rect) ?? null) : null;
    const OFF = 20;   // 指は線ちょうどより少し上や下を押しがち。上下 20px でも見る
    return n.map((x, i) => { const d = window.__drawnAtLine(x.index ?? i); const t = x._rhythmOriginalType || x.type;
      return { index: x.index ?? i, timeMs: Number(x.timeMs), type: t, sky: (Number(x.skyHeight) || 0) > 0 || (t === 'SLIDE' && window.__slideSkyAt && window.__slideSkyAt(x, Number(x.timeMs)) >= .5),
        judgment: r[i] && r[i].judgment || null,
        drawn: d ? { cx: +d.cx.toFixed(1), w: +d.w.toFixed(1), dy: +d.dy.toFixed(1), subL: sub(d.cx - d.w * .4), subC: sub(d.cx), subR: sub(d.cx + d.w * .4),
          up: [-.4, 0, .4].map(k => sub(d.cx + d.w * k, -OFF)), down: [-.4, 0, .4].map(k => sub(d.cx + d.w * k, OFF)), downAlt: [-.4, 0, .4].map(k => alt(d.cx + d.w * k, OFF)) } : null }; });
  }).catch(() => []);
  const area = await page.evaluate(() => { const e = document.querySelector('[data-rhythm-play-area]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, w: r.width, h: r.height, gpu: !!RHYTHM_CANVAS_RENDERER.gpuBand, backend: String(RHYTHM_CANVAS_RENDERER.backend || '') }; }).catch(() => null);
  fs.writeFileSync(OUT, JSON.stringify({ song: SONG, diff: DIFF, w: W, h: H, road: ROAD || 'default', draw: DRAW, safe: SAFE, area, errors, rows }));
  const h = {}; rows.forEach(x => { h[x.judgment || '-'] = (h[x.judgment || '-'] || 0) + 1; });
  console.log('判定', JSON.stringify(h), '描いた位置が取れなかったノーツ', rows.filter(x => !x.drawn).length, '描き方', JSON.stringify(area), errors.length ? 'ページのエラー ' + errors.join(' | ') : '');
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
