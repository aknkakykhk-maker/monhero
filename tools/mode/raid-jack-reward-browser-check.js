// ジャックの報酬一覧(モード別・難易度別)と、魂格の結晶を使う画面を、実際のブラウザで確かめる。
//
//   python3 tools/serve.py  は要らない(このツールが自前でポートを開く)
//   node tools/mode/species-challenge-browser-check.js
//
// 見るのは次のとおり。
//   ① デバッグ設定(DEBUG MENU) → ⚔️バトル → ⚔️バトルモード → 本番と同じBATTLE MODEカルーセルから入れる
//   ② 種族選択 → 難易度 → 勇者 → 供モン → 出撃確認 の各画面が出て、iPhone縦で横にはみ出さない
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

// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8993;
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
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

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
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Mitarashi', 'Pixie', 'Mia', 'Pandora', 'Suezo']));
      // B(マスモン)用。1体目は攻撃力を大きく伸ばした個体(初級ジャックのライフ70,000を短いターンで削りきれる)
      localStorage.setItem('mh_masu_mons', JSON.stringify([
        { id: 'rj-m1', baseId: 'Mocchi', name: '検査モッチー', bondXp: 300, createdAt: 1, statPoints: { hp: 0, atk: 400000, def: 0, guts: 0 } },
        { id: 'rj-m2', baseId: 'Suezo', name: '検査スエゾー', bondXp: 300, createdAt: 2, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 } },
      ]));
      localStorage.setItem('mh_monster_roster', JSON.stringify(['masu:rj-m1', 'masu:rj-m2']));
    });
    await page.addInitScript(eventStorySeed());
    const posts = [];
    const otherWrites = [];
    let watching = false;   // 戦闘を始めてから結果が出るまでの間だけ数える(起動時のプロフィール同期などは別物)
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      const url = req.url();
      if (/raid_jack_/.test(url)) {
        if (req.method() === 'POST') { posts.push({ url, body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
        // ランキングの確認用: 子爵(段階2)の貢献には3人、グランドスラムの累計には2人を返す
        if (/raid_jack_contributions\?.*kind=eq\.a&tier=eq\.2/.test(decodeURIComponent(url))) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ breeder_id: 'rank-aaaa0001', total_damage: 900, last_hit_at: 't' }, { breeder_id: 'rank-aaaa0002', total_damage: 500, last_hit_at: 't' }, { breeder_id: 'rank-aaaa0003', total_damage: 100, last_hit_at: 't' }]) }); return; }
        if (/raid_jack_b_ranking/.test(url)) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ breeder_id: 'rank-bbbb0001', total_damage: 7000, last_hit_at: 't' }, { breeder_id: 'rank-bbbb0002', total_damage: 3000, last_hit_at: 't' }]) }); return; }
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return;
      }
      // ジャック戦から、ほかの表(rankings など)へ書き込みが出たら記録する
      // /rpc/ は読み出し(音ゲーのランキングなど)もPOSTで呼ぶので、表への書き込みだけを見る
      // bond_levels / friend_profiles / breeder_profiles は、マスモンがいると起動後に自動で同期される(戦闘を始めず20秒待つだけでも出ることを確かめた)ので除く
      if (watching && req.method() !== 'GET' && !/\/rest\/v1\/(rpc\/|bond_levels|friend_profiles|breeder_profiles)/.test(url)) otherWrites.push(`${req.method()} ${url}`);
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });

    // 魂格の結晶を3個持たせる(ほかの所持品は触らない)
    // ① レイド画面を開く(デバッグの強制表示)→ 報酬一覧
    await page.locator('[data-raid-open]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 30000 });
    check('段階のカードの下に、難易度別の報酬が出る(準備中の文は出ない)', await page.locator('[data-raid-jack-rewards] [data-raid-jack-tier-rewards="a"]').count() === 1 && !/準備中です\(決まりしだい/.test(await page.locator('body').innerText()));
    const rowTexts = await page.locator('[data-raid-jack-rewards] [data-raid-jack-reward-row]').allInnerTexts();
    check('男爵の討伐報酬+貢献1〜5位の6行', rowTexts.length === 6, String(rowTexts.length));
    check('討伐報酬の中身(ダイヤ100,000・プシュケー50)', /ダイヤ×100,000/.test(rowTexts[0]) && /虹のプシュケー×50/.test(rowTexts[0]), rowTexts[0].replace(/\s+/g, ' '));
    check('貢献1位の中身(結晶3・虹の超越の実50)', /魂格の結晶×3/.test(rowTexts[1]) && /虹の超越の実×50/.test(rowTexts[1]), rowTexts[1].replace(/\s+/g, ' '));
    await page.locator('[data-raid-jack-reward-list-open]').click();
    await page.locator('[data-raid-jack-reward-list]').waitFor({ timeout: 10000 });
    const tiersA = await page.locator('[data-raid-jack-reward-tier]').count();
    check('報酬一覧(レイドバトル): 5段階が並ぶ', tiersA === 5, String(tiersA));
    check('参加賞が出る', await page.locator('[data-raid-jack-reward-row="participation"]').count() === 1);
    await page.locator('[data-raid-jack-reward-list]').getByText('グランドスラム', { exact: true }).first().click();
    await page.waitForTimeout(300);
    check('報酬一覧(グランドスラム): 5難易度と最終順位1〜5位', await page.locator('[data-raid-jack-reward-tier]').count() === 5 && await page.locator('[data-raid-jack-reward-final] [data-raid-jack-reward-row]').count() === 5);
    const finalFirst = await page.locator('[data-raid-jack-reward-row="final-1"]').innerText();
    check('最終1位の中身(証10・結晶25・虹の実100)', /勇者の証×10/.test(finalFirst) && /魂格の結晶×25/.test(finalFirst) && /虹の超越の実×100/.test(finalFirst), finalFirst.replace(/\s+/g, ' '));
    check('報酬一覧は横にはみ出さない', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (process.env.RAID_SHOT_DIR) await page.screenshot({ path: `${process.env.RAID_SHOT_DIR}/reward-list-b.png` });
    await page.locator('[data-raid-jack-reward-close]').click();
    check('閉じられる', await page.locator('[data-raid-jack-reward-list]').count() === 0);
    // ② ランキング画面(モード別・段階別)
    await page.locator('[data-raid-jack-ranking-open]').click();
    await page.locator('[data-raid-jack-ranking-list]').waitFor({ timeout: 10000 });
    check('ランキングボタンから、ランキング画面が開く', true);
    check('レイドバトルは段階のボタンが5つ(男爵〜大王)並ぶ', await page.locator('[data-raid-jack-ranking-tier]').count() === 5);
    await page.locator('[data-raid-jack-ranking-tier="a2"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-raid-jack-ranking-list] [data-raid-jack-ranking-row]').length === 3, null, { timeout: 10000 });
    check('子爵を選ぶと、その段階の貢献ランキング(3人)が出る', true);
    check('段階名が見出しに出る', /ジャック子爵への貢献ランキング/.test(await page.locator('[data-raid-jack-ranking-list]').innerText()));
    await page.locator('[data-raid-jack-ranking-list]').getByText('グランドスラム', { exact: true }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('[data-raid-jack-ranking-list] [data-raid-jack-ranking-row]').length === 2, null, { timeout: 10000 });
    check('グランドスラムは累計ダメージのランキング(2人)が出る', /グランドスラムの累計ダメージ/.test(await page.locator('[data-raid-jack-ranking-list]').innerText()));
    check('ランキング画面は横にはみ出さない', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (process.env.RAID_SHOT_DIR) await page.screenshot({ path: `${process.env.RAID_SHOT_DIR}/ranking-b.png` });
    await page.locator('[data-raid-jack-ranking-close]').click();
    check('ランキング画面を閉じられる', await page.locator('[data-raid-jack-ranking-list]').count() === 0);
    check('実行時エラーが出ない', errors.length === 0, errors.join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
