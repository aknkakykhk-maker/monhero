// MFバトルカードのオプションの「対戦中の設定」(社長 2026-10-25「オプションでバトル中の設定関係を各種作って」)が、
// 実際の対戦で効くかを確かめる。設定を全部「いちばん変わる側」にして助手と1戦ぶん進める(ブレイブくんの頼み)。
//
//   node tools/card/card-battle-settings-browser-check.js
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-battle-settings-browser-check.js   オプションと確かめの窓の写真も撮る
//   CARD_VIEWPORT=320x568 … 画面の大きさ(既定 390x844)
//
// 見ているもの
//   ① オプションの設定が全部並び、どれもスクロールで届き、押すと mh_card_settings_v1 に入る(前からの項目は消えない)
//   ② 技を使う前の確認: 相手をタップすると窓が出る。「キャンセル」なら何も起きず、「使う」で技が出る
//   ③ ターン終了の確認: ガッツの番の「ターン終了」で窓が出て、「終わる」で番が相手へ移る
//   ④ ガッツにするカードのおすすめ: ガッツの番になると、何枚か選んだ状態で始まる
//   ⑤ 手札の並べ方「種類順」: ちから→かしこさ→特殊→回避→防御→ブリーダーの順に並ぶ(並べても出すカードは変わらない)
//   ⑥ 手札を運ぶ操作「使わない」: 指で運ぼうとしても、運ぶカードが出ない
//   ⑦ 対戦中のひとこと「出さない」: 吹き出しが1回も出ない / ダメージの数字「出さない」: 大きな数字が1回も出ない
//   ⑧ どこでも実行時エラーが出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9001;
const SHOT = process.env.CARD_SHOT_DIR || '';
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// いちばん変わる側(既定からいちばん離れた値)
const EXTREME = { motion: 'OFF', shake: 'OFF', damageNum: 'OFF', think: 'FAST2', resultWait: 'QUICK', bubble: 'OFF', confirmUse: 'ON', confirmEnd: 'ON', press: 'LONG', drag: 'OFF', gutsPick: 'ON', handText: 'LARGE', handSort: 'KIND', autoPass: 'OFF' };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: VW, height: VH } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__cardSetSeeded')) return;
    sessionStorage.setItem('__cardSetSeeded', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    localStorage.setItem('mh_debug_unlocked_v1', '1');
  });
  await page.addInitScript(quiet.eventStorySeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
  const shot = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('TAP TO START'))?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    for (let i = 0; i < 20; i++) {
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
      if (!clicked && await page.evaluate(() => !!document.querySelector('[data-home-card-battle]') && !document.querySelector('[role="dialog"]'))) break;
      await page.waitForTimeout(600);
    }
    await page.evaluate(() => document.querySelector('[data-home-card-battle]')?.click());
    await page.waitForSelector('[data-card-top]', { timeout: 20000 });
    if (await has('[data-card-top="starter"]')) {
      await page.click('[data-card-kit="powerful"]');
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
      await page.click('[data-card-quit]');
      await page.waitForTimeout(300);
      await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit'))?.click(); });
      await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 });
      await page.getByRole('button', { name: 'トップへ' }).click();
    }
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 });

    // ① オプション
    await page.click('[data-card-options-open]');
    await page.waitForSelector('[data-card-options]', { timeout: 8000 });
    if (SHOT) { await page.waitForTimeout(500); await shot('options-1'); }
    const keys = await page.evaluate(() => [...document.querySelectorAll('[data-card-setting]')].map((e) => e.getAttribute('data-card-setting')));
    check('① オプションに対戦中の設定が全部並ぶ', Object.keys(EXTREME).every((k) => keys.includes(k)) && keys.includes('quickAutoStart'), keys.join(','));
    for (const [k, v] of Object.entries(EXTREME)) {
      const btn = page.locator(`[data-card-setting="${k}"] [data-card-setting-option="${v}"]`);
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(120);
    }
    if (SHOT) {
      for (let n = 2; n <= 6; n++) {
        const more = await page.evaluate((i) => { const el = document.querySelector('[data-card-options] .mh-scroll'); if (!el) return false; const before = el.scrollTop; el.scrollTop = Math.min(el.scrollHeight, (i - 1) * (el.clientHeight - 40)); return el.scrollTop !== before || i === 2; }, n);
        if (!more) break;
        await page.waitForTimeout(250); await shot(`options-${n}`);
      }
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_settings_v1') || 'null'));
    const want = Object.fromEntries(Object.entries(EXTREME).map(([k, v]) => [k, k === 'autoPass' ? v === 'ON' : v]));
    check('① 押した設定が mh_card_settings_v1 に入り、前からの項目(quickAutoStart)も残る', !!saved && Object.entries(want).every(([k, v]) => saved[k] === v) && saved.quickAutoStart === false, JSON.stringify(saved));
    await page.evaluate(() => document.querySelector('[data-card-options] header button')?.click());
    await page.waitForSelector('[data-card-top="top"]', { timeout: 8000 });

    // 助手と対戦(みゅあ・EASY)
    await page.click('[data-card-cpu]');
    await page.click('[data-card-mode-assistant]');
    await page.waitForSelector('[data-card-foe="mua"]', { timeout: 8000 });
    await page.click('[data-card-foe="mua"]');
    await page.click('[data-card-start]');
    await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
    await page.waitForTimeout(800);

    let bubbles = 0, bigNums = 0, cancelOk = null, useOk = null, endOk = null, gutsPicked = null, dragBlocked = null, sorted = null, sortDetail = '';
    const deadline = Date.now() + 120000;
    let gutsTurns = 0;
    while (Date.now() < deadline && gutsTurns < 3) {
      bubbles += await page.locator('[data-card-bubble]').count();
      bigNums += await page.locator('[data-card-mon] span.text-\\[30px\\]').count();
      if (await has('[data-card-top="result"]')) break;
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
      if (!mode) break;
      if (await has('[data-confirm-sheet]')) { await page.waitForTimeout(150); continue; }
      if (mode === 'wait') { await page.waitForTimeout(120); continue; }
      if (mode === 'setup') { await page.getByRole('button', { name: /始める$/ }).click(); continue; }
      if (mode === 'discard') { const n = await page.locator('[data-card-hand-card]').count(); for (let i = 0; i < n; i++) await page.locator(`[data-card-hand-card="${i}"]`).click(); await page.getByRole('button', { name: /捨てる$/ }).click().catch(() => {}); continue; }
      if (mode === 'guard') { await page.getByRole('button', { name: '守らない' }).click().catch(() => {}); await page.waitForTimeout(200); continue; }
      if (mode === 'attack') {
        // ⑤ 並べ方: 画面の順に、カードの種類が並んでいるか
        if (sorted === null) {
          const r = await page.evaluate(() => {
            const rank = { pow: 0, int: 1, spe: 2, dge: 3, blk: 4 };
            const hand = [...document.querySelectorAll('[data-card-hand-card]')].map((el) => Number(el.getAttribute('data-card-hand-card')));
            return { hand };
          });
          const kinds = await page.evaluate((hand) => {
            const rank = { pow: 0, int: 1, spe: 2, dge: 3, blk: 4 };
            return hand.map((i) => {
              const img = document.querySelector(`[data-card-hand-card="${i}"] img`);
              const c = Object.values(CARD_BATTLE_DATA.cards).find((x) => x.name === (img && img.alt));
              return c ? (c.user === 'breeder' ? 9 : rank[c.kind]) : 10;
            });
          }, r.hand);
          sorted = kinds.every((k, i) => i === 0 || kinds[i - 1] <= k);
          sortDetail = `番号 ${r.hand.join(',')} / 種類 ${kinds.join(',')}`;
        }
        // ⑥ 運ぶ操作「使わない」: 指で動かしても運ぶカードが出ない
        if (dragBlocked === null) {
          const b = await page.locator('[data-card-hand-card]').first().boundingBox();
          const t = await page.locator('[data-card-mon^="1-"]').first().boundingBox();
          await page.mouse.move(b.x + b.width / 2, b.y + 20); await page.mouse.down();
          await page.mouse.move(b.x + b.width / 2 + 5, b.y - 30, { steps: 4 });
          await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 6 });
          dragBlocked = !(await has('[data-dragging-card]'));
          await page.mouse.up();
          await page.waitForTimeout(300);
          if (await has('[data-card-detail]')) await page.locator('[data-card-detail]').click({ position: { x: 10, y: 10 } });
          if (await has('[data-confirm-sheet]')) { await page.getByRole('button', { name: 'やめる' }).click().catch(() => {}); }
          continue;
        }
        // ② 技を使う前の確認: 使える技 → 狙える相手
        const usable = await page.evaluate(() => [...document.querySelectorAll('[data-card-hand-card]')].filter((el) => !/opacity-45/.test(el.className)).map((el) => el.getAttribute('data-card-hand-card')));
        let fired = false;
        // 同じ札を CARD_DOUBLE_TAP_MS(350ms)の内に2回押すと詳しい画面が開き、狙う相手は1回目を 350ms 待ってから決まる(#3873)。
        //   押し直し・決まるのを見るときは、その間より長く待つ
        const TAP_GAP = 450;
        for (const i of usable) {
          await page.locator(`[data-card-hand-card="${i}"]`).click();
          await page.waitForTimeout(TAP_GAP);
          const tgt = page.locator('[data-card-mon].ring-rose-400').first();
          if (!(await tgt.count())) { if (await page.getByRole('button', { name: '使う' }).count()) { await page.getByRole('button', { name: '使う' }).click(); fired = true; break; } await page.locator(`[data-card-hand-card="${i}"]`).click(); continue; }
          const logBefore = await page.locator('[data-card-log]').textContent();
          await tgt.click();
          await page.waitForTimeout(TAP_GAP);
          const sheet = await has('[data-confirm-sheet]');
          if (sheet && cancelOk === null) {
            if (SHOT) await shot('confirm-use');
            await page.getByRole('button', { name: 'やめる' }).click();
            await page.waitForTimeout(250);
            cancelOk = (await page.locator('[data-card-log]').textContent()) === logBefore && !(await has('[data-confirm-sheet]'));
            await tgt.click(); await page.waitForTimeout(TAP_GAP);
          }
          if (await has('[data-confirm-sheet]')) {
            await page.locator('[role="dialog"] button, [data-confirm-sheet] ~ div button').filter({ hasText: /^使う$/ }).first().click().catch(async () => { await page.getByRole('button', { name: '使う' }).last().click(); });
            await page.waitForTimeout(400);
            if (useOk === null) useOk = (await page.locator('[data-card-log]').textContent()) !== logBefore;
          } else if (useOk === null) useOk = false;
          fired = true;
          break;
        }
        if (!fired) await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click().catch(() => {});
        await page.waitForTimeout(250);
        continue;
      }
      if (mode === 'guts') {
        await page.waitForTimeout(300);
        const label = (await page.locator('[data-card-footer] button').first().innerText().catch(() => '')) || '';
        if (gutsPicked === null) gutsPicked = /枚をガッツにして/.test(label);
        await page.locator('[data-card-footer] button').first().click();
        await page.waitForTimeout(250);
        const sheet = await has('[data-confirm-sheet]');
        if (sheet && endOk === null && SHOT) await shot('confirm-end');
        if (sheet) await page.getByRole('button', { name: '終わる' }).click().catch(() => {});
        await page.waitForTimeout(500);
        const after = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
        if (endOk === null) endOk = sheet && after !== 'guts';
        gutsTurns += 1;
        continue;
      }
      await page.waitForTimeout(150);
    }
    check('② 技を使う前の確認: 窓が出て、「やめる」なら何も起きない', cancelOk === true, String(cancelOk));
    check('② 技を使う前の確認: 「使う」で技が出る', useOk === true, String(useOk));
    check('③ ターン終了の確認: 窓が出て、「終わる」で相手の番へ移る', endOk === true, String(endOk));
    check('④ ガッツにするカードのおすすめ: 何枚か選んだ状態で始まる', gutsPicked === true, String(gutsPicked));
    check('⑤ 手札の並べ方「種類順」: 種類の順に並ぶ', sorted === true, sortDetail);
    check('⑥ 手札を運ぶ操作「使わない」: 運ぶカードが出ない', dragBlocked === true, String(dragBlocked));
    check('⑦ 対戦中のひとこと「出さない」: 吹き出しが出ない', bubbles === 0, `${bubbles}回`);
    check('⑦ ダメージの数字「出さない」: 大きな数字が出ない', bigNums === 0, `${bigNums}回`);
    check('⑧ 操作中に実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
