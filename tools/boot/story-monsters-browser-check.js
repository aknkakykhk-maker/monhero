// お話の真ん中に出すモンスター(キュービ・オリヒメ)が、窓(セリフの枠・助手の顔の列・ボタン)と重ならないかを、実際に開いて測る(2026-10-27)。
//
//   node tools/boot/story-monsters-browser-check.js
//
// 「推しに会える夜 ～ソラシド登場～」の台本の monsters:[{ id, pose }] で、2体が画面の真ん中に出て動く(社長「この形で作る」)。
// 縦の画面はステージと窓のあいだ、横の低い画面は窓の左右の空きに出す。動き(前に出る・寄る・跳ねる)が終わったところで、
// 2体の枠が窓と重ならないか・はみ出さないか・台本どおりの数と pose で出ているかを、縦390・844×390・667×375で見る。
// 公開の印 assistantSorashido はページの中でだけ立てる(本体の印は偽のまま)。
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9214;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const replaySrc = assistantsSrc.slice(assistantsSrc.indexOf('const EVENT_REPLAYS = ['));
const STORY_IDS = [...replaySrc.matchAll(/\{ id: '([a-z0-9_]+)'/g)].map(m => m[1]).filter(id => id !== 'sorashido_join_2026_10_27');
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
  const only = [[390, 844], [844, 390], [667, 375]];
  for (const [w, h] of only) {
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
      opened = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-replay-episodes] button')].find(x => /ソラシド登場/.test(x.textContent || '')); if (b) { b.click(); return true; } return false; });
      if (opened) break;
      await page.evaluate(() => document.querySelector('[data-event-replay-back]')?.click());
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(600);
    // 台本の monsters を書いた行(あつを解放している人の並び)
    const ctx = {}; require('vm').createContext(ctx);
    require('vm').runInContext(`${assistantsSrc}\nglobalThis.S=ASSISTANT_SORASHIDO_JOIN_STORY;`, ctx);
    const script = ctx.S.filter((l) => l.atsu !== 'without');
    const want = (i) => { for (let k = i; k >= 0; k--) if (Array.isArray(script[k].monsters)) return script[k].monsters.filter((m) => m.pose !== 'hide').map((m) => `${m.id}:${m.pose}`).join(','); return ''; };
    let seen = 0, bad = [], mismatch = [], shownLines = 0;
    for (let i = 0; i < script.length; i++) {
      const counter = await page.evaluate(() => [...document.querySelectorAll('[data-story-sheet] p')].map((p) => p.textContent.trim()).find((t) => /^\d+ \/ \d+/.test(t)) || '');
      if (!counter) break;
      const idx = Number(counter.split('/')[0]) - 1;
      const expect = want(idx);
      if (expect) {
        await page.waitForTimeout(1300);
        const m = await page.evaluate(() => {
          const sheet = document.querySelector('[data-story-sheet]').getBoundingClientRect();
          const mons = [...document.querySelectorAll('[data-story-monster]')];
          const list = mons.map((el) => { const r = el.getBoundingClientRect(); return { id: el.getAttribute('data-story-monster'), pose: el.getAttribute('data-story-pose'), l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width }; });
          const hit = list.filter((x) => x.r > sheet.left + 1 && x.l < sheet.right - 1 && x.b > sheet.top + 1 && x.t < sheet.bottom - 1);
          const out = list.filter((x) => x.l < -1 || x.t < -1 || x.r > innerWidth + 1 || x.b > innerHeight + 1);
          return { got: list.map((x) => `${x.id}:${x.pose}`).join(','), hit: hit.map((x) => x.id), out: out.map((x) => x.id), small: list.filter((x) => x.w < 48).map((x) => x.id) };
        });
        shownLines++;
        if (m.got !== expect) mismatch.push(`${idx + 1}: ${m.got || 'なし'} (台本 ${expect})`);
        if (m.hit.length || m.out.length || m.small.length) bad.push(`${idx + 1}: 重なり[${m.hit}] はみ出し[${m.out}] 小さすぎ[${m.small}]`);
      } else {
        const any = await page.evaluate(() => document.querySelectorAll('[data-story-monster]').length);
        if (any) mismatch.push(`${idx + 1}: 出さない行に ${any}体`);
      }
      seen++;
      const done = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-story] button')].find((x) => x.textContent.trim() === '次へ'); if (b) { b.click(); return false; } return true; });
      if (done) break;
      await page.waitForTimeout(120);
    }
    check(`${w}×${h}: お話を最後までめくれる`, seen >= script.length - 1, `${seen}枚`);
    check(`${w}×${h}: 台本どおりの数と動きで出る(①②は出さない)`, shownLines > 20 && mismatch.length === 0, mismatch.slice(0, 3).join(' / ') || `${shownLines}行で出た`);
    check(`${w}×${h}: 窓(セリフ・顔の列・ボタン)と重ならず、画面からはみ出さない`, shownLines > 0 && bad.length === 0, bad.slice(0, 3).join(' / '));
    check(`${w}×${h}: 例外が出ない`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await page.close();
  }
  await browser.close(); server.close();
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
