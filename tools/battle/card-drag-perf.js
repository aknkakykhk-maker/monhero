const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトルでカードを指で引きずっているあいだの「重さ」を、スマホ相当の条件で測る(判定はしない。数字を出すだけ)。
//
//   node tools/battle/card-drag-perf.js                  … いまの作業ツリーを測る
//   ROOT_DIR=<別のツリー> node tools/battle/card-drag-perf.js … 変更前のツリーと比べるとき
//   THROTTLE=4(CPUを何分の1にするか) RUNS=3(何回測って中央値を出すか)
//   IDLE=1 … 指を触れずに同じ時間だけ待って測る(引きずりと関係なく、ずっとかかっている分を知るため)
//
// 【なぜ要るか】(2026-09-26)
// 引きずっているあいだに画面全体を何度も描き直していて、iPhone で重さ・発熱の原因になっていた。
// 直すたびに「前より軽くなったか」を同じ条件で比べるための道具。
// タッチ・画素密度3・CPU減速で、手札 → 枠 → 手札と往復させ、次を出す:
//   ・コマの間隔(中央値・95%・最大)と、50ms を超えたコマの数(カクつき)
//   ・長い処理(50ms以上)の合計
//   ・React が画面を描き終えた回数(描き直しの多さ)
//   ・ブラウザが JavaScript・スタイル計算・レイアウトに使った時間(発熱の目安)
// ⚠️ Chromium での数字なので、実機の iPhone と同じにはならない。変更の前後を比べるために使う。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(TOOLS_DIR, '..');
const PORT = Number(process.env.PORT_NO || 8996);
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので測れません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      window.__mhCommits = 0;
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, isDisabled: false, renderers: new Map(),
        inject() { return 1; }, checkDCE() {}, onCommitFiberRoot() { window.__mhCommits += 1; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {} };
    });
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i += 1) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      const b = [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ'));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled);
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    // 勇者モン → 配置 → 供モン候補5体 → アシストカード、とたどってバトルまで進める。
    // ★押すものは「その画面にしか無いもの」で選ぶ。とりあえず押せるものを押すと、
    //   戻るボタンを踏んで難易度選択まで戻ってしまう
    await page.evaluate(() => { window.__pick = 0; window.__change = 1; });
    for (let i = 0; i < 40; i += 1) {
      const state = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      if (/WAVE 1\/10/.test(state)) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|はじめる|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力/.test(x.textContent) && x.textContent.trim() !== '詳細を見る');
        if (mons.length) { const m = mons[Math.min(window.__pick, mons.length - 1)]; window.__pick += 1; m.click(); return 'mon'; }
        const changes = live.filter((x) => x.textContent.trim() === '変更');
        if (changes.length) { const c = changes[Math.min(window.__change, changes.length - 1)]; window.__change += 1; c.click(); return 'change'; }
        return null;
      });
      if (!step) break;
      await page.waitForTimeout(1000);
    }
    const inBattle = await page.evaluate(() => /WAVE 1\/10/.test(document.body.innerText));
    check('タクティクスのバトルが立ち上がる', inBattle);
    if (!inBattle) { console.log(`\n${failed}件のNGがあります`); await browser.close(); server.close(); process.exit(1); }

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const metric = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); const m = {}; metrics.forEach((x) => { m[x.name] = x.value; }); return m; };
    const results = [];
    const runs = Number(process.env.RUNS || 3);
    for (let run = 0; run < runs; run += 1) {
      const idx = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].findIndex((c) => c.getAttribute('data-card-usable') === 'true'));
      if (idx < 0) { console.log('引きずれるカードがありません'); break; }
      const r = await page.evaluate((i) => { const b = document.querySelectorAll('[data-hand-card]')[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, idx);
      // 置き先の枠へは離さない(手札へ戻して離す)ので、何回測っても盤面が変わらない
      const t = await page.evaluate(() => { const b = document.querySelector('[data-slot-index="0"]').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
      await page.evaluate(() => {
        window.__frames = []; window.__lt = 0; window.__run = true; window.__c0 = window.__mhCommits;
        let last = performance.now();
        const tick = (now) => { window.__frames.push(now - last); last = now; if (window.__run) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        window.__obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => { window.__lt += e.duration; }));
        window.__obs.observe({ entryTypes: ['longtask'] });
      });
      const m0 = await metric();
      const wall0 = Date.now();
      const idle = process.env.IDLE === '1';
      if (!idle) await touch('touchStart', r.x, r.y);
      const N = 80;
      for (let k = 1; k <= N; k += 1) {
        const f = k <= N / 2 ? k / (N / 2) : (N - k) / (N / 2);
        if (!idle) await touch('touchMove', r.x + (t.x - r.x) * f + 12, r.y + (t.y - r.y) * f - 12);
        await page.waitForTimeout(16);
      }
      if (!idle) { await touch('touchMove', r.x, r.y); await touch('touchEnd', 0, 0); }
      // IDLE のときは、引きずったときと同じだけの時間を待つ(時間あたりで比べられるように)
      if (process.env.IDLE === '1' && process.env.IDLE_MS) await page.waitForTimeout(Math.max(0, Number(process.env.IDLE_MS) - (Date.now() - wall0)));
      await page.waitForTimeout(300);
      const m1 = await metric();
      const wall = Date.now() - wall0;
      const res = await page.evaluate(() => { window.__run = false; window.__obs.disconnect(); const f = window.__frames.slice(2).sort((a, b) => a - b);
        return { frames: f.length, p50: f[Math.floor(f.length * 0.5)], p95: f[Math.floor(f.length * 0.95)], max: f[f.length - 1], over50: f.filter((x) => x > 50).length,
          longtask: window.__lt, commits: window.__mhCommits - window.__c0 }; });
      res.wall = wall;
      res.script = (m1.ScriptDuration - m0.ScriptDuration) * 1000;
      res.style = (m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000;
      res.layout = (m1.LayoutDuration - m0.LayoutDuration) * 1000;
      results.push(res);
      await page.waitForTimeout(500);
    }
    const med = (k) => { const v = results.map((x) => x[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    const out = {};
    ['p50', 'p95', 'max', 'over50', 'longtask', 'commits', 'script', 'style', 'layout', 'wall'].forEach((k) => { out[k] = Math.round(med(k)); });
    console.log(`測った回数 ${results.length}(中央値)`);
    console.log(`  コマの間隔     中央値 ${out.p50}ms / 95% ${out.p95}ms / 最大 ${out.max}ms / 50ms超え ${out.over50}コマ`);
    console.log(`  長い処理の合計 ${out.longtask}ms`);
    console.log(`  描き直し       ${out.commits}回`);
    console.log(`  測った時間     ${out.wall}ms`);
    console.log(`  計算に使った時間 JavaScript ${out.script}ms / スタイル ${out.style}ms / レイアウト ${out.layout}ms`);
    console.log('RESULT ' + JSON.stringify(out));
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 160));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
