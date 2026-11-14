// MFバトルカードの重さを測る(2026-11-11 カード部カルク・社長の「新モデルでやるべきこと」5位 軽量化)。
//   node tools/card/card-perf-measure.js                        対戦30回+画面の行き来30回(縦 390×844。10〜20分)
//   PERF_BATTLES=5 PERF_LOOPS=5 node tools/card/card-perf-measure.js   回数を変える
//   PERF_OUT=<file.json> を付けると、回ごとの数字を JSON で残す
//   PERF_VIEWPORT=844x390 で横
//
// 測るもの(回ごと。測る前に CDP で GC をかける)
//   heap … JS のメモリ(Performance.getMetrics の JSHeapUsedSize)
//   nodes … DOM の数(Nodes。はずれた DOM も数える)・domLive … いま画面にある要素の数
//   listeners … イベントの受け口の数(JSEventListeners)
//   timers … 動いている setInterval の数・rAF の待ちの数(はじめに数える仕掛けを入れる)
//   imgs … 読み込んだ画像の数と大きさ(resource の数・ユニークな URL・合計の転送量)・<img> の数・decode 済みの大きさ
//   longtask … 前の回からの長いタスク(50ms 超)の数と合計 ms・最大 ms
// 増え続ける(回数に比べて右肩上がり)ものは「持ちっぱなしの疑い」。最後に、はじめの3回の平均と終わりの3回の平均の差と、傾き(1回あたり)を出す
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));

const N_BATTLES = Number(process.env.PERF_BATTLES || 30);
const N_LOOPS = Number(process.env.PERF_LOOPS || 30);
const PORT = Number(process.env.CARD_PORT) || 8961;
const [VW, VH] = (process.env.PERF_VIEWPORT || '390x844').split('x').map(Number);
const OUT = process.env.PERF_OUT || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };

// ページの中に入れる数える仕掛け(長いタスク・タイマー・rAF)
const PROBE = () => {
  const w = window;
  if (w.__perf) return;
  const P = w.__perf = { long: [], loaf: [], intervals: new Set(), raf: new Set(), timeouts: new Set() };
  try { performance.setResourceTimingBufferSize(100000); } catch (_) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { P.loaf.push(e.duration); (P.loafDetail || (P.loafDetail = [])).push({ d: Math.round(e.duration), block: Math.round(e.blockingDuration || 0), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: (e.scripts || []).map((x) => ({ d: Math.round(x.duration), inv: String(x.invoker || '').slice(0, 60), fn: String(x.sourceFunctionName || '').slice(0, 40), src: String(x.sourceURL || '').replace(/^.*\//, '').slice(0, 40), pos: x.sourceCharPosition, layout: Math.round(x.forcedStyleAndLayoutDuration || 0) })) }); } }).observe({ type: 'long-animation-frame', buffered: false }); } catch (_) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) P.long.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch (_) {}
  const si = w.setInterval, ci = w.clearInterval, st = w.setTimeout, ct = w.clearTimeout, ra = w.requestAnimationFrame, ca = w.cancelAnimationFrame;
  w.setInterval = function (...a) { const id = si.apply(this, a); P.intervals.add(id); return id; };
  w.clearInterval = function (id) { P.intervals.delete(id); return ci.call(this, id); };
  w.setTimeout = function (fn, ...a) { let id; const f = typeof fn === 'function' ? function (...b) { P.timeouts.delete(id); return fn.apply(this, b); } : fn; id = st.call(this, f, ...a); P.timeouts.add(id); return id; };
  w.clearTimeout = function (id) { P.timeouts.delete(id); return ct.call(this, id); };
  w.requestAnimationFrame = function (fn) { let id; id = ra.call(this, (t) => { P.raf.delete(id); fn(t); }); P.raf.add(id); return id; };
  w.cancelAnimationFrame = function (id) { P.raf.delete(id); return ca.call(this, id); };
};

const serve = () => new Promise((res) => {
  const s = http.createServer((req, r) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    // 本番(GitHub Pages)と同じく 10分のキャッシュと Last-Modified を付ける(付けないと同じ絵を何度も取り直して見える)
    const st = fs.statSync(f);
    if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(st.mtime.toUTCString())) { r.writeHead(304); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'max-age=600', 'Last-Modified': st.mtime.toUTCString() });
    fs.createReadStream(f).pipe(r);
  });
  s.listen(PORT, () => res(s));
});

// PERF_PROFILE=1: 対戦1回目と行き来1回目の CPU プロフィールを取り、自分の時間(self)の多い関数を出す
const PROFILE = !!process.env.PERF_PROFILE;
const profStart = async (cdp) => { if (!PROFILE) return; await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); };
const profStop = async (cdp, label) => {
  if (!PROFILE) return;
  const { profile } = await cdp.send('Profiler.stop');
  const dt = {}; const ids = profile.samples; const td = profile.timeDeltas;
  for (let i = 0; i < ids.length; i++) dt[ids[i]] = (dt[ids[i]] || 0) + (td[i] || 0);
  const self = {}, byUrl = {};
  for (const n of profile.nodes) {
    const t = (dt[n.id] || 0) / 1000; if (!t) continue;
    const cf = n.callFrame; const file = String(cf.url || '').replace(/^.*\//, '').replace(/\?.*$/, '');
    const k = `${cf.functionName || '(anon)'} ${file}:${cf.lineNumber + 1}`;
    self[k] = (self[k] || 0) + t; byUrl[file || cf.functionName] = (byUrl[file || cf.functionName] || 0) + t;
  }
  console.log(`--- プロフィール ${label}(自分の時間 ms)`);
  console.log('  ファイル別: ' + Object.entries(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round(v)}`).join(' / '));
  for (const [k, v] of Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`  ${Math.round(v).toString().padStart(6)}  ${k}`);
};
const slope = (ys) => { const n = ys.length; if (n < 2) return 0; const xm = (n - 1) / 2; const ym = ys.reduce((a, b) => a + b, 0) / n; let num = 0, den = 0; ys.forEach((y, i) => { num += (i - xm) * (y - ym); den += (i - xm) ** 2; }); return num / den; };
const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);

let prevM = null;
async function measure(page, cdp, label) {
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(150);
  await cdp.send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  // 前の回からの差: レイアウトの回数・時間、スタイルの計算の時間、スクリプトの時間(ms)
  const d = (k, mul = 1) => Math.round(((m[k] || 0) - ((prevM && prevM[k]) || 0)) * mul);
  const work = { layoutN: d('LayoutCount'), layoutMs: d('LayoutDuration', 1000), styleN: d('RecalcStyleCount'), styleMs: d('RecalcStyleDuration', 1000), scriptMs: d('ScriptDuration', 1000), taskMs: d('TaskDuration', 1000) };
  prevM = m;
  const inPage = await page.evaluate(() => {
    const P = window.__perf || { long: [], intervals: new Set(), raf: new Set(), timeouts: new Set() };
    const long = P.long.splice(0);
    const loaf = (P.loaf || []).splice(0);
    const loafDetail = (P.loafDetail || []).splice(0).sort((a, b) => b.d - a.d).slice(0, 6);
    // 画面で使う画像(img・CSS)。fetch は事前ダウンロード(25 の ASSET_CACHE。キャッシュへ入れるだけでメモリに持たない)なので分けて数える
    const all = performance.getEntriesByType('resource').filter((e) => /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(e.name) || e.initiatorType === 'img');
    const res = all.filter((e) => e.initiatorType !== 'fetch');
    const pre = all.filter((e) => e.initiatorType === 'fetch');
    const urls = new Set(res.map((e) => e.name.split('?')[0]));
    const seen = P.seen || (P.seen = new Set());
    const fresh = [...urls].filter((u) => !seen.has(u)); fresh.forEach((u) => seen.add(u));
    // 新しい画像を、その直前の操作(mark)ごとに数える
    const marks = (P.marks || []).splice(0);
    const byStep = {};
    for (const e of res) {
      const u = e.name.split('?')[0];
      if (!fresh.includes(u)) continue;
      let st = 'before'; for (const m of marks) if (m.t <= e.startTime) st = m.n;
      const dir = u.replace(/^.*monster-hero\//, '').split('/').slice(0, -1).join('/');
      const k = `${st}:${dir}`; byStep[k] = (byStep[k] || 0) + 1;
    }
    const again = res.length - urls.size;
    // 前の回からの分だけ: 何度も読んだ絵と、本当に通信した量(transferSize。キャッシュから出たものは 0)
    const from = P.resIdx || 0; P.resIdx = res.length;
    const delta = res.slice(from);
    const cnt = {}; for (const e of delta) { const u = e.name.replace(/^.*monster-hero\//, ''); cnt[u] = (cnt[u] || 0) + 1; }
    const repeatTop = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([u, n]) => `${u}×${n}`);
    const netKB = Math.round(delta.reduce((s, e) => s + (e.transferSize || 0), 0) / 1024);
    const reqN = delta.length;
    const kinds = {}; for (const e of delta) { const k = `${e.initiatorType}/${e.transferSize > 0 ? 'net' : 'cache'}`; kinds[k] = (kinds[k] || 0) + 1; }
    const imgs = [...document.images];
    const decoded = imgs.reduce((s, i) => s + (i.naturalWidth * i.naturalHeight * 4 || 0), 0);
    const bigImgs = imgs.filter((i) => i.naturalWidth * i.naturalHeight > 4 * Math.max(1, i.clientWidth * devicePixelRatio) * Math.max(1, i.clientHeight * devicePixelRatio) && i.clientWidth > 0).length;
    const blobUrls = imgs.filter((i) => i.src.startsWith('blob:')).length;
    const dataUrls = imgs.filter((i) => i.src.startsWith('data:')).length;
    const canvases = document.querySelectorAll('canvas').length;
    const anims = document.getAnimations ? document.getAnimations().length : -1;
    return {
      domLive: document.getElementsByTagName('*').length,
      intervals: P.intervals.size, raf: P.raf.size, timeouts: P.timeouts.size,
      resImgs: res.length, resImgUrls: urls.size, resImgKB: Math.round(res.reduce((s, e) => s + (e.transferSize || e.encodedBodySize || 0), 0) / 1024),
      imgEls: imgs.length, imgDecodedMB: +(decoded / 1048576).toFixed(1), bigImgs, blobUrls, dataUrls, canvases, anims,
      loafDetail, prefetchN: pre.length, reqN, netKB, repeatTop, kinds, byStep, newImgs: fresh.map((u) => u.replace(/^.*monster-hero\//, '')), newImgN: fresh.length, refetch: again,
      loafN: loaf.length, loafMs: Math.round(loaf.reduce((a, b) => a + b, 0)), loafMax: Math.round(Math.max(0, ...loaf)),
      topImgs: [...res].sort((a, b) => (b.encodedBodySize || 0) - (a.encodedBodySize || 0)).slice(0, 12).map((e) => `${e.name.replace(/^.*monster-hero\//, '')} ${Math.round((e.encodedBodySize || 0) / 1024)}KB`),
      longN: long.length, longMs: Math.round(long.reduce((a, b) => a + b, 0)), longMax: Math.round(Math.max(0, ...long)),
      screen: (document.querySelector('[data-card-top]') || {}).getAttribute ? document.querySelector('[data-card-top]').getAttribute('data-card-top') : (document.querySelector('[data-card-battle]') ? 'battle' : 'other'),
      ls: Object.keys(localStorage).length,
    };
  });
  return { label, ...work, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(2), heapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(2), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, frames: m.Frames, layouts: m.LayoutCount, styles: m.RecalcStyleCount, taskSec: +m.TaskDuration.toFixed(2), ...inPage };
}

const KEYS = ['layoutN', 'layoutMs', 'styleMs', 'scriptMs', 'taskMs', 'heapMB', 'nodes', 'domLive', 'listeners', 'intervals', 'raf', 'timeouts', 'resImgs', 'resImgUrls', 'resImgKB', 'imgEls', 'imgDecodedMB', 'canvases', 'anims', 'longN', 'longMs', 'longMax', 'loafN', 'loafMs', 'loafMax'];
function summary(name, rows) {
  if (!rows.length) return [];
  const out = [`■ ${name}(${rows.length}回)`];
  const k3 = Math.min(3, Math.floor(rows.length / 2) || 1);
  for (const k of KEYS) {
    const ys = rows.map((r) => r[k]);
    const first = avg(ys.slice(0, k3)), last = avg(ys.slice(-k3));
    const s = slope(ys);
    out.push(`  ${k.padEnd(13)} はじめ ${first.toFixed(1).padStart(8)}  おわり ${last.toFixed(1).padStart(8)}  差 ${(last - first).toFixed(1).padStart(8)}  傾き/回 ${s.toFixed(3)}`);
  }
  return out;
}

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
  const server = await serve();
  const browser = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium', args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] } : {});
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  // PERF_NET=1(調べもの): 立ち絵(images/monsters)を誰が頼んだかを数える
  const netWho = {};
  if (process.env.PERF_NET) {
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', (e) => {
      if (!/images\/monsters\//.test(e.request.url)) return;
      const ini = e.initiator || {};
      const fr = ini.stack && ini.stack.callFrames ? ini.stack.callFrames.slice(0, 3).map((f) => `${f.functionName || 'anon'}:${f.lineNumber + 1}`).join('<') : (ini.url ? `${ini.type} ${String(ini.url).replace(/^.*\//, '')}:${(ini.lineNumber || 0) + 1}` : ini.type);
      const k = `${e.type} ${fr}`; netWho[k] = (netWho[k] || 0) + 1;
    });
  }
  // スマホのつもりで CPU を遅くする(既定 4倍。PERF_CPU=1 で素の速さ)
  const CPU = Number(process.env.PERF_CPU || 4);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  let shareRow = null;
  let versionBody = null;
  // 外へは何も書かない。ほかのブリーダーのデッキは自分のデッキの写しを返す
  await page.route('**/*', (route) => {
    const rq = route.request(); const u = new URL(rq.url());
    // 測っているあいだに作り直しても「新しいバージョンがあります」の帯が出ないよう、version.json は最初の中身のまま返す
    if (u.hostname === 'localhost' && /\/version\.json$/.test(u.pathname)) { if (!versionBody) versionBody = fs.readFileSync(path.join(ROOT, 'monster-hero', 'version.json'), 'utf8'); return route.fulfill({ status: 200, contentType: 'application/json', body: versionBody }); }
    if (u.hostname === 'localhost') return route.continue();
    if (/\/rest\/v1\/card_deck_entries/.test(u.pathname) && rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shareRow ? [shareRow] : []) });
    if (/\/rest\/v1\/rpc\/card_deck_record_of/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (/fonts\.(googleapis|gstatic)\.com|cdnjs|jsdelivr|unpkg/.test(u.hostname)) return route.continue();
    return route.abort();
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
    s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
    s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    s('mh_card_auto_intro_seen_v1', true);
  });
  await page.addInitScript(eventStorySeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').oneTimeNoticeSeed()); // みゅあの今日の助言などの一度きりの案内も済んだことにする // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
  await page.addInitScript(PROBE);
  const closePops = async () => {
    for (let i = 0; i < 8; i++) {
      const c = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.offsetParent && /^(受け取る|閉じる|OK|(?:分|わ)かった！?|あとで)$/.test(y.textContent.trim())); if (x) { x.click(); return true; } return false; });
      if (!c) break; await page.waitForTimeout(250);
    }
    for (let i = 0; i < 6; i++) { const fx = page.locator('[data-player-rank-up-fx]').first(); if (!(await fx.count())) break; await fx.click({ force: true }).catch(() => {}); await page.waitForTimeout(400); }
  };
  const mark = (n) => page.evaluate((n) => { const P = window.__perf; if (P) (P.marks || (P.marks = [])).push({ n, t: performance.now() }); }, n).catch(() => {});
  // 結果の画面からトップへ(「トップへ」が無い結果は、左上の戻る)
  const toTop = async () => {
    const t = page.getByRole('button', { name: 'トップへ' });
    if (await t.count()) await t.first().click(); else await page.locator('[data-card-top="result"] button').first().click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
  };
  // PERF_SHOTS=<フォルダ>: 1回目の対戦・行き来で、カードの部屋・相手えらび・対戦・結果の止め絵を撮る(崩れていないかを見せる用)
  const SHOTS = process.env.PERF_SHOTS || '';
  const tag = `${VW}x${VH}`;
  const snap = async (name, i) => { if (!SHOTS || i !== 1) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOTS, `${tag}-${name}.png`) }).catch(() => {}); };
  const battles = [], loops = [];
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 120000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.locator('[data-home-card-battle]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(800); await closePops();
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
    await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const d0 = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_decks_v1')).decks[0]);
    shareRow = { owner_id: 'perf-breeder-1', user_name: '測る相手', icon: null, profile_frame: null, deck: { monsters: d0.monsters, cards: d0.cards }, tactics: {}, version: 1, active: true, battles: 3, deck_wins: 2, rents: 0, updated_at: new Date().toISOString() };
    battles.push(await measure(page, cdp, 'start'));
    console.log('はじめ', JSON.stringify({ ...battles[0], topImgs: undefined }));
    console.log('はじめに読んだ画像(大きい順):\n  ' + battles[0].topImgs.join('\n  '));

    // ① フリー対戦(ほかのブリーダーとオートで。AI どうし・×4)を続ける
    for (let i = 1; i <= N_BATTLES; i++) {
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      await snap('1-card-top', i);
      if (i === 1) await profStart(cdp);
      await mark('mode'); await page.locator('[data-card-cpu]').click();
      await page.getByRole('button', { name: 'わかった' }).click({ timeout: 1500 }).catch(() => {});
      await mark('foe'); await page.locator('[data-card-mode-assistant]').click();
      await mark('breederTab'); await page.locator('[data-card-foe-tab="breeder"]').click();
      await page.locator('[data-card-share-fight="perf-breeder-1"]').waitFor({ timeout: 15000 });
      await mark('deckPick'); await page.locator('[data-card-share-fight="perf-breeder-1"]').click({ timeout: 15000 });
      await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 8000 });
      await page.locator('[data-card-deck-pick-mode="auto"]').click();
      if (await page.locator('[data-card-deck-pick-quick="on"]').count()) await page.locator('[data-card-deck-pick-quick="on"]').click();
      await mark('vs+battle'); await page.locator('[data-card-deck-pick-go]').click();
      await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
      for (let k = 0; k < 4; k++) {
        const sp = await page.locator('[data-card-auto-speed-cycle]').getAttribute('data-card-auto-speed').catch(() => null);
        if (sp === null || sp === '4') { if (sp === null && (await page.locator('[data-card-auto-speed="4"]').count())) await page.locator('[data-card-auto-speed="4"]').click().catch(() => {}); break; }
        await page.locator('[data-card-auto-speed-cycle]').click().catch(() => {}); await page.waitForTimeout(100);
      }
      await page.waitForTimeout(SHOTS && i === 1 ? 4000 : 0); await snap('3-battle', i);
      // PERF_HOLD=1(試し): 対戦の画面の絵への参照をページが持ち続けたら、読み直しが消えるか
      if (process.env.PERF_HOLD) await page.evaluate(() => { const h = window.__hold || (window.__hold = new Map()); clearInterval(window.__holdT); window.__holdT = setInterval(() => { for (const im of document.querySelectorAll('[data-card-battle] img')) if (!h.has(im.src)) { const x = new Image(); x.src = im.src; h.set(im.src, x); } }, 200); });
      // PERF_FRAMES=1(調べもの): まんなかの欄の scrollHeight を読んだ回数と、コマの数を数える(1コマに何回測っているか)
      if (process.env.PERF_FRAMES && i === 1) {
        const fr = await page.evaluate(() => new Promise((res) => {
          const d = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
          let reads = 0, frames = 0, framesWithRead = 0, inFrame = 0, multi = 0;
          Object.defineProperty(Element.prototype, 'scrollHeight', { configurable: true, get() { if (this.hasAttribute && this.hasAttribute('data-card-stage')) { reads++; inFrame++; } return d.get.call(this); } });
          const tick = () => { frames++; if (inFrame) framesWithRead++; if (inFrame > 1) multi++; inFrame = 0; if (frames < 600) requestAnimationFrame(tick); else { Object.defineProperty(Element.prototype, 'scrollHeight', d); res({ reads, frames, framesWithRead, multi }); } };
          requestAnimationFrame(tick);
        }));
        console.log(`--- コマ ${fr.frames}・まんなかを測った回数 ${fr.reads}・測ったコマ ${fr.framesWithRead}・2回以上測ったコマ ${fr.multi}`);
      }
      // PERF_TRACE=1(調べもの): 対戦のさなか 8秒のトレースで、スタイルの計算の回数・要素数と、計算し直しの理由を数える
      if (process.env.PERF_TRACE && i === 1) {
        const events = [];
        cdp.on('Tracing.dataCollected', (e) => events.push(...e.value));
        const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
        await cdp.send('Tracing.start', { categories: 'devtools.timeline,blink.animations,disabled-by-default-devtools.timeline,cc,disabled-by-default-devtools.timeline.invalidationTracking', transferMode: 'ReportEvents' });
        await page.waitForTimeout(8000);
        await cdp.send('Tracing.end'); await done;
        const ult = events.filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X');
        const els = ult.map((e) => (e.args && e.args.elementCount) || 0);
        console.log(`--- スタイルの計算 ${ult.length}回・合計 ${Math.round(ult.reduce((s, e) => s + (e.dur || 0), 0) / 1000)}ms・要素 平均 ${Math.round(els.reduce((a, b) => a + b, 0) / (els.length || 1))}・最大 ${Math.max(0, ...els)}`);
        const why = {};
        for (const e of events) {
          if (!/Invalidation/.test(e.name)) continue;
          const d = (e.args && e.args.data) || {};
          const k = `${e.name} ${d.reason || d.changedClass || d.changedAttribute || d.changedId || d.changedPseudo || ''} <${d.nodeName || ''}>`.slice(0, 120);
          why[k] = (why[k] || 0) + 1;
        }
        for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${n}  ${k}`);
        // アニメが合成処理(GPU 側)に回せなかった理由(compositeFailed のビット・unsupportedProperties)
        const fail = {};
        for (const e of events) {
          if (e.name !== 'Animation') continue;
          const d = (e.args && e.args.data) || {};
          if (d.compositeFailed === undefined && !d.unsupportedProperties) continue;
          const k = `${d.name || d.id || '?'} failed=${d.compositeFailed} props=${(d.unsupportedProperties || []).join(',')}`;
          fail[k] = (fail[k] || 0) + 1;
        }
        // 絵の展開(decode)の回数と時間
        const dec = events.filter((e) => /Decode|ImageDecodeTask|Decode LazyPixelRef/.test(e.name) && e.ph === 'X');
        const byName = {};
        for (const e of dec) { const u = String(((e.args || {}).data || {}).url || (e.args || {}).url || '').replace(/^.*monster-hero\//, '').replace(/\?.*$/, ''); const k = `${e.name} ${u.split('/').slice(0, 2).join('/')}`; const o = byName[k] || (byName[k] = { n: 0, ms: 0 }); o.n++; o.ms += (e.dur || 0) / 1000; }
        console.log('--- 絵の展開(8秒)');
        for (const [k, o] of Object.entries(byName).sort((a, b) => b[1].ms - a[1].ms).slice(0, 12)) console.log(`  ${o.n}回 ${Math.round(o.ms)}ms  ${k}`);
        const paint = events.filter((e) => /^(Paint|RasterTask|Rasterize|Layerize|PrePaint|UpdateLayer|CompositeLayers|Commit)$/.test(e.name) && e.ph === 'X');
        const pn = {}; for (const e of paint) { const o = pn[e.name] || (pn[e.name] = { n: 0, ms: 0 }); o.n++; o.ms += (e.dur || 0) / 1000; }
        console.log('--- 描画(8秒) ' + Object.entries(pn).map(([k, o]) => `${k} ${o.n}回 ${Math.round(o.ms)}ms`).join(' / '));
        console.log('--- 合成に回せなかったアニメ');
        for (const [k, n] of Object.entries(fail).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}  ${k}`);
      }
      // PERF_ANIM=1: 対戦のさなかに動いているアニメ(CSS・Web Animations)を、名前と動かしている性質ごとに数える
      if (process.env.PERF_ANIM && i === 1) {
        await page.waitForTimeout(8000);
        const an = await page.evaluate(() => {
          const out = {};
          const props = (a) => { try { return [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))))].join(','); } catch (_) { return '?'; } };
          for (const a of document.getAnimations()) {
            if (a.playState !== 'running') continue;
            const t = a.effect && a.effect.target; const name = a.animationName || a.transitionProperty || 'waapi';
            const k = `${name} [${props(a)}] <${t ? t.tagName.toLowerCase() : '?'}>${t && t.closest('[data-card-mon]') ? ' 場' : ''}`;
            out[k] = (out[k] || 0) + 1;
          }
          const filt = [...document.querySelectorAll('[data-card-battle] *')].filter((e) => { const c = getComputedStyle(e); return c.filter !== 'none' || c.backdropFilter !== 'none' || c.mixBlendMode !== 'normal'; }).length;
          return { anims: Object.entries(out).sort((a, b) => b[1] - a[1]), filt };
        });
        console.log(`--- 対戦中のアニメ ${an.anims.reduce((s, x) => s + x[1], 0)}本・filter/blend の要素 ${an.filt}`);
        for (const [k, n] of an.anims) console.log(`  ${n}  ${k}`);
      }
      const t0 = Date.now();
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 240000 });
      const sec = Math.round((Date.now() - t0) / 1000);
      await mark('result');
      if (i === 1) await profStop(cdp, '対戦1回目(相手えらび〜結果)');
      await page.waitForTimeout(1500);
      await closePops();
      await snap('4-result', i);
      const r = { ...(await measure(page, cdp, `battle${i}`)), sec };
      battles.push(r);
      console.log(`対戦${i}(${sec}秒): layout ${r.layoutN}回 ${r.layoutMs}ms style ${r.styleMs}ms script ${r.scriptMs}ms task ${r.taskMs}ms heap ${r.heapMB}MB nodes ${r.nodes} dom ${r.domLive} listen ${r.listeners} interval ${r.intervals} raf ${r.raf} img ${r.resImgUrls}/${r.resImgs} ${r.resImgKB}KB long ${r.longN}件 ${r.longMs}ms max${r.longMax} loaf ${r.loafN}件 max${r.loafMax}`);
      await toTop();
    }

    // ② 画面の行き来: カードの部屋 → 対戦(相手えらび)→ 助手えらび → デッキえらび → 戻る → 助手と対戦を始めて投了 → 結果 → トップ → HOME → カードの部屋
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    loops.push(await measure(page, cdp, 'loop0'));
    for (let i = 1; i <= N_LOOPS; i++) {
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      if (i === 1) await profStart(cdp);
      await page.locator('[data-card-cpu]').click();
      await page.getByRole('button', { name: 'わかった' }).click({ timeout: 1500 }).catch(() => {});
      await page.locator('[data-card-mode-assistant]').click();
      await page.locator('[data-card-foe-tab="assistant"]').click();
      const foes = await page.locator('[data-card-foe]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-foe')));
      await page.locator(`[data-card-foe="${foes[i % foes.length]}"]`).click();
      await page.waitForTimeout(300);
      await snap('2-foe', i);
      await page.locator('[data-card-start]').click();
      await page.locator('[data-card-deck-pick-go]').click();
      await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(2500);
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: /^投了する/ }).last().click();
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(1200); await closePops();
      await toTop();
      // HOME へ出て、もう一度入る
      const back = page.locator('[data-card-top="top"]').getByRole('button', { name: /戻る|HOME|ホーム/ }).first();
      if (await back.count()) { await back.click(); await page.locator('[data-home-card-battle]').waitFor({ timeout: 20000 }); await page.waitForTimeout(600); await closePops(); await page.locator('[data-home-card-battle]').first().dispatchEvent('click'); }
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(600);
      if (i === 1) await profStop(cdp, '行き来1回目');
      const r = await measure(page, cdp, `loop${i}`);
      loops.push(r);
      console.log(`行き来${i}: layout ${r.layoutN}回 ${r.layoutMs}ms style ${r.styleMs}ms script ${r.scriptMs}ms task ${r.taskMs}ms heap ${r.heapMB}MB nodes ${r.nodes} dom ${r.domLive} listen ${r.listeners} interval ${r.intervals} raf ${r.raf} img ${r.resImgUrls}/${r.resImgs} ${r.resImgKB}KB long ${r.longN}件 ${r.longMs}ms max${r.longMax} loaf ${r.loafN}件 max${r.loafMax}`);
    }
  } catch (e) {
    console.log('止まった:', String(e).split('\n')[0]);
    await page.screenshot({ path: path.join(process.env.PERF_SHOT_DIR || '/tmp', 'card-perf-stop.png') }).catch(() => {});
  }
  if (process.env.PERF_NET) console.log('立ち絵を頼んだ所:\n' + Object.entries(netWho).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `  ${n}  ${k}`).join('\n'));
  const lines = [...summary('フリー対戦(オート×4)', battles.slice(1)), ...summary('画面の行き来', loops.slice(1))];
  console.log(lines.join('\n'));
  if (errors.length) console.log('実行時エラー:', [...new Set(errors)].slice(0, 5).join(' / '));
  if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify({ viewport: `${VW}x${VH}`, battles, loops, errors: [...new Set(errors)] }, null, 1)); }
  await browser.close(); server.close();
})();
