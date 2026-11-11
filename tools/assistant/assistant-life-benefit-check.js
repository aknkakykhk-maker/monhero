// 助手ライフ(新UI)の「やると何が得か」の見せ方(2026-11-11 社長が B+C と案1 を選んだ・ナカヨシ16)を、実際に開いて確かめる
//   ① B 家のいちばん上に3行(⏰ いま・📅 今日・🌱 次のごほうび)があり、押せる行は44px以上・横にはみ出さない
//   ② 🌱 の行を押すと「きずな」へ進み、先頭に「ごほうびの道のり」(💗 は「あと」の小さい順)がある
//   ③ 案1 初めて開いた人には1枚(3つの文)が出て、見守る札が光る。「わかった」で消え、見た印(mh_assistant_life_guide_seen_v1)が残る
//   ④ 毎日来る人(見た印がある)には1枚は出ない。「❓ 見かた」でいつでも開ける
//   ⑤ 旧UIには足していない ⑥ ページのエラーが出ない
//   --shots [置き場]  縦 390×844・横 844×390・横小 667×375 の止め絵も撮る(既定 docs/progress/assistant-life/benefit/real/)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9274;
const argv = process.argv.slice(2), si = argv.indexOf('--shots');
const SHOTS = si >= 0, shotDir = path.resolve(root, si >= 0 && argv[si + 1] && !argv[si + 1].startsWith('--') ? argv[si + 1] : 'docs/progress/assistant-life/benefit/real');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home', reason: 'lonely' }, kyuko: { doing: 'read', place: 'library' } } };
const VIEWS = [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }, { id: 'yokosmall', name: '横小 667×375', w: 667, h: 375 }];
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
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const open = async (v, v2, first) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript((on) => { window.__mhSupabaseStubbed = true; if (on) localStorage.setItem('mh_assistant_life_ui_v2', 'true'); }, v2);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    if (first) await page.addInitScript(() => { if (localStorage.getItem('mh_check_guide_first') === null) { localStorage.setItem('mh_check_guide_first', '1'); localStorage.removeItem('mh_assistant_life_guide_seen_v1'); } }); // 初めての人: 見た印だけ無くす(道具の案内の窓は出さない)
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const shot = async (page, v, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}-${v.id}.png`) }); };
  for (const v of VIEWS) {
    const T = `[${v.name}] `;
    // 初めて開いた人
    const f = await open(v, true, true);
    const g = await f.evaluate(() => ({ guide: !!document.querySelector('[data-assistant-life-guide]'), items: document.querySelectorAll('[data-assistant-life-guide] li').length,
      glow: !!document.querySelector('[data-assistant-life-today-act="watch"].mhl-glow'), seen: localStorage.getItem('mh_assistant_life_guide_seen_v1'),
      small: [...document.querySelectorAll('[data-assistant-life-guide] button')].filter(b => b.getBoundingClientRect().height < 44).length }));
    check(`${T}③ 初めての人: 1枚(3つの文)・見守る札が光る・まだ見た印は無い`, g.guide && g.items === 3 && g.glow && g.seen === null && g.small === 0, JSON.stringify(g));
    await shot(f, v, '1-first-guide');
    await f.locator('[data-assistant-life-guide-close]').click(); await f.waitForTimeout(400);
    const g2 = await f.evaluate(() => ({ guide: !!document.querySelector('[data-assistant-life-guide]'), glow: !!document.querySelector('.mhl-glow'), seen: localStorage.getItem('mh_assistant_life_guide_seen_v1') }));
    check(`${T}③ 「わかった」で1枚と光が消え、見た印が残る`, !g2.guide && !g2.glow && g2.seen === 'true', JSON.stringify(g2));
    await f.close();
    // 毎日来る人
    const page = await open(v, true, false);
    const b = await page.evaluate(() => {
      const bd = document.querySelector('[data-assistant-life-benefit]'); if (!bd) return null;
      const rows = [...bd.querySelectorAll('[data-assistant-life-benefit-row]')], r = bd.getBoundingClientRect();
      const taps = [...bd.querySelectorAll('button')];
      return { keys: rows.map(x => x.getAttribute('data-assistant-life-benefit-row')), small: taps.filter(x => x.getBoundingClientRect().height < 44).length,
        over: bd.scrollWidth > bd.clientWidth + 1 || r.right > innerWidth + 1 || r.left < -1, guide: !!document.querySelector('[data-assistant-life-guide]'),
        next: (bd.querySelector('[data-assistant-life-benefit-row="next"]') || {}).textContent || '', today: (bd.querySelector('[data-assistant-life-benefit-row="today"]') || {}).textContent || '', h: Math.round(r.height) };
    });
    check(`${T}① 家の上に3行(いま・今日・次)・押せる所は44px以上・はみ出さない`, !!b && ['now', 'today', 'next'].every(k => b.keys.includes(k)) && b.small === 0 && !b.over && !b.guide, JSON.stringify(b));
    check(`${T}① 今日の行に「あと◯回」と上がるもの・次の行に「あと◯」`, !!b && /今\d組|済み|いまは無し/.test(b.today) && /友情Lv/.test(b.today) && /あと/.test(b.next), b ? `${b.today} / ${b.next}` : '');
    await shot(page, v, '2-house-board');
    // ❓ 見かた で1枚をいつでも開ける
    await page.locator('[data-assistant-life-guide-open]').click(); await page.waitForTimeout(300);
    const reopen = await page.evaluate(() => ({ guide: !!document.querySelector('[data-assistant-life-guide]'), glow: !!document.querySelector('.mhl-glow') }));
    check(`${T}④ 「❓ 見かた」で1枚が開く(光りはしない)`, reopen.guide && !reopen.glow, JSON.stringify(reopen));
    await page.locator('[data-assistant-life-guide-close]').click(); await page.waitForTimeout(300);
    // 🌱 → きずな
    await page.locator('[data-assistant-life-benefit-row="next"]').click(); await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const road = document.querySelector('[data-assistant-life-reward-road]'); if (!road) return null;
      const items = [...road.querySelectorAll('[data-assistant-life-reward-item]')];
      const remain = (el) => Number(((el.textContent.match(/あと\s*(\d+)/) || [])[1]));
      const bond = items.filter(x => x.getAttribute('data-assistant-life-reward-item').startsWith('bond-')).map(remain);
      const rect = road.getBoundingClientRect(); const first = document.querySelector('[data-assistant-peer-row],[data-assistant-life-introduce]');
      return { n: items.length, bond, sorted: bond.every((x, i) => i === 0 || bond[i - 1] <= x), small: items.filter(x => x.getBoundingClientRect().height < 44).length, over: rect.right > innerWidth + 1,
        topFirst: !first || rect.top <= first.getBoundingClientRect().top, kinds: [...new Set(items.map(x => x.getAttribute('data-assistant-life-reward-item').split('-')[0]))] };
    });
    check(`${T}② きずなの先頭に「ごほうびの道のり」(💗 は近い順・44px以上・はみ出さない)`, !!r && r.n > 0 && r.bond.length > 0 && r.sorted && r.small === 0 && !r.over && r.topFirst, JSON.stringify(r));
    await shot(page, v, '3-kizuna-road');
    await page.close();
    const old = await open(v, false, false);
    check(`${T}⑤ 旧UIには足していない`, (await old.locator('[data-assistant-life-benefit],[data-assistant-life-guide],[data-assistant-life-reward-road]').count()) === 0);
    await old.close();
  }
  check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
