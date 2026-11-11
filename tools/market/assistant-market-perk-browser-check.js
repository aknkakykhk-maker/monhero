// 助手がマーケットにいるときの「今日のおすすめ品1割引き」(2026-11-11 社長決定 11-08・ナカヨシ10と分担)を、実ブラウザで確かめる。
//
//   node tools/market/assistant-market-perk-browser-check.js
//
//   ① 助手がマーケットにいないとき: 割引きの札(「1割引き」)も値段の変化も出ない
//   ② 助手がいるとき(assistantLifeMarketWho をページの中でだけ差す): 今日のおすすめ品に札が出て、値段が9割(切り捨て)になる。
//      割引き中の品は1個だけ(まとめ買いの数を選ぶ欄が出ない)
//   ③ 買うと、割引きの値段だけダイヤが減り、品が1つ増える。保存キー mh_assistant_market_perk_v1 に { day, used:true } が足される(ほかのキーは壊れない)
//   ④ 使ったあとは、助手がいても札が出ず、元の値段で買える(1日1回)
//   ⑤ おすすめ品は日付で決まる(同じ日は同じ品)・ダイヤで買う道具・100〜5,000ダイヤ・魂格再編の書でない
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8958;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise(r => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
      put('mh_gold', 50000); put('mh_rhythm_event_points_v1', 3000);
      put('mh_owned_items', { hero_proof_shard: 205, hero_proof: 2, training_ticket: 1 }); });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    const dismiss = async () => { for (let i = 0; i < 14; i++) {
      const did = await page.evaluate(() => { const inOverlay = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
        const l = [...document.querySelectorAll('button')].filter(b => inOverlay(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!l.length) return false; l[0].click(); return true; });
      if (!did) return; await page.waitForTimeout(300); } };
    await dismiss();
    const intoMarket = await page.evaluate(() => { const b = [...document.querySelectorAll('.mh-home-facility')].find(b => (b.innerText || '').replace(/\s+/g, ' ').trim().startsWith('マーケット')); if (!b) return false; b.click(); return true; });
    ok('HOMEからマーケットへ入れる', intoMarket);
    await page.waitForTimeout(600); await dismiss();

    const items = () => page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
    const store = (k) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), k);
    const section = async (key) => { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || b.innerText || '')); if (document.querySelector('[data-market-section]') == null && b) b.click(); });
      await page.waitForTimeout(300);
      await page.evaluate(k => document.querySelector(`[data-market-section="${k}"]`)?.click(), key); await page.waitForTimeout(400); };
    const tab = async (label) => { await page.evaluate(l => { const b = [...document.querySelectorAll('[role=tab]')].find(x => x.textContent.trim() === l); b && b.click(); }, label); await page.waitForTimeout(400); };
    const openBuy = (labelHead) => page.evaluate(h => { const b = [...document.querySelectorAll('button[aria-label]')].find(b => (b.getAttribute('aria-label') || '').startsWith(h) && /で(交換|購入)$/.test(b.getAttribute('aria-label'))); if (!b || b.disabled) return false; b.click(); return true; }, labelHead);
    const sheetText = () => page.evaluate(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; return ds.length ? ds[ds.length - 1].innerText.replace(/\s+/g, ' ') : ''; });
    const press = (text) => page.evaluate(t => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; const b = d && [...d.querySelectorAll('button')].find(b => b.innerText.trim().startsWith(t)); if (!b || b.disabled) return false; b.click(); return true; }, text);
    // 同じ描画のうちに「買う」を2回押す(人がせっかちに連打したとき)
    const doubleConfirm = (verb) => page.evaluate(v => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; const b = d && [...d.querySelectorAll('button')].find(b => b.innerText.trim() === `${v}する`); if (!b || b.disabled) return false; b.click(); b.click(); return true; }, verb);
    const fits = async (width) => { await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(250);
      return page.evaluate(w => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; if (!d) return { ok: false, why: '窓が無い' };
        const panel = [d, ...d.querySelectorAll('*')].filter(e => e.getBoundingClientRect().width > 0);
        const over = panel.filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > w + 1; }).map(e => e.tagName + ':' + (e.innerText || '').slice(0, 12));
        return { ok: over.length === 0 && document.documentElement.scrollWidth <= w + 1, why: over.slice(0, 3).join(' / ') + ` scroll=${document.documentElement.scrollWidth}` }; }, width); };

    // おすすめ品は日付だけで決まる(同じ日は同じ品)。ダイヤの道具・100〜5,000ダイヤ・魂格再編の書でない
    const pick = await page.evaluate(() => { const day = jstDayKey4(); const a = assistantMarketPerkPick(BREEDER_MARKET_ITEMS, day), b = assistantMarketPerkPick(BREEDER_MARKET_ITEMS, day);
      return a ? { id: a.id, name: a.name, cost: a.cost, same: a.id === b.id, type: a.type, usage: a.usage || '', cur: a.currency || '', off: assistantMarketPerkCost(a.cost) } : null; });
    ok('⑤ おすすめ品が1つ決まる(同じ日は同じ品)', !!pick && pick.same, JSON.stringify(pick));
    ok('⑤ ダイヤで買う道具・100〜5,000ダイヤ・魂格再編の書でない', !!pick && pick.type === 'item' && !pick.cur && pick.cost >= 100 && pick.cost <= 5000 && pick.usage !== 'soulRankRespec');
    ok('⑤ 割引き後の値段は9割(切り捨て)', !!pick && pick.off === Math.floor(pick.cost * 0.9), `${pick && pick.cost} → ${pick && pick.off}`);
    const ribbonCount = () => page.evaluate(() => [...document.querySelectorAll('[data-market-ribbon]')].filter(e => /1割引き/.test(e.innerText)).length);
    const goods = async () => { await section('diamond'); await tab('アイテム'); await page.waitForTimeout(300); };
    const leave = async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || '')); b && b.click(); }); await page.waitForTimeout(400);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || '')); b && b.click(); }); await page.waitForTimeout(500); };
    const enter = async () => { await page.evaluate(() => { const b = [...document.querySelectorAll('.mh-home-facility')].find(b => (b.innerText || '').replace(/\s+/g, ' ').trim().startsWith('マーケット')); b && b.click(); }); await page.waitForTimeout(700); await dismiss(); };

    // ① 助手がいないとき
    await goods();
    ok('① 助手がマーケットにいないと、1割引きの札は出ない', (await ribbonCount()) === 0);
    ok('① 値段も変わらない(元の値段で買う窓が開く)', await openBuy(pick.name));
    await page.waitForTimeout(300);
    let t0 = await sheetText();
    ok('① 窓の合計が元の値段', t0.includes(`合計 ${pick.cost.toLocaleString()}ダイヤ`), t0.slice(0, 120));
    await page.evaluate(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; const b = d && [...d.querySelectorAll('button')].find(b => /^(閉じる|やめる|キャンセル)/.test(b.innerText.trim())); b && b.click(); }); await page.waitForTimeout(300);
    ok('① 閉じただけでは何も買わず、保存キーも作られない', (await store('mh_gold')) === 50000 && (await store('mh_assistant_market_perk_v1')) === null);

    // ② 助手がいるとき(ページの中でだけ差す。本物の assistantLifeMarketWho は助手ライフ側が用意する)
    await page.evaluate(() => { window.assistantLifeMarketWho = () => 'mua'; });
    await leave(); await enter(); await goods();
    ok('② 助手がいると、おすすめ品に「1割引き」の札が出る', (await ribbonCount()) === 1);
    ok('② 割引きの品の窓が開く', await openBuy(pick.name));
    await page.waitForTimeout(300);
    const t1 = await sheetText();
    ok('② 窓の合計が割引き後の値段', t1.includes(`合計 ${pick.off.toLocaleString()}ダイヤ`) || t1.includes(`${pick.off.toLocaleString()}ダイヤ`), t1.slice(0, 160));
    ok('② 割引き中は1個だけ(数を選ぶ欄が出ない)', !/\+10/.test(t1));
    await press('購入'); await page.waitForTimeout(1200);
    // ③ 買えた
    const it1 = await items(); const perkSaved = await store('mh_assistant_market_perk_v1');
    ok('③ 割引きの値段だけダイヤが減る', (await store('mh_gold')) === 50000 - pick.off, `${await store('mh_gold')}`);
    ok('③ 品が1つ増える', (it1[pick.id] || 0) === 1, JSON.stringify(it1));
    ok('③ 保存キーに { day, used:true } が足される', !!perkSaved && perkSaved.used === true && /^\d{4}-\d{2}-\d{2}$/.test(perkSaved.day), JSON.stringify(perkSaved));
    ok('③ ほかの保存(ダイヤ以外の持ち物)は壊れない', (await store('mh_rhythm_event_points_v1')) === 3000);
    // ④ 1日1回
    await page.waitForTimeout(300);
    ok('④ 使ったあとは札が消える(1日1回)', (await ribbonCount()) === 0);
    ok('④ 同じ品を元の値段で買う窓が開く', await openBuy(pick.name));
    await page.waitForTimeout(300);
    const t2 = await sheetText();
    ok('④ 窓の合計が元の値段に戻る', t2.includes(`合計 ${pick.cost.toLocaleString()}ダイヤ`), t2.slice(0, 120));
    await page.evaluate(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const d = ds[ds.length - 1]; const b = d && [...d.querySelectorAll('button')].find(b => /^(閉じる|やめる|キャンセル)/.test(b.innerText.trim())); b && b.click(); }); await page.waitForTimeout(300);
    // ページを開き直しても使用済みのまま
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    await dismiss();
    await page.evaluate(() => { window.assistantLifeMarketWho = () => 'mua'; });
    await enter(); await goods();
    ok('④ 開き直しても使用済みのまま(札が出ない)', (await ribbonCount()) === 0);
    ok('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) { ok('最後まで進められる', false, String(e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
