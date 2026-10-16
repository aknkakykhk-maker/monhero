// デバッグ設定の「確認待ちの試作」と、設定の画面の入口(2026-10-16 社長「デバッグモードがわかりづらい」)を実際のブラウザで確かめる。
//
//   node tools/debug-trials-check.js                  確かめる
//   node tools/debug-trials-check.js --shots <フォルダ>  画面の写しも書き出す(390×844)
//
// 見ること:
//   ・はじめての端末(デバッグ設定を開いたことが無い)では、設定の画面にデバッグ設定の入口が出ない(ふつうのプレイヤーに見せない)
//   ・ヘルプの奥の入口からデバッグ設定を開くと、いちばん上に「確認待ちの試作」があり、DEBUG_TRIALS の全部が NEW つきで並ぶ
//   ・入/切を押すと、試作のキーが書き換わり、「いま 入/切」が変わり、その試作の NEW が外れる
//   ・一度開いたあとは、設定の画面に「🧪 デバッグ設定」が出て、押すとデバッグ設定が開く
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const PORT = 9193;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/81-debug-trials.jsx'), 'utf8');
const trialIds = [...src.matchAll(/\{ id: '([a-z0-9_]+)', added:/g)].map((m) => m[1]);
check('試作の一覧(DEBUG_TRIALS)を読めた', trialIds.length >= 1, trialIds.join(','));
const saveDoc = fs.readFileSync(path.join(root, 'docs/spec/SAVE_DATA.md'), 'utf8');
check('新しいキーが保存データの一覧に載っている', ['mh_debug_entry_v1', 'mh_debug_trials_seen_v1'].every((k) => saveDoc.includes('`' + k + '`')));

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(require('./boot/quiet-boot-seed').quietBootSeed());
    await page.addInitScript(() => { const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); }; put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); window.__mhSupabaseStubbed = true; });
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name) }); };
    const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find((x) => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    for (let i = 0, q = 0; i < 60 && q < 5; i++) { if (await clickText('^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで|次へ)$')) { q = 0; await page.waitForTimeout(300); } else { q++; await page.waitForTimeout(300); } }
    const openSettings = async () => { await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900); };
    const debugLink = () => page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /デバッグ設定/.test(b.textContent) && /確認待ちの試作/.test(b.textContent)));
    await openSettings();
    check('はじめての端末では、設定の画面にデバッグ設定の入口が出ない', !(await debugLink()));
    // ヘルプの奥の入口(名前の無い 💊)から開く
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    await clickText('^💊$'); await page.waitForTimeout(1200);
    const first = await page.evaluate(() => { const panel = document.querySelector('[data-debug-trials]'); const list = panel && panel.parentElement; return { has: !!panel, first: list && list.firstElementChild === panel, rows: [...document.querySelectorAll('[data-debug-trial]')].map((r) => ({ id: r.dataset.debugTrial, on: r.dataset.debugTrialOn, isNew: r.dataset.debugTrialNew === '1' })) }; });
    await shot('debug-trials-1-open.png');
    check('デバッグ設定のいちばん上に「確認待ちの試作」がある', first.has && first.first);
    check('試作が全部並び、どれも NEW つき', first.rows.length === trialIds.length && first.rows.every((r) => r.isNew), JSON.stringify(first.rows));
    const target = first.rows[0] && first.rows[0].id;
    await page.evaluate((id) => document.querySelector(`[data-debug-trial="${id}"] [data-debug-trial-set="on"]`)?.click(), target);
    await page.waitForTimeout(300);
    const after = await page.evaluate((id) => { const r = document.querySelector(`[data-debug-trial="${id}"]`); return { on: r && r.dataset.debugTrialOn, isNew: r && r.dataset.debugTrialNew === '1', state: r && r.querySelector('[data-debug-trial-state]')?.textContent, seen: localStorage.getItem('mh_debug_trials_seen_v1') }; }, target);
    const keyOf = { bgm_light: 'mh_bgm_light_v1', rhythm_floor3d: 'mh_rhythm_floor3d_proto_v1' };
    const stored = await page.evaluate((k) => localStorage.getItem(k), keyOf[target] || '');
    await shot('debug-trials-2-on.png');
    check('入を押すと、試作のキーが書き換わり「いま 入」になる', after.on === '1' && /入/.test(after.state || '') && (!keyOf[target] || stored === 'on'), JSON.stringify({ after, stored }));
    check('押した試作は NEW が外れる', after.isNew === false && String(after.seen).includes(target));
    await page.evaluate((id) => document.querySelector(`[data-debug-trial="${id}"] [data-debug-trial-set="off"]`)?.click(), target);
    await page.waitForTimeout(300);
    const offAgain = await page.evaluate((k) => localStorage.getItem(k), keyOf[target] || '');
    check('切を押すと、キーを消して元に戻る', offAgain === null);
    // 一度開いたので、設定の画面に入口が出る
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.querySelector('svg') && /p-3/.test(x.className)); b?.click(); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /わかった！冒険に戻る/.test(x.textContent)); b?.click(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /設定へ戻る|戻る/.test(x.getAttribute('aria-label') || '')); });
    // ホームから設定を開き直す
    await page.evaluate(() => { for (const label of ['戻る', 'ホームへ戻る']) { const b = document.querySelector(`button[aria-label="${label}"]`); if (b) { b.click(); break; } } });
    await page.waitForTimeout(900);
    if (!(await page.evaluate(() => !!document.querySelector('button[aria-label="設定"]')))) { await page.evaluate(() => document.querySelector('button[aria-label="戻る"]')?.click()); await page.waitForTimeout(900); }
    await openSettings();
    const linkShown = await debugLink();
    await shot('debug-trials-3-settings.png');
    check('一度開いたあとは、設定の画面に「🧪 デバッグ設定」が出る', linkShown);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /デバッグ設定/.test(b.textContent) && /確認待ちの試作/.test(b.textContent))?.click());
    await page.waitForTimeout(1000);
    check('設定の画面の入口からデバッグ設定が開く', await page.evaluate(() => !!document.querySelector('[data-debug-trials]')));
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
