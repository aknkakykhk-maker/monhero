// MFバトルカード: 対戦の盤面(84 CardBattleBoard)の「観戦の形」(game.watch)を、実際のブラウザで確かめる(2026-10-27・カード部ナガメ)。
//   観戦の画面を対戦の画面と同じ見た目にする(社長の決め)ための1本目。94 の観戦の画面からつなぐのは2本目
//
//   node tools/card/card-watch-board-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、390・320 の写真を残す
//
// ページの中で、2人の打ち手(コンピューター)が戦った試合の場を1手ずつ作り、観戦の形の盤面へ「当てたあとの場」として流す
//   ① 押せない: 手札の札(data-card-hand-card)が無く、下の人の手札は裏の札で枚数だけ。上の帯に投了のボタン(やめる)は無い(下の「観戦をやめる」だけ)
//   ② 名前で出す: 上の帯「ターン◯・◯◯の番」・番の知らせ・技の箱・大写し・倒れたときの帯に「あなた」「自分」「相手」が出ない
//   ③ 技の箱(data-card-action)・大写しが、対戦と同じ道で出る
//   ④ 途中から見る形(quiet)では、動きを出さずにその場へ飛ぶ
//   ⑤ 決着しても結果の画面へ進まない(onFinish を呼ばない)。WIN/LOSE ではなく、名前の決着の帯。届いた決着の言葉(投了など)を出す
//   ⑥ 「観戦をやめる」で onFinish({ outcome: 'watchExit' })
//   ⑦ 320×568・390×844 で、盤面が画面の横幅に収まる・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8957;
const SHOT = process.env.SHOT_DIR || '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); } }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, (r) => (r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardBattleBoard === 'function' && typeof CARD_BATTLE_DATA === 'object' && typeof ReactDOM === 'object', null, { timeout: 90000 });
    // 盤面を、ほかの画面の上に重ねて開く(観戦の形)。手は2人の打ち手で作り、window.__watch.push() で1手ずつ流す
    await page.evaluate(() => {
      const db = CARD_BATTLE_DATA;
      const kits = Object.keys(db.starters);
      const deck = (k) => ({ monsters: db.starters[k].monsters.slice(), cards: db.starters[k].cards.slice() });
      let st = cardCreateGame(db, { decks: [deck(kits[0]), deck(kits[1])], names: ['ビー', 'エー'], seed: 7, first: 0 });
      const pol = cardAiPolicy('kyuko', 'normal');
      let seed = 99; const rand = () => { const n = cardRngNext(seed); seed = n.s; return n.v; };
      const W = window.__watch = { handler: null, finished: [], states: [] };
      const next = () => {
        const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
        const act = cardAiChooseAction(db, st, pol, rand);
        const n = act && cardApplyAction(db, st, act);
        const fb = !n && (st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null);
        const n2 = n || (fb && cardApplyAction(db, st, fb));
        if (!n2) return null;
        st = n2; return { st, who };
      };
      W.push = (quiet) => { const r = next(); if (r && W.handler) W.handler.onState(r.st, !!quiet); return r ? { winner: r.st.winner, turn: r.st.turn } : null; };
      W.end = (e) => { if (W.handler) W.handler.onEnd(e); };
      const game = { key: 'watch-check', st, watch: { top: { name: 'エー', icon: '🦊' }, bottom: { name: 'ビー' }, attach: (h) => { W.handler = h; return () => { if (W.handler === h) W.handler = null; }; } } };
      const host = document.createElement('div');
      host.id = 'watch-host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
      document.body.appendChild(host);
      const el = React.createElement(CardBattleBoard, { db, game, onFinish: (r) => W.finished.push(r && r.outcome), meProfile: { name: 'ビー' } });
      (ReactDOM.createRoot ? ReactDOM.createRoot(host).render(el) : ReactDOM.render(el, host));
    });
    await page.waitForSelector('#watch-host [data-card-head]', { timeout: 10000 });
    // 始めのガッツの番などを抜けるまで、何手か流す
    const look = () => page.evaluate(() => {
      const root = document.getElementById('watch-host');
      const text = root.innerText;
      return {
        handCards: root.querySelectorAll('[data-card-hand-card]').length,
        backs: root.querySelectorAll('[data-card-watch-hand] img').length,
        quit: root.querySelectorAll('[data-card-quit]').length,
        badge: !!root.querySelector('[data-card-watch-badge]'),
        head: (root.querySelector('[data-card-head-turn]') || {}).textContent || '',
        anata: /あなた|自分|相手/.test(text.replace(/相手の(番|ターン)/g, '')), surrender: /投了/.test(root.querySelector('[data-card-head]').textContent),
        actionTag: (root.querySelector('[data-card-action] [data-card-fit]') || {}).textContent || '',
        endFx: !!root.querySelector('[data-card-end-fx]'), over: !!root.querySelector('[data-card-watch-over]'),
        wide: root.scrollWidth <= window.innerWidth + 1,
      };
    });
    let sawAction = false, sawBig = false, tags = new Set(), anata = false, heads = new Set();
    for (let i = 0; i < 40; i++) {
      const r = await page.evaluate(() => window.__watch.push(false));
      if (!r) break;
      await page.waitForTimeout(450);
      const l = await look();
      if (l.actionTag) { sawAction = true; tags.add(l.actionTag); }
      if (await page.locator('#watch-host [data-card-big]').count()) sawBig = true;
      if (l.anata) anata = true;
      heads.add(l.head.replace(/\s+/g, ''));
      if (r.winner !== null) break;
    }
    const l1 = await look();
    check('① 押せない: 手札の札が無く、下の人の手札は裏の札で枚数だけ', l1.handCards === 0 && l1.backs > 0, JSON.stringify({ handCards: l1.handCards, backs: l1.backs }));
    check('① 上の帯に「観戦」の札があり、投了・やめるのボタンは無い(下の「観戦をやめる」だけ)', l1.badge && l1.quit === 0 && !l1.surrender, JSON.stringify({ badge: l1.badge, quit: l1.quit }));
    check('② 名前で出す: 「あなた」「自分」「相手」が出ない・上の帯は「◯◯の番」', !anata && [...heads].some((h) => /ビーの番|エーの番/.test(h)), [...heads].slice(0, 4).join(' / '));
    check('③ 技の箱が対戦と同じ道で出て、札は名前(自分・相手ではない)', sawAction && [...tags].every((t) => t === 'ビー' || t === 'エー'), [...tags].join(','));
    check('③ カードの大写しが出る', sawBig);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'watch-board-390.png') }); }
    // ④ 途中から見る形: まとめて流す
    const before = await page.evaluate(() => document.querySelectorAll('#watch-host [data-card-dmg-num]').length);
    let r = null;
    for (let i = 0; i < 400; i++) { r = await page.evaluate(() => window.__watch.push(true)); if (!r || r.winner !== null) break; }
    await page.waitForTimeout(300);
    const quietFx = await page.evaluate(() => ({ big: !!document.querySelector('#watch-host [data-card-big]'), action: !!document.querySelector('#watch-host [data-card-action]') }));
    check('④ 途中から見る形では、動き(大写し・技の箱)を出さずにその場へ飛ぶ', !quietFx.big && !quietFx.action, JSON.stringify({ ...quietFx, before }));
    // ⑤ 決着
    await page.waitForTimeout(600);
    const l2 = await look();
    const fin = await page.evaluate(() => window.__watch.finished.slice());
    check('⑤ 決着しても結果の画面へ進まず、WIN/LOSE ではなく名前の決着の帯', r && r.winner !== null && !l2.endFx && l2.over && fin.length === 0, JSON.stringify({ winner: r && r.winner, endFx: l2.endFx, over: l2.over, fin }));
    await page.evaluate(() => window.__watch.end({ winner: 1, how: 'surrender', head: 'エーさんの勝ち！', sub: 'ターン9で ビーさんが投了しました' }));
    await page.waitForTimeout(200);
    const ov = await page.evaluate(() => ({ how: document.querySelector('#watch-host [data-card-watch-over]').getAttribute('data-card-watch-over-how'), sub: document.querySelector('#watch-host [data-card-watch-over-sub]').textContent, head: document.querySelector('#watch-host [data-card-watch-over-head]').textContent }));
    check('⑤ 届いた決着の言葉(だれがいつ投了したか・だれの勝ちか)を出す', ov.how === 'surrender' && ov.sub.replace(/\s/g, '') === 'ターン9でビーさんが投了しました' && ov.head.replace(/\s/g, '') === 'エーさんの勝ち！', JSON.stringify(ov));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'watch-board-over-390.png') });
    // 帯は押すと消えて、盤面を見られる。下のボタンは「観戦の一覧へ戻る」
    await page.locator('#watch-host [data-card-watch-over]').click();
    const gone = await page.locator('#watch-host [data-card-watch-over]').count();
    const leaveTxt = await page.locator('#watch-host [data-card-watch-leave]').textContent();
    check('⑤ 決着の帯は押すと消え、下のボタンは「観戦の一覧へ戻る」', gone === 0 && leaveTxt === '観戦の一覧へ戻る', `${gone} / ${leaveTxt}`);
    // ⑦ 320
    await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(500);
    const l3 = await look();
    check('⑦ 320×568 でも、盤面が画面の横幅に収まる', l3.wide);
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'watch-board-320.png') });
    // ⑥ やめる
    await page.locator('#watch-host [data-card-watch-leave]').click();
    const fin2 = await page.evaluate(() => window.__watch.finished.slice());
    check('⑥ 「観戦の一覧へ戻る」で onFinish({ outcome: watchExit })', fin2.join() === 'watchExit', fin2.join());
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで動く', false, String(e && e.stack || e).split('\n').slice(0, 3).join(' '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`✗ 盤面の観戦の形: ${failed} 件`); process.exit(1); }
  console.log('✓ 盤面の観戦の形: すべて OK');
})();
