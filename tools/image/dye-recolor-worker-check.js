// 染め直した絵を「裏の作業(Worker)」で作る仕組みを、実際のブラウザで確かめる(2026-10-09)。
//
//   node tools/image/dye-recolor-worker-check.js
//
// 【なぜ要るか】
// 起動して初めてマスモン一覧を開くと、染色した子の数×部位の数だけ、1024px前後の絵を1画素ずつ染め直して
// PNGへ書き出す処理が画面と同じ所で走り、40体(半分が染色)で一覧が出るまで4秒・止まっていた合計3.4秒
// (ユーザー報告「ゲームを始めてマスモン一覧を押すと少し固まる」)。染め直しを Worker へ移し、絵は blob: のURLで渡す。
//
// 【見かた】
// ① 裏の作業で作った絵が、画面側で作った絵と1画素も違わない(縮小して作るモッチーは画面側のまま)
// ② 染色したマスモン40体のセーブで、起動して初めてマスモン一覧を開いても長く止まらない(止まった合計1.5秒未満・最長0.4秒未満)
// ③ 染め絵の控えの上限を超えるほど持っていても、表示中の絵が欠けない(blob: のURLを使用中に片づけない)
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});


const BASES = ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Mia', 'Pandora', 'Monol', 'Oboro', 'Plant', 'Zan', 'Eiki', 'KenshiMocchi', 'Mitarashi', 'Ark', 'Iblis', 'Snegurochka', 'Undine', 'Yaobikuni', 'Yggdrasil', 'MelWhip', 'Melody', 'Kuromy', 'Ghost', 'Spooky'];
const COLORS = ['red', 'orange', 'yellow', 'lime'];
const makeMasus = (n) => Array.from({ length: n }, (_, i) => ({ id: 'm' + i, baseId: BASES[i % BASES.length], name: 'テスト' + i, bondXp: 1000 + i, createdAt: i + 1,
  ...(i % 2 === 0 ? { colors: [COLORS[i % 4], COLORS[(i + 1) % 4], COLORS[(i + 2) % 4]] } : {}) }));

(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    // ① 同じ絵になるか
    {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => typeof getRecoloredImage === 'function' && typeof ALL_PLAYER_MONSTERS !== 'undefined', null, { timeout: 90000 });
      const rows = await page.evaluate(async () => {
        const px = async (url) => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return [c.width, c.height, x.getImageData(0, 0, c.width, c.height).data]; };
        const out = [];
        for (const [baseId, color, idx] of [['Mocchi', 'red', 0], ['Tiger', 'lime', 0], ['Ham', 'orange', 1], ['Kuromy', 'yellow', 0], ['Melody', 'red', 0], ['Eiki', 'lime', 2]]) {
          const src = ALL_PLAYER_MONSTERS[baseId].imgUrl;
          _dyeRecolorCache.clear(); _dyeRecolorWorkerBroken = false;
          const a = await getRecoloredImage(src, color, baseId, idx);
          _dyeRecolorCache.clear(); const keep = _dyeRecolorWorker; _dyeRecolorWorker = null; _dyeRecolorWorkerBroken = true;
          const b = await getRecoloredImage(src, color, baseId, idx);
          _dyeRecolorCache.clear(); _dyeRecolorWorker = keep; _dyeRecolorWorkerBroken = false;
          if (!a || !b) { out.push({ baseId, ok: false, why: `作れなかった worker=${!!a} 画面側=${!!b}` }); continue; }
          const [w1, h1, d1] = await px(a); const [w2, h2, d2] = await px(b);
          let diff = 0; if (w1 !== w2 || h1 !== h2) diff = -1; else for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) diff++;
          out.push({ baseId, ok: diff === 0, why: `${a.slice(0, 5)} ${w1}x${h1} / 画面側 ${w2}x${h2} 違う値 ${diff}個`, worker: a.startsWith('blob:') });
        }
        return out;
      });
      for (const r of rows) check(`① ${r.baseId}: 裏の作業で作った絵が画面側と同じ`, r.ok, r.why);
      check('① 縮小しない絵は、裏の作業(blob:)で作っている', rows.filter((r) => r.baseId !== 'Mocchi').every((r) => r.worker), JSON.stringify(rows.map((r) => [r.baseId, r.worker])));
      await page.close();
    }
    // ②③ 起動して初めてマスモン一覧を開く
    for (const [n, label] of [[40, '②'], [150, '③']]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((masus) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'はかる'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
        put('mh_masu_mons', masus);
        put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
        window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) { /* 測れないなら空 */ }
      }, makeMasus(n));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 });
      await page.getByText('TAP TO START').click();
      await page.waitForTimeout(2500);
      await page.mouse.click(195, 422);
      await page.waitForTimeout(2000);
      await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /受け取|閉じる|とじる|OK|はじめる|わかった|^次へ|あとで|見た/.test(x.innerText)); if (b) b.click(); }, 250); });
      await page.waitForFunction(() => document.querySelector('button.mh-home-facility.management') && !document.querySelector('[role=dialog]'), null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.locator('button.mh-home-facility.management').click();
      await page.getByText('マスモン一覧(バトル)').first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(600);
      const t0 = await page.evaluate(() => { window.__lt = []; return performance.now(); });
      await page.getByText('マスモン一覧(バトル)').first().click();
      const shown = await page.evaluate(async (t) => { while (!document.querySelector('[data-mh-screen] .grid button')) await new Promise((r) => setTimeout(r, 5)); return performance.now() - t; }, t0);
      // 下までスクロールして全員ぶんの絵を出し、作り終わるまで待つ
      const pics = await page.evaluate(async () => {
        const box = document.querySelector('[data-mh-screen] .grid')?.parentElement;
        for (let y = 0; y < 30; y++) { if (box) box.scrollTop += 400; await new Promise((r) => setTimeout(r, 150)); }
        await new Promise((r) => setTimeout(r, 4000));
        const imgs = [...document.querySelectorAll('[data-mh-screen] img')];
        const blob = imgs.filter((i) => i.src.startsWith('blob:'));
        return { blob: blob.length, broken: blob.filter((i) => i.complete && i.naturalWidth === 0).length };
      });
      const lt = await page.evaluate((t) => window.__lt.filter((x) => x[0] >= t - 5), t0);
      const total = Math.round(lt.reduce((a, x) => a + x[1], 0)); const max = Math.round(lt.reduce((a, x) => Math.max(a, x[1]), 0));
      if (label === '②') {
        check(`② 染色したマスモン${n}体: 一覧が1秒以内に出る`, shown < 1000, `${Math.round(shown)}ms`);
        check(`② 染色したマスモン${n}体: 開いてから止まった時間が短い(合計1.5秒未満・最長0.4秒未満。直す前は合計3.4秒・最長0.6秒)`, total < 1500 && max < 400, `合計${total}ms 最長${max}ms ${lt.length}件`);
      }
      check(`${label} ${n}体: 染め絵が裏の作業で作られ、1枚も欠けない`, pics.blob > 0 && pics.broken === 0, JSON.stringify(pics));
      await context.close();
    }
  } catch (e) { check('実行', false, e.message); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'OK: 染め直しは裏の作業で作られ、絵も同じ');
  process.exit(failed ? 1 : 0);
})();
