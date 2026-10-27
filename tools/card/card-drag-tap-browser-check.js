#!/usr/bin/env node
// MFバトルカード: 手札を運ぶ(ドラッグ)と、タップ・ボタンで出したときの手が食い違わないか(2026-10-27 総点検・カード部)。
//
//   node tools/card/card-drag-tap-browser-check.js
//   CARD_PORT=<番号>(既定 8997)・SHOT_DIR=<フォルダ> で写真(drag-tap-*.png)
//
// 【なぜ要るか】
// ソラシドさんの報告で、組み合わせを選んでから運ぶと、選んだ組み合わせではなく全部付いて出る食い違いが見つかった(#4031)。
// 運ぶときの置き先(84 の dropTargetsOf)は、置き先ごとに手を1つ決めてしまうので、タップでは「選ぶ」段がある手を、運ぶと選ばずに出すことがある。
//
// 見ているもの(助手と対戦の始まりを、検査のときだけの口 window.__mhCardScene で決めた場面にする。マウスで運ぶ。指も同じ pointer の処理)
//   A ショットガン(割り振り): タップは割り振りを選ぶ画面が出る / 運んでも、選ぶ画面が出る(選ばずに出さない)
//   B 変形(空中か地上か): タップは空中・地上のボタン / 運んでも、どちらかを選ばずに出さない
//   C 加勢(使う子が3体): 子を選んでから運ぶと、選んだ子で出る
//   D 隠れる(守りの移す先): タップは移す先の味方を選ぶ / 運んで置いた味方へ移す(置き先と移す先がそろう)
//   E 友をかばう(かばう子): 運んで置いた子がかばう(タップとそろう)
//   どれも実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8997;
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

// 場面: mons … 自分の3体(種族)/ hand … 自分の手札 / attackMe … 相手が自分の何番を狙った守りの番にする(無ければ自分の攻撃の番)
// 場面の中身は文字にして addInitScript へ渡す(ページの中で、ゲームの関数を使って作る)
const sceneScript = (spec) => `(() => {
  const spec = ${JSON.stringify(spec)};
  window.__mhCardScene = (st) => {
    const db = CARD_BATTLE_DATA;
    const monOf = (sp) => Object.values(db.monsters).find((m) => m.species === sp && !m.main && !m.variant).no;
    const g = cardCreateGame(db, { decks: [{ monsters: spec.mons.map(monOf), cards: Array(50).fill('100') }, { monsters: ['C-003', 'C-001', 'C-005'], cards: Array(50).fill('100') }], seed: 3, first: 0 });
    st.players[0].mons = g.players[0].mons; st.players[1].mons = g.players[1].mons;
    const me = st.players[0], opp = st.players[1];
    me.hand = spec.hand.slice(); me.guts = Array(9).fill('100');
    opp.hand = ['100', '100', '100', '100', '100']; opp.guts = Array(9).fill('100');
    [me, opp].forEach((pl) => pl.mons.forEach((x) => { x.max = 20; x.life = 20; x.attacks = 0; }));
    st.phase = 'main'; st.pending = null; st.pendingDiscard = null; st.turn = 2; st.first = 0;
    me.breederUsed = false; opp.breederUsed = false;
    if (spec.attackMe !== undefined) {
      // 相手の番にして、文の無いちから技で自分の spec.attackMe 番を狙わせる(守りの番)
      st.active = 1;
      const atk = Object.values(db.cards).find((c) => c.ready && c.user === opp.mons[0].species && c.kind === 'pow' && !(c.effects || []).length && c.damage > 0);
      opp.hand = [atk.no, '100', '100', '100', '100'];
      const o = cardAttackOptions(db, st).find((x) => x.hand.length === 1 && x.hand[0] === 0 && x.mon === 0 && x.target && x.target.p === 0 && x.target.m === spec.attackMe);
      st = cardApplyAction(db, st, o) || st;
    } else st.active = 0;
    return st;
  };
})();`;

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const open = async (spec) => {
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
    await page.addInitScript(sceneScript(spec));
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
    const want = spec.attackMe !== undefined ? 'guard' : 'attack';
    await page.waitForFunction((w) => { const b = document.querySelector('[data-card-battle]'); return b && b.getAttribute('data-card-mode') === w; }, want, { timeout: 20000 });
    await page.waitForTimeout(400);
    return page;
  };
  const handCount = (pg) => pg.evaluate(() => document.querySelectorAll('[data-card-hand-card]').length);
  const mouseDrag = async (pg, from, to) => {
    const a = await pg.locator(from).boundingBox(), b = await pg.locator(to).boundingBox();
    await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await pg.mouse.down();
    for (let k = 1; k <= 12; k++) { await pg.mouse.move(a.x + a.width / 2 + ((b.x + b.width / 2) - (a.x + a.width / 2)) * k / 12, a.y + a.height / 2 + ((b.y + b.height / 2) - (a.y + a.height / 2)) * k / 12); await pg.waitForTimeout(16); }
    await pg.mouse.up();
  };
  const settle = async (pg, n0) => { for (let i = 0; i < 20; i++) { await pg.waitForTimeout(150); if ((await handCount(pg)) !== n0) break; } await pg.waitForTimeout(500); };
  // ターンの記録(いちばん新しいターン)の文
  const lastLog = async (pg) => {
    await pg.locator('[data-card-log-open]').first().dispatchEvent('click');
    await pg.locator('[data-card-log-sheet]').waitFor({ timeout: 5000 });
    const t = await pg.locator('[data-card-log-turn]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')).join(' / '));
    await pg.keyboard.press('Escape').catch(() => {});
    await pg.locator('[data-card-log-sheet]').dispatchEvent('click').catch(() => {});
    return t;
  };
  const lifeOf = (pg, key) => pg.locator(`[data-card-mon="${key}"]`).innerText().then((t) => { const m = t.match(/(\d+)\s*\/\s*20/); return m ? Number(m[1]) : null; });
  const shot = async (pg, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, `drag-tap-${name}.png`) }); } };
  try {
    // ---- A ショットガン(ピクシー・054): タップは割り振りを選ぶ / 運んでも選ばずに出さない ----
    let page = await open({ mons: ['pixie', 'golem', 'tiger'], hand: ['054', '100', '100', '100', '100'] });
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    check('A タップ: ショットガンを押すと「割り振る」ボタンが出る', await page.locator('[data-card-split-open]').count() > 0);
    await page.locator('[data-card-hand-card="0"]').click(); // 選び外す
    await page.waitForTimeout(200);
    let log = '';
    let n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="1-1"]');
    await page.waitForTimeout(600);
    await shot(page, 'a-split');
    let n1 = await handCount(page);
    const splitSheet = await page.locator('[data-card-split-pick]').count();
    check('A 運ぶ: ショットガンを相手へ運ぶと、割り振りを選ぶ画面が出る(選ばずに出さない)', n1 === n0 && splitSheet > 0, `手札 ${n0}→${n1}・選ぶ画面 ${splitSheet}${n1 !== n0 ? `・出た手: ${await lastLog(page)}` : ''}`);
    await page.close();

    // ---- B 変形(ヘンガー・185): タップは空中・地上のボタン / 運んでも選ばずに出さない ----
    page = await open({ mons: ['henger', 'golem', 'tiger'], hand: ['185', '100', '100', '100', '100'] });
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    const formBtns = await page.locator('[data-card-form]').count();
    check('B タップ: 変形を押すと、空中・地上のボタンが出る', formBtns === 2, `${formBtns} 個`);
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(200);
    n0 = await handCount(page);
    // 置き先は使う子(自分)。変形は1枚引くので手札の数は変わらない。ターンの記録で、出たかを見る
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="0-0"]');
    await page.waitForTimeout(800);
    await shot(page, 'b-form');
    log = await lastLog(page);
    const formAsk = await page.locator('[data-card-form]').count();
    check('B 運ぶ: 変形を運んでも、空中か地上かを選ばずに出さない(ボタンで選ぶ)', !/「変形」/.test(log) && formAsk === 2, `選ぶボタン ${formAsk}・${log.slice(-120)}`);
    await page.close();

    // ---- C 加勢(ブリーダー・112・使う子が3体): 子を選んでから運ぶと、選んだ子で出る ----
    page = await open({ mons: ['golem', 'tiger', 'pixie'], hand: ['112', '100', '100', '100', '100'] });
    await page.locator('[data-card-hand-card="0"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-card-mon="0-2"]').click(); // 3番目の子(ピクシー)を選ぶ
    await page.waitForTimeout(300);
    await shot(page, 'c-picked');
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="1-0"]');
    await settle(page, n0);
    log = await lastLog(page);
    check('C 運ぶ: 加勢で出どころの子(ピクシー)を選んでから運ぶと、ピクシーで出る', /ピクシー/.test(log), log.slice(-160));
    await page.close();
    // 選ばずに運ぶとき(参考): どの子で出るか
    page = await open({ mons: ['golem', 'tiger', 'pixie'], hand: ['112', '100', '100', '100', '100'] });
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="1-0"]');
    await settle(page, n0);
    log = await lastLog(page);
    console.log(`参考: 加勢を何も選ばずに運ぶと — ${log.slice(-160)}`);
    await page.close();

    // ---- D 隠れる(モッチー・107): 守りの番。運んで置いた味方へ目標を移す ----
    page = await open({ mons: ['mocchi', 'golem', 'tiger'], hand: ['107', '100', '100', '100', '100'], attackMe: 0 });
    await shot(page, 'd-guard');
    const lives0 = [await lifeOf(page, '0-1'), await lifeOf(page, '0-2')];
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="0-1"]'); // ゴーレムへ移すつもりで、ゴーレムへ運ぶ
    await settle(page, n0);
    n1 = await handCount(page);
    if (n1 === n0) {
      // ゴーレムは置き先ではなかった。狙われた子(モッチー)へ運ぶと、どこへ移るか
      await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="0-0"]');
      await settle(page, n0);
    }
    await page.waitForTimeout(1500);
    log = await lastLog(page);
    const lives1 = [await lifeOf(page, '0-1'), await lifeOf(page, '0-2')];
    check('D 運ぶ: 隠れるをゴーレムへ運ぶと、ゴーレムへ目標が移る(タップで移す先を選ぶのとそろう)', n1 !== n0 && /ゴーレム/.test(log), `ゴーレムが置き先 ${n1 !== n0}・ライフ ゴーレム ${lives0[0]}→${lives1[0]} タイガー ${lives0[1]}→${lives1[1]}・${log.slice(-160)}`);
    await page.close();

    // ---- E 友をかばう(ゴーレム・036): タイガーが狙われ、ゴーレムへ運ぶとゴーレムがかばう ----
    page = await open({ mons: ['tiger', 'golem', 'pixie'], hand: ['036', '100', '100', '100', '100'], attackMe: 0 });
    n0 = await handCount(page);
    await mouseDrag(page, '[data-card-hand-card="0"]', '[data-card-mon="0-1"]');
    await settle(page, n0);
    n1 = await handCount(page);
    await page.waitForTimeout(1500);
    log = await lastLog(page);
    check('E 運ぶ: 友をかばうをゴーレムへ運ぶと、ゴーレムがかばう', n1 !== n0 && /ゴーレム/.test(log), `手札 ${n0}→${n1}・${log.slice(-160)}`);
    await page.close();

    check('どこでも実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    console.log(`NG: 途中で止まった — ${e.message.split('\n')[0]}`);
    failed++;
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
