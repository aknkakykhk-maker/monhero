// 事件簿の専用の音量(台帳 r1126-116)の検査。
//   node tools/novel/xmas-novel-volume-check.js
// ① 保存の形(mh_xmas_novel_volume_v1)の正規化: 無い・壊れている → 100(今までの聞こえ方)、範囲の外は 0〜100 に丸める
// ② ブラウザ: 起動画面と読む画面の上の帯に「音量」があり、窓で変えるとその場で倍率が入り(Audio_.novelVolume)、新しいキーに保存される。
//    ゲーム全体の音量のキー(mh_bgm_volume・mh_se_volume)は書き換えない。閉じると倍率が外れる。開き直すと前の値が戻る。壊れた保存値は既定へ
//    (音そのものの大きさは Tone.js を読めるときだけ。読めない環境では倍率の受け渡しまでを見る)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const PORT = 8963;
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
let ng = 0;
const check = (name, ok, extra) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${extra !== undefined ? ` — ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`); if (!ok) ng += 1; };

// ① 正規化(部品の文をそのまま取り出して動かす)
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/79-screen-xmas-novel.jsx'), 'utf8');
const a = src.indexOf('const XMAS_NOVEL_VOLUME_KINDS'); const b = src.indexOf('const xmasNovelVolumeLoad');
check('音量の正規化の部品が見つかる', a > 0 && b > a);
const lib = new Function(`${src.slice(a, b)}; return { xmasNovelVolumeNormalize, xmasNovelVolumeScale, xmasNovelVolumeScales };`)();
const def = lib.xmasNovelVolumeNormalize(null);
check('① 保存が無いときは全部 100(今までの聞こえ方)', JSON.stringify(def) === JSON.stringify({ v: 1, bgm: 100, se: 100, amb: 100, clock: 100 }), def);
const bad = lib.xmasNovelVolumeNormalize({ bgm: -5, se: 'x', amb: 50.4, clock: 900 });
check('① 壊れた値・範囲の外は 0〜100 の整数へ(読めない物は 100)', JSON.stringify(bad) === JSON.stringify({ v: 1, bgm: 0, se: 100, amb: 50, clock: 100 }), bad);
check('① 配列・文字列は既定へ', lib.xmasNovelVolumeNormalize([1, 2]).bgm === 100 && lib.xmasNovelVolumeNormalize('70').se === 100);
check('① 100 は 1倍・0 は消す・50 は 1倍より小さい', lib.xmasNovelVolumeScale(100) === 1 && lib.xmasNovelVolumeScale(0) === 0 && lib.xmasNovelVolumeScale(50) > 0 && lib.xmasNovelVolumeScale(50) < 1);
check('① 保存のキーは新しい mh_xmas_novel_volume_v1', /XMAS_NOVEL_VOLUME_KEY = 'mh_xmas_novel_volume_v1'/.test(src));
check('① 事件簿の音量の部品は、ゲーム全体の音量のキーを書かない', !/storeSet\(\s*'mh_(se|bgm)_volume/.test(src.slice(src.indexOf('// ---- 事件簿の専用の音量'), src.indexOf('// ---- 保存 ----'))));

const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないのでブラウザは見ない'); process.exit(ng ? 1 : 0); }
  const server = await serve();
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // Tone.js(cdnjs)が届かない環境向けに、手元の同じ版を渡せる(TONE_JS=<パス>)。無ければ外へ取りに行く
    if (process.env.TONE_JS && fs.existsSync(process.env.TONE_JS)) await page.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/tone\//, (route) => route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, path: process.env.TONE_JS }));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      if (!localStorage.getItem('__nv_vol_seeded')) { put('mh_se_volume', 63); put('mh_bgm_volume', 47); localStorage.setItem('__nv_vol_seeded', '1'); }
    });
    await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
    const ls = (k) => page.evaluate((key) => localStorage.getItem(key), k);
    const nvol = () => page.evaluate(() => (typeof Audio_ !== 'undefined' && Audio_.novelVolume ? Audio_.novelVolume() : 'なし'));
    const globalBefore = { se: await ls('mh_se_volume'), bgm: await ls('mh_bgm_volume') };
    const open = () => page.evaluate(() => openXmasNovel({ force: true, playerName: 'テスト' }));
    await open();
    await page.locator('[data-xmas-novel-title]').waitFor({ timeout: 10000 });
    check('② 起動画面の上の帯に「音量」がある', await page.locator('[data-xmas-novel-volume-open]').count() === 1);
    check('② 開いた直後は倍率 1(保存が無い=今までどおり)', JSON.stringify(await nvol()) === JSON.stringify({ bgm: 1, se: 1, amb: 1, clock: 1 }), await nvol());
    await page.locator('[data-xmas-novel-volume-open]').click();
    check('② 音量の窓に 曲・効果音・環境音・時計の音 の4つ', await page.locator('[data-xmas-novel-volume]').evaluateAll((els) => els.map((e) => e.getAttribute('data-xmas-novel-volume')).join(',')) === 'bgm,se,amb,clock');
    await page.locator('[data-xmas-novel-volume-mute="amb"]').click();
    await page.locator('[data-xmas-novel-volume-range="bgm"]').fill('50');
    await page.waitForTimeout(600);
    const v1 = await nvol();
    check('② 環境音を「消す」と、その場で環境音の倍率が 0', v1 && v1.amb === 0, v1);
    check('② 曲を 50 にすると、その場で曲の倍率が 1 より小さい', v1 && v1.bgm > 0 && v1.bgm < 1, v1);
    const saved = JSON.parse((await ls('mh_xmas_novel_volume_v1')) || 'null');
    check('② 新しいキーに保存される', saved && saved.amb === 0 && saved.bgm === 50 && saved.se === 100 && saved.clock === 100, saved);
    check('② ゲーム全体の音量のキーは書き換えない', (await ls('mh_se_volume')) === globalBefore.se && (await ls('mh_bgm_volume')) === globalBefore.bgm, { before: globalBefore, after: { se: await ls('mh_se_volume'), bgm: await ls('mh_bgm_volume') } });
    await page.locator('[data-xmas-novel-volume-mute="amb"]').click();
    await page.waitForTimeout(500);
    check('② 「戻す」で前の値へ', (await nvol()).amb === 1);
    await page.locator('[data-xmas-novel-volume-close]').click();
    // 読む画面
    await page.locator('[data-xmas-novel-new]').click();
    await page.waitForTimeout(800);
    // 章の札などが出ていたら閉じる(札の上からは帯を押せない)
    for (let i = 0; i < 6 && await page.locator('[data-xmas-novel-card]').count(); i += 1) { await page.evaluate(() => { const c = document.querySelector('[data-xmas-novel-card]'); if (c) c.click(); }); await page.waitForTimeout(700); }
    check('② 読む画面の上の帯にも「音量」がある', await page.locator('[data-xmas-novel-volume-open]').count() === 1);
    await page.locator('[data-xmas-novel-volume-open]').click();
    await page.locator('[data-xmas-novel-volume-mute="clock"]').click();
    await page.waitForTimeout(500);
    check('② 読む画面で時計の音を消すと、その場で倍率 0', (await nvol()).clock === 0);
    await page.locator('[data-xmas-novel-volume-close]').click();
    await page.waitForTimeout(400);
    check('② 閉じても読む画面のまま(窓だけ閉じる)', await page.locator('[data-xmas-novel="read"]').count() === 1);
    // 閉じる → 倍率が外れる
    await page.evaluate(() => { const b = document.querySelector('[data-xmas-novel-menu]'); if (b) b.click(); });
    await page.locator('[data-xmas-novel-menu-close]').click();
    await page.waitForTimeout(600);
    check('② 事件簿を閉じると倍率が外れる(ほかの画面はいつもの音量)', (await nvol()) === null, await nvol());
    // 開き直す → 前の値
    await open(); await page.locator('[data-xmas-novel-title]').waitFor({ timeout: 10000 }); await page.waitForTimeout(600);
    const v2 = await nvol();
    check('② 開き直すと前の値が戻る', v2 && v2.clock === 0 && v2.bgm < 1 && v2.amb === 1, v2);
    await page.locator('[data-xmas-novel-close]').click(); await page.waitForTimeout(400);
    // 壊れた保存値 → 既定
    await page.evaluate(() => localStorage.setItem('mh_xmas_novel_volume_v1', '{"bgm":"abc","se":-20'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
    await open(); await page.locator('[data-xmas-novel-title]').waitFor({ timeout: 10000 }); await page.waitForTimeout(600);
    check('② 保存値が壊れていても開けて、既定(1倍)になる', JSON.stringify(await nvol()) === JSON.stringify({ bgm: 1, se: 1, amb: 1, clock: 1 }), await nvol());
    check('② 画面のエラーが出ない', errors.length === 0, errors.slice(0, 3));
  } finally { await browser.close(); server.close(); }
  console.log(ng ? `\n${ng}件 NG` : '\nすべてOK');
  process.exit(ng ? 1 : 0);
})();
