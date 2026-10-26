// デバッグ設定の入口の合言葉(2026-10-20 社長決定・改善部の見直し M1)を、実ブラウザで確かめる。
//
//   node tools/boot/debug-passphrase-browser-check.js
//
//   ① ふつうのブラウザ(自動操作の印を消す)では、ヘルプの「💊」で合言葉の窓が出て、デバッグ設定は開かない
//   ② 違う合言葉では「合言葉が違います」と出て、開かない。覚えもしない(mh_debug_unlocked_v1 が付かない)
//   ③ 合言葉の欄は16px以上(iPhone で拡大されない)・字が見えない(password)
//   ④ 合った端末(mh_debug_unlocked_v1='1')では聞かずにデバッグ設定が開く
//   ⑤ 自動操作のブラウザ(検査・手順書)は、これまでどおり「💊」でそのまま開く
//   合言葉そのものはここにも書かない(社長が決めて差し替えるため)
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8959;
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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async ({ human, unlocked }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    // ★本物の Supabase へは何も届けない(2026-10-27)。この検査は人の端末に見せるため navigator.webdriver を false に偽り、
    //   ゲームの「自動操作のブラウザは本物へ書かない」止め(26-supabase.jsx)が効かなくなる。差し替えなしだと、
    //   名前「テスト」・アイコン🐣の端末が本番の breeder_profiles / breeder_levels へ行を足し続ける(実際に起きた)。読み込みも空で返す
    await page.route(/\.supabase\.co\//, route => route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(({ human, unlocked }) => {
      if (human) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
      if (unlocked) localStorage.setItem('mh_debug_unlocked_v1', '1');
    }, { human, unlocked });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    for (let i = 0; i < 14; i++) {
      const did = await page.evaluate(() => { const inOverlay = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
        const l = [...document.querySelectorAll('button')].filter(b => inOverlay(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
        if (!l.length) return false; l[0].click(); return true; });
      if (!did) break; await page.waitForTimeout(300);
    }
    const clickText = (re) => page.evaluate(p => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) b.click(); return !!b; }, re);
    await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
    await clickText('^ヘルプ'); await page.waitForTimeout(900);
    const pill = await clickText('💊'); await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({ pass: !!document.querySelector('[data-debug-passphrase]'), debug: /用途ごとに畳んであります/.test(document.body.innerText) && !document.querySelector('[data-debug-passphrase]') }));
    return { page, errors, pill, state };
  };
  try {
    // ①〜③
    {
      const { page, errors, pill, state } = await open({ human: true, unlocked: false });
      ok('ふつうのブラウザでは「💊」で合言葉の窓が出る', pill && state.pass, JSON.stringify(state));
      const input = page.locator('[data-debug-passphrase] input');
      const info = await input.evaluate(el => ({ type: el.type, mode: el.getAttribute('inputmode'), size: parseFloat(getComputedStyle(el).fontSize) }));
      ok('合言葉の欄は伏せ字(password)・数字のキーボード・16px以上', info.type === 'password' && info.mode === 'numeric' && info.size >= 16, JSON.stringify(info));
      await input.fill('12345678'); await page.locator('[data-debug-passphrase] button[type="submit"]').click(); await page.waitForTimeout(3000);
      const after = await page.evaluate(() => ({ text: document.querySelector('[data-debug-passphrase]')?.innerText || '', key: localStorage.getItem('mh_debug_unlocked_v1') }));
      ok('違う合言葉では「合言葉が違います」と出て、開かず、覚えもしない', /合言葉が違います/.test(after.text) && after.key === null, JSON.stringify(after));
      ok('画面のエラーが出ていない(ふつうのブラウザ)', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ④
    {
      const { page, state } = await open({ human: true, unlocked: true });
      ok('合った端末(mh_debug_unlocked_v1)では聞かずにデバッグ設定が開く', !state.pass && state.debug, JSON.stringify(state));
      await page.close();
    }
    // ⑤
    {
      const { page, state } = await open({ human: false, unlocked: false });
      ok('自動操作のブラウザ(検査・手順書)は、これまでどおり「💊」でそのまま開く', !state.pass && state.debug, JSON.stringify(state));
      await page.close();
    }
  } catch (e) { ok('最後まで進められる', false, String(e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
  process.exit(failed === 0 ? 0 : 1);
})();
