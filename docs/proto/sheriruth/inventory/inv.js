const path = require('path');
const { chromium } = require('/home/user/monhero/tools/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith('http://localhost:8899/')) return r.continue(); return r.abort(); });
  await page.goto('http://localhost:8899/monster-hero/index.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => typeof RHYTHM_CANVAS_RENDERER !== 'undefined' && typeof rhythmNoteCanvasGeometry === 'function', null, { timeout: 60000 });
  const info = await page.evaluate(() => {
    document.body.innerHTML = '<canvas id="c" style="position:fixed;left:0;top:0"></canvas>';
    document.body.style.background = '#0b1020';
    const c = document.getElementById('c');
    RHYTHM_CANVAS_RENDERER.attach(c);
    const rect = { width: 390, height: 600 };
    RHYTHM_CANVAS_RENDERER.begin(rect, { dpr: 2, effect: 'FULL' });
    const items = [
      ['TAP', { type: 'TAP', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2 }, {}],
      ['HOLD', { type: 'HOLD', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2, endTimeMs: 1000 }, {}],
      ['SLIDE', { type: 'SLIDE', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2 }, {}],
      ['FLICK', { type: 'FLICK', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2 }, {}],
      ['FLICK_L', { type: 'FLICK', flickDir: 'left', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2 }, {}],
      ['FLICK_R', { type: 'FLICK', flickDir: 'right', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2 }, {}],
      ['MONSTER', { type: 'TAP', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2, monsterSlot: 1 }, { monster: true }],
      ['WIDE', { type: 'TAP', timeMs: 0, lane: 4, subLane: 6, subLaneWidth: 4 }, { wide: true }],
      ['SKY_gold', { type: 'TAP', timeMs: 0, lane: 4, subLane: 8, subLaneWidth: 2, skyHeight: 0.3 }, { sky: true }],
    ];
    window.__items = items;
    window.__draw = (i, skyStyle) => {
      const [name, note, o] = items[i];
      try { localStorage.setItem('mh_sky_tap_style_proto', skyStyle || 'gold'); } catch (e) {}
      RHYTHM_CANVAS_RENDERER.begin(rect, { dpr: 2, effect: 'FULL' });
      const geo = rhythmNoteCanvasGeometry(note, 480, 4, rect, 20);
      if (o.sky) geo.skyShadow = { cx: geo.head.cx, cy: geo.head.cy + 70, w: 40, h: 10 };
      RHYTHM_CANVAS_RENDERER.drawNote(note, geo, { ...o, depthScale: 1 });
      return { name, cx: geo.head.cx, cy: geo.head.cy, w: geo.head.w };
    };
    const out = items.map((x) => x[0]);
    return { out, colors: JSON.parse(JSON.stringify(RHYTHM_NOTE_COLORS)), judg: RHYTHM_JUDGMENT_COLORS, rainbow: RHYTHM_JUDGMENT_RAINBOW };
  });
  for (let i = 0; i < info.out.length; i++) {
    const r = await page.evaluate((k) => window.__draw(k, 'gold'), i);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(process.argv[2], `n${i}.png`), clip: { x: Math.max(0, Math.round(r.cx - 100)), y: 400, width: 200, height: 150 } });
    info.out[i] = r;
  }
  require('fs').writeFileSync(path.join(process.argv[2], 'info.json'), JSON.stringify(info, null, 1));
  console.log(JSON.stringify(info.out));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
