// MFバトルカード: ガチャポイントとバトルカードカタログ(2026-10-27 社長。カード追加部パックくん)
//   node tools/card/card-gacha-check.js            … 計算だけ(すぐ終わる)
//   node tools/card/card-gacha-check.js --browser  … 実際の画面でも買う・交換する・使う(1〜2分)
//
// 見るもの
//   ① 保存が無い・壊れているときは 0。上限は無い(1万をこえても減らない)
//   ② 交換は 500 以上のときだけ。500 減って1冊。あまりは残る。目盛りは次の1冊まで(730 → 230)
//   ③ カタログで選べるのは、パックから出るカード全部(どの弾も)。パックから出ないカードは選べない
//   ④ 持てる数いっぱいのカードは選べない。冊数が0なら使えない。使うと1冊減って、そのカードが1枚増える
//   ⑤ 同じ保存から2回使おうとしても、2回目は前の結果の上で計算されるので、冊数より多くはもらえない
//   [画面] ⑥ 1パックで +10、5パックで +50(合わせて 60)。開ける画面を閉じて売り場を開き直しても増えない
//   [画面] ⑦ 交換の「交換する」を続けて2回押しても、1冊・500 減るだけ
//   [画面] ⑧ カタログの「もらう」を続けて2回押しても、1冊減って1枚増えるだけ
//   [画面] ⑨ スターターキットを買ってもガチャポイントは増えない・本番のランキングへは書かない(外へは GET だけ)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => { if (ok) passed++; else failed++; if (!ok || process.argv.includes('-v')) console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); };

// ---- 計算(82・89 を読み込んで呼ぶ) ----
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '89-card-pack.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_SAVE_KEYS, CARD_PACKS, CARD_TECH_KEEP_MAX, CARD_GACHA_PER_PACK, CARD_CATALOG_COST, cardNormalizeGacha, cardNormalizeCatalogs, cardGachaProgress, cardExchangeCatalog, cardCatalogPool, cardUseCatalog, cardPackIdOf };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
check('保存キーは新しい名前(mh_card_gacha_points_v1・mh_card_catalogs_v1)', E.CARD_SAVE_KEYS.gacha === 'mh_card_gacha_points_v1' && E.CARD_SAVE_KEYS.catalogs === 'mh_card_catalogs_v1');
check('1パック10・交換は500', E.CARD_GACHA_PER_PACK === 10 && E.CARD_CATALOG_COST === 500);
check('① 無い・壊れているときは 0', [undefined, null, 'abc', -5, NaN, {}, []].every((v) => E.cardNormalizeGacha(v) === 0 && E.cardNormalizeCatalogs(v) === 0));
check('① 上限は無い', E.cardNormalizeGacha(123456) === 123456 && E.cardNormalizeGacha('730') === 730);
check('② 499 では交換できない', E.cardExchangeCatalog({ gacha: 499, catalogs: 0 }) === null);
{ const r = E.cardExchangeCatalog({ gacha: 730, catalogs: 2 }); check('② 730 で交換すると 230 のこって3冊', r && r.gacha === 230 && r.catalogs === 3, JSON.stringify(r)); }
check('② 目盛りは次の1冊まで(730 → 230・500 → 0・120 → 120)', E.cardGachaProgress(730) === 230 && E.cardGachaProgress(500) === 0 && E.cardGachaProgress(120) === 120);
const pool = E.cardCatalogPool(db);
const packed = new Set(pool.map((x) => x.no));
const shouldBe = [...Object.values(db.cards).filter((c) => c.ready && E.cardPackIdOf(db, c.no)).map((c) => c.no), ...Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && E.cardPackIdOf(db, m.no)).map((m) => m.no)];
check('③ パックから出るカードは全部選べる(どの弾も・どのレア度も)', shouldBe.every((no) => packed.has(no)) && new Set(pool.map((x) => x.packId)).size === E.CARD_PACKS.length && ['normal', 'kira', 'alt'].every((r) => pool.some((x) => x.rarity === r)), `${packed.size}種類`);
check('③ 同じカードが2回並ばない', packed.size === pool.length);
const notPacked = Object.keys(db.cards).find((no) => !packed.has(no)) || Object.keys(db.monsters).find((no) => !packed.has(no));
check('③ パックから出ないカードは選べない', !notPacked || E.cardUseCatalog(db, notPacked, { catalogs: 3, collection: {} }) === null, notPacked || 'なし');
const tech = pool.find((x) => x.slot === 'tech'); const mon = pool.find((x) => x.slot === 'mon');
check('④ 冊数が0なら使えない', E.cardUseCatalog(db, tech.no, { catalogs: 0, collection: {} }) === null);
{ const r = E.cardUseCatalog(db, tech.no, { catalogs: 2, collection: { [tech.no]: 1 } }); check('④ 使うと1冊減って、そのカードが1枚増える', r && r.catalogs === 1 && r.collection[tech.no] === 2, JSON.stringify(r && { c: r.catalogs, n: r.collection[tech.no] })); }
check('④ 持てる数いっぱい(技は3枚・モンスターは1枚)は選べない', E.cardUseCatalog(db, tech.no, { catalogs: 2, collection: { [tech.no]: E.CARD_TECH_KEEP_MAX } }) === null && E.cardUseCatalog(db, mon.no, { catalogs: 2, collection: { [mon.no]: 1 } }) === null);
{ // ⑤ 1冊で2回: 1回目の結果の上で2回目を計算すると断られる
  const a = E.cardUseCatalog(db, tech.no, { catalogs: 1, collection: {} });
  const b = a && E.cardUseCatalog(db, pool[5].no, a);
  check('⑤ 1冊しかないとき、2回目は断られる', a && a.catalogs === 0 && b === null);
}

// ---- 画面 ----
const browser = async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); return; }
  const { eventStorySeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8979;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const writes = [];
  try {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    // ⑨ 本番のランキングへ書かない: 外へは GET だけ通す
    await page.route('**/*', (route) => { const rq = route.request(); const u = new URL(rq.url()); if (u.hostname === 'localhost' || rq.method() === 'GET') return route.continue(); writes.push(u.hostname); return route.abort(); });
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.addInitScript(eventStorySeed());
    const get = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return 'こわれ'; } }, k);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) { const x = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (!(await x.count()) || !(await x.isVisible().catch(() => false))) break; await x.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
    await page.waitForTimeout(800);
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
    await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    check('はじめはガチャポイントもカタログも保存に無い(公開前の分は入れない)', (await get('mh_card_gacha_points_v1')) === null && (await get('mh_card_catalogs_v1')) === null);
    await page.evaluate(() => localStorage.setItem('mh_rhythm_event_points_v1', JSON.stringify(20000)));
    const openShop = async () => { await page.locator('[data-card-market-open]').click(); await page.locator('[data-card-shop]').waitFor({ timeout: 10000 }); await page.waitForTimeout(300); };
    const backTop = async () => { await page.locator('[data-mh-screen] button').first().click(); await page.locator('[data-card-top="top"]').waitFor({ timeout: 10000 }); };
    const openPacks = async () => {
      await page.locator('[data-card-pack-open]').waitFor({ timeout: 10000 });
      for (let k = 0; k < 6; k++) {
        if (await page.locator('[data-card-pack-tear]').count()) await page.locator('[data-card-pack-tear]').dispatchEvent('click');
        await page.locator('[data-card-pack-open][data-card-pack-phase="open"]').waitFor({ timeout: 10000 });
        await page.locator('[data-card-pack-flip-all]').dispatchEvent('click').catch(() => {});
        await page.waitForFunction(() => !document.querySelectorAll('[data-card-pack-card][data-card-pack-flipped="0"]').length, null, { timeout: 30000 });
        if (await page.locator('[data-card-pack-next]').count()) { await page.locator('[data-card-pack-next]').dispatchEvent('click'); continue; }
        break;
      }
      await page.waitForTimeout(400);
      const line = await page.locator('[data-card-pack-gacha]').innerText().catch(() => '');
      await page.locator('[data-card-pack-done]').dispatchEvent('click');
      await page.locator('[data-card-shop]').waitFor({ timeout: 10000 });
      return line;
    };
    await openShop();
    const panel0 = await page.locator('[data-card-gacha]').count();
    const ex0 = await page.locator('[data-card-gacha-exchange]').isDisabled();
    check('帯がパックの札の上に出る・0 のときは交換を押せない', panel0 === 1 && ex0);
    await page.locator('[data-card-shop-buy="p1-1"]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '買って開ける' }).click();
    const line1 = await openPacks();
    const g1 = await get('mh_card_gacha_points_v1');
    await page.locator('[data-card-shop-buy="p2-5"]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '買って開ける' }).click();
    const line5 = await openPacks();
    const g6 = await get('mh_card_gacha_points_v1');
    await backTop(); await openShop();
    const g6b = await get('mh_card_gacha_points_v1');
    const shown = await page.locator('[data-card-gacha-point]').getAttribute('data-card-gacha-point');
    check('⑥ 1パックで +10、5パックで +50(合わせて 60)。開け終わって売り場を開き直しても増えない', g1 === 10 && g6 === 60 && g6b === 60 && shown === '60', JSON.stringify({ g1, g6, g6b, shown }));
    check('⑥ 開けたあとのまとめに「+10」「+50」と、いまの数・次の1冊まで', /\+10/.test(line1) && /いま 10/.test(line1) && /\+50/.test(line5) && /いま 60/.test(line5) && /あと 440/.test(line5), `${line1} / ${line5}`);
    // ⑨ スターターではたまらない
    await page.getByRole('tab', { name: 'スターター' }).click(); await page.waitForTimeout(300);
    await page.locator('[data-card-shop-starter]:not([data-card-shop-starter-owned]) [data-card-shop-starter-buy]').first().click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '買う' }).click();
    await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
    await page.locator('[data-card-shop]').waitFor({ timeout: 10000 });
    check('⑨ スターターキットを買ってもガチャポイントは増えない', (await get('mh_card_gacha_points_v1')) === 60);
    // ⑦ 交換を続けて2回
    await page.evaluate(() => localStorage.setItem('mh_card_gacha_points_v1', JSON.stringify(1030)));
    await backTop(); await openShop();
    await page.getByRole('tab', { name: 'パック' }).click().catch(() => {}); await page.waitForTimeout(300);
    const label = await page.locator('[data-card-gacha]').innerText();
    check('帯は上限に見えない書き方(1,030 をそのまま・次の1冊まで 30 / 500)', /1,030/.test(label) && /30 \/ 500/.test(label), label.replace(/\s+/g, ' '));
    await page.locator('[data-card-gacha-exchange]').click();
    const yes = page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '交換する' });
    await yes.waitFor({ timeout: 5000 });
    await yes.evaluate((el) => { el.click(); el.click(); });
    await page.waitForTimeout(1200);
    const afterEx = { g: await get('mh_card_gacha_points_v1'), c: await get('mh_card_catalogs_v1') };
    check('⑦ 「交換する」を続けて2回押しても、500 減って1冊だけ', afterEx.g === 530 && afterEx.c === 1, JSON.stringify(afterEx));
    // ⑧ カタログの「もらう」を続けて2回
    const col0 = await get('mh_card_collection_v1');
    await page.locator('[data-card-gacha-catalog]').click();
    await page.locator('[data-card-catalog]').waitFor({ timeout: 5000 });
    await page.locator('[data-card-catalog-pack="p8"]').click();
    const target = await page.locator('[data-card-catalog-item]:not([data-card-catalog-full])').first().getAttribute('data-card-catalog-item');
    await page.locator(`[data-card-catalog-item="${target}"]`).click();
    await page.locator('[data-card-catalog-take]').click();
    const take = page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: 'もらう' });
    await take.waitFor({ timeout: 5000 });
    await take.evaluate((el) => { el.click(); el.click(); });
    await page.waitForTimeout(1200);
    const col1 = await get('mh_card_collection_v1');
    const doneMsg = await page.locator('[data-card-catalog-done]').innerText().catch(() => '');
    const afterUse = { c: await get('mh_card_catalogs_v1'), before: (col0 || {})[target] || 0, after: (col1 || {})[target] || 0, others: Object.keys(col1 || {}).filter((k) => k !== target && (col1[k] || 0) !== ((col0 || {})[k] || 0)).length };
    check('⑧ 「もらう」を続けて2回押しても、1冊減って選んだカードが1枚増えるだけ', afterUse.c === 0 && afterUse.after === afterUse.before + 1 && afterUse.others === 0 && /手に入れました/.test(doneMsg), JSON.stringify({ target, ...afterUse, doneMsg }));
    check('⑧ カタログが0冊になると「もらう」は押せない', await page.locator('[data-card-catalog-take]').isDisabled());
    await page.locator('[data-card-catalog-close]').click();
    check('⑨ 本番のサーバーへ書く通信は止めた(止めた数を出すだけ)', true, `${writes.length}件`);
    check('画面でエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await b.close(); server.close(); }
};

(async () => {
  if (process.argv.includes('--browser')) await browser();
  if (failed) { console.log(`✗ ガチャポイントとカタログ: ${failed} 件 NG(${passed} 件 OK)`); process.exit(1); }
  console.log(`✓ ガチャポイントとカタログ: ${passed} 件すべて OK`);
})().catch((e) => { console.log(`NG: 最後まで動く — ${String(e.message || e).split('\n')[0]}`); process.exit(1); });
