// 種族チャレンジを実際のブラウザで通しで遊んでみて、画面が動くかを確かめる。
//
//   python3 tools/serve.py  は要らない(このツールが自前でポートを開く)
//   node tools/mode/species-challenge-browser-check.js
//
// 見るのは次のとおり。
//   ① デバッグ設定(DEBUG MENU) → ⚔️バトル → ⚔️バトルモード → 本番と同じBATTLE MODEカルーセルから入れる
//   ② 種族選択 → 難易度 → 勇者 → 供モン → 出撃確認 の各画面が出て、iPhone縦で横にはみ出さない
//   ③ 勇者と同じモンスターは供モンに出ない(同じbaseIdの重複拒否)
//   ④ 供モン0体でも出撃できる
//   ⑤ WAVE1のバトルまで到達して、どこでも実行時エラー(真っ白)にならない
//   ⑥ 種族チャレンジのランキング画面が開き、種族タブと難易度タブ(14)が並ぶ
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
// そのため「見た目そのもの」は確認できない。ここで分かるのは
// 「画面が出るか」「押せるか」「実行時エラーが出ないか」「横スクロール事故が無いか」まで。
const http = require('http');
const path = require('path');
const fs = require('fs');

// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8991;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ジャック確認(デバッグ画面 RAID_JACK_DEBUG)を実際のブラウザで開いて確かめる。
//   ① デバッグ設定から入口(data-debug-raid-jack)で開ける。公開フラグは false のまま
//   ② 定義表(A/B 各5段階のライフ)・時刻の切り替え(前/中/後)・今日の回数が出る
//   ③ テスト送信は別のイベントID(raid_jack_debug)で raid_jack_hits へ POST(通信は偽の応答)
//   ④ 表が無い(404)ときは「準備中」と出て、画面は壊れない
//   ⑤ 端末の記録の初期化が mh_raid_jack_v1 だけを書き、実行時エラーが出ない
(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    // ジャックは 2026-10-05 4:00 に公開された。この検査は「公開前(フラグが偽)」の表示を確かめるので、時計を公開前へ固定して流す(2026-10-05に確認)
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+09:00') });
    await page.clock.resume();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(eventStorySeed());
    // サーバーへは出さない。raid_jack_hits への送信は記録して成功を返し、取得は空の配列を返す
    const posts = [];
    let tableMissing = false;
    await page.route('**/rest/v1/raid_jack_**', async (route) => {
      const req = route.request();
      if (tableMissing) { await route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST205","message":"Could not find the table"}' }); return; }
      if (req.method() === 'POST') { posts.push({ url: req.url(), body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    // 公開前の画面を確かめる検査なので、時計を開始日時(2026-10-05 4:00)より前に固定する(公開後の本物の時刻だと、旗が立って前提が変わる)
    await page.clock.setFixedTime(new Date('2026-10-05T03:00:00+09:00'));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    check('デバッグ設定を開ける', true);
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    check('デバッグ設定の入口から「ジャック確認」が開く', true);

    const text = async () => (await page.locator('[data-raid-jack-debug]').innerText());
    let t = await text();
    check('公開フラグは false(公開前)と出る', /false\(公開前\)/.test(t));
    check('A の5段階の名前とライフが出る', ['ジャック男爵', 'ジャック大王', '1,750,000', '4,550,000'].every((s) => t.includes(s)));
    check('B の5段階の名前とライフが出る', ['初級ジャック', '極級ジャック', '70,000', '35,000,000'].every((s) => t.includes(s)));
    check('技名が出る', ['カボチャ張り手', 'おばけパレード'].every((s) => t.includes(s)));
    check('段階ごとに使う技(3本・4本・5本)が出る', t.includes('ジャック男爵(3本): ジャックラッシュ / おばけキッス / かぼちゃ延髄斬り') && t.includes('初級ジャック(3本)') && t.includes('ハロウィンナイト'));
    const imgs = await page.locator('[data-raid-jack-debug] img').evaluateAll((els) => els.map((e) => ({ ok: e.complete && e.naturalWidth > 0, src: e.getAttribute('src') })));
    check('ジャックの絵3枚が表示できる', imgs.length === 3 && imgs.every((i) => i.ok), JSON.stringify(imgs.map((i) => i.src)));
    check('無料回数(今日の残り A 3 / B 3)', /A 3 \/ B 3/.test(t));
    await page.getByRole('button', { name: '開始の1分前' }).click();
    check('開始の1分前は「開始前」', /この時刻の判定: 開始前/.test(await text()));
    await page.getByRole('button', { name: '開始の1分後' }).click();
    check('開始の1分後は「開催中」', /この時刻の判定: 開催中/.test(await text()));
    await page.getByRole('button', { name: '終了の1分後' }).click();
    check('終了の1分後は「終了後」', /この時刻の判定: 終了後/.test(await text()));

    // ③ テスト送信
    await page.getByRole('button', { name: 'テスト送信' }).click();
    await page.waitForFunction(() => /テスト送信\(A1・1000\)/.test(document.querySelector('[data-raid-jack-debug]').innerText), null, { timeout: 15000 });
    check('テスト送信が raid_jack_hits へ1回届く', posts.length === 1 && /raid_jack_hits/.test(posts[0].url));
    const row = JSON.parse(posts[0].body || '{}');
    check('別のイベントID(raid_jack_debug)で送る(本番の集計に入らない)', row.event_id === 'raid_jack_debug' && row.kind === 'a' && row.tier === 1 && row.damage === 1000, JSON.stringify(row));
    check('「送れました」と出る', /送れました/.test(await text()));
    await page.getByRole('button', { name: '合計と上位を取得' }).click();
    await page.waitForFunction(() => /段階ごとの合計とBの上位を取得しました/.test(document.querySelector('[data-raid-jack-debug]').innerText), null, { timeout: 15000 });
    check('合計と上位が取得できる', true);

    // ④ 表が無いとき
    tableMissing = true;
    await page.getByRole('button', { name: 'テスト送信' }).click();
    await page.waitForFunction(() => /準備中\(SQL未適用\)/.test(document.querySelector('[data-raid-jack-debug]').innerText), null, { timeout: 15000 });
    check('表が無いときは「準備中」と出て、画面は壊れない', true);

    // ⑤ 端末の記録
    await page.getByRole('button', { name: '記録を初期化' }).click();
    await page.waitForTimeout(300);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mh_raid_jack')));
    check('端末に書くのは新しいキー mh_raid_jack_v1 だけ', keys.length === 1 && keys[0] === 'mh_raid_jack_v1', keys.join(','));
    await page.getByRole('button', { name: '手前4段階を倒した状態にする' }).click();
    await page.waitForTimeout(300);
    t = await text();
    check('手前4段階を倒すと、開いている段階が5になる', /開いている段階: A 5 \/ B 5/.test(t));
    const size = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('画面が横にはみ出さない', size.s <= size.c + 1, `${size.s} / ${size.c}`);
    check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (error) {
    check('検査の実行', false, String(error && error.message || error).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
  console.log('\nすべて OK');
})();
