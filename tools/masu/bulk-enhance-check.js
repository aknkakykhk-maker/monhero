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

  // 大量配分と上限を確認できる強化ポイントを持つマスモンを1体用意する
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
      bondXp: 3000, distAptPoints: 100,
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

  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons'))[0]);
  const before = await stored();
  const clickExact = (label) => page.evaluate((wanted) => {
    const button = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === wanted);
    button?.click(); return !!button;
  }, label);
  const clickControl = (aria) => page.locator(`button[aria-label="${aria}"]`).click();
  const shownAllocation = () => page.evaluate(() => {
    const area = document.querySelector('[aria-label="強化の確定操作"]');
    const match = area?.innerText.match(/残りpt\s*(\d+)\s*\/\s*(\d+) pt/);
    return match ? { left:Number(match[1]), total:Number(match[2]), text:area.innerText } : null;
  });

  check('1P・5P・10P・MAXの共通切替がある', await page.locator('[aria-label="振り分け単位"] button').count() === 4);

  await clickExact('1P'); await clickControl('ライフを増やす');
  let allocation = await shownAllocation();
  check('1P配分', allocation && allocation.total-allocation.left === 1, allocation?.text);
  check('確定前はセーブ値が変わらない（1P）', JSON.stringify(await stored()) === JSON.stringify(before));

  await clickExact('5P'); await clickControl('ライフを増やす');
  allocation = await shownAllocation();
  check('5P配分', allocation && allocation.total-allocation.left === 6, allocation?.text);

  await clickExact('10P'); await clickControl('ちからを増やす');
  allocation = await shownAllocation();
  check('10P配分', allocation && allocation.total-allocation.left === 16, allocation?.text);
  check('＋で仮配分が増える', allocation && allocation.total-allocation.left === 16);
  await clickControl('ちからを減らす');
  allocation = await shownAllocation();
  check('−で選択単位ぶん仮配分が戻る', allocation && allocation.total-allocation.left === 6, allocation?.text);

  await click('配分をすべて取消');
  allocation = await shownAllocation();
  check('配分をすべて取消で下書きだけ0になる', allocation && allocation.left === allocation.total, allocation?.text);
  check('配分全取消でもセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));

  await clickExact('1P');
  const lifePlus = page.locator('button[aria-label="ライフを増やす"]');
  await lifePlus.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  await page.waitForTimeout(700);
  await lifePlus.dispatchEvent('pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  const held = await shownAllocation();
  await page.waitForTimeout(350);
  const stopped = await shownAllocation();
  check('長押しで連続配分できる', held && held.total-held.left >= 2, held?.text);
  check('指を離すと長押しtimerが停止する', held && stopped && held.left === stopped.left, stopped?.text);
  await click('配分をすべて取消');

  // Cから現行の最大段階までだけ上がり、余ったポイントは残る。
  await clickExact('MAX'); await clickControl('零距離適性を増やす');
  allocation = await shownAllocation();
  const maxDraftText = await text();
  check('MAX配分で距離適性が現行上限を超えない', /C\s*→\s*M/.test(maxDraftText), maxDraftText.match(/C\s*→\s*\S+/)?.[0]);
  check('距離適性上限で配分が止まりポイントが残る', allocation && allocation.left > 0, allocation?.text);
  await clickControl('零距離適性を減らす');
  allocation = await shownAllocation();
  check('MAXの−でその項目の仮配分をすべて戻す', allocation && allocation.left === allocation.total, allocation?.text);

  // MAXを上限のない能力へ使うと、残りポイントを超えず全量を使う。
  await clickControl('ライフを増やす');
  allocation = await shownAllocation();
  check('MAX配分は残りpt不足時に残量までで止まる', allocation && allocation.left === 0, allocation?.text);
  check('MAX下書き中もセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));
  await click('配分をすべて取消');

  // 最後は5Pを確定し、保存される量を検証する。
  await clickExact('5P'); await clickControl('零距離適性を増やす'); await clickControl('ライフを増やす');
  allocation = await shownAllocation();
  check('確定ボタンに使用合計ptが出る', allocation?.text.includes('10ptを使って強化する'), allocation?.text);
  check('確定直前もセーブ値が変わらない', JSON.stringify(await stored()) === JSON.stringify(before));
  await click('ptを使って強化する');
  await page.waitForTimeout(1800);
  const after = await stored();
  check('確定後のみポイントが正しく保存される', after.distAptPoints === before.distAptPoints - 10, `${before.distAptPoints} → ${after.distAptPoints}`);
  check('距離適性が5段階上がる', after.distApt[0] === 'SS', after.distApt.join(','));
  check('ライフが5ポイント分上がる', after.statPoints.hp === 50, `+${after.statPoints.hp}`);

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
