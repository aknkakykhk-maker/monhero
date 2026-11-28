#!/usr/bin/env node
// HOME の重さを測る(2026-11-28 開発部・台帳 r1126-104 追記4・追跡表 r1128-072)。
// ビート部の調べ(docs/progress/perf-2026-11-28/README.md)と同じ測り方: HOME に10秒いて、
// メインスレッドが1秒のうち何ミリ秒ふさがっているか(Chrome の TaskDuration)を、CPU を絞って数える。
//
//   node tools/speed/home-weight-measure.js                 既定: 裏クイックあり・CPU 4倍遅く・10秒・2回
//   node tools/speed/home-weight-measure.js --quick 0       裏クイックなし
//   node tools/speed/home-weight-measure.js --cpu 1 --runs 3 --sec 10
//   node tools/speed/home-weight-measure.js --profile 1     CPU の記録を取り、自分の時間の上位の関数を出す
//
// 出すもの(小さく): 1回ごとの ms/秒・React の描き直し(commit)の回数/秒・setInterval と rAF の呼ばれた回数(呼び出し元の上位)
// 先に node tools/build.js を通しておく。本物の Supabase へは送らない(通信は手元で止める)。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const CPU = Number(arg('cpu', 4)), RUNS = Number(arg('runs', 2)), SEC = Number(arg('sec', 10));
const QUICK = arg('quick', '1') !== '0', PROFILE = arg('profile', '0') !== '0', ANIMS = arg('anims', '0') !== '0';
const PORT = Number(arg('port', 8962));
const PAUSE = arg('pause', ''); // 名前がこれに当たる CSS アニメを止めて測る(何が重いかの切り分け用)
const CSS = arg('css', ''); // 試しに差し込む CSS(直す前に効きを確かめる用)
const AT = arg('at', ''); // 時計をこの時刻にずらす(例 2026-11-28T09:30:00+09:00。前の HOME と比べる用)
const SHOT = arg('shot', ''); // このフォルダへ、札の動きを同じ瞬間(0・0.4・0.8・1.2秒)で止めた絵を撮る(直す前と後の撮り比べ用)
const W = Number(arg('w', 390)), H = Number(arg('h', 844));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

const seed = (autoStart) => `(() => {
  if (sessionStorage.getItem('__hwSeeded')) return;
  sessionStorage.setItem('__hwSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); for (const d of ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell']) put('mh_quick_clears_' + d, 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: ${autoStart ? 'true' : 'false'} } });
  put('mh_gold', 1000);
})();`;

// タイマーと rAF の呼び出し元を数える・React の commit を数える(ページより先に仕込む)
const probe = () => {
  const counts = { interval: new Map(), timeout: new Map(), raf: new Map() };
  window.__hw = { counts, commits: 0, on: false };
  const where = () => {
    const st = (new Error().stack || '').split('\n').slice(3, 6).map((s) => s.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < ');
    return st.slice(0, 160);
  };
  const wrap = (kind, orig) => function (fn, ...rest) {
    if (typeof fn !== 'function') return orig.call(this, fn, ...rest);
    const site = where();
    const w = function (...a) { if (window.__hw.on) counts[kind].set(site, (counts[kind].get(site) || 0) + 1); return fn.apply(this, a); };
    return orig.call(this, w, ...rest);
  };
  window.setInterval = wrap('interval', window.setInterval);
  window.setTimeout = wrap('timeout', window.setTimeout);
  window.requestAnimationFrame = wrap('raf', window.requestAnimationFrame);
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, isDisabled: false, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    onCommitFiberRoot() { if (window.__hw.on) window.__hw.commits++; } };
};

const boot = async (browser, autoStart) => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.addInitScript(seed(autoStart));
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(quiet.oneTimeNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.addInitScript(probe);
  if (AT) await page.addInitScript((at) => { const off = Date.parse(at) - Date.now(); const D = Date; const now = () => D.now() + off;
    window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(now()); } static now() { return now(); } }; }, AT);
  await page.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 120000 });
  const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
  const closePopups = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]'));
    if (b) { b.click(); return true; }
    return false;
  });
  for (let i = 0; i < 160 && !(await home.isVisible().catch(() => false)); i++) {
    if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
    await closePopups();
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 8 && await closePopups(); i++) await page.waitForTimeout(300);
  return page;
};

const top = (map, n = 6) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

(async () => {
  const { chromium } = require('playwright');
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const rows = [];
  try {
    for (let r = 0; r < RUNS; r++) {
      const page = await boot(browser, QUICK);
      await page.waitForTimeout(6000); // 起動直後の山(先読み・絵の読み込み)を外す
      if (SHOT && r === 0) {
        fs.mkdirSync(SHOT, { recursive: true });
        for (const t of [0, 400, 800, 1200]) {
          await page.evaluate((ms) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }, t);
          const els = await page.$$('.mh-home-event-badge');
          for (let i = 0; i < els.length; i++) {
            const b = await els[i].boundingBox(); if (!b) continue;
            await page.screenshot({ path: path.join(SHOT, `badge${i}-${t}.png`), clip: { x: Math.max(0, b.x - 24), y: Math.max(0, b.y - 24), width: b.width + 48, height: b.height + 48 } });
          }
        }
        await page.screenshot({ path: path.join(SHOT, 'home.png') });
        await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
      }
      if (CSS) await page.addStyleTag({ content: CSS });
      if (PAUSE) await page.evaluate((src) => { const re = new RegExp(src); const stop = () => { for (const a of document.getAnimations()) if (re.test(a.animationName || '')) a.pause(); }; stop(); setInterval(stop, 1000); }, PAUSE);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.waitForTimeout(1500);
      if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
      const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      await page.evaluate(() => { window.__hw.on = true; });
      await page.waitForTimeout(SEC * 1000);
      await page.evaluate(() => { window.__hw.on = false; });
      const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((x) => [x.name, x.value]));
      const strip = await page.evaluate(() => { const el = document.querySelector('[data-quick-anywhere]'); return el ? `${el.getAttribute('data-quick-anywhere')} L${el.getAttribute('data-loops')} W${el.getAttribute('data-wave')}` : 'なし'; });
      const dur = m1.Timestamp - m0.Timestamp;
      const per = (k) => Math.round(((m1[k] - m0[k]) * 1000) / dur);
      const hw = await page.evaluate(() => ({ commits: window.__hw.commits, interval: [...window.__hw.counts.interval], timeout: [...window.__hw.counts.timeout], raf: [...window.__hw.counts.raf] }));
      const sum = (a) => a.reduce((s, [, n]) => s + n, 0);
      rows.push({ task: per('TaskDuration'), script: per('ScriptDuration'), layout: per('LayoutDuration'), style: per('RecalcStyleDuration'), commits: +(hw.commits / dur).toFixed(1), strip,
        interval: +(sum(hw.interval) / dur).toFixed(1), timeout: +(sum(hw.timeout) / dur).toFixed(1), raf: +(sum(hw.raf) / dur).toFixed(1) });
      console.log(`run${r + 1}: ${JSON.stringify(rows[rows.length - 1])}`);
      if (r === 0) {
        for (const k of ['interval', 'raf', 'timeout']) {
          console.log(`  ${k} の上位(10秒の回数):`);
          for (const [site, n] of top(new Map(hw[k]), 5)) console.log(`    ${n}  ${site}`);
        }
      }
      if (ANIMS && r === 0) {
        const list = await page.evaluate(() => {
          const m = new Map();
          for (const a of document.getAnimations()) {
            if (a.playState !== 'running') continue;
            const t = a.effect && a.effect.target; const name = a.animationName || a.transitionProperty || a.constructor.name;
            const props = a.effect && a.effect.getKeyframes ? [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))))].join(',') : '';
            const cls = t ? ((t.getAttribute && (t.getAttribute('class') || '')).split(/\s+/).filter((c) => /anim|home|mh-/.test(c)).slice(0, 2).join('.') || t.tagName) : '';
            const k = `${name} [${props}] ${cls}`; m.set(k, (m.get(k) || 0) + 1);
          }
          return [...m].sort((a, b) => b[1] - a[1]);
        });
        console.log(`  動いている CSS アニメ ${list.reduce((s, [, n]) => s + n, 0)} 本(種類 ${list.length}):`);
        for (const [k, n] of list.slice(0, 30)) console.log(`    ${n}  ${k}`);
      }
      if (PROFILE) {
        const { profile } = await cdp.send('Profiler.stop');
        const self = new Map(), total = profile.endTime - profile.startTime;
        const byId = new Map(profile.nodes.map((n) => [n.id, n]));
        const dt = profile.timeDeltas; const cnt = new Map();
        profile.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
        for (const [id, us] of cnt) { const n = byId.get(id); const f = n.callFrame; if (/^\((idle|program|garbage collector)\)$/.test(f.functionName)) continue; const key = `${f.functionName || '(無名)'} ${path.basename(f.url || '')}:${f.lineNumber + 1}`; self.set(key, (self.get(key) || 0) + us); }
        // 画面を測る呼び出し(elementsFromPoint・getBoundingClientRect)は、呼び出し元の関数ごとにも出す
        const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
        const callers = new Map();
        for (const [id, us] of cnt) { const n = byId.get(id); if (!/^(elementsFromPoint|getBoundingClientRect|elementFromPoint)$/.test(n.callFrame.functionName)) continue; let p = byId.get(parent.get(id)); const chain = []; while (p && chain.length < 3) { chain.push(`${p.callFrame.functionName || '(無名)'}:${p.callFrame.lineNumber + 1}`); p = byId.get(parent.get(p.id)); } const key = `${n.callFrame.functionName} < ${chain.join(' < ')}`; callers.set(key, (callers.get(key) || 0) + us); }
        if (callers.size) { console.log('  画面を測る呼び出しの呼び出し元(ms/秒):'); for (const [k, us] of top(callers, 6)) console.log(`    ${(us / 1000 / (total / 1e6)).toFixed(1)}  ${k}`); }
        console.log('  CPU の自分の時間の上位(ms/秒):');
        for (const [k, us] of top(self, 15)) console.log(`    ${(us / 1000 / (total / 1e6)).toFixed(1)}  ${k}`);
      }
      await page.close();
    }
    const med = (k) => { const a = rows.map((x) => x[k]).sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
    console.log(`まとめ(裏クイック${QUICK ? 'あり' : 'なし'}・CPU ${CPU}倍遅く・${W}x${H}・${SEC}秒×${RUNS}回): TaskDuration ${rows.map((x) => x.task).join(' / ')} ms/秒(中央 ${med('task')})・commit ${med('commits')}回/秒・rAF ${med('raf')}回/秒・interval ${med('interval')}回/秒`);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
