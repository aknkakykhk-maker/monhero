#!/usr/bin/env node
// 実機で取った「入力の記録」(デバッグ設定・RHYTHM_INPUT_REC・2026-10-15)を、Chromium で同じ曲・同じ時刻に
// タッチとして流し直し、判定の出来事(付いた/外れた/控え/浮き/交差の持ち替え/MISS の理由)が実機と同じかを比べる。
//
//   node tools/mode/rhythm-input-replay.js <記録.json>                 # 流して比べる(結果を表で出す)
//   node tools/mode/rhythm-input-replay.js <記録.json> --out <出力.json> # 再生側の記録と突き合わせの結果も書き出す
//   node tools/mode/rhythm-input-replay.js <記録.json> --tol 40        # 出来事を同じとみなす時刻の差(ms・既定 40)
//   node tools/mode/rhythm-input-replay.js <記録.json> --shots <フォルダ> # 再生中の静止画を1秒おきに書き出す
//
// 流し方
//   ・画面の大きさ・倍率は記録のとおり(view.w×view.h・dpr)。設定(速さ・判定の幅など)も記録の settings を入れる
//   ・曲はデバッグの全解放の曲えらびから始める(鍵・ランキング・保存に触らない)。デバッグ演奏ではアシストが効かないので、
//     記録がアシストありなら最初にそう断る
//   ・指は記録の touch の出来事だけを CDP の Input.dispatchTouchEvent で流す(pointer は Chromium がタッチから作る)。
//     時刻は記録の performance.now() を曲の頭に合わせて写す(曲が始まる前の指も同じ間合いで流す)
//   ・再生側でも記録を取り、届いた時刻のずれ(流した側の精度)も出す
//   ・ラッキーラッシュなど偶然で決まるものは実機と同じにならない。比べるのは入力の扱い(判定の出来事)
//   ・曲の頭の合わせには数msのぶれが残る(2026-10-15 の往復で 0.3〜5.7ms)。判定幅の端ぎりぎり(dt が GOOD の端に近い)の出来事は、
//     その数msで「付いた」⇔「空押し+MISS」が入れ替わることがある。違いが出たら dt を見て、端の1件だけなら作りの差ではない
//   ・ほかの Chromium(検査など)と同時に回すと処理が詰まって指が遅れることがある。1本ずつ回す
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9204;
const args = process.argv.slice(2);
const opt = (name, def = null) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const FILE = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const OUT = opt('--out'), SHOTS = opt('--shots'), TOL = Number(opt('--tol', 40)) || 40;
if (!FILE && require.main === module) { console.log('使い方: node tools/mode/rhythm-input-replay.js <記録.json> [--out <出力.json>] [--tol 40] [--shots <フォルダ>]'); process.exit(2); }

// ---- 記録を読む(コピーした JSON の前後に余計な文字が付いていても読む) ----
const readRecord = (file) => {
  const raw = fs.readFileSync(file, 'utf8');
  const a = raw.indexOf('{'), b = raw.lastIndexOf('}');
  const rec = JSON.parse(raw.slice(a, b + 1));
  if (!rec || !Array.isArray(rec.events) || !rec.songId || !rec.difficultyId) throw new Error('入力の記録の形ではありません(events・songId・difficultyId が要る)');
  return rec;
};

// ---- 曲の頭の時刻(記録の performance.now() のどこで曲の 0ms だったか) ----
const songStartAt = (events) => {
  const xs = events.filter((e) => Number.isFinite(e.ms) && e.ms > 50 && Number.isFinite(e.at)).map((e) => e.at - e.ms).sort((p, q) => p - q);
  return xs.length ? xs[Math.floor(xs.length / 2)] : null;
};

// ---- 出来事が起きた時刻(端末の e.timeStamp)。無い・基準が違う(performance.now() と大きく離れる)ときは受け取った時刻 ----
const occurAt = (e) => (Number.isFinite(e.ts) && Number.isFinite(e.at) && Math.abs(e.at - e.ts) < 5000 ? e.ts : e.at);

// ---- 指の出来事 → CDP に渡す「そのとき触れている指の全部」の列 ----
// iPhone の identifier は大きな数なので、CDP には小さな番号に直して渡す
const touchPlan = (events, recStart) => {
  const ids = new Map(); let nextId = 1;
  const live = new Map();
  const plan = [];
  for (const e of events) {
    if (!/^touch/.test(e.k) || !Array.isArray(e.c) || !Number.isFinite(e.at)) continue;
    for (const t of e.c) {
      if (!ids.has(t.id)) ids.set(t.id, nextId++);
      const id = ids.get(t.id);
      if (e.k === 'touchstart' || e.k === 'touchmove') live.set(id, { id, x: t.x, y: t.y, radiusX: Math.max(.5, t.rx || 1), radiusY: Math.max(.5, t.ry || 1), force: t.f || 0 });
      else live.delete(id);
    }
    const type = e.k === 'touchstart' ? 'touchStart' : e.k === 'touchmove' ? 'touchMove' : e.k === 'touchcancel' ? 'touchCancel' : 'touchEnd';
    plan.push({ rel: occurAt(e) - recStart, type, points: [...live.values()].map((p) => ({ ...p })), src: e });
  }
  return plan;
};

// ---- 判定の出来事を突き合わせる ----
// 同じ種類・同じノーツ(d.note があれば)・時刻の差が TOL 以内のものを、早い順に1対1で結ぶ
const judgeKey = (e) => `${e.type}|${e.d && e.d.note != null ? e.d.note : ''}`;
const compareJudges = (orig, replay, tol) => {
  const pool = new Map();
  replay.forEach((e, i) => { const k = judgeKey(e); if (!pool.has(k)) pool.set(k, []); pool.get(k).push({ e, i, used: false }); });
  const missingInReplay = [], dts = [];
  for (const o of orig) {
    const cand = (pool.get(judgeKey(o)) || []).filter((c) => !c.used && Math.abs((c.e.ms ?? 0) - (o.ms ?? 0)) <= tol)
      .sort((p, q) => Math.abs(p.e.ms - o.ms) - Math.abs(q.e.ms - o.ms))[0];
    if (cand) { cand.used = true; dts.push(cand.e.ms - o.ms); } else missingInReplay.push(o);
  }
  const extraInReplay = [...pool.values()].flat().filter((c) => !c.used).map((c) => c.e).sort((p, q) => p.ms - q.ms);
  const byType = {};
  for (const e of orig) (byType[e.type] ||= { orig: 0, replay: 0 }).orig++;
  for (const e of replay) (byType[e.type] ||= { orig: 0, replay: 0 }).replay++;
  return { byType, matched: dts.length, missingInReplay, extraInReplay, dts };
};

const stats = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((p, q) => p - q), abs = xs.map(Math.abs).sort((p, q) => p - q);
  return { n: xs.length, median: s[Math.floor(s.length / 2)], p95abs: abs[Math.min(abs.length - 1, Math.floor(abs.length * .95))], maxAbs: abs[abs.length - 1] };
};
const fmt = (e) => `${(e.ms ?? 0).toFixed(0).padStart(7)}ms ${e.type}${e.d && Object.keys(e.d).length ? ' ' + JSON.stringify(e.d).slice(0, 120) : ''}`;

if (require.main !== module) { module.exports = { readRecord, songStartAt, occurAt, touchPlan, compareJudges }; return; }

(async () => {
  let rec;
  try { rec = readRecord(path.resolve(FILE)); } catch (e) { console.log(`記録を読めません: ${e.message}`); process.exit(2); }
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('playwright が入っていないので再生できません'); process.exit(2); }
  const recStart = songStartAt(rec.events);
  if (recStart == null) { console.log('記録に曲の時刻が入っていません(曲が始まる前に終わった記録)'); process.exit(2); }
  const plan = touchPlan(rec.events, recStart);
  const origJudges = rec.events.filter((e) => e.k === 'judge');
  const view = { w: Math.round(rec.view?.w || 844), h: Math.round(rec.view?.h || 390), dpr: Number(rec.view?.dpr) || 2 };
  console.log(`記録: ${rec.songId} ${rec.difficultyId} / 画面 ${view.w}×${view.h}@${view.dpr} / 指の出来事 ${plan.length} / 判定の出来事 ${origJudges.length}`);
  if (rec.assist) console.log('注意: 記録はアシストありですが、デバッグ演奏ではアシストが効きません(付いた/外れたの数が変わることがあります)');
  if (rec.extra?.interrupted) console.log('注意: 途中でやめた演奏の記録です(最後の指のあと少しで止めます)');

  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  let code = 0;
  try {
    const page = await browser.newPage({ viewport: { width: view.w, height: view.h }, deviceScaleFactor: view.dpr, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // 助手のおしゃべりの中継(Edge Function)も本物へ届けない。差し替えが無いと本物の中継が AI を呼ぶ(2026-10-27)
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    const { quietBootSeed } = require('../boot/quiet-boot-seed');
    await page.addInitScript(quietBootSeed());
    await page.addInitScript((settings) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
      if (settings && typeof settings === 'object') put('mh_rhythm_settings_v1', settings);
      localStorage.setItem('mh_rhythm_input_rec_v1', 'on');
    }, rec.settings || null);

    // デバッグの全解放の曲えらびを開く(rhythm-debug-select-check.js と同じ道すじ)
    const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find((x) => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    for (let i = 0, q = 0; i < 80 && q < 6; i++) { if (await clickText('^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|次へ)$')) { q = 0; await page.waitForTimeout(300); } else { q++; await page.waitForTimeout(400); } }
    await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    await clickText('💊'); await page.waitForTimeout(1200);
    await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find((x) => /モンヒロビート/.test(x.textContent)); if (s) s.click(); }); await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
    if (!(await page.evaluate(() => { const b = document.querySelector('[data-rhythm-debug-select-open]'); if (b) b.click(); return !!b; }))) throw new Error('デバッグの全解放の曲えらびを開けません');
    await page.waitForTimeout(1200);
    const sel = await page.evaluate((songId) => {
      const song = [...RHYTHM_SONGS, ...(typeof RHYTHM_PROTO_SONGS !== 'undefined' ? RHYTHM_PROTO_SONGS : [])].find((s) => s.songId === songId); if (!song) return 'no-song';
      const sub = song.subtitle || '';
      const row = [...document.querySelectorAll('[data-rhythm-song-row]')].find((r) => r.textContent.includes(song.displayName) && (!sub || r.textContent.includes(sub)));
      if (!row) return 'no-row'; row.click(); return 'ok';
    }, rec.songId);
    if (sel !== 'ok') throw new Error(`曲 ${rec.songId} を選べません(${sel})`);
    await page.waitForTimeout(500);
    await page.evaluate((d) => document.querySelector(`[data-rhythm-debug-select] [data-rhythm-difficulty="${d}"]`)?.click(), rec.difficultyId); await page.waitForTimeout(400);
    if (!(await page.evaluate((d) => { const b = document.querySelector(`[data-rhythm-debug-select] [data-rhythm-demo-start="${d}"]`); if (b) b.click(); return !!b; }, rec.difficultyId))) throw new Error(`難易度 ${rec.difficultyId} で始められません`);
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForFunction(() => RHYTHM_INPUT_REC.isRecording(), null, { timeout: 30000 });

    const area = await page.evaluate(() => { const r = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height }; });
    if (rec.area && (Math.abs(area.w - rec.area.w) > 2 || Math.abs(area.h - rec.area.h) > 2)) console.log(`注意: 演奏面の大きさが記録と違います(記録 ${rec.area.w}×${rec.area.h} / 再生 ${area.w.toFixed(1)}×${area.h.toFixed(1)})。位置は演奏面の左上からの距離のまま流します`);

    // 曲が鳴り始めるのを待ってから、Node の時計とページの performance.now() を結ぶ
    await page.waitForFunction(() => RHYTHM_INPUT_REC.songMs() > 200, null, { timeout: 60000 });
    const now = () => Number(process.hrtime.bigint()) / 1e6;
    const sync = async () => {
      let best = null;
      for (let i = 0; i < 7; i++) {
        const t0 = now(); const [perf, ms] = await page.evaluate(() => [performance.now(), RHYTHM_INPUT_REC.songMs()]); const t1 = now();
        if (!best || t1 - t0 < best.rtt) best = { rtt: t1 - t0, offset: perf - (t0 + t1) / 2, start: perf - ms };
      best.origin = best.origin ?? await page.evaluate(() => performance.timeOrigin);
      }
      return best;
    };
    const s = await sync();
    // 曲の時刻は音の時計に合わせて少しずつ動くので、1回の測定だと 20ms ほどぶれる。指の間が空いたところで測り直し、中央値を使う
    const starts = [s.start];
    let lastSync = now();
    const resync = async () => { const t = await sync(); starts.push(t.start); s.offset = t.offset; const xs = [...starts].sort((p, q) => p - q); s.start = xs[Math.floor(xs.length / 2)]; lastSync = now(); };
    // 記録の曲の頭(recStart)= 再生の曲の頭(s.start)。Node の時刻 = ページの時刻 - offset
    const nodeAt = (rel) => s.start + rel - s.offset;
    const cdp = await page.context().newCDPSession(page);
    const late = [];
    let shotNext = 0, shotN = 0;
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    for (const p of plan) {
      if (now() - lastSync > 1500 && nodeAt(p.rel) - now() > 250) await resync();
      const target = nodeAt(p.rel);
      let wait = target - now();
      if (wait > 4) await new Promise((r) => setTimeout(r, wait - 3));
      while (now() < target) { /* 最後の数ms は回って待つ */ }
      late.push(now() - target);
      const touchPoints = p.points.map((t) => ({ x: area.l + t.x, y: area.t + t.y, id: t.id, radiusX: t.radiusX, radiusY: t.radiusY, force: t.force }));
      // 起きた時刻も渡す。ゲームは e.timeStamp から受け取りまでの遅れを差し引くので、実機と同じ間合いになる
      // CDP の決まり: touchEnd・touchCancel は指を並べずに送る(全部離す)。一部の指だけ離すときは、残りの指を並べた touchMove で送る
      //(並べた指と前の状態の差から、離した指の touchend が作られる)。一部の指の cancel も同じく touchMove になる(cancel ではなく end として届く)
      const partial = (p.type === 'touchEnd' || p.type === 'touchCancel') && touchPoints.length > 0;
      const type = partial ? 'touchMove' : p.type;
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : touchPoints, timestamp: (s.origin + s.start + p.rel) / 1000 });
      if (SHOTS && now() > shotNext) { shotNext = now() + 1000; await page.screenshot({ path: path.join(SHOTS, `replay-${String(shotN++).padStart(3, '0')}.jpg`), type: 'jpeg', quality: 70 }); }
    }
    // 曲の終わり(または途中でやめた記録なら最後の指の 3 秒あと)まで待つ
    const lastRel = plan.length ? plan[plan.length - 1].rel : 0;
    const endBy = nodeAt(lastRel) + (rec.extra?.interrupted ? 3000 : 15 * 60 * 1000);
    while (now() < endBy && await page.evaluate(() => RHYTHM_INPUT_REC.isRecording())) await page.waitForTimeout(500);
    const replay = await page.evaluate(() => { RHYTHM_INPUT_REC.close(); return RHYTHM_INPUT_REC.last(); });

    // ---- 比べる ----
    const startsOf = (evs) => evs.filter((e) => e.k === 'touchstart');
    const oS = startsOf(rec.events), rS = startsOf(replay.events);
    const repStart = songStartAt(replay.events);
    const deliver = [];
    const age = (evs) => stats(evs.filter((e) => Number.isFinite(e.ts)).map((e) => e.at - e.ts));
    for (let i = 0; i < Math.min(oS.length, rS.length); i++) deliver.push((occurAt(rS[i]) - repStart) - (occurAt(oS[i]) - recStart));
    const replayJudges = replay.events.filter((e) => e.k === 'judge');
    const cmp = compareJudges(origJudges, replayJudges, TOL);
    console.log('');
    console.log(`指: 記録 touchstart ${oS.length} / 再生 ${rS.length}`);
    const ds = stats(deliver), ls = stats(late);
    if (ds) console.log(`届いた時刻のずれ(再生 - 記録・曲の頭から): 中央 ${ds.median.toFixed(1)}ms / 95% ${ds.p95abs.toFixed(1)}ms / 最大 ${ds.maxAbs.toFixed(1)}ms`);
    if (ls) console.log(`流す側の遅れ: 中央 ${ls.median.toFixed(1)}ms / 最大 ${ls.maxAbs.toFixed(1)}ms`);
    const oa = age(oS), ra = age(rS);
    if (oa || ra) console.log(`起きてから受け取るまで(touchstart): 記録 ${oa ? `中央 ${oa.median.toFixed(1)}ms・最大 ${oa.maxAbs.toFixed(1)}ms` : '-'} / 再生 ${ra ? `中央 ${ra.median.toFixed(1)}ms・最大 ${ra.maxAbs.toFixed(1)}ms` : '-'}`);
    console.log('');
    console.log('判定の出来事(種類ごと)       記録   再生');
    for (const [type, c] of Object.entries(cmp.byType).sort()) console.log(`  ${type.padEnd(24)} ${String(c.orig).padStart(6)} ${String(c.replay).padStart(6)}${c.orig === c.replay ? '' : '  ←違う'}`);
    console.log(`結び付いた ${cmp.matched} / 記録にだけある ${cmp.missingInReplay.length} / 再生にだけある ${cmp.extraInReplay.length}(時刻の差 ${TOL}ms まで同じとみなす)`);
    if (cmp.missingInReplay.length) { console.log('\n記録にだけある(実機で起きて、Chromium では起きなかった):'); cmp.missingInReplay.slice(0, 20).forEach((e) => console.log('  ' + fmt(e))); }
    if (cmp.extraInReplay.length) { console.log('\n再生にだけある(Chromium で起きて、実機では起きなかった):'); cmp.extraInReplay.slice(0, 20).forEach((e) => console.log('  ' + fmt(e))); }
    if (rec.extra && replay.extra) console.log(`\nスコア: 記録 ${rec.extra.score ?? '-'} / 再生 ${replay.extra.score ?? '-'}(ラッキーラッシュなど偶然のぶんは違ってよい)`);
    if (!origJudges.length) console.log('\n注意: 記録に判定の出来事がありません(判定の出来事を記録する前の版で取った記録)。指が届いたかだけを見ました');
    if (errors.length) console.log(`\n画面のエラー: ${errors.slice(0, 3).join(' / ')}`);
    if (OUT) {
      fs.writeFileSync(OUT, JSON.stringify({ record: { songId: rec.songId, difficultyId: rec.difficultyId }, deliver: ds, late: ls, compare: { byType: cmp.byType, matched: cmp.matched, missingInReplay: cmp.missingInReplay, extraInReplay: cmp.extraInReplay }, replay }, null, 0));
      console.log(`\n書き出し: ${OUT}`);
    }
    code = cmp.missingInReplay.length || cmp.extraInReplay.length ? 1 : 0;
  } catch (e) {
    console.log(`再生できませんでした: ${String(e && e.message || e).slice(0, 300)}`);
    code = 2;
  } finally {
    await browser.close(); server.close();
  }
  process.exit(code);
})();
