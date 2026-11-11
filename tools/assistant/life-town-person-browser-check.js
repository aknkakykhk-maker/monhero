// 助手ライフの「町の人」(助手になる前の助手・56-assistant-life-partner.jsx / docs/progress/assistant-unlock/DESIGN.md の E)を実ブラウザで確かめる
//   開発部の口(assistantPartnerOkNow・assistantPartnerProgressNow)は、ページの中で仮に入れる(きき・ドラ以外は町の人。ももすけは 12/40・カード未所持)
//   ① 口が無い(今の人)なら、町の人の印は1つも出ない
//   ② 家: 町の人の部屋に「町の人」の札・押すと部屋ではなく小窓(一言の欄・あと何回・話す/贈る/部屋は🔒)
//   ③ 声をかける・贈るの一覧に町の人が出ない
//   ④ 町: 町の人の名前に「・町の人」・場所のシートでは「🔒 町の人」だけ(部屋へ等は出ない)
//   ⑤ 縦 390×844・横 844×390 で小窓が画面の横にはみ出さない・実行時エラーなし
//   node tools/assistant/life-town-person-browser-check.js            検査
//   node tools/assistant/life-town-person-browser-check.js --shots    止め絵も撮る(docs/progress/assistant-life/town-person/)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..'), PORT = 9272;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-life/town-person');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const PARTNERS = ['kiki', 'dra'];

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
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  // 町の人がいる形(ひとりの助手と組をいろいろに)
  const MIX = { groups: [{ ids: ['kiki', 'dra'], doing: 'snack', place: 'cafe' }, { ids: ['mua', 'kyuko'], doing: 'walk', place: 'plaza' }],
    solo: { momosuke: { doing: 'idle', place: 'home', reason: 'lonely' }, atsu: { doing: 'idle', place: 'home' }, sorashido: { doing: 'cards', place: 'cardroom' }, erubin: { doing: 'read', place: 'library' } } };
  const open = async (v, hooks) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    if (hooks) await page.addInitScript((ok) => {
      window.assistantPartnerOkNow = (id) => ok.includes(id);
      window.assistantPartnerProgressNow = (id) => ({ count: id === 'momosuke' ? 12 : 3, need: 40, cardName: id === 'momosuke' ? 'ももすけのおねだり' : '', cardOwned: id !== 'momosuke' });
    }, PARTNERS);
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
  const overflow = (page, sel) => page.evaluate((s) => { const W = window.innerWidth; return [...document.querySelectorAll(`${s} *`)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).length; }, sel);
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}.jpg`), type: 'jpeg', quality: 82 }); };
  try {
    {
      const page = await open({ name: '口なし', w: 390, h: 844 }, false);
      const n = await page.evaluate(() => document.querySelectorAll('[data-assistant-life-room-town],[data-assistant-life-map-town]').length);
      check('① 口が無い(今の人)なら町の人の印は出ない', n === 0, String(n));
      await page.close();
    }
    for (const v of [{ name: '縦', w: 390, h: 844, tag: 'tate' }, { name: '横', w: 844, h: 390, tag: 'yoko' }]) {
      const T = `[${v.name}] `;
      const page = await open(v, true);
      const towns = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-room-town]')].map(e => e.getAttribute('data-assistant-life-room-town')));
      check(`${T}② 家: 町の人の部屋に「町の人」の札(きき・ドラには無い)`, towns.includes('momosuke') && !towns.includes('kiki') && !towns.includes('dra'), towns.join(','));
      await shot(page, `house-${v.tag}`);
      await page.locator('[data-assistant-life-room="momosuke"]').click(); await page.waitForTimeout(700);
      const card = await page.evaluate(() => {
        const c = document.querySelector('[data-assistant-life-town-person]');
        return { id: c && c.getAttribute('data-assistant-life-town-person'), room: !!document.querySelector('[data-assistant-life-room-sheet],[data-assistant-life-roomview]'),
          progress: c && (c.querySelector('[data-assistant-life-town-progress]') || {}).getAttribute ? c.querySelector('[data-assistant-life-town-progress]').getAttribute('data-assistant-life-town-progress') : '',
          locks: c ? [...c.querySelectorAll('[data-assistant-life-town-lock]')].filter(b => b.disabled).length : 0, text: c ? c.textContent : '' };
      });
      check(`${T}② 町の人の部屋を押すと、部屋ではなく小窓(あと何回・話す/贈る/部屋は🔒)`, card.id === 'momosuke' && card.progress === '12/40' && card.locks === 3 && /ももすけのおねだり/.test(card.text) && /ダイヤショップ/.test(card.text), JSON.stringify({ ...card, text: card.text.slice(0, 80) }));
      check(`${T}⑤ 小窓が画面の横にはみ出さない`, (await overflow(page, '[data-assistant-life-town-person]')) === 0);
      await shot(page, `card-${v.tag}`);
      await page.locator('[data-assistant-life-town-close]').click(); await page.waitForTimeout(300);
      // ③ 声をかける・贈る
      await page.locator('[data-assistant-life-today-act="call"]').click().catch(() => {}); await page.waitForTimeout(500);
      const callIds = await page.evaluate(() => { const p = document.querySelector('[data-assistant-life-call-picker]'); return p ? p.textContent : ''; });
      check(`${T}③ 声をかけるの一覧に町の人(ももすけ・あつ)が出ない`, !/ももすけ|あつ/.test(callIds), callIds.slice(0, 80));
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { const b = [...document.querySelectorAll('[data-assistant-life-call-picker] button')].find(x => /閉じる|とじる|やめる|✕/.test(x.textContent)); if (b) b.click(); else { const p = document.querySelector('[data-assistant-life-call-picker]'); if (p) p.click(); } });
      await page.waitForTimeout(300);
      await page.locator('[data-assistant-life-today-act="give"]').click().catch(() => {}); await page.waitForTimeout(600);
      const give = await page.evaluate(() => ({ solo: [...document.querySelectorAll('[data-assistant-life-give-who-solo]')].map(e => e.getAttribute('data-assistant-life-give-who-solo')), pair: [...document.querySelectorAll('[data-assistant-life-give-who-pair]')].map(e => e.getAttribute('data-assistant-life-give-who-pair')) }));
      check(`${T}③ 贈るの一覧は助手だけ(町の人を含む組・1人は出ない)`, give.solo.every(x => ['kiki', 'dra'].includes(x)) && give.pair.every(p => p.split('-').every(x => ['kiki', 'dra'].includes(x))), JSON.stringify(give));
      await page.close();
      // ④ 町
      const p2 = await open(v, true);
      await p2.locator('[data-assistant-life-icon="where"]').click(); await p2.waitForTimeout(1200);
      const names = await p2.evaluate(() => [...document.querySelectorAll('[data-assistant-life-map-name]')].map(e => e.textContent));
      check(`${T}④ 町: 町の人の名前に「・町の人」`, names.some(t => /町の人/.test(t)) && !names.some(t => /きき.*町の人|ドラ.*町の人/.test(t)), names.join(' / '));
      await shot(p2, `map-${v.tag}`);
      const who = p2.locator('[data-assistant-life-map-who="mua"]').first();
      if (await who.count()) {
        await who.click(); await p2.waitForTimeout(600);
        const acts = await p2.evaluate(() => { const r = document.querySelector('[data-assistant-life-map-sheet-who="mua"]'); return r ? [...r.querySelectorAll('[data-assistant-life-map-act]')].map(b => b.getAttribute('data-assistant-life-map-act')) : null; });
        check(`${T}④ 場所のシート: 町の人は「🔒 町の人」だけ`, Array.isArray(acts) && acts.length === 1 && acts[0] === 'town', JSON.stringify(acts));
        await shot(p2, `map-sheet-${v.tag}`);
      } else check(`${T}④ 町にみゅあがいる`, false);
      await p2.close();
    }
  } catch (e) { check('最後まで動く', false, e.message.split('\n')[0]); }
  check('⑤ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed} 件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
