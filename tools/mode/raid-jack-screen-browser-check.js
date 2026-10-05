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
    // この検査は「公開前(フラグが偽)」から始めて、デバッグの強制表示でHOMEへ出す流れを確かめる。
    // ジャックは 2026-10-05 4:00 に公開されたので、時計を公開前(ハロウィン・ナイトの期間内)へ固定して流す。
    // そうしないと、公開のあとに実行したときに「公開前のHOMEにジャックは出ない」から落ちる(2026-10-05に確認)
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+09:00') });
    await page.clock.resume();
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
    let bossDown = false;   // true にすると、大王(段階5)まで倒された状態の合計を返す
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request(); const url = req.url();
      if (/raid_jack_/.test(url)) {
        if (req.method() === 'POST') { posts.push({ url, body: req.postData() }); await route.fulfill({ status: 201, body: '' }); return; }
        let rows = [];
        if (/raid_jack_tier_totals/.test(url)) rows = [
          { kind: 'a', tier: 1, total_damage: 1750000, player_count: 12, any_defeated: true },
          { kind: 'a', tier: 2, total_damage: 500000, player_count: 7, any_defeated: false },
          ...(bossDown ? [{ kind: 'a', tier: 5, total_damage: 99999999, player_count: 30, any_defeated: true }] : []),
        ];
        else if (/raid_jack_a_ranking/.test(url)) rows = [{ breeder_id: 'rank-user-0002', total_damage: 8800000 }, { breeder_id: 'rank-user-0001', total_damage: 4400000 }];
        else if (/raid_jack_contributions/.test(url) && /breeder_id=eq\./.test(url)) rows = [{ kind: 'a', tier: 2, total_damage: 4200 }, { kind: 'b', tier: 1, total_damage: 70000 }];
        else if (/raid_jack_contributions/.test(url)) rows = [{ breeder_id: 'rank-user-0001', total_damage: 90000 }, { breeder_id: 'rank-user-0002', total_damage: 61000 }];
        else if (/raid_jack_b_ranking/.test(url)) rows = [{ breeder_id: 'rank-user-0003', total_damage: 3000000 }, { breeder_id: 'rank-user-0001', total_damage: 1200000 }];
        await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/2', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) }); return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    // 公開前の画面を確かめる検査なので、時計を開始日時(2026-10-05 4:00)より前に固定する(公開後の本物の時刻だと、旗が立って前提が変わる)
    await page.clock.setFixedTime(new Date('2026-10-05T03:00:00+09:00'));
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
    // ひとこと(吹き出し): 爵位の話し方(段階2=子爵)・残り77%なので full の場面。押すと次のセリフへ。吹き出しを押してもレイド画面は開かない
    await page.locator('[data-home-raid-say]').waitFor({ timeout: 20000 });
    const sayA = (await page.locator('[data-home-raid-say]').innerText()).replace('▶ つぎ', '').trim();
    const FULL2 = ['ほっほっほ。わたくしを止められるとお思いですかな？', '優雅に参りましょう。ランタンは、ぜんぶ割ってさしあげますぞ', '男爵などと一緒にされては困りますな。わたくしは子爵ですぞ', 'おや、また挑戦者ですかな。ご苦労なことですぞ'];
    check('HOMEのジャックが、子爵の話し方で、残りライフが多い(full)ときのひとことを話す', FULL2.includes(sayA), sayA);
    if (SHOT) await page.screenshot({ path: `${SHOT}/home-say.png` });
    const seen = new Set([sayA]);
    for (let k = 0; k < 4; k++) { await page.locator('[data-home-raid-say]').click(); await page.waitForTimeout(120); seen.add((await page.locator('[data-home-raid-say]').innerText()).replace('▶ つぎ', '').trim()); }
    check('吹き出しを押すと、次のセリフに切り替わる(4回押して4種類すべてを回る)', seen.size === 4 && [...seen].every((t) => FULL2.includes(t)), [...seen].join(' | '));
    check('吹き出しを押してもレイド画面は開かない(ジャック本体を押したときだけ開く)', (await page.locator('[data-raid-jack-screen]').count()) === 0 && (await page.locator('[data-home-raid-jack]').count()) === 1);
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
    // 撮影用: RAID_HOME_TIER を渡すと、HOMEのオーラの段階の数字だけを差し替えて撮る(色・輪の見え方の確認用。炎の本数は変わらない)
    if (SHOT && process.env.RAID_HOME_TIER) {
      await page.evaluate((t) => { const el = document.querySelector('[data-home-raid-jack] [data-jack-aura]'); if (el) el.setAttribute('data-jack-aura', t); }, process.env.RAID_HOME_TIER);
      await page.waitForTimeout(900);
    }
    if (SHOT) await page.screenshot({ path: `${SHOT}/home-jack.png` });

    // ② レイド画面(A)
    await page.locator('[data-home-raid-jack]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => /共有HP/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
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
    // 報酬の中身が決まったので、「準備中」ではなく、討伐報酬と貢献ランキングの報酬が出る(2026-10-04・#2129)
    check('報酬が出る(討伐報酬・参加した全員)', /討伐報酬/.test(t) && /参加した全員/.test(t));
    check('残り回数 3 / ビートP 250 が出る', /今日の残り\s*3\s*回/.test(t) && /所持 250/.test(t));
    await page.locator('[data-raid-jack-tier="a2"]').click();
    await page.waitForTimeout(1200);   // 段階を替えた直後は前の段階のランキングが残っているので、読み直しが始まるのを待つ
    await page.waitForFunction(() => document.querySelectorAll('[data-raid-jack-ranking-row]').length >= 2 && /あなた 4,200/.test(document.querySelector('[data-raid-jack-screen]').innerText) && !/読み込み中/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    t = await raidText();
    check('A: 貢献ランキングに順位と数字が出る', /1\s*名無しのブリーダー\s*90,000/.test(t.replace(/\n/g, ' ')) || /90,000/.test(t));
    check('A: ランキングは通常バトルと同じ部品(順位メダル・アイコン枠つきのカード)で出る', (await page.locator('[data-raid-jack-ranking-row]').count()) === 2 && (await page.locator('[data-raid-jack-ranking-row] [data-profile-avatar], [data-raid-jack-ranking-row] img, [data-raid-jack-ranking-row] span.rounded-full').count()) >= 2);
    await page.waitForFunction(() => /あなた 4,200\(\d+位\)/.test(document.querySelector('[data-raid-jack-mine]')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const mineText = await page.locator('[data-raid-jack-mine]').innerText();
    check('A: 自分の貢献(4,200)と順位(自分より多い2人 → 3位)が出る', /あなた 4,200/.test(mineText) && /3位/.test(mineText), mineText);
    if (SHOT) await page.screenshot({ path: `${SHOT}/raid-a.png` });

    // ③ 追加購入(デバッグ中は減らない)
    await page.locator('[data-raid-jack-buy]').click();
    await page.waitForFunction(() => /追加の挑戦を1回ぶん買いました/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    await page.waitForFunction(() => /今日の残り\s*4\s*回/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
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
    // モンスターの詳細を、選ぶ画面から見られる(確認専用。選択は変わらない・閉じると編成画面に戻る)
    const detailBtn = page.locator('[data-raid-detail]').first();
    check('各モンスターの右上に詳細ボタンがある', (await page.locator('[data-raid-detail]').count()) >= 2);
    if (SHOT) await page.screenshot({ path: `${SHOT}/raid-prep.png` });
    const heroBefore = await page.locator('[data-raid-hero]').first().getAttribute('class');
    await detailBtn.click();
    await page.locator('[role="dialog"][aria-label$="の詳細"]').waitFor({ timeout: 20000 });
    if (SHOT) await page.screenshot({ path: `${SHOT}/raid-prep-detail.png` });
    const dlg = await page.locator('[role="dialog"][aria-label$="の詳細"]').innerText();
    check('詳細にステータス・適性などが出る', /ステータス|HP|適性|固有技/.test(dlg) && dlg.length > 60, dlg.replace(/\s+/g, ' ').slice(0, 120));
    check('詳細は確認専用(名前の変更ボタンが無い)', (await page.locator('[role="dialog"][aria-label$="の詳細"] [aria-label*="名前"]').count()) === 0);
    await page.locator('[role="dialog"][aria-label$="の詳細"]').getByRole('button', { name: '閉じる' }).last().click();
    await page.locator('[role="dialog"][aria-label$="の詳細"]').waitFor({ state: 'detached', timeout: 10000 });
    check('詳細を閉じると編成画面に戻り、選んだ状態は変わらない', (await page.locator('[data-raid-jack-prep]').count()) === 1 && (await page.locator('[data-raid-hero]').first().getAttribute('class')) === heroBefore && !(await page.locator('[data-raid-prep-start]').isDisabled()));
    posts.length = 0;
    await page.locator('[data-raid-prep-start]').click();
    // 通常バトルと同じ配置画面で、勇者モン→供モンの順に、距離(立ち位置)を自分で選ぶ(2026-10-05・「勇者モンの距離が固定になってる」)
    await page.locator('[data-ph-range]').first().waitFor({ timeout: 20000 });
    check('始める前に配置画面(通常バトルと同じ)が出る', /配置場所を決定せよ/.test(await page.locator('body').innerText()));
    check('回数は、配置のあいだは減らない(まだ戦闘を始めていない)', await page.evaluate(() => { const st = JSON.parse(localStorage.getItem('mh_raid_jack_v1') || '{}'); return !st.a || !st.a.used; }));
    check('4つの距離が選べる(零・近・中・遠)', await page.locator('[data-ph-range]').count() === 4 && await page.locator('[data-ph-range][data-ph-on]').count() === 4);
    // 配置画面から編成へ戻れる(選び直し)。戻っても回数は減らず、もう一度始めると配置からやり直せる
    await page.getByRole('button', { name: /モンスターを選び直す/ }).click();
    await page.locator('[data-raid-jack-prep]').waitFor({ timeout: 10000 });
    check('配置画面から編成へ戻れる(選んだ編成はそのまま)', !(await page.locator('[data-raid-prep-start]').isDisabled()));
    await page.locator('[data-raid-prep-start]').click();
    await page.locator('[data-ph-range]').first().waitFor({ timeout: 20000 });
    // 勇者モンは「中距離(2番目の枠=添字2)」へ置く。固定の最前列ではなく、選んだ場所になる
    await page.locator('[data-ph-range="2"]').click();
    const afterHero = await page.locator('body').innerText();
    check('勇者モンを置いたあと、供モンの配置になる(置いた枠は選べない)', await page.locator('[data-ph-range="2"]').isDisabled() && await page.locator('[data-ph-range][data-ph-on]').count() === 3, afterHero.replace(/\s+/g, ' ').slice(0, 80));
    await page.locator('[data-ph-range="0"]').click();
    await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
    check('編成と配置からジャック戦が始まる', true);
    // 戦闘の盤面で、勇者モンが選んだ距離(中=添字2)にいて、供モンが零距離(添字0)にいる
    await page.waitForSelector('[data-slot-index]', { timeout: 30000 });
    const board = await page.evaluate(() => [...document.querySelectorAll('[data-slot-index]')].map((el) => ({ i: el.getAttribute('data-slot-index'), t: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 40), img: !!el.querySelector('img') })));
    console.log('INFO board', JSON.stringify(board));
    check('戦闘の盤面で、置いた距離(零・中)に子がいて、置いていない距離(近・遠)は空いている', ['0', '2'].every((i) => board.some((b) => b.i === i && b.img)) && ['1', '3'].every((i) => !board.some((b) => b.i === i && b.img)), JSON.stringify(board));
    // レイドバトルは、みんなが削った分を引き継ぐ(子爵 2,275,000 のうち 500,000 が削れている → 1,775,000 から)
    await page.waitForFunction(() => /1,775,000\s*\/\s*2,275,000/.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
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
    await page.getByRole('tab', { name: 'グランドスラム' }).click();
    await page.waitForFunction(() => /初級ジャック/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    t = await raidText();
    check('B: 初級だけ挑戦でき、中級以降は未解放', /1\. 初級ジャック\s*挑戦できる/.test(t) && /2\. 中級ジャック\s*未解放/.test(t) && /5\. 極級ジャック\s*未解放/.test(t), t.replace(/\s+/g, ' ').slice(0, 180));
    await page.waitForFunction(() => /累計ダメージランキング/.test(document.querySelector('[data-raid-jack-screen]').innerText) && /3,000,000/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
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
    await page.getByRole('tab', { name: 'グランドスラム' }).click();
    await page.waitForFunction(() => /無制限/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    t = await raidText();
    check('B: 回数は無制限と出て、買い足しは押せない', /今日の残り\s*無制限/.test(t) && await page.locator('[data-raid-jack-buy]').isDisabled());
    check('B: 全段階が「挑戦できる」(未解放が1つも無い)', !/未解放/.test(t) && /5\. 極級ジャック\s*挑戦できる/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    await page.locator('[data-raid-jack-tier="b5"]').click();
    check('B: 極級でも挑戦ボタンが押せる', await page.locator('[data-raid-jack-challenge]').isEnabled());
    await page.getByRole('tab', { name: 'レイドバトル' }).click();
    await page.waitForFunction(() => /無制限/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    t = await raidText();
    check('A: 全段階が「挑戦できる」(未解放が1つも無い)', !/未解放/.test(t) && /5\. ジャック大王\s*挑戦できる/.test(t), t.replace(/\s+/g, ' ').slice(0, 200));
    // ⑦ 大王を倒したあと: 「累計ダメージ(全段階の合計)」のランキングへ切り替えられる
    check('大王が倒れる前は、ランキングの切り替えが出ない', (await page.locator('[data-raid-jack-all-toggle]').count()) === 0);
    bossDown = true;
    await page.locator('button[aria-label="戻る"]').first().click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    await page.locator('[data-raid-open]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 20000 });
    await page.locator('[data-raid-jack-all-toggle]').waitFor({ timeout: 30000 });
    check('大王が倒れると、「大王への貢献/累計ダメージ」の切り替えが出る', /大王への貢献/.test(await page.locator('[data-raid-jack-all-toggle]').innerText()) && /累計ダメージ/.test(await page.locator('[data-raid-jack-all-toggle]').innerText()));
    // 大王を倒したあとの段階5は、小さなぱんぷきん(共有ライフは無限・毎回ぜんかいから)
    check('大王を倒したあと、段階5の絵がぱんぷきんになり、オーラは付かない', (await page.locator('[data-raid-pumpkin="true"]').count()) === 1 && (await page.locator('[data-raid-jack-tier="a5"] [data-jack-aura]').count()) === 0 && /pumpkin-icon/.test((await page.locator('[data-raid-pumpkin="true"] img').getAttribute('src')) || ''));
    const tile5 = await page.locator('[data-raid-jack-tier="a5"]').innerText();
    check('段階5は「ぱんぷきん」「あそびに来た」と、共有ライフは無限の説明が出る(共有HPバーは出ない)', /5\. ぱんぷきん/.test(tile5) && /あそびに来た/.test(tile5) && /共有ライフは無限/.test(tile5) && !/共有HP/.test(tile5), tile5.replace(/\s+/g, ' ').slice(0, 120));
    check('ほかの段階(男爵〜公爵)は今までどおりジャックの絵・討伐済み', /1\. ジャック男爵\s*討伐済み/.test(await page.locator('[data-raid-jack-screen]').innerText()));
    await page.locator('[data-raid-jack-all-mode="all"]').click();
    await page.waitForFunction(() => /8,800,000/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    t = await raidText();
    check('累計ダメージに切り替えると、全段階の合計のランキングが出る', /レイドバトルの累計ダメージ\(全段階の合計\)/.test(t) && /8,800,000/.test(t) && /4,400,000/.test(t));
    check('累計ダメージのあなたの数字は、自分の全段階の合計(4,200)', /あなた 4,200/.test(await page.locator('[data-raid-jack-mine]').innerText()));
    await page.locator('[data-raid-jack-all-mode="tier"]').click();
    await page.waitForFunction(() => /への貢献ランキング/.test(document.querySelector('[data-raid-jack-screen]').innerText), null, { timeout: 30000 });
    check('「大王への貢献」へ戻せる', /への貢献ランキング/.test(await raidText()));
    // HOME のジャックも、大王を倒したあとは小さなぱんぷきん(オーラ・ポーズ絵なし)
    await page.locator('button[aria-label="戻る"]').first().click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    await page.locator('[data-raid-go-home]').click();
    await page.locator('[data-home-raid-pumpkin="true"]').waitFor({ timeout: 30000 });
    const homeBtn = await page.locator('[data-home-raid-jack]').innerText();
    check('HOME: 大王を倒したあとは「ぱんぷきんが遊びに来た！」と出て、共有HPバーは出ない', /ぱんぷきんが遊びに来た/.test(homeBtn) && !/共有HP/.test(homeBtn), homeBtn.replace(/\s+/g, ' ').slice(0, 100));
    check('HOME: ぱんぷきんの絵が出て、ジャックの絵・オーラは出ない', (await page.locator('[data-home-raid-jack] img[src*="pumpkin-icon"]').count()) === 1 && (await page.locator('[data-home-raid-jack] img[src*="jack.png"], [data-home-raid-jack] img[src*="jack-pose"]').count()) === 0 && (await page.locator('[data-home-raid-jack] [data-jack-aura-el]').count()) === 0);
    if (SHOT) await page.screenshot({ path: `${SHOT}/home-pumpkin.png` });
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
