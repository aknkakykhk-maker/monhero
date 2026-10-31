#!/usr/bin/env node
// MFバトルカード 個人杯のリアルタイム杯の画面(99-card-cup-live.jsx の CardCupLivePanel)を、偽物の表の答えで実際のブラウザに描いて確かめる
// (2026-10-31 ブレイブくん・個人杯の④ 区切り2)。作りは card-cup-screen-browser-check.js と同じ(杯の画面だけをゲームの上に重ねて描く)
//
//   node tools/card/card-cup-live-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、画面ごとの写真を残す
//
//   ① 始まる前: 時刻・集合の人数・来られない人の説明 / 「集合する」→ 集合の関数に鍵つきで頼む → 「集合しました」
//   ② 10分前より前は集合できない(時刻が出る)
//   ③ 主催で全員そろえば「全員そろったので始める」
//   ④ 時刻を過ぎて始まっていなければ、開いた端末が始める関数を呼ぶ
//   ⑤ 開催中: 自分の次の試合・相手が来ているか・来ていなければ登録デッキと戦う説明・山の表(試合の画面は区切り3なので「試合へ」はまだ押せない)
//   ⑥ 前の回戦待ち・トーナメントで負けたあと / ⑦ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8963;
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
const NAMES = ['ねこまる', 'ハム次郎', 'もちお', 'ゆうき', 'こんた'];

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
    // 偽物の杯の様子。st … 'entry'(始まる前)/ 'late'(時刻を過ぎて始まっていない)/ 'running'
    const S = { st: 'entry', start: now + 5 * 60000, host: false, allHere: false, meHere: false, ready: true, lost: false };
    let hasDeck = true;
    await page.route(/supabase\.co/, async (route) => {
      const url = route.request().url();
      const m = url.match(/rpc\/(card_cup_[a-z_]+)/);
      if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('card_deck_entries') && hasDeck ? J([{ owner_id: 'me', user_name: '検査ブリーダー', deck: { monsters: MONS, cards: Array(50).fill('001') }, tactics: { habit: 'kiki', name: '検査デッキ' }, version: 1, active: true, battles: 0, deck_wins: 0, rents: 0, updated_at: iso(now) }]) : '[]' });
      const body = JSON.parse(route.request().postData() || '{}');
      calls.push({ fn: m[1], body });
      const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: J(v) });
      const fn = m[1];
      if (fn === 'card_cup_list') return json([]);
      if (fn === 'card_cup_mine') return json([]);
      if (fn === 'card_cup_live_checkin') { S.meHere = true; return json('ok'); }
      if (fn === 'card_cup_live_start') { if (S.st === 'late') S.st = 'running'; return json(S.host && S.allHere ? 'ok' : 'early'); }
      if (fn === 'card_cup_live_settle') return json(0);
      if (fn === 'card_cup_view') {
        const me = body.p_owner || 'ME';
        const running = S.st === 'running';
        const entries = NAMES.map((n, i) => ({ owner_id: i === 0 ? me : `p${i}`, mine: i === 0, user_name: n, icon: null, monsters: MONS,
          seat: running ? i : null, checkin: i === 0 ? S.meHere : (S.allHere || i === 2), place: null, wins: null }));
        // 5人のトーナメント: 1回戦 [0,1]・[2,null]・[3,null]・[4,null] → 2回戦 [0or1, 2]・[3, 4]
        const bracket = running ? { rounds: [[[0, 1], [2, null], [3, null], [4, null]], ...(S.lost || !S.ready ? [] : [])] } : null;
        const matches = running ? [{ id: 11, round: 0, slot: 0, a: 0, b: 1, winner: S.lost ? 1 : null, kos: null, decided: null, live: { room: 'ABCDEFGH', ready_at: S.ready ? iso(now) : null } }] : [];
        return json({ cup: { id: 'clive', name: '土曜のリアルタイム杯', host_id: S.host ? me : 'p9', host_name: 'ねこまる', host_icon: null, mode: 'live', format: 'ko', max: 8, listed: true,
          status: S.st === 'late' ? 'entry' : S.st, entry_until: iso(S.start), start_at: iso(S.start), closed_reason: null, done_at: null, players: 5, code: '135790', bracket },
          me: true, entries, matches });
      }
      return json(null);
    });
    await page.addInitScript((k) => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_card_deck_owner_key_v1', JSON.stringify(k));
    }, KEY);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardCup === 'function' && typeof CardCupLivePanel === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
    const mount = async () => page.evaluate(() => {
      document.getElementById('__cup')?.remove();
      const div = document.createElement('div');
      div.id = '__cup';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      window.__root = ReactDOM.createRoot(div);
      window.__root.render(React.createElement(CardCup, { onBack: () => {}, onOpenRegister: () => {}, initialCup: 'clive' }));
    });
    const T = (sel) => page.locator(`#__cup ${sel}`);
    const text = async () => (await page.locator('#__cup').innerText()).replace(/\s+/g, ' ');

    // ① 始まる前・集合していない → 集合する
    await mount();
    // 自分の番号が読めたところで杯の様子を読み直すので、読み直しが終わってから見る
    await page.waitForFunction(() => /集合 \d+\/5人/.test(document.getElementById('__cup')?.innerText || ''), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await T('[data-card-cup-live-here]').waitFor({ timeout: 15000 });
    let s = await text();
    check('① 始まる前: 時刻・集合の人数・「来られない人は登録デッキが代わりに戦う」', /に始まります/.test(s) && /集合 1\/5人/.test(s) && /登録デッキが代わりに自動で戦います/.test(s), s.slice(0, 200));
    check('① 10分前を過ぎていれば「集合する」が押せる', await T('[data-card-cup-live-checkin]').isEnabled());
    await shot(page, '1-集合');
    await T('[data-card-cup-live-checkin]').click();
    await T('[data-card-cup-live-checked]').waitFor({ timeout: 10000 });
    const ck = calls.find((c) => c.fn === 'card_cup_live_checkin');
    check('① 集合の関数に、杯・自分の番号・鍵で頼む → 「集合しました」', ck && ck.body.p_cup === 'clive' && ck.body.p_key === KEY && typeof ck.body.p_owner === 'string');
    // ② 早すぎる集合は押せない
    S.start = now + 30 * 60000; S.meHere = false;
    await mount();
    await T('[data-card-cup-live-checkin]').waitFor({ timeout: 15000 });
    check('② 10分前より前は、集合のボタンは押せず時刻が出る', !(await T('[data-card-cup-live-checkin]').isEnabled()) && /集合は .* から/.test(await T('[data-card-cup-live-checkin]').innerText()));
    // ③ 主催・全員そろった → 早めに始める
    S.start = now + 5 * 60000; S.host = true; S.allHere = true; S.meHere = true;
    await mount();
    await T('[data-card-cup-live-start]').waitFor({ timeout: 15000 });
    await T('[data-card-cup-live-start]').click();
    await page.waitForTimeout(800);
    check('③ 主催で全員そろえば「全員そろったので始める」→ 始める関数', calls.some((c) => c.fn === 'card_cup_live_start'));
    // ④ 時刻を過ぎて始まっていない → 開いた端末が自分で始める
    S.host = false; S.allHere = false; S.st = 'late'; S.start = now - 60000;
    const before = calls.filter((c) => c.fn === 'card_cup_live_start').length;
    await mount();
    await page.waitForFunction((n) => true, before);
    await page.waitForTimeout(1500);
    check('④ 時刻を過ぎたら、開いた端末が始める関数を呼ぶ', calls.filter((c) => c.fn === 'card_cup_live_start').length > before);
    // ⑤ 開催中: 自分の次の試合(相手が来ていない)
    S.st = 'running'; S.ready = true;
    await mount();
    await T('[data-card-cup-live-next]').waitFor({ timeout: 15000 });
    s = await text();
    check('⑤ 開催中: 次の試合・相手の名前・「来ていません」・相手の登録デッキと戦う', /あなたの次の試合: 準決勝|あなたの次の試合: 1回戦/.test(s) && /相手: ハム次郎/.test(s) && /来ていません/.test(s) && /相手の登録デッキと戦います/.test(s), s.slice(0, 260));
    check('⑤ 試合の画面ができるまで「試合へ」は押せない', !(await T('[data-card-cup-live-play]').isEnabled()));
    check('⑤ 開催中の山の表が出る', await T('[data-card-cup-bracket]').count() === 1);
    await shot(page, '5-開催中');
    // ⑥ 前の回戦待ち・負けたあと
    S.ready = false;
    await mount();
    await T('[data-card-cup-live-play]').waitFor({ timeout: 15000 });
    check('⑥ 戦える回戦でないときは「前の回戦が終わるのを待っています」', /前の回戦が終わるのを待っています/.test(await T('[data-card-cup-live-play]').innerText()));
    S.lost = true; S.ready = true;
    await mount();
    await T('[data-card-cup-live-out]').waitFor({ timeout: 15000 });
    check('⑥ トーナメントで負けたら「あなたの試合は終わりました」', true);
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: リアルタイム杯の画面');
})();
