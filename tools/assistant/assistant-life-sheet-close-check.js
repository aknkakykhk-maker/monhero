// 助手ライフの下から出るシートは、どれもはっきり分かる「閉じる」ボタンを持つ(2026-11-08 窓口・ナカヨシ8)。
//   node tools/assistant/assistant-life-sheet-close-check.js
//   ① 部品の中: シート(.mhl-sheet・下から出る rounded-t-3xl の箱・マスモンの .mhm-panel)を出す部品は、
//      どれも data-mhl-sheet-close の付いた「閉じる/とじる/やめる/もどる(上のシートへ戻る)」ボタンを持つ(暗い所を押すだけで閉じる形にしない)
//   ② 実際の画面(縦 390×844・縦 375×667・横 844×390・タブレット 820×1180): 部屋のシート・家具のシート・
//      マスモンのシート・今日あったことの一覧を開くと、閉じるボタンが画面の中に見えていて、押すと閉じる
//   ③ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9243;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ① 部品の中(ブラウザを使わない)
{
  const dir = path.join(root, 'monster-hero/src/parts');
  const files = fs.readdirSync(dir).filter(f => /^56-assistant-life.*\.jsx$/.test(f));
  const ng = [];
  let sheets = 0;
  for (const f of files) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    // 部品(function Xxx(...) {)ごとに切る
    const parts = src.split(/\n(?=function [A-Z])/);
    for (const body of parts) {
      const m = body.match(/^function ([A-Za-z0-9_]+)/);
      if (!m) continue;
      const hasSheet = /className="mhl-sheet"|rounded-t-3xl|className=\{`mhm-panel/.test(body);
      if (!hasSheet) continue;
      sheets++;
      const close = /<button [^<]*?data-mhl-sheet-close[^<]*?>\s*(閉じる|とじる|やめる|もどる)\s*<\/button>/.test(body.replace(/\n\s*/g, ' '));
      if (!close) ng.push(`${f} ${m[1]}`);
    }
  }
  check('① シートを出す部品は、どれも「閉じる」ボタン(data-mhl-sheet-close)を持つ', sheets >= 5 && ng.length === 0, ng.length ? ng.join(' / ') : `${sheets}部品`);
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので②は確かめられません'); process.exit(failed ? 1 : 0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, seed, toHome, waitFaces } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
    await page.addInitScript(() => {
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFurniture = true; clearInterval(t); } } catch {} }, 2);
    });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    return page;
  };
  // 閉じるボタンが画面の中に見えていて(ほかの物の下に隠れていない)、押すとシートが消えるか
  const closeOk = async (page, sheetSel, closeSel) => {
    const sheet = page.locator(sheetSel);
    if (!(await sheet.count())) return 'シートが開かない';
    const btn = page.locator(`${sheetSel} ${closeSel}`).first();
    if (!(await btn.count())) return '閉じるボタンが無い';
    await btn.scrollIntoViewIfNeeded().catch(() => {});
    const seen = await btn.evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 30) return `小さすぎる ${Math.round(r.width)}×${Math.round(r.height)}`;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return `画面の外 ${Math.round(r.top)}〜${Math.round(r.bottom)}`;
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!top || !(top === el || el.contains(top))) return `ほかの物の下 ${top ? top.className.toString().slice(0, 30) : ''}`;
      return '';
    });
    if (seen) return seen;
    await btn.click();
    await page.waitForTimeout(300);
    return (await sheet.count()) ? '押しても閉じない' : '';
  };
  try {
    for (const [w, h, tag] of [[390, 844, '縦 390'], [375, 667, '縦 375'], [844, 390, '横 844'], [820, 1180, 'タブレット 820']]) {
      const page = await open(w, h);
      const room = async () => { await page.locator('[data-assistant-life-room="atsu"]').click(); await page.waitForTimeout(300); };
      await room();
      const rs = await closeOk(page, '[data-assistant-life-room-sheet]', '[data-assistant-life-room-close]');
      check(`② ${tag}: 部屋のシートの「閉じる」が見えて、押すと閉じる`, rs === '', rs);
      await room();
      await page.locator('[data-assistant-life-room-act="furn"]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
      const furn = await closeOk(page, '[data-assistant-life-furn-sheet]', '[data-assistant-life-furn-close]');
      check(`② ${tag}: 家具のシートの「閉じる」が見えて、押すと閉じる`, furn === '', furn);
      if (await page.locator('[data-assistant-life-room-sheet]').count()) {
        await page.locator('[data-assistant-life-room-masmon]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
        const mm = await closeOk(page, '[data-assistant-masmon-sheet]', '[data-assistant-masmon-close]');
        check(`② ${tag}: マスモンのシートの「閉じる」が見えて、押すと閉じる`, mm === '', mm);
        await page.locator('[data-assistant-life-room-close]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(250);
      }
      await page.locator('[data-assistant-life-board]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300);
      const board = await closeOk(page, '[data-assistant-life-diary]', '[data-assistant-life-diary-close]');
      check(`② ${tag}: 今日あったことの一覧の「閉じる」が見えて、押すと閉じる`, board === '', board);
      await page.close();
    }
    check('③ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
