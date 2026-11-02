// MFバトルカード: オートで挑む(案B・2026-11-02 社長・ごほうびは案3)を、実際の画面で確かめる。
//   node tools/card/card-share-auto-browser-check.js  (2〜3分)
//   VIDEO_DIR=<フォルダ> を付けると、動く様子を動画(webm)で残す
// ① 「ほかのブリーダー」→「戦う」のデッキ選びに「🖐 自分で操作/🤖 オート(戦術カード)」があり、オートにすると今日のごほうびの残り(3回)が出る
// ② オートで始めると、上にオートの帯(×1/×2/×4・🖐 自分で)が出て、自分の側も手を触らずに最後まで戦う
// ③ 結果: ビートPは自分で戦うときの半分(勝ち100・負けは自分の番の数で減らした半分)。その日はじめての勝ちの +50 は付かない。
//    その日の数(daily)は変えず、ごほうびの回数(mh_card_auto_reward_v1)が1つ増え、結果に「あと◯回」が出る
// ④ 今日の3回を使い切っていると、ごほうびなし(ビートPも回数も変わらない)。結果に「ごほうびなしで遊べます」
// ⑤ サーバへは何も書かない(「戦った」の知らせ・見返し・カードランクを送らない。登録デッキの一覧を読むだけ)
// ⑥ 「🖐 自分で」で手に切り替えられる
// ⑦ 画面でエラーが出ない
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let passed = 0, failed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else failed++; if (!ok || process.argv.includes('-v')) console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); };

const browser = async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); return; }
  const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8989;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const [vw, vh] = String(process.env.CARD_VIEW || '390x844').split('x').map(Number); // 画面の大きさ(横画面などを見るとき)
    const page = await b.newPage({ viewport: { width: vw, height: vh }, ...(process.env.VIDEO_DIR ? { recordVideo: { dir: process.env.VIDEO_DIR, size: { width: vw, height: vh } } } : {}) });
    const shot = async (name) => { if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(process.env.SHOT_DIR, `${vw}x${vh}-${name}.png`) }).catch(() => {}); } };
    page.on('pageerror', (e) => errors.push(String(e)));
    // 本番のサーバーへは書かない(外へは GET だけ通す)
    let shareRow = null;
    const sent = [];
    await page.route('**/*', (route) => {
      const rq = route.request(); const u = new URL(rq.url());
      if (u.hostname === 'localhost') return route.continue();
      if (u.hostname !== 'localhost') sent.push(`${rq.method()} ${u.pathname}`);
      // 登録デッキの一覧: 検査の相手を1人だけ返す
      if (/\/rest\/v1\/card_deck_entries/.test(u.pathname) && rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shareRow ? [shareRow] : []) });
      // 最近の戦績(card_deck_record_of): 3試合ぶん(このデッキの 2勝1敗)を返す
      if (/\/rest\/v1\/rpc\/card_deck_record_of/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { at: '2026-10-31T03:00:00Z', deck_won: true, turns: 9, old: false }, { at: '2026-10-30T12:00:00Z', deck_won: false, turns: 12, old: false }, { at: '2026-10-29T09:30:00Z', deck_won: true, turns: 7, old: false }]) });
      if (rq.method() === 'GET') return route.continue();
      return route.abort();
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.addInitScript(eventStorySeed());
    const get = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return 'こわれ'; } }, k);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) { const x = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (!(await x.count()) || !(await x.isVisible().catch(() => false))) break; await x.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
    await page.waitForTimeout(800);
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
    await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // 検査の相手: 自分のスターターのデッキを、ほかのブリーダーが登録した形にする
    const decks = await get('mh_card_decks_v1');
    const d0 = decks && decks.decks && decks.decks[0];
    // 相手の3体は、同じ種族のキラ・レアキラの子に替える(対戦開始の画面で、キラの子の絵が消えないかを見るため。⑥)
    const kiraOf = (no) => ({ 'C-003': 'C-003V', 'C-005': 'C-005S', 'C-007': 'C-007S' })[no] || no;
    shareRow = { owner_id: 'check-breeder-1', user_name: '検査の相手', icon: null, profile_frame: null, deck: { monsters: d0.monsters.map(kiraOf), cards: d0.cards }, tactics: {}, version: 1, active: true, battles: 3, deck_wins: 2, rents: 0, updated_at: new Date().toISOString() };
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator('[data-card-foe-tab="breeder"]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-foe-tab="breeder"]').click();
    const fight = page.locator('[data-card-share-fight="check-breeder-1"]');
    await fight.waitFor({ timeout: 15000 });
    // ① デッキ選びの切り替え
    await fight.click();
    await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 8000 });
    const modes = await page.locator('[data-card-deck-pick-mode]').count();
    await page.locator('[data-card-deck-pick-mode="auto"]').click();
    await page.waitForFunction(() => { const el = document.querySelector('[data-card-deck-pick-auto-left]'); return el && el.getAttribute('data-card-deck-pick-auto-left') !== ''; }, null, { timeout: 8000 }).catch(() => {});
    const leftText = await page.locator('[data-card-deck-pick-auto-left]').innerText().catch(() => '');
    await shot('deck-pick');
    if (process.env.VIDEO_DIR) await page.waitForTimeout(2500); // 動画: デッキ選びの切り替えを見せる
    check('① デッキ選びに「自分で操作/オート」があり、オートにすると今日のごほうびの残り(3回)が出る', modes === 2 && /あと3回/.test(leftText), `${modes} / ${leftText}`);
    const getS = (k) => page.evaluate(async (key) => storeGet(key === 'point' ? CARD_POINT_STORE_KEY : key, null, false), k);
    const lvBefore = await getS('mh_card_level_v1');
    const before = { point: await getS('point'), daily: JSON.stringify(await getS('mh_card_daily_v1')) };
    const sentBefore = sent.length;
    // ② オートで最後まで
    const playAuto = async () => {
      await page.locator('[data-card-deck-pick-go]').click();
      await page.locator('[data-card-battle]').waitFor({ timeout: 30000 });
      await page.locator('[data-card-auto-bar="auto"]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(2500);
      await shot('battle');
      await page.locator('[data-card-auto-speed="4"]').click();
      const end = await page.locator('[data-card-top="result"]').waitFor({ timeout: 240000 }).then(() => true).catch(() => false);
      return end;
    };
    const end1 = await playAuto();
    check('② オートで始めると、帯が出て、手を触らずに最後まで戦い結果が出る', end1);
    await page.waitForTimeout(process.env.VIDEO_DIR ? 4000 : 2500);
    await shot('result');
    const out1 = await page.locator('[data-card-top="result"]').getAttribute('data-card-outcome');
    const gain1 = Number(await page.locator('[data-card-top="result"]').getAttribute('data-card-gain'));
    const autoNote = await page.locator('[data-card-result-auto]').innerText().catch(() => '');
    const after = { point: await getS('point'), daily: JSON.stringify(await getS('mh_card_daily_v1')), auto: await getS('mh_card_auto_reward_v1') };
    const today = await page.evaluate(() => cardTodayJst());
    const lvAfter = await getS('mh_card_level_v1');
    const xpGain = ((lvAfter && lvAfter.xp) || 0) - ((lvBefore && lvBefore.xp) || 0);
    check('③ カードランクの経験値も半分(勝ち9・負け3)で、その日はじめての勝ちの分は付かない', xpGain === (out1 === 'win' ? 9 : 3), `${out1} ${xpGain}`);
    const halfOk = out1 === 'win' ? gain1 === 100 : gain1 >= 0 && gain1 <= 75;
    check('③ ビートPは自分で戦うときの半分(勝ち100・負け75まで)で、はじめての勝ちの +50 は付かない', halfOk, `${out1} ${gain1}`);
    check('③ その日の数(daily)は変えず、ごほうびの回数が1つ増え、結果に「あと2回」が出る', after.daily === before.daily && after.auto && after.auto.day === today && after.auto.n === 1 && /あと2回/.test(autoNote),
      JSON.stringify({ auto: after.auto, note: autoNote, same: after.daily === before.daily }));
    // ④ 3回を使い切った日
    await page.evaluate(async (d) => { await storeSet('mh_card_auto_reward_v1', { v: 1, day: d, n: 3 }, false); }, today);
    const p2 = await getS('point');
    await page.locator('[data-card-result-again], [data-card-top="result"] .mh-button-primary').first().click().catch(() => {});
    let end2 = false;
    if (await page.locator('[data-card-battle]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false)) {
      await page.locator('[data-card-auto-speed="4"]').click().catch(() => {});
      // ⑥ 手に切り替えて、また戻す
      await page.locator('[data-card-auto-toggle]').click();
      const hand = (await page.locator('[data-card-auto-bar="hand"]').count()) === 1;
      await page.locator('[data-card-auto-toggle]').click();
      const back = (await page.locator('[data-card-auto-bar="auto"]').count()) === 1;
      check('⑥ 「🖐 自分で」で手に切り替えられ、また「🤖 オート」に戻せる', hand && back);
      end2 = await page.locator('[data-card-top="result"]').waitFor({ timeout: 240000 }).then(() => true).catch(() => false);
    }
    const note2 = await page.locator('[data-card-result-auto]').innerText().catch(() => '');
    const free = await page.locator('[data-card-result-auto]').getAttribute('data-card-result-auto').catch(() => '');
    const p3 = await getS('point');
    const auto3 = await getS('mh_card_auto_reward_v1');
    check('④ 今日の3回を使い切っていると、ごほうびなし(ビートPも回数も変わらない)・「ごほうびなしで遊べます」', end2 && free === 'free' && p3 === p2 && auto3.n === 3 && /ごほうびなしで遊べます/.test(note2), JSON.stringify({ end2, free, p2, p3, auto3 }));
    const writes = sent.slice(sentBefore).filter((x) => !/^GET /.test(x) && !/card_deck_record_of/.test(x));
    check('⑤ オートの試合では、サーバへ何も書かない(戦った・見返し・カードランクを送らない)', writes.length === 0, writes.slice(0, 5).join(' / '));
    check('⑦ 画面でエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
    if (process.env.VIDEO_DIR) { const v = page.video(); await page.close(); if (v) console.log(`動画: ${await v.path()}`); }
  } finally { await b.close(); server.close(); }
};

(async () => {
  await browser();
  if (failed) { console.log(`✗ オートで挑む: ${failed} 件 NG(${passed} 件 OK)`); process.exit(1); }
  console.log(`✓ オートで挑む: ${passed} 件すべて OK`);
})().catch((e) => { console.log(`NG: 実行中にエラー — ${e.message}`); process.exit(1); });
