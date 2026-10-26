#!/usr/bin/env node
// MFバトルカードの「集中」(274): 付けた技に、消費ガッツ0の回避・防御が出せないことを、実際の画面で確かめる(2026-10-27 総点検・No.274 の報告)。
//
//   node tools/card/card-focus-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、写真(focus-*.png)を残す
//
// 【なぜ要るか】
// ルールの検査(card-audit-attach-check)は本体の関数だけを見ていて、画面で「付ける」「光る守り」まで通していなかった。
// 遊ぶ人から「効いていない」と届いたので、付ける側・受ける側の両方を画面で通す
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする)
//   A 自分が付ける: 文の無いちから技を押すと「技+集中」が先に選ばれる。相手(緊急回避=0ガッツだけ)は回避できず、ダメージが入る
//   B 助手が付けた技を受ける: 手札の緊急回避(0ガッツ)は押しても守れない・光の盾(1ガッツ)は出せてダメージが1減る
//   C 全体カード「ホリィの声援」(ガッツ−1)の場: 光の盾も0ガッツになるので、集中を付けた技には出せない(2026-10-27 案A・そのとき払うガッツで数える)
//   どれも実行時エラーが無い
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

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  // mode … 'attack'(自分が付ける)/ 'guard'(助手が付けた技を受ける)
  const open = async (mode) => {
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
    await page.addInitScript((m) => {
      window.__mhCardScene = (st) => {
        const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
        const atkP = m === 'attack' ? 0 : 1; // guard・holy は助手が攻める
        const a = st.players[atkP], d = st.players[1 - atkP];
        const mon = a.mons[0];
        const atk = Object.values(db.cards).filter((c) => c.ready && c.user === mon.species && c.kind === 'pow' && !(c.effects || []).length && c.guts > 0).sort((x, y) => x.guts - y.guts)[0];
        window.__mhFocusAtk = atk ? { no: atk.no, name: atk.name, damage: atk.damage } : null;
        a.hand = [atk.no, '274', '100', '100', '100'];
        a.guts = Array(9).fill('100');
        // 受ける側: 緊急回避(0ガッツ・だれでも)と光の盾(1ガッツ・だれでも・ちから技を1減らす)
        d.hand = m === 'attack' ? ['109', '100', '100', '100', '100'] : ['109', '350', '100', '100', '100'];
        d.guts = Array(3).fill('100');
        st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = atkP; st.turn = 2; st.first = atkP;
        a.breederUsed = false; a.mons.forEach((x) => { x.attacks = 0; });
        // C: 全体カード「ホリィの声援」(ガッツ−1)が場にある。光の盾(1ガッツ)も払うガッツが0になる
        if (m === 'holy') { const f = db.cards.F118; st.field = { no: 'F118', p: atkP, effects: (f.effects || []).map((e) => ({ ...e })) }; }
        if (m === 'guard' || m === 'holy') {
          // 助手の手を、集中を付けた技で先に当てておく(守りを選ぶ段から始まる)
          const o = cardAttackOptions(db, st).find((x) => x.mon === 0 && x.hand.length === 2 && x.hand.includes(1) && x.target && x.target.m === 0); // eslint-disable-line no-undef
          window.__mhFocusCpuAct = o || null;
          if (o) return cardApplyAction(db, st, o) || st; // eslint-disable-line no-undef
        }
        return st;
      };
    }, mode);
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
    // デバッグ設定から MFバトルカードへ。はじめてなのでスターターを選び、練習試合は飛ばす
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
    return page;
  };
  try {
    // ---- A 自分が付ける ----
    let page = await open('attack');
    await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'attack', null, { timeout: 20000 });
    const atk = await page.evaluate(() => window.__mhFocusAtk);
    check('A 場面を作れた(先頭の子の文の無いちから技と集中)', !!atk, JSON.stringify(atk));
    const lifeOf = async (pg, key) => { const t = await pg.locator(`[data-card-mon="${key}"]`).innerText().catch(() => ''); const mm = t.match(/(\d+)\s*\/\s*(\d+)/); return mm ? Number(mm[1]) : null; };
    const life0 = await lifeOf(page, '1-0');
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    const setText = await page.locator('[data-card-battle]').innerText();
    check('A 技を押すと「技+集中」が選べる', new RegExp(`${atk.name}\\s*[+＋]\\s*集中`).test(setText), (setText.match(/[^\n]*集中[^\n]*/) || [''])[0]);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'focus-attack.png') }); }
    const user = page.locator('[data-card-mon].ring-amber-300').first();
    if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
    await page.locator('[data-card-mon="1-0"]').click();
    let logText = '', life1 = life0;
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); logText = await page.locator('[data-card-log]').innerText().catch(() => ''); life1 = await lifeOf(page, '1-0'); if (life1 !== life0 || /回避した/.test(logText)) break; }
    check('A 相手は緊急回避(0ガッツ)で回避できず、ダメージが入る・集中は捨て札へ', life0 !== null && life0 - life1 === Math.min(life0, atk.damage) && !/回避した/.test(logText), `ライフ ${life0}→${life1}`);
    await page.close();
    // ---- B 助手が付けた技を受ける ----
    page = await open('guard');
    await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'guard', null, { timeout: 30000 }).catch(() => {});
    const cpuAct = await page.evaluate(() => window.__mhFocusCpuAct);
    check('B 場面を作れた(助手が集中を付けた技で、こちらの先頭の子を狙っている)', !!cpuAct && (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) === 'guard', JSON.stringify(cpuAct));
    const lit = await page.evaluate(() => [...document.querySelectorAll('[data-card-hand-card]')].map((e) => ({ i: e.getAttribute('data-card-hand-card'), dim: getComputedStyle(e).opacity })));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'focus-guard.png') });
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(400);
    const stillGuard = (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) === 'guard';
    const hint = await page.locator('[data-card-battle]').innerText();
    check('B 緊急回避(0ガッツ)は押しても守れない(「このカードでは守れません」)', stillGuard && hint.includes('このカードでは守れません'), JSON.stringify(lit));
    const life2 = await lifeOf(page, '0-0');
    await page.locator('[data-card-hand-card="1"]').click();
    let life3 = life2;
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(250); life3 = await lifeOf(page, '0-0'); if (life3 !== life2) break; }
    const atkB = await page.evaluate(() => window.__mhFocusAtk);
    check('B 光の盾(1ガッツ)は出せて、ダメージが1減る', life2 !== null && life2 - life3 === Math.min(life2, Math.max(0, atkB.damage - 1)), `ライフ ${life2}→${life3}・技 ${atkB && atkB.damage}`);
    await page.close();
    // ---- C ホリィの声援が場にあるとき(集中は「そのとき払うガッツ」で数える・2026-10-27 案A) ----
    page = await open('holy');
    await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'guard', null, { timeout: 30000 }).catch(() => {});
    check('C 場面を作れた(ホリィの声援の場で、助手が集中を付けた技で狙っている)', !!(await page.evaluate(() => window.__mhFocusCpuAct)) && (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) === 'guard');
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'focus-holy.png') });
    await page.locator('[data-card-hand-card="1"]').click();
    await page.waitForTimeout(400);
    const holyText = await page.locator('[data-card-battle]').innerText();
    check('C 光の盾(ホリィの声援で0ガッツ)も押しても守れない', (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) === 'guard' && holyText.includes('このカードでは守れません'));
    check('実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
