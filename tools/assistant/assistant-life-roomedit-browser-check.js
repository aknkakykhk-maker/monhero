// 助手の部屋の模様替え(2026-11-11 社長・56-assistant-life-roomedit.jsx)を、実際に開いて確かめる。公開の印 assistantLifeRoomEdit はページの中でだけ立てる
//   node tools/assistant/assistant-life-roomedit-browser-check.js            検査
//   node tools/assistant/assistant-life-roomedit-browser-check.js --shots    止め絵(docs/progress/assistant-life/room-layout/real-*.png)
//   ① 印がオフ: 模様替えのボタンが出ない・新しいキーを書かない
//   ② 印がオン: 今の置き方(天井・壁・床)が一度だけ写る(印 mh_assistant_life_room_layout_migrated_v1)。今のキー mh_assistant_life_room_v1 は変わらない
//   ③ 模様替えを開く → 家具を指でつまんで動かすと位置が変わり、保存される。大きさ・向き・色・前後・しまう・押し入れから出す
//   ④ ◯◯におまかせ: 苦手な家具はしまい、好きな家具から置く。ひとことが出る
//   ⑤ 縦 390×844・375×667 / 横 844×390・667×375 で、道具の段と家具が画面の中・ページのエラーなし
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9263;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-life/room-layout');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SIZES = [
  { id: 't390', name: '縦 390×844', w: 390, h: 844 }, { id: 't375', name: '縦 375×667', w: 375, h: 667 },
  { id: 'y844', name: '横 844×390', w: 844, h: 390, land: true }, { id: 'y667', name: '横 667×375', w: 667, h: 375, land: true },
];
const MIX = { groups: [{ ids: ['erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }], solo: { mua: { doing: 'idle', place: 'home' }, atsu: { doing: 'idle', place: 'home' }, kiki: { doing: 'read', place: 'library' }, dra: { doing: 'sleep', place: 'home' }, momosuke: { doing: 'practice', place: 'studio' }, kyuko: { doing: 'read', place: 'library' } } };
const ALL = ['sofa', 'bear', 'plant', 'record', 'nyacushion', 'starpic', 'trophy', 'bookshelf', 'heartmirror', 'lantern', 'mirrorball', 'windbell'];
// みゅあ: 今の置き方は 天井=ミラーボール・壁=ハートの鏡・床=くま、ほかは押し入れ(12種類ぜんぶ贈ってある)
const ROOM = { mua: { put: { ceil: 'mirrorball', wall: 'heartmirror', floor: 'bear' }, kept: ALL.filter(k => !['mirrorball', 'heartmirror', 'bear'].includes(k)), got: Object.fromEntries(ALL.map(k => [k, '2026-11-08'])) } };

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
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (v, on) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript(({ on }) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFurniture = true; RELEASE_FLAGS.assistantLifeRoomEdit = !!on; clearInterval(t); } } catch {} }, 2); }, { on });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate(async ({ m, room }) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo } });
      await ASSISTANT_LIFE_GIFT_STORE.load(); ASSISTANT_LIFE_GIFT_STORE.set({ room }); await storeSet('mh_assistant_life_room_v1', room, false); }, { m: MIX, room: ROOM });
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(500);
    return page;
  };
  const shot = async (page, name) => { if (SHOTS && /^(t390|y844)-/.test(name)) await page.screenshot({ path: path.join(shotDir, `real-${name}.png`) }); };
  const layoutOf = (page) => page.evaluate(async () => ({ lay: await storeGet('mh_assistant_life_room_layout_v1', null, false), flag: await storeGet('mh_assistant_life_room_layout_migrated_v1', null, false), room: await storeGet('mh_assistant_life_room_v1', null, false) }));
  const inside = (page) => page.evaluate(() => { const ng = []; const ed = document.querySelector('[data-assistant-life-layout-editor]'); if (!ed) return ['模様替えの画面が無い'];
    for (const b of ed.querySelectorAll('[data-assistant-life-layout-panel] button')) { const r = b.getBoundingClientRect(); if (r.width && (r.bottom > innerHeight + 1 || r.top < -1)) ng.push(`道具が画面の外: ${b.textContent || b.getAttribute('aria-label')}`); }
    const sc = ed.querySelector('[data-assistant-life-roomview]').getBoundingClientRect();
    for (const h of ed.querySelectorAll('[data-assistant-life-layout-handle]')) { const r = h.getBoundingClientRect(); const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; if (cx < sc.left || cx > sc.right || cy < sc.top || cy > sc.bottom) ng.push(`家具が部屋の外: ${h.getAttribute('data-assistant-life-layout-handle')}`); }
    return ng; });

  // ① 印がオフ
  { const v = SIZES[0], page = await open(v, false);
    await page.locator('[data-assistant-life-room="mua"]').click({ timeout: 5000 }); await page.waitForTimeout(800);
    await page.locator('[data-assistant-life-roomview-act="furn"]').click(); await page.waitForTimeout(400);
    const n = await page.locator('[data-assistant-life-furn-layout]').count(); const s = await layoutOf(page);
    check('印がオフ: 模様替えのボタンが出ない・新しいキーを書かない', n === 0 && s.lay == null && s.flag == null, JSON.stringify({ n, lay: s.lay, flag: s.flag }));
    await page.close(); }

  for (const v of SIZES) {
    const T = `[${v.name}] `, page = await open(v, true);
    await page.waitForTimeout(400);
    await shot(page, `${v.id}-house`);
    await page.locator('[data-assistant-life-room="mua"]').click({ timeout: 5000 }); await page.waitForTimeout(900);
    const s0 = await layoutOf(page);
    const keys0 = ((s0.lay && s0.lay.mua && s0.lay.mua.items) || []).map(it => it.k).sort().join(',');
    check(`${T}今の置き方が一度だけ写る・今のキーはそのまま`, keys0 === 'bear,heartmirror,mirrorball' && s0.flag === true && JSON.stringify(s0.room) === JSON.stringify(ROOM), `${keys0} flag=${s0.flag}`);
    await shot(page, `${v.id}-room-before`);
    // 模様替えを開く(縦は札の段の「🪑 家具」、横は右の欄の家具のボタン)
    await page.locator(v.land ? '[data-assistant-life-room-act="furn"], [data-assistant-life-do="furn"]' : '[data-assistant-life-roomview-act="furn"]').first().click(); await page.waitForTimeout(400);
    await page.locator('[data-assistant-life-furn-layout]').click(); await page.waitForTimeout(500);
    check(`${T}模様替えの画面が開く・道具と家具が画面の中`, (await inside(page)).length === 0, (await inside(page)).slice(0, 3).join(' / '));
    // 指でつまんで動かす(くまを右下へ)
    const h = page.locator('[data-assistant-life-layout-handle="bear"]'); const b = await h.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 90, b.y + b.height / 2 + 30, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
    const b2 = await h.boundingBox(); const s1 = await layoutOf(page); const bear0 = s0.lay.mua.items.find(it => it.k === 'bear'), bear1 = s1.lay.mua.items.find(it => it.k === 'bear');
    check(`${T}つまんで動かすと位置が変わり、保存される`, Math.abs(b2.x - b.x - 90) < 4 && bear1.x > bear0.x + 0.05, `画面 ${Math.round(b2.x - b.x)}px / 保存 x ${bear0.x}→${bear1.x.toFixed(2)}`);
    // 大きさ・向き・回す・色・助手の前へ
    for (const k of ['big', 'big', 'flip', 'rotr', 'layer']) { await page.locator(`[data-assistant-life-layout-tool="${k}"]`).click(); await page.waitForTimeout(60); }
    await page.locator('[data-assistant-life-layout-tool="color"]').click();
    const slide = (key, val) => page.evaluate(({ key, val }) => { const el = document.querySelector(`[data-assistant-life-layout-color="${key}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(val)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); }, { key, val });
    await slide('h', 270); await slide('l', 1.2); await slide('g', 1.5); await page.waitForTimeout(150);
    await shot(page, `${v.id}-color`);
    const s2 = await layoutOf(page); const bear2 = s2.lay.mua.items.find(it => it.k === 'bear');
    check(`${T}大きさ・向き・回す・色・助手の前へ が保存される`, Math.abs(bear2.s - 1.3) < 0.01 && bear2.f === true && bear2.r === 15 && bear2.h === 270 && bear2.l === 1.2 && bear2.g === 1.5 && bear2.a === true, JSON.stringify(bear2));
    check(`${T}色えらびの帯と道具が画面の中`, (await inside(page)).length === 0, (await inside(page)).slice(0, 3).join(' / '));
    await page.locator('[data-assistant-life-layout-tool="colorclose"]').click();
    // 指2本のピンチで大きさ(くまを選んだまま、部屋の上で指を広げる)
    { const cdp = await page.context().newCDPSession(page); const sc = await page.locator('[data-assistant-life-layout-editor] [data-assistant-life-roomview]').boundingBox();
      const cx = sc.x + sc.width / 2, cy = sc.y + sc.height * 0.45; const pt = (d) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt(40)[0]] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(40) });
      for (const d of [48, 56, 60]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(d) });
      await page.waitForTimeout(120); await shot(page, `${v.id}-pinch`);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200);
      const sp = await layoutOf(page); const bp = sp.lay.mua.items.find(it => it.k === 'bear');
      check(`${T}指2本のピンチで大きくなり、保存される`, Math.abs(bp.s - 1.95) < 0.06, `s 1.3→${bp.s}`); }
    // ピンチの2本目の指がよその家具(鏡)の札に乗っても、選んでいるくまのまま・鏡は動かない(2026-11-11 ミハリ最終確認 1)
    { const cdp = await page.context().newCDPSession(page); const bb = await page.locator('[data-assistant-life-layout-handle="bear"]').boundingBox(), mb = await page.locator('[data-assistant-life-layout-handle="heartmirror"]').boundingBox();
      const before = await layoutOf(page); const m0 = before.lay.mua.items.find(it => it.k === 'heartmirror'), b0 = before.lay.mua.items.find(it => it.k === 'bear');
      const a = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 1 }, m = (dx) => ({ x: mb.x + mb.width / 2 + dx, y: mb.y + mb.height / 2, id: 2 });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a, m(0)] });
      for (const dx of [-6, -12, -18]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a, m(dx)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200);
      const after = await layoutOf(page); const m1 = after.lay.mua.items.find(it => it.k === 'heartmirror'), b1 = after.lay.mua.items.find(it => it.k === 'bear');
      const selNow = await page.locator('[data-assistant-life-layout-handle="bear"]').getAttribute('aria-pressed');
      check(`${T}ピンチの2本目がよその家具に乗っても、選択は移らず・その家具は動かず・大きさが変わる`, selNow === 'true' && m1.x === m0.x && m1.y === m0.y && b1.s !== b0.s, `選択=${selNow} 鏡 ${m0.x}→${m1.x} くま s ${b0.s}→${b1.s}`); }
    // 押し入れから出す → しまう
    await page.locator('[data-assistant-life-layout-chip="sofa:kept"]').click(); await page.waitForTimeout(150);
    const s3 = await layoutOf(page); const hasSofa = s3.lay.mua.items.some(it => it.k === 'sofa');
    await shot(page, `${v.id}-edit`);
    await page.locator('[data-assistant-life-layout-tool="keep"]').click(); await page.waitForTimeout(150);
    const s4 = await layoutOf(page);
    check(`${T}押し入れから出す・しまう`, hasSofa && !s4.lay.mua.items.some(it => it.k === 'sofa'));
    // おまかせ
    await page.locator('[data-assistant-life-layout-omakase]').click(); await page.waitForTimeout(400);
    const s5 = await layoutOf(page); const ks = s5.lay.mua.items.map(it => it.k);
    const line = await page.locator('[data-assistant-life-layout-line]').count();
    check(`${T}みゅあにおまかせ: 苦手(本棚)はしまう・11個置く・主役はくま・ひとこと`, !ks.includes('bookshelf') && ks.length === 11 && ks[0] === 'bear' && line > 0, `${ks.length}個 ${ks.slice(0, 3).join(',')} ひとこと=${line}`);
    check(`${T}おまかせのあとも道具と家具が画面の中`, (await inside(page)).length === 0, (await inside(page)).slice(0, 3).join(' / '));
    await shot(page, `${v.id}-omakase`);
    // もとに戻す → 開いたときの並び
    await page.locator('[data-assistant-life-layout-undo]').click(); await page.waitForTimeout(200);
    const s6 = await layoutOf(page);
    check(`${T}もとに戻す: 開いたときの並びへ`, s6.lay.mua.items.map(it => it.k).sort().join(',') === 'bear,heartmirror,mirrorball' && s6.lay.mua.items.find(it => it.k === 'bear').x === bear0.x);
    // もう一度おまかせして閉じる → ふだんの部屋と家の小さな部屋に同じ並びが出る
    await page.locator('[data-assistant-life-layout-omakase]').click(); await page.waitForTimeout(200);
    await page.locator('[data-assistant-life-layout-done]').click(); await page.waitForTimeout(500);
    const seen = await page.locator('[data-assistant-life-roomview="mua"] [data-assistant-life-layout-item]').count();
    check(`${T}できた → ふだんの大きな部屋に11個`, seen === 11, `${seen}個`);
    await shot(page, `${v.id}-room-after`);
    // 家具のシート(新しい置き方): 「入れかえる」は無く、しまう → 押し入れ、置く → 部屋へ。模様替えを開かなくても出し入れできる
    await page.locator(v.land ? '[data-assistant-life-room-act="furn"], [data-assistant-life-do="furn"]' : '[data-assistant-life-roomview-act="furn"]').first().click(); await page.waitForTimeout(400);
    const swapN = await page.locator('[data-assistant-life-furn-sheet] button', { hasText: '入れかえる' }).count();
    await page.locator('[data-assistant-life-furn-keep="bear"]').click(); await page.waitForTimeout(250);
    const sA = await layoutOf(page); const keptBear = !sA.lay.mua.items.some(it => it.k === 'bear');
    await page.locator('[data-assistant-life-furn-put="bear"]').click(); await page.waitForTimeout(250);
    const sB = await layoutOf(page); const putBear = sB.lay.mua.items.some(it => it.k === 'bear');
    await page.locator('[data-assistant-life-furn-put="bookshelf"]').click(); await page.waitForTimeout(250);
    const sC = await layoutOf(page);
    check(`${T}家具のシート: 「入れかえる」が無い・しまう/置くで並びが変わる・12個ぜんぶ置ける`, swapN === 0 && keptBear && putBear && sC.lay.mua.items.length === 12, `入れかえる=${swapN} しまう=${keptBear} 置く=${putBear} ${sC.lay.mua.items.length}個`);
    await page.locator('[data-assistant-life-furn-close]').click(); await page.waitForTimeout(300);
    // 家の一覧の小さな部屋: 同じ並びが部屋の中に出る・顔や吹き出しより後ろ(z-index 0)・押せない
    await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(500);
    const mini = await page.evaluate(() => { const els = [...document.querySelectorAll('[data-assistant-life-room-furn^="mua:layout:"]')]; const room = els[0] && els[0].parentElement.getBoundingClientRect();
      return { n: els.length, z: els.every(e => getComputedStyle(e).zIndex === '0' && getComputedStyle(e).pointerEvents === 'none'), inside: els.every(e => { const r = e.getBoundingClientRect(); const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2; return cx >= room.left && cx <= room.right && cy >= room.top && cy <= room.bottom; }) }; });
    check(`${T}家の一覧の小さな部屋に同じ並び(12個・部屋の中・顔や吹き出しの後ろ)`, mini.n === 12 && mini.z && mini.inside, JSON.stringify(mini));
    const s7 = await layoutOf(page);
    check(`${T}今のキー mh_assistant_life_room_v1 は最後まで変わらない`, JSON.stringify(s7.room) === JSON.stringify(ROOM));
    await page.close();
  }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\nNG: ${failed} 件` : '\nOK: 模様替えの確かめが通りました');
  process.exit(failed ? 1 : 0);
})();
