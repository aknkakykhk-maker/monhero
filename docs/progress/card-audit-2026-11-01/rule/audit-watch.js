// 点検(2026-11-01 ルールくん): 助手どうし・新しいモンスターのデッキの試合を、観戦の形の盤面(84 CardBattleBoard)で最後まで流し、
// 実行時エラー・画面に出た undefined/NaN/{ }・字のはみ出し・盤面が画面からはみ出す所を拾い、止め絵を残す。
//   node audit-watch.js <port> <出力フォルダ>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [port, outDir] = process.argv.slice(2);
const SIZES = [[390, 844, '縦'], [844, 390, '横'], [390, 600, '低い']];
const MATCHES = [
  { id: 'kyuko-sora', a: { who: 'kyuko', lv: 'master' }, b: { who: 'sorashido', lv: 'master' } },
  { id: 'new-mons', a: { who: 'kyuko', lv: 'master', mons: ['C-066', 'C-067', 'C-068'] }, b: { who: 'sorashido', lv: 'master', mons: ['C-208', 'C-066V', 'C-067S'] } },
  { id: 'sora-mua', a: { who: 'sorashido', lv: 'hard' }, b: { who: 'mua', lv: 'expert' } },
];
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const report = [];
  for (const [w, h, label] of SIZES) for (const mt of MATCHES.filter((m) => !process.env.ONLY || m.id === process.env.ONLY)) {
    const page = await b.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardBattleBoard === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
    await page.evaluate((mt) => {
      const db = CARD_BATTLE_DATA;
      // mons を決めたときは、その3体が使えるカード(と だれでも使えるカード)から、1種3枚までで50枚を組む
      const deck = (s, k) => {
        const d = cardAiBuildDeck(db, s.who, s.lv, cardAiSeededRand(`a:${k}`));
        if (!s.mons) return d;
        const ms = s.mons.map((no) => ({ ...cardMonsterOf(db, no), ko: false }));
        const pool = Object.values(db.cards).filter((c) => c.ready && c.user !== 'breeder' && (c.user === 'any' || ms.some((m) => cardUsableBy(c, m))));
        const cards = [];
        for (let r = 0; r < 3 && cards.length < 50; r++) pool.forEach((c) => { if (cards.length < 50) cards.push(c.no); });
        return { monsters: s.mons, cards };
      };
      let st = cardCreateGame(db, { decks: [deck(mt.a, 0), deck(mt.b, 1)], names: ['ビー', 'エー'], seed: 21, first: 0 });
      const pols = [cardAiPolicy(mt.a.who, mt.a.lv), cardAiPolicy(mt.b.who, mt.b.lv)];
      let seed = 77; const rand = () => { const n = cardRngNext(seed); seed = n.s; return n.v; };
      const W = window.__w = { handler: null, n: 0 };
      W.push = () => {
        if (st.winner !== null) return false;
        const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? cardOther(st.first) : cardDecider(st);
        const act = cardAiChooseAction(db, st, pols[who] || pols[0], rand);
        const n = act && cardApplyAction(db, st, act);
        const fb = !n && (st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null);
        const n2 = n || (fb && cardApplyAction(db, st, fb));
        if (!n2) return false; st = n2; W.n++; if (W.handler) W.handler.onState(st, false); return true;
      };
      W.st = () => st;
      const game = { key: 'audit', st, watch: { top: { name: 'エー' }, bottom: { name: 'ビー' }, attach: (h) => { W.handler = h; return () => {}; } } };
      const host = document.createElement('div'); host.id = 'host';
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
      document.body.appendChild(host);
      ReactDOM.createRoot(host).render(React.createElement(CardBattleBoard, { db, game, onFinish: () => {}, meProfile: { name: 'ビー' } }));
    }, mt);
    await page.waitForSelector('#host [data-card-head]', { timeout: 15000 });
    const look = () => page.evaluate(() => {
      const root = document.getElementById('host');
      const text = root.innerText;
      const bad = (text.match(/undefined|NaN|\[object|null(?![^\s])|\{|\}/g) || []);
      const over = [];
      root.querySelectorAll('*').forEach((el) => {
        if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return;
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') over.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)}「${el.textContent.trim().slice(0, 20)}」`);
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > innerWidth + 2 || r.left < -2)) over.push(`画面の外「${el.textContent.trim().slice(0, 20)}」${Math.round(r.left)}..${Math.round(r.right)}`);
      });
      return { bad: [...new Set(bad)], over: [...new Set(over)].slice(0, 6), turn: (document.querySelector('#host [data-card-head-turn]') || {}).textContent || '' };
    });
    const found = { bad: new Set(), over: new Set() };
    let shots = 0;
    for (let i = 0; i < 260; i++) {
      const go = await page.evaluate(() => window.__w.push());
      await page.waitForTimeout(i < 10 ? 120 : 260);
      if (i % 6 === 0) {
        const l = await look();
        l.bad.forEach((x) => found.bad.add(`${x}(${l.turn})`)); l.over.forEach((x) => found.over.add(x));
        if ((l.bad.length || l.over.length) && shots < 4) { shots++; await page.screenshot({ path: path.join(outDir, `${label}-${mt.id}-気になる-${i}.png`) }); }
      }
      if (i === 30 || i === 120) await page.screenshot({ path: path.join(outDir, `${label}-${mt.id}-${i}.png`) });
      if (!go) break;
    }
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(outDir, `${label}-${mt.id}-おわり.png`) });
    const st = await page.evaluate(() => { const s = window.__w.st(); return { winner: s.winner, turn: s.turn, n: window.__w.n }; });
    report.push({ size: label, match: mt.id, ...st, errors, bad: [...found.bad].slice(0, 8), over: [...found.over].slice(0, 8) });
    console.log(JSON.stringify(report[report.length - 1]));
    await page.close();
  }
  fs.writeFileSync(path.join(outDir, 'audit-watch.json'), JSON.stringify(report, null, 1));
  await b.close();
})();
