// 助手紹介(2026-11-11 社長・ナカヨシ18。56-assistant-life-profile.jsx / docs/progress/assistant-life/profile/PLAN.md)を実ブラウザで確かめる
//   ① 公開の印 assistantLifeProfile が偽なら、下のタブに「📖 紹介」が出ない
//   ② 真なら出る。タブは横にはみ出さない・高さ40px以上
//   ③ 一覧: 「会った助手 N/M」(M は公開済みの助手の数)・会っていない助手は点線の「？」で押せない(名前も絵も出ない)
//   ④ 1人ずつの紹介: 4つの欄(人となり・好き苦手・きずな・台詞)・贈って分かった好みだけ名前が出る・まだのは「？」・台詞の「もう1つ聞く」で文が変わる
//   ⑤ NEW: 見た時点より分かった好みが増えた助手に付き、開くと消える
//   ⑥ 縦 390×844・横 844×390 で、紹介が画面の横にはみ出さない・実行時エラーなし
//   node tools/assistant/life-profile-browser-check.js            検査
//   node tools/assistant/life-profile-browser-check.js --shots    止め絵も撮る(docs/progress/assistant-life/profile/real/)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..'), PORT = 9271;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-life/profile/real');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

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
  const storyIds = STORY_IDS;
  const open = async (v, flag) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => {
      window.__mhSupabaseStubbed = true;
      localStorage.setItem('mh_assistant_life_ui_v2', 'true');
      if (localStorage.getItem('mh_breeder_name') === null) {
        // きき: 仲良し度 Lv8 ぐらい・好み(お茶=好き・おにぎり=苦手・観葉植物=好き)が分かっている。NEW を見るため、控えは 0
        localStorage.setItem('mh_assistant_bond_kiki_v1', JSON.stringify({ points: 2400 }));
        localStorage.setItem('mh_assistant_bond_rewards_v2', JSON.stringify({ kiki: [2, 3, 4, 5, 6, 7, 8] }));
        localStorage.setItem('mh_assistant_life_likes_v1', JSON.stringify({ known: { kiki: { tea: 'gift', flower: 'gift', onigiri: 'gift', plant: 'gift' } }, told: [] }));
        localStorage.setItem('mh_assistant_life_profile_seen_v1', JSON.stringify({ kiki: { n: 0 } }));
      }
    });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript((f) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeProfile = f; clearInterval(t); } } catch {} }, 2); }, flag);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.waitForTimeout(500); await finishTalk(page);
    // 会っていない助手(えるびん)の加入のお話が流れたら飛ばす(このあとも会っていない扱いのまま見るため、見たことにはしない)
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^(はい|スキップする|OK)$/ }).first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(400); }
    await toHome(page); await finishTalk(page);
    if (process.env.DBG) await page.screenshot({ path: process.env.DBG });
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const tabs = (page) => page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-icons] [data-assistant-life-icon]')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute('data-assistant-life-icon')));
  const overflow = (page, sel) => page.evaluate((s) => { const W = window.innerWidth; return [...document.querySelectorAll(`${s} *`)].filter(e => { if (e.closest('[data-assistant-life-profile-hero]')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > W + 1 || r.left < -1); }).slice(0, 3).map(e => `${e.tagName}.${(e.className || '').toString().slice(0, 30)} ${Math.round(e.getBoundingClientRect().right)}`); }, sel);
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}.jpg`), type: 'jpeg', quality: 82 }); };
  try {
    // ① 偽
    {
      const page = await open({ name: '偽', w: 390, h: 844 }, false);
      check('① 印が偽なら「📖 紹介」のタブが出ない', !(await tabs(page)).includes('profile'), (await tabs(page)).join(','));
      await page.close();
    }
    for (const v of [{ name: '縦', w: 390, h: 844, tag: 'tate' }, { name: '横', w: 844, h: 390, tag: 'yoko' }]) {
      const T = `[${v.name}] `;
      const page = await open(v, true);
      const t = await tabs(page);
      check(`${T}② 印が真なら「📖 紹介」のタブが出る(きずなの次)`, t.includes('profile') && t.indexOf('profile') === t.indexOf('friends') + 1, t.join(','));
      const bad = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-icons] button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.height < 40 || r.right > window.innerWidth + 1); }).length);
      check(`${T}② タブは横にはみ出さず高さ40px以上`, bad === 0, String(bad));
      await page.locator('[data-assistant-life-icon="profile"]').click(); await page.waitForTimeout(700);
      const list = await page.evaluate(() => {
        const roster = (typeof assistantLifeProfileRoster === 'function' ? assistantLifeProfileRoster() : []).map(w => w.id);
        const cnt = document.querySelector('[data-assistant-life-profile-count]');
        const unmet = [...document.querySelectorAll('[data-assistant-life-profile-card="unmet"]')];
        return { roster, count: cnt ? cnt.getAttribute('data-assistant-life-profile-count') : '', unmet: unmet.length, unmetBtn: unmet.filter(e => e.tagName === 'BUTTON' || e.querySelector('button,img')).length,
          unmetText: unmet.map(e => e.textContent).join('|'), cards: [...document.querySelectorAll('button[data-assistant-life-profile-card]')].map(e => e.getAttribute('data-assistant-life-profile-card')),
          newKiki: !!document.querySelector('[data-assistant-life-profile-card="kiki"] [data-assistant-life-profile-new]') };
      });
      check(`${T}③ 「会った助手 N/M」の M は公開済みの助手の数`, list.count === `${list.cards.length}/${list.roster.length}`, `${list.count} / 公開済み ${list.roster.length}`);
      // 会っていない助手: 加入のお話を見ていない人を作るとお話が自動で流れるので、同じ一覧の部品を「えるびんにだけ会っていない」形でその場に描いて見る
      const um = await page.evaluate(async () => {
        const d = document.createElement('div'); d.id = '__mh_unmet'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;overflow:auto';
        document.body.appendChild(d);
        const ids = assistantLifeProfileRoster().map(w => w.id).filter(x => x !== 'erubin');
        ReactDOM.createRoot(d).render(React.createElement(AssistantLifeProfilePage, { metIds: ids, land: window.innerWidth > window.innerHeight }));
        await new Promise(r => setTimeout(r, 500));
        const unmet = [...d.querySelectorAll('[data-assistant-life-profile-card="unmet"]')];
        const cnt = d.querySelector('[data-assistant-life-profile-count]');
        return { count: cnt ? cnt.getAttribute('data-assistant-life-profile-count') : '', unmet: unmet.length, bad: unmet.filter(e => e.tagName === 'BUTTON' || e.querySelector('button,img')).length, text: unmet.map(e => e.textContent).join('|'), erubinCard: !!d.querySelector('[data-assistant-life-profile-card="erubin"]') };
      });
      check(`${T}③ 会っていない助手は点線の「？」で、押せず名前も絵も出ない(会った助手 7/8)`, um.count === '7/8' && um.unmet === 1 && um.bad === 0 && !/えるびん/.test(um.text) && !um.erubinCard, JSON.stringify(um));
      await shot(page, `list-${v.tag}-unmet`);
      await page.evaluate(() => { const d = document.getElementById('__mh_unmet'); if (d) d.remove(); });
      check(`${T}⑤ 好みが増えた助手(きき)に NEW`, list.newKiki);
      check(`${T}⑥ 一覧が画面の横にはみ出さない`, (await overflow(page, '[data-assistant-life-profile-list]')).length === 0, (await overflow(page, '[data-assistant-life-profile-list]')).join(' / '));
      await shot(page, `list-${v.tag}`);
      await page.locator('[data-assistant-life-profile-card="kiki"]').click(); await page.waitForTimeout(800);
      const sheet = await page.evaluate(() => {
        const s = document.querySelector('[data-assistant-life-profile="kiki"]');
        if (!s) return null;
        const likes = [...s.querySelectorAll('[data-assistant-life-profile-like]')];
        return { secs: [...s.querySelectorAll('[data-assistant-life-profile-sec]')].map(e => e.getAttribute('data-assistant-life-profile-sec')),
          shown: likes.filter(e => e.getAttribute('data-assistant-life-profile-like') !== 'unknown').map(e => e.textContent.trim()),
          unknown: likes.filter(e => e.getAttribute('data-assistant-life-profile-like') === 'unknown').length,
          line: (s.querySelector('[data-assistant-life-profile-voice-line]') || {}).textContent || '', greeting: !!s.querySelector('[data-assistant-life-profile-greeting]'),
          text: s.textContent };
      });
      check(`${T}④ 紹介が開き、4つの欄がそろう`, !!sheet && ['who', 'likes', 'bond', 'voice'].every(k => sheet.secs.includes(k)), sheet ? sheet.secs.join(',') : '開かない');
      check(`${T}④ 分かった好みだけ名前が出て、まだのは「？」`, !!sheet && sheet.shown.length === 4 && sheet.unknown > 0 && sheet.shown.some(x => /ティー/.test(x)), sheet ? `${sheet.shown.join(' / ')} ・ ？${sheet.unknown}` : '');
      check(`${T}④ 仲良し度・ひとこと・台詞が出る`, !!sheet && /仲良し度 Lv8/.test(sheet.text) && sheet.greeting && sheet.line.length > 0 && !/[{}]/.test(sheet.text), sheet ? sheet.line : '');
      check(`${T}⑥ 紹介が画面の横にはみ出さない`, (await overflow(page, '[data-assistant-life-profile]')).length === 0, (await overflow(page, '[data-assistant-life-profile]')).join(' / '));
      await shot(page, `sheet-${v.tag}`);
      if (v.tag === 'tate') {
        await page.locator('[data-assistant-life-profile-sec="bond"]').scrollIntoViewIfNeeded();
        await shot(page, 'sheet-tate-bond');
        const before = (await page.locator('[data-assistant-life-profile-voice-line]').textContent()) || '';
        let changed = false;
        for (let i = 0; i < 4 && !changed; i++) { await page.locator('[data-assistant-life-profile-voice-next]').click(); changed = ((await page.locator('[data-assistant-life-profile-voice-line]').textContent()) || '') !== before; }
        check(`${T}④ 「もう1つ聞く」で台詞が変わる`, changed);
        await page.locator('[data-assistant-life-profile-voice-tab="gift"]').click(); await page.waitForTimeout(200);
        const gl = (await page.locator('[data-assistant-life-profile-voice-line]').textContent()) || '';
        check(`${T}④ 「贈ったとき」に、分かった道具の台詞が出る`, gl.length > 0 && !/贈ると、ここで/.test(gl), gl);
        await page.locator('[data-assistant-life-profile-sec="voice"]').scrollIntoViewIfNeeded();
        await shot(page, 'sheet-tate-voice');
      }
      await page.locator('[data-assistant-life-profile-close]').first().click(); await page.waitForTimeout(500);
      check(`${T}⑤ 開いたあとは NEW が消える`, await page.locator('[data-assistant-life-profile-card="kiki"] [data-assistant-life-profile-new]').count() === 0);
      await page.close();
    }
  } catch (e) { check('最後まで動く', false, e.message.split('\n')[0]); if (process.env.DBG) { const pg = browser.contexts()[0] && browser.contexts()[0].pages().slice(-1)[0]; if (pg) await pg.screenshot({ path: process.env.DBG }).catch(() => {}); } }
  check('⑥ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed} 件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
