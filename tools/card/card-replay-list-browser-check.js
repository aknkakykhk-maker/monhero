#!/usr/bin/env node
// MFバトルカードの「過去の対戦」の一覧(93-card-replay.jsx・記録の画面)を、実際のブラウザで確かめる(2026-10-27・カード部ミカエシくん)。
// 社長「過去の対戦は記録にも残してそこからみれるようにはできないの？」→ 50試合・★10
//
//   node tools/card/card-replay-list-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、一覧の写真を残す
//
//   ① HOME の入口 → はじめのスターター → 練習試合を飛ばす → トップ → 記録 →「過去の対戦」が開く(はじめは「まだありません」)
//   ② 試合の記録を55試合ぶん足すと、一覧には新しい50試合が出る(日時・相手・種類・勝ち負け・◯番まで)
//   ③ ★を付けると保存され、開き直しても付いている。11試合目の★は付かず、案内が出る
//   ④ 行を押すと見返しが開き、「とじる」で一覧へ戻る。はじまりと1手目の上の帯は「はじまり」・上下の帯の番がそろう・吹き出しは出ない
//   ⑤ 保存の場所がいっぱいのとき: ほかのセーブ(mh_ のキー)を書き換えず、ゲーム全体の「保存できない」の数も増やさない。
//      古い試合(★は残す)から消して入れ、書いたあとも空きを残す
//   ⑥ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8946;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }).catch(() => {}); } };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // 本物の Supabase には書かない(ランキングなどの送り先をふさぐ)
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
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
    await page.locator('[data-home-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 30000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });

    // ①
    const openList = async () => {
      await page.locator('[data-card-record-open]').first().dispatchEvent('click');
      await page.locator('[data-card-replays-open]').waitFor({ timeout: 10000 });
      await page.locator('[data-card-replays-open]').click();
      await page.locator('[data-card-replay-list]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(300);
    };
    await openList();
    check('① 記録の画面から「過去の対戦」が開く・はじめは「まだありません」', (await page.locator('[data-card-replay-empty]').count()) === 1);

    // ② 55試合ぶんの記録を、ゲームの中の関数で作って足す(助手どうしの試合を本当に最後まで打つ)
    const made = await page.evaluate(async () => {
      const db = CARD_BATTLE_DATA;
      const rand = (() => { let s = 7; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();
      const who = ['mua', 'kiki', 'momosuke', 'dra', 'kyuko', 'atsu'];
      const base = [];
      for (let n = 0; n < 5; n++) {
        const myDeck = cardAiBuildDeck(db, who[n], 'normal', rand), cpuDeck = cardAiBuildDeck(db, who[(n + 1) % 6], 'normal', rand);
        const seed = 1000 + n, first = n % 2;
        let st = cardCreateGame(db, { decks: [myDeck, cpuDeck], names: ['あなた', 'あいて'], seed, first });
        const pol = cardAiPolicy('kyuko', 'normal');
        const history = [];
        for (let k = 0; k < 3000 && st.winner === null; k++) {
          const by = cardPvpDecider(st);
          let act = cardAiChooseAction(db, st, pol, rand);
          let next = act && cardApplyAction(db, st, act);
          if (!next) { act = cardPvpTimeoutAct(st); next = cardApplyAction(db, st, act); }
          if (!next) break;
          history.push({ by, act: JSON.parse(JSON.stringify(act)) }); st = next;
        }
        base.push(cardReplayFromCpu(db, { id: `t${n}`, at: 1, myDeck, cpuDeck, seed, first, history, foe: { name: ASSISTANTS.find((a) => a.id === who[(n + 1) % 6]).name, who: who[(n + 1) % 6] }, outcome: st.winner === 0 ? 'win' : 'lose' }));
      }
      let ok = 0;
      const t0 = Date.parse('2026-10-27T00:00:00+09:00');
      for (let i = 0; i < 55; i++) { if (await cardReplaySave({ ...base[i % 5], id: `t${i}`, at: t0 + i * 60000 })) ok += 1; }
      const box = JSON.parse(localStorage.getItem('mh_card_replays_v1'));
      return { ok, n: box.list.length, kb: Math.round(JSON.stringify(box).length / 1024), top: box.list[0].id };
    });
    check('② 55試合足すと、残るのは新しい50試合(いちばん新しいのが先頭)', made.ok === 55 && made.n === 50 && made.top === 't54', JSON.stringify(made));
    // 一覧は開いたときに読むので、記録の画面へ戻って開き直す
    await page.locator('[data-card-replay-list] [aria-label="戻る"]').first().click();
    await page.locator('[data-card-replays-open]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-replays-open]').click();
    await page.locator('[data-card-replay-row]').first().waitFor({ timeout: 10000 });
    const rows = await page.locator('[data-card-replay-row]').count();
    const firstText = await page.locator('[data-card-replay-row]').first().innerText();
    check('② 一覧に50試合が並び、日時・相手・種類・勝ち負け・◯番までが出る', rows === 50 && /10\/27 0?0:54/.test(firstText) && /助手と対戦/.test(firstText) && /番まで/.test(firstText) && /勝ち|負け/.test(firstText), `${rows}行 ${firstText.replace(/\n/g, ' ')}`);
    await shot(page, 'replay-list');

    // ③ ★
    for (let i = 0; i < 10; i++) await page.locator('[data-card-replay-fav]').nth(i).click();
    await page.locator('[data-card-replay-fav]').nth(10).click();
    await page.waitForTimeout(200);
    const note = await page.locator('[data-card-replay-note]').innerText().catch(() => '');
    const pressed = await page.locator('[data-card-replay-fav][aria-pressed="true"]').count();
    const savedFav = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_replays_v1')).list.filter((r) => r.fav).length);
    check('③ ★は10試合まで付いて保存され、11試合目は付かずに案内が出る', pressed === 10 && savedFav === 10 && /10試合まで/.test(note), `${pressed} / ${savedFav} / ${note}`);

    // ④ 開いて閉じる
    await page.locator('[data-card-replay-open]').nth(3).click();
    await page.locator('[data-card-replay-bar]').waitFor({ timeout: 15000 });
    const step0 = await page.locator('[data-card-replay-step]').innerText();
    // はじまりと1手目(始める前のガッツ)は、上の帯も下の帯も「はじまり」。見返しでは助手の吹き出しを出さない(2026-10-27 カゲあつくんの見直し)
    const head0 = await page.locator('[data-card-head-turn]').innerText();
    await page.locator('[data-card-replay-next]').click();
    const head1 = await page.locator('[data-card-head-turn]').innerText();
    const bar1 = await page.locator('[data-card-replay-turn]').innerText();
    await page.waitForTimeout(1500);
    const bubbles = await page.locator('[data-card-bubble]').count();
    check('④ はじまりと1手目は、上の帯・下の帯とも「はじまり」・吹き出しは出ない', /はじまり/.test(head0) && /はじまり/.test(head1) && /はじまり/.test(bar1) && bubbles === 0, `${head0} / ${head1} / ${bar1} / 吹き出し${bubbles}`);
    await page.locator('[data-card-replay-next-turn]').click();
    const headN = await page.locator('[data-card-head-turn]').innerText();
    const barN = await page.locator('[data-card-replay-turn]').innerText();
    const turnOf = (t) => (t.match(/(\d+)/) || [])[1];
    let banners = 0;
    for (let k = 0; k < 3; k++) { await page.locator('[data-card-replay-next-turn]').click(); await page.waitForTimeout(150); banners += await page.locator('[data-card-turn-banner]').count(); }
    check('④ 見返しで番を進めても、まんなかの番の帯は出ない(上下の帯と食い違わない)', banners === 0, String(banners));
    check('④ 番を進めると、上の帯の番と下の帯の番がそろう', !!turnOf(headN) && /番目の番/.test(barN) && barN.includes(`${turnOf(headN)}番目の番`), `${headN} / ${barN}`);
    await shot(page, 'replay-open');
    await page.locator('[data-card-replay-exit]').click();
    const back = await page.locator('[data-card-replay-list]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check('④ 行を押すと見返しが開き、「とじる」で一覧へ戻る', /^0\//.test(step0) && back, step0);

    // ⑤ 保存の場所がいっぱいのとき
    const full = await page.evaluate(async () => {
      const others = () => JSON.stringify(Object.keys(localStorage).filter((k) => k.startsWith('mh_') && k !== 'mh_card_replays_v1').sort().map((k) => [k, localStorage.getItem(k)]));
      const before = others();
      const fails0 = getStorageHealth().failures;
      // 空きがほとんど無くなるまで、ゲームと関係のないキーで埋める
      const junk = [];
      let size = 1 << 20;
      while (size >= 1024) { try { const k = `__junk_${junk.length}`; localStorage.setItem(k, 'x'.repeat(size)); junk.push(k); } catch (_) { size = size >> 1; } }
      const nBefore = JSON.parse(localStorage.getItem('mh_card_replays_v1')).list.length;
      const rec = JSON.parse(localStorage.getItem('mh_card_replays_v1')).list[5];
      const saved = await cardReplaySave({ ...rec, id: 'tnew', at: Date.parse('2026-10-28T00:00:00+09:00'), fav: false });
      const box = JSON.parse(localStorage.getItem('mh_card_replays_v1'));
      let room = false;
      try { localStorage.setItem('__junk_room', 'x'.repeat(100000)); room = true; localStorage.removeItem('__junk_room'); } catch (_) { room = false; }
      junk.forEach((k) => localStorage.removeItem(k));
      return { same: before === others(), fails: getStorageHealth().failures - fails0, saved, nBefore, nAfter: box.list.length, favs: box.list.filter((r) => r.fav).length, top: box.list[0].id, room };
    });
    check('⑤ いっぱいでも、ほかのセーブを書き換えず、ゲーム全体の「保存できない」の数も増えない', full.same && full.fails === 0, JSON.stringify(full));
    check('⑤ 古い試合から消して新しい試合を入れ、★の試合は残し、書いたあとも空きを残す', full.saved && full.top === 'tnew' && full.nAfter < full.nBefore + 1 && full.favs === 10 && full.room, JSON.stringify(full));
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('最後まで動く', false, String(e).slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
