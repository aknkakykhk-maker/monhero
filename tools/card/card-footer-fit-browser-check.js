#!/usr/bin/env node
// MFバトルカードの対戦で、いちばん下のボタン(攻撃おわり・ターン終了・守らない など)が、どの幅でも画面の中に収まるかを確かめる
// (2026-10-26 統括部長「手札の下の『これで守る』『ターン終了』『技を使う』が、たまに下が少し切れる」)。
// 原因は2つ。(1) 画面の下の安全域(ホームバーの所)の余白を、体(body)と下の帯の両方が取っていた(二重どり)。
// (2) 背の低い画面では、まんなかの最小の高さ(64px)と手札が縮まず、下の帯が盤の外へ 8〜24px 出ていた(320×568・ホームバーあり)。
// いまは、下の帯が盤の外に出たら 84 の boardFit で1段ずつ詰める(まんなか 64→40px → 手札を少し小さく)。
//
//   node tools/card/card-footer-fit-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、はみ出した場面の写真を残す
//
// 見ているもの(320×568・375×667・390×844・430×932・390×664(ブラウザのバーが出ている)・横 844×390・横 667×375)
//   ① 安全域なし/あり(34px。体に余白を足して、ホームバーのある iPhone をまねる)× 手札3枚/8枚 × 攻撃の段・ガッツの段で、
//      いちばん下のボタンの下のはしが、盤の下のはし(=見えている所)の中にある
//   ② 320×568・安全域ありで、守りの段(守らない)も同じ
//   ③ 下の帯が、安全域の余白をもう一度取っていない(体が取っているので、帯は 8px だけ)
//   (写しの画面では、詰める仕組みが効いたかを data-card-board-fit で見られる)
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8988;
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
const vsSeen = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };


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
    if (cfg.stun !== undefined) me.mons[cfg.stun].stunTurn = st.turn;
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
const base = { sp: 'golem', discard: ['113', '127'], opp: ['100', '100', '100'] };
const HANDS = { 3: ['026', '100', '100'], 8: ['026', '100', '100', '100', '100', '113', '127', '128'] };
const SIZES = [[320, 568], [375, 667], [390, 844], [430, 932], [390, 664], [844, 390], [667, 375]];
const SAFE = 34;
// いちばん下の、見えているボタンの下のはしと、盤の下のはし
const measure = (page) => page.evaluate(() => {
  const board = document.querySelector('[data-card-battle]').getBoundingClientRect();
  const low = [...document.querySelectorAll('[data-card-footer] button')].filter((x) => x.getClientRects().length).map((b) => b.getBoundingClientRect()).sort((a, b) => b.bottom - a.bottom)[0];
  const foot = document.querySelector('[data-card-footer]');
  return { mode: document.querySelector('[data-card-battle]').getAttribute('data-card-mode'), vh: innerHeight, board: Math.round(board.bottom), btn: low ? Math.round(low.bottom) : null, pad: foot ? getComputedStyle(foot).paddingBottom : null };
});
const fits = (m) => m.btn !== null && m.btn <= Math.min(m.vh, m.board) + 0.5;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const bad = [];
  let pads = [];
  try {
    for (const safe of [0, SAFE]) for (const [w, h] of SIZES) for (const n of [3, 8]) {
      const tag = `${w}×${h}・安全域${safe}・手札${n}`;
      const page = await openBattle(browser, { ...base, hand: HANDS[n], active: 0, mode: 'attack', viewport: { width: w, height: h } }, errors);
      // 体(body)の下の余白は env(safe-area-inset-bottom)。写しの画面では 0 なので、同じ大きさを足してまねる
      // 本物の端末では始めから余白があるので、足したあとに「画面の大きさが変わった」を知らせて、盤に測り直させる
      if (safe) { await page.addStyleTag({ content: `body{padding-bottom:${safe}px!important}` }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); }
      await page.waitForTimeout(300);
      const a = await measure(page);
      pads.push(a.pad);
      if (!fits(a)) { bad.push(`${tag} 攻撃 ${JSON.stringify(a)}`); if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `footer-${w}x${h}-s${safe}-h${n}-attack.png`) }); } }
      // 攻撃おわり → ガッツの段
      await page.locator('[data-card-footer] button').filter({ hasText: 'ガッツへ' }).first().click({ timeout: 5000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('[data-card-battle]')?.getAttribute('data-card-mode') === 'guts', null, { timeout: 10000 }).catch(() => {});
      const g = await measure(page);
      if (g.mode !== 'guts' || !fits(g)) { bad.push(`${tag} ガッツ ${JSON.stringify(g)}`); if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `footer-${w}x${h}-s${safe}-h${n}-guts.png`) }); } }
      // ② 320×568・安全域ありは、相手の番まで進めて守りの段も見る
      if (safe && w === 320 && n === 8) {
        // 相手が攻めてこない番もあるので、守りの段になるまで、自分の番は下のボタンで進める(90秒まで)
        let got = false;
        for (let t = 0; t < 300 && !got; t++) {
          const m = await page.evaluate(() => document.querySelector('[data-card-battle]')?.getAttribute('data-card-mode'));
          if (m === 'guard') got = true;
          else if (m === 'attack' || m === 'guts') await page.locator('[data-card-footer] button').last().click({ timeout: 3000 }).catch(() => {});
          if (!got) await page.waitForTimeout(300);
        }
        const d = got ? await measure(page) : null;
        check('② 320×568・安全域あり: 守りの段の下のボタンも画面の中', got && fits(d), JSON.stringify(d));
      }
      await page.close();
    }
    check(`① どの幅・安全域・手札の数・段でも、いちばん下のボタンが画面の中(${SIZES.length * 2 * 2 * 2}場面)`, bad.length === 0, bad.slice(0, 4).join(' / '));
    check('③ 下の帯は安全域の余白をもう一度取らない(8px だけ)', pads.every((p) => p === '8px'), [...new Set(pads)].join(','));
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
