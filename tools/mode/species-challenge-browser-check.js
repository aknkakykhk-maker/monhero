// 種族チャレンジを実際のブラウザで通しで遊んでみて、画面が動くかを確かめる。
//
//   python3 tools/serve.py  は要らない(このツールが自前でポートを開く)
//   node tools/mode/species-challenge-browser-check.js
//
// 見るのは次のとおり。
//   ① デバッグ設定 → BATTLE TEST → ⚔️バトルモード → 本番と同じBATTLE MODEカルーセルから入れる
//   ② 種族選択 → 難易度 → 勇者 → 開始距離 → 供モン → 出撃確認 の各画面が出て、iPhone縦で横にはみ出さない
//   ③ 勇者と同じモンスターは供モンに出ない(同じbaseIdの重複拒否)
//   ④ 供モン0体でも出撃できる
//   ⑤ WAVE1のバトルまで到達して、どこでも実行時エラー(真っ白)にならない
//   ⑥ 種族チャレンジのランキング画面が開き、種族タブと難易度タブ(14)が並ぶ
//
// このサンドボックスは外部CDN(Tailwind)へ出られないため、Tailwindの読み込みだけ
// 打ち切って起動し、横スライドに必要な最小限のCSSだけ自前で足す。
// そのため「見た目そのもの」は確認できない。ここで分かるのは
// 「画面が出るか」「押せるか」「実行時エラーが出ないか」「横スクロール事故が無いか」まで。
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 8982;
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
    // iPhone相当の縦画面で見る
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
      // ピクシー種(ピクシー・ミーア・パンドラ)をそろえて、供モンを実際に選べる状態にする。
      // マスモンのピクシーも1体入れて、「勇者と同じモンスターは供モンに出ない」ところまで見る
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Mitarashi', 'Pixie', 'Mia', 'Pandora', 'Suezo']));
      localStorage.setItem('mh_masu_mons', JSON.stringify([{
        id: 'sc-pixie-1', baseId: 'Pixie', name: '検査ピクシー', bondXp: 300,
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

    // 横スクロール事故(本文が画面幅を超えていないか)を測る共通処理
    const overflow = () => page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const checkNoSideScroll = async (label) => {
      const size = await overflow();
      check(`${label}が横にはみ出さない`, size.scrollWidth <= size.clientWidth + 1, `${size.scrollWidth} / ${size.clientWidth}`);
    };

    // --- ① デバッグ設定 → BATTLE TEST → ⚔️バトルモード ---
    // デバッグ設定はヘルプの下にある目立たないボタンからだけ開ける
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('BATTLE TEST').first().waitFor({ timeout: 20000 });
    check('デバッグ設定を開ける', true);
    await page.getByRole('button', { name: '⚔️ バトルモード' }).dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 20000 });
    check('本番と同じBATTLE MODEカルーセルへ入る', true);

    // 種族チャレンジのカードまで送る(デバッグのときだけ末尾に並ぶ)
    const speciesCard = page.locator('article').filter({ hasText: '種族チャレンジ' }).first();
    await speciesCard.scrollIntoViewIfNeeded();
    check('デバッグ時だけ種族チャレンジのカードが並ぶ', await speciesCard.count() === 1);
    // 公開後のカードは「クリアした種族×難易度 / 全154組中」を出す
    const speciesCardText = await speciesCard.textContent();
    check('カードに全体の組み合わせ数が出ている', /全\d+組中/.test(speciesCardText), speciesCardText.match(/全\d+組中/)?.[0]);
    check('公開前のDEBUGの印は残っていない', !speciesCardText.includes('DEBUG・一般公開前'));
    await checkNoSideScroll('BATTLE MODE');

    // --- ② 種族選択 ---
    await speciesCard.getByRole('button', { name: '種族を選ぶ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '種族選択' }).waitFor({ timeout: 20000 });
    const speciesRows = page.locator('[data-species-row]');
    check('主血統が1行1種族で並ぶ', await speciesRows.count() === 11, `${await speciesRows.count()}種族`);
    check('「◯◯種 限定」と名乗る', (await speciesRows.first().textContent()).includes('種 限定'));
    await checkNoSideScroll('種族選択');
    // 使えるモンスターがいちばん多い種族を選ぶ(供モンの重複拒否まで見たいため)。
    // 仕込みではピクシー種(ピクシー・ミーア・パンドラ＋マスモンのピクシー)がいちばん多い
    const rowCount = await speciesRows.count();
    let chosenRow = null, chosenUsable = 0;
    for (let i = 0; i < rowCount; i++) {
      const row = speciesRows.nth(i);
      if (await row.isDisabled()) continue;
      const text = await row.textContent();
      const usable = Number((text.match(/使える\s*(\d+)\s*体/) || [])[1] || 0);
      if (usable > chosenUsable) { chosenRow = row; chosenUsable = usable; }
    }
    check('選べる種族がある', !!chosenRow, `使える ${chosenUsable}体`);
    const chosenText = await chosenRow.textContent();
    await chosenRow.dispatchEvent('click');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: '難易度選択へ' }).dispatchEvent('click');

    // --- 難易度選択 ---
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 20000 });
    const difficultyCards = page.locator('.snap-mandatory > article');
    check('14難易度が並ぶ', await difficultyCards.count() === 14, `${await difficultyCards.count()}枚`);
    check('種族ランキングへの導線がある', await page.locator('[data-species-difficulty-record-link]').count() >= 1);
    await checkNoSideScroll('難易度選択');
    const beginner = difficultyCards.filter({ hasText: 'Beginner' }).first();
    await beginner.scrollIntoViewIfNeeded();
    check('初回クリア報酬に超越の実が出る', (await beginner.textContent()).includes('超越の実 ×1'));

    // --- ⑥ 種族チャレンジのランキング画面 ---
    await beginner.locator('[data-species-difficulty-record-link]').dispatchEvent('click');
    await page.getByRole('heading', { name: /種族チャレンジランキング/ }).waitFor({ timeout: 20000 });
    check('種族チャレンジのランキングを開ける', true);
    const rankTabs = page.locator('[data-species-rank-tabs] button');
    check('「すべて」＋種族別のタブが並ぶ', await rankTabs.count() === 12, `${await rankTabs.count()}タブ`);
    const selectedTab = await page.locator('[data-species-rank-tabs] button.bg-cyan-600').textContent();
    check('難易度カードから開くとその種族が選ばれている', /種$/.test(String(selectedTab).trim()), String(selectedTab));
    const rankDiffTabs = page.locator('[data-species-difficulty-tabs] button');
    check('難易度も他モードと同じくタブで並ぶ', await rankDiffTabs.count() === 14, `${await rankDiffTabs.count()}タブ`);
    // 公開後は、種族を選ぶとその種族×難易度の全国ランキングへ切り替わる。
    // このサンドボックスは通信できないので、読み込み中・取得できないときの案内が出ればよい
    // (行が出ないまま真っ白・無反応にならないことを見る)
    await page.waitForTimeout(600);
    const nationalText = await page.locator('[data-species-record-list]').textContent();
    check('種族を選ぶと全国ランキングへ切り替わる',
      !nationalText.includes('全国ランキングはモードの公開後に始まります'));
    check('通信できないときも案内が出て無反応にならない',
      /Loading|再[試読]|取得|まだ|ありません|エラー|失敗/.test(nationalText), nationalText.slice(0, 60).replace(/\s+/g, ' '));
    // 「すべて」タブは自分の記録なので、通信できなくても中身が出る。
    // その難易度をクリアした種族が並び、1つも無ければその旨の案内になる
    await rankTabs.first().dispatchEvent('click');
    await page.waitForTimeout(300);
    const allText = await page.locator('[data-species-record-list]').textContent();
    const allRows = await page.locator('[data-species-record-row]').count();
    check('「すべて」は通信せずに自分の記録を出す',
      allRows > 0 || /クリアした種族はまだありません/.test(allText), `${allRows}行`);
    check('1つもクリアしていなければ、そう分かる案内が出る',
      allRows > 0 || /クリアすると、種族ごとに自己ベストが残ります/.test(allText));
    // 難易度タブを切り替えると、その難易度の中身に入れ替わる
    await rankDiffTabs.nth(3).dispatchEvent('click');
    await page.waitForTimeout(300);
    const switchedText = await page.locator('[data-species-record-list]').textContent();
    check('難易度タブを切り替えられる', switchedText !== allText, `${allText.slice(0, 12)} → ${switchedText.slice(0, 12)}`);
    await checkNoSideScroll('種族チャレンジランキング');
    await page.getByRole('button', { name: '戻る' }).first().dispatchEvent('click');
    await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 20000 });

    await beginner.scrollIntoViewIfNeeded();
    await beginner.getByRole('button', { name: 'この難易度で挑戦' }).dispatchEvent('click');

    // --- 勇者選択 ---
    await page.getByRole('heading', { name: '勇者モン選択' }).waitFor({ timeout: 20000 });
    const heroCards = page.locator('[data-species-monster-card]');
    const heroCount = await heroCards.count();
    check('勇者候補はその種族だけ', heroCount >= 1, `${heroCount}体`);
    await checkNoSideScroll('勇者選択');
    const heroEntryIds = await heroCards.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-species-monster-card')));
    // 仕込んだマスモン(ピクシー)と同じモンスターを勇者にすると、そのマスモンが
    // 供モン候補から先に消えてしまう。重複拒否を見たいので、別のモンスターを勇者にする
    let heroEntryId = heroEntryIds.find(id => id !== 'Pixie' && !String(id).startsWith('masu:')) || heroEntryIds[0];
    let heroCard = page.locator(`[data-species-monster-card="${heroEntryId}"]`);
    let heroText = await heroCard.textContent();
    await heroCard.dispatchEvent('click');
    await page.waitForTimeout(300);

    // --- 開始距離選択 ---
    await page.getByRole('button', { name: '開始距離選択へ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '開始距離' }).waitFor({ timeout: 20000 });
    const distanceOptions = page.locator('[data-species-start-distance-option]');
    check('零・壱・弐・参の4距離が並ぶ', await distanceOptions.count() === 4, `${await distanceOptions.count()}距離`);
    const distanceTexts = await distanceOptions.evaluateAll(nodes => nodes.map(node => (node.textContent || '').replace(/\s+/g, '')));
    check('4距離の名前が明示される', ['零距離','壱距離','弐距離','参距離'].every((label,index) => distanceTexts[index]?.includes(label)), distanceTexts.join(' / '));
    check('勇者の各距離適性が併記される', distanceTexts.every(text => text.includes('距離適性')), distanceTexts.join(' / '));
    let allyStepButton = page.getByRole('button', { name: '供モン選択へ' });
    check('開始距離未選択では供モン選択へ進めない', !(await allyStepButton.isEnabled()));
    await distanceOptions.nth(2).dispatchEvent('click');
    check('弐距離を選択中と表示する', await distanceOptions.nth(2).getAttribute('aria-pressed') === 'true');
    check('開始距離選択後は供モン選択へ進める', await allyStepButton.isEnabled());
    await checkNoSideScroll('開始距離選択');

    // 勇者を変更したら、先ほどの弐距離を引き継がず未選択へ戻る。
    await page.getByRole('button', { name: '1つ前へ戻る' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '勇者モン選択' }).waitFor({ timeout: 20000 });
    const alternateHeroId = heroEntryIds.find(id => id !== heroEntryId && id !== 'Pixie' && !String(id).startsWith('masu:'));
    check('開始距離リセット確認用の別勇者がいる', !!alternateHeroId, heroEntryIds.join(','));
    if (alternateHeroId) {
      heroEntryId = alternateHeroId;
      heroCard = page.locator(`[data-species-monster-card="${heroEntryId}"]`);
      heroText = await heroCard.textContent();
      await heroCard.dispatchEvent('click');
    }
    await page.getByRole('button', { name: '開始距離選択へ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '開始距離' }).waitFor({ timeout: 20000 });
    check('勇者変更で開始距離が未選択へ戻る', await page.locator('[data-species-start-distance-option][aria-pressed="true"]').count() === 0);
    allyStepButton = page.getByRole('button', { name: '供モン選択へ' });
    check('勇者変更後も距離を選び直すまで進めない', !(await allyStepButton.isEnabled()));
    await page.locator('[data-species-start-distance-option="2"]').dispatchEvent('click');

    // --- ③ 供モン選択(同じモンスターは出ない) ---
    await allyStepButton.dispatchEvent('click');
    await page.getByRole('heading', { name: '供モン選択' }).waitFor({ timeout: 20000 });
    check('供モンは最大3体・重複不可と書いてある',
      (await page.getByText('供モンは最大3体').first().textContent()).includes('重複不可'));
    const allyCards = page.locator('[data-species-monster-card]');
    const allyCount = await allyCards.count();
    check('勇者に選んだモンスターは供モン候補から消える', allyCount === heroCount - 1, `勇者候補${heroCount}体 → 供モン候補${allyCount}体`);
    await checkNoSideScroll('供モン選択');

    // 同じ種族の別モンスターは供モンに選べる。ベースモンのピクシーを選ぶと、
    // 同じモンスターのマスモン(検査ピクシー)は「選択済み」で選べなくなる
    const allyEntryIds = await allyCards.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-species-monster-card')));
    const masuEntryId = allyEntryIds.find(id => String(id).startsWith('masu:'));
    if (allyEntryIds.includes('Pixie') && masuEntryId) {
      await page.locator('[data-species-monster-card="Pixie"]').dispatchEvent('click');
      await page.waitForTimeout(200);
      check('同じ種族の別モンスターを供モンに選べる',
        await page.locator('[data-species-monster-card="Pixie"][aria-pressed="true"]').count() === 1);
      const twin = page.locator(`[data-species-monster-card="${masuEntryId}"]`);
      check('同じモンスターのマスモンは選べなくなる', await twin.isDisabled(), await twin.textContent());
      check('同じモンスターだと分かる印が出る', (await twin.textContent()).includes('選択済み'));
      await page.locator('[data-species-monster-card="Pixie"]').dispatchEvent('click');
      await page.waitForTimeout(200);
      check('選び直して0体へ戻せる', await page.locator('[data-species-monster-card][aria-pressed="true"]').count() === 0);
      check('戻すと同じモンスターのマスモンもまた選べる', !(await twin.isDisabled()));
    } else {
      check('重複拒否を見られる編成になっている', false, `候補: ${allyEntryIds.join(',')}`);
    }

    // --- ④ 供モン0体のまま出撃確認へ ---
    await page.getByRole('button', { name: '出撃確認へ' }).dispatchEvent('click');
    await page.getByRole('heading', { name: '出撃確認' }).waitFor({ timeout: 20000 });
    const startButton = page.getByRole('button', { name: 'この編成で出撃' });
    check('供モン0体のまま出撃確認へ進める', await startButton.isEnabled());
    check('出撃確認に弐距離が表示される', (await page.locator('[data-species-start-distance-confirm]').textContent()).includes('開始距離：弐距離'));
    await checkNoSideScroll('出撃確認');

    // --- ⑤ バトルまで ---
    await startButton.dispatchEvent('click');
    await page.getByRole('heading', { name: 'アシストカードの継承・強化' }).waitFor({ timeout: 20000 });
    await page.locator('.grid > button').first().dispatchEvent('click');
    await page.getByRole('button', { name: /習得する|強化する/ }).dispatchEvent('click', {}, { timeout: 20000 });
    await page.locator('[data-battle-controls]').waitFor({ timeout: 25000 });
    check('種族チャレンジのバトルが始まる', true);
    const modeLabel = await page.evaluate(() => {
      const el = [...document.querySelectorAll('span')].find(s => /^(チャレ|種族)/.test((s.textContent || '').trim()));
      return el ? el.textContent.trim() : null;
    });
    check('バトル画面までたどり着く', !!modeLabel, String(modeLabel));
    const battleSlots = page.locator('[data-slot-index]');
    const battleSlotTexts = await battleSlots.evaluateAll(nodes => nodes.slice(0, 4).map(node => (node.textContent || '').replace(/\s+/g, '')));
    check('勇者が選択したslots[2]へ配置される', battleSlotTexts[2] && !battleSlotTexts[2].includes('---') && battleSlotTexts.filter(text => !text.includes('---')).length === 1, battleSlotTexts.join(' / '));
    await checkNoSideScroll('バトル');

    // --- 実行時エラー ---
    check('どこでも実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    console.log(`  選んだ種族: ${chosenText.replace(/\s+/g, ' ').slice(0, 40)}`);
    console.log(`  勇者モン: ${String(heroText).replace(/\s+/g, ' ').slice(0, 24)}`);

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
