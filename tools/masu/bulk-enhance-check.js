const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// マスモンの「まとめて強化」が正しく動くかを実ブラウザで確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node masu/bulk-enhance-check.js
//
// 強化ポイントを持つマスモンをセーブデータとして流し込み、
// 振り分け → 確定 → ポイントとステータスが正しく変わるかを見る。
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  // このサンドボックスは外部CDN(Tailwind)へ出られず、待ち続けて起動が終わらない。
  // 見た目は測らない検証なので、読み込みを打ち切って先へ進める。
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});

  // 強化ポイントを10持つマスモンを1体用意する
  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
    localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
    localStorage.setItem('mh_onboarded', JSON.stringify(true));
    // 初回案内(村案内・バトル案内)は画面全体を覆うので、見た状態にしてから始める
    localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
    localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
    localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
    localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
    localStorage.setItem('mh_masu_mons', JSON.stringify([{
      id: 'masu_test', baseId: 'Suezo', name: 'テストスエゾー',
      bondXp: 3000, distAptPoints: 0,
      distApt: ['C', 'C', 'C', 'C'], statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
      createdAt: Date.now(),
    }]));
  });

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForTimeout(2500);

  // 起動画面もタイトルも onPointerDown で進むので、click ではなく pointerdown を送る
  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);

  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 30000 });
  await pointerDown({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(2500);

  const click = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);
  const clickAria = (aria) => page.evaluate((a) => {
    const b = document.querySelector(`button[aria-label="${a}"]`);
    if (b) b.click();
    return !!b;
  }, aria);

  // 初回ログインボーナス・はじめての案内などの重なりを閉じてからHOMEを操作する。
  // 残したままだとタップが重なりに吸われ、下のボタンを押せない
  for (let i = 0; i < 10; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /受け取|閉じる|スキップ/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(800);
    const blocked = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    if (!closed && !blocked) break;
  }

  // M/B管理 → マスモン一覧 → 対象を開く → 育成・カスタムの「強化」
  await clickAria('M/B管理');
  await page.waitForTimeout(1200);
  // 「マスモン」だけで探すと、みゅあの吹き出し(説明を開くボタン)に当たってしまう
  await click('マスモン一覧');
  await page.waitForTimeout(1200);
  await click('テストスエゾー');
  await page.waitForTimeout(1200);
  // 詳細の「育成・カスタム」から強化へ入る(以前の「強化する」ボタンはここへまとまった)
  const opened = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="テストスエゾーを強化"]');
    if (b) b.click();
    return !!b;
  });
  await page.waitForTimeout(900);
  check('詳細の育成・カスタムから強化の画面を開ける', opened);

  const text = () => page.evaluate(() => (document.body ? document.body.innerText : '').replace(/\s+/g, ' '));
  check('まとめて強化の枠が出ている', (await text()).includes('まとめて強化'));

  // 間合い適性を2段階、ライフを3ポイント振る
  const plusButtons = page.locator('button', { hasText: '＋' });
  const n = await plusButtons.count();
  check('振り分けの＋ボタンがある', n > 0, `${n}個`);
  for (let i = 0; i < 2; i++) { await plusButtons.nth(0).click(); await page.waitForTimeout(150); }
  // ステータス側の＋(間合い4つのあとに並ぶ)
  for (let i = 0; i < 3; i++) { await plusButtons.nth(4).click(); await page.waitForTimeout(150); }
  await page.waitForTimeout(300);
  // 強化ポイントは絆レベルに応じて自動補填されるため、実際の所持数を読んで相対で確かめる
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons'))[0]);
  const before = await stored();
  const beforeApply = await text();
  const shown = beforeApply.match(/残り (\d+) \/ (\d+)/);
  check('残りポイントが5つ減って表示される', !!shown && Number(shown[2]) - Number(shown[1]) === 5, shown ? shown[0] : '不明');
  check('表示の総数が所持ポイントと一致する', !!shown && Number(shown[2]) === before.distAptPoints, `表示${shown?shown[2]:'?'} / 実際${before.distAptPoints}`);

  await click('pt を使って強化する');
  await page.waitForTimeout(1800);
  const after = await stored();
  check('確定でポイントが5消費される', after.distAptPoints === before.distAptPoints - 5, `${before.distAptPoints} → ${after.distAptPoints}`);
  check('間合い適性が2段階上がる', after.distApt[0] === 'A', after.distApt.join(','));
  check('ライフが3ポイント分上がる', after.statPoints.hp === 30, `+${after.statPoints.hp}`);

  // 強化を終えたら、入口だったマスモン詳細へ戻る(一覧まで戻されると染色などを続けられない)
  await click('完了');
  await page.waitForTimeout(1200);
  const back = await text();
  check('強化から戻ると詳細へ戻る', back.includes('育成・カスタム') && back.includes('テストスエゾー'), back.slice(0, 60));

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'bulk-enhance.png') });
  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
