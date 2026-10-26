// MFバトルカードのランキングの改善(2026-10-26 社長「全部入れる」)を、実際のブラウザで確かめる。Supabase は偽物(読む表は決めた行を返す)。
//
//   node tools/card/card-rank-improve-browser-check.js
//
// 見るもの
//   ① 同じ数は同じ順位(5・5・3 → 🥇・🥇・3位ではなく 1・1・3)。メダルも順位で付く
//   ② 「あなたの記録」に自分の順位が出る(一覧に入っていなくても、自分より多い人の数 + 1)
//   ③ 右上の「更新」で読み直す(表へもう一度読みに行く)
//   ④ 開いたとき、送れていない記録があれば自動で送る。送れなかったら知らせと「送る」が出て、押して送れたら消える
//   ⑤ マルチのタブも同じ見た目(あなたの強さの欄・同じ点数は同じ順位・メダル)
//   ⑥ 本物へは何も送らない。実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8949;
const SELF = 'self-0000-0000-0000-000000000001';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 週の鍵(日本時間の月曜 5:00 区切り。82 の cardWeekKeyJst と同じ考え。ずれても ② は「通算」で見る)
const row = (o) => ({ user_name: 'あ', breeder_id: null, icon: '🐣', profile_frame: null, week_key: '2026-10-26', wins_easy: 0, wins_normal: 0, wins_hard: 0, wins_expert: 0, wins_master: 0,
  week_wins_easy: 0, week_wins_normal: 0, week_wins_hard: 0, week_wins_expert: 0, week_wins_master: 0, best_streak: 0, current_streak: 0, dex_count: 0, dex_total: 451, updated_at: '2026-10-26T00:00:00Z', ...o });
const V2 = [row({ user_name: 'たろう', breeder_id: 'b-taro-0001', wins_normal: 5 }), row({ user_name: 'はなこ', breeder_id: 'b-hana-0001', wins_normal: 5 }), row({ user_name: 'じろう', breeder_id: 'b-jiro-0001', wins_normal: 3 })];
const PVP = [
  { breeder_id: 'b-taro-0001', user_name: 'たろう', icon: '🐣', profile_frame: null, rating: 1530, wins: 2, loses: 0 },
  { breeder_id: SELF, user_name: '検査ブリーダー', icon: '🐣', profile_frame: null, rating: 1516, wins: 1, loses: 0 },
  { breeder_id: 'b-hana-0001', user_name: 'はなこ', icon: '🐣', profile_frame: null, rating: 1516, wins: 1, loses: 0 },
];

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  const calls = [];
  let postFails = true; // ④ はじめは送るのに失敗させる
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, async (r) => {
      const req = r.request();
      const url = req.url();
      const m = url.match(/\/rest\/v1\/([a-z0-9_]+)/);
      const table = m ? m[1] : '';
      calls.push(`${req.method()} ${table}`);
      const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (req.method() !== 'GET') {
        if (/card_battle_ranks/.test(table)) return postFails ? json(500, { message: 'わざと失敗' }) : json(201, []);
        return json(201, []);
      }
      if (table === 'card_battle_ranks_v2') {
        // 「自分より多い人」の問い合わせ(select=breeder_id,user_name)にも、同じ行から答える
        const gt = url.match(/wins_normal=gt\.(\d+)/);
        const rows = gt ? V2.filter((x) => x.wins_normal > Number(gt[1])) : V2;
        return json(200, /select=breeder_id,user_name&/.test(url) ? rows.map((x) => ({ breeder_id: x.breeder_id, user_name: x.user_name })) : rows);
      }
      if (table === 'card_battle_ranks') return json(200, []);
      if (table === 'card_battle_pvp_ratings') {
        if (/breeder_id=eq\./.test(url)) return json(200, PVP.filter((x) => url.includes(encodeURIComponent(x.breeder_id))));
        return json(200, PVP);
      }
      return r.continue();
    });
    // 自動操作のブラウザの書き込み止め(26 の sbAutomationBlocked)を外し、この偽物へ届くようにする
    await ctx.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await ctx.addInitScript((self) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
      s('mh_breeder_id_v1', self);
    }, SELF);
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const sleep = (ms) => page.waitForTimeout(ms);
    const dismiss = async () => {
      for (let i = 0; i < 8; i++) {
        const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await sleep(250);
      }
    };
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' });
    const home = page.locator('[data-home-card-battle]');
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
    for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
    await home.click();
    await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
    await sleep(600); await dismiss();
    if (await page.locator('[data-card-top="starter"]').count()) {
      await page.locator('[data-card-kit="speed"]').click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: /トップへ/ }).first().click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
    }
    // 自分の記録: 通算 NORMAL 2勝(一覧の3人はみな2より多い → 一覧が上限に満たないので一覧から数えて4位)
    await page.evaluate(() => {
      const r = JSON.parse(localStorage.getItem('mh_card_record_v1') || 'null') || {};
      r.rank = { total: { easy: 0, normal: 2, hard: 0, expert: 0, master: 0 }, week: { key: '2000-01-03', wins: { easy: 0, normal: 0, hard: 0, expert: 0, master: 0 } }, streak: { now: 0, best: 2 } };
      localStorage.setItem('mh_card_record_v1', JSON.stringify(r));
      localStorage.removeItem('mh_card_rank_sync_v1');
    });
    // 保存を読み直すため、いったん HOME へ出て入り直す
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
    for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
    await home.click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await sleep(500); await dismiss();

    await page.locator('[data-card-ranking-open]').click();
    await page.locator('[data-card-ranking]').waitFor({ timeout: 10000 });
    // ④ 開いたときに自動で送り、失敗したら知らせ
    await page.locator('[data-card-ranking-pending]').waitFor({ timeout: 10000 }).catch(() => {});
    check('④ 送れていない記録を開いたときに自動で送る(新しい表へ)', calls.some((c) => c === 'POST card_battle_ranks_v2'), calls.filter((c) => !c.startsWith('GET')).join(','));
    check('④ 送れなかったら「まだ送れていません」と「送る」が出る', (await page.locator('[data-card-ranking-pending-send]').count()) === 1);
    postFails = false;
    await page.locator('[data-card-ranking-pending-send]').click();
    await sleep(1200);
    check('④ 「送る」で送れたら、知らせが消える', (await page.locator('[data-card-ranking-pending]').count()) === 0);

    await page.locator('[data-card-ranking-period="total"]').click();
    await page.locator('[data-card-ranking-level="normal"]').click();
    await page.locator('[data-card-ranking-row]').first().waitFor({ timeout: 10000 });
    await sleep(600);
    const places = await page.locator('[data-card-ranking-row]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-card-ranking-place'), e.querySelector('b').textContent]));
    check('① 同じ数は同じ順位(5・5・3 → 1・1・3)、メダルも順位で付く', JSON.stringify(places) === JSON.stringify([['1', '🥇'], ['1', '🥇'], ['3', '🥉']]), JSON.stringify(places));
    const minePlace = await page.locator('[data-card-ranking-mine-place]').innerText().catch(() => '');
    check('② 「あなたの記録」に自分の順位が出る(自分より多い3人 → 4位)', minePlace === '4位', minePlace);
    const before = calls.filter((c) => c === 'GET card_battle_ranks_v2').length;
    await page.locator('[data-card-ranking-refresh]').click();
    await sleep(1200);
    check('③ 「更新」で表へもう一度読みに行く', calls.filter((c) => c === 'GET card_battle_ranks_v2').length > before);

    // ⑤ マルチ
    await page.locator('[data-card-ranking-tab="multi"]').click();
    await page.locator('[data-card-pvp-rank="ready"]').waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(800);
    const pvp = await page.locator('[data-card-pvp-rank="ready"] li').evaluateAll((els) => els.map((e) => [e.getAttribute('data-card-pvp-rank-place'), e.querySelector('b').textContent]));
    check('⑤ マルチも同じ点数は同じ順位・メダル(1530・1516・1516 → 1・2・2)', JSON.stringify(pvp) === JSON.stringify([['1', '🥇'], ['2', '🥈'], ['2', '🥈']]), JSON.stringify(pvp));
    const mineBox = (await page.locator('[data-card-pvp-rank-mine]').innerText().catch(() => '')).replace(/\s+/g, ' ');
    check('⑤ マルチに「あなたの強さ」(順位・勝ち負け・点数)が出る', /あなたの強さ/.test(mineBox) && /2位/.test(mineBox) && /1勝0敗/.test(mineBox) && /1516/.test(mineBox), mineBox);
    check('⑥ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
