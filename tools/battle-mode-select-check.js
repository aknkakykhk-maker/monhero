// 新しいバトルの入口(バトルモード選択 → 難易度選択 → モード別スコアランキング)を
// 実際のブラウザで開いて、押して進めることを確かめる。
//
//   ① デバッグ設定からモード選択画面を開ける
//   ② 3モードがカードで並び、左右の矢印とドットで切り替わる
//   ③ クイックにはスコアランキングの導線が出ない(高さ合わせの空枠も出さない)
//   ④ モードカードのランキングからプロ専用ランキングへ入れる
//   ⑤ 難易度を選ぶ → 難易度カードが並ぶ → そこからもランキングへ入れる
//   ⑥ 難易度カードから入ったときは、その難易度のタブが最初に選ばれている
//   ⑦ 上のタブでブリーダーLv・絆Lvランキングへ切り替えられる
//   ⑧ どこを通っても実行時エラー(真っ白)が出ない
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
// 見た目(色・余白・折り返し)は確かめられないが、押せるか・回るか・実行時エラーが出ないかは観測できる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const PORT = 8979;

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
    // 既存ユーザーとして起動し、はじめての案内・バトル練習の案内は出さない
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    // 横スライドは overflow-x や flex の指定がないと動かない。ふだんはTailwindが当てているが、
    // ここではCDNへ出られないので、カルーセルが動くのに必要な最小限だけ自前で足す。
    // (色や余白は当たらないままなので、見た目の確認はできない)
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });

    // LOADING → TITLE → GAME
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    // 起動直後のモーダル(補償・案内)は片付けてから進む
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }

    // --- ① HOMEの「バトル」からモード選択を開く(本番の入口) ---
    await page.getByRole('button', { name: 'バトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('HOMEの「バトル」からモード選択が開く', true);

    // --- ② 4モードがカードで並ぶ(ぐるぐる回すため同じ並びを3回置いている) ---
    const MODE_LABELS = ['チャレンジモード', 'クイックモード', 'プロモード', '極限チャレンジ'];
    const modeCards = page.locator('.snap-mandatory > article');
    check('モードのカードが4モード×3周ぶん並んでいる', await modeCards.count() === MODE_LABELS.length * 3, `${await modeCards.count()}枚`);
    for (const label of MODE_LABELS) {
      check(`${label}のカードがある`, await page.getByRole('heading', { name: new RegExp(label) }).count() === 3);
    }
    check('前へ・次への矢印がある',
      await page.getByRole('button', { name: '前のモード' }).count() === 1
        && await page.getByRole('button', { name: '次のモード' }).count() === 1);
    // 端で止まらない。左へ回しても右へ回しても、いつまでも次のモードへ進める
    check('矢印は端でも止まらない',
      !(await page.getByRole('button', { name: '前のモード' }).isDisabled())
        && !(await page.getByRole('button', { name: '次のモード' }).isDisabled()));
    const centeredMode = () => page.evaluate(() => {
      const root = document.querySelector('.snap-mandatory');
      const c = root.scrollLeft + root.clientWidth / 2;
      let best = null, d = Infinity;
      [...root.children].forEach((card) => {
        const n = Math.abs(card.offsetLeft + card.offsetWidth / 2 - c);
        if (n < d) { d = n; best = card; }
      });
      return best ? best.querySelector('h3').textContent.replace(/\s/g, '') : null;
    });
    // モードの数だけ同じ向きに進めば元のモードへ戻ってくる(ぐるぐる回る)
    const seen = [];
    for (let i = 0; i <= MODE_LABELS.length; i++) {
      seen.push(await centeredMode());
      await page.getByRole('button', { name: '次のモード' }).dispatchEvent('click');
      await page.waitForTimeout(700);
    }
    check('右へ回し続けると一周して戻ってくる',
      seen[0] === seen[MODE_LABELS.length] && new Set(seen).size === MODE_LABELS.length, seen.join(' → '));
    const before = await centeredMode();
    await page.getByRole('button', { name: '前のモード' }).dispatchEvent('click');
    await page.waitForTimeout(700);
    const back = await centeredMode();
    check('左へも回せる', back !== null && back !== before, `${before} → ${back}`);

    // --- ③ ランキングの導線はチャレンジとプロだけ ---
    check('チャレンジのカードにランキングの導線がある',
      await page.getByRole('button', { name: /チャレンジモードのランキング/ }).count() === 3);
    check('プロのカードにランキングの導線がある',
      await page.getByRole('button', { name: /プロモードのランキング/ }).count() === 3);
    // 「ランキング対象外」はクイックのカードの特徴として1行出るが、
    // 既存画面にあった高さ合わせだけの空枠(押せない案内ボックス)は新UIには置かない
    check('クイックにはランキングの導線も高さ合わせの空枠も出さない',
      await page.getByRole('button', { name: /クイックモードのランキング/ }).count() === 0
        && await page.getByText('クイックモードはランキング対象外です').count() === 0);

    // --- ④ プロ専用ランキングへ入れる ---
    await page.getByRole('button', { name: /プロモードのランキング/ }).first().dispatchEvent('click');
    await page.getByRole('heading', { name: 'プロモードランキング' }).waitFor({ timeout: 15000 });
    check('プロモードのランキング画面へ入れる', true);
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('ランキングから戻るとモード選択へ帰る', true);

    // --- ⑤ 難易度選択へ進む ---
    // ドット(3ページ目)でプロモードへ寄せてから、そのカードの「難易度を選ぶ」を押す
    await page.getByRole('button', { name: '3ページ目' }).dispatchEvent('click');
    await page.waitForTimeout(700);
    check('ドットでプロモードへ移動できる', (await centeredMode()).includes('プロモード'), await centeredMode());
    await page.locator('article').filter({ hasText: 'プロモード' }).first().getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    check('難易度選択画面へ進める', await page.getByRole('heading', { name: 'プロモード' }).count() === 1);
    check('難易度のカードが9枚ある', await page.locator('.snap-mandatory > article').count() === 9,
      `${await page.locator('.snap-mandatory > article').count()}枚`);
    const psycheRewards = { Beginner:1, Easy:2, Normal:3, Hard:5, Expert:7, Master:10, GrandMaster:15, Hell:20, Legend:30 };
    for (const [difficulty, amount] of Object.entries(psycheRewards)) {
      const reward = page.locator(`[data-psyche-reward="${difficulty}"]`);
      check(`${difficulty}の虹のプシュケー報酬を表示する`,
        await reward.count() === 1 && (await reward.textContent()).includes(`×${amount}`));
    }
    // プロも実際に始められる(中身は tools/pro-mode-check.js が最後まで通して確かめる)
    check('プロも「この難易度で挑戦」から始められる',
      await page.getByRole('button', { name: 'この難易度で挑戦' }).first().isEnabled());
    // 開いた直後はいつでもノーマルが選ばれている(前に遊んだ難易度を引きずらない)
    const centeredDifficulty = () => page.evaluate(() => {
      const root = document.querySelector('.snap-mandatory');
      const c = root.scrollLeft + root.clientWidth / 2;
      let best = null, d = Infinity;
      [...root.children].forEach((card) => {
        const n = Math.abs(card.offsetLeft + card.offsetWidth / 2 - c);
        if (n < d) { d = n; best = card; }
      });
      return best ? best.querySelector('h3').textContent.trim() : null;
    });
    check('難易度の既定位置はノーマル', await centeredDifficulty() === 'Normal', String(await centeredDifficulty()));

    // --- ⑥ 難易度カードのランキングは、その難易度のタブが最初に選ばれる ---
    const hardCard = page.locator('.snap-mandatory > article').filter({ hasText: 'Hard' }).first();
    await hardCard.scrollIntoViewIfNeeded();
    await hardCard.getByRole('button', { name: /Hardのランキング/ }).dispatchEvent('click');
    await page.getByRole('heading', { name: 'プロモードランキング' }).waitFor({ timeout: 15000 });
    const selected = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.className.includes('ring-2 ring-white'));
      return btn ? btn.textContent.trim() : null;
    });
    check('難易度カードから入ると、その難易度のタブが選ばれている', selected === 'Hard', String(selected));

    // --- ⑦ 上のタブでブリーダーLv・絆Lvへ切り替えられる ---
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: '戻る' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    for (const [label, marker] of [['ブリーダーLv', 'ブリーダーLvランキング'], ['絆Lv', '絆Lvランキング']]) {
      await page.getByRole('button', { name: marker }).dispatchEvent('click');
      await page.waitForTimeout(400);
      check(`${label}ランキングのタブへ切り替えられる`,
        await page.getByText('BATTLE MODE').count() === 0);
    }
    await page.getByRole('button', { name: 'モード選択' }).dispatchEvent('click');
    await page.waitForTimeout(400);
    check('モード選択のタブへ戻れる', await page.getByText('BATTLE MODE').first().isVisible());

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
