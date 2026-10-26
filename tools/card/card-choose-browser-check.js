#!/usr/bin/env node
// MFバトルカードの「選ぶ段」(捨て札・手札・相手の手札から1枚選ぶ)を、実際の画面で通す(準備中の83枚・区切り4)。
//
//   node tools/card/card-choose-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、窓の写真(choose-*.png)を残す
//
// 【なぜ要るか】
// 作戦の指示・死神の力などは、使ったあとに1枚選ぶ段(st.pendingChoice)へ進む。選ぶ窓が出ないと、試合が先へ進まない。
// 死神の力は、相手が手札を見せる段(st.pendingReveal)を挟む。ルールの検査は本体だけを見るので、画面は別に通す。
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする)
//   ① 作戦の指示(ガリ): 使うと選ぶ窓が出て、捨て札の緊急回避を選ぶと手札に入る
//   ② 死神の力(ジョーカー): 使うと、相手(コンピューター)が手札を見せて、相手の手札3枚が選ぶ窓に並ぶ。選ぶと相手が捨てる
//   ③ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8982;
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
    st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 0; st.turn = 2; st.first = 0;
    me.breederUsed = false; me.mons.forEach((x) => { x.attacks = 0; });
    return st;
  };
};
const openBattle = async (browser, cfg, errors) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => errors.push(String(e)));
  // 自分で Supabase を差し替える検査は印を入れる(印が無いと、差し替え先へ届く前にゲーム側が空の返事で止める。2026-10-27)
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
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
  await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'attack', null, { timeout: 20000 });
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
  try {
    // ① 作戦の指示
    {
      const page = await openBattle(browser, { sp: 'gali', hand: ['022', '100'], discard: ['109', '096'], opp: ['100', '100', '100', '100', '100'] }, errors);
      await useFirst(page);
      await page.locator('[data-card-choose]').waitFor({ timeout: 5000 }).catch(() => {});
      const items = await page.locator('[data-card-choose-item]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'choose-hand.png') }); }
      const k = items.findIndex((t) => t.includes('緊急回避'));
      check('① 作戦の指示: 使うと選ぶ窓が出て、捨て札が並ぶ(緊急回避・フットワーク)', k >= 0 && items.some((t) => t.includes('フットワーク')), items.join(' / '));
      if (k >= 0) await page.locator('[data-card-choose-item]').nth(k).click();
      await page.waitForTimeout(400);
      const hand = await handNames(page);
      check('① 選ぶと窓が閉じて、緊急回避が手札に入る', (await page.locator('[data-card-choose]').count()) === 0 && hand.some((t) => t.includes('緊急回避')), hand.join(' / '));
      await page.close();
    }
    // ② 死神の力
    {
      const page = await openBattle(browser, { sp: 'joker', hand: ['304', '100'], discard: [], opp: ['109', '096', '026'] }, errors);
      await useFirst(page);
      await page.locator('[data-card-choose]').waitFor({ timeout: 8000 }).catch(() => {});
      const items = await page.locator('[data-card-choose-item]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
      if (SHOT) await page.screenshot({ path: path.join(SHOT, 'choose-opp.png') });
      check('② 死神の力: 相手が手札を見せて、相手の手札3枚が選ぶ窓に並ぶ', items.length === 3 && items.some((t) => t.includes('緊急回避')) && items.some((t) => t.includes('でこぴん')), items.join(' / '));
      const k = items.findIndex((t) => t.includes('でこぴん'));
      if (k >= 0) await page.locator('[data-card-choose-item]').nth(k).click();
      await page.waitForTimeout(500);
      const log = await page.locator('[data-card-log]').innerText().catch(() => '');
      check('② 選ぶと窓が閉じて、相手がその札を捨てる', (await page.locator('[data-card-choose]').count()) === 0 && /「でこぴん」を捨てた/.test(log), log.replace(/\s+/g, ' ').slice(-120));
      await page.close();
    }
    check('③ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
