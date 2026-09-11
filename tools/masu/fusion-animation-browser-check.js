const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 通常合体と「限界突破して合体」が、実ブラウザで同じ演出を最後まで表示することを確認する。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const outDir = path.join(TOOLS_DIR, 'out');
fs.mkdirSync(outDir, { recursive: true });

const scenarios = [
  { name: 'normal', breakthrough: false, mainXp: 0, subXp: 150 },
  { name: 'breakthrough', breakthrough: true, mainXp: 999999, subXp: 150 },
];

const run = async (browser, scenario) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ mainXp, subXp }) => {
    const put = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const makeMasu = (id, baseId, name, bondXp, colors) => ({
      id, baseId, name, bondXp, colors, levelCap: 30, rebirthCount: 0,
      distAptPoints: 0, distApt: ['C', 'C', 'C', 'C'],
      statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, uniqueSkillLevels: { own: 0 },
      inheritedUniques: [], fusionHistory: [], createdAt: Date.now(),
    });
    put('mh_breeder_name', '合体演出テスト');
    put('mh_breeder_icon', 'Mocchi');
    // 名前とアイコンが両方そろっていないと「はじめての設定」からやり直しになる(60-app.jsx の wasOnboarded 判定)。
    // mh_intro_done は実装がもう読まない古いキーなので、いまのキーで既存プレイヤーの印を付ける
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_kiki_intro_seen_v1', true);
    put('mh_momosuke_intro_seen_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_gold', 999999);
    put('mh_owned_items', { rainbow_psyche: 9999 });
    put('mh_masu_mons', [
      makeMasu('fusion-main', 'Mocchi', '主・染色モッチー', mainXp, ['blue', 'red', 'green']),
      makeMasu('fusion-sub', 'Suezo', '副・染色スエゾー', subXp, ['red', 'blue', 'yellow']),
      makeMasu('fusion-next-sub', 'Golem', '次の副・ゴーレム', 50, ['green', 'yellow', 'blue']),
    ]);
  }, scenario);
  // 外部CDN(Tailwind)へ出られない環境では読み込み待ちで先へ進めなくなるので、先に落とす
  await page.route('**cdn.tailwindcss.com**', route => route.abort()).catch(() => {});
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  const pointerDown = selector => page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (node) node.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!node;
  }, selector);
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click();
  // 事前ロードの次はタイトル画面。HOMEへ進むボタンは文字を持たず、onPointerDown でしか動かない
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await pointerDown('button[aria-label="トップ画面へ進む"]');
  await page.waitForTimeout(2500);
  // ログインボーナス・お知らせがHOMEに重なることがあるので閉じておく
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const node = [...document.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ/.test(x.textContent || ''));
      if (node) node.click();
      return !!node;
    });
    if (!closed) break;
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="神殿"]'), { timeout: 40000 });

  const clickButton = async pattern => {
    const clicked = await page.evaluate(source => {
      const rx = new RegExp(source);
      const button = [...document.querySelectorAll('button')].find(node => rx.test((node.innerText || '').replace(/\s+/g, ' ')));
      if (!button) return false;
      button.click();
      return true;
    }, pattern.source);
    if (!clicked) throw new Error(`ボタンが見つかりません: ${pattern}`);
    await page.waitForTimeout(100);
  };

  await clickButton(/神殿/);
  await clickButton(/^合体$/);
  await clickButton(/主・染色モッチー/);
  await clickButton(/副・染色スエゾー/);
  await clickButton(/副1体で確認へ/);
  await page.waitForFunction(() => document.body.innerText.includes('合体の確認'));

  const action = scenario.breakthrough ? /限界突破 .*して合体/ : scenario.name === 'normal' ? /合体する|通常合体/ : /通常合体/;
  await clickButton(action);

  await page.waitForFunction(() => [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionSlideInLeft'));
  const phase1 = await page.evaluate(() => ({
    left: [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionSlideInLeft'),
    right: [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionSlideInRight'),
    // ★染めた絵の数え方。以前は DOM の <canvas> を数えていたが、DyedMonsterImage は
    //   canvas を画面に出さず、染め直した層を data URL の <img> にして元絵へ重ねる作り
    //   (15-dye-and-art.jsx)。canvas は作る過程で使うだけなので、数えると常に0になる。
    //   スライドインしている2体の中で「重ねられた層」を数える形にした(直接的で、より厳しい)
    dyedImages: [...document.querySelectorAll('*')]
      .filter(node => /^fusionSlideIn(Left|Right)$/.test(getComputedStyle(node).animationName))
      .reduce((sum, node) => sum + [...node.querySelectorAll('img')]
        .filter(img => (img.getAttribute('src') || '').startsWith('data:')).length, 0),
  }));
  await page.screenshot({ path: path.join(outDir, `fusion-${scenario.name}-slide.png`) });
  await page.waitForFunction(() => [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionMergeShake'));
  const merge = await page.evaluate(() => [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionMergeShake'));
  await page.waitForFunction(() => [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionFlashBurst'));
  const flash = await page.evaluate(() => [...document.querySelectorAll('*')].some(node => getComputedStyle(node).animationName === 'fusionFlashBurst'));
  await page.screenshot({ path: path.join(outDir, `fusion-${scenario.name}-flash.png`) });
  await page.waitForFunction(() => document.body.innerText.includes('合体完了！'), { timeout: 5000 });
  const result = await page.evaluate(() => document.body.innerText.includes('合体完了！'));
  await clickButton(/^とじる$/);
  await page.waitForFunction(() => document.body.innerText.includes('合体・副を選ぶ'));
  const continued = await page.evaluate(() => ({
    onSubSelection: document.body.innerText.includes('合体・副を選ぶ'),
    mainSelected: document.body.innerText.includes('「主・染色モッチー」に絆経験値を渡す'),
    consumedSubAbsent: !document.body.innerText.includes('副・染色スエゾー')
      && !JSON.parse(localStorage.getItem('mh_masu_mons') || '[]').some(masu => masu.id === 'fusion-sub'),
    nextSubVisible: document.body.innerText.includes('次の副・ゴーレム'),
  }));
  await page.screenshot({ path: path.join(outDir, `fusion-${scenario.name}-continued.png`) });
  await clickButton(/次の副・ゴーレム/);
  await clickButton(/副1体で確認へ/);
  const nextFusionReady = await page.waitForFunction(() => document.body.innerText.includes('合体の確認')).then(() => true);
  await page.close();
  if (errors.length || !phase1.left || !phase1.right || phase1.dyedImages < 2 || !merge || !flash || !result || Object.values(continued).some(value => !value) || !nextFusionReady) {
    throw new Error(JSON.stringify({ errors, phase1, merge, flash, result, continued, nextFusionReady }));
  }
  console.log(`OK: ${scenario.breakthrough ? '限界突破して合体' : '通常合体'} — animation / result / return with main selected / next sub ready`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const scenario of scenarios) await run(browser, scenario);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
