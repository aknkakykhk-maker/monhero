// モンヒロビートの全国ランキングで、「送れていない記録」が見える・送り直せることを、実際に開いて確かめる(2026-09-29)。
// ユーザー報告「スコアがランキングに反映されない」。遊んだ記録が電波の弱い場所で送れないと、端末に取っておいて
// 次にアプリを開いたとき1回だけ送り直す作りだった。画面のどこにも出ないので、載らない理由が分からなかった。
//
//   node tools/mode/rhythm-ranking-pending-check.js
//
// Supabase へは出られないので、送信先の応答は page.route で偽って返す。
//   ① 送れていない記録があると、ランキング画面に件数と理由（エラー番号）が出て、「いま送る」がある
//   ② 送れるようになって「いま送る」を押すと、その記録が送られ、帯が消え、端末の控えも空になる
//   ③ 送れる状態でランキングを開くと、順位を取りに行く前に、送れていない記録を先に送る
//   ④ 送れていない記録が無いときは、帯を出さず、余計な送信もしない
//   ⑤ 本体の配線（曲を終えた送信が失敗したら、アプリを開いたまま何度か送り直す）
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9199;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const pendingRow = () => ({
  difficulty: 'Rhythm-mf_ichika_mix-EASY', user_name: 'けんさ', hero: 'EASY', party: [{ songId: 'mf_ichika_mix' }],
  score: 123456, level: 1, icon: '🐣', clear_id: 'pending-rk-1', at: Date.now(),
  error: { message: 'rhythm ranking insert 503: down', status: 503 },
});

const seed = (pending) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  if (pending) put('mh_rhythm_rank_pending_v1', pending);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });

  // 1回ぶんの立ち上げ。ランキング画面を開くところまで進めて、page と記録を返す
  const open = async (pending, ctl) => {
    const events = [];
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/rest/v1/rankings**', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        let body = null;
        try { body = JSON.parse(req.postData() || '{}'); } catch { body = null; }
        events.push({ kind: 'POST', clearId: body && body.clear_id });
        if (ctl.sendOk) return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'down' }) });
      }
      if (/difficulty=in\./.test(req.url())) events.push({ kind: 'GET' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/rest/v1/bond_levels**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(seed, pending);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(300); }
    // 起動時の送り直し(HOMEに着いて4秒後)が終わるのを待ってから、ランキングを開く数え直しにする
    await page.waitForTimeout(6000);
    events.length = 0;
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-ranking]').click());
    await page.waitForSelector('[data-rhythm-ranking]', { timeout: 20000 });
    await page.waitForFunction(() => !document.querySelector('[data-rhythm-ranking-loading]'), null, { timeout: 40000 });
    return { page, events, errors };
  };
  const pendingLeft = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_rhythm_rank_pending_v1') || '[]').length; } catch { return -1; } });

  try {
    // ① 送れないとき: 帯が出る
    const ctl1 = { sendOk: false };
    const a = await open([pendingRow()], ctl1);
    const banner = await a.page.evaluate(() => { const el = document.querySelector('[data-rhythm-ranking-pending]'); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
    check('送れていない記録があると、ランキング画面に帯が出る', !!banner, String(banner));
    check('帯に件数が出る', /1件/.test(banner || ''), String(banner));
    check('帯に送れなかった理由(エラー番号)が出る', /503/.test(banner || ''), String(banner));
    check('「いま送る」がある', !!(await a.page.$('[data-rhythm-ranking-pending-send]')));
    if (process.env.SHOT) await a.page.screenshot({ path: process.env.SHOT });
    check('送れなくても記録は消さない', (await pendingLeft(a.page)) === 1);

    // ② 送れるようになって「いま送る」
    ctl1.sendOk = true;
    a.events.length = 0;
    await a.page.click('[data-rhythm-ranking-pending-send]');
    await a.page.waitForFunction(() => !document.querySelector('[data-rhythm-ranking-pending]'), null, { timeout: 30000 }).catch(() => {});
    check('「いま送る」で、その記録が送られる', a.events.some((e) => e.kind === 'POST' && e.clearId === 'pending-rk-1'), JSON.stringify(a.events));
    check('送れたら帯が消える', !(await a.page.$('[data-rhythm-ranking-pending]')));
    check('送れたら端末の控えが空になる', (await pendingLeft(a.page)) === 0);
    check('実行時エラーが出ていない', a.errors.length === 0, a.errors[0] || '');
    await a.page.close();

    // ③ 送れる状態でランキングを開く: 順位を取りに行く前に送る
    const b = await open([pendingRow()], { sendOk: true });
    const firstPost = b.events.findIndex((e) => e.kind === 'POST' && e.clearId === 'pending-rk-1');
    const firstGet = b.events.findIndex((e) => e.kind === 'GET');
    check('ランキングを開くと、送れていない記録を送る', firstPost >= 0, JSON.stringify(b.events));
    check('順位を取りに行く前に送る(自分の記録が載った順位が返る)', firstPost >= 0 && firstGet > firstPost, JSON.stringify(b.events));
    check('送れたので帯は出ない', !(await b.page.$('[data-rhythm-ranking-pending]')));
    await b.page.close();

    // ④ 何も無いとき
    const c = await open(null, { sendOk: true });
    check('送れていない記録が無いときは、帯を出さない', !(await c.page.$('[data-rhythm-ranking-pending]')));
    check('送れていない記録が無いときは、余計な送信をしない', c.events.filter((e) => e.kind === 'POST').length === 0, JSON.stringify(c.events));
    check('順位は取りに行く', c.events.some((e) => e.kind === 'GET'));
    await c.page.close();
  } finally {
    await browser.close();
    server.close();
  }

  // ⑤ 本体の配線(文字列)
  const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  const sb = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
  check('曲を終えた送信が通らなかったら、アプリを開いたまま送り直しを予約する',
    /if \(!outcome\.nationalSaved\) scheduleRhythmRankingRetry\(\);/.test(app));
  check('送り直しの間隔を持つ(12秒・45秒・150秒)', /RHYTHM_RANKING_RETRY_DELAYS_MS = \[12000, 45000, 150000\]/.test(sb));
  check('総合・週間・この曲のどれを開くときも、先に送り直す',
    (app.match(/await settleRhythmRankingSubmit\(\);/g) || []).length >= 3);
  check('送信の失敗は画面へ出す前に端末へ取っておく(既存の退避を使う。新しい保存キーは作らない)',
    /RHYTHM_RANKING_PENDING_KEY/.test(app) && !/mh_rhythm_rank_pending_v2/.test(app));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
