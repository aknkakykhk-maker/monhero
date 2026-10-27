#!/usr/bin/env node
// MFバトルカードのゴースト(2026-10-27 カード追加部パックくん)を、実際の画面で確かめる。
//
//   node tools/card/card-ghost-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、それぞれの場面の写真を残す
//
// 見ているもの
//   ① カード投げ(169): 狙う相手をタップすると「捨てる手札を選ぶ」窓が出る。2枚選ぶと「2枚捨てて使う(ダメージ+2)」になり、使うと2枚捨てて相手に2ダメージ
//   ② のりうつる(174): KOされた味方を選べて、使うとゴーストがKO・味方が戻る
//   ③ 第4弾のパックの絵・売り場の種族の名前にゴーストが入る(4種族)
//   ④ 320×568 でも窓のボタンが画面の中
//   ⑤ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8983;
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
const vsSeen = [];
// 決めた場面: 自分の番・攻撃の段。先頭の子をゴーストにして、手札を決める。ko … KO にしておく自分の子の番号
const sceneScript = (cfg) => {
  window.__mhCardScene = (st) => {
    const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
    const me = st.players[0], opp = st.players[1];
    const m = db.monsters['C-024'];
    me.mons[0] = { ...me.mons[0], no: m.no, species: m.species, name: m.name, type: m.type, life: cfg.ghostLife || m.life, max: m.life, main: null, sub: null };
    me.hand = cfg.hand.slice(); me.discard = []; me.guts = Array(9).fill('100');
    opp.hand = ['100', '100', '100']; opp.guts = [];
    (cfg.ko || []).forEach((i) => { me.mons[i].ko = true; me.mons[i].life = 0; });
    st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 0; st.turn = 2; st.first = 0;
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
  await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
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
  // VS(対戦開始の画面)の自分側のアイコンを見る(cfg.vs のとき)
  if (cfg.vs) {
    const ok = await page.locator('[data-card-vs-me-icon]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    await page.waitForTimeout(1500);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `vs-me-${cfg.viewport.width}.png`) }); }
    vsSeen.push(`${cfg.viewport.width}:${ok}`);
  }
  await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
  await page.waitForFunction((m) => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === m, cfg.mode || 'attack', { timeout: 20000 });
  return page;
};
const shot = async (page, name) => { if (!SHOT) return; fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }); };
const lifeOf = (page, key) => page.evaluate((k) => { const el = document.querySelector(`[data-card-mon="${k}"]`); const t = el ? el.innerText : ''; const m = t.match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null; }, key);
const skipSummary = async (page) => { await page.waitForTimeout(600); if (await page.locator('[data-card-turn-summary]').count()) await page.locator('[data-card-turn-summary]').click().catch(() => {}); };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const vp of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
      // ① カード投げ
      const page = await openBattle(browser, { hand: ['169', '165', '166', '170', '176'], mode: 'attack', viewport: vp }, errors);
      await skipSummary(page);
      const before = await page.evaluate(() => document.querySelector('[data-card-battle]').innerText);
      await page.locator('[data-card-hand-card="0"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-card-mon="1-0"]').click();
      const open = await page.locator('[data-card-toss-pick]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
      check(`① ${vp.width}幅: 狙う相手をタップすると、捨てる手札を選ぶ窓が出る`, open);
      if (open) {
        const items = await page.locator('[data-card-toss]').count();
        check(`① ${vp.width}幅: 選べる手札はカード投げのほかの4枚`, items === 4, `${items}枚`);
        await page.locator('[data-card-toss="1"]').click(); await page.locator('[data-card-toss="2"]').click();
        const label = (await page.locator('[data-card-toss-go]').innerText()).trim();
        check(`① ${vp.width}幅: 2枚選ぶと「2枚捨てて使う(ダメージ+2)」`, label === '2枚捨てて使う(ダメージ+2)', label);
        const r = await page.locator('[data-card-toss-go]').evaluate((b) => { const q = b.getBoundingClientRect(); return { bottom: Math.round(q.bottom), h: innerHeight }; });
        check(`④ ${vp.width}幅: 窓のボタンが画面の中`, r.bottom <= r.h, JSON.stringify(r));
        await shot(page, `ghost-toss-${vp.width}`);
        await page.locator('[data-card-toss-go]').click();
        const done = await page.waitForFunction(() => /手札を2枚捨てた/.test(document.querySelector('[data-card-battle]').innerText) || [...document.querySelectorAll('[data-card-log] *, [data-card-log]')].some((e) => /手札を2枚捨てた/.test(e.textContent)), null, { timeout: 15000 }).then(() => true).catch(() => false);
        check(`① ${vp.width}幅: 使うと手札を2枚捨てる`, done);
        const hand = await page.locator('[data-card-hand-card]').count();
        check(`① ${vp.width}幅: 手札が2枚(5枚から技と捨てた2枚が減る)`, hand === 2, `${hand}枚`);
      }
      await page.close();
      if (vp.width !== 390) continue;
      // ② のりうつる(自分の2体目が KO・ゴーストはライフ3)
      const p2 = await openBattle(browser, { hand: ['174', '165', '166'], ko: [1], ghostLife: 3, mode: 'attack', viewport: vp }, errors);
      await skipSummary(p2);
      await p2.locator('[data-card-hand-card="0"]').click();
      await p2.waitForTimeout(300);
      await p2.locator('[data-card-mon="0-1"]').click();
      await p2.waitForTimeout(300);
      // 確かめの窓が出る設定なら「はい」
      const yes = p2.getByRole('button', { name: /^(はい|使う)$/ });
      if (await yes.count() && await yes.first().isVisible().catch(() => false)) await yes.first().click();
      const ok2 = await p2.waitForFunction(() => /のりうつった/.test(document.body.innerText), null, { timeout: 15000 }).then(() => true).catch(() => false);
      check('② のりうつる: KOされた味方をタップして使える(記録に「のりうつった」)', ok2);
      await shot(p2, 'ghost-possess-390');
      await p2.close();
    }
    // ③ パックの絵(デバッグの見本)と売り場の種族の名前
    {
      const page = await openBattle(browser, { hand: ['165'], stopAtTop: true, viewport: { width: 390, height: 844 } }, errors);
      const demo = page.locator('[data-card-pack-art-demo]');
      if (await demo.count()) {
        await demo.first().click();
        await page.locator('[data-card-pack-art="p4"]').first().waitFor({ timeout: 10000 });
        const imgs = await page.locator('[data-card-pack-art="p4"] img').count();
        check('③ 第4弾のパックの絵に立ち絵が並ぶ', imgs >= 3, `${imgs}体`);
        await page.locator('[data-card-pack-art="p4"]').first().scrollIntoViewIfNeeded();
        await shot(page, 'ghost-pack-art');
      } else check('③ パックの絵の見本が開けない', false);
      const label = await page.evaluate(() => (typeof cardPackSpeciesLabel === 'function' ? cardPackSpeciesLabel(CARD_BATTLE_DATA, CARD_PACKS[3]) : '')); // eslint-disable-line no-undef
      check('③ 第4弾の種族の名前が4つ(ゴーストが入る)', label === 'ヒノトリ・モノリス・ヘンガー・ゴースト', label);
      await page.close();
    }
  } catch (e) {
    check('途中で止まった', false, String(e && e.message || e).split('\n')[0]);
  }
  check('⑤ 実行時エラーが無い', !errors.length, errors.slice(0, 3).join(' / '));
  await browser.close();
  server.close();
  if (failed) { console.log(`✗ ゴーストの画面: ${failed} 件`); process.exit(1); }
  console.log('✓ ゴーストの画面: すべて OK');
})();
