// 助手ライフの作り直し(2026-11-11 社長・docs/progress/assistant-peer/LIFE-UX-V3-PLAN.md)の新UIを、実際に開いて確かめる
//   node tools/assistant/assistant-life-ux-check.js            検査
//   node tools/assistant/assistant-life-ux-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/lifeux/step1/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る
//   STEP1 部屋は「その助手とできること」1列(新UIだけ)
//   ① 新UIの部屋: 上の6つのボタン(dock)は出ず、「できること」の行が縦と横で同じ並び
//   ② 仲良し度の道のり: Lv が部屋の題の Lv と同じ・「あと◯」がその段階の幅の中
//   ③ その場所ならではの得がある行は先頭(カード部屋の助手=対戦・ビートで券なしの助手=ビート)
//   ④ 行は押せる大きさ(高さ44px以上)・横幅からはみ出さない
//   ⑤ 旧UI(既定)は今までどおり: 縦は6つのボタン、「できること」の行は出ない
//   ⑥ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9265;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/lifeux/step1');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 顔ぶれ: みゅあ・きき=おやつ屋さん/ドラ・ソラシド・えるびん=カード部屋/ももすけ=ビート/あつ=家
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (v, v2) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript((on) => { window.__mhSupabaseStubbed = true; if (on) localStorage.setItem('mh_assistant_life_ui_v2', 'true'); }, v2);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const room = async (page, id) => {
    await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 5000 }); await page.waitForTimeout(800);
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-assistant-life-room-do]')];
      const road = document.querySelector('[data-assistant-life-bond-road]');
      const remain = document.querySelector('[data-assistant-life-bond-road-remain]');
      return { rows: rows.map(b => b.getAttribute('data-assistant-life-room-do')), small: rows.filter(b => b.getBoundingClientRect().height < 44).map(b => b.getAttribute('data-assistant-life-room-do')),
        over: rows.filter(b => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map(b => b.getAttribute('data-assistant-life-room-do')),
        dock: !!document.querySelector('[data-assistant-life-roomview-dock]'), road: road ? road.getAttribute('data-assistant-life-bond-road') : null, remain: remain ? Number(remain.getAttribute('data-assistant-life-bond-road-remain')) : null };
    });
  };
  const closeRoom = async (page) => { await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(400); };
  const order = {};
  for (const v of [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }]) {
    const T = `[${v.name}] `;
    const page = await open(v, true);
    // 仲良し度の段階の幅(Lv → 次の Lv までに要る点数)
    const span = await page.evaluate(() => Object.fromEntries(ASSISTANT_BOND_LEVELS.map((s, i, a) => [s.level, a[i + 1] ? a[i + 1].need - s.need : null])));
    for (const id of ['mua', 'dra', 'momosuke', 'atsu']) {
      const r = await room(page, id);
      (order[id] = order[id] || {})[v.id] = r.rows.join(',');
      check(`${T}① ${id}: 新UIの部屋は「できること」の行(${r.rows.length}行)・上の6つのボタンは出ない`, r.rows.length >= 5 && !r.dock, JSON.stringify(r.rows));
      check(`${T}④ ${id}: 行は高さ44px以上・横にはみ出さない`, r.small.length === 0 && r.over.length === 0, JSON.stringify({ small: r.small, over: r.over }));
      { const lvTitle = await page.evaluate(() => { const m = /仲良し度 Lv(\d+)/.exec(document.querySelector('[data-assistant-life-room-sheet]').innerText || ''); return m ? m[1] : null; });
        const w = span[Number(r.road)];
        check(`${T}② ${id}: 仲良し度の道のり Lv${r.road}・あと${r.remain}(部屋の題の Lv と同じ・その段階の幅の中)`, r.road != null && r.road === lvTitle && (w == null ? r.remain == null : (r.remain > 0 && r.remain <= w)), JSON.stringify({ road: r.road, lvTitle, remain: r.remain, span: w })); }
      if (id === 'dra') check(`${T}③ カード部屋のドラは「対戦する」が先頭`, r.rows[0] === 'card', r.rows[0]);
      if (id === 'momosuke') check(`${T}③ ビートのももすけは「ビート」が先頭(券なし)`, r.rows[0] === 'beat', r.rows[0]);
      if (SHOTS && (id === 'dra' || id === 'mua')) await page.screenshot({ path: path.join(shotDir, `check-${v.id}-${id}.png`) });
      await closeRoom(page);
    }
    await page.close();
    // ⑤ 旧UI(既定)は今までどおり
    const old = await open(v, false);
    const r = await room(old, 'mua');
    check(`${T}⑤ 旧UI(既定)は今までどおり: できることの行は出ない${v.id === 'tate' ? '・縦は6つのボタン' : ''}`, r.rows.length === 0 && r.road === null && (v.id === 'yoko' || r.dock), JSON.stringify(r));
    await old.close();
  }
  for (const id of Object.keys(order)) check(`① ${id}: 縦と横で同じ並び`, order[id].tate === order[id].yoko, JSON.stringify(order[id]));
  check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
