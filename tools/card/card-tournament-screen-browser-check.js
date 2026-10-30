#!/usr/bin/env node
// MFバトルカード大会の画面(99-card-tournament.jsx)を、偽物の表の答えで実際のブラウザに描いて確かめる(2026-10-30 ルールくん・大会 PR3)
//
//   node tools/card/card-tournament-screen-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、画面ごとの写真を残す
//
//   ゲームを開いたあと、大会の画面(CardTournament)だけを、ゲームの上に重ねて描く(本物の Supabase には行かない)
//   ① 受付中: 日程・登録したデッキ・「このデッキでエントリーする」→ エントリーの関数に鍵つきで頼む → 「エントリーしています」と取り消し
//   ② 総当たりの最中: 対戦表(○×・まだの試合は日付・自分の行)・いまの順位・4:00 より前の試合は結果を出さない
//   ③ 試合: 発表ずみの日の結果と実況・解説・見返しは準備中・次の日の試合は「4:00 に出ます」
//   ④ まだ会っていない助手は、顔と名前を出さない(「助手」)
//   ⑤ 終わった大会: まず対戦表で「大会結果」の演出(空の表 → ○× → 上位3人に印・演出リプレイ)・最終順位・あなたのごほうび → 受け取ると onCredit に渡り、「受け取りました」
//   ⑥ 表が無いときは「準備中」・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8961;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const J = (v) => JSON.stringify(v);
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }).catch(() => {}); } };

// ---- 偽物の大会 ----
const DAY = 86400000;
const jst = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const now = Date.now();
const today = jst(now);
const add = (ymd, n) => jst(Date.parse(`${ymd}T00:00:00+09:00`) + n * DAY);
const at4 = (ymd) => new Date(Date.parse(`${ymd}T04:00:00+09:00`)).toISOString();
const KEY = 'a'.repeat(48);
const MONS = ['C-001', 'C-002', 'C-003'];
const REWARDS = { ranks: [{ point: 3000, title: '検査杯 優勝' }, { point: 2000 }], participation: { point: 500 }, perWin: 100 };
const tourEntry = { id: 'cup-entry', name: '検査杯(受付)', open_on: add(today, -1), entry_until: new Date(now + DAY).toISOString(), status: 'entry', rewards: REWARDS, players: 3 };
// 4人の総当たり(自分・ほか2人・まだ会っていない助手)。1日目は発表ずみ、2日目はきょうの 4:00 より前ならまだ
const first = add(today, -1);
const tourGroup = { id: 'cup-group', name: '検査杯(総当たり)', open_on: add(today, -3), entry_until: new Date(Date.parse(`${first}T00:00:00+09:00`)).toISOString(), status: 'group', first_day: first, groups: 1, rewards: REWARDS };
const ent = (seat, o) => ({ seat_id: o.id, mine: !!o.mine, is_assist: !!o.assist, assist_id: o.assist || null, user_name: o.name, monsters: MONS, grp: 0, seat, final_seat: null, place: o.place || null, wins: o.wins ?? null });
const groupEntries = [ent(0, { id: 'me', name: '検査ブリーダー', mine: true }), ent(1, { id: 'p1', name: 'もちお' }), ent(2, { id: 'p2', name: 'ハム次郎' }), ent(3, { id: 'assist-0-3', name: 'ソラシド', assist: 'sorashido' })];
const LIVE = { who: 'kiki', play: '検査の実況です。最後まで目が離せない試合でした', review: '検査の解説です。守りの札を残したのが勝ちにつながりました', ai: true };
const groupMatches = [
  { id: 11, stage: 'group', grp: 0, day: 0, a: 0, b: 1, play_on: first, visible_at: at4(first), winner: 0, kos: [3, 1], decided: 'ko', live: LIVE },
  { id: 12, stage: 'group', grp: 0, day: 0, a: 2, b: 3, play_on: first, visible_at: at4(first), winner: 1, kos: [2, 3], decided: 'ko', live: LIVE },
  { id: 13, stage: 'group', grp: 0, day: 1, a: 0, b: 2, play_on: add(first, 1), visible_at: at4(add(first, 2)), winner: null, kos: null, decided: null, live: null },
  { id: 14, stage: 'group', grp: 0, day: 1, a: 1, b: 3, play_on: add(first, 1), visible_at: at4(add(first, 2)), winner: null, kos: null, decided: null, live: null },
];
const tourDone = { id: 'cup-done', name: '検査杯(終わり)', open_on: add(today, -6), entry_until: new Date(Date.parse(`${add(today, -4)}T00:00:00+09:00`)).toISOString(), status: 'done', first_day: add(today, -4), done_day: add(today, -2), groups: 1, rewards: REWARDS };
const doneEntries = [ent(0, { id: 'me', name: '検査ブリーダー', mine: true, place: 1, wins: 3 }), ent(1, { id: 'p1', name: 'もちお', place: 2, wins: 2 }), ent(2, { id: 'p2', name: 'ハム次郎', place: 3, wins: 1 }), ent(3, { id: 'assist-0-3', name: 'ドラ', assist: 'dra', place: 4, wins: 0 })];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  const calls = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    let tours = [tourEntry];
    let entered = false;
    let tablesOff = false;
    await page.route(/supabase\.co/, async (route) => {
      const url = route.request().url();
      const m = url.match(/rpc\/(card_tournament_[a-z]+)/);
      if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('card_deck_entries') ? JSON.stringify([{ owner_id: 'me', user_name: '検査ブリーダー', deck: { monsters: MONS, cards: Array(50).fill('001') }, tactics: { habit: 'kiki', name: '検査デッキ' }, version: 1, active: true, battles: 0, deck_wins: 0, rents: 0, updated_at: new Date().toISOString() }]) : '[]' });
      if (tablesOff) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST202","message":"Could not find the function"}' });
      const body = JSON.parse(route.request().postData() || '{}');
      calls.push({ fn: m[1], body });
      const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
      if (m[1] === 'card_tournament_list') return json(tours);
      if (m[1] === 'card_tournament_enter') { entered = true; return json('ok'); }
      if (m[1] === 'card_tournament_withdraw') { entered = false; return json('ok'); }
      if (m[1] === 'card_tournament_claim') return json({ status: 'ok', point: 3300, title: '検査杯 優勝', frame: '', place: 1 });
      if (m[1] === 'card_tournament_view') {
        const t = tours.find((x) => x.id === body.p_tour);
        if (t.status === 'entry') return json({ tour: t, me: entered, entries: [], matches: [] });
        if (t.status === 'done') return json({ tour: t, me: true, entries: doneEntries, matches: groupMatches.map((x) => ({ ...x, winner: x.winner ?? 0, kos: x.kos || [3, 0], visible_at: at4(add(today, -3)) })) });
        // 見せてよい時刻より前の結果は、サーバが返さない
        return json({ tour: t, me: true, entries: groupEntries, matches: groupMatches.map((x) => (Date.parse(x.visible_at) <= Date.now() ? x : { ...x, winner: null, kos: null, decided: null, live: null })) });
      }
      return json(null);
    });
    await page.addInitScript((k) => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_card_deck_owner_key_v1', JSON.stringify(k));
    }, KEY);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardTournament === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
    // 大会の画面だけを、ゲームの上に重ねて描く。onCredit に渡った物は window.__credit へ
    const mount = async () => page.evaluate(() => {
      document.getElementById('__tour')?.remove();
      const div = document.createElement('div');
      div.id = '__tour';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      window.__credit = null;
      window.__root = ReactDOM.createRoot(div);
      window.__root.render(React.createElement(CardTournament, { onBack: () => {}, onOpenRegister: () => {}, knownAssistants: new Set(['kiki', 'dra']),
        onCredit: async (t, r) => { window.__credit = { id: t.id, ...r }; await storeSet('mh_card_tour_claimed_v1', [{ id: t.id, ...r, at: Date.now() }]); return true; } }));
    });
    const T = (sel) => page.locator(`#__tour ${sel}`);
    const text = async () => (await page.locator('#__tour').innerText()).replace(/\s+/g, ' ');

    // ① 受付中
    await mount();
    await T('[data-card-tour-enter]').waitFor({ timeout: 15000 });
    let s = await text();
    check('① 受付中: 大会の名前・受付の日程・登録したデッキ・いまの人数が出る', /検査杯\(受付\)/.test(s) && /エントリー受付中/.test(s) && /受付:/.test(s) && /検査デッキ/.test(s) && /いまのエントリー: 3人/.test(s), s.slice(0, 200));
    await shot(page, '1-受付');
    await T('[data-card-tour-enter]').click();
    await T('[data-card-tour-entered]').waitFor({ timeout: 10000 });
    const enter = calls.find((c) => c.fn === 'card_tournament_enter');
    check('① エントリーは、大会・自分の番号・持ち主の鍵で頼む', enter && enter.body.p_tour === 'cup-entry' && enter.body.p_key === KEY && typeof enter.body.p_owner === 'string' && enter.body.p_owner.length > 0, JSON.stringify(enter && enter.body));
    check('① エントリーしたら「エントリーしています」と取り消しのボタン', (await T('[data-card-tour-withdraw]').count()) === 1 && (await T('[data-card-tour-enter]').count()) === 0);
    await T('[data-card-tour-withdraw]').click();
    await T('[data-card-tour-enter]').waitFor({ timeout: 10000 });
    check('① 取り消すと、エントリーのボタンに戻る', calls.some((c) => c.fn === 'card_tournament_withdraw'));

    // ② 総当たりの最中
    tours = [tourGroup];
    await mount();
    await T('[data-card-tour-grid="group-0"]').waitFor({ timeout: 15000 });
    s = await text();
    const cells = await T('[data-card-tour-grid="group-0"] tbody tr').first().locator('td').allInnerTexts();
    check('② 対戦表: 自分の行に、発表ずみの勝ち(○)と、まだの試合の日付', cells[2] === '○' && /\d+\/\d+/.test(cells[3]), JSON.stringify(cells));
    check('② いまの順位が出る(自分は1勝0敗)', /いまの順位/.test(s) && /あなた\(1勝0敗\)/.test(s), s.slice(0, 300));
    check('④ まだ会っていない助手(ソラシド)は名前を出さず「助手」', !/ソラシド/.test(s) && /\? 助手 /.test(s) && !/助手\(助手\)/.test(s));
    await shot(page, '2-対戦表');
    // ③ 試合
    await T('[data-card-tour-tab="today"]').click();
    await T('[data-card-tour-today]').waitFor({ timeout: 10000 });
    s = await text();
    check('③ 発表ずみの日: 勝ち負けと実況(担当の助手の名前)', /WIN/.test(s) && /LOSE/.test(s) && /検査の実況です/.test(s) && /実況\(キキ\)|実況\(/.test(s), s.slice(0, 300));
    check('③ 次の日の試合は「4:00 に出ます」で、結果を出さない', /4:00 に出ます/.test(s));
    check('③ 見返しは準備中(PR4 まで押せない)', (await T('[data-card-tour-replay]').first().isDisabled()) && /見返す\(準備中\)/.test(s));
    await T('[data-card-tour-review]').first().click();
    check('③ 「解説を読む」で解説が出る', /検査の解説です/.test(await text()));
    await shot(page, '3-試合');

    // ⑤ 終わった大会
    tours = [tourDone];
    await mount();
    // 終わった大会は、まず対戦表で「大会結果」の演出(空の表 → ○×が押される → 上位3人に印)
    await T('[data-card-tour-revealing="1"]').waitFor({ timeout: 15000 });
    const emptyAtStart = await T('[data-card-tour-grid] tbody').innerText();
    check('⑤ 演出: はじめは「大会結果」の帯と、○×の無い表', /大会結果/.test(await text()) && !/[○×]/.test(emptyAtStart), emptyAtStart.replace(/\s+/g, ' ').slice(0, 120));
    await shot(page, '4a-演出の途中');
    await T('[data-card-tour-reveal-replay]').waitFor({ timeout: 15000 });
    const places = await T('[data-card-tour-place]').allInnerTexts();
    check('⑤ 演出のあと: ○×が全部入り、上位3人の行に 1位・2位・3位 の印', J(places) === J(['1位', '2位', '3位']) && (await T('[data-card-tour-grid] [data-card-tour-row-glow="1"]').count()) === 1, J(places));
    await shot(page, '4b-演出のあと');
    await T('[data-card-tour-reveal-replay]').click();
    await T('[data-card-tour-revealing="1"]').waitFor({ timeout: 5000 });
    await T('[data-card-tour-reveal-skip]').click();
    check('⑤ 「演出リプレイ」でもう一度流れ、タップで飛ばせる', (await T('[data-card-tour-revealing="1"]').count()) === 0 && (await T('[data-card-tour-place]').count()) === 3);
    await T('[data-card-tour-tab="result"]').click();
    await T('[data-card-tour-result]').waitFor({ timeout: 15000 });
    s = await text();
    check('⑤ 最終順位と、あなたのごほうび(1位・3勝: 3000+300・ビートPだけで、表に称号があっても出さない)', /最終順位/.test(s) && /1位/.test(s) && /ビートP 3,300/.test(s) && !/称号|検査杯 優勝|プロフィール枠/.test(s), s.slice(0, 300));
    await shot(page, '4-結果');
    await T('[data-card-tour-claim]').click();
    await page.waitForFunction(() => window.__credit !== null, null, { timeout: 10000 });
    const credit = await page.evaluate(() => window.__credit);
    await page.waitForTimeout(300);
    s = await text();
    check('⑤ 受け取ると、サーバの答えのビートPが onCredit に渡り「受け取りました」', credit && credit.id === 'cup-done' && credit.point === 3300 && /受け取りました/.test(s), JSON.stringify(credit));

    // ⑥ 表が無い
    tablesOff = true;
    await page.evaluate(() => { try { _cardTourUnavailable = false; } catch (_) {} });
    await mount();
    await page.locator('#__tour').getByText('大会は準備中です').waitFor({ timeout: 15000 });
    check('⑥ 表が無いときは「大会は準備中です」', true);
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: 大会の画面');
})();
