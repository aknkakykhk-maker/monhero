// MFバトルカード: オートのごほうびの残りの札と、セッション券をまとめて使ってふやす窓を、実際の画面で押して確かめる(2026-11-07 社長)。
//   node tools/card/card-auto-ticket-browser-check.js            縦・横・🔄横(3〜5分)
//   CARD_VIEWS=portrait node tools/card/card-auto-ticket-browser-check.js   向きをえらぶ
//   SHOT_DIR=<フォルダ> を付けると止め絵を残す
//
// 社長「ここに残りのごほうび回数とこの場でセッション券で増やすボタンもほしい」「セッション券をご褒美に変換するのも複数枚できるようにして」
// 部長「−/＋・最大・数の直接入力を実際に押して、表示の『券◯枚 → +◯回』と本当に増える回数が一致するか」
//   ① オートで挑んだ結果の画面に、残りの札(残り0なら目立たせる empty)と「🎫 セッション券でふやす」が出る
//   ② 窓で +1・−1・MAX・+10・打ち込み(全角「５」・小数「2.9」・空欄)を押すと、数と「券 ◯枚 → +◯回(残り ◯回)」と確定のボタンがそろって変わる。
//      最大は「持っている券」と「今日あとふやせる回数」の小さいほう
//   ③ 確定すると、券は選んだ枚数だけ減り、残りの札は表示どおりにふえる(保存の extra も同じ数)
//   ④ 「もう一度」で、ごほうびありの対戦になる
//   ⑤ 残りがあるときは控えめ(left)だが、ボタンは押せる(2026-11-07 社長の答え B)。残り3で2枚 → 窓は「残り 5回になります」、確定で札も5・券は3→1・保存の extra は6
//   ⑥ 窓・札・ボタンの字が画面からはみ出さない・切れない(縦 390×844・横 844×390・🔄横=縦の端末を縦横ボタンで回した横)
//   ⑦ 実行時エラーが無い。サーバへは何も書かない
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = { portrait: [390, 844, false], landscape: [844, 390, false], rotated: [390, 844, true] };
const LABEL = { portrait: '縦', landscape: '横', rotated: '🔄横' };

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); process.exit(0); }
  const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8987;
  const SHOT = process.env.SHOT_DIR || '';
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const want = String(process.env.CARD_VIEWS || 'portrait,landscape,rotated').split(',');
  try {
    for (const view of want) {
      if (!VIEWS[view]) continue;
      const [vw, vh, rot] = VIEWS[view];
      const L = LABEL[view];
      const page = await b.newPage({ viewport: { width: vw, height: vh } });
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      const shot = async (t) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOT, `${view}-${t}.png`) }).catch(() => {}); };
      let shareRow = null; const sent = [];
      await page.route('**/*', (route) => {
        const rq = route.request(); const u = new URL(rq.url());
        if (u.hostname === 'localhost') return route.continue();
        // 表への書き込みと、サーバの関数(functions/v1)だけを数える。一覧などの読み出し(POST の rpc。週のスコア・大会の一覧)は数えない
        if (rq.method() !== 'GET' && (/\/rest\/v1\/(?!rpc\/)/.test(u.pathname) || /\/functions\/v1\//.test(u.pathname))) sent.push(`${rq.method()} ${u.pathname}`);
        if (/\/rest\/v1\/card_deck_entries/.test(u.pathname) && rq.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(shareRow ? [shareRow] : []) });
        if (/\/rest\/v1\/rpc\/card_deck_record_of/.test(u.pathname)) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        if (rq.method() === 'GET') return route.continue();
        return route.abort();
      });
      await page.addInitScript(() => {
        if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
        const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
        s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
        s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
        s('mh_owned_items', { session_ticket: 7 });
      });
      await page.addInitScript(eventStorySeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').oneTimeNoticeSeed()); // みゅあの今日の助言などの一度きりの案内も済んだことにする // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
      // 縦横ボタンで回した横(🔄横)。対戦の終わりで戻るので、見る前に毎回回し直す(遊ぶ人も結果の画面で押し直す)
      const reRot = async () => { if (!rot) return; if ((await page.evaluate(() => RHYTHM_VIEW_ROTATION.get())) === 0) { await page.evaluate(() => applyScreenOrientation('landscape')); await page.waitForTimeout(900); } };
      // はみ出し・切れ: 要素の箱が画面の中か、字が箱からあふれていないか
      const fits = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length).map((e) => {
        const r = e.getBoundingClientRect();
        const inView = r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
        const over = e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1;
        return inView && !over ? '' : `${sel}${inView ? '' : '(画面の外)'}${over ? '(字があふれ)' : ''}`;
      }).filter(Boolean), sel);
      try {
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 120000 });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
        await page.locator('[data-home-card-battle]').waitFor({ timeout: 30000 });
        for (let i = 0; i < 6; i++) { const x = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first(); if (!(await x.count()) || !(await x.isVisible().catch(() => false))) break; await x.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
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
        // 今日のオートのごほうびは使い切った(3回)。11/7 は戻しの印 r を付ける(96 の CARD_AUTO_REWARD_RESET_MARK)
        await page.evaluate(async () => { await storeSet('mh_card_auto_reward_v1', { v: 1, day: cardTodayJst(), n: 3, r: CARD_AUTO_REWARD_RESET_MARK }); });
        const decks = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_decks_v1')));
        const d0 = decks.decks[0];
        shareRow = { owner_id: 'check-breeder-1', user_name: '検査の相手', icon: null, profile_frame: null, deck: { monsters: d0.monsters, cards: d0.cards }, tactics: {}, version: 1, active: true, battles: 3, deck_wins: 2, rents: 0, updated_at: new Date().toISOString() };
        await page.locator('[data-card-cpu]').click();
        await page.getByRole('button', { name: /^(分かった|(?:分|わ)かった)$/ }).click({ timeout: 2500 }).catch(() => {});
        await page.locator('[data-card-mode-assistant]').click();
        await page.locator('[data-card-foe-tab="breeder"]').click();
        await page.locator('[data-card-share-fight="check-breeder-1"]').click({ timeout: 15000 });
        await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 8000 });
        await page.locator('[data-card-deck-pick-mode="auto"]').click();
        await page.locator('[data-card-deck-pick-quick="off"]').click();
        await page.locator('[data-card-deck-pick-go]').click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 60000 });
        await reRot();
        // ① 結果の画面の札とボタン
        await page.locator('[data-card-auto-reward-bar]').waitFor({ timeout: 8000 });
        const bar0 = await page.locator('[data-card-auto-reward-bar]').getAttribute('data-card-auto-reward-bar');
        const left0 = await page.locator('[data-card-auto-reward-left]').getAttribute('data-card-auto-reward-left');
        const btnOn = await page.locator('[data-card-auto-ticket]').isEnabled();
        await page.locator('[data-card-auto-reward-bar]').scrollIntoViewIfNeeded();
        await shot('1-result-empty');
        check(`① ${L}: 結果の画面に残りの札(残り0は目立たせる)と、押せる「セッション券でふやす」`, bar0 === 'empty' && left0 === '0' && btnOn, `${bar0} 残り${left0} ${btnOn}`);
        const bad1 = await fits('[data-card-auto-reward-bar] [data-card-auto-reward-left], [data-card-auto-ticket]');
        check(`⑥ ${L}: 札とボタンの字が切れず、画面の中にある`, bad1.length === 0, bad1.join(' / '));
        // ② 窓で数を変える
        await page.locator('[data-card-auto-ticket]').click();
        const ask = page.locator('[data-card-auto-ticket-ask]');
        await ask.waitFor({ timeout: 5000 });
        const state = () => page.evaluate(() => {
          const pick = document.querySelector('[data-card-auto-ticket-pick]');
          const use = document.querySelector('[data-card-auto-ticket-use]');
          return { k: Number(pick && pick.getAttribute('data-card-auto-ticket-pick')), input: (document.querySelector('[data-card-auto-ticket-ask] [data-quantity-input]') || {}).value,
            preview: (document.querySelector('[data-card-auto-ticket-preview]') || {}).textContent || '', use: use ? use.textContent : '', useK: use ? Number(use.getAttribute('data-card-auto-ticket-use')) : null };
        });
        // 表示(数の欄・「券 ◯枚 → +◯回(残り ◯回)」・確定のボタン)が、選んだ数とそろっているか
        const agree = (st, k, base = 0) => st.k === k && st.input === String(k) && st.useK === k && st.use === `${k}枚使って+${k}回` && st.preview.includes(`券 ${k}枚 → オートのごほうび +${k}回(残り ${base + k}回になります)`);
        const btn = (t) => ask.locator('button').filter({ hasText: new RegExp(`^${t.replace('+', '\\+')}$`) });
        const steps = [];
        let st = await state(); steps.push(['はじめ', 1, agree(st, 1), st]);
        await btn('+1').click(); await btn('+1').click(); st = await state(); steps.push(['+1を2回', 3, agree(st, 3), st]);
        await btn('-1').click(); st = await state(); steps.push(['-1', 2, agree(st, 2), st]);
        await ask.locator('button').filter({ hasText: /^MAX/ }).click(); st = await state(); steps.push(['MAX(券7枚・あと20回の小さいほう)', 7, agree(st, 7), st]);
        await btn('-10').click(); st = await state(); steps.push(['-10(1より下へは行かない)', 1, agree(st, 1), st]);
        await btn('+10').click(); st = await state(); steps.push(['+10(7より上へは行かない)', 7, agree(st, 7), st]);
        const input = ask.locator('[data-quantity-input]');
        await input.fill('５'); st = await state(); steps.push(['打ち込み「５」(全角)', 5, agree(st, 5), st]);
        await input.fill('2.9'); st = await state(); steps.push(['打ち込み「2.9」(小数は切り捨て)', 2, agree(st, 2), st]);
        await input.fill(''); await input.blur(); st = await state(); steps.push(['空欄(1として読む)', 1, agree(st, 1), st]);
        await input.fill('99'); st = await state(); steps.push(['打ち込み「99」(7まで)', 7, agree(st, 7), st]);
        await input.fill('4'); await input.blur(); st = await state(); steps.push(['打ち込み「4」', 4, agree(st, 4), st]);
        const miss = steps.filter((x) => !x[2]);
        check(`② ${L}: +1・−1・MAX・+10・−10・打ち込み(全角・小数・空欄・大きすぎ)で、数と「券◯枚 → +◯回(残り ◯回)」と確定のボタンがそろう`, miss.length === 0,
          miss.map((x) => `${x[0]}: ほしい${x[1]} → ${JSON.stringify(x[3])}`).join(' / '));
        await shot('2-sheet-4');
        const bad2 = await fits('[data-card-auto-ticket-ask] h3, [data-card-auto-ticket-ask] button, [data-card-auto-ticket-preview], [data-card-auto-ticket-ask] [data-quantity-input]');
        check(`⑥ ${L}: 窓の題・ボタン・「券◯枚 → +◯回」が画面に収まり、字が切れない`, bad2.length === 0, bad2.join(' / '));
        // ③ 確定 → 券は4枚減り、残りは4ふえる
        const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items')).session_ticket);
        await ask.locator('[data-card-auto-ticket-use]').click();
        await ask.waitFor({ state: 'detached', timeout: 8000 });
        await page.locator('[data-card-auto-reward-bar="left"]').waitFor({ timeout: 8000 });
        const after = await page.evaluate(async () => ({ tickets: JSON.parse(localStorage.getItem('mh_owned_items')).session_ticket, store: await storeGet('mh_card_auto_reward_v1', null),
          left: document.querySelector('[data-card-auto-reward-left]').getAttribute('data-card-auto-reward-left'), note: (document.querySelector('[data-card-auto-ticket-note]') || {}).textContent || '' }));
        await shot('3-result-added');
        check(`③ ${L}: 表示どおり、券が4枚減り(7→3)、残りの札が0→4、保存の extra が4`, before === 7 && after.tickets === 3 && after.left === '4' && after.store && after.store.extra === 4 && /オートのごほうびが4回ふえました/.test(after.note) && !/戻りました/.test(after.note), JSON.stringify(after));
        // ④ もう一度 → ごほうびあり。⑤ 残りがあるときも押せて、今の残りに足される
        await page.locator('[data-card-top="result"] button, [data-mh-screen] button').filter({ hasText: /^もう一度/ }).first().click();
        await page.waitForTimeout(1200);
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 60000 });
        await reRot();
        await page.locator('[data-card-auto-reward-left="3"]').waitFor({ timeout: 8000 }).catch(() => {});
        const paid = await page.locator('[data-card-result-auto]').getAttribute('data-card-result-auto');
        const bar2 = await page.locator('[data-card-auto-reward-bar]').getAttribute('data-card-auto-reward-bar');
        const left2 = await page.locator('[data-card-auto-reward-left]').getAttribute('data-card-auto-reward-left');
        const on2 = await page.locator('[data-card-auto-ticket]').isEnabled();
        const why2 = await page.locator('[data-card-auto-ticket-why]').count();
        await page.locator('[data-card-auto-reward-bar]').scrollIntoViewIfNeeded();
        await shot('4-result-paid');
        check(`④ ${L}: ふやしたあとの「もう一度」は、ごほうびあり(残り4→3)`, paid === 'paid' && left2 === '3', `${paid} 残り${left2}`);
        check(`⑤ ${L}: 残りがあるときは控えめ(left)だが、ボタンは押せて、止めるわけは出さない`, bar2 === 'left' && on2 && why2 === 0, `${bar2} ${on2} わけ${why2}`);
        // ⑤ 残り3から2枚ふやす: 窓は「残り 5回になります」・確定で札も5・券は3→1・extra は4→6
        await page.locator('[data-card-auto-ticket]').click();
        await ask.waitFor({ timeout: 5000 });
        await ask.locator('[data-quantity-input]').fill('2'); await ask.locator('[data-quantity-input]').blur();
        const st5 = await state();
        const max5 = await ask.locator('button').filter({ hasText: /^MAX/ }).innerText();
        await shot('5-sheet-left3');
        check(`⑤ ${L}: 残り3のとき、2枚で「券 2枚 → +2回(残り 5回になります)」・最大は持っている券3枚`, agree(st5, 2, 3) && /3枚/.test(max5), `${JSON.stringify(st5)} ${max5}`);
        await ask.locator('[data-card-auto-ticket-use]').click();
        await ask.waitFor({ state: 'detached', timeout: 8000 });
        await page.locator('[data-card-auto-reward-left="5"]').waitFor({ timeout: 8000 }).catch(() => {});
        const after5 = await page.evaluate(async () => ({ tickets: JSON.parse(localStorage.getItem('mh_owned_items')).session_ticket, store: await storeGet('mh_card_auto_reward_v1', null),
          left: document.querySelector('[data-card-auto-reward-left]').getAttribute('data-card-auto-reward-left'), note: (document.querySelector('[data-card-auto-ticket-note]') || {}).textContent || '' }));
        await page.locator('[data-card-auto-reward-bar]').scrollIntoViewIfNeeded();
        await shot('6-result-left5');
        check(`⑤ ${L}: 表示どおり、残りの札が3→5、券が3→1、保存の extra が4→6、言葉は「オートのごほうびが2回ふえました」`, after5.left === '5' && after5.tickets === 1 && after5.store && after5.store.extra === 6 && /オートのごほうびが2回ふえました/.test(after5.note) && !/戻りました/.test(after5.note), JSON.stringify(after5));
        check(`⑦ ${L}: 実行時エラーが無い・サーバの表へ書かない`, errors.length === 0 && sent.length === 0, [...errors.slice(0, 2), ...sent.slice(0, 2)].join(' / '));
      } catch (e) {
        check(`${L}: 最後まで進められた`, false, String(e).split('\n')[0]);
      } finally {
        await page.close();
      }
    }
  } finally {
    await b.close(); server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
