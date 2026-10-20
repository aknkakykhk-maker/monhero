// まとめて転生(2026-10-17 社長依頼)を、iPhone の画面幅の実ブラウザで確かめる。
//
//   node tools/masu/bulk-reincarnate-browser-check.js
//
//   ① 神殿 → 転生 の一覧で、転生できる子にだけ選ぶ印(□)が付く
//   ② 「すべて選択」は編成中とお気に入りの子を選ばない。印を押せば自分で足せる。「選択を外す」で全部外れる
//   ③ 「まとめて転生」で確認の窓が開き、選んだ子の一覧(編成中の印)・得られる物・失う物・ダイヤの合計と残りが出る。
//      窓は幅375・390からはみ出さない
//   ④ 「転生する」を素早く2回押しても、選んだ子が選んだ回数だけ転生し、ダイヤは合計ぶんだけ減る。選ばなかった子は変わらない
//   ⑤ 1体あたりの回数(−/＋)と「最大」(2026-10-18)。確認の窓に子ごとの回数と、合計の回数での得られる物・失う物が出る
//   計算が1体ずつと同じかは bulk-reincarnate-check.js
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8958;
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise(r => { const s = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const GOLD = 100000000;

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript((gold) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
      put('mh_gold', gold);
      const mk = (id, baseId, name, bondXp) => ({ id, baseId, name, bondXp, colors: [], levelCap: 400, rebirthCount: 30, reincarnateCount: 0 });
      put('mh_masu_mons', [mk('m1', 'Ark', 'アーク編成', 9999999), mk('m2', 'Zan', 'ザンお気に', 9000000), mk('m3', 'Mocchi', 'モッチー', 400000),
        mk('m4', 'Suezo', 'スエゾー', 9500000), mk('m5', 'Golem', 'ゴーレム', 50)]);
      put('mh_monster_roster', ['m1', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
      put('mh_masu_locked_v1', ['m2']); }, GOLD);
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
    const clickText = (re) => page.evaluate(p => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) b.click(); return !!b; }, re);
    ok('HOMEから神殿へ入れる', await clickText('神殿')); await page.waitForTimeout(1000); await dismiss();
    ok('神殿から転生へ入れる', await clickText('^転生')); await page.waitForTimeout(1000); await dismiss();

    const picks = () => page.$$eval('[data-reincarnate-pick]', els => els.map(e => ({ id: e.getAttribute('data-reincarnate-pick'), on: e.getAttribute('aria-checked') === 'true' })));
    let p = await picks();
    ok('転生できる子(4体)にだけ選ぶ印が付く(Lvが足りない子には付かない)', p.map(x => x.id).sort().join() === 'm1,m2,m3,m4', p.map(x => x.id).join());
    ok('最初は何も選ばれていない', p.every(x => !x.on));
    ok('「すべて選択」を押せる', await clickText('^すべて選択$')); await page.waitForTimeout(300);
    p = await picks();
    ok('「すべて選択」は編成中(m1)とお気に入り(m2)を選ばない', p.filter(x => x.on).map(x => x.id).sort().join() === 'm3,m4', p.filter(x => x.on).map(x => x.id).join());
    await page.evaluate(() => document.querySelector('[data-reincarnate-pick="m1"]').click()); await page.waitForTimeout(300);
    p = await picks();
    ok('印を押すと編成中の子も自分で足せる', p.filter(x => x.on).map(x => x.id).sort().join() === 'm1,m3,m4');
    const barText = await page.evaluate(() => document.querySelector('[data-reincarnate-bulk-open]')?.innerText || '');
    ok('ボタンに選んだ数が出る', /まとめて転生（3体）/.test(barText), barText);
    ok('「選択を外す」で全部外れる', await clickText('^選択を外す$') && (await picks()).every(x => !x.on));
    await clickText('^すべて選択$'); await page.evaluate(() => document.querySelector('[data-reincarnate-pick="m1"]').click()); await page.waitForTimeout(300);

    // 1体あたりの回数(2026-10-18)。＋で2回、「最大」で子ごとに続けられるいちばん多い回数(アーク・スエゾー4回、モッチー2回)
    const timesText = () => page.evaluate(() => document.querySelector('[data-reincarnate-bulk-times]')?.innerText.replace(/\s+/g, ' ') || '');
    // 回数は数を打ち込む欄(2026-10-20)。欄の値を読む
    const timesValue = () => page.evaluate(() => document.querySelector('[data-reincarnate-bulk-times] [data-quantity-input]')?.value ?? null);
    const pressTimes = (label) => page.evaluate(l => { const b = [...document.querySelectorAll('[data-reincarnate-bulk-times] button')].find(b => b.innerText.trim().startsWith(l)); if (!b || b.disabled) return false; b.click(); return true; }, label);
    ok('一覧の下に「1体あたりの回数」があり、はじめは1回', /1体あたりの回数/.test(await timesText()) && (await timesValue()) === '1', `${await timesText()} / ${await timesValue()}`);
    ok('＋で2回になる', await pressTimes('＋') && (await timesValue()) === '2');
    const timesInput = page.locator('[data-reincarnate-bulk-times] [data-quantity-input]');
    await timesInput.fill('3'); await page.waitForTimeout(150);
    ok('回数を打ち込める(3回。モッチーは2回までなので計8回)', (await timesValue()) === '3' && /計8回/.test(await page.evaluate(() => document.querySelector('[data-reincarnate-bulk-open]')?.innerText || '')));
    await timesInput.fill('99'); await page.waitForTimeout(150);
    ok('続けられる回数より多く打つと、いちばん多い回数(4)にそろう', (await timesValue()) === '4');
    await timesInput.fill('2'); await timesInput.blur(); await page.waitForTimeout(150);
    ok('「最大」に、選んだ子のいちばん多い回数(4回)が出る', /最大（4回）/.test(await timesText()), await timesText());
    ok('「最大」を押せる', await pressTimes('最大')); await page.waitForTimeout(300);
    const barMax = await page.evaluate(() => document.querySelector('[data-reincarnate-bulk-open]')?.innerText || '');
    ok('ボタンに合計の回数が出る(3体・計10回)', /まとめて転生（3体・計10回）/.test(barMax), barMax);
    await page.evaluate(() => document.querySelector('[data-reincarnate-bulk-open]').click()); await page.waitForTimeout(500);
    const counts = await page.$$eval('[data-reincarnate-bulk-list] li', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    ok('確認の窓に子ごとの回数が出る(アーク・スエゾー×4回、モッチー×2回)', counts.length === 3 && counts.filter(t => /×4回/.test(t)).length === 2 && counts.some(t => /モッチー.*×2回/.test(t)), counts.join(' / '));
    ok('確認の窓の得られる物・失う物が合計の回数で出る', await page.evaluate(() => { const t = document.querySelector('[data-reincarnate-bulk-confirm]').innerText.replace(/\s+/g, ' '); return /\+10×10回/.test(t) && /固有技ポイント \+1×10回/.test(t) && /−99×10回/.test(t); }));
    const confirm = await page.evaluate(() => { const d = document.querySelector('[data-reincarnate-bulk-confirm]'); if (!d) return null;
      return { text: d.innerText.replace(/\s+/g, ' '), rows: d.querySelectorAll('[data-reincarnate-bulk-list] li').length }; });
    ok('確認の窓が開き、選んだ3体が並ぶ', !!confirm && confirm.rows === 3, confirm ? confirm.text.slice(0, 120) : '開かない');
    ok('一覧に編成中の印・Lvの変化が出る', !!confirm && /アーク編成 ?編成中/.test(confirm.text) && /Lv\.\d+ → Lv\.\d+/.test(confirm.text));
    ok('得られる物・失う物・必要ダイヤ合計・所持ダイヤ・転生後の残りが出る', !!confirm && ['得られる物', '失う物', '必要ダイヤ合計', '所持ダイヤ', '転生後'].every(t => confirm.text.includes(t)));
    const totalCost = confirm ? Number((confirm.text.match(/必要ダイヤ合計 ?([\d,]+)/) || [])[1]?.replace(/,/g, '')) : NaN;
    ok('合計のダイヤが読める', Number.isFinite(totalCost) && totalCost > 0, String(totalCost));
    for (const w of [375, 390]) {
      await page.setViewportSize({ width: w, height: 844 }); await page.waitForTimeout(250);
      const f = await page.evaluate(w => { const d = document.querySelector('[data-reincarnate-bulk-confirm]'); const over = [d, ...d.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > w + 1); });
        return { ok: over.length === 0 && document.documentElement.scrollWidth <= w + 1, why: over.slice(0, 3).map(e => e.tagName + ':' + (e.innerText || '').slice(0, 10)).join(' / ') }; }, w);
      ok(`確認の窓が幅${w}からはみ出さない`, f.ok, f.why);
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
    const beforeMons = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]'));
    const pressed = await page.evaluate(() => { const d = document.querySelector('[data-reincarnate-bulk-confirm]'); const b = [...d.querySelectorAll('button')].find(b => /体を転生する$/.test(b.innerText.trim())); if (!b || b.disabled) return false; b.click(); b.click(); return true; });
    ok('「3体を転生する」を2回押せる状態', pressed);
    await page.waitForTimeout(5200);
    const saved = await page.evaluate(() => ({ mons: JSON.parse(localStorage.getItem('mh_masu_mons') || '[]'), gold: JSON.parse(localStorage.getItem('mh_gold') || 'null') }));
    const rc = Object.fromEntries(saved.mons.map(m => [m.id, m.reincarnateCount || 0]));
    ok('2回押しても二重にならず、選んだ子が最大の回数だけ転生する(4・2・4回)', rc.m1 === 4 && rc.m3 === 2 && rc.m4 === 4, JSON.stringify(rc));
    ok('選ばなかった子(お気に入り・Lv不足)は転生前の保存値のまま', ['m2', 'm5'].every(id => JSON.stringify(saved.mons.find(m => m.id === id)) === JSON.stringify(beforeMons.find(m => m.id === id))));
    ok('ダイヤは合計ぶんだけ1回減る', saved.gold === GOLD - totalCost, `${saved.gold} / ${GOLD - totalCost}`);
    ok('転生後は選んだ印が外れ、確認の窓が閉じる', (await picks()).every(x => !x.on) && !(await page.$('[data-reincarnate-bulk-confirm]')));
    ok('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) { ok('最後まで進められる', false, String(e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
