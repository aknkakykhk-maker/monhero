// お話の窓の「スキップ」「次へ」が、横向きの低い画面でもいつも画面の中にあって押せるかを、実際に開いて確かめる(2026-10-27)。
//
//   node tools/boot/story-sheet-buttons-browser-check.js
//
// 844×390 の横向きで、台詞が5行になると下のボタンが画面の外へ出て押せなかった(「物置の古い箱」の38番目。直す前は 65px はみ出した)。
// お話の窓は共通の部品なので、いちばん長い台詞のある「物置の古い箱」を全部めくって、どの台詞でもボタンが画面の中にあり、
// 押した所にボタン自身がある(背面へ抜けない)ことを見る。大きさは 844×390・667×375・縦の 390×844。
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9213;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const replaySrc = assistantsSrc.slice(assistantsSrc.indexOf('const EVENT_REPLAYS = ['));
const STORY_IDS = [...replaySrc.matchAll(/\{ id: '([a-z0-9_]+)'/g)].map(m => m[1]);
const seed = ({ storyIds }) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  for (const k of ['mh_tutorial_seen_v1','mh_battle_tutorial_seen_v1','mh_battle_tutorial_guide_shown_v1','mh_rhythm_tutorial_seen_v1','mh_masu_migrated','mh_kiki_intro_seen_v1','mh_momosuke_intro_seen_v1','mh_tactics_intro_seen_v1','mh_rhythm_hell_story_seen_v1','mh_story_assistant_chat_seen_v1','mh_story_tactics_types_seen_v1','mh_story_card_battle_seen_v1','mh_inherited_unique_level_compensation_v1']) put(k, true);
  put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_assistant_selected_v1', 'mua'); put('mh_rhythm_event_story_v1', storyIds);
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  put('mh_login_bonus_last_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [w, h] of [[844, 390], [667, 375], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(seed, { storyIds: STORY_IDS });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    // タイトル→HOME。窓は閉じる
    for (let i = 0; i < 60; i++) {
      if (await page.locator('.mh-home-player').count()) break;
      await page.getByRole('button', { name: /TAP TO START|トップ画面へ進む/ }).first().click({ timeout: 800 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    for (let i = 0; i < 10; i++) { const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /^(受け取る|閉じる|OK|わかった！?)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); }
    await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /イベント回想/.test(b.textContent || ''))?.click());
    await page.waitForTimeout(800);
    const groups = await page.evaluate(() => [...document.querySelectorAll('[data-event-replay-group]')].map(b => b.getAttribute('data-event-replay-group')));
    let opened = false;
    for (const g of groups) {
      await page.evaluate(id => document.querySelector(`[data-event-replay-group="${id}"]`)?.click(), g);
      await page.waitForTimeout(300);
      opened = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-replay-episodes] button')].find(x => /物置の古い箱/.test(x.textContent || '')); if (b) { b.click(); return true; } return false; });
      if (opened) break;
      await page.evaluate(() => document.querySelector('[data-event-replay-back]')?.click());
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    let worst = { over: -1e9 }, at38 = null, total = 0, miss = null;
    for (let i = 0; i < 80; i++) {
      const m = await page.evaluate(() => {
        const sheet = document.querySelector('[data-story-sheet]');
        if (!sheet) return null;
        const btns = [...sheet.querySelectorAll('button')]; const r = btns.map(b => b.getBoundingClientRect());
        const bottom = Math.max(...r.map(x => x.bottom)), top = Math.min(...r.map(x => x.top));
        const hit = btns.every(b => { const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, Math.min(q.top + q.height / 2, innerHeight - 1)); return e === b || b.contains(e); });
        const counter = [...sheet.querySelectorAll('p')].map(p => p.textContent.trim()).find(t => /^\d+ \/ \d+/.test(t)) || '';
        return { over: Math.round(bottom - innerHeight), top: Math.round(top), hit, counter, labels: btns.map(b => b.textContent.trim()).join('/') };
      });
      if (!m) break;
      total++;
      if (m.over > worst.over) worst = m;
      if (!m.hit && !miss) miss = m;
      if (/^38 \//.test(m.counter)) { at38 = m; }
      if (/閉じる/.test(m.labels)) break;
      await page.evaluate(() => [...document.querySelectorAll('[data-event-story] button')].find(b => b.textContent.trim() === '次へ')?.click());
      await page.waitForTimeout(120);
    }
    check(`${w}×${h}: 回想から「物置の古い箱」を開いて最後までめくれる`, opened && total >= 38, `${total}枚`);
    check(`${w}×${h}: どの台詞でもボタンが画面の中にある`, total > 0 && worst.over <= 0, `いちばん下へ出たのは ${worst.counter} で ${worst.over}px`);
    check(`${w}×${h}: ボタンを押した所にボタン自身がある`, total > 0 && !miss, miss ? `${miss.counter}` : (at38 ? `38番目 ${at38.labels}` : ''));
    check(`${w}×${h}: 例外が出ない`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await page.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
