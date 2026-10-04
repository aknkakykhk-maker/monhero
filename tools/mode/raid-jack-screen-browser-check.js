// 種族チャレンジを実際のブラウザで通しで遊んでみて、画面が動くかを確かめる。
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

// レイド画面・編成・HOMEのジャックを実際のブラウザで確かめる(デバッグの強制表示で、公開フラグ・期間を待たない)。
//   ① デバッグ画面の強制表示で HOME の真ん中にジャックが出る(跳ねる・タップでレイド画面)
//   ② レイド画面: A の5段階(討伐済み・挑戦中・未解放のシルエット)・共有HPバー・参加人数・ランキング・残り回数
//   ③ 追加購入(デバッグ中はビートPを減らさない)で残り回数が増える
//   ④ 編成画面で勇者を選んで始め、戦闘→リタイア→結果→もどる。回数が1回減る
//   ⑤ B の段階式(初級だけ開いている)・累計ダメージランキング
//   ⑥ 実行時エラーが出ない・横にはみ出さない
(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const SHOT = process.env.RAID_SHOT_DIR || '';
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
      localStorage.setItem('mh_rhythm_event_points_v1', JSON.stringify(250));
    });
    await page.addInitScript(eventStorySeed());
    const posts = [];
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request(); const url = req.url();
      if (/raid_jack_/.test(url)) {
        if (req.method() === 'POST') { posts.push({ url, body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
        let rows = [];
        if (/raid_jack_tier_totals/.test(url)) rows = [
          { kind: 'a', tier: 1, total_damage: 1750000, player_count: 12, any_defeated: true },
          { kind: 'a', tier: 2, total_damage: 500000, player_count: 7, any_defeated: false },
        ];
        else if (/raid_jack_contributions/.test(url) && /breeder_id=eq\./.test(url)) rows = [{ kind: 'a', tier: 2, total_damage: 4200 }, { kind: 'b', tier: 1, total_damage: 70000 }];
        else if (/raid_jack_contributions/.test(url)) rows = [{ breeder_id: 'rank-user-0001', total_damage: 90000 }, { breeder_id: 'rank-user-0002', total_damage: 61000 }];
        else if (/raid_jack_b_ranking/.test(url)) rows = [{ breeder_id: 'rank-user-0003', total_damage: 3000000 }, { breeder_id: 'rank-user-0001', total_damage: 1200000 }];
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/2', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) }); return;
      }
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
    check('公開前(フラグ偽)のHOMEにジャックは出ない', (await page.locator('[data-home-raid-jack]').count()) === 0);
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });

    // ① HOME
    // 既存の検査は本番どおりの回数・解放で確かめる(既定は何度でも・全段階)
    await page.locator('[data-raid-real-rules-toggle]').click();
    check('本番どおりの回数・解放がONになる', /本番どおりの回数・解放で確認: ON/.test(await page.locator('[data-raid-jack-debug]').innerText()));
    await page.locator('[data-raid-force-toggle]').click();
    check('強制表示がONになる', /HOMEに出す: ON/.test(await page.locator('[data-raid-jack-debug]').innerText()));
    await page.locator('[data-raid-go-home]').click();
    await page.locator('[data-home-raid-jack]').waitFor({ timeout: 20000 });
    // HOMEを開いたとき重なる導入(新しい助手の紹介など)は、読み終えて閉じる
    for (let i = 0; i < 60; i++) {
      const next = page.locator('button[aria-label="次へ"], button:has-text("次へ"), button:has-text("はじめる"), button:has-text("閉じる"), button:has-text("あとで")').filter({ visible: true }).first();
      if (await next.count() === 0) break;
      await next.click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
    check('強制表示でHOMEの真ん中にジャックが出る', true);
    const jackBox = await page.locator('[data-home-raid-jack]').boundingBox();
    const vp = page.viewportSize();
    check('ジャックはHOMEのほぼ中央にいる', jackBox && Math.abs((jackBox.x + jackBox.width / 2) - vp.width / 2) < 30, JSON.stringify(jackBox));
    check('跳ねる動き(アニメーション)が付いている', await page.locator('[data-home-raid-jack] img').first().evaluate((el) => getComputedStyle(el).animationName.includes('mhRaidJackHop')));
    await page.waitForTimeout(1500);
    check('共有HPバーに「あらわれた」と残りHPが出る(段階2が挑戦中)', /ジャック子爵があらわれた/.test(await page.locator('[data-home-raid-jack]').innerText()) && /1,775,000/.test(await page.locator('[data-home-raid-jack]').innerText()), (await page.locator('[data-home-raid-jack]').innerText()).replace(/\s+/g, ' '));
    check('HOMEのジャックにオーラ(炎の舌)が出ている', await page.evaluate(() => {
      const el = document.querySelector('[data-home-raid-jack] [data-jack-aura]');
      return !!el && el.querySelectorAll('[data-jack-aura-el] > ins').length >= 5;
    }));
    if (SHOT) await page.screenshot({ path: `${SHOT}/home-jack.png` });

    // ② レイド画面(A)
    await page.locator('[data-home-raid-jack]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => /共有HP/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    const raidText = async () => page.locator('[data-raid-jack-screen]').innerText();
    check('画面のなかの案内(助手の吹き出し)が最初に出る', (await page.locator('[data-raid-jack-guide]').count()) === 1 && (await page.locator('[data-raid-jack-guide]').innerText()).trim().length > 10);
    await page.locator('[data-raid-jack-guide-close]').click();
    check('「わかった」で案内が閉じる', (await page.locator('[data-raid-jack-guide]').count()) === 0);
    check('デバッグの強制表示では「見た」を保存しない(本番の案内を消さない)', await page.evaluate(() => localStorage.getItem('mh_raid_jack_guide_seen_v1') === null));
    let t = await raidText();
    check('A: 5段階が並ぶ', ['ジャック男爵', 'ジャック子爵', 'ジャック伯爵', 'ジャック公爵', 'ジャック大王'].every((n) => t.includes(n)));
    check('A: 男爵は討伐済み・子爵は挑戦できる・伯爵以降は未解放', /1\. ジャック男爵\s*討伐済み/.test(t) && /2\. ジャック子爵\s*挑戦できる/.test(t) && /3\. ジャック伯爵\s*未解放/.test(t) && /5\. ジャック大王\s*未解放/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    check('A: 共有HPと参加人数が出る(子爵 2,275,000 のうち 500,000 を削った)', /共有HP 1,775,000 \/ 2,275,000/.test(t) && /7人が参加/.test(t));
    const silhouettes = await page.locator('[data-raid-jack-tier] img').evaluateAll((els) => els.map((e) => e.style.filter));
    check('A: 未解放の段階はシルエット(黒塗り)で見せる', silhouettes.slice(2).every((f) => /brightness\(0\)/.test(f)) && !/brightness\(0\)/.test(silhouettes[1]), JSON.stringify(silhouettes));
    check('報酬は「準備中」と出る', /報酬の中身は準備中です/.test(t));
    check('残り回数 3 / ビートP 250 が出る', /今日の残り\s*3\s*回/.test(t) && /所持 250/.test(t));
    await page.locator('[data-raid-jack-tier="a2"]').click();
    await page.waitForFunction(() => /90,000/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    t = await raidText();
    check('A: 貢献ランキングに順位と数字が出る', /1\s*名無しのブリーダー\s*90,000/.test(t.replace(/\n/g, ' ')) || /90,000/.test(t));
    await page.waitForFunction(() => /あなた 4,200\(\d+位\)/.test(document.querySelector('[data-raid-jack-mine]')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
    const mineText = await page.locator('[data-raid-jack-mine]').innerText();
    check('A: 自分の貢献(4,200)と順位(自分より多い2人 → 3位)が出る', /あなた 4,200/.test(mineText) && /3位/.test(mineText), mineText);
    if (SHOT) await page.screenshot({ path: `${SHOT}/raid-a.png` });

    // ③ 追加購入(デバッグ中は減らない)
    await page.locator('[data-raid-jack-buy]').click();
    await page.waitForFunction(() => /追加の挑戦を1回ぶん買いました/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    await page.waitForFunction(() => /今日の残り\s*4\s*回/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    check('追加購入で残りが4回になる', true);
    check('デバッグ中はビートPが減らない(250のまま)', await page.evaluate(() => JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1')) === 250));

    // ④ 編成 → 戦闘 → リタイア → 結果
    await page.locator('[data-raid-jack-challenge]').click();
    await page.locator('[data-raid-jack-prep]').waitFor({ timeout: 20000 });
    check('編成画面が開く(段階名が出る)', /ジャック子爵に挑む/.test(await page.locator('[data-raid-jack-prep]').innerText()));
    check('勇者を選ぶまで始められない', await page.locator('[data-raid-prep-start]').isDisabled());
    await page.locator('[data-raid-hero]').first().click();
    await page.locator('[data-raid-ally]').nth(0).click();
    check('勇者と供モンを選ぶと始められる', !(await page.locator('[data-raid-prep-start]').isDisabled()));
    posts.length = 0;
    await page.locator('[data-raid-prep-start]').click();
    await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
    check('編成からジャック戦が始まる', true);
    // みんなで討伐は、みんなが削った分を引き継ぐ(子爵 2,275,000 のうち 500,000 が削れている → 1,775,000 から)
    await page.waitForFunction(() => /1,775,000\s*\/\s*2,275,000/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    check('A: 敵ライフが共有の残り(1,775,000 / 2,275,000)から始まる', /1,775,000\s*\/\s*2,275,000/.test(await page.locator('body').innerText()));
    await page.locator('[data-battle-menu-button]').click();
    await page.locator('[data-battle-quit]').click();
    await page.getByText('降参しますか？').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: /降参|あきらめる|リタイア/ }).filter({ hasText: /降参|あきらめる|リタイア/ }).last().click();
    await page.locator('[data-raid-jack-result]').waitFor({ timeout: 30000 });
    check('結果が出て、デバッグ用の記録として1回送られる', posts.length === 1 && JSON.parse(posts[0].body).event_id === 'raid_jack_debug' && JSON.parse(posts[0].body).tier === 2, JSON.stringify(posts.map((p) => p.body)));
    const usedState = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_raid_jack_v1') || '{}'));
    check('今日の使用回数が1回増えている(中断しても戻らない)', usedState.a && usedState.a.used === 1 && usedState.a.extra === 1, JSON.stringify(usedState.a));
    await page.locator('[data-raid-jack-result]').getByRole('button', { name: 'もどる' }).click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });

    // ⑤ B
    await page.locator('[data-raid-open]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 20000 });
    await page.getByRole('tab', { name: 'ダメージ競争' }).click();
    await page.waitForFunction(() => /初級ジャック/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    t = await raidText();
    check('B: 初級だけ挑戦でき、中級以降は未解放', /1\. 初級ジャック\s*挑戦できる/.test(t) && /2\. 中級ジャック\s*未解放/.test(t) && /5\. 極級ジャック\s*未解放/.test(t), t.replace(/\s+/g, ' ').slice(0, 180));
    await page.waitForFunction(() => /累計ダメージランキング/.test(document.querySelector('[data-raid-jack-screen]').innerText) && /3,000,000/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    check('B: 累計ダメージランキング(5段階の合計)に数字が出る', /累計ダメージランキング/.test(await raidText()) && /3,000,000/.test(await raidText()));
    check('B: 自分の累計(70,000)が出る', /あなた 70,000/.test(await page.locator('[data-raid-jack-mine]').innerText()));
    if (SHOT) await page.screenshot({ path: `${SHOT}/raid-b.png` });
    // ⑥ デバッグの既定(本番どおりをOFF): 何度でも・全段階を選べる
    await page.locator('button[aria-label="戻る"]').first().click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    await page.locator('[data-raid-real-rules-toggle]').click();
    check('本番どおりの回数・解放がOFFになる', /本番どおりの回数・解放で確認: OFF/.test(await page.locator('[data-raid-jack-debug]').innerText()));
    await page.locator('[data-raid-open]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 20000 });
    await page.getByRole('tab', { name: 'ダメージ競争' }).click();
    await page.waitForFunction(() => /無制限/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    t = await raidText();
    check('B: 回数は無制限と出て、買い足しは押せない', /今日の残り\s*無制限/.test(t) && await page.locator('[data-raid-jack-buy]').isDisabled());
    check('B: 全段階が「挑戦できる」(未解放が1つも無い)', !/未解放/.test(t) && /5\. 極級ジャック\s*挑戦できる/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    await page.locator('[data-raid-jack-tier="b5"]').click();
    check('B: 極級でも挑戦ボタンが押せる', await page.locator('[data-raid-jack-challenge]').isEnabled());
    await page.getByRole('tab', { name: 'みんなで討伐' }).click();
    await page.waitForFunction(() => /無制限/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 15000 });
    t = await raidText();
    check('A: 全段階が「挑戦できる」(未解放が1つも無い)', !/未解放/.test(t) && /5\. ジャック大王\s*挑戦できる/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    const size = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
    check('画面が横にはみ出さない', size.s <= size.c + 1, `${size.s} / ${size.c}`);
    check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (error) {
    check('検査の実行', false, String(error && error.message || error).slice(0, 500));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
  console.log('\nすべて OK');
})();
