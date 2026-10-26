// MFバトルカード: 対戦の結果を書くとき、ほかの画面が書いた解放・記録を古い中身で上書きしないか(実際のブラウザ)。
// 2026-10-26 社長「ノーマルクリアしてハード解放したのに、いつのまにか消えてた」。
//   カードの画面は開いたときに読んだ中身を持ち続けるので、同じ端末でゲームを2つ開いていたり、解放の前から開きっぱなしの画面で
//   勝ったりすると、古い中身で解放・記録を上書きしていた(直す前の main で、5勝が1勝に・勝ちの印と HARD の勝ちが消えるのを確かめた)。
//   84 の freshCardSave で、書く直前に読み直した値の上に足す。
//
//   node tools/card/card-save-fresh-browser-check.js        (配信は自分で立てる。CARD_PORT で番号を変えられる)
//
// 見るもの: 画面を開いたあとに、ほかの画面が「EXPERT まで開いた・5勝・ドラに勝った」を書く → NORMAL で1回勝つ →
//   解放は EXPERT まで残り、記録は 6勝・ドラの勝ちの印・HARD の勝ち数が残る
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8993;
const http = require('http');
const fs = require('fs');
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
(async () => {
  const server = await serve();
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  });
  await page.addInitScript(eventStorySeed());
  await page.addInitScript(() => {
    // 対戦の始まりを「相手は全員倒れていて、自分が勝った」場にする(自分の番は8回ぶん)
    window.__mhCardScene = (st) => { st.players[1].mons.forEach((m) => { m.ko = true; m.life = 0; }); st.turn = 16; st.first = 0; st.winner = 0; return st; };
  });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 8; i++) { const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (!(await btn.count()) || !(await btn.isVisible().catch(() => false))) break; await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
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
  // ★この画面が読み込んだあとに、ほかの画面(2つ目のタブ)が「EXPERT まで開いた・5勝した」を書いた、とする
  await page.evaluate(() => {
    localStorage.setItem('mh_card_cpu_unlocked_v1', JSON.stringify({ hard: true, expert: true, master: false }));
    const rec = JSON.parse(localStorage.getItem('mh_card_record_v1') || '{}');
    rec.cpu = { win: 5, lose: 0, surrender: 0 }; rec.beaten = { ...(rec.beaten || {}), dra: true };
    rec.byLevel = { win: { easy: 0, normal: 2, hard: 3, expert: 0, master: 0 }, lose: {} };
    localStorage.setItem('mh_card_record_v1', JSON.stringify(rec));
  });
  await page.locator('[data-card-cpu]').click();
  await page.locator('[data-card-mode-assistant]').click();
  await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
  await page.locator('[data-card-foe="mua"]').click();
  await page.locator('[data-card-level="normal"]').click();
  await page.locator('[data-card-start]').click();
  await page.locator('[data-card-top="result"]').waitFor({ timeout: 30000 });
  const after = await page.evaluate(() => ({ unlocked: JSON.parse(localStorage.getItem('mh_card_cpu_unlocked_v1')), rec: JSON.parse(localStorage.getItem('mh_card_record_v1')) }));
  console.log('-- 解放:', JSON.stringify(after.unlocked));
  console.log('-- 記録の勝ち:', after.rec.cpu && after.rec.cpu.win, ' 勝ちの印:', Object.keys(after.rec.beaten || {}).join(','), ' NORMAL勝ち:', after.rec.byLevel.win.normal, ' HARD勝ち:', after.rec.byLevel.win.hard);
  const ok = after.unlocked.hard && after.unlocked.expert && after.rec.cpu.win === 6 && after.rec.beaten.dra && after.rec.byLevel.win.hard === 3;
  console.log(`${ok ? 'OK' : 'NG'}: ほかの画面が書いた解放・記録を消さずに、その上に足す`);
  console.log(`${errs.length ? 'NG' : 'OK'}: 実行時エラーが出ない${errs.length ? ` — ${errs.slice(0, 2).join(' / ')}` : ''}`);
  await b.close();
  server.close();
  console.log(ok && !errs.length ? '\nすべてOK' : '\nNG があります');
  process.exit(ok && !errs.length ? 0 : 1);
})().catch((e) => { console.log(`NG: 途中で止まらずに最後まで進む — ${String(e && e.message || e).split('\n')[0]}`); process.exit(1); });
