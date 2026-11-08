// 助手ライフの裏クイックの札(2026-11-08 社長「助手ライフ画面でも裏クイックほしい」)。中身は 60-app(バトル部)が props で渡す
//   node tools/assistant/assistant-life-quick-chip-check.js
//   ① 回っているとき「⚡ 裏クイック ◯周目」(loops をそのまま・カードと同じ)と「止める」・止めたあと・自動で始めるが切のとき「▶ 裏クイック」(印は data-assistant-life-quick-run=live|stopped・-start・-stop)・null なら出ない
//   ② 縦 390・縦 375・横 844・タブレット 820: 札が画面に収まり、題・時計・にぎわいの帯・ほかのボタンに重ならない・字が切れない
//   ③ 押すと止める/始めるが呼ばれる
//   見本の値は、ページの中で AssistantLifeQuickChip を包んで渡す(60-app の受け渡しが入ったあとも、この見張りは同じに動く)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9244;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
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
      for (const mode of ['live', 'start', 'none']) {
        await page.evaluate((mode) => {
          window.__q = { stop: 0, start: 0 };
          if (!window.__qOrig) window.__qOrig = window.AssistantLifeQuickChip;
          window.AssistantLifeQuickChip = (p) => window.__qOrig({ ...p, quickRun: mode === 'live' ? { live: true, loops: 12, canStart: false } : mode === 'start' ? { live: false, loops: 3, stopped: true, canStart: true } : null, onStop: () => { window.__q.stop++; }, onStart: () => { window.__q.start++; } });
          ASSISTANT_LIFE_STORE.set({ __checkQuick: Date.now() }); // 描き直させる(同じ中身の emit では描き直さない)
        }, mode);
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const el = document.querySelector('[data-assistant-life-quick]'); if (!el) return { none: true };
          const R = el.getBoundingClientRect(); const ng = [];
          if (R.left < -1 || R.top < -1 || R.right > innerWidth + 1 || R.bottom > innerHeight + 1) ng.push('画面からはみ出す');
          const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          for (const s of ['[data-assistant-life-title]', '[data-assistant-life-clock-box]', '[data-assistant-life-clock]', '[data-assistant-life-tier]', '[data-assistant-life-close]', '[data-assistant-life-find]']) for (const o of document.querySelectorAll(s)) if (o.getClientRects().length && hit(R, o.getBoundingClientRect())) ng.push(`${s} に重なる`);
          for (const t of el.querySelectorAll('span,button')) if (t.scrollWidth > t.clientWidth + 1) ng.push(`字が切れる: ${t.textContent}`);
          return { kind: el.getAttribute('data-assistant-life-quick'), text: el.textContent, ng };
        });
        if (process.env.QDEBUG) console.log(mode, JSON.stringify(r));
        if (mode === 'none') { check(`① ${tag}: 一度も回していないとき(null)は札を出さない`, !!r.none); continue; }
        check(`① ${tag}: ${mode === 'live' ? '回っているとき「⚡ 裏クイック 12周目」と「止める」' : '始められるとき「▶ 裏クイック」'}`, r.kind === mode && (mode === 'live' ? /⚡ 裏クイック 12周目/.test(r.text) && /止める/.test(r.text) : /▶ 裏クイック/.test(r.text)), r.text || 'なし');
        check(`② ${tag}(${mode}): 画面に収まり、題・時計・帯・ボタンに重ならない・字が切れない`, !!r.ng && r.ng.length === 0, (r.ng || []).join(' / '));
        await page.locator(mode === 'live' ? '[data-assistant-life-quick-stop]' : '[data-assistant-life-quick-start]').click().catch(() => {});
        const q = await page.evaluate(() => window.__q);
        check(`③ ${tag}(${mode}): 押すと${mode === 'live' ? '止める' : '始める'}が呼ばれる`, mode === 'live' ? q.stop === 1 : q.start === 1, JSON.stringify(q));
      }
      await page.close();
    }
    check('④ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
