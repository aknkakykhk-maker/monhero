// 起動時の事前ロード画面と、画面遷移でBGMが重ならないことを確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node boot-check.js
//
// 実機と同じく自動再生を禁止した状態で起動し、「タップしてはじめる」を押した時点で
// BGMが鳴り始めること、素早く画面を移っても2曲が重ならないことを見る。
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
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
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('タップしてはじめる'), { timeout: 30000 });
  const readyAt = Date.now() - t0;
  check('事前ロードが終わり「タップしてはじめる」が出る', true, `${readyAt} ms`);

  // タップ前はBGMが鳴っていないこと(ブラウザの制限どおり)
  const before = await page.evaluate(() => [...document.querySelectorAll('audio')].filter((a) => !a.paused).length);
  check('タップ前は鳴っていない', before === 0, `${before}曲`);

  await page.getByRole('button', { name: 'タップしてはじめる' }).click();
  await page.waitForTimeout(1500);

  const state = () => page.evaluate(() => [...document.querySelectorAll('audio')].map((a) => ({
    src: a.src.split('/').pop(), paused: a.paused,
  })));
  const afterTap = await state();
  const playing = afterTap.filter((a) => !a.paused);
  check('タップ直後にタイトルBGMが鳴る', playing.length === 1 && playing[0].src.startsWith('bgm-title'), JSON.stringify(playing));
  check('タイトル画面が表示される', (await page.evaluate(() => (document.body ? document.body.innerText : ''))).includes('召喚開始'));

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

  // マーケットは専用BGMになるか
  await click('マーケット');
  await page.waitForTimeout(2000);
  const mk = (await state()).filter((a) => !a.paused);
  check('マーケットで専用BGMが流れる', mk.length === 1 && mk[0].src.startsWith('bgm-market'), JSON.stringify(mk));

  // プロフィールは専用BGMになるか(同じ曲が重なって鳴らないことも確認する)
  await page.reload();
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('タップしてはじめる'), { timeout: 30000 });
  await page.getByRole('button', { name: 'タップしてはじめる' }).click();
  await page.waitForTimeout(1500);
  const t1 = (await state()).filter((a) => !a.paused);
  check('タイトルでBGMが鳴っている(ロード後すぐ)', t1.length === 1 && t1[0].src.startsWith('bgm-title'), JSON.stringify(t1));
  await click('プロフィール');
  await page.waitForTimeout(2200);
  const pf = (await state()).filter((a) => !a.paused);
  check('プロフィールで専用BGMが1曲だけ流れる', pf.length === 1 && pf[0].src.startsWith('bgm-profile'), JSON.stringify(pf));

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  await page.screenshot({ path: path.join(__dirname, 'out', 'boot.png') });

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
