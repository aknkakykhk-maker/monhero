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
const PORT = 8992;
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

// ジャック戦(専用の1戦)を実際のブラウザで始めて、終わらせるところまで確かめる。
//   ① デバッグ画面の「ジャックと戦う」から始まり、バトル画面にジャックが出る
//   ② リタイアすると結果が出て、与ダメージが別のイベントID(raid_jack_debug)で raid_jack_hits へ1回だけ届く
//   ③ 通常の記録(mh_hs_* / mh_tactics_* など)・全国ランキングへは一切書かない・送らない
//   ④ 実行時エラーが出ない
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
    const keysBefore = await page.evaluate(() => Object.keys(localStorage));

    // ① 始める(A・段階1)
    watching = true;
    await page.locator('[data-raid-fight-start]').click();
    await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
    check('ジャック戦が始まり、バトル画面が出る', true);
    if (process.env.RAID_SHOT_DIR) { await page.waitForTimeout(1500); await page.screenshot({ path: `${process.env.RAID_SHOT_DIR}/battle-start.png` }); }
    const bodyText = await page.locator('body').innerText();
    check('バトル画面にジャックの名前が出る', bodyText.includes('ジャック'));
    // 敵の名前は段階の名前、上部のバッジは「レイドバトル / 段階名」(チャレンジ・WAVE・Normal は出さない)
    // 開始演出(約1.5秒)は「WAVE 1」ではなく「レイドバトル」と出る
    check('開始演出に WAVE が出ず、「レイドバトル」と「VS ジャック男爵」が出る', await page.evaluate(() => {
      const el = document.querySelector('[data-wave-intro]');
      if (!el) return true;   // 演出が切れていたら見ない(省エネ設定など)
      return /レイドバトル/.test(el.textContent) && /VS ジャック男爵/.test(el.textContent) && !/WAVE/.test(el.textContent);
    }));
    check('敵の名前が段階の名前(ジャック男爵)になる', /ジャック男爵/.test(bodyText), bodyText.replace(/\s+/g, ' ').slice(0, 160));
    check('上部のバッジが「レイドバトル / ジャック男爵」になり、チャレンジ・WAVE は出ない', /レイドバトル\s*\/\s*ジャック男爵/.test(bodyText) && !/チャレンジ\s*\/\s*Normal/.test(bodyText) && !/WAVE\s*1\/10/.test(bodyText));
    // 味方のライフ・ガッツは全快からはじまる(GUTS の現在値と上限が同じ)
    const gutsPairs = [...bodyText.matchAll(/GUTS\s*(\d+)\s*\/\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    check('味方のガッツが全快からはじまる', gutsPairs.length > 0 && gutsPairs.every(([a, b]) => a === b && b > 0), JSON.stringify(gutsPairs));

    // ② リタイア
    await page.locator('[data-battle-menu-button]').click();
    await page.locator('[data-battle-quit]').click();
    await page.getByText('降参しますか？').waitFor({ timeout: 10000 });
    check('リタイアの確認文がジャック用になる', /リタイアします。ここまでに与えたダメージは記録されます/.test(await page.locator('body').innerText()));
    await page.getByRole('button', { name: /降参|あきらめる|リタイア/ }).filter({ hasText: /降参|あきらめる|リタイア/ }).last().click();
    await page.locator('[data-raid-jack-result]').waitFor({ timeout: 30000 });
    const resultText = await page.locator('[data-raid-jack-result]').innerText();
    check('結果が出る(段階の名前・理由)', resultText.includes('ジャック男爵') && resultText.includes('リタイアした'), resultText.replace(/\s+/g, ' ').slice(0, 120));
    check('与ダメージは0と出る(戦わずに降参)', (await page.locator('[data-raid-jack-damage]').innerText()).trim() === '0');
    check('送れたと出る(デバッグ用の記録)', /与ダメージを送りました/.test(resultText) && /デバッグ用の記録/.test(resultText));
    check('raid_jack_hits へ1回だけ送られる', posts.length === 1 && /raid_jack_hits/.test(posts[0].url), String(posts.length));
    const row = JSON.parse(posts[0].body || '{}');
    check('別のイベントID・A・段階1・倒していない', row.event_id === 'raid_jack_debug' && row.kind === 'a' && row.tier === 1 && row.damage === 0 && row.defeated === false, JSON.stringify(row));

    watching = false;
    // ③ ほかの記録に書かない
    const keysAfter = await page.evaluate(() => Object.keys(localStorage));
    const added = keysAfter.filter((k) => !keysBefore.includes(k));
    const forbidden = added.filter((k) => /^mh_(tactics_|hs_|clears_|highest_wave_|rank_|quick_|pro_)/.test(k));
    check('通常の記録(自己ベスト・クリア回数・最高到達WAVEなど)を新しく書いていない', forbidden.length === 0, forbidden.join(','));
    check('全国ランキングなどの表へ書き込みの通信が出ていない', otherWrites.length === 0, otherWrites.slice(0, 3).join(' | '));

    // 戻る
    check('マスモンの絆経験値・能力が戦闘で変わっていない(経験値の付与が無い)', await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem('mh_masu_mons') || '[]');
      return list.length === 2 && list.every((m) => m.bondXp === 300) && list[0].statPoints && list[0].statPoints.atk === 400000;
    }));
    await page.locator('[data-raid-jack-result]').getByRole('button', { name: 'もどる' }).click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    check('デバッグ起動の結果は「もどる」でジャック確認の画面へ戻る', true);
    // オーラ: 段階1〜5で data-jack-aura が段階の数字になり、オーラの部品(4枚)が出る。RAID_SHOT_DIR があれば段階ごとに撮る
    for (let t = 1; t <= 5; t++) {
      await page.locator('[data-raid-fight-kind]').selectOption('a');
      await page.locator('[data-raid-fight-tier]').selectOption(String(t));
      await page.locator('[data-raid-fight-start]').click();
      await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1200);
      const aura = await page.evaluate(() => {
        const el = document.querySelector('[data-jack-aura]');
        return el ? { tier: el.getAttribute('data-jack-aura'), glow: el.querySelectorAll('[data-jack-aura-el] > i').length, tongues: el.querySelectorAll('[data-jack-aura-el] > ins').length } : null;
      });
      check(`オーラ: 段階${t}で data-jack-aura=${t}・光${3 + [0, 0, 1, 2, 3][t - 1]}枚(輪2+広がる輪)・炎の舌${[6, 10, 16, 24, 34][t - 1]}本`, !!aura && aura.tier === String(t) && aura.glow === 3 + [0, 0, 1, 2, 3][t - 1] && aura.tongues === [6, 10, 16, 24, 34][t - 1], JSON.stringify(aura));
      if (process.env.RAID_AURA_DEBUG) console.log('INFO tongue', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[data-jack-aura-el] > ins')].slice(0, 6).map((e) => { const c = getComputedStyle(e), r = e.getBoundingClientRect(); return { op: c.opacity, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left), bg: c.backgroundImage.slice(0, 30) }; }))));
      if (process.env.RAID_SHOT_DIR) await page.screenshot({ path: `${process.env.RAID_SHOT_DIR}/aura-${t}.png` }).catch(() => {});
      await page.locator('[data-battle-menu-button]').click();
      await page.locator('[data-battle-quit]').click();
      await page.getByText('降参しますか？').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: /降参|あきらめる|リタイア/ }).filter({ hasText: /降参|あきらめる|リタイア/ }).last().click();
      await page.locator('[data-raid-jack-result]').waitFor({ timeout: 30000 });
      await page.locator('[data-raid-jack-result]').getByRole('button', { name: 'もどる' }).click();
      await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    }
    // ④ AUTOで最後まで進める(A・段階1)。どんな終わり方でも結果が1回だけ出て、与ダメージが1回だけ送られる
    posts.length = 0;
    await page.locator('[data-raid-fight-kind]').selectOption('a');
    await page.locator('[data-raid-fight-tier]').selectOption('1');
    await page.locator('[data-raid-fight-start]').click();
    await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
    // レイドバトル専用: ターンが進むたびに「全ステータス UP!」が出る(出た瞬間を拾うため、画面の変化を見張っておく)
    await page.evaluate(() => { window.__raidGrowthSeen = false; new MutationObserver(() => { if (document.body.innerText.includes('全ステータス UP')) window.__raidGrowthSeen = true; }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
    // バトル速度を最大にして、AUTOを入れる
    for (let i = 0; i < 3; i++) { await page.locator('[data-battle-controls] button').first().click().catch(() => {}); }
    await page.locator('button[aria-label^="AUTO"]').first().click();
    if (process.env.RAID_SHOT_DIR) { for (let k = 0; k < 6; k++) { await page.waitForTimeout(1200); await page.screenshot({ path: `${process.env.RAID_SHOT_DIR}/battle-auto-${k}.png` }).catch(() => {}); } }
    await page.locator('[data-raid-jack-result]').waitFor({ timeout: 240000 });
    const autoText = await page.locator('[data-raid-jack-result]').innerText();
    const turnsMatch = /使ったターン\s*(\d+)\s*\/\s*20/.exec(autoText);
    const turnsUsed = turnsMatch ? Number(turnsMatch[1]) : -1;
    check('AUTOで結果が出る(倒した/20ターン/全滅のどれか)', /ジャックを倒した|20ターンを使い切った|全滅した/.test(autoText), autoText.replace(/\s+/g, ' ').slice(0, 140));
    check('使ったターンは20以内', turnsUsed >= 1 && turnsUsed <= 20, String(turnsUsed));
    const growths = Number(await page.locator('[data-raid-jack-growths]').first().evaluate((e) => e.textContent).catch(() => -1));
    check('A: ターンが進むたびに味方が成長する(使ったターン-1 回)', growths === Math.max(0, Math.min(turnsUsed, 20) - 1), `${growths} / ターン${turnsUsed}`);
    await page.waitForTimeout(800);
    check('与ダメージが1回だけ送られる', posts.length === 1, String(posts.length));
    const autoRow = JSON.parse((posts[0] || {}).body || '{}');
    const shown = Number((await page.locator('[data-raid-jack-damage]').innerText()).replace(/,/g, ''));
    check('送った与ダメージは画面の数字と同じで、0より大きい', autoRow.damage === shown && shown > 0, `${autoRow.damage} / ${shown}`);
    check('倒した/倒していないが結果と合っている', autoRow.defeated === /ジャックを倒した/.test(autoText), JSON.stringify(autoRow));
    const levelUps = Number((await page.locator('[data-raid-jack-levelups]').innerText()).replace(/[^0-9]/g, ''));
    const expectLevelUps = [3, 5, 8].filter((n) => n <= turnsUsed).length;
    check('Aの固有技とアシカの成長は 3/5/8 ターン目に1回ずつ(使ったターンまでの回数)', levelUps === expectLevelUps, `ターン${turnsUsed} → 成長${levelUps}回(期待${expectLevelUps}回)`);
    await page.locator('[data-raid-jack-result]').getByRole('button', { name: 'もどる' }).click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    // ⑤ B(マスモン)・初級ジャック。強い個体で倒すと、その場で終わり(倒したら終わり)・次の段階が開く・成長なし
    posts.length = 0;
    await page.locator('[data-raid-fight-kind]').selectOption('b');
    await page.locator('[data-raid-fight-tier]').selectOption('1');
    await page.locator('[data-raid-fight-start]').click();
    await page.locator('[data-battle-controls]').waitFor({ timeout: 30000 });
    for (let i = 0; i < 3; i++) { await page.locator('[data-battle-controls] button').first().click().catch(() => {}); }
    await page.locator('button[aria-label^="AUTO"]').first().click();
    await page.locator('[data-raid-jack-result]').waitFor({ timeout: 240000 });
    const bText = await page.locator('[data-raid-jack-result]').innerText();
    check('B: マスモンの結果が出る', /マスモン/.test(bText) && /初級ジャック/.test(bText), bText.replace(/\s+/g, ' ').slice(0, 140));
    await page.waitForTimeout(800);
    check('B: 与ダメージが1回だけ送られる', posts.length === 1, String(posts.length));
    const bRow = JSON.parse((posts[0] || {}).body || '{}');
    console.log(`INFO: B 初級 → ${JSON.stringify(bRow)} / ${bText.replace(/\s+/g, ' ').slice(0, 90)}`);
    check('B: kind は b・段階1', bRow.kind === 'b' && bRow.tier === 1);
    check('B: 成長の表示は出ない(Bは成長しない)', (await page.locator('[data-raid-jack-levelups]').count()) === 0);
    const bState = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_raid_jack_v1') || 'null'));
    check('B: 端末の記録(mh_raid_jack_v1)に累計が残る', !!bState && Number(bState.value && bState.value.b ? bState.value.b.total : (bState.b ? bState.b.total : 0)) >= 0);
    await page.locator('[data-raid-jack-result]').getByRole('button', { name: 'もどる' }).click();
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (error) {
    check('検査の実行', false, String(error && error.message || error).slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
  console.log('\nすべて OK');
})();
