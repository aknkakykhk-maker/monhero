// モンヒロビートの小さい画面の配置を、実際に開いて測る(2026-09-27・ユーザー指示「小さい画面の配置」)。
//
//   node tools/mode/rhythm-small-screen-layout-check.js
//
// 見るもの:
//   ・曲えらびで「見た目のおまかせ」の案内が出ているときも、「決定」が画面の中に収まる(縦持ち・横持ち)
//     横持ち(高さ360px)では案内を左下へ浮かせており、右の列(難易度・決定)にかからない
//   ・コンボの節目の輪が、ポーズボタンにかからない。
//     「右上」と縦持ちの「おすすめ」は輪の上側を消している(中心から上へ「輪の幅の5%」より先は描かない)ので、
//     その位置ではコンボの中心とボタンの下端の間がそれより広いことを見る。ほかの位置は輪の半径ぶん離れていること
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9197;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const seed = (lookIntroSeen) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true);
  if (lookIntroSeen) put('mh_rhythm_look_intro_seen_v1', true);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const openSelect = async (w, h, lookIntroSeen) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    await page.addInitScript(seed, lookIntroSeen);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    await page.waitForTimeout(1200);
    return { page, clickText };
  };
  try {
    // --- 曲えらび: 案内が出ていても「決定」が見える ---
    for (const [w, h] of [[360, 640], [320, 568], [640, 360], [740, 360], [844, 390]]) {
      const { page } = await openSelect(w, h, false);
      const r = await page.evaluate(() => {
        const q = (s) => document.querySelector(s), rect = (e) => e && e.getBoundingClientRect();
        const start = rect(q('[data-rhythm-demo-start]')), intro = rect(q('[data-rhythm-look-intro]'));
        const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return { intro: !!intro && intro.height > 0, inside: !!start && start.top >= 0 && start.bottom <= innerHeight + 1 && start.left >= 0 && start.right <= innerWidth + 1,
          overlap: hit(start, intro), start: start && [Math.round(start.top), Math.round(start.bottom)], vh: innerHeight };
      });
      check(`${w}x${h} 見た目の案内が出ている`, r.intro);
      check(`${w}x${h} 案内が出ていても「決定」が画面の中にある`, r.inside, `決定 ${r.start} / 画面の高さ ${r.vh}`);
      check(`${w}x${h} 案内が「決定」にかからない`, !r.overlap);
      await page.close();
    }
    // --- 演奏中: コンボの節目の輪とポーズボタン ---
    for (const [w, h] of [[390, 844], [360, 640], [320, 568], [844, 390], [640, 360]]) {
      const { page } = await openSelect(w, h, true);
      for (let i = 0; i < 5; i++) { if (!(await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((b) => /^確認$|受け取る|閉じる|OK|とじる/.test((b.innerText || '').trim())); if (!x) return false; x.click(); return true; }))) break; await page.waitForTimeout(300); }
      await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
      await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
      await page.waitForTimeout(2000);
      const rows = await page.evaluate(() => {
        const area = document.querySelector('[data-rhythm-play-area]'), pause = document.querySelector('[data-rhythm-pause]').getBoundingClientRect();
        const wide = innerWidth > innerHeight ? '1' : '';
        const positions = typeof RHYTHM_COMBO_POSITIONS !== 'undefined' ? RHYTHM_COMBO_POSITIONS : ['AUTO', 'LEFT', 'CENTER', 'RIGHT', 'HUD'];
        return positions.map((pos) => {
          const box = document.createElement('div');
          box.setAttribute('data-rhythm-combo-box', ''); box.dataset.comboPos = pos; box.dataset.comboWide = wide;
          box.className = 'pointer-events-none absolute z-[2] text-center';
          box.innerHTML = '<b data-rhythm-combo class="block font-black leading-none tabular-nums text-white">300</b><i data-rhythm-combo-ring></i><span data-rhythm-combo-label class="mt-1 block font-black leading-none">COMBO</span>';
          area.appendChild(box);
          const ring = box.querySelector('[data-rhythm-combo-ring]'), cs = getComputedStyle(ring, '::before'), rr = ring.getBoundingClientRect();
          const size = parseFloat(cs.width), radius = size / 2 * 1.6;
          const masked = (cs.maskImage && cs.maskImage !== 'none') || (cs.webkitMaskImage && cs.webkitMaskImage !== 'none');
          const cx = rr.left, cy = rr.top;
          const nx = Math.max(pause.left, Math.min(cx, pause.right)), ny = Math.max(pause.top, Math.min(cy, pause.bottom));
          const dist = Math.hypot(cx - nx, cy - ny);
          // 上側を消した輪: 中心から上へ「幅の5%×最大の倍率」より先は描かない。ボタンは中心より上にある
          const hiddenAbove = size * .05 * 1.6;
          const ok = masked ? (pause.bottom <= cy - hiddenAbove) : dist >= radius;
          box.remove();
          return { pos, ok, detail: masked ? `上側を消した輪: 中心からボタンの下端まで ${Math.round(cy - pause.bottom)}px(${Math.round(hiddenAbove)}px 以上要る)` : `中心からボタンまで ${Math.round(dist)}px / 輪の半径 ${Math.round(radius)}px` };
        });
      });
      rows.forEach((r) => check(`${w}x${h} コンボ位置「${r.pos}」の節目の輪がポーズボタンにかからない`, r.ok, r.detail));
      await page.close();
    }
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
