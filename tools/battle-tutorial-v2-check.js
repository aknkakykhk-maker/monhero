// いま本番で使っているバトルチュートリアル(新しいモード選択から始まる版)を
// 実際のブラウザで通してみる。
//
//   ① デバッグ設定から「新バトルチュートリアルを見る（お試し）」で始まる
//   ② 新しいモード選択の画面から始まり、3モードの説明が順に出る
//   ③ 練習中は戻る・ランキング・モードの説明が押せない(台本から外れない)
//   ④ チャレンジ以外の「難易度を選ぶ」は押せない(初回にクイック・プロを遊ばせない)
//   ⑤ 難易度選択はビギナーから始まり、ビギナー以外は押せない
//   ⑥ 勇者モン選択まで進む
//   ⑦ 「やめる」で始めた場所(デバッグ設定)へ帰り、既読フラグを書き換えていない
//   ⑧ どこを通っても実行時エラー(真っ白)が出ない
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const PORT = 8983;

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
      // わざと「まだ見ていない」状態にしておき、お試し再生で書き換わらないことを確かめる
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(false));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
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

    // --- ① デバッグ設定からチュートリアルを始める(ふだんの初回案内・ヘルプと同じ台本) ---
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    const startButton = page.getByRole('button', { name: 'バトルチュートリアル開始（記録は残りません）' });
    check('デバッグ設定にチュートリアルの入口がある', await startButton.count() === 1);
    await startButton.dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('新しいモード選択の画面から始まる', true);

    // 吹き出しの見出しを読みながら「つぎへ」で進める
    // 吹き出しの中身。枠は role="dialog" aria-label="バトルチュートリアル" で出ている
    const bubbleText = () => page.evaluate(() => {
      const box = document.querySelector('[aria-label="バトルチュートリアル"]');
      return box ? box.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    const tapNext = async () => {
      const next = page.locator('button').filter({ hasText: /^つぎへ$/ });
      if (await next.count() === 0) return false;
      await next.first().dispatchEvent('click');
      await page.waitForTimeout(220);
      return true;
    };

    // --- ② 3モードの説明が順に出る ---
    check('チュートリアルの吹き出しが出ている', (await bubbleText() || '').includes('れんしゅう'), String(await bubbleText()).slice(0, 40));
    const said = [];
    for (let i = 0; i < 8; i++) {
      const t = await bubbleText();
      if (t) said.push(t);
      if (!(await tapNext())) break;
    }
    const allSaid = said.join(' | ');
    check('チャレンジ・クイック・プロの3つを説明する',
      ['チャレンジ', 'クイック', 'プロ'].every(w => allSaid.includes(w)),
      `${said.length}ステップぶん読んだ`);
    check('3つのモードの中身にも触れる',
      allSaid.includes('スコア') && allSaid.includes('1.5倍') && allSaid.includes('難しい'));

    // --- ③ 練習中は台本から外れる操作を止める ---
    check('練習中は戻るが押せない', await page.getByRole('button', { name: '戻る' }).isDisabled());
    check('練習中はランキングのタブが押せない',
      await page.getByRole('button', { name: 'ブリーダーLvランキング' }).isDisabled()
        && await page.getByRole('button', { name: '絆Lvランキング' }).isDisabled());
    check('練習中はモードの説明が押せない',
      await page.getByRole('button', { name: 'このモードの説明' }).first().isDisabled());
    check('練習中はスコアランキングへ入れない',
      await page.getByRole('button', { name: /チャレンジモードのランキング/ }).first().isDisabled());

    // --- ④ チャレンジだけ進める ---
    const startOf = (label) => page.locator('article').filter({ hasText: label }).first().getByRole('button', { name: '難易度を選ぶ' });
    check('チャレンジの「難易度を選ぶ」は押せる', await startOf('チャレンジモード').isEnabled());
    check('クイックの「難易度を選ぶ」は押せない', await startOf('クイックモード').isDisabled());
    check('プロの「難易度を選ぶ」は押せない', await startOf('プロモード').isDisabled());

    await startOf('チャレンジモード').dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    check('難易度選択へ進める', true);

    // --- ⑤ ビギナーから始まり、ビギナー以外は押せない ---
    const centered = () => page.evaluate(() => {
      const rootEl = document.querySelector('.snap-mandatory');
      const c = rootEl.scrollLeft + rootEl.clientWidth / 2;
      let best = null, d = Infinity;
      [...rootEl.children].forEach((card) => {
        const n = Math.abs(card.offsetLeft + card.offsetWidth / 2 - c);
        if (n < d) { d = n; best = card; }
      });
      return best ? best.querySelector('h3').textContent.trim() : null;
    });
    check('練習中の難易度はビギナーから始まる', await centered() === 'Beginner', String(await centered()));
    const startOfDiff = (label) => page.locator('.snap-mandatory > article').filter({ hasText: label }).first().getByRole('button', { name: 'この難易度で挑戦' });
    check('ビギナーは押せる', await startOfDiff('Beginner').isEnabled());
    check('ビギナー以外は押せない', await startOfDiff('Hard').isDisabled());

    // --- ⑥ 勇者モン選択まで進む ---
    for (let i = 0; i < 4; i++) if (!(await tapNext())) break;
    await startOfDiff('Beginner').dispatchEvent('click');
    await page.getByRole('heading', { name: '勇者モンを選択' }).waitFor({ timeout: 15000 });
    check('練習のまま勇者モン選択まで進む', true);

    // --- ⑦ やめると始めた場所へ帰り、既読は書き換わらない ---
    await page.locator('button').filter({ hasText: /^やめる$/ }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'バトルチュートリアル開始（記録は残りません）' }).waitFor({ timeout: 15000 });
    check('やめると始めた場所(デバッグ設定)へ帰る', true);
    const seen = await page.evaluate(() => localStorage.getItem('mh_battle_tutorial_seen_v1'));
    check('お試し再生で既読フラグを書き換えない', seen === 'false' || seen === JSON.stringify(false), String(seen));

    // --- ⑧ 実行時エラー ---
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');

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
