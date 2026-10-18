// マーケットのまとめ買い(2026-10-17 社長依頼「勇者のかけらとか証とか、その他まとめ買いできるようにして」)を、
// iPhone の画面幅の実ブラウザで確かめる。
//
//   node tools/market/market-bulk-purchase-browser-check.js
//
//   ① アイテム交換所「勇者の証」: 証片→勇者の証 を個数を選んで(+10・MAX)まとめて交換できる。
//      窓に合計・持っている数・交換後の残りが出る。「交換する」を素早く2回押しても1回ぶんしか引かれない
//   ② 同じく 勇者の証→魂格再編の書 を3冊まとめて交換できる
//   ③ ダイヤショップ「アイテム」: トレーニングチケットを11枚まとめ買い(2回押しても1回ぶん)
//   ④ ビートP交換所「強化素材」: 勇者の証片を MAX でまとめ交換(2回押しても1回ぶん)
//   ⑤ 窓が iPhone の幅(375・390)からはみ出さない。画面に横スクロールが出ない
//   ⑥ 数を直接打ち込める(2026-10-19)。数字のキーボード・16px以上・上限超え/小数/空/0 のそろえ方・合計が追いつく
// 計算の細かいところ(1個ずつN回と同じ結果か)は market-bulk-purchase-check.js
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8957;
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

    // ① 証片 → 勇者の証
    await section('exchange'); await tab('勇者の証');
    ok('「勇者の証を勇者の証片20個で交換」の窓が開く', await openBuy('勇者の証を勇者の証片'));
    await page.waitForTimeout(300);
    ok('窓に個数を選ぶ欄(-10・-1・+1・+10・MAX)がある', await page.evaluate(() => { const ds = [...document.querySelectorAll('[role="dialog"]')]; const t = ds[ds.length - 1]?.innerText || ''; return ['-10', '-1', '+1', '+10', 'MAX'].every(s => t.includes(s)); }));
    await press('+10');
    await page.waitForTimeout(200);
    let t = await sheetText();
    ok('+10 で 10個(証片205個なので最大10個)・合計 証片200個・交換後の残り5個が出る', /合計 勇者の証片200個/.test(t) && /残り勇者の証片5個/.test(t) && /205/.test(t), t.slice(0, 160));
    for (const w of [375, 390]) { const f = await fits(w); ok(`窓が幅${w}からはみ出さない`, f.ok, f.why); }
    ok('「交換する」を2回押せる状態', await doubleConfirm('交換'));
    await page.waitForTimeout(1200);
    let it = await items();
    ok('2回押しても1回ぶん: 証片205→5・証2→12', it.hero_proof_shard === 5 && it.hero_proof === 12, JSON.stringify(it));
    ok('交換できたら窓が閉じる', (await sheetText()) === '' || !(await sheetText()).includes('交換する'));

    // ② 勇者の証 → 魂格再編の書
    ok('「魂格再編の書を勇者の証1個で交換」の窓が開く', await openBuy('魂格再編の書を勇者の証'));
    await page.waitForTimeout(300);
    await press('+1'); await press('+1'); await page.waitForTimeout(200);
    t = await sheetText();
    ok('3冊・合計 勇者の証3個・残り9個が出る', /合計 勇者の証3個/.test(t) && /残り勇者の証9個/.test(t), t.slice(0, 160));
    await doubleConfirm('交換'); await page.waitForTimeout(1200);
    it = await items();
    ok('2回押しても1回ぶん: 証12→9・魂格再編の書0→3', it.hero_proof === 9 && it.soul_rank_respec_scroll === 3, JSON.stringify(it));

    // ③ ダイヤショップの消耗品
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || '')); b && b.click(); }); await page.waitForTimeout(400);
    await section('diamond'); await tab('アイテム');
    ok('トレーニングチケットの窓が開く', await openBuy('トレーニングチケットを'));
    await page.waitForTimeout(300);
    await press('+10'); await page.waitForTimeout(200);
    t = await sheetText();
    ok('11枚・合計1,100ダイヤ・残り48,900ダイヤが出る', /合計 1,100ダイヤ/.test(t) && /残り48,900ダイヤ/.test(t), t.slice(0, 160));
    await doubleConfirm('購入'); await page.waitForTimeout(1200);
    it = await items();
    ok('2回押しても1回ぶん: チケット1→12・ダイヤ50,000→48,900', it.training_ticket === 12 && (await store('mh_gold')) === 48900, `${it.training_ticket} / ${await store('mh_gold')}`);

    // ④ ビートP交換所の勇者の証片(1個500P、3,000Pなので最大6回)
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || '')); b && b.click(); }); await page.waitForTimeout(400);
    await section('event'); await tab('強化素材');
    ok('ビートP「勇者の証片」の窓が開く', await openBuy('勇者の証片を'));
    await page.waitForTimeout(300);
    await press('MAX'); await page.waitForTimeout(200);
    t = await sheetText();
    ok('MAXで6回・合計3,000ビートP・受け取り6個・残り0が出る', /合計 3,000ビートP/.test(t) && /受け取り 6個/.test(t) && /残り0ビートP/.test(t), t.slice(0, 200));
    await doubleConfirm('交換'); await page.waitForTimeout(1200);
    it = await items();
    ok('2回押しても1回ぶん: 証片5→11・ビートP3,000→0', it.hero_proof_shard === 11 && (await store('mh_rhythm_event_points_v1')) === 0, `${it.hero_proof_shard} / ${await store('mh_rhythm_event_points_v1')}`);

    // ⑥ 数を直接打ち込む(2026-10-19 社長「マーケットのアイテムは直接数値入力で買えるようにしよう！」)
    //    ダイヤは48,900、トレーニングチケットは1枚100ダイヤなので、買えるのは489枚まで
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /戻る/.test(b.getAttribute('aria-label') || '')); b && b.click(); }); await page.waitForTimeout(400);
    await section('diamond'); await tab('アイテム');
    ok('数を打ち込む: トレーニングチケットの窓が開く', await openBuy('トレーニングチケットを')); await page.waitForTimeout(300);
    const input = page.locator('[role="dialog"] [data-quantity-input]');
    const inputInfo = await input.evaluate(el => ({ mode: el.getAttribute('inputmode'), size: parseFloat(getComputedStyle(el).fontSize) }));
    ok('数の欄は数字のキーボードが出る形(inputmode=numeric)で、字は16px以上(iPhone で拡大されない)', inputInfo.mode === 'numeric' && inputInfo.size >= 16, JSON.stringify(inputInfo));
    const typeAndRead = async (text) => { await input.fill(text); await page.waitForTimeout(150); return { value: await input.inputValue(), sheet: await sheetText() }; };
    let r = await typeAndRead('25');
    ok('「25」と打つと、打っている途中で合計が2,500ダイヤ・残り46,400ダイヤになる', /合計 2,500ダイヤ/.test(r.sheet) && /残り46,400ダイヤ/.test(r.sheet), r.sheet.slice(0, 160));
    r = await typeAndRead('99999');
    ok('買える数より多く打つと、買える数(489)にそろう', r.value === '489' && /合計 48,900ダイヤ/.test(r.sheet), r.value);
    r = await typeAndRead('3.7');
    ok('小数は点より前だけ(3)になる', r.value === '3' && /合計 300ダイヤ/.test(r.sheet), r.value);
    r = await typeAndRead('');
    ok('空のあいだは1として数える(合計100ダイヤ)', /合計 100ダイヤ/.test(r.sheet), r.sheet.slice(0, 120));
    r = await typeAndRead('0');
    ok('0のあいだも1として数える', /合計 100ダイヤ/.test(r.sheet));
    await input.blur(); await page.waitForTimeout(150);
    ok('欄を離れると、そろえた数(1)が出る', (await input.inputValue()) === '1');
    await typeAndRead('7');
    await press('+1'); await page.waitForTimeout(150);
    ok('打ったあとに+1を押すと、打った数から増える(8)', (await input.inputValue()) === '8' && /合計 800ダイヤ/.test(await sheetText()));
    for (const w of [375, 390]) { const f = await fits(w); ok(`数の欄があっても窓が幅${w}からはみ出さない`, f.ok, f.why); }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
    await doubleConfirm('購入'); await page.waitForTimeout(1200);
    it = await items();
    ok('打ち込んだ数で買える(2回押しても1回ぶん): チケット12→20・ダイヤ48,900→48,100', it.training_ticket === 20 && (await store('mh_gold')) === 48100, `${it.training_ticket} / ${await store('mh_gold')}`);
    ok('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) { ok('最後まで進められる', false, String(e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
