const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// いま本番で使っているバトルチュートリアル(バトルの仕組みえらびから始まる版)を
// 実際のブラウザで通してみる。
//
//   ① デバッグ設定から「バトルチュートリアル開始」で始まる
//   ② ふだんの入口(仕組みえらび)から始まり、3つの仕組み → クラシックの3モードの順に説明が出る
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
// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const root = path.resolve(TOOLS_DIR, '..');
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
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      // わざと「まだ見ていない」状態にしておき、お試し再生で書き換わらないことを確かめる
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(false));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      // お詫びの配布は画面全体を覆う。配布済みの印を先に入れて出さない
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });

    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
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
    // DEBUG MENU は節ごとに畳んであるアコーディオン。「⚔️ バトル」→「📖 チュートリアル」の順に開く
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('summary').filter({ hasText: '📖 チュートリアル' }).first().click();
    const startButton = page.getByRole('button', { name: 'バトルチュートリアル開始（記録は残りません）' });
    check('デバッグ設定にチュートリアルの入口がある', await startButton.count() === 1);
    await startButton.dispatchEvent('click');
    // ★2026-09-21: ふだん HOME の「モンヒロバトル」を押すと最初に出るのは
    //   バトルの仕組みえらび。練習もここから始める
    await page.getByText('どのバトルで遊ぶかを選びます').first().waitFor({ timeout: 15000 });
    check('ふだんの入口(バトルの仕組みえらび)から始まる', true);

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

    // --- ②-1 入口の3つの仕組みの説明が順に出る ---
    check('チュートリアルの吹き出しが出ている', (await bubbleText() || '').includes('れんしゅう'), String(await bubbleText()).slice(0, 40));
    const saidSystem = [];
    for (let i = 0; i < 10; i++) {
      const t = await bubbleText();
      if (t) saidSystem.push(t);
      if (!(await tapNext())) break;
    }
    const allSystem = saidSystem.join(' | ');
    check('クラシック・タクティクス・クイックの3つを説明する',
      ['クラシック', 'タクティクス', 'クイック'].every(w => allSystem.includes(w)),
      `${saidSystem.length}ステップぶん読んだ`);
    check('それぞれの中身にも触れる',
      allSystem.includes('力を合わせて') && allSystem.includes('1体ずつライフ') && allSystem.includes('1.5倍'));

    // --- ②-2 仕組みえらびでも台本から外れる操作を止める ---
    check('練習中は戻るが押せない(仕組みえらび)', await page.getByRole('button', { name: '戻る' }).isDisabled());
    // ★練習は記録を残さないために debugBattle を立てるが、その副作用で入口の並びが
    //   「ふだん遊ぶときと違う見え方」になってはいけない(準備中・β版・DEBUGの出し分け)
    check('練習中もふだんと同じ枚数のカードが並ぶ',
      await page.locator('[data-battle-system-card]').count() === 3,
      `${await page.locator('[data-battle-system-card]').count()}枚`);
    check('練習中はクラシック以外の仕組みを選べない',
      await page.locator('[data-battle-system="systemQuick"]').isDisabled()
        && await page.locator('[data-battle-system="systemTactics"]').isDisabled());
    check('練習中は「詳しいルール」が押せない',
      await page.locator('[data-battle-system-info]').first().isDisabled());
    check('クラシックのカードは押せる',
      await page.locator('[data-battle-system="systemClassic"]').isEnabled());

    // --- ②-3 クラシックを選ぶとモードえらびへ進む ---
    await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    check('クラシックを選ぶとモード選択へ進む', true);
    const saidMode = [];
    for (let i = 0; i < 10; i++) {
      const t = await bubbleText();
      if (t) saidMode.push(t);
      if (!(await tapNext())) break;
    }
    const allMode = saidMode.join(' | ');
    check('クラシックの中の3モードを説明する',
      ['チャレンジ', '種族チャレンジ', 'プロ'].every(w => allMode.includes(w)),
      `${saidMode.length}ステップぶん読んだ`);
    // ★クイックはモードではなく仕組みの側にある。ここで「となりはクイック」と
    //   説明すると、実際に並んでいる種族チャレンジのカードと食い違う
    //   (2026-09-21 ユーザー指摘)
    check('モード選択でクイックの話をしない', !allMode.includes('クイック'), allMode.slice(0, 60));
    check('3つのモードの中身にも触れる',
      allMode.includes('スコア') && allMode.includes('ひとつの種族') && allMode.includes('ベースモンだけ'));

    // --- ③ 練習中は台本から外れる操作を止める ---
    check('練習中は戻るが押せない', await page.getByRole('button', { name: '戻る' }).isDisabled());
    check('練習中はランキングのタブが押せない',
      await page.getByRole('button', { name: 'ブリーダーLvランキング' }).isDisabled()
        && await page.getByRole('button', { name: '絆Lvランキング' }).isDisabled());
    check('練習中はモードの説明が押せない',
      await page.getByRole('button', { name: 'このモードの説明' }).first().isDisabled());
    check('練習中はスコアランキングへ入れない',
      await page.locator('[data-battle-mode="challenge"]').first()
        .getByRole('button', { name: /このモードのランキング/ }).isDisabled());

    // --- ④ チャレンジだけ進める ---
    // ★2026-09-20 に「どのバトルで遊ぶか」の画面が1段増え、クイックは別の仕組みへ移った。
    //   クラシックの並びは チャレンジ・種族チャレンジ・プロ の3枚になっている
    const startOf = (label, name = '難易度を選ぶ') => page.locator('article').filter({ hasText: label }).first().getByRole('button', { name });
    check('チャレンジの「難易度を選ぶ」は押せる', await startOf('チャレンジモード').isEnabled());
    check('種族チャレンジの「種族を選ぶ」は押せない', await startOf('種族チャレンジ', '種族を選ぶ').isDisabled());
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
    // ★練習は記録を残さないために debugBattleRef を立てるので、その副作用で
    //   勇者モン選択へ「🛠 デバッグ最強モン」(Mocchiのコピーでidも同じ)が割り込み、
    //   台本の heroId による絞り込みで本物のモッチーが一覧から消えていた。
    //   そのまま進むと台本の敵を一撃で倒してしまい、固有技までの説明が飛ぶ
    check('練習の勇者モン選択にデバッグ個体が並ばない',
      await page.getByText('デバッグ最強モン').count() === 0);
    const mocchiCard = page.locator('button').filter({ hasText: 'モッチー' }).first();
    check('台本どおりモッチーを選べる',
      await mocchiCard.count() === 1 && await mocchiCard.isEnabled());

    // --- ⑥-2 バトル画面まで通し、押す先(ACTION)がちゃんと光るか ---
    // セリフでは「ACTIONを押して」と言うのに、押す先のボタンは一度も光っていなかった
    // (2026-09-12・ユーザー指摘)。台本と画面の結びつきは静的な検査でも見ているが、
    // 実際に光るのは実物を動かさないと分からないので、ここで確かめる
    // ★ACTIONボタンは押せない理由を文字で出す(「カードを選ぶ」「置き場所を選ぶ」)ので、
    //   文字ではなく data-battle-action で見分ける
    const spots = () => page.evaluate(() => [...document.querySelectorAll('.is-battle-tutorial-spot')]
      .map(el => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20),
        action: !!el.closest('[data-battle-action]') || !!el.querySelector('[data-battle-action]'),
      })));
    await page.locator('button').filter({ hasText: 'モッチー' }).first().dispatchEvent('click');
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^勇者モンに選ぶ$/ }).first().dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: /^近距離/ }).first().dispatchEvent('click');
    await page.waitForTimeout(500);
    // アシストカードは2026-09-18に「おりょうの力」から「ニコラオの力」へ名前が変わった
    await page.locator('button').filter({ hasText: /^ニコラオの力/ }).first().dispatchEvent('click');
    await page.waitForTimeout(400);
    await page.locator('button').filter({ hasText: /^習得する$/ }).first().dispatchEvent('click');
    await page.waitForTimeout(1200);
    check('練習のままバトル画面まで進む',
      await page.locator('[data-battle-action]').count() >= 1);
    // 画面の見かたの説明を順に進め、ACTIONボタンの説明まで来たら光っているものを見る
    let actionSpots = null;
    for (let i = 0; i < 30; i++) {
      const t = await bubbleText();
      if (t && t.includes('ACTIONで実行')) { actionSpots = await spots(); break; }
      if (!(await tapNext())) break;
    }
    check('ACTIONの説明でACTIONボタンが光る',
      Array.isArray(actionSpots) && actionSpots.length === 1 && actionSpots[0].action === true,
      JSON.stringify(actionSpots));
    // ガードを使う番(操作待ち)まで進める。吹き出しが消えて「つぎへ」も無くなる
    for (let i = 0; i < 12; i++) if (!(await tapNext())) break;
    const doSpots = await spots();
    check('カードを使う番はACTIONも光る',
      doSpots.some(s => s.action) && doSpots.some(s => /ガード/.test(s.text)),
      JSON.stringify(doSpots));

    // --- ⑦ やめると始めた場所へ帰り、既読は書き換わらない ---
    await page.locator('button').filter({ hasText: /^やめる$/ }).first().dispatchEvent('click');
    // 帰ってきた DEBUG MENU は節が畳まれた状態なので、開き直して入口があることを確かめる
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 15000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('summary').filter({ hasText: '📖 チュートリアル' }).first().click();
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
