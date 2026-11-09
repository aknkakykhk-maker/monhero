// 助手ライフ「📋 みんなの居場所」の地図(案A・2026-11-08 社長「推奨でいいけどもっと矛盾のない作りとわかりやすく」)を、実際に開いて確かめる。
//   node tools/assistant/assistant-life-map-check.js            検査
//   node tools/assistant/assistant-life-map-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/shots/lifemap/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る
//   ① 地図の場所は11か所それぞれ1つずつ。施設と結びつく場所は HOME と同じ札(同じ class)
//   ② HOME の札と地図の札が同じ位置・同じ大きさ(1対1。HOME の画面の中での位置で ±2px)
//   ③ HOME の札の下の顔と、地図の全身が同じ場所(町だけの場所の人は HOME では「助手ライフ」の下)
//      家の札のシートには、HOME の「助手ライフ」の下の顔と同じ顔ぶれが並ぶ
//   ④ 居場所の言い方: 家の出かけ札・地図のシート・今日あったことが同じ場所の名前(モンヒロビート・MFバトルカード・M/B管理…)
//   ⑤ 札・人の並び・上の帯・下の案内が重ならない・地図の中に収まる・町の札は絵の中の建物の近く・いない場所は薄い
//   ⑥ 場所を押すと、いる助手とできることのシート。閉じるボタンで閉じる/「🏡 家へ」で家に戻る/人の「部屋へ」でその部屋
//   ⑦ 大きさ: 縦 390×844・375×667・320×568 / 横 844×390・667×375・568×320 / タブレット 768×1024 / 🔄横(モンヒロビートで回して戻る)390×844
//      顔ぶれ: いつもの種・11か所に散らばる・8人とも家(5人からは重ねる)
//   ⑧ ページのエラーが出ない
//   ⑨ カード部屋の 1.5倍を使い切った助手も HOME と地図に出て「済」の印(2026-11-08 社長「HOMEも地図も出す」)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9247;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots/lifemap');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const SIZES = [
  { id: 't390', name: '縦 390×844', w: 390, h: 844 },
  { id: 't375', name: '縦 375×667', w: 375, h: 667 },
  { id: 't320', name: '縦 320×568', w: 320, h: 568 },
  { id: 'y844', name: '横 844×390', w: 844, h: 390 },
  { id: 'y667', name: '横 667×375', w: 667, h: 375 },
  { id: 'y568', name: '横 568×320', w: 568, h: 320 },
  { id: 'tab', name: 'タブレット 768×1024', w: 768, h: 1024 },
  { id: 'r390', name: '🔄横 390×844', w: 390, h: 844, rot: true },
];
// 顔ぶれ(いつもの種は seed のまま)
const SPREAD = { groups: [{ ids: ['kiki', 'mua'], doing: 'walk', place: 'hill' }, { ids: ['dra', 'momosuke'], doing: 'training', place: 'ranch' }],
  solo: { atsu: { doing: 'idle', place: 'garden' }, kyuko: { doing: 'read', place: 'library' }, sorashido: { doing: 'walk', place: 'plaza' }, erubin: { doing: 'idle', place: 'temple' } } };
const ALL_HOME = { groups: [], solo: Object.fromEntries(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].map((id, i) => [id, { doing: i % 2 ? 'sleep' : 'idle', place: 'home' }])) };

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

  // 顔ぶれを入れる(いまの時間の様子として)
  const setLife = (page, mix) => page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, mix);
  const closeLife = async (page) => { for (let i = 0; i < 3 && await page.locator('[data-assistant-life-screen]').count(); i++) { await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false })); await page.waitForTimeout(300); } };
  // HOME の顔: 助手 → 札
  const homeFaces = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-assistant-life-home-face]')].map(b => [b.getAttribute('data-assistant-life-home-face'), b.closest('[data-assistant-life-home-faces]').getAttribute('data-assistant-life-home-faces')])));
  // HOME の札の位置(HOME の画面の中)
  const homeTags = (page) => page.evaluate(() => {
    const scene = document.querySelector('main.mh-home-scene'); if (!scene) return null; const s = scene.getBoundingClientRect(); const o = {};
    for (const [k, sel] of Object.entries({ management: '.mh-home-facility.management', temple: '.mh-home-facility.temple', market: '.mh-home-facility.market', life: '.mh-home-facility.life', rhythm: '.mh-home-facility.rhythm', card: '.mh-home-card-battle' })) {
      const el = scene.querySelector(sel); if (!el) continue; const t = el.classList.contains('mh-home-facility') ? el.querySelector(':scope > span') : el; const r = t.getBoundingClientRect();
      o[k] = { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    }
    return o;
  });
  const openMap = async (page) => {
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 5000 });
    await page.locator('[data-assistant-life-map]').waitFor({ timeout: 5000 });
    await page.waitForTimeout(1300);
  };
  // 地図を測る
  const mapInfo = (page) => page.evaluate(() => {
    const S = document.querySelector('[data-assistant-life-map]'); if (!S) return null; const s = S.getBoundingClientRect();
    const rel = (r) => ({ left: r.left - s.left, top: r.top - s.top, right: r.right - s.left, bottom: r.bottom - s.top });
    const places = [...S.querySelectorAll('[data-assistant-life-map-place]')].map(el => {
      const t = el.classList.contains('mh-home-facility') ? el.querySelector(':scope > span') : (el.classList.contains('mhl-map-town') ? el.querySelector(':scope > span') : el);
      const r = t.getBoundingClientRect();
      return { place: el.getAttribute('data-assistant-life-map-place'), cls: el.className, town: el.hasAttribute('data-assistant-life-map-town'), empty: el.getAttribute('data-assistant-life-map-empty') === '1',
        op: Math.min(parseFloat(getComputedStyle(el).opacity), parseFloat(getComputedStyle(t).opacity)), vis: getComputedStyle(el).visibility, x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height, r: rel(r) };
    });
    const crowds = [...S.querySelectorAll('[data-assistant-life-map-crowd]')].map(el => ({ place: el.getAttribute('data-assistant-life-map-crowd'), vis: getComputedStyle(el).visibility, r: rel(el.getBoundingClientRect()), who: [...el.querySelectorAll('[data-assistant-life-map-who]')].map(b => b.getAttribute('data-assistant-life-map-who')), names: [...el.querySelectorAll('[data-assistant-life-map-name]')].map(n => ({ t: n.textContent, cut: n.scrollWidth > n.clientWidth + 1 })) }));
    const bar = rel(S.querySelector('[data-assistant-life-map-bar]').getBoundingClientRect());
    const hint = rel(S.querySelector('[data-assistant-life-map-hint]').getBoundingClientRect());
    const img = S.querySelector('.mh-home-background img.mh-home-main'); let ib = null;
    if (img && img.naturalWidth) { const r = rel(img.getBoundingClientRect()), nw = img.naturalWidth, nh = img.naturalHeight; const k = getComputedStyle(img).objectFit === 'cover' ? Math.max((r.right - r.left) / nw, (r.bottom - r.top) / nh) : Math.min((r.right - r.left) / nw, (r.bottom - r.top) / nh); ib = { x: r.left + ((r.right - r.left) - nw * k) / 2, y: r.top + ((r.bottom - r.top) - nh * k) / 2, w: nw * k, h: nh * k }; }
    const art = document.querySelector('[data-assistant-life-where]').getAttribute('data-assistant-life-map-art');
    const town = ASSISTANT_LIFE_MAP_TOWN[art];
    const facOf = Object.fromEntries(Object.keys(ASSISTANT_LIFE_PLACE_ICON).map(p => [p, assistantLifeFacilityOf({ place: p })]));
    return { W: S.clientWidth, H: S.clientHeight, fromHome: S.getAttribute('data-assistant-life-map-from-home') === '1', places, crowds, bar, hint, ib, town, facOf, allPlaces: Object.keys(ASSISTANT_LIFE_PLACE_ICON) };
  });
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const FAC_CLASS = { management: 'mh-home-facility management', temple: 'mh-home-facility temple', market: 'mh-home-facility market', life: 'mh-home-facility life', rhythm: 'mh-home-facility rhythm', card: 'mh-home-card-battle' };

  for (const v of SIZES.filter(x => !process.env.MAP_ONLY || process.env.MAP_ONLY.split(',').includes(x.id))) { // MAP_ONLY=t320,y568 で一部だけ
    const T = `[${v.name}] `;
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    if (v.rot) {
      await waitFaces(page);
      await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
      await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
      await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(900);
      await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
      await page.locator('.mh-home-player').waitFor({ timeout: 15000 });
    }
    await waitFaces(page); await finishTalk(page); await page.waitForTimeout(600);
    const mixes = v.id === 't390' || v.id === 'y844' ? [['いつもの', null], ['散らばる', SPREAD], ['8人とも家', ALL_HOME]] : [['いつもの', null], ['散らばる', SPREAD]];
    for (const [mixName, mix] of mixes) {
      const M = `${T}${mixName}: `;
      await closeLife(page);
      if (mix) await setLife(page, mix);
      await page.waitForTimeout(1600); await finishTalk(page); await page.waitForTimeout(400);
      const faces = await homeFaces(page);
      const tagsHome = await homeTags(page);
      await openMap(page);
      const m = await mapInfo(page);
      if (!m) { check(`${M}地図が開く`, false); continue; }
      // ① 場所は11か所それぞれ1つ。HOME と同じ札
      { const ng = [];
        for (const p of m.allPlaces) { const n = m.places.filter(x => x.place === p).length; if (n !== 1) ng.push(`${p} が${n}個`); }
        for (const x of m.places) { const f = m.facOf[x.place]; if (x.town) { if (f !== 'life') ng.push(`町の場所 ${x.place} が HOME の ${f} に結びついている`); continue; } if (!(` ${x.cls} `).includes(` ${FAC_CLASS[f]} `)) ng.push(`${x.place} の札が HOME の ${f} の札(${FAC_CLASS[f]})でない: ${x.cls}`); }
        check(`${M}① 地図の場所は11か所それぞれ1つ。施設と結びつく場所は HOME と同じ札`, ng.length === 0, ng.join(' / ')); }
      // ② 1対1の位置(🔄横は HOME が回らない作りのまま。HOME があれば同じ大きさ)
      { const ng = [];
        if (!m.fromHome) ng.push('HOME の大きさを読めていない');
        for (const x of m.places) { if (x.town) continue; const h = tagsHome && tagsHome[m.facOf[x.place]]; if (!h) { ng.push(`HOME に ${m.facOf[x.place]} が無い`); continue; }
          if (Math.abs(h.x - x.x) > 2 || Math.abs(h.y - x.y) > 2 || Math.abs(h.w - x.w) > 2 || Math.abs(h.h - x.h) > 2) ng.push(`${x.place}: HOME(${Math.round(h.x)},${Math.round(h.y)} ${Math.round(h.w)}×${Math.round(h.h)}) 地図(${Math.round(x.x)},${Math.round(x.y)} ${Math.round(x.w)}×${Math.round(x.h)})`); }
        check(`${M}② HOME の札と地図の札が同じ位置・同じ大きさ(1対1)`, ng.length === 0, ng.join(' / ')); }
      // ③ HOME の顔と地図の全身が同じ場所
      { const ng = []; const mapAt = {};
        for (const c of m.crowds) for (const id of c.who) mapAt[id] = c.place;
        const spent = await page.evaluate(() => Object.fromEntries(ASSISTANT_LIFE_HOUSE_ORDER.map(id => [id, typeof assistantLifeCardSpent === 'function' && assistantLifeCardSpent(id)])));
        for (const id of Object.keys(mapAt)) { const want = m.facOf[mapAt[id]]; const got = faces[id]; if (!got) { if (!(want === 'card' && spent[id])) ng.push(`${id}: HOME に顔が無い(地図は ${mapAt[id]})`); continue; } if (got !== want) ng.push(`${id}: HOME は ${got}・地図は ${mapAt[id]}(${want})`); }
        for (const id of Object.keys(faces)) if (!mapAt[id]) ng.push(`${id}: 地図にいない(HOME は ${faces[id]})`);
        if (Object.keys(mapAt).length !== 8) ng.push(`地図の人数 ${Object.keys(mapAt).length}`);
        check(`${M}③ HOME の札の下の顔と、地図の全身が同じ場所`, ng.length === 0, ng.join(' / '));
        // 家の札のシート = HOME の「助手ライフ」の下の顔ぶれ
        await page.locator('[data-assistant-life-map-place="home"]').click({ timeout: 3000 });
        await page.waitForTimeout(250);
        const inSheet = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-sheet="home"] [data-assistant-life-map-sheet-who]')].map(e => e.getAttribute('data-assistant-life-map-sheet-who')).sort());
        const lifeFaces = Object.keys(faces).filter(id => faces[id] === 'life').sort();
        check(`${M}③ 家の札のシートに、HOME の「助手ライフ」の下の顔と同じ顔ぶれが並ぶ`, JSON.stringify(inSheet) === JSON.stringify(lifeFaces), `シート ${inSheet.join(',')} / HOME ${lifeFaces.join(',')}`);
        await page.locator('[data-assistant-life-map-sheet] [data-assistant-life-map-sheet-close]').click({ timeout: 3000 });
        await page.waitForTimeout(200);
      }
      // ⑤ 重ならない・収まる・町の札は建物の近く・いない場所は薄い・名札が切れない
      { const ng = [];
        const boxes = [...m.places.map(x => ({ c: `札 ${x.place}`, r: x.r })), ...m.crowds.map(c => ({ c: `人 ${c.place}`, r: c.r })), { c: '上の帯', r: m.bar }, { c: '下の案内', r: m.hint }];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].r, boxes[j].r)) ng.push(`${boxes[i].c}×${boxes[j].c}`);
        for (const b of boxes) if (b.r.left < -1 || b.r.top < -1 || b.r.right > m.W + 1 || b.r.bottom > m.H + 1) ng.push(`地図の外: ${b.c}`);
        for (const c of m.crowds) { if (c.vis === 'hidden') ng.push(`人が見えない: ${c.place}`); for (const n of c.names) if (n.cut) ng.push(`名札が切れる: ${n.t}`); }
        for (const x of m.places) {
          if (x.town) { if (x.vis === 'hidden') { ng.push(`町の札が見えない: ${x.place}`); continue; }
            const p = m.town && m.town[x.place]; if (p && m.ib) { const tx = m.ib.x + m.ib.w * p[0], ty = m.ib.y + m.ib.h * p[1]; const d = Math.hypot((x.r.left + x.r.right) / 2 - tx, (x.r.top + x.r.bottom) / 2 - ty); if (d > 175) ng.push(`町の札 ${x.place} が建物から ${Math.round(d)}px 離れた`); } }
          if (x.empty && x.op > 0.8) ng.push(`いない場所が薄くない: ${x.place}`);
          if (!x.empty && x.op < 0.95) ng.push(`いる場所が薄い: ${x.place}`);
        }
        for (const c of m.crowds) { const x = m.places.find(p => p.place === c.place); if (x && x.empty) ng.push(`人がいるのに薄い札: ${c.place}`); }
        check(`${M}⑤ 札・人・上の帯・下の案内が重ならず地図の中・町の札は建物の近く・いない場所は薄い・名札が切れない`, ng.length === 0, ng.slice(0, 8).join(' / '));
      }
      // ④ 居場所の言い方(家の出かけ札・地図のシート・今日あったこと)
      if (mixName === '散らばる' || mixName === 'いつもの') {
        const ng = await page.evaluate(() => {
          const out = []; const life = ASSISTANT_LIFE_STORE.state.life;
          for (const id of ASSISTANT_LIFE_HOUSE_ORDER) { const w = assistantLifeWhereOf(life, id); if (!w) continue;
            const word = assistantLifePlaceShow(w.place);
            if (w.place !== 'home' && !String(assistantLifeMapSpotWord(w.place)).includes(word)) out.push(`地図のシートの言い方 ${w.place}`); }
          // 今日あったこと: 遊び場は施設の名前で書く
          const fake = { groups: [{ ids: ['mua', 'kiki'], doing: 'practice', place: 'studio' }, { ids: ['dra', 'erubin'], doing: 'cards', place: 'cardroom' }, { ids: ['atsu', 'kyuko'], doing: 'training', place: 'ranch' }] };
          const before = (ASSISTANT_LIFE_DIARY.state.items || []).length;
          assistantLifeDiaryOnSlot(fake, { ...assistantLifeSlotAt(), abs: 900000000 + Math.floor(Math.random() * 1e6) }); // 同じ時間は1回だけ書くので、検査用の別の時間として
          return new Promise(res => setTimeout(() => { const items = ASSISTANT_LIFE_DIARY.state.items || []; const t = items.length > before ? items[items.length - 1].text : '';
            for (const w of ['モンヒロビート', 'MFバトルカード', 'M/B管理']) if (!t.includes(w)) out.push(`今日あったことに「${w}」が無い: ${t}`);
            for (const w of ['練習スタジオ', 'カード部屋', '育成場']) if (t.includes(w)) out.push(`今日あったことに古い言い方「${w}」: ${t}`);
            res(out); }, 300));
        });
        // 家の出かけ札(家に戻って見る)
        await page.locator('[data-assistant-life-map-back]').click({ timeout: 3000 });
        await page.waitForTimeout(400);
        const tags = await page.evaluate(() => { const out = []; const life = ASSISTANT_LIFE_STORE.state.life;
          for (const room of document.querySelectorAll('[data-assistant-life-room]')) { const id = room.getAttribute('data-assistant-life-room'); const w = assistantLifeWhereOf(life, id); const tag = room.querySelector('[data-assistant-life-room-away]');
            if (!w || w.place === 'home' || (typeof assistantLifeFriendAwayOf === 'function' && assistantLifeFriendAwayOf(id))) continue;
            if (!tag) { out.push(`${id}: 出かけ札が無い`); continue; }
            if (!tag.textContent.includes(assistantLifePlaceShow(w.place))) out.push(`${id}: 出かけ札「${tag.textContent}」に「${assistantLifePlaceShow(w.place)}」が無い`); }
          return out; });
        check(`${M}④ 居場所の言い方がそろう(家の出かけ札・地図・今日あったこと)`, ng.length + tags.length === 0, [...ng, ...tags].slice(0, 6).join(' / '));
        check(`${M}⑥「🏡 家へ」で家に戻る`, (await page.locator('[data-assistant-life-map]').count()) === 0 && (await page.locator('[data-assistant-life-room]').count()) === 8);
        await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 5000 }); await page.waitForTimeout(1200);
      }
      // ⑥ 場所を押すと、いる助手とできること・閉じる・部屋へ
      { const ng = [];
        const fresh = await mapInfo(page);
        for (const c of fresh.crowds) {
          if (c.place === 'home') continue;
          await page.locator(`[data-assistant-life-map-place="${c.place}"]`).click({ timeout: 3000 }); await page.waitForTimeout(200);
          const got = await page.evaluate((p) => [...document.querySelectorAll(`[data-assistant-life-map-sheet="${p}"] [data-assistant-life-map-sheet-who]`)].map(e => e.getAttribute('data-assistant-life-map-sheet-who')).sort(), c.place);
          if (JSON.stringify(got) !== JSON.stringify([...c.who].sort())) ng.push(`${c.place}: シート ${got.join(',')} / 地図 ${c.who.join(',')}`);
          const seen = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-map-sheet] [data-assistant-life-map-sheet-close]'); if (!b) return '閉じるが無い'; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); if (r.bottom > innerHeight + 1 || r.top < -1) return '閉じるが画面の外'; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === b || b.contains(t) ? '' : '閉じるが隠れる'; });
          if (seen) ng.push(`${c.place}: ${seen}`);
          if (c.place === 'studio' && !(await page.locator('[data-assistant-life-map-act="beat"]').count())) ng.push('モンヒロビートのシートに「一緒に遊ぶ」が無い');
          if (SHOTS && v.id === 't390' && mixName === 'いつもの' && c.place === 'cardroom') await page.screenshot({ path: path.join(shotDir, 'sheet-tate.png') });
          await page.locator('[data-assistant-life-map-sheet] [data-assistant-life-map-sheet-close]').click({ timeout: 3000 }); await page.waitForTimeout(150);
          if (await page.locator('[data-assistant-life-map-sheet]').count()) ng.push(`${c.place}: 閉じない`);
        }
        // いない場所
        const empty = fresh.places.find(x => x.empty);
        if (empty) { await page.locator(`[data-assistant-life-map-place="${empty.place}"]`).click({ timeout: 3000 }); await page.waitForTimeout(200);
          if (!(await page.locator('[data-assistant-life-map-sheet-none]').count())) ng.push(`いない場所(${empty.place})に「いまはだれもいません」が無い`);
          await page.locator('[data-assistant-life-map-sheet] [data-assistant-life-map-sheet-close]').click({ timeout: 3000 }); await page.waitForTimeout(150); }
        check(`${M}⑥ 場所を押すと、いる助手とできることのシート(閉じるボタンで閉じる)`, ng.length === 0, ng.join(' / '));
      }
      if (SHOTS) {
        await page.evaluate(() => { const w = document.querySelector('[data-assistant-life-where]'); if (w) w.scrollTop = 0; });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(shotDir, `map-${v.id}-${mixName}.png`) });
        if (mixName === 'いつもの') { await closeLife(page); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(shotDir, `home-${v.id}.png`) }); }
      }
    }
    // 人の「部屋へ」でその部屋
    if (v.id === 't390') {
      await closeLife(page); await setLife(page, SPREAD); await page.waitForTimeout(800); await openMap(page);
      await page.locator('[data-assistant-life-map-place="library"]').click({ timeout: 3000 }); await page.waitForTimeout(200);
      await page.locator('[data-assistant-life-map-sheet-who="kyuko"] [data-assistant-life-map-act="room"]').click({ timeout: 3000 }); await page.waitForTimeout(400);
      check(`${T}⑥ 人の「部屋へ」で、その助手の部屋が開く`, (await page.locator('[data-assistant-life-room-sheet="kyuko"]').count()) === 1);
    }
    // ⑨ カード部屋の 1.5倍を使い切った助手(2026-11-08 社長「HOMEも地図も出す」): HOME の顔も地図の全身も出て「済」の印・シートに次の時間帯
    if (v.id === 't390' || v.id === 'y844') {
      await closeLife(page);
      const ok = await page.evaluate(() => { if (typeof CARD_LIFE_REWARD_MEM === 'undefined' || typeof cardLifeSlotNow !== 'function') return false; const sl = cardLifeSlotNow(); if (!sl) return false; const raw = { slot: sl.abs, used: { dra: 99 } }; CARD_LIFE_REWARD_MEM.raw = raw; try { storeSet(CARD_LIFE_REWARD_KEY, raw); } catch (_) {} return true; }); // 写しと保存の両方(読み直されても残る)
      await setLife(page, { groups: [{ ids: ['dra', 'erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }], solo: { mua: { doing: 'idle', place: 'home' }, kiki: { doing: 'snack', place: 'cafe' }, momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } });
      await page.waitForTimeout(1600); await finishTalk(page); await page.waitForTimeout(300);
      const home = await page.evaluate(() => ({ dra: !!document.querySelector('[data-assistant-life-home-faces="card"] [data-assistant-life-home-face="dra"] [data-assistant-life-spent-mark]'), erubin: !!document.querySelector('[data-assistant-life-home-faces="card"] [data-assistant-life-home-face="erubin"] [data-assistant-life-spent-mark]'), up: !!document.querySelector('[data-assistant-life-home-card-up]') }));
      await openMap(page);
      const map = await page.evaluate(() => ({ dra: !!document.querySelector('[data-assistant-life-map-who="dra"][data-assistant-life-map-spent="1"] [data-assistant-life-spent-mark]'), erubin: !!document.querySelector('[data-assistant-life-map-who="erubin"] [data-assistant-life-spent-mark]') }));
      await page.locator('[data-assistant-life-map-place="cardroom"]').click({ timeout: 3000 }); await page.waitForTimeout(200);
      const sheet = await page.evaluate(() => ({ next: (document.querySelector('[data-assistant-life-map-sheet-who="dra"] [data-assistant-life-map-sheet-next]') || {}).textContent || '', card: !!document.querySelector('[data-assistant-life-map-sheet-who="dra"] [data-assistant-life-map-act="card"]'), other: !!document.querySelector('[data-assistant-life-map-sheet-who="erubin"] [data-assistant-life-map-act="card"]') }));
      if (SHOTS) { await page.screenshot({ path: path.join(shotDir, `spent-sheet-${v.id}.png`) }); }
      await page.locator('[data-assistant-life-map-sheet] [data-assistant-life-map-sheet-close]').click({ timeout: 3000 });
      if (SHOTS) { await page.waitForTimeout(200); await page.screenshot({ path: path.join(shotDir, `spent-map-${v.id}.png`) }); await closeLife(page); await page.waitForTimeout(1200); await page.screenshot({ path: path.join(shotDir, `spent-home-${v.id}.png`) }); }
      check(`${T}⑨ ごほうびを使い切った助手は、HOME の顔も地図の全身も出て「済」の印(ほかの人には付かない・UP は残る)・シートに次の時間帯・対戦のボタンは出ない`,
        ok && home.dra && !home.erubin && home.up && map.dra && !map.erubin && /ごほうびアップは使い切りました/.test(sheet.next) && !sheet.card && sheet.other, JSON.stringify({ ok, home, map, sheet }));
    }
    // ⑪ HOME の場面が画面より低い端末(上下に帯がある iPhone など)でも、地図の下に一覧の見出しがのぞかない
    //    (2026-11-09 社長「画面バグってる」: 見出し「ASSISTANT LIFE · WHERE」が地図の下で切れて見えた)
    if (v.id === 't390' || v.id === 'y844') {
      await closeLife(page);
      await page.addStyleTag({ content: 'main.mh-home-scene{flex:none!important;height:calc(100% - 64px)!important}' }); await page.waitForTimeout(500);
      await openMap(page);
      const r = await page.evaluate(() => { const box = document.querySelector('[data-assistant-life-where]'), below = document.querySelector('[data-assistant-life-map-below]'), S = document.querySelector('[data-assistant-life-map]');
        return { boxH: box.clientHeight, sceneH: S.offsetHeight, belowTop: below ? below.getBoundingClientRect().top - box.getBoundingClientRect().top : null, scroll: box.scrollTop }; });
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `short-home-${v.id}.png`) });
      check(`${T}⑪ HOME が画面より低くても、地図の下に一覧の見出しがのぞかない(一覧は画面の下の外から)`, r.sceneH < r.boxH && r.scroll === 0 && r.belowTop != null && r.belowTop >= r.boxH - 1, JSON.stringify(r));
      await closeLife(page);
    }
    // ⑫ 地図の絵も助手も縦横の比を保つ(2026-11-09 社長「画面バグってる」: iPhone で助手が縦に細長く伸びていた)
    //    iPhone で canvas が使えず絵を測れないときも同じ(canvas を使えなくして開き直す)
    if (v.id === 't390' || v.id === 'y844' || v.id === 'tab') {
      const ratio = () => page.evaluate(() => {
        const ng = [];
        for (const im of document.querySelectorAll('[data-assistant-life-map] img')) {
          if (!im.naturalWidth) continue; const r = im.getBoundingClientRect(), cs = getComputedStyle(im);
          const nat = im.naturalWidth / im.naturalHeight, box = r.width / r.height;
          if (cs.objectFit === 'cover' || cs.objectFit === 'contain') continue; // 枠と比が違っても、中の絵は伸びない
          if (Math.abs(box / nat - 1) > 0.03) ng.push(`${im.getAttribute('src')}: 絵 ${nat.toFixed(3)} 表示 ${box.toFixed(3)} (${cs.objectFit})`);
        }
        const figs = [...document.querySelectorAll('[data-assistant-life-map-fig] img')].map(im => getComputedStyle(im).objectFit);
        const bg = getComputedStyle(document.querySelector('[data-assistant-life-map] .mh-home-background img.mh-home-main')).objectFit;
        return { ng, figs: figs.length, figFit: [...new Set(figs)], bg };
      });
      await closeLife(page); await openMap(page);
      const a = await ratio();
      check(`${T}⑫ 地図の絵(${a.bg})と助手${a.figs}人(${a.figFit.join(',')})が縦横の比を保つ`, a.ng.length === 0 && a.figs > 0 && (a.bg === 'cover' || a.bg === 'contain') && a.figFit.every(f => f === 'contain'), a.ng.join(' / '));
      await closeLife(page);
      await page.evaluate(() => { ASSISTANT_LIFE_STAND_BOX.clear(); HTMLCanvasElement.prototype.getContext = () => null; });
      await openMap(page); await page.waitForTimeout(600);
      const b = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-fig] img')].map(im => { const st = ASSISTANT_LIFE_STAND_BOX.get(im.getAttribute('src')); const r = im.getBoundingClientRect(); return { src: im.getAttribute('src'), ar: st && st.ar, nat: im.naturalWidth / im.naturalHeight, box: r.width / r.height }; }));
      const bad = b.filter(x => !x.ar || Math.abs(x.ar / x.nat - 1) > 0.01 || Math.abs(x.box / x.nat - 1) > 0.03);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `nocanvas-${v.id}.png`) });
      check(`${T}⑫ canvas が使えず絵を測れなくても、助手は本物の縦横の比で出る(${b.length}人)`, b.length > 0 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
      await closeLife(page);
    }
    await page.close();
  }
  check('⑧ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
