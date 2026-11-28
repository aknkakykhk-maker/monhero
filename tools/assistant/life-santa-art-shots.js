// クリスマスの助手の絵(サンタ服)を、iPhone 縦(倍率3)の本物の画面で撮る・画面に出る大きさを測る(助手部ナカヨシ・2026-11-28 r1126-095)。
//   node tools/assistant/life-santa-art-shots.js <出す先のフォルダ> [--who mua,kiki] [--measure]
//   撮るもの: HOME(その助手を選んでサンタ服を着せる)・助手ライフの部屋・着替えの窓・その助手の顔の吹き出し
//   --measure … 助手の絵(images/assistant/)ごとに、実際の画素 ÷ (画面に出る大きさ × 3) を measure.json へ(100% 以上なら足りている)
// ゲーム本体は変えない。保存はページの中だけ(新しいブラウザの中)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9311;
const out = path.resolve(process.argv[2] || 'docs/progress/assistant-art/xmas-quality-2026-11-28/shots');
const whoArg = process.argv.indexOf('--who');
const WHO = whoArg > 0 ? process.argv[whoArg + 1].split(',') : ['mua', 'kiki', 'momosuke', 'sorashido', 'atsu', 'kyuko', 'erubin', 'dra'];
const COSTUME = { mua: 'mua_santa_2026', kiki: 'kiki_santa_2026', momosuke: 'momosuke_santa_2026', sorashido: 'sorashido_santa_2026', atsu: 'atsu_santa_2026', kyuko: 'kyuko_santa_2026', erubin: 'erubin_santa_2026', dra: 'dra_santa_2026' };

(async () => {
  const { chromium, devices } = require('playwright');
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const measure = {};
  // 画面に出ている助手の絵(img と背景の絵)を拾う
  const probe = (page, tag) => page.evaluate((tag) => {
    const rows = [];
    const take = (el, url, nat) => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return;
      rows.push({ tag, url: url.replace(/^.*?images\/assistant\//, '').split('?')[0], cssW: Math.round(r.width), cssH: Math.round(r.height), natW: nat[0], natH: nat[1] });
    };
    for (const im of document.querySelectorAll('img')) if (/images\/assistant\//.test(im.currentSrc || im.src) && im.naturalWidth) {
      // object-fit: contain のときは絵の見えている大きさ
      const r = im.getBoundingClientRect(), fit = getComputedStyle(im).objectFit;
      let s = 1;
      if (fit === 'contain') s = Math.min(r.width / im.naturalWidth, r.height / im.naturalHeight); else if (fit === 'cover') s = Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight);
      else s = Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight);
      rows.push({ tag, url: (im.currentSrc || im.src).replace(/^.*?images\/assistant\//, '').split('?')[0], cssW: Math.round(r.width), cssH: Math.round(r.height), natW: im.naturalWidth, natH: im.naturalHeight, ratio: +(1 / (s * 3)).toFixed(2) });
    }
    return rows;
  }, tag);
  try {
    for (const who of WHO) {
      const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 3 });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.clock.setFixedTime(new Date('2026-12-01T12:40:00Z'));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; window.__mhLifeUiNoSeed = true; window.__mhKeepRoomFold = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true });
      await page.addInitScript(({ who, cos }) => {
        if (localStorage.getItem('mh_check_santa_seeded')) return;
        localStorage.setItem('mh_check_santa_seeded', '1');
        localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify(Object.values(cos)));
        localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify(cos));
        if (who !== 'dra') localStorage.setItem('mh_assistant_selected_v1', JSON.stringify(who));
      }, { who, cos: COSTUME });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await finishTalk(page);
      for (let k = 0; k < 3 && await page.locator('[data-home-screen-guide]').count(); k++) { await page.locator('[data-home-screen-guide] button').first().tap({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(400); }
      await page.waitForTimeout(1500);
      if (who !== 'dra') {
        await page.screenshot({ path: path.join(out, `${who}-1-home.png`) });
        (measure[who] = measure[who] || []).push(...await probe(page, 'home'));
        // 顔を押す → 吹き出し(立ち絵・顔)。そこから話す画面
        await page.locator('[data-home-assistant-toggle]').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, `${who}-1b-home-talk.png`) });
        (measure[who] = measure[who] || []).push(...await probe(page, 'home-talk'));
        if (await page.locator('[data-home-assistant-chat]').count()) {
          await page.locator('[data-home-assistant-chat]').first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(out, `${who}-1c-chat.png`) });
          (measure[who] = measure[who] || []).push(...await probe(page, 'chat'));
          await page.locator('[data-assistant-chat-close]').first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
        // モンヒロバトルの入口(立ち絵がいちばん大きく出る場面)。開いたら見て、ページを開き直して次へ
        await page.getByRole('button', { name: '閉じる' }).first().click({ timeout: 1500 }).catch(() => {});
        await page.locator('[data-home-fac="battle"]').first().click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(2200);
        await page.getByRole('button', { name: /閉じる|OK/ }).first().click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(out, `${who}-4-battle-entry.png`) });
        (measure[who] = measure[who] || []).push(...await probe(page, 'battle-entry'));
        await page.reload({ waitUntil: 'domcontentloaded' }); await toHome(page); await finishTalk(page);
      }
      // 助手ライフの部屋
      // その助手は家にいることに(ページの中だけ。部屋に全身の絵が出る)
      await page.evaluate((who) => { try { const l = ASSISTANT_LIFE_STORE.state.life; const groups = (l.groups || []).map(g => ({ ...g, ids: g.ids.filter(x => x !== who) })).filter(g => g.ids.length > 1); const solo = { ...(l.solo || {}) }; solo[who] = { doing: 'idle', place: 'home' }; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups, solo } }); } catch (_) {} }, who);
      await page.waitForTimeout(300);
      await page.evaluate((who) => { try { ASSISTANT_LIFE_STORE.set({ open: true, focus: who }); } catch (_) {} }, who);
      await page.locator(`[data-assistant-life-room-sheet="${who}"]`).waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(out, `${who}-2-life-room.png`) });
      (measure[who] = measure[who] || []).push(...await probe(page, 'life-room'));
      // 修行を見る(立ち絵がいちばん大きく出る場面のひとつ)
      if (await page.locator('[data-assistant-life-room-do="train-watch"]').count()) {
        await page.locator('[data-assistant-life-room-do="train-watch"]').first().click({ timeout: 3000 }).catch(() => {});
        await page.locator('.ambw-root').waitFor({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, `${who}-3-watch.png`) });
        (measure[who] = measure[who] || []).push(...await probe(page, 'watch'));
      }
      if (errors.length) console.log(who, 'エラー:', errors.slice(0, 2).join(' / '));
      await ctx.close();
      console.log(who, '撮った');
    }
  } finally { await browser.close(); server.close(); }
  if (process.argv.includes('--measure')) fs.writeFileSync(path.join(out, 'measure.json'), JSON.stringify(measure, null, 1));
})().catch(e => { console.log('NG: 例外', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
