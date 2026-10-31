#!/usr/bin/env node
// MFバトルカード 個人杯の画面(99-card-cup.jsx)を、偽物の表の答えで実際のブラウザに描いて確かめる(2026-10-31 ルールくん・個人杯の3本目)
//
//   node tools/card/card-cup-screen-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、画面ごとの写真を残す
//
//   ゲームを開いたあと、個人杯の画面(CardCup)だけを、ゲームの上に重ねて描く(本物の Supabase には行かない)
//   ① 公開の一覧: 杯の名前・遊び方・形式・人数が出る。悪い言葉は「●」に置き換わる
//   ② 参加: 登録デッキがあれば「このデッキで参加」→ 入る関数に鍵つきで頼む → 合言葉が出る
//   ③ デッキ登録が無い: 「参加にはデッキ登録が必要です」と理由・デッキ登録へ進むボタン
//   ④ 開く: 名前・遊び方・形式・人数・時刻を選んで開く関数に頼む → 開いた杯の画面へ
//   ⑤ 結果(トーナメント): 山の表に全員・勝ち上がりの線が光って優勝カップへ・演出リプレイ・試合の一覧と「見返す」
//   ⑥ 結果(総当たり): 公式杯と同じ対戦表と「大会結果」の演出・順位
//   ⑦ 合言葉で探す・表が無いときは「準備中」・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8962;
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

const KEY = 'b'.repeat(48);
const MONS = ['C-001', 'C-002', 'C-003'];
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const row = (o) => ({ id: 'c1', name: '金曜の夜カップ', host_id: 'host', host_name: 'ねこまる', host_icon: null, mode: 'auto', format: 'ko', max: 8, listed: true, status: 'entry',
  entry_until: iso(now + 3 * 3600000), start_at: iso(now + 5 * 3600000), closed_reason: null, done_at: null, players: 3, ...o });
const ent = (i, o = {}) => ({ owner_id: `p${i}`, mine: false, user_name: ['ねこまる', 'ハム次郎', 'もちお', 'ゆうき', 'こんた', 'けろすけ', 'ぺんた', 'たまご'][i], icon: null, monsters: MONS, seat: i, checkin: false, place: null, wins: null, ...o });
// 8人のトーナメント(席0が優勝)。1回戦の並びは [0,7] [3,4] [1,6] [2,5]
const ko = { rounds: [[[0, 7], [3, 4], [1, 6], [2, 5]], [[0, 3], [1, 2]], [[0, 1]]] };
const koMatches = [
  ...ko.rounds[0].map((_, k) => ({ id: 100 + k, round: 0, slot: k, a: ko.rounds[0][k][0], b: ko.rounds[0][k][1], winner: 0, kos: [3, 1], decided: 'ko', live: null })),
  ...ko.rounds[1].map((_, k) => ({ id: 110 + k, round: 1, slot: k, a: ko.rounds[1][k][0], b: ko.rounds[1][k][1], winner: 0, kos: [3, 2], decided: 'ko', live: null })),
  { id: 120, round: 2, slot: 0, a: 0, b: 1, winner: 0, kos: [3, 2], decided: 'ko', live: { who: 'kiki', play: '決勝の実況', review: '' } },
];
const koPlaces = [1, 2, 3, 3, 5, 5, 5, 5];
const rrMatches = [[0, 1, 0], [2, 3, 1], [0, 2, 0], [1, 3, 0], [0, 3, 0], [1, 2, 1]].map(([a, b, w], i) => ({ id: 200 + i, round: Math.floor(i / 2), slot: i, a, b, winner: w, kos: [3, 1], decided: 'ko', live: null }));

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
    let hasDeck = true, tablesOff = false, joined = false, ng = '';
    await page.route(/supabase\.co/, async (route) => {
      const url = route.request().url();
      const m = url.match(/rpc\/(card_cup_[a-z]+)/);
      if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('card_deck_entries') && hasDeck ? J([{ owner_id: 'me', user_name: '検査ブリーダー', deck: { monsters: MONS, cards: Array(50).fill('001') }, tactics: { habit: 'kiki', name: '検査デッキ' }, version: 1, active: true, battles: 0, deck_wins: 0, rents: 0, updated_at: iso(now) }]) : '[]' });
      if (tablesOff) return route.fulfill({ status: 404, contentType: 'application/json', body: '{"code":"PGRST202","message":"Could not find the function"}' });
      const body = JSON.parse(route.request().postData() || '{}');
      calls.push({ fn: m[1], body });
      const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: J(v) });
      const fn = m[1];
      if (fn === 'card_cup_list') return json([row({ name: `${ng}カップ` }), row({ id: 'c2', name: 'のんびり杯', mode: 'live', format: 'rr', max: 6, players: 5, host_name: 'もちお' })]);
      if (fn === 'card_cup_mine') return json([row({ id: 'cko', name: '終わったトーナメント', status: 'done', start_at: iso(now - 3600000), players: 8 }), row({ id: 'crr', name: '終わった総当たり', format: 'rr', status: 'done', start_at: iso(now - 3600000), players: 4 })]);
      if (fn === 'card_cup_find') return json(body.p_code === '482951' ? row({ id: 'c1' }) : null);
      if (fn === 'card_cup_join') { joined = true; return json('ok'); }
      if (fn === 'card_cup_create') return json({ status: 'ok', id: 'cnew', code: '123456' });
      if (fn === 'card_cup_view') {
        if (body.p_cup === 'cko') return json({ cup: { ...row({ id: 'cko', name: '終わったトーナメント', status: 'done', start_at: iso(now - 3600000), players: 8 }), code: '111111', bracket: ko }, me: true,
          entries: Array.from({ length: 8 }, (_, i) => ent(i, { mine: i === 0, place: koPlaces[i], wins: [3, 2, 1, 1, 0, 0, 0, 0][i] })), matches: koMatches });
        if (body.p_cup === 'crr') return json({ cup: { ...row({ id: 'crr', name: '終わった総当たり', format: 'rr', status: 'done', start_at: iso(now - 3600000), players: 4 }), code: '222222', bracket: null }, me: true,
          entries: Array.from({ length: 4 }, (_, i) => ent(i, { mine: i === 0, place: [1, 2, 3, 4][i], wins: [3, 2, 1, 0][i] })), matches: rrMatches });
        if (body.p_cup === 'cnew') return json({ cup: { ...row({ id: 'cnew', name: '検査カップ', host_id: 'ME' }), code: '123456', bracket: null }, me: true, entries: [ent(0, { owner_id: 'ME', mine: true, user_name: '検査ブリーダー', seat: null })], matches: [] });
        return json({ cup: { ...row({ id: body.p_cup }), code: joined ? '482951' : null, bracket: null }, me: joined, entries: [ent(1, { seat: null }), ent(2, { seat: null }), ...(joined ? [ent(0, { owner_id: 'ME', mine: true, user_name: '検査ブリーダー', seat: null })] : [])], matches: [] });
      }
      return json(null);
    });
    await page.addInitScript((k) => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_card_deck_owner_key_v1', JSON.stringify(k));
    }, KEY);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardCup === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
    ng = await page.evaluate(() => (typeof CARD_CHAT_NG !== 'undefined' && CARD_CHAT_NG[0]) || '');
    const mount = async () => page.evaluate(() => {
      document.getElementById('__cup')?.remove();
      const div = document.createElement('div');
      div.id = '__cup';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      window.__reg = 0;
      window.__replay = null;
      window.__root = ReactDOM.createRoot(div);
      window.__root.render(React.createElement(CardCup, { onBack: () => {}, onOpenRegister: () => { window.__reg += 1; }, onOpenReplay: async (id, title) => { window.__replay = { id, title }; return true; } }));
    });
    const T = (sel) => page.locator(`#__cup ${sel}`);
    const text = async () => (await page.locator('#__cup').innerText()).replace(/\s+/g, ' ');

    // ① 公開の一覧
    await mount();
    await T('[data-card-cup-row="c2"]').waitFor({ timeout: 15000 });
    let s = await text();
    check('① 一覧: 名前・遊び方・形式・人数・主催が出る', /のんびり杯/.test(s) && /リアルタイム・総当たり・5\/6人・主催 もちお/.test(s) && /オート・トーナメント・3\/8人/.test(s), s.slice(0, 200));
    check('① 悪い言葉は「●」に置き換わる', !!ng && !s.includes(ng) && /●+カップ/.test(s), ng);
    await shot(page, '1-一覧');
    // ② 参加
    await T('[data-card-cup-row="c2"]').click();
    await T('[data-card-cup-join-go]').waitFor({ timeout: 15000 });
    s = await text();
    check('② 登録デッキがあれば、そのデッキと「来られないときは代わりに自動で戦う」', /検査デッキ/.test(s) && /代わりに自動で戦います/.test(s));
    await shot(page, '2-参加');
    await T('[data-card-cup-join-go]').click();
    await T('[data-card-cup-code]').waitFor({ timeout: 10000 });
    const join = calls.find((c) => c.fn === 'card_cup_join');
    check('② 入る関数に、杯・自分の番号・鍵・名前で頼む → 合言葉が出る', join && join.body.p_key === KEY && join.body.p_cup === 'c2' && typeof join.body.p_owner === 'string' && join.body.p_name === '検査ブリーダー' && /482951/.test(await text()), J(join && join.body));
    // ③ デッキ登録が無い
    hasDeck = false; joined = false;
    await mount();
    await T('[data-card-cup-row="c2"]').click();
    await T('[data-card-cup-join-nodeck]').waitFor({ timeout: 15000 });
    s = await text();
    check('③ 登録が無ければ「参加にはデッキ登録が必要です」と理由', /参加にはデッキ登録が必要です/.test(s) && /来られないときは、登録したデッキが代わりに自動で戦います/.test(s) && (await T('[data-card-cup-join-go]').count()) === 0);
    await T('[data-card-cup-register]').click();
    check('③ 「デッキを登録する」でデッキ登録へ進む', (await page.evaluate(() => window.__reg)) === 1);
    await shot(page, '3-登録が無い');
    hasDeck = true;
    // ④ 開く
    await mount();
    await T('[data-card-cup-tab="create"]').waitFor({ timeout: 15000 });
    await T('[data-card-cup-tab="create"]').click();
    await T('[data-card-cup-create-go]').waitFor({ timeout: 10000 });
    await T('[data-card-cup-name]').fill('検査カップ');
    await T('[data-card-cup-opt="format-rr"]').click();
    await T('[data-card-cup-opt="max-6"]').click();
    await shot(page, '4-開く');
    await T('[data-card-cup-create-go]').click();
    await T('[data-card-cup-detail="cnew"]').waitFor({ timeout: 10000 });
    const cr = calls.find((c) => c.fn === 'card_cup_create');
    const ok4 = cr && cr.body.p_name === '検査カップ' && cr.body.p_mode === 'auto' && cr.body.p_format === 'rr' && cr.body.p_max === 6 && cr.body.p_listed === true && cr.body.p_key === KEY
      && new Date(cr.body.p_start_at).getUTCMinutes() === 0 && Date.parse(cr.body.p_start_at) >= Date.parse(cr.body.p_entry_until) + 3600000 && Date.parse(cr.body.p_entry_until) >= now + 600000;
    check('④ 開く関数に、名前・オート・総当たり・6人・公開・ちょうどの時の時刻で頼む → 開いた杯へ', ok4, J(cr && cr.body));
    check('④ 開いた杯に合言葉が出る', /123456/.test(await text()));
    // ⑤ トーナメントの結果
    await mount();
    await T('[data-card-cup-tab="mine"]').click();
    await T('[data-card-cup-row="cko"]').click();
    await T('[data-card-cup-bracket]').waitFor({ timeout: 15000 });
    const lit0 = await T('[data-card-cup-bracket]').getAttribute('data-card-cup-lit');
    await shot(page, '5a-山の途中');
    await page.waitForFunction(() => document.querySelector('#__cup [data-card-cup-bracket]')?.getAttribute('data-card-cup-lit') === '3', null, { timeout: 10000 });
    s = await text();
    check('⑤ 山の表: 全員の名前・はじめは線が光っていない → 3回戦ぶん光って優勝カップに優勝者', lit0 === '0' && ['ハム次郎', 'もちお', 'ぺんた', 'たまご'].every((n) => s.includes(n)) && (await T('[data-card-cup-champ]').innerText()) === 'あなた', `${lit0} ${s.slice(0, 160)}`);
    check('⑤ 順位(1位 あなた・2位 ハム次郎)・ごほうびなし', /1位 あなた\(3勝\)/.test(s) && /2位 ハム次郎/.test(s) && /ごほうびはありません/.test(s));
    await shot(page, '5b-山のあと');
    const rows = await T('[data-card-cup-match]').count();
    check('⑤ 試合の一覧(7試合)・いちばん上は決勝', rows === 7 && /決勝/.test(await T('[data-card-cup-match]').first().innerText()), `${rows}`);
    await T('[data-card-cup-replay="120"]').click();
    check('⑤ 「見返す」でその試合の見返しを開く(番号と杯の名前を渡す)', J(await page.evaluate(() => window.__replay)) === J({ id: 120, title: '終わったトーナメント' }), J(await page.evaluate(() => window.__replay)));
    await T('[data-card-cup-bracket-replay]').click();
    check('⑤ 演出リプレイで、もう一度はじめから', (await T('[data-card-cup-bracket]').getAttribute('data-card-cup-lit')) === '0');
    // ⑥ 総当たりの結果
    await mount();
    await T('[data-card-cup-tab="mine"]').click();
    await T('[data-card-cup-row="crr"]').click();
    await T('[data-card-tour-revealing="1"]').waitFor({ timeout: 15000 });
    await T('[data-card-tour-reveal-replay]').waitFor({ timeout: 15000 });
    const places = await T('[data-card-tour-place]').allInnerTexts();
    check('⑥ 総当たり: 公式杯と同じ対戦表と「大会結果」の演出のあと、上位3人に印', J(places) === J(['1位', '2位', '3位']), J(places));
    await shot(page, '6-総当たり');
    // ⑦ 合言葉で探す・準備中
    await mount();
    await T('[data-card-cup-tab="code"]').click();
    await T('[data-card-cup-code-input]').fill('482951');
    await T('[data-card-cup-find-go]').click();
    await T('[data-card-cup-detail="c1"]').waitFor({ timeout: 10000 });
    check('⑦ 合言葉で探すと、その杯が開く', true);
    tablesOff = true;
    await page.evaluate(() => { try { _cardTourUnavailable = false; } catch (_) {} });
    await mount();
    await page.locator('#__cup').getByText('個人杯は準備中です').waitFor({ timeout: 15000 });
    check('⑦ 表が無いときは「個人杯は準備中です」', true);
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: 個人杯の画面');
})();
