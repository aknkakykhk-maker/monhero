// 段階C(2026-11-08 社長 ❶A ❷A・docs/progress/assistant-peer/gifts/STAGE-C-PLAN.md)を、実際に開いて確かめる
//   node tools/assistant/assistant-life-furn-stagec-browser-check.js           検査
//   node tools/assistant/assistant-life-furn-stagec-browser-check.js --shots   止め絵も撮る(docs/progress/assistant-peer/gifts/stagec/built/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   ① 好きな家具を置いた部屋にひとりでいる助手の吹き出しが、その家具のひとこと(ツムギ)になる(❶A)
//   ② 家具をしまった部屋・家具の無い部屋は、今までの吹き出しのまま
//   ③ 遊びに来た助手と部屋の主の家具の掛け合いがあれば、部屋の吹き出しが「◯◯の話をしてる」(❷A)
//   ④ その部屋の「👀 見守る」でその掛け合いが流れる・見守る1回に数える・思い出アルバムに入る
//   ⑤ 縦 390・横 844・🔄横 667 で、家具の吹き出しが部屋からはみ出さない・切れない
//   ⑥ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9255;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/gifts/stagec/built');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 部屋の様子: ドラ・あつ・ソラシドはひとりで家、みゅあの部屋にももすけ(おやつ)、ほかは外
//   家具: ドラ ソファ(好き)・あつ ソファ(好き)は置く/ソラシド 星空の絵(好き)は押し入れ/みゅあ くま(ももすけとの掛け合いがある)
const ROOM = {
  dra: { put: { ceil: null, wall: null, floor: 'sofa' }, kept: [], got: { sofa: '2026-11-08' } },
  atsu: { put: { ceil: null, wall: null, floor: 'sofa' }, kept: [], got: { sofa: '2026-11-08' } },
  sorashido: { put: { ceil: null, wall: null, floor: null }, kept: ['starpic'], got: { starpic: '2026-11-08' } },
  mua: { put: { ceil: null, wall: null, floor: 'bear' }, kept: [], got: { bear: '2026-11-08' } },
};

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: 130 });
    await page.addInitScript((room) => {
      if (localStorage.getItem('mh_check_stagec') !== null) return;
      localStorage.setItem('mh_check_stagec', '1');
      localStorage.setItem('mh_assistant_life_room_v1', JSON.stringify(room));
      const v = JSON.parse(localStorage.getItem('mh_assistant_life_v1') || 'null');
      if (!v) return;
      const home = (d) => ({ doing: d, place: 'home', reason: 'mypace' });
      localStorage.setItem('mh_assistant_life_v1', JSON.stringify({ ...v, groups: [{ ids: ['mua', 'momosuke'], doing: 'snack', place: 'home' }, { ids: ['kiki', 'erubin'], doing: 'snack', place: 'cafe' }],
        solo: { dra: home('idle'), atsu: home('idle'), sorashido: home('idle'), kyuko: { doing: 'read', place: 'library', reason: 'mypace' } } }));
    }, ROOM);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page);
    for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await page.waitForTimeout(800); } }
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(600);
    return page;
  };
  const bub = (page, id) => page.locator(`[data-assistant-life-room="${id}"] [data-assistant-life-room-bub]`).innerText().then(t => t.replace(/\s+/g, '')).catch(() => '');
  const lines = await (async () => { const src = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8'); const m = src.match(/^const ASSISTANT_LIFE_FURNUSE_LINES = Object\.freeze\((.*)\);$/m); return m ? JSON.parse(m[1]) : {}; })();
  try {
    {
      const page = await open(390, 844);
      const dra = await bub(page, 'dra'), atsu = await bub(page, 'atsu');
      check('① ひとりで部屋にいるドラ: ソファのひとこと', dra.includes(lines.dra.sofa.replace(/\s+/g, '')) && dra.includes('🛋'), dra);
      check('① ひとりで部屋にいるあつ: ソファのひとこと', atsu.includes(lines.atsu.sofa.replace(/\s+/g, '')), atsu);
      const sora = await bub(page, 'sorashido');
      check('② 家具を押し入れにしまったソラシドは、今までの吹き出し', !sora.includes(lines.sorashido.starpic.replace(/\s+/g, '')) && /部屋で/.test(sora), sora);
      const mua = await bub(page, 'mua');
      check('③ みゅあの部屋(ももすけが来ている・くまが置いてある): 「🧸 くまの話をしてる」', /🧸くまの話をしてる/.test(mua), mua);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-1-house.png') });
      // ④ 見守る
      const albumBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_peer_v1') || 'null'));
      await page.locator('[data-assistant-life-room="mua"]').click(); await page.waitForTimeout(400);
      await page.locator('[data-assistant-life-room-act="watch"]').click(); await page.waitForTimeout(800);
      const talk = await page.locator('[data-assistant-peer-talk]').first().innerText().catch(() => '');
      check('④ 「👀 見守る」で、くまの掛け合いが流れる', /くま/.test(talk), talk.replace(/\s+/g, ' ').slice(0, 60));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'tate-2-talk.png') });
      await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400);
      const album = await page.evaluate(() => { try { return (ASSISTANT_PEER_STORE.state.album[assistantPeerPairKey('mua', 'momosuke')] || []); } catch { return []; } });
      check('④ 見た掛け合いは思い出アルバムに入る', album.includes('visitfurn-momosuke-mua-bear'), JSON.stringify(album).slice(0, 120));
      const watched = await page.evaluate(() => { try { return (ASSISTANT_LIFE_STORE.state.play.counts || {}).watch || 0; } catch { return -1; } });
      check('④ 見守る1回に数える', watched >= 1, String(watched));
      const inAll = await page.evaluate(() => assistantPeerAllTalks().some(t => t.id === 'visitfurn-momosuke-mua-bear'));
      check('④ アルバムの掛け合いの一覧に入る', inAll);
      void albumBefore;
      await page.close();
    }
    for (const [w, h, tag, file] of [[390, 844, '縦 390', 'tate'], [844, 390, '横 844', 'yoko'], [667, 375, '🔄横 667', 'yoko667']]) {
      const page = await open(w, h);
      const ng = await page.evaluate(() => {
        const out = [];
        for (const id of ['dra', 'atsu', 'mua']) {
          const room = document.querySelector(`[data-assistant-life-room="${id}"]`), b = room && room.querySelector('[data-assistant-life-room-bub]');
          if (!b) { out.push(`${id}: 吹き出しが無い`); continue; }
          const r = room.getBoundingClientRect(), q = b.getBoundingClientRect();
          if (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1) out.push(`${id}: はみ出す`);
          if (b.scrollWidth > b.clientWidth + 1) out.push(`${id}: 切れる`);
        }
        return out;
      });
      check(`⑤ ${tag}: 家具の吹き出しが部屋からはみ出さない・切れない`, ng.length === 0, ng.join(' / '));
      if (SHOTS && w !== 390) await page.screenshot({ path: path.join(shotDir, `${file}-1-house.png`) });
      await page.close();
    }
    check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { console.log('NG: 途中で止まった —', e.message.split('\n').slice(0, 3).join(' ')); failed++; }
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed}件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
