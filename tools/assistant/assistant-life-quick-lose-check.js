#!/usr/bin/env node
'use strict';
// 助手ライフを開いたまま裏クイックで負けたとき、帯に数秒だけ「😢 負けちゃった…始め直すよ」を出す(2026-11-08 社長「帯に小さく出す」・ナカヨシ8)。
//   node tools/assistant/assistant-life-quick-lose-check.js
//   ① 部品の中: 札は助手ライフの帯(renderLifeQuickRunStrip)の中だけ。出す長さは自動で始め直すまでの間(QUICK_RUN_AUTO_RETRY_MS)と同じ
//   ② 実際の画面(縦 390×844): AUTO設定の難易度を Hell にして助手ライフで回し、負けると帯が「😢 負けちゃった…始め直すよ」(data-life-quick-run-lose="retry")になり、
//      そのあと自動で始め直して札が消える(帯が live に戻る)。回っているあいだは札を出さない。始め直したあと「止める」を押しても前の札が出ない
//   ③ ページのエラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8987;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ① 部品の中(ブラウザを使わない)
{
  const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  const uses = [...app.matchAll(/data-life-quick-run-lose/g)].length;
  const strip = app.slice(app.indexOf('const renderLifeQuickRunStrip'), app.indexOf('const handleRetry'));
  check('① 負けの札は助手ライフの帯の中だけで出す(ほかのモードには出さない)', uses === 1 && /data-life-quick-run-lose/.test(strip), `${uses}か所`);
  check('① 札を出す長さは、自動で始め直すまでの間と同じ', /lifeLoseTimerRef\.current = setTimeout\([^\n]*setLifeLoseNote\(null\); \}, QUICK_RUN_AUTO_RETRY_MS\)/.test(app));
  // 片づけ(return () => clearTimeout)で消すと、4秒のあいだに始め直したとき札が残る(2026-11-08 ミハリ)
  const eff = app.slice(app.indexOf('const [lifeLoseNote'), app.indexOf('// バトル内ではAUTO系を1ボタンで循環する'));
  check('① 札を消すタイマーを、周回の進みが変わったときの片づけで消さない(新しい周回が始まったらすぐ戻す)', !/return \(\) => clearTimeout\(timer\)/.test(eff) && /!p\.finished\) \{ if \(lifeLoseTimerRef\.current \|\| lifeLoseNote\) clearLifeLoseNote\(\)/.test(eff));
}

const seed = () => {
  if (sessionStorage.getItem('__alqlSeeded')) return;
  sessionStorage.setItem('__alqlSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  for (const d of ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell']) put('mh_quick_clears_' + d, 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Hell', autoStart: true } });
  put('mh_gold', 1000);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので②は確かめられません'); process.exit(failed ? 1 : 0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
    const closePopups = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]'));
      if (b) { b.click(); return true; }
      const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
      return false;
    });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {}); await closePopups(); await page.waitForTimeout(500); }
    for (let i = 0; i < 8 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.evaluate(() => assistantLifeOpenScreen()); await page.waitForTimeout(1500);
    // 0.25秒ごとに帯を記録する(最長80秒・負けて始め直すまで)
    const log = [];
    for (let t = 0; t < 320; t++) {
      const x = await page.evaluate(() => { const s = document.querySelector('[data-life-quick-run]'); if (!s) return 'none'; const n = s.querySelector('[data-life-quick-run-lose]');
        return `${s.dataset.lifeQuickRun}|${n ? `${n.dataset.lifeQuickRunLose}:${n.textContent}` : ''}`; });
      if (!log.length || log[log.length - 1].x !== x) log.push({ t: t * 0.25, x });
      const i = log.findIndex(e => /\|retry:/.test(e.x));
      if (i >= 0 && log.slice(i + 1).some(e => /^live\|$/.test(e.x))) break;
      await page.waitForTimeout(250);
    }
    const li = log.findIndex(e => /\|retry:/.test(e.x));
    check('② 負けると帯に「😢 負けちゃった…始め直すよ」が出る', li >= 0 && /😢 負けちゃった…始め直すよ/.test(log[li].x) && /^stopped/.test(log[li].x), JSON.stringify(log.slice(0, 8)));
    const back = li >= 0 ? log.slice(li + 1).find(e => /^live\|$/.test(e.x)) : null;
    check('② 数秒で自動で始め直し、札が消える(帯が live に戻る)', !!back && back.t - log[li].t >= 2.5 && back.t - log[li].t <= 7, back ? `${(back.t - log[li].t).toFixed(2)}秒` : JSON.stringify(log.slice(-4)));
    check('② 回っているあいだは札を出さない', !log.some(e => /^live\|.+/.test(e.x)), JSON.stringify(log.filter(e => /^live\|.+/.test(e.x)).slice(0, 3)));
    // 始め直したあとに「止める」を押しても、前の負けの札が出ない(止めた帯に昔の札が残っていた。2026-11-08 ミハリ)
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
    const stopBtn = page.locator('[data-life-quick-run-stop]');
    let afterStop = 'no-stop';
    if (await stopBtn.count()) {
      await stopBtn.click({ force: true }); await page.waitForTimeout(1200);
      afterStop = await page.evaluate(() => { const s = document.querySelector('[data-life-quick-run]'); const n = s && s.querySelector('[data-life-quick-run-lose]'); return `${s ? s.dataset.lifeQuickRun : 'none'}|${n ? n.textContent : ''}`; });
    }
    check('② 負け→始め直し→「止める」で、前の負けの札が出ない', /^stopped\|$/.test(afterStop), afterStop);
    check('③ ページのエラーが出ない', fatal.length === 0, fatal.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
