#!/usr/bin/env node
// 速さ部(ハヤテくん)の計測。本番と同じ作り(先に node tools/build.js)を手元で開き、iPhone に近い条件で測る。
//
//   node tools/speed/speed-measure.js                   既定: CPU 4倍遅く・回線「遅めの4G」(往復150ms・下り1.6Mbps)
//   node tools/speed/speed-measure.js --net wifi        回線を Wi-Fi 相当(往復20ms・下り30Mbps)にする
//   node tools/speed/speed-measure.js --cpu 1 --runs 3  CPU をそのまま・3回測って中央値
//   node tools/speed/speed-measure.js --only boot       はじめの読み込みだけ(boot / switch / card)
//   --root <フォルダ>   別の作業場所(git worktree)のゲームを測る。直す前と後を交互に測るときに使う
//   --json <ファイル>   結果を JSON で書き出す
//   --settle <秒>       HOME に着いてから何秒、届いた量を数え続けるか(既定3。裏の先読みを見るなら 90 など)
//
// 測るもの
//   ① はじめの読み込み: 最初に何かが描かれるまで(FCP)・load・タイトル(TAP TO START)が出るまで・HOME まで
//   ② 送られてきた量: 種類ごと(JS・CSS・画像・音・そのほか)の圧縮後の大きさと件数(GitHub Pages と同じく gzip で返す)
//   ③ HOME から各モードへ: ボタンを押してから、HOME が消えて次の画面が描かれるまで
//   ④ MFバトルカードの対戦中: 1コマの時間(平均・95%・最長・50ms 超の回数)と、50ms 超の重い処理(long task)の合計
//   ⑤ HOME で何もしない10秒: CPU を使った時間・rAF の回数・動いているタイマー(--only idle)
//   ⑥ 表示より大きすぎる画像(--only images のときだけ): 元の大きさと画面での最大の大きさ
//   モンヒロビートの演奏中は tools/playbot/rhythm-frame-perf.js で測る(同じ CPU 倍率を渡す)
//
// 本物の Supabase へは1件も送らない。手元(localhost)以外は名前を引けなくして、通信をすべて止める。
const http = require('http'), path = require('path'), fs = require('fs'), zlib = require('zlib');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const TOOLS = path.resolve(__dirname, '..');
const ROOT = path.resolve(arg('root', path.resolve(TOOLS, '..')));
const CPU = Number(arg('cpu', 4)), RUNS = Number(arg('runs', 1)), ONLY = arg('only', ''), NET = arg('net', 'slow4g');
const PORT = Number(arg('port', 8961));
const SETTLE = Number(arg('settle', 3)); // HOME に着いてから何秒、届いた量を数え続けるか
const NETS = {
  slow4g: { latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 },
  wifi: { latency: 20, downloadThroughput: 30 * 1024 * 1024 / 8, uploadThroughput: 15 * 1024 * 1024 / 8 },
  none: null,
};
const { chromium } = require(path.join(TOOLS, 'node_modules/playwright'));
const quiet = require(path.join(TOOLS, 'boot/quiet-boot-seed.js'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const GZIP = /^(text\/|application\/json|image\/svg)/;
const gzCache = new Map();
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600' };
    if (GZIP.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      const st = fs.statSync(file); const key = `${file}:${st.mtimeMs}`;
      if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(fs.readFileSync(file), { level: 6 }));
      const body = gzCache.get(key);
      res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length }); res.end(body); return;
    }
    res.writeHead(200, headers); fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

const seed = () => {
  if (sessionStorage.getItem('__speedSeeded')) return;
  sessionStorage.setItem('__speedSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', '計測ブリーダー'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
};

const median = (xs) => { const a = xs.filter(Number.isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
const kindOf = (type, url) => {
  if (/Script/.test(type) || /\.js(\?|$)/.test(url)) return 'JS';
  if (/Stylesheet/.test(type)) return 'CSS';
  if (/Image/.test(type)) return '画像';
  if (/Media/.test(type) || /\.(mp3|m4a|mp4)(\?|$)/.test(url)) return '音・動画';
  if (/Document/.test(type)) return 'HTML';
  return 'そのほか';
};

async function openPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
  // ★context.route は使わない(Playwright は route を使うとブラウザのキャッシュを切るので、同じファイルを2回取ったように見える)。
  //   外への通信は起動の引数(--host-resolver-rules)で名前を引けなくして止める。Supabase も届かない
  await context.addInitScript(seed);
  await context.addInitScript(quiet.quietBootSeed());
  await context.addInitScript(quiet.updateNoticeSeed());
  // 重い処理(50ms 超)を最初から数えておく
  await context.addInitScript(() => {
    window.__speedLong = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__speedLong.push([e.startTime, e.duration]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  });
  // 動いているタイマーを数える(止まらないタイマーを見つけるため)
  await context.addInitScript(() => {
    const live = new Map(); window.__speedTimers = live;
    const si = window.setInterval, ci = window.clearInterval;
    window.setInterval = function (fn, ms, ...rest) {
      const where = (new Error().stack || '').split('\n').slice(2, 3).join('').trim();
      const id = si.call(window, function () { const e = live.get(id); if (e) e.calls += 1; return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }, ms, ...rest);
      live.set(id, { ms, where, calls: 0 }); return id;
    };
    window.clearInterval = function (id) { live.delete(id); return ci.call(window, id); };
    let raf = 0; const r = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { raf += 1; return r.call(window, cb); };
    window.__speedRafCount = () => raf;
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
  if (NETS[NET]) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[NET] });
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const reqs = new Map(); const done = [];
  cdp.on('Network.responseReceived', (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type }));
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) done.push({ ...r, bytes: e.encodedDataLength, t: Date.now() }); });
  return { context, page, cdp, done };
}

const closeOverlays = async (page) => {
  for (let i = 0; i < 12; i++) {
    const hit = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(スキップ|閉じる|とじる|OK|受け取る|わかった！?|今は見ない|あとで|あとで読む|×|✕)$/.test((x.innerText || x.getAttribute('aria-label') || '').trim()) && (() => { for (let e = x; e; e = e.parentElement) { const st = getComputedStyle(e); if (st.position === 'fixed' && (Number(st.zIndex) || 0) >= 40) return true; } return false; })());
      if (b) b.click(); return !!b;
    }).catch(() => false);
    if (!hit) return; await page.waitForTimeout(400);
  }
};

async function measureBoot(browser) {
  const { context, page, done } = await openPage(browser);
  const t0 = Date.now();
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'commit', timeout: 120000 });
  await page.waitForFunction(() => document.body && /TAP TO START/.test(document.body.innerText), null, { timeout: 180000, polling: 100 });
  const titleMs = Date.now() - t0;
  await page.waitForLoadState('load', { timeout: 180000 }).catch(() => {});
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return { fcp: fcp ? fcp.startTime : null, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd };
  });
  const bootBytes = done.slice();
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 30000 });
  const t1 = Date.now();
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 60000 }).catch(() => {});
  await page.waitForSelector('.mh-home-scene', { timeout: 120000 });
  const homeMs = Date.now() - t1;
  await page.waitForTimeout(SETTLE * 1000);
  const homeBytes = done.slice();
  const long = await page.evaluate(() => window.__speedLong.reduce((a, [, d]) => a + d, 0));
  await context.close();
  return { titleMs, fcp: nav.fcp, dcl: nav.dcl, load: nav.load, homeMs, longMs: long, bootBytes, homeBytes };
}

const sumBytes = (list) => {
  const by = {};
  for (const r of list) { const k = kindOf(r.type, r.url); by[k] = by[k] || { bytes: 0, n: 0 }; by[k].bytes += r.bytes; by[k].n += 1; }
  return by;
};

// HOME から押して、HOME が消えたあと次の画面が描かれる(2回 rAF を回る)までの時間
const MODES = [
  { name: 'モンヒロバトル', sel: 'button[aria-label="モンヒロバトル"]' },
  { name: 'モンヒロビート', text: 'モンヒロビート' },
  { name: 'MFバトルカード', sel: '[data-home-card-battle]' },
  { name: 'マーケット', sel: 'button[aria-label="マーケット"]' },
  { name: 'プロフィール', sel: 'button[aria-label="プロフィールを開く"]' },
  { name: '設定', sel: 'button[aria-label="設定"]' },
];
async function toHome(page) {
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'commit', timeout: 120000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 180000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 60000 }).catch(() => {});
  await page.waitForSelector('.mh-home-scene', { timeout: 120000 });
  await page.waitForTimeout(2500); await closeOverlays(page); await page.waitForTimeout(1500);
}
async function measureSwitch(browser) {
  const out = {};
  const { context, page } = await openPage(browser);
  for (const m of MODES) {
    await toHome(page);
    const ms = await page.evaluate(({ sel, text }) => new Promise((resolve) => {
      const b = sel ? document.querySelector(sel) : [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === text);
      if (!b) { resolve(null); return; }
      const t0 = performance.now();
      b.click();
      const tick = () => {
        if (document.querySelector('.mh-home-scene') && performance.now() - t0 < 20000) { requestAnimationFrame(tick); return; }
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
      };
      requestAnimationFrame(tick);
    }), m).catch(() => null);
    out[m.name] = ms;
  }
  await context.close();
  return out;
}

// HOME で何もしない10秒: CPU の使った時間・rAF の回数・動いているタイマー
async function measureIdle(browser, seconds = 10) {
  const { context, page, cdp } = await openPage(browser);
  await toHome(page);
  await page.waitForTimeout(2000);
  await cdp.send('Performance.enable');
  const m = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
  const a = await m(); const raf0 = await page.evaluate(() => window.__speedRafCount());
  const calls0 = await page.evaluate(() => [...window.__speedTimers.entries()].map(([id, e]) => [id, e.calls]));
  await page.waitForTimeout(seconds * 1000);
  const b = await m(); const raf1 = await page.evaluate(() => window.__speedRafCount());
  const timers = await page.evaluate((c0) => { const base = new Map(c0); return [...window.__speedTimers.entries()].map(([id, e]) => ({ ms: e.ms, where: e.where, calls: e.calls - (base.get(id) || 0) })).filter((t) => t.calls > 0).sort((x, y) => y.calls - x.calls); }, calls0);
  // 動いている CSS アニメーション(名前ごとの数。画面の外・見えない物も数える)
  const anims = await page.evaluate(() => {
    const by = {};
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const el = a.effect && a.effect.target; const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      const name = a.animationName || a.constructor.name; const k = by[name] || (by[name] = { n: 0, hidden: 0, area: 0, sample: '' });
      k.n += 1; if (!r || !r.width || r.bottom < 0 || r.top > innerHeight) k.hidden += 1; else k.area += Math.round(r.width * r.height);
      if (!k.sample && el) k.sample = (el.className && String(el.className.baseVal ?? el.className)).slice(0, 80);
    }
    return Object.entries(by).sort((x, y) => y[1].area - x[1].area);
  });
  await context.close();
  return { anims, seconds, taskMs: (b.TaskDuration - a.TaskDuration) * 1000, scriptMs: (b.ScriptDuration - a.ScriptDuration) * 1000, layoutMs: ((b.LayoutDuration + b.RecalcStyleDuration) - (a.LayoutDuration + a.RecalcStyleDuration)) * 1000, rafPerSec: (raf1 - raf0) / seconds, timers };
}

// 表示より大きすぎる画像: HOME とモードの入口を回り、<img> と背景の絵について「元の大きさ」と「画面での最大の大きさ」を集める
async function measureImages(browser) {
  const { context, page } = await openPage(browser);
  const seen = new Map();
  const collect = async () => {
    const list = await page.evaluate(() => {
      const out = [];
      for (const img of document.images) {
        const r = img.getBoundingClientRect();
        if (!img.naturalWidth || !r.width) continue;
        out.push([img.currentSrc || img.src, img.naturalWidth, img.naturalHeight, r.width, r.height]);
      }
      return out;
    });
    for (const [src, nw, nh, w, h] of list) {
      const k = src.replace(/^http:\/\/localhost:\d+\/monster-hero\//, '').replace(/\?.*$/, '');
      const e = seen.get(k) || { nw, nh, w: 0, h: 0 };
      e.w = Math.max(e.w, w); e.h = Math.max(e.h, h); seen.set(k, e);
    }
  };
  await toHome(page); await collect();
  for (const m of MODES) {
    await toHome(page);
    await page.evaluate(({ sel, text }) => { const b = sel ? document.querySelector(sel) : [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === text); if (b) b.click(); }, m);
    await page.waitForTimeout(2500); await collect();
    // 下まで送りながら集める(マーケットなど長い画面)
    for (let i = 0; i < 8; i++) { await page.evaluate(() => document.querySelectorAll('*').forEach((el) => { if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop += el.clientHeight * 0.9; })); await page.waitForTimeout(500); await collect(); }
  }
  await context.close();
  const fs2 = require('fs');
  return [...seen.entries()].map(([k, e]) => {
    let bytes = 0; try { bytes = fs2.statSync(path.join(ROOT, 'monster-hero', k)).size; } catch (er) {}
    return { src: k, natural: `${e.nw}x${e.nh}`, shown: `${Math.round(e.w)}x${Math.round(e.h)}`, over: e.nw / Math.max(1, e.w * 3), bytes };
  }).sort((a, b) => b.bytes - a.bytes);
}

// MFバトルカード: CPU(助手)と対戦し、決めた時間のあいだの1コマの時間を集める
async function measureCard(browser, seconds = 25) {
  const { context, page } = await openPage(browser);
  await toHome(page);
  await page.locator('[data-home-card-battle]').click();
  await page.locator('[data-card-top]').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  if (await page.locator('[data-card-top="starter"]').count()) {
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 30000 }).catch(() => {});
  }
  // はじめては練習試合(チュートリアル)が始まる。「飛ばす」で抜けてトップへ
  for (let i = 0; i < 3 && !(await page.locator('[data-card-cpu]').count()); i++) {
    if (await page.locator('[data-card-quit]').count()) {
      await page.locator('[data-card-quit]').click();
      await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    const top = page.getByRole('button', { name: 'トップへ' });
    if (await top.count()) { await top.first().click().catch(() => {}); await page.waitForTimeout(800); }
    await closeOverlays(page);
  }
  if (process.env.SPEED_SHOT) await page.screenshot({ path: process.env.SPEED_SHOT });
  await page.locator('[data-card-cpu]').click();
  await page.locator('[data-card-mode-assistant]').click();
  await page.locator('[data-card-foe]').first().waitFor({ timeout: 20000 });
  await page.locator('[data-card-foe]').first().click();
  await page.locator('[data-card-start]').click();
  await page.locator('[data-card-battle]').waitFor({ timeout: 60000 });
  await page.evaluate(() => {
    window.__speedFrames = []; window.__speedLong = []; let last = performance.now();
    const f = (t) => { window.__speedFrames.push(t - last); last = t; window.__speedRaf = requestAnimationFrame(f); };
    window.__speedRaf = requestAnimationFrame(f);
  });
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
    if (mode === null) break;
    try {
      if (await page.locator('[data-card-big]').count()) { await page.waitForTimeout(300); continue; }
      if (mode === 'setup') await page.getByRole('button', { name: /始める$/ }).click({ timeout: 3000 });
      else if (mode === 'discard') { const n = await page.locator('[data-card-hand-card]').count(); for (let i = 0; i < n; i++) await page.locator(`[data-card-hand-card="${i}"]`).click({ timeout: 2000 }); await page.getByRole('button', { name: /捨てる$/ }).click({ timeout: 2000 }).catch(() => {}); }
      else if (mode === 'guard') await page.getByRole('button', { name: '守らない' }).click({ timeout: 3000 });
      else if (mode === 'attack') {
        const n = await page.locator('[data-card-hand-card]').count(); let used = false;
        for (let i = 0; i < n && !used; i++) {
          const c = page.locator(`[data-card-hand-card="${i}"]`);
          if (await c.isEnabled().catch(() => false)) { await c.click({ timeout: 2000 }); await page.waitForTimeout(200); const tgt = page.locator('[data-card-mon^="1-"].ring-emerald-300, [data-card-mon^="1-"][data-card-target]'); if (await tgt.count()) { await tgt.first().click({ timeout: 2000 }); used = true; } }
        }
        if (!used) await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click({ timeout: 3000 }).catch(() => {});
      } else if (mode === 'guts') await page.getByRole('button', { name: /ターン終了$/ }).click({ timeout: 3000 }).catch(() => {});
      else await page.waitForTimeout(200);
    } catch (e) { await page.waitForTimeout(200); }
    await page.waitForTimeout(250);
  }
  const r = await page.evaluate(() => { cancelAnimationFrame(window.__speedRaf); return { frames: window.__speedFrames.slice(1), long: window.__speedLong.reduce((a, [, d]) => a + d, 0) }; });
  await context.close();
  const f = r.frames.slice().sort((a, b) => a - b);
  const total = r.frames.reduce((a, b) => a + b, 0);
  return { frames: f.length, avg: total / f.length, p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1], over50: f.filter((x) => x > 50).length, seconds: total / 1000, longMs: r.long };
}

module.exports = { serve, openPage, toHome, closeOverlays, PORT };
if (require.main === module) (async () => {
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost'] });
  const res = { cpu: CPU, net: NET, root: ROOT, at: new Date().toISOString() };
  try {
    if (!ONLY || ONLY === 'boot') {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await measureBoot(browser));
      const pick = (k) => median(runs.map((r) => r[k]));
      res.boot = { titleMs: pick('titleMs'), fcp: pick('fcp'), dcl: pick('dcl'), load: pick('load'), homeMs: pick('homeMs'), longMs: pick('longMs') };
      res.bootAll = runs[0].homeBytes.map((r) => [r.url.replace(/^http:\/\/localhost:\d+\/monster-hero\//, ''), r.type, r.bytes]);
      res.bootBytes = sumBytes(runs[0].bootBytes); res.homeBytes = sumBytes(runs[0].homeBytes);
      res.bootTop = runs[0].bootBytes.sort((a, b) => b.bytes - a.bytes).slice(0, 15).map((r) => [r.url.replace(/^http:\/\/localhost:\d+\/monster-hero\//, '').replace(/\?.*$/, ''), r.bytes]);
      console.log(`① はじめの読み込み(CPU×${CPU}・${NET}・${RUNS}回の中央値)`);
      console.log(`  FCP ${Math.round(res.boot.fcp)}ms / DOMContentLoaded ${Math.round(res.boot.dcl)}ms / load ${Math.round(res.boot.load)}ms / タイトルが出るまで ${res.boot.titleMs}ms / タップ→HOME ${res.boot.homeMs}ms / 重い処理の合計 ${Math.round(res.boot.longMs)}ms`);
      console.log('② タイトルまでに届いた量(圧縮後)');
      for (const [k, v] of Object.entries(res.bootBytes)) console.log(`  ${k}: ${(v.bytes / 1024).toFixed(0)}KB(${v.n}件)`);
      console.log(`  HOME まで(+${SETTLE}秒)の合計: ` + Object.entries(res.homeBytes).map(([k, v]) => `${k} ${(v.bytes / 1024).toFixed(0)}KB/${v.n}件`).join('・'));
      console.log('  大きい順: ' + res.bootTop.slice(0, 8).map(([u, b]) => `${u} ${(b / 1024).toFixed(0)}KB`).join(' / '));
    }
    if (!ONLY || ONLY === 'switch') {
      res.switch = await measureSwitch(browser);
      console.log(`③ HOME → 各モード(CPU×${CPU})`);
      for (const [k, v] of Object.entries(res.switch)) console.log(`  ${k}: ${v == null ? '測れず' : Math.round(v) + 'ms'}`);
    }
    if (ONLY === 'images') {
      res.images = await measureImages(browser);
      console.log('⑥ 画像(大きい順)— 元の大きさ / 画面での最大(CSS px) / 3倍の画面に要る大きさの何倍か / ファイルの大きさ');
      for (const x of res.images.slice(0, 40)) console.log(`  ${(x.bytes / 1024).toFixed(0).padStart(5)}KB ${x.natural.padEnd(10)} ${x.shown.padEnd(9)} ×${x.over.toFixed(1)} ${x.src}`);
    }
    if (!ONLY || ONLY === 'idle') {
      res.idle = await measureIdle(browser);
      const d = res.idle;
      console.log(`⑤ HOME で何もしない${d.seconds}秒(CPU×${CPU}): 動いた時間 ${Math.round(d.taskMs)}ms(うち JS ${Math.round(d.scriptMs)}ms・配置と見た目 ${Math.round(d.layoutMs)}ms) / rAF ${d.rafPerSec.toFixed(1)}回/秒 / 動いたタイマー ${d.timers.length}本`);
      for (const t of d.timers.slice(0, 10)) console.log(`  ${t.ms}ms ごと・${t.calls}回 ${t.where.slice(0, 120)}`);
      console.log(`  動いている CSS アニメーション ${d.anims.reduce((a, [, v]) => a + v.n, 0)}本(名前・数・見えない数・面積px²・例):`);
      for (const [k, v] of d.anims.slice(0, 15)) console.log(`    ${k} ×${v.n}(見えない ${v.hidden})${v.area} ${v.sample}`);
    }
    if (!ONLY || ONLY === 'card') {
      res.card = await measureCard(browser);
      const c = res.card;
      console.log(`④ MFバトルカードの対戦中(CPU×${CPU}・${c.seconds.toFixed(1)}秒・${c.frames}コマ)`);
      console.log(`  1コマ 平均 ${c.avg.toFixed(1)}ms / 95% ${c.p95.toFixed(1)}ms / 最長 ${c.max.toFixed(0)}ms / 50ms 超 ${c.over50}回 / 重い処理の合計 ${Math.round(c.longMs)}ms`);
    }
  } catch (e) {
    console.log(`NG: 測れませんでした — ${e.message}`);
    process.exitCode = 1;
  } finally {
    if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(res, null, 2));
    await browser.close(); server.close();
  }
})();
