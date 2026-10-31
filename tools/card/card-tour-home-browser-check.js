// 公式杯の HOME の札(2026-10-31 社長「公式の大会はイベント的にするからホームに置く」・案A)を、実際のブラウザで確かめる。
//   node tools/card/card-tour-home-browser-check.js
// 大会の表(card_tournament_list / _history / _view)は、この検査の中で返す(本物の表は読まない・書かない)
// 見るもの
//   ① 札の中身(cardTourHomeBanner): 受付が始まる前は出さない・受付中は残り日数・1日を切ったら時間・開催中・結果発表の1週間あとまで出して、そのあとは出さない・1位のビートP
//   ② HOME に札が出る(大会名・受付中・1位のビートP)。ハロウィン・ナイトの札の下、MFバトルカードの札の上
//   ③ 札を押すと、MFバトルカードの大会のトップ(その大会)が開く
//   ④ 大会のトップで戻ると、HOME へ帰る
//   ⑤ 実行時エラーが出ない
//   ⑥ 大会が1つも無いあいだは、HOME の札もプロフィールの「公式杯の記録」も出ない
//   ⑦ プロフィールの「MFバトルカード 公式杯の記録」→ 一覧(順位・優勝・1位のビートP)→「結果を見る」でその大会の結果のタブ → 戻るとプロフィール
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8998;
const SHOT = process.env.CARD_SHOT_DIR || '';
// 画面の大きさ(既定は iPhone 13 の 390×844。SE は CARD_VIEWPORT=375x667)
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
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

(async () => {
  const playwright = require('playwright');
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    const now = Date.now();
    const jst = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
    const tour = { id: 'hcheck', name: '第1回 MFバトルカード公式杯', open_on: jst(now - 86400000), entry_until: new Date(now + 2 * 86400000 + 5 * 3600000).toISOString(), status: 'entry',
      first_day: jst(now + 3 * 86400000), done_day: jst(now + 9 * 86400000), groups: 1, rewards: { ranks: [{ point: 10000 }, { point: 5000 }] }, players: 3 };
    // 終わった大会(プロフィールの記録・結果のタブ)
    const past = { id: 'hpast', name: '第0回 MFバトルカード公式杯', open_on: jst(now - 20 * 86400000), entry_until: new Date(now - 18 * 86400000).toISOString(), status: 'done',
      first_day: jst(now - 17 * 86400000), done_day: jst(now - 10 * 86400000), groups: 1, rewards: { ranks: [{ point: 20000 }] }, players: 2 };
    const pastEntries = [{ seat_id: 'a', mine: true, is_assist: false, user_name: '検査ブリーダー', monsters: [], grp: 0, seat: 0, place: 2, wins: 0 },
      { seat_id: 'b', mine: false, is_assist: false, user_name: 'ライバル', monsters: [], grp: 0, seat: 1, place: 1, wins: 1 }];
    // 返す中身は、段ごとに切り替える(はじめは大会が1つも無い)
    const db = { list: [], history: [] };
    const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    await page.route('**/rest/v1/rpc/card_tournament_list', (r) => json(r, db.list));
    await page.route('**/rest/v1/rpc/card_tournament_history', (r) => json(r, db.history));
    await page.route('**/rest/v1/rpc/card_tournament_view', (r) => {
      const id = (() => { try { return JSON.parse(r.request().postData() || '{}').p_tour; } catch (_) { return null; } })();
      return json(r, id === past.id ? { tour: past, me: true, entries: pastEntries, matches: [] } : { tour, me: false, entries: [], matches: [] });
    });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      localStorage.setItem('mh_debug_unlocked_v1', '1'); // デバッグの端末(公開の印が立つまで、札はここにだけ出る)
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
    await page.waitForTimeout(1500);
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
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    // スターターを選ぶと練習試合が始まるので、飛ばしてトップへ
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const fails = [];
    const ok = (cond, msg) => { if (!cond) fails.push(msg); };
    // ① 札の中身(画面の外で、関数だけ)
    const unit = await page.evaluate(() => {
      const day = 86400000, now = Date.parse('2026-11-10T12:00:00+09:00');
      const base = { id: 't', name: '大会', openOn: '2026-11-08', entryUntil: now + 2 * day + 5 * 3600000, status: 'entry', doneDay: '2026-11-20', rewards: { ranks: [{ point: 10000 }], participation: { point: 0 }, perWin: 0 } };
      const B = (t, at = now) => cardTourHomeBanner([t], at);
      return {
        before: B({ ...base, openOn: '2026-11-11' }),
        entry: B(base), hours: B({ ...base, entryUntil: now + 5 * 3600000 + 60000 }), mins: B({ ...base, entryUntil: now + 20 * 60000 }),
        making: B({ ...base, entryUntil: now - 1000 }), group: B({ ...base, status: 'group' }), final: B({ ...base, status: 'final' }),
        done6: B({ ...base, status: 'done', doneDay: '2026-11-04' }), done8: B({ ...base, status: 'done', doneDay: '2026-11-02' }),
        noPrize: B({ ...base, rewards: { ranks: [], participation: { point: 0 }, perWin: 0 } }),
        both: cardTourHomeBanner([{ ...base, id: 'new', status: 'entry' }, { ...base, id: 'old', status: 'done', doneDay: '2026-11-08' }], now),
        none: cardTourHomeBanner([], now), bad: cardTourHomeBanner(null, now),
      };
    });
    ok(unit.before === null, '① 受付が始まる前に札が出ている');
    ok(unit.entry && unit.entry.sub === '受付中 あと2日' && unit.entry.prize === '1位 ビートP 10,000', `① 受付中の札がちがう(${JSON.stringify(unit.entry)})`);
    ok(unit.hours && unit.hours.sub === '受付中 あと5時間', `① 1日を切ったら時間(${unit.hours && unit.hours.sub})`);
    ok(unit.mins && unit.mins.sub === '受付中 あと20分', `① 1時間を切ったら分(${unit.mins && unit.mins.sub})`);
    ok(unit.making && unit.making.sub === '組み合わせ中', `① 締め切りのあと(${unit.making && unit.making.sub})`);
    ok(unit.group && unit.group.sub === '開催中' && unit.final && unit.final.sub === '開催中 頂上決戦', '① 開催中の札がちがう');
    ok(unit.done6 && unit.done6.sub === '結果発表', '① 結果発表から6日目に札が出ていない');
    ok(unit.done8 === null, '① 結果発表から1週間を過ぎても札が出ている');
    ok(unit.noPrize && unit.noPrize.prize === '', '① ごほうびが無い大会にビートPが出ている');
    ok(unit.both && unit.both.id === 'new', '① 開いている大会より、終わった大会を出している');
    ok(unit.none === null && unit.bad === null, '① 大会が無いのに札が出ている');
    // HOME まで読み込み直す(スターターを持った状態)
    const banner = page.locator('[data-home-card-tour]');
    const histBtn = page.locator('[data-profile-card-tour-history]');
    // HOME に重なる窓(新しい助手・お知らせ など)を、出なくなるまで閉じる(3回続けて何も無ければ終わり)
    const closeAll = async () => {
      let quiet = 0;
      for (let i = 0; i < 60 && quiet < 3; i++) {
        const btn = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|次へ|とじる|あとで|あとで読む)$/ });
        let hit = false;
        for (const b of await btn.all()) { if (await b.isVisible().catch(() => false)) { await b.dispatchEvent('click').catch(() => {}); hit = true; break; } }
        quiet = hit ? 0 : quiet + 1;
        await page.waitForTimeout(hit ? 300 : 500);
      }
    };
    const toHome = async () => {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.locator('.mh-home-player').first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(2500);
      await closeAll();
    };
    const toProfile = async () => {
      await closeAll();
      await page.locator('.mh-home-player').first().click();
      await page.locator('[data-mh-screen]').getByText('プロフィール').first().waitFor({ timeout: 20000 });
      await page.waitForTimeout(2500);
    };
    // ⑥ 大会が1つも無いあいだは、HOME の札もプロフィールのボタンも出ない
    await toHome();
    ok(await banner.count() === 0, '⑥ 大会が無いのに HOME に公式杯の札が出ている');
    await toProfile();
    ok(await histBtn.count() === 0, '⑥ 終わった大会が無いのにプロフィールに公式杯の記録が出ている');
    // ② 大会があると HOME に札が出る
    db.list = [tour]; db.history = [{ id: past.id, name: past.name, open_on: past.open_on, done_day: past.done_day, rewards: past.rewards, players: 2,
      winner: { name: 'ライバル', is_assist: false, assist_id: null }, my_place: 2, my_entered: true }];
    await toHome();
    await banner.waitFor({ timeout: 20000 }).catch(() => {});
    ok(await banner.isVisible().catch(() => false), '② HOME に公式杯の札が出ていない');
    const text = (await banner.textContent().catch(() => '')) || '';
    ok(/第1回 MFバトルカード公式杯/.test(text) && /受付中 あと2日/.test(text) && /1位 ビートP 10,000/.test(text), `② 札の文字がちがう(${text})`);
    const pos = await page.evaluate(() => {
      const r = (s) => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect(); return b.height ? { top: b.top, bottom: b.bottom } : null; };
      return { ev: r('[data-home-event-banner]'), tour: r('[data-home-card-tour]'), card: r('[data-home-card-battle]') };
    });
    if (pos.ev && pos.tour) ok(pos.ev.bottom <= pos.tour.top, '② 公式杯の札がイベントの札の下にない');
    if (pos.tour && pos.card) ok(pos.tour.bottom <= pos.card.top, '② 公式杯の札が MFバトルカードの札の上にない');
    // ③ 押すと大会のトップ
    await banner.click();
    const head = page.locator('[data-card-tour-head]');
    await head.waitFor({ timeout: 20000 }).catch(() => {});
    ok(/第1回 MFバトルカード公式杯/.test((await head.textContent().catch(() => '')) || ''), '③ 札を押しても、その大会のトップが開かない');
    // ④ 戻ると HOME
    await page.locator('[data-card-tour]').getByRole('button', { name: '戻る' }).first().click().catch(() => {});
    await banner.waitFor({ timeout: 20000 }).catch(() => {});
    ok(await banner.isVisible().catch(() => false), '④ 大会のトップで戻っても HOME に帰らない');
    // ⑦ プロフィールの「MFバトルカード 公式杯の記録」→ 一覧 →「結果を見る」でその大会の結果 → 戻るとプロフィール
    await toProfile();
    await histBtn.waitFor({ timeout: 20000 }).catch(() => {});
    ok(/公式杯の記録/.test((await histBtn.textContent().catch(() => '')) || '') && /1件/.test((await histBtn.textContent().catch(() => '')) || ''), '⑦ プロフィールに公式杯の記録(1件)が出ていない');
    await histBtn.click().catch(() => {});
    const row = page.locator(`[data-card-tour-history-row="${past.id}"]`);
    await row.waitFor({ timeout: 10000 }).catch(() => {});
    const rowText = (await row.textContent().catch(() => '')) || '';
    ok(/第0回/.test(rowText) && /あなた 2位/.test(rowText) && /優勝 ライバル/.test(rowText) && /1位 ビートP 20,000/.test(rowText), `⑦ 一覧の行がちがう(${rowText})`);
    await row.locator('[data-card-tour-history-open="result"]').click().catch(() => {});
    await page.locator('[data-card-tour-head]').waitFor({ timeout: 20000 }).catch(() => {});
    ok(/第0回/.test((await page.locator('[data-card-tour-head]').textContent().catch(() => '')) || ''), '⑦「結果を見る」でその大会が開かない');
    ok(await page.locator('[data-card-tour-tab="result"].bg-gradient-to-b').count() === 1, '⑦「結果を見る」で結果のタブが開いていない');
    await page.locator('[data-card-tour]').getByRole('button', { name: '戻る' }).first().click().catch(() => {});
    await histBtn.waitFor({ timeout: 20000 }).catch(() => {});
    ok(await histBtn.isVisible().catch(() => false), '⑦ 大会の画面で戻ってもプロフィールに帰らない');
    ok(errors.length === 0, `⑤ 実行時エラー: ${errors.slice(0, 3).join(' / ')}`);
    if (fails.length) { console.error(`NG ${fails.length}件\n` + fails.map((f) => `  ✗ ${f}`).join('\n')); process.exitCode = 1; }
    else console.log('すべてOK');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
