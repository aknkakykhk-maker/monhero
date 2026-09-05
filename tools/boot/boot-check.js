const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 起動時の事前ロード画面と、画面遷移でBGMが重ならないことを確認する。
//
//   node tools/boot/boot-check.js
//
// 配信は自分で立てるので、事前に別のサーバーを動かしておく必要はない。
// (以前は python3 tools/serve.py を別に上げておく前提で、単独で走らせると
//  「接続できません」で必ず落ちていた。ほかの検査は自前で立てているので合わせた)
// SMOKE_URL を指定したときだけ、そこへ繋ぎにいく。
//
// 実機と同じく自動再生を禁止した状態で起動し、「TAP TO START」を押した時点で
// BGMが鳴り始めること、素早く画面を移っても2曲が重ならないことを見る。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8899;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;

// 自前の配信。SMOKE_URL が指定されているときは外のサーバーを使うので立てない。
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise((resolve, reject) => {
  if (process.env.SMOKE_URL) { resolve(null); return; }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', reject);
  server.listen(PORT, () => resolve(server));
});
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const server = await serve();
  // 実機と同じ条件にするため、自動再生の許可フラグは付けない
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
    localStorage.setItem('mh_bgm_volume', JSON.stringify(50));
    localStorage.setItem('mh_se_volume', JSON.stringify(50));
  });

  const t0 = Date.now();
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 });
  const readyAt = Date.now() - t0;
  check('事前ロードが終わり「TAP TO START」が出る', true, `${readyAt} ms`);

  // タップ前はBGMが鳴っていないこと(ブラウザの制限どおり)
  // BGMは <audio> ではなく Web Audio (AudioBufferSourceNode) で鳴らしている。
  // 以前は document.querySelectorAll('audio') を数えていたので、実際には鳴っていても
  // 常に0件になり「鳴っていない」と誤判定していた(2026-09-05)。
  // ゲーム側が出している window.__mhAudioDebug() から、いま鳴っている曲を見る。
  const before = await page.evaluate(() => {
    try { return (window.__mhAudioDebug?.().playing || []).length; } catch (e) { return 0; }
  });
  check('タップ前は鳴っていない', before === 0, `${before}曲`);

  await page.getByRole('button', { name: 'TAP TO START' }).click();
  await page.waitForTimeout(1500);

  const state = () => page.evaluate(() => {
    try {
      // { src, paused } の形にそろえて返す(以下の判定を書き換えずに済むように)
      return (window.__mhAudioDebug?.().playing || []).map((entry) => ({ src: String(entry.src || ''), paused: false }));
    } catch (e) { return []; }
  });
  const legacyState = () => page.evaluate(() => [...document.querySelectorAll('audio')].map((a) => ({
    src: a.src.split('/').pop(), paused: a.paused,
  })));
  // 場面ごとに鳴るべき曲は、ゲーム側の既定(DEFAULT_BGM_ARRANGEMENT)から引く。
  // 以前はファイル名(bgm-title…)を検査に書き写していたが、既定を
  // monster_hero_theme_alt へ変えたときに追従せず、鳴っているのに落ちていた。
  const expectedSrc = (scene) => page.evaluate((key) => {
    try { return window.__mhAudioExpectedSrc?.(key) ?? null; } catch (e) { return null; }
  }, scene);
  const titleSrc = await expectedSrc('title');
  const afterTap = await state();
  const playing = afterTap.filter((a) => !a.paused);
  check('タップ直後にタイトルBGMが鳴る',
    playing.length === 1 && (!titleSrc || playing[0].src === titleSrc),
    `${JSON.stringify(playing)}${titleSrc ? ` / 既定は ${titleSrc}` : ''}`);
  // タイトル画面かどうかは、そこにしか無い表示(PLAYER ID)で見る。
  // ボタンの文言は変わりうるので当てにしない。
  check('タイトル画面が表示される',
    (await page.evaluate(() => (document.body ? document.body.innerText : ''))).includes('PLAYER ID'));

  // 画面を素早く行き来しても2曲が重ならないこと
  const click = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);
  let maxPlaying = playing.length;
  for (let i = 0; i < 3; i++) {
    await click('プロフィール');
    await page.waitForTimeout(250);
    await click('マーケット');
    await page.waitForTimeout(250);
    const n = (await state()).filter((a) => !a.paused).length;
    if (n > maxPlaying) maxPlaying = n;
  }
  await page.waitForTimeout(1500);
  const settled = (await state()).filter((a) => !a.paused);
  check('素早く画面を移っても2曲が重ならない', maxPlaying <= 1, `同時に鳴った最大 ${maxPlaying}曲`);
  check('落ち着いたあとも1曲だけ', settled.length <= 1, JSON.stringify(settled));

  // マーケットは専用BGMになるか。
  // Tailwind(外部CDN)へ出られない環境ではタイトルの中身が組み上がらず、
  // 「マーケット」のボタン自体が出ない。そのときは確かめられないと言って飛ばす
  // (黙ってNGにすると、本当に壊れたときと見分けが付かない)。
  const canOpen = async (name) => !!(await page.$(`text=${name}`));
  const marketSrc = await expectedSrc('market');
  if (await canOpen('マーケット')) {
    await click('マーケット');
    await page.waitForTimeout(2000);
    const mk = (await state()).filter((a) => !a.paused);
    check('マーケットで専用BGMが流れる',
      mk.length === 1 && (!marketSrc || mk[0].src === marketSrc),
      `${JSON.stringify(mk)}${marketSrc ? ` / 既定は ${marketSrc}` : ''}`);
  } else {
    console.log('  --  マーケットで専用BGMが流れる — この環境ではボタンが出ないので確かめられません');
  }

  // プロフィールは専用BGMになるか(同じ曲が重なって鳴らないことも確認する)
  await page.reload();
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click();
  await page.waitForTimeout(1500);
  const t1 = (await state()).filter((a) => !a.paused);
  check('タイトルでBGMが鳴っている(ロード後すぐ)',
    t1.length === 1 && (!titleSrc || t1[0].src === titleSrc),
    `${JSON.stringify(t1)}${titleSrc ? ` / 既定は ${titleSrc}` : ''}`);
  const profileSrc = await expectedSrc('management');
  if (await canOpen('プロフィール')) {
    await click('プロフィール');
    await page.waitForTimeout(2200);
    const pf = (await state()).filter((a) => !a.paused);
    check('プロフィールで専用BGMが1曲だけ流れる',
      pf.length === 1 && (!profileSrc || pf[0].src === profileSrc),
      `${JSON.stringify(pf)}${profileSrc ? ` / 既定は ${profileSrc}` : ''}`);
  } else {
    console.log('  --  プロフィールで専用BGMが1曲だけ流れる — この環境ではボタンが出ないので確かめられません');
  }

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'boot.png') });

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  if (server) server.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
