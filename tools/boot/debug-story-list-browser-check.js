// デバッグ設定の「全ストーリーを確認」を、実際のブラウザで確かめる。
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
const PORT = 8995;
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
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      const url = req.url();
      if (/raid_jack_/.test(url)) {
        if (req.method() === 'POST') { posts.push({ url, body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
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
    const keysBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay/i.test(k)))));
    const btn = page.locator('[data-debug-story-list]');
    await btn.evaluate((el) => { let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } });
    await btn.dispatchEvent('click');
    await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
    const ids = await page.locator('[data-debug-story-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-debug-story-item')));
    check('一覧に全ストーリーが並ぶ(ジャック第1.5〜6部・終章2本・遊び方を含む)', ['raid_jack_story_1b', 'raid_jack_story_2', 'raid_jack_story_6', 'raid_jack_ending_cleared', 'raid_jack_ending_notcleared', 'raid_jack_howto_2026_10_04'].every((x) => ids.includes(x)), ids.join(','));
    check('既存の回想(きき加入など)も並ぶ', ids.includes('kiki_intro') && ids.length >= 20, String(ids.length));
    const text = await page.locator('[data-debug-story-overlay]').innerText();
    check('公開前のものに「公開前」と出る', /公開前/.test(text));
    await page.locator('[data-debug-story-item="raid_jack_story_2"]').dispatchEvent('click');
    await page.locator('[role="dialog"][aria-label^="イベント回想"]').waitFor({ timeout: 10000 });
    check('公開前のストーリー(第2部)が再生できる', /第2部/.test(await page.locator('[role="dialog"][aria-label^="イベント回想"]').innerText()));
    // 最後まで送る(タップ)
    for (let i = 0; i < 200; i++) {
      if (await page.locator('[role="dialog"][aria-label^="イベント回想"]').count() === 0) break;
      await page.locator('[role="dialog"][aria-label^="イベント回想"] button[aria-label="次へ"]').dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(30);
    }
    await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
    check('終わると、この一覧へ戻る', true);
    const keysAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay/i.test(k)))));
    check('見たことにはしない(保存は何も変わらない)', keysBefore === keysAfter, keysBefore.slice(0, 120) + ' / ' + keysAfter.slice(0, 120));
    await page.locator('[data-debug-story-close]').dispatchEvent('click');
    check('閉じられる', await page.locator('[data-debug-story-overlay]').count() === 0);
    check('実行時エラーが出ない', errors.length === 0, errors.join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
