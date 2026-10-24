// MFバトルカード(CARD_TOP / CARD_BATTLE。いまはデバッグ設定からだけ入れる)を、実際のブラウザで通して確かめる。
//
//   node tools/card/card-battle-browser-check.js            確かめる
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-battle-browser-check.js   画面の写真も撮る(社長に見せる用)
//
// 見るもの
//   ① デバッグ設定の入口(data-debug-card-battle)から開ける。はじめてはスターター選びが出る
//   ② スターターを選ぶと、カード53枚・デッキ1つ・カードポイント300が保存される(mh_card_* の新しいキーだけ)
//   ③ もう一度開いても、スターター選びは出ない(二度と配らない)
//   ④ 相手えらび → 対戦が始まり、手札5枚・場の6体・相手の帯が出る。カードの絵が読める
//   ⑤ 自分の番を何ターンか進められる(技を出す・守る/守らない・ガッツにする)。どこでも実行時エラーが出ない
//   ⑥ 長押しで詳しい画面・捨て札の一覧が開いて閉じる
//   ⑦ 投了すると結果が出て、カードポイントは増えない・戦績に投了が1つ付く
//   ⑧ 既存の保存キー(mh_card_ 以外)を1つも書き換えていない
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8994;
const SHOT = process.env.CARD_SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }).catch(() => {}); } };
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(eventStorySeed());
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
    // ここまでの保存(既存のキー)を控える。カードバトルが書くのは mh_card_* だけのはず
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const openCard = async () => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    await openCard();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    check('① デバッグ設定から開ける・はじめてはスターター選びが出る', true);
    await page.waitForTimeout(600);
    await shot(page, '01-starter');
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const saved = await page.evaluate(() => ({
      col: JSON.parse(localStorage.getItem('mh_card_collection_v1') || '{}'),
      decks: JSON.parse(localStorage.getItem('mh_card_decks_v1') || 'null'),
      point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'),
      starter: JSON.parse(localStorage.getItem('mh_card_starter_v1') || 'null'),
    }));
    const total = Object.values(saved.col).reduce((s, v) => s + v, 0);
    check('② スターターを選ぶとカード53枚・デッキ1つ・カードポイント300', total === 53 && saved.decks && saved.decks.decks.length === 1 && saved.point === 300 && saved.starter && saved.starter.kit === 'powerful', JSON.stringify({ total, point: saved.point, starter: saved.starter }));
    check('② トップにカードポイント300と出る', (await page.locator('[data-card-point]').innerText()).trim() === '300');
    await shot(page, '02-top');
    // ③ 戻ってもう一度開く
    await page.getByRole('button', { name: 'デバッグ設定へ戻る' }).click();
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    check('③ 2回目はスターター選びが出ない', await page.locator('[data-card-top="starter"]').count() === 0);
    // ④ 相手えらび → 対戦
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
    const foes = await page.locator('[data-card-foe]').count();
    check('④ 相手の助手が並ぶ', foes >= 4, `${foes}人`);
    await page.locator('[data-card-foe="momosuke"]').click();
    await page.waitForTimeout(500);
    await shot(page, '03-foe');
    await page.locator('[data-card-start]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const hand = await page.locator('[data-card-hand-card]').count();
    const mons = await page.locator('[data-card-mon]').count();
    check('④ 対戦が始まり、手札5枚・場の6体が出る', hand === 5 && mons === 6, `手札${hand}・場${mons}`);
    await shot(page, '04-battle-start');
    // ⑥ 長押しで詳しい画面
    const card0 = page.locator('[data-card-hand-card="0"]');
    const box = await card0.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    const detailOpen = await page.locator('[data-card-detail]').count();
    check('⑥ 手札の長押しで詳しい画面が開く', detailOpen === 1);
    await page.waitForTimeout(400);
    await shot(page, '05-detail');
    await page.locator('[data-card-detail]').click({ position: { x: 20, y: 20 } });
    check('⑥ 詳しい画面はタップで閉じる', await page.locator('[data-card-detail]').count() === 0);

    // ⑤ 自分の番を進める(使えるカードを出す → 狙える相手 → 攻撃おわり → ガッツ)
    let myActions = 0, guards = 0, gutsTurns = 0, shotGuard = false, shotTarget = false;
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline && gutsTurns < 6) {
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
      if (mode === null) break;
      if (mode === 'wait') { await page.waitForTimeout(300); continue; }
      if (mode === 'setup') { await page.getByRole('button', { name: /始める$/ }).click(); continue; }
      if (mode === 'discard') { const n = await page.locator('[data-card-hand-card]').count(); for (let i = 0; i < n; i++) await page.locator(`[data-card-hand-card="${i}"]`).click(); await page.getByRole('button', { name: /捨てる$/ }).click().catch(() => {}); continue; }
      if (mode === 'guard') {
        if (!shotGuard) { await shot(page, '07-guard'); shotGuard = true; }
        guards += 1;
        await page.getByRole('button', { name: '守らない' }).click();
        continue;
      }
      if (mode === 'guts') {
        const n = await page.locator('[data-card-hand-card]').count();
        if (n > 2) await page.locator('[data-card-hand-card="0"]').click();
        await page.getByRole('button', { name: /ターン終了$/ }).click();
        gutsTurns += 1;
        continue;
      }
      if (mode === 'attack') {
        // 明るい(使える)手札を1枚出す
        const usable = await page.locator('[data-card-hand-card]').evaluateAll((els) => els.map((e, i) => (e.className.includes('opacity-45') ? -1 : i)).filter((i) => i >= 0));
        let acted = false;
        for (const i of usable) {
          await page.locator(`[data-card-hand-card="${i}"]`).click();
          await page.waitForTimeout(150);
          // 使う子を選ぶ必要があれば最初の子
          const user = page.locator('[data-card-mon].ring-amber-300').first();
          if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
          const target = page.locator('[data-card-mon].ring-rose-400').first();
          if (await target.count()) {
            if (!shotTarget) { await shot(page, '06-target'); shotTarget = true; }
            await target.click(); acted = true; break;
          }
          const use = page.getByRole('button', { name: '使う' });
          if (await use.count()) { await use.click(); acted = true; break; }
          await page.locator(`[data-card-hand-card="${i}"]`).click().catch(() => {});
        }
        if (acted) { myActions += 1; await page.waitForTimeout(400); continue; }
        await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    check('⑤ 自分の番を何ターンも進められる(技・守り・ガッツ)', gutsTurns >= 3 && errors.length === 0, `技 ${myActions} 回・守りの番 ${guards} 回・ターン終了 ${gutsTurns} 回`);
    // 捨て札の一覧
    await page.getByRole('button', { name: /^捨て札/ }).last().click();
    await page.locator('[data-card-discard]').waitFor({ timeout: 5000 });
    await shot(page, '08-discard');
    check('⑥ 捨て札の一覧が開く(自分/相手のタブ)', await page.getByRole('button', { name: /相手の捨て札/ }).count() === 1);
    await page.getByRole('button', { name: '閉じる' }).click();
    // ⑦ 投了
    const result = await page.locator('[data-card-top="result"]').count();
    if (!result) {
      await page.getByRole('button', { name: '投了' }).click();
      await page.getByRole('button', { name: '投了する' }).click();
    }
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    await shot(page, '09-result');
    const after = await page.evaluate(() => ({
      point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'),
      record: JSON.parse(localStorage.getItem('mh_card_record_v1') || 'null'),
      all: Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])),
    }));
    const outcome = await page.locator('[data-card-top="result"]').getAttribute('data-card-outcome');
    if (outcome === 'surrender') check('⑦ 投了ではカードポイントが増えない・戦績に投了が1つ', after.point === 300 && after.record && after.record.cpu.surrender === 1, JSON.stringify({ point: after.point, cpu: after.record && after.record.cpu }));
    else check(`⑦ 決着(${outcome})で結果が出て戦績が付く`, after.record && after.record.cpu[outcome] === 1);
    // ⑧ 既存のキーを書き換えていない(時刻・起動のたびに変わる記録は除く)
    const volatile = /^mh_(debug_entry|last_|play_|session|boot|reload|device|playtime|visit|bgm_|se_|audio|login|daily_|mission|update|seen_build|build)/;
    const changed = Object.keys(before).filter((k) => !k.startsWith('mh_card_') && !volatile.test(k) && before[k] !== after.all[k]);
    check('⑧ カードバトル以外の保存キーを書き換えていない', changed.length === 0, changed.join(', '));
    const added = Object.keys(after.all).filter((k) => !(k in before) && !k.startsWith('mh_card_') && !volatile.test(k));
    check('⑧ 新しく増えた保存キーは mh_card_* だけ', added.length === 0, added.join(', '));
    check('どこでも実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('最後まで動く', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
