#!/usr/bin/env node
// MFバトルカードの「影縛り」(366): 名指しする守りの札を選ぶ窓を、実際の画面で開いて確かめる(準備中の83枚・区切り2)。
//
//   node tools/card/card-bind-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、窓の写真(bind-pick.png)を残す
//
// 【なぜ要るか】
// 影縛りは、技に付けたあとに名指しする札の名前を選ぶ。名前が無い手はルールの本体が断るので、窓が開かないと技が出せない。
// ルールの検査(card-rules-check)は本体だけを見るので、画面の窓は別に通す(2026-10-25 窓口「社長に見せる前にこちらで確かめて」)。
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする)
//   自分: 先頭の子の文の無いちから技・影縛り・ガッツ9 / 相手: 緊急回避(0ガッツの回避)だけを持ち、ガッツ3
//   ① 技を選んで相手を狙うと、名指しの窓が開く(守りの札の名前が並ぶ。狙った子が使える守りが先)
//   ② 「やめる」で閉じる。技は出ていない(記録が変わらない・攻撃の番のまま)
//   ③ もう一度開いて「緊急回避」を選ぶと技が出る。相手は緊急回避で回避できず、ダメージが入る
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8981;
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
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
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
    // 決めた場面: 自分の番・攻撃の段。自分の先頭の子の、文の無いちから技と影縛り。相手は緊急回避だけ
    await page.addInitScript(() => {
      window.__mhCardScene = (st) => {
        const db = CARD_BATTLE_DATA; // eslint-disable-line no-undef
        const me = st.players[0], opp = st.players[1];
        const mon = me.mons[0];
        const atk = Object.values(db.cards).filter((c) => c.ready && c.user === mon.species && c.kind === 'pow' && !(c.effects || []).length && c.guts > 0).sort((a, b) => a.guts - b.guts)[0];
        window.__mhBindAtk = atk ? { no: atk.no, name: atk.name, damage: atk.damage } : null;
        me.hand = [atk.no, '366', atk.no, atk.no, atk.no];
        me.guts = Array(9).fill(atk.no);
        opp.hand = ['109', '100', '100', '100', '100'];
        opp.guts = Array(3).fill('100');
        st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.active = 0; st.turn = 2; st.first = 0;
        me.breederUsed = false; me.mons.forEach((m) => { m.attacks = 0; });
        return st;
      };
    });
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
    await page.waitForFunction(() => document.querySelector('[data-card-battle]') && document.querySelector('[data-card-battle]').getAttribute('data-card-mode') === 'attack', null, { timeout: 20000 });
    const atk = await page.evaluate(() => window.__mhBindAtk);
    check('場面を作れた(先頭の子の文の無いちから技)', !!atk, JSON.stringify(atk));
    // 技を選んで、相手の1体目を狙う → 名指しの窓
    const openBind = async () => {
      await page.locator('[data-card-hand-card="0"]').click();
      await page.waitForTimeout(200);
      const user = page.locator('[data-card-mon].ring-amber-300').first();
      if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
      await page.locator('[data-card-mon="1-0"]').click();
      await page.waitForTimeout(300);
    };
    await openBind();
    const names = await page.locator('[data-card-bind-name]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-bind-name')));
    check('① 技を選んで相手を狙うと、名指しの窓が開く(守りの札の名前が並ぶ)', names.length >= 5 && names.includes('緊急回避'), `${names.length}個`);
    const usable = await page.locator('[data-card-bind-name][data-card-bind-usable="1"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-bind-name')));
    check('① 狙った子が使える守りが先に並ぶ(緊急回避は全モンスターの回避なので入る)', usable.includes('緊急回避') && names.slice(0, usable.length).every((x) => usable.includes(x)), usable.join('・'));
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'bind-pick.png') }); }
    const log0 = await page.locator('[data-card-log]').innerText().catch(() => '');
    const lifeOf = async () => { const t = await page.locator('[data-card-mon="1-0"]').innerText().catch(() => ''); const m = t.match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[1]) : null; };
    const life0 = await lifeOf();
    await page.locator('[data-card-bind-pick]').getByRole('button', { name: 'やめる' }).click();
    await page.waitForTimeout(300);
    const log1 = await page.locator('[data-card-log]').innerText().catch(() => '');
    const mode1 = await page.locator('[data-card-battle]').getAttribute('data-card-mode');
    check('② 「やめる」で閉じる。技は出ていない', (await page.locator('[data-card-bind-pick]').count()) === 0 && log1 === log0 && mode1 === 'attack', `窓 ${await page.locator('[data-card-bind-pick]').count()}・段 ${mode1}`);
    // もう一度開いて「緊急回避」を名指し
    // 「やめる」で選んでいた手札も外れている(そのまま選び直す)
    await openBind();
    const reopened = (await page.locator('[data-card-bind-pick]').count()) === 1;
    if (reopened) await page.locator('[data-card-bind-name="緊急回避"]').click();
    // 相手(コンピューター)が守るかを決めて、ダメージが入るまで待つ
    let logText = '', life1 = life0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(250);
      logText = await page.locator('[data-card-log]').innerText().catch(() => '');
      life1 = await lifeOf();
      if (life1 !== life0 || /回避した/.test(logText)) break;
    }
    // 相手の手札の守りは緊急回避だけ。名指しが効いていれば回避できず、技のダメージぶんライフが減る
    check('③ 「緊急回避」を名指しすると技が出て、相手は回避できずダメージが入る', reopened && life0 !== null && life0 - life1 === Math.min(life0, atk.damage) && !/回避した/.test(logText), `窓 ${reopened}・ライフ ${life0} → ${life1}`);
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
