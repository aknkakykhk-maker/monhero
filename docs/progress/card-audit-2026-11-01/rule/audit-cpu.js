// 点検(2026-11-01 ルールくん): 助手と対戦(ソラシド・きゅうこ)を、対戦の盤面(84 CardBattleBoard)で人が押すように最後まで遊び、
// 吹き出しのセリフを全部集め、画面の崩れ・エラーを拾って止め絵を残す。
//   node audit-cpu.js <port> <出力フォルダ> <助手> <強さ> <幅x高さ>
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [port, outDir, who, level, size] = process.argv.slice(2);
const [W, H] = (size || '390x844').split('x').map(Number);
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: W, height: H } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof CardBattleBoard === 'function' && typeof CARD_BATTLE_DATA === 'object', null, { timeout: 90000 });
  await page.evaluate(([who, level]) => {
    const db = CARD_BATTLE_DATA;
    const me = cardAiBuildDeck(db, 'mua', 'hard', cardAiSeededRand('me'));
    const cpu = cardAiBuildDeck(db, who, level, cardAiSeededRand(`cpu:${who}`));
    const st = cardCreateGame(db, { decks: [me, cpu], names: ['ビー', 'あいて'], seed: 31, first: 0 });
    window.__done = null;
    const game = { key: 'audit-cpu', st, who, level, settings: normalizeCardSettings(null), cpuSameBlood: !!cpu.sameBlood };
    const host = document.createElement('div'); host.id = 'host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#120d2a';
    document.body.appendChild(host);
    ReactDOM.createRoot(host).render(React.createElement(CardBattleBoard, { db, game, onFinish: (r) => { window.__done = r && r.outcome; }, meProfile: { name: 'ビー' } }));
  }, [who, level]);
  await page.waitForSelector('#host [data-card-head]', { timeout: 15000 });
  const lines = new Set();
  let shots = 0, steps = 0, guardShots = 0;
  const T = (sel) => page.locator(`#host ${sel}`);
  const clickText = async (re) => {
    const bs = T('button');
    const n = await bs.count();
    for (let i = 0; i < n; i++) {
      const bt = bs.nth(i);
      const t = (await bt.innerText().catch(() => '')).replace(/\s+/g, '');
      if (re.test(t) && await bt.isVisible().catch(() => false) && await bt.isEnabled().catch(() => false)) { await bt.click({ timeout: 1500 }).catch(() => {}); return t; }
    }
    return null;
  };
  const MAX = Number(process.env.MAX || 900);
  for (let i = 0; i < MAX && !(await page.evaluate(() => window.__done)); i++) {
    if (process.env.DEBUG && i % 10 === 0) { await page.screenshot({ path: path.join(outDir, `dbg-${i}.png`) }); }
    const bub = await T('[data-card-bubble]').allTextContents().catch(() => []);
    bub.forEach((x) => lines.add(x.trim()));
    // カードを選ぶ画面(最後の切札・影縛りなど)は、いちばん上を選ぶ
    const ch = T('[data-card-choose-item]');
    if (await ch.count()) { await ch.first().click({ timeout: 1000 }).catch(() => {}); const ok = await clickText(/^(決める|これにする|OK)/); if (process.env.DEBUG) console.log('choose', ok); steps++; await page.waitForTimeout(300); continue; }
    // 守り: 守れるなら最初の守りのカード、なければ守らない
    // 守りの番の画面は、押す前に2回まで撮る(#4394 守りを決めるまでの表示)
    if (guardShots < 2 && await T('[data-card-guard-attack]').count()) { guardShots++; await page.waitForTimeout(700); await page.screenshot({ path: path.join(outDir, `${who}-${level}-${W}x${H}-守りの番-${guardShots}.png`) }); }
    const g = await clickText(/^守らない|ダメージを受ける/);
    if (g) { if (process.env.DEBUG) console.log('guard', g); steps++; await page.waitForTimeout(250); continue; }
    // 自分の攻撃: 暗くない手札を押して、光った相手を押す
    const hands = await T('[data-card-hand-card]:not([data-card-hand-dim])').count();
    let used = false;
    for (let k = 0; k < hands && !used; k++) {
      await T('[data-card-hand-card]:not([data-card-hand-dim])').nth(k).click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(150);
      const tgt = T('[data-card-mon].ring-rose-400');
      if (await tgt.count()) { await tgt.first().click({ timeout: 1000 }).catch(() => {}); used = true; }
      const u = await clickText(/^(使う|この技を使う)/);
      if (u) used = true;
    }
    if (used) { if (process.env.DEBUG) console.log('used'); steps++; await page.waitForTimeout(400); continue; }
    const t = await clickText(/攻撃おわり|ガッツへ|ターン終了|終わる|次へ|はじめる|OK/);
    if (t) steps++;
    if (process.env.DEBUG) console.log('text', t);
    if (i % 40 === 20 && shots < 6) { shots++; await page.screenshot({ path: path.join(outDir, `${who}-${level}-${W}x${H}-${i}.png`) }); }
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, `${who}-${level}-${W}x${H}-おわり.png`) });
  const st = await page.evaluate(() => window.__done);
  const out = { who, level, size, done: st, steps, errors, lines: [...lines] };
  fs.writeFileSync(path.join(outDir, `${who}-${level}-${W}x${H}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
  await b.close();
})();
