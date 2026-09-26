// 新しく始めた人に、前から遊んでいる人向けの会話(過去のストーリー)が流れないかを、
// まっさらな状態から実際に始めて確かめる(2026-09-26 ユーザー指摘「新規で始めたときに過去ストーリーが流れる」)。
//
//   node tools/boot/new-player-story-check.js
//
// 【なぜ要るか】
// ホームで自動で流れる会話には、前から遊んでいる人向けのお知らせが混ざっている
// (タクティクスの導入「バトルに新しい仕組みが来た」・ききの加入・ももすけの登場・
//  終わったイベントの「閉幕とお礼」・ビートPや6レーンのお知らせ)。起動時の判定は
// 「すでに遊んでいた人か(wasOnboarded)」で絞っていたが、タクティクスの導入は絞っておらず、
// モンヒロビートの会話は1分おきの見回りが絞っていなかったため、プロフィールを決めた直後に流れていた。
// 静的な文字列ではなく、助手えらび → 名前とアイコン → 村の案内 → ホームで待つ、を実際になぞる。
//
// 見るもの:
//   ・新しく始める流れを最後まで進めて、ホームに着ける
//   ・ホームで見回り(1分おき)をまたいで待っても、お知らせ系の会話が1つも流れない
//   ・開催中のイベントの会話は流れてよい(いまの話なので)。ここでは数えない
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 9187;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 新しく始めた人には流さない会話(前から遊んでいる人向けのお知らせ)。
// 開催中のイベントの会話(閉幕とお礼ではないもの)は、いまの話なので流れてよい
const NEWS_IDS = /^(tactics_intro|kiki_intro|momosuke_intro|beat_point_always_.*|rhythm_six_lane_.*|.*_thanks)$/;

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000, force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForTimeout(2000);
    const clickText = async (re) => page.evaluate((s) => {
      const rx = new RegExp(s);
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && !x.disabled
        && rx.test((x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()));
      if (!b) return false; b.click(); return true;
    }, re);
    // 流れてはいけない会話の、画面に出る文(題名と最初のセリフ)
    const news = await page.evaluate((src) => {
      const rx = new RegExp(src);
      return (typeof EVENT_REPLAYS !== 'undefined' ? EVENT_REPLAYS : []).filter((ev) => rx.test(ev.id))
        .map((ev) => ({ id: ev.id, marks: [ev.title, ...(Array.isArray(ev.script) && ev.script[0] && ev.script[0].t ? [ev.script[0].t] : [])] }));
    }, NEWS_IDS.source);
    check('見張る会話の一覧を実データから取れた', news.length >= 5, news.map((n) => n.id).join(' / '));
    const shownNews = async () => page.evaluate((list) => {
      const text = document.body.innerText;
      return list.filter((n) => n.marks.some((m) => m && text.includes(m))).map((n) => n.id);
    }, news);

    // --- 助手えらび → 名前とアイコン → けってい ---
    await clickText('^確認$');
    await page.waitForTimeout(400);
    const chose = await clickText('この子にする');
    check('助手をえらべる', chose);
    await page.waitForTimeout(1200);
    await clickText('なまえを決める');
    await page.waitForTimeout(600);
    await page.fill('input[type=text], input:not([type])', 'テスト');
    await clickText('^保存$');
    await page.waitForTimeout(600);
    await clickText('アイコンを選ぶ');
    await page.waitForTimeout(800);
    // アイコンの一覧から最初の1つを選ぶ(画像のボタン)
    await page.evaluate(() => {
      // 一覧のアイコンは正方形の画像ボタン(プロフィールの顔の「アイコンを変える」ボタンは aria-label 付きなので除く)
      const b = [...document.querySelectorAll('button.aspect-square')].find((x) => x.offsetParent && x.querySelector('img') && !x.getAttribute('aria-label'));
      if (b) b.click();
    });
    await page.waitForTimeout(800);
    const decided = await clickText('^けってい');
    check('名前とアイコンを決められる', decided);
    await page.waitForTimeout(1500);

    // --- 村の案内などを最後まで進めて、ホームで待つ ---
    const seen = new Set();
    let atHome = false;
    const deadline = Date.now() + 85000; // 見回りは1分おき。1回はまたぐ
    while (Date.now() < deadline) {
      (await shownNews()).forEach((id) => seen.add(id));
      const moved = await clickText('^(つぎへ|次へ|とじる|閉じる|OK|スキップ|はじめる|さっそく|わかった|うん)');
      if (!moved) atHome = atHome || await page.evaluate(() => document.body.innerText.includes('モンヒロバトル'));
      await page.waitForTimeout(moved ? 400 : 2000);
    }
    check('ホームに着ける', atHome);
    check('お知らせ系の会話(過去のストーリー)が流れない', seen.size === 0, [...seen].join(' / ') || 'なし');
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
