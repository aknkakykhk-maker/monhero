// MFバトルカード 個人杯のリアルタイム杯: 来ない相手の登録デッキと戦う試合を、対戦えらびから最後まで通す(2026-10-31 ブレイブくん・④ 区切り3a)
//
//   node tools/card/card-cup-live-play-browser-check.js
//
//   MFバトルカードの画面(CardBattleScreen・デバッグの形)をゲームの上に重ねて描き、サーバは偽物の答えにする(本物へは何も送らない)
//   ① 対戦えらび →「個人杯」→ 開催中の杯 → 自分の次の試合(相手は来ていない)→「試合へ」
//   ② 試合の材料を鍵つきで読み、相手の名前の対戦になる(種・先攻は杯の試合のもの)
//   ③ 投了すると、杯へ結果を送る: how=absent・負けた側 = 相手の側・確かめなし・手の並び(自分が b 側なので { order: 'ba', acts })・倒した数は a・b の順
//      ごほうび(ビートP)は増えない。杯の画面へ戻り「結果を杯に送りました」
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8964;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
const KEY = 'c'.repeat(48);
const J = (v) => JSON.stringify(v);
const state = { decks: null };
const calls = [];
const iso = (ms) => new Date(ms).toISOString();
// 偽物のサーバ: 開催中のトーナメント(自分は席1 = b 側・相手の席0 けろすけは来ていない)
const route = (r) => {
  const url = r.request().url();
  const m = url.match(/rpc\/(card_[a-z_]+)/);
  const json = (v) => r.fulfill({ status: 200, contentType: 'application/json', body: J(v) });
  if (!m) {
    if (url.includes('card_deck_entries') && state.decks) return json([{ owner_id: 'me', user_name: '検査ブリーダー', deck: state.decks.me, tactics: { habit: 'mua' }, version: 1, active: true }]);
    return r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' });
  }
  const fn = m[1];
  let body = {};
  try { body = JSON.parse(r.request().postData() || '{}'); } catch (_) { body = {}; }
  calls.push({ fn, body });
  const now = Date.now();
  if (fn === 'card_cup_list' || fn === 'card_cup_mine') return json(fn === 'card_cup_mine' ? [{ id: 'clive', name: '土曜のリアルタイム杯', host_id: 'p0', host_name: 'けろすけ', host_icon: null, mode: 'live', format: 'ko', max: 4, listed: true, status: 'running', entry_until: iso(now - 600000), start_at: iso(now - 600000), closed_reason: null, done_at: null, players: 2 }] : []);
  if (fn === 'card_cup_view') return json({ cup: { id: 'clive', name: '土曜のリアルタイム杯', host_id: 'p0', host_name: 'けろすけ', host_icon: null, mode: 'live', format: 'ko', max: 4, listed: true, status: 'running',
      entry_until: iso(now - 600000), start_at: iso(now - 600000), closed_reason: null, done_at: null, players: 2, code: '135790', bracket: { rounds: [[[0, 1]]] } }, me: true,
    entries: [{ owner_id: 'p0', mine: false, user_name: 'けろすけ', icon: null, monsters: state.decks.foe.monsters, seat: 0, checkin: false, place: null, wins: null },
      { owner_id: body.p_owner || 'ME', mine: true, user_name: '検査ブリーダー', icon: null, monsters: state.decks.me.monsters, seat: 1, checkin: true, place: null, wins: null }],
    matches: [{ id: 41, round: 0, slot: 0, a: 0, b: 1, winner: null, kos: null, decided: null, live: { room: 'ABCDEFGH', ready_at: iso(now - 60000) } }] });
  if (fn === 'card_cup_live_match') return json({ id: 41, cup_id: 'clive', round: 0, slot: 0, a: 0, b: 1, seed: 424242, first: 0, winner: null, decided: null, side: 1, room: 'ABCDEFGH',
    ready_at: iso(now - 60000), join_a: null, join_b: iso(now), dispute: false, checkin_a: false, checkin_b: true,
    a_side: { name: 'けろすけ', icon: null, deck: state.decks.foe, tactics: { habit: 'kiki', name: 'けろデッキ' } }, b_side: { name: '検査ブリーダー', icon: null, deck: state.decks.me, tactics: { habit: 'mua' } } });
  if (fn === 'card_cup_live_report') return json('ok');
  if (fn === 'card_cup_live_settle') return json(0);
  return json(null);
};

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていない'); return; } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, (r) => route(r));
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mh_breeder_name')) return;
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(quietBootSeed());
    await ctx.addInitScript((k) => { localStorage.setItem('mh_card_deck_owner_key_v1', JSON.stringify(k)); }, KEY);
    const open = async () => {
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      const sleep = (ms) => page.waitForTimeout(ms);
      const dismiss = async () => {
        for (let i = 0; i < 8; i++) {
          const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
          if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
          await b.dispatchEvent('click').catch(() => {}); await sleep(250);
        }
      };
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      const home = page.locator('[data-home-card-battle]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
      await home.click();
      await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
      await sleep(600); await dismiss();
      if (await page.locator('[data-card-top="starter"]').count()) {
        await page.locator('[data-card-kit="speed"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
        await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
        await page.getByRole('button', { name: /トップへ/ }).first().click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
      }
      return { page, sleep, dismiss };
    };
    const A = await open();
    const page = A.page, sleep = A.sleep;
    page.on('pageerror', (e) => errors.push(String(e)));
    // 相手の写し(登録デッキ)と自分の写しを、ゲームの中で作る
    const decks = await page.evaluate(() => ({ foe: cardAiBuildDeck(CARD_BATTLE_DATA, 'kiki', 'normal', cardAiSeededRand('cup-foe')), me: cardAiBuildDeck(CARD_BATTLE_DATA, 'mua', 'normal', cardAiSeededRand('cup-me')) }));
    state.decks = decks;
    const point0 = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')) || 0);
    // MFバトルカードの画面を、デバッグの形で重ねて描く(個人杯の入口はデバッグか公開の印のときだけ出る)
    await page.evaluate(() => {
      document.getElementById('__cb')?.remove();
      const div = document.createElement('div');
      div.id = '__cb';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      const Wrap = () => { const [screen, setScreen] = React.useState('CARD_TOP'); window.__cbScreen = screen; return React.createElement(CardBattleScreen, { screen, onNavigate: setScreen, onExit: () => {}, debug: true, onBgm: () => {} }); };
      window.__cbRoot = ReactDOM.createRoot(div);
      window.__cbRoot.render(React.createElement(Wrap));
    });
    const T = (sel) => page.locator(`#__cb ${sel}`);
    await T('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await T('[data-card-cpu]').click();
    await T('[data-card-mode-cup]').click();
    await T('[data-card-cup-tab="mine"]').click();
    await T('[data-card-cup-row="clive"]').click();
    await T('[data-card-cup-live-play]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const playBtn = T('[data-card-cup-live-play]');
    check('① 対戦えらび →「個人杯」→ 開催中の杯で、来ていない相手との次の試合の「試合へ」が押せる', await playBtn.isEnabled() && /試合へ/.test(await playBtn.innerText()));
    await playBtn.click();
    // 対戦開始の画面 → 対戦の画面
    for (let i = 0; i < 30 && !(await T('[data-card-quit]').count()); i++) { await page.locator('#__cb').click({ position: { x: 195, y: 420 } }).catch(() => {}); await sleep(400); }
    const mcall = calls.find((c) => c.fn === 'card_cup_live_match');
    const text = (await page.locator('#__cb').innerText()).replace(/\s+/g, ' ');
    check('② 試合の材料を鍵つきで読み、相手(けろすけ)の対戦になる', !!mcall && mcall.body.p_match === 41 && mcall.body.p_key === KEY && /けろすけ/.test(text) && await T('[data-card-quit]').count() > 0, text.slice(0, 160));
    await T('[data-card-quit]').click();
    await page.getByRole('button', { name: '投了する' }).click();
    for (let i = 0; i < 40 && !calls.some((c) => c.fn === 'card_cup_live_report'); i++) await sleep(250);
    const rep = calls.find((c) => c.fn === 'card_cup_live_report');
    const acts = rep && rep.body.p_acts;
    check('③ 杯へ結果: absent・負けたので勝ちは相手の側(a = 0)・確かめなし・ルールの版', !!rep && rep.body.p_how === 'absent' && rep.body.p_winner === 0 && rep.body.p_verified === false && rep.body.p_match === 41 && Number.isInteger(rep.body.p_rules), JSON.stringify(rep && { ...rep.body, p_acts: undefined, p_key: undefined }));
    // 1手も指さずに投了したときは手の並びが無い(null)。手があれば、自分が b 側なので { order: 'ba', acts }
    check('③ 自分が b 側: 手の並びは無い(1手も指していない)か { order: "ba", acts }・倒した数は a・b の順(2つ)', (acts === null || (acts.order === 'ba' && Array.isArray(acts.acts))) && Array.isArray(rep.body.p_kos) && rep.body.p_kos.length === 2, JSON.stringify(acts).slice(0, 60));
    await T('[data-card-cup-detail]').waitFor({ timeout: 15000 });
    const text2 = (await page.locator('#__cb').innerText()).replace(/\s+/g, ' ');
    const point1 = await page.evaluate(() => Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')) || 0);
    check('③ 杯の画面へ戻り「結果を杯に送りました」・ビートPは増えない', /結果を杯に送りました/.test(text2) && point1 === point0, `${point0}→${point1}`);
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, e.message.slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
