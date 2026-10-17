#!/usr/bin/env node
// 2本のスライドが交わる所の「指と帯の結び直し」を、ボットに Sheriruth MASTER を遊ばせて確かめる(2026-10-11 社長「交差のとき両方の帯が黒くなる」)。
// 交差のスライド4本(106.77・107.34・127.37・127.77秒始まり)について、最後の判定と、帯が暗かった時間・区間(slideOffForIndex)を出す。
// 指の動かし方(--freeze):
//   0 … 指を交差させて、それぞれ押さえ始めた帯を最後まで追う
//   1 … 社長の持ち替え。親指は交差させず、それぞれの側に残って、その側に来た帯を追う(交わる所で帯を反対の指へ渡す)
//   2 … 2本目の帯の指が、交わったあと相手の帯に乗ったまま進む(自分の帯は捨てる=判定が落ちるのが正しい)
// 本物の Supabase へは1件も送らない(偽の Supabase)。
//
//   node tools/playbot/rhythm-cross-swap-bot.js --freeze 1 --from 104000 --to 134600 [--landscape 0] [--root <前の版の worktree>]
//
// 空中から始まるスライドの押し始めも、その時刻の高さで触る(HELL の行き来するスライド・2026-10-11)。
//   node tools/playbot/rhythm-cross-swap-bot.js --entry proto --song sheriruth_hell_debug --diff HELL --from 0 --to 137000
//   --persona thumb|lean|normal --seed 3 --sigma 28 で人の指のくせを入れる(既定は くせ無し)
//   --no-nudge 押さえている指がつられて動くくせだけ止める / --watch 33740 帯の暗さを見張るスライドの始まり(ms)
//   --freeze 3 [--swap-skip 66800-68300] 時間が重なって横に交わるスライドの組を自動で見つけて持ち替える(区間を外すと指を交差させる)
//   --abandon 106771:107339:108420[:110000] 自分の帯(106771始まり)を押さえる指が、108420ms から相手の帯(107339始まり)へ移って自分の帯を捨てる(--freeze 2 と同じ動き。
//     4つ目を書くと、その時刻に自分の帯へ戻る。空中のスライドで外れて戻る場面を作る・2026-10-16 空中のスライドもチェックポイントで判定するようにしたときに足した)
//   --touch-log <ファイル> 指の合図を曲の時刻つきで書き出す([時刻ms, s|m|e, 指の番号, x, y])
//   --sky-adapt / --no-sky-adapt 空中の受け付けを構えに合わせる案A(mh_sky_reach_adapt_proto)を入/切にして遊ぶ(書かなければゲームの既定=入・2026-10-12 から)
//   --travel 0.5 [--travel-ms 250] 親指の上下が届ききらない人(空中⇔地上を続けて押すとき、高さの半分の所で押す)
// 目安(2026-10-11・直したあと): 0 と 1 は4本とも MARVELOUS・暗い時間0。2 は 107.34秒が MISS・127.77秒が GOOD(直す前と同じ)
const path = require('path'), fs = require('fs');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const ROOT = path.resolve(arg('root', ROOT_DEFAULT));
const SONG = arg('song', 'sheriruth'), DIFF = arg('diff', 'MASTER'), ENTRY = arg('entry', 'select');
const FROM = Number(arg('from', 104000)), TO = Number(arg('to', 112000)), CPU = Number(arg('cpu', 1));
const LAND = arg('landscape', '1') !== '0';
const W = LAND ? 844 : 390, H = LAND ? 390 : 844;
const FUNCS = ['paintCanvasNote', 'drawNote', 'drawSlide', 'drawHead', 'rhythmNoteCanvasGeometry', 'rhythmSlideSegmentQuads', 'rhythmSlideCheckpointLines', 'rhythmRestartAnimations', 'visitNote', 'tick',
  ...String(arg('funcs', '')).split(',').filter(Boolean)];
const { chromium } = require(path.join(ROOT_DEFAULT, 'tools/node_modules/playwright'));
const { createFakeSupabase } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/fake-supabase.js'));
const { installPlayer } = require(path.join(ROOT_DEFAULT, 'tools/playbot/scenarios/rhythm.js'));
const { touchInputSource } = require(path.join(ROOT_DEFAULT, 'tools/playbot/lib/touch-input.js'));

const seed = (songId) => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  ${process.argv.includes('--no-sky-adapt') ? "localStorage.setItem('mh_sky_reach_adapt_proto', '0');" : process.argv.includes('--sky-adapt') ? "localStorage.setItem('mh_sky_reach_adapt_proto', '1');" : ''}
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
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
  // TICK_PREVIEW=1 … 刻みの数え方(2026-10-17)を切り替えの時刻より前に試す(確認待ちの試作 mh_rhythm_tick_preview_proto)
  if (process.env.TICK_PREVIEW) await context.addInitScript(() => { try { localStorage.setItem('mh_rhythm_tick_preview_proto', '1'); } catch (e) {} });
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
  console.log(`演奏: ノーツ ${playing.notes} / ${playing.title.slice(0, 60)}`);
  // ボット(空中のノーツは空中の高さで押す)
  const target = 'const p = fingerAt(c, hab, null, now);';
  const src = installPlayer.toString();
  const player = src.includes(target) ? src.replace(target, 'const p = (window.__travel || ((n, c, now, p) => p))(n, c, now, (() => { const q = fingerAt(c, hab, null, now); const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : (window.__slideSkyAt ? window.__slideSkyAt(n, Number(n.timeMs) || 0) : 0); if (!sh || typeof RHYTHM_SKY_LIFT === "undefined") return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })(), hab);') : src;
  const posLine = 'const pos = fingerAt(laneOfHold(a.n, now), a.hab, a.drift, now);';
  if (!player.includes(posLine)) throw new Error('ボットの押さえる指の行が見つからない');
  // 押さえている間の指も、その時刻のスライドの高さに合わせて上げ下げする(人は帯の高さを目で追う。空中から始まる帯を地上へ戻して押さえると、指が飛んで離したことになる)
const player2 = player.replace(posLine, 'const pos = (() => { const q = fingerAt(window.__laneFor ? window.__laneFor(a.n, now, laneOfHold) : laneOfHold(a.n, now), a.hab, a.drift, now); if (!window.__slideSkyAt || typeof RHYTHM_SKY_LIFT === "undefined") return q; const sh = window.__slideSkyAt(a.n, now); if (!(sh > 0)) return q; const rr = area.getBoundingClientRect(); return { x: q.x, y: q.y - rr.height * RHYTHM_SKY_LIFT.ratio * sh }; })();');
  // --watch 33740,35000 で、帯の暗さ(slideOffForIndex)を見張るスライドの始まり(ms)を変える(既定は Sheriruth の交差の4本)
  if (arg('watch')) await page.evaluate((w) => { window.__watchMs = w; }, String(arg('watch')).split(',').map(Number));
  if (arg('swap-skip')) await page.evaluate((w) => { window.__swapSkip = w; }, String(arg('swap-skip')).split(',').map((r) => r.split('-').map(Number)));
  const ABANDON = arg('abandon') ? String(arg('abandon')).split(':').map(Number) : null;
  await page.evaluate(([mode, ab]) => {
    const pairs = ab ? [[[ab[1], ab[0]], ab[2], ab[3] || Infinity]] : [[[106771, 107339], 108420], [[127367, 127772], 130700]];
    // mode 2: 2本目の帯(107339・127772)を押さえる指が、交わったあと相手の帯(106771・127367)に乗ったまま進む(自分の帯は捨てる=失敗するはず)
    const seen = {}; const partner = ab ? { [ab[0]]: ab[1] } : { 107339: 106771, 127772: 127367 };
    window.__laneNote = (n, now) => { const t = Math.round(Number(n.timeMs)); seen[t] = n; if (mode !== 2 || !partner[t]) return n; const p = pairs.find(([ids]) => ids.includes(t)); return now >= p[1] && now < (p[2] || Infinity) && seen[partner[t]] ? seen[partner[t]] : n; };
    // mode 1(社長の持ち替え): 指は親指を交差させず、それぞれの側に残る。右側で押し始めた指は、2本のうち右にある帯を、左の指は左にある帯を追う
    // mode 2: 2本目の帯を押さえる指が、交わったあと相手の帯に乗ったまま進む(自分の帯は捨てる)
    const other = { 106771: 107339, 107339: 106771, 127367: 127772, 127772: 127367 }; const startSide = {};
    window.__laneFor = (n, now, f) => { const t = Math.round(Number(n.timeMs)); seen[t] = n; const o = seen[other[t]];
      if (mode === 1 && o) { const mine = f(n, now), theirs = f(o, now); if (!startSide[t]) startSide[t] = mine >= theirs ? 'R' : 'L'; return startSide[t] === 'R' ? Math.max(mine, theirs) : Math.min(mine, theirs); }
      if (mode === 2 && partner[t] && seen[partner[t]]) { const p = pairs.find(([ids]) => ids.includes(t)); if (now >= p[1] && now < (p[2] || Infinity)) return f(seen[partner[t]], now); }
      return f(n, now); };
    // mode 3(自動の持ち替え・2026-10-13): 時間が重なって横に交わるスライドの組を譜面から見つけ、指はそれぞれの側に残って、その側に来た帯を追う。
    // 高さもその側の帯に合わせる(__bandAt)。--swap-skip 66800-68300 の区間は持ち替えない(指を交差させる)
    if (mode === 3) {
      const skip = window.__swapSkip || [];
      const sl = (window.__mhTestHooks.rhythmNotes() || []).filter((x) => (x._rhythmOriginalType || x.type) === 'SLIDE' && Array.isArray(x.slidePoints) && x.slidePoints.length);
      const lin = (n, t) => { const q = n.slidePoints; if (t <= q[0].timeMs) return +q[0].lane; for (let i = 1; i < q.length; i++) if (t <= q[i].timeMs) { const a = q[i - 1], b = q[i]; return +a.lane + (+b.lane - +a.lane) * (t - a.timeMs) / Math.max(1, b.timeMs - a.timeMs); } return +q[q.length - 1].lane; };
      const key = (n) => Math.round(+n.timeMs) + ':' + n.lane, pair = new Map();
      for (let i = 0; i < sl.length; i++) for (let j = i + 1; j < sl.length; j++) {
        const a = sl[i], b = sl[j], s0 = Math.max(a.timeMs, b.timeMs), e0 = Math.min(+a.endTimeMs, +b.endTimeMs);
        if (e0 - s0 < 60 || skip.some(([x, y]) => s0 < y && e0 > x)) continue;
        let sgn = 0, crossed = false;
        for (let t = s0; t <= e0; t += 20) { const d = Math.sign(lin(a, t) - lin(b, t)); if (!d) continue; if (sgn && d !== sgn) { crossed = true; break; } sgn = d; }
        if (crossed) { pair.set(key(a), { o: b, s: s0, e: e0 }); pair.set(key(b), { o: a, s: s0, e: e0 }); }
      }
      window.__pairs3 = [...pair.entries()].map(([k, v]) => [k, Math.round(v.s), Math.round(v.e)]);
      const side3 = {}, lastBand = {};
      // 重なりが終わったあとは、最後に追っていた帯をそのまま追う(ゲームは交わる所で指を反対の帯へ結び直している)
      const pick = (n, now, f) => { const q = pair.get(key(n)), k = key(n); if (!q || now < q.s) return null;
        if (now > q.e) return lastBand[k] === q.o ? { lane: f(q.o, now), band: q.o } : null;
        const mine = f(n, now), theirs = f(q.o, now);
        if (!side3[k]) side3[k] = mine >= theirs ? 'R' : 'L'; const useMine = side3[k] === 'R' ? mine >= theirs : mine <= theirs; lastBand[k] = useMine ? n : q.o; return { lane: useMine ? mine : theirs, band: lastBand[k] }; };
      window.__laneFor = (n, now, f) => { const r = pick(n, now, f); return r ? r.lane : f(n, now); };
      window.__bandAt = (n, now) => { const r = pick(n, now, lin); return r ? r.band : n; };
      window.__untilFor = (a, now) => { const band = lastBand[key(a.n)]; return band && band !== a.n ? a.until + (Number(band.endTimeMs) - Number(a.n.endTimeMs)) : a.until; };
    }
    window.__freeze = (n, now) => { if (mode !== 1) return false; const t = Math.round(Number(n.timeMs)); const p = pairs.find(([ids]) => ids.includes(t)); return !!p && now >= p[1]; };
    const notes = window.__mhTestHooks.rhythmNotes() || [];
    const idx = notes.map((x, i) => [x, i]).filter(([x]) => (window.__watchMs || [106771, 107339, 127367, 127772]).includes(Math.round(Number(x.timeMs))) && ((x._rhythmOriginalType || x.type) === 'SLIDE')).map(([, i]) => i);
    window.__offMs = Object.fromEntries(idx.map(i => [i, 0])); window.__offSpans = Object.fromEntries(idx.map(i => [i, []]));
    let last = performance.now();
    const tick = (t) => { const dt = t - last; last = t; const song = Math.round(window.__mhTestHooks.rhythmSongMs?.() ?? -1);
      for (const i of idx) { const off = !!RHYTHM_GESTURE_RUNTIME.slideOffForIndex(i); if (off) window.__offMs[i] += dt; const sp = window.__offSpans[i]; const lastSp = sp[sp.length - 1];
        if (off && (!lastSp || lastSp[1] != null)) sp.push([song, null]); else if (!off && lastSp && lastSp[1] == null) lastSp[1] = song; }
      requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [ABANDON ? 2 : Number(arg('freeze', 0)), ABANDON]);
  // 演奏中のノーツはスライドの点から高さ(sky)が抜けているので、元の譜面(曲の表)から高さを引く
  await page.evaluate(([song, diff]) => {
    const all = [...(typeof RHYTHM_SONGS !== 'undefined' ? RHYTHM_SONGS : []), ...(typeof RHYTHM_PROTO_SONGS !== 'undefined' ? RHYTHM_PROTO_SONGS : [])];
    const chart = (all.find(s => s.songId === song) || { difficulties: {} }).difficulties[diff];
    const map = new Map(); ((chart && chart.notes) || []).forEach(x => { if (Array.isArray(x.slidePoints)) map.set(Math.round(Number(x.timeMs)) + ':' + Number(x.lane), x); });
    window.__slideSkyAt = (n, t) => { if (typeof rhythmSlideSkyAt !== 'function') return 0; const o = map.get(Math.round(Number(n.timeMs)) + ':' + Number(n.lane)) || n; return Array.isArray(o.slidePoints) ? rhythmSlideSkyAt(o, t) : 0; };
  }, [SONG, DIFF]);
  if (Number(arg('freeze', 0)) === 3) { await page.evaluate(() => { const orig = window.__slideSkyAt; window.__slideSkyAt = (n, t) => orig(window.__bandAt ? window.__bandAt(n, t) : n, t); }); console.log('持ち替えの組', JSON.stringify(await page.evaluate(() => window.__pairs3))); }
  // --persona thumb|lean|normal で人の指のくせ(手前を押す・横のばらつき・時刻のずれ)を入れる(HELL の操作のしやすさの洗い出し・2026-10-12)。既定は くせ無しの center
  const PERSONA = arg('persona', 'center'), HUMAN = PERSONA !== 'center';
  const args = { sigma: HUMAN ? Number(arg('sigma', 28)) : 0, missRate: 0, seed: Number(arg('seed', 7)), human: HUMAN, persona: PERSONA, input: 'ios', dropRate: 0, lateRate: 0, touchSrc: touchInputSource };
  // --travel u: 親指の上下が届ききらない人(HELL の操作のしやすさの洗い出し・2026-10-12)。同じ側の指が --travel-ms 以内に高さを変えて押すとき、
  // 空中の高さ(RHYTHM_SKY_LIFT)の u 倍だけ手前で止まる(地上→空中は低めに、空中→地上は高めに押す)。既定は 0(くせ無し)
  const TRAVEL = Number(arg('travel', 0)), TRAVEL_MS = Number(arg('travel-ms', 250));
  if (TRAVEL > 0) await page.evaluate(([u, win]) => {
    const last = { L: null, R: null };
    window.__travelLog = { up: 0, down: 0 };
    window.__travel = (n, c, now, p, hab) => {
      // 同じ手かどうかは、ボットが割り振った手で見る(押さえている手のそばのノーツは反対の手・scenarios/rhythm.js の版2)
      const side = hab && Number.isFinite(hab.hand) ? (hab.hand === 0 ? 'L' : 'R') : c < 2.5 ? 'L' : 'R';
      const sh = Number(n.skyHeight) > 0 ? Number(n.skyHeight) : (window.__slideSkyAt ? window.__slideSkyAt(n, Number(n.timeMs) || 0) : 0);
      const sky = sh >= .5, prev = last[side], t = Math.round(Number(n.timeMs)); last[side] = { sky, now, t };
      // 同じ時刻(和音)は高さの切り替えに数えない(版3)。1本の手で同時に地上と空中は押さないので、和音は両手に分かれている
      if (!prev || prev.sky === sky || prev.t === t || now - prev.now > win) return p;
      const rr = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(), d = rr.height * RHYTHM_SKY_LIFT.ratio * u;
      window.__travelLog[sky ? 'up' : 'down']++;
      return { x: p.x, y: p.y + (sky ? d : -d) };
    };
  }, [TRAVEL, TRAVEL_MS]);
  // --no-nudge: 押さえている指が、もう片方の指が近くを押した勢いでつられて動くくせ(scenarios/rhythm.js)だけを止める。乱数の引き方は同じにして、ほかのくせはそのまま
  // 持ち替え(mode 3)で反対の帯を受け持った指は、その帯の終わりまで押さえる(__untilFor が無ければ今までどおり自分の帯の終わり)
  if (!player2.includes('if (now >= a.until) {')) throw new Error('指を離す行が見つからない');
  const player2b = player2.replace('if (now >= a.until) {', 'if (now >= (window.__untilFor ? window.__untilFor(a, now) : a.until)) {');
  const player3 = process.argv.includes('--no-nudge') ? player2b.replace('a.drift = { at: now,', 'a.drift = ((d) => window.__noNudge ? a.drift : d)({ at: now,').replace('downU.y * rand() * 6 };', 'downU.y * rand() * 6 });') : player2b;
  if (process.argv.includes('--no-nudge')) { if (player3 === player2b) throw new Error('つられの行が見つからない'); await page.evaluate(() => { window.__noNudge = true; }); }
  // --touch-log <ファイル>: 指の合図(touchstart/move/end)を曲の時刻つきで控えて書き出す(指どうしの近さ・交差を見る・2026-10-13)
  if (arg('touch-log')) await page.evaluate(() => {
    window.__touchLog = [];
    const rec = (e) => { const t = window.__mhTestHooks?.rhythmSongMs?.(); if (t == null || window.__touchLog.length > 400000) return;
      for (const c of e.changedTouches) window.__touchLog.push([Math.round(t), e.type[5], c.identifier, Math.round(c.clientX), Math.round(c.clientY)]); };
    for (const k of ['touchstart', 'touchmove', 'touchend']) document.addEventListener(k, rec, { capture: true, passive: true });
  });
  await page.evaluate(`(${player3})(${JSON.stringify(args)})`);
  await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a - 1500, FROM, { timeout: 600000, polling: 200 });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const tick = (t) => { window.__ft.push([window.__mhTestHooks?.rhythmSongMs?.(), t - last]); last = t; if (window.__ft.length < 30000) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForFunction((a) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= a, FROM, { timeout: 600000, polling: 'raf' });
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await page.waitForFunction((b) => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) >= b, TO, { timeout: 600000, polling: 'raf' });
  const { profile } = await cdp.send('Profiler.stop');
  console.log('判定', JSON.stringify(await page.evaluate(() => { const r = window.__mhTestHooks.rhythmNoteResults?.() || [], n = window.__mhTestHooks.rhythmNotes?.() || []; const h = {}; r.forEach(x => { if (x && x.judgment) h[x.judgment] = (h[x.judgment] || 0) + 1; });
    const sl = n.map((x, i) => [x, r[i]]).filter(([x]) => x.type === 'SLIDE' && [106771, 107339, 127367, 127772].includes(Math.round(x.timeMs))).map(([x, y]) => [Math.round(x.timeMs), y && y.judgment, y && y.done]);
    return { 合計: h, 刻み: window.__mhTestHooks.rhythmTickCounts?.(), 済み: r.filter(x => x && x.done).length, 見張ったスライド: Object.keys(window.__offMs).map(i => ({ 始まり: Math.round(n[i].timeMs), 判定: r[i] && r[i].judgment, 光った線: n[i].ticks,  暗かった秒: +(window.__offMs[i] / 1000).toFixed(2), 暗かった区間: window.__offSpans[i].slice(0, 8) })) }; })));
  // 外れたノーツの一覧(BAD_LIST=1): 時刻・種類・空中の高さ(タップの高さ/スライドの押し始めの高さ)
  if (TRAVEL > 0) console.log('届ききらずに押した回数', JSON.stringify(await page.evaluate(() => window.__travelLog)));
  if (arg('touch-log')) { const area = await page.evaluate(() => { const r = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, line: RHYTHM_JUDGMENT_LINE_Y.ratio, sky: typeof rhythmSkyLineRatio === 'function' ? rhythmSkyLineRatio() : null }; });
    fs.writeFileSync(arg('touch-log'), JSON.stringify({ area, log: await page.evaluate(() => window.__touchLog) })); }
  if (process.env.BAD_LIST) console.log('外れたノーツ', JSON.stringify(await page.evaluate(() => { const r = window.__mhTestHooks.rhythmNoteResults?.() || [], n = window.__mhTestHooks.rhythmNotes?.() || [];
    return n.map((x, i) => [x, r[i]]).filter(([, y]) => y && y.done && /BAD|MISS|GOOD/.test(y.judgment || '')).map(([x, y]) => [Math.round(x.timeMs), x._rhythmOriginalType || x.type, Number(x.skyHeight) || (window.__slideSkyAt ? +window.__slideSkyAt(x, x.timeMs).toFixed(2) : 0), y.judgment]); })));
  if (process.env.PERF_DEBUG) { console.log('区間の終わりの様子', JSON.stringify(await page.evaluate(() => { const r = window.__mhTestHooks.rhythmNoteResults?.() || []; return { 済み: r.filter(x => x.done).length, MISS: r.filter(x => x.judgment === 'MISS').length, 止め: !!document.querySelector('[data-rhythm-pause-menu]'), 文字: (document.querySelector('main')?.innerText || '').replace(/\s+/g, ' ').slice(0, 160) }; }))); const shot = require('path').join(require('os').tmpdir(), 'rhythm-frame-perf.png'); await page.screenshot({ path: shot }); console.log('画面:', shot); }
  const ft = (await page.evaluate(() => window.__ft)).filter(([m]) => m != null && m >= FROM && m < TO).map(([, d]) => d).sort((x, y) => x - y);
  const sec = (TO - FROM) / 1000;
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map(); profile.nodes.forEach(n => (n.children || []).forEach(c => parent.set(c, n.id)));
  const cnt = new Map(); profile.samples.forEach((id, k) => cnt.set(id, (cnt.get(id) || 0) + (profile.timeDeltas[k] || 0)));
  const incl = new Map(); let busy = 0;
  for (const [id, us] of cnt) {
    if (byId.get(id).callFrame.functionName !== '(idle)') busy += us;
    let x = id; const seen = new Set();
    while (x != null) { const key = byId.get(x).callFrame.functionName || '(無名)'; if (!seen.has(key)) { seen.add(key); incl.set(key, (incl.get(key) || 0) + us); } x = parent.get(x); }
  }
  const avg = ft.length ? ft.reduce((p, q) => p + q, 0) / ft.length : 0;
  console.log(`${SONG} ${DIFF} ${FROM / 1000}〜${TO / 1000}秒 CPU${CPU}倍 ${W}x${H}`);
  console.log(`  1コマ: ${ft.length}コマ 平均${avg.toFixed(1)}ms 95%${(ft[Math.floor(ft.length * .95)] || 0).toFixed(0)}ms 最長${(ft[ft.length - 1] || 0).toFixed(0)}ms 50ms超${ft.filter(d => d > 50).length}`);
  console.log(`  忙しさ: 1秒あたり ${(busy / 1000 / sec).toFixed(0)}ms`);
  console.log(`  含む時間(1秒あたり ms): ${FUNCS.map(k => `${k} ${((incl.get(k) || 0) / 1000 / sec).toFixed(1)}`).join(' / ')}`);
  console.log(`  (参考)getBoundingClientRect ${((incl.get('getBoundingClientRect') || 0) / 1000 / sec).toFixed(1)}ms はボットの分`);
  if (errors.length) console.log(`  ページのエラー: ${errors.join(' | ')}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
