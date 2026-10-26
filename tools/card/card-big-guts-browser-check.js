#!/usr/bin/env node
// MFバトルカードの「行動の前のカード大写し」と「ガッツへ飛ぶカード」を、実際の画面で通す(2026-10-26 社長のスマホでの指摘 4・5)。
//
//   node tools/card/card-big-guts-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、動きの連続写真(big-*.png・guts-*.png)を残す
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする)
//   ① 自分が技を使うと、先にそのカードがまんなかに大きく出て(「自分」の札)、そのあとで効く(相手のライフが減る)
//   ② 大写しはタップで先へ進める(すぐ消えて、効く)
//   ③ 相手(助手)が技を出すときも、先に大きく出る(「相手」の札)
//   ④ 手札を2枚ガッツにすると、2枚がガッツの山へ飛び、「+2」が出る。相手のガッツ(裏のまま)も飛ぶ
//   ⑤ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8984;
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
  await page.locator('[data-card-cpu]').click();
  await page.locator('[data-card-mode-assistant]').click();
  await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
  await page.locator('[data-card-foe="momosuke"]').click();
  await page.locator('[data-card-start]').click();
  await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
  await page.waitForFunction((m) => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === m, cfg.mode || 'attack', { timeout: 20000 });
  return page;
};
// 手札の1枚目の特殊技を使う(使う子を選ぶ必要があれば先頭の子)
const useFirst = async (page) => {
  await page.locator('[data-card-hand-card="0"]').click();
  await page.waitForTimeout(200);
  const user = page.locator('[data-card-mon].ring-amber-300').first();
  if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
  await page.getByRole('button', { name: '使う' }).click();
};
const handNames = (page) => page.locator('[data-card-hand-card]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const snap = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }); } };
  const foeLife = (page) => page.locator('[data-card-mon="1-0"]').innerText().then((t) => t.replace(/\s+/g, ' '));
  try {
    const page = await openBattle(browser, { sp: 'golem', hand: ['026', '026', '100', '100', '100'], discard: [], opp: ['026', '100', '100', '100', '100'] }, errors);
    // ① 自分の技: 大写しが先・あとで効く
    const life0 = await foeLife(page);
    await page.locator('[data-card-hand-card="0"]').click(); await page.waitForTimeout(200);
    const user = page.locator('[data-card-mon].ring-amber-300').first(); if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
    const tgt = page.locator('[data-card-mon="1-0"]'); await tgt.click().catch(() => {});
    await page.waitForTimeout(120);
    const useBtn = page.getByRole('button', { name: '使う' }); if (await useBtn.count()) await useBtn.click().catch(() => {});
    await page.locator('[data-card-big="me"]').waitFor({ timeout: 3000 }).catch(() => {});
    const bigMe = await page.locator('[data-card-big="me"]').innerText().catch(() => '');
    const lifeDuring = await foeLife(page);
    await snap(page, 'big-1-me');
    check('① 自分の技は、先にカードがまんなかに大きく出る(「自分」の札・技の名前)', /自分/.test(bigMe) && /でこぴん/.test(bigMe), bigMe.replace(/\s+/g, ' '));
    check('① 大写しのあいだは、まだ効いていない(相手のライフが同じ)', lifeDuring === life0, `${life0} → ${lifeDuring}`);
    // ② タップで先へ
    const t0 = Date.now();
    await page.locator('[data-card-big-skip]').click({ force: true }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('[data-card-big]'), null, { timeout: 3000 }).catch(() => {});
    const took = Date.now() - t0;
    await page.waitForTimeout(250);
    await snap(page, 'big-2-after');
    // 技が出た(記録に技の名前・相手が守るかを考える番になった)。ライフが減るのは、相手が守るかを決めたあと
    const log = await page.locator('[data-card-log]').innerText().catch(() => '');
    const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => '');
    check('② タップすると大写しがすぐ消えて、技が出る', took < 700 && (/でこぴん/.test(log) || mode === 'wait'), `${took}ms・${mode}・${log.replace(/\s+/g, ' ').slice(-50)}`);
    // ④ 自分のガッツ: 2枚が飛ぶ
    await page.waitForFunction(() => !document.querySelector('[data-card-big]'), null, { timeout: 5000 }).catch(() => {});
    await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click();
    await page.waitForTimeout(200);
    await page.locator('[data-card-hand-card="0"]').click(); await page.locator('[data-card-hand-card="1"]').click();
    await page.getByRole('button', { name: /ターン終了$/ }).click();
    await page.waitForTimeout(60);
    const fly = await page.locator('[data-card-guts-fly="0"]').count();
    await snap(page, 'guts-1-start');
    await page.waitForTimeout(260); await snap(page, 'guts-2-mid');
    await page.waitForTimeout(400);
    const plus = await page.locator('[data-card-guts-plus="0"]').innerText().catch(() => '');
    await snap(page, 'guts-3-end');
    check('④ 手札を2枚ガッツにすると、2枚がガッツの山へ飛び「+2」が出る', fly === 2 && plus === '+2', `${fly}枚・${plus}`);
    // ③ 相手の番: 技の大写し(相手)・相手のガッツも飛ぶ
    let bigFoe = '', foeFly = 0;
    for (let i = 0; i < 80 && (!bigFoe || !foeFly); i++) {
      if (!bigFoe) bigFoe = await page.locator('[data-card-big="foe"]').innerText().catch(() => '');
      if (bigFoe && !fs.existsSync(path.join(SHOT || '/nonexistent', 'big-3-foe.png'))) await snap(page, 'big-3-foe');
      if (!foeFly) foeFly = await page.locator('[data-card-guts-fly="1"], [data-card-guts-plus="1"]').count();
      await page.waitForTimeout(150);
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => '');
      if (mode === 'guard') { const pass = page.getByRole('button', { name: /守らない/ }); if (await pass.count()) await pass.click().catch(() => {}); }
    }
    check('③ 相手(助手)が技を出すときも、先に大きく出る(「相手」の札)', /相手/.test(bigFoe), bigFoe.replace(/\s+/g, ' ').slice(0, 60));
    check('④ 相手がガッツにするとき(裏のまま)も、ガッツの山へ飛ぶ・「+n」が出る', foeFly > 0, String(foeFly));
    await page.close();
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
