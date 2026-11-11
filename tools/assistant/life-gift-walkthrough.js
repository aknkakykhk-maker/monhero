// 助手ライフ(新しいUI)の「贈る」まわりを、初めての人と毎日来る人の目で通しでたどり、場面ごとに止め絵と数字を出す
// (2026-11-11 社長「贈るやつも見た目とか分かりにくい仕様だから、全体的にそのへんも見直して」・オクリモノ4)。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-gift-walkthrough.js                  数字だけ(場面ごとに 字数・小さい字・押せる所・小さいタップ・縦の長さ。最後の1行に OK/NG)
//   node tools/assistant/life-gift-walkthrough.js --shots [置き場]  止め絵も撮る(既定 docs/progress/assistant-life/gift-walkthrough/now/)
//   --2x 人に見せる細かさ / --who first|daily 片方だけ / --view tate|yoko(既定 tate だけ) / LIFE_BASE=<URL> で本番の版を見る
// たどる場面: 家の「贈る」→贈る窓(2人)→持っていない道具→買って贈るの確かめ→1人に贈る→贈ったあと→回数を使い切ったあと
//             →部屋の「贈る」の行→好きなもの→家具のシート→家具を買って贈る→友情(思い出アルバム・チェキ・使う)→道具タブ→交換所の道具/家具の段→持ち物の「使う」
// NG にするのは、たどり着けない場面とページのエラーだけ(見やすさは人が止め絵で決める)。
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = 9273, SHOTS = flag('--shots');
const shotDir = path.resolve(root, opt('--shots', 'docs/progress/assistant-life/gift-walkthrough/now'));
const VIEWS = [{ id: 'tate', name: '縦', w: 390, h: 844 }, { id: 'yoko', name: '横', w: 844, h: 390 }].filter(v => v.id === opt('--view', 'tate'));
const WHOS = [{ id: 'first', name: '初めて' }, { id: 'daily', name: '毎日' }].filter(v => !opt('--who') || v.id === opt('--who'));
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

// いちばん前の窓(なければ画面)の中で、見えている字と押せる所を数える
const measure = () => {
  const W = innerWidth, H = innerHeight;
  const tops = ['[data-assistant-life-buy-confirm]', '[data-assistant-life-give-sheet]', '[data-assistant-life-furn-sheet]'];
  const rootEl = tops.map(s => document.querySelector(s)).find(Boolean) || document.querySelector('[data-assistant-life-screen]') || document.body;
  const seen = (el, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return false; const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el)); };
  let chars = 0, tiny = 0, small = 0, all = 0;
  const tw = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const s = n.nodeValue.replace(/\s+/g, ''); if (!s) continue;
    const p = n.parentElement; if (!p || p.closest('[aria-hidden="true"],style,script')) continue;
    const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const rg = document.createRange(); rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const len = [...s].length; all += len;
    if (!(r.bottom > 0 && r.top < H) || !seen(p, Math.min(W - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(H - 1, Math.max(0, (r.top + r.bottom) / 2)))) continue;
    const px = parseFloat(cs.fontSize) || 0; chars += len; if (px < 10) tiny += len; else if (px < 11) small += len;
  }
  const taps = [...rootEl.querySelectorAll('button,[role="button"],[role="tab"]')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < H && !el.disabled && seen(el, (Math.max(0, r.left) + Math.min(W, r.right)) / 2, (Math.max(0, r.top) + Math.min(H, r.bottom)) / 2) && (el.innerText || '').trim(); });
  const t44 = taps.filter(el => { const r = el.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; }).length;
  let pages = 1;
  for (const el of rootEl.querySelectorAll('*')) { const o = getComputedStyle(el).overflowY; if ((o === 'auto' || o === 'scroll') && el.clientHeight > H * 0.25 && el.scrollHeight > el.clientHeight + 4) pages = Math.max(pages, el.scrollHeight / el.clientHeight); }
  return { chars, all, tiny, small, taps: taps.length, t44, pages: Math.round(pages * 10) / 10 };
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので点検できません'); process.exit(0); }
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
  const now = new Date(Date.now() + 9 * 3600000); now.setUTCHours(15, 0, 0, 0);
  const fixed = new Date(now.getTime() - 9 * 3600000);
  const errors = [], rows = [], lost = [];
  for (const who of WHOS) for (const v of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: flag('--2x') ? 2 : 1 });
    const page = await ctx.newPage();
    await page.clock.setFixedTime(fixed);
    page.on('pageerror', e => errors.push(`${who.name}/${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: who.id === 'first', bondAll: null });
    // 初めての人: 道具0個・ビートP 120(いちばん安い道具も買えるかどうかの境目)/毎日来る人: 道具をいくつか・ビートP 900・好みが少し分かっている
    await page.addInitScript((first) => {
      if (localStorage.getItem('mh_walk_gift') !== null) return; localStorage.setItem('mh_walk_gift', '1');
      let o = {}; try { o = JSON.parse(localStorage.getItem('mh_owned_items')) || {}; } catch {}
      for (const k of Object.keys(o)) if (/^(peer_|solo_|furn_)/.test(k)) delete o[k];
      if (first) { localStorage.setItem('mh_assistant_peer_bond_v1', '{}'); localStorage.setItem('mh_rhythm_event_points_v1', '120'); }
      else { Object.assign(o, { peer_gift: 2, peer_token: 1, peer_cake: 1, peer_cheki: 1, solo_candy: 1, furn_bear: 1 }); localStorage.setItem('mh_rhythm_event_points_v1', '900'); }
      localStorage.setItem('mh_owned_items', JSON.stringify(o));
    }, who.id === 'first');
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const T = `${who.name}/${v.name}`;
    const snap = async (key, label) => {
      await page.waitForTimeout(500);
      const m = await page.evaluate(measure);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${who.id}-${v.id}-${key}.png`) });
      rows.push({ label: `${T} ${label}`, key: `${who.id}-${v.id}-${key}`, m });
    };
    const click = (s, o = {}) => page.locator(s).first().click({ timeout: 4000, ...o });
    const step = async (key, label, go, back) => {
      try { await go(); await snap(key, label); } catch (e) { lost.push(`${T} ${label}(${String(e.message || e).split('\n')[0].slice(0, 80)})`); }
      try { if (back) await back(); } catch {}
      await page.waitForTimeout(350);
    };
    const closeSheets = async () => { for (let i = 0; i < 4; i++) { const b = page.locator('[data-assistant-life-buy-cancel]:visible, [data-assistant-life-furn-close]:visible, [data-mhl-sheet-close]:visible').last(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); } };
    const closeRoom = async () => { for (let i = 0; i < 3 && await page.locator('[data-assistant-life-roomview-close]').count(); i++) { await click('[data-assistant-life-roomview-close]').catch(() => {}); await page.waitForTimeout(350); } };
    const openRoom = async (id) => { if (!(await page.locator('[data-assistant-life-roomview-close]').count())) await click(`[data-assistant-life-room="${id}"]`); await page.waitForTimeout(400); };
    const openGive = () => click('[data-assistant-life-today-act="give"]');
    // 贈ったあとは場面の画面(おやつ屋さん など)に移る。下の「家へ戻る」で家へ
    const toHouse = async () => { for (let i = 0; i < 3; i++) { const b = page.locator('[data-assistant-life-scene-back]:visible').first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); } };
    try {
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, moods: { atsu: 'lonely' }, watched: [] } }); }, MIX);
      await page.waitForTimeout(800); await finishTalk(page);
      await click('[data-home-assistant-life]', { timeout: 20000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
      await snap('01-home', '家(贈るの入口)');
      for (let i = 0; i < 4; i++) { const b = page.locator('[data-assistant-life-item-intro-close]:visible, [data-assistant-life-screen] button:visible:text-matches("^(わかった！?|OK|はじめる|とじる)$")').first(); if (!(await b.count())) break; await b.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(400); }
      await step('02-give-pair', '贈る窓(2人に・開いてすぐ)', openGive);
      await step('03-give-unowned', '贈る窓(持っていない道具を選ぶ)', () => click('[data-assistant-life-give-kind="tea"]'));
      // ビートPが足りないときは「買って贈る」が押せない(足りないことは窓に出る)ので、確かめの窓は押せるときだけ
      if (await page.locator('[data-assistant-life-give-buy]:enabled').count()) await step('04-buy-confirm', '買って贈るの確かめ', () => click('[data-assistant-life-give-buy]'), () => click('[data-assistant-life-buy-cancel]'));
      await step('05-give-solo', '贈る窓(1人だけに切りかえ)', async () => { const b = page.locator('[data-assistant-life-give-solo]').first(); if (await b.count()) await b.click({ timeout: 3000 }); }, closeSheets);
      if (who.id === 'daily') {
        // 1回贈る → 贈ったあとに見える物 → あと2回贈って使い切る
        await step('06-after-give', '贈った直後', async () => { await openGive(); await click('[data-assistant-life-give-kind="gift"]'); await click('[data-assistant-life-give-go]'); await page.waitForTimeout(900); });
        await finishTalk(page); await page.waitForTimeout(600);
        await step('07-after-talk', '贈ったあと(お話のあとの場面)', async () => {}, toHouse);
        await step('08-same-item', '贈る窓(同じ道具は今日もう贈れない)', async () => { await openGive(); await click('[data-assistant-life-give-kind="gift"]'); }, closeSheets);
        for (const k of ['token', 'cake']) { await openGive().catch(() => {}); await click(`[data-assistant-life-give-kind="${k}"]`).catch(() => {}); await click('[data-assistant-life-give-go]').catch(() => {}); await page.waitForTimeout(900); await finishTalk(page); await page.waitForTimeout(500); await toHouse(); }
        await step('09-used-up-home', '2人に3回贈ったあとの家', async () => {});
        await step('10-used-up-sheet', '2人に3回贈ったあと贈るを押す', openGive, closeSheets);
      }
      await step('11-room-pair', '部屋(一緒にいる・みゅあ)の贈るの行', async () => { await openRoom('mua'); await page.locator('[data-assistant-life-room-act="give-solo"]').first().scrollIntoViewIfNeeded().catch(() => {}); });
      await step('12-room-likes', '部屋の「好きなもの」を開く', async () => { const b = page.locator('[data-assistant-life-gift-likes] button').first(); await b.scrollIntoViewIfNeeded(); await b.click({ timeout: 3000 }); });
      await step('13-furn-sheet', '家具のシート', async () => { const b = page.locator('[data-assistant-life-room-act="furn"]').first(); await b.scrollIntoViewIfNeeded(); await b.click({ timeout: 3000 }); });
      await step('14-furn-buy', '家具を買って贈るの確かめ', () => click('[data-assistant-life-furn-buy]'), closeSheets);
      await closeSheets(); await closeRoom();
      await step('15-room-solo', '部屋(家にひとり・あつ)の贈るの行', async () => { await openRoom('atsu'); await page.locator('[data-assistant-life-room-act="give-solo"]').first().scrollIntoViewIfNeeded().catch(() => {}); }, closeRoom);
      await step('16-friends', '友情(きずな)', () => click('[data-assistant-life-icon="friends"]'));
      await step('17-album', '友情 → 組を押す(思い出アルバム・2人にしてあげる)', async () => { await click('[data-assistant-peer-row]'); await page.locator('[data-assistant-peer-use]').first().waitFor({ timeout: 4000 }); await page.locator('[data-assistant-peer-use]').last().scrollIntoViewIfNeeded(); }, () => click('[data-assistant-peer-album-close]'));
      await step('18-items-top', '道具タブ(上)', () => click('[data-assistant-life-icon="items"]'));
      await step('19-items-bottom', '道具タブ(いちばん下)', () => page.evaluate(() => { const el = document.querySelector('[data-assistant-life-items]'); for (let p = el; p; p = p.parentElement) if (p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY)) { p.scrollTop = p.scrollHeight; break; } }));
      await step('20-shop-item', '交換所(道具の段)', async () => { await page.locator('[data-assistant-life-shop="item"]').last().click({ timeout: 3000 }); await page.waitForTimeout(1200); });
    } catch (e) { lost.push(`${T} 通しの途中で止まった(${String(e.message || e).split('\n')[0].slice(0, 80)})`); }
    await ctx.close();
  }
  await browser.close(); server.close();
  console.log('場面 | 見える字 | 10px未満 | 10〜11px | 押せる所 | 44px未満 | 縦の長さ');
  for (const r of rows) console.log(`${r.label} | ${r.m.chars} | ${r.m.tiny} | ${r.m.small} | ${r.m.taps} | ${r.m.t44} | ${r.m.pages}`);
  if (SHOTS) console.log(`止め絵: ${path.relative(root, shotDir)}/(${rows.length}枚)`);
  for (const x of lost) console.log(`たどり着けない: ${x}`);
  for (const x of [...new Set(errors)].slice(0, 5)) console.log(`ページのエラー: ${x.slice(0, 140)}`);
  const ok = !lost.length && !errors.length;
  console.log(ok ? `OK: 贈る流れ ${rows.length}場面をたどれました` : `NG: たどり着けない ${lost.length}・エラー ${errors.length}`);
  process.exit(ok ? 0 : 1);
})();
