const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトルのれんしゅうを「はじめの1戦」と「つづき」に分けた作り(2026-11-11 社長 1=A・2=A)を、実際のブラウザで通す。
//
//   ① ヘルプの「はじめの1戦」から始めて、ガード → 攻撃 → 固有技でクリアし、強化を選んで最後まで通せる
//   ② 通し終えたら mh_battle_tutorial_first_v1.done が立ち、「全部見た」(mh_battle_tutorial_seen_v1)は立たない
//   ③ ふだんのバトルを初めて遊ぶと、仕組み・モード・難易度の3画面に一言が1回ずつ出る(二度は出ない)
//   ④ ふだんのバトルを1回遊んで HOME へ戻ると「つづき」の誘いが1回だけ出る(印 offered が立つ・二度目は出ない)
//   ⑤ 誘いから「つづき」を始めると勇者モン選択から始まり、「やめる」で HOME へ帰る(既読は書き換えない)
//   ⑥ 縦 390・横 844・🔄横 667 のどれでも、はじめの1戦を最後まで通せる。実行時エラーが出ない
//
// 止め絵: docs/progress/battle-tutorial-split/ (縦・横・🔄横)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8987;
const SHOT_DIR = path.join(root, 'docs/progress/battle-tutorial-split');
const SHOTS = process.argv.includes('--shots');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const VIEWS = [[390, 844, '縦'], [844, 390, '横'], [667, 375, '🔄横']];

const bootPage = async (browser, w, h, errors) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
    localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
    localStorage.setItem('mh_onboarded', JSON.stringify(true));
    localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
    localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(false));
    localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
    localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
    localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  });
  await page.addInitScript(eventStorySeed());
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: `
    .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
    .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
  ` });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  await closePopups(page);
  return page;
};

const closePopups = async (page) => {
  for (let i = 0; i < 6; i++) {
    const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(250);
  }
};

const ls = (page, key) => page.evaluate((k) => {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return localStorage.getItem(k); }
}, key);

const bubbleText = (page) => page.evaluate(() => {
  const box = document.querySelector('[aria-label="バトルチュートリアル"]');
  return box ? box.textContent.replace(/\s+/g, ' ').trim() : null;
});
const clickText = async (page, re) => page.evaluate((s) => {
  const rx = new RegExp(s);
  const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()) && !x.disabled);
  if (!b) return false;
  b.click(); return true;
}, re);

// 手札はドラッグにも対応しているので pointerdown → pointerup で選ぶ(click では選べない)
const tapHandCard = async (page, pattern) => {
  const pos = await page.evaluate((s) => {
    const rx = new RegExp(s);
    const cards = [...document.querySelectorAll('[data-hand-card]')].filter(x => x.getAttribute('data-card-usable') !== 'false');
    const card = cards.find(x => rx.test(x.getAttribute('data-card-type') || '')) || cards.find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ')));
    if (!card) return null;
    const r = card.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:1, pointerType:'touch', isPrimary:true }));
    return { x, y };
  }, pattern);
  if (!pos) return false;
  await page.waitForTimeout(250);
  await page.evaluate((p) => {
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles:true, cancelable:true, clientX:p.x, clientY:p.y, pointerId:1, pointerType:'touch', isPrimary:true }));
  }, pos);
  await page.waitForTimeout(300);
  return true;
};

// 選ぶ画面からバトルまで(れんしゅう中でも、ふだんでも同じ押し方)。押せたら何を押したかを返す
const NEED_CARD = { guard: 'ガード', atk: '攻撃', unique: '固有' };
const driveOnce = async (page, log) => {
  const t = await bubbleText(page);
  // 「次へ」「おわる」系(吹き出しの大きいボタン)
  if (t) {
    const next = page.locator('[aria-label="バトルチュートリアル"] button').filter({ hasText: /^(次へ|.*おわる.*|.*終わる.*|.*とじる.*|.*OK.*)$/ });
    if (await next.count()) { await next.last().dispatchEvent('click'); await page.waitForTimeout(250); log.push(`next:${t.slice(0, 16)}`); return 'next'; }
  }
  const state = await page.evaluate(() => ({
    sys: !!document.querySelector('[data-battle-system="systemClassic"]'),
    diff: /BATTLE DIFFICULTY/.test(document.body.innerText),
    mode: !!document.querySelector('[data-battle-mode="challenge"]'),
    hero: /勇者モンを選ぶ/.test(document.body.innerText),
    battle: !!document.querySelector('[data-battle-action]'),
    spotCard: (() => { const s = document.querySelector('.is-battle-tutorial-spot [data-hand-card], [data-hand-card].is-battle-tutorial-spot'); return s ? (s.innerText || '').replace(/\s+/g, ' ') : null; })(),
    body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 4000),
  }));
  if (state.sys && !state.mode) { await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click'); log.push('system'); return 'system'; }
  if (state.mode && !state.diff) {
    await page.locator('article').filter({ hasText: 'チャレンジモード' }).first().getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
    log.push('mode'); return 'mode';
  }
  if (state.diff) {
    await page.locator('.snap-mandatory > article').filter({ hasText: 'Beginner' }).first().getByRole('button', { name: 'この難易度で挑戦' }).dispatchEvent('click');
    log.push('diff'); return 'diff';
  }
  if (state.battle) {
    // 吹き出しが消えて操作待ち。光っているカード(無ければ使えるカード)を選んで、勇者モンの枠 → ACTION
    // 台本の順: ガード → 攻撃 → 固有技(トドメ)。いま光っている吹き出しの見出しで決める
    const bt = (await page.evaluate(() => { const el = document.querySelector('[aria-label="バトルチュートリアル"]'); return el ? el.textContent : ''; })) || '';
    const need = /トドメ|固有/.test(bt) ? '^unique$' : /ガード/.test(bt) ? '^guard$' : '^atk$';
    const picked = await tapHandCard(page, need);
    await page.evaluate(() => { const el = document.querySelector('[data-slot-index="1"]'); if (el) el.click(); });
    await page.waitForTimeout(300);
    const acted = await page.evaluate(() => { const b = document.querySelector('[data-battle-action]'); if (!b || b.disabled) return false; b.click(); return true; });
    log.push(`card:${need || 'any'}:${picked}:${acted}${acted ? '' : `:${String(t).slice(0, 50)}:${await page.evaluate(() => [...document.querySelectorAll('[aria-label="バトルチュートリアル"] button')].map(x => x.innerText.trim()).join(','))}`}`);
    await page.waitForTimeout(acted ? 3500 : 400);
    return acted ? 'card' : 'stuck';
  }
  if (await clickText(page, '^次へ進む')) { log.push('waveNext'); await page.waitForTimeout(600); return 'waveNext'; }
  if (state.hero) {
    const card = page.locator('button').filter({ hasText: 'モッチー' }).first();
    if (await card.count()) {
      await card.dispatchEvent('click'); await page.waitForTimeout(400);
      await page.locator('button').filter({ hasText: /^勇者モンに選ぶ$/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(500); log.push('hero'); return 'hero';
    }
  }
  if (await clickText(page, '^近距離')) { log.push('slot'); await page.waitForTimeout(500); return 'slot'; }
  if (await clickText(page, '^ニコラオの力')) {
    await page.waitForTimeout(300); await clickText(page, '^習得する$');
    log.push('teach'); await page.waitForTimeout(3000); return 'teach';
  }
  // 強化は札を選んでから「決定する」
  if (await clickText(page, '^決定する$')) { log.push('decide'); await page.waitForTimeout(800); return 'decide'; }
  // 強化の3択(光っている札)
  const reward = await page.evaluate(() => {
    const el = document.querySelector('.is-battle-tutorial-spot button, button.is-battle-tutorial-spot');
    if (!el) return false; el.click(); return (el.innerText || '').replace(/\s+/g, ' ').slice(0, 30) || el.outerHTML.slice(0, 80);
  });
  if (reward) { log.push(`spot:${reward}:${String(t).slice(0, 30)}:${await page.evaluate(() => [...document.querySelectorAll('button')].filter(x => x.offsetParent && !x.disabled).map(x => x.innerText.replace(/\s+/g, ' ').slice(0, 12)).join('|'))}`); await page.waitForTimeout(600); return 'spot'; }
  log.push('idle');
  await page.waitForTimeout(500);
  return 'idle';
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  if (SHOTS) fs.mkdirSync(SHOT_DIR, { recursive: true });

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const [w, h, tag] of VIEWS) {
      const page = await bootPage(browser, w, h, errors);
      // --- ① ヘルプの「はじめの1戦」から始める ---
      await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
      const helpCard = page.getByRole('button', { name: /バトルのれんしゅう/ }).first();
      await helpCard.waitFor({ timeout: 15000 });
      await helpCard.dispatchEvent('click');
      await page.locator('[data-battle-tutorial-launch-first]').dispatchEvent('click', {}, { timeout: 15000 });
      await page.waitForTimeout(600);
      const firstBubble = await bubbleText(page);
      check(`[${tag}] はじめの1戦が仕組みえらびから始まる`, !!firstBubble && firstBubble.includes('はじめの1戦'), String(firstBubble).slice(0, 40));
      const log = [];
      let ended = false;
      const titles = new Set();
      for (let i = 0; i < 90; i++) {
        const t = await bubbleText(page);
        if (t) titles.add(t.slice(0, 24));
        if (t && t.includes('はじめの1戦、ばっちり')) {
          if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `first-end-${tag}.png`) });
          await driveOnce(page, log);
          ended = true; break;
        }
        if (SHOTS && t && /カード → ACTION/.test(t)) await page.screenshot({ path: path.join(SHOT_DIR, `first-cards-${tag}.png`) });
        const r = await driveOnce(page, log);
        if (r === 'idle' && log.slice(-6).every(x => x === 'idle')) break;
      }
      check(`[${tag}] はじめの1戦を最後まで通せる`, ended, ended ? `${log.length}手` : log.slice(-8).join(' / '));
      await page.waitForTimeout(800);
      const first = await ls(page, 'mh_battle_tutorial_first_v1');
      const seen = await ls(page, 'mh_battle_tutorial_seen_v1');
      check(`[${tag}] 通すと「はじめの1戦」の印が立つ`, !!first && first.done === true, JSON.stringify(first));
      check(`[${tag}] はじめの1戦では「全部見た」を立てない`, seen === false, JSON.stringify(seen));
      check(`[${tag}] 通したあと HOME へ帰る`, await page.getByRole('button', { name: 'モンヒロバトル' }).isVisible().catch(() => false));

      if (tag === '縦') {
        // --- ③ ふだんのバトルを初めて遊ぶ。3画面に一言が1回ずつ出る ---
        await closePopups(page);
        const hints = [];
        await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click');
        for (const key of ['system', 'mode', 'difficulty']) {
          const hint = page.locator(`[data-battle-select-hint="${key}"]`);
          const shown = await hint.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
          hints.push(shown);
          if (shown && SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `hint-${key}-${tag}.png`) });
          if (shown) await page.locator('[data-battle-select-hint-close]').dispatchEvent('click');
          await page.waitForTimeout(300);
          await driveOnce(page, []);
          await page.waitForTimeout(500);
        }
        check('ふだん初めて開くと、仕組み・モード・難易度の3画面に一言が出る', hints.every(Boolean), JSON.stringify(hints));
        const f2 = await ls(page, 'mh_battle_tutorial_first_v1');
        check('一言を出した画面は印が付き、はじめの1戦の印は残る',
          !!f2 && f2.done === true && f2.hints && f2.hints.system && f2.hints.mode && f2.hints.difficulty, JSON.stringify(f2));
        // 勇者えらび → 距離 → 助っ人 → バトル画面まで
        const log2 = [];
        for (let i = 0; i < 12; i++) {
          if (await page.locator('[data-battle-action]').count()) break;
          await driveOnce(page, log2);
        }
        check('ふだんのバトルが始まる', await page.locator('[data-battle-action]').count() >= 1, log2.join(' / '));
        // バトルを遊んだらやめて HOME へ戻る(メニュー → あきらめる)
        await page.waitForTimeout(800);
        await page.locator('[aria-label="設定（BGM・ヘルプ・あきらめる）"]').first().dispatchEvent('click');
        await page.waitForTimeout(400);
        await clickText(page, '^あきらめる$');
        await page.waitForTimeout(400);
        const quit = await clickText(page, '^降参する$');
        await page.waitForTimeout(1500);
        const after = [];
        for (let i = 0; i < 8; i++) {
          if (await page.getByRole('button', { name: 'モンヒロバトル' }).isVisible().catch(() => false)) break;
          const b = await page.evaluate(() => {
            const x = [...document.querySelectorAll('button')].find(e => e.offsetParent && !e.disabled && /HOME|ホーム|トップ|戻る|閉じる|タイトル/.test(e.innerText || ''));
            if (!x) return null; x.click(); return x.innerText.replace(/\s+/g, ' ').slice(0, 16);
          });
          after.push(b);
          await page.waitForTimeout(900);
        }
        const offer = page.locator('[data-battle-more-start]');
        const offered = await offer.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        check('ふだんのバトルのあと HOME で「つづき」の誘いが出る', offered, `${quit} / ${after.join(',')}`);
        if (SHOTS && offered) await page.screenshot({ path: path.join(SHOT_DIR, `more-offer-${tag}.png`) });
        const more = await ls(page, 'mh_battle_tutorial_more_v1');
        check('誘いを出したら印 offered が立つ', !!more && more.offered === true, JSON.stringify(more));

        // --- ⑤ つづきを始める ---
        await offer.dispatchEvent('click');
        await page.waitForTimeout(800);
        const moreBubble = await bubbleText(page);
        check('「つづき」は勇者モン選択から始まる',
          !!moreBubble && moreBubble.includes('つづきのれんしゅう') && /勇者モンを選ぶ/.test(await page.evaluate(() => document.body.innerText)),
          String(moreBubble).slice(0, 40));
        if (SHOTS) await page.screenshot({ path: path.join(SHOT_DIR, `more-start-${tag}.png`) });
        await page.locator('button').filter({ hasText: /^やめる$/ }).first().dispatchEvent('click');
        await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 15000 });
        check('「つづき」をやめると HOME へ帰り、既読は書き換えない', (await ls(page, 'mh_battle_tutorial_seen_v1')) === false);
        await page.waitForTimeout(1500);
        check('誘いは二度は出ない', await page.locator('[data-battle-more-start]').count() === 0);
      }
      await page.close();
    }
    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (errors.length) console.log(`  実行時エラー: ${errors[0]}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();
