// 横向きの低い画面で、お話の上のステージ(ゲストの顔と吹き出し)が、下の窓(セリフ・顔の列・ボタン)と重ならないかを測る(2026-10-27)。
//
//   node tools/boot/story-stage-landscape-browser-check.js
//
// 844×390・667×375 では、上のステージ(画面の高さの13%の位置)が、画面いっぱいに伸びた窓の上に重なり、
// 吹き出しの字とお話の題・顔の列が重なって読めなかった(クラフトくん「遊ぶ人には見づらいので直したい」)。
// ステージの出るお話(ハロウィン・ナイト第2部・きゅうこ登場・ソラシド登場)を全部めくり、
// ステージが出ている行で、ステージと窓が重ならず、ボタンが画面の中にあるかを見る。縦390では、今までどおり重ならないことも見る。
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9215;
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
  const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantSorashido = true; clearInterval(t); } } catch {} }, 2);
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
  const only = [[844, 390], [667, 375], [390, 844]];
  const STORIES = [{ name: 'ハロウィン・ナイト第2部', title: /第2部 ～吠えるカボチャ～/ }, { name: 'きゅうこ登場', title: /きゅうこ登場/ }, { name: 'ソラシド登場', title: /ソラシド登場/ }];
  for (const [w, h] of only) for (const story of STORIES) {
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
      opened = await page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll('[data-event-replay-episodes] button')].find(x => re.test(x.textContent || '')); if (b) { b.click(); return true; } return false; }, story.title.source);
      if (opened) break;
      await page.evaluate(() => document.querySelector('[data-event-replay-back]')?.click());
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    let seen = 0, staged = 0, bad = [];
    for (let i = 0; i < 120; i++) {
      const m = await page.evaluate(() => {
        const sheet = document.querySelector('[data-story-sheet]');
        if (!sheet) return null;
        const s = sheet.getBoundingClientRect();
        const stage = document.querySelector('[data-story-stage]');
        const g = stage ? stage.getBoundingClientRect() : null;
        const btns = [...sheet.querySelectorAll('[data-story-buttons] button')].map((b) => b.getBoundingClientRect());
        const counter = [...sheet.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => /^\d+ \/ \d+/.test(t)) || '';
        return { counter, stage: !!g, overlap: g ? Math.round(g.bottom - s.top) : null, btnOut: btns.some((b) => b.bottom > innerHeight + 1 || b.top < 0), last: [...sheet.querySelectorAll('button')].some((b) => b.textContent.trim() === '閉じる') };
      });
      if (!m) break;
      seen++;
      if (m.stage) { staged++; if (m.overlap > 0 || m.btnOut) bad.push(`${m.counter} 重なり${m.overlap}px${m.btnOut ? '・ボタンが外' : ''}`); }
      if (m.last) break;
      await page.evaluate(() => [...document.querySelectorAll('[data-event-story] button')].find((b) => b.textContent.trim() === '次へ')?.click());
      await page.waitForTimeout(80);
    }
    check(`${w}×${h} ${story.name}: 回想から開いて最後までめくれる`, opened && seen > 10, `${seen}枚`);
    check(`${w}×${h} ${story.name}: 上のステージと窓が重ならず、ボタンが画面の中にある`, staged > 0 && bad.length === 0, bad.length ? `${bad.length}行: ${bad.slice(0, 3).join(' / ')}` : `ステージが出た ${staged}行`);
    check(`${w}×${h} ${story.name}: 例外が出ない`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await page.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
