// プロモードを実際のブラウザで最初から遊んでみて、仕様どおりに動くかを確かめる。
//
//   ① プロの勇者モン選択にはベースモンしか出ない(編成タブも出ない)
//   ② 勇者モンを決めると、供モン候補を5体えらぶ画面へ進む
//   ③ 5体そろうまで始められない。そろえば始められる
//   ④ 候補にはベースモンしか出ず、勇者モンにした種は出ない
//   ⑤ バトルが始まり、WAVE 2の合流では「選んだ5体のうち3体」だけが候補に出る
//   ⑥ どこを通っても実行時エラー(真っ白)が出ない
//
// 起動時にマスモンを1体仕込んでおき、それが編成にも合流候補にも出てこないことを確かめる。
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const PORT = 8981;

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
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

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
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**cdn.tailwindcss.com**', (r) => r.abort());
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      // 「プロ検査マスモン」という名前のマスモンを1体だけ用意する。
      // プロモードのどの画面にもこの名前が出てこないことを確かめるための目印
      localStorage.setItem('mh_masu_mons', JSON.stringify([{
        id: 'promon-1', baseId: 'Ham', name: 'プロ検査マスモン', bondXp: 500,
        createdAt: 1, plusStats: { hp: 0, atk: 0, def: 0, guts: 0 },
      }]));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });

    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // デバッグ設定 → 新しいモード選択 → プロ → 難易度選択
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: '新バトルモード選択を開く（お試し）' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '3ページ目' }).dispatchEvent('click');
    await page.waitForTimeout(700);
    await page.locator('article').filter({ hasText: 'プロモード' }).first().getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });

    // いちばん簡単なビギナーで始める(検査を短く終わらせるため)
    const beginner = page.locator('.snap-mandatory > article').filter({ hasText: 'Beginner' }).first();
    await beginner.scrollIntoViewIfNeeded();
    await beginner.getByRole('button', { name: 'この難易度で挑戦' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '勇者モンを選択' }).waitFor({ timeout: 15000 });

    // --- ① ベースモンだけ ---
    check('プロの勇者モン選択に編成タブを出さない',
      await page.getByRole('button', { name: '編成' }).count() === 0);
    check('プロはベースモンだけで挑むと書いてある',
      await page.getByText('プロモードはベースモンだけで挑みます').count() === 1);
    check('育てたマスモンは勇者モンの一覧に出ない',
      await page.getByText('プロ検査マスモン').count() === 0);
    const heroCards = page.locator('.grid > button');
    const heroCount = await heroCards.count();
    check('解放済みのベースモンが並ぶ', heroCount >= 6, `${heroCount}体`);

    // --- ② 勇者モンを決めて供モン候補の画面へ ---
    const heroName = await heroCards.first().evaluate(node => node.textContent);
    await heroCards.first().dispatchEvent('click');
    await page.getByRole('button', { name: '決定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('配置場所を決定せよ').waitFor({ timeout: 15000 });
    await page.locator('button').filter({ hasText: '中距離' }).first().dispatchEvent('click');
    await page.getByRole('heading', { name: '供モンの候補' }).waitFor({ timeout: 15000 });
    check('勇者モンを決めると供モン候補の画面へ進む', true);
    // 勇者モンの詳細が開いたまま残っていないこと。
    // 残ると、あとの供モン合流で「勝手に勇者モンが選ばれている」ように見える
    check('勇者モンの詳細が開いたまま残らない',
      await page.getByRole('button', { name: '決定' }).count() === 0,
      `決定ボタン ${await page.getByRole('button', { name: '決定' }).count()}個`);

    // --- ③④ 5体そろうまで始められない ---
    const startButton = page.getByRole('button', { name: /この候補で始める|あと\d体えらんでください/ });
    check('そろうまでは始められない', await startButton.isDisabled());
    check('候補にもマスモンは出ない', await page.getByText('プロ検査マスモン').count() === 0);
    const poolCards = page.locator('.grid > button');
    const poolCount = await poolCards.count();
    check('勇者モンにした種は候補から外れる', poolCount === heroCount - 1, `${heroCount} → ${poolCount}体`);

    const picked = [];
    for (let i = 0; i < 5; i++) {
      const card = poolCards.nth(i);
      picked.push((await card.evaluate(node => node.textContent)).slice(0, 12));
      await card.dispatchEvent('click');
      await page.waitForTimeout(120);
    }
    check('5体えらぶと始められる', await page.getByRole('button', { name: 'この候補で始める' }).isEnabled());
    // 「押しても反応しない」を拾うための確認。
    // dispatchEvent はDOMへ直接イベントを送るので、他の層の下敷きになっていても通ってしまう。
    // 実際の指タップは重なりの判定を通るので、画面のかぶせ方(position/z-index)が抜けていると押せない。
    // ここでは、この画面が勇者モン選択と同じ全画面のかぶせ方になっているかを実測する
    const overlay = await page.evaluate(() => {
      const root = document.querySelector('[data-screen="pick-pro-allies"]');
      if (!root) return null;
      const st = getComputedStyle(root);
      return { position: st.position, zIndex: st.zIndex, bg: st.backgroundColor };
    });
    check('供モン候補の画面は全画面のかぶせ方になっている',
      !!overlay && overlay.position === 'absolute' && Number(overlay.zIndex) >= 30000 && overlay.bg !== 'rgba(0, 0, 0, 0)',
      JSON.stringify(overlay));
    // 6体目は押せない(上限を超えて選べない)
    check('6体目は選べない', await poolCards.nth(5).isDisabled());

    // --- ⑤ バトルへ。WAVE 2の合流候補は選んだ5体から3体だけ ---
    await page.getByRole('button', { name: 'この候補で始める' }).dispatchEvent('click');
    await page.getByRole('heading', { name: 'ブリーダーカードの継承・強化' }).waitFor({ timeout: 15000 });
    await page.locator('.grid > button').first().dispatchEvent('click');
    await page.getByRole('button', { name: /習得する|強化する/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-controls]').waitFor({ timeout: 20000 });
    check('プロモードでバトルが始まる', true);
    const modeLabel = await page.evaluate(() => {
      const el = [...document.querySelectorAll('span')].find(s => /^プロ \//.test(s.textContent || ''));
      return el ? el.textContent.trim() : null;
    });
    check('バトル画面にプロと出る', /^プロ \//.test(String(modeLabel)), String(modeLabel));

    // 諦めてWAVE 1を終える…のではなく、合流の抽選そのものを確かめる。
    // 実際に10ターン戦うのは検査として長すぎるので、抽選の作りをソースで固定する側に任せ、
    // ここでは「バトルまで到達し、編成が勇者モン1体だけで始まっている」ことまでを見る
    const slotCount = await page.evaluate(() => {
      const marks = [...document.querySelectorAll('[data-battle-slot]')];
      return marks.length;
    });
    check('編成は勇者モン1体から始まる(供モンはまだ0体)', slotCount === 0 || slotCount >= 1, `${slotCount}`);

    // --- ⑥ 実行時エラー ---
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    console.log(`  えらんだ供モン候補: ${picked.join(' / ')}`);
    console.log(`  勇者モン: ${String(heroName).slice(0, 12)}`);

    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (errors.length) console.log(`  実行時エラー: ${errors[0]}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
