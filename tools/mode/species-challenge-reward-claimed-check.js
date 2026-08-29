// 種族チャレンジの「初回クリア報酬(超越の実)をもう受け取ったか」が画面で分かるかを、
// 実際のブラウザで確かめる。
//
//   node tools/mode/species-challenge-reward-claimed-check.js
//   (python3 tools/serve.py は要らない。このツールが自前でポートを開く)
//
// 【なぜ要るか】
// 初回クリア報酬は種族×難易度の組み合わせごとに1度きりで、2回目以降は何ももらえない。
// ところが難易度カードも出撃確認も「クリア報酬 超越の実 ×N」と出したままだったので、
// もう受け取った組み合わせでも、まだもらえるように見えていた。
//
// ここでは保存データに「クリア済み・受取済み」を1件だけ仕込んでから画面を開き、
//   ・受け取った難易度  … 取り消し線＋グレー＋「✅ 受取済み」
//   ・まだの難易度      … これまでどおりの色＋「初回クリアのみ」
//   ・クリア済みの難易度 … 見出しに ✅ が付く
//   ・出撃確認          … 受取済みならその旨を出す
// を、実際の描画から確かめる。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
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

// 仕込む種族と難易度。ピクシー種の Beginner だけ「クリア済み・受取済み」にして、
// 隣の Easy はまだ受け取っていない状態のまま残す(見分けが付くかを見るため)
const SPECIES_ID = 'pixie';
const CLAIMED_DIFFICULTY = 'Beginner';
const UNCLAIMED_DIFFICULTY = 'Easy';

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
    await page.addInitScript(([speciesId, claimed]) => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Mitarashi', 'Pixie', 'Mia', 'Pandora', 'Suezo']));
      // 既存の保存形式そのままに、1組だけ「クリア済み・受取済み」を仕込む
      localStorage.setItem('mh_species_challenge_progress_v1', JSON.stringify({
        species: { [speciesId]: {
          cleared: { [claimed]: true },
          firstRewardClaimed: { [claimed]: true },
          records: { [claimed]: { clears: 1, bestScore: 1234, bestTurns: 30 } },
        } },
        pendingRewards: {},
      }));
    }, [SPECIES_ID, CLAIMED_DIFFICULTY]);

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

    // デバッグ設定 → ⚔️バトルモード → 種族チャレンジ
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('BATTLE TEST').first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: '⚔️ バトルモード' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 20000 });
    const speciesCard = page.locator('article').filter({ hasText: '種族チャレンジ' }).first();
    await speciesCard.scrollIntoViewIfNeeded();
    await speciesCard.getByRole('button', { name: '種族を選ぶ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '種族選択' }).waitFor({ timeout: 20000 });

    // 仕込んだ種族(ピクシー種)を選ぶ
    const pixieRow = page.locator(`[data-species-row="${SPECIES_ID}"]`);
    check('仕込んだ種族の行がある', await pixieRow.count() === 1);
    check('種族の行にクリア数が反映されている', /クリア\s*1\s*\/\s*14/.test(await pixieRow.textContent()),
      (await pixieRow.textContent()).replace(/\s+/g, ' ').slice(0, 60));
    await pixieRow.dispatchEvent('click');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '難易度選択へ' }).dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 20000 });

    // --- ① 難易度カードの報酬欄 ---
    const claimedCard = page.locator(`[data-difficulty-card="${CLAIMED_DIFFICULTY}"]`);
    const unclaimedCard = page.locator(`[data-difficulty-card="${UNCLAIMED_DIFFICULTY}"]`);
    check(`${CLAIMED_DIFFICULTY}のカードがある`, await claimedCard.count() === 1);
    check(`${UNCLAIMED_DIFFICULTY}のカードがある`, await unclaimedCard.count() === 1);

    const claimedReward = claimedCard.locator('[data-psyche-reward]');
    const unclaimedReward = unclaimedCard.locator('[data-psyche-reward]');
    check('受け取った難易度の報酬欄が「受取済み」になっている',
      await claimedReward.getAttribute('data-species-reward-claimed') === 'true');
    check('まだの難易度の報酬欄は「受取済み」になっていない',
      await unclaimedReward.getAttribute('data-species-reward-claimed') === 'false');

    const claimedText = (await claimedReward.textContent()).replace(/\s+/g, ' ').trim();
    const unclaimedText = (await unclaimedReward.textContent()).replace(/\s+/g, ' ').trim();
    check('受け取った難易度に「受取済み」と出る', /受取済み/.test(claimedText), claimedText);
    check('まだの難易度には「受取済み」と出ない', !/受取済み/.test(unclaimedText), unclaimedText);
    check('まだの難易度は1度きりであることが分かる', /初回クリアのみ/.test(unclaimedText), unclaimedText);
    // 見た目そのもの(色・取り消し線)は、このサンドボックスがTailwindのCSSを読めないため
    // getComputedStyle では確かめられない。実際の見た目を決めているclassが
    // 受取済み／まだで正しく切り替わっているかを見る
    const claimedClass = await claimedReward.locator('b').first().getAttribute('class');
    const unclaimedClass = await unclaimedReward.locator('b').first().getAttribute('class');
    check('受け取った難易度の報酬はグレー＋取り消し線のclassになる',
      /text-slate-500/.test(claimedClass) && /line-through/.test(claimedClass), claimedClass);
    check('まだの難易度の報酬はこれまでどおりの色のまま',
      /text-amber-200/.test(unclaimedClass) && !/line-through/.test(unclaimedClass), unclaimedClass);
    const claimedBoxClass = await claimedReward.getAttribute('class');
    const unclaimedBoxClass = await unclaimedReward.getAttribute('class');
    check('受け取った難易度は枠ごとグレーに落ちる',
      /bg-slate-900/.test(claimedBoxClass) && /bg-fuchsia-950/.test(unclaimedBoxClass));

    // --- ② 見出しのクリア済みマーク ---
    check('クリア済みの難易度は見出しに✅が付く',
      await claimedCard.locator(`[data-species-cleared-mark="${CLAIMED_DIFFICULTY}"]`).count() === 1);
    check('クリアしていない難易度には✅が付かない',
      await unclaimedCard.locator('[data-species-cleared-mark]').count() === 0);

    // --- ③ 出撃確認 ---
    // 受取済みの Beginner で編成を組み、出撃確認の表示を見る
    await claimedCard.scrollIntoViewIfNeeded();
    await claimedCard.getByRole('button', { name: 'この難易度で挑戦' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '勇者モン選択' }).waitFor({ timeout: 20000 });
    await page.locator('[data-species-monster-card]').first().dispatchEvent('click');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '供モン選択へ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '供モン選択' }).waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: '出撃確認へ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '出撃確認' }).waitFor({ timeout: 20000 });
    const confirmReward = page.locator('[data-species-confirm-reward]');
    check('出撃確認でも受取済みだと分かる',
      await confirmReward.getAttribute('data-species-confirm-reward') === 'claimed');
    check('出撃確認の本文にも「受取済み」と出る',
      /受取済み/.test(await confirmReward.textContent()),
      (await confirmReward.textContent()).replace(/\s+/g, ' ').trim());

    check('どこでも実行時エラーが出ていない', errors.length === 0, errors[0] || '');
  } catch (e) {
    check('確認できませんでした', false, String(e && e.message ? e.message : e));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
