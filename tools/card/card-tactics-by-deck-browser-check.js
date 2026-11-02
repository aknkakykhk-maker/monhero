#!/usr/bin/env node
// MFバトルカード: 戦術カードをデッキごとに覚える(2026-11-02 テスターさんの要望・社長「デッキごとに戦術カードを記憶させたい」)
//   96 の mh_card_tactics_by_deck_v1 と、98 のデッキ登録の画面を、実際のブラウザで確かめる
//
//   node tools/card/card-tactics-by-deck-browser-check.js
//
//   ① はじめ(デッキごとの覚えが無い): どのデッキも、今の共通の戦術カード(mh_card_tactics_v1)から始まる
//   ② デッキ①を別の型にして登録すると: デッキ①の分を覚え、共通の戦術カードも同じ物になる(今までどおり「最後に使った物」)。
//      はじめて書くときだけ、ほかのデッキ(②)にも「書く前の共通の戦術カード」を入れる
//   ③ 開き直してデッキ②を選ぶと②の(書く前の)戦術カード、デッキ①に戻すと①の戦術カードが出る(前は①の物が②にも入っていた)
//   ④ 画面の中でデッキを切り替えて戻ると、組みかけが残る
//   ⑤ 覚えの形が壊れていても、共通の戦術カードから始まる。共通のキーは消さない
//   ⑥ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8967;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

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
    // 本番のサーバーへは書かない(登録は検査の中で 'ok' を返す)
    const calls = [];
    await page.route(/supabase\.co/, (route) => {
      const url = route.request().url();
      const fn = (url.match(/rpc\/([a-z_]+)/) || [])[1] || '';
      if (fn) calls.push(fn);
      const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
      if (fn === 'card_deck_register') return json('ok');
      return json(fn ? null : []);
    });
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardDeckRegister === 'function' && typeof cardTacticsDeckLoad === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
    // 2組のデッキと、共通の戦術カード(メインの基本カードは「守り型」)
    const setup = await page.evaluate(() => {
      const db = CARD_BATTLE_DATA;
      const rand = cardAiSeededRand('by-deck');
      const A = { ...cardAiBuildDeck(db, 'mua', 'normal', rand), id: 'dA', name: 'デッキA' };
      const B = { ...cardAiBuildDeck(db, 'dra', 'normal', rand), id: 'dB', name: 'デッキB' };
      const col = {};
      [A, B].forEach((d) => [...d.monsters, ...d.cards].forEach((no) => { col[no] = 9; }));
      const frames = cardTacticNormalizeFrames({});
      frames.base = ['tGuard', ...frames.base.slice(1)];
      const own = {};
      CARD_TACTIC_CARDS.forEach((c) => { own[c.id] = 1; });
      const shared = { ...cardNormalizeTactics(null), own, frames };
      localStorage.setItem('mh_card_tactics_v1', JSON.stringify(shared));
      localStorage.removeItem('mh_card_tactics_by_deck_v1');
      window.__decks = { v: 1, active: 'dA', decks: [A, B] };
      window.__col = col;
      return { a: cardDeckProblems(db, A).length, b: cardDeckProblems(db, B).length };
    });
    check('検査のデッキ2組が決まりどおり', setup.a === 0 && setup.b === 0, JSON.stringify(setup));
    const mount = () => page.evaluate(() => {
      document.getElementById('__reg')?.remove();
      const div = document.createElement('div');
      div.id = '__reg';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
      document.body.appendChild(div);
      if (window.__root) window.__root.unmount();
      window.__root = ReactDOM.createRoot(div);
      window.__root.render(React.createElement(CardDeckRegister, { db: CARD_BATTLE_DATA, decks: window.__decks, collection: window.__col, onBack: () => {} }));
    });
    const T = (sel) => page.locator(`#__reg ${sel}`);
    const get = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return 'こわれ'; } }, k);
    // デッキを選んで「自分で組み合わせる」へ進み、メインの基本カードの名前を読む(組みかけをそのまま見せる画面)
    //   この画面には戻るボタンが無いので、読むたびに開き直す
    const mainOf = async (deckId) => {
      await mount();
      await T(`[data-card-reg-deck="${deckId}"]`).waitFor({ timeout: 15000 });
      await T(`[data-card-reg-deck="${deckId}"]`).click();
      await T('[data-card-reg-next]').click();
      await T('[data-card-reg-style="custom"]').click();
      await T('[data-card-reg-base-slot="0"]').waitFor({ timeout: 8000 });
      return (await T('[data-card-reg-base-slot="0"]').innerText()).replace(/\s+/g, ' ');
    };

    // ①
    const a0 = await mainOf('dA')
    const b0 = await mainOf('dB')
    check('① 覚えが無いうちは、どのデッキも共通の戦術カード(守り型)から始まる', /守り型/.test(a0) && /守り型/.test(b0), `${a0} / ${b0}`);

    // ② デッキAを「型」で組み直して登録
    await mount();
    await T('[data-card-reg-deck="dA"]').waitFor({ timeout: 15000 });
    await T('[data-card-reg-deck="dA"]').click();
    await T('[data-card-reg-next]').click();
    const styles = await T('[data-card-reg-style]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-reg-style')).filter((x) => x !== 'custom'));
    let usedStyle = null, mainA = null;
    for (const sid of styles) {
      await T(`[data-card-reg-style="${sid}"]`).click();
      const base0 = await page.evaluate(() => null);
      usedStyle = sid; mainA = base0;
      break;
    }
    await T('[data-card-reg-next]').click(); // 確かめへ
    await T('[data-card-reg-register]').waitFor({ timeout: 8000 });
    await page.waitForFunction(() => { const b = document.querySelector('#__reg [data-card-reg-register]'); return b && !b.disabled; }, null, { timeout: 15000 });
    await T('[data-card-reg-register]').click();
    await page.waitForTimeout(1200);
    const byDeck = await get('mh_card_tactics_by_deck_v1');
    const shared = await get('mh_card_tactics_v1');
    const fa = byDeck && byDeck.decks && byDeck.decks.dA, fb = byDeck && byDeck.decks && byDeck.decks.dB;
    check('② 登録すると、デッキAの戦術カードを覚える(共通の戦術カードにも同じ物を書く)', calls.includes('card_deck_register') && !!fa && JSON.stringify(fa.frames) === JSON.stringify(shared.frames), `型 ${usedStyle} / A ${fa && fa.frames.base[0]} / 共通 ${shared && shared.frames.base[0]}`);
    check('② はじめて書くとき、デッキBには書く前の共通の戦術カード(守り型)を入れておく', !!fb && fb.frames.base[0] === 'tGuard', JSON.stringify(fb && fb.frames.base));
    const aMain = fa ? fa.frames.base[0] : null;
    check('② デッキAは守り型から変わった(この検査が意味を持つ)', !!aMain && aMain !== 'tGuard', String(aMain));

    // ③ 開き直す
    const b1 = await mainOf('dB')
    const a1 = await mainOf('dA')
    const nameOf = (id) => page.evaluate((x) => (cardTacticOf(x) || {}).name || '', id);
    const aName = await nameOf(aMain);
    check('③ 開き直してデッキBを選ぶと、Bの戦術カード(守り型)が出る', /守り型/.test(b1), b1);
    check('③ デッキAに戻すと、Aで最後に使った戦術カードが出る', !!aName && a1.includes(aName), `${a1} / ${aName}`);

    // ④ 組みかけ: Aで別の型を選び、Bへ切り替えて戻る
    await mount();
    await T('[data-card-reg-deck="dA"]').waitFor({ timeout: 15000 });
    await T('[data-card-reg-deck="dA"]').click();
    await T('[data-card-reg-next]').click();
    const other = styles.find((s) => s !== usedStyle);
    let keepOk = true, detail = 'ほかの型なし';
    if (other) {
      await T(`[data-card-reg-style="${other}"]`).click();
      await T('[data-card-reg-back]').click(); // デッキえらびへ
      await T('[data-card-reg-deck="dB"]').click();
      await T('[data-card-reg-deck="dA"]').click();
      await T('[data-card-reg-next]').click();
      const sel = await T(`[data-card-reg-style="${other}"]`).getAttribute('aria-pressed').catch(() => null);
      const cls = await T(`[data-card-reg-style="${other}"]`).getAttribute('class');
      keepOk = /border-amber-300/.test(cls || '') && !/border-amber-300/.test((await T(`[data-card-reg-style="${usedStyle}"]`).getAttribute('class')) || '');
      detail = `${other} ${sel} ${String(cls).slice(0, 60)}`;
    }
    check('④ 画面の中でデッキを切り替えて戻ると、組みかけ(選んだ型)が残る', keepOk, detail);

    // ⑤ 覚えが壊れていても読める・共通のキーは残る
    const broken = await page.evaluate(async () => {
      await storeSet('mh_card_tactics_by_deck_v1', { v: 1, decks: [1, 2] }, false);
      const r = await cardTacticsDeckLoad();
      const f = cardTacticsFramesOfDeck(r.box, (await cardTacticsLoad()).tactics, 'dB');
      const odd = cardTacticsDeckNormalize({ v: 1, decks: { dA: { frames: 'x' }, '': { frames: {} }, dC: null } });
      return { keys: Object.keys(r.box.decks).length, base: f.base[0], shared: !!localStorage.getItem('mh_card_tactics_v1'), odd: Object.keys(odd.decks).length };
    });
    check('⑤ 覚えが壊れていても、共通の戦術カードから始まる・共通のキーは残る', broken.keys === 0 && broken.base === aMain && broken.shared && broken.odd === 0, JSON.stringify(broken));
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('最後まで動く', false, String(e).slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
    console.log(failed ? `\n✗ 戦術カードをデッキごとに覚える: ${failed} 件 NG` : '\n✓ 戦術カードをデッキごとに覚える: すべて OK');
    process.exit(failed ? 1 : 0);
  }
})();
