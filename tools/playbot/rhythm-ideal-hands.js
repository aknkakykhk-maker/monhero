#!/usr/bin/env node
// 「理想の人の手」の自動演奏(2026-10-15 社長「ちゃんと押しているのに判定が機能しないのは致命的。全曲・全難易度を機械で洗い出して」)。
//
// 本物のブラウザ(Chromium)で曲を始め、ページの中でタッチ(Touch/TouchEvent と PointerEvent。lib/touch-input.js)を流す。
// 指を何本か持ち(足りなければ足す。何本要ったかを出す)、
//   ・ホールド/スライドは1本の指で押さえたまま、帯をなぞる(時刻ごとに rhythmSlideExpectedLane と rhythmSlideSkyAt で追う)
//   ・ほかのノーツは、空いている別の指で、正しい時刻・位置に押す/払う
// 位置: 地上は判定ラインの高さで rhythmProjectBoundary(レーンの中心, RHYTHM_JUDGMENT_LINE_Y.ratio)。
//       空中は「判定ラインの高さでの横の位置のまま、高さだけ RHYTHM_SKY_LIFT.ratio×高さ ぶん上げる」(空中の帯は判定ラインの道を持ち上げた形)
// 払い: フリックは押して 25ms で 30px・45ms で 60px 払って離す(向きの決まったフリックはその向き、ほかは上)。
//       終点フリック(endFlick)は終わりの 40ms 前から上へ 30→70px 払って、終わりで離す。
//       ロングの終わり(±60ms)のすぐ横にフリックがあるときは、押さえていた指をそのまま払う(--end-flick keep・既定)。
//       --end-flick other なら、押さえていた指は終わりで離し、別の指で払う
// 結果: MISS・BAD(押し始め・離しの MISS・BAD も)が出たノーツを、tools/mode/rhythm-finger-owner-scan.js の形の種類ごとに数える。
//
// 使い方(ゲームは --root のフォルダのものを、そのまま開く。compiled は作り済みのこと):
//   node tools/playbot/rhythm-ideal-hands.js --song sheriruth --diff HELL
//   node tools/playbot/rhythm-ideal-hands.js --song grievous_lady --diff MASTER --root <worktree> --json <ファイル>
//   --lean 0.5       押さえている帯(2レーン以内)のそばのタップ・フリックを、帯の側へ最大 0.5 レーン寄せて押す(太い指の試し。既定 0)。
//                    寄せてもノーツの見えている幅の内側に留める(外を押して取れないのは手の側の都合なので)
//   --end-flick keep|other   上のとおり / --reuse-ids  指の番号を押すたびに使い回す(既定は押すたびに新しい番号・iPhone と同じ)
//   --from <ms> --to <ms>    この区間のノーツだけ押す(ほかは押さない＝MISS になるので、集計もこの区間だけ)
//   --entry debug    デバッグの全解放の曲えらびから始める(既定は曲えらび)
//   --list           MISS・BAD のノーツを1件ずつ出す
//   --rejudge <結果の JSON>  ブラウザを使わず、前の結果の MISS・BAD を --root の判定の関数で見分け直す(下の「見分け」)
// 本物の Supabase へは1件も送らない(偽の Supabase)。保存も新しいセーブの中だけ。重いので同時に何本も回さない。
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const argv = process.argv.slice(2);
const arg = (name, fallback = null) => { const i = argv.indexOf(`--${name}`); return i >= 0 && i + 1 < argv.length && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback; };
const flag = (name) => argv.includes(`--${name}`);
const ROOT = path.resolve(arg('root', ROOT_DEFAULT));
const SONG = arg('song', 'sheriruth'), DIFF = arg('diff', 'MASTER'), ENTRY = arg('entry', 'select');
const LEAN = Number(arg('lean', 0)), END_FLICK = arg('end-flick', 'keep'), REUSE = flag('reuse-ids');
const FROM = Number(arg('from', -1e9)), TO = Number(arg('to', 1e12));
const JSON_OUT = arg('json'), LIST = flag('list');
const W = 844, H = 390;
const { chromium } = require(path.join(ROOT_DEFAULT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));
const scan = require(path.join(ROOT_DEFAULT, 'tools/mode/rhythm-finger-owner-scan.js'));

const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  // 上の難易度を開けておく(MASTER をクリア済み＝HELL も開く)
  put('mh_rhythm_best_v1', { ${JSON.stringify(songId)}: Object.fromEntries(['EASY','NORMAL','HARD','EXPERT','MASTER'].map(d => [d, { bestScore: 900000, maxCombo: 10, played: true, clear: true }])) });
})()`;
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';

// ---- ページの中で動く演奏(関数ごと文字にして渡す) ----
async function idealHands(o) {
  const area = document.querySelector('[data-rhythm-play-area]');
  const ti = (0, eval)('(' + o.touchSrc.replace(/radiusX: 11, radiusY: 11/g, 'radiusX: 18, radiusY: 18') + ')')(area, 'touch');
  const rt = window.__mhTestHooks.rhythmNotes();
  const song = RHYTHM_SONGS.find(s => s.songId === o.song);
  let chart = song && song.difficulties && song.difficulties[o.diff];
  if (!chart && o.diff === 'HELL' && typeof RHYTHM_HELL_CHARTS !== 'undefined') chart = RHYTHM_HELL_CHARTS[o.song];
  const cn = chart.notes;
  const lineR = () => RHYTHM_JUDGMENT_LINE_Y.ratio;
  let rr = RHYTHM_VIEW_ROTATION.rectOf(area);
  const pt = (c, sky) => ({ x: rr.left + rr.width * rhythmProjectBoundary(c, lineR()), y: rr.top + rr.height * (lineR() - (sky > 0 ? RHYTHM_SKY_LIFT.ratio * sky : 0)) });
  // その時刻のノーツの位置(レーンの境目の座標の中心・高さ)。tools/mode/rhythm-finger-owner-scan.js の spanAt と同じ
  const spanAt = (n, t) => {
    if (rhythmNoteIsSlide(n)) return { c: rhythmSlideExpectedLane(n, t) + .5, h: rhythmSlideWidthAt(n, t) / 4, sky: rhythmSlideHasSky(n) ? rhythmSlideSkyAt(n, t) : 0 };
    const sky = rhythmNoteSkyHeight(n);
    if (n.subLane != null && Number.isFinite(Number(n.subLane))) {
      const sp = rhythmNoteHasHoldPoints(n) ? rhythmHoldSpanAt(n, t) : { subLane: Number(n.subLane), subLaneWidth: Number(n.subLaneWidth) || 2 };
      return { c: (sp.subLane + sp.subLaneWidth / 2) / 2, h: sp.subLaneWidth / 4, sky };
    }
    return { c: (Number(n.lane) || 0) + .5, h: .5, sky };
  };
  const posOf = (n, t) => { const s = spanAt(n, t); return pt(s.c, s.sky); };
  const isLong = n => (n.type === 'HOLD' || n.type === 'SLIDE') && Number(n.endTimeMs) > Number(n.timeMs);
  const flickVec = n => { const d = typeof rhythmFlickDir === 'function' ? rhythmFlickDir(n) : ''; return d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : [0, -1]; };
  // ---- 指の割り当て ----
  const order = cn.map((n, i) => i).filter(i => RHYTHM_NOTE_TYPES.includes(cn[i].type) && cn[i].timeMs >= o.from && cn[i].timeMs <= o.to)
    .sort((a, b) => cn[a].timeMs - cn[b].timeMs || (isLong(cn[b]) - isLong(cn[a])));
  const fingers = [];   // { busyUntil }
  const plan = {};      // ノーツ番号 → { finger, at, how }
  const events = [];    // { at, f }
  const follows = [];   // { touch, n, from, until, state }
  let touchSeq = 100, maxFingers = 0;
  const takeFinger = (t, until) => { let k = fingers.findIndex(f => f.busyUntil <= t - 12); if (k < 0) { fingers.push({ busyUntil: 0 }); k = fingers.length - 1; } fingers[k].busyUntil = until; maxFingers = Math.max(maxFingers, fingers.filter(f => f.busyUntil > t).length); return k; };
  const touchIdOf = k => o.reuse ? k + 1 : ++touchSeq;
  const swipe = (id, at, p, vec, dist, upAt) => {
    events.push({ at: at + 25, f: () => ti.send(ti.makeEvents('move', id, { x: p.x + vec[0] * dist / 2, y: p.y + vec[1] * dist / 2 })) });
    events.push({ at: at + 45, f: () => ti.send(ti.makeEvents('move', id, { x: p.x + vec[0] * dist, y: p.y + vec[1] * dist })) });
    events.push({ at: upAt, f: () => ti.send(ti.makeEvents('up', id, { x: p.x + vec[0] * dist, y: p.y + vec[1] * dist })) });
  };
  // ロングの終わりのすぐ横のフリック(押さえていた指でそのまま払う)
  const endFlickOf = new Map();   // ロングの番号 → フリックの番号
  if (o.endFlick === 'keep') for (const i of order) { const L = cn[i]; if (!isLong(L) || L.endFlick === true) continue;
    const e = Number(L.endTimeMs), a = spanAt(L, e);
    const j = order.find(j => j !== i && cn[j].type === 'FLICK' && Math.abs(cn[j].timeMs - e) <= 60 && (() => { const b = spanAt(cn[j], cn[j].timeMs); return Math.abs(a.c - b.c) - a.h - b.h <= 1 && (a.sky >= .5) === (b.sky >= .5); })());
    if (j != null && ![...endFlickOf.values()].includes(j)) endFlickOf.set(i, j); }
  const flickTakenBy = new Map([...endFlickOf].map(([i, j]) => [j, i]));
  // 押さえている帯のそばのノーツを帯の側へ寄せる(--lean)
  const leaned = (n, t) => {
    const b = spanAt(n, t); if (!o.lean) return b;
    let best = null; for (const f of follows) { if (f.from > t || f.until < t) continue; const a = spanAt(f.n, t); const d = a.c - b.c; if (Math.abs(d) <= 2 && (!best || Math.abs(d) < Math.abs(best))) best = d; }
    if (best == null || Math.abs(best) < 1e-6) return b;
    // 寄せても、見えているノーツの幅の内側(端から 0.05 レーン)に留める。ノーツの外を押して取れないのは手の側の都合なので
    return { ...b, c: b.c + Math.sign(best) * Math.max(0, Math.min(o.lean, Math.abs(best), b.h - .05)) };
  };
  for (const i of order) {
    const n = cn[i], t = Number(n.timeMs);
    if (flickTakenBy.has(i)) continue;   // 押さえていた指が払う
    if (isLong(n)) {
      const e = Number(n.endTimeMs), j = endFlickOf.get(i), fl = j != null ? cn[j] : null;
      const until = fl ? Math.max(e, fl.timeMs) + 60 : e + 5;
      const k = takeFinger(t, until), id = touchIdOf(k);
      const fo = { id, n, from: t, until: fl ? Math.min(e, fl.timeMs) - 10 : (n.endFlick === true ? e - 40 : e - 5), on: false };
      follows.push(fo);
      plan[i] = { finger: k, id, at: t, how: n.endFlick === true ? '押さえてなぞり、終点で払う' : fl ? `押さえてなぞり、そのまま払う(→${j})` : '押さえてなぞる' };
      events.push({ at: t, note: i, f: () => { fo.on = true; ti.send(ti.makeEvents('down', id, posOf(n, t))); } });
      if (fl) {
        const ft = Number(fl.timeMs), p = (() => { const s = spanAt(fl, ft); return pt(s.c, s.sky); })(), vec = flickVec(fl);
        plan[j] = { finger: k, id, at: ft, how: `押さえていた指(${i})でそのまま払う` };
        events.push({ at: Math.min(e, ft) - 10, f: () => { fo.on = false; ti.send(ti.makeEvents('move', id, p)); } });
        events.push({ at: ft + 5, f: () => ti.send(ti.makeEvents('move', id, { x: p.x + vec[0] * 30, y: p.y + vec[1] * 30 })) });
        events.push({ at: ft + 25, f: () => ti.send(ti.makeEvents('move', id, { x: p.x + vec[0] * 60, y: p.y + vec[1] * 60 })) });
        events.push({ at: ft + 45, f: () => ti.send(ti.makeEvents('up', id, { x: p.x + vec[0] * 60, y: p.y + vec[1] * 60 })) });
      } else if (n.endFlick === true) {
        events.push({ at: e - 40, f: () => { fo.on = false; const q = posOf(n, e); ti.send(ti.makeEvents('move', id, { x: q.x, y: q.y - 30 })); } });
        events.push({ at: e - 20, f: () => { const q = posOf(n, e); ti.send(ti.makeEvents('move', id, { x: q.x, y: q.y - 70 })); } });
        events.push({ at: e, f: () => { const q = posOf(n, e); ti.send(ti.makeEvents('up', id, { x: q.x, y: q.y - 70 })); } });
      } else {
        events.push({ at: e - 5, f: () => { fo.on = false; ti.send(ti.makeEvents('up', id, posOf(n, e))); } });
      }
      continue;
    }
    const s = leaned(n, t), p = pt(s.c, s.sky);
    if (n.type === 'FLICK') {
      const k = takeFinger(t, t + 50), id = touchIdOf(k);
      plan[i] = { finger: k, id, at: t, how: '別の指で払う', c: +s.c.toFixed(3) };
      events.push({ at: t, note: i, f: () => ti.send(ti.makeEvents('down', id, p)) });
      swipe(id, t, p, flickVec(n), 60, t + 46);
    } else {
      const k = takeFinger(t, t + 40), id = touchIdOf(k);
      plan[i] = { finger: k, id, at: t, how: '別の指で押す', c: +s.c.toFixed(3) };
      events.push({ at: t, note: i, f: () => ti.send(ti.makeEvents('down', id, p)) });
      events.push({ at: t + 40, f: () => ti.send(ti.makeEvents('up', id, p)) });
    }
  }
  events.sort((a, b) => a.at - b.at);
  const lastAt = events.length ? events[events.length - 1].at : 0;
  // ---- 流す: 次の1コマぶんの合図は setTimeout で時刻ちょうどに送る。押さえている指は毎コマ帯の位置へ動かす ----
  let k = 0, stalls = 0;
  await new Promise(done => {
    const tick = () => {
      const ms = window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs();
      if (ms == null) { if (++stalls > 600) return done(); return requestAnimationFrame(tick); }
      rr = RHYTHM_VIEW_ROTATION.rectOf(area);
      while (k < events.length && events[k].at <= ms + 17) { const ev = events[k++]; const wait = ev.at - ms;
        // 押した合図が予定より何 ms 遅れて出たか(ページが詰まって遅れたのは手の側の都合。判定の不具合と分けるため)
        const go = ev.note == null ? ev.f : () => { const now = window.__mhTestHooks.rhythmSongMs(); if (plan[ev.note] && now != null) plan[ev.note].late = Math.round(now - ev.at); ev.f(); };
        if (wait > 1) setTimeout(go, wait); else go(); }
      for (const f of follows) if (f.on && ms > f.from && ms < f.until) {
        // なぞりの合図の間隔(いちばん空いたところ)。ページが詰まって帯の動きに指が付いていけなかったら手の側の都合
        if (f.last != null) f.gap = Math.max(f.gap || 0, ms - f.last); f.last = ms;
        ti.send(ti.makeEvents('move', f.id, posOf(f.n, ms)));
      }
      if (k < events.length || ms < lastAt + 700) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  for (const f of follows) { const i = f.n === undefined ? null : cn.indexOf(f.n); if (i >= 0 && plan[i]) plan[i].followGap = Math.round(f.gap || 0); }
  const rs = window.__mhTestHooks.rhythmNoteResults() || [];
  return { results: rs, plan, maxFingers, events: events.length, rtCount: rt.length };
}

const launch = async () => {
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
    // 曲は id で(版ちがいの同じ曲名があるため)、難易度は data-rhythm-difficulty で選ぶ
    await page.evaluate((id) => document.querySelector(`[data-rhythm-song-row="${id}"]`)?.click(), SONG); await page.waitForTimeout(1200);
    const diffState = await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-difficulty="${d}"]`); if (!b) return 'ない'; if (b.disabled) return '鍵つき'; b.click(); return 'ok'; }, DIFF);
    if (diffState !== 'ok') throw new Error(`難易度 ${DIFF} を選べない(${diffState})`);
    await page.waitForTimeout(800);
    started = await clickText('^(▶\\s*)?決定$');
  } else {
    await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    await clickText('💊'); await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
    started = await page.evaluate(async ([song, diff]) => {
      document.querySelector('[data-rhythm-debug-select-open]')?.click();
      await new Promise(r => setTimeout(r, 1200));
      const target = RHYTHM_SONGS.find(x => x.songId === song); if (!target) return false;
      const row = [...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]')].find(r => r.textContent.includes(target.displayName) && (!target.subtitle || r.textContent.includes(target.subtitle)));
      if (!row) return false; row.click(); await new Promise(r => setTimeout(r, 500));
      document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="' + diff + '"]')?.click(); await new Promise(r => setTimeout(r, 400));
      const b = document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-start="' + diff + '"]'); if (b) b.click(); return !!b;
    }, [SONG, DIFF]);
  }
  if (!started) throw new Error(`曲を始められなかった(${ENTRY} ${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  // 選んだ難易度の譜面で始まったか(難易度の選び直しが外れることがある)。譜面のノーツの並びと、演奏のノーツの並びを突き合わせる
  const chart = await page.evaluate(([song, diff]) => {
    const s = RHYTHM_SONGS.find(x => x.songId === song); let c = s && s.difficulties && s.difficulties[diff];
    if (!c && diff === 'HELL' && typeof RHYTHM_HELL_CHARTS !== 'undefined') c = RHYTHM_HELL_CHARTS[song];
    const rt = window.__mhTestHooks.rhythmNotes() || [];
    const same = !!c && c.notes.length === rt.length && c.notes.every((n, i) => Math.abs(Number(n.timeMs) - Number(rt[i].timeMs)) < 1 && n.type === rt[i].type);
    return { same, chartCount: c ? c.notes.length : 0, rtCount: rt.length, notes: c ? c.notes : [] };
  }, [SONG, DIFF]);
  return { browser, context, page, errors, chart };
};


// ---- 1件ずつの見分け: タップ・フリックの「押した位置」が、判定の関数(--root の data/rhythm-mode.js の rhythmMatchInputBatch)で
//      ・帯を押さえているとき(本番と同じ)に取れるか ・帯が無いとき(押さえていた帯を済みにする)に取れるか を見る。
//      帯が無ければ取れるのに、帯があると取れない → 判定の作りの不具合の疑い(押さえている帯に吸われた)
//      帯が無くても取れない → 押した位置が悪い(手の側の都合。ほかのノーツへ行く/受け付け幅の外)
//      作りは tools/mode/rhythm-note-reach-scan.js と同じ(取れたノーツは元の形へ戻し、指の受け付けの記録も消す)
const judgeVerdicts = (root, chartNotes, failed) => {
  const vm = require('vm');
  const src = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-mode.js'), 'utf8');
  const ctx = { console, performance: { now: () => 0 } };
  vm.runInNewContext(`${src}\nthis.G={rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,rhythmNoteIsSlide,rhythmSlidePoints,rhythmChartHasSky,rhythmSkyLineRatio,RHYTHM_SKY_INPUT,RHYTHM_SKY_LIFT,RHYTHM_JUDGMENT_LINE_Y,rhythmNoteSkyHeight,RHYTHM_LANE_COUNT};`, ctx);
  const G = ctx.G; if (G.RHYTHM_SKY_LIFT.set) G.RHYTHM_SKY_LIFT.set(true);
  const sky = G.rhythmChartHasSky(chartNotes); G.RHYTHM_SKY_INPUT.active = !!sky;
  const notes = chartNotes.map((n, index) => ({ ...n, index, done: false, activePointerId: null, holdJudgment: null, holdDeltaMs: 0, ...(n.type === 'SLIDE' ? { _rhythmSlideRenderPoints: G.rhythmSlidePoints(n) } : {}) }));
  for (const x of notes) x.__snap = Object.fromEntries(Object.entries(x));
  const endOf = n => Number.isFinite(Number(n.endTimeMs)) ? Number(n.endTimeMs) : Number(n.timeMs);
  const setAt = (t, held) => { for (const n of notes) { const st = Number(n.timeMs), long = n.type === 'HOLD' || G.rhythmNoteIsSlide(n), during = long && st < t && endOf(n) > t;
    n.done = st < t && !(during && held); n.activePointerId = held && during ? 'held:' + n.index : null; } };
  const pure = (inputs, t) => { const r = G.rhythmMatchInputBatch(notes, inputs, t, 0);
    for (const x of r) { const n = x && x.target; if (!n || !n.__snap) continue; for (const k of Object.keys(n)) if (!(k in n.__snap) && k !== '__snap') delete n[k]; for (const [k, v] of Object.entries(n.__snap)) if (k !== 'done' && k !== 'activePointerId') n[k] = v; }
    G.RHYTHM_GESTURE_RUNTIME.clear(); return r; };
  const groundR = G.RHYTHM_JUDGMENT_LINE_Y.ratio, skyR = sky ? G.rhythmSkyLineRatio() : groundR, L = G.RHYTHM_LANE_COUNT;
  const name = (r, i) => !r || !r.target ? 'どこへも行かない' : r.target.index === i ? '取れる' : `#${r.target.index}へ行く`;
  for (const f of failed) {
    if (!f.plan || f.plan.c == null || (f.type !== 'TAP' && f.type !== 'FLICK')) continue;
    const n = notes[f.index], t = Number(n.timeMs), c = f.plan.c * 2;
    const inp = [{ inputKey: 'touch:judge', lane: Math.max(0, Math.min(L - 1, Math.floor(f.plan.c))), subLaneCoordinate: c, subLaneCoordinateAtLine: null, sky: sky ? (G.rhythmNoteSkyHeight(n) > 0 ? skyR : groundR) : null }];
    setAt(t, true); const held = name(pure(inp, t)[0], f.index);
    setAt(t, false); const free = name(pure(inp, t)[0], f.index);
    f.verdict = { held, free, cause: free === '取れる' && held !== '取れる' ? '判定の作りの疑い(押さえている帯に吸われた)' : free !== '取れる' ? '手の側(押した位置が悪い)' : '位置では取れる(時刻・指の動きを見る)' };
  }
  G.RHYTHM_SKY_INPUT.active = false;
};

(async () => {
  // --rejudge <結果の JSON>: ブラウザを使わず、前に回した結果の MISS・BAD を --root の判定の関数で見分け直す
  const REJUDGE = arg('rejudge');
  if (REJUDGE) {
    const prev = JSON.parse(fs.readFileSync(REJUDGE, 'utf8')), G0 = scan.loadGame(ROOT);
    const c = scan.chartsOf(G0, { song: prev.song, diff: prev.diff })[0];
    judgeVerdicts(ROOT, c.notes, prev.failed);
    const cc = {}; prev.failed.forEach(f => { const k = f.lateSend ? '合図の遅れ・途切れ(手の側)' : f.verdict ? f.verdict.cause : 'ロングなど(位置の見分けなし)'; cc[k] = (cc[k] || 0) + 1; });
    console.log(`${prev.song} ${prev.diff} MISS・BAD ${prev.failed.length} / 見分け: ${Object.entries(cc).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
    if (LIST) prev.failed.forEach(f => console.log(`  ${f.sec.toFixed(2)}秒 #${f.index} ${f.type} ${f.what} ${(f.shapes[0] || {}).kind || '形なし'}${f.verdict ? ` 〔帯あり:${f.verdict.held}/帯なし:${f.verdict.free}〕 → ${f.verdict.cause}` : ''}`));
    return;
  }
  let run = null;
  for (let tries = 0; tries < 3; tries++) {
    run = await launch();
    if (run.chart.same) break;
    console.log(`  譜面が合わない(譜面 ${run.chart.chartCount} / 演奏 ${run.chart.rtCount})。始め直す`);
    await run.context.close(); await run.browser.close(); run = null;
  }
  if (!run) throw new Error('選んだ難易度で始められなかった');
  const { browser, context, page, errors, chart } = run;
  const G = scan.loadGame(ROOT);
  const shapes = scan.scanChart(G, chart.notes, { songId: SONG, diff: DIFF });
  const byNote = scan.shapesByNote(shapes);
  console.log(`演奏: ${SONG} ${DIFF} ノーツ ${chart.chartCount} / 形 ${shapes.length}件 / ゲーム ${ROOT}`);
  const res = await page.evaluate(`(${idealHands.toString()})(${JSON.stringify({ song: SONG, diff: DIFF, touchSrc: touchInputSource, lean: LEAN, endFlick: END_FLICK, reuse: REUSE, from: FROM, to: TO })})`);
  await context.close(); await browser.close();
  // ---- 集計 ----
  const bad = (j) => j === 'MISS' || j === 'BAD';
  const failed = [];
  const judgments = {};
  for (const r of res.results) {
    const n = chart.notes[r.index]; if (!n || n.timeMs < FROM || n.timeMs > TO) continue;
    const j = r.judgment || '(なし)'; judgments[j] = (judgments[j] || 0) + 1;
    const parts = [bad(r.judgment) && `判定${r.judgment}`, bad(r.holdJudgment) && r.holdJudgment !== r.judgment && `押し始め${r.holdJudgment}`, bad(r.releaseJudgment) && `離し${r.releaseJudgment}`].filter(Boolean);
    if (!parts.length && r.judgment != null) continue;
    if (!parts.length) parts.push('判定なし');
    const sh = byNote.get(r.index) || [];
    failed.push({ index: r.index, sec: +(n.timeMs / 1000).toFixed(3), type: n.type, sky: scan.spanAt(G, n, n.timeMs).sky, what: parts.join('・'), deltaMs: r.deltaMs == null ? null : Math.round(r.deltaMs),
      releaseDeltaMs: r.releaseDeltaMs == null ? null : Math.round(r.releaseDeltaMs), plan: res.plan[r.index] || null, game: r,
      shapes: sh.map(s => ({ kind: s.kind, notes: s.notes, role: s.notes[0] === r.index ? '帯の側' : 'ノーツの側', detail: s.detail })) });
  }
  // 押した合図が 30ms 以上遅れた・なぞりの合図が 60ms 以上途切れたノーツは、ページの詰まり(手の側の都合)の疑い。判定の作りの不具合とは分けて数える
  failed.forEach(f => { f.lateSend = !!(f.plan && ((f.plan.late != null && f.plan.late > 30) || (f.plan.followGap != null && f.plan.followGap > 60))); });
  try { judgeVerdicts(ROOT, chart.notes, failed); } catch (e) { console.log('  (見分けを飛ばした: ' + String(e).slice(0, 120) + ')'); }
  const causeCount = {}; failed.forEach(f => { const k = f.lateSend ? '合図の遅れ・途切れ(手の側)' : f.verdict ? f.verdict.cause : 'ロングなど(位置の見分けなし)'; f.cause = k; causeCount[k] = (causeCount[k] || 0) + 1; });
  const kindCount = new Map(), baseCount = new Map();
  for (const f of failed) {
    const kinds = f.shapes.length ? [...new Set(f.shapes.map(s => s.kind))] : ['形なし'];
    const bases = f.shapes.length ? [...new Set(f.shapes.map(s => s.kind.split(':')[0]))] : ['形なし'];
    kinds.forEach(k => kindCount.set(k, (kindCount.get(k) || 0) + 1));
    bases.forEach(k => baseCount.set(k, (baseCount.get(k) || 0) + 1));
  }
  const miss = failed.filter(f => /MISS|なし/.test(f.what)).length, badN = failed.filter(f => /BAD/.test(f.what)).length;
  console.log(`  判定: ${Object.entries(judgments).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  console.log(`  MISS・BAD のノーツ ${failed.length}(MISS ${miss} / BAD ${badN}・うち合図が遅れた・途切れたもの ${failed.filter(f => f.lateSend).length}) / 使った指 最大${res.maxFingers}本 / 合図 ${res.events}`);
  if (failed.length) {
    console.log(`  形ごと(1ノーツが複数の形に入ると重ねて数える): ${[...baseCount].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
    [...kindCount].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
  }
  if (failed.length) console.log(`  見分け: ${Object.entries(causeCount).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  if (LIST) failed.forEach(f => console.log(`  ${f.sec.toFixed(2)}秒 #${f.index} ${f.sky >= .5 ? '空中' : '地上'}${f.type} ${f.what} ずれ${f.deltaMs ?? '-'} 離しずれ${f.releaseDeltaMs ?? '-'}${f.type === 'HOLD' || f.type === 'SLIDE' ? ` 押し始め${f.game.holdJudgment || '-'}(${f.game.holdDeltaMs == null ? '-' : Math.round(f.game.holdDeltaMs)}) 離しの的${f.game.releaseTargetMs == null ? '-' : Math.round(f.game.releaseTargetMs)}/終わり${f.game.endTimeMs == null ? '-' : Math.round(f.game.endTimeMs)}` : ''} [${f.plan ? f.plan.how + ' 指' + f.plan.finger + (f.plan.late != null ? ' 押した遅れ' + f.plan.late + 'ms' : '') + (f.plan.followGap ? ' なぞりの間隔 最大' + f.plan.followGap + 'ms' : '') : '押していない'}] ${f.shapes.map(s => `${s.kind}[${s.notes.join(',')}]`).join(' ; ') || '形なし'}${f.verdict ? ` 〔帯あり:${f.verdict.held}/帯なし:${f.verdict.free}〕` : ''} → ${f.cause}`));
  if (errors.length) console.log(`  ページのエラー: ${errors.join(' | ')}`);
  if (JSON_OUT) { fs.writeFileSync(JSON_OUT, JSON.stringify({ song: SONG, diff: DIFF, root: ROOT, lean: LEAN, endFlick: END_FLICK, judgments, maxFingers: res.maxFingers, causeCount, failed, kindCount: Object.fromEntries(kindCount), baseCount: Object.fromEntries(baseCount) }, null, 1)); console.log(`  書き出した: ${JSON_OUT}`); }
})().catch((e) => { console.error(e); process.exit(1); });
