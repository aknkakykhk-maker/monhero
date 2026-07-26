// BGM(audio/のmp3)が画面に応じて正しく切り替わるかを実ブラウザで確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node bgm-check.js
//
// Chromiumは --autoplay-policy=no-user-gesture-required を付けると自動再生を許可するので、
// タップを介さずに再生状態を観測できる。実機ではタップ後に鳴り始める。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const AUDIO_BASE = PAGE_URL.replace(/index\.html$/, 'audio/');
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // 音量を上げておかないと鳴っているか分かりにくいので、保存値として先に入れておく
  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
    localStorage.setItem('mh_se_volume', JSON.stringify(50));
    localStorage.setItem('mh_bgm_volume', JSON.stringify(50));
  });

  // 音声ファイルが実際に配信されているか
  for (const f of ['bgm-title.mp3', 'bgm-menu.mp3', 'bgm-battle.mp3', 'bgm-boss.mp3']) {
    const res = await page.request.head(AUDIO_BASE + f).catch(() => null);
    check(`audio/${f} が配信されている`, !!res && res.ok(), res ? `HTTP ${res.status()}` : '取得できず');
  }

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  // 起動時の事前ロード画面で「タップしてはじめる」を押すと音声ロックが解除される
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('タップしてはじめる'), { timeout: 30000 }).catch(() => {});
  const startBtn = page.getByRole('button', { name: 'タップしてはじめる' });
  if (await startBtn.count()) await startBtn.click();
  await page.waitForTimeout(2500);

  const state = () => page.evaluate(() => [...document.querySelectorAll('audio')].map((a) => ({
    src: a.src.split('/').pop(), paused: a.paused, loop: a.loop, volume: Math.round(a.volume * 1000) / 1000,
  })));

  const title = await state();
  const playing = title.filter((a) => !a.paused);
  check('タイトルでBGMが再生される', playing.length === 1 && playing[0].src.startsWith('bgm-title'), JSON.stringify(playing));
  check('ループ再生になっている', playing.every((a) => a.loop));
  check('音量設定が反映されている', playing.every((a) => a.volume > 0), playing.map((a) => a.volume).join(','));

  // --- 音量制御(iOSでvolumeが効かない対策) ---
  // Web Audioへ繋げていれば、素のvolumeは1のままでゲインノード側で絞られる
  const wired = await page.evaluate(() => [...document.querySelectorAll('audio')].some((a) => a.volume === 1));
  check('Web Audioのゲインノードに接続されている', wired, wired ? '接続あり(素のvolume=1)' : '未接続');

  // タイトル画面のうちにミュートを試す(音量設定ボタンはタイトルにしかない)
  const clickByText = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

  await clickByText('音量設定');
  await page.waitForTimeout(700);
  const muted = await clickByText('音はオンです');
  await page.waitForTimeout(1500);
  const s3 = await state();
  check('ミュートにすると再生が止まる', muted && s3.every((a) => a.paused), JSON.stringify(s3.filter((a) => !a.paused)));

  // ミュート解除で鳴り直す
  await clickByText('音がオフです');
  await page.waitForTimeout(1800);
  const s3b = await state();
  check('ミュート解除で鳴り直す', s3b.some((a) => !a.paused), JSON.stringify(s3b.filter((a) => !a.paused)));
  await clickByText('閉じる');
  await page.waitForTimeout(500);

  // プロフィールへ移動してメニューBGMに切り替わるか
  // タイトルのプロフィール入口(ブリーダーのアイコン+名前のボタン)
  const profile = page.locator('button').filter({ hasText: 'プロフィール' }).first();
  if (await profile.count()) {
    await profile.click();
    await page.waitForTimeout(2500);
    const s2 = await state();
    const p2 = s2.filter((a) => !a.paused);
    check('別ページでメニューBGMに切り替わる', p2.length === 1 && p2[0].src.startsWith('bgm-menu'), JSON.stringify(p2));
    check('前の曲は止まっている', s2.filter((a) => a.src.startsWith('bgm-title')).every((a) => a.paused));
  } else check('別ページでメニューBGMに切り替わる', false, 'プロフィールボタンが見つからない');

  // 画面が見えなくなると止まる(バックグラウンドで鳴り続けない)
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(900);
  const s4 = await state();
  check('画面が見えなくなると止まる', s4.every((a) => a.paused), JSON.stringify(s4.filter((a) => !a.paused)));

  // 戻ってきたら鳴り直す
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1800);
  const s5 = await state();
  check('画面に戻ると鳴り直す', s5.some((a) => !a.paused), JSON.stringify(s5.filter((a) => !a.paused)));

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
