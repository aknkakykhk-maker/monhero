#!/usr/bin/env node
// 【速い形】rhythm-tap-position-bot.js と同じ確かめを、曲を流さずに画面ごと1回で全譜面へ当てる(2026-10-12)。
// 判定ラインの上の「描く位置」は、ノーツと画面の大きさ(プレイエリア・判定ラインの高さ・ノーツの高さ)だけで決まり、曲の流れには
// よらない(押される前のノーツの横の位置は note.lane・判定ラインに来たときは yPx=judgmentY)。そこで、1曲を始めて描く口から
// ノーツの高さを1つ取り、ゲームの描く計算 rhythmNoteCanvasGeometry をそのまま全譜面のノーツへ当てて、書き出しは bot と同じ形にする。
// 正しさは、実際に流して控えた bot の書き出しと突き合わせて確かめる(--check-against <bot の JSON>)。
//
// 以下はもとの bot の説明:
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
const OUTDIR = arg('outdir', path.join(require('os').tmpdir(), 'tap-static')); fs.mkdirSync(OUTDIR, { recursive: true });
const LIST = arg('list');   // 譜面の一覧(タブ区切り: 曲 難易度 …)。書かなければ公開曲の EXPERT・MASTER と HELL の試作2曲
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

  // 描く口からノーツの高さ(head.h)を1つ取る
  const h = await page.evaluate(() => new Promise((resolve) => { const R = RHYTHM_CANVAS_RENDERER, orig = R.drawNote.bind(R); let done = false;
    R.drawNote = (note, geo, opts) => { if (!done && geo && geo.head && geo.head.h > 0) { done = true; R.drawNote = orig; resolve(geo.head.h); } return orig(note, geo, opts); };
    setTimeout(() => resolve(null), 20000); }));
  if (!(h > 0)) throw new Error('ノーツの高さが取れなかった');
  const list = LIST ? fs.readFileSync(LIST, 'utf8').trim().split('\n').map(l => l.split('\t')) : null;
  const out = await page.evaluate(([h, list]) => {
    const area = document.querySelector('[data-rhythm-play-area]'), a = area.getBoundingClientRect();
    const rectOf = RHYTHM_VIEW_ROTATION.rectOf(area), inRect = RHYTHM_GESTURE_RUNTIME.areaRect(area) || rectOf;
    const l = document.querySelector('[data-rhythm-judgment-line]').getBoundingClientRect(), lineY = l.top + l.height / 2 - a.top;
    const rect = { width: rectOf.width, height: rectOf.height }, yPx = lineY - h / 2, OFF = 20;
    const sub = (x, dy = 0) => rhythmSubLaneCoordinateAtPoint(a.left + x, a.top + lineY + dy, inRect);
    const alt = (x, dy) => rhythmSubLaneCoordinateAtLineIfBelow(a.left + x, a.top + lineY + dy, inRect) ?? null;
    const all = [...RHYTHM_SONGS, ...RHYTHM_PROTO_SONGS];
    const targets = list ? list.map(([s, d]) => [s, d]) : [...RHYTHM_DEMO_SONG_IDS.flatMap(id => ['EXPERT', 'MASTER'].map(d => [id, d])), ['sheriruth_hell_debug', 'HELL'], ['kaze_ga_soyogu_hell_debug', 'HELL'], ['grievous_lady_hell', 'MASTER'], ['against_my_own_shadow_hell_debug', 'HELL']];
    const res = [];
    for (const [song, diff] of targets) {
      const c = (all.find(x => x.songId === song) || { difficulties: {} }).difficulties[diff]; if (!c || !c.notes || !c.notes.length) continue;
      const rows = c.notes.map((n, index) => { const t = n.type; const note = { ...n, index, done: false, activePointerId: null };
        let g = null; try { g = rhythmNoteCanvasGeometry(note, yPx, n.lane, rect, h, null, { chartNowMs: Number(n.timeMs), gpu: true }, 0); } catch (e) { return { index, timeMs: Number(n.timeMs), type: t, err: String(e).slice(0, 80) }; }
        const cx = g.head.cx, w = g.head.w;
        const sky = (Number(n.skyHeight) || 0) > 0 || (t === 'SLIDE' && typeof rhythmSlideSkyAt === 'function' && Array.isArray(n.slidePoints) && rhythmSlideSkyAt(n, Number(n.timeMs)) >= .5);
        return { index, timeMs: Number(n.timeMs), type: t, sky, judgment: null, drawn: { cx: +cx.toFixed(1), w: +w.toFixed(1), dy: +(lineY - g.centerY).toFixed(1), subL: sub(cx - w * .4), subC: sub(cx), subR: sub(cx + w * .4),
          up: [-.4, 0, .4].map(k => sub(cx + w * k, -OFF)), down: [-.4, 0, .4].map(k => sub(cx + w * k, OFF)), downAlt: [-.4, 0, .4].map(k => alt(cx + w * k, OFF)) } }; });
      res.push({ song, diff, rows });
    }
    return { area: { x: a.left, w: a.width, h: a.height, lineY, noteH: h, gpu: !!RHYTHM_CANVAS_RENDERER.gpuBand }, res };
  }, [h, list]);
  for (const r of out.res) fs.writeFileSync(path.join(OUTDIR, `${r.song}-${r.diff}.json`), JSON.stringify({ song: r.song, diff: r.diff, w: W, h: H, road: ROAD || 'default', draw: DRAW, safe: SAFE, static: true, area: out.area, errors, rows: r.rows }));
  console.log(`書き出した: ${out.res.length} 譜面 / ${W}x${H} 道${ROAD || '既定'} ${DRAW} セーフ${SAFE} / 判定ライン ${out.area.lineY.toFixed(1)}px・ノーツの高さ ${h}px・エリア ${out.area.w}x${out.area.h}${errors.length ? ' / ページのエラー ' + errors.join(' | ') : ''}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
