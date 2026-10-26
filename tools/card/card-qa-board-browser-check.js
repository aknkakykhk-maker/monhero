#!/usr/bin/env node
// MFバトルカードの通しの見回り(docs/progress/card-battle/qa/README.md)のうち、対戦の画面まわりを直したあとを実際の画面で確かめる(2026-10-26)。
//
//   node tools/card/card-qa-board-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、それぞれの場面の写真を残す
//
// 見ているもの
//   ① 横 844×390: 自分の番の始めのまとめが右の手札にかからず、左の盤の中に出る(QA 2)。下のボタンが画面の中にあり、ふつうのタップで押せる
//   ② 320×568・390×844: 「あなたのターン」の帯が出ているあいだ、後ろの記録の字が消えている(QA 7)
//   ③ 320×568: 場のモンスターの名前が「…」で切れず、名前の欄からはみ出さない(5〜8文字。QA 8)
//   ④ 320×568・390×844: 捨て札の一覧の名前が「…」で切れず、カードの幅に収まる(QA 9)
//   ⑤ 320×568: オプションの「「守らない」」がかぎかっこの中で折れない(QA 12)
//   ⑥ 320・375: 練習試合クリアのドラの台詞の「ひととおり」が言葉の途中で折れない(QA 10。台詞を同じ幅の吹き出しに描いて確かめる)
//   ⑦ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8987;
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };


// 決めた場面: 自分の番・攻撃の段。先頭の子を sp の種族にして、手札・捨て札・相手の手札を決める
const sceneScript = (cfg) => {
  window.__mhCardScene = (st) => {
    const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
    const me = st.players[0], opp = st.players[1];
    const m = Object.values(db.monsters).filter((x) => x.species === cfg.sp && !x.main).sort((a, b) => (a.no < b.no ? -1 : 1))[0];
    me.mons[0] = { ...me.mons[0], no: m.no, species: m.species, name: m.name, type: m.type, life: m.life, max: m.life, main: null, sub: null };
    me.hand = cfg.hand.slice(); me.discard = cfg.discard.slice(); me.guts = Array(9).fill('100');
    opp.hand = cfg.opp.slice(); opp.guts = Array(3).fill('100');
    st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = cfg.active || 0; st.turn = 2; st.first = 0;
    if (cfg.field) st.field = { no: cfg.field, p: 1, effects: (db.cards[cfg.field].effects || []).map((e) => ({ ...e })) };
    if (cfg.pray) st.pendingPray = { p: 0, by: 1, no: cfg.pray };
    // 相手の場の子を名前で決める(長い名前を出す)
    (cfg.oppMons || []).forEach((name, i) => { const x = Object.values(db.monsters).find((y) => y.name === name); if (x) opp.mons[i] = { ...opp.mons[i], no: x.no, species: x.species, name: x.name, type: x.type, life: x.life, max: x.life, main: x.main || null, sub: x.sub || null }; });
    me.breederUsed = false; me.mons.forEach((x) => { x.attacks = 0; });
    return st;
  };
};
const openBattle = async (browser, cfg, errors) => {
  const page = await browser.newPage({ viewport: cfg.viewport || { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__cardSeeded')) return;
    sessionStorage.setItem('__cardSeeded', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  });
  await page.addInitScript(eventStorySeed());
  await page.addInitScript(sceneScript, cfg);
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
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
  await page.locator('[data-debug-card-battle]').dispatchEvent('click');
  await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-kit="powerful"]').click();
  await page.getByRole('button', { name: /にする$/ }).click();
  await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-quit]').click();
  await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
  await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'トップへ' }).click();
  await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
  if (cfg.stopAtTop) return page;
  await page.locator('[data-card-cpu]').click();
  await page.locator('[data-card-mode-assistant]').click();
  await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
  await page.locator('[data-card-foe="momosuke"]').click();
  await page.locator('[data-card-start]').click();
  await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
  await page.waitForFunction((m) => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === m, cfg.mode || 'attack', { timeout: 20000 });
  return page;
};
const shot = async (page, name) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }); };
const LONG = ['ナーガ', 'メタルナー', 'ストライクリパー'];
const DISCARD = ['113', '127', '128', '134', '135', '136', '147', '161'];
const base = { sp: 'golem', hand: ['026', '100', '100', '100', '100'], discard: DISCARD, opp: ['100', '100', '100'], oppMons: LONG };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    // ① 横の画面: 相手の番から始めて、自分の番の始めのまとめを待つ
    {
      // まとめは、相手が何かした番のあとにだけ出て、少しで自動で閉じる。出なかった試合はやり直す(3試合まで)
      let page = null, ok = false;
      for (let tries = 0; tries < 3 && !ok; tries++) {
        if (page) await page.close();
        page = await openBattle(browser, { ...base, active: 1, mode: 'wait', viewport: { width: 844, height: 390 } }, errors);
        ok = await page.locator('[data-card-turn-summary]').waitFor({ timeout: 70000 }).then(() => true).catch(() => false);
      }
      await page.waitForTimeout(500);
      const r = ok ? await page.evaluate(() => {
        const q = (s) => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
        const sum = q('[data-card-turn-summary]'), hand = q('[data-card-hand]'), field = q('[data-card-field]');
        return { sum: [sum.left, sum.right, sum.top, sum.bottom].map(Math.round), handLeft: Math.round(hand.left), fieldRight: Math.round(field.right), bottom: innerHeight };
      }) : null;
      await shot(page, 'qa2-land-summary-844x390');
      // 下のボタン(攻撃おわり → ガッツへ)が画面の中にあって、ふつうのタップで押せる(統括部長: 見回りの写真 q18 の「対戦」ボタン)
      if (ok) await page.locator('[data-card-turn-summary]').click().catch(() => {});
      await page.waitForTimeout(300);
      const foot = await page.evaluate(() => {
        const b = [...document.querySelectorAll('[data-card-footer] button')].find((x) => x.getClientRects().length);
        if (!b) return null;
        const q = b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
        return { text: b.innerText.replace(/\s+/g, ''), top: Math.round(q.top), bottom: Math.round(q.bottom), h: innerHeight, hit: !!hit && b.contains(hit) };
      });
      const tapped = foot && foot.hit ? await page.locator('[data-card-footer] button').filter({ hasText: 'ガッツへ' }).first().click({ timeout: 5000 }).then(() => true).catch(() => false) : false;
      check('① 横 844×390: 下のボタン(攻撃おわり → ガッツへ)が画面の中にあり、ふつうのタップで押せる', foot && foot.bottom <= foot.h && foot.top >= 0 && foot.hit && tapped, JSON.stringify(foot));
      check('① 横 844×390: 始まりのまとめが右の手札にかからず、左の盤の中に出る', r && r.sum[1] <= r.handLeft && r.sum[1] <= r.fieldRight + 1 && r.sum[3] <= r.bottom, JSON.stringify(r));
      await page.close();
    }
    for (const [w, h] of [[320, 568], [390, 844]]) {
      // ② 番の帯のあいだ、記録の字が消えている
      const page = await openBattle(browser, { ...base, active: 1, mode: 'wait', viewport: { width: w, height: h } }, errors);
      const seen = await page.locator('[data-card-turn-banner="me"]').waitFor({ timeout: 70000 }).then(() => true).catch(() => false);
      // まとめが帯の上に重なるので、閉じてから帯を撮る
      if (seen && await page.locator('[data-card-turn-summary]').count()) await page.locator('[data-card-turn-summary]').click().catch(() => {});
      if (seen && await page.locator('[data-card-turn-banner]').count()) await shot(page, `qa7-turn-banner-${w}`);
      const op = seen ? await page.evaluate(() => { const b = document.querySelector('[data-card-turn-banner]'); const l = document.querySelector('[data-card-log]'); return { banner: !!b, log: l ? Number(getComputedStyle(l).opacity) : null }; }) : null;
      check(`② ${w}×${h}: 番の帯のあいだ、後ろの記録の字が消えている`, op && op.banner && op.log !== null && op.log < 0.2, JSON.stringify(op));
      // ③ 場のモンスターの名前(帯が消えてまとめを閉じてから)
      await page.locator('[data-card-turn-banner]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      if (await page.locator('[data-card-turn-summary]').count()) await page.locator('[data-card-turn-summary]').click().catch(() => {});
      await page.waitForTimeout(300);
      const names = await page.evaluate(() => [...document.querySelectorAll('[data-card-mon-name]')].map((e) => {
        const col = e.parentElement.getBoundingClientRect(), b = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        return { name: e.innerText, out: Math.round(b.right - col.right), cut: cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1, lines: Math.round(b.height / parseFloat(cs.lineHeight || '14')) };
      }));
      if (w === 320) await shot(page, 'qa8-mon-names-320');
      const bad = names.filter((x) => x.out > 1 || x.cut);
      check(`③ ${w}×${h}: 場のモンスターの名前が切れず、欄からはみ出さない(${names.map((x) => x.name).join('・')})`, names.length === 6 && LONG.every((n) => names.some((x) => x.name === n)) && bad.length === 0, JSON.stringify(bad));
      // ④ 捨て札の一覧
      await page.locator('[data-card-battle] button', { hasText: /^捨て札/ }).last().click();
      await page.locator('[data-card-discard-name]').first().waitFor({ timeout: 10000 });
      await page.waitForTimeout(300);
      const dn = await page.evaluate(() => [...document.querySelectorAll('[data-card-discard-name]')].map((e) => {
        const b = e.getBoundingClientRect(), card = e.parentElement.getBoundingClientRect();
        return { name: e.innerText.replace(/\s+/g, ''), over: e.scrollWidth > e.clientWidth + 1 || b.right > card.right + 1 };
      }));
      await shot(page, `qa9-discard-names-${w}`);
      check(`④ ${w}×${h}: 捨て札の一覧の名前が切れずにカードの幅に収まる`, dn.length === DISCARD.length && dn.every((x) => !x.over && x.name.length >= 5), JSON.stringify(dn.filter((x) => x.over)));
      await page.close();
    }
    // ⑤ オプション(320)
    {
      const page = await openBattle(browser, { ...base, stopAtTop: true, viewport: { width: 320, height: 568 } }, errors);
      await page.locator('[data-card-options-open]').click();
      await page.locator('[data-card-setting="autoPass"]').scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const q = await page.evaluate(() => [...document.querySelectorAll('[data-ja-keep]')].filter((e) => /「守らない」/.test(e.innerText)).map((e) => e.getClientRects().length));
      await page.locator('[data-card-setting="autoPass"]').screenshot({ path: SHOT ? path.join(SHOT, 'qa12-options-320.png') : path.join(require('os').tmpdir(), 'qa12.png') }).catch(() => {});
      check('⑤ 320×568: オプションの「「守らない」」がかぎかっこの中で折れない', q.length >= 1 && q.every((n) => n === 1), JSON.stringify(q));
      // ⑥ ドラの台詞を、練習試合クリアの吹き出しと同じ幅で描く(320・375 の画面での本文の幅)
      for (const vw of [320, 375]) {
        const r = await page.evaluate((vw) => {
          const host = document.createElement('div');
          // クリアの画面: 外の余白・絵(42%)・すき間を引いた残りが吹き出し
          const width = Math.round((vw - 24 - 16) * 0.58 - 8 - 20);
          host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;font-size:13px;font-weight:800;line-height:1.375;z-index:99999;background:#fff;color:#1f1333;padding:4px`;
          Object.assign(host.style, { wordBreak: 'keep-all', overflowWrap: 'anywhere', textWrap: 'wrap' });
          document.body.appendChild(host);
          ReactDOM.createRoot(host).render(cardJaWrap('よくやったな。これで決まりはひととおりだ。あとは対戦で慣れていこう')); // eslint-disable-line no-undef
          return new Promise((res) => setTimeout(() => { const k = [...host.querySelectorAll('[data-ja-keep]')].find((e) => e.innerText.startsWith('ひととおり')); res({ width, rects: k ? k.getClientRects().length : 0 }); host.remove(); }, 300));
        }, vw);
        check(`⑥ ${vw}幅: ドラの台詞の「ひととおり」が言葉の途中で折れない`, r.rects === 1, JSON.stringify(r));
      }
      await page.close();
    }
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
