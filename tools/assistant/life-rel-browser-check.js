// 助手ライフ: けんか・仲直りなど人間らしい出来事の家での見せ方を、本物の画面で開いて確かめる(56-assistant-life-rel.jsx)。
//   node tools/assistant/life-rel-browser-check.js           検査(縦 390×844・横 844×390・🔄横から戻った 390×844 × 朝・昼・夕・夜)
//   node tools/assistant/life-rel-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/shots/rel-*.jpg)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
// 見るもの(崩れの種類ごと):
//   ① 文字の切れ: 部屋の吹き出し・行き先の札・シートの1行が箱からはみ出さない/名前の途中で折れない(名前は1つのまとまり)
//   ② 重なり: 🚪 扉が窓・名札に重ならない/🤝 札が名札に重ならない/居間の2人が掲示板・扉・ソファに重ならない/2人は離れて座る
//   ③ 話し手がその場にいる: 取り持つの場面で、話す助手の立ち絵が全員出ている
//   ④ 寝ている・出かけている表示と台詞が合う: 寝ている助手は扉にしない(💤)/出かけている助手は札に「💢 ◯◯とけんか中」/部屋にいるのに扉の助手は顔を出さない
//   ⑤ 朝・昼・夕・夜のどの背景でも、吹き出し・札の文字と地の色の差が十分(4.5:1 以上)
//   ⑥ 取り持つと、その場で仲直り → 家に 🤝 の札・今日あったことに1件
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9263;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 日本時間 2026-11-08 の朝・昼・夕・夜
const TIMES = [{ id: 'morning', name: '朝', at: '2026-11-07T22:40:00Z' }, { id: 'noon', name: '昼', at: '2026-11-08T03:40:00Z' }, { id: 'evening', name: '夕', at: '2026-11-08T09:40:00Z' }, { id: 'night', name: '夜', at: '2026-11-08T13:40:00Z' }];
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'r', name: '🔄横から戻った 390×844', w: 390, h: 844, rot: true }];

// 場面をつくる。kind 'quarrel' … 扉・出かけた札・やきもち・寝ている / 'living' … 居間で離れて座る・仲直りしたて
const stage = (page, kind) => page.evaluate((kind) => {
  const R = assistantLifeRelSet();
  const fightOf = (pk) => R.quarrel.find(t => t.kind === 'quarrel' && t.pair.join('-') === pk);
  const jt = R.jealous.find(t => t.watcher === 'dra') || R.jealous[0];
  const bond = { ...(ASSISTANT_PEER_STORE.state.bond || {}), [jt.pk]: 2000, 'kiki-kyuko': 500, 'atsu-mua': 500 };
  const l = ASSISTANT_LIFE_STORE.state.life;
  if (kind === 'quarrel') {
    const f = fightOf('atsu-mua');
    ASSISTANT_PEER_STORE.set({ bond, quarrel: { pending: { id: f.id, pair: 'atsu-mua', at: Date.now() }, done: [] } });
    ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, loaded: true, mended: {} };
    const [x, y] = jt.pk.split('-');
    const rest = ['kiki', 'kyuko', 'sorashido', 'momosuke', 'erubin', 'atsu', 'mua', 'dra'].filter(id => ![x, y, jt.watcher, 'mua', 'atsu'].includes(id));
    ASSISTANT_LIFE_STORE.set({ life: { ...l, moods: { mua: 'sulky', atsu: 'sulky' }, watched: [],
      groups: [{ ids: [x, y], place: 'plaza', doing: 'walk' }, ...(rest.length >= 2 ? [{ ids: rest.slice(0, 2), place: 'library', doing: 'cards' }] : [])],
      solo: { mua: { place: 'home', doing: 'idle', reason: 'distance' }, atsu: { place: 'cafe', doing: 'snack', reason: 'distance' }, [jt.watcher]: { place: 'home', doing: 'idle', reason: 'lonely' },
        ...(rest[2] ? { [rest[2]]: { place: 'home', doing: 'sleep', reason: 'mypace' } } : {}), ...(rest[3] ? { [rest[3]]: { place: 'studio', doing: 'practice', reason: 'mypace' } } : {}) } } });
    return { door: 'mua', away: 'atsu', jealous: jt.watcher, sleep: rest[2] || null };
  }
  const f = fightOf('kiki-kyuko');
  ASSISTANT_PEER_STORE.set({ bond, quarrel: { pending: { id: f.id, pair: 'kiki-kyuko', at: Date.now() }, done: [] } });
  ASSISTANT_LIFE_REL_STORE.state = { ...ASSISTANT_LIFE_REL_STORE.state, loaded: true, mended: { 'atsu-sorashido': { day: assistantLifeDayKey(), abs: assistantLifeSlotAt().abs }, 'erubin-mua': { day: assistantLifeDayKey(), abs: assistantLifeSlotAt().abs } } };
  ASSISTANT_LIFE_STORE.set({ life: { ...l, moods: {}, watched: [],
    groups: [{ ids: ['kiki', 'kyuko'], place: 'home', doing: 'snack' }, { ids: ['atsu', 'sorashido'], place: 'cardroom', doing: 'cards' }],
    solo: { mua: { place: 'home', doing: 'idle', reason: 'mypace' }, erubin: { place: 'home', doing: 'idle', reason: 'mypace' }, dra: { place: 'home', doing: 'sleep', reason: 'mypace' }, momosuke: { place: 'studio', doing: 'practice', reason: 'mypace' } } } });
  return { living: ['kiki', 'kyuko'], mend: 'mua', mendAway: 'atsu' };
}, kind);

// 崩れを数える(①②④⑤)
const problems = (page) => page.evaluate(() => {
  const ng = [];
  const rect = (el) => el.getBoundingClientRect();
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  // ① はみ出し
  for (const el of document.querySelectorAll('[data-assistant-life-room-bub],[data-assistant-life-room-away],[data-assistant-life-rel-row]')) {
    if (el.scrollWidth > el.clientWidth + 1) ng.push(`はみ出し: ${el.textContent.slice(0, 20)}`);
    if (el.matches('[data-assistant-life-room-bub]') && el.scrollHeight > el.clientHeight + 1) ng.push(`はみ出し(縦): ${el.textContent.slice(0, 20)}`);
    const room = el.closest('.mhl-room');
    if (room) { const r = rect(el), rr = rect(room); if (r.left < rr.left - 1 || r.right > rr.right + 1) ng.push(`部屋からはみ出し: ${el.textContent.slice(0, 20)}`); }
  }
  // 名前が途中で折れない(助手の名前を含む1つのまとまりが、2行にまたがらない)
  const NAMES = ['みゅあ', 'きき', 'ももすけ', 'ドラ', 'あつ', 'きゅうこ', 'ソラシド', 'えるびん'];
  for (const el of document.querySelectorAll('[data-assistant-life-room-bub] span,[data-assistant-life-rel-row] p')) {
    const t = el.textContent || '';
    for (const n of NAMES) {
      const i = t.indexOf(n); if (i < 0 || !el.firstChild) continue;
      const tn = [...el.childNodes].find(c => c.nodeType === 3 && c.textContent.includes(n)); if (!tn) continue;
      const rg = document.createRange(); const j = tn.textContent.indexOf(n); rg.setStart(tn, j); rg.setEnd(tn, j + n.length);
      if (rg.getClientRects().length > 1) ng.push(`名前が途中で折れる: ${t.slice(0, 24)}`);
    }
  }
  // 説明文のまとまり(whitespace-nowrap の span)が、途中で折れない
  for (const el of document.querySelectorAll('[data-assistant-life-rel-row] p span.whitespace-nowrap')) { const rg = document.createRange(); rg.selectNodeContents(el); const ls = new Set([...rg.getClientRects()].map(r => Math.round(r.top))); if (ls.size > 1) ng.push(`言葉の途中で折れる: ${el.textContent}`); }
  // ② 重なり
  for (const d of document.querySelectorAll('[data-assistant-life-rel-door]')) {
    const room = d.closest('.mhl-room');
    for (const sel of ['.win', '.pl', '.lv']) { const o = room.querySelector(sel); if (o && hit(rect(d), rect(o))) ng.push(`扉が ${sel} に重なる(${room.getAttribute('data-assistant-life-room')})`); }
    const pp = room.querySelector('.pp'); if (pp && getComputedStyle(pp).visibility !== 'hidden') ng.push('扉なのに顔が見えている');
  }
  // 仲直りしたての部屋は、吹き出しが「🤝 ◯◯と仲直り！」の札(橙)になる。吹き出しが窓・名札に重ならない
  for (const m of document.querySelectorAll('.mhl-rel-mend')) { const room = m.closest('.mhl-room'); const bb = room.querySelector('.bb'); if (!bb || !/仲直り/.test(bb.textContent)) { ng.push(`🤝 の札が無い(${room.getAttribute('data-assistant-life-room')})`); continue; } for (const sel of ['.pl', '.lv']) { const o = room.querySelector(sel); if (o && hit(rect(bb), rect(o))) ng.push(`🤝 の札が ${sel} に重なる(${room.getAttribute('data-assistant-life-room')})`); } }
  const sits = [...document.querySelectorAll('[data-assistant-life-rel-sit]')];
  if (sits.length) {
    const liv = rect(document.querySelector('[data-assistant-life-living]'));
    for (const s of sits) {
      const r = rect(s);
      if (r.left < liv.left - 1 || r.right > liv.right + 1 || r.top < liv.top - 10 || r.bottom > liv.bottom + 1) ng.push('居間の顔が居間からはみ出す');
      for (const sel of ['[data-assistant-life-board]', '.mhl-door']) { const o = document.querySelector(sel); if (o && hit(r, rect(o))) ng.push(`居間の顔が ${sel} に重なる`); }
    }
    if (sits.length === 2 && Math.abs(rect(sits[0]).left - rect(sits[1]).left) < liv.width * .25) ng.push('居間の2人が離れていない');
  }
  // ⑤ 文字と地の色の差
  const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return 1; const [r, g, b] = m.slice(0, 3).map(v => { v = Number(v) / 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  for (const el of document.querySelectorAll('[data-assistant-life-room-bub],[data-assistant-life-rel-row] p')) {
    let bg = null, n = el; while (n && n !== document.body) { const c = getComputedStyle(n).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c) && !/, 0\)$/.test(c)) { bg = c; break; } const bi = getComputedStyle(n).backgroundImage; if (bi && bi.includes('gradient')) { const m = bi.match(/(#[0-9a-f]{6}|rgba?\([^)]+\))/i); if (m) { bg = m[1].startsWith('#') ? `rgb(${parseInt(m[1].slice(1, 3), 16)},${parseInt(m[1].slice(3, 5), 16)},${parseInt(m[1].slice(5, 7), 16)})` : m[1]; break; } } n = n.parentElement; }
    if (!bg) continue;
    const a = lum(getComputedStyle(el).color), b = lum(bg);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < 4.5) ng.push(`文字が読みにくい(${ratio.toFixed(1)}:1): ${el.textContent.slice(0, 16)}`);
  }
  return ng;
});

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const tm of TIMES) for (const v of VIEWS) {
      if (!SHOTS && v.rot && tm.id !== 'night') continue; // 🔄横は夜だけ(止め絵を撮るときは全部)
      const T = `[${v.name}・${tm.name}] `;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.clock.setFixedTime(new Date(tm.at));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      if (v.rot) {
        await page.locator('.mh-home-facility.rhythm').click({ timeout: 15000 }).catch(() => {});
        await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 }).catch(() => {});
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(800);
        await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.locator('.mh-home-player').waitFor({ timeout: 15000 }).catch(() => {});
      }
      await finishTalk(page);
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForFunction(() => typeof ASSISTANT_LIFE_REL_STORE !== 'undefined' && ASSISTANT_LIFE_REL_STORE.state.loaded, null, { timeout: 5000 }).catch(() => {});
      // 場面1: けんか(扉・出かけた札・やきもち・寝ている)
      const s1 = await stage(page, 'quarrel'); await page.waitForTimeout(400);
      check(`${T}けんか中で部屋にひとり → 🚪 扉(顔は扉の向こう)`, (await page.locator(`[data-assistant-life-room="${s1.door}"] [data-assistant-life-rel-door]`).count()) === 1);
      check(`${T}出かけている → 札に「💢 ◯◯とけんか中」`, /💢 みゅあとけんか中/.test(await page.locator(`[data-assistant-life-room="${s1.away}"] [data-assistant-life-room-away]`).innerText().catch(() => '')));
      check(`${T}やきもち → 💭 …いいなぁ`, /いいなぁ/.test(await page.locator(`[data-assistant-life-room="${s1.jealous}"] [data-assistant-life-room-bub]`).innerText().catch(() => '')));
      if (s1.sleep) check(`${T}寝ている助手は扉にしない`, (await page.locator(`[data-assistant-life-room="${s1.sleep}"] [data-assistant-life-rel-door]`).count()) === 0);
      { const ng = await problems(page); check(`${T}けんかの家: 文字の切れ・名前の折れ・重なり・読みにくさが無い`, !ng.length, ng.slice(0, 5).join(' / ')); }
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `rel-1-quarrel-${v.id}-${tm.id}.jpg`), type: 'jpeg', quality: 80 });
      // 部屋のシート(原因と取り持つ)
      await page.locator(`[data-assistant-life-room="${s1.door}"]`).click();
      await page.locator('[data-assistant-life-rel-row="quarrel"]').waitFor({ timeout: 3000 }).catch(() => {});
      const row = await page.locator('[data-assistant-life-rel-row="quarrel"]').innerText().catch(() => '');
      check(`${T}部屋のシート: 「💢 いま あつとけんか中(原因: …)」と取り持つ`, /いま あつとけんか中/.test(row) && /原因: /.test(row) && (await page.locator('[data-assistant-life-room-act="mediate"]').count()) === 1, row.split('\n')[0]);
      { const ng = await problems(page); check(`${T}部屋のシート: 文字の切れ・読みにくさが無い`, !ng.length, ng.slice(0, 4).join(' / ')); }
      if (SHOTS && tm.id === 'night') await page.screenshot({ path: path.join(shotDir, `rel-2-sheet-${v.id}.jpg`), type: 'jpeg', quality: 80 });
      // 取り持つ → 場面(話し手がその場にいる)
      await page.locator('[data-assistant-life-room-act="mediate"]').click();
      await page.locator('[data-assistant-peer-talk]').first().waitFor({ timeout: 5000 }).catch(() => {});
      const sc = await page.evaluate(() => {
        const el = document.querySelector('[data-assistant-peer-talk]'); if (!el) return null;
        const faces = [...document.querySelectorAll('[data-assistant-life-scene] [data-assistant-life-scene-face],[data-assistant-life-scene] img[alt]')].map(x => x.getAttribute('data-assistant-life-scene-face') || x.getAttribute('alt'));
        return { id: el.getAttribute('data-assistant-peer-talk'), faces };
      });
      const talk = sc && await page.evaluate((id) => { const t = assistantLifeRelSet().byId[id] || null; return t ? t.lines.map(l => l.who) : null; }, sc.id);
      check(`${T}取り持つと、その場で仲直りの掛け合いが流れる`, !!sc && /^rel-mend-/.test(sc.id || ''), sc ? sc.id : 'なし');
      if (SHOTS && tm.id === 'night') await page.screenshot({ path: path.join(shotDir, `rel-3-mediate-${v.id}.jpg`), type: 'jpeg', quality: 80 });
      const sceneIds = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-scene-stand]')].map(x => x.getAttribute('data-assistant-life-scene-stand')).join(','));
      if (talk) check(`${T}話す助手が全員その場にいる`, talk.every(w => sceneIds.split(',').includes(w)), `話す ${[...new Set(talk)].join('・')} / 場面 ${sceneIds}`);
      await finishTalk(page);
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      check(`${T}仲直りしたあとは、家に 🤝 仲直りの札`, (await page.locator('[data-assistant-life-rel-mend]').count()) >= 1 && (await page.locator('[data-assistant-life-rel-door]').count()) === 0);
      // 場面2: 居間で離れて座る・仲直りしたて
      const s2 = await stage(page, 'living'); await page.waitForTimeout(400);
      check(`${T}けんか中の2人が家にいる → 居間で離れて座る`, (await page.locator('[data-assistant-life-rel-sit]').count()) === 2);
      check(`${T}仲直りしたて → 部屋に 🤝・出かけた札に「🤝 ◯◯と仲直り」`, (await page.locator(`[data-assistant-life-room="${s2.mend}"] [data-assistant-life-rel-mend]`).count()) === 1 && /🤝 ソラシドと仲直り/.test(await page.locator(`[data-assistant-life-room="${s2.mendAway}"] [data-assistant-life-room-away]`).innerText().catch(() => '')));
      { const ng = await problems(page); check(`${T}居間と仲直りの家: 文字の切れ・名前の折れ・重なり・読みにくさが無い`, !ng.length, ng.slice(0, 5).join(' / ')); }
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `rel-4-living-${v.id}-${tm.id}.jpg`), type: 'jpeg', quality: 80 });
      check(`${T}画面のエラーが無い`, !errors.length, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
